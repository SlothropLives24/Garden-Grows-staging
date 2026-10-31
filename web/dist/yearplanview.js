import './chunk-lutet8cz.js';
import { bedHasSections, familyRotationRule, gardenFrost, comingSeasonTasks, fallDate, windowFreeze, seasonDate, heldRotationFamilies, thinBreakSuggestion, priorSeasonCredit, mergePriorOccupancy, deriveHistory, addDaysISO, plantingWindow, plantingLabel, resolveFrostTolerance, groupAgenda, resolveSpecies, isSouthern, seasonName, currentGardenCtx, app, el, toast, monthShort, commonName, displayName, householdChoice, mark, monthDay, taskSentence, markLink, unitSystem } from './core.js';
import { copy, fillCopy, familyName, midSentence, familyInProse } from './paint.js';
import { householdCount, householdWho, householdLine } from './chunk-cph1bzsd.js';
import { nextSeasonPlan } from './chunk-jkf3oq22.js';
import { calendarSowings } from './chunk-huzqyx5l.js';
import './chunk-l5cseoso.js';
import './chunk-iac2um9b.js';
import './chunk-dpsx67rd.js';

const PLAN_YEARS = 3;
function teamPlants(g) {
    const out = [];
    const add = (sid, group) => {
        if (typeof sid !== "string" || out.some((p) => p.sid === sid))
            return;
        out.push({ sid, group: typeof group === "string" ? group : null });
    };
    for (const r of (g.roles ?? []))
        add(r.canonical, r.canonical_group);
    for (const m of g.members ?? [])
        add(m.species, m.group);
    return out;
}
const familiesOf = (g, bundle) => {
    const fam = new Map(bundle.species.map((s) => [s.id, s.family]));
    return new Set(g ? teamPlants(g).map((p) => fam.get(p.sid)).filter((f) => !!f) : []);
};
function slotOf(date, seasonYear, lat) {
    const name = seasonName(Number(date.slice(5, 7)), lat);
    if (name !== "winter")
        return name;
    const tail = isSouthern(lat) ? `${seasonYear + 1}-03` : `${seasonYear}-07`;
    return date >= tail ? "winter_end" : "winter";
}
const SLOTS = ["winter", "spring", "summer", "autumn", "winter_end"];
function bySeason(tasks, year, lat) {
    const out = SLOTS.map((slot) => ({ slot, steps: [] }));
    for (const t of groupAgenda(tasks))
        out[SLOTS.indexOf(slotOf(t.date, year, lat))].steps.push(t);
    return out.filter((s) => s.slot !== "winter_end" || s.steps.length);
}
const planStep = (t) => t.kind !== "logged" && !t.ended && !t.windowEnd;
function bedHistory(bed, seasons, prior, bundle) {
    return mergePriorOccupancy(deriveHistory(bed.region, seasons, bundle), prior, bed.region);
}
const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;
function seasonAxis(year, lat) {
    return isSouthern(lat) ? { from: `${year}-07-01`, to: `${year + 1}-06-30` } : { from: `${year}-01-01`, to: `${year}-12-31` };
}
function axisAt(axis, iso) {
    const a = dayNo(axis.from), z = dayNo(axis.to) + 1;
    return Math.min(1, Math.max(0, (dayNo(iso) - a) / (z - a)));
}
function stripRows(bundle, jobs, axis, freeze, coolOf) {
    const spOf = (id) => bundle.species.find((x) => x.id === id);
    const before = addDaysISO(axis.from, -400) ?? axis.from;
    const sowings = calendarSowings({ todayIso: before, live: [], tasks: jobs, owed: () => true, bedOf: () => null,
        nameOf: (sid, group) => plantingLabel(bundle, sid, group), windowOf: (p) => plantingWindow(p, spOf(p.species), freeze) });
    const rows = new Map();
    for (const w of sowings) {
        const sp = spOf(w.species);
        const cover = sp?.category === "cover_crop";
        const row = rows.get(w.species) ?? { species: w.species, name: w.name, family: sp?.family ?? null,
            grow: [], pick: [], starts: [], cover, cool: !cover && coolOf(w.species) };
        rows.set(w.species, row);
        const s0 = axisAt(axis, w.start);
        row.starts.push(s0);
        if (cover)
            row.grow.push([s0, 1]);
        else if (w.window) {
            row.grow.push([s0, axisAt(axis, w.window.opens)]);
            row.pick.push([axisAt(axis, w.window.opens), axisAt(axis, w.window.closes)]);
        }
    }
    for (const r of rows.values()) {
        r.grow = union(r.grow);
        r.pick = union(r.pick);
    }
    return [...rows.values()].sort((a, b) => Math.min(...a.starts) - Math.min(...b.starts));
}
function union(spans) {
    const out = [];
    for (const [a, z] of [...spans].sort((x, y) => x[0] - y[0])) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 0.004)
            last[1] = Math.max(last[1], z);
        else
            out.push([a, z]);
    }
    return out;
}
function seasonExtension(bundle) {
    const r = bundle.rules.find((x) => x.trigger?.kind === "season_extension");
    const methods = r?.trigger?.methods;
    const tiers = r?.applies_to?.frost_tolerance;
    if (!r || !methods || typeof methods !== "object" || !Array.isArray(tiers))
        return null;
    const weeks = (v) => (typeof v === "number" && v > 0 ? v : 0);
    const out = Object.entries(methods)
        .map(([method, w]) => ({ method, spring: weeks(w?.spring_weeks), fall: weeks(w?.fall_weeks) }))
        .filter((m) => m.spring || m.fall);
    return out.length ? { rule: r.id, tiers: tiers.map(String), methods: out } : null;
}
function extendRow(row, w, y) {
    if (!row.cool || row.cover || !row.starts.length)
        return { early: null, late: null };
    const days = dayNo(y.axis.to) + 1 - dayNo(y.axis.from);
    const mid = y.frost.spring != null && y.frost.fall != null ? (y.frost.spring + y.frost.fall) / 2 : 0.5;
    const first = Math.min(...row.starts);
    const ends = (row.pick.length ? row.pick : row.grow).map(([, z]) => z);
    const last = ends.length ? Math.max(...ends) : null;
    const early = w.spring && first < mid ? [Math.max(0, first - (w.spring * 7) / days), first] : null;
    const late = w.fall && last != null && last > mid && last < 1 ? [last, Math.min(1, last + (w.fall * 7) / days)] : null;
    return { early: early && early[1] > early[0] ? early : null, late };
}
function yearPlan(bundle, ctx, site, prior, first, household = null, years = PLAN_YEARS) {
    const lat = ctx.lat;
    const beds = ctx.beds.filter((b) => !bedHasSections(b.name, ctx.beds));
    const guildById = new Map(bundle.guilds.map((g) => [g.id, g]));
    const rotationRule = familyRotationRule(bundle);
    const familyOf = new Map(bundle.species.map((s) => [s.id, s.family]));
    const frost = lat != null && ctx.lon != null ? gardenFrost(bundle, lat, ctx.lon, ctx.seasons) : null;
    const anchor = ctx.seasons.filter((s) => s.id < first).reduce((a, s) => (!a || s.id > a.id ? s : a), undefined);
    const ext = seasonExtension(bundle);
    const coolIn = (g) => {
        const groupOf = new Map(g ? teamPlants(g).map((p) => [p.sid, p.group]) : []);
        return (sid) => {
            const sp = bundle.species.find((x) => x.id === sid);
            const tier = sp ? resolveFrostTolerance(sp, groupOf.get(sid) ?? null) : undefined;
            return !!ext && !!tier && ext.tiers.includes(tier);
        };
    };
    const accepted = new Map();
    for (const e of (Array.isArray(anchor?.next_plan) ? anchor.next_plan : [])) {
        if (e.year === first && typeof e.area === "string" && typeof e.guild === "string" && guildById.has(e.guild))
            accepted.set(e.area, e.guild);
    }
    const perennialBeds = new Map();
    let seasons = [...ctx.seasons];
    const planned = [];
    for (let y = first; y < first + years; y++) {
        const rotating = beds.filter((b) => !perennialBeds.has(b.name));
        const plan = nextSeasonPlan(bundle, rotating, seasons, prior, site, y);
        const teams = new Map();
        for (const row of plan.beds)
            teams.set(row.name, { guild: row.assigned?.guild ?? null, spans: row.assigned?.spans ?? [], accepted: false });
        if (y === first)
            for (const [bed, guild] of accepted)
                if (teams.has(bed))
                    teams.set(bed, { guild, spans: [], accepted: true });
        for (const [bed, guild] of perennialBeds)
            teams.set(bed, { guild, spans: [], accepted: false });
        for (const [bed, t] of teams)
            if (t.guild && guildById.get(t.guild)?.guild_class === "perennial_guild")
                perennialBeds.set(bed, t.guild);
        planned.push({ year: y, plan, teams });
        const plantings = [];
        for (const b of beds) {
            const g = guildById.get(teams.get(b.name)?.guild ?? "");
            if (g)
                for (const p of teamPlants(g))
                    plantings.push({ species: p.sid, region: b.region, ...(p.group ? { cultivar_group: p.group } : {}) });
        }
        seasons = [...seasons.filter((s) => s.id !== y), { id: y, plot: ctx.plotId, plantings }];
    }
    const out = [];
    for (const { year, teams } of planned) {
        const before = seasons.filter((s) => s.id < year);
        const last = { plot: ctx.plotId, next_plan: [...teams].filter(([, t]) => !!t.guild).map(([area, t]) => ({ area, guild: t.guild, year })) };
        const jobs = lat == null ? [] : comingSeasonTasks(bundle, last, year, { ...ctx, seasons: before, seasonId: year - 1 }).filter(planStep);
        const freezeIso = frost?.firstFreeze ? fallDate(frost.firstFreeze, year, lat) : null;
        const axis = seasonAxis(year, lat);
        const freeze = frost && lat != null ? windowFreeze(frost, lat, bundle) : null;
        const springIso = frost?.lastFrost ? seasonDate(frost.lastFrost, year, lat) : null;
        const rows = [];
        for (const b of beds) {
            const t = teams.get(b.name) ?? { guild: null, spans: [], accepted: false };
            const g = guildById.get(t.guild ?? "");
            const hist = bedHistory(b, before, prior, bundle);
            const at = { ...site, history: hist.history, season_year: year, verticillium_reservoir: hist.verticillium_reservoir };
            let held;
            try {
                held = heldRotationFamilies(at, hist.history, year, bundle);
            }
            catch {
                held = new Set();
            }
            const thin = thinBreakSuggestion(at, bundle);
            const fams = familiesOf(g, bundle);
            const credit = priorSeasonCredit(at, bundle);
            const perennial = g?.guild_class === "perennial_guild";
            rows.push({
                name: b.name, team: t.guild, spans: t.spans, accepted: t.accepted, perennial,
                held: [...held].sort().map((family) => ({ family, rule: rotationRule[family] })).filter((h) => !!h.rule),
                breaks: thin ? { rule: thin.rule, families: thin.families, answered: thin.families.some((f) => fams.has(f)) } : null,
                credit: credit && g ? credit.rule : null,
                cover: perennial ? null : coverAfter(bundle, b, year, freezeIso, jobs, planned, seasons, prior, site, familyOf),
                seasons: bySeason(jobs.filter((j) => j.bed === b.name), year, lat),
                families: g ? [...new Set(teamPlants(g).map((p) => familyOf.get(p.sid)).filter((f) => !!f))] : [],
                strip: stripRows(bundle, jobs.filter((j) => j.bed === b.name), axis, freeze, coolIn(g)),
            });
            const bc = rows[rows.length - 1].cover;
            if (bc?.crops.length) {
                const from = bc.crops.reduce((a, c) => (c.from < a ? c.from : a), bc.crops[0].from);
                rows[rows.length - 1].strip.push({ species: "winter_cover", name: "", family: null, grow: [[axisAt(axis, from), 1]], pick: [],
                    starts: [axisAt(axis, from)], cover: true, cool: false });
            }
        }
        out.push({ year, axis, frost: { spring: springIso ? axisAt(axis, springIso) : null, fall: freezeIso ? axisAt(axis, freezeIso) : null },
            beds: rows, garden: bySeason(jobs.filter((j) => !j.bed), year, lat),
            household: householdRows(bundle, rows, household), putUp: putUpCrops(bundle, rows) });
    }
    return { first, years: out, dated: out.some((y) => [...y.garden, ...y.beds.flatMap((b) => b.seasons)].some((s) => s.steps.length)) };
}
function coverAfter(bundle, bed, year, freezeIso, jobs, planned, seasons, prior, site, familyOf) {
    if (!freezeIso)
        return null;
    if (jobs.some((j) => j.bed === bed.name && (j.rule === "R-122" || j.rule === "R-170")))
        return null;
    const r170 = bundle.rules.find((r) => r.id === "R-170");
    if (!r170)
        return null;
    const speciesById = new Map(bundle.species.map((s) => [s.id, s]));
    const guildById = new Map(bundle.guilds.map((g) => [g.id, g]));
    const rotationRule = familyRotationRule(bundle);
    const crops = [], left = [], residue = [];
    for (const sid of [].concat(r170.applies_to?.species ?? [])) {
        const sp = speciesById.get(sid);
        const lead = sp?.fall_sow_days_before_frost;
        if (!sp || !Array.isArray(lead) || lead.length !== 2)
            continue;
        const [lo, hi] = lead.map(Number);
        const from = addDaysISO(freezeIso, -hi), to = addDaysISO(freezeIso, -lo);
        if (!from || !to)
            continue;
        const fam = familyOf.get(sid);
        const withCover = seasons.map((s) => s.id !== year ? s
            : { ...s, plantings: [...(s.plantings ?? []), { species: sid, region: bed.region }] });
        let clash = null;
        for (const p of planned) {
            if (p.year <= year || !fam || !rotationRule[fam])
                continue;
            const later = guildById.get(p.teams.get(bed.name)?.guild ?? "");
            if (!later || !familiesOf(later, bundle).has(fam))
                continue;
            const h = bedHistory(bed, withCover.filter((s) => s.id < p.year), prior, bundle);
            let held;
            try {
                held = heldRotationFamilies({ ...site, verticillium_reservoir: h.verticillium_reservoir }, h.history, p.year, bundle);
            }
            catch {
                held = new Set();
            }
            if (held.has(fam)) {
                clash = { species: sid, family: fam, rule: rotationRule[fam], year: p.year };
                break;
            }
        }
        if (clash) {
            left.push(clash);
            continue;
        }
        crops.push({ species: sid, from, to, lo, hi });
        const al = sp.allelopathy;
        if (typeof al?.residue_lead_days === "number")
            residue.push({ species: sid, days: al.residue_lead_days, rule: al.rule ?? "R-144" });
    }
    return crops.length || left.length ? { rule: "R-170", crops, left, residue, freeze: freezeIso } : null;
}
function householdRows(bundle, rows, h) {
    if (!h)
        return [];
    const guildById = new Map(bundle.guilds.map((g) => [g.id, g]));
    const out = new Map();
    for (const r of rows) {
        const g = guildById.get(r.team ?? "");
        if (!g)
            continue;
        for (const p of teamPlants(g)) {
            const key = `${p.sid}|${p.group ?? ""}`;
            const have = out.get(key);
            if (have) {
                if (!have.beds.includes(r.name))
                    have.beds.push(r.name);
                continue;
            }
            const c = householdCount(resolveSpecies(p.sid, p.group, bundle), h);
            if (c)
                out.set(key, { species: p.sid, group: p.group, ...c, beds: [r.name] });
        }
    }
    return [...out.values()];
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const pair = (v) => (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] <= v[1] ? [v[0], v[1]] : null);
function putUpCrops(bundle, rows) {
    const guildById = new Map(bundle.guilds.map((g) => [g.id, g]));
    const out = new Map();
    for (const r of rows) {
        const g = guildById.get(r.team ?? "");
        if (!g)
            continue;
        for (const p of teamPlants(g)) {
            const key = `${p.sid}|${p.group ?? ""}`;
            if (out.has(key))
                continue;
            const c = putUpCrop(bundle, p.sid, p.group);
            if (c)
                out.set(key, c);
        }
    }
    return [...out.values()];
}
function putUpCrop(bundle, species, group) {
    const sp = bundle.species.find((x) => x.id === species);
    if (!sp)
        return null;
    const r = resolveSpecies(species, group, bundle);
    const pu = r.put_up;
    if (!pu || typeof pu !== "object")
        return null;
    const contestedPaths = (sp.confidence?.contested);
    const paths = Array.isArray(contestedPaths) ? contestedPaths.map(String) : [];
    const ownGroup = group && Array.isArray(sp.cultivar_groups)
        ? sp.cultivar_groups.find((cg) => cg.id === group) : undefined;
    const yieldPath = ownGroup && "yield_lb_per_10ft_row" in ownGroup ? `cultivar_groups.${group}.yield_lb_per_10ft_row` : "yield_lb_per_10ft_row";
    const packs = [];
    if (pu.tested !== "none" && Array.isArray(pu.packs)) {
        for (const k of pu.packs) {
            const jar = k.jar === "quart" || k.jar === "pint" ? k.jar : null;
            const lb = isNum(k.lb) ? k.lb : pair(k.lb);
            const batch = isNum(k.batch_lb) && isNum(k.batch_jars) ? { lb: k.batch_lb, jars: k.batch_jars } : null;
            if (jar && typeof k.pack === "string" && (lb || batch))
                packs.push({ pack: k.pack, jar, lb, batch });
        }
    }
    const tested = pu.tested !== "none";
    if (tested && !packs.length)
        return null;
    return {
        species, group, tested, packs,
        weighed: typeof pu.weighed === "string" ? pu.weighed : null,
        yieldLb: pair(r.yield_lb_per_10ft_row),
        plantsPer10ft: isNum(r.plants_per_10ft_row) ? r.plants_per_10ft_row : null,
        contested: paths.includes(yieldPath),
    };
}
function putUpNeed(c, pack, jars) {
    const per = pack.batch ? [pack.batch.lb / pack.batch.jars, pack.batch.lb / pack.batch.jars]
        : typeof pack.lb === "number" ? [pack.lb, pack.lb] : (pack.lb ?? [0, 0]);
    const lb = [per[0] * jars, per[1] * jars];
    const feet = c.yieldLb && jars > 0
        ? [Math.ceil((10 * lb[0]) / c.yieldLb[1] - 1e-9), Math.ceil((10 * lb[1]) / c.yieldLb[0] - 1e-9)] : null;
    const plants = feet && c.plantsPer10ft
        ? [Math.ceil((feet[0] / 10) * c.plantsPer10ft - 1e-9), Math.ceil((feet[1] / 10) * c.plantsPer10ft - 1e-9)] : null;
    return { lb, feet, plants };
}

