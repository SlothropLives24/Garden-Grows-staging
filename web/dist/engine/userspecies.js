// User species overlay (roadmap corpus-growth) - types, validation, capabilities, and the merge
// that folds a user record into the species set so the whole engine reasons over it for free.
// DOM-free and portable: storage (IndexedDB) lives in the app layer and hands validated records
// in and out, exactly like the season log.
//
// TS port of engine/userspecies.py, in the same relationship as seasonlog.ts ↔ season_log.py:
// Python is the oracle, and the conformance golden (web/testdata/user-species.golden.json) compares
// the validation error lists BYTE-FOR-BYTE and the capability reports and overlay results too. Do
// not "improve" a message here without changing userspecies.py in the same commit.
//
// A user species is USER DATA - it lives in the transactional store, is tagged source:"user", never
// touches the corpus, and carries no evidence grade. Ids are user:<slug>-namespaced so they can
// never collide with or override a corpus species. `family` is a free lowercased string, not an
// allowlist. Numeric fields are optional and default to unknown - never a guessed number.
// Closed vocabularies, matching corpus usage exactly. Exported so the UI renders them as choices -
// the vocabulary is the input widget, free text never enters. Open-vocabulary fields (habit,
// support.provides/requires) are validated as non-empty strings, not against an allowlist.
export const LIFESPANS = ["annual", "biennial", "perennial"];
export const FROST_TOLERANCES = ["tender", "half_hardy", "hardy"];
export const LIGHT_LEVELS = ["full_sun", "part_sun", "part_shade", "full_shade"];
export const FEEDER_CLASSES = ["heavy", "moderate", "light", "fixer", "none"];
export const GROUND_COVERAGES = ["none", "low", "moderate", "high"];
export const POLLINATOR_VALUES = ["none", "low", "moderate", "high", "very_high"];
export const SOW_SEASONS = ["spring", "fall"]; // a fall-sown crop is excluded from the spring cool-season window
// O80c: the CLOSED support vocabulary the form offers - free text could never satisfy or trigger
// R-040's === "strong" test, so a user's climbing plant was invisible to the one rule about it.
// The validator stays permissive for old records; the form stops minting new unreadable values.
export const SUPPORT_PROVIDES = ["none", "weak", "strong"];
export const SUPPORT_REQUIRES = ["none", "weak", "moderate", "optional_strong", "strong"];
// Deliberately NO verticillium_host, though verticillium_susceptible IS allowed: the two differ in
// blast radius. verticillium_susceptible is self-limiting (blocks only the user's own plant from host
// ground); verticillium_host is outward (it would make the ground refuse OTHER corpus species for
// years) - too heavy to grant from ungraded user input. A user Solanaceae variety still builds the
// reservoir via the family signal; a user non-Solanaceae host does not (under-warns, never
// false-warns). Mirrors engine/userspecies.py; see D-026 and SESSION 12ad.
const USER_SPECIES_FIELDS = new Set(["id", "source", "common", "family", "lifespan",
    "frost_tolerance", "light_min", "feeder_class", "n_fixing", "habit", "ground_coverage",
    "casts_shade", "pollinator_value", "volatile_aromatic", "verticillium_susceptible",
    "mature_height_cm", "mature_spread_cm", "days_to_maturity", "hardiness_zone", "support", "notes",
    // Calendar-timing refinements (read by the web calendar, not the Python engine): a per-species
    // succession cadence, an indoor-start lead, a spring-vs-fall sow season, and a heat ceiling (R-030).
    // Still NO scheduling_model / gdd_* - a user plant is days-to-maturity or unknown, never GDD (D-004).
    "succession_interval_days", "start_indoors_weeks", "sow_season", "night_temp_max_c"]);
const SUPPORT_FIELDS = new Set(["provides", "requires", "provides_load_vines"]);
// Traits a guild role predicate can match on (compiler PREDICATE_FIELDS), minus the two that alone
// demonstrate no mechanism. A record carrying at least one of these CAN be offered for a role.
const ROLE_TRAITS = ["habit", "n_fixing", "casts_shade", "ground_coverage", "pollinator_value",
    "volatile_aromatic", "frost_tolerance", "light_min", "feeder_class", "mature_height_cm",
    "mature_spread_cm", "support"];
const ID_RE = /^user:[a-z0-9_]+$/;
const got = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** A scalar number or a [lo, hi] range of finite numbers with lo <= hi. Mirrors _is_measure. */
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
/** Every problem with a user-species record, or [] if it is valid. Collects ALL errors at once.
 *  Mirrors engine/userspecies.py validate_user_species; error order and strings are pinned by the
 *  conformance golden. */
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
/** Which rules a VALID user record can participate in, given the fields it carries, and why not
 *  where it cannot. Mirrors engine/userspecies.py capabilities; ordered rotation, placement,
 *  schedule, guild_role so the report serializes identically in both engines. */
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
/** Fold validated user records into the bundle's species set, tagged source:"user" and with
 *  `family` lowercased. The whole engine then reasons over them unchanged. User ids are
 *  user:-namespaced, so they never collide with or override a corpus species (the compiler builds a
 *  Map from this array, last-wins on id, matching merge_into_cx's dict semantics). Records that are
 *  not records with a proper user id are skipped - the caller validates first. */
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
