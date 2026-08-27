// The git-format season file (D-013's one non-negotiable): the export is BYTE-IDENTICAL to what
// a git-backed log (storage v2) would commit - YAML, one file per season, the docs/SEASON-LOG.md
// schema. Costs nothing today, buys the entire migration path. DOM-free: string ↔ objects only;
// the download button and the paste box live in the app layer.
//
// This is a hand-rolled emitter/parser for THIS fixed schema, deliberately not a YAML library
// (none may be added - the engine is dependency-free, and a general YAML lib is a general
// attack surface for a format we emit ourselves). Byte-stability rules:
//   - fixed key order (the schema's order), fixed 2-space indent, one blank line before each
//     section (plan / observations / plantings / outcome_notes);
//   - observations, failures and notes are one-line flow maps, plantings are block maps, regions
//     are flow maps - exactly the shapes the pinned schema example uses;
//   - strings are bare iff /^[A-Za-z0-9_][A-Za-z0-9_-]*$/, not number-shaped and not the word
//     true/false (so dates and ids stay bare, free text is JSON-quoted, and a boolean can never
//     be mistaken for a string on the way back); numbers use String(n); booleans use JSON;
//     `plan` is emitted as JSON flow (JSON is YAML), since its content belongs to the compiler,
//     not this schema.
//
// The parser tolerates the emitter's own output ONLY (docs/HANDOFF-season-log.md task 4) and
// validates the parsed record before returning it - a foreign or hand-mangled file is refused
// loudly with what is wrong, never half-imported. emit(parse(emit(x))) === emit(x), tested
// byte-for-byte in web/test.mjs.
import { validateSeason } from "./seasonlog.js";
const BARE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const NUMBER_SHAPED = /^-?\d+(\.\d+)?$/;
function scalar(v) {
    if (typeof v === "number")
        return String(v);
    if (typeof v === "string" && BARE.test(v) && !NUMBER_SHAPED.test(v)
        && v !== "true" && v !== "false")
        return v;
    return JSON.stringify(v); // free text, number-shaped and boolean-shaped strings stay unambiguous
}
function flow(pairs) {
    const present = pairs.filter(([, v]) => v !== undefined);
    return `{${present.map(([k, v]) => `${k}: ${scalar(v)}`).join(", ")}}`;
}
// Rect regions keep their original flow-map bytes (the pinned format). A polygon region is
// emitted as compact JSON flow - JSON is YAML, the same idiom `plan` already uses - so the
// nested points array never strains the hand-rolled flow-map parser.
const regionFlow = (r) => r.shape === "polygon"
    ? JSON.stringify({ shape: r.shape, points: r.points })
    : flow([["shape", r.shape], ["x", r.x], ["y", r.y], ["w", r.w], ["h", r.h]]);
const observationFlow = (o) => flow([["date", o.date], ["event", o.event], ["severity", o.severity],
    ["damage", o.damage], ["note", o.note]]);
const failureFlow = (f) => flow([["date", f.date], ["mode", f.mode], ["severity", f.severity]]);
const noteFlow = (n) => flow([["date", n.date], ["text", n.text], ["photo", n.photo]]);
/** Serialize a season to the git-format file. Refuses an invalid record - what gets exported
 *  (and one day committed) is always a valid season. */
