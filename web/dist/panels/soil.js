// The soil panel — D-148 P0 through P3, plus SOIL-UX §1 and §4 (docs/SOIL.md, docs/SOIL-UX.md).
//
// P0's tiers (nothing / declared / field-tested) gate nothing, and that is design rather than an
// unfinished state: the user says what they know about their ground, and the app says back, precisely,
// what that does and does not let it reason about.
//
// P1b adds the one field that DOES gate: a MEASURED pH, from a home kit or a lab report. It fires
// R-099 against each plant's floor. Three things about how it is presented here are deliberate:
//
//   - The pH input appears only once the user says a test exists. A number typed into an always-
//     visible box is a number someone will guess at, and the gate must not fire on a guess — the
//     engine enforces the same pairing (a `ph` needs a `kit` or `lab` source).
//   - The one-sided gate is STATED, in the capability report, rather than left to be noticed. A user
//     whose bed reads 7.8 should learn that we say nothing about that, not infer it from silence.
//   - Invariant 3 survives the upgrade. A measured pH buys direction ("lime raises pH") and never an
//     amount, at every tier, and the report keeps saying so after a test exists. That is the
//     direction the invariant is easiest to lose.
//
// P2 adds DRAINAGE, which fires R-100 on waterlogging, and the observation series that makes soil
// expire CAUSALLY rather than annually (SOIL-UX §2). Liming supersedes a pH reading; a calendar does
// not; texture is never re-prompted at all. That is why `latest_for` resolves FIELD-WISE and not
// record-wise — the newest observation is not the best answer for every field inside it, and this is
// the one real data-model change the soil arc cost.
//
// P3 adds a LAB REPORT, and the whole of it is TRANSCRIPTION rather than calculation: nutrients store
// the level word the lab concluded (very_low .. very_high), never the ppm it measured. There is
// deliberately NO ppm input on this panel, and an e2e check asserts that absence — a ppm field would
// invite the app to derive a recommendation from it, which is invariant 3 lost in one step. Invariant
// 3 does not relax at the top rung either: a lab tier buys the LAB's own recommendation repeated
// faithfully, never a number of ours.
//
// Because R-017's remedy should point somewhere rather than nag, the panel links the user's OWN
// land-grant soil lab through the extension directory the app already carries.
import { AMENDMENTS, asksFor, capabilities, DRAINAGES, drainageCautions, ladder, MEDIUMS, NUTRIENT_LEVELS, NUTRIENTS, PH_MAX, PH_MIN, phCautions, resolveGround, RUNGS, TEXTURES } from "../engine/soil.js";
import { intersectArea } from "../engine/regions.js";
import { toast } from "../notices.js";
import { linkNameIn } from "./plantcard.js";
import { NATIONAL_DIRECTORY } from "./extension_data.js";
import { effectiveState } from "./extension.js";
const $ = (id) => document.getElementById(id);
// The pathbar's own check mark (sheet.ts), so the ladder reads as the same system. AN INLINE SVG,
// not a character: D-105 bans the check GLYPH along with every other emoji-presentation symbol, and
// a drawn path is not a glyph. Writing the check as a backslash-u escape instead would have rendered
// the banned symbol while leaving pure ASCII in the source - the emoji guard used to pass that, and
// now decodes escapes before scanning precisely because this file got it wrong first.
/** "sandy_loam" -> "Sandy loam". Local because the engine's labels module is for species names. */
function titleish(v) {
    const t = v.replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
}
export const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
// "I don't know yet" FIRST, in every dropdown, because the first option is what a select shows before
// anyone touches it. With "sand" first, a gardener who opened the card and hit save recorded a
// DECLARATION that their soil is sandy - a fabricated observation produced by the UI's default, which
// is precisely what this feature exists not to do. Unknown-first makes the default answer the honest
// one. (Engine order is unchanged: it is a closed vocabulary, and its order is in the conformance
// error strings.)
function unknownFirst(values) {
    return [...values].sort((a, b) => (a === "unknown" ? -1 : b === "unknown" ? 1 : 0));
}
// Plain-language labels for a vocabulary the corpus keeps as slugs. A ribbon test in the palm is what
// these describe, so they are written as what the gardener FEELS, not as a texture-triangle class.
const TEXTURE_LABEL = {
    sand: "Sandy - gritty, won't hold a shape",
    sandy_loam: "Sandy loam - mostly gritty, holds together damp",
    loam: "Loam - crumbly, holds a shape and breaks easily",
    clay_loam: "Clay loam - smooth, holds a shape firmly",
    clay: "Clay - sticky, ribbons out when rolled",
    unknown: "I don't know yet",
};
const DRAINAGE_LABEL = {
    fast: "Drains fast - dry again within an hour",
    free: "Drains freely - no puddles a few hours after rain",
    slow: "Drains slowly - damp for a day or more",
    waterlogged: "Waterlogs - water stands after rain",
    unknown: "I don't know yet",
};
// What a container or raised bed is FILLED with. A different question from what the ground is made
// of, and asked instead of texture rather than beside it: a bought mix has no ribbon-test class, so
// asking a container gardener to choose between "sandy" and "clay" collects a fiction.
// How the reading was arrived at, in the user's words. `kit` and `lab` are the P1b tiers.
const SOURCE_LABEL = {
    declared: "your description",
    field_test: "ribbon test",
    kit: "a home pH kit",
    lab: "a lab report",
};
// A lab's own vocabulary, in its own order (low to high). We repeat the word the report used; we
// never convert it into an amount, and there is deliberately no place to type a ppm figure.
const NUTRIENT_NAME = {
    p: "Phosphorus (P)", k: "Potassium (K)", ca: "Calcium (Ca)", mg: "Magnesium (Mg)", s: "Sulfur (S)",
};
const LEVEL_LABEL = {
    very_low: "Very low", low: "Low", medium: "Medium",
    optimum: "Optimum", high: "High", very_high: "Very high",
};
const MEDIUM_LABEL = {
    purchased_mix: "Bought potting or raised-bed mix",
    compost_blend: "My own blend - compost, and whatever I added",
    native_soil: "Filled with soil dug from the garden",
    unknown: "I don't know yet",
};
let hooks = null;
export function setSoilHooks(h) { hooks = h; }
/** Every ground this plot has — the whole garden, then each bed — with its latest observation and the
 *  rung it reaches, SORTED LEAST-KNOWN FIRST.
 *
 *  Shared by the soil card and the Log's soil section deliberately: two surfaces answering "which
 *  ground have I never recorded?" differently would be worse than not answering it twice. Ties keep
 *  declaration order, so the list does not reshuffle under the user as they record things. */
