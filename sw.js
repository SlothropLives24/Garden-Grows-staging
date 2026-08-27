// Milpa Gardens content-estate service worker (O111f). Root scope; the app under /web/ has its own.
const CACHE = "gg-content-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("gg-content") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Not ours: another origin, a non-GET, or the app under /web/ (web/sw.js owns that scope).
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/web/")) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());   // cache-on-visit: whatever was actually fetched
        return res;
      } catch {
        const cached = await cache.match(req);      // offline: a page you have visited still opens
        return cached ?? Response.error();          // one you never visited does not - no precache, no lie
      }
    }),
  );
});
