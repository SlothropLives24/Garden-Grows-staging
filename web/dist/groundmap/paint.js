// Tile-paint bed geometry (D-096) - pure and DOM-free; the ported reference implementation
// from docs/mockups/tile-paint.html, unit-tested in web/test.mjs.
//
// The bed being painted is a set of cells on a fixed world lattice: cell (i,j) covers
// [i·C, (i+1)·C] × [j·C, (j+1)·C] in plot metres, C = 0.30 - deliberately the same cell as the
// D-078 My-bed plant grid (CANVAS_CELL_M), and ≈1 ft, so a classic 4×8 ft bed is 4×8 tiles.
//
// TWO INVARIANTS make everything downstream safe, and the paint/erase guards exist to hold them:
//   1. the set is 4-CONNECTED (canPaint: a new tile must touch the bed; canErase: removing a
//      tile may not cut the bed in two), and
//   2. its complement is connected too - NO HOLES (fillHoles after a paint stroke; canErase
//      refuses an interior erase that would mint a donut hole).
// A set holding both always has ONE simple rectilinear boundary, so outline() provably emits a
// polygon `parseRegion` accepts - save can never fail on geometry. The lattice is a UI
// convention only: the stored region is an ordinary polygon (isLattice recovers paintability).
import { isSimplePolygon, regionPoints } from "../engine/regions.js";
import { pointInPolygon } from "./geometry.js";
// The paint lattice cell, in plot metres. Metric stays 0.30 m (= the D-078 plant grid); imperial
// snaps to exactly 1 ft so a square-foot-gardening bed tiles cleanly. The size is PASSED IN by the
// caller (groundmap reads the display unit) so this module stays pure and DOM-free; the exported
// default keeps the unit tests unit-independent. isLattice accepts EITHER grid, so a bed painted
// under one unit setting stays re-paintable after a switch (only the new tiles snap to the new grid).
export const METRIC_CELL_M = 0.30;
export const IMPERIAL_CELL_M = 0.3048; // exactly 1 ft
export const CELL_M = METRIC_CELL_M; // back-compat alias + the default cell for callers/tests
export const cellKey = (i, j) => `${i},${j}`;
const parse = (k) => k.split(",").map(Number);
const nbrs = (i, j) => [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
const r2 = (v) => Math.round(v * 100) / 100; // groundmap's save rounding
/** The cells a drag segment crosses, as a 4-connected supercover: one axis steps at a time
 *  (ties step x first), so a single stroke can never create diagonal-only adjacency. */
export function strokeCells(x0, y0, x1, y1, cell = CELL_M) {
    let i = Math.floor(x0 / cell), j = Math.floor(y0 / cell);
    const ie = Math.floor(x1 / cell), je = Math.floor(y1 / cell);
    const out = [[i, j]];
    const dx = x1 - x0, dy = y1 - y0;
    let guard = 0;
    while ((i !== ie || j !== je) && guard++ < 4096) {
        const tx = dx > 0 ? (((i + 1) * cell - x0) / dx) : dx < 0 ? ((i * cell - x0) / dx) : Infinity;
        const ty = dy > 0 ? (((j + 1) * cell - y0) / dy) : dy < 0 ? ((j * cell - y0) / dy) : Infinity;
        if (tx <= ty)
            i += Math.sign(dx);
        else
            j += Math.sign(dy);
        out.push([i, j]);
    }
    return out;
}
/** May (i,j) be painted? The first tile is free; every later tile must touch the bed. */
export function canPaint(cells, i, j) {
    return cells.size === 0 || nbrs(i, j).some(([a, b]) => cells.has(cellKey(a, b)));
}
/** May (i,j) be erased? Not if it would CUT the bed in two (articulation check), and not if
 *  the freed cell would be fully enclosed - an interior erase would mint a donut hole. */
export function canErase(cells, i, j) {
    if (!cells.has(cellKey(i, j)))
        return false;
    if (cells.size === 1)
        return true;
    const rest = new Set(cells);
    rest.delete(cellKey(i, j));
    // still one piece?
    const start = rest.values().next().value;
    const seen = new Set([start]);
    const q = [parse(start)];
    while (q.length) {
        const [a, b] = q.pop();
        for (const [x, y] of nbrs(a, b)) {
            const k = cellKey(x, y);
            if (rest.has(k) && !seen.has(k)) {
                seen.add(k);
                q.push([x, y]);
            }
        }
    }
    if (seen.size !== rest.size)
        return false;
    // and the freed cell must reach open air
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
    for (const k of rest) {
        const [a, b] = parse(k);
        i0 = Math.min(i0, a);
        i1 = Math.max(i1, a);
        j0 = Math.min(j0, b);
        j1 = Math.max(j1, b);
    }
    const empt = new Set([cellKey(i, j)]);
    const q2 = [[i, j]];
    while (q2.length) {
        const [a, b] = q2.pop();
        if (a < i0 || a > i1 || b < j0 || b > j1)
            return true; // past the bed's bounds - open
        for (const [x, y] of nbrs(a, b)) {
            const k = cellKey(x, y);
            if (!rest.has(k) && !empt.has(k)) {
                empt.add(k);
                q2.push([x, y]);
            }
        }
    }
    return false; // fully enclosed - refuse
}
/** The enclosed empty cells of `cells` (holes), found by flooding the complement inward from
 *  outside the bounding box. Does not mutate - the caller paints the returned cells (and gets
 *  to animate them). */
export function fillHoles(cells) {
    if (!cells.size)
        return [];
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
    for (const k of cells) {
        const [i, j] = parse(k);
        i0 = Math.min(i0, i);
        i1 = Math.max(i1, i);
        j0 = Math.min(j0, j);
        j1 = Math.max(j1, j);
    }
    i0--;
    i1++;
    j0--;
    j1++;
    const out = new Set([cellKey(i0, j0)]);
    const q = [[i0, j0]];
    while (q.length) {
        const [a, b] = q.pop();
        for (const [x, y] of nbrs(a, b)) {
            const k = cellKey(x, y);
            if (x < i0 || x > i1 || y < j0 || y > j1 || cells.has(k) || out.has(k))
                continue;
            out.add(k);
            q.push([x, y]);
        }
    }
    const holes = [];
    for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
            const k = cellKey(i, j);
            if (!cells.has(k) && !out.has(k))
                holes.push([i, j]);
        }
    return holes;
}
/** The painted set's boundary as ONE simple rectilinear polygon in plot metres - CCW (interior
 *  on the walk's left), collinear runs merged, vertices at the r2 save rounding. The caller must
 *  hold the two invariants (4-connected, hole-free); asserted here by walking every boundary
 *  edge exactly once and re-checking isSimplePolygon - a violation throws rather than storing a
 *  lying region (regions.ts's own ethic). */
