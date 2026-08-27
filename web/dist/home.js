// The state-aware home (approved 2026-08-01, docs/mockups/returning-home.html).
//
// The landing gains a SECOND STATE. A stranger meets the four problem-shaped doors, unchanged and
// byte-identical - that funnel is well designed and is not what this is about. A gardener who
// already has ground meets an answer instead: what they were away for, what needs doing, and which
// of their gardens needs them.
//
// WHY HERE AND NOT ON THE PLAN PAGE. The first draft put a band at the top of Plan, and the
// maintainer's objection killed it: that screen already carries the step path, the map, the guild
// cards, the share control and three extras steps, and a returning gardener should not meet the
// busiest surface in the app first. The landing is the surface whose entire job is "where do I
// begin" - and returning users currently SKIP it, so it was not crowded, it was unused.
//
// PERSONAS.md part two is the reasoning: Nadia opens weekly with a two-second question and the app
// made her navigate to an answer it had already computed; Walt opens twice a year and nothing ever
// told him the ledger survived; Ines keeps three plots and no surface showed more than one.
//
// Nothing here computes anything new. The ask is computeAsk (askrank.ts, assembled once in
// askcard.ts so the Log's card and this band cannot disagree), the dated lines are gardenWideTasks
// (calendar.ts), the per-garden counts are gardensDueSoon (the same task builder, per garden), the
// absence gap is noteArrival (askcard.ts). homefacts.ts decides what to SAY (pure, unit-tested);
// this module reads the live state and renders it.
import { needsInsects } from "./engine/forage.js";
import { isSignedIn, signedInEmail } from "./account.js";
import { currentAskCard, daysAway, followAsk } from "./askcard.js";
import { gardensDueSoon, gardenWideTasks, resolveDtm, taskSentence } from "./calendar.js";
import { resolveClimate } from "./engine/intake.js";
import { isExamplePlot } from "./example.js";
import { contextBudget, dueRows, gardenFrame, gardenStrip, homeFacts, homeQuestions, project, seasonRibbon, sinceAway, welcomeBack, whenLabel } from "./homefacts.js";
import { feedTime, postBody } from "./feed.js";
import { listPosts } from "./storage.js";
import { metresPerPixel } from "./engine/geo.js";
import { drawTiles, tileSourceKey } from "./groundmap/imagery.js";
import { colorAssigner } from "./groundmap/palette.js";
import { go } from "./nav.js";
import { app, commonName } from "./state.js";
/** THE GARDEN VIEW (maintainer, 2026-08-01, amended after the staging walk: "the garden view
 *  should have the users ground visible, I would use a view from the plan page if possible, framed
 *  for a view of all beds on the garden selected").
 *
 *  So it IS the plan page's view: the same Esri/Google imagery through groundmap's own drawTiles,
 *  the same +y-north projection, the same bed geometry - framed once on the selected garden's beds
 *  and then left alone. What it is NOT is the ground map: no panning, no zoom, no modes, nothing
 *  draggable (D-078 intact). A bed tap lands on its Log card; the frame opens the plan.
 *
 *  A garden with no anchor yet still draws - beds on plain ground, no imagery. Tiles are backdrop
 *  pixels (D-021), so their absence costs the view nothing that matters. */
const VIEW_W = 440, VIEW_H = 250;
const ZOOM_MIN = 17, ZOOM_MAX = 23;
// THE PLAN PAGE'S OWN FIT, to the number (groundmap.ts): half the frame for the beds, then one
// zoom step wider. The first cut used a tighter 0.58 and no step out, which zoomed PAST what the
// imagery holds - tiles cap at z20, so everything beyond it is upscale, and the maintainer's word
// for the result was "very blurry". Matching the surface this view is meant to mirror fixes the
// sharpness and the framing in one move.
const FIT_FRAC = 0.5;
// THE VIEW IS BUILT ONCE PER GARDEN, NOT ONCE PER DRAW. renderHome rebuilds its DOM on every
// draw, and a rebuilt view means a brand-new <image> for every tile - so a garden that had already
// painted re-fetched its whole backdrop repeatedly (66 requests in a second and a half, measured,
// while the network was failing). Cached on the inputs that actually change the picture; anything
// else reuses the exact same node, tiles and all.
let glanceCache = null;
const glanceKey = (f, a, plot) => 
// The tile SOURCE is part of the key: the Google session arrives in the background, and without
// this the cache served the Esri fallback for the life of the page even after Google was ready.
`${plot}|${tileSourceKey()}|${a ? `${a.lat},${a.lon}` : "none"}|${f.cx},${f.cy},${f.w},${f.h}|` +
    `${f.beds.map((b) => `${b.name}:${b.planted}:${b.pts.length}`).join(";")}|` +
    `${f.dots.map((d) => `${d.species}@${d.x},${d.y}`).join(";")}`;
