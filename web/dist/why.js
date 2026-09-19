import { humanize, humanizeRuleRefs, stripRuleCitations } from "./engine/labels.js";
import { confidenceBadge } from "./plan.js";
import { commonName, ruleClaim } from "./state.js";
import { plantHref } from "./panels/plantcard.js";
import { renderGlossary } from "./glossary.js";
import { enforcementWords, evidenceLine, prose, readerProse, sourcesDisclosure } from "./citation.js";
import { el } from "./dom.js";
import { mark, markLink } from "./dossier.js";
export { enforcementWords } from "./citation.js";
const $ = (id) => document.getElementById(id);
function foldCard(parent, anchor, claim, open) {
    const card = el(parent, "details", "why-card");
    card.open = open;
    card.dataset.rule = anchor;
    const sum = el(card, "summary", null);
    const head = el(sum, "div", null);
    el(head, "h3", "claim", claim);
    const meta = el(head, "p", "meta");
    const body = el(card, "div", "foldbody");
    return { card, body, meta };
}
function beliefCard(b, parent, bundle, open = false) {
    const { body, meta } = foldCard(parent, String(b.id ?? ""), String(b.belief ?? b.id), open);
    {
        const badge = confidenceBadge(String(b.grade ?? ""));
        if (badge)
            meta.appendChild(badge);
    }
    el(body, "p", null, prose(String(b.response ?? "").trim()));
    const threads = (b.see_also ?? []).map(String).filter((id) => /^R-/.test(id));
    if (threads.length) {
        const p = el(body, "p", "defend", "What we can actually defend: ");
        threads.forEach((id, i) => {
            if (i)
                p.appendChild(document.createTextNode(" · "));
            const a = document.createElement("a");
            a.className = "whytap defend-link";
            a.href = `#/why?rule=${id}`;
            a.textContent = prose(stripRuleCitations(ruleClaim(bundle, id)));
            markLink(a, { kind: "rule", id });
            p.appendChild(a);
        });
    }
    if (b.what_is_true) {
        const det = el(body, "details", null);
        el(det, "summary", null, "what is actually known");
        el(det, "p", null, prose(String(b.what_is_true).trim()));
    }
    const ev = (b.evidence ?? {});
    sourcesDisclosure(String(ev.status ?? ""), (ev.pointers ?? []).map(String).filter((s) => s.trim()), body);
    if (open)
        mark(body, { kind: "belief", id: String(b.id ?? "") }, { label: "Open the evidence sheet" });
}
function ruleCard(r, parent, open = false) {
    const rec = r;
    const claim = String(rec.claim ?? rec.claim_refuted ?? "").trim();
    const { body, meta } = foldCard(parent, r.id, prose(claim), open);
    {
        const badge = confidenceBadge(String(rec.grade ?? ""));
        if (badge)
            meta.appendChild(badge);
        const line = enforcementWords(String(rec.severity ?? ""), String(rec.derived_ruling ?? rec.ruling ?? ""));
        if (line)
            meta.appendChild(document.createTextNode(`${badge ? " · " : ""}${line}`));
    }
    if (rec.mechanism)
        el(body, "p", null, `Mechanism: ${prose(String(rec.mechanism).trim())}`);
    const whatIsTrue = readerProse(rec.what_is_true);
    if (whatIsTrue)
        el(body, "p", null, `What is actually known: ${prose(whatIsTrue)}`);
    if (rec.effect_size)
        el(body, "p", "howmuch", `How much it matters: ${humanizeRuleRefs(prose(String(rec.effect_size).trim()))}`);
    const scope = readerProse(rec.scope_note);
    if (scope)
        el(body, "p", "stops", `Where this stops: ${humanizeRuleRefs(prose(scope))}`);
    const ev = (rec.evidence ?? {});
    const pointers = (ev.pointers ?? []).map(String).filter((s) => s.trim());
    const { cls, text } = evidenceLine(String(ev.status ?? ""), pointers);
    el(body, "p", cls, text);
    sourcesDisclosure(String(ev.status ?? ""), pointers, body);
    if (rec.response && rec.audience !== "engine") {
        el(body, "p", null, prose(String(rec.response).trim()));
    }
    if (rec.remedy) {
        el(body, "p", "whatfix", `What to do: ${prose(String(rec.remedy).trim())}`);
    }
    const slug = typeof rec.page_slug === "string" ? rec.page_slug : "";
    if (slug) {
        const more = el(body, "p", "more");
        const a = el(more, "a", null, "Read the full rule");
        a.href = `../rules/${slug}/`;
    }
    if (open)
        mark(body, { kind: "rule", id: r.id }, { label: "Open the evidence sheet" });
}
const matches = (hay, q) => !q || hay.some((h) => String(h ?? "").toLowerCase().includes(q));
const KIND_OF_TYPE = {
    geometry: "Spacing", timing: "Timing", thermal: "Timing", advisory: "Advice",
    rotation: "Rotation", nutrient: "Feeding", allelopathy: "Neighbours", pollination: "Neighbours",
    provenance: "Climate", refutation: "Myths",
};
const ruleKind = (r) => KIND_OF_TYPE[String(r.type ?? "")] ?? "Advice";
let activeKind = null;
export function setWhyKind(kind) { activeKind = kind; }
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
let focusRuleId = null;
export function setWhyFocus(id) { focusRuleId = id; }
let focusBeliefId = null;
export function setWhyBeliefFocus(id) { focusBeliefId = id; }
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
    return parts[0] === "cultivar_groups" && parts.length === 3
        ? `${humanize(parts[1]).toLowerCase()}: ${plain}`
        : plain;
}
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
        line.textContent = `No plant number is marked estimated or contested today. `
            + `That is a statement about what we have flagged, not a claim that every number has a source.`;
        return 0;
    }
    line.textContent = `${total} number${total === 1 ? "" : "s"} across ${flagged.length} of ` +
        `${species.length} plants are marked estimated or contested today.`;
    const det = el(box, "details", "flaglist");
    el(det, "summary", null, "which numbers those are");
    for (const s of flagged.sort((a, b) => commonName(bundle, a.id).localeCompare(commonName(bundle, b.id)))) {
        const p = el(det, "p", "prov");
        const name = el(p, "a", "pname", commonName(bundle, s.id));
        name.href = plantHref(s.id);
        name.style.fontWeight = "600";
        p.appendChild(document.createTextNode(` - ${s.fields.map((x) => `${fieldLabel(x.f)}${x.tier === "contested" ? " (contested)" : ""}`).join("; ")}`));
    }
    return flagged.length;
}
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
function sectionHead(parent, title, count) {
    const h = el(parent, "h2", "sec", title);
    el(h, "span", "seccount", ` · ${count}`);
}
export function renderWhy(bundle) {
    const q = ($("whyq")).value.trim().toLowerCase();
    {
        const b = document.getElementById("whytermsbody");
        if (b && !b.firstChild)
            renderGlossary(b);
    }
    const focus = focusRuleId;
    const bfocus = focusBeliefId;
    const flaggedSpecies = renderSpeciesConfidence(bundle);
    const all = bundle.rules;
    const ruleMatch = (r) => {
        const rec = r;
        return matches([r.id, rec.claim, rec.claim_refuted, rec.mechanism, rec.remedy], q);
    };
    const beliefMatch = (b) => matches([b.belief, b.response, b.what_is_true, ...(b.keys ?? [])], q);
    const qRules = q ? all.filter(ruleMatch) : all;
    const qBeliefs = q ? bundle.beliefs.filter(beliefMatch) : bundle.beliefs;
    {
        const jump = $("whyjump");
        if (jump) {
            jump.innerHTML = "";
            jump.hidden = !!focus || !!activeKind;
            const jumpTo = (label, count, targetId) => {
                const b = el(jump, "button", "jumpchip", label);
                b.type = "button";
                b.dataset.target = targetId;
                b.setAttribute("aria-current", String(jump.children.length === 1));
                el(b, "b", null, String(count));
                b.onclick = () => document.getElementById(targetId)?.scrollIntoView({ block: "start" });
            };
            jumpTo("Folklore ", qBeliefs.length, "beliefs");
            jumpTo("The rules ", qRules.length, "rules");
            if (!q)
                jumpTo("Unsure about ", flaggedSpecies, "whyspecies");
            armJumpSpy();
        }
    }
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
                    activeKind = activeKind === kind ? null : kind;
                    syncWhyHash();
                    renderWhy(bundle);
                    document.querySelector('#whychips .kindchip[aria-pressed="true"]')
                        ?.scrollIntoView({ inline: "center", block: "nearest" });
                };
            };
            chip("All", qRules.length, null);
            for (const [kind, n] of kinds)
                chip(kind, n, kind);
        }
    }
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
                    el(t, "span", "whytoken-x", "×");
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
                    token(`“${($("whyq")).value.trim()}”`, () => {
                        ($("whyq")).value = "";
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                const clear = el(applied, "button", "whyclear", "Clear");
                clear.type = "button";
                clear.onclick = () => {
                    activeKind = null;
                    ($("whyq")).value = "";
                    syncWhyHash();
                    renderWhy(bundle);
                };
            }
        }
    }
    const beliefsBox = $("beliefs");
    beliefsBox.innerHTML = "";
    if (bfocus) {
        const one = bundle.beliefs.filter((b) => String(b.id) === bfocus);
        for (const b of one)
            beliefCard(b, beliefsBox, bundle, true);
        if (!one.length)
            el(beliefsBox, "p", "hint", "that claim is not in the corpus.");
        const back = el(beliefsBox, "button", "whyshowall", "Show all folklore");
        back.type = "button";
        back.onclick = () => { setWhyBeliefFocus(null); renderWhy(bundle); };
    }
    else if (!focus && !activeKind) {
        const beliefs = qBeliefs;
        sectionHead(beliefsBox, "Folklore, checked", beliefs.length);
        el(beliefsBox, "p", "hint", "Widely believed, rarely trialled. These never gate a plan - they answer the question you were going to ask.");
        for (const b of beliefs)
            beliefCard(b, beliefsBox, bundle);
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
        el(rulesBox, "p", "hint", unverified === 0
            ? `${all.length} rules. Every one has been checked against its sources or settled without a ` +
                `trial. That is a statement about these rules, not about gardening - the folklore below is ` +
                `where the open questions live.`
            : `${all.length} rules. ${unverified} have not yet been confirmed against their sources. ` +
                `We show you which instead of hiding it.`);
    }
    for (const r of rules)
        ruleCard(r, rulesBox, !!focus);
    if (!rules.length)
        el(rulesBox, "p", "hint", focus ? "that suggestion's rule is unavailable." : "no rules match that search.");
    const nxt = document.querySelector(".whynext");
    if (nxt) {
        if (focus)
            rulesBox.after(nxt);
        else
            document.getElementById("page-why")?.append(nxt);
    }
}
