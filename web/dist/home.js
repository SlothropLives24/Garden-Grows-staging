import './chunk-ejg0q7q9.js';
import { datesStationOf, stationLabel, frostStationOf, frostWord, frostGate, fmtMonthDay, fmtKm, seasonYearOf, dayOfYear, fallDate, daylengthHours, seasonDate, fmtMonthDayYear, northernMonth, tropical, monthLong, comingSeasonAfter, seasonAfter, commonName, fmtCmValue, isSouthern, app, hasGround, gardenWideTasks, bedLocator, isSignedIn, frostGiven, placeWarmWaits, frostDatesModelled, frostPossible, frostSomeWinters, confidenceWord, givenFirstFrost, currentAskCard, recollectionLine, weekSummary, seasonById, comingSeasonTasks, owedFor, category, waterNow, weekTaskPool, currentGardenCtx, resolvedField, gardenFrost, onWarmthPath, windowFreeze, boltWarnings, needsInsects, seasonId, unfitPlan, listPosts, signedInEmail, ownFrostAt, openSeason, plantingOnBed, allGardenSeasons, gardensNow, seasonLabel, plantingWindow, plantingLabel, oneWarmWindow, paceChoice, taskWindow, plannedOnly, displayName, openLog, getPhoto, taskSentence, el, shelfGuides, START_SHELF, feedTime, postBody, guideBySlug, seed, weekJobs, jobTitle, priorSeasons, gardenShownName, speciesThumb, setPaceChoice, toast, setHousehold, setAfterChoice, afterChoice, householdChoice, setSpaceChoice, spaceChoice, seasonChoice, glossTerm, gradeClassOfWord, markLink, isMarker, shelfAnchor, followAsk } from './core.js';
import { fillCopy, copy, pluralCopy, midSentence, appLang, isExamplePlot, go, quickCrops, dateLocale, chunkReady, loadChunk, homeSettled, fillNodes, daysAway } from './paint.js';
import { waterCare, weekGlance } from './chunk-kgeprte0.js';
import { unfitLine, unfitSeed } from './chunk-i6fqop94.js';
import { bigSeeds } from './chunk-jyr6krgw.js';
import { exampleElsewhere } from './chunk-bm4hdmsn.js';
import { dayOfYearIso } from './chunk-d70vvzl3.js';
import { calendarSowings } from './chunk-c66xn17y.js';
import { yearPlace, gardenSowings, yearTwin, lastYearDays, plantCounts, ringLines } from './chunk-c80k2nea.js';
import { drawYearInto, yearFigure } from './chunk-lxoyu69a.js';
import { guideShelf } from './chunk-kbn0qi4u.js';
import { licenceWord } from './chunk-ky5skx88.js';
import './chunk-f8narovd.js';
import './chunk-h8sxf1mq.js';
import './chunk-ln9yxim8.js';
import './chunk-pdnkwjb0.js';

function stationRibbonText(site) {
    const st = frostStationOf(site), word = frostWord(site);
    if (!st || !word)
        return null;
    const date = frostGate(site ?? null)?.date ?? null;
    const ds = datesStationOf(site), two = !!date && !!ds && ds.id !== st.id;
    const v = { station: stationLabel(st), dist: fmtKm(st.km), n: st.frost_winters, years: st.winters, date: date ? fmtMonthDay(date) : "",
        dstation: ds ? stationLabel(ds) : "" };
    if (word === "rare")
        return fillCopy(st.frost_winters > 0 ? "hfRibFrostStRare" : "hfRibFrostStNone", v);
    if (word === "some")
        return fillCopy(two ? "hfRibFrostStSomeTwo" : date ? "hfRibFrostStSome" : "hfRibFrostStSomeNoDate", v);
    return fillCopy(two ? "hfRibFrostStMostTwo" : date ? "hfRibFrostStMost" : "hfRibFrostStMostNoDate", v);
}
function datesStationText(site) {
    const ds = datesStationOf(site);
    return ds ? stationLabel(ds) : null;
}

function absenceTier(f) {
    if (f.seasonClosedWhileAway != null)
        return "season";
    const d = f.daysAway;
    if (d == null || d < 7)
        return "none";
    if (d < 60)
        return f.changedWhileAway.length ? "weeks" : "none";
    return "months";
}
function welcomeBack(f) {
    switch (absenceTier(f)) {
        case "none":
            return null;
        case "weeks": {
            const [first, ...rest] = f.changedWhileAway;
            const n = Math.round((f.daysAway ?? 21) / 7);
            return {
                head: n <= 1 ? fillCopy("hfWeekAway", { first }) : fillCopy("hfWeeksAway", { n, first }),
                detail: rest.length ? pluralCopy("hfMoreDue", rest.length) : null,
            };
        }
        case "months": {
            const bits = [];
            if (f.bedCount)
                bits.push(pluralCopy("hfBitBeds", f.bedCount));
            if (f.plantingCount)
                bits.push(pluralCopy("hfBitPlantings", f.plantingCount));
            if (f.lastEntryIso)
                bits.push(fillCopy("hfBitLastEntry", { date: prettyDate(f.lastEntryIso) }));
            if (f.historySeasons > 1)
                bits.push(fillCopy("hfBitRotation", { n: f.historySeasons }));
            return {
                head: f.seasonOpen != null
                    ? fillCopy("hfSeasonOpen", { year: f.seasonOpen })
                    : copy.hfWhereLeft,
                detail: bits.length ? bits.join(" · ") : null,
            };
        }
        case "season":
            return {
                head: fillCopy("hfSeasonClosedAway", { year: f.seasonClosedWhileAway ?? "" }),
                detail: copy.hfSeasonClosedDetail,
            };
    }
}
const DAYS = [copy.hfDaySunday, copy.hfDayMonday, copy.hfDayTuesday, copy.hfDayWednesday, copy.hfDayThursday,
    copy.hfDayFriday, copy.hfDaySaturday];
