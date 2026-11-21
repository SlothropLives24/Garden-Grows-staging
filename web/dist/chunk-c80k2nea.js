import './chunk-ejg0q7q9.js';
import { frostWord, bedLocator, windowFreeze, seasonYearOf, plantingLabel, isSouthern, oneWarmWindow, tasksForYear, comingTasksForYear, owedFor, fmtMonthDay, plantingWindow, seasonDoy, mmddDoyOf } from './core.js';
import { frostPlace, ringDay } from './chunk-lxoyu69a.js';
import { climateProv, provFacts } from './chunk-pdnkwjb0.js';
import { calendarSowings } from './chunk-c66xn17y.js';
import { fillCopy, appLang } from './paint.js';

const asDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const daysApart = (aIso, bIso) => Math.round((asDate(bIso).getTime() - asDate(aIso).getTime()) / 86400000);
function gardenSowings(bundle, ctx, todayIso, fr) {
    const spOf = (id) => bundle.species.find((x) => x.id === id);
    const locate = bedLocator(ctx.beds);
    const freeze = windowFreeze(fr, ctx.lat, bundle);
    const windowOf = (p) => plantingWindow(p, spOf(p.species), freeze);
    const out = [];
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId) ?? null;
    for (const season of ctx.seasons) {
        for (const p of season.plantings ?? []) {
            const start = p.transplanted || p.sown;
            if (start && p.carried_over && seasonYearOf(start, ctx.lat) < season.id)
                continue;
            const w = start ? windowOf(p) : null;
            if (!start || !w || (p.end_date && p.end_date < w.opens))
                continue;
            out.push({ name: plantingLabel(bundle, p.species, p.cultivar_group ?? null), bed: (p.region ? locate(p.region) : null) ?? null,
                start, picks: w.opens, planned: start > todayIso });
        }
    }
    const yr = seasonYearOf(todayIso, ctx.lat);
    const years = isSouthern(ctx.lat) ? [yr, yr + 1, yr + 2] : [yr, yr + 1];
    const tasks = oneWarmWindow(years.flatMap((y) => [...tasksForYear(bundle, y, ctx), ...comingTasksForYear(bundle, y, ctx)]));
    const live = (open?.plantings ?? []).filter((p) => !p.end_date && !p.end_cause && !!(p.transplanted || p.sown));
    const owed = owedFor(tasks, todayIso);
    const yearOf = (iso) => seasonYearOf(iso, ctx.lat);
    const sown = new Set(out.filter((s) => !s.planned).map((s) => `${yearOf(s.start)}|${s.name}`));
    for (const y of years) {
        const here = live.filter((p) => { const at = (p.transplanted || p.sown), w = windowOf(p); return yearOf(at) === y || (!!w && yearOf(w.opens) === y); });
        const mine = calendarSowings({ todayIso, live: here,
            tasks: tasks.filter((t) => yearOf(t.date) === y), owed, bedOf: (p) => (p.region ? locate(p.region) : null) ?? null,
            nameOf: (sid, group) => plantingLabel(bundle, sid, group), windowOf });
        for (const s of mine) {
            if (!s.task || !s.window)
                continue;
            out.push({ name: sown.has(`${yearOf(s.start)}|${s.name}`) ? fillCopy("yrToSow", { crop: s.name }) : s.name, bed: s.bed, start: s.start, picks: s.window.opens, planned: true });
        }
    }
    return out;
}
function ringLines(sowings, lat, year) {
    const seen = new Set();
    const out = [];
    for (const s of sowings) {
        if (seasonYearOf(s.start, lat) !== year)
            continue;
        const k = `${s.name}|${s.start}|${s.picks}|${s.planned ? 1 : 0}`;
        const d0 = ringDay(s.start.slice(5), lat), days = daysApart(s.start, s.picks);
        if (seen.has(k) || d0 == null || !(days > 0))
            continue;
        seen.add(k);
        out.push({ name: s.name, sow: d0, end: d0 + days, filled: !s.planned, indoor: null, tint: null });
    }
    return out;
}
function plantCounts(sowings, lat, year) {
    const out = new Map();
    for (const s of sowings)
        if (!s.planned && seasonYearOf(s.start, lat) === year)
            out.set(s.name, (out.get(s.name) ?? 0) + 1);
    return out;
}
function stretchSpan(fromIso, toIso, lat) {
    const from = seasonDoy(mmddDoyOf(fromIso.slice(5)) ?? 1, lat);
    return { from, to: from + daysApart(fromIso, toIso) + 1 };
}
function stretchDay(iso, fromIso, lat) {
    return stretchSpan(fromIso, fromIso, lat).from + daysApart(fromIso, iso) + 0.5;
}
function stretchLines(sowings, lat, fromIso, toIso, bed = null) {
    const { from } = stretchSpan(fromIso, toIso, lat);
    const seen = new Set();
    const out = [];
    for (const s of sowings) {
        if (bed && s.bed !== bed)
            continue;
        if (s.start > toIso || s.picks < fromIso)
            continue;
        const k = `${s.name}|${s.start}|${s.picks}|${s.planned ? 1 : 0}`;
        const days = daysApart(s.start, s.picks);
        if (seen.has(k) || !(days > 0))
            continue;
        seen.add(k);
        const sow = from + daysApart(fromIso, s.start);
        out.push({ name: s.name, sow, end: sow + days, filled: !s.planned, indoor: null, tint: null });
    }
    return out;
}
function ringDays(isoDates, lat) {
    const out = new Set();
    for (const d of isoDates) {
        const r = ringDay(d.slice(5), lat);
        if (r != null)
            out.add(r);
    }
    return [...out].sort((a, b) => a - b);
}
function yearPlace(fr, plotId, lat) {
    const base = fr?.clim?.site;
    if (!fr?.clim || !base || lat == null)
        return null;
    const word = frostWord(base);
    if (word !== null && word !== "rare")
        return null;
    const given = { last: !!base.own_window?.last, first: !!base.own_window?.first };
    const site = { ...base };
    if (given.last)
        site.last_frost_32f = { p50: base.own_window.last };
    if (given.first) {
        site.first_freeze_32f = null;
        site.first_freeze_32f_p50 = base.own_window.first;
    }
    let place;
    try {
        place = frostPlace(site, site.key || plotId, lat);
    }
    catch {
        return null;
    }
    const dated = place.lf !== null || place.ff !== null;
    return { place, lat, given,
        season: { last: dated && !fr.springOwn ? site.last_frost_32f?.p50 ?? null : null, first: dated && !fr.fallOwn ? site.first_freeze_32f_p50 ?? null : null },
        source: climateProv(provFacts(fr.clim)) };
}
function lastYearDays(bundle, ctx, year) {
    const prior = year - 1;
    if (!ctx.seasons.some((s) => s.id === prior))
        return null;
    const years = isSouthern(ctx.lat) ? [prior, prior + 1] : [prior];
    return ringDays(years.flatMap((y) => tasksForYear(bundle, y, ctx)).filter((t) => t.kind === "logged" && t.of === prior).map((t) => t.date), ctx.lat);
}
function yearTwin(yp, sowings, lat, year) {
    const list = (xs) => new Intl.ListFormat(appLang(), { type: "conjunction" }).format(xs);
    const out = [];
    const last = yp?.season.last, first = yp?.season.first;
    const gl = !!yp?.given?.last, gf = !!yp?.given?.first;
    if (last && first && !gl && !gf)
        out.push(fillCopy("yrTwinFrost", { last: fmtMonthDay(last), first: fmtMonthDay(first) }));
    else {
        if (last)
            out.push(fillCopy(gl ? "yrTwinLastGiven" : "yrTwinLast", { last: fmtMonthDay(last) }));
        if (first)
            out.push(fillCopy(gf ? "yrTwinFirstGiven" : "yrTwinFirst", { first: fmtMonthDay(first) }));
    }
    const byName = new Map();
    for (const s of sowings)
        if (seasonYearOf(s.start, lat) === year)
            (byName.get(s.name) ?? byName.set(s.name, []).get(s.name)).push(s);
    for (const [name, ss] of byName) {
        const days = [...new Set(ss.map((s) => s.start))].sort();
        const pick = ss.map((s) => s.picks).sort()[0];
        out.push(fillCopy(ss.every((s) => s.planned) ? "yrTwinPlanned" : "yrTwinSown", { crop: name, dates: list(days.map((d) => fmtMonthDay(d))), pick: fmtMonthDay(pick) }));
    }
    return out.join(" ");
}

export { gardenSowings, lastYearDays, plantCounts, ringLines, stretchDay, stretchLines, stretchSpan, yearPlace, yearTwin };