export function groundRows(plot, observations, beds) {
    const rows = [
        { name: "The whole garden", region: null, structure: null, i: 0, obs: null, date: null,
            l: ladder(null, null) },
        ...beds.map((b, n) => ({
            name: b.name, region: b.region ?? null, structure: b.structure ?? null,
            i: n + 1, obs: null, date: null, l: ladder(null, null),
        })),
    ].map((g) => {
        // RESOLVED, not "latest record": a bed whose texture was field-tested in 2024 and which got a
        // drainage note last week still knows its texture, and its rung must reflect that.
        const r = resolveGround(observations, plot, g.region ?? null);
        const o = Object.keys(r.fields).length ? r.fields : null;
        // `r.src` MATTERS HERE: without it the ladder reads the resolved scalar `source` and demotes this
        // ground the moment any later partial observation is logged against it.
        return { ...g, obs: o, date: r.date, l: ladder(o, g.structure, r.src) };
    });
    rows.sort((a, b) => (a.l.rung - b.l.rung) || (a.i - b.i));
    return rows;
}
/** The plantings that sit on the selected ground. Whole-garden selects everything in the plot; a bed
 *  selects what geometrically OVERLAPS it — the same attribution rotation history uses (D-002), not a
 *  bed-name match, because plantings record plot coordinates and a bed is geometry laid over them. */
function onThisGround(plantings, bedRegion) {
    if (!bedRegion)
        return plantings;
    return plantings.filter((p) => {
        if (!p.region)
            return false;
        try {
            return intersectArea(bedRegion, p.region) > 0;
        }
        catch {
            return false; // an unparseable region attributes to nothing rather than to everything
        }
    });
}
// Which ground the card is talking about. Session-only, like the guild role picks: a per-bed reading
// is a different SERIES from the whole garden's (soil.latestFor keys on the region), so switching the
// picker switches which record is shown and which one a save writes.
let selectedBed = "";
export function setSoilBed(name) { selectedBed = name; }
// The last arguments renderSoil was called with, so the card can redraw ITSELF when something
// outside it changes the selected ground. Needed because `go()` switches pages without triggering an
// app redraw: the Log's soil rows set the ground and navigate, and without this the card arrives
// still showing whatever was picked before - which is exactly how the e2e check for it first failed.
let lastArgs = null;
// WHETHER THE CARD IS OPEN, kept across re-renders. renderSoil rebuilds its <details> from scratch on
// every draw, and a fresh <details> defaults to CLOSED - so before this, the card collapsed under the
// user on ANY redraw: saving a reading, switching ground with its own picker, or arriving from the
// Log's soil section. Reported from the phone as "I select a bed and the soil section closes".
//
// Session-only, like selectedBed. Default false because collapsed-by-default is the design (step 2's
// job is draw -> name -> save); this remembers a deliberate open, it does not change the default.
let cardOpen = false;
let allOpen = false;
/** Select a ground and redraw the card, from outside the card. Used by the Log's soil section. */
export function reselectSoilGround(name) {
    selectedBed = name;
    // Arriving from elsewhere means the user asked to SEE this ground, so the card opens even if they
    // had it folded. `go` would open it too, but only if the element it resolved still exists by the
    // time it scrolls - which is exactly the race this function creates by rebuilding the DOM.
    cardOpen = true;
    if (lastArgs)
        renderSoil(...lastArgs);
}
/** Render the soil card: which ground, what we know about it, what that buys, and how to know more.
 *  `beds` carries each bed's declared structure (D-141), because a container is asked what it is
 *  FILLED with while native ground is asked what it is MADE of - different questions, and asking the
 *  wrong one collects a fiction. */
