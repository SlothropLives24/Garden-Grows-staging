// Open bed (Phase F / F3, D-053) - line-for-line port of engine/open_bed.py, same operation order
// so the openbed conformance golden matches exactly. DOM-free.
//
// A named guild is a curated team the corpus vouches for; an OPEN BED is whatever the user
// composes. openBed() runs the corpus over that arbitrary member set and returns:
//   - members     each member's site eligibility (rotation/window/sun/zone), via the shared
//                 compiler.ineligibility - the flagged per-plant conflicts
//   - placement   the GRADED layout via place() (D-081) - height tiers, tall poleward, filling the
//                 bed; the configurable "My bed" seed, matching what its Optimize lays out
//   - footprint   summed footprint vs the bed using the circle model R-002 uses
//   - flags       the bed-level rules the composition trips: R-002 (footprint over bed) and R-040
//                 (a strong-support member with no provider in the set; corn's weak living support
//                 counts). {rule, subject} only - no float-in-string, so no format-matching hazard.
//   - suggestions complete-a-guild advice grounded ONLY in curated guild fillers (NOT predicates,
//                 which are loose and match nonsense - corn "filling" the fruit-tree canopy).
//
// The broader per-subject species rules (heat, pollination, neighbour pairs, juglone) need a full
// dispatch port to TS and are a deliberate follow-up (D-053).
import { candidates, ineligibility, resolveRole, resolveSpecies } from "./compiler.js";
import { accessBands, place } from "./place.js";
import { regionPoints } from "./regions.js";
import { BLOOM_ORDER, bloomSpan, forageInFlower, needsInsects } from "./forage.js";
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
// Does this member give a climbing vine something to climb? Corn's `provides: weak` living support
// counts (the three-sisters mechanism), so a corn+bean bed silences R-040 while a lone vine flags.
function providesSupport(resolved) {
    const p = resolved.support?.provides;
    return p === "strong" || p === "weak";
}
// The five-value support vocabulary, ordered. O80a (maintainer 2026-08-13, advise-until-resolved):
// ADVICE reads the STRONGEST requirement across a species' cultivar groups - a bare tomato may be
// an indeterminate, a bare bean may be a pole, so the suggestion speaks up - while the fatal R-040
// BLOCK keeps firing only on the RESOLVED record (a block on a guess is wrong; a determinate
// tomato needs a short cage, not a trellis). Composer and open-bed share this rule.
const SUPPORT_ORDER = ["none", "weak", "moderate", "optional_strong", "strong"];
/** The strongest support.requires across the RAW species record and every cultivar group. */
export function strongestSupportRequirement(rec) {
    const req = (r) => (r?.support?.requires) ?? "none";
    const vals = [req(rec)];
    const cgs = rec.cultivar_groups;
    for (const cg of Array.isArray(cgs) ? cgs : Object.values(cgs ?? {}))
        vals.push(req(cg));
    return vals.reduce((a, b) => (SUPPORT_ORDER.indexOf(b) > SUPPORT_ORDER.indexOf(a) ? b : a), "none");
}
// A filler's ground footprint in m² - the CIRCLE of diameter = mature_spread_cm, the model R-002
// tests (dispatch.py _footprint_m2). null when the species carries no spread.
export function circleFootprintM2(resolved) {
    const s = last(resolved.mature_spread_cm);
    if (s === null)
        return null;
    return Math.PI * (s / 100 / 2) ** 2;
}
// A woody tree - the centre of a rings (food-forest) arrangement.
function isTree(resolved) {
    return resolved.habit === "tree";
}
// A member that belongs ON a living support, exactly as the Three Sisters FIXER role defines it
// ({n_fixing: true, habit: vine, support.requires: strong}) - a bean-type twiner, NOT a staked tomato
// (which also requires strong support, but from a stake). So hills keys off the corpus's own predicate.
function livingClimber(resolved) {
    const req = resolved.support?.requires;
    return Boolean(resolved.n_fixing) && resolved.habit === "vine" && req === "strong";
}
// D-076 slice 2: which of the other guilds' layout patterns best fits this free-form set, from the
// members' own predicates (never name-matching), conservative - only claims a named geometry when its
// defining relationship is present. rings: a tree is in the bed. hills: a living support AND a
// bean-type living climber are both present. grid: anything else (banding/tiling). A LAYOUT the
// optimiser proposes, not a claim the set IS a named guild (D-076).
export function bedArchetype(members, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    if (subjects.some((s) => isTree(s.resolved)))
        return "rings";
    // hills is the LIVING-support geometry (beans share the corn's mound). A trellis satisfies the
    // support NEED (R-040) but plants a plain row at its foot - the small-bed sisters precedent
    // (guilds.ts) - so a structure member must not flip the bed to mounds (O80a).
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
// The bed area actually available to PLANTS: the bed, less the access lanes its structure reserves
// (D-141 / R-098). O30 - before this, capacity counted the walkway as plantable ground, so a 2x2 m
// raised bed (which keeps only 1.5 x 2 m after its 0.5 m path) was trimmed against the full 4 m2 and
// the survivors were packed with their canopies brushing. Geometry was already honest (O26).
//
// Returns null when the bed area is unknown, so callers keep their existing not-applicable path.
//
// The reservation rule MIRRORS place()'s own: `rings` lays out into a radial region and reserves
// nothing; `hills` on anything but a FIELD reserves nothing either (you walk between the mounds -
// D-142); everything else lays out graded and gets whatever accessBands reserves, which is already
// empty for a bed within reach, a container, or a non-rectangular shape. Port of open_bed.py.
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
    // A path can never eat the whole bed (it is reserved BETWEEN planting strips), but a degenerate
    // region should still leave something to fit against rather than going non-positive.
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
    // O80a: structures are lines on the edge (structureLine), never discs in the packing.
    const subjects = allSubjects.filter((s) => s.resolved.entity_class !== "structure");
    const region = bedRegion(site);
    const lat = site.lat;
    // One plant is a placeable bed too (round 20): it fills the bed as a single band. Only bail when
    // there is genuinely nothing to place - no geometry, no latitude, or zero members. (< 2 used to
    // suppress the single-plant case, which hid the whole canvas + save affordance for one plant.)
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
    // GRADED (D-081): height tiers, tall poleward, filling the bed - the My-bed seed must match what
    // Optimize lays out. The old default `rows` banded single-count species into thin poleward strips
    // that all snapped to the top of the canvas (the reported bunching).
    return place(plants, region, lat, threshold, "graded", 0, true, site.occupied ?? [], site.structure, site.lane_flip ?? false);
}
// `capacity` is the PLANTABLE area (O30): the fit is judged against the ground plants can actually
// stand on, not the walkway, and both figures are reported so the DOM can say either. This has to
// move in step with optimizeBed's trim - R-002 fires on fits === false, and a flag saying "it fits"
// while the trim was cutting plants is the one disagreement these two are written to avoid.
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
    // Count-driven viability (D-054): too few of a crop that needs a crowd sets poor or no fruit.
    for (const s of subjects) {
        const poll = s.resolved.pollination ?? {};
        if (poll.block_min_plants != null && s.count < poll.block_min_plants) {
            out.push({ rule: "R-001", subject: s.sid, have: s.count, need: poll.block_min_plants });
        }
        else if (poll.self_incompatible) {
            const need = poll.min_plants ?? 2;
            if (s.count < need)
                out.push({ rule: "R-080", subject: s.sid, have: s.count, need });
        }
    }
    // R-102: an insect-pollinated member needs a vector, and nothing ELSE in this bed is in flower
    // while it is. Carries no prose - the DOM composes the sentence - and carries the crop's own
    // window so a surface can say WHEN without recomputing it.
    //
    // NOT A DIAGNOSIS, AND NO CALLER MAY RENDER IT AS ONE. The condition is weaker than R-102's
    // claim: bees arrive from outside the bed, so an empty forage list is a fact about this plant
    // list and nothing more (the rule's trigger_note; severity `suboptimal` -> `advise`).
    //
    // A crop with NO bloom_window is skipped rather than flagged: "we cannot say when this flowers"
    // is not "nothing is in flower then", and only the second is worth telling someone.
    for (const s of subjects) {
        const span = bloomSpan(s.resolved);
        if (!needsInsects(s.resolved) || span === null)
            continue;
        const others = subjects.filter((x) => x.sid !== s.sid).map((x) => x.sid);
        if (forageInFlower(span, others, bundle).length === 0) {
            out.push({ rule: "R-102", subject: s.sid, bloom: [BLOOM_ORDER[span[0]], BLOOM_ORDER[span[1]]] });
        }
    }
    // R-107: a container's water behaviour belongs to the VESSEL, so this is emitted once for the bed
    // and carries NO subject - unlike every other flag here, which names a plant. A caller that
    // renders flags per-plant must not attach this one to whichever plant happens to be first.
    //
    // It fires on an EMPTY container too, deliberately: someone planning a pot should be told what a
    // pot costs in attention BEFORE choosing what to put in it.
    if (site.structure === "container")
        out.push({ rule: "R-107", subject: null });
    return out;
}
// Only the role's OWN curated fillers count - NOT a predicate match (the loose role predicates
// match nonsense; curation is the truth, D-006 / compiler.py:29).
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
// The fewest of this species a viable planting keeps - corn's wind-pollination block (R-001) and a
// self-incompatible crop's partner minimum (R-080); otherwise one. The trim never thins below this.
export function viabilityFloor(resolved) {
    const poll = resolved.pollination ?? {};
    if (poll.block_min_plants != null)
        return poll.block_min_plants;
    if (poll.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
// Slice 1 of the open-bed optimiser (D-076): trim an overcrowded free-form bed so its summed
// footprint fits, without changing the geometry the user drew (slice 2). Policy (maintainer): thin
// counts first - biggest space-taker down toward its viability floor, one plant at a time - then, if
// still over, drop whole species (largest single-plant footprint first, never emptying the bed), then
// restore plants to survivors so no one is thinned harder than the final fit needs. All control-flow
// comparisons run on RAW doubles (bit-identical to the Python oracle); only the reported figures round.
export function optimizeBed(members, site, bundle) {
    const subjects = (members ?? []).map((m) => memberSubject(m, bundle));
    const rawBed = site.bed_m2 ?? null;
    // O30: fit to the PLANTABLE ground, not the bed's outline. See plantableM2 - a bed past reach
    // loses reserved paths, and counting them as growable under-trimmed every pathed bed.
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
const MOUND_CAP = { provider: 4, climber: 3 }; // a thinned hill (D-065): ~4 on the support, ~3 climbers
// WHERE a support structure goes (O80b, maintainer 2026-08-13: the poleward-edge LINE). A trellis
// is a line, not a disc - it holds no interior ground, and it casts shade, so it takes the same
// treatment the R-003 banding gives a tall plant: the POLEWARD edge, where its shadow falls out of
// the bed. Length is sized to the climbers it serves (count x in-row spacing each), capped at the
// bed's edge. [] when no structure member is present (callers emit nothing - goldens byte-stable).
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
// The re-distributed layout the optimiser proposes (D-076 slice 2): lay the set out in the archetype
// bedArchetype picks, reusing the SAME place() geometry the named guilds use. hills flags the living
// support + bean-type climber as `mound`; rings centres a radial_rings region in the bed (radius fit
// to it, height fallback so the tree centres); grid is the banding/tiling motif. placement is null
// when there is nothing to arrange (no geometry, no latitude, or zero members). A SINGLE species
// with multiples still arranges (round 21) - its copies distribute across the bed as one grid.
export function optimizedPlacement(members, site, bundle) {
    // O80b: a structure member is a LINE on the poleward edge (structureLine), never a disc in the
    // packing - split it out before the plant geometry, and carry the line on the result
    // (`structures`, only when present, so structure-free goldens stay byte-stable).
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
    // The configurable "My bed" optimiser lays the set out GRADED (D-081): height tiers, tall poleward
    // (R-003), each tier interplanted at its own mature spacing, filling the bed - the "here's how to
    // plant what you picked" recommendation. Not the named-guild interplant grid (which bands the
    // tallest into one poleward row). Named guilds keep "grid". Mirrors open_bed.py.
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
