export function bedAreaM2(widthM, lengthM) {
    if (widthM == null || lengthM == null)
        return null;
    if (!Number.isFinite(widthM) || !Number.isFinite(lengthM) || widthM <= 0 || lengthM <= 0)
        return null;
    return widthM * lengthM;
}
export function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371.0088;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(bLat - aLat);
    const dLon = rad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
const GRADE_RANK = { A: 0, B: 1, C: 2 };
export function worseGrade(a, b) {
    return GRADE_RANK[a] >= GRADE_RANK[b] ? a : b;
}
export function distanceGrade(km) {
    if (km <= 2)
        return "A";
    if (km <= 80)
        return "B";
    return "C";
}
function caveatFor(site, km) {
    const d = km < 10 ? km.toFixed(1) : Math.round(km).toString();
    if (km <= 2)
        return `${d} km from the resolved site "${site.key}" - effectively on-site.`;
    if (km <= 80)
        return (`${d} km from the resolved site "${site.key}" - inside the calibrated 80 km range, ` +
            `but the frost dates are the site's, not your ground's.`);
    return (`${d} km from the NEAREST resolved site ("${site.key}") - beyond the calibrated 80 km range. ` +
        `Treat these dates as a rough regional sketch (grade C).`);
}
export const MATCH_TOLERANCE_KM = 80.0;
export function matchSite(lat, lon, bundle) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    let best = null;
    let bestKm = Infinity;
    for (const site of bundle.climate?.sites ?? []) {
        const km = haversineKm(lat, lon, site.lat, site.lon);
        if (km < bestKm) {
            best = site;
            bestKm = km;
        }
    }
    return best && bestKm <= MATCH_TOLERANCE_KM ? best : null;
}
export function resolveClimate(lat, lon, bundle) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    let best = null;
    let bestKm = Infinity;
    for (const site of bundle.climate?.sites ?? []) {
        const km = haversineKm(lat, lon, site.lat, site.lon);
        if (km < bestKm) {
            best = site;
            bestKm = km;
        }
    }
    if (!best || bestKm > MATCH_TOLERANCE_KM) {
        const cells = bundle.global_frost?.cells ?? [];
        let cell = null;
        let cellKm = Infinity;
        for (const c of cells) {
            const km = haversineKm(lat, lon, c.lat, c.lon);
            if (km < cellKm) {
                cellKm = km;
                cell = c;
            }
        }
        if (cell !== null && cellKm <= GLOBAL_ZONE_TOLERANCE_KM) {
            const site = {
                key: `era5_${cell.lat.toFixed(0)}_${cell.lon.toFixed(0)}`,
                lat: cell.lat, lon: cell.lon,
                last_frost_32f: cell.last_frost_32f,
                first_freeze_32f_p50: cell.first_freeze_32f_p50,
                growing_season_days_p50: cell.growing_season_days_p50,
                summer_night_tmin_c: cell.summer_night_tmin_c,
                provenance: { tier: 3, grade: "C", method: "nearest_era5_cell" },
            };
            return {
                site,
                distanceKm: cellKm,
                effectiveGrade: "C",
                caveat: `Frost dates derived from the ~25 km ERA5 reanalysis cell nearest this point (${Math.round(cellKm)} km); `
                    + `no NCEI station coverage outside the US. Model output, grade C - terrain finer than the cell `
                    + `(a frost hollow, a south slope) is not resolved. Log your own frosts and after three seasons `
                    + `they supersede this.`,
            };
        }
    }
    if (!best)
        return null;
    const siteGrade = best.provenance?.grade || "C";
    return {
        site: best,
        distanceKm: bestKm,
        effectiveGrade: worseGrade(siteGrade, distanceGrade(bestKm)),
        caveat: caveatFor(best, bestKm),
    };
}
export function zipToLatLon(zip, table) {
    const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(zip);
    if (!m || !table)
        return null;
    const hit = table[m[1]];
    if (!hit)
        return null;
    const [lat, lon] = hit.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";
const OLC_SEP = "+";
const OLC_SEP_POS = 8;
const OLC_BASE = 20;
const OLC_PAIR_LEN = 10;
const OLC_MAX_LEN = 15;
const OLC_GRID_ROWS = 5;
const OLC_GRID_COLS = 4;
export function plusCodeToLatLon(raw) {
    if (!raw)
        return null;
    const code = raw.trim().toUpperCase().split(/\s+/)[0];
    if (code.indexOf(OLC_SEP) !== OLC_SEP_POS)
        return null;
    let digits = code.replace(OLC_SEP, "");
    const pad = digits.indexOf("0");
    if (pad !== -1) {
        if (!/^0+$/.test(digits.slice(pad)) || pad % 2 !== 0 || pad < 2)
            return null;
        digits = digits.slice(0, pad);
    }
    if (digits.length > OLC_MAX_LEN)
        return null;
    for (const ch of digits)
        if (OLC_ALPHABET.indexOf(ch) === -1)
            return null;
    let lat = -90, lon = -180, res = OLC_BASE;
    const pairDigits = Math.min(digits.length, OLC_PAIR_LEN);
    for (let i = 0; i < pairDigits; i += 2) {
        lat += OLC_ALPHABET.indexOf(digits[i]) * res;
        lon += OLC_ALPHABET.indexOf(digits[i + 1]) * res;
        res /= OLC_BASE;
    }
    let latRes = res * OLC_BASE, lonRes = res * OLC_BASE;
    if (digits.length > OLC_PAIR_LEN) {
        let latGrid = latRes, lonGrid = lonRes;
        for (let i = OLC_PAIR_LEN; i < digits.length; i++) {
            latGrid /= OLC_GRID_ROWS;
            lonGrid /= OLC_GRID_COLS;
            const dv = OLC_ALPHABET.indexOf(digits[i]);
            lat += Math.floor(dv / OLC_GRID_COLS) * latGrid;
            lon += (dv % OLC_GRID_COLS) * lonGrid;
        }
        latRes = latGrid;
        lonRes = lonGrid;
    }
    const clat = lat + latRes / 2, clon = lon + lonRes / 2;
    if (!Number.isFinite(clat) || !Number.isFinite(clon) || clat < -90 || clat > 90 || clon < -180 || clon > 180)
        return null;
    return { lat: Math.round(clat * 1e6) / 1e6, lon: Math.round(clon * 1e6) / 1e6 };
}
export const ZONE_ZIP_TOLERANCE_KM = 80.0;
export const ZONE_A_KM = 10.0;
export const GLOBAL_ZONE_TOLERANCE_KM = 160.0;
function zoneInt(label) {
    const m = /^(\d+)/.exec(label);
    return m ? parseInt(m[1], 10) : null;
}
const zoneCache = new WeakMap();
export function resolveZone(lat, lon, bundle) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    let byPoint = zoneCache.get(bundle);
    if (!byPoint) {
        byPoint = new Map();
        zoneCache.set(bundle, byPoint);
    }
    const b = bundle;
    const tables = `${b.zip_index ? 1 : 0}${b.zip_zones ? 1 : 0}${b.global_zones ? 1 : 0}`;
    const key = `${lat},${lon}|${tables}|${b._zipEpoch ?? 0}`;
    const cached = byPoint.get(key);
    if (cached !== undefined)
        return cached;
    const centroids = bundle.zip_index?.zips ?? {};
    const zones = bundle.zip_zones?.zones ?? {};
    let bestZip = null;
    let bestKm = Infinity;
    for (const [z, ll] of Object.entries(centroids)) {
        if (!(z in zones))
            continue;
        const c = ll.indexOf(",");
        const zla = Number(ll.slice(0, c));
        const zlo = Number(ll.slice(c + 1));
        const km = haversineKm(lat, lon, zla, zlo);
        if (km < bestKm) {
            bestKm = km;
            bestZip = z;
        }
    }
    let result;
    if (bestZip !== null && bestKm <= ZONE_ZIP_TOLERANCE_KM) {
        const label = zones[bestZip];
        result = {
            zone: zoneInt(label),
            label,
            grade: bestKm <= ZONE_A_KM ? "A" : "B",
            source: "USDA 2023 PHZM ZIP-code listing (PRISM/OSU)",
            method: "nearest_phzm_zipcode",
            zip: bestZip,
            distance_km: Math.round(bestKm * 10) / 10,
        };
    }
    else {
        const site = matchSite(lat, lon, bundle);
        result = (site?.hardiness) ?? null;
        if (result === null) {
            const cells = bundle.global_zones?.cells ?? [];
            let bestCell = null;
            let bestCellKm = Infinity;
            for (const c of cells) {
                const km = haversineKm(lat, lon, c[0], c[1]);
                if (km < bestCellKm) {
                    bestCellKm = km;
                    bestCell = c;
                }
            }
            if (bestCell !== null && bestCellKm <= GLOBAL_ZONE_TOLERANCE_KM) {
                const label = bestCell[3];
                result = {
                    zone: zoneInt(label),
                    label,
                    grade: "C",
                    source: "Derived from ERA5 daily minima (Open-Meteo), 1991-2020 - USDA-equivalent band",
                    method: "nearest_era5_cell",
                    extreme_min_c: bestCell[2],
                    distance_km: Math.round(bestCellKm * 10) / 10,
                    caveat: "USDA-equivalent zone from the average annual extreme minimum temperature, "
                        + "derived from the ~25 km ERA5 reanalysis cell nearest this point (no NCEI/PHZM "
                        + "coverage outside the US); model output, grade C - terrain finer than the cell "
                        + "(frost hollows, slopes) is not resolved.",
                };
            }
        }
    }
    byPoint.set(key, result);
    return result;
}
