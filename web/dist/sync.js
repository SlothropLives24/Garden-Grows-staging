// Account sync (Phase 4 / D-020) - APP LAYER, deliberately outside web/src/engine/.
//
// The backend is a managed Supabase project the MAINTAINER creates (docs/ACCOUNTS-SETUP.md);
// this module speaks its two plain-HTTP APIs directly - GoTrue (/auth/v1) for email+password
// sessions and PostgREST (/rest/v1) for one row-level-secured table of the user's records.
// No SDK: the app's zero-runtime-dependency rule holds, and the entire wire surface is the
// handful of fetch calls below. Configuration (project URL + publishable anon key) is pasted
// by the user into the Account page and kept in localStorage by app.ts - never in this repo.
//
// WHAT SYNCS: the transactional store - seasons, plots, and the user's added plant varieties
// (D-020) - plus the user's display preferences (units/temperature, one "pref" row). All ride the
// one row-level-secured garden_records table, distinguished by `kind`; no schema change was needed to
// add either user species or prefs. The corpus never touches the backend, and it is never one of
// these records. Local-first is not negotiable: the no-account mode keeps working, the byte-pinned
// export stays the escape hatch, and the merge rule below never silently discards this device's data.
//
// Functions take an injectable fetch so the merge planner and wire calls are testable outside
// a browser. No DOM, no localStorage in here.
async function call(f, url, init, what) {
    let res;
    try {
        res = await f(url, init);
    }
    catch (e) {
        throw new Error(`${what}: could not reach the backend (${e instanceof Error ? e.message : e})`);
    }
    if (!res.ok) {
        let detail = `${res.status}`;
        try {
            const body = await res.json();
            detail = String(body.msg ?? body.message ?? body.error_description ?? body.error ?? res.status);
        }
        catch { /* non-JSON error body */ }
        // A 5xx or 429 is the backend failing or throttling us, not a client/auth problem: mark it
        // TRANSIENT so callers retry instead of treating it as fatal. The sync refresh path keys off
        // this - a live session must NOT be dropped because the project had a bad minute or was briefly
        // paused (security review); only a real auth rejection (a 4xx like invalid_grant) is fatal.
        if (res.status >= 500 || res.status === 429) {
            throw new Error(`${what}: the backend is temporarily unavailable (${detail})`);
        }
        throw new Error(`${what}: ${detail}`);
    }
    return res;
}
const authHeaders = (cfg, token) => ({
    "apikey": cfg.anonKey,
    "Authorization": `Bearer ${token ?? cfg.anonKey}`,
    "Content-Type": "application/json",
});
// --- auth (GoTrue) -----------------------------------------------------------------
export async function signUp(cfg, email, password, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/signup`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email, password }),
    }, "sign up");
    const body = await res.json();
    // with email confirmation ON, signup returns a user but no session - the caller says so
    if (!body.access_token)
        return null;
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email, userId: userIdOf(body) };
}
// GoTrue token responses carry the account under `user: { id, ... }`; pull the uuid out when it is
// there (it is on sign-in/sign-up, absent on a bare refresh). Kept separate so every session-minting
// call stamps the id the same way.
function userIdOf(body) {
    const u = body.user;
    return u && typeof u.id === "string" ? u.id : undefined;
}
export async function signIn(cfg, email, password, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email, password }),
    }, "sign in");
    const body = await res.json();
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email, userId: userIdOf(body) };
}
export async function refreshSession(cfg, session, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ refresh_token: session.refresh_token }),
    }, "session refresh");
    const body = await res.json();
    // keep the id if the refresh carried one, else preserve whatever the session already had
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email: session.email, userId: userIdOf(body) ?? session.userId };
}
export async function signOut(cfg, session, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/logout`, {
        method: "POST", headers: authHeaders(cfg, session.access_token),
    }, "sign out").catch(() => undefined); // a failed remote logout still clears locally
}
// --- records (PostgREST) -----------------------------------------------------------
export async function pullRecords(cfg, session, f = fetch) {
    // user_id joins the projection (D-172): row-level security now returns a caller's OWN rows AND the
    // rows of gardens shared with them through a team, so the app must know which is which. A row whose
    // user_id differs from the caller's is a shared garden's row.
    const res = await call(f, `${cfg.url}/rest/v1/garden_records?select=kind,key,record,updated_at,user_id`, {
        headers: authHeaders(cfg, session.access_token),
    }, "pull");
    return await res.json();
}
/** Push local records to the backend, GROUPED BY KIND - one request per kind - so a rejection of one
 *  kind can't strand the others. Postgres upserts transactionally: a single bad row fails the whole
 *  POST, so a stray `user_species` row (a backend whose schema predates custom plants, D-020 follow-up)
 *  used to block seasons AND plots from ever syncing - which is exactly how a removed planting failed
 *  to reach the server and kept coming back on the next login. Returns what pushed and any per-kind
 *  failure so the caller reports it WITHOUT aborting the whole sync (the seasons still push). */
