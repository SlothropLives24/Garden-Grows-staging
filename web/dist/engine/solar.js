// Solar geometry (R-003 / R-004) - the port of engine/solar.py plus the marshaling half of
// dispatch.py's _geometry_rules/_reference_doy. DOM-free and dependency-free, like everything
// in engine/.
//
// THE CONTRACT: web/conformance.mjs deep-compares geometryRules' fired records (rule, ruling,
// subject, why - strings included) against the Python oracle (web/testdata/compiler.golden.json,
// scenarios run through dispatch._geometry_rules by engine/gen_web_conformance.py). Do not
// change a string or a threshold here without changing Python first and regenerating the golden.
//
// Coordinate frame, same as Python: plant (x, y) in metres where +y is geographic NORTH and +x
// is EAST; polarIsNorth(lat) picks the poleward direction from the latitude's sign, so the same
// code serves both hemispheres. Heights in centimetres (the corpus's mature_height_cm),
// footprints in metres. Solar noon only - the shortest shadow of the day, so a hit is
// conservative (see engine/solar.py's header for the full modeling notes).
import { gFmt, resolveSpecies } from "./compiler.js";
import { matchSite } from "./intake.js";
// Below this noon altitude the shadow is effectively unbounded (dawn/dusk or deep winter);
// clamped so the trig never blows up. Mirrors solar.py's _MIN_ALTITUDE_DEG.
const MIN_ALTITUDE_DEG = 3.0;
const DEG2RAD = Math.PI / 180.0;
/** Sun's declination for day n of the year (Jan 1 = 1), Cooper's approximation, in degrees. */
export function solarDeclinationDeg(dayOfYear) {
    return 23.45 * Math.sin(DEG2RAD * (360.0 * (284 + dayOfYear)) / 365.0);
}
/** Altitude of the sun above the horizon at local solar noon, in degrees (clamped at 0). */
/** Hours between sunrise and sunset at this latitude and date - the astronomical day length, from the
 *  sunrise hour-angle H0 = acos(-tan(lat)·tan(declination)). The app derives summer daylight from the
 *  set location instead of asking for it. Clamped to [0, 24] for polar night/day. Port of
 *  solar.py daylight_hours (round4 = floor(x·1e4+0.5)/1e4 for cross-engine agreement). */
export function daylightHours(latDeg, dayOfYear) {
    const decl = solarDeclinationDeg(dayOfYear);
    const x = -Math.tan(DEG2RAD * latDeg) * Math.tan(DEG2RAD * decl);
    if (x <= -1)
        return 24;
    if (x >= 1)
        return 0;
    const h0Deg = Math.acos(x) / DEG2RAD;
    return Math.floor((2 * h0Deg / 15) * 1e4 + 0.5) / 1e4;
}
export function noonAltitudeDeg(latDeg, dayOfYear) {
    const alt = 90.0 - Math.abs(latDeg - solarDeclinationDeg(dayOfYear));
    return Math.max(alt, 0.0);
}
/** Which way is 'toward the pole' - north in the northern hemisphere, south in the southern. */
export function polarIsNorth(latDeg) {
    return latDeg >= 0.0;
}
/** Length of the noon shadow a plant of the given height casts, in metres (Infinity below the
 *  minimum altitude - the caller clamps). L = height / tan(altitude). */
export function noonShadowLengthM(heightCm, latDeg, dayOfYear) {
    const alt = noonAltitudeDeg(latDeg, dayOfYear);
    if (alt < MIN_ALTITUDE_DEG)
        return Infinity;
    return heightCm / 100.0 / Math.tan(DEG2RAD * alt);
}
function heightCm(plant) {
    const h = plant.height_cm;
    return Array.isArray(h) ? Number(h[h.length - 1]) : Number(h);
}
function footprintRect(plant) {
    const half = (plant.footprint_m ?? 0.3) / 2.0;
    return [plant.x - half, plant.y - half, plant.x + half, plant.y + half];
}
/** The patch of ground a plant shades at solar noon: the footprint's width projected from its
 *  poleward edge, poleward, by the shadow length. Null for a zero-height plant; an unbounded
 *  low-sun shadow is clamped to a large finite box. */
