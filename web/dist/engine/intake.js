// Intake (C2) - resolve the user's situation against the bundle. DOM-free and portable, like
// everything in engine/ (web today, React Native later; web/test.mjs enforces it mechanically).
//
// Location honesty is the whole design: the bundle carries a handful of PRE-resolved climate
// sites (D-008 - the app never calls a weather API), so a user's point resolves to the NEAREST
// bundled site with the distance stated, never hidden. The distance bands reuse the calibrated
// provenance thresholds from docs/CLIMATE.md §4 (2 km / 80 km), and the effective grade shown to
// the user can only be as good as the worse of (site's own grade, distance band) - resolution
// never upgrades what the pipeline measured.
//
// ZIP → lat/lon: the lookup table (planned source: the free Census ZCTA gazetteer) is not shipped
// yet - the host is egress-blocked in the dev environment as of 2026-07-11 (see SESSION.md).
// zipToLatLon() is written against the table's eventual shape so the data drops in with no code
// change; until then the UI falls back to the site picker + direct lat/lon.
export function bedAreaM2(widthM, lengthM) {
    if (widthM == null || lengthM == null)
        return null;
    if (!Number.isFinite(widthM) || !Number.isFinite(lengthM) || widthM <= 0 || lengthM <= 0)
        return null;
    return widthM * lengthM;
}
export function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371.0088; // mean Earth radius, km
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
// docs/CLIMATE.md §4: within 2 km a point and its station are interchangeable (median offset ~0);
// the offset method is calibrated out to 80 km; beyond that is untested → C.
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
/** Python engine/climate.py's resolve_site: the nearest bundled site, but ONLY within the match
 *  tolerance - a point far from every resolved site returns null (the engine refuses, it does not
 *  approximate). resolveClimate below is the looser UI companion that always names the nearest
 *  site and grades the distance honestly. */
export const MATCH_TOLERANCE_KM = 80.0; // engine/climate.py - nearest NCEI frost station within the
// calibrated grade-B/C ceiling (docs/CLIMATE.md §4). Was 5 km for the 4 hand-built sites; the D-113
// nationwide station table makes this the nationwide nearest-station reach.
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
/** Nearest bundled climate site to the user's point, with the distance and an honest grade. */
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
    // Global frost (D-129): out of every NCEI station's / bundled site's reach, fall to the nearest
    // ERA5 frost cell - the calendar and planting windows then populate outside the US too. Grade C,
    // told (reanalysis ~25 km cells, no terrain; R-093 lets the user's own logged frosts supersede).
    // A separate step with the wider global tolerance, so the US station reach (80 km) is unchanged.
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
/** 5-digit US ZIP (ZIP+4 tolerated) -> centroid, or null when unknown / table not shipped. */
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
// Plus Code / Open Location Code (D-133): the universal, offline, open location format - decodes to
// lat/lon with pure arithmetic (no API, no data table, so it fits the never-call-a-service rule and
// the CSP). Only a FULL code is accepted (the separator at position 8, e.g. "849VCWC8+R9"); a SHORT
// code ("CWC8+R9 Mountain View") needs a reference locality we don't resolve offline, so it's
// rejected with a message pointing at the full code or an address. Port of the reference decoder,
// float form - adequate for a garden location (a full 10-digit code is ~14 m). Apache-2.0 algorithm.
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";
const OLC_SEP = "+";
const OLC_SEP_POS = 8;
const OLC_BASE = 20;
const OLC_PAIR_LEN = 10; // digits (excluding separator) in the pair section
const OLC_MAX_LEN = 15;
const OLC_GRID_ROWS = 5;
const OLC_GRID_COLS = 4;
/** A full Plus Code (Open Location Code) -> its cell centre, or null if it isn't a valid full code. */
export function plusCodeToLatLon(raw) {
    if (!raw)
        return null;
    const code = raw.trim().toUpperCase().split(/\s+/)[0]; // drop any trailing "…+… Locality" text
    if (code.indexOf(OLC_SEP) !== OLC_SEP_POS)
        return null; // full codes only (short codes need a locality)
    let digits = code.replace(OLC_SEP, "");
    // Padding: a coarse full code carries trailing "0"s before the separator (e.g. "9C3XGV00+" is a
    // ~5 km cell). "0" is not an alphabet digit, so it may appear ONLY as trailing, pair-aligned
    // padding; anywhere else it is invalid.
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
    let lat = -90, lon = -180, res = OLC_BASE; // first pair spans 20°
    const pairDigits = Math.min(digits.length, OLC_PAIR_LEN);
    for (let i = 0; i < pairDigits; i += 2) {
        lat += OLC_ALPHABET.indexOf(digits[i]) * res;
        lon += OLC_ALPHABET.indexOf(digits[i + 1]) * res;
        res /= OLC_BASE;
    }
    let latRes = res * OLC_BASE, lonRes = res * OLC_BASE; // resolution of the last pair used
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
    const clat = lat + latRes / 2, clon = lon + lonRes / 2; // cell centre
    if (!Number.isFinite(clat) || !Number.isFinite(clon) || clat < -90 || clat > 90 || clon < -180 || clon > 180)
        return null;
    return { lat: Math.round(clat * 1e6) / 1e6, lon: Math.round(clon * 1e6) / 1e6 };
}
// Hardiness zone resolves nationwide from the nearest USDA-PHZM ZIP centroid (D-051): a US
// point out of the table's reach falls back to the nearest bundled site's block, then to null (fail
// closed - never a guessed zone). Constants + logic port engine/climate.py resolve_zone.
export const ZONE_ZIP_TOLERANCE_KM = 80.0; // engine/climate.py
export const ZONE_A_KM = 10.0;
export const GLOBAL_ZONE_TOLERANCE_KM = 160.0; // engine/climate.py (D-128, sized to the 2° v1 grid)
/** Leading integer zone of a PHZM label: "6b" -> 6, "10a" -> 10. R-076 gates on this. */
function zoneInt(label) {
    const m = /^(\d+)/.exec(label);
    return m ? parseInt(m[1], 10) : null;
}
const zoneCache = new WeakMap();
/** The site's hardiness block, resolved worldwide from lat/lon (D-051 US, D-128 global): nearest
 *  PHZM ZIP zone (A/B), else the nearest bundled site's curated block (curated beats the model
 *  where both cover - Berlin keeps its site block), else the nearest global ERA5 cell (grade C,
 *  the user told it is model output), else null. Port of engine/climate.py resolve_zone. */
