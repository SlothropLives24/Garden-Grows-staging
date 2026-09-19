import { familyRotationRule, ineligibility, priorSeasonCredit, resolveSpecies, thinBreakSuggestion } from "./compiler.js";
import { circleFootprintM2, plantableM2, strongestSupportRequirement, viabilityFloor } from "./openbed.js";
import { adjacent } from "./regions.js";
const NOVELTY_REDIRECT = 0.55;
const ALLIUM_IDS = ["allium_cepa", "allium_sativum", "allium_schoenoprasum",
    "allium_ampeloprasum", "allium_fistulosum"];
const POLLINATOR_ORDER = { very_high: 0, high: 1 };
const WEIGHT = { A: 3, B: 2, C: 1, D: 0, F: 0 };
const ALLIUMS = new Set(ALLIUM_IDS);
function bandOf(score) {
    if (score >= 4)
        return "backed";
    if (score >= 1)
        return "partial";
    return "none";
}
function speciesById(bundle) {
    const m = new Map();
    for (const s of bundle.species)
        m.set(String(s.id), s);
    return m;
}
function rulesFor(roles, present, sp, rules = []) {
    const cat = (i) => String(sp.get(i)?.category ?? "");
    const fruiting = [...present].some((i) => cat(i) === "fruiting_vegetable" || cat(i) === "fruit");
    const hits = new Set();
    if (roles.support === "zea_mays")
        hits.add("R-001");
    if ("bulb_ring" in roles) {
        const centre = roles.canopy;
        const habit = centre ? String(sp.get(centre)?.habit ?? "") : "";
        if (habit === "tree")
            hits.add("R-075");
        else if (habit === "shrub" || habit === "vine")
            hits.add("R-075d");
        if ((habit === "tree" || habit === "shrub" || habit === "vine")
            && roles.bulb_ring === "narcissus_spp")
            hits.add("R-075b");
    }
    if ("masking" in roles
        && [...present].some((i) => String(sp.get(i)?.family ?? "") === "brassicaceae"))
        hits.add("R-050");
    if ("insectary" in roles && fruiting)
        hits.add("R-052");
    if ("cover" in roles)
        hits.add("R-053");
    if ("trap" in roles)
        hits.add("R-143");
    if ("shade" in roles && "bolter" in roles)
        hits.add("R-156");
    if ([...present].some((i) => ALLIUMS.has(i)) && present.has("daucus_carota"))
        hits.add("R-051");
    for (const r of rules) {
        if (!r.shared_regime)
            continue;
        const scope = new Set((r.applies_to?.species) ?? []);
        if (present.size >= 2 && [...present].every((i) => scope.has(i)))
            hits.add(String(r.id));
    }
    return [...hits].sort();
}
function annualPool(bundle) {
    const out = [];
    for (const s of bundle.species) {
        const life = String(s.lifespan ?? "");
        if (life !== "annual" && life !== "biennial")
            continue;
        if (s.entity_class === "structure")
            continue;
        if (s.status === "BLACKLISTED")
            continue;
        out.push(String(s.id));
    }
    return out.sort();
}
function missingFacts(site) {
    const hard = [], soft = [];
    if (site.lat == null)
        hard.push({ fact: "location", rules: ["R-076", "R-031", "R-081"] });
    if (!(site.bed_m2 || site.region || site.beds))
        hard.push({ fact: "growing_area", rules: ["R-002", "R-098", "R-042"] });
    if (site.sun == null)
        hard.push({ fact: "sun", rules: ["R-003", "R-004", "R-005"] });
    const empty = (v) => !v
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
    if (empty(site.occupancy) && empty(site.history))
        soft.push({ fact: "rotation_history",
            rules: ["R-010", "R-011", "R-012", "R-013", "R-071", "R-094", "R-095"] });
    const soil = site.soil;
    if (!soil || (typeof soil === "object" && Object.keys(soil).length === 0))
        soft.push({ fact: "soil_test", rules: ["R-017", "R-099", "R-101"] });
    return { hard, soft };
}
function derivedRoles(members, sp) {
    const roles = {};
    const ordered = [...members].sort();
    if (members.includes("zea_mays"))
        roles.support = "zea_mays";
    const anyBrassica = ordered.some((m) => String(sp.get(m)?.family ?? "") === "brassicaceae");
    for (const sid of ordered) {
        const s = sp.get(sid) ?? {};
        const provides = s.support?.provides;
        if (!("support" in roles) && (provides === "weak" || provides === "strong"))
            roles.support = sid;
        if (!("fixer" in roles) && s.n_fixing)
            roles.fixer = sid;
        if (!("cover" in roles) && s.ground_coverage === "high")
            roles.cover = sid;
        if (!("insectary" in roles)
            && (s.pollinator_value === "high" || s.pollinator_value === "very_high"))
            roles.insectary = sid;
        if (!("masking" in roles) && s.volatile_aromatic && anyBrassica)
            roles.masking = sid;
    }
    return roles;
}
function guildFillers(g) {
    const flat = (v) => {
        if (typeof v === "string")
            return [v];
        if (Array.isArray(v))
            return v.flatMap(flat);
        if (v && typeof v === "object")
            return Object.values(v).filter((x) => typeof x === "string");
        return [];
    };
    const out = new Set();
    for (const role of (g.roles ?? [])) {
        for (const id of flat(role.canonical))
            out.add(id);
        for (const id of flat(role.alternatives))
            out.add(id);
    }
    for (const m of g.members ?? []) {
        out.add(typeof m === "object" && m ? String(m.species) : String(m));
    }
    return out;
}
export function noveltyOf(members, roles, bundle) {
    const compRoles = new Set(Object.keys(roles));
    const compSpecies = new Set(members);
    let best = 0.0, who = null;
    for (const g of bundle.guilds) {
        const gspecies = guildFillers(g);
        if (!gspecies.size)
            continue;
        const inter = [...compSpecies].filter((s) => gspecies.has(s)).length;
        const sj = inter / (compSpecies.size + gspecies.size - inter);
        const groles = new Set((g.roles ?? []).map((r) => String(r.id)));
        let sim;
        if (groles.size && compRoles.size) {
            const rinter = [...compRoles].filter((r) => groles.has(r)).length;
            const rj = rinter / (compRoles.size + groles.size - rinter);
            sim = 0.5 * rj + 0.5 * sj;
        }
        else {
            sim = sj;
        }
        if (sim > best) {
            best = sim;
            who = g.id;
        }
    }
    return { nearest: who, similarity: Math.round(best * 10000) / 10000,
        redirect: Boolean(who) && best >= NOVELTY_REDIRECT };
}
function fp(sid, bundle) {
    return circleFootprintM2(resolveSpecies(sid, null, bundle)) ?? 0.0;
}
export function compose(site, wants, bundle) {
    const sp = speciesById(bundle);
    const { hard, soft } = missingFacts(site);
    if (hard.length) {
        return { refused: true, missing_facts: hard, disclosures: soft, proposal: [], exclusions: [],
            harmony: { score: 0, band: bandOf(0), rules: [] }, novelty: null };
    }
    const pool = new Set(annualPool(bundle));
    const wantSet = new Set(wants);
    const knownWants = [...wantSet].filter((w) => sp.has(w)).sort();
    const plantable = plantableM2(knownWants.map((w) => ({ species: w })), site, bundle)
        ?? site.bed_m2 ?? 0.0;
    const exclusions = [];
    const eligible = new Set();
    for (const sid of [...new Set([...wantSet, ...pool])].sort()) {
        if (!sp.has(sid)) {
            exclusions.push({ species: sid, rule: null, why: "unknown species" });
            continue;
        }
        if (!pool.has(sid)) {
            if (wantSet.has(sid)) {
                exclusions.push({ species: sid, rule: null,
                    why: "not an annual; composed plantings are annuals-only in v1" });
            }
            continue;
        }
        const reasons = ineligibility(resolveSpecies(sid, null, bundle), {}, site, bundle);
        if (reasons.length) {
            if (wantSet.has(sid)) {
                exclusions.push({ species: sid, rule: (reasons[0].rule ?? null),
                    why: String(reasons[0].why ?? "") });
            }
            continue;
        }
        eligible.add(sid);
    }
    const proposal = [];
    const used = new Set();
    let budget = 0.0;
    const fits = (sid, count) => budget + fp(sid, bundle) * count <= plantable + 1e-9;
    const add = (sid, warrant, count) => {
        if (used.has(sid) || !eligible.has(sid))
            return false;
        const n = count ?? Math.max(1, viabilityFloor(sp.get(sid)));
        if (!fits(sid, n))
            return false;
        proposal.push({ species: sid, count: n, warrant });
        used.add(sid);
        budget += fp(sid, bundle) * n;
        return true;
    };
    const siblings = site.siblings;
    const neighbours = [];
    const region = site.region;
    const adj = (siblings && region)
        ? siblings.filter((sib) => sib.region && adjacent(region, sib.region))
        : [];
    const sibHas = (sib, pred) => (sib.species ?? []).some((sid) => pred((sp.get(sid) ?? {})));
    const isInsectary = (r) => ["high", "very_high"].includes(String(r.pollinator_value ?? ""));
    const isFruiting = (r) => ["fruiting_vegetable", "fruit"].includes(String(r.category ?? ""));
    const fresh = wants.length === 0;
    let freshSignal = null;
    if (fresh) {
        const credit = priorSeasonCredit(site, bundle);
        const thin = credit ? null : thinBreakSuggestion(site, bundle);
        if (credit) {
            const heavies = [...eligible]
                .filter((s) => String(sp.get(s)?.feeder_class ?? "") === "heavy")
                .sort((a, b) => {
                const fa = ["fruiting_vegetable", "fruit"].includes(String(sp.get(a)?.category ?? "")) ? 0 : 1;
                const fb = ["fruiting_vegetable", "fruit"].includes(String(sp.get(b)?.category ?? "")) ? 0 : 1;
                return fa - fb || (a < b ? -1 : a > b ? 1 : 0);
            });
            for (const sid of heavies) {
                if (add(sid, { kind: "ground", rule: "R-015", why: credit.why }, Math.max(1, viabilityFloor(sp.get(sid))))) {
                    freshSignal = "R-015";
                    break;
                }
            }
        }
        else if (thin) {
            let anchored = false;
            if (eligible.has("daucus_carota")) {
                anchored = add("daucus_carota", { kind: "ground", rule: "R-013", why: thin.why });
            }
            for (const a of ALLIUM_IDS) {
                if (add(a, { kind: "ground", rule: "R-013", why: thin.why })) {
                    anchored = true;
                    break;
                }
            }
            if (anchored)
                freshSignal = "R-013";
        }
    }
    for (const sid of [...wantSet].filter((w) => eligible.has(w)).sort()) {
        const floor = viabilityFloor(sp.get(sid));
        if (!add(sid, { kind: "want" }, floor)) {
            exclusions.push({ species: sid, rule: "R-002",
                why: `a viable planting (${floor}) does not fit the bed` });
            if (sid === "zea_mays") {
                const grower = adj.find((sib) => (sib.species ?? []).includes("zea_mays"));
                if (grower) {
                    neighbours.push({ rule: "R-001", kind: "joint_block_possible",
                        detail: { with: grower.name } });
                }
            }
        }
    }
    const wantIds = new Set(proposal.map((p) => p.species));
    const cat = (s) => String(sp.get(s)?.category ?? "");
    const fruitingWant = [...wantIds].sort()
        .find((s) => cat(s) === "fruiting_vegetable" || cat(s) === "fruit") ?? null;
    const brassicaWant = [...wantIds].sort()
        .find((s) => String(sp.get(s)?.family ?? "") === "brassicaceae") ?? null;
    if (wantIds.has("daucus_carota") && ![...wantIds].some((s) => ALLIUMS.has(s))) {
        for (const a of ALLIUM_IDS) {
            if (add(a, { kind: "rule", rule: "R-051", beside: "daucus_carota" }))
                break;
        }
    }
    const pv = (s) => String(sp.get(s)?.pollinator_value ?? "");
    if (fruitingWant && ![...used].some((s) => pv(s) === "high" || pv(s) === "very_high")) {
        const server = adj.find((sib) => sibHas(sib, isInsectary));
        if (server) {
            const sidSrv = (server.species ?? []).find((sid) => isInsectary((sp.get(sid) ?? {})));
            neighbours.push({ rule: "R-052", kind: "served_by_neighbour",
                detail: { from: server.name, species: sidSrv } });
        }
        else {
            const insectaries = [...eligible].filter((s) => !used.has(s))
                .filter((s) => pv(s) === "high" || pv(s) === "very_high")
                .sort((a, b) => (POLLINATOR_ORDER[pv(a)] - POLLINATOR_ORDER[pv(b)]) || (a < b ? -1 : 1));
            for (const c of insectaries) {
                if (add(c, { kind: "rule", rule: "R-052", beside: fruitingWant })) {
                    for (const sib of adj) {
                        if (sibHas(sib, isFruiting) && !sibHas(sib, isInsectary)) {
                            neighbours.push({ rule: "R-052", kind: "serves_neighbour", detail: { to: sib.name } });
                        }
                    }
                    break;
                }
            }
        }
    }
    if (brassicaWant && ![...used].some((s) => Boolean(sp.get(s)?.volatile_aromatic))) {
        const maxH = (s) => {
            const h = sp.get(s)?.mature_height_cm;
            if (Array.isArray(h))
                return h.length ? Math.max(...h.map(Number)) : null;
            return h == null ? null : Number(h);
        };
        const maskers = [...eligible].filter((s) => !used.has(s))
            .filter((s) => Boolean(sp.get(s)?.volatile_aromatic))
            .filter((s) => { const h = maxH(s); return h != null && h <= 60; }).sort();
        for (const c of maskers) {
            if (add(c, { kind: "rule", rule: "R-050", beside: brassicaWant }))
                break;
        }
    }
    if (wantIds.size && ![...used].some((s) => sp.get(s)?.ground_coverage === "high")) {
        const covers = [...eligible].filter((s) => !used.has(s))
            .filter((s) => sp.get(s)?.ground_coverage === "high"
            && sp.get(s)?.habit === "vine" && !sp.get(s)?.casts_shade).sort();
        for (const c of covers) {
            if (add(c, { kind: "rule", rule: "R-053", beside: [...wantIds].sort()[0] }))
                break;
        }
    }
    const prov = (s) => sp.get(s)?.support?.provides;
    const needsSupport = [...used].filter((s) => strongestSupportRequirement(sp.get(s) ?? {}) === "strong").sort();
    const hasProvider = [...used].some((s) => prov(s) === "weak" || prov(s) === "strong");
    if (needsSupport.length && !hasProvider && !used.has("trellis_structure")) {
        proposal.push({ species: "trellis_structure", count: 1,
            warrant: { kind: "structure", rule: "R-040", for: needsSupport[0] } });
        used.add("trellis_structure");
    }
    const wn = (sid) => String(sp.get(sid)?.water_need ?? "");
    const steadySeated = [...used].filter((sid) => wn(sid) === "steady").sort();
    const lowsWanted = [...wantSet].filter((sid) => sp.has(sid) && wn(sid) === "low").sort();
    let split;
    if (steadySeated.length && lowsWanted.length) {
        for (const sid of lowsWanted) {
            if (used.has(sid)) {
                for (let i = proposal.length - 1; i >= 0; i--)
                    if (proposal[i].species === sid)
                        proposal.splice(i, 1);
                used.delete(sid);
            }
        }
        split = { rule: "R-142", low: lowsWanted, steady: steadySeated, team: "dry_herb_bed" };
    }
    const members = [...used].sort();
    const roles = derivedRoles(members, sp);
    const fired = rulesFor(roles, new Set(members), sp, bundle.rules);
    const gradeOf = new Map(bundle.rules
        .map((r) => [String(r.id), String(r.grade ?? "")]));
    const score = fired.reduce((acc, rid) => acc + (WEIGHT[gradeOf.get(rid) ?? ""] ?? 0), 0);
    const harmony = { score, band: bandOf(score), rules: fired };
    const nov = members.length ? noveltyOf(members, roles, bundle) : null;
    if (fresh && siblings) {
        const FAMILY_RULE = familyRotationRule(bundle);
        const seenFams = new Set();
        for (const p of proposal) {
            const fam = String(sp.get(p.species)?.family ?? "");
            const rid = FAMILY_RULE[fam];
            if (!rid || seenFams.has(fam))
                continue;
            const withs = siblings
                .filter((sib) => (sib.species ?? []).some((sid) => String(sp.get(sid)?.family ?? "") === fam))
                .map((sib) => sib.name).sort();
            if (withs.length) {
                seenFams.add(fam);
                neighbours.push({ rule: rid, kind: "forward_foreclosure",
                    detail: { family: fam, with: withs } });
            }
        }
    }
    const R111_FAMILIES = new Set(["solanaceae", "cucurbitaceae", "brassicaceae"]);
    const seenPatch = new Set();
    for (const p of proposal) {
        const fam = String(sp.get(p.species)?.family ?? "");
        if (!R111_FAMILIES.has(fam) || seenPatch.has(fam))
            continue;
        const withs = adj
            .filter((sib) => (sib.species ?? []).some((sid) => String(sp.get(sid)?.family ?? "") === fam))
            .map((sib) => sib.name).sort();
        if (withs.length) {
            seenPatch.add(fam);
            neighbours.push({ rule: "R-111", kind: "same_family_patch",
                detail: { family: fam, with: withs } });
        }
    }
    if (siblings) {
        const wantGroups = site.want_groups ?? {};
        const firstGroup = (sid) => {
            const g = resolveSpecies(sid, null, bundle).cultivar_group;
            return typeof g === "string" ? g : null;
        };
        for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
            const t = (r.trigger ?? {});
            if (t.kind !== "cultivar_group_isolation" || !t.species)
                continue;
            const target = t.species;
            if (!proposal.some((p) => p.species === target))
                continue;
            const mine = wantGroups[target] ?? firstGroup(target);
            const withs = [];
            for (const sib of siblings) {
                for (const m of sib.members ?? []) {
                    if (m.species !== target)
                        continue;
                    const theirs = m.group ?? firstGroup(target);
                    if (theirs && mine && theirs !== mine && !withs.some((w) => w.bed === sib.name && w.group === theirs)) {
                        withs.push({ bed: sib.name, group: theirs });
                    }
                }
            }
            if (withs.length)
                neighbours.push({ rule: r.id, kind: "kinds_across_beds", detail: { species: target, mine, with: withs } });
        }
    }
    const out = { refused: false, missing_facts: [], disclosures: soft, proposal, exclusions,
        harmony, novelty: nov };
    if (siblings !== undefined)
        out.neighbours = neighbours;
    if (split)
        out.split = split;
    if (fresh) {
        out.fresh = { signal: freshSignal,
            note: freshSignal ? null
                : "nothing to compose FROM yet - this ground carries no signal (no banked "
                    + "nitrogen, no rotation load to break). Pick a plant to build around, or "
                    + "plant a named team." };
    }
    return out;
}
