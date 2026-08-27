// Web UI - the only file that touches the DOM. It loads the bundle and renders intake (C2) +
// the guild browser using the portable engine core (engine/). The React Native app will replace
// this file with RN components while importing the same engine/ core unchanged.
import { resolveSpecies } from "./engine/compiler.js";
import { familyName, humanize, titleCase } from "./engine/labels.js";
import { resolveClimate, resolveZone } from "./engine/intake.js";
import { frostCalibration } from "./engine/frostcalib.js";
import { area as regionArea } from "./engine/regions.js";
import { backendConfigured, captureAuthHash, isSignedIn, onAuthChange } from "./account.js";
import { applyCopy, applySeasonalCopy, copy } from "./copy.js";
import { $, familiesOf, LEN_INPUT_IDS, lenM, num } from "./dom.js";
import { activeBundle, app, commonName, ruleClaim } from "./state.js";
import { isExamplePlot } from "./example.js";
import { initCalendar, renderCalendar } from "./calendar.js";
import { appliedPlanDots, confidenceBadge, currentBedRegion, currentBedSun, declaredPriorYear, guildPlacementGlimpse, historySource, mergePriorOccupancy, myBedMemberCount, plantingOnBed, renderClimate, renderEligibility, renderGuilds, renderMyBed, renderSeason, setGuildFocus } from "./plan.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { guildStatus, laysOutAsHills } from "./engine/guilds.js";
import { placeBed, setPriorOccupancy } from "./storage.js";
import { nextBedName, nextOrigin } from "./dimbed.js";
import { renderExtension } from "./panels/extension.js";
import { renderSoil, renderSoilSummary } from "./panels/soil.js";
import { renderGardenKnows } from "./panels/knows.js";
import { ledgerRing } from "./ledgerring.js";
import { frostBand } from "./panels/frostrisk.js";
import { makeSyntheticSeasons, renderEarned, renderFrost, renderSolar, setupLog } from "./log.js";
import { initNav, setNavGated } from "./nav.js";
import { initAnswers, guildFromHash } from "./answers.js";
import { coachBand, COACH_HEADING, COACH_WHERE } from "./coachband.js";
import { doorClaim } from "./doors.js";
import { noteArrival, renderAskCards } from "./askcard.js";
import { homeSettled, invalidateHomeGlance, invalidateHomePosts, renderHomeNow, retryHomeTiles, settleHome } from "./home.js";
import { initReview } from "./review.js";
import { initShare } from "./shareview.js";
import { buildSharePayload, encodeShare } from "./sharecodec.js";
import { toast } from "./notices.js";
import { loadMapsConfig, loadMapsJs, mapsApiKey } from "./maps.js";
import { ensureWhereMap, setWhereMapCenter, show as gmapShow } from "./gmap.js";
import { currentRoute, initRouter } from "./router.js";
import { countPageview, countRung } from "./analytics.js";
import { endArrival, initPlanSheet, updateStepStates } from "./sheet.js";
import { applyPrefRecord, applySeason, applyTheme, lengthUnit, mToInput, seasonChoice, setSeasonChoice, setTempSystem, setThemeChoice, setUnitSystem, tempSystem, themeChoice, unitSystem } from "./units.js";
import { renderWhy, setWhyFocus, setWhyBeliefFocus, setWhyKind, syncWhyHash } from "./why.js";
import { plantFromHash, renderPlantCard, setPlantFocus } from "./panels/plantcard.js";
import { initEditor } from "./editor.js";
const BUNDLE_URL = "../build/app-bundle.json";
// The ZIP centroid + zone + frost tables are split out of the bundle and lazy-loaded (D-089). O38b
// (2026-08-07) shards them geographically: base.json holds the >80km global fallbacks, table
// metadata, the non-empty-cell manifest, and a ZIP3->cells directory; each c<ci>_<cj>.json holds one
// 2.5deg cell's centroids/zones/stations. A located session fetches base + the 3x3 block around its
// point (~19-68KB gz) instead of the whole 493KB file; both nearest-neighbour resolvers stay exact
// because every cell is >=80km wide and they cap at 80km. See engine/build_bundle.py build_zip_grid.
const GRID_BASE_URL = "../build/zip-grid/base.json";
const GRID_DEG = 2.5;
const gridCell = (lat, lon) => [Math.floor(lat / GRID_DEG), Math.floor(lon / GRID_DEG)];
async function loadBundle() {
    const res = await fetch(BUNDLE_URL);
    if (!res.ok)
        throw new Error(`could not load ${BUNDLE_URL}: ${res.status}`);
    return (await res.json());
}
// The landing "odds, not a date" frost receipt (D-029 sibling to the two rule receipts). It proves the
// CLIMATE half of the epistemics story: the scheduling dates are a sourced percentile band, not a made-up
// "plant on May 15." Rendered live from a curated NCEI reference station in the bundle (its real 1991-2020
// normals) so the numbers can never drift from the corpus; if the station or its band is absent, the card
// stays hidden. It is labelled by climate TYPE, not the city name - the point is that it is a reference
// illustration, not the visitor's own location (they have none yet), so spotlighting one specific town
// only read as arbitrary. The station key stays fixed so the band is deterministic (and e2e-pinnable).
// The Account ledger ring (P2.3 slice 2 / D-189). Three assignments: the arc (a CSS custom property
// the conic-gradient reads), the numeral, and the standing line. ledgerring.ts owns the numbers and
// the copy so this stays presentation-only; the `live` class carries the LIVE type styling.
function renderLedgerRing(site, seasons) {
    const dial = document.getElementById("ledgerringdial");
    const num = document.getElementById("ledgerringnum");
    const label = document.getElementById("ledgerringlabel");
    const wrap = document.getElementById("ledgerring");
    if (!dial || !num || !label || !wrap)
        return;
    const ring = ledgerRing(seasons, site);
    dial.style.setProperty("--frac", String(ring.frac));
    num.textContent = ring.center;
    label.textContent = ring.label;
    wrap.classList.toggle("live", ring.state === "live");
}
const LANDING_FROST_STATION = { key: "minneapolis", place: "an example cold-winter garden" };
function renderLandingFrost(bundle) {
    const host = document.getElementById("lgfrost");
    if (!host)
        return;
    const site = (bundle.climate?.sites ?? []).find((s) => s.key === LANDING_FROST_STATION.key);
    const band = site ? frostBand(site) : null;
    if (!band || !band.median || !band.safe)
        return; // no data → the card simply doesn't appear
    const { median, safe, rows } = band;
    host.innerHTML = "";
    const kicker = document.createElement("span");
    kicker.className = "lg-kicker";
    kicker.textContent = copy.landingFrostKicker;
    kicker.dataset.copyKey = "landingFrostKicker"; // O54: JS-rendered strings join spot mode
    host.appendChild(kicker);
    const h = document.createElement("h2");
    h.className = "lg-team";
    h.textContent = copy.landingFrostTitle;
    h.dataset.copyKey = "landingFrostTitle";
    host.appendChild(h);
    const src = document.createElement("p");
    src.className = "lg-frost-src";
    src.textContent = `${LANDING_FROST_STATION.place} · NOAA NCEI 1991-2020 normals`;
    host.appendChild(src);
    // The band, earliest date (median, 50%) on the left → latest (the safe hedge) on the right. rows come
    // safest-first (p10 first), so reverse for earliest→latest reading order. Colour runs warn→ok: plant at
    // the 50% date and half of years have already frosted; wait to the last tick and few still do.
    const scale = document.createElement("div");
    scale.className = "lg-frost-band";
    scale.setAttribute("role", "img");
    scale.setAttribute("aria-label", `Last spring frost odds for ${LANDING_FROST_STATION.place}: half of years have frosted by ${median.label}, one in ten as late as ${safe.label}.`);
    const ticks = document.createElement("ol");
    ticks.className = "lg-frost-ticks";
    const ordered = [...rows].reverse(); // p50 … p10 = earliest … latest
    ordered.forEach((r, i) => {
        const li = document.createElement("li");
        li.style.setProperty("--t", ordered.length > 1 ? String(i / (ordered.length - 1)) : "0");
        const d = document.createElement("span");
        d.className = "d";
        d.textContent = r.label;
        const p = document.createElement("span");
        p.className = "p";
        p.textContent = `${r.pct}%`;
        li.append(d, p);
        ticks.appendChild(li);
    });
    scale.appendChild(ticks);
    host.appendChild(scale);
    const why = document.createElement("p");
    why.className = "lg-why";
    const b1 = document.createElement("b");
    b1.textContent = median.label;
    const b2 = document.createElement("b");
    b2.textContent = safe.label;
    why.append("Half the years here have seen their last freeze by ", b1, "; one year in ten, a freeze still comes as late as ", b2, ". We don't hand you a planting date - we hand you the odds and let you choose the risk.");
    host.appendChild(why);
    const ev = document.createElement("a");
    ev.className = "lg-rec-ev";
    ev.href = "#/why?climate";
    ev.textContent = `${copy.landingFrostEvidence} →`;
    ev.dataset.copyKey = "landingFrostEvidence";
    host.appendChild(ev);
    host.hidden = false;
}
// The rule the landing's placement diagram embodies (tall crops to the polar side, so their shadow
// falls off the bed) - a grade-A spatial rule, so the "it shows its work" glimpse names exactly what
// the diagram just demonstrated. Fixed so the card is deterministic (e2e-pinnable) and never lands on
// an unverified claim.
const LANDING_RULE_ID = "R-003";
/** The "see the planner" band (audit R3, option C; DESIGN REWORKED on the maintainer's pass,
 *  2026-08-07 - "the image is off centre and no background is shown... not effective; the intro is
 *  not a title design"): REAL product output on the landing, not a screenshot (rots + a binary) and
 *  not a hand-drawn mockup (drifts). Three changes from the first cut: the section now opens with the
 *  landing's own title grammar (lg-h2 + lg-lead, like "Beyond the famous three."); the diagram sits
 *  on the MAP'S OWN visual language (soil-toned bed on ground green, centred) so it reads as a
 *  garden bed and not abstract dots; and a LEGEND built from the real placement (each species' count
 *  in the exact colour its dots wear) tells the stranger what they are looking at. The rule card is a
 *  real graded rule read straight from the bundle. If the layout can't be built, the band stays
 *  hidden - the landing degrades to exactly what it showed before. */
function renderLandingProduct(bundle) {
    const host = document.getElementById("lgproduct");
    if (!host)
        return;
    const guild = (bundle.guilds ?? []).find((g) => g.id === "three_sisters");
    const rule = (bundle.rules ?? []).find((r) => r.id === LANDING_RULE_ID);
    // The example bed: a fixed 10 ft × 10 ft square (3.048 m - exactly ten feet, so the copy's "10-foot
    // bed" is a true sentence) at a curated mid-latitude. This is "what a planned bed looks like", not
    // the visitor's garden.
    const exampleBed = { name: "an example bed", region: { shape: "rect", x: 0, y: 0, w: 3.048, h: 3.048 } };
    const glimpse = guild ? guildPlacementGlimpse(guild, exampleBed, { lat: 40, lon: -88 }, bundle) : null;
    if (!glimpse && !rule?.mechanism) {
        host.hidden = true;
        return;
    } // nothing real to show
    host.innerHTML = "";
    const h = document.createElement("h2");
    h.className = "lg-h2";
    h.textContent = copy.landingProductTitle;
    h.dataset.copyKey = "landingProductTitle";
    host.appendChild(h);
    const lead = document.createElement("p");
    lead.className = "lg-lead";
    lead.textContent = copy.landingProductLead;
    lead.dataset.copyKey = "landingProductLead";
    host.appendChild(lead);
    const row = document.createElement("div");
    row.className = "lg-glimpses";
    // Glimpse 1 - the real placement diagram, on the map's own ground, with its legend.
    if (glimpse) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductPlaceKicker;
        k.dataset.copyKey = "landingProductPlaceKicker";
        const frame = document.createElement("div");
        frame.className = "lg-plan-frame";
        glimpse.svg.setAttribute("role", "img");
        glimpse.svg.setAttribute("aria-label", "A Three Sisters bed: corn and beans on nine mounds, squash in the gaps between them.");
        frame.appendChild(glimpse.svg);
        // The legend IS the diagram's decoder: each species' real placed count, wearing the exact colour
        // its dots wear (the same deterministic map placementSvg used). Without it the diagram is
        // abstract circles; with it a stranger reads "the planner placed 67 plants at their own spacing".
        const legend = document.createElement("ul");
        legend.className = "lg-legend";
        for (const p of glimpse.plants) {
            const li = document.createElement("li");
            const dot = document.createElement("span");
            dot.className = "lg-ldot";
            dot.style.background = p.colour;
            li.append(dot, `${p.count} × ${commonName(bundle, p.species).toLowerCase()}`);
            legend.appendChild(li);
        }
        const chip = document.createElement("span");
        chip.className = "lg-fits";
        chip.textContent = "Three Sisters · fits this bed";
        const cap = document.createElement("figcaption");
        cap.textContent = copy.landingProductPlaceCap;
        cap.dataset.copyKey = "landingProductPlaceCap";
        fig.append(k, frame, legend, chip, cap);
        row.appendChild(fig);
    }
    // Glimpse 2 - a real graded rule card, read from the corpus.
    if (rule?.mechanism && rule.claim) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductRuleKicker;
        k.dataset.copyKey = "landingProductRuleKicker";
        const card = document.createElement("div");
        card.className = "lg-rulecard";
        const badge = confidenceBadge(rule.grade ?? "");
        if (badge)
            card.appendChild(badge);
        const claim = document.createElement("p");
        claim.className = "lg-rc-claim";
        claim.textContent = rule.claim;
        const mech = document.createElement("p");
        mech.className = "lg-rc-mech";
        // a long mechanism is trimmed to its first two sentences (the full rule is one tap away); a short
        // one like R-003's shows whole. Never mid-sentence - the point is that the reasoning reads.
        const sentences = rule.mechanism.match(/[^.]+\.?/g) ?? [rule.mechanism];
        mech.textContent = sentences.slice(0, 2).join("").trim();
        card.append(claim, mech);
        const ev = document.createElement("a");
        ev.className = "lg-rec-ev";
        ev.href = `#/why?rule=${LANDING_RULE_ID}`;
        ev.textContent = "See the evidence →";
        const cap = document.createElement("figcaption");
        cap.textContent = copy.landingProductRuleCap;
        cap.dataset.copyKey = "landingProductRuleCap";
        fig.append(k, card, ev, cap);
        row.appendChild(fig);
    }
    host.appendChild(row);
    host.hidden = false;
}
/** O52 (motion-level ruling, 2026-08-06): arm the landing's scroll-reveal. The HIDDEN state is
 *  applied here, never in static CSS - so a reader with "reduce motion" set, a browser without
 *  IntersectionObserver, or a page whose script failed sees every section plainly. Elements a
 *  jump-scroll already passed reveal immediately: nothing above the viewport may stay hidden.
 *  Scoped to #page-start's STRANGER sections ([data-reveal] in the markup); the returning home's
 *  claim elements carry none, because scenario 69 pins that surface against paint flashes. */