export function resolveZone(lat, lon, bundle) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    let byPoint = zoneCache.get(bundle);
    if (!byPoint) {
        byPoint = new Map();
        zoneCache.set(bundle, byPoint);
    }
    // THE KEY CARRIES WHICH TABLES WERE PRESENT (2026-07-25). app.ts fetches zip-data.json - the PHZM ZIP
    // centroids/zones and the global ERA5 cells - fire-and-forget AFTER first paint, and merges it into
    // THIS SAME bundle object. So the first draw resolves a zone with no tables, correctly gets null, and
    // used to cache that null against the bundle forever: when the tables landed a moment later, every
    // later call returned the stale null and the Hardiness zone row NEVER appeared for the life of the
    // page. On a fast connection the fetch usually beat the first resolve and it looked fine; on a slow
    // one - a phone on mobile data, or a loaded CI runner - the row silently vanished. Signing the key
    // with the tables present makes a pre-merge answer un-shadow itself the moment they arrive.
    //
    // The Python twin (engine/climate.py resolve_zone) cannot hit this: it loads the tables from disk, so
    // they are never absent-then-present within a process. Results are unchanged on both sides - this
    // only decides when a cached answer is still valid - so the conformance oracle is unaffected.
    const b = bundle;
    const tables = `${b.zip_index ? 1 : 0}${b.zip_zones ? 1 : 0}${b.global_zones ? 1 : 0}`;
    // O38b: with the tables sharded, they no longer arrive all-at-once - each grid cell merged into the
    // bundle bumps _zipEpoch (app.ts). Signing it into the key means a null resolved before the cell
    // holding this point's nearest ZIP landed does not shadow the real answer once it does - the
    // per-cell form of the tables-present guard the note above describes. Python/conformance never set
    // _zipEpoch (they load the whole table once from disk), so it is 0 there and the key is unchanged.
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
        const site = matchSite(lat, lon, bundle); // non-US / gap: bundled site's block
        result = (site?.hardiness) ?? null;
        if (result === null) {
            // D-128: the global ERA5 table - zone anywhere a tranche covers, grade C, told.
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
