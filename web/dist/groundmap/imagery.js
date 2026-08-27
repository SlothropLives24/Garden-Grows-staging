// Imagery backdrop for the ground map - pure move out of groundmap.ts (fun-pass slice 2).
// Esri World Imagery is the keyless default; Google Map Tiles take over when a tiles key is
// configured and its session is live (D-033). Tiles are backdrop pixels, never engine input
// (D-021): a failed tile just leaves the metre grid showing through, and the render NEVER
// waits on Google - the session is kicked in the background and the caller redraws when it lands.
import { fromLocal, tilesForViewport } from "../engine/geo.js";
import { mapsApiKey } from "../maps.js";
// Esri's REST path is /{z}/{row}/{col} = /{z}/{y}/{x}.
const TILE = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const ATTRIBUTION = "Imagery: Esri, Maxar, Earthstar Geographics";
// O113 N4 - the two tile ceilings. TILE_BASE_MAX is the level Esri serves EVERYWHERE (the old
// TILE_ZOOM_MAX): the base pass never asks past it, so the map always has pixels under it.
// TILE_DEEP_MAX is speculative headroom: many metros serve World Imagery to 21-22, and Google's
// satellite commonly reaches 22 - where the data exists the deep pass overlays real resolution,
// where it does not the tiles prune themselves (an error, or the tilemap availability query
// below answering no) and the stretched base stays. Past even the deep ceiling the vector layer
// owns the view (the map wears `deepzoom` and the metre grid steps up - deliberate drawing
// surface, not failed photograph).
export const TILE_BASE_MAX = 20;
export const TILE_DEEP_MAX = 22;
/** The pure fetch rule, unit-tested: which whole level the BASE pass draws, and which deeper
 *  level (if any) the ENHANCE pass overlays. High-DPI screens ask one level deeper than they
 *  display - a 256px tile spanning ~256 CSS px is 2-3x undersampled on every modern phone. */
export function tilePlan(zoom, dpr) {
    const z = Math.max(1, Math.round(zoom));
    const want = Math.min(TILE_DEEP_MAX, z + (dpr >= 1.5 ? 1 : 0));
    const baseZ = Math.min(z, TILE_BASE_MAX);
    return { baseZ, enhZ: want > baseZ ? want : null };
}
// Tiles that answered wrong once (an error, or a flat no-data tile past the guaranteed ceiling)
// are remembered for the session, so a pan does not re-request them every frame.
const FAILED_TILES = new Set();
const FAILED_CAP = 800;
const rememberFailed = (href) => {
    if (FAILED_TILES.size >= FAILED_CAP)
        FAILED_TILES.clear(); // a blunt cap beats unbounded growth
    FAILED_TILES.add(href);
};
/** Availability for a SPECULATIVE deep tile, asked of the provider instead of inferred from
 *  pixels (walk round 1: the first cut sampled the tile through a canvas, which silently never
 *  verifies when the image host omits CORS headers - so eligible deep tiles could be refused
 *  everywhere). Esri's own tilemap endpoint reports which tiles exist at a level; queries are
 *  cached per 8x8 block, and any failure - endpoint absent, level invalid, offline - reads as
 *  unavailable, leaving the stretched base showing, the same posture as every tile failure. */
