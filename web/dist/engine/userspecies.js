export const LIFESPANS = ["annual", "biennial", "perennial"];
export const FROST_TOLERANCES = ["tender", "half_hardy", "hardy"];
export const LIGHT_LEVELS = ["full_sun", "part_sun", "part_shade", "full_shade"];
export const FEEDER_CLASSES = ["heavy", "moderate", "light", "fixer", "none"];
export const GROUND_COVERAGES = ["none", "low", "moderate", "high"];
export const POLLINATOR_VALUES = ["none", "low", "moderate", "high", "very_high"];
export const SOW_SEASONS = ["spring", "fall"];
export const SUPPORT_PROVIDES = ["none", "weak", "strong"];
export const SUPPORT_REQUIRES = ["none", "weak", "moderate", "optional_strong", "strong"];
const USER_SPECIES_FIELDS = new Set(["id", "source", "common", "family", "lifespan",
    "frost_tolerance", "light_min", "feeder_class", "n_fixing", "habit", "ground_coverage",
    "casts_shade", "pollinator_value", "volatile_aromatic", "verticillium_susceptible",
    "mature_height_cm", "mature_spread_cm", "days_to_maturity", "hardiness_zone", "support", "notes",
    "succession_interval_days", "start_indoors_weeks", "sow_season", "night_temp_max_c"]);
const SUPPORT_FIELDS = new Set(["provides", "requires", "provides_load_vines"]);
const ROLE_TRAITS = ["habit", "n_fixing", "casts_shade", "ground_coverage", "pollinator_value",
    "volatile_aromatic", "frost_tolerance", "light_min", "feeder_class", "mature_height_cm",
    "mature_spread_cm", "support"];
