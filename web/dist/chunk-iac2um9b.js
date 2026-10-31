import { fillCopy, copy, nameAsLabel, humanize } from './paint.js';
import { area, adjacent, bedSeasonStatus, plantingOnBed, inGround } from './core.js';
import './chunk-lutet8cz.js';

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
function ladderTier(totalM2) {
    for (const [lo, hi, key, copy] of LADDER) {
        if (lo <= totalM2 && totalM2 < hi) {
            return { key, copy, lo, hi: hi === Infinity ? null : hi };
        }
    }
    return { key: "under_1", copy: LADDER[0][3], lo: 0.0, hi: 1.0 };
}
function adjacencyGroups(beds) {
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
const MEMO = new WeakMap();
const MEMO_KEEP = 8;
function composePlot(site, bundle) {
    const table = bundle.guilds;
    const key = JSON.stringify([site.beds ?? [], site.excluded ?? {}]);
    let memo = MEMO.get(table);
    if (!memo) {
        memo = new Map();
        MEMO.set(table, memo);
    }
    const hit = memo.get(key);
    if (hit)
        return hit;
    const r = composePlotUncached(site, bundle);
    memo.set(key, r);
    if (memo.size > MEMO_KEEP)
        memo.delete(memo.keys().next().value);
    return r;
}
function composePlotUncached(site, bundle) {
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
    const rank = (a, b) => b.score - a.score
        || a.assignments.length - b.assignments.length
        || b.cross.length - a.cross.length
        || distinct(b) - distinct(a)
        || cmpAssign(a, b);
    const build = (assignPairs, spanUsed) => {
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
        return { assignments, score, cross };
    };
    const best = new Map();
    let bar = -Infinity;
    const raiseBar = () => {
        if (best.size < TOP_ARRANGEMENTS)
            return;
        const scores = [...best.values()].map((a) => a.score).sort((x, y) => y - x);
        bar = scores[TOP_ARRANGEMENTS - 1];
    };
    const offer = (a) => {
        const ms = JSON.stringify(a.assignments.map((x) => [x.guild, x.spans]).sort());
        const have = best.get(ms);
        if (!have || rank(a, have) < 0) {
            best.set(ms, a);
            raiseBar();
        }
    };
    const n = beds.length;
    const adj = beds.map((bi, i) => beds.map((bj, j) => i !== j && adjacent(bi.region, bj.region)));
    const r052 = new Map(), fruiting = new Map();
    for (const g of guilds) {
        r052.set(g, hrules(g).includes("R-052"));
        fruiting.set(g, fruitingGuild(g, sp));
    }
    const crossCount = (pairs) => {
        let c = 0;
        for (const [i, gi] of pairs) {
            if (!r052.get(gi))
                continue;
            for (const [j, gj] of pairs) {
                if (j !== i && !r052.get(gj) && adj[i][j] && fruiting.get(gj))
                    c++;
            }
        }
        return c;
    };
    const bedMax = perBed.map((pool) => pool.length ? Math.max(0, ...pool.map(hscore)) : 0);
    let adjPairs = 0;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
            if (adj[i][j])
                adjPairs++;
    const maxCross = adjPairs * CROSS_CREDIT;
    const search = (order, spanUsed) => {
        const spanScore = spanUsed ? hscore(spanUsed.guild) : 0;
        const restMax = new Array(order.length + 1).fill(0);
        for (let k = order.length - 1; k >= 0; k--)
            restMax[k] = restMax[k + 1] + bedMax[order[k]];
        const acc = [];
        const walk = (k, sum) => {
            if (sum + restMax[k] + maxCross + spanScore < bar)
                return;
            if (k === order.length) {
                const score = sum + crossCount(acc) * CROSS_CREDIT + spanScore;
                if (score < bar)
                    return;
                offer(build(acc.slice(), spanUsed));
                return;
            }
            const i = order[k];
            if (!perBed[i].length) {
                walk(k + 1, sum);
                return;
            }
            for (const g of perBed[i]) {
                acc.push([i, g]);
                walk(k + 1, sum + hscore(g));
                acc.pop();
            }
        };
        walk(0, 0);
    };
    search(beds.map((_, i) => i), null);
    for (const span of spans) {
        search(beds.map((_, i) => i).filter((i) => !span.beds.includes(i)), span);
    }
    const uniq = [...best.values()].sort(rank);
    return { ...base, groups: namedGroups, arrangements: uniq.slice(0, TOP_ARRANGEMENTS) };
}

function tierWords(key) {
    const w = { under_1: copy.ptTierUnder1, one_guild: copy.ptTierOneGuild,
        first_combination: copy.ptTierFirstCombination, rotation_real: copy.ptTierRotationReal,
        perennial_layout: copy.ptTierPerennialLayout, full_rotation: copy.ptTierFullRotation };
    return w[key] ?? copy.ptTierOneGuild;
}
const allPots = (beds) => beds.length > 0 && beds.every((b) => b.structure === "container");
function tierLine(beds) {
    if (beds.length > 1 && allPots(beds))
        return fillCopy("ptTierPots", { n: beds.length });
    const total = Math.round(beds.reduce((s, b) => s + area(b.region), 0) * 1e4) / 1e4;
    const key = ladderTier(total).key;
    if (key === "under_1" && beds.length === 1)
        return allPots(beds) ? copy.ptTierUnder1Pot : copy.ptTierUnder1Bed;
    return tierWords(key);
}
function bedState(bed, season, teamLabel) {
    const bare = { key: "empty", chip: copy.bsBareChip, line: copy.bsNothingPlanned };
    try {
        if (season?.closed_date) {
            const st = bedSeasonStatus(bed.region, season);
            return { key: "closed", chip: fillCopy("bsClosedChip", { year: season.id }), line: st.carried ? fillCopy("ocOverwintering", { n: st.carried }) : copy.bsDormantSeason };
        }
        const live = (season?.plantings ?? []).filter((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
        const planted = live.filter(inGround);
        const draft = (Array.isArray(season?.plan) ? season.plan : [])
            .find((e) => e.area === bed.name);
        const myDraft = draft?.mybed === true && Array.isArray(draft.plantings) ? draft.plantings.length : 0;
        if (draft?.guild && planted.length > 0) {
            const team = teamLabel(draft.guild) ?? nameAsLabel(humanize(draft.guild));
            return { key: "planned", chip: copy.bsPlannedChip, line: fillCopy("bsTeamPartly", { team, n: planted.length }), guild: draft.guild };
        }
        if (myDraft && planted.length > 0) {
            return { key: "planned", chip: copy.bsPlannedChip, line: fillCopy("bsOwnPartly", { n: planted.length }), mybed: true };
        }
        if (live.length > 0 && !draft?.guild && !myDraft) {
            const st = bedSeasonStatus(bed.region, season);
            return { key: "planted", chip: copy.bsPlantedChip, line: st.growing + st.planned + st.carried + st.ended === 0 ? copy.bsInGround : st.label };
        }
        if (draft?.guild) {
            const team = teamLabel(draft.guild) ?? nameAsLabel(humanize(draft.guild));
            return { key: "planned", chip: copy.bsPlannedChip, line: fillCopy("bsTeamDraft", { team }), guild: draft.guild };
        }
        if (myDraft) {
            return { key: "planned", chip: copy.bsPlannedChip, line: myDraft === 1 ? copy.bsOwnDraftOne : fillCopy("bsOwnDraftMany", { n: myDraft }), mybed: true };
        }
        return bare;
    }
    catch {
        return bare;
    }
}

export { allPots, bedState, composePlot, tierLine, tierWords };
