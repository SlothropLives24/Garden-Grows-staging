// What the state-aware home SAYS (approved 2026-08-01, docs/mockups/returning-home.html).
//
// The pure half of the returning-gardener home: every input is handed in, nothing here touches the
// DOM or the app state, so Node pins the whole thing from dist - exactly the askrank.ts / askcard.ts
// split, and for the same reason. The words a returning gardener meets are the part most likely to
// drift into engagement chrome, so they are the part that gets unit-tested.
//
// home.ts is the DOM + wiring half: it reads the live snapshot, calls these, and renders.
import { daylengthHours, dayOfYear as doyOf } from "./panels/daylength.js";
/** THE TIER IS THE WHOLE ANTI-REPETITION MECHANISM (maintainer's question, and the right one).
 *
 *  A greeting on every visit is chrome by the third one, and it costs the most expensive space on
 *  the screen - directly above what they came for. Tied to ABSENCE instead, it can hardly ever be
 *  the same message twice, and the gardener who opens weekly never sees one at all.
 *
 *  `none` is a real answer, not a fallback: for someone who was here on Tuesday, "welcome back" is
 *  noise. The 2-6 week tier also collapses to `none` when NOTHING actually changed while they were
 *  away - a tier with nothing to report would have to reach for filler, and filler is where this
 *  turns into the engagement chrome the whole design refuses. */
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
/** What the welcome actually says. Every tier hands over something the gardener would otherwise
 *  have to go and find; none of them says "welcome back" in those words.
 *
 *  THE REGISTER IS THE POINT. "Your 2026 season is still open" hands over a fact. "Welcome back,
 *  gardener! We missed you" performs at the reader. This product does not flatter anywhere else,
 *  and a greeting is where that discipline is most likely to slip. */
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
            // The rotation promise, delivered at the one moment it is actually felt.
            return {
                head: `Your ${f.seasonClosedWhileAway} season closed while you were away.`,
                detail: "What grew where is remembered - the plan won't put the same family back.",
            };
    }
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "2026-03-14" -> "14 Mar". Exported for the unit test, which pins the reader-facing form. */
export function prettyDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m)
        return iso;
    const mon = MONTHS[Number(m[2]) - 1];
    return mon ? `${Number(m[3])} ${mon}` : iso;
}
const asDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const daysApart = (aIso, bIso) => Math.round((asDate(bIso).getTime() - asDate(aIso).getTime()) / 86400000);
/** How a dated line says WHEN, at the resolution a gardener acts on: today and tomorrow by name,
 *  this week by weekday (a date you can hold in your head), beyond that in weeks (nobody plans
 *  "in 23 days"), and past a month, the date itself. */
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
/** The gardens strip: only ever shown when there IS more than one, and it FLAGS which needs her
 *  rather than summarising all of them. Sorted by need, then by name, so the answer to "which of my
 *  three wants me this week" is the first card - which is the entire question Ines opens with. */
export function gardenStrip(cards) {
    if (cards.length < 2)
        return [];
    return [...cards].sort((a, b) => (b.due - a.due) || a.name.localeCompare(b.name));
}
/** The dated lines under the ask: at most two, and only things still ahead. A returning gardener
 *  gets ONE ask and then a glance - the moment this becomes a list it is a chore list, which is the
 *  thing every returning persona said they did not want. */
