// The ledger's earn-strip (earned planner phase A, approved 2026-07-30 + personas finding). The
// Log has carried real earn-mechanics for a while - R-093's three-season frost supersession, the
// D-148 pH gate, R-100's drainage trigger - but kept them secret: nothing told the gardener where
// they stand or what the next observation buys. This module states it. Pure and DOM-free so the
// three standings are unit-testable; the Log renders the rows it returns.
//
// The grammar (one strip, three rows): LIVE = the mechanism fires on this garden's own data now;
// PART = progress made, with the remaining cost named; WAIT = not started, the trade stated. The
// strip never invents - every row reads the same resolvers the mechanisms themselves use
// (frostCalibration, resolveGround), so a superseded pH honestly drops back to WAITING.
import { frostCalibration } from "./engine/frostcalib.js";
import { resolveGround } from "./engine/soil.js";
/** The distinct grounds (region keys, incl. the plot-level null) soil observations exist for. */
function groundKeys(obs, plot) {
    const seen = new Set();
    const keys = [];
    for (const o of obs) {
        const rec = o;
        if (!rec || typeof rec !== "object" || rec.plot !== plot)
            continue;
        const key = rec.region ?? null;
        const j = JSON.stringify(key);
        if (seen.has(j))
            continue;
        seen.add(j);
        keys.push(key);
    }
    return keys;
}
export function ledgerEarned(seasons, site, soilObservations, plot) {
    const rows = [];
    // R-093: the frost taps, marching toward this ground's own dates superseding the model.
    if (!site) {
        rows.push({ key: "frost", state: "wait", badge: "WAITING",
            text: "Frost taps. Set a location first - then each frost you log counts toward your own dates superseding the national model." });
    }
    else {
        const cal = frostCalibration(seasons, site);
        if (cal.spring.calibrated || cal.fall.calibrated) {
            rows.push({ key: "frost", state: "live", badge: "LIVE",
                text: "Frost taps. Your own logged frosts supersede the national model - every sow date on the calendar rides your ground's dates." });
        }
        else {
            const n = Math.max(cal.spring.n, cal.fall.n);
            if (n > 0) {
                const left = Math.max(0, cal.min_seasons - n);
                rows.push({ key: "frost", state: "part", badge: `${n} OF ${cal.min_seasons}`,
                    text: `Frost taps. ${left} more logged season${left === 1 ? "" : "s"} and your own dates supersede the national model - for every sow date on the calendar.` });
            }
            else {
                rows.push({ key: "frost", state: "wait", badge: "WAITING",
                    text: `Frost taps. Log the frosts you see - after ${cal.min_seasons} seasons your own dates supersede the national model.` });
            }
        }
    }
    // D-148: a measured pH unlocks the acidity verdicts (R-099). resolveGround is the same resolver
    // the gate reads, so an amendment-superseded pH honestly counts as not-current.
    let phLive = false;
    let drainageLive = false;
    for (const key of groundKeys(soilObservations, plot)) {
        const g = resolveGround(soilObservations, plot, key);
        // a superseded pH is already deleted from fields by the resolver - presence means current
        if (typeof g.fields.ph === "number")
            phLive = true;
        const d = g.fields.drainage;
        if (typeof d === "string" && d !== "unknown")
            drainageLive = true;
    }
    rows.push(phLive
        ? { key: "ph", state: "live", badge: "LIVE",
            text: "Soil pH. A measured pH is on record - the acidity verdicts fire for the plants standing in that ground." }
        : { key: "ph", state: "wait", badge: "WAITING",
            text: "Soil pH. A measured pH (kit or lab) unlocks the acidity verdicts for every plant standing in the bed." });
    rows.push(drainageLive
        ? { key: "drainage", state: "live", badge: "LIVE",
            text: "Drainage. Recorded - the waterlogging warning fires on this ground's own answer." }
        : { key: "drainage", state: "wait", badge: "WAITING",
            text: "Drainage. One answer - does water stand after rain? - arms the waterlogging warning for the ground it describes." });
    return rows;
}
