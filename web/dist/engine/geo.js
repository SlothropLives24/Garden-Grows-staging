// Geographic ↔ local-metre conversion + web-mercator tile math (Phase 2 imagery, D-021/D-022).
// DOM-free, dependency-free, unit-tested in web/test.mjs - pure math, no Python counterpart
// (nothing engine-side consumes it; it positions imagery UNDER the tracing, never inside a rule).
//
// The plot's local frame is metres with +y = geographic north, anchored at a lat/lon (the
// geocoded address). Web-mercator distances are inflated by 1/cos(lat), so conversions apply
// the anchor's cos(lat) - exact enough at yard scale (sub-centimetre across 100 m) and said
// so here rather than pretended away.
const R = 6378137; // WGS84 / web-mercator radius, metres
/** lat/lon → web-mercator metres. */
export function toMercator(lat, lon) {
    const x = R * (lon * Math.PI / 180);
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
}
/** lat/lon → the plot's local metre frame around the anchor (+x east, +y north). */
export function toLocal(anchor, lat, lon) {
    const k = Math.cos(anchor.lat * Math.PI / 180); // mercator inflation at the anchor
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const [x, y] = toMercator(lat, lon);
    return [(x - ax) * k, (y - ay) * k];
}
/** local metres around the anchor → lat/lon (inverse of toLocal). */
export function fromLocal(anchor, xm, ym) {
    const k = Math.cos(anchor.lat * Math.PI / 180);
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const x = ax + xm / k;
    const y = ay + ym / k;
    const lon = (x / R) * 180 / Math.PI;
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
    return [lat, lon];
}
/** Ground metres per pixel at a zoom level and latitude (256 px tiles). */
export function metresPerPixel(lat, zoom) {
    return (2 * Math.PI * R * Math.cos(lat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
}
/** The slippy tile containing a lat/lon at a zoom. */
export function tileAt(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latR = lat * Math.PI / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
    return { x, y };
}
/** North-west corner of a tile, as lat/lon. */
export function tileNw(x, y, z) {
    const n = Math.pow(2, z);
    const lon = (x / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))) * 180 / Math.PI;
    return [lat, lon];
}
/** Every tile covering a centred square viewport of `spanM` ground metres, with each tile's
 *  draw box in the local frame. Bounded defensively - a huge span at high zoom is a caller bug. */
export function tilesForViewport(anchor, cxM, cyM, spanM, z) {
    const half = spanM / 2;
    const [latNE, lonNE] = fromLocal(anchor, cxM + half, cyM + half);
    const [latSW, lonSW] = fromLocal(anchor, cxM - half, cyM - half);
    const tNW = tileAt(latNE, lonSW, z); // top-left tile: north edge, west edge
    const tSE = tileAt(latSW, lonNE, z);
    const out = [];
    for (let x = tNW.x; x <= tSE.x && out.length < 64; x++) {
        for (let y = tNW.y; y <= tSE.y && out.length < 64; y++) {
            const [, lonW] = tileNw(x, y, z);
            const [latS, lonE] = tileNw(x + 1, y + 1, z);
            const [x0, y0] = toLocal(anchor, latS, lonW); // south-west corner in local metres
            const [x1] = toLocal(anchor, latS, lonE);
            out.push({ z, x, y, x0, y0, size: x1 - x0 });
        }
    }
    return out;
}
