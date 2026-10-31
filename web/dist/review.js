import './chunk-lutet8cz.js';
import { copy, html, fillCopy, familiesPlural, familyName, familyInProse, R, loadChunk, go, pluralCopy } from './paint.js';
import { glossTerm, familyRotationRule, bedHasSections, mergePriorOccupancy, deriveHistory, heldRotationFamilies, resolvedField, eligibleSpecies, priorSeasonCredit, thinBreakSuggestion, breakFamilies, familyWithinInterval, currentPlantingYear, frostCalibration, gardenSeasonAfter, localTodayIso, dayWord, frostSeverityWord, windowFreeze, gardenFrost, plateModel, gardenColours, renderPlate, plateKeyInto, plateKey, plantHref, plantingOnBed, fmtArea, reasonText, markLink, plantingWindow, END_CAUSES, failureSeverityWord, app, openLog, getPhoto, displayName, unitSystem } from './core.js';
import { harvestByCrop, harvestLine } from './chunk-cph1bzsd.js';
import './chunk-l5cseoso.js';

const rotationFamilies = (bundle) => new Set(Object.keys(familyRotationRule(bundle)));
const CLEAR_SCAN_YEARS = 8;
function steerableBeds(beds) {
    return beds.filter((b) => !bedHasSections(b.name, beds));
}
function familiesHereThisSeason(bed, season, bundle) {
    const spOf = new Map(bundle.species.map((s) => [s.id, s]));
    const moving = (season.plantings ?? []).filter((p) => !p.carried_over
        && !(resolvedField(spOf.get(p.species), p.cultivar_group, "lifespan") === "perennial" && !p.end_cause));
    const d = deriveHistory(bed.region, [{ ...season, plantings: moving }], bundle);
    return new Set(Object.values(d.history).flat());
}
function heldFamiliesAt(base, history, year, bundle) {
    return heldRotationFamilies(base, history, year, bundle);
}
function breakAdviceAt(base, history, year, bundle) {
    const site = { ...base, history, season_year: year };
    const e = eligibleSpecies(site, bundle);
    const sug = e.suggestions[0];
    return sug && sug.families.length ? sug.families : [];
}
function bedStates(data, beds, season, plantingYear) {
    return beds.map((bed) => {
        const merged = mergePriorOccupancy(deriveHistory(bed.region, data.seasons, data.bundle), data.priorOccupancy, bed.region);
        const heldByYear = new Map();
        for (let y = plantingYear; y <= plantingYear + CLEAR_SCAN_YEARS; y++) {
            heldByYear.set(y, heldFamiliesAt({ ...data.site, verticillium_reservoir: merged.verticillium_reservoir }, merged.history, y, data.bundle));
        }
        return { name: bed.name, history: merged.history, here: familiesHereThisSeason(bed, season, data.bundle), heldByYear };
    });
}
function firstClearYear(st, family, from) {
    for (let y = from; y <= from + CLEAR_SCAN_YEARS; y++) {
        if (!st.heldByYear.get(y)?.has(family))
            return y;
    }
    return null;
}
function computeSteering(data, season, plantingYear) {
    const ROTATION_FAMILIES = rotationFamilies(data.bundle);
    const beds = steerableBeds(data.beds);
    const empty = { mode: "none", plantingYear, beds: [], years: [], grid: [], moves: [], timeline: [], breakFamilies: [] };
    if (!beds.length)
        return empty;
    const states = bedStates(data, beds, season, plantingYear);
    const inPlay = new Set();
    for (const st of states)
        for (const f of st.here)
            inPlay.add(f);
    if (!inPlay.size)
        return empty;
    const families = [...inPlay].sort((a, b) => {
        const ra = ROTATION_FAMILIES.has(a), rb = ROTATION_FAMILIES.has(b);
        if (ra !== rb)
            return ra ? -1 : 1;
        return a < b ? -1 : a > b ? 1 : 0;
    });
    if (beds.length === 1)
        return timeSteering(empty, families, states[0], data, plantingYear);
    return spaceSteering(empty, families, states, data, plantingYear);
}
function spaceSteering(base, families, states, data, plantingYear) {
    const ROTATION_FAMILIES = rotationFamilies(data.bundle);
    const grid = families.map((f) => ({
        family: f,
        isRotation: ROTATION_FAMILIES.has(f),
        cells: states.map((st) => {
            const held = st.heldByYear.get(plantingYear).has(f);
            return { bed: st.name, clear: !held, heldUntil: held ? firstClearYear(st, f, plantingYear) : null, here: st.here.has(f) };
        }),
    }));
    const clearBedsOf = (f) => states.filter((st) => !st.heldByYear.get(plantingYear).has(f)).map((st) => st.name);
    const soleHome = new Map();
    const clearOf = new Map();
    for (const f of families) {
        if (!ROTATION_FAMILIES.has(f))
            continue;
        const cb = clearBedsOf(f);
        clearOf.set(f, cb);
        if (cb.length === 1)
            soleHome.set(cb[0], [...(soleHome.get(cb[0]) ?? []), f]);
    }
    const moves = families.map((f) => {
        const hereBeds = states.filter((st) => st.here.has(f)).map((st) => st.name);
        if (!ROTATION_FAMILIES.has(f)) {
            return { family: f, isRotation: false, hereBeds, clearBeds: states.map((s) => s.name), kind: "unconstrained",
                suggestBeds: states.map((s) => s.name), contestedBeds: [], collisionWith: [], earliestClearYear: null, breakFamilies: [] };
        }
        const clearBeds = clearOf.get(f);
        if (clearBeds.length === 0) {
            let earliest = null;
            for (const st of states) {
                const y = firstClearYear(st, f, plantingYear);
                if (y !== null && (earliest === null || y < earliest))
                    earliest = y;
            }
            const thin = states[0];
            return { family: f, isRotation: true, hereBeds, clearBeds, kind: "refused", suggestBeds: [], contestedBeds: [],
                collisionWith: [], earliestClearYear: earliest, breakFamilies: breakAdviceAt({ ...data.site }, thin.history, plantingYear, data.bundle) };
        }
        if (clearBeds.length === 1) {
            const bed = clearBeds[0];
            const collisionWith = (soleHome.get(bed) ?? []).filter((g) => g !== f);
            return { family: f, isRotation: true, hereBeds, clearBeds, kind: "forced", suggestBeds: [bed], contestedBeds: [],
                collisionWith, earliestClearYear: null, breakFamilies: [] };
        }
        const contestedBeds = clearBeds.filter((bed) => (soleHome.get(bed) ?? []).some((g) => g !== f));
        const preferred = clearBeds.filter((bed) => !contestedBeds.includes(bed));
        return { family: f, isRotation: true, hereBeds, clearBeds, kind: "free",
            suggestBeds: preferred.length ? preferred : clearBeds, contestedBeds, collisionWith: [], earliestClearYear: null, breakFamilies: [] };
    });
    return { ...base, mode: "space", beds: states.map((s) => s.name), grid, moves };
}
function timeSteering(base, families, st, data, plantingYear) {
    const ROTATION_FAMILIES = rotationFamilies(data.bundle);
    const years = [plantingYear, plantingYear + 1, plantingYear + 2];
    const grid = families.map((f) => ({
        family: f, isRotation: ROTATION_FAMILIES.has(f),
        cells: years.map((y) => ({ bed: st.name, clear: !st.heldByYear.get(y).has(f), heldUntil: null, here: false })),
    }));
    const timeline = families.map((f) => ({
        family: f, isRotation: ROTATION_FAMILIES.has(f),
        heldByYear: years.map((y) => st.heldByYear.get(y).has(f)),
        clearYear: ROTATION_FAMILIES.has(f) ? firstClearYear(st, f, plantingYear) : plantingYear,
    }));
    return { ...base, mode: "time", years, grid, timeline, breakFamilies: breakAdviceAt({ ...data.site }, st.history, plantingYear, data.bundle) };
}
const fillV = (template, parts) => template.split(/(\{\w+\})/).filter(Boolean).map((p) => {
    const k = /^\{(\w+)\}$/.exec(p)?.[1];
    return k && k in parts ? parts[k] : p;
});
const orList$1 = (names) => names.length <= 1 ? names.join("") : fillCopy("stJoinOr", { a: names.slice(0, -1).join(", "), b: names[names.length - 1] });
const famList = (fams) => orList$1(fams.map(familyInProse));
const bedList = (beds) => orList$1(beds);
const breakOf = (fams) => (fams.length ? fillCopy("stBreakOf", { families: famList(fams) }) : copy.stBreakCrop);
function grid(s) {
    const cols = s.mode === "time" ? s.years.map(String) : s.beds;
    return html `<div class="steer-scroll">
    <table class="steer-grid">
      <thead><tr><th>${copy.stFamily}</th>${cols.map((c) => html `<th key=${c}>${c}</th>`)}</tr></thead>
      <tbody>
        ${s.grid.map((row) => html `<tr key=${row.family}>
          <td class="fam">${familyName(row.family)}</td>
          ${row.cells.map((c, i) => html `<td key=${i} class=${c.here ? "here" : ""}>
            <span class=${"cell " + (c.clear ? "sclear" : "sheld")}>${c.clear ? copy.stClear : (c.heldUntil ?? copy.stHeld)}</span>
          </td>`)}
        </tr>`)}
      </tbody>
    </table>
  </div>`;
}
function moveCard(m) {
    const fam = familyName(m.family), famP = familyInProse(m.family);
    if (m.kind === "unconstrained") {
        return html `<div class="steer-move" key=${m.family}>
      <p class="m-head">${fillCopy("stAnyBed", { family: fam })} <span class="m-tag">${copy.stNoLimit}</span></p>
      <p>${copy.stUnconBody}</p>
    </div>`;
    }
    if (m.kind === "forced") {
        const bed = m.suggestBeds[0];
        const collide = m.collisionWith.length
            ? " " + fillCopy("stCollide", { family: famP, others: famList(m.collisionWith), bed })
            : "";
        return html `<div class="steer-move forced" key=${m.family}>
      <p class="m-head">${fillCopy("stForcedHead", { family: fam, bed })} <span class="m-tag">${copy.stOnlyClear}</span></p>
      <p>${fillV(fillCopy("stForcedBody", { family: famP }), { open: html `<b>${fillCopy("stForcedOpen", { bed })}</b>` })}${collide}</p>
    </div>`;
    }
    if (m.kind === "free") {
        const off = m.contestedBeds.length
            ? " " + fillCopy(m.suggestBeds.length > 1
                ? (m.contestedBeds.length > 1 ? "stFreeOffManyMany" : "stFreeOffManyOne")
                : (m.contestedBeds.length > 1 ? "stFreeOffOneMany" : "stFreeOffOneOne"), { beds: bedList(m.suggestBeds), others: bedList(m.contestedBeds) })
            : " " + copy.stFreeNone;
        return html `<div class="steer-move free" key=${m.family}>
      <p class="m-head">${fillCopy("stFreeHead", { family: fam, beds: bedList(m.suggestBeds) })} <span class="m-tag">${fillCopy("stBedsFit", { n: m.clearBeds.length })}</span></p>
      <p><b>${fillCopy(m.clearBeds.length > 1 ? "stWouldAllSuit" : "stWouldSuit", { beds: bedList(m.clearBeds), family: famP })}</b>${off}</p>
    </div>`;
    }
    const brk = breakOf(m.breakFamilies);
    const body = m.earliestClearYear
        ? fillCopy("stRefusedBodyWait", { family: famP, break: brk, year: m.earliestClearYear })
        : fillCopy("stRefusedBody", { family: famP, break: brk });
    return html `<div class="steer-move refused" key=${m.family}>
    <p class="m-head">${fillCopy("stRefusedHead", { family: fam })} <span class="m-tag">${copy.stHeldEverywhere}</span></p>
    <p>${body}</p>
  </div>`;
}
function timeCards(s) {
    const rot = s.timeline.filter((t) => t.isRotation);
    const openNow = s.timeline.filter((t) => !t.isRotation || (t.clearYear !== null && t.clearYear <= s.plantingYear));
    const brk = breakOf(s.breakFamilies);
    const headline = openNow.length
        ? fillV(fillCopy("stHeadlineOpen", { break: brk }), {
            open: html `<b>${fillCopy(familiesPlural(openNow.map((t) => t.family)) ? "stOpenNowMany" : "stOpenNowOne", { families: famList(openNow.map((t) => t.family)) })}</b>`
        })
        : fillCopy("stHeadlineNone", { break: brk });
    const later = rot.filter((t) => t.clearYear !== null && t.clearYear > s.plantingYear)
        .sort((a, b) => (a.clearYear - b.clearYear));
    const byYear = new Map();
    for (const t of later)
        byYear.set(t.clearYear, [...(byYear.get(t.clearYear) ?? []), t.family]);
    return html `<div class="steer-move forced">
      <p class="m-head">${fillCopy("stNextYear", { families: famList(openNow.map((t) => t.family)) || copy.stBreakCrop })} <span class="m-tag">${s.plantingYear}</span></p>
      <p>${headline}</p>
    </div>
    ${[...byYear.entries()].map(([y, fams]) => html `<div class=${"steer-move " + (fams.length > 1 ? "free" : "")} key=${y}>
      <p class="m-head">${fillCopy(familiesPlural(fams) ? "stCanReturn" : "stCanReturnOne", { year: y, families: famList(fams) })} <span class="m-tag">${copy.stIntervalEnds}</span></p>
      <p>${fams.length > 1 ? html `<b>${copy.stEither}</b> ` : ""}${fillCopy(fams.length > 1 ? "stReopensMany" : "stReopensOne", { families: famList(fams) })}</p>
    </div>`)}`;
}
function steeringBlock(data, season, plantingYear) {
    const s = computeSteering(data, season, plantingYear);
    if (s.mode === "none")
        return null;
    if (s.mode === "time") {
        return html `<div class="steer">
      <p class="steer-legend">${fillV(copy.stLegendTime, { rotation: html `<span class="glosshost" ref=${(el) => { if (el && !el.firstChild)
                el.appendChild(glossTerm("rotation", copy.stRotationWord)); }}></span>` })}</p>
      ${timeCards(s)}
      <p class="steer-legend">${copy.stLegendYears}</p>
      ${grid(s)}
    </div>`;
    }
    return html `<div class="steer">
    <p class="steer-legend">${fillCopy("stLegendSpace", { year: s.plantingYear })}</p>
    ${s.moves.map((m) => moveCard(m))}
    <p class="steer-legend">${copy.stLegendGround}</p>
    ${grid(s)}
    <p class="steer-key">${copy.stKeySpace}</p>
  </div>`;
}

