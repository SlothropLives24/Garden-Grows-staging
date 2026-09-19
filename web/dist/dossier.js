import { resolveDossier } from "./engine/dossier.js";
import { formatValue } from "./engine/plantcard.js";
import { displayName } from "./engine/guilds.js";
import { confidenceBadge } from "./confidence.js";
import { citationLine, enforcementWords, evidenceLine, prose, readerProse, sourcesDisclosure } from "./citation.js";
import { el } from "./dom.js";
import { humanizeRuleRefs, stripRuleCitations } from "./engine/labels.js";
import { commonName, ruleClaim } from "./state.js";
let _bundle = null;
let _wired = false;
let _opener = null;
const _stack = [];
const sheet = () => document.getElementById("dossiersheet");
const sheetBody = () => document.getElementById("dossiersheetbody");
export function initDossier(bundle) {
    _bundle = bundle;
    if (_wired)
        return;
    _wired = true;
    document.getElementById("dossiersheetclose")?.addEventListener("click", closeDossier);
    document.getElementById("dossierscrim")?.addEventListener("click", closeDossier);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("dossier-open")) {
            e.preventDefault();
            closeDossier();
        }
    });
    document.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        const a = e.target?.closest?.("a[href]");
        if (!a)
            return;
        const m = /(?:^|\/)(guides|explainers)\/([a-z0-9-]+)\/?$/.exec(a.getAttribute("href") ?? "");
        if (!m)
            return;
        e.preventDefault();
        _stack.length = 0;
        _opener = a;
        openDossier({ kind: "page", id: `${m[1] === "guides" ? "guide" : "explainer"}/${m[2]}` });
    });
}
export function mark(host, atom, opts) {
    if (!atom?.id)
        return null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dossier-mark";
    b.textContent = `${opts?.label ?? "See the evidence"} →`;
    b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _opener = b;
        _stack.length = 0;
        openDossier(atom);
    });
    host.appendChild(b);
    return b;
}
export function markLink(a, atom) {
    if (!atom?.id || a.dataset.dossierWired === "1")
        return;
    a.dataset.dossierWired = "1";
    a.classList.add("dossier-marklink");
    a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        e.preventDefault();
        e.stopPropagation();
        _opener = a;
        _stack.length = 0;
        openDossier(atom);
    });
}
export function markControl(btn, atom) {
    if (!atom?.id || btn.dataset.dossierWired === "1")
        return;
    btn.dataset.dossierWired = "1";
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _opener = btn;
        _stack.length = 0;
        openDossier(atom);
    });
}
function openDossier(atom) {
    if (atom.kind === "page") {
        void openPage(atom);
        return;
    }
    const s = sheet();
    const body = sheetBody();
    if (!s || !body || !_bundle)
        return;
    const rec = resolveDossier(atom.kind, atom.id, _bundle, atom.field, atom.group);
    if (!rec)
        return;
    if (_stack[_stack.length - 1]?.id !== atom.id)
        _stack.push(atom);
    body.replaceChildren();
    renderDossier(rec, body);
    if (!document.body.classList.contains("dossier-open")) {
        document.body.classList.add("dossier-open");
        s.hidden = false;
    }
    document.getElementById("dossiersheetclose")?.focus();
}
function closeDossier() {
    const s = sheet();
    if (!s)
        return;
    document.body.classList.remove("dossier-open");
    s.hidden = true;
    _stack.length = 0;
    const back = _opener;
    _opener = null;
    back?.focus();
}
const PAGES_BASE = "../build/pages/";
const _pageCache = new Map();
async function fetchPage(id) {
    const hit = _pageCache.get(id);
    if (hit !== undefined)
        return hit;
    let html = null;
    try {
        const res = await fetch(`${PAGES_BASE}${id}.html`);
        if (res.ok)
            html = await res.text();
    }
    catch { }
    _pageCache.set(id, html);
    return html;
}
async function openPage(atom) {
    const s = sheet();
    const body = sheetBody();
    if (!s || !body)
        return;
    const isExpl = atom.id.startsWith("explainer/");
    if (_stack[_stack.length - 1]?.id !== atom.id)
        _stack.push(atom);
    body.replaceChildren();
    drawBack(body);
    el(body, "p", "dossier-kicker", isExpl ? "From the explainers" : "From the guides");
    el(body, "p", "dossier-page-loading", isExpl ? "Opening the explainer…" : "Opening the guide…");
    if (!document.body.classList.contains("dossier-open")) {
        document.body.classList.add("dossier-open");
        s.hidden = false;
    }
    document.getElementById("dossiersheetclose")?.focus();
    const html = await fetchPage(atom.id);
    if (_stack[_stack.length - 1]?.id !== atom.id)
        return;
    body.replaceChildren();
    drawBack(body);
    renderPageDossier(html, atom.id, body);
}
function renderPageDossier(html, id, body) {
    const isExpl = id.startsWith("explainer/");
    el(body, "p", "dossier-kicker", isExpl ? "From the explainers" : "From the guides");
    if (html == null) {
        el(body, "p", null, `This ${isExpl ? "explainer" : "guide"} could not be loaded here - open it as a page instead.`);
        return;
    }
    const art = document.createElement("div");
    art.className = "dossier-page";
    art.innerHTML = html;
    body.appendChild(art);
    wireCites(art);
}
function wireCite(a, atom) {
    if (!atom.id || a.dataset.dossierWired === "1")
        return;
    a.dataset.dossierWired = "1";
    a.classList.add("dossier-marklink");
    a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        e.preventDefault();
        e.stopPropagation();
        openDossier(atom);
    });
}
function wireCites(root) {
    for (const a of root.querySelectorAll('a[href*="#/why?rule="]')) {
        const m = /#\/why\?rule=(R-\d+)/.exec(a.getAttribute("href") ?? "");
        if (m)
            wireCite(a, { kind: "rule", id: m[1] });
    }
    for (const a of root.querySelectorAll('a[href*="#/why?belief="]')) {
        const m = /#\/why\?belief=(B-\d+)/.exec(a.getAttribute("href") ?? "");
        if (m)
            wireCite(a, { kind: "belief", id: m[1] });
    }
}
function isFieldDossier(r) { return r.kind === "species-field"; }
function isBeliefDossier(r) { return r.kind === "belief"; }
function isTeamDossier(r) { return r.kind === "team"; }
function drawBack(body) {
    if (_stack.length <= 1)
        return;
    const back = el(body, "button", "dossier-back", "‹ Back");
    back.type = "button";
    back.addEventListener("click", (e) => { e.preventDefault(); goBack(); });
}
function goBack() {
    const body = sheetBody();
    if (!body || _stack.length <= 1)
        return;
    _stack.pop();
    const prev = _stack[_stack.length - 1];
    if (prev.kind === "page") {
        body.replaceChildren();
        drawBack(body);
        renderPageDossier(_pageCache.get(prev.id) ?? null, prev.id, body);
        document.getElementById("dossiersheetclose")?.focus();
        return;
    }
    if (!_bundle)
        return;
    const rec = resolveDossier(prev.kind, prev.id, _bundle, prev.field, prev.group);
    body.replaceChildren();
    if (rec)
        renderDossier(rec, body);
    document.getElementById("dossiersheetclose")?.focus();
}
const sep = (p) => { p.appendChild(document.createTextNode(" · ")); };
function inSheetDoor(parent, label, atom, href) {
    const a = el(parent, "a", "dossier-edge", label);
    a.href = href;
    a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        e.preventDefault();
        e.stopPropagation();
        openDossier(atom);
    });
}
function plantOut(parent, sid) {
    const a = el(parent, "a", "pname dossier-edge", commonName(_bundle, sid));
    a.href = `#/plant?id=${encodeURIComponent(sid)}`;
}
const ruleLabel = (rid) => prose(stripRuleCitations(ruleClaim(_bundle, rid)));
function beliefLabel(bid) {
    const b = (_bundle.beliefs ?? []).find((x) => String(x.id) === bid);
    return prose(String(b?.belief ?? bid));
}
function ruleSpecies(rid) {
    const rule = _bundle.rules.find((x) => x.id === rid);
    if (!rule)
        return [];
    const at = rule.applies_to;
    const trig = rule.trigger;
    const ids = new Set();
    const add = (v) => { if (Array.isArray(v))
        v.forEach((x) => ids.add(String(x)));
    else if (typeof v === "string")
        ids.add(v); };
    add(at?.species);
    add(trig?.species);
    const fam = (at?.family ?? trig?.family);
    if (fam)
        for (const s of _bundle.species)
            if (String(s.family) === fam)
                ids.add(s.id);
    return [...ids].filter((id) => _bundle.species.some((s) => s.id === id)).slice(0, 8);
}
function guildsResting(rid) {
    return _bundle.guilds.filter((g) => {
        const mechs = g.mechanisms ?? [];
        const gates = (g.gates ?? []).map(String);
        const fr = g.footprint_reason;
        return mechs.some((m) => m.rule === rid) || gates.includes(rid) || (typeof fr === "string" && fr.startsWith(rid));
    }).map((g) => ({ id: String(g.id), name: displayName(g) }));
}
const beliefsAnswering = (rid) => (_bundle.beliefs ?? []).filter((b) => (b.see_also ?? []).map(String).includes(rid))
    .map((b) => ({ id: String(b.id) }));