export function shadowPolygon(plant, latDeg, dayOfYear) {
    const height = heightCm(plant);
    if (height <= 0)
        return null;
    let length = noonShadowLengthM(height, latDeg, dayOfYear);
    const [x0, y0, x1, y1] = footprintRect(plant);
    if (!Number.isFinite(length))
        length = 1e6; // unbounded low-sun shadow, clamped
    if (polarIsNorth(latDeg))
        return [x0, y1, x1, y1 + length]; // shadow extends northward
    return [x0, y0 - length, x1, y0]; // southern hemisphere: southward
}
// Positive-area overlap only - edge-touching is not overlap (a corner clip carries no shade),
// the same convention as regions.ts's intersectArea.
function boxesOverlap(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
/** R-003: a plant taller than the threshold sitting *equatorward* of a shorter plant - its
 *  poleward shadow falls across that neighbour instead of off the bed. No sun angle used. */
export function heightOrderingViolations(plants, thresholdCm, latDeg) {
    const north = polarIsNorth(latDeg);
    const polarness = (p) => (north ? p.y : -p.y);
    const out = [];
    for (const tall of plants) {
        const th = heightCm(tall);
        if (th <= thresholdCm)
            continue;
        for (const shorter of plants) {
            if (shorter === tall)
                continue;
            if (heightCm(shorter) < th && polarness(shorter) > polarness(tall)) {
                out.push({ tall: tall.id, shorter: shorter.id, tall_height_cm: th, shorter_height_cm: heightCm(shorter) });
            }
        }
    }
    return out;
}
/** R-004: which sun-requiring plants sit in the computed noon shadow of a taller neighbour.
 *  A caster with casts_shade explicitly falsy throws no meaningful shadow (key absent defaults
 *  to true - same as Python's dict.get(key, True) then truthiness). */
export function shadowIntersections(plants, latDeg, dayOfYear) {
    const out = [];
    for (const target of plants) {
        if (!target.needs_sun)
            continue;
        const tfoot = footprintRect(target);
        const th = heightCm(target);
        for (const caster of plants) {
            if (caster === target || heightCm(caster) <= th)
                continue;
            if (!("casts_shade" in caster ? caster.casts_shade : true))
                continue;
            const shade = shadowPolygon(caster, latDeg, dayOfYear);
            if (shade && boxesOverlap(shade, tfoot))
                out.push({ target: target.id, caster: caster.id, shadow: shade });
        }
    }
    return out;
}
// --- the dispatch half (mirrors dispatch.py _reference_doy + _geometry_rules) -----------------
// Cumulative days before each month in a non-leap year - MM-DD → day-of-year for frost dates.
const MONTH_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function mmddToDoy(s) {
    if (typeof s !== "string")
        return null;
    const month = parseInt(s.slice(0, 2), 10);
    const day = parseInt(s.slice(3, 5), 10);
    if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12)
        return null;
    return MONTH_CUM[month - 1] + day;
}
/** Day of year for R-004's sun angle: the midpoint of the resolved frost-free window (high
 *  summer - highest sun, shortest shadow, so a computed hit is conservative), falling back to
 *  the hemisphere's summer solstice when the point matches no bundled climate site. */
export function referenceDoy(lat, lon, bundle) {
    const cl = lat != null && lon != null ? matchSite(lat, lon, bundle) : null;
    if (cl) {
        const lf = mmddToDoy(cl.last_frost_32f?.p50);
        let ff = mmddToDoy(cl.first_freeze_32f_p50);
        if (lf !== null && ff !== null) {
            if (ff < lf)
                ff += 365; // window wraps the year end (rare at these latitudes)
            return ((Math.floor((lf + ff) / 2) - 1) % 365) + 1;
        }
    }
    return lat !== null && lat < 0 ? 355 : 172; // southern vs northern solstice
}
const maxNum = (v) => {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    return x === null || x === undefined ? null : Number(x);
};
/** R-003 + R-004 over a placed layout - the mirror of dispatch._geometry_rules. Both fire only
 *  when there is a layout and a latitude; the R-003 threshold and each rule's derived ruling are
 *  read from the bundle, never hardcoded. */
export function geometryRules(layout, site, bundle) {
    const lat = site.lat;
    if (!layout || !layout.length || lat === null || lat === undefined)
        return [];
    const plants = [];
    for (const item of layout) {
        const r = resolveSpecies(item.species, item.group ?? null, bundle);
        const height = r.mature_height_cm;
        if (height === null || height === undefined)
            continue; // no height → nothing to reason about
        const spread = maxNum(r.mature_spread_cm);
        const plant = {
            id: item.species,
            x: item.x,
            y: item.y,
            height_cm: height,
            footprint_m: spread ? spread / 100.0 : 0.3,
            needs_sun: r.light_min === "full_sun",
        };
        if ("casts_shade" in r)
            plant.casts_shade = r.casts_shade;
        else
            plant.casts_shade = true;
        plants.push(plant);
    }
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const fired = (rule, subject, why) => ({
        rule,
        ruling: String(ruleById.get(rule)?.derived_ruling ?? ""),
        subject,
        why,
    });
    const out = [];
    const trigger = ruleById.get("R-003")?.trigger;
    const threshold = trigger?.threshold_cm ?? 120;
    for (const v of heightOrderingViolations(plants, threshold, lat)) {
        out.push(fired("R-003", [v.tall, v.shorter], `${v.tall} (${gFmt(v.tall_height_cm)} cm) sits equatorward of shorter ${v.shorter} (${gFmt(v.shorter_height_cm)} cm)`));
    }
    const doy = referenceDoy(lat, site.lon ?? null, bundle);
    for (const hit of shadowIntersections(plants, lat, doy)) {
        out.push(fired("R-004", [hit.target], `${hit.target} sits in the computed noon shadow of ${hit.caster}`));
    }
    return out;
}
