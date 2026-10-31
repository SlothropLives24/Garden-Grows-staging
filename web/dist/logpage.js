import { validateSeason, el, unitSystem, LIFESPANS, LIGHT_LEVELS, FROST_TOLERANCES, tempSystem, SOW_SEASONS, FEEDER_CLASSES, GROUND_COVERAGES, POLLINATOR_VALUES, SUPPORT_PROVIDES, SUPPORT_REQUIRES, commonName, $ as $$1, toast, mintSeedId, putSeed, app, draftPlantings, listSeeds, cropSearch, seasonId, categoryLabel, deleteSeed, defaultPlotId, orderGardens, gardenNameOf, EXAMPLE_PLOT_ID, defaultToggle, emptyState, seasonYearOf, localTodayIso, scheduleClimate, frostRare, isSouthern, END_CAUSES, endCauseLabel, gardenFrost, gardenFrame, monthShort, gardenColours, bedHasSections, sectionParentOf, bedSeasonStatus, bedShapeLabel, plantingOnBed, displayName, plantLink, failureSeverityWord, plantingLabel, offSeasonNudge, linkNamesIn, regionLabel, frostCalibration, fallDate, putSeason, setGardenClosed, setDefaultPlot, pickGarden, fmtMonthDayYear, getSeason, seasonDate, yardFigure, FAILURE_SEVERITIES, failureSeverityLabel, isFutureDate, addFailure, endPlanting, linkNameIn, updatePlanting, markBedPlantedAdvancingSeason, markBedPlanted, setSeasonId, plantedLine, addPlanting, parseRegion, setBedPlanted, removePlanting, resolveSpecies, mmddDoy, frostSide, eraseGarden, listPlots, defaultWorkspacePlotId, listSeasons, getPhoto, plateModel, monthLong, plantingWindow, boltMonthsFor, mark, plantEntryLine, addPlantingNote, putPhoto, setPlotName, windowFreeze, yardRepaint, renameBed, hiddenRows, WHOLE_GARDEN, chipRows, DIARY_KINDS, seasonLine, isExamplePlot, OBSERVATION_SEVERITIES, frostSeverityLabel, shiftFrostDate, frostAsked, fmtMonthDay, regionCentroid, geometryRules, corpusText, corpusWantsEs, corpusEs, openSeason, fmtDec, resolveGround, capabilities, REPORT_FIELDS, RUNGS, CHECK_SVG, NUTRIENTS, drainageCautions, phCautions, limeCautions, clubrootCautions, PH_MIN, PH_MAX, PH_METHODS, NUTRIENT_LEVELS, AMENDMENTS, withLocalHelp, asksFor, openLog, deleteSoilObservation, putSoilObservation, ladder as ladder$1, intersectArea, MEDIUMS, TEXTURES, DRAINAGES } from './core.js';
import './chunk-lutet8cz.js';
import { copy, familyShown, familyKeyOf, fillCopy, midSentence, chunkReady, loadChunk, pluralCopy, plusPreview, humanize, fillNodes as fillNodes$1, stripRuleCitations, plainClaim, appLang } from './paint.js';
import { symptoms, foldText } from './chunk-h38ll914.js';
export { symptomFits, symptomInNote, symptomsFor } from './chunk-h38ll914.js';
import { seeAlsoTip } from './chunk-d4xihojx.js';
import { plantAgainst } from './chunk-hbmfsdgg.js';
export { symptomAnswer, symptomChips, symptomNotHere } from './chunk-ihqqrs44.js';
import { packetAgeLine } from './chunk-ngdzafki.js';
import { guildsPlacing } from './chunk-h8sxf1mq.js';
import './chunk-l5cseoso.js';

const BARE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const NUMBER_SHAPED = /^-?\d+(\.\d+)?$/;
function scalar(v) {
    if (typeof v === "number")
        return String(v);
    if (typeof v === "string" && BARE.test(v) && !NUMBER_SHAPED.test(v)
        && v !== "true" && v !== "false")
        return v;
    return JSON.stringify(v);
}
function flow(pairs) {
    const present = pairs.filter(([, v]) => v !== undefined);
    return `{${present.map(([k, v]) => `${k}: ${scalar(v)}`).join(", ")}}`;
}
const regionFlow = (r) => r.shape === "polygon"
    ? JSON.stringify({ shape: r.shape, points: r.points })
    : flow([["shape", r.shape], ["x", r.x], ["y", r.y], ["w", r.w], ["h", r.h]]);
const observationFlow = (o) => flow([["date", o.date], ["event", o.event], ["severity", o.severity],
    ["damage", o.damage], ["note", o.note], ["id", o.id]]);
const failureFlow = (f) => flow([["date", f.date], ["mode", f.mode], ["severity", f.severity]]);
const noteFlow = (n) => flow([["date", n.date], ["text", n.text], ["photo", n.photo]]);
function emitSeason(season) {
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`refusing to export an invalid season:\n${errors.join("\n")}`);
    const out = ["season:", `  id: ${scalar(season.id)}`, `  plot: ${scalar(season.plot)}`];
    if (season.plan !== undefined) {
        out.push("", `  plan: ${JSON.stringify(season.plan)}`);
    }
    if (season.next_plan !== undefined) {
        out.push("", `  next_plan: ${JSON.stringify(season.next_plan)}`);
    }
    if (season.planted_from !== undefined) {
        out.push("", `  planted_from: ${JSON.stringify(season.planted_from)}`);
    }
    if (season.set_aside !== undefined) {
        out.push("", `  set_aside: ${JSON.stringify(season.set_aside)}`);
    }
    if (season.observations !== undefined) {
        out.push("");
        if (season.observations.length === 0)
            out.push("  observations: []");
        else {
            out.push("  observations:");
            for (const o of season.observations)
                out.push(`  - ${observationFlow(o)}`);
        }
    }
    if (season.plantings !== undefined) {
        out.push("");
        if (season.plantings.length === 0)
            out.push("  plantings: []");
        else {
            out.push("  plantings:");
            for (const p of season.plantings) {
                const field = (k, v, first = false) => {
                    if (v !== undefined)
                        out.push(`  ${first ? "-" : " "} ${k}: ${v}`);
                };
                field("species", scalar(p.species), true);
                field("id", p.id === undefined ? undefined : scalar(p.id));
                field("cultivar_group", p.cultivar_group === undefined ? undefined : scalar(p.cultivar_group));
                field("variety", p.variety === undefined ? undefined : scalar(p.variety));
                field("region", regionFlow(p.region));
                for (const k of ["sown", "transplanted", "first_harvest", "last_harvest", "end_cause", "end_date"]) {
                    field(k, p[k] === undefined ? undefined : scalar(p[k]));
                }
                field("carried_over", p.carried_over === undefined ? undefined : scalar(p.carried_over));
                field("yield_kg", p.yield_kg === undefined ? undefined : scalar(p.yield_kg));
                if (p.failures !== undefined) {
                    if (p.failures.length === 0)
                        field("failures", "[]");
                    else {
                        out.push("    failures:");
                        for (const f of p.failures)
                            out.push(`    - ${failureFlow(f)}`);
                    }
                }
                if (p.notes !== undefined) {
                    if (p.notes.length === 0)
                        field("notes", "[]");
                    else {
                        out.push("    notes:");
                        for (const nt of p.notes)
                            out.push(`    - ${noteFlow(nt)}`);
                    }
                }
            }
        }
    }
    if (season.removed_plantings !== undefined) {
        out.push("", `  removed_plantings: ${JSON.stringify(season.removed_plantings)}`);
    }
    if (season.removed_observations !== undefined) {
        out.push("", `  removed_observations: ${JSON.stringify(season.removed_observations)}`);
    }
    if (season.outcome_notes !== undefined) {
        out.push("", `  outcome_notes: ${JSON.stringify(season.outcome_notes)}`);
    }
    return out.join("\n") + "\n";
}
function fail(line, why) {
    throw new Error(`season file line ${line + 1}: ${why}`);
}
function parseScalar(tok, line) {
    if (tok.startsWith('"')) {
        try {
            return JSON.parse(tok);
        }
        catch {
            fail(line, `bad quoted string ${tok}`);
        }
    }
    if (NUMBER_SHAPED.test(tok))
        return Number(tok);
    if (tok === "[]")
        return [];
    if (tok === "true")
        return true;
    if (BARE.test(tok))
        return tok;
    fail(line, `unrecognised value ${JSON.stringify(tok)}`);
}
function parseFlow(text, line) {
    if (!text.startsWith("{") || !text.endsWith("}"))
        fail(line, `expected a {…} flow map, got ${JSON.stringify(text)}`);
    const body = text.slice(1, -1);
    const rec = {};
    let i = 0;
    while (i < body.length) {
        const colon = body.indexOf(": ", i);
        if (colon < 0)
            fail(line, "malformed flow map");
        const key = body.slice(i, colon).trim();
        let j = colon + 2;
        let end;
        if (body[j] === '"') {
            end = j + 1;
            while (end < body.length && (body[end] !== '"' || body[end - 1] === "\\"))
                end++;
            end++;
        }
        else {
            end = body.indexOf(",", j);
            if (end < 0)
                end = body.length;
        }
        rec[key] = parseScalar(body.slice(j, end).trim(), line);
        i = end;
        if (body.slice(i, i + 2) === ", ")
            i += 2;
        else if (i < body.length)
            fail(line, "malformed flow map (expected ', ')");
    }
    return rec;
}
function parseSeasonFile(text) {
    const lines = text.split("\n");
    const season = {};
    let list = null;
    let listKey = "";
    let planting = null;
    let sublist = null;
    if (lines[0] !== "season:")
        fail(0, 'expected "season:"');
    for (let n = 1; n < lines.length; n++) {
        const line = lines[n];
        if (line === "")
            continue;
        if (line.startsWith("    - ")) {
            if (!sublist)
                fail(n, "failure entry outside a failures list");
            sublist.push(parseFlow(line.slice(6), n));
        }
        else if (line.startsWith("    failures:") || line.startsWith("    notes:")) {
            const key = line.startsWith("    failures:") ? "failures" : "notes";
            if (!planting)
                fail(n, `${key} outside a planting`);
            const rest = line.slice(4 + key.length + 1);
            if (rest === "") {
                sublist = [];
                planting[key] = sublist;
            }
            else if (rest === " []")
                planting[key] = [];
            else
                fail(n, `malformed ${key}`);
        }
        else if (line.startsWith("  - ") || line.startsWith("    ")) {
            if (!list)
                fail(n, "list entry outside a list");
            const isNew = line.startsWith("  - ");
            const body = line.slice(4);
            if (listKey === "observations") {
                if (!isNew)
                    fail(n, "observations are one-line flow maps");
                list.push(parseFlow(body, n));
            }
            else {
                const colon = body.indexOf(": ");
                if (colon < 0)
                    fail(n, "malformed planting field");
                const key = body.slice(0, colon);
                const value = body.slice(colon + 2);
                if (isNew) {
                    planting = {};
                    sublist = null;
                    list.push(planting);
                }
                if (!planting)
                    fail(n, "planting field outside a planting");
                if (key === "region") {
                    if (value.startsWith('{"')) {
                        try {
                            planting[key] = JSON.parse(value);
                        }
                        catch {
                            fail(n, "region is not the JSON flow this exporter writes");
                        }
                    }
                    else
                        planting[key] = parseFlow(value, n);
                }
                else
                    planting[key] = parseScalar(value, n);
            }
        }
        else if (line.startsWith("  ")) {
            planting = null;
            sublist = null;
            list = null;
            const body = line.slice(2);
            const colon = body.indexOf(":");
            if (colon < 0)
                fail(n, "malformed field");
            const key = body.slice(0, colon);
            const rest = body.slice(colon + 1);
            if (key === "observations" || key === "plantings") {
                if (rest === "") {
                    list = [];
                    listKey = key;
                    season[key] = list;
                }
                else if (rest === " []")
                    season[key] = [];
                else
                    fail(n, `malformed ${key}`);
            }
            else if (key === "plan" || key === "next_plan" || key === "removed_plantings" || key === "removed_observations" || key === "planted_from" || key === "set_aside") {
                try {
                    season[key] = JSON.parse(rest.slice(1));
                }
                catch {
                    fail(n, `${key} is not the JSON flow this exporter writes`);
                }
            }
            else if (rest.startsWith(" ")) {
                season[key] = parseScalar(rest.slice(1), n);
            }
            else
                fail(n, `malformed field ${JSON.stringify(key)}`);
        }
        else
            fail(n, `unexpected line ${JSON.stringify(line)}`);
    }
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`imported season is invalid:\n${errors.join("\n")}`);
    return season;
}

const SUGGEST_FIELDS = ["family", "lifespan", "light_min", "frost_tolerance", "mature_height_cm", "mature_spread_cm",
    "days_to_maturity", "start_indoors_weeks", "feeder_class", "pollinator_value", "ground_coverage"];
function suggestFromName(typed, species) {
    const t = ` ${typed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
    if (t.trim().length < 3)
        return null;
    let best = null;
    for (const rec of species) {
        const names = Array.isArray(rec.common) ? rec.common : typeof rec.common === "string" ? [rec.common] : [];
        for (const n of names) {
            if (typeof n !== "string")
                continue;
            const w = n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            if (w.length >= 3 && (t.includes(` ${w} `) || t.includes(` ${w}s `) || t.includes(` ${w}es `))
                && (!best || w.length > best.label.length))
                best = { rec, label: w };
        }
    }
    if (!best)
        return null;
    const traits = {};
    for (const f of SUGGEST_FIELDS) {
        const v = best.rec[f];
        if (typeof v === "string" || typeof v === "number")
            traits[f] = v;
        else if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number"))
            traits[f] = v;
    }
    if (!Object.keys(traits).length)
        return null;
    const esc = best.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[^a-z0-9]+");
    const variety = typed.replace(new RegExp(`(^|[^a-z0-9])${esc}(?:e?s)?(?=$|[^a-z0-9])`, "i"), "$1")
        .replace(/\s+/g, " ").replace(/^[\s,;:-]+|[\s,;:-]+$/g, "").trim();
    return { speciesId: String(best.rec.id), label: best.label, traits, variety };
}
const CHOICE_WORD = {
    "lifespan:annual": copy.valAnnual, "lifespan:biennial": copy.valBiennial, "lifespan:perennial": copy.valPerennial,
    "light_min:full_sun": copy.valFullSun, "light_min:part_sun": copy.valPartSun, "light_min:part_shade": copy.pfPartShade,
    "light_min:full_shade": copy.pfFullShade,
    "frost_tolerance:very_tender": copy.valVeryTender, "frost_tolerance:tender": copy.valTender,
    "frost_tolerance:half_hardy": copy.valHalfHardy, "frost_tolerance:hardy": copy.valHardy,
    "sow_season:spring": copy.pfSowSpring, "sow_season:fall": copy.pfSowFall,
    "feeder_class:heavy": copy.valHeavyFeeder, "feeder_class:moderate": copy.valModerateFeeder,
    "feeder_class:light": copy.valLightFeeder, "feeder_class:fixer": copy.valFixer, "feeder_class:none": copy.pfFeederNone,
    "ground_coverage:none": copy.pfCoverNone, "ground_coverage:low": copy.pfCoverLow,
    "ground_coverage:moderate": copy.pfCoverModerate, "ground_coverage:high": copy.pfCoverHigh,
    "pollinator_value:none": copy.valNone, "pollinator_value:low": copy.valLow, "pollinator_value:moderate": copy.valModeratePoll,
    "pollinator_value:high": copy.valHigh, "pollinator_value:very_high": copy.valVeryHigh,
    "support_provides:none": copy.pfCarriesNothing, "support_provides:weak": copy.valCarriesLight, "support_provides:strong": copy.valCarriesVine,
    "support_requires:none": copy.pfNeedsNoSupport, "support_requires:weak": copy.valSupportWeak,
    "support_requires:moderate": copy.valSupportModerate, "support_requires:optional_strong": copy.valSupportOptional,
    "support_requires:strong": copy.valSupportStrong,
};
const choiceWord = (field, v) => CHOICE_WORD[`${field}:${v}`] ?? v.replace(/_/g, " ");
const FAMILY_DATALIST = "upfamilies";
function row(labelText, forId, ...controls) {
    const r = el("div", "uprow");
    const label = el("label");
    label.htmlFor = forId;
    label.textContent = labelText;
    r.append(label, ...controls);
    return r;
}
const measureValue = (v) => typeof v === "number" ? String(v) : Array.isArray(v) && typeof v[0] === "number" ? String(v[0]) : "";
const strValue = (v) => (typeof v === "string" ? v : "");
let seq = 0;
function plantEditorForm(opts) {
    const seed = opts.seed ?? {};
    const uid = `pf${seq++}`;
    const root = el("div", "upform");
    const textInput = (field, placeholder = "") => {
        const i = el("input");
        i.id = `${uid}-${field}`;
        i.type = "text";
        i.placeholder = placeholder;
        i.value = strValue(seed[field]);
        return i;
    };
    const numInput = (field, placeholder = "", seedVal) => {
        const i = el("input");
        i.id = `${uid}-${field}`;
        i.type = "number";
        i.min = "0";
        i.step = "1";
        i.placeholder = placeholder;
        i.value = seedVal ?? measureValue(seed[field]);
        return i;
    };
    const enumSelect = (field, values) => {
        const s = el("select");
        s.id = `${uid}-${field}`;
        const none = el("option");
        none.value = "";
        none.textContent = "-";
        s.appendChild(none);
        for (const v of values) {
            const o = el("option");
            o.value = v;
            o.textContent = choiceWord(field, v);
            s.appendChild(o);
        }
        s.value = strValue(seed[field]);
        return s;
    };
    const check = (field, labelText) => {
        const r = el("div", "uprow check");
        const l = el("label");
        const cb = el("input");
        cb.id = `${uid}-${field}`;
        cb.type = "checkbox";
        cb.checked = seed[field] === true;
        l.append(cb, document.createTextNode(" " + labelText));
        r.appendChild(l);
        return r;
    };
    const name = textInput("common", copy.pfPhName);
    const family = textInput("family", copy.pfPhFamily);
    family.setAttribute("list", FAMILY_DATALIST);
    if (family.value)
        family.value = familyShown(family.value);
    const lifespan = enumSelect("lifespan", LIFESPANS);
    const light = enumSelect("light_min", LIGHT_LEVELS);
    const imperial = unitSystem() === "imperial", fahr = tempSystem() === "f";
    const firstNum = (v) => typeof v === "number" ? v : Array.isArray(v) && typeof v[0] === "number" ? v[0] : undefined;
    const showStored = (i, stored, toShown) => {
        if (stored === undefined)
            return;
        i.value = String(toShown(stored));
        i.dataset.stored = String(stored);
        i.dataset.shown = i.value;
    };
    const cmShown = (cm) => (imperial ? Math.round(cm / 2.54) : cm);
    const cShown = (c) => (fahr ? Math.round((c * 9) / 5 + 32) : c);
    const height = numInput("mature_height_cm", imperial ? copy.pfPhHeightIn : copy.pfPhHeight, "");
    const spread = numInput("mature_spread_cm", imperial ? copy.pfPhSpreadIn : copy.pfPhSpread, "");
    showStored(height, firstNum(seed.mature_height_cm), cmShown);
    showStored(spread, firstNum(seed.mature_spread_cm), cmShown);
    const dtm = numInput("days_to_maturity", copy.pfPhDtm);
    const frost = enumSelect("frost_tolerance", FROST_TOLERANCES);
    const zoneLo = numInput("hardiness_zone_lo", copy.pfPhZoneLo, Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[0]) : "");
    const zoneHi = numInput("hardiness_zone_hi", copy.pfPhZoneHi, Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[1]) : "");
    const zoneRow = row(copy.pfHardinessZones, `${uid}-hardiness_zone_lo`, zoneLo, document.createTextNode(" – "), zoneHi);
    zoneRow.classList.add("pair");
    const syncZone = () => { zoneRow.hidden = lifespan.value !== "perennial"; };
    lifespan.addEventListener("change", syncZone);
    const offer = el("p", "upsuggest");
    offer.hidden = true;
    const fillEmpty = (sg) => {
        let n = 0;
        const put = (i, v) => {
            if (i.value.trim() !== "" || v === undefined)
                return;
            const s = Array.isArray(v) ? String(v[0]) : String(v);
            if (i instanceof HTMLSelectElement && ![...i.options].some((o) => o.value === s))
                return;
            i.value = s;
            n++;
        };
        put(family, typeof sg.traits.family === "string" ? familyShown(sg.traits.family) : sg.traits.family);
        put(lifespan, sg.traits.lifespan);
        put(light, sg.traits.light_min);
        put(frost, sg.traits.frost_tolerance);
        for (const [i, v] of [[height, sg.traits.mature_height_cm], [spread, sg.traits.mature_spread_cm]]) {
            const cm = firstNum(v);
            if (i.value.trim() === "" && cm !== undefined) {
                showStored(i, cm, cmShown);
                n++;
            }
        }
        put(dtm, sg.traits.days_to_maturity);
        put(startIndoors, sg.traits.start_indoors_weeks);
        put(feeder, sg.traits.feeder_class);
        put(pollinator, sg.traits.pollinator_value);
        put(ground, sg.traits.ground_coverage);
        syncZone();
        return n;
    };
    const refreshOffer = () => {
        const sg = opts.suggest?.(name.value) ?? null;
        offer.replaceChildren();
        offer.hidden = !sg;
        if (!sg)
            return;
        const plant = (opts.nameOf?.(sg.speciesId) ?? sg.label).toLocaleLowerCase();
        offer.append(document.createTextNode(`${fillCopy(/^[aeiou]/.test(sg.label) ? "pfSoundsLikeAn" : "pfSoundsLikeA", { plant })} `));
        if (opts.keep && sg.variety) {
            const k = el("button", "linky upsuggest-keep");
            k.type = "button";
            k.textContent = fillCopy("pfKeepVarietyBtn", { variety: sg.variety, plant });
            k.addEventListener("click", () => void opts.keep(sg.speciesId, sg.variety)
                .then((said) => offer.replaceChildren(document.createTextNode(said)))
                .catch((e) => offer.replaceChildren(document.createTextNode(String(e instanceof Error ? e.message : e)))));
            offer.append(k, document.createTextNode(` ${copy.pfOrOwn} `));
        }
        const b = el("button", "linky upsuggest-go");
        b.type = "button";
        b.textContent = fillCopy("pfFillBtn", { plant });
        b.addEventListener("click", () => {
            const n = fillEmpty(sg);
            offer.replaceChildren(document.createTextNode(n
                ? fillCopy(n === 1 ? "pfFilledOne" : "pfFilledMany", { n, plant })
                : fillCopy("pfNothingToFill", { plant })));
        });
        offer.appendChild(b);
    };
    if (opts.suggest)
        name.addEventListener("input", refreshOffer);
    root.append(row(copy.pfName, name.id, name), offer, row(copy.pfFamily, family.id, family), row(copy.pfLifespan, lifespan.id, lifespan), row(copy.pfSun, light.id, light), row(copy.pfMatureHeight, height.id, height), row(copy.pfMatureSpread, spread.id, spread), row(copy.pfDtm, dtm.id, dtm), row(copy.pfFrostTolerance, frost.id, frost), zoneRow);
    syncZone();
    const succ = numInput("succession_interval_days", copy.pfPhSucc);
    const startIndoors = numInput("start_indoors_weeks", copy.pfPhStartIndoors);
    const sowSeason = enumSelect("sow_season", SOW_SEASONS);
    const nightTemp = numInput("night_temp_max_c", fahr ? copy.pfPhNightTempF : copy.pfPhNightTemp, "");
    showStored(nightTemp, firstNum(seed.night_temp_max_c), cShown);
    const habit = textInput("habit", copy.pfPhHabit);
    const feeder = enumSelect("feeder_class", FEEDER_CLASSES);
    const ground = enumSelect("ground_coverage", GROUND_COVERAGES);
    const pollinator = enumSelect("pollinator_value", POLLINATOR_VALUES);
    const supProvides = enumSelect("support_provides", SUPPORT_PROVIDES);
    const supRequires = enumSelect("support_requires", SUPPORT_REQUIRES);
    const notes = el("textarea");
    notes.id = `${uid}-notes`;
    notes.placeholder = copy.pfPhNotes;
    notes.value = strValue(seed.notes);
    const adv = el("details", "moretraits");
    const advSum = el("summary");
    advSum.textContent = copy.pfMoreTraits;
    adv.appendChild(advSum);
    adv.append(row(copy.pfResow, succ.id, succ), row(copy.pfStartIndoors, startIndoors.id, startIndoors), row(copy.pfSowSeason, sowSeason.id, sowSeason), row(copy.pfHeatLimit, nightTemp.id, nightTemp), row(copy.pfHabit, habit.id, habit), row(copy.pfFeeder, feeder.id, feeder), row(copy.pfGroundCover, ground.id, ground), row(copy.pfPollinator, pollinator.id, pollinator), row(copy.pfProvidesSupport, supProvides.id, supProvides), row(copy.pfNeedsSupport, supRequires.id, supRequires), check("n_fixing", copy.pfNFixer), check("casts_shade", copy.pfCastsShade), check("volatile_aromatic", copy.pfAromatic), check("verticillium_susceptible", copy.pfVerticillium), row(copy.pfNotes, notes.id, notes));
    const ADV_FIELDS = ["succession_interval_days", "start_indoors_weeks", "sow_season", "night_temp_max_c",
        "habit", "feeder_class", "ground_coverage", "pollinator_value", "support", "n_fixing", "casts_shade",
        "volatile_aromatic", "verticillium_susceptible", "notes"];
    adv.open = ADV_FIELDS.some((f) => seed[f] !== undefined);
    root.appendChild(adv);
    const val = (el) => el.value.trim();
    const measure = (el) => {
        const v = val(el);
        if (!v)
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? [n, n] : undefined;
    };
    const scalar = (el) => {
        const v = val(el);
        if (!v)
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const stored = (el, fromShown) => {
        const v = val(el);
        if (!v)
            return undefined;
        if (el.dataset.shown === v && el.dataset.stored)
            return Number(el.dataset.stored);
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? fromShown(n) : undefined;
    };
    const cmFrom = (n) => (imperial ? Math.round(n * 2.54) : n);
    const cFrom = (n) => (fahr ? Math.round(((n - 32) * 5) / 9 * 10) / 10 : n);
    const lenCm = (el) => { const c = stored(el, cmFrom); return c === undefined ? undefined : [c, c]; };
    const cb = (field) => root.querySelector(`#${uid}-${field}`).checked;
    return {
        root,
        focusName: () => name.focus(),
        read() {
            const traits = {};
            const set = (k, v) => { if (v !== undefined && v !== "")
                traits[k] = v; };
            set("family", val(family) ? familyKeyOf(val(family)) : undefined);
            set("lifespan", val(lifespan) || undefined);
            set("light_min", val(light) || undefined);
            set("frost_tolerance", val(frost) || undefined);
            set("feeder_class", val(feeder) || undefined);
            set("ground_coverage", val(ground) || undefined);
            set("pollinator_value", val(pollinator) || undefined);
            set("habit", val(habit) || undefined);
            set("mature_height_cm", lenCm(height));
            set("mature_spread_cm", lenCm(spread));
            set("days_to_maturity", measure(dtm));
            set("succession_interval_days", measure(succ));
            set("start_indoors_weeks", scalar(startIndoors));
            set("sow_season", val(sowSeason) || undefined);
            set("night_temp_max_c", stored(nightTemp, cFrom));
            const lo = scalar(zoneLo), hi = scalar(zoneHi);
            if (lifespan.value === "perennial" && lo !== undefined && hi !== undefined)
                traits.hardiness_zone = [lo, hi];
            const support = {};
            if (val(supProvides))
                support.provides = val(supProvides);
            if (val(supRequires))
                support.requires = val(supRequires);
            if (Object.keys(support).length)
                traits.support = support;
            for (const b of ["n_fixing", "casts_shade", "volatile_aromatic", "verticillium_susceptible"]) {
                if (cb(b))
                    traits[b] = true;
            }
            const notesV = notes.value.trim();
            if (notesV)
                traits.notes = notesV;
            return { name: val(name), traits };
        },
    };
}