const TILEMAP_URL = (z, y, x, h, w) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/${z}/${y}/${x}/${h}/${w}?f=json`;
const TILEMAP_BLOCK = 8;
const tilemapCache = new Map();
function esriTileAvailable(z, x, y) {
    const bx = Math.floor(x / TILEMAP_BLOCK) * TILEMAP_BLOCK;
    const by = Math.floor(y / TILEMAP_BLOCK) * TILEMAP_BLOCK;
    const key = `${z}/${by}/${bx}`;
    let p = tilemapCache.get(key);
    if (!p) {
        if (tilemapCache.size > 200)
            tilemapCache.clear(); // a blunt cap beats unbounded growth
        p = fetch(TILEMAP_URL(z, by, bx, TILEMAP_BLOCK, TILEMAP_BLOCK))
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => (Array.isArray(j?.data) ? j.data : null))
            .catch(() => null);
        tilemapCache.set(key, p);
    }
    return p.then((data) => !!data && data[(y - by) * TILEMAP_BLOCK + (x - bx)] === 1);
}
// Google's 2D tiles use standard slippy /{z}/{x}/{y} and require a session token (a POST)
// before any tile GET. Everything degrades to Esri on absence/error.
const GOOGLE_SESSION_URL = (key) => "https://tile.googleapis.com/v1/createSession?key=" + encodeURIComponent(key);
const GOOGLE_TILE = (z, x, y, session, key) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;
const GOOGLE_ATTR = "Imagery ©Google";
let gSession = null; // the Map Tiles session token, created lazily, cached this page load
let gDenied = false; // a definitive auth/quota failure - stop retrying (a transient offline error does NOT set this)
let gPending = false; // a session request is in flight - don't fire a second
let gCopyright = ""; // best-effort exact attribution from the viewport endpoint; falls back to GOOGLE_ATTR
const SVG_NS = "http://www.w3.org/2000/svg";
/** WHICH SOURCE would draw right now - "google:<session>" or "esri". A caller that CACHES a drawn
 *  view needs this in its cache key: the Google session is created in the background, so the very
 *  same frame legitimately changes source mid-life, and a cache that cannot see that keeps showing
 *  the fallback forever (the home's garden view did exactly that - measured: Google tiles fetched,
 *  Esri tiles still on screen). */
export const tileSourceKey = () => (gSession && mapsApiKey() && !gDenied) ? `google:${gSession}` : "esri";
/** Google tiles usable right now? Synchronous - the render NEVER waits on Google (D-021/D-033:
 *  tiles must never block the map; a hung tile host must fall through to Esri, then the grid). */
const googleTilesReady = () => !!(gSession && mapsApiKey() && !gDenied);
/** Create the Map Tiles session in the BACKGROUND, then redraw so the next render uses Google.
 *  Never awaited by the render path. A responded-but-unusable reply (bad key, denied referrer, over
 *  quota) sets gDenied so we stop hammering; a timeout/offline error stays retryable. */
const readyWaiters = new Set();
function kickGoogleSession(onReady) {
    const key = mapsApiKey();
    if (!key || gDenied || gSession)
        return;
    // EVERY surface waiting on the session gets told, not just the one that happened to kick it.
    // The old single-callback form meant whichever map drew first owned the notification: when the
    // ground map kicked the session, the home's garden view was never redrawn and served the Esri
    // fallback for the life of the page (measured - Google tiles fetched, Esri tiles on screen).
    readyWaiters.add(onReady);
    if (gPending)
        return;
    gPending = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000); // a black-holed host must not stall forever
    fetch(GOOGLE_SESSION_URL(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O113 N4: on a high-DPI screen ask for the retina session - Google then serves tiles with
        // double the pixels for the same coverage, which our world-size draw shows as free sharpness.
        body: JSON.stringify({
            mapType: "satellite", language: "en-US", region: "US",
            ...(typeof devicePixelRatio === "number" && devicePixelRatio >= 1.5
                ? { scale: "scaleFactor2x", highDpi: true } : {}),
        }),
        signal: ctrl.signal,
    })
        .then(async (res) => {
        if (res.ok) {
            const body = (await res.json());
            if (body.session) {
                gSession = body.session;
                const waiting = [...readyWaiters];
                readyWaiters.clear();
                for (const w of waiting)
                    w();
                return;
            }
        }
        gDenied = true; // responded without a usable session - a config problem, not a blip
    })
        .catch(() => { })
        .finally(() => { clearTimeout(timer); gPending = false; });
}
/** Best-effort exact attribution for the current view (Google's terms want its copyright shown).
 *  Fire-and-forget: it refines GOOGLE_ATTR once, and never blocks or breaks the render. */
async function googleCopyright(key, session, z, n, s, e, w) {
    if (gCopyright)
        return;
    try {
        const url = `https://tile.googleapis.com/tile/v1/viewport?session=${encodeURIComponent(session)}` +
            `&key=${encodeURIComponent(key)}&zoom=${z}&north=${n}&south=${s}&east=${e}&west=${w}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const body = (await (await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))).json());
        if (body.copyright) {
            gCopyright = body.copyright;
            const attrib = document.getElementById("mapattrib");
            if (attrib && attrib.textContent === GOOGLE_ATTR)
                attrib.textContent = gCopyright;
        }
    }
    catch { /* keep the generic Google attribution */ }
}
/** Draw the imagery tiles for the current viewport into `svg` - under everything the caller
 *  draws next. Chooses Google vs Esri per the session state, keeps the attribution line honest
 *  (including the offline fallback text), and kicks the Google session in the background when
 *  a key exists but no session yet (the caller's requestRedraw fires when it lands). */
export function drawTiles(o) {
    if (mapsApiKey() && !gSession && !gDenied)
        kickGoogleSession(o.requestRedraw);
    const useGoogle = googleTilesReady();
    const gKey = mapsApiKey();
    const hrefFor = useGoogle && gSession && gKey
        ? (t) => GOOGLE_TILE(t.z, t.x, t.y, gSession, gKey)
        : (t) => TILE(t.z, t.x, t.y);
    const attribution = useGoogle ? (gCopyright || GOOGLE_ATTR) : ATTRIBUTION;
    if (useGoogle && gSession && gKey) {
        const [latN, lonE] = fromLocal(o.anchor, o.cx + o.span / 2, o.cy + o.span / 2);
        const [latS, lonW] = fromLocal(o.anchor, o.cx - o.span / 2, o.cy - o.span / 2);
        void googleCopyright(gKey, gSession, Math.round(o.zoom), latN, latS, lonE, lonW);
    }
    // REUSE tile elements across frames (smooth pan/zoom): recreating every <image> and re-setting its
    // href each frame made the browser re-decode the whole viewport ~60x/second - the reported jank. Keep
    // a pool keyed by tile z/x/y; a tile already on screen just gets repositioned (no href touch, no
    // reload), new tiles are created once, and tiles that scrolled off are removed. The caller no longer
    // clears this layer.
    let pool = TILE_POOLS.get(o.svg);
    if (!pool) {
        pool = new Map();
        TILE_POOLS.set(o.svg, pool);
    }
    const seen = new Set();
    // O113 N4 - two passes over the one pool. The BASE pass (guaranteed levels) draws first; the
    // ENHANCE pass appends after it, so where a deeper tile lands it paints over the stretched
    // base, and where it fails the base simply stays. Speculative Esri tiles (past the guaranteed
    // ceiling) must pass the flat-tile check before their pixels are allowed on screen.
    const plan = tilePlan(o.zoom, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    const passes = [{ z: plan.baseZ, speculative: false }];
    if (plan.enhZ != null && !o.plain)
        passes.push({ z: plan.enhZ, speculative: plan.enhZ > TILE_BASE_MAX && !useGoogle });
    for (const pass of passes) {
        for (const t of tilesForViewport(o.anchor, o.cx, o.cy, o.span, pass.z)) {
            const key = `${t.z}/${t.x}/${t.y}`;
            const href = hrefFor(t);
            if (FAILED_TILES.has(href))
                continue;
            seen.add(key);
            const [px, py] = o.toPx(t.x0, t.y0 + t.size); // NW corner
            const w = String(t.size / o.mpp);
            let img = pool.get(key);
            if (!img) {
                img = document.createElementNS(SVG_NS, "image");
                img.setAttribute("preserveAspectRatio", "none");
                if (pass.speculative) {
                    // position now, pixels only once the provider confirms the tile exists - never paint
                    // an unverified deep tile over the guaranteed base
                    img.dataset.href = href;
                    void esriTileAvailable(t.z, t.x, t.y).then((ok) => {
                        if (ok)
                            img.setAttribute("href", href);
                        else {
                            rememberFailed(href);
                            img.remove();
                            pool.delete(key);
                        }
                    });
                }
                else {
                    img.setAttribute("href", href);
                    img.dataset.href = href;
                }
                img.addEventListener("load", () => { o.attrib.textContent = attribution; });
                img.addEventListener("error", () => {
                    rememberFailed(img.dataset.href ?? "");
                    img.remove();
                    pool.delete(key);
                    if (!o.attrib.textContent)
                        o.attrib.textContent = "no imagery here (offline or blocked) - the grid works the same";
                });
                pool.set(key, img);
                o.svg.appendChild(img);
            }
            else if (img.dataset.href !== href) {
                img.setAttribute("href", href); // the imagery source flipped (Esri -> Google) - reload this tile
                img.dataset.href = href;
            }
            img.setAttribute("x", String(px));
            img.setAttribute("y", String(py));
            img.setAttribute("width", w);
            img.setAttribute("height", w);
        }
    }
    // drop tiles no longer in view
    for (const [key, img] of pool)
        if (!seen.has(key)) {
            img.remove();
            pool.delete(key);
        }
}
// One <image> pool per tile layer, so a pan repositions the SAME elements instead of rebuilding them.
const TILE_POOLS = new WeakMap();
