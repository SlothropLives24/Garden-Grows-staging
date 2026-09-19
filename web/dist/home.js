import { needsInsects } from "./engine/forage.js";
import { openSeason as activeSeason, priorSeasons, seasonById, seasonId } from "./session.js";
import { backendConfigured, isSignedIn, signedInEmail } from "./account.js";
import { currentAskCard, daysAway, followAsk } from "./askcard.js";
import { confidenceWord, plantingOnBed } from "./plan.js";
import { category, gardensDueSoon, gardenWideTasks, isOwed, resolveDtm, taskSentence, weekJobs, weekSummary } from "./calendar.js";
import { resolveClimate } from "./engine/intake.js";
import { isExamplePlot } from "./example.js";
import { markLink } from "./dossier.js";
import { plateKey, plateKeyInto, plateMarksInto, plateModel } from "./gardenplate.js";
import { contextBudget, dueRows, gardenFrame, gardenStrip, homeFacts, homeQuestions, plateScale, project, seasonRibbon, sinceAway, welcomeBack, whenLabel } from "./homefacts.js";
import { feedTime, postBody } from "./feed.js";
import { seasonOf } from "./seasonband.js";
import { getPhoto, listPosts, openLog } from "./storage.js";
import { aYearAgoThisWeek } from "./onthisday.js";
import { recollectionLine } from "./diary.js";
import { colorAssigner } from "./groundmap/palette.js";
import { go } from "./nav.js";
import { openNextSeason } from "./nextseason.js";
import { copy } from "./copy.js";
import { app, commonName } from "./state.js";
function wireWhy(a) {
    const h = a.getAttribute("href") ?? "";
    const rule = /#\/why\?rule=(R-\d+)/.exec(h);
    if (rule) {
        markLink(a, { kind: "rule", id: rule[1] });
        return;
    }
    const belief = /#\/why\?belief=(B-\d+)/.exec(h);
    if (belief)
        markLink(a, { kind: "belief", id: belief[1] });
}
const VIEW_W = 440, VIEW_H = 250;
const FIT_FRAC = 0.82;
let glanceCache = null;
const yardCtx = new WeakMap();
const glanceKey = (f, a, plot, extra = "") => `${plot}|${a ? `${a.lat},${a.lon}` : "none"}|${f.cx},${f.cy},${f.w},${f.h}|` +
    `${f.beds.map((b) => `${b.name}:${b.planted}:${b.structure ?? ""}:${b.pts.length}`).join(";")}|` +
    `${f.dots.map((d) => `${d.species}@${d.x},${d.y}`).join(";")}|${extra}`;
const plateSig = (p) => p
    ? `${p.plants.map((x) => `${x.species}:${x.state}@${x.at.join(",")}`).join(";")}#${p.ghosts.map((g) => `${g.species}:${g.year ?? ""}@${g.at.join(",")}`).join(";")}`
    : "";
