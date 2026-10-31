import { regionPoints, resolveSpecies, accessBands, resolveRole, bloomSpan, needsInsects, forageInFlower, BLOOM_ORDER, smallSeededDirectSown, place, ineligibility, candidates, monthLong, waterMonthsFor, fmtRain, fmtTemp, warmMonthList } from './core.js';
import './chunk-lutet8cz.js';
import { fillCopy, appLang, copy } from './paint.js';

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
function strongestSupportRequirement(rec) {
    const req = (r) => (r?.support?.requires) ?? "none";
    const vals = [req(rec)];
    const cgs = rec.cultivar_groups;
    for (const cg of Array.isArray(cgs) ? cgs : Object.values(cgs ?? {}))
        vals.push(req(cg));
    return vals.reduce((a, b) => (SUPPORT_ORDER.indexOf(b) > SUPPORT_ORDER.indexOf(a) ? b : a), "none");
}
function circleFootprintM2(resolved) {
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
function bedArchetype(members, bundle) {
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
function plantableM2(members, site, bundle) {
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
function blockRows(s, site) {
    const bySquare = Math.floor(Math.sqrt(Math.max(0, s.count)) + 1e-9);
    const region = bedRegion(site);
    if (!region)
        return bySquare;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const narrowM = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const minOf = (v) => {
        const x = Array.isArray(v) ? Math.min(...v.map(Number)) : v == null ? null : Number(v);
        return x != null && Number.isFinite(x) && x > 0 ? x : null;
    };
    const rowCm = minOf(s.resolved.spacing_between_row_cm) ?? minOf(s.resolved.spacing_in_row_cm);
    if (rowCm == null)
        return bySquare;
    return Math.min(bySquare, 1 + Math.floor(narrowM / (rowCm / 100) + 1e-9));
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
        if (poll.block_min_rows != null) {
            const rows = blockRows(s, site);
            if (rows < poll.block_min_rows)
                out.push({ rule: "R-001", subject: s.sid, have: rows, need: poll.block_min_rows });
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
    if (site.rain === "covered" || site.rain === "indoors")
        out.push({ rule: "R-173", subject: null, rain: site.rain });
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
function virusNeighbours(members, siblings, bundle) {
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
function viabilityFloor(resolved) {
    const poll = resolved.pollination ?? {};
    if (poll.block_min_plants != null)
        return poll.block_min_plants;
    if (poll.dioecious)
        return 2;
    if (poll.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
function optimizeBed(members, site, bundle) {
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
function structureLine(members, site, bundle) {
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
function optimizedPlacement(members, site, bundle) {
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
function openBed(members, site, bundle) {
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

function monthsPhrase(months) {
    const set = new Set(months);
    const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1));
    const run = [];
    for (let m = start ?? months[0], i = 0; i < 12 && set.has(m); i++, m = m === 12 ? 1 : m + 1)
        run.push(m);
    if (run.length === months.length && run.length > 1 && run.length < 12) {
        return fillCopy("plMonthSpan", { from: monthLong(run[0] - 1), to: monthLong(run[run.length - 1] - 1) });
    }
    const words = months.map((m) => monthLong(m - 1));
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(words);
    }
    catch {
        return words.join(", ");
    }
}
function boltRun(months) {
    const set = new Set(months);
    const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1));
    if (start == null)
        return null;
    const run = [];
    for (let m = start, i = 0; i < 12 && set.has(m); i++, m = m === 12 ? 1 : m + 1)
        run.push(m);
    return run.length === months.length ? [run[0], run[run.length - 1]] : null;
}
const MONTH_LAST = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function seasonMonths(lastFrost, firstFreeze, rare) {
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    if (rare || !lastFrost)
        return all;
    const spans = !firstFreeze || lastFrost <= firstFreeze
        ? [[lastFrost, firstFreeze ?? "12-31"]] : [["01-01", firstFreeze], [lastFrost, "12-31"]];
    const out = new Set();
    for (let m = 1; m <= 12; m++) {
        const a = `${String(m).padStart(2, "0")}-01`, b = `${String(m).padStart(2, "0")}-${MONTH_LAST[m - 1]}`;
        if (spans.some(([s, e]) => s <= b && e >= a))
            out.add(m);
    }
    return out;
}
function waterLines(site, bundle, season, roofed = false, indoors = false) {
    if (!site)
        return { hot: null, dry: null };
    const w = waterMonthsFor(site, bundle);
    const trig = (id) => (bundle.rules ?? []).find((r) => r.id === id)?.trigger ?? {};
    const t175 = trig("R-175"), week = trig("R-174").week_need_mm;
    const hot = w.hot.filter((m) => season.has(m));
    const dry = w.dry.filter((m) => season.has(m));
    const fc = (f) => fmtTemp((f - 32) * 5 / 9);
    return {
        hot: !indoors && hot.length && typeof t175.day_above_f === "number" && typeof t175.night_above_f === "number"
            ? fillCopy(hot.length === 12 ? "plWaterHotAllYear" : hot.length === 1 ? "plWaterHotOne" : "plWaterHot", { months: monthsPhrase(hot), day: fc(t175.day_above_f), night: fc(t175.night_above_f) }) : null,
        dry: !roofed && dry.length && typeof week === "number"
            ? fillCopy(dry.length === 12 ? "plWaterDryAllYear" : dry.length === 1 ? "plWaterDryOne" : "plWaterDry", { months: monthsPhrase(dry), week: fmtRain(week) }) : null,
    };
}

const ONION_TYPE = { short_day: "ghDayShort", long_day: "ghDayLong", either: "ghDayEither" };
function reasonLine(r, zoneLabel) {
    switch (r.kind) {
        case "zone_warm": return fillCopy("ghWhyZoneWarm", { zone: zoneLabel ?? r.zone });
        case "zone_cold": return fillCopy("ghWhyZoneCold", { zone: zoneLabel ?? r.zone });
        case "zone_unknown": return copy.ghWhyZoneUnknown;
        case "season_short": return fillCopy("ghWhySeason", { window: r.frost_free_days });
        case "season_unknown": return copy.ghWhySeasonUnknown;
        case "hardy_short": return fillCopy("ghWhyHardyShort", { window: r.season_days });
        case "bolt": return fillCopy("ghWhyBolt", { months: monthsPhrase(r.months) });
        case "hot_harvest": return fillCopy("ghWhyHot", { months: monthsPhrase(r.months) });
        case "night_heat": return copy.ghWhyNight;
        case "daylength": return copy[ONION_TYPE[r.type]];
        case "warm_short": return copy.ghWhyWarmShort;
        case "warm_none": return copy.ghWhyWarmNone;
        case "warm_care": return fillCopy("ghWhyWarmCare", { months: monthsPhrase(r.months) });
        case "slow_months": return fillCopy("ghWhySlow", { months: monthsPhrase(r.months) });
        case "warm_held": return copy.ghWhyWarmHeld;
        case "slow_held": return copy.ghWhySlowHeld;
        case "floor_none": return fillCopy("ghWhyFloorNone", { temp: fmtTemp(r.floor_c) });
        case "floor_few": return fillCopy("ghWhyFloorFew", { temp: fmtTemp(r.floor_c), months: warmMonthList(r.months), n: r.need });
    }
}

export { bedArchetype, boltRun, circleFootprintM2, monthsPhrase, openBed, optimizeBed, optimizedPlacement, plantableM2, reasonLine, seasonMonths, strongestSupportRequirement, structureLine, viabilityFloor, virusNeighbours, waterLines };
