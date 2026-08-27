// Soil observations — P0 (D-148) and the pH gate of P1 (D-149). See docs/SOIL.md.
//
// Line-for-line port of engine/soil.py, in the same relationship as seasonlog.ts <-> season_log.py and
// userspecies.ts <-> userspecies.py: gen_web_conformance.py freezes the oracle's answers (error lists
// byte-for-byte, capability reports included) and web/conformance.mjs asserts this file matches. Do
// NOT change an error string here without changing soil.py in the same commit.
//
// A soil observation is what the GARDENER TELLS US about a piece of ground, at whatever fidelity they
// have. User data: it lives beside the season log, never in corpus/, and never carries an evidence
// grade. It attaches to GROUND, not a bed (D-002), so it survives a redesign and two beds over one
// patch share it — and it carries a DATE, because soil changes and an old reading is evidence about an
// earlier state of that ground rather than a stale value to overwrite.
//
// Tiers 0-2 (P0) record TEXTURE and DRAINAGE and gate nothing. Tiers 3-4 (P1) add a MEASURED pH and
// fire R-099, the pH floor gate — one-sided (below a plant's floor only, never above its ceiling,
// because no source publishes a vegetable's ceiling: D-149), never blocking, and never an amount. The
// rest of a lab report (buffer_ph, om_pct, lab, report_id, nutrients) is still REFUSED by name: a
// value the engine cannot read would look consulted and would not be. buffer_ph in particular is
// invariant 3 drawn in code — a lime RATE needs it, so collecting it without computing one would
// gather the single number whose only purpose we refuse to serve.
export const TEXTURES = ["sand", "sandy_loam", "loam", "clay_loam", "clay", "unknown"];
export const DRAINAGES = ["fast", "free", "slow", "waterlogged", "unknown"];
export const SOURCES = ["declared", "field_test", "kit", "lab"];
// What is IN a container or raised bed — a different question from what the ground is made of. A
// bought mix has no ribbon-test texture (peat, bark, coir and perlite do not ribbon), so asking a
// container gardener whether their soil is sandy or clay collects a fiction.
export const MEDIUMS = ["purchased_mix", "compost_blend", "native_soil", "unknown"];
// P3 accepts the lab report; nothing is deferred any more. Nutrients are stored as the LEVEL WORD
// the lab concluded, never the ppm it measured — storing the number would invite arithmetic, and
// invariant 3 says the arithmetic is the lab's.
export const NUTRIENTS = ["p", "k", "ca", "mg", "s"];
export const NUTRIENT_LEVELS = ["very_low", "low", "medium", "optimum", "high", "very_high"];
export const OM_MIN = 0.0, OM_MAX = 100.0;
// Fields only a lab report can carry — each refused with any other source.
const REPORT_FIELDS = ["buffer_ph", "om_pct", "lab", "report_id", "nutrients",
    "lab_recommendation"];
const SOIL_FIELDS = new Set(["plot", "region", "date", "source", "texture", "drainage", "notes",
    "medium", "ph", "amendment", ...REPORT_FIELDS]);
