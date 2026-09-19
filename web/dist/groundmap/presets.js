import { rotPt } from "./geometry.js";
export const lLocalPts = (w, l, nw, nl) => {
    const hw = w / 2, hl = l / 2;
    return [[-hw, hl], [hw - nw, hl], [hw - nw, hl - nl], [hw, hl - nl], [hw, -hl], [-hw, -hl]];
};
export const uLocalPts = (w, l, nw, nl) => {
    const hw = w / 2, hl = l / 2, hn = nw / 2;
    return [[-hw, hl], [-hn, hl], [-hn, hl - nl], [hn, hl - nl], [hn, hl], [hw, hl], [hw, -hl], [-hw, -hl]];
};
export const TROUGH_SEG = 12;
export const troughLocalPts = (w, l) => {
    const r = w / 2, cyy = l / 2 - r;
    const pts = [];
    for (let i = 0; i <= TROUGH_SEG; i++) {
        const a = Math.PI - (Math.PI * i) / TROUGH_SEG;
        pts.push([r * Math.cos(a), cyy + r * Math.sin(a)]);
    }
    for (let i = 0; i <= TROUGH_SEG; i++) {
        const a = -(Math.PI * i) / TROUGH_SEG;
        pts.push([r * Math.cos(a), -cyy + r * Math.sin(a)]);
    }
    return pts;
};
export const recogniseL = (pts) => {
    if (pts.length !== 6)
        return null;
    const eps = 0.02;
    for (let i = 0; i < 6; i++) {
        const a = pts[i], b = pts[(i + 1) % 6];
        if (Math.abs(a[0] - b[0]) > eps && Math.abs(a[1] - b[1]) > eps)
            return null;
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
    if (inner.length !== 1)
        return null;
    if (pts.some((p) => Math.abs(p[0] - maxX) < eps && Math.abs(p[1] - maxY) < eps))
        return null;
    return { w: maxX - minX, l: maxY - minY, nw: maxX - inner[0][0], nl: maxY - inner[0][1],
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};
export const recogniseTrough = (pts) => {
    if (pts.length !== (TROUGH_SEG + 1) * 2)
        return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, l = maxY - minY, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (l < w - 0.02)
        return null;
    const expect = troughLocalPts(w, l);
    for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(pts[i][0] - cx - expect[i][0], pts[i][1] - cy - expect[i][1]) > 0.05)
            return null;
    }
    return { w, l, cx, cy };
};
export const recogniseU = (pts) => {
    if (pts.length !== 8)
        return null;
    const eps = 0.02;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, l = maxY - minY, ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
    const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
    if (inner.length !== 2)
        return null;
    const nw = Math.abs(inner[1][0] - inner[0][0]), nl = maxY - inner[0][1];
    if (nw < 0.05 || nl < 0.05)
        return null;
    const expect = uLocalPts(w, l, nw, nl);
    for (let i = 0; i < 8; i++) {
        if (Math.hypot(pts[i][0] - ccx - expect[i][0], pts[i][1] - ccy - expect[i][1]) > 0.05)
            return null;
    }
    return { w, l, nw, nl, cx: ccx, cy: ccy };
};
export const unrotatePts = (pts, angle) => {
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([x, y]) => { const r = rotPt(x - mx, y - my, -angle); return [mx + r[0], my + r[1]]; });
};
