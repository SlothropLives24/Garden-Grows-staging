import { gFmt, resolveSpecies } from "./compiler.js";
import { matchSite } from "./intake.js";
const MIN_ALTITUDE_DEG = 3.0;
const DEG2RAD = Math.PI / 180.0;
export function solarDeclinationDeg(dayOfYear) {
    return 23.45 * Math.sin(DEG2RAD * (360.0 * (284 + dayOfYear)) / 365.0);
}
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
export function polarIsNorth(latDeg) {
    return latDeg >= 0.0;
}
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
export function shadowPolygon(plant, latDeg, dayOfYear) {
    const height = heightCm(plant);
    if (height <= 0)
        return null;
    let length = noonShadowLengthM(height, latDeg, dayOfYear);
    const [x0, y0, x1, y1] = footprintRect(plant);
    if (!Number.isFinite(length))
        length = 1e6;
    if (polarIsNorth(latDeg))
        return [x0, y1, x1, y1 + length];
    return [x0, y0 - length, x1, y0];
}
function boxesOverlap(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
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
            if (shorter.sheltered)
                continue;
            if (heightCm(shorter) < th && polarness(shorter) > polarness(tall)) {
                out.push({ tall: tall.id, shorter: shorter.id, tall_height_cm: th, shorter_height_cm: heightCm(shorter) });
            }
        }
    }
    return out;
}
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
export function shelterIntersections(plants, latDeg, dayOfYear) {
    const out = [];
    for (const target of plants) {
        if (!target.sheltered)
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
export function shelteredByShadow(resolved, shelters) {
    if (!shelters || !Object.keys(shelters).length)
        return false;
    if (shelters.bolt_risk === "present" && !resolved.bolt_risk)
        return false;
    if ("light_min" in shelters && resolved.light_min !== shelters.light_min)
        return false;
    return true;
}
export function shelterPredicate(bundle) {
    const r156 = bundle.rules.find((r) => r.id === "R-156");
    return r156?.trigger?.shelters ?? {};
}
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
export function referenceDoy(lat, lon, bundle) {
    const cl = lat != null && lon != null ? matchSite(lat, lon, bundle) : null;
    if (cl) {
        const lf = mmddToDoy(cl.last_frost_32f?.p50);
        let ff = mmddToDoy(cl.first_freeze_32f_p50);
        if (lf !== null && ff !== null) {
            if (ff < lf)
                ff += 365;
            return ((Math.floor((lf + ff) / 2) - 1) % 365) + 1;
        }
    }
    return lat !== null && lat < 0 ? 355 : 172;
}
const maxNum = (v) => {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    return x === null || x === undefined ? null : Number(x);
};
export function geometryRules(layout, site, bundle) {
    const lat = site.lat;
    if (!layout || !layout.length || lat === null || lat === undefined)
        return [];
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const r003Trigger = ruleById.get("R-003")?.trigger;
    const shelters = shelterPredicate(bundle);
    const honourShelter = r003Trigger?.sheltered_by === "R-156";
    const plants = [];
    for (const item of layout) {
        const r = resolveSpecies(item.species, item.group ?? null, bundle);
        const height = r.mature_height_cm;
        if (height === null || height === undefined)
            continue;
        const spread = maxNum(r.mature_spread_cm);
        const plant = {
            id: item.species,
            x: item.x,
            y: item.y,
            height_cm: height,
            footprint_m: spread ? spread / 100.0 : 0.3,
            needs_sun: r.light_min === "full_sun",
            sheltered: honourShelter && shelteredByShadow(r, shelters),
        };
        if ("casts_shade" in r)
            plant.casts_shade = r.casts_shade;
        else
            plant.casts_shade = true;
        plants.push(plant);
    }
    const fired = (rule, subject, why) => ({
        rule,
        ruling: String(ruleById.get(rule)?.derived_ruling ?? ""),
        subject,
        why,
    });
    const out = [];
    const threshold = r003Trigger?.threshold_cm ?? 120;
    for (const v of heightOrderingViolations(plants, threshold, lat)) {
        out.push(fired("R-003", [v.tall, v.shorter], `${v.tall} (${gFmt(v.tall_height_cm)} cm) sits equatorward of shorter ${v.shorter} (${gFmt(v.shorter_height_cm)} cm)`));
    }
    const doy = referenceDoy(lat, site.lon ?? null, bundle);
    for (const hit of shadowIntersections(plants, lat, doy)) {
        out.push(fired("R-004", [hit.target], `${hit.target} sits in the computed noon shadow of ${hit.caster}`));
    }
    if (Object.keys(shelters).length && ruleById.has("R-156")) {
        for (const hit of shelterIntersections(plants, lat, doy)) {
            out.push(fired("R-156", [hit.target], `${hit.target} sits in the computed noon shadow of ${hit.caster}, the summer shade it wants`));
        }
    }
    return out;
}
