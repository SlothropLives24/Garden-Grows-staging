import { $ } from "./dom.js";
import { openSeason as activeSeason, seasonById, seasonId } from "./session.js";
import { activeBundle, app } from "./state.js";
import { heldRotationFamilies } from "./engine/compiler.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { browsableGuilds, displayName, guildStatus } from "./engine/guilds.js";
import { composePlot } from "./engine/plotcompose.js";
import { regionPoints } from "./engine/regions.js";
import { familyName } from "./engine/labels.js";
import { getSeason, putSeason } from "./storage.js";
import { bedHasSections, mergePriorOccupancy, plantingOnBed } from "./plan.js";
import { toast } from "./notices.js";
import { glossTerm } from "./glossary.js";
import { mark } from "./dossier.js";
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
export function nextSeasonPlan(bundle, beds, seasons, priorOccupancy, site, year) {
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
            if (blocked || structureGate)
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
    return { year, beds: rows, excludedMap, arrangement, tier: r.tier.copy, refused: r.refused };
}
function nextPlanAnchorId() {
    const s = app.logSnapshot.seasons;
    return seasonId() ?? (s.length ? Math.max(...s.map((x) => x.id)) : null);
}
async function acceptNextSeasonDraft(year, bedName, guildId) {
    const db = app.logDb;
    const anchorId = nextPlanAnchorId();
    if (!db || anchorId == null)
        throw new Error("the garden log isn’t ready yet - try again in a moment");
    const season = await getSeason(db, app.currentPlotId, anchorId);
    if (!season)
        throw new Error("no season to plan from");
    const next = (Array.isArray(season.next_plan) ? season.next_plan : []);
    const kept = next.filter((e) => !(e.year === year && e.area === bedName));
    kept.push({ area: bedName, guild: guildId, year, saved: new Date().toISOString().slice(0, 10) });
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
export function openNextSeason() { nsOpen = true; }
export function renderNextSeason(bundle, site) {
    const box = $("nextseason");
    box.replaceChildren();
    const beds = app.logSnapshot.beds;
    const anchorId = nextPlanAnchorId();
    if (!beds.length || anchorId == null || !app.logDb)
        return;
    const year = anchorId + 1;
    if (!nsOpen) {
        const p = document.createElement("p");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "stepnext nsopen";
        b.textContent = `Plan next season (${year}) ›`;
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
    h.appendChild(document.createTextNode(`Next season (${year}): the `));
    h.appendChild(glossTerm("rotation", "rotation"));
    h.appendChild(document.createTextNode(" plan"));
    wrap.appendChild(h);
    const lead = document.createElement("p");
    lead.className = "hint ns-lead";
    lead.textContent = plan.refused
        ? "Too many beds to arrange automatically - each bed below still says what it can take."
        : "What each bed can take next year, from what grew on that ground, and the plot's own best arrangement across them. Accept a bed's team and it waits as a draft for next season - nothing is planted until you say so.";
    wrap.appendChild(lead);
    const name = (gid) => { const g = ab.guilds.find((x) => x.id === gid); return g ? displayName(g) : gid; };
    const fams = (list) => { const n = list.map((f) => familyName(f)); return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : (n[0] ?? ""); };
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
            to.textContent = ` + ${row.assigned.spans.join(" + ")} together → ${name(row.assigned.guild)}`;
        }
        else if (row.assigned) {
            to.textContent = ` → ${name(row.assigned.guild)}`;
        }
        else {
            to.textContent = row.eligible.length ? " → your choice" : " → rest it this year";
        }
        head.appendChild(to);
        el.appendChild(head);
        const why = document.createElement("p");
        why.className = "ns-why";
        const n = row.eligible.length;
        why.textContent = (row.held.length
            ? `${(() => { const f = fams(row.held); return f.charAt(0).toUpperCase() + f.slice(1); })()} grew here too recently to come back next year, so no team that brings them. `
            : "Nothing grew here recently that the rotation would hold - it's clear. ")
            + (n ? `${n} team${n === 1 ? "" : "s"} fit${n === 1 ? "s" : ""} this bed and the rotation.` : "No team fits this bed and the rotation - a break crop or a rest is the honest year.");
        if (row.held.length) {
            const heldFam = row.held[0];
            const rr = ab.rules.find((r) => {
                const t = r.trigger;
                return t?.kind === "rotation_interval" && t?.family === heldFam;
            });
            if (rr)
                mark(why, { kind: "rule", id: String(rr.id) }, { label: "Why the wait" });
        }
        el.appendChild(why);
        const openSeason = activeSeason();
        const draftHere = (openSeason?.plan ?? []).find((e) => e.area === row.name && typeof e.guild === "string");
        const bedRec = app.logSnapshot.beds.find((b) => b.name === row.name);
        const liveHere = !!bedRec && (openSeason?.plantings ?? []).some((p) => !p.end_cause && plantingOnBed(p.region, bedRec.region));
        if (draftHere && !liveHere) {
            const dn = document.createElement("p");
            dn.className = "hint ns-draftnote";
            dn.textContent = `${name(String(draftHere.guild))} is drafted here this year but not planted, so it doesn't count as history yet.`;
            el.appendChild(dn);
        }
        if (row.eligible.length || row.perennials.length) {
            const det = document.createElement("details");
            det.className = "ns-elig";
            const sum = document.createElement("summary");
            sum.textContent = `Teams this bed can take`;
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
                pp.textContent = `Perennial teams that would also fit - a choice for years, not a season, so not proposed here: ${row.perennials.map(name).join(", ")}.`;
                det.appendChild(pp);
            }
            el.appendChild(det);
        }
        if (row.assigned && row.assigned.spans.length) {
            const note = document.createElement("p");
            note.className = "hint";
            note.textContent = `One planting across ${[row.name, ...row.assigned.spans].join(" and ")} - merge those beds on the map first, then plan it as one bed.`;
            el.appendChild(note);
        }
        else if (row.assigned && row.eligible.includes(row.assigned.guild)) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ns-accept";
            const gid = row.assigned.guild;
            btn.textContent = nsAccepted.get(row.name) === gid ? `Accepted - a draft for ${year}` : `Accept ${name(gid)} for ${row.name}`;
            btn.disabled = nsAccepted.get(row.name) === gid;
            btn.addEventListener("click", () => void (async () => {
                btn.disabled = true;
                try {
                    await acceptNextSeasonDraft(year, row.name, gid);
                    btn.textContent = `Accepted - a draft for ${year}`;
                    toast(`Draft for ${year} saved: “${row.name}”`);
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
    const close = document.createElement("button");
    close.type = "button";
    close.className = "linky ns-close";
    close.textContent = "Close";
    close.addEventListener("click", () => { nsOpen = false; renderNextSeason(bundle, site); });
    wrap.appendChild(close);
    box.appendChild(wrap);
}