function prettyDate(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmtMonthDay(iso) : iso;
}
const asDate$2 = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const daysApart$2 = (aIso, bIso) => Math.round((asDate$2(bIso).getTime() - asDate$2(aIso).getTime()) / 86400000);
function whenLabel(todayIso, dateIso) {
    const d = daysApart$2(todayIso, dateIso);
    if (d <= 0)
        return copy.hfWhenToday;
    if (d === 1)
        return copy.hfWhenTomorrow;
    if (d <= 6)
        return DAYS[asDate$2(dateIso).getDay()] ?? prettyDate(dateIso);
    if (d <= 10)
        return copy.hfWhenWeek;
    if (d <= 31)
        return fillCopy("hfWhenWeeks", { n: Math.round(d / 7) });
    return dateIso.slice(0, 4) !== todayIso.slice(0, 4) && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? fmtMonthDayYear(dateIso) : prettyDate(dateIso);
}
function alsoYours(all, hereId, hereSeason) {
    if (all.length < 2)
        return [];
    return all.filter((g) => g.id !== hereId).map((g) => ({ ...g, season: g.season && g.season !== hereSeason ? g.season : null }));
}
function homeFacts(inp) {
    const gapStart = inp.daysAway != null && inp.daysAway > 0
        ? isoAdd$2(inp.todayIso, -inp.daysAway) : null;
    const open = inp.seasons.find((s) => s.id === inp.seasonId && !s.closed_date) ?? null;
    const closed = gapStart
        ? inp.seasons.filter((s) => s.closed_date && s.closed_date > gapStart && s.closed_date < inp.todayIso)
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
const isoAdd$2 = (iso, days) => {
    const d = asDate$2(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const GUIDE_BY_ID = {
    "onion-latitude": "frost-dates-zones-daylength",
    "tomato-set": "why-tomatoes-dont-set-fruit",
    "bolting": "succession-planting",
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
const firstOf = (set) => set.values().next().value ?? null;
const firstInFamily = (c, fam) => {
    if (!c.familyOf)
        return null;
    for (const sid of c.speciesPresent)
        if (c.familyOf(sid) === fam)
            return sid;
    return null;
};
const ABOUT = { 3: "garden", 2: "season", 1: "always" };
const has = (set, ...keys) => keys.some((k) => set.has(k));
const why = (rule) => `#/why?rule=${rule}`;
const CATALOGUE = [
    {
        id: "onion-latitude", weight: 3,
        q: copy.hfQOnion,
        subject: (c) => (c.speciesPresent.has("allium_cepa") ? "allium_cepa" : null),
        hint: copy.hfHOnion,
        href: why("R-081"),
        fits: (c) => has(c.speciesPresent, "allium_cepa"),
    },
    {
        id: "tomato-set", weight: 3,
        q: copy.hfQTomatoSet,
        subject: (c) => (c.speciesPresent.has("solanum_lycopersicum") ? "solanum_lycopersicum" : null),
        hint: copy.hfHTomatoSet,
        href: why("R-030"),
        fits: (c) => has(c.speciesPresent, "solanum_lycopersicum") && c.month >= 6 && c.month <= 9,
    },
    {
        id: "bolting", weight: 3,
        q: copy.hfQBolting,
        subject: (c) => firstOf(c.boltingNow ?? new Set()),
        hint: copy.hfHBolting,
        href: why("R-172"),
        fits: (c) => (c.boltingNow?.size ?? 0) > 0,
    },
    {
        id: "squash-set", weight: 3,
        q: copy.hfQSquashSet,
        subject: (c) => firstOf(c.insectPollinatedPresent),
        hint: copy.hfHSquashSet,
        href: why("R-102"),
        fits: (c) => c.insectPollinatedPresent.size > 0 && c.month >= 4 && c.month <= 9,
    },
    {
        id: "black-bottoms", weight: 3,
        q: copy.hfQBlackBottoms,
        subject: (c) => firstOf(c.berSusceptiblePresent),
        hint: copy.hfHBlackBottoms,
        href: why("R-104"),
        fits: (c) => c.berSusceptiblePresent.size > 0 && c.month >= 5 && c.month <= 10,
    },
    {
        id: "follows-solanaceae", weight: 3,
        q: copy.hfQFollowsNightshade,
        subject: (c) => firstInFamily(c, "solanaceae"),
        hint: copy.hfHFollowsNightshade,
        href: why("R-010"),
        fits: (c) => has(c.familiesPresent, "solanaceae"),
    },
    {
        id: "follows-brassica", weight: 3,
        q: copy.hfQFollowsBrassica,
        subject: (c) => firstInFamily(c, "brassicaceae"),
        hint: copy.hfHFollowsBrassica,
        href: why("R-012"),
        fits: (c) => has(c.familiesPresent, "brassicaceae"),
    },
    {
        id: "cabbage-worm", weight: 3,
        q: copy.hfQCabbageWorm,
        subject: (c) => firstInFamily(c, "brassicaceae"),
        hint: copy.hfHCabbageWorm,
        href: why("R-050"),
        fits: (c) => has(c.familiesPresent, "brassicaceae"),
    },
    {
        id: "one-tree", weight: 3,
        q: copy.hfQOneTree,
        subject: (c) => ["malus_domestica", "pyrus_communis", "prunus_domestica", "prunus_cerasus",
            "prunus_persica"].find((sid) => c.speciesPresent.has(sid)) ?? null,
        hint: copy.hfHOneTree,
        href: why("R-080"),
        fits: (c) => has(c.speciesPresent, "malus_domestica", "pyrus_communis", "prunus_domestica", "prunus_cerasus", "prunus_persica"),
    },
    {
        id: "sow-before-frost", weight: 2,
        q: copy.hfQSowBeforeFrost,
        hint: copy.hfHSowBeforeFrost,
        href: why("R-096"),
        fits: (c) => c.hasFrost !== false && c.month >= 1 && c.month <= 4,
    },
    {
        id: "start-indoors", weight: 2,
        q: copy.hfQStartIndoors,
        hint: copy.hfHStartIndoors,
        href: why("R-097"),
        fits: (c) => c.hasFrost !== false && (c.month >= 12 || c.month <= 3),
    },
    {
        id: "still-time", weight: 2,
        q: copy.hfQStillTime,
        hint: "",
        href: why("R-032"),
        fits: (c) => c.hasFrost !== false && c.month >= 6 && c.month <= 9,
    },
    {
        id: "winter-survive", weight: 2,
        q: copy.hfQWinterSurvive,
        hint: copy.hfHWinterSurvive,
        href: why("R-076"),
        fits: (c) => c.hasLocation && (c.month >= 9 || c.month <= 2),
    },
    {
        id: "fertilizer", weight: 1,
        q: copy.hfQFertilizer,
        hint: copy.hfHFertilizer,
        href: why("R-017"),
        fits: () => true,
    },
    {
        id: "watering", weight: 1,
        q: copy.hfQWatering,
        hint: copy.hfHWatering,
        href: why("R-103"),
        fits: () => true,
    },
    {
        id: "frost-date", weight: 1,
        q: copy.hfQFrostDate,
        hint: copy.hfHFrostDate,
        href: why("R-093"),
        fits: (c) => c.hasLocation && c.hasFrost !== false,
    },
    {
        id: "rotation-ground", weight: 1,
        q: copy.hfQRotationGround,
        hint: copy.hfHRotationGround,
        href: why("R-071"),
        fits: () => true,
    },
];
function neverPlanted(gardens) {
    if (gardens === null)
        return false;
    return !gardens.some((seasons) => seasons.some((s) => (s.plantings?.length ?? 0) > 0));
}
function homeQuestions(ctx, limit = 3) {
    const live = CATALOGUE.filter((e) => e.fits(ctx) && (!e.q.includes("{plant}") || !!e.subject?.(ctx)));
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
            const subject = e.subject?.(ctx) ?? undefined;
            const name = subject ? (ctx.plantName?.(subject) ?? subject.replace(/_/g, " ")) : "";
            const photo = subject ? (ctx.plantPhoto?.(subject) ?? undefined) : undefined;
            out.push({ id: e.id, q: e.q.replace("{plant}", name), hint: e.hint, href: e.href,
                guide: GUIDE_BY_ID[e.id], about: ABOUT[e.weight] ?? "always", subject, photo });
        }
        if (out.length >= limit)
            break;
    }
    return out;
}
const FROST_HREF = "#/why?rule=R-032";
const FROST_SOON_DAYS = 14;
function seasonRibbon(inp) {
    const yr = seasonYearOf(inp.todayIso, inp.lat);
    const mmddIso = (mmdd) => seasonDate(mmdd, yr, inp.lat);
    if (inp.lat != null && inp.onionsPresent) {
        const solstice = inp.lat >= 0 ? 172 : 355;
        const doy = dayOfYear(asDate$2(inp.todayIso));
        const dd = Math.abs(doy - solstice);
        const toSolstice = Math.min(dd, 365 - dd);
        const peak = daylengthHours(inp.lat, solstice);
        const now = daylengthHours(inp.lat, doy);
        if (toSolstice <= 21 && peak - now < 0.25) {
            return { when: copy.hfWhenSeason,
                text: copy.hfRibOnions,
                grade: null, href: "#/why?rule=R-081" };
        }
    }
    if (inp.frostRare) {
        return { when: copy.hfWhenSeason,
            text: inp.frostStation ? inp.frostStation
                : inp.frostSome ? fillCopy(inp.frostModeled ? "hfRibFrostSomeModel" : "hfRibFrostSome", { date: fmtMonthDay(inp.frostSome) })
                    : inp.frostModeled ? copy.hfRibFrostRareModel : copy.hfRibFrostRare,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    const gLast = inp.lastOwn ? null : inp.frostGrade;
    const gFreeze = inp.freezeOwn ? null : inp.frostGrade;
    const lastIso = inp.lastFrostMmdd ? mmddIso(inp.lastFrostMmdd) : null;
    const freezeIso = inp.firstFreezeMmdd ? fallDate(inp.firstFreezeMmdd, yr, inp.lat) : null;
    const toLast = lastIso ? daysApart$2(inp.todayIso, lastIso) : null;
    const toFreeze = freezeIso ? daysApart$2(inp.todayIso, freezeIso) : null;
    const at = !!inp.place;
    if (toLast != null && toLast > 0) {
        return { when: pluralCopy("hfWhenDays", toLast),
            text: fillCopy(inp.datesStation && !inp.lastOwn ? (at ? "hfRibToLastStAt" : "hfRibToLastSt") : at ? "hfRibToLastAt" : "hfRibToLast", { date: prettyDate(lastIso), station: inp.datesStation ?? "", place: inp.place ?? "" }),
            grade: gLast, href: FROST_HREF, says: "last", soon: toLast <= FROST_SOON_DAYS };
    }
    if (toLast != null && toLast <= 0 && toLast > -14) {
        return { when: copy.hfWhenSeason,
            text: inp.warmWaits ? (inp.place ? fillCopy("hfRibPastLastWarmAt", { place: inp.place }) : copy.hfRibPastLastWarm)
                : inp.place ? fillCopy("hfRibPastLastAt", { place: inp.place }) : copy.hfRibPastLast,
            grade: gLast, href: FROST_HREF };
    }
    if (toFreeze != null && toFreeze > 0) {
        return { when: pluralCopy("hfWhenDays", toFreeze),
            text: fillCopy(inp.datesStation && !inp.freezeOwn ? (at ? "hfRibToFreezeStAt" : "hfRibToFreezeSt") : at ? "hfRibToFreezeAt" : "hfRibToFreeze", { date: prettyDate(freezeIso), station: inp.datesStation ?? "", place: inp.place ?? "" }),
            grade: gFreeze, href: FROST_HREF, says: "freeze", soon: toFreeze <= FROST_SOON_DAYS };
    }
    if (toFreeze != null && toFreeze <= 0) {
        return { when: copy.hfWhenSeason,
            text: fillCopy(at ? "hfRibFreezePassedAt" : "hfRibFreezePassed", { date: prettyDate(freezeIso), place: inp.place ?? "" }),
            grade: gFreeze, href: FROST_HREF, says: "freeze" };
    }
    return null;
}

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
    else if (grew.length <= 3) {
        const k = off.open ? "hnOffGrewOpen" : "hnOffGrew";
        out.push({ key: k, text: fillCopy(k, { year: off.last, list: listOf(grew) }), fact: { kind: "off-grew", year: off.last, crops: off.grew } });
    }
    else {
        const k = off.open ? "hnOffGrewMoreOpen" : "hnOffGrewMore";
        out.push({ key: k, text: fillCopy(k, { year: off.last, list: grew.slice(0, 2).join(", "), n: grew.length - 2 }),
            fact: { kind: "off-grew", year: off.last, crops: off.grew } });
    }
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
function matters(s, from, to) {
    if (s.planned)
        return s.start >= from && s.start <= to;
    return !s.window || s.window.closes >= from;
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
    const kept = [...byRow.values()].filter((ss) => off || ss.some((s) => matters(s, from0, to0)) || (!!inp.focus && ss.some((s) => s.species === inp.focus)))
        .map((ss) => ss.sort((a, b) => a.start.localeCompare(b.start)));
    if (!kept.length)
        return null;
    const first = (ss) => {
        const s = ss[0];
        return shiftYears(s.start, off ? yr - (s.past ? off.last : off.next) : 0);
    };
    const rowOf = (ss) => {
        const note = off ? offNoteFor(ss, t) : noteFor(ss, t);
        return { species: ss[0].species, name: ss[0].name, bed: ss[0].bed, planned: ss.every((s) => s.planned),
            past: ss.every((s) => !!s.past), note: note.text, noteKey: note.key, at: first(ss) };
    };
    const many = inp.beds.length > 1;
    const order = (b) => (b == null ? inp.beds.length : Math.max(0, inp.beds.indexOf(b)));
    const rows = kept.map(rowOf).sort((a, b) => (many ? order(a.bed) - order(b.bed) : 0)
        || a.at.localeCompare(b.at) || a.name.localeCompare(b.name));
    const groups = [];
    rows.forEach(({ at: _at, ...r }, idx) => {
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
    const yFrom = isSouthern(inp.lat) ? `${yr}-07-01` : `${yr}-01-01`;
    const yTo = isSouthern(inp.lat) ? `${yr + 1}-06-30` : `${yr}-12-31`;
    const at = (mmdd) => (mmdd ? seasonDate(mmdd, yr, inp.lat) : null);
    const fr = inp.frost;
    const lastIso = at(fr?.last), p10Iso = at(fr?.odds?.p10), freezeIso = fr?.freeze ? fallDate(fr.freeze, yr, inp.lat) : null;
    let spring = null, fall = null, note = null;
    if (fr?.rare)
        note = fr.word === "most" ? (fr.some ? fillCopy("hcFrostMost", { date: fmtMonthDay(fr.some) }) : copy.hcFrostMostNoDate)
            : fr.some ? fillCopy("hcFrostSome", { date: fmtMonthDay(fr.some) })
                : fr.word === "some" ? copy.hcFrostSomeNoDate : copy.hcFrostRare;
    else if (!fr || (!lastIso && !freezeIso))
        note = copy.hcNoFrost;
    else {
        if (lastIso && lastIso > yFrom) {
            const late = !fr.own && p10Iso && p10Iso > lastIso ? fmtMonthDay(p10Iso) : null;
            spring = inp.said === "last" ? (late ? fillCopy("hcFrostLate", { late }) : null)
                : fr.own ? fillCopy("hcFrostOwn", { date: fmtMonthDay(lastIso) })
                    : late ? fillCopy("hcFrostSpringOdds", { date: fmtMonthDay(lastIso), late }) : fillCopy("hcFrostSpring", { date: fmtMonthDay(lastIso) });
        }
        if (freezeIso && freezeIso <= yTo && inp.said !== "freeze")
            fall = fillCopy("hcFrostFall", { date: fmtMonthDay(freezeIso) });
    }
    return { groups, total: rows.length, resting, frost: { spring, fall, note }, off };
}

const SEASON_FUNCTIONS = [
    { key: "spring", name: copy.smNameSpring, verb: copy.smVerbSpring },
    { key: "summer", name: copy.smNameSummer, verb: copy.smVerbSummer },
    { key: "autumn", name: copy.smNameAutumn, verb: copy.smVerbAutumn },
    { key: "winter", name: copy.smNameWinter, verb: copy.smVerbWinter },
];
function seasonOf(key) {
    return SEASON_FUNCTIONS.find((f) => f.key === key);
}

function mdDistance(m1, d1, m2, d2) {
    const doy = (m, d) => (m - 1) * 30.4 + d;
    const a = doy(m1, d1), b = doy(m2, d2);
    const raw = Math.abs(a - b);
    return Math.min(raw, 365 - raw);
}
function aYearAgoThisWeek(seasons, todayIso, windowDays = 7) {
    const t = new Date(`${todayIso}T12:00:00`);
    if (Number.isNaN(t.getTime()))
        return [];
    const tm = t.getUTCMonth() + 1, td = t.getUTCDate(), ty = t.getUTCFullYear();
    const out = [];
    const near = (iso) => {
        if (!iso)
            return false;
        const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (!parts)
            return false;
        return mdDistance(tm, td, Number(parts[2]), Number(parts[3])) <= windowDays;
    };
    for (const s of seasons) {
        const yearsAgo = ty - s.id;
        if (yearsAgo < 1)
            continue;
        const add = (date, kind, extra = {}) => {
            if (date && near(date))
                out.push({ date, year: s.id, yearsAgo, kind, ...extra });
        };
        for (const p of s.plantings ?? []) {
            add(p.sown, "sowed", { species: p.species });
            add(p.transplanted, "transplanted", { species: p.species });
            add(p.first_harvest, "first_harvest", { species: p.species });
            add(p.last_harvest, "last_harvest", { species: p.species });
            for (const n of p.notes ?? [])
                add(n.date, "note", { species: p.species, text: n.text, photo: n.photo });
        }
        for (const o of s.observations ?? []) {
            if (o.event === "frost")
                add(o.date, "frost");
            else if (o.event === "heat")
                add(o.date, "heat");
            else if (o.event === "note")
                add(o.date, "note", { text: o.note });
        }
    }
    out.sort((a, b) => (a.yearsAgo - b.yearsAgo) || a.date.localeCompare(b.date));
    return out;
}

function wireWhy(a) {
    const h = a.getAttribute("href") ?? "";
    const rule = /#\/why\?rule=(R-\d+)/.exec(h);
    if (rule) {
        markLink(a, { kind: "rule", id: rule[1] });
        return;
    }
    const belief = /#\/why\?belief=(B-\d+)/.exec(h);
    if (belief)
        markLink(a, { kind: "belief", id: belief[1] });
}
function creditInto(parent, key, c) {
    const artist = el("span", "home-credit-artist", c.artist);
    if (appLang() === "es")
        artist.lang = "en";
    fillNodes(parent, copy[key], { artist, licence: document.createTextNode(c.licence), crop: document.createTextNode(c.crop ?? "") });
    return parent;
}
const GUIDE_LABEL = {
    "blossom-end-rot": copy.hfGuideBlossomEndRot,
    "why-tomatoes-dont-set-fruit": copy.hfGuideTomatoSet,
    "pollination-and-fruit-set": copy.hfGuidePollination,
    "frost-dates-zones-daylength": copy.hfGuideZonesFrost,
    "crop-rotation": copy.hfGuideRotation,
    "companion-planting-honestly": copy.hfGuideCompanion,
    "read-a-planting-calendar": copy.hfGuideCalendar,
    "starting-seeds-indoors": copy.hfGuideSeedsIndoors,
    "the-soil-test": copy.hfGuideSoilTest,
    "how-to-water": copy.hfGuideWater,
    "succession-planting": copy.hfGuideSuccession,
    "frost-dates": copy.hfGuideFrostDates,
};
const HOME_START_CARDS = 6;
function promotedAsk(q) {
    const art = document.createElement("article");
    art.className = "askbig";
    art.dataset.q = q.id;
    const top = document.createElement("div");
    top.className = "askbig-top";
    const entry = q.guide ? guideBySlug(q.guide) : null;
    const pic = q.photo ?? entry?.thumb ?? null;
    if (pic) {
        const im = document.createElement("img");
        im.className = "askbig-img";
        im.src = `img/thumbs/${pic}.webp`;
        im.alt = "";
        im.width = 456;
        im.height = 228;
        im.loading = "lazy";
        im.decoding = "async";
        top.appendChild(im);
    }
    else {
        art.classList.add("noimg");
    }
    const stack = document.createElement("div");
    stack.className = "askbig-stack";
    const k = document.createElement("span");
    k.className = "askbig-k";
    k.textContent = copy.homeAskKicker;
    const a = document.createElement("a");
    a.className = "askbig-q";
    a.href = q.href;
    a.dataset.q = q.id;
    wireWhy(a);
    a.textContent = q.q;
    const h = document.createElement("span");
    h.className = "askbig-h";
    h.textContent = q.hint;
    stack.append(k, a);
    if (q.hint)
        stack.append(h);
    top.appendChild(stack);
    art.appendChild(top);
    if (q.guide && entry) {
        const g = document.createElement("a");
        g.className = "askbig-g";
        g.href = `../guides/${q.guide}/`;
        const gt = document.createElement("span");
        gt.className = "askbig-gt";
        gt.textContent = `${GUIDE_LABEL[q.guide] ?? entry.title}\u00a0›`;
        g.append(gt);
        art.appendChild(g);
    }
    return art;
}
const _homePhotoUrls = new Map();
let _carryWired = false;
function carryPlates() {
    if (_carryWired || !("onpageswap" in window))
        return;
    _carryWired = true;
    const sheet = [...document.styleSheets].find((x) => x.href?.includes("styles.css"));
    try {
        sheet?.insertRule("@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }", sheet.cssRules.length);
    }
    catch { }
    addEventListener("pageswap", (e) => {
        const ev = e;
        for (const im of document.querySelectorAll(".vt-carry"))
            im.classList.remove("vt-carry");
        const to = ev.activation?.entry?.url;
        if (!ev.viewTransition || !to)
            return;
        for (const a of document.querySelectorAll(".home-ready-chip"))
            if (a.href === to)
                a.querySelector("img")?.classList.add("vt-carry");
    });
}
function homePhotoInto(img, seasonId, name) {
    const plot = app.currentPlotId;
    const key = `${plot}:${seasonId}:${name}`;
    const hit = _homePhotoUrls.get(key);
    if (hit) {
        img.src = hit;
        return;
    }
    void openLog().then((db) => getPhoto(db, plot, seasonId, name)).then((b) => {
        if (!b)
            return;
        const url = URL.createObjectURL(b);
        _homePhotoUrls.set(key, url);
        img.src = url;
    }).catch(() => { });
}
function askBand(ask) {
    const band = el("div", "home-band");
    const btn = el("button", "btn btn-primary home-act", ask.label);
    btn.type = "button";
    btn.addEventListener("click", ask.run);
    band.append(el("p", "k", ask.kicker), el("p", "q", ask.q), el("p", "why", ask.why), btn);
    return band;
}
function picFigure(pic) {
    const fig = el("figure", `home-pic ${pic.kind}`);
    if (pic.species)
        fig.dataset.species = pic.species;
    const frame = el("div", "home-pic-frame");
    if (pic.src) {
        const im = el("img", "home-pic-img");
        im.src = pic.src;
        im.alt = pic.alt;
        im.width = 800;
        im.height = 600;
        im.decoding = "async";
        if (pic.kind === "stock")
            im.onerror = () => fig.remove();
        frame.append(im);
    }
    fig.append(frame);
    if (pic.caption) {
        const cap = el("figcaption", "home-pic-cap", pic.caption);
        if (pic.credit) {
            const credit = creditInto(el("a", "home-pic-credit"), "pnPhotoCredit", pic.credit);
            credit.setAttribute("href", `../credits/${pic.species ? "#" + pic.species : ""}`);
            cap.append(" ", credit);
        }
        fig.append(cap);
    }
    return fig;
}
function yearHost(y) {
    const host = el("div", "home-yearfig");
    drawYearInto(host, () => yearFigure({ place: y.at.place, lat: y.at.lat, crops: y.crops, counts: y.counts, pick: true, todayIso: y.today,
        season: y.at.season, last: y.last ? { days: y.last } : null, aria: y.aria, twin: y.twin, src: y.at.source, band: true }), `home:${app.currentPlotId}`);
    return host;
}
const HC_PHONE = 8, HC_DESK = 12;
function chartSection(ch) {
    const sec = el("section", "home-chart");
    sec.setAttribute("aria-labelledby", "homechart-h");
    const h = el("h2", "hc-h", copy.hcTitle);
    h.id = "homechart-h";
    sec.append(h);
    const body = el("div", "hc-body");
    for (const g of ch.groups) {
        const first = g.rows[0]?.idx ?? 0;
        if (g.bed !== null || ch.groups.length > 1)
            body.append(el("h3", `hc-bed${first >= HC_PHONE ? " hc-past8" : ""}${first >= HC_DESK ? " hc-past12" : ""}`, g.bed ?? copy.hcNoBed));
        for (const r of g.rows) {
            const row = el("p", `hc-row${r.planned ? " hc-isplanned" : ""}${r.past ? " hc-islast" : ""}${r.idx >= HC_PHONE ? " hc-past8" : ""}${r.idx >= HC_DESK ? " hc-past12" : ""}`);
            row.dataset.species = r.species;
            row.dataset.note = r.noteKey;
            if (app.homeFocus === r.species && isExamplePlot(app.currentPlotId)) {
                row.classList.add("hc-focus");
                if (r.idx >= HC_PHONE)
                    sec.classList.add("hc-open");
            }
            row.append(el("span", "hc-name", r.name), " ", el("span", "hc-note", r.note));
            body.append(row);
        }
    }
    sec.append(body);
    const edges = [ch.frost.spring, ch.frost.fall].filter((x) => !!x);
    if (edges.length)
        sec.append(el("p", "hc-line hc-frostline", edges.reduce((a, b) => `${a}${/[.!?]$/.test(a) ? " " : " · "}${b}`)));
    if (ch.frost.note)
        sec.append(el("p", "hc-line hc-frostline", ch.frost.note));
    if (ch.resting)
        sec.append(el("p", "hc-line hc-resting", ch.resting));
    if (ch.total > HC_PHONE) {
        const all = el("button", `home-notedoor hc-all${ch.total > HC_DESK ? "" : " hc-phoneonly"}`, fillCopy("hcShowAll", { n: ch.total }));
        all.type = "button";
        all.addEventListener("click", () => { sec.classList.add("hc-open"); all.hidden = true; });
        all.hidden = sec.classList.contains("hc-open");
        sec.append(all);
    }
    return sec;
}
function exampleTrail() {
    const home = document.getElementById("homereturn");
    if (!home || home.hidden)
        return;
    let host = home.querySelector(":scope > .home-trail");
    if (!host) {
        host = el("div", "home-trail");
        home.append(host);
    }
    const target = host;
    const draw = () => {
        const view = chunkReady("trail");
        if (view && target.isConnected && isExamplePlot(app.currentPlotId))
            view.drawTrail(target, "examplehome", {});
    };
    if (chunkReady("trail"))
        draw();
    else
        void loadChunk("trail").then(draw, () => { target.remove(); });
}
function renderHome(view) {
    const host = document.getElementById("homereturn");
    if (!host)
        return false;
    const something = !!(view.dateline || view.ask || view.gardens.length || view.feed || view.recollections.length || view.fetching);
    host.hidden = !something;
    if (!something)
        host.replaceChildren();
    if (something || homeSettled())
        document.body.classList.toggle("home-returning", something);
    if (!something)
        return false;
    host.replaceChildren();
    const unfitEl = () => {
        const go = el("button", "btn btn-quiet linky home-unfit-go", copy.hnOpenPlan);
        go.type = "button";
        go.addEventListener("click", view.onPlan);
        const uf = unfitSeed(view.unfit, go);
        uf.classList.add("home-unfit");
        return uf;
    };
    if (view.dateline) {
        const dl = el("header", "home-dateline");
        const k = el("p", "home-dl-date", view.dateline.date);
        const n = el("h1", "home-dl-name");
        n.innerHTML = '<svg class="hmark" aria-hidden="true"><use href="#triad"/></svg>';
        const garden = el("span", `home-dl-garden${view.dateline.garden.length > 22 ? " long" : ""}`, view.dateline.garden);
        if (view.dateline.season)
            fillNodes(n, view.dateline.place ? copy.hnTitleAt : copy.hnTitle, { garden, season: el("em", "home-dl-season", view.dateline.season), ...(view.dateline.place ? { place: document.createTextNode(view.dateline.place) } : {}) });
        else
            n.append(garden);
        dl.append(k, n);
        host.append(dl);
    }
    if (view.gardens.length) {
        const line = el("p", "home-also");
        const doors = el("span", "home-also-list");
        line.append(el("span", "home-also-k", copy.hnAlsoK), doors);
        for (const g of view.gardens) {
            const b = el("button", "home-also-g");
            b.type = "button";
            b.dataset.plot = g.id;
            b.append(el("span", "n", g.season ? fillCopy("hnAlsoSeason", { garden: g.name, season: g.season }) : g.name));
            const bits = [g.ready ? fillCopy("hnAlsoReady", { n: g.ready }) : "", g.news ? pluralCopy("hfGardenNews", g.news) : ""].filter(Boolean);
            if (bits.length)
                b.append(el("span", "s", fillCopy("hnAlsoWhat", { what: bits.join(", ") })));
            b.append(document.createTextNode("\u00a0›"));
            b.addEventListener("click", () => view.onGarden(g.id));
            doors.append(b);
        }
        host.append(line);
    }
    if (view.fetching) {
        const f = el("p", `home-fetching${view.fetching === "failed" ? " failed" : ""}`, view.fetching === "failed" ? copy.hnFetchFailed : copy.hnFetching);
        f.setAttribute("role", "status");
        host.append(f);
    }
    if (view.welcome) {
        const w = el("div", "home-welcome");
        w.append(el("p", "h", view.welcome.head));
        if (view.welcome.detail)
            w.append(el("p", "d", view.welcome.detail));
        host.append(w);
    }
    if (view.season?.soon)
        host.append(seasonRib(view.season, "home-season home-season-lead"));
    if (!view.spread) {
        if (view.placeYear) {
            const band = el("section", "home-year aband");
            band.setAttribute("aria-label", copy.hnBandAria);
            band.append(yearHost(view.placeYear));
            host.append(band);
        }
        if (view.ask)
            host.append(askBand(view.ask));
        else if (view.firstBed) {
            const a = el("a", "home-firstbed", copy.hnFirstBed);
            a.href = "#/plan";
            const run = view.firstBed;
            a.addEventListener("click", (e) => { e.preventDefault(); run(); });
            host.append(a);
        }
    }
    if (view.spread) {
        const sp = view.spread;
        const band = el("section", "home-year aband");
        band.setAttribute("aria-label", copy.hnBandAria);
        const yearLeads = !!sp.year && sp.year.crops.length > 0;
        if (sp.year && yearLeads)
            band.append(yearHost(sp.year));
        const note = el("div", "home-note");
        note.append(el("h2", "home-note-h", copy.hnNoteH));
        if (sp.note.length) {
            const p = el("p", "home-note-text");
            sp.note.forEach((l, i) => {
                const s = el("span", "home-note-line", l.text);
                s.dataset.key = String(l.key);
                if (i)
                    p.append(" ");
                p.append(s);
            });
            note.append(p);
        }
        if (sp.door?.kind === "nextseason") {
            const b = el("button", "home-nextseason home-notedoor", `${fillCopy("hmNextSeason", { year: sp.door.year })} ›`);
            b.type = "button";
            b.addEventListener("click", sp.door.run);
            note.append(b);
        }
        else if (sp.door?.kind === "mode") {
            note.append(seasonActionLink(sp.door));
        }
        band.append(note);
        const acts = el("div", "home-acts");
        if (sp.harvest) {
            const h = el("button", "btn btn-primary home-harvest", copy.hnLogHarvest);
            h.type = "button";
            h.addEventListener("click", sp.harvest);
            acts.append(h);
        }
        const open = el("button", `btn ${sp.harvest || view.ask ? "btn-secondary" : "btn-primary"} home-open`, copy.hnOpenPlan);
        open.type = "button";
        open.id = "homeopen";
        open.addEventListener("click", view.onPlan);
        acts.append(open);
        band.append(acts);
        if (sp.year && !yearLeads)
            band.append(yearHost(sp.year));
        host.append(band);
        const spread = el("section", sp.pic ? "home-spread" : "home-spread nopic");
        if (sp.pic)
            spread.append(picFigure(sp.pic));
        const side = el("div", "home-side");
        if (sp.ready.chips.length) {
            const row = el("div", "home-ready");
            row.append(el("span", "home-ready-k", copy.hnReadyK));
            for (const c of sp.ready.chips) {
                const a = el("a", "chip home-ready-chip");
                a.href = c.href;
                a.dataset.species = c.species;
                if (c.thumb) {
                    const im = el("img", "home-ready-img");
                    im.src = c.thumb;
                    im.alt = "";
                    im.width = 56;
                    im.height = 56;
                    im.loading = "lazy";
                    im.decoding = "async";
                    im.onerror = () => im.remove();
                    a.append(im);
                }
                a.append(el("span", "home-ready-name", c.bed ? fillCopy("hnReadyChipBed", { crop: c.name, bed: c.bed }) : c.name));
                row.append(a);
            }
            if (sp.ready.more > 0) {
                const more = el("button", "btn btn-quiet home-ready-more", fillCopy("hnReadyMoreLink", { n: sp.ready.more }));
                more.type = "button";
                more.addEventListener("click", sp.onReadyMore);
                row.append(more);
            }
            side.append(row);
            const seen = new Set();
            const credits = sp.ready.chips.map((c) => (c.thumb ? c.credit : null))
                .filter((c) => !!c && !seen.has(JSON.stringify(c)) && !!seen.add(JSON.stringify(c)));
            if (credits.length) {
                const list = el("span");
                credits.forEach((c, i) => list.append(...(i ? ["; "] : []), creditInto(el("span"), "hnChipCredit", c)));
                const cr = el("p", "home-ready-credit");
                fillNodes(cr, copy.hnChipCredits, { list });
                side.append(cr);
            }
            carryPlates();
        }
        if (view.ask)
            side.append(askBand(view.ask));
        else if (view.thisWeek) {
            const wk = el("section", "home-week");
            wk.append(el("p", "home-week-k", copy.hnJobK));
            if (view.thisWeek.heads)
                wk.append(el("p", "home-week-h", view.thisWeek.heads));
            if (view.thisWeek.title)
                wk.append(el("p", "home-week-t", view.thisWeek.title));
            if (view.thisWeek.detail)
                wk.append(el("p", "home-week-d", view.thisWeek.detail));
            if (view.thisWeek.lines?.length) {
                const ul = el("ul", "home-week-glance");
                for (const l of view.thisWeek.lines)
                    ul.append(el("li", `glance-${l.kind}`, l.text));
                wk.append(ul);
            }
            const b = el("button", "home-weeklink", view.thisWeek.link);
            b.type = "button";
            b.addEventListener("click", view.onWeek);
            wk.append(b);
            side.append(wk);
        }
        if (view.unfit.length && !view.chart)
            side.append(unfitEl());
        if (side.childElementCount)
            spread.append(side);
        if (spread.childElementCount)
            host.append(spread);
    }
    if (view.forecast)
        host.append(view.forecast);
    if (view.chart) {
        const ch = chartSection(view.chart);
        if (view.unfit.length) {
            const all = ch.querySelector(".hc-all");
            if (all)
                all.before(unfitEl());
            else
                ch.append(unfitEl());
        }
        host.append(ch);
    }
    if (view.startHere) {
        if (view.growsHref) {
            const g = el("div", "home-grows");
            const a = el("a", "btn btn-secondary home-grows-cta", copy.homeGrowsCta);
            a.href = view.growsHref;
            g.append(a, el("p", "home-grows-lede", copy.homeGrowsLede));
            host.append(g);
        }
        const onScreen = view.questions.map((q) => q.guide).filter((g) => !!g);
        const { shown, total, rest } = shelfGuides(START_SHELF, HOME_START_CARDS, [...onScreen, ...view.startSkip]);
        if (shown.length) {
            const sec = el("section", "home-start");
            sec.id = "homestart";
            const anchor = shelfAnchor(START_SHELF);
            sec.append(el("h2", "home-start-h", copy.homeStartTitle), el("p", "home-start-lede", copy.homeStartLede), guideShelf(shown, rest > 0
                ? { href: `../guides/${anchor ? "#" + anchor : ""}`, label: copy.homeStartAll.replace("{n}", String(total)) }
                : undefined, copy.homeStartTitle));
            host.append(sec);
        }
    }
    const quiet = el("section", "home-quiet");
    if (view.season && !view.season.soon)
        quiet.append(seasonRib(view.season, "home-season"));
    if (view.recollections.length) {
        const band = el("div", "onthisday");
        band.append(el("h2", "onthisday-h", view.recollections.every((r) => r.yearsAgo === 1) ? copy.hmYearAgo : copy.hmSeasonsPast));
        if (view.recollectionsIn)
            band.append(el("p", "hint onthisday-in", fillCopy("hmRecIn", { garden: view.recollectionsIn })));
        const ul = el("ul", "onthisday-list");
        for (const rec of view.recollections) {
            const li = el("li", "onthisday-item");
            li.append(el("span", "onthisday-line", rec.line));
            if (rec.photo) {
                const img = el("img", "photothumb onthisday-photo");
                img.loading = "lazy";
                img.alt = "";
                homePhotoInto(img, rec.seasonId, rec.photo);
                li.append(img);
            }
            ul.append(li);
        }
        band.append(ul);
        quiet.append(band);
    }
    if (view.functions.length) {
        const box = el("div", "home-fns");
        box.append(el("h2", "home-fns-h", copy.hmDoorsH));
        for (const f of view.functions) {
            const sep = el("span", "home-fn-sep", "\u00b7");
            sep.setAttribute("aria-hidden", "true");
            box.append(sep);
            const a = el("a", "home-fn");
            a.href = `#/${f.route}`;
            a.dataset.fn = f.route;
            a.append(el("span", "n", `${f.name} ›`), " ", el("span", "v", f.value));
            a.addEventListener("click", (e) => { e.preventDefault(); view.onFunction(f.route); });
            box.append(a);
        }
        quiet.append(box);
    }
    if (view.feed?.post) {
        const fd = el("section", "home-feed");
        const h = el("p", "home-feed-h");
        const all = el("a", "home-feed-all", view.feed.count > 1 ? fillCopy("hfFeedAllNew", { n: view.feed.count }) : copy.hfFeedAll);
        all.href = "#";
        all.addEventListener("click", (e) => { e.preventDefault(); view.onFeed(); });
        h.append(el("span", undefined, view.feed.team ? fillCopy("hmFromTeam", { team: view.feed.team }) : copy.hmFromYourTeam), all);
        const who = el("p", "home-feed-who");
        who.append(el("b", undefined, view.feed.post.author || copy.hfFeedSomeone), el("span", "home-feed-when", ` · ${feedTime(view.feed.post.at)}`));
        fd.append(h, who, postBody(view.feed.post.body, "home-feed-body"));
        quiet.append(fd);
    }
    if (view.questions.length) {
        const asks = el("div", "home-asks");
        const lead = view.questions[0]?.about;
        const promote = lead === "garden" ? view.questions[0] : null;
        if (promote)
            asks.appendChild(promotedAsk(promote));
        const rows = [];
        for (const q of promote ? view.questions.slice(1) : view.questions) {
            const row = el("div", "askq-row");
            const a = el("a", "home-askq");
            a.href = q.href;
            a.dataset.q = q.id;
            wireWhy(a);
            const stack = el("span");
            stack.append(el("span", "qq", q.q));
            if (q.hint)
                stack.append(el("span", "qh", q.hint));
            a.append(stack, el("span", "qgo", "›"));
            row.append(a);
            if (q.guide) {
                const g = el("a", "askq-guide", fillCopy("hfGuideLink", { label: GUIDE_LABEL[q.guide] ?? guideBySlug(q.guide)?.title ?? copy.hfGuideReadMore }));
                g.href = `../guides/${q.guide}/`;
                row.append(g);
            }
            rows.push(row);
        }
        const more = promote ? rows : rows.slice(1);
        if (!promote && rows.length)
            asks.append(rows[0]);
        if (more.length)
            asks.append(seed({ summary: copy.hmMoreWeek, cls: "home-more" }, ...more));
        quiet.append(asks);
    }
    if (view.spread) {
        const ask = (cls, qText, answers, pick) => {
            const q = el("div", cls);
            q.append(el("p", "home-pace-q", qText));
            for (const [v, label, attr] of answers) {
                const b = el("button", "chip home-pace-a", label);
                b.type = "button";
                b.setAttribute(attr, v);
                b.addEventListener("click", () => pick(v));
                q.append(b);
            }
            quiet.append(q);
        };
        if (view.pace === null) {
            ask("home-pace", copy.homePaceQ, [["full", copy.homePaceFull, "data-pace"], ["light", copy.homePaceLight, "data-pace"]], (v) => view.onPace(v));
        }
        else if (view.space === null) {
            ask("home-spine home-space", copy.homeSpaceQ, [["ground", copy.homeSpaceGround, "data-answer"], ["raised", copy.homeSpaceRaised, "data-answer"],
                ["pots", copy.homeSpacePots, "data-answer"], ["changing", copy.homeSpaceChanging, "data-answer"]], (v) => view.onSpace(v));
        }
        else if (view.after === null) {
            ask("home-spine home-after", copy.homeAfterQ, [["food", copy.homeAfterFood, "data-answer"], ["pollinators", copy.homeAfterPollinators, "data-answer"],
                ["kids", copy.homeAfterKids, "data-answer"], ["little", copy.homeAfterLittle, "data-answer"]], (v) => view.onAfter(v));
        }
        else if (view.after === "food" && view.household === null) {
            const q = el("div", "home-house");
            const num = (label, id, val) => {
                const l = el("label", "home-house-n");
                const i = el("input");
                i.type = "number";
                i.min = "0";
                i.max = "30";
                i.step = "1";
                i.value = String(val);
                i.id = id;
                l.append(document.createTextNode(`${label} `), i);
                return [l, i];
            };
            const [al, ai] = num(copy.homeHouseAdults, "househadults", 2);
            const [cl, ci] = num(copy.homeHouseChildren, "househchildren", 0);
            const yes = el("button", "chip home-pace-a", copy.homeHouseYes);
            yes.type = "button";
            yes.dataset.house = "food";
            const no = el("button", "chip home-pace-a", copy.homeHouseNo);
            no.type = "button";
            no.dataset.house = "none";
            yes.addEventListener("click", () => {
                const adults = Math.max(0, Math.min(30, Math.round(Number(ai.value) || 0)));
                const children = Math.max(0, Math.min(30, Math.round(Number(ci.value) || 0)));
                if (adults + children >= 1)
                    view.onHousehold({ adults, children });
            });
            no.addEventListener("click", () => view.onHousehold("none"));
            q.append(el("p", "home-pace-q", copy.homeHouseQ), al, cl, yes, no);
            quiet.append(q);
        }
        if (view.after === "kids" && view.quick)
            quiet.append(el("p", "home-growing home-quick", view.quick));
    }
    if (quiet.childElementCount)
        host.append(quiet);
    return true;
}
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function seasonActionLink(sm) {
    const m = document.createElement("a");
    m.className = "home-seasonmode home-smlink";
    m.href = "#/" + sm.route;
    const act = document.createElement("span");
    act.className = "home-smact";
    act.textContent = `${sm.action}\u00a0›`;
    m.append(act);
    return m;
}
function nothingGrowing() {
    const s = openSeason();
    return !(s?.plantings ?? []).some((p) => !p.end_cause);
}
function everyBedPlanted() {
    const beds = app.logSnapshot.beds;
    const live = (openSeason()?.plantings ?? []).filter((p) => !p.end_cause);
    return beds.length > 0 && beds.every((b) => live.some((p) => plantingOnBed(p.region, b.region)));
}
function plannedNotPlanted() {
    const beds = app.logSnapshot.beds;
    const season = openSeason();
    const plan = (Array.isArray(season?.plan) ? season.plan : []);
    const live = (season?.plantings ?? []).filter((p) => !p.end_cause);
    const planned = (b) => plan.some((e) => e.area === b.name && (e.guild || e.mybed === true));
    const growing = (b) => live.some((p) => plantingOnBed(p.region, b.region));
    return beds.length > 0 && beds.every((b) => planned(b) || growing(b)) && beds.some((b) => planned(b) && !growing(b));
}
function seasonRib(season, cls) {
    const rib = el("div", cls);
    const door = (a) => { a.href = season.href; wireWhy(a); return a; };
    const when = el(season.grade ? "span" : "a", "home-swhen", season.when);
    if (!season.grade)
        door(when);
    const txt = el("span", "home-stxt");
    const word = copy.hfRibFrostWord;
    const at = season.text.indexOf(word);
    if (at >= 0)
        txt.append(season.text.slice(0, at), glossTerm("firstFrost", word), season.text.slice(at + word.length));
    else
        txt.textContent = season.text;
    rib.append(when, txt);
    if (season.grade)
        rib.append(door(el("a", `grade home-sgrade ${gradeClassOfWord(season.grade)}`.trim(), season.grade)));
    return rib;
}
const SEASON_ACT = {
    spring: { action: copy.hmActSpring, route: "plan" },
    summer: { action: copy.hmActSummer, route: "log" },
    autumn: { action: copy.hmActAutumn, route: "log" },
    winter: { action: copy.hmActWinter, route: "plan" },
};
const SEASON_ACT_AT = {
    spring: "hmActSpringAt", summer: "hmActSummerAt", autumn: "hmActAutumnAt", winter: "hmActWinterAt",
};
function homeSeasonMode() {
    if (!hasGround())
        return null;
    const key = document.documentElement.dataset.season ?? "autumn";
    const s = seasonOf(key);
    const empty = (key === "summer" || key === "autumn") && nothingGrowing();
    const seasonal = key === "spring" && everyBedPlanted() ? "summer" : key;
    const place = isExamplePlot(app.currentPlotId) ? exampleElsewhere() : null;
    const act = plannedNotPlanted() ? { action: copy.hmActThisWeek, route: "calendar" }
        : empty ? { action: copy.hmActNothingGrowing, route: "plan" }
            : place && SEASON_ACT_AT[seasonal] && SEASON_ACT[seasonal] ? { action: fillCopy(SEASON_ACT_AT[seasonal], { place }), route: SEASON_ACT[seasonal].route }
                : SEASON_ACT[seasonal];
    if (!s || !act)
        return null;
    return { name: s.name, verb: s.verb, action: act.action, route: act.route };
}
function fetchingState() {
    if (!isSignedIn() || hasGround() || app.pull === "none" || isExamplePlot(app.currentPlotId))
        return null;
    try {
        if (localStorage.getItem("gg-sync-last"))
            return null;
    }
    catch {
        return null;
    }
    return app.pull === "failed" ? "failed" : "waiting";
}
function bareGap(ask) {
    if (ask.key !== "reality-gap" || !ask.go.bed)
        return false;
    const bed = app.logSnapshot.beds.find((b) => b.name === ask.go.bed);
    const live = (openSeason()?.plantings ?? []).filter((p) => !p.end_cause);
    return !!bed && !live.some((p) => plantingOnBed(p.region, bed.region));
}
function signedInEmptyAsk() {
    if (!isSignedIn() || hasGround() || isExamplePlot(app.currentPlotId) || fetchingState())
        return null;
    try {
        if (document.body.classList.contains("editing"))
            return null;
    }
    catch { }
    return { kicker: gardenNameNow() ?? copy.hmYourGarden, q: copy.hmAskEmptyQ, why: copy.hmAskEmptyWhy, label: copy.hmAskEmptyBtn,
        run: () => { go("plan"); const g = document.getElementById("sec-ground"); if (g)
            g.open = true; } };
}
function betweenSeasonsAsk(t, lat, freezeMmdd) {
    if (!hasGround() || seasonId() != null || isExamplePlot(app.currentPlotId))
        return null;
    try {
        if (document.body.classList.contains("editing"))
            return null;
    }
    catch { }
    const closed = app.logSnapshot.seasons.filter((s) => s.closed_date);
    if (!closed.length)
        return null;
    const lastYear = Math.max(...closed.map((s) => s.id));
    const nextYear = comingSeasonAfter(lastYear, t, lat, freezeMmdd);
    return { kicker: copy.hmAskClosedK, q: fillCopy("hmAskClosedQ", { next: nextYear }),
        why: fillCopy("hmAskClosedWhy", { next: nextYear }), label: fillCopy("hmAskClosedBtn", { next: nextYear }),
        run: () => { void (async () => { await app.startNextSeason?.(nextYear); go("plan"); })(); } };
}
function gardenNameNow() {
    const n = app.currentPlot?.name;
    return typeof n === "string" && n.trim() ? gardenShownName(n, app.currentPlot?.shared) : null;
}
function familyOf(bundle, sid) {
    const sp = bundle.species.find((x) => x.id === sid);
    return sp?.family ?? null;
}
function liveFunctions(todayIso, tasks, bundle, coming = [], off = null) {
    const out = [];
    const owed = owedFor(tasks), owedNext = owedFor(coming);
    const ahead = (x) => typeof x.date === "string" && x.date > todayIso && !isMarker(x) && category(x) !== "harvest";
    const next = [...tasks.filter((x) => ahead(x) && owed(x)), ...coming.filter((x) => ahead(x) && !!x.guildName && owedNext(x))]
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    const wk = weekJobs(tasks, todayIso);
    const lateTxt = [wk.overdue ? pluralCopy("hfFnLate", wk.overdue) : "", wk.closed ? pluralCopy("homeWeekClosed", wk.closed) : ""].filter(Boolean).join(" · ");
    if (next?.date)
        out.push({ name: copy.navCalendar, route: "calendar", value: [lateTxt,
                fillCopy("hfFnNext", { when: whenLabel(todayIso, next.date), what: jobTitle(taskSentence(next, bundle), next) })].filter(Boolean).join(" · ") });
    else if (lateTxt)
        out.push({ name: copy.navCalendar, value: lateTxt, route: "calendar" });
    const openSeason$1 = openSeason();
    const planted = (openSeason$1?.plantings ?? []).length;
    if (planted)
        out.push({ name: copy.navLog, value: pluralCopy("hfFnPlantings", planted), route: "log" });
    const past = priorSeasons();
    if (past.length || off) {
        const newest = Math.max(...past.map((sn) => sn.id), off?.last ?? -Infinity);
        out.push({ name: copy.hfFnReview, value: fillCopy("hfFnSeason", { year: newest }), route: "review" });
    }
    return out;
}
const isoAddDays = (iso, days) => {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let postsCache = null;
let fetchingPlot = null;
function cachedPosts(plot) {
    if (postsCache && postsCache.plot === plot)
        return postsCache.posts;
    if (fetchingPlot !== plot && app.logDb) {
        fetchingPlot = plot;
        listPosts(app.logDb, plot).then((posts) => {
            if (fetchingPlot !== plot)
                return;
            postsCache = { plot, posts: posts.filter((p) => !p.deleted) };
            fetchingPlot = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingPlot === plot)
            fetchingPlot = null; });
    }
    return [];
}
let newsCache = null;
let fetchingNews = null;
function cachedGardenNews(plotIds, gapStart, myEmail) {
    const key = `${plotIds.join(",")}|${gapStart}|${myEmail ?? ""}`;
    if (newsCache && newsCache.key === key)
        return newsCache.counts;
    if (fetchingNews !== key && app.logDb) {
        fetchingNews = key;
        const db = app.logDb;
        Promise.all(plotIds.map((pid) => listPosts(db, pid).then((posts) => [pid, posts.filter((p) => !p.deleted && p.author && p.author !== myEmail && p.at > gapStart).length])))
            .then((entries) => {
            if (fetchingNews !== key)
                return;
            newsCache = { key, counts: new Map(entries) };
            fetchingNews = null;
            app.homeRefresh?.();
        }).catch(() => { if (fetchingNews === key)
            fetchingNews = null; });
    }
    return new Map();
}
function invalidateHomePosts() {
    postsCache = null;
    fetchingPlot = null;
    newsCache = null;
    fetchingNews = null;
}
let frostMemo = null;
function memoFrost(lat, lon, bundle, seasons) {
    const epoch = bundle._zipEpoch ?? 0;
    const own = ownFrostAt(lat, lon);
    if (frostMemo && frostMemo.lat === lat && frostMemo.lon === lon && frostMemo.epoch === epoch && frostMemo.seasons === seasons && frostMemo.own === own)
        return frostMemo.fr;
    const fr = gardenFrost(bundle, lat, lon, seasons);
    frostMemo = { lat, lon, epoch, seasons, own, fr };
    return fr;
}
const _picUrls = new Map();
const PIC_TRIES = 12;
function ownPicUrl(plot, seasonId, name) {
    const key = `${plot}:${seasonId}:${name}`;
    const hit = _picUrls.get(key);
    if (hit === "pending")
        return null;
    if (hit)
        return hit;
    _picUrls.set(key, "pending");
    const done = (v) => { _picUrls.set(key, v); app.homeRefresh?.(); };
    void openLog().then((db) => getPhoto(db, plot, seasonId, name))
        .then((b) => done(b ? URL.createObjectURL(b) : "missing"), () => done("missing"));
    return null;
}
let windowsMemo = null;
let alsoMemo = { who: "", list: [] };
const otherFrosts = new Map();
function frostOfGarden(bundle, g) {
    if (g.lat == null || g.lon == null)
        return null;
    if (g.plotId === app.currentPlotId)
        return memoFrost(g.lat, g.lon, bundle, g.seasons);
    const epoch = bundle._zipEpoch ?? 0;
    const m = otherFrosts.get(g.plotId);
    const own = ownFrostAt(g.lat, g.lon);
    if (m && m.lat === g.lat && m.lon === g.lon && m.epoch === epoch && m.seasons === g.seasons && m.own === own)
        return m.fr;
    const fr = gardenFrost(bundle, g.lat, g.lon, g.seasons);
    otherFrosts.set(g.plotId, { lat: g.lat, lon: g.lon, epoch, seasons: g.seasons, own, fr });
    return fr;
}
function gardensAll(bundle, t, liveHere, who) {
    const complete = allGardenSeasons() !== null;
    if (!complete && alsoMemo.who === who && alsoMemo.list.length > 1)
        return alsoMemo.list;
    const spOf = (id) => bundle.species.find((x) => x.id === id);
    const out = gardensNow().map((g) => {
        const live = g.plotId === app.currentPlotId ? liveHere
            : (g.seasons.find((x) => x.id === g.seasonId)?.plantings ?? [])
                .filter((p) => { const at = p.transplanted || p.sown; return !p.end_date && !p.end_cause && !!at && at <= t; });
        const freeze = windowFreeze(frostOfGarden(bundle, g), g.lat, bundle);
        const ready = cropWindows(live, t, (p) => plantingWindow(p, spOf(p.species), freeze), () => null, (p) => p.species).ready.length;
        return { id: g.plotId, name: g.name, ready, news: 0, season: seasonWord(t, g.lat) };
    });
    if (complete)
        alsoMemo = { who, list: out };
    return out;
}
let chartMemo = null;
function homeYearNow(bundle, t, lat, fr) {
    const at = yearPlace(fr, app.currentPlotId, lat);
    if (!at)
        return null;
    const ctx = currentGardenCtx();
    const year = seasonYearOf(t, lat);
    const sowings = gardenSowings(bundle, ctx, t, fr);
    const garden = gardenNameNow() ?? copy.hmYourGarden;
    return { at, year, crops: ringLines(sowings, lat, year), counts: plantCounts(sowings, lat, year), last: lastYearDays(bundle, ctx, year),
        twin: yearTwin(at, sowings, lat, year), aria: fillCopy("hnYearAria", { garden, year: seasonLabel(year, lat) }), today: t };
}
const bedsLocator = (() => {
    let memo = null;
    return (beds) => {
        if (memo?.beds !== beds)
            memo = { beds, f: bedLocator(beds) };
        return memo.f;
    };
})();
function seasonChartNow(bundle, t, lat, live, bedOf, bedNames, plan, fr, said) {
    const spOf = (id) => bundle.species.find((x) => x.id === id);
    const yr = seasonYearOf(t, lat);
    const tasks = oneWarmWindow((isSouthern(lat) ? [yr, yr + 1] : [yr]).flatMap((y) => gardenWideTasks(bundle, y)));
    const sowings = calendarSowings({ todayIso: t, live, tasks, owed: owedFor(tasks), bedOf: (p) => bedOf(p.region),
        nameOf: (sid, group) => plantingLabel(bundle, sid, group), windowOf: (p) => plantingWindow(p, spOf(p.species), windowFreeze(fr, lat, bundle)) });
    const occupied = new Set([...sowings.map((x) => x.bed), ...plan.map((e) => e.area)].filter((b) => !!b));
    return chartModel({ todayIso: t, lat, sowings, beds: bedNames, occupied, said, frost: chartFrost(fr),
        focus: isExamplePlot(app.currentPlotId) ? app.homeFocus : null });
}
const chartFrost = (fr) => {
    const lf = fr?.site?.last_frost_32f;
    const rare = !!fr?.rare && !frostGiven(fr.site);
    return fr?.site ? { last: fr.lastFrost, odds: !fr.springOwn && lf?.p50 && lf?.p10 ? { p50: lf.p50, p10: lf.p10 } : null,
        freeze: fr.firstFreeze ?? givenFirstFrost(fr.site), own: fr.springOwn, rare, some: rare ? frostSomeWinters(fr.site) : null,
        word: rare ? frostWord(fr.site) : null } : null;
};
function seasonChartOff(bundle, t, lat, last, off, coming, bedOf, bedNames, fr, said) {
    const spOf = (id) => bundle.species.find((x) => x.id === id);
    const past = (last.plantings ?? []).filter((p) => !!(p.transplanted || p.sown)).map((p) => ({
        species: p.species, name: plantingLabel(bundle, p.species, p.cultivar_group ?? null), bed: bedOf(p.region), start: (p.transplanted || p.sown),
        window: plantingWindow(p, spOf(p.species), windowFreeze(fr, lat, bundle)), planned: false, past: true, end: p.end_date ?? null
    }));
    const next = calendarSowings({ todayIso: t, live: [], tasks: coming, owed: () => true, bedOf: () => null,
        nameOf: (sid, group) => plantingLabel(bundle, sid, group), windowOf: (p) => plantingWindow(p, spOf(p.species), windowFreeze(fr, lat, bundle)) });
    const sowings = [...past, ...next];
    const occupied = new Set(sowings.map((x) => x.bed).filter((b) => !!b));
    return chartModel({ todayIso: t, lat, sowings, beds: bedNames, occupied, said, frost: chartFrost(fr), off });
}
function comingPlanNames(bundle, last, next) {
    const out = [];
    const drafted = new Set((last.next_plan ?? []).filter((e) => e.year === next).map((e) => e.area));
    const kept = last.closed_date ? [] : (last.plan ?? [])
        .filter((e) => typeof e.area === "string" && !drafted.has(e.area) && app.logSnapshot.beds.some((b) => b.name === e.area && plannedOnly(last, b.region)))
        .map((e) => ({ ...e, year: next }));
    for (const e of [...kept, ...(last.next_plan ?? [])]) {
        if (e.year !== next)
            continue;
        const g = typeof e.guild === "string" ? bundle.guilds.find((x) => x.id === e.guild) : undefined;
        const names = g ? [fillCopy("hnPlanTeam", { team: displayName(g) })] : e.mybed && Array.isArray(e.plantings) ? e.plantings.map((p) => commonName(bundle, p.species)) : [];
        for (const n of names)
            if (!out.includes(n))
                out.push(n);
    }
    return out;
}
let sowMemo = null;
function sowableIds(bundle, lat, lon, t) {
    const key = `${app.currentPlotId}|${lat}|${lon}|${t}|${bundle._zipEpoch ?? 0}`;
    if (sowMemo?.key === key)
        return sowMemo.ids;
    const m = chunkReady("answers");
    if (!m) {
        void loadChunk("answers").then(() => app.homeRefresh?.(), () => { });
        return null;
    }
    const quick = quickCrops(bundle.species, 12).map((c) => c.id);
    const ids = m.sowableNow(quick, lat, lon, t, bundle, 5);
    sowMemo = { key, ids };
    return ids;
}
let plannedSowMemo = null;
function plannedSowable(bundle, lat, lon, t, ids) {
    if (!ids.length)
        return { now: [], known: [] };
    const key = `${app.currentPlotId}|${lat}|${lon}|${t}|${bundle._zipEpoch ?? 0}|${ids.join(",")}`;
    if (plannedSowMemo?.key === key)
        return plannedSowMemo.v;
    const m = chunkReady("answers");
    if (!m) {
        void loadChunk("answers").then(() => app.homeRefresh?.(), () => { });
        return null;
    }
    const known = ids.filter((sid) => m.cropAnswer(sid, lat, lon, t, bundle) != null);
    plannedSowMemo = { key, v: { now: m.sowableNow(known, lat, lon, t, bundle, known.length), known } };
    return plannedSowMemo.v;
}
function corpusImage(bundle, sid, shownName) {
    const img = bundle.species.find((x) => x.id === sid)?.image;
    if (typeof img?.artist !== "string")
        return null;
    if (shownName.toLowerCase() !== commonName(bundle, sid).toLowerCase())
        return null;
    return { artist: img.artist, licence: licenceWord(String(img.licence ?? "")), alt: typeof img.alt === "string" ? img.alt : "" };
}
function renderHomeNow(bundle) {
    const none = () => { };
    const nothing = () => renderHome({ dateline: null, recollections: [], recollectionsIn: null, welcome: null, ask: null, firstBed: null, spread: null, placeYear: null, thisWeek: null, unfit: [], chart: null, forecast: null, onWeek: none,
        pace: "full", onPace: none, household: "none", onHousehold: none, space: "ground", onSpace: none, after: "food", onAfter: none, quick: null,
        gardens: [], questions: [], startHere: false, startSkip: [], growsHref: null, season: null, feed: null, onFeed: none,
        functions: [], onFunction: none, onGarden: none, onPlan: none });
    if (app.viewAs === "stranger")
        return nothing();
    if (!homeSettled() && !hasGround())
        return nothing();
    const t = todayIso();
    const demo = isExamplePlot(app.currentPlotId);
    const ground = hasGround();
    const beds = app.logSnapshot.beds;
    const anchor = app.currentPlot?.anchor ?? null;
    const lat = anchor?.lat ?? null;
    const tasks = ground ? gardenWideTasks(bundle, Number(t.slice(0, 4))) : [];
    const away = demo ? null : daysAway();
    const openSeason$1 = openSeason();
    const indoorBedNames = new Set(beds.filter((b) => b.rain === "indoors").map((b) => b.name));
    const bedAtHome = bedLocator(beds);
    const livePl = ground ? (openSeason$1?.plantings ?? []).filter((p) => { const at = p.transplanted || p.sown; return !p.end_date && !p.end_cause && !!at && at <= t; }) : [];
    const posts = ground && isSignedIn() ? cachedPosts(app.currentPlotId) : [];
    const myEmail = signedInEmail();
    const teamPosts = posts.filter((p) => p.author && p.author !== myEmail);
    const fr = ground && anchor ? memoFrost(anchor.lat, anchor.lon, bundle, app.logSnapshot.seasons) : null;
    const clim = fr?.clim ?? null;
    const site = fr?.site ?? null;
    const rareSaid = !!fr?.rare && !frostGiven(fr.site);
    const elsewhere = demo ? exampleElsewhere() : null;
    const season = ground ? seasonRibbon({
        todayIso: t,
        lastFrostMmdd: fr?.lastFrost ?? null,
        firstFreezeMmdd: fr?.firstFreeze ?? givenFirstFrost(fr?.site) ?? null,
        lastOwn: !!fr?.springOwn || !!fr?.springGiven,
        freezeOwn: !!fr?.fallOwn || !!fr?.fallGiven,
        frostGrade: confidenceWord(clim?.effectiveGrade ?? site?.provenance?.grade),
        lat,
        onionsPresent: (openSeason$1?.plantings ?? []).some((p) => !p.end_date && p.species === "allium_cepa"),
        frostRare: rareSaid,
        frostSome: rareSaid ? frostSomeWinters(fr.site) : null,
        frostModeled: frostDatesModelled(fr?.site) && !fr?.springOwn && !fr?.springGiven && !fr?.fallOwn && !fr?.fallGiven
            && frostPossible(fr.site) !== false,
        frostStation: rareSaid && !fr.springOwn && !fr.fallOwn ? stationRibbonText(fr.site) : null,
        datesStation: datesStationText(fr?.site),
        place: elsewhere,
        warmWaits: !!fr && !fr.rare && placeWarmWaits(fr.site, fr.lastFrost, bundle, lat),
    }) : null;
    const gapStart = away != null && away > 0 ? isoAddDays(t, -away) : null;
    const unseen = gapStart ? teamPosts.filter((p) => p.at > gapStart) : [];
    const feed = unseen.length
        ? { team: null, post: { author: unseen[0].author, at: unseen[0].at, body: unseen[0].body }, count: unseen.length }
        : null;
    const sentence = (task) => taskSentence(task, bundle);
    const facts = homeFacts({
        todayIso: t, daysAway: demo ? null : daysAway(),
        seasons: app.logSnapshot.seasons, seasonId: seasonId(),
        bedCount: beds.length, tasks, sentence,
    });
    const card = ground ? currentAskCard(bundle) : null;
    const a = card?.ask && (isSignedIn() || bareGap(card.ask)) ? card.ask : null;
    const between = a ? null : betweenSeasonsAsk(t, lat, fr?.firstFreeze ?? null);
    const outAsk = a ? null : (signedInEmptyAsk() ?? between);
    const everyGarden = !demo ? gardensAll(bundle, t, livePl, myEmail ?? "") : [];
    const newsCounts = (isSignedIn() && gapStart && everyGarden.length > 1)
        ? cachedGardenNews(everyGarden.map((c) => c.id), gapStart, myEmail)
        : new Map();
    const gardens = alsoYours(everyGarden.map((c) => ({ ...c, news: c.id === app.currentPlotId ? 0 : (newsCounts.get(c.id) ?? 0) })), app.currentPlotId, seasonWord(t, lat));
    const recollections = aYearAgoThisWeek(app.logSnapshot.seasons, t).slice(0, 6).map((r) => ({
        line: recollectionLine(r, r.species ? commonName(bundle, r.species) : ""),
        photo: r.photo, seasonId: r.year, yearsAgo: r.yearsAgo,
    }));
    const ask = a ? { kicker: a.kicker, q: a.q, why: a.why, label: a.go.label, run: () => followAsk(a.go) } : outAsk;
    let spread = null;
    const week = ground ? weekSummary(bundle, t) : null;
    const pace = paceChoice();
    let chart = null;
    let offNow = null, comingNow = [];
    if (ground && beds.length) {
        const locate = bedsLocator(beds);
        const bedOf = (region) => (region ? locate(region) ?? null : null);
        const wkey = `${app.currentPlotId}|${t}|${appLang()}`;
        const windowOfPl = (p) => plantingWindow(p, bundle.species.find((x) => x.id === p.species), windowFreeze(fr, lat, bundle));
        if (!windowsMemo || windowsMemo.snap !== app.logSnapshot || windowsMemo.key !== wkey || windowsMemo.fr !== fr) {
            windowsMemo = { snap: app.logSnapshot, key: wkey, live: livePl.length, fr, w: cropWindows(livePl, t, windowOfPl, (p) => beds.length > 1 ? bedOf(p.region) : null, (p) => plantingLabel(bundle, p.species, p.cultivar_group ?? null)) };
        }
        const w = windowsMemo.w;
        const off = demo ? null : offSeasonOf({ todayIso: t, lat, seasons: app.logSnapshot.seasons, openId: openSeason$1?.id ?? null,
            live: livePl.length, freezeMmdd: fr?.firstFreeze ?? null });
        const lastSeason = off ? seasonById(off.last) : null;
        const coming = off && lastSeason ? comingSeasonTasks(bundle, lastSeason, off.next) : [];
        offNow = off;
        comingNow = coming;
        const ckey = `${wkey}|${bundle._zipEpoch ?? 0}|${isSignedIn() ? 1 : 0}|${off ? `off${off.last}` : ""}|${app.homeFocus ?? ""}`;
        if (!chartMemo || chartMemo.snap !== app.logSnapshot || chartMemo.key !== `${ckey}|${season?.says ?? ""}` || chartMemo.fr !== fr || chartMemo.lat !== lat) {
            const dated = (openSeason$1?.plantings ?? []).filter((p) => !p.end_date && !p.end_cause && !!(p.transplanted || p.sown));
            chartMemo = { snap: app.logSnapshot, key: `${ckey}|${season?.says ?? ""}`, fr, lat, chart: off && lastSeason
                    ? seasonChartOff(bundle, t, lat, lastSeason, off, coming, bedOf, beds.map((b) => b.name), fr, season?.says ?? null)
                    : seasonChartNow(bundle, t, lat, dated, bedOf, beds.map((b) => b.name), (openSeason$1?.plan ?? []), fr, season?.says ?? null),
                year: homeYearNow(bundle, t, lat, fr) };
        }
        chart = chartMemo.chart;
        const owed = owedFor(tasks);
        const weekEnd = isoAddDays(t, 6);
        const nextTask = tasks
            .filter((x) => typeof x.date === "string" && x.date > weekEnd && x.date <= isoAddDays(t, 42) && owed(x) && x.kind !== "succession"
            && (category(x) === "sow" || category(x) === "plant") && (x.species || x.guildName))
            .sort((x, y) => x.date.localeCompare(y.date))[0];
        const next = nextTask
            ? (nextTask.species ? { crop: commonName(bundle, nextTask.species), date: nextTask.date } : { crop: nextTask.guildName, date: nextTask.date, team: true })
            : null;
        const wc = waterCare(waterNow(weekTaskPool(bundle, [currentGardenCtx()], t, false), t));
        const careAll = [...(wc ? [wc] : []), ...growingCare(bundle, openSeason$1?.plantings ?? [], seasonId() ?? Number(t.slice(0, 4)), t, windowOfPl)].slice(0, 2);
        const care = pace === "light" && week?.first ? careAll.slice(0, 1) : careAll;
        const liveSp = new Set(livePl.map((p) => p.species));
        const plannedSp = [...new Set([...(openSeason$1?.plantings ?? []).filter((p) => !p.end_cause && !(p.transplanted || p.sown)), ...app.draftPlantings]
                .map((p) => p.species))].filter((sid) => !liveSp.has(sid));
        const sowIds = !off && livePl.length === 0 && plannedSp.length === 0 && anchor ? sowableIds(bundle, anchor.lat, anchor.lon, t) : [];
        const byJobs = splitPlanned(plannedSp, (sid) => tasks
            .filter((x) => typeof x.date === "string" && (category(x) === "sow" || category(x) === "plant")
            && (x.species === sid || !!x.fits?.some((f) => f.species === sid)))
            .map((x) => {
            const win = taskWindow(x, bundle, t);
            const fit = x.fits?.find((f) => f.species === sid);
            return x.date <= weekEnd && owed(x) && (!win || win.state !== "closed") && (!fit || fit.closeBy >= t);
        }));
        const plannedGroup = new Map([...(openSeason$1?.plantings ?? []), ...app.draftPlantings]
            .map((p) => [p.species, p.cultivar_group ?? null]));
        const dayDated = byJobs.undated.filter((sid) => resolvedField(bundle.species.find((x) => x.id === sid), plannedGroup.get(sid) ?? null, "scheduling_model") === "dtm");
        const sow = !off && livePl.length === 0 && anchor ? plannedSowable(bundle, anchor.lat, anchor.lon, t, dayDated) : { now: [], known: [] };
        const sowsThisWeek = (sid) => tasks.some((x) => x.species === sid && typeof x.date === "string" && category(x) === "sow"
            && x.date >= t && x.date <= weekEnd && !x.setAside && taskWindow(x, bundle, t)?.state !== "closed");
        const nowIds = sow === null ? [] : [...byJobs.now, ...sow.now];
        const laterIds = sow === null ? [] : [...byJobs.later, ...sow.known.filter((sid) => !sow.now.includes(sid))];
        const plannedSplit = sow === null ? null : {
            now: [...nowIds, ...laterIds.filter((sid) => sowsThisWeek(sid) && !nowIds.includes(sid))],
            later: laterIds.filter((sid) => !sowsThisWeek(sid)),
            undated: byJobs.undated.filter((sid) => !sow.known.includes(sid)),
        };
        const comingFirst = coming
            .filter((x) => typeof x.date === "string" && x.date > t && x.kind !== "succession" && (category(x) === "sow" || category(x) === "plant") && (x.species || x.guildName))
            .sort((x, y) => x.date.localeCompare(y.date))[0];
        const noteAll = off && lastSeason ? gardenNote({
            todayIso: t, hasBeds: true, live: 0, windows: w, care: [], sowable: [], planned: [],
            next: comingFirst ? (comingFirst.species ? { crop: commonName(bundle, comingFirst.species), date: comingFirst.date }
                : { crop: comingFirst.guildName, date: comingFirst.date, team: true }) : null,
            off: { ...off, plan: comingPlanNames(bundle, lastSeason, off.next), open: !lastSeason.closed_date,
                grew: [...new Set((lastSeason.plantings ?? []).filter((p) => !!(p.transplanted || p.sown)).map((p) => p.species))].map((sid) => commonName(bundle, sid)) },
        }) : sowIds === null || plannedSplit === null ? [] : gardenNote({
            todayIso: t, hasBeds: true, live: livePl.length, windows: w, next, care,
            sowable: (sowIds ?? []).map((sid) => commonName(bundle, sid)),
            inSeason: !!anchor && (() => { const fr = gardenFrost(bundle, anchor.lat, anchor.lon, app.logSnapshot.seasons); return onWarmthPath(fr.site, fr.springOwn || fr.ownRecord); })(),
            planned: livePl.length ? [] : (plannedSplit.now.length ? plannedSplit.now : plannedSplit.later.length ? [] : plannedSplit.undated)
                .map((sid) => commonName(bundle, sid)),
            plannedLater: livePl.length || plannedSplit.now.length ? [] : plannedSplit.later.map((sid) => commonName(bundle, sid)),
        });
        const note = windowFreeze(fr, lat, bundle)?.none ? noteAll.filter((l) => l.fact?.kind !== "closes") : noteAll;
        const rc = readyChips(w.ready);
        const chips = rc.chips.map((c) => {
            const img = corpusImage(bundle, c.species, c.name);
            return { species: c.species, name: c.name, bed: c.bed,
                thumb: img ? `img/thumbs/${encodeURIComponent(c.species)}.webp` : null,
                href: `../plants/${c.species.replace(/_/g, "-")}/`,
                credit: img ? { crop: c.name, artist: img.artist, licence: img.licence } : null };
        });
        let pic = null;
        let lp = null;
        let own = "missing";
        for (const cand of logPhotos(app.logSnapshot.seasons, t).slice(0, PIC_TRIES)) {
            const u = ownPicUrl(app.currentPlotId, cand.seasonId, cand.name);
            if (u === "missing")
                continue;
            lp = cand;
            own = u;
            break;
        }
        if (lp && own === null)
            pic = { kind: "pending", src: null, alt: "", caption: "" };
        else if (lp && own && own !== "missing") {
            const pl = seasonById(lp.seasonId)?.plantings?.[lp.plantingIndex];
            const bed = beds.length > 1 ? bedOf(pl?.region) : null;
            const date = fmtMonthDay(lp.date);
            pic = { kind: "own", src: own, alt: fillCopy("hnPicAlt", { date }), species: lp.species,
                caption: !lp.text ? fillCopy("hnPicOwnBare", { date }) : bed ? fillCopy("hnPicOwnBed", { date, bed, text: lp.text }) : fillCopy("hnPicOwn", { date, text: lp.text }) };
        }
        else {
            const named = (sid, group) => ({ sid, name: plantingLabel(bundle, sid, group ?? null) });
            const lead = leadCrop(w, livePl);
            const cands = [
                ...(lead ? [named(lead, livePl.find((p) => p.species === lead)?.cultivar_group)] : []),
                ...w.ready.map((r) => ({ sid: r.species, name: r.name })), ...w.soon.map((r) => ({ sid: r.species, name: r.name })),
                ...livePl.map((p) => named(p.species, p.cultivar_group)), ...(sowIds ?? []).map((sid) => named(sid)),
                ...(lastSeason?.plantings ?? []).map((p) => named(p.species, p.cultivar_group)),
                ...coming.filter((x) => x.bed && x.species).map((x) => named(x.species)),
            ];
            for (const c of cands) {
                const img = corpusImage(bundle, c.sid, c.name);
                if (!img)
                    continue;
                pic = { kind: "stock", src: `img/${encodeURIComponent(c.sid)}.webp`, alt: img.alt, species: c.sid,
                    caption: fillCopy("hnPicStock", { crop: midSentence(c.name) }),
                    credit: { artist: img.artist, licence: img.licence } };
                break;
            }
        }
        const nm = northernMonth(Number(t.slice(5, 7)), lat);
        const spOf = new Map(bundle.species.map((s) => [s.id, s]));
        const stays = (p) => !!p.carried_over || (resolvedField(spOf.get(p.species), p.cultivar_group, "lifespan") === "perennial" && !p.end_cause);
        const allStay = (list) => list.length > 0 && list.every(stays);
        const rotation = !demo && openSeason$1 && !openSeason$1.closed_date && openSeason$1.id <= Number(t.slice(0, 4))
            && ((livePl.length > 0 && !allStay(livePl) && (nm >= 6 || nm <= 2)) || (!!off && !allStay(openSeason$1.plantings ?? [])));
        const mode = homeSeasonMode();
        const door = rotation && openSeason$1
            ? { kind: "nextseason", year: seasonAfter(openSeason$1.id, app.logSnapshot.seasons, t, lat, fr?.firstFreeze ?? null),
                run: () => { void loadChunk("plan").then((m) => { m.openNextSeason(); go("plan", "nextseason"); }, () => go("plan", "nextseason")); } }
            : mode && !(outAsk && outAsk === between && mode.route === "plan") ? { kind: "mode", action: mode.action, route: mode.route } : null;
        const first = w.ready[0];
        spread = {
            pic, note, door,
            ready: { chips, more: rc.more },
            onReadyMore: () => { void app.openWeek?.(); },
            harvest: first ? () => { if (first.bed && app.openLogBed)
                app.openLogBed(first.bed, first.species);
            else if (beds.length === 1 && app.openLogBed)
                app.openLogBed(beds[0].name, first.species);
            else
                go("log"); } : null,
            year: chartMemo.year,
        };
    }
    let thisWeek = null;
    const one = week?.firstTask ?? null;
    const same = (x) => !!one && x.kind === one.kind && x.plotId === one.plotId
        && (one.species ? x.species === one.species : x.guildName === one.guildName && x.date === one.date);
    const glance = ground ? weekGlance(one ? tasks.filter((x) => !same(x)) : tasks, { today: t, sentence: (x) => taskSentence(x, bundle), name: (sid) => commonName(bundle, sid) }) : null;
    const heads = glance?.lines.find((x) => x.kind === "lastcall")?.text ?? null;
    const rest = pace === "light" ? [] : (glance?.lines ?? []).filter((x) => x.kind === "sow" || x.kind === "plant" || x.kind === "harvest" || x.kind === "pickend" || x.kind === "tend").slice(0, 2);
    if (week && (week.due || week.late || week.closed)) {
        const n = week.due, l = week.late, c = week.closed;
        const more = n + l - 1;
        if (week.first && (n || l)) {
            thisWeek = { title: week.first, detail: week.firstDetail, heads: heads && !heads.toLowerCase().includes(week.first.toLowerCase()) ? heads : null,
                lines: more > 0 ? rest : [],
                link: pace !== "light" && more > 0 && !rest.length ? pluralCopy("hnJobMore", more) : copy.hnJobSee };
        }
        else {
            const tail = `${l ? `, ${fillCopy("homeWeekOverdue", { n: l })}` : ""}${c ? `, ${pluralCopy("homeWeekClosed", c)}` : ""}`;
            thisWeek = { title: null, detail: null,
                link: n ? fillCopy("homeWeekLabel", { what: `${pluralCopy("homeWeekThings", n)}${tail}` })
                    : l ? fillCopy("homeWeekSee", { what: `${pluralCopy("homeWeekOverdueOnly", l)}${c ? `, ${pluralCopy("homeWeekClosed", c)}` : ""}` })
                        : fillCopy("homeWeekSee", { what: pluralCopy("homeWeekWindows", c) }) };
        }
    }
    const fetching = fetchingState();
    const placed = !ground && !demo && !!anchor && homeSettled();
    const showTitle = ground || !!ask || gardens.length > 0 || !!fetching || placed;
    const drew = renderHome({
        dateline: showTitle ? {
            date: ((s) => s.charAt(0).toUpperCase() + s.slice(1))(new Date().toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" })),
            garden: gardenNameNow() ?? copy.hmYourGarden,
            season: fetching ? null : seasonWord(t, lat, seasonChoice() === "follow" ? null : seasonChoice()),
            place: elsewhere,
        } : null,
        recollections,
        recollectionsIn: gardens.length ? (gardenNameNow() ?? copy.hmYourGarden) : null,
        welcome: ground ? welcomeBack(facts) : null,
        ask,
        firstBed: (ground || placed) && !beds.length && !ask ? () => { go("plan"); const g = document.getElementById("sec-ground"); if (g)
            g.open = true; } : null,
        spread,
        placeYear: !spread && showTitle && !fetching && (ground || placed) && anchor ? homeYearNow(bundle, t, lat, fr ?? gardenFrost(bundle, anchor.lat, anchor.lon, app.logSnapshot.seasons)) : null,
        thisWeek,
        unfit: ground ? unfitPlan(bundle, currentGardenCtx()).map(unfitLine) : [],
        chart,
        forecast: showTitle && anchor && !demo && !fetching ? app.forecastStrip?.("home", { plotId: app.currentPlotId, lat: anchor.lat, lon: anchor.lon,
            watch: { bundle, seasons: app.logSnapshot.seasons, seasonId: seasonId(), beds: app.logSnapshot.beds } }) ?? null : null,
        onWeek: () => { void app.openWeek?.(); },
        pace,
        household: householdChoice(),
        space: spaceChoice(),
        onSpace: (s) => {
            setSpaceChoice(s);
            toast(s === "pots" ? copy.toastSpacePots : s === "changing" ? copy.toastSpaceChanging : copy.toastGotIt);
            void app.pushPrefs?.();
            app.syncPrefControls?.();
            app.homeRefresh?.();
        },
        after: afterChoice() ?? (householdChoice() && householdChoice() !== "none" ? "food" : null),
        onAfter: (v) => {
            setAfterChoice(v);
            if (v === "little")
                setPaceChoice("light");
            toast(v === "pollinators" ? copy.toastAfterPollinators : v === "kids" ? copy.toastAfterKids
                : v === "little" ? copy.toastAfterLittle : copy.toastAfterFood);
            void app.pushPrefs?.();
            app.syncPrefControls?.();
            app.homeRefresh?.();
        },
        quick: (() => {
            const q = quickCrops(bundle.species, 4);
            const quick = q.length ? fillCopy("hmQuick", { list: q.map((c) => fillCopy("hmQuickItem", { name: appLang() === "es" ? commonName(bundle, c.id) : c.name.replace(/^./, (ch) => ch.toUpperCase()), days: c.days })).join(", ") }) : "";
            const big = appLang() === "es"
                ? bundle.species.filter((s) => s.seed_size === "large").map((s) => commonName(bundle, String(s.id))).sort((x, y) => x.localeCompare(y, "es"))
                : bigSeeds(bundle);
            const seeds = big.length ? fillCopy("hmBigSeeds", { list: big.join(", ") }) : "";
            return [quick, seeds].filter(Boolean).join(" ") || null;
        })(),
        onHousehold: (h) => {
            setHousehold(h);
            toast(h === "none" ? copy.toastHouseNone : copy.toastHouseSet);
            void app.pushPrefs?.();
            app.syncPrefControls?.();
            app.homeRefresh?.();
        },
        onPace: (p) => {
            setPaceChoice(p);
            toast(p === "light" ? copy.toastPaceLight : copy.toastPaceFull);
            void app.pushPrefs?.();
            app.syncPrefControls?.();
            app.homeRefresh?.();
        },
        gardens,
        fetching,
        startHere: !demo && !fetching && homeSettled() && neverPlanted(allGardenSeasons()),
        startSkip: fr && onWarmthPath(fr.site, fr.springOwn || fr.ownRecord) ? ["frost-dates"] : [],
        growsHref: anchor && !demo ? `#/answers?at=${anchor.lat.toFixed(4)},${anchor.lon.toFixed(4)}` : null,
        questions: ground ? homeQuestions({
            month: northernMonth(Number(t.slice(5, 7)), lat),
            speciesPresent: new Set((openSeason$1?.plantings ?? []).map((p) => p.species)),
            insectPollinatedPresent: new Set((openSeason$1?.plantings ?? []).map((p) => p.species)
                .filter((sid) => needsInsects(bundle.species.find((x) => x.id === sid)))),
            berSusceptiblePresent: new Set((openSeason$1?.plantings ?? []).map((p) => p.species)
                .filter((sid) => bundle.species.find((x) => x.id === sid)?.ber_susceptible === true)),
            familiesPresent: new Set((openSeason$1?.plantings ?? []).map((p) => familyOf(bundle, p.species)).filter((f) => !!f)),
            familyOf: (sid) => familyOf(bundle, sid),
            plantName: (sid) => {
                const own = (openSeason$1?.plantings ?? []).find((p) => p.species === sid);
                return plantingLabel(bundle, sid, own?.cultivar_group ?? null).toLowerCase();
            },
            plantPhoto: (sid) => {
                const own = (openSeason$1?.plantings ?? []).find((p) => p.species === sid);
                const group = own?.cultivar_group ?? null;
                const sameAsPictured = !group || plantingLabel(bundle, sid, group).toLowerCase() === commonName(bundle, sid).toLowerCase();
                return sameAsPictured ? speciesThumb(sid) : null;
            },
            hasLocation: !!anchor,
            boltingNow: anchor ? new Set(boltWarnings([...new Set((openSeason$1?.plantings ?? [])
                    .filter((p) => !indoorBedNames.has(bedAtHome(p.region) ?? "")).map((p) => p.species))], anchor.lat, anchor.lon, bundle)
                .filter((w) => w.months.includes(Number(t.slice(5, 7)))).map((w) => w.species)) : undefined,
            hasFrost: anchor ? !!(fr?.lastFrost || fr?.firstFreeze) : undefined,
            dayOfYear: dayOfYearIso(t),
        }) : [],
        season,
        feed,
        onFeed: () => { go("log"); },
        functions: ground ? liveFunctions(t, tasks, bundle, comingNow, offNow) : [],
        onFunction: (route) => { go(route); },
        onGarden: (id) => { void app.switchPlot?.(id).then(() => window.scrollTo({ top: 0 })); },
        onPlan: () => { go("plan"); },
    });
    if (drew && demo)
        exampleTrail();
    return drew;
}

export { invalidateHomePosts, renderHomeNow };
