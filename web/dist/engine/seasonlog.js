// Season log (D-013) - types + schema validation. DOM-free and portable: this is engine code,
// storage (IndexedDB) lives in the app layer and hands validated records in and out.
//
// TS port of engine/season_log.py, in the same relationship as compiler.ts ↔ compiler.py: Python
// is the oracle, and the conformance golden (web/testdata/season-log.golden.json) compares the
// full validation error lists BYTE-FOR-BYTE. Do not "improve" a message here without changing
// season_log.py in the same commit.
//
// Closed vocabularies are rejected loudly (D-013: "a free-text field is a field you cannot fit
// against"). end_cause + end_date are mandatory per the pinned schema; a planting may omit BOTH
// only while it is still in the ground, and complete=true (the close-season check) enforces the
// pair on every planting.
import { intersectArea, parseRegion } from "./regions.js";
// The closed vocabularies (docs/SEASON-LOG.md). Exported so the UI renders them as choices -
// the vocabulary is the input widget, free text never enters.
export const OBSERVATION_EVENTS = ["frost", "heat"];
export const OBSERVATION_SEVERITIES = ["light", "hard"];
export const END_CAUSES = ["frost", "disease", "pest", "pulled", "drought", "unknown"];
export const FAILURE_SEVERITIES = ["light", "moderate", "severe"];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const validPlantingId = (v) => typeof v === "string" && ID_RE.test(v);
const TOMB_FIELDS = new Set(["id", "at"]);
function validTombAt(v) {
    if (typeof v !== "string" || v.length !== 20 || v[10] !== "T" || !v.endsWith("Z"))
        return false;
    if (!validDate(v.slice(0, 10)))
        return false;
    const [h, m, sec] = v.slice(11, 19).split(":").map(Number);
    return Number.isInteger(h) && Number.isInteger(m) && Number.isInteger(sec)
        && h >= 0 && h <= 23 && m >= 0 && m <= 59 && sec >= 0 && sec <= 59;
}
const SEASON_FIELDS = new Set(["id", "plot", "plan", "observations", "plantings", "outcome_notes", "closed_date",
    "removed_plantings"]);
const OBSERVATION_FIELDS = new Set(["date", "event", "severity", "damage", "note"]);
// `composed` marks a planting written by the composed-planting flow (O68) - machine-composed
// plantings enter the rotation record distinguishable, never silently.
const PLANTING_FIELDS = new Set(["id", "species", "cultivar_group", "region", "sown", "transplanted",
    "first_harvest", "last_harvest", "end_cause", "end_date", "carried_over", "yield_kg", "failures", "notes", "composed"]);
