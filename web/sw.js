// Garden Grows service worker - the PWA half of D-019. Plain JS on purpose: it is not part of
// the tsc build and never imports the engine.
//
// Strategy: stale-while-revalidate for every same-origin GET. The first visit populates the
// cache (app shell, compiled modules, and the one corpus bundle - D-008's static-data design is
// what makes full offline trivial); later visits serve from cache instantly and refresh in the
// background. User data never passes through here: the season log lives in IndexedDB.
const CACHE = "gg-v2"; // bumped for the Organic redesign so stale chrome is pruned on activate
const PRECACHE = [
  "./", "./index.html", "./manifest.webmanifest",
  // self-hosted variable fonts (CSP allows no third-party hosts) - precached so the first
  // offline visit still renders in the brand voice
  "./fonts/BricolageGrotesque[opsz,wdth,wght].woff2",
  "./fonts/HankenGrotesk[wght].woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // Prune only OLD APP caches. CacheStorage is per-origin and shared with the content-estate
      // worker (engine/build_pages.py, scope /), so "delete everything but mine" would wipe its
      // cache on every app deploy; leave gg-content-* alone (it prunes its own, symmetrically).
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && !k.startsWith("gg-content")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // NETWORK-FIRST for everything same-origin, cache as the offline fallback. The earlier
      // split (navigations fresh, assets stale-while-revalidate) served fresh HTML with
      // one-deploy-old JavaScript on the first visit after every deploy - new buttons in the
      // markup, old code never wiring them. Version coherence beats instant cache hits; the
      // HTTP cache still makes warm loads fast, and offline behaviour is unchanged.
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (await cache.match("./index.html")) ?? Response.error();
        }
        return Response.error();
      }
    }),
  );
});

// O111a: on-device garden reminders, the closed-app half. The browser wakes this worker on its own
// roughly-daily schedule (Periodic Background Sync, granted only to an installed, used PWA), and here
// we show whatever tasks have come due. No server, no push, no account: the plan is a device-local
// IndexedDB the app writes (src/reminders.ts) and this reads. Timing is the browser's to choose, so
// this is a best-effort daily reminder, never a precise alarm - the honest floor the export sits above.
const REM_DB = "gg-reminders";
const REM_STORE = "plan";

function remOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(REM_DB, 1);
    // If the app has never written a plan the store may not exist yet; create it so the read below is
    // a clean empty rather than a thrown transaction.
    r.onupgradeneeded = () => { r.result.createObjectStore(REM_STORE, { keyPath: "key" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function remAll(db) {
  return new Promise((res, rej) => {
    const q = db.transaction(REM_STORE, "readonly").objectStore(REM_STORE).getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = () => rej(q.error);
  });
}

function remMarkFired(db, keys) {
  return new Promise((res, rej) => {
    const tx = db.transaction(REM_STORE, "readwrite");
    const store = tx.objectStore(REM_STORE);
    for (const k of keys) {
      const g = store.get(k);
      g.onsuccess = () => { const v = g.result; if (v) { v.fired = true; store.put(v); } };
    }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function fireDueReminders() {
  const today = new Date().toISOString().slice(0, 10);   // the wake day; the worker's clock is the phone's
  const db = await remOpen();
  const plan = await remAll(db);
  const due = plan.filter((r) => !r.fired && r.date && r.date <= today);
  const fired = [];
  for (const r of due) {
    try {
      await self.registration.showNotification(r.title || "Today in your garden", {
        body: r.body || "", tag: r.key, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
        data: { url: "./#/calendar" },
      });
      fired.push(r.key);
    } catch { /* a single failed notification must not sink the rest */ }
  }
  if (fired.length) await remMarkFired(db, fired);
  db.close();
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "gg-reminders") e.waitUntil(fireDueReminders());
});

// A tap on a reminder opens the Calendar - the page the dates live on. Focus an open tab if there is
// one, else open a new one.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./#/calendar";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hit = all.find((c) => c.url.includes("/web/"));
    if (hit) { await hit.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