function renderGlance(frame, anchor, onBed, onOpen, redraw) {
    const NS = "http://www.w3.org/2000/svg";
    const wrap = document.createElement("div");
    wrap.className = "home-view";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "home-glance");
    svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Your garden, seen from above: ${frame.beds.map((b) => b.name).join(", ")}`);
    // Frame the beds exactly as the ground map's first fit does - the closest zoom whose viewport
    // still holds the whole bounding box, so a balcony and a quarter-acre both sit right.
    const lat = anchor?.lat ?? 0;
    const reqMpp = Math.max(frame.w / (VIEW_W * FIT_FRAC), frame.h / (VIEW_H * FIT_FRAC));
    let z = ZOOM_MIN;
    while (z < ZOOM_MAX && metresPerPixel(lat, z + 1) >= reqMpp)
        z++;
    const zoom = Math.max(ZOOM_MIN, z - 1); // one step wider - the ground map's own choice
    const mpp = anchor ? metresPerPixel(lat, zoom) : reqMpp;
    const proj = { cx: frame.cx, cy: frame.cy, mpp, w: VIEW_W, h: VIEW_H };
    const toPx = (xm, ym) => project([xm, ym], proj);
    const tiles = document.createElementNS(NS, "g");
    svg.append(tiles);
    const attrib = document.createElement("p");
    attrib.className = "home-attrib";
    let expectedTiles = 0;
    if (anchor) {
        drawTiles({
            svg: tiles, anchor, cx: frame.cx, cy: frame.cy,
            span: Math.max(VIEW_W, VIEW_H) * mpp,
            zoom, mpp, toPx, attrib,
            requestRedraw: redraw,
            plain: true, // the expected-tiles retry below counts <image> nodes - see drawTiles
        });
        // How many tiles this frame WANTS. drawTiles removes an <image> the moment it errors, so
        // counting them later against this number is how a partial backdrop is told from a whole one -
        // "some tiles arrived" used to read as success and stop the retry with holes on screen.
        expectedTiles = tiles.querySelectorAll("image").length;
    }
    const unit = Math.max(VIEW_W, VIEW_H);
    for (const bed of frame.beds) {
        const poly = document.createElementNS(NS, "polygon");
        poly.setAttribute("class", bed.planted ? "hg-bed planted" : "hg-bed");
        poly.setAttribute("points", bed.pts.map((p) => toPx(p[0], p[1]).join(",")).join(" "));
        poly.dataset.bed = bed.name;
        poly.addEventListener("click", (ev) => { ev.stopPropagation(); onBed(bed.name); });
        svg.append(poly);
    }
    // The plantings, in THEIR SPECIES' COLOURS - the same fixed colourblind-safe palette the ground
    // map assigns, so a plant is the same colour on both surfaces. The map's own rule applies here
    // too: a colour alone does not say what a plant IS, so every species that gets a dot gets a
    // legend row underneath (and the dot carries the name as its tooltip).
    const colorOf = colorAssigner();
    const legend = new Map();
    for (const d of frame.dots) {
        const [px, py] = toPx(d.x, d.y);
        const colour = colorOf(d.species);
        const name = app.speciesName?.(d.species) ?? d.species;
        if (!legend.has(d.species))
            legend.set(d.species, colour);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "hg-dot");
        c.setAttribute("cx", String(px));
        c.setAttribute("cy", String(py));
        c.setAttribute("r", String(Math.max(unit * 0.008, 3)));
        c.setAttribute("fill", colour);
        const tip = document.createElementNS(NS, "title");
        tip.textContent = name;
        c.append(tip);
        svg.append(c);
    }
    // Labels last, so a bed drawn over another never buries its neighbour's name.
    for (const bed of frame.beds) {
        const cx = bed.pts.reduce((a, p) => a + p[0], 0) / bed.pts.length;
        const cy = bed.pts.reduce((a, p) => a + p[1], 0) / bed.pts.length;
        const [px, py] = toPx(cx, cy);
        const label = document.createElementNS(NS, "text");
        label.setAttribute("class", "hg-name");
        label.setAttribute("x", String(px));
        label.setAttribute("y", String(py));
        label.textContent = bed.name;
        svg.append(label);
    }
    svg.addEventListener("click", onOpen);
    wrap.append(svg);
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
    wrap.append(attrib);
    // A TILE THAT FAILS ONCE MUST NOT BE GONE FOREVER. drawTiles removes an <image> the moment it
    // errors (D-021: tiles are backdrop pixels, and the ground map survives this because it redraws
    // constantly). This view draws ONCE, so a single failed request on a busy first load left the
    // ground permanently blank - which is exactly the maintainer's report: no imagery until a trip
    // to Plan warmed the browser cache and some later draw rebuilt the view. So: if nothing has
    // painted shortly after building, rebuild - a few times, backing off, then stop trying.
    if (anchor)
        scheduleTileRetry(tiles, expectedTiles, redraw);
    return wrap;
}
/** The cached view for this garden, or a freshly built one. */
function glanceFor(frame, anchor, plot, onBed, onOpen, redraw) {
    const key = glanceKey(frame, anchor, plot);
    if (glanceCache && glanceCache.key === key)
        return glanceCache.el;
    const el = renderGlance(frame, anchor, onBed, onOpen, redraw);
    glanceCache = { key, el };
    return el;
}
let tileTries = 0;
let tileTimer = 0;
const TILE_BACKOFF = [900, 1800, 3600, 7000, 12000]; // then stop - the beds stand on their own
/** Rebuild the view while its backdrop is incomplete.
 *
 *  The FIRST load is the hard case: the app is fetching its corpus bundle and a 3.7 MB climate
 *  table at the same moment, and a tile that loses that race is deleted by drawTiles and never
 *  asked for again. The maintainer met this twice - once as "no imagery until I visit Plan and come
 *  back" (a rebuild there picked up the warmed cache), and again after the view started CACHING its
 *  node, which removed even that accidental recovery. So the retry has to be the recovery path, not
 *  a formality: several attempts, backing off, counting against the tiles the frame actually wants
 *  rather than against zero. */
function scheduleTileRetry(layer, expected, redraw) {
    if (tileTimer)
        clearTimeout(tileTimer);
    if (expected === 0 || tileTries >= TILE_BACKOFF.length)
        return;
    tileTimer = window.setTimeout(() => {
        tileTimer = 0;
        if (layer.querySelectorAll("image").length >= expected) {
            tileTries = 0;
            return;
        } // whole
        tileTries++;
        glanceCache = null; // the retry must REBUILD - reusing the cached (tile-less) node retries nothing
        redraw();
    }, TILE_BACKOFF[Math.min(tileTries, TILE_BACKOFF.length - 1)]);
}
/** Throw the drawn view away so the next render REBUILDS it. Needed whenever something outside the
 *  frame changes what the backdrop would be - the maps key landing is the case that bit: the view
 *  re-rendered, reused its cached node, and so never called drawTiles again, which is what would
 *  have kicked the Google session. The result was the Esri fallback for the life of the page. */
export function invalidateHomeGlance() {
    tileTries = 0;
    glanceCache = null;
}
/** Coming back to the landing gets the backdrop a fresh set of attempts. This is the path the
 *  maintainer found by hand ("navigating to plan and back renders it") - a trip through the app
 *  warms the browser's own tile cache, so the odds on the next try are much better than the first.
 *  Cheap: it only clears the cached node when the view is actually missing its ground. */
export function retryHomeTiles() {
    const layer = document.querySelector("#homereturn .home-glance");
    if (layer && layer.querySelectorAll("image").length > 0)
        return; // it has its ground already
    tileTries = 0;
    glanceCache = null;
}
/** Render the returning state into the landing. Returns false when there is nothing to show, and
 *  the caller then leaves the stranger's doors exactly as they are.
 *
 *  The stranger's landing is not touched here: the `home-returning` body class hides it in CSS and
 *  restores the tab bar (the front door hides it - "no app chrome until you step inside" - but a
 *  gardener with ground is already inside, and needs the way back to Plan, Log and Calendar). */
// Short titles for the returning-home question -> guide links (O58 linking). The catalogue keys the
// slug; the surface names it, so the label lives here at the render rather than in homefacts.
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
// O87 F6: the returning gardener's own last-frost strip. The corpus/guide side draws this for
// example stations ({{frostcompare:}}, {{frostfig:}}); here it is the reader's OWN site, from the
// same committed percentiles the season ribbon already reads. R-090's honesty: a frost date is
// ODDS, so the bar runs from the median through the gamble to the 1-in-10 late date, both marked.
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
    card.href = "#/guide/frost-dates";
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
export function renderHome(view) {
    const host = document.getElementById("homereturn");
    if (!host)
        return false;
    const something = !!(view.welcome || view.ask || view.quiet || view.due.length
        || view.gardens.length || view.glance || view.digest.length || view.season || view.feed);
    host.hidden = !something;
    if (!something)
        host.replaceChildren(); // leave nothing stale behind a hidden host
    // A DRAW BEFORE THE LEDGER IS READ MUST NOT UNSAY THE PRE-PAINT CLAIM. Every boot draws at
    // least once before setupLog resolves, and at that moment the snapshot is legitimately empty -
    // so an unguarded toggle tore the returning class straight back off, the stranger's doors
    // painted for the length of an IndexedDB read, and the state reappeared. That IS the flash the
    // maintainer reported, and a frame-sampling e2e check caught it surviving the first two fixes.
    // Until `settled`, absence means "not loaded yet", not "nothing to show".
    if (something || settled)
        document.body.classList.toggle("home-returning", something);
    if (!something)
        return false;
    host.replaceChildren();
    if (view.gardens.length) {
        const strip = document.createElement("div");
        strip.className = "home-gardens";
        for (const g of view.gardens) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = g.due ? "home-g due" : "home-g";
            if (g.id === view.plot)
                b.classList.add("here"); // O64(i): the garden you are in
            b.dataset.plot = g.id;
            const head = document.createElement("div");
            head.className = "home-ghead";
            const n = document.createElement("p");
            n.className = "n";
            n.textContent = g.name;
            head.append(n);
            if (g.news && g.news > 0) { // O64(i): unseen team-post count on an OTHER garden
                const news = document.createElement("span");
                news.className = "home-gnews";
                news.textContent = String(g.news);
                news.setAttribute("aria-label", `${g.news} new team ${g.news === 1 ? "post" : "posts"}`);
                head.append(news);
            }
            const s = document.createElement("p");
            s.className = "s";
            s.textContent = g.due ? `${g.due} due this week` : "nothing due";
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
    // A (O63): "since you were away" - a ranked digest of team + bed changes in the absence gap, capped
    // by the budget with a "+N more" disclosure. Above the welcome: it is what you missed, so it leads.
    if (view.digest.length) {
        const dig = document.createElement("section");
        dig.className = "home-digest";
        const h = document.createElement("p");
        h.className = "home-digest-h";
        // O64g: the absence count is back in the header ("· N days"), as the approved mockup showed it.
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
            // O64g: EXPAND in place (the approved mockup: "expands on tap - nothing lost"). The budget caps
            // the DEFAULT view; a tap is an explicit ask to see the rest, so the cap is honoured, not broken.
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
    // GROUND FIRST (maintainer's ruling on the orchestrator mockup): you see your garden, then what
    // it needs. And NO SECTION LABELS anywhere below - the same ruling. The blocks are told apart by
    // their own shape now: the view is a picture, the ask wears the accent rail, the dated lines
    // carry a mono when-column, the questions are chevron rows, the functions are a grid.
    // ...and only while the landing is ON SCREEN. A browser is entitled to skip loading images
    // inside a `display:none` subtree, and the home draws on every draw - including the many that
    // happen while the user is on Plan. Building the backdrop into a hidden page is how it ended up
    // requested-but-never-painted, which is exactly the shape of the maintainer's report: no imagery
    // until a trip to Plan and back, because that round trip finally built it somewhere visible.
    const landingUp = document.getElementById("page-start")?.hidden === false;
    if (view.glance && landingUp) {
        const card = document.createElement("section");
        card.className = "home-card home-viewcard";
        card.append(glanceFor(view.glance, view.anchor, view.plot, view.onBed, view.onOpen, view.redraw));
        const hint = document.createElement("p");
        hint.className = "home-cardnote";
        const beds = view.glance.beds.length;
        hint.textContent = (view.gardenName ? `${view.gardenName} \u00b7 ` : "")
            + (beds === 1 ? "Tap the bed to open its log, or the view to plan."
                : `${beds} beds. Tap one to open its log, or the view to plan.`);
        card.append(hint);
        host.append(card);
    }
    // C (O63): the season ribbon - one ranked line of what the season is doing to this ground, under
    // the map (ground first, then the season, then the decision). One line, never a list.
    if (view.season) {
        const rib = document.createElement("a");
        rib.className = "home-season";
        rib.href = view.season.href;
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
    // O87 F6: the site's own last-frost window, right under the season line - ground first, then the
    // season, then the frost odds that schedule the planting. Real product output from committed
    // percentiles, so it cannot rot; drawn only when the garden has a located station with both marks.
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
        // THE ASK IS ALLOWED TO SAY NOTHING IS DUE. An app that always finds a task is an app
        // inventing tasks, and this is the line that keeps the surface from drifting into a chore list.
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
    if (view.due.length) {
        const card = document.createElement("section");
        card.className = "home-card home-duecard";
        for (const d of view.due.slice(0, 2)) { // at most two: one ask, then a glance, never a list
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
        host.append(card);
    }
    // THE QUESTIONS. Rotating (the ruling), computed from this gardener's own plants and the month,
    // and every one routes to a rule's own evidence page - never a search box, because this engine
    // is not a general gardening oracle and a question it cannot answer is worse than one it never
    // asked.
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
            // O58 linking: the fuller how-to behind the question, for a returning gardener whose own plants
            // raised it. The question's href stays the terse rule evidence; this is the guide beside it -
            // a static page, new tab, so a plan in progress is not lost to a documentation detour.
            if (q.guide) {
                const g = document.createElement("a");
                g.className = "askq-guide";
                g.href = `../guides/${q.guide}/`;
                g.target = "_blank";
                g.rel = "noopener";
                g.textContent = `Guide: ${GUIDE_LABEL[q.guide] ?? "read more"} \u2192`;
                row.append(g);
            }
            asks.append(row);
        }
        host.append(asks);
    }
    // B (O63): the team feed digest - the single newest unseen post, low (community is not a decision,
    // so it never displaces the ask). The body is feed.ts's plain text, the voice boundary; the count
    // and the rest live in the Log.
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
    // THE FUNCTION ROW: a way into everything else, each carrying ONE live fact - because a tab bar
    // says where you can go, not whether it is worth going.
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
    // The way in. The tab bar is back in this state, but the landing's job is "where do I begin", and
    // for a returning gardener the answer is their own garden - so it is said in words too. It wears
    // the landing's own primary-door language (D-168's .lg-door-plan), because that is exactly what
    // it is: this state's version of the stranger's fourth door.
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
// ---- wiring (reads the live app state, same shape as askcard.ts) -------------------------------
// Has the ledger been read yet this boot? Set once, by app.ts, when setupLog resolves - the same
// signal the sheet's arrival pick waits on, and for the same reason: before it, an empty snapshot
// is a snapshot that has not arrived.
let settled = false;
export function settleHome() { settled = true; }
export function homeSettled() { return settled; }
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Does this device have ground worth greeting? The landing's fast path reads the answer from a
 *  stamp (app.ts) so it can decide start-vs-plan synchronously, before anything paints.
 *
 *  The EXAMPLE garden counts (maintainer, 2026-08-01): the demo lands on this page too, with the
 *  mock garden data - the home IS the demo now. The absence welcome alone stays off for it (see
 *  renderHomeNow): the demo has beds and dates to show, but "you were away" describes a
 *  relationship with the gardener that a garden we invented does not have. */
export function hasGround() {
    return app.logSnapshot.beds.length > 0 || app.logSnapshot.seasons.length > 0;
}
/** The active garden's display name, for the view's title. The log snapshot does not carry it, so
 *  read the plot record the log refresh mirrors - falling back to nothing rather than to a guess. */
function gardenNameNow() {
    const n = app.currentPlot?.name;
    return typeof n === "string" && n.trim() ? n : null;
}
/** A species' corpus family, for the rotation questions ("what can follow my tomatoes"). */
function familyOf(bundle, sid) {
    const sp = bundle.species.find((x) => x.id === sid);
    return sp?.family ?? null;
}
const dayOfYear = (iso) => {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
};
/** The function row's live facts. Each is read from state already on screen elsewhere, so the row
 *  can never claim something the surface it points at would contradict. A row with nothing true to
 *  say is omitted rather than padded with a zero. */
function liveFunctions(todayIso, tasks) {
    const out = [];
    const next = tasks
        .filter((x) => typeof x.date === "string" && x.date > todayIso && x.kind !== "logged")
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next?.date)
        out.push({ name: "Calendar", value: `next: ${whenLabel(todayIso, next.date)}`, route: "calendar" });
    const openSeason = app.logSnapshot.seasons.find((sn) => sn.id === app.logSnapshot.seasonId);
    const planted = (openSeason?.plantings ?? []).length;
    if (planted)
        out.push({ name: "Log", value: `${planted} planting${planted === 1 ? "" : "s"}`, route: "log" });
    // Review earns its place only once a PAST season exists to review - before that it is an empty room.
    const past = app.logSnapshot.seasons.filter((sn) => sn.id !== app.logSnapshot.seasonId);
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
// O63: the home reads posts (A's team summary, B) but is drawn synchronously every frame. So posts
// are cached per plot and refreshed off-thread on the SAME async-redraw seam the glance tiles use: a
// stale cache kicks a listPosts, whose resolution calls app.homeRefresh() to redraw with the posts in
// hand. A draw before the fetch lands simply shows no team row yet (bed rows, which need no posts,
// show immediately).
let postsCache = null;
let fetchingPlot = null;
function cachedPosts(plot) {
    if (postsCache && postsCache.plot === plot)
        return postsCache.posts;
    if (fetchingPlot !== plot && app.logDb) {
        fetchingPlot = plot;
        listPosts(app.logDb, plot).then((posts) => {
            if (fetchingPlot !== plot)
                return; // a later plot switch won the race
            postsCache = { plot, posts: posts.filter((p) => !p.deleted) };
            fetchingPlot = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingPlot === plot)
            fetchingPlot = null; });
    }
    return [];
}
// O64(i): the gardens strip flags WHICH garden has unseen team news, so a multi-garden keeper (Ines)
// sees it without opening each one. That count needs posts for EVERY strip garden, not just the active
// one - a small tally cached like the single-plot posts above, resolved off-thread and redrawn on the
// same seam. Keyed by the plot set + the gap + who "I" am, so a plot switch, a new gap, or a sign-in
// change refetches. The active garden is left out: its own news is B's job, below.
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
                return; // a later strip/gap won the race
            newsCache = { key, counts: new Map(entries) };
            fetchingNews = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingNews === key)
            fetchingNews = null; });
    }
    return new Map();
}
/** Drop the home's posts caches so the next draw refetches - after a plot switch or a new post. */
export function invalidateHomePosts() {
    postsCache = null;
    fetchingPlot = null;
    newsCache = null;
    fetchingNews = null;
}
// O64(e): the home redraws often (every tile arrival), so resolving climate on each draw was the one
// per-draw nearest-site scan on the page - against this surface's built-once-per-garden doctrine.
// Memoize by anchor: a plot switch changes lat/lon and recomputes; a bare redraw reuses.
let climMemo = null;
function memoClimate(lat, lon, bundle) {
    if (climMemo && climMemo.lat === lat && climMemo.lon === lon)
        return climMemo.clim;
    const clim = resolveClimate(lat, lon, bundle);
    climMemo = { lat, lon, clim };
    return clim;
}
/** Compose and render the returning home from the live state. Called every draw (like the ask
 *  card), so it can never drift from the surfaces below it. */
export function renderHomeNow(bundle) {
    // O55 "View as stranger": the editor needs the signed-out landing (the doors) on screen to make
    // it editable, and a signed-in maintainer can otherwise never see it. An all-empty view makes
    // renderHome hide the returning host and drop the body class - presentation only, data untouched.
    if (app.viewAs === "stranger") {
        return renderHome({ welcome: null, ask: null, quiet: null, due: [], gardens: [], glance: null,
            questions: [], digest: [], digestMore: [], digestDays: null, season: null, frost: null, feed: null, onFeed: () => { },
            functions: [], onFunction: () => { }, gardenName: null,
            plot: "", anchor: null, redraw: () => { },
            onGarden: () => { }, onBed: () => { },
            onOpen: () => { } });
    }
    const t = todayIso();
    const demo = isExamplePlot(app.currentPlotId);
    const sentence = (task) => taskSentence(task, bundle);
    const tasks = hasGround() ? gardenWideTasks(bundle, Number(t.slice(0, 4))) : [];
    const away = demo ? null : daysAway();
    const live = hasGround() ? (app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId)
        ?.plantings ?? []).filter((p) => !p.end_date) : [];
    // A's bed events: a live DTM-scheduled planting that entered its picking window (sown + the low
    // DTM) INSIDE the absence gap. GDD/perennial crops carry no DTM, so they contribute nothing here -
    // and nothing is invented (the resolver gates on scheduling_model === "dtm").
    const bedEvents = away != null ? live.flatMap((p) => {
        if (!p.sown)
            return [];
        const sp = bundle.species.find((x) => x.id === p.species);
        if (!sp || sp.scheduling_model !== "dtm")
            return [];
        const dtm = resolveDtm(sp, p.cultivar_group ?? null);
        if (!dtm)
            return [];
        // O64(a): only claim "in its picking window now" while today is still INSIDE the window
        // (sown + dtm[1]). On a long absence a crossing can be months old and the window long closed;
        // saying "now" then is a false statement, and a false line breaks the corpus's honesty premise.
        if (t > isoAddDays(p.sown, dtm[1]))
            return [];
        return [{ text: `Your ${commonName(bundle, p.species) || p.species} crossed ${dtm[0]} days - in its picking window now.`,
                whenIso: isoAddDays(p.sown, dtm[0]) }];
    }) : [];
    // O64(b): the team layers gate on sign-in, matching the Log's own feed (a signed-out device must
    // not show "from your team" over a Log that has no feed section). O64(c): a gardener's OWN posts
    // are not news to them - exclude them from A's count and B before anything reads the list.
    const posts = hasGround() && isSignedIn() ? cachedPosts(app.currentPlotId) : [];
    const myEmail = signedInEmail();
    const teamPosts = posts.filter((p) => p.author && p.author !== myEmail);
    // O64j: A is bed changes only; B (below) is the sole team-news surface. teamPosts feed B, not A.
    const digestAll = hasGround() ? sinceAway({ todayIso: t, daysAway: away, bedEvents }) : [];
    const budgeted = contextBudget(digestAll, 3);
    // C: the season ribbon, from this garden's own resolved climate (frost dates + their grade) and,
    // for an onion grower at the solstice, daylength.
    const clim = hasGround() && app.currentPlot?.anchor
        ? memoClimate(app.currentPlot.anchor.lat, app.currentPlot.anchor.lon, bundle) : null;
    const site = clim?.site ?? null;
    const season = hasGround() ? seasonRibbon({
        todayIso: t,
        lastFrostMmdd: site?.last_frost_32f?.p50 ?? null,
        firstFreezeMmdd: site?.first_freeze_32f_p50 ?? null,
        frostGrade: site?.provenance?.grade ?? null,
        lat: app.currentPlot?.anchor?.lat ?? null,
        onionsPresent: live.some((p) => p.species === "allium_cepa"),
    }) : null;
    // O87 F6: the frost window for THIS garden's station - the same `site` the season ribbon reads.
    // Drawn only when both the median and the 1-in-10 exist (a station with a partial record gets the
    // season line but no strip, rather than a bar with a missing end).
    const lf = site?.last_frost_32f;
    const frost = hasGround() && lf?.p50 && lf?.p10
        ? { p50: lf.p50, p40: lf.p40, p30: lf.p30, p20: lf.p20, p10: lf.p10 } : null;
    // B: the single newest post written inside the gap (unseen since the last boot).
    const gapStart = away != null && away > 0 ? isoAddDays(t, -away) : null;
    const unseen = gapStart ? teamPosts.filter((p) => p.at > gapStart) : [];
    const feed = unseen.length
        ? { team: null, post: { author: unseen[0].author, at: unseen[0].at, body: unseen[0].body }, count: unseen.length }
        : null;
    const facts = homeFacts({
        // The demo never gets the absence welcome: "you were away" describes a relationship a garden
        // we invented does not have. Everything else - the view, the dates - is the demo's whole point.
        todayIso: t, daysAway: demo ? null : daysAway(),
        seasons: app.logSnapshot.seasons, seasonId: app.logSnapshot.seasonId,
        bedCount: app.logSnapshot.beds.length, tasks, sentence,
    });
    const card = hasGround() ? currentAskCard(bundle) : null;
    const a = card?.ask ?? null;
    const openSeason = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId) ?? null;
    // O64(i): the strip flags which OTHER garden has unseen team news; the ACTIVE garden stays unmarked
    // (its own news is B's job below - one-topic-once). Signed-in and a real gap only.
    const stripCards = hasGround() && !demo
        ? gardenStrip(gardensDueSoon(bundle, t).map((g) => ({ id: g.plotId, name: g.name, due: g.due })))
        : [];
    const newsCounts = (isSignedIn() && gapStart && stripCards.length)
        ? cachedGardenNews(stripCards.map((c) => c.id), gapStart, myEmail)
        : new Map();
    const gardens = stripCards.map((c) => ({ ...c,
        news: c.id === app.currentPlotId ? 0 : (newsCounts.get(c.id) ?? 0) }));
    return renderHome({
        welcome: hasGround() ? welcomeBack(facts) : null,
        ask: a ? { kicker: a.kicker, q: a.q, why: a.why, label: a.go.label, run: () => followAsk(a.go) } : null,
        quiet: card?.quiet ?? null,
        due: dueRows(t, tasks, sentence),
        gardens,
        glance: hasGround()
            ? gardenFrame(app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, planted: b.planted })), (openSeason?.plantings ?? []).filter((p) => !p.end_date)
                .map((p) => ({ region: p.region, species: p.species })))
            : null,
        // Which garden the view is showing, said out loud - with a strip above it, "these are the beds
        // of WHICH one" must never be a guess (the multi-garden ask from the staging walk).
        // The questions this gardener's own garden makes real, rotating by the day (the ruling).
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
        // O63 contextual layers, all ranked/capped/gated in the pure layer and here.
        digest: budgeted.shown,
        digestMore: digestAll.slice(3),
        digestDays: away,
        season,
        frost,
        feed,
        onFeed: () => { go("log"); },
        // Everything else, each carrying ONE live fact: a tab bar says where you can go, this says
        // whether it is worth going. Only rows with something true to report appear.
        functions: hasGround() ? liveFunctions(t, tasks) : [],
        onFunction: (route) => { go(route); },
        gardenName: gardenNameNow(),
        plot: app.currentPlotId,
        anchor: app.currentPlot?.anchor ?? null,
        // The imagery's own redraw: drawTiles kicks the Google session in the background and calls this
        // when it lands. Re-render the home rather than the page - same seam the calendar's async
        // multi-garden read uses.
        redraw: () => { app.homeRefresh?.(); },
        onGarden: (id) => { void app.switchPlot?.(id); },
        onBed: (bed) => { go("log"); app.openLogBed?.(bed, null); },
        onOpen: () => { go("plan"); },
    });
}