export async function pushRecords(cfg, session, records, f = fetch) {
    const byKind = new Map();
    for (const r of records) {
        const g = byKind.get(r.kind);
        if (g)
            g.push(r);
        else
            byKind.set(r.kind, [r]);
    }
    let pushed = 0;
    const failures = [];
    for (const [kind, recs] of byKind) {
        const rows = recs.map((r) => ({
            kind: r.kind, key: r.key, record: r.record,
            updated_at: new Date(r.updatedAt ?? Date.now()).toISOString(),
            // A shared garden's row is written under the OWNER's user_id (D-172); an own row omits it and
            // the backend defaults it to the caller (auth.uid()).
            ...(r.ownerId ? { user_id: r.ownerId } : {}),
        }));
        try {
            await call(f, `${cfg.url}/rest/v1/garden_records`, {
                method: "POST",
                headers: { ...authHeaders(cfg, session.access_token), "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(rows),
            }, "push");
            pushed += recs.length;
        }
        catch (e) {
            failures.push({ kind, count: recs.length, error: e instanceof Error ? e.message : String(e) });
        }
    }
    return { pushed, failures };
}
/** Change the signed-in user's password or email (GoTrue's standard surface). An email change
 *  is confirmed by a message to the new address before it takes effect. */
export async function updateUser(cfg, session, changes, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/user`, {
        method: "PUT", headers: authHeaders(cfg, session.access_token), body: JSON.stringify(changes),
    }, "account update");
}
/** Ask the backend to email a password-recovery link. Deliberately quiet about whether the
 *  address exists (the server behaves the same either way - no account enumeration). */
export async function recoverPassword(cfg, email, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/recover`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email }),
    }, "password reset");
}
/** Who does this access token belong to - used when a recovery link lands (the URL carries
 *  tokens but no email). */
export async function getUser(cfg, accessToken, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/user`, { headers: authHeaders(cfg, accessToken) }, "session check");
    const body = await res.json();
    return { email: String(body.email ?? ""), id: String(body.id ?? "") };
}
/** Deletes the account and every record - the SQL function in docs/accounts-schema.sql,
 *  runnable only by the signed-in user on themselves. */
export async function deleteAccount(cfg, session, f = fetch) {
    await call(f, `${cfg.url}/rest/v1/rpc/delete_my_account`, {
        method: "POST", headers: authHeaders(cfg, session.access_token), body: "{}",
    }, "delete account");
}
const restGet = async (cfg, session, path, f, what) => {
    const res = await call(f, `${cfg.url}/rest/v1/${path}`, { headers: authHeaders(cfg, session.access_token) }, what);
    return await res.json();
};
const restWrite = async (cfg, session, path, method, body, f, what, represent = false) => {
    const headers = { ...authHeaders(cfg, session.access_token) };
    if (represent)
        headers["Prefer"] = "return=representation";
    const res = await call(f, `${cfg.url}/rest/v1/${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }, what);
    if (represent) {
        const rows = await res.json();
        return rows[0];
    }
    return undefined;
};
/** Every team the caller belongs to - owned OR joined (row-level security unions the two). */
export async function listTeams(cfg, session, f = fetch) {
    return restGet(cfg, session, "teams?select=id,name,owner_id,owner_email,created_at&order=created_at.asc", f, "load teams");
}
/** Create a team the caller owns. owner_id and owner_email default server-side from the session. */
export async function createTeam(cfg, session, name, f = fetch) {
    return await restWrite(cfg, session, "teams", "POST", { name }, f, "create team", true);
}
export async function renameTeam(cfg, session, id, name, f = fetch) {
    await restWrite(cfg, session, `teams?id=eq.${encodeURIComponent(id)}`, "PATCH", { name }, f, "rename team");
}
/** Delete a team the caller OWNS (row-level security refuses a non-owner). Cascades its roster,
 *  attachments, and invites - the attached gardens' own rows are untouched (a team never owned them). */
