import './chunk-lutet8cz.js';
import { $, app, gardenSeasonAfter, localTodayIso, activeBundle, glossTerm, mark, plantingOnBed, toast, seasonId, bedHasSections, browsableGuilds, mergePriorOccupancy, deriveHistory, heldRotationFamilies, regionPoints, area, parseRegion, guildStatus, seasonById, displayName, getSeason, putSeason, openSeason } from './core.js';
import { composePlot, tierWords } from './chunk-iac2um9b.js';
import { heldFamiliesLine } from './chunk-dpsx67rd.js';
import { fillCopy, fillNodes, copy, plusPreview } from './paint.js';

function guildFamilies(g, bundle) {
    const fam = new Map(bundle.species.map((s) => [s.id, s.family]));
    const out = new Set();
    const add = (sid) => { const f = typeof sid === "string" ? fam.get(sid) : undefined; if (f)
        out.add(f); };
    for (const r of (g.roles ?? []))
        add(r.canonical);
    for (const m of g.members ?? [])
        add(m.species);
    return out;
}
function nextSeasonPlan(bundle, beds, seasons, priorOccupancy, site, year) {
    const plannable = beds.filter((b) => !bedHasSections(b.name, beds));
    const guilds = browsableGuilds(bundle);
    const famOf = new Map(guilds.map((g) => [g.id, guildFamilies(g, bundle)]));
    const rows = [];
    const excludedMap = {};
    for (const bed of plannable) {
        let held = new Set();
        let historyOf = {};
        try {
            const d = mergePriorOccupancy(deriveHistory(bed.region, seasons, bundle), priorOccupancy, bed.region);
            historyOf = d.history;
            held = heldRotationFamilies({ ...site, verticillium_reservoir: d.verticillium_reservoir }, d.history, year, bundle);
        }
        catch {
            held = new Set();
        }
        const pts = regionPoints(bed.region);
        const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
        const l = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
        const eligible = [], perennials = [], excluded = [];
        const hasHistory = held.size > 0 || Object.keys(historyOf).length > 0;
        const bedArea = area(parseRegion(bed.region));
        for (const g of guilds) {
            const blocked = [...(famOf.get(g.id) ?? [])].some((f) => held.has(f));
            const fits = !blocked && guildStatus(g, w, l, bundle, bed.structure, bed.region).fits;
            const perennial = g.guild_class === "perennial_guild";
            if (fits && perennial && hasHistory) {
                perennials.push(g.id);
                excluded.push(g.id);
                continue;
            }
            if (fits) {
                eligible.push(g.id);
                continue;
            }
            const structureGate = !guildStatus(g, 1e6, 1e6, bundle, bed.structure, null).fits;
            const singleOnly = Number(g.footprint_min_m2 || 0) <= bedArea + 1e-9;
            if (blocked || structureGate || singleOnly || (perennial && hasHistory))
                excluded.push(g.id);
        }
        if (excluded.length)
            excludedMap[bed.name] = excluded;
        rows.push({ name: bed.name, held: [...held].sort(), eligible, perennials, excluded, assigned: null });
    }
    const r = composePlot({ beds: plannable.map((b) => ({ name: b.name, region: b.region })), excluded: excludedMap }, bundle);
    const arrangement = r.arrangements[0] ?? null;
    for (const a of arrangement?.assignments ?? []) {
        for (const bn of a.beds) {
            const row = rows.find((x) => x.name === bn);
            if (!row)
                continue;
            if (!a.spans && !row.eligible.includes(a.guild))
                continue;
            row.assigned = { guild: a.guild, spans: a.spans ? a.beds.filter((o) => o !== bn) : [] };
        }
    }
    return { year, beds: rows, excludedMap, arrangement, tier: tierWords(r.tier.key), refused: r.refused };
}
function nextPlanAnchorId() {
    const s = app.logSnapshot.seasons;
    return seasonId() ?? (s.length ? Math.max(...s.map((x) => x.id)) : null);
}
async function acceptNextSeasonDraft(year, bedName, guildId) {
    const db = app.logDb;
    const anchorId = nextPlanAnchorId();
    if (!db || anchorId == null)
        throw new Error(copy.nsErrNotReady);
    const season = await getSeason(db, app.currentPlotId, anchorId);
    if (!season)
        throw new Error(copy.nsErrNoSeason);
    const next = (Array.isArray(season.next_plan) ? season.next_plan : []);
    const kept = next.filter((e) => !(e.year === year && e.area === bedName));
    kept.push({ area: bedName, guild: guildId, year, saved: localTodayIso() });
    season.next_plan = kept;
    await putSeason(db, season);
    void app.logRefresh?.();
}
function acceptedNextSeason(year) {
    const open = seasonById(nextPlanAnchorId()) ?? undefined;
    const m = new Map();
    for (const e of (Array.isArray(open?.next_plan) ? open.next_plan : [])) {
        if (e.year === year && typeof e.area === "string" && typeof e.guild === "string")
            m.set(e.area, e.guild);
    }
    return m;
}
let nsOpen = false;
let ypShown = false;
function openNextSeason() { nsOpen = true; }
function plannerPlace(site, pin) {
    return pin ? { lat: pin.lat, lon: pin.lon } : { lat: site.lat ?? null, lon: site.lon ?? null };
}
function renderNextSeason(bundle, site) {
    const box = $("nextseason");
    box.replaceChildren();
    const beds = app.logSnapshot.beds;
    const anchorId = nextPlanAnchorId();
    if (!beds.length || anchorId == null || !app.logDb)
        return;
    const at = plannerPlace(site, app.currentPlot?.anchor);
    const year = gardenSeasonAfter(bundle, anchorId, app.logSnapshot.seasons, localTodayIso(), at.lat, at.lon);
    if (!nsOpen) {
        const p = document.createElement("p");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary stepnext nsopen";
        b.textContent = fillCopy("nsOpen", { year });
        b.addEventListener("click", () => { nsOpen = true; renderNextSeason(bundle, site); });
        p.appendChild(b);
        box.appendChild(p);
        return;
    }
    const ab = activeBundle(bundle);
    const plan = nextSeasonPlan(ab, beds, app.logSnapshot.seasons, app.logSnapshot.priorOccupancy, site, year);
    const wrap = document.createElement("section");
    wrap.className = "nextseason";
    wrap.dataset.year = String(year);
    const h = document.createElement("h3");
    h.className = "ns-h";
    fillNodes(h, fillCopy("nsHeading", { year }), { rotation: glossTerm("rotation", copy.nsRotationWord) });
    wrap.appendChild(h);
    const lead = document.createElement("p");
    lead.className = "hint ns-lead";
    lead.textContent = plan.refused
        ? copy.nsLeadRefused
        : copy.nsLead;
    wrap.appendChild(lead);
    const name = (gid) => { const g = ab.guilds.find((x) => x.id === gid); return g ? displayName(g) : gid; };
    const nsAccepted = acceptedNextSeason(year);
    for (const row of plan.beds) {
        const el = document.createElement("div");
        el.className = "nsrow";
        el.dataset.bed = row.name;
        if (row.assigned)
            el.dataset.guild = row.assigned.guild;
        const head = document.createElement("div");
        head.className = "ns-bed";
        const bn = document.createElement("span");
        bn.className = "ns-name";
        bn.textContent = row.name;
        head.appendChild(bn);
        const to = document.createElement("span");
        to.className = "ns-to";
        if (row.assigned && row.assigned.spans.length) {
            to.textContent = " " + fillCopy("nsToSpan", { beds: row.assigned.spans.join(" + "), team: name(row.assigned.guild) });
        }
        else if (row.assigned) {
            to.textContent = " " + fillCopy("nsTo", { team: name(row.assigned.guild) });
        }
        else {
            to.textContent = " " + (row.eligible.length ? copy.nsToChoice : copy.nsToRest);
        }
        head.appendChild(to);
        el.appendChild(head);
        const why = document.createElement("p");
        why.className = "ns-why";
        const n = row.eligible.length;
        why.textContent = (row.held.length
            ? heldFamiliesLine(row.held, "nsHeld", "nsHeldOne")
            : copy.nsClear)
            + " " + (n ? fillCopy(n === 1 ? "nsFitsOne" : "nsFitsMany", { n }) : copy.nsFitsNone);
        if (row.held.length) {
            const heldFam = row.held[0];
            const rr = ab.rules.find((r) => {
                const t = r.trigger;
                return t?.kind === "rotation_interval" && t?.family === heldFam;
            });
            if (rr)
                mark(why, { kind: "rule", id: String(rr.id) }, { label: copy.nsWhyWait });
        }
        el.appendChild(why);
        const openSeason$1 = openSeason();
        const draftHere = (openSeason$1?.plan ?? []).find((e) => e.area === row.name && typeof e.guild === "string");
        const bedRec = app.logSnapshot.beds.find((b) => b.name === row.name);
        const liveHere = !!bedRec && (openSeason$1?.plantings ?? []).some((p) => !p.end_cause && plantingOnBed(p.region, bedRec.region));
        if (draftHere && !liveHere) {
            const dn = document.createElement("p");
            dn.className = "hint ns-draftnote";
            dn.textContent = fillCopy("nsDraftNote", { team: name(String(draftHere.guild)) });
            el.appendChild(dn);
        }
        if (row.eligible.length || row.perennials.length) {
            const det = document.createElement("details");
            det.className = "ns-elig";
            const sum = document.createElement("summary");
            sum.textContent = copy.nsTeamsCanTake;
            det.appendChild(sum);
            const ul = document.createElement("ul");
            for (const gid of row.eligible) {
                const li = document.createElement("li");
                li.textContent = name(gid);
                ul.appendChild(li);
            }
            det.appendChild(ul);
            if (row.perennials.length) {
                const pp = document.createElement("p");
                pp.className = "hint ns-perennial";
                pp.textContent = fillCopy("nsPerennials", { teams: row.perennials.map(name).join(", ") });
                det.appendChild(pp);
            }
            el.appendChild(det);
        }
        if (row.assigned && row.assigned.spans.length) {
            const note = document.createElement("p");
            note.className = "hint";
            note.textContent = fillCopy("nsSpanNote", { beds: [row.name, ...row.assigned.spans].reduce((a, b) => fillCopy("nsJoinAnd", { a, b })) });
            el.appendChild(note);
        }
        else if (row.assigned && row.eligible.includes(row.assigned.guild)) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-primary ns-accept";
            const gid = row.assigned.guild;
            btn.textContent = nsAccepted.get(row.name) === gid ? fillCopy("nsAccepted", { year }) : fillCopy("nsAccept", { team: name(gid), bed: row.name });
            btn.disabled = nsAccepted.get(row.name) === gid;
            btn.addEventListener("click", () => void (async () => {
                btn.disabled = true;
                try {
                    await acceptNextSeasonDraft(year, row.name, gid);
                    btn.textContent = fillCopy("nsAccepted", { year });
                    toast(fillCopy("nsDraftSaved", { year, bed: row.name }));
                }
                catch (e) {
                    btn.disabled = false;
                    btn.textContent = String(e instanceof Error ? e.message : e);
                }
            })());
            el.appendChild(btn);
        }
        wrap.appendChild(el);
    }
    if (plusPreview()) {
        const yp = document.createElement("div");
        yp.id = "yearplan";
        const draw = () => {
            void import('./yearplanview.js').then((m) => m.renderYearPlan(yp, ab, site, year, acceptNextSeasonDraft, () => { ypShown = false; renderNextSeason(bundle, site); }), (e) => console.warn("[year plan] did not load", e));
        };
        if (ypShown)
            draw();
        else {
            const door = document.createElement("button");
            door.type = "button";
            door.className = "btn btn-secondary stepnext yp-open";
            door.textContent = copy.ypOpen;
            door.addEventListener("click", () => { ypShown = true; door.remove(); draw(); });
            yp.appendChild(door);
        }
        wrap.appendChild(yp);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "linky ns-close";
    close.textContent = copy.nsClose;
    close.addEventListener("click", () => { nsOpen = false; renderNextSeason(bundle, site); });
    wrap.appendChild(close);
    box.appendChild(wrap);
}

export { nextSeasonPlan, openNextSeason, renderNextSeason };
