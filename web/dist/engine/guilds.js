// Guild fit + adaptation - the first slice of the engine ported to TypeScript. DOM-free and portable
// (this same module runs in the web app and, later, the React Native app). It mirrors the Python
// compile_plan offer logic (engine/compiler.py) exactly; the corpus cases are the shared conformance
// contract that keeps the two in step (see web/conformance.mjs).
//
// D-006, the moat: a guild that does not fit the bed is never silently dropped. It is shown with the
// reason (the rule its footprint gate cites, and that rule's mechanism) and the nearest derived
// adaptation that DOES fit.
import { humanize, titleCase } from "./labels.js";
import { circleFitsRegion } from "./place.js";
import { circleFitsRect, radialRingsFromFootprint } from "./regions.js";
export function fitTier(guild, bedW, bedL, region) {
    if (bedW == null || bedL == null || !(bedW * bedL > 0))
        return null;
    const fm = guild.footprint_min_m2 ?? 0;
    let ratio = fm / (bedW * bedL);
    if (guild.ground_entity === "radial_rings") {
        const ring = radialRingsFromFootprint(fm);
        // a traced outline already passed the honest circleFitsRegion gate, and a polygon has no
        // single "narrow span" this geometry can state - a polygon bed tiers on area alone
        if (ring && region?.shape !== "polygon")
            ratio = Math.max(ratio, (ring.r * 2) / Math.min(bedW, bedL));
    }
    else if (isHillsGuild(guild)) {
        ratio = Math.max(ratio, MOUND_MIN_SPAN_M / Math.min(bedW, bedL));
    }
    return ratio <= 0.6 ? "full" : ratio <= 0.85 ? "adequate" : "marginal";
}
const ruleById = (bundle) => new Map(bundle.rules.map((r) => [r.id, r]));
// The footprint_reason is sometimes a rule id (e.g. R-001) and sometimes prose. When it is a rule,
// surface that rule's claim/mechanism - the mechanism is what makes the refusal trustworthy, not folklore.
function reasonFor(guild, rules) {
    const fr = guild.footprint_reason;
    if (typeof fr === "string" && /^R-\d+/.test(fr)) {
        const rule = rules.get(fr);
        const text = rule?.mechanism || rule?.claim || `see ${fr}`;
        return { ruleId: fr, text: String(text).trim() };
    }
    return { ruleId: null, text: (fr || "needs more space than this bed").toString().trim() };
}
/** Does this guild fit the bed, and if not, why and what fits instead. Mirrors compile_plan.
 *  A rect guild fits on AREA (footprint ≤ bed area). A radial_rings guild (a fruit tree) fits only if
 *  its drip-line CIRCLE fits the bed rectangle - a 1×25 m bed has 25 m² but holds no 2.8 m ring - so
 *  it gates on circleFitsRect and takes both bed dimensions, not just the area. */
/** Does a guild's footprint fit this bed? A rect guild fits on AREA (footprint ≤ bed area); a
 *  radial_rings guild (a fruit tree) fits only if its drip-line CIRCLE fits the bed rectangle -
 *  and on a TRACED bed, only if the circle fits inside the actual outline (fill review F-6: the
 *  dwarf fruit guild "fit" a 4x4 L-shape by bounding box, then placed zero plants - neither 2 m
 *  arm holds its 3.4 m ring). */
