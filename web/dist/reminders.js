const REM_DB = "gg-reminders";
const REM_STORE = "plan";
const REM_FLAG = "gg-reminders-on";
const REM_SYNC_TAG = "gg-reminders";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function reminderPlan(tasks, sentenceFor, todayISO) {
    const seen = new Set();
    const out = [];
    for (const t of tasks) {
        if (!t.date || t.date < todayISO)
            continue;
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
export function dueReminders(plan, todayISO) {
    return plan.filter((r) => !r.fired && r.date <= todayISO);
}
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
        store.clear();
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
    catch { }
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Reminders are on", {
            body: "You'll get a note here when a garden task is due.",
            tag: "gg-reminders-welcome", icon: "./icons/icon-192.png",
        });
    }
    catch { }
    return { ok: true, count: plan.length, background };
}
export async function refreshReminders(plan) {
    if (!remindersOn() || !remindersSupported())
        return;
    try {
        await writePlan(plan);
    }
    catch { }
}
export async function disableReminders() {
    try {
        localStorage.removeItem(REM_FLAG);
    }
    catch { }
    try {
        await clearPlan();
    }
    catch { }
    try {
        const reg = await navigator.serviceWorker.ready;
        const ps = reg.periodicSync;
        await ps?.unregister(REM_SYNC_TAG);
    }
    catch { }
}
