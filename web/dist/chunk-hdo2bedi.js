import './chunk-lutet8cz.js';
import { copy } from './paint.js';
import { REM_FLAG, remindersOn } from './core.js';

const REM_DB = "gg-reminders";
const REM_STORE = "plan";
const REM_SYNC_TAG = "gg-reminders";
function remindersSupported() {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator
        && typeof self !== "undefined" && "PeriodicSyncManager" in self
        && typeof Notification !== "undefined";
}
let planListener = null;
function listenToPlan(fn) { planListener = fn; }
function markRemindersOn(on) {
    try {
        if (on)
            localStorage.setItem(REM_FLAG, "1");
    }
    catch { }
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
        const read = store.getAll();
        read.onsuccess = () => {
            const fired = new Set((read.result ?? []).filter((r) => r.fired).map((r) => r.key));
            store.clear();
            for (const r of plan)
                store.put({ ...r, fired: fired.has(r.key) });
        };
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
    });
    db.close();
    planListener?.(plan);
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
    planListener?.([]);
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
async function enableReminders(plan) {
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
        await reg.showNotification(copy.rmOnTitle, {
            body: copy.rmOnBody,
            tag: "gg-reminders-welcome", icon: "./icons/icon-192.png",
        });
    }
    catch { }
    return { ok: true, count: plan.length, background };
}
async function refreshReminders(plan) {
    if (!remindersOn() || !(remindersSupported() || planListener))
        return;
    try {
        await writePlan(plan);
    }
    catch { }
}
async function disableReminders() {
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

export { disableReminders, enableReminders, listenToPlan, markRemindersOn, refreshReminders, remindersSupported };
