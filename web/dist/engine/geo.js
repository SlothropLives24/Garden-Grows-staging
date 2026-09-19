const R = 6378137;
export function toMercator(lat, lon) {
    const x = R * (lon * Math.PI / 180);
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
}
export function toLocal(anchor, lat, lon) {
    const k = Math.cos(anchor.lat * Math.PI / 180);
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const [x, y] = toMercator(lat, lon);
    return [(x - ax) * k, (y - ay) * k];
}
export function fromLocal(anchor, xm, ym) {
    const k = Math.cos(anchor.lat * Math.PI / 180);
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const x = ax + xm / k;
    const y = ay + ym / k;
    const lon = (x / R) * 180 / Math.PI;
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
    return [lat, lon];
}
export function metresPerPixel(lat, zoom) {
    return (2 * Math.PI * R * Math.cos(lat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
}
export function tileAt(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latR = lat * Math.PI / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
    return { x, y };
}
export function tileNw(x, y, z) {
    const n = Math.pow(2, z);
    const lon = (x / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))) * 180 / Math.PI;
    return [lat, lon];
}
export function tilesForViewport(anchor, cxM, cyM, spanM, z) {
    const half = spanM / 2;
    const [latNE, lonNE] = fromLocal(anchor, cxM + half, cyM + half);
    const [latSW, lonSW] = fromLocal(anchor, cxM - half, cyM - half);
    const tNW = tileAt(latNE, lonSW, z);
    const tSE = tileAt(latSW, lonNE, z);
    const out = [];
    for (let x = tNW.x; x <= tSE.x && out.length < 64; x++) {
        for (let y = tNW.y; y <= tSE.y && out.length < 64; y++) {
            const [, lonW] = tileNw(x, y, z);
            const [latS, lonE] = tileNw(x + 1, y + 1, z);
            const [x0, y0] = toLocal(anchor, latS, lonW);
            const [x1] = toLocal(anchor, latS, lonE);
            out.push({ z, x, y, x0, y0, size: x1 - x0 });
        }
    }
    return out;
}
