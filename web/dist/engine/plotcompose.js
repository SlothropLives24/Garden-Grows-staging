import { ADJACENT_MAX_GAP_M, adjacent, area } from "./regions.js";
export { ADJACENT_MAX_GAP_M };
const LADDER = [
    [0.0, 1.0, "under_1", "Nothing composes at this size - one container, one small planting."],
    [1.0, 4.0, "one_guild", "This plot holds one planting at a time - the honest answer, not a lesser one."],
    [4.0, 10.0, "first_combination",
        "The first point where combination is possible - two or three small plantings, or one full guild."],
    [10.0, 25.0, "rotation_real", "Several plantings; rotation across beds becomes real."],
    [25.0, 50.0, "perennial_layout",
        "Room for a full tree guild with annual beds around it - layout starts to matter."],
    [50.0, Infinity, "full_rotation",
        "Full multi-season rotation, with room for a restorative bed in the cycle."],
];
const MAX_BEDS = 6;
const PER_BED_POOL = 8;
const TOP_ARRANGEMENTS = 3;
const CROSS_CREDIT = 1;
export function ladderTier(totalM2) {
    for (const [lo, hi, key, copy] of LADDER) {
        if (lo <= totalM2 && totalM2 < hi) {
            return { key, copy, lo, hi: hi === Infinity ? null : hi };
        }
    }
    return { key: "under_1", copy: LADDER[0][3], lo: 0.0, hi: 1.0 };
}
export function adjacencyGroups(beds) {
    const n = beds.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i) => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (adjacent(beds[i].region, beds[j].region))
                parent[find(i)] = find(j);
        }
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!groups.has(r))
            groups.set(r, []);
        groups.get(r).push(i);
    }
    return [...groups.values()].sort(cmpNumArrays);
}
function cmpNumArrays(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return a.length - b.length;
}
function cmpStrArrays(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i])
            return a[i] < b[i] ? -1 : 1;
    }
    return a.length - b.length;
}
const SHOWN = new Set(["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle",
    "restorative"]);
