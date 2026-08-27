// The answers surface (exchange ladder, approved mockup 2026-07-30) - the landing's problem-shaped
// doors land here. The contract is tit for tat: one small input, one immediate answer computed by
// the live engine, then the next invitation. Rung 1: a ZIP buys the climate card. Rung 2: a crop
// buys its dates and a signed-out ICS (the O5 reminder rides it - account buys KEEPING things, not
// seeing things). Door 2 enters the same ladder crop-first. Nothing here is fabricated: every date
// is the same R-096/R-097/R-031 arithmetic the calendar plans by, every claim carries the corpus's
// own provenance, and where the corpus has no date (fall-sown, perennial, GDD) the card says so
// instead of inventing one.
//
// Not a wizard (Q-B2 stands): no section withholds an answer to force a next step, and the full
// planner is one chip away at every rung. Rung 3 (a size buys the fit verdict) is deliberately NOT
// here yet - it needs the units machinery - so the "will these fit?" chip hands off to the planner.
import { plantHref, plantLink } from "./panels/plantcard.js";
import { needsInsects } from "./engine/forage.js";
import { strongestSupportRequirement } from "./engine/openbed.js";
import { VALUE_WORD } from "./engine/plantcard.js";
import { resolveClimate, resolveZone, zipToLatLon } from "./engine/intake.js";
import { resolveSpecies } from "./engine/compiler.js";
import { displayName } from "./engine/guilds.js";
import { resolveDtm, shareOrDownloadIcs, tasksToIcs, monthDay } from "./calendar.js";
import { remindChoice, setRemindChoice } from "./units.js";
import { countRung } from "./analytics.js";
import { $ } from "./dom.js";
import { containerCrops, headlineTeams, quickCrops, situationFromHash, situations } from "./doors.js";
import { CHECK_SVG } from "./panels/soil.js";
import { app, commonName } from "./state.js";
import { humanize } from "./engine/labels.js";
/** Rung 1: everything the climate card states, from the same nationwide resolver the app plans by
 *  (D-113/D-129). Null when the point resolves nowhere - the card then refuses, it never guesses. */
export function climateAnswer(lat, lon, bundle) {
    const clim = resolveClimate(lat, lon, bundle);
    if (!clim)
        return null;
    const zone = resolveZone(lat, lon, bundle);
    const site = clim.site;
    const hard = site.hardiness;
    const stn = (site.provenance?.station ?? null);
    return {
        lastP50: site.last_frost_32f?.p50 ?? null,
        lastP10: site.last_frost_32f?.p10 ?? null,
        firstFreeze: site.first_freeze_32f_p50 ?? null,
        seasonDays: site.growing_season_days_p50 ?? null,
        zoneLabel: zone?.label ?? (zone?.zone != null ? String(zone.zone) : null)
            ?? hard?.label ?? (hard?.zone != null ? String(hard.zone) : null),
        stationName: stn?.name ?? null,
        distanceKm: clim.distanceKm,
        grade: clim.effectiveGrade,
        caveat: clim.caveat,
    };
}
/** MM-DD -> the next occurrence on or after `todayIso` (YYYY-MM-DD), as YYYY-MM-DD. The card and
 *  the ICS both want the date a gardener can still act on, not last spring's. */
