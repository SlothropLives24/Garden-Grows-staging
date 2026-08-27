// Frost calibration (R-093) - the TS mirror of engine/frost_calib.py. DOM-free and portable.
//
// R-093: an observed per-plot frost offset, fitted from >=3 seasons of logged outcomes on that
// ground, supersedes modelled climatology for that plot. This reduces a plot's logged frost
// observations to a boundary date per season (last spring frost / first fall freeze), compares
// each against the resolved site climatology, and reports the offset. Below MIN_SEASONS the fit is
// withheld and the caller is told how many seasons remain - the gate is R-093's own
// trigger.min_seasons.
//
// The day-of-year convention and the ~Jul 1 spring/fall split match engine/climate_build's ERA5
// path (SPRING_FALL_SPLIT = 182), so a hand-logged calibration and the modelled climatology it
// supersedes speak one set of units. Python is the oracle; gen_web_conformance freezes its answers
// and web/conformance.mjs asserts this port matches. Medians are int-or-exact-half, which serialize
// identically in Python and JS - no %g/gFmt contract is needed here.
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
export const SPRING_FALL_SPLIT = 182;
export const MIN_SEASONS = 3; // R-093 trigger.min_seasons; pinned against the corpus in the Python test
function doyMd(m, d) {
    return m >= 1 && m <= 12 ? CUM[m - 1] + d : null;
}
/** Day-of-year for a model "MM-DD" string. */
export function mmddDoy(s) {
    if (typeof s !== "string")
        return null;
    const parts = s.split("-");
    if (parts.length !== 2)
        return null;
    const m = Number(parts[0]), d = Number(parts[1]);
    if (!Number.isInteger(m) || !Number.isInteger(d))
        return null;
    return doyMd(m, d);
}
/** Day-of-year for a logged "YYYY-MM-DD" observation date (year is irrelevant to the fit). */
function obsDoy(date) {
    if (typeof date !== "string" || date.length < 10)
        return null;
    const m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
    if (!Number.isInteger(m) || !Number.isInteger(d))
        return null;
    return doyMd(m, d);
}
/** Inverse: a day-of-year back to "MM-DD" (non-leap), clamped to the year. Rounds half up (==
 *  Python math.floor(x+0.5)) so a half-day median offset lands on one deterministic date. */
export function fromDoy(doy) {
    const n = Math.max(1, Math.min(365, Math.floor(doy + 0.5)));
    for (let m = 0; m < 12; m++) {
        if (n < STARTS[m + 1])
            return `${String(m + 1).padStart(2, "0")}-${String(n - STARTS[m] + 1).padStart(2, "0")}`;
    }
    return "12-31";
}
/** Median of the per-season offsets - robust to a single freak-frost year, which a mean is not at
 *  n = 3. Integer when whole, else the exact x.5. */
function median(vals) {
    const s = [...vals].sort((a, b) => a - b);
    const n = s.length;
    const mid = n >> 1;
    return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
/** The season's observed boundary day-of-year: the LATEST frost before the spring/fall split (last
 *  spring frost) or the EARLIEST after it (first fall freeze). null if the season logs no frost on
 *  that side. */
function seasonBoundaryDoy(season, isSpring) {
    let best = null;
    for (const o of season.observations ?? []) {
        if (o.event !== "frost")
            continue;
        const doy = obsDoy(o.date);
        if (doy === null)
            continue;
        if (isSpring) {
            if (doy < SPRING_FALL_SPLIT && (best === null || doy > best))
                best = doy;
        }
        else if (doy >= SPRING_FALL_SPLIT && (best === null || doy < best))
            best = doy;
    }
    return best;
}
function boundary(seasons, modelMmdd, isSpring) {
    const modelDoy = mmddDoy(modelMmdd);
    const points = [];
    for (const s of seasons ?? []) {
        const od = seasonBoundaryDoy(s, isSpring);
        if (od === null || modelDoy === null)
            continue;
        points.push({
            season: s.id,
            observed: fromDoy(od),
            model: modelMmdd,
            // observed minus model: + means the ground's frost lands LATER than the model.
            offset_days: od - modelDoy,
        });
    }
    points.sort((a, b) => a.season - b.season);
    const offsets = points.map((p) => p.offset_days);
    const n = offsets.length;
    const calibrated = n >= MIN_SEASONS;
    const med = offsets.length ? median(offsets) : null;
    const calibratedDate = calibrated && modelDoy !== null && med !== null ? fromDoy(modelDoy + med) : null;
    return {
        n,
        per_season: points,
        median_offset_days: med,
        offset_range: offsets.length ? [Math.min(...offsets), Math.max(...offsets)] : null,
        calibrated,
        calibrated_date: calibratedDate,
    };
}
/** Shift an "MM-DD" climatological date by whole days (non-leap). Not part of the fit - a small
 *  convenience over the same doy helpers, used by the app to seed synthetic demo seasons a fixed
 *  number of days off the model so the R-093 render has >=3 seasons to demonstrate against. */
export function shiftFrostDate(mmdd, days) {
    const doy = mmddDoy(mmdd);
    return doy === null ? mmdd : fromDoy(doy + days);
}
/** Fit per-plot frost offsets from logged seasons against the resolved site climatology. Each
 *  boundary calibrates independently (a plot may have three logged autumns but only two springs).
 *  `calibrated_date` (present only when calibrated) is the model p50 shifted by the median offset -
 *  the date R-093 says supersedes the model for this ground. */
export function frostCalibration(seasons, site) {
    const modelSpring = (site?.last_frost_32f ?? {}).p50 ?? null;
    const modelFall = site?.first_freeze_32f_p50 ?? null;
    return {
        min_seasons: MIN_SEASONS,
        model: { last_frost_p50: modelSpring, first_freeze_p50: modelFall },
        spring: boundary(seasons, modelSpring, true),
        fall: boundary(seasons, modelFall, false),
    };
}
