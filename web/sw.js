// Garden Grows service worker - the PWA half of D-019. Plain JS on purpose: it is not part of
// the tsc build and never imports the engine.
//
// Strategy: stale-while-revalidate for every same-origin GET. The first visit populates the
// cache (app shell, compiled modules, and the one corpus bundle - D-008's static-data design is
// what makes full offline trivial); later visits serve from cache instantly and refresh in the
// background. User data never passes through here: the season log lives in IndexedDB.
// gg-v3 (route splitting, perf stage 2): the app is now an entry plus lazily loaded chunks. A worker still
// holding gg-v2's entry - which imported every module statically - must not serve it beside new chunk
// files, so the bump prunes it on activate. (gg-v2 was the Organic redesign's bump.)
const CACHE = "gg-v3";
// The shell once, as "./" - the URL a visit actually navigates to. "./index.html" was listed too, and
// being a different URL it was a second full download of the same 44 KB shell on every install
// (perf track 5); the offline navigation fallback below reads "./" first for that reason.
const PRECACHE = [
  "./", "./manifest.webmanifest",
  // self-hosted variable fonts (CSP allows no third-party hosts) - precached so the first
  // offline visit still renders in the brand voice: the three faces index.html preloads (O372)
  "./fonts/HankenGrotesk[wght].woff2",
  "./fonts/Fraunces[opsz,SOFT,WONK,wght].woff2",
  "./fonts/Fraunces-Italic[opsz,SOFT,WONK,wght].woff2",
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

// O388 (b): what a deploy leaves behind. A deploy that changes the app ships new URLs - a new stamp on the shell's own
// files (styles.css?v=, boot.js?v=, dist/app.js?v=; scripts/version_app_assets.py) or new content-hashed chunks
// (dist/chunk-<hash>.js; scripts/bundle_app.mjs) - and this cache kept every old one beside them, so a daily gardener's
// storage grew with each deploy. A stamped file keeps only its newest stamp (an open tab has already loaded its own, and
// the offline shell names the newest), and a warm drops the hashed chunks the page's manifest no longer names.
const STAMP = /^\?v=[A-Za-z0-9]+$/;
const HASHED_CHUNK = /^\/web\/dist\/chunk-[a-z0-9]+\.js$/;

async function dropOtherStamps(cache, href) {
  const u = new URL(href);
  if (!STAMP.test(u.search)) return;
  for (const k of await cache.keys()) {
    const o = new URL(k.url);
    if (o.pathname === u.pathname && o.search !== u.search && STAMP.test(o.search)) await cache.delete(k);
  }
}

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
        if (res.ok) {
          const kept = cache.put(req, res.clone()).then(() => dropOtherStamps(cache, req.url)).catch(() => { /* a full disk: next time */ });
          try { e.waitUntil(kept); } catch { /* the event has ended: the write still runs while the worker lives */ }
        }
        return res;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          // the precached shell, else a runtime-cached /index.html from a visit that navigated there
          return (await cache.match("./")) ?? (await cache.match("./index.html")) ?? Response.error();
        }
        return Response.error();
      }
    }),
  );
});

// Perf track 5 (win 4): warm the files a TAP may need, once the page has gone idle (app.ts
// warmOffline). Every rule and folklore claim (build/pages/evidence.json) and the source pointers
// (build/provenance.json) used to be fetched on every start, or not held for offline at all; now the
// page asks, this fetches each one it does not already hold, and the fetch handler above serves it
// offline from then on. Only these paths are honoured - a message cannot make the worker fetch an
// arbitrary URL - and an entry already cached is left alone (the page's own network-first fetch keeps
// it current whenever it is online and opens a sheet).
// Route splitting (perf stage 2): the app's own compiled modules under /web/dist/ are warmable too. A
// route's page is a chunk fetched when the route is entered, so a route never opened online would be
// missing offline; the page sends every chunk file from the deployed manifest, and this fetches the
// ones it does not hold. Still same-origin only, still compiled modules only (a .js directly under
// /web/dist/, or in a folder there - never a path that climbs out of it).
// O325 (d): ...and the three sheets a route links lazily (logedit.css, growshere.css, yearplan.css) - these names only.
const WARMABLE = /\/(?:build\/(?:pages\/evidence|provenance)\.json|web\/dist\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*(?:\.gen)?\.js|web\/(?:logedit|growshere|yearplan)\.css)$/;

async function warm(urls) {
  const cache = await caches.open(CACHE);
  const want = []; // the warmable files the page names, in its order
  for (const u of urls) {
    let url;
    try { url = new URL(u, self.location.href); } catch { continue; }
    if (url.origin !== self.location.origin || url.search || !WARMABLE.test(url.pathname)) continue;
    want.push(url);
  }
  // O388 (b): the page's manifest names every hashed chunk its build ships (app.ts warmOffline sends it whole). One it names
  // that is not held means a build this cache has not seen, so the route files it holds under fixed names (logpage.js,
  // planroute.js ...) may be the old build's and are fetched again, not skipped.
  const chunks = want.filter((url) => HASHED_CHUNK.test(url.pathname));
  let newBuild = false;
  for (const url of chunks) if (!(await cache.match(url.href))) { newBuild = true; break; }
  for (const url of want) {
    const stale = newBuild && /^\/web\/dist\//.test(url.pathname) && !HASHED_CHUNK.test(url.pathname);
    if (!stale && (await cache.match(url.href))) continue;
    try {
      const res = await fetch(url.href);
      if (res.ok) await cache.put(url.href, res);
    } catch { /* offline right now - the next visit's idle warm tries again */ }
  }
  // ...and only once every file it names is held is a held hashed chunk it does not name let go, as an old build's: a route
  // file is never left without the chunks it imports (the second reader's find). A page with no manifest (the dev server)
  // names no hashed chunk, and nothing is dropped.
  if (!chunks.length) return;
  for (const url of want) if (!(await cache.match(url.href))) return;
  const named = new Set(chunks.map((url) => url.pathname));
  for (const k of await cache.keys()) {
    const o = new URL(k.url);
    if (HASHED_CHUNK.test(o.pathname) && !named.has(o.pathname)) await cache.delete(k);
  }
}