function fitsBed(guild, bedW, bedL, region) {
    const fmin = guild.footprint_min_m2 ?? 0;
    if (guild.ground_entity === "radial_rings") {
        const ring = radialRingsFromFootprint(fmin);
        if (!ring)
            return fmin <= bedW * bedL;
        if (region && region.shape === "polygon")
            return circleFitsRegion(ring, region);
        return circleFitsRect(ring, bedW, bedL);
    }
    // D-144 (maintainer): a HILLS guild - real corn-support mounds - also gates on the bed's narrow
    // span holding one full mound footprint (~1 m: the 0.7 m guide plus working room). A 6 x 0.7 m
    // border passes the 4 m2 area test yet has no room for the squash ring or for reaching around a
    // mound; it greys with the reason and the trellis small-bed adaptation instead. Same honest-
    // outline treatment as F-6: on a traced bed the mound disc must fit INSIDE the actual shape.
    if (isHillsGuild(guild)) {
        if (region && region.shape === "polygon") {
            if (!circleFitsRegion({ r: MOUND_MIN_SPAN_M / 2 }, region))
                return false;
        }
        else if (Math.min(bedW, bedL) < MOUND_MIN_SPAN_M)
            return false;
    }
    return fmin <= bedW * bedL;
}
// A MOUND guild (D-141 / R-098): lays out as HILLS - a polyculture with a support role (the Three
// Sisters family incl. the trellis small-bed, and milpa). Its beans/squash sit on a mound grid you
// tend by walking BETWEEN the hills, which a raised bed (reached from the edges, never stepped into)
// can't offer - so the whole family is greyed on a raised bed, with the in-ground/field adaptation.
function isMoundGuild(guild) {
    return guild.guild_class === "polyculture" && (guild.roles ?? []).some((r) => r.id === "support");
}
/** The D-056 hills-archetype dispatch, shared: an interplanted polyculture with a support role
 *  lays out as a grid of mounds (corn or a trellis carrying climbers; a companion pair has no
 *  support role, so it stays rows/grid). plan.ts uses this to pick the layout; the ground map
 *  uses it to know a planned bed reserves NO walkway - the mounds themselves are the access
 *  (you step between hills, R-098), so drawing a structural path would contradict the planting. */
