// The Account ledger ring (P2.3 / D-189 pilot) - a small conic dial summarising how far this
// garden's own frost record has marched toward superseding the national model (R-093). Pure and
// DOM-free so the three standings are unit-testable; app.ts draws the arc it returns.
//
// It reads the SAME frostCalibration resolver the earn-strip (earned.ts) and the calendar read, so
// the dial can never disagree with the Log's frost row: n = the further-along of the two boundaries
// (a plot may have three logged autumns but only two springs), min_seasons = R-093's own gate. REAL
// seasons only - the demo's synthetic seasons never reach it, because a full ring earned by demo
// data would lie about the gardener's own ledger. Text lives here beside the state, exactly as the
// earn-strip's does; there is no copy key, so no copy-pin can be tripped by a coincidental slice.
import { frostCalibration, MIN_SEASONS } from "./engine/frostcalib.js";
export function ledgerRing(seasons, site) {
    const min = MIN_SEASONS;
    if (!site) {
        return { state: "wait", n: 0, min, frac: 0, center: `0/${min}`,
            label: "Set a location, then log the frosts you see - after three seasons your own dates take over from the model." };
    }
    const cal = frostCalibration(seasons, site);
    if (cal.spring.calibrated || cal.fall.calibrated) {
        return { state: "live", n: cal.min_seasons, min: cal.min_seasons, frac: 1, center: "LIVE",
            label: "Your own logged frosts now supersede the national model - every sow date rides your ground's dates." };
    }
    const n = Math.max(cal.spring.n, cal.fall.n);
    const frac = cal.min_seasons > 0 ? Math.min(1, n / cal.min_seasons) : 0;
    if (n > 0) {
        const left = Math.max(0, cal.min_seasons - n);
        return { state: "part", n, min: cal.min_seasons, frac, center: `${n}/${cal.min_seasons}`,
            label: `${left} more logged season${left === 1 ? "" : "s"} and your own dates supersede the national model - for every sow date on the calendar.` };
    }
    return { state: "wait", n: 0, min: cal.min_seasons, frac: 0, center: `0/${cal.min_seasons}`,
        label: `Log the frosts you see - after ${cal.min_seasons} seasons your own dates supersede the national model.` };
}