export async function deleteTeam(cfg, session, id, f = fetch) {
    await restWrite(cfg, session, `teams?id=eq.${encodeURIComponent(id)}`, "DELETE", undefined, f, "delete team");
}
/** The roster of a team the caller is on. member_email is the identity the People screen shows. */
export async function listMembers(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_members?team_id=eq.${encodeURIComponent(teamId)}&select=team_id,member_id,role,member_email,created_at&order=created_at.asc`, f, "load roster");
}
/** Leave a team the caller is a member of. Scoped to the caller's own membership row by BOTH an
 *  explicit member_id filter and row-level security, so an owner can never accidentally clear the
 *  whole roster through this path. Needs the caller's uuid - fetched once if the session predates it. */
export async function leaveTeam(cfg, session, teamId, f = fetch) {
    const uid = session.userId ?? (await getUser(cfg, session.access_token, f)).id;
    await restWrite(cfg, session, `team_members?team_id=eq.${encodeURIComponent(teamId)}&member_id=eq.${encodeURIComponent(uid)}`, "DELETE", undefined, f, "leave team");
}
/** Mint an invite addressed to an email the owner already knows. A plain insert with NO lookup: it
 *  never reveals whether the address has an account (D-172). The address is lowercased so the
 *  invitee's case-insensitive match holds. */
export async function mintInvite(cfg, session, teamId, email, f = fetch) {
    return await restWrite(cfg, session, "team_invites", "POST", { team_id: teamId, invited_email: email.trim().toLowerCase() }, f, "invite", true);
}
/** The still-pending invites the OWNER has sent for a team (accepted ones drop out). */
export async function listSentInvites(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_invites?team_id=eq.${encodeURIComponent(teamId)}&accepted_at=is.null&select=id,team_id,invited_email,expires_at,created_at&order=created_at.asc`, f, "load invites");
}
/** Live invites addressed to the CALLER (row-level security filters to their JWT email, unaccepted,
 *  unexpired). Embeds the team name + owner so the invitee sees who is asking. */
export async function listMyInvites(cfg, session, f = fetch) {
    return restGet(cfg, session, "team_invites?select=id,team_id,invited_email,expires_at,created_at,teams(name,owner_email)", f, "check invites");
}
export async function revokeInvite(cfg, session, inviteId, f = fetch) {
    await restWrite(cfg, session, `team_invites?id=eq.${encodeURIComponent(inviteId)}`, "DELETE", undefined, f, "revoke invite");
}
/** Redeem an invite addressed to the caller. The server RPC re-checks the JWT email, records the
 *  membership (with the caller's email for the roster), and marks the invite used. Returns the joined
 *  team's id. */
export async function acceptInvite(cfg, session, inviteId, f = fetch) {
    const res = await call(f, `${cfg.url}/rest/v1/rpc/accept_team_invite`, {
        method: "POST", headers: authHeaders(cfg, session.access_token), body: JSON.stringify({ invite_id: inviteId }),
    }, "accept invite");
    return await res.json();
}
/** Attach one of the CALLER'S OWN gardens to a team they are on. owner_id is pinned to the caller by
 *  both this argument and the row-level-security insert check - a member cannot attach a garden they
 *  do not own. `plot` is the owner's local plot id, which is the wire key its records already carry. */