const WEIGHT = { A: 3, B: 2, C: 1, D: 0, F: 0 };
const SEQUENCE_CLASSES = new Set(["polyculture", "culinary_bundle", "ornamental_bundle", "restorative"]);
function candidates(bundle) {
    return bundle.guilds.filter((g) => SEQUENCE_CLASSES.has(g.guild_class) && !g.derived_from);
}
function wantsNitrogen(guild, sp) {
    const named = new Set();
    for (const role of guild.roles ?? []) {
        if (typeof role.canonical === "string")
            named.add(role.canonical);
    }
    for (const m of guild.members ?? []) {
        named.add(typeof m === "object" && m !== null ? String(m.species) : String(m));
    }
    return [...named].some((sid) => String(sp.get(sid)?.feeder_class ?? "") === "heavy");
}
function gradeWeight(bundle, rid) {
    return WEIGHT[bundle.rules.find((r) => r.id === rid)?.grade ?? ""] ?? 0;
}
function composeSeason(site, bundle) {
    const history = site.history;
    const note = "scores are what the ORDER buys - each guild's own merit is on its card; "
        + "eligibility still gates every species at planting time";
    if (!history || typeof history !== "object" || Array.isArray(history)
        || !Object.keys(history).length) {
        return { planting_year: null, quiet: true, credits: [], successors: [],
            note: "no history on this ground - nothing follows anything yet, and "
                + "eligibility is the honest guide, not a ranking dressed up as one" };
    }
    const nCredit = priorSeasonCredit(site, bundle);
    const thin = thinBreakSuggestion(site, bundle);
    const credits = [];
    if (nCredit)
        credits.push(nCredit);
    if (thin)
        credits.push(thin);
    const suggests = new Set(thin?.families ?? []);
    const w015 = gradeWeight(bundle, "R-015");
    const w013 = gradeWeight(bundle, "R-013");
    const sp = new Map();
    for (const s of bundle.species)
        sp.set(String(s.id), s);
    const successors = [];
    for (const g of candidates(bundle)) {
        const terms = [];
        const load = g.rotation_load ?? {};
        if (nCredit && wantsNitrogen(g, sp)) {
            terms.push({ rule: "R-015", kind: "nitrogen_banked", weight: w015, why: nCredit.why });
        }
        if (thin && g.guild_class === "restorative" && load.fabaceae === "full") {
            terms.push({ rule: "R-015", kind: "banks_nitrogen", weight: w015,
                why: "deposits a full legume green-manure load; next season's "
                    + "heavy feeder collects the credit" });
        }
        const fullBreak = [...suggests].some((f) => load[f] === "full");
        const breaks = breakFamilies(bundle);
        if (thin && fullBreak && !Object.keys(load).some((f) => breaks.has(f))) {
            terms.push({ rule: "R-013", kind: "rotation_break", weight: w013,
                why: "an allium or apiaceous planting breaks the cycle of every "
                    + "family this ground is holding" });
        }
        for (const fam of Object.keys(load).sort()) {
            const rid = familyRotationRule(bundle)[fam];
            if (!rid)
                continue;
            const years = bundle.rules.find((r) => r.id === rid)?.trigger?.years;
            if (years !== undefined && familyWithinInterval(site, fam, years)) {
                terms.push({ rule: rid, kind: "family_repeat", weight: -gradeWeight(bundle, rid),
                    why: `${fam} is still inside its rotation interval here` });
            }
        }
        if (terms.length) {
            successors.push({ guild: g.id, score: terms.reduce((s, t) => s + t.weight, 0), terms });
        }
    }
    successors.sort((a, b) => b.score - a.score
        || (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0));
    const year = currentPlantingYear(site);
    if (!successors.length) {
        return { planting_year: year, quiet: true, credits, successors: [],
            note: "the ground's history gives no order to score - anything eligible "
                + "is as good first as second" };
    }
    return { planting_year: year, quiet: false, credits, successors, note };
}

