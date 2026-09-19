import { frostCalibration, MIN_SEASONS } from "./engine/frostcalib.js";
export function ledgerRing(seasons, site) {
    const min = MIN_SEASONS;
    if (!site) {
        return { state: "wait", n: 0, min, frac: 0, center: `0/${min}`,
            label: "Set a location, then log the frosts you see - after three seasons your frost dates come from your own log." };
    }
    const cal = frostCalibration(seasons, site);
    if (cal.spring.calibrated || cal.fall.calibrated) {
        return { state: "live", n: cal.min_seasons, min: cal.min_seasons, frac: 1, center: "Earned",
            label: "Your own logged frosts now supersede the general estimate - every sow date rides your ground's dates." };
    }
    const n = Math.max(cal.spring.n, cal.fall.n);
    const frac = cal.min_seasons > 0 ? Math.min(1, n / cal.min_seasons) : 0;
    if (n > 0) {
        const left = Math.max(0, cal.min_seasons - n);
        return { state: "part", n, min: cal.min_seasons, frac, center: `${n}/${cal.min_seasons}`,
            label: `${left} more frost season${left === 1 ? "" : "s"} and this ground plants by its own dates - every sow date on the calendar.` };
    }
    return { state: "wait", n: 0, min: cal.min_seasons, frac: 0, center: `0/${cal.min_seasons}`,
        label: `Log the frosts you see - after ${cal.min_seasons} seasons your frost dates come from your own log.` };
}
