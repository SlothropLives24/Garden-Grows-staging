// O111a: reminders from the INSTALLED app, on the device, with no server and no account. The dates
// are the ones the engine already computes for the Calendar; the ICS export hands them to the phone's
// calendar app, and this hands them to the phone's NOTIFICATIONS instead - the market's universal
// retention mechanism, which ours stopped short of.
//
// THE MECHANISM, and its honest limits. There is exactly one web API that shows a notification for a
// future date with the app CLOSED and no server: Periodic Background Sync. The browser wakes the
// service worker on its own schedule (roughly daily, gated on the PWA being installed and used), and
// the worker shows whatever tasks have come due. Precise "8:00 the morning of" scheduling
// (Notification Triggers / TimestampTrigger) is not in any stable browser, so it is deliberately NOT
// built on - it would be dead for real users. So this is a FLOOR, exactly as the backlog frames it:
// best-effort daily reminders where the platform allows them, and where it does not, the honest
// answer is the Add-to-calendar export that already works everywhere. Feature detection decides which
// the reader is offered; nothing here pretends to a precision the platform cannot keep.
//
// User data never leaves the device: the plan is a tiny device-local IndexedDB (`gg-reminders`, its
// own database so it needs no schema coordination with the synced store), read by the worker. It is
// per-device notification state, NOT account data - it is never synced.
const REM_DB = "gg-reminders";
const REM_STORE = "plan";
const REM_FLAG = "gg-reminders-on"; // localStorage: the reader turned reminders on, on THIS device
export const REM_SYNC_TAG = "gg-reminders";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The plan the worker will read: one entry per FUTURE task (today included), keyed content-wise so a
 *  re-plan after a change updates rather than duplicates - the same identity discipline the ICS export
 *  uses. `sentenceFor` is injected (the caller owns the corpus bundle) so this module stays pure and
 *  out of an import cycle with the calendar. Past tasks are dropped: a reminder for a day already gone
 *  is noise, never scheduled. */
export function reminderPlan(tasks, sentenceFor, todayISO) {
    const seen = new Set();
    const out = [];
    for (const t of tasks) {
        if (!t.date || t.date < todayISO)
            continue; // today or later only
        const key = `gg-${t.kind}-${t.date}-${slug(t.bed ?? "")}-${slug(t.species ?? t.text ?? "")}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const sentence = (t.text ?? sentenceFor(t)).trim();
        const body = t.bed ? `${sentence} (${t.bed})` : sentence;
        out.push({ key, date: t.date, title: "Today in your garden", body });
    }
    return out;
}
/** Which reminders are due to show, given "today": on or before today and not already shown. The
 *  worker runs this same predicate; kept trivial (a string date compare) so the worker needs no shared
 *  code. Exported for the unit test that pins the boundary. */
export function dueReminders(plan, todayISO) {
    return plan.filter((r) => !r.fired && r.date <= todayISO);
}
/** The capability gate. Closed-app reminders need a service worker to wake to, the periodic-sync
 *  manager that wakes it, and the Notification API to show anything. Any missing → not offered, and
 *  the reader is pointed at the export instead. Guarded for non-browser (test) contexts too. */
export function remindersSupported() {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator
        && typeof self !== "undefined" && "PeriodicSyncManager" in self
        && typeof Notification !== "undefined";
}
export function remindersOn() {
    try {
        return localStorage.getItem(REM_FLAG) === "1";
    }
    catch {
        return false;
    }
}
function openRemDb() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(REM_DB, 1);
        r.onupgradeneeded = () => { r.result.createObjectStore(REM_STORE, { keyPath: "key" }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}
async function writePlan(plan) {
    const db = await openRemDb();
    await new Promise((res, rej) => {
        const tx = db.transaction(REM_STORE, "readwrite");
        const store = tx.objectStore(REM_STORE);
        store.clear(); // replace wholesale: the plan IS the state
        for (const r of plan)
            store.put({ ...r, fired: false });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
    });
    db.close();
}
async function clearPlan() {
    const db = await openRemDb();
    await new Promise((res, rej) => {
        const tx = db.transaction(REM_STORE, "readwrite");
        tx.objectStore(REM_STORE).clear();
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
    });
    db.close();
}
async function registerSync() {
    // Best-effort: the browser grants periodic-background-sync on its own (installed + engaged), and
    // throws where it will not - a non-installed tab, a browser without it. A throw is not a failure of
    // the feature; the plan is stored regardless, and the export remains the sure path. Reported, so the
    // status line can be honest about whether the background wake was actually armed.
    try {
        const reg = await navigator.serviceWorker.ready;
        const ps = reg.periodicSync;
        if (!ps)
            return false;
        await ps.register(REM_SYNC_TAG, { minInterval: 24 * 60 * 60 * 1000 });
        return true;
    }
    catch {
        return false;
    }
}
/** Turn reminders on for this device: ask for notification permission (a user gesture must be in
 *  flight), store the plan the worker will read, and arm the periodic wake. Idempotent - re-running
 *  re-plans, exactly like re-exporting the calendar after a change. */
export async function enableReminders(plan) {
    if (!remindersSupported())
        return { ok: false, reason: "unsupported" };
    if (!plan.length)
        return { ok: false, reason: "empty" };
    const perm = await Notification.requestPermission();
    if (perm !== "granted")
        return { ok: false, reason: "denied" };
    await writePlan(plan);
    const background = await registerSync();
    try {
        localStorage.setItem(REM_FLAG, "1");
    }
    catch { /* private mode: the plan is still stored */ }
    // One confirmation now, through the same worker path a due reminder will take - so the reader sees
    // exactly what a garden reminder will look like, and knows the pipeline works rather than trusting it.
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Reminders are on", {
            body: "You'll get a note here when a garden task is due.",
            tag: "gg-reminders-welcome", icon: "./icons/icon-192.png",
        });
    }
    catch { /* the plan is stored regardless; the confirmation is a nicety, not the feature */ }
    return { ok: true, count: plan.length, background };
}
/** Keep the plan current WITHOUT prompting: called on a Calendar render while reminders are on, so a
 *  plan edited elsewhere does not leave stale reminders armed. No permission ask, no state change. */
export async function refreshReminders(plan) {
    if (!remindersOn() || !remindersSupported())
        return;
    try {
        await writePlan(plan);
    }
    catch { /* best-effort refresh */ }
}
export async function disableReminders() {
    try {
        localStorage.removeItem(REM_FLAG);
    }
    catch { /* ignore */ }
    try {
        await clearPlan();
    }
    catch { /* ignore */ }
    try {
        const reg = await navigator.serviceWorker.ready;
        const ps = reg.periodicSync;
        await ps?.unregister(REM_SYNC_TAG);
    }
    catch { /* ignore */ }
}
