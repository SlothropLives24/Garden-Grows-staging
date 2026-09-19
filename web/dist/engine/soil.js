import { familyWithinInterval } from "./compiler.js";
export const TEXTURES = ["sand", "sandy_loam", "loam", "clay_loam", "clay", "unknown"];
export const DRAINAGES = ["fast", "free", "slow", "waterlogged", "unknown"];
export const SOURCES = ["declared", "field_test", "kit", "lab"];
export const MEDIUMS = ["purchased_mix", "compost_blend", "native_soil", "unknown"];
export const NUTRIENTS = ["p", "k", "ca", "mg", "s"];
export const NUTRIENT_LEVELS = ["very_low", "low", "medium", "optimum", "high", "very_high"];
export const OM_MIN = 0.0, OM_MAX = 100.0;
const REPORT_FIELDS = ["buffer_ph", "om_pct", "lab", "report_id", "nutrients",
    "lab_recommendation"];
const SOIL_FIELDS = new Set(["plot", "region", "date", "source", "texture", "drainage", "notes",
    "medium", "ph", "amendment", ...REPORT_FIELDS]);
export const PH_MIN = 3.0, PH_MAX = 10.0;
export const KIT_PRECISION = 0.5;
export const AMENDMENTS = ["lime", "sulfur", "compost", "manure", "mulch", "other"];
const PH_AMENDMENTS = ["lime", "sulfur"];
const FACT_FIELDS = ["texture", "drainage", "medium", "ph", "amendment", ...REPORT_FIELDS];
const PH_SOURCES = ["kit", "lab"];
const MEDIUM_STRUCTURES = ["container", "raised"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
function pyList(items) {
    return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}
export const CLUBROOT_RULE = "R-146";
export const CLUBROOT_PATHOGEN = "plasmodiophora_brassicae";
export function clubrootCautions(ground, resolved, site, bundle) {
    if (!ground)
        return [];
    const path = (resolved ?? {}).pathogens;
    if (!Array.isArray(path) || !path.includes(CLUBROOT_PATHOGEN))
        return [];
    const ph = (ground.fields ?? {}).ph;
    if (typeof ph !== "number" || !Number.isFinite(ph))
        return [];
    const rule = bundle.rules.find((r) => r.id === CLUBROOT_RULE);
    const trig = (rule?.trigger ?? {});
    const phMin = trig.ph_min;
    const within = typeof trig.within === "string" ? trig.within : "R-012";
    if (typeof phMin !== "number" || ph >= phMin)
        return [];
    const years = bundle.rules.find((r) => r.id === within)?.trigger?.years;
    if (typeof years !== "number")
        return [];
    if (!familyWithinInterval(site, "brassicaceae", years))
        return [];
    const short = Math.round((phMin - ph) * 100) / 100;
    return [{
            rule: CLUBROOT_RULE,
            why: `this ground carried brassicas within the last ${years} years and its pH ${n(ph)} `
                + `sits ${n(short)} below ${n(phMin)}: clubroot's resting spores germinate in acid `
                + `soil, and raising the pH is the lever extension names`,
        }];
}
export const LIME_RULE = "R-145";
export const SCAB_PH_MAX = 5.2;
export const SCAB_PATHOGEN = "streptomyces_scabies";
export function limeCautions(ground, resolved) {
    if (!ground)
        return [];
    const path = (resolved ?? {}).pathogens;
    if (!Array.isArray(path) || !path.includes(SCAB_PATHOGEN))
        return [];
    const limes = (ground.amendments ?? []).filter((a) => a.amendment === "lime");
    if (!limes.length)
        return [];
    const last = limes[limes.length - 1];
    const ph = (ground.fields ?? {}).ph;
    const phDate = (ground.as_of ?? {}).ph;
    const isNum = typeof ph === "number" && Number.isFinite(ph);
    if (isNum && String(phDate ?? "") >= String(last.date ?? "") && ph <= SCAB_PH_MAX)
        return [];
    const when = last.date ? ` on ${String(last.date)}` : "";
    const tail = isNum ? `, and the pH ${n(ph)} read on or after that day is above ${n(SCAB_PH_MAX)}` : "";
    return [{
            rule: LIME_RULE,
            why: `this ground was limed${when}${tail}: common scab worsens as soil pH rises, and `
                + `this plant wants it at or below about ${n(SCAB_PH_MAX)}`,
        }];
}
function n(v) {
    return Number.isInteger(v) ? String(Math.trunc(v)) : String(Math.round(v * 100) / 100);
}
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
export function asksFor(structure) {
    return structure && MEDIUM_STRUCTURES.includes(structure) ? "medium" : "soil";
}
export function capabilities(obs, structure, src) {
    if (obs && Object.keys(obs).length === 0)
        obs = null;
    const asks = asksFor(structure);
    const knownTexture = !!obs && obs.texture !== undefined && obs.texture !== null &&
        obs.texture !== "unknown";
    const knownDrainage = !!obs && "drainage" in obs && obs.drainage !== undefined &&
        obs.drainage !== null && obs.drainage !== "unknown";
    const knownMedium = !!obs && "medium" in obs && obs.medium !== undefined &&
        obs.medium !== null && obs.medium !== "unknown";
    const how = (field) => (src ? src[field] : obs ? obs.source : undefined);
    const measured = !!obs && how("texture") === "field_test";
    const ph = obs ? obs.ph : undefined;
    const knownPh = typeof ph === "number" && Number.isFinite(ph);
    const kit = !!obs && how("ph") === "kit";
    const report = !!obs && REPORT_FIELDS.some((k) => k in obs);
    const buffered = !!obs && typeof obs.buffer_ph === "number" && Number.isFinite(obs.buffer_ph);
    const limits = [];
    if (!obs) {
        limits.push("nothing recorded for this ground yet: nothing here is adjusted for it");
    }
    if (asks === "medium") {
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
        else if (obs.drainage === "slow") {
            limits.push("slow drainage is recorded but not gated: the waterlogging rule fires on " +
                "water that STANDS after rain, which is what the sources measure");
        }
    }
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
        if (!report) {
            limits.push("still no fertilizer amount and no lime rate: a rate needs the buffer pH from " +
                "a lab report, which is not recorded yet");
        }
        else {
            if (!obs?.lab) {
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
export const RUNGS = ["nothing recorded", "described", "field tested", "pH measured",
    "lab report"];
const RUNG_STEP = [
    null,
    ["about two minutes", "texture guidance, drainage warnings, and the waterlogging rule"],
    ["twenty minutes and nothing", "the same, graded higher - a measurement instead of a guess"],
    ["a home kit, about $15", "the pH rule, so plants below their floor are named"],
    ["a lab test, about $20 and two weeks", "your lab's own recommendation, repeated faithfully"],
];
export function rung(obs, structure, src) {
    if (!obs)
        return 0;
    const how = (field) => (src !== undefined && src !== null ? src[field] : obs.source);
    const present = REPORT_FIELDS.filter((k) => k in obs);
    if (present.length && how(present[0]) === "lab")
        return 4;
    if (typeof obs.ph === "number" && Number.isFinite(obs.ph))
        return 3;
    const knownField = asksFor(structure) === "medium" ? "medium" : "texture";
    if (how(knownField) === "field_test")
        return 2;
    const known = obs[knownField];
    if (known !== undefined && known !== null && known !== "unknown")
        return 1;
    return obs.drainage !== undefined && obs.drainage !== null && obs.drainage !== "unknown" ? 1 : 0;
}
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
export const PH_RULE = "R-099";
export const DRAINAGE_RULE = "R-100";
export function phCautions(obs, resolved) {
    if (!obs)
        return [];
    const ph = obs.ph;
    if (typeof ph !== "number" || !Number.isFinite(ph))
        return [];
    const rng = (resolved ?? {}).ph_range;
    if (!Array.isArray(rng) || rng.length < 1)
        return [];
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
    const hedge = obs.source === "kit" && short <= KIT_PRECISION
        ? ` (a home kit resolves about +/-${n(KIT_PRECISION)}, so this is marginal)` : "";
    return [{ rule: PH_RULE,
            why: `soil pH ${n(ph)} is ${n(short)} below this plant's floor of ${n(floor)}${hedge}` }];
}
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
