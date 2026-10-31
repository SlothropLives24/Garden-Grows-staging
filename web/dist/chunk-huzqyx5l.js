import './chunk-lutet8cz.js';
import { copy, fillCopy, midSentence, appLang } from './paint.js';
import { northernMonth, tropical, monthLong, comingSeasonAfter, fallDate, seasonAfter, commonName, fmtMonthDay, fmtCmValue, seasonYearOf, isSouthern, monthShort, seasonDate } from './core.js';

const asDate$1 = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const isoAdd$1 = (iso, days) => {
    const d = asDate$1(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
const daysApart$1 = (aIso, bIso) => Math.round((asDate$1(bIso).getTime() - asDate$1(aIso).getTime()) / 86400000);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SEASON_WORD = [
    "hnSeasonMidWinter", "hnSeasonLateWinter", "hnSeasonEarlySpring", "hnSeasonMidSpring", "hnSeasonLateSpring",
    "hnSeasonEarlySummer", "hnSeasonHighSummer", "hnSeasonLateSummer", "hnSeasonEarlyAutumn", "hnSeasonMidAutumn",
    "hnSeasonLateAutumn", "hnSeasonEarlyWinter",
];
const SKIN_WORD = { spring: "hnSeasonSpring", summer: "hnSeasonSummer", autumn: "hnSeasonAutumn", winter: "hnSeasonWinter" };
const SKIN_OF_MONTH = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
function seasonWord(todayIso, lat, skin) {
    const m = northernMonth(Number(todayIso.slice(5, 7)), lat);
    if (skin && SKIN_WORD[skin] && skin !== SKIN_OF_MONTH[m - 1])
        return copy[SKIN_WORD[skin]];
    if (tropical(lat))
        return monthLong(Number(todayIso.slice(5, 7)) - 1);
    return copy[SEASON_WORD[m - 1]];
}
function cropWindows(plantings, todayIso, windowOf, bedOf, nameOf, horizonDays = 42) {
    const live = plantings.filter((p) => !p.end_date && !p.end_cause);
    const beds = new Map();
    for (const p of live) {
        const b = bedOf(p);
        if (b)
            (beds.get(p.species) ?? beds.set(p.species, new Set()).get(p.species)).add(b);
    }
    const multiBed = new Set([...beds].filter(([, s]) => s.size > 1).map(([sp]) => sp));
    const ready = new Map();
    const soon = new Map();
    const past = new Map();
    const undated = new Map();
    const approx = new Map();
    const dated = new Set();
    const later = new Set();
    const horizon = isoAdd$1(todayIso, horizonDays);
    for (const p of live) {
        const win = windowOf(p);
        if (!win) {
            if (p.sown || p.transplanted)
                undated.set(p.species, nameOf(p));
            continue;
        }
        dated.add(p.species);
        if (win.approx && !approx.has(p.species))
            approx.set(p.species, nameOf(p));
        const w = { species: p.species, name: nameOf(p), bed: bedOf(p), opens: win.opens, closes: win.closes };
        if (w.opens <= todayIso && todayIso <= w.closes) {
            const k = `${w.species}|${w.bed ?? ""}`;
            const cur = ready.get(k);
            if (!cur || w.closes < cur.closes)
                ready.set(k, w);
        }
        else if (w.opens > todayIso) {
            later.add(w.species);
            if (w.opens <= horizon) {
                const cur = soon.get(w.species);
                if (!cur || w.opens < cur.opens)
                    soon.set(w.species, w);
            }
        }
        else {
            const cur = past.get(w.species);
            if (!cur || w.closes > cur.closes)
                past.set(w.species, w);
        }
    }
    const readySp = new Set([...ready.values()].map((w) => w.species));
    return {
        past: [...past.values()].filter((w) => !readySp.has(w.species) && !later.has(w.species))
            .sort((a, b) => b.closes.localeCompare(a.closes) || a.species.localeCompare(b.species)),
        undated: [...undated].filter(([sp]) => !dated.has(sp)).map(([species, name]) => ({ species, name })),
        ready: [...ready.values()].sort((a, b) => a.closes.localeCompare(b.closes) || a.opens.localeCompare(b.opens) || a.species.localeCompare(b.species)),
        soon: [...soon.values()].filter((w) => !readySp.has(w.species)).sort((a, b) => a.opens.localeCompare(b.opens) || a.species.localeCompare(b.species)),
        multiBed,
        approx,
    };
}
function readyChips(ready, max = 5) {
    const bySp = new Map();
    for (const w of ready)
        (bySp.get(w.species) ?? bySp.set(w.species, []).get(w.species)).push(w);
    const all = [];
    for (const [species, ws] of bySp) {
        const beds = [...new Set(ws.map((w) => w.bed).filter((b) => !!b))];
        if (beds.length > 1)
            for (const b of beds)
                all.push({ species, name: ws[0].name, bed: b });
        else
            all.push({ species, name: ws[0].name, bed: null });
    }
    return { chips: all.slice(0, Math.max(0, max)), more: Math.max(0, all.length - max) };
}
function logPhotos(seasons, todayIso) {
    const out = [];
    for (const s of seasons) {
        (s.plantings ?? []).forEach((p, i) => {
            for (const n of p.notes ?? []) {
                if (!n.photo || !ISO.test(n.date) || n.date > todayIso)
                    continue;
                out.push({ seasonId: s.id, name: n.photo, date: n.date, text: n.text ?? "", species: p.species, plantingIndex: i });
            }
        });
    }
    return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.seasonId - a.seasonId));
}
function offSeasonOf(inp) {
    if (!inp.seasons.length)
        return null;
    const open = inp.openId == null ? null : inp.seasons.find((s) => s.id === inp.openId && !s.closed_date) ?? null;
    if (!open) {
        const last = Math.max(...inp.seasons.map((s) => s.id));
        return { last, next: comingSeasonAfter(last, inp.todayIso, inp.lat, inp.freezeMmdd) };
    }
    if (inp.live > 0 || !inp.freezeMmdd)
        return null;
    const freeze = fallDate(inp.freezeMmdd, open.id, inp.lat);
    return freeze && freeze < inp.todayIso
        ? { last: open.id, next: seasonAfter(open.id, inp.seasons, inp.todayIso, inp.lat, inp.freezeMmdd) } : null;
}
function listOf(names) {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
}
function whenAhead(todayIso, dateIso) {
    const d = daysApart$1(todayIso, dateIso);
    if (d <= 4)
        return copy.hnWhenDays;
    if (d <= 10)
        return copy.hnWhenWeek;
    return fillCopy("hnWhenWeeks", { n: Math.round(d / 7) });
}
const MAX_LINES = 3;
const CLOSING_DAYS = 10;
function listLine(kind, crops) {
    const [one, list, more] = kind === "past" ? ["hnPastOne", "hnPast", "hnPastMore"] : ["hnUndatedOne", "hnUndated", "hnUndatedMore"];
    const names = crops.map((c) => midSentence(c.name));
    const fact = { kind, species: crops.map((c) => c.species) };
    if (names.length === 1)
        return { key: one, text: fillCopy(one, { crop: names[0] }), fact };
    return names.length <= 3
        ? { key: list, text: fillCopy(list, { list: listOf(names) }), fact }
        : { key: more, text: fillCopy(more, { list: names.slice(0, 2).join(", "), n: names.length - 2 }), fact };
}
const GROWING_CARE = [
    { rule: "R-134", key: "hfCareNoPick", firstSeason: true,
        line: (n) => fillCopy("hfCareNoPick", { name: n }) },
    { rule: "R-135", key: "hfCarePinchBlossoms", firstSeason: true,
        line: (n) => fillCopy("hfCarePinchBlossoms", { name: n }) },
    { rule: "R-126", key: "hfCarePinchTips", line: (n) => fillCopy("hfCarePinchTips", { name: n }) },
    { rule: "R-119", key: "hfCareHill", until: "first_harvest",
        line: (n) => fillCopy("hfCareHill", { name: n, height: fmtCmValue([20, 30]) }) },
];
function growingCare(bundle, plantings, year, todayIso, windowOf) {
    const out = [];
    const planted = (p) => p.transplanted || p.sown;
    const harvestPast = (p) => {
        if (p.first_harvest)
            return true;
        const closes = todayIso && windowOf ? windowOf(p)?.closes ?? null : null;
        return !!closes && closes < todayIso;
    };
    for (const c of GROWING_CARE) {
        const r = (bundle.rules ?? []).find((x) => x.id === c.rule);
        const crops = new Set([r?.applies_to?.species ?? []].flat());
        const live = plantings.find((p) => crops.has(p.species) && planted(p) && !p.end_date && !(c.until && harvestPast(p))
            && (!c.firstSeason || Number(planted(p).slice(0, 4)) === year));
        if (live)
            out.push({ key: c.key, text: c.line(commonName(bundle, live.species).replace(/^./, (ch) => ch.toUpperCase())) });
    }
    return out.slice(0, 2);
}
function splitPlanned(species, jobs) {
    const now = [], later = [], undated = [];
    for (const sid of species) {
        const js = jobs(sid);
        (js.length === 0 ? undated : js.some(Boolean) ? now : later).push(sid);
    }
    return { now, later, undated };
}
function gardenNote(inp) {
    const t = inp.todayIso;
    const w = inp.windows;
    const out = [];
    if (!inp.hasBeds)
        return out;
    if (inp.off)
        return offNote(inp, inp.off);
    const readySpecies = [...new Set(w.ready.map((r) => r.species))];
    const nameOf = (sp) => midSentence(w.ready.find((r) => r.species === sp)?.name ?? sp);
    if (readySpecies.length === 1) {
        const sp = readySpecies[0];
        const inBeds = w.ready.filter((r) => r.species === sp);
        const bed = w.multiBed.has(sp) && inBeds.length === 1 ? inBeds[0].bed : null;
        out.push(bed
            ? { key: "hnReadyBed", text: fillCopy("hnReadyBed", { crop: nameOf(sp), bed }), fact: { kind: "ready-bed", species: sp, bed } }
            : { key: "hnReadyOne", text: fillCopy("hnReadyOne", { crop: nameOf(sp) }), fact: { kind: "ready", species: [sp] } });
    }
    else if (readySpecies.length === 2 || readySpecies.length === 3) {
        out.push({ key: "hnReadyList", text: fillCopy("hnReadyList", { list: listOf(readySpecies.map(nameOf)) }), fact: { kind: "ready", species: readySpecies } });
    }
    else if (readySpecies.length > 3) {
        const shown = readySpecies.slice(0, 2);
        out.push({ key: "hnReadyMore", text: fillCopy("hnReadyMore", { list: shown.map(nameOf).join(", "), n: readySpecies.length - 2 }),
            fact: { kind: "ready", species: readySpecies } });
    }
    else if (inp.live > 0 && w.past.length) {
        out.push(listLine("past", w.past));
    }
    else if (inp.live > 0 && w.soon.length) {
        const s = w.soon[0];
        out.push({ key: "hnSoonFirst", text: fillCopy("hnSoonFirst", { crop: midSentence(s.name), when: whenAhead(t, s.opens) }),
            fact: { kind: "soon", species: s.species, opens: s.opens, first: true } });
    }
    else if (inp.live > 0 && w.undated.length) {
        out.push(listLine("undated", w.undated));
    }
    else if (inp.live > 0) {
        out.push({ key: "hnGrowing", text: copy.hnGrowing, fact: { kind: "growing", live: inp.live } });
    }
    else if (inp.planned.length) {
        const crops = inp.planned.slice(0, inp.planned.length > 3 ? 2 : 3);
        const more = inp.planned.length - crops.length;
        out.push(more
            ? { key: "hnPlannedMore", text: fillCopy("hnPlannedMore", { list: crops.map(midSentence).join(", "), n: more }), fact: { kind: "planned", crops: inp.planned } }
            : { key: "hnPlannedOnly", text: fillCopy("hnPlannedOnly", { list: listOf(crops.map(midSentence)) }), fact: { kind: "planned", crops } });
    }
    else if (inp.plannedLater?.length) {
        const crops = inp.plannedLater.slice(0, inp.plannedLater.length > 3 ? 2 : 3);
        const more = inp.plannedLater.length - crops.length;
        out.push(more
            ? { key: "hnPlannedLaterMore", text: fillCopy("hnPlannedLaterMore", { list: crops.map(midSentence).join(", "), n: more }), fact: { kind: "planned-later", crops: inp.plannedLater } }
            : { key: "hnPlannedLater", text: fillCopy("hnPlannedLater", { list: listOf(crops.map(midSentence)) }), fact: { kind: "planned-later", crops } });
    }
    else if (inp.sowable.length) {
        const crops = inp.sowable.slice(0, inp.inSeason ? 5 : 3);
        out.push(inp.inSeason
            ? { key: "hnInSeason", text: fillCopy("hnInSeason", { list: listOf(crops.map(midSentence)) }), fact: { kind: "empty-sow", crops } }
            : { key: "hnEmptySow", text: fillCopy("hnEmptySow", { list: listOf(crops.map(midSentence)) }), fact: { kind: "empty-sow", crops } });
    }
    else {
        out.push({ key: "hnEmptyPlan", text: copy.hnEmptyPlan, fact: { kind: "empty", beds: true } });
    }
    const tail = [];
    if (inp.live > 0)
        for (const c of inp.care.slice(0, 2))
            tail.push({ key: c.key, text: c.text, fact: { kind: "care", key: c.key } });
    const lead = out[0]?.key;
    if (inp.live > 0 && w.undated.length && !/^hnUndated/.test(lead ?? ""))
        tail.push(listLine("undated", w.undated));
    if ((readySpecies.length || (inp.live > 0 && (w.past.length || w.undated.length))) && w.soon.length) {
        const s = w.soon[0];
        tail.push({ key: "hnSoonAfter", text: fillCopy("hnSoonAfter", { crop: midSentence(s.name), when: whenAhead(t, s.opens) }),
            fact: { kind: "soon", species: s.species, opens: s.opens, first: false } });
    }
    else if (inp.next && inp.next.date > t && inp.live + inp.sowable.length + inp.planned.length > 0) {
        const team = !!inp.next.team;
        tail.push({ key: team ? "hnNextTeam" : "hnNextSow",
            text: fillCopy(team ? "hnNextTeam" : "hnNextSow", { crop: team ? inp.next.crop : midSentence(inp.next.crop), date: fmtMonthDay(inp.next.date) }),
            fact: { kind: "next", what: inp.next.crop, date: inp.next.date } });
    }
    const closing = w.ready.find((r) => daysApart$1(t, r.closes) <= CLOSING_DAYS);
    if (closing) {
        tail.push({ key: "hnCloses", text: fillCopy("hnCloses", { crop: midSentence(closing.name), date: fmtMonthDay(closing.closes) }),
            fact: { kind: "closes", species: closing.species, closes: closing.closes } });
    }
    else if (w.ready.length) {
        const r = w.ready[0];
        tail.push({ key: "hnWindowUntil", text: fillCopy("hnWindowUntil", { crop: midSentence(r.name), date: fmtMonthDay(r.closes) }),
            fact: { kind: "closes", species: r.species, closes: r.closes } });
    }
    return approxSaid([...out, ...tail].slice(0, MAX_LINES), w.approx);
}
function approxSaid(lines, approx) {
    if (!approx.size)
        return lines;
    const named = (f) => {
        const sp = f.species;
        return Array.isArray(sp) ? sp.map(String) : typeof sp === "string" ? [sp] : [];
    };
    const i = lines.findIndex((l) => named(l.fact).some((sp) => approx.has(sp)));
    if (i < 0)
        return lines;
    const sp = named(lines[i].fact).find((x) => approx.has(x));
    return lines.map((l, j) => (j === i ? { ...l, text: `${l.text} ${fillCopy("hnApprox", { crop: midSentence(approx.get(sp)) })}` } : l));
}
function offNote(inp, off) {
    const out = [];
    const grew = off.grew.map(midSentence);
    if (!grew.length)
        out.push({ key: "hnOffRest", text: fillCopy("hnOffRest", { year: off.last }), fact: { kind: "off-grew", year: off.last, crops: [] } });
    else if (grew.length <= 3)
        out.push({ key: "hnOffGrew", text: fillCopy("hnOffGrew", { year: off.last, list: listOf(grew) }), fact: { kind: "off-grew", year: off.last, crops: off.grew } });
    else
        out.push({ key: "hnOffGrewMore", text: fillCopy("hnOffGrewMore", { year: off.last, list: grew.slice(0, 2).join(", "), n: grew.length - 2 }),
            fact: { kind: "off-grew", year: off.last, crops: off.grew } });
    if (!off.plan.length)
        out.push({ key: "hnOffNoPlan", text: fillCopy("hnOffNoPlan", { next: off.next }), fact: { kind: "off-plan", year: off.next, items: [] } });
    else if (off.plan.length <= 3)
        out.push({ key: "hnOffPlan", text: fillCopy("hnOffPlan", { next: off.next, list: listOf(off.plan) }), fact: { kind: "off-plan", year: off.next, items: off.plan } });
    else
        out.push({ key: "hnOffPlanMore", text: fillCopy("hnOffPlanMore", { next: off.next, list: off.plan.slice(0, 2).join(", "), n: off.plan.length - 2 }),
            fact: { kind: "off-plan", year: off.next, items: off.plan } });
    if (off.plan.length && inp.next && inp.next.date > inp.todayIso) {
        const team = !!inp.next.team;
        out.push({ key: team ? "hnNextTeam" : "hnNextSow",
            text: fillCopy(team ? "hnNextTeam" : "hnNextSow", { crop: team ? inp.next.crop : midSentence(inp.next.crop), date: fmtMonthDay(inp.next.date) }),
            fact: { kind: "next", what: inp.next.crop, date: inp.next.date } });
    }
    return out.slice(0, MAX_LINES);
}
function leadCrop(w, live) {
    return w.ready[0]?.species ?? w.soon[0]?.species ?? live[0]?.species ?? null;
}

const asDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const isoAdd = (iso, days) => {
    const d = asDate(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
const daysApart = (aIso, bIso) => Math.round((asDate(bIso).getTime() - asDate(aIso).getTime()) / 86400000);
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso) => {
    const d = asDate(monthStart(iso));
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
};
const minIso = (xs) => xs.reduce((a, b) => (b < a ? b : a));
const maxIso = (xs) => xs.reduce((a, b) => (b > a ? b : a));
function calendarSowings(inp) {
    const out = [];
    const inGround = new Set();
    for (const p of inp.live) {
        const bed = inp.bedOf(p);
        const start = p.transplanted || p.sown;
        if (!start)
            continue;
        const ahead = start > inp.todayIso;
        if (!ahead)
            inGround.add(`${p.species}|${bed ?? ""}`);
        out.push({ species: p.species, name: inp.nameOf(p.species, p.cultivar_group ?? null), bed, start, window: inp.windowOf(p), planned: ahead });
    }
    for (const x of inp.tasks) {
        if (!x.bed || !x.species)
            continue;
        const name = inp.nameOf(x.species, null);
        if (x.kind === "harvest_open" && x.dtmRange && !x.windowEnd) {
            if (inGround.has(`${x.species}|${x.bed}`))
                continue;
            out.push({ species: x.species, name, bed: x.bed, start: isoAdd(x.date, -x.dtmRange[0]),
                window: { opens: x.date, closes: x.windowCloses ?? isoAdd(x.date, x.dtmRange[1] - x.dtmRange[0]) }, planned: true });
        }
        else if ((x.kind === "succession" || x.kind === "autumn") && x.date > inp.todayIso && inp.owed(x)) {
            out.push({ species: x.species, name, bed: x.bed, start: x.date, window: inp.windowOf({ species: x.species, sown: x.date }), planned: true });
        }
    }
    return out;
}
function matters(s, from, to) {
    if (s.planned)
        return s.start >= from && s.start <= to;
    return !s.window || s.window.closes >= from;
}
function merged(segs) {
    const out = [];
    for (const sg of [...segs].sort((a, b) => a.from - b.from)) {
        const same = out.filter((o) => o.kind === sg.kind && o.planned === sg.planned && o.past === sg.past).at(-1);
        if (same && sg.from <= same.to)
            same.to = Math.max(same.to, sg.to);
        else
            out.push({ ...sg });
    }
    return out.sort((a, b) => a.from - b.from || (a.kind === "grow" ? -1 : 1));
}
function noteFor(sowings, today) {
    const inGround = sowings.filter((s) => !s.planned);
    if (inGround.some((s) => s.window && s.window.opens <= today && today <= s.window.closes))
        return { key: "hcPickingNow", text: copy.hcPickingNow };
    const nextOpen = inGround.map((s) => s.window?.opens).filter((d) => !!d && d > today).sort()[0];
    if (nextOpen) {
        const d = daysApart(today, nextOpen);
        return d <= 10 ? { key: "hcWeekTo", text: copy.hcWeekTo }
            : { key: "hcWeeksTo", text: fillCopy("hcWeeksTo", { n: Math.round(d / 7) }) };
    }
    const nextSow = sowings.filter((s) => s.planned && s.start >= today).map((s) => s.start).sort()[0];
    if (nextSow) {
        const d = daysApart(today, nextSow);
        return d <= 7 ? { key: "hcSowThisWeek", text: copy.hcSowThisWeek }
            : d <= 10 ? { key: "hcSowWeek", text: copy.hcSowWeek }
                : { key: "hcSowIn", text: fillCopy("hcSowIn", { n: Math.round(d / 7) }) };
    }
    if (sowings.some((s) => s.planned))
        return { key: "hcSowNow", text: copy.hcSowNow };
    if (inGround.some((s) => s.window))
        return { key: "hcWindowOver", text: copy.hcWindowOver };
    return { key: "hcGrowing", text: copy.hcGrowing };
}
function offNoteFor(sowings, today) {
    const next = sowings.filter((s) => !s.past).map((s) => s.start).sort()[0];
    if (!next)
        return { key: "hcLastSeason", text: copy.hcLastSeason };
    if (next < today)
        return { key: "hcSowNow", text: copy.hcSowNow };
    const d = daysApart(today, next);
    return d <= 7 ? { key: "hcSowThisWeek", text: copy.hcSowThisWeek }
        : d <= 10 ? { key: "hcSowWeek", text: copy.hcSowWeek }
            : d <= 70 ? { key: "hcSowIn", text: fillCopy("hcSowIn", { n: Math.round(d / 7) }) }
                : { key: "hcNextFrom", text: fillCopy("hcNextFrom", { month: monthLong(Number(next.slice(5, 7)) - 1) }) };
}
const shiftYears = (iso, years) => {
    if (!years)
        return iso;
    const y = Number(iso.slice(0, 4)) + years;
    const md = iso.slice(5) === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? "02-28" : iso.slice(5);
    return `${y}-${md}`;
};
function chartModel(inp) {
    const t = inp.todayIso;
    const off = inp.off ?? null;
    const yr = seasonYearOf(t, inp.lat);
    const from0 = monthStart(t), to0 = monthEnd(isoAdd(monthEnd(t), 1));
    const byRow = new Map();
    for (const s of inp.sowings) {
        const k = `${s.species}|${s.bed ?? ""}`;
        (byRow.get(k) ?? byRow.set(k, []).get(k)).push(s);
    }
    const kept = [...byRow.values()].filter((ss) => off || ss.some((s) => matters(s, from0, to0)))
        .map((ss) => ss.sort((a, b) => a.start.localeCompare(b.start)));
    if (!kept.length)
        return null;
    const onAxis = (s) => {
        const k = off ? yr - (s.past ? off.last : off.next) : 0;
        if (!k)
            return s;
        return { ...s, start: shiftYears(s.start, k), end: s.end ? shiftYears(s.end, k) : s.end,
            window: s.window ? { opens: shiftYears(s.window.opens, k), closes: shiftYears(s.window.closes, k) } : null };
    };
    const placed = kept.map((ss) => ss.map(onAxis));
    const yFrom = isSouthern(inp.lat) ? `${yr}-07-01` : `${yr}-01-01`;
    const yTo = isSouthern(inp.lat) ? `${yr + 1}-06-30` : `${yr}-12-31`;
    const at = (mmdd) => (mmdd ? seasonDate(mmdd, yr, inp.lat) : null);
    const fr = inp.frost;
    const lastIso = at(fr?.last), p10Iso = at(fr?.odds?.p10), freezeIso = fr?.freeze ? fallDate(fr.freeze, yr, inp.lat) : null;
    const edges = [t, ...placed.flat().flatMap((s) => [s.start, ...(s.window ? [s.window.opens, s.window.closes] : [])])];
    if (fr && !fr.rare && lastIso)
        edges.push(isoAdd(lastIso, -21));
    if (fr && !fr.rare && freezeIso)
        edges.push(isoAdd(freezeIso, 21));
    if (!(fr && !fr.rare && (lastIso || freezeIso)))
        edges.push(yFrom, yTo);
    const from = monthStart(maxIso([minIso(edges), yFrom]));
    const to = monthEnd(minIso([maxIso(edges), yTo]));
    const span = Math.max(1, daysApart(from, to) + 1);
    const pct = (iso) => Math.min(100, Math.max(0, (daysApart(from, iso) / span) * 100));
    const round = (x) => Math.round(x * 100) / 100;
    const place = (iso) => round(pct(iso));
    const months = [];
    for (let m = from; m <= to; m = isoAdd(monthEnd(m), 1))
        months.push({ at: place(m), label: monthShort(Number(m.slice(5, 7)) - 1) });
    const rowOf = (real, ss) => {
        const segments = [];
        for (const s of ss) {
            const past = !!s.past;
            const win = s.window && past && s.end ? (s.end < s.window.opens ? null : { opens: s.window.opens, closes: minIso([s.window.closes, s.end]) }) : s.window;
            const growTo = win ? win.opens : past ? (s.end ?? s.start) : s.planned ? s.start : t;
            if (growTo > s.start)
                segments.push({ kind: "grow", from: place(s.start), to: place(growTo), planned: s.planned, past });
            if (win)
                segments.push({ kind: "window", from: place(win.opens), to: place(win.closes), planned: s.planned, past });
        }
        const note = off ? offNoteFor(real, t) : noteFor(real, t);
        return { species: ss[0].species, name: ss[0].name, bed: ss[0].bed, segments: merged(segments),
            starts: ss.filter((s, i) => ss.findIndex((o) => !!o.past === !!s.past) === i)
                .map((s) => ({ at: place(s.start), planned: s.planned, past: !!s.past })), planned: ss.every((s) => s.planned),
            past: ss.every((s) => !!s.past), note: note.text, noteKey: note.key };
    };
    const many = inp.beds.length > 1;
    const order = (b) => (b == null ? inp.beds.length : Math.max(0, inp.beds.indexOf(b)));
    const rows = kept.map((ss, i) => rowOf(ss, placed[i])).sort((a, b) => (many ? order(a.bed) - order(b.bed) : 0)
        || (a.starts[0].at - b.starts[0].at) || a.name.localeCompare(b.name));
    const groups = [];
    rows.forEach((r, idx) => {
        const bed = many ? r.bed : null;
        const g = groups.at(-1);
        if (g && g.bed === bed)
            g.rows.push({ ...r, idx });
        else
            groups.push({ bed, rows: [{ ...r, idx }] });
    });
    const shown = new Set(rows.map((r) => r.bed).filter((b) => !!b));
    const idle = inp.beds.filter((b) => !inp.occupied.has(b) && !shown.has(b));
    const resting = many && idle.length
        ? fillCopy(idle.length === 1 ? "hcRestingOne" : "hcRestingMany", { n: idle.length, list: listOf(idle) }) : null;
    const bands = [];
    let spring = null, fall = null, note = null;
    if (fr?.rare)
        note = fr.word === "most" ? (fr.some ? fillCopy("hcFrostMost", { date: fmtMonthDay(fr.some) }) : copy.hcFrostMostNoDate)
            : fr.some ? fillCopy("hcFrostSome", { date: fmtMonthDay(fr.some) })
                : fr.word === "some" ? copy.hcFrostSomeNoDate : copy.hcFrostRare;
    else if (!fr || (!lastIso && !freezeIso))
        note = copy.hcNoFrost;
    else {
        if (lastIso && lastIso > from) {
            bands.push({ from: 0, to: place(lastIso), level: "likely" });
            if (!fr.own && p10Iso && p10Iso > lastIso)
                bands.push({ from: place(lastIso), to: place(p10Iso), level: "possible" });
            const late = !fr.own && p10Iso && p10Iso > lastIso ? fmtMonthDay(p10Iso) : null;
            const label = inp.said === "last" ? (late ? fillCopy("hcFrostLate", { late }) : null)
                : fr.own ? fillCopy("hcFrostOwn", { date: fmtMonthDay(lastIso) })
                    : late ? fillCopy("hcFrostSpringOdds", { date: fmtMonthDay(lastIso), late }) : fillCopy("hcFrostSpring", { date: fmtMonthDay(lastIso) });
            spring = label ? { at: place(lastIso), label } : null;
        }
        if (freezeIso && freezeIso < to) {
            bands.push({ from: place(freezeIso), to: 100, level: "likely" });
            if (inp.said !== "freeze")
                fall = { at: place(freezeIso), label: fillCopy("hcFrostFall", { date: fmtMonthDay(freezeIso) }) };
        }
    }
    const summary = off ? fillCopy(rows.length === 1 ? "hcSummaryOffOne" : "hcSummaryOffMany", { n: rows.length, last: off.last, next: off.next })
        : fillCopy(rows.length === 1 ? "hcSummaryOne" : "hcSummaryMany", { n: rows.length, date: fmtMonthDay(t) });
    return { months, today: { at: place(t), label: fillCopy("hcToday", { date: fmtMonthDay(t) }) }, groups, total: rows.length,
        resting, frost: { bands, spring, fall, note }, summary, off };
}

export { calendarSowings, chartModel, cropWindows, gardenNote, growingCare, leadCrop, logPhotos, offSeasonOf, readyChips, seasonWord, splitPlanned };