export async function attachGarden(cfg, session, teamId, plot, f = fetch) {
    const uid = session.userId ?? (await getUser(cfg, session.access_token, f)).id;
    return await restWrite(cfg, session, "team_gardens", "POST", { team_id: teamId, owner_id: uid, plot }, f, "attach garden", true);
}
/** Detach a garden - by the garden's owner or the team's owner (row-level security enforces both). */
export async function detachGarden(cfg, session, teamId, ownerId, plot, f = fetch) {
    await restWrite(cfg, session, `team_gardens?team_id=eq.${encodeURIComponent(teamId)}&owner_id=eq.${encodeURIComponent(ownerId)}&plot=eq.${encodeURIComponent(plot)}`, "DELETE", undefined, f, "detach garden");
}
/** The gardens attached to a team the caller is on. */
export async function listAttachments(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_gardens?team_id=eq.${encodeURIComponent(teamId)}&select=team_id,owner_id,plot,created_at&order=created_at.asc`, f, "load attachments");
}
// --- shared gardens: the pure model (D-172; unit-tested in web/test.mjs) -------------------------
// A garden owned by one account and reached by a teammate through a team grant. It is namespaced
// locally so it can never collide with the member's OWN plot_home (the D-152 never-collide rule, one
// space down), while its WIRE identity (the owner's user_id + plot id) is preserved so edits sync
// back to the owner's account and not the editor's. These functions are pure string/record transforms
// with no storage or DOM, so the round-trip is provable in a unit test.
/** The local id a shared garden takes: `shared:<owner8>:<plot>`. The 8-char owner prefix is enough to
 *  separate two owners' identically-named gardens in practice, and the full owner_id rides in the
 *  plot's `shared` marker, so this is a display/collision key, not the source of truth. */
export function sharedLocalPlotId(ownerId, plot) {
    return `shared:${ownerId.slice(0, 8)}:${plot}`;
}
/** Parse a shared local id back to its parts, or null if it is not a shared id. The plot may itself
 *  contain colons in principle, so everything after the second colon is the plot - never split blindly. */
export function parseSharedLocalPlotId(localId) {
    if (!localId.startsWith("shared:"))
        return null;
    const rest = localId.slice("shared:".length);
    const i = rest.indexOf(":");
    if (i < 0)
        return null;
    return { owner8: rest.slice(0, i), plot: rest.slice(i + 1) };
}
export const isSharedLocalId = (id) => !!id && id.startsWith("shared:");
/** Split pulled rows into the caller's OWN rows and the SHARED rows (grouped by owner). A row with no
 *  user_id, or user_id equal to the caller, is own; anything else is a shared garden's row. */
export function partitionRemote(remote, myUserId) {
    const own = [];
    const sharedByOwner = new Map();
    for (const r of remote) {
        if (!r.user_id || r.user_id === myUserId) {
            own.push(r);
            continue;
        }
        const g = sharedByOwner.get(r.user_id);
        if (g)
            g.push(r);
        else
            sharedByOwner.set(r.user_id, [r]);
    }
    return { own, sharedByOwner };
}
/** An owner's plot record, as pulled, → the local namespaced copy carrying the shared marker. */
export function toSharedPlot(record, mark) {
    return { ...record, id: sharedLocalPlotId(mark.ownerId, record.id), owner: "account", shared: mark };
}
/** The local shared plot → the wire form: the owner's id restored, the local-only marker stripped,
 *  and the owner's user_id to write under. Null if the plot is not shared. */
export function fromSharedPlot(local) {
    if (!local.shared)
        return null;
    const mark = local.shared;
    const record = { ...local, id: mark.plot };
    delete record.shared;
    return { key: mark.plot, record, ownerId: mark.ownerId };
}
/** An owner's season record, as pulled, → the local copy whose plot points at the namespaced id. */
export function toSharedSeason(record, ownerId) {
    return { ...record, plot: sharedLocalPlotId(ownerId, record.plot) };
}
/** The local shared season → the wire form (the owner's plot restored in the key AND the record). */
export function fromSharedSeason(local, mark) {
    return { key: `${mark.plot}:${local.id}`, record: { ...local, plot: mark.plot }, ownerId: mark.ownerId };
}
/** Posts share seasons' plot-scoped shape, so they take the same namespacing on the way in and out. */
export function toSharedPost(record, ownerId) {
    return { ...record, plot: sharedLocalPlotId(ownerId, record.plot) };
}
export function fromSharedPost(local, mark) {
    return { key: `${mark.plot}:${local.id}`, record: { ...local, plot: mark.plot }, ownerId: mark.ownerId };
}
const sameBytes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Union two beds arrays by bed NAME - the app's existing bed identity (groundmap.ts finds a bed by
// name). The newer side wins a name collision; beds unique to either side are all kept; the result is
// sorted by name so the merge is a canonical form both devices converge on regardless of edit order.
// Deletion is NOT tracked (D-092): a bed deleted on one device but still present on the other reappears
// until a follow-up adds tombstones - the deliberate v1 trade (keep-everything over lose-a-bed).
function unionBeds(newer, older) {
    const byName = new Map();
    for (const b of newer)
        byName.set(b.name, b);
    for (const b of older)
        if (!byName.has(b.name))
            byName.set(b.name, b);
    return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
// Newest deletion time per bed name, across both sides' tombstones.
function mergeTombs(a, b) {
    const m = new Map();
    for (const t of [...a, ...b]) {
        const prev = m.get(t.name);
        if (prev === undefined || t.at > prev)
            m.set(t.name, t.at);
    }
    return m;
}
// Merge two versions of the SAME plot (same id): union the beds, but honour deletion tombstones so a
// removed bed isn't resurrected by the copy that still has it (D-092). A bed survives unless a deletion
// of that name is NEWER than the newest side still holding it. Non-bed fields (name, address, anchor)
// come from the newer side, never dropping an anchor one side happens to lack. localAt null = this
// device's copy has NO edit stamp, so its age is unknown - treated as OLDEST (D-124): the account's
// synced copy wins any same-name conflict, while beds unique to this device are still kept by the
// union. (The old rule treated unstamped as NEWEST, which let a stale, rarely-used device overwrite
// every other device's edits on each login - the recurring desktop-vs-mobile mismatch.)
function mergePlot(local, remote, localAt, remoteAt) {
    const lAt = localAt ?? Number.NEGATIVE_INFINITY;
    const newer = lAt >= remoteAt ? local : remote;
    const older = lAt >= remoteAt ? remote : local;
    const tombs = mergeTombs(local.removedBeds ?? [], remote.removedBeds ?? []);
    const inLocal = new Set((local.beds ?? []).map((b) => b.name));
    const inRemote = new Set((remote.beds ?? []).map((b) => b.name));
    // presence time of a name = newest plot stamp among the sides that still HOLD a bed of that name
    const presence = (name) => Math.max(inLocal.has(name) ? lAt : -Infinity, inRemote.has(name) ? remoteAt : -Infinity);
    const beds = unionBeds(newer.beds ?? [], older.beds ?? [])
        .filter((b) => { const del = tombs.get(b.name); return del === undefined || presence(b.name) > del; });
    // keep only tombstones that are still winning (their bed was dropped); a re-add newer than the delete
    // prunes the tombstone so it can't keep suppressing the bed and so the list can't grow without bound.
    const kept = new Set(beds.map((b) => b.name));
    const removedBeds = [...tombs].filter(([name]) => !kept.has(name))
        .map(([name, at]) => ({ name, at }))
        .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    const out = { ...older, ...newer, beds, anchor: newer.anchor ?? older.anchor };
    if (removedBeds.length)
        out.removedBeds = removedBeds;
    else
        delete out.removedBeds;
    return out;
}
// --- season union (O56 merge arc, docs/DECISION-teams.md) ---------------------------------------
// Two devices editing ONE season used to resolve whole-record, newest stamp wins - the second sync
// silently dropped the first device's plantings into the backup ring. With planting IDENTITY
// (Planting.id, minted by putSeason) the season merges STRUCTURALLY, mirroring mergePlot's
// beds-union: plantings union by id (a planting present on either side survives), a planting edited
// on both sides keeps the newer side's copy whole (the honest floor the design doc names), and
// removed_plantings tombstones keep a deletion deleted instead of resurrected (D-092's rule, one
// level down). Canonical form: plantings sorted by id, tombstones by id - both devices converge on
// the same bytes regardless of edit order.
//
// THE LEGACY GATE: the union is only sound when every planting on BOTH sides carries an id - two
// id-less copies of the same physical planting cannot be matched, and a union would duplicate them.
// If any planting lacks an id, this returns null and the caller falls through to the exact
// whole-record rules that exist today. One save on each device (putSeason backfills ids) activates
// the union - a migration that needs no migration step.
function mergeSeasons(local, remote, localAt, remoteAt) {
    const lPl = local.plantings ?? [], rPl = remote.plantings ?? [];
    if ([...lPl, ...rPl].some((p) => !p.id))
        return null;
    // Only a PLANTING conflict is ours to union. No plantings anywhere, or the two sides' plantings
    // and tombstones already byte-equal (the difference lives in observations/notes/close state):
    // fall through to the exact whole-record rules, whose notes say what actually happened.
    if (lPl.length + rPl.length === 0)
        return null;
    const plKey = (x) => JSON.stringify([x.plantings ?? [], x.removed_plantings ?? []]);
    if (plKey(local) === plKey(remote))
        return null;
    const lAt = localAt ?? Number.NEGATIVE_INFINITY; // unstamped = oldest (D-124)
    const newer = lAt >= remoteAt ? local : remote;
    const older = lAt >= remoteAt ? remote : local;
    // newest deletion time per planting id, across both sides (ISO instants order lexicographically)
    const tombs = new Map();
    for (const t of [...(local.removed_plantings ?? []), ...(remote.removed_plantings ?? [])]) {
        const prev = tombs.get(t.id);
        if (prev === undefined || t.at > prev)
            tombs.set(t.id, t.at);
    }
    // union by id, newer side winning an id collision
    const byId = new Map();
    for (const p of newer.plantings ?? [])
        byId.set(p.id, p);
    for (const p of older.plantings ?? [])
        if (!byId.has(p.id))
            byId.set(p.id, p);
    // presence time of an id = newest record stamp among the sides still HOLDING it (ms epoch);
    // tombstone times are ISO instants, so compare in ms
    const inLocal = new Set(lPl.map((p) => p.id)), inRemote = new Set(rPl.map((p) => p.id));
    const presence = (id) => Math.max(inLocal.has(id) ? lAt : -Infinity, inRemote.has(id) ? remoteAt : -Infinity);
    const plantings = [...byId.values()]
        .filter((p) => { const del = tombs.get(p.id); return del === undefined || presence(p.id) > Date.parse(del); })
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    // keep only tombstones still winning; a re-add newer than the delete prunes its tombstone
    const kept = new Set(plantings.map((p) => p.id));
    const removed = [...tombs].filter(([id]) => !kept.has(id))
        .map(([id, at]) => ({ id, at }))
        .sort((x, y) => (x.id < y.id ? -1 : 1));
    const out = { ...older, ...newer, plantings };
    if (removed.length)
        out.removed_plantings = removed;
    else
        delete out.removed_plantings;
    if ((local.plantings ?? remote.plantings) === undefined && plantings.length === 0)
        delete out.plantings;
    return out;
}
// --- deleted gardens (O20 / D-166): the plot-level tombstone, D-092's idea one level up ---------
// A deleted garden must stay deleted across devices, and a deliberately RE-CREATED one must win.
// The marker is an ordinary record (kind "plot_tombstone", key = plot id, record {deleted_at,
// name}) so it rides the same table and pulls like anything else - but it never enters the
// generic merge loop below. This pre-pass owns it entirely, with ONE comparison at its heart:
// the newest surviving plot stamp vs the newest deletion time. Plot newer -> the re-creation
// wins and the marker is cleared everywhere. Deletion newer (or the plot unstamped, D-124's
// oldest-possible reading) -> the garden and its seasons leave both sides, the account rows are
// hard-deleted, and every device records the marker so nothing re-pushes.
const TOMB = "plot_tombstone";
function resolvePlotTombstones(local, remote, plan) {
    const lTombs = new Map(local.filter((l) => l.kind === TOMB).map((l) => [l.key, l]));
    const rTombs = new Map(remote.filter((r) => r.kind === TOMB).map((r) => [r.key, r]));
    if (!lTombs.size && !rTombs.size)
        return { local, remote };
    let lRest = local.filter((l) => l.kind !== TOMB);
    let rRest = remote.filter((r) => r.kind !== TOMB);
    for (const key of new Set([...lTombs.keys(), ...rTombs.keys()])) {
        const lt = lTombs.get(key), rt = rTombs.get(key);
        const lAt = lt ? Date.parse(lt.record.deleted_at ?? "") || (lt.updatedAt ?? 0) : Number.NEGATIVE_INFINITY;
        const rAt = rt ? Date.parse(rt.record.deleted_at ?? "") || 0 : Number.NEGATIVE_INFINITY;
        const tombAt = Math.max(lAt, rAt);
        const tombName = (lAt >= rAt ? lt?.record : rt?.record)?.name ?? key;
        const lPlot = lRest.find((l) => l.kind === "plot" && l.key === key);
        const rPlot = rRest.find((r) => r.kind === "plot" && r.key === key);
        const rSeasons = rRest.filter((r) => r.kind === "season" && r.key.startsWith(`${key}:`));
        const plotAt = Math.max(lPlot ? (lPlot.updatedAt ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY, rPlot ? Date.parse(rPlot.updated_at) : Number.NEGATIVE_INFINITY);
        if (plotAt > tombAt) {
            // The garden was deliberately edited or re-created AFTER the deletion - the re-creation
            // wins (D-092 parity: re-adds win) and the marker is cleared so it cannot keep suppressing.
            if (rt)
                plan.deleteRemote.push({ kind: TOMB, key });
            if (lt)
                plan.clearLocalTombstones.push(key);
            plan.notes.push(`garden "${tombName}": re-created after its deletion - the re-creation wins; the deletion marker is cleared.`);
            continue;
        }
        // The deletion stands. The garden and its seasons leave BOTH sides of the generic merge; the
        // account rows are removed; this device snapshots-then-deletes anything it still holds and
        // records the marker (eraseGarden handles the nothing-held case by just recording it).
        if (rPlot)
            plan.deleteRemote.push({ kind: "plot", key });
        for (const rs of rSeasons)
            plan.deleteRemote.push({ kind: "season", key: rs.key });
        plan.eraseLocal.push({ plotId: key, name: tombName, deletedAt: tombAt });
        if (lt && !rt)
            plan.push.push(lt); // the marker itself propagates to the account
        if (lt && rt)
            plan.skipped++;
        lRest = lRest.filter((l) => !(l.key === key && l.kind === "plot") && !(l.kind === "season" && l.key.startsWith(`${key}:`)));
        rRest = rRest.filter((r) => !(r.key === key && r.kind === "plot") && !(r.kind === "season" && r.key.startsWith(`${key}:`)));
        plan.notes.push(`garden "${tombName}": deleted - removed from the account and from this device (a safety copy stays on each device that held it).`);
    }
    return { local: lRest, remote: rRest };
}
/** Hard-delete rows from the account store (O20): the deleted garden's data must not linger -
 *  the per-garden half of the Privacy Policy's "deletable" promise. The existing for-all RLS
 *  policy already scopes deletes to the caller's own rows. */
export async function deleteRecords(cfg, session, items, f = fetch) {
    for (const it of items) {
        await call(f, `${cfg.url}/rest/v1/garden_records?kind=eq.${encodeURIComponent(it.kind)}&key=eq.${encodeURIComponent(it.key)}`, { method: "DELETE", headers: authHeaders(cfg, session.access_token) }, "delete");
    }
}
/** Two-way merge, one rule per case and none of them silent:
 *  - only local  → push;  only remote → pull;
 *  - identical bytes → skip;
 *  - both changed → the newer timestamp wins;
 *  - both differ but the local record has NO edit stamp (updatedAt null) → the ACCOUNT wins and
 *    is pulled (D-124). An unstamped copy has unknown age - in practice it predates sync stamping
 *    on a rarely-used device - and the old local-wins rule pushed it over the account stamped as
 *    "now", so one stale desktop login could overwrite every other device, sync reporting success
 *    the whole time (the thrice-reported desktop-vs-mobile mismatch). Records that exist ONLY
 *    locally still push regardless of stamps - local-first onboarding is untouched. */
export function planMerge(local, remote) {
    const plan = { push: [], pull: [], merged: [], skipped: 0, notes: [], deleteRemote: [], eraseLocal: [], clearLocalTombstones: [] };
    ({ local, remote } = resolvePlotTombstones(local, remote, plan));
    const remoteByK = new Map(remote.map((r) => [`${r.kind}:${r.key}`, r]));
    const localKeys = new Set(local.map((l) => `${l.kind}:${l.key}`));
    for (const l of local) {
        const r = remoteByK.get(`${l.kind}:${l.key}`);
        if (!r) {
            plan.push.push(l);
            continue;
        }
        if (sameBytes(l.record, r.record)) {
            plan.skipped++;
            continue;
        }
        const remoteAt = Date.parse(r.updated_at);
        // A plot differing on both sides is UNIONED, not overwritten (D-092): the whole-record newer-wins
        // rule below would drop the losing device's beds. Merge the beds first, then route the result -
        // if the union equals one side, that side is already complete (a plain push/pull); a genuine
        // combination becomes a `merged` record written locally AND pushed so both devices converge.
        if (l.kind === "plot") {
            const merged = mergePlot(l.record, r.record, l.updatedAt, remoteAt);
            if (sameBytes(merged, r.record)) {
                plan.pull.push(r);
                plan.notes.push(`plot ${l.key}: this device had a subset of the synced beds - took the fuller synced set.`);
            }
            else if (sameBytes(merged, l.record)) {
                plan.push.push(l);
                plan.notes.push(`plot ${l.key}: the synced copy had a subset of this device's beds - pushed the fuller set.`);
            }
            else {
                const stamp = Math.max(l.updatedAt ?? 0, remoteAt);
                plan.merged.push({ kind: "plot", key: l.key, record: merged, updatedAt: stamp });
                plan.notes.push(`plot ${l.key}: MERGED beds from both devices - kept every bed; a bed edited on both keeps the newer edit.`);
            }
            continue;
        }
        // A season differing on both sides merges STRUCTURALLY when every planting carries an id
        // (O56 merge arc) - same routing as the plot union above: equal-to-one-side is a plain
        // push/pull, a genuine combination is written locally AND pushed so both devices converge.
        if (l.kind === "season") {
            const merged = mergeSeasons(l.record, r.record, l.updatedAt, remoteAt);
            if (merged !== null) {
                if (sameBytes(merged, r.record)) {
                    plan.pull.push(r);
                    plan.notes.push(`season ${l.key}: this device had a subset of the synced plantings - took the fuller synced set.`);
                }
                else if (sameBytes(merged, l.record)) {
                    plan.push.push(l);
                    plan.notes.push(`season ${l.key}: the synced copy had a subset of this device's plantings - pushed the fuller set.`);
                }
                else {
                    const stamp = Math.max(l.updatedAt ?? 0, remoteAt);
                    plan.merged.push({ kind: "season", key: l.key, record: merged, updatedAt: stamp });
                    plan.notes.push(`season ${l.key}: MERGED plantings from both devices - kept every planting; one edited on both keeps the newer edit.`);
                }
                continue;
            }
            // a planting without an id on either side: the union cannot match copies, so the exact
            // whole-record rules below apply (today's behaviour, until both devices have saved once)
        }
        if (l.updatedAt === null) {
            plan.pull.push(r);
            plan.notes.push(`${l.kind} ${l.key}: differs, but this device's copy carries no edit stamp - took the account's synced copy (an unstamped device must not overwrite every other device; export this device's data first if you believe it was newer).`);
        }
        else if (remoteAt > l.updatedAt) {
            plan.pull.push(r);
            plan.notes.push(`${l.kind} ${l.key}: REPLACED this device's copy with the newer synced one (${r.updated_at}).`);
        }
        else {
            plan.push.push(l);
            plan.notes.push(`${l.kind} ${l.key}: pushed this device's newer copy over the synced one.`);
        }
    }
    for (const r of remote) {
        if (!localKeys.has(`${r.kind}:${r.key}`))
            plan.pull.push(r);
    }
    return plan;
}
