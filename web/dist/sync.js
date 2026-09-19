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
        catch { }
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
export async function signUp(cfg, email, password, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/signup`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email, password }),
    }, "sign up");
    const body = await res.json();
    if (!body.access_token)
        return null;
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email, userId: userIdOf(body) };
}
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
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email: session.email, userId: userIdOf(body) ?? session.userId };
}
export async function signOut(cfg, session, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/logout`, {
        method: "POST", headers: authHeaders(cfg, session.access_token),
    }, "sign out").catch(() => undefined);
}
export async function pullRecords(cfg, session, f = fetch) {
    const res = await call(f, `${cfg.url}/rest/v1/garden_records?select=kind,key,record,updated_at,user_id`, {
        headers: authHeaders(cfg, session.access_token),
    }, "pull");
    return await res.json();
}
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
export async function updateUser(cfg, session, changes, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/user`, {
        method: "PUT", headers: authHeaders(cfg, session.access_token), body: JSON.stringify(changes),
    }, "account update");
}
export async function recoverPassword(cfg, email, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/recover`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email }),
    }, "password reset");
}
export async function resendConfirmation(cfg, email, f = fetch) {
    await call(f, `${cfg.url}/auth/v1/resend`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ type: "signup", email }),
    }, "resend confirmation");
}
export async function verifyTokenHash(cfg, type, tokenHash, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/verify`, {
        method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ type, token_hash: tokenHash }),
    }, "verify link");
    const body = await res.json();
    if (!body.access_token)
        return null;
    const user = (body.user ?? {});
    return { access_token: String(body.access_token), refresh_token: String(body.refresh_token), email: String(user.email ?? "") };
}
export async function getUser(cfg, accessToken, f = fetch) {
    const res = await call(f, `${cfg.url}/auth/v1/user`, { headers: authHeaders(cfg, accessToken) }, "session check");
    const body = await res.json();
    return { email: String(body.email ?? ""), id: String(body.id ?? "") };
}
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
export async function listTeams(cfg, session, f = fetch) {
    return restGet(cfg, session, "teams?select=id,name,owner_id,owner_email,created_at&order=created_at.asc", f, "load teams");
}
export async function createTeam(cfg, session, name, f = fetch) {
    return await restWrite(cfg, session, "teams", "POST", { name }, f, "create team", true);
}
export async function renameTeam(cfg, session, id, name, f = fetch) {
    await restWrite(cfg, session, `teams?id=eq.${encodeURIComponent(id)}`, "PATCH", { name }, f, "rename team");
}
export async function deleteTeam(cfg, session, id, f = fetch) {
    await restWrite(cfg, session, `teams?id=eq.${encodeURIComponent(id)}`, "DELETE", undefined, f, "delete team");
}
export async function listMembers(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_members?team_id=eq.${encodeURIComponent(teamId)}&select=team_id,member_id,role,member_email,created_at&order=created_at.asc`, f, "load roster");
}
export async function leaveTeam(cfg, session, teamId, f = fetch) {
    const uid = session.userId ?? (await getUser(cfg, session.access_token, f)).id;
    await restWrite(cfg, session, `team_members?team_id=eq.${encodeURIComponent(teamId)}&member_id=eq.${encodeURIComponent(uid)}`, "DELETE", undefined, f, "leave team");
}
export async function mintInvite(cfg, session, teamId, email, f = fetch) {
    return await restWrite(cfg, session, "team_invites", "POST", { team_id: teamId, invited_email: email.trim().toLowerCase() }, f, "invite", true);
}
export async function listSentInvites(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_invites?team_id=eq.${encodeURIComponent(teamId)}&accepted_at=is.null&select=id,team_id,invited_email,expires_at,created_at&order=created_at.asc`, f, "load invites");
}
export async function listMyInvites(cfg, session, f = fetch) {
    return restGet(cfg, session, "team_invites?select=id,team_id,invited_email,expires_at,created_at,teams(name,owner_email)", f, "check invites");
}
export async function revokeInvite(cfg, session, inviteId, f = fetch) {
    await restWrite(cfg, session, `team_invites?id=eq.${encodeURIComponent(inviteId)}`, "DELETE", undefined, f, "revoke invite");
}
export async function acceptInvite(cfg, session, inviteId, f = fetch) {
    const res = await call(f, `${cfg.url}/rest/v1/rpc/accept_team_invite`, {
        method: "POST", headers: authHeaders(cfg, session.access_token), body: JSON.stringify({ invite_id: inviteId }),
    }, "accept invite");
    return await res.json();
}
export async function attachGarden(cfg, session, teamId, plot, f = fetch) {
    const uid = session.userId ?? (await getUser(cfg, session.access_token, f)).id;
    return await restWrite(cfg, session, "team_gardens", "POST", { team_id: teamId, owner_id: uid, plot }, f, "attach garden", true);
}
export async function detachGarden(cfg, session, teamId, ownerId, plot, f = fetch) {
    await restWrite(cfg, session, `team_gardens?team_id=eq.${encodeURIComponent(teamId)}&owner_id=eq.${encodeURIComponent(ownerId)}&plot=eq.${encodeURIComponent(plot)}`, "DELETE", undefined, f, "detach garden");
}
export async function listAttachments(cfg, session, teamId, f = fetch) {
    return restGet(cfg, session, `team_gardens?team_id=eq.${encodeURIComponent(teamId)}&select=team_id,owner_id,plot,created_at&order=created_at.asc`, f, "load attachments");
}
export function sharedLocalPlotId(ownerId, plot) {
    return `shared:${ownerId.slice(0, 8)}:${plot}`;
}
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
export function toSharedPlot(record, mark) {
    return { ...record, id: sharedLocalPlotId(mark.ownerId, record.id), owner: "account", shared: mark };
}
export function fromSharedPlot(local) {
    if (!local.shared)
        return null;
    const mark = local.shared;
    const record = { ...local, id: mark.plot };
    delete record.shared;
    return { key: mark.plot, record, ownerId: mark.ownerId };
}
export function toSharedSeason(record, ownerId) {
    return { ...record, plot: sharedLocalPlotId(ownerId, record.plot) };
}
export function fromSharedSeason(local, mark) {
    return { key: `${mark.plot}:${local.id}`, record: { ...local, plot: mark.plot }, ownerId: mark.ownerId };
}
export function toSharedPost(record, ownerId) {
    return { ...record, plot: sharedLocalPlotId(ownerId, record.plot) };
}
export function fromSharedPost(local, mark) {
    return { key: `${mark.plot}:${local.id}`, record: { ...local, plot: mark.plot }, ownerId: mark.ownerId };
}
const sameBytes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function unionBeds(newer, older) {
    const byName = new Map();
    for (const b of newer)
        byName.set(b.name, b);
    for (const b of older)
        if (!byName.has(b.name))
            byName.set(b.name, b);
    return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function mergeTombs(a, b) {
    const m = new Map();
    for (const t of [...a, ...b]) {
        const prev = m.get(t.name);
        if (prev === undefined || t.at > prev)
            m.set(t.name, t.at);
    }
    return m;
}
function mergePlot(local, remote, localAt, remoteAt) {
    const lAt = localAt ?? Number.NEGATIVE_INFINITY;
    const newer = lAt >= remoteAt ? local : remote;
    const older = lAt >= remoteAt ? remote : local;
    const tombs = mergeTombs(local.removedBeds ?? [], remote.removedBeds ?? []);
    const inLocal = new Set((local.beds ?? []).map((b) => b.name));
    const inRemote = new Set((remote.beds ?? []).map((b) => b.name));
    const presence = (name) => Math.max(inLocal.has(name) ? lAt : -Infinity, inRemote.has(name) ? remoteAt : -Infinity);
    const beds = unionBeds(newer.beds ?? [], older.beds ?? [])
        .filter((b) => { const del = tombs.get(b.name); return del === undefined || presence(b.name) > del; });
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
function mergeSeasons(local, remote, localAt, remoteAt) {
    const lPl = local.plantings ?? [], rPl = remote.plantings ?? [];
    if ([...lPl, ...rPl].some((p) => !p.id))
        return null;
    const draftsDiffer = JSON.stringify(local.next_plan ?? []) !== JSON.stringify(remote.next_plan ?? []);
    if (lPl.length + rPl.length === 0 && !draftsDiffer)
        return null;
    const plKey = (x) => JSON.stringify([x.plantings ?? [], x.removed_plantings ?? []]);
    if (plKey(local) === plKey(remote) && !draftsDiffer)
        return null;
    const lAt = localAt ?? Number.NEGATIVE_INFINITY;
    const newer = lAt >= remoteAt ? local : remote;
    const older = lAt >= remoteAt ? remote : local;
    const tombs = new Map();
    for (const t of [...(local.removed_plantings ?? []), ...(remote.removed_plantings ?? [])]) {
        const prev = tombs.get(t.id);
        if (prev === undefined || t.at > prev)
            tombs.set(t.id, t.at);
    }
    const byId = new Map();
    for (const p of newer.plantings ?? [])
        byId.set(p.id, p);
    for (const p of older.plantings ?? [])
        if (!byId.has(p.id))
            byId.set(p.id, p);
    const inLocal = new Set(lPl.map((p) => p.id)), inRemote = new Set(rPl.map((p) => p.id));
    const presence = (id) => Math.max(inLocal.has(id) ? lAt : -Infinity, inRemote.has(id) ? remoteAt : -Infinity);
    const plantings = [...byId.values()]
        .filter((p) => { const del = tombs.get(p.id); return del === undefined || presence(p.id) > Date.parse(del); })
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    const kept = new Set(plantings.map((p) => p.id));
    const removed = [...tombs].filter(([id]) => !kept.has(id))
        .map(([id, at]) => ({ id, at }))
        .sort((x, y) => (x.id < y.id ? -1 : 1));
    const out = { ...older, ...newer, plantings };
    {
        const key = (e) => `${e.year}|${e.area}`;
        const byKey = new Map();
        for (const e of (newer.next_plan ?? []))
            byKey.set(key(e), e);
        for (const e of (older.next_plan ?? []))
            if (!byKey.has(key(e)))
                byKey.set(key(e), e);
        if (byKey.size)
            out.next_plan = [...byKey.values()].sort((a, b) => key(a) < key(b) ? -1 : 1);
    }
    {
        const byArea = new Map();
        for (const e of newer.planted_from ?? [])
            byArea.set(e.area, e);
        for (const e of older.planted_from ?? [])
            if (!byArea.has(e.area))
                byArea.set(e.area, e);
        if (byArea.size)
            out.planted_from = [...byArea.values()].sort((a, b) => a.area < b.area ? -1 : 1);
    }
    if (removed.length)
        out.removed_plantings = removed;
    else
        delete out.removed_plantings;
    if ((local.plantings ?? remote.plantings) === undefined && plantings.length === 0)
        delete out.plantings;
    return out;
}
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
            if (rt)
                plan.deleteRemote.push({ kind: TOMB, key });
            if (lt)
                plan.clearLocalTombstones.push(key);
            plan.notes.push(`garden "${tombName}": re-created after its deletion - the re-creation wins; the deletion marker is cleared.`);
            continue;
        }
        if (rPlot)
            plan.deleteRemote.push({ kind: "plot", key });
        for (const rs of rSeasons)
            plan.deleteRemote.push({ kind: "season", key: rs.key });
        plan.eraseLocal.push({ plotId: key, name: tombName, deletedAt: tombAt });
        if (lt && !rt)
            plan.push.push(lt);
        if (lt && rt)
            plan.skipped++;
        lRest = lRest.filter((l) => !(l.key === key && l.kind === "plot") && !(l.kind === "season" && l.key.startsWith(`${key}:`)));
        rRest = rRest.filter((r) => !(r.key === key && r.kind === "plot") && !(r.kind === "season" && r.key.startsWith(`${key}:`)));
        plan.notes.push(`garden "${tombName}": deleted - removed from the account and from this device (a safety copy stays on each device that held it).`);
    }
    return { local: lRest, remote: rRest };
}
export async function deleteRecords(cfg, session, items, f = fetch) {
    for (const it of items) {
        await call(f, `${cfg.url}/rest/v1/garden_records?kind=eq.${encodeURIComponent(it.kind)}&key=eq.${encodeURIComponent(it.key)}`, { method: "DELETE", headers: authHeaders(cfg, session.access_token) }, "delete");
    }
}
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
