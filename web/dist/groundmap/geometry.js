export const rotPt = (dx, dy, aDeg) => {
    const t = (aDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return [dx * c - dy * s, dx * s + dy * c];
};
export const rectCorners = (cx, cy, w, l, aDeg) => [[-w / 2, l / 2], [w / 2, l / 2], [w / 2, -l / 2], [-w / 2, -l / 2]].map(([dx, dy]) => {
    const r = rotPt(dx, dy, aDeg);
    return [cx + r[0], cy + r[1]];
});
export function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}
function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function distToPolygon(x, y, poly) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        best = Math.min(best, distToSeg(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    }
    return best;
}
export function coastFrames(vx, vy, decay = 0.92, minStep = 0.3, cap = 90) {
    const out = [];
    let x = vx, y = vy;
    while (out.length < cap && Math.hypot(x, y) >= minStep) {
        out.push([x, y]);
        x *= decay;
        y *= decay;
    }
    return out;
}