const SLOT_WORD = { winter: "acWinter", spring: "acSpring", summer: "acSummer", autumn: "acAutumn", winter_end: "acWinter" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const joinAnd = (list) => list.length > 1 ? fillCopy("nsJoinAnd", { a: list.slice(0, -1).join(", "), b: list[list.length - 1] }) : (list[0] ?? "");
const joinOr = (list) => list.length > 1 ? fillCopy("clAltOr", { a: list.slice(0, -1).join(", "), b: list[list.length - 1] }) : (list[0] ?? "");
const md = (iso) => monthDay(iso.slice(5));
function why(cls, text, rule, label) {
    const p = el("p", `ns-why ${cls}`, text);
    if (rule) {
        p.dataset.rule = rule;
        mark(p, { kind: "rule", id: rule }, label ? { label } : undefined);
    }
    return p;
}
function stepRow(t, bundle) {
    const li = el("li", "yp-step");
    li.dataset.kind = t.kind;
    if (t.rule)
        li.dataset.rule = t.rule;
    li.appendChild(el("span", "yp-date", md(t.date)));
    li.appendChild(document.createTextNode(" "));
    li.appendChild(el("span", "yp-text", taskSentence(t, bundle)));
    const run = t.groupDates ?? [];
    if (run.length > 1)
        li.appendChild(el("span", "yp-run", ` ${fillCopy("ypRun", { n: run.length, from: md(run[0]), to: md(run[run.length - 1]) })}`));
    if (t.rule && /^R-\d/.test(t.rule) && t.kind !== "harvest_open") {
        const a = el("a", "whytap", `${copy.dsSeeEvidence} ›`);
        a.href = `#/why?rule=${t.rule}`;
        markLink(a, { kind: "rule", id: t.rule });
        li.appendChild(document.createTextNode(" "));
        li.appendChild(a);
    }
    return li;
}
function coverBlock(c, bundle) {
    const box = el("div", "yp-cover");
    box.dataset.rule = c.rule;
    const name = (sid) => midSentence(commonName(bundle, sid));
    const crops = c.crops.map((x) => fillCopy("ypCoverCrop", { crop: name(x.species), from: md(x.from), to: md(x.to) }));
    if (crops.length)
        box.appendChild(why("yp-cover-sow", fillCopy("ypCover", { crops: joinOr(crops) }), c.rule));
    const byRule = new Map();
    for (const l of c.left)
        byRule.set(l.rule, [...(byRule.get(l.rule) ?? []), l]);
    for (const [rule, ls] of byRule) {
        box.appendChild(why("yp-cover-left", fillCopy("ypCoverLeft", { crops: joinAnd(ls.map((l) => name(l.species))),
            family: familyInProse(ls[0].family), year: ls[0].year }), rule, copy.nsWhyWait));
    }
    for (const r of c.residue) {
        if (!c.crops.some((x) => x.species === r.species))
            continue;
        box.appendChild(why("yp-cover-residue", fillCopy("ypCoverResidue", { crop: name(r.species), days: r.days }), r.rule));
    }
    return box;
}
function seasonsBlock(seasons, bundle, cover) {
    const box = el("div", "yp-seasons");
    for (const s of seasons) {
        const sec = el("div", "yp-season");
        sec.dataset.slot = s.slot;
        sec.appendChild(el("p", "yp-sh", copy[SLOT_WORD[s.slot]]));
        const withCover = s.slot === "autumn" && !!cover;
        if (s.steps.length) {
            const ul = el("ul", "yp-steps");
            for (const t of s.steps)
                ul.appendChild(stepRow(t, bundle));
            sec.appendChild(ul);
        }
        else if (!withCover) {
            sec.appendChild(el("p", "hint yp-none", copy.ypNothing));
        }
        if (withCover)
            sec.appendChild(coverBlock(cover, bundle));
        box.appendChild(sec);
    }
    return box;
}
const teamName = (bundle, gid) => {
    const g = gid ? bundle.guilds.find((x) => x.id === gid) : undefined;
    return g ? displayName(g) : gid ?? copy.ypTileRest;
};
const famClass = (f) => `fam-${/^[a-z]+$/.test(f ?? "") ? f : "other"}`;
const pct = (x) => `${(x * 100).toFixed(2)}%`;
function band(families) {
    const b = el("span", "yp-band");
    b.setAttribute("aria-hidden", "true");
    for (const f of families.length ? families : [null])
        b.appendChild(el("span", `yp-bandseg ${famClass(f)}`));
    return b;
}
function board(plan, bundle, pick) {
    const years = plan.years;
    const wrap = el("div", "yp-board");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", fillCopy("ypBoardAria", { first: years[0].year, last: years[years.length - 1].year }));
    wrap.style.setProperty("--yp-cols", String(years.length));
    const head = el("div", "yp-brow yp-bhead");
    head.appendChild(el("span", "yp-bcorner"));
    for (const y of years)
        head.appendChild(el("span", "yp-byear", String(y.year)));
    wrap.appendChild(head);
    for (const b of years[0].beds) {
        const row = el("div", "yp-brow");
        row.appendChild(el("span", "yp-bname", b.name));
        for (const y of years) {
            const by = y.beds.find((x) => x.name === b.name);
            const tile = el("button", `yp-tile${by?.team ? "" : " yp-tile-rest"}`);
            tile.type = "button";
            tile.dataset.year = String(y.year);
            tile.dataset.bed = b.name;
            if (by?.team)
                tile.dataset.guild = by.team;
            const name = teamName(bundle, by?.team ?? null);
            tile.setAttribute("aria-label", fillCopy("ypTileAria", { bed: b.name, year: y.year, team: name }));
            tile.appendChild(band(by?.families ?? []));
            tile.appendChild(el("span", "yp-tname", name));
            tile.addEventListener("click", () => pick(y.year, b.name));
            row.appendChild(tile);
        }
        wrap.appendChild(row);
    }
    return wrap;
}
function legend(plan) {
    const seen = [];
    for (const y of plan.years)
        for (const b of y.beds)
            for (const f of b.families)
                if (!seen.includes(f))
                    seen.push(f);
    const ul = el("ul", "yp-legend");
    for (const f of seen) {
        const li = el("li", "");
        li.append(el("span", `yp-sw ${famClass(f)}`), document.createTextNode(cap(familyName(f))));
        ul.appendChild(li);
    }
    return ul;
}
function strip(rows, y, axisMonths, cover) {
    if (!rows.length)
        return null;
    const box = el("div", "yp-strip");
    if (y.frost.spring != null)
        box.style.setProperty("--yp-sp", pct(y.frost.spring));
    if (y.frost.fall != null)
        box.style.setProperty("--yp-fa", pct(y.frost.fall));
    box.classList.toggle("yp-frosty", y.frost.spring != null || y.frost.fall != null);
    const months = el("div", "yp-srow yp-smonths");
    months.setAttribute("aria-hidden", "true");
    months.appendChild(el("span", "yp-slab"));
    const track = el("span", "yp-strack");
    for (const m of axisMonths)
        track.appendChild(el("span", "yp-smonth", m));
    months.appendChild(track);
    box.appendChild(months);
    for (const r of rows) {
        const row = el("div", `yp-srow${r.cover ? " yp-scover" : ""}`);
        row.dataset.species = r.species;
        row.appendChild(el("span", "yp-slab", r.cover && !r.name ? copy.ypStripCover : r.name));
        const t = el("span", `yp-strack ${famClass(r.family)}`);
        const seg = (cls, [a, z]) => {
            const s = el("span", cls);
            s.style.left = pct(a);
            s.style.width = pct(Math.max(z - a, 0.006));
            t.appendChild(s);
        };
        for (const g of r.grow)
            seg(r.cover ? "yp-seg yp-seg-cover" : "yp-seg yp-seg-grow", g);
        for (const p of r.pick)
            seg("yp-seg yp-seg-pick", p);
        if (cover) {
            const x = extendRow(r, cover, y);
            if (x.early)
                seg("yp-seg yp-seg-ext yp-ext-early", x.early);
            if (x.late)
                seg("yp-seg yp-seg-ext yp-ext-late", x.late);
        }
        row.appendChild(t);
        box.appendChild(row);
    }
    return box;
}
function stripKey(y, anyCover, extending) {
    const ul = el("ul", "yp-key");
    const items = [["yp-k-grow", copy.hcLegendGrowing], ["yp-k-pick", copy.hcLegendPicking]];
    if (anyCover)
        items.push(["yp-k-cover", copy.ypLegendCover]);
    if (extending)
        items.push(["yp-k-ext", copy.ypLegendExt]);
    if (y.frost.spring != null || y.frost.fall != null)
        items.push(["yp-k-frost", copy.hcLegendFrost]);
    for (const [cls, word] of items) {
        const li = el("li", cls);
        li.append(el("span", "yp-ksw"), document.createTextNode(word));
        ul.appendChild(li);
    }
    return ul;
}
function chip(host, label, rule, cls) {
    if (rule) {
        const b = mark(host, { kind: "rule", id: rule }, { label });
        if (b) {
            b.classList.add("yp-chip", cls);
            b.dataset.rule = rule;
        }
    }
    else
        host.appendChild(el("span", `yp-chip yp-chip-plain ${cls}`, label));
}
function bedBlock(b, y, bundle, axisMonths, ext) {
    const box = el("article", "yp-bed");
    box.dataset.bed = b.name;
    if (b.team)
        box.dataset.guild = b.team;
    const head = el("header", "yp-bhd");
    head.appendChild(band(b.families));
    head.appendChild(el("p", "yp-bedname", b.name));
    head.appendChild(el("h4", "yp-team", b.team && b.spans.length
        ? fillCopy("nsToSpan", { beds: b.spans.join(" + "), team: teamName(bundle, b.team) }).replace(/^\+\s*/, "")
        : teamName(bundle, b.team)));
    box.appendChild(head);
    const chips = el("p", "yp-chips");
    if (b.accepted)
        chip(chips, fillCopy("ypYouChose", { year: y.year }), null, "yp-chosen");
    if (b.perennial)
        chip(chips, copy.ypChipPerennial, null, "yp-perennial");
    if (b.held.length) {
        chips.appendChild(el("span", "yp-chips-k", copy.ypRestsFrom));
        for (const h of b.held)
            chip(chips, cap(familyName(h.family)), h.rule, "yp-held");
    }
    if (b.breaks?.answered)
        chip(chips, copy.ypChipBreak, b.breaks.rule, "yp-break");
    if (b.credit)
        chip(chips, copy.ypChipCredit, b.credit, "yp-credit");
    if (chips.childNodes.length)
        box.appendChild(chips);
    const s = strip(b.strip, y, axisMonths, ext?.w ?? null);
    if (s)
        box.appendChild(s);
    const ex = ext && s ? extLine(b, y, bundle, ext) : null;
    if (ex)
        box.appendChild(ex);
    if (b.cover?.crops.length) {
        const name = (sid) => midSentence(commonName(bundle, sid));
        const line = el("p", "yp-coverline");
        line.appendChild(el("span", "", fillCopy("ypCoverLine", { crops: joinOr(b.cover.crops.map((c) => fillCopy("ypCoverCrop", { crop: name(c.species), from: md(c.from), to: md(c.to) }))) })));
        chip(line, copy.dsSeeEvidence, b.cover.rule, "yp-coverdoor");
        box.appendChild(line);
    }
    const n = b.seasons.reduce((a, x) => a + x.steps.length, 0);
    if (n || b.cover) {
        const more = el("details", "yp-more");
        more.appendChild(el("summary", "", fillCopy(n === 1 ? "ypJobsOne" : "ypJobsMany", { n })));
        more.appendChild(seasonsBlock(b.seasons, bundle, b.cover));
        box.appendChild(more);
    }
    return box;
}
function yearPanel(y, bundle, house, ext) {
    const panel = el("div", "yp-panel");
    panel.dataset.year = String(y.year);
    panel.setAttribute("role", "tabpanel");
    panel.id = `yp-panel-${y.year}`;
    const m0 = Number(y.axis.from.slice(5, 7)) - 1;
    const axisMonths = Array.from({ length: 12 }, (_, i) => monthShort((m0 + i) % 12).charAt(0).toUpperCase());
    const anyStrip = y.beds.some((b) => b.strip.length);
    if (anyStrip)
        panel.appendChild(stripKey(y, y.beds.some((b) => b.strip.some((r) => r.cover)), !!ext));
    for (const b of y.beds)
        panel.appendChild(bedBlock(b, y, bundle, axisMonths, ext));
    if (y.garden.some((s) => s.steps.length)) {
        const g = el("details", "yp-more yp-garden");
        g.appendChild(el("summary", "", copy.ypGardenMore));
        g.appendChild(seasonsBlock(y.garden.filter((s) => s.steps.length), bundle, null));
        panel.appendChild(g);
    }
    if (house && y.household.length) {
        const h = el("div", "yp-house");
        h.appendChild(el("p", "yp-house-k", fillCopy("plHousehold", { who: householdWho(house) })));
        const ul = el("ul", "yp-house-list");
        for (const r of y.household)
            ul.appendChild(el("li", "thouse-row", householdLine(cap(commonName(bundle, r.species)), r)));
        h.appendChild(ul);
        h.appendChild(el("p", "hint", copy.plHouseholdNote));
        panel.appendChild(h);
    }
    if (y.putUp.length)
        panel.appendChild(putUpCard(y, bundle));
    return panel;
}
const METHOD_WORD = { row_cover: "ypMethodRowCover", low_tunnel: "ypMethodTunnel", cold_frame: "ypMethodFrame" };
const weeksWord = (n) => fillCopy(n === 1 ? "ypWeeksOne" : "ypWeeksMany", { n });
function extLine(b, y, bundle, ext) {
    const helped = b.strip.filter((r) => { const x = extendRow(r, ext.w, y); return x.early || x.late; });
    if (!helped.length)
        return null;
    const line = el("p", "yp-extline");
    const early = helped.some((r) => extendRow(r, ext.w, y).early), late = helped.some((r) => extendRow(r, ext.w, y).late);
    const crops = cap(joinAnd(helped.map((r) => midSentence(commonName(bundle, r.species)))));
    const text = early && late ? fillCopy("ypExtBoth", { crops, spring: weeksWord(ext.w.spring), fall: weeksWord(ext.w.fall) })
        : early ? fillCopy("ypExtSpring", { crops, spring: weeksWord(ext.w.spring) })
            : fillCopy("ypExtFall", { crops, fall: weeksWord(ext.w.fall) });
    line.appendChild(el("span", "", text));
    chip(line, copy.dsSeeEvidence, ext.rule, "yp-extdoor");
    return line;
}
function coverChooser(se, chosen, pick) {
    const box = el("div", "yp-under");
    const id = "yp-under-k";
    box.appendChild(el("span", "yp-under-k", copy.ypUnderK)).id = id;
    const group = el("div", "yp-pills");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", id);
    const opts = [[null, copy.ypMethodOpen],
        ...se.methods.filter((m) => METHOD_WORD[m.method]).map((m) => [m.method, copy[METHOD_WORD[m.method]]])];
    for (const [method, word] of opts) {
        const b = el("button", "yp-pill", word);
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(method === chosen));
        b.dataset.method = method ?? "open";
        b.addEventListener("click", () => pick(method));
        group.appendChild(b);
    }
    box.appendChild(group);
    return box;
}
const WEIGHED_WORD = { as_picked: "ypWeighedPicked", without_tops: "ypWeighedTops", in_husks: "ypWeighedHusks",
    in_pods: "ypWeighedPods", as_dug: "ypWeighedDug" };