export function nextOccurrence(mmdd, todayIso) {
    const year = Number(todayIso.slice(0, 4));
    const thisYear = `${year}-${mmdd}`;
    return thisYear >= todayIso ? thisYear : `${year + 1}-${mmdd}`;
}
const mmddShift = (mmdd, days) => {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(2001, mm - 1, dd + days); // non-leap anchor year; we only keep MM-DD
    if (d.getFullYear() !== 2001)
        return null;
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Rung 2: the crop's dates at this point, composed from the SAME corpus-sourced offsets the
 *  calendar uses - R-097 start_indoors_weeks, R-096 cool-season offsets, R-031's tender gate -
 *  anchored on the resolved site's frost percentiles. Where the corpus carries no date for the
 *  crop (fall-sown, perennial, GDD-scheduled), the card says what it knows instead of inventing:
 *  that refusal is the product, not a gap in it. */
export function cropAnswer(sid, lat, lon, todayIso, bundle) {
    const clim = resolveClimate(lat, lon, bundle);
    const site = clim?.site;
    if (!site)
        return null;
    if (!bundle.species.some((s) => s.id === sid))
        return null;
    const sp = resolveSpecies(sid, null, bundle);
    const label = commonName(bundle, sid) || humanize(sid);
    const p50 = site.last_frost_32f?.p50 ?? null;
    const p10 = site.last_frost_32f?.p10 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    const rows = [];
    const tasks = [];
    const dated = (key, rowLabel, mmdd, kind, text) => {
        const date = nextOccurrence(mmdd, todayIso);
        rows.push({ key, label: rowLabel, date, note: null });
        tasks.push({ date, kind, species: sid, text, cat: kind === "start_indoors" ? "sow" : "plant" });
    };
    const tol = sp.frost_tolerance;
    const model = sp.scheduling_model;
    const fallSown = sp.sow_season === "fall";
    const wk = typeof sp.start_indoors_weeks === "number" && sp.start_indoors_weeks > 0 ? sp.start_indoors_weeks : null;
    let setOutMmdd = null; // the spring anchor actually offered - the still-fits lens keys on it
    // R-097: the indoor head start, the species' own lead off the median last frost.
    if (wk && p50) {
        const d = mmddShift(p50, -wk * 7);
        if (d)
            dated("indoors", "Start seeds indoors around", d, "start_indoors", `Start ${label} seeds indoors - about ${wk} weeks before your last frost; set the seedlings out after it.`);
    }
    // R-031 (tender) / R-096 (hardy, half-hardy): when it can go OUTSIDE. Fall-sown crops are
    // excluded from spring arithmetic exactly as the calendar excludes them.
    if (!fallSown && p50) {
        if (tol === "tender" || tol == null) {
            if (p10) {
                dated("setout-safe", "Set plants out (frost-tender): a safe bet is", p10, "plant_after_last_frost", `Set ${label} out - past the date only 1 year in 10 still frosts after.`);
                rows.push({ key: "setout-median", label: "Feeling lucky? Half of years are frost-free by", date: nextOccurrence(p50, todayIso), note: null });
                setOutMmdd = p10;
            }
            else {
                dated("setout-median", "Set plants out after your median last frost", p50, "plant_after_last_frost", `Set ${label} out - your median last frost has passed.`);
                setOutMmdd = p50;
            }
        }
        else {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const offs = (r096?.offset_days_before_last_frost ?? null);
            const off = tol === "hardy" ? offs?.hardy : offs?.half_hardy;
            if (off && off > 0 && model === "dtm") {
                const d = mmddShift(p50, -off);
                const weeks = Math.round(off / 7);
                if (d) {
                    dated("cool-sow", `Sow or set out (${tol === "hardy" ? "cold-hardy" : "half-hardy"}) from about`, d, "cool_season", `Sow or set out ${label} - ${tol === "hardy" ? "cold-hardy" : "half-hardy"}, so it can go in about ${weeks} week${weeks === 1 ? "" : "s"} before your last frost.`);
                    setOutMmdd = d;
                }
            }
            else if (model === "dtm") {
                dated("setout-median", "Plant from your median last frost", p50, "plant_after_last_frost", `Plant ${label} - your median last frost has passed.`);
                setOutMmdd = p50;
            }
        }
    }
    if (fallSown) {
        rows.push({ key: "fall-sown", label: "", date: null,
            note: `${label} is fall-planted - it goes in ahead of winter, not on a spring date. ` });
    }
    // The perennial zone verdict (R-076): the gate is the zone RANGE, both ends deliberate.
    const zr = sp.hardiness_zone;
    if (Array.isArray(zr) && typeof zr[0] === "number" && typeof zr[1] === "number") {
        const zone = resolveZone(lat, lon, bundle);
        const zn = zone && typeof zone.zone === "number" ? zone.zone : null;
        const zl = zone?.label ?? (zn != null ? String(zn) : null);
        const conf = (sp.confidence ?? {});
        const est = (conf.estimated ?? []).includes("hardiness_zone") ? " The rated range is an estimate." : "";
        if (zn != null) {
            rows.push({ key: "zone", label: "", date: null,
                note: zn >= zr[0] && zn <= zr[1]
                    ? `Rated for zones ${zr[0]}-${zr[1]}; your zone ${zl} sits inside the range.${est}`
                    : `Rated for zones ${zr[0]}-${zr[1]} - your zone ${zl} falls outside it, so overwintering is a real risk.${est}` });
        }
    }
    // R-030: summer night heat can carve a gap out of the season - say so up front (a Houston tomato).
    const night = site.summer_night_tmin_c ?? null;
    const nightMax = typeof sp.night_temp_max_c === "number" ? sp.night_temp_max_c : null;
    if (night != null && nightMax != null && night > nightMax) {
        rows.push({ key: "heat", label: "", date: null,
            note: `Heads up: your typical summer nights run warmer than ${label} sets fruit in - midsummer may pause it. Plant for spring and fall shoulders.` });
    }
    // R-102: a crop that cannot pollinate itself. Undated on purpose - it is a fact about the plant,
    // not a date in the season, and the undated note row is already this page's shape for that
    // (zone, heat, fall-sown above).
    //
    // IT STATES THE REQUIREMENT AND STOPS THERE. A visitor to this page has told us a ZIP and a crop
    // and nothing else - no plant list, no garden. The bed report can say "nothing else here is in
    // flower" because it can see the bed; this page cannot, and asserting a gap in a garden we have
    // never seen would be inventing one. The difference between the two sentences is the difference
    // between a fact and a guess.
    if (needsInsects(sp)) {
        rows.push({ key: "insect-vector", label: "", date: null,
            note: `${label} cannot pollinate itself - an insect has to carry pollen from its male flowers `
                + `to its female ones. Worth planning something that flowers alongside it.` });
    }
    // O80c: the support requirement, same undated-note shape - a visitor asking about pole beans
    // should hear they climb BEFORE planting day, not from a flag after. Strongest across
    // varieties (the advise-until-resolved rule): this page has no picked variety by construction.
    {
        const strongest = strongestSupportRequirement(sp);
        const word = VALUE_WORD["support.requires"][strongest];
        if (word) {
            const varies = strongest !== String(sp.support?.requires ?? "none");
            rows.push({ key: "support", label: "", date: null,
                note: `${word.replace(/^Needs/, `${label} needs`).replace(/^Better/, `${label} is better`)}`
                    + `${varies ? " (depends on the variety - bush types stand on their own)" : ""}`
                    + `, set at planting time.` });
        }
    }
    // The season's end, always - the one date every annual plans against.
    if (ff) {
        rows.push({ key: "freeze", label: "Season ends (first fall freeze, typical year)", date: nextOccurrence(ff, todayIso), note: null });
        tasks.push({ date: nextOccurrence(ff, todayIso), kind: "log_first_freeze", species: null, cat: "frost",
            text: `First fall freeze (median) - the season's end for tender crops.` });
    }
    // O25, the "still fits this season" lens (personas finding 5, folded into O27): a MID-SEASON
    // arrival - most of the year - sees spring dates that honestly answer "next spring," which is
    // true and deflating. When this crop's spring window has already passed AND the season is still
    // running, answer the question they actually have: can it still make it NOW? The bound is the
    // succession arithmetic the calendar already uses (D-108) - days to maturity against the days
    // left before the median first freeze. A crop that can't make it gets an honest refusal plus
    // what still fits; nothing here invents a date the corpus doesn't carry.
    if (!fallSown && model === "dtm" && setOutMmdd && ff) {
        const year = todayIso.slice(0, 4);
        const windowPassed = `${year}-${setOutMmdd}` < todayIso;
        const freezeThisYear = `${year}-${ff}`;
        const seasonRunning = todayIso <= freezeThisYear;
        const daysTo = (aIso, bIso) => {
            const p = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))).getTime();
            return Math.round((p(bIso) - p(aIso)) / 86400000);
        };
        if (windowPassed && seasonRunning) {
            const daysLeft = daysTo(todayIso, freezeThisYear);
            const dtm = resolveDtm(sp, null);
            const MARGIN = 7; // a week of slack on the optimistic end of the range - honest, not heroic
            if (dtm && dtm[0] + MARGIN <= daysLeft) {
                const how = wk ? "from a started plant you can buy now" : "sown now";
                rows.push({ key: "still-fits", label: "", date: null,
                    note: `Missed spring? ${label} still fits: about ${daysLeft} frost-free days remain and it needs ~${dtm[0]}, ${how}. The dates above are next spring's.` });
                tasks.push({ date: todayIso, kind: "cool_season", species: sid, cat: "sow",
                    text: `${wk ? "Plant" : "Sow"} ${label} now - it can still mature (~${dtm[0]} days) before your typical first freeze (~${monthDay(ff)}).` });
            }
            else if (dtm) {
                // the refusal, with what still fits - scanned from the same corpus numbers, shortest first
                const fits = bundle.species
                    .map((s) => s)
                    .filter((s) => s.scheduling_model === "dtm" && s.sow_season !== "fall" && s.id !== sid)
                    .map((s) => ({ id: s.id, dtm: resolveDtm(s, null) }))
                    .filter((x) => !!x.dtm && x.dtm[0] + MARGIN <= daysLeft)
                    .sort((a, b) => a.dtm[0] - b.dtm[0])
                    .slice(0, 4);
                const alts = fits.map((f) => commonName(bundle, f.id) || humanize(f.id)).join(", ");
                rows.push({ key: "still-fits-no", label: "", date: null,
                    note: `Missed spring? Honest answer: planted now, ${label} likely won't beat your first freeze - it needs ~${dtm[0]} days and about ${daysLeft} remain. The dates above are next spring's.`
                        + (alts ? ` Still fits today: ${alts}.` : " The season is past new sowings.") });
            }
        }
    }
    const bits = [];
    if (wk)
        bits.push(`the indoor start is ${label}'s own ${wk}-week lead before your median last frost`);
    if (tol === "tender" || tol == null)
        bits.push("set-out waits for frost to pass because it is frost-tender");
    if (tol === "hardy" || tol === "half_hardy")
        bits.push("it is cold-hardy enough to go in ahead of the last frost");
    return { species: sid, rows, tasks,
        explain: bits.length ? `Your dates, not a seed packet's: ${bits.join("; ")}.` : "Your dates come from your resolved climate, not a seed packet." };
}
/** Door 2: which of the curated teams carry this crop - members and role canonicals both count.
 *  The list is short because the corpus is (that is the point); an empty answer is stated, not
 *  padded with folklore. */