function browsable(bundle) {
    return bundle.guilds.filter((g) => SHOWN.has(g.guild_class) && !g.derived_from);
}
function hscore(g) {
    return g.derived_harmony?.score ?? 0;
}
function hrules(g) {
    return g.derived_harmony?.rules ?? [];
}
function fits(g, areaM2) {
    return Number(g.footprint_min_m2 || 0) <= areaM2 + 1e-9;
}
function flatten(value) {
    if (typeof value === "string")
        return [value];
    if (Array.isArray(value))
        return value.flatMap(flatten);
    if (value && typeof value === "object") {
        return Object.values(value).filter((v) => typeof v === "string");
    }
    return [];
}
function guildSpecies(g) {
    const out = new Set();
    for (const role of g.roles ?? []) {
        for (const s of flatten(role.canonical))
            out.add(s);
        for (const s of flatten(role.alternatives))
            out.add(s);
    }
    for (const m of g.members ?? []) {
        out.add(typeof m === "object" && m !== null ? String(m.species) : String(m));
    }
    return out;
}
function fruitingGuild(g, sp) {
    return [...guildSpecies(g)].some((i) => {
        const cat = String(sp.get(i)?.category ?? "");
        return cat === "fruiting_vegetable" || cat === "fruit";
    });
}
export function composePlot(site, bundle) {
    const beds = site.beds ?? [];
    const excluded = new Map();
    for (const [name, ids] of Object.entries(site.excluded ?? {}))
        excluded.set(name, new Set(ids ?? []));
    const allowed = (g, bedNames) => bedNames.every((n) => !excluded.get(n)?.has(g.id));
    const total = Math.round(beds.reduce((s, b) => s + area(b.region), 0) * 1e4) / 1e4;
    const tier = ladderTier(total);
    const base = {
        tier, total_m2: total, refused: false,
        note: "cross-boundary conflicts term is present and EMPTY: no negative is "
            + "computable yet (juglone distances are not collected; the small-seeded "
            + "class has no marker field)",
    };
    if (!beds.length)
        return { ...base, refused: true, groups: [], arrangements: [] };
    if (beds.length > MAX_BEDS) {
        return {
            ...base, refused: true, groups: [], arrangements: [],
            note: `more than ${MAX_BEDS} beds - the arranger refuses rather than `
                + `pretending to search that space`,
        };
    }
    const sp = new Map();
    for (const s of bundle.species)
        sp.set(String(s.id), s);
    const groups = adjacencyGroups(beds);
    const namedGroups = groups.map((grp) => grp.map((i) => beds[i].name));
    const guilds = browsable(bundle);
    const byHarmony = (a, b) => hscore(b) - hscore(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (tier.key === "under_1" || tier.key === "one_guild" || beds.length === 1) {
        let host = beds[0];
        for (const b of beds)
            if (area(b.region) > area(host.region))
                host = b;
        const fit = guilds.filter((g) => fits(g, area(host.region)) && allowed(g, [host.name])).sort(byHarmony);
        let arrangements = [];
        if (fit.length) {
            const g = fit[0];
            arrangements = [{
                    assignments: [{ beds: [host.name], guild: g.id, spans: false }],
                    score: hscore(g), cross: [],
                }];
        }
        return { ...base, groups: namedGroups, arrangements };
    }
    const perBed = beds.map((b) => {
        const a = area(b.region);
        return guilds.filter((g) => fits(g, a) && allowed(g, [b.name])).sort(byHarmony).slice(0, PER_BED_POOL);
    });
    const spans = [];
    for (const grp of groups) {
        if (grp.length < 2)
            continue;
        const combined = grp.reduce((s, i) => s + area(beds[i].region), 0);
        const singles = Math.max(...grp.map((i) => area(beds[i].region)));
        for (const g of guilds) {
            if (g.ground_entity === "radial_rings")
                continue;
            if (fits(g, combined) && !fits(g, singles) && allowed(g, grp.map((i) => beds[i].name)))
                spans.push({ beds: grp, guild: g });
        }
    }
    const crossCredits = (assignment) => {
        const credits = [];
        for (const [i, gi] of assignment) {
            if (!hrules(gi).includes("R-052"))
                continue;
            for (const [j, gj] of assignment) {
                if (j === i || hrules(gj).includes("R-052"))
                    continue;
                if (!adjacent(beds[i].region, beds[j].region))
                    continue;
                if (fruitingGuild(gj, sp)) {
                    credits.push({ rule: "R-052", kind: "insectary_spillover",
                        detail: { from: beds[i].name, to: beds[j].name } });
                }
            }
        }
        return credits;
    };
    const arrangements = [];
    const emit = (assignPairs, spanUsed) => {
        let score = assignPairs.reduce((s, [, g]) => s + hscore(g), 0);
        let cross = crossCredits(assignPairs);
        score += cross.length * CROSS_CREDIT;
        const assignments = assignPairs.map(([i, g]) => ({ beds: [beds[i].name], guild: g.id, spans: false }));
        if (spanUsed) {
            assignments.push({ beds: spanUsed.beds.map((i) => beds[i].name),
                guild: spanUsed.guild.id, spans: true });
            score += hscore(spanUsed.guild);
            if (hrules(spanUsed.guild).includes("R-001")) {
                cross = [...cross, { rule: "R-001", kind: "joint_corn_block",
                        detail: { beds: spanUsed.beds.map((i) => beds[i].name) } }];
            }
        }
        assignments.sort((a, b) => cmpStrArrays(a.beds, b.beds)
            || (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0));
        arrangements.push({ assignments, score, cross });
    };
    const product = (bedIdxs, acc, spanUsed) => {
        if (!bedIdxs.length) {
            emit(acc, spanUsed);
            return;
        }
        const [i, ...rest] = bedIdxs;
        const pool = perBed[i].length ? perBed[i] : [null];
        for (const g of pool) {
            if (g === null)
                product(rest, acc, spanUsed);
            else
                product(rest, [...acc, [i, g]], spanUsed);
        }
    };
    product(beds.map((_, i) => i), [], null);
    for (const span of spans) {
        const others = beds.map((_, i) => i).filter((i) => !span.beds.includes(i));
        product(others, [], span);
    }
    const keyOf = (a) => JSON.stringify(a.assignments.map((x) => [x.beds, x.guild, x.spans]));
    const cmpAssign = (a, b) => {
        const n = Math.min(a.assignments.length, b.assignments.length);
        for (let i = 0; i < n; i++) {
            const xa = a.assignments[i], xb = b.assignments[i];
            const c = cmpStrArrays(xa.beds, xb.beds)
                || (xa.guild < xb.guild ? -1 : xa.guild > xb.guild ? 1 : 0)
                || Number(xa.spans) - Number(xb.spans);
            if (c)
                return c;
        }
        return a.assignments.length - b.assignments.length;
    };
    const distinct = (a) => new Set(a.assignments.map((x) => x.guild)).size;
    arrangements.sort((a, b) => b.score - a.score
        || a.assignments.length - b.assignments.length
        || b.cross.length - a.cross.length
        || distinct(b) - distinct(a)
        || cmpAssign(a, b));
    const seen = new Set();
    const seenSets = new Set();
    const uniq = [];
    for (const a of arrangements) {
        const k = keyOf(a);
        const ms = JSON.stringify(a.assignments.map((x) => [x.guild, x.spans]).sort());
        if (seen.has(k) || seenSets.has(ms))
            continue;
        seen.add(k);
        seenSets.add(ms);
        uniq.push(a);
    }
    return { ...base, groups: namedGroups, arrangements: uniq.slice(0, TOP_ARRANGEMENTS) };
}
