// Map-plane geometry helpers - pure move out of groundmap.ts / plan.ts (fun-pass slice 2).
// Everything here is frame-agnostic math with no DOM and no engine imports; the REAL geometry
// contract (region validation, area, intersection) lives in engine/regions.ts and is untouched.
/** Rotate a bed-local offset by aDeg (CCW, +y north - the plot frame's convention). */
export const rotPt = (dx, dy, aDeg) => {
    const t = (aDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return [dx * c - dy * s, dx * s + dy * c];
};
/** A w×l rect's corners about (cx, cy), rotated by aDeg - saved top-left → top-right →
 *  bottom-right → bottom-left in the BED's frame, so consumers can read (w, l) back off the
 *  first two edges (D-079 slice 4). */
export const rectCorners = (cx, cy, w, l, aDeg) => [[-w / 2, l / 2], [w / 2, l / 2], [w / 2, -l / 2], [-w / 2, -l / 2]].map(([dx, dy]) => {
    const r = rotPt(dx, dy, aDeg);
    return [cx + r[0], cy + r[1]];
});
/** Ray-cast point-in-polygon. Works in any affine frame (plot metres or canvas px), so the
 *  caller can pass whichever is handy. Boundary points count as outside. */
export function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}
// Shortest distance from a point to a segment (both in the same units as the point).
function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Shortest distance from a point to a polygon's boundary (its edges). Zero if the point sits
// exactly on an edge; positive whether the point is inside or outside. Used to give bed tap-testing
// a touch-target margin so a near-miss on a phone still selects the bed instead of dropping a new one.
export function distToPolygon(x, y, poly) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        best = Math.min(best, distToSeg(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    }
    return best;
}
/** O113 X2: the pan's momentum tail as PURE data - the per-frame view-unit offsets a release
 *  velocity coasts through, decaying geometrically until a step falls under `minStep` (or the
 *  frame cap, a backstop against an absurd velocity - decay alone bounds every real one). Pure
 *  so the physics is unit-testable; the map's rAF loop just replays the frames. A zero (or
 *  sub-threshold) velocity returns no frames, which is also what the pinned e2e clock produces -
 *  release velocity needs time to advance - so under the suite a pan commits exactly as before. */
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
