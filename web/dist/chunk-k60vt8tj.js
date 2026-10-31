import './chunk-lutet8cz.js';
import { rotationRules, eligibleSpecies, isForage } from './core.js';
import { guildsPlacing } from './chunk-h8sxf1mq.js';
import { copy, fillCopy } from './paint.js';
import { heldFamiliesLine } from './chunk-dpsx67rd.js';

const teamSpecies = (g) => [
    ...(g.members ?? []).map((m) => String(m.species)),
    ...(g.roles ?? []).map((r) => r.canonical ?? "").filter(Boolean),
];
function forPollinators(g, bundle) {
    const byId = new Map(bundle.species.map((s) => [s.id, s]));
    return new Set(teamSpecies(g).filter((sid) => isForage(byId.get(sid)))).size >= 2;
}
function forPots(g) {
    const names = [].concat(g.common ?? []);
    return names.some((n) => /\b(patio|container|windowsill)\b/i.test(n));
}
function teamLift(space, after, bundle) {
    const pots = space === "pots", bees = after === "pollinators";
    if (!pots && !bees)
        return null;
    const lifts = (g) => (pots && forPots(g)) || (bees && forPollinators(g, bundle));
    const line = pots && bees ? copy.plLiftPotsBees : pots ? copy.plLiftPots : copy.plLiftBees;
    return { lifts, line };
}
function groundRest(site, bundle) {
    const interval = rotationRules(bundle);
    const held = new Map();
    for (const b of eligibleSpecies(site, bundle).blocked) {
        if (b.family && b.blocked_by.some((r) => r.rule !== null && interval.has(r.rule)))
            held.set(b.species, b.family);
    }
    if (!held.size)
        return null;
    const builtOn = (g) => [
        ...(g.members ?? []).map((m) => String(m.species)),
        ...(g.roles ?? []).filter((r) => !r.optional).map((r) => r.canonical ?? "").filter(Boolean),
    ];
    const restsOn = (g) => builtOn(g).filter((sid) => held.has(sid));
    const line = (gs) => {
        const fams = [...new Set(gs.flatMap(restsOn).map((sid) => held.get(sid)))].sort();
        return heldFamiliesLine(fams, "plRestLast", "plRestLastOne");
    };
    return { rests: (g) => restsOn(g).length > 0, line };
}
const L_PER_GAL = 3.78541;
function potSize(gal, metric) {
    if (typeof gal !== "number" || !(gal > 0))
        return null;
    const litres = gal * L_PER_GAL;
    const l = litres < 10 ? `${Math.round(litres * 10) / 10} L` : `${Math.round(litres)} L`;
    const pints = Math.round(gal * 8);
    const us = gal < 0.5 ? (pints === 1 ? copy.potPintOne : fillCopy("potPintMany", { n: pints }))
        : gal === 0.5 ? copy.potHalfGallon : gal === 1 ? copy.potGallonOne : fillCopy("potGallonMany", { n: gal });
    return metric ? fillCopy("potAtLeastMetric", { l, us }) : fillCopy("potAtLeastUs", { us, l });
}
function bigSeeds(bundle) {
    return bundle.species
        .filter((s) => s.seed_size === "large")
        .map((s) => String((s.common ?? [])[0] ?? s.id))
        .map((n) => n.replace(/^./, (c) => c.toUpperCase()))
        .sort((a, b) => a.localeCompare(b));
}
function teamsForPlant(sid, bundle) {
    const placing = new Set(guildsPlacing(sid, bundle));
    return bundle.guilds
        .filter((g) => placing.has(g.id) || (g.members ?? []).some((m) => m.species === sid))
        .map((g) => g.id);
}

export { bigSeeds, forPots, groundRest, potSize, teamLift, teamsForPlant };
