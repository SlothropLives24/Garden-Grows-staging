import './chunk-lutet8cz.js';
import { isMarker, owedFor, fmtMonthDay, category, jobTitle } from './core.js';
import { copy, fillCopy, appLang, midSentence } from './paint.js';

const DEFAULT_WEEKDAY = 6;
const MAX_LINES = 4;
const MAX_NAMES = 3;
const asDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const addDays = (iso, n) => {
    const d = asDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso) => asDate(iso).getUTCDay();
function* days(from, to) {
    for (let d = from; d <= to; d = addDays(d, 1))
        yield d;
}
function waterIn(tasks, from, to) {
    const order = ["R-175", "R-174", "R-173"];
    return tasks.filter((t) => t.kind === "water_marker" && t.date <= to && !!t.runEnd && from <= t.runEnd)
        .sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule));
}
function waterCare(now, listOf = listWords) {
    if (now.some((x) => x.rule === "R-175"))
        return { key: "hfCareWaterHot", text: copy.hfCareWaterHot };
    if (now.some((x) => x.rule === "R-174"))
        return { key: "hfCareWaterDry", text: copy.hfCareWaterDry };
    const beds = now.find((x) => x.rule === "R-173")?.beds ?? [];
    if (beds.length)
        return { key: "hfCareWaterRoofed", text: fillCopy(beds.length === 1 ? "hfCareWaterRoofedOne" : "hfCareWaterRoofedMany", { beds: listOf(beds) }) };
    return null;
}
function listWords(names) {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
}
function namesOf(names) {
    const uniq = [...new Set(names)];
    if (uniq.length <= MAX_NAMES)
        return listWords(uniq);
    return fillCopy("nwListMore", { list: uniq.slice(0, 2).join(", "), n: uniq.length - 2 });
}
const pluralKey = (base, n) => `${base}${n === 1 ? "One" : "Many"}`;
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const headsUpWords = (s) => s.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").trim();
const shortTitle = (sentence, t) => jobTitle(sentence, t).split(/, /)[0].trim();
function familyOf(t) {
    if (t.kind === "harvest_open" || category(t) === "harvest")
        return t.windowEnd ? "pickend" : "harvest";
    if (t.kind === "care" || t.kind === "install_support")
        return "tend";
    return category(t) === "sow" ? "sow" : "plant";
}
function whereOf(ts) {
    const beds = [...new Set(ts.map((t) => t.bed).filter((b) => !!b))];
    if (!beds.length)
        return "";
    return beds.length === 1 ? beds[0] : fillCopy(pluralKey("nwBeds", beds.length), { n: beds.length });
}
function jobLines(jobs, o) {
    const by = new Map();
    for (const t of jobs) {
        const f = familyOf(t);
        (by.get(f) ?? by.set(f, []).get(f)).push(t);
    }
    const out = [];
    for (const f of ["sow", "plant", "harvest", "pickend", "tend"]) {
        const ts = by.get(f);
        if (!ts?.length)
            continue;
        const where = whereOf(ts);
        if (f === "tend") {
            const titles = [...new Set(ts.map((t) => shortTitle(o.sentence(t), t)))];
            const list = titles.length <= MAX_NAMES ? listWords(titles.map((x, i) => (i ? lowerFirst(x) : x)))
                : fillCopy("nwListMore", { list: titles.slice(0, 2).map((x, i) => (i ? lowerFirst(x) : x)).join(", "), n: titles.length - 2 });
            out.push({ kind: "tend", text: where ? fillCopy("nwTendIn", { list: lowerFirst(list), where }) : list, jobs: ts.length });
            continue;
        }
        const names = ts.map((t) => (t.species ? midSentence(o.name(t.species)) : t.guildName ? midSentence(t.guildName) : lowerFirst(jobTitle(o.sentence(t), t))));
        const key = f === "sow" ? (where ? "nwSowIn" : "nwSow") : f === "plant" ? (where ? "nwPlantIn" : "nwPlant")
            : f === "pickend" ? (where ? "nwPickEndIn" : "nwPickEnd") : where ? "nwPickIn" : "nwPick";
        out.push({ kind: f, text: fillCopy(key, { list: namesOf(names), where }), jobs: ts.length });
    }
    return out;
}
function owedJobs(pool, today) {
    const owed = owedFor(pool, today);
    return pool.filter((t) => typeof t.date === "string" && !isMarker(t) && owed(t));
}
const announced = (t) => (t.opensOn ? { ...t, date: t.opensOn } : t);
const inWeek = (t, d, to) => t.opensOn && t.opensOn <= to && (t.closeBy ?? t.date) >= d ? { ...t, date: t.opensOn < d ? d : t.opensOn } : announced(t);
function lastCallDay(t) {
    if (!t.closeBy || t.kind === "succession" || t.kind === "care" || t.kind === "install_support")
        return null;
    if (t.kind === "warm_window" && t.warmNext == null)
        return null;
    const f = familyOf(t);
    if (f !== "sow" && f !== "plant")
        return null;
    const day = addDays(t.closeBy, -7);
    return day > t.date ? day : null;
}
function lastCallLine(ts, o) {
    const first = ts[0];
    const job = lowerFirst(shortTitle(o.sentence(first), first));
    return { kind: "lastcall", jobs: ts.length,
        text: ts.length === 1 ? fillCopy("nwLastCall", { job, date: fmtMonthDay(first.closeBy) })
            : fillCopy("nwLastCallMore", { job, date: fmtMonthDay(first.closeBy), n: ts.length - 1 }) };
}
function headsUpsByDay(pool, jobs, from, to, o) {
    const out = new Map();
    const add = (d, l) => { (out.get(d) ?? out.set(d, []).get(d)).push(l); };
    for (const t of pool) {
        if (!isMarker(t) || t.kind === "logged" || typeof t.date !== "string" || t.date < from || t.date > to)
            continue;
        const c = category(t);
        add(t.date, { kind: c === "frost" ? "frost" : c === "heat" ? "heat" : "water", text: headsUpWords(o.sentence(t)), jobs: 0 });
    }
    const calls = new Map();
    for (const t of jobs) {
        const d = lastCallDay(t);
        if (d && d >= from && d <= to)
            (calls.get(d) ?? calls.set(d, []).get(d)).push(t);
    }
    for (const [d, ts] of calls)
        add(d, lastCallLine(ts.sort((a, b) => a.closeBy.localeCompare(b.closeBy)), o));
    return out;
}
function capped(lines) {
    if (lines.length <= MAX_LINES)
        return { lines, more: 0 };
    return { lines: lines.slice(0, MAX_LINES), more: lines.slice(MAX_LINES).reduce((n, l) => n + Math.max(1, l.jobs), 0) };
}
function rangeLines(pool, jobs, from, to, o, water) {
    const wc = water ? waterCare(waterIn(pool, from, to)) : null;
    return [...(wc ? [{ kind: "water", text: wc.text, jobs: 0 }] : []),
        ...jobLines(jobs.filter((t) => t.date >= from && t.date <= to), o)];
}
function byGarden(pool) {
    const out = new Map();
    for (const t of pool) {
        const k = t.plotId ?? "";
        (out.get(k) ?? out.set(k, []).get(k)).push(t);
    }
    return out;
}
function notice(kind, plotId, garden, date, to, lines, source = "garden", slot = kind) {
    const c = capped(lines);
    const title = kind === "week" ? (garden ? fillCopy("nwWeekTitle", { garden }) : copy.nwWeekTitleAny)
        : kind === "day" ? (garden ? fillCopy("nwDayTitle", { garden }) : copy.nwDayTitleAny)
            : garden ? fillCopy("nwHeadsTitle", { garden }) : copy.nwHeadsTitleAny;
    return { id: `${source}|${plotId}|${slot}|${date}`, source, kind, plotId, garden, date, to, title, lines: c.lines, more: c.more };
}
function buildNotices(pool, o) {
    const out = [];
    for (const [plotId, ts] of byGarden(pool)) {
        const garden = ts.find((t) => t.garden)?.garden ?? "";
        const owed = owedJobs(ts, o.today);
        const jobs = owed.map(announced);
        const heads = headsUpsByDay(ts, jobs, o.from, o.to, o);
        for (const d of days(o.from, o.to)) {
            const fc = o.forecast?.(plotId, d) ?? [];
            const h = [...fc, ...(heads.get(d) ?? [])];
            const weekDay = weekdayOf(d) === o.weekday;
            let lines = [];
            let kind = "headsup", to = d;
            if (o.cadence === "weekly" && weekDay) {
                kind = "week";
                to = addDays(d, 6);
                lines = rangeLines(ts, owed.map((t) => inWeek(t, d, to)), d, to, o, true);
            }
            else if (o.cadence === "daily") {
                kind = "day";
                lines = rangeLines(ts, jobs, d, d, o, weekDay);
            }
            if (!lines.length && !h.length)
                continue;
            out.push(notice(lines.length ? kind : "headsup", plotId, garden, d, lines.length ? to : d, [...h, ...lines], fc.length ? "forecast" : "garden", kind));
        }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.plotId.localeCompare(b.plotId));
}
function weekGlance(pool, o) {
    const to = addDays(o.today, 6);
    const gardens = byGarden(pool);
    const all = [];
    for (const [, ts] of gardens) {
        const jobs = owedJobs(ts, o.today);
        const calls = jobs.filter((t) => { const d = lastCallDay(t); return !!d && d <= to && t.closeBy >= o.today; })
            .sort((a, b) => a.closeBy.localeCompare(b.closeBy));
        const lines = [...(calls.length ? [lastCallLine(calls, o)] : []),
            ...rangeLines(ts, jobs, o.today, to, { ...o, from: o.today, to, cadence: "weekly", weekday: DEFAULT_WEEKDAY }, true)];
        const name = ts.find((t) => t.garden)?.garden;
        all.push(...(gardens.size > 1 && name ? lines.map((l) => ({ ...l, text: fillCopy("nwInGarden", { garden: name, text: l.text }) })) : lines));
    }
    return capped(all);
}
function noticeBody(n) {
    return [...n.lines.map((l) => l.text), ...(n.more ? [fillCopy(pluralKey("nwMore", n.more), { n: n.more })] : [])].join("\n");
}
function icsAlarms(list, notices) {
    const out = new Map();
    const rung = new Set();
    for (const n of notices) {
        const idx = list.findIndex((t, i) => !out.has(i) && typeof t.date === "string" && t.date >= n.date && t.date <= n.to
            && (t.plotId ?? "") === n.plotId && (n.kind === "headsup" ? isMarker(t) && t.date === n.date : !isMarker(t) && t.kind !== "logged"));
        if (idx < 0)
            continue;
        const day = `${n.plotId}|${list[idx].date}`;
        if (rung.has(day))
            continue;
        rung.add(day);
        out.set(idx, `${n.title}: ${noticeBody(n).replace(/\n/g, "; ")}`);
    }
    return out;
}
function reminderPlan(notices, todayISO) {
    return notices.filter((n) => n.date >= todayISO)
        .map((n) => ({ key: n.id, date: n.date, title: n.title, body: noticeBody(n), garden: n.plotId }));
}
function phonePlan(pool, o) {
    const to = `${Number(o.today.slice(0, 4)) + 1}-12-31`;
    return reminderPlan(buildNotices(pool, { ...o, from: o.today, to }), o.today);
}
function bellList(pool, o, read) {
    const from = addDays(o.today, -29), freshFrom = addDays(o.today, -6);
    const shownId = (n) => `${n.source}|${n.plotId}|${n.kind}|${n.date}`;
    const items = buildNotices(pool, { ...o, from, to: o.today }).reverse()
        .map((notice) => ({ notice, read: notice.id in read || shownId(notice) in read, fresh: notice.date >= freshFrom }));
    return { items, unread: items.filter((x) => x.fresh && !x.read).length };
}
const bellBadge = (unread) => (unread <= 0 ? "" : unread > 9 ? "9+" : String(unread));
function keptMarks(read, today) {
    const from = addDays(today, -29);
    return Object.fromEntries(Object.entries(read).filter(([, d]) => typeof d === "string" && d >= from));
}

export { addDays, bellBadge, bellList, buildNotices, icsAlarms, keptMarks, noticeBody, phonePlan, waterCare, weekGlance };
