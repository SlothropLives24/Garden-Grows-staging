// Calendar page (D-103) - a GARDEN-WIDE season calendar over the log's saved plans. Month grid by
// default with a per-day agenda, plus a year overview. Every task is tagged with its bed. Dates come
// from Phase 5's task engine (gardenTasks); the engine emits data, the sentences + layout live here.
//
// Two hard rules carry over from the engine: no task carries a date the engine can't source, and the
// climate must resolve - no location, no dates, no guessing.
import { coachBand, COACH_HEADING, COACH_CAL } from "./coachband.js";
import { displayName } from "./engine/guilds.js";
import { gardenTasks } from "./engine/tasks.js";
import { matchSite, resolveClimate } from "./engine/intake.js";
import { frostCalibration, mmddDoy } from "./engine/frostcalib.js";
import { intersectArea, parseRegion, regionCentroid, regionPoints } from "./engine/regions.js";
import { bedHasSections } from "./plan.js";
import { humanize } from "./engine/labels.js";
import { remindChoice, setRemindChoice } from "./units.js";
import { reminderPlan, enableReminders, disableReminders, refreshReminders, remindersSupported, remindersOn } from "./reminders.js";
import { $, num } from "./dom.js";
import { plantHref } from "./panels/plantcard.js";
import { app, commonName, defaultPlotId, ruleClaim } from "./state.js";
import { isSignedIn } from "./account.js";
import { addFailure, addObservation, addPlantingNote, endPlanting, listPlots, listSeasons, updatePlanting } from "./storage.js";
import { END_CAUSES, FAILURE_SEVERITIES, OBSERVATION_SEVERITIES } from "./engine/seasonlog.js";
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const category = (t) => t.cat ?? (t.kind === "sow_climber" ? "sow" : t.kind === "harvest_open" ? "harvest"
    : t.kind === "log_first_freeze" ? "frost" : "plant");