function fillParts(template, nodes) {
    const out = [];
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        if (k && k in nodes)
            out.push(nodes[k]);
        else if (part)
            out.push(part);
    }
    return out;
}
let getData = null;
let selectedSeason = null;
const _revPhotoUrls = new Map();
function reviewPhotoInto(img, seasonId, name) {
    const plot = app.currentPlotId;
    const key = `${plot}:${seasonId}:${name}`;
    const hit = _revPhotoUrls.get(key);
    if (hit) {
        img.src = hit;
        return;
    }
    void openLog().then((db) => getPhoto(db, plot, seasonId, name)).then((b) => {
        if (!b)
            return;
        const url = URL.createObjectURL(b);
        _revPhotoUrls.set(key, url);
        img.src = url;
    }).catch(() => { });
}
const beatsOf = (p) => {
    const beats = [];
    if (p.sown)
        beats.push(fillCopy("rvBeatSown", { date: dayWord(p.sown) }));
    if (p.transplanted && p.transplanted !== p.sown)
        beats.push(fillCopy("rvBeatSetOut", { date: dayWord(p.transplanted) }));
    if (p.first_harvest)
        beats.push(fillCopy("rvBeatFirstPicked", { date: dayWord(p.first_harvest) }));
    if (p.last_harvest && p.last_harvest !== p.first_harvest)
        beats.push(fillCopy("rvBeatLastPicked", { date: dayWord(p.last_harvest) }));
    const cause = p.end_cause && END_CAUSES.includes(p.end_cause) ? p.end_cause : p.end_cause ? "unknown" : null;
    const key = cause ? `rvBeatEnd${cause.charAt(0).toUpperCase()}${cause.slice(1)}` : null;
    beats.push(key
        ? (p.end_date ? fillCopy(`${key}On`, { date: dayWord(p.end_date) }) : copy[key])
        : copy.rvBeatStillIn);
    const fails = (p.failures ?? [])
        .map((f) => fillCopy("rvFailure", { mode: f.mode, severity: failureSeverityWord(f.severity), date: dayWord(f.date) }))
        .join("; ");
    return fails ? fillCopy("rvBeatsSuffered", { beats: beats.join(", "), fails }) : beats.join(", ");
};
const hasWords = (p) => (p.notes ?? []).some((n) => (n.text && n.text !== "Photo") || n.photo);
const plantingLine = (d, p, seasonId, named = true, same = 1) => {
    const line = beatsOf(p);
    const notes = (p.notes ?? []).filter((n) => n.text && n.text !== "Photo");
    const photos = (p.notes ?? []).filter((n) => n.photo);
    return html `<div class="entry rev-planting" key=${p.species + (p.sown ?? "") + (p.end_date ?? "")}>
    ${named ? html `<p class="rev-p-name"><a class="pname" href=${plantHref(p.species)}>${d.commonName(p.species)}</a></p>` : null}
    ${notes.map((n) => html `<p class="rev-note" key=${"n" + n.date + n.text}>${fillCopy("rvNoted", { date: dayWord(n.date), text: n.text })}</p>`)}
    ${photos.map((n) => html `<img class="rev-note-photo" key=${"ph" + n.date + n.photo} loading="lazy"
        alt=${fillCopy("rvPhotoAlt", { name: d.commonName(p.species) })}
        ref=${(el) => { if (el)
        reviewPhotoInto(el, seasonId, n.photo); }} />`)}
    <p class="rev-beats">${same > 1 ? fillCopy("rvSameBeats", { n: same, beats: line }) : line}</p>
  </div>`;
};
const grewByPlant = (d, plantings, seasonId) => {
    const groups = new Map();
    const first = (p) => p.sown ?? p.transplanted ?? p.end_date ?? "9999";
    for (const p of [...plantings].sort((a, b) => first(a).localeCompare(first(b)))) {
        const g = groups.get(p.species);
        if (g)
            g.push(p);
        else
            groups.set(p.species, [p]);
    }
    return [...groups.entries()].map(([sid, ps]) => {
        if (ps.length === 1 && !hasWords(ps[0])) {
            return html `<div class="rev-plantgroup rev-oneline" key=${"g" + sid}>
        <p class="rev-p-name"><a class="pname" href=${plantHref(sid)}>${d.commonName(sid)}</a><span class="rev-beats-inline"> · ${beatsOf(ps[0])}</span></p>
      </div>`;
        }
        if (ps.length === 1)
            return plantingLine(d, ps[0], seasonId);
        const runs = [];
        for (const p of ps) {
            const run = hasWords(p) ? null : runs.find((r) => !hasWords(r.p) && beatsOf(r.p) === beatsOf(p));
            if (run)
                run.n++;
            else
                runs.push({ p, n: 1 });
        }
        const name = html `<a class="pname" href=${plantHref(sid)}>${d.commonName(sid)}</a> <span class="rev-p-n">${pluralCopy("rvPlantingsCount", ps.length)}</span>`;
        if (runs.length === 1) {
            return html `<div class="rev-plantgroup rev-oneline" key=${"g" + sid}>
        <p class="rev-p-name">${name}<span class="rev-beats-inline">, ${beatsOf(ps[0])}</span></p>
      </div>`;
        }
        return html `<div class="rev-plantgroup" key=${"g" + sid}>
        <p class="rev-p-name">${name}</p>
        ${runs.map((r) => plantingLine(d, r.p, seasonId, false, r.n))}
      </div>`;
    });
};
function harvestBlock(d, season) {
    const rows = harvestByCrop(d.seasons, season.id);
    if (!rows.length)
        return null;
    const sys = unitSystem();
    const top = rows.slice(0, 2).map((r) => d.commonName(r.species));
    return html `<fieldset class="rev-harvest">
    <legend>${copy.rvHarvestLegend}</legend>
    ${rows.length > 1 ? html `<p class="entry rev-h-top">${fillCopy("rvBiggestHarvests", { first: top[0], second: top[1] })}</p>` : null}
    ${rows.map((r) => html `<p class="entry rev-h-row" key=${r.species}>${harvestLine(r, d.commonName(r.species), sys)}</p>`)}
    <p class="hint">${copy.rvHarvestOwnHint}</p>
  </fieldset>`;
}
function boundaryLine(label, b, minSeasons) {
    if (!b.per_season.length)
        return html `<p class="hint" key=${label}>${fillCopy("rvNothingLoggedYet", { label })}</p>`;
    if (b.calibrated && b.own)
        return html `<p class="ok" key=${label}>${fillCopy("rvCalibratedOwn", { label, date: String(b.calibrated_date) })}</p>`;
    if (b.calibrated) {
        const m = b.median_offset_days;
        const dir = m > 0 ? fillCopy("rvDaysLater", { n: Math.abs(m) }) : m < 0 ? fillCopy("rvDaysEarlier", { n: Math.abs(m) }) : copy.rvOnUsualDate;
        return html `<p class="ok" key=${label}>${fillCopy("rvCalibrated", { label, dir, date: String(b.calibrated_date), model: String(b.per_season[0].model) })}</p>`;
    }
    return html `<p key=${label}>${fillCopy("rvSeasonsToGo", { label, n: b.n, min: minSeasons, left: minSeasons - b.n })}</p>`;
}
function frostLines(cal) {
    const sp = cal.spring, fa = cal.fall;
    if (!sp.calibrated && !fa.calibrated && sp.per_season.length && fa.per_season.length && sp.n === fa.n) {
        return html `<p key="both">${fillCopy("rvSeasonsToGoBoth", { n: sp.n, min: cal.min_seasons, left: cal.min_seasons - sp.n })}</p>`;
    }
    return html `${boundaryLine(copy.rvLastSpringFrost, sp, cal.min_seasons)}
               ${boundaryLine(copy.rvFirstFallFreeze, fa, cal.min_seasons)}`;
}
const orList = (xs) => xs.length === 2 ? fillCopy("stJoinOr", { a: xs[0], b: xs[1] }) : xs.join(", ");
function glossNode(key, label) {
    return html `<span class="glosshost" ref=${(el) => { if (el && !el.firstChild)
        el.appendChild(glossTerm(key, label)); }}></span>`;
}
function planBed(name) {
    const cand = document.getElementById("candbed");
    if (cand && [...cand.options].some((o) => o.value === name)) {
        cand.value = name;
        cand.dispatchEvent(new Event("change"));
    }
    location.hash = "#/plan";
}
function bedOutlook(d, bed, plantingYear) {
    const nextSeason = d.seasons.find((s) => s.id === plantingYear);
    const replanted = !!nextSeason
        && (nextSeason.plantings ?? []).some((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
    const bridge = html `<p class="entry replan" key="bridge">
    ${replanted ? fillCopy("rvAlreadyReplanted", { year: plantingYear }) : ""}<button class="btn btn-secondary link planbridge" type="button"
      onClick=${() => planBed(bed.name)}>${replanted ? copy.rvRevisitPlan : fillCopy("rvPlanBedFor", { year: plantingYear })}</button>
  </p>`;
    const derived = mergePriorOccupancy(deriveHistory(bed.region, d.seasons, d.bundle), d.priorOccupancy, bed.region);
    if (!derived.contributions.length) {
        return html `<div class="entry bedoutlook" key=${bed.name}>
      <p>${fillParts(copy.rvCleanGround, { bed: html `<strong>${bed.name}</strong>` })}</p>
      ${bridge}
    </div>`;
    }
    const site = { ...d.site, history: derived.history, season_year: plantingYear,
        verticillium_reservoir: derived.verticillium_reservoir };
    const res = eligibleSpecies(site, d.bundle);
    const carried = derived.contributions.map((c, i) => c.species === ""
        ? html `${i ? "; " : ""}${fillCopy("rvCarriedDeclared", { season: c.season, family: familyName(c.family) })}`
        : html `${i ? "; " : ""}${fillParts(fillCopy("rvCarriedPlant", { season: c.season, family: familyName(c.family), area: fmtArea(c.overlap_m2) }), { plant: html `<a class="pname" href=${plantHref(c.species)}>${d.commonName(c.species)}</a>` })}`);
    const carriedMore = carried.length > 1
        ? html `<details class="rev-carried"><summary>${fillCopy("rvCarriedMore", { n: carried.length - 1 })}</summary><p>${carried}</p></details>`
        : null;
    const famOf = (sid) => d.bundle.species.find((x) => x.id === sid)?.family ?? "";
    const heldFams = new Map();
    for (const b of res.blocked) {
        const f = famOf(b.species);
        heldFams.set(f, [...(heldFams.get(f) ?? []), b]);
    }
    return html `<div class="entry bedoutlook" key=${bed.name}>
    <p>${fillParts(fillCopy("rvCarriedLine", { fine: res.eligible.length, blocked: res.blocked.length }), { bed: html `<strong>${bed.name}</strong>`, carried: carried[0] })}</p>
    ${carriedMore}
    ${[...heldFams.entries()].map(([fam, bs]) => {
        const reasons = new Map();
        for (const b of bs)
            for (const r of b.blocked_by) {
                const why = reasonText(r.why);
                if (!reasons.has(why))
                    reasons.set(why, r.rule ?? null);
            }
        const label = fam ? familyName(fam) : "";
        return html `<div class="blocked" key=${"f" + fam}>
      <p class="blocked-fam"><strong>${fillCopy("rvHeldFamily", { family: label.charAt(0).toUpperCase() + label.slice(1), n: bs.length })}</strong>: ${bs.map((b, i) => html `${i ? ", " : ""}<span class="rev-held-n">${d.commonName(b.species)}</span>`)}</p>
      <details class="rev-held-why"><summary>${copy.clWhy}</summary>
        ${[...reasons.entries()].map(([why, id]) => html `<p class="rev-held-r" key=${why}>${why}${id ? " " : ""}${id ? html `<a class="whytap" href=${`#/why?rule=${id}`} ref=${(el) => el && markLink(el, { kind: "rule", id })} title=${d.ruleClaim(id)}>${copy.dsSeeEvidence}\u00a0›</a>` : null}</p>`)}
      </details>
    </div>`;
    })}
    ${res.suggestions.map((s) => html `<p class="suggest" key=${s.rule} title=${reasonText(s.why)}>${fillParts(fillCopy("rvSuggestBreak", { families: orList(s.families.map(familyInProse)) }), { rotation: glossNode("rotation", copy.clRotationWord) })} <a class="whytap" href=${`#/why?rule=${s.rule}`} ref=${(el) => el && markLink(el, { kind: "rule", id: s.rule })}>${copy.dsSeeEvidence}\u00a0›</a>
    </p>`)}
    ${whatFollows(d, site)}
    ${bridge}
  </div>`;
}
function whatFollows(d, site) {
    const r = composeSeason(site, d.bundle);
    if (r.quiet)
        return null;
    const byId = new Map(d.bundle.guilds.map((g) => [g.id, g]));
    const name = (gid) => { const g = byId.get(gid); return g ? displayName(g) : gid; };
    const top = r.successors.filter((s) => s.score > 0).slice(0, 3);
    const warned = r.successors.filter((s) => s.score < 0);
    if (!top.length && !warned.length)
        return null;
    return html `<div class="whatfollows">
    ${top.length ? html `<p class="wf-h">${copy.rvFollowsWell}</p>` : null}
    ${top.map((s) => html `<p class="wf-row" key=${s.guild}>
      <a href=${`#/plan?guild=${s.guild}`}>${name(s.guild)}</a>${" - "}${s.terms.filter((t) => t.weight > 0).map((t, i) => html `${i ? "; " : ""}${reasonText(t.why)} <a class="whytap" href=${`#/why?rule=${t.rule}`} ref=${(el) => el && markLink(el, { kind: "rule", id: t.rule })} title=${d.ruleClaim(t.rule)}>${copy.clWhy}\u00a0›</a>`)}
    </p>`)}
    ${warned.length ? html `<p class="wf-warn">${fillParts(fillCopy("rvRepeatsWarned", { teams: warned.map((s) => name(s.guild)).join(", ") }), { rotation: glossNode("rotation", copy.clRotationWord) })}</p>` : null}
  </div>`;
}
function yearPlate(d, season) {
    if (!d.beds.length)
        return null;
    const today = localTodayIso();
    const yearEnd = `${season.id}-12-31`;
    const atClose = yearEnd < today;
    const asOf = atClose ? yearEnd : today;
    const prev = d.seasons.find((s) => s.id === season.id - 1) ?? null;
    const { bundle } = d, lat = d.site.lat ?? null, lon = d.site.lon ?? null;
    const freeze = lat != null && lon != null ? windowFreeze(gardenFrost(bundle, lat, lon, d.seasons), lat, bundle) : null;
    const model = plateModel({ beds: d.beds.map((b) => ({ name: b.name, region: b.region })) }, season, prev, asOf, (p) => plantingWindow(p, bundle.species.find((x) => x.id === p.species), freeze));
    return html `<figure class="rev-plate">
    <div class="rev-plate-fig" ref=${(el) => {
        if (!el)
            return;
        const colourOf = gardenColours();
        const plate = renderPlate(model, { pxPerSide: 560, label: fillCopy("rvPlateLabel", { year: season.id }), colourOf });
        el.replaceChildren(plate);
        const key = document.createElement("div");
        key.className = "hg-legend";
        el.append(plateKeyInto(key, plateKey(model, d.commonName), { counts: true, colourOf, marks: plate }));
    }}></div>
    <figcaption>${fillCopy(atClose ? "rvPlateCaptionClose" : "rvPlateCaptionNow", { year: season.id })}</figcaption>
    <button class="btn btn-secondary link revprint" type="button" onClick=${() => window.print()}>${copy.rvPrintSheet}</button>
  </figure>`;
}
function ReviewPage() {
    const d = getData();
    if (!d.seasons.length) {
        return html `<div class="empty"><p>${copy.rvNoSeasons}</p><a class="btn btn-secondary" href="#/log">${copy.rvEmptyGo}</a></div>`;
    }
    const ids = d.seasons.map((s) => s.id);
    const season = d.seasons.find((s) => s.id === selectedSeason) ?? d.seasons[d.seasons.length - 1];
    const plantings = season.plantings ?? [];
    const seasonObs = (season.observations ?? []).filter((o) => o.event === "frost");
    const seasonDiary = (season.observations ?? [])
        .filter((o) => o.event === "note" || o.event === "heat")
        .slice().sort((a, b) => a.date.localeCompare(b.date));
    const located = d.site.lat != null && d.site.lon != null;
    const cal = d.clim ? frostCalibration(d.seasons, d.clim) : located ? frostCalibration(d.seasons, null, d.site.lat) : null;
    const nextYear = gardenSeasonAfter(d.bundle, season.id, d.seasons, localTodayIso(), d.site.lat, d.site.lon);
    const spanDates = [
        ...plantings.flatMap((p) => [p.sown, p.transplanted, p.first_harvest, p.last_harvest, p.end_date]),
        ...(season.observations ?? []).map((o) => o.date),
    ].filter((x) => !!x).sort();
    const first = spanDates[0], last = spanDates[spanDates.length - 1];
    const dateline = spanDates.length
        ? (first === last ? html `${d.plotLabel} · ${dayWord(first)}` : html `${d.plotLabel} · ${dayWord(first)} – ${dayWord(last)}`)
        : html `${d.plotLabel}`;
    return html `<div>
    <!-- O146 step G / O161 S3 (nostalgia): the look-back leads with the YEAR, named in the almanac
         register - a year remembered, not a ledger audit - then a serif dateline (the keepsake's, it
         prints). The season selector chooses WHICH year to keep, so it stays in the screen-only row. -->
    <h2 class="rev-year">${fillCopy("rvYearHead", { year: season.id })}</h2>
    <p class="rev-dateline">${dateline}</p>
    <!-- B41 (the app audit): the season is the app's segmented control, not a native select -->
    <div class="logrow revhead">
      <span class="revhead-l" id="revseason-l">${copy.rvSeason}</span>
      <div class="seg" id="revseason" role="group" aria-labelledby="revseason-l">
        ${[...ids].reverse().map((id) => html `<button type="button" key=${id} data-season=${id}
          aria-pressed=${id === season.id ? "true" : "false"}
          onClick=${() => { selectedSeason = id; redrawReview(); }}>${id}</button>`)}
      </div>
    </div>

    ${yearPlate(d, season)}

    <fieldset>
      <legend>${copy.rvWhatYouGrew}</legend>
      ${plantings.length
        ? grewByPlant(d, plantings, season.id)
        : html `<p class="hint">${copy.rvNoPlantings}</p>`}
    </fieldset>

    ${harvestBlock(d, season)}

    <fieldset>
      <legend>${copy.rvFrostsTeaching}</legend>
      ${seasonObs.length
        ? html `<p class="entry">${fillCopy("rvThisSeason", { frosts: seasonObs.map((o) => o.severity ? fillCopy("rvFrostOnSeverity", { date: dayWord(o.date), severity: frostSeverityWord(o.severity) }) : fillCopy("rvFrostOn", { date: dayWord(o.date) })).join(" · ") })}</p>`
        : null}
      ${cal ? frostLines(cal) : html `<p class="hint">${copy.rvSetLocation}</p>`}
    </fieldset>

    ${seasonDiary.length
        ? html `<fieldset class="rev-diary">
          <legend>${copy.rvOwnWords}</legend>
          ${seasonDiary.map((o) => html `<p class="entry" key=${o.date + (o.note ?? "")}>${o.event === "heat" ? (o.note ? fillCopy("rvHotSpellNote", { date: dayWord(o.date), note: o.note }) : fillCopy("rvHotSpell", { date: dayWord(o.date) })) : `${dayWord(o.date)} - ${o.note}`}</p>`)}
        </fieldset>`
        : null}

    <!-- O161 S3: the rotation outlook is a forward-looking audit - useful on screen, but not part of the
         year you'd keep. It becomes a screen-only fold (a <details>, open by default so it stays where it
         was) and drops off the printed sheet. The door hands you to the full next-season plan. -->
    <details class="rev-next disclosure" open>
      <summary>${fillParts(copy.rvNextAllows, { year: html `<span class="rev-next-yr">${fillCopy("rvPlantingYear", { year: nextYear })}</span>` })}</summary>
      <button class="btn btn-secondary link rev-nextdoor" type="button"
        onClick=${() => { void loadChunk("plan").then((m) => { m.openNextSeason(); go("plan", "nextseason"); }, () => go("plan", "nextseason")); }}>${copy.rvPlanNextYear}</button>
      ${d.beds.length ? steeringBlock(d, season, nextYear) : null}
      ${d.beds.length
        ? d.beds.map((bed) => bedOutlook(d, bed, nextYear))
        : html `<p class="hint">${copy.rvNoBeds}</p>`}
    </details>
  </div>`;
}
function redrawReview() {
    const host = document.getElementById("reviewbody");
    if (!host || !getData)
        return;
    R(html `<${ReviewPage} />`, host);
}
function initReview(data) {
    getData = data;
    redrawReview();
    return redrawReview;
}

export { initReview };