self.addEventListener("message", (e) => {
  const d = e.data;
  if (d && d.type === "gg-warm" && Array.isArray(d.urls)) e.waitUntil(warm(d.urls));
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

// `only`: one garden's (a push names it), else every garden's. Returns how many it showed.
async function fireDueReminders(only) {
  // The wake day as the PHONE's own calendar date (O231 B2): toISOString is UTC, which is already tomorrow on an
  // American evening, so a reminder set for tomorrow fired tonight. The same rule as web/src/today.ts.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const db = await remOpen();
  const plan = await remAll(db);
  const due = plan.filter((r) => !r.fired && r.date && r.date <= today && (only === undefined || (r.garden || "") === only));
  // D-297: the newest due notice of each garden shows; the older ones it slept through are let go (marked shown
  // unseen) - a phone asleep for a week wakes to this week, never to a stack. The same rule as reminders.ts dueReminders.
  const newest = new Map();
  for (const r of due) { const g = r.garden || ""; const cur = newest.get(g); if (!cur || cur.date < r.date) newest.set(g, r); }
  const fired = due.filter((r) => newest.get(r.garden || "") !== r).map((r) => r.key);
  let shown = 0;
  for (const r of newest.values()) {
    try {
      await self.registration.showNotification(r.title || "Today in your garden", {
        // one tray entry per garden: this week's notice replaces last week's if it is still there
        body: r.body || "", tag: `gg-${r.garden || "garden"}`, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
        data: { url: "./#/calendar" },
      });
      fired.push(r.key);
      shown++;
    } catch { /* a single failed notification must not sink the rest */ }
  }
  if (fired.length) await remMarkFired(db, fired);
  db.close();
  return shown;
}

self.addEventListener("periodicsync", (e) => {
  // while the push is on (below), it brings the reminders on their morning, so the browser's own wake stays quiet
  if (e.tag === "gg-reminders") e.waitUntil(pushWords().then((w) => (w && w.on ? 0 : fireDueReminders()), () => fireDueReminders()));
});

// Weather watch's push (D-298 milestone 3, D-304; built behind the Plus hold - only a page with the preview open
// subscribes, so on the live site no push ever arrives). The server sends a message with no words in it: a kind, a
// garden's id, a date and, for frost, the night's low. The words are the app's, kept on this device in its own small
// database (`gg-push`, written by src/push.ts in the gardener's language and units, never synced): the push's titles,
// each garden's name, and each garden's frost lines for tonight's low (src/weather.ts frostWords) - so the server never
// holds a crop, a bed or a reminder's text. Every push shows a notification (the browsers require one).
const PUSH_DB = "gg-push";
const PUSH_STORE = "words";

function pushWords() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(PUSH_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(PUSH_STORE, { keyPath: "key" }); };
    r.onsuccess = () => {
      const db = r.result;
      const q = db.transaction(PUSH_STORE, "readonly").objectStore(PUSH_STORE).get("words");
      q.onsuccess = () => { db.close(); res(q.result || null); };
      q.onerror = () => { db.close(); rej(q.error); };
    };
    r.onerror = () => rej(r.error);
  });
}

// A low in the gardener's units, as the app writes one (src/units.ts fmtTemp; the app hands over its pattern, "{n} °F").
function lowWords(c, temp) {
  const n = temp && temp.unit === "f" ? +((c * 9) / 5 + 32).toFixed(0) : +c.toFixed(0);
  return ((temp && temp.tpl) || "{n} °C").replace("{n}", String(n));
}

const PUSH_ICON = "./icons/icon-192.png";

async function showPush(m) {
  const w = await pushWords().catch(() => null);
  const g = m && w && w.gardens ? w.gardens[m.p] : null;
  const name = (g && g.name) || (w && w.yourGarden) || "";
  if (m && m.k === "frost" && typeof m.lo === "number") {
    // the strip's own frost line for this low: the first band (coldest first) whose reach the low is at or under
    const band = g && Array.isArray(g.bands) ? g.bands.find((b) => m.lo <= b.upTo + 1e-6) : null;
    const body = (band ? band.text : (w && w.frostAny) || "").replace("{low}", lowWords(m.lo, w && w.temp));
    return self.registration.showNotification(w ? w.frostTitle.replace("{garden}", name) : "Milpa", {
      body, tag: `gg-frost-${m.p}`, icon: PUSH_ICON, badge: PUSH_ICON, data: { url: "./#/" },
    });
  }
  if (m && m.k === "week") {
    // the reminder this device already holds for that garden (the same words the browser's own wake shows)
    if (await fireDueReminders(m.p).catch(() => 0)) return undefined;
    return self.registration.showNotification(name || "Milpa", {
      body: (w && w.weekAny) || "", tag: `gg-${m.p}`, icon: PUSH_ICON, badge: PUSH_ICON, data: { url: "./#/calendar" },
    });
  }
  return self.registration.showNotification("Milpa", { tag: "gg-push", icon: PUSH_ICON, badge: PUSH_ICON });
}

self.addEventListener("push", (e) => {
  let m = null;
  try { m = e.data ? e.data.json() : null; } catch { m = null; }
  e.waitUntil(showPush(m));
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
