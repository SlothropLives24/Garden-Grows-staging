import { breakFamilies, currentPlantingYear, familyRotationRule, familyWithinInterval, priorSeasonCredit, thinBreakSuggestion } from "./compiler.js";
const WEIGHT = { A: 3, B: 2, C: 1, D: 0, F: 0 };
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
        if (thin && g.guild_class === "restorative" && load.fabaceae === "full") {
            terms.push({ rule: "R-015", kind: "banks_nitrogen", weight: w015,
                why: "deposits a full legume green-manure load; next season's "
                    + "heavy feeder collects the credit" });
        }
        const fullBreak = [...suggests].some((f) => load[f] === "full");
        const breaks = breakFamilies(bundle);
        if (thin && fullBreak && !Object.keys(load).some((f) => breaks.has(f))) {
            terms.push({ rule: "R-013", kind: "rotation_break", weight: w013,
                why: "an allium or apiaceous planting breaks the cycle of every "
                    + "family this ground is holding" });
        }
        for (const fam of Object.keys(load).sort()) {
            const rid = familyRotationRule(bundle)[fam];
            if (!rid)
                continue;
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
