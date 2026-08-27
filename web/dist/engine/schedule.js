// Schedule + tables (C5). DOM-free and portable, like everything in engine/.
//
// plantingWindowFor mirrors Python dispatch.planting_window plus its R-030 heat condition, and is
// conformance-checked against the Python oracle (web/testdata/compiler.golden.json) - same
// contract as compiler.ts: do not change its output without changing Python first.
//
// spacingRows and mechanismRows are presentation projections of bundle data (no Python
// counterpart computes them) - unit-tested in web/test.mjs. They invent nothing: spacing comes
// straight from mature_spread_cm with its confidence status surfaced, and mechanisms are the
// guild's own declared claims with their grades and rule links. Where the corpus flags a number
// as estimated, the table says so - an unflagged number the corpus doubts would be fabrication.
import { resolveSpecies } from "./compiler.js";
import { matchSite } from "./intake.js";
function nightMaxOf(resolved) {
    const v = resolved.night_temp_max_c;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** The scheduling window the resolved site implies for these species: the frost-free span, its
 *  length, and whether summer heat (R-030) carves a gap out of it. Null if the point matches no
 *  bundled site (within Python's 5 km tolerance) - the engine refuses, it does not approximate. */
export function plantingWindowFor(lat, lon, speciesIds, bundle) {
    if (lat == null || lon == null)
        return null;
    const cl = matchSite(lat, lon, bundle);
    if (!cl)
        return null;
    const night = cl.summer_night_tmin_c ?? null;
    let heatLimited = false;
    for (const sid of speciesIds) {
        const nightMax = nightMaxOf(resolveSpecies(sid, null, bundle));
        if (nightMax !== null && night !== null && night > nightMax)
            heatLimited = true;
    }
    return {
        last_frost_p50: cl.last_frost_32f?.p50 ?? null,
        first_freeze_p50: cl.first_freeze_32f_p50 ?? null,
        growing_season_days: cl.growing_season_days_p50 ?? null,
        heat_limited: heatLimited,
    };
}
/** Per-species R-030 detail for the UI: which species trips the heat gap, and the numbers.
 *  Wording follows dispatch.py's fired-rule text so the app and the cases speak one language. */
// Returns the raw °C figures (night, nightMax), NOT a baked sentence - the DOM formats them through
// the temperature toggle (units.ts). Engine stays metric and unit-agnostic.
export function heatWarnings(speciesIds, lat, lon, bundle) {
    if (lat == null || lon == null)
        return [];
    const cl = matchSite(lat, lon, bundle);
    const night = cl?.summer_night_tmin_c ?? null;
    if (night === null)
        return [];
    const out = [];
    for (const sid of speciesIds) {
        const nightMax = nightMaxOf(resolveSpecies(sid, null, bundle));
        if (nightMax !== null && night > nightMax) {
            out.push({ species: sid, night_c: night, night_max_c: nightMax });
        }
    }
    return out;
}
const maxNum = (v) => {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    return typeof x === "number" && Number.isFinite(x) ? x : null;
};
const SPACING_FIELDS = ["mature_spread_cm", "mature_height_cm", "days_to_maturity"];
/** One row per species (deduped, resolution order kept): the numbers a bed layout needs, each
 *  carrying its corpus confidence caveat where one is declared. */
export function spacingRows(speciesWithGroups, bundle) {
    const seen = new Set();
    const rows = [];
    for (const [sid, group] of speciesWithGroups) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const r = resolveSpecies(sid, group, bundle);
        const conf = (r.confidence ?? {});
        const flags = [];
        for (const status of ["estimated", "contested"]) {
            for (const field of conf[status] ?? []) {
                if (SPACING_FIELDS.includes(field))
                    flags.push(`${field} ${status}`);
            }
        }
        rows.push({
            species: sid,
            spread_cm: maxNum(r.mature_spread_cm),
            height_cm: maxNum(r.mature_height_cm),
            days_to_maturity: maxNum(r.days_to_maturity),
            flags,
        });
    }
    return rows;
}
/** Bundle-class guilds carry `members` instead of role predicates (mirrors dispatch.py's
 *  _guild_members): the species list the window/heat/spacing views need when there are no roles. */
export function memberSpecies(guild) {
    return (guild.members ?? []).map((m) => [
        String(m.species),
        m.group ?? null,
    ]);
}
/** The guild's declared interspecies mechanisms, each with its grade and - when it cites a rule -
 *  that rule's mechanism sentence (falling back to its claim) and derived ruling. A guild with no
 *  mechanisms shows its honesty_note instead (the culinary bundles: "same bowl, no mechanism"). */
export function mechanismRows(guild, bundle) {
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const rows = [];
    for (const m of (guild.mechanisms ?? [])) {
        const rid = m.rule ?? null;
        const rule = rid ? ruleById.get(rid) : undefined;
        rows.push({
            claim: String(m.claim ?? ""),
            grade: String(m.grade ?? "?"),
            rule: rid,
            rule_mechanism: rule ? (rule.mechanism ?? rule.claim ?? null) : null,
            rule_ruling: rule ? (rule.derived_ruling ?? null) : null,
        });
    }
    return { rows, honesty_note: (guild.honesty_note ?? null)?.trim() ?? null };
}
/** R-033: a guild that pairs a LIVING support - a plant whose support.provides is weak/strong
 *  (corn), not a trellis STRUCTURE - with a vine that MUST climb (support.requires strong, the pole
 *  bean) earns a sow-lead note: put the vine in ~lead days after the support establishes, not with
 *  it. The lead comes from R-033's own trigger. Byte-for-byte the same detector dispatch fires on
 *  (dispatch.living_support_lead), pinned by the conformance golden - so the engine warning and this
 *  UI line can never disagree. The sprawling squash (support.requires optional_strong, groundcover)
 *  is not a climber and does not trip it. */
export function livingSupportLead(guild, bundle) {
    const speciesIds = new Set(bundle.species.map((s) => s.id));
    const entityIds = new Set(bundle.entities.map((e) => e.id));
    const members = [];
    for (const m of (guild.members ?? [])) {
        members.push(resolveSpecies(m.species, m.group ?? null, bundle));
    }
    for (const role of (guild.roles ?? [])) {
        const canon = role.canonical;
        if (canon && (speciesIds.has(canon) || entityIds.has(canon))) {
            members.push(resolveSpecies(canon, role.canonical_group ?? null, bundle));
        }
    }
    const provides = (m) => m.support?.provides;
    const requires = (m) => m.support?.requires;
    const support = members.find((m) => (provides(m) === "weak" || provides(m) === "strong") && m.entity_class === undefined);
    const climber = members.find((m) => requires(m) === "strong");
    if (!support || !climber)
        return null;
    const lead = (bundle.rules.find((r) => r.id === "R-033")?.trigger?.days) ?? null;
    return {
        rule: "R-033",
        lead_days: lead,
        support: support.id,
        climber: climber.id,
        why: `a vine that must climb shares a living support; sow it ~${lead} days ` +
            `after the support establishes, not with it`,
    };
}
