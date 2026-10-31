import '../chunk-lutet8cz.js';
import { formatValue, cardRecord, cardRows, sectioned, rulesForSpecies } from '../chunk-h8sxf1mq.js';
import { beforeYouSow } from '../chunk-ngdzafki.js';
import { corpusText, localiseProse, fmtCmValue, dayWord, el, commonName, plantingLabel, englishName, app, plantHref, markControl, mark, ruleClaim, markLink, ruleStanding, displayName, tempSystem, unitSystem } from '../core.js';
export { claimLabels, linkNameIn, linkNamesIn, plantLink, splitAroundLabel } from '../core.js';
import { copy, fillCopy, appLang, currentRoute, labelCopy, familyName, stripRuleCitations } from '../paint.js';
import { licenceWord } from '../chunk-jij456u7.js';
import { provenanceReady, ensureProvenance } from '../chunk-nlhi0qk9.js';
import { harvestFacts } from '../chunk-cph1bzsd.js';
import { potSize, teamsForPlant } from '../chunk-k60vt8tj.js';
import { symptoms, symptomFits } from '../chunk-h38ll914.js';
import { symptomChips, symptomAnswer, symptomNotHere } from '../chunk-ihqqrs44.js';
import { invasiveNote } from '../chunk-e28r444y.js';
import '../chunk-l5cseoso.js';
import '../chunk-dpsx67rd.js';

