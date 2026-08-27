// The plant card's row spec — the port of `engine/plant_card.py`, in the same relationship as
// season_log.py <-> seasonlog.ts: the Python module is the ORACLE, this mirrors it, and the two
// move in one commit. Frozen against it by web/testdata/plantcard.golden.json.
//
// THE INVARIANT THIS CARRIES, and it is older than the card: a field the species does not have is
// simply ABSENT. No surface states a number the corpus lacks. Thyme has no GDD model and must not
// acquire one by being rendered (CLAUDE.md: populating gdd_to_maturity by analogy is fabrication).
// `cardRows` drops missing fields rather than emitting a blank row - an empty row is exactly how
// "absent" turns into "unknown" on screen.
//
// D-161 also applies: a species carries no reader-facing prose field, so nothing here returns
// prose. A card is typed graded facts plus the rules that fire - never a blurb.
//
// ONE DELIBERATE ADDITION OVER THE ORACLE: `formatValue`. The Python side has no plain-text
// formatter because its only consumer, build_pages.py, emits HTML and owns its own (`fmt_value`,
// which produces `&ndash;`). The app sets textContent, so it needs the real character. That split
// is why moving the spec changed no page byte.
import { resolveSpecies } from "./compiler.js";
// SECTIONS (2026-08-02): thirteen undifferentiated rows is a wall on a phone. Every row declares
// its group; an EMPTY group does not render, which is what keeps thyme short rather than showing
// headings with nothing under them - the absent-is-absent invariant, applied to structure.
// ORDER IS THE MID-SEASON READING, and "How to plant it" deliberately does NOT lead it: a gardener
// whose crop is already in the ground wants size, conditions and timing first. The app promotes the
// planting block via `sectioned(rows, lead)` only while a plant is planned and not yet sown.
export const SECTIONS = [
    "Size", "Growing it", "Timing", "How to plant it", "Worth knowing",
];
export const FIELD_ROWS = [
    // Spacing MOVED into the planting block rather than being duplicated in Size - a number printed
    // twice on one card is how two records start to disagree.
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
// `scheduling_model` and `ground_coverage` LEFT this list on 2026-08-02: the first describes how the
// engine computes dates, the second exists so a guild role can match a living-mulch slot. Matching
// machinery, not facts a gardener asked for. Both stay in the corpus and are still read by the code
// that needs them.
export const VOCAB_ROWS = [
    ["light_min", "Light", "Growing it"],
    ["feeder_class", "Feeding", "Growing it"],
    ["root_depth", "Root depth", "Growing it"],
    ["frost_tolerance", "Frost tolerance", "Timing"],
    ["lifespan", "Lifespan", "Timing"],
    ["habit", "Habit", "Size"],
    ["pollinator_value", "Value to pollinators", "Worth knowing"],
];
/** A corpus token as a reader's words: `full_sun` -> `Full sun`. The port of plant_card.humanize. */
export function humanize(token) {
    const s = String(token).replace(/_/g, " ").trim();
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}
// Where the bare word would mislead or mean nothing. Anything absent falls through to `humanize`.
// EVERY support value in the corpus is listed, cultivar groups included - `moderate` appears on
// exactly one group and no bare species, so enumerating from species alone would have left
// "Support: Moderate" on a determinate tomato.
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
/** THE FAULT THIS FIXES SHIPPED TO STAGING: the card printed `full_sun` and `tender` at a gardener,
 *  because card rows returned the raw token and nothing humanised it. Non-strings pass through. */
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
/** The record a CARD should describe — which is NOT always the record the planner resolves.
 *
 *  O41, ruled 2026-08-02. `resolveSpecies` falls back to `groups[0]` when no cultivar group is
 *  given, and for the PLANNER that is right: a bed must place some cultivar, and a default beats a
 *  refusal to place. For a card it is wrong, because a card's whole job is to state what the corpus
 *  records about the thing it NAMES. Defaulting made a groupless tomato card print a determinate's
 *  mature height and days-to-maturity under the heading "Tomato" — numbers the corpus holds about
 *  determinate tomatoes and not about tomatoes. The static species page never did this, so the two
 *  surfaces disagreed; this is the app moving to the page's behaviour, not a new policy.
 *
 *  So: a species with cultivar groups and NO group chosen describes itself BARE, and the group
 *  chips are the invitation to choose. Same invariant as everywhere else here — no surface states a
 *  number the corpus lacks for the subject it is naming. */
export function cardRecord(speciesId, group, bundle) {
    const raw = bundle.species.find((s) => s.id === speciesId);
    if (!raw)
        return undefined;
    const groups = (raw.cultivar_groups ?? []);
    if (!group && groups.length)
        return raw;
    return resolveSpecies(speciesId, group, bundle);
}
/** Which tier, if any, this species flags for a field. The tier rides ON the row rather than in a
 *  distant section: the app has less room than a web page, and a number whose softness is
 *  disclosed three sections away is disclosed in name only. */
export function softTierOf(rec, key) {
    const conf = (rec.confidence ?? {});
    for (const tier of ["estimated", "contested"]) {
        const paths = conf[tier];
        if (Array.isArray(paths) && paths.some((p) => String(p) === key))
            return tier;
    }
    return null;
}
/** The typed rows for one resolved species record, in reading order. A field the record does not
 *  carry is ABSENT from the result — the invariant, not an implementation detail. */
export function cardRows(rec) {
    if (!rec)
        return [];
    const rows = [];
    for (const [key, label, unit, section] of FIELD_ROWS) {
        const v = rec[key];
        if (v === undefined || v === null)
            continue;
        rows.push({ key, label, unit, value: v, section, kind: "number", soft: softTierOf(rec, key) });
    }
    for (const [key, label, section] of VOCAB_ROWS) {
        const v = rec[key];
        if (v === undefined || v === null)
            continue;
        rows.push({ key, label, unit: "", value: valueWord(key, v), section, kind: "vocab",
            soft: softTierOf(rec, key) });
    }
    // Truthy-only booleans: stated when true, silent when false. "Fixes nitrogen: no" is noise on 68
    // of 73 species, and a card that lists every absence is a card nobody reads to the end.
    for (const [key, label] of [["n_fixing", "Fixes nitrogen"],
        ["casts_shade", "Casts shade on neighbours"],
        ["ber_susceptible", "Prone to blossom-end rot"]]) {
        if (rec[key] === true) {
            rows.push({ key, label, unit: "", value: true, section: "Worth knowing", kind: "bool",
                soft: softTierOf(rec, key) });
        }
    }
    const support = (rec.support ?? {});
    for (const [sub, label, section] of [["requires", "Support", "Growing it"],
        ["provides", "Can support a climber", "Worth knowing"]]) {
        const v = support[sub];
        if (v && v !== "none") {
            const key = `support.${sub}`;
            rows.push({ key, label, unit: "", value: valueWord(key, v), section, kind: "vocab",
                soft: softTierOf(rec, key) });
        }
    }
    return rows;
}
/** `cardRows` regrouped into [section, rows] in SECTIONS order, EMPTY SECTIONS DROPPED. Port of
 *  plant_card.sectioned. Dropping empties is the point: a heading with nothing under it reads as
 *  "we lost the data" rather than "the corpus claims none". */
export function sectioned(rows, lead) {
    const out = [];
    for (const name of SECTIONS) {
        const members = rows.filter((r) => r.section === name);
        if (members.length)
            out.push([name, members]);
    }
    // `lead` promotes one section, and is how the app says "this gardener is about to plant this".
    // A PERMUTATION only - nothing is added, dropped or duplicated - which the tests assert.
    if (lead)
        out.sort((a, b) => (a[0] === lead ? 0 : 1) - (b[0] === lead ? 0 : 1));
    return out;
}
/** A row's value as plain text. Mirrors build_pages.fmt_value's decisions and differs only in
 *  producing a real en dash rather than an HTML entity.
 *
 *  A [lo, hi] whose ends are equal is a single figure written in range form (corn's spread is
 *  [45, 45]); printing "45–45 cm" would read as sloppy data rather than as a point value. */
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
/** The guilds that place this species — derived, not stored. Mirrors the compiler's own notion of
 *  who can fill a role (canonical, its non-plant substitute, and curated alternatives); a predicate
 *  match is NOT membership, because the role predicates are deliberately loose and a bare predicate
 *  test matches nonsense (D-006). */
// IT RETURNS IDS, AND THAT IS THE POINT (2026-08-02, third staging walk). This used to return
// `{id, name}` where name was `g.name ?? g.id`, and NO guild carries a `name` — the corpus keeps
// guild names in `common` — so every card printed the raw id: "three_sisters". Two correct
// resolvers already existed (`displayName` in guilds.ts, `guild_name` in build_pages.py) and I
// wrote a third that looked for a field that does not exist. Returning ids leaves exactly one
// naming rule in the codebase and gives this function nothing to get wrong.
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