export function renderSoil(plot, observations, lat = null, lon = null, beds = [], plantings = []) {
    const panel = $("soil");
    if (!panel)
        return;
    lastArgs = [plot, observations, lat, lon, beds, plantings];
    panel.innerHTML = "";
    if (!plot)
        return; // no garden yet - the Where card's own callout covers that
    const bed = beds.find((b) => b.name === selectedBed) ?? null;
    if (selectedBed && !bed)
        selectedBed = ""; // a bed was renamed or removed - fall back to the garden
    const structure = bed?.structure ?? null;
    // FIELD-WISE (UX-B). `current` is a RESOLVED view - each field from the newest observation that
    // carried it, with its own date and its own provenance - not the newest record. A pH taken before
    // the gardener limed this ground is absent from it entirely, not merely marked.
    const ground = resolveGround(observations, plot, bed ? bed.region ?? null : null);
    const current = (Object.keys(ground.fields).length ? ground.fields : null);
    const caps = capabilities(current, structure, ground.src);
    const asks = asksFor(structure);
    // COLLAPSED BY DEFAULT (maintainer, 2026-07-25). Step 2's job is: draw a bed, name it, save it. Soil
    // is optional, changes nothing yet (P0 gates nothing), and a card that pushes the Save button down
    // the page taxes every first-time user to serve a few. So it folds, and the SUMMARY carries the
    // current reading — a returning user sees what they told us without expanding anything.
    const card = document.createElement("details");
    card.className = "soilcard";
    card.id = "soilcard";
    card.open = cardOpen;
    card.addEventListener("toggle", () => { cardOpen = card.open; });
    const head = document.createElement("summary");
    head.textContent = asks === "medium" ? "What this bed is filled with" : "Your soil";
    card.appendChild(head);
    panel.appendChild(card);
    // A one-line hint beside the title: what is on file for this ground, or that nothing is.
    const hint = document.createElement("span");
    hint.className = "soilhint";
    head.appendChild(hint);
    // WHICH GROUND. Whole-garden by default; a bed keeps its own series, which is the point of per-bed
    // soil - a raised bed's bought mix is not a fact about the yard it stands in.
    if (beds.length) {
        const pick = document.createElement("p");
        pick.className = "soilbedpick";
        const sel = document.createElement("select");
        sel.id = "soilbed";
        sel.setAttribute("aria-label", "Which ground");
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "The whole garden";
        sel.appendChild(all);
        for (const b of beds) {
            const o = document.createElement("option");
            o.value = b.name;
            o.textContent = b.structure && b.structure !== "in_ground" ? `${b.name} (${b.structure})` : b.name;
            if (b.name === selectedBed)
                o.selected = true;
            sel.appendChild(o);
        }
        sel.addEventListener("change", () => {
            setSoilBed(sel.value);
            renderSoil(plot, observations, lat, lon, beds, plantings);
        });
        pick.appendChild(sel);
        card.appendChild(pick);
    }
    // What we have been told, and when. The date is shown because it is the point of keeping a series:
    // soil is amended and compacted, and a reading is about the ground as it was that day.
    const state = document.createElement("p");
    state.className = "soilstate";
    if (current && asks === "medium") {
        const medium = current.medium ? String(current.medium) : "unknown";
        const drainage = current.drainage ? String(current.drainage) : null;
        state.textContent = `${MEDIUM_LABEL[medium] ?? medium}` +
            (drainage && drainage !== "unknown" ? `. ${DRAINAGE_LABEL[drainage] ?? drainage}` : "") +
            ` - recorded ${String(ground.as_of.medium ?? ground.date ?? "")}.`;
    }
    else if (current) {
        const texture = String(current.texture ?? "unknown");
        const drainage = current.drainage ? String(current.drainage) : null;
        // ATTRIBUTED PER FIELD, like the date beside it. This sentence leads with the texture, so its
        // "from" clause is the TEXTURE's provenance - `ground.src.texture`, not the record-level `source`
        // a pH reading overwrites. Reading the scalar made this line claim a clay texture came "from a
        // home pH kit" the moment a pH was recorded, which is the same fault as the ribbon checkbox one
        // field over: the date was already resolved field-wise here and the source was not.
        const how = SOURCE_LABEL[String(ground.src.texture ?? current.source ?? "")] ?? "your description";
        // The pH carries its own tier when it differs, because "from a ribbon test" must never look like
        // it is answering for the number beside it.
        const phHow = SOURCE_LABEL[String(ground.src.ph ?? "")] ?? "";
        const phPart = typeof current.ph === "number"
            ? `. pH ${current.ph}${phHow && ground.src.ph !== ground.src.texture ? ` from ${phHow}` : ""}`
            : "";
        state.textContent = `${TEXTURE_LABEL[texture] ?? texture}` +
            (drainage && drainage !== "unknown" ? `. ${DRAINAGE_LABEL[drainage] ?? drainage}` : "") +
            phPart +
            ` - from ${how}, ${String(ground.as_of.texture ?? ground.date ?? "")}.`;
    }
    else {
        state.textContent = bed
            ? `Nothing recorded for ${bed.name} yet.`
            : "You haven't told us anything about your soil yet.";
    }
    card.appendChild(state);
    // The summary says what is on file, so the fold costs a returning user nothing.
    // Computed here rather than beside the strip below, because the collapsed SUMMARY needs it too.
    const rungs = ladder(current, structure, ground.src);
    // THE SUMMARY CARRIES THE RUNG, so the fold costs a returning gardener nothing and the ladder is
    // discoverable without expanding. SOIL-UX's own constraint asked for this and the first build left
    // the summary showing only the reading, which meant a gardener who never opened the card never
    // learned there was a ladder at all.
    //
    // FACTUAL, NEVER EXHORTATIVE. "field tested - 2 of 4 grounds not recorded" is a state; "complete
    // your soil profile" would be an instruction, and an instruction in a summary line is the nag this
    // card exists not to be.
    const gaps = beds.length ? groundRows(plot, observations, beds).filter((r) => r.l.rung === 0).length : 0;
    const gapText = gaps ? ` - ${gaps} of ${beds.length + 1} grounds not recorded` : "";
    hint.textContent = (current ? ` - ${rungs.label}` : " - not recorded yet") + gapText;
    // THE LADDER (SOIL-UX §1). The rung reached and what the NEXT one costs and buys - never a
    // percentage, because a percentage implies rung 4 on every bed is the goal, and it is not. The
    // "what it buys" line is what makes this a decision rather than an instruction: a gardener who
    // reads "a lab test, about $20 and two weeks" and decides against it has used this correctly.
    //
    // Reuses the pathbar's grammar (numbered nodes, connectors, the same inline check) so it reads as
    // one system - but it lives INSIDE this card, because D-140 fixes the top-level spine at three
    // steps and soil is not one of them.
    const strip = document.createElement("div");
    strip.className = "soilladder";
    strip.id = "soilladder";
    strip.setAttribute("aria-label", `Soil detail: ${rungs.label}`);
    for (let i = 1; i < RUNGS.length; i++) {
        if (i > 1) {
            const conn = document.createElement("span");
            conn.className = "lconn" + (i - 1 <= rungs.rung ? " done" : "");
            strip.appendChild(conn);
        }
        const node = document.createElement("span");
        node.className = "lnode" + (i <= rungs.rung ? " done" : "") + (i === rungs.rung + 1 ? " next" : "");
        if (i <= rungs.rung)
            node.innerHTML = CHECK_SVG;
        else
            node.textContent = String(i);
        node.title = RUNGS[i];
        strip.appendChild(node);
    }
    const rungText = document.createElement("p");
    rungText.className = "soilrung";
    rungText.textContent = rungs.rung === 0
        ? `Nothing recorded for this ground yet.`
        : `You are at "${rungs.label}".`;
    if (rungs.next) {
        // The cost comes BEFORE the benefit, on purpose: the gardener should be able to stop reading at
        // the price if the price is the answer.
        rungText.textContent += ` Next is "${rungs.next.label}" - ${rungs.next.costs}, and it buys ` +
            `${rungs.next.buys}.`;
    }
    else {
        rungText.textContent += " That is the top of the ladder; there is nothing more we can use.";
    }
    card.appendChild(strip);
    card.appendChild(rungText);
    // Which plantings sit on the selected ground - needed by both gates below.
    const growingHere = onThisGround(plantings, bed ? bed.region ?? null : null);
    // SUPERSESSION (SOIL-UX §2). The pH is GONE from the resolved fields, not greyed - so this notice
    // exists to explain a disappearance rather than to decorate a value. Without it the gardener sees
    // a pH they entered simply stop being there, which is worse than never having shown it.
    //
    // NOTHING HERE IS CALENDAR-BASED. The reading did not expire; the gardener changed the ground.
    if (ground.superseded.ph) {
        const sup = document.createElement("p");
        sup.className = "soilsuperseded";
        sup.id = "soilsuperseded";
        const by = String(ground.superseded.ph.by ?? "an amendment");
        sup.textContent = `Your pH reading is from before you applied ${by} here on ` +
            `${String(ground.superseded.ph.date ?? "")}, so it no longer describes this ground and ` +
            `nothing is gated on it. A fresh reading would tell you whether the ${by} did what you wanted.`;
        card.appendChild(sup);
    }
    // THE HONESTY REPORT. Every line the engine can honestly say about what it cannot do - the whole
    // product of P0. FOLDED with the count on the lid (O12, approved mockup 2026-07-29): a standing
    // limit must stay findable - a limit that fades is a limit nobody can audit - but it need not
    // occupy the screen on every visit. The fold is persistent, never transient; the count says how
    // much is under the lid before you lift it.
    if (caps.limits.length) {
        const fold = document.createElement("details");
        fold.className = "limits";
        fold.id = "soillimitsfold";
        const sum = document.createElement("summary");
        const label = document.createElement("span");
        label.textContent = "What we cannot judge here yet";
        const count = document.createElement("span");
        count.className = "limitcount";
        count.textContent = String(caps.limits.length);
        sum.append(label, count);
        fold.appendChild(sum);
        const limits = document.createElement("ul");
        limits.className = "soillimits";
        for (const l of caps.limits) {
            const li = document.createElement("li");
            li.textContent = l;
            limits.appendChild(li);
        }
        fold.appendChild(limits);
        card.appendChild(fold);
    }
    // THE REPORT, REPEATED BACK (P3). Not interpreted, not converted, not scaled to a bed - repeated,
    // with the lab's name and the report's date on it, because that attribution is what makes it worth
    // more than anything this app could say. R-101's line about the lime rate is in the capability
    // report above; this block is the transcription itself.
    if (caps.report) {
        const rep = document.createElement("div");
        rep.className = "soilreport";
        rep.id = "soilreport";
        const h = document.createElement("strong");
        h.textContent = current.lab ? `From ${String(current.lab)}` : "From your lab report";
        rep.appendChild(h);
        const nut = (current.nutrients ?? {});
        const keys = NUTRIENTS.filter((k) => typeof nut[k] === "string");
        if (keys.length) {
            const ul = document.createElement("ul");
            for (const k of keys) {
                const li = document.createElement("li");
                li.textContent = `${NUTRIENT_NAME[k] ?? k}: ${LEVEL_LABEL[String(nut[k])] ?? String(nut[k])}`;
                ul.appendChild(li);
            }
            rep.appendChild(ul);
        }
        if (typeof current.om_pct === "number") {
            const om = document.createElement("p");
            om.textContent = `Organic matter ${current.om_pct}%.`;
            rep.appendChild(om);
        }
        if (typeof current.lab_recommendation === "string") {
            // VERBATIM, and marked as a quotation so it never reads as the app's own advice.
            const q = document.createElement("blockquote");
            q.className = "soillabrec";
            q.textContent = current.lab_recommendation;
            rep.appendChild(q);
            const attrib = document.createElement("p");
            attrib.className = "provenance";
            attrib.textContent = `Your lab's own words, ${String(current.date ?? "")}` +
                (current.report_id ? `, report ${String(current.report_id)}` : "") +
                ". We repeat it; we do not convert it, scale it to a bed, or add to it.";
            rep.appendChild(attrib);
        }
        card.appendChild(rep);
    }
    // R-100, THE WATERLOGGING GATE (P2). Shown ABOVE the pH gate because it is the bigger problem and
    // the one with a remedy that changes the site rather than the planting list: if this ground stands
    // water, the pH of it is not the thing to fix first.
    //
    // It consults no species data at all - waterlogging is a property of the ground. The only thing the
    // plants change is the mound HEIGHT quoted, which is the one number the sources make conditional.
    const wet = drainageCautions(current, growingHere.some((p) => p.resolved.lifespan === "perennial"));
    if (wet.length) {
        const box = document.createElement("div");
        box.className = "soilgate soilwet";
        box.id = "soilwet";
        const h = document.createElement("strong");
        h.textContent = "This ground stands water";
        box.appendChild(h);
        const why = document.createElement("p");
        why.textContent = wet[0].why;
        box.appendChild(why);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        // "Fix the site, not the planting list" is the whole shape of this rule, so the remedy leads.
        fix.textContent = `Fix the site rather than the plant list: ${wet[0].remedy}.`;
        box.appendChild(fix);
        card.appendChild(box);
    }
    // R-099, THE pH GATE — the first thing soil has ever changed about what the app says. Shown right
    // under the honesty report, because it is the payoff for the sentence above it that used to read
    // "no soil test: pH-sensitive plants are not gated".
    //
    // ONE-SIDED, and the card says so rather than leaving it to be inferred: a gardener whose bed reads
    // 7.8 must learn that we say nothing about the high side, not conclude from silence that they are
    // fine. The capability report carries that line; this block carries the plants.
    // THE READING'S OWN PROVENANCE, HANDED IN DELIBERATELY. phCautions reads `obs.source` for one
    // purpose - whether to attach the home kit's +/-0.5 error bar - and `current` is a RESOLVED field
    // map whose scalar `source` is last-writer-wins across records. So a drainage note logged a fortnight
    // after a kit reading resolved `source` to "declared" and SILENTLY STRIPPED THE ERROR BAR: a
    // marginal 0.4-below-floor reading was presented as definitive. The engine is right to read the
    // reading's source; it is this caller's job to hand it one, since `current` is synthesised here
    // anyway. Pre-existing and independent of the description/reading split - the ux-b flow (log
    // standing water after a lab pH) already reached it.
    const forPh = current
        ? { ...current, source: ground.src.ph ?? current.source }
        : null;
    const fired = growingHere
        .map((p) => ({ label: p.label, species: p.species, cautions: phCautions(forPh, p.resolved) }))
        .filter((r) => r.cautions.length);
    if (caps.gates_rules && growingHere.length) {
        const gate = document.createElement("div");
        gate.className = "soilgate";
        gate.id = "soilgate";
        const h = document.createElement("strong");
        h.textContent = "What this pH means for what is growing here";
        gate.appendChild(h);
        if (fired.length) {
            const ul = document.createElement("ul");
            for (const r of fired) {
                const li = document.createElement("li");
                const line = `${r.label}: ${r.cautions[0].why}`;
                // The plant this caution is ABOUT opens its card. A gardener told their pH is wrong for a
                // plant is exactly who wants that plant's record - the same argument as the Plan's blocked
                // list, which is the closest sibling of this surface.
                if (r.species)
                    linkNameIn(li, line, r.label, r.species);
                else
                    li.textContent = line;
                ul.appendChild(li);
            }
            gate.appendChild(ul);
            // The remedy is a DIRECTION and a test, never an amount (invariant 3). The lab link below is
            // the rest of this sentence.
            const fix = document.createElement("p");
            fix.className = "soilgatefix";
            fix.textContent = "Lime raises pH and sulfur lowers it. We will not tell you how much of " +
                "either: the amount depends on your soil's buffering capacity, and only a lab report's " +
                "buffer pH measures that. These floors are estimates too - the pH at which extension says " +
                "to lime, not the pH at which a plant dies.";
            gate.appendChild(fix);
        }
        else {
            const ok = document.createElement("p");
            ok.textContent = `Nothing growing here sits below its floor at pH ${String(current.ph)}.`;
            gate.appendChild(ok);
        }
        card.appendChild(gate);
    }
    // The form: two selects and a save. Texture is required (with "I don't know yet" as a real answer),
    // drainage is optional.
    const form = document.createElement("div");
    form.className = "soilform";
    // THE QUESTION DEPENDS ON THE BED'S STRUCTURE (D-141). A container or raised bed is asked what it
    // is FILLED with; native ground is asked what it is MADE of. The texture select is not merely
    // relabelled for a container - it is absent, because a bought mix has no ribbon-test class and
    // offering "sandy / loam / clay" would collect an answer that means nothing.
    const msel = document.createElement("select");
    const tsel = document.createElement("select");
    if (asks === "medium") {
        msel.id = "soilmedium";
        msel.setAttribute("aria-label", "What this bed is filled with");
        for (const m of unknownFirst(MEDIUMS)) {
            const o = document.createElement("option");
            o.value = m;
            o.textContent = MEDIUM_LABEL[m] ?? m;
            if (current && current.medium === m)
                o.selected = true;
            msel.appendChild(o);
        }
        form.appendChild(msel);
    }
    else {
        tsel.id = "soiltexture";
        tsel.setAttribute("aria-label", "Soil texture");
        for (const t of unknownFirst(TEXTURES)) {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = TEXTURE_LABEL[t] ?? t;
            if (current && current.texture === t)
                o.selected = true;
            tsel.appendChild(o);
        }
        form.appendChild(tsel);
    }
    const dsel = document.createElement("select");
    dsel.id = "soildrainage";
    dsel.setAttribute("aria-label", "Soil drainage");
    for (const d of unknownFirst(DRAINAGES)) {
        const o = document.createElement("option");
        o.value = d;
        o.textContent = DRAINAGE_LABEL[d] ?? d;
        if (current && current.drainage === d)
            o.selected = true;
        dsel.appendChild(o);
    }
    form.appendChild(dsel);
    // Declared vs measured is a real distinction and the user is the only one who knows which it was,
    // so it is asked rather than inferred. It changes the capability report, not any gate. A ribbon test
    // is a question about SOIL, so a container - whose fill came out of a bag - is not asked it.
    //
    // IT READS PER-FIELD PROVENANCE, NOT THE RECORD'S `source`. A record has one `source`, and a pH
    // reading overwrites it with "kit"/"lab" because that is the source the gate reads - so testing
    // `current.source` unticked this box for everyone who entered a pH, no matter what they had done
    // with their hands. `ground.src` is the field-wise answer resolveGround exists to give.
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "soilmeasured";
    if (ground.src.texture === "field_test")
        cb.checked = true;
    if (asks === "soil") {
        const measured = document.createElement("label");
        measured.className = "soilmeasured";
        measured.appendChild(cb);
        // WHAT THE TEST IS LOOKING FOR, not just what you do with your hands (maintainer, 2026-07-27).
        // The ribbon's LENGTH before it breaks is the reading; without that sentence the box asks the
        // user to confirm a test it never described.
        measured.appendChild(document.createTextNode(" I did a ribbon test: squeeze damp soil into a ribbon between thumb and finger - how far it " +
            "gets before it breaks is what separates sand from loam from clay"));
        form.appendChild(measured);
        const ribbonHint = document.createElement("p");
        ribbonHint.className = "soilribbonhint";
        ribbonHint.textContent = "Under an inch is sandy, one to two inches is loam, over two is clay. " +
            "Ticking this records your texture as measured rather than guessed; it changes how we grade " +
            "what we say, and gates nothing.";
        form.appendChild(ribbonHint);
    }
    // THE pH BLOCK (P1b). Gated behind "I have a soil test result" for the same reason the engine
    // pairs `ph` with a kit/lab source: an always-visible number box invites a guess, and a guessed pH
    // would fire a real rule on nothing. A container gets this too - a bought mix has a pH, and it
    // matters most for exactly the acid-lovers people grow in pots.
    const phOn = document.createElement("input");
    phOn.type = "checkbox";
    phOn.id = "soilhastest";
    const phWrap = document.createElement("div");
    phWrap.className = "soilph";
    const phLabel = document.createElement("label");
    phLabel.appendChild(phOn);
    phLabel.appendChild(document.createTextNode(" I have a pH result for this ground"));
    phWrap.appendChild(phLabel);
    const phFields = document.createElement("div");
    phFields.className = "soilphfields";
    const phNum = document.createElement("input");
    phNum.type = "number";
    phNum.id = "soilph";
    phNum.step = "0.1";
    phNum.min = String(PH_MIN);
    phNum.max = String(PH_MAX);
    phNum.setAttribute("aria-label", "Measured soil pH");
    phNum.placeholder = "e.g. 6.4";
    // WHICH KIND OF TEST changes what we say, not just what we store: a kit reading carries its own
    // half-unit error bar into the caution text, and a lab reading does not.
    const phHow = document.createElement("select");
    phHow.id = "soilphsource";
    phHow.setAttribute("aria-label", "How the pH was measured");
    for (const [v, label] of [["kit", "Home pH kit"], ["lab", "Lab report"]]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = label;
        // The pH's OWN source again, not the record's: this control asks which test produced the number,
        // and the scalar `source` answers for whatever was written last. Reading it re-selected "Home pH
        // kit" on a lab reading as soon as any description was saved after it.
        if (ground.src.ph === v)
            o.selected = true;
        phHow.appendChild(o);
    }
    phFields.appendChild(phNum);
    phFields.appendChild(phHow);
    phWrap.appendChild(phFields);
    const hasPh = !!current && typeof current.ph === "number";
    if (hasPh) {
        phOn.checked = true;
        phNum.value = String(current.ph);
    }
    const syncPh = () => { phFields.hidden = !phOn.checked; };
    syncPh();
    phOn.addEventListener("change", syncPh);
    form.appendChild(phWrap);
    // THE FULL LAB REPORT (P3). A second, deeper disclosure inside the pH block, because it is the
    // rung almost nobody is on and it should not tax the many who are on rung 3. Everything in it is
    // TRANSCRIPTION: it exists so the app can repeat the report back with the lab's name attached.
    //
    // THERE IS NO PLACE TO TYPE A ppm FIGURE, and that absence is the design. A lab prints "P: 34 ppm
    // (medium)" and this takes "medium" - the word it concluded, which is also the word it wants acted
    // on. A number field here would invite arithmetic, and invariant 3 says the arithmetic is the lab's.
    const repOn = document.createElement("input");
    repOn.type = "checkbox";
    repOn.id = "soilhasreport";
    const repWrap = document.createElement("div");
    repWrap.className = "soilreportform";
    const repLabel = document.createElement("label");
    repLabel.appendChild(repOn);
    repLabel.appendChild(document.createTextNode(" I have the full lab report in front of me"));
    repWrap.appendChild(repLabel);
    const repFields = document.createElement("div");
    repFields.className = "soilreportfields";
    const textInput = (id, ph, val) => {
        const el = document.createElement("input");
        el.type = "text";
        el.id = id;
        el.placeholder = ph;
        el.setAttribute("aria-label", ph);
        if (typeof val === "string")
            el.value = val;
        return el;
    };
    const numInput = (id, ph, val) => {
        const el = document.createElement("input");
        el.type = "number";
        el.id = id;
        el.step = "0.1";
        el.placeholder = ph;
        el.setAttribute("aria-label", ph);
        if (typeof val === "number")
            el.value = String(val);
        return el;
    };
    const labName = textInput("soillab", "Which lab", current?.lab);
    const reportId = textInput("soilreportid", "Report number (optional)", current?.report_id);
    const bufferPh = numInput("soilbufferph", "Buffer pH", current?.buffer_ph);
    const omPct = numInput("soilom", "Organic matter %", current?.om_pct);
    for (const el of [labName, reportId, bufferPh, omPct])
        repFields.appendChild(el);
    // Nutrient LEVELS, as the lab worded them. "Not on my report" is first and is the honest default.
    const nutSel = {};
    const nutGrid = document.createElement("div");
    nutGrid.className = "soilnutrients";
    const currentNut = (current?.nutrients ?? {});
    for (const nkey of NUTRIENTS) {
        const wrap = document.createElement("label");
        wrap.appendChild(document.createTextNode(NUTRIENT_NAME[nkey] ?? nkey));
        const sel = document.createElement("select");
        sel.id = `soilnut-${nkey}`;
        sel.setAttribute("aria-label", `${NUTRIENT_NAME[nkey] ?? nkey} level`);
        const none = document.createElement("option");
        none.value = "";
        none.textContent = "Not on my report";
        sel.appendChild(none);
        for (const lv of NUTRIENT_LEVELS) {
            const o = document.createElement("option");
            o.value = lv;
            o.textContent = LEVEL_LABEL[lv] ?? lv;
            if (currentNut[nkey] === lv)
                o.selected = true;
            sel.appendChild(o);
        }
        wrap.appendChild(sel);
        nutGrid.appendChild(wrap);
        nutSel[nkey] = sel;
    }
    repFields.appendChild(nutGrid);
    const recBox = document.createElement("textarea");
    recBox.id = "soilrecommendation";
    recBox.rows = 3;
    recBox.placeholder = "What your lab recommended, in its words";
    recBox.setAttribute("aria-label", "Your lab's recommendation, copied from the report");
    if (typeof current?.lab_recommendation === "string")
        recBox.value = current.lab_recommendation;
    repFields.appendChild(recBox);
    repWrap.appendChild(repFields);
    const hasReport = !!current && typeof current.lab === "string";
    if (hasReport)
        repOn.checked = true;
    const syncRep = () => {
        // The report lives inside the pH block: a report you have not told us the pH from is not a tier
        // this app models, and the engine refuses report fields on any non-lab source anyway.
        repWrap.hidden = !phOn.checked || phHow.value !== "lab";
        repFields.hidden = !repOn.checked;
    };
    syncRep();
    repOn.addEventListener("change", syncRep);
    phHow.addEventListener("change", syncRep);
    phOn.addEventListener("change", syncRep);
    form.appendChild(repWrap);
    // A pH the engine would refuse is refused HERE too, in the user's words, before a save that would
    // fail silently. The bounds are the oracle's own constants - not a second copy of the rule.
    const phErr = document.createElement("p");
    phErr.className = "soilpherr";
    phErr.id = "soilpherr";
    phErr.hidden = true;
    form.appendChild(phErr);
    // "I AMENDED THIS" (SOIL-UX §2). An ACTION, not a measurement, and the only control here that
    // records something the gardener DID. It is what makes a pH reading stop describing the ground -
    // and only lime and sulfur do that, because only they are applied for their effect on pH.
    const amend = document.createElement("select");
    amend.id = "soilamendment";
    amend.setAttribute("aria-label", "Something I added to this ground");
    const noAmend = document.createElement("option");
    noAmend.value = "";
    noAmend.textContent = "I did not add anything";
    amend.appendChild(noAmend);
    for (const a of AMENDMENTS) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a === "other" ? "Something else" : titleish(a);
        amend.appendChild(o);
    }
    const amendWrap = document.createElement("label");
    amendWrap.className = "soilamend";
    amendWrap.appendChild(document.createTextNode("Added to this ground since last time"));
    amendWrap.appendChild(amend);
    form.appendChild(amendWrap);
    const save = document.createElement("button");
    save.id = "soilsave";
    save.type = "button";
    save.textContent = asks === "medium" ? "Save this bed's fill" : "Save soil";
    save.addEventListener("click", () => {
        if (!hooks)
            return;
        // A pH reading is always its own observation. See the split at the end of this handler.
        const splitPh = phOn.checked;
        const rec = {
            plot,
            date: new Date().toISOString().slice(0, 10),
            source: asks === "soil" && cb.checked ? "field_test" : "declared",
            // texture stays "unknown" for a container/raised bed rather than being omitted: the field is
            // required, and "unknown" is the honest answer for ground whose fill came out of a bag.
            texture: asks === "medium" ? "unknown" : tsel.value,
            drainage: dsel.value,
        };
        if (asks === "medium")
            rec.medium = msel.value;
        // A MEASURED pH overrides the texture-provenance source, because it is the higher tier and the
        // one the gate reads. Without a reading the record stays at whatever tier the texture came from.
        if (phOn.checked) {
            const v = Number(phNum.value);
            if (!phNum.value.trim() || !Number.isFinite(v) || v < PH_MIN || v > PH_MAX) {
                phErr.textContent = `Enter a pH between ${PH_MIN} and ${PH_MAX}, or untick the box. ` +
                    `We would rather record no pH than a guessed one.`;
                phErr.hidden = false;
                return;
            }
            phErr.hidden = true;
            rec.ph = v;
            rec.source = phHow.value;
            // TRANSCRIPTION ONLY. Every field below is copied off the report and is only ever repeated
            // back; nothing here is an input to a calculation, and there is no ppm field to be one.
            if (repOn.checked && phHow.value === "lab") {
                const put = (k, el) => {
                    const t = el.value.trim();
                    if (t)
                        rec[k] = el.type === "number" ? Number(t) : t;
                };
                put("lab", labName);
                put("report_id", reportId);
                put("buffer_ph", bufferPh);
                put("om_pct", omPct);
                put("lab_recommendation", recBox);
                const nutrients = {};
                for (const nkey of NUTRIENTS)
                    if (nutSel[nkey].value)
                        nutrients[nkey] = nutSel[nkey].value;
                if (Object.keys(nutrients).length)
                    rec.nutrients = nutrients;
            }
        }
        // A per-bed reading is its own series - it carries the bed's region, so it never overwrites the
        // whole-garden observation and is never mistaken for one.
        if (bed && bed.region)
            rec.region = bed.region;
        // The amendment rides the same record. It is never carried forward on a later save - it is a
        // dated event, and repeating it would keep re-superseding every new reading.
        if (amend.value)
            rec.amendment = amend.value;
        // ONE SAVE, TWO OBSERVATIONS, when the gardener did two different things. A ribbon test and a pH
        // reading have different provenance, and the validator refuses to carry both in one record: a
        // `ph` demands a kit/lab `source`, so a record holding the pH CANNOT also say the texture was
        // field-tested. Collapsing them lost the ribbon test outright - `capabilities()` reported
        // "texture declared, not measured: a ribbon test would firm it up" to a user who had just told
        // us they did one.
        //
        // Split, resolveGround does exactly what it was built for: texture resolves to the description,
        // ph to the reading, and `src` carries both provenances at once.
        //
        // THE TWO HALVES CARRY DISJOINT FIELDS, which is what makes this safe rather than merely
        // separate. Same-date records resolve in key order, so any field written by BOTH would resolve
        // arbitrarily. The description owns texture/drainage/medium/amendment, the reading owns ph and
        // the report, and neither owns anything of the other's.
        if (splitPh) {
            const desc = { ...rec };
            delete desc.ph;
            for (const k of ["lab", "report_id", "buffer_ph", "om_pct", "lab_recommendation", "nutrients"]) {
                delete desc[k];
            }
            // The description's OWN provenance, untouched by the reading beside it - which is the whole
            // point: this is the field the ribbon-test checkbox reads back.
            desc.source = asks === "soil" && cb.checked ? "field_test" : "declared";
            const reading = { ...rec };
            for (const k of ["texture", "drainage", "medium", "amendment"])
                delete reading[k];
            // BOTH WRITES ISSUED AT ONCE, not chained. Chaining them meant the reading was not even
            // REQUESTED until the description had committed, so a user who navigated away in that gap
            // persisted half of one save - a durability regression against the single write this replaced.
            // Their keys differ, so they cannot race each other, and neither needs the other's result.
            // The confirmation floats only after BOTH commit (O12) - a refused write shows no false "saved".
            void Promise.all([hooks.save(desc), hooks.save(reading)])
                .then(() => toast(`Soil recorded${bed ? ` for “${bed.name}”` : ""}`))
                .catch(() => { });
        }
        else {
            void hooks.save(rec)
                .then(() => toast(`${asks === "medium" ? "Bed fill" : "Soil"} recorded${bed ? ` for “${bed.name}”` : ""}`))
                .catch(() => { });
        }
    });
    form.appendChild(save);
    card.appendChild(form);
    // ACROSS EVERY GROUND (SOIL-UX §4). The picker shows one ground at a time, so "which of my beds
    // have I never tested?" was unanswerable without clicking through all of them. This answers it in
    // one glance.
    //
    // SORTED LEAST-KNOWN FIRST, which is the whole point: the bed nobody has touched belongs at the
    // top, not buried under the ones already done. Ties keep declaration order so the list does not
    // reshuffle under the user as they record things.
    if (beds.length) {
        const rows = groundRows(plot, observations, beds);
        const all = document.createElement("details");
        all.className = "soilall";
        all.id = "soilall";
        all.open = allOpen;
        all.addEventListener("toggle", () => { allOpen = all.open; });
        const sum = document.createElement("summary");
        const untouched = rows.filter((r) => r.l.rung === 0).length;
        sum.textContent = untouched
            ? `Across your ground - ${untouched} of ${rows.length} not recorded yet`
            : `Across your ground - all ${rows.length} recorded`;
        all.appendChild(sum);
        const table = document.createElement("table");
        const head = document.createElement("tr");
        for (const h of ["Ground", "Detail", "pH", "Last recorded"]) {
            const th = document.createElement("th");
            th.textContent = h;
            head.appendChild(th);
        }
        table.appendChild(head);
        for (const r of rows) {
            const tr = document.createElement("tr");
            if (r.l.rung === 0)
                tr.className = "soilgap";
            const cells = [
                r.name,
                r.l.label,
                typeof r.obs?.ph === "number" ? String(r.obs.ph) : "-",
                r.date ? String(r.date) : "-",
            ];
            for (const c of cells) {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            }
            // Clicking a row switches the picker to that ground - the review surface and the entry surface
            // are the same card, so finding a gap and filling it is one motion.
            tr.tabIndex = 0;
            tr.addEventListener("click", () => {
                setSoilBed(r.name === "The whole garden" ? "" : r.name);
                renderSoil(plot, observations, lat, lon, beds, plantings);
            });
            table.appendChild(tr);
        }
        all.appendChild(table);
        card.appendChild(all);
    }
    // R-017 MADE ACTIONABLE. The rule has always said "get a soil test"; this points at the user's own
    // land-grant lab instead of leaving them to find it. Outside the US the directory has no row, so the
    // panel names the national finder rather than guessing at a lab.
    // The SAME state the extension card resolved, correction included (effectiveState) - not a second
    // resolver. Null outside the US, where there is no lab to name and the panel says so instead.
    const lab = effectiveState(lat, lon);
    const test = document.createElement("p");
    test.className = "soiltest";
    test.appendChild(document.createTextNode("A soil test is the only honest source for a fertilizer amount, and it is the one thing " +
        "that would let us gate pH-sensitive plants. "));
    const a = document.createElement("a");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (lab && lab.url) {
        a.href = lab.url;
        a.textContent = `${lab.inst} - ask for a soil test`;
    }
    else {
        a.href = NATIONAL_DIRECTORY;
        a.textContent = "Find your local extension office";
    }
    test.appendChild(a);
    card.appendChild(test);
}
// ---------------------------------------------------------------- the Log's soil section
//
// SOIL ON THE LOG (maintainer, 2026-07-25). "This ground's weather" already sits in the Log rail, and
// soil is its counterpart: the weather panel's own hint says frost and heat land on the whole address
// rather than one bed, and soil is the fact that lands on the BEDS. A season log with no soil in it
// leaves the gardener's most durable ground fact visible only on the planning tab.
//
// READ-ONLY, AND THAT IS THE DESIGN. There is exactly one place to record soil - the card in Your
// ground - because two entry forms for one series would drift, and the one on Plan is the one that
// knows the bed's structure. This section reports and routes: every row jumps to the editor with that
// ground already selected. Capture DURING the season is a different thing and belongs in the
// composer, alongside frost and heat (SOIL-UX section 3, not built).
/** Where the Log's soil section sends the user to actually record something. Set by the app, because
 *  the panel must not know how tabs work. */
