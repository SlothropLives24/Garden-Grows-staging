import { intersectArea, parseRegion } from "./regions.js";
export const OBSERVATION_EVENTS = ["note", "frost", "heat"];
export const OBSERVATION_SEVERITIES = ["light", "hard"];
export const END_CAUSES = ["frost", "disease", "pest", "pulled", "drought", "unknown"];
export const FAILURE_SEVERITIES = ["light", "moderate", "severe"];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const validPlantingId = (v) => typeof v === "string" && ID_RE.test(v);
const TOMB_FIELDS = new Set(["id", "at"]);
const PLANTED_FROM_FIELDS = new Set(["area", "guild"]);
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
    "removed_plantings", "next_plan", "planted_from"]);
const OBSERVATION_FIELDS = new Set(["date", "event", "severity", "damage", "note"]);
const PLANTING_FIELDS = new Set(["id", "species", "cultivar_group", "region", "sown", "transplanted",
    "first_harvest", "last_harvest", "end_cause", "end_date", "carried_over", "yield_kg", "failures", "notes", "composed"]);
const FAILURE_FIELDS = new Set(["date", "mode", "severity"]);
const NOTE_FIELDS = new Set(["date", "text", "photo"]);
export const SEASON_NAME_MAX = 200;
export const SEASON_TEXT_MAX = 5000;
export const SEASON_BLOB_MAX = 20000;
export const SEASON_LIST_MAX = 2000;
const got = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const inVocab = (v, vocab) => typeof v === "string" && vocab.includes(v);
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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
function checkStr(rec, key, prefix, errors, what = "a string", max = SEASON_NAME_MAX) {
    if (!(key in rec))
        return;
    const v = rec[key];
    if (typeof v !== "string" || v === "")
        errors.push(`${prefix}.${key}: expected ${what}, got ${got(rec, key)}`);
    else if (v.length > max)
        errors.push(`${prefix}.${key}: longer than ${max} characters`);
}
function tooMany(items, prefix, key, errors) {
    if (items.length <= SEASON_LIST_MAX)
        return false;
    errors.push(`${prefix}.${key}: more than ${SEASON_LIST_MAX} entries`);
    return true;
}
function checkOpaqueList(raw, key, errors) {
    if (!(key in raw))
        return;
    const items = raw[key];
    if (!Array.isArray(items)) {
        errors.push(`season.${key}: expected a list, got ${got(raw, key)}`);
        return;
    }
    if (tooMany(items, "season", key, errors))
        return;
    items.forEach((entry, i) => {
        if ((JSON.stringify(entry) ?? "").length > SEASON_BLOB_MAX) {
            errors.push(`season.${key}[${i}]: longer than ${SEASON_BLOB_MAX} characters when serialised`);
        }
    });
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
        if (event === "frost") {
            errors.push(`${prefix}.severity: required for a frost observation (${OBSERVATION_SEVERITIES.join(" | ")})`);
        }
    }
    else if (!inVocab(obs.severity, OBSERVATION_SEVERITIES)) {
        errors.push(`${prefix}.severity: ${got(obs, "severity")} is not one of ${OBSERVATION_SEVERITIES.join(" | ")}`);
    }
    checkStr(obs, "damage", prefix, errors, "a string", SEASON_TEXT_MAX);
    checkStr(obs, "note", prefix, errors, "a string", SEASON_TEXT_MAX);
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
    else if (f.mode.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.mode: longer than ${SEASON_NAME_MAX} characters`);
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
    else if (n.text.length > SEASON_TEXT_MAX) {
        errors.push(`${prefix}.text: longer than ${SEASON_TEXT_MAX} characters`);
    }
    if ("photo" in n && (typeof n.photo !== "string" || n.photo === ""
        || n.photo.includes("/") || n.photo.includes("\\"))) {
        errors.push(`${prefix}.photo: expected a photo filename, got ${got(n, "photo")}`);
    }
    else if (typeof n.photo === "string" && n.photo.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.photo: longer than ${SEASON_NAME_MAX} characters`);
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
    else if (p.species.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.species: longer than ${SEASON_NAME_MAX} characters`);
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
        else if (!tooMany(p.failures, prefix, "failures", errors)) {
            p.failures.forEach((f, j) => validateFailure(f, `${prefix}.failures[${j}]`, errors));
        }
    }
    if ("notes" in p) {
        if (!Array.isArray(p.notes)) {
            errors.push(`${prefix}.notes: expected a list, got ${got(p, "notes")}`);
        }
        else if (!tooMany(p.notes, prefix, "notes", errors)) {
            p.notes.forEach((n, j) => validateNote(n, `${prefix}.notes[${j}]`, errors));
        }
    }
}
export function seedNextPlan(prev, target) {
    const seeded = (prev?.next_plan ?? [])
        .filter((e) => e.year === target.id && typeof e.area === "string" && typeof e.guild === "string");
    if (!seeded.length)
        return target;
    const have = new Set((target.plan ?? []).map((e) => e.area));
    const plan = [...(target.plan ?? []),
        ...seeded.filter((e) => !have.has(e.area)).map(({ area, guild, saved }) => ({ area, guild, ...(saved ? { saved } : {}) }))];
    return { ...target, plan };
}
export function deriveHistory(candidate, seasons, bundle) {
    const cand = parseRegion(candidate);
    const familyOf = new Map(bundle.species.map((s) => [s.id, s.family]));
    const hostOf = new Map(bundle.species.map((s) => [s.id, !!s.verticillium_host]));
    const leadOf = new Map(bundle.species.map((s) => [s.id, s.allelopathy?.residue_lead_days]));
    const history = {};
    const contributions = [];
    const unknown = [];
    let reservoirHost = false;
    const residueBySeason = new Map();
    let latestAny = null;
    const ordered = [...seasons].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    for (const season of ordered) {
        const sid = String(season.id);
        const families = new Set();
        for (const p of season.plantings ?? []) {
            const overlap = intersectArea(cand, parseRegion(p.region));
            if (overlap <= 0)
                continue;
            if (latestAny === null || sid > latestAny)
                latestAny = sid;
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
            const lead = leadOf.get(p.species);
            if (typeof lead === "number") {
                const list = residueBySeason.get(sid) ?? [];
                if (!list.some((r) => r.species === p.species))
                    list.push({ species: p.species, lead_days: lead });
                residueBySeason.set(sid, list);
            }
            contributions.push({ season: sid, species: p.species, family, overlap_m2: overlap });
        }
        if (families.size)
            history[sid] = [...families].sort();
    }
    const residueSeasons = [...residueBySeason.keys()].sort();
    const latest = residueSeasons.length ? residueSeasons[residueSeasons.length - 1] : null;
    const allelopathic_residue = latest !== null && latest === latestAny
        ? [...residueBySeason.get(latest)].sort((a, b) => (a.species < b.species ? -1 : a.species > b.species ? 1 : 0))
        : [];
    const last_season_species = latestAny !== null
        ? [...new Set(contributions.filter((c) => c.season === latestAny).map((c) => c.species))].sort()
        : [];
    return { history, contributions, unknown_species: unknown.sort(), verticillium_reservoir: reservoirHost, allelopathic_residue, last_season_species };
}
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
    else if (raw.plot.length > SEASON_NAME_MAX) {
        errors.push(`season.plot: longer than ${SEASON_NAME_MAX} characters`);
    }
    checkOpaqueList(raw, "plan", errors);
    checkOpaqueList(raw, "next_plan", errors);
    checkStr(raw, "outcome_notes", "season", errors, "a string", SEASON_BLOB_MAX);
    checkDate(raw, "closed_date", "season", errors, false);
    if ("removed_plantings" in raw) {
        const tombs = raw.removed_plantings;
        if (!Array.isArray(tombs)) {
            errors.push(`season.removed_plantings: expected a list, got ${got(raw, "removed_plantings")}`);
        }
        else if (!tooMany(tombs, "season", "removed_plantings", errors)) {
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
    if ("planted_from" in raw) {
        const pf = raw.planted_from;
        if (!Array.isArray(pf)) {
            errors.push(`season.planted_from: expected a list, got ${got(raw, "planted_from")}`);
        }
        else if (!tooMany(pf, "season", "planted_from", errors)) {
            pf.forEach((r, i) => {
                if (!isRecord(r)) {
                    errors.push(`planted_from[${i}]: not a record`);
                    return;
                }
                unknownFields(r, PLANTED_FROM_FIELDS, `planted_from[${i}]`, errors);
                if (typeof r.area !== "string" || !r.area) {
                    errors.push(`planted_from[${i}].area: expected a non-empty string, got ${got(r, "area")}`);
                }
                else if (r.area.length > SEASON_NAME_MAX) {
                    errors.push(`planted_from[${i}].area: longer than ${SEASON_NAME_MAX} characters`);
                }
                if (typeof r.guild !== "string" || !r.guild) {
                    errors.push(`planted_from[${i}].guild: expected a non-empty string, got ${got(r, "guild")}`);
                }
                else if (r.guild.length > SEASON_NAME_MAX) {
                    errors.push(`planted_from[${i}].guild: longer than ${SEASON_NAME_MAX} characters`);
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
        if (tooMany(items, "season", key, errors))
            continue;
        items.forEach((item, i) => {
            if (key === "observations")
                validateObservation(item, `observations[${i}]`, errors);
            else
                validatePlanting(item, `plantings[${i}]`, errors, effectiveComplete);
        });
    }
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
