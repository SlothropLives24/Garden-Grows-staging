import './chunk-lutet8cz.js';
import { commonName, displayName, renderGlossary, gardenPlants, el, plantHref, confidenceBadge, corpusEs, localiseProse, gardenLat, ruleStanding, corpusWantsEs, markLink } from './core.js';
import { copy, midSentence, humanize, fillCopy, currentRoute, chunkReady, loadChunk, plainClaim } from './paint.js';
import { rulesForSpecies } from './chunk-h8sxf1mq.js';
import { drawEvidence, prose } from './dossiersheet.js';
export { enforcementWords } from './dossiersheet.js';
import { plantAgainst } from './chunk-hbmfsdgg.js';
import { symptoms } from './chunk-h38ll914.js';
import { seeAlsoTip } from './chunk-d4xihojx.js';
import './chunk-l5cseoso.js';
import './chunk-nlhi0qk9.js';

const ghcnDailyCitation = "Menne, Matthew J., Imke Durre, Bryant Korzeniewski, Shelley McNeill, Kristy Thomas, Xungang Yin, Steven Anthony, Ron Ray, Russell S. Vose, Byron E.Gleason, and Tamara G. Houston (2012): Global Historical Climatology Network - Daily (GHCN-Daily), Version 3. Daily minimum temperature (TMIN), stations outside the United States, 1991-2020. NOAA National Climatic Data Center. doi:10.7289/V5D21VHZ. Accessed 2026-10-20.";

const SOIL_TEST_GUIDE = "the-soil-test";
const SOIL_BELIEFS = new Set(["B-006", "B-008", "B-010", "B-015", "B-019"]);
const BELIEF_CROP = {
    "B-001": "ocimum_basilicum",
    "B-020": "raphanus_sativus",
    "B-021": "allium_schoenoprasum",
    "B-022": "chamaemelum_nobile",
    "B-024": "solanum_lycopersicum",
};

