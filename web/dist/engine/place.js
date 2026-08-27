// Placement (Phase 3 / F2) - line-for-line port of engine/place.py, same operation order so
// float results (bisection cuts included) match the season-log golden exactly. DOM-free.
//
// place() bands a region along the sun axis - tallest plants poleward so their noon shadow
// falls off the bed (R-003's mechanism applied constructively) - each band sized to the
// plant's share of ground (spread², 30 cm floor). The proposal then runs R-003's own checker
// over its zone centroids and returns the result: the engine grades its own homework.
// Greedy heuristic by design - no solver (ISSUES#8), no drag-and-drop (the roadmap's line).
import { circleFitsRect, convexClip, polygonArea, polygonCentroid, polygonIntersectArea, regionPoints } from "./regions.js";
import { heightOrderingViolations, polarIsNorth } from "./solar.js";
function heightCm(p) {
    const h = p.height_cm;
    if (Array.isArray(h))
        return h[h.length - 1];
    return h != null ? h : 0;
}
// A plant's mature spread in cm (30 cm floor) - the in-row spacing the grid lays plants at.
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
// The band sizes to the planting: count·spread² (D-054). `capCm` bounds the spread at the bed's own
// shorter side (maintainer, 2026-08-21): a 4 m vining squash in a 2 m bed cannot claim 16 m² of
// ground the bed does not hold — uncapped, one optional cover crop took 85% of the tomatillo guild's
// diagram and crushed the namesake pair into a 17 cm ribbon. Port of place.py _weight.
function weight(p, capCm) {
    let s = spreadCm(p);
    if (capCm !== undefined)
        s = Math.min(s, capCm);
    return count(p) * s * s;
}
// --- rings archetype (D-056) - port of place.py _place_rings / _ring_positions -------------------
// floor(x*1e4 + 0.5), NOT Math.round: identical to place.py _round4, including −0 (Math.round(−tiny)
// is −0, which would disagree with Python) and the half-up boundary (Python round() is half-to-even).
const round4 = (x) => Math.floor(x * 1e4 + 0.5) / 1e4;
function ringIndex(p) {
    if (p.ring == null)
        return null;
    const r = Math.trunc(Number(p.ring));
    return Number.isFinite(r) ? r : null;
}
function ringPositions(cx, cy, radius, cnt, spreadCmVal, angle0 = 0) {
    // angle0 rotates the whole ring - staggered per ring index by the caller so sparse rings do not
    // pile up on the same side (the 2026-08-12 maintainer report). Mirrors place.py.
    const pr = Math.max(spreadCmVal / 100, 0.30) / 2;
    const cells = [];
    if (radius <= 1e-9) {
        if (cnt <= 1)
            return [{ x: round4(cx), y: round4(cy), r: round4(pr) }];
        // tuck multiple centre plants JUST off the trunk; cap the offset at 0.35m so a big tree (large pr)
        // doesn't fling them out to a ring with an empty middle. Mirrors place.py.
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
    // Rings start at the CENTRE PLANT'S EDGE, capped at 60% of the drip circle - mirrors place.py
    // (the bulb ring must not land inside the canopy; the understory keeps an honest band).
    let canopyPr = 0;
    for (const [ri, p] of indexed) {
        if (ri <= 0)
            canopyPr = Math.max(canopyPr, Math.max(spreadCm(p) / 100, 0.30) / 2);
    }
    const base = R > 0 ? Math.min(canopyPr, 0.6 * R) : 0;
    const zones = indexed.map(([ri, p]) => {
        const cnt = count(p);
        let radius = ri <= 0 ? 0 : base + (R - base) * ri / Math.max(1, maxRing);
        // Keep the WHOLE dot inside the drip circle: a ring at radius R put its dots' bodies (draw radius
        // pr) a full pr past the edge. Pull any ring in so radius + pr <= R (same pr formula ringPositions
        // uses). The ring circle drawn by the DOM uses this capped radius too. Mirrors place.py.
        const pr = Math.max(spreadCm(p) / 100, 0.30) / 2;
        // Inset by one 4dp rounding quantum too - containment must hold AFTER round4 (mirrors place.py).
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
// --- orchard archetype (D-058) - port of place.py _place_orchard --------------------------------
// A woody guild on a large plot becomes a grid of trees (2·treeR apart), each with its own rings.
// The most-interior point of a polygon, found on a fixed 25x25 lattice over its bounding box -
// coarse but DETERMINISTIC and identical in both engines (multiplication/division only; 25 is ODD,
// so the bbox centre is itself a lattice point and a centred circle measures true). Returns
// {best, d2} with d2 the squared edge clearance; best null when no lattice point is inside. Shared
// by circleFitsRegion (the honest tree-guild gate, fill review F-6) and the orchard's empty-tiling
// fallback. Port of place.py _most_interior_point.
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
// Does the drip-line circle fit anywhere INSIDE the region's actual outline? A rect defers to
// circleFitsRect (exact); a polygon takes the most-interior lattice point's clearance - coarse but
// deterministic, erring toward honesty. Fill review F-6: the dwarf fruit guild 'fit' a 4x4 L-shape
// by bounding-box area, then placed ZERO plants - neither 2 m arm holds its 3.4 m ring; the card
// must grey with the reason instead. Port of place.py circle_fits_region.
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
    // Never tile trees tighter than their real canopy. treeR is derived from the guild footprint,
    // which can UNDER-size the actual species: a standard apple spreads ~6 m, but a small-footprint
    // guild (footprint_min_m2 = 9 -> drip r ~1.7 m) would space trees ~3.4 m apart and pack three
    // overlapping 6 m canopies into a 7 m bed. Clear the LARGER of the footprint spacing and the true
    // canopy diameter, so a bed that fits only one tree gets exactly one (D-058; the outline invariant).
    const canopyDia = plants.reduce((mx, p) => Math.max(mx, spreadCm(p) / 100), 0);
    const spacing = treeR > 0 ? Math.max(2 * treeR, canopyDia) : Math.max(width, height);
    const ncols = spacing > 0 ? Math.max(1, Math.trunc(width / spacing)) : 1;
    const nrows = spacing > 0 ? Math.max(1, Math.trunc(height / spacing)) : 1;
    const cellW = width / ncols, cellH = height / nrows;
    const treeCenters = []; // quincunx - the classic staggered orchard (D-060)
    for (let r = 0; r < nrows; r++) {
        const n = hexRowCap(ncols, r);
        const xstart = rx0 + (width - n * cellW) / 2;
        for (let c = 0; c < n; c++) {
            const tx = xstart + (c + 0.5) * cellW, ty = yLo + (r + 0.5) * cellH;
            if (clipPts === null || pointInPolygon(clipPts, tx, ty))
                treeCenters.push([tx, ty]);
        }
    }
    // Fill review F-6: a guild the gate admitted must never place NOTHING. On a traced bed the single
    // tile's centre can miss the outline (an L-bed's notch corner is exactly the bbox centre), which
    // rendered an empty diagram on a card that said "fits". Seat the one tree at the most-interior
    // point instead - the same forced-placement courtesy a too-tight mound bed gets (D-088).
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
    // The understory ring field fits the smaller of the drip line and the cell, shrunk 10% for margin.
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
            // Understory dots must clear the outline whole (D-058) - a traced polygon checks the disc
            // against the outline itself (dotInPolygon); the bounding-box test let a dot poke past a
            // slanted or curved border whose bbox it cleared. The CANOPY (ring 0) is exempt - its centre
            // is inside and the canopy overhangs, so clipping it would drop the tree (D-061).
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
// --- hills archetype (D-056) - port of place.py _place_hills ------------------------------------
// An interplanted polyculture (Three Sisters / Four Sisters / milpa) is a grid of mounds at ~1 m
// spacing: the `mound` species (corn + beans) cluster together on each mound, the rest fill the
// gaps between mounds. Cluster positions use cos/sin rounded to 4 dp so the trig matches Python.
const MIN_ROW_SPACING_M = 0.30; // tightest a banded row packs (D-077); nothing is crowded below this
const HILL_SPACING_M = 1.0;
const HILL_CLUSTER_R = 0.2;
const MOUND_GUIDE_R = 0.35;
const ALLEY_PERIOD = 3; // D-141 / R-098: a FIELD keeps 2 planted mound rows, then 1 empty lane row
function isMound(p) {
    return Boolean(p.mound);
}
// Spread n plants evenly along k slots (Bresenham), not front-loaded. Port of place.py _even_pick.
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
// A mound-cluster dot's draw radius, shrunk to the room its position actually has. The fit gate is
// AREA-only, so a thin bed (6 m x 0.7 m clears three_sisters' 4 m2) reaches placement with mounds only
// 0.35 m from the long edges while a corn disc reaches 0.425 m - and a rect bed never clipped cluster
// dots at all (the forced single mound on a tight polygon had the same leak). The cluster stays together
// (D-088), so the dot is never dropped: it keeps `pr` exactly when the disc fits (every already-clean
// bed is byte-identical), else it shrinks to the edge distance less the 1 cm rounding guard, floored at
// EDGE_MIN_FRAC of the plant's own radius. Port of place.py _cluster_fit_r.
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
            // The whole cluster is kept together (D-088) - a hill's corn+beans are never split off the
            // bed. A dot the bed is too thin to hold whole keeps its place but shrinks its disc to the
            // room available (clusterFitR), so nothing draws past the border.
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
// Round-robin the gap species by count so they interlock. Port of place.py _interleave.
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
// The j-th of k indices spread EVENLY across [0, n-1] (endpoints included). Port of _even_index.
function evenIndex(j, k, n) {
    if (k <= 1)
        return Math.floor((n - 1) / 2);
    return Math.floor((j * (n - 1) + Math.floor((k - 1) / 2)) / (k - 1));
}
// Assign `p` ordered slots to species PROPORTIONAL to their counts and EVENLY interleaved (a
// largest-remainder / Sainte-Lague step): slot i goes to the species furthest behind its fair share.
// Returns species INDICES in slot order. Used for the between-mound gap plants (D-064 follow-up): the
// old interleave front-loaded the stream (squash, chile, amaranth, squash, chile, then a long squash
// tail), so a high-count species bunched into the last spatial rows. Spreading proportionally keeps
// the researched ratio AND scatters each species uniformly across the lattice. Integer arithmetic
// only - Python and TS agree bit-for-bit. Port of place.py _spread_assign.
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
// Gap species on the between-mound (outer-ring interlock) lattice, sub-sampled 2-D-evenly across the
// FULL width/height (D-064), interleaved. Tiny beds ring the gaps around each mound. Port of _gap_cells.
// `alley`/`laneAxis` (D-141): the walking-lane mound rows/cols. A gap point sits on a MOUND-row/col
// boundary, so one flanked by a lane lands ON the walking lane; those are excluded from the lattice up
// front, and the gap crop fills only the SAFE interior gaps (between two planted rows) - dense there,
// never in the walkway. Empty `alley` (a bed with no lanes) leaves the lattice untouched.
function gapPlantCells(gapSpecies, hillCenters, ncols, nrows, rx0, rx1, yLo, yHi, cellW, cellH, clipPts, alley, laneAxis, moundR) {
    const cells = new Map();
    for (const sp of gapSpecies)
        cells.set(String(sp.id), []);
    const total = gapSpecies.reduce((s, sp) => s + count(sp), 0);
    if (total <= 0 || !gapSpecies.length)
        return cells;
    const nc = ncols - 1, nr = nrows - 1;
    let points = []; // [x, y, r] - the dot radius varies where a cluster squeezes it (F-3)
    let dotR = round4(Math.min(cellW, cellH) * 0.30);
    // The walking-lane spans on the lane axis (D-141), for the ring fallback's overlap test (F-5).
    const laneLo0 = laneAxis === "x" ? rx0 : yLo;
    const laneCellSpan = laneAxis === "x" ? cellW : cellH;
    const laneSpans = [...alley].sort((a, b) => a - b).map((i) => [laneLo0 + i * laneCellSpan, laneLo0 + (i + 1) * laneCellSpan]);
    const inLane = (x, y, r) => {
        const v = laneAxis === "x" ? x : y;
        const m = Math.min(r, PATH_INSET_MAX_M);
        return laneSpans.some(([lo, hi]) => v + m > lo && v - m < hi);
    };
    // Ring fallback: gap plants circle each ACTUAL mound in open ground, offset past the whole cluster
    // (moundR) plus their own dot - so squash sits BESIDE a hill, never on it (maintainer: a round bed's
    // single centred mound had its squash drawn on top). Shared by the too-few-mounds case and the case
    // where every between-mound lattice point collides with a re-centred mound. A dot overlapping a
    // walking lane is rejected (F-5 - it used to check only the outline and dropped squash in the lane).
    const ringPoints = () => {
        dotR = round4(Math.min(cellW, cellH) * 0.12);
        const ringR = moundR + dotR + 0.05;
        const alloc = hillCenters.length ? evenPick(total, hillCenters.length) : [];
        for (let mi = 0; mi < hillCenters.length; mi++) {
            const [hx, hy] = hillCenters[mi];
            const k = alloc[mi];
            for (let m = 0; m < k; m++) {
                const a = 2 * Math.PI * (m + 0.5) / k;
                // A narrow bed can put the nominal angle off the outline (maintainer bug, 2026-07-30: a
                // 1.2 m Three Sisters small bed placed ZERO squash - each mound's single candidate pointed
                // off the bed's long axis, both rejected, and the squash zone rendered empty). Sweep the
                // ring deterministically and take the FIRST angle that fits; geometry that accepted the
                // nominal angle is byte-identical (step 0). Mirrors place.py RING_SWEEP_STEPS.
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
    // The gap dot's radius at a lattice point: the full dot when the surrounding clusters leave room
    // (exactly the old keep - byte-identical), else shrunk into the gap (floored at EDGE_MIN_FRAC),
    // null when truly swallowed. F-3: real corn (45 cm spread) left 2 cm less diagonal room than the
    // full dot wanted, so the lattice NEVER placed and every gap crop fell back to ringing the hills.
    const gapFitR = (x, y) => {
        const d = hillCenters.length
            ? Math.min(...hillCenters.map(([hx, hy]) => Math.hypot(x - hx, y - hy))) : Infinity;
        const room = d - (moundR - 0.01); // moundR carries its own +1 cm rounding pad
        if (room >= dotR - 1e-9)
            return dotR;
        const rr = room - 0.01;
        const floor = dotR * EDGE_MIN_FRAC;
        return rr > floor ? rr : null;
    };
    if (nc >= 1 && nr >= 1) {
        // The gap-row/col indices that are NOT flanked by a walking lane (a point at boundary i sits
        // between mound lines i and i+1). Only these hold a gap plant, so squash never lands in a lane.
        const safeR = [];
        for (let r = 0; r < nr; r++)
            if (laneAxis !== "y" || (!alley.has(r) && !alley.has(r + 1)))
                safeR.push(r);
        const safeC = [];
        for (let c = 0; c < nc; c++)
            if (laneAxis !== "x" || (!alley.has(c) && !alley.has(c + 1)))
                safeC.push(c);
        // Oversample the between-mound lattice for the clip too - sizing to `total` over the full bbox
        // then clipping left a triangle bed a fraction of its gap plants (D-058 fill). Mirrors place.py.
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
        // every lattice point collided with a mound (a re-centred single hill sits exactly on the lattice's
        // one between-mound point) - ring the actual mounds instead
        if (!points.length && hillCenters.length)
            ringPoints();
    }
    else {
        // too few mounds for a between-mound lattice: ring the gaps AROUND each mound, clipped (D-064)
        ringPoints();
    }
    // Oversampling can overshoot `total` after the clip - thin the gap points back evenly (stride) so
    // the gaps aren't overfilled and species keep their counts. Mirrors place.py.
    if (clipPts !== null && points.length > total) {
        points = Array.from({ length: total }, (_, i) => points[Math.floor(i * points.length / total)]);
    }
    // Scatter each gap species evenly across the (spatially row-major) points, proportional to its count.
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
    // Mounds on a regular grid (D-061). A mound is ATOMIC: corn and beans SHARE it (the corpus models
    // Three Sisters as the pair on one hill), so a mound is kept only if its WHOLE cluster and its guide
    // disc fit inside the outline - a hill's pair is never split off the bed (D-088). `moundR` is the
    // cluster's reach (the 0.2 m offset + the widest mound plant's radius) or the guide disc, whichever
    // is larger, +1 cm so 4-dp rounding can't tip a kept cluster past the border.
    const maxMoundPr = moundSpecies.length
        ? Math.max(...moundSpecies.map((sp) => Math.max(spreadCm(sp) / 100, 0.30) / 2)) : MOUND_GUIDE_R;
    const moundR = Math.max(MOUND_GUIDE_R, HILL_CLUSTER_R + maxMoundPr) + 0.01;
    // A mound is KEPT when its cluster fits at the SHRUNKEN floor (fill review F-4): cluster discs near
    // an edge shrink to the room available (clusterFitR) and the guide disc already shrinks, so
    // demanding the FULL worst-case radius threw away the whole rim ring of a 4 m round bed - corn's
    // 45 cm spread missed the mid-edge cells by 1.6 cm and the mounds huddled in the centre.
    const keepR = HILL_CLUSTER_R + maxMoundPr * EDGE_MIN_FRAC + 0.01;
    // D-141 / R-098: a FIELD is walked from alleys, not reached from its edges. Open walking lanes by
    // dropping every ALLEY_PERIOD-th mound row ACROSS THE SHORTER AXIS (a square ties to y), so the lanes
    // run the bed's longer axis - consistent with the raised strips and rotation. Dropping a WHOLE row or
    // column keeps every mound atomic (D-088) - a lane is an empty line of mounds, never a split hill.
    // D-142: only a FIELD is walked from mound alleys (in_ground is reach-based and keeps its rows), and
    // a lane is never the BOUNDARY row - the bed's own edge already gives access there.
    let laneAxis = width < height ? "x" : "y";
    if (laneFlip)
        laneAxis = laneAxis === "x" ? "y" : "x"; // the gardener's per-bed choice (2026-08-21)
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
    // A bed too tight for a whole mound with margin still gets ONE - the most-interior point - so a
    // Three Sisters bed always shows a corn+bean hill (corpus takes precedence over the geometric trim).
    // The pool is the grid candidates PLUS the bed CENTRE: a round bed's centre is not a grid cell (the
    // cells sit at the quadrant centres, all near the round edge), so without it the one mound gets shoved
    // into a corner instead of the middle (maintainer: a circle's Three Sisters clustered in one quadrant).
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
    // Mound species cluster on every kept mound (the FULL pair, never fragmented); gap species sit on the
    // between-mound lattice, clipped to the outline (they fill gaps, they aren't part of the mound pair).
    const moundCells = hillCells(hillCenters, moundSpecies, HILL_CLUSTER_R, rx0, rx1, yLo, yHi, clipPts);
    // The gap crop (squash/understory) fills only the SAFE interior gaps - gapPlantCells excludes the
    // between-mound points that a walking lane flanks, so a sprawler never lands in the walkway AND the
    // planted gaps fill densely (the fix for both "squash in the walking space" and "missing squash").
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
    // The mound guide disc is a drawn circle; shrink it to the mound's distance to the nearest edge so
    // it never pokes past the border (a mound near the border is a smaller mound). Rect beds shrink too
    // - a thin area-gated bed (0.7 m across) put the fixed 0.35 m disc edge-to-edge - with the same rule,
    // so any bed whose mounds have the full margin (every existing layout) is byte-identical.
    // -0.01 m: a hair inside the edge distance so rounding to 4 dp can never round the disc BACK past
    // the border (1 cm is imperceptible, far above the ~5e-5 round-off it guards against).
    const guideRoom = (hx, hy) => clipPts ? Math.sqrt(minEdgeDistSq(clipPts, hx, hy)) : Math.min(hx - rx0, rx1 - hx, hy - yLo, yHi - hy);
    const mounds = hillCenters.map(([hx, hy]) => ({
        cx: round4(hx), cy: round4(hy),
        r: round4(Math.min(MOUND_GUIDE_R, Math.max(0, guideRoom(hx, hy) - 0.01))),
    }));
    return { polar: "hills", zones, violations: [], mounds };
}
// --- interplant grid archetype (D-057) - port of place.py _place_grid ---------------------------
// A culinary bundle / companion pair on ONE uniform grid over the whole bed, taller species poleward.
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
    // Split tall (poleward-banded) from short (interplanted) up front - the tall count widens the grid
    // below (D-077) so a banded species seats SIDE BY SIDE across the width rather than wrapping. "Tall"
    // is relative to the bed (D-067): over R-003's threshold, or 1.5x the median. band=false (a rest
    // stand, D-069) never bands, so tall stays empty and the grid is not widened.
    const heights = ordered.map((p) => heightCm(p)).sort((a, b) => a - b);
    const m = heights.length;
    const medianH = m % 2 ? heights[(m - 1) / 2] : (heights[m / 2 - 1] + heights[m / 2]) / 2;
    const isTall = (p) => heightCm(p) >= thresholdCm || heightCm(p) > 1.5 * medianH;
    const tall = ordered.filter((p) => band && isTall(p));
    const short = ordered.filter((p) => !(band && isTall(p)));
    const nTall = tall.reduce((s, p) => s + count(p), 0);
    // Oversample so plants kept inside a traced outline still fill it to `total` (D-058); rect = no-op.
    const clipPts = region.shape === "polygon" ? pts : null;
    let nTarget = total;
    if (clipPts !== null) {
        const clipArea = polygonArea(pts);
        if (clipArea > 0) {
            // Compensate for the one-radius border the whole-dot clip removes (D-058 fill). Mirrors place.py.
            const ratio = (width * height) / effectiveClipArea(pts, clipArea, total);
            if (ratio > 1.0 + 1e-9)
                nTarget = Math.ceil(total * ratio);
        }
    }
    minD = fillSpacing(minD, width, height, nTarget);
    let [cols, rows] = gridDims(nTarget, minD, width, height);
    // D-077: widen the grid so the tall band fills the bed width in its poleward row(s), side by side.
    // Only when the tall count exceeds the columns the uniform spacing gives (a single tall plant - most
    // bundles - is unchanged) and never tighter than MIN_ROW_SPACING_M. Mirrors place.py.
    if (nTall > cols) {
        const want = Math.min(nTall, Math.max(1, Math.trunc(width / MIN_ROW_SPACING_M)));
        if (want > cols) {
            cols = Math.min(want, nTarget);
            rows = Math.ceil(nTarget / cols);
        }
    }
    rows = hexRows(cols, rows, nTarget); // staggered lattice (D-060)
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let kept = [];
    let remaining = nTarget;
    // A CLIPPED bed attempts EVERY row of the grid: the attempt budget (`remaining`) is spent poleward-
    // first, so stopping at nTarget attempts starved the equator side of a curved outline (maintainer: a
    // circle filled its top but left the bottom rim empty). Collect every fitting cell instead; the
    // stride-trim below thins the survivors evenly back to `total`, top to bottom. Rects keep the exact
    // budgeted walk (their cells all fit, so the budget IS the count - byte-identical).
    if (clipPts !== null) {
        // CHORD rows (maintainer: "uniform, traditional placement"): each row lays its plants evenly along
        // the shape's own interior interval(s) at this height, CENTRED - never spanning the bounding box
        // and clipping (which left ragged rows and stride-trim holes). Two passes: capacities first
        // (floor() keeps in-row spacing at or above the target cell - standard spacing rules), then any
        // excess over `total` is shaved from the FULLEST rows before positions are laid, so every row
        // stays centred and even - no after-the-fact trim punching holes.
        kept = placeChordRows(clipPts, rows, cellH, cellW, r, total, north ? yHi : yLo, north);
    }
    else {
        // Row counts first, so the LAST TWO rows can rebalance: a small remainder row (under ~55% of a
        // full one) spread edge-to-edge still read as a BROKEN bottom edge (maintainer: "bottom still
        // not completely filled"). Splitting the last two rows near-evenly tapers the bed over two
        // gently-wider rows instead of one full row over a sparse crumb. A healthy remainder (>= 55%)
        // rebalances nothing and the layout is exactly as before. Mirrors place.py.
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
            // A row under its cap (the last one, or the last two after a rebalance) spreads edge-to-edge
            // at its own even spacing - no matching holes at the far east AND west (the reported "bottom
            // row open E/W"); every full row keeps the tight cellW spacing and the quincunx stagger.
            const soft = n < cap && n > 1;
            const step = soft ? width / n : cellW;
            const xstart = soft ? rx0 : rx0 + (width - n * cellW) / 2;
            for (let c = 0; c < n; c++) {
                const x = xstart + (c + 0.5) * step;
                kept.push({ x, y, r });
            }
        }
    }
    // Assign the kept cells (D-066): the TALL species (computed above) take the poleward rows
    // contiguously so they shade off the bed, not their neighbours; the similar-height REMAINDER is
    // interleaved into a repeating mixed motif, so a bundle reads as an interplanted kitchen bed rather
    // than rows of one crop. Tall species first (tallest poleward), then the tiled motif to the equator.
    const orderIds = [];
    for (const p of tall)
        for (let t = 0; t < count(p); t++)
            orderIds.push(String(p.id)); // contiguous poleward bands
    for (const id of interleave(short))
        orderIds.push(id); // round-robin tile of the similar-height species
    const cellsBy = new Map();
    for (const p of ordered)
        cellsBy.set(String(p.id), []);
    // Oversampling can leave MORE kept than `total`; take an EVEN stride to `total` (not the first
    // `total`, which clumps the bed poleward and drops the equatorward cells). Mirrors place.py.
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
// --- graded archetype (D-081): the configurable-bed OPTIMISER layout -----------------------------
// "Optimise" on a My-bed shows how to actually plant a preselected set. Plants bucket into height
// TIERS; the tall tier bands poleward and the low tier equatorward (R-003), each tier fills its band
// at ITS OWN mature spacing with the tier's species INTERPLANTED (round-robin), and the bands stretch
// to fill the whole bed - "tall at the back, short at the front, evenly, mixed within a row". Named
// guilds keep their own geometry; overcrowding is surfaced by optimizeBed's count-trim. Mirrors
// place.py _place_graded line-for-line.
const TIER_TALL_CM = 90; // >= tall -> trellised/staked, poleward band
const TIER_LOW_CM = 35; // <  low  -> ground/greens, equatorward band
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
    const order = [...tiers.keys()].sort((a, b) => a - b); // tall -> low == poleward -> equatorward
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
        // A tier that holds a SHADE-CASTING species (>= the R-003 threshold) orders its members by
        // height, taller poleward, so R-003 holds WITHIN the tier too (interplanting two tall species of
        // different height would sit a shorter one north of a taller one and self-shade). A tier of only
        // sub-threshold species INTERPLANTS. Mirrors place.py.
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
// Ray-cast point-in-polygon (D-058). Port of place.py _point_in_polygon.
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
// Smallest SQUARED distance from (x, y) to any polygon edge. Squared (no sqrt) so the keep/drop
// test is pure multiply/divide - bit-identical to place.py _min_edge_dist_sq.
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
// Keep a dot only if its WHOLE disc (centre + draw radius r) is inside the traced outline - centre
// inside AND at least r from every edge. Fixes dots whose CENTRE cleared the old centre-only clip
// but whose body poked past a slanted or concave border (D-058 follow-up). Mirrors place.py.
function dotInPolygon(pts, x, y, r) {
    // 1e-9 tolerance keeps a dot that TOUCHES the edge (clearance == r, the intended grid inset on an
    // axis-aligned bed) from being dropped by float noise - far below any real (mm-scale) overflow.
    return pointInPolygon(pts, x, y) && minEdgeDistSq(pts, x, y) >= r * r - 1e-9;
}
// The usable area for a whole-dot clip: the outline area LESS the one-radius border strip the clip
// removes. Estimating r at the target density (r ~ ½·sqrt(area/count)), the inset area is
// area − perimeter·r. Oversampling against THIS (not the raw area) so a traced bed still fills to
// `count`. sqrt only (no hypot) - correctly rounded in both engines, so n_target can't drift.
// Floored at ¼ area so a thin/degenerate outline can't explode the oversample. Mirrors place.py.
// Edge-adaptive clip (D-058 follow-up; maintainer: a round bed's rim stayed empty). A fill cell whose
// whole disc fits the outline keeps its full draw radius; a cell NEAR the outline is kept with its disc
// SHRUNK to the room available - real gardeners plant to the rim - and only a cell with less than
// EDGE_MIN_FRAC of its radius (or its centre outside) is dropped, so the rim never turns to confetti.
// The 1 cm guard mirrors the mound-guide clip (4-dp rounding can't tip a kept disc past the border).
const EDGE_MIN_FRAC = 0.35;
// Ring-fallback angle sweep (2026-07-30): candidate positions tried around a mound before a gap
// dot is dropped. 16 = every 22.5 degrees. Mirrors place.py RING_SWEEP_STEPS exactly.
const RING_SWEEP_STEPS = 16;
// The interior interval(s) of a horizontal row through a polygon - the CHORD(s) at height y, as sorted
// [x1, x2] pairs (even-odd pairing of the edge crossings, same half-open vertex rule as
// pointInPolygon). A clipped bed lays each row's plants evenly along its own chord, centred - the
// uniform, traditional round-bed planting - instead of spanning the bounding box and clipping.
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
// Chord-row placement for a CLIPPED bed (shared by placeGrid and grid): rows at cellH pitch, each
// laying its plants evenly along the shape's own chord(s), centred. Capacities are computed first and
// any excess over `total` is shaved from the FULLEST rows BEFORE positions are laid - every row stays
// centred and even. Port pair of place.py _place_chord_rows.
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
    while (cTotal > total) { // shave the fullest row (first of the ties) - keeps the rows balanced
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
        // Quincunx stagger (fill review F-10): centring every chord row independently left the dots in
        // hard vertical columns - a mechanical grid inside an organic outline. Alternate rows shift a
        // quarter-step each way (a half-step relative offset, the classic stagger); the 0.25 margin
        // keeps the end dots inside the chord's rMin inset, and edge-fit still shrinks any dot the
        // outline squeezes. Mirrors place.py.
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
        return r; // whole disc fits - EXACTLY the old dotInPolygon keep, so every previously-kept cell is byte-identical
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
    // the border band actually LOST to the clip is only where a disc can't keep EDGE_MIN_FRAC of its
    // radius (edgeFitR) - much thinner than the full-radius band the whole-dot clip used to cost
    const eff = area - perim * rEst * EDGE_MIN_FRAC;
    const floor = 0.25 * area;
    return eff > floor ? eff : floor;
}
// Choose (cols, rows) to lay `cnt` plants over a width×height box as squarely as possible, never
// tighter than minD. Integer search (no float sqrt) - Python/TS pick the same grid. Port of _grid_dims.
function gridDims(cnt, minD, width, height) {
    if (cnt <= 1)
        return [1, 1];
    const maxCols = Math.max(1, Math.trunc(width / minD));
    const maxRows = Math.max(1, Math.trunc(height / minD));
    let best = null; // [score, cols, rows]
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
// `cnt` plant positions SPREAD to fill the band on a centred, symmetric grid (D-057). Fills the band
// edge-to-edge (no poleward clump, nothing past the edges); the partial last row is centred. Port of
// place.py _grid.
// Triangular / quincunx packing (D-060): even rows hold `cols` plants centred, odd rows `cols-1`
// centred - which lands them half a cell over, nestled in the gaps. Ports of place.py helpers.
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
// Cap the spacing floor so it never PREVENTS an even fill (D-059) - a big-spread sprawler would
// otherwise force a vertical strip. Port of place.py _fill_spacing.
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
    rows = hexRows(cols, rows, nTarget); // staggered lattice (D-060)
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let cells = [];
    let remaining = nTarget;
    // clipped bands attempt EVERY row (see placeGrid: a poleward-first attempt budget starves the
    // equator side of a curved outline); the stride-trim below evens the survivors back to `cnt`.
    if (clipPts !== null) {
        // CHORD rows for a clipped band - plants evenly along the shape's own interval(s), centred, with
        // capacities balanced before laying (see placeChordRows; the uniform, traditional round-bed rows)
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
    // Oversampling to beat the clip can overshoot `cnt` - thin the survivors back EVENLY along the
    // poleward-first run (stride pick, integer, deterministic). Mirrors place.py.
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
// A plant cell is blocked if its CENTRE sits inside an occupied region - a carried-forward perennial's
// footprint (ISSUES #11 plan-around-occupancy, D-116). Port of place.py _cell_blocked. Point-in-region,
// so it needs no disc/circle primitive; cells and occupied regions share the placement's coordinate space.
function cellBlocked(x, y, occupied) {
    return occupied.some((o) => pointInPolygon(regionPoints(o), x, y));
}
// Drop plant cells on occupied ground, per zone, updating each count - a subtractive pass so a
// reactivated season plants AROUND its carried perennials, never on top of them. Port of place.py.
function excludeOccupied(result, occupied) {
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => !cellBlocked(c.x, c.y, occupied));
        z.count = z.plants.length;
    }
    return result;
}
// Layouts that reserve access bands with a cell-drop post-pass (field lanes AND raised-bed paths).
// Hills opens its OWN field lanes atomically (whole mound rows) inside placeHills; radial/orchard are
// woody guilds a field/raised never describes. Port of place.py.
const FIELD_LANE_LAYOUTS = new Set(["rows", "grid", "graded"]);
const STRIP_MAX_M = 1.22; // R-098 strip_max_width_cm: reachable from both sides — Iowa State's 4-ft
// ceiling exactly. Was 1.2, a metric rounding 2 cm short, which split the most common bed size
// (a 4x4 = 1.219 m) into 0.36 m strips (maintainer, 2026-08-21). Mirrors place.py; the corpus
// param is the source of truth and place.py's sync test pins the pair.
// R-098 path_width_cm: a walking path between raised-bed strips. Exported because the map's
// path-gap magnet (O101 layout aids) snaps the gap BETWEEN beds to this same width - one source
// of truth, so the magnet and the in-bed walkways can never quote different paths.
export const PATH_M = 0.5;
// D-142 (maintainer, 2026-07-24): an IN-GROUND bed is reach-based like a raised bed, NOT walked from
// mound alleys like a field. You can stand at its edge or step into a path, so the reach is a full
// arm-plus-lean from each side (~1.5 m) - strips up to 3 m stay tendable, and a 3x3 home bed keeps
// its whole surface (the old field-style lane ate the top third of every default 3 m bed).
const INGROUND_STRIP_MAX_M = 3.0;
// D-145 (maintainer, 2026-07-24): once an in-ground bed is deep enough to need internal paths at
// all (deeper than INGROUND_STRIP_MAX_M), its strips cap at a kneel-and-reach working width
// (~1.1 m from each side) instead of the full step-up reach - a 20 ft bed gets two paths and
// three 1.7 m strips, not one path and two 2.8 m strips you'd have to step into. Beds within
// INGROUND_STRIP_MAX_M still reserve nothing (the D-142 driver: a 3x3 plants edge to edge).
const INGROUND_WORK_STRIP_M = 2.2;
// The most a plant is inset from an access lane/path when deciding it would "touch" one (D-141). A
// plant is dropped if its dot, up to this margin, would overlap a band - so a DENSE bed (small dots)
// keeps every plant off the path edge, while a SPARSE bed (few plants -> a huge DRAW radius filling a
// big cell) can't have its one plant deleted just because the drawn disc spans the whole bed.
const PATH_INSET_MAX_M = 0.25;
// The walking-lane bands of a FIELD (D-141 / R-098): a mound grid at HILL_SPACING, every ALLEY_PERIOD-th
// row an empty lane, reserved across the SHORTER axis (a square ties to y) so the lanes run the bed's
// LONGER axis - consistent with the raised strips, and the bed's rotation orients it in the world.
// A lane is never the BOUNDARY row (D-142) - the field's own edge gives access there. Returns
// {axis, bands}; empty until the field runs a couple rows deep. Port of place.py.
function fieldBands(x0, x1, y0, y1, flip = false) {
    const width = x1 - x0, height = y1 - y0;
    let axis = width < height ? "x" : "y"; // split the SHORTER axis (square -> y)
    if (flip)
        axis = axis === "x" ? "y" : "x"; // the gardener's per-bed choice (2026-08-21): lanes the other way
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
// The access PATHS of a reach-tended bed (D-141 / R-098 / D-142): a span past reach is split into
// planting strips separated by PATH_M paths, reserved across the SHORTER axis (R-006; the long axis
// is reached from the long edges), a square tying to y like the field. `stripMax` decides WHETHER
// paths are needed (a span within it is reachable whole); `workMax` (D-145, defaults to stripMax)
// caps the strips once they exist. A RAISED bed is never stepped into, so both are reach-from-both-
// sides (STRIP_MAX_M); an IN-GROUND bed keeps its whole surface to INGROUND_STRIP_MAX_M but splits
// into kneel-and-reach INGROUND_WORK_STRIP_M strips past that. Returns {axis, bands}; empty when
// reachable across the short side. Port of place.py _path_bands.
function pathBands(x0, x1, yLo, yHi, stripMax, workMax, flip = false) {
    const width = x1 - x0, height = yHi - yLo;
    if (Math.min(width, height) <= stripMax)
        return { axis: "y", bands: [] }; // reachable whole: no paths, flipped or not (reach is the mechanism)
    const work = workMax ?? stripMax;
    let axis = width < height ? "x" : "y"; // split the SHORTER axis (square -> y)
    if (flip)
        axis = axis === "x" ? "y" : "x"; // the gardener's per-bed choice (2026-08-21): paths the other way; strips stay capped at `work`, so reach holds
    const span = axis === "x" ? width : height;
    const lo0 = axis === "x" ? x0 : yLo;
    const n = Math.ceil((span + PATH_M) / (work + PATH_M)); // fewest strips with stripW <= work
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
// Drop every plant cell whose DOT (up to PATH_INSET_MAX_M) would overlap an access band, updating each
// zone's count (D-141). Using the dot, not just the centre, keeps a plant from sitting ON a lane/path
// edge; the capped margin stops a sparse bed's huge DRAW radius (a single plant filling a big cell)
// from deleting the only plant when its centre is nowhere near the band.
function dropCellsInBands(result, axis, bands) {
    if (!bands.length)
        return result;
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => { const v = axis === "x" ? c.x : c.y; const m = Math.min(c.r, PATH_INSET_MAX_M); return !bands.some(([lo, hi]) => v + m > lo && v - m < hi); });
        z.count = z.plants.length;
    }
    return result;
}
// Repack the grid/graded rows INTO the planting strips instead of dropping the ones that land on a
// path (D-141). Dropping wasted the plants that fell on a walkway AND left the strips unevenly filled -
// the middle strip caught fewer rows, clustered at one edge, half-empty (the reported "growing areas
// between the walkways aren't complete"). Reflow keeps every plant: the distinct row coordinates map to
// EVEN positions across the plantable strips (consistent spacing, none on a path), so each strip fills
// completely. Only the along-axis coordinate moves; the columns are untouched. You plant the strips,
// not the walkways, so the whole planting lands in them. Port of place.py.
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
    // Inset each strip by one dot radius so an EDGE row's disc stays inside its strip instead of poking
    // into the walkway (the reported "little bit of overflowing into walking lanes"). Clamp the inset to
    // 45% of the strip so a thin strip can't invert - and to HALF THE NATURAL PITCH (span/rows), because
    // past that the inset stops protecting the edge dot and starts crushing the fill: a 1.5 m raised bed
    // splits into two 0.5 m strips, and a 0.375 m tomato dot left each strip a 5 cm window - every column
    // landed 1.4 cm from the next, discs overlapping and poking past the bed edge (O26). A dot bigger
    // than its margin SHRINKS below instead. Rows then fill [s0+m, s1-m].
    const dotR = Math.max(0, ...result.zones.flatMap((z) => z.plants.map((c) => c.r)));
    const spanTotal = strips.reduce((s, [s0, s1]) => s + (s1 - s0), 0);
    const halfPitch = spanTotal / (2.0 * R);
    const usable = strips.map(([s0, s1]) => { const m = Math.min(dotR, (s1 - s0) * 0.45, halfPitch); return [s0 + m, s1 - m]; });
    const totalUsable = usable.reduce((s, [a, b]) => s + (b - a), 0);
    if (totalUsable <= 0)
        return result;
    // ONE uniform pitch across the whole bed (fill review follow-up, maintainer: "some areas not as
    // dense" - per-strip pitches made one strip read denser than its neighbour), but each strip's
    // rows CENTERED IN THAT STRIP. The first cut of the uniform pitch walked rows along the
    // CONCATENATED strips, which centered them globally: whenever the row count didn't divide evenly
    // a boundary row rolled into the next strip at offset zero - hugging the path edge - and one
    // strip caught more rows off-center (maintainer, 2026-08-21: "placement within those rows was
    // not uniform"). So: allocate whole rows per strip by cumulative half-up rounding (deterministic,
    // same arithmetic as place.py), then lay each strip's block symmetrically about the strip's own
    // middle at the SHARED pitch. Extent (nI - 1) * pitch never exceeds the strip, because
    // nI - 1 <= R * lenI / total. Same density everywhere; margins symmetric; nothing on a path edge.
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
    // Shrink the DRAW radius to the room the strip affords - the same r = cell/2 discipline as grid():
    // a disc wider than its strip's margin would poke past the bed edge or into the very walkway the
    // reflow just cleared. Positions sit at least the inset from a strip edge, so r never collapses.
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
// The plantable extent (lo, hi) and whether the region is a plain rect - a traced polygon keeps the
// DROP so a reflowed row can't slide outside its outline; a rect (the usual structured bed) reflows.
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
// Reserve a field's walking lanes in a grid/rows/graded layout (D-141 / R-098). Port of place.py.
// Straight access lanes/paths only make sense for a RECTANGLE - a shape that fills its bounding box.
// A circle is reached radially, and an L / irregular trace is narrow enough to reach from its own
// perimeter (like a 4x4 bed); sizing a straight band to the bounding box would draw it OUTSIDE the real
// shape and split plants already in reach (maintainer). So bands apply to a rect, a rotated rect, or a
// painted/drawn 4-corner rectangle, and to nothing else. Port of place.py _is_rectangular_bed.
function isRectangularBed(region) {
    if (region.shape === "rect")
        return true;
    if (region.shape === "polygon" && region.points.length === 4) {
        const p = region.points;
        // a quadrilateral whose diagonals are equal AND bisect each other is a rectangle (any rotation)
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
// Reserve a reach-tended bed's between-strip paths in a grid/rows/graded layout (D-141 / R-098):
// STRIP_MAX_M strips for a raised bed; an in-ground bed opens paths past INGROUND_STRIP_MAX_M and
// then works in INGROUND_WORK_STRIP_M strips (D-142 / D-145). Port of place.py.
function openStripPaths(result, region, stripMax, workMax, flip = false) {
    if (!isRectangularBed(region))
        return result;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return openLanes(result, region, pathBands(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), stripMax, workMax, flip));
}
// The access bands a bed's declared structure reserves, as rectangles in the region frame (D-141 /
// R-098) - so BOTH the placement diagram and the map can draw the lanes/paths from geometry alone,
// no plants needed. `field` gives full-width mound-row lanes (interior rows only, D-142); `raised`
// and `in_ground` give reach-based strips split along the shorter axis (1.2 m and 3 m strips - an
// in-ground bed is stood beside and stepped up to, so a 3x3 default bed reserves NOTHING, D-142).
// Empty for a bed within reach, a container, or a radial region. Port of place.py.
export function accessBands(structure, region, flip = false) {
    if (!isRectangularBed(region))
        return []; // a circle / L / trace is reached from its own perimeter
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
// The access bands of a bed as POLYGONS in PLOT coords, rotated to sit inside the bed - so a surface
// that draws in plot space (the map) keeps the lanes/paths glued to a rotated bed instead of an
// axis-aligned bounding box (D-141 rotation fix). Computes the bands in the bed's own oriented frame
// (effW x effL, the frame place() lays out in) then maps each corner with orientedToPlot, the SAME
// transform that carries the plant cells - so bands and plants rotate together. A non-rotated bed has
// residual 0, so this is the identity map back to its plot rect.
export function accessBandPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return []; // no straight lanes on a circle / L / trace
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    return bands.map((b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
        .map(([x, y]) => orientedToPlot(x, y, f.effW, f.effL, f.residualDeg, f.cx, f.cy)));
}
// The PLANTABLE strips of a structure-divided bed as POLYGONS in PLOT coords - the COMPLEMENT of
// accessBands within the bed's oriented frame (the walkways' negative space), mapped through the SAME
// orientedToPlot transform so each strip stays glued to a rotated bed. One 4-corner polygon per strip,
// in the same TL->TR->BR->BL winding accessBandPolygons uses; [] when the bed doesn't divide (a
// container, a within-reach bed, a radial region). ISSUES #12 approach A ("Split into sections") turns
// each of these into its own PlacedBed. App-layer only - place() never calls it, so there is no oracle
// behaviour to mirror; it is pure geometry over the already-mirrored accessBands.
export function plantableStripPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return []; // only a rectangular bed divides into strips
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    if (!bands.length)
        return [];
    // accessBands makes each band span the FULL extent on one axis: a lane/path that runs the whole
    // width (x0==0, x1==effW) varies in Y, so the split axis is Y; otherwise it varies in X.
    const axisY = bands.every((b) => b.x0 <= 1e-9 && Math.abs(b.x1 - f.effW) <= 1e-9);
    const span = axisY ? f.effL : f.effW;
    const cuts = bands.map((b) => (axisY ? [b.y0, b.y1] : [b.x0, b.x1])).sort((a, b) => a[0] - b[0]);
    // strips = the gaps between the sorted bands over [0, span] (the reflowIntoStrips complement)
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
        // grid-based layouts drop the cells in the bands here; hills already dropped its own field rows.
        if (FIELD_LANE_LAYOUTS.has(layoutKind)) {
            if (structure === "field")
                result = openFieldLanes(result, region, laneFlip);
            else if (structure === "raised")
                result = openStripPaths(result, region, STRIP_MAX_M, undefined, laneFlip);
            else if (structure === "in_ground")
                result = openStripPaths(result, region, INGROUND_STRIP_MAX_M, INGROUND_WORK_STRIP_M, laneFlip);
            // (band attachment below: hills only attaches FIELD lanes - an in-ground mound bed keeps every
            // row (D-142), so a drawn path band would run straight through planted mounds.)
        }
        // Attach the reserved bands so the DOM can draw them - ONLY for layouts that actually reserve
        // them: the grid-based layouts for any banded structure, hills for a FIELD only. On an in-ground
        // mound bed the hills keep every row (D-142: you walk between the hills), so a drawn path band
        // would run straight through planted mounds (maintainer screenshot). An orchard (a tree guild)
        // never gets transit lanes even on an in-ground bed - the tree spacing is the access.
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
    const pts = regionPoints(region);
    const total = polygonArea(pts);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs); // true region x-bounds, the width the per-plant grid lays out across
    const rx1 = Math.max(...xs);
    const x0 = rx0 - 1;
    const x1 = rx1 + 1;
    const yLo = Math.min(...ys);
    const yHi = Math.max(...ys);
    const north = polarIsNorth(latDeg);
    const isPoly = region.shape === "polygon"; // clip the fill grid to a TRACED outline only (D-058)
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    // Spread capped at the bed's shorter side (see weight()): a sprawler's claim stops at the ground
    // the bed actually holds.
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
            cut = north ? yLo : yHi; // the remainder - no bisection drift on the last band
        }
        else {
            let lo = north ? yLo : cur;
            let hi = north ? cur : yHi;
            for (let it = 0; it < 50; it++) { // fixed-iteration bisection: deterministic in both engines
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
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm }));
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
/** Map a point from the oriented layout frame to plot coordinates of the rotated bed centred
 *  at (cx, cy). The quarter-turns are absorbed by orientRect's dim swap, so the world
 *  transform is the residual rotation alone. Trig rounds to 4 dp so Python == TS. */
export function orientedToPlot(x, y, effW, effL, residualDeg, cx, cy) {
    const dx = x - effW / 2.0, dy = y - effL / 2.0;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(cx + dx * c - dy * s), round4(cy + dx * s + dy * c)];
}
/** The exact inverse of orientedToPlot: a plot point back into the bed's oriented layout frame. Used
 *  to carry a plot-space footprint (a carried-forward perennial, D-119 rotated-bed occupancy) into the
 *  frame place() lays out in, so its cells can be excluded there. Same residual-only rotation. */
export function plotToOriented(px, py, effW, effL, residualDeg, cx, cy) {
    const rx = px - cx, ry = py - cy;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(rx * c + ry * s + effW / 2.0), round4(-rx * s + ry * c + effL / 2.0)];
}
/** A bed's oriented box. A rotated 4-corner bed uses its stored angle; an axis-aligned rect uses
 *  its own box; any other polygon (a traced area, a circle's 32-gon) falls back to its bounding
 *  box, so a translation still tracks exactly. Never null - a bed always has a box. */
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
// plot point -> [0..1] fraction within a frame's box, and back - the normalisation is what lets a
// resize scale the layout, not just a move/rotate carry it.
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
/** Map a region from one bed's frame to another's (normalised, so it follows a move, a rotation, AND
 *  a resize). Returns a polygon - the general result of the frame→frame map. */
export function remapRegionBetweenBeds(region, oldBed, newBed) {
    const oldF = bedFrame(oldBed), newF = bedFrame(newBed);
    return { shape: "polygon", points: regionPoints(region).map((p) => {
            const [fx, fy] = plotToFrac(p[0], p[1], oldF);
            return fracToPlot(fx, fy, newF);
        }) };
}
