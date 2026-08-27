// Log page (Phase A page-split): the season ledger. Wires the record forms to the IndexedDB
// adapter, renders the R-093 observed-vs-predicted frost panel and the R-003/R-004 layout check,
// and owns the synthetic demo seasons. The log is browser-local user data - never sent anywhere,
// never mixed into the bundle; the engine validates and derives, this module only wires forms.
import { frostCalibration, shiftFrostDate } from "./engine/frostcalib.js";
import { ledgerEarned } from "./earned.js";
import { humanize, humanizeFamilies, stripRuleCitations, titleCase } from "./engine/labels.js";
import { parseRegion as parseRegionSnapshot, regionCentroid, regionPoints } from "./engine/regions.js";
import { emitSeason, parseSeasonFile } from "./engine/seasonfile.js";
import { END_CAUSES, FAILURE_SEVERITIES, OBSERVATION_EVENTS, OBSERVATION_SEVERITIES, forwardCarried } from "./engine/seasonlog.js";
import { geometryRules } from "./engine/solar.js";
import { capabilities, validateUserSpecies } from "./engine/userspecies.js";
import { plantEditorForm } from "./plantform.js";
import { initAccount, isSignedIn, signedInEmail } from "./account.js";
import { toast } from "./notices.js";
import { $, familiesOf, num } from "./dom.js";
import { coachBand, COACH_HEADING, COACH_LOG } from "./coachband.js";
import { renderSeedBox, renderShoppingList } from "./seedbox.js";
import { go } from "./nav.js";
// The soil entries offered in the garden-wide composer. DELIBERATELY SHORT: these are the two things
// a gardener notices mid-season that change what the engine can say - standing water (R-100's input)
// and an amendment that supersedes a pH reading (SOIL-UX section 2). Everything else about soil is a
// considered answer, not a thing you notice in a storm, and belongs on the card.
const SOIL_COMPOSER_EVENTS = [
    ["soil_waterlogged", "water stood after rain"],
    ["soil_lime", "I added lime"],
    ["soil_sulfur", "I added sulfur"],
    ["soil_compost", "I added compost"],
];
import { resolveClimate, resolveZone } from "./engine/intake.js";
import { initGroundMap } from "./groundmap.js";
import { addFailure, addObservation, addPlanting, addPlantingNote, defaultWorkspacePlotId, deletePlot, eraseGarden, deleteSeason, deleteSoilObservation, deleteUserSpecies, endPlanting, freePlotId, getPhoto, getPlot, getSeason, listPlots, listPosts, listSeasons, listSoilObservations, listSyncBackups, listUserSpecies, mintPostId, openLog, plotIdFor, plotVisible, putPhoto, putPost, putSeason, putSoilObservation, putUserSpecies, rekeyPlot, removePlanting, renameBed, restoreSyncBackup, setPlotAnchorOnce, setPlotName, updatePlanting } from "./storage.js";
import { buildStoreZip, downscalePhoto, mintPhotoName, readStoreZip } from "./photos.js";
import { linkNameIn, linkNamesIn, plantLink } from "./panels/plantcard.js";
import { reselectSoilGround, setSoilHooks, setSoilJump } from "./panels/soil.js";
import { countGardenActive } from "./analytics.js";
import { bedHasSections, bedSeasonStatus, markBedPlanted, markBedPlantedAdvancingSeason, offSeasonNudge, plantingOnBed, sectionParentName } from "./plan.js";
import { displayName } from "./engine/guilds.js";
import { app, bedShapeLabel, commonName, defaultPlotId, regionLabel, ruleClaim, setCurrentPlot, setDefaultPlot } from "./state.js";
import { feedTime, postBody } from "./feed.js";
import { copy } from "./copy.js";
import { EXAMPLE_PLOT_ID, removeExampleGarden, seedExampleGarden } from "./example.js";
import { hasGround } from "./home.js";
import { familyName } from "./engine/labels.js";
import { buzz } from "./haptics.js";
// ---------------------------------------------------------------- frost calibration
const fmtOffset = (v) => (v > 0 ? `+${v}` : `${v}`); // +7, -3, +7.5, 0
// One boundary block (last spring frost OR first fall freeze): the per-season points, then either
// the calibrated offset that supersedes the model, or how many more seasons are needed.
function renderBoundary(p, label, cal, minSeasons) {
    if (!cal.per_season.length) {
        p(`${label}: none logged yet.`, "provenance");
        return;
    }
    p(`${label}:`, "provenance");
    for (const pt of cal.per_season) {
        p(`· ${pt.season}: observed ${pt.observed} vs model ${pt.model} (${fmtOffset(pt.offset_days)} d)`, "provenance");
    }
    if (cal.calibrated) {
        const m = cal.median_offset_days;
        const model = cal.per_season[0].model;
        const [lo, hi] = cal.offset_range ?? [m, m];
        const dir = m > 0 ? `${Math.abs(m)} days later` : m < 0 ? `${Math.abs(m)} days earlier` : "right on the model";
        p(`Calibrated (${cal.n} seasons, median ${fmtOffset(m)} d, range ${fmtOffset(lo)}…${fmtOffset(hi)}): ` +
            `this ground runs ~${dir} than the model. Observed ~${cal.calibrated_date} supersedes the model's ${model} ` +
            `for this plot.`, "calibrated");
    }
    else {
        p(`${cal.n} of ${minSeasons} seasons logged - ${minSeasons - cal.n} more before this ground's offset supersedes the model.`);
    }
}
// The observed-vs-predicted render. Reads the resolved site climatology and the logged (or seeded
// synthetic) seasons; below R-093's min_seasons it withholds the fit and says how many remain.
// The earn-strip (earned planner phase A): three standings from the same resolvers the
// mechanisms use - see earned.ts. Reads REAL seasons only: a LIVE badge earned by the synthetic
// demo seasons would be a lie about the gardener's own ledger, so the demo never reaches it.
// A7a (award-benchmark amendments): the composer's reward beat. `justLogged` marks the entry the
// composer just wrote so the next timeline render can scale its dot in (one-shot, consumed on
// render); `lastEarnedSite` is the climate site the earn-strip last rendered with, so the obsadd
// handler can re-run the same pure resolver without new plumbing.
let justLogged = null;
let lastEarnedSite = null;
export function renderEarned(site, seasons, plot) {
    lastEarnedSite = site;
    const panel = document.getElementById("earnedstrip");
    if (!panel)
        return;
    panel.innerHTML = "";
    for (const row of ledgerEarned(seasons, site, app.soilObservations ?? [], plot)) {
        const div = document.createElement("div");
        div.className = `earnedrow ${row.state}`;
        const st = document.createElement("span");
        st.className = "earnedst";
        st.textContent = row.badge;
        const what = document.createElement("span");
        what.className = "earnedwhat";
        what.textContent = row.text;
        div.append(st, what);
        panel.append(div);
    }
}
export function renderFrost(site, seasons, synthetic) {
    const panel = $("frost");
    panel.innerHTML = "";
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
    };
    const head = document.createElement("strong");
    head.textContent = "Observed vs predicted frost";
    panel.appendChild(head);
    if (synthetic) {
        p("Synthetic demo data - these seasons are generated, not real observations. Not saved, never exported.", "synthetic");
    }
    if (!site) {
        p("Resolve a site above to compare your logged frosts against the model.");
        return;
    }
    const cal = frostCalibration(seasons, site);
    if (!cal.spring.per_season.length && !cal.fall.per_season.length) {
        p(`No frost logged yet. Tap the date of your last spring frost and first fall freeze each season; ` +
            `after ${cal.min_seasons} seasons this ground's own offset supersedes the model.`);
        return;
    }
    renderBoundary(p, "Last spring frost", cal.spring, cal.min_seasons);
    renderBoundary(p, "First fall freeze", cal.fall, cal.min_seasons);
}
// Four demo seasons of a frost-pocket plot, seeded a fixed number of days off the resolved model:
// the last spring frost lingers later and the first fall freeze arrives earlier (cold air pools in
// a low spot - the microclimate R-093 exists to catch). Offsets vary season to season so the fit
// is a median over real spread, not a constant. Seeded relative to the model so the story holds on
// whichever site is resolved. Plot id marks them synthetic; they never touch storage.
const DEMO_SEASONS = [
    { year: 2021, spring: 7, fall: -7 },
    { year: 2022, spring: 8, fall: -5 },
    { year: 2023, spring: 5, fall: -9 },
    { year: 2024, spring: 9, fall: -6 },
];
export function makeSyntheticSeasons(site) {
    const springP50 = (site.last_frost_32f ?? {}).p50;
    const fallP50 = site.first_freeze_32f_p50;
    return DEMO_SEASONS.map((o) => {
        const observations = [];
        if (springP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(springP50, o.spring)}`, event: "frost", severity: "hard" });
        if (fallP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(fallP50, o.fall)}`, event: "frost", severity: "hard" });
        return { id: o.year, plot: "demo_synthetic", observations };
    });
}
// ---------------------------------------------------------------- layout check
// The solar rules' producer is the season log, not a canvas: every logged planting already
// carries its region in plot coordinates, so the layout is the centroids of the open season's
// still-in-the-ground plantings. The plot frame carries no stored orientation; the convention
// (+y = geographic north) is stated at bed placement and repeated here - an assumption said
// out loud, not data invented.
export function renderSolar(bundle, site) {
    const panel = $("solar");
    panel.innerHTML = "";
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
        return el;
    };
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    const live = (season?.plantings ?? []).filter((pl) => !pl.end_cause);
    if (live.length < 2)
        return; // one plant cannot shade a neighbour; nothing to check
    if (site.lat == null) {
        p("Layout check needs a latitude (set one above) - the polar side and the sun angle depend on it.", "hint");
        return;
    }
    const layout = live.map((pl) => {
        const c = regionCentroid(pl.region); // rect centre, or the traced polygon's area centroid
        return { species: pl.species, group: pl.cultivar_group ?? null, x: c[0], y: c[1] };
    });
    const fired = geometryRules(layout, site, bundle);
    p(`Layout check (season ${season.id}, ${live.length} plantings in the ground; positions are ` +
        `your logged regions' centres, +y assumed geographic north):`, "provenance");
    if (!fired.length) {
        p("No height-ordering or noon-shadow conflicts in this layout.");
        return;
    }
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const remedies = new Set();
    // Round 6 (maintainer, example garden): 12 beans behind 16 corn fired one line PER PAIR, in
    // raw species keys - a wall of "phaseolus_vulgaris sits in the noon shadow...". Display-layer
    // fix only (the engine's findings are untouched): reader-facing lines swap keys for common
    // names, and identical findings collapse to one tallied line.
    const nameFor = new Map(live.map((pl) => [pl.species, commonName(bundle, pl.species)]));
    // O46: the key→name substitution is also where the MARKS come from - each species key this line
    // actually contained becomes {label, species}, so the names the gardener reads link to their
    // cards. A user variety's key still substitutes but marks nothing: the card refuses ids outside
    // the base bundle, and gating on app.userSpecies holds whichever bundle a caller passes.
    const seen = new Map();
    for (const f of fired) {
        let text = stripRuleCitations(humanizeFamilies(f.why));
        const marks = [];
        for (const [key, name] of nameFor) {
            if (!text.includes(key))
                continue;
            text = text.split(key).join(name);
            if (!app.userSpecies.some((u) => u.id === key))
                marks.push({ label: name, species: key });
        }
        const prev = seen.get(text);
        if (prev)
            prev.n++;
        else
            seen.set(text, { n: 1, rule: f.rule, marks });
        const remedy = ruleById.get(f.rule)?.remedy;
        if (remedy)
            remedies.add(stripRuleCitations(remedy));
    }
    for (const [text, info] of seen) {
        const line = p("", "heat");
        linkNamesIn(line, info.n === 1 ? text : `${info.n} × ${text}`, info.marks);
        line.title = ruleClaim(bundle, info.rule);
    }
    for (const r of remedies)
        p(r, "hint");
}
// Close nudge (D-115): the season close is a CEREMONY the design calls "climate-recommended - after the
// first fall freeze" (ISSUES #11). This is that recommendation: has an open season's own first freeze
// passed as of `todayIso`? The freeze mmdd is the effective one - the plot's OBSERVED date once R-093
// calibrates (D-114), else the model median - so the nudge rides the user's own ground when it can. Pure
// and exported so the timing is testable without waiting for October.
export function firstFreezePassed(seasonYear, freezeMmdd, todayIso) {
    if (!freezeMmdd || !/^\d{2}-\d{2}$/.test(freezeMmdd))
        return false;
    return todayIso >= `${seasonYear}-${freezeMmdd}`;
}
// ---------------------------------------------------------------- season log (D-013, storage v1)
// App layer only: the engine validates and derives; this wires forms to the IndexedDB adapter.
// The log is browser-local user data - never sent anywhere, never mixed into the bundle.
export async function setupLog(bundle, onLogChange) {
    let db;
    try {
        db = await openLog();
    }
    catch (e) {
        $("logmsg").textContent = `Browser storage unavailable (${e}) - the season log is off.`;
        return;
    }
    app.userSpecies = await listUserSpecies(db); // fold the user's added varieties into the render path
    // D-148 P0: the plot's soil observations, and the seam the soil panel saves through. Storage is
    // owned here (the panel owns the form), and putSoilObservation validates against the engine oracle,
    // so an invalid record is refused loudly rather than stored.
    app.soilObservations = await listSoilObservations(db);
    app.soilRefresh = async () => { app.soilObservations = await listSoilObservations(db); };
    setSoilHooks({
        save: async (rec) => {
            await putSoilObservation(db, rec);
            await app.soilRefresh?.();
            onLogChange();
        },
    });
    // The Log's soil section REPORTS; the record card now lives on the Log too (walk round 4), so a
    // row routes down-page instead of cross-page - one entry surface, same page as the ledger the
    // observation joins.
    setSoilJump((ground) => {
        // Redraw the card BEFORE navigating: `go` switches pages without triggering an app redraw, so
        // setting the ground alone would land the user on a card still showing the previous one.
        reselectSoilGround(ground);
        go("log", "soilcard");
    });
    // O16 / D-153 on the Log: two homes, chosen by what the message IS.
    //
    // msg() DOCKS in #logmsg and stays put - errors, and instructions the user must act on (the
    // two-tap "tap again to add anyway" gate is the clearest case: it describes an ARMED state, and
    // a state cue that fades takes the state's only evidence with it).
    //
    // said() FLOATS - a confirmation of something already done, which nobody needs to find again.
    // It also CLEARS the docked line, because the alternative is a stale error sitting under a
    // success float, contradicting it. Errors dock; successes clear and float.
    const msg = (text, err = false) => {
        const m = $("logmsg");
        m.textContent = text;
        m.className = err ? "hint err" : "hint";
    };
    const said = (text) => {
        msg("");
        toast(text);
    };
    const fillSelect = (id, values, labels) => {
        const sel = $(id);
        sel.innerHTML = "";
        for (const v of values) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = labels ? labels(v) : v;
            sel.appendChild(o);
        }
    };
    // Closed vocabularies straight from the engine: the vocabulary IS the input widget (D-013). The
    // end-cause / failure-severity / species pickers now live in the card drill-down (renderLocations),
    // which builds them per-card; only the observation form remains here (relocates in slice C).
    fillSelect("obsevent", OBSERVATION_EVENTS);
    fillSelect("obssev", OBSERVATION_SEVERITIES);
    // SOIL IN THE COMPOSER (SOIL-UX section 3). "Water stood after rain" is observed during a July
    // storm, and until now the only way to record it was to remember to open Your ground on the Plan
    // tab and change a dropdown. That is backwards, so the two soil entries that carry real weight sit
    // here beside frost and heat - in their own optgroup, because they are a different kind of thing:
    // frost and heat land on the whole address, soil lands on a BED.
    //
    // They write to the SOIL series, not to the season record. Same composer, different store, because
    // an observation about ground is not an event in a season - it outlives the season (D-002).
    {
        const ev = $("obsevent");
        const grp = document.createElement("optgroup");
        grp.label = "Soil";
        for (const [value, label] of SOIL_COMPOSER_EVENTS) {
            const o = document.createElement("option");
            o.value = value;
            o.textContent = label;
            grp.appendChild(o);
        }
        ev.appendChild(grp);
    }
    // Severity is the frost calibration point; heat carries a note instead - so hide the severity
    // picker unless the event is frost (matches the card's inline observation logic). The ground
    // picker is the mirror image: shown ONLY for soil, where "here" has to mean somewhere.
    {
        const ev = $("obsevent"), sv = $("obssev");
        const gr = $("obsground");
        const syncSev = () => {
            const soil = ev.value.startsWith("soil_");
            sv.hidden = soil || ev.value !== "frost";
            gr.hidden = !soil;
        };
        ev.addEventListener("change", syncSev);
        syncSev();
    }
    const today = new Date().toISOString().slice(0, 10);
    $("obsdate").value = today;
    const seasonSel = $("logseason");
    const currentSeasonId = () => (seasonSel.value === "" ? null : Number(seasonSel.value));
    // Carry-over default (ISSUES #11 slice 3b): what we KNOW from the corpus decides how a plant
    // resolves at close - a perennial or biennial persists into next season; an annual (or an unknown
    // species) ends. The user's own added varieties are consulted too. Overridable is a later slice.
    const persists = (speciesId) => {
        const s = bundle.species.find((x) => x.id === speciesId)
            ?? app.userSpecies.find((x) => x.id === speciesId);
        const life = s?.lifespan;
        return life === "perennial" || life === "biennial";
    };
    // Resolve one live planting at close: perennials/biennials carry over (no end pair - they did not
    // end); everything else ends by the chosen cause + date. Already-resolved plantings are untouched,
    // so per-bed close then a season roll is idempotent (the nesting the maintainer asked for).
    const resolvePlanting = (p, cause, date) => {
        if (p.end_cause || p.carried_over)
            return p;
        return persists(p.species) ? { ...p, carried_over: true } : { ...p, end_cause: cause, end_date: date };
    };
    // ISSUES #11 Log redesign slice A: the ledger as a HIERARCHY (maintainer's vision) - the current
    // LOCATION → a scalable year switcher (past closed seasons open read-only) → beds as CARDS, each
    // expanding to the read-only planting list. Status and plant lists derive from occupancy (never a
    // bed-attached record - the ground-rooted line). The season loop's controls (close/reactivate/
    // reopen, with the confirm) live at the location foot. Editing actions inside a card come in slice B.
    const el = (tag, cls) => { const e = document.createElement(tag); if (cls)
        e.className = cls; return e; };
    const PLANT_DOTS = ["#d1495b", "#e0b64f", "#5f9e5f", "#7b9acc", "#c77dff", "#16a34a", "#5f7d2e", "#93ad57"];
    let viewedYear = null; // the Log's VIEW year - independent of the active season, so
    // reviewing history never repoints where new plantings save.
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fmtMD = (md) => {
        if (!md)
            return null;
        const m = /^(\d{2})-(\d{2})$/.exec(md);
        return m ? `${MONTHS[Number(m[1]) - 1] ?? m[1]} ${Number(m[2])}` : md;
    };
    // A legible "where" for a garden (walkthrough #1): the address the user typed if we captured it, else
    // a computed locality - the nearest climate station when it's actually close, otherwise the rounded
    // coordinates - so on login it's clear WHERE a garden is, not just its name. The anchor is always
    // persisted (and now syncs); this reads it back into words.
    const round2 = (n) => Math.round(n * 100) / 100;
    const localityBit = (plot) => {
        const addr = plot?.address?.trim();
        if (addr)
            return addr;
        const anchor = plot?.anchor;
        if (!anchor)
            return null;
        const clim = resolveClimate(anchor.lat, anchor.lon, bundle);
        if (clim?.site?.key && clim.distanceKm < 60)
            return `near ${titleCase(humanize(clim.site.key))}`;
        return `${round2(anchor.lat)}, ${round2(anchor.lon)}`;
    };
    const locationLabel = (plot) => {
        const bits = [];
        const loc = localityBit(plot);
        if (loc)
            bits.push(loc);
        const anchor = plot?.anchor;
        if (anchor) {
            const zone = resolveZone(anchor.lat, anchor.lon, bundle);
            if (zone && zone.zone != null)
                bits.push(`zone ${zone.label ?? zone.zone}`);
        }
        return bits.length ? bits.join(" · ") : null;
    };
    // The active-garden banner at the top of the Plan sheet (walkthrough): on login it must be obvious
    // WHICH garden + location is active, at ANY garden count - the name alone wasn't enough. Shows once
    // the garden is real (anchored or has beds); tapping opens the Where step to switch garden / change
    // location. With more than one garden it hints that it's switchable.
    const renderActiveGarden = (plot, gardenCount) => {
        const bar = document.getElementById("activegarden");
        if (!bar)
            return;
        const real = !!(plot?.anchor || (plot?.beds?.length ?? 0) > 0);
        // ONE garden needs no banner (walk round 4, maintainer): its address is in the Where field and
        // its zone in the receipt - restating them above the entry read as clutter, not orientation.
        // The banner earns its place exactly when there is something to switch BETWEEN.
        if (!real || gardenCount <= 1) {
            bar.hidden = true;
            return;
        }
        bar.innerHTML = "";
        const nm = el("span", "ag-name");
        nm.textContent = `${plot?.name ?? humanize(app.currentPlotId)}${plot?.shared ? ` (${copy.teamsSharedTag})` : ""}`;
        const where = locationLabel(plot);
        const w = el("span", "ag-where");
        w.textContent = where ? ` · ${where}` : " · location not set";
        bar.append(nm, w);
        if (gardenCount > 1) {
            const s = el("span", "ag-switch");
            s.textContent = "switch ▾";
            bar.appendChild(s);
        }
        bar.title = gardenCount > 1
            ? "your active garden - tap to switch garden or change its location"
            : "your active garden - tap to change its location";
        bar.hidden = false;
        bar.onclick = () => { const wh = document.getElementById("step-where"); if (wh)
            wh.open = true; };
    };
    // The team feed (D-172): conversation on THIS garden. Shown only signed in, on an account garden
    // (own or shared) - a draft/example garden has no team to talk to. Every post renders as PLAIN
    // CONVERSATION: the body is textContent (never innerHTML, never markdown, never a rule link), and
    // the card carries no grade/rule-card class - the voice boundary that keeps folklore arriving
    // socially from ever looking like the evidence layer. A member sees who wrote each note and when;
    // you can delete your OWN note. Text only in v1; a photo on a post amends D-171 and is its own slice.
    // Replaced copies (D-125 surfaced): the ring's entries for the ACTIVE garden, newest first, each
    // with an armed two-tap restore. A restore writes back through the stamping path, so the merge
    // treats it as this device's newest edit - a re-add that beats a deletion tombstone - and the
    // revert syncs to the whole team. The fold stays hidden when the ring holds nothing for this
    // garden, so a solo gardener who never syncs never sees it.
    const renderRestore = async () => {
        const sec = document.getElementById("gardenrestore");
        if (!sec)
            return;
        const plotId = app.currentPlotId;
        const mine = (await listSyncBackups(db)).filter((b) => (b.kind === "plot" && b.key === plotId) || (b.kind === "season" && b.key.startsWith(`${plotId}:`)));
        sec.hidden = mine.length === 0;
        if (sec.hidden)
            return;
        const list = $("restorelist");
        list.innerHTML = "";
        for (const b of mine) {
            const row = el("div", "restorerow");
            const mins = Math.max(0, Math.round((Date.now() - b.replacedAt) / 60000));
            const when = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago`
                : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago` : new Date(b.replacedAt).toLocaleDateString();
            const what = b.kind === "season"
                ? `${copy.restoreSeasonLabel} ${b.key.slice(plotId.length + 1)} (${(b.record.plantings ?? []).length} plants)`
                : `${copy.restoreLayoutLabel} (${(b.record.beds ?? []).length} beds)`;
            const lab = el("span", "hint");
            lab.textContent = `${what} - replaced ${when}`;
            const btn = el("button");
            btn.type = "button";
            btn.textContent = copy.restoreBtn;
            btn.addEventListener("click", async () => {
                // armed two-tap, the delete-garden pattern: the first tap only arms
                if (!btn.classList.contains("arm")) {
                    btn.classList.add("arm");
                    btn.textContent = copy.restoreArmedBtn;
                    return;
                }
                btn.disabled = true;
                try {
                    await restoreSyncBackup(db, b.id);
                    msg(copy.restoreDone);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                    btn.disabled = false;
                }
            });
            row.append(lab, btn);
            list.appendChild(row);
        }
    };
    const renderFeed = async (plot) => {
        const sec = document.getElementById("gardenfeed");
        if (!sec)
            return;
        const show = isSignedIn() && !!plot && !plot.example;
        sec.hidden = !show;
        if (!show)
            return;
        $("feedbody").placeholder = copy.feedPostPlaceholder;
        const me = (signedInEmail() ?? "").toLowerCase();
        const list = $("feedlist");
        list.innerHTML = "";
        const posts = (await listPosts(db, app.currentPlotId)).filter((p) => !p.deleted);
        if (!posts.length) {
            const e = el("p", "hint");
            e.textContent = copy.feedEmpty;
            list.appendChild(e);
            return;
        }
        for (const po of posts) {
            const card = el("div", "feedpost");
            const head = el("div", "feedpost-head");
            const who = el("span", "feedpost-who");
            who.textContent = po.author || "a gardener";
            const when = el("span", "feedpost-when");
            when.textContent = ` · ${feedTime(po.at)}`;
            head.append(who, when);
            const body = postBody(po.body, "feedpost-body"); // the voice boundary, now in feed.ts
            card.append(head, body);
            if (po.author && po.author.toLowerCase() === me) {
                const del = el("button", "feedpost-del");
                del.type = "button";
                del.textContent = copy.feedDeleteBtn;
                del.addEventListener("click", async () => { await putPost(db, { ...po, deleted: true }); await refresh(); });
                card.appendChild(del);
            }
            list.appendChild(card);
        }
    };
    // Multi-location weather (walkthrough): with more than one garden, each has its own climate at its
    // own latitude - a garden in MN and one in FL want very different frost dates. Surface every garden's
    // zone + typical frost dates at a glance (from its plot anchor, D-023), the active one highlighted;
    // tap another to switch to it (activatePlot restores its location + re-reads its ledger). One garden
    // shows nothing here - the single weather panel below already IS its weather.
    const renderGardensClimate = (allPlots) => {
        const host = $("gardensclimate");
        host.innerHTML = "";
        if (allPlots.length < 2)
            return;
        const def = defaultPlotId();
        const intro = el("p", "hint");
        intro.textContent = "Each garden has its own climate. Tap one to switch to it - the frost/heat you log below attaches to the highlighted garden.";
        host.appendChild(intro);
        const wrap = el("div", "gc-cards");
        // active garden first - it's the one whose beds show above and whose season the log-it below writes to
        const ordered = [...allPlots.filter((pl) => pl.id === app.currentPlotId), ...allPlots.filter((pl) => pl.id !== app.currentPlotId)];
        for (const pl of ordered) {
            const card = el("div", "gc-card" + (pl.id === app.currentPlotId ? " active" : ""));
            const head = el("div", "gc-head");
            const nm = el("span", "gc-name");
            nm.textContent = (pl.name ?? humanize(pl.id)) + (pl.id === def ? " (default)" : "");
            head.appendChild(nm);
            const anchor = pl.anchor;
            if (anchor) {
                const zone = resolveZone(anchor.lat, anchor.lon, bundle);
                if (zone && zone.zone != null) {
                    const z = el("span", "gc-zone");
                    z.textContent = `zone ${zone.label ?? zone.zone}`;
                    head.appendChild(z);
                }
                card.appendChild(head);
                const loc = localityBit(pl);
                if (loc) {
                    const w = el("div", "gc-where");
                    w.textContent = loc;
                    card.appendChild(w);
                }
                const site = resolveClimate(anchor.lat, anchor.lon, bundle)?.site;
                const lf = fmtMD(site?.last_frost_32f?.p50);
                const ff = fmtMD(site?.first_freeze_32f_p50);
                const line = el("div", "gc-frost");
                if (lf || ff) {
                    const days = site?.growing_season_days_p50;
                    line.textContent = `last frost ~${lf ?? "?"} → first freeze ~${ff ?? "?"}${days ? ` · ~${days} frost-free days` : ""}`;
                }
                else {
                    line.textContent = "no nearby frost station - hardiness zone only";
                    line.classList.add("muted");
                }
                card.appendChild(line);
            }
            else {
                card.appendChild(head);
                const line = el("div", "gc-frost muted");
                line.textContent = "location not set yet";
                card.appendChild(line);
            }
            if (pl.id !== app.currentPlotId)
                card.addEventListener("click", () => void activatePlot(pl.id));
            wrap.appendChild(card);
        }
        host.appendChild(wrap);
    };
    // D-106 slice 2: a rename control (garden or bed) - a link that swaps to an input + save. The save
    // op stamps the plot (and cascaded seasons), so the new name rides the sync to every device.
    const mkRename = (label, current, save) => {
        const btn = el("button", "linky");
        btn.type = "button";
        btn.textContent = label;
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = current;
            inp.setAttribute("aria-label", label);
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = "save";
            const go = () => void (async () => {
                try {
                    await save(inp.value);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                }
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    // Delete THIS garden (O20 / D-166). The typed confirmation is the garden's own NAME - it
    // confirms WHICH garden, which a fixed phrase cannot - and a wrong phrase refuses with the
    // reason, deleting nothing. eraseGarden snapshots the plot and every season into the D-125
    // safety net first. An account garden records a deletion marker, so the auto-sync removes the
    // account rows and every other device applies the same deletion (a deliberate re-creation
    // still wins - sync.ts). A draft never synced, so it just goes. The example garden keeps its
    // own one-tap teardown and never shows this control.
    const mkDeleteGarden = (plot) => {
        const name = plot?.name ?? humanize(app.currentPlotId);
        const btn = el("button", "linky gardendelete");
        btn.type = "button";
        btn.textContent = "Delete this garden…";
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = `type "${name}" to confirm`;
            inp.setAttribute("aria-label", "type the garden's name to confirm deleting it");
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = "delete";
            const go = () => void (async () => {
                if (inp.value.trim() !== name) {
                    msg(`nothing was deleted - type the garden's own name, "${name}", to confirm.`, true);
                    return;
                }
                const id = app.currentPlotId;
                const account = plot?.owner === "account";
                const { seasons } = await eraseGarden(db, id, { tombstone: account });
                msg(`Deleted "${name}"${seasons ? ` and its ${seasons} season${seasons === 1 ? "" : "s"}` : ""} - a safety copy stays on this device${account ? ", and the deletion syncs to your account's other devices" : ""}.`);
                const left = (await listPlots(db)).filter((p) => !p.example);
                await activatePlot(left[0]?.id ?? defaultWorkspacePlotId());
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    // Drill-down continuity (D-126): refresh() rebuilds the bed cards, which used to close every
    // card and drop the tapped-plant selection - so even a SUCCESSFUL action snapped the view shut
    // with no confirmation and read as "the buttons do nothing." Open cards and the selected plant
    // now survive a refresh; every action also says what it did (msg).
    const openCards = new Set();
    let reselect = null;
    // Calendar deep-link (D-127): one-shot "open this species' panel on this bed" applied by the
    // next renderBedDiagram, so a calendar event lands the user ON the thing it talks about.
    let openSpecies = null;
    app.openLogBed = (bedName, species) => {
        openCards.add(bedName);
        openSpecies = species ? { bed: bedName, species } : null;
        location.hash = "#/log";
        void refresh();
    };
    const renderLocations = (seasons, beds, plot, allPlots) => {
        const host = $("loglocations");
        host.innerHTML = "";
        const head = el("div", "loc-head");
        // With more than one garden the Log gets its OWN switcher (walkthrough round 21): before, gardens
        // could only be changed on the Plan tab - "easy to miss, get confused." Switching here routes
        // through activatePlot, so the Log re-reads the new garden's ledger and its location follows. A
        // "default garden" toggle sets which garden sign-in opens (defaultPlotId). One garden → just the name.
        if (allPlots.length > 1) {
            const sel = document.createElement("select");
            sel.className = "garden-sel";
            sel.setAttribute("aria-label", "garden");
            const def = defaultPlotId();
            for (const pl of allPlots) {
                const o = document.createElement("option");
                o.value = pl.id;
                o.textContent = (pl.name ?? humanize(pl.id)) + (pl.id === def ? " (default)" : "") + (pl.shared ? ` (${copy.teamsSharedTag})` : "");
                sel.appendChild(o);
            }
            sel.value = app.currentPlotId;
            sel.addEventListener("change", () => void activatePlot(sel.value));
            head.appendChild(sel);
            const isDef = def === app.currentPlotId;
            const star = el("button", "garden-def" + (isDef ? " on" : ""));
            star.type = "button";
            star.textContent = isDef ? "default garden" : "set as default";
            star.title = isDef
                ? "this garden opens when you sign in - tap to clear"
                : "make this the garden that opens when you sign in";
            star.addEventListener("click", () => { setDefaultPlot(isDef ? null : app.currentPlotId); void refresh(); });
            head.appendChild(star);
        }
        else {
            const name = el("span", "loc-name");
            name.textContent = plot?.name ?? humanize(app.currentPlotId);
            head.appendChild(name);
        }
        const sub = el("span", "loc-sub");
        sub.textContent = `${beds.length} bed${beds.length === 1 ? "" : "s"}`;
        head.appendChild(sub);
        // rename THIS garden (D-106 slice 2): the name is display only; the plot id is stable.
        // A SHARED garden (D-172) is someone else's - the member does not rename or delete it (that
        // belongs to the owner); they leave the team instead. It gets a plain "shared" tag.
        if (plot?.shared) {
            const tag = el("span", "loc-shared");
            tag.textContent = copy.teamsSharedTag;
            head.appendChild(tag);
        }
        else {
            head.appendChild(mkRename("Rename garden", plot?.name ?? humanize(app.currentPlotId), (v) => setPlotName(db, app.currentPlotId, v)));
            if (app.currentPlotId !== EXAMPLE_PLOT_ID)
                head.appendChild(mkDeleteGarden(plot));
        }
        host.appendChild(head);
        // Say WHERE this garden is (walkthrough #1): its name alone ("Home") didn't tell you the location
        // on login. The address if we captured it, else the nearest locality + zone + coordinates.
        const where = locationLabel(plot);
        if (where) {
            const w = el("p", "loc-where");
            w.textContent = where;
            host.appendChild(w);
        }
        if (!seasons.length && !beds.length) {
            const hint = el("p", "hint");
            hint.textContent = "No beds yet - create one on the Plan tab (trace or size it on the map). It then shows here with its status each season.";
            host.appendChild(hint);
            return;
        }
        // The viewed season: default the newest; a stale selection (e.g. after a reactivate) falls back.
        const latestId = seasons.length ? seasons[seasons.length - 1].id : null;
        if (viewedYear == null || !seasons.some((s) => s.id === viewedYear))
            viewedYear = latestId;
        const season = seasons.find((s) => s.id === viewedYear) ?? null;
        const closed = !!season?.closed_date;
        const readOnly = closed; // a closed past season is review-only; reopen to amend.
        // P2.1 de-box: the season RIBBON - a chip per season, tap to view (was a dropdown). The viewed
        // season is marked; a chip states closed/tracking. The row scrolls sideways when a ground carries
        // many seasons, so it still scales like the dropdown did. Same viewedYear + refresh() wiring.
        if (seasons.length) {
            const years = el("div", "years");
            const lbl = el("span", "years-lbl");
            lbl.textContent = "Season";
            years.appendChild(lbl);
            const ribbon = el("div", "seasonribbon");
            ribbon.setAttribute("role", "tablist");
            ribbon.setAttribute("aria-label", "season year");
            for (const s of [...seasons].sort((a, b) => b.id - a.id)) {
                const on = s.id === viewedYear;
                const chip = el("button", `seasonchip${on ? " on" : ""}`);
                chip.type = "button";
                chip.setAttribute("role", "tab");
                chip.setAttribute("aria-selected", on ? "true" : "false");
                const yr = el("span", "seasonchip-y");
                yr.textContent = String(s.id);
                chip.appendChild(yr);
                const state = s.closed_date ? "closed" : s.id === latestId ? "tracking" : null;
                if (state) {
                    const sub = el("span", "seasonchip-s");
                    sub.textContent = state;
                    chip.appendChild(sub);
                }
                chip.addEventListener("click", () => { viewedYear = s.id; void refresh(); });
                ribbon.appendChild(chip);
            }
            years.appendChild(ribbon);
            if (readOnly) {
                const ro = el("span", "ro-note");
                ro.textContent = "history · read-only";
                years.appendChild(ro);
            }
            host.appendChild(years);
        }
        if (!season) {
            const p = el("p", "hint");
            p.textContent = "No season started for this address yet. Start one to record what you plant and the frosts this ground sees.";
            const year = new Date().getFullYear();
            const btn = el("button", "primary");
            btn.type = "button";
            btn.textContent = `Start season ${year}`;
            const out = el("span", "hint");
            btn.addEventListener("click", () => void (async () => {
                try {
                    if (!(await getSeason(db, app.currentPlotId, year)))
                        await putSeason(db, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                    viewedYear = year;
                    await refresh();
                }
                catch (e) {
                    out.textContent = " " + (e instanceof Error ? e.message : String(e));
                    out.className = "why";
                }
            })());
            const row = el("p");
            row.append(btn, out);
            host.append(p, row);
            return;
        }
        // Shared close controls (open season only) - annuals end by this cause + date; perennials carry.
        // Built here so both a per-bed "Close bed" and the season roll read them, but placed down in the
        // season foot (not at the top) so the location view stays calm: header → year → cards.
        let causeSel;
        let dateInp;
        let closeCtrl;
        if (!readOnly) {
            closeCtrl = el("div", "logrow closerow");
            const lbl = el("label");
            lbl.textContent = "At close, annuals end by";
            causeSel = document.createElement("select");
            causeSel.setAttribute("aria-label", "close end cause");
            for (const v of END_CAUSES) {
                const o = document.createElement("option");
                o.value = v;
                o.textContent = humanize(v);
                causeSel.appendChild(o);
            }
            causeSel.value = "pulled";
            const on = el("label");
            on.textContent = "on";
            dateInp = document.createElement("input");
            dateInp.type = "date";
            dateInp.value = today;
            dateInp.setAttribute("aria-label", "close date");
            closeCtrl.append(lbl, causeSel, on, dateInp);
        }
        // Bed cards.
        // --- slice B: the drill-down EDIT actions, in the card (open, editable seasons only) -----------
        const seasonId = season.id;
        // Config-collective model (maintainer's reframe): a bed's plants come from its CONFIGURATION on
        // the Plan tab, shown here as growing collectively - no free-form per-plant editing on the Log. The
        // one kept per-bed action is a lightweight FAILURE note (so disease/pest data isn't lost). `remove`
        // is kept only for legacy strays not in any current bed (the orphan section below).
        const doRemove = async (idx, species) => {
            try {
                await removePlanting(db, app.currentPlotId, seasonId, idx);
                said(`Removed ${commonName(bundle, species)}`);
                await refresh();
            }
            catch (e) {
                msg(String(e instanceof Error ? e.message : e), true);
            }
        };
        // Coarse end_cause (closed vocab) inferred from a free-text failure mode, for a note that killed
        // the plant. The exact "what" stays in the note; this only buckets it for rotation/analysis, and
        // falls back to "unknown" rather than guessing.
        const endCauseFromMode = (mode) => {
            const m = mode.toLowerCase();
            if (/frost|freeze|frozen|cold|hail/.test(m))
                return "frost";
            if (/drought|dry|under.?water|heat|scorch/.test(m))
                return "drought";
            if (/slug|snail|aphid|beetle|bug|caterpillar|worm|borer|mite|deer|rabbit|vole|gopher|pest|animal|bird|squirrel|groundhog/.test(m))
                return "pest";
            if (/blight|rot|mildew|mould|mold|wilt|rust|fung|virus|leaf.?spot|scab|canker|damping|smut|anthracnose|disease/.test(m))
                return "disease";
            return "unknown";
        };
        // Visual bed on the Log (walkthrough): a read-only diagram of the bed with a dot per PLANT at its
        // real position - tap one to note it, mark it died, or replace it (a new plant in that spot). It is
        // tap-to-select, never drag (D-078 stays intact - the Configurable Bed is still the only canvas);
        // tapping solves "which of the 40 corn?" that the bulk note can't. Actions operate on that one
        // planting; "replace" ends the old plant (kept as history with its notes) and adds the new one on
        // the same ground. Open season only.
        const SVG_NS = "http://www.w3.org/2000/svg";
        const plantPanel = (host, idx, bedName) => {
            host.innerHTML = "";
            const p = (season.plantings ?? [])[idx];
            if (!p)
                return;
            const head = el("div", "pp-head");
            // The plant's name opens its card. A LINK, not a button: this panel is already dense with
            // buttons that WRITE (edit, end it, replace), and a control that merely navigates must not
            // look like one that changes data. The group the gardener actually chose rides the href -
            // a determinate tomato and an indeterminate one differ in every number on the card.
            const nm = plantLink(commonName(bundle, p.species), p.species, p.cultivar_group ?? null);
            const st = el("span", "pmeta");
            st.textContent = p.end_cause ? ` · ended (${humanize(p.end_cause).toLowerCase()}${p.end_date ? ` ${p.end_date}` : ""})`
                : p.carried_over ? " · overwinters" : " · growing";
            const fails = (p.failures ?? []).map((f) => `${humanize(f.mode).toLowerCase()} (${f.severity})`);
            if (fails.length) {
                const fm = el("span", "pmeta");
                fm.textContent = ` · suffered ${fails.join(", ")}`;
                head.append(nm, st, fm);
            }
            else
                head.append(nm, st);
            host.appendChild(head);
            // one strip on the plant, newest first (O6/D-171): every photo this plant's notes name
            const shots = (p.notes ?? []).filter((n) => n.photo)
                .sort((a, b) => b.date.localeCompare(a.date));
            if (shots.length) {
                const strip = el("div", "photostrip");
                for (const n of shots) {
                    const img = document.createElement("img");
                    img.className = "photothumb";
                    img.loading = "lazy";
                    img.alt = `photo ${n.date} · ${n.text}`;
                    img.addEventListener("click", () => img.classList.toggle("photobig"));
                    photoInto(img, seasonId, n.photo);
                    strip.appendChild(img);
                }
                host.appendChild(strip);
            }
            if (readOnly)
                return;
            // ONE action per plant (D-126, maintainer): the four sibling buttons (Note / Replace /
            // Edit / Delete) overlapped - Note vs Edit blurred, Replace vs Delete blurred - and the
            // note form's save button carried an emoji label the D-105 sweep emptied, so it rendered
            // INVISIBLE: notes could not be saved at all. Now a single Edit opens one panel holding
            // everything - the record's fields, a dated note, replace, reopen, delete - each action on
            // a LABELLED button that says what it did (msg) and keeps the drill-down open (reselect).
            const speciesOpts = () => [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
                ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])]
                .sort((a, b) => a[1].localeCompare(b[1]));
            const stay = (i2) => { reselect = i2 === null ? null : { bed: bedName, idx: i2 }; };
            const editPanel = () => {
                const f = el("div", "editform");
                const section = (title) => {
                    const s = el("div", "editsec");
                    const h = el("p", "editsec-h");
                    h.textContent = title;
                    s.appendChild(h);
                    f.appendChild(s);
                    return s;
                };
                const btn = (label, cls = "linky") => {
                    const b2 = el("button", cls);
                    b2.type = "button";
                    b2.textContent = label;
                    return b2;
                };
                // 1 - the record itself (species + dated milestones + yield): a wrong entry is the
                // user's to fix; the correction rides the season sync to every device (D-106).
                const rec = section("The record");
                const pick = document.createElement("select");
                pick.setAttribute("aria-label", "species");
                for (const [id, name] of speciesOpts()) {
                    const o = document.createElement("option");
                    o.value = id;
                    o.textContent = name;
                    if (id === p.species)
                        o.selected = true;
                    pick.appendChild(o);
                }
                const dateRow = (label, val) => {
                    const w = el("label", "editrow");
                    const inp = document.createElement("input");
                    inp.type = "date";
                    inp.value = val ?? "";
                    inp.setAttribute("aria-label", label);
                    w.append(document.createTextNode(label + " "), inp);
                    return [w, inp];
                };
                const [sw, si] = dateRow("sown", p.sown);
                const [tw, ti] = dateRow("transplanted", p.transplanted);
                const [fw, fi] = dateRow("first harvest", p.first_harvest);
                const [lw, li] = dateRow("last harvest", p.last_harvest);
                const yw = el("label", "editrow");
                const yi = document.createElement("input");
                yi.type = "number";
                yi.min = "0";
                yi.step = "0.1";
                yi.value = p.yield_kg != null ? String(p.yield_kg) : "";
                yi.setAttribute("aria-label", "yield kg");
                yw.append(document.createTextNode("yield kg "), yi);
                const saveRec = btn("save changes");
                saveRec.addEventListener("click", () => void (async () => {
                    try {
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, {
                            species: pick.value,
                            sown: si.value || undefined, transplanted: ti.value || undefined,
                            first_harvest: fi.value || undefined, last_harvest: li.value || undefined,
                            yield_kg: yi.value ? Number(yi.value) : undefined,
                        });
                        said(`Updated ${commonName(bundle, pick.value)}`);
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                rec.append(pick, sw, tw, fw, lw, yw, saveRec);
                // 2 - a dated note on THIS plant (what happened), optionally fatal
                if (!p.end_cause) {
                    const note = section("Note what happened");
                    const mode = document.createElement("input");
                    mode.type = "text";
                    mode.placeholder = "what (e.g. slugs)";
                    mode.setAttribute("aria-label", "failure mode");
                    const sev = document.createElement("select");
                    sev.setAttribute("aria-label", "severity");
                    for (const v of FAILURE_SEVERITIES) {
                        const o = document.createElement("option");
                        o.value = v;
                        o.textContent = v;
                        sev.appendChild(o);
                    }
                    const dt = document.createElement("input");
                    dt.type = "date";
                    dt.value = today;
                    dt.setAttribute("aria-label", "date");
                    const diedL = el("label", "faildied");
                    const died = document.createElement("input");
                    died.type = "checkbox";
                    diedL.append(died, document.createTextNode(" and it died"));
                    const saveNote = btn("save note");
                    saveNote.addEventListener("click", () => void (async () => {
                        if (!mode.value.trim()) {
                            msg("name what went wrong (e.g. slugs).", true);
                            return;
                        }
                        try {
                            await addFailure(db, app.currentPlotId, seasonId, idx, { date: dt.value, mode: mode.value.trim(), severity: sev.value });
                            if (died.checked)
                                await endPlanting(db, app.currentPlotId, seasonId, idx, endCauseFromMode(mode.value.trim()), dt.value);
                            said(`Noted "${mode.value.trim()}" on ${commonName(bundle, p.species)}${died.checked ? " - marked died" : ""}`);
                            stay(idx);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    note.append(document.createTextNode("suffered "), mode, sev, dt, diedL, saveNote);
                }
                // 2b - a photo of THIS plant (O6/D-171): downscaled on capture (longest edge 1600 px,
                // ~250 KB, the original never kept), stored on THIS DEVICE, named in the season file and
                // zipped beside the export. Lands as a dated note whose photo field carries the filename -
                // a photo is a note that shows instead of tells. Allowed on an ended plant too: the
                // damage photo is half the point. The engine never reads it (D-171).
                const ph = section("Add a photo");
                const file = document.createElement("input");
                file.type = "file";
                file.accept = "image/*";
                file.setAttribute("capture", "environment");
                file.setAttribute("aria-label", "photo");
                const cap = document.createElement("input");
                cap.type = "text";
                cap.placeholder = "caption (optional)";
                cap.setAttribute("aria-label", "photo caption");
                const [pw, pi] = dateRow("taken", today);
                const savePh = btn("save photo");
                savePh.addEventListener("click", () => void (async () => {
                    const f = file.files?.[0];
                    if (!f) {
                        msg("choose or take a photo first.", true);
                        return;
                    }
                    try {
                        const blob = await downscalePhoto(f);
                        const taken = new Set((season.plantings ?? [])
                            .flatMap((q) => (q.notes ?? []).map((n) => n.photo))
                            .filter((x) => !!x));
                        const name = mintPhotoName(pi.value || today, taken);
                        await putPhoto(db, app.currentPlotId, seasonId, name, blob);
                        await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: pi.value || today, text: cap.value.trim() || "Photo", photo: name });
                        said(`Photo saved on ${commonName(bundle, p.species)} - it stays on this device and rides the export.`);
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        // the D-171 quota promise: when the device refuses the write, say so in words -
                        // the photo is not saved, and nothing pretends otherwise
                        const full = e instanceof DOMException && e.name === "QuotaExceededError";
                        msg(full ? "this device's storage is full - the photo was not saved. Free some space and try again."
                            : `could not save the photo: ${String(e instanceof Error ? e.message : e)}`, true);
                    }
                })());
                ph.append(file, cap, pw, savePh);
                // 3 - replace: ends this plant (kept in history with its notes) and plants a new one
                // on the same ground; for an already-ended plant it simply plants the successor there
                const rep = section(p.end_cause ? "Plant something new in this spot" : "Replace with a new plant (this one ends, kept in history)");
                const pick2 = document.createElement("select");
                pick2.setAttribute("aria-label", "replace with which plant");
                for (const [id, name] of speciesOpts()) {
                    const o = document.createElement("option");
                    o.value = id;
                    o.textContent = name;
                    pick2.appendChild(o);
                }
                const repGo = btn(p.end_cause ? "plant it" : "replace");
                repGo.addEventListener("click", () => void (async () => {
                    try {
                        if (!p.end_cause)
                            await endPlanting(db, app.currentPlotId, seasonId, idx, "pulled", today); // old kept as history
                        // sown=today: this successor is going in the ground now, so it carries a real plant date -
                        // the Calendar's log-anchored recs (D-134) need one, or the new plant shows no harvest date.
                        const after = await addPlanting(db, app.currentPlotId, seasonId, { species: pick2.value, region: parseRegionSnapshot(p.region), sown: today });
                        said(`${commonName(bundle, pick2.value)} planted where the ${commonName(bundle, p.species).toLowerCase()} was`);
                        stay((after.plantings ?? []).length - 1);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                rep.append(pick2, repGo);
                // 4 - an ended plant can be marked growing again (a wrong end is the user's to undo)
                if (p.end_cause) {
                    const re = section("Marked ended by mistake?");
                    const reopen = btn("mark it growing again");
                    reopen.addEventListener("click", () => void (async () => {
                        try {
                            await updatePlanting(db, app.currentPlotId, seasonId, idx, { end_cause: undefined, end_date: undefined });
                            said(`${commonName(bundle, p.species)} is growing again`);
                            stay(idx);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    }));
                    re.appendChild(reopen);
                }
                // 5 - delete drops the record AND its occupancy: two-tap confirm, at the very bottom
                const danger = section("Remove the record entirely");
                const delBtn = btn("delete this record", "linky danger");
                let armed = false;
                delBtn.addEventListener("click", () => void (async () => {
                    if (!armed) {
                        armed = true;
                        delBtn.textContent = "delete - tap again to confirm";
                        delBtn.classList.add("arm");
                        setTimeout(() => { armed = false; delBtn.textContent = "delete this record"; delBtn.classList.remove("arm"); }, 4000);
                        return;
                    }
                    stay(null);
                    await doRemove(idx, p.species);
                })());
                danger.appendChild(delBtn);
                return f;
            };
            const acts = el("div", "pp-acts");
            const editBtn = el("button", "linky");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", () => { acts.replaceWith(editPanel()); });
            acts.appendChild(editBtn);
            host.appendChild(acts);
        };
        // Per-species panel (walkthrough): reached by tapping a legend CHIP (not an on-canvas bubble - those
        // overlapped when species interplant). Records a note across N of its M living plants at once - or,
        // ticked "died", ends exactly those N (per-plant fidelity kept, entered in bulk). Scoped to THIS
        // species on THIS bed. The canvas always shows individuals; the chip is the bulk surface.
        const speciesPanel = (host, species, onBed) => {
            host.innerHTML = "";
            const all = onBed.filter(([q]) => q.species === species);
            const living = all.filter(([q]) => !q.end_cause);
            const ended = all.length - living.length;
            const head = el("div", "pp-head");
            // The name links, the count does not. `.pname` is the accent-coloured link class, and a span
            // wearing it was a name that LOOKED tappable and was not - the third staging walk's "hard to
            // tell which name is linked" was three of these, not too few links.
            const nm = plantLink(commonName(bundle, species), species);
            const st = el("span", "pmeta");
            st.textContent = ` ×${all.length}`
                + (ended ? ` · ${living.length} growing · ${ended} ended` : ` · ${living.length} growing`);
            head.append(nm, st);
            host.appendChild(head);
            const acts = el("div", "pp-acts");
            if (!readOnly && living.length) {
                const noteBtn = el("button", "linky");
                noteBtn.type = "button";
                noteBtn.textContent = "Note / died";
                noteBtn.addEventListener("click", () => {
                    const f = el("div", "failform");
                    const mode = document.createElement("input");
                    mode.type = "text";
                    mode.placeholder = "what (e.g. slugs)";
                    mode.setAttribute("aria-label", "failure mode");
                    const sev = document.createElement("select");
                    sev.setAttribute("aria-label", "severity");
                    for (const v of FAILURE_SEVERITIES) {
                        const o = document.createElement("option");
                        o.value = v;
                        o.textContent = v;
                        sev.appendChild(o);
                    }
                    const dt = document.createElement("input");
                    dt.type = "date";
                    dt.value = today;
                    dt.setAttribute("aria-label", "date");
                    const cntWrap = el("span", "failcount");
                    const cnt = document.createElement("input");
                    cnt.type = "number";
                    cnt.min = "1";
                    cnt.max = String(living.length);
                    cnt.value = String(living.length);
                    cnt.setAttribute("aria-label", "how many plants affected");
                    cntWrap.append(document.createTextNode("- "), cnt, document.createTextNode(` of ${living.length}`));
                    const diedL = el("label", "faildied");
                    const died = document.createElement("input");
                    died.type = "checkbox";
                    diedL.append(died, document.createTextNode(" and they died"));
                    // labelled save (D-126): the old label was an emoji the D-105 sweep emptied - the
                    // button rendered invisible, so bulk notes could not be saved at all
                    const ok = el("button", "linky");
                    ok.type = "button";
                    ok.textContent = "save note";
                    ok.addEventListener("click", () => void (async () => {
                        if (!mode.value.trim()) {
                            msg("name what went wrong (e.g. slugs).", true);
                            return;
                        }
                        const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                        const fail = { date: dt.value, mode: mode.value.trim(), severity: sev.value };
                        const cause = died.checked ? endCauseFromMode(fail.mode) : null;
                        try {
                            for (const [, idx] of living.slice(0, wantN)) {
                                await addFailure(db, app.currentPlotId, seasonId, idx, fail);
                                if (cause)
                                    await endPlanting(db, app.currentPlotId, seasonId, idx, cause, fail.date); // ended, note kept
                            }
                            said(`Noted "${fail.mode}" on ${wantN} ${commonName(bundle, species)}${died.checked ? " - marked died" : ""}`);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    f.append(document.createTextNode("suffered "), mode, sev, dt, cntWrap, diedL, ok);
                    noteBtn.replaceWith(f);
                });
                acts.appendChild(noteBtn);
                // Blanket-apply the RECORD fields across the species (maintainer): the same data options the
                // single-plant Edit panel offers - species, the dated milestones, yield - set once for all N
                // living plants of this species, since a whole sowing usually shares them. Only a field the
                // user actually fills is written (a blank leaves each plant's own value), and any value all
                // the living plants already share is prefilled, so this reads as "adjust the common value."
                const detailsBtn = el("button", "linky");
                detailsBtn.type = "button";
                detailsBtn.textContent = "Update details";
                detailsBtn.addEventListener("click", () => {
                    const f = el("div", "editform");
                    const sec = el("div", "editsec");
                    // O46: the crop this bulk editor is about links. The heading names one plant and this
                    // panel is three taps deep, so the reader here has already committed to that plant.
                    const h = el("p", "editsec-h");
                    const bulkName = commonName(bundle, species);
                    linkNameIn(h, `Update all ${bulkName} at once`, bulkName, species);
                    sec.appendChild(h);
                    // the value every living plant shares for a field, else "" (nothing common to prefill)
                    const shared = (get) => {
                        const vals = new Set(living.map(([q]) => get(q) ?? ""));
                        return vals.size === 1 ? [...vals][0] : "";
                    };
                    const pick = document.createElement("select");
                    pick.setAttribute("aria-label", "species");
                    for (const [id, name] of [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
                        ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])].sort((a, b) => a[1].localeCompare(b[1]))) {
                        const o = document.createElement("option");
                        o.value = id;
                        o.textContent = name;
                        if (id === species)
                            o.selected = true;
                        pick.appendChild(o);
                    }
                    const dateRow = (label, val) => {
                        const w = el("label", "editrow");
                        const inp = document.createElement("input");
                        inp.type = "date";
                        inp.value = val;
                        inp.setAttribute("aria-label", label);
                        w.append(document.createTextNode(label + " "), inp);
                        return [w, inp];
                    };
                    const [sw, si] = dateRow("sown", shared((p) => p.sown));
                    const [tw, ti] = dateRow("transplanted", shared((p) => p.transplanted));
                    const [fw, fi] = dateRow("first harvest", shared((p) => p.first_harvest));
                    const [lw, li] = dateRow("last harvest", shared((p) => p.last_harvest));
                    const yw = el("label", "editrow");
                    const yi = document.createElement("input");
                    yi.type = "number";
                    yi.min = "0";
                    yi.step = "0.1";
                    yi.value = shared((p) => p.yield_kg != null ? String(p.yield_kg) : "");
                    yi.setAttribute("aria-label", "yield kg each");
                    yw.append(document.createTextNode("yield kg (each) "), yi);
                    const cntWrap = el("span", "failcount");
                    const cnt = document.createElement("input");
                    cnt.type = "number";
                    cnt.min = "1";
                    cnt.max = String(living.length);
                    cnt.value = String(living.length);
                    cnt.setAttribute("aria-label", "how many plants to update");
                    cntWrap.append(document.createTextNode("apply to "), cnt, document.createTextNode(` of ${living.length}`));
                    const ok2 = el("button", "linky");
                    ok2.type = "button";
                    ok2.textContent = "apply to all";
                    const sync = () => { ok2.textContent = `apply to ${Math.max(1, Math.min(living.length, Number(cnt.value) || 1))}`; };
                    cnt.addEventListener("input", sync);
                    ok2.addEventListener("click", () => void (async () => {
                        const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                        // only fields the user actually set enter the patch - a blank never wipes a plant's own value
                        const patch = {};
                        if (pick.value !== species)
                            patch.species = pick.value;
                        if (si.value)
                            patch.sown = si.value;
                        if (ti.value)
                            patch.transplanted = ti.value;
                        if (fi.value)
                            patch.first_harvest = fi.value;
                        if (li.value)
                            patch.last_harvest = li.value;
                        if (yi.value)
                            patch.yield_kg = Number(yi.value);
                        if (!Object.keys(patch).length) {
                            msg("nothing to update - fill a field first.", true);
                            return;
                        }
                        try {
                            for (const [, idx] of living.slice(0, wantN))
                                await updatePlanting(db, app.currentPlotId, seasonId, idx, patch);
                            const label = pick.value !== species ? commonName(bundle, pick.value) : commonName(bundle, species);
                            said(`Updated ${wantN} ${label}`);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    sec.append(pick, sw, tw, fw, lw, yw, cntWrap, ok2);
                    f.appendChild(sec);
                    detailsBtn.replaceWith(f);
                });
                acts.appendChild(detailsBtn);
            }
            host.appendChild(acts);
        };
        // Visual bed (walkthrough rework): individual plants ONLY. On-canvas clusters are gone - they
        // overlapped when species interplant (three sisters puts every centroid in the middle). Species-level
        // actions moved to the LEGEND below (tappable chips). The bed sits in a capped-height, natively
        // scrollable box: at fit it doesn't trap the page scroll; the +/-/⤢ buttons scale it, and zoomed in
        // you pan by scrolling the box. No gesture pan/pinch, so a swipe scrolls the Log (walkthrough).
        const renderBedDiagram = (host, bed, onBedIdx) => {
            if (!onBedIdx.length)
                return;
            const pts = regionPoints(bed.region);
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            const minX = Math.min(...xs), minY = Math.min(...ys);
            const bw = Math.max(Math.max(...xs) - minX, 0.3), bh = Math.max(Math.max(...ys) - minY, 0.3);
            const PX = 240, scale = PX / Math.max(bw, bh), W = bw * scale, H = bh * scale;
            const sx = (x) => (x - minX) * scale;
            const sy = (y) => H - (y - minY) * scale; // plot y is up; SVG y is down
            const species = [...new Set(onBedIdx.map(([q]) => q.species))];
            const colorOf = new Map();
            species.forEach((sp, i) => colorOf.set(sp, PLANT_DOTS[i % PLANT_DOTS.length]));
            const wrap = el("div", "beddiagram");
            const scroller = el("div", "bd-scroll");
            const svg = document.createElementNS(SVG_NS, "svg");
            svg.setAttribute("class", "bd-svg");
            // a SQUARE viewBox centred on the bed (no dead space beside a non-square bed). The svg's rendered
            // WIDTH is what the zoom buttons scale (100% × zoom), so it grows past the scroll box and pans.
            const PAD = 8, side = Math.max(W, H);
            svg.setAttribute("viewBox", `${(W - side) / 2 - PAD} ${(H - side) / 2 - PAD} ${side + 2 * PAD} ${side + 2 * PAD}`);
            let zoom = 1;
            const applyZoom = () => { svg.style.width = `${zoom * 100}%`; };
            const outline = document.createElementNS(SVG_NS, "polygon");
            outline.setAttribute("points", pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" "));
            outline.setAttribute("class", "bd-outline");
            svg.appendChild(outline);
            // one dot per PLANT at its real spot; ended = hollow + dashed. Sizes are in viewBox units, so they
            // scale up with the svg as you zoom (bigger, easier to tap in a crowded bed).
            const R = 5.5;
            for (const [q, i] of onBedIdx) {
                const [px, py] = regionCentroid(q.region);
                const dot = document.createElementNS(SVG_NS, "circle");
                dot.setAttribute("cx", String(sx(px)));
                dot.setAttribute("cy", String(sy(py)));
                dot.setAttribute("r", String(R));
                const isEnded = !!q.end_cause;
                const col = colorOf.get(q.species);
                dot.setAttribute("fill", isEnded ? "transparent" : col);
                dot.setAttribute("stroke", col);
                dot.setAttribute("stroke-width", isEnded ? "1.6" : "0.8");
                dot.setAttribute("class", "bd-plant" + (isEnded ? " ended" : ""));
                dot.dataset.idx = String(i);
                dot.dataset.species = q.species;
                const t = document.createElementNS(SVG_NS, "title");
                t.textContent = `${commonName(bundle, q.species)}${isEnded ? ` - ended (${q.end_cause})` : ""}`;
                dot.appendChild(t);
                svg.appendChild(dot);
            }
            applyZoom();
            scroller.appendChild(svg);
            const panel = el("div", "plantpanel");
            const hint = el("p", "hint");
            hint.textContent = readOnly
                ? "Tap a plant to see it. Tap a species chip below to see all of it. +/− to zoom, ⤢ to reset."
                : "Tap a plant, then Edit - note it, fix its record, replace it, or remove it. Tap a species chip below to act on the whole species. +/− to zoom, ⤢ to reset.";
            panel.appendChild(hint);
            const clearSel = () => { for (const d of svg.querySelectorAll(".bd-plant.sel"))
                d.classList.remove("sel"); };
            const highlight = (sp) => {
                for (const d of svg.querySelectorAll(".bd-plant"))
                    d.classList.toggle("dim", !!sp && d.dataset.species !== sp);
            };
            // tap a dot -> that one plant (native scroll handles pan, so a drag never fires this)
            svg.addEventListener("click", (e) => {
                const t = e.target;
                if (t instanceof SVGCircleElement && t.dataset.idx !== undefined) {
                    for (const c of legend.querySelectorAll(".bd-chip.hot"))
                        c.classList.remove("hot");
                    clearSel();
                    highlight(null);
                    t.classList.add("sel");
                    plantPanel(panel, Number(t.dataset.idx), bed.name);
                }
            });
            // zoom via buttons only (scroll-first): the box scrolls the page at fit, pans within itself zoomed
            const bar = el("div", "bd-zoom");
            const mkBtn = (txt, label, fn) => {
                const btn = el("button", "linky");
                btn.type = "button";
                btn.textContent = txt;
                btn.setAttribute("aria-label", label);
                btn.addEventListener("click", fn);
                return btn;
            };
            const setZoom = (nz) => {
                zoom = Math.max(1, Math.min(8, nz));
                applyZoom();
                scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2; // keep centred as it grows
                scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
            };
            bar.append(mkBtn("−", "zoom out", () => setZoom(zoom / 1.5)), mkBtn("+", "zoom in", () => setZoom(zoom * 1.5)), mkBtn("⤢", "fit to bed", () => { setZoom(1); clearSel(); highlight(null); for (const c of legend.querySelectorAll(".bd-chip.hot"))
                c.classList.remove("hot"); panel.replaceChildren(hint); }));
            // legend: one chip per species - the bulk surface (no overlap, unlike on-canvas bubbles). Tap a chip
            // to highlight its plants on the bed and open the per-species note/died panel; tap again to clear.
            const legend = el("div", "bd-legend");
            for (const sp of species) {
                const items = onBedIdx.filter(([q]) => q.species === sp);
                const ended = items.filter(([q]) => !!q.end_cause).length;
                const chip = el("button", "bd-chip");
                chip.type = "button";
                chip.dataset.species = sp;
                const sw = el("span", "sw");
                sw.style.background = colorOf.get(sp);
                // O51 (imagery-surfaces ruling): the species' own face on its legend chip - gardeners
                // recognise plants faster than names. The photo sits INSIDE the colour swatch so the
                // palette colour keeps its job (it ties the chip to this bed's dots) as a ring around the
                // face. The 192px built thumb, ~5 KB; a species without a corpus photo - user varieties
                // included - keeps the plain swatch, the same graceful absence as everywhere else.
                const rec = bundle.species.find((s) => s.id === sp);
                if (typeof rec?.image?.artist === "string") {
                    const im = el("img");
                    im.dataset.spotPhoto = sp; // O55: any photo surface is a door to the photo editor
                    im.src = `img/thumbs/${encodeURIComponent(sp)}.webp`;
                    im.alt = "";
                    im.width = 192;
                    im.height = 192;
                    im.loading = "lazy";
                    im.decoding = "async";
                    sw.classList.add("haspic");
                    sw.appendChild(im);
                }
                const nm = el("span", "nm");
                nm.textContent = `${commonName(bundle, sp)} ×${items.length}`;
                const meta = el("span", "pmeta");
                meta.textContent = ended ? ` · ${ended} ended` : "";
                chip.append(sw, nm, meta);
                chip.addEventListener("click", () => {
                    const wasHot = chip.classList.contains("hot");
                    for (const c of legend.querySelectorAll(".bd-chip.hot"))
                        c.classList.remove("hot");
                    clearSel();
                    if (wasHot) {
                        highlight(null);
                        panel.replaceChildren(hint);
                    }
                    else {
                        chip.classList.add("hot");
                        highlight(sp);
                        speciesPanel(panel, sp, onBedIdx);
                    }
                });
                legend.appendChild(chip);
            }
            wrap.append(scroller, bar, legend, panel);
            host.appendChild(wrap);
            // Re-open the tapped plant after an action's refresh (D-126) - one-shot, so a plain
            // rebuild (season switch, sync pull) starts clean.
            if (reselect && reselect.bed === bed.name) {
                const dot = svg.querySelector(`.bd-plant[data-idx="${reselect.idx}"]`);
                if (dot) {
                    dot.classList.add("sel");
                    plantPanel(panel, reselect.idx, bed.name);
                }
                reselect = null;
            }
            // Calendar deep-link (D-127): land on the species the tapped event was about.
            if (openSpecies && openSpecies.bed === bed.name) {
                legend.querySelector(`.bd-chip[data-species="${openSpecies.species}"]`)?.click();
                openSpecies = null;
            }
        };
        const cards = el("div", "cards");
        if (!beds.length) {
            const hint = el("p", "hint");
            hint.textContent = "No beds yet - trace or size one on the Plan tab.";
            cards.appendChild(hint);
        }
        const bedNames = beds.map((x) => x.name);
        for (const b of beds) {
            // ISSUES #12: a sectioned parent is a pure CONTAINER - it bears no plants of its own (the plants
            // live in its sections). Its region geometrically contains those sections, so the plant machinery
            // below would re-count every section's plants against it (double display). Instead render it as a
            // header/grouping card marked "(sections)" - a section count, no plant counts, no plan button.
            const isContainer = bedHasSections(b.name, beds);
            const sectionNames = isContainer ? beds.filter((x) => sectionParentName(x.name, bedNames) === b.name).map((x) => x.name) : [];
            const st = bedSeasonStatus(b.region, season);
            const stateAttr = isContainer ? "dormant"
                : st.closed || (!st.growing && (st.ended || st.carried)) ? "dormant"
                    : st.growing && (st.ended || st.carried) ? "mixed" : st.growing ? "growing" : "ready";
            const card = el("article", "card");
            card.dataset.state = stateAttr;
            const ch = el("div", "card-head");
            const title = el("span", "card-title");
            title.textContent = isContainer ? `${b.name} (sections)` : b.name;
            const dim = el("span", "card-dim");
            dim.textContent = bedShapeLabel(b); // shape as made: round / rotated / traced / size
            const status = el("span", "card-status");
            // built with createElement/textContent like everything else (D-122, security review L2):
            // string-joined innerHTML is one future edit away from interpolating a user-named value
            const stSpan = (cls, text) => { const s = el("span", cls); s.textContent = text; return s; };
            const stParts = [];
            if (isContainer) {
                stParts.push(stSpan("st-end", `divided into ${sectionNames.length} section${sectionNames.length === 1 ? "" : "s"}`));
            }
            else {
                if (st.growing)
                    stParts.push(stSpan("st-grow", `${st.growing} growing`));
                if (st.carried)
                    stParts.push(stSpan("st-over", `${st.carried} overwintering`));
                if (st.ended)
                    stParts.push(stSpan("st-end", `${st.ended} ended`));
                if (!stParts.length)
                    stParts.push(stSpan("st-end", "ready to plant"));
            }
            stParts.forEach((s, i) => { if (i)
                status.appendChild(document.createTextNode(" · ")); status.appendChild(s); });
            const caret = el("span", "card-caret");
            caret.textContent = "▸";
            ch.append(title, dim, status, caret);
            ch.addEventListener("click", () => {
                const open = card.classList.toggle("open");
                if (open)
                    openCards.add(b.name);
                else
                    openCards.delete(b.name);
            });
            card.appendChild(ch);
            if (openCards.has(b.name))
                card.classList.add("open"); // survive the refresh (D-126)
            // Container: a grouping row that points at its section cards. No plant machinery (it has none),
            // no plan button (it is not plannable - configure the sections). Editing its outline is on the map.
            if (isContainer) {
                const detail = el("div", "card-detail");
                const p = el("p", "pmeta");
                p.textContent = sectionNames.length
                    ? `This bed is divided into sections - each is configured on its own card below: ${sectionNames.join(", ")}. Edit the whole bed's outline in “Your ground”.`
                    : "This bed is divided into sections - each is configured on its own card below.";
                detail.appendChild(p);
                card.appendChild(detail);
                cards.appendChild(card);
                continue;
            }
            const onBedIdx = (season.plantings ?? []).map((p, i) => [p, i]).filter(([p]) => plantingOnBed(p.region, b.region));
            // D-135: a DRAFT bed - a plan entry with no occupancy yet. Its guild is planned, hollow on the map
            // and Calendar, but nothing is in the ground until "Mark as planted" writes real plantings.
            const draftEntry = (Array.isArray(season.plan) ? season.plan : [])
                .find((e) => e.area === b.name);
            const draftGuild = !onBedIdx.length && draftEntry?.guild ? bundle.guilds.find((g) => g.id === draftEntry.guild) : undefined;
            const prev = el("div", "preview");
            const groups = new Map();
            for (const [p] of onBedIdx)
                groups.set(p.species, (groups.get(p.species) ?? 0) + 1);
            if (!groups.size) {
                const chip = el("span", "chip empty");
                chip.textContent = draftGuild ? `draft: ${displayName(draftGuild)}` : "ready to plant";
                prev.appendChild(chip);
            }
            [...groups].forEach(([sp, n], i) => {
                const chip = el("span", "chip");
                const dot = el("span", "dot");
                dot.style.background = PLANT_DOTS[i % PLANT_DOTS.length];
                // O46: a bed-preview chip is a SPAN, not a button, so unlike the bed diagram's legend chip
                // it can hold a link - and its name should behave like every other name on this page.
                chip.append(dot, plantLink(commonName(bundle, sp), sp));
                if (n > 1)
                    chip.append(document.createTextNode(` ×${n}`));
                prev.appendChild(chip);
            });
            card.appendChild(prev);
            const detail = el("div", "card-detail");
            const h4 = el("h4");
            h4.textContent = readOnly ? `What grew here in ${season.id}` : "What's growing";
            detail.appendChild(h4);
            if (!onBedIdx.length) {
                const p = el("p", "pmeta");
                p.textContent = draftGuild
                    ? `Draft - ${displayName(draftGuild)} is planned here but not yet in the ground. Mark it planted below when you sow or transplant.`
                    : "This bed is empty - configure its plants on the Plan tab.";
                detail.appendChild(p);
            }
            // Visual bed: tap a plant to note / end / replace it (walkthrough) - the per-plant surface.
            renderBedDiagram(detail, b, onBedIdx);
            const detGroups = new Map();
            for (const [p] of onBedIdx) {
                const k = `${p.species}|${p.cultivar_group ?? ""}`;
                let g = detGroups.get(k);
                if (!g) {
                    g = { species: p.species, group: p.cultivar_group ?? null, n: 0, grow: 0, ended: 0, carried: 0, fails: new Map() };
                    detGroups.set(k, g);
                }
                g.n++;
                if (p.end_cause)
                    g.ended++;
                else if (p.carried_over)
                    g.carried++;
                else
                    g.grow++;
                for (const d of new Set((p.failures ?? []).map((f) => `${humanize(f.mode).toLowerCase()} (${f.severity})`))) {
                    g.fails.set(d, (g.fails.get(d) ?? 0) + 1); // this plant counts once toward each distinct failure it has
                }
            }
            for (const g of detGroups.values()) {
                const row = el("div", "prow");
                const info = el("span");
                // Links, and it carries the group: this row is already keyed by species+group, so the card
                // it opens can be the right cultivar rather than the bare species.
                const nm = plantLink(commonName(bundle, g.species), g.species, g.group);
                const bits = [];
                if (g.group)
                    bits.push(g.group);
                const meta = el("span", "pmeta");
                meta.textContent = (g.n > 1 ? ` ×${g.n}` : "") + (bits.length ? ` · ${bits.join(" · ")}` : "");
                info.append(nm, meta);
                const pill = el("span", "stpill");
                // One pill for the group: the dominant state, or a compact split when the species is mixed.
                const parts = [];
                if (g.grow)
                    parts.push(`${g.grow} growing`);
                if (g.carried)
                    parts.push(`${g.carried} overwinters`);
                if (g.ended)
                    parts.push(`${g.ended} ended`);
                if (g.ended && !g.grow && !g.carried)
                    pill.classList.add("end");
                else if (g.carried && !g.grow && !g.ended)
                    pill.classList.add("over");
                else
                    pill.classList.add("grow");
                pill.textContent = g.n === 1
                    ? (g.ended ? "ended" : g.carried ? "overwinters" : "growing")
                    : parts.join(" · ");
                row.append(info, pill);
                detail.appendChild(row);
                // Notes accumulate PER PLANT over a season, so a species with many hits can carry a long list.
                // Collapse them behind a "N issues" disclosure (native <details>): one glance shows the count,
                // one tap shows the breakdown ("2× blight (severe)"). N is the total plant-incidents, not the
                // number of distinct kinds. The per-plant detail still lives on the tap-bed above.
                if (g.fails.size) {
                    const nIssues = [...g.fails.values()].reduce((a, c) => a + c, 0);
                    const d = el("details", "issues");
                    const sum = document.createElement("summary");
                    sum.textContent = `${nIssues} issue${nIssues === 1 ? "" : "s"}`;
                    d.appendChild(sum);
                    const ul = el("ul", "issuelist");
                    for (const [desc, c] of [...g.fails].sort((a, b) => b[1] - a[1])) {
                        const li = document.createElement("li");
                        li.textContent = `${c}× ${desc}`;
                        ul.appendChild(li);
                    }
                    d.appendChild(ul);
                    detail.appendChild(d);
                }
            }
            // D-135: the draft → planted transition lives here, on the bed it commits. A DRAFT bed (a plan,
            // no occupancy) gets "Mark as planted": it writes the guild's plants as real occupancy, dated to
            // today (adjust any plant's date afterwards, right above), and the bed becomes Planted. An already
            // PLANTED bed (real occupancy) just shows the Planted marker - occupancy IS the record now; to
            // change what's in it, note/replace/remove its plants per-plant in the diagram above.
            if (!readOnly && draftGuild) {
                const stateRow = el("div", "bedstate");
                const badge = el("span", "plantedbadge");
                badge.textContent = "Draft";
                const mark = el("button", "link");
                mark.type = "button";
                mark.textContent = "Mark as planted";
                mark.title = "Write this plan into the ground as of today. You can adjust each plant's date afterwards.";
                const note = el("span", "pmeta");
                note.textContent = " · planned, not yet in the ground";
                stateRow.append(badge, mark, note);
                detail.appendChild(stateRow);
                // A soft callout line for the off-season nudge (D-137) and the cross-year advance offer (D-137).
                const callout = el("p", "pmeta cfg");
                callout.style.display = "none";
                detail.appendChild(callout);
                const site = { lat: plot?.anchor?.lat ?? null, lon: plot?.anchor?.lon ?? null, season_year: season.id };
                let armed = false; // the off-season nudge arms once; a second tap plants anyway
                const plant = async (advancing) => {
                    mark.disabled = true;
                    const res = advancing
                        ? await markBedPlantedAdvancingSeason(b.name, bundle, site)
                        : await markBedPlanted(b.name, bundle, site);
                    if (res.ok) {
                        if (advancing && "seasonId" in res && res.seasonId != null)
                            seasonSel.value = String(res.seasonId);
                        said(`Planted ${res.planted} in “${b.name}” as of today - adjust any date above`);
                        await refresh();
                    }
                    else {
                        mark.disabled = false;
                        msg(res.reason, true);
                    }
                };
                mark.addEventListener("click", () => void (async () => {
                    const now = new Date();
                    // (1) cross-year: OFFER to advance, never automatic (D-137). Call it out with a one-tap action.
                    if (now.getFullYear() !== season.id) {
                        const yr = now.getFullYear();
                        callout.replaceChildren(document.createTextNode(`You’re planting in ${yr}, but the open season is ${season.id}. Starting the ${yr} season keeps this planting's dates in the right year. `));
                        const adv = el("button", "link");
                        adv.type = "button";
                        adv.textContent = `Start ${yr} season & plant here`;
                        adv.addEventListener("click", () => void plant(true));
                        callout.appendChild(adv);
                        callout.style.display = "";
                        return;
                    }
                    // (2) off-season nudge: a soft, non-blocking heads-up. Arm once; the next tap plants anyway (D-137).
                    if (!armed) {
                        const csite = plot?.anchor ? resolveClimate(plot.anchor.lat, plot.anchor.lon, bundle)?.site ?? null : null;
                        const nudge = offSeasonNudge(draftGuild, bundle, csite?.last_frost_32f?.p50 ?? null, csite?.first_freeze_32f_p50 ?? null, now.toISOString().slice(0, 10));
                        if (nudge) {
                            armed = true;
                            // O46: the crops the nudge names link to their cards; its ", and N more" tail names
                            // nothing and so links nothing - the marks stop where the labels do.
                            callout.replaceChildren();
                            linkNamesIn(callout, `${nudge.text} Tap “Mark as planted” again to plant anyway.`, nudge.marks);
                            callout.style.display = "";
                            return;
                        }
                    }
                    // (3) in-season (or armed): plant it.
                    await plant(false);
                })());
            }
            else if (!readOnly && onBedIdx.length) {
                const stateRow = el("div", "bedstate");
                const badge = el("span", "plantedbadge on");
                badge.textContent = "Planted";
                const note = el("span", "pmeta");
                note.textContent = " · in the ground - tap a plant above to note, end, or replace it";
                stateRow.append(badge, note);
                detail.appendChild(stateRow);
                const cfg = el("p", "pmeta cfg");
                cfg.textContent = "Set this bed's plants in “Design your own bed” on the Plan tab - “Edit / plan this bed →” below.";
                detail.appendChild(cfg);
            }
            const acts = el("div", "card-actions");
            const planBtn = el("button", "link");
            planBtn.type = "button";
            planBtn.textContent = readOnly ? "Plan this bed →" : "Edit / plan this bed →";
            planBtn.addEventListener("click", () => {
                const cand = $("candbed");
                if ([...cand.options].some((o) => o.value === b.name)) {
                    cand.value = b.name;
                    cand.dispatchEvent(new Event("change"));
                }
                location.hash = "#/plan";
            });
            acts.appendChild(planBtn);
            // rename THIS bed (D-106 slice 2): cascades to the plan's references across every season
            if (!readOnly)
                acts.appendChild(mkRename("Rename bed", b.name, (v) => renameBed(db, app.currentPlotId, b.name, v)));
            if (!readOnly && st.growing > 0) {
                const cb = el("button", "link");
                cb.type = "button";
                cb.textContent = "Close bed";
                cb.addEventListener("click", () => { if (causeSel && dateInp)
                    void closeBed(season, b, causeSel.value, dateInp.value); });
                acts.appendChild(cb);
            }
            detail.appendChild(acts);
            card.appendChild(detail);
            cards.appendChild(card);
        }
        host.appendChild(cards);
        // Plantings not on ANY current bed - a bed was removed/reshaped, and occupancy survives on the
        // ground (D-002). They belong to no card, so surface them here so a stray/mistaken one can still be
        // removed (preserves the orphan fix now that the flat ledger list is retired this slice).
        const orphans = (season.plantings ?? []).map((p, i) => [p, i])
            .filter(([p]) => !beds.some((b) => plantingOnBed(p.region, b.region)));
        if (orphans.length) {
            const box = el("div", "orphans");
            const h = el("h4");
            h.textContent = "Not in a bed";
            box.appendChild(h);
            for (const [p, idx] of orphans) {
                const row = el("div", "prow");
                const nm = plantLink(commonName(bundle, p.species), p.species, p.cultivar_group ?? null);
                const meta = el("span", "pmeta");
                meta.textContent = ` · ${regionLabel(p.region)}`;
                const info = el("span");
                info.append(nm, meta);
                row.appendChild(info);
                if (!readOnly) {
                    const rm = el("button", "linky");
                    rm.type = "button";
                    rm.textContent = "remove";
                    rm.addEventListener("click", () => void doRemove(idx, p.species));
                    row.appendChild(rm);
                }
                box.appendChild(row);
            }
            host.appendChild(box);
        }
        // Add a bed - beds are drawn on the map, so this jumps to the Plan tab.
        if (!readOnly) {
            const addBed = el("button", "linky addbed");
            addBed.type = "button";
            addBed.textContent = "+ Add a bed on the map";
            addBed.addEventListener("click", () => { location.hash = "#/plan"; });
            host.appendChild(addBed);
        }
        // Season foot: open → close (confirm); closed → reactivate + reopen.
        const foot = el("div", "season-foot");
        if (closed) {
            const t = el("span", "hint");
            t.textContent = `Season ${season.id} closed ${season.closed_date} - the beds are dormant, and what grew here is memory for next year.`;
            const next = el("button", "primary");
            next.type = "button";
            next.textContent = `Start next season (${season.id + 1})`;
            next.addEventListener("click", () => void reactivateNextSeason(season));
            // The replan bridge, first hop (ISSUES #11 item 2): the close is where the Review tab becomes
            // worth reading - what this year taught, and next year's per-bed rotation outlook. Every other
            // step of the loop points at its successor; the close pointed nowhere until this.
            const rev = el("button", "link seasonreview");
            rev.type = "button";
            rev.textContent = "Season in review →";
            rev.addEventListener("click", () => { location.hash = "#/review"; });
            const re = el("button", "link");
            re.type = "button";
            re.textContent = "Reopen season";
            re.addEventListener("click", () => void reopenSeason(season));
            foot.append(t, next, rev, re);
        }
        else {
            // Climate-recommended close (D-115): once THIS ground's first fall freeze has passed and beds are
            // still active, nudge the close ceremony. The freeze is the observed date if R-093 has calibrated
            // (D-114), else the model median - from the plot's own resolved climate. No location / no freeze on
            // record (frost-free) → no nudge; the button is always there for a manual close.
            const anchor = plot?.anchor;
            const site = anchor ? resolveClimate(anchor.lat, anchor.lon, bundle)?.site ?? null : null;
            const fcal = site ? frostCalibration(seasons, site) : null;
            const freezeMmdd = fcal?.fall.calibrated ? fcal.fall.calibrated_date : (site?.first_freeze_32f_p50 ?? null);
            const liveNow = (season.plantings ?? []).some((p) => !p.end_cause);
            if (liveNow && firstFreezePassed(season.id, freezeMmdd, today)) {
                const nudge = el("p", "closenudge");
                const observed = !!fcal?.fall.calibrated;
                nudge.textContent = `Your first fall freeze (${fmtMD(freezeMmdd)}${observed ? ", your ground's observed date" : ""}) has passed. Time to close the season - the beds go dormant and this year becomes memory for next. Perennials carry over.`;
                foot.appendChild(nudge);
            }
            if (closeCtrl)
                foot.appendChild(closeCtrl); // the cause/date picker, down here with the close button
            const roll = el("button", "primary");
            roll.type = "button";
            roll.textContent = `Close the season (${season.id})`;
            const note = el("span", "hint");
            note.textContent = " - ends every still-active bed and rolls the year; perennials carry over.";
            roll.addEventListener("click", () => {
                foot.innerHTML = "";
                const q = el("span", "why");
                q.textContent = `Close season ${season.id}? This ends every still-active bed and rolls the year - perennials carry over. `;
                const yes = el("button", "primary");
                yes.type = "button";
                yes.textContent = "Yes, close it";
                yes.addEventListener("click", () => { if (causeSel && dateInp)
                    void rollSeason(season, causeSel.value, dateInp.value); });
                const no = el("button", "link");
                no.type = "button";
                no.textContent = "Cancel";
                no.addEventListener("click", () => void refresh());
                foot.append(q, yes, no);
            });
            foot.append(roll, note);
        }
        host.appendChild(foot);
    };
    // Close one bed: resolve just its live plantings (geometric, ground-rooted). The season stays open.
    const closeBed = async (season, bed, cause, date) => {
        try {
            const plantings = (season.plantings ?? []).map((p) => plantingOnBed(p.region, bed.region) ? resolvePlanting(p, cause, date) : p);
            await putSeason(db, { ...season, plantings });
            said(`Closed “${bed.name}” - annuals ended, perennials carried over`);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    // Roll the season: resolve EVERY still-active planting and stamp closed_date. A closed season is
    // held to the completeness check (seasonlog: closed_date ⇒ every planting resolved), so putSeason
    // refuses a half-closed season - the roll is atomic.
    const rollSeason = async (season, cause, date) => {
        try {
            const plantings = (season.plantings ?? []).map((p) => resolvePlanting(p, cause, date));
            await putSeason(db, { ...season, plantings, closed_date: date });
            said(`Season ${season.id} closed - the beds are dormant; next year plans from what grew here`);
            // D-098: the close is a CEREMONY (ISSUES #11 design arc) - a fall of garden petals over
            // the page marks it. Self-removing; reduced-motion users see none (CSS hides the layer).
            const petals = document.createElement("div");
            petals.className = "confetti";
            petals.setAttribute("aria-hidden", "true");
            const hues = ["#4a9d5f", "#e8a33d", "#d97ba4", "#7fb069", "#c4574e"]; // leaf, marigold, blossom, sage, berry
            for (let i = 0; i < 14; i++) {
                const petal = document.createElement("i");
                petal.style.setProperty("--x", `${(i * 71) % 100}%`);
                petal.style.setProperty("--d", `${(1.1 + (i % 5) * 0.22).toFixed(2)}s`);
                petal.style.background = hues[i % hues.length];
                petals.appendChild(petal);
            }
            document.body.appendChild(petals);
            setTimeout(() => petals.remove(), 3000);
            buzz([30, 40, 30]);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    // Reopen: clear closed_date. The resolved plantings stay resolved; the season is editable again.
    const reopenSeason = async (season) => {
        try {
            const reopened = { ...season };
            delete reopened.closed_date;
            await putSeason(db, reopened);
            said(`Season ${season.id} reopened - it's active again`);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    // Reactivate next season (ISSUES #11 slice 4): from a CLOSED season, open the next year and CARRY
    // FORWARD the plants that persisted (perennials/biennials marked carried_over). Each becomes a live
    // planting in the new season KEEPING its carried_over marker (D-121): that marker is what the Plan's
    // plan-around-occupancy wiring (D-116/117) keys on to lay the new season's layout AROUND the plant -
    // dropping it here made that arc a no-op in the reactivation flow it was built for. End pairs never
    // forward; species/group/region/sown are kept, the region copied fresh (ground-rooted, so the
    // persisting plant occupies the same ground next year). The reseed mechanic (D-078 read-back) still
    // surfaces the carried plants on the canvas. Deduped against an already-started next season
    // (forwardCarried, mirrored in engine/season_log.py).
    const reactivateNextSeason = async (season) => {
        try {
            const nextId = season.id + 1;
            const existing = await getSeason(db, app.currentPlotId, nextId);
            const base = existing ?? { id: nextId, plot: app.currentPlotId, plantings: [], observations: [] };
            const forwarded = forwardCarried(season.plantings ?? [], base.plantings ?? []);
            const plantings = [...(base.plantings ?? []), ...forwarded];
            const carried = forwarded.length;
            await putSeason(db, { ...base, plantings });
            seasonSel.value = String(nextId);
            // Follow the season you just started (ISSUES #11 item 2): without this the view stays on the
            // closed year and "season N+1 started" is a message about somewhere you are not looking.
            viewedYear = nextId;
            // Split by kind: a bare start is a confirmation and floats; a start that CARRIED plants
            // forward also tells you what to do next about them, so that half stays docked where it
            // can be re-read while you plan the beds around them.
            if (carried) {
                msg(`Season ${nextId} started - ${carried} plant${carried === 1 ? "" : "s"} carried over from ${season.id}. Plan the rest of each bed around ${carried === 1 ? "it" : "them"}.`);
            }
            else {
                said(`Season ${nextId} started - a fresh year on this ground`);
            }
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    // Photos (O6/D-171): resolve a note's photo FILENAME to the device store's blob, one object URL
    // per photo per page life (why blob: is in img-src). A name the store cannot answer - this
    // record was imported without its zip, or the photos were taken on another device - renders as
    // the alt text saying so, never as a broken guess.
    const photoUrlCache = new Map();
    const photoInto = (img, seasonId, name) => {
        const key = `${app.currentPlotId}:${seasonId}:${name}`;
        const hit = photoUrlCache.get(key);
        if (hit) {
            img.src = hit;
            return;
        }
        void getPhoto(db, app.currentPlotId, seasonId, name).then((b) => {
            if (!b)
                return;
            const url = URL.createObjectURL(b);
            photoUrlCache.set(key, url);
            img.src = url;
        });
    };
    // --- the season timeline (Organic redesign, handoff 1c): the viewed season's events as one
    // flowing diary. Everything here is DERIVED from the season record - plantings' date fields,
    // failures, notes, and the garden-wide observations - so the timeline needs no new state.
    // Dot colors carry the kind: sage sow/plant, terracotta harvest, warm neutral for
    // frost/weather/ended/problems, an outlined dot for free-text notes. Newest first.
    const renderTimeline = (seasons, beds) => {
        const host = document.getElementById("logtimeline");
        if (!host)
            return;
        host.textContent = "";
        const season = seasons.find((s) => s.id === viewedYear) ?? seasons[seasons.length - 1] ?? null;
        if (!season)
            return;
        const entries = [];
        // a sectioned parent geometrically CONTAINS its sections (ISSUES #12): attribute the entry
        // to its most-specific bed - any non-container match wins over the container
        const bedFor = (p) => {
            const cands = beds.filter((b) => plantingOnBed(p.region, b.region));
            return (cands.find((b) => !bedHasSections(b.name, beds)) ?? cands[0])?.name ?? null;
        };
        for (const p of season.plantings ?? []) {
            const name = commonName(bundle, p.species);
            const bed = bedFor(p);
            if (p.sown)
                entries.push({ date: p.sown, kind: "sow", head: "Sown", text: name, bed, species: p.species, label: name });
            if (p.transplanted)
                entries.push({ date: p.transplanted, kind: "plant", head: "Planted", text: name, bed, species: p.species, label: name });
            if (p.first_harvest)
                entries.push({ date: p.first_harvest, kind: "harvest", head: "Harvest", text: `First ${name.toLowerCase()} out of the ground.`, bed, species: p.species, label: name.toLowerCase() });
            if (p.last_harvest && p.last_harvest !== p.first_harvest)
                entries.push({ date: p.last_harvest, kind: "harvest", head: "Last harvest", text: name, bed, species: p.species, label: name });
            if (p.end_date && p.end_cause)
                entries.push({ date: p.end_date, kind: "ended", head: `Ended · ${humanize(p.end_cause).toLowerCase()}`, text: name, bed, species: p.species, label: name });
            for (const f of p.failures ?? [])
                entries.push({ date: f.date, kind: "problem", head: `Problem · ${f.severity}`, text: `${name} - ${f.mode}`, bed, species: p.species, label: name });
            for (const n of p.notes ?? [])
                entries.push({ date: n.date, kind: "note", head: "Note", text: `${name}: ${n.text}`, bed, species: p.species, label: name, photo: n.photo });
        }
        for (const o of season.observations ?? []) {
            const head = o.severity ? `${humanize(o.severity)} ${o.event}` : humanize(o.event);
            entries.push({ date: o.date, kind: "weather", head, text: o.note || o.damage || "Across the whole garden.", bed: null, species: null, label: "" });
        }
        if (!entries.length)
            return; // a fresh season has no diary yet - say nothing rather than filler
        entries.sort((a, b) => b.date.localeCompare(a.date));
        const groups = new Map();
        for (const e of entries) {
            const key = `${e.date}|${e.kind}|${e.head}|${e.bed ?? ""}`;
            const g = groups.get(key);
            if (g)
                g.parts.push(e);
            else
                groups.set(key, { ...e, parts: [e] });
        }
        // Renders "Corn + 12 × Common Bean" into `host`, each crop name linked to its card. Identical
        // sentences collapse to one segment with a count, exactly as the string version did - the
        // rendered text is unchanged, only its markup is.
        const tally = (parts, host) => {
            const counts = new Map();
            for (const e of parts) {
                const c = counts.get(e.text);
                if (c)
                    c.n++;
                else
                    counts.set(e.text, { n: 1, e });
            }
            let first = true;
            for (const [text, { n, e }] of counts) {
                if (!first)
                    host.appendChild(document.createTextNode(" + "));
                first = false;
                if (n > 1)
                    host.appendChild(document.createTextNode(`${n} × `));
                if (e.species)
                    linkNameIn(host, text, e.label, e.species);
                else
                    host.appendChild(document.createTextNode(text));
            }
        };
        const rows = [...groups.values()];
        const CAP = 12;
        const wrap = el("div", "tl");
        const render = (list, into) => {
            for (const e of list) {
                const row = el("div", `tl-e tl-${e.kind}`);
                // A7a: the entry the composer just wrote gets its dot scaled in - consumed one-shot so a
                // later re-render (year switch, filter) does not replay the beat
                if (justLogged && e.parts.some((q) => q.date === justLogged.date && q.kind === justLogged.kind)) {
                    row.classList.add("tl-new");
                    justLogged = null;
                }
                row.appendChild(el("span", "tl-dot"));
                const k = el("span", "tl-k");
                const d = new Date(e.date + "T12:00:00");
                k.textContent = `${isNaN(d.getTime()) ? e.date : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${e.head}`;
                row.appendChild(k);
                const s = el("p", "tl-s");
                tally(e.parts, s);
                row.appendChild(s);
                // a photo-carrying note shows its picture on the diary itself (O6/D-171) - the photo is
                // a note that shows instead of tells, so it lands where the dated entry already is
                const withPhotos = e.parts.filter((q) => q.photo);
                if (withPhotos.length) {
                    const strip = el("div", "photostrip");
                    for (const q of withPhotos) {
                        const img = document.createElement("img");
                        img.className = "photothumb";
                        img.loading = "lazy";
                        img.alt = `photo · ${q.text}`;
                        img.addEventListener("click", () => img.classList.toggle("photobig"));
                        photoInto(img, season.id, q.photo);
                        strip.appendChild(img);
                    }
                    row.appendChild(strip);
                }
                const tag = el("span", e.bed ? "tl-bed" : "tl-bed whole");
                tag.textContent = e.bed ?? "whole garden";
                row.appendChild(tag);
                into.appendChild(row);
            }
        };
        render(rows.slice(0, CAP), wrap);
        if (rows.length > CAP) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "tl-more";
            more.textContent = `show ${rows.length - CAP} earlier ↓`;
            more.addEventListener("click", () => { more.remove(); render(rows.slice(CAP), wrap); }, { once: true });
            wrap.appendChild(more);
        }
        host.appendChild(wrap);
    };
    const refresh = async () => {
        // Self-heal a stale plot pointer. Two ways gg-plot can point at a garden this view must not
        // show: the demo was removed but the pointer still names it (D-029 - the "banner won't close"
        // report), or the pointer crosses WORKSPACES (D-152: signed out but pointing at an account
        // garden, or the reverse - how sign-out used to keep showing the last user's beds and address).
        // Either way: fall back to the active workspace's first garden, else its default id.
        {
            const cur = await getPlot(db, app.currentPlotId);
            if (!cur || !plotVisible(cur)) {
                const vis = (await listPlots(db)).filter((p) => !p.example);
                const target = vis[0]?.id ?? defaultWorkspacePlotId();
                if (target !== app.currentPlotId) {
                    setCurrentPlot(target);
                    app.refreshAuthGate?.();
                }
            }
        }
        const seasons = (await listSeasons(db, app.currentPlotId)).sort((a, b) => a.id - b.id);
        const chosen = seasonSel.value;
        fillSelect("logseason", seasons.map((s) => String(s.id)));
        seasonSel.value = seasons.some((s) => String(s.id) === chosen)
            ? chosen
            : (seasons.length ? String(seasons[seasons.length - 1].id) : "");
        const plot = await getPlot(db, app.currentPlotId);
        // Restore the location from the plot's saved ANCHOR when the form is empty (walkthrough bug): a
        // returning or signed-in user's plot has an anchor (set when its ground map first resolved), but
        // the lat/lon inputs start blank - so `site.lat` was null, and the Configurable Bed's placement
        // (which needs the sun direction) never computed. The layout diagram stayed hidden and a save
        // wrote zero tokens → "nothing applied to the map." Only fills an EMPTY form, so a user-entered
        // location is never clobbered; the anchor is the plot's real location and what the map already uses.
        if (plot?.anchor && num("lat") == null && num("lon") == null) {
            $("lat").value = String(Math.round(plot.anchor.lat * 1e5) / 1e5);
            $("lon").value = String(Math.round(plot.anchor.lon * 1e5) / 1e5);
        }
        const beds = plot?.beds ?? [];
        // O58 Phase 4 (slice C): the coaching band fills the COLD Log - no beds and no seasons on the
        // active garden, whether signed out or a fresh account. refresh() re-fires on every mutation, so
        // it self-hides the moment a bed or a season exists; .coachband is exempt from the locked-page
        // blackout, so it shows below the sign-in card when signed out.
        coachBand($("coach-log"), COACH_HEADING, COACH_LOG, seasons.length === 0 && beds.length === 0);
        const allPlots = await listPlots(db);
        renderLocations(seasons, beds, plot, allPlots);
        renderTimeline(seasons, beds);
        await renderSeedBox(db, bundle); // O111b: the seed box rides the log refresh (and synced pulls)
        // O111c: the shopping list = the viewed season's plan minus the seed box, matched by species.
        const viewedSeason = seasons.find((s) => String(s.id) === seasonSel.value);
        await renderShoppingList(db, bundle, viewedSeason?.plantings ?? []);
        renderGardensClimate(allPlots);
        renderActiveGarden(plot, allPlots.length);
        await renderFeed(plot);
        await renderRestore();
        // Name the weather panel with the active garden (walkthrough Q3): the frost/heat you log here is
        // this garden's, and it re-points when you switch gardens - say so instead of a generic title.
        const wLegend = document.querySelector("#sec-weather legend");
        if (wLegend)
            wLegend.textContent = plot?.name ? `${plot.name}’s weather` : "This ground’s weather";
        // hand the snapshot to the eligibility path: history derives from the log (task 5),
        // for the ground of whichever placed bed the candidate picker names; the open season's id
        // becomes site.season_year so rotation intervals count from the year actually being planted
        app.logSnapshot = { seasons, beds, seasonId: currentSeasonId(), priorOccupancy: plot?.prior_occupancy ?? [] };
        // O28: the plot's own facts (typed address, anchor) for the synchronous inventory render.
        // + name (2026-08-01): the home's garden view titles itself with the garden it is showing,
        // which with a gardens strip above it is the difference between a label and a guess.
        app.currentPlot = plot ? { address: plot.address, anchor: plot.anchor, name: plot.name } : null;
        countGardenActive(plot); // the AQ-5 metric: a REAL anchored garden was open (once per load; see analytics.ts)
        const cand = $("candbed");
        const candChosen = cand.value;
        // ISSUES #12 sub-sections: a bed that has sections ("<bed> N") is a pure CONTAINER once divided -
        // the plan lives in the sections, so the parent is NOT offered as a plannable target here (that
        // removes the old parent-vs-sections redundancy). Its sections pick individually; the container
        // itself is still edited (outline/structure) from "Your ground" on the map.
        const plannable = beds.filter((b) => !bedHasSections(b.name, beds));
        fillSelect("candbed", plannable.map((b) => b.name), (v) => v);
        // The composer's ground picker follows the beds too. "" is the whole garden and is FIRST, because
        // a gardener who never touches it records a fact about the yard rather than about a bed they did
        // not mean to name - the same unknown-first reasoning the soil card's dropdowns use.
        {
            const gr = $("obsground");
            const keep = gr.value;
            gr.innerHTML = "";
            for (const [value, label] of [["", "the whole garden"],
                ...beds.map((b) => [b.name, b.name])]) {
                const o = document.createElement("option");
                o.value = value;
                o.textContent = label;
                gr.appendChild(o);
            }
            if ([...gr.options].some((o) => o.value === keep))
                gr.value = keep;
        }
        if (plannable.some((b) => b.name === candChosen))
            cand.value = candChosen;
        else if (plannable.length)
            cand.value = plannable[0].name; // placement shows by default, not on request
        if (app.refreshUserPlantsUI)
            await app.refreshUserPlantsUI(); // pick up any synced user species
        onLogChange();
    };
    const act = (id, fn) => {
        $(id).addEventListener("click", () => {
            fn().then((note) => {
                msg(note);
                return refresh();
            }).catch((e) => msg(String(e instanceof Error ? e.message : e), true));
        });
    };
    // Post to the garden's team feed (D-172). A local write → stamps → auto-syncs like any record;
    // for a shared garden the shared sync pass routes it back under the owner, so every member sees it.
    act("feedpost", async () => {
        if (!isSignedIn())
            throw new Error("sign in to post to the team");
        const input = $("feedbody");
        const body = input.value.trim();
        if (!body)
            throw new Error("write something first");
        await putPost(db, { plot: app.currentPlotId, id: mintPostId(), author: signedInEmail() ?? "", at: new Date().toISOString(), body });
        input.value = "";
        return "posted to the team.";
    });
    // (The planting Record forms - start / place bed / log planting / end / failure - were retired in
    // the Log redesign; those actions now live in the bed-card drill-down, renderLocations. Starting a
    // season is a location control there; beds are drawn on the Plan map.)
    act("obsadd", async () => {
        const rawEvent = $("obsevent").value;
        // SOIL ENTRIES BRANCH BEFORE THE SEASON CHECK, deliberately: soil attaches to GROUND and outlives
        // any season (D-002), so requiring an open season to record "water stood here" would refuse a
        // true observation for a reason that has nothing to do with it.
        if (rawEvent.startsWith("soil_")) {
            const date = $("obsdate").value;
            const groundName = $("obsground").value;
            const bed = app.logSnapshot.beds.find((b) => b.name === groundName) ?? null;
            const rec = { plot: app.currentPlotId, date, source: "declared" };
            if (rawEvent === "soil_waterlogged")
                rec.drainage = "waterlogged";
            else
                rec.amendment = rawEvent.slice("soil_".length);
            if (bed?.region)
                rec.region = bed.region;
            const note = $("obsnote").value.trim();
            if (note)
                rec.notes = note;
            await putSoilObservation(db, rec);
            await app.soilRefresh?.();
            onLogChange();
            return rawEvent === "soil_waterlogged"
                ? `noted - standing water on ${groundName || "the whole garden"} feeds the waterlogging rule.`
                : `noted - a pH reading from before this no longer describes ${groundName || "the whole garden"}.`;
        }
        const season = currentSeasonId();
        if (season == null)
            throw new Error("start (or pick) a season first");
        const event = rawEvent;
        const obs = { date: $("obsdate").value, event };
        if (event === "frost")
            obs.severity = $("obssev").value;
        const note = $("obsnote").value.trim();
        if (note)
            obs.note = note;
        await addObservation(db, app.currentPlotId, season, obs);
        // A7a: the composer posted silently. Mark the entry so its timeline dot scales in, and if it
        // ADVANCED the frost standing (R-093), say what it bought - one line under the composer,
        // computed by the same pure resolver the earn-strip reads. REAL seasons only: the snapshot
        // never holds demo seasons, so this cannot credit synthetic data.
        justLogged = { date: obs.date, kind: "weather" };
        const nudge = $("lognudge");
        nudge.hidden = true;
        const standing = (seasons) => ledgerEarned(seasons, lastEarnedSite, app.soilObservations ?? [], app.currentPlotId)
            .find((r) => r.key === "frost");
        const before = standing(app.logSnapshot.seasons);
        const after = standing(app.logSnapshot.seasons.map((s) => s.id === season ? { ...s, observations: [...(s.observations ?? []), obs] } : s));
        if (before && after && (after.state !== before.state || after.badge !== before.badge)) {
            nudge.textContent = after.state === "live"
                ? "Frost logged - your own dates now supersede the national model."
                : `Frost logged - ${after.badge.toLowerCase()} seasons toward your own dates.`;
            nudge.hidden = false;
        }
        return `observation logged - this is the R-093 payload; 3 seasons × 2 of these beat the model.`;
    });
    // R-093 demo: seed synthetic seasons so the observed-vs-predicted render has >=3 to fit. Held in
    // memory only (never stored, never exported); the frost panel shows a synthetic banner while set.
    $("frostdemo").addEventListener("click", () => {
        const lat = num("lat"), lon = num("lon");
        if (lat == null || lon == null) {
            msg("pick a site or enter lat/lon first - demo seasons are seeded against your resolved climate.", true);
            return;
        }
        app.syntheticOn = true;
        $("frostdemoclear").hidden = false;
        onLogChange();
        // the "not real observations" caveat is STANDING and already lives in the frost panel itself
        // (renderFrost prints it for as long as the mode is on), so the float carries only the action.
        said("Loaded 4 synthetic demo seasons");
    });
    $("frostdemoclear").addEventListener("click", () => {
        app.syntheticOn = false;
        $("frostdemoclear").hidden = true;
        onLogChange();
        said("Cleared the synthetic demo seasons");
    });
    // Export/import: the byte-stable git-format file (engine/seasonfile.ts). Export downloads
    // AND shows the exact bytes in the box; import reads the box back. The parser tolerates the
    // exporter's own output only and refuses anything else with the full list of what's wrong.
    act("logexport", async () => {
        const season = currentSeasonId();
        if (season == null)
            throw new Error("start (or pick) a season first");
        const rec = (await listSeasons(db, app.currentPlotId)).find((s) => s.id === season);
        if (!rec)
            throw new Error(`no season ${season} in the log`);
        const text = emitSeason(rec);
        $("logfile").value = text;
        $("logfilebox").open = true;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "application/yaml" }));
        a.download = `season-${season}.yaml`;
        a.click();
        URL.revokeObjectURL(a.href);
        // Photos ride BESIDE the file, never in it (D-171): the YAML names them, the zip carries the
        // bytes. The zip's manifest is the season record itself - a photo the record does not name
        // does not export. A named photo this device does not hold is reported, not invented.
        const named = (rec.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
            .filter((x) => !!x);
        if (!named.length)
            return `season ${season} exported - the file is what a git-backed log would commit.`;
        const entries = [];
        const missing = [];
        for (const name of named) {
            const blob = await getPhoto(db, app.currentPlotId, season, name);
            if (blob)
                entries.push({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
            else
                missing.push(name);
        }
        if (entries.length) {
            const z = document.createElement("a");
            z.href = URL.createObjectURL(buildStoreZip(entries));
            z.download = `season-${season}-photos.zip`;
            z.click();
            URL.revokeObjectURL(z.href);
        }
        return `season ${season} exported - the file is what a git-backed log would commit` +
            (entries.length ? `, with ${entries.length} photo${entries.length === 1 ? "" : "s"} zipped beside it` : "") +
            (missing.length ? `. ${missing.length} named photo${missing.length === 1 ? " is" : "s are"} not on this device and could not be exported` : "") + ".";
    });
    // Import, the file half (D-171): the season file plus, optionally, its photo zip. The paste box
    // keeps working for the YAML alone; photos cannot be pasted, which is why this input exists.
    // Zip entries are restored ONLY where the imported (or already-stored) season names them - an
    // unnamed entry stays out of the store, so a foreign zip cannot seed files nothing points to.
    $("logimportfiles")?.addEventListener("change", () => void (async () => {
        const inp = $("logimportfiles");
        const files = Array.from(inp.files ?? []);
        if (!files.length)
            return;
        try {
            const yaml = files.find((f) => /\.ya?ml$/i.test(f.name));
            const zip = files.find((f) => /\.zip$/i.test(f.name));
            if (!yaml && !zip)
                throw new Error("choose the season .yaml (and, if you have one, its photos .zip)");
            let season = null;
            if (yaml) {
                const text = await yaml.text();
                $("logfile").value = text;
                season = parseSeasonFile(text);
                const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
                const replaced = existing && emitSeason(existing) !== text;
                await putSeason(db, season);
                seasonSel.value = String(season.id);
                if (replaced)
                    msg(`season ${season.id} imported - REPLACED the stored season ${season.id}, which was different.`);
            }
            let restored = 0, skipped = 0;
            if (zip) {
                // no YAML alongside: restore against the season already stored under the CURRENT plot
                // whose records name these files (the two-file import arriving one file at a time)
                const target = season ?? (await listSeasons(db, app.currentPlotId)).find((s) => s.id === currentSeasonId()) ?? null;
                if (!target)
                    throw new Error("import the season file first (or alongside) - the zip restores only photos the season names");
                const namedSet = new Set((target.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
                    .filter((x) => !!x));
                for (const entry of readStoreZip(await zip.arrayBuffer())) {
                    if (!namedSet.has(entry.name)) {
                        skipped++;
                        continue;
                    }
                    await putPhoto(db, target.plot, target.id, entry.name, new Blob([entry.bytes], { type: "image/jpeg" }));
                    restored++;
                }
            }
            await refresh();
            const parts = [
                season ? `season ${season.id} imported (${season.plantings?.length ?? 0} plantings, ${season.observations?.length ?? 0} observations)` : null,
                restored ? `${restored} photo${restored === 1 ? "" : "s"} restored` : null,
                skipped ? `${skipped} zip entr${skipped === 1 ? "y" : "ies"} skipped (the season does not name them)` : null,
            ].filter(Boolean);
            msg(parts.join("; ") + ".");
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
        finally {
            inp.value = "";
        }
    })());
    act("logimport", async () => {
        const text = $("logfile").value;
        if (!text.trim())
            throw new Error("paste a season file into the box first");
        const season = parseSeasonFile(text);
        const plotNote = season.plot !== app.currentPlotId
            ? ` NOTE: this file belongs to plot "${season.plot}", not the current address - it was stored there.`
            : "";
        // never silently clobber logged data: replacing an existing season is said out loud,
        // and only an identical re-import is treated as a no-op
        const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
        const replaced = existing && emitSeason(existing) !== text;
        await putSeason(db, season);
        seasonSel.value = String(season.id);
        return `season ${season.id} imported (${season.plantings?.length ?? 0} plantings, ` +
            `${season.observations?.length ?? 0} observations)` +
            (replaced ? ` - REPLACED the stored season ${season.id}, which was different.` : ".") + plotNote;
    });
    seasonSel.addEventListener("change", () => void refresh());
    app.logRefresh = refresh;
    // Add-a-plant (roadmap corpus-growth): a variety the corpus doesn't model, stored as USER DATA
    // and folded into the render path. Honest fidelity: the plant participates only in the rules its
    // filled-in fields support, and the panel says exactly which (capabilities). Lives on the Plan
    // tab (open, no account needed); the plant becomes loggable and appears in eligibility at once.
    {
        const upFamilies = $("upfamilies");
        for (const f of familiesOf(bundle)) {
            const o = document.createElement("option");
            o.value = f;
            upFamilies.appendChild(o);
        }
        const setMsg = (span, text, err = false) => {
            span.textContent = text;
            span.className = err ? "hint err" : "hint";
        };
        const capLine = (rec) => {
            const cap = capabilities(rec);
            return cap.limits.length
                ? `plans it in, but: ${cap.limits.join("; ")}`
                : "plans, places, and schedules - full detail";
        };
        const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const uniqueId = (slug) => {
            const base = `user:${slug}`;
            if (!app.userSpecies.some((s) => s.id === base))
                return base;
            for (let n = 2;; n++)
                if (!app.userSpecies.some((s) => s.id === `${base}_${n}`))
                    return `${base}_${n}`;
        };
        // Reload from storage and re-render BOTH surfaces: the Plan-tab read-only list (#uplist, whose child
        // count drives the step badge) and the Log-tab editable manager (#myplants). Shared by add, edit,
        // remove, AND the log refresh (so a synced pull of user_species rows appears without a reload).
        const reloadPlants = async () => {
            app.userSpecies = await listUserSpecies(db);
            $("uplisthint").textContent = app.userSpecies.length ? "Edit or remove these under “My added plants” on the Log tab." : "";
            renderManagedPlants($("uplist"), false);
            const mp = document.getElementById("myplants");
            if (mp)
                renderManagedPlants(mp, true);
        };
        app.refreshUserPlantsUI = reloadPlants;
        // The save closure shared by the add form and every edit form. `existingId` is the plant's id on an
        // EDIT - PRESERVED, so logged plantings that reference it stay linked - and undefined on an add, where
        // a fresh user:<slug> id is minted. Soft warning (maintainer, chosen option): if the record is missing
        // detail some page needs, name exactly what won't work and ARM; a second tap saves anyway. A hard
        // validator error (shouldn't happen behind the widgets) blocks. Flag, don't hide.
        const makeSaver = (form, existingId, msg, btnLabel, onSaved) => {
            let armed = false;
            return () => {
                const { name, traits } = form.read();
                if (!name) {
                    msg("give the plant a name.", true);
                    armed = false;
                    return;
                }
                const slug = slugify(name);
                if (!slug) {
                    msg("the name needs some letters or numbers.", true);
                    armed = false;
                    return;
                }
                const id = existingId ?? uniqueId(slug);
                const rec = { id, source: "user", common: name, ...traits };
                const errors = validateUserSpecies(rec);
                if (errors.length) {
                    msg(errors[0], true);
                    armed = false;
                    return;
                }
                const caps = capabilities(rec);
                if (caps.limits.length && !armed) {
                    armed = true;
                    msg(`Heads up - ${caps.limits.join("; ")}. Fill those in for full detail, or tap ${btnLabel} again to ${existingId ? "save" : "add"} anyway.`);
                    return;
                }
                putUserSpecies(db, rec)
                    .then(async () => { onSaved(rec); onLogChange(); await reloadPlants(); })
                    .catch((e) => msg(String(e instanceof Error ? e.message : e), true));
            };
        };
        // One plant row. On the editable surface (Log) it carries edit (expands an inline editor seeded from
        // the record) + remove; on the read-only surface (Plan) just its name and what it currently unlocks.
        function renderManagedPlants(container, editable) {
            // Don't yank an OPEN editor out from under the user: a spontaneous reload (a synced pull of user_species
            // rows arriving via refreshUserPlantsUI) must not wipe #myplants mid-edit and lose unsaved input. The
            // list catches up when the editor closes - save AND cancel both reload - and save closes the editor
            // BEFORE it reloads, so a real save still re-renders. The read-only #uplist has no editor and reloads
            // as normal.
            if (editable && container.querySelector(".upedit"))
                return;
            container.innerHTML = "";
            if (!app.userSpecies.length) {
                const p = el("p", "hint");
                p.textContent = editable
                    ? "No added plants yet. Add one on the Plan tab under “Add your own plant”."
                    : "No added plants yet. Anything you add becomes loggable and shows up in what this ground can grow.";
                container.appendChild(p);
                return;
            }
            for (const rec of [...app.userSpecies].sort((a, b) => a.id.localeCompare(b.id))) {
                const row = el("div", "upitem");
                const fam = typeof rec.family === "string" ? ` · ${familyName(rec.family)}` : " · no family";
                const label = el("span");
                label.textContent = `${commonName(bundle, rec.id)}${fam} - ${capLine(rec)}`;
                row.appendChild(label);
                if (editable) {
                    const edit = el("button");
                    edit.type = "button";
                    edit.className = "link";
                    edit.textContent = "edit";
                    edit.addEventListener("click", () => toggleEditForm(container, row, rec));
                    const rm = el("button");
                    rm.type = "button";
                    rm.className = "link";
                    rm.textContent = "remove";
                    rm.addEventListener("click", () => void deleteUserSpecies(db, rec.id)
                        .then(async () => { await reloadPlants(); onLogChange(); })
                        .catch(() => { }));
                    row.append(edit, rm);
                }
                container.appendChild(row);
            }
        }
        // Expand (or collapse) an inline editor under a plant row, seeded from its record. Save PRESERVES the
        // id; a successful save re-renders the list (which removes this editor).
        function toggleEditForm(container, row, rec) {
            const open = row.nextElementSibling;
            if (open && open.classList.contains("upedit")) {
                open.remove();
                return;
            }
            container.querySelectorAll(".upedit").forEach((e) => e.remove()); // one editor open at a time
            const box = el("div", "upedit");
            const form = plantEditorForm({ seed: rec });
            const msgEl = el("span", "hint");
            const save = el("button");
            save.type = "button";
            save.className = "primary";
            save.textContent = "Save";
            const cancel = el("button");
            cancel.type = "button";
            cancel.className = "link";
            cancel.textContent = "cancel";
            save.addEventListener("click", makeSaver(form, rec.id, (t, err) => setMsg(msgEl, t, err), "Save", () => box.remove()));
            cancel.addEventListener("click", () => { box.remove(); void reloadPlants(); });
            const actions = el("div", "uprow actions");
            actions.append(save, cancel, msgEl);
            box.append(form.root, actions);
            row.after(box);
        }
        // The ADD form: the shared editor, blank, mounted on the Plan tab. Remount (blank) after a successful
        // add so the next plant starts clean; the static #upadd button is (re)bound to the current form's saver.
        const mountAddForm = () => {
            const host = $("upform-host");
            host.innerHTML = "";
            const form = plantEditorForm({});
            host.appendChild(form.root);
            const addMsg = (t, err = false) => setMsg($("upmsg"), t, err);
            $("upadd").onclick = makeSaver(form, undefined, addMsg, "Add plant", (rec) => {
                addMsg(`Added ${commonName(bundle, rec.id)}. Edit it any time under “My added plants” on the Log tab.`);
                mountAddForm();
            });
        };
        mountAddForm();
        void reloadPlants();
    }
    // Activating a garden = make it current, move the location to ITS anchor, and re-read its ledger.
    // Switching gardens or signing in are DELIBERATE moves to a garden, so the location follows the
    // anchor even when the form already holds another garden's coordinates - unlike refresh's
    // empty-only restore, which must never clobber a value the user just typed. A brand-new garden
    // with no anchor yet leaves the location alone (its ground map will set one on first resolve).
    // Set once the ground map exists (below); activatePlot runs only from user actions after setup.
    let mapRefit = null;
    const activatePlot = async (id) => {
        setCurrentPlot(id);
        const plot = await getPlot(db, id);
        if (plot?.anchor) {
            $("lat").value = String(Math.round(plot.anchor.lat * 1e5) / 1e5);
            $("lon").value = String(Math.round(plot.anchor.lon * 1e5) / 1e5);
            for (const cid of ["zip", "plus"]) {
                const ce = document.getElementById(cid);
                if (ce)
                    ce.value = "";
            }
        }
        mapRefit?.(); // a deliberate garden activation always re-frames the map on THIS garden (D-152)
        await refresh(); // re-read the new garden's ledger and redraw (onLogChange = the plan draw)
        app.refreshAuthGate?.(); // D-029: the example-garden preview toggles with the active garden
    };
    app.switchPlot = activatePlot; // the home's gardens strip switches through the same one door
    // --- draft adoption (D-152) ---------------------------------------------------------
    // A draft is REAL when it holds work: a bed or a season. An anchor alone (a visitor typed an
    // address and left) is not a plan - those shells are discarded quietly at sign-in, because
    // asking about them is exactly the noise the maintainer asked to remove.
    const draftIsReal = async (p) => (p.beds?.length ?? 0) > 0 || (await listSeasons(db, p.id)).length > 0;
    const discardDraft = async (p) => {
        for (const sn of await listSeasons(db, p.id))
            await deleteSeason(db, p.id, sn.id);
        for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === p.id)) {
            await deleteSoilObservation(db, rec);
        }
        await deletePlot(db, p.id);
    };
    // Bring a draft into the account: re-key into the account id space, tag it, stamp it - the
    // ordinary auto-sync then pushes it like any local edit. Names carry over; the id derives from
    // the name so the garden picker reads naturally on every device.
    const adoptDraft = async (p) => {
        const base = plotIdFor(p.name ?? "home"); // signed in → plot_… ids
        return rekeyPlot(db, p.id, await freePlotId(db, base), { owner: "account" });
    };
    // The real drafts awaiting a decision, empty shells quietly discarded on the way.
    const pendingDrafts = async () => {
        const out = [];
        for (const p of await listPlots(db, "draft")) {
            if (await draftIsReal(p))
                out.push(p);
            else
                await discardDraft(p);
        }
        return out;
    };
    // The ask-once banner (D-152, maintainer decision 2026-07-29): signing in to an account that
    // already HAS gardens with a real draft on the device asks - add it to the account, or discard
    // it. Never a silent merge (that is how test beds used to bleed into the real garden), never a
    // silent clone. Discard is two-tap, like every destructive control on the map.
    const renderDraftBanner = async () => {
        const box = document.getElementById("draftbanner");
        if (!box)
            return;
        const drafts = isSignedIn() ? await pendingDrafts() : [];
        box.hidden = drafts.length === 0;
        if (!drafts.length) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = "";
        const n = drafts.reduce((s, p) => s + (p.beds?.length ?? 0), 0);
        const what = drafts.length === 1
            ? `a garden drafted while signed out (${drafts[0].name ?? "unnamed"}, ${n} bed${n === 1 ? "" : "s"})`
            : `${drafts.length} gardens drafted while signed out`;
        const p = document.createElement("p");
        p.textContent = `This device holds ${what}. Add it to your account, or discard it? It stays put until you choose.`;
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add to my account";
        add.addEventListener("click", () => void (async () => {
            const adopted = [];
            for (const d of await pendingDrafts())
                adopted.push(await adoptDraft(d));
            box.hidden = true;
            if (adopted.length)
                await activatePlot(adopted[0].id);
        })());
        const discard = document.createElement("button");
        discard.type = "button";
        discard.textContent = "Discard draft";
        let armed = false;
        discard.addEventListener("click", () => void (async () => {
            if (!armed) {
                armed = true;
                discard.textContent = "tap again to discard - this cannot be undone";
                return;
            }
            for (const d of await pendingDrafts())
                await discardDraft(d);
            box.hidden = true;
            await refresh();
        })());
        const row = document.createElement("div");
        row.className = "logrow";
        row.append(add, discard);
        box.append(p, row);
    };
    app.refreshDraftBanner = () => void renderDraftBanner();
    // On sign-in the app lands you IN your garden (walkthrough round 21): pick the DEFAULT garden if
    // one is set, else the ONLY garden, else the one already current; move the location to its anchor;
    // and open "Your ground" on the Plan tab. Signed-in RELOADS already restore location via refresh's
    // empty-form path, so this runs on a deliberate sign-in from EVERY door - the form, sign-up, and
    // an email confirmation/recovery link (account.ts calls it on all three, D-152).
    app.onSignIn = async () => {
        // D-152: an EMPTY account signing in over a real draft is the sign-up story - the draft simply
        // becomes the account's first garden, no ceremony (this also covers the email-confirmation
        // path, where sign-up and first sign-in are the same moment). An account that already has
        // gardens instead gets the ask-once banner rendered below - no silent merge, ever.
        const accountPlots = await listPlots(db); // signed in → the account workspace
        if (!accountPlots.length) {
            for (const d of await pendingDrafts())
                await adoptDraft(d);
        }
        let plots = await listPlots(db);
        void renderDraftBanner();
        if (!plots.length) {
            // O27 rec 3: the ladder state crosses the signup boundary. A brand-new account with nothing
            // drafted but an answers-page location (the ZIP they traded for the climate card) starts
            // its first garden already anchored there - nothing given is asked twice, past the account
            // door too. The crop they asked about becomes the ask card's suggested first planting.
            let ladder = {};
            try {
                ladder = JSON.parse(localStorage.getItem("gg-answers") ?? "{}");
            }
            catch { /* private mode / malformed - the account just starts empty */ }
            if (typeof ladder.lat !== "number" || typeof ladder.lon !== "number")
                return;
            await setPlotAnchorOnce(db, defaultWorkspacePlotId(), ladder.lat, ladder.lon, ladder.zip ? `ZIP ${ladder.zip}` : undefined);
            plots = await listPlots(db);
            if (!plots.length)
                return;
        }
        // This device now holds an existing account's gardens, so it has "started" - skip the D-027
        // landing on every subsequent load, matching the device the account was created on. markStarted
        // is per-device localStorage (not synced), so each new device must be told once, here (D-106).
        app.markStarted?.();
        const defId = defaultPlotId();
        const pick = (defId ? plots.find((p) => p.id === defId) : null)
            ?? (plots.length === 1 ? plots[0] : plots.find((p) => p.id === app.currentPlotId))
            ?? plots[0];
        await activatePlot(pick.id);
        // The returning gardener's first experience is the state-aware home (maintainer, 2026-08-01,
        // amending walkthrough round 21's land-in-the-garden): sign-in opens the landing's answer -
        // the garden view, the ask, what is due. Only when the picked garden has nothing to show (an
        // empty shell: no beds, no seasons) does the old path stand, because the landing would show
        // the stranger's doors to a signed-in user - the one thing worse than a busy first screen.
        if (hasGround()) {
            location.hash = "#/start";
            return;
        }
        location.hash = "#/plan";
        const ground = document.getElementById("sec-ground");
        if (ground)
            ground.open = true; // the sheet's toggle handler collapses the rest, lifts, and scrolls
    };
    // The mirror of onSignIn: on sign-out the account's gardens leave the screen (they stay cached
    // on the device for the next sign-in - hidden, not wiped; D-152, maintainer decision 2026-07-29).
    // The view returns to the DRAFT workspace: the device's own draft garden if one exists, else a
    // clean slate with blank location - never the last user's beds and address.
    app.onSignOut = async () => {
        const drafts = (await listPlots(db)).filter((p) => !p.example); // signed out → drafts
        setCurrentPlot(drafts[0]?.id ?? defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        void renderDraftBanner(); // signed out → it hides
        mapRefit?.();
        await refresh();
        app.refreshAuthGate?.();
    };
    // "Show me an example" (D-029): seed the disposable, non-syncing demo garden, mark this device
    // started (so the stranger exploring it isn't dumped back to the landing on reload), and activate
    // it - the ordinary garden-switch path, so climate/ledger/Calendar all follow. Its mirror tears
    // the demo down and returns to the user's own garden, or to the landing if they have none.
    app.showExample = async () => {
        await seedExampleGarden(db, new Date().getFullYear(), bundle);
        app.markStarted?.();
        await activatePlot(EXAMPLE_PLOT_ID);
        // The demo lands on the state-aware home (maintainer, 2026-08-01): the landing's returning
        // state IS the example's first screen now - the mock garden drawn, its dates, its banner -
        // instead of dropping the visitor into the planner. activatePlot's refresh has already
        // rendered it; the hash only has to stay on / move to the landing.
        location.hash = "#/start";
    };
    // `toLanding` is the CALLER's intent, because the two callers want opposite endings: the
    // banner's "Remove example" is a visitor leaving the demo (→ the front door), while "Start
    // planning" tapped from inside the demo is a visitor entering their own garden (→ Plan, with
    // the demo simply cleared out of the way).
    app.removeExample = async (toLanding = false) => {
        await removeExampleGarden(db);
        const rest = (await listPlots(db)).filter((p) => !p.example);
        if (rest.length) {
            await activatePlot(rest[0].id);
            location.hash = "#/plan"; // they have real ground - back to it
            return;
        }
        // Workspace-aware id (D-152): a signed-out visitor starts a draft, a signed-in one an
        // account garden.
        setCurrentPlot(defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        await refresh();
        app.refreshAuthGate?.();
        if (!toLanding) {
            location.hash = "#/plan";
            return;
        }
        // NOTHING OF THEIR OWN, and they asked to leave: back to the front door (maintainer,
        // 2026-07-31). This REVERSES the earlier "land on a clean Plan, don't make them restart the
        // flow" call, and the reason is D-168: back then the landing was a Start-planning splash, so
        // returning to it really was a dead restart. Now the landing IS the journey - four
        // problem-shaped doors - so the empty Plan page is the dead end and the doors are what a
        // visitor who just browsed a demo actually needs. The started flag goes with it: showExample
        // set it so the demo survived a reload, and a device leaving the demo owning no garden is
        // exactly the stranger it was before.
        app.clearStarted?.();
        // Back to the front door - AND to the top of it. Leaving the demo from the landing means the
        // hash is already #/start, so assigning it fires no route change and the router's own
        // scroll-to-top never runs: the visitor was left partway down the long editorial landing that
        // had just replaced the short returning view, which is the "weird state" the maintainer hit.
        location.hash = "#/start";
        window.scrollTo(0, 0);
    };
    // Account & sync (Phase 4 / D-020) - wired BEFORE the first refresh await so the Account
    // page has its status and config UI even if the initial log render is slow or fails.
    initAccount(db, () => void refresh());
    // The ground map (Plan tab): address/imagery/tracing. Reads the same lat/lon inputs the
    // climate does; saved areas become beds via the ordinary placeBed gate.
    app.logDb = db;
    const gm = initGroundMap(db, () => app.currentPlotId, () => {
        const lat = num("lat"), lon = num("lon");
        return lat != null && lon != null ? { lat, lon } : null;
    }, () => void refresh(), (id) => void activatePlot(id));
    app.groundRedraw = gm.redraw;
    app.groundCenterOn = gm.centerOn;
    mapRefit = gm.refit;
    await refresh();
    // A signed-in reload with a draft still awaiting its keep-or-discard answer re-shows the ask
    // (D-152): the banner is persistent until answered, never a one-shot toast.
    void renderDraftBanner();
}
// ---------------------------------------------------------------- intake wiring