const FAILURE_FIELDS = new Set(["date", "mode", "severity"]);
const NOTE_FIELDS = new Set(["date", "text", "photo"]);
const got = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const inVocab = (v, vocab) => typeof v === "string" && vocab.includes(v);
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** YYYY-MM-DD, real calendar (leap years included). Mirrors season_log.py valid_date. */
export function validDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s))
        return false;
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    if (m < 1 || m > 12)
        return false;
    let days = DAYS_IN_MONTH[m - 1];
    if (m === 2 && y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))
        days = 29;
    return d >= 1 && d <= days;
}
function unknownFields(rec, allowed, prefix, errors) {
    for (const k of Object.keys(rec).filter((k) => !allowed.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
}
function checkDate(rec, key, prefix, errors, required) {
    if (!(key in rec) && !required)
        return;
    if (!(key in rec) || !validDate(rec[key])) {
        errors.push(`${prefix}.${key}: expected YYYY-MM-DD, got ${got(rec, key)}`);
    }
}
function checkStr(rec, key, prefix, errors, what = "a string") {
    if (key in rec && (typeof rec[key] !== "string" || rec[key] === "")) {
        errors.push(`${prefix}.${key}: expected ${what}, got ${got(rec, key)}`);
    }
}
function validateObservation(obs, prefix, errors) {
    if (!isRecord(obs)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(obs, OBSERVATION_FIELDS, prefix, errors);
    checkDate(obs, "date", prefix, errors, true);
    const event = obs.event;
    if (!inVocab(event, OBSERVATION_EVENTS)) {
        errors.push(`${prefix}.event: ${got(obs, "event")} is not one of ${OBSERVATION_EVENTS.join(" | ")}`);
    }
    if (!("severity" in obs)) {
        // The frost severity IS the R-093 calibration payload - a frost without one is a lost
        // data point, so it is required. Heat events may carry a note instead.
        if (event === "frost") {
            errors.push(`${prefix}.severity: required for a frost observation (${OBSERVATION_SEVERITIES.join(" | ")})`);
        }
    }
    else if (!inVocab(obs.severity, OBSERVATION_SEVERITIES)) {
        errors.push(`${prefix}.severity: ${got(obs, "severity")} is not one of ${OBSERVATION_SEVERITIES.join(" | ")}`);
    }
    checkStr(obs, "damage", prefix, errors);
    checkStr(obs, "note", prefix, errors);
}
function validateFailure(f, prefix, errors) {
    if (!isRecord(f)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(f, FAILURE_FIELDS, prefix, errors);
    checkDate(f, "date", prefix, errors, true);
    if (typeof f.mode !== "string" || f.mode === "") {
        errors.push(`${prefix}.mode: expected a failure mode, got ${got(f, "mode")}`);
    }
    if (!inVocab(f.severity, FAILURE_SEVERITIES)) {
        errors.push(`${prefix}.severity: ${got(f, "severity")} is not one of ${FAILURE_SEVERITIES.join(" | ")}`);
    }
}
function validateNote(n, prefix, errors) {
    if (!isRecord(n)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(n, NOTE_FIELDS, prefix, errors);
    checkDate(n, "date", prefix, errors, true);
    if (typeof n.text !== "string" || n.text === "") {
        errors.push(`${prefix}.text: expected note text, got ${got(n, "text")}`);
    }
    // photo (D-171): the season file names the file; the bytes live beside it (the export zip /
    // the device store), never in the record. A bare filename only — a path separator would let
    // an imported file name reach outside the photo store's flat namespace.
    if ("photo" in n && (typeof n.photo !== "string" || n.photo === ""
        || n.photo.includes("/") || n.photo.includes("\\"))) {
        errors.push(`${prefix}.photo: expected a photo filename, got ${got(n, "photo")}`);
    }
}
function validatePlanting(p, prefix, errors, complete) {
    if (!isRecord(p)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(p, PLANTING_FIELDS, prefix, errors);
    if ("id" in p && !validPlantingId(p.id)) {
        errors.push(`${prefix}.id: expected a short [A-Za-z0-9_-] id, got ${got(p, "id")}`);
    }
    if (typeof p.species !== "string" || p.species === "") {
        errors.push(`${prefix}.species: expected a species id, got ${got(p, "species")}`);
    }
    checkStr(p, "cultivar_group", prefix, errors);
    if (!("region" in p)) {
        errors.push(`${prefix}.region: missing (a planting is somewhere)`);
    }
    else {
        try {
            parseRegion(p.region);
        }
        catch (e) {
            errors.push(`${prefix}.region: ${e.message}`);
        }
    }
    for (const key of ["sown", "transplanted", "first_harvest", "last_harvest"]) {
        checkDate(p, key, prefix, errors, false);
    }
    // carried_over (slice 3b): a plant still alive at close that persists into next season. It did
    // not end, so it must NOT carry an end pair - the two are mutually exclusive. A carried-over
    // planting counts as RESOLVED for the close check, so the end pair below is not required of it.
    let carried = false;
    if ("carried_over" in p) {
        if (p.carried_over === true)
            carried = true;
        else
            errors.push(`${prefix}.carried_over: expected true, got ${got(p, "carried_over")}`);
        if ("end_cause" in p || "end_date" in p) {
            errors.push(`${prefix}.carried_over: a carried-over planting has no end_cause/end_date (it did not end)`);
        }
    }
    // end_cause + end_date are mandatory per D-013; both absent together means the planting is still
    // in the ground, tolerated only while the season is open (complete=false) OR it carried over.
    if (!carried && (complete || "end_cause" in p || "end_date" in p)) {
        if (!inVocab(p.end_cause, END_CAUSES)) {
            errors.push(`${prefix}.end_cause: ${got(p, "end_cause")} is not one of ${END_CAUSES.join(" | ")}`);
        }
        checkDate(p, "end_date", prefix, errors, true);
    }
    if ("yield_kg" in p && (!isNum(p.yield_kg) || p.yield_kg < 0)) {
        errors.push(`${prefix}.yield_kg: expected a non-negative number, got ${got(p, "yield_kg")}`);
    }
    if ("failures" in p) {
        if (!Array.isArray(p.failures)) {
            errors.push(`${prefix}.failures: expected a list, got ${got(p, "failures")}`);
        }
        else {
            p.failures.forEach((f, j) => validateFailure(f, `${prefix}.failures[${j}]`, errors));
        }
    }
    if ("notes" in p) {
        if (!Array.isArray(p.notes)) {
            errors.push(`${prefix}.notes: expected a list, got ${got(p, "notes")}`);
        }
        else {
            p.notes.forEach((n, j) => validateNote(n, `${prefix}.notes[${j}]`, errors));
        }
    }
}
/** What families the ground under `candidate` carried, derived from logged plantings -
 *  occupancy is DERIVED, not declared: candidate region ∩ each planting's region, any overlap
 *  counts (v1). Mirrors engine/season_log.py derive_history; conformance-checked through the
 *  full path (derive → eligibleSpecies). Regions are plot coordinates, so the derivation
 *  survives any bed redesign (the moat). */
export function deriveHistory(candidate, seasons, bundle) {
    const cand = parseRegion(candidate);
    const familyOf = new Map(bundle.species.map((s) => [s.id, s.family]));
    const hostOf = new Map(bundle.species.map((s) => [s.id, !!s.verticillium_host]));
    const history = {};
    const contributions = [];
    const unknown = [];
    let reservoirHost = false;
    const ordered = [...seasons].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    for (const season of ordered) {
        const sid = String(season.id);
        const families = new Set();
        for (const p of season.plantings ?? []) {
            const overlap = intersectArea(cand, parseRegion(p.region));
            if (overlap <= 0)
                continue;
            if (!familyOf.has(p.species)) {
                if (!unknown.includes(p.species))
                    unknown.push(p.species);
                continue;
            }
            const family = familyOf.get(p.species);
            if (!family)
                continue;
            families.add(family);
            if (hostOf.get(p.species))
                reservoirHost = true;
            contributions.push({ season: sid, species: p.species, family, overlap_m2: overlap });
        }
        if (families.size)
            history[sid] = [...families].sort();
    }
    return { history, contributions, unknown_species: unknown.sort(), verticillium_reservoir: reservoirHost };
}
/** Carry a closed season's persisting plants into the next season (ISSUES #11 slice 4, D-121).
 *  Each carried_over planting from `prev` becomes a live planting on the SAME ground (region
 *  copied fresh - ground-rooted, so the plant occupies the same spot next year), keeping
 *  species/group/sown AND the carried_over marker itself: that marker is how the plan surfaces
 *  recognise already-in-the-ground stock and lay a new season's layout AROUND it (D-116/117) -
 *  dropping it made plan-around-occupancy a no-op in the very flow it was built for. End pairs
 *  never forward (the plant did not end; carried_over and end_cause are mutually exclusive).
 *  Deduped against `existing` (and earlier forwards), so reactivating twice is idempotent.
 *  Returns only the plantings to APPEND. Mirrors engine/season_log.py forward_carried. */
export function forwardCarried(prev, existing) {
    const out = [];
    for (const p of prev) {
        if (p.carried_over !== true || p.end_cause)
            continue;
        if ([...existing, ...out].some((q) => q.species === p.species && intersectArea(parseRegion(q.region), parseRegion(p.region)) > 0))
            continue;
        const fwd = { species: p.species, region: parseRegion(p.region), carried_over: true };
        if (p.cultivar_group)
            fwd.cultivar_group = p.cultivar_group;
        if (p.sown)
            fwd.sown = p.sown;
        out.push(fwd);
    }
    return out;
}
/** Every problem with a season record, or [] if it is valid. Collects ALL errors (an import
 *  should show everything wrong at once, not one complaint per attempt). complete=true is the
 *  close-season check: every planting must then carry its mandatory end_cause + end_date. */
export function validateSeason(raw, complete = false) {
    if (!isRecord(raw))
        return ["season: not a record"];
    const errors = [];
    unknownFields(raw, SEASON_FIELDS, "season", errors);
    if (!Number.isInteger(raw.id)) {
        errors.push(`season.id: expected an integer year, got ${got(raw, "id")}`);
    }
    if (typeof raw.plot !== "string" || raw.plot === "") {
        errors.push(`season.plot: expected a non-empty string, got ${got(raw, "plot")}`);
    }
    if ("plan" in raw && !Array.isArray(raw.plan)) {
        errors.push(`season.plan: expected a list, got ${got(raw, "plan")}`);
    }
    checkStr(raw, "outcome_notes", "season", errors);
    // A closed season carries its roll date and, being closed, is held to the completeness check:
    // every planting must be resolved (ended or carried over). closed_date present ⇒ complete.
    checkDate(raw, "closed_date", "season", errors, false);
    // removed_plantings (O56 merge arc): deletion tombstones, so a sync union cannot resurrect a
    // planting from a device that still holds a copy. An id may transiently appear both live and
    // tombstoned (mid-merge across devices); the merge resolves that by time, so it is not an error.
    if ("removed_plantings" in raw) {
        const tombs = raw.removed_plantings;
        if (!Array.isArray(tombs)) {
            errors.push(`season.removed_plantings: expected a list, got ${got(raw, "removed_plantings")}`);
        }
        else {
            tombs.forEach((t, i) => {
                if (!isRecord(t)) {
                    errors.push(`removed_plantings[${i}]: not a record`);
                    return;
                }
                unknownFields(t, TOMB_FIELDS, `removed_plantings[${i}]`, errors);
                if (!validPlantingId(t.id)) {
                    errors.push(`removed_plantings[${i}].id: expected a short [A-Za-z0-9_-] id, got ${got(t, "id")}`);
                }
                if (!validTombAt(t.at)) {
                    errors.push(`removed_plantings[${i}].at: expected an ISO UTC instant (YYYY-MM-DDThh:mm:ssZ), got ${got(t, "at")}`);
                }
            });
        }
    }
    const effectiveComplete = complete || "closed_date" in raw;
    for (const key of ["observations", "plantings"]) {
        if (!(key in raw))
            continue;
        const items = raw[key];
        if (!Array.isArray(items)) {
            errors.push(`season.${key}: expected a list, got ${got(raw, key)}`);
            continue;
        }
        items.forEach((item, i) => {
            if (key === "observations")
                validateObservation(item, `observations[${i}]`, errors);
            else
                validatePlanting(item, `plantings[${i}]`, errors, effectiveComplete);
        });
    }
    // a duplicate planting id would corrupt the union-by-id merge silently - refused loudly here
    if (Array.isArray(raw.plantings)) {
        const seen = new Map();
        raw.plantings.forEach((p, i) => {
            const pid = isRecord(p) ? p.id : undefined;
            if (typeof pid === "string" && pid) {
                const first = seen.get(pid);
                if (first !== undefined) {
                    errors.push(`plantings[${i}].id: duplicate of plantings[${first}].id `
                        + `(${JSON.stringify(pid)}) - planting ids must be unique within a season`);
                }
                else
                    seen.set(pid, i);
            }
        });
    }
    return errors;
}
