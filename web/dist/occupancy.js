import { area as regionArea, intersectArea, parseRegion } from "./engine/regions.js";
import { seasonId as currentSeasonId } from "./session.js";
export function plantingOnBed(plantingRegion, bedRegion) {
    const a = regionArea(plantingRegion);
    return a > 0 && intersectArea(plantingRegion, bedRegion) >= 0.5 * a;
}
export function sectionParentName(name, bedNames) {
    const m = name.match(/^(.*) (\d+)$/);
    if (!m)
        return null;
    for (const n of bedNames)
        if (n === m[1])
            return m[1];
    return null;
}
export function sectionParentOf(bed, beds) {
    const parentName = sectionParentName(bed.name, beds.map((b) => b.name));
    if (parentName === null)
        return null;
    const parent = beds.find((b) => b.name === parentName);
    if (!parent)
        return null;
    const a = regionArea(bed.region);
    return a > 0 && intersectArea(bed.region, parent.region) >= 0.5 * a ? parentName : null;
}
export function bedHasSections(name, beds) {
    return beds.some((b) => sectionParentOf(b, beds) === name);
}
export function bedSeasonStatus(bedRegion, season) {
    if (!season)
        return { growing: 0, ended: 0, carried: 0, closed: false, label: "no season yet" };
    const on = (season.plantings ?? []).filter((pl) => plantingOnBed(pl.region, bedRegion));
    const carried = on.filter((pl) => pl.carried_over === true).length;
    const ended = on.filter((pl) => !!pl.end_cause).length;
    const growing = on.length - carried - ended;
    const closed = !!season.closed_date;
    let label;
    if (closed) {
        label = carried ? `dormant · ${carried} overwintering` : "dormant";
    }
    else if (!on.length) {
        label = "ready to plant";
    }
    else {
        const parts = [];
        if (growing)
            parts.push(`${growing} growing`);
        if (carried)
            parts.push(`${carried} overwintering`);
        if (ended)
            parts.push(`${ended} ended`);
        label = parts.length ? parts.join(" · ") : "done for the season";
    }
    return { growing, ended, carried, closed, label };
}
export function declaredPriorYear() {
    return (currentSeasonId() ?? new Date().getFullYear()) - 1;
}
export function mergePriorOccupancy(derived, seeds, candidate) {
    if (!seeds?.length)
        return derived;
    const cand = parseRegion(candidate);
    const history = {};
    for (const [k, v] of Object.entries(derived.history))
        history[k] = [...v];
    const contributions = [...derived.contributions];
    for (const seed of seeds) {
        const overlap = intersectArea(cand, parseRegion(seed.region));
        if (overlap <= 0)
            continue;
        const key = String(seed.year);
        history[key] = [...new Set([...(history[key] ?? []), ...seed.families])].sort();
        for (const fam of seed.families)
            contributions.push({ season: key, species: "", family: fam, overlap_m2: overlap });
    }
    return { history, contributions, unknown_species: derived.unknown_species, verticillium_reservoir: derived.verticillium_reservoir,
        allelopathic_residue: derived.allelopathic_residue, last_season_species: derived.last_season_species };
}
