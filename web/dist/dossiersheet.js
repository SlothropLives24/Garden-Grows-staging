import './chunk-lutet8cz.js';
import { cardRows, formatValue } from './chunk-h8sxf1mq.js';
import { CONFIDENCE, stripRuleCitations, humanizeFamilies, ENFORCEMENT_CONCERN, ENFORCEMENT_COST, ENFORCEMENT_DOES, humanizeRuleRefs, MAINTAINER_MARKER_PATTERN, copy, plainClaim, appLang, esTwin, fillNodes, labelCopy } from './paint.js';
import { el, refutationVerdict, dossierState, showSheet, corpusEs, corpusWantsEs, gardenLat, guideBySlug, ruleStanding, displayName, confidenceBadge, markLink, ruleClaim, commonName } from './core.js';
import { provenanceReady, ensureProvenance } from './chunk-nlhi0qk9.js';
import './chunk-l5cseoso.js';

function gradeWord(grade) {
    return CONFIDENCE[(grade ?? "").trim().toUpperCase()]?.word ?? null;
}
const s = (v) => (v == null ? null : String(v));
const nn = (v) => (v ? String(v) : null);
const PROV_BOOKKEEPING = /\bO\d{2,3}\b|\bD-\d+\b|\badopted\b|docs\/|PROPOSAL|\bteam \d+\b|\b(?:read|fetched)\b|\d{4}-\d{2}-\d{2}/i;
const PROV_NOTE_SENTENCE = /^Do not\b|\bruling\b|\barc\b|\bprovenance\b|\b[a-z]+_[a-z_]+\b|\d{4}-\d{2}-\d{2}|role-based|\bNOT\b/;
const PROV_WORDS = [
    [/\bA derived composition\b/g, "A new combination"], [/\bfruit-tree guild\b/g, "fruit tree team"],
    [/\bguild\b/g, "plant team"], [/\bthe corpus's own\b/g, "Milpa's own"], [/\brole structure\b/g, "layout"]
];
function readerProvenance(v) {
    let text = String(v ?? "").split(/\s+/).filter(Boolean).join(" ");
    if (!text)
        return "";
    text = text.replace(/\s*\(([^()]*)\)/g, (_m, inner) => {
        const keep = [];
        for (const part of inner.split(";")) {
            const bits = (PROV_BOOKKEEPING.test(part) ? part.split(",").map((b) => b.trim()) : [part.trim()])
                .filter((b) => b && !PROV_BOOKKEEPING.test(b));
            if (bits.length)
                keep.push(bits.join(", "));
        }
        return keep.length ? ` (${keep.join("; ")})` : "";
    });
    text = text.replace(/,\s*(?:and\s+)?(?:read|fetched)\b[^.;:]*?\d{4}-\d{2}-\d{2}/g, "");
    let out = text.split(/(?<=[.!?])\s+/).filter((x) => x && !PROV_NOTE_SENTENCE.test(x)).join(" ");
    for (const [pat, word] of PROV_WORDS)
        out = out.replace(pat, word);
    out = out.replace(/\s+([,.:;])/g, "$1").trim();
    return /[A-Za-z]{3}/.test(out) ? out : "";
}
function teamDossier(g) {
    const mech = (m) => {
        const grade = (String(m.grade ?? "").trim().toUpperCase()) || null;
        return { claim: m.claim || "", grade, gradeWord: gradeWord(grade), rule: nn(m.rule), role: nn(m.role) };
    };
    const role = (r) => ({
        id: s(r.id), canonical: nn(r.canonical), canonicalGroup: nn(r.canonical_group),
        alternative: nn(r.alternative), alternatives: (r.alternatives ?? []).slice(),
        alternativeCost: nn(r.alternative_cost), costTags: (r.cost_tags ?? []).map(String),
    });
    const mechs = (g.mechanisms ?? []).map(mech);
    const roles = (g.roles ?? []).map(role);
    const fr = g.footprint_reason;
    const beliefs = (g.surfaces_beliefs ?? []).map(String);
    const ordered = [];
    for (const m of mechs)
        if (m.rule)
            ordered.push(m.rule);
    for (const gt of (g.gates ?? []))
        ordered.push(String(gt));
    if (typeof fr === "string" && /^R-\d/.test(fr))
        ordered.push(fr);
    const seen = new Set();
    const ruleEdges = ordered.filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
    return {
        kind: "team",
        id: s(g.id),
        common: (g.common ?? []).map(String),
        guildClass: nn(g.guild_class),
        provenance: nn(g.provenance),
        honestyNote: nn(g.honesty_note),
        plantingSource: nn(g.planting_source),
        derivedFrom: nn(g.derived_from),
        footprintMinM2: g.footprint_min_m2 ?? null,
        footprintReason: typeof fr === "string" ? fr : null,
        mechanisms: mechs,
        roles,
        edges: { rules: ruleEdges, beliefs },
    };
}
function beliefDossier(b) {
    const ev = b.evidence ?? {};
    const grade = (String(b.grade ?? "").trim().toUpperCase()) || null;
    const threads = (b.see_also ?? []).map(String).filter((x) => x.startsWith("R-"));
    return {
        kind: "belief",
        id: String(b.id ?? ""),
        claim: b.belief || String(b.id ?? "") || "",
        grade,
        gradeWord: gradeWord(grade),
        response: s(b.response),
        what_is_true: s(b.what_is_true),
        see_also: threads,
        evidence: { status: s(ev.status), pointers: (ev.pointers ?? []).map(String) },
    };
}
function ruleDossier(r) {
    const ev = r.evidence ?? {};
    const grade = (String(r.grade ?? "").trim().toUpperCase()) || null;
    return {
        kind: "rule",
        id: r.id,
        claim: r.claim || r.claim_refuted || "",
        grade,
        gradeWord: gradeWord(grade),
        severity: s(r.severity),
        ruling: s(r.ruling),
        mechanism: s(r.mechanism),
        what_is_true: s(r.what_is_true),
        scope_note: s(r.scope_note),
        effect_size: s(r.effect_size),
        response: r.audience !== "engine" ? s(r.response) : null,
        remedy: s(r.remedy),
        evidence: { status: s(ev.status), pointers: (ev.pointers ?? []).map(String) },
    };
}
function speciesFieldDossier(speciesId, field, group, bundle) {
    const sp = bundle.species.find((x) => x.id === speciesId);
    if (!sp)
        return null;
    if (group) {
        const groups = sp.cultivar_groups ?? [];
        if (!groups.some((x) => x.id === group))
            return null;
    }
    const row = cardRows(sp, group).find((r) => r.key === field);
    if (!row)
        return null;
    return {
        kind: "species-field",
        id: speciesId,
        species: speciesId,
        group: group || null,
        field,
        label: row.label,
        unit: row.unit,
        value: row.value,
        valueKind: row.kind,
        tier: row.soft,
        sources: [...row.sources],
    };
}
function resolveDossier(kind, id, bundle, field, group) {
    if (kind === "rule") {
        const r = bundle.rules.find((x) => x.id === id);
        return r ? ruleDossier(r) : null;
    }
    if (kind === "belief") {
        const b = (bundle.beliefs ?? []).find((x) => String(x.id) === id);
        return b ? beliefDossier(b) : null;
    }
    if (kind === "team") {
        const g = (bundle.guilds ?? []).find((x) => x.id === id);
        return g ? teamDossier(g) : null;
    }
    if (kind === "species" && field) {
        return speciesFieldDossier(id, field, group ?? null, bundle);
    }
    return null;
}

const MAINTAINER_MARKER = new RegExp(MAINTAINER_MARKER_PATTERN, "i");
function prose(text) {
    return stripRuleCitations(humanizeFamilies(text));
}
function readerProse(v) {
    const t = String(v ?? "").trim();
    if (!t)
        return null;
    return MAINTAINER_MARKER.test(t) ? null : t;
}
const SOURCE_URL = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:edu|org|gov|com|net|io|uk)(?:\/[^\s,;"')\]]*)?/i;
function citationLine(pointer, parent) {
    const text = humanizeRuleRefs(stripRuleCitations(pointer));
    const p = el(parent, "p", "prov");
    const m = SOURCE_URL.exec(text);
    if (!m) {
        p.textContent = text;
        return;
    }
    const url = m[0].replace(/[.,;:'")\]]+$/, "");
    p.appendChild(document.createTextNode(text.slice(0, m.index)));
    const a = document.createElement("a");
    a.href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    a.textContent = url;
    a.rel = "noreferrer";
    a.target = "_blank";
    p.appendChild(a);
    p.appendChild(document.createTextNode(text.slice(m.index + url.length)));
}
function enforcementWords(severity, ruling, concern = "") {
    const parts = [ENFORCEMENT_CONCERN[concern] ?? ENFORCEMENT_COST[severity], ENFORCEMENT_DOES[ruling]].filter((x) => !!x);
    return parts.join(" · ");
}

function enhanceFolds(root) {
    for (const set of root.querySelectorAll("[data-foldset]:not(.fold-live)")) {
        for (const span of set.querySelectorAll(".fold-to")) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "chip fold-chip";
            b.setAttribute("aria-pressed", "false");
            b.dataset.foldTo = span.dataset.foldTo ?? "";
            b.textContent = span.textContent;
            span.replaceWith(b);
            b.addEventListener("click", () => {
                const on = b.getAttribute("aria-pressed") !== "true";
                for (const x of set.querySelectorAll(".fold-chip"))
                    x.setAttribute("aria-pressed", String(on && x === b));
                for (const g of set.querySelectorAll("[data-fold]")) {
                    const mine = g.dataset.fold === b.dataset.foldTo;
                    g.hidden = on && !mine;
                    const d = g.querySelector("details");
                    if (d)
                        d.open = on && mine;
                }
            });
        }
        set.classList.add("fold-live");
    }
}

const _stack = dossierState.stack;
const sheet = () => document.getElementById("dossiersheet");
const walkScroll = new WeakMap();
function pushWalk(atom) {
    const top = _stack[_stack.length - 1];
    if (top?.id === atom.id)
        return;
    const s = sheet();
    if (top)
        walkScroll.set(top, s?.scrollTop ?? 0);
    _stack.push(atom);
    if (s)
        s.scrollTop = 0;
}
function restoreWalkScroll(step) {
    const s = sheet();
    if (s)
        s.scrollTop = walkScroll.get(step) ?? 0;
}
const sheetBody = () => document.getElementById("dossiersheetbody");
function sheetTitle(text) {
    const t = document.getElementById("dossiersheet-h");
    if (t)
        t.textContent = text;
}
function openDossier(atom) {
    if (atom.kind === "page") {
        void openPage(atom);
        return;
    }
    if (atom.kind === "rule" || atom.kind === "belief") {
        void openPiece(atom);
        return;
    }
    const s = sheet();
    const body = sheetBody();
    const bundle = dossierState.bundle;
    if (!s || !body || !bundle)
        return;
    if (atom.kind === "species" && !provenanceReady(bundle)) {
        void openSourced(atom);
        return;
    }
    const rec = resolveDossier(atom.kind, atom.id, bundle, atom.field, atom.group);
    if (!rec)
        return;
    pushWalk(atom);
    body.replaceChildren();
    renderDossier(rec, body);
    showSheet();
}
async function openSourced(atom) {
    const s = sheet();
    const body = sheetBody();
    const bundle = dossierState.bundle;
    if (!s || !body || !bundle)
        return;
    pushWalk(atom);
    body.replaceChildren();
    drawBack(body);
    el(body, "p", "dossier-page-loading", copy.dsOpeningSources);
    showSheet();
    await ensureProvenance(bundle);
    const top = _stack[_stack.length - 1];
    if (!top || top.id !== atom.id || top.field !== atom.field || !document.body.classList.contains("dossier-open"))
        return;
    const rec = resolveDossier(atom.kind, atom.id, bundle, atom.field, atom.group);
    body.replaceChildren();
    if (rec)
        renderDossier(rec, body);
}
const PAGES_BASE = "../build/pages/";
const READER_CSS = "../build/pages-reader.css";
function ensureReaderCss() {
    if (typeof document === "undefined")
        return;
    if (document.getElementById("dossier-page-css"))
        return;
    const link = document.createElement("link");
    link.id = "dossier-page-css";
    link.rel = "stylesheet";
    link.href = READER_CSS;
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
const _pageCache = new Map();
async function fetchPage(id) {
    const hit = _pageCache.get(id);
    if (hit !== undefined)
        return hit;
    let html = null;
    const page = `${id.replace("/", "s/")}/`;
    for (const path of esTwin(page) ? [`es/${id}`, id] : [id]) {
        try {
            const res = await fetch(`${PAGES_BASE}${path}.html`);
            if (res.ok) {
                html = await res.text();
                if (path === id && appLang() === "es")
                    _pageEn.add(id);
                break;
            }
        }
        catch { }
    }
    _pageCache.set(id, html);
    return html;
}
const _pageEn = new Set();
async function openPage(atom) {
    const s = sheet();
    const body = sheetBody();
    if (!s || !body)
        return;
    ensureReaderCss();
    const isExpl = atom.id.startsWith("explainer/");
    pushWalk(atom);
    body.replaceChildren();
    drawBack(body);
    sheetTitle(isExpl ? copy.dsFromExplainers : copy.dsFromGuides);
    el(body, "p", "dossier-page-loading", isExpl ? copy.dsOpeningExplainer : copy.dsOpeningGuide);
    showSheet();
    const html = await fetchPage(atom.id);
    if (_stack[_stack.length - 1]?.id !== atom.id)
        return;
    body.replaceChildren();
    drawBack(body);
    renderPageDossier(html, atom.id, body);
}
const EVIDENCE_URL = appLang() === "es" ? "../build/pages/evidence-es.json" : "../build/pages/evidence.json";
let _evidence = null;
let _evidenceLoading = null;
function loadEvidence() {
    if (_evidence)
        return Promise.resolve(_evidence);
    if (!_evidenceLoading) {
        _evidenceLoading = fetch(EVIDENCE_URL)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
            .then((m) => { _evidence = m; _evidenceLoading = null; return m; });
    }
    return _evidenceLoading;
}
const pieceKey = (atom) => `${atom.kind}/${atom.id}`;
const pieceKicker = (atom) => (atom.kind === "rule" ? copy.dsTheEvidence : copy.dsFolklore);
async function openPiece(atom) {
    const s = sheet();
    const body = sheetBody();
    if (!s || !body)
        return;
    if (_evidence && !(pieceKey(atom) in _evidence))
        return;
    ensureReaderCss();
    pushWalk(atom);
    body.replaceChildren();
    if (_evidence)
        renderPiece(atom, _evidence[pieceKey(atom)] ?? null, body);
    else {
        drawBack(body);
        sheetTitle(pieceKicker(atom));
        el(body, "p", "dossier-page-loading", copy.dsOpeningEvidence);
    }
    showSheet();
    if (_evidence)
        return;
    const m = await loadEvidence();
    if (_stack[_stack.length - 1]?.id !== atom.id)
        return;
    body.replaceChildren();
    renderPiece(atom, m?.[pieceKey(atom)] ?? null, body);
}
function renderPiece(atom, html, body) {
    drawBack(body);
    sheetTitle(pieceKicker(atom));
    const ruleRec = atom.kind === "rule" ? dossierState.bundle?.rules.find((x) => x.id === atom.id) : undefined;
    const slug = typeof ruleRec?.page_slug === "string" ? ruleRec.page_slug : "";
    if (html == null) {
        const p = el(body, "p", null);
        if (slug) {
            const a = document.createElement("a");
            a.textContent = copy.dsOpenAsPage;
            a.href = `../rules/${slug}/`;
            fillNodes(p, atom.kind === "rule" ? copy.dsRuleNotLoadedLink : copy.dsClaimNotLoadedLink, { link: a });
        }
        else {
            p.textContent = atom.kind === "rule" ? copy.dsRuleNotLoaded : copy.dsClaimNotLoaded;
        }
        return;
    }
    body.appendChild(pieceArticle(html));
    if (slug) {
        const more = el(body, "p", "more");
        const a = el(more, "a", null, copy.dsReadFullRule);
        a.href = `../rules/${slug}/`;
    }
}
function pieceArticle(html) {
    const art = document.createElement("div");
    art.className = "dossier-page dossier-evidence";
    art.innerHTML = html;
    const lat = gardenLat();
    if (typeof lat === "number" && lat < 0) {
        for (const h of art.querySelectorAll("[data-south]"))
            h.textContent = h.dataset.south ?? h.textContent;
    }
    wireAtoms(art);
    enhanceFolds(art);
    return art;
}
function drawEvidence(host, atom) {
    ensureReaderCss();
    const paint = (m) => {
        host.replaceChildren();
        const html = m?.[pieceKey(atom)] ?? null;
        if (html == null) {
            el(host, "p", "hint", atom.kind === "rule" ? copy.dsRuleNotLoaded : copy.dsClaimNotLoaded);
            return;
        }
        const art = pieceArticle(html);
        for (const h of [...art.querySelectorAll("h2, h1")]) {
            const to = document.createElement(h.tagName === "H1" ? "h2" : "h3");
            for (const at of [...h.attributes])
                to.setAttribute(at.name, at.value);
            to.append(...h.childNodes);
            h.replaceWith(to);
        }
        host.appendChild(art);
        const rec = atom.kind === "rule" ? dossierState.bundle?.rules.find((x) => x.id === atom.id) : undefined;
        if (typeof rec?.page_slug === "string" && rec.page_slug) {
            const a = el(el(host, "p", "more"), "a", null, copy.dsReadFullRule);
            a.href = `../rules/${rec.page_slug}/`;
        }
    };
    if (_evidence) {
        paint(_evidence);
        return;
    }
    host.replaceChildren();
    el(host, "p", "dossier-page-loading", copy.dsOpeningEvidence);
    void loadEvidence().then((m) => { if (host.isConnected)
        paint(m); });
}
function wireAtoms(root) {
    for (const a of root.querySelectorAll("a[data-atom]")) {
        const [kind, id] = (a.dataset.atom ?? "").split(":");
        if (!id)
            continue;
        a.classList.add("dossier-edge");
        if (kind === "species") {
            a.href = `#/plant?id=${encodeURIComponent(id)}`;
            a.classList.add("pname");
            continue;
        }
        if (kind === "team")
            a.href = `#/plan?guild=${encodeURIComponent(id)}`;
        else if (kind === "rule")
            a.href = `#/why?rule=${encodeURIComponent(id)}`;
        else if (kind === "belief")
            a.href = `#/why?belief=${encodeURIComponent(id)}`;
        else
            continue;
        wireCite(a, { kind: kind, id });
    }
}
function renderPageDossier(html, id, body) {
    const isExpl = id.startsWith("explainer/");
    sheetTitle(isExpl ? copy.dsFromExplainers : copy.dsFromGuides);
    if (html == null) {
        el(body, "p", null, isExpl ? copy.dsExplainerNotLoaded : copy.dsGuideNotLoaded);
        return;
    }
    const art = document.createElement("div");
    art.className = "dossier-page";
    art.dataset.reader = id;
    if (_pageEn.has(id))
        art.lang = "en";
    art.innerHTML = html;
    body.appendChild(art);
    wireCites(art);
    const next = onwardEdges(id);
    if (next)
        body.appendChild(next);
    readerGarden(id);
}
const STRIP_H = 64;
let _gardenKey = "";
let _gardenSig = "";
let _gardenWired = false;
let _gardenFrame = 0;
let _silo = null;
function readerGarden(id) {
    _gardenKey = id;
    if (_silo) {
        scheduleGarden();
        return;
    }
    import('./silhouettes.js').then((m) => { _silo = m; scheduleGarden(); }).catch(() => { });
    if (_gardenWired)
        return;
    _gardenWired = true;
    const doc = document.querySelector("#dossiersheet .dossiersheet-doc");
    if (doc && typeof ResizeObserver !== "undefined")
        new ResizeObserver(scheduleGarden).observe(doc);
    window.addEventListener("resize", scheduleGarden);
}
function scheduleGarden() {
    if (_gardenFrame)
        return;
    _gardenFrame = requestAnimationFrame(() => { _gardenFrame = 0; drawGarden(); });
}
function drawGarden() {
    const s = sheet();
    const doc = s?.querySelector(".dossiersheet-doc");
    const S = _silo;
    if (!s || !doc || !S || s.hidden || !doc.querySelector(`.dossier-page[data-reader="${_gardenKey}"]`))
        return;
    let host = s.querySelector(":scope > .ds-garden");
    if (!host) {
        host = document.createElement("div");
        host.className = "ds-garden";
        host.setAttribute("aria-hidden", "true");
        s.insertBefore(host, doc);
    }
    const width = s.clientWidth;
    const sr = s.getBoundingClientRect(), dr = doc.getBoundingClientRect();
    const colLeft = Math.round(dr.left - sr.left), colRight = Math.round(dr.right - sr.left);
    if (!S.hasMargins(width, colLeft, colRight)) {
        const sig = `s|${_gardenKey}|${width}`;
        if (sig === _gardenSig && host.dataset.mode === "strip")
            return;
        host.dataset.mode = "strip";
        host.style.height = host.style.width = "";
        host.innerHTML = S.stripComposition(_gardenKey, host.clientWidth || width, STRIP_H);
        _gardenSig = sig;
        return;
    }
    host.dataset.mode = "margin";
    host.style.height = "0px";
    const hpx = s.scrollHeight;
    const bar = s.querySelector(".dossiersheet-bar");
    const top = (bar?.offsetHeight ?? 0) + 16;
    const sig = `m|${_gardenKey}|${width}|${colLeft}|${colRight}|${hpx}`;
    host.style.width = `${width}px`;
    host.style.height = `${hpx}px`;
    if (sig === _gardenSig)
        return;
    const room = width - colRight - 32;
    host.innerHTML = room >= 120 ? S.plateMarkup(_gardenKey) : "";
    const plate = host.querySelector("svg.plate-mark");
    let plateBottom = 0, plateLeft = width;
    if (plate) {
        plate.style.width = `${Math.min(272, room)}px`;
        plate.style.top = `${top}px`;
        const pr = plate.getBoundingClientRect(), hr = host.getBoundingClientRect();
        plateBottom = Math.round(pr.bottom - hr.top);
        plateLeft = Math.round(pr.left - hr.left);
    }
    host.insertAdjacentHTML("afterbegin", S.marginComposition(_gardenKey, hpx, { width, colLeft, colRight, top, plateBottom, plateLeft }));
    _gardenSig = sig;
}
function onwardEdges(id) {
    if (!id.startsWith("guide/"))
        return null;
    const here = guideBySlug(id.slice("guide/".length));
    const next = (here?.related ?? [])
        .map((slug) => guideBySlug(slug))
        .filter((e) => !!e);
    if (!next.length)
        return null;
    const wrap = document.createElement("nav");
    wrap.className = "dossier-onward";
    el(wrap, "p", "dossier-onward-h", copy.dsKeepGoing);
    const ul = document.createElement("ul");
    for (const e of next) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "dossier-onward-a";
        a.href = `../guides/${e.slug}/`;
        a.dataset.guide = e.slug;
        a.textContent = e.title;
        a.addEventListener("click", (ev) => {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1)
                return;
            ev.preventDefault();
            ev.stopPropagation();
            openDossier({ kind: "page", id: `guide/${e.slug}` });
        });
        li.appendChild(a);
        ul.appendChild(li);
    }
    wrap.appendChild(ul);
    return wrap;
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
        const m = /#\/why\?rule=(R-\d+[a-z]?)\b/.exec(a.getAttribute("href") ?? "");
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
function isTeamDossier(r) { return r.kind === "team"; }
function drawBack(body) {
    if (_stack.length <= 1)
        return;
    const back = el(body, "button", "dossier-back", copy.dsBack);
    back.type = "button";
    back.addEventListener("click", (e) => { e.preventDefault(); goBack(); });
}
function goBack() {
    const body = sheetBody();
    if (!body || _stack.length <= 1)
        return;
    _stack.pop();
    const prev = _stack[_stack.length - 1];
    if (prev.kind === "rule" || prev.kind === "belief") {
        body.replaceChildren();
        renderPiece(prev, _evidence?.[pieceKey(prev)] ?? null, body);
        restoreWalkScroll(prev);
        document.getElementById("dossiersheetclose")?.focus({ preventScroll: true });
        return;
    }
    if (prev.kind === "page") {
        body.replaceChildren();
        drawBack(body);
        renderPageDossier(_pageCache.get(prev.id) ?? null, prev.id, body);
        restoreWalkScroll(prev);
        document.getElementById("dossiersheetclose")?.focus({ preventScroll: true });
        return;
    }
    const bundle = dossierState.bundle;
    if (!bundle)
        return;
    const rec = resolveDossier(prev.kind, prev.id, bundle, prev.field, prev.group);
    body.replaceChildren();
    if (rec)
        renderDossier(rec, body);
    restoreWalkScroll(prev);
    document.getElementById("dossiersheetclose")?.focus({ preventScroll: true });
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
    const a = el(parent, "a", "pname dossier-edge", commonName(dossierState.bundle, sid));
    a.href = `#/plant?id=${encodeURIComponent(sid)}`;
}
const ruleLabel = (rid) => prose(stripRuleCitations(ruleClaim(dossierState.bundle, rid)));
function beliefLabel(bid) {
    const b = (dossierState.bundle.beliefs ?? []).find((x) => String(x.id) === bid);
    return prose(String(b?.belief ?? bid));
}
function teamRuleEdges(ruleIds, bundle) {
    const restsOn = [], corrects = [];
    for (const rid of ruleIds)
        (refutationVerdict(bundle.rules.find((r) => r.id === rid)) ? corrects : restsOn).push(rid);
    return { restsOn, corrects };
}
function edgesFoot(rec, body) {
    if (!dossierState.bundle)
        return;
    const lines = [];
    if (isTeamDossier(rec)) {
        const t = rec;
        const bundle = dossierState.bundle;
        const { restsOn, corrects } = teamRuleEdges(t.edges.rules, bundle);
        if (restsOn.length)
            lines.push({ label: copy.dsEdgeRules, build: (p) => restsOn.forEach((rid, i) => { if (i)
                    sep(p); inSheetDoor(p, ruleLabel(rid), { kind: "rule", id: rid }, `#/why?rule=${rid}`); }) });
        if (corrects.length)
            lines.push({ label: copy.dsEdgeCorrects, build: (p) => corrects.forEach((rid, i) => {
                    if (i)
                        sep(p);
                    inSheetDoor(p, ruleLabel(rid), { kind: "rule", id: rid }, `#/why?rule=${rid}`);
                    p.appendChild(document.createTextNode(" "));
                    for (const n of ruleStanding(bundle.rules.find((r) => r.id === rid) ?? {}))
                        p.appendChild(n);
                }) });
        if (t.edges.beliefs.length)
            lines.push({ label: copy.dsEdgeBelief, build: (p) => t.edges.beliefs.forEach((bid, i) => { if (i)
                    sep(p); inSheetDoor(p, beliefLabel(bid), { kind: "belief", id: bid }, "#/why"); }) });
        const plants = t.roles.map((r) => r.canonical).filter((x) => !!x);
        if (plants.length)
            lines.push({ label: copy.dsEdgePlants, build: (p) => plants.forEach((sid, i) => { if (i)
                    sep(p); plantOut(p, sid); }) });
    }
    else if (isFieldDossier(rec)) {
        const sid = rec.species;
        lines.push({ label: copy.dsEdgeCard, build: (p) => plantOut(p, sid) });
    }
    if (!lines.length)
        return;
    el(body, "p", "dossier-srch", copy.dsWhereLeads);
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
    if (isTeamDossier(rec)) {
        renderTeamDossier(rec, body);
        edgesFoot(rec, body);
        return;
    }
}
function renderFieldDossier(rec, body) {
    sheetTitle(copy.dsWhereNumber);
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", labelCopy(rec.label));
    const shim = { value: rec.value, unit: rec.unit };
    el(head, "p", "dossier-fieldval", formatValue(shim));
    if (rec.tier === "contested") {
        el(body, "p", "dossier-tier", copy.dsContested);
    }
    else if (rec.tier === "estimated") {
        el(body, "p", "dossier-tier", copy.dsEstimate);
    }
    const shown = rec.sources.map((p) => readerProse(p)).filter((p) => !!p);
    if (shown.length) {
        el(body, "p", "dossier-srch", shown.length === 1 ? copy.dsSourceOne : copy.dsSourceMany);
        for (const p of shown)
            citationLine(p, body);
    }
    else if (!rec.tier) {
        el(body, "p", "dossier-tier", copy.dsNoSource);
    }
}
function teamSheetWords(rec) {
    const id = rec.id ?? "";
    const said = (field, english) => {
        const es = corpusEs(id, field);
        return es ? { text: stripRuleCitations(es), english: false } : { text: english, english: corpusWantsEs() };
    };
    const origin = readerProvenance(rec.provenance);
    return {
        origin: origin ? said("provenance", prose(origin)) : null,
        honesty: rec.honestyNote ? said("honesty_note", prose(rec.honestyNote.trim())) : null,
        mechanisms: rec.mechanisms.map((m, i) => said(`mechanisms.${i}`, prose(plainClaim(m.claim, gardenLat())))),
        swaps: rec.roles.filter((r) => r.alternativeCost)
            .map((r) => said(`roles.${r.id}.alternative_cost`, prose(r.alternativeCost.trim()))),
    };
}
function putSaid(parent, s) {
    if (s.english)
        el(parent, "span", null, s.text).lang = "en";
    else
        parent.appendChild(document.createTextNode(s.text));
}
function renderTeamDossier(rec, body) {
    sheetTitle(copy.dsTheTeam);
    const head = el(body, "div", "dossier-head");
    el(head, "h2", "dossier-claim", displayName({ common: rec.common, id: rec.id ?? "" }));
    const words = teamSheetWords(rec);
    if (words.origin)
        putSaid(el(body, "p", null, `${copy.dsWhereFrom}: `), words.origin);
    if (words.honesty)
        putSaid(el(body, "p", "stops"), words.honesty);
    if (rec.mechanisms.length) {
        el(body, "p", "dossier-srch", copy.dsHowItWorks);
        for (const [i, m] of rec.mechanisms.entries()) {
            const p = el(body, "p", "team-mech");
            putSaid(p, words.mechanisms[i]);
            const badge = confidenceBadge(m.grade ?? "");
            if (badge)
                p.appendChild(badge);
            if (m.rule) {
                p.appendChild(document.createTextNode(" "));
                const a = el(p, "a", "whytap team-ruledoor", copy.dsWhyHolds);
                a.href = `#/why?rule=${m.rule}`;
                markLink(a, { kind: "rule", id: m.rule });
            }
        }
    }
    if (words.swaps.length) {
        el(body, "p", "dossier-srch", copy.dsSwapping);
        for (const s of words.swaps)
            putSaid(el(body, "p", "team-swap"), s);
    }
    const src = readerProse(rec.plantingSource);
    if (src) {
        el(body, "p", "dossier-srch", copy.dsMethod);
        citationLine(src, body);
    }
}

var dossiersheet = /*#__PURE__*/Object.freeze({
    __proto__: null,
    drawEvidence: drawEvidence,
    openDossier: openDossier,
    teamRuleEdges: teamRuleEdges,
    teamSheetWords: teamSheetWords
});

export { dossiersheet, drawEvidence, enforcementWords, openDossier, prose, teamRuleEdges, teamSheetWords };