const $ = (id) => document.getElementById(id);
function row(parent, anchor, claim, atom, english = false) {
    const card = el(parent, "div", "why-card");
    card.dataset.rule = anchor;
    const a = el(el(card, "h3", "claim"), "a", null, claim);
    if (english && corpusWantsEs())
        a.lang = "en";
    a.href = atom.kind === "rule" ? `#/why?rule=${atom.id}` : `#/why?belief=${atom.id}`;
    markLink(a, atom);
    el(card, "p", "meta");
    return card;
}
function beliefRow(b, parent) {
    const card = row(parent, String(b.id ?? ""), String(b.belief ?? b.id), { kind: "belief", id: String(b.id ?? "") }, true);
    const badge = confidenceBadge(String(b.grade ?? ""));
    if (badge)
        card.querySelector(".meta")?.appendChild(badge);
}
function ruleRow(r, parent) {
    const rec = r;
    const claim = String(rec.claim ?? rec.claim_refuted ?? "").trim();
    const title = String(rec.title ?? "").trim();
    const es = corpusEs(r.id, "title");
    const card = row(parent, r.id, localiseProse(es ?? prose(plainClaim(title || claim, gardenLat()))), { kind: "rule", id: r.id }, !es);
    const meta = card.querySelector(".meta");
    for (const n of ruleStanding(rec))
        meta.appendChild(n);
}
function ruleKnown(r, bundle) {
    const team = bundle.guilds.find((g) => (g.mechanisms ?? []).some((m) => m?.rule === r.id)
        || (g.gates ?? []).includes(r.id));
    const symptom = symptoms(bundle).some((s) => s.rules.includes(r.id));
    const sp = r.applies_to?.species;
    const rec = typeof sp === "string" ? bundle.species.find((x) => x.id === sp) : undefined;
    const crop = rec && !r.claim_refuted && r.ruling !== "block" && !plantAgainst(rec)
        ? String(rec.id) : null;
    return {
        ruleKind: team ? "team" : symptom ? "symptom" : crop ? "crop" : "other",
        ...(team ? { team: team.id, teamName: displayName(team) } : {}),
        ...(crop ? { crop, cropName: midSentence(commonName(bundle, crop) || humanize(crop)) } : {}),
        tip: seeAlsoTip(bundle, [r.id]),
    };
}
function beliefKnown(b, bundle) {
    const id = String(b.id);
    if (SOIL_BELIEFS.has(id))
        return { guide: { slug: SOIL_TEST_GUIDE, title: copy.hfGuideSoilTest } };
    const crop = BELIEF_CROP[id];
    const rec = crop ? bundle.species.find((x) => x.id === crop) : undefined;
    if (!crop || !rec || plantAgainst(rec))
        return {};
    return { crop, cropName: midSentence(commonName(bundle, crop) || humanize(crop)) };
}
function whyTrail(bundle, after, focusRule, focusBelief) {
    let host = document.getElementById("whytrail");
    const nxt = document.querySelector(".whynext");
    const rule = focusRule ? bundle.rules.find((r) => r.id === focusRule) : undefined;
    const belief = focusBelief ? bundle.beliefs.find((b) => String(b.id) === focusBelief) : undefined;
    if (!after || (!rule && !belief)) {
        if (host)
            host.hidden = true;
        if (nxt)
            nxt.hidden = false;
        return;
    }
    if (!host) {
        host = document.createElement("div");
        host.id = "whytrail";
    }
    if (host.previousElementSibling !== after)
        after.after(host);
    if (nxt)
        nxt.hidden = true;
    host.hidden = false;
    const draw = () => {
        const view = chunkReady("trail");
        if (!view || !host.isConnected)
            return;
        if (rule)
            view.drawTrail(host, "whyrule", ruleKnown(rule, bundle));
        else
            view.drawTrail(host, "whybelief", beliefKnown(belief, bundle));
    };
    if (chunkReady("trail"))
        draw();
    else
        void loadChunk("trail").then(draw, () => { host.hidden = true; if (nxt)
            nxt.hidden = false; });
}
function focusView(parent, anchor, atom) {
    const host = el(parent, "div", "why-card why-focus");
    host.dataset.rule = anchor;
    drawEvidence(host, atom);
}
const matches = (hay, q) => !q || hay.some((h) => String(h ?? "").toLowerCase().includes(q));
const KIND_OF_TYPE = {
    geometry: "Spacing", timing: "Timing", thermal: "Timing", advisory: "Advice",
    rotation: "Rotation", nutrient: "Feeding", allelopathy: "Neighbours", pollination: "Neighbours",
    provenance: "Climate", refutation: "Myths",
};
const KIND_LABEL = {
    Spacing: copy.wyKindSpacing, Timing: copy.wyKindTiming, Advice: copy.wyKindAdvice, Rotation: copy.wyKindRotation,
    Feeding: copy.wyKindFeeding, Neighbours: copy.wyKindNeighbours, Climate: copy.wyKindClimate, Myths: copy.wyKindMyths,
};
const kindLabel = (kind) => KIND_LABEL[kind] ?? kind;
const ruleKind = (r) => KIND_OF_TYPE[String(r.type ?? "")] ?? "Advice";
let activeKind = null;
let activeSection = "beliefs";
function setWhyKind(kind) { activeKind = kind; }
let activePlant = null;
function setWhyPlant(sid) { activePlant = sid; }
const GARDEN_CHIPS_MAX = 6;
let browsing = false;
let gardenViewOn = false;
function syncWhyHash() {
    if (focusRuleId || focusBeliefId)
        return;
    if (/[?&](rule|belief|climate)\b/.test(location.hash))
        return;
    const q = $("whyq")?.value.trim() ?? "";
    const p = new URLSearchParams();
    if (activeKind)
        p.set("kind", activeKind);
    if (activePlant)
        p.set("plant", activePlant);
    if (q)
        p.set("q", q);
    const qs = p.toString();
    const next = "#/why" + (qs ? "?" + qs : "");
    if (location.hash !== next)
        history.replaceState(null, "", next);
}
let focusRuleId = null;
function setWhyFocus(id) { focusRuleId = id; }
let focusBeliefId = null;
function setWhyBeliefFocus(id) { focusBeliefId = id; }
const FIELD_LABEL = {
    provides_load_vines: copy.wyFieldLoadVines,
    n_fixed_kg_ha_season: copy.wyFieldNFixed,
    n_available_to_neighbors_same_season: copy.wyFieldNNeighbours,
    biomass_k_content: copy.wyFieldLeafK,
    block_min_plants: copy.wyFieldBlockMin,
    gdd_to_maturity: copy.wyFieldGdd,
    succession_interval_days: copy.wyFieldSuccession,
    root_spread_multiplier: copy.wyFieldRootSpread,
    night_temp_max_c: copy.wyFieldNightTemp,
    threshold_c: copy.wyFieldThreshold,
    germination_soil_temp_c: copy.wyFieldGermTemp,
    yield_lb_per_10ft_row: copy.wyFieldYield,
    plants_per_10ft_row: copy.wyFieldRowPlants,
    light_min: copy.wyFieldLightMin,
    bolt_risk: copy.wyFieldBolt,
    seed_viability_years: copy.wyFieldSeedLife,
    month_mean_temp_c: copy.wyFieldMonthTemp,
    night_temp_min_c: copy.wyFieldNightCool,
    growth_slows_below_c: copy.wyFieldGrowthSlows,
    freeze_line_f: copy.wyFieldFreezeLine,
    harvest_span_days: copy.wyFieldHarvestSpan,
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
        line.textContent = copy.wyNoneFlagged;
        return 0;
    }
    line.textContent = fillCopy(total === 1 ? "wySoftNumbersOne" : "wySoftNumbersMany", { n: total, plants: flagged.length, species: species.length });
    const det = el(box, "details", "flaglist");
    el(det, "summary", null, copy.wyWhichNumbers);
    for (const s of flagged.sort((a, b) => commonName(bundle, a.id).localeCompare(commonName(bundle, b.id)))) {
        const p = el(det, "p", "prov");
        const name = el(p, "a", "pname", commonName(bundle, s.id));
        name.href = plantHref(s.id);
        name.style.fontWeight = "600";
        p.appendChild(document.createTextNode(` - ${s.fields.map((x) => (x.tier === "contested" ? fillCopy("wyFieldContested", { field: fieldLabel(x.f) }) : fieldLabel(x.f))).join("; ")}`));
    }
    return flagged.length;
}
function sectionHead(parent, title, count) {
    const h = el(parent, "h2", "sec", title);
    el(h, "span", "seccount", `\u00a0·\u00a0${count}`);
}
function renderWhy(bundle) {
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
    const plantRules = activePlant ? new Set(rulesForSpecies(activePlant, null, bundle).map((r) => r.id)) : null;
    const plantOk = (r) => !plantRules || plantRules.has(r.id);
    const kindOk = (r) => !activeKind || ruleKind(r) === activeKind;
    const known = new Set(bundle.species.map((sp) => sp.id));
    const mine = gardenPlants()
        .filter((sid) => known.has(sid))
        .map((sid) => ({ sid, ids: new Set(rulesForSpecies(sid, null, bundle).map((r) => r.id)) }))
        .filter((x) => x.ids.size > 0)
        .slice(0, GARDEN_CHIPS_MAX);
    gardenViewOn = !browsing && mine.length > 0 && !focus && !bfocus && !activeKind && !activePlant && !q;
    const gardenRules = new Set(mine.flatMap((x) => [...x.ids]));
    {
        const ctl = document.querySelector("#page-why .controls");
        if (ctl)
            ctl.hidden = gardenViewOn;
    }
    {
        const row = document.getElementById("whygarden");
        if (row) {
            row.innerHTML = "";
            row.hidden = !!focus || !!bfocus || mine.length === 0;
            if (!row.hidden) {
                el(row, "p", "whygarden-h", copy.wyFromYourGarden);
                const chips = el(row, "div", "whygarden-row");
                for (const { sid, ids } of mine) {
                    const c = el(chips, "button", "chip kindchip", `${commonName(bundle, sid)} `);
                    c.type = "button";
                    c.dataset.plant = sid;
                    el(c, "b", null, String(qRules.filter((r) => ids.has(r.id)).length));
                    c.setAttribute("aria-pressed", String(activePlant === sid));
                    c.onclick = () => {
                        activePlant = activePlant === sid ? null : sid;
                        activeSection = "rules";
                        syncWhyHash();
                        renderWhy(bundle);
                    };
                }
            }
        }
    }
    {
        const jump = $("whyjump");
        if (jump) {
            jump.innerHTML = "";
            jump.hidden = !!focus || !!activeKind || !!activePlant || gardenViewOn;
            const jumpTo = (label, count, targetId) => {
                const b = el(jump, "button", "jumpchip", label);
                b.type = "button";
                b.dataset.target = targetId;
                el(b, "b", null, String(count));
                b.onclick = () => {
                    activeSection = targetId;
                    showSection();
                    document.getElementById(targetId)?.scrollIntoView({ block: "start" });
                };
            };
            jumpTo(`${copy.wyJumpFolklore} `, qBeliefs.length, "beliefs");
            jumpTo(`${copy.wyJumpRules} `, qRules.length, "rules");
            if (!q)
                jumpTo(`${copy.wyJumpUnsure} `, flaggedSpecies, "whyspecies");
        }
    }
    {
        const chips = $("whychips");
        if (chips) {
            chips.innerHTML = "";
            chips.hidden = !!focus || gardenViewOn;
            const counts = new Map();
            for (const r of qRules)
                counts.set(ruleKind(r), (counts.get(ruleKind(r)) ?? 0) + 1);
            const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
            const chip = (label, count, kind) => {
                const c = el(chips, "button", "chip kindchip", `${label} `);
                c.type = "button";
                el(c, "b", null, String(count));
                c.setAttribute("aria-pressed", String(activeKind === kind));
                c.onclick = () => {
                    activeKind = activeKind === kind ? null : kind;
                    activeSection = "rules";
                    syncWhyHash();
                    renderWhy(bundle);
                    document.querySelector('#whychips .kindchip[aria-pressed="true"]')
                        ?.scrollIntoView({ inline: "center", block: "nearest" });
                };
            };
            chip(copy.wyAll, qRules.length, null);
            for (const [kind, n] of kinds)
                chip(kindLabel(kind), n, kind);
        }
    }
    {
        const applied = $("whyapplied");
        if (applied) {
            applied.innerHTML = "";
            const on = !focus && !bfocus && (!!activeKind || !!activePlant || !!q);
            applied.hidden = !on;
            if (on) {
                const shown = qRules.filter((r) => kindOk(r) && plantOk(r)).length;
                el(applied, "span", "whyapplied-n", fillCopy(shown === 1 ? "wyShownOfOne" : "wyShownOfMany", { n: shown, all: all.length }));
                const token = (text, clear) => {
                    const t = el(applied, "button", "whytoken");
                    t.type = "button";
                    el(t, "span", null, text);
                    el(t, "span", "whytoken-x", "×");
                    t.setAttribute("aria-label", fillCopy("wyRemoveFilter", { text }));
                    t.onclick = clear;
                };
                if (activeKind)
                    token(kindLabel(activeKind), () => {
                        activeKind = null;
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                if (activePlant)
                    token(commonName(bundle, activePlant), () => {
                        activePlant = null;
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                if (q)
                    token(fillCopy("wySearchToken", { q: ($("whyq")).value.trim() }), () => {
                        ($("whyq")).value = "";
                        syncWhyHash();
                        renderWhy(bundle);
                    });
                const clear = el(applied, "button", "whyclear", copy.wyClear);
                clear.type = "button";
                clear.onclick = () => {
                    activeKind = null;
                    activePlant = null;
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
            focusView(beliefsBox, String(b.id), { kind: "belief", id: String(b.id) });
        if (!one.length)
            el(beliefsBox, "p", "hint", "that claim is not in the corpus.");
        const back = el(beliefsBox, "button", "whyshowall", copy.wyShowAllFolklore);
        back.type = "button";
        back.onclick = () => { setWhyBeliefFocus(null); activeSection = "beliefs"; renderWhy(bundle); };
    }
    else if (!focus && !activeKind && !activePlant && !gardenViewOn) {
        const beliefs = qBeliefs;
        sectionHead(beliefsBox, copy.wyFolkloreChecked, beliefs.length);
        el(beliefsBox, "p", "hint", copy.wyFolkloreHint);
        showInSteps(beliefsBox, beliefs, (b) => beliefRow(b, beliefsBox));
        if (!beliefs.length)
            el(beliefsBox, "p", "hint", copy.wyNoFolkloreMatch);
    }
    const rulesBox = $("rules");
    rulesBox.innerHTML = "";
    const unverified = all.filter((r) => r.evidence?.status === "unverified").length;
    const rules = bfocus ? [] : focus
        ? all.filter((r) => r.id === focus)
        : gardenViewOn ? all.filter((r) => gardenRules.has(r.id))
            : qRules.filter((r) => kindOk(r) && plantOk(r));
    if (gardenViewOn) {
        sectionHead(rulesBox, copy.wyGardenRules, rules.length);
        const all2 = el(rulesBox, "button", "btn btn-secondary whybrowse", copy.wyBrowseEverything);
        all2.type = "button";
        all2.onclick = () => { browsing = true; activeSection = "rules"; renderWhy(bundle); };
    }
    else if (focus) {
        const back = el(rulesBox, "button", "whyshowall", copy.wyShowAllRules);
        back.type = "button";
        back.onclick = () => { setWhyFocus(null); activeSection = "rules"; renderWhy(bundle); };
    }
    else {
        sectionHead(rulesBox, copy.wyTheRules, rules.length);
        el(rulesBox, "p", "hint", `${rules.length === all.length ? fillCopy("wyRulesCount", { n: all.length }) : fillCopy("wyRulesShownOf", { n: rules.length, all: all.length })} ${unverified === 0
            ? copy.wyAllChecked
            : fillCopy("wyUnverified", { n: unverified, all: all.length })}`);
    }
    if (!focus && rules.length)
        el(rulesBox, "p", "whylegend", copy.wyRuleLegend);
    if (focus)
        for (const r of rules)
            focusView(rulesBox, r.id, { kind: "rule", id: r.id });
    else
        showInSteps(rulesBox, rules, (r) => ruleRow(r, rulesBox));
    if (!rules.length)
        el(rulesBox, "p", "hint", focus ? copy.wyRuleUnavailable : copy.wyNoRulesMatch);
    const nxt = document.querySelector(".whynext");
    if (nxt) {
        if (focus)
            rulesBox.after(nxt);
        else
            document.getElementById("page-why")?.append(nxt);
    }
    whyTrail(bundle, focus ? rulesBox : bfocus ? beliefsBox : null, focus, bfocus);
    showSection();
}
const WHY_STEP = 12;
function showInSteps(host, items, draw) {
    let shown = 0;
    const more = document.createElement("button");
    more.type = "button";
    more.className = "btn btn-secondary whymore";
    const take = (from) => (items.length - from - WHY_STEP <= 2 ? items.length - from : WHY_STEP);
    const step = () => {
        const next = items.slice(shown, shown + take(shown));
        for (const x of next)
            draw(x);
        if (more.isConnected) {
            const first = more.nextElementSibling;
            while (more.nextSibling)
                host.insertBefore(more.nextSibling, more);
            if (shown + next.length >= items.length && document.activeElement === more && first) {
                if (!first.hasAttribute("tabindex"))
                    first.tabIndex = -1;
                first.focus();
            }
        }
        else
            host.appendChild(more);
        shown += next.length;
        const left = items.length - shown;
        more.hidden = left <= 0;
        more.textContent = fillCopy("wyShowMore", { n: left > 0 ? take(shown) : 0 });
    };
    more.addEventListener("click", step);
    step();
}
function showSection() {
    const q = document.getElementById("whyq")?.value.trim() ?? "";
    const sec = focusBeliefId ? "beliefs"
        : (focusRuleId || activeKind || activePlant || gardenViewOn) ? "rules"
            : (q && activeSection === "whyspecies") ? "rules" : activeSection;
    for (const id of ["beliefs", "rules", "whyspecies"]) {
        const box = document.getElementById(id);
        if (box)
            box.hidden = id !== sec;
    }
    for (const c of document.querySelectorAll("#whyjump .jumpchip")) {
        c.setAttribute("aria-current", String(c.dataset.target === sec));
    }
    document.getElementById("whychips")?.classList.toggle("off-seg", sec !== "rules");
}
function drawWhySources() {
    const c = document.getElementById("whyclimbody"), d = document.getElementById("whydatabody");
    if (c) {
        c.dataset.copy = "whyClimateBody";
        c.textContent = copy.whyClimateBody;
    }
    if (d) {
        d.dataset.copyKey = "whyDataBody";
        d.textContent = fillCopy("whyDataBody", { citation: ghcnDailyCitation });
    }
}
function initWhyRoute(bundle) {
    drawWhySources();
    renderWhy(bundle);
    $("whyq").addEventListener("input", () => { setWhyFocus(null); syncWhyHash(); renderWhy(bundle); });
    const dec = (v) => { try {
        return decodeURIComponent(v);
    }
    catch {
        return v;
    } };
    const focusWhyFromHash = () => {
        if (currentRoute() !== "why") {
            setWhyFocus(null);
            setWhyBeliefFocus(null);
            return;
        }
        const m = location.hash.match(/[?&]rule=([^&]+)/);
        setWhyFocus(m ? dec(m[1]) : null);
        const bm = location.hash.match(/[?&]belief=([^&]+)/);
        setWhyBeliefFocus(bm ? dec(bm[1]) : null);
        const km = location.hash.match(/[?&]kind=([^&]+)/);
        setWhyKind(!m && !bm && km ? dec(km[1]) : null);
        const pm = location.hash.match(/[?&]plant=([^&]+)/);
        setWhyPlant(!m && !bm && pm ? dec(pm[1]) : null);
        const qm = location.hash.match(/[?&]q=([^&]+)/);
        ($("whyq")).value = !m && !bm && qm ? dec(qm[1]) : "";
        renderWhy(bundle);
        if (m)
            $("rules")?.scrollIntoView({ block: "start" });
        if (bm)
            $("beliefs")?.scrollIntoView({ block: "start" });
        else if (/[?&]climate\b/.test(location.hash))
            $("whyclimate")?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("hashchange", focusWhyFromHash);
    focusWhyFromHash();
}

export { beliefKnown, initWhyRoute, ruleKnown, setWhyBeliefFocus };
