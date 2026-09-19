import { coachBand, COACH_HEADING, COACH_CAL } from "./coachband.js";
import { openSeason as activeSeason, priorSeasons, seasonId as currentSeasonId } from "./session.js";
import { glossTerm } from "./glossary.js";
import { confidenceWord } from "./confidence.js";
import { displayName } from "./engine/guilds.js";
import { gardenTasks } from "./engine/tasks.js";
import { matchSite, resolveClimate } from "./engine/intake.js";
import { frostCalibration, mmddDoy } from "./engine/frostcalib.js";
import { intersectArea, parseRegion, regionCentroid, regionPoints } from "./engine/regions.js";
import { bedHasSections, mergePriorOccupancy, plantingOnBed } from "./plan.js";
import { composePlot } from "./engine/plotcompose.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { heldRotationFamilies } from "./engine/compiler.js";
import { familyName } from "./engine/labels.js";
import { humanize } from "./engine/labels.js";
import { fmtArea, remindChoice, setRemindChoice } from "./units.js";
import { reminderPlan, enableReminders, disableReminders, refreshReminders, remindersSupported, remindersOn } from "./reminders.js";
import { $, disclose, num } from "./dom.js";
import { markLink } from "./dossier.js";
import { plantHref } from "./panels/plantcard.js";
import { activeBundle, app, commonName, defaultPlotId, plantingLabel, ruleClaim } from "./state.js";
import { isSignedIn } from "./account.js";
import { addFailure, addObservation, addPlanting, addPlantingNote, endPlanting, listPlots, listSeasons, updatePlanting } from "./storage.js";
import { toast, celebrate } from "./notices.js";
import { frostNotedLine, plantEntryLine, plantedLine, weatherNotedLine } from "./diary.js";
import { END_CAUSES, FAILURE_SEVERITIES, OBSERVATION_SEVERITIES } from "./engine/seasonlog.js";
import { el } from "./dom.js";
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
export const category = (t) => t.cat ?? (t.kind === "sow_climber" ? "sow" : t.kind === "harvest_open" ? "harvest"
    : t.kind === "log_first_freeze" ? "frost" : "plant");
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calView = "month";
let calViewChosen = false;
let calSelDay = null;
let calSelBed = null;
let calSelGarden = undefined;
let calOtherGardens = null;
let calGardensBuiltFor = null;
let calGardensLoading = false;
const calGardenNames = new Map();
function bedsWithTasks(all) {
    return [...new Set(all.map((t) => t.bed).filter((b) => !!b))].sort();
}
function filterByBed(all) {
    if (!calSelBed)
        return all;
    return all.filter((t) => !t.bed || t.bed === calSelBed);
}
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const isWindowEnd = (t) => /end of the harvest window/i.test(t.text ?? "");
export function lateSentence(sentence, t) {
    const when = monthDay(t.date.slice(5));
    return sentence
        .replace(/: today is the median last frost/, `: the median last frost was ${when}`)
        .replace(/^(Sow or set out [^-]+?) now - /, "$1 - ")
        .replace(/^(Start [^-]+? seeds indoors) now - /, "$1 - ")
        .replace(/^First freeze arrives around now - /, `First freeze was due around ${when} - `);
}
export function taskSentence(t, bundle) {
    if (t.text)
        return t.text;
    if (t.kind === "plant_after_last_frost") {
        const tail = t.frost_risk_until ? ` - 10% of years still see frost after ${monthDay(t.frost_risk_until)}` : "";
        return `Plant ${t.guildName ?? "this team"}: today is the median last frost${tail}.`;
    }
    if (t.kind === "sow_climber") {
        return `Sow the ${commonName(bundle, t.species)} - ~${t.lead_days} days after the ` +
            `${commonName(bundle, t.support)} established; a vine on an unrooted stalk pulls it over.`;
    }
    if (t.kind === "install_support") {
        return `Set the ${commonName(bundle, t.species)} today, with the planting - ` +
            `driving it in later tears roots, and a vine with nothing to climb sprawls.`;
    }
    if (t.kind === "harvest_open") {
        const range = t.dtmRange && t.dtmRange[0] !== t.dtmRange[1] ? `${t.dtmRange[0]}–${t.dtmRange[1]}` : `${t.dtmRange?.[0]}`;
        const base = t.dtmRange
            ? `${commonName(bundle, t.species)} should be ready - ~${range} days from planting; start checking.`
            : `${commonName(bundle, t.species)} should be ready around now; start checking.`;
        return t.pastFreeze
            ? `${base} Heads up: that's after your first freeze (~${monthDay(t.pastFreeze)}), so it may not ripen outdoors.`
            : base;
    }
    return `First freeze arrives around now - log the frost you observe; three logged seasons ` +
        `beat the model on your own ground.`;
}
function addDaysISO(isoDate, n) {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d)
        return null;
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function shiftDays(year, mmdd, n) {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(year, mm - 1, dd + n);
    if (d.getFullYear() !== year)
        return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const monthDay = (mmdd) => {
    if (!mmdd)
        return "";
    const [mm, dd] = mmdd.split("-").map(Number);
    return mm && dd ? `${MONTHS[mm - 1].slice(0, 3)} ${dd}` : mmdd;
};
function loggedEvents(bundle, year, ctx) {
    const beds = ctx.beds;
    const bedOf = (region) => {
        try {
            const r = parseRegion(region);
            const hits = beds.filter((b) => intersectArea(parseRegion(b.region), r) > 0);
            return (hits.find((b) => !bedHasSections(b.name, beds)) ?? hits[0])?.name;
        }
        catch {
            return undefined;
        }
    };
    const out = [];
    const yr = String(year);
    const add = (date, cat, text, species, bed, ended = false, act, label) => {
        if (date && date.slice(0, 4) === yr)
            out.push({ date, kind: "logged", cat, text, species, bed, rule: "logged", tip: "From your season log.", ...(ended ? { ended } : {}),
                ...(act && label ? { act, groupPlants: [{ species, label, n: 1 }] } : {}) });
    };
    for (const season of ctx.seasons) {
        for (const pl of season.plantings ?? []) {
            const bed = bedOf(pl.region), s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
            const gone = !!(pl.end_cause || pl.end_date);
            add(pl.sown, "plant", `Sowed ${s}`, pl.species, bed, gone, "sowed", s);
            add(pl.transplanted, "plant", `Transplanted ${s}`, pl.species, bed, gone, "transplanted", s);
            add(pl.first_harvest, "harvest", `First harvest of ${s}`, pl.species, bed, gone, "first_harvest", s);
            add(pl.last_harvest, "harvest", `Last harvest of ${s}`, pl.species, bed, gone, "last_harvest", s);
            if (pl.end_date)
                add(pl.end_date, "ended", `${s} ended - ${pl.end_cause ?? "removed"}`, pl.species, bed);
            for (const f of pl.failures ?? [])
                add(f.date, "ended", `${s} - ${f.mode} (${f.severity})`, pl.species, bed);
            for (const n of pl.notes ?? [])
                add(n.date, "note", `Note on ${s}: ${n.text}`, pl.species, bed);
        }
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
function dedupeRefs(refs) {
    const seen = new Set();
    const out = [];
    for (const r of refs) {
        const k = `${r.sid}|${r.group ?? ""}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(r);
    }
    return out;
}
export function resolveDtm(sp, group) {
    const asRange = (d) => typeof d === "number" && Number.isFinite(d) ? [d, d]
        : Array.isArray(d) && typeof d[0] === "number" ? [d[0], d[d.length - 1]] : null;
    const groups = sp.cultivar_groups;
    if (group && Array.isArray(groups)) {
        const g = groups.find((cg) => cg.id === group);
        const r = g && asRange(g.days_to_maturity);
        if (r)
            return r;
    }
    const own = asRange(sp.days_to_maturity);
    if (own)
        return own;
    if (Array.isArray(groups)) {
        const ranges = groups
            .map((g) => asRange(g.days_to_maturity)).filter((r) => !!r);
        if (ranges.length)
            return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
    }
    return null;
}
function currentGardenCtx() {
    return { plotId: app.currentPlotId, name: calGardenNames.get(app.currentPlotId) ?? "This garden",
        lat: num("lat"), lon: num("lon"), seasons: app.logSnapshot.seasons, seasonId: currentSeasonId(), beds: app.logSnapshot.beds };
}
export function gardenWideTasks(bundle, year) {
    const out = gardenTasksFor(bundle, year, currentGardenCtx());
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        out.push(...extra.filter((t) => typeof t.date === "string" && t.date.startsWith(String(year))));
    }
    return out;
}
function gardenTasksFor(bundle, year, ctx) {
    const lat = ctx.lat, lon = ctx.lon;
    if (lat == null || lon == null)
        return [];
    const out = [];
    const speciesById = new Map(bundle.species.map((s) => [s.id, s]));
    const r096 = bundle.rules.find((r) => r.id === "R-096");
    const coolOffsets = (r096?.offset_days_before_last_frost ?? null);
    const site = matchSite(lat, lon, bundle);
    const clim = resolveClimate(lat, lon, bundle);
    const stnName = clim?.site.provenance?.station?.name;
    const prov = clim && clim.distanceKm > 2 && stnName
        ? ` Nearest NOAA weather station: ${stnName}, ~${Math.round(clim.distanceKm)} km away - ${confidenceWord(clim.effectiveGrade) ?? "unrated"}, so treat these as approximate for your exact spot.`
        : "";
    const cal = site ? frostCalibration(ctx.seasons, site) : null;
    const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
    const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
    const freezeMmdd = fallObs ?? site?.first_freeze_32f_p50 ?? null;
    const modelLf0 = (site?.last_frost_32f ?? {}).p50 ?? null;
    const springShiftDays = springObs && modelLf0 ? (mmddDoy(springObs) ?? 0) - (mmddDoy(modelLf0) ?? 0) : 0;
    if (site) {
        const lf10 = (site.last_frost_32f ?? {}).p10;
        const lf = springObs ?? modelLf0;
        const ff = fallObs ?? site.first_freeze_32f_p50;
        const springAsk = cal && !cal.spring.calibrated && cal.spring.n > 0
            ? ` Tap the frost you see - your ${cal.spring.n + 1}${cal.spring.n === 1 ? "nd" : cal.spring.n === 2 ? "rd" : "th"} logged season; ${Math.max(1, cal.min_seasons - cal.spring.n)} more and your own dates take over.`
            : "";
        const fallAsk = cal && !cal.fall.calibrated && cal.fall.n > 0
            ? ` Tap the frost you see - your ${cal.fall.n + 1}${cal.fall.n === 1 ? "nd" : cal.fall.n === 2 ? "rd" : "th"} logged season; ${Math.max(1, cal.min_seasons - cal.fall.n)} more and your own dates take over.`
            : "";
        if (lf)
            out.push({ date: `${year}-${lf}`, kind: "log_first_freeze", cat: "frost", rule: "R-031", species: null,
                text: springObs
                    ? `Last spring frost - your ground's observed date over ${cal.spring.n} logged seasons, which supersedes the NOAA weather station's median. Frost-tender crops are safe after this.`
                    : `Last spring frost (median)${lf10 ? ` - 1 year in 10 still frosts as late as ${monthDay(lf10)}` : ""}. Frost-tender crops are safe after this.${springAsk}`,
                tip: springObs ? "Fitted from your own logged frosts - supersedes the model."
                    : `From the nearest NOAA weather station's normals.${prov}${cal && cal.spring.n ? ` You've logged ${cal.spring.n} of 3 seasons toward your own date.` : ""}` });
        if (ff)
            out.push({ date: `${year}-${ff}`, kind: "log_first_freeze", cat: "frost", rule: "R-093", species: null,
                text: fallObs
                    ? `First fall freeze - your ground's observed date over ${cal.fall.n} logged seasons, which supersedes the NOAA weather station's median. The season's end for tender crops.`
                    : `First fall freeze (median) - the season's end for tender crops. Log the frost you see; three seasons beat the model.${fallAsk}`,
                tip: fallObs ? "Fitted from your own logged frosts - supersedes the model."
                    : `From the nearest NOAA weather station's normals.${prov}${cal && cal.fall.n ? ` You've logged ${cal.fall.n} of 3 seasons toward your own date.` : ""}` });
    }
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    const planLive = !!open && open.id === year && !open.closed_date;
    const plans = (planLive && Array.isArray(open.plan) ? open.plan : []);
    const freezeIso = freezeMmdd ? `${year}-${freezeMmdd}` : null;
    const lastFrostIso = site ? (springObs ?? modelLf0) : null;
    const lfIso = lastFrostIso ? `${year}-${lastFrostIso}` : undefined;
    const dtmMinOf = (sid, group) => {
        const sp = speciesById.get(sid);
        if (!sp || sp.scheduling_model !== "dtm")
            return null;
        const r = resolveDtm(sp, group);
        return r ? r[0] : null;
    };
    const windowOf = (sid, group, lead = 0) => {
        const d = dtmMinOf(sid, group);
        if (d == null || !freezeIso)
            return null;
        const closeBy = addDaysISO(freezeIso, -(d + lead));
        return closeBy ? { closeBy, dtmMin: d } : null;
    };
    for (const plan of plans) {
        const guild = bundle.guilds.find((g) => g.id === plan.guild);
        const myBedPlants = !guild && plan.mybed === true && Array.isArray(plan.plantings) ? plan.plantings : null;
        if (!guild && !myBedPlants)
            continue;
        const guildName = guild ? displayName(guild) : (plan.area ?? "your design");
        const memberRefs = guild
            ? guildMemberRefs(guild)
            : dedupeRefs((myBedPlants ?? []).map((p) => ({ sid: p.species, group: p.cultivar_group ?? null })));
        const fits = [];
        for (const r of memberRefs) {
            if (fits.some((f) => f.species === r.sid))
                continue;
            const w = windowOf(r.sid, r.group);
            if (w)
                fits.push({ species: r.sid, ...w });
        }
        const teamClose = fits.length ? fits.reduce((a, b) => (a.closeBy < b.closeBy ? a : b)) : null;
        const win = (w) => w && freezeMmdd ? { closeBy: w.closeBy, dtmMin: w.dtmMin, closeFreeze: freezeMmdd, lastFrost: lfIso, fits } : {};
        let plantMmdd = null, sowMmdd = null, climber = null;
        if (guild) {
            for (const t of gardenTasks(guild, lat, lon, year, bundle)) {
                if (t.kind === "log_first_freeze")
                    continue;
                let tt = t;
                if (springShiftDays && (t.kind === "plant_after_last_frost" || t.kind === "sow_climber")) {
                    const shifted = shiftDays(year, t.date.slice(5), springShiftDays);
                    if (shifted)
                        tt = { ...t, date: shifted };
                }
                if (tt.kind === "plant_after_last_frost") {
                    plantMmdd = tt.date.slice(5);
                    if (springObs && tt.date.slice(5) === springObs)
                        tt = { ...tt, text: `Plant ${guildName}: your ground's own last frost over ${cal.spring.n} logged seasons, superseding the NOAA weather station's median.` };
                }
                if (tt.kind === "sow_climber") {
                    sowMmdd = tt.date.slice(5);
                    climber = tt.species;
                }
                const w = tt.kind === "plant_after_last_frost" ? win(teamClose ? { closeBy: teamClose.closeBy, dtmMin: teamClose.dtmMin } : null)
                    : tt.kind === "sow_climber" && tt.species ? win(windowOf(tt.species, null)) : {};
                out.push({ ...tt, bed: plan.area, guildName, ...w });
            }
        }
        else if (lastFrostIso) {
            plantMmdd = lastFrostIso;
            const observed = !!springObs && lastFrostIso === springObs;
            out.push({ date: `${year}-${lastFrostIso}`, kind: "plant_after_last_frost", rule: "R-031", species: null,
                frost_risk_until: (site?.last_frost_32f ?? {}).p10 ?? null, bed: plan.area, guildName,
                ...(observed ? { text: `Plant ${guildName}: your ground's own last frost over ${cal.spring.n} logged seasons, superseding the NOAA weather station's median.` } : {}),
                ...win(teamClose ? { closeBy: teamClose.closeBy, dtmMin: teamClose.dtmMin } : null) });
        }
        if (plantMmdd) {
            const harvestTargets = [];
            if (guild) {
                const roleOv = new Map();
                for (const r of (Array.isArray(plan.roles) ? plan.roles : [])) {
                    if (typeof r.role === "string" && typeof r.species === "string")
                        roleOv.set(r.role, { species: r.species, group: typeof r.group === "string" ? r.group : null });
                }
                for (const role of guild.roles ?? []) {
                    const ov = roleOv.get(role.id);
                    const sid = ov ? ov.species : role.canonical;
                    if (!sid)
                        continue;
                    const grp = ov ? ov.group : (role.canonical_group ?? null);
                    harvestTargets.push({ sid, group: grp });
                }
            }
            else {
                for (const r of memberRefs)
                    harvestTargets.push(r);
            }
            for (const { sid, group } of harvestTargets) {
                const sp = sid ? speciesById.get(sid) : undefined;
                if (!sid || !sp || sp.scheduling_model !== "dtm")
                    continue;
                const dtm = resolveDtm(sp, group ?? null);
                if (!dtm)
                    continue;
                const base = sid === climber && sowMmdd ? sowMmdd : plantMmdd;
                const date = shiftDays(year, base, dtm[0]);
                const pastFreeze = date && freezeMmdd && date.slice(5) > freezeMmdd ? freezeMmdd : undefined;
                if (date)
                    out.push({ date, kind: "harvest_open", rule: "days-to-maturity", species: sid,
                        bed: plan.area, guildName, dtmRange: [dtm[0], dtm[1]], pastFreeze });
            }
        }
        if (plantMmdd) {
            const ffmmdd = fallObs ?? site?.first_freeze_32f_p50 ?? null;
            const freeze = ffmmdd ? `${year}-${ffmmdd}` : null;
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const sp = speciesById.get(sid);
                if (!sp || sp.scheduling_model !== "dtm")
                    continue;
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
                        break;
                    out.push({ date: sd, kind: "succession", cat: "sow", rule: "R-034", species: sid, bed: plan.area, guildName, anchor: "planned",
                        text: `Sow more ${label} - re-sow every ${cadence} so there's always some coming, not all at once.`,
                        tip: "This re-sow can still mature before your median first freeze.", ...win(windowOf(sid, group)) });
                }
            }
        }
        if (plantMmdd && coolOffsets) {
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
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
                    text: `Sow or set out ${label} now - ${tol === "hardy" ? "cold-hardy" : "half-hardy"}, so it can go in about ${weeks} week${weeks === 1 ? "" : "s"} before your last frost.`,
                    ...win(windowOf(sid, group)) });
            }
        }
        if (plantMmdd) {
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
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
                    text: `Start ${label} seeds indoors now - about ${wk} weeks before your last frost; set the seedlings out after it.`,
                    ...win(windowOf(sid, group, wk * 7)) });
            }
        }
    }
    out.push(...loggedEvents(bundle, year, ctx));
    {
        const season = ctx.seasons.find((s) => s.id === ctx.seasonId);
        const beds = ctx.beds;
        const bedOf = (region) => {
            try {
                const r = parseRegion(region);
                const hits = beds.filter((b) => intersectArea(parseRegion(b.region), r) > 0);
                return (hits.find((b) => !bedHasSections(b.name, beds)) ?? hits[0])?.name;
            }
            catch {
                return undefined;
            }
        };
        const planned = new Set((Array.isArray(season?.plan) ? season.plan : []).map((e) => e.area));
        const yrStr = String(year);
        const emitted = new Set();
        const push = (t) => {
            const k = `${t.date}|${t.kind}|${t.species}|${t.bed ?? ""}`;
            if (emitted.has(k))
                return;
            emitted.add(k);
            out.push(t);
        };
        for (const pl of (season && !season.closed_date ? season.plantings : undefined) ?? []) {
            if (pl.end_cause)
                continue;
            const anchor = pl.transplanted || pl.sown;
            if (!anchor)
                continue;
            const bed = bedOf(pl.region);
            if (bed && planned.has(bed))
                continue;
            const sp = speciesById.get(pl.species);
            if (!sp || sp.scheduling_model !== "dtm")
                continue;
            const dtm = resolveDtm(sp, pl.cultivar_group);
            if (!dtm)
                continue;
            const s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
            const anchorYear = Number(anchor.slice(0, 4));
            const freezeA = freezeMmdd ? `${anchorYear}-${freezeMmdd}` : null;
            const tipBase = "Estimated from your logged planting date and this crop's days to maturity.";
            const emitHarvest = (offset, ready, late) => {
                const d = addDaysISO(anchor, offset);
                if (!d || d.slice(0, 4) !== yrStr)
                    return;
                const pastFreeze = freezeA && d > freezeA ? freezeMmdd : undefined;
                push({ date: d, kind: "harvest_open", cat: "harvest", rule: "days-to-maturity", species: pl.species, bed,
                    text: pastFreeze ? late : ready, tip: tipBase, pastFreeze });
            };
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
                    if (freezeA) {
                        const mature = addDaysISO(d, dtm[0]);
                        if (!mature || mature > freezeA)
                            break;
                    }
                    else if (k > 2)
                        break;
                    if (d.slice(0, 4) !== yrStr)
                        continue;
                    const closeBy = freezeA ? addDaysISO(freezeA, -dtm[0]) : null;
                    push({ date: d, kind: "succession", cat: "sow", rule: "R-034", species: pl.species, bed, anchor: "logged",
                        text: `Sow more ${s} - re-sow every ${cadence} so there's always some coming, not all at once.`,
                        tip: "Counted from your logged sowing date; interval per species.",
                        ...(closeBy && freezeMmdd ? { closeBy, dtmMin: dtm[0], closeFreeze: freezeMmdd } : {}) });
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
        lines.push("BEGIN:VEVENT", `UID:${n === 1 ? base : `${base}-${n}`}@garden-grows`, "DTSTAMP:19700101T000000Z", `DTSTART;VALUE=DATE:${t.date.replaceAll("-", "")}`, `SUMMARY:${esc(summary)}`, ...(t.bed ? [`LOCATION:${esc(t.bed)}`] : []), "DESCRIPTION:planned with milpa.garden", ...(remind === "none" ? [] : [
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
export async function shareOrDownloadIcs(ics, filename) {
    const blob = new Blob([ics], { type: "text/calendar" });
    const file = new File([blob], filename, { type: "text/calendar" });
    const nav = navigator;
    if (nav.canShare?.({ files: [file] })) {
        try {
            await nav.share({ files: [file], title: "Garden calendar" });
            return;
        }
        catch { }
    }
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
    {
        const lab = $("calmlabel");
        lab.replaceChildren();
        const orn = document.createElementNS(SVG_NS, "svg");
        orn.setAttribute("class", "sprig-orn calm-orn");
        orn.setAttribute("viewBox", "0 0 24 24");
        orn.setAttribute("aria-hidden", "true");
        const ornUse = document.createElementNS(SVG_NS, "use");
        ornUse.setAttribute("href", "#sprig");
        orn.appendChild(ornUse);
        const mon = document.createElement("span");
        mon.className = "calm-mon";
        mon.textContent = MONTHS[calMonth];
        const yr = document.createElement("span");
        yr.className = "calm-yr";
        yr.textContent = String(calYear);
        lab.append(orn, mon, document.createTextNode(" "), yr);
    }
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
            chip.addEventListener("click", () => { calMonth = m; calViewChosen = true; renderCalendar(currentBundle); });
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
                el.classList.add("has");
                const dots = document.createElement("div");
                dots.className = "cdots";
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
export function groupAgenda(list) {
    const out = [];
    const rep = new Map();
    const acts = new Map();
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
        else if (t.kind === "logged" && t.act && t.groupPlants?.length) {
            const key = `${t.date}|${t.plotId ?? ""}|${t.bed ?? ""}|${t.act}`;
            const first = acts.get(key);
            if (first) {
                const plants = first.groupPlants;
                for (const p of t.groupPlants) {
                    const hit = plants.find((x) => x.label === p.label);
                    if (hit)
                        hit.n += p.n;
                    else
                        plants.push({ ...p });
                }
                first.text = actSentence(first.act, plants);
                first.ended = first.ended && t.ended;
                continue;
            }
            const card = { ...t, groupPlants: t.groupPlants.map((p) => ({ ...p })) };
            acts.set(key, card);
            out.push(card);
        }
        else {
            out.push(t);
        }
    }
    return out;
}
export function actSentence(act, plants) {
    const verb = act === "sowed" ? "Sowed" : act === "transplanted" ? "Transplanted" : act === "first_harvest" ? "First harvest of" : "Last harvest of";
    const one = plants.length === 1 && plants[0].n === 1;
    return `${verb} ${one ? plants[0].label : plants.map((p) => (p.n > 1 ? `${p.n} × ${p.label}` : p.label)).join(" + ")}`;
}
const DONE_GRACE_DAYS = 7;
const TODAY_ISO = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
function isDone(t, all) {
    if (t.kind === "logged")
        return false;
    const cat = category(t);
    const logged = all.filter((e) => e.kind === "logged" && (e.plotId ?? "") === (t.plotId ?? ""));
    const sameBed = (e) => !t.bed ? !e.bed : e.bed === t.bed;
    const sameSpecies = (e) => !t.species || e.species === t.species;
    const since = addDaysISO(t.date, -DONE_GRACE_DAYS) ?? t.date;
    if (cat === "harvest")
        return logged.some((e) => category(e) === "harvest" && sameBed(e) && sameSpecies(e));
    if (cat === "frost")
        return logged.some((e) => category(e) === "frost" && Math.abs(daysBetween(e.date, t.date)) <= 30);
    if (t.kind === "plant_after_last_frost")
        return logged.some((e) => category(e) === "plant" && sameBed(e) && e.date >= since);
    if (t.kind === "succession")
        return logged.some((e) => category(e) === "plant" && sameBed(e) && sameSpecies(e) && e.date >= since);
    return logged.some((e) => category(e) === "plant" && sameBed(e) && sameSpecies(e));
}
function freshRegion(fresh) {
    const spot = app.plannedSpotFor?.(fresh.bed, fresh.species) ?? null;
    if (spot) {
        const side = Math.max(0.2, spot.r * 2);
        return { shape: "rect", x: spot.x - side / 2, y: spot.y - side / 2, w: side, h: side };
    }
    const bed = app.logSnapshot.beds.find((b) => b.name === fresh.bed);
    if (!bed)
        throw new Error("that bed isn't on the map any more");
    const [cx, cy] = regionCentroid(parseRegion(bed.region));
    return { shape: "rect", x: cx - 0.15, y: cy - 0.15, w: 0.3, h: 0.3 };
}
function didIt(t, bundle, card, btn, armed) {
    const today = TODAY_ISO();
    const open = (p) => {
        const slot = document.getElementById(logSlotId());
        if (slot)
            card.after(slot);
        calFormOpener?.setAttribute("aria-expanded", "false");
        calFormOpener = btn;
        btn.setAttribute("aria-expanded", "true");
        calFormOpen?.({ ...p, title: t.text ?? taskSentence(t, bundle) });
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        slot?.scrollIntoView({ behavior, block: "nearest" });
    };
    const season = activeSeason();
    const live = (idx) => !season?.plantings?.[idx]?.end_cause;
    const onBed = openPlantings(bundle).filter((pp) => live(pp.idx) && (!t.bed || pp.bed === t.bed));
    const target = t.species ? onBed.find((pp) => pp.species === t.species) ?? null : null;
    if (t.kind === "harvest_open") {
        if (!target) {
            toast(`no ${commonName(bundle, t.species)} in the Log on ${t.bed ?? "that bed"} yet - add it there first`);
            return;
        }
        const p = season?.plantings?.[target.idx];
        const endCard = /end of the harvest window/i.test(t.text ?? "");
        open({ kind: p?.first_harvest || endCard ? "last_harvest" : "first_harvest", plantIdx: target.idx, date: today });
        return;
    }
    if (t.kind === "succession" || t.kind === "cool_season" || t.kind === "start_indoors" || t.kind === "sow_climber") {
        const win = taskWindow(t, bundle, today);
        const setOut = t.kind === "start_indoors" && win?.state === "closed" && /started plants/.test(win.line);
        const targetRec = target ? season?.plantings?.[target.idx] : undefined;
        const wouldOverwrite = !!targetRec && (setOut ? !!targetRec.transplanted : !!targetRec.sown);
        if (target && t.kind !== "succession" && !wouldOverwrite) {
            open({ kind: setOut ? "transplanted" : "sowed", plantIdx: target.idx, date: today });
            return;
        }
        if (t.species && t.bed) {
            const spot = app.plannedSpotFor?.(t.bed, t.species) ?? null;
            open({ kind: setOut ? "transplanted" : "sowed", newPlanting: { species: t.species, group: spot?.group ?? null, bed: t.bed, setOut }, date: today });
            return;
        }
        toast("this sowing names no bed - log it from the Log tab");
        return;
    }
    if (t.kind === "install_support") {
        const any = onBed[0] ?? null;
        if (any) {
            open({ kind: "note", plantIdx: any.idx, noteText: `Support in${t.species ? ` - ${commonName(bundle, t.species)}` : ""}`, date: today });
            return;
        }
        if (t.bed)
            app.openLogBed?.(t.bed);
        else
            toast("open the bed in the Log to note the support");
        return;
    }
    if (t.kind === "log_first_freeze" || category(t) === "frost") {
        open({ kind: "frost", date: today });
        return;
    }
    if (t.kind === "plant_after_last_frost") {
        const hook = app.markBedPlantedFromPlan;
        if (!hook || !t.bed) {
            toast("one moment - the garden is still loading");
            return;
        }
        let callout = card.querySelector(".tcallout");
        if (!callout) {
            callout = document.createElement("p");
            callout.className = "tcallout";
            card.appendChild(callout);
        }
        if (!armed.confirmed) {
            armed.confirmed = true;
            const bedName = t.bed;
            const say = (n) => {
                callout.textContent = `This puts the whole team${n != null ? ` - ${n} plant${n === 1 ? "" : "s"}` : ""} in ${bedName} today, dated, and the diary starts. Tap “Did it” again to plant.`;
            };
            say(null);
            void app.planReceipt?.(bedName).then((r) => { if (r && r.sized)
                say(r.plants); });
            return;
        }
        const plant = async (opts) => {
            btn.disabled = true;
            const r = await hook(t.bed, opts);
            if (r.ok) {
                celebrate(plantedLine(Number(t.date.slice(0, 4)), null, t.bed));
                await app.logRefresh?.();
                renderCalendar(bundle);
                return;
            }
            btn.disabled = false;
            if (r.canAdvanceTo != null) {
                const yr = r.canAdvanceTo;
                callout.replaceChildren(document.createTextNode(`${r.reason ?? ""} `));
                const adv = document.createElement("button");
                adv.type = "button";
                adv.className = "tdid";
                adv.textContent = `Start ${yr} season & plant`;
                adv.addEventListener("click", () => void plant({ advance: true }));
                callout.appendChild(adv);
                return;
            }
            if (r.nudge) {
                armed.force = true;
                callout.textContent = `${r.nudge} Tap “Did it” again to plant anyway.`;
                return;
            }
            toast(r.reason ?? "could not plant this bed just now");
        };
        void plant(armed.force ? { force: true } : undefined);
        return;
    }
    toast("log this one from the Log tab");
}
export function successionWhy(bundle, t) {
    const name = t.species ? (commonName(bundle, t.species) || humanize(t.species)) : "this crop";
    const cadence = t.text?.match(/re-sow every ([^ ]+(?: days)?)/)?.[1];
    const every = cadence ? ` at ${name}'s own re-sow interval of ${cadence}` : ` at ${name}'s own re-sow interval`;
    const from = t.anchor === "logged" ? "the sowing you logged" : `${t.guildName ? `the ${t.guildName}` : "the team"} plan's sowing`;
    const bound = t.closeBy && t.closeFreeze && t.dtmMin != null
        ? ` The run stops where a sowing could no longer ripen before your typical first freeze (~${monthDay(t.closeFreeze)}): ${name} needs about ${t.dtmMin} days, so the last re-sow that still fits is ${prettyIso(t.closeBy)}.`
        : " The run stops where a sowing could no longer ripen before your typical first freeze.";
    return `Counted forward from ${from}${every}, so there is always some coming rather than all at once.${bound}`;
}
const CLOSING_DAYS = 14;
const prettyIso = (iso) => monthDay(iso.slice(5));
export function taskWindow(t, bundle, todayIso) {
    if (!t.closeBy || !t.closeFreeze)
        return null;
    if (t.kind === "harvest_open" || t.kind === "logged" || t.kind === "install_support" || category(t) === "frost")
        return null;
    const name = (sid) => sid ? (commonName(bundle, sid) || humanize(sid)) : (t.guildName ?? "this team");
    const freeze = `~${monthDay(t.closeFreeze)}`;
    const by = prettyIso(t.closeBy);
    const slowest = t.kind === "plant_after_last_frost" && t.fits?.length
        ? name(t.fits.reduce((a, b) => (a.closeBy < b.closeBy ? a : b)).species) : name(t.species);
    const verb = t.kind === "start_indoors" ? "Start" : t.kind === "plant_after_last_frost" ? "Plant" : "Sow";
    if (todayIso <= t.closeBy) {
        const days = daysBetween(todayIso, t.closeBy);
        return { state: days <= CLOSING_DAYS ? "closing" : "open", closeBy: t.closeBy,
            line: `${verb} by ${by} - after that, ${slowest} can't ripen before your first freeze (${freeze}).` };
    }
    const lost = t.kind === "start_indoors" ? `started now, ${slowest} wouldn't ripen`
        : t.kind === "plant_after_last_frost" ? `planted now, ${slowest} wouldn't ripen` : `sown now, ${slowest} wouldn't ripen`;
    return { state: "closed", closeBy: t.closeBy, line: `This window closed ${by} - ${lost} before your first freeze (${freeze}). ${windowAlternative(t, bundle, todayIso)}` };
}
function windowAlternative(t, bundle, todayIso) {
    const name = (sid) => commonName(bundle, sid) || humanize(sid);
    const freezeIso = t.closeFreeze ? `${t.closeBy.slice(0, 4)}-${t.closeFreeze}` : null;
    const freeze = `~${monthDay(t.closeFreeze)}`;
    if (t.kind === "start_indoors" && t.dtmMin != null && freezeIso) {
        const setOut = t.lastFrost && todayIso < t.lastFrost ? t.lastFrost : todayIso;
        const ripen = addDaysISO(setOut, t.dtmMin);
        if (ripen && ripen <= freezeIso) {
            return setOut === todayIso
                ? `Set out started plants instead - planted now, they'd ripen around ${prettyIso(ripen)}.`
                : `Set out started plants after your last frost (${prettyIso(setOut)}) instead - they'd ripen around ${prettyIso(ripen)}.`;
        }
    }
    const fits = (t.fits ?? []).filter((f) => f.closeBy >= todayIso && f.species !== t.species)
        .sort((a, b) => b.closeBy.localeCompare(a.closeBy));
    if (fits.length) {
        const named = fits.slice(0, 2);
        const list = named.map((f) => name(f.species)).join(" or ");
        const more = fits.length > 2 ? ` (and ${fits.length - 2} more)` : "";
        return `${list} still fit${more} - sow ${name(named[0].species)} by ${prettyIso(named[0].closeBy)}.`;
    }
    return `Next season for this one - nothing sown now would ripen before your first freeze (${freeze}).`;
}
const windowClosed = (t, todayIso) => !!t.closeBy && t.closeBy < todayIso;
const byDate = (a, b) => a.date.localeCompare(b.date);
function latestOfRuns(list) {
    const keep = new Map();
    const out = [];
    for (const t of list) {
        if (t.kind !== "succession" || !t.species) {
            out.push(t);
            continue;
        }
        const key = `${t.species}|${t.bed ?? ""}|${t.plotId ?? ""}`;
        const cur = keep.get(key);
        if (!cur || cur.date < t.date)
            keep.set(key, t);
    }
    return [...out, ...keep.values()];
}
export function weekJobs(all, todayIso, days = 7) {
    const endIso = addDaysISO(todayIso, days) ?? todayIso;
    const open = all.filter((t) => t.kind !== "logged" && typeof t.date === "string" && onLiveGround(t, all));
    const late = latestOfRuns(open.filter((t) => t.date < todayIso && category(t) !== "frost" && !isDone(t, all)))
        .sort((a, b) => (Number(windowClosed(a, todayIso)) - Number(windowClosed(b, todayIso))) || byDate(b, a));
    const closed = late.filter((t) => windowClosed(t, todayIso)).length;
    const week = open.filter((t) => t.date >= todayIso && t.date <= endIso).sort(byDate);
    const done = week.filter((t) => isDone(t, all));
    const todo = week.filter((t) => !isDone(t, all));
    const byDay = new Map();
    for (const t of todo)
        (byDay.get(t.date) ?? byDay.set(t.date, []).get(t.date)).push(t);
    const due = todo.filter((t) => category(t) !== "frost").length;
    return { late, days: [...byDay].map(([date, tasks]) => ({ date, tasks })), done, due, closed };
}
function onLiveGround(t, all) {
    return (t.kind !== "succession" && t.kind !== "harvest_open") || !t.species
        || all.some((e) => e.kind === "logged" && category(e) === "plant" && !e.ended && e.species === t.species
            && (e.plotId ?? "") === (t.plotId ?? "") && (!t.bed || e.bed === t.bed));
}
export function isOwed(t, all) {
    return t.kind !== "logged" && typeof t.date === "string" && onLiveGround(t, all) && !isDone(t, all);
}
function weekTaskPool(bundle, gardens, todayIso, withAnswers, days = 7) {
    const endIso = addDaysISO(todayIso, days) ?? todayIso;
    const years = [...new Set([Number(todayIso.slice(0, 4)), Number(endIso.slice(0, 4))])];
    const out = gardens.flatMap((g) => years.flatMap((y) => gardenTasksFor(bundle, y, g)));
    if (withAnswers) {
        const extra = (app.answersTasks?.() ?? []);
        out.push(...extra.filter((t) => typeof t.date === "string" && years.some((y) => t.date.startsWith(String(y)))));
    }
    return out;
}
const LATE_OPEN = 3;
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayHeading(dateIso, todayIso) {
    const d = new Date(`${dateIso}T12:00:00`);
    const label = `${DAYS_SHORT[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    const gap = daysBetween(todayIso, dateIso);
    return gap === 0 ? `Today · ${label}` : gap === 1 ? `Tomorrow · ${label}` : label;
}
function renderWeek(all, bundle, todayIso) {
    const panel = $("calweek");
    homeLogSlot();
    panel.replaceChildren();
    const jobs = weekJobs(all, todayIso);
    const n = jobs.due, c = jobs.closed, l = jobs.late.length - c;
    $("calwktitle").textContent = n
        ? `This week - ${n} thing${n === 1 ? "" : "s"} to do${l ? `, ${l} overdue` : ""}${c ? `, ${c} closed` : ""}`
        : l ? `This week - ${l} running late${c ? `, ${c} closed` : ""}`
            : c ? `This week - ${c} window${c === 1 ? "" : "s"} closed`
                : "This week";
    if (!n && !jobs.late.length && !jobs.done.length) {
        const lat = num("lat"), lon = num("lon");
        const cold = lat == null || lon == null;
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = cold
            ? "Set a location and your frost dates and every sow date fill in here. Set one on the Plan page."
            : "Nothing due this week. The month view shows what comes next.";
        panel.appendChild(p);
        if (cold) {
            const band = document.createElement("div");
            panel.appendChild(band);
            coachBand(band, COACH_HEADING, COACH_CAL, true);
        }
        return;
    }
    const multiGarden = new Set(all.map((t) => t.plotId ?? "")).size > 1;
    const picks = pickCache(bundle);
    const group = (heading, cls, cards) => {
        const sec = document.createElement("section");
        sec.className = `calwkgroup ${cls}`;
        const h = document.createElement("h3");
        h.className = "calwkday";
        h.textContent = heading;
        sec.append(h, ...cards);
        panel.appendChild(sec);
    };
    if (jobs.late.length) {
        const cards = jobs.late.map((t) => taskCard(t, all, bundle, picks, multiGarden, daysBetween(t.date, todayIso)));
        const shown = cards.slice(0, LATE_OPEN), rest = cards.slice(LATE_OPEN);
        group("Late", "late", shown);
        if (rest.length) {
            const more = document.createElement("details");
            more.className = "calwkmore";
            const sum = document.createElement("summary");
            sum.textContent = `${rest.length} more running late`;
            more.append(sum, ...rest);
            panel.lastElementChild?.appendChild(more);
        }
    }
    for (const d of jobs.days)
        group(dayHeading(d.date, todayIso), "day", d.tasks.map((t) => taskCard(t, all, bundle, picks, multiGarden)));
    if (jobs.done.length)
        group("Done this week", "done", jobs.done.map((t) => taskCard(t, all, bundle, picks, multiGarden)));
}
function renderAgenda(all, bundle) {
    const panel = $("caltasks");
    homeLogSlot();
    panel.replaceChildren();
    const monthTasks = tasksInMonth(all, calYear, calMonth);
    const list = groupAgenda(calSelDay ? all.filter((t) => t.date === calSelDay) : monthTasks);
    const multiGarden = new Set(list.map((t) => t.plotId ?? "")).size > 1;
    const shown = calSelDay ? list.length : groupAgenda(monthTasks).length;
    $("calagtitle").textContent = calSelDay
        ? `Events on ${MONTHS[calMonth]} ${Number(calSelDay.slice(8))}`
        : `${MONTHS[calMonth]} - ${shown} event${shown === 1 ? "" : "s"}`;
    if (!list.length) {
        const lat = num("lat"), lon = num("lon");
        const cold = lat == null || lon == null;
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = cold
            ? "Set a location and your frost dates and every sow date fill in here. Set one on the Plan page."
            : calSelDay ? `Nothing on ${MONTHS[calMonth]} ${Number(calSelDay.slice(8))}.`
                : "No dates this month. A planned bed brings its sow and harvest dates; a logged sowing brings its own timeline - both land here.";
        panel.appendChild(p);
        if (cold) {
            const band = document.createElement("div");
            panel.appendChild(band);
            coachBand(band, COACH_HEADING, COACH_CAL, true);
        }
        return;
    }
    const picks = pickCache(bundle);
    for (const t of list)
        panel.appendChild(taskCard(t, all, bundle, picks, multiGarden));
}
function pickCache(bundle) {
    let picksCache = null;
    return () => (picksCache ??= openPlantings(bundle));
}
function taskCard(t, all, bundle, picks, multiGarden, late) {
    {
        const cat = category(t);
        const el = document.createElement("div");
        el.className = "caltask " + cat;
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = monthDay(t.date.slice(5));
        el.dataset.date = t.date;
        const body = document.createElement("div");
        body.className = "tbody";
        const win = taskWindow(t, bundle, TODAY_ISO());
        if (late != null && late > 0) {
            const lt = document.createElement("span");
            lt.className = win?.state === "closed" ? "tlate closed" : "tlate";
            const days = `${late} day${late === 1 ? "" : "s"}`;
            lt.textContent = win?.state === "closed" ? "window closed"
                : category(t) === "harvest" ? (isWindowEnd(t) ? `${days} past its likely end` : `ready ${days}`) : `late by ${days}`;
            body.appendChild(lt);
        }
        const ttl = document.createElement("div");
        ttl.className = "ttl";
        ttl.textContent = late != null && late > 0 ? lateSentence(t.text ?? taskSentence(t, bundle), t) : (t.text ?? taskSentence(t, bundle));
        body.appendChild(ttl);
        if (win && (late != null || win.state !== "open")) {
            const w = document.createElement("p");
            w.className = win.state === "closed" ? "twin closed" : "twin";
            w.textContent = win.line;
            body.appendChild(w);
        }
        if (t.groupDates && t.groupDates.length > 1) {
            const rest = t.groupDates.slice(1).map((d) => monthDay(d.slice(5)));
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
                dt.textContent = monthDay(d.slice(5));
                li.appendChild(dt);
                if (target) {
                    const lg = document.createElement("button");
                    lg.type = "button";
                    lg.className = "tlog";
                    lg.textContent = "Log it";
                    lg.addEventListener("click", () => {
                        const rec = activeSeason()?.plantings?.[target.idx];
                        if (rec?.sown && t.bed) {
                            const spot = app.plannedSpotFor?.(t.bed, t.species) ?? null;
                            calFormOpen?.({ kind: "sowed", newPlanting: { species: t.species, group: spot?.group ?? rec.cultivar_group ?? null, bed: t.bed }, date: d });
                        }
                        else
                            calFormOpen?.({ kind: "sowed", plantIdx: target.idx, date: d });
                        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                        document.getElementById(logSlotId())?.scrollIntoView({ behavior, block: "center" });
                    });
                    li.appendChild(lg);
                }
                ul.appendChild(li);
            }
            ser.appendChild(ul);
            body.appendChild(ser);
        }
        const linkSpecies = t.groupPlants?.length ? [...new Set(t.groupPlants.map((p) => p.species))] : t.species ? [t.species] : [];
        for (const sid of linkSpecies) {
            const pl = document.createElement("a");
            pl.className = "tplant";
            pl.href = plantHref(sid);
            pl.textContent = `${commonName(bundle, sid)} ›`;
            body.appendChild(pl);
        }
        if (t.bed || (multiGarden && t.garden)) {
            const meta = document.createElement("div");
            meta.className = "tmeta";
            if (t.bed && t.plotId === app.currentPlotId) {
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
        if (win && win.state === "open" && late == null)
            el.title = `${el.title} ${win.line}`.trim();
        if (t.rule && /^R-\d/.test(t.rule) && t.kind !== "harvest_open") {
            body.appendChild(document.createTextNode(" "));
            const a = document.createElement("a");
            a.className = "whytap";
            a.href = `#/why?rule=${t.rule}`;
            a.textContent = "Why this? →";
            markLink(a, { kind: "rule", id: t.rule });
            body.appendChild(a);
        }
        const mine = t.plotId === app.currentPlotId;
        if (t.species && mine && t.kind !== "logged") {
            const sid = t.species;
            let why = null;
            if (t.kind === "succession") {
                why = () => successionWhy(bundle, t);
            }
            else if (t.kind === "start_indoors" || t.kind === "plant_after_last_frost" || t.kind === "cool_season") {
                const lat = num("lat"), lon = num("lon");
                if (lat != null && lon != null) {
                    why = () => import("./answers.js").then((m) => m.cropAnswer(sid, lat, lon, TODAY_ISO(), bundle)?.explain ?? "Your dates come from your resolved climate, not a seed packet.");
                }
            }
            else if ((cat === "sow" || cat === "plant") && t.tip) {
                const tip = t.tip;
                why = () => tip;
            }
            else if (t.kind === "harvest_open") {
                const range = t.dtmRange ? ` (${t.dtmRange[0]} to ${t.dtmRange[1]} days)` : "";
                why = () => `Estimated from ${commonName(bundle, sid)}'s days to maturity${range}, counted from its plant date - not a promise, a window to start checking.`;
            }
            if (why) {
                const row = document.createElement("div");
                row.className = "twhyrow";
                row.appendChild(disclose("Why this date", why));
                body.appendChild(row);
            }
        }
        if (t.kind !== "logged" && mine && isDone(t, all)) {
            el.classList.add("done");
            const dn = document.createElement("span");
            dn.className = "tdone";
            dn.textContent = "Done";
            el.append(when, body, dn);
        }
        else if (t.kind !== "logged" && mine) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "tdid";
            b.textContent = "Did it";
            b.title = "log that this happened - the date defaults to today, and you can change it";
            b.setAttribute("aria-expanded", "false");
            const armed = { force: false };
            b.addEventListener("click", () => didIt(t, bundle, el, b, armed));
            el.append(when, body, b);
        }
        else {
            el.append(when, body);
        }
        return el;
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
        const shownM = groupAgenda(mt).length;
        count.textContent = shownM ? `${shownM} event${shownM === 1 ? "" : "s"}` : "-";
        btn.append(h, g, count);
        btn.addEventListener("click", () => { calMonth = m; calSelDay = null; setView("month"); });
        wrap.appendChild(btn);
    }
}
let currentBundle = null;
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
    const open = activeSeason();
    const beds = app.logSnapshot.beds;
    const bedOf = (region) => {
        try {
            const hits = beds.filter((b) => intersectArea(parseRegion(b.region), region) > 0);
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
        const name = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
        const bedTail = bed ? ` - ${bed.name}` : "";
        const posTail = pos ? ` (${pos})` : "";
        return { idx, label: `${name}${bedTail}${posTail}`, species: p.species, group: p.cultivar_group ?? null, region, bed: bed?.name ?? "", pos };
    });
}
const SVG_NS = "http://www.w3.org/2000/svg";
function renderBedPicker(host, plants, selectedIdx, onPick) {
    const placed = plants.filter((p) => p.region);
    if (placed.length < 2)
        return null;
    const bedRegions = new Map();
    for (const b of app.logSnapshot.beds) {
        try {
            bedRegions.set(b.name, parseRegion(b.region));
        }
        catch { }
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
    const toSvg = (x, y) => [PAD + (x - minX) * scale, PAD + (maxY - y) * scale];
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
    svg.setAttribute("class", "calbedpick");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "pick a plant by where it sits in the bed");
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
let calFormOpener = null;
function closeFormFocus() {
    const b = calFormOpener;
    calFormOpener = null;
    if (b && b.isConnected) {
        b.setAttribute("aria-expanded", "false");
        b.focus();
    }
}
const logSlotId = () => calView === "week" ? "calwklog" : "callog";
function homeLogSlot() {
    const slot = document.getElementById(logSlotId());
    if (!slot)
        return;
    if (calView === "week")
        document.getElementById("calwktitle")?.after(slot);
    else
        document.getElementById("caltasks")?.before(slot);
}
function renderLogForm(bundle, prefill) {
    $("callog").replaceChildren();
    $("calwklog").replaceChildren();
    const slot = $(logSlotId());
    const db = app.logDb;
    if (!db)
        return;
    const seasonId = currentSeasonId();
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
        const fresh = prefill?.newPlanting ?? null;
        const f = document.createElement("div");
        f.className = "callogform";
        if (prefill?.title) {
            const ttl = document.createElement("p");
            ttl.className = "callogtitle";
            ttl.textContent = `Did it: ${prefill.title.split(" - ")[0].replace(/[.:]$/, "")}`;
            f.appendChild(ttl);
        }
        const kind = el("select");
        kind.setAttribute("aria-label", "what happened");
        for (const [v, label] of [["frost", "Frost"], ["heat", "Heat"], ["sowed", "Sowed"], ["transplanted", "Transplanted"],
            ["first_harvest", "First harvest"], ["last_harvest", "Last harvest"], ["ended", "It ended"], ["problem", "A problem"], ["note", "A note"]]) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = label;
            kind.appendChild(o);
        }
        const plant = el("select");
        plant.setAttribute("aria-label", "which plant");
        for (const { idx, label } of plants) {
            const o = document.createElement("option");
            o.value = String(idx);
            o.textContent = label;
            plant.appendChild(o);
        }
        const freshLine = el("p", "hint callognew");
        freshLine.hidden = !fresh;
        if (fresh)
            freshLine.textContent = fresh.setOut
                ? `Setting out started ${commonName(bundle, fresh.species)} plants in ${fresh.bed} - a new plant in your Log, at the spot the plan gives it.`
                : `Sowing ${commonName(bundle, fresh.species)} in ${fresh.bed} - a new plant in your Log, at the spot the plan gives it.`;
        const pick = el("div", "calpickwrap");
        const repaintPick = renderBedPicker(pick, plants, () => Number(plant.value), (idx) => { plant.value = String(idx); });
        plant.addEventListener("change", () => repaintPick?.());
        const sev = el("select");
        sev.setAttribute("aria-label", "severity");
        const what = el("input");
        what.type = "text";
        what.placeholder = "what (e.g. slugs)";
        what.setAttribute("aria-label", "what");
        const note = el("input");
        note.type = "text";
        note.placeholder = "note (optional)";
        note.setAttribute("aria-label", "note");
        const date = el("input");
        date.type = "date";
        date.setAttribute("aria-label", "date");
        date.value = calSelDay ?? (calView === "week" ? TODAY_ISO() : iso(calYear, calMonth, Math.min(new Date().getDate(), new Date(calYear, calMonth + 1, 0).getDate())));
        const err = el("p", "callogerr");
        const setOpts = (el, opts) => { el.replaceChildren(); for (const v of opts) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = v;
            el.appendChild(o);
        } };
        const sync = () => {
            const k = kind.value;
            const obs = k === "frost" || k === "heat";
            plant.hidden = obs || !!fresh;
            pick.hidden = obs || !repaintPick || !!fresh || prefill?.plantIdx != null;
            what.hidden = k !== "problem";
            note.hidden = !(obs || k === "note");
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
        const save = el("button", "callogbtn");
        save.type = "button";
        save.textContent = "Save";
        const cancel = el("button", "linky callogcancel");
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => { homeLogSlot(); renderLogForm(bundle); closeFormFocus(); });
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
                else if ((k === "sowed" || k === "transplanted") && fresh) {
                    await addPlanting(db, app.currentPlotId, seasonId, { species: fresh.species,
                        ...(fresh.group ? { cultivar_group: fresh.group } : {}), region: freshRegion(fresh),
                        ...(k === "transplanted" ? { transplanted: d } : { sown: d }) });
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
                const pp = plants.find((p) => p.idx === idx);
                const who = pp ? plantingLabel(bundle, pp.species, pp.group) : "";
                toast(k === "frost" ? frostNotedLine(d) : k === "heat" ? weatherNotedLine("Heat", d)
                    : plantEntryLine(k, who, d, k === "problem" ? what.value : ""));
                homeLogSlot();
                closeFormFocus();
                renderCalendar(bundle);
            }
            catch (e) {
                err.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        f.append(kind, pick, plant, freshLine, sev, what, note, date, save, cancel, err);
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
            if (prefill.noteText)
                note.value = prefill.noteText;
        }
        btn.replaceWith(f);
        if (prefill)
            date.focus();
    };
    btn.addEventListener("click", openForm);
    if (prefill)
        openForm();
}
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
        calSelBed = null;
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
            calSelDay = null;
            renderCalendar(currentBundle);
        });
        return b;
    };
    row.appendChild(chip("All beds", null));
    for (const bed of beds)
        row.appendChild(chip(bed, bed));
}
function openSeasonId(seasons) {
    const pool = seasons.filter((s) => !s.closed_date);
    const use = pool.length ? pool : seasons;
    return use.length ? Math.max(...use.map((s) => s.id)) : null;
}
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
    app.homeRefresh?.();
}
export function gardensDueSoon(bundle, todayIso, days = 7) {
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
    if (calOtherGardens === null)
        void loadOtherGardens();
    return gardensNow().map((g) => ({
        plotId: g.plotId,
        name: g.name,
        ...(() => { const j = weekJobs(weekTaskPool(bundle, [g], todayIso, false), todayIso, days); return { due: j.due, late: j.late.length - j.closed, closed: j.closed }; })(),
    }));
}
export function weekSummary(bundle, todayIso) {
    const j = weekJobs(weekTaskPool(bundle, [currentGardenCtx()], todayIso, !isSignedIn()), todayIso);
    return { due: j.due, late: j.late.length - j.closed, closed: j.closed };
}
function gardensNow() {
    const others = (calOtherGardens ?? []).filter((g) => g.plotId !== app.currentPlotId);
    return [currentGardenCtx(), ...others];
}
function resolveSelGarden(gardens) {
    if (calSelGarden === undefined)
        return defaultPlotId() ?? app.currentPlotId;
    if (calSelGarden === null)
        return null;
    return gardens.some((g) => g.plotId === calSelGarden) ? calSelGarden : app.currentPlotId;
}
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
            calSelBed = null;
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
    {
        const located = num("lat") != null && num("lon") != null;
        const nl = document.getElementById("calnoloc");
        if (nl)
            nl.hidden = located;
        const sl = document.getElementById("calsetloc");
        if (sl)
            sl.hidden = located;
    }
    {
        const wh = document.getElementById("calwindowhint");
        if (wh && !wh.firstChild) {
            wh.appendChild(document.createTextNode("New here? A planting "));
            wh.appendChild(glossTerm("window", "window"));
            wh.appendChild(document.createTextNode(" is the stretch of days a crop can still go in before your frost."));
        }
    }
    currentBundle = bundle;
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
    const gardens = gardensNow();
    const sel = resolveSelGarden(gardens);
    const chosen = sel === null ? gardens : gardens.filter((g) => g.plotId === sel);
    const everything = chosen.flatMap((g) => gardenTasksFor(bundle, calYear, g));
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        everything.push(...extra.filter((t) => typeof t.date === "string" && t.date.startsWith(String(calYear))));
    }
    renderGardenFilter(gardens, sel);
    renderBedFilter(everything, sel !== null);
    const all = filterByBed(everything);
    const today = TODAY_ISO();
    const weekPool = filterByBed(weekTaskPool(bundle, chosen, today, !isSignedIn()));
    if (!calViewChosen) {
        const j = weekJobs(weekPool, today);
        applyView(j.due || j.late.length ? "week" : "month");
    }
    if (calView === "week") {
        renderWeek(weekPool, bundle, today);
        renderLogForm(bundle);
    }
    else if (calView === "month") {
        renderMonthGrid(all);
        renderAgenda(all, bundle);
        renderLogForm(bundle);
    }
    else
        renderYearGrid(all);
    if (calOtherGardens === null)
        void loadOtherGardens();
    renderReminderState();
    if (remindersOn())
        void refreshReminders(buildReminderPlan());
}
function applyView(v) {
    calView = v;
    $("calv-week").setAttribute("aria-pressed", String(v === "week"));
    $("calv-month").setAttribute("aria-pressed", String(v === "month"));
    $("calv-year").setAttribute("aria-pressed", String(v === "year"));
    $("calweekview").hidden = v !== "week";
    $("calmonthview").hidden = v !== "month";
    $("calyearview").hidden = v !== "year";
}
function setView(v) {
    calViewChosen = true;
    applyView(v);
    if (currentBundle)
        renderCalendar(currentBundle);
}
function buildReminderPlan() {
    const list = filterByBed(gardenWideTasks(currentBundle, calYear));
    const now = new Date();
    return reminderPlan(list, (t) => taskSentence(t, currentBundle), iso(now.getFullYear(), now.getMonth(), now.getDate()));
}
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
export function initCalendar(bundle) {
    currentBundle = bundle;
    calYear = currentSeasonId() ?? new Date().getFullYear();
    calMonth = new Date().getMonth();
    $("calv-week").addEventListener("click", () => setView("week"));
    $("calv-month").addEventListener("click", () => setView("month"));
    $("calv-year").addEventListener("click", () => setView("year"));
    app.gardenFacts = () => {
        const b = currentBundle;
        if (!b)
            return null;
        const all = app.logSnapshot.beds;
        const plannable = all.filter((x) => !bedHasSections(x.name, all));
        if (!plannable.length)
            return null;
        const r = composePlot({ beds: plannable.map((x) => ({ name: x.name, region: x.region })) }, activeBundle(b));
        const n = plannable.length;
        const tier = n >= 2 || r.tier.key === "under_1" || r.tier.key === "one_guild"
            ? r.tier.copy.replace(/\bguilds\b/g, "plant teams").replace(/\bguild\b/g, "plant team") : null;
        return { head: n === 1 ? `1 bed · ${fmtArea(r.total_m2)}` : `${n} beds · ${fmtArea(r.total_m2)} together`, tier };
    };
    app.bedFacts = (bedName) => {
        const b = currentBundle;
        const empty = { plants: [], history: null, next: null, nextYear: null };
        const bed = app.logSnapshot.beds.find((x) => x.name === bedName);
        if (!b || !bed)
            return empty;
        const ab = activeBundle(b);
        const season = activeSeason();
        const counts = new Map();
        for (const pl of season?.plantings ?? []) {
            if (pl.end_cause || !plantingOnBed(pl.region, bed.region))
                continue;
            const label = plantingLabel(ab, pl.species, pl.cultivar_group ?? null);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        const plants = [...counts].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label));
        const prior = priorSeasons();
        let history = null;
        try {
            const d = mergePriorOccupancy(deriveHistory(bed.region, prior, ab), app.logSnapshot.priorOccupancy, bed.region);
            const years = Object.keys(d.history).sort().reverse().slice(0, 2);
            if (years.length) {
                const fams = (list) => list.map((f) => familyName(f)).join(", ");
                const grew = years.map((y) => `${fams(d.history[y])} (${y})`).join(" · ");
                const lat = num("lat"), lon = num("lon");
                const site = lat != null && lon != null ? matchSite(lat, lon, ab) : null;
                let hold = "";
                if (site) {
                    const year = currentSeasonId() ?? new Date().getFullYear();
                    const held = heldRotationFamilies({ ...site, verticillium_reservoir: d.verticillium_reservoir }, d.history, year, ab);
                    hold = held.size ? ` - so not ${fams([...held].sort())} again this year` : " - clear for anything this year";
                }
                history = `Grew here: ${grew}${hold}`;
            }
        }
        catch {
            history = null;
        }
        let next = null;
        const today = TODAY_ISO();
        const pool = weekTaskPool(b, [currentGardenCtx()], today, false, 366).filter((t) => t.bed === bedName);
        const j = weekJobs(pool, today, 366);
        const late = j.late.find((t) => !windowClosed(t, today));
        const up = j.days[0]?.tasks[0];
        if (late)
            next = { date: late.date, text: late.text ?? taskSentence(late, b), late: true, harvest: category(late) === "harvest" };
        else if (up)
            next = { date: up.date, text: up.text ?? taskSentence(up, b), late: false, harvest: category(up) === "harvest" };
        const draft = (season?.next_plan ?? []).find((e) => e.area === bedName && typeof e.guild === "string");
        const g = draft ? ab.guilds.find((x) => x.id === draft.guild) : undefined;
        const nextYear = draft && g ? { year: Number(draft.year), team: displayName(g) } : null;
        return { plants, history, next, nextYear };
    };
    app.openWeek = async (plotId, bed) => {
        if (plotId && plotId !== app.currentPlotId)
            await app.switchPlot?.(plotId);
        calSelGarden = app.currentPlotId;
        calSelBed = bed ?? null;
        calSelDay = null;
        calViewChosen = true;
        applyView("week");
        if (currentBundle)
            renderCalendar(currentBundle);
        location.hash = "#/calendar";
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => document.getElementById("calweekview")?.scrollIntoView({ behavior, block: "start" }), 80);
    };
    $("calprev").addEventListener("click", () => {
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        calSelDay = null;
        calViewChosen = true;
        renderCalendar(currentBundle);
    });
    $("calnext").addEventListener("click", () => {
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        calSelDay = null;
        calViewChosen = true;
        renderCalendar(currentBundle);
    });
    $("calyprev").addEventListener("click", () => { calYear--; renderCalendar(currentBundle); });
    $("calynext").addEventListener("click", () => { calYear++; renderCalendar(currentBundle); });
    $("calics").addEventListener("click", () => {
        const list = filterByBed(gardenWideTasks(currentBundle, calYear));
        if (!list.length)
            return;
        const slug = calSelBed ? calSelBed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
        void shareOrDownloadIcs(tasksToIcs(list, currentBundle, remindChoice()), `garden-${slug ? slug + "-" : ""}${calYear}.ics`);
    });
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
    const remindSel = $("calremind");
    remindSel.value = remindChoice();
    remindSel.addEventListener("change", () => setRemindChoice(remindSel.value));
}