// A pH physically possible in a garden — NOT a judgement about whether anything grows there. HS1207
// records Florida soils from 3.3 to 9.0; the bounds only catch a slipped decimal or a broken meter,
// which would otherwise fire the gate on every plant in the bed.
export const PH_MIN = 3.0, PH_MAX = 10.0;
// What a home colourimetric kit is honestly worth. The reading is never rounded to it — it is
// reported with its error bar and kept as given.
export const KIT_PRECISION = 0.5;
// What the gardener DID to this ground, as opposed to what they observed about it — the first soil
// record that is an ACTION. It exists because it is what makes an older reading stop describing the
// ground (SOIL-UX §2).
export const AMENDMENTS = ["lime", "sulfur", "compost", "manure", "mulch", "other"];
// ...and only these two supersede a pH: they are applied FOR their effect on it. Compost, manure and
// mulch move pH slowly and incidentally, and claiming they invalidate a measurement would be
// inventing a mechanism to justify a prompt.
const PH_AMENDMENTS = ["lime", "sulfur"];
// Everything an observation can actually RECORD. A record carrying none of these says nothing.
const FACT_FIELDS = ["texture", "drainage", "medium", "ph", "amendment", ...REPORT_FIELDS];
// Sources that carry a pH measurement. Enforced BOTH ways: a `ph` without one of these came from
// nowhere, and one of these without a `ph` claims a tier it does not deliver.
const PH_SOURCES = ["kit", "lab"];
// A bed's declared structure (D-141) decides WHICH QUESTION to ask. Absent = in_ground, the corpus
// default.
const MEDIUM_STRUCTURES = ["container", "raised"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Matches soil.py's _j: JSON with sorted keys, or the word "missing". The strings are product — they
// are what a form shows the user — so they are compared byte-for-byte by the conformance oracle.
function j(v) {
    if (v === undefined)
        return "missing";
    if (v === null)
        return "null";
    if (Array.isArray(v))
        return `[${v.map((x) => j(x)).join(", ")}]`;
    if (typeof v === "object") {
        const o = v;
        return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}: ${j(o[k])}`).join(", ")}}`;
    }
    return JSON.stringify(v);
}
function got(rec, key) {
    return key in rec ? j(rec[key]) : "missing";
}
// Python renders a list of strings as ['a', 'b'] — single quotes. The error text is compared
// byte-for-byte, so this reproduces that rather than JSON's double quotes.
function pyList(items) {
    return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}
// One number format shared by both engines, for error text AND for prose. Python prints a float 11.0
// as "11.0" and JS prints it as "11" — and JSON's `11.0` parses to a float in Python and an integer
// in JS, so ANY message carrying a raw number would diverge byte-for-byte on that input alone.
// Python's _n() conforms to this, not the reverse: "6" reads better than "6.0" in a sentence a
// gardener sees, and it is the only formatting the two runtimes can agree on for free.
function n(v) {
    return Number.isInteger(v) ? String(Math.trunc(v)) : String(Math.round(v * 100) / 100);
}
/** Every problem with a soil observation, or [] if it is valid. Collects ALL errors at once — a form
 *  should surface everything wrong, not one complaint per attempt. Port of soil.py. */
