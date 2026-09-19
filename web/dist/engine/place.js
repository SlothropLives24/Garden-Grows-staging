import { circleFitsRect, convexClip, polygonArea, polygonCentroid, polygonIntersectArea, regionPoints } from "./regions.js";
import { heightOrderingViolations, polarIsNorth } from "./solar.js";
function heightCm(p) {
    const h = p.height_cm;
    if (Array.isArray(h))
        return h[h.length - 1];
    return h != null ? h : 0;
}
function spreadCm(p) {
    let s = p.spread_cm;
    if (Array.isArray(s))
        s = s.length ? s[s.length - 1] : undefined;
    let spread = s != null ? s : 30;
    if (spread < 30)
        spread = 30;
    return spread;
}
function count(p) {
    const c = Math.trunc(Number(p.count));
    return Number.isFinite(c) && c >= 1 ? c : 1;
}
function weight(p, capCm) {
    let s = spreadCm(p);
    if (capCm !== undefined)
        s = Math.min(s, capCm);
    return count(p) * s * s;
}
const round4 = (x) => Math.floor(x * 1e4 + 0.5) / 1e4;
function ringIndex(p) {
    if (p.ring == null)
        return null;
    const r = Math.trunc(Number(p.ring));
    return Number.isFinite(r) ? r : null;
}
function ringPositions(cx, cy, radius, cnt, spreadCmVal, angle0 = 0) {
    const pr = Math.max(spreadCmVal / 100, 0.30) / 2;
    const cells = [];
    if (radius <= 1e-9) {
        if (cnt <= 1)
            return [{ x: round4(cx), y: round4(cy), r: round4(pr) }];
        const cluster = pr < 0.35 ? pr : 0.35;
        for (let k = 0; k < cnt; k++) {
            const a = angle0 + 2 * Math.PI * k / cnt;
            cells.push({ x: round4(cx + cluster * Math.cos(a)), y: round4(cy + cluster * Math.sin(a)), r: round4(pr) });
        }
        return cells;
    }
    for (let k = 0; k < cnt; k++) {
        const a = angle0 + 2 * Math.PI * k / cnt;
        cells.push({ x: round4(cx + radius * Math.cos(a)), y: round4(cy + radius * Math.sin(a)), r: round4(pr) });
    }
    return cells;
}
function placeRings(plants, region) {
    const reg = region;
    const R = Number(reg.r ?? 0);
    const cx = Number(reg.cx ?? 0);
    const cy = Number(reg.cy ?? 0);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const indexed = ordered.map((p, i) => [ringIndex(p) ?? i, p]);
    const maxRing = indexed.reduce((m, [ri]) => Math.max(m, ri), 0);
    indexed.sort((A, B) => A[0] - B[0] || heightCm(B[1]) - heightCm(A[1]) || String(A[1].id).localeCompare(String(B[1].id)));
    let canopyPr = 0;
    for (const [ri, p] of indexed) {
        if (ri <= 0)
            canopyPr = Math.max(canopyPr, Math.max(spreadCm(p) / 100, 0.30) / 2);
    }
    const base = R > 0 ? Math.min(canopyPr, 0.6 * R) : 0;
    const zones = indexed.map(([ri, p]) => {
        const cnt = count(p);
        let radius = ri <= 0 ? 0 : base + (R - base) * ri / Math.max(1, maxRing);
        const pr = Math.max(spreadCm(p) / 100, 0.30) / 2;
        if (radius + pr > R)
            radius = R > pr + 0.0001 ? R - pr - 0.0001 : 0;
        return {
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cnt * (spreadCm(p) / 100) ** 2),
            centroid: [round4(cx), round4(cy)], height_cm: heightCm(p),
            count: cnt, plants: ringPositions(cx, cy, radius, cnt, spreadCm(p), ri <= 0 ? 0 : (2.399963229728653 * ri) % (2 * Math.PI)),
            ring: { cx: round4(cx), cy: round4(cy), r: round4(radius) },
        };
    });
    return { polar: "radial", zones, violations: [] };
}
function mostInteriorPoint(pts, rx0, width, yLo, height) {
    let best = null, bestD2 = 0;
    for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
            const x = rx0 + (i + 0.5) * width / 25;
            const y = yLo + (j + 0.5) * height / 25;
            if (pointInPolygon(pts, x, y)) {
                const d2 = minEdgeDistSq(pts, x, y);
                if (d2 > bestD2) {
                    bestD2 = d2;
                    best = [x, y];
                }
            }
        }
    }
    return { best, d2: bestD2 };
}
export function circleFitsRegion(ring, region) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), w = Math.max(...xs) - rx0;
    const y0 = Math.min(...ys), h = Math.max(...ys) - y0;
    if (region.shape !== "polygon")
        return circleFitsRect({ shape: "radial_rings", cx: 0, cy: 0, r: ring.r }, w, h);
    const { d2 } = mostInteriorPoint(pts, rx0, w, y0, h);
    return d2 >= ring.r * ring.r;
}
function placeOrchard(plants, region, treeR) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const clipPts = region.shape === "polygon" ? pts : null;
    const canopyDia = plants.reduce((mx, p) => Math.max(mx, spreadCm(p) / 100), 0);
    const spacing = treeR > 0 ? Math.max(2 * treeR, canopyDia) : Math.max(width, height);
    const ncols = spacing > 0 ? Math.max(1, Math.trunc(width / spacing)) : 1;
    const nrows = spacing > 0 ? Math.max(1, Math.trunc(height / spacing)) : 1;
    const cellW = width / ncols, cellH = height / nrows;
    const treeCenters = [];
    for (let r = 0; r < nrows; r++) {
        const n = hexRowCap(ncols, r);
        const xstart = rx0 + (width - n * cellW) / 2;
        for (let c = 0; c < n; c++) {
            const tx = xstart + (c + 0.5) * cellW, ty = yLo + (r + 0.5) * cellH;
            if (clipPts === null || pointInPolygon(clipPts, tx, ty))
                treeCenters.push([tx, ty]);
        }
    }
    if (!treeCenters.length && clipPts !== null) {
        const { best } = mostInteriorPoint(pts, rx0, width, yLo, height);
        if (best)
            treeCenters.push(best);
    }
    const ntrees = treeCenters.length;
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const indexed = ordered.map((p, i) => [ringIndex(p) ?? i, p]);
    const maxRing = indexed.reduce((m, [ri]) => Math.max(m, ri), 0);
    indexed.sort((A, B) => A[0] - B[0] || heightCm(B[1]) - heightCm(A[1]) || String(A[1].id).localeCompare(String(B[1].id)));
    const rOuter = treeR > 0 ? 0.9 * Math.min(treeR, 0.5 * Math.min(cellW, cellH)) : 0;
    const zones = [];
    const ringsGuide = [];
    const seen = new Set();
    for (const [ri, p] of indexed) {
        const radius = ri <= 0 ? 0 : rOuter * ri / Math.max(1, maxRing);
        const perTree = ri <= 0 ? treeCenters.map(() => 1) : evenPick(count(p), ntrees);
        const cells = [];
        for (let ti = 0; ti < ntrees; ti++) {
            const nHere = perTree[ti];
            if (nHere <= 0)
                continue;
            const [tx, ty] = treeCenters[ti];
            const canopy = radius <= 1e-9;
            for (const cell of ringPositions(tx, ty, radius, nHere, spreadCm(p))) {
                const keep = canopy
                    ? pointInPolygon(pts, cell.x, cell.y)
                    : clipPts !== null
                        ? dotInPolygon(pts, cell.x, cell.y, cell.r)
                        : (pointInPolygon(pts, cell.x, cell.y)
                            && rx0 + cell.r <= cell.x && cell.x <= rx1 - cell.r
                            && yLo + cell.r <= cell.y && cell.y <= yHi - cell.r);
                if (keep)
                    cells.push(cell);
            }
            const key = `${ti}:${round4(radius)}`;
            if (radius > 1e-9 && !seen.has(key)) {
                seen.add(key);
                ringsGuide.push({ cx: round4(tx), cy: round4(ty), r: round4(radius) });
            }
        }
        const cx = cells.length ? cells.reduce((s, cc) => s + cc.x, 0) / cells.length : (rx0 + rx1) / 2;
        const cy = cells.length ? cells.reduce((s, cc) => s + cc.y, 0) / cells.length : (yLo + yHi) / 2;
        zones.push({
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: [round4(cx), round4(cy)], height_cm: heightCm(p),
            count: cells.length, plants: cells,
        });
    }
    const trees = treeCenters.map(([tx, ty]) => ({ cx: round4(tx), cy: round4(ty) }));
    return { polar: "orchard", zones, violations: [], trees, rings_guide: ringsGuide };
}
const MIN_ROW_SPACING_M = 0.30;
const HILL_SPACING_M = 1.0;
const HILL_CLUSTER_R = 0.2;
const MOUND_GUIDE_R = 0.35;
const ALLEY_PERIOD = 3;
function isMound(p) {
    return Boolean(p.mound);
}
function evenPick(n, k) {
    if (k <= 0)
        return [];
    const out = [];
    for (let i = 0; i < k; i++)
        out.push(Math.floor((i + 1) * n / k) - Math.floor(i * n / k));
    return out;
}
function moundCap(sp) {
    const c = Math.trunc(Number(sp.mound_cap));
    return Number.isFinite(c) && c > 0 ? c : 0;
}
function clusterFitR(x, y, pr, rx0, rx1, yLo, yHi, clipPts) {
    let room;
    if (clipPts !== null) {
        const d2 = minEdgeDistSq(clipPts, x, y);
        if (d2 >= pr * pr - 1e-9)
            return pr;
        room = Math.sqrt(d2) - 0.01;
    }
    else {
        room = Math.min(x - rx0, rx1 - x, y - yLo, yHi - y);
        if (room >= pr - 1e-9)
            return pr;
        room -= 0.01;
    }
    const floor = pr * EDGE_MIN_FRAC;
    return room > floor ? room : floor;
}
function hillCells(centers, species, clusterR, rx0, rx1, yLo, yHi, clipPts) {
    const k = centers.length;
    const alloc = new Map();
    for (const sp of species) {
        const cap = moundCap(sp);
        alloc.set(sp.id, evenPick(count(sp), k).map((a) => (cap ? Math.min(a, cap) : a)));
    }
    const cells = new Map();
    for (const sp of species)
        cells.set(sp.id, []);
    for (let ci = 0; ci < centers.length; ci++) {
        const [hx, hy] = centers[ci];
        const tokens = [];
        for (const sp of species) {
            const n = alloc.get(sp.id)[ci];
            for (let t = 0; t < n; t++)
                tokens.push(sp);
        }
        const m = tokens.length;
        for (let j = 0; j < m; j++) {
            const sp = tokens[j];
            const pr = Math.max(spreadCm(sp) / 100, 0.30) / 2;
            let x, y;
            if (m <= 1) {
                x = round4(hx);
                y = round4(hy);
            }
            else {
                const a = 2 * Math.PI * j / m;
                x = round4(hx + clusterR * Math.cos(a));
                y = round4(hy + clusterR * Math.sin(a));
            }
            cells.get(sp.id).push({ x, y, r: round4(clusterFitR(x, y, pr, rx0, rx1, yLo, yHi, clipPts)) });
        }
    }
    return cells;
}
function meanCentroid(cells, fallback) {
    if (!cells.length)
        return [round4(fallback[0]), round4(fallback[1])];
    let sx = 0, sy = 0;
    for (const c of cells) {
        sx += c.x;
        sy += c.y;
    }
    return [round4(sx / cells.length), round4(sy / cells.length)];
}
function interleave(gapSpecies) {
    const remaining = gapSpecies.map((sp) => [String(sp.id), count(sp)]);
    const tokens = [];
    while (remaining.some(([, c]) => c > 0)) {
        for (const pair of remaining) {
            if (pair[1] > 0) {
                tokens.push(pair[0]);
                pair[1] -= 1;
            }
        }
    }
    return tokens;
}
function evenIndex(j, k, n) {
    if (k <= 1)
        return Math.floor((n - 1) / 2);
    return Math.floor((j * (n - 1) + Math.floor((k - 1) / 2)) / (k - 1));
}
function spreadAssign(counts, p) {
    const total = counts.reduce((s, c) => s + c, 0);
    const cap = Math.min(p, total);
    const placed = counts.map(() => 0);
    const out = [];
    for (let i = 0; i < cap; i++) {
        let best = -1, bestNum = 0;
        for (let j = 0; j < counts.length; j++) {
            if (placed[j] >= counts[j])
                continue;
            const num = counts[j] * (i + 1) - placed[j] * total;
            if (best < 0 || num > bestNum) {
                best = j;
                bestNum = num;
            }
        }
        if (best < 0)
            break;
        out.push(best);
        placed[best] += 1;
    }
    return out;
}
function gapPlantCells(gapSpecies, hillCenters, ncols, nrows, rx0, rx1, yLo, yHi, cellW, cellH, clipPts, alley, laneAxis, moundR) {
    const cells = new Map();
    for (const sp of gapSpecies)
        cells.set(String(sp.id), []);
    const total = gapSpecies.reduce((s, sp) => s + count(sp), 0);
    if (total <= 0 || !gapSpecies.length)
        return cells;
    const nc = ncols - 1, nr = nrows - 1;
    let points = [];
    let dotR = round4(Math.min(cellW, cellH) * 0.30);
    const laneLo0 = laneAxis === "x" ? rx0 : yLo;
    const laneCellSpan = laneAxis === "x" ? cellW : cellH;
    const laneSpans = [...alley].sort((a, b) => a - b).map((i) => [laneLo0 + i * laneCellSpan, laneLo0 + (i + 1) * laneCellSpan]);
    const inLane = (x, y, r) => {
        const v = laneAxis === "x" ? x : y;
        const m = Math.min(r, PATH_INSET_MAX_M);
        return laneSpans.some(([lo, hi]) => v + m > lo && v - m < hi);
    };
    const ringPoints = () => {
        dotR = round4(Math.min(cellW, cellH) * 0.12);
        const ringR = moundR + dotR + 0.05;
        const alloc = hillCenters.length ? evenPick(total, hillCenters.length) : [];
        for (let mi = 0; mi < hillCenters.length; mi++) {
            const [hx, hy] = hillCenters[mi];
            const k = alloc[mi];
            for (let m = 0; m < k; m++) {
                const a = 2 * Math.PI * (m + 0.5) / k;
                for (let s = 0; s < RING_SWEEP_STEPS; s++) {
                    const aa = a + 2 * Math.PI * s / RING_SWEEP_STEPS;
                    const x = round4(hx + ringR * Math.cos(aa)), y = round4(hy + ringR * Math.sin(aa));
                    if (rx0 + dotR <= x && x <= rx1 - dotR && yLo + dotR <= y && y <= yHi - dotR
                        && !inLane(x, y, dotR)
                        && (clipPts === null || dotInPolygon(clipPts, x, y, dotR))) {
                        points.push([x, y, dotR]);
                        break;
                    }
                }
            }
        }
    };
    const gapFitR = (x, y) => {
        const d = hillCenters.length
            ? Math.min(...hillCenters.map(([hx, hy]) => Math.hypot(x - hx, y - hy))) : Infinity;
        const room = d - (moundR - 0.01);
        if (room >= dotR - 1e-9)
            return dotR;
        const rr = room - 0.01;
        const floor = dotR * EDGE_MIN_FRAC;
        return rr > floor ? rr : null;
    };
    if (nc >= 1 && nr >= 1) {
        const safeR = [];
        for (let r = 0; r < nr; r++)
            if (laneAxis !== "y" || (!alley.has(r) && !alley.has(r + 1)))
                safeR.push(r);
        const safeC = [];
        for (let c = 0; c < nc; c++)
            if (laneAxis !== "x" || (!alley.has(c) && !alley.has(c + 1)))
                safeC.push(c);
        let gapTarget = total;
        if (clipPts !== null) {
            const ca = polygonArea(clipPts);
            if (ca > 0) {
                const ratio = ((rx1 - rx0) * (yHi - yLo)) / ca;
                if (ratio > 1.0 + 1e-9)
                    gapTarget = Math.ceil(total * ratio);
            }
        }
        if (safeC.length && safeR.length) {
            let [gc, gr] = gridDims(gapTarget, 1.0, safeC.length, safeR.length);
            gc = Math.min(gc, safeC.length);
            gr = Math.min(gr, safeR.length);
            for (let k = 0; k < gr; k++) {
                const r = safeR[evenIndex(k, gr, safeR.length)];
                for (let j = 0; j < gc; j++) {
                    const c = safeC[evenIndex(j, gc, safeC.length)];
                    const x = rx0 + (c + 1) * cellW, y = yLo + (r + 1) * cellH;
                    const rr = gapFitR(x, y);
                    if (rr !== null && (clipPts === null || dotInPolygon(clipPts, x, y, rr)))
                        points.push([round4(x), round4(y), round4(rr)]);
                }
            }
        }
        if (!points.length && hillCenters.length)
            ringPoints();
    }
    else {
        ringPoints();
    }
    if (clipPts !== null && points.length > total) {
        points = Array.from({ length: total }, (_, i) => points[Math.floor(i * points.length / total)]);
    }
    const idx = spreadAssign(gapSpecies.map((sp) => count(sp)), points.length);
    for (let i = 0; i < idx.length; i++) {
        cells.get(String(gapSpecies[idx[i]].id)).push({ x: points[i][0], y: points[i][1], r: points[i][2] });
    }
    return cells;
}
function placeHills(plants, region, structure, laneFlip = false) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const ncols = Math.max(1, Math.trunc(width / HILL_SPACING_M));
    const nrows = Math.max(1, Math.trunc(height / HILL_SPACING_M));
    const cellW = width / ncols, cellH = height / nrows;
    const clipPts = region.shape === "polygon" ? pts : null;
    const byHeight = (a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id));
    let moundSpecies = plants.filter(isMound).sort(byHeight);
    let gapSpecies = plants.filter((p) => !isMound(p)).sort(byHeight);
    if (!moundSpecies.length) {
        moundSpecies = gapSpecies;
        gapSpecies = [];
    }
    const maxMoundPr = moundSpecies.length
        ? Math.max(...moundSpecies.map((sp) => Math.max(spreadCm(sp) / 100, 0.30) / 2)) : MOUND_GUIDE_R;
    const moundR = Math.max(MOUND_GUIDE_R, HILL_CLUSTER_R + maxMoundPr) + 0.01;
    const keepR = HILL_CLUSTER_R + maxMoundPr * EDGE_MIN_FRAC + 0.01;
    let laneAxis = width < height ? "x" : "y";
    if (laneFlip)
        laneAxis = laneAxis === "x" ? "y" : "x";
    const nAlong = laneAxis === "x" ? ncols : nrows;
    const alleyIdx = new Set();
    if (structure === "field" && nAlong >= ALLEY_PERIOD && isRectangularBed(region)) {
        for (let i = 0; i < nAlong; i++)
            if (i % ALLEY_PERIOD === ALLEY_PERIOD - 1 && i !== nAlong - 1)
                alleyIdx.add(i);
    }
    const candidates = [];
    for (let r = 0; r < nrows; r++)
        for (let c = 0; c < ncols; c++) {
            if (alleyIdx.has(laneAxis === "x" ? c : r))
                continue;
            candidates.push([rx0 + (c + 0.5) * cellW, yLo + (r + 0.5) * cellH]);
        }
    let hillCenters = clipPts === null ? candidates : candidates.filter(([hx, hy]) => dotInPolygon(clipPts, hx, hy, keepR));
    if (!hillCenters.length && candidates.length && clipPts !== null) {
        const pool = [...candidates, [(rx0 + rx1) / 2, (yLo + yHi) / 2]];
        let best = pool[0], bestD = -Infinity;
        for (const [hx, hy] of pool) {
            const d = pointInPolygon(clipPts, hx, hy) ? minEdgeDistSq(clipPts, hx, hy) : -1;
            if (d > bestD) {
                bestD = d;
                best = [hx, hy];
            }
        }
        hillCenters = [best];
    }
    const moundCells = hillCells(hillCenters, moundSpecies, HILL_CLUSTER_R, rx0, rx1, yLo, yHi, clipPts);
    const gapCells = gapPlantCells(gapSpecies, hillCenters, ncols, nrows, rx0, rx1, yLo, yHi, cellW, cellH, clipPts, alleyIdx, laneAxis, moundR);
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = [...plants].sort(byHeight).map((p) => {
        const sid = String(p.id);
        const onMound = moundCells.has(sid);
        const cells = moundCells.get(sid) ?? gapCells.get(sid) ?? [];
        return {
            species: sid, y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells, mound: onMound,
        };
    });
    const guideRoom = (hx, hy) => clipPts ? Math.sqrt(minEdgeDistSq(clipPts, hx, hy)) : Math.min(hx - rx0, rx1 - hx, hy - yLo, yHi - hy);
    const mounds = hillCenters.map(([hx, hy]) => ({
        cx: round4(hx), cy: round4(hy),
        r: round4(Math.min(MOUND_GUIDE_R, Math.max(0, guideRoom(hx, hy) - 0.01))),
    }));
    return { polar: "hills", zones, violations: [], mounds };
}
function placeGrid(plants, region, latDeg, thresholdCm, band = true) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const north = polarIsNorth(latDeg);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const total = ordered.reduce((s, p) => s + count(p), 0);
    if (total <= 0)
        return { polar: north ? "north" : "south", zones: [], violations: [] };
    let minD = Math.max(...ordered.map((p) => spreadCm(p) / 100), 0.30);
    if (minD < 0.30)
        minD = 0.30;
    const heights = ordered.map((p) => heightCm(p)).sort((a, b) => a - b);
    const m = heights.length;
    const medianH = m % 2 ? heights[(m - 1) / 2] : (heights[m / 2 - 1] + heights[m / 2]) / 2;
    const isTall = (p) => heightCm(p) >= thresholdCm || heightCm(p) > 1.5 * medianH;
    const tall = ordered.filter((p) => band && isTall(p));
    const short = ordered.filter((p) => !(band && isTall(p)));
    const nTall = tall.reduce((s, p) => s + count(p), 0);
    const clipPts = region.shape === "polygon" ? pts : null;
    let nTarget = total;
    if (clipPts !== null) {
        const clipArea = polygonArea(pts);
        if (clipArea > 0) {
            const ratio = (width * height) / effectiveClipArea(pts, clipArea, total);
            if (ratio > 1.0 + 1e-9)
                nTarget = Math.ceil(total * ratio);
        }
    }
    minD = fillSpacing(minD, width, height, nTarget);
    let [cols, rows] = gridDims(nTarget, minD, width, height);
    if (nTall > cols) {
        const want = Math.min(nTall, Math.max(1, Math.trunc(width / MIN_ROW_SPACING_M)));
        if (want > cols) {
            cols = Math.min(want, nTarget);
            rows = Math.ceil(nTarget / cols);
        }
    }
    rows = hexRows(cols, rows, nTarget);
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let kept = [];
    let remaining = nTarget;
    if (clipPts !== null) {
        kept = placeChordRows(clipPts, rows, cellH, cellW, r, total, north ? yHi : yLo, north);
    }
    else {
        const perRow = [];
        let left = remaining;
        for (let row = 0; row < rows && left > 0; row++) {
            const take = Math.min(hexRowCap(cols, row), left);
            perRow.push(take);
            left -= take;
        }
        if (perRow.length >= 2 && perRow[perRow.length - 1] < 0.55 * hexRowCap(cols, perRow.length - 1)) {
            const tot2 = perRow[perRow.length - 2] + perRow[perRow.length - 1];
            perRow[perRow.length - 2] = tot2 - Math.floor(tot2 / 2);
            perRow[perRow.length - 1] = Math.floor(tot2 / 2);
        }
        for (let row = 0; row < perRow.length; row++) {
            const y = north ? yHi - (row + 0.5) * cellH : yLo + (row + 0.5) * cellH;
            const cap = hexRowCap(cols, row);
            const n = perRow[row];
            const soft = n < cap && n > 1;
            const step = soft ? width / n : cellW;
            const xstart = soft ? rx0 : rx0 + (width - n * cellW) / 2;
            for (let c = 0; c < n; c++) {
                const x = xstart + (c + 0.5) * step;
                kept.push({ x, y, r });
            }
        }
    }
    const orderIds = [];
    for (const p of tall)
        for (let t = 0; t < count(p); t++)
            orderIds.push(String(p.id));
    for (const id of interleave(short))
        orderIds.push(id);
    const cellsBy = new Map();
    for (const p of ordered)
        cellsBy.set(String(p.id), []);
    if (kept.length > total)
        kept = Array.from({ length: total }, (_, i) => kept[Math.floor(i * kept.length / total)]);
    for (let idx = 0; idx < kept.length; idx++)
        cellsBy.get(orderIds[idx]).push(kept[idx]);
    const tiledIds = new Set(short.map((p) => String(p.id)));
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = ordered.map((p) => {
        const cells = cellsBy.get(String(p.id));
        return {
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells, tiled: tiledIds.has(String(p.id)),
        };
    });
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
const TIER_TALL_CM = 90;
const TIER_LOW_CM = 35;
function tierOf(p) {
    const h = heightCm(p);
    return h >= TIER_TALL_CM ? 0 : (h >= TIER_LOW_CM ? 1 : 2);
}
function placeGraded(plants, region, latDeg, thresholdCm) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0;
    const north = polarIsNorth(latDeg);
    const isPoly = region.shape === "polygon";
    const tiers = new Map();
    for (const p of plants) {
        const t = tierOf(p);
        (tiers.get(t) ?? tiers.set(t, []).get(t)).push(p);
    }
    const order = [...tiers.keys()].sort((a, b) => a - b);
    const bands = order.map((t) => {
        const mem = tiers.get(t);
        const cnt = mem.reduce((s, p) => s + count(p), 0);
        const sp = Math.max(...mem.map((p) => spreadCm(p))) / 100;
        const cols = Math.max(1, Math.min(cnt, sp > 0 ? Math.floor(width / sp) : cnt));
        const rows = Math.max(1, Math.ceil(cnt / cols));
        return { mem, cnt, sp, rows };
    });
    const totalRows = bands.reduce((s, b) => s + b.rows, 0) || 1;
    const cellsBy = new Map();
    for (const p of plants)
        cellsBy.set(String(p.id), []);
    let cur = north ? yHi : yLo;
    for (const b of bands) {
        const depth = (yHi - yLo) * b.rows / totalRows;
        const bandLo = north ? cur - depth : cur, bandHi = north ? cur : cur + depth;
        const clipPts = isPoly ? pts : null;
        const clipArea = isPoly ? stripArea(pts, rx0 - 1.0, rx1 + 1.0, bandLo, bandHi) : null;
        const cells = grid(b.cnt, b.sp * 100, rx0, rx1, bandLo, bandHi, north, clipPts, clipArea);
        let toks;
        if (b.mem.some((p) => heightCm(p) >= thresholdCm)) {
            toks = [];
            for (const p of [...b.mem].sort((a, c) => heightCm(c) - heightCm(a) || String(a.id).localeCompare(String(c.id)))) {
                for (let k = 0; k < count(p); k++)
                    toks.push(String(p.id));
            }
        }
        else {
            toks = interleave(b.mem);
        }
        for (let i = 0; i < Math.min(cells.length, toks.length); i++)
            cellsBy.get(toks[i]).push(cells[i]);
        cur = north ? bandLo : bandHi;
    }
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = plants.map((p) => {
        const cells = cellsBy.get(String(p.id));
        const cys = cells.map((c) => c.y);
        return {
            species: String(p.id),
            y0: cys.length ? Math.min(...cys) : 0, y1: cys.length ? Math.max(...cys) : 0,
            polygon: [], area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells,
        };
    });
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
function pointInPolygon(pts, x, y) {
    let inside = false;
    const n = pts.length;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
            inside = !inside;
        j = i;
    }
    return inside;
}
function minEdgeDistSq(pts, x, y) {
    let best = Infinity;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[(i + 1) % n][0], by = pts[(i + 1) % n][1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        let t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
        if (t < 0)
            t = 0;
        else if (t > 1)
            t = 1;
        const px = ax + t * dx, py = ay + t * dy;
        const d2 = (x - px) * (x - px) + (y - py) * (y - py);
        if (d2 < best)
            best = d2;
    }
    return best;
}
function dotInPolygon(pts, x, y, r) {
    return pointInPolygon(pts, x, y) && minEdgeDistSq(pts, x, y) >= r * r - 1e-9;
}
const EDGE_MIN_FRAC = 0.35;
const RING_SWEEP_STEPS = 16;
function rowIntervals(pts, y) {
    const xs = [];
    const n = pts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y))
            xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let k = 0; k + 1 < xs.length; k += 2)
        out.push([xs[k], xs[k + 1]]);
    return out;
}
function placeChordRows(clipPts, rows, cellH, cellW, r, total, yStart, north) {
    const rMin = r * EDGE_MIN_FRAC;
    const segs = [];
    for (let row = 0; row < rows; row++) {
        const y = north ? yStart - (row + 0.5) * cellH : yStart + (row + 0.5) * cellH;
        for (const [ax, bx] of rowIntervals(clipPts, y)) {
            const usable = bx - ax - 2 * rMin;
            if (usable <= 0)
                continue;
            segs.push({ y, ax, n: Math.max(1, Math.trunc(usable / cellW)), usable, row });
        }
    }
    let cTotal = segs.reduce((s, g) => s + g.n, 0);
    while (cTotal > total) {
        let bi = -1;
        for (let i = 0; i < segs.length; i++)
            if (segs[i].n > 0 && (bi < 0 || segs[i].n > segs[bi].n))
                bi = i;
        if (bi < 0)
            break;
        segs[bi].n--;
        cTotal--;
    }
    const out = [];
    for (const g of segs) {
        if (g.n <= 0)
            continue;
        const step = g.usable / g.n;
        const shift = g.row % 2 ? 0.25 : -0.25;
        for (let c = 0; c < g.n; c++) {
            const x = g.ax + rMin + (c + 0.5 + shift) * step;
            const rr = edgeFitR(clipPts, x, g.y, r);
            if (rr !== null)
                out.push({ x, y: g.y, r: rr });
        }
    }
    return out;
}
function edgeFitR(pts, x, y, r) {
    if (!pointInPolygon(pts, x, y))
        return null;
    const d2 = minEdgeDistSq(pts, x, y);
    if (d2 >= r * r - 1e-9)
        return r;
    const d = Math.sqrt(d2) - 0.01;
    return d >= r * EDGE_MIN_FRAC ? d : null;
}
function effectiveClipArea(pts, area, count) {
    if (count <= 0 || area <= 0)
        return area;
    let perim = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const dx = pts[(i + 1) % n][0] - pts[i][0], dy = pts[(i + 1) % n][1] - pts[i][1];
        perim += Math.sqrt(dx * dx + dy * dy);
    }
    const rEst = 0.5 * Math.sqrt(area / count);
    const eff = area - perim * rEst * EDGE_MIN_FRAC;
    const floor = 0.25 * area;
    return eff > floor ? eff : floor;
}
function gridDims(cnt, minD, width, height) {
    if (cnt <= 1)
        return [1, 1];
    const maxCols = Math.max(1, Math.trunc(width / minD));
    const maxRows = Math.max(1, Math.trunc(height / minD));
    let best = null;
    for (let cols = 1; cols <= maxCols; cols++) {
        const rows = Math.ceil(cnt / cols);
        if (rows > maxRows && cols < maxCols)
            continue;
        const cw = width / cols;
        const ch = height / rows;
        const lo = cw <= ch ? cw : ch;
        const hi = cw <= ch ? ch : cw;
        const score = lo > 0 ? hi / lo : 1e18;
        if (best === null || score < best[0])
            best = [score, cols, rows];
    }
    return [best[1], best[2]];
}
function hexRowCap(cols, row) {
    if (row % 2 === 0)
        return cols;
    return cols > 1 ? cols - 1 : 1;
}
function hexCapacity(cols, rows) {
    let cap = 0;
    for (let r = 0; r < rows; r++)
        cap += hexRowCap(cols, r);
    return cap;
}
function hexRows(cols, rows, n) {
    while (hexCapacity(cols, rows) < n)
        rows++;
    return rows;
}
function fillSpacing(minD, width, height, cnt) {
    if (cnt > 0 && width > 0 && height > 0) {
        const natural = Math.sqrt(width * height / cnt);
        if (natural < minD)
            return natural;
    }
    return minD;
}
function grid(cnt, spreadCmVal, rx0, rx1, bandLo, bandHi, north, clipPts = null, clipArea = null) {
    if (cnt <= 0)
        return [];
    let minD = spreadCmVal / 100;
    if (minD < 0.30)
        minD = 0.30;
    const width = rx1 - rx0;
    const height = bandHi - bandLo;
    let nTarget = cnt;
    if (clipPts !== null && clipArea && clipArea > 0) {
        const ratio = (width * height) / effectiveClipArea(clipPts, clipArea, cnt);
        if (ratio > 1.0 + 1e-9)
            nTarget = Math.ceil(cnt * ratio);
    }
    minD = fillSpacing(minD, width, height, nTarget);
    let [cols, rows] = gridDims(nTarget, minD, width, height);
    rows = hexRows(cols, rows, nTarget);
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let cells = [];
    let remaining = nTarget;
    if (clipPts !== null) {
        cells = placeChordRows(clipPts, rows, cellH, cellW, r, cnt, north ? bandHi : bandLo, north);
    }
    else
        for (let row = 0; row < rows && remaining > 0; row++) {
            const y = north ? bandHi - (row + 0.5) * cellH : bandLo + (row + 0.5) * cellH;
            const n = Math.min(hexRowCap(cols, row), remaining);
            const xstart = rx0 + (width - n * cellW) / 2;
            for (let c = 0; c < n; c++) {
                const x = xstart + (c + 0.5) * cellW;
                cells.push({ x, y, r });
            }
            remaining -= n;
        }
    if (clipPts !== null && cells.length > cnt) {
        cells = Array.from({ length: cnt }, (_, i) => cells[Math.floor(i * cells.length / cnt)]);
    }
    return cells;
}
function stripArea(pts, x0, x1, y0, y1) {
    if (y1 <= y0)
        return 0;
    const strip = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return polygonIntersectArea(pts, strip);
}
function cellBlocked(x, y, occupied) {
    return occupied.some((o) => pointInPolygon(regionPoints(o), x, y));
}
function excludeOccupied(result, occupied) {
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => !cellBlocked(c.x, c.y, occupied));
        z.count = z.plants.length;
    }
    return result;
}
const FIELD_LANE_LAYOUTS = new Set(["rows", "grid", "graded"]);
const STRIP_MAX_M = 1.22;
export const PATH_M = 0.5;
const INGROUND_STRIP_MAX_M = 3.0;
const INGROUND_WORK_STRIP_M = 2.2;
const REACH_TOL_M = 0.015;
const PATH_INSET_MAX_M = 0.25;
function fieldBands(x0, x1, y0, y1, flip = false) {
    const width = x1 - x0, height = y1 - y0;
    let axis = width < height ? "x" : "y";
    if (flip)
        axis = axis === "x" ? "y" : "x";
    const span = axis === "x" ? width : height;
    const lo0 = axis === "x" ? x0 : y0;
    const n = Math.max(1, Math.trunc(span / HILL_SPACING_M));
    if (n < ALLEY_PERIOD)
        return { axis, bands: [] };
    const cell = span / n;
    const bands = [];
    for (let r = 0; r < n; r++)
        if (r % ALLEY_PERIOD === ALLEY_PERIOD - 1 && r !== n - 1)
            bands.push([lo0 + r * cell, lo0 + (r + 1) * cell]);
    return { axis, bands };
}
function pathBands(x0, x1, yLo, yHi, stripMax, workMax, flip = false) {
    const width = x1 - x0, height = yHi - yLo;
    if (Math.min(width, height) <= stripMax + REACH_TOL_M)
        return { axis: "y", bands: [] };
    const work = workMax ?? stripMax;
    let axis = width < height ? "x" : "y";
    if (flip)
        axis = axis === "x" ? "y" : "x";
    const span = axis === "x" ? width : height;
    const lo0 = axis === "x" ? x0 : yLo;
    const n = Math.ceil((span + PATH_M) / (work + PATH_M));
    if (n <= 1)
        return { axis, bands: [] };
    const stripW = (span - (n - 1) * PATH_M) / n;
    const bands = [];
    for (let k = 0; k < n - 1; k++) {
        const start = lo0 + (k + 1) * stripW + k * PATH_M;
        bands.push([start, start + PATH_M]);
    }
    return { axis, bands };
}
function dropCellsInBands(result, axis, bands) {
    if (!bands.length)
        return result;
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => { const v = axis === "x" ? c.x : c.y; const m = Math.min(c.r, PATH_INSET_MAX_M); return !bands.some(([lo, hi]) => v + m > lo && v - m < hi); });
        z.count = z.plants.length;
    }
    return result;
}
function reflowIntoStrips(result, axis, bands, lo, hi) {
    if (!bands.length)
        return result;
    const sorted = [...bands].map((b) => [b[0], b[1]]).sort((a, b) => a[0] - b[0]);
    const strips = [];
    let cur = lo;
    for (const [blo, bhi] of sorted) {
        if (blo > cur + 1e-9)
            strips.push([cur, blo]);
        cur = Math.max(cur, bhi);
    }
    if (hi > cur + 1e-9)
        strips.push([cur, hi]);
    if (!strips.length)
        return result;
    const coords = [...new Set(result.zones.flatMap((z) => z.plants.map((c) => (axis === "x" ? c.x : c.y))))].sort((a, b) => a - b);
    const R = coords.length;
    if (R < 1)
        return result;
    const dotR = Math.max(0, ...result.zones.flatMap((z) => z.plants.map((c) => c.r)));
    const spanTotal = strips.reduce((s, [s0, s1]) => s + (s1 - s0), 0);
    const halfPitch = spanTotal / (2.0 * R);
    const usable = strips.map(([s0, s1]) => { const m = Math.min(dotR, (s1 - s0) * 0.45, halfPitch); return [s0 + m, s1 - m]; });
    const totalUsable = usable.reduce((s, [a, b]) => s + (b - a), 0);
    if (totalUsable <= 0)
        return result;
    const pitch = totalUsable / R;
    const newPos = [];
    let cumLen = 0.0;
    let assigned = 0;
    for (const [a, b] of usable) {
        cumLen += b - a;
        const nI = Math.floor(R * cumLen / totalUsable + 0.5) - assigned;
        assigned += nI;
        const mid = (a + b) / 2.0;
        for (let t = 0; t < nI; t++)
            newPos.push(round4(mid + (t - (nI - 1) / 2.0) * pitch));
    }
    const map = new Map();
    coords.forEach((c, j) => map.set(c, newPos[j]));
    for (const z of result.zones)
        for (const cell of z.plants) {
            if (axis === "x")
                cell.x = map.get(cell.x);
            else
                cell.y = map.get(cell.y);
        }
    for (const z of result.zones)
        for (const cell of z.plants) {
            const v = axis === "x" ? cell.x : cell.y;
            for (const [s0, s1] of strips) {
                if (s0 - 1e-9 <= v && v <= s1 + 1e-9) {
                    const fit = Math.min(v - s0, s1 - v);
                    if (fit < cell.r)
                        cell.r = round4(fit);
                    break;
                }
            }
        }
    return result;
}
function openLanes(result, region, split) {
    const { axis, bands } = split;
    if (!bands.length)
        return result;
    if (region.shape !== "rect")
        return dropCellsInBands(result, axis, bands);
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const lo = axis === "x" ? Math.min(...xs) : Math.min(...ys);
    const hi = axis === "x" ? Math.max(...xs) : Math.max(...ys);
    return reflowIntoStrips(result, axis, bands, lo, hi);
}
function isRectangularBed(region) {
    if (region.shape === "rect")
        return true;
    if (region.shape === "polygon" && region.points.length === 4) {
        const p = region.points;
        const d1 = Math.hypot(p[0][0] - p[2][0], p[0][1] - p[2][1]);
        const d2 = Math.hypot(p[1][0] - p[3][0], p[1][1] - p[3][1]);
        const mx1 = (p[0][0] + p[2][0]) / 2, my1 = (p[0][1] + p[2][1]) / 2;
        const mx2 = (p[1][0] + p[3][0]) / 2, my2 = (p[1][1] + p[3][1]) / 2;
        return Math.abs(d1 - d2) < 1e-6 && Math.abs(mx1 - mx2) < 1e-6 && Math.abs(my1 - my2) < 1e-6;
    }
    return false;
}
function openFieldLanes(result, region, flip = false) {
    if (!isRectangularBed(region))
        return result;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return openLanes(result, region, fieldBands(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), flip));
}
function openStripPaths(result, region, stripMax, workMax, flip = false) {
    if (!isRectangularBed(region))
        return result;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return openLanes(result, region, pathBands(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), stripMax, workMax, flip));
}
export function accessBands(structure, region, flip = false) {
    if (!isRectangularBed(region))
        return [];
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (structure === "field") {
        const { axis, bands } = fieldBands(rx0, rx1, y0, y1, flip);
        return bands.map(([lo, hi]) => axis === "x"
            ? { x0: lo, y0, x1: hi, y1, kind: "lane" }
            : { x0: rx0, y0: lo, x1: rx1, y1: hi, kind: "lane" });
    }
    if (structure === "raised" || structure === "in_ground") {
        const { axis, bands } = structure === "raised"
            ? pathBands(rx0, rx1, y0, y1, STRIP_MAX_M, undefined, flip)
            : pathBands(rx0, rx1, y0, y1, INGROUND_STRIP_MAX_M, INGROUND_WORK_STRIP_M, flip);
        return bands.map(([lo, hi]) => axis === "x"
            ? { x0: lo, y0, x1: hi, y1, kind: "path" }
            : { x0: rx0, y0: lo, x1: rx1, y1: hi, kind: "path" });
    }
    return [];
}
export function accessBandPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return [];
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    return bands.map((b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
        .map(([x, y]) => orientedToPlot(x, y, f.effW, f.effL, f.residualDeg, f.cx, f.cy)));
}
export function plantableStripPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return [];
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    if (!bands.length)
        return [];
    const axisY = bands.every((b) => b.x0 <= 1e-9 && Math.abs(b.x1 - f.effW) <= 1e-9);
    const span = axisY ? f.effL : f.effW;
    const cuts = bands.map((b) => (axisY ? [b.y0, b.y1] : [b.x0, b.x1])).sort((a, b) => a[0] - b[0]);
    const strips = [];
    let cur = 0;
    for (const [lo, hi] of cuts) {
        if (lo > cur + 1e-9)
            strips.push([cur, lo]);
        cur = Math.max(cur, hi);
    }
    if (span > cur + 1e-9)
        strips.push([cur, span]);
    return strips.map((s) => {
        const [x0, x1, y0, y1] = axisY ? [0, f.effW, s[0], s[1]] : [s[0], s[1], 0, f.effL];
        return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            .map(([x, y]) => orientedToPlot(x, y, f.effW, f.effL, f.residualDeg, f.cx, f.cy));
    });
}
export function place(plants, region, latDeg, thresholdCm = 120, layoutKind = "rows", treeR = 0, band = true, occupied = [], structure, laneFlip = false) {
    let result = placeCore(plants, region, latDeg, thresholdCm, layoutKind, treeR, band, structure, laneFlip);
    if (occupied.length)
        result = excludeOccupied(result, occupied);
    if (region.shape !== "radial_rings") {
        if (FIELD_LANE_LAYOUTS.has(layoutKind)) {
            if (structure === "field")
                result = openFieldLanes(result, region, laneFlip);
            else if (structure === "raised")
                result = openStripPaths(result, region, STRIP_MAX_M, undefined, laneFlip);
            else if (structure === "in_ground")
                result = openStripPaths(result, region, INGROUND_STRIP_MAX_M, INGROUND_WORK_STRIP_M, laneFlip);
        }
        if (FIELD_LANE_LAYOUTS.has(layoutKind) || (layoutKind === "hills" && structure === "field")) {
            const bands = accessBands(structure, region, laneFlip);
            if (bands.length)
                result.access_bands = bands;
        }
    }
    return result;
}
function placeCore(plants, region, latDeg, thresholdCm = 120, layoutKind = "rows", treeR = 0, band = true, structure, laneFlip = false) {
    if (region.shape === "radial_rings")
        return placeRings(plants, region);
    if (layoutKind === "hills")
        return placeHills(plants, region, structure, laneFlip);
    if (layoutKind === "graded")
        return placeGraded(plants, region, latDeg, thresholdCm);
    if (layoutKind === "grid")
        return placeGrid(plants, region, latDeg, thresholdCm, band);
    if (layoutKind === "orchard")
        return placeOrchard(plants, region, treeR);
    if (layoutKind === "shelter")
        return placeShelter(plants, region, latDeg, thresholdCm);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    return placeBands(plants, ordered, region, latDeg, thresholdCm);
}
function placeShelter(plants, region, latDeg, thresholdCm) {
    const sheltered = plants.filter((p) => p.sheltered).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const rest = plants.filter((p) => !p.sheltered).sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    return placeBands(plants, [...sheltered, ...rest], region, latDeg, thresholdCm);
}
function placeBands(plants, ordered, region, latDeg, thresholdCm) {
    const pts = regionPoints(region);
    const total = polygonArea(pts);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs);
    const rx1 = Math.max(...xs);
    const x0 = rx0 - 1;
    const x1 = rx1 + 1;
    const yLo = Math.min(...ys);
    const yHi = Math.max(...ys);
    const north = polarIsNorth(latDeg);
    const isPoly = region.shape === "polygon";
    const bedCapCm = Math.min(rx1 - rx0, yHi - yLo) * 100.0;
    const weights = ordered.map((p) => weight(p, bedCapCm));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const zones = [];
    let cur = north ? yHi : yLo;
    for (let i = 0; i < ordered.length; i++) {
        const p = ordered[i];
        const share = wsum > 0 ? total * (weights[i] / wsum) : 0;
        let cut;
        if (i === ordered.length - 1) {
            cut = north ? yLo : yHi;
        }
        else {
            let lo = north ? yLo : cur;
            let hi = north ? cur : yHi;
            for (let it = 0; it < 50; it++) {
                const mid = (lo + hi) / 2;
                const a = north ? stripArea(pts, x0, x1, mid, cur) : stripArea(pts, x0, x1, cur, mid);
                if (north) {
                    if (a < share)
                        hi = mid;
                    else
                        lo = mid;
                }
                else {
                    if (a < share)
                        lo = mid;
                    else
                        hi = mid;
                }
            }
            cut = (lo + hi) / 2;
        }
        const bandLo = north ? cut : cur;
        const bandHi = north ? cur : cut;
        const strip = [[x0, bandLo], [x1, bandLo], [x1, bandHi], [x0, bandHi]];
        const poly = convexClip(pts, strip);
        const zoneArea = stripArea(pts, x0, x1, bandLo, bandHi);
        const c = poly.length >= 3 ? polygonCentroid(poly) : [(x0 + x1) / 2, (bandLo + bandHi) / 2];
        const cells = grid(count(p), spreadCm(p), rx0, rx1, bandLo, bandHi, north, isPoly ? poly : null, isPoly ? zoneArea : null);
        zones.push({
            species: String(p.id), y0: bandLo, y1: bandHi,
            polygon: poly.map((q) => [q[0], q[1]]), area_m2: zoneArea,
            centroid: [c[0], c[1]], height_cm: heightCm(p),
            count: cells.length, plants: cells,
        });
        cur = cut;
    }
    const byId = new Map(plants.map((p) => [String(p.id), p]));
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm,
        sheltered: !!byId.get(String(z.species))?.sheltered }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