export function emitSeason(season) {
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`refusing to export an invalid season:\n${errors.join("\n")}`);
    const out = ["season:", `  id: ${scalar(season.id)}`, `  plot: ${scalar(season.plot)}`];
    if (season.plan !== undefined) {
        out.push("", `  plan: ${JSON.stringify(season.plan)}`);
    }
    if (season.observations !== undefined) {
        out.push("");
        if (season.observations.length === 0)
            out.push("  observations: []");
        else {
            out.push("  observations:");
            for (const o of season.observations)
                out.push(`  - ${observationFlow(o)}`);
        }
    }
    if (season.plantings !== undefined) {
        out.push("");
        if (season.plantings.length === 0)
            out.push("  plantings: []");
        else {
            out.push("  plantings:");
            for (const p of season.plantings) {
                const field = (k, v, first = false) => {
                    if (v !== undefined)
                        out.push(`  ${first ? "-" : " "} ${k}: ${v}`);
                };
                field("species", scalar(p.species), true);
                // O56 merge arc: the planting's minted identity rides the export (additive - an id-less
                // planting emits the exact bytes it always did, so the pinned-format test holds unchanged).
                field("id", p.id === undefined ? undefined : scalar(p.id));
                field("cultivar_group", p.cultivar_group === undefined ? undefined : scalar(p.cultivar_group));
                field("region", regionFlow(p.region));
                for (const k of ["sown", "transplanted", "first_harvest", "last_harvest", "end_cause", "end_date"]) {
                    field(k, p[k] === undefined ? undefined : scalar(p[k]));
                }
                // carried_over and notes joined the emitted format with D-171 (photos): both were
                // validated vocabulary the exporter silently DROPPED - an exported-then-imported season
                // lost its notes and its carry-over markers. Additive: a season without them emits the
                // exact bytes it always did (the pinned-format test holds unchanged).
                field("carried_over", p.carried_over === undefined ? undefined : scalar(p.carried_over));
                field("yield_kg", p.yield_kg === undefined ? undefined : scalar(p.yield_kg));
                if (p.failures !== undefined) {
                    if (p.failures.length === 0)
                        field("failures", "[]");
                    else {
                        out.push("    failures:");
                        for (const f of p.failures)
                            out.push(`    - ${failureFlow(f)}`);
                    }
                }
                if (p.notes !== undefined) {
                    if (p.notes.length === 0)
                        field("notes", "[]");
                    else {
                        out.push("    notes:");
                        for (const nt of p.notes)
                            out.push(`    - ${noteFlow(nt)}`);
                    }
                }
            }
        }
    }
    if (season.removed_plantings !== undefined) {
        // O56 merge arc: deletion tombstones, JSON flow like `plan` - sync bookkeeping the record
        // carries so a deleted planting stays deleted across devices; additive when absent.
        out.push("", `  removed_plantings: ${JSON.stringify(season.removed_plantings)}`);
    }
    if (season.outcome_notes !== undefined) {
        out.push("", `  outcome_notes: ${JSON.stringify(season.outcome_notes)}`);
    }
    return out.join("\n") + "\n";
}
// --- the parser (tolerates the emitter's own output only) --------------------------
function fail(line, why) {
    throw new Error(`season file line ${line + 1}: ${why}`);
}
function parseScalar(tok, line) {
    if (tok.startsWith('"')) {
        try {
            return JSON.parse(tok);
        }
        catch {
            fail(line, `bad quoted string ${tok}`);
        }
    }
    if (NUMBER_SHAPED.test(tok))
        return Number(tok);
    if (tok === "[]")
        return [];
    if (tok === "true")
        return true; // carried_over; scalar() quotes the STRING "true", so no clash
    if (BARE.test(tok))
        return tok;
    fail(line, `unrecognised value ${JSON.stringify(tok)}`);
}
/** Split "{k: v, k: v}" into pairs, respecting quoted strings. Own-output flow maps only. */
function parseFlow(text, line) {
    if (!text.startsWith("{") || !text.endsWith("}"))
        fail(line, `expected a {…} flow map, got ${JSON.stringify(text)}`);
    const body = text.slice(1, -1);
    const rec = {};
    let i = 0;
    while (i < body.length) {
        const colon = body.indexOf(": ", i);
        if (colon < 0)
            fail(line, "malformed flow map");
        const key = body.slice(i, colon).trim();
        let j = colon + 2;
        let end;
        if (body[j] === '"') {
            end = j + 1;
            while (end < body.length && (body[end] !== '"' || body[end - 1] === "\\"))
                end++;
            end++;
        }
        else {
            end = body.indexOf(",", j);
            if (end < 0)
                end = body.length;
        }
        rec[key] = parseScalar(body.slice(j, end).trim(), line);
        i = end;
        if (body.slice(i, i + 2) === ", ")
            i += 2;
        else if (i < body.length)
            fail(line, "malformed flow map (expected ', ')");
    }
    return rec;
}
/** Parse a git-format season file back to a record. STRICT: accepts exactly what emitSeason
 *  writes, validates the result, and throws with every problem otherwise. */
