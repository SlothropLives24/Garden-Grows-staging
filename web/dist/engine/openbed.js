import { candidates, ineligibility, resolveRole, resolveSpecies } from "./compiler.js";
import { accessBands, place } from "./place.js";
import { regionPoints } from "./regions.js";
import { BLOOM_ORDER, bloomSpan, forageInFlower, needsInsects } from "./forage.js";
import { smallSeededDirectSown } from "./compiler.js";
const round4 = (x) => Math.round(x * 1e4) / 1e4;
function last(v) {
    if (Array.isArray(v))
        return v.length ? Number(v[v.length - 1]) : null;
    if (v == null)
        return null;
    return Number(v);
}
function memberSubject(m, bundle) {
    const sid = m.species;
    const group = m.group ?? null;
    const count = m.count ?? 1;
    return { sid, group, count, resolved: resolveSpecies(sid, group, bundle) };
}
function providesSupport(resolved) {
    const p = resolved.support?.provides;
    return p === "strong" || p === "weak";
}
const SUPPORT_ORDER = ["none", "weak", "moderate", "optional_strong", "strong"];
export function strongestSupportRequirement(rec) {
    const req = (r) => (r?.support?.requires) ?? "none";
    const vals = [req(rec)];
    const cgs = rec.cultivar_groups;
    for (const cg of Array.isArray(cgs) ? cgs : Object.values(cgs ?? {}))
        vals.push(req(cg));
    return vals.reduce((a, b) => (SUPPORT_ORDER.indexOf(b) > SUPPORT_ORDER.indexOf(a) ? b : a), "none");
}
export function circleFootprintM2(resolved) {
    const s = last(resolved.mature_spread_cm);
    if (s === null)
        return null;
    return Math.PI * (s / 100 / 2) ** 2;
}
function isTree(resolved) {
    return resolved.habit === "tree";
}
function livingClimber(resolved) {
    const req = resolved.support?.requires;
    return Boolean(resolved.n_fixing) && resolved.habit === "vine" && req === "strong";
}
export function bedArchetype(members, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    if (subjects.some((s) => isTree(s.resolved)))
        return "rings";
    const provider = subjects.some((s) => providesSupport(s.resolved) && s.resolved.entity_class === undefined);
    const climber = subjects.some((s) => livingClimber(s.resolved));
    if (provider && climber)
        return "hills";
    return "grid";
}
function bedRegion(site) {
    if (site.region)
        return site.region;
    const area = site.bed_m2;
    if (typeof area === "number" && area > 0) {
        const s = Math.sqrt(area);
        return { shape: "rect", x: 0, y: 0, w: s, h: s };
    }
    return null;
}
export function plantableM2(members, site, bundle) {
    const bed = site.bed_m2;
    if (typeof bed !== "number" || !(bed > 0))
        return null;
    const region = bedRegion(site);
    if (region === null)
        return bed;
    const arch = bedArchetype(members, bundle);
    const structure = site.structure;
    if (arch === "rings" || (arch === "hills" && structure !== "field"))
        return bed;
    const bands = structure ? accessBands(structure, region, site.lane_flip ?? false) : [];
    if (bands.length === 0)
        return bed;
    const lanes = bands.reduce((t, b) => t + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    return Math.max(0.1, bed - lanes);
}
function memberReport(s, site, bundle) {
    const blockers = ineligibility(s.resolved, {}, site, bundle);
    return {
        species: s.sid, group: s.group, count: s.count,
        family: s.resolved.family ?? null,
        height_cm: last(s.resolved.mature_height_cm),
        spread_cm: last(s.resolved.mature_spread_cm),
        eligible: blockers.length === 0, blockers,
    };
}
function placement(allSubjects, site, bundle) {
    const subjects = allSubjects.filter((s) => s.resolved.entity_class !== "structure");
    const region = bedRegion(site);
    const lat = site.lat;
    if (region === null || lat == null || subjects.length < 1)
        return null;
    const r003 = bundle.rules.find((x) => x.id === "R-003");
    const threshold = r003?.trigger?.threshold_cm ?? 120;
    const plants = subjects.map((s) => ({
        id: s.sid,
        height_cm: last(s.resolved.mature_height_cm) ?? 0,
        spread_cm: last(s.resolved.mature_spread_cm) ?? undefined,
        count: s.count,
    }));
    return place(plants, region, lat, threshold, "graded", 0, true, site.occupied ?? [], site.structure, site.lane_flip ?? false);
}
function footprint(subjects, site, capacity = null) {
    let total = 0;
    for (const s of subjects) {
        const f = circleFootprintM2(s.resolved);
        if (f)
            total += f * s.count;
    }
    total = round4(total);
    const bed = site.bed_m2 ?? null;
    const fitTo = capacity !== null ? capacity : bed;
    return { total_m2: total, bed_m2: bed,
        plantable_m2: fitTo === null ? null : round4(fitTo),
        fits: fitTo === null ? null : total <= fitTo };
}
function flags(subjects, fp, site, bundle) {
    const out = [];
    if (fp.fits === false)
        out.push({ rule: "R-002", subject: subjects.map((s) => s.sid) });
    if (!subjects.some((s) => providesSupport(s.resolved))) {
        for (const s of subjects) {
            const req = s.resolved.support?.requires;
            if (req === "strong")
                out.push({ rule: "R-040", subject: s.sid });
        }
    }
    for (const s of subjects) {
        const poll = s.resolved.pollination ?? {};
        if (poll.block_min_plants != null && s.count < poll.block_min_plants) {
            out.push({ rule: "R-001", subject: s.sid, have: s.count, need: poll.block_min_plants });
        }
        else if (poll.dioecious) {
            if (s.count < 2)
                out.push({ rule: "R-140", subject: s.sid, have: s.count, need: 2 });
        }
        else if (poll.self_incompatible) {
            const need = poll.min_plants ?? 2;
            if (s.count < need)
                out.push({ rule: "R-080", subject: s.sid, have: s.count, need });
        }
    }
    for (const s of subjects) {
        const span = bloomSpan(s.resolved);
        if (!needsInsects(s.resolved) || span === null)
            continue;
        const others = subjects.filter((x) => x.sid !== s.sid).map((x) => x.sid);
        if (forageInFlower(span, others, bundle).length === 0) {
            out.push({ rule: "R-102", subject: s.sid, bloom: [BLOOM_ORDER[span[0]], BLOOM_ORDER[span[1]]] });
        }
    }
    if (site.structure === "container")
        out.push({ rule: "R-107", subject: null });
    const low = subjects.filter((s) => s.resolved.water_need === "low").map((s) => s.sid).sort();
    const steady = subjects.filter((s) => s.resolved.water_need === "steady").map((s) => s.sid).sort();
    if (low.length && steady.length)
        out.push({ rule: "R-142", subject: null, low, steady });
    const residue = site.allelopathic_residue ?? [];
    const small = subjects.filter((s) => smallSeededDirectSown(s.resolved)).map((s) => s.sid).sort();
    if (residue.length && small.length) {
        out.push({ rule: "R-144", subject: null, small,
            residue: residue.map((r) => ({ species: r.species, lead_days: r.lead_days })) });
    }
    const last = site.last_season_species ?? [];
    if (last.length) {
        for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
            const t = (r.trigger ?? {});
            if (t.kind !== "prior_season_host" || !t.host || !last.includes(t.host))
                continue;
            const hit = subjects.filter((s) => Array.isArray(s.resolved.pathogens) && s.resolved.pathogens.includes(t.pathogen ?? ""))
                .map((s) => s.sid).sort();
            if (hit.length)
                out.push({ rule: r.id, subject: null, host: t.host, hosts: hit });
        }
    }
    for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        const t = (r.trigger ?? {});
        if (t.kind !== "cultivar_group_isolation" || !t.species)
            continue;
        const groups = [...new Set(subjects
                .filter((s) => s.sid === t.species && typeof s.resolved.cultivar_group === "string")
                .map((s) => String(s.resolved.cultivar_group)))].sort();
        if (groups.length >= 2)
            out.push({ rule: r.id, subject: null, species: t.species, groups });
    }
    for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        const t = (r.trigger ?? {});
        if (t.kind !== "shared_virus_isolation")
            continue;
        const listed = new Set(t.species ?? []);
        const present = [...new Set(subjects.filter((s) => listed.has(s.sid)).map((s) => s.sid))].sort();
        if (present.length >= 2)
            out.push({ rule: r.id, subject: null, species: present });
    }
    return out;
}
export function virusNeighbours(members, siblings, bundle) {
    const mineAll = new Set(members.map((m) => m.species));
    const out = [];
    for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        const t = (r.trigger ?? {});
        if (t.kind !== "shared_virus_isolation")
            continue;
        const listed = new Set(t.species ?? []);
        const mine = [...mineAll].filter((s) => listed.has(s)).sort();
        if (!mine.length)
            continue;
        const withs = [];
        for (const sib of siblings) {
            const theirs = [...new Set((sib.species ?? []).filter((s) => listed.has(s)))].sort();
            if (theirs.length)
                withs.push({ bed: sib.name, species: theirs });
        }
        if (withs.length)
            out.push({ rule: r.id, species: mine, with: withs });
    }
    return out;
}
function fillsRole(sid, role) {
    return candidates(role).some(([candSid]) => candSid === sid);
}
function suggestions(subjects, site, bundle, limit = 2) {
    const out = [];
    const guilds = [...bundle.guilds].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const guild of guilds) {
        if (guild.derived_from || !(guild.roles && guild.roles.length))
            continue;
        const filled = [];
        const missing = [];
        for (const role of guild.roles) {
            if (subjects.some((s) => fillsRole(s.sid, role)))
                filled.push(role.id);
            else if (!role.optional)
                missing.push(role);
        }
        if (filled.length >= 2 && missing.length) {
            const missOut = missing.map((role) => {
                const rr = resolveRole(role, site, bundle);
                return {
                    role: role.id,
                    canonical: role.canonical ?? null,
                    fillers: rr.options.filter((o) => o.eligible).map((o) => o.filler),
                };
            });
            out.push({ guild: guild.id, filled_roles: filled, missing_roles: missOut });
        }
    }
    out.sort((a, b) => b.filled_roles.length - a.filled_roles.length
        || a.missing_roles.length - b.missing_roles.length
        || (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0));
    return out.slice(0, limit);
}
export function viabilityFloor(resolved) {
    const poll = resolved.pollination ?? {};
    if (poll.block_min_plants != null)
        return poll.block_min_plants;
    if (poll.dioecious)
        return 2;
    if (poll.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
export function optimizeBed(members, site, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    const rawBed = site.bed_m2 ?? null;
    const bed = plantableM2(members, site, bundle);
    const applicable = bed !== null;
    const work = subjects.map((s) => ({
        sid: s.sid, group: s.group, orig: s.count, count: s.count,
        f: circleFootprintM2(s.resolved) ?? 0, floor: viabilityFloor(s.resolved),
    }));
    const rawTotal = () => work.reduce((t, w) => t + w.f * w.count, 0);
    const before = rawTotal();
    if (!applicable || before <= bed) {
        return {
            applicable, overcrowded: false, bed_m2: applicable ? rawBed : null,
            plantable_m2: applicable ? round4(bed) : null,
            before_m2: round4(before), after_m2: round4(before),
            fits: applicable ? before <= bed : null, actions: [],
            members: work.map((w) => ({ species: w.sid, group: w.group, count: w.count })),
        };
    }
    const B = bed;
    let guard = work.reduce((t, w) => t + w.count, 0) + 1;
    while (rawTotal() > B && guard > 0) {
        guard -= 1;
        const cands = work.filter((w) => w.count > w.floor && w.f > 0);
        if (!cands.length)
            break;
        cands.sort((a, c) => (c.f * c.count - a.f * a.count) || (c.f - a.f) || (a.sid < c.sid ? -1 : 1));
        cands[0].count -= 1;
    }
    while (rawTotal() > B && work.filter((w) => w.count > 0).length > 1) {
        const cands = work.filter((w) => w.count > 0 && w.f > 0);
        if (!cands.length)
            break;
        cands.sort((a, c) => (c.f - a.f) || (a.sid < c.sid ? -1 : 1));
        cands[0].count = 0;
    }
    guard = work.reduce((t, w) => t + w.orig, 0) + 1;
    while (guard > 0) {
        guard -= 1;
        const room = B - rawTotal();
        const cands = work.filter((w) => w.count > 0 && w.count < w.orig && w.f <= room);
        if (!cands.length)
            break;
        cands.sort((a, c) => (a.count / a.orig - c.count / c.orig) || (a.f - c.f) || (a.sid < c.sid ? -1 : 1));
        cands[0].count += 1;
    }
    const after = rawTotal();
    const actions = [];
    for (const w of work) {
        if (w.count === 0 && w.orig > 0)
            actions.push({ kind: "drop", species: w.sid, group: w.group, was: w.orig });
        else if (w.count < w.orig)
            actions.push({ kind: "thin", species: w.sid, group: w.group, from: w.orig, to: w.count });
    }
    return {
        applicable: true, overcrowded: true, bed_m2: rawBed,
        plantable_m2: round4(B),
        before_m2: round4(before), after_m2: round4(after), fits: after <= B, actions,
        members: work.filter((w) => w.count > 0).map((w) => ({ species: w.sid, group: w.group, count: w.count })),
    };
}
const MOUND_CAP = { provider: 4, climber: 3 };
export function structureLine(members, site, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    const structs = subjects.filter((s) => s.resolved.entity_class === "structure");
    if (!structs.length)
        return [];
    const region = bedRegion(site);
    const lat = site.lat;
    const edge = lat != null && lat < 0 ? "south" : "north";
    let edgeLen = null;
    if (region !== null) {
        const pts = regionPoints(region);
        if (pts.length) {
            const xs = pts.map((p) => p[0]);
            edgeLen = Math.max(...xs) - Math.min(...xs);
        }
    }
    const climbers = subjects.filter((s) => {
        const req = s.resolved.support?.requires;
        return (req === "strong" || req === "optional_strong") && s.resolved.entity_class === undefined;
    });
    const needM = climbers.reduce((acc, s) => acc + s.count * ((s.resolved.spacing_in_row_cm ?? 30) / 100), 0);
    return structs.map((s) => {
        let length = needM ? Math.max(0.6, needM) : 0.6;
        if (edgeLen !== null)
            length = Math.min(length, edgeLen);
        return { id: s.sid, edge, length_m: Math.round(length * 100) / 100,
            for: climbers.map((c) => c.sid).sort() };
    });
}
export function optimizedPlacement(members, site, bundle) {
    const allSubjects = (members ?? []).map((m) => memberSubject(m, bundle));
    const subjects = allSubjects.filter((s) => s.resolved.entity_class !== "structure");
    const lines = structureLine(members, site, bundle);
    const withLines = (r) => (lines.length ? { ...r, structures: lines } : r);
    const archetype = bedArchetype(members, bundle);
    const region = bedRegion(site);
    const lat = site.lat;
    if (region === null || lat == null || subjects.length < 1)
        return withLines({ archetype, placement: null });
    const r003 = bundle.rules.find((x) => x.id === "R-003");
    const threshold = r003?.trigger?.threshold_cm ?? 120;
    const base = (s) => ({
        id: s.sid,
        height_cm: last(s.resolved.mature_height_cm) ?? 0,
        spread_cm: last(s.resolved.mature_spread_cm) ?? undefined,
        count: s.count,
    });
    if (archetype === "rings") {
        const pts = regionPoints(region);
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const R = 0.45 * Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        const rr = { shape: "radial_rings", cx, cy, r: R };
        return withLines({ archetype, placement: place(subjects.map(base), rr, lat, threshold, "rows", 0, true, site.occupied ?? [], site.structure) });
    }
    if (archetype === "hills") {
        const plants = subjects.map((s) => {
            const b = base(s);
            if (providesSupport(s.resolved)) {
                b.mound = true;
                b.mound_cap = MOUND_CAP.provider;
            }
            else if (livingClimber(s.resolved)) {
                b.mound = true;
                b.mound_cap = MOUND_CAP.climber;
            }
            return b;
        });
        return withLines({ archetype, placement: place(plants, region, lat, threshold, "hills", 0, true, site.occupied ?? [], site.structure) });
    }
    return withLines({ archetype, placement: place(subjects.map(base), region, lat, threshold, "graded", 0, true, site.occupied ?? [], site.structure) });
}
export function openBed(members, site, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    const fp = footprint(subjects, site, plantableM2(members, site, bundle));
    return {
        members: subjects.map((s) => memberReport(s, site, bundle)),
        placement: placement(subjects, site, bundle),
        footprint: fp,
        flags: flags(subjects, fp, site, bundle),
        suggestions: suggestions(subjects, site, bundle),
    };
}
