import { resolveSpecies } from "./compiler.js";
export const SECTIONS = [
    "Size", "Growing it", "Timing", "How to plant it", "Worth knowing",
];
export const FIELD_ROWS = [
    ["sowing_depth_cm", "Sowing depth", "cm", "How to plant it"],
    ["spacing_in_row_cm", "Spacing in row", "cm", "How to plant it"],
    ["spacing_between_row_cm", "Spacing between rows", "cm", "How to plant it"],
    ["start_indoors_weeks", "Start indoors, weeks before transplant", "", "How to plant it"],
    ["mature_height_cm", "Mature height", "cm", "Size"],
    ["mature_spread_cm", "Mature spread", "cm", "Size"],
    ["ph_range", "Soil pH", "", "Growing it"],
    ["days_to_maturity", "Days to maturity", "", "Timing"],
    ["gdd_to_maturity", "Growing-degree days to maturity", "", "Timing"],
    ["years_to_bearing", "Years to bearing", "", "Timing"],
    ["succession_interval_days", "Days between succession sowings", "", "Timing"],
    ["hardiness_zone", "Hardiness zone", "", "Worth knowing"],
];
export const VOCAB_ROWS = [
    ["light_min", "Light", "Growing it"],
    ["feeder_class", "Feeding", "Growing it"],
    ["root_depth", "Root depth", "Growing it"],
    ["frost_tolerance", "Frost tolerance", "Timing"],
    ["lifespan", "Lifespan", "Timing"],
    ["habit", "Habit", "Size"],
    ["pollinator_value", "Value to pollinators", "Worth knowing"],
];
export function humanize(token) {
    const s = String(token).replace(/_/g, " ").trim();
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}
export const VALUE_WORD = {
    feeder_class: { heavy: "Heavy feeder", moderate: "Moderate feeder", light: "Light feeder",
        fixer: "Makes its own nitrogen" },
    "support.requires": { strong: "Needs a sturdy stake, cage or trellis",
        optional_strong: "Better with a sturdy stake or cage",
        moderate: "Needs a stake or a short cage",
        weak: "Needs something light to lean on" },
    "support.provides": { strong: "Can carry a climbing vine", weak: "Can carry a light climber" },
    pollinator_value: { very_high: "Very high" },
};
export function valueWord(key, v) {
    if (typeof v !== "string")
        return v;
    if (key === "scheduling_model")
        return SCHEDULING_WORD[v] ?? humanize(v);
    return VALUE_WORD[key]?.[v] ?? humanize(v);
}
export const SCHEDULING_WORD = {
    gdd: "growing-degree days", dtm: "days to maturity", perennial: "its perennial cycle",
};
export function cardRecord(speciesId, group, bundle) {
    const raw = bundle.species.find((s) => s.id === speciesId);
    if (!raw)
        return undefined;
    const groups = (raw.cultivar_groups ?? []);
    if (!group && groups.length)
        return raw;
    return resolveSpecies(speciesId, group, bundle);
}
export function softTierOf(rec, key) {
    const conf = (rec.confidence ?? {});
    for (const tier of ["estimated", "contested"]) {
        const paths = conf[tier];
        if (Array.isArray(paths) && paths.some((p) => String(p) === key))
            return tier;
    }
    return null;
}
export function rowSources(rec, key) {
    const conf = (rec.confidence ?? {});
    const src = (conf.sources ?? {});
    const ptrs = src[key];
    return Array.isArray(ptrs) ? ptrs.map(String) : [];
}
export function cardRows(rec) {
    if (!rec)
        return [];
    const rows = [];
    for (const [key, label, unit, section] of FIELD_ROWS) {
        const v = rec[key];
        if (v === undefined || v === null)
            continue;
        rows.push({ key, label, unit, value: v, section, kind: "number", soft: softTierOf(rec, key), sources: rowSources(rec, key) });
    }
    for (const [key, label, section] of VOCAB_ROWS) {
        const v = rec[key];
        if (v === undefined || v === null)
            continue;
        rows.push({ key, label, unit: "", value: valueWord(key, v), section, kind: "vocab",
            soft: softTierOf(rec, key), sources: rowSources(rec, key) });
    }
    for (const [key, label] of [["n_fixing", "Fixes nitrogen"],
        ["casts_shade", "Casts shade on neighbours"],
        ["ber_susceptible", "Prone to blossom-end rot"]]) {
        if (rec[key] === true) {
            rows.push({ key, label, unit: "", value: true, section: "Worth knowing", kind: "bool",
                soft: softTierOf(rec, key), sources: rowSources(rec, key) });
        }
    }
    const support = (rec.support ?? {});
    for (const [sub, label, section] of [["requires", "Support", "Growing it"],
        ["provides", "Can support a climber", "Worth knowing"]]) {
        const v = support[sub];
        if (v && v !== "none") {
            const key = `support.${sub}`;
            rows.push({ key, label, unit: "", value: valueWord(key, v), section, kind: "vocab",
                soft: softTierOf(rec, key), sources: rowSources(rec, key) });
        }
    }
    return rows;
}
export function sectioned(rows, lead) {
    const out = [];
    for (const name of SECTIONS) {
        const members = rows.filter((r) => r.section === name);
        if (members.length)
            out.push([name, members]);
    }
    if (lead)
        out.sort((a, b) => (a[0] === lead ? 0 : 1) - (b[0] === lead ? 0 : 1));
    return out;
}
export function formatValue(row) {
    const v = row.value;
    let body;
    if (Array.isArray(v)) {
        const parts = v.map((x) => (typeof x === "number" ? String(x) : String(x)));
        body = new Set(parts).size === 1 ? parts[0] : parts.join("–");
    }
    else if (typeof v === "boolean") {
        body = v ? "yes" : "no";
    }
    else {
        body = String(v);
    }
    return row.unit ? `${body} ${row.unit}` : body;
}
export function guildsPlacing(speciesId, bundle) {
    const out = [];
    for (const g of bundle.guilds) {
        const roles = g.roles ?? [];
        const fills = roles.some((r) => {
            if (r.canonical === speciesId)
                return true;
            const alts = r.alternatives;
            if (!Array.isArray(alts))
                return false;
            return alts.some((a) => (typeof a === "string" ? a : a?.species) === speciesId);
        });
        if (fills)
            out.push(g.id);
    }
    return out;
}
