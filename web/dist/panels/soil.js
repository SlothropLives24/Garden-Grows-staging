import { AMENDMENTS, asksFor, capabilities, clubrootCautions, DRAINAGES, drainageCautions, ladder, limeCautions, MEDIUMS, NUTRIENT_LEVELS, NUTRIENTS, PH_MAX, PH_MIN, phCautions, resolveGround, RUNGS, TEXTURES } from "../engine/soil.js";
import { intersectArea } from "../engine/regions.js";
import { toast } from "../notices.js";
import { mark } from "../dossier.js";
import { linkNameIn } from "./plantcard.js";
import { NATIONAL_DIRECTORY } from "./extension_data.js";
import { effectiveState } from "./extension.js";
const $ = (id) => document.getElementById(id);
function titleish(v) {
    const t = v.replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
}
export const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
function unknownFirst(values) {
    return [...values].sort((a, b) => (a === "unknown" ? -1 : b === "unknown" ? 1 : 0));
}
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
const SOURCE_LABEL = {
    declared: "your description",
    field_test: "ribbon test",
    kit: "a home pH kit",
    lab: "a lab report",
};
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
export function groundRows(plot, observations, beds) {
    const rows = [
        { name: "The whole garden", region: null, structure: null, i: 0, obs: null, date: null,
            l: ladder(null, null) },
        ...beds.map((b, n) => ({
            name: b.name, region: b.region ?? null, structure: b.structure ?? null,
            i: n + 1, obs: null, date: null, l: ladder(null, null),
        })),
    ].map((g) => {
        const r = resolveGround(observations, plot, g.region ?? null);
        const o = Object.keys(r.fields).length ? r.fields : null;
        return { ...g, obs: o, date: r.date, l: ladder(o, g.structure, r.src) };
    });
    rows.sort((a, b) => (a.l.rung - b.l.rung) || (a.i - b.i));
    return rows;
}
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
            return false;
        }
    });
}
let selectedBed = "";
function setSoilBed(name) { selectedBed = name; }
let lastArgs = null;
let cardOpen = false;
let allOpen = false;
export function reselectSoilGround(name) {
    selectedBed = name;
    cardOpen = true;
    if (lastArgs)
        renderSoil(...lastArgs);
}
export function renderSoil(plot, observations, lat = null, lon = null, beds = [], plantings = [], groundHistory = null, bundle = null) {
    const panel = $("soil");
    if (!panel)
        return;
    lastArgs = [plot, observations, lat, lon, beds, plantings, groundHistory, bundle];
    panel.innerHTML = "";
    if (!plot)
        return;
    const bed = beds.find((b) => b.name === selectedBed) ?? null;
    if (selectedBed && !bed)
        selectedBed = "";
    const structure = bed?.structure ?? null;
    const ground = resolveGround(observations, plot, bed ? bed.region ?? null : null);
    const current = (Object.keys(ground.fields).length ? ground.fields : null);
    const caps = capabilities(current, structure, ground.src);
    const asks = asksFor(structure);
    const card = document.createElement("details");
    card.className = "soilcard";
    card.id = "soilcard";
    card.open = cardOpen;
    card.addEventListener("toggle", () => { cardOpen = card.open; });
    const head = document.createElement("summary");
    head.textContent = asks === "medium" ? "What this bed is filled with" : "Your soil";
    card.appendChild(head);
    panel.appendChild(card);
    const hint = document.createElement("span");
    hint.className = "soilhint";
    head.appendChild(hint);
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
        const how = SOURCE_LABEL[String(ground.src.texture ?? current.source ?? "")] ?? "your description";
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
    const rungs = ladder(current, structure, ground.src);
    const gaps = beds.length ? groundRows(plot, observations, beds).filter((r) => r.l.rung === 0).length : 0;
    const gapText = gaps ? ` - ${gaps} of ${beds.length + 1} grounds not recorded` : "";
    hint.textContent = (current ? ` - ${rungs.label}` : " - not recorded yet") + gapText;
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
        rungText.textContent += ` Next is "${rungs.next.label}" - ${rungs.next.costs}, and it buys ` +
            `${rungs.next.buys}.`;
    }
    else {
        rungText.textContent += " That is the top of the ladder; there is nothing more we can use.";
    }
    card.appendChild(strip);
    card.appendChild(rungText);
    const growingHere = onThisGround(plantings, bed ? bed.region ?? null : null);
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
        fix.textContent = `Fix the site rather than the plant list: ${wet[0].remedy}.`;
        box.appendChild(fix);
        mark(box, { kind: "rule", id: "R-100" });
        card.appendChild(box);
    }
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
                if (r.species)
                    linkNameIn(li, line, r.label, r.species);
                else
                    li.textContent = line;
                ul.appendChild(li);
            }
            gate.appendChild(ul);
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
        mark(gate, { kind: "rule", id: "R-099" });
        card.appendChild(gate);
    }
    const limed = growingHere
        .map((p) => ({ label: p.label, species: p.species, cautions: limeCautions(ground, p.resolved) }))
        .filter((r) => r.cautions.length);
    if (limed.length) {
        const lime = document.createElement("div");
        lime.className = "soilgate";
        lime.id = "soillime";
        const h = document.createElement("strong");
        h.textContent = "What liming this ground means for what is growing here";
        lime.appendChild(h);
        const ul = document.createElement("ul");
        for (const r of limed) {
            const li = document.createElement("li");
            const line = `${r.label}: ${r.cautions[0].why}`;
            if (r.species)
                linkNameIn(li, line, r.label, r.species);
            else
                li.textContent = line;
            ul.appendChild(li);
        }
        lime.appendChild(ul);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        fix.textContent = "Scab is skin-deep - the tubers still eat - but where it has been a problem, " +
            "put the potatoes on ground you have not limed, choose a scab-resistant variety, keep the " +
            "soil evenly moist for the four to nine weeks after planting while the tubers set, and never " +
            "lime or add wood ash where potatoes are going next. A later pH reading at or below about " +
            "5.2 here would quiet this; we will not give a sulfur rate to get there, because the amount " +
            "needs your lab's buffer pH.";
        lime.appendChild(fix);
        mark(lime, { kind: "rule", id: "R-145" });
        card.appendChild(lime);
    }
    const clubbed = (groundHistory && bundle && current) ? growingHere
        .map((p) => {
        const site = groundHistory(p.region);
        return { label: p.label, species: p.species,
            cautions: site ? clubrootCautions(ground, p.resolved, site, bundle) : [] };
    })
        .filter((r) => r.cautions.length) : [];
    if (clubbed.length) {
        const club = document.createElement("div");
        club.className = "soilgate";
        club.id = "soilclubroot";
        const h = document.createElement("strong");
        h.textContent = "What this pH means on ground that has carried brassicas";
        club.appendChild(h);
        const ul = document.createElement("ul");
        for (const r of clubbed) {
            const li = document.createElement("li");
            const line = `${r.label}: ${r.cautions[0].why}`;
            if (r.species)
                linkNameIn(li, line, r.label, r.species);
            else
                li.textContent = line;
            ul.appendChild(li);
        }
        club.appendChild(ul);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        fix.textContent = "Raise this ground's pH toward 7.2 with lime well ahead of planting - calcitic " +
            "rather than dolomitic unless your magnesium is low - and watch for boron shortage on coarse " +
            "soils once the pH is up. How much lime is your lab's number, not ours: a rate needs the " +
            "buffer pH on a report. Rotation stays the first lever; this is the second.";
        club.appendChild(fix);
        card.appendChild(club);
    }
    const form = document.createElement("div");
    form.className = "soilform";
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
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "soilmeasured";
    if (ground.src.texture === "field_test")
        cb.checked = true;
    if (asks === "soil") {
        const measured = document.createElement("label");
        measured.className = "soilmeasured";
        measured.appendChild(cb);
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
    const phHow = document.createElement("select");
    phHow.id = "soilphsource";
    phHow.setAttribute("aria-label", "How the pH was measured");
    for (const [v, label] of [["kit", "Home pH kit"], ["lab", "Lab report"]]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = label;
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
        repWrap.hidden = !phOn.checked || phHow.value !== "lab";
        repFields.hidden = !repOn.checked;
    };
    syncRep();
    repOn.addEventListener("change", syncRep);
    phHow.addEventListener("change", syncRep);
    phOn.addEventListener("change", syncRep);
    form.appendChild(repWrap);
    const phErr = document.createElement("p");
    phErr.className = "soilpherr";
    phErr.id = "soilpherr";
    phErr.hidden = true;
    form.appendChild(phErr);
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
        const splitPh = phOn.checked;
        const rec = {
            plot,
            date: new Date().toISOString().slice(0, 10),
            source: asks === "soil" && cb.checked ? "field_test" : "declared",
            texture: asks === "medium" ? "unknown" : tsel.value,
            drainage: dsel.value,
        };
        if (asks === "medium")
            rec.medium = msel.value;
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
        if (bed && bed.region)
            rec.region = bed.region;
        if (amend.value)
            rec.amendment = amend.value;
        if (splitPh) {
            const desc = { ...rec };
            delete desc.ph;
            for (const k of ["lab", "report_id", "buffer_ph", "om_pct", "lab_recommendation", "nutrients"]) {
                delete desc[k];
            }
            desc.source = asks === "soil" && cb.checked ? "field_test" : "declared";
            const reading = { ...rec };
            for (const k of ["texture", "drainage", "medium", "amendment"])
                delete reading[k];
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
    mark(test, { kind: "rule", id: "R-017" });
    card.appendChild(test);
}
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
            tr.addEventListener("click", () => goToSoil?.(r.name === "The whole garden" ? "" : r.name));
            table.appendChild(tr);
        }
        host.appendChild(table);
    }
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = beds.length
        ? "Soil is recorded per bed on the Plan tab, under Beds - pick a row to go there."
        : "Soil is recorded on the Plan tab, under Beds.";
    host.appendChild(hint);
}