export function outline(cells, cell = CELL_M) {
    if (!cells.size)
        throw new Error("outline: empty cell set");
    // one directed edge per boundary side, keyed by start vertex; interior stays on the left
    const edges = new Map();
    let n = 0;
    const put = (a, b) => {
        if (edges.has(a))
            throw new Error("outline: pinch vertex - the invariants do not hold");
        edges.set(a, b);
        n++;
    };
    for (const k of cells) {
        const [i, j] = parse(k);
        if (!cells.has(cellKey(i, j - 1)))
            put(cellKey(i, j), [i + 1, j]); // south side, walking east
        if (!cells.has(cellKey(i + 1, j)))
            put(cellKey(i + 1, j), [i + 1, j + 1]); // east side, walking north
        if (!cells.has(cellKey(i, j + 1)))
            put(cellKey(i + 1, j + 1), [i, j + 1]); // north side, walking west
        if (!cells.has(cellKey(i - 1, j)))
            put(cellKey(i, j + 1), [i, j]); // west side, walking south
    }
    const start = edges.keys().next().value;
    const walk = [parse(start)];
    let cur = edges.get(start);
    let steps = 1;
    while (cellKey(cur[0], cur[1]) !== start) {
        walk.push(cur);
        cur = edges.get(cellKey(cur[0], cur[1]));
        if (!cur || ++steps > n)
            throw new Error("outline: boundary is not one loop - a hole survived");
    }
    if (steps !== n)
        throw new Error("outline: boundary is not one loop - a hole survived");
    // merge collinear runs (lattice coords are integers, so exact), then scale to metres
    const merged = walk.filter((p, ix) => {
        const a = walk[(ix - 1 + walk.length) % walk.length], b = walk[(ix + 1) % walk.length];
        return (a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]) !== 0;
    });
    const pts = merged.map(([i, j]) => [r2(i * cell), r2(j * cell)]);
    if (!isSimplePolygon(pts))
        throw new Error("outline: emitted a non-simple polygon");
    return pts;
}
/** The lattice cells whose CENTRE falls inside the polygon - outline()'s exact inverse for
 *  lattice-rectilinear shapes, and the "convert to tiles" preview for everything else. */
export function rasterize(points, cell = CELL_M) {
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const i0 = Math.floor(Math.min(...xs) / cell), i1 = Math.ceil(Math.max(...xs) / cell);
    const j0 = Math.floor(Math.min(...ys) / cell), j1 = Math.ceil(Math.max(...ys) / cell);
    const out = new Set();
    for (let i = i0; i < i1; i++)
        for (let j = j0; j < j1; j++) {
            if (pointInPolygon((i + 0.5) * cell, (j + 0.5) * cell, points))
                out.add(cellKey(i, j));
        }
    return out;
}
/** Was this region painted (or paintable losslessly)? Every edge axis-parallel AND every vertex on a
 *  SINGLE paint grid - metric (0.30 m) OR imperial (1 ft). Checking both keeps a bed painted under one
 *  unit setting re-paintable after a switch. True of painted beds and on-lattice rects; false for
 *  rotated rects, 32-gon circles, and free traces (those keep their legacy editors). */
export function isLattice(region) {
    const pts = regionPoints(region);
    for (let a = 0; a < pts.length; a++) {
        const p = pts[a], q = pts[(a + 1) % pts.length];
        if (p[0] !== q[0] && p[1] !== q[1])
            return false; // a diagonal edge - not rectilinear
    }
    const onGrid = (cell) => pts.every(([x, y]) => Math.abs(x / cell - Math.round(x / cell)) < 0.017 && Math.abs(y / cell - Math.round(y / cell)) < 0.017);
    return onGrid(METRIC_CELL_M) || onGrid(IMPERIAL_CELL_M); // ±0.005 m on either grid
}
