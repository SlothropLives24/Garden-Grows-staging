// The seasonal axis (O72) - line-for-line port of engine/season_compose.py, same operation order
// so the season section of the openbed conformance golden matches exactly. DOM-free.
//
// composeSeason(site, bundle) answers ONE STEP: given a region's real occupancy history (the
// same site.history shape every rotation gate reads), which guilds does the ORDER favour next
// season, each term naming its rule. The three terms, each claim-faithful (see the oracle's
// docstring for the full reasoning): R-015 backward (prior season banked fabaceae N, the heavy
// feeder collects), R-015 forward (a RESTORATIVE guild deposits the green-manure load - a bean
// crop harvested for pods is not green manure), R-013 (thin ground and a FULL allium/apiaceae
// load - a partial daffodil is not an apiaceous crop), minus one interval conflict per
// rotation_load family still inside its window. Ground with no history is QUIET. A guild with
// no term does not appear. No follows_well field exists or ever will.
import { currentPlantingYear, familyWithinInterval, priorSeasonCredit, thinBreakSuggestion } from "./compiler.js";
// Grade -> weight, the harmony core's map (maintainer decision 5: one vocabulary for both axes).
const WEIGHT = { A: 3, B: 2, C: 1, D: 0, F: 0 };
const FAMILY_ROTATION_RULE = {
    solanaceae: "R-010", cucurbitaceae: "R-011", brassicaceae: "R-012",
};
const SEQUENCE_CLASSES = new Set(["polyculture", "culinary_bundle", "ornamental_bundle", "restorative"]);
function candidates(bundle) {
    return bundle.guilds.filter((g) => SEQUENCE_CLASSES.has(g.guild_class) && !g.derived_from);
}
function wantsNitrogen(guild, sp) {
    const named = new Set();
    for (const role of guild.roles ?? []) {
        if (typeof role.canonical === "string")
            named.add(role.canonical);
    }
    for (const m of guild.members ?? []) {
        named.add(typeof m === "object" && m !== null ? String(m.species) : String(m));
    }
    return [...named].some((sid) => String(sp.get(sid)?.feeder_class ?? "") === "heavy");
}
function gradeWeight(bundle, rid) {
    return WEIGHT[bundle.rules.find((r) => r.id === rid)?.grade ?? ""] ?? 0;
}
/** One step of the seasonal axis for one region - mirrors compose_season(site, cx) exactly;
 *  the conformance golden pins the pair. */
export function composeSeason(site, bundle) {
    const history = site.history;
    const note = "scores are what the ORDER buys - each guild's own merit is on its card; "
        + "eligibility still gates every species at planting time";
    if (!history || typeof history !== "object" || Array.isArray(history)
        || !Object.keys(history).length) {
        return { planting_year: null, quiet: true, credits: [], successors: [],
            note: "no history on this ground - nothing follows anything yet, and "
                + "eligibility is the honest guide, not a ranking dressed up as one" };
    }
    const nCredit = priorSeasonCredit(site, bundle);
    const thin = thinBreakSuggestion(site, bundle);
    const credits = [];
    if (nCredit)
        credits.push(nCredit);
    if (thin)
        credits.push(thin);
    const suggests = new Set(thin?.families ?? []);
    const w015 = gradeWeight(bundle, "R-015");
    const w013 = gradeWeight(bundle, "R-013");
    const sp = new Map();
    for (const s of bundle.species)
        sp.set(String(s.id), s);
    const successors = [];
    for (const g of candidates(bundle)) {
        const terms = [];
        const load = g.rotation_load ?? {};
        if (nCredit && wantsNitrogen(g, sp)) {
            terms.push({ rule: "R-015", kind: "nitrogen_banked", weight: w015, why: nCredit.why });
        }
        // Fires only on LOADED ground - the corpus scopes the restorative guild itself there,
        // and on neutral ground "plant a legume, always" is not a sequencing claim (see the oracle).
        if (thin && g.guild_class === "restorative" && load.fabaceae === "full") {
            terms.push({ rule: "R-015", kind: "banks_nitrogen", weight: w015,
                why: "deposits a full legume green-manure load; next season's "
                    + "heavy feeder collects the credit" });
        }
        const fullBreak = [...suggests].some((f) => load[f] === "full");
        if (thin && fullBreak && !Object.keys(load).some((f) => f in FAMILY_ROTATION_RULE)) {
            terms.push({ rule: "R-013", kind: "rotation_break", weight: w013,
                why: "an allium or apiaceous planting breaks the cycle of every "
                    + "family this ground is holding" });
        }
        for (const fam of Object.keys(load).sort()) {
            const rid = FAMILY_ROTATION_RULE[fam];
            if (!rid)
                continue;
            // The interval comes from the rule's own trigger in the bundle, as the oracle reads it.
            const years = bundle.rules.find((r) => r.id === rid)?.trigger?.years;
            if (years !== undefined && familyWithinInterval(site, fam, years)) {
                terms.push({ rule: rid, kind: "family_repeat", weight: -gradeWeight(bundle, rid),
                    why: `${fam} is still inside its rotation interval here` });
            }
        }
        if (terms.length) {
            successors.push({ guild: g.id, score: terms.reduce((s, t) => s + t.weight, 0), terms });
        }
    }
    successors.sort((a, b) => b.score - a.score
        || (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0));
    const year = currentPlantingYear(site);
    if (!successors.length) {
        return { planting_year: year, quiet: true, credits, successors: [],
            note: "the ground's history gives no order to score - anything eligible "
                + "is as good first as second" };
    }
    return { planting_year: year, quiet: false, credits, successors, note };
}
