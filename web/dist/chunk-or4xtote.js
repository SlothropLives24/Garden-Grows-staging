import './chunk-lutet8cz.js';
import { copy, fillCopy, appLang, familyName, familyInProse } from './paint.js';
import { MIN_SEASONS, plural, app, bedHasSections, activeBundle, fmtArea, openSeason, plantingOnBed, plantingLabel, priorSeasons, mergePriorOccupancy, deriveHistory, num, matchSite, seasonId, heldRotationFamilies, TODAY_ISO, taskPool, gardenTasksShared, currentGardenCtx, seasonYearOf, isDone, monthDay, commonName, weekJobs, windowClosed, stillTime, category, jobTitle, taskSentence, displayName, undatedPlan, floorLines, floorPlan, warmLateLines, unfitPlan, calFactsBundle } from './core.js';
import { composePlot, tierWords } from './chunk-iac2um9b.js';

const listOf = (names) => {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
};
const KEY = { nolimit: "clUndatedNoLimit", norun: "clUndatedNoRun" };
function undatedLines(u) {
    if (u.place === "held")
        return [copy.anWarmHeld];
    if (u.place === "nosite")
        return [fillCopy("clUncovered", { n: MIN_SEASONS })];
    const out = [];
    for (const why of ["nolimit", "norun"]) {
        const names = [...new Set(u.crops.filter((c) => c.why === why).map((c) => c.label))];
        if (names.length)
            out.push(plural(KEY[why], names.length, { crops: listOf(names) }));
    }
    return out;
}

function installFacts() {
    app.gardenFacts = () => {
        const b = calFactsBundle();
        if (!b)
            return null;
        const all = app.logSnapshot.beds;
        const plannable = all.filter((x) => !bedHasSections(x.name, all));
        if (!plannable.length)
            return null;
        const r = composePlot({ beds: plannable.map((x) => ({ name: x.name, region: x.region })) }, activeBundle(b));
        const n = plannable.length;
        const tier = n >= 2 || r.tier.key === "under_1" || r.tier.key === "one_guild"
            ? tierWords(r.tier.key) : null;
        return { head: plural("clFacts", n, { area: fmtArea(r.total_m2) }), tier };
    };
    app.bedFacts = (bedName) => {
        const b = calFactsBundle();
        const empty = { plants: [], history: null, next: null, nextYear: null, autumn: null, undated: null, closed: false, cool: [], unfit: null };
        const bed = app.logSnapshot.beds.find((x) => x.name === bedName);
        if (!b || !bed)
            return empty;
        const ab = activeBundle(b);
        const season = openSeason();
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
                history = fillCopy("clGrewHere", { grew });
                if (site) {
                    const year = seasonId() ?? new Date().getFullYear();
                    const held = heldRotationFamilies({ ...site, verticillium_reservoir: d.verticillium_reservoir }, d.history, year, ab);
                    const shown = new Set(years.flatMap((y) => d.history[y]));
                    history = !held.size ? fillCopy("clGrewHereClear", { grew })
                        : [...shown].every((f) => held.has(f)) ? fillCopy("clGrewHereHeldAll", { grew })
                            : fillCopy("clGrewHereHeld", { grew, families: [...held].sort().map(familyInProse).join(", ") });
                }
            }
        }
        catch {
            history = null;
        }
        let next = null;
        const today = TODAY_ISO();
        const kept = app.bedPlantWindow?.(bedName)?.status === "passed";
        const whole = taskPool(b, [currentGardenCtx()], today, false, 366, gardenTasksShared);
        const pool = whole.filter((t) => t.bed === bedName && (!kept || seasonYearOf(t.date, num("lat")) > (seasonId() ?? 0)));
        let autumn = null;
        if (kept) {
            const thisYear = seasonId() ?? Number(today.slice(0, 4));
            const resow = whole.filter((t) => t.bed === bedName && t.kind === "autumn" && (t.rule === "R-032" || t.rule === "R-188") && !!t.closeBy && !!t.species
                && today <= t.closeBy && seasonYearOf(t.date, num("lat")) === thisYear && !isDone(t, whole))
                .sort((x, y) => x.closeBy.localeCompare(y.closeBy))[0];
            if (resow) {
                autumn = fillCopy("clAutumnKept", { crop: commonName(ab, resow.species), date: monthDay(resow.closeBy.slice(5)) });
            }
        }
        const j = weekJobs(pool, today, 366);
        const late = j.late.find((t) => !windowClosed(t, today));
        const up = j.days[0]?.tasks[0];
        if (late)
            next = { date: late.date, text: jobTitle(taskSentence(late, b), late), late: !stillTime(late, today), harvest: category(late) === "harvest",
                ...(stillTime(late, today) ? { until: late.closeBy ?? "" } : {}) };
        else if (up)
            next = { date: up.date, text: jobTitle(taskSentence(up, b), up), late: false, harvest: category(up) === "harvest" };
        const draft = (season?.next_plan ?? []).find((e) => e.area === bedName && typeof e.guild === "string");
        const g = draft ? ab.guilds.find((x) => x.id === draft.guild) : undefined;
        const nextYear = draft && g ? { year: Number(draft.year), team: displayName(g) } : null;
        const u = undatedPlan(ab, currentGardenCtx());
        const crops = u.crops.filter((c) => c.bed === bedName).map(({ species, group, label, why }) => ({ species, group, label, why }));
        const planned = u.beds.includes(bedName);
        const undated = planned && (u.place || crops.length) ? { place: u.place, crops } : null;
        const closed = planned && !kept && !next && !undated && j.late.length > 0 && j.late.every((t) => windowClosed(t, today));
        const cool = [...floorLines(floorPlan(ab, currentGardenCtx()).filter((c) => c.bed === bedName)), ...warmLateLines(pool, bedName, today, ab)];
        const unfit = unfitPlan(ab, currentGardenCtx()).find((x) => x.bed === bedName) ?? null;
        return { plants, history, next, nextYear, autumn, undated, closed, cool, unfit };
    };
}
if (!app.gardenFacts || !app.bedFacts)
    installFacts();

export { undatedLines };