export function laysOutAsHills(guild) {
    return guild.guild_class === "polyculture" && guild.ground_entity !== "radial_rings"
        && (guild.roles ?? []).some((r) => r.id === "support");
}
// D-144: the guilds that lay out as actual HILLS - a corn support means real ~1 m mounds. The
// trellis small-bed swaps corn for a structure and plants a plain grid, so it is a MOUND guild for
// the raised-bed rule (R-098) but NOT width-gated: it is exactly the adaptation a narrow bed needs.
// Mirrors footprint.py's archetype ("hills needs a corn SUPPORT").
const MOUND_MIN_SPAN_M = 1.0; // one full mound footprint: the 0.7 m guide + working room (= HILL_SPACING_M)
function isHillsGuild(guild) {
    return (guild.roles ?? []).some((r) => r.canonical === "zea_mays");
}
// A PERENNIAL / woody guild (D-141): a fruit-tree guild (perennial_guild, or a radial_rings drip-line
// layout). A tree needs deep, permanent, undisturbed ground - so it belongs in-ground, never a shallow
// raised bed, an annually-tilled field, or a container.
function isPerennialGuild(guild) {
    return guild.guild_class === "perennial_guild" || guild.ground_entity === "radial_rings";
}
export function guildStatus(guild, bedW, bedL, bundle, structure, region) {
    // D-141 / R-098: structure eligibility, greyed with the reason and nearest adaptation, never silently
    // laid out (invariant 2). A mound guild needs ground you walk between (not a raised bed); a fruit tree
    // needs deep permanent ground (in-ground only, not raised/field/container).
    const moundOnRaised = structure === "raised" && isMoundGuild(guild);
    const perennialOffGround = isPerennialGuild(guild)
        && (structure === "raised" || structure === "field" || structure === "container");
    if (!moundOnRaised && !perennialOffGround && (bedW == null || bedL == null || fitsBed(guild, bedW, bedL, region))) {
        return { guild, fits: true, reason: null, offer: null, tier: fitTier(guild, bedW, bedL, region) };
    }
    // The nearest eligible adaptation: the largest derived variant that ITSELF fits this bed, by its
    // own geometry (a round variant must fit as a circle, not merely by area - hence fitsBed, not an
    // area test). Radial variants (e.g. the dwarf fruit-tree guild, D-044) are offered too, which the
    // earlier "a round guild that overflows has no adaptation" shortcut wrongly precluded. On a raised
    // bed a mound adaptation is no adaptation - the offer must itself be bed-friendly.
    const offer = bundle.guilds
        .filter((g) => g.derived_from === guild.id && (bedW == null || bedL == null || fitsBed(g, bedW, bedL, region))
        && !(structure === "raised" && isMoundGuild(g))
        && !(isPerennialGuild(g) && (structure === "raised" || structure === "field" || structure === "container")))
        .sort((a, b) => (b.footprint_min_m2 ?? 0) - (a.footprint_min_m2 ?? 0))[0] ?? null;
    // A round guild that overflows with no fitting adaptation explains itself by the ring width.
    const ring = guild.ground_entity === "radial_rings" ? radialRingsFromFootprint(guild.footprint_min_m2 ?? 0) : null;
    const ringOnTrace = !!ring && region?.shape === "polygon"; // failed the honest outline test (F-6)
    // D-144: the bed's AREA holds the guild but its narrow span cannot hold one mound - say that,
    // not the misleading "needs more space" (a 6 x 0.7 m border has plenty of area).
    const hillsNarrow = isHillsGuild(guild) && bedW != null && bedL != null
        && (guild.footprint_min_m2 ?? 0) <= bedW * bedL;
    const reason = perennialOffGround
        ? { ruleId: "R-076",
            text: "a fruit tree needs deep, permanent ground; plant it in-ground, not a raised bed, a tilled field, or a container." }
        : moundOnRaised
            ? { ruleId: "R-098",
                text: "this team is planted on mounds you tend by walking between them; a raised bed is reached from its edges and never stepped in. Grow it in-ground or as a field, or pick a bed-friendly team." }
            : ring && !offer
                ? { ruleId: "R-073",
                    text: ringOnTrace
                        ? `the drip-line ring is ~${(2 * ring.r).toFixed(1)} m across and no part of this bed's outline is wide enough to hold it - a round footprint wants an open, square-ish area`
                        : `the drip-line ring is ~${(2 * ring.r).toFixed(1)} m across and needs a wider bed - a round footprint wants a square-ish bed` }
                : hillsNarrow
                    ? { ruleId: null,
                        text: `this team plants on mounds about ${MOUND_MIN_SPAN_M} m across (corn on hills, squash working the ground between); this bed is narrower than one mound` }
                    : reasonFor(guild, ruleById(bundle));
    return { guild, fits: false, offer, reason, tier: null };
}
/** The guilds worth showing as top-level cards: the ones you plant directly. Excludes out-of-scope
 *  systems (paddy/aquaculture - not raised-bed guilds) and the derived adaptations, which render as
 *  variants UNDER their parent (see derivedGuilds), not as competing top-level cards. A restorative
 *  break is a real plantable cover-crop guild, so it is browsable (it ALSO surfaces contextually as
 *  the rotation-break suggestion). */
export function browsableGuilds(bundle) {
    const SHOWN = new Set(["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle",
        "restorative"]);
    return bundle.guilds.filter((g) => SHOWN.has(g.guild_class) && !g.derived_from);
}
/** A guild's derived family - the adaptations rooted at it (Three Sisters → small-bed, four-sisters),
 *  smallest footprint first. These render as sub-cards under the parent so every variant is reachable,
 *  not just the single one the misfit offer surfaces. */
export function derivedGuilds(parentId, bundle) {
    return bundle.guilds
        .filter((g) => g.derived_from === parentId)
        .sort((a, b) => (a.footprint_min_m2 ?? 0) - (b.footprint_min_m2 ?? 0));
}
// Guild names render through the SAME titleCase() as species common names, so the corpus's
// inconsistently-cased `common` list ("Three Sisters" vs "brassicas with aromatic herbs") and the
// humanize() id fallback ("Salsa garden") all read uniformly as plant-team titles on the cards.
export function displayName(guild) {
    return titleCase(guild.common?.[0] ?? humanize(guild.id));
}