export function dueRows(todayIso, tasks, sentence, horizonDays = 31) {
    const rows = [];
    const dated = tasks
        .filter((t) => typeof t.date === "string" && t.date > todayIso
        && daysApart(todayIso, t.date) <= horizonDays && t.kind !== "logged")
        .sort((a, b) => a.date.localeCompare(b.date));
    for (const t of dated) {
        const what = sentence(t);
        if (rows.some((r) => r.what === what))
            continue; // two gardens can emit the same marker
        rows.push({ when: whenLabel(todayIso, t.date), what });
        if (rows.length === 2)
            break;
    }
    return rows;
}
/** Assemble the facts the welcome reads. Pure: the caller hands in the snapshot and the phrasing. */
export function homeFacts(inp) {
    const gapStart = inp.daysAway != null && inp.daysAway > 0
        ? isoAdd(inp.todayIso, -inp.daysAway) : null;
    const open = inp.seasons.find((s) => s.id === inp.seasonId && !s.closed_date) ?? null;
    // A season that ENDED inside the gap - the one moment the rotation promise is actually felt, and
    // the only tier that outranks everything else.
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
export function project(pt, v) {
    return [v.w / 2 + (pt[0] - v.cx) / v.mpp, v.h / 2 - (pt[1] - v.cy) / v.mpp];
}
/** The frame for one garden: every bed it holds, and a dot per planting still in the ground.
 *  Null when there is nothing to draw, and the caller renders no view rather than an empty box. */
export function gardenFrame(beds, plantings) {
    const gBeds = [];
    for (const b of beds) {
        const pts = regionPts(b.region);
        if (pts.length >= 3)
            gBeds.push({ name: b.name, planted: !!b.planted, pts });
    }
    if (!gBeds.length)
        return null;
    const xs = gBeds.flatMap((b) => b.pts.map((p) => p[0]));
    const ys = gBeds.flatMap((b) => b.pts.map((p) => p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // The dots that belong to THIS view: a planting whose centre sits inside the beds' own box (plus
    // a metre of slack for a plant on the edge). A stray region from an older arrangement must not
    // drag the frame across the yard.
    const dots = [];
    for (const p of plantings) {
        const c = regionCentre(p.region);
        if (c && c[0] >= minX - 1 && c[0] <= maxX + 1 && c[1] >= minY - 1 && c[1] <= maxY + 1) {
            // The SPECIES rides along: the map colours its occupancy dots from the palette and says so
            // in a legend, and a view that dropped identity would be the same picture saying less.
            dots.push({ x: c[0], y: c[1], species: p.species });
        }
    }
    return {
        beds: gBeds, dots,
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        w: Math.max(0.5, maxX - minX), h: Math.max(0.5, maxY - minY),
    };
}
// O58 linking: the how-to GUIDE behind each question. The question's own href is the terse rule
// EVIDENCE (#/why?rule=); the guide is the fuller treatment of the same topic, so a returning
// gardener whose own plants raised the question can go straight to it. Keyed by question id, not
// rule, because two questions can share a rule but want different guides. A question with no guide
// simply carries no link - the map is allowed to be partial rather than to invent a slug, and the
// unit test holds that line by resolving every slug here against a real file in content/guides/.
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
// weight 3 = this gardener's own plants raise it; 2 = the season raises it; 1 = always true.
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
        // The sibling of `tomato-set`: both are "why won't my fruit set", and they are DIFFERENT
        // mechanisms - warm nights there, a missing insect vector here. Offering both to a gardener
        // growing both is correct, not repetitive.
        id: "squash-set", weight: 3,
        q: "Why won't my squash set fruit?",
        hint: "An insect has to move the pollen - and nothing may be in flower when it does",
        href: why("R-102"),
        fits: (c) => c.insectPollinatedPresent.size > 0,
    },
    {
        // The THIRD "why is my fruit wrong" question, and like its two siblings it is a different
        // mechanism rather than a restatement: warm nights (R-030), a missing insect vector (R-102),
        // and here a water-transport failure. A gardener growing tomatoes may legitimately see more
        // than one - they are not alternatives to each other.
        //
        // Not month-gated. Blossom-end rot shows on the first fruits, and a gardener who has just seen
        // it is asking today whatever the calendar says.
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
        // Weight 1 and `fits: () => true` - it needs no location, no plants and no season, because the
        // question is asked before any of those exist and the answer does not depend on them. It is a
        // refusal, and a refusal is equally true in an empty garden.
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
/** The questions to offer right now: the most relevant first, ROTATING day by day among the ones
 *  that tie, so the page changes without ever becoming random. Deterministic - same day, same
 *  garden, same three - because a row that reshuffles on every render is noise, not freshness. */
export function homeQuestions(ctx, limit = 3) {
    const live = CATALOGUE.filter((e) => e.fits(ctx));
    // Rotate within each weight band: the day offsets where the band starts, so a gardener with six
    // relevant questions meets a different three this week than last, and never the same order twice
    // running while both remain true.
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
/** C — the season ribbon: ONE ranked line about what the season is doing to this ground, from the
 *  gardener's own frost dates (and, at the solstice, daylength). It carries the frost data's grade
 *  and links to the evidence. It carries NO GDD line on purpose: nothing in the app computes GDD
 *  (plan.ts declines to, deliberately), so a heat-unit countdown would be invented — the one thing
 *  the corpus forbids. Succession windows stay with the "Can I still sow?" question, which has the
 *  per-species DTM to answer them honestly. Returns null only when there is nothing honest to say
 *  (no frost data and no latitude). */
export function seasonRibbon(inp) {
    const yr = Number(inp.todayIso.slice(0, 4));
    const mmddIso = (mmdd) => `${yr}-${mmdd}`;
    const FROST_HREF = "#/why?rule=R-032";
    // Photoperiod (R-081): only near the summer SOLSTICE, and only for a gardener who grows onions,
    // whose bulbing it gates. Pure astronomy. O64h: the gate was "daylength within ~15 min of peak"
    // ALONE, but near the equator daylength is ~constant year-round, so that fired every day and
    // permanently shadowed the frost countdown. Bound it to a ~3-week window around the actual solstice
    // (a calendar fact true at every latitude), and keep the peak-delta as a secondary guard.
    if (inp.lat != null && inp.onionsPresent) {
        const solstice = inp.lat >= 0 ? 172 : 355; // summer-solstice day-of-year, by hemisphere
        const doy = doyOf(asDate(inp.todayIso));
        const dd = Math.abs(doy - solstice);
        const toSolstice = Math.min(dd, 365 - dd); // circular day-of-year distance (the year wraps)
        const peak = daylengthHours(inp.lat, solstice);
        const now = daylengthHours(inp.lat, doy);
        if (toSolstice <= 21 && peak - now < 0.25) {
            return { when: "SEASON",
                text: "Daylength is near its yearly peak — your onions are bulbing now.",
                grade: null, href: "#/why?rule=R-081" };
        }
    }
    // Frost countdown — the default line, from whichever boundary is next.
    const lastIso = inp.lastFrostMmdd ? mmddIso(inp.lastFrostMmdd) : null;
    const freezeIso = inp.firstFreezeMmdd ? mmddIso(inp.firstFreezeMmdd) : null;
    const toLast = lastIso ? daysApart(inp.todayIso, lastIso) : null; // >0 = last frost still ahead
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
            text: `to your first fall frost (${prettyDate(freezeIso)}) — the season's clock.`,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    if (toFreeze != null && toFreeze <= 0) {
        return { when: "SEASON",
            text: `Your first fall frost has passed (${prettyDate(freezeIso)}) — tender crops are done for the year.`,
            grade: inp.frostGrade, href: FROST_HREF };
    }
    return null;
}
/** A — "since you were away": a ranked digest of BED changes inside the absence gap. Pure — the
 *  caller hands in the bed events it resolved from DTM. O64j (maintainer ruling, 2026-08-09, "go with
 *  your ruling" → collapse): A carries NO team row. B is the sole team-news surface, so a "N new posts"
 *  count beside B's card would say the same thing twice - and the design's own rule is one-topic-once
 *  (it is why C owns the season). C owns the season; B owns team news; A is bed changes only. Gated on
 *  a real absence — a same-week return gets nothing here and keeps the one-line welcome. Ranking is
 *  here; the CAP is contextBudget, so this returns every qualifying item, newest first. */
export function sinceAway(inp) {
    const gate = inp.minDaysAway ?? 5;
    if (inp.daysAway == null || inp.daysAway < gate)
        return [];
    // The lookback is the absence, BOUNDED by the decay window: a season-long returner sees the last
    // `decayDays` of crossings, not a whole season's worth. (A crossing is also separately bounded by
    // its own still-open picking window in the caller.)
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
/** The shared contextual budget: one tunable cap over a ranked layer, plus the overflow count the
 *  "+N more" disclosure reads. The ceiling is a number here, not emergent length. */
export function contextBudget(items, cap) {
    return { shown: items.slice(0, Math.max(0, cap)), overflow: Math.max(0, items.length - cap) };
}
