import { humanize, titleCase } from "./labels.js";
import { MOUND_MIN_SPAN_M } from "./display-vocab.gen.js";
import { circleFitsRegion } from "./place.js";
import { circleFitsRect, radialRingsFromFootprint } from "./regions.js";
export function fitTier(guild, bedW, bedL, region) {
    if (bedW == null || bedL == null || !(bedW * bedL > 0))
        return null;
    const fm = guild.footprint_min_m2 ?? 0;
    let ratio = fm / (bedW * bedL);
    if (guild.ground_entity === "radial_rings") {
        const ring = radialRingsFromFootprint(fm);
        if (ring && region?.shape !== "polygon")
            ratio = Math.max(ratio, (ring.r * 2) / Math.min(bedW, bedL));
    }
    else if (isHillsGuild(guild)) {
        ratio = Math.max(ratio, MOUND_MIN_SPAN_M / Math.min(bedW, bedL));
    }
    return ratio <= 0.6 ? "full" : ratio <= 0.85 ? "adequate" : "marginal";
}
const ruleById = (bundle) => new Map(bundle.rules.map((r) => [r.id, r]));
function reasonFor(guild, rules) {
    const fr = guild.footprint_reason;
    if (typeof fr === "string" && /^R-\d+/.test(fr)) {
        const rule = rules.get(fr);
        const text = rule?.mechanism || rule?.claim || `see ${fr}`;
        return { ruleId: fr, text: String(text).trim() };
    }
    return { ruleId: null, text: (fr || "needs more space than this bed").toString().trim() };
}
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
function isMoundGuild(guild) {
    return guild.guild_class === "polyculture" && (guild.roles ?? []).some((r) => r.id === "support");
}
export function laysOutAsHills(guild) {
    return guild.guild_class === "polyculture" && guild.ground_entity !== "radial_rings"
        && (guild.roles ?? []).some((r) => r.id === "support");
}
function isHillsGuild(guild) {
    if (guild.layout === "shelter")
        return false;
    return (guild.roles ?? []).some((r) => r.canonical === "zea_mays");
}
function isPerennialGuild(guild) {
    return guild.guild_class === "perennial_guild" || guild.ground_entity === "radial_rings";
}
export function guildStatus(guild, bedW, bedL, bundle, structure, region) {
    const moundOnRaised = structure === "raised" && isMoundGuild(guild);
    const perennialOffGround = isPerennialGuild(guild)
        && (structure === "raised" || structure === "field" || structure === "container");
    if (!moundOnRaised && !perennialOffGround && (bedW == null || bedL == null || fitsBed(guild, bedW, bedL, region))) {
        return { guild, fits: true, reason: null, offer: null, tier: fitTier(guild, bedW, bedL, region) };
    }
    const offer = bundle.guilds
        .filter((g) => g.derived_from === guild.id && (bedW == null || bedL == null || fitsBed(g, bedW, bedL, region))
        && !(structure === "raised" && isMoundGuild(g))
        && !(isPerennialGuild(g) && (structure === "raised" || structure === "field" || structure === "container")))
        .sort((a, b) => (b.footprint_min_m2 ?? 0) - (a.footprint_min_m2 ?? 0))[0] ?? null;
    const ring = guild.ground_entity === "radial_rings" ? radialRingsFromFootprint(guild.footprint_min_m2 ?? 0) : null;
    const ringOnTrace = !!ring && region?.shape === "polygon";
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
export const SECTION_ORDER = ["teams", "rings", "bundles", "rest"];
const BAND_RANK = { backed: 0, partial: 1, none: 2 };
export function guildSection(guild) {
    const gc = guild.guild_class;
    if (gc === "restorative")
        return "rest";
    if (gc === "culinary_bundle" || gc === "ornamental_bundle")
        return "bundles";
    if (gc === "perennial_guild" && guild.ground_entity === "radial_rings")
        return "rings";
    if (gc === "polyculture" || gc === "perennial_guild")
        return "teams";
    return null;
}
export function bandRank(band) {
    return BAND_RANK[band ?? ""] ?? Object.keys(BAND_RANK).length;
}
const TIER_RANK = { full: 0, adequate: 1, marginal: 2 };
export function shortlistRank(band, tier) {
    return bandRank(band) * 10 + (TIER_RANK[tier ?? "marginal"] ?? 2);
}
export function browsableGuilds(bundle) {
    const SHOWN = new Set(["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle",
        "restorative"]);
    return bundle.guilds.filter((g) => SHOWN.has(g.guild_class) && !g.derived_from);
}
export function derivedGuilds(parentId, bundle) {
    return bundle.guilds
        .filter((g) => g.derived_from === parentId)
        .sort((a, b) => (a.footprint_min_m2 ?? 0) - (b.footprint_min_m2 ?? 0));
}
export function displayName(guild) {
    const raw = titleCase(guild.common?.[0] ?? humanize(guild.id)).replace(/\bGuild\b/g, "Team");
    return raw
        .replace(/(?<=\S )\b(And|With|Of|The|In|A|For|Among)\b(?= )/g, (w) => w.toLowerCase())
        .replace(/^(\S+) (\S+) and (\S+)$/, "$1, $2 and $3");
}