function armLandingMotion() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    if (!("IntersectionObserver" in window))
        return;
    const els = Array.from(document.querySelectorAll("#page-start [data-reveal]"));
    if (!els.length)
        return;
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
                e.target.classList.add("in");
                io.unobserve(e.target);
            }
        }
    }, { threshold: 0.15 });
    for (const e of els) {
        e.classList.add("pre");
        io.observe(e);
    }
    // An INSTANT jump (anchor, scroll restore, a test's scrollTo) can pass an element without it
    // ever intersecting a rendered frame, so the observer alone would leave it hidden forever. Any
    // armed element the viewport has passed resolves visible on the next scroll event.
    window.addEventListener("scroll", () => {
        for (const e of els) {
            if (e.classList.contains("pre") && !e.classList.contains("in")
                && e.getBoundingClientRect().bottom < 0) {
                e.classList.add("in");
                io.unobserve(e);
            }
        }
    }, { passive: true });
}
// O98 P3 (D-189 pilot): the home DEEP BLOCK — one credited scene photo behind an opaque text box.
// The scene id is the single knob; swap it once more of the pool is sourced (e.g. garden-beds-summer).
const LANDING_HERO_SCENE = "garden-rows-field";
function renderLandingHero(bundle) {
    const host = document.getElementById("lgdeep");
    if (!host)
        return;
    const scene = bundle.scenes?.[LANDING_HERO_SCENE];
    if (!scene) {
        host.hidden = true;
        return;
    } // empty pool / scene absent → the band stays out (wide-tier pattern)
    host.innerHTML = "";
    // The photo, as the band's backdrop, via the custom property the .heroverlay CSS reads. A meaningful
    // backdrop is NOT a claim: the words below carry the meaning, so the image is atmospheric (the
    // section's aria-label names it) and needs no <img>/alt.
    host.style.setProperty("--hero-img", `url(img/scenes/${scene.file})`);
    const text = document.createElement("div");
    text.className = "herotext";
    const h = document.createElement("h2");
    h.className = "lg-deep-h";
    h.textContent = copy.landingDeepHeading;
    h.dataset.copyKey = "landingDeepHeading";
    const body = document.createElement("p");
    body.className = "lg-deep-body";
    body.textContent = copy.landingDeepBody;
    body.dataset.copyKey = "landingDeepBody";
    // E-IMG: a scene photo ships with its credit or it does not ship. Artist + licence, the licence
    // linked to its source when there is a URL — the same credit the static scene figures carry. It sits
    // inside the opaque .herotext box, so it is legible over any photo (the scenario-108 guarantee).
    const credit = document.createElement("p");
    credit.className = "lg-deep-credit";
    credit.append(`Photo: ${scene.artist} · `);
    if (/^https?:\/\//.test(scene.url ?? "")) {
        const a = document.createElement("a");
        a.href = scene.url;
        a.rel = "noreferrer";
        a.textContent = scene.licence;
        credit.append(a);
    }
    else {
        credit.append(scene.licence);
    }
    text.append(h, body, credit);
    host.append(text);
    host.hidden = false;
}
function main2(bundle) {
    liveBundle = bundle; // for the lock pitch's personalized line (applyAuthGate runs pre-bundle too)
    $("info").textContent =
        `corpus bundle v${bundle.version} · ${bundle.counts.guilds} guilds, ${bundle.counts.rules} rules`;
    renderLandingFrost(bundle);
    renderLandingProduct(bundle);
    renderLandingHero(bundle);
    armLandingMotion();
    // The home's gardens strip waits on the calendar's async multi-garden read (the OTHER gardens'
    // due counts). When that lands, redraw the home alone rather than the whole page.
    app.homeRefresh = () => { markHomeworthy(renderHomeNow(activeBundle(bundle))); };
    app.invalidateHomePosts = invalidateHomePosts; // O64d: sync wires post pulls to a home refetch
    // Landing back on the home gives its backdrop a fresh set of attempts (home.ts explains why the
    // odds are better the second time). A no-op when the view already has its ground.
    window.addEventListener("hashchange", () => {
        if (!location.hash.startsWith("#/start"))
            return;
        retryHomeTiles();
        markHomeworthy(renderHomeNow(activeBundle(bundle)));
    });
    // (The bundled example-site picker was retired in D-132 - it surfaced US metros as selectable
    // sample locations, which read as US-centric once global zone + frost made any point resolve.
    // The curated sites remain in bundle.climate.sites as climate reference data; they're just no
    // longer offered as a manual pick. Address / ZIP / coordinates are the location inputs.)
    // Rotation history: collected now, consumed by the eligible_species port in C3. Sorted by the
    // DISPLAYED common name (not the hidden scientific key familiesOf sorts by), so the checklist
    // reads alphabetically as shown instead of scrambled.
    const fams = $("families");
    for (const f of [...familiesOf(bundle)].sort((a, b) => familyName(a).localeCompare(familyName(b)))) {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = f; // the raw family is the engine's key; the label shows the common name
        cb.className = "fam";
        const name = document.createElement("span");
        // Title Case to match the species names shown elsewhere (the picker, the fit cards) - the
        // checklist and the species lists should read the same way (walkthrough revision).
        name.textContent = titleCase(familyName(f));
        label.appendChild(cb);
        label.appendChild(name);
        fams.appendChild(label);
    }
    // Everything the engine needs, straight from the form. Sun: the engine gates on categories
    // (full sun species vs a shadier bed); ≥6 h of summer sun is the usual "full sun" line.
    // History comes from the season log when one exists (derived, D-002); the checkboxes are the
    // fallback, and ticking one is a manual override - labelled, never silent.
    const siteFromForm = () => {
        // Shade is a LOCAL property of the bed (a fence or tree, not the latitude), declared per-bed in
        // the bed edit form and read back from the PICKED bed - the same bed currentBedRegion
        // resolves, so fit/placement/eligibility agree. Astronomical summer daylight is derived from the
        // location instead (renderClimate) - a different quantity. null = unstated (no gate).
        const sunVal = currentBedSun();
        const { history, source } = historySource(bundle);
        return {
            site: {
                // the same region everything plans on (picked bed - exact area, polygons included -
                // else the shape tool's W×L), so fit verdicts and placement agree by construction
                bed_m2: (() => { const r = currentBedRegion(); return r ? regionArea(r) : null; })(),
                lat: num("lat"),
                lon: num("lon"),
                sun: sunVal,
                history,
                // R-094 host-precise Verticillium reservoir: a logged host (strawberry/raspberry/Solanaceae)
                // flags the ground so a later susceptible planting is refused, while a non-host Rosaceae like
                // apple does not. Only the derived (season-log) path knows species; the manual checkbox path
                // stays family-coarse (Solanaceae only), so the flag is false there.
                verticillium_reservoir: source.kind === "derived" ? source.derived.verticillium_reservoir : false,
                // The open season's id (D-016): the year a new planting goes in. Without it the engine
                // falls back to max-logged-year + 1, which is the season AFTER the one still open.
                season_year: app.logSnapshot.seasonId,
            },
            source,
        };
    };
    // Season review (Phase A): a read-only summary page over the same data this draw cycle
    // reads - the active bundle, the current plot's ledger, and the resolved climatology.
    const reviewRedraw = initReview(() => {
        const { site } = siteFromForm();
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle) : null;
        const ab = activeBundle(bundle);
        const plotSel = $("plotsel");
        return {
            bundle: ab,
            seasons: app.logSnapshot.seasons,
            beds: app.logSnapshot.beds,
            priorOccupancy: app.logSnapshot.priorOccupancy,
            clim: clim?.site ?? null,
            site,
            plotLabel: plotSel.selectedOptions[0]?.textContent ?? humanize(app.currentPlotId),
            commonName: (sid) => commonName(ab, sid),
            ruleClaim: (id) => ruleClaim(bundle, id),
        };
    });
    // O7 / D-164: the received share page - a read-only view over whatever the link carries.
    initShare(() => bundle);
    // O7 / D-164: the share button by the map. Packs beds + this season's live plants into the URL
    // and hands it to the share sheet (D-103's mechanism, in its {url} form) or the clipboard. The
    // link ALSO renders in the box below the button, so what is being sent is visible - and an
    // empty garden gets the reason there, never a silent no-op (the O17 rule).
    const shareCurrentPlan = async () => {
        const box = $("sharebox"), msg = $("shareboxmsg"), urlEl = $("shareurl");
        const seasons = app.logSnapshot.seasons;
        const season = seasons.find((s) => s.id === app.logSnapshot.seasonId) ?? seasons[seasons.length - 1] ?? null;
        const beds = app.logSnapshot.beds;
        box.hidden = false;
        if (!beds.length && !(season?.plantings ?? []).length) {
            urlEl.hidden = true;
            msg.textContent = "Nothing to share yet - trace a bed or add a plant first, and the plan packs itself into a link.";
            return;
        }
        const ab = activeBundle(bundle);
        const plotSel = $("plotsel");
        const label = plotSel.selectedOptions[0]?.textContent ?? humanize(app.currentPlotId);
        // The payload's privacy is structural (sharecodec.ts) - no anchor, no address, no diary. A
        // user variety's id can't resolve on the recipient's app, so its display name travels.
        const payload = buildSharePayload(label, beds, season, bundle);
        for (const q of payload.plants)
            if (q.n)
                q.n = commonName(ab, q.s);
        const url = `${location.origin}${location.pathname}#/share/${await encodeShare(payload)}`;
        urlEl.hidden = false;
        urlEl.textContent = url;
        msg.textContent = `The plan travels in the link itself - ${url.length} characters, nothing stored anywhere. It is a snapshot: later edits don't change it.`;
        const nav = navigator;
        if (nav.canShare?.({ url })) {
            try {
                await nav.share({ title: "My garden plan", url });
                return;
            }
            catch { /* cancelled or unsupported mid-flight - the box above already shows the link */ }
        }
        try {
            await navigator.clipboard.writeText(url);
            toast("Link copied - the plan travels inside it");
        }
        catch { /* no clipboard either - the visible box is the fallback of last resort */ }
    };
    // The button TOGGLES and the box carries its own × (walk round 5: the opened box had no way
    // closed). A second tap on Share while the box shows simply puts it away.
    $("sharebtn").addEventListener("click", () => {
        const box = $("sharebox");
        if (!box.hidden) {
            box.hidden = true;
            return;
        }
        void shareCurrentPlan();
    });
    $("shareclose").addEventListener("click", () => { $("sharebox").hidden = true; });
    const draw = () => {
        const hasLog = app.logSnapshot.seasons.length > 0;
        const located = num("lat") != null && num("lon") != null;
        // O38: any located render is a location signal - prime the ZIP/frost tables (idempotent). This
        // is the catch-all covering a returning user's post-hydration draw and every geocoded pin; a
        // cold, location-less visitor never reaches this branch and fetches none of the 439 KB.
        if (located)
            app.ensureZipData?.(num("lat"), num("lon"));
        // Any real garden (a set location or a season log) means this device has started planning, so
        // the landing (D-027) is skipped from the next visit on - even if the CTA was never clicked.
        if (hasLog || located)
            markStarted();
        // D-029: the example-garden banner shows only while the disposable demo garden is active.
        const exBanner = document.getElementById("examplebanner");
        if (exBanner)
            exBanner.hidden = !isExamplePlot(app.currentPlotId);
        $("candrow").hidden = app.logSnapshot.beds.length === 0;
        // O58 Phase 4 (slice C): the coaching band fills the Where step until a location exists; draw()
        // re-fires on every location change, so it self-hides the instant an address is picked.
        coachBand(document.getElementById("coach-where"), COACH_HEADING, COACH_WHERE, !located);
        const { site, source } = siteFromForm();
        // D-102: "What grew here recently" is only for a NEW bed, before anything is planted - it's how
        // the user warns us about previous occupants. Once the bed is tracked (real logged plantings on
        // its ground), that history persists in the log and travels forward on its own, so the manual
        // section is hidden to reclaim the space. Declaring here PERSISTS as ground occupancy (year − 1).
        const declaring = source.kind === "derived" && !source.tracked;
        // Walk round 4 (maintainer): "what grew here recently" is ledger-shaped history input feeding
        // rotation - an ACCOUNT feature. A brand-new signed-out planner keeps the simple flow (bed →
        // teams); the declaration unlocks with the account whose steering it feeds.
        $("sec-eligibility").hidden = !declaring || !isSignedIn();
        if (declaring) {
            $("famhint").textContent =
                `Tick what grew here in the last season or two - we'll flag anything you shouldn't replant yet. Once you plant this bed, its history tracks itself.`;
            // reflect the persisted seed in the checkboxes (they are its editor); history reads the seed,
            // not the boxes, so this is purely visual and can't fight an in-flight toggle.
            const bed = app.logSnapshot.beds.find((b) => b.name === $("candbed").value);
            const seedKey = bed ? JSON.stringify(bed.region) : null;
            const seed = seedKey ? app.logSnapshot.priorOccupancy.find((s) => JSON.stringify(s.region) === seedKey) : undefined;
            const fams = new Set(seed?.families ?? []);
            for (const cb of document.querySelectorAll("#families input.fam"))
                cb.checked = fams.has(cb.value);
        }
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle) : null;
        // Zone resolves nationwide (D-051), independent of the station-based frost panel, so a located
        // user far from a bundled site still sees their hardiness zone.
        const zone = site.lat != null && site.lon != null ? resolveZone(site.lat, site.lon, bundle) : null;
        // "This ground's climate" is now ONE card: the frost-risk curve (D-042) and daylength (D-038) that
        // used to stack as separate blocks fold into its "how we know" disclosure - same read-only data, no
        // engine input (D-008/D-039). renderClimate owns all three quantities (frost, zone, daylength).
        // R-093 supersede reaches the Where card too (D-122): once this plot's logged frosts calibrate,
        // the card leads with the observed dates - the same numbers the calendar plans by (D-114).
        const fcal = clim ? frostCalibration(app.logSnapshot.seasons, clim.site) : null;
        renderClimate(clim, zone, site.lat ?? null, fcal);
        // Phase D display panel (D-041): the user's land-grant extension office, from bundled data.
        // Read-only, never an engine input (D-008); state is a correctable guess from the location.
        renderExtension(site);
        // D-148 P0 + P1b: what the gardener has told us about this ground, precisely what that does and
        // does not buy, and - once a pH has been MEASURED - what R-099 says about the plants standing in
        // it. Tiers 0-2 still gate nothing; a measured pH is the one thing that changes that.
        //
        // The plantings are passed RESOLVED (cultivar group overlaid), because ph_range can be overridden
        // per group like any other species field, and the gate must read the group the gardener actually
        // planted rather than the bare species.
        const openSeason = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
        const soilPlantings = (openSeason?.plantings ?? [])
            // Still in the ground: a plant pulled in June is not evidence about this bed's pH today.
            .filter((p) => !p.end_date)
            .map((p) => {
            const resolved = resolveSpecies(p.species, p.cultivar_group ?? null, activeBundle(bundle));
            // The COMMON name, not the humanized id: `humanize("fragaria_x_ananassa")` renders a latin
            // binomial as "Fragaria X Ananassa", which is exactly the leak the species-card scenario
            // forbids elsewhere. Fall back to the id only if a species carries no common name at all.
            const common = resolved.common?.[0];
            return {
                label: titleCase(common ?? humanize(p.species)),
                region: p.region,
                resolved,
                species: p.species, // O46: kept, so the soil card's pH cautions can link the plant
            };
        });
        renderSoil(app.currentPlotId, app.soilObservations, site.lat ?? null, site.lon ?? null, 
        // Per-bed soil: each bed carries its declared structure (D-141), which decides whether the card
        // asks what the ground is MADE of or what the bed is FILLED with.
        app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })), soilPlantings);
        // The Log's own soil section (maintainer): the counterpart of "This ground's weather". Read-only
        // and routing - the card above is the single place soil is RECORDED, because it is the one that
        // knows each bed's structure. Both surfaces read groundRows(), so they cannot disagree.
        renderSoilSummary(app.currentPlotId, app.soilObservations, app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })));
        // Fold the user's added varieties into the species set so they appear in eligibility and derive
        // history like any species (they cannot fill guild roles unless they satisfy a role predicate).
        renderEligibility(activeBundle(bundle), site, source);
        // R-093: compare logged (or seeded synthetic) frosts against the resolved climatology. Demo
        // seasons are regenerated from the current site each draw, so they follow the pin.
        const synth = app.syntheticOn && clim ? makeSyntheticSeasons(clim.site) : [];
        renderFrost(clim?.site ?? null, [...app.logSnapshot.seasons, ...synth], app.syntheticOn);
        // The earn-strip reads REAL seasons only - a LIVE standing earned by demo data would lie.
        renderEarned(clim?.site ?? null, app.logSnapshot.seasons, app.currentPlotId);
        // The Account ledger ring (P2.3 slice 2): the same frost standing as the earn-strip's frost row,
        // drawn as a conic dial. REAL seasons only, same reason. The dial's arc is a CSS custom property
        // so the render is three assignments; ledgerring.ts owns the numbers and the text.
        renderLedgerRing(clim?.site ?? null, app.logSnapshot.seasons);
        // O28: the Account page's inventory of every fact held. Same rule as the earn-strip - REAL
        // seasons only, because a panel whose whole claim is "this is what we actually hold" cannot
        // count the demo's synthetic ones.
        renderGardenKnows(clim?.site ?? null, site.lat ?? null, site.lon ?? null, zone?.label ?? (zone?.zone != null ? String(zone.zone) : null));
        renderSolar(bundle, site);
        renderGuilds(bundle, site);
        // Phase F (D-053): the configurable open-membership guild - compose a bed from any species and
        // the engine runs the corpus over it (conflicts, placement, footprint, complete-a-guild).
        renderMyBed(activeBundle(bundle), site);
        // ISSUES #11 slice 2: the season track surface (glance + log frost/heat + end a planting), in-place
        // on Plan. Hides itself until there's a season or saved ground.
        renderSeason(activeBundle(bundle));
        renderCalendar(activeBundle(bundle)); // user varieties must schedule like corpus plants (their DTM etc.)
        // O27: the ask card (Log top + Plan-sheet mirror) recomputes with every draw - it reads the
        // same snapshot/resolvers as the surfaces above, so it can never disagree with them.
        renderAskCards(activeBundle(bundle));
        // The state-aware home (2026-08-01): the landing's second state, composed from the SAME ask,
        // the same calendar tasks and the same snapshot as the surfaces above - so a gardener who lands
        // on it and then walks into Plan meets one story, not two. Renders nothing without ground.
        markHomeworthy(renderHomeNow(activeBundle(bundle)));
        reviewRedraw();
        // the applied plan, projected onto ground BEFORE the map redraw picks it up - the map's
        // hollow "planned" dots beside the filled occupancy dots (walkthrough round 5)
        app.planDots = appliedPlanDots(activeBundle(bundle), site);
        app.groundRedraw?.();
        // D-023 handoff, two lives. It's the END-of-plan step, so it waits until the ground is real: a
        // SAVED bed/area (D-072 review), not merely a guild fitting a typed size mid-planning. Signed out:
        // invite the signup. Signed in: when this garden's ledger has no seasons yet (a freshly saved
        // garden), point at the Log instead. A garden with seasons needs no banner. It renders at the very
        // bottom of the Plan page, after the results - never in the middle of the planning block.
        const planReady = app.logSnapshot.beds.length > 0;
        const handoff = $("handoff");
        const line = handoff.querySelector("p");
        const go = $("handoffgo");
        if (planReady && backendConfigured() && !isSignedIn()) {
            line.innerHTML = "<strong>Your plan is taking shape.</strong> A free account turns it into a working season: the Calendar becomes your dated to-do list, and the Log starts learning your ground - what grew where, and your real frost dates.";
            go.textContent = "Create your free account";
            handoff.hidden = false;
        }
        else if (planReady && isSignedIn() && app.logSnapshot.seasons.length === 0) {
            line.innerHTML = "<strong>This garden's plan is taking shape - start its ledger.</strong> Open the Log, start the season, and log what you plant (or what's already growing); the Calendar dates and next year's rotation warnings grow from there.";
            go.textContent = "Open the Log";
            handoff.hidden = false;
        }
        else {
            handoff.hidden = true;
        }
        // D-079 slice 3: fold each step to a truthful one-line summary of where the plan stands.
        updateStepStates({
            located,
            zoneLabel: zone ? (zone.label ?? String(zone.zone ?? "")) || null : null,
            areaCount: app.logSnapshot.beds.length,
            myBedCount: myBedMemberCount(),
            frostP50: (() => {
                const lf = clim?.site.last_frost_32f?.p50;
                if (!lf)
                    return null;
                const [mm, dd] = lf.split("-").map(Number);
                const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return `${MON[(mm ?? 1) - 1]} ${dd}`;
            })(),
            seasonDays: clim?.site.growing_season_days_p50 ?? null,
        });
        // Earned planner phase A: the lock pitch reads the device's known facts (the located draft's
        // real frost date), and those facts land through this draw - so the gate re-renders here,
        // not just at boot/auth-change when the location fields are still empty.
        applyAuthGate();
        // Phase B: the dimension row's unit label follows the units preference, and the trace-it
        // upgrade card shows while a non-container SIZED bed exists - the flag drops on a map
        // re-save, so answering the invitation retires it (and a balcony of containers never sees
        // a yard assumption, personas finding 2).
        const du = document.getElementById("dimunit");
        if (du)
            du.textContent = lengthUnit();
        const up = document.getElementById("traceupgrade");
        if (up)
            up.hidden = !app.logSnapshot.beds.some((b) => b.sized && b.structure !== "container");
        // Declutter round: soil describes GROUND, so its card (and the extension office riding it)
        // appears once a bed exists - the journey creates the need before the form appears.
        const sz = document.getElementById("soilzone");
        if (sz)
            sz.hidden = app.logSnapshot.beds.length === 0;
    };
    // Move-garden discoverability (walkthrough follow-up): a re-search that lands FAR from the
    // current garden's anchor is exactly the "my anchor is wrong / I've moved" moment the map's
    // own Move-garden button waits for - but that button lives on the map, where nobody is
    // looking while typing an address. Surface the same deliberate move HERE, in the card where
    // the search landed. Far = beyond 250 m: past any same-yard fine-tune, where the garden has
    // left the map frame. Only offered while beds exist - an EMPTY plot re-anchors itself the
    // next time the map opens (D-022), so there is nothing to move and nothing to lose.
    // The Where-card "Move garden here" MIRROR is gone (walk round 2): the real control lives on
    // the map (#reanchor, groundmap.ts), where the pin the user is judging actually is.
    // ZIP and Plus Code fields are PARKED (declutter round, approved 2026-07-30): Where is address
    // + pin only. The engine keeps zipToLatLon (the answers ladder's rung 1 runs on it) and the
    // Plus Code decoder (D-133) for the revisit the maintainer noted. The ladder's carry hands its
    // resolved coordinates straight to setLocation below - no field to type into, nothing re-asked.
    const setLocation = (lat, lon, said) => {
        $("lat").value = String(lat);
        $("lon").value = String(lon);
        if (said)
            $("ziphint").textContent = said;
        draw(); // draw() primes the ZIP/frost tables when located (O38)
    };
    // THE WHERE-STEP LOCATION MAP (D-181). While Where is the open step AND a Google key is configured,
    // the real Google map is the location surface; every other step, and every keyless build, keeps the
    // custom canvas untouched (D-078). Dragging its pin or tapping a spot is the same act as tapping the
    // custom canvas: it writes the visible lat/lon through setLocation, and the anchor/local-metre model
    // is unchanged. Driven off `body.locating`, which sheet.ts sets from the Where step's open state.
    const syncWhereMap = () => {
        if (!document.body.classList.contains("locating")) {
            gmapShow(false);
            return;
        }
        void ensureWhereMap(num("lat"), num("lon"), (lat, lon) => setLocation(lat, lon, "Pin moved - your dates and plant teams follow it."));
    };
    window.addEventListener("gg-step-changed", syncWhereMap);
    // ...and run it once NOW. On boot the Where step is already open and the key can already have
    // landed, so the step-changed event that would have triggered this has often fired before this
    // listener existed - waiting for the next one left the map dark on exactly the first visit that
    // needs it. (Caught by the D-181 scenario: the loader was never requested at all.)
    syncWhereMap();
    // Address → lat/lon, two geocoders (D-022, twice amended). PRIMARY: the US Census geocoder
    // via its documented JSONP callback - the legitimate route around its missing CORS headers -
    // because it INTERPOLATES house numbers along streets, pinning the actual house even where
    // OpenStreetMap has no house-number data (live finding: OSM silently falls back to the
    // street centroid and drops the number). FALLBACK: Nominatim, global - and when its best
    // match lacks the house number that was asked for, the app SAYS so and points at the
    // fine-tune tools instead of pretending.
    // Census house-level lookup via JSONP (contract PROVEN live: the callback fires - a
    // "found no match" hint reached the maintainer). Census's weak spot is its ONE-LINE address
    // parser, so when the input has commas the STRUCTURED endpoint (street/city/state/zip as
    // separate fields) runs in parallel - it frequently matches where one-line fails. The hint
    // still reports why the whole stage fell back: "didn't answer" vs "found no match".
    let censusFailWhy = "";
    const censusAttempt = (endpoint, params) => new Promise((resolve) => {
        const cb = "__ggCensus" + Math.floor(Math.random() * 1e9);
        const script = document.createElement("script");
        const w = window;
        const done = (v) => {
            clearTimeout(timer);
            delete w[cb];
            script.remove();
            resolve(v);
        };
        const timer = setTimeout(() => done(null), 3500);
        w[cb] = (body) => {
            const m = body.result?.addressMatches?.[0];
            done(m ? { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress } : "no-match");
        };
        script.onerror = () => done(null);
        script.src = "https://geocoding.geo.census.gov/geocoder/locations/" + endpoint +
            "?benchmark=Public_AR_Current&format=jsonp&callback=" + cb + "&" + params;
        document.head.appendChild(script);
    });
    const censusGeocode = async (q) => {
        const attempts = [censusAttempt("onelineaddress", "address=" + encodeURIComponent(q))];
        const parts = q.split(",").map((t) => t.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const rest = parts.slice(2).join(" ");
            const zip = /\b\d{5}\b/.exec(rest)?.[0];
            const state = rest.replace(/\b\d{5}(-\d+)?\b/, "").trim();
            let p = "street=" + encodeURIComponent(parts[0]) + "&city=" + encodeURIComponent(parts[1]);
            if (state)
                p += "&state=" + encodeURIComponent(state);
            if (zip)
                p += "&zip=" + zip;
            attempts.push(censusAttempt("address", p));
        }
        const results = await Promise.all(attempts);
        const hit = results.find((r) => r !== null && r !== "no-match");
        if (hit)
            return hit;
        censusFailWhy = results.some((r) => r === "no-match")
            ? `house-number service found no match${attempts.length > 1 ? " (one-line and structured forms both tried)" : ""}`
            : "house-number service didn't answer";
        return null;
    };
    // Google geocoding via the Maps JavaScript API's client-side Geocoder (D-034, revising D-031's
    // web-service call). The Geocoding WEB SERVICE (maps.googleapis.com/maps/api/geocode/json) rejects
    // HTTP-referrer-restricted keys by design - "API keys with referer restrictions cannot be used
    // with this API" - so a plain fetch can't use our origin-locked key (live finding, surfaced by the
    // googleFailWhy diagnostic). The JS API's Geocoder is the browser-side product and DOES honour
    // referrer restrictions, so the key stays locked to the Pages origin. Google's JS is loaded LAZILY,
    // only when an address is actually looked up (never for users who don't type one), and any load or
    // geocode failure falls through to the keyless chain (Census → OSM → ZIP →). Still an input aid:
    // it fills the visible, overridable lat/lon; the engine never sees Google's objects (D-008).
    // The Maps JS loader moved to maps.ts (D-181): the Geocoder, the Places typeahead and the
    // Where-step map all need it, and Google's loader must run exactly ONCE per page - a second script
    // tag errors and can clobber the first library's objects. maps.ts owns the memoised promise and
    // requests every library the three consumers need (places, marker) on the one load.
    let googleFailWhy = "";
    const googleGeocode = async (q) => {
        googleFailWhy = "";
        const key = mapsApiKey();
        if (!key)
            return null; // Google not configured - silently skipped, keyless chain as before
        if (!(await loadMapsJs())) {
            googleFailWhy = "Google Maps didn’t load";
            return null;
        }
        try {
            const geocoder = new window.google.maps.Geocoder();
            // componentRestrictions country US (D-178): keep Google's match inside the US, same as Nominatim
            // and Census - the list must not surface a same-named place abroad.
            const { results } = await geocoder.geocode({ address: q, componentRestrictions: { country: "US" } });
            const r = results?.[0];
            if (r) {
                const lt = r.geometry.location_type;
                return {
                    lat: r.geometry.location.lat(), lon: r.geometry.location.lng(),
                    label: r.formatted_address,
                    exact: lt === "ROOFTOP" || lt === "RANGE_INTERPOLATED",
                };
            }
            googleFailWhy = "Google: no result";
        }
        catch (e) {
            // the Geocoder promise rejects on non-OK status (ZERO_RESULTS, REQUEST_DENIED, …) - name it.
            const code = e.code;
            const msg = e.message;
            googleFailWhy = "Google: " + (code || msg || "geocode failed").slice(0, 120);
        }
        return null;
    };
    // Google Places Autocomplete (D-178, Uber-style rebuild): ranked per-pause predictions, active ONLY
    // when a Google key is configured (the key is the opt-in, same gate as the Geocoder/tiles). Keyless
    // deploys (fork/dev/CI/no maps.json) fall to the keyless chain below and send nothing to Google.
    // Predictions carry no coordinates; lat/lng is fetched (place.fetchFields) only when a row is
    // TAPPED, and the session token bills type-then-pick as one session. Any failure sets placesDead and
    // the field falls back to the keyless chain - never a dead end. Restricted to the US (D-178).
    let placesLib = null;
    let placesToken = null;
    let placesDead = false;
    // WHY the field is on the path it is on - surfaced in the hint line (D-178). The whole address arc
    // was debugged blind because a silent fallback looks identical to a broken feature: the maintainer
    // reported "typeahead not working" and nothing on screen said whether Places had loaded, been
    // denied, or never been asked. It says so now, in the same spirit as googleFailWhy/censusFailWhy.
    let placesWhy = "";
    const loadPlaces = async () => {
        if (placesDead)
            return false;
        if (placesLib?.AutocompleteSuggestion)
            return true;
        const key = mapsApiKey();
        if (!key) {
            placesWhy = "no Google key - keyless address search";
            return false;
        }
        if (!(await loadMapsJs())) {
            placesDead = true;
            placesWhy = "Google Maps JS did not load";
            return false;
        }
        try {
            const maps = window.google.maps;
            placesLib = maps.places?.AutocompleteSuggestion ? maps.places
                : maps.importLibrary ? await maps.importLibrary("places") : null;
            if (!placesLib?.AutocompleteSuggestion) {
                placesDead = true;
                // The commonest real cause: the key lacks "Places API (New)", or the Maps JS release served
                // has no AutocompleteSuggestion. Name it instead of silently degrading.
                placesWhy = "Places library loaded but AutocompleteSuggestion is missing (enable 'Places API (New)' on the key)";
                return false;
            }
            placesWhy = "";
            return true;
        }
        catch (e) {
            placesDead = true;
            placesWhy = "Places failed to load: " + String(e?.message ?? e).slice(0, 80);
            return false;
        }
    };
    const newPlacesSession = () => {
        const T = placesLib?.AutocompleteSessionToken;
        placesToken = T ? new T() : null;
    };
    // null return = Places unavailable (keyless or failed) → caller uses the keyless chain. Each pick
    // carries an AddrCandidate-shaped row plus the live prediction, so a tap can fetch its coordinates.
    const placesSuggest = async (q) => {
        if (!(await loadPlaces()))
            return null;
        try {
            if (!placesToken)
                newPlacesSession();
            const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: q, sessionToken: placesToken ?? undefined,
                includedRegionCodes: ["us"], // US-only, matching the keyless geocoders (D-178)
            });
            const out = [];
            for (const s of suggestions || []) {
                const p = s.placePrediction;
                if (!p)
                    continue;
                const primary = p.mainText?.text ?? p.text?.text ?? "";
                if (!primary)
                    continue;
                out.push({ lat: NaN, lon: NaN, label: [primary, p.secondaryText?.text].filter(Boolean).join(", "),
                    primary, secondary: p.secondaryText?.text ?? "", exact: true, us: true, pred: p });
            }
            return out.slice(0, 5);
        }
        catch (e) {
            placesDead = true;
            // A rejected request is usually the key: referrer not allowed, Places not enabled, or quota.
            placesWhy = "Places request failed: " + String(e?.message ?? e).slice(0, 80);
            return null;
        }
    };
    // human names for the ground map's planting dots (D-079 slice 6) - user species included
    app.speciesName = (sid) => commonName(activeBundle(bundle), sid);
    // R-006 (bed reach): hand the bundle-free ground map a short nudge to show while a bed is being
    // sized. The THRESHOLD is the corpus rule's, never hardcoded (D-099); the map copy is a glanceable
    // paraphrase - the full claim/remedy/mechanism stay authoritative in the corpus for the rules view.
    // No rule code and no in the string: it's user-facing, and the chip's own styling carries the icon.
    {
        const r006 = bundle.rules.find((x) => x.id === "R-006");
        const thresholdM = (r006?.trigger?.threshold_cm ?? 120) / 100;
        app.bedReachNote = (minSpanM) => minSpanM > thresholdM + 1e-9
            ? "Too wide to reach across the middle - split it into two beds with a path between."
            : null;
    }
    // R-098 (D-141): a bed declared a `container` that runs past the largest typical container size gets
    // an ADVISORY - it's probably a raised or in-ground bed. Threshold is the corpus param, never
    // hardcoded; non-blocking (the bed still saves). No rule code in the user-facing string.
    {
        const r098 = bundle.rules.find((x) => x.id === "R-098");
        const maxSpanM = (r098?.params?.container_max_span_cm ?? 75) / 100;
        app.bedContainerNote = (spanM) => spanM > maxSpanM + 1e-9
            ? `That is larger than a typical container (about ${Math.round(maxSpanM * 100)} cm across, a half-barrel). A raised or in-ground bed may fit it better.`
            : null;
    }
    // D-141 / R-098 (maintainer): editing a bed's STRUCTURE must respect what is planted in it - a
    // Three Sisters (mounds you walk between) can't become a raised bed, a fruit tree can't leave the
    // ground. This is the same structure gate the guild browser uses (guildStatus), keyed to the bed's
    // guild: exact from the open season's DRAFT plan entry, else recovered for a PLANTED bed by matching
    // its species against a structure-constrained guild. The ground map (bundle-free) calls this to grey
    // the illegal options and to refuse an illegal save. Empty list = no constraint (a plain mixed bed).
    {
        const STRUCTS = ["raised", "in_ground", "container", "field"];
        // The species a guild can plant - its roles' canonical/alternatives - so a planted bed (whose draft
        // plan entry was cleared on planting) can still be traced back to the guild that shaped it.
        const guildSpecies = (g) => {
            const out = new Set();
            for (const r of g.roles ?? []) {
                if (r.canonical)
                    out.add(r.canonical);
                if (r.substitute)
                    out.add(r.substitute);
                if (r.alternative)
                    out.add(r.alternative);
                for (const a of r.alternatives ?? [])
                    out.add(typeof a === "string" ? a : a.species);
            }
            for (const m of g.members ?? [])
                if (m.species)
                    out.add(m.species);
            return out;
        };
        // Only guilds that actually constrain structure (a mound or a fruit tree) can forbid anything - so a
        // normal mixed bed never matches. Of those, the tightest superset of the bed's species wins.
        const constrained = bundle.guilds.filter((g) => STRUCTS.some((s) => !guildStatus(g, null, null, bundle, s).fits));
        const matchBySpecies = (sp) => {
            let best = null, bestSize = Infinity;
            for (const g of constrained) {
                const gs = guildSpecies(g);
                if (![...sp].every((s) => gs.has(s)))
                    continue; // every planted species must belong to the guild
                if (gs.size < bestSize) {
                    best = g;
                    bestSize = gs.size;
                }
            }
            return best;
        };
        app.bedStructureBlockers = (bedName) => {
            const empty = { blocked: [], reason: () => null };
            const open = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
            let guild = null;
            const entry = open?.plan?.find((e) => e.area === bedName);
            if (entry?.guild)
                guild = bundle.guilds.find((g) => g.id === entry.guild) ?? null;
            if (!guild && open) {
                const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
                if (bed) {
                    const sp = new Set((open.plantings ?? [])
                        .filter((pl) => !pl.carried_over && plantingOnBed(pl.region, bed.region))
                        .map((pl) => pl.species));
                    if (sp.size)
                        guild = matchBySpecies(sp);
                }
            }
            if (!guild)
                return empty;
            const reasons = new Map();
            for (const s of STRUCTS) {
                const st = guildStatus(guild, null, null, bundle, s);
                if (!st.fits && st.reason)
                    reasons.set(s, st.reason.text);
            }
            return { blocked: [...reasons.keys()], reason: (s) => reasons.get(s) ?? null };
        };
    }
    // The map asks this to know a planned bed's team reserves no walkway (mound teams step
    // between hills, R-098) - app.ts holds the bundle, the map holds the pixels.
    app.guildIsHills = (guildId) => {
        const g = bundle.guilds.find((x) => x.id === guildId);
        return !!g && laysOutAsHills(g);
    };
    // A4 (award-benchmark amendments): the map's rotation tint - seasons since this ground last
    // held a recorded crop, from the SAME derivation the Plan's history reads (deriveHistory over
    // prior seasons + declared pre-tracking occupancy), so the two surfaces cannot disagree. The
    // map is bundle-free, so the bundle-holding side supplies it (the bedReachNote pattern).
    app.bedRotationSeasons = (region) => {
        try {
            const prior = app.logSnapshot.seasons.filter((s) => s.id !== app.logSnapshot.seasonId);
            const derived = deriveHistory(region, prior, activeBundle(bundle));
            const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, region);
            const years = Object.keys(merged.history).map(Number).filter(Number.isFinite);
            if (!years.length)
                return null;
            const now = app.logSnapshot.seasonId ?? new Date().getFullYear();
            return Math.max(0, now - Math.max(...years));
        }
        catch {
            return null;
        }
    };
    app.setLocation = (lat, lon, said) => {
        $("lat").value = String(lat);
        $("lon").value = String(lon);
        $("ziphint").textContent = said ?? `location set from the map centre: ${lat}, ${lon}.`;
        draw();
    };
    // Address suggestions (walk round 2; sharpened D-175): type, PAUSE, and tappable candidates
    // appear - no Find button. Still a debounced SEARCH against the same three geocoders (Google when
    // keyed, the Census house-number service, OpenStreetMap) - never per-keystroke autocomplete, which
    // Nominatim's usage policy forbids and which would need a paid places API. D-175 fixed the two
    // clunk reports without a new dependency: near-duplicate rows for the SAME place (a street centroid,
    // a locality) COLLAPSE into the house-level hit; and each row renders as two lines (street over
    // city/region), the shape of a real autocomplete. (The geocoders ran concurrently under D-175; the
    // M6 security review made them SERIAL - one provider per lookup - so the address is not broadcast to
    // all three at once; see searchCandidates. Latency stays one provider in the common case.) Enter searches
    // immediately; tapping a row commits it. (This also buries the walk's "Find didn't work" bug: the
    // old success path cleared the PARKED #zip field and threw AFTER a successful geocode.)
    const applyAddr = (lat, lon, label) => {
        $("lat").value = String(Math.round(lat * 1e5) / 1e5);
        $("lon").value = String(Math.round(lon * 1e5) / 1e5);
        $("ziphint").textContent = label;
        $("addrlist").replaceChildren();
        // The pin is placed - the user's next job is to check and drag it (D-177). Close the keyboard and
        // hand the map its room back: blur the field (the focusin lift is what shrank the map), then ask
        // the sheet to drop to its default stop so the map is big and the pin is interactive. The drop is
        // dispatched AFTER draw() on the next frame - draw() reflows the sheet (the located receipt
        // appears) and that reflow's scroll would otherwise trip the adaptive lift straight back to max.
        $("addr").blur();
        draw();
        app.groundCenterOn?.(lat, lon); // the map visibly goes THERE, even if the frame anchors elsewhere
        setWhereMapCenter(lat, lon); // ...and so does the Google location map, when it is the surface (D-181)
        requestAnimationFrame(() => window.dispatchEvent(new Event("gg-sheet-map")));
        // ...and the drawer must actually SHOW its content afterwards. The commit SHRINKS the drawer's
        // content in the same beat (the coach band retires, the suggestion overlay clears, the receipt
        // re-renders) while the keyboard is closing. If the body's scrollTop is left past the new end,
        // iOS renders the drawer's own background under the step row - the blank area - because iOS
        // Safari does NOT re-clamp an out-of-range scrollTop when content shrinks; Chromium does, in
        // the same frame, which is why this has never been reproducible headlessly (probed 2026-08-15:
        // on the real commit path the drawer sat at scrollTop 723 while the commit shrank the
        // scrollable max to 287 - Chromium held the overshoot for ZERO frames; iOS would sit 436px past
        // the end until a user scroll forces the clamp, which is exactly "scrolling fixes it").
        settleSheetAfterCommit();
    };
    // Put the drawer back to its top after a commit, and HOLD it there through the reflows.
    //
    // HISTORY, so this is never deleted on a half-truth again (O85, 2026-08-15): this mechanism was
    // removed the morning D-185 was confirmed, on the reasoning that its justifying diagnosis - "the
    // blank band is the drawer's scroll position" - had been overturned by D-185's shell-resize probe.
    // That reasoning conflated TWO bugs that produce one look. D-185's band was the SHELL RESIZE gap
    // (fixed in sheet.ts, stays fixed). THIS is the iOS scrollTop stranding (D-183/D-184's own
    // mechanism paragraphs, which were correct all along), and the build the maintainer confirmed
    // good on device still carried this code. Hours after the removal deployed, the maintainer
    // reported the exact D-183 symptom back - "the text displays briefly then moves down out of
    // view, scrolling fixes it", intermittent because it only bites when the drawer was scrolled
    // past the post-commit content height. An accidental on-device A/B: removal in, bug back;
    // machinery in, bug gone. Restored verbatim. Do not remove without an on-device test of THIS
    // symptom (it cannot fail headlessly - scenario 96's D-184 note records the three vacuous
    // attempts).
    //
    // WHY A BOUNDED OBSERVER, NOT ONE CORRECTION (D-184): the commit reflows the drawer MORE THAN
    // ONCE - the synchronous draw() first, then again when the async climate/frost work lands (O38's
    // ensureZipData) and the receipt re-renders shorter. A single correction goes stale one reflow
    // later. So: re-assert for a bounded window, on every subtree mutation and on gg-sheet-settled
    // (geometry at rest), ending early the moment the user touches the drawer - their scroll is the
    // one that must win.
    //
    // WHY TOP, NOT A CLAMP: clamping needs scrollHeight measured at exactly the right instant, and
    // the whole problem is that the content keeps changing underneath. `scrollTop = 0` is valid at
    // every size, and it is where the drawer should be after an address commits anyway: the step
    // read from its top - heading, address, then the receipt the commit just earned.
    let settleTimer = 0;
    let settleObs = null;
    const settleSheetAfterCommit = () => {
        const sb = document.getElementById("sheetbody");
        if (!sb)
            return;
        const toTop = () => { if (sb.scrollTop !== 0)
            sb.scrollTop = 0; };
        const stop = () => {
            clearTimeout(settleTimer);
            settleObs?.disconnect();
            settleObs = null;
            window.removeEventListener("gg-sheet-settled", toTop);
            for (const ev of ["pointerdown", "wheel", "touchstart"])
                sb.removeEventListener(ev, stop);
        };
        stop(); // a second commit supersedes the first - never stack observers
        toTop();
        window.addEventListener("gg-sheet-settled", toTop);
        settleObs = new MutationObserver(toTop);
        settleObs.observe(sb, { childList: true, subtree: true, characterData: true });
        // the user taking over ends it immediately; otherwise it lapses on its own
        for (const ev of ["pointerdown", "wheel", "touchstart"])
            sb.addEventListener(ev, stop, { passive: true, once: true });
        settleTimer = window.setTimeout(stop, 2500); // long enough to outlast the async climate reflow
    };
    // Split a one-line address into the street line and the city/region rest - the two-line row shape.
    const splitLabel = (label) => {
        const i = label.indexOf(",");
        return i < 0 ? { primary: label.trim(), secondary: "" }
            : { primary: label.slice(0, i).trim(), secondary: label.slice(i + 1).trim() };
    };
    // ~150 m apart, flat-earth (fine at this scale): the test for "the same place at coarser detail".
    const near = (a, b) => {
        const dLat = (a.lat - b.lat) * 111_000;
        const dLon = (a.lon - b.lon) * 111_000 * Math.cos(a.lat * Math.PI / 180);
        return Math.hypot(dLat, dLon) < 150;
    };
    const searchCandidates = async (q) => {
        const askedHouse = /^\s*\d+\s/.test(q);
        // Per-provider candidate builders. Each returns [] on a miss or failure so the next stage runs.
        const fromGoogle = async () => {
            const g = await googleGeocode(q);
            return g ? [{ lat: g.lat, lon: g.lon, label: g.label, ...splitLabel(g.label), exact: g.exact,
                    us: /\bUSA\b/.test(g.label), note: g.exact ? undefined : "approximate" }] : [];
        };
        const fromCensus = async () => {
            const us = await censusGeocode(q); // Census is US-only, house-level
            return us ? [{ lat: us.lat, lon: us.lon, label: us.label, ...splitLabel(us.label), exact: true, us: true }] : [];
        };
        const fromNominatim = async () => {
            try {
                // countrycodes=us (D-178): this is a US garden planner - RESTRICT OpenStreetMap to the US so
                // a same-named street abroad never appears. Census is US-only already; Google is restricted below.
                const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=us&q=" + encodeURIComponent(q);
                const body = await (await fetch(url, { headers: { "Accept": "application/json" } })).json();
                return body.map((m) => {
                    const label = m.display_name.slice(0, 90);
                    const hasHouse = !!m.address?.house_number;
                    return { lat: parseFloat(m.lat), lon: parseFloat(m.lon), label, ...splitLabel(label),
                        exact: hasHouse, us: m.address?.country_code === "us",
                        note: askedHouse && !hasHouse ? "street, not the house - drag the pin after" : undefined };
                });
            }
            catch {
                return []; /* unreachable service - the next stage still lists */
            }
        };
        // COLLAPSE a provider's rows: US first (a US garden planner - a house match outranks a same-named
        // street abroad), exact ahead of coarse, drop country/state-level noise (D-179: a few digits made
        // Google answer "United States - approximate", which cannot pin a garden), then drop near-dupes
        // within ~150 m of one already kept (D-177). A row worth offering names at least a place within a
        // region: two comma-separated parts minimum.
        const collapse = (raw) => {
            raw.sort((a, b) => Number(b.us) - Number(a.us) || Number(b.exact) - Number(a.exact));
            const tooCoarse = (c) => c.label.split(",").filter((p) => p.trim()).length < 2;
            const kept = [];
            for (const c of raw) {
                if (!isFinite(c.lat) || !isFinite(c.lon))
                    continue;
                if (tooCoarse(c))
                    continue;
                if (kept.some((k) => k.label === c.label || near(k, c)))
                    continue;
                kept.push(c);
            }
            return kept.slice(0, 5);
        };
        // SERIAL, not concurrent (security review M6, 2026-08-22 - supersedes D-175's Promise.all). The
        // typed address is effectively a home address; running all three geocoders at once broadcast it to
        // three organizations for a single lookup, each also logging the query with the user's IP. Now it
        // goes to ONE at a time - Google (best, when keyed) -> Census (US house-level) -> OpenStreetMap -
        // stopping at the first that yields a usable candidate, so a normal lookup reaches exactly one
        // provider. Latency in the common case is one provider (Google's Geocoder is fast); only a miss
        // escalates, and only a miss sends the address onward. The per-provider COLLAPSE still drops a
        // coarse Google answer so the search falls through to Census's house-level match rather than
        // stopping on "United States - approximate".
        for (const stage of [fromGoogle, fromCensus, fromNominatim]) {
            const kept = collapse(await stage());
            if (kept.length)
                return kept;
        }
        return [];
    };
    const applyCandidate = (c) => applyAddr(c.lat, c.lon, `Pinned: ${c.label}.${c.note ? ` (${c.note.charAt(0).toUpperCase()}${c.note.slice(1)}.)` : ""} Tap the map to move the pin if it landed off.`);
    // A tapped Places prediction resolves its coordinates now (fetchFields) and pins. The pick closes
    // the billed session, so a fresh token starts. On a details failure, fall back to a keyless text
    // geocode of the prediction rather than dead-ending (D-178).
    const applyPlacePick = async (pick) => {
        $("ziphint").textContent = "pinning " + pick.primary + "…";
        try {
            const place = pick.pred.toPlace();
            await place.fetchFields({ fields: ["location", "formattedAddress"] });
            const loc = place.location;
            if (!loc)
                throw new Error("no location on the picked place");
            applyAddr(loc.lat(), loc.lng(), `Pinned: ${place.formattedAddress || pick.label}. Tap the map to move the pin if it landed off.`);
            newPlacesSession();
        }
        catch {
            $("ziphint").textContent = "looking up the address…";
            void searchCandidates(pick.label).then((cs) => {
                if (cs[0])
                    applyCandidate(cs[0]);
                else
                    $("ziphint").textContent = "could not pin that one - add the city and state.";
            });
        }
    };
    let addrTimer = 0;
    let addrToken = 0;
    // Float the suggestion list as an overlay ANCHORED to the address field, not an in-flow block the
    // sheet clips (D-176, rev 2 after the maintainer's phone test). The earlier fix scrolled the sheet
    // to reveal the list; that shrank the clipped "black area" but the scrolling WAS the "jumping", and
    // a cramped sheet still clipped the last row. The maintainer's spec: keep the field in one spot,
    // show every option, pin smoothly. So the field never moves - the list is positioned `fixed` (which
    // escapes `#plansheet { overflow: hidden }`) in whichever band has room: DOWN from the field
    // normally, UP from it when the on-screen keyboard leaves no room below. It caps to the available
    // height (scrolling internally only if more rows than fit) and is re-placed as the field moves.
    const placeAddrList = () => {
        const list = $("addrlist");
        const addrEl = $("addr");
        if (!list.childElementCount)
            return;
        const f = addrEl.getBoundingClientRect();
        const vv = window.visualViewport;
        let viewTop = vv ? vv.offsetTop : 0;
        let viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        // NEVER COVER THE APP'S OWN FIXED CHROME (D-179, maintainer screenshot): flipped above the field
        // with the keyboard up, the overlay grew all the way to the top of the screen and sat over the
        // header (brand, menu) and the map. The visible band stops at the header's bottom edge, the same
        // measure-the-chrome rule answers.ts uses for its readable band - not the raw viewport.
        for (const el of document.querySelectorAll("header.site, header.site nav")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden")
                continue;
            if (cs.position !== "fixed" && cs.position !== "sticky")
                continue;
            const r = el.getBoundingClientRect();
            if (r.height <= 0)
                continue;
            const mid = (viewTop + viewBottom) / 2;
            if (r.top > mid)
                viewBottom = Math.min(viewBottom, r.top); // a bottom bar
            else if (r.bottom < mid)
                viewTop = Math.max(viewTop, r.bottom); // a top bar
        }
        // The anchor scrolled out of view: an overlay pinned to a field nobody can see is the "scrolled
        // and the whole page got messed up" state. Dismiss instead of leaving it stranded over the page.
        if (f.bottom < viewTop || f.top > viewBottom) {
            list.replaceChildren();
            return;
        }
        const gap = 4, margin = 8;
        const below = viewBottom - (f.bottom + gap) - margin;
        const above = (f.top - gap) - viewTop - margin;
        list.style.left = `${Math.round(f.left)}px`;
        list.style.width = `${Math.round(f.width)}px`;
        if (below >= above) { // room below (the common case): drop down
            list.style.top = `${Math.round(f.bottom + gap)}px`;
            list.style.bottom = "auto";
            list.style.maxHeight = `${Math.max(64, Math.floor(below))}px`;
        }
        else { // cramped below (keyboard up): flip above the field
            list.style.top = "auto";
            list.style.bottom = `${Math.round(window.innerHeight - (f.top - gap))}px`;
            list.style.maxHeight = `${Math.max(64, Math.floor(above))}px`;
        }
    };
    // Track the field while the list is open: the sheet can scroll and the keyboard can resize under it.
    const repositionAddrIfOpen = () => { if (($("addrlist")).childElementCount)
        placeAddrList(); };
    // Bring the field back into the sheet's visible band ONLY if it is actually out of view - the
    // corrective half of O83 (iOS autofill can scroll the sheet to a companion and leave #addr off
    // screen). Guarded, so in the normal case (field already visible) it does nothing and never moves
    // the user - the un-guarded scroll-on-every-render was the "jumping" D-176 removed. Settles two
    // frames first (a fresh autofill compose has not laid out on frame one).
    const ensureAddrVisible = () => {
        const sb = document.getElementById("sheetbody");
        const addrEl = $("addr");
        if (!sb)
            return;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const sr = sb.getBoundingClientRect(), r = addrEl.getBoundingClientRect();
            let delta = 0;
            if (r.bottom > sr.bottom - 8)
                delta = r.bottom - (sr.bottom - 8); // below the fold: pull up
            else if (r.top < sr.top + 8)
                delta = r.top - (sr.top + 8); // above the top: pull down
            if (Math.abs(delta) > 4) {
                sb.scrollBy({ top: delta, behavior: "auto" });
                repositionAddrIfOpen();
            }
        }));
    };
    document.getElementById("sheetbody")?.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.visualViewport?.addEventListener("resize", repositionAddrIfOpen);
    window.visualViewport?.addEventListener("scroll", repositionAddrIfOpen);
    // Build the two-line rows into the floating overlay - shared by the Places path and the keyless
    // chain, so both read identically. `onPick` handles the tap (fetch-then-pin for Places, direct pin
    // for a keyless candidate that already carries coordinates).
    const renderRows = (cands, onPick) => {
        const list = $("addrlist");
        list.replaceChildren();
        for (const c of cands) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "addrrow";
            const main = document.createElement("span");
            main.className = "addr-primary";
            main.textContent = c.primary || c.label;
            b.appendChild(main);
            const secText = [c.secondary, c.note].filter(Boolean).join(" — ");
            if (secText) {
                const sec = document.createElement("span");
                sec.className = "addr-secondary";
                sec.textContent = secText;
                b.appendChild(sec);
            }
            b.addEventListener("click", () => onPick(c));
            list.appendChild(b);
        }
        placeAddrList(); // float the rows anchored to the field, clear of the keyboard (D-176)
    };
    // THE KEYLESS CHAIN (fallback when no Google key, or Places is unavailable). `auto` (walk round 3):
    // an explicit submit - the keyboard's Go key - should DROP THE PIN, not present homework.
    const runAddrSearch = (auto = false) => {
        const q = $("addr").value.trim();
        const hint = $("ziphint");
        const list = $("addrlist");
        if (q.length < 5) {
            list.replaceChildren();
            return;
        }
        const token = ++addrToken;
        hint.textContent = "looking up the address…";
        void searchCandidates(q).then((cands) => {
            if (token !== addrToken)
                return; // a newer search superseded this one
            list.replaceChildren();
            if (!cands.length) {
                hint.textContent = (googleFailWhy ? googleFailWhy + "; " : "") + (censusFailWhy ? censusFailWhy + "; " : "") +
                    "no match for that address - add the city and state.";
                return;
            }
            if (auto && (cands.length === 1 || !cands[0].note)) {
                applyCandidate(cands[0]);
                return;
            }
            hint.textContent = cands.length === 1 ? "one match - tap it to set your pin:" : "tap your address:";
            renderRows(cands, applyCandidate);
        });
    };
    // THE DISPATCHER (D-178): keyed → Google Places Autocomplete typeahead; keyless (or Places
    // unavailable) → the keyless chain above. A null from placesSuggest means "not available here", so
    // the whole field falls back rather than showing nothing.
    const runAddr = (auto = false) => {
        const q = $("addr").value.trim();
        const list = $("addrlist");
        const hint = $("ziphint");
        if (!mapsApiKey()) {
            runAddrSearch(auto);
            return;
        }
        if (q.length < 3) {
            list.replaceChildren();
            return;
        }
        const token = ++addrToken;
        hint.textContent = "finding addresses…";
        void placesSuggest(q).then((picks) => {
            if (token !== addrToken)
                return; // a newer keystroke superseded this one
            if (picks === null) {
                // Places is unavailable - fall back, but SAY SO. A silent fallback is indistinguishable from
                // a broken feature, which is exactly how this went unfixed for an entire arc (D-178).
                runAddrSearch(auto);
                if (placesWhy) {
                    const why = placesWhy;
                    setTimeout(() => { hint.textContent = `${hint.textContent} [${why}]`; }, 50);
                }
                return;
            }
            if (auto && picks.length) {
                void applyPlacePick(picks[0]);
                return;
            }
            if (!picks.length) {
                list.replaceChildren();
                hint.textContent = "no matches yet - keep typing.";
                return;
            }
            hint.textContent = "tap your address:";
            renderRows(picks, (p) => void applyPlacePick(p));
        });
    };
    // Debounce is tighter for the keyed typeahead (Places is built for per-pause lookups) and looser
    // for the keyless chain (Nominatim's usage policy). mapsApiKey() is set once loadMapsConfig resolves.
    $("addr").addEventListener("input", () => {
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), mapsApiKey() ? 300 : 450);
    });
    // The form is the phone-keyboard path (walk round 3): the Go/Search key SUBMITS - keydown-Enter
    // alone is not guaranteed across mobile keyboards, which read as "hitting Find no longer works."
    $("addrform").addEventListener("submit", (e) => {
        e.preventDefault();
        if (addrTimer)
            clearTimeout(addrTimer);
        runAddr(true);
    });
    $("addr").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (addrTimer)
                clearTimeout(addrTimer);
            runAddr(true);
        }
    });
    // The autofill companions: a browser filling the street line from a saved address fills the
    // hidden city/state/ZIP siblings in the same pass - compose them into the visible field so the
    // FULL address populates (the reported "house number and street only"), then search on it.
    // Idempotent: recompose from the STREET part (before the first comma) each time, so however
    // many companion events the autofill pass fires - and in whatever order - the final value is
    // the full address, never a half-composed one that blocks the rest.
    let composeTimer = 0;
    const composeAddr = () => {
        const addrEl = $("addr");
        const street = addrEl.value.split(",")[0].trim();
        const city = $("addrcity").value.trim();
        const state = $("addrstate").value.trim();
        const zip = $("addrzip").value.trim();
        if (!street || !city)
            return;
        const full = `${street}, ${city}${state ? `, ${state}` : ""}${zip ? ` ${zip}` : ""}`;
        if (addrEl.value === full)
            return;
        addrEl.value = full;
        // O83 / D-176: an autofill pick fills the hidden companions in one burst and can leave the sheet
        // scrolled to one of them, with #addr off screen. We no longer scroll on every render (that was
        // the "jumps around"), but we DO bring #addr back if it is actually out of view - guarded, so a
        // field that is already visible never moves. The search below then re-floats the list against it.
        ensureAddrVisible();
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), 400);
    };
    for (const id of ["addrcity", "addrstate", "addrzip"]) {
        for (const evt of ["input", "change"]) {
            $(id).addEventListener(evt, () => {
                // let the whole autofill pass land before composing (fields fill in one burst)
                if (composeTimer)
                    clearTimeout(composeTimer);
                composeTimer = window.setTimeout(composeAddr, 50);
            });
        }
    }
    // The rect tool's W×L doubles as the planning bed size when no saved area is picked
    // (D-079 s5: the old Quick Plan W×L survives as the shape tool's dimension fields).
    for (const id of ["lat", "lon", "shapew", "shapel"]) {
        $(id).addEventListener("input", draw);
    }
    // the (hidden) coordinate fields are the app's location state - a write must resolve live
    for (const id of ["lat", "lon"]) {
        $(id).addEventListener("input", draw);
    }
    // D-102: ticking a family DECLARES pre-tracking history for the picked bed's ground and PERSISTS it
    // (region-keyed, anchored to "last season" = planting year − 1) so it travels forward and expires on
    // the rule's interval. Falls back to a plain redraw if there's no bed/db to attach it to.
    fams.addEventListener("change", () => {
        void (async () => {
            const bed = app.logSnapshot.beds.find((b) => b.name === $("candbed").value);
            const db = app.logDb;
            if (bed && db) {
                const checked = [...document.querySelectorAll("#families input.fam:checked")].map((cb) => cb.value);
                await setPriorOccupancy(db, app.currentPlotId, bed.region, declaredPriorYear(), checked);
                await app.logRefresh?.();
            }
            draw();
        })();
    });
    // Choosing a ground needs no W×L sync any more - guild fit and placement read the picked
    // bed's own region directly (currentBedRegion), rect, polygon, or rotated alike.
    $("candbed").addEventListener("change", draw);
    $("handoffgo").addEventListener("click", () => {
        if (isSignedIn()) {
            location.hash = "#/log";
        }
        else {
            location.hash = "#/account";
            $("acctemail").focus();
        }
    });
    onAuthChange(() => draw()); // signing in/out re-decides the handoff banner
    // The Why page renders once from the bundle and re-filters as you type - static data,
    // so it never needs to join the draw() cycle.
    renderWhy(bundle);
    // Typing in the search box always clears any deep-link focus, so search takes over.
    $("whyq").addEventListener("input", () => { setWhyFocus(null); syncWhyHash(); renderWhy(bundle); });
    // A landing "receipt" deep-links to one rule's evidence via #/why?rule=<id>. The id is URL
    // plumbing (never rendered); setWhyFocus filters the Why page to that rule WITHOUT surfacing the
    // code - the search box stays empty. The router treats the whole "#/why?..." as route "why".
    // `#/plant?id=<species>&group=<g>` - the plant card. Same shape as the Why deep link above and
    // for the same reason: the router owns the route, the page owns its query. Re-read on every
    // hashchange so tapping a different plant while already on the card re-renders in place rather
    // than needing a navigation away and back.
    const focusPlantFromHash = () => {
        if (currentRoute() !== "plant") {
            setPlantFocus(null);
            return;
        }
        setPlantFocus(plantFromHash(location.hash));
        renderPlantCard(bundle);
    };
    window.addEventListener("hashchange", focusPlantFromHash);
    focusPlantFromHash();
    // O58 Phase 3 — the `#/plan?guild=<id>` deep-link. A static guild page's "Plan this guild" CTA lands
    // here; we validate the id against the bundle and hand the Plan page the focus (or a by-name refusal
    // for a team the corpus no longer carries), then redraw so renderGuilds opens that team's card - once
    // a bed exists to place it on. The cold-load call is deferred to after endArrival() below, so the
    // opening wizard step is already chosen and the ledger has hydrated (a guild needs a bed, unlike the
    // plant card). Guarded to the plan route, exactly as focusPlant/focusWhy guard theirs.
    const applyGuildFromHash = () => {
        if (currentRoute() !== "plan") {
            setGuildFocus(null);
            return;
        }
        const want = guildFromHash(location.hash);
        if (!want) {
            setGuildFocus(null);
            return;
        }
        setGuildFocus(want, bundle.guilds.some((g) => g.id === want));
        draw();
    };
    window.addEventListener("hashchange", applyGuildFromHash);
    // O55 — the inline editor (edit anything where it lives; maintainer-only, enforced server-side
    // by the content-pr function). Owns the #/content bookmark, the pill, and the tap intercept.
    initEditor(bundle);
    const focusWhyFromHash = () => {
        if (currentRoute() !== "why") {
            setWhyFocus(null);
            setWhyBeliefFocus(null);
            return;
        }
        const m = location.hash.match(/[?&]rule=([^&]+)/);
        setWhyFocus(m ? decodeURIComponent(m[1]) : null);
        // ...and the same for a folklore claim. The 19 belief pages each carry their own URL now, and
        // `#/why?belief=B-004` is how one hands its reader back to the app already on the answer.
        const bm = location.hash.match(/[?&]belief=([^&]+)/);
        setWhyBeliefFocus(bm ? decodeURIComponent(bm[1]) : null);
        // O102 Arc B: restore the kind filter and the search term from the hash, so a shared or
        // content-page deep-link (`#/why?kind=Rotation`, `#/why?q=frost`) lands PRE-FILTERED. A focused
        // rule/belief link takes precedence and ignores these, exactly as it ignores an empty box.
        const km = location.hash.match(/[?&]kind=([^&]+)/);
        setWhyKind(!m && !bm && km ? decodeURIComponent(km[1]) : null);
        const qm = location.hash.match(/[?&]q=([^&]+)/);
        $("whyq").value = !m && !bm && qm ? decodeURIComponent(qm[1]) : "";
        renderWhy(bundle);
        if (m)
            $("rules")?.scrollIntoView({ block: "start" });
        if (bm)
            $("beliefs")?.scrollIntoView({ block: "start" });
        // The landing frost receipt deep-links to the climate provenance (#/why?climate) - not a rule, so
        // no focus; just bring "Where the climate numbers come from" into view.
        else if (/[?&]climate\b/.test(location.hash))
            $("whyclimate")?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("hashchange", focusWhyFromHash);
    focusWhyFromHash(); // honour a deep-link already present at first load
    initCalendar(activeBundle(bundle));
    // Display units (units.ts): inputs and UI-authored lengths follow the chosen system; storage and
    // the engine stay metric. Distance (metric/imperial) and temperature (°C/°F) are SEPARATE prefs -
    // ft with °C is valid. Set in the Account page's "Display preferences", not the header (walkthrough:
    // the two toggles were overkill in the top bar). The HTML ships metric defaults, so a stored
    // imperial preference converts the visible values once at startup, exactly like a change does.
    const applyUnitLabels = () => {
        for (const s of document.querySelectorAll(".ulen"))
            s.textContent = lengthUnit();
    };
    const convertLenInputs = (metres) => {
        LEN_INPUT_IDS.forEach((id, i) => {
            const m = metres[i];
            if (m != null)
                $(id).value = String(mToInput(m));
        });
    };
    // Mirror the current prefs into the Account-page selects (also called after a synced pref pulls in).
    const syncPrefControls = () => {
        $("prefunits").value = unitSystem();
        $("preftemp").value = tempSystem();
        $("preftheme").value = themeChoice();
        $("prefseason").value = seasonChoice();
    };
    if (unitSystem() === "imperial") {
        // startup: the HTML values are metric - read them as metres directly, then rewrite
        const metres = LEN_INPUT_IDS.map((id) => num(id));
        convertLenInputs(metres);
    }
    $("prefunits").addEventListener("change", () => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id)); // read in the OLD system
        setUnitSystem($("prefunits").value === "imperial" ? "imperial" : "metric");
        convertLenInputs(metres);
        applyUnitLabels();
        draw();
        void app.logRefresh?.(); // the log view's bed labels carry lengths too
        void app.pushPrefs?.(); // a deliberate change syncs to the account (if signed in)
    });
    $("preftemp").addEventListener("change", () => {
        // Temperature is display-only (no stored values to rewrite) - a redraw re-renders frost/heat temps.
        setTempSystem($("preftemp").value === "f" ? "f" : "c");
        draw();
        void app.logRefresh?.();
        void app.pushPrefs?.();
    });
    // Theme (redesign round 2): a pure display pref - the stylesheet swaps ramps on <html data-theme>,
    // so no redraw is needed; it syncs with the other display prefs.
    $("preftheme").addEventListener("change", () => {
        const v = $("preftheme").value;
        setThemeChoice(v === "dark" || v === "light" ? v : "system");
        void app.pushPrefs?.();
    });
    // Season (O88 S3): like theme, a pure display pref - the stylesheet swaps ramps on
    // <html data-season>, so no redraw is needed, and it syncs with the other display prefs.
    $("prefseason").addEventListener("change", () => {
        const v = $("prefseason").value;
        const ok = ["follow", "spring", "summer", "autumn", "winter"].includes(v);
        setSeasonChoice((ok ? v : "follow"));
        applySeasonalCopy(); // the palette follows the stamp on its own; the WORDS need re-resolving
        void app.pushPrefs?.();
    });
    applyTheme(); // boot.js stamped the pre-paint theme; re-assert from the module's view
    applySeason(); // ...and the same for the season stamp
    applyUnitLabels();
    syncPrefControls();
    // Apply a pref PULLED from the account (account.ts sync): read inputs in the old system, adopt the
    // pulled values (stamped with the remote's time, not re-stamped), then convert + relabel + redraw.
    app.applyPrefs = (rec, atMs) => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id));
        const changed = applyPrefRecord(rec, atMs);
        convertLenInputs(metres);
        applyUnitLabels();
        syncPrefControls();
        if (changed) {
            draw();
            void app.logRefresh?.();
        }
        return changed;
    };
    draw();
    setupLog(bundle, draw).then(() => {
        // The garden is loaded, so the state that decides which step opens has stopped moving: the
        // sheet stops choosing (sheet.ts endArrival). Before this signal existed the picker either
        // read a half-hydrated garden or kept correcting forever - and the forever version closed the
        // Where step under a visitor who was still checking their pin.
        endArrival();
        // A cold `#/plan?guild=` load fires no hashchange, so apply it here - after endArrival has picked
        // the opening step and the ledger has hydrated, so a bed the visitor already has is known and the
        // named team opens on it (O58 Phase 3, mirroring the crop deep-link's cold-load apply in answers.ts).
        applyGuildFromHash();
        // ...and the home stops treating an empty snapshot as "nothing to show" (home.ts): before this
        // signal, absence means the ledger has not been read, and unsaying the returning state on a
        // pre-hydration draw is exactly what put the stranger's doors back on screen mid-boot.
        settleHome();
        markHomeworthy(renderHomeNow(activeBundle(bundle)));
    }).catch((e) => {
        $("logmsg").textContent = `season log failed to start: ${e}`;
    });
    // The teams step's one nudge (declutter round): a picked team's payoff is its dates.
    document.getElementById("teamsnudge")?.addEventListener("click", () => { location.hash = "#/calendar"; });
    // The calendar's one nudge (walk round 2): back into the loop - no page ends in a wall.
    document.getElementById("calplannudge")?.addEventListener("click", () => { location.hash = "#/plan"; });
    // Dimension beds (earned planner phase B): two numbers make a real bed - auto-named, laid out
    // beside what exists, structure declared up front (a container never sees the trace-it card).
    // Same post-save sequence as every app-layer bed write: refresh the snapshot, announce the save.
    document.getElementById("dimmake")?.addEventListener("click", () => {
        void (async () => {
            const msg = $("dimbedmsg");
            try {
                const w = lenM("dimw"), l = lenM("diml");
                if (w == null || l == null || w <= 0 || l <= 0) {
                    msg.textContent = "Give both numbers - about how wide, about how long. Rough is fine.";
                    return;
                }
                if (!app.logDb)
                    throw new Error("storage is still opening - try again in a second");
                const beds = app.logSnapshot.beds;
                const name = nextBedName(beds);
                const o = nextOrigin(beds);
                const r2 = (v) => Math.round(v * 100) / 100;
                const structure = $("dimstructure").value;
                countRung("bed-saved"); // O29: a real growing area exists (dimension-bed path)
                await placeBed(app.logDb, app.currentPlotId, name, { shape: "rect", x: o.x, y: o.y, w: r2(w), h: r2(l) }, undefined, undefined, structure, true);
                msg.textContent = `Made "${name}" - its fit verdicts are below. Trace it on the map whenever you like.`;
                $("dimw").value = "";
                $("diml").value = "";
                await app.logRefresh?.();
                // the teams step reasons about the PICKED bed - the one just made is what they're planning
                const sel = document.getElementById("candbed");
                if (sel) {
                    sel.value = name;
                    sel.dispatchEvent(new Event("change"));
                }
                window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
            }
            catch (e) {
                msg.textContent = `${e instanceof Error ? e.message : e}`;
            }
        })();
    });
    let baseLoad = "idle";
    let manifest = null; // "ci,cj" of the non-empty cells
    let zip3Cells = {}; // ZIP3 -> the cells its centroids fall in
    const cellState = new Map(); // per cell, so each loads at most once
    const wanted = []; // requests that arrived before base landed
    // Each merge bumps a counter the zone cache signs into its key (intake.ts): a resolve done with the
    // cells present so far must not shadow a later one after another cell lands. This is the per-cell
    // form of the tables-present key the 2026-07-25 note in intake.ts already records.
    const bump = () => { const b = bundle; b._zipEpoch = (b._zipEpoch ?? 0) + 1; };
    const mergeCell = (body) => {
        if (body.zips) {
            bundle.zip_index = bundle.zip_index ?? { zips: {} };
            Object.assign((bundle.zip_index.zips ??= {}), body.zips);
        }
        if (body.zones) {
            bundle.zip_zones = bundle.zip_zones ?? { zones: {} };
            Object.assign((bundle.zip_zones.zones ??= {}), body.zones);
        }
        // Nationwide frost (D-113): fold each cell's NCEI stations into climate.sites, so the nearest-
        // station resolver covers this cell's region - the calendar's frost markers and sow dates populate.
        const st = body.stations;
        if (Array.isArray(st) && st.length && bundle.climate?.sites) {
            bundle.climate.sites = [...bundle.climate.sites, ...st];
        }
        bump();
    };
    const fetchCell = (ci, cj) => {
        const k = `${ci},${cj}`;
        if (cellState.has(k))
            return; // loading or done - never re-fetch, never evict
        cellState.set(k, "loading");
        void fetch(`../build/zip-grid/c${ci}_${cj}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .then((cell) => {
            if (cell) {
                mergeCell(cell);
                cellState.set(k, "done");
                draw();
                answersRefresh?.();
            }
            else
                cellState.delete(k); // a failed cell may be retried by the next signal
        })
            .catch(() => cellState.delete(k));
    };
    // Turn one request into cell fetches. A located point loads its cell + 8 neighbours (the 3x3 block
    // both resolvers need); a typed ZIP with no location loads the cells its first three digits name, so
    // zipToLatLon can then read the exact centroid and answersRefresh re-resolves.
    const serve = (req) => {
        if (Number.isFinite(req.lat) && Number.isFinite(req.lon)) {
            if (!manifest)
                return;
            const [ci, cj] = gridCell(req.lat, req.lon);
            for (let di = -1; di <= 1; di++)
                for (let dj = -1; dj <= 1; dj++) {
                    if (manifest.has(`${ci + di},${cj + dj}`))
                        fetchCell(ci + di, cj + dj);
                }
            return;
        }
        const z3 = req.zip?.replace(/\D/g, "").slice(0, 3);
        if (z3 && z3.length === 3)
            for (const [ci, cj] of zip3Cells[z3] ?? [])
                fetchCell(ci, cj);
    };
    const ensureZipData = (lat, lon, zip) => {
        const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
        const hasZip = !!zip && /\d{3}/.test(zip);
        if (!hasLoc && !hasZip)
            return; // no location signal in this call
        const req = { lat, lon, zip };
        if (baseLoad === "done") {
            serve(req);
            return;
        }
        wanted.push(req);
        if (baseLoad === "loading")
            return;
        baseLoad = "loading";
        void fetch(GRID_BASE_URL)
            .then((r) => (r.ok ? r.json() : null))
            .then((base) => {
            if (!base) {
                baseLoad = "idle";
                return;
            } // a failed base may be retried by the next signal
            manifest = new Set((base.manifest ?? []).map(([i, j]) => `${i},${j}`));
            zip3Cells = base.zip3_cells ?? {};
            // The >80km fallbacks + table metadata live in base; fold them in so an out-of-grid point
            // still resolves (grade C global ERA5) exactly as before, before any cell arrives.
            if (base.zip_index_meta)
                bundle.zip_index = { ...base.zip_index_meta, zips: bundle.zip_index?.zips ?? {} };
            if (base.zip_zones_meta)
                bundle.zip_zones = { ...base.zip_zones_meta, zones: bundle.zip_zones?.zones ?? {} };
            const b = bundle;
            if (base.global_zones)
                b.global_zones = base.global_zones;
            if (base.global_frost)
                b.global_frost = base.global_frost;
            baseLoad = "done";
            bump();
            while (wanted.length)
                serve(wanted.shift());
            draw();
            answersRefresh?.();
        })
            .catch(() => { baseLoad = "idle"; /* tables unavailable; zone stays unresolved, rest of app fine */ });
    };
    app.ensureZipData = ensureZipData;
    // The answers surface (exchange ladder, approved 2026-07-30). Its "Plan my actual garden" chip
    // carries the given ZIP into the planner's own field - the tit-for-tat promise that nothing a
    // visitor gave is asked for twice - and marks them started exactly as door 4 would.
    answersRefresh = initAnswers(bundle, {
        plantWithLocation: (lat, lon, zip) => {
            countRung("to-planner"); // O29: the ladder handed off - the deepest answers-surface crossing
            markStarted();
            // the pin lands at the ladder's resolved point (a ZIP centroid); the address field is
            // right there to refine it - the tit-for-tat promise with no field re-typed
            if (lat != null && lon != null) {
                setLocation(lat, lon, zip ? `Located from your ZIP ${zip} - refine with your address for a house-level pin.` : undefined);
            }
            location.hash = "#/plan";
        },
    });
    // Prime at boot ONLY for a returning user whose garden already carries an anchor (the lat/lon
    // fields were populated from the saved plot) - the common instant path is preserved. A cold,
    // location-less first visit - the acquisition-critical first load - fetches nothing here; the
    // first ZIP or address typed calls ensureZipData on demand (setLocation, answers' applyZip).
    if (Number.isFinite(num("lat")) && Number.isFinite(num("lon")))
        ensureZipData(num("lat"), num("lon"));
}
// The D-023 gate, amended by the earned planner phase C (approved 2026-07-30): the CALENDAR now
// SEES signed out - it draws live from what this device knows (the located draft's frost odds,
// planned beds, the answers-page crops) and its panel pitches KEEPING, not seeing. The Log
// (orchestrate) and Review stay account surfaces: the ledger is what an account buys. Until a
// backend exists the gate is advisory - a lock nobody could open would brick the app (D-023 §1).
const KEEP_COPY = [
    "This calendar draws live from what this device knows - the frost odds around your site's real median last frost, and any beds you've planned. One tap exports it, reminder included.",
    "Sign in (or create a free account) and your logged plantings and frost taps join these dates - kept, on every device.",
];
const LOCK_COPY = {
    log: [
        "Behind this tab: your garden's ledger - what grew where, so rotation warnings follow the actual ground; and your own frost observations, which after three logged seasons supersede the national climate model for your yard.",
        "Create a free account (or sign in) and the ledger follows you to every device - with a plain-file export you can always walk away with.",
    ],
    review: [
        "Behind this tab: the season in review, built from your own ledger - what grew and what it suffered, what your frost taps taught the model, and what next year's rotation allows on each bed, every warning cited.",
        "Create a free account (or sign in) and the review follows your ledger to every device.",
    ],
};
// D-029: while the disposable example garden is active, the gated tabs are PREVIEWED - the real
// content shows on the demo data, above a clear note that it locks once the example is cleared or for
// the user's own garden. The account wall is unchanged everywhere else.
// (The per-page preview note is retired, round 6: the shell example banner carries the message.)
function applyAuthGate() {
    const onExample = isExamplePlot(app.currentPlotId);
    const gated = !isSignedIn() && backendConfigured() && !onExample;
    for (const pid of ["calendar", "log", "review"]) {
        const sec = document.getElementById(`page-${pid}`);
        let panel = sec.querySelector(".lockpanel");
        if (!panel) {
            panel = document.createElement("div");
            panel.className = "lockpanel";
            panel.appendChild(document.createElement("p"));
            panel.appendChild(document.createElement("p"));
            const b = document.createElement("button");
            b.type = "button";
            b.className = "primary";
            b.textContent = "Sign in / create account";
            b.addEventListener("click", () => { location.hash = "#/account"; });
            panel.appendChild(b);
            const tagline = sec.querySelector(".tagline");
            sec.insertBefore(panel, tagline ? tagline.nextSibling : sec.children[1] ?? null);
        }
        const [p1, p2] = [...panel.querySelectorAll("p")];
        if (isSignedIn()) {
            sec.classList.remove("locked");
            panel.hidden = true;
        }
        else if (onExample) {
            // Preview: content visible, gate note HIDDEN - the shell-level example banner (round 5)
            // already carries the you're-exploring message on these very pages, and the pair read as
            // repeated messaging (maintainer, round 6).
            sec.classList.remove("locked");
            panel.hidden = true;
        }
        else if (backendConfigured()) {
            // Phase C (the D-023 amendment): the calendar is NOT locked - it renders from the device's
            // draft and wears the KEEP pitch. Log and Review keep the wall.
            sec.classList.toggle("locked", pid !== "calendar");
            panel.hidden = false;
            // Earned planner phase A: the pitch reads what the device already knows. A located draft
            // turns the abstract promise into the visitor's own date - honest (it is the date the tab
            // schedules by) and the same fact the Plan page already shows them.
            let line1 = pid === "calendar" ? KEEP_COPY[0] : LOCK_COPY[pid][0];
            if (pid === "calendar") {
                const b = liveBundle;
                const lat = num("lat"), lon = num("lon");
                const lf = b && lat != null && lon != null
                    ? resolveClimate(lat, lon, b)?.site.last_frost_32f?.p50 : null;
                if (lf) {
                    const [mm, dd] = lf.split("-").map(Number);
                    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    line1 = line1.replace("your site's real median last frost", `your site's real median last frost (${MON[(mm ?? 1) - 1]} ${dd})`);
                }
            }
            p1.textContent = line1;
            p2.textContent = pid === "calendar" ? KEEP_COPY[1] : LOCK_COPY[pid][1];
        }
        else {
            sec.classList.remove("locked");
            panel.hidden = false;
            p1.textContent = "Heads up: once accounts go live, this tab will ask you to sign in (everything on this device carries over).";
            p2.textContent = "";
        }
    }
    // the nav tabs wear the state too - the padlock says "gated" before the click
    setNavGated(gated);
}
app.refreshAuthGate = applyAuthGate; // re-run on a garden switch (log.ts) so the example preview toggles
// Landing (D-027). The front door is for strangers, not a toll on every load: once a visitor has
// started planning (clicked in, or has a located garden / a season log), we remember it per-device
// and send them straight to Plan. The flag is a plain localStorage boolean - private-mode throws
// are harmless (the landing just shows again, no data lost).
// the answers page's refresh hook - set by main2, fired when the lazy ZIP tables land (D-089)
let answersRefresh = null;
// the live bundle, for surfaces that render before/after it lands (the lock pitch)
let liveBundle = null;
const STARTED_KEY = "tsg.started";
function markStarted() {
    try {
        localStorage.setItem(STARTED_KEY, "1");
    }
    catch { /* private mode - landing reappears, fine */ }
}
app.markStarted = markStarted; // onSignIn calls this so a synced device skips the landing (D-106)
// ...and its mirror: leaving the example garden owning nothing puts the device back to stranger
// state, so the next load meets the landing's doors instead of an empty planner.
app.clearStarted = () => {
    try {
        localStorage.removeItem(STARTED_KEY);
    }
    catch { /* private mode - nothing was stored */ }
};
// Does the landing have something to SAY to this device? Stamped by the draw (the render's own
// return value - the flag can only be true because the home actually rendered), read by the fast
// path on the next load. It exists because the decision has to be made synchronously, before
// anything paints, and the ground it depends on lives in IndexedDB.
const HOME_KEY = "tsg.home";
let homeRendered = false; // the first successful home render - the splash's release signal
function markHomeworthy(on) {
    if (on)
        homeRendered = true;
    // Same guard as the class (home.ts): a pre-hydration draw must not CLEAR the stamp either, or
    // the next load has nothing to read and flashes the doors while it finds out.
    if (!on && !homeSettled())
        return;
    try {
        if (on)
            localStorage.setItem(HOME_KEY, "1");
        else
            localStorage.removeItem(HOME_KEY);
    }
    catch { /* private mode - the fast path just keeps its old behaviour */ }
}
function landingFastPath() {
    let returning = false, homeworthy = false;
    try {
        returning = localStorage.getItem(STARTED_KEY) === "1";
        homeworthy = localStorage.getItem(HOME_KEY) === "1";
    }
    catch { /* ignore */ }
    const h = location.hash;
    // an explicit route (incl. #/start, #/account from a recovery link) is always respected - but
    // the returning state below is claimed either way, because ARRIVING ON #/start (a reload, a
    // bookmark, sign-in's own hop) is exactly when the doors would otherwise flash.
    const explicit = h !== "" && h !== "#" && h !== "#/";
    if (!explicit) {
        // Strangers meet the front door. A returning gardener with ground meets the landing's SECOND
        // state - the answer, not the pitch (2026-08-01; this is what changed `tsg.started` from "skip
        // the landing" to "the landing knows you"). A returner with nothing to greet still falls to
        // Plan, exactly as before: sending someone who crossed into planning back to the doors would be
        // a regression, and a landing with nothing to say is the doors.
        if (!returning || homeworthy)
            location.hash = "#/start";
    }
    // NO FLASH OF THE STRANGER'S LANDING (maintainer, staging walk: "it needs to be seamless").
    // The returning state was only reachable after the first draw - which waits on the bundle AND on
    // IndexedDB - so a gardener with ground watched the hero, the doors and the pitch paint, then
    // vanish. The stamp already knows the answer synchronously, so claim the class here, before
    // anything paints, and hold the splash below until the home is actually up.
    //
    // Keyed on the DESTINATION, not on how we got there: a reload sitting on #/start, or sign-in's
    // own hop to it, is an explicit hash and would have skipped this - which is precisely the flash
    // an e2e frame-sampler caught after the first fix. Homeworthy is enough on its own; it can only
    // be set by a home that actually rendered.
    if (homeworthy && location.hash.startsWith("#/start")) {
        document.body.classList.add("home-returning");
        awaitingHome = true;
    }
}
// Set by the fast path when this load is headed for the returning home: the boot splash then stays
// up until the home has rendered, so the visitor crosses splash -> garden with nothing in between.
let awaitingHome = false;
// ...with a ceiling, because a splash that can hang forever is the exact failure D-091's splash
// exists to prevent. Past it, the landing shows whatever state it has reached.
const HOME_WAIT_MS = 2500;
applyCopy(); // fill data-copy elements from the one copy file, before anything is shown
noteArrival(); // O27 rec 2: read how long this device was away (the welcome-back kicker), stamp now
captureAuthHash(); // a recovery link's tokens must survive the router's hash handling
initNav(); // the dropdown nav (D-025) - rendered before anything can fail below
initPlanSheet(); // the D-079 map-first shell - layout works even if the bundle fetch fails
landingFastPath(); // decide start-vs-plan BEFORE the router applies, so there is no flash
initRouter(); // page routing works even if the bundle fetch below fails
// The landing CTAs work without the bundle - a stranger can always cross into Plan. The editorial
// landing (session-qt3r7p) has two: the hero button and the closing one at the foot of the page.
for (const b of document.querySelectorAll(".startgo")) {
    b.addEventListener("click", async () => {
        markStarted();
        // "Start planning" means MY garden. If the disposable example is active (from a prior "See an
        // example" visit, gg-plot persists), leave the demo behind on a fresh own-garden Plan rather than
        // re-entering it (D-029 bug: the button used to inherit the example garden).
        if (isExamplePlot(app.currentPlotId) && app.removeExample)
            await app.removeExample();
        else
            location.hash = "#/plan";
    });
}
// The exchange-ladder doors (approved 2026-07-30): doors 1-2 open the answers surface. They do
// NOT mark the visitor started - answering a question is not adopting the planner, and the landing
// should greet them again next visit until they cross into planning. Door 2 enters crop-first.
document.getElementById("doorwhen")?.addEventListener("click", () => { location.hash = "#/answers"; });
document.getElementById("doorteams")?.addEventListener("click", () => { location.hash = "#/answers?teams"; });
// O34, door 3: a REAL claim, rotating by the day, landing on that claim's own evidence. The
// abstract "is that gardening tip true?" asked the visitor to imagine an example; naming one they
// already believe is the difference between an invitation and a chore.
{
    const claim = doorClaim(Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000));
    const q = document.querySelector('a.lg-door[href^="#/why"] .lg-door-q');
    const link = document.querySelector('a.lg-door[href^="#/why"]');
    if (q && link) {
        q.textContent = claim.q;
        link.href = `#/why?belief=${claim.id}`;
    }
}
// (The situation row moved one layer deeper, to the answers page - see answers.ts. It asked intake
//  questions on the front page before the visitor had received anything, which is a lot of the most
//  valuable real estate spent on a second set of questions.)
// "See an example garden" (D-029): seed + activate the disposable demo garden (app.showExample is set
// in setupLog, so it exists by the time a stranger can click). Its "Remove example" mirror lives on
// the Plan banner. Both read the hook lazily at click time.
document.getElementById("examplebtn")?.addEventListener("click", async () => {
    // setupLog wires app.showExample only after the ledger opens; on a slow boot a stranger can tap
    // before that, so wait briefly rather than dropping the tap (D-029).
    for (let i = 0; i < 120 && !app.showExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.showExample?.();
});
// "Remove example" tears the demo down and returns to the user's own (demo-free) plan. Wait briefly for
// app.removeExample the same way the "See an example" tap does: on a slow boot the banner can render (from
// a persisted gg-plot=plot_example) before setupLog wires the teardown, and a tap that silently no-ops is
// exactly the "banner won't close" bug (D-029).
const closeExample = async () => {
    for (let i = 0; i < 120 && !app.removeExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.removeExample?.(true); // the banner's Remove = leaving the demo → the landing's doors
};
document.getElementById("exampleremove")?.addEventListener("click", () => { void closeExample(); });
onAuthChange(applyAuthGate);
applyAuthGate();
// Google Maps keys (Phase C, D-032). Fire-and-forget: the geocoder and the ground map read the
// keys when the user acts, long after this resolves; absent maps.json → keyless mode, unchanged.
void loadMapsConfig().then(() => {
    // The maps key decides which imagery the ground view asks for, and it arrives AFTER the first
    // render - so the home's backdrop had already committed to keyless Esri, which is blocked or
    // failing for at least one real user (measured on staging: blank under an "Esri" credit, then
    // Google imagery the moment a trip to Plan created the session). Re-render once the key is in
    // hand, so the home gets the same tile source the plan page does, without the round trip.
    invalidateHomeGlance(); // REBUILD, not just re-render: a reused node never calls drawTiles again,
    app.homeRefresh?.(); // and it is that call which kicks the Google session.
    // The key also decides whether the Where step gets the Google location map (D-181), and it lands
    // AFTER the first render - so re-run the step sync now. The event is the same one the sheet fires
    // on a step change, so there is one path into syncWhereMap rather than two.
    window.dispatchEvent(new Event("gg-step-changed"));
});
// One anonymous pageview per load (acquisition P0) - production-host-gated, DNT-honouring; see analytics.ts.
countPageview();
// Boot: render the app, then drop the first-paint splash (index.html) so the loading screen is only up
// while the shell is genuinely not interactive. A bundle-load failure becomes a real error + reload on
// the splash rather than an endless spinner - the fetch can fail on a cold CDN, and a stuck screen is
// exactly the "looks broken" symptom this splash exists to prevent (D-091).
const dropSplash = () => { document.getElementById("bootsplash")?.setAttribute("hidden", ""); };
loadBundle()
    .then((bundle) => {
    main2(bundle);
    // A load headed for the returning home holds the splash until the home is up (or the ceiling
    // passes). Every other load drops it exactly as before - the shell IS interactive by here.
    if (!awaitingHome) {
        dropSplash();
        return;
    }
    const t0 = Date.now();
    const tick = () => {
        if (homeRendered || Date.now() - t0 > HOME_WAIT_MS) {
            dropSplash();
            return;
        }
        requestAnimationFrame(tick);
    };
    tick();
})
    .catch((e) => {
    const boot = document.getElementById("bootsplash");
    if (boot) {
        boot.classList.add("failed");
        const word = boot.querySelector(".bootword");
        if (word)
            word.textContent = "Couldn't load Milpa Gardens.";
    }
    $("guilds").textContent = String(e);
});
// PWA (D-019): installable + offline after first load. The registration failing (plain-http
// dev, old browser) costs nothing - the app is a normal website without it.
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => { });
}
