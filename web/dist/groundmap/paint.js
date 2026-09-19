import { isSimplePolygon, regionPoints } from "../engine/regions.js";
import { pointInPolygon } from "./geometry.js";
export const METRIC_CELL_M = 0.30;
export const IMPERIAL_CELL_M = 0.3048;
export const CELL_M = METRIC_CELL_M;
export const cellKey = (i, j) => `${i},${j}`;
const parse = (k) => k.split(",").map(Number);
const nbrs = (i, j) => [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
const r2 = (v) => Math.round(v * 100) / 100;
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
export function canPaint(cells, i, j) {
    return cells.size === 0 || nbrs(i, j).some(([a, b]) => cells.has(cellKey(a, b)));
}
export function canErase(cells, i, j) {
    if (!cells.has(cellKey(i, j)))
        return false;
    if (cells.size === 1)
        return true;
    const rest = new Set(cells);
    rest.delete(cellKey(i, j));
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
            return true;
        for (const [x, y] of nbrs(a, b)) {
            const k = cellKey(x, y);
            if (!rest.has(k) && !empt.has(k)) {
                empt.add(k);
                q2.push([x, y]);
            }
        }
    }
    return false;
}
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
export function outline(cells, cell = CELL_M) {
    if (!cells.size)
        throw new Error("outline: empty cell set");
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
            put(cellKey(i, j), [i + 1, j]);
        if (!cells.has(cellKey(i + 1, j)))
            put(cellKey(i + 1, j), [i + 1, j + 1]);
        if (!cells.has(cellKey(i, j + 1)))
            put(cellKey(i + 1, j + 1), [i, j + 1]);
        if (!cells.has(cellKey(i - 1, j)))
            put(cellKey(i, j + 1), [i, j]);
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
    const merged = walk.filter((p, ix) => {
        const a = walk[(ix - 1 + walk.length) % walk.length], b = walk[(ix + 1) % walk.length];
        return (a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]) !== 0;
    });
    const pts = merged.map(([i, j]) => [r2(i * cell), r2(j * cell)]);
    if (!isSimplePolygon(pts))
        throw new Error("outline: emitted a non-simple polygon");
    return pts;
}
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
export function isLattice(region) {
    const pts = regionPoints(region);
    for (let a = 0; a < pts.length; a++) {
        const p = pts[a], q = pts[(a + 1) % pts.length];
        if (p[0] !== q[0] && p[1] !== q[1])
            return false;
    }
    const onGrid = (cell) => pts.every(([x, y]) => Math.abs(x / cell - Math.round(x / cell)) < 0.017 && Math.abs(y / cell - Math.round(y / cell)) < 0.017);
    return onGrid(METRIC_CELL_M) || onGrid(IMPERIAL_CELL_M);
}