function symptomKnown(s, crop, cropName, bundle) {
    const rec = crop ? bundle.species.find((x) => x.id === crop) : undefined;
    const sp = rec && !plantAgainst(rec) ? crop : null;
    return { ...(sp && cropName ? { crop: sp, cropName } : {}), tip: seeAlsoTip(bundle, s.rules) };
}
function drawWhenReady(host, surface, known, opts) {
    const draw = () => { const view = chunkReady("trail"); if (view && host.isConnected)
        view.drawTrail(host, surface, known, opts); };
    if (chunkReady("trail"))
        draw();
    else
        void loadChunk("trail").then(draw, () => { });
}
function noteInDiary(label) {
    const note = document.getElementById("obsnote");
    const ev = document.getElementById("obsevent");
    if (!note)
        return;
    if (ev && ev.value !== "note" && [...ev.options].some((o) => o.value === "note")) {
        ev.value = "note";
        ev.dispatchEvent(new Event("change"));
    }
    note.value = label;
    note.focus();
}
function wrongTrail(card, s, about, bundle) {
    const host = document.createElement("div");
    card.after(host);
    const known = symptomKnown(s, about, about ? midSentence(commonName(bundle, about)) : null, bundle);
    const own = card.querySelector(".wrong-act");
    drawWhenReady(host, "wrong", known, own ? { adopt: { note: own }, ownWords: ["note"] } : { run: { note: () => noteInDiary(s.label) } });
}
function logTrail(place) {
    const anchor = document.getElementById("logtimeline");
    if (!anchor)
        return;
    let host = document.getElementById("logtrail");
    if (!host) {
        host = document.createElement("div");
        host.id = "logtrail";
    }
    if (host.previousElementSibling !== anchor)
        anchor.after(host);
    host.hidden = /^#\/log\?(.*&)?wrong\b/.test(location.hash);
    drawWhenReady(host, "logfirst", place ? { place: { ...place, place: "" } } : {});
}

let wired = false;
function fillSpecies(bundle) {
    const sel = $$1("seedspecies");
    if (!sel || sel.options.length > 1)
        return;
    const seen = new Set();
    const rows = [];
    for (const s of [...bundle.species, ...app.userSpecies]) {
        const id = s.id;
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        rows.push([id, commonName(bundle, id)]);
    }
    rows.sort((a, b) => a[1].localeCompare(b[1]));
    for (const [id, name] of rows) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = name;
        sel.appendChild(o);
    }
}
const PICK_SHOW = 8;
function wirePicker(bundle) {
    const q = $$1("seedfind");
    const list = $$1("seedpick");
    const sel = $$1("seedspecies");
    if (!q || !list || !sel || q.dataset.wired)
        return;
    q.dataset.wired = "1";
    const close = () => { list.hidden = true; q.setAttribute("aria-expanded", "false"); };
    const choose = (sid) => { sel.value = sid; q.value = commonName(bundle, sid); close(); };
    const note = (text) => {
        const li = document.createElement("li");
        li.className = "seedpick-note";
        li.textContent = text;
        list.appendChild(li);
    };
    let first = "";
    const draw = () => {
        const term = q.value.trim();
        if (sel.value && q.value !== commonName(bundle, sel.value))
            sel.value = "";
        list.replaceChildren();
        first = "";
        if (!term) {
            close();
            return;
        }
        const ids = [...sel.options].map((o) => o.value).filter(Boolean);
        const { hits, exact } = cropSearch(bundle, ids, term);
        if (!hits.length) {
            note(fillCopy("lgCropNone", { q: term }));
        }
        else {
            if (!exact)
                note(copy.lgCropClosest);
            const cat = (sid) => categoryLabel(String(bundle.species.find((x) => x.id === sid)?.category ?? ""));
            const sorted = [...hits].sort((a, b) => cat(a).localeCompare(cat(b)) || commonName(bundle, a).localeCompare(commonName(bundle, b)));
            let head = "";
            for (const sid of sorted.slice(0, PICK_SHOW)) {
                if (cat(sid) !== head) {
                    head = cat(sid);
                    const h = document.createElement("li");
                    h.className = "seedpick-h";
                    h.textContent = head;
                    list.appendChild(h);
                }
                const li = document.createElement("li");
                const b = document.createElement("button");
                b.type = "button";
                b.className = "seedpick-row";
                b.dataset.species = sid;
                b.textContent = commonName(bundle, sid);
                b.addEventListener("click", () => { choose(sid); q.focus(); });
                li.appendChild(b);
                list.appendChild(li);
                first ||= sid;
            }
            if (sorted.length > PICK_SHOW)
                note(fillCopy("lgCropMore", { n: String(sorted.length - PICK_SHOW) }));
        }
        list.hidden = false;
        q.setAttribute("aria-expanded", "true");
    };
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !sel.value && first) {
            e.preventDefault();
            choose(first);
        }
        else if (e.key === "Escape")
            close();
    });
}
const SEED_SHOW = 8;
const foldOpen = new Set();
function appendFolded(list, rows, key, label) {
    let host = list;
    rows.forEach((row, i) => {
        if (i === SEED_SHOW && rows.length > SEED_SHOW + 2) {
            const li = document.createElement("li");
            li.className = "seedmore-row";
            const more = document.createElement("details");
            more.className = "pc-more seedmore";
            more.open = foldOpen.has(key);
            more.addEventListener("toggle", () => { if (more.open)
                foldOpen.add(key);
            else
                foldOpen.delete(key); });
            const sum = document.createElement("summary");
            const m = document.createElement("span");
            m.className = "fm-more";
            m.textContent = label(rows.length - SEED_SHOW);
            const l = document.createElement("span");
            l.className = "fm-less";
            l.textContent = copy.pcRulesFewer;
            sum.append(m, l);
            const rest = document.createElement("ul");
            rest.className = list.className;
            more.append(sum, rest);
            li.appendChild(more);
            list.appendChild(li);
            host = rest;
        }
        host.appendChild(row);
    });
}
function seedRow(bundle, s, onRemove) {
    const li = document.createElement("li");
    li.className = "seed";
    const head = document.createElement("span");
    head.className = "seed-name";
    head.textContent = commonName(bundle, s.species) + (s.variety ? ` — ${s.variety}` : "");
    const text = document.createElement("span");
    text.className = "seed-text";
    text.appendChild(head);
    li.appendChild(text);
    const bits = [s.quantity, s.year ? String(s.year) : "", s.notes].filter(Boolean);
    if (bits.length) {
        const meta = document.createElement("span");
        meta.className = "seed-meta";
        meta.textContent = bits.join(" · ");
        text.appendChild(meta);
    }
    const sp = bundle.species.find((x) => x.id === s.species);
    const thisYear = seasonId() ?? new Date().getFullYear();
    const old = packetAgeLine(commonName(bundle, s.species).replace(/^./, (c) => c.toUpperCase()), s.year, sp?.seed_viability_years, thisYear);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "seed-rm";
    rm.setAttribute("aria-label", fillCopy("sbRemoveLabel", { name: head.textContent ?? "" }));
    rm.textContent = "×";
    rm.addEventListener("click", onRemove);
    li.appendChild(rm);
    if (old) {
        const w = document.createElement("span");
        w.className = "seed-old";
        w.textContent = old;
        li.appendChild(w);
    }
    return li;
}
async function renderSeedBox(db, bundle) {
    const list = $$1("seedlist");
    const empty = $$1("seedempty");
    if (!list)
        return;
    fillSpecies(bundle);
    wirePicker(bundle);
    const draw = async () => {
        const seeds = (await listSeeds(db)).sort((a, b) => commonName(bundle, a.species).localeCompare(commonName(bundle, b.species)));
        list.textContent = "";
        appendFolded(list, seeds.map((s) => seedRow(bundle, s, async () => {
            await deleteSeed(db, s.id);
            toast(fillCopy("sbRemoved", { crop: commonName(bundle, s.species) }));
            await draw();
            await app.logRefresh?.();
        })), "seeds", (n) => fillCopy("sbShowMore", { n: String(n) }));
        if (empty)
            empty.hidden = seeds.length > 0;
    };
    if (!wired) {
        wired = true;
        const form = $$1("seedadd");
        form?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const sel = $$1("seedspecies");
            const species = sel.value;
            if (!species) {
                toast(copy.sbNeedCrop);
                return;
            }
            const yearRaw = ($$1("seedyear")).value.trim();
            const rec = {
                id: mintSeedId(),
                species,
                variety: ($$1("seedvariety")).value.trim() || undefined,
                quantity: ($$1("seedqty")).value.trim() || undefined,
                year: yearRaw ? Number(yearRaw) : undefined,
                notes: ($$1("seednotes")).value.trim() || undefined,
            };
            try {
                await putSeed(db, rec);
                toast(fillCopy("sbAdded", { crop: commonName(bundle, species) }));
                ["seedvariety", "seedqty", "seedyear", "seednotes"]
                    .forEach((id) => { $$1(id).value = ""; });
                sel.selectedIndex = 0;
                const find = $$1("seedfind");
                if (find)
                    find.value = "";
                await draw();
                await app.logRefresh?.();
            }
            catch (err) {
                toast(err instanceof Error ? err.message : copy.sbAddFailed);
            }
        });
    }
    await draw();
}
async function renderShoppingList(db, bundle, plantings, season, beds, anchor) {
    const list = $$1("shoplist");
    const note = $$1("shopnote");
    if (!list || !note)
        return;
    const drafts = season && !season.closed_date && beds
        ? draftPlantings(bundle, { lat: anchor?.lat ?? null, lon: anchor?.lon ?? null }, season, beds) : [];
    const need = new Map();
    for (const p of [...plantings, ...drafts]) {
        if (p && typeof p.species === "string" && p.species)
            need.set(p.species, (need.get(p.species) ?? 0) + 1);
    }
    const owned = new Set((await listSeeds(db)).map((s) => s.species));
    const toBuy = [...need.entries()].filter(([sid]) => !owned.has(sid))
        .map(([sid, n]) => ({ sid, n }))
        .sort((a, b) => commonName(bundle, a.sid).localeCompare(commonName(bundle, b.sid)));
    list.textContent = "";
    if (need.size === 0) {
        note.textContent = copy.sbNothingPlanned;
        note.hidden = false;
        return;
    }
    if (toBuy.length === 0) {
        note.textContent = copy.sbCovered;
        note.hidden = false;
        return;
    }
    note.hidden = true;
    const rows = [];
    for (const { sid, n } of toBuy) {
        const li = document.createElement("li");
        li.className = "shop";
        const name = document.createElement("span");
        name.className = "shop-name";
        name.textContent = commonName(bundle, sid);
        li.appendChild(name);
        if (n > 1) {
            const meta = document.createElement("span");
            meta.className = "shop-meta";
            meta.textContent = fillCopy("sbInThePlan", { n });
            li.appendChild(meta);
        }
        rows.push(li);
    }
    appendFolded(list, rows, "shop", (n) => fillCopy("sbShowMoreBuy", { n: String(n) }));
}

