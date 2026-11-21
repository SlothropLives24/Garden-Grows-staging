import './chunk-ejg0q7q9.js';
import { isSouthern, mmddDoyOf, seasonDoy, fmtMonthDay, el, monthLong, monthShort, seed } from './core.js';
import { copy, fillCopy } from './paint.js';

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const TINT = ["leaf-1", "leaf-2", "leaf-3", "leaf-4"];
const MID = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
const NAMED = [0, 3, 6, 9];
const LETTER_MAX = 8;
const FOLD_ORDER = ["season", "frost", "crop", "many", "planned", "indoor", "last", "today"];
function mod(a, n) {
    const r = a % n;
    return r < 0 ? r + n : r === 0 ? 0 : r;
}
function fix(n, k) {
    const m = 10 ** k;
    const q = Math.floor(Math.abs(n) * m + 0.5);
    const whole = Math.floor(q / m), frac = q % m;
    const s = String(whole) + (frac ? "." + String(frac).padStart(k, "0").replace(/0+$/, "") : "");
    return n < 0 && q > 0 ? "-" + s : s;
}
const f = (n) => fix(n, 1);
const f2 = (n) => fix(n, 2);
const ang = (d) => mod((d / 365) * 360 + 180, 360);
function P(r, a) {
    const t = a * (Math.PI / 180);
    return [r * Math.sin(t), -r * Math.cos(t)];
}
function smooth(a, b, x) {
    if (b <= a)
        return x >= b ? 1.0 : 0.0;
    const t = Math.max(0.0, Math.min(1.0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}
const poly = (pts, close = true) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + (close ? "Z" : "");
class Dice {
    s;
    constructor(seed) { this.s = seed >>> 0; }
    random() {
        this.s = (this.s + 0x6d2b79f5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t = (t ^ ((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0)) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    uniform(a, b) { return a + (b - a) * this.random(); }
}
function seedOf(text) {
    let h = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(text))
        h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    return h;
}
class Place {
    seed;
    lf;
    ff;
    a;
    b;
    rise_t;
    fall_t;
    start;
    end;
    F;
    S;
    constructor(seed, spring = [], fall = []) {
        this.seed = seed;
        const sp = spring.map(([d, p]) => [d, p]).sort((x, y) => y[1] - x[1]);
        const fa = fall.map(([d, p]) => [d, p]).sort((x, y) => x[1] - y[1]);
        this.lf = sp.length && sp[0][1] === 0.5 ? sp[0][0] : null;
        this.ff = fa.length && fa[fa.length - 1][1] === 0.5 ? fa[fa.length - 1][0] : null;
        if (fa.length)
            this.start = fa[0][0];
        else if (sp.length)
            this.start = mod(sp[0][0], 365) < 182.5 ? 0.0 : sp[0][0];
        else
            this.start = 0.0;
        this.F = fa.map(([d, p]) => [mod(d - this.start, 365), p]);
        this.S = sp.map(([d, p]) => [mod(d - this.start, 365), p]);
        for (const side of [this.F, this.S])
            for (let i = 1; i < side.length; i++)
                if (side[i][0] < side[i - 1][0])
                    throw new Error("a side's odds do not run in the order of their days: the ring draws no such record");
        if (this.F.length && this.S.length && this.S[0][0] < this.F[this.F.length - 1][0] && this.lf !== null && this.ff !== null)
            throw new Error("the median last frost falls before the median first frost: the ring draws no such record");
        this.end = this.S.length ? this.S[this.S.length - 1][0]
            : fa.length && mod(fa[fa.length - 1][0], 365) > 182.5 ? mod(0.0 - this.start, 365)
                : this.F.length ? this.F[this.F.length - 1][0] : 0.0;
        const a = this.lf !== null ? this.lf : 0.0;
        let b = this.ff !== null ? this.ff : 365.0;
        if (this.lf !== null && this.ff !== null && b <= a)
            b += 365.0;
        this.a = a;
        this.b = b;
        const s10 = sp.filter(([, p]) => p === 0.1).map(([d]) => d);
        const f10 = fa.filter(([, p]) => p === 0.1).map(([d]) => d);
        this.rise_t = s10.length ? mod(s10[0] - a, 365) / (b - a) : 0.0;
        const fx = f10.length ? mod(f10[0] - a, 365) : 0.0;
        this.fall_t = f10.length ? (fx > 0 ? fx : b - a) / (b - a) : 1.0;
    }
    static top(p) { return p === 0.5 ? 1.0 : p; }
    static lerp(pts, x) {
        for (let i = 1; i < pts.length; i++) {
            const [x0, p0] = pts[i - 1], [x1, p1] = pts[i];
            if (x0 <= x && x <= x1)
                return x1 > x0 ? p0 + (p1 - p0) * ((x - x0) / (x1 - x0)) : p1;
        }
        return 0.0;
    }
    rising(x) {
        const F = this.F;
        return x >= F[F.length - 1][0] ? Place.top(F[F.length - 1][1]) : Place.lerp(F, x);
    }
    falling(x) {
        const S = this.S;
        return x <= S[0][0] ? Place.top(S[0][1]) : Place.lerp(S, x);
    }
    odds(d) {
        const x = mod(d - this.start, 365);
        if (!(this.F.length || this.S.length) || x > this.end)
            return 0.0;
        if (this.F.length && this.S.length)
            return x <= (this.F[this.F.length - 1][0] + this.S[0][0]) / 2 ? this.rising(x) : this.falling(x);
        return this.S.length ? this.falling(x) : this.rising(x);
    }
}
class Stem {
    pl;
    R;
    H;
    whole;
    constructor(pl, R = 150, H = 10) {
        this.pl = pl;
        this.R = R;
        this.H = H;
        this.whole = pl.lf === null && pl.ff === null;
    }
    hw(d) {
        const pl = this.pl;
        const x = mod(d - pl.a, 365);
        const span = pl.b - pl.a;
        if (!this.whole && (x <= 0 || x >= span))
            return 0.0;
        const t = x / span;
        return this.H * smooth(0, pl.rise_t, t) * (1 - smooth(pl.fall_t, 1, t)) * (0.76 + 0.24 * Math.sin(Math.PI * t));
    }
    edge(d, side) { return this.R + (side > 0 ? 2 * this.hw(d) * 0.6 : -2 * this.hw(d) * 0.4); }
    path() {
        const d1 = this.pl.a, d2 = this.pl.b;
        const days = [];
        for (let i = 0; i < 111; i++)
            days.push(d1 + ((d2 - d1) * i) / 110);
        const out = days.map((d) => P(this.edge(d, 1) + 0.4, ang(d)));
        const inn = [...days].reverse().map((d) => P(this.edge(d, -1) - 0.4, ang(d)));
        return poly([...out, ...inn]);
    }
}
function frostTicks(st, rng, gap = 3.4, scale = 1.0) {
    const cls = [[], [], []];
    let acc = rng.uniform(0, gap), side = 1, d = 0.0;
    let best_p = 0.0, best_d = 0.0;
    const mark = (d, p, side) => {
        const a = ang(d);
        const L = rng.uniform(5.5, 11.5) * scale * (0.7 + 0.3 * p);
        const th = rng.uniform(34, 50) * (Math.PI / 180);
        const ar = a * (Math.PI / 180);
        const [bx, by] = P(st.R, a);
        const tx = Math.cos(ar), ty = Math.sin(ar);
        const nx = Math.sin(ar) * side, ny = -Math.cos(ar) * side;
        const ex = bx + (tx * Math.cos(th) + nx * Math.sin(th)) * L, ey = by + (ty * Math.cos(th) + ny * Math.sin(th)) * L;
        const cx = bx + tx * L * 0.5 + nx * L * 0.08, cy = by + ty * L * 0.5 + ny * L * 0.08;
        cls[p > 0.8 ? 0 : p > 0.4 ? 1 : 2].push(`M${f(bx)} ${f(by)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}`);
    };
    while (d < 365) {
        const p = st.pl.odds(d);
        if (p > best_p) {
            best_p = p;
            best_d = d;
        }
        acc += p * 0.5;
        if (acc >= gap) {
            acc -= gap;
            side = rng.random() < 0.78 ? -side : side;
            mark(d, p, side);
        }
        d += 0.5;
    }
    if (best_p > 0 && !cls.some((g) => g.length))
        mark(best_d, best_p, side);
    const ops = ["1", "0.72", "0.46"];
    return cls.map((g, i) => [g.join(""), ops[i]]).filter(([g]) => g);
}
function groups(crops) {
    const names = [];
    for (const c of [...crops].sort((x, y) => x.sow - y.sow || x.end - y.end))
        if (!names.includes(c.name))
            names.push(c.name);
    return names.map((n) => [n, crops.filter((c) => c.name === n).sort((x, y) => x.sow - y.sow)]);
}
function lanes(spans) {
    const out = new Map();
    const order = spans.map((_, i) => i).sort((i, j) => spans[j][0] - spans[i][0] || spans[i][1] - spans[j][1]);
    for (const i of order) {
        const over = [...out.keys()].filter((k) => !(spans[i][0] >= spans[k][1] - 5 || spans[i][1] <= spans[k][0] + 5)).map((k) => out.get(k));
        out.set(i, over.length ? 1 + Math.max(...over) : 0);
    }
    return out;
}
function arcPts(r, d1, d2, step = 1.5) {
    const n = Math.max(2, Math.trunc(Math.abs(d2 - d1) / step));
    const pts = [];
    for (let q = 0; q <= n; q++)
        pts.push(P(r, ang(d1 + ((d2 - d1) * q) / n)));
    return pts;
}
const stroke = (tok) => `ys-${tok}`;
const fill = (tok) => `yf-${tok}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function year(pl, opts = {}) {
    const crops = [...(opts.crops ?? [])];
    const today = opts.today ?? null, last = opts.last ?? null, mark = opts.mark ?? false;
    let labels = opts.labels ?? true, months = opts.months ?? true, names = opts.names ?? true;
    const R = opts.R ?? 150, fs = opts.fs ?? 14;
    let H = opts.H ?? 10;
    const today_label = opts.today_label === undefined ? ["today", ""] : opts.today_label;
    const notes = opts.notes ?? [], highlight = opts.highlight ?? null;
    if (mark) {
        labels = months = names = false;
        H = 17;
    }
    const st = new Stem(pl, R, H);
    const mids = opts.mids && opts.mids.length ? opts.mids : MID;
    const rng = opts.rng ?? new Dice(pl.seed * 3 + Math.trunc(R));
    const o = [];
    const ext = [R + 4];
    const have = new Set();
    const gs = groups(crops);
    const spans = gs.map(([, ps]) => [Math.min(...ps.map((c) => (c.indoor !== null ? c.indoor : c.sow))), Math.max(...ps.map((c) => c.end))]);
    const lane_of = gs.length ? lanes(spans) : new Map();
    const nl = lane_of.size ? Math.max(...lane_of.values()) + 1 : 0;
    const few = nl <= 4;
    const pitch = few ? (mark ? 23 : 16.5) : Math.max(3.3, 76 / nl);
    const R0 = R - (mark ? 27 : 21);
    const lane_r = (l) => R0 - pitch * l;
    const w1 = few ? (mark ? 5.4 : 3.1) : Math.min(2.0, pitch * 0.46);
    const wadd = few ? 2.3 : Math.min(1.5, pitch * 0.3);
    const wmax = few ? 12 : pitch - 1.1;
    const deep = R0 - lane_r(Math.max(0, nl - 1)) + (nl ? wmax : 0);
    let r_last = null;
    if (last !== null) {
        r_last = Math.min(R - 88, R0 - deep - 16);
        const s2 = new Stem(pl, r_last, H * 0.5);
        o.push(`<g opacity="0.5"><circle r="${f(r_last)}" class="${stroke("frost")}" stroke-width="1"/>`
            + `<path d="${s2.path()}" class="${fill("season")}"/>`
            + frostTicks(s2, opts.last_rng ?? new Dice(pl.seed * 3 + Math.trunc(r_last)), 7, 0.7)
                .map(([d, op]) => `<path d="${d}" class="${stroke("frost")} yr-cap" stroke-width="1" opacity="${op}"/>`).join(""));
        const rl9 = r_last - 9;
        const dd = (last.days ?? []).map((d) => { const [x, y] = P(rl9, ang(d)); return `M${f(x)} ${f(y)}h.01`; }).join("");
        if (dd)
            o.push(`<path d="${dd}" class="${stroke("cream")} yr-cap" stroke-width="3.4"/>`);
        o.push("</g>");
        have.add("last");
    }
    o.push(`<circle r="${f(R)}" class="${stroke("frost")}" stroke-width="${mark ? 3.4 : 1.3}"/>`);
    const ticks = frostTicks(st, rng, mark ? 9 : 3.4, mark ? 2.2 : 1.0);
    o.push(ticks.map(([d, op]) => `<path d="${d}" class="${stroke("frost")} yr-cap" stroke-width="${mark ? 3.2 : 1.3}" opacity="${op}"/>`).join(""));
    if (ticks.length)
        have.add("frost");
    ext.push(R + (mark ? 28 : 12));
    o.push(`<path d="${st.path()}" class="${fill("season")}"/>`);
    have.add("season");
    const lettered = names && gs.length > 1 && gs.length <= LETTER_MAX;
    const ends = [];
    const busy = [];
    const key = gs.map(([n, ps], gi) => [lettered ? LETTERS[gi % 26] : null, n, ps.length, gs.length === 1 ? "leaf-0" : TINT[lane_of.get(gi) % 4]]);
    gs.forEach(([name, ps], gi) => {
        const l = lane_of.get(gi);
        const rl = lane_r(l);
        let tok = ps[0].tint || (gs.length === 1 ? "leaf-0" : TINT[l % 4]);
        const dim = highlight !== null && !highlight.includes(name);
        if (highlight !== null && !dim)
            tok = "today";
        const a0 = Math.min(...ps.map((c) => c.sow)), a1 = Math.max(...ps.map((c) => c.end));
        const cnt = (d) => ps.filter((c) => c.sow <= d && d < c.end).length;
        const width = (d) => Math.min(wmax, w1 + wadd * Math.max(0.0, (cnt(d - 3) + cnt(d - 1.5) + cnt(d) + cnt(d + 1.5) + cnt(d + 3)) / 5 - 1));
        const filled = ps.some((c) => c.filled);
        const g = [];
        const lead = few && ps[0].indoor === null ? Math.min(9.0, (a1 - a0) * 0.28) : 0.0;
        const rc = (d) => {
            if (lead === 0)
                return rl;
            const e = st.edge(d, -1) - 1.2;
            const t = Math.min(1.0, (d - a0) / lead);
            return e + (rl - e) * (t * t * (3 - 2 * t));
        };
        const n = Math.max(6, Math.trunc((a1 - a0) / 1.5));
        const days = [];
        for (let q = 0; q <= n; q++)
            days.push(a0 + ((a1 - a0) * q) / n);
        if (filled) {
            const out = days.map((d) => P(rc(d) + width(d) / 2, ang(d)));
            const inn = days.map((d) => P(rc(d) - width(d) / 2, ang(d)));
            g.push(`<path d="${poly([...out, ...inn.reverse()])}" class="${stroke(tok)} ${fill(tok)} yr-join" stroke-width="${few ? 1 : 0.4}"/>`);
        }
        else {
            g.push(`<path d="${poly(days.map((d) => P(rc(d), ang(d))), false)}" class="${stroke(tok)} yr-cap yr-join"`
                + ` stroke-width="${f2(w1 * 0.8)}" stroke-dasharray="${f(w1 * 1.7)} ${f(w1 * 1.5)}"/>`);
            have.add("planned");
        }
        if (ps[0].indoor !== null && few) {
            const ip = arcPts(rl, ps[0].indoor, a0 + 1);
            g.push(`<path d="${poly(ip, false)}" class="${stroke(tok)} yr-cap" stroke-width="${f2(w1 * 0.8)}"`
                + ` stroke-dasharray="0 ${f(w1 * 2)}"/><circle cx="${f(ip[0][0])}" cy="${f(ip[0][1])}" r="${f(w1 * 1.15)}" class="${fill(tok)}"/>`);
            have.add("indoor");
        }
        for (const c of ps) {
            const [x, y] = P(rl, ang(c.end));
            const r_ = few ? w1 * 1.45 : Math.max(1.25, Math.min(2.4, pitch * 0.42));
            if (c.filled)
                g.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r_)}" class="${fill(tok)}"/>`);
            else
                g.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r_)}" class="${stroke(tok)} ${fill("under")}" stroke-width="${f(Math.max(0.9, r_ * 0.45))}"/>`);
        }
        if (ps.length > 1)
            have.add("many");
        o.push(`<g class="yr-crop${few ? " yr-unfurl" : ""}" style="--i:${gi + 1}"` + (dim ? ' opacity="0.28"' : "") + ">" + g.join("") + "</g>");
        busy.push([spans[gi][0] - 4, a1 + 22, rl, a0]);
        if (lettered)
            ends.push([rl, a1 + ((w1 * 1.45 + 11) / (2 * Math.PI * rl)) * 365, LETTERS[gi % 26]]);
    });
    if (gs.length)
        have.add("crop");
    const placed = [];
    const boxes = [];
    for (const [rl, d0, ch] of ends) {
        let d = d0, x = 0, y = 0;
        for (let i = 0; i < 10; i++) {
            [x, y] = P(rl, ang(d));
            if (placed.every(([a, b]) => (x - a) * (x - a) + (y - b) * (y - b) > fs * 0.92 * (fs * 0.92)))
                break;
            d += 3.5;
        }
        placed.push([x, y]);
        boxes.push([x - 9, y - 10, x + 9, y + 10]);
        o.push(`<text x="${f(x)}" y="${f(y)}" dy=".34em" class="yr-letter ${fill("cream")}" font-size="${f(fs + 3)}">${ch}</text>`);
    }
    const skip = new Set();
    const outside = [];
    const exty = [];
    const clear = (x0, y0, x1, y1) => {
        if (boxes.some((q) => !(x1 < q[0] || x0 > q[2] || y1 < q[1] || y0 > q[3])))
            return false;
        for (let u = 0; u < 6; u++) {
            for (let v = 0; v < 4; v++) {
                const x = x0 + ((x1 - x0) * u) / 5;
                const y = y0 + ((y1 - y0) * v) / 3;
                const r = Math.sqrt(x * x + y * y);
                const d = (mod(Math.atan2(x, -y) * (180 / Math.PI) - 180, 360) / 360) * 365;
                if (r > st.edge(d, -1) - 4.5)
                    return false;
                if (r_last !== null && Math.abs(r - r_last) < 13 && r < r_last + 9)
                    return false;
                for (const [a_, b_, rl_, sow_] of busy) {
                    if (a_ <= d && d <= b_ && Math.abs(r - rl_) < (few ? 11 : pitch + 4))
                        return false;
                    if (few && sow_ - 3 <= d && d <= sow_ + 11 && r > rl_ - 6)
                        return false;
                }
            }
        }
        return true;
    };
    const label = (d, txt, sub = "") => {
        const a = ang(d);
        const wdt = Math.max([...txt].length * fs * 0.57, [...sub].length * (fs - 2.5) * 0.5);
        const top = fs * 0.8;
        const bot = fs * (sub ? 1.75 : 0.5);
        let x = 0, yy = 0, anchor = "middle", found = false;
        for (let r0 = Math.trunc(R - 13); r0 > 44; r0 -= 5) {
            let y;
            [x, y] = P(r0, a);
            anchor = x < -22 ? "start" : x > 22 ? "end" : "middle";
            const x0 = anchor === "start" ? x : anchor === "end" ? x - wdt : x - wdt / 2;
            yy = y + (anchor === "middle" && y < 0 ? fs * 0.9 : anchor === "middle" ? -fs * 0.6 : 0);
            if (clear(x0 - 3, yy - top - 2, x0 + wdt + 3, yy + bot + 2)) {
                boxes.push([x0 - 3, yy - top - 2, x0 + wdt + 3, yy + bot + 2]);
                found = true;
                break;
            }
        }
        if (!found) {
            [x, yy] = P(R + 22, a);
            anchor = x >= 0 ? "start" : "end";
            if (Math.abs(x) < 46) {
                anchor = "middle";
                yy += yy < 0 ? -16 : 12;
            }
            const x0 = anchor === "start" ? x : anchor === "end" ? x - wdt : x - wdt / 2;
            const box = [x0 - 3, yy - top - 2, x0 + wdt + 3, yy + bot + 2];
            if (outside.some((q) => !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3])))
                return "";
            outside.push(box);
            mids.forEach((mdoy, mi) => { if (Math.abs(mod(mdoy - d + 182, 365) - 182) < 17)
                skip.add(mi); });
            ext.push(Math.abs(x) + (anchor !== "middle" ? wdt : wdt / 2) + 2);
            exty.push(Math.max(Math.abs(box[1]), Math.abs(box[3])));
        }
        return `<text x="${f(x)}" y="${f(yy)}" text-anchor="${anchor}" class="yr-lab ${fill("soft")}" font-size="${f(fs - 2.5)}">`
            + `<tspan class="yr-date ${fill("cream")}" font-size="${f(fs)}">${esc(txt)}</tspan>`
            + (sub ? `<tspan x="${f(x)}" dy="1.2em">${esc(sub)}</tspan>` : "") + "</text>";
    };
    const lab = [];
    if (labels && opts.frost_labels)
        for (const [day, pair] of opts.frost_labels)
            lab.push(label(day, pair[0], pair.length > 1 ? pair[1] : ""));
    for (const nt of notes)
        lab.push(label(nt[0], nt[1], nt.length > 2 ? nt[2] : ""));
    if (today !== null) {
        const [tx, ty] = P(R, ang(today));
        const rr = !mark ? Math.max(4.6, H * 0.56) : 13;
        o.push(`<g class="yr-hand" style="--sw:${f(mod(ang(today) - 180, 360))}deg"><circle cx="${f(tx)}" cy="${f(ty)}" r="${f(rr * 2.3)}" class="${fill("today")}" opacity="0.2"/>`
            + `<circle cx="${f(tx)}" cy="${f(ty)}" r="${f(rr)}" class="${stroke("under")} ${fill("today")}" stroke-width="${!mark ? 2 : 4}"/></g>`);
        have.add("today");
        if (labels && today_label && today_label[0])
            lab.push(label(today, today_label[0], today_label.length > 1 ? today_label[1] : ""));
    }
    if (months) {
        ext.push(R + 42);
        const mn = opts.month_names && opts.month_names.length ? opts.month_names : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        o.push(`<g class="yr-months ${fill("soft")}" font-size="${f(fs)}">`
            + NAMED.filter((mi) => !skip.has(mi)).map((mi) => { const [x, y] = P(R + 29, ang(mids[mi])); return `<text x="${f(x)}" y="${f(y)}">${esc(mn[mi])}</text>`; }).join("") + "</g>");
        const dots = mids.map((_, mi) => mi).filter((mi) => !NAMED.includes(mi) && !skip.has(mi))
            .map((mi) => { const [x, y] = P(R + 24, ang(mids[mi])); return `M${f(x)} ${f(y)}h.01`; }).join("");
        o.push(`<path d="${dots}" class="${stroke("soft")} yr-cap" stroke-width="2.6" opacity="0.7"/>`);
    }
    o.push(...lab);
    const X = Math.max(...ext) + (!mark ? 8 : 6);
    const Y = Math.max(Math.max(R + (months ? 40 : !mark ? 18 : 32), R + 18) + 4, ...exty);
    return { svg: o.join(""), viewBox: `${f(-X)} ${f(-Y)} ${f(2 * X)} ${f(2 * Y)}`, key, marks: FOLD_ORDER.filter((k) => have.has(k)) };
}
function held(crops, d0, d1, span) {
    const out = [];
    for (const c of crops) {
        for (const k of [0, -365, 365]) {
            if (c.end + k > d0 + span * 0.02 && c.sow + k < d1 - span * 0.02) {
                out.push(k ? { ...c, sow: c.sow + k, end: c.end + k, indoor: c.indoor === null ? null : c.indoor + k } : c);
                break;
            }
        }
    }
    return out;
}
function stretch(pl, d0, d1, opts = {}) {
    const today = opts.today ?? null, ticks = opts.ticks ?? [], W = opts.W ?? 358, m = opts.m ?? 20, arch = opts.arch ?? 9;
    const week = opts.week ?? null, fs = opts.fs ?? 12, frost = opts.frost ?? false, names = opts.names ?? true;
    if (!(d1 > d0))
        throw new Error("a stretch runs forward: it ends after it begins");
    const st = new Stem(pl, 150, 10);
    const base = 56;
    const span = d1 - d0;
    const crops = held(opts.crops ?? [], d0, d1, span);
    const rng = opts.rng ?? new Dice(pl.seed + Math.trunc(W));
    const have = new Set();
    const X = (d) => m + ((d - d0) / span) * (W - 2 * m);
    const Y = (d, off) => base - arch * Math.sin(Math.PI * Math.max(0.0, Math.min(1.0, (d - d0) / span))) + off;
    const gs = groups(crops);
    const spans = gs.map(([, ps]) => [Math.min(...ps.map((c) => c.sow)), Math.max(...ps.map((c) => c.end))]);
    const lane_of = gs.length ? lanes(spans) : new Map();
    const nl = lane_of.size ? Math.max(...lane_of.values()) + 1 : 0;
    const few = nl <= 5;
    const pitch = few ? 21 : Math.max(4.2, 104 / nl);
    const w1 = few ? 3.1 : Math.min(2.2, pitch * 0.46);
    const wadd = few ? 2.3 : Math.min(1.6, pitch * 0.3);
    const wmax = few ? 12 : pitch - 1.1;
    const Ht = Math.trunc(base + 24 + pitch * Math.max(1, nl) + 16);
    const o = [];
    const steps = [];
    for (let i = 0; i < 61; i++)
        steps.push(d0 - 3 + ((span + 6) * i) / 60);
    o.push(`<path d="${poly(steps.map((d) => [X(d), Y(d, 0)]), false)}" class="${stroke("frost")}" stroke-width="1.3"/>`);
    if (frost) {
        const cls = [[], [], []];
        const gp = 2.6;
        let acc = rng.uniform(0, gp), side = 1, d = d0;
        let best_p = 0.0, best_d = 0.0;
        const tick = (d, p, side) => {
            const L = rng.uniform(5.5, 11.5) * (0.7 + 0.3 * p);
            const th = rng.uniform(34, 50) * (Math.PI / 180);
            const bx = X(d), by = Y(d, 0);
            cls[p > 0.8 ? 0 : p > 0.4 ? 1 : 2].push(`M${f(bx)} ${f(by)}Q${f(bx + L * 0.5)} ${f(by - side * L * 0.08)} ${f(bx + Math.cos(th) * L)} ${f(by - side * Math.sin(th) * L)}`);
        };
        while (d < d1) {
            const p = pl.odds(d);
            if (p > best_p) {
                best_p = p;
                best_d = d;
            }
            acc += p * 0.5;
            if (acc >= gp) {
                acc -= gp;
                side = rng.random() < 0.78 ? -side : side;
                tick(d, p, side);
            }
            d += 0.5;
        }
        if (best_p > 0 && !cls.some((g) => g.length))
            tick(best_d, best_p, side);
        const ops = ["1", "0.72", "0.46"];
        o.push(cls.map((g, i) => [g, ops[i]]).filter(([g]) => g.length)
            .map(([g, op]) => `<path d="${g.join("")}" class="${stroke("frost")} yr-cap" stroke-width="1.3" opacity="${op}"/>`).join(""));
        if (cls.some((g) => g.length))
            have.add("frost");
    }
    const on = steps.filter((d) => st.hw(d) > 0);
    if (on.length) {
        const top = on.map((d) => [X(d), Y(d, -2 * st.hw(d) * 0.6 - 0.4)]);
        const bottom = [...on].reverse().map((d) => [X(d), Y(d, 2 * st.hw(d) * 0.4 + 0.4)]);
        o.push(`<path d="${poly([...top, ...bottom])}" class="${fill("season")}"/>`);
        have.add("season");
    }
    const lettered = names && gs.length > 1 && gs.length <= LETTER_MAX;
    const letters = [];
    const key = gs.map(([n, ps], gi) => [lettered ? LETTERS[gi % 26] : null, n, ps.length, gs.length === 1 ? "leaf-0" : TINT[lane_of.get(gi) % 4]]);
    gs.forEach(([, ps], gi) => {
        const l = lane_of.get(gi);
        const off = 24 + pitch * l + pitch * 0.5;
        const tok = ps[0].tint || (gs.length === 1 ? "leaf-0" : TINT[l % 4]);
        const a0 = Math.min(...ps.map((c) => c.sow)), a1 = Math.max(...ps.map((c) => c.end));
        const va = Math.max(a0, d0 - 3), vb_ = Math.min(a1, d1 + 3);
        const cnt = (d) => ps.filter((c) => c.sow <= d && d < c.end).length;
        const w = (d) => Math.min(wmax, w1 + wadd * Math.max(0.0, (cnt(d - 1) + cnt(d) + cnt(d + 1)) / 3 - 1));
        const lead = few ? span * 0.07 : 0;
        const yc = (d) => {
            if (lead === 0 || a0 < d0 - 3)
                return Y(d, off);
            const e = 2 * st.hw(d) * 0.4 + 1;
            const t = Math.min(1.0, (d - a0) / lead);
            return Y(d, e + (off - e) * (t * t * (3 - 2 * t)));
        };
        const n = 24;
        const days = [];
        for (let q = 0; q <= n; q++)
            days.push(va + ((vb_ - va) * q) / n);
        const g = [];
        if (ps.some((c) => c.filled)) {
            const top = days.map((d) => [X(d), yc(d) - w(d) / 2]);
            const bottom = [...days].reverse().map((d) => [X(d), yc(d) + w(d) / 2]);
            g.push(`<path d="${poly([...top, ...bottom])}" class="${stroke(tok)} ${fill(tok)} yr-join" stroke-width="${few ? 1 : 0.4}"/>`);
        }
        else {
            g.push(`<path d="${poly(days.map((d) => [X(d), yc(d)]), false)}" class="${stroke(tok)} yr-cap"`
                + ` stroke-width="${f2(w1 * 0.8)}" stroke-dasharray="${f(w1 * 1.7)} ${f(w1 * 1.5)}"/>`);
            have.add("planned");
        }
        for (const c of ps) {
            if (d0 - 1 <= c.end && c.end <= d1 + 1) {
                const r_ = few ? w1 * 1.45 : Math.max(1.3, Math.min(2.4, pitch * 0.42));
                if (c.filled)
                    g.push(`<circle cx="${f(X(c.end))}" cy="${f(Y(c.end, off))}" r="${f(r_)}" class="${fill(tok)}"/>`);
                else
                    g.push(`<circle cx="${f(X(c.end))}" cy="${f(Y(c.end, off))}" r="${f(r_)}" class="${stroke(tok)} ${fill("under")}" stroke-width="${f(Math.max(0.9, r_ * 0.45))}"/>`);
            }
        }
        if (ps.length > 1)
            have.add("many");
        o.push(`<g class="yr-crop${few ? " yr-unfurl" : ""}" style="--i:${gi + 1}">` + g.join("") + "</g>");
        if (lettered) {
            const lx = a1 <= d1 - span * 0.07 ? X(a1) + 13 : a0 >= d0 + span * 0.09 ? X(a0) - 11 : m - 9;
            letters.push([Math.max(8, Math.min(W - 8, lx)), Y(Math.min(Math.max(a1 <= d1 - span * 0.07 ? a1 : a0, d0), d1), off), LETTERS[gi % 26]]);
        }
    });
    if (gs.length)
        have.add("crop");
    for (const [x, y, ch] of letters)
        o.push(`<text x="${f(x)}" y="${f(y)}" dy=".34em" class="yr-letter ${fill("cream")}" font-size="${f(fs + 3)}">${ch}</text>`);
    if (week) {
        const wk = [];
        for (let i = 0; i < 13; i++) {
            const d = week[0] + ((week[1] - week[0]) * i) / 12;
            wk.push([X(d), Y(d, -40)]);
        }
        o.push(`<path d="${poly(wk, false)}" class="${stroke("today")} yr-cap" stroke-width="2.5"/>`);
    }
    for (const [d, lab, bold] of ticks) {
        o.push(`<text x="${f(X(d))}" y="${f(Y(d, -24))}" class="yr-tick${bold ? " yr-tickb" : ""} ${fill(bold ? "cream" : "soft")}" font-size="${f(fs)}">${esc(lab)}</text>`);
    }
    if (today !== null) {
        const tx = X(today), ty = Y(today, -2 * st.hw(today) * 0.1);
        o.push(`<circle cx="${f(tx)}" cy="${f(ty)}" r="13" class="${fill("today")}" opacity="0.2"/>`
            + `<circle cx="${f(tx)}" cy="${f(ty)}" r="6" class="${stroke("under")} ${fill("today")}" stroke-width="2"/>`);
        have.add("today");
    }
    return { svg: o.join(""), viewBox: `0 0 ${f(W)} ${Ht}`, key, marks: FOLD_ORDER.filter((k) => have.has(k)) };
}
function foldRows(marks, words) {
    const rows = FOLD_ORDER.filter((k) => marks.includes(k)).map((k) => [k, words[`how_${k}`]]);
    rows.push(["turn", words.how_turn]);
    return rows;
}
function swatch(mark) {
    const inner = {
        season: `<path d="M2 9C10 3 24 3 32 7C24 12 10 12 2 9Z" class="${fill("season")}"/>`,
        frost: `<path d="M1 8H33" class="${stroke("frost")}" stroke-width="1.3"/>`
            + `<path d="M5 8l5-4M12 8l5 4M19 8l5-4M26 8l5 4" class="${stroke("frost")} yr-cap" stroke-width="1.3"/>`,
        crop: `<path d="M3 7H25" class="${stroke("leaf-2")} yr-cap" stroke-width="3.2"/><circle cx="28" cy="7" r="4" class="${fill("leaf-2")}"/>`,
        many: `<path d="M2 7C8 6 12 3.5 17 3.5S26 6 32 6.5C26 8 22 10.5 17 10.5S8 8 2 7Z" class="${fill("leaf-3")}"/>`,
        planned: `<path d="M3 7H31" class="${stroke("leaf-3")} yr-cap" stroke-width="2.6" stroke-dasharray="5 4.5"/>`,
        indoor: `<path d="M3 7H31" class="${stroke("leaf-2")} yr-cap" stroke-width="2.6" stroke-dasharray="0 6"/>`,
        last: `<path d="M2 9C10 4 24 4 32 7.5C24 11.5 10 11.5 2 9Z" class="${fill("season")}" opacity="0.5"/>`,
        today: `<circle cx="17" cy="7" r="9" class="${fill("today")}" opacity="0.2"/><circle cx="17" cy="7" r="4.4" class="${fill("today")}"/>`,
    };
    const body = inner[mark] ?? "";
    return body ? `<svg class="yr-sw" aria-hidden="true" focusable="false" viewBox="0 0 34 14" width="34" height="14">${body}</svg>` : "";
}
function keySwatch(tint) {
    return `<svg class="yr-ksw" aria-hidden="true" focusable="false" viewBox="0 0 22 10" width="22" height="10">`
        + `<path d="M2 5H15" class="${stroke(tint)} yr-cap" stroke-width="3"/><circle cx="17.5" cy="5" r="3.6" class="${fill(tint)}"/></svg>`;
}

