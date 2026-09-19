import { bloomSpan, forageInFlower, needsInsects } from "./engine/forage.js";
import { frostCalibration, mmddDoy } from "./engine/frostcalib.js";
import { resolveGround } from "./engine/soil.js";
const EXPLAINERS = {
    frost: { label: "two minutes on why your zone doesn't know your frost date",
        href: "../explainers/your-zone-does-not-know-your-frost-date/" },
    rotation: { label: "two minutes on why history lives in the ground",
        href: "../explainers/rotation-belongs-to-the-ground/" },
    pollination: { label: "two minutes on what pollination actually needs",
        href: "../explainers/what-pollination-actually-needs/" },
};
const isoDoy = (iso) => mmddDoy(iso.slice(5));
const daysBetween = (aIso, bIso) => {
    const a = new Date(Number(aIso.slice(0, 4)), Number(aIso.slice(5, 7)) - 1, Number(aIso.slice(8, 10)));
    const b = new Date(Number(bIso.slice(0, 4)), Number(bIso.slice(5, 7)) - 1, Number(bIso.slice(8, 10)));
    return Math.round((b.getTime() - a.getTime()) / 86400000);
};
const monthDayShort = (mmdd) => {
    const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [mm, dd] = mmdd.split("-").map(Number);
    return mm && dd ? `${M[mm - 1]} ${dd}` : mmdd;
};
function seasonPosition(todayIso, site) {
    if (!site)
        return null;
    const lf = site.last_frost_32f?.p50 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    const today = isoDoy(todayIso);
    if (today == null)
        return null;
    const lfD = lf ? mmddDoy(lf) : null;
    const ffD = ff ? mmddDoy(ff) : null;
    if (lfD != null && today < lfD) {
        const weeks = Math.max(1, Math.round((lfD - today) / 7));
        return `last frost is about ${weeks} week${weeks === 1 ? "" : "s"} out`;
    }
    if (ffD != null && today > ffD)
        return "the season is past its first freeze";
    if (ffD != null) {
        const weeks = Math.max(1, Math.round((ffD - today) / 7));
        return weeks <= 6 ? `first freeze is about ${weeks} week${weeks === 1 ? "" : "s"} away` : "the season is in full swing";
    }
    return null;
}
export function computeAsk(inp) {
    const asks = [];
    const open = inp.seasons.find((s) => s.id === inp.seasonId) ?? null;
    const cal = inp.site ? frostCalibration(inp.seasons, inp.site) : null;
    const today = isoDoy(inp.todayIso);
    const year = inp.todayIso.slice(0, 4);
    if (inp.site && cal && today != null) {
        const seasonObs = (open?.observations ?? []).filter((o) => o.event === "frost" && o.date?.startsWith(year));
        const bounds = [];
        const lf50 = inp.site.last_frost_32f?.p50 ?? null;
        const lf10 = inp.site.last_frost_32f?.p10 ?? null;
        const ff50 = inp.site.first_freeze_32f_p50 ?? null;
        if (lf50) {
            const lo = (mmddDoy(lf50) ?? 0) - 30;
            const hi = (lf10 ? mmddDoy(lf10) ?? mmddDoy(lf50) : mmddDoy(lf50)) + 7;
            bounds.push({ b: "spring", lo, hi, when: `your frost season - the last one usually lands near ${monthDayShort(lf50)}` });
        }
        if (ff50) {
            const d = mmddDoy(ff50) ?? 0;
            bounds.push({ b: "fall", lo: d - 21, hi: d + 21, when: `first freeze usually arrives near ${monthDayShort(ff50)}` });
        }
        for (const w of bounds) {
            if (w.lo == null || w.hi == null || today < w.lo || today > w.hi)
                continue;
            const side = cal[w.b];
            if (side.calibrated)
                continue;
            const tapped = seasonObs.some((o) => {
                const d = isoDoy(o.date ?? "");
                return d != null && d >= w.lo - 7 && d <= w.hi + 7;
            });
            if (tapped)
                continue;
            const n = side.n;
            const left = Math.max(1, cal.min_seasons - n);
            asks.push({
                key: `frost-${w.b}`, kicker: "Around now",
                q: w.b === "fall" ? "Freeze season - saw frost? Tap the date." : "Frost season - tap the last frost you see.",
                why: `${w.when.charAt(0).toUpperCase()}${w.when.slice(1)}. ` + (n > 0
                    ? `You've logged ${n} of ${cal.min_seasons} seasons - ${left} more and YOUR ground's dates supersede the general estimate, for every sow date on the calendar.`
                    : `After ${cal.min_seasons} logged seasons your own dates supersede the general estimate - every sow date moves to your yard's truth.`),
                go: { label: "Log the frost", act: "log" },
                explainer: n > 0 ? EXPLAINERS.frost : undefined,
            });
            break;
        }
    }
    {
        const planAreas = (Array.isArray(open?.plan) ? open.plan : [])
            .map((e) => e.area).filter((a) => !!a);
        const gap = planAreas.find((a) => {
            const bed = inp.beds.find((b) => b.name === a);
            return bed && !bed.planted;
        });
        if (gap) {
            asks.push({
                key: "reality-gap", kicker: "This week",
                q: `You planned ${gap} - is it actually in the ground?`,
                why: "Mark what you truly planted and the calendar starts counting real days - your harvest window comes from YOUR planting date, not the plan's.",
                go: { label: "Mark it planted", act: "logbed", bed: gap },
            });
        }
    }
    {
        const dated = inp.tasks
            .filter((t) => t.kind !== "logged" && t.kind !== "log_first_freeze" && typeof t.date === "string")
            .filter((t) => {
            const d = daysBetween(inp.todayIso, t.date);
            return d >= -3 && d <= 10;
        })
            .sort((a, b) => (a.date < b.date ? -1 : 1));
        const t = dated[0];
        if (t) {
            const d = daysBetween(inp.todayIso, t.date);
            const when = d < 0 ? `${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
            const label = t.species ? inp.cropLabel(t.species) : null;
            asks.push({
                key: `task-${t.kind}`, kicker: "This week",
                q: t.kind === "harvest_open" && label
                    ? `${label}${t.bed ? ` in ${t.bed}` : ""} reaches its harvest window ${when} - start checking.`
                    : `${(t.text ?? "").replace(/\s+$/, "") || `A dated task lands ${when}.`}`,
                why: t.kind === "harvest_open"
                    ? "Counted from the planting date on your own log. Log a pick and the note rides the bed's history."
                    : `On your calendar for ${monthDayShort(t.date.slice(5))} - from the same arithmetic the Calendar page shows.`,
                go: t.bed ? { label: `Open ${t.bed} on the Log`, act: "logbed", bed: t.bed, species: t.species ?? undefined }
                    : { label: "Open the Calendar", act: "calendar" },
                ...(t.kind === "harvest_open" && label && t.species
                    ? { qNames: { label, species: t.species } } : {}),
            });
        }
    }
    {
        const plantings = (open?.plantings ?? []).filter((p) => !p.end_cause);
        const standing = new Set(plantings.map((p) => p.species));
        const speciesOf = (sid) => inp.bundle.species.find((s) => s.id === sid);
        let phKnown = false, drainKnown = false;
        const seen = new Set();
        for (const o of inp.soilObservations) {
            const rec = o;
            if (!rec || rec.plot !== inp.plot)
                continue;
            const j = JSON.stringify(rec.region ?? null);
            if (seen.has(j))
                continue;
            seen.add(j);
            const g = resolveGround(inp.soilObservations, inp.plot, rec.region ?? null);
            if (typeof g.fields.ph === "number")
                phKnown = true;
            const d = g.fields.drainage;
            if (typeof d === "string" && d !== "unknown")
                drainKnown = true;
        }
        if (plantings.length) {
            const phSensitive = [...standing].find((sid) => Array.isArray(speciesOf(sid)?.ph_range));
            if (!phKnown && phSensitive) {
                asks.push({
                    key: "ph", kicker: "When you're ready",
                    q: `A pH reading unlocks the acidity verdicts for ${inp.cropLabel(phSensitive)} and everything else standing in the bed.`,
                    why: "A kit reading counts; your extension office (linked on the soil card) tests it properly. The verdicts fire the moment a number is on record.",
                    go: { label: "Record a pH", act: "soil" },
                    qNames: { label: inp.cropLabel(phSensitive), species: phSensitive },
                });
            }
            if (!drainKnown) {
                asks.push({
                    key: "drainage", kicker: "After the next soaking rain",
                    q: "Did water stand in the bed? One answer arms the waterlogging warning.",
                    why: "Drainage is ground truth only you can see - the app has no weather feed, so it can't know it rained. Next time it pours, look, then log what you saw.",
                    go: { label: "Record it", act: "log" },
                });
            }
        }
        {
            const gapped = plantings.map((p) => p.species).filter((sid, i, a) => a.indexOf(sid) === i)
                .find((sid) => {
                const sp = speciesOf(sid);
                const span = bloomSpan(sp);
                if (!needsInsects(sp) || span === null)
                    return false;
                const others = plantings.map((p) => p.species).filter((x) => x !== sid);
                return forageInFlower(span, others, inp.bundle).length === 0;
            });
            if (gapped) {
                asks.push({
                    key: "forage", kicker: "Before you plant more",
                    q: `${inp.cropLabel(gapped)} needs an insect to move its pollen, and nothing else standing here is in flower while it does.`,
                    qNames: { label: inp.cropLabel(gapped), species: gapped },
                    why: "Nothing can guarantee insects - they come from outside your garden, and this is a suggestion rather than a proven fix. What you can change is whether anything is flowering alongside it.",
                    go: { label: "See what would help", act: "plan" },
                    explainer: EXPLAINERS.pollination,
                });
            }
        }
        const fullSun = (sid) => speciesOf(sid)?.light_min === "full_sun";
        const sunBed = inp.beds.find((b) => !b.sun && b.planted
            && plantings.some((p) => fullSun(p.species)));
        if (sunBed) {
            asks.push({
                key: "sun", kicker: "One look outside",
                q: `Does ${sunBed.name} get full sun? A wall or fence's shade is something only you can see.`,
                why: "One answer arms the light check for every full-sun plant standing there - declared shade gates them honestly instead of letting a doomed planting through.",
                go: { label: `Open ${sunBed.name}`, act: "logbed", bed: sunBed.name },
            });
        }
    }
    if (inp.site && open && !open.closed_date && (open.plantings ?? []).length && today != null) {
        const ffObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
        const ff = ffObs ?? inp.site.first_freeze_32f_p50 ?? null;
        const ffD = ff ? mmddDoy(ff) : null;
        if (ffD != null && today > ffD + 14) {
            asks.push({
                key: "season-close", kicker: `Season ${open.id}`,
                q: "The freeze came. Close the season - and see what the ground earned.",
                why: "Closing writes the year into each bed's history. Next spring's plan then STEERS: which team goes where, argued from what actually grew - the reason this app keeps history on the ground, not the bed.",
                go: { label: `Close season ${open.id}`, act: "log" },
                explainer: EXPLAINERS.rotation,
            });
        }
    }
    if (!inp.beds.length && !(open?.plantings ?? []).length && inp.answersCrop) {
        asks.push({
            key: "ladder-crop", kicker: "Pick up where you left off",
            q: `Plant the ${inp.cropLabel(inp.answersCrop)} you asked about - your dates are already set.`,
            why: "The location and crop you gave before signing up carried over - nothing given is asked twice. The planner starts from them.",
            go: { label: "Open the planner", act: "plan" },
            qNames: { label: inp.cropLabel(inp.answersCrop), species: inp.answersCrop },
        });
    }
    const [first, ...rest] = asks;
    let quiet = null;
    let quietNames;
    if (!first) {
        const next = inp.tasks
            .filter((t) => t.kind !== "logged" && typeof t.date === "string" && daysBetween(inp.todayIso, t.date) > 0)
            .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
        quiet = next
            ? `Nothing needs you right now - next on the calendar: ${monthDayShort(next.date.slice(5))}${next.species ? `, ${inp.cropLabel(next.species)}` : ""}.`
            : "Nothing needs you right now.";
        if (next?.species)
            quietNames = { label: inp.cropLabel(next.species), species: next.species };
    }
    let card = {
        ask: first ?? null,
        waiting: rest.slice(0, 2).map((a) => {
            const canned = a.key === "frost-spring" || a.key === "frost-fall"
                ? "a logged frost starts this season's count" : a.key === "reality-gap"
                ? "a planned bed waits to be marked planted" : a.key === "ph"
                ? "a pH answer unlocks the acidity verdicts" : a.key === "drainage"
                ? "a drainage answer arms the waterlogging warning" : a.key === "sun"
                ? "a sun answer arms the light check" : a.key === "season-close"
                ? "the season waits to be closed" : null;
            return canned ? { text: canned } : { text: a.q, ...(a.qNames ? { names: a.qNames } : {}) };
        }),
        quiet,
        ...(quietNames ? { quietNames } : {}),
    };
    if (inp.daysAway != null && inp.daysAway >= 60) {
        const pos = seasonPosition(inp.todayIso, inp.site);
        const kicker = `Welcome back${pos ? ` - ${pos}` : ""}`;
        card = card.ask ? { ...card, ask: { ...card.ask, kicker } } : { ...card, quiet: `${kicker}. ${card.quiet ?? ""}`.trim() };
    }
    return card;
}
