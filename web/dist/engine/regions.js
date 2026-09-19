const RESERVED_SHAPES = new Set(["circle", "radial_rings"]);
export function parseRegion(raw) {
    const r = raw;
    const shape = r?.shape;
    if (shape === "polygon") {
        const pts = r.points;
        const ok = Array.isArray(pts) && pts.length >= 3 && pts.every((p) => Array.isArray(p) && p.length === 2
            && typeof p[0] === "number" && Number.isFinite(p[0])
            && typeof p[1] === "number" && Number.isFinite(p[1]));
        if (!ok)
            throw new Error(`polygon region needs at least 3 finite [x, y] points, got ${JSON.stringify(raw)}`);
        const points = pts.map((p) => [p[0], p[1]]);
        if (!isSimplePolygon(points)) {
            throw new Error(`polygon region must not self-intersect or touch itself, got ${JSON.stringify(raw)}`);
        }
        if (polygonArea(points) <= 0)
            throw new Error(`polygon region has zero area, got ${JSON.stringify(raw)}`);
        return { shape: "polygon", points };
    }
    if (shape !== "rect") {
        if (typeof shape === "string" && RESERVED_SHAPES.has(shape)) {
            throw new Error(`region shape "${shape}" is reserved but not implemented (D-015)`);
        }
        throw new Error(`unknown region shape ${JSON.stringify(shape)}`);
    }
    const nums = [r.x, r.y, r.w, r.h].map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
    if (nums.some((v) => v === null) || nums[2] < 0 || nums[3] < 0) {
        throw new Error(`rect region needs finite x/y and non-negative w/h, got ${JSON.stringify(raw)}`);
    }
    return { shape: "rect", x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}
export function area(r) {
    if (r.shape === "radial_rings")
        return Math.PI * r.r * r.r;
    if (r.shape === "polygon")
        return polygonArea(r.points);
    return r.w * r.h;
}
export function minReachSpanM(r) {
    if (r.shape === "polygon") {
        const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1]);
        return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }
    return Math.min(r.w, r.h);
}
export function intersectArea(a, b) {
    if (a.shape === "rect" && b.shape === "rect") {
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return w > 0 && h > 0 ? w * h : 0;
    }
    return polygonIntersectArea(regionPoints(a), regionPoints(b));
}
const EPS = 1e-9;
export function signedArea2(pts) {
    let s = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        s += x1 * y2 - x2 * y1;
    }
    return s;
}
export function polygonArea(pts) {
    return Math.abs(signedArea2(pts)) / 2;
}
function cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}
function segmentsTouch(p, q, r, s) {
    const d1 = cross(p[0], p[1], q[0], q[1], r[0], r[1]);
    const d2 = cross(p[0], p[1], q[0], q[1], s[0], s[1]);
    const d3 = cross(r[0], r[1], s[0], s[1], p[0], p[1]);
    const d4 = cross(r[0], r[1], s[0], s[1], q[0], q[1]);
    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS))
        && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS)))
        return true;
    const onSegment = (a, b, c, d) => Math.abs(d) <= EPS
        && Math.min(a[0], b[0]) - EPS <= c[0] && c[0] <= Math.max(a[0], b[0]) + EPS
        && Math.min(a[1], b[1]) - EPS <= c[1] && c[1] <= Math.max(a[1], b[1]) + EPS;
    return onSegment(p, q, r, d1) || onSegment(p, q, s, d2)
        || onSegment(r, s, p, d3) || onSegment(r, s, q, d4);
}
export function isSimplePolygon(pts) {
    const n = pts.length;
    if (n < 3)
        return false;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (j === i + 1 || (i === 0 && j === n - 1))
                continue;
            if (segmentsTouch(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]))
                return false;
        }
    }
    return true;
}
function pointInTri(p, a, b, c) {
    return cross(a[0], a[1], b[0], b[1], p[0], p[1]) >= -EPS
        && cross(b[0], b[1], c[0], c[1], p[0], p[1]) >= -EPS
        && cross(c[0], c[1], a[0], a[1], p[0], p[1]) >= -EPS;
}
export function triangulate(pts) {
    const order = pts.map((_, i) => i);
    if (signedArea2(pts) < 0)
        order.reverse();
    const tris = [];
    while (order.length > 3) {
        const n = order.length;
        let clipped = false;
        for (let k = 0; k < n; k++) {
            const ia = order[(k - 1 + n) % n], ib = order[k], ic = order[(k + 1) % n];
            const a = pts[ia], b = pts[ib], c = pts[ic];
            const cr = cross(a[0], a[1], b[0], b[1], c[0], c[1]);
            if (Math.abs(cr) <= EPS) {
                order.splice(k, 1);
                clipped = true;
                break;
            }
            if (cr < 0)
                continue;
            if (order.some((j) => j !== ia && j !== ib && j !== ic && pointInTri(pts[j], a, b, c)))
                continue;
            tris.push([a, b, c]);
            order.splice(k, 1);
            clipped = true;
            break;
        }
        if (!clipped)
            throw new Error("triangulation failed - polygon is not simple");
    }
    if (order.length === 3) {
        const a = pts[order[0]], b = pts[order[1]], c = pts[order[2]];
        if (Math.abs(cross(a[0], a[1], b[0], b[1], c[0], c[1])) > EPS)
            tris.push([a, b, c]);
    }
    return tris;
}
function isect(a, b, p, q) {
    const dp = cross(a[0], a[1], b[0], b[1], p[0], p[1]);
    const dq = cross(a[0], a[1], b[0], b[1], q[0], q[1]);
    const t = dp / (dp - dq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}
export function convexClip(subject, clip) {
    let out = [...subject];
    const m = clip.length;
    for (let i = 0; i < m; i++) {
        if (!out.length)
            return [];
        const a = clip[i], b = clip[(i + 1) % m];
        const prev = out;
        out = [];
        for (let j = 0; j < prev.length; j++) {
            const p = prev[j], q = prev[(j + 1) % prev.length];
            const pin = cross(a[0], a[1], b[0], b[1], p[0], p[1]) >= -EPS;
            const qin = cross(a[0], a[1], b[0], b[1], q[0], q[1]) >= -EPS;
            if (pin) {
                out.push(p);
                if (!qin)
                    out.push(isect(a, b, p, q));
            }
            else if (qin) {
                out.push(isect(a, b, p, q));
            }
        }
    }
    return out;
}
export function polygonIntersectArea(aPts, bPts) {
    const bTris = triangulate(bPts);
    let total = 0;
    for (const ta of triangulate(aPts)) {
        for (const tb of bTris) {
            const piece = convexClip([...ta], [...tb]);
            if (piece.length >= 3) {
                const pieceArea = polygonArea(piece);
                if (pieceArea > EPS)
                    total += pieceArea;
            }
        }
    }
    return total;
}
export function rectPoints(r) {
    const { x, y, w, h } = r;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
export function regionPoints(r) {
    return r.shape === "polygon" ? r.points.map((p) => [p[0], p[1]]) : rectPoints(r);
}
export function polygonCentroid(pts) {
    const a2 = signedArea2(pts);
    const n = pts.length;
    if (Math.abs(a2) <= EPS) {
        let sx = 0, sy = 0;
        for (const p of pts) {
            sx += p[0];
            sy += p[1];
        }
        return [sx / n, sy / n];
    }
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        const w = x1 * y2 - x2 * y1;
        cx += (x1 + x2) * w;
        cy += (y1 + y2) * w;
    }
    return [cx / (3 * a2), cy / (3 * a2)];
}
export function regionCentroid(r) {
    return r.shape === "polygon" ? polygonCentroid(r.points) : [r.x + r.w / 2, r.y + r.h / 2];
}
export function radialRingsFromFootprint(footprintMinM2, cx = 0, cy = 0) {
    if (!Number.isFinite(footprintMinM2) || footprintMinM2 <= 0)
        return null;
    return { shape: "radial_rings", cx, cy, r: Math.sqrt(footprintMinM2 / Math.PI) };
}
export function circleFitsRect(ring, bedWm, bedLm) {
    return 2 * ring.r <= bedWm && 2 * ring.r <= bedLm;
}
export function fitDiagram(bedWm, bedLm, footprintMinM2) {
    if (!Number.isFinite(bedWm) || !Number.isFinite(bedLm) || bedWm <= 0 || bedLm <= 0)
        return null;
    const bed = { shape: "rect", x: 0, y: 0, w: bedWm, h: bedLm };
    if (footprintMinM2 == null || footprintMinM2 <= 0)
        return { bed, footprint: null, overflow: false };
    const ratio = Math.sqrt(footprintMinM2 / (bedWm * bedLm));
    return {
        bed,
        footprint: { shape: "rect", x: 0, y: 0, w: bedWm * ratio, h: bedLm * ratio },
        overflow: ratio > 1,
    };
}
export const ADJACENT_MAX_GAP_M = 0.6;
function segDist(p, a, b) {
    const [ax, ay] = a, [bx, by] = b, [px, py] = p;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    if (L2 <= EPS)
        return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function regionGapM(a, b) {
    if (a.shape === "rect" && b.shape === "rect") {
        const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
        const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
        return Math.hypot(dx, dy);
    }
    const pa = regionPoints(a), pb = regionPoints(b);
    if (polygonIntersectArea(pa, pb) > 0)
        return 0;
    let best = Infinity;
    for (const [pts, other] of [[pa, pb], [pb, pa]]) {
        const n = other.length;
        for (const p of pts) {
            for (let i = 0; i < n; i++) {
                const d = segDist(p, other[i], other[(i + 1) % n]);
                if (d < best)
                    best = d;
            }
        }
    }
    return best;
}
export function adjacent(a, b) {
    return regionGapM(a, b) <= ADJACENT_MAX_GAP_M;
}