const VALUE_KEY = {
    "light_min:Full sun": copy.valFullSun, "light_min:Part sun": copy.valPartSun,
    "feeder_class:Makes its own nitrogen": copy.valFixer, "feeder_class:Heavy feeder": copy.valHeavyFeeder,
    "feeder_class:Light feeder": copy.valLightFeeder, "feeder_class:Moderate feeder": copy.valModerateFeeder,
    "root_depth:Deep": copy.valDeep, "root_depth:Medium": copy.valMedium, "root_depth:Moderate": copy.valModerate,
    "root_depth:Shallow": copy.valShallow,
    "frost_tolerance:Half hardy": copy.valHalfHardy, "frost_tolerance:Hardy": copy.valHardy, "frost_tolerance:Tender": copy.valTender,
    "frost_tolerance:Very tender": copy.valVeryTender,
    "lifespan:Annual": copy.valAnnual, "lifespan:Biennial": copy.valBiennial, "lifespan:Perennial": copy.valPerennial,
    "habit:Bulb": copy.valBulb, "habit:Bush": copy.valBush, "habit:Cane": copy.valCane, "habit:Groundcover": copy.valGroundcover,
    "habit:Root": copy.valRoot, "habit:Rosette": copy.valRosette, "habit:Shrub": copy.valShrub, "habit:One upright stem": copy.valStalk,
    "habit:Tree": copy.valTree, "habit:Vine": copy.valVine,
    "pollinator_value:High": copy.valHigh, "pollinator_value:Low": copy.valLow, "pollinator_value:Moderate": copy.valModeratePoll,
    "pollinator_value:None": copy.valNone, "pollinator_value:Very high": copy.valVeryHigh,
    "support.requires:Needs a sturdy stake, cage or trellis": copy.valSupportStrong,
    "support.requires:Better with a sturdy stake or cage": copy.valSupportOptional,
    "support.requires:Needs a stake or a short cage": copy.valSupportModerate,
    "support.requires:Needs something light to lean on": copy.valSupportWeak,
    "support.provides:Can carry a climbing vine": copy.valCarriesVine,
    "support.provides:Can carry a light climber": copy.valCarriesLight,
};
function titleWithMark(h, text) {
    h.innerHTML = '<svg class="hmark" aria-hidden="true"><use href="#triad"/></svg>';
    h.appendChild(document.createTextNode(text));
}
function localValue(r) {
    if (r.kind === "bool")
        return r.value ? copy.valYes : copy.valNo;
    if (r.kind === "vocab" && typeof r.value === "string")
        return VALUE_KEY[`${r.key}:${r.value}`] ?? r.value;
    if (r.unit !== "cm")
        return formatValue(r);
    const v = r.value;
    const numeric = typeof v === "number" || (Array.isArray(v) && v.every((x) => typeof x === "number"));
    return numeric ? fmtCmValue(v, r.key === "sowing_depth_cm") : formatValue(r);
}
const $ = (id) => document.getElementById(id);
let focus = null;
function plantFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const p = new URLSearchParams(String(hash).slice(q + 1));
    const id = p.get("id");
    return id ? { id, group: p.get("group") } : null;
}
function setPlantFocus(f) { focus = f; }
function groupLabel(g) {
    const id = String(g.id ?? "");
    const common = g.common ? String(g.common) : "";
    const idWords = id.replace(/_/g, " ");
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const es = groupSpanishName(g);
    if (es)
        return cap(es);
    if (!common)
        return cap(idWords);
    const words = new Set(common.toLowerCase().split(/\s+/));
    const redundant = idWords.toLowerCase().split(/\s+/).every((w) => words.has(w));
    return redundant ? cap(common) : `${cap(common)} / ${idWords}`;
}
function groupSpanishName(g) {
    if (appLang() !== "es" || !Array.isArray(g.common_es))
        return undefined;
    return g.common_es.find((x) => typeof x === "string" && !!x);
}
function harvestText(species, group, field, english) {
    const at = (o, path) => path.split(".").reduce((x, k) => (x && typeof x === "object" ? x[k] : undefined), o);
    const sid = String(species?.id ?? "");
    const g = group ? (species?.cultivar_groups ?? []).find((x) => x.id === group) : undefined;
    const said = g && at(g, field) === english ? corpusText(sid, `cultivar_groups.${group}.${field}`, english)
        : at(species, field) === english ? corpusText(sid, field, english) : english;
    return localiseProse(said.replace(/(\d+)\s*°F\s*[–-]\s*(\d+)\s*°F/g, "$1 to $2 degrees Fahrenheit"));
}
function inGround(pl) {
    if (typeof pl.transplanted === "string")
        return { day: pl.transplanted, setOut: true };
    return typeof pl.sown === "string" ? { day: pl.sown, setOut: false } : null;
}
function yoursLine(plantings, speciesId) {
    const live = plantings.filter((pl) => pl.species === speciesId && !pl.end_date);
    if (!live.length)
        return null;
    const dated = live.map(inGround).filter((d) => d !== null)
        .sort((a, b) => a.day.localeCompare(b.day));
    const n = live.length;
    if (!dated.length)
        return n === 1 ? copy.pcYoursPlannedOne : fillCopy("pcYoursPlannedMany", { n });
    const day = dayWord(dated[0].day);
    if (n === 1)
        return fillCopy(dated[0].setOut ? "pcYoursSetOutOne" : "pcYoursSownOne", { day });
    return fillCopy(dated[0].setOut ? "pcYoursSetOutMany" : "pcYoursSownMany", { n, day });
}
function cardModeFor(plantings, speciesId) {
    const live = plantings.filter((pl) => pl.species === speciesId && !pl.end_date);
    if (!live.length)
        return "reference";
    return live.some((pl) => !inGround(pl)) ? "planting" : "growing";
}
function cardMode(speciesId) {
    const snap = app.logSnapshot;
    const season = snap.seasons.find((s) => s.id === snap.seasonId);
    return cardModeFor(season?.plantings ?? [], speciesId);
}
let provenanceGaveUp = false;
function renderPlantCard(bundle) {
    const box = $("plantcard");
    const head = $("plant-h");
    if (!box || !head)
        return;
    box.replaceChildren();
    if (!focus) {
        titleWithMark(head, labelCopy("Plant"));
        box.appendChild(el("p", "pc-hint", copy.pcPickHint));
        return;
    }
    const rec = bundle.species.find((s) => s.id === focus.id);
    if (!rec) {
        titleWithMark(head, copy.pcNotFoundTitle);
        box.appendChild(el("p", "pc-hint", copy.pcNoRecord));
        const acts = el("p", "notfound-acts");
        const all = document.createElement("a");
        all.className = "btn btn-primary";
        all.href = "../plants/";
        all.textContent = copy.nfPlants;
        const home = document.createElement("a");
        home.className = "btn btn-secondary";
        home.href = "#/start";
        home.textContent = copy.nfHome;
        acts.append(all, home);
        box.appendChild(acts);
        return;
    }
    const speciesName = commonName(bundle, focus.id);
    const ownGroup = focus.group ? (rec.cultivar_groups ?? [])
        .find((g) => String(g.id) === focus.group && (g.common || (appLang() === "es" && Array.isArray(g.common_es) && g.common_es.length))) : undefined;
    const name = ownGroup ? plantingLabel(bundle, focus.id, focus.group) : speciesName;
    titleWithMark(head, name);
    if (appLang() === "es") {
        const own = ownGroup?.common ? String(Array.isArray(ownGroup.common) ? ownGroup.common[0] : ownGroup.common) : "";
        const en = own ? own.charAt(0).toUpperCase() + own.slice(1) : englishName(bundle, focus.id);
        if (en.toLowerCase() !== name.toLowerCase()) {
            const sub = el("p", "pc-english", en);
            sub.lang = "en";
            box.appendChild(sub);
        }
    }
    {
        const snap = app.logSnapshot;
        const season = snap.seasons.find((x) => x.id === snap.seasonId);
        const mine = yoursLine(season?.plantings ?? [], focus.id);
        if (mine)
            box.appendChild(el("p", "pc-yours", mine));
    }
    {
        const weed = invasiveNote(bundle, focus.id);
        if (weed)
            box.appendChild(el("p", "pc-weed", weed.charAt(0).toUpperCase() + weed.slice(1)));
    }
    const img = rec.image;
    const photoFits = name === speciesName || name.toLowerCase().includes(speciesName.toLowerCase());
    if (img && typeof img.artist === "string" && photoFits) {
        const fig = el("figure", "pc-photo");
        fig.dataset.spotPhoto = focus.id;
        const im = el("img");
        im.src = `img/${encodeURIComponent(focus.id)}.webp`;
        im.alt = typeof img.alt === "string" ? img.alt : "";
        im.loading = "lazy";
        im.decoding = "async";
        im.onerror = () => fig.remove();
        fig.appendChild(im);
        fig.appendChild(el("figcaption", "pc-credit", fillCopy("pnPhotoCredit", { artist: String(img.artist), licence: licenceWord(String(img.licence ?? "")) })));
        box.appendChild(fig);
    }
    const outp = el("p", "pc-hint");
    const outa = el("a", undefined, name === speciesName ? fillCopy("pcMoreAbout", { name: name.toLowerCase() })
        : fillCopy("pcMoreAboutOn", { name: name.toLowerCase(), species: speciesName.toLowerCase() }));
    outa.href = `../plants/${focus.id.replace(/_/g, "-")}/`;
    outp.appendChild(outa);
    box.appendChild(outp);
    const resolved = cardRecord(focus.id, focus.group, bundle) ?? {};
    const groups = (rec.cultivar_groups ?? []);
    if (groups.length) {
        box.appendChild(el("p", "pc-k", labelCopy("Variety")));
        const strip = el("div", "pc-chips");
        for (const g of groups) {
            const gid = String(g.id);
            const a = el("a", `pc-chip${gid === focus.group ? " on" : ""}`, groupLabel(g));
            if (appLang() === "es" && !groupSpanishName(g))
                a.lang = "en";
            a.href = plantHref(focus.id, gid);
            strip.appendChild(a);
        }
        box.appendChild(strip);
        if (!focus.group) {
            box.appendChild(el("p", "pc-hint", copy.pcVarietyHint));
        }
    }
    if (!provenanceReady(bundle) && !provenanceGaveUp) {
        box.appendChild(el("p", "pc-hint pc-sources-loading", copy.pcSourcesLoading));
        const want = focus.id;
        void ensureProvenance(bundle).then((ok) => {
            if (!ok)
                provenanceGaveUp = true;
            if (focus?.id === want && box.isConnected)
                renderPlantCard(bundle);
        });
    }
    const rows = cardRows(rec, focus.group);
    const lead = cardMode(focus.id) === "planting" ? "How to plant it" : null;
    for (const [section, members] of sectioned(rows, lead)) {
        box.appendChild(el("p", "pc-k", labelCopy(section)));
        for (const r of members) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, labelCopy(r.key === "casts_shade" ? "Casts shade on neighbors" : r.label)));
            const val = el("span", undefined, localValue(r));
            if (r.soft) {
                const soft = r.soft === "contested" ? copy.pnSoftContested : copy.pnSoftEstimated;
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "pc-soft";
                chip.textContent = soft;
                markControl(chip, { kind: "species", id: focus.id, group: focus.group, field: r.key });
                val.appendChild(chip);
            }
            else if (r.sources.length) {
                mark(val, { kind: "species", id: focus.id, group: focus.group, field: r.key }, { label: copy.pnSourceDoor });
            }
            row.appendChild(val);
            box.appendChild(row);
        }
    }
    const famId = typeof resolved.family === "string" ? String(resolved.family) : "";
    if (famId) {
        const frow = el("div", "pc-row");
        frow.appendChild(el("span", undefined, labelCopy("Family")));
        frow.appendChild(el("span", undefined, familyName(famId)));
        box.appendChild(frow);
    }
    const sow = beforeYouSow(resolved);
    if (sow) {
        box.appendChild(el("p", "pc-k", labelCopy("Before you sow")));
        for (const f of sow.facts) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, labelCopy(f.label)));
            row.appendChild(el("span", undefined, f.value));
            box.appendChild(row);
        }
        for (const t of sow.treatments) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, t.word));
            row.appendChild(el("span", undefined, t.detail || t.mechanism));
            box.appendChild(row);
        }
    }
    const atHarvest = harvestFacts(resolved, tempSystem() === "c", (f, en) => harvestText(rec, focus.group, f, en));
    if (atHarvest) {
        box.appendChild(el("p", "pc-k", labelCopy("At harvest")));
        for (const f of atHarvest) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, labelCopy(f.label)));
            row.appendChild(el("span", undefined, f.value));
            box.appendChild(row);
        }
    }
    const pot = potSize(resolved.container_min_gal, unitSystem() === "metric");
    if (pot) {
        box.appendChild(el("p", "pc-k", labelCopy("In a pot")));
        const row = el("div", "pc-row");
        row.appendChild(el("span", undefined, labelCopy("Pot size")));
        row.appendChild(el("span", undefined, pot));
        box.appendChild(row);
    }
    const applies = rulesForSpecies(focus.id, focus.group, bundle);
    if (applies.length) {
        box.appendChild(el("p", "pc-k", labelCopy("Rules that apply")));
        const SHOW = 5;
        let host = box;
        for (const [i, r] of applies.entries()) {
            if (i === SHOW && applies.length > SHOW + 2) {
                const more = document.createElement("details");
                more.className = "pc-more";
                const sum = document.createElement("summary");
                sum.append(el("span", "fm-more", fillCopy("pcRulesMore", { n: String(applies.length - SHOW) })), el("span", "fm-less", copy.pcRulesFewer));
                more.appendChild(sum);
                box.appendChild(more);
                host = more;
            }
            const card = el("div", "out");
            const claim = el("p", "outclaim", stripRuleCitations(ruleClaim(bundle, r.id)));
            claim.appendChild(document.createTextNode(" "));
            const why = document.createElement("a");
            why.className = "whytap";
            why.href = `#/why?rule=${r.id}`;
            why.textContent = copy.pcWhyThis;
            markLink(why, { kind: "rule", id: r.id });
            claim.appendChild(why);
            card.appendChild(claim);
            const standing = ruleStanding(r);
            if (standing.length) {
                const cp = el("p", "outconf");
                for (const n of standing)
                    cp.appendChild(n);
                card.appendChild(cp);
            }
            host.appendChild(card);
        }
    }
    {
        const mine = symptoms(bundle).filter((s) => s.crops && symptomFits(s, focus.id, bundle));
        if (mine.length) {
            box.appendChild(el("p", "pc-k", labelCopy("Something wrong?")));
            const wrap = el("div", "pc-wrong");
            const answer = el("div", "pc-wrong-answer");
            const plantId = focus.id;
            wrap.appendChild(symptomChips(mine, (s) => {
                answer.replaceChildren(symptomAnswer(s, plantId, name.replace(/^./, (c) => c.toUpperCase()), bundle));
            }));
            wrap.appendChild(symptomNotHere());
            wrap.appendChild(answer);
            box.appendChild(wrap);
        }
    }
    const guilds = teamsForPlant(focus.id, bundle);
    if (guilds.length) {
        box.appendChild(el("p", "pc-k", labelCopy("Plant teams that use it")));
        const ul = el("ul", "pc-guilds");
        for (const gid of guilds) {
            const g = bundle.guilds.find((x) => x.id === gid);
            const li = el("li");
            const a = document.createElement("a");
            a.href = `#/plan?guild=${gid}`;
            a.textContent = g ? displayName(g) : gid;
            markLink(a, { kind: "team", id: gid });
            li.appendChild(a);
            ul.appendChild(li);
        }
        box.appendChild(ul);
    }
    const note = el("p", "pc-hint");
    note.appendChild(document.createTextNode(copy.pcNoChartNote));
    const a = el("a", undefined, copy.pcNoChartLink);
    a.href = "../explainers/why-no-companion-planting-chart/";
    note.appendChild(a);
    box.appendChild(note);
}
function initPlantRoute(bundle) {
    const focusPlantFromHash = () => {
        if (currentRoute() !== "plant") {
            setPlantFocus(null);
            return;
        }
        setPlantFocus(plantFromHash(location.hash));
        renderPlantCard(bundle);
    };
    window.addEventListener("hashchange", focusPlantFromHash);
    focusPlantFromHash();
}

export { cardModeFor, groupLabel, harvestText, initPlantRoute, localValue, plantFromHash, plantHref, yoursLine };
