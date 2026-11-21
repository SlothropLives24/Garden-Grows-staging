import { springPlantedTeam } from './core.js';

function teamsHolding(crop, bundle) {
    const out = new Set();
    for (const g of bundle.guilds) {
        const inRole = (g.roles ?? []).some((r) => [r.canonical, r.substitute, r.alternative, ...(r.alternatives ?? [])]
            .some((a) => (typeof a === "string" ? a : a?.species) === crop));
        const asMember = (g.members ?? []).some((m) => m.species === crop);
        if (inRole || asMember)
            out.add(g.id);
    }
    return out;
}
function doorTryable(door, bundle) {
    const g = door.guild ? bundle.guilds.find((x) => x.id === door.guild) : undefined;
    if (g)
        return springPlantedTeam(g, bundle);
    if (!door.crop)
        return false;
    const holding = teamsHolding(door.crop, bundle);
    return bundle.guilds.some((x) => holding.has(x.id) && springPlantedTeam(x, bundle));
}

export { doorTryable, teamsHolding };
