// Account page (Phase 4 / D-020, product shape D-023) - DOM layer. Owns backend config + the
// auth session (localStorage) and orchestrates sync: gather local records → pull → planMerge →
// apply pulls → push → report every action. Local-first: signed out, Plan still works fully;
// the ledger surfaces (Calendar/Log) gate on the auth state exported from here.
//
// The app ships a DEFAULT backend (web/backend.json - the standard project, D-023) so users
// just sign up with email + password. The paste-your-own backend option was removed with its
// fieldset (O19, maintainer 2026-07-30) - the app speaks only to the standard backend.
import { deleteAccount, deleteRecords, fromSharedPlot, fromSharedPost, fromSharedSeason, getUser, partitionRemote, planMerge, pullRecords, pushRecords, recoverPassword, refreshSession, signIn, signOut, signUp, toSharedPlot, toSharedPost, toSharedSeason, updateUser } from "./sync.js";
import { deletePlot, deletePlotTombstone, deletePost, deleteSeason, eraseGarden, getPlot, listPlots, listPlotTombstones, listPosts, listSeasons, listSeeds, listSyncMeta, listUserSpecies, putPlotFromSync, putPostFromSync, putSeasonFromSync, putSeedFromSync, putUserSpeciesFromSync, rekeyPlot, setOnLocalWrite } from "./storage.js";
import { app } from "./state.js";
import { copy } from "./copy.js";
import { countRung } from "./analytics.js";
import { toast } from "./notices.js";
import { prefRecord } from "./units.js";
import { initTeams } from "./teams.js";
const SES_KEY = "gg-sync-session";
const $ = (id) => document.getElementById(id);
function loadJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function saveJson(key, v) {
    try {
        if (v === null)
            localStorage.removeItem(key);
        else
            localStorage.setItem(key, JSON.stringify(v));
    }
    catch { /* storage off - session-only */ }
}
// --- auth state, exported for the D-023 gate ----------------------------------------
let signedInState = loadJson(SES_KEY) !== null;
let emailState = loadJson(SES_KEY)?.email ?? null;
let backendState = false;
const authListeners = [];
export const isSignedIn = () => signedInState;
/** The signed-in address, for the surfaces that must NAME what is held (O28's inventory). Null
 *  signed out - there is nothing to name. Mirrored module-level beside signedInState because the
 *  live session is scoped inside initAccount; status() keeps both in step. */