// view state (session-only; the calendar opens on the current month of the open season)
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calView = "month";
let calSelDay = null; // YYYY-MM-DD when a day is tapped to filter the agenda
let calSelBed = null; // a bed name when the calendar is focused on one bed (D-107)
// Garden (plot) scope (walkthrough). The calendar spans EVERY garden on the account, filterable to one.
// `calSelGarden`: a plotId to focus one garden, null to consolidate across ALL, undefined until first
// render defaults it to the default garden (spec: "default garden, all beds active"). The active garden
// is always rebuilt live from `app.logSnapshot`; the OTHER gardens are read from storage once and cached.
let calSelGarden = undefined;
let calOtherGardens = null; // gardens other than the active one; null = not loaded yet
let calGardensBuiltFor = null; // the active plotId the cache excludes - reload if it changes
let calGardensLoading = false;
const calGardenNames = new Map(); // plotId -> display name, filled by the async load
// The beds worth offering as filters: the distinct beds that actually carry a dated task this year
// (a bed with nothing to show would be a dead chip). Sorted for a stable row order.
function bedsWithTasks(all) {
    return [...new Set(all.map((t) => t.bed).filter((b) => !!b))].sort();
}
// Focus on one bed: keep that bed's tasks AND every garden-wide marker (frost, season end) - those
// apply to every bed, so hiding them when you zoom into a bed would drop real dates. No bed selected
// (or a stale selection whose bed is gone) shows everything.
function filterByBed(all) {
    if (!calSelBed)
        return all;
    return all.filter((t) => !t.bed || t.bed === calSelBed);
}
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// One task as a sentence - the engine emitted data; the words live here.
export function taskSentence(t, bundle) {
    // A TASK THAT CARRIES ITS OWN SENTENCE IS THAT SENTENCE. The CalTask contract says so - climate
    // markers and LOG-derived events precompose `text` rather than pretend to be an engine kind - but
    // this function used to fall straight through to the kind branches, and the two callers that got
    // it right did so by writing `t.text ?? taskSentence(...)` at every call site.
    //
    // The one that did not was the home's dated lines, and the bug it produced was exactly the shape
    // that rule exists to prevent: a LOG-derived harvest (anchored to the gardener's real planting
    // date, its sentence already written with the real number of days) has no `dtmRange`, so the
    // harvest branch rendered "~undefined days from planting" over the top of correct data. Honour
    // the contract HERE, once, so no future caller can step in the same hole.
    if (t.text)
        return t.text;
    if (t.kind === "plant_after_last_frost") {
        const tail = t.frost_risk_until ? ` - 10% of years still see frost after ${t.frost_risk_until}` : "";
        return `Plant ${t.guildName ?? "this team"}: today is the median last frost${tail}.`;
    }
    if (t.kind === "sow_climber") {
        return `Sow the ${commonName(bundle, t.species)} - ~${t.lead_days} days after the ` +
            `${commonName(bundle, t.support)} established; a vine on an unrooted stalk pulls it over.`;
    }
    if (t.kind === "install_support") {
        // O80b: the staking guide's rule as a dated line - the structure goes in with the planting,
        // not after it; setting a panel through an established root zone tears roots.
        return `Set the ${commonName(bundle, t.species)} today, with the planting - ` +
            `driving it in later tears roots, and a vine with nothing to climb sprawls.`;
    }
    if (t.kind === "harvest_open") {
        // No days-to-maturity in hand: say so by saying LESS. Printing the placeholder was the reported
        // bug; inventing a number to fill the gap would be the worse version of the same fault.
        const range = t.dtmRange && t.dtmRange[0] !== t.dtmRange[1] ? `${t.dtmRange[0]}–${t.dtmRange[1]}` : `${t.dtmRange?.[0]}`;
        const base = t.dtmRange
            ? `${commonName(bundle, t.species)} should be ready - ~${range} days from planting; start checking.`
            : `${commonName(bundle, t.species)} should be ready around now; start checking.`;
        // D-136: flag, don't hide. A harvest date past the first freeze is shown with an honest caveat.
        return t.pastFreeze
            ? `${base} Heads up: that's after your first freeze (~${monthDay(t.pastFreeze)}), so it may not ripen outdoors.`
            : base;
    }
    return `First freeze arrives around now - log the frost you observe; three logged seasons ` +
        `beat the model on your own ground.`;
}
// anchor date (YYYY-MM-DD) + N days → YYYY-MM-DD, crossing the year boundary freely (D-136). A LOG-anchored
// recommendation hangs off an absolute planting date, so its harvest/re-sow can legitimately fall in the
// NEXT year (a December sowing). The per-render-year filter decides what shows; the shift must not drop it.
function addDaysISO(isoDate, n) {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d)
        return null;
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
// plant date (MM-DD) + N days → YYYY-MM-DD, same-year only (an annual's harvest never crosses the year).
// Day-precision Date arithmetic is fine here - harvest is a display estimate, not a conformance date.
function shiftDays(year, mmdd, n) {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(year, mm - 1, dd + n);
    if (d.getFullYear() !== year)
        return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Null-safe: the "past your first freeze" harvest message is BUILT eagerly (even when it won't be
// shown, i.e. the crop matures before the freeze), and a plot with no resolved frost date yet - a
// transient state during boot - has a null freeze MM-DD. Splitting that null used to crash the whole
// calendar render; a null/empty date now yields "" (the message that carries it is never surfaced then).
export const monthDay = (mmdd) => {
    if (!mmdd)
        return "";
    const [mm, dd] = mmdd.split("-").map(Number);
    return mm && dd ? `${MONTHS[mm - 1].slice(0, 3)} ${dd}` : mmdd;
};
// The LOGGED ledger, on the calendar (D-104): what actually happened on the ground - sown, transplanted,
// harvested, a plant that ENDED (died/pulled), a dated failure - each mapped to the bed it overlaps.
function loggedEvents(bundle, year, ctx) {
    const beds = ctx.beds;
    const bedOf = (region) => {
        try {
            const r = parseRegion(region);
            return beds.find((b) => intersectArea(parseRegion(b.region), r) > 0)?.name;
        }
        catch {
            return undefined;
        }
    };
    const nm = (sid) => commonName(bundle, sid) || humanize(sid);
    const out = [];
    const yr = String(year);
    const add = (date, cat, text, species, bed) => {
        if (date && date.slice(0, 4) === yr)
            out.push({ date, kind: "logged", cat, text, species, bed, rule: "logged", tip: "From your season log." });
    };
    for (const season of ctx.seasons) {
        for (const pl of season.plantings ?? []) {
            const bed = bedOf(pl.region), s = nm(pl.species);
            add(pl.sown, "plant", `Sowed ${s}`, pl.species, bed);
            add(pl.transplanted, "plant", `Transplanted ${s}`, pl.species, bed);
            add(pl.first_harvest, "harvest", `First harvest of ${s}`, pl.species, bed);
            add(pl.last_harvest, "harvest", `Last harvest of ${s}`, pl.species, bed);
            if (pl.end_date)
                add(pl.end_date, "ended", `${s} ended - ${pl.end_cause ?? "removed"}`, pl.species, bed);
            for (const f of pl.failures ?? [])
                add(f.date, "ended", `${s} - ${f.mode} (${f.severity})`, pl.species, bed);
            // Plant-pinned notes (walkthrough): the gardener's own remark about THIS plant, on its date.
            for (const n of pl.notes ?? [])
                add(n.date, "note", `Note on ${s}: ${n.text}`, pl.species, bed);
        }
        // Logged weather observations (D-114): the frost/heat you actually recorded, shown on the day it
        // happened - the "actual user information" that supersedes the model. A logged frost is the R-093
        // calibration payload; surfacing it here makes your own record visible, not just a Log-page number.
        for (const o of season.observations ?? []) {
            if (!o.date || o.date.slice(0, 4) !== yr)
                continue;
            const label = o.event === "frost" ? `Frost observed${o.severity ? ` - ${o.severity}` : ""}` : "Heat observed";
            out.push({ date: o.date, kind: "logged", cat: "frost", species: null, rule: "logged",
                text: label + (o.note ? ` (${o.note})` : ""),
                tip: "From your season log - your own frost record; three seasons supersede the model." });
        }
    }
    return out;
}
// Every member of a guild as (species id, cultivar group): from its roles (canonical) AND its members
// (culinary bundles list species there, not as roles). Shared by the succession and cool-season passes.
function guildMemberRefs(guild) {
    const refs = [];
    for (const role of guild.roles ?? []) {
        const r = role;
        if (typeof r.canonical === "string")
            refs.push({ sid: r.canonical, group: typeof r.canonical_group === "string" ? r.canonical_group : null });
    }
    for (const m of guild.members ?? []) {
        if (typeof m.species === "string")
            refs.push({ sid: m.species, group: typeof m.group === "string" ? m.group : null });
    }
    return refs;
}
// Resolve a species' days-to-maturity range [lo, hi], honouring a specific cultivar group when the
// planting names one. When it doesn't - a free "My bed" planting records no group - AND the species keeps
// its DTM only on its cultivar groups (tomato, summer squash, and other variable crops carry no
// species-level DTM), fall back to the SPAN across every group: min low → max high. That is an honest
// "about lo–hi days, depending on the variety" window instead of NO harvest date at all - the bug where a
// planted tomato/squash bed showed no recommended harvest. Returns null only for a genuinely date-less
// crop (GDD, perennial, or no DTM anywhere); those never get a composed harvest date (CLAUDE.md).
export function resolveDtm(sp, group) {
    // A measure is a scalar or a [lo, hi] range (corpus uses ranges; a user plant may enter a single
    // number) - normalise both to [lo, hi] so every consumer downstream is uniform.
    const asRange = (d) => typeof d === "number" && Number.isFinite(d) ? [d, d]
        : Array.isArray(d) && typeof d[0] === "number" ? [d[0], d[d.length - 1]] : null;
    const groups = sp.cultivar_groups;
    // a named cultivar group wins - it is the specific variety the planting is
    if (group && Array.isArray(groups)) {
        const g = groups.find((cg) => cg.id === group);
        const r = g && asRange(g.days_to_maturity);
        if (r)
            return r;
    }
    // else the species-level DTM, when the species has one
    const own = asRange(sp.days_to_maturity);
    if (own)
        return own;
    // else span every cultivar group's DTM - variety unknown, so give the honest full range across types
    if (Array.isArray(groups)) {
        const ranges = groups
            .map((g) => asRange(g.days_to_maturity)).filter((r) => !!r);
        if (ranges.length)
            return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
    }
    return null;
}
// GARDEN-WIDE: the season on one calendar - climate frost markers (plan-independent), every saved
// plan's dated tasks tagged with its bed, and the logged ledger's actual events.
// The active garden as a ctx - read live from the DOM location + the current snapshot, so an edit this
// session (a logged sow, a season switch) is reflected without a reload. Its name comes from the cache.
function currentGardenCtx() {
    return { plotId: app.currentPlotId, name: calGardenNames.get(app.currentPlotId) ?? "This garden",
        lat: num("lat"), lon: num("lon"), seasons: app.logSnapshot.seasons, seasonId: app.logSnapshot.seasonId, beds: app.logSnapshot.beds };
}
// The exported, current-garden entry point (conformance-free app layer; the e2e suite calls this).
export function gardenWideTasks(bundle, year) {
    const out = gardenTasksFor(bundle, year, currentGardenCtx());
    // Phase C (the D-023 amendment): signed out, the answers ladder's crop dates join the calendar
    // - the same rows the answers page shows, so the two surfaces can never disagree. Signed in,
    // the real garden's plan owns the schedule and the ladder stays a front-door surface.
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        out.push(...extra.filter((t) => typeof t.date === "string" && t.date.startsWith(String(year))));
    }
    return out;
}
// The task builder for ONE garden. Every date it emits is tagged with that garden (name + plotId) so the
// calendar can consolidate across gardens or scope to one, and so a bed tag deep-links only within its own
// garden. Climate resolves from THIS garden's own location - gardens in different places get different frost.
function gardenTasksFor(bundle, year, ctx) {
    const lat = ctx.lat, lon = ctx.lon;
    if (lat == null || lon == null)
        return [];
    const out = [];
    const speciesById = new Map(bundle.species.map((s) => [s.id, s]));
    // Cool-season sow offsets (days before last frost) by hardiness class - the numbers live in the
    // corpus rule R-096, read from the bundle so they are never hardcoded in the app (D-110).
    const r096 = bundle.rules.find((r) => r.id === "R-096");
    const coolOffsets = (r096?.offset_days_before_last_frost ?? null);
    // (A) climate markers - shown whenever the site resolves, even before any bed is planned: the last
    // spring frost and the first fall freeze (the season's end for tender crops).
    const site = matchSite(lat, lon, bundle);
    // Nationwide frost (D-113): resolveClimate names the nearest station + grades the distance honestly
    //. Within ~2 km it is effectively on-site; farther, the marker says which station and how far,
    // so a user 40 km from the nearest station knows the date is theirs-by-proximity, not measured on it.
    const clim = resolveClimate(lat, lon, bundle);
    const stnName = clim?.site.provenance?.station?.name;
    const prov = clim && clim.distanceKm > 2 && stnName
        ? ` Nearest NCEI station: ${stnName}, ~${Math.round(clim.distanceKm)} km away - grade ${clim.effectiveGrade}, so treat these as approximate for your exact spot.`
        : "";
    // R-093 supersession (D-114, docs/CLIMATE.md §5): once this plot has 3+ logged frost seasons, its OWN
    // observed last-frost / first-freeze date supersedes the NCEI model - for the markers AND every sow date
    // anchored to them. Below the gate the model stands and the marker says how many seasons remain; a single
    // freak frost must not overrule a 30-year normal. `springShiftDays` re-anchors the engine's model-dated
    // plant/climber tasks by the same observed offset so the whole calendar moves to the user's ground at once.
    const cal = site ? frostCalibration(ctx.seasons, site) : null;
    const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
    const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
    // The first fall freeze this plot plans against - the observed date once R-093 calibrates, else the
    // model median. Shared by the harvest past-freeze flag (D-136) and the succession freeze bound (D-108).
    const freezeMmdd = fallObs ?? site?.first_freeze_32f_p50 ?? null;
    const modelLf0 = (site?.last_frost_32f ?? {}).p50 ?? null;
    const springShiftDays = springObs && modelLf0 ? (mmddDoy(springObs) ?? 0) - (mmddDoy(modelLf0) ?? 0) : 0;
    if (site) {
        const lf10 = (site.last_frost_32f ?? {}).p10;
        const lf = springObs ?? modelLf0;
        const ff = fallObs ?? site.first_freeze_32f_p50;
        // O27 rec 1: the frost markers are the ask card's delivery arm - exported to the phone's own
        // calendar (the ICS carries `text`, not `tip`), the tap-the-frost ask arrives with the
        // gardener's own standing on exactly the right week. The count is factual (R-093's resolver).
        const springAsk = cal && !cal.spring.calibrated && cal.spring.n > 0
            ? ` Tap the frost you see - your ${cal.spring.n + 1}${cal.spring.n === 1 ? "nd" : cal.spring.n === 2 ? "rd" : "th"} logged season; ${Math.max(1, cal.min_seasons - cal.spring.n)} more and your own dates take over.`
            : "";
        const fallAsk = cal && !cal.fall.calibrated && cal.fall.n > 0
            ? ` Tap the frost you see - your ${cal.fall.n + 1}${cal.fall.n === 1 ? "nd" : cal.fall.n === 2 ? "rd" : "th"} logged season; ${Math.max(1, cal.min_seasons - cal.fall.n)} more and your own dates take over.`
            : "";
        if (lf)
            out.push({ date: `${year}-${lf}`, kind: "log_first_freeze", cat: "frost", rule: "R-031", species: null,
                text: springObs
                    ? `Last spring frost - your ground's observed date over ${cal.spring.n} logged seasons, which supersedes the NCEI median. Frost-tender crops are safe after this.`
                    : `Last spring frost (median)${lf10 ? ` - 1 year in 10 still frosts as late as ${monthDay(lf10)}` : ""}. Frost-tender crops are safe after this.${springAsk}`,
                tip: springObs ? "Fitted from your own logged frosts - supersedes the model."
                    : `From the nearest NCEI climate normals.${prov}${cal && cal.spring.n ? ` You've logged ${cal.spring.n} of 3 seasons toward your own date.` : ""}` });
        if (ff)
            out.push({ date: `${year}-${ff}`, kind: "log_first_freeze", cat: "frost", rule: "R-093", species: null,
                text: fallObs
                    ? `First fall freeze - your ground's observed date over ${cal.fall.n} logged seasons, which supersedes the NCEI median. The season's end for tender crops.`
                    : `First fall freeze (median) - the season's end for tender crops. Log the frost you see; three seasons beat the model.${fallAsk}`,
                tip: fallObs ? "Fitted from your own logged frosts - supersedes the model."
                    : `From the nearest NCEI climate normals.${prov}${cal && cal.fall.n ? ` You've logged ${cal.fall.n} of 3 seasons toward your own date.` : ""}` });
    }
    // (B) per-plan tasks: plant / sow-climber / harvest, each tagged with its bed
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    const plans = (Array.isArray(open?.plan) ? open.plan : []);
    for (const plan of plans) {
        const guild = bundle.guilds.find((g) => g.id === plan.guild);
        if (!guild)
            continue;
        const guildName = displayName(guild);
        let plantMmdd = null, sowMmdd = null, climber = null;
        for (const t of gardenTasks(guild, lat, lon, year, bundle)) {
            if (t.kind === "log_first_freeze")
                continue; // replaced by the garden-wide climate marker (A)
            // R-093 (D-114): shift the engine's model-anchored plant + climber-sow dates by the observed offset
            // so a calibrated plot's whole schedule rides its OWN last frost, not the NCEI median.
            let tt = t;
            if (springShiftDays && (t.kind === "plant_after_last_frost" || t.kind === "sow_climber")) {
                const shifted = shiftDays(year, t.date.slice(5), springShiftDays);
                if (shifted)
                    tt = { ...t, date: shifted };
            }
            if (tt.kind === "plant_after_last_frost") {
                plantMmdd = tt.date.slice(5);
                // Only claim the observed date when the anchor ACTUALLY moved to it (D-120): if an extreme offset
                // made shiftDays cross the year and return null, the date stayed the model median - don't then
                // mislabel it as "your ground's own last frost."
                if (springObs && tt.date.slice(5) === springObs)
                    tt = { ...tt, text: `Plant ${guildName}: your ground's own last frost over ${cal.spring.n} logged seasons, superseding the NCEI median.` };
            }
            if (tt.kind === "sow_climber") {
                sowMmdd = tt.date.slice(5);
                climber = tt.species;
            }
            out.push({ ...tt, bed: plan.area, guildName });
        }
        // HARVEST (slice 2): each canonical member with a days-to-maturity opens a harvest window at its
        // plant date + DTM. The climber counts from its own sow date. GDD/perennial crops (e.g. corn) carry
        // no DTM date and get NO harvest task - the engine won't invent one (CLAUDE.md).
        if (plantMmdd) {
            // Gap B: a role the user SWAPPED (stored on the plan entry) harvests as the chosen variety+group,
            // not the canonical. Legacy entries with no `roles` leave this map empty → canonical, as before.
            const roleOv = new Map();
            for (const r of (Array.isArray(plan.roles) ? plan.roles : [])) {
                if (typeof r.role === "string" && typeof r.species === "string")
                    roleOv.set(r.role, { species: r.species, group: typeof r.group === "string" ? r.group : null });
            }
            for (const role of guild.roles ?? []) {
                const ov = roleOv.get(role.id);
                const sid = ov ? ov.species : role.canonical;
                const sp = sid ? speciesById.get(sid) : undefined;
                if (!sid || !sp || sp.scheduling_model !== "dtm")
                    continue;
                // days-to-maturity via the resolver shared with §D (D-134): the named cultivar group (the role's
                // canonical group, or a swap's group) wins; else species level; else the span across groups; and a
                // scalar days-to-maturity (a user variety) is handled too. GDD species were already skipped above.
                const grp = ov ? ov.group : role.canonical_group;
                const dtm = resolveDtm(sp, grp ?? null);
                if (!dtm)
                    continue;
                const base = sid === climber && sowMmdd ? sowMmdd : plantMmdd;
                const date = shiftDays(year, base, dtm[0]);
                // D-136: a long-DTM crop can mature after the first freeze even from a spring plant date (a
                // short-season/long-crop mismatch). Flag the harvest, don't drop it.
                const pastFreeze = date && freezeMmdd && date.slice(5) > freezeMmdd ? freezeMmdd : undefined;
                if (date)
                    out.push({ date, kind: "harvest_open", rule: "days-to-maturity", species: sid,
                        bed: plan.area, guildName, dtmRange: [dtm[0], dtm[1]], pastFreeze });
            }
        }
        // SUCCESSION (D-108, R-034): a bolt-prone short-DTM crop (lettuce, cilantro) wants staggered sowings
        // so the whole planting doesn't bolt at once. The trigger mirrors the engine's dispatch EXACTLY - the
        // resolved species' `bolt_risk` flag - and it reads BOTH the guild's roles and its members, because a
        // culinary bundle (salad_garden) carries lettuce as a member, not a role. We only suggest a re-sow that
        // can still MATURE before the median first freeze: that freeze date and days-to-maturity are
        // both sourced, so no window is invented. ~3-week steps, bounded by the freeze and hard-capped at six.
        if (plantMmdd) {
            const ffmmdd = fallObs ?? site?.first_freeze_32f_p50 ?? null; // R-093: observed freeze supersedes (D-114)
            const freeze = ffmmdd ? `${year}-${ffmmdd}` : null;
            const seen = new Set();
            for (const { sid, group } of guildMemberRefs(guild)) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const sp = speciesById.get(sid);
                if (!sp || sp.scheduling_model !== "dtm")
                    continue;
                // Per-species cadence (D-130): the corpus succession_interval_days [lo, hi] spaces the
                // re-sowings - radish tight (7–10 d), beans wide (14–21 d) - instead of a flat 3 weeks.
                // A bolt-risk crop with no explicit interval keeps the generic 3 weeks (R-034's wording);
                // a crop with neither is not a succession crop and is skipped. The number is estimated/
                // unverified in the corpus, so the copy stays advisory, never a promise.
                const succ = sp.succession_interval_days;
                const interval = Array.isArray(succ) && typeof succ[0] === "number"
                    ? succ
                    : (sp.bolt_risk ? [21, 21] : null);
                if (!interval)
                    continue;
                const step = interval[0];
                const cadence = interval[0] === interval[1] ? `${interval[0]} days` : `${interval[0]}–${interval[1]} days`;
                let dtm = sp.days_to_maturity;
                const groups = sp.cultivar_groups;
                if (group && Array.isArray(groups)) {
                    const g = groups.find((cg) => cg.id === group);
                    if (g && Array.isArray(g.days_to_maturity))
                        dtm = g.days_to_maturity;
                }
                if (!Array.isArray(dtm) || typeof dtm[0] !== "number")
                    continue;
                const dtmMin = dtm[0];
                const label = commonName(bundle, sid) || humanize(sid);
                // Cap high enough that a fast crop (7-day step) still gets a full season; the freeze
                // window is the real bound (a re-sow that can't mature before the median first freeze stops).
                for (let k = 1; k <= 24; k++) {
                    const sd = shiftDays(year, plantMmdd, step * k);
                    if (!sd)
                        break;
                    if (freeze) {
                        const mature = shiftDays(year, sd.slice(5), dtmMin);
                        if (!mature || mature > freeze)
                            break;
                    }
                    else if (k > 2)
                        break; // no first-freeze on record - keep it to two follow-up sowings
                    out.push({ date: sd, kind: "succession", cat: "sow", rule: "R-034", species: sid, bed: plan.area, guildName,
                        text: `Sow more ${label} - re-sow every ${cadence} for a continuous harvest instead of one glut.`,
                        tip: "This re-sow can still mature before your median first freeze." });
                }
            }
        }
        // COOL-SEASON TIMING (D-110, R-096): a cold-hardy annual or biennial can go in weeks BEFORE the last
        // frost - the complement of R-031, which BLOCKS tender crops before it. The per-class offset lives in
        // the corpus rule (read from the bundle above, never hardcoded); a crop marked sow_season: fall
        // (garlic) or scheduled perennial/GDD is excluded. Emitted once per member at last frost − offset.
        if (plantMmdd && coolOffsets) {
            const seen = new Set();
            for (const { sid } of guildMemberRefs(guild)) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const sp = speciesById.get(sid);
                if (!sp || sp.scheduling_model !== "dtm" || sp.sow_season === "fall")
                    continue;
                const tol = sp.frost_tolerance;
                const off = tol === "hardy" ? coolOffsets.hardy : tol === "half_hardy" ? coolOffsets.half_hardy : 0;
                if (!off || off <= 0)
                    continue;
                const date = shiftDays(year, plantMmdd, -off);
                if (!date)
                    continue;
                const label = commonName(bundle, sid) || humanize(sid);
                const weeks = Math.round(off / 7);
                out.push({ date, kind: "cool_season", cat: "plant", rule: "R-096", species: sid, bed: plan.area, guildName,
                    text: `Sow or set out ${label} now - ${tol === "hardy" ? "cold-hardy" : "half-hardy"}, so it can go in about ${weeks} week${weeks === 1 ? "" : "s"} before your last frost.` });
            }
        }
        // START INDOORS (D-111, R-097): a long-season warm crop (tomato, pepper, eggplant, tomatillo, basil)
        // is started under cover weeks before the last frost, then set out after it (R-031 still gates the
        // transplant). The lead is the species' OWN start_indoors_weeks - the number lives in the corpus,
        // read here from the bundle, never hardcoded. Emitted once per member at last frost − lead.
        if (plantMmdd) {
            const seen = new Set();
            for (const { sid } of guildMemberRefs(guild)) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const wk = speciesById.get(sid)?.start_indoors_weeks;
                if (typeof wk !== "number" || wk <= 0)
                    continue;
                const date = shiftDays(year, plantMmdd, -wk * 7);
                if (!date)
                    continue;
                const label = commonName(bundle, sid) || humanize(sid);
                out.push({ date, kind: "start_indoors", cat: "sow", rule: "R-097", species: sid, bed: plan.area, guildName,
                    text: `Start ${label} seeds indoors now - about ${wk} weeks before your last frost; set the seedlings out after it.` });
            }
        }
    }
    // (C) the logged ledger's actual events
    out.push(...loggedEvents(bundle, year, ctx));
    // (D) LOG-ANCHORED recommendations (D-134): for a directly-logged planting on a bed with NO saved
    // guild plan, compute recommended forward dates from YOUR real planting date + the species data -
    // recommended first harvest (planting date + days-to-maturity), the end of the harvest window, and
    // the next succession sows (each crop's own interval, D-130). Hollow dots, like every recommendation.
    // A bed with a saved plan already gets these from sections above, so it is skipped to avoid doubling.
    // The harvest window PERSISTS through the season (until the plant is ended) - it is the crop's maturity
    // window, not a one-off, so logging a pick does not retire it (a logged harvest shows as its own dot).
    {
        const season = ctx.seasons.find((s) => s.id === ctx.seasonId);
        const beds = ctx.beds;
        const bedOf = (region) => {
            try {
                const r = parseRegion(region);
                return beds.find((b) => intersectArea(parseRegion(b.region), r) > 0)?.name;
            }
            catch {
                return undefined;
            }
        };
        const planned = new Set((Array.isArray(season?.plan) ? season.plan : []).map((e) => e.area));
        const yrStr = String(year);
        const emitted = new Set(); // N plants of one species on a bed collapse to one rec line
        const push = (t) => {
            const k = `${t.date}|${t.kind}|${t.species}|${t.bed ?? ""}`;
            if (emitted.has(k))
                return;
            emitted.add(k);
            out.push(t);
        };
        for (const pl of season?.plantings ?? []) {
            if (pl.end_cause)
                continue; // ended → no forward recs
            const anchor = pl.transplanted || pl.sown; // your real in-ground date, else the sow date
            if (!anchor)
                continue;
            const bed = bedOf(pl.region);
            if (bed && planned.has(bed))
                continue; // plan-anchored recs already cover this bed
            const sp = speciesById.get(pl.species);
            if (!sp || sp.scheduling_model !== "dtm")
                continue; // GDD/perennial carry no DTM harvest date
            const dtm = resolveDtm(sp, pl.cultivar_group); // spans cultivar groups when none is recorded
            if (!dtm)
                continue;
            const s = commonName(bundle, pl.species) || humanize(pl.species);
            // D-136: recommendations are computed as ABSOLUTE dates off the real anchor, crossing the year
            // boundary freely, then filtered to the render year - a December sowing's spring harvest lands on
            // NEXT year's calendar instead of vanishing (the old MM-DD shift refused to cross the year). The
            // freeze this planting must beat is its OWN anchor year's first freeze.
            const anchorYear = Number(anchor.slice(0, 4));
            const freezeA = freezeMmdd ? `${anchorYear}-${freezeMmdd}` : null;
            const tipBase = "Estimated from your logged planting date and this crop's days to maturity.";
            const emitHarvest = (offset, ready, late) => {
                const d = addDaysISO(anchor, offset);
                if (!d || d.slice(0, 4) !== yrStr)
                    return; // shows on the year it actually falls in
                const pastFreeze = freezeA && d > freezeA ? freezeMmdd : undefined;
                push({ date: d, kind: "harvest_open", cat: "harvest", rule: "days-to-maturity", species: pl.species, bed,
                    text: pastFreeze ? late : ready, tip: tipBase, pastFreeze });
            };
            // Persist the harvest window through the season (maintainer): the recommendation describes the
            // crop's maturity window (plant date + DTM), which does NOT change when you log a pick - a
            // continuous crop like tomato or summer squash keeps producing. So show it until the plant ENDS
            // (end_cause, gated at the top of the loop), not just until the first harvest is logged. Your
            // LOGGED harvest still renders as its own filled dot alongside the (hollow) recommendation.
            emitHarvest(dtm[0], `${s} should be ready to harvest - about ${dtm[0]} days from when you planted it.`, `${s} - about ${dtm[0]} days from when you planted it, but that's after your first freeze (~${monthDay(freezeMmdd)}); it may not ripen outdoors.`);
            const dtmMax = dtm[1];
            if (dtmMax > dtm[0]) {
                emitHarvest(dtmMax, `${s} - likely the end of the harvest window (about ${dtmMax} days from planting).`, `${s} - the end of the harvest window (about ${dtmMax} days from planting) falls after your first freeze (~${monthDay(freezeMmdd)}).`);
            }
            const succ = sp.succession_interval_days;
            if (Array.isArray(succ) && typeof succ[0] === "number") {
                const step = succ[0];
                const cadence = succ[0] === succ[1] ? `${succ[0]} days` : `${succ[0]}–${succ[1]} days`;
                for (let k = 1; k <= 24; k++) {
                    const d = addDaysISO(anchor, step * k);
                    if (!d)
                        break;
                    // stop offering re-sows that can't mature before this planting's first freeze
                    if (freezeA) {
                        const mature = addDaysISO(d, dtm[0]);
                        if (!mature || mature > freezeA)
                            break;
                    }
                    else if (k > 2)
                        break;
                    if (d.slice(0, 4) !== yrStr)
                        continue; // this re-sow belongs to another year's view
                    push({ date: d, kind: "succession", cat: "sow", rule: "R-034", species: pl.species, bed,
                        text: `Sow more ${s} - re-sow every ${cadence} for a continuous harvest instead of one glut.`,
                        tip: "Counted from your logged sowing date; interval per species." });
                }
            }
        }
    }
    for (const t of out) {
        t.garden = ctx.name;
        t.plotId = ctx.plotId;
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : 1));
    return out;
}
export function tasksToIcs(tasksList, bundle, remind = "none") {
    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Milpa Gardens//EN"];
    const seen = new Map();
    for (const t of tasksList) {
        const where = t.bed ? ` (${t.bed})` : "";
        const summary = `Garden: ${t.text ?? taskSentence(t, bundle)}${where}`;
        const base = `gg-${t.kind}-${t.date}-${slug(t.bed ?? "")}-${slug(t.species ?? t.text ?? "")}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        lines.push("BEGIN:VEVENT", `UID:${n === 1 ? base : `${base}-${n}`}@garden-grows`, "DTSTAMP:19700101T000000Z", `DTSTART;VALUE=DATE:${t.date.replaceAll("-", "")}`, `SUMMARY:${esc(summary)}`, ...(t.bed ? [`LOCATION:${esc(t.bed)}`] : []), 
        // O7 / D-164: the credit travels into Google/Apple Calendar, where other eyes see it.
        "DESCRIPTION:planned with milpa.garden", 
        // O5: the alarm, relative to the all-day event's midnight start - PT8H = 8:00 the morning
        // of; -PT6H = 18:00 the evening before. "none" writes exactly what exported before.
        ...(remind === "none" ? [] : [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${esc(summary)}`,
            `TRIGGER:${remind === "morning" ? "PT8H" : "-PT6H"}`,
            "END:VALARM",
        ]), "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}
// The download that works on a phone (D-103): the share sheet routes an .ics straight into the
// calendar app on mobile (iOS/Android); desktop and no-share browsers fall to a real file download.
// Called directly in the click handler so the user gesture reaches navigator.share - no await before it.
export async function shareOrDownloadIcs(ics, filename) {
    const blob = new Blob([ics], { type: "text/calendar" });
    const file = new File([blob], filename, { type: "text/calendar" });
    const nav = navigator;
    if (nav.canShare?.({ files: [file] })) {
        try {
            await nav.share({ files: [file], title: "Garden calendar" });
            return;
        }
        catch { /* cancelled or unsupported mid-flight - fall through to a file download */ }
    }
    // the old bug: a blob URL revoked immediately after click cancels the download on iOS; append the
    // anchor to the DOM and revoke on a delay instead.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}
function tasksInMonth(all, y, m) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    return all.filter((t) => t.date.slice(0, 7) === key);
}
function renderMonthGrid(all) {
    $("calmlabel").textContent = `${MONTHS[calMonth]} ${calYear}`;
    // P2.2 de-box: the month BAND - a chip per month of the shown year, the current month filled,
    // tap to jump. Same calMonth + re-render wiring as a day-cell tap; the ‹ Month Year › nav still
    // crosses years. Together they are the calendar's "year band".
    const band = document.getElementById("calmonthband");
    if (band) {
        band.replaceChildren();
        for (let m = 0; m < 12; m++) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "calmchip" + (m === calMonth ? " on" : "");
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", m === calMonth ? "true" : "false");
            chip.textContent = MONTHS[m].slice(0, 3);
            chip.addEventListener("click", () => { calMonth = m; renderCalendar(currentBundle); });
            band.appendChild(chip);
        }
    }
    const grid = $("calgrid");
    grid.replaceChildren();
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    const cells = [];
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = 0; i < first; i++)
        cells.push({ out: true, d: prevDays - first + 1 + i });
    for (let d = 1; d <= days; d++)
        cells.push({ out: false, d });
    while (cells.length % 7)
        cells.push({ out: true, d: cells.length - first - days + 1 });
    for (const c of cells) {
        const el = document.createElement(c.out ? "div" : "button");
        el.className = "calcell" + (c.out ? " out" : "");
        const dd = document.createElement("span");
        dd.className = "cd";
        dd.textContent = String(c.d);
        el.appendChild(dd);
        if (!c.out) {
            const day = iso(calYear, calMonth, c.d);
            if (day === todayIso)
                el.classList.add("today");
            if (day === calSelDay)
                el.classList.add("sel");
            const ts = all.filter((t) => t.date === day);
            if (ts.length) {
                el.classList.add("has"); // a day with anything on it reads darker than an empty one
                const dots = document.createElement("div");
                dots.className = "cdots";
                // One dot per category present. A LOGGED event (it happened) is a filled dot; a derived/planned
                // task (yet to happen) is a hollow ring - so a glance separates "done" from "coming up" (D-109).
                // If a category has both on the same day, it happened: the filled dot wins.
                for (const cat of [...new Set(ts.map((t) => category(t)))]) {
                    const happened = ts.some((t) => category(t) === cat && t.kind === "logged");
                    const i = document.createElement("i");
                    i.className = `cdot ct-${cat} ${happened ? "is-logged" : "is-planned"}`;
                    dots.appendChild(i);
                }
                el.appendChild(dots);
            }
            el.addEventListener("click", () => {
                calSelDay = calSelDay === day ? null : day;
                renderCalendar(currentBundle);
            });
        }
        grid.appendChild(el);
    }
}
// R2 (audit 2026-08): collapse a succession RUN - the same crop's "re-sow every N days" on many dates
// in one bed - into a single agenda card carrying all its dates, instead of one near-identical card per
// date (the audit's seeded August rendered 11 of 12 cards as these). ONLY kind "succession" repeats
// (cool-season and start-indoors emit once per crop); everything else passes through untouched. The run
// keeps the position of its FIRST date (the list is already date-sorted), so date order is preserved.
export function groupAgenda(list) {
    const out = [];
    const rep = new Map(); // group key -> the card already pushed, whose dates we extend
    for (const t of list) {
        if (t.kind === "succession" && t.species) {
            const key = `${t.species}|${t.bed ?? ""}|${t.plotId ?? ""}`;
            const first = rep.get(key);
            if (first) {
                first.groupDates.push(t.date);
                continue;
            }
            const card = { ...t, groupDates: [t.date] };
            rep.set(key, card);
            out.push(card);
        }
        else {
            out.push(t);
        }
    }
    return out;
}
function renderAgenda(all, bundle) {
    const panel = $("caltasks");
    panel.replaceChildren();
    const monthTasks = tasksInMonth(all, calYear, calMonth);
    const list = groupAgenda(calSelDay ? all.filter((t) => t.date === calSelDay) : monthTasks);
    // When the view spans more than one garden (consolidated), each event names its garden so the mix reads.
    const multiGarden = new Set(list.map((t) => t.plotId ?? "")).size > 1;
    // "Events", not "tasks" (D-126, maintainer): the calendar's entries are mostly DATES - frost
    // markers, windows opening, harvest spans - not chores. The engine keeps its gardenTasks name;
    // only the page's vocabulary changes. The count reflects the CARDS shown (a grouped run is one),
    // so the number and the list below it always agree.
    const shown = calSelDay ? list.length : groupAgenda(monthTasks).length;
    $("calagtitle").textContent = calSelDay
        ? `Events on ${MONTHS[calMonth]} ${Number(calSelDay.slice(8))}`
        : `${MONTHS[calMonth]} - ${shown} event${shown === 1 ? "" : "s"}`;
    if (!list.length) {
        const lat = num("lat"), lon = num("lon");
        const cold = lat == null || lon == null;
        const p = document.createElement("p");
        p.className = "hint";
        // Trade-first grammar (earned planner phase A): the empty state names what the missing fact
        // buys, in the same voice as the Plan spine's callouts.
        p.textContent = cold
            ? "A location buys this page its dates - your frost markers and every sow date follow it. Set one on the Plan page."
            : calSelDay ? `Nothing on ${MONTHS[calMonth]} ${Number(calSelDay.slice(8))}.`
                : "No dates this month. A planned bed buys sow and harvest dates; a logged sowing buys its own timeline - both land here.";
        panel.appendChild(p);
        // O58 Phase 4 (slice C): the coaching band fills the truly-cold Calendar - no location, so no
        // dates at all. renderAgenda re-fires on every location/garden change, so it vanishes the moment
        // a location gives the page its dates. Not shown for "located but nothing this month" - that is
        // not a cold surface, it is a quiet one.
        if (cold) {
            const band = document.createElement("div");
            panel.appendChild(band);
            coachBand(band, COACH_HEADING, COACH_CAL, true);
        }
        return;
    }
    // A6: the series sub-rows' Log-it targets - the open season's plantings, computed once per
    // agenda render and only if a series actually asks (most agendas hold none).
    let picksCache = null;
    const picks = () => (picksCache ??= openPlantings(bundle));
    for (const t of list) {
        const cat = category(t);
        const el = document.createElement("div");
        el.className = "caltask " + cat;
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = t.date.slice(5).replace("-", "/");
        const body = document.createElement("div");
        body.className = "tbody";
        const ttl = document.createElement("div");
        ttl.className = "ttl";
        ttl.textContent = t.text ?? taskSentence(t, bundle);
        body.appendChild(ttl);
        // A collapsed succession run (R2): the `when` pill anchors the FIRST sowing; the summary strip
        // names the rest, so all the dates are on screen without a card each. A6 (award-benchmark
        // amendments): the strip is a disclosure now - expanded, the dates list as sub-rows, nearest
        // first, each carrying "Log it" ONLY when the ledger holds a planting to write to (a planned
        // guild's future sowing has no record; inventing one is not logging). The ICS export never
        // sees groupAgenda, so series rows are presentation only.
        if (t.groupDates && t.groupDates.length > 1) {
            const rest = t.groupDates.slice(1).map((d) => d.slice(5).replace("-", "/"));
            const ser = document.createElement("details");
            ser.className = "tseries";
            const sum = document.createElement("summary");
            sum.className = "tdates";
            sum.textContent = `then ${rest.join(", ")} (${t.groupDates.length} sowings)`;
            ser.appendChild(sum);
            const ul = document.createElement("ul");
            ul.className = "tserdates";
            const target = t.plotId === app.currentPlotId && t.species
                ? picks().find((pp) => pp.species === t.species && (!t.bed || pp.bed === t.bed)) ?? null
                : null;
            for (const d of [...t.groupDates].sort()) {
                const li = document.createElement("li");
                const dt = document.createElement("span");
                dt.textContent = d.slice(5).replace("-", "/");
                li.appendChild(dt);
                if (target) {
                    const lg = document.createElement("button");
                    lg.type = "button";
                    lg.className = "tlog";
                    lg.textContent = "Log it";
                    lg.addEventListener("click", () => {
                        calFormOpen?.({ kind: "sowed", plantIdx: target.idx, date: d });
                        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                        document.getElementById("callog")?.scrollIntoView({ behavior, block: "center" });
                    });
                    li.appendChild(lg);
                }
                ul.appendChild(li);
            }
            ser.appendChild(ul);
            body.appendChild(ser);
        }
        // A task that names a species links to that plant's card. The task says WHEN and WHY; the card
        // says everything else the corpus records about it. Deliberately a small trailing link rather
        // than making the whole task tappable: the bed tag beside it already navigates (D-127), and two
        // whole-row gestures on one task is how a tap gets swallowed (O33).
        if (t.species) {
            const pl = document.createElement("a");
            pl.className = "tplant";
            pl.href = plantHref(t.species);
            pl.textContent = `${commonName(bundle, t.species)} ›`;
            body.appendChild(pl);
        }
        if (t.bed || (multiGarden && t.garden)) {
            const meta = document.createElement("div");
            meta.className = "tmeta";
            if (t.bed && t.plotId === app.currentPlotId) {
                // The bed tag is the event's link INTO the Log (D-127, maintainer: events "correlate to
                // notes on the log page... down to a single plant"): tapping it opens that bed's card -
                // and, when the event names a species, that species' panel - so the record the event talks
                // about is one tap away. The › is a typographic control, not an emoji (D-105). The deep-link
                // acts on the ACTIVE garden's Log, so only the active garden's beds are linked; others show plain.
                const bedBtn = document.createElement("button");
                bedBtn.type = "button";
                bedBtn.className = "bed bedlink";
                bedBtn.textContent = `${t.bed} ›`;
                bedBtn.title = `open ${t.bed} in the Log`;
                bedBtn.addEventListener("click", () => app.openLogBed?.(t.bed, t.species ?? null));
                meta.appendChild(bedBtn);
            }
            else if (t.bed) {
                const bedTxt = document.createElement("span");
                bedTxt.className = "bed";
                bedTxt.textContent = t.bed;
                meta.appendChild(bedTxt);
            }
            if (multiGarden && t.garden) {
                const g = document.createElement("span");
                g.className = "gardentag";
                g.textContent = t.garden;
                meta.appendChild(g);
            }
            body.appendChild(meta);
        }
        el.title = t.tip
            ? t.tip
            : t.kind === "harvest_open"
                ? `Estimated from ${commonName(bundle, t.species)}'s days to maturity, counted from its plant date.`
                : ruleClaim(bundle, t.rule);
        el.append(when, body);
        panel.appendChild(el);
    }
}
function renderYearGrid(all) {
    $("calylabel").textContent = String(calYear);
    const wrap = $("calyeargrid");
    wrap.replaceChildren();
    for (let m = 0; m < 12; m++) {
        const days = new Date(calYear, m + 1, 0).getDate();
        const first = new Date(calYear, m, 1).getDay();
        const mt = tasksInMonth(all, calYear, m);
        const marked = new Set(mt.map((t) => Number(t.date.slice(8))));
        const btn = document.createElement("button");
        btn.className = "calym";
        const h = document.createElement("h3");
        h.textContent = MONTHS[m].slice(0, 3);
        const g = document.createElement("div");
        g.className = "calymgrid";
        for (let i = 0; i < first; i++)
            g.appendChild(document.createElement("i"));
        for (let d = 1; d <= days; d++) {
            const i = document.createElement("i");
            if (marked.has(d))
                i.className = "has";
            g.appendChild(i);
        }
        const count = document.createElement("div");
        count.className = "calymcount";
        count.textContent = mt.length ? `${mt.length} event${mt.length === 1 ? "" : "s"}` : "-";
        btn.append(h, g, count);
        btn.addEventListener("click", () => { calMonth = m; calSelDay = null; setView("month"); });
        wrap.appendChild(btn);
    }
}
let currentBundle = null;
// D-106 slice 3: the open season's plantings, labelled "species - bed" (bed via region overlap), for
// the log form's plant picker. Bi-directional logging only touches plantings the ledger already has.
// A coarse spot inside a bed for a region's centroid - "front-left", "back", "middle-right", … - in
// the +y-north frame (higher y = farther/back). Names the physical location so two of the same crop in
// one bed are told apart in words as well as on the diagram. Empty when the point isn't inside the bed.
function bedPosPhrase(pt, bedRegion) {
    const xs = regionPoints(bedRegion).map((q) => q[0]);
    const ys = regionPoints(bedRegion).map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX, spanY = maxY - minY;
    if (spanX <= 0 || spanY <= 0)
        return "";
    const fx = (pt[0] - minX) / spanX, fy = (pt[1] - minY) / spanY;
    const lr = fx < 0.34 ? "left" : fx > 0.66 ? "right" : "";
    const fb = fy > 0.66 ? "back" : fy < 0.34 ? "front" : "middle";
    return [fb, lr].filter(Boolean).join("-");
}
function openPlantings(bundle) {
    const open = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    const beds = app.logSnapshot.beds;
    const bedOf = (region) => {
        try {
            const hits = beds.filter((b) => intersectArea(parseRegion(b.region), region) > 0);
            // ISSUES #12: a sectioned parent is a pure container whose region contains its sections, so a
            // section's planting intersects BOTH. It belongs to the section, not the whole bed - prefer a
            // non-container hit, falling back to the container only if nothing more specific matches.
            return hits.find((b) => !bedHasSections(b.name, beds)) ?? hits[0] ?? null;
        }
        catch {
            return null;
        }
    };
    return (open?.plantings ?? []).map((p, idx) => {
        let region = null;
        try {
            region = parseRegion(p.region);
        }
        catch {
            region = null;
        }
        const bed = region ? bedOf(region) : null;
        const pos = region && bed ? bedPosPhrase(regionCentroid(region), parseRegion(bed.region)) : "";
        const name = commonName(bundle, p.species) || humanize(p.species);
        const bedTail = bed ? ` - ${bed.name}` : "";
        const posTail = pos ? ` (${pos})` : "";
        return { idx, label: `${name}${bedTail}${posTail}`, species: p.species, group: p.cultivar_group ?? null, region, bed: bed?.name ?? "", pos };
    });
}
const SVG_NS = "http://www.w3.org/2000/svg";
// A static, NON-INTERACTIVE bed diagram for choosing WHICH plant an event attaches to (walkthrough).
// Read-only selection only: a tap picks a plant. There is NO drag and no free positioning - the drag
// canvas belongs to My-bed alone (CLAUDE.md). Plants sit at their real region centroid in the plot's
// +y-north metre frame (Y flipped to screen like the ground map), so two of the same crop in one bed
// are told apart by where they physically are. The <select> stays the accessible source of truth and
// this diagram just drives it. Returns a repaint fn, or null when fewer than two plants can be placed
// (nothing to disambiguate - the caller keeps the plain list).
function renderBedPicker(host, plants, selectedIdx, onPick) {
    const placed = plants.filter((p) => p.region);
    if (placed.length < 2)
        return null;
    const bedRegions = new Map();
    for (const b of app.logSnapshot.beds) {
        try {
            bedRegions.set(b.name, parseRegion(b.region));
        }
        catch { /* skip a bad bed */ }
    }
    const ctxBeds = [...new Set(placed.map((p) => p.bed).filter(Boolean))].map((n) => bedRegions.get(n)).filter((r) => !!r);
    const pts = placed.map((p) => regionCentroid(p.region));
    for (const r of ctxBeds)
        pts.push(...regionPoints(r));
    const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
    const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
    const spanX = Math.max(0.5, maxX - minX), spanY = Math.max(0.5, maxY - minY);
    const PAD = 16, TARGET_W = 300, MAX_H = 220;
    const scale = Math.min((TARGET_W - 2 * PAD) / spanX, (MAX_H - 2 * PAD) / spanY);
    const vbW = spanX * scale + 2 * PAD, vbH = spanY * scale + 2 * PAD;
    const toSvg = (x, y) => [PAD + (x - minX) * scale, PAD + (maxY - y) * scale]; // flip Y: north up, like the map
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
    svg.setAttribute("class", "calbedpick");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "pick a plant by where it sits in the bed");
    // Draw the bed outlines first; collect each bed's label to render LAST (above the dots) so a plant
    // dot can never cover the name. The label sits just above the bed's TOP edge - clear of the dots,
    // which all sit inside the bed - and carries a halo (paint-order stroke, CSS) so it stays legible
    // even where a bed is small and a dot rides near the edge.
    const bedLabels = [];
    for (const r of ctxBeds) {
        const name = [...bedRegions].find(([, rr]) => rr === r)?.[0] ?? "";
        const sp = regionPoints(r).map(([x, y]) => toSvg(x, y));
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", sp.map(([x, y]) => `${x},${y}`).join(" "));
        poly.setAttribute("class", "calpickbed");
        svg.appendChild(poly);
        const xs = sp.map((q) => q[0]), ys = sp.map((q) => q[1]);
        bedLabels.push({ name, x: xs.reduce((a, b) => a + b, 0) / xs.length, topY: Math.min(...ys) });
    }
    const cap = document.createElement("p");
    cap.className = "calpickcap";
    const dots = [];
    const paint = () => {
        const sel = selectedIdx();
        for (const g of dots) {
            const on = Number(g.dataset.idx) === sel;
            g.setAttribute("aria-pressed", String(on));
            g.querySelector("circle").setAttribute("class", on ? "calpickdot is-sel" : "calpickdot");
        }
        const p = plants.find((q) => q.idx === sel);
        cap.textContent = p ? `Selected: ${p.label}` : "";
    };
    for (const p of placed) {
        const [cx, cy] = toSvg(p.region ? regionCentroid(p.region)[0] : 0, p.region ? regionCentroid(p.region)[1] : 0);
        const g = document.createElementNS(SVG_NS, "g");
        g.dataset.idx = String(p.idx);
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute("aria-label", p.label);
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("cx", cx.toFixed(1));
        circle.setAttribute("cy", cy.toFixed(1));
        circle.setAttribute("r", "7");
        circle.setAttribute("class", "calpickdot");
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = p.label;
        g.append(circle, title);
        const pick = () => { onPick(p.idx); paint(); };
        g.addEventListener("click", pick);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
        } });
        svg.appendChild(g);
        dots.push(g);
    }
    // Labels LAST, so they paint over the dots; each floats just above its bed's top edge (clamped into
    // the top padding so it never clips), centred on the bed, haloed by CSS for guaranteed contrast.
    for (const bl of bedLabels) {
        const t = document.createElementNS(SVG_NS, "text");
        t.setAttribute("x", bl.x.toFixed(1));
        t.setAttribute("y", Math.max(9, bl.topY - 4).toFixed(1));
        t.setAttribute("class", "calpickbedlabel");
        t.textContent = bl.name;
        svg.appendChild(t);
    }
    host.append(svg, cap);
    paint();
    return paint;
}
let calFormOpen = null;
function renderLogForm(bundle, prefill) {
    const slot = $("callog");
    slot.replaceChildren();
    const db = app.logDb;
    if (!db)
        return;
    const seasonId = app.logSnapshot.seasonId;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "callogbtn";
    btn.textContent = "+ Log an event";
    slot.appendChild(btn);
    calFormOpen = (p) => renderLogForm(bundle, p);
    const openForm = () => {
        if (seasonId == null) {
            const h = document.createElement("p");
            h.className = "hint";
            h.textContent = "Start a season on the Log tab first - then what you do here logs to it.";
            slot.replaceChildren(h);
            return;
        }
        const plants = openPlantings(bundle);
        const f = document.createElement("div");
        f.className = "callogform";
        const mk = (t, cls) => { const e = document.createElement(t); if (cls)
            e.className = cls; return e; };
        const kind = mk("select");
        kind.setAttribute("aria-label", "what happened");
        for (const [v, label] of [["frost", "Frost"], ["heat", "Heat"], ["sowed", "Sowed"], ["transplanted", "Transplanted"],
            ["first_harvest", "First harvest"], ["last_harvest", "Last harvest"], ["ended", "It ended"], ["problem", "A problem"], ["note", "A note"]]) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = label;
            kind.appendChild(o);
        }
        const plant = mk("select");
        plant.setAttribute("aria-label", "which plant");
        for (const { idx, label } of plants) {
            const o = document.createElement("option");
            o.value = String(idx);
            o.textContent = label;
            plant.appendChild(o);
        }
        // The tap-to-pick bed diagram (walkthrough): drawn only when two or more plants can be placed, so
        // there is something to disambiguate. It drives the select above; the select stays keyboard/SR usable.
        const pick = mk("div", "calpickwrap");
        const repaintPick = renderBedPicker(pick, plants, () => Number(plant.value), (idx) => { plant.value = String(idx); });
        plant.addEventListener("change", () => repaintPick?.());
        const sev = mk("select");
        sev.setAttribute("aria-label", "severity");
        const what = mk("input");
        what.type = "text";
        what.placeholder = "what (e.g. slugs)";
        what.setAttribute("aria-label", "what");
        const note = mk("input");
        note.type = "text";
        note.placeholder = "note (optional)";
        note.setAttribute("aria-label", "note");
        const date = mk("input");
        date.type = "date";
        date.setAttribute("aria-label", "date");
        date.value = calSelDay ?? iso(calYear, calMonth, Math.min(new Date().getDate(), new Date(calYear, calMonth + 1, 0).getDate()));
        const err = mk("p", "hint");
        const setOpts = (el, opts) => { el.replaceChildren(); for (const v of opts) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = v;
            el.appendChild(o);
        } };
        const sync = () => {
            const k = kind.value;
            const obs = k === "frost" || k === "heat";
            plant.hidden = obs;
            pick.hidden = obs || !repaintPick; // the diagram follows the plant select, and only if it drew
            what.hidden = k !== "problem";
            note.hidden = !(obs || k === "note"); // a plant-pinned note reuses the note text box
            note.placeholder = k === "note" ? "note (e.g. San Marzano from saved seed)" : "note (optional)";
            sev.hidden = !(k === "frost" || k === "ended" || k === "problem");
            if (k === "frost")
                setOpts(sev, OBSERVATION_SEVERITIES);
            else if (k === "ended")
                setOpts(sev, END_CAUSES);
            else if (k === "problem")
                setOpts(sev, FAILURE_SEVERITIES);
        };
        kind.addEventListener("change", sync);
        sync();
        const save = mk("button", "callogbtn");
        save.type = "button";
        save.textContent = "Save";
        save.addEventListener("click", () => void (async () => {
            err.textContent = "";
            const k = kind.value, d = date.value, idx = Number(plant.value);
            try {
                if (!d)
                    throw new Error("pick a date");
                if (k === "frost" || k === "heat") {
                    await addObservation(db, app.currentPlotId, seasonId, { date: d, event: k,
                        ...(k === "frost" ? { severity: sev.value } : {}),
                        ...(note.value.trim() ? { note: note.value.trim() } : {}) });
                }
                else {
                    if (!plants.length)
                        throw new Error("no plants logged this season yet - add one first");
                    if (k === "sowed")
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, { sown: d });
                    else if (k === "transplanted")
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, { transplanted: d });
                    else if (k === "first_harvest")
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, { first_harvest: d });
                    else if (k === "last_harvest")
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, { last_harvest: d });
                    else if (k === "ended")
                        await endPlanting(db, app.currentPlotId, seasonId, idx, sev.value, d);
                    else if (k === "problem") {
                        if (!what.value.trim())
                            throw new Error("name the problem");
                        await addFailure(db, app.currentPlotId, seasonId, idx, { date: d, mode: what.value.trim(), severity: sev.value });
                    }
                    else if (k === "note") {
                        if (!note.value.trim())
                            throw new Error("write a note");
                        await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: d, text: note.value.trim() });
                    }
                }
                await app.logRefresh?.();
                renderCalendar(bundle); // re-derives the logged events - the entry shows straight back on the calendar
            }
            catch (e) {
                err.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        f.append(kind, pick, plant, sev, what, note, date, save, err);
        // A6: the prefill - kind first (sync() reveals the right fields), then the planting and the
        // row's own date, exactly as a hand-filled form would end up.
        if (prefill) {
            if (prefill.kind) {
                kind.value = prefill.kind;
                sync();
            }
            if (prefill.plantIdx != null) {
                plant.value = String(prefill.plantIdx);
                repaintPick?.();
            }
            if (prefill.date)
                date.value = prefill.date;
        }
        btn.replaceWith(f);
    };
    btn.addEventListener("click", openForm);
    if (prefill)
        openForm();
}
// The bed-filter chip row. Hidden unless a single garden is in scope AND it has two or more beds with
// dated tasks - a single bed has nothing to narrow, and consolidating across gardens hides it (bed names
// repeat across gardens). "All beds" plus one chip per bed; the active one is aria-pressed.
function renderBedFilter(all, allowBeds) {
    const row = $("calbeds");
    if (!allowBeds) {
        calSelBed = null;
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    const beds = bedsWithTasks(all);
    if (calSelBed && !beds.includes(calSelBed))
        calSelBed = null; // a renamed/removed bed drops the focus
    if (beds.length < 2) {
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    row.hidden = false;
    row.replaceChildren();
    const chip = (label, bed) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "calbed";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(calSelBed === bed));
        b.addEventListener("click", () => {
            calSelBed = bed;
            calSelDay = null; // a day tapped under the old scope may hold nothing under the new one
            renderCalendar(currentBundle);
        });
        return b;
    };
    row.appendChild(chip("All beds", null));
    for (const bed of beds)
        row.appendChild(chip(bed, bed));
}
// A garden's tracking season: the newest still-open season, else the newest of any - the same "latest id"
// rule the Log labels "tracking". Used for the OTHER gardens, which have no season selector of their own.
function openSeasonId(seasons) {
    const pool = seasons.filter((s) => !s.closed_date);
    const use = pool.length ? pool : seasons;
    return use.length ? Math.max(...use.map((s) => s.id)) : null;
}
// Load every garden EXCEPT the active one (that one is always live from the snapshot) so the calendar can
// span gardens. Cheap IndexedDB reads, done once per page open then cached; re-renders when the data lands.
async function loadOtherGardens() {
    const db = app.logDb;
    if (!db || calGardensLoading)
        return;
    calGardensLoading = true;
    try {
        const plots = await listPlots(db);
        calGardenNames.clear();
        for (const p of plots)
            calGardenNames.set(p.id, p.name ?? "Garden");
        const others = [];
        for (const p of plots) {
            if (p.id === app.currentPlotId)
                continue;
            const seasons = await listSeasons(db, p.id);
            others.push({ plotId: p.id, name: p.name ?? "Garden", lat: p.anchor?.lat ?? null, lon: p.anchor?.lon ?? null,
                seasons, seasonId: openSeasonId(seasons), beds: p.beds ?? [] });
        }
        calOtherGardens = others;
        calGardensBuiltFor = app.currentPlotId;
    }
    finally {
        calGardensLoading = false;
    }
    if (currentBundle)
        renderCalendar(currentBundle);
    app.homeRefresh?.(); // the home's gardens strip was waiting on exactly this (home.ts)
}
/** How many dated things each garden carries in the next `days` days - the state-aware home's
 *  gardens strip ("which of my three wants me this week"). Built by the SAME task builder the
 *  calendar renders, per garden, so a strip that says "nothing due" and a calendar that shows a
 *  date cannot both be right. Synchronous: the active garden is always live; the others come from
 *  the calendar's own cache, and the first call kicks the one-time load, after which app.homeRefresh
 *  redraws with the real counts (before it lands, the strip shows the active garden's count only). */