async function downscalePhoto(file) {
    const bmp = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const cx = canvas.getContext("2d");
        if (!cx)
            throw new Error("no 2d canvas - cannot process the photo");
        cx.drawImage(bmp, 0, 0, w, h);
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
        if (!blob)
            throw new Error("the browser could not encode the photo");
        return blob;
    }
    finally {
        bmp.close();
    }
}
function mintPhotoName(date, taken) {
    for (;;) {
        const b = new Uint8Array(2);
        crypto.getRandomValues(b);
        const name = `p-${date}-${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}.jpg`;
        if (!taken.has(name))
            return name;
    }
}
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c >>> 0;
    }
    return t;
})();
function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++)
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
const encoder = new TextEncoder();
function buildStoreZip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const { name, bytes } of entries) {
        const nm = encoder.encode(name);
        const crc = crc32(bytes);
        const local = new Uint8Array([
            0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0),
            ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0),
            ...nm,
        ]);
        central.push(new Uint8Array([
            0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0),
            ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0),
            ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
            ...nm,
        ]));
        parts.push(local, bytes);
        offset += local.length + bytes.length;
    }
    const centralSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array([
        0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
        ...u32(centralSize), ...u32(offset), ...u16(0),
    ]);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
}
function readStoreZip(buf) {
    const b = new Uint8Array(buf);
    const view = new DataView(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= 0 && i >= b.length - 22 - 0xffff; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        throw new Error("not a zip file (no end-of-central-directory)");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const out = [];
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
        if (view.getUint32(p, true) !== 0x02014b50)
            throw new Error("malformed zip central directory");
        const method = view.getUint16(p + 10, true);
        const size = view.getUint32(p + 24, true);
        const nameLen = view.getUint16(p + 28, true);
        const extraLen = view.getUint16(p + 30, true);
        const commentLen = view.getUint16(p + 32, true);
        const localOff = view.getUint32(p + 42, true);
        const name = decoder.decode(b.subarray(p + 46, p + 46 + nameLen));
        if (method !== 0)
            throw new Error(`zip entry ${JSON.stringify(name)} is compressed - this importer reads STORE zips only`);
        if (!name || name.includes("/") || name.includes("\\"))
            throw new Error(`zip entry ${JSON.stringify(name)} is not a bare filename`);
        const lNameLen = view.getUint16(localOff + 26, true);
        const lExtraLen = view.getUint16(localOff + 28, true);
        const start = localOff + 30 + lNameLen + lExtraLen;
        out.push({ name, bytes: b.subarray(start, start + size) });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
}

function firstFreezePassed(seasonYear, freezeMmdd, todayIso, lat = null) {
    if (!freezeMmdd || !/^\d{2}-\d{2}$/.test(freezeMmdd))
        return false;
    return todayIso >= fallDate(freezeMmdd, seasonYear, lat);
}
function tenderStillIn(season, tender, persists) {
    return (season.plantings ?? []).flatMap((p, i) => !p.end_cause && !p.carried_over && !persists(p.species, p.cultivar_group ?? null) && tender(p) ? [i] : []);
}
function frostEnded(season, idx, date) {
    const take = new Set(idx);
    const endOf = (p) => {
        const own = [p.sown, p.transplanted, p.first_harvest, p.last_harvest].filter((d) => typeof d === "string").sort().pop();
        return own && own > date ? own : date;
    };
    return { ...season, plantings: (season.plantings ?? []).map((p, i) => take.has(i) && !p.end_cause && !p.carried_over ? { ...p, end_cause: "frost", end_date: endOf(p) } : p) };
}
function loggedFallFrost(season, lat) {
    let best = null;
    for (const o of season.observations ?? []) {
        if (o.event !== "frost" || typeof o.date !== "string")
            continue;
        const doy = mmddDoy(o.date.slice(5, 10));
        if (doy === null || frostSide(doy, lat) !== "fall")
            continue;
        if (!best || doy < best.doy)
            best = { doy, date: o.date.slice(0, 10) };
    }
    return best?.date ?? null;
}
function plateMonths(seasonYear, lat, todayIso) {
    const order = isSouthern(lat) ? [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const months = order.map((month) => ({ month, year: Number(seasonDate(`${String(month).padStart(2, "0")}-15`, seasonYear, lat).slice(0, 4)) }));
    const open = seasonYearOf(todayIso, lat) === seasonYear ? Number(todayIso.slice(5, 7)) : isSouthern(lat) ? 1 : 7;
    return { months, open };
}
const LB_KG = 0.45359237;
function yieldInput(yi, kg) {
    const lb = unitSystem() !== "metric";
    yi.value = kg == null ? "" : String(lb ? Math.round((kg / LB_KG) * 10) / 10 : kg);
    yi.dataset.stored = kg == null ? "" : String(kg);
    yi.dataset.shown = yi.value;
}
function yieldKg(yi) {
    const v = yi.value.trim();
    if (!v)
        return undefined;
    if (v === yi.dataset.shown && yi.dataset.stored)
        return Number(yi.dataset.stored);
    const n = Number(v);
    return unitSystem() !== "metric" ? Math.round(n * LB_KG * 1000) / 1000 : n;
}
function renderLocations(ctx, seasons, beds, plot, allPlots, closedPlots = []) {
    const { bundle, db, today, view, openCards, msg, said, sang, refresh, activatePlot, closeBed, rollSeason, reopenSeason, reactivateNextSeason, nextSeasonFor, persists, photoInto, locationLabel, fmtMD } = ctx;
    const mkRename = (label, current, save) => {
        const btn = el("button", "linky");
        btn.type = "button";
        btn.textContent = label;
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = current;
            inp.setAttribute("aria-label", label);
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = copy.lgSave;
            const go = () => void (async () => {
                try {
                    await save(inp.value);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                }
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    const mkDeleteGarden = (plot) => {
        const name = gardenNameOf(plot, app.currentPlotId);
        const btn = el("button", "linky gardendelete");
        btn.type = "button";
        btn.textContent = copy.lgDeleteGarden;
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = fillCopy("lgDeleteConfirmPh", { name });
            inp.setAttribute("aria-label", copy.lgDeleteConfirmAria);
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = copy.lgDelete;
            const go = () => void (async () => {
                if (inp.value.trim() !== name) {
                    msg(fillCopy("lgDeleteRefused", { name }), true);
                    return;
                }
                const id = app.currentPlotId;
                const account = plot?.owner === "account";
                const { seasons } = await eraseGarden(db, id, { tombstone: account });
                const delKey = `lgDeleted${seasons ? "Seasons" : ""}${account ? "Sync" : ""}${seasons ? (seasons === 1 ? "One" : "Many") : ""}`;
                msg(fillCopy(delKey, { name, n: seasons }));
                const left = (await listPlots(db)).filter((p) => !p.example);
                await activatePlot(pickGarden(left, { def: defaultPlotId() }) ?? defaultWorkspacePlotId(), false);
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    const mkCloseGarden = (plot) => {
        const name = gardenNameOf(plot, app.currentPlotId);
        const btn = el("button", "linky gardenclose");
        btn.type = "button";
        btn.textContent = copy.lgCloseGarden;
        btn.addEventListener("click", () => {
            const id = app.currentPlotId;
            const others = allPlots.filter((p) => !p.example && !p.shared && p.id !== id);
            if (!others.length) {
                app.openGardenAdd?.({ replace: true });
                return;
            }
            const f = el("span", "renameform gardencloseform");
            f.appendChild(el("span", "gardenclose-ask", fillCopy("lgCloseAsk", { name })));
            const ok = el("button", "linky", copy.lgCloseYes);
            ok.type = "button";
            ok.id = "gardencloseyes";
            const no = el("button", "linky", copy.gmCancel);
            no.type = "button";
            no.addEventListener("click", () => void refresh());
            ok.addEventListener("click", () => void (async () => {
                await setGardenClosed(db, id, today);
                if (defaultPlotId() === id)
                    setDefaultPlot(null);
                msg(fillCopy("lgClosedNotice", { name }));
                await activatePlot(pickGarden(others, { def: defaultPlotId() }) ?? others[0].id, false);
            })());
            f.append(ok, no);
            btn.replaceWith(f);
            ok.focus();
        });
        return btn;
    };
    const renderClosed = () => {
        const box = document.getElementById("closedgardens");
        if (!box)
            return;
        box.replaceChildren();
        box.hidden = !closedPlots.length;
        if (!closedPlots.length)
            return;
        box.appendChild(el("h3", "closed-h", copy.lgClosedGardens));
        box.appendChild(el("p", "hint closed-hint", copy.lgClosedHint));
        const ul = el("ul", "closed-list");
        box.appendChild(ul);
        const ownOpen = allPlots.filter((p) => !p.example && !p.shared);
        for (const cp of orderGardens(closedPlots, (x) => x, null)) {
            const name = gardenNameOf(cp);
            const li = el("li", "closed-row");
            li.dataset.plot = cp.id;
            li.appendChild(el("span", "closed-name", fillCopy("lgClosedRow", { name, date: fmtMonthDayYear(String(cp.closed_date)) })));
            const re = el("button", "linky closed-reopen", copy.lgReopen);
            re.type = "button";
            re.setAttribute("aria-label", fillCopy("lgReopenAria", { name }));
            const dl = el("button", "linky closed-download", copy.lgClosedDownload);
            dl.type = "button";
            dl.setAttribute("aria-label", fillCopy("lgClosedDownloadAria", { name }));
            const reopen = async (swap) => {
                for (const o of swap)
                    await setGardenClosed(db, o.id, today);
                if (swap.some((o) => o.id === defaultPlotId()))
                    setDefaultPlot(null);
                await setGardenClosed(db, cp.id, null);
                msg(swap.length ? fillCopy("lgReopenedSwapNotice", { name, other: gardenNameOf(swap[0]) }) : fillCopy("lgReopenedNotice", { name }));
                await activatePlot(cp.id);
            };
            re.addEventListener("click", () => {
                if (plusPreview() || !ownOpen.length) {
                    void reopen([]);
                    return;
                }
                const f = el("span", "renameform closed-ask");
                f.appendChild(el("span", null, fillCopy("lgReopenAsk", { name, open: gardenNameOf(ownOpen[0]) })));
                const ok = el("button", "linky", copy.lgReopenYes);
                ok.type = "button";
                ok.className = "linky closed-reopenyes";
                const no = el("button", "linky", copy.gmCancel);
                no.type = "button";
                no.addEventListener("click", () => void refresh());
                ok.addEventListener("click", () => void reopen(ownOpen));
                f.append(ok, no);
                re.replaceWith(f);
                dl.hidden = true;
                ok.focus();
            });
            const said = el("span", "hint closed-said");
            said.setAttribute("role", "status");
            said.hidden = true;
            const say = (t) => { said.textContent = t; said.hidden = false; };
            dl.addEventListener("click", () => void downloadClosed(cp, name, say));
            li.append(re, dl, said);
            ul.appendChild(li);
        }
    };
    const downloadClosed = async (cp, name, say) => {
        const seasons = (await listSeasons(db, cp.id)).sort((a, b) => a.id - b.id);
        if (!seasons.length) {
            say(fillCopy("lgClosedNoSeasons", { name }));
            return;
        }
        const entries = [];
        const enc = new TextEncoder();
        for (const sn of seasons) {
            entries.push({ name: `season-${sn.id}.yaml`, bytes: enc.encode(emitSeason(sn)) });
            const named = (sn.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo)).filter((x) => !!x);
            for (const ph of named) {
                const blob = await getPhoto(db, cp.id, sn.id, ph);
                if (blob)
                    entries.push({ name: `season-${sn.id}-photos/${ph}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
            }
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(buildStoreZip(entries));
        a.download = `${cp.id.replace(/^(plot|draft)_/, "")}-seasons.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        say(fillCopy(seasons.length === 1 ? "lgClosedDownloadedOne" : "lgClosedDownloadedMany", { name, n: seasons.length }));
    };
    const host = $$1("loglocations");
    host.innerHTML = "";
    const head = el("div", "loc-head");
    if (allPlots.length > 1) {
        const sel = document.createElement("select");
        sel.className = "garden-sel";
        sel.setAttribute("aria-label", copy.lgGardenAria);
        const def = defaultPlotId();
        for (const pl of orderGardens(allPlots, (p) => p, def)) {
            const o = document.createElement("option");
            o.value = pl.id;
            const base = pl.id === def ? fillCopy("lgNameDefault", { name: gardenNameOf(pl) }) : gardenNameOf(pl);
            o.textContent = pl.shared ? fillCopy("lgNameTagged", { name: base, tag: copy.teamsSharedTag }) : base;
            sel.appendChild(o);
        }
        sel.value = app.currentPlotId;
        sel.addEventListener("change", () => void activatePlot(sel.value));
        head.appendChild(sel);
        if (app.currentPlotId !== EXAMPLE_PLOT_ID)
            head.appendChild(defaultToggle(def === app.currentPlotId, () => {
                setDefaultPlot(def === app.currentPlotId ? null : app.currentPlotId);
                void refresh();
            }));
    }
    else {
        const name = el("span", "loc-name");
        name.textContent = plot?.name ?? copy.hmYourGarden;
        head.appendChild(name);
    }
    const sub = el("span", "loc-sub");
    sub.textContent = pluralCopy("lgBeds", beds.length);
    head.appendChild(sub);
    if (plot?.shared) {
        const tag = el("span", "loc-shared");
        tag.textContent = copy.teamsSharedTag;
        head.appendChild(tag);
    }
    else {
        head.appendChild(mkRename(copy.lgRenameGarden, gardenNameOf(plot, app.currentPlotId), (v) => setPlotName(db, app.currentPlotId, v)));
        const others = allPlots.some((p) => !p.example && p.id !== app.currentPlotId);
        if (app.currentPlotId !== EXAMPLE_PLOT_ID && (beds.length || seasons.length))
            head.appendChild(mkCloseGarden(plot));
        if (app.currentPlotId !== EXAMPLE_PLOT_ID && (beds.length || seasons.length || others))
            head.appendChild(mkDeleteGarden(plot));
    }
    host.appendChild(head);
    renderClosed();
    const where = locationLabel(plot);
    if (where) {
        const w = el("p", "loc-where");
        w.textContent = where;
        host.appendChild(w);
    }
    if (!seasons.length && !beds.length) {
        host.appendChild(emptyState(copy.lgNoBedsYet, copy.lgEmptyGo, "#/plan"));
        return;
    }
    const latestId = seasons.length ? seasons[seasons.length - 1].id : null;
    if (view.viewedYear == null || !seasons.some((s) => s.id === view.viewedYear))
        view.viewedYear = latestId;
    const season = seasons.find((s) => s.id === view.viewedYear) ?? null;
    const closed = !!season?.closed_date;
    const readOnly = closed;
    const openDrafts = season && !closed
        ? draftPlantings(bundle, { lat: plot?.anchor?.lat ?? null, lon: plot?.anchor?.lon ?? null }, season, beds)
        : [];
    if (seasons.length) {
        const years = el("div", "years");
        const lbl = el("span", "years-lbl");
        lbl.textContent = copy.lgSeason;
        years.appendChild(lbl);
        const ribbon = el("div", "seasonribbon");
        ribbon.setAttribute("role", "tablist");
        ribbon.setAttribute("aria-label", copy.lgSeasonYearAria);
        for (const s of [...seasons].sort((a, b) => b.id - a.id)) {
            const on = s.id === view.viewedYear;
            const chip = el("button", `chip seasonchip${on ? " on" : ""}`);
            chip.type = "button";
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", on ? "true" : "false");
            const yr = el("span", "seasonchip-y");
            yr.textContent = String(s.id);
            chip.appendChild(yr);
            const state = s.closed_date ? copy.lgChipClosed : s.id === latestId ? copy.lgChipTracking : null;
            if (state) {
                const sub = el("span", "seasonchip-s");
                sub.textContent = state;
                chip.appendChild(sub);
            }
            chip.addEventListener("click", () => { view.viewedYear = s.id; void refresh(); });
            ribbon.appendChild(chip);
        }
        years.appendChild(ribbon);
        if (readOnly) {
            const ro = el("span", "ro-note");
            ro.textContent = copy.lgHistoryRO;
            years.appendChild(ro);
        }
        host.appendChild(years);
    }
    if (!season) {
        const p = el("p", "hint");
        const out = el("span", "hint");
        const startSeasonYear = async (y) => {
            try {
                if (!(await getSeason(db, app.currentPlotId, y)))
                    await putSeason(db, { id: y, plot: app.currentPlotId, plantings: [], observations: [] });
                view.viewedYear = y;
                await refresh();
                return true;
            }
            catch (e) {
                out.textContent = " " + (e instanceof Error ? e.message : String(e));
                out.className = "why";
                return false;
            }
        };
        const year = seasonYearOf(localTodayIso(), plot?.anchor?.lat ?? null);
        const anchor = plot?.anchor ?? null;
        const csite = anchor ? scheduleClimate(anchor.lat, anchor.lon, bundle)?.site ?? null : null;
        const freezeMmdd = csite?.first_freeze_32f_p50 ?? null;
        const today = localTodayIso();
        const offSeason = frostRare(csite) ? false
            : freezeMmdd ? firstFreezePassed(year, freezeMmdd, today, anchor?.lat ?? null)
                : !isSouthern(anchor?.lat) && today >= `${year}-10-15`;
        if (offSeason) {
            p.textContent = freezeMmdd
                ? fillCopy("lgOffSeasonFreeze", { date: String(fmtMD(freezeMmdd)), year, next: year + 1 })
                : fillCopy("lgOffSeasonLate", { year, next: year + 1 });
            const next = el("button", "btn btn-primary primary");
            next.type = "button";
            next.id = "seasonstart";
            next.textContent = fillCopy("lgPlanFor", { year: year + 1 });
            next.addEventListener("click", () => void startSeasonYear(year).then(async (ok) => {
                if (!ok)
                    return;
                const { go } = await import('./paint.js').then(function (n) { return n.nav; });
                void loadChunk("plan").then((m) => { m.openNextSeason(); go("plan", "nextseason"); }, () => go("plan", "nextseason"));
            }));
            const now = el("button", "btn btn-secondary secondary");
            now.type = "button";
            now.textContent = fillCopy("lgStillGrowing", { year });
            now.addEventListener("click", () => void startSeasonYear(year));
            const row = el("p", "logrow");
            row.append(next, now, out);
            host.append(p, row);
            return;
        }
        p.textContent = copy.lgNoSeasonYet;
        const btn = el("button", "btn btn-primary primary");
        btn.type = "button";
        btn.textContent = fillCopy("lgStartSeason", { year });
        btn.id = "seasonstart";
        btn.addEventListener("click", () => void startSeasonYear(year));
        const row = el("p");
        row.append(btn, out);
        host.append(p, row);
        return;
    }
    let causeSel;
    let dateInp;
    let closeCtrl;
    if (!readOnly) {
        closeCtrl = el("div", "logrow closerow");
        const lbl = el("label");
        lbl.textContent = copy.lgCloseAnnualsEnd;
        causeSel = document.createElement("select");
        causeSel.setAttribute("aria-label", copy.lgCloseCauseAria);
        for (const v of END_CAUSES) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = endCauseLabel(v);
            causeSel.appendChild(o);
        }
        causeSel.value = "pulled";
        const on = el("label");
        on.textContent = copy.lgCloseOn;
        dateInp = document.createElement("input");
        dateInp.type = "date";
        dateInp.value = today;
        dateInp.setAttribute("aria-label", copy.lgCloseDateAria);
        closeCtrl.append(lbl, causeSel, on, dateInp);
    }
    const seasonId = season.id;
    const doRemove = async (idx, species) => {
        try {
            await removePlanting(db, app.currentPlotId, seasonId, idx);
            said(fillCopy("lgRemoved", { name: commonName(bundle, species) }));
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const endCauseFromMode = (mode) => {
        const m = mode.toLowerCase();
        if (/frost|freeze|frozen|cold|hail/.test(m))
            return "frost";
        if (/drought|dry|under.?water|heat|scorch/.test(m))
            return "drought";
        if (/slug|snail|aphid|beetle|bug|caterpillar|worm|borer|mite|deer|rabbit|vole|gopher|pest|animal|bird|squirrel|groundhog/.test(m))
            return "pest";
        if (/blight|rot|mildew|mould|mold|wilt|rust|fung|virus|leaf.?spot|scab|canker|damping|smut|anthracnose|disease/.test(m))
            return "disease";
        return "unknown";
    };
    const plantPanel = (host, idx, bedName) => {
        host.innerHTML = "";
        const p = (season.plantings ?? [])[idx];
        if (!p)
            return;
        const head = el("div", "pp-head");
        const nm = plantLink(plantingLabel(bundle, p.species, p.cultivar_group ?? null), p.species, p.cultivar_group ?? null);
        const vr = p.variety ? el("span", "pvariety") : null;
        if (vr)
            vr.textContent = ` ${fillCopy("lgVarietyShown", { variety: p.variety })}`;
        const st = el("span", "pmeta");
        st.textContent = ` · ${p.end_cause
            ? (p.end_date ? fillCopy("lgPlantEndedOn", { cause: humanize(p.end_cause).toLowerCase(), date: p.end_date }) : fillCopy("lgPlantEnded", { cause: humanize(p.end_cause).toLowerCase() }))
            : p.carried_over ? copy.lgPlantOverwinters : copy.lgPlantGrowing}`;
        const fails = (p.failures ?? []).map((f) => fillCopy("lgFailItem", { mode: f.mode, severity: failureSeverityWord(f.severity) }));
        if (vr)
            head.append(nm, vr);
        else
            head.append(nm);
        if (fails.length) {
            const fm = el("span", "pmeta");
            fm.textContent = ` · ${fillCopy("lgSuffered", { list: fails.join(", ") })}`;
            head.append(st, fm);
        }
        else
            head.append(st);
        host.appendChild(head);
        if (!p.end_cause && plot?.anchor && beds.find((b) => b.name === bedName)?.rain !== "indoors") {
            const opens = plantingWindow(p, bundle.species.find((x) => x.id === p.species))?.opens ?? null;
            const site = scheduleClimate(plot.anchor.lat, plot.anchor.lon, bundle)?.site ?? null;
            const m = opens ? Number(opens.slice(5, 7)) : 0;
            if (m && (boltMonthsFor(site, plot.anchor.lat, [p.species], bundle)[p.species] ?? []).includes(m)) {
                const label = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
                const line = el("p", "pmeta heat");
                linkNameIn(line, fillCopy("lgBoltSoon", { name: label, month: monthLong(m - 1) }), label, p.species);
                mark(line, { kind: "rule", id: "R-172" });
                host.appendChild(line);
            }
        }
        const shots = (p.notes ?? []).filter((n) => n.photo)
            .sort((a, b) => b.date.localeCompare(a.date));
        if (shots.length) {
            const strip = el("div", "photostrip");
            for (const n of shots) {
                const img = document.createElement("img");
                img.className = "photothumb";
                img.loading = "lazy";
                img.alt = fillCopy("lgPhotoAlt", { date: n.date, text: n.text });
                img.addEventListener("click", () => img.classList.toggle("photobig"));
                photoInto(img, seasonId, n.photo);
                strip.appendChild(img);
            }
            host.appendChild(strip);
        }
        if (readOnly)
            return;
        const speciesOpts = () => [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
            ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])]
            .sort((a, b) => a[1].localeCompare(b[1]));
        const stay = (i2) => { view.reselect = i2 === null ? null : { bed: bedName, idx: i2 }; };
        const editPanel = () => {
            const f = el("div", "editform");
            const section = (title) => {
                const s = el("div", "editsec");
                const h = el("p", "editsec-h");
                h.textContent = title;
                s.appendChild(h);
                f.appendChild(s);
                return s;
            };
            const btn = (label, cls = "linky") => {
                const b2 = el("button", cls);
                b2.type = "button";
                b2.textContent = label;
                return b2;
            };
            const rec = section(copy.lgRecordH);
            const pick = document.createElement("select");
            pick.setAttribute("aria-label", copy.lgSpeciesAria);
            for (const [id, name] of speciesOpts()) {
                const o = document.createElement("option");
                o.value = id;
                o.textContent = name;
                if (id === p.species)
                    o.selected = true;
                pick.appendChild(o);
            }
            const dateRow = (label, val) => {
                const w = el("label", "editrow");
                const inp = document.createElement("input");
                inp.type = "date";
                inp.value = val ?? "";
                inp.setAttribute("aria-label", label);
                w.append(document.createTextNode(label + " "), inp);
                return [w, inp];
            };
            const [sw, si] = dateRow(copy.lgSown, p.sown);
            const [tw, ti] = dateRow(copy.lgTransplanted, p.transplanted);
            const [fw, fi] = dateRow(copy.lgFirstHarvest, p.first_harvest);
            const [lw, li] = dateRow(copy.lgLastHarvest, p.last_harvest);
            const vw = el("label", "editrow");
            const vi = document.createElement("input");
            vi.type = "text";
            vi.value = p.variety ?? "";
            vi.maxLength = 200;
            vi.placeholder = copy.lgVarietyPh;
            vi.setAttribute("aria-label", copy.lgVariety);
            const vlist = document.createElement("datalist");
            vlist.id = `pvarieties-${idx}`;
            vi.setAttribute("list", vlist.id);
            void listSeeds(db).then((seeds) => {
                const names = [...new Set(seeds.filter((x) => x.species === p.species && x.variety).map((x) => x.variety))].sort();
                for (const n of names) {
                    const o = document.createElement("option");
                    o.value = n;
                    vlist.appendChild(o);
                }
            }).catch(() => { });
            vw.append(document.createTextNode(copy.lgVariety + " "), vi, vlist);
            const yw = el("label", "editrow");
            const yi = document.createElement("input");
            yi.type = "number";
            yi.min = "0";
            yi.step = "0.1";
            yieldInput(yi, p.yield_kg);
            const yLabel = unitSystem() !== "metric" ? copy.lgYieldLb : copy.lgYieldKg;
            yi.setAttribute("aria-label", yLabel);
            yw.append(document.createTextNode(yLabel + " "), yi);
            const saveRec = btn(copy.lgSaveChanges);
            saveRec.addEventListener("click", () => void (async () => {
                try {
                    await updatePlanting(db, app.currentPlotId, seasonId, idx, {
                        species: pick.value, variety: vi.value.trim() || undefined,
                        sown: si.value || undefined, transplanted: ti.value || undefined,
                        first_harvest: fi.value || undefined, last_harvest: li.value || undefined,
                        yield_kg: yieldKg(yi),
                    });
                    const nm = plantingLabel(bundle, pick.value, p.cultivar_group ?? null);
                    said(fi.value && fi.value !== (p.first_harvest ?? "") ? plantEntryLine("first_harvest", nm, fi.value)
                        : fillCopy("lgUpdated", { name: commonName(bundle, pick.value) }));
                    stay(idx);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                }
            })());
            rec.append(pick, vw, sw, tw, fw, lw, yw, saveRec);
            if (!p.end_cause) {
                const diary = section(copy.lgANoteH);
                diary.classList.add("diary");
                const txt = document.createElement("input");
                txt.type = "text";
                txt.setAttribute("aria-label", copy.lgPlantNoteAria);
                txt.placeholder = copy.lgPlantNotePh;
                const ndt = document.createElement("input");
                ndt.type = "date";
                ndt.value = today;
                ndt.max = today;
                ndt.setAttribute("aria-label", copy.lgNoteDateAria);
                const saveDiary = btn(copy.lgAddNote);
                saveDiary.addEventListener("click", () => void (async () => {
                    if (!txt.value.trim()) {
                        msg(copy.lgWriteNoteFirst, true);
                        return;
                    }
                    if (isFutureDate(ndt.value, localTodayIso())) {
                        msg(copy.lgErrFutureDate, true);
                        return;
                    }
                    try {
                        await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: ndt.value || today, text: txt.value.trim() });
                        said(plantEntryLine("note", plantingLabel(bundle, p.species, p.cultivar_group ?? null), ndt.value || today));
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                diary.append(txt, ndt, saveDiary);
            }
            if (!p.end_cause) {
                const note = section(copy.lgNoteWhatH);
                const mode = document.createElement("input");
                mode.type = "text";
                mode.placeholder = copy.lgFailModePh;
                mode.setAttribute("aria-label", copy.lgFailModeAria);
                const sev = document.createElement("select");
                sev.setAttribute("aria-label", copy.lgSeverityAria);
                for (const v of FAILURE_SEVERITIES) {
                    const o = document.createElement("option");
                    o.value = v;
                    o.textContent = failureSeverityLabel(v);
                    sev.appendChild(o);
                }
                const dt = document.createElement("input");
                dt.type = "date";
                dt.value = today;
                dt.max = today;
                dt.setAttribute("aria-label", copy.lgDateAria);
                const diedL = el("label", "faildied");
                const died = document.createElement("input");
                died.type = "checkbox";
                diedL.append(died, document.createTextNode(" " + copy.lgAndItDied));
                const saveNote = btn(copy.lgSaveNote);
                saveNote.addEventListener("click", () => void (async () => {
                    if (!mode.value.trim()) {
                        msg(copy.lgNameWhatWrong, true);
                        return;
                    }
                    if (isFutureDate(dt.value, localTodayIso())) {
                        msg(copy.lgErrFutureDate, true);
                        return;
                    }
                    try {
                        await addFailure(db, app.currentPlotId, seasonId, idx, { date: dt.value, mode: mode.value.trim(), severity: sev.value });
                        if (died.checked)
                            await endPlanting(db, app.currentPlotId, seasonId, idx, endCauseFromMode(mode.value.trim()), dt.value);
                        said(fillCopy(died.checked ? "lgNotedOnDied" : "lgNotedOn", { mode: mode.value.trim(), name: plantingLabel(bundle, p.species, p.cultivar_group ?? null) }));
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                note.append(document.createTextNode(copy.lgSufferedWord + " "), mode, sev, dt, diedL, saveNote);
            }
            const ph = section(copy.lgAddPhotoH);
            const file = document.createElement("input");
            file.type = "file";
            file.accept = "image/*";
            file.setAttribute("capture", "environment");
            file.setAttribute("aria-label", copy.lgPhotoAria);
            const cap = document.createElement("input");
            cap.type = "text";
            cap.placeholder = copy.lgCaptionPh;
            cap.setAttribute("aria-label", copy.lgCaptionAria);
            const [pw, pi] = dateRow(copy.lgTaken, today);
            const savePh = btn(copy.lgSavePhoto);
            savePh.addEventListener("click", () => void (async () => {
                const f = file.files?.[0];
                if (!f) {
                    msg(copy.lgChoosePhoto, true);
                    return;
                }
                try {
                    const { downscalePhoto, mintPhotoName } = await loadChunk("logpage");
                    const blob = await downscalePhoto(f);
                    const taken = new Set((season.plantings ?? [])
                        .flatMap((q) => (q.notes ?? []).map((n) => n.photo))
                        .filter((x) => !!x));
                    const name = mintPhotoName(pi.value || today, taken);
                    await putPhoto(db, app.currentPlotId, seasonId, name, blob);
                    await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: pi.value || today, text: cap.value.trim() || "Photo", photo: name });
                    said(fillCopy("lgPhotoSaved", { name: plantingLabel(bundle, p.species, p.cultivar_group ?? null) }));
                    stay(idx);
                    await refresh();
                }
                catch (e) {
                    const full = e instanceof DOMException && e.name === "QuotaExceededError";
                    msg(full ? copy.lgStorageFull
                        : fillCopy("lgPhotoFailed", { err: String(e instanceof Error ? e.message : e) }), true);
                }
            })());
            ph.append(file, cap, pw, savePh);
            const rep = section(p.end_cause ? copy.lgPlantNewH : copy.lgReplaceH);
            const pick2 = document.createElement("select");
            pick2.setAttribute("aria-label", copy.lgReplaceAria);
            for (const [id, name] of speciesOpts()) {
                const o = document.createElement("option");
                o.value = id;
                o.textContent = name;
                pick2.appendChild(o);
            }
            const repGo = btn(p.end_cause ? copy.lgPlantIt : copy.lgReplace);
            repGo.addEventListener("click", () => void (async () => {
                try {
                    if (!p.end_cause)
                        await endPlanting(db, app.currentPlotId, seasonId, idx, "pulled", today);
                    const after = await addPlanting(db, app.currentPlotId, seasonId, { species: pick2.value, region: parseRegion(p.region), sown: today });
                    sang(fillCopy("lgPlantedWhere", { name: commonName(bundle, pick2.value), old: plantingLabel(bundle, p.species, p.cultivar_group ?? null).toLowerCase() }));
                    stay((after.plantings ?? []).length - 1);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                }
            })());
            rep.append(pick2, repGo);
            if (p.end_cause) {
                const re = section(copy.lgEndedMistakeH);
                const reopen = btn(copy.lgMarkGrowing);
                reopen.addEventListener("click", () => void 0);
                re.appendChild(reopen);
            }
            const danger = section(copy.lgRemoveRecordH);
            const delBtn = btn(copy.lgDeleteRecord, "linky danger");
            let armed = false;
            delBtn.addEventListener("click", () => void (async () => {
                if (!armed) {
                    armed = true;
                    delBtn.textContent = copy.lgDeleteRecordArmed;
                    delBtn.classList.add("arm");
                    setTimeout(() => { armed = false; delBtn.textContent = copy.lgDeleteRecord; delBtn.classList.remove("arm"); }, 4000);
                    return;
                }
                stay(null);
                await doRemove(idx, p.species);
            })());
            danger.appendChild(delBtn);
            return f;
        };
        const acts = el("div", "pp-acts");
        const editBtn = el("button", "linky");
        editBtn.type = "button";
        editBtn.textContent = copy.lgEdit;
        editBtn.addEventListener("click", () => { acts.replaceWith(editPanel()); });
        acts.appendChild(editBtn);
        host.appendChild(acts);
    };
    const speciesPanel = (host, species, onBed) => {
        host.innerHTML = "";
        const all = onBed.filter(([q]) => q.species === species);
        const living = all.filter(([q]) => !q.end_cause);
        const ended = all.length - living.length;
        const head = el("div", "pp-head");
        const nm = plantLink(commonName(bundle, species), species);
        const st = el("span", "pmeta");
        st.textContent = ` ×${all.length} · `
            + (ended ? fillCopy("lgSpGrowingEnded", { n: living.length, ended }) : fillCopy("lgSpGrowing", { n: living.length }));
        head.append(nm, st);
        host.appendChild(head);
        const acts = el("div", "pp-acts");
        if (!readOnly && living.length) {
            const noteBtn = el("button", "linky");
            noteBtn.type = "button";
            noteBtn.textContent = copy.lgNoteDied;
            noteBtn.addEventListener("click", () => {
                const f = el("div", "failform");
                const mode = document.createElement("input");
                mode.type = "text";
                mode.placeholder = copy.lgFailModePh;
                mode.setAttribute("aria-label", copy.lgFailModeAria);
                const sev = document.createElement("select");
                sev.setAttribute("aria-label", copy.lgSeverityAria);
                for (const v of FAILURE_SEVERITIES) {
                    const o = document.createElement("option");
                    o.value = v;
                    o.textContent = failureSeverityLabel(v);
                    sev.appendChild(o);
                }
                const dt = document.createElement("input");
                dt.type = "date";
                dt.value = today;
                dt.max = today;
                dt.setAttribute("aria-label", copy.lgDateAria);
                const cntWrap = el("span", "failcount");
                const cnt = document.createElement("input");
                cnt.type = "number";
                cnt.min = "1";
                cnt.max = String(living.length);
                cnt.value = String(living.length);
                cnt.setAttribute("aria-label", copy.lgHowManyAffectedAria);
                cntWrap.append(document.createTextNode("- "), cnt, document.createTextNode(" " + fillCopy("lgOfN", { n: living.length })));
                const diedL = el("label", "faildied");
                const died = document.createElement("input");
                died.type = "checkbox";
                diedL.append(died, document.createTextNode(" " + copy.lgAndTheyDied));
                const ok = el("button", "linky");
                ok.type = "button";
                ok.textContent = copy.lgSaveNote;
                ok.addEventListener("click", () => void (async () => {
                    if (!mode.value.trim()) {
                        msg(copy.lgNameWhatWrong, true);
                        return;
                    }
                    if (isFutureDate(dt.value, localTodayIso())) {
                        msg(copy.lgErrFutureDate, true);
                        return;
                    }
                    const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                    const fail = { date: dt.value, mode: mode.value.trim(), severity: sev.value };
                    const cause = died.checked ? endCauseFromMode(fail.mode) : null;
                    try {
                        for (const [, idx] of living.slice(0, wantN)) {
                            await addFailure(db, app.currentPlotId, seasonId, idx, fail);
                            if (cause)
                                await endPlanting(db, app.currentPlotId, seasonId, idx, cause, fail.date);
                        }
                        said(fillCopy(died.checked ? "lgNotedOnNDied" : "lgNotedOnN", { mode: fail.mode, n: wantN, name: commonName(bundle, species) }));
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                f.append(document.createTextNode(copy.lgSufferedWord + " "), mode, sev, dt, cntWrap, diedL, ok);
                noteBtn.replaceWith(f);
            });
            acts.appendChild(noteBtn);
            const detailsBtn = el("button", "linky");
            detailsBtn.type = "button";
            detailsBtn.textContent = copy.lgUpdateDetails;
            detailsBtn.addEventListener("click", () => {
                const f = el("div", "editform");
                const sec = el("div", "editsec");
                const h = el("p", "editsec-h");
                const bulkName = commonName(bundle, species);
                linkNameIn(h, fillCopy("lgUpdateAll", { name: bulkName }), bulkName, species);
                sec.appendChild(h);
                const shared = (get) => {
                    const vals = new Set(living.map(([q]) => get(q) ?? ""));
                    return vals.size === 1 ? [...vals][0] : "";
                };
                const pick = document.createElement("select");
                pick.setAttribute("aria-label", copy.lgSpeciesAria);
                for (const [id, name] of [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
                    ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])].sort((a, b) => a[1].localeCompare(b[1]))) {
                    const o = document.createElement("option");
                    o.value = id;
                    o.textContent = name;
                    if (id === species)
                        o.selected = true;
                    pick.appendChild(o);
                }
                const dateRow = (label, val) => {
                    const w = el("label", "editrow");
                    const inp = document.createElement("input");
                    inp.type = "date";
                    inp.value = val;
                    inp.setAttribute("aria-label", label);
                    w.append(document.createTextNode(label + " "), inp);
                    return [w, inp];
                };
                const [sw, si] = dateRow(copy.lgSown, shared((p) => p.sown));
                const [tw, ti] = dateRow(copy.lgTransplanted, shared((p) => p.transplanted));
                const [fw, fi] = dateRow(copy.lgFirstHarvest, shared((p) => p.first_harvest));
                const [lw, li] = dateRow(copy.lgLastHarvest, shared((p) => p.last_harvest));
                const yw = el("label", "editrow");
                const yi = document.createElement("input");
                yi.type = "number";
                yi.min = "0";
                yi.step = "0.1";
                {
                    const s0 = shared((p) => p.yield_kg != null ? String(p.yield_kg) : "");
                    yieldInput(yi, s0 ? Number(s0) : null);
                }
                const lbs = unitSystem() !== "metric";
                yi.setAttribute("aria-label", lbs ? copy.lgYieldLbEachAria : copy.lgYieldKgEachAria);
                yw.append(document.createTextNode((lbs ? copy.lgYieldLbEach : copy.lgYieldKgEach) + " "), yi);
                const cntWrap = el("span", "failcount");
                const cnt = document.createElement("input");
                cnt.type = "number";
                cnt.min = "1";
                cnt.max = String(living.length);
                cnt.value = String(living.length);
                cnt.setAttribute("aria-label", copy.lgHowManyUpdateAria);
                cntWrap.append(document.createTextNode(copy.lgApplyToWord + " "), cnt, document.createTextNode(" " + fillCopy("lgOfN", { n: living.length })));
                const ok2 = el("button", "linky");
                ok2.type = "button";
                ok2.textContent = copy.lgApplyAll;
                const sync = () => { ok2.textContent = fillCopy("lgApplyToN", { n: Math.max(1, Math.min(living.length, Number(cnt.value) || 1)) }); };
                cnt.addEventListener("input", sync);
                ok2.addEventListener("click", () => void (async () => {
                    const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                    const patch = {};
                    if (pick.value !== species)
                        patch.species = pick.value;
                    if (si.value)
                        patch.sown = si.value;
                    if (ti.value)
                        patch.transplanted = ti.value;
                    if (fi.value)
                        patch.first_harvest = fi.value;
                    if (li.value)
                        patch.last_harvest = li.value;
                    if (yi.value)
                        patch.yield_kg = yieldKg(yi);
                    if (!Object.keys(patch).length) {
                        msg(copy.lgNothingToUpdate, true);
                        return;
                    }
                    try {
                        for (const [, idx] of living.slice(0, wantN))
                            await updatePlanting(db, app.currentPlotId, seasonId, idx, patch);
                        const label = pick.value !== species ? commonName(bundle, pick.value) : commonName(bundle, species);
                        said(fillCopy("lgUpdatedN", { n: wantN, name: label }));
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                sec.append(pick, sw, tw, fw, lw, yw, cntWrap, ok2);
                f.appendChild(sec);
                detailsBtn.replaceWith(f);
            });
            acts.appendChild(detailsBtn);
        }
        host.appendChild(acts);
    };
    if (beds.length) {
        const prev = seasons.find((s) => s.id === season.id - 1) ?? null;
        const plateBeds = beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure }));
        const sec = el("section", "logplate");
        const figWrap = el("div", "logplate-fig");
        const chips = el("div", "logplate-months");
        chips.setAttribute("role", "tablist");
        chips.setAttribute("aria-label", copy.lgMonthAria);
        const plotLat = plot?.anchor?.lat ?? null;
        const plateFrost = plot?.anchor ? gardenFrost(bundle, plot.anchor.lat, plot.anchor.lon, seasons) : null;
        const strip = plateMonths(season.id, plotLat, localTodayIso());
        let month = strip.open;
        const yearOfMonth = (m) => strip.months.find((x) => x.month === m)?.year ?? season.id;
        const frame = gardenFrame(plateBeds, season.plantings ?? []);
        let fig = null;
        const plateSeason = openDrafts.length
            ? { ...season, plantings: [...(season.plantings ?? []), ...openDrafts] }
            : season;
        const modelFor = () => {
            const today = localTodayIso();
            const ym = `${yearOfMonth(month)}-${String(month).padStart(2, "0")}`;
            const iso = today.slice(0, 7) === ym ? today : `${ym}-15`;
            return plateModel({ beds: plateBeds }, plateSeason, prev, iso, (p) => plantingWindow(p, bundle.species.find((x) => x.id === p.species), windowFreeze(plateFrost, plotLat, bundle)));
        };
        const captionFor = () => fillCopy("lgPlateCaption", { month: monthLong(month - 1), year: yearOfMonth(month) });
        const allIdx = (season.plantings ?? []).map((p, i) => [p, i]);
        const bedOf = (p) => beds.find((b) => !bedHasSections(b.name, beds) && plantingOnBed(p.region, b.region))?.name ?? "";
        const panel = el("div", "plantpanel");
        const hint = el("p", "hint");
        hint.textContent = readOnly
            ? copy.lgPlateHintRO
            : copy.lgPlateHint;
        panel.appendChild(hint);
        const legend = el("div", "bd-legend");
        let selIdx = null;
        let hotSpecies = null;
        let zoom = 1;
        const marks = () => fig ? [...fig.querySelectorAll("circle.plate-plant")] : [];
        const clearHot = () => { for (const c of legend.querySelectorAll(".bd-chip.hot"))
            c.classList.remove("hot"); hotSpecies = null; };
        const dressMarks = () => {
            for (const d of marks()) {
                d.classList.add("bd-plant");
                d.classList.toggle("sel", selIdx !== null && d.dataset.idx === String(selIdx));
                d.classList.toggle("dim", !!hotSpecies && d.dataset.species !== hotSpecies);
            }
        };
        const svgOf = () => fig?.querySelector("svg.home-glance") ?? null;
        const applyZoom = () => { const svg = svgOf(); if (svg)
            svg.style.width = `${zoom * 100}%`; };
        const selectPlant = (idx) => {
            const p = (season.plantings ?? [])[idx];
            if (!p)
                return;
            clearHot();
            selIdx = idx;
            dressMarks();
            plantPanel(panel, idx, bedOf(p));
        };
        const openBedCard = (name) => {
            const card = [...host.querySelectorAll(".card")].find((c) => c.dataset.bed === name);
            if (!card)
                return;
            if (!card.classList.contains("open"))
                card.querySelector(".card-head")?.click();
            card.scrollIntoView({ block: "start", behavior: "smooth" });
            const from = document.activeElement;
            if (from instanceof SVGElement && from.dataset.bed === name)
                card.querySelector(".card-head")?.focus({ preventScroll: true });
        };
        const draw = () => {
            const model = modelFor();
            if (fig && figWrap.contains(fig)) {
                yardRepaint(fig, model, captionFor());
                dressMarks();
                return;
            }
            figWrap.replaceChildren();
            if (!frame)
                return;
            fig = yardFigure(frame, plot?.anchor ?? null, openBedCard, () => { }, model, captionFor());
            const svg = svgOf();
            if (svg) {
                const scroller = el("div", "bd-scroll");
                svg.replaceWith(scroller);
                scroller.appendChild(svg);
                applyZoom();
                svg.addEventListener("click", (e) => {
                    const t = e.target;
                    if (t instanceof SVGCircleElement && t.classList.contains("plate-plant") && t.dataset.idx !== undefined)
                        selectPlant(Number(t.dataset.idx));
                });
            }
            dressMarks();
            figWrap.appendChild(fig);
        };
        for (const { month: m } of strip.months) {
            const chip = el("button", `chip logmonth${m === month ? " on" : ""}`);
            chip.type = "button";
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", String(m === month));
            chip.textContent = monthShort(m - 1);
            chip.addEventListener("click", () => {
                month = m;
                [...chips.children].forEach((c) => { c.classList.toggle("on", c === chip); c.setAttribute("aria-selected", String(c === chip)); });
                draw();
            });
            chips.appendChild(chip);
        }
        const bar = el("div", "bd-zoom");
        const mkBtn = (txt, label, fn) => {
            const btn = el("button", "linky");
            btn.type = "button";
            btn.textContent = txt;
            btn.setAttribute("aria-label", label);
            btn.addEventListener("click", fn);
            return btn;
        };
        const setZoom = (nz) => {
            zoom = Math.max(1, Math.min(8, nz));
            applyZoom();
            const sc = fig?.querySelector(".bd-scroll");
            if (sc) {
                sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
                sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
            }
        };
        bar.append(mkBtn("−", copy.lgZoomOut, () => setZoom(zoom / 1.5)), mkBtn("+", copy.lgZoomIn, () => setZoom(zoom * 1.5)), mkBtn("⤢", copy.lgZoomFit, () => { setZoom(1); clearHot(); selIdx = null; dressMarks(); panel.replaceChildren(hint); }));
        const species = [...new Set(allIdx.map(([q]) => q.species))];
        const colourOf = gardenColours();
        for (const sp of species) {
            const items = allIdx.filter(([q]) => q.species === sp);
            const ended = items.filter(([q]) => !!q.end_cause).length;
            const chip = el("button", "chip bd-chip");
            chip.type = "button";
            chip.dataset.species = sp;
            const sw = el("span", "sw");
            sw.style.setProperty("--c", colourOf(sp));
            const rec = bundle.species.find((x) => x.id === sp);
            if (typeof rec?.image?.artist === "string") {
                const im = el("img");
                im.dataset.spotPhoto = sp;
                im.src = `img/thumbs/${encodeURIComponent(sp)}.webp`;
                im.alt = "";
                im.width = 192;
                im.height = 192;
                im.loading = "lazy";
                im.decoding = "async";
                sw.classList.add("haspic");
                sw.appendChild(im);
            }
            const nm = el("span", "nm");
            nm.textContent = `${commonName(bundle, sp)} ×${items.length}`;
            const meta = el("span", "pmeta");
            meta.textContent = ended ? ` · ${fillCopy("lgNEnded", { n: ended })}` : "";
            chip.append(sw, nm, meta);
            chip.addEventListener("click", () => {
                const wasHot = chip.classList.contains("hot");
                clearHot();
                selIdx = null;
                if (wasHot) {
                    dressMarks();
                    panel.replaceChildren(hint);
                }
                else {
                    chip.classList.add("hot");
                    hotSpecies = sp;
                    dressMarks();
                    speciesPanel(panel, sp, allIdx);
                }
            });
            legend.appendChild(chip);
        }
        draw();
        sec.append(figWrap, chips, bar, legend, panel);
        host.appendChild(sec);
        if (view.reselect) {
            const idx = view.reselect.idx;
            view.reselect = null;
            selectPlant(idx);
        }
        if (view.openSpecies) {
            legend.querySelector(`.bd-chip[data-species="${view.openSpecies.species}"]`)?.click();
            view.openSpecies = null;
        }
    }
    const plantOptions = () => [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
        ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])]
        .sort((a, b) => a[1].localeCompare(b[1]));
    const logPlantingRow = (b) => {
        const wrap = el("div", "logplanting");
        const open = el("button", "btn btn-secondary link");
        open.type = "button";
        open.textContent = copy.lgLogPlanting;
        open.addEventListener("click", () => {
            const f = el("div", "editform logplantform");
            const h = el("p", "editsec-h");
            h.textContent = copy.lgWhatPlantedH;
            const pick = document.createElement("select");
            pick.setAttribute("aria-label", copy.lgWhatPlantedH);
            const none = document.createElement("option");
            none.value = "";
            none.textContent = copy.lgChoosePlant;
            pick.appendChild(none);
            for (const [id, name] of plantOptions()) {
                const o = document.createElement("option");
                o.value = id;
                o.textContent = name;
                pick.appendChild(o);
            }
            const how = document.createElement("select");
            how.setAttribute("aria-label", copy.lgHowPlantedAria);
            for (const [v, label] of [["sown", copy.lgSowedSeeds], ["transplanted", copy.lgSetOutPlants]]) {
                const o = document.createElement("option");
                o.value = v;
                o.textContent = label;
                how.appendChild(o);
            }
            const dt = document.createElement("input");
            dt.type = "date";
            dt.value = today;
            dt.setAttribute("aria-label", copy.lgDateAria);
            const save = el("button", "btn btn-primary");
            save.type = "button";
            save.textContent = copy.lgSavePlanting;
            const cancel = el("button", "linky");
            cancel.type = "button";
            cancel.textContent = copy.lgCancel;
            const where = el("p", "pmeta");
            where.textContent = copy.lgPlantingWhere;
            const own = el("p", "pmeta");
            own.textContent = copy.lgPlantingNotOnList;
            const err = el("p", "hint err");
            err.setAttribute("role", "alert");
            err.hidden = true;
            err.style.color = "var(--danger)";
            const fail = (text, at) => { err.textContent = text; err.hidden = false; at.focus(); };
            cancel.addEventListener("click", () => f.replaceWith(open));
            save.addEventListener("click", () => void (async () => {
                if (!pick.value) {
                    fail(copy.lgChoosePlantFirst, pick);
                    return;
                }
                const day = dt.value || today;
                const dayYear = seasonYearOf(day, plot?.anchor?.lat ?? null);
                if (dayYear !== seasonId) {
                    fail(fillCopy("lgPlantingOtherSeason", { year: dayYear, season: seasonId }), dt);
                    return;
                }
                save.disabled = true;
                try {
                    await addPlanting(db, app.currentPlotId, seasonId, { species: pick.value, region: parseRegion(b.region),
                        ...(how.value === "transplanted" ? { transplanted: day } : { sown: day }) });
                    await setBedPlanted(db, app.currentPlotId, b.name, true);
                    openCards.add(b.name);
                    sang(fillCopy("lgPlantingLogged", { name: commonName(bundle, pick.value), bed: b.name }));
                    await refresh();
                }
                catch (e) {
                    save.disabled = false;
                    fail(String(e instanceof Error ? e.message : e), save);
                }
            })());
            const row = el("div", "logrow");
            row.append(pick, how, dt);
            const btns = el("div", "logrow");
            btns.append(save, cancel);
            f.append(h, row, where, own, err, btns);
            open.replaceWith(f);
            pick.focus();
        });
        wrap.appendChild(open);
        return wrap;
    };
    const cards = el("div", "cards");
    if (!beds.length) {
        const hint = el("p", "hint");
        hint.textContent = copy.lgNoBedsYetShort;
        cards.appendChild(hint);
    }
    for (const b of beds) {
        const isContainer = bedHasSections(b.name, beds);
        const sectionNames = isContainer ? beds.filter((x) => sectionParentOf(x, beds) === b.name).map((x) => x.name) : [];
        const st = bedSeasonStatus(b.region, season);
        const stateAttr = isContainer ? "dormant"
            : st.closed || (!st.growing && (st.ended || st.carried)) ? "dormant"
                : st.growing && (st.ended || st.carried) ? "mixed" : st.growing ? "growing" : "ready";
        const card = el("article", "card");
        card.dataset.state = stateAttr;
        card.dataset.bed = b.name;
        const ch = el("button", "card-head");
        ch.type = "button";
        const title = el("span", "card-title");
        title.textContent = isContainer ? fillCopy("lgBedSections", { name: b.name }) : b.name;
        const dim = el("span", "card-dim");
        dim.textContent = bedShapeLabel(b);
        const status = el("span", "card-status");
        const stSpan = (cls, text) => { const s = el("span", cls); s.textContent = text; return s; };
        const stParts = [];
        if (isContainer) {
            stParts.push(stSpan("st-end", pluralCopy("lgDivided", sectionNames.length)));
        }
        else {
            if (st.growing)
                stParts.push(stSpan("st-grow", fillCopy("lgSpGrowing", { n: st.growing })));
            if (st.carried)
                stParts.push(stSpan("st-over", fillCopy("lgNOverwintering", { n: st.carried })));
            if (st.ended)
                stParts.push(stSpan("st-end", fillCopy("lgNEnded", { n: st.ended })));
            const hasDraft = (Array.isArray(season.plan) ? season.plan : []).some((e) => e.area === b.name
                && (!!e.guild || e.mybed === true));
            if (!stParts.length && hasDraft)
                stParts.push(stSpan("st-end", copy.lgReadyToPlant));
        }
        stParts.forEach((s, i) => { if (i)
            status.appendChild(document.createTextNode(" · ")); status.appendChild(s); });
        const caret = el("span", "card-caret");
        caret.textContent = "▾";
        caret.setAttribute("aria-hidden", "true");
        ch.append(title, dim, status, caret);
        const wasOpen = openCards.has(b.name);
        ch.setAttribute("aria-expanded", wasOpen ? "true" : "false");
        ch.addEventListener("click", () => {
            const open = card.classList.toggle("open");
            ch.setAttribute("aria-expanded", open ? "true" : "false");
            if (open)
                openCards.add(b.name);
            else
                openCards.delete(b.name);
        });
        card.appendChild(ch);
        if (wasOpen)
            card.classList.add("open");
        if (isContainer) {
            const detail = el("div", "card-detail");
            const p = el("p", "pmeta");
            p.textContent = sectionNames.length
                ? fillCopy("lgSectionsList", { list: sectionNames.join(", ") })
                : copy.lgSectionsNone;
            detail.appendChild(p);
            card.appendChild(detail);
            cards.appendChild(card);
            continue;
        }
        const onBedIdx = (season.plantings ?? []).map((p, i) => [p, i]).filter(([p]) => plantingOnBed(p.region, b.region));
        const draftEntry = (Array.isArray(season.plan) ? season.plan : [])
            .find((e) => e.area === b.name);
        const draftGuild = !onBedIdx.length && draftEntry?.guild ? bundle.guilds.find((g) => g.id === draftEntry.guild) : undefined;
        const myBedDraft = !onBedIdx.length && !draftGuild && draftEntry?.mybed === true && Array.isArray(draftEntry.plantings)
            ? draftEntry.plantings : null;
        const isDraft = !!draftGuild || !!myBedDraft;
        const bedDrafts = isDraft ? openDrafts.filter((dp) => plantingOnBed(dp.region, b.region)) : [];
        const prev = el("div", "preview");
        const groups = new Map();
        for (const [p] of onBedIdx)
            groups.set(p.species, (groups.get(p.species) ?? 0) + 1);
        for (const p of bedDrafts)
            groups.set(p.species, (groups.get(p.species) ?? 0) + 1);
        if (isDraft) {
            const d = el("span", "chip quiet");
            d.textContent = draftGuild ? fillCopy("lgDraftTeam", { team: displayName(draftGuild) }) : copy.lgDraftOwn;
            prev.appendChild(d);
        }
        else if (!groups.size) {
            const chip = el("span", "chip quiet");
            chip.textContent = copy.lgNothingPlanted;
            prev.appendChild(chip);
        }
        const colourOf = gardenColours();
        [...groups].forEach(([sp, n]) => {
            const chip = el("span", "chip");
            const dot = el("span", "dot");
            dot.style.background = colourOf(sp);
            dot.dataset.species = sp;
            chip.append(dot, plantLink(commonName(bundle, sp), sp));
            if (n > 1)
                chip.append(document.createTextNode(` ×${n}`));
            prev.appendChild(chip);
        });
        card.appendChild(prev);
        const detail = el("div", "card-detail");
        const h4 = el("h4");
        h4.textContent = readOnly ? fillCopy("lgWhatGrewIn", { year: season.id }) : copy.lgWhatsGrowing;
        detail.appendChild(h4);
        if (!onBedIdx.length) {
            const p = el("p", "pmeta");
            p.textContent = draftGuild
                ? fillCopy("lgDraftTeamNote", { team: displayName(draftGuild) })
                : myBedDraft
                    ? copy.lgDraftOwnNote
                    : copy.lgBedEmpty;
            detail.appendChild(p);
        }
        const detGroups = new Map();
        for (const [p] of onBedIdx) {
            const k = `${p.species}|${p.cultivar_group ?? ""}`;
            let g = detGroups.get(k);
            if (!g) {
                g = { species: p.species, group: p.cultivar_group ?? null, n: 0, grow: 0, ended: 0, carried: 0, fails: new Map() };
                detGroups.set(k, g);
            }
            g.n++;
            if (p.end_cause)
                g.ended++;
            else if (p.carried_over)
                g.carried++;
            else
                g.grow++;
            for (const d of new Set((p.failures ?? []).map((f) => fillCopy("lgFailItem", { mode: f.mode, severity: failureSeverityWord(f.severity) })))) {
                g.fails.set(d, (g.fails.get(d) ?? 0) + 1);
            }
        }
        for (const g of detGroups.values()) {
            const row = el("div", "prow");
            const info = el("span");
            const nm = plantLink(plantingLabel(bundle, g.species, g.group), g.species, g.group);
            const bits = [];
            if (g.group)
                bits.push(g.group);
            const meta = el("span", "pmeta");
            meta.textContent = (g.n > 1 ? ` ×${g.n}` : "") + (bits.length ? ` · ${bits.join(" · ")}` : "");
            info.append(nm, meta);
            const pill = el("span", "stpill");
            const parts = [];
            if (g.grow)
                parts.push(fillCopy("lgSpGrowing", { n: g.grow }));
            if (g.carried)
                parts.push(fillCopy("lgNOverwinters", { n: g.carried }));
            if (g.ended)
                parts.push(fillCopy("lgNEnded", { n: g.ended }));
            if (g.ended && !g.grow && !g.carried)
                pill.classList.add("end");
            else if (g.carried && !g.grow && !g.ended)
                pill.classList.add("over");
            else
                pill.classList.add("grow");
            pill.textContent = g.n === 1
                ? (g.ended ? copy.lgPillEnded : g.carried ? copy.lgPlantOverwinters : copy.lgPlantGrowing)
                : parts.join(" · ");
            row.append(info, pill);
            detail.appendChild(row);
            if (g.fails.size) {
                const nIssues = [...g.fails.values()].reduce((a, c) => a + c, 0);
                const d = el("details", "issues");
                const sum = document.createElement("summary");
                sum.textContent = pluralCopy("lgIssues", nIssues);
                d.appendChild(sum);
                const ul = el("ul", "issuelist");
                for (const [desc, c] of [...g.fails].sort((a, b) => b[1] - a[1])) {
                    const li = document.createElement("li");
                    li.textContent = `${c}× ${desc}`;
                    ul.appendChild(li);
                }
                d.appendChild(ul);
                detail.appendChild(d);
            }
        }
        if (!readOnly && (draftGuild || myBedDraft)) {
            const stateRow = el("div", "bedstate");
            const badge = el("span", "plantedbadge");
            badge.textContent = copy.lgDraftBadge;
            const mark = el("button", "btn btn-secondary link markplanted");
            mark.type = "button";
            mark.textContent = copy.lgMarkPlanted;
            mark.title = copy.lgMarkPlantedTitle;
            const note = el("span", "pmeta");
            note.textContent = ` · ${copy.lgPlannedNotIn}`;
            stateRow.append(badge, mark, note);
            detail.appendChild(stateRow);
            const callout = el("p", "pmeta cfg");
            callout.style.display = "none";
            detail.appendChild(callout);
            const site = { lat: plot?.anchor?.lat ?? null, lon: plot?.anchor?.lon ?? null, season_year: season.id };
            let armed = false;
            const plant = async (advancing) => {
                mark.disabled = true;
                const res = advancing
                    ? await markBedPlantedAdvancingSeason(b.name, bundle, site)
                    : await markBedPlanted(b.name, bundle, site);
                if (res.ok) {
                    if (advancing && "seasonId" in res && typeof res.seasonId === "number")
                        setSeasonId(res.seasonId);
                    sang(plantedLine(season.id, res.planted, b.name));
                    await refresh();
                }
                else {
                    mark.disabled = false;
                    msg(res.reason, true);
                }
            };
            mark.addEventListener("click", () => void (async () => {
                const now = new Date();
                const nowSeason = seasonYearOf(localTodayIso(now), plot?.anchor?.lat ?? null);
                if (nowSeason !== season.id) {
                    const yr = nowSeason;
                    callout.replaceChildren(document.createTextNode(fillCopy("lgCrossYear", { year: yr, season: season.id }) + " "));
                    const adv = el("button", "btn btn-secondary link");
                    adv.type = "button";
                    adv.textContent = fillCopy("lgStartYearPlant", { year: yr });
                    adv.addEventListener("click", () => void plant(true));
                    callout.appendChild(adv);
                    callout.style.display = "";
                    return;
                }
                if (draftGuild && !armed) {
                    const csite = plot?.anchor ? scheduleClimate(plot.anchor.lat, plot.anchor.lon, bundle)?.site ?? null : null;
                    const nudge = offSeasonNudge(draftGuild, bundle, csite?.last_frost_32f?.p50 ?? null, csite?.first_freeze_32f_p50 ?? null, localTodayIso(now), plot?.anchor?.lat ?? null, csite);
                    if (nudge) {
                        armed = true;
                        callout.replaceChildren();
                        linkNamesIn(callout, fillCopy("lgNudgeAgain", { nudge: nudge.text }), nudge.marks);
                        callout.style.display = "";
                        return;
                    }
                }
                await plant(false);
            })());
        }
        else if (!readOnly && onBedIdx.length) {
            const stateRow = el("div", "bedstate");
            const badge = el("span", "plantedbadge on");
            badge.textContent = copy.lgPlantedBadge;
            const note = el("span", "pmeta");
            note.textContent = ` · ${copy.lgInGroundNote}`;
            stateRow.append(badge, note);
            detail.appendChild(stateRow);
            const cfg = el("p", "pmeta cfg");
            cfg.textContent = copy.lgSetPlantsCfg;
            detail.appendChild(cfg);
        }
        if (!readOnly && !draftGuild && !myBedDraft)
            detail.appendChild(logPlantingRow(b));
        const acts = el("div", "card-actions");
        const planBtn = el("button", "btn btn-secondary link");
        planBtn.type = "button";
        planBtn.textContent = readOnly ? copy.lgPlanThisBed : copy.lgEditPlanBed;
        planBtn.addEventListener("click", () => {
            const cand = $$1("candbed");
            if ([...cand.options].some((o) => o.value === b.name)) {
                cand.value = b.name;
                cand.dispatchEvent(new Event("change"));
            }
            location.hash = "#/plan";
        });
        acts.appendChild(planBtn);
        if (!readOnly)
            acts.appendChild(mkRename(copy.lgRenameBed, b.name, (v) => renameBed(db, app.currentPlotId, b.name, v)));
        if (!readOnly && st.growing > 0) {
            const cb = el("button", "btn btn-quiet link");
            cb.type = "button";
            cb.textContent = copy.lgCloseBed;
            cb.addEventListener("click", () => { if (causeSel && dateInp)
                void closeBed(season, b, causeSel.value, dateInp.value); });
            acts.appendChild(cb);
        }
        detail.appendChild(acts);
        card.appendChild(detail);
        cards.appendChild(card);
    }
    host.appendChild(cards);
    const orphans = (season.plantings ?? []).map((p, i) => [p, i])
        .filter(([p]) => !beds.some((b) => plantingOnBed(p.region, b.region)));
    if (orphans.length) {
        const box = el("div", "orphans");
        const h = el("h4");
        h.textContent = copy.lgNotInBed;
        box.appendChild(h);
        for (const [p, idx] of orphans) {
            const row = el("div", "prow");
            const nm = plantLink(plantingLabel(bundle, p.species, p.cultivar_group ?? null), p.species, p.cultivar_group ?? null);
            const meta = el("span", "pmeta");
            meta.textContent = ` · ${regionLabel(p.region)}`;
            const info = el("span");
            info.append(nm, meta);
            row.appendChild(info);
            if (!readOnly) {
                const rm = el("button", "linky");
                rm.type = "button";
                rm.textContent = copy.lgRemove;
                rm.addEventListener("click", () => void doRemove(idx, p.species));
                row.appendChild(rm);
            }
            box.appendChild(row);
        }
        host.appendChild(box);
    }
    if (!readOnly) {
        const addBed = el("button", "linky addbed");
        addBed.type = "button";
        addBed.textContent = copy.lgAddBedMap;
        addBed.addEventListener("click", () => { location.hash = "#/plan"; });
        host.appendChild(addBed);
    }
    const foot = el("div", "season-foot");
    if (closed) {
        const t = el("span", "hint");
        t.textContent = fillCopy("lgSeasonClosedNote", { year: season.id, date: String(season.closed_date) });
        const next = el("button", "btn btn-primary primary");
        next.type = "button";
        next.textContent = fillCopy("lgStartNextSeason", { year: nextSeasonFor(season) });
        next.addEventListener("click", () => void reactivateNextSeason(season));
        const rev = el("button", "btn btn-secondary link seasonreview");
        rev.type = "button";
        rev.textContent = copy.lgSeasonReview;
        rev.addEventListener("click", () => { location.hash = "#/review"; });
        const re = el("button", "btn btn-quiet link");
        re.type = "button";
        re.textContent = copy.lgReopenSeason;
        re.addEventListener("click", () => void reopenSeason(season));
        foot.append(t, next, rev, re);
    }
    else {
        const anchor = plot?.anchor;
        const site = anchor ? scheduleClimate(anchor.lat, anchor.lon, bundle)?.site ?? null : null;
        const fcal = site ? frostCalibration(seasons, site) : null;
        const freezeMmdd = fcal?.fall.calibrated ? fcal.fall.calibrated_date : (site?.first_freeze_32f_p50 ?? null);
        const liveNow = (season.plantings ?? []).some((p) => !p.end_cause);
        if (liveNow && firstFreezePassed(season.id, freezeMmdd, today, anchor?.lat ?? null)) {
            const nudge = el("p", "closenudge");
            const observed = !!fcal?.fall.calibrated;
            nudge.textContent = fillCopy(observed ? "lgCloseNudgeObserved" : "lgCloseNudge", { date: String(fmtMD(freezeMmdd)) });
            foot.appendChild(nudge);
            const tender = tenderStillIn(season, (p) => {
                const tol = resolveSpecies(p.species, p.cultivar_group ?? null, bundle).frost_tolerance;
                return tol === "tender" || tol === "very_tender";
            }, persists);
            if (tender.length) {
                const on = loggedFallFrost(season, anchor?.lat ?? null) ?? fallDate(freezeMmdd, season.id, anchor?.lat ?? null);
                const byCrop = new Map();
                for (const i of tender) {
                    const p = season.plantings[i];
                    const crop = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
                    byCrop.set(crop, [...(byCrop.get(crop) ?? []), i]);
                }
                const row = el("p", "closerow tenderend");
                row.setAttribute("role", "group");
                const say = el("span");
                say.id = `tenderend-${season.id}`;
                say.textContent = copy.lgTenderStillIn;
                row.setAttribute("aria-labelledby", say.id);
                row.appendChild(say);
                const picks = [];
                const end = el("button", "btn btn-secondary");
                end.type = "button";
                end.textContent = fillCopy("lgTenderEnd", { date: String(fmtMD(on.slice(5))) });
                for (const [crop, idx] of byCrop) {
                    const chip = el("label", "chip on tenderpick");
                    const box = document.createElement("input");
                    box.type = "checkbox";
                    box.checked = true;
                    box.addEventListener("change", () => {
                        chip.classList.toggle("on", box.checked);
                        end.disabled = !picks.some(([b]) => b.checked);
                    });
                    chip.append(box, document.createTextNode(crop));
                    picks.push([box, idx]);
                    row.appendChild(chip);
                }
                end.addEventListener("click", async () => {
                    const chosen = picks.flatMap(([b, idx]) => (b.checked ? idx : []));
                    if (!chosen.length)
                        return;
                    end.disabled = true;
                    try {
                        await putSeason(db, frostEnded(season, chosen, on));
                        said(pluralCopy("lgTenderEnded", chosen.length));
                        await refresh();
                    }
                    catch (e) {
                        end.disabled = false;
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                });
                const keep = el("span", "hint");
                keep.textContent = copy.lgTenderKeep;
                row.append(end, keep);
                foot.appendChild(row);
            }
        }
        const closeFold = document.createElement("details");
        closeFold.className = "logfold closefold disclosure";
        closeFold.open = liveNow && firstFreezePassed(season.id, freezeMmdd, today, anchor?.lat ?? null);
        const closeSum = el("summary", "logfold-sum");
        closeSum.textContent = copy.lgCloseSeasonSum;
        closeFold.appendChild(closeSum);
        if (closeCtrl)
            closeFold.appendChild(closeCtrl);
        const roll = el("button", "btn btn-secondary");
        roll.type = "button";
        roll.textContent = fillCopy("lgCloseSeasonBtn", { year: season.id });
        const note = el("span", "hint");
        note.textContent = " " + copy.lgCloseSeasonNote;
        roll.addEventListener("click", () => {
            foot.innerHTML = "";
            const q = el("span", "why");
            q.textContent = fillCopy("lgCloseConfirm", { year: season.id }) + " ";
            const yes = el("button", "btn btn-primary primary");
            yes.type = "button";
            yes.textContent = copy.lgYesClose;
            yes.addEventListener("click", () => { if (causeSel && dateInp)
                void rollSeason(season, causeSel.value, dateInp.value); });
            const no = el("button", "btn btn-quiet link");
            no.type = "button";
            no.textContent = copy.lgCancel;
            no.addEventListener("click", () => void refresh());
            foot.append(q, yes, no);
        });
        closeFold.append(roll, note);
        foot.appendChild(closeFold);
    }
    host.appendChild(foot);
}

function kindWord(k) {
    switch (k) {
        case "sow": return copy.lgRowSow;
        case "plant": return copy.lgRowPlant;
        case "harvest": return copy.lgRowHarvest;
        case "ended": return copy.lgRowEnded;
        case "problem": return copy.lgRowProblem;
        case "note": return copy.lgRowNote;
        default: return copy.lgRowWeather;
    }
}
function yearCount(shown, all) {
    return shown ? pluralCopy("lgYear", shown) : all ? copy.lgYearNoMatch : copy.lgYearNone;
}
function gardenWords(garden) {
    return {
        deleted: (day) => fillCopy("lgEntryDeletedIn", { day, garden }),
        saved: fillCopy("lgEntrySavedIn", { garden }),
        undone: fillCopy("lgUndoneIn", { garden }),
        editorIn: fillCopy("lgEditorIn", { garden }),
    };
}
function plantingDateWords(field, name) {
    switch (field) {
        case "sown": return fillCopy("lgFutSown", { name });
        case "transplanted": return fillCopy("lgFutSetOut", { name });
        case "first_harvest": return fillCopy("lgFutFirstHarvest", { name: name.toLowerCase() });
        case "last_harvest": return fillCopy("lgFutLastHarvest", { name: name.toLowerCase() });
        default: return fillCopy("lgFutEnded", { name });
    }
}
function nothingMatches() {
    return copy.lgFindNone;
}
function kindChip(k) {
    switch (k) {
        case "sowing": return copy.lgKindSowing;
        case "harvest": return copy.lgKindHarvest;
        case "ended": return copy.lgKindEnded;
        case "weather": return copy.lgKindWeather;
        case "problem": return copy.lgKindProblem;
        default: return copy.lgKindNote;
    }
}
function whereAmI(ctx) {
    const { view, seasons, refresh, nextSeasonFor, reactivateNextSeason } = ctx;
    const line = seasonLine(seasons, localTodayIso(), app.currentPlot?.anchor?.lat ?? null);
    const goToYear = async (y) => {
        view.viewedYear = y;
        await refresh();
        const h = document.querySelector(`#logtimeline .tl-year[data-year="${y}"] .tl-yh`);
        h?.scrollIntoView({ block: "start" });
        h?.focus({ preventScroll: true });
    };
    const openPlanner = () => {
        void import('./paint.js').then(function (n) { return n.nav; }).then(({ go }) => loadChunk("plan").then((m) => { m.openNextSeason(); go("plan", "nextseason"); }, () => go("plan", "nextseason")));
    };
    const door = (y) => {
        const draft = !seasons.some((s) => s.id === y);
        const b = el("button", "linky lf-year");
        b.type = "button";
        b.dataset.year = String(y);
        b.textContent = String(y);
        b.setAttribute("aria-label", draft ? fillCopy("hmNextSeason", { year: y }) : fillCopy("lgMovedShow", { year: y }));
        b.addEventListener("click", () => { if (draft)
            openPlanner();
        else
            void goToYear(y); });
        return b;
    };
    const doors = (ys) => {
        const box = el("span", "lf-years");
        ys.forEach((y, i) => {
            const one = el("span", "lf-y");
            one.append(door(y), i < ys.length - 1 ? "," : "");
            if (i)
                box.append(" ");
            box.append(one);
        });
        return box;
    };
    const p = el("p", "lf-where");
    const segs = [];
    const seg = (template, nodes) => {
        segs.push(() => { const sp = el("span", "lf-seg"); fillNodes$1(sp, template, nodes); return sp; });
    };
    if (line.growing === null)
        segs.push(() => el("span", "lf-seg", copy.lgWhereBetween));
    else
        seg(copy.lgWhereGrowing, { year: door(line.growing) });
    if (line.planning.length)
        seg(copy.lgWherePlanning, { years: doors(line.planning) });
    if (line.past.length)
        seg(copy.lgWherePast, { years: doors(line.past) });
    segs.forEach((make, i) => {
        const sp = make();
        if (i) {
            const sep = el("span", "lf-sep", "\u00b7\u00a0");
            sep.setAttribute("aria-hidden", "true");
            sp.prepend(sep);
            p.append(" ");
        }
        p.append(sp);
    });
    const newest = seasons[seasons.length - 1];
    if (line.growing === null && !line.planning.length && newest && !app.currentPlot?.shared && !isExamplePlot(app.currentPlotId)) {
        const b = el("button", "btn btn-secondary lf-start", fillCopy("lgWhereStart", { year: nextSeasonFor(newest) }));
        b.type = "button";
        b.addEventListener("click", () => void reactivateNextSeason(newest));
        p.append(b);
    }
    return p;
}
function drawFind(ctx) {
    const host = document.getElementById("logfind");
    if (!host)
        return;
    const { view, seasons, beds, every, rerender } = ctx;
    host.replaceChildren();
    const rows = every ? [...every.values()].flat() : [];
    host.hidden = !seasons.length;
    if (host.hidden)
        return;
    if (ctx.garden)
        host.appendChild(el("h2", "lf-h", fillCopy("lgDiaryOf", { garden: ctx.garden })));
    host.appendChild(whereAmI(ctx));
    if (rows.length < 2)
        return;
    const f = view.find;
    const row = el("div", "lf-chips");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", copy.lgFindAria);
    const chip = (key, label, n, pressed, change) => {
        const b = el("button", "chip lf-chip");
        b.type = "button";
        b.dataset.f = key;
        b.setAttribute("aria-pressed", String(pressed));
        b.append(label);
        if (n !== null)
            b.append(" ", el("span", "lf-n", String(n)));
        b.addEventListener("click", () => {
            change();
            rerender();
            document.querySelector(`#logfind .lf-chip[data-f="${CSS.escape(key)}"]`)?.focus();
        });
        row.appendChild(b);
    };
    const hidden = hiddenRows(rows, f);
    chip("all", hidden ? fillCopy("lgFindAllHidden", { n: hidden }) : copy.lgFindAll, null, f.bed === null && f.kind === null, () => { f.bed = null; f.kind = null; });
    const onBed = (name) => f.bed === name || rows.some((r) => (r.bed ?? WHOLE_GARDEN) === name);
    if (beds.length) {
        if (onBed(WHOLE_GARDEN))
            chip(`bed:${WHOLE_GARDEN}`, copy.lgWholeGarden, chipRows(rows, f, { bed: WHOLE_GARDEN }), f.bed === WHOLE_GARDEN, () => { f.bed = f.bed === WHOLE_GARDEN ? null : WHOLE_GARDEN; });
        for (const b of beds.filter((x) => !bedHasSections(x.name, beds) && onBed(x.name))) {
            chip(`bed:${b.name}`, b.name, chipRows(rows, f, { bed: b.name }), f.bed === b.name, () => { f.bed = f.bed === b.name ? null : b.name; });
        }
    }
    for (const k of DIARY_KINDS) {
        if (!rows.some((r) => r.fk === k) && f.kind !== k)
            continue;
        chip(`kind:${k}`, kindChip(k), chipRows(rows, f, { kind: k }), f.kind === k, () => { f.kind = f.kind === k ? null : k; });
    }
    host.appendChild(row);
    const edge = () => { row.classList.toggle("lf-edge", row.scrollLeft + row.clientWidth < row.scrollWidth - 1); };
    row.addEventListener("scroll", edge, { passive: true });
    if (typeof ResizeObserver !== "undefined")
        new ResizeObserver(edge).observe(row);
    edge();
}

const PLANT_VERB = /(^| )(planted|sowed|sown|seeded|transplanted|set out|put in|plante|plantamos|plantad[oa]s?|sembre|sembramos|sembrad[oa]s?|trasplante|trasplantamos|trasplantad[oa]s?|puse|pusimos)( |$)/;
const NOT_YET = /(^| )(tomorrow|manana|next (week|month|year|spring|summer|autumn|fall|winter)|la (semana|proxima)|el (mes|ano) que viene|going to|will|should|might|plan to|planning|hope to|voy a|vamos a|pienso|quiero|queremos|ojala)( |$)/;
const NO_WEATHER = /(^| )(no|not|sin|without|hasn t|hasnt|didn t|didnt|ni|libre de|free of) (hard |killing |heavy |fuerte )?(frosts?|heladas?|heat ?wave|ola de calor)|(^| )frost free( |$)/;
const PLAIN_LAST = new Set(["plant", "plants", "bush", "tree", "fruit", "greens", "herb", "flower", "vine", "root", "seed", "pepper"]);
const STOP = new Set(["a", "an", "the", "my", "our", "some", "of", "on", "at", "to", "in", "into", "out", "up", "and", "with", "this",
    "today", "yesterday", "last", "night", "morning", "days", "day", "ago", "en", "el", "la", "los", "las", "un", "una", "unos", "unas",
    "mi", "mis", "nuestro", "nuestra", "de", "del", "al", "y", "con", "hoy", "ayer", "anoche", "esta", "manana", "dias", "dia", "hace"]);
const SOW_VERB = /(^| )(sowed|sown|seeded|sembre|sembramos|sembrad[oa]s?)( |$)/;
function foldMap(line) {
    let folded = "";
    const at = [];
    let space = false;
    for (let i = 0; i < line.length; i++) {
        for (const c of line[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ")) {
            if (c === " ") {
                space = folded.length > 0;
                continue;
            }
            if (space) {
                folded += " ";
                at.push(i);
                space = false;
            }
            folded += c;
            at.push(i);
        }
    }
    return { folded, at };
}
const FROST_WORD = /(^| )(frosts?|frosted|frosty|heladas?|helo|hielo|escarcha)( |$)/;
const HARD_WORD = /(^| )(hard|killing|heavy|severe|fuerte|dura|intensa|negra)( |$)/;
const HEAT_WORD = /(^| )(heat ?wave|heat spell|hot spell|scorching|scorcher|ola de calor|calor extremo|canicula)( |$)/;
const BED_WORD = new Set(["bed", "beds", "bancal", "cama", "cantero", "arriate", "cajon", "parcela", "plot", "box"]);
const NUMBER_WORD = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    dozen: 12, fifteen: 15, twenty: 20, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
    ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, docena: 12, quince: 15, veinte: 20,
};
const WEEKDAYS = [["sunday", "domingo"], ["monday", "lunes"], ["tuesday", "martes"], ["wednesday", "miercoles"],
    ["thursday", "jueves"], ["friday", "viernes"], ["saturday", "sabado"]];
const MONTHS = [["january", "jan", "enero", "ene"], ["february", "feb", "febrero"], ["march", "mar", "marzo"],
    ["april", "apr", "abril", "abr"], ["may", "mayo"], ["june", "jun", "junio"], ["july", "jul", "julio"],
    ["august", "aug", "agosto", "ago"], ["september", "sep", "sept", "septiembre", "setiembre"],
    ["october", "oct", "octubre"], ["november", "nov", "noviembre"], ["december", "dec", "diciembre", "dic"]];
const isoOf = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const shift = (iso, days) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return isoOf(d); };
function readLineDate(folded, today) {
    const t = ` ${folded} `;
    if (/ (yesterday|ayer) /.test(t))
        return { date: shift(today, -1), saidDate: true };
    if (/ (last night|this morning|today|anoche|esta manana|hoy) /.test(t))
        return { date: today, saidDate: true };
    const ago = / (\d{1,2}) (days?|dias?) ago | hace (\d{1,2}) (dias?) /.exec(t);
    if (ago)
        return { date: shift(today, -Number(ago[1] ?? ago[3])), saidDate: true };
    const dow = WEEKDAYS.findIndex((names) => names.some((n) => t.includes(` ${n} `)));
    if (dow >= 0) {
        const d = new Date(`${today}T00:00:00Z`);
        const back = (d.getUTCDay() - dow + 7) % 7;
        return { date: shift(today, -back), saidDate: true };
    }
    const month = (w) => MONTHS.findIndex((names) => names.includes(w));
    let m = -1, day = 0;
    for (const dm of t.matchAll(/ (\d{1,2}) (?:de |of )?([a-z]+)(?= )/g))
        if (month(dm[2]) >= 0) {
            m = month(dm[2]);
            day = Number(dm[1]);
            break;
        }
    if (m < 0)
        for (const md of t.matchAll(/ ([a-z]+) (\d{1,2})(?= |$)/g))
            if (month(md[1]) >= 0) {
                m = month(md[1]);
                day = Number(md[2]);
                break;
            }
    if (m >= 0 && day >= 1 && day <= 31) {
        const year = Number(today.slice(0, 4));
        const mk = (y) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const candidate = mk(year) > today ? mk(year - 1) : mk(year);
        if (new Date(`${candidate}T00:00:00Z`).getUTCDate() === day)
            return { date: candidate, saidDate: true };
    }
    return { date: today, saidDate: false };
}
function nameForms(name) {
    const out = new Set();
    for (const alt of name.replace(/\([^)]*\)/g, " ").split("/")) {
        const f = foldText(alt).trim();
        if (!f)
            continue;
        out.add(f);
        const words = f.split(" ");
        const last = words[words.length - 1];
        const head = words.slice(0, -1).join(" ");
        const join = (w) => (head ? `${head} ${w}` : w);
        if (/[^s]$/.test(last)) {
            out.add(join(`${last}s`));
            out.add(join(`${last}es`));
        }
        if (/[^aeiou]y$/.test(last))
            out.add(join(`${last.slice(0, -1)}ies`));
    }
    return [...out];
}
function scanPhrases(tokens, index, maxLen) {
    const hits = [];
    for (let i = 0; i < tokens.length;) {
        let found = null;
        for (let len = Math.min(maxLen, tokens.length - i); len >= 1 && !found; len--) {
            const keys = index.get(tokens.slice(i, i + len).join(" "));
            if (keys)
                found = { at: i, len, keys };
        }
        if (found) {
            hits.push(found);
            i += found.len;
        }
        else
            i++;
    }
    return hits;
}
function readPlant(tokens, names) {
    const whole = new Map(), last = new Map();
    const add = (m, phrase, key) => { (m.get(phrase) ?? m.set(phrase, new Set()).get(phrase)).add(key); };
    for (const n of names) {
        const key = `${n.id}|${n.group ?? ""}`;
        for (const form of nameForms(n.name)) {
            add(whole, form, key);
            const words = form.split(" ");
            if (words.length > 1 && !PLAIN_LAST.has(words[words.length - 1]))
                add(last, words[words.length - 1], key);
        }
    }
    let hits = scanPhrases(tokens, whole, 4);
    if (!hits.length)
        hits = scanPhrases(tokens, last, 1);
    if (!hits.length)
        return null;
    const keys = new Set();
    for (const h of hits)
        for (const k of h.keys)
            keys.add(k);
    const species = [...new Set([...keys].map((k) => k.split("|")[0]))];
    const first = hits[0];
    const word = tokens.slice(first.at, first.at + first.len).join(" ");
    const spans = hits.flatMap((h) => Array.from({ length: h.len }, (_, i) => h.at + i));
    const sp = (h) => new Set([...h.keys].map((k) => k.split("|")[0]));
    const two = hits.some((h) => [...sp(h)].every((x) => !sp(first).has(x)));
    if (species.length !== 1)
        return { species: null, group: null, candidates: species, at: first.at, word, spans, two };
    const groups = [...new Set([...keys].map((k) => k.split("|")[1]).filter((g) => g))];
    return { species: species[0], group: groups.length === 1 ? groups[0] : null, candidates: species, at: first.at, word, spans, two };
}
function readBed(tokens, beds) {
    const folded = beds.map((b) => ({ name: b, f: foldText(b).trim() }));
    const index = new Map();
    for (const b of folded)
        if (b.f && !/^[a-z0-9]$/.test(b.f) && !/^\d+$/.test(b.f))
            index.set(b.f, new Set([b.name]));
    const hits = scanPhrases(tokens, index, 4);
    if (hits.length) {
        const names = new Set();
        for (const h of hits)
            for (const k of h.keys)
                names.add(k);
        return { bed: names.size === 1 ? [...names][0] : null, at: hits.flatMap((h) => Array.from({ length: h.len }, (_, i) => h.at + i)) };
    }
    for (let i = 0; i + 1 < tokens.length; i++) {
        if (!BED_WORD.has(tokens[i]))
            continue;
        const x = tokens[i + 1];
        const found = folded.filter((b) => b.f === x || b.f.split(" ").pop() === x || BED_WORD.has(b.f.split(" ")[0]) && b.f.split(" ").slice(1).join(" ") === x);
        return { bed: found.length === 1 ? found[0].name : null, at: [i, i + 1] };
    }
    return { bed: null, at: [] };
}
function readCount(tokens, plantAt, skip) {
    for (let i = plantAt - 1; i >= 0 && i >= plantAt - 2; i--) {
        if (skip.has(i))
            continue;
        const t = tokens[i];
        if (/^\d{1,3}$/.test(t))
            return Number(t);
        if (t in NUMBER_WORD)
            return NUMBER_WORD[t];
    }
    return null;
}
function readLogLine(line, ctx) {
    const { folded, at } = foldMap(line);
    if (!folded)
        return null;
    const tokens = folded.split(" ");
    const when = readLineDate(folded, ctx.today);
    const dated = !when.saidDate && ctx.fieldDate && ctx.fieldDate !== ctx.today ? { date: ctx.fieldDate, saidDate: false } : when;
    const padded = ` ${folded} `;
    if (NOT_YET.test(padded))
        return null;
    const own = (start, end) => line.slice(at[start - 1], at[end - 2] + 1);
    const extraPast = (used) => tokens.some((t, i) => !used.has(i) && !STOP.has(t) && !/^\d+$/.test(t)
        && !BED_WORD.has(t) && !(t in NUMBER_WORD) && !WEEKDAYS.some((w) => w.includes(t)) && !MONTHS.some((m) => m.includes(t)));
    const verbAt = tokens.findIndex((t, i) => PLANT_VERB.test(` ${t} `) || (i + 1 < tokens.length && PLANT_VERB.test(` ${t} ${tokens[i + 1]} `)));
    const plant = readPlant(tokens, ctx.names);
    if (verbAt >= 0) {
        if (!plant || plant.two || !ctx.beds.length)
            return null;
        const bed = readBed(tokens, ctx.beds);
        const count = readCount(tokens, plant.at, new Set(bed.at));
        const used = new Set([verbAt, verbAt + 1, ...plant.spans, ...bed.at]);
        if (count != null)
            for (let i = plant.at - 1; i >= 0 && i >= plant.at - 2; i--)
                used.add(i);
        return { kind: "planting", species: plant.species, group: plant.group, candidates: plant.candidates, bed: bed.bed,
            how: SOW_VERB.test(padded) ? "sown" : "transplanted", count, plantWord: plant.word, extra: extraPast(used), ...dated };
    }
    if (plant?.species && !NO_WEATHER.test(padded)) {
        for (const s of ctx.symptoms) {
            if (s.crops && !s.crops.includes(plant.species))
                continue;
            const phrase = [...s.says, ...(s.saysEs ?? [])].map((p) => foldText(p).trim()).find((p) => p && padded.includes(p));
            if (!phrase)
                continue;
            let start = padded.indexOf(phrase), end = start + phrase.length;
            while (start > 0 && padded[start - 1] !== " ")
                start--;
            while (end < padded.length && padded[end] !== " ")
                end++;
            const said = own(start, end);
            const mine = ctx.growing.filter((g) => g.species === plant.species);
            if (!mine.length)
                return null;
            const bedRead = readBed(tokens, ctx.beds);
            const inBed = bedRead.bed ? mine.filter((g) => g.bed === bedRead.bed) : mine;
            const pick = inBed.length === 1 ? inBed : mine.length === 1 ? mine : inBed.length ? inBed : mine;
            const used = new Set([...plant.spans, ...bedRead.at]);
            const before = padded.slice(1, start).split(" ").length - 1, n = padded.slice(start, end).trim().split(" ").length;
            for (let i = before; i < before + n; i++)
                used.add(i);
            return { kind: "problem", symptom: s.id, said, species: plant.species, plantings: pick.map((g) => g.index),
                planting: pick.length === 1 ? pick[0].index : null, extra: extraPast(used), ...dated };
        }
    }
    if (NO_WEATHER.test(padded))
        return null;
    if (FROST_WORD.test(padded))
        return { kind: "frost", severity: HARD_WORD.test(padded) ? "hard" : "light", ...dated };
    if (HEAT_WORD.test(padded))
        return { kind: "heat", ...dated };
    return null;
}
const strList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && !!x) : typeof v === "string" && v ? [v] : [];
function lineNames(bundle) {
    const out = [];
    for (const sp of [...bundle.species, ...app.userSpecies]) {
        const id = String(sp.id);
        for (const n of [...strList(sp.common), ...strList(sp.common_es)])
            out.push({ id, group: null, name: n });
        for (const g of Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : []) {
            const gid = typeof g.id === "string" ? g.id : null;
            for (const n of [...strList(g.common), ...strList(g.common_es)])
                out.push({ id, group: gid, name: n });
        }
    }
    return out;
}
function lineGrowing(season, beds) {
    if (!season)
        return [];
    return (season.plantings ?? []).map((p, index) => ({ p, index })).filter(({ p }) => !p.end_date).map(({ p, index }) => {
        const bed = beds.find((b) => regionKey$1(b.region) === regionKey$1(p.region)) ?? beds.find((b) => insideBed(p, b));
        return { index, species: p.species, group: p.cultivar_group ?? null, bed: bed?.name ?? null };
    });
}
const regionKey$1 = (r) => JSON.stringify(r);
function insideBed(p, b) {
    const r = p.region, br = b.region;
    if (r.shape !== "rect" || br.shape !== "rect")
        return false;
    return (r.x ?? 0) >= (br.x ?? 0) && (r.y ?? 0) >= (br.y ?? 0)
        && (r.x ?? 0) + (r.w ?? 0) <= (br.x ?? 0) + (br.w ?? 0) && (r.y ?? 0) + (r.h ?? 0) <= (br.y ?? 0) + (br.h ?? 0);
}
function lineContext(bundle, today, season, beds, fieldDate) {
    return {
        today, names: lineNames(bundle), fieldDate,
        beds: beds.filter((b) => !bedHasSections(b.name, beds)).map((b) => b.name),
        symptoms: symptoms(bundle).map((s) => ({ id: s.id, says: s.says, saysEs: s.saysEs,
            crops: s.crops ? bundle.species.filter((sp) => s.crops(sp)).map((sp) => String(sp.id)) : null })),
        growing: lineGrowing(season, beds),
    };
}
const opt = (value, label) => { const o = document.createElement("option"); o.value = value; o.textContent = label; return o; };
const select = (aria, options, value, ask) => {
    const s = document.createElement("select");
    s.setAttribute("aria-label", aria);
    if (ask)
        s.appendChild(opt("", ask));
    for (const [v, l] of options)
        s.appendChild(opt(v, l));
    if (value != null && [...s.options].some((o) => o.value === value))
        s.value = value;
    return s;
};
function drawLineCard(ctx) {
    const { bundle, db, plot, season, beds, today, line, reading, host } = ctx;
    ctx.ensureCss();
    host.replaceChildren();
    host.hidden = false;
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", copy.llCardAria);
    for (const id of ["frosthint", "wronghint"]) {
        const h = document.getElementById(id);
        if (h)
            h.hidden = true;
    }
    const head = el("p", "ll-h");
    const fields = el("div", "ll-fields");
    const why = el("p", "ll-why");
    why.hidden = true;
    const err = el("p", "ll-err");
    err.setAttribute("role", "alert");
    err.hidden = true;
    const fail = (text, at) => { err.textContent = text; err.hidden = false; at?.focus(); };
    const ask = (text) => { why.textContent = text; why.hidden = false; };
    const dateInput = (value, aria) => {
        const d = document.createElement("input");
        d.type = "date";
        d.value = value;
        d.max = today;
        d.setAttribute("aria-label", aria);
        return d;
    };
    let save;
    if (reading.kind === "planting") {
        head.textContent = copy.llReadPlanting;
        const plantOptions = [];
        for (const sp of [...bundle.species, ...app.userSpecies]) {
            const id = String(sp.id);
            plantOptions.push([`${id}|`, commonName(bundle, id)]);
            for (const g of Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : [])
                if (typeof g.id === "string")
                    plantOptions.push([`${id}|${g.id}`, plantingLabel(bundle, id, g.id)]);
        }
        plantOptions.sort((a, b) => a[1].localeCompare(b[1]));
        const plant = select(copy.llPlantAria, plantOptions, reading.species ? `${reading.species}|${reading.group ?? ""}` : null, reading.species ? null : copy.llWhichPlantOpt);
        const bedNames = beds.filter((b) => !bedHasSections(b.name, beds)).map((b) => b.name);
        const bed = select(copy.llBedAria, bedNames.map((n) => [n, n]), reading.bed, reading.bed ? null : copy.llWhichBedOpt);
        const how = select(copy.llHowAria, [["sown", copy.lgSowedSeeds], ["transplanted", copy.lgSetOutPlants]], reading.how, null);
        const day = dateInput(reading.date, copy.llDateAria);
        fields.append(plant, bed, how, day);
        if (!reading.species)
            ask(copy.llWhichPlant);
        else if (!reading.bed)
            ask(copy.llWhichBed);
        const keepWords = reading.count != null || reading.extra;
        if (keepWords)
            fields.appendChild(el("p", "ll-count", reading.count != null ? fillCopy("llCountKept", { n: reading.count }) : copy.llWordsKept));
        save = async () => {
            if (!plant.value) {
                fail(copy.lgChoosePlantFirst, plant);
                return;
            }
            if (!bed.value) {
                fail(copy.llPickBedFirst, bed);
                return;
            }
            if (!season) {
                ctx.noSeason();
                return;
            }
            const [sid, gid] = plant.value.split("|");
            const b = beds.find((x) => x.name === bed.value);
            if (!b) {
                fail(copy.llPickBedFirst, bed);
                return;
            }
            const d = day.value || today;
            if (isFutureDate(d, today)) {
                fail(copy.lgErrFutureDate, day);
                return;
            }
            const year = seasonYearOf(d, ctx.lat);
            if (year !== season.id) {
                fail(fillCopy("lgPlantingOtherSeason", { year, season: season.id }), day);
                return;
            }
            const record = { species: sid, region: parseRegion(b.region), ...(how.value === "sown" ? { sown: d } : { transplanted: d }) };
            if (gid)
                record.cultivar_group = gid;
            const after = await addPlanting(db, plot, season.id, record);
            await setBedPlanted(db, plot, b.name, true);
            if (keepWords)
                await addPlantingNote(db, plot, season.id, (after.plantings?.length ?? 1) - 1, { date: d, text: line.trim() });
            ctx.done();
            ctx.sang(fillCopy("lgPlantingLogged", { name: commonName(bundle, sid), bed: b.name }));
            await ctx.refresh();
        };
    }
    else if (reading.kind === "problem") {
        head.textContent = fillCopy("llReadProblem", { detail: reading.said });
        const growing = lineGrowing(season, beds).filter((g) => reading.plantings.includes(g.index));
        const which = select(copy.llPlantAria, growing.map((g) => [String(g.index), g.bed ? fillCopy("llInBed", { name: plantingLabel(bundle, g.species, g.group), bed: g.bed }) : plantingLabel(bundle, g.species, g.group)]), reading.planting != null ? String(reading.planting) : null, reading.planting != null ? null : copy.llWhichOneOpt);
        const sev = select(copy.llProblemSeverityAria, FAILURE_SEVERITIES.map((v) => [v, failureSeverityLabel(v)]), "light", null);
        const day = dateInput(reading.date, copy.llDateAria);
        fields.append(which, sev, day);
        if (reading.extra)
            fields.appendChild(el("p", "ll-count", copy.llWordsKeptPlant));
        if (reading.planting == null)
            ask(copy.llWhichPlanting);
        save = async () => {
            if (!which.value) {
                fail(copy.llPickPlantingFirst, which);
                return;
            }
            if (!season) {
                ctx.noSeason();
                return;
            }
            const d = day.value || today;
            if (isFutureDate(d, today)) {
                fail(copy.lgErrFutureDate, day);
                return;
            }
            const index = Number(which.value);
            const p = season.plantings?.[index];
            if (!p) {
                fail(copy.llPickPlantingFirst, which);
                return;
            }
            await addFailure(db, plot, season.id, index, { date: d, mode: reading.said, severity: sev.value });
            if (reading.extra)
                await addPlantingNote(db, plot, season.id, index, { date: d, text: line.trim() });
            ctx.done();
            ctx.said(fillCopy("lgNotedOn", { mode: reading.said, name: plantingLabel(bundle, p.species, p.cultivar_group ?? null) }));
            await ctx.refresh();
        };
    }
    else {
        const frost = reading.kind === "frost";
        head.textContent = frost ? copy.llReadFrost : copy.llReadHeat;
        const sev = frost ? select(copy.llSeverityAria, OBSERVATION_SEVERITIES.map((v) => [v, frostSeverityLabel(v)]), reading.severity, null) : null;
        const day = dateInput(reading.date, copy.llDateAria);
        if (sev)
            fields.appendChild(sev);
        fields.appendChild(day);
        save = async () => {
            const d = day.value || today;
            if (isFutureDate(d, today)) {
                fail(copy.lgErrFutureDate, day);
                return;
            }
            ctx.fileWeather(frost ? "frost" : "heat", sev ? sev.value : null, d);
        };
    }
    const acts = el("div", "ll-acts");
    const saveBtn = el("button", "btn btn-primary ll-save", copy.lgSave);
    saveBtn.type = "button";
    const keep = el("button", "linky ll-keep", copy.llKeepNote);
    keep.type = "button";
    const cancel = el("button", "linky ll-cancel", copy.lgCancel);
    cancel.type = "button";
    saveBtn.addEventListener("click", () => {
        saveBtn.disabled = true;
        save().catch((e) => fail(String(e instanceof Error ? e.message : e), saveBtn)).finally(() => { saveBtn.disabled = false; });
    });
    keep.addEventListener("click", () => { hideLineCard(host); ctx.keepNote(); });
    cancel.addEventListener("click", () => { hideLineCard(host); document.getElementById("obsnote")?.focus(); });
    acts.append(saveBtn, keep, cancel);
    const sub = el("p", "ll-sub", copy.llCheck);
    const device = el("p", "ll-device", copy.llOnDevice);
    host.append(head, sub, fields, why, err, acts, device);
    head.tabIndex = -1;
    head.focus();
}
function hideLineCard(host) {
    host.hidden = true;
    host.replaceChildren();
    document.getElementById("obsnote")?.dispatchEvent(new Event("input"));
}

const fmtOffset = (v) => (v > 0 ? `+${v}` : `${v}`);
function renderBoundary(p, label, cal, minSeasons) {
    if (!cal.per_season.length) {
        p(fillCopy("lgFrostNoneYet", { label }), "provenance");
        return;
    }
    p(fillCopy("lgFrostLabel", { label }), "provenance");
    for (const pt of cal.per_season) {
        p(cal.own || pt.model == null || pt.offset_days == null
            ? fillCopy("lgFrostPointOwn", { season: pt.season, observed: fmtMonthDay(pt.observed) })
            : fillCopy(Math.abs(pt.offset_days) === 1 ? "lgFrostPointOne" : "lgFrostPoint", { season: pt.season, observed: fmtMonthDay(pt.observed), model: fmtMonthDay(pt.model), offset: fmtOffset(pt.offset_days) }), "provenance");
    }
    if (cal.calibrated && cal.own) {
        p(fillCopy("lgCalibratedOwn", { n: cal.n, date: fmtMonthDay(String(cal.calibrated_date)) }), "calibrated");
    }
    else if (cal.calibrated) {
        const m = cal.median_offset_days;
        const model = cal.per_season[0].model;
        const [lo, hi] = cal.offset_range ?? [m, m];
        const dir = m > 0 ? fillCopy("lgDaysLater", { n: Math.abs(m) }) : m < 0 ? fillCopy("lgDaysEarlier", { n: Math.abs(m) }) : copy.lgOnModel;
        p(fillCopy("lgCalibrated", { n: cal.n, median: fmtOffset(m), lo: fmtOffset(lo), hi: fmtOffset(hi), dir, date: fmtMonthDay(String(cal.calibrated_date)), model: fmtMonthDay(String(model)) }), "calibrated");
    }
    else {
        p(fillCopy("lgFrostToGo", { n: cal.n, min: minSeasons, left: minSeasons - cal.n }));
    }
}
function renderFrost(site, seasons, synthetic, lat = null) {
    const panel = $$1("frost");
    panel.innerHTML = "";
    const hint = document.getElementById("weatherhint");
    const quiet = !synthetic && !frostAsked(site, lat) && (site != null || lat != null)
        && !seasons.some((s) => (s.observations ?? []).some((o) => o.event === "frost"));
    panel.hidden = quiet;
    if (hint)
        hint.hidden = quiet;
    if (quiet)
        return;
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
    };
    const head = document.createElement("strong");
    head.textContent = !site && lat != null ? copy.lgFrostHeadOwn : copy.lgFrostHead;
    panel.appendChild(head);
    if (synthetic) {
        p(copy.lgSynthetic, "synthetic");
    }
    if (!site && lat == null) {
        p(copy.lgResolveSite);
        return;
    }
    const cal = frostCalibration(seasons, site, lat);
    if (!cal.spring.per_season.length && !cal.fall.per_season.length) {
        p(fillCopy(cal.spring.own ? "lgNoFrostYetOwn" : "lgNoFrostYet", { n: cal.min_seasons }));
        return;
    }
    renderBoundary(p, copy.lgLastSpringFrost, cal.spring, cal.min_seasons);
    renderBoundary(p, copy.lgFirstFallFreeze, cal.fall, cal.min_seasons);
}
const DEMO_SEASONS = [
    { year: 2021, spring: 7, fall: -7 },
    { year: 2022, spring: 8, fall: -5 },
    { year: 2023, spring: 5, fall: -9 },
    { year: 2024, spring: 9, fall: -6 },
];
function makeSyntheticSeasons(site) {
    const springP50 = (site.last_frost_32f ?? {}).p50;
    const fallP50 = site.first_freeze_32f_p50;
    return DEMO_SEASONS.map((o) => {
        const observations = [];
        if (springP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(springP50, o.spring)}`, event: "frost", severity: "hard" });
        if (fallP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(fallP50, o.fall)}`, event: "frost", severity: "hard" });
        return { id: o.year, plot: "demo_synthetic", observations };
    });
}

function renderSolar(bundle, site) {
    const panel = $$1("solar");
    panel.innerHTML = "";
    const moreSum = document.getElementById("foldmoresum");
    const setMore = (warnings) => {
        if (moreSum)
            moreSum.textContent = warnings ? pluralCopy("lgMoreWarnings", warnings) : copy.lgMore;
    };
    setMore(0);
    let host = panel;
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        host.appendChild(el);
        return el;
    };
    const season = openSeason() ?? undefined;
    const live = (season?.plantings ?? []).filter((pl) => !pl.end_cause);
    if (live.length < 2)
        return;
    if (site.lat == null) {
        p(copy.lgLayoutNeedsLat, "hint");
        return;
    }
    const plantedFrom = (Array.isArray(season?.planted_from) ? season.planted_from : []);
    const teamOf = (pl) => {
        const bed = app.logSnapshot.beds.find((b) => plantingOnBed(pl.region, b.region));
        const team = bed ? plantedFrom.find((r) => r.area === bed.name)?.guild : undefined;
        return team && guildsPlacing(pl.species, bundle).includes(team) ? team : null;
    };
    const layout = live.map((pl) => {
        const c = regionCentroid(pl.region);
        return { species: pl.species, group: pl.cultivar_group ?? null, x: c[0], y: c[1], team: teamOf(pl) };
    });
    const inner = new Set();
    const fired = geometryRules(layout, site, bundle, inner);
    p(fillCopy("lgLayoutHead", { season: season.id, n: live.length }), "provenance");
    for (const id of inner) {
        const g = bundle.guilds.find((x) => x.id === id);
        if (g)
            p(fillCopy("lgTeamShade", { team: displayName(g) }), "shelter");
    }
    if (!fired.length) {
        p(copy.lgNoLayoutConflicts);
        return;
    }
    if (fired.every((f) => f.rule === "R-156"))
        p(copy.lgNoLayoutConflicts);
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const nameFor = new Map(live.map((pl) => [pl.species, commonName(bundle, pl.species)]));
    const linked = (key) => !app.userSpecies.some((u) => u.id === key);
    const seen = new Map();
    const remedies = new Map();
    for (const f of fired) {
        const prev = seen.get(f.why);
        if (prev)
            prev.n++;
        else
            seen.set(f.why, { n: 1, rule: f.rule });
        const remedy = ruleById.get(f.rule)?.remedy;
        if (remedy)
            remedies.set(stripRuleCitations(corpusText(f.rule, "remedy", remedy)), corpusWantsEs() && !corpusEs(f.rule, "remedy"));
    }
    setMore([...seen.values()].filter((i) => i.rule !== "R-156").length);
    let i = 0;
    for (const [why, info] of seen) {
        if (i++ === LAYOUT_SHOW && seen.size > LAYOUT_SHOW + 2) {
            const more = document.createElement("details");
            more.className = "pc-more solarmore";
            const sum = document.createElement("summary");
            const m = document.createElement("span");
            m.className = "fm-more";
            m.textContent = fillCopy("lgShowMoreWarnings", { n: seen.size - LAYOUT_SHOW });
            const l = document.createElement("span");
            l.className = "fm-less";
            l.textContent = copy.pcRulesFewer;
            sum.append(m, l);
            more.appendChild(sum);
            panel.appendChild(more);
            host = more;
        }
        const { text, marks } = findingLine(why, info.n, site.lat, nameFor, linked);
        const line = p("", info.rule === "R-156" ? "shelter" : "heat");
        linkNamesIn(line, info.n === 1 ? text : `${info.n} × ${text}`, marks);
        mark(line, { kind: "rule", id: info.rule });
    }
    host = panel;
    for (const [r, en] of remedies) {
        const l = p(r, "hint");
        if (en)
            l.lang = "en";
    }
}
const LAYOUT_SHOW = 5;
const TALLER = /^(\S+) \(([\d.]+) cm\) sits equatorward of shorter (\S+) \(([\d.]+) cm\)$/;
const SHADOW = /^(\S+) sits in the computed noon shadow of ([^\s,]+)(, the summer shade it wants)?$/;
function findingLine(why, n, lat, nameFor, linked) {
    const marks = [];
    const name = (key, lead) => {
        const nm = nameFor.get(key) ?? key, label = lead && n === 1 ? nm : nm.toLowerCase();
        if (linked(key) && nameFor.has(key))
            marks.push({ label, species: key });
        return label;
    };
    const t = TALLER.exec(why), s = SHADOW.exec(why);
    if (t)
        return { text: fillCopy(lat < 0 ? "lgTallNorthOf" : "lgTallSouthOf", { tall: name(t[1], true), th: t[2], short: name(t[3], false), sh: t[4] }), marks };
    if (s)
        return { text: fillCopy(s[3] ? "lgInWantedShade" : "lgInShadow", { plant: name(s[1], true), caster: name(s[2], false) }), marks };
    let text = stripRuleCitations(plainClaim(why, lat));
    for (const [key, nm] of nameFor) {
        if (!text.includes(key))
            continue;
        text = text.split(key).join(nm);
        if (linked(key))
            marks.push({ label: nm, species: key });
    }
    return { text, marks };
}

const EXACT = {
    "nothing recorded for this ground yet: nothing here is adjusted for it": "swNothingYet",
    "what this bed is filled with is not recorded": "swFillUnknown",
    "a container is filled with a bought or mixed medium, so nothing here is inferred from your native ground": "swContainer",
    "a raised bed sits ON native ground: its fill is recorded, but drainage still depends on what is underneath": "swRaised",
    "texture unknown: watering and root-spread guidance stays generic": "swTextureUnknown",
    "texture declared, not measured: a ribbon test would firm it up": "swTextureDeclared",
    "drainage not recorded: waterlogging risk is not assessed": "swDrainageUnknown",
    "slow drainage is recorded but not gated: the waterlogging rule fires on water that STANDS after rain, which is what the sources measure": "swDrainageSlow",
    "no soil test: pH-sensitive plants are not gated, and no fertilizer amount is offered (a soil test is the only honest source for one)": "swNoTest",
    "your lab report is recorded without a pH reading: pH-sensitive plants are not gated until a pH is recorded": "swReportNoPh",
    "only the LOW side is gated: no source read publishes a per-crop maximum for a vegetable, so a pH above a plant's range is not flagged": "swLowOnly",
    "this pH was measured in calcium chloride: it is recorded, and no plant is checked against it, because every pH range here is in water pH": "swPhCacl2",
    "this pH was measured in a salt solution: it is recorded, and no plant is checked against it, because every pH range here is in water pH": "swPhSalt",
    "which solution this pH was measured in is not recorded: no plant is checked against it until it is": "swPhUnsure",
    "still no fertilizer amount and no lime rate: a rate is the lab's to give, from a lime requirement test of this soil, and no lab report is recorded yet": "swNoRate",
    "which lab produced this report is not recorded: a reading is only as good as its source, and the report is what we repeat back": "swWhichLab",
    "a lime or sulfur rate PRINTED ON your report is a real one for this soil, whichever lime requirement method your lab used - use that number, not one from us and not one from the internet (R-101). If it prints none, ask your lab for its lime or sulfur recommendation": "swReportRate",
    "nutrient levels are repeated as your lab worded them and are never converted into an amount - that arithmetic is the lab's, not ours": "swNutrients",
    "nothing recorded": "swRung0",
    "described": "swRung1",
    "field tested": "swRung2",
    "pH measured": "swRung3",
    "lab report": "swRung4",
    "about two minutes": "swCost1",
    "texture guidance, drainage warnings, and the waterlogging rule": "swBuys1",
    "twenty minutes and nothing": "swCost2",
    "the same, graded higher - a measurement instead of a guess": "swBuys2",
    "a home kit": "swCost3",
    "the pH rule, so plants below their floor are named": "swBuys3",
    "a lab test and about two weeks": "swCost4",
    "a few minutes copying in the rest of your lab report": "swCost4Lab",
    "your lab's own recommendation, repeated faithfully": "swBuys4",
};
const KIT = /^a home kit resolves about \+\/-([\d.]+) pH: this reading gates plants but a lab test is what a lime rate needs$/;
function soilWord(s) {
    const k = EXACT[s];
    if (k)
        return copy[k];
    const m = KIT.exec(s);
    if (m)
        return fillCopy("swKit", { n: m[1] });
    return s;
}
const NUM = String.raw `(-?\d+(?:\.\d+)?)`;
const KIT_HEDGE = new RegExp(String.raw ` \(a home kit resolves about \+/-${NUM}, so this is marginal\)$`);
const PH_LOW = new RegExp(`^soil pH ${NUM} is ${NUM} below this plant's floor of ${NUM}$`);
const PH_HIGH = new RegExp(`^soil pH ${NUM} is ${NUM} above this plant's ceiling of ${NUM}, and it needs acid soil: ` +
    `above its range iron stops being available and the leaves yellow while the veins stay green$`);
const LIMED = new RegExp(`^this ground was limed(?: on (\\S+?))?(?:, and the pH ${NUM} read on or after that day is above ` +
    `${NUM})?: common scab worsens as soil pH rises, and this plant wants it at or below about ${NUM}$`);
const CLUB = new RegExp(`^this ground carried brassicas within the last ${NUM} years and its pH ${NUM} sits ${NUM} ` +
    `below ${NUM}: clubroot's resting spores germinate in acid soil, and raising the pH is the lever every clubroot guide we read names$`);
function soilWhy(s) {
    const k = KIT_HEDGE.exec(s);
    const body = k ? s.slice(0, k.index) : s;
    const d = (x) => fmtDec(Number(x), 2);
    const hedge = k ? fillCopy("pnPhWhyKit", { n: d(k[1]) }) : "";
    let m = PH_LOW.exec(body);
    if (m)
        return fillCopy("pnPhWhyLow", { ph: d(m[1]), short: d(m[2]), floor: d(m[3]) }) + hedge;
    m = PH_HIGH.exec(body);
    if (m)
        return fillCopy("pnPhWhyHigh", { ph: d(m[1]), over: d(m[2]), ceiling: d(m[3]) }) + hedge;
    m = LIMED.exec(s);
    if (m) {
        return fillCopy("pnLimeWhy", {
            when: m[1] ? fillCopy("pnLimeWhyOn", { date: fmtMonthDayYear(m[1]) }) : "",
            tail: m[2] ? fillCopy("pnLimeWhyPh", { ph: d(m[2]), max: d(m[3]) }) : "",
            max: d(m[4]),
        });
    }
    m = CLUB.exec(s);
    if (m)
        return fillCopy("pnClubWhy", { years: m[1], ph: d(m[2]), short: d(m[3]), min: d(m[4]) });
    return s;
}

const ladder = (...a) => {
    const l = ladder$1(...a);
    return { ...l, label: soilWord(l.label),
        next: l.next && { label: soilWord(l.next.label), costs: soilWord(l.next.costs), buys: soilWord(l.next.buys) } };
};
const $ = (id) => document.getElementById(id);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function titleish(v) {
    const t = v.replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
}
function fillNodes(parent, template, nodes) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        if (k && k in nodes)
            parent.appendChild(nodes[k]);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
const day = (d) => (typeof d === "string" && d ? fmtMonthDayYear(d) : "");
function unknownFirst(values) {
    return [...values].sort((a, b) => (a === "unknown" ? -1 : b === "unknown" ? 1 : 0));
}
const TEXTURE_LABEL = {
    sand: copy.pnTextureSand,
    sandy_loam: copy.pnTextureSandyLoam,
    loam: copy.pnTextureLoam,
    clay_loam: copy.pnTextureClayLoam,
    clay: copy.pnTextureClay,
    unknown: copy.pnDontKnowYet,
};
const DRAINAGE_LABEL = {
    fast: copy.pnDrainFast,
    free: copy.pnDrainFree,
    slow: copy.pnDrainSlow,
    waterlogged: copy.pnDrainWaterlogged,
    unknown: copy.pnDontKnowYet,
};
const SOURCE_LABEL = {
    declared: copy.pnSourceDeclared,
    field_test: copy.pnSourceFieldTest,
    kit: copy.pnSourceKit,
    lab: copy.pnSourceLab,
};
const NUTRIENT_NAME = {
    p: copy.pnNutrientP, k: copy.pnNutrientK, ca: copy.pnNutrientCa, mg: copy.pnNutrientMg, s: copy.pnNutrientS,
};
const LEVEL_LABEL = {
    very_low: copy.pnLevelVeryLow, low: copy.pnLevelLow, medium: copy.pnLevelMedium,
    optimum: copy.pnLevelOptimum, high: copy.pnLevelHigh, very_high: copy.pnLevelVeryHigh,
};
const OTHER_SCALE = "other_scale";
const MEDIUM_LABEL = {
    purchased_mix: copy.pnMediumPurchased,
    compost_blend: copy.pnMediumCompost,
    native_soil: copy.pnMediumNative,
    unknown: copy.pnDontKnowYet,
};
const SOIL_NAME = {
    sand: copy.pnSoilNameSand, sandy_loam: copy.pnSoilNameSandyLoam, loam: copy.pnSoilNameLoam,
    clay_loam: copy.pnSoilNameClayLoam, clay: copy.pnSoilNameClay,
    purchased_mix: copy.pnSoilNamePurchased, compost_blend: copy.pnSoilNameCompost, native_soil: copy.pnSoilNameNative,
};
const DRAINS = {
    fast: copy.pnDrainsFast, free: copy.pnDrainsFree, slow: copy.pnDrainsSlow, waterlogged: copy.pnDrainsWaterlogged,
};
const PH_METHOD_LABEL = {
    unknown: copy.pnPhMethodUnsure,
    water: copy.pnPhMethodWater,
    calcium_chloride: copy.pnPhMethodCacl2,
    other_salt: copy.pnPhMethodOther,
};
const phWord = (ph) => (typeof ph === "number" ? fmtDec(ph, 2) : String(ph));
function labPhWords(ph, method) {
    const v = { ph: phWord(ph) };
    return method === "water" ? fillCopy("pnStatePhWater", v)
        : method === "calcium_chloride" ? fillCopy("pnStatePhCacl2", v)
            : method === "other_salt" ? fillCopy("pnStatePhOtherSalt", v)
                : fillCopy("pnStatePhUnsure", v);
}
function readingWords(ph, method, source) {
    return source === "lab" ? labPhWords(ph, method) : fillCopy("pnStatePhFrom", { ph: phWord(ph), how: SOURCE_LABEL[String(source)] ?? "" });
}
const regionKey = (v) => JSON.stringify(v ?? null, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x);
function phRecord(observations, plot, region, r) {
    const want = regionKey(region);
    const hits = observations.filter((o) => !!o && typeof o === "object" && !Array.isArray(o))
        .filter((o) => o.plot === plot && regionKey(o.region) === want && o.ph === r.ph && o.date === r.date
        && o.source === r.source && (o.ph_method ?? null) === (r.method ?? null));
    return hits.length ? hits[hits.length - 1] : null;
}
async function soilChanged() {
    if (app.logRefresh)
        return app.logRefresh();
    await app.soilRefresh?.();
    if (lastArgs) {
        const [p, , la, lo, be, pl, gh, bu] = lastArgs;
        renderSoil(p, app.soilObservations, la, lo, be, pl, gh, bu);
    }
}
const READING_ONLY = new Set(["plot", "date", "region", "source", "ph", "ph_method", "notes"]);
function withoutPh(rec) {
    if (Object.keys(rec).every((k) => READING_ONLY.has(k)))
        return null;
    const rest = { ...rec };
    delete rest.ph;
    delete rest.ph_method;
    if (!REPORT_FIELDS.some((k) => k in rest))
        rest.source = "declared";
    return rest;
}
async function removeReading(rec, words) {
    const fail = (e) => toast(String(e instanceof Error ? e.message : e));
    const rest = withoutPh(rec);
    try {
        const db = await openLog();
        await deleteSoilObservation(db, rec);
        if (rest)
            await putSoilObservation(db, rest);
        await soilChanged();
    }
    catch (e) {
        fail(e);
        return;
    }
    toast(fillCopy("pnPhRemoved", { reading: words, date: day(rec.date) }), 9000, {
        label: copy.lgUndo,
        go: () => {
            void (async () => {
                const db = await openLog();
                if (rest)
                    await deleteSoilObservation(db, rest);
                await putSoilObservation(db, rec);
                await soilChanged();
            })().then(() => toast(copy.lgUndone), fail);
        },
    });
}
function phCell(ph, src, method) {
    if (typeof ph !== "number")
        return "-";
    if (src !== "lab" || method === "water")
        return fmtDec(ph, 2);
    const v = { ph: fmtDec(ph, 2) };
    return method === "calcium_chloride" ? fillCopy("pnPhCellCacl2", v)
        : method === "other_salt" ? fillCopy("pnPhCellSalt", v) : fillCopy("pnPhCellUnsure", v);
}
const AMENDMENT_LABEL = {
    lime: copy.pnAmendLime, sulfur: copy.pnAmendSulfur, compost: copy.pnAmendCompost,
    manure: copy.pnAmendManure, mulch: copy.pnAmendMulch, other: copy.pnAmendOther,
};
let hooks = null;
function setSoilHooks(h) { hooks = h; }
function groundRows(plot, observations, beds) {
    const rows = [
        { name: copy.pnWholeGarden, region: null, structure: null, i: 0, obs: null, date: null, src: {}, also: null,
            l: ladder(null, null) },
        ...beds.map((b, n) => ({
            name: b.name, region: b.region ?? null, structure: b.structure ?? null,
            i: n + 1, obs: null, date: null, src: {}, also: null, l: ladder(null, null),
        })),
    ].map((g) => {
        const r = resolveGround(observations, plot, g.region ?? null);
        const o = Object.keys(r.fields).length ? r.fields : null;
        return { ...g, obs: o, date: r.date, src: r.src, also: r.ph_also, l: ladder(o, g.structure, r.src) };
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
let formBase = null;
const controls = (root) => [...root.querySelectorAll("input[id], select[id], textarea[id]")];
const isBox = (el) => el instanceof HTMLInputElement && el.type === "checkbox";
const formValues = (root) => Object.fromEntries(controls(root).map((el) => [el.id, isBox(el) ? el.checked : el.value]));
const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let entryIntent = null;
function openSoilEntry(kind) {
    entryIntent = kind;
    cardOpen = true;
    if (lastArgs)
        renderSoil(...lastArgs);
}
function reselectSoilGround(name) {
    selectedBed = name;
    cardOpen = true;
    if (lastArgs)
        renderSoil(...lastArgs);
}
function renderSoil(plot, observations, lat = null, lon = null, beds = [], plantings = [], groundHistory = null, bundle = null) {
    const panel = $("soil");
    if (!panel)
        return;
    lastArgs = [plot, observations, lat, lon, beds, plantings, groundHistory, bundle];
    const oldForm = panel.querySelector(".soilform");
    const oldErr = panel.querySelector("#soilpherr");
    const draftErr = oldErr && !oldErr.hidden ? oldErr.textContent ?? "" : "";
    const draftValues = oldForm ? formValues(oldForm) : null;
    const draft = formBase && draftValues && (draftErr || !sameValues(draftValues, formBase.values))
        ? { ground: formBase.ground, base: formBase.values, values: draftValues, err: draftErr } : null;
    const active = document.activeElement;
    const refocus = active instanceof HTMLElement && active.id && panel.contains(active) ? active.id : "";
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
    head.textContent = asks === "medium" ? copy.pnSoilHeadMedium : copy.pnSoilHead;
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
        sel.setAttribute("aria-label", copy.pnWhichGround);
        const all = document.createElement("option");
        all.value = "";
        all.textContent = copy.pnWholeGarden;
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
            renderSoil(plot, observations, lat, lon, beds, plantings, groundHistory, bundle);
        });
        pick.appendChild(sel);
        card.appendChild(pick);
    }
    const state = document.createElement("p");
    state.className = "soilstate";
    const parts = [];
    if (current) {
        const field = asks === "medium" ? "medium" : "texture";
        const fv = current[field];
        const soil = typeof fv === "string" && fv !== "unknown" ? SOIL_NAME[fv] ?? null : null;
        const soilHow = SOURCE_LABEL[String(ground.src[field] ?? "")] ?? copy.pnSourceDeclared;
        const soilDay = day(ground.as_of[field]);
        const dv = current.drainage;
        const drains = typeof dv === "string" && dv !== "unknown" ? DRAINS[dv] ?? null : null;
        const drainHow = SOURCE_LABEL[String(ground.src.drainage ?? "")] ?? copy.pnSourceDeclared;
        const drainDay = day(ground.as_of.drainage);
        if (soil && drains && soilHow === drainHow && soilDay === drainDay) {
            parts.push(fillCopy("pnStateSoilDrains", { soil, drains, how: soilHow, date: soilDay }));
        }
        else {
            if (soil)
                parts.push(fillCopy("pnStateSoil", { soil, how: soilHow, date: soilDay }));
            if (drains)
                parts.push(fillCopy("pnStateDrains", { drains, how: drainHow, date: drainDay }));
        }
        if (typeof current.ph === "number") {
            parts.push(ground.src.ph === "lab"
                ? fillCopy("pnStatePhReport", { reading: labPhWords(current.ph, current.ph_method), date: day(ground.as_of.ph) })
                : fillCopy("pnStatePhKit", { ph: fmtDec(current.ph, 2), date: day(ground.as_of.ph) }));
        }
        else if (caps.report) {
            const kept = REPORT_FIELDS.find((k) => ground.as_of[k] !== undefined);
            parts.push(fillCopy("pnStateReportOnly", { date: day(kept ? ground.as_of[kept] : ground.date) }));
        }
    }
    state.textContent = parts.length ? parts.join(" ")
        : bed ? fillCopy("pnNothingForBed", { bed: bed.name }) : copy.pnNothingYet;
    card.appendChild(state);
    const also = ground.ph_also;
    if (also && typeof also.ph === "number") {
        const p = document.createElement("p");
        p.className = "soilphalso";
        p.id = "soilphalso";
        p.textContent = fillCopy(ground.src.ph === "kit" ? "pnPhAlsoKit" : "pnPhAlsoWater", { reading: labPhWords(also.ph, also.ph_method), date: day(also.date) });
        card.appendChild(p);
    }
    const shown = [];
    if (current && typeof current.ph === "number") {
        shown.push({ ph: current.ph, method: current.ph_method, date: ground.as_of.ph, source: ground.src.ph });
    }
    if (also && typeof also.ph === "number")
        shown.push({ ph: also.ph, method: also.ph_method, date: also.date, source: also.source });
    const removable = shown.map((r) => ({ r, rec: phRecord(observations, plot, bed ? bed.region ?? null : null, r) }));
    if (removable.some((x) => x.rec)) {
        const row = document.createElement("p");
        row.className = "soilphremove";
        row.id = "soilphremove";
        for (const { r, rec } of removable) {
            if (!rec)
                continue;
            const words = readingWords(r.ph, r.method, r.source);
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn btn-quiet";
            b.textContent = fillCopy("pnPhRemove", { reading: words });
            b.addEventListener("click", () => { void removeReading(rec, words); });
            row.appendChild(b);
        }
        card.appendChild(row);
    }
    const rungs = ladder(current, structure, ground.src);
    const gaps = beds.length ? groundRows(plot, observations, beds).filter((r) => r.l.rung === 0).length : 0;
    const gapText = gaps ? fillCopy("pnHintGaps", { gaps, total: beds.length + 1 }) : "";
    hint.textContent = (current ? ` · ${rungs.label}` : copy.pnHintNotRecorded) + gapText;
    const strip = document.createElement("div");
    strip.className = "soilladder";
    strip.id = "soilladder";
    strip.setAttribute("aria-label", fillCopy("pnSoilDetailAria", { label: rungs.label }));
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
        node.title = soilWord(RUNGS[i]);
        const nm = document.createElement("span");
        nm.className = "lname";
        nm.textContent = soilWord(RUNGS[i]);
        node.appendChild(nm);
        strip.appendChild(node);
    }
    const rungText = document.createElement("p");
    rungText.className = "soilrung";
    rungText.textContent = rungs.rung === 0
        ? copy.pnRungNone
        : fillCopy("pnRungAt", { label: rungs.label });
    if (rungs.next) {
        rungText.textContent += " " + fillCopy("pnRungNextBuys", { label: rungs.next.label, costs: rungs.next.costs, buys: rungs.next.buys });
    }
    else {
        rungText.textContent += " " + copy.pnRungTop;
    }
    card.appendChild(strip);
    card.appendChild(rungText);
    const growingHere = onThisGround(plantings, bed ? bed.region ?? null : null);
    if (ground.superseded.ph) {
        const sup = document.createElement("p");
        sup.className = "soilsuperseded";
        sup.id = "soilsuperseded";
        const by = String(ground.superseded.ph.by ?? copy.pnAnAmendment);
        sup.textContent = fillCopy("pnPhSuperseded", { by, date: day(ground.superseded.ph.date) });
        card.appendChild(sup);
    }
    if (caps.limits.length) {
        const fold = document.createElement("details");
        fold.className = "limits";
        fold.id = "soillimitsfold";
        const sum = document.createElement("summary");
        const label = document.createElement("span");
        label.textContent = copy.pnCannotJudge;
        const count = document.createElement("span");
        count.className = "limitcount";
        count.textContent = String(caps.limits.length);
        sum.append(label, count);
        fold.appendChild(sum);
        const limits = document.createElement("ul");
        limits.className = "soillimits";
        for (const l of caps.limits) {
            const li = document.createElement("li");
            li.textContent = soilWord(l);
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
        h.textContent = current.lab ? fillCopy("pnFromLab", { lab: String(current.lab) }) : copy.pnFromYourLab;
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
            om.textContent = fillCopy("pnOrganicMatter", { pct: current.om_pct });
            rep.appendChild(om);
        }
        if (typeof current.lab_recommendation === "string") {
            const q = document.createElement("blockquote");
            q.className = "soillabrec";
            q.textContent = current.lab_recommendation;
            rep.appendChild(q);
            const attrib = document.createElement("p");
            attrib.className = "provenance";
            const recDay = day(ground.as_of.lab_recommendation ?? ground.date);
            attrib.textContent = current.report_id
                ? fillCopy("pnLabWordsReport", { date: recDay, report: String(current.report_id) })
                : fillCopy("pnLabWords", { date: recDay });
            rep.appendChild(attrib);
        }
        card.appendChild(rep);
    }
    const perennialHere = growingHere.some((p) => p.resolved.lifespan === "perennial");
    const wet = drainageCautions(current, perennialHere);
    if (wet.length) {
        const box = document.createElement("div");
        box.className = "soilgate soilwet";
        box.id = "soilwet";
        const h = document.createElement("strong");
        h.textContent = copy.pnStandsWater;
        box.appendChild(h);
        const why = document.createElement("p");
        why.textContent = upperFirst(copy.pnWetWhy);
        box.appendChild(why);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        const metric = unitSystem() === "metric";
        const mound = perennialHere ? (metric ? copy.pnWetMoundTreesMetric : copy.pnWetMoundTrees)
            : (metric ? copy.pnWetMoundAnnualsMetric : copy.pnWetMoundAnnuals);
        fix.textContent = fillCopy("pnWetFix", { remedy: fillCopy("pnWetRemedy", { mound }) });
        box.appendChild(fix);
        mark(box, { kind: "rule", id: "R-100" });
        card.appendChild(box);
    }
    const forPh = current
        ? { ...current, source: ground.src.ph ?? current.source }
        : null;
    const fired = growingHere
        .map((p) => ({ label: p.label, species: p.species, resolved: p.resolved, cautions: phCautions(forPh, p.resolved) }))
        .filter((r) => r.cautions.length);
    if (caps.chemistry && !caps.gates_rules && growingHere.length) {
        const gate = document.createElement("div");
        gate.className = "soilgate";
        gate.id = "soilgate";
        const h = document.createElement("strong");
        h.textContent = copy.pnPhGateHead;
        gate.appendChild(h);
        const why = document.createElement("p");
        why.className = "soilgatemethod";
        const m = current?.ph_method;
        why.textContent = fillCopy(m === "calcium_chloride" ? "pnPhGateCacl2" : m === "other_salt" ? "pnPhGateOtherSalt"
            : "pnPhGateUnsure", { ph: current?.ph == null ? "" : phWord(current.ph) });
        gate.appendChild(why);
        mark(gate, { kind: "rule", id: "R-189" });
        card.appendChild(gate);
    }
    else if (caps.gates_rules && growingHere.length) {
        const gate = document.createElement("div");
        gate.className = "soilgate";
        gate.id = "soilgate";
        const h = document.createElement("strong");
        h.textContent = copy.pnPhGateHead;
        gate.appendChild(h);
        if (fired.length) {
            const ul = document.createElement("ul");
            for (const r of fired) {
                const li = document.createElement("li");
                const line = `${r.label}: ${soilWhy(r.cautions[0].why)}`;
                if (r.species)
                    linkNameIn(li, line, r.label, r.species);
                else
                    li.textContent = line;
                ul.appendChild(li);
            }
            gate.appendChild(ul);
            const over = (r) => {
                const rng = r.resolved.ph_range;
                return Array.isArray(rng) && typeof rng[1] === "number" && typeof current?.ph === "number" && current.ph > rng[1];
            };
            const fix = document.createElement("p");
            fix.className = "soilgatefix";
            fix.textContent = [copy.pnPhGateFix, fired.some((r) => !over(r)) ? copy.pnPhGateFloors : "",
                fired.some(over) ? (fired.some((r) => !over(r)) ? copy.pnPhGateCeilings : copy.pnPhGateCeilingAlone) : ""].filter(Boolean).join(" ");
            gate.appendChild(fix);
        }
        else {
            const ok = document.createElement("p");
            ok.textContent = fillCopy("pnPhGateOk", { ph: phWord(current.ph) });
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
        h.textContent = copy.pnLimeHead;
        lime.appendChild(h);
        const ul = document.createElement("ul");
        for (const r of limed) {
            const li = document.createElement("li");
            const line = `${r.label}: ${soilWhy(r.cautions[0].why)}`;
            if (r.species)
                linkNameIn(li, line, r.label, r.species);
            else
                li.textContent = line;
            ul.appendChild(li);
        }
        lime.appendChild(ul);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        fix.textContent = fillCopy("pnLimeFix", { ph: fmtDec(5.2, 1) });
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
        h.textContent = copy.pnClubHead;
        club.appendChild(h);
        const ul = document.createElement("ul");
        for (const r of clubbed) {
            const li = document.createElement("li");
            const line = `${r.label}: ${soilWhy(r.cautions[0].why)}`;
            if (r.species)
                linkNameIn(li, line, r.label, r.species);
            else
                li.textContent = line;
            ul.appendChild(li);
        }
        club.appendChild(ul);
        const fix = document.createElement("p");
        fix.className = "soilgatefix";
        fix.textContent = fillCopy("pnClubFix", { ph: fmtDec(7.2, 1) });
        club.appendChild(fix);
        card.appendChild(club);
    }
    const form = document.createElement("div");
    form.className = "soilform";
    const msel = document.createElement("select");
    const tsel = document.createElement("select");
    if (asks === "medium") {
        msel.id = "soilmedium";
        msel.setAttribute("aria-label", copy.pnSoilHeadMedium);
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
        tsel.setAttribute("aria-label", copy.pnTextureAria);
        for (const t of unknownFirst(TEXTURES)) {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = TEXTURE_LABEL[t] ?? t;
            if (current && current.texture === t)
                o.selected = true;
            tsel.appendChild(o);
        }
        form.appendChild(labelled(copy.pnTextureAria, tsel));
    }
    const dsel = document.createElement("select");
    dsel.id = "soildrainage";
    dsel.setAttribute("aria-label", copy.pnDrainageAria);
    for (const d of unknownFirst(DRAINAGES)) {
        const o = document.createElement("option");
        o.value = d;
        o.textContent = DRAINAGE_LABEL[d] ?? d;
        if (current && current.drainage === d)
            o.selected = true;
        dsel.appendChild(o);
    }
    form.appendChild(labelled(copy.pnDrainageAria, dsel));
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "soilmeasured";
    if (ground.src.texture === "field_test")
        cb.checked = true;
    if (asks === "soil") {
        const measured = document.createElement("label");
        measured.className = "soilmeasured";
        measured.appendChild(cb);
        measured.appendChild(document.createTextNode(copy.pnRibbonCheck));
        form.appendChild(measured);
        const ribbonHint = document.createElement("p");
        ribbonHint.className = "soilribbonhint";
        ribbonHint.textContent = unitSystem() === "metric" ? fillCopy("pnRibbonHintMetric", { a: fmtDec(2.5, 1), b: 5 }) : copy.pnRibbonHint;
        form.appendChild(ribbonHint);
    }
    const phOn = document.createElement("input");
    phOn.type = "checkbox";
    phOn.id = "soilhastest";
    const phWrap = document.createElement("div");
    phWrap.className = "soilph";
    phWrap.id = "soilphentry";
    phWrap.dataset.seatFocus = "soilph";
    const phLabel = document.createElement("label");
    phLabel.appendChild(phOn);
    phLabel.appendChild(document.createTextNode(copy.pnHavePh));
    phWrap.appendChild(phLabel);
    const phFields = document.createElement("div");
    phFields.className = "soilphfields";
    const phNum = document.createElement("input");
    phNum.type = "number";
    phNum.id = "soilph";
    phNum.step = "0.1";
    phNum.min = String(PH_MIN);
    phNum.max = String(PH_MAX);
    phNum.setAttribute("aria-label", copy.pnPhAria);
    phNum.placeholder = fillCopy("pnPhPlaceholder", { ph: fmtDec(6.4, 1) });
    const phHow = document.createElement("select");
    phHow.id = "soilphsource";
    phHow.setAttribute("aria-label", copy.pnPhHowAria);
    for (const [v, label] of [["kit", copy.pnPhHowKit], ["lab", copy.pnPhHowLab]]) {
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
    const methodWrap = document.createElement("div");
    methodWrap.className = "soilphmethod";
    methodWrap.id = "soilphmethodq";
    methodWrap.dataset.seatFocus = "soilphmethod";
    const methodSel = document.createElement("select");
    methodSel.id = "soilphmethod";
    for (const v of unknownFirst(PH_METHODS)) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = PH_METHOD_LABEL[v] ?? v;
        methodSel.appendChild(o);
    }
    const storedMethod = ground.src.ph === "lab" ? current?.ph_method : undefined;
    methodSel.value = typeof storedMethod === "string" && PH_METHODS.includes(storedMethod)
        ? storedMethod : "unknown";
    methodWrap.appendChild(labelled(copy.pnPhMethodLabel, methodSel));
    const methodHint = document.createElement("p");
    methodHint.className = "hint soilphmethodhint";
    methodHint.textContent = copy.pnPhMethodHint;
    methodWrap.appendChild(methodHint);
    phWrap.appendChild(methodWrap);
    const hasPh = !!current && typeof current.ph === "number";
    if (hasPh) {
        phOn.checked = true;
        phNum.value = String(current.ph);
    }
    const syncPh = () => {
        phFields.hidden = !phOn.checked;
        methodWrap.hidden = !phOn.checked || phHow.value !== "lab";
    };
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
    repLabel.appendChild(document.createTextNode(copy.pnHaveReport));
    repWrap.appendChild(repLabel);
    const repFields = document.createElement("div");
    repFields.className = "soilreportfields";
    const textInput = (id, val) => {
        const el = document.createElement("input");
        el.type = "text";
        el.id = id;
        if (typeof val === "string")
            el.value = val;
        return el;
    };
    const numInput = (id, val) => {
        const el = document.createElement("input");
        el.type = "number";
        el.id = id;
        el.step = "0.1";
        if (typeof val === "number")
            el.value = String(val);
        return el;
    };
    const labName = textInput("soillab", current?.lab);
    const reportId = textInput("soilreportid", current?.report_id);
    const bufferPh = numInput("soilbufferph", current?.buffer_ph);
    const omPct = numInput("soilom", current?.om_pct);
    for (const [words, el] of [[copy.pnWhichLab, labName], [copy.pnReportNumber, reportId], [copy.pnBufferPh, bufferPh],
        [copy.pnOrganicMatterPct, omPct]])
        repFields.appendChild(labelled(words, el));
    const omHint = document.createElement("p");
    omHint.className = "hint soilomhint";
    omHint.id = "soilomhint";
    omHint.textContent = copy.pnOrganicMatterHint;
    repFields.appendChild(omHint);
    const nutSel = {};
    const nutGrid = document.createElement("div");
    nutGrid.className = "soilnutrients";
    const currentNut = (current?.nutrients ?? {});
    const currentScale = Array.isArray(current?.other_scale) ? current.other_scale : [];
    for (const nkey of NUTRIENTS) {
        const wrap = document.createElement("label");
        wrap.appendChild(document.createTextNode(NUTRIENT_NAME[nkey] ?? nkey));
        const sel = document.createElement("select");
        sel.id = `soilnut-${nkey}`;
        sel.setAttribute("aria-label", fillCopy("pnNutrientLevelAria", { name: NUTRIENT_NAME[nkey] ?? nkey }));
        const none = document.createElement("option");
        none.value = "";
        none.textContent = copy.pnNotOnReport;
        sel.appendChild(none);
        for (const lv of NUTRIENT_LEVELS) {
            const o = document.createElement("option");
            o.value = lv;
            o.textContent = LEVEL_LABEL[lv] ?? lv;
            if (currentNut[nkey] === lv)
                o.selected = true;
            sel.appendChild(o);
        }
        const other = document.createElement("option");
        other.value = OTHER_SCALE;
        other.textContent = copy.pnNutrientOtherScale;
        if (typeof currentNut[nkey] !== "string" && currentScale.includes(nkey))
            other.selected = true;
        sel.appendChild(other);
        wrap.appendChild(sel);
        nutGrid.appendChild(wrap);
        nutSel[nkey] = sel;
    }
    repFields.appendChild(nutGrid);
    const scaleHint = document.createElement("p");
    scaleHint.className = "hint soilnutscalehint";
    scaleHint.id = "soilnutscale";
    const syncScale = () => {
        const on = NUTRIENTS.filter((k) => nutSel[k].value === OTHER_SCALE);
        scaleHint.hidden = !on.length;
        if (!on.length)
            return;
        const names = on.map((k) => fillCopy("pnNutrientInLine", { name: lowerFirst(NUTRIENT_NAME[k] ?? k) }));
        scaleHint.textContent = fillCopy("pnNutrientOtherScaleHint", { nutrients: new Intl.ListFormat(appLang() === "es" ? "es" : "en", { type: "conjunction" }).format(names) });
    };
    for (const k of NUTRIENTS)
        nutSel[k].addEventListener("change", syncScale);
    syncScale();
    repFields.appendChild(scaleHint);
    const recBox = document.createElement("textarea");
    recBox.id = "soilrecommendation";
    recBox.rows = 3;
    recBox.placeholder = copy.pnRecPlaceholder;
    recBox.setAttribute("aria-label", copy.pnRecAria);
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
    phHow.addEventListener("change", syncPh);
    phOn.addEventListener("change", syncRep);
    form.appendChild(repWrap);
    const phErr = document.createElement("p");
    phErr.className = "soilpherr";
    phErr.id = "soilpherr";
    phErr.hidden = true;
    form.appendChild(phErr);
    const amend = document.createElement("select");
    amend.id = "soilamendment";
    amend.setAttribute("aria-label", copy.pnAmendAria);
    const noAmend = document.createElement("option");
    noAmend.value = "";
    noAmend.textContent = copy.pnAmendNone;
    amend.appendChild(noAmend);
    for (const a of AMENDMENTS) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = AMENDMENT_LABEL[a] ?? titleish(a);
        amend.appendChild(o);
    }
    const amendWrap = document.createElement("label");
    amendWrap.className = "soilamend";
    amendWrap.appendChild(document.createTextNode(copy.pnAmendLabel));
    amendWrap.appendChild(amend);
    form.appendChild(amendWrap);
    const save = document.createElement("button");
    save.id = "soilsave";
    save.type = "button";
    save.className = "btn btn-secondary";
    save.textContent = asks === "medium" ? copy.pnSaveFill : copy.pnSaveSoil;
    let asking = false;
    save.addEventListener("click", () => {
        if (!hooks)
            return;
        const h = hooks;
        const splitPh = phOn.checked;
        const rec = {
            plot,
            date: localTodayIso(),
            source: asks === "soil" && cb.checked ? "field_test" : "declared",
            texture: asks === "medium" ? "unknown" : tsel.value,
            drainage: dsel.value,
        };
        if (asks === "medium")
            rec.medium = msel.value;
        if (phOn.checked) {
            const v = Number(phNum.value);
            if (!phNum.value.trim() || !Number.isFinite(v) || v < PH_MIN || v > PH_MAX) {
                phErr.textContent = fillCopy("pnPhRange", { min: PH_MIN, max: PH_MAX });
                phErr.hidden = false;
                return;
            }
            phErr.hidden = true;
            rec.ph = v;
            rec.source = phHow.value;
            if (phHow.value === "lab")
                rec.ph_method = methodSel.value;
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
                    if (nutSel[nkey].value && nutSel[nkey].value !== OTHER_SCALE)
                        nutrients[nkey] = nutSel[nkey].value;
                if (Object.keys(nutrients).length)
                    rec.nutrients = nutrients;
                const otherScale = NUTRIENTS.filter((nkey) => nutSel[nkey].value === OTHER_SCALE);
                if (otherScale.length)
                    rec.other_scale = otherScale;
            }
        }
        if (bed && bed.region)
            rec.region = bed.region;
        const also = () => amend.value
            ? [h.save({ plot, date: rec.date, source: "declared", amendment: amend.value, ...(rec.region ? { region: rec.region } : {}) })]
            : [];
        const submitted = formBase;
        formBase = null;
        const refused = () => {
            asking = false;
            if (formBase !== null || !phErr.isConnected)
                return;
            formBase = submitted;
            phErr.textContent = copy.pnSaveRefused;
            phErr.hidden = false;
        };
        const write = () => {
            if (splitPh) {
                const desc = { ...rec };
                delete desc.ph;
                delete desc.ph_method;
                for (const k of REPORT_FIELDS) {
                    delete desc[k];
                }
                desc.source = asks === "soil" && cb.checked ? "field_test" : "declared";
                const reading = { ...rec };
                for (const k of ["texture", "drainage", "medium"])
                    delete reading[k];
                void Promise.all([h.save(desc), h.save(reading), ...also()])
                    .then(() => { asking = false; toast(bed ? fillCopy("pnToastSoilFor", { bed: bed.name }) : copy.pnToastSoil); })
                    .catch(refused);
            }
            else {
                void Promise.all([h.save(rec), ...also()])
                    .then(() => {
                    asking = false;
                    toast(asks === "medium"
                        ? (bed ? fillCopy("pnToastFillFor", { bed: bed.name }) : copy.pnToastFill)
                        : (bed ? fillCopy("pnToastSoilFor", { bed: bed.name }) : copy.pnToastSoil));
                })
                    .catch(refused);
            }
        };
        const stored = current === null ? h.stored : undefined;
        if (!stored) {
            write();
            return;
        }
        if (asking)
            return;
        asking = true;
        void stored().then((list) => {
            if (!Object.keys(resolveGround(list, plot, bed ? bed.region ?? null : null).fields).length) {
                write();
                return;
            }
            asking = false;
            if (lastArgs) {
                const [p, , ...rest] = lastArgs;
                renderSoil(p, list, ...rest);
            }
            toast(copy.pnSoilShownLate, 6000, undefined, { wrap: true });
        }, refused);
    });
    form.appendChild(save);
    card.appendChild(form);
    const groundKey = `${plot}|${bed ? bed.name : ""}|${asks}`;
    const fresh = formValues(form);
    if (draft && draft.ground === groundKey && sameValues(fresh, draft.base)) {
        for (const el of controls(form)) {
            const v = draft.values[el.id];
            if (v === undefined)
                continue;
            if (isBox(el))
                el.checked = v === true;
            else
                el.value = String(v);
        }
        syncPh();
        syncRep();
        syncScale();
        if (draft.err) {
            phErr.textContent = draft.err;
            phErr.hidden = false;
        }
    }
    formBase = { ground: groundKey, values: fresh };
    const intent = entryIntent;
    entryIntent = null;
    if (intent === "water") {
        phOn.checked = true;
        phHow.value = "lab";
        phNum.value = "";
        methodSel.value = "unknown";
        syncPh();
        syncRep();
    }
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
            ? fillCopy("pnAcrossSome", { n: untouched, total: rows.length })
            : fillCopy("pnAcrossAll", { n: rows.length });
        all.appendChild(sum);
        const table = document.createElement("table");
        const head = document.createElement("tr");
        for (const h of [copy.pnColGround, copy.pnColDetail, copy.pnColPh, copy.pnColLastRecorded]) {
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
                phCell(r.obs?.ph, r.src.ph, r.obs?.ph_method) + (r.also ? `, ${phCell(r.also.ph, "lab", r.also.ph_method)}` : ""),
                r.date ? day(r.date) : "-",
            ];
            for (const c of cells) {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            }
            tr.tabIndex = 0;
            tr.addEventListener("click", () => {
                setSoilBed(r.i === 0 ? "" : r.name);
                renderSoil(plot, observations, lat, lon, beds, plantings, groundHistory, bundle);
            });
            table.appendChild(tr);
        }
        all.appendChild(table);
        card.appendChild(all);
    }
    const test = document.createElement("p");
    test.className = "soiltest";
    const route = document.createElement("span");
    withLocalHelp((m) => m.fillSoilRoute(route, lat, lon));
    fillNodes(test, copy.pnSoilTestLead, { link: route });
    test.append(" ");
    mark(test, { kind: "rule", id: "R-017" });
    card.appendChild(test);
    if (refocus) {
        const el = document.getElementById(refocus);
        if (el && panel.contains(el) && el !== document.activeElement)
            el.focus({ preventScroll: true });
    }
}
function labelled(words, control) {
    const row = document.createElement("label");
    row.className = "fieldrow";
    const t = document.createElement("span");
    t.textContent = words;
    row.append(t, control);
    return row;
}
let goToSoil = null;
function setSoilJump(fn) { goToSoil = fn; }
function renderSoilSummary(plot, observations, beds = []) {
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
    strip.setAttribute("aria-label", fillCopy("pnSoilDetailAria", { label: whole.l.label }));
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
        node.title = soilWord(RUNGS[i]);
        strip.appendChild(node);
    }
    host.appendChild(strip);
    const line = document.createElement("p");
    line.className = "soilrung";
    line.id = "soilsummaryrung";
    line.textContent = whole.obs
        ? fillCopy("pnWholeAt", { label: whole.l.label, date: day(whole.date) })
        : copy.pnWholeNothing;
    if (whole.l.next) {
        line.textContent += " " + fillCopy("pnRungNextCosts", { label: whole.l.next.label, costs: whole.l.next.costs });
    }
    host.appendChild(line);
    if (beds.length) {
        const table = document.createElement("table");
        table.id = "soilsummarytable";
        const head = document.createElement("tr");
        for (const h of [copy.pnColGround, copy.pnColDetail, copy.pnColLastRecorded]) {
            const th = document.createElement("th");
            th.textContent = h;
            head.appendChild(th);
        }
        table.appendChild(head);
        for (const r of rows) {
            const tr = document.createElement("tr");
            if (r.l.rung === 0)
                tr.className = "soilgap";
            for (const c of [r.name, r.l.label, r.date ? day(r.date) : "-"]) {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            }
            tr.tabIndex = 0;
            tr.addEventListener("click", () => goToSoil?.(r.i === 0 ? "" : r.name));
            table.appendChild(tr);
        }
        host.appendChild(table);
    }
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = beds.length
        ? copy.pnSummaryHintBeds
        : copy.pnSummaryHint;
    host.appendChild(hint);
}

export { buildStoreZip, downscalePhoto, drawFind, drawLineCard, emitSeason, gardenWords, kindWord, lineContext, logTrail, makeSyntheticSeasons, mintPhotoName, nothingMatches, openSoilEntry, parseSeasonFile, plantEditorForm, plantingDateWords, readLogLine, readStoreZip, renderFrost, renderLocations, renderSeedBox, renderShoppingList, renderSoil, renderSoilSummary, renderSolar, reselectSoilGround, setSoilHooks, setSoilJump, suggestFromName, symptoms, wrongTrail, yearCount };