export function cropTeams(sid, bundle) {
    const carries = (g) => {
        const members = (g.members ?? []);
        if (members.some((m) => m.species === sid))
            return true;
        return (g.roles ?? []).some((r) => r.canonical === sid);
    };
    return bundle.guilds.filter(carries);
}
const STATE_KEY = "gg-answers";
const loadState = () => {
    try {
        return JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}");
    }
    catch {
        return {};
    }
};
const saveState = (s) => {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(s));
    }
    catch { /* private mode */ }
};
// The quick chips: common crops a first visitor recognizes, resolved against the bundle so a
// missing id degrades to the filter rather than a dead chip.
const QUICK = ["solanum_lycopersicum", "capsicum_annuum", "allium_sativum", "cucurbita_pepo", "lactuca_sativa", "ocimum_basilicum"];
const fmtDate = (iso, todayIso) => {
    const md = monthDay(iso.slice(5));
    return iso.slice(0, 4) === todayIso.slice(0, 4) ? md : `${md}, ${iso.slice(0, 4)}`;
};
/** The crop carried by a deep link: `#/answers?crop=<species id>` (O23 / D-168 call 3).
 *
 *  THIS IS ONE HALF OF A CONTRACT WITH A SECOND RENDERER. `engine/build_pages.py` writes that URL
 *  onto all 73 species pages, and the largest arrival cohort reaches the product through one
 *  (PERSONAS.md finding 1: Rita's front door is the tomato page, never the landing). If the two
 *  sides ever disagree on the parameter's name the link does not break loudly - it opens a ladder
 *  with nothing pre-chosen, which reads exactly like a visitor who arrived cold. Both sides are
 *  therefore pinned by tests, in both languages.
 *
 *  Pure, and deliberately strict about the shape: a species id is lowercase word characters, so
 *  anything else is not a crop and is refused here rather than half-matched downstream. Returns the
 *  id as WRITTEN - whether the corpus actually carries it is a different question, answered by the
 *  caller, because "malformed" and "unknown" deserve different sentences. */
export function cropFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("crop");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}
/** The ZIP carried by a deep link: `#/answers?zip=55401` (the frost pages' door).
 *
 *  Same contract, same silent failure mode, as `cropFromHash` above - `engine/build_pages.py`
 *  writes this URL on every location page, and a rename on either side leaves a link that still
 *  resolves and simply arrives with nothing filled in. Strict about the shape: five digits, because
 *  that is what the bundled Census table is keyed by; anything else is not a ZIP and is refused
 *  here rather than typed into the field for the visitor to puzzle over. */
export function zipFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("zip");
    if (!raw)
        return null;
    const z = raw.trim();
    return /^\d{5}$/.test(z) ? z : null;
}
/** The guild carried by a deep link: `#/plan?guild=<guild id>` (O58 Phase 3 - the "Plan this guild"
 *  CTA on every guild page). The THIRD instance of the two-language contract: `engine/build_pages.py`
 *  writes this URL, and the app reads it here; a rename on either side leaves a link that still opens
 *  the Plan page and simply arrives with no team pre-selected, so both sides are pinned by tests.
 *
 *  A guild id is the same lowercase-word shape as a crop or a species, so this mirrors `cropFromHash`.
 *  Returns the id as written; whether the corpus still carries it is the caller's question (applyHashGuild
 *  in app.ts), because a MALFORMED id and an UNKNOWN one deserve different handling - null here, a
 *  by-name refusal there. Note the target route is `#/plan`, not `#/answers`: a team is placed on a bed,
 *  and that surface is the Plan page. */
