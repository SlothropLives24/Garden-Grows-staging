import { fromLocal, tilesForViewport } from "../engine/geo.js";
import { mapsApiKey } from "../maps.js";
const TILE = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const ATTRIBUTION = "Imagery: Esri, Maxar, Earthstar Geographics";
export const TILE_BASE_MAX = 20;
export const TILE_DEEP_MAX = 22;
export function tilePlan(zoom, dpr) {
    const z = Math.max(1, Math.round(zoom));
    const want = Math.min(TILE_DEEP_MAX, z + (dpr >= 1.5 ? 1 : 0));
    const baseZ = Math.min(z, TILE_BASE_MAX);
    return { baseZ, enhZ: want > baseZ ? want : null };
}
const FAILED_TILES = new Set();
const FAILED_CAP = 800;
const rememberFailed = (href) => {
    if (FAILED_TILES.size >= FAILED_CAP)
        FAILED_TILES.clear();
    FAILED_TILES.add(href);
};
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
            tilemapCache.clear();
        p = fetch(TILEMAP_URL(z, by, bx, TILEMAP_BLOCK, TILEMAP_BLOCK))
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => (Array.isArray(j?.data) ? j.data : null))
            .catch(() => null);
        tilemapCache.set(key, p);
    }
    return p.then((data) => !!data && data[(y - by) * TILEMAP_BLOCK + (x - bx)] === 1);
}
const GOOGLE_SESSION_URL = (key) => "https://tile.googleapis.com/v1/createSession?key=" + encodeURIComponent(key);
const GOOGLE_TILE = (z, x, y, session, key) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;
const GOOGLE_ATTR = "Imagery ©Google";
let gSession = null;
let gDenied = false;
let gPending = false;
let gCopyright = "";
const SVG_NS = "http://www.w3.org/2000/svg";
const googleTilesReady = () => !!(gSession && mapsApiKey() && !gDenied);
const readyWaiters = new Set();
function kickGoogleSession(onReady) {
    const key = mapsApiKey();
    if (!key || gDenied || gSession)
        return;
    readyWaiters.add(onReady);
    if (gPending)
        return;
    gPending = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch(GOOGLE_SESSION_URL(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        gDenied = true;
    })
        .catch(() => { })
        .finally(() => { clearTimeout(timer); gPending = false; });
}
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
    catch { }
}
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
    let pool = TILE_POOLS.get(o.svg);
    if (!pool) {
        pool = new Map();
        TILE_POOLS.set(o.svg, pool);
    }
    const seen = new Set();
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
            const [px, py] = o.toPx(t.x0, t.y0 + t.size);
            const w = String(t.size / o.mpp);
            let img = pool.get(key);
            if (!img) {
                img = document.createElementNS(SVG_NS, "image");
                img.setAttribute("preserveAspectRatio", "none");
                if (pass.speculative) {
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
                img.setAttribute("href", href);
                img.dataset.href = href;
            }
            img.setAttribute("x", String(px));
            img.setAttribute("y", String(py));
            img.setAttribute("width", w);
            img.setAttribute("height", w);
        }
    }
    for (const [key, img] of pool)
        if (!seen.has(key)) {
            img.remove();
            pool.delete(key);
        }
}
const TILE_POOLS = new WeakMap();