let figSeq = 0;
function renderGlance(frame, anchor, onBed, onOpen, plate = null, dateline = null) {
    void anchor;
    const NS = "http://www.w3.org/2000/svg";
    const wrap = document.createElement("div");
    wrap.className = "home-view";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "home-glance");
    svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Your garden, drawn from above: ${frame.beds.map((b) => b.name).join(", ")}`);
    const mpp = plateScale(frame, VIEW_W, VIEW_H, FIT_FRAC);
    svg.dataset.mpp = mpp.toFixed(4);
    const proj = { cx: frame.cx, cy: frame.cy, mpp, w: VIEW_W, h: VIEW_H };
    const toPx = (xm, ym) => project([xm, ym], proj);
    const uid = `hg${++figSeq}`;
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML =
        `<pattern id="${uid}-lawn" width="14" height="14" patternUnits="userSpaceOnUse">` +
            `<path class="hg-blade" d="M2 11l1.6-3.4M7 12.5l1.4-3M11 6l1.2-2.6M5 5l1-2.2"/></pattern>` +
            `<pattern id="${uid}-soil" width="7" height="7" patternUnits="userSpaceOnUse">` +
            `<circle class="hg-grain" cx="1.6" cy="1.8" r=".75"/><circle class="hg-grain" cx="5.1" cy="4.6" r=".6"/><circle class="hg-grain" cx="3.4" cy="6.2" r=".45"/></pattern>` +
            `<radialGradient id="${uid}-vig" cx="50%" cy="46%" r="72%">` +
            `<stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".2"/></radialGradient>`;
    svg.append(defs);
    const rect = (cls, fill) => {
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("class", cls);
        r.setAttribute("x", "0");
        r.setAttribute("y", "0");
        r.setAttribute("width", String(VIEW_W));
        r.setAttribute("height", String(VIEW_H));
        if (fill)
            r.setAttribute("fill", fill);
        return r;
    };
    svg.append(rect("hg-ground"), rect("hg-lawnmark", `url(#${uid}-lawn)`), rect("hg-vignette", `url(#${uid}-vig)`));
    for (const bed of frame.beds) {
        const pts = bed.pts.map((p) => toPx(p[0], p[1]));
        const shade = document.createElementNS(NS, "polygon");
        shade.setAttribute("class", "hg-shade");
        shade.setAttribute("points", pts.map(([x, y]) => `${x + 2.5},${y + 3.5}`).join(" "));
        svg.append(shade);
        const poly = document.createElementNS(NS, "polygon");
        const edge = bed.structure === "in_ground" || bed.structure === "field" ? " inground" : "";
        poly.setAttribute("class", (bed.planted ? "hg-bed planted" : "hg-bed") + edge + (plate ? " plate-bed" : ""));
        poly.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
        poly.dataset.bed = bed.name;
        poly.addEventListener("click", (ev) => { ev.stopPropagation(); onBed(bed.name); });
        svg.append(poly);
        const grain = document.createElementNS(NS, "polygon");
        grain.setAttribute("class", "hg-soilgrain");
        grain.setAttribute("fill", `url(#${uid}-soil)`);
        grain.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
        svg.append(grain);
    }
    const nameOf = (sid) => app.speciesName?.(sid) ?? sid;
    if (plate)
        paintMarks(svg, plate, toPx, nameOf);
    const colorOf = colorAssigner();
    const legend = new Map();
    const unit = Math.max(VIEW_W, VIEW_H);
    for (const d of plate ? [] : frame.dots) {
        const [px, py] = toPx(d.x, d.y);
        const colour = colorOf(d.species);
        const name = app.speciesName?.(d.species) ?? d.species;
        if (!legend.has(d.species))
            legend.set(d.species, colour);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "hg-dot");
        c.setAttribute("cx", String(px));
        c.setAttribute("cy", String(py));
        c.setAttribute("r", String(Math.min(Math.max(0.18 / mpp, 3), unit * 0.02)));
        c.setAttribute("fill", colour);
        const tip = document.createElementNS(NS, "title");
        tip.textContent = name;
        c.append(tip);
        svg.append(c);
    }
    for (const bed of frame.beds) {
        const cx = bed.pts.reduce((a, p) => a + p[0], 0) / bed.pts.length;
        const cy = bed.pts.reduce((a, p) => a + p[1], 0) / bed.pts.length;
        const [px, py] = toPx(cx, cy);
        const label = document.createElementNS(NS, "text");
        label.setAttribute("class", plate ? "hg-name plate-bedname" : "hg-name");
        label.setAttribute("x", String(px));
        label.setAttribute("y", String(py));
        label.textContent = bed.name;
        svg.append(label);
    }
    svg.addEventListener("click", onOpen);
    wrap.append(svg);
    yardCtx.set(wrap, { svg, toPx, nameOf });
    if (plate)
        paintCaptionAndKey(wrap, svg, plate, dateline, nameOf);
    if (legend.size) {
        const row = document.createElement("div");
        row.className = "hg-legend";
        for (const [sid, colour] of legend) {
            const item = document.createElement("span");
            item.className = "hg-leg";
            const sw = document.createElement("span");
            sw.className = "hg-sw";
            sw.style.background = colour;
            const nm = document.createElement("span");
            nm.textContent = app.speciesName?.(sid) ?? sid;
            item.append(sw, nm);
            row.append(item);
        }
        wrap.append(row);
    }
    return wrap;
}
function paintMarks(svg, plate, toPx, nameOf) {
    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "gardenplate");
    plateMarksInto(g, plate, toPx, nameOf);
    const old = svg.querySelector(":scope > g.gardenplate");
    if (old)
        old.replaceWith(g);
    else
        svg.append(g);
}
function paintCaptionAndKey(wrap, svg, plate, dateline, nameOf) {
    wrap.querySelectorAll(":scope > .home-plate-cap, :scope > .plate-key").forEach((n) => n.remove());
    const after = [];
    if (dateline) {
        const cap = document.createElement("p");
        cap.className = "home-plate-cap";
        cap.textContent = dateline;
        after.push(cap);
    }
    const rows = plateKey(plate, nameOf);
    if (rows.length) {
        const key = document.createElement("div");
        key.className = "hg-legend";
        after.push(plateKeyInto(key, rows));
    }
    let anchor = svg;
    while (anchor.parentElement && anchor.parentElement !== wrap)
        anchor = anchor.parentElement;
    anchor.after(...after);
}
export function yardFigure(frame, anchor, onBed, onOpen, plate, dateline) {
    return renderGlance(frame, anchor, onBed, onOpen, plate, dateline);
}
export function yardRepaint(wrap, plate, dateline) {
    const c = yardCtx.get(wrap);
    if (!c)
        return;
    paintMarks(c.svg, plate, c.toPx, c.nameOf);
    paintCaptionAndKey(wrap, c.svg, plate, dateline, c.nameOf);
}
function glanceFor(frame, anchor, plot, onBed, onOpen, plate = null, dateline = null) {
    const key = glanceKey(frame, anchor, plot, `${plateSig(plate)}|${dateline ?? ""}`);
    if (glanceCache && glanceCache.key === key)
        return glanceCache.el;
    const el = renderGlance(frame, anchor, onBed, onOpen, plate, dateline);
    glanceCache = { key, el };
    return el;
}
export function invalidateHomeGlance() {
    glanceCache = null;
}
const GUIDE_LABEL = {
    "blossom-end-rot": "blossom-end rot",
    "pollination-and-fruit-set": "pollination",
    "frost-dates-zones-daylength": "zones vs frost dates",
    "crop-rotation": "crop rotation",
    "companion-planting-honestly": "companion planting",
    "read-a-planting-calendar": "reading a planting calendar",
    "starting-seeds-indoors": "starting seeds indoors",
    "the-soil-test": "the soil test",
    "how-to-water": "how to water",
    "frost-dates": "frost dates",
};
const FROST_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const _CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function mmddDoy(mmdd) {
    const [mm, dd] = mmdd.split("-").map(Number);
    return (_CUM[(mm ?? 1) - 1] ?? 0) + (dd ?? 1);
}
function frostDayLabel(mmdd) {
    const [mm, dd] = mmdd.split("-").map(Number);
    return `${FROST_MON[(mm ?? 1) - 1]} ${dd}`;
}
function frostStripCard(frost) {
    const p50 = mmddDoy(frost.p50), p10 = mmddDoy(frost.p10);
    const lo = Math.min(p50, p10) - 10, hi = Math.max(p50, p10) + 10;
    const W = 320, ml = 12, mr = 12, innerW = W - ml - mr, barY = 50, barH = 15;
    const x = (d) => Math.round((ml + (d - lo) / (hi - lo) * innerW) * 100) / 100;
    const mids = ["p40", "p30", "p20"].map((k) => frost[k]).filter(Boolean);
    const monthTicks = [];
    for (let mm = 1; mm <= 12; mm++) {
        const d = _CUM[mm - 1] + 1;
        if (d >= lo && d <= hi) {
            monthTicks.push(`<line class="hf-month" x1="${x(d)}" y1="${barY}" x2="${x(d)}" y2="${barY + barH + 5}"/>`
                + `<text class="hf-mlab" x="${x(d)}" y="${barY + barH + 16}">${FROST_MON[mm - 1]}</text>`);
        }
    }
    const svg = `<svg class="hf-svg" viewBox="0 0 ${W} 86" role="img" aria-label="Your last spring frost, as odds: median ${frostDayLabel(frost.p50)}, safe by ${frostDayLabel(frost.p10)}.">`
        + `<rect class="hf-risk" x="${x(lo)}" y="${barY}" width="${x(p50) - x(lo)}" height="${barH}"/>`
        + `<rect class="hf-gamble" x="${x(p50)}" y="${barY}" width="${x(p10) - x(p50)}" height="${barH}"/>`
        + `<rect class="hf-safe" x="${x(p10)}" y="${barY}" width="${x(hi) - x(p10)}" height="${barH}"/>`
        + mids.map((m) => `<line class="hf-mid" x1="${x(mmddDoy(m))}" y1="${barY}" x2="${x(mmddDoy(m))}" y2="${barY + barH}"/>`).join("")
        + monthTicks.join("")
        + `<line class="hf-tick" x1="${x(p50)}" y1="${barY - 8}" x2="${x(p50)}" y2="${barY + barH}"/>`
        + `<text class="hf-key" x="${x(p50)}" y="${barY - 34}" text-anchor="middle">median</text>`
        + `<text class="hf-keyd" x="${x(p50)}" y="${barY - 18}" text-anchor="middle">${frostDayLabel(frost.p50)}</text>`
        + `<line class="hf-tick" x1="${x(p10)}" y1="${barY - 8}" x2="${x(p10)}" y2="${barY + barH}"/>`
        + `<text class="hf-key" x="${x(p10)}" y="${barY - 34}" text-anchor="end">1 in 10</text>`
        + `<text class="hf-keyd" x="${x(p10)}" y="${barY - 18}" text-anchor="end">${frostDayLabel(frost.p10)}</text>`
        + `</svg>`;
    const card = document.createElement("a");
    card.className = "home-card home-frost";
    card.href = "../guides/frost-dates/";
    const h = document.createElement("p");
    h.className = "home-frost-h";
    h.textContent = "Your last spring frost";
    const fig = document.createElement("div");
    fig.className = "home-frost-fig";
    fig.innerHTML = svg;
    const note = document.createElement("p");
    note.className = "home-cardnote";
    note.textContent = `A frost date is odds, not a promise: plant frost-tender crops after ${frostDayLabel(frost.p50)}, and one year in ten it comes as late as ${frostDayLabel(frost.p10)}.`;
    card.append(h, fig, note);
    return card;
}
const _homePhotoUrls = new Map();
function homePhotoInto(img, seasonId, name) {
    const plot = app.currentPlotId;
    const key = `${plot}:${seasonId}:${name}`;
    const hit = _homePhotoUrls.get(key);
    if (hit) {
        img.src = hit;
        return;
    }
    void openLog().then((db) => getPhoto(db, plot, seasonId, name)).then((b) => {
        if (!b)
            return;
        const url = URL.createObjectURL(b);
        _homePhotoUrls.set(key, url);
        img.src = url;
    }).catch(() => { });
}
function renderHome(view) {
    const host = document.getElementById("homereturn");
    if (!host)
        return false;
    const weekLine = !!(view.week && (view.week.due || view.week.late || view.week.closed));
    const something = !!(view.welcome || view.ask || view.quiet || view.due.length || weekLine
        || view.gardens.length || view.glance || view.digest.length || view.season || view.feed
        || view.recollections.length);
    host.hidden = !something;
    if (!something)
        host.replaceChildren();
    if (something || settled)
        document.body.classList.toggle("home-returning", something);
    if (!something)
        return false;
    host.replaceChildren();
    if (view.voice) {
        const v = document.createElement("p");
        v.className = "home-voice";
        v.textContent = view.voice;
        host.append(v);
    }
    if (view.recollections.length) {
        const band = document.createElement("div");
        band.className = "onthisday";
        const h = document.createElement("h2");
        h.className = "onthisday-h";
        h.textContent = view.recollections.every((r) => r.yearsAgo === 1) ? "A year ago this week" : "This week, in seasons past";
        band.append(h);
        const ul = document.createElement("ul");
        ul.className = "onthisday-list";
        for (const rec of view.recollections) {
            const li = document.createElement("li");
            li.className = "onthisday-item";
            const line = document.createElement("span");
            line.className = "onthisday-line";
            line.textContent = rec.line;
            li.append(line);
            if (rec.photo) {
                const img = document.createElement("img");
                img.className = "photothumb onthisday-photo";
                img.loading = "lazy";
                img.alt = "";
                homePhotoInto(img, rec.seasonId, rec.photo);
                li.append(img);
            }
            ul.append(li);
        }
        band.append(ul);
        host.append(band);
    }
    if (view.gardens.length) {
        const strip = document.createElement("div");
        strip.className = "home-gardens";
        for (const g of view.gardens) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = g.due || g.late ? "home-g due" : "home-g";
            if (g.id === view.plot)
                b.classList.add("here");
            b.dataset.plot = g.id;
            const head = document.createElement("div");
            head.className = "home-ghead";
            const n = document.createElement("p");
            n.className = "n";
            n.textContent = g.name;
            head.append(n);
            if (g.news && g.news > 0) {
                const news = document.createElement("span");
                news.className = "home-gnews";
                news.textContent = String(g.news);
                news.setAttribute("aria-label", `${g.news} new team ${g.news === 1 ? "post" : "posts"}`);
                head.append(news);
            }
            const s = document.createElement("p");
            s.className = "s";
            const parts = [g.due ? `${g.due} to do this week` : "", g.late ? `${g.late} overdue` : "", g.closed ? `${g.closed} closed` : ""].filter(Boolean);
            s.textContent = parts.length ? parts.join(", ") : "nothing to do here yet";
            b.append(head, s);
            if (g.id === view.plot) {
                const act = document.createElement("p");
                act.className = "home-gact";
                act.textContent = "you are here";
                b.append(act);
            }
            else if (g.news && g.news > 0) {
                const act = document.createElement("p");
                act.className = "home-gact news";
                act.textContent = g.news === 1 ? "1 new from your team" : `${g.news} new from your team`;
                b.append(act);
            }
            b.addEventListener("click", () => view.onGarden(g.id));
            strip.append(b);
        }
        host.append(strip);
    }
    if (view.digest.length) {
        const dig = document.createElement("section");
        dig.className = "home-digest";
        const h = document.createElement("p");
        h.className = "home-digest-h";
        h.textContent = view.digestDays != null
            ? `While you were away · ${view.digestDays} day${view.digestDays === 1 ? "" : "s"}`
            : "While you were away";
        dig.append(h);
        const drow = (item) => {
            const row = document.createElement("div");
            row.className = "home-drow";
            const tag = document.createElement("span");
            tag.className = "home-dtag";
            tag.textContent = item.tag === "team" ? "Team" : "Beds";
            const txt = document.createElement("p");
            txt.className = "home-dtxt";
            txt.textContent = item.text;
            row.append(tag, txt);
            return row;
        };
        for (const item of view.digest)
            dig.append(drow(item));
        if (view.digestMore.length > 0) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "home-dmore";
            more.textContent = `+${view.digestMore.length} more from this week`;
            more.addEventListener("click", () => {
                const frag = document.createDocumentFragment();
                for (const item of view.digestMore)
                    frag.append(drow(item));
                more.replaceWith(frag);
            });
            dig.append(more);
        }
        host.append(dig);
    }
    if (view.welcome) {
        const w = document.createElement("div");
        w.className = "home-welcome";
        const h = document.createElement("p");
        h.className = "h";
        h.textContent = view.welcome.head;
        w.append(h);
        if (view.welcome.detail) {
            const d = document.createElement("p");
            d.className = "d";
            d.textContent = view.welcome.detail;
            w.append(d);
        }
        host.append(w);
    }
    const landingUp = document.getElementById("page-start")?.hidden === false;
    if (view.glance && landingUp) {
        const card = document.createElement("section");
        card.className = "home-card home-viewcard";
        const dateline = `${view.gardenName ?? "Your garden"} \u00b7 ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`;
        card.append(glanceFor(view.glance, view.anchor, view.plot, view.onBed, view.onOpen, view.plate, dateline));
        const hint = document.createElement("p");
        hint.className = "home-cardnote";
        const beds = view.glance.beds.length;
        hint.textContent = (view.gardenName ? `${view.gardenName} \u00b7 ` : "")
            + (beds === 1 ? "Tap the bed to open its log, or the view to plan."
                : `${beds} beds. Tap one to open its log, or the view to plan.`);
        card.append(hint);
        host.append(card);
    }
    if (view.seasonMode) {
        const m = document.createElement("a");
        m.className = "home-seasonmode";
        m.href = "#/" + view.seasonMode.route;
        const head = document.createElement("span");
        head.className = "home-smhead";
        head.textContent = `${view.seasonMode.name} · ${view.seasonMode.verb}`;
        const act = document.createElement("span");
        act.className = "home-smact";
        act.textContent = view.seasonMode.action;
        const go = document.createElement("span");
        go.className = "home-smgo";
        go.textContent = "›";
        const stack = document.createElement("span");
        stack.className = "home-smstack";
        stack.append(head, act);
        m.append(stack, go);
        host.append(m);
    }
    if (view.season) {
        const rib = document.createElement("a");
        rib.className = "home-season";
        rib.href = view.season.href;
        wireWhy(rib);
        const when = document.createElement("span");
        when.className = "home-swhen";
        when.textContent = view.season.when;
        const txt = document.createElement("span");
        txt.className = "home-stxt";
        txt.textContent = view.season.text;
        rib.append(when, txt);
        if (view.season.grade) {
            const g = document.createElement("span");
            g.className = "home-sgrade";
            g.textContent = view.season.grade;
            rib.append(g);
        }
        host.append(rib);
    }
    if (view.nextSeason) {
        const ns = document.createElement("button");
        ns.type = "button";
        ns.className = "home-nextseason";
        const label = document.createElement("span");
        label.className = "home-nsl";
        label.textContent = `Plan next season (${view.nextSeason.year})`;
        const sub = document.createElement("span");
        sub.className = "home-nss";
        sub.textContent = "What each bed can take next year, and where";
        const go2 = document.createElement("span");
        go2.className = "home-nsgo";
        go2.textContent = "›";
        const stack = document.createElement("span");
        stack.append(label, sub);
        ns.append(stack, go2);
        ns.addEventListener("click", view.onNextSeason);
        host.append(ns);
    }
    if (view.frost)
        host.append(frostStripCard(view.frost));
    if (view.ask) {
        const band = document.createElement("div");
        band.className = "home-band";
        const k = document.createElement("p");
        k.className = "k";
        k.textContent = view.ask.kicker;
        const q = document.createElement("p");
        q.className = "q";
        q.textContent = view.ask.q;
        const w = document.createElement("p");
        w.className = "why";
        w.textContent = view.ask.why;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "home-act";
        btn.textContent = view.ask.label;
        btn.addEventListener("click", view.ask.run);
        band.append(k, q, w, btn);
        host.append(band);
    }
    else if (view.quiet) {
        const band = document.createElement("div");
        band.className = "home-band quiet";
        const q = document.createElement("p");
        q.className = "q";
        q.textContent = "Nothing needs deciding today.";
        const w = document.createElement("p");
        w.className = "why";
        w.textContent = view.quiet;
        band.append(q, w);
        host.append(band);
    }
    if (view.due.length || weekLine) {
        const card = document.createElement("section");
        card.className = "home-card home-duecard";
        for (const d of view.due.slice(0, 2)) {
            const row = document.createElement("div");
            row.className = "home-duerow";
            const when = document.createElement("span");
            when.className = "when";
            when.textContent = d.when;
            const what = document.createElement("span");
            what.className = "what";
            what.textContent = d.what;
            row.append(when, what);
            card.append(row);
        }
        if (view.week && weekLine) {
            const n = view.week.due, l = view.week.late, c = view.week.closed;
            const things = (k) => `${k} thing${k === 1 ? "" : "s"} to do`;
            const b = document.createElement("button");
            b.type = "button";
            b.className = "home-weeklink";
            const tail = `${l ? `, ${l} overdue` : ""}${c ? `, ${c} closed` : ""}`;
            b.textContent = n ? `This week: ${things(n)}${tail} ›`
                : l ? `${l} thing${l === 1 ? "" : "s"} overdue${c ? `, ${c} closed` : ""} - see the week ›`
                    : `${c} window${c === 1 ? "" : "s"} closed - see the week ›`;
            b.addEventListener("click", view.onWeek);
            card.append(b);
        }
        host.append(card);
    }
    if (view.questions.length) {
        const asks = document.createElement("div");
        asks.className = "home-asks";
        for (const q of view.questions) {
            const row = document.createElement("div");
            row.className = "askq-row";
            const a = document.createElement("a");
            a.className = "home-askq";
            a.href = q.href;
            a.dataset.q = q.id;
            wireWhy(a);
            const stack = document.createElement("span");
            const qt = document.createElement("span");
            qt.className = "qq";
            qt.textContent = q.q;
            const ht = document.createElement("span");
            ht.className = "qh";
            ht.textContent = q.hint;
            stack.append(qt, ht);
            const go = document.createElement("span");
            go.className = "qgo";
            go.textContent = "\u203a";
            a.append(stack, go);
            row.append(a);
            if (q.guide) {
                const g = document.createElement("a");
                g.className = "askq-guide";
                g.href = `../guides/${q.guide}/`;
                g.textContent = `Guide: ${GUIDE_LABEL[q.guide] ?? "read more"} \u2192`;
                row.append(g);
            }
            asks.append(row);
        }
        host.append(asks);
    }
    if (view.feed?.post) {
        const fd = document.createElement("section");
        fd.className = "home-feed";
        const h = document.createElement("p");
        h.className = "home-feed-h";
        const label = document.createElement("span");
        label.textContent = view.feed.team ? `From ${view.feed.team}` : "From your team";
        const all = document.createElement("a");
        all.className = "home-feed-all";
        all.href = "#";
        all.textContent = view.feed.count > 1 ? `${view.feed.count} new · all in Log →` : "all in Log →";
        all.addEventListener("click", (e) => { e.preventDefault(); view.onFeed(); });
        h.append(label, all);
        const who = document.createElement("p");
        who.className = "home-feed-who";
        const wb = document.createElement("b");
        wb.textContent = view.feed.post.author || "a gardener";
        const wt = document.createElement("span");
        wt.className = "home-feed-when";
        wt.textContent = ` · ${feedTime(view.feed.post.at)}`;
        who.append(wb, wt);
        fd.append(h, who, postBody(view.feed.post.body, "home-feed-body"));
        host.append(fd);
    }
    if (view.functions.length) {
        const grid = document.createElement("div");
        grid.className = "home-fns";
        for (const f of view.functions) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "home-fn";
            b.dataset.fn = f.route;
            const n = document.createElement("span");
            n.className = "n";
            n.textContent = f.name;
            const v = document.createElement("span");
            v.className = "v";
            v.textContent = f.value;
            b.append(n, v);
            b.addEventListener("click", () => view.onFunction(f.route));
            grid.append(b);
        }
        host.append(grid);
    }
    const open = document.createElement("button");
    open.type = "button";
    open.className = "home-open";
    open.id = "homeopen";
    const stack = document.createElement("span");
    const label = document.createElement("span");
    label.className = "home-openl";
    label.textContent = "Open your garden";
    const sub = document.createElement("span");
    sub.className = "home-opens";
    sub.textContent = "The plan, your beds, and what fits them";
    stack.append(label, sub);
    const go = document.createElement("span");
    go.className = "home-opengo";
    go.textContent = "\u203a";
    open.append(stack, go);
    open.addEventListener("click", view.onOpen);
    host.append(open);
    return true;
}
let settled = false;
export function settleHome() { settled = true; }
export function homeSettled() { return settled; }
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function homeVoice() {
    const season = document.documentElement.dataset.season ?? "autumn";
    const suffix = season.charAt(0).toUpperCase() + season.slice(1);
    const key = `homeVoice${suffix}`;
    return (copy[key] ?? copy.homeVoiceAutumn ?? null);
}
const SEASON_ACT = {
    spring: { action: "Lay out and plant your beds", route: "plan" },
    summer: { action: "Keep your log, and stay ahead of the season", route: "log" },
    autumn: { action: "Log your harvest, and close the beds for winter", route: "log" },
    winter: { action: "Read the year, and plan the next", route: "plan" },
};
function homeSeasonMode() {
    if (!hasGround())
        return null;
    const key = document.documentElement.dataset.season ?? "autumn";
    const s = seasonOf(key);
    const act = SEASON_ACT[key];
    if (!s || !act)
        return null;
    return { name: s.name, verb: s.verb, action: act.action, route: act.route };
}
export function hasGround() {
    return app.logSnapshot.beds.length > 0 || app.logSnapshot.seasons.length > 0;
}
function signedOutPendingAsk() {
    if (isSignedIn() || !backendConfigured())
        return null;
    const beds = app.logSnapshot.beds;
    const season = activeSeason();
    const plan = (Array.isArray(season?.plan) ? season.plan : []);
    const plantings = (season?.plantings ?? []);
    const planned = beds.find((b) => plan.some((e) => e.area === b.name && (e.guild || e.mybed === true))
        && !plantings.some((p) => !p.end_cause && plantingOnBed(p.region, b.region)));
    if (!planned)
        return null;
    const win = app.bedPlantWindow?.(planned.name) ?? null;
    if (win?.status === "passed") {
        return { kicker: "Your garden", q: "Your first bed is planned, and kept for spring.",
            why: "Add its first spring date to your calendar, so it's waiting when the season comes round.",
            label: "Add the first date to my calendar", run: () => void app.openWeek?.(undefined, planned.name) };
    }
    return { kicker: "Your garden", q: "Your first bed is planned.",
        why: "Sign in to plant it, and your garden will be there on any device you use.",
        label: "Sign in to plant", run: () => app.openAuthSheet?.(planned.name) };
}
function signedInEmptyAsk() {
    if (!isSignedIn() || hasGround() || isExamplePlot(app.currentPlotId))
        return null;
    try {
        if (document.body.classList.contains("editing"))
            return null;
    }
    catch { }
    return { kicker: "Your garden", q: "You're signed in - there's no bed here yet.",
        why: "Trace your first bed on the Plan map, and the rest fills in from it: your calendar, your log, and the plant teams that fit the space.",
        label: "Start your first bed",
        run: () => { go("plan"); const g = document.getElementById("sec-ground"); if (g)
            g.open = true; } };
}
function betweenSeasonsAsk() {
    if (!hasGround() || seasonId() != null || isExamplePlot(app.currentPlotId))
        return null;
    try {
        if (document.body.classList.contains("editing"))
            return null;
    }
    catch { }
    const closed = app.logSnapshot.seasons.filter((s) => s.closed_date);
    if (!closed.length)
        return null;
    const lastYear = Math.max(...closed.map((s) => s.id));
    const nextYear = lastYear + 1;
    return { kicker: "Your garden", q: `Your ${lastYear} season is closed.`,
        why: `Start ${nextYear} to plan the coming season - its dates and rotation come from what grew here.`,
        label: `Start the ${nextYear} season`,
        run: () => { void (async () => { await app.startNextSeason?.(); go("plan"); })(); } };
}
function gardenNameNow() {
    const n = app.currentPlot?.name;
    return typeof n === "string" && n.trim() ? n : null;
}
function familyOf(bundle, sid) {
    const sp = bundle.species.find((x) => x.id === sid);
    return sp?.family ?? null;
}
const dayOfYear = (iso) => {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
};
function liveFunctions(todayIso, tasks) {
    const out = [];
    const next = tasks
        .filter((x) => typeof x.date === "string" && x.date > todayIso && x.kind !== "logged")
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    const lateN = weekJobs(tasks, todayIso).late.length;
    const lateTxt = lateN ? `${lateN} late` : "";
    if (next?.date)
        out.push({ name: "Calendar", value: [lateTxt, `next: ${whenLabel(todayIso, next.date)}`].filter(Boolean).join(" · "), route: "calendar" });
    else if (lateTxt)
        out.push({ name: "Calendar", value: lateTxt, route: "calendar" });
    const openSeason = activeSeason();
    const planted = (openSeason?.plantings ?? []).length;
    if (planted)
        out.push({ name: "Log", value: `${planted} planting${planted === 1 ? "" : "s"}`, route: "log" });
    const past = priorSeasons();
    if (past.length) {
        const newest = Math.max(...past.map((sn) => sn.id));
        out.push({ name: "Review", value: `${newest} season`, route: "review" });
    }
    return out;
}
const isoAddDays = (iso, days) => {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let postsCache = null;
let fetchingPlot = null;
function cachedPosts(plot) {
    if (postsCache && postsCache.plot === plot)
        return postsCache.posts;
    if (fetchingPlot !== plot && app.logDb) {
        fetchingPlot = plot;
        listPosts(app.logDb, plot).then((posts) => {
            if (fetchingPlot !== plot)
                return;
            postsCache = { plot, posts: posts.filter((p) => !p.deleted) };
            fetchingPlot = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingPlot === plot)
            fetchingPlot = null; });
    }
    return [];
}
let newsCache = null;
let fetchingNews = null;
function cachedGardenNews(plotIds, gapStart, myEmail) {
    const key = `${plotIds.join(",")}|${gapStart}|${myEmail ?? ""}`;
    if (newsCache && newsCache.key === key)
        return newsCache.counts;
    if (fetchingNews !== key && app.logDb) {
        fetchingNews = key;
        const db = app.logDb;
        Promise.all(plotIds.map((pid) => listPosts(db, pid).then((posts) => [pid, posts.filter((p) => !p.deleted && p.author && p.author !== myEmail && p.at > gapStart).length])))
            .then((entries) => {
            if (fetchingNews !== key)
                return;
            newsCache = { key, counts: new Map(entries) };
            fetchingNews = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingNews === key)
            fetchingNews = null; });
    }
    return new Map();
}
export function invalidateHomePosts() {
    postsCache = null;
    fetchingPlot = null;
    newsCache = null;
    fetchingNews = null;
}
let climMemo = null;
function memoClimate(lat, lon, bundle) {
    if (climMemo && climMemo.lat === lat && climMemo.lon === lon)
        return climMemo.clim;
    const clim = resolveClimate(lat, lon, bundle);
    climMemo = { lat, lon, clim };
    return clim;
}
export function renderHomeNow(bundle) {
    if (app.viewAs === "stranger") {
        return renderHome({ voice: null, recollections: [], welcome: null, ask: null, quiet: null, due: [], week: null, onWeek: () => { }, gardens: [], glance: null,
            questions: [], digest: [], digestMore: [], digestDays: null, season: null, seasonMode: null, nextSeason: null, onNextSeason: () => { }, frost: null, feed: null, onFeed: () => { },
            functions: [], onFunction: () => { }, gardenName: null, plate: null,
            plot: "", anchor: null,
            onGarden: () => { }, onBed: () => { },
            onOpen: () => { } });
    }
    const t = todayIso();
    const demo = isExamplePlot(app.currentPlotId);
    const sentence = (task) => taskSentence(task, bundle);
    const tasks = hasGround() ? gardenWideTasks(bundle, Number(t.slice(0, 4))) : [];
    const away = demo ? null : daysAway();
    const live = hasGround() ? (activeSeason()
        ?.plantings ?? []).filter((p) => !p.end_date) : [];
    const bedEvents = away != null ? live.flatMap((p) => {
        if (!p.sown)
            return [];
        const sp = bundle.species.find((x) => x.id === p.species);
        if (!sp || sp.scheduling_model !== "dtm")
            return [];
        const dtm = resolveDtm(sp, p.cultivar_group ?? null);
        if (!dtm)
            return [];
        if (t > isoAddDays(p.sown, dtm[1]))
            return [];
        return [{ text: `Your ${commonName(bundle, p.species) || p.species} crossed ${dtm[0]} days - in its picking window now.`,
                whenIso: isoAddDays(p.sown, dtm[0]) }];
    }) : [];
    const posts = hasGround() && isSignedIn() ? cachedPosts(app.currentPlotId) : [];
    const myEmail = signedInEmail();
    const teamPosts = posts.filter((p) => p.author && p.author !== myEmail);
    const digestAll = hasGround() ? sinceAway({ todayIso: t, daysAway: away, bedEvents }) : [];
    const budgeted = contextBudget(digestAll, 3);
    const clim = hasGround() && app.currentPlot?.anchor
        ? memoClimate(app.currentPlot.anchor.lat, app.currentPlot.anchor.lon, bundle) : null;
    const site = clim?.site ?? null;
    const season = hasGround() ? seasonRibbon({
        todayIso: t,
        lastFrostMmdd: site?.last_frost_32f?.p50 ?? null,
        firstFreezeMmdd: site?.first_freeze_32f_p50 ?? null,
        frostGrade: confidenceWord(site?.provenance?.grade),
        lat: app.currentPlot?.anchor?.lat ?? null,
        onionsPresent: live.some((p) => p.species === "allium_cepa"),
    }) : null;
    const lf = site?.last_frost_32f;
    const frost = hasGround() && lf?.p50 && lf?.p10
        ? { p50: lf.p50, p40: lf.p40, p30: lf.p30, p20: lf.p20, p10: lf.p10 } : null;
    const gapStart = away != null && away > 0 ? isoAddDays(t, -away) : null;
    const unseen = gapStart ? teamPosts.filter((p) => p.at > gapStart) : [];
    const feed = unseen.length
        ? { team: null, post: { author: unseen[0].author, at: unseen[0].at, body: unseen[0].body }, count: unseen.length }
        : null;
    const facts = homeFacts({
        todayIso: t, daysAway: demo ? null : daysAway(),
        seasons: app.logSnapshot.seasons, seasonId: seasonId(),
        bedCount: app.logSnapshot.beds.length, tasks, sentence,
    });
    const card = hasGround() ? currentAskCard(bundle) : null;
    const a = card?.ask ?? null;
    const outAsk = a ? null : (signedOutPendingAsk() ?? signedInEmptyAsk() ?? betweenSeasonsAsk());
    const openSeason = activeSeason();
    const prevSeason = seasonById((seasonId() ?? 0) - 1);
    const stripCards = hasGround() && !demo
        ? gardenStrip(gardensDueSoon(bundle, t).map((g) => ({ id: g.plotId, name: g.name, due: g.due, late: g.late, closed: g.closed })))
        : [];
    const newsCounts = (isSignedIn() && gapStart && stripCards.length)
        ? cachedGardenNews(stripCards.map((c) => c.id), gapStart, myEmail)
        : new Map();
    const gardens = stripCards.map((c) => ({ ...c,
        news: c.id === app.currentPlotId ? 0 : (newsCounts.get(c.id) ?? 0) }));
    const recollections = aYearAgoThisWeek(app.logSnapshot.seasons, t).slice(0, 6).map((r) => ({
        line: recollectionLine(r, r.species ? commonName(bundle, r.species) : ""),
        photo: r.photo, seasonId: r.year, yearsAgo: r.yearsAgo,
    }));
    return renderHome({
        voice: hasGround() ? homeVoice() : null,
        recollections,
        welcome: hasGround() ? welcomeBack(facts) : null,
        ask: a ? { kicker: a.kicker, q: a.q, why: a.why, label: a.go.label, run: () => followAsk(a.go) } : outAsk,
        quiet: card?.quiet ?? null,
        due: dueRows(t, tasks.filter((x) => category(x) === "frost" || isOwed(x, tasks)), sentence),
        week: hasGround() ? weekSummary(bundle, t) : null,
        onWeek: () => { void app.openWeek?.(); },
        gardens,
        glance: hasGround()
            ? gardenFrame(app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, planted: b.planted, structure: b.structure })), (openSeason?.plantings ?? []).filter((p) => !p.end_date)
                .map((p) => ({ region: p.region, species: p.species })))
            : null,
        plate: hasGround()
            ? plateModel({ beds: app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region })) }, openSeason ? { ...openSeason, plantings: [...(openSeason.plantings ?? []), ...app.draftPlantings] } : openSeason, prevSeason, t, (p) => {
                if (!p.sown)
                    return null;
                const sp = bundle.species.find((x) => x.id === p.species);
                if (!sp || sp.scheduling_model !== "dtm")
                    return null;
                const dtm = resolveDtm(sp, p.cultivar_group ?? null);
                return dtm ? isoAddDays(p.sown, dtm[0]) : null;
            })
            : null,
        questions: hasGround() ? homeQuestions({
            month: Number(t.slice(5, 7)),
            speciesPresent: new Set((openSeason?.plantings ?? []).map((p) => p.species)),
            insectPollinatedPresent: new Set((openSeason?.plantings ?? [])
                .map((p) => p.species)
                .filter((sid) => needsInsects(bundle.species.find((x) => x.id === sid)))),
            berSusceptiblePresent: new Set((openSeason?.plantings ?? [])
                .map((p) => p.species)
                .filter((sid) => {
                const sp = bundle.species.find((x) => x.id === sid);
                return sp?.ber_susceptible === true;
            })),
            familiesPresent: new Set((openSeason?.plantings ?? [])
                .map((p) => familyOf(bundle, p.species)).filter((f) => !!f)),
            hasLocation: !!app.currentPlot?.anchor,
            dayOfYear: dayOfYear(t),
        }) : [],
        digest: budgeted.shown,
        digestMore: digestAll.slice(3),
        digestDays: away,
        season,
        seasonMode: homeSeasonMode(),
        nextSeason: hasGround() && !demo && app.logSnapshot.beds.length > 0 && openSeason && !openSeason.closed_date
            && openSeason.id <= Number(t.slice(0, 4))
            ? { year: openSeason.id + 1 } : null,
        onNextSeason: () => { openNextSeason(); go("plan", "nextseason"); },
        frost,
        feed,
        onFeed: () => { go("log"); },
        functions: hasGround() ? liveFunctions(t, tasks) : [],
        onFunction: (route) => { go(route); },
        gardenName: gardenNameNow(),
        plot: app.currentPlotId,
        anchor: app.currentPlot?.anchor ?? null,
        onGarden: (id) => { void app.openWeek?.(id); },
        onBed: (bed) => { go("log"); app.openLogBed?.(bed, null); },
        onOpen: () => { go("plan"); },
    });
}