export function gardensDueSoon(bundle, todayIso, days = 7) {
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
    if (calOtherGardens === null)
        void loadOtherGardens();
    const year = Number(todayIso.slice(0, 4));
    const end = new Date(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)) + days);
    const endIso = iso(end.getFullYear(), end.getMonth(), end.getDate());
    return gardensNow().map((g) => ({
        plotId: g.plotId,
        name: g.name,
        // A dated thing between today and the horizon. Logged events are the RECORD of something that
        // already happened, so they are not "due" - counting them would tell a gardener who just wrote
        // a note that her garden needs her.
        due: gardenTasksFor(bundle, year, g)
            .filter((t) => t.kind !== "logged" && typeof t.date === "string" && t.date >= todayIso && t.date <= endIso).length,
    }));
}
// Every garden right now: the active one live, plus the cached others.
function gardensNow() {
    const others = (calOtherGardens ?? []).filter((g) => g.plotId !== app.currentPlotId);
    return [currentGardenCtx(), ...others];
}
// The garden in scope: a plotId to focus one, null for all consolidated, defaulting (before any tap) to the
// default garden per the spec. A focus on a garden that has since vanished falls back to the active one.
function resolveSelGarden(gardens) {
    if (calSelGarden === undefined)
        return defaultPlotId() ?? app.currentPlotId;
    if (calSelGarden === null)
        return null;
    return gardens.some((g) => g.plotId === calSelGarden) ? calSelGarden : app.currentPlotId;
}
// The garden-filter chip row. Hidden with fewer than two gardens (nothing to switch). "All gardens" plus a
// chip per garden - the active garden first, then the rest by name; the active one is aria-pressed.
function renderGardenFilter(gardens, sel) {
    const row = $("calgardens");
    if (gardens.length < 2) {
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    row.hidden = false;
    row.replaceChildren();
    const chip = (label, id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "calbed";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(sel === id));
        b.addEventListener("click", () => {
            calSelGarden = id;
            calSelBed = null; // beds belong to a garden; a new garden scope drops the bed focus
            calSelDay = null;
            renderCalendar(currentBundle);
        });
        return b;
    };
    row.appendChild(chip("All gardens", null));
    const ordered = [...gardens].sort((a, b) => a.plotId === app.currentPlotId ? -1 : b.plotId === app.currentPlotId ? 1 : a.name.localeCompare(b.name));
    for (const g of ordered)
        row.appendChild(chip(g.name, g.plotId));
}
export function renderCalendar(bundle) {
    currentBundle = bundle;
    // If the active garden changed since the cache was built, the cached "others" are stale - reload.
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
    const gardens = gardensNow();
    const sel = resolveSelGarden(gardens);
    const chosen = sel === null ? gardens : gardens.filter((g) => g.plotId === sel);
    const everything = chosen.flatMap((g) => gardenTasksFor(bundle, calYear, g));
    // Phase C: the answers ladder's crop dates join the signed-out render exactly as they join the
    // export (gardenWideTasks) - one source, two doors, no disagreement.
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        everything.push(...extra.filter((t) => typeof t.date === "string" && t.date.startsWith(String(calYear))));
    }
    renderGardenFilter(gardens, sel);
    renderBedFilter(everything, sel !== null); // beds narrow within one garden; consolidating hides the row
    const all = filterByBed(everything);
    if (calView === "month") {
        renderMonthGrid(all);
        renderAgenda(all, bundle);
        renderLogForm(bundle);
    }
    else
        renderYearGrid(all);
    if (calOtherGardens === null)
        void loadOtherGardens(); // first render kicks the one-time load
    // O111a: keep the reminder control's state current, and if reminders are on, keep the stored plan in
    // step with the freshly-rendered tasks - a plan changed elsewhere must not leave stale reminders armed.
    renderReminderState();
    if (remindersOn())
        void refreshReminders(buildReminderPlan());
}
function setView(v) {
    calView = v;
    $("calv-month").setAttribute("aria-pressed", String(v === "month"));
    $("calv-year").setAttribute("aria-pressed", String(v === "year"));
    $("calmonthview").hidden = v !== "month";
    $("calyearview").hidden = v !== "year";
    if (currentBundle)
        renderCalendar(currentBundle);
}
// O111a: the reminder plan is built from the SAME task list the export uses (bed filter honoured), so
// the two doors never disagree - what the calendar app would remind you of is what this device will.
function buildReminderPlan() {
    const list = filterByBed(gardenWideTasks(currentBundle, calYear));
    const now = new Date();
    return reminderPlan(list, (t) => taskSentence(t, currentBundle), iso(now.getFullYear(), now.getMonth(), now.getDate()));
}
/** Draw the on-device reminder control's state: hidden entirely where the platform can't wake a closed
 *  app (the export is then the honest path), otherwise on/off with a plain-text status. */