const ODDS = [["p50", 0.5], ["p40", 0.4], ["p30", 0.3], ["p20", 0.2], ["p10", 0.1]];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function ringDay(mmdd, lat) {
    const doy = mmddDoyOf(mmdd);
    return doy == null ? null : seasonDoy(doy, lat);
}
function datedButNotDrawn(site) {
    const s = site ?? {};
    const wholeYear = !!s.frost_free || (s.growing_season_days_p50 ?? 0) >= 365;
    const median = s.last_frost_32f?.p50 || s.first_freeze_32f?.p50 || s.first_freeze_32f_p50;
    return wholeYear && !!median;
}
function frostSides(site) {
    if (datedButNotDrawn(site))
        return [[], []];
    const lf = site?.last_frost_32f ?? {};
    const ff = { ...(site?.first_freeze_32f ?? {}) };
    if (!ff.p50 && site?.first_freeze_32f_p50)
        ff.p50 = site.first_freeze_32f_p50;
    const side = (rec) => ODDS.filter(([k]) => !!rec[k]).map(([k, p]) => [rec[k], p]);
    return [side(lf), side(ff)];
}
function frostRing(site, lat) {
    const [spring, fall] = frostSides(site);
    const ring = (s) => s.map(([d, p]) => [ringDay(d, lat), p]);
    return [ring(spring), ring(fall)];
}
function frostPlace(site, sid, lat) {
    const [spring, fall] = frostRing(site, lat);
    return new Place(seedOf(String(sid)), spring, fall);
}
function ringMonths(lat) {
    if (!isSouthern(lat))
        return { order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mids: [...MID] };
    const order = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    const mids = [];
    let cum = 0;
    for (const m of order) {
        mids.push(cum + 15);
        cum += MONTH_DAYS[m - 1];
    }
    return { order, mids };
}
function cropLine(name, sow, days, lat, o = {}) {
    const d0 = ringDay(sow && sow.length > 5 ? sow.slice(5) : sow, lat);
    if (d0 == null || typeof days !== "number" || !(days > 0))
        return null;
    let din = o.indoor ? ringDay(o.indoor.length > 5 ? o.indoor.slice(5) : o.indoor, lat) : null;
    if (din != null && din >= d0)
        din = null;
    return { name, sow: d0, end: d0 + Math.trunc(days), filled: !!o.filled, indoor: din, tint: null };
}