export function guildFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("guild");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}
// O46: a list of plant names is a list of links. Built name-by-name from the ids the list was
// built FROM - never by splitting the joined string and hunting for names in it, which is the
// prose-scanning this project rules out. The separator matches what each list used to `join` with,
// so the rendered text is character-for-character what it was.
function nameList(host, items) {
    items.forEach((it, i) => {
        if (i)
            host.appendChild(document.createTextNode(" · "));
        host.appendChild(plantLink(it.label, it.id));
    });
}
// O58 linking: the persona spine -> its guide. Each landing SITUATION (doors.ts) is exactly the
// gardener a guide was written for, so the answer card ends on the matching how-to. This is the
// strongest guide integration the app has - it closes the one-way link graph at the moment the
// reader has just been given an answer and is most ready to go deeper. The link is the static page
// at the domain root (../guides/<slug>/, new tab), the same form the coachband uses.
//
// AT MODULE SCOPE AND EXPORTED (O65): it is a constant with no closure dependency, so rebuilding it
// on every initAnswers call bought nothing - and the slugs are hand-typed strings rendered straight
// into a URL, which nothing resolved against the real guide files until the test that now imports
// this. A guide rename used to ship a silent 404 from here.
export const SITUATION_GUIDE = {
    containers: { slug: "container-vegetable-gardening", label: "Growing vegetables in containers" },
    earlystart: { slug: "read-a-planting-calendar", label: "How to read a planting calendar" },
    midseason: { slug: "succession-planting", label: "Succession planting" },
    shade: { slug: "where-to-put-a-garden", label: "Where to put a garden - sun and shade" },
    clay: { slug: "build-a-raised-bed", label: "How to build a raised bed" },
};
export function initAnswers(bundle, hooks) {
    const state = loadState();
    const todayIso = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const zipEl = $("anszip");
    const hint = $("anszip-hint");
    const climCard = $("ansclimate");
    const chipsEl = $("anschips");
    const cropHint = $("anscrop-hint");
    const filterEl = $("anscropq");
    const filterList = $("anscroplist");
    const datesCard = $("ansdates");
    const icsRow = $("ansicsrow");
    const teamsCard = $("ansteams");
    const nextRow = $("ansnext");
    // ---- collapse-to-receipt (approved 2026-08-01, docs/mockups/answers-progression.html) ---------
    //
    // THE FAULT THIS FIXES, measured on a 390x844 phone before any of it was written: nothing on this
    // page ever reloaded (zero navigations), but an answered question kept its form at full size and
    // the answer was appended BELOW it. The page went 981 -> 1736 -> 2066 px, scroll stayed at 0, and
    // the "Where" block grew from 69 px to 344 px while still holding its input. So a visitor typed a
    // ZIP and the screen still showed them the field they had just filled, with the answer they
    // bought below the fold. It read as recycled because visibly nothing had progressed.
    //
    // An answered question now folds to ONE LINE stating what it bought, with "change" to reopen -
    // the Plan page's own need -> earned trade grammar, which is why this needed no new vocabulary.
    // NO STEP PATH (maintainer's ruling): the pathbar is the planner's device, and a browsing surface
    // should not be dressed as a process.
    const editing = { zip: false, crop: false };
    /** Fold a question into its receipt, or reopen it. `summary` is what the fact bought, in the
     *  fewest words that still say something - never "ZIP: 55401", which reports the input back. */
    const setReceipt = (which, summary) => {
        const box = document.getElementById(`ans${which}-receipt`);
        const form = document.getElementById(`ans${which}-form`);
        if (!box || !form)
            return;
        const folded = !!summary && !editing[which];
        box.hidden = !folded;
        form.hidden = folded;
        if (!folded)
            return;
        box.replaceChildren();
        // A DRAWN check, never the character (D-105 names U+2713 among the forbidden symbols, and the
        // emoji guard caught it here). Same mark the soil ladder draws for a completed rung.
        const tick = document.createElement("span");
        tick.className = "ans-r-tick";
        tick.innerHTML = CHECK_SVG;
        const t = document.createElement("span");
        t.className = "ans-r-t";
        t.textContent = summary;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ans-r-edit";
        btn.dataset.reopen = which;
        btn.textContent = "change";
        btn.addEventListener("click", () => {
            editing[which] = true;
            setReceipt(which, summary);
            if (which === "zip" && state.lat != null && state.lon != null)
                climCard.hidden = false;
            // reopening is a deliberate act, so put the cursor where the work is
            document.getElementById(which === "zip" ? "anszip" : "anscropq")?.focus();
        });
        box.append(tick, t, btn);
    };
    /** Bring a freshly-rendered answer FULLY into view with the SMALLEST possible movement.
     *
     *  The distinction the maintainer drew, and it is the whole design here: the page must not JUMP
     *  to an answer (that reads as a reload), but the answer must not land half off the bottom
     *  either - "when the user clicks a question, the answer needs to appear fully visible". So this
     *  never re-anchors the page; it nudges by exactly the overshoot, and not at all when the answer
     *  already fits on screen. An answer taller than the viewport puts its TOP just inside, since
     *  reading starts there.
     *
     *  `scrollIntoView({ block: "nearest" })` was not enough: it satisfies itself once any edge is in
     *  view, which is precisely the "only partially visible" state being complained about. */
    const MARGIN = 16;
    /** The band a reader can actually SEE. On a phone the nav is `position: fixed; bottom: 0`, so an
     *  answer whose bottom sits at window.innerHeight is behind the tab bar, not on screen - which is
     *  why "fully visible" measured true while the maintainer could not read the end of it. Measure
     *  the chrome instead of assuming the viewport is the band. */
    const readableBand = () => {
        // THE VISUAL VIEWPORT, not the layout one. On a phone `window.innerHeight` is the LAYOUT
        // viewport and stays large while the browser's own URL bar covers the bottom of what you can
        // actually see - so an answer measured as "wholly visible" can still be under that bar. Worse,
        // scrolling COLLAPSES the bar, which changes the geometry mid-interaction: the first tap
        // measures one viewport and the second measures another, which is the shape of "needed to click
        // twice". Headless has no URL bar, so no harness here reproduces it - this one is reasoned from
        // the platform, and the settle re-check below is what makes it self-correcting either way.
        const vv = window.visualViewport;
        let top = vv ? vv.offsetTop : 0;
        let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        for (const el of document.querySelectorAll("header.site nav, header.site")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden")
                continue;
            if (cs.position !== "fixed" && cs.position !== "sticky")
                continue;
            const r = el.getBoundingClientRect();
            if (r.height <= 0)
                continue;
            const mid = (top + bottom) / 2;
            if (r.top > mid)
                bottom = Math.min(bottom, r.top); // a bottom bar
            else if (r.bottom < mid)
                top = Math.max(top, r.bottom); // a top bar
        }
        return { top, bottom };
    };
    /** How far the page must move for `el` to sit wholly inside the readable band. 0 = it already is. */
    const overshoot = (el) => {
        const r = el.getBoundingClientRect();
        const band = readableBand();
        const room = band.bottom - band.top;
        if (r.height > room - MARGIN * 2)
            return r.top - band.top - MARGIN; // taller than the band
        if (r.bottom > band.bottom - MARGIN)
            return r.bottom - band.bottom + MARGIN; // under the bar
        if (r.top < band.top + MARGIN)
            return r.top - band.top - MARGIN; // clipped at the top
        return 0;
    };
    /** Scroll the answer wholly into the readable band - and then CHECK, because one measurement is
     *  not enough on a real device.
     *
     *  Two reports made that plain: "needed to click twice to get the slide", and an occasional
     *  partial slide. Both come from measuring once against a page that is still moving. A smooth
     *  scroll is asynchronous; a phone may still be carrying momentum from the flick that brought the
     *  chips into view; and the row itself can change height in the same tick. So: measure after
     *  layout has settled (two frames, not a microtask), scroll, then re-measure when the scroll ends
     *  and correct what is left. Bounded, and it gives up rather than fighting a reader who has
     *  deliberately scrolled somewhere else. */
    const revealFully = (el, tries = 0) => {
        if (el.hidden || !el.offsetParent)
            return;
        const delta = overshoot(el);
        if (Math.abs(delta) < 2)
            return; // already comfortably whole
        if (tries > 0 && Math.abs(delta) > 600)
            return; // they have moved on; do not yank them back
        if (tries >= 3)
            return;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        window.scrollBy({ top: delta, behavior });
        // Re-measure once the scroll settles. Measured honestly: in headless this changes nothing (the
        // one-shot scroll already lands correctly), so it is NOT the fix for anything reproducible
        // here. It earns its place on a real phone, where the URL bar collapses DURING this scroll and
        // the band it was computed against no longer exists by the time the scroll ends.
        const recheck = () => revealFully(el, tries + 1);
        if ("onscrollend" in window)
            window.addEventListener("scrollend", recheck, { once: true });
        else
            setTimeout(recheck, 320);
        // ...and if the visible area itself changes (the URL bar showing or hiding), correct for it.
        window.visualViewport?.addEventListener("resize", recheck, { once: true });
    };
    /** Wait for layout to settle before the first measurement. A microtask runs BEFORE the browser
     *  lays the new content out, so the rect it reads can be the old one - which is how a first tap
     *  produced no slide and a second tap produced the right one. */
    const revealWhenSettled = (el) => {
        requestAnimationFrame(() => requestAnimationFrame(() => revealFully(el)));
    };
    /** The older, weaker rule kept for the ZIP/crop answers, which render UNDER the field the visitor
     *  is typing in: there, moving the page at all while an input holds focus is the annoyance. */
    const revealIfOffscreen = (el) => {
        if (el.hidden)
            return;
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.offsetParent !== null)
            return;
        revealFully(el);
    };
    const renderClimateCard = () => {
        if (state.lat == null || state.lon == null) {
            climCard.hidden = true;
            renderCrop();
            return;
        }
        const a = climateAnswer(state.lat, state.lon, bundle);
        if (!a) {
            climCard.hidden = false;
            climCard.innerHTML = "";
            const p = document.createElement("p");
            p.className = "ans-noresolve";
            p.textContent = "We can't resolve a climate for that point - the resolver refuses rather than guesses. Try a nearby ZIP.";
            climCard.append(p);
            renderCrop();
            return;
        }
        // O29 rung 1 CROSSED - and crossed here, at the card that actually rendered, not at the
        // keystroke: a ZIP that resolved nothing bought nothing, and counting it would report a depth
        // the visitor never reached.
        countRung("rung-loc");
        climCard.hidden = false;
        climCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `Your climate - ZIP ${state.zip ?? ""}`;
        climCard.append(h);
        if (a.lastP50) {
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = `Last spring frost: usually around ${monthDay(a.lastP50)}`;
            climCard.append(big);
        }
        const row = (label, value) => {
            const div = document.createElement("div");
            div.className = "ans-row";
            const l = document.createElement("span");
            l.textContent = label;
            const v = document.createElement("span");
            v.textContent = value;
            div.append(l, v);
            climCard.append(div);
        };
        if (a.lastP10)
            row("A safe bet (1 year in 10 still frosts)", `after ${monthDay(a.lastP10)}`);
        if (a.firstFreeze)
            row("First fall freeze, typical year", monthDay(a.firstFreeze));
        if (a.seasonDays != null)
            row("Growing season", `about ${a.seasonDays} days`);
        if (a.zoneLabel)
            row("Hardiness zone (perennials)", a.zoneLabel);
        // the question folds: what the ZIP bought, in one line. Reopening set `editing` so the form
        // would stay open under the visitor's hands; a NEW answer clears it, or "change" would fold the
        // question once and never again (caught by the e2e check, not by reading this code).
        editing.zip = false;
        setReceipt("zip", `${state.zip ?? "Located"} - ${a.zoneLabel ? `zone ${a.zoneLabel.replace(/^zone\s*/i, "")}` : "located"}`
            + (a.lastP50 ? `, last frost ${monthDay(a.lastP50)}` : ""));
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = a.stationName
            ? `From NCEI station ${a.stationName}${a.distanceKm > 2 ? `, ~${Math.round(a.distanceKm)} km away` : ""} - grade ${a.grade}. Odds from 30 years of records, not promises.`
            : `${a.caveat} Grade ${a.grade}.`;
        climCard.append(prov);
        revealIfOffscreen(climCard);
        renderCrop();
    };
    const cropLabel = (sid) => commonName(bundle, sid) || humanize(sid);
    // ---- O34's situation answer ------------------------------------------------------------------
    // The visitor who arrives IN a situation rather than WITH a question gets that answer first, and
    // it is computed from the corpus every time - never a curated "good for pots" list, which would
    // be an opinion wearing the corpus's clothes.
    // The situation row, ONE LAYER DEEPER (maintainer's ruling). Hidden until the visitor has been
    // GIVEN something - a climate card, a crop's dates, or the teams answer they arrived for - so it
    // reads as "now narrow it" instead of as more intake to get through. The row itself is built
    // once; only its visibility follows the journey.
    let sitRowBuilt = false;
    const renderSituationRow = () => {
        const box = document.getElementById("anssituations");
        const row = document.getElementById("anssitrow");
        if (!box || !row)
            return;
        if (!sitRowBuilt) {
            for (const sit of situations(new Date().getMonth() + 1)) {
                const a = document.createElement("a");
                a.className = "ans-sit";
                a.href = sit.href;
                a.dataset.situation = sit.id;
                const l = document.createElement("span");
                l.className = "ans-sit-l";
                l.textContent = sit.label;
                const w = document.createElement("span");
                w.className = "ans-sit-w";
                w.textContent = sit.why;
                a.append(l, w);
                row.append(a);
            }
            sitRowBuilt = true;
        }
        // "Given something" = a location resolved, a crop chosen, or the teams door's own answer up.
        const given = !!state.zip || !!state.crop || location.hash.includes("teams");
        box.hidden = !given;
    };
    const renderSituation = (arriving = false) => {
        const host = document.getElementById("anssituation");
        if (!host)
            return;
        const sit = situationFromHash(location.hash);
        host.hidden = !sit;
        host.innerHTML = "";
        if (!sit)
            return;
        const h = document.createElement("p");
        h.className = "ans-sit-h";
        h.textContent = sit.label;
        host.append(h);
        const card = document.createElement("div");
        card.className = "ans-card";
        host.append(card);
        // Whether they arrived cold or tapped a chip, the answer they asked for must end up WHOLLY on
        // screen - by the smallest movement that achieves it, never by re-anchoring the page.
        revealWhenSettled(host);
        void arriving;
        if (sit.id === "containers") {
            const r098 = bundle.rules.find((r) => r.id === "R-098");
            const span = r098?.params?.container_max_span_cm ?? 75;
            const fits = containerCrops(bundle.species, span, 14);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = `Fits a pot up to ${span} cm across`;
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, fits.map((f) => ({ id: f.id, label: f.name })));
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Computed from each plant's own mature spread and root depth against R-098's "
                + "container size - not a list of what usually gets recommended. Deep-rooted crops and anything "
                + "needing a pollination block are left out, and the reason is the plant's own record.";
            card.append(k, big, prov);
        }
        else if (sit.id === "midseason") {
            // ITS OWN ANSWER, not a redirect. The first cut said "give a ZIP and pick a crop", which is
            // door 1's answer wearing a different label - the overlap the maintainer caught. Door 1 tells
            // you when to plant a crop you have chosen; this tells you which crops are still worth
            // choosing, which is a different question with a different answer.
            const quick = quickCrops(bundle.species, 10);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Fastest to finish";
            const big = document.createElement("p");
            big.className = "ans-big";
            quick.forEach((c, i) => {
                if (i)
                    big.appendChild(document.createTextNode(" · "));
                big.appendChild(plantLink(c.name, c.id));
                big.appendChild(document.createTextNode(` ${c.days}d`));
            });
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Days to maturity from the corpus, soonest first. Give a ZIP below and the dates "
                + "say which of these still beat your own first freeze (R-032) - a crop that cannot finish is told "
                + "so plainly rather than quietly recommended.";
            card.append(k, big, prov);
        }
        else if (sit.id === "earlystart") {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const off = r096?.offset_days_before_last_frost ?? { hardy: 21, half_hardy: 14 };
            const hardy = bundle.species
                .filter((sp) => sp.frost_tolerance === "hardy" && String(sp.category ?? "") !== "cover_crop"
                && String(sp.category ?? "") !== "flower" && String(sp.lifespan ?? "") === "annual")
                .map((sp) => ({ id: String(sp.id), label: sp.common?.[0] ?? "" }))
                .filter((x) => !!x.label).sort((a, b) => a.label.localeCompare(b.label));
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = `Out about ${off.hardy ?? 21} days before your last frost`;
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, hardy);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = `These are the hardy annuals (R-096): roughly ${off.hardy ?? 21} days before the last `
                + `frost for hardy crops, ${off.half_hardy ?? 14} for half-hardy. Tender crops wait for the frost `
                + "itself (R-031) - the calendar dates each one against your own ZIP rather than a packet's guess.";
            card.append(k, big, prov);
        }
        else if (sit.id === "shade") {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Shade is a gate, not a preference";
            const shade = bundle.species
                .filter((sp) => sp.light_min === "shade" || sp.light_min === "part_sun")
                .map((sp) => ({ id: String(sp.id), label: sp.common?.[0] ?? "" }))
                .filter((x) => !!x.label).sort((a, b) => a.label.localeCompare(b.label));
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, shade);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "These tolerate part sun or less, by their own light requirement. The planner "
                + "refuses to place a full-sun plant in ground you have marked shaded (R-005), and computes the "
                + "shadow a taller neighbour casts (R-004) rather than leaving you to guess.";
            card.append(k, big, prov);
        }
        else {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Heavy clay";
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = "Do not add sand.";
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Sand plus clay is the one \"fix\" that reliably makes things worse - the mixture "
                + "sets harder than what you started with. Organic matter is the answer, and standing water after "
                + "rain is a site problem to solve before planting into it (R-100).";
            const link = document.createElement("a");
            link.className = "ans-more";
            link.href = "#/why?belief=B-015";
            link.textContent = "See the evidence on sand and clay →";
            card.append(k, big, prov, link);
        }
        // The persona-flow guide link, appended to whichever situation is on screen (clay already carries
        // its evidence link above, so it ends on evidence THEN how-to).
        const g = SITUATION_GUIDE[sit.id];
        if (g) {
            const gl = document.createElement("a");
            gl.className = "ans-more ans-guide";
            gl.href = `../guides/${g.slug}/`;
            gl.target = "_blank";
            gl.rel = "noopener";
            gl.textContent = `${g.label} →`;
            card.append(gl);
        }
    };
    const renderTeams = () => {
        teamsCard.hidden = false;
        teamsCard.innerHTML = "";
        // DOOR 2 HAS ITS OWN ANSWER NOW (O34). It used to open this page on the ZIP field with the
        // teams card EMPTY until a crop was picked - so the door that asked "what grows well together"
        // answered with a form about somewhere else. With no crop chosen the teams answer stands on
        // its own: every curated team, named, with what each one is FOR. Picking a crop then narrows
        // it, which is the ladder working rather than a precondition for it.
        if (!state.crop) {
            const h = document.createElement("p");
            h.className = "ans-k";
            h.textContent = "The kinds of team we can defend";
            teamsCard.append(h);
            // ABRIDGED, not enumerated (maintainer: "that's wordy, we shouldn't list everything"). One of
            // each KIND we hold, so the answer shows the range; the rest are counted honestly and reached
            // by naming a crop, which is the question that narrows them properly.
            const answer = headlineTeams(bundle.guilds, (g) => displayName(g));
            for (const t of answer.shown) {
                const row = document.createElement("p");
                row.className = "ans-team";
                const n = document.createElement("b");
                n.textContent = t.name;
                row.append(n);
                if (t.mechanism) {
                    const w = document.createElement("span");
                    w.textContent = ` - ${t.mechanism}`;
                    row.append(w);
                }
                teamsCard.append(row);
            }
            const prov0 = document.createElement("p");
            prov0.className = "ans-prov";
            prov0.textContent = `${answer.more} more, sized to the bed you have. Name a crop above and this narrows to `
                + "the teams that carry it. There is no companion-planting chart here - most of those trace to folklore, "
                + "and every team above names the mechanism it rests on.";
            teamsCard.append(prov0);
            return;
        }
        const teams = cropTeams(state.crop, bundle);
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `${cropLabel(state.crop)}'s teams`;
        teamsCard.append(h);
        // Everything the corpus records about this crop, one tap away. The ladder answers WHEN; the
        // card answers WHAT - spacing, light, soil, the rules that apply. A visitor who came for a date
        // frequently wants the rest, and until now there was nowhere to send them.
        const more = document.createElement("p");
        more.className = "ans-more";
        const ma = document.createElement("a");
        ma.href = plantHref(state.crop);
        ma.textContent = `Everything recorded about ${cropLabel(state.crop).toLowerCase()}`;
        more.append(ma);
        teamsCard.append(more);
        if (teams.length) {
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = teams.map((g) => displayName(g)).join(" · ");
            teamsCard.append(big);
        }
        else {
            const none = document.createElement("p");
            none.className = "ans-big";
            none.textContent = `None of the curated teams carries ${cropLabel(state.crop)} yet.`;
            teamsCard.append(none);
        }
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = "These are the teams the engine can defend - each pairing names its mechanism and its sources. "
            + "There is no companion-planting chart here, and that is deliberate: most of those charts trace to folklore.";
        teamsCard.append(prov);
    };
    const renderCrop = () => {
        // chips reflect the chosen crop
        for (const b of chipsEl.querySelectorAll("button")) {
            b.classList.toggle("on", b.dataset.sid === state.crop);
        }
        renderTeams();
        renderSituationRow(); // the row appears the moment something has actually been given
        // The crop question folds as soon as a crop is named - even before a location exists, because
        // naming the crop IS the answer to this question; the dates are what it buys once there is a
        // where to buy them for.
        if (state.crop)
            editing.crop = false; // a fresh answer ends the edit, same as the ZIP above
        setReceipt("crop", state.crop ? cropLabel(state.crop) : null);
        if (!state.crop || state.lat == null || state.lon == null) {
            // nothing later is answered, so the climate card stands at full height again
            if (state.lat != null && state.lon != null)
                climCard.hidden = false;
            datesCard.hidden = true;
            icsRow.hidden = true;
            nextRow.hidden = !state.crop && state.lat == null;
            return;
        }
        const t = todayIso();
        const a = cropAnswer(state.crop, state.lat, state.lon, t, bundle);
        if (!a) {
            datesCard.hidden = true;
            icsRow.hidden = true;
            return;
        }
        countRung("rung-crop"); // O29 rung 2: the dates are on screen, which is what the crop bought
        datesCard.hidden = false;
        // AN EARLIER ANSWER FOLDS WHEN A LATER ONE ARRIVES. Collapsing the question alone was not
        // enough: measured, the page still ran 1024 -> 1776 -> 2012 px, because the climate CARD stayed
        // at full height behind the answer the visitor had moved on to. Its receipt already carries the
        // headline it bought ("55401 - zone 5a, last frost Apr 23"), so the card folds into that line
        // and reopens with "change". This is the part that actually stops the page growing.
        if (!editing.zip)
            climCard.hidden = true;
        requestAnimationFrame(() => requestAnimationFrame(() => revealIfOffscreen(datesCard)));
        datesCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `${cropLabel(state.crop)} in ${state.zip ?? "your ZIP"}`;
        // O51 (imagery-surfaces ruling): the answered crop shows its face beside its dates - the crop
        // is NAMED here, which is the bar imagery has to meet. The 192px built thumb (~5 KB), never
        // the 50-158 KB card photo; the credit lives with the full photo on the plant card and page,
        // the same precedent as the guild member thumbs. A crop without a corpus image block simply
        // shows its dates, the same graceful absence as everywhere else.
        const crec = bundle.species.find((s) => s.id === state.crop);
        if (typeof crec?.image?.artist === "string") {
            const im = document.createElement("img");
            im.className = "ans-cropimg";
            im.dataset.spotPhoto = state.crop; // O55: any photo surface is a door to the photo editor
            im.src = `img/thumbs/${encodeURIComponent(state.crop)}.webp`;
            im.alt = "";
            im.width = 192;
            im.height = 192;
            im.loading = "lazy";
            im.decoding = "async";
            h.prepend(im);
        }
        datesCard.append(h);
        let first = true;
        for (const r of a.rows) {
            if (r.note !== null) {
                const p = document.createElement("p");
                p.className = "ans-note";
                p.textContent = r.note;
                datesCard.append(p);
            }
            else if (first && r.date) {
                // P2.5 / D-189: the crop's PRIMARY sow date is the ladder's payoff ("when do I plant X in
                // 55401"), so it is the date-as-answer - a --surface-deep band carrying the date at title
                // scale, the one dominant element on the rung. The label rides above it in the band's muted
                // voice; the climate card's last-frost stays a plain .ans-big (the maintainer's ruling: the
                // sow date is the answer, the climate is the anchor above it).
                const band = document.createElement("div");
                band.className = "ans-deep";
                const bl = document.createElement("p");
                bl.className = "ans-deep-l";
                bl.textContent = r.label;
                const bd = document.createElement("p");
                bd.className = "ans-deep-d";
                bd.textContent = fmtDate(r.date, t);
                band.append(bl, bd);
                datesCard.append(band);
                first = false;
            }
            else if (r.date) {
                const div = document.createElement("div");
                div.className = "ans-row";
                const l = document.createElement("span");
                l.textContent = r.label;
                const v = document.createElement("span");
                v.textContent = fmtDate(r.date, t);
                div.append(l, v);
                datesCard.append(div);
            }
        }
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = a.explain;
        datesCard.append(prov);
        icsRow.hidden = a.tasks.length === 0;
        nextRow.hidden = false;
    };
    // rung 1: the ZIP (live, like the planner's own field - zipToLatLon reads the bundled Census table)
    const applyZip = (raw) => {
        // O38/O38b: typing a ZIP IS the location signal, but there is no lat/lon yet - so prime by ZIP,
        // which rides base.json's ZIP3->cells directory to fetch exactly the cells that hold this ZIP's
        // centroid (idempotent). Until they land zipToLatLon misses and the "still loading" branch shows;
        // the loader's answersRefresh re-resolves the moment a cell arrives, so the gardener waits a beat,
        // never retypes.
        const five = /^\d{5}/.test(raw.trim());
        if (five)
            app.ensureZipData?.(null, null, raw);
        const hit = zipToLatLon(raw, bundle.zip_index?.zips ?? null);
        if (hit) {
            state.zip = raw.trim();
            state.lat = hit.lat;
            state.lon = hit.lon;
            saveState(state);
            // Now that the exact centroid is known, load the proper 3x3 block around it - a neighbouring
            // cell just over the ZIP3 border can hold the nearest frost station, and only the located call
            // guarantees the full block resolveClimate needs.
            app.ensureZipData?.(hit.lat, hit.lon);
            hint.textContent = "";
            renderClimateCard();
        }
        else if (five) {
            // "don't have it" vs "still loading": if any sibling ZIP with the same first three digits has
            // landed, this ZIP3's cells are here and the ZIP is genuinely absent (PO-box only); if none has,
            // the cells are still in flight.
            const z3 = raw.trim().slice(0, 3);
            const loaded = Object.keys(bundle.zip_index?.zips ?? {}).some((z) => z.startsWith(z3));
            hint.textContent = loaded
                ? "We don't have that ZIP (some are PO-box only) - try a neighboring one."
                : "Still loading the ZIP table - give it a second and type again.";
        }
        else {
            hint.textContent = "";
        }
    };
    zipEl.addEventListener("input", () => applyZip(zipEl.value));
    // rung 2: the crop - quick chips plus a type-to-filter over the whole corpus
    for (const sid of QUICK) {
        if (!bundle.species.some((s) => s.id === sid))
            continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ans-chip";
        b.dataset.sid = sid;
        b.textContent = cropLabel(sid);
        b.addEventListener("click", () => { state.crop = sid; saveState(state); renderCrop(); });
        chipsEl.append(b);
    }
    const renderFilter = () => {
        const q = filterEl.value.trim().toLowerCase();
        filterList.innerHTML = "";
        if (q.length < 2)
            return;
        const hits = bundle.species.filter((s) => {
            const common = Array.isArray(s.common) ? s.common.join(" ") : String(s.common ?? "");
            return `${common} ${s.id}`.toLowerCase().includes(q);
        }).slice(0, 12);
        for (const s of hits) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ans-chip";
            b.dataset.sid = s.id;
            b.textContent = cropLabel(s.id);
            b.addEventListener("click", () => {
                state.crop = s.id;
                saveState(state);
                filterEl.value = "";
                filterList.innerHTML = "";
                renderCrop();
            });
            filterList.append(b);
        }
    };
    filterEl.addEventListener("input", renderFilter);
    // the calendar giveaway: the crop's dated rows as an ICS, the O5 reminder riding along
    const remindSel = $("ansremind");
    remindSel.value = remindChoice();
    remindSel.addEventListener("change", () => setRemindChoice(remindSel.value));
    $("ansics").addEventListener("click", () => {
        if (!state.crop || state.lat == null || state.lon == null)
            return;
        const a = cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle);
        if (!a || !a.tasks.length)
            return;
        const ics = tasksToIcs(a.tasks, bundle, remindChoice());
        void shareOrDownloadIcs(ics, `milpa-${state.crop}.ics`);
    });
    // the next invitation: the planner, carrying the resolved point so nothing given is asked twice
    $("ansplan").addEventListener("click", () => hooks.plantWithLocation(state.lat ?? null, state.lon ?? null, state.zip ?? null));
    // O23: a content page hands its crop over in the URL. Rita arrives on the tomato page from a
    // search, taps "When do I plant this?", and the crop is already answered before she has typed
    // anything - so the only thing still owed is the ZIP, and that is where the cursor goes.
    //
    // An id the corpus does not carry SAYS SO. A link from a page for a species since removed would
    // otherwise open a ladder with nothing chosen, indistinguishable from arriving cold - a silent
    // dead end, which is the shape invariant 2 forbids everywhere else in this product. Refusing out
    // loud costs one line and cannot be mistaken for working.
    // A location page arrives with the ZIP already known - it is the whole subject of that page - so
    // rung 1 is paid before the visitor does anything, and their first act here is choosing a crop.
    // Applied through the SAME applyZip() the field uses, so a deep-linked ZIP resolves, refuses and
    // counts the rung identically to a typed one; there is no second path to keep in step.
    const applyHashZip = () => {
        const want = zipFromHash(location.hash);
        if (!want || state.zip === want)
            return false;
        zipEl.value = want;
        applyZip(want);
        return true;
    };
    const applyHashCrop = () => {
        const want = cropFromHash(location.hash);
        if (!want)
            return false;
        if (!bundle.species.some((s) => s.id === want)) {
            cropHint.textContent = `That link asked for a crop we don't carry (${want}). Pick one below and the dates still work.`;
            return false;
        }
        cropHint.textContent = "";
        if (state.crop !== want) {
            state.crop = want;
            saveState(state);
        }
        renderCrop();
        return true;
    };
    // door 2 enters crop-first: focus the crop block instead of the ZIP. A deep-linked crop is
    // door 1 with the crop already paid, so it focuses the ZIP like door 1 does.
    //
    // FOCUS FOLLOWS A TAP, NEVER AN ARRIVAL. This runs on hashchange only, so tapping a door - or the
    // share view's exit - moves the cursor, while a COLD load off a search result does not: on a
    // phone that would throw the keyboard over half the screen of someone who has just landed and is
    // reading the answer their crop already bought. The deep link still applies its crop on a cold
    // load (see the bottom of this function); what it does not do is grab the cursor uninvited.
    const focusForDoor = () => {
        const zipped = applyHashZip();
        const carried = applyHashCrop();
        // A ZIP already given is rung 1 paid: the crop block is what is still owed, so focus goes there
        // rather than to a field holding the answer the page arrived with.
        if (zipped && !carried) {
            filterEl.focus();
            return;
        }
        if (!carried && location.hash.includes("teams"))
            filterEl.focus();
        else
            zipEl.focus();
    };
    window.addEventListener("hashchange", () => {
        if (!location.hash.startsWith("#/answers"))
            return;
        renderSituation();
        renderSituationRow();
        // A SITUATION IS NOT A DOOR, so it must not move the cursor. focusForDoor ends in
        // `zipEl.focus()`, and focusing an off-screen input scrolls it into view - which is what threw
        // a visitor at the bottom of the page back to the top when they tapped a chip. Measured on the
        // maintainer's own path (door 2, no ZIP given, scrolled to the chips): 494 -> 0, with
        // activeElement landing on #anszip. It hid from an earlier probe because that probe gave a ZIP
        // first, which collapses the field, and focusing a display:none input does nothing at all.
        if (situationFromHash(location.hash))
            return;
        focusForDoor();
    });
    // Phase C: the ladder's dated rows feed the signed-out calendar (the D-023 amendment - the
    // calendar SEES what the device knows; the account KEEPS). Live off the current state, so a
    // crop picked after the calendar first rendered still reaches it on the next render.
    app.answersTasks = () => {
        if (!state.crop || state.lat == null || state.lon == null)
            return [];
        return cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle)?.tasks ?? [];
    };
    // restore a prior visit's ladder state, then let a deep link override the crop - arriving from
    // a species page means asking about THAT crop, whatever the last visit happened to leave behind.
    // Applied here as well as on hashchange because a COLD load fires no hashchange, and a cold load
    // off a search result is the whole point of O23.
    if (state.zip)
        zipEl.value = state.zip;
    renderClimateCard();
    renderCrop();
    renderSituation(true); // a COLD load via a situation link: position them on their answer
    renderSituationRow();
    applyHashZip(); // a cold load off a location page: no hashchange fires, same as O23's crop
    applyHashCrop();
    // the refresh hook: the ZIP tables load lazily (D-089), so a ZIP typed before they land - or a
    // zone row pending on them - resolves the moment app.ts merges them into the bundle.
    return () => {
        if (zipEl.value.trim() && (state.lat == null || state.lon == null))
            applyZip(zipEl.value);
        else
            renderClimateCard();
    };
}
