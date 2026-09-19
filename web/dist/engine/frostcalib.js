const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
export const SPRING_FALL_SPLIT = 182;
export const MIN_SEASONS = 3;
function doyMd(m, d) {
    return m >= 1 && m <= 12 ? CUM[m - 1] + d : null;
}
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
function obsDoy(date) {
    if (typeof date !== "string" || date.length < 10)
        return null;
    const m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
    if (!Number.isInteger(m) || !Number.isInteger(d))
        return null;
    return doyMd(m, d);
}
export function fromDoy(doy) {
    const n = Math.max(1, Math.min(365, Math.floor(doy + 0.5)));
    for (let m = 0; m < 12; m++) {
        if (n < STARTS[m + 1])
            return `${String(m + 1).padStart(2, "0")}-${String(n - STARTS[m] + 1).padStart(2, "0")}`;
    }
    return "12-31";
}
function median(vals) {
    const s = [...vals].sort((a, b) => a - b);
    const n = s.length;
    const mid = n >> 1;
    return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
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
export function shiftFrostDate(mmdd, days) {
    const doy = mmddDoy(mmdd);
    return doy === null ? mmdd : fromDoy(doy + days);
}
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