export const signedInEmail = () => emailState;
export const backendConfigured = () => backendState;
export function onAuthChange(cb) {
    authListeners.push(cb);
}
function fireAuth() {
    for (const cb of authListeners)
        cb();
}
// --- recovery links -------------------------------------------------------------------
// Supabase recovery emails land at the site with #access_token=…&type=recovery - the SAME
// hash the router owns. captureAuthHash() runs BEFORE the router so the tokens aren't lost
// to a #/plan redirect; initAccount() then turns them into a session and prompts for the
// new password.
let capturedAuth = null;
export function captureAuthHash() {
    if (!location.hash.includes("access_token="))
        return;
    const params = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (access && refresh) {
        capturedAuth = { access_token: access, refresh_token: refresh, type: params.get("type") ?? "" };
    }
    // Strip the tokens from the URL AND from history (D-122, security review H1): assigning
    // location.hash left the token-bearing URL one Back tap away (and in synced browser history).
    history.replaceState(null, "", location.pathname + location.search + "#/account");
}
// --------------------------------------------------------------------------------------
export function initAccount(db, onPulled) {
    // O19 (maintainer, 2026-07-30): the custom-backend path is gone with its fieldset - the app
    // speaks only to the standard backend (backend.json). A stored gg-sync-config from the old
    // advanced option is deliberately ignored rather than honoured invisibly.
    let defaultCfg = null;
    let session = loadJson(SES_KEY);
    const eff = () => defaultCfg;
    // O16 / D-153 on the Account page: report() DOCKS - errors, sync failures, and every line the
    // user must act on (confirm an email, open a recovery link, "export anything you want to keep").
    // Pure confirmations FLOAT via toast() instead, and several of them had to: sign-in and sign-up
    // call app.onSignIn(), which navigates to #/plan, so a docked "signed in as ..." was written to
    // a page the user had already left and was never seen at all.
    const report = (lines) => {
        const box = $("syncreport");
        box.innerHTML = "";
        for (const line of lines) {
            const p = document.createElement("p");
            p.className = "hint";
            p.textContent = line;
            box.appendChild(p);
        }
    };
    const status = () => {
        backendState = eff() !== null;
        signedInState = session !== null;
        emailState = session?.email ?? null;
        $("acctstatus").textContent = !eff()
            ? "Accounts aren't live yet (no backend configured) - everything works on this device, and your data will carry into your account when they are."
            : session
                ? `Signed in as ${session.email}. Your addresses, areas, and seasons sync to your account; the plant knowledge is a public file and never leaves this device's bundle.`
                : "Sign in (or create an account) to keep your ledger and use it on any device.";
        // The promise band's body follows the auth state (maintainer, 2026-08-16): a signed-in gardener
        // is not told to "sign in". The heading holds in both; only the body swaps. data-copy set the
        // signed-out default at boot; this overrides on every auth change (applyCopy does not re-run).
        const promiseBody = document.getElementById("acctpromisebody");
        if (promiseBody)
            promiseBody.textContent = session ? copy.accountPromiseBodyIn : copy.accountPromiseBody;
        $("acctsignedout").hidden = !!session;
        $("acctsignedin").hidden = !session;
        if (session)
            $("acctwho").textContent = session.email;
        const chip = $("authchip");
        chip.textContent = session ? `● ${session.email}` : "sign in";
        chip.className = session ? "authchip on" : "authchip";
        chip.title = session ? `signed in as ${session.email} - tap for account` : "tap to sign in";
        fireAuth();
        app.refreshDraftBanner?.(); // the D-152 keep-or-discard ask appears/hides with the session
        app.refreshEditEntry?.(true); // the edit entry follows the ACCOUNT - re-probe on auth change
    };
    const setSession = (s) => {
        session = s;
        saveJson(SES_KEY, s);
        status();
    };
    // Every local record with its stamp, in the shape the merge planner eats. Seasons are
    // keyed per plot (D-023): one address, one ledger.
    const gatherLocal = async () => {
        const metaByKey = new Map((await listSyncMeta(db)).map((m) => [m.key, m.updatedAt]));
        // What syncs is the ACCOUNT workspace and nothing else. D-029: the disposable example garden
        // never pollutes a signed-in account. D-152: drafts (made signed out) never sync either -
        // they reach the account only through the explicit adoption flow, which re-homes them into
        // the account workspace first. Seasons follow their plot: only a synced plot's ledger ships,
        // which also stops orphaned seasons (their plot long deleted) from pushing forever.
        // D-172: a SHARED garden (owner is another account) never rides the member's OWN push - its
        // records belong to the owner's account and sync through the separate shared pass below. Excluding
        // it here is the load-bearing safety: without it, gatherLocal would duplicate someone else's
        // garden into the editing member's account.
        const plots = (await listPlots(db)).filter((p) => !p.example && !p.shared); // signed in → own account plots
        const plotIds = new Set(plots.map((p) => p.id));
        const seasons = (await listSeasons(db)).filter((s) => plotIds.has(s.plot));
        const posts = (await listPosts(db)).filter((p) => plotIds.has(p.plot)); // own gardens' posts (D-172)
        const userSpecies = await listUserSpecies(db);
        const seeds = await listSeeds(db); // O111b: the seed box rides the account like user_species
        return [
            ...seasons.map((s) => ({
                kind: "season", key: `${s.plot}:${s.id}`, record: s,
                updatedAt: metaByKey.get(`season:${s.plot}:${s.id}`) ?? null,
            })),
            ...posts.map((p) => ({
                kind: "post", key: `${p.plot}:${p.id}`, record: p,
                updatedAt: metaByKey.get(`post:${p.plot}:${p.id}`) ?? null,
            })),
            ...plots.map((p) => ({
                kind: "plot", key: p.id, record: p,
                updatedAt: metaByKey.get(`plot:${p.id}`) ?? null,
            })),
            ...userSpecies.map((u) => ({
                kind: "user_species", key: u.id, record: u,
                updatedAt: metaByKey.get(`user_species:${u.id}`) ?? null,
            })),
            ...seeds.map((s) => ({
                kind: "seed", key: s.id, record: s,
                updatedAt: metaByKey.get(`seed:${s.id}`) ?? null,
            })),
            // O20 / D-166: deletion markers ride the same table; their stamp IS the deletion time.
            ...(await listPlotTombstones(db)).map((t) => ({
                kind: "plot_tombstone", key: t.id,
                record: { deleted_at: new Date(t.deletedAt).toISOString(), name: t.name },
                updatedAt: t.deletedAt,
            })),
            // Display prefs (units/temp) as one "pref" row - but ONLY once deliberately changed on this
            // device (stamp non-null). A never-touched default must NOT push over the account's choice on a
            // fresh sign-in; with no local row, the account's pref simply pulls in.
            ...(() => {
                const pr = prefRecord();
                return pr.updatedAt != null ? [{ kind: "pref", key: "display", record: pr.record, updatedAt: pr.updatedAt }] : [];
            })(),
        ];
    };
    // D-172: sync the gardens shared with this member through a team. Kept a SEPARATE pass from the own
    // merge because a shared garden's rows live under the OWNER's user_id: they must never be adopted as
    // the member's own, and the member's edits push back to the owner's account, not theirs. The merge
    // logic itself is REUSED (planMerge, one owner at a time - keys are unique within one owner), so the
    // beds-union and season-union already built apply here unchanged. The wire<->local transforms
    // (namespaced id) are the pure, unit-tested sync.ts helpers.
    const syncShared = async (sharedByOwner) => {
        const cfg = eff();
        const notes = [];
        let applied = 0;
        if (!cfg || !session)
            return { applied, notes };
        const localShared = (await listPlots(db, "all")).filter((p) => p.shared);
        const metaByKey = new Map((await listSyncMeta(db)).map((m) => [m.key, m.updatedAt]));
        // (1) Revoked/detached: a local shared garden whose owner returned NO plot row this pull is no
        // longer shared - remove the local copy and its seasons (it is not ours to tombstone on the owner).
        for (const lp of localShared) {
            const mark = lp.shared;
            const stillShared = (sharedByOwner.get(mark.ownerId) ?? []).some((r) => r.kind === "plot" && r.key === mark.plot);
            if (!stillShared) {
                for (const s of await listSeasons(db, lp.id))
                    await deleteSeason(db, lp.id, s.id);
                for (const po of await listPosts(db, lp.id))
                    await deletePost(db, lp.id, po.id);
                await deletePlot(db, lp.id);
                applied++;
                notes.push(`the shared garden "${lp.name ?? mark.plot}" is no longer shared with you - removed from this device.`);
            }
        }
        // (2) Per owner, merge the shared rows exactly like own rows, then route the result: apply pulls
        // under the namespaced id, push local-newer + merged back UNDER THE OWNER.
        for (const [owner, rows] of sharedByOwner) {
            const localRecs = [];
            for (const lp of localShared.filter((p) => p.shared.ownerId === owner)) {
                const wire = fromSharedPlot(lp);
                if (!wire)
                    continue;
                localRecs.push({ kind: "plot", key: wire.key, record: wire.record, updatedAt: metaByKey.get(`plot:${lp.id}`) ?? null, ownerId: owner });
                for (const s of await listSeasons(db, lp.id)) {
                    const ws = fromSharedSeason(s, lp.shared);
                    localRecs.push({ kind: "season", key: ws.key, record: ws.record, updatedAt: metaByKey.get(`season:${lp.id}:${s.id}`) ?? null, ownerId: owner });
                }
                for (const po of await listPosts(db, lp.id)) {
                    const wp = fromSharedPost(po, lp.shared);
                    localRecs.push({ kind: "post", key: wp.key, record: wp.record, updatedAt: metaByKey.get(`post:${lp.id}:${po.id}`) ?? null, ownerId: owner });
                }
            }
            const plan = planMerge(localRecs, rows);
            const applyOne = async (kind, record, at) => {
                if (kind === "plot")
                    await putPlotFromSync(db, toSharedPlot(record, { ownerId: owner, plot: record.id }), at);
                else if (kind === "season")
                    await putSeasonFromSync(db, toSharedSeason(record, owner), at);
                else if (kind === "post")
                    await putPostFromSync(db, toSharedPost(record, owner), at);
                // user_species referenced by a shared season ride READ-ONLY and render from the owner's own
                // sync; the member never stores or edits another account's varieties (D-172).
            };
            for (const r of plan.pull) {
                try {
                    await applyOne(r.kind, r.record, Date.parse(r.updated_at));
                    applied++;
                }
                catch (e) {
                    notes.push(`refused to apply shared ${r.kind}: ${e instanceof Error ? e.message : e}`);
                }
            }
            for (const m of plan.merged) {
                try {
                    await applyOne(m.kind, m.record, m.updatedAt ?? Date.now());
                    applied++;
                }
                catch (e) {
                    notes.push(`refused to merge shared ${m.kind}: ${e instanceof Error ? e.message : e}`);
                }
            }
            const toPush = [...plan.push, ...plan.merged.map((m) => ({ ...m, ownerId: owner }))];
            if (toPush.length) {
                const res = await pushRecords(cfg, session, toPush);
                for (const fl of res.failures)
                    notes.push(`couldn't sync a shared ${fl.kind} to its owner: ${fl.error}`);
            }
        }
        return { applied, notes };
    };
    // Set when initTeams returns (below); lets a completed shared pull re-render the Teams section
    // so a just-arrived garden's NAME replaces its wire id without a page revisit.
    let teamsUi = null;
    let lastSyncAt = 0; // ms epoch of the last completed runSync - throttles the foreground pull
    // Persistent per-device sync status (D-124): every completed sync records WHAT happened on THIS
    // device (when, counts, and the merge planner's notes - which name every replacement), and the
    // Account page always shows the latest. Before this, an auto-sync's report vanished unless you
    // were watching #syncreport at that moment - so "is this device actually syncing, and what did
    // the last sync change?" was unanswerable, which is why the cross-device mismatch kept being a
    // guessing game. Device-local by design (it describes this device).
    const LAST_SYNC_KEY = "gg-sync-last";
    // O19 (maintainer, 2026-07-30): the sync-status block and the replaced-copies restore list are
    // GONE from the page - sync is automatic and the lengthy list confused more than it saved. What
    // remains of each: the D-125 storage safety net still records every replaced copy (invisible,
    // recoverable by a future flow or support), and ONE quiet last-synced line rides inside the
    // signed-in card - the single piece of sync a user genuinely wonders about. A relative time,
    // computed at render (no ticking timer): "did my stuff save?" needs no seconds precision.
    const renderLastSync = () => {
        const line = document.getElementById("lastsync");
        if (!line)
            return;
        const last = loadJson(LAST_SYNC_KEY);
        line.hidden = !last || !session;
        if (!last || !session)
            return;
        const mins = Math.max(0, Math.round((Date.now() - last.at) / 60000));
        const when = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago`
            : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago` : new Date(last.at).toLocaleDateString();
        const behind = last.notes.some((n) => /couldn't push/.test(n))
            ? " - some changes are still on this device and retry on your next change or sign-in"
            : "";
        line.textContent = `Last synced ${when}${behind}.`;
    };
    const runSync = async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        let remote;
        try {
            remote = await pullRecords(cfg, session);
        }
        catch {
            // one silent refresh attempt on an expired token, then give up loudly
            try {
                session = await refreshSession(cfg, session);
            }
            catch (re) {
                // The refresh itself was REJECTED (revoked/rotated refresh token - not a network drop):
                // this stored session is dead. Before D-122 the device kept LOOKING signed in while every
                // sync silently failed - the report landed on the hidden Account page - so it could show
                // stale data for weeks ("desktop doesn't match mobile"). Honest state instead: drop the
                // dead session so the gate + nav visibly flip to signed-out; one fresh sign-in resumes
                // sync. Local data is untouched (local-first). A TRANSIENT failure is NOT a dead session -
                // it rethrows and the next trigger retries: a network drop ("could not reach the backend")
                // or a backend 5xx/429 ("temporarily unavailable", security review - a Supabase outage or a
                // paused free-tier project must not sign the whole fleet out).
                const msg = re instanceof Error ? re.message : String(re);
                if (msg.includes("could not reach the backend") || msg.includes("temporarily unavailable"))
                    throw re;
                setSession(null);
                throw new Error("your sign-in expired on this device - sign in again to resume sync (everything local is safe).");
            }
            saveJson(SES_KEY, session);
            remote = await pullRecords(cfg, session);
        }
        // D-029: the disposable example garden must never round-trip through an account. gatherLocal already
        // keeps it out of the PUSH; this keeps it out of the PULL too. A demo that reached the backend from an
        // OLDER build (before the push filter existed) would otherwise re-hydrate on every load and re-pin the
        // "example garden" banner - the "banner won't go away" report. Drop example-flagged plots and any
        // season belonging to one (by the flagged plot ids, plus the known example id for orphaned seasons).
        const remoteExampleIds = new Set(remote.filter((r) => r.kind === "plot" && r.record.example).map((r) => r.key));
        remoteExampleIds.add("plot_example"); // EXAMPLE_PLOT_ID, inlined to avoid an example.ts import cycle
        remote = remote.filter((r) => {
            if (r.kind === "plot")
                return !remoteExampleIds.has(r.key);
            if (r.kind === "season")
                return !remoteExampleIds.has(r.record.plot ?? r.key.split(":")[0]);
            return true;
        });
        // D-172: split the caller's OWN rows from gardens shared through a team. Own rows flow through the
        // existing merge below; SHARED rows sync in their own pass (syncShared) - namespaced locally so
        // they can never be adopted as the caller's own or overwrite the caller's plot_home, and pushed
        // back UNDER THE OWNER. A row with no user_id (legacy, pre-D-172 projection) is treated as own.
        const { own, sharedByOwner } = partitionRemote(remote, session.userId);
        remote = own;
        // Ground-identity guard (redesign round 3, maintainer report): two DEVICES signed into the
        // same account can hold the same plot id on entirely different ground (one of them ran a
        // deliberate garden move, or predates D-152's id separation). Merging them would let the
        // fresher stamp drag the account garden's ANCHOR (and its map) to the other place - but an
        // anchor is identity, set once, never moved by a merge (storage.ts). If a local plot and the
        // account's plot of the SAME id both carry anchors more than ~250 m apart, they are different
        // gardens: re-key the local one (its seasons and soil records travel too - rekeyPlot) as its
        // own "(this device)" garden BEFORE the merge plans, so the account plot keeps its own ground
        // and nothing local is lost. Two gardens the user can reconcile beats a silent ground-shift.
        // (Signed-OUT drafts no longer reach this path at all: gatherLocal and this loop both read
        // the account workspace only, and a draft still holding an account id moves aside in
        // putPlotFromSync - D-152.)
        const splitNotes = [];
        {
            const remotePlots = new Map(remote.filter((r) => r.kind === "plot").map((r) => [r.key, r.record]));
            for (const lp of await listPlots(db)) {
                const rp = remotePlots.get(lp.id);
                if (!rp?.anchor || !lp.anchor)
                    continue;
                const dLat = lp.anchor.lat - rp.anchor.lat;
                const dLon = (lp.anchor.lon - rp.anchor.lon) * Math.cos((rp.anchor.lat * Math.PI) / 180);
                const meters = Math.hypot(dLat, dLon) * 111_000;
                if (meters < 250)
                    continue;
                let newId = `${lp.id}_device`;
                for (let n = 2; (await getPlot(db, newId)) || remotePlots.has(newId); n++)
                    newId = `${lp.id}_device_${n}`;
                const moved = await rekeyPlot(db, lp.id, newId, { name: `${lp.name ?? "Garden"} (this device)` });
                console.info(`sync: split local plot ${lp.id} -> ${newId} (anchors ${Math.round(meters)} m apart)`);
                splitNotes.push(`this device's "${lp.name ?? lp.id}" sat on different ground than your account's garden - kept it separately as "${moved.name}".`);
            }
        }
        const plan = planMerge(await gatherLocal(), remote);
        const lines = [...splitNotes];
        // O20 / D-166 - deleted gardens, before anything else applies:
        //  eraseLocal: snapshot-then-delete what this device still holds and record the marker (the
        //  storage call is a no-op-plus-marker when nothing is held); deleteRemote: the account rows
        //  go (plot, seasons, or a beaten marker); clearLocalTombstones: a re-creation won.
        let erased = 0;
        for (const e of plan.eraseLocal) {
            try {
                const had = await getPlot(db, e.plotId); // marker-only applications stay quiet
                await eraseGarden(db, e.plotId, { tombstone: true, name: e.name, deletedAt: e.deletedAt });
                if (had) {
                    erased++;
                    lines.push(`deleted the garden "${e.name}" on this device too - it was deleted from your account; a safety copy stays on this device.`);
                }
            }
            catch (err) {
                lines.push(`couldn't apply the deletion of "${e.name}": ${err instanceof Error ? err.message : err}`);
            }
        }
        if (plan.deleteRemote.length)
            await deleteRecords(cfg, session, plan.deleteRemote);
        for (const id of plan.clearLocalTombstones)
            await deletePlotTombstone(db, id);
        let applied = 0;
        let postsPulled = false;
        for (const r of plan.pull) {
            try {
                const at = Date.parse(r.updated_at);
                if (r.kind === "post")
                    postsPulled = true; // O64d: a teammate's post arrived - drop the home's cache
                if (r.kind === "season")
                    await putSeasonFromSync(db, r.record, at);
                else if (r.kind === "plot")
                    await putPlotFromSync(db, r.record, at);
                else if (r.kind === "post")
                    await putPostFromSync(db, r.record, at);
                else if (r.kind === "user_species")
                    await putUserSpeciesFromSync(db, r.record, at);
                else if (r.kind === "seed")
                    await putSeedFromSync(db, r.record, at);
                else if (r.kind === "pref") {
                    // Display prefs aren't in IndexedDB - app.ts owns the live apply (input conversion +
                    // redraw) and stamps this device with the remote's timestamp so the next merge is a no-op.
                    app.applyPrefs?.(r.record, at);
                }
                else {
                    lines.push(`skipped unknown record kind "${r.kind}" (a newer app version wrote it?)`);
                    continue;
                }
                applied++;
            }
            catch (e) {
                lines.push(`refused to apply ${r.kind} ${r.key}: ${e instanceof Error ? e.message : e}`);
            }
        }
        // Beds-union merges (D-092): a plot reconciled from BOTH devices is written locally with the merge
        // stamp AND pushed, so this device and the server hold the same combined bed set. Same stamp on both
        // sides → the next sync sees identical bytes and skips, so it converges instead of ping-ponging.
        let mergedApplied = 0;
        for (const m of plan.merged) {
            try {
                // O56 merge arc: seasons join plots as structurally-merged records; route by kind.
                if (m.kind === "season")
                    await putSeasonFromSync(db, m.record, m.updatedAt ?? Date.now());
                else
                    await putPlotFromSync(db, m.record, m.updatedAt ?? Date.now());
                mergedApplied++;
            }
            catch (e) {
                lines.push(`refused to merge ${m.kind} ${m.key}: ${e instanceof Error ? e.message : e}`);
            }
        }
        const pushRes = await pushRecords(cfg, session, [...plan.push, ...plan.merged]);
        // Counts + per-record notes go to the console (redesign round 3, maintainer: the running
        // report wasn't useful to most users); the user-facing lines stay plain.
        console.info(`sync: ${pushRes.pushed} pushed, ${applied} pulled, ${mergedApplied} merged, ${plan.skipped} already identical.`, plan.notes);
        // A partial push failure no longer aborts the whole sync (D-020 follow-up): the kinds that DID
        // push are saved, and the failure is named (console) - the page gets one gentle sentence.
        // A schema-vintage hint stays in the console: a backend created before a newer record kind
        // (user_species, pref) rejects it via garden_records_kind_check until the ACCOUNTS-SETUP.md
        // schema is re-run.
        for (const fl of pushRes.failures) {
            console.warn(`sync: couldn't push ${fl.count} ${fl.kind} record${fl.count === 1 ? "" : "s"}: ${fl.error}`
                + " - if this names garden_records_kind_check, the backend predates this record kind; re-run the schema in docs/ACCOUNTS-SETUP.md.");
        }
        if (pushRes.failures.length) {
            lines.push("some changes couldn't sync - they stay safe on this device and will retry.");
        }
        // D-172: the shared-garden pass, after the own merge. Its own failures are gentle console/report
        // lines; a shared apply feeds the same redraw so a teammate's edit lands without a manual sync.
        const shared = await syncShared(sharedByOwner);
        for (const n of shared.notes)
            console.info(`sync (shared): ${n}`);
        if (shared.applied)
            void teamsUi?.refresh(); // a shared garden arrived/left - re-name the attach list
        if (postsPulled)
            app.invalidateHomePosts?.(); // O64d: BEFORE the redraw, so the home refetches the new posts
        if (applied || mergedApplied || erased || shared.applied)
            onPulled(); // redraw the ledger surfaces; the refresh's self-heal guard re-lands the view if the ACTIVE garden was erased
        lastSyncAt = Date.now();
        saveJson(LAST_SYNC_KEY, {
            at: lastSyncAt, pushed: pushRes.pushed, pulled: applied, merged: mergedApplied,
            skipped: plan.skipped,
            notes: [...plan.notes, ...pushRes.failures.map((fl) => `couldn't push ${fl.count} ${fl.kind}: ${fl.error}`)].slice(0, 6),
        });
        renderLastSync();
        return lines;
    };
    // Auto-sync after edits (walkthrough): before, local edits reached the server only on the NEXT
    // login's sync - so anything done in a session and not synced before the local store was cleared or
    // replaced was LOST on a fresh login (the server's older copy repopulated). Now every local edit
    // (storage.stamp → onLocalWrite) schedules a debounced push: a few seconds after the last change,
    // runSync quietly pushes it. A best-effort flush on page-hide covers a fast close. Signed-out edits
    // stay local and sync on the next sign-in, exactly as before.
    const AUTO_SYNC_MS = 2500;
    let autoTimer = null;
    const quietSync = async () => {
        if (!eff() || !session)
            return;
        try {
            const lines = await runSync();
            // Stay silent on success (auto-sync shouldn't nag), but surface a real failure so the user knows
            // an edit hasn't reached the server - the next edit or a manual "sync now" retries.
            const failed = lines.find((l) => /couldn't sync|^auto-sync failed/.test(l));
            if (failed)
                report([failed, "auto-sync will retry on your next change or sign-in."]);
        }
        catch (e) {
            report([`auto-sync failed: ${e instanceof Error ? e.message : e}`, "it will retry on your next change or sign-in."]);
        }
    };
    const scheduleSync = () => {
        if (!eff() || !session)
            return; // no backend / signed out - nothing to push
        if (autoTimer != null)
            clearTimeout(autoTimer);
        autoTimer = window.setTimeout(() => { autoTimer = null; void quietSync(); }, AUTO_SYNC_MS);
    };
    const flushSync = () => {
        if (autoTimer == null)
            return;
        clearTimeout(autoTimer);
        autoTimer = null;
        void quietSync(); // best-effort - a page being torn down may not finish the request, but the
        // in-session debounce above has usually already pushed the edit
    };
    setOnLocalWrite(scheduleSync);
    // A locally-changed display pref (app.ts's Preferences controls) debounce-pushes like any edit.
    app.pushPrefs = scheduleSync;
    window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden")
        flushSync(); });
    window.addEventListener("pagehide", flushSync);
    // PULL when the app comes back to the FOREGROUND (D-122). Sync used to run only on sign-in, on a
    // local edit (debounced push), or by hand - so a device that STAYED signed in never pulled: a
    // desktop reopened days later, or a phone PWA resumed from the background, kept showing whatever
    // it pulled last ("desktop doesn't match mobile", reported three times - D-092 and D-106 fixed the
    // merge and the start experience, but no trigger ever fetched the other device's pushes). Throttled
    // so tab-flipping doesn't hammer the backend; errors stay quiet here (the boot sync reports).
    const FOREGROUND_PULL_MIN_MS = 60_000;
    window.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible")
            return;
        if (!eff() || !session)
            return;
        if (Date.now() - lastSyncAt < FOREGROUND_PULL_MIN_MS)
            return;
        void quietSync();
    });
    // Every account action shows a busy state on its button and lands its result right where
    // the user is looking - silence was the confusing part (maintainer feedback, 2026-07-12).
    const run = (btn, fn) => {
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = "working…";
        fn().then(report).catch((e) => report([`${e instanceof Error ? e.message : e}`]))
            .finally(() => {
            btn.disabled = false;
            btn.textContent = label;
        });
    };
    const act = (id, fn) => {
        $(id).addEventListener("click", () => run($(id), fn));
    };
    const creds = () => {
        const cfg = eff();
        if (!cfg)
            throw new Error("accounts aren't live yet - no backend is configured");
        const email = $("acctemail").value.trim();
        const pass = $("acctpass").value;
        if (!email || !pass)
            throw new Error("email and password are both needed");
        return [cfg, email, pass];
    };
    act("acctsignup", async () => {
        const [c, email, pass] = creds();
        const s = await signUp(c, email, pass);
        if (!s)
            return [`account created for ${email} - confirm the email the backend just sent, then sign in.`];
        setSession(s);
        countRung("account-made"); // O29: counted on a session that really came back, not on submit
        toast(`Account created - signed in as ${email}`);
        const lines = await runSync();
        try {
            await app.onSignIn?.();
        }
        catch { /* landing in the garden is best-effort */ }
        return lines;
    });
    $("signinform").addEventListener("submit", (ev) => {
        ev.preventDefault();
        run($("acctsignin"), async () => {
            const [c, email, pass] = creds();
            setSession(await signIn(c, email, pass));
            toast(`Signed in as ${email} - Calendar and Log are open`);
            const lines = await runSync();
            try {
                await app.onSignIn?.();
            }
            catch { /* landing in the garden is best-effort */ }
            return lines;
        });
    });
    act("pwforgot", async () => {
        const cfg = eff();
        if (!cfg)
            throw new Error("accounts aren't live yet - no backend is configured");
        const email = $("acctemail").value.trim();
        if (!email)
            throw new Error("enter your email above first");
        await recoverPassword(cfg, email);
        return [`if ${email} has an account, a recovery link is on its way - open it on this device and you'll be prompted for a new password.`];
    });
    act("passchange", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        const pw = $("newpass").value;
        if (pw.length < 8)
            throw new Error("use at least 8 characters");
        await updateUser(cfg, session, { password: pw });
        $("newpass").value = "";
        toast("Password changed");
        return [];
    });
    act("emailchange", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        const email = $("newemail").value.trim();
        if (!email)
            throw new Error("enter the new email first");
        await updateUser(cfg, session, { email });
        $("newemail").value = "";
        return [`confirmation sent to ${email} - the change takes effect once you confirm it there.`];
    });
    act("acctsignout", async () => {
        const cfg = eff();
        // D-152: sign-out HIDES this device's account view, so an edit still waiting in the auto-sync
        // debounce must reach the account first - flush with one final sync. A failure doesn't block
        // signing out: the edit stays stamped locally and pushes on the next sign-in.
        if (cfg && session) {
            if (autoTimer != null) {
                clearTimeout(autoTimer);
                autoTimer = null;
            }
            try {
                await runSync();
            }
            catch { /* offline sign-out - the stamped edit pushes next sign-in */ }
        }
        if (cfg && session)
            await signOut(cfg, session);
        setSession(null);
        // Mirror of sign-in: back to the DRAFT workspace (D-152) so the signed-out app never shows
        // the last user's beds + address. Account data stays cached on the device, hidden, for the
        // next sign-in; nothing is wiped.
        try {
            await app.onSignOut?.();
        }
        catch { /* view reset is best-effort */ }
        toast("Signed out - your account's gardens are hidden on this device until you sign back in");
        return [];
    });
    act("acctdelete", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        if ($("delconfirm").value !== "delete my account") {
            throw new Error('type "delete my account" in the confirmation box to proceed');
        }
        await deleteAccount(cfg, session);
        setSession(null);
        $("delconfirm").value = "";
        return ["account and every synced record deleted from the backend. This device's local data is untouched - export anything you want to keep."];
    });
    // Teams (D-172): its own DOM module, fed live getters for the config + session both scoped in
    // here. It re-fetches on every auth flip (onAuthChange) and once at boot. listOwnGardens lets the
    // owner pick one of THEIR gardens to attach - never a shared one (a member cannot re-share);
    // listSharedGardens names another owner's attachment by its real garden name once the copy lands.
    teamsUi = initTeams({
        cfg: eff, session: () => session, onAuthChange,
        listOwnGardens: async () => (await listPlots(db))
            .filter((p) => !p.example && !p.shared)
            .map((p) => ({ id: p.id, name: p.name ?? p.id })),
        listSharedGardens: async () => (await listPlots(db, "all"))
            .filter((p) => p.shared)
            .map((p) => ({ ownerId: p.shared.ownerId, plot: p.shared.plot, name: p.name ?? p.shared.plot })),
        onSharedChange: () => void quietSync(), // an attach/detach changes what this device may pull
    });
    status();
    renderLastSync(); // the last completed sync's record survives reloads
    // Async bootstrap: the default backend ships as a static file beside the app; a recovery
    // link (captured before the router ran) becomes a session once a config exists.
    void (async () => {
        try {
            const res = await fetch("./backend.json");
            if (res.ok) {
                const body = await res.json();
                if (body.url && body.anonKey)
                    defaultCfg = { url: body.url.replace(/\/+$/, ""), anonKey: body.anonKey };
            }
        }
        catch { /* no default backend - advanced config or local-only */ }
        // when the standard backend is live, the advanced fieldset collapses out of the way
        const cfg = eff();
        let landAfterBootSync = false; // D-152: a link that MADE the session lands in the garden below
        // The link's greeting is a line the user must ACT on ("set a new password NOW"), and the boot
        // sync's report used to REPLACE it moments after it appeared - the same
        // actionable-message-hidden-on-a-timer shape the messaging split (D-153/O16) exists to stop.
        // Found by e2e scenario 44 sampling the settled page. The greeting now rides ABOVE the sync
        // lines instead of being erased by them.
        let bootGreeting = [];
        if (capturedAuth && cfg) {
            try {
                const who = await getUser(cfg, capturedAuth.access_token);
                // A link's fragment is ATTACKER-SUPPLIABLE (D-122, security review H1): anyone can send a
                // URL whose hash carries valid tokens for an account THEY control; silently adopting it
                // would route everything this user then syncs into that account (login CSRF). So: never
                // replace a different signed-in session, and never adopt a session for a signed-out user
                // without them confirming the named email - the one thing the attacker cannot fake.
                if (session && session.email !== who.email) {
                    report([`ignored a sign-in link for ${who.email} - you're already signed in as ${session.email}. Sign out first if you really meant to switch accounts.`]);
                }
                else if (session || window.confirm(`Sign in as ${who.email}?\n\nContinue only if you just followed a link from YOUR OWN email (password recovery or signup confirmation).`)) {
                    const hadSession = session !== null;
                    setSession({ access_token: capturedAuth.access_token, refresh_token: capturedAuth.refresh_token, email: who.email });
                    // the link type decides the greeting: a recovery link means "set a new password NOW";
                    // a signup confirmation just means welcome - telling a new user to reset would confuse
                    bootGreeting = capturedAuth.type === "recovery"
                        ? ["recovery link verified - set a new password in \"My account\" below, right now."]
                        : [`email confirmed - you're signed in as ${who.email}. Welcome.`];
                    report(bootGreeting);
                    // D-152: the confirmation link is many users' FIRST sign-in (email confirmation on),
                    // and it used to be the one door that never landed in the garden. A recovery link
                    // stays on this page - the new password comes first.
                    landAfterBootSync = !hadSession && capturedAuth.type !== "recovery";
                }
                else {
                    report(["sign-in link ignored - nothing changed."]);
                }
            }
            catch (e) {
                report([`the link didn't verify: ${e instanceof Error ? e.message : e}`]);
            }
            capturedAuth = null;
        }
        status();
        if (cfg && session) {
            try {
                report([...bootGreeting, ...(await runSync())]);
            }
            catch (e) {
                report([...bootGreeting, `auto-sync failed: ${e instanceof Error ? e.message : e}`]);
            }
            if (landAfterBootSync) {
                try {
                    await app.onSignIn?.();
                }
                catch { /* landing in the garden is best-effort */ }
            }
        }
    })();
}