let yearCss = null;
function ensureYearCss() {
    if (yearCss)
        return yearCss;
    let link = document.getElementById("yearring-css");
    if (link?.sheet)
        return (yearCss = Promise.resolve(true));
    const made = !link;
    if (!link) {
        link = document.createElement("link");
        link.id = "yearring-css";
        link.rel = "stylesheet";
        link.href = "./yearring.css";
    }
    const el0 = link;
    yearCss = new Promise((done) => {
        el0.addEventListener("load", () => done(true), { once: true });
        el0.addEventListener("error", () => { yearCss = null; el0.remove(); done(false); }, { once: true });
    });
    if (made) {
        const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
        (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
    }
    return yearCss;
}
function drawYearInto(host, draw, key = "") {
    const put = (ok) => {
        const fig = ok && host.isConnected ? draw() : null;
        host.removeAttribute("aria-busy");
        if (fig && key) {
            if (settledFigs.has(key))
                fig.classList.add("yr-still");
            settledFigs.add(key);
        }
        if (fig)
            host.replaceChildren(fig);
        else
            host.hidden = true;
    };
    if (document.getElementById("yearring-css")?.sheet) {
        host.isConnected ? put(true) : queueMicrotask(() => put(true));
        return;
    }
    host.setAttribute("aria-busy", "true");
    void ensureYearCss().then(put);
}
const settledFigs = new Set();
let twins = 0;
const HOW = [["how_season", "yrHowSeason"], ["how_frost", "yrHowFrost"], ["how_crop", "yrHowCrop"],
    ["how_many", "yrHowMany"], ["how_planned", "yrHowPlanned"], ["how_indoor", "yrHowIndoor"], ["how_last", "yrHowLast"], ["how_today", "yrHowToday"]];
function svgOf(inner, viewBox, aria) {
    const box = document.createElement("div");
    box.innerHTML = `<svg class="yr-fig" viewBox="${viewBox}">${inner}</svg>`;
    const svg = box.firstElementChild;
    if (aria) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", aria);
    }
    else
        svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
}
const markOf = (html) => {
    const box = document.createElement("span");
    box.innerHTML = html;
    return box.firstElementChild ?? box;
};
function keyOf(rows, o, pick) {
    const named = rows.filter((k) => k[0] || rows.length > 1 || o.all);
    if (!named.length && !o.last)
        return null;
    const key = el("p", "yr-key");
    if (o.keyhead)
        key.appendChild(el("span", "yr-keyh", o.keyhead));
    let lit = null;
    const buttons = [];
    for (const k of named) {
        const n = o.counts?.get(k[1]) ?? (k[2] > 1 ? k[2] : 0);
        const row = pick ? el("button", "yr-pick") : el("span");
        row.append(markOf(keySwatch(k[3])));
        if (k[0])
            row.append(el("i", null, k[0]));
        row.append(` ${n > 1 || o.counts?.has(k[1]) ? fillCopy("yrKeyMany", { name: k[1], n }) : k[1]}`);
        if (pick) {
            const b = row;
            b.type = "button";
            b.dataset.crop = k[1];
            b.setAttribute("aria-pressed", "false");
            b.addEventListener("click", () => {
                lit = lit === k[1] ? null : k[1];
                for (const x of buttons)
                    x.setAttribute("aria-pressed", String(x.dataset.crop === lit));
                pick(lit);
            });
            buttons.push(b);
        }
        key.appendChild(row);
    }
    if (o.last) {
        const row = el("span", "yr-klast");
        row.append(el("span", "yr-klastm"), ` ${copy.yrKeyLast}`);
        key.appendChild(row);
    }
    if (pick && buttons.length) {
        key.setAttribute("role", "group");
        key.setAttribute("aria-label", copy.yrKeyPick);
    }
    return key;
}
function foldOf(figure, fig, twinText, turn) {
    const words = { how_turn: turn };
    for (const [k, key] of HOW)
        words[k] = copy[key];
    const rows = el("ul", "yr-rows");
    for (const [mark, text] of foldRows(fig.marks, words)) {
        const li = el("li", mark === "turn" ? "yr-turn" : null);
        const sw = swatch(mark);
        if (sw)
            li.appendChild(markOf(sw));
        li.appendChild(el("span", null, text));
        rows.appendChild(li);
    }
    const twin = twinText ? el("p", "yr-twin", twinText) : null;
    if (twin) {
        twin.id = `yrtwin-${++twins}`;
        figure.querySelector("svg.yr-fig")?.setAttribute("aria-describedby", twin.id);
    }
    figure.appendChild(seed({ summary: copy.yrHow, cls: "yr-how" }, ...(twin ? [twin, rows] : [rows])));
}
function yearFigure(o) {
    const south = isSouthern(o.lat);
    const { order, mids } = ringMonths(o.lat);
    const labs = [];
    const lf = ringDay(o.season?.last, o.lat), ff = ringDay(o.season?.first, o.lat);
    if (lf != null)
        labs.push([lf, [fmtMonthDay(o.season.last), copy.yrLastFrost]]);
    if (ff != null)
        labs.push([ff, [fmtMonthDay(o.season.first), copy.yrFirstFrost]]);
    const todayDoy = o.todayIso ? mmddDoyOf(o.todayIso.slice(5)) : null;
    const draw = (highlight) => year(o.place, {
        crops: o.crops ?? [], frost_labels: labs, month_names: order.map((m) => monthShort(m - 1)), mids, last: o.last ?? null,
        ...(todayDoy != null ? { today: seasonDoy(todayDoy, o.lat), today_label: [copy.yrToday, fmtMonthDay(o.todayIso)] } : {}),
        ...(o.small ? { labels: false, months: false, names: false } : {}),
        ...(highlight ? { highlight: [highlight] } : {}),
    });
    let fig;
    try {
        fig = draw(null);
    }
    catch {
        return null;
    }
    const figure = el("figure", `yr${o.band ? " yr-band" : ""}${o.small ? " yr-small" : ""}`);
    const svg = svgOf(fig.svg, fig.viewBox, o.small && !o.aria ? null : o.aria);
    figure.appendChild(svg);
    if (o.small)
        return figure;
    const key = keyOf(fig.key, { keyhead: o.keyhead, counts: o.counts, last: !!o.last, all: !!o.counts }, o.pick ? (name) => { try {
        figure.classList.add("yr-still");
        svg.innerHTML = draw(name).svg;
    }
    catch { } } : null);
    if (key)
        figure.appendChild(key);
    if (o.says)
        figure.appendChild(el("p", "yr-says", o.says));
    if (o.src)
        figure.appendChild(el("p", "yr-src", o.src));
    foldOf(figure, fig, o.twin, fillCopy("yrHowTurn", { month: monthLong(south ? 6 : 0) }));
    return figure;
}
function stretchFigure(o) {
    let fig;
    try {
        fig = stretch(o.place, o.from, o.to, { crops: o.crops ?? [], today: o.today ?? null, ticks: o.ticks ?? [], week: o.week ?? null, frost: true, fs: 11 });
    }
    catch {
        return null;
    }
    const figure = el("figure", `yr yr-stretch${o.band ? " yr-band" : ""}`);
    figure.appendChild(svgOf(fig.svg, fig.viewBox, o.aria));
    const key = keyOf(fig.key, { all: true }, null);
    if (key)
        figure.appendChild(key);
    if (o.says)
        figure.appendChild(el("p", "yr-says", o.says));
    return figure;
}

export { cropLine, drawYearInto, ensureYearCss, frostPlace, ringDay, stretch, stretchFigure, yearFigure };
