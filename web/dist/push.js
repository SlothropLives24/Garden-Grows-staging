import './chunk-lutet8cz.js';
import { copy } from './paint.js';
import { app, el, fmtTemp, tempSystem, remindersOn } from './core.js';
import { listenToPlan, remindersSupported, disableReminders, markRemindersOn } from './chunk-hdo2bedi.js';
import './chunk-l5cseoso.js';

const ON_KEY = "gg-push-on";
const HAD_KEY = "gg-push-had-reminders";
const SENT_KEY = "gg-push-days";
const DAYS_AHEAD = 14;
const MAX_DAYS = 60;
function planDays(plan, today) {
    const end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + DAYS_AHEAD);
    const last = end.toISOString().slice(0, 10);
    const seen = new Set();
    const out = [];
    for (const r of [...plan].sort((a, b) => a.date.localeCompare(b.date) || (a.garden ?? "").localeCompare(b.garden ?? ""))) {
        if (r.date < today || r.date > last || !r.garden)
            continue;
        const k = `${r.garden}|${r.date}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push({ p: r.garden, d: r.date });
    }
    return out.slice(0, MAX_DAYS);
}
function pushSupported() {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator
        && typeof window !== "undefined" && "PushManager" in window && typeof Notification !== "undefined";
}
function iosTab() {
    const nav = navigator;
    const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
    return ios && !(matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
}
const b64u = (buf) => {
    let s = "";
    for (const b of new Uint8Array(buf ?? new ArrayBuffer(0)))
        s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s) => {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const local = {
    get: (k) => { try {
        return localStorage.getItem(k);
    }
    catch {
        return null;
    } },
    set: (k, v) => { try {
        if (v == null)
            localStorage.removeItem(k);
        else
            localStorage.setItem(k, v);
    }
    catch { } },
};
const onEndpoint = () => local.get(ON_KEY);
function wordsDb() {
    return new Promise((res, rej) => {
        const r = indexedDB.open("gg-push", 1);
        r.onupgradeneeded = () => { r.result.createObjectStore("words", { keyPath: "key" }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}
async function readWords() {
    const db = await wordsDb();
    return await new Promise((res, rej) => {
        const q = db.transaction("words", "readonly").objectStore("words").get("words");
        q.onsuccess = () => { db.close(); res(q.result ?? null); };
        q.onerror = () => { db.close(); rej(q.error); };
    });
}
async function putWords(w) {
    const db = await wordsDb();
    await new Promise((res, rej) => {
        const tx = db.transaction("words", "readwrite");
        tx.objectStore("words").put(w);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
    });
    db.close();
}
function initPush(deps) {
    let gardens = {};
    let lastWords = "";
    let busy = false;
    let status = "";
    const controls = new Set();
    const rest = async (path, init = {}) => deps.authed(async (cfg, s) => {
        const r = await fetch(`${cfg.url}/rest/v1/${path}`, { ...init, headers: {
                "apikey": cfg.anonKey, "Authorization": `Bearer ${s.access_token}`, "Content-Type": "application/json",
                ...init.headers
            } });
        if (!r.ok)
            throw new Error(`push: ${r.status}`);
        return r;
    });
    const serverKey = async () => deps.authed(async (cfg) => {
        const r = await fetch(`${cfg.url}/functions/v1/weather-watch`);
        const k = r.ok ? (await r.json()).vapid : null;
        if (typeof k !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(k))
            throw new Error("push: no server key");
        return k;
    });
    const writeWords = async () => {
        const tpl = fmtTemp(0).replace(/^-?\d+/, "{n}");
        const w = { key: "words", on: !!onEndpoint(), temp: { unit: tempSystem() === "c" ? "c" : "f", tpl },
            frostTitle: copy.wwpFrostTitle, frostAny: copy.wwpFrostAny, weekAny: copy.wwpWeekAny, yourGarden: copy.wwpYourGarden, gardens };
        const json = JSON.stringify(w);
        if (json === lastWords)
            return;
        lastWords = json;
        try {
            await putWords(w);
        }
        catch {
            lastWords = "";
        }
    };
    const tz = () => { try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
    catch {
        return "UTC";
    } };
    const todayIso = () => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    };
    const saveRow = async (sub, days) => {
        await rest("weather_push?on_conflict=user_id,endpoint", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ endpoint: sub.endpoint, p256dh: b64u(sub.getKey("p256dh")), auth: b64u(sub.getKey("auth")), tz: tz(), days }) });
        local.set(SENT_KEY, JSON.stringify(days));
    };
    let planNow = [];
    const sendDays = async () => {
        const endpoint = onEndpoint();
        if (!endpoint || !deps.session())
            return;
        const days = planDays(planNow, todayIso());
        if (JSON.stringify(days) === local.get(SENT_KEY))
            return;
        try {
            await rest(`weather_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "PATCH", headers: { "Prefer": "return=minimal" },
                body: JSON.stringify({ days, tz: tz() }) });
            local.set(SENT_KEY, JSON.stringify(days));
        }
        catch { }
    };
    listenToPlan((plan) => { planNow = plan; void sendDays(); });
    const draw = () => { for (const c of controls)
        paint(c); };
    const redrawAll = () => { draw(); app.homeRefresh?.(); app.calendarRefresh?.(); };
    const turnOn = async () => {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
            status = "denied";
            return;
        }
        const reg = await navigator.serviceWorker.ready;
        const key = await serverKey();
        let sub = await reg.pushManager.getSubscription();
        if (sub && b64u(sub.options.applicationServerKey) !== key) {
            await sub.unsubscribe();
            sub = null;
        }
        sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
        local.set(HAD_KEY, remindersOn() ? "1" : "0");
        markRemindersOn(true);
        await saveRow(sub, planDays(planNow, todayIso()));
        local.set(ON_KEY, sub.endpoint);
        await writeWords();
        try {
            await reg.showNotification(copy.wwpWelcomeTitle, { body: copy.wwpWelcomeBody, tag: "gg-push-welcome", icon: "./icons/icon-192.png" });
        }
        catch { }
        app.noticesChanged?.();
    };
    const turnOff = async () => {
        const endpoint = onEndpoint();
        try {
            const reg = await navigator.serviceWorker.ready;
            await (await reg.pushManager.getSubscription())?.unsubscribe();
        }
        catch { }
        if (endpoint && deps.session()) {
            try {
                await rest(`weather_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });
            }
            catch { }
        }
        stopHere();
    };
    const stopHere = () => {
        local.set(ON_KEY, null);
        local.set(SENT_KEY, null);
        const had = local.get(HAD_KEY) === "1";
        local.set(HAD_KEY, null);
        void writeWords();
        if (!had || !remindersSupported())
            void disableReminders();
    };
    const act = (on) => {
        if (busy)
            return;
        busy = true;
        status = "";
        draw();
        void (on ? turnOn() : turnOff()).catch(() => { status = "failed"; }).finally(() => { busy = false; redrawAll(); });
    };
    const paint = (box) => {
        const parts = [el("h3", "wwph", copy.wwpHead)];
        const on = !!onEndpoint();
        const button = (label, turn, cls) => {
            const b = el("button", cls, label);
            b.type = "button";
            b.disabled = busy;
            b.addEventListener("click", () => act(turn));
            return b;
        };
        if (!pushSupported())
            parts.push(el("p", "hint", iosTab() ? copy.wwpIos : copy.wwpUnsupported));
        else if (!deps.session())
            parts.push(el("p", "hint", copy.wwpSignIn));
        else if (on)
            parts.push(el("p", "hint", copy.wwpOnBody), button(copy.wwpOff, false, "btn btn-quiet"));
        else
            parts.push(el("p", "hint", copy.wwpOffBody), el("p", "wwfine", copy.wwpPrivacy), button(copy.wwpOn, true, "btn btn-secondary"));
        if (status) {
            const s = el("p", "hint wwpstatus", status === "denied" ? copy.wwpDenied : copy.wwpFailed);
            s.setAttribute("role", "status");
            parts.push(s);
        }
        box.replaceChildren(...parts);
        box.dataset.on = on ? "1" : "";
    };
    app.pushControl = () => {
        const box = [...controls][0] ?? el("section", "wwpush");
        box.id = "wwpush";
        controls.add(box);
        paint(box);
        return box;
    };
    app.pushOffer = () => {
        if (onEndpoint() || !deps.session() || (!pushSupported() && !iosTab()))
            return null;
        const a = el("a", "wwpoffer", copy.wwpOffer);
        a.href = "#/calendar";
        a.addEventListener("click", () => setTimeout(() => {
            const d = document.getElementById("calexport");
            if (d)
                d.open = true;
            document.getElementById("wwpush")?.scrollIntoView({ block: "center" });
        }, 120));
        return a;
    };
    const lineSending = new Map();
    app.pushFrost = (plotId, name, fw, held) => {
        gardens = { ...gardens, [plotId]: { name, bands: fw.bands } };
        void writeWords();
        if (!onEndpoint() || !deps.session())
            return Promise.resolve(false);
        if (fw.line === held)
            return Promise.resolve(true);
        const key = `${plotId}|${fw.line}`;
        const was = lineSending.get(key);
        if (was)
            return was;
        const p = rest(`weather_watch?plot_id=eq.${encodeURIComponent(plotId)}`, { method: "PATCH", headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({ frost_line_c: fw.line }) }).then(() => true, () => false).finally(() => lineSending.delete(key));
        lineSending.set(key, p);
        return p;
    };
    const check = async () => {
        if (!onEndpoint() || !pushSupported())
            return;
        if (!deps.session()) {
            try {
                await (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe();
            }
            catch { }
            stopHere();
            return;
        }
        try {
            const reg = await navigator.serviceWorker.ready;
            const key = await serverKey();
            let sub = await reg.pushManager.getSubscription();
            if (sub && b64u(sub.options.applicationServerKey) !== key) {
                await sub.unsubscribe();
                sub = null;
            }
            if (!sub && Notification.permission === "granted")
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
            if (!sub) {
                stopHere();
                return;
            }
            const old = onEndpoint();
            await saveRow(sub, planDays(planNow, todayIso()));
            if (old && old !== sub.endpoint) {
                try {
                    await rest(`weather_push?endpoint=eq.${encodeURIComponent(old)}`, { method: "DELETE" });
                }
                catch { }
            }
            local.set(ON_KEY, sub.endpoint);
        }
        catch { }
        draw();
    };
    void readWords().then((w) => { if (w?.gardens)
        gardens = { ...w.gardens, ...gardens }; void writeWords(); }, () => { });
    if (deps.session())
        void check();
    deps.onAuthChange(() => { void check(); redrawAll(); });
    redrawAll();
}

export { initPush, planDays };