function renderReminderState(status) {
    const btn = $("calnotify");
    const hint = $("calnotifyhint");
    if (!remindersSupported()) {
        btn.hidden = true;
        hint.hidden = true;
        return;
    }
    btn.hidden = false;
    const on = remindersOn();
    btn.textContent = on ? "Reminders on - turn off" : "Remind me on this device";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const msg = status ?? (on
        ? "This device will remind you when tasks come due, even with the app closed. It happens in the background, so the timing is your phone's to choose."
        : "Get a notification on this device when a task is due - no account, nothing leaves your phone.");
    hint.textContent = msg;
    hint.hidden = false;
}
/** Wire the Calendar page's controls once at boot. */
export function initCalendar(bundle) {
    currentBundle = bundle;
    // open on the current month of the open season (falls back to this calendar year)
    calYear = app.logSnapshot.seasonId ?? new Date().getFullYear();
    calMonth = new Date().getMonth();
    $("calv-month").addEventListener("click", () => setView("month"));
    $("calv-year").addEventListener("click", () => setView("year"));
    // The nav + export handlers read `currentBundle`, not the boot-time `bundle` closure: draw() re-renders
    // with the freshest activeBundle (so a plant added mid-session is folded in), and currentBundle holds it.
    $("calprev").addEventListener("click", () => {
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        calSelDay = null;
        renderCalendar(currentBundle);
    });
    $("calnext").addEventListener("click", () => {
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        calSelDay = null;
        renderCalendar(currentBundle);
    });
    $("calyprev").addEventListener("click", () => { calYear--; renderCalendar(currentBundle); });
    $("calynext").addEventListener("click", () => { calYear++; renderCalendar(currentBundle); });
    $("calics").addEventListener("click", () => {
        // Download honours the active bed filter - the calendar you're looking at is the one you export.
        const list = filterByBed(gardenWideTasks(currentBundle, calYear));
        if (!list.length)
            return;
        const slug = calSelBed ? calSelBed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
        void shareOrDownloadIcs(tasksToIcs(list, currentBundle, remindChoice()), `garden-${slug ? slug + "-" : ""}${calYear}.ics`);
    });
    // O111a: on-device reminders. The click is the user gesture Notification.requestPermission needs, so
    // enable/disable runs straight off it. Enabling re-plans (idempotent); the status line stays honest
    // about whether the background wake was actually armed vs. only the plan stored.
    $("calnotify").addEventListener("click", () => {
        void (async () => {
            if (remindersOn()) {
                await disableReminders();
                renderReminderState("Reminders off. Your calendar export still works as before.");
                return;
            }
            const res = await enableReminders(buildReminderPlan());
            if (res.ok) {
                renderReminderState(res.background
                    ? `Reminders on. ${res.count} upcoming ${res.count === 1 ? "task" : "tasks"} on this device; your phone chooses when to check.`
                    : `Reminders saved for this device, but your browser will only show them while the app is installed and in use. On any browser, Add to calendar is the sure path.`);
            }
            else {
                const why = res.reason === "denied" ? "Notifications are blocked for this site - allow them in your browser to get reminders here."
                    : res.reason === "empty" ? "No upcoming tasks to remind you about yet - plan a bed first."
                        : "This browser can't schedule reminders on the device. Use Add to calendar instead.";
                renderReminderState(why);
            }
        })();
    });
    // O5: the one reminder control - a display pref (it follows the account like units/theme), so
    // every device's export writes the same alarm. The calendar app handles per-event exceptions.
    const remindSel = $("calremind");
    remindSel.value = remindChoice();
    remindSel.addEventListener("change", () => setRemindChoice(remindSel.value));
}
