import { deleteAccount, deleteRecords, fromSharedPlot, fromSharedPost, fromSharedSeason, getUser, partitionRemote, planMerge, pullRecords, pushRecords, recoverPassword, refreshSession, resendConfirmation, signIn, signOut, signUp, toSharedPlot, toSharedPost, toSharedSeason, updateUser, verifyTokenHash } from "./sync.js";
import { deletePlot, deletePlotTombstone, deletePost, deleteSeason, eraseGarden, getPlot, listPlots, listPlotTombstones, listPosts, listSeasons, listSeeds, listSyncMeta, listUserSpecies, putPlotFromSync, putPostFromSync, putSeasonFromSync, putSeedFromSync, putUserSpeciesFromSync, rekeyPlot, setOnLocalWrite } from "./storage.js";
import { app, markPlanFresh } from "./state.js";
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
    catch { }
}
let signedInState = loadJson(SES_KEY) !== null;
let emailState = loadJson(SES_KEY)?.email ?? null;
let backendState = false;
const authListeners = [];
export const isSignedIn = () => signedInState;
export const signedInEmail = () => emailState;
export const backendConfigured = () => backendState;
export function onAuthChange(cb) {
    authListeners.push(cb);
}
function fireAuth() {
    for (const cb of authListeners)
        cb();
}
let capturedAuth = null;
let capturedConfirm = null;
let capturedError = null;
const LINK_KINDS = ["signup", "recovery", "email_change"];
export function parseAuthHash(hash) {
    const raw = hash.replace(/^#\/?/, "");
    if (raw.startsWith("confirm?")) {
        const q = new URLSearchParams(raw.slice("confirm?".length));
        const type = q.get("type") ?? "", tokenHash = q.get("token_hash") ?? "";
        if (tokenHash && LINK_KINDS.includes(type))
            return { confirm: { type: type, tokenHash } };
        return { error: { code: "malformed", description: "the link is incomplete" } };
    }
    const params = new URLSearchParams(raw);
    const access = params.get("access_token"), refresh = params.get("refresh_token");
    if (access && refresh)
        return { auth: { access_token: access, refresh_token: refresh, type: params.get("type") ?? "" } };
    if (params.get("error") || params.get("error_code")) {
        return { error: { code: params.get("error_code") ?? params.get("error") ?? "", description: params.get("error_description") ?? "" } };
    }
    return null;
}
export function captureAuthHash() {
    const h = location.hash;
    if (!h.includes("access_token=") && !/^#\/?confirm\?/.test(h) && !h.includes("error=") && !h.includes("error_code="))
        return;
    const got = parseAuthHash(h);
    if (!got)
        return;
    if (got.auth)
        capturedAuth = got.auth;
    if (got.confirm)
        capturedConfirm = got.confirm;
    if (got.error)
        capturedError = got.error;
    history.replaceState(null, "", location.pathname + location.search + "#/account");
}
export function friendlyAuthError(raw) {
    if (raw.includes("Invalid login credentials")) {
        return ["That email and password don't match. Check for typos and try again — or use “forgot password” below to reset it."];
    }
    if (raw.includes("Email not confirmed")) {
        return ["This account's email was never confirmed, so it can't sign in yet. Find the confirmation email in your inbox (check spam too) and open its link, then sign in again."];
    }
    if (raw.includes("already registered")) {
        return ["This email already has an account. Sign in instead — or use “forgot password” if the password is lost."];
    }
    if (raw.includes("you can only request this")) {
        return ["The backend limits how often these emails can go out. Give it a minute, then try once more."];
    }
    if (/otp_expired|invalid or has expired|Token has expired or is invalid|token not found|malformed/i.test(raw)) {
        return ["This link has expired or was already used, so it can't sign you in. Links only work once and for a limited time. Get a fresh one below, then open it from the device you'll garden on."];
    }
    return [raw];
}
export function initAccount(db, onPulled) {
    let defaultCfg = null;
    let session = loadJson(SES_KEY);
    const eff = () => defaultCfg;
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
    const clearNotice = () => { const b = $("acctnotice"); b.hidden = true; b.className = ""; b.innerHTML = ""; };
    const notice = (kind, lines, actions) => {
        const box = $("acctnotice");
        box.className = `acctnotice ${kind}`;
        box.innerHTML = "";
        const body = document.createElement("div");
        body.className = "acctnotice-body";
        for (const line of lines) {
            const p = document.createElement("p");
            p.textContent = line;
            body.appendChild(p);
        }
        if (actions?.length) {
            const row = document.createElement("div");
            row.className = "acctnotice-actions";
            for (const a of actions) {
                const b = document.createElement("button");
                b.type = "button";
                b.className = a.primary ? "acctnotice-act primary" : "acctnotice-act";
                b.textContent = a.label;
                b.addEventListener("click", a.run);
                row.appendChild(b);
            }
            body.appendChild(row);
        }
        const x = document.createElement("button");
        x.type = "button";
        x.className = "acctnotice-x";
        x.setAttribute("aria-label", "dismiss");
        x.textContent = "×";
        x.addEventListener("click", clearNotice);
        box.append(body, x);
        box.hidden = false;
    };
    const resendAction = (email) => ({
        label: "Resend the confirmation email",
        run: () => {
            void (async () => {
                const cfg = eff();
                const to = email().trim();
                if (!cfg || !to) {
                    notice("error", ["enter your email in the sign-in form first"]);
                    return;
                }
                try {
                    await resendConfirmation(cfg, to);
                    notice("info", [`If ${to} has an unconfirmed account, a fresh confirmation email is on its way — check your inbox and your spam folder.`]);
                }
                catch (e) {
                    notice("error", friendlyAuthError(`${e instanceof Error ? e.message : e}`));
                }
            })();
        },
    });
    const status = () => {
        backendState = eff() !== null;
        signedInState = session !== null;
        emailState = session?.email ?? null;
        $("acctstatus").textContent = !eff()
            ? "Accounts aren't live yet (no backend configured) - everything works on this device, and your data will carry into your account when they are."
            : session
                ? `Signed in as ${session.email}. Your addresses, areas, and seasons sync to your account; the plant knowledge is a public file and never leaves this device's bundle.`
                : "Sign in (or create an account) to keep your ledger and use it on any device.";
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
        app.refreshDraftBanner?.();
        app.refreshEditEntry?.(true);
    };
    const setSession = (s) => {
        session = s;
        saveJson(SES_KEY, s);
        status();
    };
    const gatherLocal = async () => {
        const metaByKey = new Map((await listSyncMeta(db)).map((m) => [m.key, m.updatedAt]));
        const plots = (await listPlots(db)).filter((p) => !p.example && !p.shared);
        const plotIds = new Set(plots.map((p) => p.id));
        const seasons = (await listSeasons(db)).filter((s) => plotIds.has(s.plot));
        const posts = (await listPosts(db)).filter((p) => plotIds.has(p.plot));
        const userSpecies = await listUserSpecies(db);
        const seeds = await listSeeds(db);
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
            ...(await listPlotTombstones(db)).map((t) => ({
                kind: "plot_tombstone", key: t.id,
                record: { deleted_at: new Date(t.deletedAt).toISOString(), name: t.name },
                updatedAt: t.deletedAt,
            })),
            ...(() => {
                const pr = prefRecord();
                return pr.updatedAt != null ? [{ kind: "pref", key: "display", record: pr.record, updatedAt: pr.updatedAt }] : [];
            })(),
        ];
    };
    const syncShared = async (sharedByOwner) => {
        const cfg = eff();
        const notes = [];
        let applied = 0;
        if (!cfg || !session)
            return { applied, notes };
        const localShared = (await listPlots(db, "all")).filter((p) => p.shared);
        const metaByKey = new Map((await listSyncMeta(db)).map((m) => [m.key, m.updatedAt]));
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
    let teamsUi = null;
    let lastSyncAt = 0;
    const LAST_SYNC_KEY = "gg-sync-last";
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
            try {
                session = await refreshSession(cfg, session);
            }
            catch (re) {
                const msg = re instanceof Error ? re.message : String(re);
                if (msg.includes("could not reach the backend") || msg.includes("temporarily unavailable"))
                    throw re;
                setSession(null);
                throw new Error("your sign-in expired on this device - sign in again to resume sync (everything local is safe).");
            }
            saveJson(SES_KEY, session);
            remote = await pullRecords(cfg, session);
        }
        const remoteExampleIds = new Set(remote.filter((r) => r.kind === "plot" && r.record.example).map((r) => r.key));
        remoteExampleIds.add("plot_example");
        remote = remote.filter((r) => {
            if (r.kind === "plot")
                return !remoteExampleIds.has(r.key);
            if (r.kind === "season")
                return !remoteExampleIds.has(r.record.plot ?? r.key.split(":")[0]);
            return true;
        });
        const { own, sharedByOwner } = partitionRemote(remote, session.userId);
        remote = own;
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
        let erased = 0;
        for (const e of plan.eraseLocal) {
            try {
                const had = await getPlot(db, e.plotId);
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
                    postsPulled = true;
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
        let mergedApplied = 0;
        for (const m of plan.merged) {
            try {
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
        console.info(`sync: ${pushRes.pushed} pushed, ${applied} pulled, ${mergedApplied} merged, ${plan.skipped} already identical.`, plan.notes);
        for (const fl of pushRes.failures) {
            console.warn(`sync: couldn't push ${fl.count} ${fl.kind} record${fl.count === 1 ? "" : "s"}: ${fl.error}`
                + " - if this names garden_records_kind_check, the backend predates this record kind; re-run the schema in docs/ACCOUNTS-SETUP.md.");
        }
        if (pushRes.failures.length) {
            lines.push("some changes couldn't sync - they stay safe on this device and will retry.");
        }
        const shared = await syncShared(sharedByOwner);
        for (const n of shared.notes)
            console.info(`sync (shared): ${n}`);
        if (shared.applied)
            void teamsUi?.refresh();
        if (postsPulled)
            app.invalidateHomePosts?.();
        if (applied || mergedApplied || erased || shared.applied)
            onPulled();
        lastSyncAt = Date.now();
        saveJson(LAST_SYNC_KEY, {
            at: lastSyncAt, pushed: pushRes.pushed, pulled: applied, merged: mergedApplied,
            skipped: plan.skipped,
            notes: [...plan.notes, ...pushRes.failures.map((fl) => `couldn't push ${fl.count} ${fl.kind}: ${fl.error}`)].slice(0, 6),
        });
        renderLastSync();
        return lines;
    };
    const AUTO_SYNC_MS = 2500;
    let autoTimer = null;
    const quietSync = async () => {
        if (!eff() || !session)
            return;
        try {
            const lines = await runSync();
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
            return;
        if (autoTimer != null)
            clearTimeout(autoTimer);
        autoTimer = window.setTimeout(() => { autoTimer = null; void quietSync(); }, AUTO_SYNC_MS);
    };
    const flushSync = () => {
        if (autoTimer == null)
            return;
        clearTimeout(autoTimer);
        autoTimer = null;
        void quietSync();
    };
    setOnLocalWrite(scheduleSync);
    app.pushPrefs = scheduleSync;
    window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden")
        flushSync(); });
    window.addEventListener("pagehide", flushSync);
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
    const run = (btn, fn) => {
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = "working…";
        clearNotice();
        fn().then(report).catch((e) => {
            const raw = `${e instanceof Error ? e.message : e}`;
            const actions = raw.includes("Email not confirmed")
                ? [resendAction(() => ($("acctemail")).value)]
                : undefined;
            notice("error", friendlyAuthError(raw), actions);
        })
            .finally(() => {
            btn.disabled = false;
            if (btn.textContent === "working…")
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
        const email = ($("acctemail")).value.trim();
        const pass = ($("acctpass")).value;
        if (!email || !pass)
            throw new Error("email and password are both needed");
        return [cfg, email, pass];
    };
    let authMode = "signin";
    const setAuthMode = (m) => {
        authMode = m;
        const signup = m === "signup";
        $("acctlegend").textContent = signup ? "Create account" : "Sign in";
        $("acctsignin").textContent = signup ? "Create account" : "Sign in";
        const pass = $("acctpass");
        pass.setAttribute("autocomplete", signup ? "new-password" : "current-password");
        if (signup)
            pass.setAttribute("minlength", "8");
        else
            pass.removeAttribute("minlength");
        $("acctpwhint").hidden = !signup;
        $("acctswitchrow").hidden = signup;
        $("acctbackrow").hidden = !signup;
        if (signup)
            ($("acctemail")).focus();
    };
    $("acctsignup").addEventListener("click", () => setAuthMode("signup"));
    $("acctback").addEventListener("click", () => setAuthMode("signin"));
    const RETURNTO_KEY = "gg-signin-return";
    const clearReturnTo = () => { try {
        localStorage.removeItem(RETURNTO_KEY);
    }
    catch { } };
    const SIGNUP_KEY = "gg-signup-email";
    const rememberSignup = (email) => { try {
        localStorage.setItem(SIGNUP_KEY, email.trim().toLowerCase());
    }
    catch { } };
    const ownSignup = (email) => { try {
        return localStorage.getItem(SIGNUP_KEY) === email.trim().toLowerCase();
    }
    catch {
        return false;
    } };
    const forgetSignup = () => { try {
        localStorage.removeItem(SIGNUP_KEY);
    }
    catch { } };
    const AUTH_PORTAL_IDS = ["acctnotice", "acctsignedout"];
    let authOpener = null;
    let authHomes = [];
    let signupPending = false;
    const closeAuthSheet = (fromSignIn = false) => {
        const sheet = $("authsheet");
        if (sheet.hidden)
            return;
        for (const h of [...authHomes].reverse())
            h.parent.insertBefore(h.el, h.next);
        authHomes = [];
        sheet.hidden = true;
        $("authscrim").hidden = true;
        document.body.classList.remove("authsheet-open");
        if (!fromSignIn && !signupPending)
            clearReturnTo();
        const back = authOpener;
        authOpener = null;
        back?.focus();
    };
    const openAuthSheet = (bed) => {
        if (isSignedIn())
            return;
        authOpener = document.activeElement ?? null;
        signupPending = false;
        setAuthMode("signin");
        try {
            if (bed)
                localStorage.setItem(RETURNTO_KEY, JSON.stringify({ bed }));
            else
                clearReturnTo();
        }
        catch { }
        const body = $("authsheetbody");
        authHomes = AUTH_PORTAL_IDS.map((id) => { const el = $(id); return { el, parent: el.parentNode, next: el.nextSibling }; });
        for (const { el } of authHomes)
            body.appendChild(el);
        $("acctsignedout").hidden = false;
        $("authscrim").hidden = false;
        $("authsheet").hidden = false;
        document.body.classList.add("authsheet-open");
        ($("acctemail")).focus();
    };
    {
        const prefs = document.getElementById("sec-prefs");
        const form = document.getElementById("acctsignedout");
        const note = document.getElementById("acctnotice");
        if (prefs?.parentNode && form) {
            if (note)
                prefs.parentNode.insertBefore(note, prefs);
            prefs.parentNode.insertBefore(form, prefs);
        }
    }
    $("authsheetclose").addEventListener("click", () => closeAuthSheet());
    $("authscrim").addEventListener("click", () => closeAuthSheet());
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("authsheet-open")) {
            e.preventDefault();
            closeAuthSheet();
        }
    });
    app.openAuthSheet = (bed) => openAuthSheet(bed);
    app.closeAuthSheet = () => closeAuthSheet(true);
    ($("signinform")).addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (authMode === "signup") {
            run($("acctsignin"), async () => {
                const [c, email, pass] = creds();
                if (pass.length < 8)
                    throw new Error("use at least 8 characters");
                const s = await signUp(c, email, pass);
                rememberSignup(email);
                if (!s) {
                    notice("info", [
                        `If ${email} is new, a confirmation link is on its way — open it to finish, then sign in. Give it a few minutes, and check your spam folder.`,
                        `Already have an account with this email? Nothing was sent — just sign in above, or use "forgot password".`,
                    ], [resendAction(() => email)]);
                    ($("acctpass")).value = "";
                    setAuthMode("signin");
                    signupPending = true;
                    return [];
                }
                setSession(s);
                signupPending = false;
                countRung("account-made");
                toast(`Account created - signed in as ${email}`);
                const lines = await runSync();
                try {
                    await app.onSignIn?.();
                }
                catch { }
                return lines;
            });
            return;
        }
        run($("acctsignin"), async () => {
            const [c, email, pass] = creds();
            setSession(await signIn(c, email, pass));
            toast(`Signed in as ${email} - Calendar and Log are open`);
            const lines = await runSync();
            try {
                await app.onSignIn?.();
            }
            catch { }
            return lines;
        });
    });
    act("pwforgot", async () => {
        const cfg = eff();
        if (!cfg)
            throw new Error("accounts aren't live yet - no backend is configured");
        const email = ($("acctemail")).value.trim();
        if (!email)
            throw new Error("enter your email above first");
        await recoverPassword(cfg, email);
        notice("info", [`If ${email} has an account, a recovery link is on its way — open it on this device and you'll be prompted for a new password. Check your spam folder if you don't see it.`]);
        return [];
    });
    act("passchange", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        const pw = ($("newpass")).value;
        if (pw.length < 8)
            throw new Error("use at least 8 characters");
        await updateUser(cfg, session, { password: pw });
        ($("newpass")).value = "";
        notice("info", ["Password changed. This doesn't sign out your other devices, though — so if you're changing it because the old one may have leaked, sign out on those separately."]);
        return [];
    });
    act("emailchange", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        const email = ($("newemail")).value.trim();
        if (!email)
            throw new Error("enter the new email first");
        await updateUser(cfg, session, { email });
        ($("newemail")).value = "";
        notice("info", [`Two confirmations are on the way — one to your current address and one to ${email}. The change takes effect only after you open both links, which is how we make sure it's really you moving the account. Check both inboxes, spam included.`]);
        return [];
    });
    act("acctsignout", async () => {
        const cfg = eff();
        if (cfg && session) {
            if (autoTimer != null) {
                clearTimeout(autoTimer);
                autoTimer = null;
            }
            try {
                await runSync();
            }
            catch { }
        }
        if (cfg && session)
            await signOut(cfg, session);
        setSession(null);
        try {
            await app.onSignOut?.();
        }
        catch { }
        markPlanFresh();
        try {
            app.resetPlanStep?.();
        }
        catch { }
        toast("Signed out - your account's gardens are hidden on this device until you sign back in");
        return [];
    });
    act("acctdelete", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error("sign in first");
        if (($("delconfirm")).value !== "delete my account") {
            throw new Error('type "delete my account" in the confirmation box to proceed');
        }
        const pw = ($("delpass")).value;
        if (!pw)
            throw new Error("enter your current password too - deleting is irreversible, so we check it's really you");
        await signIn(cfg, session.email, pw);
        await deleteAccount(cfg, session);
        setSession(null);
        ($("delconfirm")).value = "";
        ($("delpass")).value = "";
        return ["account and every synced record deleted from the backend. This device's local data is untouched - export anything you want to keep."];
    });
    teamsUi = initTeams({
        cfg: eff, session: () => session, onAuthChange,
        listOwnGardens: async () => (await listPlots(db))
            .filter((p) => !p.example && !p.shared)
            .map((p) => ({ id: p.id, name: p.name ?? p.id })),
        listSharedGardens: async () => (await listPlots(db, "all"))
            .filter((p) => p.shared)
            .map((p) => ({ ownerId: p.shared.ownerId, plot: p.shared.plot, name: p.name ?? p.shared.plot })),
        onSharedChange: () => void quietSync(),
    });
    status();
    renderLastSync();
    void (async () => {
        try {
            const res = await fetch("./backend.json");
            if (res.ok) {
                const body = await res.json();
                if (body.url && body.anonKey)
                    defaultCfg = { url: body.url.replace(/\/+$/, ""), anonKey: body.anonKey };
            }
        }
        catch { }
        const cfg = eff();
        let landAfterBootSync = null;
        let bootGreeting = [];
        const adoptLinkSession = async (tok, email, deferred) => {
            const hadSession = session !== null;
            setSession({ access_token: tok.access_token, refresh_token: tok.refresh_token, email });
            if (tok.type === "recovery") {
                notice("info", ["Recovery link verified — set a new password right now, in the field below. Your old password keeps working until you replace it."]);
                document.getElementById("newpass")?.focus();
            }
            else {
                bootGreeting = [`email confirmed - you're signed in as ${email}. Welcome.`,
                    "If this opened inside your mail app, open milpa.garden in your usual browser and sign in there with your password - you're signed in only on this screen."];
                report(bootGreeting);
            }
            const land = !hadSession && tok.type !== "recovery";
            const adoptDrafts = tok.type === "signup" && ownSignup(email);
            if (adoptDrafts)
                forgetSignup();
            if (!deferred) {
                landAfterBootSync = land ? { adoptDrafts } : null;
                return;
            }
            try {
                report([...bootGreeting, ...(await runSync())]);
            }
            catch (e) {
                report([...bootGreeting, `auto-sync failed: ${e instanceof Error ? e.message : e}`]);
            }
            if (land) {
                try {
                    await app.onSignIn?.({ adoptDrafts });
                }
                catch { }
            }
        };
        if (capturedAuth && cfg) {
            const tok = capturedAuth;
            capturedAuth = null;
            try {
                const who = await getUser(cfg, tok.access_token);
                if (session && session.email !== who.email) {
                    report([`ignored a sign-in link for ${who.email} - you're already signed in as ${session.email}. Sign out first if you really meant to switch accounts.`]);
                }
                else if (session) {
                    await adoptLinkSession(tok, who.email, false);
                }
                else {
                    notice("info", [
                        `This link wants to sign you in as ${who.email}.`,
                        "Continue only if you just followed a link from your own email (password recovery or signup confirmation). If someone else sent you this link, ignore it.",
                    ], [
                        { label: `Sign in as ${who.email}`, primary: true, run: () => { clearNotice(); void adoptLinkSession(tok, who.email, true); } },
                        { label: "Ignore this link", run: () => { clearNotice(); report(["sign-in link ignored - nothing changed."]); } },
                    ]);
                }
            }
            catch (e) {
                report([`the link didn't verify: ${e instanceof Error ? e.message : e}`]);
            }
        }
        if (capturedConfirm && cfg) {
            const link = capturedConfirm;
            capturedConfirm = null;
            const words = {
                signup: { lines: ["One tap to finish making your account.", "This confirms the email address the link was sent to, then names the account before anything signs in. Nothing happens until you tap."], tap: "Confirm my email" },
                recovery: { lines: ["Ready to set a new password?", "This link is for a password reset. Tap to open it, and you'll choose the new password right here. Your old one keeps working until you do."], tap: "Open the reset" },
                email_change: { lines: ["Moving your account to a new address.", "This confirms one of the two links the change needs. Nothing happens until you tap."], tap: "Confirm this change" },
            };
            const w = words[link.type];
            const refused = (raw) => {
                notice("error", friendlyAuthError(raw), link.type === "signup"
                    ? [resendAction(() => ($("acctemail")).value)]
                    : link.type === "recovery" ? [{ label: "Send a new reset link", run: () => { clearNotice(); $("pwforgot")?.click(); } }] : undefined);
                if (link.type === "signup")
                    report(["Type your email in the sign-in form first, then tap “Resend the confirmation email”."]);
            };
            notice("info", w.lines, [
                { label: w.tap, primary: true, run: () => {
                        void (async () => {
                            clearNotice();
                            let tok;
                            try {
                                tok = await verifyTokenHash(cfg, link.type, link.tokenHash);
                            }
                            catch (e) {
                                refused(`${e instanceof Error ? e.message : e}`);
                                return;
                            }
                            if (!tok) {
                                notice("ok", ["Confirmed - now open the link that went to your other address to finish the change."]);
                                return;
                            }
                            const who = tok.email || (await getUser(cfg, tok.access_token)).email;
                            const linkTok = { access_token: tok.access_token, refresh_token: tok.refresh_token, type: link.type };
                            if (session && session.email !== who) {
                                report([`ignored a sign-in link for ${who} - you're already signed in as ${session.email}. Sign out first if you really meant to switch accounts.`]);
                            }
                            else if (session) {
                                await adoptLinkSession(linkTok, who, true);
                            }
                            else {
                                notice("info", link.type === "signup" ? [
                                    `${who} is confirmed. Sign in on this device as that account?`,
                                    "Continue only if that's your own email. If someone else sent you this link, tap Ignore and nothing more happens.",
                                ] : [
                                    `This link wants to sign you in as ${who}.`,
                                    "Continue only if you just followed a link from your own email (password recovery or signup confirmation). If someone else sent you this link, ignore it.",
                                ], [
                                    { label: `Sign in as ${who}`, primary: true, run: () => { clearNotice(); void adoptLinkSession(linkTok, who, true); } },
                                    { label: "Ignore this link", run: () => { clearNotice(); report(["sign-in link ignored - nothing changed."]); } },
                                ]);
                            }
                        })();
                    } },
            ]);
        }
        if (capturedError && cfg) {
            const err = capturedError;
            capturedError = null;
            notice("error", friendlyAuthError(`${err.code} ${err.description}`), [resendAction(() => ($("acctemail")).value)]);
            report(["Type your email in the sign-in form first, then tap “Resend the confirmation email”. If it was a password reset link that failed, use “forgot password” for a new one."]);
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
                    await app.onSignIn?.(landAfterBootSync);
                }
                catch { }
            }
        }
    })();
}
