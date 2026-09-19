import { daylengthHours, dayOfYear as doyOf } from "./panels/daylength.js";
export function absenceTier(f) {
    if (f.seasonClosedWhileAway != null)
        return "season";
    const d = f.daysAway;
    if (d == null || d < 14)
        return "none";
    if (d < 60)
        return f.changedWhileAway.length ? "weeks" : "none";
    return "months";
}
export function welcomeBack(f) {
    const weeks = (d) => `${Math.round(d / 7)} weeks away.`;
    switch (absenceTier(f)) {
        case "none":
            return null;
        case "weeks": {
            const [first, ...rest] = f.changedWhileAway;
            return {
                head: `${weeks(f.daysAway ?? 21)} ${first}`,
                detail: rest.length ? `${rest.length} more thing${rest.length === 1 ? "" : "s"} came due while you were gone.` : null,
            };
        }
        case "months": {
            const bits = [];
            if (f.bedCount)
                bits.push(`${f.bedCount} bed${f.bedCount === 1 ? "" : "s"}`);
            if (f.plantingCount)
                bits.push(`${f.plantingCount} planting${f.plantingCount === 1 ? "" : "s"} logged`);
            if (f.lastEntryIso)
                bits.push(`last entry ${prettyDate(f.lastEntryIso)}`);
            if (f.historySeasons > 1)
                bits.push(`rotation history ${f.historySeasons} seasons`);
            return {
                head: f.seasonOpen != null
                    ? `Your ${f.seasonOpen} season is still open.`
                    : "Your garden is where you left it.",
                detail: bits.length ? bits.join(" · ") : null,
            };
        }
        case "season":
            return {
                head: `Your ${f.seasonClosedWhileAway} season closed while you were away.`,
                detail: "What grew where is remembered - the plan won't put the same family back.",
            };
    }
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function prettyDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m)
        return iso;
    const mon = MONTHS[Number(m[2]) - 1];
    return mon ? `${Number(m[3])} ${mon}` : iso;
}
const asDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const daysApart = (aIso, bIso) => Math.round((asDate(bIso).getTime() - asDate(aIso).getTime()) / 86400000);
export function whenLabel(todayIso, dateIso) {
    const d = daysApart(todayIso, dateIso);
    if (d <= 0)
        return "Today";
    if (d === 1)
        return "Tomorrow";
    if (d <= 6)
        return DAYS[asDate(dateIso).getDay()] ?? prettyDate(dateIso);
    if (d <= 31)
        return `~${Math.round(d / 7)} wks`;
    return prettyDate(dateIso);
}
export function gardenStrip(cards) {
    if (cards.length < 2)
        return [];
    const wants = (c) => c.due + (c.late ?? 0) + (c.closed ?? 0);
    return [...cards].sort((a, b) => (wants(b) - wants(a)) || a.name.localeCompare(b.name));
}
export function dueRows(todayIso, tasks, sentence, horizonDays = 31) {
    const rows = [];
    const dated = tasks
        .filter((t) => typeof t.date === "string" && t.date > todayIso
        && daysApart(todayIso, t.date) <= horizonDays && t.kind !== "logged")
        .sort((a, b) => a.date.localeCompare(b.date));
    for (const t of dated) {
        const what = sentence(t);
        if (rows.some((r) => r.what === what))
            continue;
        rows.push({ when: whenLabel(todayIso, t.date), what });
        if (rows.length === 2)
            break;
    }
    return rows;
}
export function homeFacts(inp) {
    const gapStart = inp.daysAway != null && inp.daysAway > 0
        ? isoAdd(inp.todayIso, -inp.daysAway) : null;
    const open = inp.seasons.find((s) => s.id === inp.seasonId && !s.closed_date) ?? null;
    const closed = gapStart
        ? inp.seasons.filter((s) => s.closed_date && s.closed_date > gapStart && s.closed_date <= inp.todayIso)
            .sort((a, b) => a.closed_date.localeCompare(b.closed_date)).pop() ?? null
        : null;
    const changed = gapStart
        ? inp.tasks
            .filter((t) => typeof t.date === "string" && t.date > gapStart && t.date <= inp.todayIso && t.kind !== "logged")
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(inp.sentence)
        : [];
    const dates = [];
    let plantings = 0;
    for (const s of inp.seasons) {
        for (const o of s.observations ?? [])
            if (o.date)
                dates.push(o.date);
        for (const p of s.plantings ?? []) {
            plantings++;
            for (const d of [p.sown, p.transplanted, p.first_harvest, p.last_harvest, p.end_date])
                if (d)
                    dates.push(d);
        }
    }
    dates.sort();
    return {
        daysAway: inp.daysAway,
        seasonClosedWhileAway: closed ? closed.id : null,
        changedWhileAway: [...new Set(changed)],
        seasonOpen: open ? open.id : null,
        bedCount: inp.bedCount,
        plantingCount: plantings,
        lastEntryIso: dates.length ? dates[dates.length - 1] : null,
        historySeasons: inp.seasons.length,
    };
}
const isoAdd = (iso, days) => {
    const d = asDate(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const regionPts = (r) => {
    if (r.shape === "rect" && r.x != null && r.y != null && r.w != null && r.h != null) {
        return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    }
    if (r.shape === "polygon" && Array.isArray(r.points)) {
        return r.points.filter((p) => p.length >= 2).map((p) => [p[0], p[1]]);
    }
    return [];
};
const regionCentre = (r) => {
    const pts = regionPts(r);
    if (!pts.length)
        return null;
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};
export function plateScale(frame, viewW, viewH, fill = 0.82) {
    return Math.max(frame.w / (viewW * fill), frame.h / (viewH * fill), 1e-6);
}
export function project(pt, v) {
    return [v.w / 2 + (pt[0] - v.cx) / v.mpp, v.h / 2 - (pt[1] - v.cy) / v.mpp];
}
export function gardenFrame(beds, plantings) {
    const gBeds = [];
    for (const b of beds) {
        const pts = regionPts(b.region);
        if (pts.length >= 3)
            gBeds.push({ name: b.name, planted: !!b.planted, pts, ...(b.structure ? { structure: b.structure } : {}) });
    }
    if (!gBeds.length)
        return null;
    const xs = gBeds.flatMap((b) => b.pts.map((p) => p[0]));
    const ys = gBeds.flatMap((b) => b.pts.map((p) => p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const dots = [];
    for (const p of plantings) {
        const c = regionCentre(p.region);
        if (c && c[0] >= minX - 1 && c[0] <= maxX + 1 && c[1] >= minY - 1 && c[1] <= maxY + 1) {
            dots.push({ x: c[0], y: c[1], species: p.species });
        }
    }
    return {
        beds: gBeds, dots,
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        w: Math.max(0.5, maxX - minX), h: Math.max(0.5, maxY - minY),
    };
}
const GUIDE_BY_ID = {
    "onion-latitude": "frost-dates-zones-daylength",
    "tomato-set": "why-tomatoes-dont-set-fruit",
    "squash-set": "pollination-and-fruit-set",
    "black-bottoms": "blossom-end-rot",
    "follows-solanaceae": "crop-rotation",
    "follows-brassica": "crop-rotation",
    "cabbage-worm": "companion-planting-honestly",
    "one-tree": "pollination-and-fruit-set",
    "sow-before-frost": "read-a-planting-calendar",
    "start-indoors": "starting-seeds-indoors",
    "still-time": "read-a-planting-calendar",
    "winter-survive": "frost-dates-zones-daylength",
    "fertilizer": "the-soil-test",
    "watering": "how-to-water",
    "frost-date": "frost-dates",
    "rotation-ground": "crop-rotation",
};
const has = (set, ...keys) => keys.some((k) => set.has(k));
const why = (rule) => `#/why?rule=${rule}`;
const CATALOGUE = [
    {
        id: "onion-latitude", weight: 3,
        q: "Why didn't my onions bulb?",
        hint: "Daylength decides it - and your zone cannot tell you that",
        href: why("R-081"),
        fits: (c) => has(c.speciesPresent, "allium_cepa"),
    },
    {
        id: "tomato-set", weight: 3,
        q: "Why won't my tomatoes set fruit?",
        hint: "Warm nights, not sunlight - the gap nobody explains",
        href: why("R-030"),
        fits: (c) => has(c.speciesPresent, "solanum_lycopersicum") && c.month >= 6 && c.month <= 9,
    },
    {
        id: "squash-set", weight: 3,
        q: "Why won't my squash set fruit?",
        hint: "An insect has to move the pollen - and nothing may be in flower when it does",
        href: why("R-102"),
        fits: (c) => c.insectPollinatedPresent.size > 0,
    },
    {
        id: "black-bottoms", weight: 3,
        q: "Why do my tomatoes have black bottoms?",
        hint: "Uneven water, not missing calcium - and the fix is not an amendment",
        href: why("R-104"),
        fits: (c) => c.berSusceptiblePresent.size > 0,
    },
    {
        id: "follows-solanaceae", weight: 3,
        q: "What can follow my tomatoes?",
        hint: "Three years before nightshades return to that ground",
        href: why("R-010"),
        fits: (c) => has(c.familiesPresent, "solanaceae"),
    },
    {
        id: "follows-brassica", weight: 3,
        q: "What can follow my cabbages?",
        hint: "Four years, and the reason is in the soil, not the plant",
        href: why("R-012"),
        fits: (c) => has(c.familiesPresent, "brassicaceae"),
    },
    {
        id: "cabbage-worm", weight: 3,
        q: "Does anything really keep worms off my cabbages?",
        hint: "One trial says thyme. Plenty say nothing. We won't oversell it",
        href: why("R-050"),
        fits: (c) => has(c.familiesPresent, "brassicaceae"),
    },
    {
        id: "one-tree", weight: 3,
        q: "Will one tree fruit on its own?",
        hint: "Some need a second, genetically different plant",
        href: why("R-080"),
        fits: (c) => has(c.speciesPresent, "malus_domestica", "pyrus_communis", "prunus_domestica", "prunus_cerasus", "prunus_persica"),
    },
    {
        id: "sow-before-frost", weight: 2,
        q: "Can I sow anything before the last frost?",
        hint: "Hardy crops go out weeks early - here's how many",
        href: why("R-096"),
        fits: (c) => c.month >= 1 && c.month <= 4,
    },
    {
        id: "start-indoors", weight: 2,
        q: "When do I start seeds indoors?",
        hint: "Counted back from your own last frost, not a packet's",
        href: why("R-097"),
        fits: (c) => c.month >= 12 || c.month <= 3,
    },
    {
        id: "still-time", weight: 2,
        q: "Is there still time to plant this?",
        hint: "Days to maturity against your first freeze",
        href: why("R-032"),
        fits: (c) => c.month >= 6 && c.month <= 9,
    },
    {
        id: "winter-survive", weight: 2,
        q: "What will survive my winter?",
        hint: "Zone answers this - and only this",
        href: why("R-076"),
        fits: (c) => c.hasLocation && (c.month >= 9 || c.month <= 2),
    },
    {
        id: "fertilizer", weight: 1,
        q: "Should I be feeding the soil?",
        hint: "Not without a test - we won't invent the numbers",
        href: why("R-017"),
        fits: () => true,
    },
    {
        id: "watering", weight: 1,
        q: "How often should I water?",
        hint: "Check the soil, not the calendar - drying rate is weather, and we don't have it",
        href: why("R-103"),
        fits: () => true,
    },
    {
        id: "frost-date", weight: 1,
        q: "How much can I trust my frost date?",
        hint: "It's a percentile, not a promise - and yours can supersede it",
        href: why("R-093"),
        fits: (c) => c.hasLocation,
    },
    {
        id: "rotation-ground", weight: 1,
        q: "Why does moving a bed not reset its history?",
        hint: "History belongs to the ground, not the box you put on it",
        href: why("R-071"),
        fits: () => true,
    },
];
export function homeQuestions(ctx, limit = 3) {
    const live = CATALOGUE.filter((e) => e.fits(ctx));
    const banded = new Map();
    for (const e of live) {
        const b = banded.get(e.weight) ?? [];
        b.push(e);
        banded.set(e.weight, b);
    }
    const out = [];
    for (const weight of [...banded.keys()].sort((a, b) => b - a)) {
        const band = banded.get(weight);
        const start = band.length ? ctx.dayOfYear % band.length : 0;
        for (let i = 0; i < band.length && out.length < limit; i++) {
            const e = band[(start + i) % band.length];
            out.push({ id: e.id, q: e.q, hint: e.hint, href: e.href, guide: GUIDE_BY_ID[e.id] });
        }
        if (out.length >= limit)
            break;
    }
    return out;
}
export function seasonRibbon(inp) {
    const yr = Number(inp.todayIso.slice(0, 4));
    const mmddIso = (mmdd) => `${yr}-${mmdd}`;
    const FROST_HREF = "#/why?rule=R-032";
    if (inp.lat != null && inp.onionsPresent) {
        const solstice = inp.lat >= 0 ? 172 : 355;
        const doy = doyOf(asDate(inp.todayIso));
        const dd = Math.abs(doy - solstice);
        const toSolstice = Math.min(dd, 365 - dd);
        const peak = daylengthHours(inp.lat, solstice);
        const now = daylengthHours(inp.lat, doy);
        if (toSolstice <= 21 && peak - now < 0.25) {
            return { when: "SEASON",
                text: "Daylength is near its yearly peak — your onions are bulbing now.",
                grade: null, href: "#/why?rule=R-081" };
        }
    }
    const lastIso = inp.lastFrostMmdd ? mmddIso(inp.lastFrostMmdd) : null;
    const freezeIso = inp.firstFreezeMmdd ? mmddIso(inp.firstFreezeMmdd) : null;
    const toLast = lastIso ? daysApart(inp.todayIso, lastIso) : null;
    const toFreeze = freezeIso ? daysApart(inp.todayIso, freezeIso) : null;
    if (toLast != null && toLast > 0) {
        return { when: `${toLast} DAYS`,
            text: `to your last spring frost (${prettyDate(lastIso)}) — hold tender crops until then.`,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    if (toLast != null && toLast <= 0 && toLast > -14) {
        return { when: "SEASON",
            text: "You are just past your last spring frost — the tender-crop window is open.",
            grade: inp.frostGrade, href: FROST_HREF };
    }
    if (toFreeze != null && toFreeze > 0) {
        return { when: `${toFreeze} DAYS`,
            text: `to your first fall frost (${prettyDate(freezeIso)}), the end of the season for tender crops.`,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    if (toFreeze != null && toFreeze <= 0) {
        return { when: "SEASON",
            text: `Your first fall frost has passed (${prettyDate(freezeIso)}) — tender crops are done for the year.`,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    return null;
}
export function sinceAway(inp) {
    const gate = inp.minDaysAway ?? 5;
    if (inp.daysAway == null || inp.daysAway < gate)
        return [];
    const decay = inp.decayDays ?? 30;
    const gapStart = isoAdd(inp.todayIso, -Math.min(inp.daysAway, decay));
    const out = [];
    for (const e of inp.bedEvents) {
        if (e.whenIso > gapStart && e.whenIso <= inp.todayIso) {
            out.push({ tag: "bed", text: e.text, score: daysApart(gapStart, e.whenIso) });
        }
    }
    return out.sort((a, b) => b.score - a.score);
}
export function contextBudget(items, cap) {
    return { shown: items.slice(0, Math.max(0, cap)), overflow: Math.max(0, items.length - cap) };
}
