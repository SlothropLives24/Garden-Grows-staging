// The ask card (O27, approved mockup docs/mockups/authenticated-journey.html + amendments). The
// account is where the journey begins: ONE surface topping the Log (mirrored as a compact line on
// the Plan sheet) that states the single most valuable next action, computed from the season, the
// calendar's own tasks, and the ledger's own standings. Never a list of chores - one ask; the rest
// waits its turn on one "waiting" line (max two items).
//
// The rules of the card (the mockup's contract):
// - Exactly one ask, ranked: TIMELY observations (a frost tap inside the frost window) › the
//   reality gap (planned but not marked planted) › dated season actions (harvest checks, sowings
//   due) › standing observations (pH / drainage / sun - asked only when a planting makes them
//   matter) › the season close.
// - Factual standings, never badges: "2 of 3 seasons" comes from R-093's own resolver.
// - Everything computed, nothing invented: the asks come from the calendar's real tasks and the
//   same resolvers that run the mechanics (frostCalibration, resolveGround). No weather API exists
//   (CLAUDE.md), so nothing here pretends to know it rained or froze last night - the frost ask
//   keys on the climatological window, and the drainage ask TELLS the gardener when to look.
// - Quiet when there's nothing: a garden with no due ask shows the next dated thing. Silence is a
//   state, not a bug.
// - Explainers ride payoff moments as offers (rec 4) - knowledge as a reward, not homework.
//
// This module is the PURE layer (computeAsk - unit-tested from dist, like earned.ts): every
// input is handed in, nothing here touches the DOM or the app state. askcard.ts renders it.
import { bloomSpan, forageInFlower, needsInsects } from "./engine/forage.js";
import { frostCalibration, mmddDoy } from "./engine/frostcalib.js";
import { resolveGround } from "./engine/soil.js";
// Explainer pages live on the content site beside the app (/web/ -> ../explainers/...), so the
// links survive both the production domain and a project-pages deploy.
const EXPLAINERS = {
    frost: { label: "two minutes on why your zone doesn't know your frost date",
        href: "../explainers/your-zone-does-not-know-your-frost-date/" },
    rotation: { label: "two minutes on why history lives in the ground",
        href: "../explainers/rotation-belongs-to-the-ground/" },
    pollination: { label: "two minutes on what pollination actually needs",
        href: "../explainers/what-pollination-actually-needs/" },
};
const isoDoy = (iso) => mmddDoy(iso.slice(5));
/** Days from a to b within a year, ignoring year wrap (both YYYY-MM-DD). */
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
// The season-position phrase for the welcome-back kicker (rec 2): where the year stands relative
// to this ground's own frost boundaries. Model dates - the re-arrival is about the season, and the
// calibrated shift (if any) is already what the calendar's tasks ride.
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
/** The one ask, ranked (the mockup's contract). Pure - every input is handed in. */
export function computeAsk(inp) {
    const asks = [];
    const open = inp.seasons.find((s) => s.id === inp.seasonId) ?? null;
    const cal = inp.site ? frostCalibration(inp.seasons, inp.site) : null;
    const today = isoDoy(inp.todayIso);
    const year = inp.todayIso.slice(0, 4);
    // ---- rank 1: the TIMELY frost tap. Inside the climatological frost window, with this
    // season's boundary not yet tapped and the boundary not yet calibrated (once LIVE, the taps
    // did their job - the card stops asking and the calendar's markers carry the record).
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
                continue; // LIVE - the mechanism runs; no nagging past the payoff
            // this season already tapped this boundary? (any frost observation this year inside the window)
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
                    ? `You've logged ${n} of ${cal.min_seasons} seasons - ${left} more and YOUR ground's dates supersede the national model, for every sow date on the calendar.`
                    : `After ${cal.min_seasons} logged seasons your own dates supersede the national model - every sow date moves to your yard's truth.`),
                go: { label: "Log the frost", act: "log" },
                explainer: n > 0 ? EXPLAINERS.frost : undefined,
            });
            break; // one boundary at a time
        }
    }
    // ---- rank 2: the reality gap - a planned bed not yet marked planted. Marking it starts the
    // real clock: harvest windows count from YOUR date, not the plan's.
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
    // ---- rank 3: the nearest dated season action from the calendar's own tasks - a harvest check
    // opening, a sowing due. Recently-opened windows (3 days back) still count; frost markers are
    // rank 1's business and logged events already happened.
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
                // O45: only the harvest phrasing puts the crop's name in the sentence - the generic branch
                // renders the calendar task's own text, which this module did not compose.
                ...(t.kind === "harvest_open" && label && t.species
                    ? { qNames: { label, species: t.species } } : {}),
            });
        }
    }
    // ---- rank 4: standing observations, asked ONLY when a planting makes them matter (the
    // promotion rule; the sun ask is exactly this rule too - shade asked only when a full-sun
    // plant is in play). Order pH › drainage › sun: the pH answer unlocks per-plant verdicts,
    // drainage arms a site-wide warning, sun arms a gate.
    {
        const plantings = (open?.plantings ?? []).filter((p) => !p.end_cause);
        const standing = new Set(plantings.map((p) => p.species));
        const speciesOf = (sid) => inp.bundle.species.find((s) => s.id === sid);
        // what the grounds already know (same resolver the gates read - superseded pH counts as absent)
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
        // forage (R-102): an insect-pollinated crop is standing and nothing planted alongside it is in
        // flower while it needs insects. Last in the tier on purpose - pH, drainage and sun each ARM a
        // mechanism (verdicts, a warning, a gate), while this one only improves odds nobody can measure.
        //
        // I PROPOSED "ASK IT ONCE PER SEASON" IN THE SURVEY AND THAT WAS WRONG. Every other member of
        // this tier is SELF-RESOLVING: record a pH and the pH ask is gone, log the standing water and
        // drainage goes. This one resolves the same way - plant something that flowers alongside and
        // the gap closes - so a dismissal mechanism would be the only one of its kind here, and would
        // let a real gap go quiet without anything having changed in the garden. Consistency with the
        // tier beats the extra machinery.
        //
        // The `why` names the trade honestly: it cannot promise fruit, because bees come from outside
        // the garden and the evidence for the remedy is grade C (R-052). It says what is true - the
        // crop needs insects, and nothing here feeds them while it does.
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
                    // Knowledge as a reward, not homework (O27 rec 4). This ask is the one place a gardener
                    // is holding the exact question the explainer answers - including the part the app
                    // refuses to answer, which is better read in prose than inferred from a silence.
                    explainer: EXPLAINERS.pollination,
                });
            }
        }
        // sun: a bed carrying a full-sun planting with no declared exposure - one answer arms R-005's
        // shade gate for that bed. Planted flag or an active planting both count as "in play".
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
    // ---- rank 5: the season close - the rotation payoff. Past the first freeze (this ground's own
    // date once calibrated, else the model) with a season still open, closing writes the year into
    // each bed's history and next spring's plan steers from what actually grew.
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
    // ---- rank 6 (rec 3's second half): a fresh garden seeded from the ladder - the crop they asked
    // about becomes the suggested first planting. Only when the garden is genuinely empty.
    if (!inp.beds.length && !(open?.plantings ?? []).length && inp.answersCrop) {
        asks.push({
            key: "ladder-crop", kicker: "Pick up where you left off",
            q: `Plant the ${inp.cropLabel(inp.answersCrop)} you asked about - your dates are already set.`,
            why: "The location and crop you gave before signing up carried over - nothing given is asked twice. The planner starts from them.",
            go: { label: "Open the planner", act: "plan" },
            qNames: { label: inp.cropLabel(inp.answersCrop), species: inp.answersCrop },
        });
    }
    // ---- assemble: one ask, one waiting line, or the quiet state
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
                ? "a frost tap starts this season's count" : a.key === "reality-gap"
                ? "a planned bed waits to be marked planted" : a.key === "ph"
                ? "a pH answer unlocks the acidity verdicts" : a.key === "drainage"
                ? "a drainage answer arms the waterlogging warning" : a.key === "sun"
                ? "a sun answer arms the light check" : a.key === "season-close"
                ? "the season waits to be closed" : null;
            // Only the FALLBACK carries a crop name - the canned phrases are about the act, not a plant.
            // So names ride only when the line really is the question, which keeps this honest without
            // the renderer having to guess whether a name is in there.
            return canned ? { text: canned } : { text: a.q, ...(a.qNames ? { names: a.qNames } : {}) };
        }),
        quiet,
        ...(quietNames ? { quietNames } : {}),
    };
    // rec 2: the seasonal re-arrival - a months-absent device gets a season-aware welcome, wrapped
    // around whatever ask ranks first (or the quiet line). The kicker changes; the ask does not.
    if (inp.daysAway != null && inp.daysAway >= 60) {
        const pos = seasonPosition(inp.todayIso, inp.site);
        const kicker = `Welcome back${pos ? ` - ${pos}` : ""}`;
        // The welcome PREFIXES the quiet line rather than rewriting it, so `quietNames`'s label is
        // still present in the string and still links. Worth stating plainly: a rewrite here would
        // silently drop the link, and the renderer would fall back to plain text without complaining.
        card = card.ask ? { ...card, ask: { ...card.ask, kicker } } : { ...card, quiet: `${kicker}. ${card.quiet ?? ""}`.trim() };
    }
    return card;
}