const ID_RE = /^user:[a-z0-9_]+$/;
const got = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function isMeasure(v) {
    if (isNum(v))
        return true;
    if (Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every(isNum)) {
        return v.length === 1 || v[0] <= v[1];
    }
    return false;
}
function unknownFields(rec, allowed, prefix, errors) {
    for (const k of Object.keys(rec).filter((k) => !allowed.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
}
function checkEnum(rec, key, allowed, prefix, errors) {
    if (key in rec && !allowed.includes(rec[key])) {
        errors.push(`${prefix}.${key}: ${got(rec, key)} is not one of ${allowed.join(" | ")}`);
    }
}
function checkBool(rec, key, prefix, errors) {
    if (key in rec && typeof rec[key] !== "boolean") {
        errors.push(`${prefix}.${key}: expected true or false, got ${got(rec, key)}`);
    }
}
function checkMeasure(rec, key, prefix, errors) {
    if (key in rec && !isMeasure(rec[key])) {
        errors.push(`${prefix}.${key}: expected a number or [lo, hi], got ${got(rec, key)}`);
    }
}
export function validateUserSpecies(raw, prefix = "user_species") {
    if (!isRecord(raw))
        return [`${prefix}: not a record`];
    const errors = [];
    unknownFields(raw, USER_SPECIES_FIELDS, prefix, errors);
    if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) {
        errors.push(`${prefix}.id: expected "user:<slug>" (lowercase a-z 0-9 _), got ${got(raw, "id")}`);
    }
    if (!("common" in raw)) {
        errors.push(`${prefix}.common: a plant needs a name, got missing`);
    }
    else {
        const common = raw.common;
        if (typeof common === "string") {
            if (common === "")
                errors.push(`${prefix}.common: expected a non-empty name, got ${JSON.stringify(common)}`);
        }
        else if (Array.isArray(common)) {
            if (common.length === 0 || !common.every((x) => typeof x === "string" && x !== "")) {
                errors.push(`${prefix}.common: expected non-empty names, got ${JSON.stringify(common)}`);
            }
        }
        else {
            errors.push(`${prefix}.common: expected a name or list of names, got ${JSON.stringify(common)}`);
        }
    }
    if ("source" in raw && raw.source !== "user") {
        errors.push(`${prefix}.source: must be "user" if present, got ${got(raw, "source")}`);
    }
    if ("family" in raw && (typeof raw.family !== "string" || raw.family === "")) {
        errors.push(`${prefix}.family: expected a non-empty family name, got ${got(raw, "family")}`);
    }
    if ("habit" in raw && (typeof raw.habit !== "string" || raw.habit === "")) {
        errors.push(`${prefix}.habit: expected a non-empty habit, got ${got(raw, "habit")}`);
    }
    checkEnum(raw, "lifespan", LIFESPANS, prefix, errors);
    checkEnum(raw, "frost_tolerance", FROST_TOLERANCES, prefix, errors);
    checkEnum(raw, "light_min", LIGHT_LEVELS, prefix, errors);
    checkEnum(raw, "feeder_class", FEEDER_CLASSES, prefix, errors);
    checkEnum(raw, "ground_coverage", GROUND_COVERAGES, prefix, errors);
    checkEnum(raw, "pollinator_value", POLLINATOR_VALUES, prefix, errors);
    checkEnum(raw, "sow_season", SOW_SEASONS, prefix, errors);
    for (const key of ["n_fixing", "casts_shade", "volatile_aromatic", "verticillium_susceptible"]) {
        checkBool(raw, key, prefix, errors);
    }
    for (const key of ["mature_height_cm", "mature_spread_cm", "days_to_maturity", "succession_interval_days"]) {
        checkMeasure(raw, key, prefix, errors);
    }
    if ("start_indoors_weeks" in raw
        && !(isNum(raw.start_indoors_weeks) && raw.start_indoors_weeks >= 0)) {
        errors.push(`${prefix}.start_indoors_weeks: expected a non-negative number, `
            + `got ${got(raw, "start_indoors_weeks")}`);
    }
    if ("night_temp_max_c" in raw && !isNum(raw.night_temp_max_c)) {
        errors.push(`${prefix}.night_temp_max_c: expected a number, got ${got(raw, "night_temp_max_c")}`);
    }
    if ("hardiness_zone" in raw) {
        const hz = raw.hardiness_zone;
        const ok = Array.isArray(hz) && hz.length === 2 && hz.every(isNum) && hz[0] <= hz[1];
        if (!ok)
            errors.push(`${prefix}.hardiness_zone: expected [lo, hi] zones, got ${got(raw, "hardiness_zone")}`);
    }
    if ("support" in raw) {
        const support = raw.support;
        if (!isRecord(support)) {
            errors.push(`${prefix}.support: expected a record, got ${got(raw, "support")}`);
        }
        else {
            for (const k of Object.keys(support).filter((k) => !SUPPORT_FIELDS.has(k)).sort()) {
                errors.push(`${prefix}.support: unknown field "${k}"`);
            }
            for (const k of ["provides", "requires"]) {
                if (k in support && (typeof support[k] !== "string" || support[k] === "")) {
                    errors.push(`${prefix}.support.${k}: expected a non-empty string, got ${got(support, k)}`);
                }
            }
            if ("provides_load_vines" in support
                && !(isNum(support.provides_load_vines) && support.provides_load_vines >= 0)) {
                errors.push(`${prefix}.support.provides_load_vines: expected a non-negative number, `
                    + `got ${got(support, "provides_load_vines")}`);
            }
        }
    }
    if ("notes" in raw && typeof raw.notes !== "string") {
        errors.push(`${prefix}.notes: expected a string, got ${got(raw, "notes")}`);
    }
    return errors;
}
export function capabilities(raw) {
    const has = (key) => key in raw && raw[key] !== null && raw[key] !== undefined;
    const rotation = Boolean(raw.family);
    const placement = has("mature_spread_cm");
    const schedule = has("days_to_maturity");
    const guild_role = ROLE_TRAITS.some((t) => has(t));
    const limits = [];
    if (!rotation)
        limits.push("rotation history not tracked: no family");
    if (!placement)
        limits.push("cannot be placed in a bed: no mature_spread_cm");
    if (!schedule)
        limits.push("no calendar dates: no days_to_maturity");
    if (!guild_role)
        limits.push("cannot fill a guild role: no matchable traits");
    return { rotation, placement, schedule, guild_role, limits };
}
export function mergeUserSpecies(bundle, records) {
    const extra = [];
    for (const rec of records ?? []) {
        if (!isRecord(rec))
            continue;
        const sid = rec.id;
        if (typeof sid !== "string" || !ID_RE.test(sid))
            continue;
        const merged = { ...rec, source: "user" };
        if (typeof merged.family === "string")
            merged.family = merged.family.toLowerCase();
        extra.push(merged);
    }
    return { ...bundle, species: [...bundle.species, ...extra] };
}