const PACK_WORD = { whole_or_halved: "ypPackWhole", crushed: "ypPackCrushed", juice: "ypPackJuice",
    sauce_thin: "ypPackSauceThin", sauce_thick: "ypPackSauceThick", whole_kernel: "ypPackKernel", cream_style: "ypPackCream" };
const jarsKept = new Map();
const LB_KG = 0.45359237, FT_M = 0.3048;
const span = (lo, hi, f) => (f(lo) === f(hi) ? f(lo) : `${f(lo)}–${f(hi)}`);
function weightText([lo, hi]) {
    if (unitSystem() === "metric")
        return `${span(lo * LB_KG, hi * LB_KG, (v) => String(v >= 10 ? Math.round(v) : +v.toFixed(1)))} kg`;
    return `${span(lo, hi, (v) => String(Math.round(v * 2) / 2))} lb`;
}
function rowText([lo, hi]) {
    if (unitSystem() === "metric")
        return `${span(lo * FT_M, hi * FT_M, (v) => String(+v.toFixed(1)))} m`;
    return `${span(lo, hi, String)} ${copy.unitFt}`;
}
function putUpRow(c, bundle) {
    const li = el("li", "yp-put");
    li.dataset.species = c.species;
    const name = cap(commonName(bundle, c.species));
    const head = el("div", "yp-put-hd");
    head.appendChild(el("span", "yp-put-name", name));
    li.appendChild(head);
    if (!c.tested) {
        const p = el("p", "yp-put-none");
        p.appendChild(el("span", "", copy.ypPutUntested));
        const b = mark(p, { kind: "species", id: c.species, group: c.group, field: "put_up" }, { label: copy.dsSeeEvidence });
        if (b)
            b.classList.add("yp-chip", "yp-putdoor");
        li.appendChild(p);
        return li;
    }
    const key = `${c.species}|${c.group ?? ""}`;
    const kept = jarsKept.get(key) ?? { pack: 0 };
    const jarWord = (pk, n) => fillCopy(pk.jar === "pint" ? (n === 1 ? "ypPintOne" : "ypPintMany") : (n === 1 ? "ypQuartOne" : "ypQuartMany"), { n });
    const step = el("div", "yp-step-n");
    const minus = el("button", "yp-stepbtn", "−");
    const plus = el("button", "yp-stepbtn", "+");
    const count = el("output", "yp-jars");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", fillCopy("ypFewer", { crop: name }));
    plus.setAttribute("aria-label", fillCopy("ypMore", { crop: name }));
    step.append(minus, count, plus);
    head.appendChild(step);
    let sel = null;
    if (c.packs.length > 1) {
        sel = el("select", "yp-pack");
        sel.setAttribute("aria-label", fillCopy("ypPackAria", { crop: name }));
        c.packs.forEach((pk, i) => {
            const o = el("option", "", PACK_WORD[pk.pack] ? copy[PACK_WORD[pk.pack]] : pk.pack);
            o.value = String(i);
            sel.appendChild(o);
        });
        sel.value = String(Math.min(kept.pack, c.packs.length - 1));
        li.appendChild(sel);
    }
    const need = el("p", "yp-put-need");
    li.appendChild(need);
    if (c.contested) {
        const p = el("p", "yp-put-contested");
        p.appendChild(el("span", "", copy.ypPutContested));
        const b = mark(p, { kind: "species", id: c.species, group: c.group, field: "yield_lb_per_10ft_row" }, { label: copy.dsSeeEvidence });
        if (b)
            b.classList.add("yp-chip", "yp-putdoor");
        li.appendChild(p);
    }
    const draw = () => {
        const st = jarsKept.get(key) ?? { jars: 0, pack: 0 };
        const pk = c.packs[Math.min(st.pack, c.packs.length - 1)];
        count.textContent = jarWord(pk, st.jars);
        minus.disabled = st.jars <= 0;
        plus.disabled = st.jars >= 200;
        need.hidden = st.jars <= 0;
        if (st.jars <= 0) {
            need.textContent = "";
            return;
        }
        const n = putUpNeed(c, pk, st.jars);
        const weight = c.weighed && WEIGHED_WORD[c.weighed]
            ? fillCopy("ypWeightWeighed", { weight: weightText(n.lb), weighed: copy[WEIGHED_WORD[c.weighed]] }) : weightText(n.lb);
        need.textContent = !n.feet ? weight
            : n.plants ? fillCopy("ypNeedPlants", { weight, row: rowText(n.feet), plants: span(n.plants[0], n.plants[1], String) })
                : fillCopy("ypNeedRow", { weight, row: rowText(n.feet) });
    };
    const set = (d) => { jarsKept.set(key, { ...(jarsKept.get(key) ?? { jars: 0, pack: 0 }), ...d }); draw(); };
    minus.addEventListener("click", () => set({ jars: Math.max(0, (jarsKept.get(key)?.jars ?? 0) - 1) }));
    plus.addEventListener("click", () => set({ jars: Math.min(200, (jarsKept.get(key)?.jars ?? 0) + 1) }));
    sel?.addEventListener("change", () => set({ pack: Number(sel.value) }));
    draw();
    return li;
}
function putUpCard(y, bundle) {
    const box = el("div", "yp-putup");
    box.appendChild(el("p", "yp-putup-k", copy.ypPutK));
    box.appendChild(el("p", "hint yp-putup-lead", copy.ypPutLead));
    const ul = el("ul", "yp-put-list");
    for (const c of [...y.putUp].sort((a, b) => Number(b.tested) - Number(a.tested)))
        ul.appendChild(putUpRow(c, bundle));
    box.appendChild(ul);
    box.appendChild(el("p", "hint yp-putup-src", copy.ypPutSource));
    return box;
}
let shownYear = null;
let shownCover = null;
function ensureYearPlanCss() {
    if (document.getElementById("yearplan-css"))
        return;
    const link = document.createElement("link");
    link.id = "yearplan-css";
    link.rel = "stylesheet";
    link.href = "./yearplan.css";
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
function renderYearPlan(box, bundle, site, first, accept, close) {
    ensureYearPlanCss();
    box.replaceChildren();
    const ctx = currentGardenCtx();
    const h = householdChoice();
    const house = h && h !== "none" ? h : null;
    const plan = yearPlan(bundle, ctx, site, app.logSnapshot.priorOccupancy, first, house);
    if (!plan.years.length)
        return;
    const last = plan.years[plan.years.length - 1].year;
    if (shownYear == null || !plan.years.some((y) => y.year === shownYear))
        shownYear = first;
    const wrap = el("section", "yearplan");
    wrap.dataset.first = String(first);
    const top = el("header", "yp-top");
    top.appendChild(el("p", "yp-eyebrow", copy.ypEyebrow));
    top.appendChild(el("h3", "yp-h", copy.ypTitle));
    const nb = plan.years[0].beds.length;
    top.appendChild(el("p", "yp-sub", fillCopy(nb === 1 ? "ypSubOne" : "ypSubMany", { first, last, n: nb })));
    wrap.appendChild(top);
    const tabs = el("div", "yp-tabs");
    tabs.setAttribute("role", "tablist");
    const panels = el("div", "yp-panels");
    const show = (year, bed) => {
        shownYear = year;
        for (const t of tabs.querySelectorAll(".yp-tab")) {
            const on = Number(t.dataset.year) === year;
            t.setAttribute("aria-selected", String(on));
            t.tabIndex = on ? 0 : -1;
        }
        for (const p of panels.querySelectorAll(".yp-panel"))
            p.hidden = Number(p.dataset.year) !== year;
        for (const t of wrap.querySelectorAll(".yp-tile"))
            t.classList.toggle("yp-on", Number(t.dataset.year) === year);
        if (bed) {
            const card = panels.querySelector(`.yp-panel[data-year="${year}"] .yp-bed[data-bed="${CSS.escape(bed)}"]`);
            if (card) {
                card.scrollIntoView({ block: "start", behavior: "smooth" });
                card.classList.add("yp-flash");
                setTimeout(() => card.classList.remove("yp-flash"), 1200);
            }
        }
    };
    wrap.appendChild(board(plan, bundle, (year, bed) => show(year, bed)));
    wrap.appendChild(legend(plan));
    if (!plan.dated)
        wrap.appendChild(el("p", "hint yp-lead", copy.ypLeadUndated));
    const y1 = plan.years[0];
    const todo = y1.beds.filter((b) => b.team && !b.spans.length && !b.perennial && !b.accepted);
    if (y1.beds.some((b) => b.team && !b.spans.length)) {
        const act = el("div", "yp-act");
        const btn = el("button", "btn btn-primary yp-acceptall", todo.length ? fillCopy("ypAcceptAll", { year: first }) : fillCopy("ypAcceptedAll", { year: first }));
        btn.type = "button";
        btn.disabled = !todo.length;
        btn.addEventListener("click", () => void (async () => {
            btn.disabled = true;
            try {
                for (const b of todo)
                    await accept(first, b.name, b.team);
                btn.textContent = fillCopy("ypAcceptedAll", { year: first });
                toast(fillCopy("ypAcceptedAll", { year: first }));
            }
            catch (e) {
                btn.disabled = false;
                btn.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        act.appendChild(btn);
        act.appendChild(el("p", "hint yp-acceptnote", fillCopy("ypAcceptNote", { year: first })));
        wrap.appendChild(act);
    }
    const se = seasonExtension(bundle);
    for (const y of plan.years) {
        const t = el("button", "yp-tab", String(y.year));
        t.type = "button";
        t.dataset.year = String(y.year);
        t.setAttribute("role", "tab");
        t.setAttribute("aria-controls", `yp-panel-${y.year}`);
        t.addEventListener("click", () => show(y.year, null));
        t.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft")
                return;
            const i = plan.years.findIndex((x) => x.year === y.year) + (e.key === "ArrowRight" ? 1 : -1);
            const to = plan.years[(i + plan.years.length) % plan.years.length];
            show(to.year, null);
            tabs.querySelector(`.yp-tab[data-year="${to.year}"]`)?.focus();
        });
        tabs.appendChild(t);
        if (!se || !plan.dated)
            panels.appendChild(yearPanel(y, bundle, house, null));
    }
    wrap.appendChild(tabs);
    if (se && plan.dated) {
        if (shownCover && !se.methods.some((m) => m.method === shownCover))
            shownCover = null;
        const drawPanels = () => {
            const w = se.methods.find((m) => m.method === shownCover) ?? null;
            panels.replaceChildren(...plan.years.map((y) => yearPanel(y, bundle, house, w ? { rule: se.rule, w } : null)));
        };
        const chooser = coverChooser(se, shownCover, (method) => {
            shownCover = method;
            for (const p of chooser.querySelectorAll(".yp-pill"))
                p.setAttribute("aria-checked", String((p.dataset.method ?? "") === (method ?? "open")));
            drawPanels();
            show(shownYear ?? first, null);
        });
        wrap.appendChild(chooser);
        drawPanels();
    }
    wrap.appendChild(panels);
    const shut = el("button", "linky yp-close", copy.ypClose);
    shut.type = "button";
    shut.addEventListener("click", close);
    wrap.appendChild(shut);
    box.appendChild(wrap);
    show(shownYear, null);
}

export { renderYearPlan };
