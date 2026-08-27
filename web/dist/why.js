// The "Why" page - the trust surface. Renders what no consumer garden tool shows: the folklore
// tier with its refutations (beliefs, D-012 - "the front page"), and every rule with its grade,
// mechanism, severity, and honest evidence status. Presentation only: data comes straight from
// the bundle; nothing here computes or promotes anything (invariant 4 stays human-only).
import { humanize, humanizeFamilies, humanizeRuleRefs, stripRuleCitations } from "./engine/labels.js";
import { confidenceBadge } from "./plan.js";
import { commonName } from "./state.js";
import { plantHref } from "./panels/plantcard.js";
const $ = (id) => document.getElementById(id);
// Rule codes (R-###) must not leak into user-facing prose (maintainer): the corpus keeps its
// cross-references, the display drops the parenthetical citation form. stripRuleCitations lives in
// labels.ts now so every render site strips codes the same way; here prose() also humanises families.
/** Display prose: family tokens humanised AND parenthetical rule-code citations dropped. */
function prose(text) {
    return stripRuleCitations(humanizeFamilies(text));
}
// A pointer is prose a human typed into the corpus when they read (or failed to read) the source:
// publisher, title, where it lives, when it was read, and usually the sentence that carries the
// claim. The page shows it VERBATIM - the only structure extracted is the URL, so the citation the
// reader sees is the citation the corpus records. Bare hosts are the corpus's house style
// ("extension.umn.edu/vegetables/..."), so the scheme is optional here and added back for the href.
const SOURCE_URL = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:edu|org|gov|com|net|io|uk)(?:\/[^\s,;"')\]]*)?/i;
/** One citation line: the pointer as recorded, with its URL turned into a link if it has one. */
function citationLine(pointer, parent) {
    const text = humanizeRuleRefs(stripRuleCitations(pointer));
    const p = el(parent, "p", "prov");
    const m = SOURCE_URL.exec(text);
    if (!m) {
        p.textContent = text;
        return;
    }
    const url = m[0].replace(/[.,;:'")\]]+$/, ""); // sentence punctuation is not part of the address
    p.appendChild(document.createTextNode(text.slice(0, m.index)));
    const a = document.createElement("a");
    a.href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    a.textContent = url;
    a.rel = "noreferrer";
    a.target = "_blank";
    p.appendChild(a);
    p.appendChild(document.createTextNode(text.slice(m.index + url.length)));
}
/** The sources behind one claim, folded away. Two different promises, so two different labels: a
 *  verified claim's pointers carry the corpus's sign-off, so they are simply "the sources".
 *  Everything else gets "what this rests on" - deliberately NOT "not yet read", because several
 *  unverified pointers DO record a read date and are unverified for a different reason (an LLM
 *  summarised the page, or the study tests the wrong thing); the status line above already carries
 *  the verified/unverified distinction. verified_trivially gets nothing at all - "arithmetic" and
 *  "solar geometry" are not sources, and its status line already explains itself.
 *  Wording note (maintainer): the page states verification WITHOUT narrating who did it - no
 *  "read by a human" phrasing anywhere on this surface. Invariant 4 is unchanged; it governs who
 *  may promote a rule, which was never a question the reader had to be told about. */
function sourcesDisclosure(status, pointers, parent) {
    if (!pointers.length || status === "verified_trivially")
        return;
    const n = pointers.length;
    const det = el(parent, "details", "sources");
    el(det, "summary", null, status === "verified"
        ? `the ${n === 1 ? "source" : `${n} sources`}`
        : `what this rests on - ${n === 1 ? "one pointer" : `${n} pointers`}`);
    for (const p of pointers)
        citationLine(p, det);
}
function el(parent, tag, cls, text) {
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    parent.appendChild(e);
    return e;
}
// O13 (approved mockup 2026-07-29): every card FOLDS to its claim - one line plus its plain-words
// standing - with mechanism, remedy and evidence one tap down, unchanged. 54 rules become a list
// you can scan instead of a document you scroll. The card is a <details> whose summary is the
// claim; everything scenario 29 pins (dataset.rule anchors, details.sources labels, no codes)
// rides through untouched, because textContent and querySelectorAll see into a closed details.
function foldCard(parent, anchor, claim, open) {
    const card = el(parent, "details", "why-card");
    card.open = open;
    card.dataset.rule = anchor; // non-visible anchor for deep-linking; NOT shown to the user
    const sum = el(card, "summary", null);
    const head = el(sum, "div", null);
    // A5: a real h3, so ~84 cards stop sitting headingless under two h2s (the measured outline
    // defect). Same .claim class, same size - the heading is structure, not a re-style.
    el(head, "h3", "claim", claim);
    const meta = el(head, "p", "meta");
    const body = el(card, "div", "foldbody");
    return { card, body, meta };
}
// One belief: the claim people hold, the grade, and the corpus's answer.
function beliefCard(b, parent, open = false) {
    const { body, meta } = foldCard(parent, String(b.id ?? ""), String(b.belief ?? b.id), open);
    // plain-words confidence (handoff: never letter grades reader-facing) - same vocabulary as Plan
    {
        const badge = confidenceBadge(String(b.grade ?? ""));
        if (badge)
            meta.appendChild(badge);
    }
    el(body, "p", null, prose(String(b.response ?? "").trim()));
    if (b.what_is_true) {
        const det = el(body, "details", null);
        el(det, "summary", null, "what is actually known");
        el(det, "p", null, prose(String(b.what_is_true).trim()));
    }
    // Folklore is where "says who?" is loudest - 18 of the 19 beliefs carry a pointer, most of them
    // an extension office refuting the thing outright, and none of them were reachable until now.
    const ev = (b.evidence ?? {});
    sourcesDisclosure(String(ev.status ?? ""), (ev.pointers ?? []).map(String).filter((s) => s.trim()), body);
}
// One rule: claim, mechanism, grade × severity → ruling, and the evidence status said plainly.
// `open` = the deep-link focus case: a page filtered to one rule shows it expanded.
function ruleCard(r, parent, open = false) {
    const rec = r;
    const claim = String(rec.claim ?? rec.claim_refuted ?? "").trim();
    const { body, meta } = foldCard(parent, r.id, prose(claim), open);
    {
        const badge = confidenceBadge(String(rec.grade ?? ""));
        if (badge)
            meta.appendChild(badge);
        meta.appendChild(document.createTextNode(`${badge ? " · " : ""}${rec.severity} if ignored → ${rec.ruling}`));
    }
    if (rec.mechanism)
        el(body, "p", null, `Mechanism: ${prose(String(rec.mechanism).trim())}`);
    const ev = (rec.evidence ?? {});
    const n = ev.pointers?.length ?? 0;
    const src = n ? `${n} source${n === 1 ? "" : "s"}` : "no source";
    // A trivially-settled rule's pointer IS its basis - "arithmetic", "mechanics", "root architecture".
    // Single short token, so it reads inline; anything longer is left off rather than mangled.
    const firstPtr = String((ev.pointers ?? [])[0] ?? "").trim();
    const trivialBasis = firstPtr && firstPtr.length <= 48 ? firstPtr : "";
    // "Verified" on its own is the word every product uses and means nothing (maintainer). Each status
    // says what kind of standing the claim actually has instead. The ceiling on that phrasing is set by
    // what the corpus CITES: 43 of the 57 pointers behind verified rules are land-grant extension
    // publications - research-based guidance, which is what extension calls its own output - and only a
    // handful are journal papers. So "research-based sources" is the honest description and "scientific
    // evidence" is not; it would be true of a minority of cards and flatly wrong on the trivial ones,
    // which rest on geometry and want no trial at all.
    const evLine = {
        verified: ["ev ok", `Evidence: confirmed against ${src} in the research-based literature.`],
        // The BASIS comes from the rule, not from an assumption about what "trivial" means here. This
        // line used to read "true by geometry or arithmetic", which fit the three rules I happened to
        // look at and was wrong for the other thirteen: the trivially-settled set rests on mechanics,
        // photosynthesis, growth habit, climatology, root architecture, competition, epistemics and
        // plain definition as well as geometry. Naming the pointer keeps it true for all of them, and
        // for whatever basis the seventeenth rule turns out to have.
        verified_trivially: ["ev ok", trivialBasis
                ? `Evidence: settled without a trial - ${trivialBasis}.`
                : "Evidence: settled without a trial."],
        unverified: ["ev", `Evidence: not yet confirmed against ${src === "no source" ? "any source" : `its ${src}`}.`],
        no_evidence_exists: ["ev", "Evidence: none exists for the underlying claim - that absence is the point."],
    };
    const [cls, text] = evLine[ev.status ?? ""] ?? ["ev", `Evidence: ${ev.status ?? "unknown"}.`];
    el(body, "p", cls, text);
    // The page used to COUNT the sources and then throw them away. They are the whole point of the
    // claim "every rule names its evidence", so they are on the page now.
    sourcesDisclosure(String(ev.status ?? ""), (ev.pointers ?? []).map(String).filter((s) => s.trim()), body);
    // What the rule SAYS when it fires, distinct from what to DO about it. Three refutation rules
    // carry one — "Beans will improve this ground for next year. They will not feed your corn this
    // year." — and it is the same act a belief's `response` performs, which is why it took that name
    // when `ruling_text` retired (ISSUES #22). It renders as a plain paragraph, NOT inside the remedy
    // disclosure: a correction is not an instruction and a reader opening "remedy" should not find one.
    //
    // `audience: engine` rules are skipped. R-092's response is "do not implement elevation
    // correction" and R-090's carries a {distance_km} placeholder nothing substitutes; both are
    // addressed to whoever is building this, and printing either to a gardener is worse than silence.
    if (rec.response && rec.audience !== "engine") {
        el(body, "p", null, prose(String(rec.response).trim()));
    }
    // Inside the fold the remedy needs no second disclosure - the whole body is already one tap
    // down, and a reader who opened a card should not have to open it twice (approved mockup: the
    // body reads Mechanism / What to do / Evidence in one piece).
    if (rec.remedy) {
        el(body, "p", "whatfix", `What to do: ${prose(String(rec.remedy).trim())}`);
    }
    // O36 (d): the way OUT to this rule's own page.
    //
    // The linkage was one-way. 477 generated documents link INTO the app; nothing led back, so a
    // reader who opened a rule here could not reach the page written about it - and those pages are
    // what a search or a backlink lands on. The static side of this shipped first (a rule card on a
    // plant page leads with the document); this is the app's half.
    //
    // THE SLUG COMES FROM THE BUNDLE and is never built here. `rule_slug` resolves collisions over a
    // sorted-by-id iteration, so it is order-dependent; a second implementation in this file would
    // agree until two claims collided and then link to a page that does not exist, with nothing
    // logged. `page_slug` rides on the rule for the same reason `derived_ruling` does. Absent only
    // if the bundle predates that field, in which case the card simply offers no link.
    const slug = typeof rec.page_slug === "string" ? rec.page_slug : "";
    if (slug) {
        const more = el(body, "p", "more");
        const a = el(more, "a", null, "Read the full rule");
        a.href = `../rules/${slug}/`;
    }
}
const matches = (hay, q) => !q || hay.some((h) => String(h ?? "").toLowerCase().includes(q));
// O13's ONE filter: what KIND of rule it is, in a gardener's words, never the corpus's slugs.
// Complete cover of all 54 - the approved item's six chips left 11 rules reachable only via All
// (provenance, allelopathy, pollination, thermal), so the map folds them where a gardener would
// look: heat/frost windows are Timing, walnut-and-corn-block questions are Neighbours, and the
// frost-data epistemics are Climate (the page's own climate fieldset uses the same word).
// Deliberately NOT here (approved mockup): grade / severity / evidence facets - those audit the
// corpus and would put our epistemics in front of a visitor's answer.
const KIND_OF_TYPE = {
    geometry: "Spacing", timing: "Timing", thermal: "Timing", advisory: "Advice",
    rotation: "Rotation", nutrient: "Feeding", allelopathy: "Neighbours", pollination: "Neighbours",
    provenance: "Climate", refutation: "Myths",
};
const ruleKind = (r) => KIND_OF_TYPE[String(r.type ?? "")] ?? "Advice";
let activeKind = null; // null = All
// O102 Arc B: the kind filter and the search term both live in the URL hash, so a filtered view is
// shareable and a content page can deep-link a PRE-FILTERED Why page (`#/why?kind=Rotation`) - the
// same interconnected navigation the maintainer already valued, now landing on a narrowed list
// rather than the whole one. app.ts reads them out of the hash on entry; here we write them back
// with replaceState (which does NOT fire hashchange, so re-rendering never loops).
export function setWhyKind(kind) { activeKind = kind; }
// Reads the live filter/search state and writes it to the hash (replaceState, so no hashchange and
// no render loop). Exported so app.ts's search-input handler keeps the URL in step as you type.
// A focused deep-link (`?rule=`/`?belief=`/`?climate`) owns the hash and is left untouched.
export function syncWhyHash() {
    if (focusRuleId || focusBeliefId)
        return;
    if (/[?&](rule|belief|climate)\b/.test(location.hash))
        return;
    const q = $("whyq")?.value.trim() ?? "";
    const p = new URLSearchParams();
    if (activeKind)
        p.set("kind", activeKind);
    if (q)
        p.set("q", q);
    const qs = p.toString();
    const next = "#/why" + (qs ? "?" + qs : "");
    if (location.hash !== next)
        history.replaceState(null, "", next);
}
// A landing "See the evidence" link focuses ONE rule without ever showing its code: the deep-link
// carries the id as a URL param (plumbing, not shown), setWhyFocus filters the page to that rule,
// and the search box stays empty. Typing in the search box clears the focus (see app.ts).
let focusRuleId = null;
export function setWhyFocus(id) { focusRuleId = id; }
// The same plumbing for FOLKLORE. The generated belief pages (one per claim, their own URLs) link
// back into the app's evidence view, and without this they could only ever land on the whole Why
// page and leave the reader to find the claim again - the deep link would technically work and
// practically fail. Rules have had this since the landing receipts; beliefs were the asymmetry.
let focusBeliefId = null;
export function setWhyBeliefFocus(id) { focusBeliefId = id; }
// A species' confidence block lists FIELD PATHS - "root_spread_multiplier",
// "cultivar_groups.dwarf_rootstock.mature_spread_cm". Turn one into something a gardener reads:
// drop the machine prefix, keep the cultivar group's name because a dwarf apple's spread and a
// standard apple's spread are different claims and collapsing them would hide that.
// Field names that humanise into schema-speak. Display only, and a fallback - anything not listed
// still renders, just less gracefully, so a new flagged field never disappears from this list
// merely because nobody wrote it a label. That failure mode would be worse than an ugly one.
const FIELD_LABEL = {
    provides_load_vines: "how many vines it can carry",
    n_fixed_kg_ha_season: "nitrogen fixed per season",
    n_available_to_neighbors_same_season: "nitrogen reaching neighbours the same season",
    biomass_k_content: "potassium in its leaf litter",
    block_min_plants: "smallest block that pollinates",
    gdd_to_maturity: "growing-degree days to maturity",
    succession_interval_days: "days between succession sowings",
    root_spread_multiplier: "how far the roots reach past the canopy",
    night_temp_max_c: "night temperature it stops setting fruit",
    threshold_c: "temperature threshold",
};
function fieldLabel(path) {
    const parts = path.split(".");
    const leaf = parts[parts.length - 1];
    const plain = FIELD_LABEL[leaf] ?? humanize(leaf).toLowerCase().replace(/ cm$/, "");
    // Keep the cultivar group's name: a dwarf apple's spread and a standard apple's spread are
    // different claims, and collapsing them would hide which one is the soft number.
    return parts[0] === "cultivar_groups" && parts.length === 3
        ? `${humanize(parts[1]).toLowerCase()}: ${plain}`
        : plain;
}
/** The plant numbers' honesty panel: how many species fields are flagged, and exactly which. Read
 *  live from the bundle so it cannot drift from the corpus - the whole point of the card is that
 *  the count is true on the day you look at it. */
function renderSpeciesConfidence(bundle) {
    const line = $("speciesconf");
    const box = $("speciesflags");
    if (!line || !box)
        return 0;
    box.innerHTML = "";
    const species = (bundle.species ?? []);
    const flagged = species
        .map((s) => {
        const conf = (s.confidence ?? {});
        const fields = [
            ...(conf.estimated ?? []).map((f) => ({ f, tier: "estimated" })),
            ...(conf.contested ?? []).map((f) => ({ f, tier: "contested" })),
        ];
        return { id: String(s.id ?? ""), fields };
    })
        .filter((s) => s.fields.length);
    const total = flagged.reduce((n, s) => n + s.fields.length, 0);
    if (!total) {
        // WAS: "All N plants carry numbers confirmed against a source." That sentence is FALSE and was
        // waiting to be reached. An absent flag means nobody marked the number soft; it does not mean
        // anyone sourced it. Measured 2026-07-26: of the numeric species fields, 171 are unflagged AND
        // carry no citation at all, against 18 that carry one. So the day the flag backlog hit zero,
        // this page would have claimed every number was confirmed against a source, and been wrong
        // about nearly all of them - a sentence that becomes a lie exactly when the project succeeds.
        // The flag count and the citation count are DIFFERENT MEASURES, so it now states the one it
        // actually knows and says nothing about the other.
        line.textContent = `No plant number is marked estimated or contested today. `
            + `That is a statement about what we have flagged, not a claim that every number has a source.`;
        return 0;
    }
    line.textContent = `${total} number${total === 1 ? "" : "s"} across ${flagged.length} of ` +
        `${species.length} plants are marked estimated or contested today.`;
    // NOT class "sources": that class means "this disclosure is a citation list", and scenario 29
    // asserts every one of those carries one of exactly two labels. This is a list of soft numbers,
    // not a list of sources, and borrowing the class made it fail a check that was right.
    const det = el(box, "details", "flaglist");
    el(det, "summary", null, "which numbers those are");
    for (const s of flagged.sort((a, b) => commonName(bundle, a.id).localeCompare(commonName(bundle, b.id)))) {
        const p = el(det, "p", "prov");
        // The species name links to its card - this list names plants and gave the reader nowhere
        // to go with them (2026-08-02).
        const name = el(p, "a", "pname", commonName(bundle, s.id));
        name.href = plantHref(s.id);
        name.style.fontWeight = "600";
        p.appendChild(document.createTextNode(` - ${s.fields.map((x) => `${fieldLabel(x.f)}${x.tier === "contested" ? " (contested)" : ""}`).join("; ")}`));
    }
    return flagged.length;
}
// A5 (award-benchmark amendments): the jump row is a segmented band now, and a band implies an
// active segment. Active = the section in view, read off the live DOM on scroll (rAF-throttled,
// three rects), so re-renders need no rebinding. Armed once; inert off the Why page.
let jumpSpyArmed = false;
function armJumpSpy() {
    if (jumpSpyArmed)
        return;
    jumpSpyArmed = true;
    let raf = 0;
    addEventListener("scroll", () => {
        if (raf)
            return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            if (document.getElementById("page-why")?.hidden !== false)
                return;
            const jump = document.getElementById("whyjump");
            if (!jump || jump.hidden)
                return;
            const chips = [...jump.querySelectorAll(".jumpchip")];
            const mark = window.innerHeight * 0.35;
            let active = 0;
            chips.forEach((c, i) => {
                const t = c.dataset.target ? document.getElementById(c.dataset.target) : null;
                if (t && t.getBoundingClientRect().top <= mark)
                    active = i;
            });
            chips.forEach((c, i) => c.setAttribute("aria-current", String(i === active)));
        });
    }, { passive: true });
}
/** A section heading with its count beside it - "The rules · 54" - so each block says how much is
 *  under it before you scroll (O13). The count is what is SHOWING (filter and search included). */
function sectionHead(parent, title, count) {
    const h = el(parent, "h2", "sec", title);
    el(h, "span", "seccount", ` · ${count}`);
}
export function renderWhy(bundle) {
    const q = $("whyq").value.trim().toLowerCase();
    const focus = focusRuleId;
    const bfocus = focusBeliefId;
    const flaggedSpecies = renderSpeciesConfidence(bundle);
    const all = bundle.rules;
    // O102 Arc B: the two match predicates, factored so the COUNTS and the rendered lists agree - a
    // chip that says "Rotation 3" under a search must show exactly those three. The rule predicate is
    // the same field set the filter below uses; the belief predicate the same as the folklore filter.
    const ruleMatch = (r) => {
        const rec = r;
        return matches([r.id, rec.claim, rec.claim_refuted, rec.mechanism, rec.remedy], q);
    };
    const beliefMatch = (b) => matches([b.belief, b.response, b.what_is_true, ...(b.keys ?? [])], q);
    // Search makes the facets live: counts are over what the current search leaves, not the whole
    // corpus, so the chips and the jump row answer "how many of my matches are in each" (Baymard's
    // count-on-combination). With the box empty this is the whole corpus, exactly as before.
    const qRules = q ? all.filter(ruleMatch) : all;
    const qBeliefs = q ? bundle.beliefs.filter(beliefMatch) : bundle.beliefs;
    // The jump row (O13): the page's three blocks are three different things - folklore, rules, and
    // the plant numbers we are unsure about - and the row says so with counts before any scrolling.
    // Buttons, not #anchors: the router owns location.hash, so a fragment link would navigate.
    {
        const jump = $("whyjump");
        if (jump) {
            jump.innerHTML = "";
            // Hidden under a kind filter too: two of its three targets are hidden then, and a jump row
            // pointing at absent sections is noise. The chips stay - they are the way back to All.
            jump.hidden = !!focus || !!activeKind;
            const jumpTo = (label, count, targetId) => {
                const b = el(jump, "button", "jumpchip", label);
                b.type = "button";
                b.dataset.target = targetId;
                // A5 (segmented band): the first segment starts active; the scroll spy below keeps
                // aria-current on whichever section is actually in view.
                b.setAttribute("aria-current", String(jump.children.length === 1));
                el(b, "b", null, String(count));
                b.onclick = () => document.getElementById(targetId)?.scrollIntoView({ block: "start" });
            };
            jumpTo("Folklore ", qBeliefs.length, "beliefs");
            jumpTo("The rules ", qRules.length, "rules");
            // O102 Arc B (maintainer, 2026-08-22): the plant-confidence panel is NOT part of the search
            // result set - search spans rule and folklore text, never species field-paths - so under an
            // active search its chip is dropped rather than sitting at the full count beside two narrowed
            // ones, which would read as "N unsure numbers match your search". The panel itself stays
            // below (as it does under a kind filter); only its jump chip steps aside.
            if (!q)
                jumpTo("Unsure about ", flaggedSpecies, "whyspecies");
            armJumpSpy();
        }
    }
    // The ONE filter (O13): kind of rule, in a gardener's words. Under a search the counts narrow to
    // the matches (above); with the box empty they are the whole corpus's - the chips say what exists,
    // the section heading says what is showing.
    {
        const chips = $("whychips");
        if (chips) {
            chips.innerHTML = "";
            chips.hidden = !!focus;
            const counts = new Map();
            for (const r of qRules)
                counts.set(ruleKind(r), (counts.get(ruleKind(r)) ?? 0) + 1);
            const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
            const chip = (label, count, kind) => {
                const c = el(chips, "button", "kindchip", `${label} `);
                c.type = "button";
                el(c, "b", null, String(count));
                c.setAttribute("aria-pressed", String(activeKind === kind));
                c.onclick = () => {
                    // A second tap on the active chip clears it (a toggle, so the chip is its own way back);
                    // otherwise select it. Either way the hash follows and the page re-renders.
                    activeKind = activeKind === kind ? null : kind;
                    syncWhyHash();
                    renderWhy(bundle);
                    // O82(f): the filter row scrolls horizontally, so a tapped chip near the right edge could
                    // end up half off-screen after the re-render. Bring the now-active chip into view (inline
                    // only - block:nearest keeps the page from jumping vertically).
                    document.querySelector('#whychips .kindchip[aria-pressed="true"]')
                        ?.scrollIntoView({ inline: "center", block: "nearest" });
                };
            };
            chip("All", qRules.length, null);
            for (const [kind, n] of kinds)
                chip(kind, n, kind);
        }
    }
    // O102 Arc B: the applied-filter summary. Visible only when a chip or the search box narrows the
    // page (and never under a focused deep-link, which is its own single-answer view). It says how
    // much is showing and carries a removable token per active facet plus a clear-all, so a reader
    // never loses track of their own narrowing (Baymard: 42% of sites hide this and users suffer).
    {
        const applied = $("whyapplied");
        if (applied) {
            applied.innerHTML = "";
            const on = !focus && !bfocus && (!!activeKind || !!q);
            applied.hidden = !on;
            if (on) {
                const shown = activeKind
                    ? qRules.filter((r) => ruleKind(r) === activeKind).length
                    : qRules.length;
                el(applied, "span", "whyapplied-n", `${shown} of ${all.length} ${shown === 1 ? "rule" : "rules"}`);
                const token = (text, clear) => {
                    const t = el(applied, "button", "whytoken");
                    t.type = "button";
                    el(t, "span", null, text);
                    el(t, "span", "whytoken-x", "×"); // the × close, an allowed monochrome control (D-105)
                    t.setAttribute("aria-label", `Remove filter: ${text}`);
                    t.onclick = clear;
                };
                if (activeKind)
                    token(activeKind, () => {
                        activeKind = null;
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                if (q)
                    token(`“${$("whyq").value.trim()}”`, () => {
                        $("whyq").value = "";
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                const clear = el(applied, "button", "whyclear", "Clear");
                clear.type = "button";
                clear.onclick = () => {
                    activeKind = null;
                    $("whyq").value = "";
                    syncWhyHash();
                    renderWhy(bundle);
                };
            }
        }
    }
    const beliefsBox = $("beliefs");
    beliefsBox.innerHTML = "";
    // A kind chip filters RULES - folklore has no kind, so under any non-All filter the whole
    // folklore block hides rather than sitting unfiltered above the filtered list (maintainer,
    // 2026-07-30: a selected filter shows only what is associated with it). Search, by contrast,
    // spans both blocks and keeps filtering folklore as before.
    if (bfocus) {
        // Arrived from that claim's own page: show it alone and OPEN, so the reader lands on the answer
        // rather than on a list to search again. Symmetric with a rule deep-link, including the way out.
        const one = bundle.beliefs.filter((b) => String(b.id) === bfocus);
        for (const b of one)
            beliefCard(b, beliefsBox, true);
        if (!one.length)
            el(beliefsBox, "p", "hint", "that claim is not in the corpus.");
        const back = el(beliefsBox, "button", "whyshowall", "Show all folklore");
        back.type = "button";
        back.onclick = () => { setWhyBeliefFocus(null); renderWhy(bundle); };
    }
    else if (!focus && !activeKind) {
        const beliefs = qBeliefs; // the q-filtered folklore, computed once above with the chip counts
        sectionHead(beliefsBox, "Folklore, checked", beliefs.length);
        el(beliefsBox, "p", "hint", "Widely believed, rarely trialled. These never gate a plan - they answer the question you were going to ask.");
        for (const b of beliefs)
            beliefCard(b, beliefsBox);
        if (!beliefs.length)
            el(beliefsBox, "p", "hint", "no folklore matches that search.");
    }
    const rulesBox = $("rules");
    rulesBox.innerHTML = "";
    const unverified = all.filter((r) => r.evidence?.status === "unverified").length;
    const rules = bfocus ? [] : focus
        ? all.filter((r) => r.id === focus)
        : qRules.filter((r) => !activeKind || ruleKind(r) === activeKind);
    if (focus) {
        const back = el(rulesBox, "button", "whyshowall", "Show all rules");
        back.type = "button";
        back.onclick = () => { setWhyFocus(null); renderWhy(bundle); };
    }
    else {
        sectionHead(rulesBox, "The rules", rules.length);
        el(rulesBox, "p", "hint", 
        // The zero case is reachable now and must not read "0 have not yet been confirmed", which is
        // both ugly and a weaker statement than the truth. It also must not crow: every rule having
        // been checked is a fact about the corpus's current size, not a guarantee about the world -
        // the folklore section below is still full of things nobody has trialled.
        unverified === 0
            ? `${all.length} rules. Every one has been checked against its sources or settled without a ` +
                `trial. That is a statement about these rules, not about gardening - the folklore below is ` +
                `where the open questions live.`
            : `${all.length} rules. ${unverified} have not yet been confirmed against their sources. ` +
                `We show you which instead of hiding it.`);
    }
    // The focused card renders OPEN - a page filtered to one rule should not need a second tap.
    for (const r of rules)
        ruleCard(r, rulesBox, !!focus);
    if (!rules.length)
        el(rulesBox, "p", "hint", focus ? "that suggestion's rule is unavailable." : "no rules match that search.");
    // Walk round 2: the next invitation ATTACHES to a focused answer - a deep-linked reader (the
    // landing's receipts, a content page's rule link) finishes reading right there, and the old
    // page-bottom placement was invisible to them. Unfocused, it stays the page's closing word.
    const nxt = document.querySelector(".whynext");
    if (nxt) {
        if (focus)
            rulesBox.after(nxt);
        else
            document.getElementById("page-why")?.append(nxt);
    }
}