function edgesFoot(rec, body) {
    if (!_bundle)
        return;
    const lines = [];
    if (isTeamDossier(rec)) {
        const t = rec;
        if (t.edges.rules.length)
            lines.push({ label: "The rules it rests on", build: (p) => t.edges.rules.forEach((rid, i) => { if (i)
                    sep(p); inSheetDoor(p, ruleLabel(rid), { kind: "rule", id: rid }, `#/why?rule=${rid}`); }) });
        if (t.edges.beliefs.length)
            lines.push({ label: "A folk belief it answers", build: (p) => t.edges.beliefs.forEach((bid, i) => { if (i)
                    sep(p); inSheetDoor(p, beliefLabel(bid), { kind: "belief", id: bid }, "#/why"); }) });
        const plants = t.roles.map((r) => r.canonical).filter((x) => !!x);
        if (plants.length)
            lines.push({ label: "Its plants", build: (p) => plants.forEach((sid, i) => { if (i)
                    sep(p); plantOut(p, sid); }) });
    }
    else if (isFieldDossier(rec)) {
        const sid = rec.species;
        lines.push({ label: "This plant's card", build: (p) => plantOut(p, sid) });
    }
    else if (!isBeliefDossier(rec)) {
        const rid = rec.id;
        const plants = ruleSpecies(rid);
        const teams = guildsResting(rid);
        const beliefs = beliefsAnswering(rid);
        if (plants.length)
            lines.push({ label: "Plants this fires on", build: (p) => plants.forEach((sid, i) => { if (i)
                    sep(p); plantOut(p, sid); }) });
        if (teams.length)
            lines.push({ label: "Teams that rest on it", build: (p) => teams.forEach((t, i) => { if (i)
                    sep(p); inSheetDoor(p, t.name, { kind: "team", id: t.id }, `#/plan?guild=${t.id}`); }) });
        if (beliefs.length)
            lines.push({ label: "A folk belief it answers", build: (p) => beliefs.forEach((b, i) => { if (i)
                    sep(p); inSheetDoor(p, beliefLabel(b.id), { kind: "belief", id: b.id }, "#/why"); }) });
    }
    if (!lines.length)
        return;
    el(body, "p", "dossier-srch", "Where this leads");
    for (const ln of lines) {
        const p = el(body, "p", "dossier-edges");
        p.appendChild(document.createTextNode(`${ln.label}: `));
        ln.build(p);
    }
}
function renderDossier(rec, body) {
    drawBack(body);
    if (isFieldDossier(rec)) {
        renderFieldDossier(rec, body);
        edgesFoot(rec, body);
        return;
    }
    if (isBeliefDossier(rec)) {
        renderBeliefDossier(rec, body);
        return;
    }
    if (isTeamDossier(rec)) {
        renderTeamDossier(rec, body);
        edgesFoot(rec, body);
        return;
    }
    el(body, "p", "dossier-kicker", "The evidence");
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", prose(rec.claim));
    const badge = confidenceBadge(rec.grade ?? "");
    if (badge)
        head.appendChild(badge);
    const line = enforcementWords(rec.severity ?? "", rec.ruling ?? "");
    if (line)
        el(head, "p", "dossier-enforce", line);
    if (rec.mechanism)
        el(body, "p", "dossier-mech", `Mechanism: ${prose(rec.mechanism.trim())}`);
    const whatIsTrue = readerProse(rec.what_is_true);
    if (whatIsTrue)
        el(body, "p", null, `What is actually known: ${prose(whatIsTrue)}`);
    if (rec.effect_size)
        el(body, "p", "howmuch", `How much it matters: ${humanizeRuleRefs(prose(rec.effect_size.trim()))}`);
    const scope = readerProse(rec.scope_note);
    if (scope)
        el(body, "p", "stops", `Where this stops: ${humanizeRuleRefs(prose(scope))}`);
    const status = rec.evidence.status ?? "";
    const pointers = rec.evidence.pointers.filter((p) => p.trim());
    const { cls, text } = evidenceLine(status, pointers);
    el(body, "p", cls, text);
    sourcesDisclosure(status, pointers, body);
    if (rec.response)
        el(body, "p", null, prose(rec.response.trim()));
    if (rec.remedy)
        el(body, "p", "whatfix", `What to do: ${prose(rec.remedy.trim())}`);
    edgesFoot(rec, body);
    const ruleRec = _bundle?.rules.find((x) => x.id === rec.id);
    const slug = typeof ruleRec?.page_slug === "string" ? ruleRec.page_slug : "";
    if (slug) {
        const more = el(body, "p", "more");
        const a = el(more, "a", null, "Read the full rule");
        a.href = `../rules/${slug}/`;
    }
}
function renderFieldDossier(rec, body) {
    el(body, "p", "dossier-kicker", "Where this number comes from");
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", rec.label);
    const shim = { value: rec.value, unit: rec.unit };
    el(head, "p", "dossier-fieldval", formatValue(shim));
    if (rec.tier === "contested") {
        el(body, "p", "dossier-tier", "Contested: the sources we have read disagree on this number, so it is a lean, not a measurement.");
    }
    else if (rec.tier === "estimated") {
        el(body, "p", "dossier-tier", "An estimate: no source we have read gives this number for this plant, so it is our best figure from what we know - not a measurement.");
    }
    const shown = rec.sources.map((p) => readerProse(p)).filter((p) => !!p);
    if (shown.length) {
        el(body, "p", "dossier-srch", shown.length === 1 ? "The source we read" : "The sources we read");
        for (const p of shown)
            citationLine(p, body);
    }
    else if (!rec.tier) {
        el(body, "p", "dossier-tier", "We have no public source to point you to for this number yet.");
    }
}
function renderBeliefDossier(rec, body) {
    el(body, "p", "dossier-kicker", "Folklore, checked");
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", prose(rec.claim));
    const badge = confidenceBadge(rec.grade ?? "");
    if (badge)
        head.appendChild(badge);
    if (rec.response)
        el(body, "p", null, prose(rec.response.trim()));
    if (rec.see_also.length) {
        const p = el(body, "p", "defend", "What we can actually defend: ");
        rec.see_also.forEach((id, i) => {
            if (i)
                p.appendChild(document.createTextNode(" · "));
            const a = document.createElement("a");
            a.className = "whytap defend-link";
            a.href = `#/why?rule=${id}`;
            a.textContent = prose(stripRuleCitations(ruleClaim(_bundle, id)));
            markLink(a, { kind: "rule", id });
            p.appendChild(a);
        });
    }
    const whatIsTrue = readerProse(rec.what_is_true);
    if (whatIsTrue)
        el(body, "p", null, `What is actually known: ${prose(whatIsTrue)}`);
    const status = rec.evidence.status ?? "";
    const pointers = rec.evidence.pointers.filter((p) => p.trim());
    sourcesDisclosure(status, pointers, body);
}
function renderTeamDossier(rec, body) {
    el(body, "p", "dossier-kicker", "The plant team");
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", displayName({ common: rec.common, id: rec.id ?? "" }));
    const prov = readerProse(rec.provenance);
    if (prov)
        el(body, "p", null, `Where it comes from: ${prose(prov)}`);
    if (rec.honestyNote)
        el(body, "p", "stops", prose(rec.honestyNote.trim()));
    if (rec.mechanisms.length) {
        el(body, "p", "dossier-srch", "How it works");
        for (const m of rec.mechanisms) {
            const p = el(body, "p", "team-mech");
            p.appendChild(document.createTextNode(prose(m.claim)));
            const badge = confidenceBadge(m.grade ?? "");
            if (badge)
                p.appendChild(badge);
            if (m.rule) {
                p.appendChild(document.createTextNode(" "));
                const a = el(p, "a", "whytap team-ruledoor", "why this holds");
                a.href = `#/why?rule=${m.rule}`;
                markLink(a, { kind: "rule", id: m.rule });
            }
        }
    }
    const swaps = rec.roles.filter((r) => r.alternativeCost);
    if (swaps.length) {
        el(body, "p", "dossier-srch", "Swapping a plant");
        for (const r of swaps)
            el(body, "p", "team-swap", prose(r.alternativeCost.trim()));
    }
    const src = readerProse(rec.plantingSource);
    if (src) {
        el(body, "p", "dossier-srch", "The planting method we follow");
        citationLine(src, body);
    }
}
