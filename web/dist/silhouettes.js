import { currentRoute } from "./router.js";
const A = "var(--color-accent-2)";
const W = "var(--color-accent)";
const FULL = [[-15, -9], [0, -16], [15, -9], [-19, 7], [-2, 3], [17, 7], [3, 18], [-11, 19]];
const FEW = [[0, -16], [17, 7], [-11, 19], [-2, 3]];
function dots(pts, r, filled) {
    return pts.map(([x, y]) => filled
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${A}"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${A}" stroke-width="1.6"/>`).join("");
}
function grouping(cx, cy, s) {
    return `<g transform="translate(${cx} ${cy}) scale(${s})">`
        + `<g class="se se-spring">${dots(FULL, 3.3, false)}</g>`
        + `<g class="se se-summer">${dots(FULL, 3.6, true)}</g>`
        + `<g class="se se-autumn">${dots(FEW, 3.6, true)}<circle cx="9" cy="-3" r="3.4" fill="${W}"/></g>`
        + `<g class="se se-winter">${dots([[-2, 3]], 2.4, false)}</g>`
        + `</g>`;
}
function bed(x, y, w, h) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="${A}" fill-opacity=".05" stroke="${A}" stroke-width="1.4" stroke-opacity=".7"/>`;
}
function drip(d) {
    return `<path d="${d}" fill="none" stroke="${W}" stroke-width="1.6" stroke-dasharray="2 7" stroke-linecap="round" opacity=".6"/>`;
}
function ring(cx, cy, r) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${A}" stroke-width="1.4" stroke-dasharray="5 8" opacity=".55"/>`;
}
function bloom(cx, cy, rx, ry) {
    return `<g class="se se-spring"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${A}" opacity=".26"/></g>`
        + `<g class="se se-summer"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${A}" opacity=".32"/></g>`
        + `<g class="se se-autumn"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${W}" opacity=".15"/></g>`;
}
function fnv1a(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++)
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const CONTENT_FAMILY = new Set(["plant", "answers", "log", "review"]);
function pageKey(route) {
    return CONTENT_FAMILY.has(route) ? "content" : route;
}
const empty = () => ({ structure: "", planting: "" });
function merge(into, add) { into.structure += add.structure; into.planting += add.planting; }
const WL = 1000;
function garden(key, HL, bands) {
    const rng = mulberry32(fnv1a(key));
    const between = (lo, hi) => lo + rng() * (hi - lo);
    const base = empty(), m2 = empty(), m3 = empty();
    const bandH = HL / bands;
    let side = rng() < 0.5 ? 0 : 1;
    const cx = [], cy = [];
    for (let i = 0; i < bands; i++) {
        const yMid = bandH * (i + 0.5) + between(-bandH * 0.12, bandH * 0.12);
        const x = side === 0 ? between(150, 330) : between(WL - 330, WL - 150);
        cx.push(x);
        cy.push(yMid);
        const bw = between(170, 235), bh = between(96, 140);
        const gScale = between(1.25, 1.75);
        merge(base, { structure: bed(x - bw / 2, yMid - bh / 2, bw, bh), planting: grouping(x, yMid, gScale) });
        if (rng() < 0.6) {
            const ox = x + (side === 0 ? between(90, 150) : -between(90, 150));
            merge(m2, { structure: "", planting: bloom(x, yMid, between(130, 175), between(80, 105)) + grouping(ox, yMid + between(-30, 30), between(1.0, 1.35)) });
        }
        if (rng() < 0.7) {
            if (rng() < 0.5)
                merge(m3, { structure: ring(x + (side === 0 ? between(120, 200) : -between(120, 200)), yMid + between(-20, 20), between(95, 135)), planting: "" });
            else
                merge(m3, { structure: "", planting: grouping(between(430, 570), yMid + between(-40, 40), between(0.9, 1.2)) });
        }
        side = 1 - side;
    }
    for (let i = 0; i < cx.length - 1; i++) {
        const midY = (cy[i] + cy[i + 1]) / 2;
        const d = `M${cx[i].toFixed(0)} ${cy[i].toFixed(0)} C${cx[i].toFixed(0)} ${midY.toFixed(0)} ${cx[i + 1].toFixed(0)} ${midY.toFixed(0)} ${cx[i + 1].toFixed(0)} ${cy[i + 1].toFixed(0)}`;
        const bucket = i === 0 ? base : (i % 2 === 1 ? m2 : m3);
        bucket.structure += drip(d);
    }
    return { base, m2, m3 };
}
function tier(m) {
    return `<g class="structure">${m.structure}</g><g class="planting">${m.planting}</g>`;
}
function composition(key, HL, bands) {
    const g = garden(key, HL, bands);
    return `<svg viewBox="0 0 ${WL} ${Math.round(HL)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
        + tier(g.base)
        + `<g class="m2">${tier(g.m2)}</g>`
        + `<g class="m3">${tier(g.m3)}</g>`
        + `</svg>`;
}
export function fit(hpx, wpx) {
    const w = Math.max(1, wpx);
    const raw = Math.max(700, (WL * hpx) / w);
    const rung = Math.floor(Math.log(raw / 700) / Math.log(1.12));
    const HL = Math.round(700 * Math.pow(1.12, rung));
    const hFit = (HL * w) / WL;
    const bands = Math.max(1, Math.min(40, Math.round(hFit / Math.max(700, Math.min(950, w * 1.9)))));
    return { HL, bands };
}
export function gardenFor(key, hpx, wpx) {
    const f = fit(hpx, wpx);
    return composition(key, f.HL, f.bands);
}
let lastFit = "";
function render() {
    const host = document.getElementById("silhouettes");
    if (!host)
        return;
    const doc = document.documentElement;
    host.style.height = "0px";
    const wpx = host.clientWidth || doc.clientWidth || 1;
    const hpx = Math.max(doc.scrollHeight, doc.clientHeight);
    host.style.height = hpx + "px";
    const key = pageKey(currentRoute());
    const f = fit(hpx, wpx);
    const sig = `${key}|${f.HL}|${f.bands}`;
    if (sig === lastFit)
        return;
    host.innerHTML = composition(key, f.HL, f.bands);
    lastFit = sig;
}
let scheduled = 0;
function schedule() {
    if (scheduled)
        return;
    scheduled = requestAnimationFrame(() => { scheduled = 0; render(); });
}
let wired = false;
export function mountSilhouettes() {
    render();
    if (wired)
        return;
    wired = true;
    window.addEventListener("hashchange", schedule);
    window.addEventListener("resize", schedule);
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(schedule);
        ro.observe(document.body);
    }
}
