import { frostCalibration } from "./engine/frostcalib.js";
import { resolveGround } from "./engine/soil.js";
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
    if (!site) {
        rows.push({ key: "frost", state: "wait", badge: "Not yet",
            text: "Frost dates. Set a location first - then each frost you log counts toward frost dates from your own log." });
    }
    else {
        const cal = frostCalibration(seasons, site);
        if (cal.spring.calibrated || cal.fall.calibrated) {
            rows.push({ key: "frost", state: "live", badge: "Earned",
                text: "Frost dates. Your own logged frosts supersede the general estimate - every sow date on the calendar rides your ground's dates." });
        }
        else {
            const n = Math.max(cal.spring.n, cal.fall.n);
            if (n > 0) {
                const left = Math.max(0, cal.min_seasons - n);
                rows.push({ key: "frost", state: "part", badge: `${n} of ${cal.min_seasons}`,
                    text: `Frost dates. ${left} more frost season${left === 1 ? "" : "s"} and this ground plants by its own dates - every sow date on the calendar.` });
            }
            else {
                rows.push({ key: "frost", state: "wait", badge: "Not yet",
                    text: `Frost dates. Log the frosts you see - after ${cal.min_seasons} seasons your frost dates come from your own log.` });
            }
        }
    }
    let phLive = false;
    let drainageLive = false;
    for (const key of groundKeys(soilObservations, plot)) {
        const g = resolveGround(soilObservations, plot, key);
        if (typeof g.fields.ph === "number")
            phLive = true;
        const d = g.fields.drainage;
        if (typeof d === "string" && d !== "unknown")
            drainageLive = true;
    }
    rows.push(phLive
        ? { key: "ph", state: "live", badge: "Earned",
            text: "Soil pH. A measured pH is on record - the acidity advice now applies to the plants standing in that ground." }
        : { key: "ph", state: "wait", badge: "Not yet",
            text: "Soil pH. A measured pH (kit or lab) brings acidity advice to every plant standing in the bed." });
    rows.push(drainageLive
        ? { key: "drainage", state: "live", badge: "Earned",
            text: "Drainage. Recorded - the waterlogging warning now reads this ground's own answer." }
        : { key: "drainage", state: "wait", badge: "Not yet",
            text: "Drainage. One answer - does water stand after rain? - readies the waterlogging warning for the ground it describes." });
    return rows;
}