export function validateObservation(raw, prefix = "soil") {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        return [`${prefix}: not a record`];
    const rec = raw;
    const errors = [];
    for (const k of Object.keys(rec).filter((k) => !SOIL_FIELDS.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
    const plot = rec.plot;
    if (typeof plot !== "string" || !plot) {
        errors.push(`${prefix}.plot: expected a non-empty plot id, got ${got(rec, "plot")}`);
    }
    const date = rec.date;
    if (typeof date !== "string" || !DATE_RE.test(date)) {
        errors.push(`${prefix}.date: expected an ISO date (soil changes, so WHEN is part of the ` +
            `observation), got ${got(rec, "date")}`);
    }
    const source = rec.source;
    const sourceOk = typeof source === "string" && SOURCES.includes(source);
    if (!("source" in rec) || !sourceOk) {
        errors.push(`${prefix}.source: expected one of ${pyList(SOURCES)}, got ${got(rec, "source")}`);
    }
    // pH and its source are a PAIR, enforced in both directions. A pH with a `declared` source is a
    // number the gardener remembered rather than measured, and the gate must not fire on a memory.
    const isPhSource = typeof source === "string" && PH_SOURCES.includes(source);
    if ("ph" in rec) {
        const ph = rec.ph;
        if (typeof ph !== "number" || !Number.isFinite(ph)) {
            errors.push(`${prefix}.ph: expected a number, got ${got(rec, "ph")}`);
        }
        else if (!(PH_MIN <= ph && ph <= PH_MAX)) {
            errors.push(`${prefix}.ph: ${n(ph)} is outside ${n(PH_MIN)}-${n(PH_MAX)}, which no ` +
                `garden soil reaches - check for a slipped decimal point or a broken meter`);
        }
        if (sourceOk && !isPhSource) {
            errors.push(`${prefix}.ph: a pH needs a measurement behind it, and source ` +
                `"${source}" is not one. Use ${pyList(PH_SOURCES)}.`);
        }
    }
    else if (isPhSource) {
        errors.push(`${prefix}.ph: source "${source}" is a pH reading, so the pH is what it is ` +
            `for - record it, or use a lower tier.`);
    }
    // --- the lab report (P3). TRANSCRIPTION, NOT CALCULATION.
    const present = REPORT_FIELDS.filter((k) => k in rec);
    if (present.length && sourceOk && source !== "lab") {
        errors.push(`${prefix}: ${pyList(present)} come off a lab report, and source "${source}" is ` +
            `not one. A buffer pH does not come off a home kit.`);
    }
    if ("buffer_ph" in rec) {
        const b = rec.buffer_ph;
        if (typeof b !== "number" || !Number.isFinite(b)) {
            errors.push(`${prefix}.buffer_ph: expected a number, got ${got(rec, "buffer_ph")}`);
        }
        else if (!(PH_MIN <= b && b <= PH_MAX)) {
            errors.push(`${prefix}.buffer_ph: ${n(b)} is outside ${n(PH_MIN)}-${n(PH_MAX)}`);
        }
    }
    if ("om_pct" in rec) {
        const o = rec.om_pct;
        if (typeof o !== "number" || !Number.isFinite(o)) {
            errors.push(`${prefix}.om_pct: expected a number, got ${got(rec, "om_pct")}`);
        }
        else if (!(OM_MIN <= o && o <= OM_MAX)) {
            errors.push(`${prefix}.om_pct: ${n(o)} is outside ${n(OM_MIN)}-${n(OM_MAX)} percent`);
        }
    }
    for (const key of ["lab", "report_id", "lab_recommendation"]) {
        if (key in rec && (typeof rec[key] !== "string" || !rec[key].trim())) {
            errors.push(`${prefix}.${key}: expected non-empty text, got ${got(rec, key)}`);
        }
    }
    if ("nutrients" in rec) {
        const nut = rec.nutrients;
        if (nut === null || typeof nut !== "object" || Array.isArray(nut)) {
            errors.push(`${prefix}.nutrients: expected a record of nutrient to level, got ` +
                `${got(rec, "nutrients")}`);
        }
        else {
            const m = nut;
            for (const k of Object.keys(m).sort()) {
                if (!NUTRIENTS.includes(k)) {
                    errors.push(`${prefix}.nutrients: "${k}" is not one of ${pyList(NUTRIENTS)}`);
                    continue;
                }
                const v = m[k];
                if (typeof v === "number") {
                    // The design decision of P3, stated where someone will hit it.
                    errors.push(`${prefix}.nutrients.${k}: give the level your lab CONCLUDED ` +
                        `(${pyList(NUTRIENT_LEVELS)}), not the number it measured. We store what the report ` +
                        `says, and we never do arithmetic on it.`);
                }
                else if (typeof v !== "string" || !NUTRIENT_LEVELS.includes(v)) {
                    errors.push(`${prefix}.nutrients.${k}: expected one of ${pyList(NUTRIENT_LEVELS)}, ` +
                        `got ${j(v)}`);
                }
            }
        }
    }
    // TEXTURE IS NO LONGER MANDATORY: an observation can legitimately carry only a drainage note or
    // only an amendment, and requiring a texture on those would force a re-assertion of a fact nobody
    // re-checked. The rule it becomes: a record must carry at least ONE fact.
    if (!FACT_FIELDS.some((k) => k in rec)) {
        errors.push(`${prefix}: this records nothing - give a texture, a drainage, a medium, a pH, ` +
            `or an amendment`);
    }
    if ("texture" in rec &&
        (typeof rec.texture !== "string" || !TEXTURES.includes(rec.texture))) {
        errors.push(`${prefix}.texture: expected one of ${pyList(TEXTURES)}, got ${got(rec, "texture")}`);
    }
    if ("amendment" in rec &&
        (typeof rec.amendment !== "string" || !AMENDMENTS.includes(rec.amendment))) {
        errors.push(`${prefix}.amendment: expected one of ${pyList(AMENDMENTS)}, got ${got(rec, "amendment")}`);
    }
    if ("drainage" in rec &&
        (typeof rec.drainage !== "string" || !DRAINAGES.includes(rec.drainage))) {
        errors.push(`${prefix}.drainage: expected one of ${pyList(DRAINAGES)}, got ${got(rec, "drainage")}`);
    }
    if ("medium" in rec &&
        (typeof rec.medium !== "string" || !MEDIUMS.includes(rec.medium))) {
        errors.push(`${prefix}.medium: expected one of ${pyList(MEDIUMS)}, got ${got(rec, "medium")}`);
    }
    if ("notes" in rec && typeof rec.notes !== "string") {
        errors.push(`${prefix}.notes: expected text, got ${got(rec, "notes")}`);
    }
    if ("region" in rec && rec.region !== null && rec.region !== undefined &&
        (typeof rec.region !== "object" || Array.isArray(rec.region))) {
        errors.push(`${prefix}.region: expected a region record or none (none means the whole ` +
            `plot), got ${got(rec, "region")}`);
    }
    return errors;
}
/** Which question this ground deserves: "medium" for a container or raised bed, "soil" otherwise. A
 *  container is filled with a bought or mixed medium, so its texture describes a bag rather than the
 *  gardener's ground; a raised bed is filled too, but sits ON native ground that roots and water both
 *  reach. Port of soil.py. */
export function asksFor(structure) {
    return structure && MEDIUM_STRUCTURES.includes(structure) ? "medium" : "soil";
}
/** What the engine can and cannot reason about, given this observation. Mirrors userspecies'
 *  capabilities() on purpose, so the two honesty reports read the same way. P1 is the first phase
 *  where `gates_rules` can be TRUE — when, and only when, a pH has been measured, and even then the
 *  gate is one-sided. Port of soil.py. */
export function capabilities(obs, structure, src) {
    // PYTHON'S EMPTY DICT IS FALSY AND JAVASCRIPT'S IS NOT, and resolveGround returns `{}` for ground
    // nobody has observed. Without this line the TS side treats "nothing recorded" as an observation
    // with everything unknown, and reports a different set of limits - which is exactly what the
    // byte-for-byte conformance goldens caught the first time this function was handed a resolved
    // record instead of a raw one.
    if (obs && Object.keys(obs).length === 0)
        obs = null;
    const asks = asksFor(structure);
    const knownTexture = !!obs && obs.texture !== undefined && obs.texture !== null &&
        obs.texture !== "unknown";
    const knownDrainage = !!obs && "drainage" in obs && obs.drainage !== undefined &&
        obs.drainage !== null && obs.drainage !== "unknown";
    const knownMedium = !!obs && "medium" in obs && obs.medium !== undefined &&
        obs.medium !== null && obs.medium !== "unknown";
    // `src` (from resolveGround) says how EACH field was arrived at; without it the record's own
    // `source` answers for everything, which is correct for a single observation.
    const how = (field) => (src ? src[field] : obs ? obs.source : undefined);
    const measured = !!obs && how("texture") === "field_test";
    const ph = obs ? obs.ph : undefined;
    const knownPh = typeof ph === "number" && Number.isFinite(ph);
    const kit = !!obs && how("ph") === "kit";
    // Presence is enough: the validator refuses a report field on any non-lab source.
    const report = !!obs && REPORT_FIELDS.some((k) => k in obs);
    const buffered = !!obs && typeof obs.buffer_ph === "number" && Number.isFinite(obs.buffer_ph);
    const limits = [];
    if (!obs) {
        limits.push("nothing recorded for this ground yet: nothing here is adjusted for it");
    }
    if (asks === "medium") {
        // Unconditional: a container is a container whether or not anything has been recorded for it.
        if (obs && !knownMedium)
            limits.push("what this bed is filled with is not recorded");
        if (structure === "container") {
            limits.push("a container is filled with a bought or mixed medium, so nothing here is " +
                "inferred from your native ground");
        }
        else {
            limits.push("a raised bed sits ON native ground: its fill is recorded, but drainage " +
                "still depends on what is underneath");
        }
    }
    else if (obs) {
        if (!knownTexture)
            limits.push("texture unknown: watering and root-spread guidance stays generic");
        else if (!measured)
            limits.push("texture declared, not measured: a ribbon test would firm it up");
        if (!knownDrainage)
            limits.push("drainage not recorded: waterlogging risk is not assessed");
        // `slow` is NOT gated (R-100 fires on standing water only), and the report says so rather than
        // letting a user read the gate's silence as a clean bill of health.
        else if (obs.drainage === "slow") {
            limits.push("slow drainage is recorded but not gated: the waterlogging rule fires on " +
                "water that STANDS after rain, which is what the sources measure");
        }
    }
    // INVARIANT 3 SURVIVES EVERY BRANCH: a measured pH buys the low-side gate and amendment DIRECTION,
    // never a fertilizer amount and never a lime rate.
    if (!knownPh) {
        limits.push("no soil test: pH-sensitive plants are not gated, and no fertilizer amount is " +
            "offered (a soil test is the only honest source for one)");
    }
    else {
        if (kit) {
            limits.push(`a home kit resolves about +/-${n(KIT_PRECISION)} pH: this reading gates ` +
                `plants but a lab test is what a lime rate needs`);
        }
        limits.push("only the LOW side is gated: no source read publishes a per-crop maximum for " +
            "a vegetable, so a pH above a plant's range is not flagged");
        // THE TOP OF THE LADDER, and invariant 3 does not relax here - it changes WHOSE number it is.
        if (!report) {
            limits.push("still no fertilizer amount and no lime rate: a rate needs the buffer pH from " +
                "a lab report, which is not recorded yet");
        }
        else {
            if (!obs?.lab) { // obs is non-null whenever report is true; optional chaining keeps tsc happy
                limits.push("which lab produced this report is not recorded: a reading is only as " +
                    "good as its source, and the report is what we repeat back");
            }
            if (buffered) {
                limits.push("your report carries buffer pH, so the lime rate PRINTED ON IT is a " +
                    "real one for this soil - use that number, not one from us and not " +
                    "one from the internet (R-101)");
            }
            else {
                limits.push("no buffer pH on this report: a lime rate needs it, because the same " +
                    "target pH takes very different amounts of lime in sand and in clay " +
                    "(R-101). Ask your lab for a lime requirement test");
            }
            limits.push("nutrient levels are repeated as your lab worded them and are never " +
                "converted into an amount - that arithmetic is the lab's, not ours");
        }
    }
    return { asks, texture: knownTexture && asks === "soil", drainage: knownDrainage,
        medium: knownMedium, measured, chemistry: knownPh, report, buffered,
        gates_rules: knownPh, limits };
}
/** The observation that applies to a piece of ground: newest by date, matching plot and region key
 *  (null = a whole-plot observation). Most-recent-wins is why `date` is mandatory. Port of soil.py. */
export function latestFor(observations, plot, regionKey = null) {
    let best = null;
    for (const o of observations ?? []) {
        if (!o || typeof o !== "object" || Array.isArray(o))
            continue;
        const rec = o;
        if (rec.plot !== plot)
            continue;
        const key = rec.region ?? null;
        if (regionKey === null || regionKey === undefined) {
            if (key !== null)
                continue;
        }
        else if (j(key) !== j(regionKey)) {
            continue;
        }
        if (best === null || String(rec.date ?? "") >= String(best.date ?? ""))
            best = rec;
    }
    return best;
}
// --- the ladder (SOIL-UX §1) ------------------------------------------------
// The five tiers as a LADDER the gardener climbs. THE RUNG IS NOT A SCORE AND THERE IS NO
// PERCENTAGE, deliberately: a percentage implies 100% is the goal, and rung 4 on every bed is not a
// sane goal for most gardeners — it would turn an honest capability report into a nag. What is
// reported is the rung reached and what the NEXT one buys, so the gardener can decline it.
export const RUNGS = ["nothing recorded", "described", "field tested", "pH measured",
    "lab report"];
// [cost, buys] for climbing TO rung i. Index 0 unused.
const RUNG_STEP = [
    null,
    ["about two minutes", "texture guidance, drainage warnings, and the waterlogging rule"],
    ["twenty minutes and nothing", "the same, graded higher - a measurement instead of a guess"],
    ["a home kit, about $15", "the pH rule, so plants below their floor are named"],
    ["a lab test, about $20 and two weeks", "your lab's own recommendation, repeated faithfully"],
];
/** Which rung this ground is on: 0 (nothing) to 4 (a lab report).
 *
 *  A LAB pH ON ITS OWN IS RUNG 3, not 4 — the top rung is the REPORT, because that is what changes
 *  what the app can say. A container is judged on its MEDIUM, not its texture, so a container
 *  gardener is not stuck at rung 0 for declining a question that does not apply.
 *
 *  DRAINAGE REACHES RUNG 1 ON ITS OWN (maintainer, 2026-07-27). It did not, and the file argued with
 *  itself in three places: validateObservation was deliberately changed to stop requiring a texture
 *  ("a record must carry at least ONE fact"), rung 1's own step text advertises "drainage warnings"
 *  as part of what it buys, and R-100 fires on a drainage of `waterlogged` whatever else is recorded.
 *  So a gardener who recorded standing water and nothing else got the full waterlogging card above a
 *  ladder reading "nothing recorded" — the app naming a rule it had fired on this ground while
 *  calling the ground undescribed. Rung 1 is DESCRIBED, and a drainage is a description.
 *
 *  `src` IS THE PER-FIELD PROVENANCE from resolveGround, and passing it is what stops the ladder
 *  DEMOTING a gardener (maintainer, 2026-07-27). Two of the four branches below ask "how was this
 *  known?", and a resolved record's scalar `source` is last-writer-wins — so logging "water stood
 *  here" in August, months after a ribbon test or a lab report, rewrote `source` to "declared" and the
 *  ladder fell from "field tested" to "described", or from "lab report" to "pH measured", with the
 *  ribbon test and the report both still on file. The app told the gardener they had lost a rung they
 *  still had, which for rung 4 means being nudged to re-buy a $20 lab test. Without `src` the record's
 *  own `source` answers for every field, which is correct for a single unresolved record and is why
 *  the parameter is optional. Port of soil.py. */
export function rung(obs, structure, src) {
    if (!obs)
        return 0;
    /** Which tier produced THIS field. Per-field when resolveGround's `src` is supplied. */
    const how = (field) => (src !== undefined && src !== null ? src[field] : obs.source);
    // The report fields can only come off a lab (the validator refuses them on any other source), so
    // asking their own provenance is exact rather than merely safer.
    const present = REPORT_FIELDS.filter((k) => k in obs);
    if (present.length && how(present[0]) === "lab")
        return 4;
    if (typeof obs.ph === "number" && Number.isFinite(obs.ph))
        return 3;
    // A container is judged on its medium, so the "was it measured?" question follows the same field.
    const knownField = asksFor(structure) === "medium" ? "medium" : "texture";
    if (how(knownField) === "field_test")
        return 2;
    const known = obs[knownField];
    if (known !== undefined && known !== null && known !== "unknown")
        return 1;
    return obs.drainage !== undefined && obs.drainage !== null && obs.drainage !== "unknown" ? 1 : 0;
}
/** The rung, its name, and what the next one costs and buys — null at the top. The honest
 *  counterpart of a progress bar: no finish line, only a next step you may decline.
 *
 *  `src` is passed straight through to rung(); every caller reading a RESOLVED record should supply
 *  it, or the ladder demotes on a later partial observation. Port of soil.py. */
export function ladder(obs, structure, src) {
    const at = rung(obs, structure, src);
    const step = at + 1 < RUNGS.length ? RUNG_STEP[at + 1] : null;
    return {
        rung: at,
        of: RUNGS.length - 1,
        label: RUNGS[at],
        next: step === null || step === undefined
            ? null
            : { label: RUNGS[at + 1], costs: step[0], buys: step[1] },
    };
}
// --- the pH gate (P1b, R-099) ----------------------------------------------
/** The rule this module fires. A constant so the id appears once per engine and the corpus stays the
 *  only place its grade, mechanism and ruling live. */
export const PH_RULE = "R-099";
/** R-100, the waterlogging gate (P2). Fires on the GROUND rather than on a plant — the whole
 *  difference from R-099: waterlogging is a property of the site and so is its remedy. */
export const DRAINAGE_RULE = "R-100";
/** The pH gate: does this ground's measured pH sit below this plant's floor?
 *
 *  Returns a list because the caller appends it to a per-option channel, but it holds at most one
 *  entry — there is exactly one way for this rule to fire.
 *
 *  ONE-SIDED FOR A VEGETABLE (D-149): a pH above a tomato's ph_range maximum is NOT flagged, because
 *  no source read publishes a per-crop maximum for one — every such ceiling is ours, and firing on it
 *  would be firing on ourselves. THE HIGH SIDE EXISTS for species carrying `acid_requiring`, the
 *  acid-loving group D-149 was waiting for.
 *
 *  IT NEVER BLOCKS — the ruling is `advise`, derived in the corpus from grade C + suboptimal.
 *
 *  Silence has three causes and none is an error: no observation, no measured pH, or no ph_range on
 *  the species (31 carry none, and absence there means unresearched, not tolerant). Port of soil.py. */
export function phCautions(obs, resolved) {
    if (!obs)
        return [];
    const ph = obs.ph;
    if (typeof ph !== "number" || !Number.isFinite(ph))
        return [];
    const rng = (resolved ?? {}).ph_range;
    if (!Array.isArray(rng) || rng.length < 1)
        return [];
    // THE HIGH SIDE (D-149 closed). Gated on the SPECIES, not on the number: a ceiling only means
    // something when the plant actually fails above it, and for a vegetable this corpus has no
    // publisher for one. `acid_requiring` marks the species where the literature publishes a ceiling
    // AND names what happens past it. The threshold stays flagged; the marker asserts only that a
    // threshold exists, which is the part not in doubt.
    const ceiling = rng.length > 1 ? rng[1] : null;
    if (resolved?.acid_requiring && typeof ceiling === "number" && Number.isFinite(ceiling)
        && ph > ceiling) {
        const over = Math.round((ph - ceiling) * 100) / 100;
        const hedgeHi = obs.source === "kit" && over <= KIT_PRECISION
            ? ` (a home kit resolves about +/-${n(KIT_PRECISION)}, so this is marginal)` : "";
        return [{ rule: PH_RULE,
                why: `soil pH ${n(ph)} is ${n(over)} above this plant's ceiling of ${n(ceiling)}, and it ` +
                    `needs acid soil: above its range iron stops being available and the leaves yellow while ` +
                    `the veins stay green${hedgeHi}` }];
    }
    const floor = rng[0];
    if (typeof floor !== "number" || !Number.isFinite(floor) || ph >= floor)
        return [];
    const short = Math.round((floor - ph) * 100) / 100;
    // The kit's uncertainty is reported alongside the shortfall rather than used to suppress the
    // caution: a reading half a unit low is still the best number the gardener has, and hiding a
    // marginal case is a worse failure than showing one with its error bar attached.
    const hedge = obs.source === "kit" && short <= KIT_PRECISION
        ? ` (a home kit resolves about +/-${n(KIT_PRECISION)}, so this is marginal)` : "";
    return [{ rule: PH_RULE,
            why: `soil pH ${n(ph)} is ${n(short)} below this plant's floor of ${n(floor)}${hedge}` }];
}
/** R-100: has the gardener told us this ground stands water after rain?
 *
 *  ONLY `waterlogged` FIRES THIS. The corpus defines waterlogged as water STANDING after rain and
 *  `slow` as merely "damp for a day or more" — damp is not saturated, and every threshold the sources
 *  give is about standing water.
 *
 *  NO SPECIES DATA IS CONSULTED, deliberately: UC IPM puts the susceptible list at "almost all fruit
 *  and nut trees" plus "tomatoes, peppers, eggplant and other vegetable plants", broad enough that a
 *  per-species field would be NARROWER than the literature. And anoxia does not care what is planted.
 *
 *  `hasPerennial` changes only the mound HEIGHT quoted — the one number the sources make conditional.
 *  Port of soil.py. */
export function drainageCautions(obs, hasPerennial = false) {
    if (!obs || obs.drainage !== "waterlogged")
        return [];
    const mound = hasPerennial
        ? "up to 2 feet with a gradual slope, for the trees and perennials here"
        : "8 to 10 inches for annuals";
    return [{
            rule: DRAINAGE_RULE,
            why: "you told us this ground stands water after rain: roots suffocate in saturated soil, " +
                "and standing water is what lets Phytophthora reach a root at all",
            remedy: `plant on a mound or berm - ${mound} - and never bury the root crown or graft union`,
        }];
}
/** Every observation of one piece of ground, oldest first. Port of soil.py. */
function forGround(observations, plot, regionKey = null) {
    const out = [];
    for (const o of observations ?? []) {
        if (!o || typeof o !== "object" || Array.isArray(o))
            continue;
        const rec = o;
        if (rec.plot !== plot)
            continue;
        const key = rec.region ?? null;
        if (regionKey === null || regionKey === undefined) {
            if (key !== null)
                continue;
        }
        else if (j(key) !== j(regionKey))
            continue;
        out.push(rec);
    }
    out.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    return out;
}
/** What is known about a piece of ground, resolved FIELD BY FIELD rather than record by record.
 *
 *  Soil facts have different lifetimes: a texture recorded in 2024 is still the texture, a pH from
 *  2024 may not be. Record-wise "most recent wins" cannot express that, and destroys knowledge the
 *  moment a partial observation exists — which is exactly what logging "water stood here" creates.
 *
 *  SUPERSESSION IS CAUSAL, NOT CALENDAR-BASED. Nothing expires by age. A pH is dropped only when the
 *  gardener records liming or sulfuring this ground AFTER taking it — dropped, not merely flagged,
 *  because a value the engine keeps using while calling it superseded is the "looks consulted and is
 *  not" failure in a new costume. Port of soil.py. */
export function resolveGround(observations, plot, regionKey = null) {
    const rows = forGround(observations, plot, regionKey);
    const fields = {};
    const as_of = {};
    const src = {};
    for (const o of rows) {
        for (const k of [...FACT_FIELDS, "source", "notes"]) {
            if (k in o && o[k] !== null && o[k] !== undefined) {
                fields[k] = o[k];
                as_of[k] = o.date;
                src[k] = o.source;
            }
        }
    }
    const amended = rows.filter((o) => PH_AMENDMENTS.includes(o.amendment));
    delete fields.amendment;
    delete as_of.amendment;
    delete src.amendment;
    const superseded = {};
    const phDate = as_of.ph;
    if (phDate !== undefined && phDate !== null) {
        const later = amended.filter((o) => String(o.date ?? "") > String(phDate));
        if (later.length) {
            const last = later[later.length - 1];
            superseded.ph = { by: last.amendment, date: last.date };
            for (const k of ["ph", "buffer_ph"]) {
                delete fields[k];
                delete as_of[k];
                delete src[k];
            }
        }
    }
    return {
        fields, as_of, src, superseded,
        date: rows.length ? rows[rows.length - 1].date : null,
        amendments: rows.filter((o) => o.amendment).map((o) => ({ amendment: o.amendment, date: o.date })),
    };
}