export function parseSeasonFile(text) {
    const lines = text.split("\n");
    const season = {};
    let list = null; // the open observations/plantings list
    let listKey = "";
    let planting = null; // the open block-map planting
    let sublist = null; // the open failures/notes list inside it
    if (lines[0] !== "season:")
        fail(0, 'expected "season:"');
    for (let n = 1; n < lines.length; n++) {
        const line = lines[n];
        if (line === "")
            continue; // section separators (and the trailing newline)
        if (line.startsWith("    - ")) { // a failure/note entry
            if (!sublist)
                fail(n, "failure entry outside a failures list");
            sublist.push(parseFlow(line.slice(6), n));
        }
        else if (line.startsWith("    failures:") || line.startsWith("    notes:")) {
            const key = line.startsWith("    failures:") ? "failures" : "notes";
            if (!planting)
                fail(n, `${key} outside a planting`);
            const rest = line.slice(4 + key.length + 1);
            if (rest === "") {
                sublist = [];
                planting[key] = sublist;
            }
            else if (rest === " []")
                planting[key] = [];
            else
                fail(n, `malformed ${key}`);
        }
        else if (line.startsWith("  - ") || line.startsWith("    ")) { // list entry / planting field
            if (!list)
                fail(n, "list entry outside a list");
            const isNew = line.startsWith("  - ");
            const body = line.slice(4);
            if (listKey === "observations") {
                if (!isNew)
                    fail(n, "observations are one-line flow maps");
                list.push(parseFlow(body, n));
            }
            else { // plantings: block maps
                const colon = body.indexOf(": ");
                if (colon < 0)
                    fail(n, "malformed planting field");
                const key = body.slice(0, colon);
                const value = body.slice(colon + 2);
                if (isNew) {
                    planting = {};
                    sublist = null;
                    list.push(planting);
                }
                if (!planting)
                    fail(n, "planting field outside a planting");
                if (key === "region") {
                    if (value.startsWith('{"')) { // a polygon region, emitted as JSON flow
                        try {
                            planting[key] = JSON.parse(value);
                        }
                        catch {
                            fail(n, "region is not the JSON flow this exporter writes");
                        }
                    }
                    else
                        planting[key] = parseFlow(value, n);
                }
                else
                    planting[key] = parseScalar(value, n);
            }
        }
        else if (line.startsWith("  ")) { // top-level field
            planting = null;
            sublist = null;
            list = null;
            const body = line.slice(2);
            const colon = body.indexOf(":");
            if (colon < 0)
                fail(n, "malformed field");
            const key = body.slice(0, colon);
            const rest = body.slice(colon + 1);
            if (key === "observations" || key === "plantings") {
                if (rest === "") {
                    list = [];
                    listKey = key;
                    season[key] = list;
                }
                else if (rest === " []")
                    season[key] = [];
                else
                    fail(n, `malformed ${key}`);
            }
            else if (key === "plan" || key === "removed_plantings") {
                try {
                    season[key] = JSON.parse(rest.slice(1));
                }
                catch {
                    fail(n, `${key} is not the JSON flow this exporter writes`);
                }
            }
            else if (rest.startsWith(" ")) {
                season[key] = parseScalar(rest.slice(1), n);
            }
            else
                fail(n, `malformed field ${JSON.stringify(key)}`);
        }
        else
            fail(n, `unexpected line ${JSON.stringify(line)}`);
    }
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`imported season is invalid:\n${errors.join("\n")}`);
    return season;
}