let goToSoil = null;
export function setSoilJump(fn) { goToSoil = fn; }
export function renderSoilSummary(plot, observations, beds = []) {
    const host = $("soilsummary");
    if (!host)
        return;
    host.innerHTML = "";
    if (!plot)
        return;
    const rows = groundRows(plot, observations, beds);
    const whole = rows.find((r) => r.region === null) ?? rows[0];
    // The whole garden's rung leads, because it is the one ground every gardener has.
    const strip = document.createElement("div");
    strip.className = "soilladder";
    strip.id = "soilladdersummary";
    strip.setAttribute("aria-label", `Soil detail: ${whole.l.label}`);
    for (let i = 1; i < RUNGS.length; i++) {
        if (i > 1) {
            const conn = document.createElement("span");
            conn.className = "lconn" + (i - 1 <= whole.l.rung ? " done" : "");
            strip.appendChild(conn);
        }
        const node = document.createElement("span");
        node.className = "lnode" + (i <= whole.l.rung ? " done" : "")
            + (i === whole.l.rung + 1 ? " next" : "");
        if (i <= whole.l.rung)
            node.innerHTML = CHECK_SVG;
        else
            node.textContent = String(i);
        node.title = RUNGS[i];
        strip.appendChild(node);
    }
    host.appendChild(strip);
    const line = document.createElement("p");
    line.className = "soilrung";
    line.id = "soilsummaryrung";
    line.textContent = whole.obs
        ? `The whole garden is at "${whole.l.label}", from ${String(whole.date ?? "")}.`
        : "Nothing recorded for the whole garden yet.";
    if (whole.l.next) {
        line.textContent += ` Next is "${whole.l.next.label}" - ${whole.l.next.costs}.`;
    }
    host.appendChild(line);
    // Every ground, same order as the card: least known first, so a gap is the first thing read.
    if (beds.length) {
        const table = document.createElement("table");
        table.id = "soilsummarytable";
        const head = document.createElement("tr");
        for (const h of ["Ground", "Detail", "Last recorded"]) {
            const th = document.createElement("th");
            th.textContent = h;
            head.appendChild(th);
        }
        table.appendChild(head);
        for (const r of rows) {
            const tr = document.createElement("tr");
            if (r.l.rung === 0)
                tr.className = "soilgap";
            for (const c of [r.name, r.l.label, r.date ? String(r.date) : "-"]) {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            }
            tr.tabIndex = 0;
            // Routes rather than edits: one entry surface, and it is the one that knows the bed structure.
            tr.addEventListener("click", () => goToSoil?.(r.name === "The whole garden" ? "" : r.name));
            table.appendChild(tr);
        }
        host.appendChild(table);
    }
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = beds.length
        ? "Soil is recorded per bed on the Plan tab, under Your ground - pick a row to go there."
        : "Soil is recorded on the Plan tab, under Your ground.";
    host.appendChild(hint);
}