export function orientRect(w, l, angleDeg) {
    const a = ((angleDeg % 360) + 360) % 360;
    const quarters = Math.floor((a + 45.0) / 90.0);
    const q = quarters % 4;
    const r = a - 90.0 * quarters;
    const swap = q % 2 === 1;
    return { eff_w: swap ? l : w, eff_l: swap ? w : l, poleward_edge: q, residual_deg: round4(r) };
}
export function orientedToPlot(x, y, effW, effL, residualDeg, cx, cy) {
    const dx = x - effW / 2.0, dy = y - effL / 2.0;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(cx + dx * c - dy * s), round4(cy + dx * s + dy * c)];
}
export function plotToOriented(px, py, effW, effL, residualDeg, cx, cy) {
    const rx = px - cx, ry = py - cy;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(rx * c + ry * s + effW / 2.0), round4(-rx * s + ry * c + effL / 2.0)];
}
export function bedFrame(bed) {
    const a = bed.rotation_deg;
    if (a && a % 360 !== 0 && bed.region.shape === "polygon" && bed.region.points.length === 4) {
        const p = bed.region.points;
        const r2 = (v) => Math.round(v * 100) / 100;
        const w = r2(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]));
        const l = r2(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]));
        const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
        const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
        const o = orientRect(w, l, a);
        return { cx, cy, effW: o.eff_w, effL: o.eff_l, residualDeg: o.residual_deg };
    }
    if (bed.region.shape === "rect") {
        const r = bed.region;
        return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, effW: Math.max(1e-6, r.w), effL: Math.max(1e-6, r.h), residualDeg: 0 };
    }
    const pts = regionPoints(bed.region);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, effW: Math.max(1e-6, x1 - x0), effL: Math.max(1e-6, y1 - y0), residualDeg: 0 };
}
export function framesEqual(a, b) {
    return Math.abs(a.cx - b.cx) < 1e-3 && Math.abs(a.cy - b.cy) < 1e-3 && Math.abs(a.effW - b.effW) < 1e-3
        && Math.abs(a.effL - b.effL) < 1e-3 && Math.abs((((a.residualDeg - b.residualDeg) % 360) + 360) % 360) < 1e-3;
}
function plotToFrac(px, py, f) {
    const dx = px - f.cx, dy = py - f.cy, t = -f.residualDeg * Math.PI / 180;
    const c = Math.cos(t), s = Math.sin(t);
    return [((dx * c - dy * s) + f.effW / 2) / f.effW, ((dx * s + dy * c) + f.effL / 2) / f.effL];
}
function fracToPlot(fx, fy, f) {
    const lx = fx * f.effW - f.effW / 2, ly = fy * f.effL - f.effL / 2, t = f.residualDeg * Math.PI / 180;
    const c = Math.cos(t), s = Math.sin(t), r2 = (v) => Math.round(v * 100) / 100;
    return [r2(f.cx + lx * c - ly * s), r2(f.cy + lx * s + ly * c)];
}
export function remapRegionBetweenBeds(region, oldBed, newBed) {
    const oldF = bedFrame(oldBed), newF = bedFrame(newBed);
    return { shape: "polygon", points: regionPoints(region).map((p) => {
            const [fx, fy] = plotToFrac(p[0], p[1], oldF);
            return fracToPlot(fx, fy, newF);
        }) };
}
