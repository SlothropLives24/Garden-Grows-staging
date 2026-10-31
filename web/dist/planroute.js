import './chunk-lutet8cz.js';
import { copy, fillCopy, humanize, stripRuleCitations, titleCase, humanizeFamilies, plainClaim, countRung, labelCopy, pluralCopy, midSentence, familyInProse, familyName, seat, scrollerFor, fillNodes as fillNodes$3, ownScroll, bindSettling, plusPreview, appLang, buzz } from './paint.js';
import { guidesForSpecies, cardSrcset, CARD_SIZES, commonName, guideCountForSpecies, speciesThumb, fmtArea, browsableGuilds, planBedRegion, regionPoints, area, guildStatus, displayName, ruleClaim, markLink, instantiate, reasonText, plantingLabel, teamClaim, linkNameIn, openSeason, app, bedHasSections, plantingOnBed, fmtCm, resolvedField, gardenLat, getSeason, localTodayIso, putSeason, toast, seasonId, memberSpecies, plantableArea, bedStructure, scaledFillCounts, roleDensity, resolveSpecies, roleLineCount, disclose, corpusText, fmtLen, activeBundle, plantLink, plantingWindowFor, scheduleSite, seasonAllYearLine, heatWarnings, fmtTemp, mark, boltWarnings, warmthFloorRule, floorSay, warmthFloorFor, floorLines, layoutRows, mechanismRows, confidenceBadge, laysOutAsHills, livingSupportLead, roleOverridesOf, substitutionVerdict, linkNamesIn, lateFallFrostOf, fmtMonthDay, radialRingsFromFootprint, layoutKeys, shelteredChosen, carriedOccupancy, place, unkeyZones, noonShadowLengthM, referenceDoy, placementSvg, zoneColorMap, centrePair, ineligibility, adjacent, priorSeasonCredit, thinBreakSuggestion, familyRotationRule, $ as $$3, eligibleSpecies, resolveZone, growsHereAt, cropSearch, categoryLabel, plantHref, bedOrientation, accessBands, shelterPredicate, shelteredByShadow, intersectArea, appliedPlanDots, BLOOM_ORDER, forageInFlower, el as el$1, seasonById, regionCentroid, SVG_NS as SVG_NS$2, svgNumber, gardenColours, filledMembers, snapCountsToLayout, openLog, mergeSurvivingDetail, getPlot, putPlot, upsertSeasonSnapshot, orientedToPlot, forageCandidates, corpusWantsEs, corpusEs, unitSystem, heightOrderingViolations, setSpaceChoice, gardenBounds, teamPlantWindow, jobWhat, dayWord, heldByLine, installPlanSeams, currentBedRegion, currentBedSun, derivedGuilds, guildSection, bandRank, shortlistRank, SECTION_ORDER, GLOSSARY, spaceChoice, placeGuildPlants, gardenTasks, spacingRows, firstBedSize, nextBedName, nextOrigin, placeBed, fmtAreaApart, localiseProse, householdChoice, fitDiagram, afterChoice, inGround, bedSeasonStatus, framesEqual, bedFrame, remapRegionBetweenBeds, mapsApiKey, loadMapsJs, num, listSeasons, listSoilObservations, glossTerm, takePlanFresh, mToInput, fmtDec, lengthUnit, lenM, listPlots, paintDefaultToggle, defaultPlotId, setDefaultPlot, openGardens, eraseGarden, setGardenClosed, gardenClosed, pickGarden, freePlotId, plotIdFor, renameBed, moveGarden, orderGardens, gardenShownName, PATH_M, setPlotAnchorOnce, fmtKm, accessBandPolygons, sectionParentOf, endCausePhrase, minReachSpanM, isSimplePolygon, polygonArea, lenToM, parseRegion, bedDepthWord, structureWord, fmtMonthDayYear, plantableStripPolygons, plantedLine, removeBed, addPlanting, gardenNameOf } from './core.js';
import { composePlot, tierLine, allPots, bedState } from './chunk-iac2um9b.js';
import { groundRest, teamLift, teamsForPlant, forPots } from './chunk-k60vt8tj.js';
import { householdCount, householdLine, householdWho } from './chunk-cph1bzsd.js';
import { monthsPhrase, waterLines, seasonMonths, virusNeighbours, plantableM2, viabilityFloor, strongestSupportRequirement, circleFootprintM2, reasonLine, openBed, structureLine, bedArchetype, optimizeBed, optimizedPlacement } from './chunk-i55djf5h.js';
import { FIELD_ROWS, VALUE_WORD } from './chunk-h8sxf1mq.js';
import { invasiveNote } from './chunk-e28r444y.js';
export { openNextSeason, renderNextSeason } from './chunk-jkf3oq22.js';
import { undatedLines } from './chunk-or4xtote.js';
import { unfitLine } from './chunk-nmt4lyi1.js';
import './chunk-l5cseoso.js';
import './chunk-dpsx67rd.js';

function readingStrip(bundle, species, exclude = []) {
    const ids = [];
    for (const s of species)
        if (s && !ids.includes(s))
            ids.push(s);
    const hits = guidesForSpecies(ids, undefined, exclude);
    if (!hits.length)
        return null;
    const sec = document.createElement("section");
    sec.className = "reading";
    sec.id = "plan-reading";
    const h = document.createElement("h3");
    h.className = "reading-h";
    h.textContent = copy.planReadingTitle;
    const lede = document.createElement("p");
    lede.className = "reading-lede";
    lede.textContent = copy.planReadingLede;
    sec.append(h, lede);
    const strip = document.createElement("div");
    strip.className = "reading-strip";
    for (const { species: sid, guide } of hits) {
        const a = document.createElement("a");
        a.className = "readcard";
        a.href = `../guides/${guide.slug}/`;
        a.dataset.guide = guide.slug;
        a.dataset.species = sid;
        const thumb = speciesThumb(sid);
        if (thumb) {
            const im = document.createElement("img");
            im.className = "readcard-img";
            im.src = `img/thumbs/${thumb}.webp`;
            const set = cardSrcset(thumb);
            if (set) {
                im.srcset = set;
                im.sizes = CARD_SIZES;
            }
            im.alt = "";
            im.width = 456;
            im.height = 228;
            im.loading = "lazy";
            im.decoding = "async";
            a.appendChild(im);
        }
        else {
            a.classList.add("noimg");
        }
        const k = document.createElement("span");
        k.className = "readcard-k";
        k.textContent = copy.planReadingKicker.replace("{plant}", commonName(bundle, sid).toLowerCase());
        const t = document.createElement("span");
        t.className = "readcard-t";
        t.textContent = guide.title;
        const b = document.createElement("span");
        b.className = "readcard-b";
        b.textContent = guide.description;
        a.append(k, t, b);
        strip.appendChild(a);
    }
    sec.appendChild(strip);
    const n = guideCountForSpecies(ids);
    if (n > hits.length) {
        const more = document.createElement("p");
        more.className = "reading-more";
        more.textContent = copy.planReadingMore.replace("{n}", String(n));
        sec.appendChild(more);
    }
    return sec;
}

function plotExcluded(bundle, beds) {
    const out = {};
    const teams = browsableGuilds(bundle);
    for (const bed of beds) {
        const reg = planBedRegion(bed);
        const pts = reg ? regionPoints(reg) : null;
        const bw = pts ? Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) : null;
        const bl = pts ? Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) : null;
        const bedArea = area(bed.region);
        const ex = [];
        for (const g of teams) {
            if (guildStatus(g, bw, bl, bundle, bed.structure, reg).fits)
                continue;
            const forItsKind = !guildStatus(g, 1e6, 1e6, bundle, bed.structure, null).fits;
            const singleByArea = Number(g.footprint_min_m2 || 0) <= bedArea + 1e-9;
            if (forItsKind || singleByArea)
                ex.push(g.id);
        }
        if (ex.length)
            out[bed.name] = ex;
    }
    return out;
}
function careLines(guild, site, bundle) {
    const out = [];
    for (const rr of instantiate(guild, site, bundle).roles) {
        const o = rr.options.find((x) => x.eligible && x.filler === rr.chosen);
        for (const a of o?.advisories ?? []) {
            if (a.rule !== "R-076" && a.rule !== "R-188")
                continue;
            const line = fillCopy("gmPlotCare", { plant: plantingLabel(bundle, o.filler, o.group), why: reasonText(a.why) });
            if (!out.includes(line))
                out.push(line);
        }
    }
    return out;
}
function fillNodes$2(parent, template, parts) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        const v = k ? parts[k] : undefined;
        if (v !== undefined)
            parent.appendChild(typeof v === "string" ? document.createTextNode(v) : v);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
function plotBlock(bundle, beds, leadGuildId, fresh, site) {
    if (!beds.length)
        return null;
    const planned = fresh?.planned ?? new Map();
    const free = beds.filter((b) => !planned.has(b.name));
    const r = composePlot({ beds: beds.map((b) => ({ name: b.name, region: b.region })), excluded: plotExcluded(bundle, beds) }, bundle);
    const rFree = free.length === beds.length ? r
        : free.length ? composePlot({ beds: free.map((b) => ({ name: b.name, region: b.region })), excluded: plotExcluded(bundle, free) }, bundle) : null;
    const solo1 = beds.length === 1;
    if (solo1 && r.tier.key !== "under_1" && r.tier.key !== "one_guild" && !planned.size)
        return null;
    const byId = new Map(bundle.guilds.map((g) => [g.id, g]));
    const name = (gid) => {
        const g = byId.get(gid);
        return g ? displayName(g) : gid;
    };
    const careMemo = new Map();
    const care = (gid) => {
        const g = byId.get(gid);
        if (!g || !site)
            return [];
        let c = careMemo.get(gid);
        if (!c) {
            c = careLines(g, site, bundle);
            careMemo.set(gid, c);
        }
        return c;
    };
    const box = document.createElement("div");
    box.className = "plotlayer";
    const head = document.createElement("p");
    head.className = "plot-legend";
    head.textContent = solo1
        ? fillCopy("gmPlotHeadOne", { area: fmtArea(r.total_m2) })
        : fillCopy("gmPlotHeadMany", { n: beds.length, area: fmtArea(r.total_m2) });
    box.appendChild(head);
    if (free.length) {
        const tier = document.createElement("p");
        tier.className = "plot-tier";
        tier.textContent = tierLine(beds);
        box.appendChild(tier);
    }
    if (planned.size) {
        const p = document.createElement("p");
        p.className = "plot-planned";
        const list = document.createElement("span");
        [...planned].forEach(([bed, gid], i) => {
            if (i)
                list.append(" · ");
            fillNodes$2(list, copy.gmPlotOnBeds, { team: !gid ? copy.gmPlotOwnDesign : byId.has(gid) ? guildLink(gid, name(gid)) : copy.gmPlotTeamGone, beds: bed });
        });
        fillNodes$2(p, copy.gmPlotPlanned, { list });
        box.appendChild(p);
        if (!free.length)
            return box;
    }
    if (beds.length > 1 && allPots(beds))
        return box;
    const ra = rFree ?? r;
    if (ra.refused) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = copy.gmPlotTooMany;
        box.appendChild(p);
        return box;
    }
    if (!ra.arrangements.length)
        return box;
    const rest = (gid) => byId.get(gid)?.guild_class === "restorative";
    const rests = (a) => a.assignments.some((x) => rest(x.guild));
    let bareSeen = null;
    const bare = () => (bareSeen ??= !!fresh?.bare());
    const arrangements = ra.arrangements.some(rests) && bare()
        ? [...ra.arrangements.filter((a) => !rests(a)), ...ra.arrangements.filter(rests)] : ra.arrangements;
    const solo = ra.tier.key === "under_1" || ra.tier.key === "one_guild" || free.length === 1;
    if (solo) {
        const a = arrangements[0].assignments[0];
        const deferring = free.length === 1 && !!leadGuildId && byId.has(leadGuildId) && (beds.length === 1 || fresh?.leadBed === free[0].name);
        let gid = deferring ? leadGuildId : a.guild, bed = a.beds[0];
        if (rest(gid) && leadGuildId && fresh?.leadBed && byId.has(leadGuildId) && !rest(leadGuildId) && bare()) {
            gid = leadGuildId;
            bed = fresh.leadBed;
        }
        const p = document.createElement("p");
        p.className = "plot-solo";
        fillNodes$2(p, copy.gmPlotSolo, { team: guildLink(gid, name(gid)), bed });
        box.appendChild(p);
        for (const line of care(gid))
            box.appendChild(careLine(line));
        return box;
    }
    const list = document.createElement("ol");
    list.className = "plot-arrangements";
    const cared = new Set();
    const careOnce = (gid) => (cared.has(gid) ? [] : (cared.add(gid), care(gid)));
    for (const a of arrangements)
        list.appendChild(arrangementItem(a, bundle, name, careOnce));
    box.appendChild(list);
    const how = document.createElement("details");
    how.className = "plot-how";
    const sum = document.createElement("summary");
    sum.textContent = copy.gmPlotHowSummary;
    const key = document.createElement("p");
    key.className = "plot-key";
    key.textContent = copy.gmPlotHowKey;
    how.append(sum, key);
    box.appendChild(how);
    return box;
}
function guildLink(gid, label) {
    const a = document.createElement("a");
    a.href = `#/plan?guild=${gid}`;
    a.textContent = label;
    return a;
}
function careLine(text) {
    const p = document.createElement("p");
    p.className = "hint plot-care";
    p.textContent = text;
    return p;
}
function arrangementItem(a, bundle, name, care) {
    const li = document.createElement("li");
    const line = document.createElement("p");
    line.className = "plot-arr";
    a.assignments.forEach((x, i) => {
        if (i)
            line.append(" · ");
        fillNodes$2(line, x.spans ? copy.gmPlotSpans : copy.gmPlotOnBeds, { team: guildLink(x.guild, name(x.guild)), beds: x.beds.join(" + ") });
    });
    li.appendChild(line);
    const said = new Set();
    for (const x of a.assignments)
        for (const c of care(x.guild))
            if (!said.has(c)) {
                said.add(c);
                li.appendChild(careLine(c));
            }
    if (a.cross.length) {
        const ul = document.createElement("ul");
        ul.className = "plot-cross";
        for (const c of a.cross) {
            const cli = document.createElement("li");
            const detail = c.kind === "joint_corn_block"
                ? "the block pollinates as one planting across the bed edge: "
                : c.kind === "insectary_spillover"
                    ? `${String(c.detail.from)} serves ${String(c.detail.to)}: `
                    : "";
            cli.append(detail);
            const link = document.createElement("a");
            link.href = `#/why?rule=${c.rule}`;
            link.textContent = ruleClaim(bundle, c.rule);
            markLink(link, { kind: "rule", id: c.rule });
            cli.appendChild(link);
            ul.appendChild(cli);
        }
        li.appendChild(ul);
    }
    return li;
}

const ROLE_NAMES = {
    backbone: copy.rnBackbone,
    bolter: copy.rnBolter,
    border: copy.rnBorder,
    bridge: copy.rnBridge,
    bulb_ring: copy.rnBulbRing,
    canopy: copy.rnCanopy,
    companion: copy.rnCompanion,
    cover: copy.rnCover,
    crop: copy.rnCrop,
    early: copy.rnEarly,
    edge: copy.rnEdge,
    fixer: copy.rnFixer,
    fruiting_understory: copy.rnFruitingUnderstory,
    grain: copy.rnGrain,
    insectary: copy.rnInsectary,
    leaf_crop: copy.rnLeafCrop,
    legume: copy.rnLegume,
    masking: copy.rnMasking,
    mulch_producer: copy.rnMulchProducer,
    overwinter: copy.rnOverwinter,
    primary: copy.rnPrimary,
    shade: copy.rnShade,
    shrub_layer: copy.rnShrubLayer,
    support: copy.rnSupport,
    trap: copy.rnTrap,
};
const ROLE_WORDS = {
    fixer: copy.rwFixer,
    cover: copy.rwCover,
    support: copy.rwSupport,
    insectary: copy.rwInsectary,
    canopy: copy.rwCanopy,
    bulb_ring: copy.rwBulbRing,
    primary: copy.rwPrimary,
    mulch_producer: copy.rwMulchProducer,
    companion: copy.rwCompanion,
    fruiting_understory: copy.rwFruitingUnderstory,
    leaf_crop: copy.rwLeafCrop,
    masking: copy.rwMasking,
    shrub_layer: copy.rwShrubLayer,
    edge: copy.rwEdge,
    crop: copy.rwCrop,
    trap: copy.rwTrap,
    border: copy.rwBorder,
    overwinter: copy.rwOverwinter,
    grain: copy.rwGrain,
    legume: copy.rwLegume,
    shade: copy.rwShade,
    bolter: copy.rwBolter,
    early: copy.rwEarly,
    backbone: copy.rwBackbone,
    bridge: copy.rwBridge,
};
function roleWords(guild, role) {
    const tagged = (guild.mechanisms ?? [])
        .filter((m) => m.role === role && m.claim).map((m) => stripRuleCitations(teamClaim(guild, String(m.claim))));
    if (tagged.length)
        return tagged.join("; ");
    return ROLE_WORDS[role] ?? null;
}
function roleName(role) {
    return ROLE_NAMES[role] ?? humanize(role);
}

function substitutionSentence(v, bundle, guild) {
    const name = fillerLabel(bundle, v.filler, v.group);
    const remedyNames = v.remediation.map((r) => commonName(bundle, r.filler));
    const remedy = remedyNames.join(", ");
    const marks = [{ label: name, species: v.filler, group: v.group ?? null }];
    v.remediation.forEach((r, i) => marks.push({ label: remedyNames[i], species: r.filler }));
    const said = (text) => ({ text, marks });
    const space = v.extra_footprint_m2 > 0 && v.effective_footprint_min_m2 != null
        ? (v.footprint_exceeds_bed
            ? " " + fillCopy("plSubMoreRoomOver", { area: fmtArea(v.effective_footprint_min_m2) })
            : " " + fillCopy("plSubMoreRoom", { area: fmtArea(v.effective_footprint_min_m2) }))
        : "";
    if (v.verdict === "clean") {
        return said(fillCopy("plSubClean", { name, role: roleName(v.role).toLowerCase() }) + space);
    }
    if (v.verdict === "adaptation") {
        const lost = v.predicate_fails.map(humanizeFamilies).join("; ");
        const forfeits = v.role_mechanisms.length
            ? " " + fillCopy("plSubForfeit", { list: v.role_mechanisms.map((m) => plainClaim(stripRuleCitations(teamClaim(guild, m.claim)), gardenLat())).join("; ") })
            : "";
        const keep = remedy ? " " + fillCopy("plSubKeepIt", { list: remedy }) : "";
        return said(fillCopy("plSubAdapt", { name, role: roleName(v.role).toLowerCase(), lost, team: displayName(guild) }) + `${forfeits}${keep}${space}`);
    }
    const why = v.site_reasons.map((r) => reasonText(r.why)).join("; ");
    const alt = remedy ? " " + fillCopy("plSubTryInstead", { list: remedy }) : "";
    return said(fillCopy("plSubCant", { name, why }) + alt);
}
function cultivarRequirement(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const cultivar = typeof sp?.cultivar_required === "string" ? sp.cultivar_required : "";
    if (!cultivar)
        return null;
    const reason = typeof sp?.cultivar_reason === "string" ? sp.cultivar_reason.trim() : "";
    return { cultivar: titleCase(humanize(cultivar)), reason: stripRuleCitations(reason) };
}
function schedulingNote(bundle, species, group = null) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    if (resolvedField(sp, group, "scheduling_model") !== "gdd")
        return null;
    return copy.plSchedulingNote;
}
function containmentNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    if (sp?.spreads_unbidden !== true)
        return null;
    const why = typeof sp.spreads_unbidden_reason === "string" ? sp.spreads_unbidden_reason.trim() : "";
    return `${copy.plSpreads}${why ? ` - ${stripRuleCitations(why)}` : ""}`;
}
function cultivarPartner(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const poll = sp?.pollination;
    return typeof poll?.min_cultivars === "number" ? poll.min_cultivars : null;
}
function dioeciousNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const poll = sp?.pollination;
    return poll?.dioecious === true;
}
function bearingNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const y = sp?.years_to_bearing;
    if (!Array.isArray(y) || y.length < 2)
        return null;
    const [lo, hi] = y;
    if (typeof lo !== "number" || typeof hi !== "number")
        return null;
    const span = lo === hi ? `${lo}` : `${lo}-${hi}`;
    return fillCopy(hi === 1 ? "plBearingOne" : "plBearingMany", { span });
}
function groupLabel(bundle, species, group) {
    return plantingLabel(bundle, species, group);
}
function fillNodes$1(parent, template, nodes) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        if (k && k in nodes)
            parent.appendChild(nodes[k]);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
function sideWord(d) {
    return { north: copy.plNorth, south: copy.plSouth, east: copy.plEast, west: copy.plWest }[d] ?? d;
}
function fillerLabel(bundle, filler, group) {
    return groupLabel(bundle, filler, group);
}
const candbedValue = () => document.getElementById("candbed")?.value ?? "";
function plotSiblings(exceptBed) {
    const openSeason$1 = openSeason() ?? undefined;
    return app.logSnapshot.beds
        .filter((b) => b.name !== exceptBed && !bedHasSections(b.name, app.logSnapshot.beds))
        .map((b) => {
        const live = (openSeason$1?.plantings ?? [])
            .filter((pl) => !pl.end_cause && plantingOnBed(pl.region, b.region));
        return { name: b.name, region: b.region, species: live.map((pl) => pl.species),
            members: live.map((pl) => ({ species: pl.species, group: pl.cultivar_group ?? null })) };
    });
}
function placementWords(bundle, z, where, opts = {}) {
    const spacingCm = z.plants.length ? Math.round(z.plants[0].r * 200) : 0;
    const apart = z.count > 1 && spacingCm ? fillCopy("plApart", { len: fmtCm(spacingCm) }) : "";
    const packedM2 = z.count > 1 && z.plants.length
        ? z.count * (z.plants[0].r * 2) ** 2 : Infinity;
    const shownArea = Math.min(z.area_m2, packedM2);
    const group = opts.group !== undefined ? opts.group : z.group ?? null;
    const label = plantingLabel(bundle, z.species, group);
    const vars = { name: label, height: fmtCm(z.height_cm), where, apart, area: fmtArea(shownArea) };
    const text = opts.pair
        ? fillCopy("plPlacementPair", { ...vars, n: z.count * 2 })
        : fillCopy("plPlacementLine", { ...vars, n: z.count });
    return { text, label, group };
}
function chosenOptionIndex(options) {
    return options.findIndex((o) => o.eligible);
}
function placementLine(bundle, z, where, colour, opts = {}) {
    const el = document.createElement("p");
    el.className = "role";
    const dot = document.createElement("span");
    dot.className = "pdot";
    dot.style.background = colour;
    el.appendChild(dot);
    const said = placementWords(bundle, z, where, opts);
    linkNameIn(el, said.text, said.label, z.species, said.group);
    return el;
}

async function savePlanSelection(guildId, area, btn, _bundle, _site, roles, quiet = false) {
    const sid = seasonId();
    if (!app.logDb || sid == null)
        return;
    try {
        const season = await getSeason(app.logDb, app.currentPlotId, sid);
        if (!season)
            throw new Error(copy.plNoOpenSeason);
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        const kept = plan.filter((e) => e.area !== area);
        kept.push({ area, guild: guildId, saved: localTodayIso(), ...(roles && roles.length ? { roles } : {}) });
        season.plan = kept;
        await putSeason(app.logDb, season);
        countRung("team-applied");
        if (quiet) {
        }
        else {
            const dw = app.draftPlantWindow?.(kept[kept.length - 1]);
            if (dw?.status === "passed") {
                toast([fillCopy("plDraftSavedKept", { bed: area }), dw.heldBy].filter(Boolean).join(" "), 8000, { label: copy.gmFirstJobCalendar, go: () => void app.openWeek?.(undefined, area) });
                btn.textContent = fillCopy("plSavedKept", { bed: area });
            }
            else {
                toast(fillCopy("plDraftSavedMark", { bed: area }), 8000, { label: copy.plMarkItPlanted, go: () => window.dispatchEvent(new CustomEvent("gg-sheet-reveal", { detail: { bed: area } })) });
                btn.textContent = fillCopy("plSavedMarkWhenIn", { bed: area });
            }
        }
        btn.disabled = true;
        void app.logRefresh?.();
        window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: area, kind: "team" } }));
    }
    catch (e) {
        btn.textContent = `${e instanceof Error ? e.message : e}`;
    }
}

function teamsLockNote() {
    const lock = document.createElement("div");
    lock.className = "teamslock";
    lock.id = "teamslock";
    const h = document.createElement("p");
    h.className = "teamslock-h";
    h.textContent = copy.planLockedHeading;
    const body = document.createElement("p");
    body.className = "teamslock-body";
    body.textContent = copy.planLockedBody;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn-secondary stepnext teamslock-back";
    back.textContent = copy.planLockedBack;
    back.addEventListener("click", () => {
        const g = document.getElementById("sec-ground");
        if (g)
            g.open = true;
        flashBedRow();
    });
    lock.append(h, body, back);
    return lock;
}
function myBedLockNote() {
    const lock = document.createElement("div");
    lock.className = "teamslock";
    lock.id = "mybedlock";
    const h = document.createElement("p");
    h.className = "teamslock-h";
    h.textContent = copy.plMyBedLockH;
    const body = document.createElement("p");
    body.className = "teamslock-body";
    body.textContent = copy.plMyBedLockBody;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn-secondary stepnext teamslock-back";
    back.textContent = copy.planLockedBack;
    back.addEventListener("click", () => {
        const g = document.getElementById("sec-ground");
        if (g)
            g.open = true;
        flashBedRow();
    });
    lock.append(h, body, back);
    return lock;
}
function whereLockNote(stepId) {
    const lock = document.createElement("div");
    lock.className = "teamslock wherelock";
    lock.id = `wherelock-${stepId}`;
    const h = document.createElement("p");
    h.className = "teamslock-h";
    h.textContent = copy.plWhereLockH;
    const body = document.createElement("p");
    body.className = "teamslock-body";
    body.textContent = copy.plWhereLockBody;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn-secondary teamslock-back";
    back.textContent = copy.plWhereLockBack;
    back.addEventListener("click", () => goToWhere());
    lock.append(h, body, back);
    return lock;
}
function goToWhere() {
    const w = document.getElementById("step-where");
    if (w)
        w.open = true;
    window.setTimeout(() => document.getElementById("addr")?.focus(), 60);
}
function flashBedRow() {
    const row = document.querySelector(".dimbed");
    if (!row)
        return;
    row.classList.remove("flashcue");
    void row.offsetWidth;
    row.classList.add("flashcue");
    setTimeout(() => row.classList.remove("flashcue"), 1200);
}

function costTagWord(tag) {
    const w = { head_start_30d: copy.ctHeadStart30d, load_2_vines: copy.ctLoad2Vines,
        needs_stake: copy.ctNeedsStake, nitrogen_competition: copy.ctNitrogenCompetition,
        shades_neighbours: copy.ctShadesNeighbours, sunflower_residue: copy.ctSunflowerResidue };
    return w[tag] ?? humanize(tag);
}
function roleCostText(guild, roleId, english) {
    const role = (guild.roles ?? []).find((r) => r.id === roleId);
    const f = role?.cost?.trim() === english ? "cost" : role?.alternative_cost?.trim() === english ? "alternative_cost" : null;
    return f ? corpusText(guild.id, `roles.${roleId}.${f}`, english) : english;
}
const guildRoleChoices = new Map();
const roleChoiceKey = (bed, guildId, role) => `${bed}|${guildId}|${role}`;
function restoreRoleChoice(bed, guildId, role) {
    const live = guildRoleChoices.get(roleChoiceKey(bed, guildId, role));
    if (live)
        return live;
    const season = openSeason();
    const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => {
        const r = e;
        return r.area === bed && r.guild === guildId;
    });
    return entry ? roleOverridesOf(entry).get(role) ?? null : null;
}
function applyRoleChoice(sel, species, group) {
    const g = group ?? "";
    for (let i = 0; i < sel.options.length; i++) {
        const o = sel.options[i];
        if (o.value === species && (o.dataset.group ?? "") === g) {
            sel.selectedIndex = i;
            return;
        }
    }
    for (let i = 0; i < sel.options.length; i++)
        if (sel.options[i].value === species) {
            sel.selectedIndex = i;
            return;
        }
}
function plannedSpecies(inst, guild) {
    const members = memberSpecies(guild);
    if (!inst?.roles.length)
        return members;
    return inst.roles
        .filter((r) => r.chosen)
        .map((r) => [r.chosen, r.options.find((o) => o.filler === r.chosen)?.group ?? null]);
}
function seasonWindowLine(w, csite) {
    const allYear = seasonAllYearLine(csite);
    if (allYear)
        return allYear;
    const late = w.last_frost_p50 && !w.first_freeze_p50 && csite ? csite.late_fall_frost ?? lateFallFrostOf(csite) : null;
    if (w.last_frost_p50 && late) {
        const frost = fmtMonthDay(w.last_frost_p50), freeze = fmtMonthDay(late.mmdd);
        return late.in_ten ? fillCopy("plSeasonFallOdds", { frost, freeze, n: late.in_ten, days: w.growing_season_days ?? late.days ?? "" })
            : fillCopy("plSeasonFallSeason", { frost, freeze, days: late.days ?? "" });
    }
    return fillCopy("plSeasonWindow", { frost: w.last_frost_p50 ? fmtMonthDay(w.last_frost_p50) : "?", freeze: w.first_freeze_p50 ? fmtMonthDay(w.first_freeze_p50) : "?", days: w.growing_season_days ?? "?" });
}
function memberDensityOf(guild, sid) {
    const mem = (guild.members ?? []);
    const m = mem.find((x) => x.species === sid);
    return typeof m?.planting_density_m2 === "number" ? m.planting_density_m2 : undefined;
}
function planCountLine(inst, guild, bundle, bedArea, filled) {
    if (inst.roles.length)
        return fillCopy("plPlanJobs", { filled, total: inst.roles.length });
    const members = memberSpecies(guild);
    const kinds = members.length;
    if (bedArea == null || bedArea <= 0)
        return fillCopy("plPlanKinds", { kinds });
    const counts = scaledFillCounts(members.map(([sid, group]) => ({ resolved: resolveSpecies(sid, group, bundle), density: memberDensityOf(guild, sid) })), bedArea, kinds);
    return fillCopy("plPlanPlantsKinds", { n: counts.reduce((a, b) => a + b, 0), kinds });
}
function rolePlan(inst, site, guild, bundle, applyWrap = null) {
    const det = document.createElement("details");
    const sum = document.createElement("summary");
    const members = memberSpecies(guild);
    const filled = inst.roles.filter((r) => r.chosen).length;
    sum.className = "roleplansum";
    det.classList.add("disclosure");
    det.appendChild(sum);
    const earlyBed = app.logSnapshot.beds.find((b) => b.name === (document.getElementById("candbed")?.value ?? ""));
    const earlyRegion = planBedRegion(earlyBed);
    const bedAreaEarly = earlyRegion ? plantableArea(earlyRegion, bedStructure(earlyBed, guild), earlyBed?.lane_flip ?? false) : null;
    const nSpeciesEarly = inst.roles.length || members.length;
    const earlyCounts = scaledFillCounts(inst.roles.map((rr) => ({ resolved: resolveSpecies((rr.chosen ?? rr.canonical ?? ""), null, bundle), density: roleDensity(guild, rr.role) })), bedAreaEarly, nSpeciesEarly);
    sum.append(document.createTextNode(planCountLine(inst, guild, bundle, bedAreaEarly, filled)));
    const roleCountById = new Map(inst.roles.map((rr, i) => [rr.role,
        roleLineCount(guild, rr.role, resolveSpecies((rr.chosen ?? rr.canonical ?? ""), null, bundle), earlyCounts[i])]));
    const roleSelects = [];
    for (const rr of inst.roles) {
        const p = document.createElement("p");
        p.className = "role";
        const head = document.createElement("strong");
        const words = roleWords(guild, rr.role);
        if (words) {
            head.appendChild(disclose(roleName(rr.role), () => words, "rolewhy"));
            head.appendChild(document.createTextNode(": "));
        }
        else {
            head.textContent = `${roleName(rr.role)}: `;
        }
        p.appendChild(head);
        const bits = [];
        const asSpecies = (id) => bundle.species.some((sp) => sp.id === id) ? id : null;
        const chosenAt = chosenOptionIndex(rr.options);
        for (const [oi, o] of rr.options.entries()) {
            const name = fillerLabel(bundle, o.filler, o.group);
            if (o.eligible) {
                let s = oi === chosenAt ? `${name}` : fillCopy("plOrName", { name });
                if (oi === chosenAt) {
                    const n = roleCountById.get(rr.role) ?? 1;
                    if (n > 1)
                        s += " " + fillCopy("plPlantN", { n });
                }
                if (o.kind !== "canonical" && o.cost)
                    s += " " + fillCopy("plCostParen", { cost: stripRuleCitations(roleCostText(guild, rr.role, o.cost.trim())) });
                if (o.cost_tags.length)
                    s += ` [${o.cost_tags.map(costTagWord).join(", ")}]`;
                const req = cultivarRequirement(bundle, o.filler);
                if (req)
                    s += " - " + fillCopy("plNeedsCultivar", { cultivar: req.cultivar,
                        reason: stripRuleCitations(corpusText(o.filler, "cultivar_reason", req.reason)) });
                const wait = bearingNote(bundle, o.filler);
                if (wait)
                    s += ` - ${wait}`;
                const cv = cultivarPartner(bundle, o.filler);
                if (cv)
                    s += " - " + fillCopy("plNeedsVarieties", { n: cv, near: fmtLen(15), far: fmtLen(30) });
                if (dioeciousNote(bundle, o.filler))
                    s += ` - ${copy.plNeedsMale}`;
                const inv = invasiveNote(bundle, o.filler);
                if (inv)
                    s += ` - ${inv}`;
                const sched = schedulingNote(bundle, o.filler, o.group ?? null);
                if (sched)
                    s += ` - ${sched}`;
                for (const a of o.advisories ?? [])
                    s += ` - ${reasonText(a.why)}`;
                bits.push({ text: s, species: asSpecies(o.filler), label: name, group: o.group ?? null });
            }
            else {
                const why = o.reasons.map((r) => reasonText(r.why)).join("; ");
                bits.push({ text: `${name} - ${why}`, species: asSpecies(o.filler), label: name, group: o.group ?? null });
            }
        }
        if (!rr.options.length)
            bits.push({ text: rr.optional ? copy.plNoSetPlantOptional : copy.plNoSetPlant, species: null, label: "", group: null });
        if (rr.chosen == null && !rr.optional && rr.options.length)
            bits.push({ text: copy.plNoPlantForJob, species: null, label: "", group: null });
        bits.forEach((b, i) => {
            if (i)
                p.appendChild(document.createTextNode(" · "));
            if (b.species)
                linkNameIn(p, b.text, b.label, b.species, b.group);
            else
                p.appendChild(document.createTextNode(b.text));
        });
        const active = activeBundle(bundle);
        const sub = document.createElement("div");
        sub.className = "subst";
        const sel = document.createElement("select");
        sel.dataset.guild = guild.id;
        sel.dataset.role = rr.role;
        const listed = new Set();
        const fillers = [];
        for (const o of rr.options) {
            const opt = document.createElement("option");
            opt.value = o.filler;
            if (o.group)
                opt.dataset.group = o.group;
            opt.textContent = fillerLabel(active, o.filler, o.group);
            sel.appendChild(opt);
            listed.add(o.filler);
            fillers.push(o.filler);
        }
        for (const sp of active.species) {
            if (!sp.id.startsWith("user:") || listed.has(sp.id))
                continue;
            const opt = document.createElement("option");
            opt.value = sp.id;
            opt.textContent = commonName(active, sp.id);
            sel.appendChild(opt);
            fillers.push(sp.id);
        }
        const optionalSkip = rr.optional && guild.guild_class === "restorative";
        if (optionalSkip) {
            const skip = document.createElement("option");
            skip.value = "";
            skip.textContent = copy.plSkipOptional;
            sel.insertBefore(skip, sel.firstChild);
        }
        if (!fillers.length) {
            const blank = document.createElement("option");
            blank.value = "";
            blank.textContent = copy.plSwapIn;
            sel.appendChild(blank);
            sel.value = "";
        }
        else if (optionalSkip) {
            sel.value = "";
        }
        else {
            sel.value = fillers[0];
        }
        sel.dataset.initSpecies = sel.value;
        sel.dataset.initGroup = sel.selectedOptions[0]?.dataset.group ?? "";
        const restore = fillers.length ? restoreRoleChoice(candbedValue(), guild.id, rr.role) : null;
        if (restore && fillers.includes(restore.species))
            applyRoleChoice(sel, restore.species, restore.group);
        sel.addEventListener("change", () => {
            guildRoleChoices.set(roleChoiceKey(candbedValue(), guild.id, rr.role), { species: sel.value, group: sel.selectedOptions[0]?.dataset.group ?? null });
        });
        const out = document.createElement("span");
        out.className = "hint";
        const renderVerdict = () => {
            if (!sel.value) {
                out.textContent = "";
                out.className = "hint";
                return;
            }
            if (sel.value === rr.canonical) {
                out.textContent = "";
                out.className = "hint";
                return;
            }
            const group = sel.selectedOptions[0]?.dataset.group ?? null;
            const v = substitutionVerdict(guild, rr.role, sel.value, group, site, active);
            const said = substitutionSentence(v, active, guild);
            out.textContent = "";
            linkNamesIn(out, said.text, said.marks);
            out.className = `hint subst-${v.verdict}`;
        };
        sel.addEventListener("change", renderVerdict);
        renderVerdict();
        roleSelects.push(sel);
        sub.append(sel, out);
        p.appendChild(sub);
        det.appendChild(p);
    }
    const chosen = plannedSpecies(inst, guild);
    const chosenIds = chosen.map(([sid]) => sid);
    if (!inst.roles.length && members.length) {
        const p = document.createElement("p");
        p.className = "role";
        p.appendChild(document.createTextNode(copy.plContains));
        members.forEach(([sid, grp], i) => {
            if (i)
                p.appendChild(document.createTextNode(", "));
            p.appendChild(plantLink(plantingLabel(bundle, sid, grp ?? null), sid, grp ?? null));
        });
        det.appendChild(p);
    }
    const h = (tag, cls, text, marks = []) => {
        const el = document.createElement(tag);
        el.className = cls;
        if (marks.length)
            linkNamesIn(el, text, marks);
        else
            el.textContent = text;
        det.appendChild(el);
        return el;
    };
    const w = plantingWindowFor(site.lat ?? null, site.lon ?? null, chosenIds, bundle);
    if (w) {
        const ss = site.lat != null && site.lon != null ? scheduleSite(site.lat, site.lon, bundle) : null;
        h("p", "window", seasonWindowLine(w, ss));
        if (seasonAllYearLine(ss) && ss?.temps === "months_only")
            h("p", "window", copy.anWarmHeld);
        const indoors = earlyBed?.rain === "indoors";
        for (const hw of indoors ? [] : heatWarnings(chosenIds, site.lat ?? null, site.lon ?? null, bundle)) {
            const label = commonName(bundle, hw.species);
            const line = h("p", "heat", "");
            linkNameIn(line, fillCopy("plHeatGap", { name: label, night: fmtTemp(hw.night_c), max: fmtTemp(hw.night_max_c) }), label, hw.species);
            mark(line, { kind: "rule", id: "R-030" });
        }
        for (const bw of indoors ? [] : boltWarnings(chosenIds, site.lat ?? null, site.lon ?? null, bundle)) {
            const label = commonName(bundle, bw.species);
            const line = h("p", "heat", "");
            linkNameIn(line, fillCopy("plBoltMonths", { name: label, months: monthsPhrase(bw.months) }), label, bw.species);
            mark(line, { kind: "rule", id: "R-172" });
        }
        if (!indoors && ss) {
            const rule = warmthFloorRule(bundle);
            const rows = chosen.flatMap(([sid, grp]) => {
                const say = floorSay(warmthFloorFor(ss, grp ? `${sid}/${grp}` : sid, bundle, rule));
                return say ? [{ label: plantingLabel(bundle, sid, grp ?? null), say, sid, grp: grp ?? null }] : [];
            });
            for (const line of floorLines(rows)) {
                const marks = rows.filter((r) => line.toLowerCase().includes(r.label.toLowerCase())).map((r) => ({ label: r.label, species: r.sid, group: r.grp }));
                mark(h("p", "heat", line, marks), { kind: "rule", id: "R-190" });
            }
        }
        const wsite = site.lat != null && site.lon != null ? scheduleSite(site.lat, site.lon, bundle) : null;
        if (wsite) {
            const roofed = earlyBed?.rain === "covered" || earlyBed?.rain === "indoors";
            const lines = waterLines(wsite, bundle, seasonMonths(w.last_frost_p50, w.first_freeze_p50, !w.last_frost_p50 || !w.first_freeze_p50), roofed, indoors);
            if (lines.hot)
                mark(h("p", "water", lines.hot), { kind: "rule", id: "R-175" });
            if (lines.dry)
                mark(h("p", "water", lines.dry), { kind: "rule", id: "R-174" });
            if (roofed && earlyBed && bundle.rules.some((r) => r.id === "R-173")) {
                mark(h("p", "water", fillCopy("plWaterRoofed", { bed: earlyBed.name })), { kind: "rule", id: "R-173" });
            }
        }
    }
    const rows = layoutRows(chosen.map(([sid, group]) => ({ sid, group: group ?? null })), bundle, (r) => r.spread_cm !== null || r.days_to_maturity !== null);
    if (rows.length) {
        const table = document.createElement("table");
        table.className = "spacing";
        table.innerHTML = `<tr><th>${copy.plThSpecies}</th><th>${copy.plThSpread}</th><th>${copy.plThHeight}</th><th>${copy.plThDays}</th></tr>`;
        for (const r of rows) {
            const tr = document.createElement("tr");
            const td = (t) => {
                const c = document.createElement("td");
                c.textContent = t;
                tr.appendChild(c);
            };
            const nameCell = document.createElement("td");
            nameCell.appendChild(plantLink(plantingLabel(bundle, r.species, r.group), r.species, r.group));
            const soft = softFlagWords(r.flags);
            if (soft) {
                const note = document.createElement("span");
                note.className = "spacing-soft";
                note.textContent = soft;
                nameCell.appendChild(note);
            }
            tr.appendChild(nameCell);
            td(r.spread_cm === null ? "-" : fmtCm(r.spread_cm));
            td(r.height_cm === null ? "-" : fmtCm(r.height_cm));
            td(r.days_to_maturity === null ? "-" : `~${r.days_to_maturity}`);
            table.appendChild(tr);
        }
        const scroll = document.createElement("div");
        scroll.className = "tscroll";
        scroll.appendChild(table);
        det.appendChild(scroll);
    }
    const mech = mechanismRows(guild, bundle);
    for (const m of mech.rows) {
        const detail = m.rule && m.rule_mechanism ? ` - ${corpusText(m.rule, "mechanism", m.rule_mechanism)}` : "";
        const el = h("p", "mech", `${plainClaim(stripRuleCitations(teamClaim(guild, m.claim)), gardenLat())}${detail}`);
        const badge = confidenceBadge(m.grade);
        if (badge) {
            el.appendChild(document.createElement("br"));
            el.appendChild(badge);
        }
        if (m.rule)
            mark(el, { kind: "rule", id: m.rule });
        else {
            const none = document.createElement("span");
            none.className = "norule";
            none.textContent = copy.plNoRule;
            el.appendChild(none);
        }
    }
    if (!mech.rows.length && mech.honesty_note)
        h("p", "honesty", stripRuleCitations(corpusText(guild.id, "honesty_note", mech.honesty_note))).dataset.prose = "corpus";
    const gx = guild;
    for (const b of gx.surfaces_beliefs ?? []) {
        const p = h("p", "gbelief", "");
        const a = document.createElement("a");
        a.className = "whytap";
        a.href = `#/why?belief=${b}`;
        a.textContent = copy.plFolkloreDoor;
        markLink(a, { kind: "belief", id: b });
        p.appendChild(a);
    }
    if (gx.planting_source && [...roleCountById.values()].some((n) => (n ?? 0) > 1)) {
        const src = String(gx.planting_source).trim();
        const p = h("p", "gcount", "");
        p.appendChild(disclose(copy.plHowWeCount, () => fillCopy("plCountsFrom", { src })));
    }
    const placeWrap = document.createElement("div");
    placeWrap.className = "placebox";
    const ph = (tag, cls, text, marks = []) => {
        const e = document.createElement(tag);
        e.className = cls;
        if (marks.length)
            linkNamesIn(e, text, marks);
        else
            e.textContent = text;
        placeWrap.appendChild(e);
        return e;
    };
    const memberDensity = (sid) => memberDensityOf(guild, sid);
    const placementChosen = () => {
        if (!inst.roles.length)
            return members.map(([sid, group]) => ({ sid, group, density: memberDensity(sid) }));
        const out = [];
        for (let i = 0; i < roleSelects.length; i++) {
            const sel = roleSelects[i];
            if (!sel.value)
                continue;
            out.push({ sid: sel.value, group: sel.selectedOptions[0]?.dataset.group ?? null, density: roleDensity(guild, inst.roles[i].role), role: inst.roles[i].role });
        }
        return out;
    };
    const roleSwapDeltas = () => {
        const out = [];
        for (let i = 0; i < roleSelects.length; i++) {
            const sel = roleSelects[i];
            if (!sel.value || !inst.roles[i])
                continue;
            const group = sel.selectedOptions[0]?.dataset.group ?? "";
            if (sel.value !== sel.dataset.initSpecies || group !== (sel.dataset.initGroup ?? "")) {
                out.push({ role: inst.roles[i].role, species: sel.value, group: group || null });
            }
        }
        return out;
    };
    const isRadial = guild.ground_entity === "radial_rings";
    const RING_ORDER = ["canopy", "bulb_ring", "mulch_producer", "fixer", "insectary"];
    const MOUND_ROLES = new Set(["support", "fixer"]);
    const MOUND_CAP = { support: 4, fixer: 3 };
    const isHills = laysOutAsHills(guild);
    const isShelter = guild.layout === "shelter";
    const isGrid = !isRadial && !isHills && !isShelter
        && (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle"
            || guild.guild_class === "polyculture" || guild.guild_class === "restorative");
    const isRest = guild.guild_class === "restorative";
    const paintApply = () => {
        if (!applyWrap)
            return;
        applyWrap.innerHTML = "";
        const pa = (text) => {
            const e = document.createElement("p");
            e.className = "hint";
            e.textContent = text;
            applyWrap.appendChild(e);
        };
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        if (!bed) {
            pa(copy.plPickBedFirst);
            return;
        }
        const openSeason$1 = seasonId() != null
            ? openSeason() : null;
        const planted = (openSeason$1?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region));
        const draftedHere = (Array.isArray(openSeason$1?.plan) ? openSeason$1.plan : [])
            .some((e) => e.area === bed.name && e.guild === guild.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary btn-block saveplan primary";
        if (planted) {
            btn.textContent = fillCopy("plBedIsPlanted", { bed: bed.name });
            btn.disabled = true;
        }
        else if (draftedHere) {
            btn.textContent = fillCopy(app.bedPlantWindow?.(bed.name)?.status === "passed" ? "plSavedKept" : "plSavedMarkPlanted", { bed: bed.name });
            btn.disabled = true;
        }
        else if (openSeason$1) {
            btn.textContent = fillCopy("plSaveAsPlan", { bed: bed.name });
            btn.addEventListener("click", () => void savePlanSelection(guild.id, bed.name, btn, bundle, site, roleSwapDeltas()));
        }
        else {
            btn.textContent = fillCopy("plSaveAsPlan", { bed: bed.name });
            btn.addEventListener("click", () => void (async () => {
                btn.disabled = true;
                try {
                    const year = new Date().getFullYear();
                    if (!app.logDb)
                        throw new Error(copy.plLogNotReady);
                    if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
                        await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                    }
                    await app.logRefresh?.();
                    if (seasonId() == null)
                        throw new Error(copy.plSeasonNotOpened);
                    await savePlanSelection(guild.id, bed.name, btn, bundle, site, roleSwapDeltas());
                }
                catch (e) {
                    btn.textContent = `${e instanceof Error ? e.message : e}`;
                    btn.disabled = false;
                }
            })());
        }
        applyWrap.appendChild(btn);
    };
    const paintPlacement = () => {
        placeWrap.innerHTML = "";
        paintApply();
        const chosenNow = placementChosen();
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const region = planBedRegion(bed);
        const treeR = isRadial ? (radialRingsFromFootprint(guild.footprint_min_m2 ?? 0)?.r ?? 0) : 0;
        const keys = layoutKeys(chosenNow);
        const plantRows = layoutRows(chosenNow, bundle);
        if (!(region && site.lat != null && plantRows.length >= (isRest ? 1 : 2)))
            return;
        const r003 = bundle.rules.find((x) => x.id === "R-003");
        const bedArea = plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false);
        const countByKey = new Map();
        const ringByKey = new Map();
        const moundByKey = new Map();
        const moundCapByKey = new Map();
        const roleBySpecies = new Map();
        const counts = scaledFillCounts(chosenNow.map((c) => ({ resolved: resolveSpecies(c.sid, c.group, bundle), density: c.density })), bedArea, chosenNow.length);
        chosenNow.forEach((c, i) => {
            const k = keys[i];
            countByKey.set(k, counts[i]);
            if (c.role)
                roleBySpecies.set(c.sid, c.role);
            if (isRadial) {
                const ri = c.role ? RING_ORDER.indexOf(c.role) : -1;
                ringByKey.set(k, ri >= 0 ? ri : RING_ORDER.length + i);
            }
            if (isHills) {
                moundByKey.set(k, c.role ? MOUND_ROLES.has(c.role) : false);
                if (c.role && MOUND_CAP[c.role])
                    moundCapByKey.set(k, MOUND_CAP[c.role]);
            }
        });
        const layoutKind = isRadial ? "orchard" : isHills ? "hills" : isShelter ? "shelter" : isGrid ? "grid" : "rows";
        const shelteredSet = shelteredChosen(chosenNow, bundle, isShelter);
        const occupied = carriedOccupancy(bed);
        const pl = place(plantRows.map((r) => ({ id: r.key, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countByKey.get(r.key) ?? 1, ring: ringByKey.get(r.key), mound: moundByKey.get(r.key), mound_cap: moundCapByKey.get(r.key), sheltered: shelteredSet.has(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
        unkeyZones(pl.zones, plantRows);
        const bedLabel = bed ? fillCopy("plQuotedBed", { bed: bed.name }) : copy.plYourBed;
        const mounds = pl.mounds ?? [];
        const trees = pl.trees ?? [];
        const ringsGuide = pl.rings_guide ?? [];
        const accessBands = pl.access_bands ?? [];
        const bedOutline = regionPoints(region);
        const introMarks = [];
        const centreWord = (sid) => {
            const habit = sid ? String(resolveSpecies(sid, null, bundle).habit ?? "") : "";
            return { tree: "tree", shrub: "shrub", vine: "vine", cane: "bramble" }[habit] ?? "centre";
        };
        const centre = isRadial ? centreWord(pl.zones[0]?.species) : "centre";
        const centreName = { tree: copy.plCentreTree, shrub: copy.plCentreShrub, vine: copy.plCentreVine, bramble: copy.plCentreBramble }[centre] ?? copy.plCentreCentre;
        const introText = isRadial
            ? (trees.length === 1
                ? (centre === "tree"
                    ? fillCopy("plIntroOneTree", { bed: bedLabel })
                    : fillCopy("plIntroCentred", { bed: bedLabel, centre: centreName }))
                : fillCopy("plIntroOrchard", { bed: bedLabel, n: trees.length, gap: fmtLen(treeR * 2) }))
            : isHills
                ? (() => {
                    const supp = chosenNow.find((c) => c.role === "support");
                    const fix = chosenNow.find((c) => c.role === "fixer");
                    const fixName = fix ? commonName(bundle, fix.sid).toLowerCase() : copy.plClimbers;
                    if (fix)
                        introMarks.push({ label: fixName, species: fix.sid });
                    const suppName = supp && supp.sid !== "trellis_structure" ? commonName(bundle, supp.sid).toLowerCase() : "";
                    if (supp && suppName)
                        introMarks.push({ label: suppName, species: supp.sid });
                    const pair = supp && supp.sid === "trellis_structure"
                        ? fillCopy("plPairTrellis", { fix: fixName })
                        : fillCopy("plPairShare", { support: suppName || copy.plSupportCrop, fix: fixName });
                    return fillCopy(mounds.length === 1 ? "plIntroHillsOne" : "plIntroHillsMany", { bed: bedLabel, n: mounds.length, gap: fmtLen(1), pair });
                })()
                : isShelter
                    ? (() => {
                        const shade = chosenNow.find((c) => c.role === "shade");
                        const shadeName = shade ? commonName(bundle, shade.sid).toLowerCase() : copy.plTheTallCrop;
                        if (shade)
                            introMarks.push({ label: shadeName, species: shade.sid });
                        const tallest = Math.max(0, ...pl.zones.filter((z) => !shelteredSet.has(z.species)).map((z) => z.height_cm ?? 0));
                        const reach = site.lat != null && tallest > 0 ? noonShadowLengthM(tallest, site.lat, referenceDoy(site.lat, site.lon ?? null, bundle)) : 0;
                        const reachText = Number.isFinite(reach) && reach > 0 ? " " + fillCopy("plShadowReach", { len: fmtLen(reach) }) : "";
                        const sunSide = pl.polar === "north" ? "south" : "north";
                        return fillCopy("plIntroShelter", { bed: bedLabel, shade: shadeName, sun: sideWord(sunSide), reach: reachText, polar: sideWord(pl.polar) });
                    })()
                    : isRest
                        ? fillCopy("plIntroRest", { bed: bedLabel })
                        : isGrid
                            ? (pl.zones.some((z) => z.tiled === false)
                                ? fillCopy("plIntroGridBanded", { bed: bedLabel, polar: sideWord(pl.polar) })
                                : fillCopy("plIntroGridMixed", { bed: bedLabel }))
                            : fillCopy("plIntroRows", { bed: bedLabel, polar: sideWord(pl.polar) });
        const introEl = ph("p", "window", introText, introMarks);
        mark(introEl, { kind: "rule", id: isRest ? "R-015" : isShelter ? "R-156" : "R-003" });
        const spreadR = new Map(plantRows.filter((r) => r.spread_cm).map((r) => [r.species, r.spread_cm / 200]));
        const svg = placementSvg(pl.zones, bundle, mounds, bedOutline, ringsGuide, accessBands, spreadR);
        if (svg) {
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", fillCopy("plDrawingAria", { bed: bedLabel }));
            placeWrap.appendChild(svg);
        }
        const opp = pl.polar === "north" ? "south" : "north";
        const colours = zoneColorMap(pl.zones);
        const z0 = isRadial ? pl.zones[0] : undefined;
        const pairAtCentre = !!z0 && roleBySpecies.get(z0.species) === "canopy"
            && centrePair(resolveSpecies(z0.species, z0.group ?? null, bundle));
        pl.zones.forEach((z, i) => {
            if (z.count === 0)
                return;
            const ord = i === 0 ? "" : i === 1 ? copy.plOrd1 : i === 2 ? copy.plOrd2 : i === 3 ? copy.plOrd3 : fillCopy("plOrdN", { n: i });
            const oneTree = trees.length === 1;
            const where = pl.polar === "radial"
                ? (i === 0 ? (centre === "centre" ? copy.plWhereCentre : fillCopy("plWhereCentreOf", { centre: centreName }))
                    : i === pl.zones.length - 1 ? copy.plWhereDripRing
                        : centre === "tree" ? fillCopy("plWhereRingTrunk", { ord }) : fillCopy("plWhereRingCentre", { ord }))
                : pl.polar === "orchard"
                    ? (i === 0 ? (oneTree ? (centre === "tree" ? copy.plWhereCentreTree : fillCopy("plWhereCentreOf", { centre: centreName }))
                        : pairAtCentre ? fillCopy("plWherePairEach", { n: trees.length }) : copy.plWhereEachTree)
                        : i === pl.zones.length - 1 ? (oneTree ? copy.plWhereDripRing : copy.plWhereDripEach)
                            : fillCopy("plWhereRingUnder", { ord }))
                    : pl.polar === "hills"
                        ? (z.mound ? copy.plWhereOnMounds : copy.plWhereGaps)
                        : isShelter
                            ? (shelteredSet.has(z.species) ? fillCopy("plWhereShadeSide", { side: sideWord(pl.polar) }) : fillCopy("plWhereSunSide", { side: sideWord(opp) }))
                            : isRest
                                ? (roleBySpecies.get(z.species) === "fixer" ? copy.plWhereCoverStand : copy.plWhereThroughStand)
                                : isGrid
                                    ? (z.tiled ? copy.plWhereThroughBed : fillCopy("plWhereBanded", { side: sideWord(pl.polar) }))
                                    : (i === 0 ? fillCopy("plWhereSide", { side: sideWord(pl.polar) }) : i === pl.zones.length - 1 ? fillCopy("plWhereSide", { side: sideWord(opp) }) : copy.plWhereMiddle);
            placeWrap.appendChild(placementLine(bundle, z, where, colours.get(z.species), { pair: i === 0 && pairAtCentre }));
        });
        ph("p", "hint", pl.polar === "hills"
            ? copy.plHintHills
            : pl.polar === "orchard"
                ? (pairAtCentre
                    ? (trees.length === 1 ? copy.plHintOrchardPair : fillCopy("plHintOrchardPairMany", { n: trees.length }))
                    : trees.length === 1 ? copy.plHintOrchardOne : fillCopy("plHintOrchardMany", { n: trees.length }))
                : isShelter
                    ? copy.plHintShelter
                    : isRest
                        ? copy.plHintRest
                        : pl.violations.length
                            ? fillCopy("plHintViolations", { n: pl.violations.length })
                            : copy.plHintLooksGood);
    };
    for (const sel of roleSelects)
        sel.addEventListener("change", paintPlacement);
    paintPlacement();
    const lead = livingSupportLead(guild, bundle);
    if (lead) {
        const climber = commonName(bundle, lead.climber), support = commonName(bundle, lead.support);
        const el = h("p", "lead", fillCopy("plSowLead", { climber, days: String(lead.lead_days), support }), [{ label: climber, species: lead.climber }, { label: support, species: lead.support }]);
        mark(el, { kind: "rule", id: lead.rule });
    }
    for (const vn of virusNeighbours(chosenIds.map((species) => ({ species })), plotSiblings(candbedValue()), bundle)) {
        const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
        const mine = list(vn.species.map((id) => commonName(bundle, id).toLowerCase()));
        const theirs = vn.with.map((w) => fillCopy("plBedsPlants", { bed: w.bed, plants: list(w.species.map((id) => commonName(bundle, id).toLowerCase())) })).join(copy.plAndJoin);
        const ids = [...vn.species, ...vn.with.flatMap((w) => w.species)].filter((id, i, arr) => arr.indexOf(id) === i);
        const el = h("p", "lead virusnbr", fillCopy("plVirusCard", { theirs, mine }), ids.map((id) => ({ label: commonName(bundle, id).toLowerCase(), species: id })));
        mark(el, { kind: "rule", id: vn.rule });
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(det);
    if (placeWrap.childNodes.length)
        frag.appendChild(placeWrap);
    return frag;
}
function softFlagWords(flags) {
    const by = { estimated: [], contested: [] };
    for (const f of flags) {
        const [field, tier] = f.split(" ");
        const en = FIELD_ROWS.find(([k]) => k === field)?.[1] ?? humanize(field);
        (by[tier] ?? by.estimated).push(labelCopy(en).toLowerCase());
    }
    const out = [];
    if (by.estimated.length)
        out.push(fillCopy("plSpacingEstimates", { fields: by.estimated.join(", ") }));
    if (by.contested.length)
        out.push(fillCopy("plSpacingContested", { fields: by.contested.join(", ") }));
    return out.join(". ");
}

const NOVELTY_REDIRECT = 0.55;
const ALLIUM_IDS = ["allium_cepa", "allium_sativum", "allium_schoenoprasum",
    "allium_ampeloprasum", "allium_fistulosum"];
const POLLINATOR_ORDER = { very_high: 0, high: 1 };
const WEIGHT = { A: 3, B: 2, C: 1, D: 0, F: 0 };
const ALLIUMS = new Set(ALLIUM_IDS);
function bandOf(score) {
    if (score >= 4)
        return "backed";
    if (score >= 1)
        return "partial";
    return "none";
}
function speciesById(bundle) {
    const m = new Map();
    for (const s of bundle.species)
        m.set(String(s.id), s);
    return m;
}
function rulesFor(roles, present, sp, rules = []) {
    const cat = (i) => String(sp.get(i)?.category ?? "");
    const fruiting = [...present].some((i) => cat(i) === "fruiting_vegetable" || cat(i) === "fruit");
    const hits = new Set();
    if (roles.support === "zea_mays")
        hits.add("R-001");
    if ("bulb_ring" in roles) {
        const centre = roles.canopy;
        const habit = centre ? String(sp.get(centre)?.habit ?? "") : "";
        if (habit === "tree")
            hits.add("R-075");
        else if (habit === "shrub" || habit === "vine")
            hits.add("R-075d");
        if ((habit === "tree" || habit === "shrub" || habit === "vine")
            && roles.bulb_ring === "narcissus_spp")
            hits.add("R-075b");
    }
    if ("masking" in roles
        && [...present].some((i) => String(sp.get(i)?.family ?? "") === "brassicaceae"))
        hits.add("R-050");
    if ("insectary" in roles && fruiting)
        hits.add("R-052");
    if ("cover" in roles)
        hits.add("R-053");
    if ("trap" in roles)
        hits.add("R-143");
    if ("shade" in roles && "bolter" in roles)
        hits.add("R-156");
    if ([...present].some((i) => ALLIUMS.has(i)) && present.has("daucus_carota"))
        hits.add("R-051");
    for (const r of rules) {
        if (!r.shared_regime)
            continue;
        const scope = new Set((r.applies_to?.species) ?? []);
        if (present.size >= 2 && [...present].every((i) => scope.has(i)))
            hits.add(String(r.id));
    }
    return [...hits].sort();
}
function annualPool(bundle, groups = {}) {
    const out = [];
    for (const s of bundle.species) {
        const life = String(resolvedField(s, groups[String(s.id)] ?? null, "lifespan") ?? "");
        if (life !== "annual" && life !== "biennial")
            continue;
        if (s.entity_class === "structure")
            continue;
        if (s.status === "BLACKLISTED")
            continue;
        out.push(String(s.id));
    }
    return out.sort();
}
function missingFacts(site) {
    const hard = [], soft = [];
    if (site.lat == null)
        hard.push({ fact: "location", rules: ["R-076", "R-031", "R-081"] });
    if (!(site.bed_m2 || site.region || site.beds))
        hard.push({ fact: "growing_area", rules: ["R-002", "R-098", "R-042"] });
    if (site.sun == null)
        hard.push({ fact: "sun", rules: ["R-003", "R-004", "R-005"] });
    const empty = (v) => !v
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
    if (empty(site.occupancy) && empty(site.history))
        soft.push({ fact: "rotation_history",
            rules: ["R-010", "R-011", "R-012", "R-013", "R-071", "R-094", "R-095"] });
    const soil = site.soil;
    if (!soil || (typeof soil === "object" && Object.keys(soil).length === 0))
        soft.push({ fact: "soil_test", rules: ["R-017", "R-099", "R-101"] });
    return { hard, soft };
}
function derivedRoles(members, sp) {
    const roles = {};
    const ordered = [...members].sort();
    if (members.includes("zea_mays"))
        roles.support = "zea_mays";
    const anyBrassica = ordered.some((m) => String(sp.get(m)?.family ?? "") === "brassicaceae");
    for (const sid of ordered) {
        const s = sp.get(sid) ?? {};
        const provides = s.support?.provides;
        if (!("support" in roles) && (provides === "weak" || provides === "strong"))
            roles.support = sid;
        if (!("fixer" in roles) && s.n_fixing)
            roles.fixer = sid;
        if (!("cover" in roles) && s.ground_coverage === "high")
            roles.cover = sid;
        if (!("insectary" in roles)
            && (s.pollinator_value === "high" || s.pollinator_value === "very_high"))
            roles.insectary = sid;
        if (!("masking" in roles) && s.volatile_aromatic && anyBrassica)
            roles.masking = sid;
    }
    return roles;
}
function guildFillers(g) {
    const flat = (v) => {
        if (typeof v === "string")
            return [v];
        if (Array.isArray(v))
            return v.flatMap(flat);
        if (v && typeof v === "object")
            return Object.values(v).filter((x) => typeof x === "string");
        return [];
    };
    const out = new Set();
    for (const role of g.roles ?? []) {
        for (const id of flat(role.canonical))
            out.add(id);
        for (const id of flat(role.alternatives))
            out.add(id);
    }
    for (const m of g.members ?? []) {
        out.add(typeof m === "object" && m ? String(m.species) : String(m));
    }
    return out;
}
function noveltyOf(members, roles, bundle) {
    const compRoles = new Set(Object.keys(roles));
    const compSpecies = new Set(members);
    let best = 0.0, who = null;
    for (const g of bundle.guilds) {
        const gspecies = guildFillers(g);
        if (!gspecies.size)
            continue;
        const inter = [...compSpecies].filter((s) => gspecies.has(s)).length;
        const sj = inter / (compSpecies.size + gspecies.size - inter);
        const groles = new Set((g.roles ?? []).map((r) => String(r.id)));
        let sim;
        if (groles.size && compRoles.size) {
            const rinter = [...compRoles].filter((r) => groles.has(r)).length;
            const rj = rinter / (compRoles.size + groles.size - rinter);
            sim = 0.5 * rj + 0.5 * sj;
        }
        else {
            sim = sj;
        }
        if (sim > best) {
            best = sim;
            who = g.id;
        }
    }
    return { nearest: who, similarity: Math.round(best * 10000) / 10000,
        redirect: Boolean(who) && best >= NOVELTY_REDIRECT };
}
function fp(sid, bundle) {
    return circleFootprintM2(resolveSpecies(sid, null, bundle)) ?? 0.0;
}
function compose(site, wants, bundle) {
    const sp = speciesById(bundle);
    const { hard, soft } = missingFacts(site);
    if (hard.length) {
        return { refused: true, missing_facts: hard, disclosures: soft, proposal: [], exclusions: [],
            harmony: { score: 0, band: bandOf(0), rules: [] }, novelty: null };
    }
    const wantSet = new Set(wants);
    const picked = {};
    for (const [w, g] of Object.entries(site.want_groups ?? {}))
        if (wantSet.has(w) && g)
            picked[w] = g;
    const pool = new Set(annualPool(bundle, picked));
    const knownWants = [...wantSet].filter((w) => sp.has(w)).sort();
    const plantable = plantableM2(knownWants.map((w) => ({ species: w })), site, bundle)
        ?? site.bed_m2 ?? 0.0;
    const exclusions = [];
    const eligible = new Set();
    for (const sid of [...new Set([...wantSet, ...pool])].sort()) {
        if (!sp.has(sid)) {
            exclusions.push({ species: sid, rule: null, why: "unknown species" });
            continue;
        }
        if (!pool.has(sid)) {
            if (wantSet.has(sid)) {
                exclusions.push({ species: sid, rule: null,
                    why: "not an annual; composed plantings are annuals-only in v1" });
            }
            continue;
        }
        const reasons = ineligibility(resolveSpecies(sid, picked[sid] ?? null, bundle), {}, site, bundle);
        if (reasons.length) {
            if (wantSet.has(sid)) {
                exclusions.push({ species: sid, rule: (reasons[0].rule ?? null),
                    why: String(reasons[0].why ?? "") });
            }
            continue;
        }
        eligible.add(sid);
    }
    const proposal = [];
    const used = new Set();
    let budget = 0.0;
    const fits = (sid, count) => budget + fp(sid, bundle) * count <= plantable + 1e-9;
    const add = (sid, warrant, count) => {
        if (used.has(sid) || !eligible.has(sid))
            return false;
        const n = count ?? Math.max(1, viabilityFloor(sp.get(sid)));
        if (!fits(sid, n))
            return false;
        proposal.push({ species: sid, count: n, warrant });
        used.add(sid);
        budget += fp(sid, bundle) * n;
        return true;
    };
    const siblings = site.siblings;
    const neighbours = [];
    const region = site.region;
    const adj = (siblings && region)
        ? siblings.filter((sib) => sib.region && adjacent(region, sib.region))
        : [];
    const sibHas = (sib, pred) => (sib.species ?? []).some((sid) => pred((sp.get(sid) ?? {})));
    const isInsectary = (r) => ["high", "very_high"].includes(String(r.pollinator_value ?? ""));
    const isFruiting = (r) => ["fruiting_vegetable", "fruit"].includes(String(r.category ?? ""));
    const fresh = wants.length === 0;
    let freshSignal = null;
    if (fresh) {
        const credit = priorSeasonCredit(site, bundle);
        const thin = credit ? null : thinBreakSuggestion(site, bundle);
        if (credit) {
            const heavies = [...eligible]
                .filter((s) => String(sp.get(s)?.feeder_class ?? "") === "heavy")
                .sort((a, b) => {
                const fa = ["fruiting_vegetable", "fruit"].includes(String(sp.get(a)?.category ?? "")) ? 0 : 1;
                const fb = ["fruiting_vegetable", "fruit"].includes(String(sp.get(b)?.category ?? "")) ? 0 : 1;
                return fa - fb || (a < b ? -1 : a > b ? 1 : 0);
            });
            for (const sid of heavies) {
                if (add(sid, { kind: "ground", rule: "R-015", why: credit.why }, Math.max(1, viabilityFloor(sp.get(sid))))) {
                    freshSignal = "R-015";
                    break;
                }
            }
        }
        else if (thin) {
            let anchored = false;
            if (eligible.has("daucus_carota")) {
                anchored = add("daucus_carota", { kind: "ground", rule: "R-013", why: thin.why });
            }
            for (const a of ALLIUM_IDS) {
                if (add(a, { kind: "ground", rule: "R-013", why: thin.why })) {
                    anchored = true;
                    break;
                }
            }
            if (anchored)
                freshSignal = "R-013";
        }
    }
    for (const sid of [...wantSet].filter((w) => eligible.has(w)).sort()) {
        const floor = viabilityFloor(sp.get(sid));
        if (!add(sid, { kind: "want" }, floor)) {
            exclusions.push({ species: sid, rule: "R-002",
                why: `a viable planting (${floor}) does not fit the bed` });
            if (sid === "zea_mays") {
                const grower = adj.find((sib) => (sib.species ?? []).includes("zea_mays"));
                if (grower) {
                    neighbours.push({ rule: "R-001", kind: "joint_block_possible",
                        detail: { with: grower.name } });
                }
            }
        }
    }
    const wantIds = new Set(proposal.map((p) => p.species));
    const cat = (s) => String(sp.get(s)?.category ?? "");
    const fruitingWant = [...wantIds].sort()
        .find((s) => cat(s) === "fruiting_vegetable" || cat(s) === "fruit") ?? null;
    const brassicaWant = [...wantIds].sort()
        .find((s) => String(sp.get(s)?.family ?? "") === "brassicaceae") ?? null;
    if (wantIds.has("daucus_carota") && ![...wantIds].some((s) => ALLIUMS.has(s))) {
        for (const a of ALLIUM_IDS) {
            if (add(a, { kind: "rule", rule: "R-051", beside: "daucus_carota" }))
                break;
        }
    }
    const pv = (s) => String(sp.get(s)?.pollinator_value ?? "");
    if (fruitingWant && ![...used].some((s) => pv(s) === "high" || pv(s) === "very_high")) {
        const server = adj.find((sib) => sibHas(sib, isInsectary));
        if (server) {
            const sidSrv = (server.species ?? []).find((sid) => isInsectary((sp.get(sid) ?? {})));
            neighbours.push({ rule: "R-052", kind: "served_by_neighbour",
                detail: { from: server.name, species: sidSrv } });
        }
        else {
            const insectaries = [...eligible].filter((s) => !used.has(s))
                .filter((s) => pv(s) === "high" || pv(s) === "very_high")
                .sort((a, b) => (POLLINATOR_ORDER[pv(a)] - POLLINATOR_ORDER[pv(b)]) || (a < b ? -1 : 1));
            for (const c of insectaries) {
                if (add(c, { kind: "rule", rule: "R-052", beside: fruitingWant })) {
                    for (const sib of adj) {
                        if (sibHas(sib, isFruiting) && !sibHas(sib, isInsectary)) {
                            neighbours.push({ rule: "R-052", kind: "serves_neighbour", detail: { to: sib.name } });
                        }
                    }
                    break;
                }
            }
        }
    }
    if (brassicaWant && ![...used].some((s) => Boolean(sp.get(s)?.volatile_aromatic))) {
        const maxH = (s) => {
            const h = sp.get(s)?.mature_height_cm;
            if (Array.isArray(h))
                return h.length ? Math.max(...h.map(Number)) : null;
            return h == null ? null : Number(h);
        };
        const maskers = [...eligible].filter((s) => !used.has(s))
            .filter((s) => Boolean(sp.get(s)?.volatile_aromatic))
            .filter((s) => { const h = maxH(s); return h != null && h <= 60; }).sort();
        for (const c of maskers) {
            if (add(c, { kind: "rule", rule: "R-050", beside: brassicaWant }))
                break;
        }
    }
    if (wantIds.size && ![...used].some((s) => sp.get(s)?.ground_coverage === "high")) {
        const covers = [...eligible].filter((s) => !used.has(s))
            .filter((s) => sp.get(s)?.ground_coverage === "high"
            && sp.get(s)?.habit === "vine" && !sp.get(s)?.casts_shade).sort();
        for (const c of covers) {
            if (add(c, { kind: "rule", rule: "R-053", beside: [...wantIds].sort()[0] }))
                break;
        }
    }
    const prov = (s) => sp.get(s)?.support?.provides;
    const needsSupport = [...used].filter((s) => strongestSupportRequirement(sp.get(s) ?? {}) === "strong").sort();
    const hasProvider = [...used].some((s) => prov(s) === "weak" || prov(s) === "strong");
    if (needsSupport.length && !hasProvider && !used.has("trellis_structure")) {
        proposal.push({ species: "trellis_structure", count: 1,
            warrant: { kind: "structure", rule: "R-040", for: needsSupport[0] } });
        used.add("trellis_structure");
    }
    const wn = (sid) => String(sp.get(sid)?.water_need ?? "");
    const steadySeated = [...used].filter((sid) => wn(sid) === "steady").sort();
    const lowsWanted = [...wantSet].filter((sid) => sp.has(sid) && wn(sid) === "low").sort();
    let split;
    if (steadySeated.length && lowsWanted.length) {
        for (const sid of lowsWanted) {
            if (used.has(sid)) {
                for (let i = proposal.length - 1; i >= 0; i--)
                    if (proposal[i].species === sid)
                        proposal.splice(i, 1);
                used.delete(sid);
            }
        }
        split = { rule: "R-142", low: lowsWanted, steady: steadySeated, team: "dry_herb_bed" };
    }
    const members = [...used].sort();
    const roles = derivedRoles(members, sp);
    const fired = rulesFor(roles, new Set(members), sp, bundle.rules);
    const gradeOf = new Map(bundle.rules
        .map((r) => [String(r.id), String(r.grade ?? "")]));
    const score = fired.reduce((acc, rid) => acc + (WEIGHT[gradeOf.get(rid) ?? ""] ?? 0), 0);
    const harmony = { score, band: bandOf(score), rules: fired };
    const nov = members.length ? noveltyOf(members, roles, bundle) : null;
    if (fresh && siblings) {
        const FAMILY_RULE = familyRotationRule(bundle);
        const seenFams = new Set();
        for (const p of proposal) {
            const fam = String(sp.get(p.species)?.family ?? "");
            const rid = FAMILY_RULE[fam];
            if (!rid || seenFams.has(fam))
                continue;
            const withs = siblings
                .filter((sib) => (sib.species ?? []).some((sid) => String(sp.get(sid)?.family ?? "") === fam))
                .map((sib) => sib.name).sort();
            if (withs.length) {
                seenFams.add(fam);
                neighbours.push({ rule: rid, kind: "forward_foreclosure",
                    detail: { family: fam, with: withs } });
            }
        }
    }
    const R111_FAMILIES = new Set(["solanaceae", "cucurbitaceae", "brassicaceae"]);
    const seenPatch = new Set();
    for (const p of proposal) {
        const fam = String(sp.get(p.species)?.family ?? "");
        if (!R111_FAMILIES.has(fam) || seenPatch.has(fam))
            continue;
        const withs = adj
            .filter((sib) => (sib.species ?? []).some((sid) => String(sp.get(sid)?.family ?? "") === fam))
            .map((sib) => sib.name).sort();
        if (withs.length) {
            seenPatch.add(fam);
            neighbours.push({ rule: "R-111", kind: "same_family_patch",
                detail: { family: fam, with: withs } });
        }
    }
    if (siblings) {
        const wantGroups = site.want_groups ?? {};
        const firstGroup = (sid) => {
            const g = resolveSpecies(sid, null, bundle).cultivar_group;
            return typeof g === "string" ? g : null;
        };
        for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
            const t = (r.trigger ?? {});
            if (t.kind !== "cultivar_group_isolation" || !t.species)
                continue;
            const target = t.species;
            if (!proposal.some((p) => p.species === target))
                continue;
            const mine = wantGroups[target] ?? firstGroup(target);
            const withs = [];
            for (const sib of siblings) {
                for (const m of sib.members ?? []) {
                    if (m.species !== target)
                        continue;
                    const theirs = m.group ?? firstGroup(target);
                    if (theirs && mine && theirs !== mine && !withs.some((w) => w.bed === sib.name && w.group === theirs)) {
                        withs.push({ bed: sib.name, group: theirs });
                    }
                }
            }
            if (withs.length)
                neighbours.push({ rule: r.id, kind: "kinds_across_beds", detail: { species: target, mine, with: withs } });
        }
    }
    const out = { refused: false, missing_facts: [], disclosures: soft, proposal, exclusions,
        harmony, novelty: nov };
    if (siblings !== undefined)
        out.neighbours = neighbours;
    if (split)
        out.split = split;
    if (fresh) {
        out.fresh = { signal: freshSignal,
            note: freshSignal ? null
                : "nothing to compose FROM yet - this ground carries no signal (no banked "
                    + "nitrogen, no rotation load to break). Pick a plant to build around, or "
                    + "plant a named team." };
    }
    return out;
}

const rotPt = (dx, dy, aDeg) => {
    const t = (aDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return [dx * c - dy * s, dx * s + dy * c];
};
const rectCorners = (cx, cy, w, l, aDeg) => [[-w / 2, l / 2], [w / 2, l / 2], [w / 2, -l / 2], [-w / 2, -l / 2]].map(([dx, dy]) => {
    const r = rotPt(dx, dy, aDeg);
    return [cx + r[0], cy + r[1]];
});
function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}
function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToPolygon(x, y, poly) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        best = Math.min(best, distToSeg(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    }
    return best;
}
function coastFrames(vx, vy, decay = 0.92, minStep = 0.3, cap = 90) {
    const out = [];
    let x = vx, y = vy;
    while (out.length < cap && Math.hypot(x, y) >= minStep) {
        out.push([x, y]);
        x *= decay;
        y *= decay;
    }
    return out;
}

const CANVAS_CELL_M = 0.30;
const HISTORY_MAX = 30;
const COALESCE_MS = 1500;
const stateSig = (c) => JSON.stringify([c.members, c.tokens]);
const recordHistory = (c, coalesceKey) => {
    const now = stateSig(c);
    if (c.lastSig != null && c.lastSig !== now && !c.restoring) {
        const cont = coalesceKey != null && c.coalesce?.key === coalesceKey && (Date.now() - c.coalesce.t) < COALESCE_MS;
        if (!cont) {
            const prev = JSON.parse(c.lastSig);
            (c.history ??= []).push({ members: prev[0], tokens: prev[1] });
            if (c.history.length > HISTORY_MAX)
                c.history.shift();
            c.future = [];
        }
    }
    c.coalesce = coalesceKey != null ? { key: coalesceKey, t: Date.now() } : undefined;
    c.restoring = false;
    c.lastSig = now;
};
let canvasZoom = 1;
const myBedConfigs = new Map();
let provisionalMyBed = null;
let pickOrderSnapshot = null;
const newMyBedState = () => ({ members: [], tokens: [], tokenSig: "", baseline: null, optimized: false, reseeded: false });
function activeMyBed() {
    const sel = document.getElementById("candbed");
    if (!sel || !sel.options.length) {
        if (!provisionalMyBed)
            provisionalMyBed = newMyBedState();
        return provisionalMyBed;
    }
    const key = sel.value;
    if (provisionalMyBed) {
        const held = provisionalMyBed;
        provisionalMyBed = null;
        if (held.members.length) {
            const existing = myBedConfigs.get(key);
            if (!existing || !existing.members.length)
                myBedConfigs.set(key, held);
        }
    }
    let cfg = myBedConfigs.get(key);
    if (!cfg) {
        cfg = newMyBedState();
        myBedConfigs.set(key, cfg);
    }
    return cfg;
}
const cloneMembers = (ms) => ms.map((m) => ({ ...m }));
const cloneTokens = (ts) => ts.map((t) => ({ ...t }));
const myBedEdited = () => { const c = activeMyBed(); c.optimized = false; c.baseline = null; c.tokenSig = ""; };
const myBedMemberCount = () => activeMyBed().members.reduce((n, m) => n + (m.count ?? 1), 0);
function bedGrid(region) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const w = x1 - x0, h = y1 - y0;
    const cols = Math.max(1, Math.min(24, Math.round(w / CANVAS_CELL_M)));
    const rows = Math.max(1, Math.min(24, Math.round(h / CANVAS_CELL_M)));
    return { x0, y0, x1, y1, w, h, cols, rows, cellW: w / cols, cellH: h / rows };
}
function seatTokens(pl, grid, groupOf, blocked) {
    const out = [];
    const loC = 0.5, hiC = grid.cols - 0.5, loR = 0.5, hiR = grid.rows - 0.5;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const clear = (col, row) => {
        if (!blocked?.(col, row))
            return [col, row];
        for (let rad = 0.25; rad <= grid.cols + grid.rows; rad += 0.25) {
            for (let dc = -rad; dc <= rad; dc += 0.25)
                for (let dr = -rad; dr <= rad; dr += 0.25) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad)
                        continue;
                    const c = clamp(col + dc, loC, hiC), r = clamp(row + dr, loR, hiR);
                    if (!blocked(c, r))
                        return [c, r];
                }
        }
        return [col, row];
    };
    for (const z of pl.zones) {
        for (const pc of z.plants) {
            const col = clamp((pc.x - grid.x0) / grid.cellW, loC, hiC);
            const row = clamp((grid.y1 - pc.y) / grid.cellH, loR, hiR);
            const [c, r] = clear(col, row);
            out.push({ species: z.species, group: groupOf.get(z.species) ?? null, col: c, row: r });
        }
    }
    return out;
}
function tokenSignature(members, grid) {
    return members.map((m) => `${m.species}:${m.count ?? 1}`).sort().join(",") + `|${grid ? `${grid.cols}x${grid.rows}` : "-"}`;
}
function reseedBedFromOccupancy(bed, region, myBed) {
    if (myBed.members.length)
        return;
    const seasonId$1 = seasonId();
    if (seasonId$1 == null)
        return;
    const season = seasonById(seasonId$1) ?? undefined;
    let onBed = (season?.plantings ?? []).filter((p) => !p.end_cause && p.carried_over !== true && plantingOnBed(p.region, bed.region));
    if (!onBed.length) {
        const bedName = bed.name;
        const draft = bedName ? (Array.isArray(season?.plan) ? season.plan : [])
            .find((e) => e.area === bedName) : undefined;
        if (draft?.mybed === true && Array.isArray(draft.plantings)) {
            onBed = draft.plantings.filter((p) => plantingOnBed(p.region, bed.region));
        }
    }
    const savedSupports = bed.supports ?? [];
    if (!onBed.length) {
        if (savedSupports.length)
            myBed.members = savedSupports.map((s) => ({ species: s.id, count: 1 }));
        return;
    }
    const grid = bedGrid(region);
    const bedO = bedOrientation(bed);
    const toFrame = bedO
        ? (px, py) => {
            const t = -bedO.orient.residual_deg * Math.PI / 180;
            const c = Math.cos(t), s = Math.sin(t);
            const ux = px - bedO.cx, uy = py - bedO.cy;
            return [ux * c - uy * s + bedO.orient.eff_w / 2, ux * s + uy * c + bedO.orient.eff_l / 2];
        }
        : (px, py) => [px, py];
    const clamp = (v, hi) => Math.min(hi, Math.max(0, v));
    const members = [];
    const byKey = new Map();
    const tokens = [];
    for (const p of onBed) {
        const [cx, cy] = regionCentroid(p.region);
        const [fx, fy] = toFrame(cx, cy);
        const group = p.cultivar_group ?? null;
        tokens.push({
            species: p.species,
            group,
            col: clamp((fx - grid.x0) / grid.cellW, grid.cols),
            row: clamp((grid.y1 - fy) / grid.cellH, grid.rows),
        });
        const k = `${p.species}|${group ?? ""}`;
        const m = byKey.get(k);
        if (m)
            m.count = (m.count ?? 1) + 1;
        else {
            const nm = { species: p.species, count: 1, ...(group ? { group } : {}) };
            byKey.set(k, nm);
            members.push(nm);
        }
    }
    for (const sup of savedSupports) {
        if (!members.some((m) => m.species === sup.id))
            members.push({ species: sup.id, count: 1 });
    }
    myBed.members = members;
    myBed.tokens = tokens;
    myBed.tokenSig = tokenSignature(members, grid);
    myBed.baseline = null;
    myBed.optimized = false;
}
function bedOccupancyComposition(bedRegion) {
    const m = new Map();
    const season = openSeason();
    for (const p of season?.plantings ?? []) {
        if (p.end_cause || p.carried_over === true || !plantingOnBed(p.region, bedRegion))
            continue;
        const k = `${p.species}|${p.cultivar_group ?? ""}`;
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
}
function draftComposition(members) {
    const m = new Map();
    for (const mm of members) {
        const k = `${mm.species}|${mm.group ?? ""}`;
        m.set(k, (m.get(k) ?? 0) + (mm.count ?? 1));
    }
    return m;
}
function compositionsEqual(a, b) {
    return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
}
function composedGroup(members, species) {
    return members.find((m) => m.species === species)?.group ?? null;
}
function adoptComposed(members, proposal, known) {
    const placed = proposal.filter((p) => known(p.species))
        .map((p) => ({ species: p.species, group: composedGroup(members, p.species), count: p.count }));
    const kept = members.filter((m) => !placed.some((p) => p.species === m.species)).map((m) => ({ ...m }));
    return [...placed, ...kept];
}
function exclusionWords(why) {
    return /^not an annual\b/i.test(why.trim()) ? copy.plComposeStaysAsIs : reasonText(why);
}
function composedTest(bed) {
    if (bed.composed !== true)
        return false;
    const kept = new Set(bed.composedKept ?? []);
    return (species) => !kept.has(species);
}
async function saveMyBedPlantings(tokens, grid, toWorld, seasonId, bedRegion, bedName, groupBySpecies, composed = false, supportIds = [], asDraft = false) {
    const db = await openLog();
    const season = await getSeason(db, app.currentPlotId, seasonId);
    if (!season)
        throw new Error(copy.plSeasonNotOpenErr);
    const today = localTodayIso();
    const newPlantings = tokens.map((t) => {
        const x0 = grid.x0 + (t.col - 0.5) * grid.cellW, y0 = grid.y1 - (t.row + 0.5) * grid.cellH;
        const cellRegion = toWorld
            ? { shape: "polygon",
                points: [[x0, y0 + grid.cellH], [x0 + grid.cellW, y0 + grid.cellH],
                    [x0 + grid.cellW, y0], [x0, y0]].map(([px, py]) => {
                    const [wx, wy] = toWorld(px, py);
                    return [wx, wy];
                }) }
            : { shape: "rect", x: x0, y: y0, w: grid.cellW, h: grid.cellH };
        const grp = groupBySpecies.get(t.species) ?? t.group ?? null;
        return { species: t.species, ...(grp ? { cultivar_group: grp } : {}), region: cellRegion,
            ...(asDraft ? {} : { sown: today }),
            ...((typeof composed === "function" ? composed(t.species) : composed) ? { composed: true } : {}) };
    });
    const planLessBed = (Array.isArray(season.plan) ? season.plan : []).filter((e) => e.area !== bedName);
    let updated;
    if (asDraft) {
        updated = await putSeason(db, { ...season, plan: [...planLessBed, { area: bedName, mybed: true, plantings: newPlantings }] });
    }
    else {
        const { rest: kept, merged } = mergeSurvivingDetail(season.plantings ?? [], newPlantings, bedRegion);
        updated = await putSeason(db, { ...season, plantings: [...kept, ...merged], plan: planLessBed });
    }
    const supports = supportIds.map((id) => ({ id }));
    const plot = await getPlot(db, app.currentPlotId);
    if (plot) {
        const bi = (plot.beds ?? []).findIndex((b) => b.name === bedName);
        if (bi >= 0) {
            const cur = plot.beds[bi].supports ?? [];
            const changed = JSON.stringify(cur) !== JSON.stringify(supports);
            if (changed) {
                if (supports.length)
                    plot.beds[bi].supports = supports;
                else
                    delete plot.beds[bi].supports;
                await putPlot(db, plot);
                const lb = app.logSnapshot.beds.find((b) => b.name === bedName);
                if (lb) {
                    if (supports.length)
                        lb.supports = supports;
                    else
                        delete lb.supports;
                }
            }
        }
    }
    window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: bedName, kind: "team" } }));
    upsertSeasonSnapshot(updated);
    return newPlantings.length;
}
function myBedCanvas(grid, bundle, fb, tokens) {
    const host = document.getElementById("mybedresult");
    let avail = 240, between = 0;
    const px = (v) => parseFloat(v) || 0;
    for (let el = host; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        const pad = px(cs.paddingLeft) + px(cs.paddingRight);
        if (el.clientWidth > 0) {
            avail = el.clientWidth - pad - between;
            break;
        }
        between += pad + px(cs.borderLeftWidth) + px(cs.borderRightWidth) + px(cs.marginLeft) + px(cs.marginRight);
    }
    const PX = Math.max(240, Math.min(480, avail)) * canvasZoom;
    const scale = PX / Math.max(grid.w, grid.h, 0.1);
    const W = grid.w * scale, H = grid.h * scale;
    const cw = grid.cellW * scale, ch = grid.cellH * scale;
    const rotDeg = -(fb.rotationDeg ?? 0);
    const th = rotDeg * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    const BW = Math.abs(W * ct) + Math.abs(H * st), BH = Math.abs(W * st) + Math.abs(H * ct);
    const ox = BW / 2, oy = BH / 2;
    const wrap = document.createElement("div");
    wrap.className = "canvaswrap";
    const svg = document.createElementNS(SVG_NS$2, "svg");
    svg.setAttribute("class", "fit canvasbed");
    svg.setAttribute("width", String(Math.round(BW)));
    svg.setAttribute("height", String(Math.round(BH)));
    svg.setAttribute("viewBox", `0 0 ${svgNumber(BW)} ${svgNumber(BH)}`);
    svg.style.touchAction = "none";
    wrap.appendChild(svg);
    const content = document.createElementNS(SVG_NS$2, "g");
    content.setAttribute("transform", `translate(${svgNumber(ox)} ${svgNumber(oy)}) rotate(${svgNumber(rotDeg)}) translate(${svgNumber(-W / 2)} ${svgNumber(-H / 2)})`);
    svg.appendChild(content);
    const status = document.createElement("p");
    wrap.appendChild(status);
    const colourOf = gardenColours();
    const colours = new Map();
    for (const t of tokens)
        if (!colours.has(t.species))
            colours.set(t.species, colourOf(t.species));
    let closest = Infinity;
    for (let i = 0; i < tokens.length; i++)
        for (let j = i + 1; j < tokens.length; j++) {
            const dx = (tokens[i].col - tokens[j].col) * cw, dy = (tokens[i].row - tokens[j].row) * ch;
            const d = dx * dx + dy * dy;
            if (d < closest)
                closest = d;
        }
    const rr = Math.max(1.5, Math.min(Math.min(cw, ch) * 0.44, closest === Infinity ? Infinity : Math.sqrt(closest) * 0.47));
    const MIN_GRAB = 9;
    const MAX_DOT = Math.min(cw, ch) * 1.25;
    const radiusCache = new Map();
    const dotRadius = (sid) => {
        const hit = radiusCache.get(sid);
        if (hit !== undefined)
            return hit;
        let ms = resolveSpecies(sid, null, bundle).mature_spread_cm;
        if (Array.isArray(ms))
            ms = ms[ms.length - 1];
        const cm = typeof ms === "number" && ms > 0 ? ms : null;
        const r = cm === null ? rr : Math.max(MIN_GRAB, Math.min(MAX_DOT, (cm / 100 / 2) * scale));
        radiusCache.set(sid, r);
        return r;
    };
    const outline = fb.polygon
        ? fb.polygon.map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale])
        : null;
    const inside = (col, row) => !outline || pointInPolygon(col * cw, row * ch, outline);
    const occPolys = (fb.occupied ?? []).map((r) => regionPoints(r).map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale]));
    const occAt = (col, row) => occPolys.some((poly) => pointInPolygon(col * cw, row * ch, poly));
    const lanePolys = (fb.laneBands ?? []).map((poly) => poly.map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale]));
    const laneAt = (col, row) => lanePolys.some((poly) => pointInPolygon(col * cw, row * ch, poly));
    const freeGround = (col, row) => inside(col, row) && !occAt(col, row) && !laneAt(col, row);
    const snapValid = (nc, nr, selfIdx) => {
        const loC = 0.5, hiC = grid.cols - 0.5, loR = 0.5, hiR = grid.rows - 0.5;
        const c0 = Math.max(loC, Math.min(hiC, nc)), r0 = Math.max(loR, Math.min(hiR, nr));
        const taken = new Set();
        tokens.forEach((t, i) => { if (i !== selfIdx)
            taken.add(`${t.col},${t.row}`); });
        const ok = (c, r) => freeGround(c, r) && !taken.has(`${c},${r}`);
        if (ok(c0, r0))
            return [c0, r0];
        let best = null, bestD = Infinity;
        for (let k = 1; k <= (grid.cols + grid.rows) * 2 && !best; k++) {
            const step = k * 0.5;
            for (let dc = -step; dc <= step; dc += 0.5) {
                for (let dr = -step; dr <= step; dr += 0.5) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== step)
                        continue;
                    const c = c0 + dc, r = r0 + dr;
                    if (c < loC || c > hiC || r < loR || r > hiR || !ok(c, r))
                        continue;
                    const d = dc * dc + dr * dr;
                    if (d < bestD) {
                        bestD = d;
                        best = [c, r];
                    }
                }
            }
        }
        return best ?? [c0, r0];
    };
    if (outline || occPolys.length)
        tokens.forEach((t, i) => { if (!freeGround(t.col, t.row)) {
            const [c, r] = snapValid(t.col, t.row, i);
            t.col = c;
            t.row = r;
        } });
    const line = (x1, y1, x2, y2) => {
        const l = document.createElementNS(SVG_NS$2, "line");
        l.setAttribute("x1", String(x1));
        l.setAttribute("y1", String(y1));
        l.setAttribute("x2", String(x2));
        l.setAttribute("y2", String(y2));
        l.setAttribute("class", "gridline");
        content.appendChild(l);
    };
    const offenders = () => {
        const bad = new Set();
        if (fb.lat == null)
            return bad;
        const layout = tokens.map((t, i) => {
            const bx = grid.x0 + t.col * grid.cellW;
            const by = grid.y1 - t.row * grid.cellH;
            const [x, y] = fb.toWorld ? fb.toWorld(bx, by) : [bx, by];
            return { id: `${t.species}#${i}`, x, y, height_cm: fb.heightOf.get(t.species) ?? 0,
                sheltered: fb.sheltered?.has(t.species) ?? false };
        });
        for (const v of heightOrderingViolations(layout, fb.thresholdCm, fb.lat)) {
            const i = Number(String(v.tall).split("#")[1]);
            if (!Number.isNaN(i))
                bad.add(i);
        }
        return bad;
    };
    const humanPos = (col, row) => {
        const ns = row < grid.rows / 3 ? "north" : row > grid.rows * 2 / 3 ? "south" : "";
        const ew = col < grid.cols / 3 ? "west" : col > grid.cols * 2 / 3 ? "east" : "";
        return [ns, ew].filter(Boolean).map(sideWord).join("-") || copy.plPosCentre;
    };
    const tokenLabel = (t, bad) => fillCopy("plTokenPos", { plant: plantingLabel(bundle, t.species, t.group), pos: humanPos(t.col, t.row) })
        + (bad ? copy.plTokenShading : "")
        + (fb.onMove ? copy.plTokenArrows : "")
        + (fb.onRemove ? (fb.onMove ? copy.plTokenDeleteAnd : copy.plTokenDelete) : "");
    const draw = () => {
        while (content.firstChild)
            content.removeChild(content.firstChild);
        if (outline || occPolys.length) {
            for (let c = 0; c < grid.cols; c++)
                for (let r = 0; r < grid.rows; r++) {
                    const off = !inside(c + 0.5, r + 0.5);
                    const occ = !off && occAt(c + 0.5, r + 0.5);
                    if (!off && !occ)
                        continue;
                    const cell = document.createElementNS(SVG_NS$2, "rect");
                    cell.setAttribute("x", String(svgNumber(c * cw)));
                    cell.setAttribute("y", String(svgNumber(r * ch)));
                    cell.setAttribute("width", String(svgNumber(cw)));
                    cell.setAttribute("height", String(svgNumber(ch)));
                    cell.setAttribute("class", off ? "celloff" : "cellocc");
                    if (occ) {
                        const ti = document.createElementNS(SVG_NS$2, "title");
                        ti.textContent = copy.plCellHeld;
                        cell.appendChild(ti);
                    }
                    content.appendChild(cell);
                }
        }
        let bed;
        if (outline) {
            bed = document.createElementNS(SVG_NS$2, "polygon");
            bed.setAttribute("points", outline.map(([x, y]) => `${svgNumber(x)},${svgNumber(y)}`).join(" "));
        }
        else {
            bed = document.createElementNS(SVG_NS$2, "rect");
            bed.setAttribute("x", "0");
            bed.setAttribute("y", "0");
            bed.setAttribute("width", String(W));
            bed.setAttribute("height", String(H));
        }
        bed.setAttribute("class", "bed");
        content.appendChild(bed);
        for (const poly of lanePolys) {
            const lane = document.createElementNS(SVG_NS$2, "polygon");
            lane.setAttribute("points", poly.map(([x, y]) => `${svgNumber(x)},${svgNumber(y)}`).join(" "));
            lane.setAttribute("class", "placelane");
            content.appendChild(lane);
        }
        for (const sup of fb.supports ?? []) {
            const lenPx = Math.min(W, sup.length_m * scale);
            const x0 = (W - lenPx) / 2;
            const y = sup.edge === "north" ? ch * 0.3 : H - ch * 0.3;
            const bar = document.createElementNS(SVG_NS$2, "rect");
            bar.setAttribute("x", String(svgNumber(x0)));
            bar.setAttribute("y", String(svgNumber(y - 2)));
            bar.setAttribute("width", String(svgNumber(lenPx)));
            bar.setAttribute("height", "4");
            bar.setAttribute("class", "supportbar");
            const cap = document.createElementNS(SVG_NS$2, "title");
            cap.textContent = fillCopy("plSupportAlong", { name: commonName(bundle, sup.id), edge: sideWord(sup.edge) });
            bar.appendChild(cap);
            content.appendChild(bar);
            const lbl = document.createElementNS(SVG_NS$2, "text");
            lbl.setAttribute("x", String(svgNumber(x0 + lenPx / 2)));
            lbl.setAttribute("y", String(svgNumber(sup.edge === "north" ? y + 12 : y - 7)));
            lbl.setAttribute("class", "supportbarlabel");
            lbl.setAttribute("text-anchor", "middle");
            lbl.textContent = commonName(bundle, sup.id);
            content.appendChild(lbl);
        }
        for (let c = 1; c < grid.cols; c++)
            line(c * cw, 0, c * cw, H);
        for (let r = 1; r < grid.rows; r++)
            line(0, r * ch, W, r * ch);
        const paintOrder = tokens.map((_, i) => i)
            .sort((a, b) => dotRadius(tokens[b].species) - dotRadius(tokens[a].species));
        paintOrder.forEach((i) => {
            const t = tokens[i];
            const c = document.createElementNS(SVG_NS$2, "circle");
            c.setAttribute("cx", String(svgNumber(t.col * cw)));
            c.setAttribute("cy", String(svgNumber(t.row * ch)));
            c.setAttribute("r", String(svgNumber(dotRadius(t.species))));
            c.style.fill = colours.get(t.species);
            c.setAttribute("fill-opacity", "0.6");
            c.setAttribute("data-species", t.species);
            c.setAttribute("class", "canvastoken");
            c.dataset.i = String(i);
            if (fb.onMove || fb.onRemove) {
                c.setAttribute("tabindex", "0");
                c.setAttribute("role", "button");
            }
            c.appendChild(document.createElementNS(SVG_NS$2, "title"));
            content.appendChild(c);
        });
        restyle();
    };
    const restyle = () => {
        const bad = offenders();
        content.querySelectorAll("circle.canvastoken").forEach((c) => {
            const i = Number(c.dataset.i);
            const t = tokens[i];
            const col = colours.get(t.species);
            const isBad = bad.has(i);
            c.style.stroke = isBad ? "#dc2626" : col;
            c.setAttribute("stroke-width", isBad ? "2.5" : "1");
            c.setAttribute("class", isBad ? "canvastoken shade-bad" : "canvastoken");
            if (c.getAttribute("tabindex") !== null)
                c.setAttribute("aria-label", tokenLabel(t, isBad));
            const title = c.querySelector("title");
            if (title)
                title.textContent = `${plantingLabel(bundle, t.species, t.group)}${isBad ? copy.plTokenShadeTitle : ""}`;
        });
        const n = bad.size;
        status.className = n ? "why" : "hint";
        status.textContent = fb.lat == null
            ? ""
            : n
                ? fillCopy(n === 1 ? "plShadeWarnOne" : "plShadeWarnMany", { n, side: sideWord(fb.polar) })
                : copy.plNothingShades;
    };
    draw();
    let active = null;
    let downAt = null;
    const toSvg = (e) => {
        const rect = svg.getBoundingClientRect();
        const vx = (e.clientX - rect.left) * (BW / rect.width) - ox;
        const vy = (e.clientY - rect.top) * (BH / rect.height) - oy;
        return [ct * vx + st * vy + W / 2, -st * vx + ct * vy + H / 2];
    };
    svg.addEventListener("pointerdown", (e) => {
        const el = e.target;
        if (!(el instanceof SVGCircleElement) || el.dataset.i === undefined)
            return;
        active = Number(el.dataset.i);
        downAt = toSvg(e);
        svg.setPointerCapture(e.pointerId);
        el.classList.add("dragging");
        e.preventDefault();
    });
    svg.addEventListener("pointermove", (e) => {
        if (active === null)
            return;
        const [sx, sy] = toSvg(e);
        const el = svg.querySelector(`circle[data-i="${active}"]`);
        if (el) {
            el.setAttribute("cx", String(Math.max(0, Math.min(W, sx))));
            el.setAttribute("cy", String(Math.max(0, Math.min(H, sy))));
        }
    });
    const drop = (e) => {
        if (active === null)
            return;
        const [sx, sy] = toSvg(e);
        const tapped = fb.onRemove && downAt !== null
            && Math.hypot(sx - downAt[0], sy - downAt[1]) < Math.min(cw, ch) / 3;
        if (tapped) {
            const i = active;
            active = null;
            downAt = null;
            fb.onRemove(i);
            return;
        }
        const rc = Math.round((sx / cw) * 2) / 2, rr2 = Math.round((sy / ch) * 2) / 2;
        const [nc, nr] = snapValid(rc, rr2, active);
        const moved = tokens[active].col !== nc || tokens[active].row !== nr;
        tokens[active].col = nc;
        tokens[active].row = nr;
        active = null;
        downAt = null;
        draw();
        if (moved)
            fb.onMove?.();
    };
    const cancel = () => {
        if (active === null)
            return;
        active = null;
        draw();
    };
    svg.addEventListener("pointerup", drop);
    svg.addEventListener("pointercancel", cancel);
    const STEP = 0.5;
    const NUDGE = {
        ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP],
    };
    svg.addEventListener("keydown", (e) => {
        const el = e.target;
        if (!(el instanceof SVGCircleElement) || el.dataset.i === undefined)
            return;
        const i = Number(el.dataset.i);
        const d = NUDGE[e.key];
        if (d && fb.onMove) {
            const [nc, nr] = snapValid(tokens[i].col + d[0], tokens[i].row + d[1], i);
            const moved = tokens[i].col !== nc || tokens[i].row !== nr;
            tokens[i].col = nc;
            tokens[i].row = nr;
            el.setAttribute("cx", String(svgNumber(nc * cw)));
            el.setAttribute("cy", String(svgNumber(nr * ch)));
            restyle();
            if (moved)
                fb.onMove(`nudge:${i}`);
            e.preventDefault();
            return;
        }
        if ((e.key === "Delete" || e.key === "Backspace" || e.key === "Enter" || e.key === " ") && fb.onRemove) {
            fb.onRemove(i);
            e.preventDefault();
        }
    });
    return wrap;
}
function renderMyBed(bundle, site) {
    const q = $$3("mybedq");
    const listBox = $$3("mybedlist");
    const countLine = $$3("mybedcount");
    const memberBox = $$3("mybedmembers");
    const resultBox = $$3("mybedresult");
    if (!q || !listBox || !countLine || !memberBox || !resultBox)
        return;
    const mybed = $$3("mybed");
    const noBed = app.logHydrated && app.logSnapshot.beds.length === 0;
    const gated = [
        mybed?.querySelector('p.hint[data-copy="mybedHint"]'),
        mybed?.querySelector(".pickrow"),
        $$3("mybedbedrow"), memberBox, resultBox,
    ];
    let lock = document.getElementById("mybedlock");
    if (noBed) {
        for (const el of gated)
            if (el)
                el.hidden = true;
        if (!lock && mybed) {
            lock = myBedLockNote();
            mybed.insertBefore(lock, mybed.firstChild);
        }
        if (lock)
            lock.hidden = false;
        return;
    }
    if (lock)
        lock.hidden = true;
    for (const el of gated)
        if (el)
            el.hidden = false;
    const elig = eligibleSpecies(site, bundle);
    const blockedWhy = new Map(elig.blocked.map((b) => [b.species, b.blocked_by.map((r) => reasonText(r.why)).join("; ")]));
    const blockedRule = new Map(elig.blocked.map((b) => [b.species, String(b.blocked_by[0]?.rule ?? "")]));
    const notHere = new Map();
    let zoneLabel = null;
    if (site.lat != null && site.lon != null) {
        const zl = resolveZone(site.lat, site.lon, bundle)?.label;
        zoneLabel = typeof zl === "string" ? zl.replace(/^zone\s*/i, "") : null;
        for (const g of growsHereAt(site.lat, site.lon, bundle)) {
            const r = g.verdict === "not" ? g.reasons.find((x) => x.kind === "season_short" || x.kind === "zone_cold") : undefined;
            if (r)
                notHere.set(g.species, r);
        }
    }
    const rowCounts = new Map();
    const memberCount = (sid) => activeMyBed().members.find((m) => m.species === sid)?.count ?? 0;
    const refreshRow = (sid) => {
        const host = rowCounts.get(sid);
        if (!host)
            return;
        const n = memberCount(sid);
        host.hidden = n === 0;
        const readout = host.querySelector(".pickn");
        if (readout)
            readout.textContent = String(n);
        host.parentElement?.classList.toggle("has", n > 0);
    };
    const addSpecies = (sid, by = 1) => {
        const myBed = activeMyBed();
        const existing = myBed.members.find((m) => m.species === sid);
        if (existing) {
            const next = (existing.count ?? 1) + by;
            if (next <= 0)
                myBed.members.splice(myBed.members.indexOf(existing), 1);
            else
                existing.count = next;
        }
        else if (by > 0) {
            myBed.members.push({ species: sid, count: by });
        }
        myBedEdited();
        paint();
        refreshRow(sid);
    };
    const inGarden = () => {
        const open = openSeason();
        return new Set([
            ...(open?.plantings ?? []).filter((p) => !p.end_cause).map((p) => p.species),
            ...activeMyBed().members.map((m) => m.species),
        ]);
    };
    function renderPick() {
        const term = q.value.trim().toLowerCase();
        const bedSel = document.getElementById("candbed");
        const bedReady = !!(bedSel && bedSel.options.length);
        const bedKey = bedSel?.value ?? "";
        if (pickOrderSnapshot && !pickOrderSnapshot.ready && bedReady) {
            pickOrderSnapshot = { ...pickOrderSnapshot, bed: bedKey, ready: true };
        }
        if (!pickOrderSnapshot || pickOrderSnapshot.bed !== bedKey || pickOrderSnapshot.term !== term) {
            pickOrderSnapshot = { bed: bedKey, term, ready: bedReady, mine: inGarden() };
        }
        const mine = pickOrderSnapshot.mine;
        const all = [...elig.eligible, ...elig.blocked.map((b) => b.species)];
        const hits = term ? cropSearch(bundle, all, term).hits : all;
        const groups = new Map();
        const PINNED = copy.plInThisGarden;
        for (const sid of hits.sort((a, b) => commonName(bundle, a).localeCompare(commonName(bundle, b)))) {
            const sp = bundle.species.find((x) => x.id === sid);
            const key = mine.has(sid) ? PINNED : categoryLabel(String(sp?.category ?? ""));
            const g = groups.get(key);
            if (g)
                g.push(sid);
            else
                groups.set(key, [sid]);
        }
        const order = [...groups.keys()].sort((a, b) => a === PINNED ? -1 : b === PINNED ? 1 : a.localeCompare(b));
        const keepScroll = listBox.scrollTop;
        listBox.innerHTML = "";
        rowCounts.clear();
        let blocked = 0;
        for (const key of order) {
            const head = document.createElement("div");
            head.className = key === PINNED ? "pickhead pinned" : "pickhead";
            const label = document.createElement("span");
            label.textContent = key;
            const n = document.createElement("span");
            n.textContent = String((groups.get(key) ?? []).length);
            head.append(label, n);
            listBox.appendChild(head);
            for (const sid of groups.get(key) ?? []) {
                const why = blockedWhy.get(sid);
                const row = document.createElement("div");
                row.className = why ? "pickrow-item blocked" : "pickrow-item";
                row.dataset.species = sid;
                row.setAttribute("role", "option");
                row.setAttribute("aria-selected", "false");
                if (why)
                    blocked++;
                const add = document.createElement(why ? "div" : "button");
                if (!why)
                    add.type = "button";
                add.className = "pickadd";
                if (why)
                    add.setAttribute("aria-disabled", "true");
                const nm = document.createElement("span");
                nm.className = "nm";
                nm.textContent = commonName(bundle, sid);
                add.appendChild(nm);
                if (why) {
                    const w = document.createElement("span");
                    w.className = "pickwhy";
                    w.textContent = why;
                    const rule = blockedRule.get(sid);
                    if (rule)
                        mark(w, { kind: "rule", id: rule });
                    add.appendChild(w);
                }
                else if (notHere.has(sid)) {
                    row.classList.add("nothere");
                    const w = document.createElement("span");
                    w.className = "pickwhy pickclimate";
                    w.textContent = reasonLine(notHere.get(sid), zoneLabel);
                    add.appendChild(w);
                }
                else if (mine.has(sid)) {
                    const t = document.createElement("span");
                    t.className = "picktail";
                    t.textContent = copy.plGrowingNow;
                    add.appendChild(t);
                }
                if (!why)
                    add.onclick = () => addSpecies(sid);
                row.appendChild(add);
                if (!why) {
                    const qty = document.createElement("span");
                    qty.className = "pickqty";
                    const mk = (txt, label, by) => {
                        const b = el$1("button", "pickstep", txt);
                        b.type = "button";
                        b.setAttribute("aria-label", label);
                        b.onclick = (e) => { e.stopPropagation(); addSpecies(sid, by); };
                        qty.appendChild(b);
                    };
                    mk("−", fillCopy("plOneFewer", { name: commonName(bundle, sid) }), -1);
                    const n = document.createElement("b");
                    n.className = "pickn";
                    n.setAttribute("aria-live", "polite");
                    qty.appendChild(n);
                    mk("+", fillCopy("plOneMore", { name: commonName(bundle, sid) }), 1);
                    row.appendChild(qty);
                    rowCounts.set(sid, qty);
                }
                const info = document.createElement("a");
                info.className = "pickinfo";
                info.href = plantHref(sid);
                info.textContent = "\u203a";
                info.setAttribute("aria-label", fillCopy("plWhatWeKnow", { name: commonName(bundle, sid) }));
                info.addEventListener("click", (e) => { e.stopPropagation(); });
                row.appendChild(info);
                listBox.appendChild(row);
                if (!why)
                    refreshRow(sid);
            }
        }
        if (!hits.length) {
            const p = document.createElement("p");
            p.className = "hint pickempty";
            p.textContent = term
                ? fillCopy("plNoMatch", { term: q.value.trim() })
                : copy.plNoPlantsAvailable;
            listBox.appendChild(p);
        }
        countLine.textContent = hits.length
            ? fillCopy("plPickCount", { n: hits.length, total: all.length, greyed: blocked ? fillCopy("plPickGreyed", { n: blocked }) : "" })
            : "";
        listBox.scrollTop = keepScroll;
    }
    const step = document.getElementById("step-mybed");
    if (step && !step.dataset.pickresort) {
        step.dataset.pickresort = "1";
        step.addEventListener("toggle", () => { pickOrderSnapshot = null; });
    }
    q.oninput = () => renderPick();
    renderPick();
    const paint = () => {
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const myBed = activeMyBed();
        recordHistory(myBed);
        const region = planBedRegion(bed);
        if (bed && region && !myBed.reseeded) {
            reseedBedFromOccupancy(bed, region, myBed);
            myBed.reseeded = true;
            myBed.lastSig = stateSig(myBed);
        }
        const myBedOccupied = carriedOccupancy(bed);
        const obSite = region ? { ...site, region, occupied: myBedOccupied, structure: bed?.structure ?? "in_ground", lane_flip: bed?.lane_flip ?? false, rain: bed?.rain ?? null } : site;
        const ob = openBed(myBed.members, obSite, bundle);
        const fp = ob.footprint;
        const subLine = document.getElementById("mybed-sub");
        if (subLine) {
            const bits = [bedName, fp?.bed_m2 != null ? fmtArea(fp.bed_m2) : null].filter(Boolean);
            subLine.textContent = bits.join(" \u00b7 ");
            subLine.hidden = bits.length === 0;
        }
        const bedRow = document.getElementById("mybedbedrow");
        if (bedRow) {
            bedRow.innerHTML = "";
            const choosable = app.logSnapshot.beds.filter((b) => !bedHasSections(b.name, app.logSnapshot.beds));
            bedRow.hidden = choosable.length < 2 && app.logSnapshot.beds.length > 0;
            if (app.logSnapshot.beds.length === 0) {
                const hint = document.createElement("p");
                hint.className = "hint";
                hint.textContent = copy.plNoSavedBeds;
                bedRow.appendChild(hint);
            }
            else {
                const label = document.createElement("label");
                label.setAttribute("for", "mybedbedsel");
                label.textContent = copy.plSelectBed;
                const sel = document.createElement("select");
                sel.id = "mybedbedsel";
                for (const b of app.logSnapshot.beds.filter((b) => !bedHasSections(b.name, app.logSnapshot.beds))) {
                    const o = document.createElement("option");
                    o.value = b.name;
                    o.textContent = b.name;
                    sel.appendChild(o);
                }
                sel.value = bedName;
                sel.addEventListener("change", () => {
                    const cand = document.getElementById("candbed");
                    cand.value = sel.value;
                    cand.dispatchEvent(new Event("change"));
                });
                bedRow.append(label, sel);
            }
        }
        memberBox.innerHTML = "";
        if (!myBed.members.length) {
            const empty = document.createElement("p");
            empty.className = "hint";
            empty.textContent = copy.plNoPlantsYet;
            memberBox.appendChild(empty);
        }
        ob.members.forEach((m, i) => {
            const row = document.createElement("p");
            row.className = (m.eligible ? "role" : "why") + " memberrow";
            const blk = m.blockers.map((b) => reasonText(b.why)).join("; ");
            const spread = containmentNote(bundle, m.species);
            const inv = invasiveNote(bundle, m.species);
            const rawRec = (bundle.species.find((s) => s.id === m.species)
                ?? (bundle.entities ?? []).find((e) => e.id === m.species));
            const isStructureRow = rawRec?.entity_class === "structure";
            const label = document.createElement("span");
            label.appendChild(document.createTextNode(`${m.eligible ? "·" : ""} ${m.count} × `));
            if (isStructureRow)
                label.appendChild(document.createTextNode(commonName(bundle, m.species)));
            else
                label.appendChild(plantLink(plantingLabel(bundle, m.species, m.group ?? null), m.species, m.group ?? null));
            let supNote = "";
            if (!isStructureRow && rawRec) {
                const req = m.group
                    ? String(resolveSpecies(m.species, m.group, bundle).support?.requires ?? "none")
                    : strongestSupportRequirement(rawRec);
                const word = VALUE_WORD["support.requires"][req];
                if (word) {
                    const varies = !m.group && strongestSupportRequirement(rawRec)
                        !== String((rawRec.support?.requires) ?? "none");
                    supNote = ` - ${word.toLowerCase()}${varies ? copy.plDependsVariety : ""}`;
                }
            }
            const tail = isStructureRow
                ? copy.plStructureTail
                : `${blk ? ` - ${blk}` : ""}${spread ? ` - ${spread}` : ""}${inv ? ` - ${inv}` : ""}${supNote}`;
            if (tail)
                label.appendChild(document.createTextNode(tail));
            if (supNote) {
                const ga = document.createElement("a");
                ga.href = "../guides/staking-and-support/";
                ga.textContent = copy.plHowToSupport;
                label.appendChild(document.createTextNode(" · "));
                label.appendChild(ga);
            }
            if (m.blockers[0]?.rule)
                mark(label, { kind: "rule", id: m.blockers[0].rule });
            row.appendChild(label);
            const spDef = bundle.species.find((s) => s.id === m.species);
            const groups = Array.isArray(spDef?.cultivar_groups) ? spDef.cultivar_groups : [];
            if (groups.length) {
                const gsel = document.createElement("select");
                gsel.className = "mybedgroup";
                gsel.setAttribute("aria-label", fillCopy("plVarietyAria", { name: commonName(bundle, m.species) }));
                const any = document.createElement("option");
                any.value = "";
                any.textContent = copy.plAnyVariety;
                gsel.appendChild(any);
                for (const g of groups) {
                    const o = document.createElement("option");
                    o.value = String(g.id);
                    o.textContent = groupLabel(bundle, m.species, String(g.id));
                    gsel.appendChild(o);
                }
                gsel.value = myBed.members[i].group ?? "";
                gsel.onchange = () => {
                    const g = gsel.value || null;
                    myBed.members[i].group = g;
                    const sp = myBed.members[i].species;
                    for (const t of myBed.tokens)
                        if (t.species === sp)
                            t.group = g;
                    myBedEdited();
                    paint();
                };
                row.appendChild(gsel);
            }
            const stepper = (txt, fn) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "qty";
                b.textContent = txt;
                b.onclick = () => { fn(); myBedEdited(); paint(); };
                row.appendChild(b);
            };
            if (!isStructureRow) {
                stepper("−", () => {
                    const cur = myBed.members[i].count ?? 1;
                    if (cur <= 1)
                        myBed.members.splice(i, 1);
                    else
                        myBed.members[i].count = cur - 1;
                });
                stepper("+", () => { myBed.members[i].count = (myBed.members[i].count ?? 1) + 1; });
            }
            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "btn btn-quiet tertiary rmbtn";
            rm.textContent = copy.plRemove;
            rm.onclick = () => { myBed.members.splice(i, 1); myBedEdited(); paint(); };
            row.appendChild(rm);
            memberBox.appendChild(row);
        });
        const mySum = document.getElementById("sum-mybed");
        if (mySum) {
            const n = myBedMemberCount();
            mySum.textContent = n ? pluralCopy("plPlantCount", n) : "";
        }
        const arrangeBox = $$3("mbr-arrange") ?? resultBox;
        const foundBox = $$3("mbr-found") ?? resultBox;
        const saveSlot = $$3("mbr-save") ?? resultBox;
        for (const h of new Set([arrangeBox, foundBox, saveSlot]))
            h.innerHTML = "";
        const pInto = (host, cls, text) => {
            const el = document.createElement("p");
            el.className = cls;
            el.textContent = text;
            host.appendChild(el);
            return el;
        };
        const pA = (cls, text) => pInto(arrangeBox, cls, text);
        const pF = (cls, text) => pInto(foundBox, cls, text);
        const grid = region ? bedGrid(region) : null;
        const groupOf = new Map(myBed.members.map((mm) => [mm.species, mm.group ?? null]));
        const tokSig = () => tokenSignature(myBed.members, grid);
        const pl = ob.placement;
        if (pl && grid) {
            const polar = pl.polar;
            const single = pl.zones.length < 2;
            mark(pA("window", fillCopy(single ? "plCanvasIntroOne" : "plCanvasIntroMany", { opt: myBed.optimized ? copy.plOptimizedApplied : "", side: sideWord(polar) })), { kind: "rule", id: "R-003" });
            const bedO = bed ? bedOrientation(bed) : null;
            if (bedO && bed) {
                const EDGE = [copy.plEdgeTop, copy.plEdgeRight, copy.plEdgeBottom, copy.plEdgeLeft];
                pA("hint", fillCopy("plRotatedHint", { bed: bed.name, deg: String(bed.rotation_deg), edge: EDGE[bedO.orient.poleward_edge], side: sideWord(polar) }));
            }
            const toWorld = bedO
                ? (x, y) => orientedToPlot(x, y, bedO.orient.eff_w, bedO.orient.eff_l, bedO.orient.residual_deg, bedO.cx, bedO.cy)
                : undefined;
            const laneRects = region ? accessBands(bed?.structure ?? "in_ground", region, bed?.lane_flip ?? false) : [];
            const laneMargin = 0.44 * Math.min(grid.cellW, grid.cellH);
            const laneCell = (col, row) => {
                const x = grid.x0 + col * grid.cellW, y = grid.y1 - row * grid.cellH;
                return laneRects.some((b) => b.x0 - laneMargin <= x && x < b.x1 + laneMargin && b.y0 - laneMargin <= y && y < b.y1 + laneMargin);
            };
            if (tokSig() !== myBed.tokenSig) {
                myBed.tokens = seatTokens(pl, grid, groupOf, laneCell);
                myBed.tokenSig = tokSig();
                myBed.baseline = null;
                myBed.optimized = false;
            }
            const heightOf = new Map();
            const sheltered = new Set();
            const r003 = bundle.rules.find((x) => x.id === "R-003");
            const shelters = r003?.trigger?.sheltered_by === "R-156" ? shelterPredicate(bundle) : {};
            for (const [sp, gp] of groupOf) {
                const r = resolveSpecies(sp, gp, bundle);
                const h = r.mature_height_cm;
                heightOf.set(sp, Array.isArray(h) ? Number(h[h.length - 1]) : Number(h ?? 0));
                if (shelteredByShadow(r, shelters))
                    sheltered.add(sp);
            }
            let onSaveReenable = null;
            let refreshHistoryButtons = null;
            const bedPolygon = region && region.shape === "polygon" ? regionPoints(region) : undefined;
            const laneBands = laneRects.map((b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]);
            const removeToken = (i) => {
                const tok = myBed.tokens[i];
                if (!tok)
                    return;
                myBed.tokens.splice(i, 1);
                const mi = myBed.members.findIndex((m) => m.species === tok.species && (m.group ?? null) === (tok.group ?? null));
                if (mi >= 0) {
                    const c = (myBed.members[mi].count ?? 1) - 1;
                    if (c <= 0)
                        myBed.members.splice(mi, 1);
                    else
                        myBed.members[mi].count = c;
                }
                myBed.tokenSig = tokenSignature(myBed.members, grid);
                myBed.optimized = false;
                myBed.baseline = null;
                onSaveReenable?.();
                paint();
            };
            const supLines = structureLine(myBed.members, obSite, bundle);
            arrangeBox.appendChild(myBedCanvas(grid, bundle, { thresholdCm: r003?.trigger?.threshold_cm ?? 120, lat: site.lat ?? null, heightOf, sheltered, polar, toWorld, onMove: (key) => { onSaveReenable?.(); recordHistory(myBed, key); refreshHistoryButtons?.(); }, onRemove: removeToken, rotationDeg: bedO ? bedO.orient.residual_deg : 0, polygon: bedPolygon, occupied: myBedOccupied, laneBands, supports: supLines }, myBed.tokens));
            if (myBedOccupied.length) {
                const openSn = openSeason();
                const byLabel = new Map();
                for (const pp of (openSn?.plantings ?? [])
                    .filter((x) => x.carried_over === true && !x.end_cause && intersectArea(x.region, bed.region) > 0)) {
                    const name = commonName(bundle, pp.species);
                    if (!byLabel.has(name))
                        byLabel.set(name, pp.species);
                }
                const marks = [...byLabel].filter(([, sid]) => !app.userSpecies.some((u) => u.id === sid))
                    .map(([label, species]) => ({ label, species }));
                const labels = [...byLabel.keys()];
                const noteEl = pA("hint", "");
                linkNamesIn(noteEl, fillCopy(labels.length === 1 ? "plOverwinterOne" : "plOverwinterMany", { names: labels.join(", ") }), marks);
                mark(noteEl, { kind: "rule", id: "R-002" });
            }
            const dh = pA("hint", copy.plDragAny);
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "linky";
            reset.textContent = copy.plResetRecommended;
            reset.onclick = () => { myBedEdited(); paint(); };
            dh.appendChild(reset);
            const tools = document.createElement("div");
            tools.className = "canvastools";
            const restoreTo = (snap) => {
                myBed.members = cloneMembers(snap.members);
                myBed.tokens = cloneTokens(snap.tokens);
                myBed.baseline = null;
                myBed.optimized = false;
                myBed.restoring = true;
                myBed.lastSig = stateSig(myBed);
                myBed.tokenSig = tokSig();
                paint();
            };
            const undo = document.createElement("button");
            undo.type = "button";
            undo.className = "canvasundo";
            undo.textContent = copy.plUndoBtn;
            undo.title = copy.plUndoTitle;
            undo.disabled = !(myBed.history?.length);
            undo.onclick = () => {
                const prev = myBed.history?.pop();
                if (!prev)
                    return;
                (myBed.future ??= []).push({ members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) });
                restoreTo(prev);
            };
            const redo = document.createElement("button");
            redo.type = "button";
            redo.className = "canvasredo";
            redo.textContent = copy.plRedoBtn;
            redo.title = copy.plRedoTitle;
            redo.disabled = !(myBed.future?.length);
            redo.onclick = () => {
                const next = myBed.future?.pop();
                if (!next)
                    return;
                (myBed.history ??= []).push({ members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) });
                restoreTo(next);
            };
            const zoom = document.createElement("button");
            zoom.type = "button";
            zoom.className = "canvaszoom";
            zoom.textContent = canvasZoom === 1 ? copy.plZoomInBtn : canvasZoom === 1.5 ? copy.plZoomInMore : copy.plZoomOutBtn;
            zoom.title = copy.plZoomTitle;
            zoom.onclick = () => { canvasZoom = canvasZoom === 1 ? 1.5 : canvasZoom === 1.5 ? 2 : 1; paint(); };
            tools.append(undo, redo, zoom);
            refreshHistoryButtons = () => { undo.disabled = !(myBed.history?.length); redo.disabled = !(myBed.future?.length); };
            arrangeBox.insertBefore(tools, dh);
            const opp = polar === "north" ? "south" : "north";
            const colours = zoneColorMap(pl.zones);
            pl.zones.forEach((z, i) => {
                if (z.count === 0)
                    return;
                const where = single ? copy.plWhereWholeBed
                    : i === 0 ? fillCopy("plWhereSide", { side: sideWord(polar) }) : i === pl.zones.length - 1 ? fillCopy("plWhereSide", { side: sideWord(opp) }) : copy.plWhereMiddle;
                arrangeBox.appendChild(placementLine(bundle, z, where, colours.get(z.species), { group: groupOf.get(z.species) ?? null }));
            });
            for (const sup of supLines) {
                const climbs = sup.for.map((sid) => midSentence(commonName(bundle, sid))).join(", ");
                const sl = pA("role", fillCopy("plSupLine", { name: commonName(bundle, sup.id), edge: sideWord(sup.edge), length: fmtCm(Math.round(sup.length_m * 100)),
                    climbs: climbs ? fillCopy(sup.for.length === 1 ? "plSupClimbsOne" : "plSupClimbsMany", { plants: climbs }) : "" }));
                mark(sl, { kind: "rule", id: "R-040" });
            }
            const totalInstances = myBed.members.reduce((n, m) => n + (m.count ?? 1), 0);
            const oneSpecies = myBed.members.length === 1;
            if (totalInstances >= 2 && site.lat != null) {
                const ARCH_LABEL = {
                    hills: copy.plArchHills,
                    rings: copy.plArchRings,
                    grid: copy.plArchGrid,
                };
                const archLabel = (arch) => oneSpecies ? copy.plArchStand : (ARCH_LABEL[arch] ?? arch);
                const applyOptimize = () => {
                    myBed.pendingArrange = false;
                    const arch = bedArchetype(myBed.members, bundle);
                    const treeCount = myBed.members.reduce((n, m) => n + (resolveSpecies(m.species, m.group ?? null, bundle).habit === "tree" ? (m.count ?? 1) : 0), 0);
                    const plantable = region ? plantableArea(region, bed?.structure ?? "in_ground", bed?.lane_flip ?? false) : 0;
                    const opt = (arch === "rings" && treeCount > 1)
                        ? optimizeBed(myBed.members, obSite, bundle)
                        : { members: filledMembers(myBed.members, plantable, bundle) };
                    if (!myBed.baseline)
                        myBed.baseline = { members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) };
                    myBed.members = opt.members.map((m) => ({ species: m.species, group: m.group ?? null, count: m.count ?? 1 }));
                    let optPl = optimizedPlacement(myBed.members, obSite, bundle).placement;
                    if (optPl) {
                        const snapped = snapCountsToLayout(myBed.members, optPl, arch, bundle);
                        if (snapped) {
                            myBed.members = snapped;
                            optPl = optimizedPlacement(myBed.members, obSite, bundle).placement;
                        }
                    }
                    myBed.tokens = optPl ? seatTokens(optPl, grid, new Map(myBed.members.map((mm) => [mm.species, mm.group ?? null])), laneCell) : myBed.tokens;
                    myBed.optimized = true;
                    myBed.tokenSig = tokSig();
                    paint();
                };
                if (myBed.pendingArrange) {
                    myBed.pendingArrange = false;
                    requestAnimationFrame(applyOptimize);
                }
                if (myBed.optimized && myBed.baseline) {
                    const arch = bedArchetype(myBed.members, bundle);
                    const tally = (ms) => { const t = new Map(); for (const m of ms)
                        t.set(m.species, (t.get(m.species) ?? 0) + (m.count ?? 1)); return t; };
                    const was = tally(myBed.baseline.members), now = tally(myBed.members);
                    const sum = (t) => [...t.values()].reduce((a, b) => a + b, 0);
                    const before = sum(was), after = sum(now);
                    pA("lead", before === after
                        ? fillCopy(after === 1 ? "plFilledSameOne" : "plFilledSameMany", { arch: archLabel(arch), n: after })
                        : fillCopy(before === 1 ? "plFilledChangeOne" : "plFilledChangeMany", { arch: archLabel(arch), before, verb: after > before ? copy.plFilledOutTo : copy.plTrimmedTo, after }));
                    for (const [sp, w] of was) {
                        const n2 = now.get(sp) ?? 0;
                        const spName = commonName(bundle, sp);
                        if (n2 < w) {
                            linkNameIn(pA("composeexcl", ""), n2 === 0
                                ? fillCopy("plOptRemoved", { name: spName, was: w })
                                : fillCopy("plOptReduced", { name: spName, was: w, now: n2 }), spName, sp);
                        }
                        else if (n2 > w) {
                            linkNameIn(pA("hint", ""), fillCopy("plOptGrew", { name: spName, was: w, now: n2 }), spName, sp);
                        }
                    }
                    const controls = pA("hint", copy.plDragFineTune);
                    const rev = document.createElement("button");
                    rev.type = "button";
                    rev.className = "linky";
                    rev.textContent = copy.plRevertLayout;
                    rev.onclick = () => {
                        myBed.members = myBed.baseline.members;
                        myBed.tokens = myBed.baseline.tokens;
                        myBed.baseline = null;
                        myBed.optimized = false;
                        myBed.tokenSig = tokSig();
                        paint();
                    };
                    controls.appendChild(rev);
                    controls.appendChild(document.createTextNode(" · "));
                    const reopt = document.createElement("button");
                    reopt.type = "button";
                    reopt.className = "linky";
                    reopt.textContent = copy.plReArrange;
                    reopt.onclick = applyOptimize;
                    controls.appendChild(reopt);
                }
                else {
                    const optWrap = document.createElement("div");
                    optWrap.className = "bedtools";
                    const th = document.createElement("h4");
                    th.className = "bedtools-h";
                    th.textContent = copy.plImproveBed;
                    optWrap.appendChild(th);
                    const seam = document.createElement("p");
                    seam.className = "hint";
                    seam.textContent = copy.plImproveSeam;
                    optWrap.appendChild(seam);
                    const optBtn = document.createElement("button");
                    optBtn.type = "button";
                    optBtn.className = "btn btn-primary primary fillbtn";
                    optBtn.textContent = copy.plFillArrange;
                    optBtn.onclick = applyOptimize;
                    optWrap.appendChild(optBtn);
                    arrangeBox.appendChild(optWrap);
                }
            }
            if (bed && grid) {
                const applyBox = document.createElement("div");
                applyBox.className = "applybox";
                saveSlot.appendChild(applyBox);
                const savedMap = bedOccupancyComposition(bed.region);
                const draftMap = draftComposition(myBed.members);
                const savedCount = [...savedMap.values()].reduce((a, b) => a + b, 0);
                const dirty = !compositionsEqual(savedMap, draftMap);
                const status = document.createElement("p");
                status.className = "bedstate";
                if (!savedCount && !draftMap.size) {
                    status.textContent = copy.plEmptyBed;
                }
                else if (dirty) {
                    status.classList.add("dirty");
                    status.textContent = savedCount ? copy.plUnsavedChanges : copy.plDraftNotSaved;
                }
                else {
                    status.classList.add("saved");
                    status.textContent = copy.plBedMatchesLog;
                }
                applyBox.appendChild(status);
                const tokensToSave = () => myBed.tokens;
                const n = tokensToSave().length;
                const out = document.createElement("span");
                out.className = "hint";
                const seasonId$1 = seasonId();
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "btn btn-primary btn-block saveplan primary";
                onSaveReenable = () => {
                    if (!btn.disabled)
                        return;
                    btn.disabled = false;
                    out.className = "hint";
                    out.textContent = copy.plMovedSaveAgain;
                };
                if (seasonId$1 != null) {
                    btn.textContent = fillCopy(n === 1 ? "plSaveDraftOne" : "plSaveDraftMany", { n, bed: bed.name });
                    btn.onclick = () => void (async () => {
                        btn.disabled = true;
                        out.className = "hint";
                        out.textContent = copy.plSaving;
                        try {
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, seasonId$1, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), composedTest(myBed), myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species), true);
                            app.planDots = appliedPlanDots(bundle, site);
                            app.groundRedraw?.();
                            toast(fillCopy(saved === 1 ? "plSavedDraftOne" : "plSavedDraftMany", { bed: bed.name, n: saved }));
                            await app.logRefresh?.();
                        }
                        catch (e) {
                            out.className = "why";
                            out.textContent = ` ${e.message}`;
                            btn.disabled = false;
                        }
                    })();
                }
                else {
                    const year = new Date().getFullYear();
                    btn.textContent = fillCopy(n === 1 ? "plStartSaveOne" : "plStartSaveMany", { year, n, bed: bed.name });
                    btn.onclick = () => void (async () => {
                        btn.disabled = true;
                        out.className = "hint";
                        out.textContent = copy.plStartingSeason;
                        try {
                            if (!app.logDb)
                                throw new Error(copy.plLogNotReadyStraight);
                            if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
                                await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                            }
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, year, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), composedTest(myBed), myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species), true);
                            toast(fillCopy(saved === 1 ? "plStartedSavedOne" : "plStartedSavedMany", { year, bed: bed.name, n: saved }));
                            await app.logRefresh?.();
                        }
                        catch (e) {
                            out.className = "why";
                            out.textContent = ` ${e.message}`;
                            btn.disabled = false;
                        }
                    })();
                }
                applyBox.appendChild(btn);
                applyBox.appendChild(out);
                if (savedCount || draftMap.size) {
                    const reset = document.createElement("button");
                    reset.type = "button";
                    reset.className = "linky bedreset";
                    reset.textContent = savedCount ? copy.plResetSaved : copy.plClearBed;
                    reset.title = savedCount ? copy.plResetSavedTitle : copy.plClearBedTitle;
                    reset.onclick = () => {
                        myBed.members = [];
                        myBed.tokens = [];
                        myBed.tokenSig = "";
                        myBed.baseline = null;
                        myBed.optimized = false;
                        myBed.reseeded = false;
                        paint();
                    };
                    applyBox.appendChild(reset);
                }
            }
        }
        else if (myBed.members.length >= 2) {
            pA("hint", copy.plNeedLocationForDiagram);
        }
        if (fp.bed_m2 != null && fp.total_m2 > 0) {
            const pl = fp.plantable_m2;
            const pathed = pl != null && pl < fp.bed_m2 - 1e-9;
            const ground = pathed ? fillCopy("plPlantableGround", { area: fmtArea(pl) }) : fillCopy("plAreaBed", { area: fmtArea(fp.bed_m2) });
            const aside = pathed ? " " + fillCopy("plLessPaths", { area: fmtArea(fp.bed_m2) }) : ".";
            if (fp.fits) {
                pF("hint", fillCopy("plFootprintOf", { total: fmtArea(fp.total_m2), ground, aside }));
            }
            else if (myBed.optimized) {
                pF("hint", fillCopy("plCanopyKnits", { total: fmtArea(fp.total_m2), ground }));
            }
            else {
                pF("why", fillCopy("plPlantsNeed", { total: fmtArea(fp.total_m2), ground, aside }));
            }
        }
        const BLOOM_WORD = { early_spring: copy.blEarlySpring, late_spring: copy.blLateSpring,
            early_summer: copy.blEarlySummer, midsummer: copy.blMidsummer, late_summer: copy.blLateSummer };
        const BLOOM_SHORT = { early_spring: copy.blShortEarlySpring, late_spring: copy.blShortLateSpring,
            early_summer: copy.blShortEarlySummer, midsummer: copy.blShortMidsummer, late_summer: copy.blShortLateSummer };
        const seasonLabel = (t) => BLOOM_WORD[t] ?? t.replace(/_/g, " ");
        const forageOffer = (bloom, planted) => {
            const lo = BLOOM_ORDER.indexOf(bloom[0]);
            const hi = BLOOM_ORDER.indexOf(bloom[1]);
            if (lo < 0 || hi < 0)
                return null;
            const ids = forageCandidates([lo, hi], bundle, new Set(planted)).slice(0, 3);
            if (!ids.length)
                return null;
            const marks = [];
            const parts = ids.map((id) => {
                const sp = bundle.species.find((x) => x.id === id);
                const spread = Array.isArray(sp?.mature_spread_cm) ? sp.mature_spread_cm[1] : null;
                const label = commonName(bundle, id);
                marks.push({ label, species: id });
                return spread ? fillCopy("plCmAcross", { name: label, size: fmtCm(spread) }) : label;
            });
            return { text: fillCopy("plInFlowerThen", { list: parts.join(", ") }), marks };
        };
        const outs = [];
        for (const f of ob.flags) {
            if (f.rule === "R-002")
                continue;
            const name = f.subject === null ? "" : commonName(bundle, f.subject);
            let msg = null;
            let extraMarks = [];
            if (f.rule === "R-040")
                msg = fillCopy("plFlagSupport", { name });
            else if (f.rule === "R-001")
                msg = fillCopy("plFlagBlock", { need: String(f.need), name, have: String(f.have) });
            else if (f.rule === "R-080") {
                const cv = cultivarPartner(bundle, f.subject);
                msg = cv
                    ? fillCopy("plFlagVarieties", { name, n: cv, have: String(f.have), near: fmtLen(15), far: fmtLen(30) })
                    : fillCopy("plFlagMinPlants", { name, need: String(f.need), have: String(f.have) });
            }
            else if (f.rule === "R-140") {
                msg = fillCopy("plFlagDioecious", { name, have: String(f.have) });
            }
            else if (f.rule === "R-102") {
                const [lo, hi] = (f.bloom ?? ["early_summer", "late_summer"]);
                msg = lo === hi ? fillCopy("plBloomGapOne", { name, when: seasonLabel(lo) })
                    : fillCopy("plBloomGapSpan", { name, from: seasonLabel(lo), to: seasonLabel(hi) });
            }
            else if (f.rule === "R-107") {
                msg = copy.plFlagContainer;
            }
            else if (f.rule === "R-173") {
                msg = f.rain === "indoors" ? copy.plFlagIndoors : copy.plFlagRoofed;
            }
            else if (f.rule === "R-142") {
                const lows = (f.low ?? []).map((id) => commonName(bundle, id));
                const steadies = (f.steady ?? []).map((id) => commonName(bundle, id));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                msg = fillCopy("plWaterSplit", {
                    steady: fillCopy(steadies.length === 1 ? "plWaterSteadyOne" : "plWaterSteadyMany", { plants: list(steadies) }),
                    low: fillCopy(lows.length === 1 ? "plWaterLowOne" : "plWaterLowMany", { plants: list(lows) }),
                    give: lows.length === 1 ? fillCopy("plWaterGiveOne", { plant: lows[0] }) : copy.plWaterGiveMany,
                });
                extraMarks = [...(f.low ?? []), ...(f.steady ?? [])]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-144") {
                const smalls = (f.small ?? []).map((id) => commonName(bundle, id));
                const res = (f.residue ?? []);
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                const covers = list(res.map((r) => fillCopy("plCoverWait", { name: commonName(bundle, r.species), weeks: Math.round(r.lead_days / 7) })));
                msg = fillCopy(smalls.length === 1 ? "plResidueOne" : "plResidueMany", { covers, smalls: list(smalls) });
                extraMarks = [...(f.small ?? []), ...res.map((r) => r.species)]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-152") {
                const risk = (f.hosts ?? []).map((id) => commonName(bundle, id));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                const host = commonName(bundle, String(f.host ?? ""));
                msg = fillCopy("plVolunteers", { host, risk: list(risk) });
                extraMarks = [String(f.host ?? ""), ...(f.hosts ?? [])]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-157") {
                const ids = (f.species ?? []);
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                msg = fillCopy("plBramblesTogether", { plants: list(ids.map((id) => commonName(bundle, id))) });
                extraMarks = ids.map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-155") {
                const sid = String(f.species ?? "");
                const kinds = (f.groups ?? []).map((g) => groupLabel(bundle, sid, g));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                msg = fillCopy("plCornTogether", { kinds: list(kinds) });
                extraMarks = [{ label: commonName(bundle, sid), species: sid }];
            }
            if (msg) {
                const rule = bundle.rules.find((x) => x.id === f.rule);
                const offer = f.rule === "R-102" && f.bloom
                    ? forageOffer(f.bloom, ob.members.map((m) => m.species))
                    : null;
                let ribbon;
                if (f.rule === "R-102" && f.bloom) {
                    const lo = BLOOM_ORDER.indexOf(f.bloom[0]);
                    const hi = BLOOM_ORDER.indexOf(f.bloom[1]);
                    if (lo >= 0 && hi >= 0) {
                        const others = ob.members.map((m) => m.species).filter((x) => x !== f.subject);
                        ribbon = {
                            crop: BLOOM_ORDER.map((_, i) => i >= lo && i <= hi),
                            forage: BLOOM_ORDER.map((_, i) => forageInFlower([i, i], others, bundle).length > 0),
                        };
                    }
                }
                outs.push({
                    rule: f.rule, text: offer ? `${msg} ${offer.text}` : msg, ribbon,
                    names: [
                        ...(f.subject && name ? [{ label: name, species: f.subject }] : []),
                        ...(offer?.marks ?? []),
                        ...extraMarks,
                    ],
                    remedy: typeof rule?.remedy === "string" ? stripRuleCitations(corpusText(rule.id, "remedy", rule.remedy)) : null,
                    severity: typeof rule?.severity === "string" ? rule.severity : "suboptimal",
                });
            }
        }
        for (const vn of virusNeighbours(myBed.members, plotSiblings(candbedValue()), bundle)) {
            const rule = bundle.rules.find((x) => x.id === vn.rule);
            const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
            const mine = list(vn.species.map((id) => midSentence(commonName(bundle, id))));
            const theirs = vn.with.map((w) => fillCopy("plBedsPlants", { bed: w.bed, plants: list(w.species.map((id) => midSentence(commonName(bundle, id)))) })).join(copy.plAndJoin);
            outs.push({
                rule: vn.rule,
                text: fillCopy("plVirusCard", { theirs, mine }),
                names: [...vn.species, ...vn.with.flatMap((w) => w.species)]
                    .filter((id, i, arr) => arr.indexOf(id) === i)
                    .map((id) => ({ label: midSentence(commonName(bundle, id)), species: id })),
                remedy: typeof rule?.remedy === "string" ? stripRuleCitations(corpusText(rule.id, "remedy", rule.remedy)) : null,
                severity: typeof rule?.severity === "string" ? rule.severity : "suboptimal",
            });
        }
        const bloomRibbon = (r) => {
            const wrap = document.createElement("div");
            wrap.className = "bloomribbon";
            const row = (label, on, cls, onKey, offKey) => {
                const l = document.createElement("span");
                l.className = "brlabel";
                l.textContent = label;
                wrap.appendChild(l);
                const bar = document.createElement("span");
                bar.className = "brbar";
                on.forEach((v, i) => {
                    const cell = document.createElement("span");
                    const season = seasonLabel(BLOOM_ORDER[i]);
                    cell.className = v ? `brcell ${cls}` : "brcell";
                    cell.title = fillCopy(v ? onKey : offKey, { season });
                    bar.appendChild(cell);
                });
                wrap.appendChild(bar);
            };
            row(copy.plNeedsInsects, r.crop, "brcrop", "blCropOn", "blCropOff");
            row(copy.plInFlowerHere, r.forage, "brforage", "blForageOn", "blForageOff");
            const spacer = document.createElement("span");
            wrap.appendChild(spacer);
            const scale = document.createElement("span");
            scale.className = "brscale";
            for (const t of BLOOM_ORDER) {
                const c = document.createElement("span");
                c.textContent = BLOOM_SHORT[t] ?? t;
                scale.appendChild(c);
            }
            wrap.appendChild(scale);
            return wrap;
        };
        const outCard = (o) => {
            const box = document.createElement("div");
            box.className = o.severity === "fatal" ? "out fatal" : o.severity === "costly" ? "out costly" : "out";
            const claim = document.createElement("p");
            claim.className = "outclaim";
            if (o.names?.length)
                linkNamesIn(claim, o.text, o.names);
            else
                claim.textContent = o.text;
            mark(claim, { kind: "rule", id: o.rule });
            box.appendChild(claim);
            if (o.ribbon)
                box.appendChild(bloomRibbon(o.ribbon));
            if (o.remedy) {
                const fix = document.createElement("p");
                fix.className = "outfix";
                fix.textContent = o.remedy;
                if (corpusWantsEs() && !corpusEs(o.rule, "remedy"))
                    fix.lang = "en";
                box.appendChild(fix);
            }
            if (o.rule === "R-040" && !myBed.members.some((m) => m.species === "trellis_structure")
                && (bundle.entities ?? []).some((e) => e.id === "trellis_structure")) {
                const add = document.createElement("button");
                add.type = "button";
                add.className = "linky";
                add.id = "addsupport";
                const ent = (bundle.entities ?? []).find((e) => e.id === "trellis_structure");
                const cost = Array.isArray(ent?.cost_usd) ? fillCopy("plTrellisCost", { lo: String(ent.cost_usd[0]), hi: String(ent.cost_usd[1]) }) : "";
                add.textContent = fillCopy("plAddTrellis", { cost });
                add.onclick = () => {
                    myBed.members.push({ species: "trellis_structure", group: null, count: 1 });
                    myBedEdited();
                    paint();
                };
                box.appendChild(add);
            }
            return box;
        };
        const sevRank = { fatal: 0, costly: 1 };
        const opened = outs.filter((o) => o.severity in sevRank).sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
        const softer = outs.filter((o) => !(o.severity in sevRank));
        for (const o of opened)
            foundBox.appendChild(outCard(o));
        const sugLines = ob.suggestions.map((sug) => {
            const guild = bundle.guilds.find((g) => g.id === sug.guild);
            const gname = guild ? displayName(guild) : sug.guild;
            const marks = [];
            const missing = sug.missing_roles.map((mr) => {
                const ids = mr.fillers.slice(0, 3);
                const labels = ids.map((s) => {
                    const label = commonName(bundle, s);
                    marks.push({ label, species: s });
                    return label;
                });
                const fillers = labels.length <= 1 ? (labels[0] ?? "") : fillCopy("stJoinOr", { a: labels.slice(0, -1).join(", "), b: labels[labels.length - 1] });
                const role = roleName(mr.role).toLocaleLowerCase();
                return fillers ? fillCopy("plSugRoleWith", { plants: fillers, role }) : fillCopy("plSugRoleBare", { role });
            });
            const list = missing.length <= 1 ? (missing[0] ?? "") : fillCopy("plListAnd", { list: missing.slice(0, -1).join(", "), last: missing[missing.length - 1] });
            return { text: fillCopy("plSugComplete", { team: gname, missing: list }), marks };
        });
        const nFolded = softer.length + sugLines.length;
        if (nFolded) {
            const det = document.createElement("details");
            det.className = "more";
            const sum = document.createElement("summary");
            const label = document.createElement("span");
            label.textContent = pluralCopy("plMoreSuggestions", nFolded);
            sum.appendChild(label);
            det.appendChild(sum);
            const inner = document.createElement("div");
            inner.className = "inner";
            for (const o of softer)
                inner.appendChild(outCard(o));
            for (const line of sugLines) {
                const el = document.createElement("p");
                el.className = "lead";
                linkNamesIn(el, line.text, line.marks);
                inner.appendChild(el);
            }
            det.appendChild(inner);
            foundBox.appendChild(det);
        }
        const compBox = document.createElement("div");
        compBox.className = "composebox";
        const ch = document.createElement("h4");
        ch.textContent = myBed.members.length ? copy.plSuggestCompanions : copy.plComposeFresh;
        compBox.appendChild(ch);
        const chint = document.createElement("p");
        chint.className = "hint";
        chint.textContent = myBed.members.length ? "" : copy.plComposeFreshHint;
        if (chint.textContent)
            compBox.appendChild(chint);
        const cbtn = document.createElement("button");
        cbtn.type = "button";
        cbtn.id = "composebtn";
        cbtn.className = "btn btn-secondary secondary";
        cbtn.textContent = myBed.members.length ? copy.plSuggestForThese : copy.plComposeFresh;
        compBox.appendChild(cbtn);
        const cout = document.createElement("div");
        cout.id = "composeout";
        compBox.appendChild(cout);
        cbtn.addEventListener("click", () => {
            const sibs = plotSiblings(candbedValue());
            const wantGroups = {};
            for (const m of myBed.members)
                wantGroups[m.species] = m.group ?? null;
            myBed.composeResult = compose({ ...obSite, siblings: sibs, want_groups: wantGroups }, myBed.members.map((m) => m.species), bundle);
            paint();
        });
        const renderCompose = (box, res) => {
            box.innerHTML = "";
            const FACT_COPY = {
                location: copy.plFactLocation,
                growing_area: copy.plFactArea,
                sun: copy.plFactSun,
            };
            if (res.refused) {
                const pr = document.createElement("p");
                pr.className = "lead";
                pr.textContent = fillCopy("plComposeRefused", { list: res.missing_facts.map((f) => FACT_COPY[f.fact] ?? f.fact).join(", ") });
                box.appendChild(pr);
                return;
            }
            const labelOf = (sid) => plantingLabel(bundle, sid, composedGroup(myBed.members, sid));
            if (res.proposal.length) {
                const ul = document.createElement("ul");
                ul.className = "composeplan";
                for (const p of res.proposal) {
                    const li = document.createElement("li");
                    const name = document.createElement("strong");
                    name.textContent = labelOf(p.species) + (p.count > 1 ? ` ×${p.count}` : "");
                    li.appendChild(name);
                    const w = document.createElement("span");
                    w.className = "warrant";
                    if (p.warrant.kind === "want") {
                        w.textContent = copy.plWarrantWant;
                    }
                    else if (p.warrant.kind === "ground") {
                        const a = document.createElement("a");
                        a.href = `#/why?rule=${p.warrant.rule}`;
                        a.textContent = stripRuleCitations(humanizeFamilies(p.warrant.why ?? ruleClaim(bundle, p.warrant.rule ?? "")));
                        markLink(a, { kind: "rule", id: p.warrant.rule ?? "" });
                        w.textContent = copy.plWarrantGround;
                        w.appendChild(a);
                    }
                    else {
                        const a = document.createElement("a");
                        a.href = `#/why?rule=${p.warrant.rule}`;
                        a.textContent = stripRuleCitations(ruleClaim(bundle, p.warrant.rule ?? ""));
                        markLink(a, { kind: "rule", id: p.warrant.rule ?? "" });
                        w.textContent = " - ";
                        w.appendChild(a);
                        const beside = p.warrant.beside ?? p.warrant.for;
                        if (beside)
                            w.appendChild(document.createTextNode(" " + fillCopy("plWarrantFor", { plant: midSentence(labelOf(beside)) })));
                    }
                    li.appendChild(w);
                    ul.appendChild(li);
                }
                box.appendChild(ul);
            }
            else {
                const none = document.createElement("p");
                none.className = "lead";
                none.textContent = res.fresh?.note
                    ?? copy.plNothingToPropose;
                box.appendChild(none);
            }
            for (const e of res.exclusions) {
                const pe = document.createElement("p");
                pe.className = "composeexcl";
                pe.textContent = `${labelOf(e.species)} - ${exclusionWords(e.why)}`;
                box.appendChild(pe);
            }
            if (res.split) {
                const ps = document.createElement("p");
                ps.className = "composesplit";
                const lows = res.split.low.map(labelOf);
                const steadies = res.split.steady.map(labelOf);
                const join = (xs) => xs.length <= 1 ? (xs[0] ?? "") : fillCopy("plListAnd", { list: xs.slice(0, -1).join(", "), last: xs[xs.length - 1] });
                ps.append(fillCopy(lows.length === 1 ? "plSplitOne" : "plSplitMany", { lows: join(lows), steadies: join(steadies) }));
                const team = bundle.guilds.find((g) => g.id === res.split?.team);
                const ta = document.createElement("a");
                ta.href = `#/plan?guild=${res.split.team}`;
                ta.textContent = team ? displayName(team) : res.split.team;
                ps.appendChild(ta);
                ps.append(" - ");
                const link = document.createElement("a");
                link.href = `#/why?rule=${res.split.rule}`;
                markLink(link, { kind: "rule", id: res.split.rule });
                link.textContent = copy.plOneWatering;
                ps.appendChild(link);
                ps.append(".");
                box.appendChild(ps);
            }
            for (const n of res.neighbours ?? []) {
                const pn = document.createElement("p");
                pn.className = "composenbr";
                const link = document.createElement("a");
                link.href = `#/why?rule=${n.rule}`;
                markLink(link, { kind: "rule", id: n.rule });
                if (n.kind === "served_by_neighbour") {
                    link.textContent = copy.plNbrServedByLink;
                    fillNodes$1(pn, fillCopy("plNbrServedBy", { from: String(n.detail.from), plant: midSentence(commonName(bundle, String(n.detail.species))) }), { link });
                }
                else if (n.kind === "serves_neighbour") {
                    link.textContent = copy.plNbrServesLink;
                    fillNodes$1(pn, fillCopy("plNbrServes", { to: String(n.detail.to) }), { link });
                }
                else if (n.kind === "joint_block_possible") {
                    link.textContent = copy.plNbrJointLink;
                    link.removeAttribute("href");
                    fillNodes$1(pn, fillCopy("plNbrJoint", { with: String(n.detail.with) }), { link });
                }
                else if (n.kind === "forward_foreclosure") {
                    link.textContent = copy.plNbrForeclosureLink;
                    fillNodes$1(pn, fillCopy("plNbrForeclosure", { family: familyInProse(String(n.detail.family)), beds: n.detail.with.join(", ") }), { link });
                }
                else if (n.kind === "kinds_across_beds") {
                    const sid = String(n.detail.species);
                    const mine = groupLabel(bundle, sid, String(n.detail.mine ?? ""));
                    const theirs = (n.detail.with ?? [])
                        .map((w) => fillCopy("plBedsPlants", { bed: w.bed, plants: groupLabel(bundle, sid, w.group).toLowerCase() })).join(copy.plAndJoin);
                    const r155 = bundle.rules.find((r) => r.id === "R-155")?.trigger;
                    const dm = r155?.distance_m ?? 76;
                    link.textContent = fillCopy("plNbrKindsLink", { days: r155?.tassel_offset_days ?? 14,
                        dist: unitSystem() === "metric" ? `${dm} m` : `${Math.round(dm / 0.3048 / 10) * 10} ${copy.unitFeetProse}` });
                    fillNodes$1(pn, fillCopy("plNbrKinds", { mine: mine.toLowerCase(), theirs }), { link });
                }
                else if (n.kind === "same_family_patch") {
                    link.textContent = copy.plNbrPatchLink;
                    fillNodes$1(pn, fillCopy("plNbrPatch", { family: familyInProse(String(n.detail.family)), beds: n.detail.with.join(", ") }), { link });
                }
                box.appendChild(pn);
            }
            const hb = document.createElement("p");
            hb.className = "composeband";
            hb.textContent = res.harmony.score > 0
                ? (res.harmony.band === "backed"
                    ? copy.plComposeBacked
                    : copy.plComposePartial)
                : copy.plComposeNone;
            box.appendChild(hb);
            if (res.disclosures.length) {
                const dd = document.createElement("p");
                dd.className = "hint";
                const names = {
                    rotation_history: copy.plFactRotation,
                    soil_test: copy.plFactSoilTest,
                };
                dd.textContent = fillCopy("plUnchecked", { list: res.disclosures.map((d) => names[d.fact] ?? d.fact).join("; ") });
                box.appendChild(dd);
            }
            if (res.novelty?.redirect && res.novelty.nearest) {
                const g = bundle.guilds.find((x) => x.id === res.novelty?.nearest);
                const pr = document.createElement("p");
                pr.className = "composeredirect";
                const a = document.createElement("a");
                a.href = `#/plan?guild=${res.novelty.nearest}`;
                a.textContent = g ? displayName(g) : res.novelty.nearest;
                fillNodes$1(pr, copy.plComposeRedirect, { team: a });
                box.appendChild(pr);
            }
            if (res.proposal.length) {
                const adopt = document.createElement("button");
                adopt.type = "button";
                adopt.id = "composeadopt";
                adopt.className = "btn btn-secondary stepnext";
                adopt.textContent = copy.plUsePlanting;
                adopt.addEventListener("click", () => {
                    if (!myBed.baseline)
                        myBed.baseline = { members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) };
                    const known = (sid) => bundle.species.some((s) => s.id === sid)
                        || (bundle.entities ?? []).some((e) => e.id === sid);
                    myBed.members = adoptComposed(myBed.members, res.proposal, known);
                    myBed.composed = true;
                    myBed.composedKept = myBed.members.filter((m) => !res.proposal.some((p) => p.species === m.species)).map((m) => m.species);
                    myBed.composeResult = null;
                    myBed.optimized = false;
                    myBed.tokenSig = "";
                    myBed.pendingArrange = true;
                    paint();
                });
                box.appendChild(adopt);
            }
        };
        if (myBed.composeResult)
            renderCompose(cout, myBed.composeResult);
        foundBox.appendChild(compBox);
    };
    paint();
}

let compareIds = [];
let compareBed = "";
const COMPARE_MAX = 3;
let tnameSeq = 0;
function renderEligibility(bundle, site, source) {
    const panel = $$3("eligibility");
    panel.innerHTML = "";
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
        return el;
    };
    if (source.kind === "derived") {
        const d = source.derived;
        const anyDeclared = d.contributions.some((c) => c.species === "");
        p(fillCopy(anyDeclared ? "plHistoryDeclared" : "plHistoryLogged", { bed: source.bed }), "provenance");
        if (site.season_year != null) {
            p(fillCopy("plPlantingYear", { year: site.season_year }), "provenance");
        }
        const isUserVariety = (sid) => app.userSpecies.some((u) => u.id === sid);
        for (const c of d.contributions) {
            if (c.species === "") {
                p(fillCopy("plDeclaredLine", { season: c.season, family: familyName(c.family) }), "provenance");
                continue;
            }
            const [lineHead, lineTail] = fillCopy("plLoggedLine", { season: c.season, family: familyName(c.family), area: fmtArea(c.overlap_m2) }).split("{plant}");
            const line = p(lineHead, "provenance");
            const name = commonName(bundle, c.species);
            if (!isUserVariety(c.species))
                line.appendChild(plantLink(name, c.species));
            else
                line.appendChild(document.createTextNode(name));
            line.appendChild(document.createTextNode(lineTail ?? ""));
        }
        if (d.unknown_species.length) {
            p(fillCopy("plUnknownSpecies", { list: d.unknown_species.map(humanize).join(", ") }), "provenance");
        }
        if (!d.contributions.length) {
            p(copy.plCleanGround);
        }
    }
    const carried = Object.values(site.history ?? {}).flat();
    if (!carried.length) {
        if (source.kind === "none") {
            p(copy.plLogToDerive);
        }
        return;
    }
    const res = eligibleSpecies(site, bundle);
    const carriedFams = carried.map((e) => (typeof e === "string" ? e : e.family));
    p(fillCopy("plGrewRecently", { families: [...new Set(carriedFams)].map(familyInProse).join(", "), ok: res.eligible.length, blocked: res.blocked.length }));
    for (const b of res.blocked) {
        const why = b.blocked_by.map((r) => reasonText(r.why)).join("; ");
        const label = commonName(bundle, b.species);
        const line = p("", "blocked");
        linkNameIn(line, `${label} - ${why}`, label, b.species);
        for (const r of b.blocked_by)
            if (r.rule)
                mark(line, { kind: "rule", id: r.rule });
    }
    for (const s of res.suggestions) {
        const el = p(fillCopy("plNotManyOptions", { families: s.families.map(familyInProse).reduce((a, b) => fillCopy("stJoinOr", { a, b })), why: reasonText(s.why) }), "suggest");
        mark(el, { kind: "rule", id: s.rule });
    }
}
function fitSvg(bedW, bedL, fmin, fits) {
    const d = fitDiagram(bedW, bedL, fmin);
    if (!d || !d.footprint)
        return null;
    const PX = 90;
    const maxM = Math.max(d.bed.w, d.bed.h, d.footprint.w, d.footprint.h);
    const s = PX / maxM;
    const svg = document.createElementNS(SVG_NS$2, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(d.footprint.w * s) + 8));
    svg.setAttribute("height", String(Math.ceil(d.footprint.h * s) + 8));
    const rect = (r, cls, title) => {
        const el = document.createElementNS(SVG_NS$2, "rect");
        el.setAttribute("x", String(4 + r.x * s));
        el.setAttribute("y", String(4 + r.y * s));
        el.setAttribute("width", String(r.w * s));
        el.setAttribute("height", String(r.h * s));
        el.setAttribute("class", cls);
        const t = document.createElementNS(SVG_NS$2, "title");
        t.textContent = title;
        el.appendChild(t);
        svg.appendChild(el);
    };
    rect(d.bed, "bed", fillCopy("plYourBedDims", { w: fmtLen(bedW), l: fmtLen(bedL) }));
    rect(d.footprint, fits ? "fp ok" : "fp over", fillCopy("plTeamNeedsArea", { area: fmtArea(fmin ?? 0) }));
    return svg;
}
function ringSvg(bedW, bedL, fmin, fits) {
    const ring = radialRingsFromFootprint(fmin ?? 0);
    if (!ring)
        return null;
    const dia = 2 * ring.r;
    const PX = 90;
    const s = PX / Math.max(bedW, bedL, dia);
    const svg = document.createElementNS(SVG_NS$2, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(Math.max(bedW, dia) * s) + 8));
    svg.setAttribute("height", String(Math.ceil(Math.max(bedL, dia) * s) + 8));
    const bed = document.createElementNS(SVG_NS$2, "rect");
    bed.setAttribute("x", "4");
    bed.setAttribute("y", "4");
    bed.setAttribute("width", String(bedW * s));
    bed.setAttribute("height", String(bedL * s));
    bed.setAttribute("class", "bed");
    const bt = document.createElementNS(SVG_NS$2, "title");
    bt.textContent = fillCopy("plYourBedDims", { w: fmtLen(bedW), l: fmtLen(bedL) });
    bed.appendChild(bt);
    svg.appendChild(bed);
    const circle = document.createElementNS(SVG_NS$2, "circle");
    circle.setAttribute("cx", String(4 + (bedW * s) / 2));
    circle.setAttribute("cy", String(4 + (bedL * s) / 2));
    circle.setAttribute("r", String(ring.r * s));
    circle.setAttribute("class", fits ? "fp ok" : "fp over");
    const ct = document.createElementNS(SVG_NS$2, "title");
    ct.textContent = fillCopy("plDripRingTitle", { dia: fmtLen(dia), area: fmtArea(fmin ?? 0) });
    circle.appendChild(ct);
    svg.appendChild(circle);
    return svg;
}
function pickedBedStructure() {
    const name = $$3("candbed")?.value ?? "";
    return app.logSnapshot.beds.find((b) => b.name === name)?.structure;
}
let guildFocus = null;
let guildMiss = null;
let guildFocusScrolled = false;
let nofitsOpen = false;
let allTeamsOpen = false;
const openTeamGroups = new Set();
let planAt = "teams";
let planPick = null;
let planFocusSeen = null;
let planSeat = false;
let planArrivePending = false;
let planListAsked = false;
function planDraftGuild() {
    const bed = candbedValue();
    if (!bed)
        return null;
    const season = seasonId() != null ? openSeason() : null;
    return (Array.isArray(season?.plan) ? season.plan : [])
        .find((e) => e.area === bed && typeof e.guild === "string")?.guild ?? null;
}
function consumeArrival() {
    if (!planArrivePending || !app.logHydrated || !candbedValue())
        return false;
    planArrivePending = false;
    const drafted = planListAsked ? null : planDraftGuild();
    planListAsked = false;
    if (!drafted || planAt !== "teams" || matchMedia("(min-width: 900px)").matches)
        return false;
    planPick = drafted;
    planAt = "team";
    return true;
}
let planRedraw = null;
function teamsFitLine(fit, total) {
    if (total <= 0)
        return "";
    if (fit <= 0)
        return fillCopy("plFitNone", { total });
    if (fit === total)
        return fillCopy("plFitAll", { total });
    return fillCopy("plFitSome", { fit, total });
}
function teamCounts(all, fits, smallerFits) {
    const greyed = all.filter((g) => !fits(g));
    const smaller = greyed.filter(smallerFits).length;
    return { total: all.length, fit: all.length - greyed.length + smaller, greyed: greyed.length, smaller };
}
function noFitFoldTitle(c, area) {
    const none = c.greyed - c.smaller;
    if (none <= 0)
        return pluralCopy("plFitsOnlySmallerAll", c.smaller);
    const one = none === 1;
    const lead = area != null
        ? fillCopy(one ? "plNoFitYourBedOne" : "plNoFitYourBedMany", { n: none, area })
        : fillCopy(one ? "plNoFitThisBedOne" : "plNoFitThisBedMany", { n: none });
    return c.smaller > 0 ? `${lead} · ${pluralCopy("plFitsOnlySmaller", c.smaller)}` : lead;
}
function fillUpref(up, hoisted, onTeamStep) {
    up.replaceChildren();
    const names = document.createElement("span");
    hoisted.forEach((g, i) => {
        if (i)
            names.appendChild(document.createTextNode(", "));
        const b = document.createElement("button");
        b.type = "button";
        b.className = "link upref-go";
        b.dataset.guild = g.id;
        b.textContent = displayName(g);
        b.addEventListener("click", (e) => {
            e.preventDefault();
            planPick = g.id;
            planAt = "team";
            planSeat = true;
            planRedraw?.();
        });
        names.appendChild(b);
    });
    fillNodes$3(up, onTeamStep ? copy.plSmallerFitsHere : copy.plSmallerFits, { teams: names });
}
function planBackLabel(at, fit) {
    if (at === "teams")
        return fit <= 0 ? copy.planBackMyBedNoFit : copy.planBackMyBed;
    if (fit <= 0)
        return copy.plBackTeams;
    return pluralCopy("plBackFit", fit);
}
function askedCrop(bundle) {
    try {
        const crop = JSON.parse(localStorage.getItem("gg-answers") ?? "{}").crop;
        return typeof crop === "string" && bundle.species.some((sp) => sp.id === crop) ? crop : null;
    }
    catch {
        return null;
    }
}
function setGuildFocus(id, known = true) {
    if (id == null) {
        guildFocus = null;
        guildMiss = null;
        planFocusSeen = null;
        return;
    }
    if (known) {
        guildFocus = id;
        guildMiss = null;
        guildFocusScrolled = false;
        planFocusSeen = null;
    }
    else {
        guildFocus = null;
        guildMiss = id;
    }
}
const missText = {
    absent: (id) => fillCopy("plMissAbsent", { id }),
    unplannable: (id) => fillCopy("plMissUnplannable", { id }),
};
function guildMissNote(text) {
    const miss = document.createElement("p");
    miss.className = "guildmiss";
    miss.textContent = text;
    return miss;
}
const GUILD_GUIDE = {
    three_sisters: { slug: "build-a-three-sisters-mound", label: copy.plGuideThreeSisters },
    milpa: { slug: "what-is-a-milpa", label: copy.plGuideMilpa },
};
function firstShape(bundle) {
    const [w, l] = firstBedSize(unitSystem() === "metric");
    const bed = { w, l, structure: "raised", pots: false };
    if (spaceChoice() !== "pots")
        return bed;
    const fp = bundle.guilds.filter((g) => forPots(g) && typeof g.footprint_min_m2 === "number").map((g) => g.footprint_min_m2);
    if (!fp.length)
        return bed;
    const side = Math.ceil(Math.sqrt(Math.min(...fp)) * 100) / 100;
    return { w: side, l: side, structure: "container", pots: true };
}
function firstBedLead(bundle, shape = firstShape(bundle)) {
    const reg = { shape: "rect", x: 0, y: 0, w: shape.w, h: shape.l };
    const st = (g) => guildStatus(g, shape.w, shape.l, bundle, shape.structure, reg);
    const pool = shape.pots ? [...browsableGuilds(bundle), ...bundle.guilds.filter((g) => g.derived_from && forPots(g))] : browsableGuilds(bundle);
    const fitting = pool.filter((g) => st(g).fits);
    if (!fitting.length)
        return null;
    const lift = shape.pots ? teamLift("pots", null, bundle) : null;
    const ranked = fitting.map((g, i) => ({ g, i }))
        .sort((a, b) => (lift ? Number(lift.lifts(b.g)) - Number(lift.lifts(a.g)) : 0)
        || (shortlistRank(a.g.derived_harmony?.band, st(a.g).tier) - shortlistRank(b.g.derived_harmony?.band, st(b.g).tier)) || a.i - b.i);
    return ranked[0].g;
}
function proposeFirstBed(bundle, site) {
    const host = document.getElementById("firstbed");
    if (!host)
        return;
    if (app.groundProposalTaken?.()) {
        host.hidden = true;
        firstBedHidden();
        return;
    }
    const shape = firstShape(bundle);
    const lead = firstBedLead(bundle, shape);
    if (!lead) {
        host.hidden = true;
        firstBedHidden();
        return;
    }
    const sub = document.getElementById("fb-sub");
    const sunRow = document.getElementById("fb-sun");
    const sunWord = firstBedSun() === "part_shade" ? copy.plPartShadeLc : copy.plFullSunLc;
    if (sub)
        sub.textContent = copy.firstBedLede;
    const bedLine = document.getElementById("fb-bedline");
    const dims = { w: fmtLen(shape.w), l: fmtLen(shape.l), sun: sunWord };
    if (bedLine)
        bedLine.textContent = shape.pots ? fillCopy("plFirstPotLine", dims) : fillCopy("plFirstBedLine", dims);
    const pots = document.getElementById("fb-pots");
    if (pots) {
        pots.textContent = shape.pots ? copy.plFirstBedNotPots : copy.plFirstBedPots;
        if (!pots.dataset.wired) {
            pots.dataset.wired = "1";
            pots.addEventListener("click", () => {
                setSpaceChoice(firstShape(bundle).pots ? "raised" : "pots");
                app.groundClearProposal?.();
                proposeFirstBed(bundle, site);
            });
        }
    }
    const teamLine = document.getElementById("fb-teamline");
    if (teamLine)
        teamLine.textContent = displayName(lead);
    if (sunRow && !sunRow.dataset.wired) {
        sunRow.dataset.wired = "1";
        sunRow.addEventListener("click", (e) => {
            const b = e.target.closest(".ba-choice");
            if (!b)
                return;
            for (const c of sunRow.querySelectorAll(".ba-choice")) {
                c.setAttribute("aria-checked", String(c === b));
            }
            proposeFirstBed(bundle, site);
        });
    }
    const team = document.getElementById("fb-team");
    if (team) {
        const claim = mechanismRows(lead, bundle).rows[0]?.claim ?? null;
        team.textContent = claim ? `${displayName(lead)}: ${plainClaim(stripRuleCitations(teamClaim(lead, claim)), gardenLat()).replace(/\.$/, "")}.` : displayName(lead);
    }
    const first = document.getElementById("fb-first");
    if (first) {
        const year = seasonId() ?? new Date().getFullYear();
        const todayIso = localTodayIso();
        const bed = { region: { shape: "rect", x: 0, y: 0, w: shape.w, h: shape.l }, structure: shape.structure };
        const bounds = gardenBounds(site, bundle);
        const win = teamPlantWindow(lead, bed, site, bundle, undefined, year, todayIso, bounds.freeze, bounds.shift);
        if (win.first) {
            first.textContent = fillCopy("plFirstJob", { day: dayWord(win.first.date), what: jobWhat(win.first.kind, copy.plJobAfterFrost) });
            first.hidden = false;
        }
        else if (win.status === "passed") {
            first.textContent = [copy.plWindowPassed, heldByLine(bundle, win.holdBy)].filter(Boolean).join(" ");
            first.hidden = false;
        }
        else if (win.late) {
            first.textContent = fillCopy("gmStillTimeThisYear", { day: dayWord(win.late) });
            first.hidden = false;
        }
        else
            first.hidden = true;
    }
    const keep = document.getElementById("fb-keep");
    if (keep && !keep.dataset.wired) {
        keep.dataset.wired = "1";
        keep.addEventListener("click", () => void keepFirstBed(bundle, site, keep));
    }
    floatActsAfterHead(host);
    if (keep) {
        keep.dataset.lead = lead.id;
        keep.dataset.w = String(shape.w);
        keep.dataset.l = String(shape.l);
        keep.dataset.structure = shape.structure;
    }
    const other = document.getElementById("fb-other");
    if (other && !other.dataset.wired) {
        other.dataset.wired = "1";
        other.addEventListener("click", () => void otherTeamFirstBed());
    }
    const resize = document.getElementById("fb-resize");
    if (resize && !resize.dataset.wired) {
        resize.dataset.wired = "1";
        resize.addEventListener("click", () => {
            const dims = app.groundDropProposal?.() ?? null;
            window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "sec-ground" } }));
            app.bedAddOpenAt?.("size", firstBedSun(), dims);
        });
    }
    const skip = document.getElementById("fb-skip");
    if (skip && !skip.dataset.wired) {
        skip.dataset.wired = "1";
        skip.addEventListener("click", () => {
            app.groundDropProposal?.();
            host.hidden = true;
            firstBedHidden();
            window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "sec-ground" } }));
            app.bedAddOpenAt?.("how", null);
        });
    }
    host.hidden = false;
    app.groundProposeRect?.(shape.w, shape.l, shape.structure, site.lat ?? 0);
}
function firstBedSun() {
    const on = document.querySelector('#fb-sun .ba-choice[aria-checked="true"]');
    return on?.dataset.value === "part_shade" ? "part_shade" : "full";
}
async function makeFirstBed() {
    const kb = document.getElementById("fb-keep");
    const [dw, dl] = firstBedSize(unitSystem() === "metric");
    const fw = Number(kb?.dataset.w) || dw, fl = Number(kb?.dataset.l) || dl;
    const fs = kb?.dataset.structure === "container" ? "container" : "raised";
    if (!app.logDb)
        return null;
    const beds = app.logSnapshot.beds;
    const name = nextBedName(beds, (n) => fillCopy("bedDefaultName", { n }));
    const sun = firstBedSun();
    const kept = (await app.groundKeepProposal?.(name, sun)) ?? false;
    if (!kept) {
        const o = nextOrigin(beds);
        countRung("bed-saved");
        await placeBed(app.logDb, app.currentPlotId, name, { shape: "rect", x: o.x, y: o.y, w: Math.round(fw * 100) / 100, h: Math.round(fl * 100) / 100 }, undefined, sun, fs, true);
    }
    const year = new Date().getFullYear();
    if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
        await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
    }
    await app.logRefresh?.();
    const sel = document.getElementById("candbed");
    if (sel) {
        sel.value = name;
        sel.dispatchEvent(new Event("change"));
    }
    return name;
}
let actsWatch = null;
function firstBedHidden() {
    actsWatch?.disconnect();
    actsWatch = null;
}
function floatActsAfterHead(host) {
    const head = host.querySelector(".fb-kicker");
    if (!head || typeof IntersectionObserver === "undefined")
        return;
    const scroller = scrollerFor(host);
    const root = scroller instanceof HTMLElement ? scroller : null;
    if (actsWatch && (actsWatch.root ?? null) === root)
        return;
    actsWatch?.disconnect();
    actsWatch = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.rootBounds)
                continue;
            host.toggleAttribute("data-float", e.boundingClientRect.top <= e.rootBounds.bottom);
        }
    }, { root, rootMargin: "0px 0px -85% 0px", threshold: 0 });
    actsWatch.observe(head);
}
async function keepFirstBed(bundle, site, btn) {
    btn.disabled = true;
    try {
        const leadId = btn.dataset.lead;
        const name = await makeFirstBed();
        if (!name) {
            btn.disabled = false;
            btn.textContent = copy.plLogNotReadyCap;
            return;
        }
        if (leadId)
            await savePlanSelection(leadId, name, btn, bundle, site, undefined, true);
        window.dispatchEvent(new CustomEvent("gg-sheet-reveal", { detail: { bed: name } }));
    }
    catch (e) {
        btn.disabled = false;
        btn.textContent = `${e instanceof Error ? e.message : e}`;
    }
}
async function otherTeamFirstBed() {
    const name = await makeFirstBed();
    if (!name)
        return;
    const kept = document.getElementById("plan-kept");
    if (kept) {
        kept.textContent = fillCopy("plBedKept", { name });
        kept.hidden = false;
    }
    window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "step-plan" } }));
}
function renderGuilds(bundle, site, cards = true) {
    installPlanSeams(bundle, site);
    if (!cards)
        return;
    const list = $$3("guilds");
    list.innerHTML = "";
    delete list.dataset.teamsFit;
    delete list.dataset.teamsTotal;
    const subLine = $$3("plan-sub");
    if (subLine) {
        subLine.replaceChildren();
        subLine.hidden = true;
    }
    if (app.logSnapshot.beds.length === 0) {
        list.appendChild(teamsLockNote());
        return;
    }
    if (guildMiss)
        list.appendChild(guildMissNote(missText.absent(guildMiss)));
    const plotSlot = document.createElement("div");
    list.appendChild(plotSlot);
    const reg = currentBedRegion();
    const pts = reg ? regionPoints(reg) : null;
    const bw = pts ? Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) : null;
    const bl = pts ? Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) : null;
    const st = (g) => guildStatus(g, bw, bl, bundle, pickedBedStructure(), reg);
    const all = browsableGuilds(bundle);
    const greyed = all.filter((g) => !st(g).fits);
    if (bw != null && bl != null) {
        const basis = document.createElement("p");
        basis.className = "teamsbasis";
        const ic = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ic.setAttribute("viewBox", "0 0 24 24");
        ic.setAttribute("class", "basisicon");
        ic.setAttribute("aria-hidden", "true");
        ic.innerHTML = '<path d="M4 6h14M4 12h10M4 18h6" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>';
        basis.appendChild(ic);
        const sun = currentBedSun();
        const bits = [`${fmtLen(bw)} × ${fmtLen(bl)}`];
        if (sun)
            bits.push(sun === "full" ? copy.plFullSunLc : copy.plPartShadeLc);
        let hist = "";
        const seasons = Object.keys(site.history ?? {}).sort();
        const last = seasons[seasons.length - 1];
        if (last) {
            const fams = [...new Set((site.history?.[last] ?? [])
                    .map((e) => (typeof e === "string" ? e : e.family)))];
            if (fams.length)
                hist = fillCopy("plBasisAfter", { year: last, families: fams.map(familyInProse).join(" + ") });
        }
        basis.appendChild(document.createTextNode(fillCopy("plBasisFor", { bed: bits.join(" · "), hist })));
        const subHost = $$3("plan-sub");
        const row = document.createElement("span");
        row.className = "basisline";
        row.append(...basis.childNodes);
        if (subHost) {
            subHost.replaceChildren(row);
            subHost.hidden = false;
        }
        else
            list.appendChild(basis);
    }
    const promotedByParent = new Map();
    for (const parent of greyed) {
        const kids = derivedGuilds(parent.id, bundle).filter((v) => st(v).fits);
        if (kids.length)
            promotedByParent.set(parent.id, kids);
    }
    const counts = teamCounts(all, (g) => st(g).fits, (g) => promotedByParent.has(g.id));
    const buildCard = (guild, promotedFrom = null, lead = false) => {
        const card = guildCard(guild, site, bundle, bw, bl, false, lead, promotedFrom);
        const status = st(guild);
        const body = (card.querySelector(".teambody") ?? card);
        const hoisted = promotedByParent.get(guild.id) ?? [];
        if (hoisted.length) {
            const up = document.createElement("p");
            up.className = "upref";
            fillUpref(up, hoisted, false);
            body.appendChild(up);
        }
        const hoistedIds = new Set(hoisted.map((g) => g.id));
        const variants = derivedGuilds(guild.id, bundle).filter((v) => status.fits || !hoistedIds.has(v.id));
        if (variants.length) {
            const rec = status.offer;
            const wrap = document.createElement("div");
            wrap.className = "variants";
            const label = document.createElement("p");
            label.className = "variants-label";
            label.textContent = fillCopy("plVariantsOf", { team: displayName(guild), n: variants.length });
            wrap.appendChild(label);
            for (const v of variants)
                wrap.appendChild(guildCard(v, site, bundle, bw, bl, true, rec?.id === v.id));
            body.appendChild(wrap);
        }
        const gg = GUILD_GUIDE[guild.id];
        if (gg) {
            const gl = document.createElement("a");
            gl.className = "teamguide";
            gl.href = `../guides/${gg.slug}/`;
            gl.textContent = `${gg.label}\u00a0›`;
            body.appendChild(gl);
        }
        return card;
    };
    const tops = [];
    const fitting = [];
    for (const g of all) {
        if (st(g).fits)
            fitting.push({ guild: g, from: null });
        else
            for (const v of promotedByParent.get(g.id) ?? [])
                fitting.push({ guild: v, from: g });
    }
    const bySection = new Map();
    for (const f of fitting) {
        const sec = guildSection(f.guild);
        if (!sec)
            continue;
        (bySection.get(sec) ?? bySection.set(sec, []).get(sec)).push(f);
    }
    const teamsSec = bySection.get("teams");
    if (teamsSec) {
        teamsSec.sort((a, b) => bandRank(a.guild.derived_harmony?.band) - bandRank(b.guild.derived_harmony?.band));
    }
    const SECTION_COPY = {
        teams: { h: copy.teamsSectionTeamsH, sub: copy.teamsSectionTeamsSub },
        rings: { h: copy.teamsSectionRingsH, sub: copy.teamsSectionRingsSub },
        bundles: { h: copy.teamsSectionBundlesH, sub: copy.teamsSectionBundlesSub },
        rest: { h: copy.teamsSectionRestH, sub: copy.teamsSectionRestSub },
    };
    const rankOf = new Map(fitting.map((f) => [f.guild.id, shortlistRank(f.guild.derived_harmony?.band, st(f.guild).tier)]));
    const ranked = fitting.map((f, i) => ({ ...f, i })).sort((a, b) => (rankOf.get(a.guild.id) ?? 99) - (rankOf.get(b.guild.id) ?? 99) || a.i - b.i);
    if (!Object.keys(site.history ?? {}).length) {
        const rest = ranked.filter((f) => f.guild.guild_class === "restorative");
        if (rest.length && rest.length < ranked.length)
            ranked.splice(0, ranked.length, ...ranked.filter((f) => f.guild.guild_class !== "restorative"), ...rest);
    }
    const rest = groundRest(site, bundle);
    const resting = rest ? ranked.filter((f) => rest.rests(f.guild)) : [];
    const restsAt = rest ? ranked.map((f) => rest.rests(f.guild)) : [];
    const restMoved = restsAt.indexOf(true) !== -1 && restsAt.indexOf(true) < restsAt.lastIndexOf(false);
    if (rest && restMoved)
        ranked.splice(0, ranked.length, ...ranked.filter((f) => !rest.rests(f.guild)), ...resting);
    const lift = teamLift(spaceChoice(), afterChoice(), bundle);
    const lifted = lift ? ranked.filter((f) => lift.lifts(f.guild)) : [];
    if (lift && lifted.length)
        ranked.splice(0, ranked.length, ...lifted, ...ranked.filter((f) => !lift.lifts(f.guild)));
    const asked = askedCrop(bundle);
    const cropTeamIds = asked ? new Set(teamsForPlant(asked, bundle)) : null;
    const growsAsked = (f) => !!cropTeamIds && (cropTeamIds.has(f.guild.id) || (!!f.from && cropTeamIds.has(f.from.id)));
    const cropLifted = ranked.filter(growsAsked);
    if (cropLifted.length)
        ranked.splice(0, ranked.length, ...cropLifted, ...ranked.filter((f) => !growsAsked(f)));
    const SHORTLIST_N = 3;
    const restIds = new Set(ranked.slice(SHORTLIST_N).map((f) => f.guild.id));
    const bedNameNow = candbedValue();
    const compareKeyNow = `${app.currentPlotId}|${bedNameNow}`;
    if (compareBed !== compareKeyNow) {
        compareIds = [];
        compareBed = compareKeyNow;
    }
    const fittingById = new Map(fitting.map((f) => [f.guild.id, f.guild]));
    compareIds = compareIds.filter((id) => fittingById.has(id));
    const compareBtn = (g) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip cmpbtn tertiary";
        const on = compareIds.includes(g.id);
        b.setAttribute("aria-pressed", String(on));
        b.textContent = on ? copy.plComparing : copy.plCompare;
        b.title = on ? copy.plCompareOffTitle : copy.plCompareOnTitle;
        b.addEventListener("click", () => {
            if (compareIds.includes(g.id))
                compareIds = compareIds.filter((x) => x !== g.id);
            else if (compareIds.length >= COMPARE_MAX) {
                toast(fillCopy("plCompareMax", { team: displayName(g) }));
                return;
            }
            else
                compareIds = [...compareIds, g.id];
            renderGuilds(bundle, site);
        });
        return b;
    };
    const teamFacts = (g) => {
        const s0 = st(g);
        const inst = instantiate(g, site, bundle);
        const chosen = inst.roles.length
            ? inst.roles.filter((r) => r.chosen).map((r) => [r.chosen, r.options.find((o) => o.filler === r.chosen)?.group ?? null])
            : memberSpecies(g);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedNameNow);
        const region = planBedRegion(bed);
        const n = inst.roles.length || chosen.length;
        const placedN = region ? placeGuildPlants(g, { name: bed?.name ?? bedNameNow, region, structure: bed?.structure, lane_flip: bed?.lane_flip }, site, bundle).length : 0;
        const seasonYear = seasonId() ?? new Date().getFullYear();
        const tasks = gardenTasks(g, site.lat ?? null, site.lon ?? null, seasonYear, bundle).slice().sort((a, b) => a.date.localeCompare(b.date));
        const win = plantingWindowFor(site.lat ?? null, site.lon ?? null, chosen.map((c) => c[0]), bundle);
        const dtms = spacingRows(chosen, bundle).map((r) => r.days_to_maturity).filter((d) => d != null);
        return {
            fit: s0.fits ? (s0.tier ? TIER_UI[s0.tier].label : copy.plFits) : copy.plWontFit,
            band: harmonyBand(g).label,
            plants: placedN,
            jobs: n,
            first: tasks.find((t) => t.kind !== "log_first_freeze") ?? null,
            days: win?.growing_season_days ?? null,
            dtm: dtms.length ? Math.max(...dtms) : null,
            heat: !!win?.heat_limited,
        };
    };
    if (compareIds.length >= 1) {
        const panel = document.createElement("section");
        panel.id = "compare";
        panel.className = "compare";
        const head = document.createElement("div");
        head.className = "compare-h";
        const title = document.createElement("h3");
        title.className = "compare-title";
        title.textContent = compareIds.length >= 2 ? fillCopy("plSideBySide", { bed: bedNameNow }) : copy.plComparing;
        head.appendChild(title);
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "btn btn-quiet tertiary cmpclear";
        clear.textContent = copy.plClear;
        clear.addEventListener("click", () => { compareIds = []; renderGuilds(bundle, site); });
        head.appendChild(clear);
        panel.appendChild(head);
        if (compareIds.length < 2) {
            const hint = document.createElement("p");
            hint.className = "compare-hint";
            hint.textContent = fillCopy("plCompareHint", { team: displayName(fittingById.get(compareIds[0])) });
            panel.appendChild(hint);
        }
        else {
            const teams = compareIds.map((id) => fittingById.get(id));
            const facts = teams.map(teamFacts);
            const wrap = document.createElement("div");
            wrap.className = "compare-scroll";
            const table = document.createElement("table");
            table.className = "cmptable";
            table.style.setProperty("--cmp-n", String(teams.length));
            table.setAttribute("role", "table");
            const thead = document.createElement("thead");
            thead.setAttribute("role", "rowgroup");
            const hr = document.createElement("tr");
            hr.setAttribute("role", "row");
            hr.appendChild(document.createElement("th"));
            for (const t of teams) {
                const th = document.createElement("th");
                th.scope = "col";
                th.setAttribute("role", "columnheader");
                th.textContent = displayName(t);
                hr.appendChild(th);
            }
            thead.appendChild(hr);
            table.appendChild(thead);
            const tbody = document.createElement("tbody");
            tbody.setAttribute("role", "rowgroup");
            const row = (label, cells, cls = "") => {
                const tr = document.createElement("tr");
                tr.setAttribute("role", "row");
                if (cls)
                    tr.className = cls;
                const th = document.createElement("th");
                th.scope = "row";
                th.setAttribute("role", "rowheader");
                th.textContent = label;
                tr.appendChild(th);
                for (const c of cells) {
                    const td = document.createElement("td");
                    td.setAttribute("role", "cell");
                    td.textContent = c;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            };
            const fmtDate = fmtMonthDay;
            row(copy.plCmpFit, facts.map((f) => f.fit), "cmp-fit");
            row(copy.plCmpEvidence, facts.map((f) => f.band), "cmp-band");
            row(copy.plCmpPlants, facts.map((f) => (f.plants > 0 ? String(f.plants) : copy.plNotSizedYet)), "cmp-plants");
            row(copy.plCmpJobs, facts.map((f) => String(f.jobs)), "cmp-jobs");
            row(copy.plCmpFirst, facts.map((f) => f.first ? `${fmtDate(f.first.date)} - ${jobWhat(f.first.kind, copy.plTaskAfterFrost)}` : site.lat != null ? copy.plCmpNoPlantDate : copy.plCmpNoDates), "cmp-first");
            row(copy.plCmpSeason, facts.map((f) => f.days != null
                ? (f.dtm != null
                    ? fillCopy("plCmpSeasonDtm", { days: f.days, dtm: f.dtm, tight: f.dtm > f.days ? copy.plCmpTight : "", heat: f.heat ? copy.plCmpHot : "" })
                    : fillCopy("plCmpSeasonDays", { days: f.days, heat: f.heat ? copy.plCmpHot : "" }))
                : copy.plCmpNotKnown), "cmp-season");
            const tr = document.createElement("tr");
            tr.className = "cmp-save";
            tr.setAttribute("role", "row");
            tr.appendChild(document.createElement("th"));
            for (const t of teams) {
                const td = document.createElement("td");
                td.setAttribute("role", "cell");
                const b = document.createElement("button");
                b.type = "button";
                b.className = "btn btn-primary primary cmpsave";
                b.textContent = fillCopy("plSaveAsPlan", { bed: bedNameNow });
                b.addEventListener("click", () => void savePlanSelection(t.id, bedNameNow, b));
                td.appendChild(b);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
            table.appendChild(tbody);
            wrap.appendChild(table);
            panel.appendChild(wrap);
        }
        list.appendChild(panel);
    }
    {
        const allBeds = app.logSnapshot.beds;
        const plannable = allBeds.filter((b) => !bedHasSections(b.name, allBeds));
        const season = seasonId() != null ? openSeason() : null;
        const planned = new Map();
        for (const e of (Array.isArray(season?.plan) ? season.plan : [])) {
            if (!e.area || !plannable.some((b) => b.name === e.area))
                continue;
            if (typeof e.guild === "string")
                planned.set(e.area, e.guild);
            else if (e.mybed === true)
                planned.set(e.area, "");
        }
        const block = plotBlock(bundle, plannable, ranked[0]?.guild?.id ?? null, { bare: () => plannable.every((b) => app.bedRotationSeasons?.(b.region) == null), leadBed: candbedValue(), planned }, site);
        if (block)
            plotSlot.replaceWith(block);
        else
            plotSlot.remove();
    }
    if (asked && cropLifted.length) {
        const why = document.createElement("p");
        why.className = "hint teamlift croplift";
        why.textContent = fillCopy("plLiftCrop", { crop: commonName(bundle, asked).toLowerCase() });
        list.appendChild(why);
    }
    if (lift && lifted.length) {
        const why = document.createElement("p");
        why.className = "hint teamlift";
        why.textContent = fillCopy("plLiftLine", { line: lift.line });
        list.appendChild(why);
    }
    const shortRests = ranked.slice(0, SHORTLIST_N).map((f) => !!rest?.rests(f.guild));
    const restLast = shortRests.indexOf(true) === -1 || shortRests.indexOf(true) > shortRests.lastIndexOf(false);
    if (rest && restMoved && restLast) {
        const why = document.createElement("p");
        why.className = "hint teamlift restlast";
        why.textContent = rest.line(resting.map((f) => f.guild));
        list.appendChild(why);
    }
    const bedNow = app.logSnapshot.beds.find((b) => b.name === bedNameNow);
    const seasonNow = seasonId() != null ? openSeason() : null;
    const plantedNow = !!bedNow && (seasonNow?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bedNow.region));
    const planNow = bedNow ? (Array.isArray(seasonNow?.plan) ? seasonNow.plan : [])
        .find((e) => e.area === bedNow.name && typeof e.guild === "string")?.guild ?? null : null;
    const useBtn = (g, card) => {
        if (!bedNow || plantedNow)
            return null;
        if (planNow === g.id) {
            const tag = document.createElement("span");
            tag.className = "badge solid tone-positive teamisplan";
            tag.textContent = copy.plTeamIsPlan;
            return tag;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip teamuse";
        b.textContent = copy.plUseTeam;
        b.addEventListener("click", () => {
            card.querySelector(".applybox button.saveplan:not(:disabled)")?.click();
        });
        return b;
    };
    const cardActs = (g, card) => {
        const acts = document.createElement("div");
        acts.className = "tacts";
        const head = card.querySelector("summary .tname");
        if (head) {
            acts.setAttribute("role", "group");
            acts.setAttribute("aria-labelledby", head.id);
        }
        const use = useBtn(g, card);
        if (use)
            acts.appendChild(use);
        acts.appendChild(compareBtn(g));
        return acts;
    };
    let leadOpen = true;
    for (const f of ranked.slice(0, SHORTLIST_N)) {
        const c = buildCard(f.guild, f.from, leadOpen);
        leadOpen = false;
        list.append(c, cardActs(f.guild, c));
        tops.push(c);
    }
    let allWrap = null;
    if (restIds.size > 0) {
        const details = document.createElement("details");
        details.className = "allteams disclosure";
        details.open = allTeamsOpen;
        const summ = document.createElement("summary");
        summ.className = "allteams-toggle";
        details.appendChild(summ);
        let shown = 0;
        details.addEventListener("toggle", () => { allTeamsOpen = details.open; });
        const groups = SECTION_ORDER.map((sec) => [sec, (bySection.get(sec) ?? []).filter((f) => restIds.has(f.guild.id))])
            .filter(([, members]) => members.length);
        for (const [sec, members] of groups) {
            const grp = document.createElement("details");
            grp.className = "teamgroup disclosure";
            grp.dataset.section = sec;
            grp.open = groups.length === 1 || openTeamGroups.has(sec);
            grp.addEventListener("toggle", () => { if (grp.open)
                openTeamGroups.add(sec);
            else
                openTeamGroups.delete(sec); });
            const gs = document.createElement("summary");
            gs.className = "teamgroup-toggle";
            const head = document.createElement("h3");
            head.className = "teamsection";
            head.dataset.section = sec;
            head.textContent = SECTION_COPY[sec].h;
            const n = document.createElement("span");
            n.className = "fold-n";
            n.textContent = `\u00b7 ${members.length}`;
            gs.append(head, n);
            grp.appendChild(gs);
            const sub = document.createElement("p");
            sub.className = "teamsection-sub";
            sub.textContent = SECTION_COPY[sec].sub;
            grp.appendChild(sub);
            for (const f of members) {
                const c = buildCard(f.guild, f.from, false);
                grp.append(c, cardActs(f.guild, c));
                tops.push(c);
                shown++;
            }
            details.appendChild(grp);
        }
        summ.textContent = copy.teamsOtherFoldH.replace("{n}", String(shown));
        list.appendChild(details);
        allWrap = details;
    }
    {
        if (greyed.length) {
            const details = list;
            const fold = document.createElement("button");
            fold.type = "button";
            fold.className = "nofits-toggle";
            fold.setAttribute("aria-expanded", String(nofitsOpen));
            const t = document.createElement("span");
            t.className = "nofits-title";
            t.textContent = noFitFoldTitle(counts, bw != null && bl != null ? fmtArea(bw * bl) : null);
            const ch = document.createElement("span");
            ch.className = "chev";
            ch.textContent = "▾";
            ch.setAttribute("aria-hidden", "true");
            fold.append(t, ch);
            details.appendChild(fold);
            const folded = [];
            const potFirst = (g) => forPots(g) || derivedGuilds(g.id, bundle).some(forPots);
            const greyedShown = pickedBedStructure() === "container"
                ? [...greyed.filter(potFirst), ...greyed.filter((g) => !potFirst(g))] : greyed;
            for (const g of greyedShown) {
                const c = buildCard(g);
                c.hidden = !nofitsOpen;
                details.appendChild(c);
                tops.push(c);
                folded.push(c);
            }
            fold.onclick = () => {
                nofitsOpen = !nofitsOpen;
                fold.setAttribute("aria-expanded", String(nofitsOpen));
                for (const c of folded)
                    c.hidden = !nofitsOpen;
            };
        }
    }
    let matched = null;
    let matchedTop = null;
    if (guildFocus && reg) {
        const top = tops.find((d) => d.dataset.guild === guildFocus) ?? null;
        if (top) {
            matched = top;
            matchedTop = top;
        }
        else {
            const nested = list.querySelector(`details.variant[data-guild="${guildFocus}"]`);
            if (nested) {
                matched = nested;
                matchedTop = nested.closest("details.team:not(.variant)");
            }
            else if (!guildMiss)
                list.prepend(guildMissNote(missText.unplannable(guildFocus)));
        }
    }
    if (matched && (matched.hidden || matchedTop?.hidden)) {
        nofitsOpen = true;
        list.querySelector(".nofits-toggle")?.setAttribute("aria-expanded", "true");
        for (const d of tops)
            if (d.hidden)
                d.hidden = false;
    }
    if (matched && allWrap && allWrap.contains(matched)) {
        if (!allWrap.open)
            allWrap.open = true;
        const grp = matched.parentElement?.closest("details.teamgroup");
        if (grp && !grp.open)
            grp.open = true;
    }
    const opening = matchedTop ?? tops.find((d) => !d.hidden) ?? null;
    if (opening) {
        opening.dataset.renderOpen = "1";
        opening.open = true;
        for (const o of tops)
            if (o !== opening)
                o.open = false;
    }
    if (matched && matched !== opening) {
        matched.dataset.renderOpen = "1";
        matched.open = true;
    }
    if (matched && !guildFocusScrolled) {
        guildFocusScrolled = true;
        const step = document.getElementById("step-plan");
        if (step && !step.open)
            step.open = true;
        seat(scrollerFor(matched), matched, { block: "center", force: true, hold: 1200, reason: "team-deep-link" });
    }
    for (const d of tops) {
        d.addEventListener("toggle", () => {
            if (d.open)
                for (const o of tops)
                    if (o !== d)
                        o.open = false;
        });
    }
    const { total, fit } = counts;
    list.dataset.teamsFit = String(fit);
    list.dataset.teamsTotal = String(total);
    const nudge = document.getElementById("teamsnudge");
    if (nudge && nudge.dataset.hasDraft !== "1") {
        nudge.dataset.noFit = fit ? "" : "1";
        nudge.textContent = fit ? copy.apNudgePick : copy.apNudgeOwn;
    }
    const teamHost = $$3("gd-team");
    const ribbonHost = $$3("plan-ribbon");
    const backBtn = $$3("plan-back");
    const head = $$3("plan-head");
    const redraw = () => renderGuilds(bundle, site);
    planRedraw = redraw;
    consumeArrival();
    if (guildFocus && guildFocus !== planFocusSeen) {
        planFocusSeen = guildFocus;
        planPick = guildFocus;
        planAt = "team";
    }
    const pickOf = (d) => d?.dataset.guild ?? null;
    let shown = planPick
        ? tops.find((d) => d.dataset.guild === planPick) ?? null
        : null;
    if (!shown && planAt === "team" && planPick != null && planPick === planDraftGuild())
        planAt = "teams";
    if (!shown)
        shown = opening;
    if (planAt === "team" && !shown)
        planAt = "teams";
    planPick = pickOf(shown);
    teamHost?.replaceChildren();
    const wide = matchMedia("(min-width: 900px)").matches;
    for (const d of tops)
        if (d.open) {
            d.dataset.renderOpen = "1";
            d.open = false;
        }
    const shell = document.getElementById("planshell");
    const panel = document.getElementById("teampanel");
    const onTeam = planAt === "team" && !!shown && !!teamHost;
    shell?.classList.toggle("gd-team-open", onTeam && wide);
    if (panel) {
        panel.replaceChildren();
        panel.hidden = !(onTeam && wide);
    }
    if (teamHost)
        teamHost.hidden = !(onTeam && !wide);
    if (onTeam && shown && teamHost) {
        const host = wide && panel ? panel : teamHost;
        const head = document.createElement("h2");
        head.className = "vh";
        head.textContent = copy.planRibbonTeam;
        host.appendChild(head);
        const greyedShown = shown.classList.contains("greyed");
        shown.hidden = false;
        if (!greyedShown) {
            const lede = document.createElement("p");
            lede.className = "hint";
            lede.textContent = copy.planTeamLede;
            host.appendChild(lede);
        }
        const up = shown.querySelector(":scope > .teambody > .upref");
        const hoistedHere = promotedByParent.get(shown.dataset.guild ?? "");
        if (up && hoistedHere?.length)
            fillUpref(up, hoistedHere, true);
        const foot = shown.nextElementSibling?.matches(".tacts") ? shown.nextElementSibling : null;
        host.appendChild(shown);
        if (foot)
            host.appendChild(foot);
        shown.dataset.renderOpen = "1";
        shown.open = true;
        const already = [...shown.querySelectorAll('a[href*="guides/"]')]
            .map((a) => /^\.\.\/(?:es\/)?guides\/([a-z0-9-]+)\/?$/.exec(a.getAttribute("href") ?? "")?.[1] ?? "").filter(Boolean);
        const reading = readingStrip(bundle, (shown.dataset.species ?? "").split(" ").filter(Boolean), already);
        if (reading)
            host.appendChild(reading);
        list.hidden = !wide;
    }
    else {
        list.hidden = false;
    }
    if (head)
        head.hidden = planAt === "team" && !wide;
    if (backBtn) {
        const at = wide ? "teams" : planAt;
        backBtn.textContent = planBackLabel(at, fit);
        backBtn.dataset.at = at;
        if (!backBtn.dataset.wired) {
            backBtn.dataset.wired = "1";
            backBtn.addEventListener("click", () => {
                if (backBtn.dataset.at === "team") {
                    planAt = "teams";
                    planSeat = true;
                    planRedraw?.();
                    return;
                }
                const mine = document.getElementById("step-mybed");
                if (mine && !mine.open)
                    mine.open = true;
            });
        }
    }
    const sub = $$3("plan-sub");
    if (sub && (planAt === "teams" || wide)) {
        const line = teamsFitLine(fit, total);
        if (line && sub.childNodes.length) {
            const count = document.createElement("span");
            count.className = "teamsfit";
            count.textContent = line;
            const words = document.createElement("details");
            words.className = "disclosure fitwords";
            const q = document.createElement("summary");
            q.textContent = copy.plFitWordsQ;
            words.appendChild(q);
            for (const k of ["team", "fit"]) {
                const d = document.createElement("span");
                d.className = "fitword";
                const b = document.createElement("b");
                b.textContent = `${GLOSSARY[k].term.charAt(0).toUpperCase()}${GLOSSARY[k].term.slice(1)}:`;
                d.append(b, document.createTextNode(` ${GLOSSARY[k].gloss}`));
                words.appendChild(d);
            }
            sub.append(count, words);
        }
    }
    if (ribbonHost) {
        ribbonHost.replaceChildren();
        ribbonHost.classList.toggle("gd-wide", wide);
        ribbonHost.hidden = wide;
        const steps = [["teams", copy.planRibbonTeams], ["team", copy.planRibbonTeam]];
        for (const [key, label] of steps) {
            const here = key === planAt;
            const done = key === "teams" && planAt === "team";
            const el = document.createElement(done ? "button" : "span");
            el.className = `ba-rib${here ? " here" : ""}${done ? " done" : ""}`;
            el.textContent = label;
            el.setAttribute("role", "listitem");
            if (done) {
                el.type = "button";
                el.addEventListener("click", () => { planAt = "teams"; planSeat = true; redraw(); });
            }
            else if (!here) {
                el.setAttribute("aria-disabled", "true");
            }
            if (here)
                el.setAttribute("aria-current", "step");
            ribbonHost.appendChild(el);
        }
    }
    for (const d of tops) {
        d.querySelector("summary")?.addEventListener("click", (e) => {
            if (e.target?.closest("button, a, input, select, label, [role=button]"))
                return;
            e.preventDefault();
            const id = d.dataset.guild ?? null;
            if (planAt === "team" && id === planPick)
                planAt = "teams";
            else {
                planPick = id;
                planAt = "team";
            }
            planSeat = true;
            redraw();
        });
    }
    const stepEl = document.getElementById("step-plan");
    if (stepEl && !stepEl.dataset.planWired) {
        stepEl.dataset.planWired = "1";
        if (stepEl.open) {
            planArrivePending = true;
            if (consumeArrival())
                queueMicrotask(() => planRedraw?.());
        }
        stepEl.addEventListener("toggle", () => {
            if (!stepEl.open) {
                const kept = document.getElementById("plan-kept");
                if (kept) {
                    kept.hidden = true;
                    kept.textContent = "";
                }
            }
            if (!stepEl.open)
                planArrivePending = false;
            if (!stepEl.open && planAt !== "teams") {
                planAt = "teams";
                planPick = null;
                planRedraw?.();
            }
            if (stepEl.open) {
                planArrivePending = true;
                if (consumeArrival())
                    planRedraw?.();
            }
        });
    }
    app.planShowList = () => {
        const sp = document.getElementById("step-plan");
        if (!sp?.open) {
            planListAsked = true;
            return;
        }
        planArrivePending = false;
        if (planAt !== "teams") {
            planAt = "teams";
            planPick = null;
            planRedraw?.();
        }
    };
    if (planSeat) {
        planSeat = false;
        const step = document.getElementById("step-plan");
        const target = (backBtn?.parentElement ?? ribbonHost);
        if (step?.open && target && !wide)
            seat(scrollerFor(target), target, { motion: "smooth", reason: `plan-${planAt}` });
    }
}
function harmonyBand(guild) {
    const h = (guild.derived_harmony ?? {});
    if (h.band === "backed")
        return { key: "backed", label: copy.plBandBacked, tip: "" };
    if (h.band === "partial")
        return { key: "partial", label: copy.plBandPartial, tip: "" };
    if (guild.guild_class === "culinary_bundle") {
        const note = stripRuleCitations(corpusText(guild.id, "honesty_note", String(guild.honesty_note ?? ""))).trim() || undefined;
        return { key: "kitchen", label: copy.plBandKitchen, tip: note ?? "", corpusTip: !!note };
    }
    if (guild.guild_class === "ornamental_bundle") {
        const note = stripRuleCitations(corpusText(guild.id, "honesty_note", String(guild.honesty_note ?? ""))).trim() || undefined;
        return { key: "cut", label: copy.plBandCut, tip: note ?? "", corpusTip: !!note };
    }
    if (guild.guild_class === "restorative") {
        return { key: "rest", label: copy.plBandRest,
            tip: copy.plBandRestTip };
    }
    return { key: "plain", label: copy.plBandPlain, tip: "" };
}
const CLASS_WORDS = {
    polyculture: copy.plClassPolyculture, perennial_guild: copy.plClassPerennial, culinary_bundle: copy.plClassKitchen,
    ornamental_bundle: copy.plClassCutting, restorative: copy.plClassRest, out_of_scope: copy.plClassOutOfScope,
};
function classWords(guildClass) {
    return CLASS_WORDS[guildClass ?? ""] ?? humanize(guildClass ?? "").replace(/\bguild\b/gi, "team");
}
const FIT_WORDS = {
    full: copy.plFitWordsFull, adequate: copy.plFitWordsAdequate, marginal: copy.plFitWordsMarginal,
};
const TIER_UI = {
    full: { on: 3, label: copy.plTierFull },
    adequate: { on: 2, label: copy.plTierAdequate },
    marginal: { on: 1, label: copy.plTierMarginal },
};
function memberThumbs(inst, guild, bundle) {
    const strip = document.createElement("div");
    strip.className = "tmembers";
    const pairs = inst.roles.length
        ? inst.roles.filter((r) => r.chosen).map((r) => [r.chosen, r.options.find((o) => o.filler === r.chosen)?.group ?? null])
        : memberSpecies(guild);
    const seen = new Set();
    for (const [sid] of pairs) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const rec = bundle.species.find((s) => s.id === sid);
        if (typeof rec?.image?.artist !== "string")
            continue;
        const im = document.createElement("img");
        im.className = "tmember-thumb";
        im.dataset.spotPhoto = sid;
        im.src = `img/thumbs/${encodeURIComponent(sid)}.webp`;
        const nm = commonName(bundle, sid) || humanize(sid);
        im.alt = nm;
        im.title = nm;
        im.width = 192;
        im.height = 192;
        im.loading = "lazy";
        im.decoding = "async";
        strip.appendChild(im);
    }
    return strip;
}
function householdBlock(inst, guild, bundle) {
    const h = householdChoice();
    if (!h || h === "none")
        return null;
    const lines = [];
    const seen = new Set();
    for (const [sid, group] of plannedSpecies(inst, guild)) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const resolved = resolveSpecies(sid, group, bundle);
        const c = householdCount(resolved, h);
        if (c)
            lines.push(householdLine(plantingLabel(bundle, sid, group).replace(/^./, (ch) => ch.toUpperCase()), c));
    }
    if (!lines.length)
        return null;
    const box = document.createElement("div");
    box.className = "thouse";
    const k = document.createElement("p");
    k.className = "thouse-k";
    k.textContent = fillCopy("plHousehold", { who: householdWho(h) });
    box.appendChild(k);
    for (const l of lines) {
        const p = document.createElement("p");
        p.className = "thouse-row";
        p.textContent = l;
        box.appendChild(p);
    }
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = copy.plHouseholdNote;
    box.appendChild(note);
    return box;
}
function guildCard(guild, site, bundle, bw, bl, isVariant, recommended, promotedFrom = null) {
    const isRing = guild.ground_entity === "radial_rings";
    const st = guildStatus(guild, bw, bl, bundle, pickedBedStructure(), currentBedRegion());
    const card = document.createElement("details");
    card.className = `guild team ${isVariant ? "variant " : ""}${recommended ? "rec " : ""}${st.fits ? "fits" : "greyed"}`;
    card.dataset.guild = guild.id;
    const summary = document.createElement("summary");
    summary.className = "teamsummary";
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "▾";
    chev.setAttribute("aria-hidden", "true");
    const info = document.createElement("div");
    info.className = "tinfo";
    const name = document.createElement("h3");
    name.className = "tname";
    name.textContent = displayName(guild);
    name.id = `tname-${++tnameSeq}`;
    info.appendChild(name);
    const [needArea, bedArea] = guild.footprint_min_m2 != null && bw != null && bl != null
        ? fmtAreaApart(guild.footprint_min_m2, bw * bl) : [guild.footprint_min_m2 == null ? "? m²" : fmtArea(guild.footprint_min_m2), null];
    const fpTxt = needArea;
    const foot = isRing ? fillCopy("plFootRing", { area: fpTxt }) : fillCopy("plFootNeeds", { area: fpTxt });
    const meta = document.createElement("span");
    meta.className = "tmeta";
    meta.textContent = `${foot} · ${classWords(guild.guild_class)}`;
    info.appendChild(meta);
    const hb = harmonyBand(guild);
    const band = document.createElement("span");
    const tone = hb.key === "backed" ? "tone-positive" : hb.key === "partial" ? "tone-caution" : "tone-neutral";
    band.className = `badge ${tone} hband hband-${hb.key}`;
    band.textContent = hb.label;
    if (hb.tip) {
        band.title = hb.tip;
        if (hb.corpusTip)
            band.dataset.prose = "corpus";
    }
    info.appendChild(band);
    if (promotedFrom) {
        const lin = document.createElement("span");
        lin.className = "lineage";
        const pfp = promotedFrom.footprint_min_m2 == null ? "? m²" : fmtArea(promotedFrom.footprint_min_m2);
        lin.textContent = fillCopy("plLineage", { team: displayName(promotedFrom), area: pfp });
        info.appendChild(lin);
    }
    summary.appendChild(info);
    const end = document.createElement("span");
    end.className = "tend";
    if (st.fits && st.tier) {
        const meter = document.createElement("span");
        meter.className = "fitmeter";
        meter.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 3; i++) {
            const seg = document.createElement("i");
            if (i < TIER_UI[st.tier].on)
                seg.className = "on";
            meter.appendChild(seg);
        }
        end.appendChild(meter);
    }
    const chip = document.createElement("span");
    if (recommended) {
        chip.className = "badge solid tone-positive fit rec";
        chip.textContent = copy.plRecommended;
    }
    else if (st.fits) {
        chip.className = "badge outline tone-positive fit ok";
        chip.textContent = st.tier ? TIER_UI[st.tier].label : copy.plFits;
    }
    else {
        chip.className = "badge outline tone-neutral fit no";
        chip.textContent = copy.plWontFit;
    }
    end.append(chip, chev);
    summary.appendChild(end);
    card.appendChild(summary);
    card.addEventListener("toggle", () => {
        if (!card.open)
            return;
        if (card.dataset.renderOpen) {
            delete card.dataset.renderOpen;
            return;
        }
        if (!card.getClientRects().length)
            return;
        if (document.body.classList.contains("map-showcase"))
            return;
        const tabH = document.querySelector("#plan-ribbon")?.getBoundingClientRect().height || 48;
        seat(scrollerFor(card), card, { offset: tabH + 6, motion: "smooth", reason: "team-card" });
    });
    const body = document.createElement("div");
    body.className = "teambody";
    if (bw != null && bl != null) {
        const why1 = document.createElement("p");
        why1.className = "teamwhy";
        const fitWords = st.fits ? (st.tier ? FIT_WORDS[st.tier] : copy.plFitsYourBed) : copy.plDoesntFitAsIs;
        const hbw = harmonyBand(guild);
        why1.textContent = `${fitWords} · ${hbw.label.charAt(0).toLowerCase()}${hbw.label.slice(1)}`;
        body.appendChild(why1);
    }
    mark(body, { kind: "team", id: guild.id }, { label: copy.plWhyThisTeam });
    const applyWrap = document.createElement("div");
    applyWrap.className = "applybox";
    if (st.fits)
        body.appendChild(applyWrap);
    const inst = st.fits ? instantiate(guild, site, bundle) : null;
    if (inst)
        card.dataset.species = plannedSpecies(inst, guild).map(([sid]) => sid).join(" ");
    if (inst) {
        const faces = memberThumbs(inst, guild, bundle);
        if (faces.childElementCount)
            body.appendChild(faces);
        const house = householdBlock(inst, guild, bundle);
        if (house)
            body.appendChild(house);
    }
    const hrules = (guild.derived_harmony?.rules) ?? [];
    const mechbox = document.createElement("div");
    mechbox.className = "mechbox";
    if (hrules.length) {
        const mh = document.createElement("p");
        mh.className = "mech-h";
        mh.textContent = copy.plWhatHolds;
        mechbox.appendChild(mh);
        const ul = document.createElement("ul");
        for (const rid of hrules) {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = `#/why?rule=${rid}`;
            a.textContent = ruleClaim(bundle, rid);
            markLink(a, { kind: "rule", id: rid });
            li.appendChild(a);
            ul.appendChild(li);
        }
        mechbox.appendChild(ul);
    }
    else {
        const p = document.createElement("p");
        p.className = "mech-none";
        const note = stripRuleCitations(corpusText(guild.id, "honesty_note", String(guild.honesty_note ?? ""))).trim() || undefined;
        const useNote = (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle") && !!note;
        if (useNote)
            p.dataset.prose = "corpus";
        p.textContent = useNote
            ? note
            : (hb.tip || copy.plNothingRecorded);
        mechbox.appendChild(p);
    }
    body.appendChild(mechbox);
    if (isRing) {
        const note = document.createElement("p");
        note.className = "ring-note";
        const canopyId = (guild.roles ?? []).find((r) => r.id === "canopy")?.canonical;
        const habit = typeof canopyId === "string"
            ? String(resolveSpecies(canopyId, null, bundle).habit ?? "") : "";
        const cw = { tree: copy.plCentreTree, shrub: copy.plCentreShrub, vine: copy.plCentreVine, cane: copy.plCentreBramble }[habit] ?? copy.plWoodyCentre;
        note.textContent = fillCopy("plRingNote", { centre: cw });
        body.appendChild(note);
    }
    if (bw != null && bl != null) {
        const inside = st.spaceFits ?? st.fits;
        const svg = isRing ? ringSvg(bw, bl, guild.footprint_min_m2, inside) : fitSvg(bw, bl, guild.footprint_min_m2, inside);
        if (svg) {
            const fig = document.createElement("figure");
            fig.className = "fitfig";
            const need = needArea;
            const bedTxt = `${fmtLen(bw)} × ${fmtLen(bl)}`;
            const sentence = isRing
                ? fillCopy(inside ? "plFigRingFits" : "plFigRingOver", { bed: bedTxt })
                : fillCopy(inside ? "plFigAreaFits" : "plFigAreaOver", { bed: bedTxt, need });
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", sentence);
            fig.appendChild(svg);
            const cap = document.createElement("figcaption");
            const legend = document.createElement("span");
            legend.className = "fitlegend";
            const swBed = document.createElement("i");
            swBed.className = "sw bed";
            const swFp = document.createElement("i");
            swFp.className = inside ? "sw fp ok" : "sw fp over";
            legend.append(swBed, document.createTextNode(copy.plLegendBed), swFp, document.createTextNode(inside ? copy.plLegendNeeds : copy.plLegendNeedsOver));
            cap.append(document.createTextNode(sentence + " "), legend);
            fig.appendChild(cap);
            body.appendChild(fig);
        }
    }
    if (!st.fits && st.reason) {
        const why = document.createElement("p");
        why.className = "why";
        const area = bedArea ?? (bw != null && bl != null ? fmtArea(bw * bl) : "? m²");
        const reasonText = localiseProse(st.reason.text.charAt(0).toUpperCase() + st.reason.text.slice(1));
        why.textContent = fillCopy("plDoesntFitArea", { area });
        const rs = document.createElement("span");
        rs.dataset.prose = "corpus";
        rs.textContent = reasonText;
        why.appendChild(rs);
        if (st.reason.ruleId)
            mark(why, { kind: "rule", id: st.reason.ruleId });
        body.appendChild(why);
        const wi = guild.ruling_when_ineligible;
        if (typeof wi === "string" && wi.trim()) {
            const alt = document.createElement("p");
            alt.className = "why alt";
            alt.dataset.prose = "corpus";
            alt.textContent = stripRuleCitations(wi.trim());
            body.appendChild(alt);
        }
    }
    if (inst)
        body.appendChild(rolePlan(inst, site, guild, bundle, applyWrap));
    card.appendChild(body);
    return card;
}
function renderSeason(_bundle) {
    const step = $$3("step-season");
    const box = $$3("season");
    const sum = $$3("sum-season");
    box.innerHTML = "";
    const season = openSeason();
    const beds = app.logSnapshot.beds;
    const show = season != null || beds.length > 0;
    step.style.display = show ? "" : "none";
    if (!show) {
        sum.textContent = "";
        return;
    }
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        box.appendChild(el);
        return el;
    };
    const toLog = (label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "link";
        btn.textContent = label;
        btn.onclick = () => { location.hash = "#/log"; };
        const row = document.createElement("p");
        row.appendChild(btn);
        box.appendChild(row);
    };
    if (!season) {
        sum.textContent = copy.plSeasonNotStarted;
        p(copy.plNoSeasonYet, "hint");
        toLog(copy.plOpenLog);
        return;
    }
    const plantings = season.plantings ?? [];
    const carried = plantings.filter((pl) => pl.carried_over === true).length;
    const ended = plantings.filter((pl) => !!pl.end_cause).length;
    const growing = plantings.filter((pl) => !pl.end_cause && pl.carried_over !== true && inGround(pl)).length;
    const obs = season.observations ?? [];
    obs.filter((o) => o.event === "frost").length;
    const closed = !!season.closed_date;
    sum.textContent = closed ? fillCopy("plSeasonSumClosed", { year: season.id }) : fillCopy("plSeasonSumGrowing", { year: season.id, n: growing });
    const head = document.createElement("p");
    head.className = "season-head";
    const strong = document.createElement("strong");
    strong.textContent = fillCopy("plSeasonHead", { year: season.id });
    head.appendChild(strong);
    const tag = document.createElement("span");
    tag.className = "hint";
    tag.textContent = closed ? fillCopy("plSeasonClosedOn", { date: season.closed_date ?? "" }) : copy.plSeasonTracking;
    head.appendChild(tag);
    box.appendChild(head);
    const chips = document.createElement("div");
    chips.className = "statuschips";
    const chip = (cls, text) => {
        const c = document.createElement("span");
        c.className = `chip ${cls}`;
        const mk = document.createElement("span");
        mk.className = "mk";
        c.appendChild(mk);
        c.appendChild(document.createTextNode(text));
        chips.appendChild(c);
    };
    chip("grow", fillCopy("plChipGrowing", { n: growing }));
    if (carried)
        chip("over", fillCopy("plChipOverwintering", { n: carried }));
    if (ended)
        chip("end", fillCopy("plChipEnded", { n: ended }));
    chip("obs", pluralCopy("plChipObs", obs.length));
    box.appendChild(chips);
    if (beds.length) {
        const list = document.createElement("div");
        list.className = "bedstatuslist";
        for (const b of beds) {
            const st = bedSeasonStatus(b.region, season);
            const row = document.createElement("div");
            row.className = "bedstatusrow";
            const bn = document.createElement("span");
            bn.className = "bn";
            bn.textContent = b.name;
            const stChip = document.createElement("span");
            stChip.className = `st ${st.growing > 0 ? "grow" : "idle"}`;
            stChip.textContent = st.label;
            row.append(bn, stChip);
            list.appendChild(row);
        }
        box.appendChild(list);
    }
    p(closed
        ? copy.plSeasonClosedHint
        : copy.plSeasonOpenHint, "hint season-glance");
    toLog(closed ? copy.plOpenLog : copy.plTrackInLog);
}
async function moveBedPlantings(db, plot, oldBed, newBed, seasonId) {
    if (seasonId == null || framesEqual(bedFrame(oldBed), bedFrame(newBed)))
        return;
    const season = await getSeason(db, plot, seasonId);
    if (!season?.plantings?.length)
        return;
    let changed = false;
    const plantings = season.plantings.map((p) => {
        if (!plantingOnBed(p.region, oldBed.region))
            return p;
        changed = true;
        return { ...p, region: remapRegionBetweenBeds(p.region, oldBed, newBed) };
    });
    if (!changed)
        return;
    const updated = await putSeason(db, { ...season, plantings });
    upsertSeasonSnapshot(updated);
}

const LOCATE_ZOOM$1 = 19;
let map = null;
let marker = null;
let dead = false;
let onMoveCb = null;
let wanted = false;
const el = () => document.getElementById("gmap");
async function ensureWhereMap(where, onMove) {
    onMoveCb = onMove;
    wanted = true;
    if (dead)
        return false;
    const host = el();
    if (!host) {
        dead = true;
        return false;
    }
    if (!mapsApiKey())
        return false;
    if (map) {
        show(true);
        const { lat, lon } = where();
        if (lat != null && lon != null)
            setWhereMapCenter(lat, lon);
        return true;
    }
    if (!(await loadMapsJs())) {
        dead = true;
        return false;
    }
    try {
        const maps = window.google?.maps;
        if (!maps?.Map || !maps?.Marker) {
            dead = true;
            return false;
        }
        const { lat, lon } = where();
        const centre = { lat: lat ?? 39.83, lng: lon ?? -98.58 };
        map = new maps.Map(host, {
            center: centre,
            zoom: lat != null && lon != null ? LOCATE_ZOOM$1 : 4,
            mapTypeId: "hybrid",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
            tilt: 0,
        });
        marker = new maps.Marker({
            map, position: centre, draggable: true,
            title: "your garden - drag it onto your ground",
        });
        marker.addListener("dragend", (e) => { if (e?.latLng)
            report(e.latLng); });
        map.addListener("click", (e) => {
            if (!e?.latLng)
                return;
            marker?.setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            report(e.latLng);
        });
        show(wanted);
        return true;
    }
    catch (e) {
        dead = true;
        return false;
    }
}
const report = (ll) => {
    onMoveCb?.(Math.round(ll.lat() * 1e5) / 1e5, Math.round(ll.lng() * 1e5) / 1e5);
};
function setWhereMapCenter(lat, lon) {
    if (!map || !marker)
        return;
    const p = { lat, lng: lon };
    marker.setPosition(p);
    if (typeof map.moveCamera === "function")
        map.moveCamera({ center: p, zoom: LOCATE_ZOOM$1 });
    else {
        map.setCenter(p);
        map.setZoom(LOCATE_ZOOM$1);
    }
}
function followWhereMap(lat, lon) {
    if (!map || !marker)
        return;
    if (lat != null && lon != null) {
        setWhereMapCenter(lat, lon);
        return;
    }
    const p = { lat: 39.83, lng: -98.58 };
    marker.setPosition(p);
    if (typeof map.moveCamera === "function")
        map.moveCamera({ center: p, zoom: 4 });
    else {
        map.setCenter(p);
        map.setZoom(4);
    }
}
function show(on) {
    wanted = on;
    const host = el();
    if (!host)
        return;
    host.hidden = !on;
    document.body.classList.toggle("gmap-on", on && !!map);
}

const R = 6378137;
function toMercator(lat, lon) {
    const x = R * (lon * Math.PI / 180);
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
}
function toLocal(anchor, lat, lon) {
    const k = Math.cos(anchor.lat * Math.PI / 180);
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const [x, y] = toMercator(lat, lon);
    return [(x - ax) * k, (y - ay) * k];
}
function fromLocal(anchor, xm, ym) {
    const k = Math.cos(anchor.lat * Math.PI / 180);
    const [ax, ay] = toMercator(anchor.lat, anchor.lon);
    const x = ax + xm / k;
    const y = ay + ym / k;
    const lon = (x / R) * 180 / Math.PI;
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
    return [lat, lon];
}
function metresPerPixel(lat, zoom) {
    return (2 * Math.PI * R * Math.cos(lat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
}
function tileAt(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latR = lat * Math.PI / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
    return { x, y };
}
function tileNw(x, y, z) {
    const n = Math.pow(2, z);
    const lon = (x / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))) * 180 / Math.PI;
    return [lat, lon];
}
function tilesForViewport(anchor, cxM, cyM, spanM, z) {
    const half = spanM / 2;
    const [latNE, lonNE] = fromLocal(anchor, cxM + half, cyM + half);
    const [latSW, lonSW] = fromLocal(anchor, cxM - half, cyM - half);
    const tNW = tileAt(latNE, lonSW, z);
    const tSE = tileAt(latSW, lonNE, z);
    const out = [];
    for (let x = tNW.x; x <= tSE.x && out.length < 64; x++) {
        for (let y = tNW.y; y <= tSE.y && out.length < 64; y++) {
            const [, lonW] = tileNw(x, y, z);
            const [latS, lonE] = tileNw(x + 1, y + 1, z);
            const [x0, y0] = toLocal(anchor, latS, lonW);
            const [x1] = toLocal(anchor, latS, lonE);
            out.push({ z, x, y, x0, y0, size: x1 - x0 });
        }
    }
    return out;
}

function bedsCentre(beds) {
    let x = 0, y = 0, n = 0;
    for (const b of beds)
        for (const [px, py] of regionPoints(b.region)) {
            x += px;
            y += py;
            n++;
        }
    return n ? [x / n, y / n] : null;
}
function gardenShownAt(plot) {
    if (!plot?.anchor)
        return null;
    const c = bedsCentre(plot.beds ?? []);
    if (!c)
        return { lat: plot.anchor.lat, lon: plot.anchor.lon };
    const [lat, lon] = fromLocal(plot.anchor, c[0], c[1]);
    return { lat, lon };
}
async function gardenIsBare(db, plotId) {
    const plot = await getPlot(db, plotId);
    if (!plot?.anchor || plot.example)
        return false;
    if (plot.beds.length || plot.prior_occupancy?.length)
        return false;
    for (const sn of await listSeasons(db, plotId)) {
        if (sn.plantings?.length)
            return false;
        const plan = (Array.isArray(sn.plan) ? sn.plan : []);
        if (plan.some((e) => Array.isArray(e.plantings) && e.plantings.length))
            return false;
    }
    return !(await listSoilObservations(db)).some((r) => r.plot === plotId && r.region);
}
const onAnchor = (a, lat, lon) => !!a && lat != null && lon != null
    && Math.hypot((a.lat - lat) * 111_320, (a.lon - lon) * 111_320 * Math.cos(lat * Math.PI / 180)) < 1.5;
function whereShown() {
    const lat = num("lat"), lon = num("lon");
    const cp = app.currentPlot;
    const at = onAnchor(cp?.anchor, lat, lon) ? gardenShownAt({ anchor: cp?.anchor, beds: app.logSnapshot.beds }) : null;
    return at ?? { lat, lon };
}
async function confirmWhereShown() {
    const pid = app.currentPlotId;
    const plot = await getPlot(await openLog(), pid).catch(() => undefined);
    if (pid !== app.currentPlotId || !plot?.beds.length || !onAnchor(plot.anchor, num("lat"), num("lon")))
        return;
    const at = gardenShownAt(plot);
    if (at)
        followWhereMap(at.lat, at.lon);
}

const $$2 = (id) => document.getElementById(id);
const HANDLE_PX = 48;
const TAP_PX = 6;
function projectedStop(vis, v, stops) {
    const lo = Math.min(...stops.map(([, px]) => px)), hi = Math.max(...stops.map(([, px]) => px));
    const proj = Math.min(hi, Math.max(lo, vis + v * 160));
    return stops.reduce((p, q) => (Math.abs(q[1] - proj) < Math.abs(p[1] - proj) ? q : p))[0];
}
function stampStepKickers() {
    const steps = [...document.querySelectorAll("details.step:not(.aside)")];
    const num = (s) => {
        const b = s.querySelector(".badge");
        return Number(b?.dataset.n || b?.textContent?.trim() || NaN);
    };
    const total = Math.max(0, ...steps.map(num).filter((n) => Number.isFinite(n)));
    for (const step of steps) {
        const n = num(step);
        const body = step.querySelector(".stepbody");
        if (!Number.isFinite(n) || !total || !body || body.querySelector(":scope .stepkick"))
            continue;
        const q = body.querySelector(".stepneed, h2");
        const k = document.createElement("p");
        k.className = "stepkick";
        k.textContent = fillCopy("plStepOf", { n, total });
        if (q)
            q.before(k);
        else
            body.prepend(k);
    }
}
function initPlanSheet() {
    stampStepKickers();
    app.resetPlanStep = () => openStepSilently("step-where");
    app.planSheetMax = () => {
        if (wide.matches)
            return;
        if (visiblePx(stop) < visiblePx("max"))
            apply(visiblePx("max"), "max");
    };
    const shell = $$2("planshell"), sheet = $$2("plansheet"), grab = $$2("sheetgrab");
    if (!shell || !sheet || !grab)
        return;
    const wide = matchMedia("(min-width: 900px)");
    let stop = "def";
    const visiblePx = (s) => {
        const h = shell.clientHeight;
        const maxFrac = 0.6;
        return s === "max" ? h * maxFrac : s === "def" ? h * 0.4 : HANDLE_PX;
    };
    const restOpen = () => "def";
    let stopEcho = 0;
    let mapForward = false;
    const echoClaim = (ms) => {
        stopEcho++;
        setTimeout(() => { stopEcho = Math.max(0, stopEcho - 1); }, ms);
    };
    let settleTimer = 0;
    const settledNow = () => {
        clearTimeout(settleTimer);
        if (!shell.classList.contains("settling"))
            return;
        shell.classList.remove("settling");
        window.dispatchEvent(new Event("gg-sheet-settled"));
    };
    sheet.addEventListener("transitionend", (ev) => {
        if (ev.target === sheet && ev.propertyName === "height")
            settledNow();
    });
    bindSettling(() => shell.classList.contains("settling"));
    const apply = (vis, snap) => {
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (snap) {
            stop = snap;
            echoClaim(600);
        }
        const height = `${Math.max(HANDLE_PX, vis)}px`;
        const mapspace = `${Math.max(0, shell.clientHeight - vis)}px`;
        const changed = sheet.style.height !== height || shell.style.getPropertyValue("--mapspace") !== mapspace;
        sheet.style.height = height;
        shell.classList.toggle("stop-closed", vis <= HANDLE_PX + 8);
        shell.style.setProperty("--mapspace", mapspace);
        reserve(vis);
        if (!changed)
            return;
        shell.classList.add("settling");
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settledNow, 340);
    };
    const reserve = (vis) => {
        const body = document.getElementById("sheetbody");
        if (!body)
            return;
        if (!wide.matches && document.body.classList.contains("plan-browse")) {
            body.style.removeProperty("--reserve");
            return;
        }
        const chrome = sheet.clientHeight - body.clientHeight;
        body.style.setProperty("--reserve", `${Math.max(0, Math.round((wide.matches ? body.clientHeight + chrome : vis) - chrome))}px`);
    };
    const size = () => {
        if (!wide.matches && document.body.classList.contains("plan-browse")) {
            shell.style.removeProperty("height");
            shell.style.removeProperty("--mapspace");
            sheet.style.removeProperty("height");
            reserve(0);
            return;
        }
        if (!shell.getClientRects().length)
            return;
        const top = shell.getBoundingClientRect().top;
        const vh = window.visualViewport?.height ?? window.innerHeight;
        const nav = document.querySelector("header.site nav");
        const navH = nav && getComputedStyle(nav).position === "fixed"
            ? nav.getBoundingClientRect().height : 0;
        const px = `${Math.max(240, vh - Math.max(0, top) - navH - 4)}px`;
        const resized = shell.style.height !== px;
        shell.style.height = px;
        if (resized)
            shell.classList.add("resizing");
        if (!wide.matches)
            apply(visiblePx(stop), null);
        else {
            shell.style.removeProperty("--mapspace");
            reserve(0);
        }
        if (resized) {
            void shell.offsetHeight;
            requestAnimationFrame(() => shell.classList.remove("resizing"));
        }
    };
    let drag = null;
    let samples = [];
    const dragBegin = (y) => {
        drag = { y, vis: visiblePx(stop) };
        samples = [{ y, t: performance.now() }];
        shell.classList.add("dragging");
    };
    const dragMove = (y) => {
        if (!drag)
            return 0;
        samples.push({ y, t: performance.now() });
        if (samples.length > 6)
            samples.shift();
        apply(Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y))), null);
        return Math.abs(y - drag.y);
    };
    const dragEnd = (y, allowTap) => {
        if (!drag)
            return;
        const moved = Math.abs(y - drag.y);
        const vis = Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y)));
        drag = null;
        shell.classList.remove("dragging");
        if (allowTap && moved < TAP_PX) {
            const open = restOpen();
            apply(visiblePx(stop === "closed" ? open : "closed"), stop === "closed" ? open : "closed");
            return;
        }
        const last = samples[samples.length - 1];
        let first = last;
        for (const s of samples)
            if (last.t - s.t <= 120) {
                first = s;
                break;
            }
        const dt = last.t - first.t;
        const v = dt > 0 && Number.isFinite(dt) ? (first.y - last.y) / dt : 0;
        const next = projectedStop(vis, v, ["closed", "def", "max"].map((s) => [s, visiblePx(s)]));
        apply(visiblePx(next), next);
    };
    grab.addEventListener("pointerdown", (ev) => {
        if (wide.matches)
            return;
        try {
            grab.setPointerCapture(ev.pointerId);
        }
        catch { }
        dragBegin(ev.clientY);
    });
    grab.addEventListener("pointermove", (ev) => { if (drag)
        dragMove(ev.clientY); });
    const release = (ev) => dragEnd(ev.clientY, true);
    grab.addEventListener("pointerup", release);
    grab.addEventListener("pointercancel", release);
    {
        const path = $$2("pathbar");
        let pathDrag = false;
        path?.addEventListener("pointerdown", (ev) => {
            if (wide.matches)
                return;
            pathDrag = false;
            dragBegin(ev.clientY);
        });
        path?.addEventListener("pointermove", (ev) => {
            if (!drag)
                return;
            if (dragMove(ev.clientY) >= TAP_PX && !pathDrag) {
                pathDrag = true;
                try {
                    path.setPointerCapture(ev.pointerId);
                }
                catch { }
            }
        });
        const pathUp = (ev) => {
            if (!drag)
                return;
            const was = pathDrag;
            pathDrag = false;
            dragEnd(ev.clientY, false);
            if (was)
                path.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
        };
        path?.addEventListener("pointerup", pathUp);
        path?.addEventListener("pointercancel", pathUp);
    }
    window.addEventListener("pointerup", (ev) => { if (drag)
        release(ev); });
    window.addEventListener("pointercancel", (ev) => { if (drag)
        release(ev); });
    {
        let bodyClaim = null;
        const sheetBody = $$2("sheetbody");
        sheetBody?.addEventListener("touchstart", (ev) => {
            bodyClaim = (!wide.matches && !document.body.classList.contains("plan-browse")
                && ev.touches.length === 1 && sheetBody.scrollTop <= 0)
                ? { y: ev.touches[0].clientY, own: false } : null;
        }, { passive: true });
        sheetBody?.addEventListener("touchmove", (ev) => {
            if (!bodyClaim || ev.touches.length !== 1)
                return;
            const y = ev.touches[0].clientY;
            if (!bodyClaim.own) {
                const dy = y - bodyClaim.y;
                if (dy > 8 && sheetBody.scrollTop <= 0) {
                    bodyClaim.own = true;
                    dragBegin(bodyClaim.y);
                }
                else if (dy < -4) {
                    bodyClaim = null;
                    return;
                }
                else
                    return;
            }
            ev.preventDefault();
            dragMove(y);
        }, { passive: false });
        const bodyRelease = (ev) => {
            if (bodyClaim?.own && drag)
                dragEnd(ev.changedTouches[0]?.clientY ?? drag.y, false);
            bodyClaim = null;
        };
        sheetBody?.addEventListener("touchend", bodyRelease);
        sheetBody?.addEventListener("touchcancel", bodyRelease);
    }
    grab.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ")
            return;
        ev.preventDefault();
        const next = stop === "closed" ? restOpen() : "closed";
        apply(visiblePx(next), next);
    });
    const steps = Array.from(document.querySelectorAll("#sheetbody details.step"));
    const body = $$2("sheetbody");
    const companions = new Set(["sec-ground", "step-mybed"]);
    const paired = (a, b) => companions.has(a) && companions.has(b);
    const EDIT_STEPS = ["sec-ground", "step-mybed", "step-where"];
    const paintTitle = () => {
        const h = document.querySelector("#sheetbody h1 [data-copy='planTitle']");
        if (!h)
            return;
        if (!h.dataset.base && h.textContent)
            h.dataset.base = h.textContent;
        const isOpen = (id) => !!document.getElementById(id)?.open;
        let title = h.dataset.base ?? "";
        if (isOpen("sec-ground"))
            title = copy.ntYourBeds;
        else if (isOpen("step-plan") || isOpen("step-mybed")) {
            const bed = document.getElementById("candbed")?.value?.trim() ?? "";
            title = bed || copy.plThisBed;
        }
        if (h.textContent !== title)
            h.textContent = title;
    };
    document.getElementById("candbed")?.addEventListener("change", paintTitle);
    const updateMode = () => {
        paintTitle();
        const editing = EDIT_STEPS.some((id) => (!gateShut() || id === "step-where")
            && document.getElementById(id)?.open);
        const was = document.body.classList.contains("plan-edit");
        const whereOpen = !!document.getElementById("step-where")?.open;
        if (whereOpen && !document.body.classList.contains("locating")) {
            whereTouched = false;
            paintWhereFold(!!document.getElementById("lat")?.value);
        }
        document.body.classList.toggle("plan-edit", editing);
        document.body.classList.toggle("plan-browse", !editing);
        document.body.classList.toggle("locating", !!document.getElementById("step-where")?.open);
        window.dispatchEvent(new Event("gg-step-changed"));
        document.body.classList.remove("map-showcase");
        if (editing && !was && !document.getElementById("page-plan")?.hidden)
            window.scrollTo(0, 0);
        size();
    };
    let bedLanding = false;
    window.addEventListener("gg-bed-saved", (ev) => {
        if (wide.matches)
            return;
        if (ev.detail?.kind === "bed" && document.body.classList.contains("plan-edit")) {
            apply(visiblePx("max"), "max");
            bedLanding = true;
            const finalBody = visiblePx("max") - (sheet.clientHeight - body.clientHeight);
            let anchor = null;
            seat(body, () => {
                const l = document.getElementById("arealist");
                const c = document.getElementById("sec-ground")?.querySelector(".stepnext") ?? null;
                const card = l?.lastElementChild;
                if (!l || !card)
                    return null;
                if (!anchor) {
                    anchor = "list";
                    if (c && c.getBoundingClientRect().bottom - l.getBoundingClientRect().top > finalBody - 6)
                        anchor = "receipt";
                }
                return anchor === "list" ? l : card;
            }, { offset: 6, hold: 1500, reason: "bed-saved" });
            return;
        }
        if (document.body.classList.contains("plan-edit")) {
            apply(visiblePx("closed"), "closed");
        }
        else {
            document.body.classList.add("map-showcase");
            seat(window, "top", { motion: "smooth", hold: 1500, protect: true, reason: "team-showcase" });
        }
    });
    document.getElementById("editground")?.addEventListener("click", () => {
        const g = document.getElementById("sec-ground");
        if (g)
            g.open = true;
    });
    for (const id of ["step-where", "gardenadd"])
        document.getElementById(id)?.addEventListener("click", () => { pickStanding = false; }, true);
    window.addEventListener("gg-bed-saved", () => { pickStanding = false; });
    for (const step of steps) {
        step.addEventListener("toggle", () => {
            const silent = silentSteps.delete(step.id);
            if (!silent) {
                arrived = true;
                pickStanding = false;
            }
            updateMode();
            repaintPath?.();
            if (!step.open)
                return;
            if (!step.classList.contains("aside"))
                sheet.classList.remove("extras-open");
            for (const other of steps)
                if (other !== step && other.open && !paired(step.id, other.id))
                    other.open = false;
            paintTitle();
            if (silent)
                return;
            const target = step.id === "sec-ground" || step.id === "step-where" ? "def" : "max";
            if (!wide.matches && visiblePx(stop) !== visiblePx(target))
                apply(visiblePx(target), target);
            seat(body, step, { offset: 4, reason: "step-open" });
        });
    }
    for (const btn of document.querySelectorAll("button.stepnext")) {
        btn.addEventListener("click", () => {
            if (btn.getAttribute("aria-disabled") === "true") {
                goToWhere();
                return;
            }
            const next = document.getElementById(btn.dataset.next ?? "");
            if (next)
                next.open = true;
        });
    }
    const pathHost = document.getElementById("pathbar");
    const PATH_MAIN = [["step-where", copy.plWhere], ["sec-ground", copy.plBeds], ["step-plan", copy.plThisBed]];
    const ASIDE_IDS = ["sec-addplant", "step-season"];
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    repaintPath = () => {
        if (!pathHost)
            return;
        const nodes = PATH_MAIN.map(([id, label], i) => {
            const el = document.getElementById(id);
            const mybed = id === "step-plan" ? document.getElementById("step-mybed") : null;
            const sumFrom = mybed?.open && !el?.open ? mybed : el;
            return { id, label, n: i + 1, done: !!el?.classList.contains("done"), open: !!(el?.open || mybed?.open),
                sum: sumFrom?.querySelector(".stepsum")?.textContent ?? "" };
        });
        const extrasActive = sheet.classList.contains("extras-open")
            || ASIDE_IDS.some((id) => document.getElementById(id)?.open);
        let out = "";
        nodes.forEach((nd, i) => {
            if (i) {
                const prev = nodes[i - 1];
                const conn = prev.done && nd.done ? " done" : prev.done && nd.open ? " into" : "";
                out += `<span class="pconn${conn}"></span>`;
            }
            const locked = (nd.id !== "step-where" && gateShut()) || (nd.id === "step-plan" && lastSeen.areaCount === 0);
            const cls = (nd.done ? " done" : "") + (nd.open ? " current" : "") + (locked ? " locked" : "");
            out += `<button type="button" class="pnode${cls}" data-step="${nd.id}"`
                + (locked ? ' aria-disabled="true"' : "")
                + (nd.open ? ' aria-current="step"' : "")
                + `><span class="pdotc">${nd.done && !nd.open ? CHECK : nd.n}</span>`
                + `<span class="plabel">${esc(nd.label)}</span>`
                + (nd.done && nd.sum ? `<span class="psum">${esc(nd.sum)}</span>` : "")
                + "</button>";
        });
        out += `<span class="pconn${nodes[2].done && extrasActive ? " into" : ""}"></span>`
            + `<button type="button" class="pnode extras${extrasActive ? " current" : ""}${gateShut() ? " locked" : ""}" data-extras="1"`
            + (gateShut() ? ' aria-disabled="true"' : "")
            + (extrasActive ? ' aria-current="step"' : "")
            + `><span class="pdotc">+</span><span class="plabel">${esc(copy.ntExtras)}</span></button>`;
        pathHost.innerHTML = out;
        const peek = document.getElementById("sheetpeek");
        if (peek) {
            const active = nodes.find((nd) => nd.open)?.label ?? (extrasActive ? copy.ntExtras : null);
            peek.textContent = active ? fillCopy("ntPeekActive", { step: active }) : copy.ntPeekIdle;
        }
    };
    pathHost?.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn)
            return;
        if (gateShut() && (btn.dataset.extras || (btn.dataset.step && btn.dataset.step !== "step-where"))) {
            goToWhere();
            return;
        }
        if (btn.dataset.extras) {
            sheet.classList.add("extras-open");
            for (const s of steps)
                if (s.open && !s.classList.contains("aside"))
                    s.open = false;
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            repaintPath?.();
            seat(body, () => document.querySelector(".stepmore"), { offset: 4, motion: "smooth", reason: "extras" });
            return;
        }
        if (btn.dataset.step === "step-plan" && lastSeen.areaCount === 0) {
            const g = document.getElementById("sec-ground");
            if (g)
                g.open = true;
            flashBedRow();
            return;
        }
        const d = document.getElementById(btn.dataset.step ?? "");
        if (!d)
            return;
        if (d.open) {
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            seat(body, d, { offset: 4, motion: "smooth", reason: "step-reopen" });
        }
        else
            d.open = true;
    });
    repaintPath();
    body.addEventListener("scroll", () => {
        if (stopEcho > 0)
            return;
        if (ownScroll(body))
            return;
        if (mapForward)
            return;
        if (!wide.matches && stop === "def")
            apply(visiblePx("max"), "max");
    }, { passive: true });
    body.addEventListener("focusin", (ev) => {
        if (!wide.matches && stop !== "max")
            apply(visiblePx("max"), "max");
        const field = ev.target;
        if (field && body.contains(field)) {
            seat(body, field, { block: "nearest", offset: 12, motion: "smooth", hold: 600, reason: "field-focus" });
        }
    });
    document.getElementById("mapsvg")?.addEventListener("pointerdown", () => {
        if (!wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
    });
    {
        const savecard = document.getElementById("savecard");
        if (savecard) {
            let lastShowing = !savecard.hidden;
            new MutationObserver(() => {
                const showing = !savecard.hidden;
                if (showing === lastShowing)
                    return;
                lastShowing = showing;
                if (showing)
                    bedLanding = false;
                else if (bedLanding) {
                    bedLanding = false;
                    return;
                }
                if (wide.matches || !document.body.classList.contains("plan-edit"))
                    return;
                const to = showing ? "closed" : "def";
                apply(visiblePx(to), to);
            }).observe(savecard, { attributes: true, attributeFilter: ["hidden"] });
        }
    }
    window.addEventListener("gg-sheet-collapse", () => {
        if (!wide.matches)
            apply(visiblePx("closed"), "closed");
    });
    window.addEventListener("gg-sheet-map", () => {
        if (wide.matches)
            return;
        mapForward = true;
        if (visiblePx(stop) > visiblePx("def"))
            apply(visiblePx("def"), "def");
    });
    window.addEventListener("gg-sheet-reveal", (ev) => {
        const name = String(ev.detail?.bed ?? "");
        const find = () => name ? document.querySelector(`.bedcard[data-bed="${CSS.escape(name)}"]`) : null;
        const reveal = (el) => {
            for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null)
                d.open = true;
            if (!wide.matches && visiblePx(stop) < visiblePx("def")) {
                mapForward = false;
                apply(visiblePx("def"), "def");
            }
            const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
            seat(scrollerFor(el), el, { offset: 6, motion, force: true, hold: 1500, reason: "next-act" });
        };
        const el = find();
        if (el) {
            reveal(el);
            return;
        }
        const list = document.getElementById("arealist");
        if (!name || !list)
            return;
        const watch = new MutationObserver(() => { const got = find(); if (got) {
            watch.disconnect();
            reveal(got);
        } });
        watch.observe(list, { childList: true });
        window.setTimeout(() => watch.disconnect(), 3000);
    });
    window.addEventListener("gg-open-step", (ev) => {
        const step = String(ev.detail?.step ?? "");
        if (step) {
            pickStanding = false;
            openStepSilently(step);
        }
    });
    for (const el of [body, grab])
        el.addEventListener("pointerdown", () => { mapForward = false; }, { passive: true });
    window.addEventListener("resize", size);
    window.visualViewport?.addEventListener("resize", size);
    wide.addEventListener("change", size);
    window.addEventListener("hashchange", () => setTimeout(() => { stop = restOpen(); size(); }, 60));
    let shellShown = false;
    new ResizeObserver(() => {
        const shown = shell.getClientRects().length > 0;
        if (shown && !shellShown) {
            stop = restOpen();
            size();
        }
        shellShown = shown;
    }).observe(shell);
    window.addEventListener("scroll", () => {
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (!document.getElementById("page-plan")?.hidden && window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    }, { passive: true });
    const above = new ResizeObserver(() => size());
    const header = document.querySelector("header.site");
    if (header)
        above.observe(header);
    for (const id of ["examplebanner", "draftbanner"]) {
        const el = document.getElementById(id);
        if (el)
            above.observe(el);
    }
    stop = restOpen();
    updateMode();
    setTimeout(size, 0);
    onLocated = (located) => {
        if (located && !wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
        if (located) {
            paintTitle();
            const addr = document.getElementById("addr");
            if (addr && performance.now() - locatingAt < 3000)
                seat(body, addr, { block: "nearest", hold: 1000, reason: "located" });
        }
    };
    liftColdWhereDrawer = () => { if (!wide.matches)
        apply(visiblePx("max"), "max"); };
    const liftIfCold = () => {
        const where = document.getElementById("step-where");
        if (!location.hash.startsWith("#/plan") || !lastSeen.known || lastSeen.located || !where?.open)
            return;
        setTimeout(() => {
            const lat = document.getElementById("lat")?.value ?? "";
            const plan = document.getElementById("page-plan");
            if (lastSeen.located || lat || app.logSnapshot.beds.length > 0 || !plan || plan.hidden || !where.open)
                return;
            liftColdWhereDrawer?.();
        }, 350);
    };
    window.addEventListener("hashchange", liftIfCold);
    window.addEventListener("gg-plan-drawn", liftIfCold);
    liftIfCold();
}
let onLocated = null;
let locatingAt = -1e9;
if (typeof window !== "undefined")
    window.addEventListener("gg-sheet-locating", () => { locatingAt = performance.now(); });
let liftColdWhereDrawer = null;
let wasLocated = false;
let repaintPath = null;
let arrived = false;
let pickStanding = false;
function repickForArrivedBeds(areaCount) {
    if (!pickStanding || areaCount === 0)
        return;
    const where = document.getElementById("step-where");
    if (!where?.open || whereTouched || where.contains(document.activeElement))
        return;
    pickStanding = false;
    const plan = document.getElementById("page-plan");
    openStepSilently("step-plan", !!plan && !plan.hidden);
}
let lastSeen = { located: false, areaCount: 0 };
const gateShut = () => !!lastSeen.known && !lastSeen.located;
const GATED_STEPS = ["sec-ground", "step-plan", "step-mybed", "sec-addplant", "step-season"];
function paintWhereGate(located) {
    for (const id of GATED_STEPS) {
        const step = document.getElementById(id);
        if (!step)
            continue;
        step.classList.toggle("needsloc", !located);
        if (!located && !document.getElementById(`wherelock-${id}`)) {
            const sum = step.querySelector(":scope > summary");
            (sum ?? step).insertAdjacentElement(sum ? "afterend" : "afterbegin", whereLockNote(id));
        }
    }
    document.body.classList.toggle("plan-needsloc", !located);
    for (const b of document.querySelectorAll('#step-where button.stepnext[data-next="sec-ground"]')) {
        if (located)
            b.removeAttribute("aria-disabled");
        else
            b.setAttribute("aria-disabled", "true");
    }
}
let whereTouched = false;
function paintWhereFold(located) {
    const fold = located && !whereTouched;
    const form = document.getElementById("addrform");
    const hint = document.getElementById("wherehint");
    const change = document.getElementById("changeloc");
    const usezip = document.getElementById("usezip");
    if (form)
        form.hidden = fold;
    if (hint)
        hint.hidden = fold || !located;
    if (change) {
        change.hidden = !fold;
        if (!change.dataset.wired) {
            change.dataset.wired = "1";
            change.addEventListener("click", () => {
                whereTouched = true;
                paintWhereFold(true);
                document.getElementById("addr")?.focus();
            });
            const touch = () => { whereTouched = true; };
            form?.addEventListener("focusin", touch);
            document.getElementById("usezip")?.addEventListener("click", touch);
        }
    }
    if (usezip)
        usezip.hidden = located || !usezip.dataset.offer;
}
let ownFacts = null;
function paintWhereOwnFrost(s) {
    const box = document.getElementById("where-ownfrost");
    const btn = document.getElementById("where-ownbtn");
    if (!box || !btn)
        return;
    ownFacts = s.located && s.plotId && (s.frostOwn || !s.frostImpossible)
        ? { plotId: s.plotId, own: !!s.frostOwn, last: s.frostLast ?? null, first: s.frostFirst ?? null } : null;
    box.hidden = !ownFacts;
    if (!ownFacts) {
        box.querySelector(".cc-ownform")?.remove();
        btn.hidden = false;
        return;
    }
    btn.textContent = s.frostOwn ? copy.plOwnFrostChange : s.frostModeled ? copy.plOwnFrostEnter : copy.plOwnFrostKnow;
    if (!box.querySelector(".cc-ownform"))
        btn.hidden = false;
    if (btn.dataset.wired)
        return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
        const f = ownFacts;
        if (!f)
            return;
        btn.hidden = true;
        void import('./ownfrost.js').then((m) => m.openOwnFrostForm(box, f.plotId, { last: f.last, first: f.first }, f.own, () => { btn.hidden = false; btn.focus(); }));
    });
}
function endArrival() {
    if (arrived)
        return;
    arrived = true;
    pickOpeningStep(lastSeen.located, lastSeen.areaCount);
    if (typeof document !== "undefined")
        document.body.classList.add("plan-arrived");
}
function arrivalSettled() {
    return arrived;
}
const silentSteps = new Set();
function holdTopBriefly(ms = 1200) {
    if (typeof window === "undefined")
        return;
    seat(window, "top", { hold: ms, protect: true, reason: "arrival" });
}
function pickOpeningStep(located, areaCount) {
    const onPlan = () => location.hash.startsWith("#/plan");
    const fresh = takePlanFresh(onPlan());
    if (fresh && !onPlan()) {
        const spendOnShow = () => {
            if (!onPlan())
                return;
            takePlanFresh(true);
            window.removeEventListener("hashchange", spendOnShow);
        };
        window.addEventListener("hashchange", spendOnShow);
    }
    const want = fresh ? "step-where" : (areaCount > 0 ? "step-plan" : "step-where");
    openStepSilently(want);
    pickStanding = !fresh && want === "step-where";
    if (want === "step-where" && !located)
        liftColdWhereDrawer?.();
}
function openStepSilently(want, holdTop = true) {
    const target = document.getElementById(want);
    if (!target || target.open)
        return;
    for (const id of ["step-where", "sec-ground", "step-plan"]) {
        const el = document.getElementById(id);
        if (el && el !== target && el.open) {
            silentSteps.add(id);
            el.open = false;
        }
    }
    silentSteps.add(want);
    target.open = true;
    if (holdTop)
        holdTopBriefly();
}
function setStep(id, done, summary) {
    const step = document.getElementById(id);
    if (!step)
        return;
    const sum = step.querySelector(".stepsum");
    if (sum)
        sum.textContent = summary;
    if (done != null) {
        step.classList.toggle("done", done);
        const badge = step.querySelector(".badge");
        if (badge) {
            if (!badge.dataset.n)
                badge.dataset.n = badge.textContent ?? "";
            badge.textContent = done ? "" : badge.dataset.n;
        }
    }
}
function updateStepStates(s) {
    if (s.located && !wasLocated)
        onLocated?.(true);
    wasLocated = s.located;
    const firstKnown = !lastSeen.known;
    lastSeen = { located: s.located, areaCount: s.areaCount, known: true };
    repickForArrivedBeds(s.areaCount);
    if (firstKnown && !s.located)
        window.dispatchEvent(new Event("gg-plan-drawn"));
    paintWhereGate(s.located);
    setStep("step-where", s.located, s.located ? (s.zoneLabel ? fillCopy("ntWhereZone", { zone: s.zoneLabel }) : copy.ntWhereLocated) : copy.ntWhereUnset);
    setStep("sec-ground", s.areaCount > 0, s.areaCount ? pluralCopy("ntBeds", s.areaCount) : copy.ntAddBed);
    document.getElementById("sec-ground")?.classList.toggle("has-beds", s.areaCount > 0);
    const need = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = met;
    };
    need("need-where", s.located);
    need("need-ground", s.areaCount > 0);
    const ng = document.getElementById("need-ground");
    if (ng && !ng.childNodes.length)
        fillNodes$3(ng, copy.planGroundLead, { fit: glossTerm("fit", copy.plGlossFit) });
    const earned = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = !met;
    };
    earned("earned-where", s.located);
    paintWhereFold(s.located);
    if (s.located) {
        const bits = [
            s.address ? s.address : null,
            s.zoneLabel ? fillCopy("ntZone", { zone: s.zoneLabel }) : null,
            s.frostRare ? (s.frostMost ? copy.ntFrostMost : s.frostSome ? copy.ntFrostSome : copy.ntFrostRare) : null,
            s.frostNone ? copy.ntFrostNone : null,
            !s.frostRare && s.frostP50 ? fillCopy(s.frostOwn ? "ntLastFrostOwn" : "ntLastFrost", { date: s.frostP50 }) : null,
            !s.frostRare && s.freezeP50 ? fillCopy(s.frostOwn ? "ntFirstFreezeOwn" : "ntFirstFreeze", { date: s.freezeP50 }) : null,
            !s.frostRare && s.seasonDays != null ? fillCopy("ntSeasonDays", { n: s.seasonDays }) : null,
        ].filter(Boolean).join(" · ");
        const el = document.getElementById("earned-where");
        if (el)
            el.textContent = bits
                ? fillCopy("ntReceipt", { bits })
                : copy.ntReceiptBare;
    }
    paintWhereOwnFrost(s);
    const guildsEl = document.getElementById("guilds");
    const fit = Number(guildsEl?.dataset.teamsFit ?? 0);
    const total = Number(guildsEl?.dataset.teamsTotal ?? 0);
    setStep("step-plan", s.planned, total ? fillCopy("ntTeamsFit", { fit, total }) : "");
    setStep("step-mybed", null, s.myBedCount ? pluralCopy("ntPlants", s.myBedCount) : "");
    const ups = document.querySelectorAll("#uplist .upitem").length;
    setStep("sec-addplant", null, ups ? fillCopy("ntAdded", { n: ups }) : "");
    repaintPath?.();
}

const STEPS = ["how", "size", "kind", "sun", "rain"];
function stepsFor(how) {
    return how === "trace" ? ["how", "kind", "sun", "rain"] : STEPS;
}
function dependentFor(structure) {
    if (structure === "raised")
        return { because: copy.bedAddBecauseRaised, label: copy.bedAddDepthLabel, inches: 12 };
    if (structure === "container")
        return { because: copy.bedAddBecauseContainer, label: copy.bedAddDepthLabel, inches: 10 };
    return null;
}
function reachWord(widthM) {
    if (widthM == null || !(widthM > 0))
        return "";
    return widthM <= 1.22 ? copy.bedAddReachBoth : copy.bedAddReachOne;
}
const HOW_CHOICES = [
    { value: "size", label: copy.bedAddHowSize, note: copy.bedAddHowSizeNote },
    { value: "trace", label: copy.bedAddHowTrace, note: copy.bedAddHowTraceNote },
];
const spaceStructure = () => {
    const s = spaceChoice();
    return s === "pots" ? "container" : s === "raised" ? "raised" : null;
};
const KIND_CHOICES = [
    { value: "in_ground", label: copy.bedAddKindInGround, note: copy.bedAddKindInGroundNote },
    { value: "raised", label: copy.bedAddKindRaised, note: copy.bedAddKindRaisedNote },
    { value: "container", label: copy.bedAddKindContainer, note: copy.bedAddKindContainerNote },
    { value: "field", label: copy.bedAddKindField, note: copy.bedAddKindFieldNote },
];
const SUN_CHOICES = [
    { value: "full", label: copy.bedAddSunFull, note: copy.bedAddSunFullNote },
    { value: "part_shade", label: copy.bedAddSunPart, note: copy.bedAddSunPartNote },
    { value: "", label: copy.bedAddSunUnknown, note: copy.bedAddSunUnknownNote },
];
const RAIN_CHOICES = [
    { value: "", label: copy.bedAddRainOpen, note: copy.bedAddRainOpenNote },
    { value: "covered", label: copy.bedAddRainCovered, note: copy.bedAddRainCoveredNote },
    { value: "indoors", label: copy.bedAddRainIndoors, note: copy.bedAddRainIndoorsNote },
];
const RIBBON = { how: copy.bedAddRibbonHow, size: copy.bedAddRibbonSize, kind: copy.bedAddRibbonKind, sun: copy.bedAddRibbonSun, rain: copy.bedAddRibbonRain };
const $$1 = (id) => document.getElementById(id);
function initBedAdd(host = {}) {
    host.setPreview ??= (on, f) => {
        const shell = document.getElementById("planshell");
        const panel = $$1("bedpreview");
        if (!shell || !panel)
            return;
        shell.classList.toggle("ba-preview", on);
        panel.hidden = !on;
        if (on && f)
            renderBedPreview(panel, f);
    };
    const root = $$1("bedadd");
    const door = $$1("bedadd-open");
    if (!root || !door)
        return;
    let open = false;
    let at = "how";
    let how = null;
    let structure = null;
    let sun = null;
    let rain = "";
    let depthIn = null;
    const model = {
        structure: () => $$1("dimstructure"),
        sun: () => $$1("dimsun"),
        rain: () => $$1("dimrain"),
    };
    const facts = () => ({
        widthM: lenM("dimw"), lengthM: lenM("diml"), structure, depthIn, sun,
    });
    const paintRibbon = () => {
        const host2 = $$1("bedadd-ribbon");
        if (!host2)
            return;
        const run = stepsFor(how);
        const hereAt = run.indexOf(at);
        host2.replaceChildren();
        run.forEach((s, i) => {
            const done = i < hereAt, here = s === at;
            const el = document.createElement(done ? "button" : "span");
            el.className = `ba-rib${here ? " here" : ""}${done ? " done" : ""}`;
            el.textContent = RIBBON[s];
            el.setAttribute("role", "listitem");
            if (done) {
                el.type = "button";
                el.addEventListener("click", () => { at = s; paint("back"); });
            }
            else if (!here) {
                el.setAttribute("aria-disabled", "true");
            }
            if (here)
                el.setAttribute("aria-current", "step");
            host2.appendChild(el);
        });
    };
    const cards = (hostId, choices, get, set) => {
        const h = $$1(hostId);
        if (!h)
            return;
        h.replaceChildren();
        for (const c of choices) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ba-choice";
            b.dataset.value = c.value;
            b.setAttribute("role", "radio");
            b.setAttribute("aria-checked", String(get() === c.value));
            if (get() === c.value)
                b.classList.add("on");
            const t = document.createElement("span");
            t.className = "ba-choice-t";
            t.textContent = c.label;
            const n = document.createElement("span");
            n.className = "ba-choice-n";
            n.textContent = c.note;
            b.append(t, n);
            b.addEventListener("click", () => set(c.value));
            h.appendChild(b);
        }
    };
    const paintDependent = () => {
        const h = $$1("ba-kind-extra");
        if (!h)
            return;
        const dep = dependentFor(structure);
        h.replaceChildren();
        if (!dep) {
            depthIn = null;
            return;
        }
        if (depthIn == null)
            depthIn = dep.inches;
        const wrap = document.createElement("div");
        wrap.className = "ba-dep";
        const why = document.createElement("p");
        why.className = "ba-dep-why";
        why.textContent = dep.because;
        const row = document.createElement("div");
        row.className = "logrow";
        const lab = document.createElement("label");
        lab.htmlFor = "ba-depth";
        lab.textContent = dep.label;
        const metric = unitSystem() === "metric";
        const inp = document.createElement("input");
        inp.id = "ba-depth";
        inp.inputMode = "decimal";
        inp.value = String(metric ? Math.round(depthIn * 2.54) : depthIn);
        inp.setAttribute("aria-label", dep.label);
        inp.addEventListener("input", () => {
            const v = Number(inp.value.replace(",", "."));
            depthIn = Number.isFinite(v) && v > 0 ? (metric ? v / 2.54 : v) : null;
            host.setPreview?.(open && at !== "how", facts());
        });
        const unit = document.createElement("span");
        unit.textContent = metric ? "cm" : copy.unitIn;
        row.append(lab, inp, unit);
        const foot = document.createElement("p");
        foot.className = "hint";
        foot.textContent = fillCopy("bedAddDepthFoot", { depth: metric ? `${Math.round(12 * 2.54)} cm` : `12 ${copy.unitIn}` });
        wrap.append(why, row, foot);
        h.appendChild(wrap);
    };
    const paintSizeReceipt = () => {
        const el = $$1("ba-sizereceipt");
        if (!el)
            return;
        const w = lenM("dimw"), l = lenM("diml");
        if (w == null || l == null || !(w > 0) || !(l > 0)) {
            el.hidden = true;
            return;
        }
        const u = lengthUnit();
        const area = mToInput(w) * mToInput(l);
        el.hidden = false;
        el.textContent = fillCopy("bedAddAreaReceipt", { area: area.toFixed(0), unit: u,
            reach: reachWord(w) === copy.bedAddReachBoth ? copy.bedAddReachEither : copy.bedAddReachOneOnly });
    };
    const nextLabel = () => {
        const run = stepsFor(how);
        const i = run.indexOf(at);
        const to = run[i + 1];
        if (!to)
            return null;
        return to === "size" ? copy.bedAddNextSize : to === "kind" ? copy.bedAddNextKind
            : to === "sun" ? copy.bedAddNextSun : copy.bedAddNextRain;
    };
    const choiceMovesOn = () => at === "how" || at === "sun" || (at === "kind" && !dependentFor(structure));
    const advance = () => {
        const run = stepsFor(how);
        const i = run.indexOf(at);
        if (i >= 0 && i < run.length - 1) {
            at = run[i + 1];
            paint("forward");
        }
    };
    function paint(why) {
        root.hidden = !open;
        $$1("bedadd-doorrow").hidden = open;
        doorLabel();
        document.getElementById("planshell")?.classList.toggle("ba-quiet", open);
        if (!open) {
            host.setPreview?.(false, null);
            return;
        }
        $$1("bedadd-back").hidden = !app.logSnapshot.beds.length;
        const run = stepsFor(how);
        if (!run.includes(at))
            at = run[0];
        for (const s of STEPS) {
            const sec = $$1(`ba-${s}`);
            if (sec)
                sec.hidden = !(run.includes(s) && s === at);
        }
        paintRibbon();
        cards("ba-how-choices", HOW_CHOICES, () => how, (v) => {
            how = v;
            if (how === "trace") {
                open = false;
                paint("open");
                doorLabel();
                host.startTrace?.();
                return;
            }
            advance();
        });
        cards("ba-kind-choices", KIND_CHOICES, () => structure, (v) => {
            structure = v;
            const sel = model.structure();
            if (sel)
                sel.value = v;
            depthIn = null;
            if (dependentFor(structure))
                paint("same");
            else
                advance();
        });
        cards("ba-sun-choices", SUN_CHOICES, () => sun, (v) => {
            sun = v;
            const sel = model.sun();
            if (sel)
                sel.value = v;
            advance();
        });
        cards("ba-rain-choices", RAIN_CHOICES, () => rain, (v) => {
            rain = v;
            const sel = model.rain();
            if (sel)
                sel.value = v;
            paint("same");
        });
        if (at === "size") {
            const wi = $$1("dimw"), li = $$1("diml");
            const [fw, fl] = firstBedSize(unitSystem() === "metric");
            if (wi && li && !wi.value.trim() && !li.value.trim()) {
                wi.value = String(mToInput(fw));
                li.value = String(mToInput(fl));
            }
            const foot = $$1("ba-size")?.querySelector(".hint");
            if (foot) {
                foot.textContent = copy.bedAddSizeFoot.replace("{size}", `${fmtDec(Number(mToInput(fw)), 2)} × ${fmtDec(Number(mToInput(fl)), 2)} ${lengthUnit()}`);
            }
        }
        paintDependent();
        paintSizeReceipt();
        const act = $$1("dimmake");
        const nl = nextLabel();
        const row = document.querySelector("#bedadd .ba-actrow");
        let fwd = document.getElementById("ba-next");
        if (row)
            row.hidden = !!nl && choiceMovesOn();
        if (nl && choiceMovesOn()) {
            if (fwd)
                fwd.hidden = true;
            if (act)
                act.hidden = true;
        }
        else if (nl) {
            if (!fwd) {
                fwd = document.createElement("button");
                fwd.id = "ba-next";
                fwd.type = "button";
                fwd.className = "btn btn-primary primary";
                fwd.addEventListener("click", advance);
                row?.prepend(fwd);
            }
            fwd.textContent = nl;
            fwd.hidden = false;
            if (act)
                act.hidden = true;
        }
        else {
            if (fwd)
                fwd.hidden = true;
            if (act)
                act.hidden = false;
        }
        host.setPreview?.(at !== "how", facts());
        if (at !== "how") {
            try {
                app.planSheetMax?.();
            }
            catch { }
        }
        if (why !== "same") {
            const target = $$1("bedadd");
            if (target) {
                seat(scrollerFor(target), target, { motion: why === "open" ? "instant" : "smooth", reason: `bedadd-${at}` });
            }
        }
    }
    const doorLabel = () => {
        const n = document.querySelectorAll("#arealist .bedrow, #arealist .bedcard").length;
        door.textContent = n ? copy.bedAddDoorMore : copy.bedAddDoorFirst;
    };
    door.addEventListener("click", () => {
        open = true;
        at = "how";
        how = null;
        structure = spaceStructure();
        sun = null;
        rain = "";
        depthIn = null;
        const ss = model.structure();
        if (ss)
            ss.value = structure ?? "in_ground";
        const sn = model.sun();
        if (sn)
            sn.value = "";
        const rn = model.rain();
        if (rn)
            rn.value = "";
        paint("open");
    });
    ($$1("bedadd-back")?.querySelector("button"))?.addEventListener("click", () => {
        open = false;
        paint("open");
        doorLabel();
    });
    app.bedAddOpenAt = (to, withSun, dims) => {
        open = true;
        how = to === "how" ? null : "size";
        at = to;
        structure = spaceStructure();
        depthIn = null;
        sun = withSun === "full" || withSun === "part_shade" ? withSun : null;
        rain = "";
        const ss = model.structure();
        if (ss)
            ss.value = structure ?? "in_ground";
        const sn = model.sun();
        if (sn)
            sn.value = sun ?? "";
        const rn = model.rain();
        if (rn)
            rn.value = "";
        const wi = $$1("dimw"), li = $$1("diml");
        if (wi && li) {
            wi.value = dims ? String(mToInput(dims.w)) : "";
            li.value = dims ? String(mToInput(dims.l)) : "";
        }
        paint("open");
        doorLabel();
    };
    for (const id of ["dimw", "diml"]) {
        $$1(id)?.addEventListener("input", () => {
            paintSizeReceipt();
            host.setPreview?.(open && at !== "how", facts());
        });
    }
    window.addEventListener("gg-bed-saved", () => { open = false; paint("open"); });
    const list = $$1("arealist");
    if (list)
        new MutationObserver(doorLabel).observe(list, { childList: true, subtree: true });
    doorLabel();
    paint("open");
}
function renderBedPreview(host, f) {
    const u = lengthUnit();
    const w = f.widthM, l = f.lengthM;
    const wv = w != null ? mToInput(w) : null, lv = l != null ? mToInput(l) : null;
    const kind = f.structure === "raised" ? copy.bedAddKindRaised
        : f.structure === "container" ? copy.bedAddKindContainer
            : f.structure === "field" ? copy.bedAddKindField
                : f.structure === "in_ground" ? copy.bedAddKindInGround : null;
    const size = wv && lv ? `${wv} × ${lv} ${u}` : null;
    host.replaceChildren();
    const label = document.createElement("p");
    label.className = "bpv-label";
    label.textContent = copy.bedAddPreviewLabel;
    const h = document.createElement("p");
    h.className = "bpv-h";
    h.textContent = [kind, size].filter(Boolean).join(", ") || copy.bedAddTitle;
    const fig = document.createElement("div");
    fig.className = "bpv-fig";
    fig.appendChild(bedFigure(wv, lv, f.structure, f.depthIn, u));
    const facts = document.createElement("div");
    facts.className = "bpv-facts";
    const fact = (k, v) => {
        const d = document.createElement("div");
        const kk = document.createElement("div");
        kk.className = "bpv-fact-k";
        kk.textContent = k;
        const vv = document.createElement("div");
        vv.className = "bpv-fact-v";
        vv.textContent = v;
        d.append(kk, vv);
        facts.appendChild(d);
    };
    if (wv && lv)
        fact(copy.bedAddPreviewArea, `${(wv * lv).toFixed(0)} ${u}²`);
    if (w != null)
        fact(copy.bedAddPreviewReach, reachWord(w));
    if (f.depthIn)
        fact(copy.bedAddPreviewDepth, `${f.depthIn} in`);
    if (facts.childElementCount)
        host.append(label, h, fig, facts);
    else
        host.append(label, h, fig);
}
function bedFigure(w, l, structure, depthIn, unit) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 440 300");
    svg.setAttribute("width", "440");
    svg.setAttribute("height", "300");
    svg.setAttribute("role", "img");
    const mk = (t, a) => {
        const e = document.createElementNS(ns, t);
        for (const [k, v] of Object.entries(a))
            e.setAttribute(k, v);
        return e;
    };
    const sized = !!(w && l);
    const ratio = sized ? Math.min(Math.max(l / w, 0.25), 4) : 2;
    const maxW = 316, maxH = 168;
    let bw = maxW, bh = maxW / ratio;
    if (bh > maxH) {
        bh = maxH;
        bw = maxH * ratio;
    }
    const x = (440 - bw) / 2, y = (300 - bh) / 2 - 12;
    if (sized) {
        svg.appendChild(mk("ellipse", { cx: "220", cy: String(y + bh + 16), rx: String(bw / 2 + 8),
            ry: "14", fill: "var(--paint-lawn, #a9b57a)", "fill-opacity": ".45" }));
    }
    svg.appendChild(mk("rect", { x: String(x), y: String(y), width: String(bw), height: String(bh),
        rx: "4", fill: sized ? "var(--paint-soil, #b8946a)" : "none", stroke: "var(--color-text)",
        "stroke-width": sized ? "2.5" : "1.75", "stroke-opacity": sized ? ".72" : ".34",
        ...(sized ? {} : { "stroke-dasharray": "7 6" }) }));
    if (sized && (structure === "raised" || structure === "container")) {
        svg.appendChild(mk("rect", { x: String(x), y: String(y), width: String(bw), height: "18",
            rx: "3", fill: "var(--color-text)", "fill-opacity": ".55" }));
    }
    const dim = (x1, y1, x2, y2) => svg.appendChild(mk("line", { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2),
        stroke: "var(--muted)", "stroke-width": "1.5" }));
    const text = (tx, ty, s, rot) => {
        const t = mk("text", { x: String(tx), y: String(ty), "text-anchor": "middle",
            "font-size": "14", "font-weight": "600", fill: "var(--muted)" });
        if (rot)
            t.setAttribute("transform", rot);
        t.textContent = s;
        svg.appendChild(t);
    };
    if (w && l) {
        dim(x, y + bh + 2, x, y + bh + 22);
        dim(x + bw, y + bh + 2, x + bw, y + bh + 22);
        dim(x, y + bh + 16, x + bw, y + bh + 16);
        text(220, y + bh + 38, `${l} ${unit}`);
        dim(x + bw + 18, y, x + bw + 40, y);
        dim(x + bw + 18, y + bh, x + bw + 40, y + bh);
        dim(x + bw + 32, y, x + bw + 32, y + bh);
        text(x + bw + 52, y + bh / 2, `${w} ${unit}`, `rotate(90 ${x + bw + 52} ${y + bh / 2})`);
    }
    if (depthIn) {
        const t = mk("text", { x: String(x - 26), y: String(y + bh / 2), "text-anchor": "middle",
            "font-size": "13", "font-weight": "700", fill: "var(--ok)",
            transform: `rotate(-90 ${x - 26} ${y + bh / 2})` });
        t.textContent = `${depthIn} in deep`;
        svg.appendChild(t);
    }
    return svg;
}
const MYBED_RIBBON = {
    plants: copy.mybedRibbonPlants,
    arrange: copy.mybedRibbonArrange,
    found: copy.mybedRibbonFound,
};
const MYBED_NEXT = {
    plants: "", arrange: copy.mybedNextArrange, found: copy.mybedNextFound,
};
const MYBED_LEDE = {
    plants: copy.mybedPlantsAsk,
    arrange: copy.mybedArrangeLede,
    found: copy.mybedFoundLede,
};
function initMyBedTrack() {
    const ribbonHost = $$1("mybed-ribbon");
    const next = $$1("mybed-next");
    const back = $$1("mybed-back");
    if (!ribbonHost || !next)
        return;
    let at = "plants";
    const STEPS_MB = ["plants", "arrange", "found"];
    let chose = false;
    let decided = false;
    const plantCount = () => document.querySelectorAll("#mybedmembers .memberrow, #mybedmembers li").length;
    const paint = (motion) => {
        const membersHost = $$1("mybedmembers");
        if (!decided && (membersHost?.childElementCount ?? 0) > 0) {
            decided = true;
            if (!chose && plantCount() > 0)
                at = "found";
        }
        for (const s of STEPS_MB) {
            const sec = $$1(`mb-${s}`);
            if (sec)
                sec.hidden = s !== at;
        }
        const lede = $$1("mybed-lede");
        if (lede) {
            lede.textContent = MYBED_LEDE[at];
            lede.hidden = !MYBED_LEDE[at];
        }
        ribbonHost.replaceChildren();
        STEPS_MB.forEach((s, i) => {
            const here = s === at, done = i < STEPS_MB.indexOf(at);
            const el = document.createElement(done ? "button" : "span");
            el.className = `ba-rib${here ? " here" : ""}${done ? " done" : ""}`;
            el.textContent = MYBED_RIBBON[s];
            el.setAttribute("role", "listitem");
            if (done) {
                el.type = "button";
                el.addEventListener("click", () => { at = s; chose = true; paint("smooth"); });
            }
            else if (!here) {
                el.setAttribute("aria-disabled", "true");
            }
            if (here)
                el.setAttribute("aria-current", "step");
            ribbonHost.appendChild(el);
        });
        const n = plantCount();
        const i = STEPS_MB.indexOf(at);
        const to = STEPS_MB[i + 1];
        next.hidden = !to;
        next.textContent = to ? MYBED_NEXT[to] : "";
        next.disabled = n === 0;
        let why = document.getElementById("mybed-next-why");
        if (!why) {
            why = document.createElement("p");
            why.id = "mybed-next-why";
            why.className = "hint";
            next.parentElement?.appendChild(why);
        }
        why.textContent = "";
        why.hidden = true;
        const step = document.getElementById("step-mybed");
        if (step?.open) {
            const target = ($$1("mybed-back")?.parentElement ?? $$1("mybed"));
            if (target)
                seat(scrollerFor(target), target, { motion, reason: `mybed-${at}` });
        }
    };
    next.addEventListener("click", () => {
        const to = STEPS_MB[STEPS_MB.indexOf(at) + 1];
        if (to) {
            at = to;
            chose = true;
            paint("smooth");
        }
    });
    back?.addEventListener("click", () => {
        const plan = document.getElementById("step-plan");
        if (plan && !plan.open)
            plan.open = true;
    });
    const members = $$1("mybedmembers");
    if (members)
        new MutationObserver(() => paint("smooth")).observe(members, { childList: true, subtree: true });
    document.getElementById("step-mybed")?.addEventListener("toggle", () => {
        if (document.getElementById("step-mybed").open) {
            at = "plants";
            chose = false;
            decided = false;
            paint("instant");
        }
    });
    paint("instant");
}

const TILE = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const ATTRIBUTION = "Imagery: Esri, Maxar, Earthstar Geographics";
const TILE_BASE_MAX = 20;
const TILE_DEEP_MAX = 22;
function tilePlan(zoom, dpr) {
    const z = Math.max(1, Math.round(zoom));
    const want = Math.min(TILE_DEEP_MAX, z + (dpr >= 1.5 ? 1 : 0));
    const baseZ = Math.min(z, TILE_BASE_MAX);
    return { baseZ, enhZ: want > baseZ ? want : null };
}
const FAILED_TILES = new Set();
const FAILED_CAP = 800;
const rememberFailed = (href) => {
    if (FAILED_TILES.size >= FAILED_CAP)
        FAILED_TILES.clear();
    FAILED_TILES.add(href);
};
const TILEMAP_URL = (z, y, x, h, w) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/${z}/${y}/${x}/${h}/${w}?f=json`;
const TILEMAP_BLOCK = 8;
const tilemapCache = new Map();
function esriTileAvailable(z, x, y) {
    const bx = Math.floor(x / TILEMAP_BLOCK) * TILEMAP_BLOCK;
    const by = Math.floor(y / TILEMAP_BLOCK) * TILEMAP_BLOCK;
    const key = `${z}/${by}/${bx}`;
    let p = tilemapCache.get(key);
    if (!p) {
        if (tilemapCache.size > 200)
            tilemapCache.clear();
        p = fetch(TILEMAP_URL(z, by, bx, TILEMAP_BLOCK, TILEMAP_BLOCK))
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => (Array.isArray(j?.data) ? j.data : null))
            .catch(() => null);
        tilemapCache.set(key, p);
    }
    return p.then((data) => !!data && data[(y - by) * TILEMAP_BLOCK + (x - bx)] === 1);
}
const GOOGLE_SESSION_URL = (key) => "https://tile.googleapis.com/v1/createSession?key=" + encodeURIComponent(key);
const GOOGLE_TILE = (z, x, y, session, key) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;
const GOOGLE_ATTR = "Imagery ©Google";
let gSession = null;
let gDenied = false;
let gPending = false;
let gCopyright = "";
const SVG_NS$1 = "http://www.w3.org/2000/svg";
const googleTilesReady = () => !!(gSession && mapsApiKey() && !gDenied);
const readyWaiters = new Set();
function kickGoogleSession(onReady) {
    const key = mapsApiKey();
    if (!key || gDenied || gSession)
        return;
    readyWaiters.add(onReady);
    if (gPending)
        return;
    gPending = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch(GOOGLE_SESSION_URL(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mapType: "satellite", language: "en-US", region: "US",
            ...(typeof devicePixelRatio === "number" && devicePixelRatio >= 1.5
                ? { scale: "scaleFactor2x", highDpi: true } : {}),
        }),
        signal: ctrl.signal,
    })
        .then(async (res) => {
        if (res.ok) {
            const body = (await res.json());
            if (body.session) {
                gSession = body.session;
                const waiting = [...readyWaiters];
                readyWaiters.clear();
                for (const w of waiting)
                    w();
                return;
            }
        }
        gDenied = true;
    })
        .catch(() => { })
        .finally(() => { clearTimeout(timer); gPending = false; });
}
async function googleCopyright(key, session, z, n, s, e, w) {
    if (gCopyright)
        return;
    try {
        const url = `https://tile.googleapis.com/tile/v1/viewport?session=${encodeURIComponent(session)}` +
            `&key=${encodeURIComponent(key)}&zoom=${z}&north=${n}&south=${s}&east=${e}&west=${w}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const body = (await (await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))).json());
        if (body.copyright) {
            gCopyright = body.copyright;
            const attrib = document.getElementById("mapattrib");
            if (attrib && attrib.textContent === GOOGLE_ATTR)
                attrib.textContent = gCopyright;
        }
    }
    catch { }
}
function drawTiles(o) {
    if (mapsApiKey() && !gSession && !gDenied)
        kickGoogleSession(o.requestRedraw);
    const useGoogle = googleTilesReady();
    const gKey = mapsApiKey();
    const hrefFor = useGoogle && gSession && gKey
        ? (t) => GOOGLE_TILE(t.z, t.x, t.y, gSession, gKey)
        : (t) => TILE(t.z, t.x, t.y);
    const attribution = useGoogle ? (gCopyright || GOOGLE_ATTR) : ATTRIBUTION;
    if (useGoogle && gSession && gKey) {
        const [latN, lonE] = fromLocal(o.anchor, o.cx + o.span / 2, o.cy + o.span / 2);
        const [latS, lonW] = fromLocal(o.anchor, o.cx - o.span / 2, o.cy - o.span / 2);
        void googleCopyright(gKey, gSession, Math.round(o.zoom), latN, latS, lonE, lonW);
    }
    let pool = TILE_POOLS.get(o.svg);
    if (!pool) {
        pool = new Map();
        TILE_POOLS.set(o.svg, pool);
    }
    const seen = new Set();
    const plan = tilePlan(o.zoom, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    const passes = [{ z: plan.baseZ, speculative: false }];
    if (plan.enhZ != null && !o.plain)
        passes.push({ z: plan.enhZ, speculative: plan.enhZ > TILE_BASE_MAX && !useGoogle });
    for (const pass of passes) {
        for (const t of tilesForViewport(o.anchor, o.cx, o.cy, o.span, pass.z)) {
            const key = `${t.z}/${t.x}/${t.y}`;
            const href = hrefFor(t);
            if (FAILED_TILES.has(href))
                continue;
            seen.add(key);
            const [px, py] = o.toPx(t.x0, t.y0 + t.size);
            const w = String(t.size / o.mpp);
            let img = pool.get(key);
            if (!img) {
                img = document.createElementNS(SVG_NS$1, "image");
                img.setAttribute("preserveAspectRatio", "none");
                if (pass.speculative) {
                    img.dataset.href = href;
                    void esriTileAvailable(t.z, t.x, t.y).then((ok) => {
                        if (ok)
                            img.setAttribute("href", href);
                        else {
                            rememberFailed(href);
                            img.remove();
                            pool.delete(key);
                        }
                    });
                }
                else {
                    img.setAttribute("href", href);
                    img.dataset.href = href;
                }
                img.addEventListener("load", () => { o.attrib.textContent = attribution; });
                img.addEventListener("error", () => {
                    rememberFailed(img.dataset.href ?? "");
                    img.remove();
                    pool.delete(key);
                    if (!o.attrib.textContent)
                        o.attrib.textContent = copy.gmNoImagery;
                });
                pool.set(key, img);
                o.svg.appendChild(img);
            }
            else if (img.dataset.href !== href) {
                img.setAttribute("href", href);
                img.dataset.href = href;
            }
            img.setAttribute("x", String(px));
            img.setAttribute("y", String(py));
            img.setAttribute("width", w);
            img.setAttribute("height", w);
        }
    }
    for (const [key, img] of pool)
        if (!seen.has(key)) {
            img.remove();
            pool.delete(key);
        }
}
const TILE_POOLS = new WeakMap();

const lLocalPts = (w, l, nw, nl) => {
    const hw = w / 2, hl = l / 2;
    return [[-hw, hl], [hw - nw, hl], [hw - nw, hl - nl], [hw, hl - nl], [hw, -hl], [-hw, -hl]];
};
const uLocalPts = (w, l, nw, nl) => {
    const hw = w / 2, hl = l / 2, hn = nw / 2;
    return [[-hw, hl], [-hn, hl], [-hn, hl - nl], [hn, hl - nl], [hn, hl], [hw, hl], [hw, -hl], [-hw, -hl]];
};
const TROUGH_SEG = 12;
const troughLocalPts = (w, l) => {
    const r = w / 2, cyy = l / 2 - r;
    const pts = [];
    for (let i = 0; i <= TROUGH_SEG; i++) {
        const a = Math.PI - (Math.PI * i) / TROUGH_SEG;
        pts.push([r * Math.cos(a), cyy + r * Math.sin(a)]);
    }
    for (let i = 0; i <= TROUGH_SEG; i++) {
        const a = -(Math.PI * i) / TROUGH_SEG;
        pts.push([r * Math.cos(a), -cyy + r * Math.sin(a)]);
    }
    return pts;
};
const recogniseL = (pts) => {
    if (pts.length !== 6)
        return null;
    const eps = 0.02;
    for (let i = 0; i < 6; i++) {
        const a = pts[i], b = pts[(i + 1) % 6];
        if (Math.abs(a[0] - b[0]) > eps && Math.abs(a[1] - b[1]) > eps)
            return null;
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
    if (inner.length !== 1)
        return null;
    if (pts.some((p) => Math.abs(p[0] - maxX) < eps && Math.abs(p[1] - maxY) < eps))
        return null;
    return { w: maxX - minX, l: maxY - minY, nw: maxX - inner[0][0], nl: maxY - inner[0][1],
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};
const recogniseTrough = (pts) => {
    if (pts.length !== (TROUGH_SEG + 1) * 2)
        return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, l = maxY - minY, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (l < w - 0.02)
        return null;
    const expect = troughLocalPts(w, l);
    for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(pts[i][0] - cx - expect[i][0], pts[i][1] - cy - expect[i][1]) > 0.05)
            return null;
    }
    return { w, l, cx, cy };
};
const recogniseU = (pts) => {
    if (pts.length !== 8)
        return null;
    const eps = 0.02;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, l = maxY - minY, ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
    const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
    if (inner.length !== 2)
        return null;
    const nw = Math.abs(inner[1][0] - inner[0][0]), nl = maxY - inner[0][1];
    if (nw < 0.05 || nl < 0.05)
        return null;
    const expect = uLocalPts(w, l, nw, nl);
    for (let i = 0; i < 8; i++) {
        if (Math.hypot(pts[i][0] - ccx - expect[i][0], pts[i][1] - ccy - expect[i][1]) > 0.05)
            return null;
    }
    return { w, l, nw, nl, cx: ccx, cy: ccy };
};
const unrotatePts = (pts, angle) => {
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([x, y]) => { const r = rotPt(x - mx, y - my, -angle); return [mx + r[0], my + r[1]]; });
};

let j = null;
function gardenNameProblem(name, own) {
    const n = name.trim();
    if (!n)
        return "gaErrName";
    const key = n.toLocaleLowerCase();
    if (own.some((p) => (p.name ?? "").trim().toLocaleLowerCase() === key))
        return "gaErrSame";
    return null;
}
function gardenIdBase(name) {
    const id = plotIdFor(name);
    return /_$/.test(id) ? plotIdFor("garden") : id;
}
const own = (plots) => plots.filter((p) => !p.example && !p.shared);
const clearLocation = () => {
    for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
        const f = document.getElementById(id);
        if (f)
            f.value = "";
    }
    const zh = document.getElementById("ziphint");
    if (zh)
        zh.textContent = "";
    document.getElementById("addrlist")?.replaceChildren();
};
const openStep = (step) => { window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step } })); };
const bringIntoView = () => {
    const card = document.getElementById("gardenadd");
    const sb = document.getElementById("sheetbody");
    if (card && sb && !card.hidden)
        setTimeout(() => seat(sb, card, { block: "start", offset: 8, force: true, hold: 1500, reason: "gardenadd" }), 0);
};
async function openGardenAdd(carry = null, o = {}) {
    const replace = !plusPreview();
    if (replace && !carry && !o.replace)
        return;
    if (j && j.stage !== "done") {
        if (carry)
            j.carry = carry;
        render();
        bringIntoView();
        return;
    }
    j = { stage: "name", id: null, name: "", prev: app.currentPlotId, err: null, draft: "", others: 0, teams: false, carry, replace, closes: null };
    if (replace) {
        await nameTheClosing();
        if (!j)
            return;
    }
    openStep("step-where");
    render();
    bringIntoView();
    if (matchMedia("(min-width: 900px)").matches)
        requestAnimationFrame(() => focusIfItFits("ga-name"));
}
const ownOpen = (plots) => openGardens(own(plots));
async function nameTheClosing() {
    const db = app.logDb;
    if (!db || !j)
        return;
    const open = ownOpen(await listPlots(db));
    if (!j?.replace)
        return;
    const cur = open.find((p) => p.id === app.currentPlotId) ?? open[0];
    const names = [cur, ...open.filter((p) => p !== cur)].filter((p) => !!p).map((p) => p.name ?? "").filter(Boolean);
    j.closes = names.length ? names : null;
}
const listWords = (names) => {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
};
function gardenAddDraw(located) {
    if (j && j.id && app.currentPlotId !== j.id) {
        j = null;
        render();
    }
    if (j?.stage === "where" && located) {
        j.stage = "done";
        render();
        openStep("sec-ground");
        app.groundRefit?.();
        window.dispatchEvent(new Event("gg-garden-shown"));
        bringIntoView();
    }
    if (!j && !located)
        void resumeUnplaced();
    void paintEntry(located);
}
async function resumeUnplaced() {
    const db = app.logDb;
    const id = app.currentPlotId;
    if (!db)
        return;
    const plots = await listPlots(db);
    const p = plots.find((x) => x.id === id);
    if (j || id === cancelled || app.currentPlotId !== id || !p || p.example || p.shared || p.anchor || p.beds.length || !p.name)
        return;
    if (own(plots).length < 2 || (await listSeasons(db, id)).length)
        return;
    if (j || app.currentPlotId !== id)
        return;
    j = { stage: "where", id, name: p.name, prev: null, err: null, draft: "", others: plots.filter((x) => !x.example).length - 1,
        teams: plots.some((x) => x.shared) };
    render();
    void paintEntry(false);
}
async function paintEntry(located) {
    const row = document.getElementById("gardenaddrow");
    if (!row)
        return;
    if (!plusPreview()) {
        row.hidden = true;
        return;
    }
    const open = !!(j && j.stage !== "done");
    if (open || located) {
        row.hidden = open;
        return;
    }
    const db = app.logDb;
    row.hidden = !(db && ownOpen(await listPlots(db)).length > 1);
}
async function createNamed(name) {
    const db = app.logDb;
    if (!j || !db || creating)
        return;
    creating = true;
    try {
        await makeNamed(db, name);
    }
    finally {
        creating = false;
    }
}
let creating = false;
const madeThisVisit = new Set();
async function makeNamed(db, name) {
    if (!j)
        return;
    const plots = await listPlots(db);
    const problem = gardenNameProblem(name, ownOpen(plots));
    const same = ownOpen(plots).find((p) => (p.name ?? "").trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (problem) {
        j.err = problem === "gaErrSame" ? fillCopy("gaErrSame", { name: (same?.name ?? name).trim() }) : copy.gaErrName;
        j.draft = name;
        render();
        return;
    }
    const id = await freePlotId(db, gardenIdBase(name));
    await putPlot(db, { id, name: name.trim(), beds: [] });
    const closing = j.replace ? ownOpen(plots).map((p) => p.id) : [];
    for (const c of closing)
        await setGardenClosed(db, c, localTodayIso());
    if (closing.includes(defaultPlotId() ?? ""))
        setDefaultPlot(null);
    if (j)
        j.closed = closing;
    madeThisVisit.add(id);
    clearLocation();
    await app.switchPlot?.(id);
    if (!j)
        return;
    j.id = id;
    j.name = name.trim();
    j.stage = "where";
    j.err = null;
    j.teams = plots.some((p) => p.shared);
    j.others = openGardens(plots).filter((p) => !p.example && !closing.includes(p.id)).length;
    openStep("step-where");
    render();
    bringIntoView();
    if (j.carry) {
        const la = document.getElementById("lat"), lo = document.getElementById("lon");
        if (la && lo) {
            la.value = String(j.carry.lat);
            lo.value = String(j.carry.lon);
            la.dispatchEvent(new Event("input"));
            return;
        }
    }
    requestAnimationFrame(() => focusIfItFits("addr"));
}
function focusIfItFits(id) {
    const f = document.getElementById(id);
    const card = document.getElementById("gardenadd");
    const sb = document.getElementById("sheetbody");
    if (!f || (card && sb && f.getBoundingClientRect().bottom - card.getBoundingClientRect().top + 8 > sb.clientHeight))
        return;
    f.focus({ preventScroll: true });
}
let cancelled = null;
async function cancel() {
    const db = app.logDb;
    const was = j;
    j = null;
    cancelled = was?.id ?? null;
    render();
    if (!was?.id || !db)
        return;
    const p = await getPlot(db, was.id);
    if (p && !p.anchor && !p.beds.length)
        await eraseGarden(db, was.id, { tombstone: p.owner === "account" });
    for (const c of was.closed ?? [])
        await setGardenClosed(db, c, null);
    let left = await listPlots(db);
    if (!ownOpen(left).length) {
        const last = own(left).filter(gardenClosed).sort((a, b) => String(b.closed_date).localeCompare(String(a.closed_date)))[0];
        if (last) {
            await setGardenClosed(db, last.id, null);
            left = await listPlots(db);
        }
    }
    const back = was.prev && openGardens(left).some((x) => x.id === was.prev) ? was.prev : pickGarden(left, { def: defaultPlotId() });
    if (back)
        await app.switchPlot?.(back);
}
function render() {
    const box = document.getElementById("gardenadd");
    if (!box)
        return;
    box.replaceChildren();
    box.hidden = !j;
    if (!j)
        return;
    box.dataset.stage = j.stage;
    const h = el$1(box, "h2", "gardenadd-h");
    h.id = "gardenadd-h";
    const acts = el$1("p", "gardenadd-acts");
    const cancelBtn = el$1("button", "btn btn-quiet tertiary", copy.gmCancel);
    cancelBtn.type = "button";
    cancelBtn.id = "ga-cancel";
    cancelBtn.addEventListener("click", () => void cancel());
    if (j.stage === "name") {
        h.textContent = j.replace ? copy.gaReplaceTitle : copy.gaTitle;
        el$1(box, "p", "gardenadd-lede", j.replace ? copy.gaReplaceLede : copy.gaLede);
        if (j.replace && j.closes?.length) {
            const c = el$1(box, "p", "gardenadd-lede gardenadd-closes", j.closes.length === 1
                ? fillCopy("gaClosesNote", { name: j.closes[0] }) : fillCopy("gaClosesNoteMany", { list: listWords(j.closes) }));
            c.id = "ga-closes";
        }
        const form = el$1(box, "form", "gardenadd-form");
        const lab = el$1(form, "label", null, copy.gaNameLabel);
        lab.htmlFor = "ga-name";
        const inp = el$1(form, "input");
        inp.id = "ga-name";
        inp.type = "text";
        inp.placeholder = copy.gaNamePh;
        inp.value = j.draft;
        inp.autocomplete = "off";
        inp.setAttribute("enterkeyhint", "next");
        inp.addEventListener("input", () => { if (j)
            j.draft = inp.value; });
        const next = el$1("button", "btn btn-primary primary", copy.gaNext);
        next.type = "submit";
        next.id = "ga-next";
        form.addEventListener("submit", (e) => { e.preventDefault(); void createNamed(inp.value); });
        if (j.err) {
            const m = el$1(form, "p", "gardenadd-err", j.err);
            m.setAttribute("role", "alert");
            m.id = "ga-err";
            inp.setAttribute("aria-invalid", "true");
            inp.setAttribute("aria-describedby", "ga-err");
        }
        acts.append(next, cancelBtn);
        form.appendChild(acts);
        return;
    }
    if (j.stage === "where") {
        h.textContent = fillCopy("gaWhereTitle", { name: j.name });
        el$1(box, "p", "gardenadd-lede", copy.gaWhereLede);
        acts.append(cancelBtn);
        box.appendChild(acts);
        return;
    }
    h.textContent = fillCopy("gaDoneTitle", { name: j.name });
    el$1(box, "p", "gardenadd-lede", copy.gaDoneLede);
    const id = j.id;
    if (j.others > 0) {
        const offer = el$1(box, "p", "gardenadd-def");
        el$1(offer, "span", null, copy.gaDefaultAsk);
        const def = el$1(offer, "button");
        def.type = "button";
        def.id = "ga-default";
        paintDefaultToggle(def, defaultPlotId() === id);
        def.addEventListener("click", () => {
            setDefaultPlot(defaultPlotId() === id ? null : id);
            paintDefaultToggle(def, defaultPlotId() === id);
            void app.logRefresh?.();
        });
    }
    if (j.teams)
        el$1(box, "p", "gardenadd-own", copy.gaOwnNotShared);
    const done = el$1("button", "btn btn-secondary secondary", copy.gaDone);
    done.type = "button";
    done.id = "ga-done";
    done.addEventListener("click", () => { j = null; render(); void paintEntry(true); });
    acts.append(done);
    box.appendChild(acts);
}

const tipDay = (iso) => fmtMonthDay(iso);
const SVG_NS = "http://www.w3.org/2000/svg";
function fillNodes(parent, template, parts) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        const v = k ? parts[k] : undefined;
        if (v !== undefined)
            parent.appendChild(typeof v === "string" ? document.createTextNode(v) : v);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
const VIEW = 440;
const ZOOM_MIN = 17, ZOOM_MAX = 23;
const FIT_FRAC = 0.62;
const ARRIVE_FRAC = 0.78;
const LOCATE_ZOOM = 18;
const BED_TAP_SLOP_PX = 16;
const $ = (id) => document.getElementById(id);
function initGroundMap(db, plotId, latlon, onBedsChanged, onPlotSwitched) {
    let zoom = 19;
    let viewH = VIEW;
    let cx = 0, cy = 0;
    let lastFitPlotId = null;
    let lastFitHadBeds = false;
    const pillBand = () => {
        const pill = document.getElementById("editground");
        const pr = pill?.getBoundingClientRect(), sr = svg.getBoundingClientRect();
        if (!pr || !pr.height || !sr.height || !sr.width || pr.bottom <= sr.top)
            return 0;
        return Math.min(viewH / 2, ((pr.bottom - sr.top + 6) * VIEW) / sr.width);
    };
    const fitObstacles = () => {
        const sr = svg.getBoundingClientRect();
        if (!sr.width || !sr.height)
            return [];
        const k = VIEW / sr.width, air = 6;
        const out = [];
        for (const id of ["editground", "mapzout", "mapzin", "mapc"]) {
            const r = document.getElementById(id)?.getBoundingClientRect();
            if (!r || !r.width || !r.height || r.bottom <= sr.top || r.top >= sr.bottom)
                continue;
            out.push([(r.left - sr.left - air) * k, (r.top - sr.top - air) * k, (r.right - sr.left + air) * k, (r.bottom - sr.top + air) * k]);
        }
        return out;
    };
    let fit = null;
    let tracePts = [];
    let mode = "rect";
    let reachSeenSession = false;
    const plantAsked = new Map();
    let containerDismissed = false;
    let prevStructure = "in_ground";
    let lastPlot = null;
    let lastPlotId = null;
    let lastPlotAt = 0;
    const invalidatePlot = () => { lastPlotAt = 0; };
    let prevDotKeys = null;
    let celebration = null;
    let pending = null;
    let proposalRect = null;
    let proposalTaken = false;
    let pendingAngle = 0;
    let editingFrom = null;
    let notice = null;
    let keyOpen = false;
    let anchorLat = null;
    let anchorLL = null;
    let anchorBeds = 0;
    const locating = () => !!document.getElementById("step-where")?.open;
    const MOVE_LABEL = copy.planMoveGardenBtn;
    const NEW_GARDEN_KM = 1;
    let moveArmed = false;
    let moveArmTimer = 0;
    const layerState = { areas: true, plantings: true, labels: true, tint: "season" };
    try {
        Object.assign(layerState, JSON.parse(localStorage.getItem("gg-maplayers") ?? "{}"));
        if (!["season", "sun", "soil", "rotation"].includes(layerState.tint))
            layerState.tint = "season";
    }
    catch { }
    const TINT_WORDS = {
        season: copy.gmTintSeason,
        sun: copy.gmTintSun,
        soil: copy.gmTintSoil,
        rotation: copy.gmTintRotation,
    };
    let look = "illustrated";
    try {
        if (localStorage.getItem("gg-maplook") === "photo")
            look = "photo";
    }
    catch { }
    let redoPts = [];
    let redoPending = null;
    let lastAct = null;
    const svg = $("mapsvg");
    const mkLayer = (name, parent) => {
        const g = document.createElementNS(SVG_NS, "g");
        g.dataset.layer = name;
        parent.appendChild(g);
        return g;
    };
    const worldBack = mkLayer("worldback", svg);
    const washFixed = mkLayer("washfixed", svg);
    const worldFront = mkLayer("worldfront", svg);
    const setWorldTransform = (t) => {
        for (const g of [worldBack, worldFront]) {
            if (t)
                g.setAttribute("transform", t);
            else
                g.removeAttribute("transform");
        }
    };
    const L = {
        tiles: mkLayer("tiles", worldBack), wash: mkLayer("wash", washFixed), grid: mkLayer("grid", worldFront),
        beds: mkLayer("beds", worldFront), dots: mkLayer("dots", worldFront), edit: mkLayer("edit", worldFront),
        chrome: mkLayer("chrome", worldFront), fx: mkLayer("fx", svg),
    };
    {
        const defs = document.createElementNS(SVG_NS, "defs");
        defs.innerHTML =
            '<pattern id="tuftpat" width="52" height="52" patternUnits="userSpaceOnUse">' +
                '<path d="M10 14 q2 -6 4 0 M13 14 q2 -6 4 0" stroke="var(--ill-tuft)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
                '<path d="M36 40 q2 -6 4 0 M39 40 q2 -6 4 0" stroke="var(--ill-tuft)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
                '<circle cx="44" cy="12" r="1.1" fill="var(--ill-tuft)"/><circle cx="20" cy="34" r="1.1" fill="var(--ill-tuft)"/></pattern>' +
                '<pattern id="grainpat" width="14" height="14" patternUnits="userSpaceOnUse">' +
                '<circle cx="3" cy="4" r=".9" fill="var(--ill-soil-edge)" opacity=".35"/>' +
                '<circle cx="10" cy="10" r=".9" fill="var(--ill-soil-edge)" opacity=".28"/></pattern>';
        svg.insertBefore(defs, svg.firstChild);
    }
    let msgTimer = 0;
    const toast$1 = (t, ms = 2500) => {
        const h = $("maphint");
        if (h.textContent === t && !h.classList.contains("faded"))
            return;
        h.textContent = t;
        h.classList.remove("faded");
        clearTimeout(msgTimer);
        msgTimer = window.setTimeout(() => h.classList.add("faded"), ms);
    };
    let noticeDismissed = false;
    const note = (guidance) => {
        const n = $("mapnotices");
        const show = !!guidance && !noticeDismissed;
        if (show && n.dataset.sig !== guidance) {
            n.dataset.sig = guidance;
            $("mapnoticestext").textContent = guidance;
        }
        n.hidden = !show;
    };
    const reachNote = (reach) => {
        const chip = $("mapreach");
        const show = !!reach && !reachSeenSession;
        if (show && chip.dataset.sig !== reach) {
            chip.dataset.sig = reach;
            $("mapreachtext").textContent = reach;
        }
        chip.hidden = !show;
    };
    const retireReach = () => { if (!$("mapreach").hidden)
        reachSeenSession = true; };
    const containerChip = (msg) => {
        const chip = $("mapcontainer");
        const show = !!msg && !containerDismissed;
        if (show && chip.dataset.sig !== msg) {
            chip.dataset.sig = msg;
            $("mapcontainertext").textContent = msg;
        }
        chip.hidden = !show;
    };
    const structBaseLabels = new Map(Array.from(($("bedstructure")).options).map((o) => [o.value, o.textContent ?? ""]));
    const applyStructureGate = () => {
        const sel = $("bedstructure");
        const name = ($("areaname")).value.trim();
        const gate = name ? app.bedStructureBlockers?.(name) ?? null : null;
        const blocked = new Set(gate?.blocked ?? []);
        for (const opt of Array.from(sel.options)) {
            const base = structBaseLabels.get(opt.value) ?? opt.textContent ?? "";
            const off = blocked.has(opt.value) && opt.value !== sel.value;
            opt.disabled = off;
            opt.textContent = off ? fillCopy("gmStructNotFor", { base }) : base;
            if (off)
                opt.title = gate?.reason(opt.value) ?? "";
            else
                opt.removeAttribute("title");
        }
        const why = $("bedstructwhy");
        const reasons = [...new Set([...blocked]
                .filter((b) => b !== sel.value)
                .map((b) => gate?.reason(b) ?? "")
                .filter((t) => t.trim()))];
        why.textContent = reasons.join(" ");
        why.hidden = reasons.length === 0;
    };
    const CM_PER_IN = 2.54;
    const isContainerSize = () => ($("bedstructure")).value === "container";
    const cmInToM = (v) => (unitSystem() === "imperial" ? (v * CM_PER_IN) / 100 : v / 100);
    const mToCmIn = (m) => +(unitSystem() === "imperial" ? (m * 100) / CM_PER_IN : m * 100).toFixed(0);
    const sizeToM = (v) => (isContainerSize() ? cmInToM(v) : lenToM(v));
    const mToSize = (m) => (isContainerSize() ? mToCmIn(m) : mToInput(m));
    const sizeUnitLabel = () => isContainerSize()
        ? (unitSystem() === "imperial" ? "in" : "cm")
        : (unitSystem() === "imperial" ? "ft" : "m");
    const refreshSizeUnitDisplay = () => {
        const lbl = sizeUnitLabel();
        document.querySelectorAll("#dimsrect .ulen, #dimscircle .ulen, #dimsl .ulen, #dimsu .ulen, #dimstrough .ulen")
            .forEach((s) => { s.textContent = lbl; });
        for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
            $(id).step = isContainerSize() ? "1" : "0.1";
        }
    };
    const dimNum = (id) => {
        const v = parseFloat($(id).value);
        return Number.isFinite(v) && v > 0 ? sizeToM(v) : null;
    };
    const freeGround = (p) => {
        if (mode !== "rect")
            return p;
        const d = rectDims();
        if (!d)
            return p;
        const hw = d[0] / 2, hh = d[1] / 2;
        let cx = p.cx;
        for (let i = 0; i < 12; i++) {
            const hit = app.logSnapshot.beds.find((b) => {
                const pts = regionPoints(b.region);
                const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
                return cx - hw < Math.max(...xs) && cx + hw > Math.min(...xs) && p.cy - hh < Math.max(...ys) && p.cy + hh > Math.min(...ys);
            });
            if (!hit)
                break;
            cx = snap(Math.max(...regionPoints(hit.region).map((q) => q[0])) + PATH_M + hw);
        }
        return { cx, cy: p.cy };
    };
    const rectDims = () => {
        const w = dimNum("shapew"), l = dimNum("shapel");
        return w && l ? [w, l] : null;
    };
    const circleR = () => {
        const d = dimNum("shaped");
        return d ? d / 2 : null;
    };
    const lDims = () => {
        const w = dimNum("lw"), l = dimNum("ll"), nw = dimNum("lnw"), nl = dimNum("lnl");
        if (!w || !l || !nw || !nl)
            return null;
        return { w, l, nw: Math.min(nw, w - 0.1), nl: Math.min(nl, l - 0.1) };
    };
    const troughDims = () => {
        const w = dimNum("tw"), l0 = dimNum("tl");
        return w && l0 ? { w, l: Math.max(l0, w) } : null;
    };
    const uDims = () => {
        const w = dimNum("uw"), l = dimNum("ul"), nw = dimNum("unw"), nl = dimNum("unl");
        if (!w || !l || !nw || !nl)
            return null;
        return { w, l, nw: Math.min(nw, w - 0.2), nl: Math.min(nl, l - 0.1) };
    };
    const presetWorldPts = () => {
        if (!pending)
            return null;
        let local = null;
        if (mode === "lbed") {
            const d = lDims();
            if (d)
                local = lLocalPts(d.w, d.l, d.nw, d.nl);
        }
        else if (mode === "ubed") {
            const d = uDims();
            if (d)
                local = uLocalPts(d.w, d.l, d.nw, d.nl);
        }
        else if (mode === "trough") {
            const d = troughDims();
            if (d)
                local = troughLocalPts(d.w, d.l);
        }
        if (!local)
            return null;
        return local.map(([x, y]) => {
            const r = rotPt(x, y, pendingAngle);
            return [pending.cx + r[0], pending.cy + r[1]];
        });
    };
    const pendingBBox = () => {
        if (mode === "rect")
            return rectDims();
        if (mode === "lbed") {
            const d = lDims();
            return d ? [d.w, d.l] : null;
        }
        if (mode === "ubed") {
            const d = uDims();
            return d ? [d.w, d.l] : null;
        }
        if (mode === "trough") {
            const d = troughDims();
            return d ? [d.w, d.l] : null;
        }
        return null;
    };
    const el = (tag, attrs) => {
        const e = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs))
            e.setAttribute(k, String(v));
        return e;
    };
    const declutterBedLabels = (labels) => {
        if (!labels.length)
            return;
        const gap = 2;
        const placed = [];
        const hits = (b, p) => b.x < p.x + p.w + gap && b.x + b.w + gap > p.x && b.y < p.y + p.h + gap && b.y + b.h + gap > p.y;
        try {
            const box = new Map(labels.map((l) => [l, l.getBBox()]));
            const order = [...labels].sort((a, b) => box.get(a).y - box.get(b).y);
            const ys = [];
            for (const lab of order) {
                const m = box.get(lab);
                const b = { x: m.x, y: m.y, w: m.width, h: m.height };
                let y = parseFloat(lab.getAttribute("y") ?? "0"), moved = false;
                for (let i = 0; i < 24 && placed.some((p) => hits(b, p)); i++) {
                    y += b.h + gap;
                    b.y += b.h + gap;
                    moved = true;
                }
                placed.push(b);
                ys.push(moved ? y : null);
            }
            order.forEach((lab, i) => {
                const b = placed[i], y = ys[i];
                if (y !== null)
                    lab.setAttribute("y", String(y));
                lab.parentNode?.insertBefore(el("rect", { class: "bedlabelbg", x: b.x - 3, y: b.y - 1, width: b.w + 6, height: b.h + 2, rx: 3 }), lab);
            });
        }
        catch { }
    };
    const pendingCorners = (w, l) => rectCorners(pending.cx, pending.cy, w, l, pendingAngle);
    const rotHandlePos = (l, mpp) => {
        const r = rotPt(0, l / 2 + 26 * mpp, pendingAngle);
        return [pending.cx + r[0], pending.cy + r[1]];
    };
    const setDim = (id, metres) => {
        $(id).value = String(mToSize(metres));
    };
    const closeBedPopover = () => {
        const bp = document.getElementById("bedpop");
        if (bp && !bp.hidden) {
            bp.hidden = true;
            bp.replaceChildren();
        }
    };
    const openBedPopover = (bed) => {
        const bp = document.getElementById("bedpop");
        if (!bp)
            return;
        bp.replaceChildren();
        const h = document.createElement("h3");
        h.textContent = bed.name;
        bp.appendChild(h);
        const pts = regionPoints(bed.region);
        const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
        const l = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
        const openSeason$1 = openSeason();
        const on = (openSeason$1?.plantings ?? []).filter((q) => {
            try {
                return plantingOnBed(q.region, bed.region);
            }
            catch {
                return false;
            }
        });
        const sown = on.map((q) => q.sown).filter((d) => !!d).sort()[0];
        const meta = document.createElement("p");
        meta.className = "bp-meta";
        meta.textContent = [
            `${fmtLen(w)} × ${fmtLen(l)}`,
            humanize(bed.structure ?? "in_ground"),
            bed.sun === "full" ? copy.plFullSunLc : bed.sun === "part_shade" ? copy.plPartShadeLc : copy.gmSunNotStated,
            ...(sown ? [fillCopy("gmPopPlanted", { date: sown.slice(5).replace("-", "/") })] : []),
        ].join(" · ");
        bp.appendChild(meta);
        const species = [...new Set(on.map((q) => q.species))];
        if (species.length) {
            const chips = document.createElement("p");
            chips.className = "bp-chips";
            for (const s of species) {
                const c = document.createElement("span");
                c.className = "bp-chip";
                c.textContent = app.speciesName?.(s) ?? humanize(s);
                chips.appendChild(c);
            }
            bp.appendChild(chips);
        }
        const acts = document.createElement("div");
        acts.className = "bp-acts";
        const planBtn = document.createElement("button");
        planBtn.type = "button";
        planBtn.className = "btn btn-primary primary";
        planBtn.textContent = copy.gmOpenInPlan;
        planBtn.addEventListener("click", () => {
            closeBedPopover();
            const cand = document.getElementById("candbed");
            if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
                const step = document.getElementById("step-plan");
                if (step)
                    step.open = true;
                if (cand.value !== bed.name) {
                    cand.value = bed.name;
                    cand.dispatchEvent(new Event("change"));
                }
            }
        });
        const logBtn = document.createElement("button");
        logBtn.type = "button";
        logBtn.className = "bp-link";
        logBtn.textContent = copy.gmLogHere;
        logBtn.addEventListener("click", () => { closeBedPopover(); app.openLogBed?.(bed.name, null); });
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "bp-link";
        editBtn.textContent = copy.gmEdit;
        editBtn.addEventListener("click", () => { closeBedPopover(); startEditBed(bed); });
        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "bp-link";
        dupBtn.textContent = copy.gmDuplicate;
        dupBtn.addEventListener("click", () => { closeBedPopover(); startDuplicateBed(bed); });
        acts.append(planBtn, logBtn, editBtn, dupBtn);
        bp.appendChild(acts);
        bp.hidden = false;
        planBtn.focus({ preventScroll: true });
    };
    let popFromKey = null;
    svg.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ")
            return;
        const name = e.target?.getAttribute?.("data-bed");
        const bed = name ? app.logSnapshot.beds.find((b) => b.name === name) : undefined;
        if (!bed)
            return;
        e.preventDefault();
        closeBedPopover();
        openBedPopover(bed);
        popFromKey = bed.name;
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape")
            return;
        const was = !document.getElementById("bedpop")?.hidden;
        closeBedPopover();
        const back = was && popFromKey ? [...L.beds.querySelectorAll("[data-bed]")].find((b) => b.dataset.bed === popFromKey) : undefined;
        popFromKey = null;
        back?.focus({ preventScroll: true });
    });
    const startEditBed = (bed) => {
        const region = bed.region;
        const pts = regionPoints(region);
        const midx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const midy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        ($("bedstructure")).value = bed.structure ?? "in_ground";
        prevStructure = ($("bedstructure")).value;
        ($("bedlanes")).value = bed.lane_flip ? "flip" : "";
        refreshSizeUnitDisplay();
        if (region.shape === "rect") {
            setMode("rect");
            setDim("shapew", region.w);
            setDim("shapel", region.h);
            pending = { cx: midx, cy: midy };
        }
        else if (bed.rotation_deg && pts.length === 4) {
            setMode("rect");
            setDim("shapew", Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]));
            setDim("shapel", Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]));
            pending = { cx: midx, cy: midy };
            pendingAngle = bed.rotation_deg;
        }
        else {
            const ang = bed.rotation_deg ?? 0;
            const up = ang ? unrotatePts(pts, ang) : pts;
            const lrec = recogniseL(up);
            const urec = lrec ? null : recogniseU(up);
            const trec = lrec || urec ? null : recogniseTrough(up);
            const radii = pts.map((p) => Math.hypot(p[0] - midx, p[1] - midy));
            const mean = radii.reduce((a, r) => a + r, 0) / radii.length;
            if (lrec) {
                setMode("lbed");
                setDim("lw", lrec.w);
                setDim("ll", lrec.l);
                setDim("lnw", lrec.nw);
                setDim("lnl", lrec.nl);
                pendingAngle = ang;
                const L0 = rotPt(-lrec.w / 2, lrec.l / 2, ang);
                pending = { cx: pts[0][0] - L0[0], cy: pts[0][1] - L0[1] };
            }
            else if (urec) {
                setMode("ubed");
                setDim("uw", urec.w);
                setDim("ul", urec.l);
                setDim("unw", urec.nw);
                setDim("unl", urec.nl);
                pendingAngle = ang;
                const U0 = rotPt(-urec.w / 2, urec.l / 2, ang);
                pending = { cx: pts[0][0] - U0[0], cy: pts[0][1] - U0[1] };
            }
            else if (trec) {
                setMode("trough");
                setDim("tw", trec.w);
                setDim("tl", trec.l);
                pendingAngle = ang;
                const t0 = troughLocalPts(trec.w, trec.l)[0];
                const T0 = rotPt(t0[0], t0[1], ang);
                pending = { cx: pts[0][0] - T0[0], cy: pts[0][1] - T0[1] };
            }
            else if (pts.length === 32 && radii.every((r) => Math.abs(r - mean) < mean * 0.03)) {
                setMode("circle");
                setDim("shaped", 2 * mean);
                pending = { cx: midx, cy: midy };
            }
            else {
                setMode("corner");
                tracePts = pts.map((p) => [p[0], p[1]]);
            }
        }
        ($("areaname")).value = bed.name;
        editingFrom = bed.name;
        ($("bedsun")).value = bed.sun ?? "";
        ($("bedrain")).value = bed.rain ?? "";
        {
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            if (anchorLat != null) {
                const bw = Math.max(0.5, Math.max(...xs) - Math.min(...xs));
                const bh = Math.max(0.5, Math.max(...ys) - Math.min(...ys));
                zoom = fitZoom(anchorLat, bw, bh, 0.45);
            }
        }
        notice = fillCopy("gmNoticeEditing", { name: bed.name });
        const cand = document.getElementById("candbed");
        if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
            const wide = matchMedia("(min-width: 900px)").matches;
            const step = document.getElementById(wide ? "step-plan" : "sec-ground");
            if (step)
                step.open = true;
            if (cand.value !== bed.name) {
                cand.value = bed.name;
                cand.dispatchEvent(new Event("change"));
            }
        }
        void redraw();
    };
    const startDuplicateBed = (bed) => {
        startEditBed(bed);
        editingFrom = null;
        ($("areaname")).value = "";
        const pts = regionPoints(bed.region);
        const xs = pts.map((p) => p[0]);
        const dx = Math.max(...xs) - Math.min(...xs) + PATH_M;
        if (pending)
            pending = { cx: pending.cx + dx, cy: pending.cy };
        else if (tracePts.length)
            tracePts = tracePts.map(([x, y]) => [x + dx, y]);
        cx += dx / 2;
        notice = fillCopy("gmNoticeCopy", { name: bed.name, path: fmtLen(PATH_M) });
        void redraw();
    };
    const bedAt = (xm, ym, tolM = 0) => {
        for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) {
            if (pointInPolygon(xm, ym, regionPoints(app.logSnapshot.beds[i].region)))
                return app.logSnapshot.beds[i];
        }
        if (tolM > 0) {
            let best = null, bestD = tolM;
            for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) {
                const d = distToPolygon(xm, ym, regionPoints(app.logSnapshot.beds[i].region));
                if (d < bestD) {
                    bestD = d;
                    best = app.logSnapshot.beds[i];
                }
            }
            return best;
        }
        return null;
    };
    let drawing = false, drawQueued = false;
    let drawOwed = false;
    const redraw = async () => {
        if (drawing) {
            drawQueued = true;
            return;
        }
        drawing = true;
        try {
            await redrawCore();
        }
        finally {
            drawing = false;
            if (drawQueued) {
                drawQueued = false;
                void redraw();
            }
        }
    };
    const redrawCore = async () => {
        const pid = plotId();
        const reuse = lastPlot !== null && lastPlotId === pid
            && (gesture === "pan" || gesture === "pinch" || Date.now() - lastPlotAt < 120);
        const plot = reuse ? lastPlot : (await getPlot(db, pid)) ?? null;
        if (!reuse) {
            lastPlot = plot;
            lastPlotId = pid;
            lastPlotAt = Date.now();
        }
        let anchor = plot?.anchor ?? null;
        const ll = latlon();
        if (!anchor && ll) {
            anchor = { lat: ll.lat, lon: ll.lon };
            zoom = LOCATE_ZOOM;
            const typedAddr = document.getElementById("addr")?.value.trim() || undefined;
            void setPlotAnchorOnce(db, plotId(), ll.lat, ll.lon, typedAddr);
        }
        anchorLat = anchor?.lat ?? 45;
        anchorLL = anchor ?? null;
        anchorBeds = plot?.beds.length ?? 0;
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
            cx = 0;
            cy = 0;
        }
        const finishUi = () => {
            if (notice) {
                toast$1(notice);
                notice = null;
            }
            let hasShape = false, guidance = "", sizeText = "", reach = null;
            const quiet = !!document.getElementById("planshell")?.classList.contains("ba-quiet");
            let contSpan = null;
            if (mode === "rect") {
                hasShape = pending != null;
                const d = rectDims();
                reach = d ? app.bedReachNote?.(Math.min(d[0], d[1])) ?? null : null;
                contSpan = d ? Math.max(d[0], d[1]) : null;
                guidance = quiet ? "" : copy.gmGuideRect;
                if (d)
                    sizeText = `= ${fmtArea(d[0] * d[1])}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
            }
            else if (mode === "circle") {
                hasShape = pending != null;
                const r = circleR();
                reach = r ? app.bedReachNote?.(2 * r) ?? null : null;
                contSpan = r ? 2 * r : null;
                guidance = quiet ? "" : copy.gmGuideDrop;
                if (r)
                    sizeText = `= ${fmtArea(Math.PI * r * r)}`;
            }
            else if (mode === "lbed" || mode === "ubed" || mode === "trough") {
                hasShape = pending != null;
                guidance = quiet ? "" : copy.gmGuideDrop;
                const bb = pendingBBox();
                if (bb) {
                    contSpan = Math.max(bb[0], bb[1]);
                    if (mode === "lbed") {
                        const d = lDims();
                        if (d) {
                            reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: lLocalPts(d.w, d.l, d.nw, d.nl) })) ?? null;
                            sizeText = `= ${fmtArea(d.w * d.l - d.nw * d.nl)}`;
                        }
                    }
                    else if (mode === "ubed") {
                        const d = uDims();
                        if (d) {
                            reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: uLocalPts(d.w, d.l, d.nw, d.nl) })) ?? null;
                            sizeText = `= ${fmtArea(d.w * d.l - d.nw * d.nl)}`;
                        }
                    }
                    else {
                        const d = troughDims();
                        if (d) {
                            reach = app.bedReachNote?.(d.w) ?? null;
                            const r = d.w / 2;
                            sizeText = `= ${fmtArea(d.w * (d.l - d.w) + Math.PI * r * r)}`;
                        }
                    }
                }
            }
            else {
                hasShape = tracePts.length > 0;
                guidance = copy.gmGuideCorners;
                if (tracePts.length < 3)
                    sizeText = pluralCopy("gmCornersToClose", tracePts.length);
                else if (!isSimplePolygon(tracePts))
                    sizeText = copy.gmEdgesCross;
                else {
                    reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: tracePts })) ?? null;
                    const txs = tracePts.map((p) => p[0]), tys = tracePts.map((p) => p[1]);
                    contSpan = Math.max(Math.max(...txs) - Math.min(...txs), Math.max(...tys) - Math.min(...tys));
                    sizeText = fillCopy("gmCornersArea", { n: tracePts.length, area: fmtArea(polygonArea(tracePts)) });
                }
            }
            let guided = anchorBeds > 0;
            try {
                guided = guided || localStorage.getItem("gg-map-guided") === "1";
            }
            catch { }
            if (hasShape) {
                try {
                    localStorage.setItem("gg-map-guided", "1");
                }
                catch { }
            }
            note(hasShape || guided ? "" : guidance);
            reachNote(hasShape ? reach : null);
            const structVal = ($("bedstructure")).value;
            containerChip(hasShape && structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null);
            if (hasShape) {
                const contFlag = structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null;
                const cls = reach || contFlag ? "trace-warn" : "trace-ok";
                L.edit.querySelectorAll(".trace").forEach((n) => n.classList.add(cls));
            }
            applyStructureGate();
            $("sizereadout").textContent = sizeText;
            $("savecard").hidden = !hasShape;
            renderAreaList(plot ?? null);
            void renderPlotBar();
        };
        const viewport = $("mapviewport");
        const gridMode = !anchor;
        const frame = anchor ?? { lat: 45, lon: 0 };
        viewport.classList.remove("empty");
        viewport.classList.toggle("gridmode", gridMode);
        viewport.classList.toggle("deepzoom", zoom >= 22.4);
        {
            const btn = $("reanchor");
            if (ll && !gridMode) {
                const [dx, dy] = toLocal(frame, ll.lat, ll.lon);
                const [bx, by] = bedsCentre(plot?.beds ?? []) ?? [0, 0];
                btn.hidden = Math.hypot(dx, dy) < 1.5 || Math.hypot(dx - bx, dy - by) < 25;
                const far = !btn.hidden && Math.hypot(dx - bx, dy - by) >= NEW_GARDEN_KM * 1000;
                const history = (plot?.beds.length ?? 0) > 0 || (app.logSnapshot.seasons ?? []).length > 0;
                $("newgardenhere").hidden = !(far && history);
                $("farpick").hidden = !(far && history);
                if (far && history)
                    $("farpick-line").textContent = fillCopy("plFarPickLine", { dist: fmtKm(Math.hypot(dx - bx, dy - by) / 1000), garden: plot?.name || copy.hmYourGarden.toLowerCase() });
            }
            else {
                btn.hidden = true;
                $("newgardenhere").hidden = true;
                $("farpick").hidden = true;
            }
            const moveBtns = [btn, $("farpick-move")];
            if (btn.hidden) {
                moveArmed = false;
                if (moveArmTimer) {
                    clearTimeout(moveArmTimer);
                    moveArmTimer = 0;
                }
                for (const b of moveBtns)
                    b.textContent = MOVE_LABEL;
            }
            else if (!moveArmed)
                for (const b of moveBtns)
                    b.textContent = MOVE_LABEL;
        }
        {
            const bb = svg.getBoundingClientRect();
            if (!(bb.width > 0 && bb.height > 0)) {
                drawOwed = true;
                finishUi();
                return;
            }
            drawOwed = false;
        }
        const focusedBed = svg.contains(document.activeElement) ? document.activeElement?.getAttribute("data-bed") ?? null : null;
        for (const g of [L.wash, L.grid, L.beds, L.dots, L.edit, L.chrome])
            g.replaceChildren();
        if (gestTx !== 0 || gestTy !== 0 || gestScale !== 1)
            applyWorldTransform();
        else
            setWorldTransform(null);
        {
            const bb = svg.getBoundingClientRect();
            if (bb.width > 0 && bb.height > 0)
                viewH = Math.max(80, Math.round(VIEW * (bb.height / bb.width)));
            svg.setAttribute("viewBox", `0 0 ${VIEW} ${viewH}`);
        }
        const band = pillBand();
        if (fit && lastFitPlotId === plotId() && (band > 0 || fit.band > 0) && (fit.viewH !== viewH || fit.band !== band)
            && fit.cx === cx && fit.cy === cy && fit.zoom === zoom)
            lastFitPlotId = null;
        if (lastFitPlotId !== plotId() || (!lastFitHadBeds && (plot?.beds?.length ?? 0) > 0)) {
            const bedPts = (plot?.beds ?? []).flatMap((bed) => regionPoints(bed.region));
            if (bedPts.length) {
                const xs = bedPts.map((p) => p[0]), ys = bedPts.map((p) => p[1]);
                const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
                cx = (minX + maxX) / 2;
                cy = (minY + maxY) / 2;
                const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
                const obs = band > 0 ? fitObstacles() : [];
                const clear = (z, shift) => {
                    const m = metresPerPixel(frame.lat, z), hw = (maxX - minX) / 2 / m, hh = (maxY - minY) / 2 / m, my = viewH / 2 + shift;
                    return obs.every(([x0, y0, x1, y1]) => VIEW / 2 + hw <= x0 || VIEW / 2 - hw >= x1 || my + hh <= y0 || my - hh >= y1);
                };
                const cleared = (z, shift) => {
                    for (let i = 0; i < 40 && z > ZOOM_MIN && !clear(z, shift); i++)
                        z -= 0.05;
                    return Math.max(ZOOM_MIN, z);
                };
                let shift = 0;
                zoom = fitZoom(frame.lat, w, h, ARRIVE_FRAC);
                if (band > 0 && !clear(zoom, 0)) {
                    const whole = cleared(zoom, 0), under = cleared(fitZoom(frame.lat, w, h, ARRIVE_FRAC, band), band / 2);
                    if (under > whole || !clear(whole, 0)) {
                        zoom = under;
                        shift = band / 2;
                    }
                    else
                        zoom = whole;
                }
                cy += shift * metresPerPixel(frame.lat, zoom);
                fit = { cx, cy, zoom, viewH, band };
            }
            else {
                fit = null;
                cx = 0;
                cy = 0;
            }
            lastFitPlotId = plotId();
            lastFitHadBeds = bedPts.length > 0;
        }
        const mpp = metresPerPixel(frame.lat, zoom);
        const spanX = VIEW * mpp, spanY = viewH * mpp;
        const span = Math.max(spanX, spanY);
        const toPx = (xm, ym) => [VIEW / 2 + (xm - cx) / mpp, viewH / 2 - (ym - cy) / mpp];
        const pxPerUnit = Math.max(0.1, svg.getBoundingClientRect().width / VIEW);
        const pxPerMetre = pxPerUnit / mpp;
        const plantDetailVisible = pxPerMetre >= 14;
        const dimLabelFont = (shapeWMetres) => {
            const onScreenW = (shapeWMetres / mpp) * pxPerUnit;
            if (onScreenW < 44)
                return null;
            const fsPx = Math.max(9, Math.min(13, onScreenW * 0.16));
            return Math.round((fsPx / pxPerUnit) * 10) / 10;
        };
        if (celebration) {
            const cp = regionPoints(celebration.region);
            celebration.poly.setAttribute("points", cp.map(([x, y]) => toPx(x, y).join(",")).join(" "));
            const cc = cp.reduce((a, q) => [a[0] + q[0] / cp.length, a[1] + q[1] / cp.length], [0, 0]);
            const [cvx, cvy] = toPx(cc[0], cc[1]);
            for (const leaf of celebration.leaves) {
                leaf.setAttribute("cx", String(cvx));
                leaf.setAttribute("cy", String(cvy));
            }
        }
        const working = !!document.querySelector("#sec-ground[open], #step-plan[open], #step-mybed[open], #sec-addplant[open]");
        const illustrated = look === "illustrated";
        viewport.classList.toggle("illustrated", illustrated);
        viewport.classList.toggle("tracing", illustrated && working);
        if (gridMode) {
            L.tiles.replaceChildren();
            $("mapattrib").textContent = "";
        }
        else {
            const at = $("mapattrib");
            drawTiles({
                svg: L.tiles, anchor: frame, cx, cy, span, zoom, mpp, toPx,
                attrib: at, requestRedraw: () => void redraw(),
            });
        }
        if (illustrated) {
            L.wash.appendChild(el("rect", { class: "illwash", x: 0, y: 0, width: VIEW, height: viewH }));
            L.wash.appendChild(el("rect", { class: "illtufts", x: 0, y: 0, width: VIEW, height: viewH, fill: "url(#tuftpat)" }));
        }
        const step = span > 120 ? 10 : 5;
        const g0x = Math.floor((cx - spanX / 2) / step) * step;
        const g0y = Math.floor((cy - spanY / 2) / step) * step;
        for (let m = 0; m <= spanX + step; m += step) {
            const [vx] = toPx(g0x + m, 0);
            L.grid.appendChild(el("line", { class: "grid", x1: vx, y1: 0, x2: vx, y2: viewH }));
        }
        for (let m = 0; m <= spanY + step; m += step) {
            const [, vy] = toPx(0, g0y + m);
            L.grid.appendChild(el("line", { class: "grid", x1: 0, y1: vy, x2: VIEW, y2: vy }));
        }
        const shaping = pending != null || tracePts.length > 0 || gesture === "draw";
        if (shaping) {
            const fine = [0.1, 1].find((s) => s < step && s / mpp >= 7);
            if (fine) {
                const f0x = Math.floor((cx - spanX / 2) / fine) * fine;
                const f0y = Math.floor((cy - spanY / 2) / fine) * fine;
                for (let m = 0; m <= spanX + fine; m += fine) {
                    const [vx] = toPx(f0x + m, 0);
                    L.grid.appendChild(el("line", { class: "grid fine", x1: vx, y1: 0, x2: vx, y2: viewH }));
                }
                for (let m = 0; m <= spanY + fine; m += fine) {
                    const [, vy] = toPx(0, f0y + m);
                    L.grid.appendChild(el("line", { class: "grid fine", x1: 0, y1: vy, x2: VIEW, y2: vy }));
                }
            }
        }
        if (locating() && ll && !gridMode && anchorBeds === 0) {
            const [px, py] = toPx(...toLocal(frame, ll.lat, ll.lon));
            const pin = el("g", { class: "locpin" });
            pin.appendChild(el("path", { class: "locpin-body",
                d: `M ${px} ${py} c -7 -14 -12 -18 -12 -26 a 12 12 0 1 1 24 0 c 0 8 -5 12 -12 26 z` }));
            pin.appendChild(el("circle", { class: "locpin-eye", cx: px, cy: py - 26, r: 4.5 }));
            L.chrome.appendChild(pin);
        }
        const openSeason$1 = openSeason();
        if (layerState.areas) {
            const planFor = new Map();
            for (const e of (Array.isArray(openSeason$1?.plan) ? openSeason$1.plan : [])) {
                if (typeof e.area === "string" && typeof e.guild === "string")
                    planFor.set(e.area, e.guild);
            }
            const labelEls = [];
            const allBeds = plot?.beds ?? [];
            const soilRecorded = (bed) => (app.soilObservations ?? []).some((rec) => {
                if (rec.plot !== app.currentPlotId)
                    return false;
                if (!rec.region)
                    return true;
                try {
                    return intersectArea(parseRegion(rec.region), bed.region) > 0;
                }
                catch {
                    return false;
                }
            });
            const tintClass = (bed) => {
                switch (layerState.tint) {
                    case "sun": return bed.sun === "full" ? "t-sun-full" : bed.sun === "part_shade" ? "t-sun-part" : "t-unknown";
                    case "soil": return soilRecorded(bed) ? "t-soil-yes" : "t-unknown";
                    case "rotation": {
                        const y = app.bedRotationSeasons?.(bed.region) ?? null;
                        return y == null ? "t-unknown" : y <= 1 ? "t-rot-recent" : "t-rot-rested";
                    }
                    default: {
                        const planted = !!bed.planted || (openSeason$1?.plantings ?? []).some((q) => {
                            try {
                                return plantingOnBed(q.region, bed.region);
                            }
                            catch {
                                return false;
                            }
                        });
                        return planted ? "t-season-planted" : "t-season-open";
                    }
                }
            };
            const editingName = (($("areaname")).value ?? "").trim();
            const shapeInProgress = pending != null || tracePts.length > 0;
            const bedsOpen = !locating() && !shapeInProgress;
            for (const bed of plot?.beds ?? []) {
                if (shapeInProgress && editingName && bed.name === editingName)
                    continue;
                const cs = regionPoints(bed.region);
                const ptsAttr = cs.map(([x, y]) => toPx(x, y).join(",")).join(" ");
                const shape = L.beds.appendChild(el("polygon", { class: `savedbed ${tintClass(bed)}`, points: ptsAttr }));
                if (bedsOpen) {
                    for (const [k, v] of [["tabindex", "0"], ["role", "button"], ["aria-label", bed.name], ["data-bed", bed.name]])
                        shape.setAttribute(k, v);
                    if (focusedBed === bed.name)
                        shape.focus({ preventScroll: true });
                }
                if (illustrated)
                    L.beds.appendChild(el("polygon", { points: ptsAttr, fill: "url(#grainpat)" }));
                const plannedTeam = planFor.get(bed.name);
                const moundTeam = plannedTeam ? (app.guildIsHills?.(plannedTeam) ?? false) : false;
                if (!moundTeam) {
                    for (const poly of accessBandPolygons({ region: bed.region, rotation_deg: bed.rotation_deg, structure: bed.structure ?? "in_ground", lane_flip: bed.lane_flip })) {
                        const bp = poly.map(([x, y]) => toPx(x, y).join(",")).join(" ");
                        L.beds.appendChild(el("polygon", { class: "bedlane", points: bp }));
                    }
                }
                if (!layerState.labels)
                    continue;
                const midx = cs.reduce((a, p) => a + p[0], 0) / cs.length;
                const [tx] = toPx(midx, 0);
                const planned = planFor.get(bed.name);
                const isSection = sectionParentOf(bed, allBeds) !== null;
                const isContainer = !isSection && bedHasSections(bed.name, allBeds);
                const base = isContainer ? fillCopy("gmBedSections", { name: bed.name }) : bed.name;
                let label;
                const bedWUnits = Math.max(...cs.map(([x, y]) => toPx(x, y)[0])) - Math.min(...cs.map(([x, y]) => toPx(x, y)[0]));
                const fsPx = Math.max(9, Math.min(13, bedWUnits * pxPerUnit * 0.2));
                const fsUnits = Math.round((fsPx / pxPerUnit) * 10) / 10;
                if (isSection) {
                    const midy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
                    const [, cy] = toPx(midx, midy);
                    label = el("text", { class: "bedlabel", x: tx, y: cy, "dominant-baseline": "central" });
                }
                else {
                    const pys = cs.map(([x, y]) => toPx(x, y)[1]);
                    label = el("text", { class: "bedlabel", x: tx, y: Math.min(...pys) - 6 });
                }
                label.setAttribute("font-size", String(fsUnits));
                const full = planned && !isContainer ? fillCopy("gmBedLabelPlanned", { name: base, team: app.teamLabel?.(planned) ?? humanize(planned) }) : base;
                label.textContent = full.length * fsUnits * 0.55 > bedWUnits * 1.25 ? base : full;
                L.beds.appendChild(label);
                labelEls.push(label);
            }
            declutterBedLabels(labelEls);
        }
        const colorOf = gardenColours();
        const legend = new Map();
        const dotKeys = new Set();
        let popIx = 0;
        if (layerState.plantings) {
            for (const d of app.planDots) {
                const c = colorOf(d.species);
                const name = app.speciesName?.(d.species) ?? humanize(d.species);
                if (!legend.has(d.species))
                    legend.set(d.species, { name, color: c, filled: false });
                const k = `p:${d.species}:${d.x}:${d.y}`;
                dotKeys.add(k);
                const [px, py] = toPx(d.x, d.y);
                if (px < -10 || px > VIEW + 10 || py < -10 || py > viewH + 10)
                    continue;
                if (!plantDetailVisible)
                    continue;
                const dot = el("circle", { class: prevDotKeys && !prevDotKeys.has(k) ? "plandot pop" : "plandot", cx: px, cy: py, r: 4, "data-species": d.species });
                dot.style.stroke = c;
                if (prevDotKeys && !prevDotKeys.has(k))
                    dot.style.animationDelay = `${Math.min(popIx++, 20) * 45}ms`;
                const tip = document.createElementNS(SVG_NS, "title");
                tip.textContent = fillCopy("gmDotPlanned", { name });
                dot.appendChild(tip);
                L.dots.appendChild(dot);
            }
        }
        if (layerState.plantings && openSeason$1?.plantings) {
            for (const pl of openSeason$1.plantings) {
                const c = colorOf(pl.species);
                const name = app.speciesName?.(pl.species) ?? humanize(pl.species);
                const entry = legend.get(pl.species);
                if (entry)
                    entry.filled = true;
                else
                    legend.set(pl.species, { name, color: c, filled: true });
                const cs = regionPoints(pl.region);
                const midx = cs.reduce((a, p) => a + p[0], 0) / cs.length;
                const midy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
                const k = `o:${pl.species}:${midx}:${midy}`;
                dotKeys.add(k);
                const [px, py] = toPx(midx, midy);
                if (px < -10 || px > VIEW + 10 || py < -10 || py > viewH + 10)
                    continue;
                if (!plantDetailVisible)
                    continue;
                const dot = el("circle", { class: prevDotKeys && !prevDotKeys.has(k) ? "plantdot pop" : "plantdot", cx: px, cy: py, r: 5, "data-species": pl.species });
                dot.style.fill = c;
                if (prevDotKeys && !prevDotKeys.has(k))
                    dot.style.animationDelay = `${Math.min(popIx++, 20) * 45}ms`;
                const tip = document.createElementNS(SVG_NS, "title");
                tip.textContent = `${name}${pl.cultivar_group ? fillCopy("gmDotGroup", { group: pl.cultivar_group }) : ""}${pl.sown ? fillCopy("gmDotSown", { date: tipDay(pl.sown) }) : ""}${pl.end_cause ? fillCopy("gmDotEnded", { cause: endCausePhrase(pl.end_cause) }) : ""}`;
                dot.appendChild(tip);
                L.dots.appendChild(dot);
            }
        }
        prevDotKeys = dotKeys;
        const lg = document.getElementById("maplegend");
        const kt = document.getElementById("keytoggle");
        if (lg && kt) {
            lg.replaceChildren();
            for (const e of legend.values()) {
                const row = document.createElement("span");
                const sw = document.createElement("i");
                sw.style.borderColor = e.color;
                sw.style.background = e.filled ? e.color : "transparent";
                sw.title = e.filled ? copy.gmPlanted : copy.gmPlanned;
                row.append(sw, e.name);
                lg.appendChild(row);
            }
            const hasKey = layerState.plantings && legend.size > 0;
            kt.hidden = !hasKey;
            const hasPlanContent = (openSeason$1?.plantings?.length ?? 0) > 0 || app.planDots.length > 0;
            viewport.classList.toggle("hasplan", hasPlanContent);
            kt.textContent = fillCopy("gmKeyCount", { n: legend.size });
            lg.hidden = !(hasKey && keyOpen);
        }
        if (mode === "corner" && tracePts.length) {
            const pts = tracePts.map(([x, y]) => toPx(x, y).join(",")).join(" ");
            L.edit.appendChild(el(tracePts.length >= 3 ? "polygon" : "polyline", { class: "trace", points: pts }));
            for (const [x, y] of tracePts) {
                const [px, py] = toPx(x, y);
                L.edit.appendChild(el("circle", { class: "v", cx: px, cy: py, r: 7 }));
            }
            const edges = tracePts.length >= 3 ? tracePts.length : tracePts.length - 1;
            for (let i = 0; i < edges; i++) {
                const a = tracePts[i], b = tracePts[(i + 1) % tracePts.length];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                if (len < 0.05)
                    continue;
                const efu = dimLabelFont(len);
                if (efu == null)
                    continue;
                const [mx, my] = toPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                const t = el("text", { class: "dimlabel", x: mx, y: my - 4, "font-size": efu });
                t.textContent = fmtLen(len);
                L.edit.appendChild(t);
            }
        }
        if (proposalRect && !pending && tracePts.length === 0) {
            const { cx: pcx, cy: pcy, w: pw, l: pl } = proposalRect;
            const pts = rectCorners(pcx, pcy, pw, pl, 0).map(([x, y]) => toPx(x, y).join(",")).join(" ");
            L.edit.appendChild(el("polygon", { class: "proposal-bed", points: pts }));
            const pfu = dimLabelFont(Math.max(pw, pl));
            if (pfu != null) {
                const [tx, ty] = toPx(pcx, pcy);
                const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": pfu });
                t.textContent = `${fmtLen(pw)} \u00d7 ${fmtLen(pl)}`;
                L.edit.appendChild(t);
            }
        }
        if (mode === "rect" && pending) {
            const d = rectDims();
            if (d) {
                const [w, l] = d;
                const pts = pendingCorners(w, l).map(([x, y]) => toPx(x, y).join(",")).join(" ");
                L.edit.appendChild(el("polygon", { class: "trace", points: pts }));
                const rfu = dimLabelFont(Math.max(w, l));
                if (rfu != null) {
                    const [tx, ty] = toPx(pending.cx, pending.cy);
                    const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": rfu });
                    t.textContent = `${fmtLen(w)} × ${fmtLen(l)}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                    L.edit.appendChild(t);
                }
                const topMid = rotPt(0, l / 2, pendingAngle);
                const [sx, sy] = toPx(pending.cx + topMid[0], pending.cy + topMid[1]);
                const [hx, hy] = toPx(...rotHandlePos(l, mpp));
                L.edit.appendChild(el("line", { class: "rotstem", x1: sx, y1: sy, x2: hx, y2: hy }));
                L.edit.appendChild(el("circle", { class: "rot", cx: hx, cy: hy, r: 12 }));
                const glyph = el("text", { class: "rotglyph", x: hx, y: hy + 4 });
                glyph.textContent = "↻";
                L.edit.appendChild(glyph);
                for (const [x, y] of pendingCorners(w, l)) {
                    const [vx2, vy2] = toPx(x, y);
                    L.edit.appendChild(el("circle", { class: "v", cx: vx2, cy: vy2, r: 7 }));
                }
            }
        }
        if (mode === "circle" && pending) {
            const r = circleR();
            if (r) {
                const [px, py] = toPx(pending.cx, pending.cy);
                L.edit.appendChild(el("circle", { class: "trace", cx: px, cy: py, r: r / mpp }));
                const cfu = dimLabelFont(2 * r);
                if (cfu != null) {
                    const t = el("text", { class: "dimlabel", x: px, y: py, "font-size": cfu });
                    t.textContent = fillCopy("gmDiameter", { d: fmtLen(2 * r) });
                    L.edit.appendChild(t);
                }
                const [ex, ey] = toPx(pending.cx + r, pending.cy);
                L.edit.appendChild(el("circle", { class: "v", cx: ex, cy: ey, r: 7 }));
            }
        }
        if ((mode === "lbed" || mode === "ubed" || mode === "trough") && pending) {
            const pts = presetWorldPts(), bb = pendingBBox();
            if (pts && bb) {
                L.edit.appendChild(el("polygon", { class: "trace", points: pts.map(([x, y]) => toPx(x, y).join(",")).join(" ") }));
                const bfu = dimLabelFont(Math.max(bb[0], bb[1]));
                if (bfu != null) {
                    const [tx, ty] = toPx(pending.cx, pending.cy);
                    const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": bfu });
                    t.textContent = `${fmtLen(bb[0])} × ${fmtLen(bb[1])}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                    L.edit.appendChild(t);
                }
                const topMid = rotPt(0, bb[1] / 2, pendingAngle);
                const [sx, sy] = toPx(pending.cx + topMid[0], pending.cy + topMid[1]);
                const [hx, hy] = toPx(...rotHandlePos(bb[1], mpp));
                L.edit.appendChild(el("line", { class: "rotstem", x1: sx, y1: sy, x2: hx, y2: hy }));
                L.edit.appendChild(el("circle", { class: "rot", cx: hx, cy: hy, r: 12 }));
                const glyph = el("text", { class: "rotglyph", x: hx, y: hy + 4 });
                glyph.textContent = "↻";
                L.edit.appendChild(glyph);
                const cs = pendingCorners(bb[0], bb[1]);
                for (let i = 0; i < 4; i++) {
                    if (mode === "lbed" && i === 1)
                        continue;
                    const [vx2, vy2] = toPx(cs[i][0], cs[i][1]);
                    L.edit.appendChild(el("circle", { class: "v", cx: vx2, cy: vy2, r: 7 }));
                }
                const n = notchWorldPos();
                if (n) {
                    const [nx, ny] = toPx(n[0], n[1]);
                    L.edit.appendChild(el("circle", { class: "v", cx: nx, cy: ny, r: 7 }));
                }
            }
        }
        if (magnetGuides.length && pending) {
            for (const g of magnetGuides) {
                if (g.axis === "x") {
                    const [gx] = toPx(g.at, 0);
                    L.edit.appendChild(el("line", { class: "snapguide", x1: gx, y1: 0, x2: gx, y2: viewH }));
                }
                else {
                    const [, gy] = toPx(0, g.at);
                    L.edit.appendChild(el("line", { class: "snapguide", x1: 0, y1: gy, x2: VIEW, y2: gy }));
                }
            }
        }
        const compass = el("text", { class: "compass", x: VIEW - 8, y: 18, "text-anchor": "end", "font-size": (14 / pxPerUnit).toFixed(2) });
        compass.textContent = copy.gmCompass;
        L.chrome.appendChild(compass);
        const imperial = unitSystem() === "imperial";
        const cands = imperial ? [1, 2, 5, 10, 20, 50, 100, 200, 500].map((ft) => ft * 0.3048) : [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
        const fits = cands.filter((m) => m / mpp <= VIEW * 0.28);
        const barM = fits.length ? fits[fits.length - 1] : cands[0];
        L.chrome.appendChild(el("line", { class: "scale", x1: 10, y1: viewH - 30, x2: 10 + barM / mpp, y2: viewH - 30, "data-m": barM }));
        const scale = el("text", { class: "scalelabel", x: 12, y: viewH - 36, "font-size": (11 / pxPerUnit).toFixed(2) });
        scale.textContent = imperial ? `${Math.round(barM / 0.3048)} ${copy.unitFt}` : `${barM} m`;
        L.chrome.appendChild(scale);
        finishUi();
    };
    const renderPlotBar = async () => {
        const sel = $("plotsel");
        const plots = openGardens(await listPlots(db));
        const current = plotId();
        const homeName = (id) => (id === "plot_home" || id === "draft_home" ? copy.gmHomeGarden : id);
        if (!plots.some((p) => p.id === current)) {
            plots.unshift({ id: current, name: homeName(current), beds: [] });
        }
        sel.innerHTML = "";
        const def = defaultPlotId();
        for (const p of orderGardens(plots, (x) => x, def)) {
            const o = document.createElement("option");
            o.value = p.id;
            o.textContent = (p.name ?? homeName(p.id)) + (p.id === def ? copy.gmDefaultSuffix : "") + (p.shared ? ` (${copy.teamsSharedTag})` : "");
            sel.appendChild(o);
        }
        sel.value = current;
        const defBtn = document.getElementById("plotdefault");
        if (defBtn) {
            defBtn.hidden = plots.length <= 1 || current === "plot_example";
            paintDefaultToggle(defBtn, def === current);
        }
        const chip = document.getElementById("gardenchip");
        if (chip) {
            chip.hidden = plots.length <= 1;
            if (plots.length > 1) {
                const cur = plots.find((p) => p.id === current);
                chip.textContent = "";
                const a = document.createElement("a");
                a.href = "#/log";
                a.textContent = copy.gmSwitchOnLog;
                a.addEventListener("click", (e) => {
                    const menuBtn = document.querySelector("#activegarden:not([hidden]) .ag-switch");
                    if (!menuBtn)
                        return;
                    e.preventDefault();
                    menuBtn.scrollIntoView({ block: "nearest" });
                    menuBtn.click();
                });
                fillNodes(chip, copy.gmGardenChip, { name: gardenShownName(cur?.name ?? homeName(current), cur?.shared), link: a });
            }
        }
    };
    const moreOpen = new Set();
    const AREA_LIST_FIRST = 6;
    let areaListGen = 0;
    const renderAreaList = (plot) => {
        const gen = ++areaListGen;
        const box = $("arealist");
        box.innerHTML = "";
        box.setAttribute("role", "list");
        const seasonsList = app.logSnapshot.seasons;
        const listSeason = seasonsList.find((s) => s.id === seasonId())
            ?? (seasonsList.length ? seasonsList.reduce((a, b) => (a.id >= b.id ? a : b)) : null);
        const gf = (plot?.beds ?? []).length ? app.gardenFacts?.() ?? null : null;
        if (gf) {
            const gh = document.createElement("p");
            gh.className = "gardenhead";
            gh.setAttribute("role", "presentation");
            const n = document.createElement("span");
            n.className = "gardenhead-n";
            n.textContent = gf.head;
            gh.appendChild(n);
            const plannable = (plot?.beds ?? []).filter((b) => !bedHasSections(b.name, plot?.beds ?? []));
            if (gf.tier) {
                const t = document.createElement("span");
                t.className = "gardenhead-tier";
                t.textContent = ` ${tierLine(plannable)}`;
                gh.appendChild(t);
            }
            box.appendChild(gh);
        }
        const drawCard = (bed) => {
            const row = document.createElement("div");
            row.className = "arearow bedcard";
            row.setAttribute("role", "listitem");
            row.dataset.bed = bed.name;
            const moreActs = [];
            const npts = bed.region.shape === "polygon" ? bed.region.points.length : 4;
            const kind = bed.region.shape !== "polygon" ? copy.gmRectangle
                : npts === 4 ? copy.gmRectangle
                    : npts === 6 ? copy.plLBed
                        : npts === 8 ? copy.plUBed
                            : npts === (TROUGH_SEG + 1) * 2 ? copy.plTrough
                                : npts === 32 ? copy.gmCircle : fillCopy("gmNCorners", { n: npts });
            const shape = bed.rotation_deg ? `${kind} · ${bed.rotation_deg}°` : kind;
            const allBedsTop = plot?.beds ?? [];
            const isSectionParent = bedHasSections(bed.name, allBedsTop);
            const head = document.createElement("div");
            head.className = "bedcard-head";
            const nm = document.createElement("h3");
            nm.className = "bedcard-name";
            nm.textContent = bed.name;
            head.appendChild(nm);
            if (!isSectionParent) {
                const st = bedState(bed, listSeason, (id) => app.teamLabel?.(id) ?? null);
                row.dataset.state = st.key;
                const chip = document.createElement("span");
                chip.className = `bedchip bedchip-${st.key}`;
                chip.textContent = st.chip;
                head.appendChild(chip);
                row.appendChild(head);
                const meta = document.createElement("div");
                meta.className = "bedcard-meta";
                const metaBits = [
                    `${shape}, ${fmtArea(area(bed.region))}`,
                    bed.structure
                        ? (bed.depth_cm ? fillCopy("gmStructDeep", { structure: structureWord(bed.structure), depth: bedDepthWord(bed.depth_cm) }) : structureWord(bed.structure))
                        : null,
                    bed.sun === "full" ? copy.plFullSunLc : bed.sun === "part_shade" ? copy.plPartShadeLc : null,
                ].filter(Boolean);
                meta.textContent = metaBits.join(" · ");
                if (!bed.sun) {
                    meta.appendChild(document.createTextNode(" · "));
                    const setSun = document.createElement("button");
                    setSun.type = "button";
                    setSun.className = "btn btn-quiet linky bedcard-secondary bedcard-setsun";
                    setSun.textContent = copy.gmSetSun;
                    setSun.title = copy.gmSetSunTitle;
                    setSun.addEventListener("click", () => {
                        startEditBed(bed);
                        const sun = () => $("bedsun");
                        const first = sun();
                        seat(first ? scrollerFor(first) : window, sun, { block: "center", motion: "smooth", hold: 1200, reason: "bed-sun" });
                        requestAnimationFrame(() => sun()?.focus({ preventScroll: true }));
                    });
                    meta.appendChild(setSun);
                }
                row.appendChild(meta);
                const stateLine = document.createElement("div");
                stateLine.className = "bedcard-state";
                stateLine.textContent = st.line;
                row.appendChild(stateLine);
                const facts = app.bedFacts?.(bed.name) ?? null;
                const unfit = st.key === "planned" ? facts?.unfit ?? null : null;
                if (st.key === "planned" && app.planReceipt && !unfit) {
                    const receipt = document.createElement("div");
                    receipt.className = "bedcard-receipt";
                    receipt.hidden = true;
                    row.appendChild(receipt);
                    void app.planReceipt(bed.name).then((r) => {
                        if (!r || !receipt.isConnected)
                            return;
                        const fmtDate = fmtMonthDay;
                        const line = document.createElement("div");
                        line.className = "bedcard-numbers";
                        if (!r.sized) {
                            line.textContent = copy.gmNotSized;
                            receipt.appendChild(line);
                            receipt.hidden = false;
                            return;
                        }
                        const bits = [fillCopy("gmPlantsToPlace", { n: r.plants })];
                        if (r.areaNeededM2 != null)
                            bits.push(fillCopy("gmNeedsArea", { need: fmtArea(r.areaNeededM2), have: fmtArea(r.bedAreaM2) }));
                        if (r.first)
                            bits.push(fillCopy("gmFirstJob", { date: fmtDate(r.first.date), what: r.first.what }));
                        else if (r.keptForSpring)
                            bits.push(r.heldBy ? `${copy.gmKeptForSpring}. ${r.heldBy}` : copy.gmKeptForSpring);
                        else if (r.late)
                            bits.push(r.until
                                ? fillCopy("clStillTimeTag", { date: Number(r.until.slice(0, 4)) !== new Date().getFullYear() ? fmtMonthDayYear(r.until) : fmtDate(r.until) })
                                : copy.clStillTimeOpenTag);
                        line.textContent = bits.join(" · ");
                        receipt.appendChild(line);
                        const buy = document.createElement("details");
                        buy.className = "bedcard-buy";
                        const sum = document.createElement("summary");
                        sum.textContent = r.toBuy === 0
                            ? copy.gmSeedBoxCovers
                            : pluralCopy("gmWhatToBuy", r.toBuy);
                        buy.appendChild(sum);
                        const ul = document.createElement("ul");
                        for (const k of r.kinds) {
                            const li = document.createElement("li");
                            li.textContent = fillCopy(k.owned ? "gmBuyRowOwned" : "gmBuyRow", { label: k.label, n: k.n });
                            if (k.owned)
                                li.className = "owned";
                            ul.appendChild(li);
                        }
                        buy.appendChild(ul);
                        receipt.appendChild(buy);
                        receipt.hidden = false;
                    });
                }
                if (facts?.plants.length) {
                    const pl = document.createElement("div");
                    pl.className = "bedcard-plants";
                    pl.setAttribute("aria-label", copy.gmGrowingHereNow);
                    for (const label of facts.plants) {
                        const c = document.createElement("span");
                        c.className = "plantchip";
                        c.textContent = label;
                        pl.appendChild(c);
                    }
                    row.appendChild(pl);
                }
                if (facts?.history) {
                    const h = document.createElement("div");
                    h.className = "bedcard-history";
                    fillNodes(h, facts.history, { rotation: glossTerm("rotation", copy.clRotationWord) });
                    row.appendChild(h);
                }
                const plantWindow = st.key === "planned" ? (app.bedPlantWindow?.(bed.name) ?? null) : null;
                const keptForSpring = plantWindow?.status === "passed";
                if (facts?.next) {
                    const nx = document.createElement("div");
                    nx.className = "bedcard-next" + (facts.next.late ? " late" : "");
                    const [yy, mm, dd] = facts.next.date.split("-").map(Number);
                    const when = yy !== new Date().getFullYear()
                        ? fmtMonthDayYear(facts.next.date)
                        : fillCopy("clMonthDay", { month: [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
                                copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec][mm - 1].slice(0, 3), day: dd });
                    const txt = document.createElement("span");
                    const until = facts.next.until;
                    txt.textContent = until === ""
                        ? fillCopy("gmNextJobStillOpen", { job: facts.next.text })
                        : until
                            ? fillCopy("gmNextJobStill", { until: Number(until.slice(0, 4)) !== new Date().getFullYear() ? fmtMonthDayYear(until) : fmtMonthDay(until), job: facts.next.text })
                            : fillCopy(facts.next.late ? (facts.next.harvest ? "gmNextJobReady" : "gmNextJobLate") : "gmNextJobNext", { when, job: facts.next.text });
                    nx.appendChild(txt);
                    if (!keptForSpring) {
                        const wk = document.createElement("button");
                        wk.type = "button";
                        wk.className = "btn btn-quiet linky bedcard-secondary bedcard-week";
                        wk.textContent = copy.gmThisWeek;
                        wk.addEventListener("click", () => void app.openWeek?.());
                        nx.appendChild(wk);
                    }
                    row.appendChild(nx);
                }
                const noDates = facts?.undated ? undatedLines(facts.undated) : [];
                if (noDates.length || facts?.closed) {
                    const nd = document.createElement("div");
                    nd.className = "bedcard-next bedcard-undated";
                    nd.textContent = noDates.length ? noDates.join(" ") : copy.gmWindowsClosedBed;
                    row.appendChild(nd);
                }
                if (facts?.cool?.length) {
                    const cl = document.createElement("div");
                    cl.className = "bedcard-next bedcard-cool";
                    cl.textContent = facts.cool.join(" ");
                    row.appendChild(cl);
                }
                if (unfit) {
                    const uf = document.createElement("div");
                    uf.className = "bedcard-next bedcard-undated bedcard-unfit";
                    uf.textContent = unfitLine(unfit);
                    row.appendChild(uf);
                }
                if (facts?.autumn) {
                    const au = document.createElement("div");
                    au.className = "bedcard-next bedcard-autumn";
                    au.textContent = facts.autumn;
                    row.appendChild(au);
                }
                if (facts?.nextYear) {
                    const ny = document.createElement("div");
                    ny.className = "bedcard-nextyear";
                    ny.textContent = fillCopy("gmNextSeasonAccepted", { year: facts.nextYear.year, team: facts.nextYear.team });
                    row.appendChild(ny);
                }
                const goToTeams = () => {
                    const cand = document.getElementById("candbed");
                    if (!cand || ![...cand.options].some((o) => o.value === bed.name)) {
                        toast(copy.gmStillLoading);
                        return;
                    }
                    if (cand.value !== bed.name) {
                        cand.value = bed.name;
                        cand.dispatchEvent(new Event("change"));
                    }
                    const sp = document.getElementById("step-plan");
                    if (sp)
                        sp.open = true;
                };
                const cta = document.createElement("div");
                cta.className = "bedcard-cta-row";
                const primary = document.createElement("button");
                primary.type = "button";
                primary.className = "btn btn-primary bedcard-cta";
                const mkChangeAction = () => {
                    const change = document.createElement("button");
                    change.type = "button";
                    change.className = "btn btn-quiet linky bedcard-secondary bedcard-change";
                    if (st.mybed) {
                        change.textContent = copy.gmEditDesign;
                        change.addEventListener("click", () => {
                            const cand = document.getElementById("candbed");
                            if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
                                const step = document.getElementById("step-mybed");
                                if (step)
                                    step.open = true;
                                if (cand.value !== bed.name) {
                                    cand.value = bed.name;
                                    cand.dispatchEvent(new Event("change"));
                                }
                            }
                        });
                    }
                    else {
                        change.textContent = copy.gmChangeTeam;
                        change.addEventListener("click", () => { app.planShowList?.(); goToTeams(); });
                    }
                    return change;
                };
                if (st.key === "empty") {
                    primary.textContent = copy.gmChooseTeam;
                    primary.addEventListener("click", goToTeams);
                    cta.appendChild(primary);
                }
                else if (unfit) {
                    primary.textContent = copy.gmChangeTeam;
                    primary.addEventListener("click", () => { app.planShowList?.(); goToTeams(); });
                    cta.appendChild(primary);
                }
                else if (st.key === "planned" && plantWindow?.status === "passed") {
                    primary.textContent = copy.gmFirstJobCalendar;
                    primary.addEventListener("click", () => void app.openWeek?.(undefined, bed.name));
                    cta.appendChild(primary);
                    moreActs.push(mkChangeAction());
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = copy.gmPrintSheet;
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                }
                else if (st.key === "planned") {
                    primary.textContent = copy.gmMarkPlanted;
                    const callout = document.createElement("p");
                    callout.className = "bedcard-callout";
                    callout.hidden = true;
                    const asked = plantAsked.get(bed.name);
                    if (asked) {
                        callout.textContent = fillCopy("gmNudgeTapAgain", { nudge: asked });
                        callout.hidden = false;
                    }
                    const plant = async (opts) => {
                        const hook = app.markBedPlantedFromPlan;
                        if (!hook) {
                            toast(copy.gmStillLoading);
                            return;
                        }
                        primary.disabled = true;
                        const r = await hook(bed.name, opts);
                        if (r.ok) {
                            plantAsked.delete(bed.name);
                            toast(plantedLine(seasonId() ?? new Date().getFullYear(), null, bed.name));
                            return;
                        }
                        primary.disabled = false;
                        if (r.canAdvanceTo != null) {
                            const yr = r.canAdvanceTo;
                            callout.replaceChildren(document.createTextNode(`${r.reason ?? ""} `));
                            const adv = document.createElement("button");
                            adv.type = "button";
                            adv.className = "btn btn-quiet linky bedcard-secondary";
                            adv.textContent = fillCopy("gmStartSeasonPlant", { year: yr });
                            adv.addEventListener("click", () => void plant({ advance: true }));
                            callout.appendChild(adv);
                            callout.hidden = false;
                            return;
                        }
                        if (r.nudge) {
                            plantAsked.set(bed.name, r.nudge);
                            callout.textContent = fillCopy("gmNudgeTapAgain", { nudge: r.nudge });
                            callout.hidden = false;
                            return;
                        }
                        toast(r.reason ?? copy.gmCouldNotPlant);
                    };
                    primary.addEventListener("click", () => void plant(plantAsked.has(bed.name) ? { force: true } : undefined));
                    cta.appendChild(primary);
                    moreActs.push(mkChangeAction());
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = copy.gmPrintSheet;
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                    row.appendChild(cta);
                    row.appendChild(callout);
                }
                else if (st.key === "planted") {
                    primary.textContent = copy.gmOpenInLog;
                    primary.addEventListener("click", () => { if (app.openLogBed)
                        app.openLogBed(bed.name);
                    else
                        location.hash = "#/log"; });
                    cta.appendChild(primary);
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = copy.gmPrintSheet;
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                    const back = document.createElement("button");
                    back.type = "button";
                    back.className = "btn btn-quiet linky bedcard-secondary";
                    back.textContent = copy.gmBackToDraft;
                    let backArmed = false;
                    let backTimer = 0;
                    const backDisarm = () => { backArmed = false; if (backTimer) {
                        clearTimeout(backTimer);
                        backTimer = 0;
                    } back.textContent = copy.gmBackToDraft; back.classList.remove("arm"); };
                    back.addEventListener("click", () => {
                        if (!backArmed) {
                            const n = (openSeason()?.plantings ?? [])
                                .filter((p) => { try {
                                return plantingOnBed(p.region, bed.region);
                            }
                            catch {
                                return false;
                            } }).length;
                            backArmed = true;
                            back.classList.add("arm");
                            back.textContent = n > 0
                                ? pluralCopy("gmBackPulls", n)
                                : copy.gmBackUndo;
                            if (backTimer)
                                clearTimeout(backTimer);
                            backTimer = window.setTimeout(backDisarm, 4000);
                            return;
                        }
                        backDisarm();
                        back.disabled = true;
                        void app.revertBedToDraftFromPlan?.(bed.name).then((r) => {
                            if (r?.ok)
                                toast(r.removed ? pluralCopy("gmBackDonePulled", r.removed) : copy.gmBackDone);
                            else {
                                back.disabled = false;
                                toast(r?.reason ?? copy.gmCouldNotRevert);
                            }
                        });
                    });
                    moreActs.push(back);
                }
                else {
                    primary.textContent = copy.gmOpenInLog;
                    primary.addEventListener("click", () => { if (app.openLogBed)
                        app.openLogBed(bed.name);
                    else
                        location.hash = "#/log"; });
                    cta.appendChild(primary);
                }
                if (!cta.parentNode)
                    row.appendChild(cta);
            }
            else {
                row.appendChild(head);
                const meta = document.createElement("div");
                meta.className = "bedcard-meta";
                meta.textContent = fillCopy("gmSplitMeta", { shape, area: fmtArea(area(bed.region)) });
                row.appendChild(meta);
            }
            const actions = document.createElement("div");
            actions.className = "bedcard-actions";
            const ed = document.createElement("button");
            ed.type = "button";
            ed.textContent = copy.gmEdit;
            ed.addEventListener("click", () => startEditBed(bed));
            actions.appendChild(ed);
            const dup = document.createElement("button");
            dup.type = "button";
            dup.textContent = copy.gmDuplicate;
            dup.title = fillCopy("gmDuplicateTitle", { name: bed.name });
            dup.addEventListener("click", () => startDuplicateBed(bed));
            actions.appendChild(dup);
            const rm = document.createElement("button");
            rm.type = "button";
            rm.textContent = copy.gmRemove;
            const openSeason$1 = openSeason();
            const loggedOnBed = (openSeason$1?.plantings ?? []).filter((p) => plantingOnBed(p.region, bed.region));
            const guarded = bed.planted === true || loggedOnBed.length > 0;
            let armed = false;
            let armTimer = 0;
            const disarm = () => {
                armed = false;
                if (armTimer) {
                    clearTimeout(armTimer);
                    armTimer = 0;
                }
                rm.textContent = copy.gmRemove;
                rm.classList.remove("arm");
            };
            const doRemove = () => {
                lastAct = { kind: "remove", bed, plants: loggedOnBed };
                void removeBed(db, plotId(), bed.name, seasonId()).then(() => {
                    notice = fillCopy("gmNoticeRemoved", { name: bed.name });
                    invalidatePlot();
                    onBedsChanged();
                    void redraw();
                });
            };
            rm.addEventListener("click", () => {
                if (guarded && !armed) {
                    armed = true;
                    rm.classList.add("arm");
                    const what = loggedOnBed.length > 0
                        ? pluralCopy("gmPlantsLogged", loggedOnBed.length)
                        : copy.gmPlanted;
                    rm.textContent = fillCopy("gmTapAgainRemove", { what });
                    if (armTimer)
                        clearTimeout(armTimer);
                    armTimer = window.setTimeout(disarm, 4000);
                    return;
                }
                disarm();
                doRemove();
            });
            actions.appendChild(rm);
            const strips = plantableStripPolygons({ region: bed.region, rotation_deg: bed.rotation_deg, structure: bed.structure ?? "in_ground", lane_flip: bed.lane_flip });
            const allBeds = plot?.beds ?? [];
            const sections = allBeds.filter((b) => sectionParentOf(b, allBeds) === bed.name);
            const sectioned = sections.length > 0;
            if (strips.length >= 2 && !sectioned) {
                const sp = document.createElement("button");
                sp.type = "button";
                sp.textContent = copy.gmAddSections;
                if (guarded) {
                    const reason = loggedOnBed.length > 0
                        ? pluralCopy("gmRemoveBeforeSections", loggedOnBed.length)
                        : copy.gmUnmarkBeforeSections;
                    sp.disabled = true;
                    sp.title = reason;
                    const why = document.createElement("span");
                    why.className = "arearowwhy";
                    why.textContent = reason;
                    actions.appendChild(sp);
                    actions.appendChild(why);
                }
                else {
                    sp.title = fillCopy("gmAddSectionsTitle", { n: strips.length, name: bed.name });
                    sp.addEventListener("click", () => void doSplitBed(bed, strips));
                    actions.appendChild(sp);
                }
            }
            if (sectioned) {
                const mrg = document.createElement("button");
                mrg.type = "button";
                mrg.textContent = copy.gmMergeSections;
                const sectionPlants = sections.reduce((n, s) => n + (openSeason$1?.plantings ?? []).filter((p) => plantingOnBed(p.region, s.region)).length, 0);
                const mergeGuarded = sections.some((s) => s.planted === true) || sectionPlants > 0;
                let mArmed = false;
                let mTimer = 0;
                const mDisarm = () => { mArmed = false; if (mTimer) {
                    clearTimeout(mTimer);
                    mTimer = 0;
                } mrg.textContent = copy.gmMergeSections; mrg.classList.remove("arm"); };
                mrg.title = fillCopy("gmMergeTitle", { n: sections.length, name: bed.name });
                mrg.addEventListener("click", () => {
                    if (mergeGuarded && !mArmed) {
                        mArmed = true;
                        mrg.classList.add("arm");
                        mrg.textContent = sectionPlants > 0
                            ? pluralCopy("gmMergeLost", sectionPlants)
                            : copy.gmMergePlanted;
                        if (mTimer)
                            clearTimeout(mTimer);
                        mTimer = window.setTimeout(mDisarm, 4000);
                        return;
                    }
                    mDisarm();
                    void doMergeSections(bed, sections);
                });
                actions.appendChild(mrg);
            }
            actions.prepend(...moreActs);
            const more = document.createElement("details");
            more.className = "bedcard-more";
            more.open = moreOpen.has(bed.name);
            more.addEventListener("toggle", () => { if (more.open)
                moreOpen.add(bed.name);
            else
                moreOpen.delete(bed.name); });
            const moreSum = document.createElement("summary");
            moreSum.className = "bedcard-more-s";
            moreSum.textContent = copy.gmMore;
            more.append(moreSum, actions);
            row.appendChild(more);
            box.appendChild(row);
        };
        const beds = plot?.beds ?? [];
        for (const bed of beds.slice(0, AREA_LIST_FIRST))
            drawCard(bed);
        let next = AREA_LIST_FIRST;
        const one = () => {
            if (gen !== areaListGen || next >= beds.length)
                return;
            drawCard(beds[next++]);
            setTimeout(one, 0);
        };
        if (beds.length > AREA_LIST_FIRST)
            setTimeout(one, 0);
    };
    const doSplitBed = async (bed, strips) => {
        const pid = plotId();
        const r2 = (v) => Math.round(v * 100) / 100;
        const fresh = await getPlot(db, pid);
        const taken = new Set((fresh?.beds ?? []).map((b) => b.name));
        const rotated = !!bed.rotation_deg && bed.rotation_deg % 360 !== 0;
        let counter = 1;
        for (const poly of strips) {
            let nm = `${bed.name} ${counter}`;
            while (taken.has(nm))
                nm = `${bed.name} ${++counter}`;
            taken.add(nm);
            counter++;
            let region;
            let rotation;
            if (rotated) {
                region = { shape: "polygon", points: poly.map(([x, y]) => [r2(x), r2(y)]) };
                rotation = bed.rotation_deg;
            }
            else {
                const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
                const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
                region = { shape: "rect", x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
            }
            countRung("bed-saved");
            await placeBed(db, pid, nm, region, rotation, bed.sun, bed.structure);
        }
        notice = fillCopy("gmNoticeSplit", { n: strips.length, name: bed.name });
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    const doMergeSections = async (bed, sections) => {
        const pid = plotId();
        for (const s of sections)
            await removeBed(db, pid, s.name, seasonId());
        notice = fillCopy("gmNoticeMerged", { n: sections.length, name: bed.name });
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    const mppNow = () => (anchorLat == null ? null : metresPerPixel(anchorLat, zoom));
    function fitZoom(lat, w, h, frac = FIT_FRAC, inset = 0) {
        const reqMpp = Math.max(w / (VIEW * frac), h / ((viewH - inset) * frac));
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX - 1, Math.log2(metresPerPixel(lat, 0) / reqMpp)));
    }
    const snap = (v) => Math.round(v * 10) / 10;
    const snapDim = (rawM) => {
        if (isContainerSize())
            return snap(rawM);
        const half = (unitSystem() === "imperial" ? 0.3048 : 1) / 2;
        const near = Math.round(rawM / half) * half;
        if (near > 0 && Math.abs(rawM - near) <= 0.2 * half)
            return Math.round(near * 1000) / 1000;
        return snap(rawM);
    };
    const clientToLocal = (clientX, clientY) => {
        const mpp = mppNow();
        if (mpp == null)
            return null;
        const box = svg.getBoundingClientRect();
        const px = ((clientX - box.left) / box.width) * VIEW;
        const py = ((clientY - box.top) / box.height) * viewH;
        return [cx + (px - VIEW / 2) * mpp, cy - (py - viewH / 2) * mpp];
    };
    const localToClient = (xm, ym) => {
        const mpp = mppNow();
        if (mpp == null)
            return null;
        const box = svg.getBoundingClientRect();
        return [box.left + ((VIEW / 2 + (xm - cx) / mpp) / VIEW) * box.width,
            box.top + ((viewH / 2 - (ym - cy) / mpp) / viewH) * box.height];
    };
    const vertexAt = (clientX, clientY) => {
        for (let i = 0; i < tracePts.length; i++) {
            const c = localToClient(tracePts[i][0], tracePts[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < 22)
                return i;
        }
        return -1;
    };
    const resizeHandleAt = (clientX, clientY) => {
        if (!pending)
            return -1;
        const rad = onPending(clientX, clientY, 0) ? 12 : 22;
        if (mode === "circle") {
            const r = circleR();
            if (!r)
                return -1;
            const c = localToClient(pending.cx + r, pending.cy);
            return c && Math.hypot(clientX - c[0], clientY - c[1]) < rad ? 0 : -1;
        }
        const d = pendingBBox();
        if (!d)
            return -1;
        const cs = pendingCorners(d[0], d[1]);
        for (let i = 0; i < 4; i++) {
            if (mode === "lbed" && i === 1)
                continue;
            const c = localToClient(cs[i][0], cs[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < rad)
                return i;
        }
        return -1;
    };
    const notchWorldPos = () => {
        if (!pending)
            return null;
        let local = null;
        if (mode === "lbed") {
            const d = lDims();
            if (d)
                local = [d.w / 2 - d.nw, d.l / 2 - d.nl];
        }
        else if (mode === "ubed") {
            const d = uDims();
            if (d)
                local = [d.nw / 2, d.l / 2 - d.nl];
        }
        if (!local)
            return null;
        const r = rotPt(local[0], local[1], pendingAngle);
        return [pending.cx + r[0], pending.cy + r[1]];
    };
    const MAGNET_TOL_M = 0.15;
    let magnetGuides = [];
    let magnetSig = "";
    const pendingHalf = () => {
        if (mode === "circle") {
            const r = circleR();
            return r ? [r, r] : null;
        }
        const d = pendingBBox();
        if (!d)
            return null;
        if (pendingAngle % 180 === 0)
            return [d[0] / 2, d[1] / 2];
        if (pendingAngle % 90 === 0)
            return [d[1] / 2, d[0] / 2];
        return null;
    };
    const applyMagnet = (cx0, cy0) => {
        magnetGuides = [];
        const half = pendingHalf();
        const out = { cx: cx0, cy: cy0 };
        if (half) {
            const editingName = (($("areaname")).value ?? "").trim();
            for (const axis of ["x", "y"]) {
                const h = axis === "x" ? half[0] : half[1];
                const c0 = axis === "x" ? cx0 : cy0;
                let best = null;
                for (const bed of app.logSnapshot.beds) {
                    if (editingName && bed.name === editingName)
                        continue;
                    const vs = regionPoints(bed.region).map((p) => (axis === "x" ? p[0] : p[1]));
                    const lo = Math.min(...vs), hi = Math.max(...vs);
                    const cands = [
                        [hi + PATH_M + h, hi], [lo - PATH_M - h, lo], [lo + h, lo], [hi - h, hi],
                    ];
                    for (const [c, guide] of cands) {
                        const d = Math.abs(c0 - c);
                        if (d < MAGNET_TOL_M && (!best || d < best.d))
                            best = { c, guide, d };
                    }
                }
                if (best) {
                    if (axis === "x")
                        out.cx = best.c;
                    else
                        out.cy = best.c;
                    magnetGuides.push({ axis, at: best.guide });
                }
            }
        }
        const sig = magnetGuides.map((g) => g.axis + g.at.toFixed(2)).join("|");
        if (sig && sig !== magnetSig)
            buzz(8);
        magnetSig = sig;
        return out;
    };
    const onPending = (clientX, clientY, margin = 0.3) => {
        if (!pending)
            return false;
        const p = clientToLocal(clientX, clientY);
        if (!p)
            return false;
        if (mode === "rect") {
            const d = rectDims();
            return !!d && Math.abs(p[0] - pending.cx) <= d[0] / 2 + margin
                && Math.abs(p[1] - pending.cy) <= d[1] / 2 + margin;
        }
        if (mode === "lbed" || mode === "ubed" || mode === "trough") {
            const pts = presetWorldPts();
            return !!pts && (pointInPolygon(p[0], p[1], pts) || distToPolygon(p[0], p[1], pts) <= margin);
        }
        const r = circleR();
        return !!r && Math.hypot(p[0] - pending.cx, p[1] - pending.cy) <= r + margin;
    };
    const frameDrop = (clientX, clientY) => {
        const mpp = mppNow();
        if (mpp == null)
            return;
        let bb = pendingBBox();
        if (!bb && mode === "circle") {
            const r = circleR();
            bb = r ? [2 * r, 2 * r] : null;
        }
        if (!bb)
            return;
        const longest = Math.max(bb[0], bb[1]) / mpp;
        if (longest >= 60)
            return;
        let steps = 0;
        while (longest * 2 ** steps < 120 && zoom + steps < ZOOM_MAX)
            steps++;
        if (steps)
            zoomAt(clientX, clientY, zoom + steps);
    };
    const zoomAt = (clientX, clientY, nz) => {
        const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz));
        if (clamped === zoom)
            return;
        const before = clientToLocal(clientX, clientY);
        zoom = clamped;
        const box = svg.getBoundingClientRect();
        if (before && anchorLat != null && box.width >= 2 && box.height >= 2) {
            const mpp = metresPerPixel(anchorLat, zoom);
            const px = ((clientX - box.left) / box.width) * VIEW;
            const py = ((clientY - box.top) / box.height) * viewH;
            cx = before[0] - (px - VIEW / 2) * mpp;
            cy = before[1] + (py - viewH / 2) * mpp;
        }
        notice = null;
        scheduleRedraw();
    };
    let raf = 0;
    const scheduleRedraw = () => {
        if (!raf)
            raf = requestAnimationFrame(() => { raf = 0; void redraw(); });
    };
    const celebrateBed = (region) => {
        const mpp = mppNow();
        if (mpp == null)
            return;
        const pts = regionPoints(region);
        const toV = (xm, ym) => [VIEW / 2 + (xm - cx) / mpp, viewH / 2 - (ym - cy) / mpp];
        const poly = el("polygon", { class: "drawon", points: pts.map(([x, y]) => toV(x, y).join(",")).join(" "), pathLength: 1 });
        const [mx, my] = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length], [0, 0]);
        const [vx, vy] = toV(mx, my);
        const leaves = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 2 * Math.PI;
            const leaf = el("circle", { class: "fxleaf", cx: vx, cy: vy, r: 3.5 });
            leaf.style.setProperty("--dx", `${(Math.cos(a) * 34).toFixed(1)}px`);
            leaf.style.setProperty("--dy", `${(Math.sin(a) * 34).toFixed(1)}px`);
            leaves.push(leaf);
        }
        const nodes = [poly, ...leaves];
        for (const n of nodes)
            L.fx.appendChild(n);
        celebration = { region, poly, leaves };
        setTimeout(() => { for (const n of nodes)
            n.remove(); celebration = null; }, 1200);
    };
    const pointers = new Map();
    let gesture = "none";
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let panSamples = [];
    let coastRaf = 0;
    const coastStop = () => {
        if (!coastRaf)
            return;
        cancelAnimationFrame(coastRaf);
        coastRaf = 0;
        commitGesture();
    };
    const coastStart = () => {
        if (reduceMotion.matches || panSamples.length < 2)
            return false;
        const last = panSamples[panSamples.length - 1];
        let first = last;
        for (const s of panSamples)
            if (last.t - s.t <= 120) {
                first = s;
                break;
            }
        const dt = last.t - first.t;
        const box = svg.getBoundingClientRect();
        if (!(dt > 0) || !Number.isFinite(dt) || box.width < 2 || box.height < 2)
            return false;
        const fx = ((last.x - first.x) / dt) * 16.7 * (VIEW / box.width);
        const fy = ((last.y - first.y) / dt) * 16.7 * (viewH / box.height);
        const frames = coastFrames(fx, fy);
        if (!frames.length)
            return false;
        let i = 0;
        const step = () => {
            coastRaf = 0;
            if (i >= frames.length) {
                commitGesture();
                return;
            }
            gestTx += frames[i][0];
            gestTy += frames[i][1];
            i++;
            applyWorldTransform();
            coastRaf = requestAnimationFrame(step);
        };
        coastRaf = requestAnimationFrame(step);
        return true;
    };
    let edgePan = null;
    let edgePanRaf = 0;
    const EDGE_PAN_PX = 36, EDGE_PAN_SPEED = 7;
    const edgePanStop = () => {
        edgePan = null;
        if (edgePanRaf) {
            cancelAnimationFrame(edgePanRaf);
            edgePanRaf = 0;
        }
    };
    const edgePanStep = () => {
        edgePanRaf = 0;
        if (!edgePan || gesture !== "pending" || !pending)
            return;
        const mpp = mppNow();
        const box = svg.getBoundingClientRect();
        if (mpp == null || box.width < 2 || box.height < 2)
            return;
        cx += edgePan.vx * EDGE_PAN_SPEED * (VIEW / box.width) * mpp;
        cy -= edgePan.vy * EDGE_PAN_SPEED * (viewH / box.height) * mpp;
        const p = clientToLocal(edgePan.x, edgePan.y);
        if (p)
            pending = applyMagnet(snap(p[0]), snap(p[1]));
        scheduleRedraw();
        edgePanRaf = requestAnimationFrame(edgePanStep);
    };
    const edgePanCheck = (clientX, clientY) => {
        const box = svg.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) {
            edgePanStop();
            return;
        }
        const vx = clientX < box.left + EDGE_PAN_PX ? -1 : clientX > box.right - EDGE_PAN_PX ? 1 : 0;
        const vy = clientY < box.top + EDGE_PAN_PX ? -1 : clientY > box.bottom - EDGE_PAN_PX ? 1 : 0;
        if (!vx && !vy) {
            edgePanStop();
            return;
        }
        edgePan = { vx, vy, x: clientX, y: clientY };
        if (!edgePanRaf)
            edgePanRaf = requestAnimationFrame(edgePanStep);
    };
    let vertexIx = -1;
    let resizeAnchor = null;
    let tapStart = null;
    let pinDragStart = null;
    const LONG_PRESS_MS = 400;
    let drawStart = null;
    let longPressTimer = 0;
    const cancelLongPress = () => { if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = 0;
    } };
    let pinchBase = null;
    let gestTx = 0, gestTy = 0, gestScale = 1, gestMx = 0, gestMy = 0;
    const applyWorldTransform = () => {
        setWorldTransform(`translate(${gestTx} ${gestTy}) translate(${gestMx} ${gestMy}) scale(${gestScale}) translate(${-gestMx} ${-gestMy})`);
    };
    const commitGesture = () => {
        if (gestTx === 0 && gestTy === 0 && gestScale === 1)
            return;
        const box = svg.getBoundingClientRect();
        const mpp = mppNow();
        const tx = gestTx, ty = gestTy;
        const dz = Math.log2(gestScale);
        const midClientX = box.left + ((gestMx + tx) / VIEW) * box.width;
        const midClientY = box.top + ((gestMy + ty) / viewH) * box.height;
        gestTx = 0;
        gestTy = 0;
        gestScale = 1;
        gestMx = 0;
        gestMy = 0;
        if (mpp != null && box.width >= 2 && box.height >= 2) {
            cx -= tx * mpp;
            cy += ty * mpp;
            if (dz !== 0)
                zoomAt(midClientX, midClientY, zoom + dz);
        }
        scheduleRedraw();
    };
    const commitPinAt = (clientX, clientY) => {
        const p = clientToLocal(clientX, clientY);
        if (!p || !anchorLL)
            return;
        const [tlat, tlon] = fromLocal(anchorLL, p[0], p[1]);
        const lat = Math.round(tlat * 1e5) / 1e5, lon = Math.round(tlon * 1e5) / 1e5;
        void (async () => {
            if (await gardenIsBare(db, plotId()))
                await doMoveGarden(lat, lon);
            app.setLocation?.(lat, lon, copy.gmPinMoved);
        })();
    };
    svg.addEventListener("pointerdown", (ev) => {
        coastStop();
        panSamples = [{ x: ev.clientX, y: ev.clientY, t: performance.now() }];
        try {
            svg.setPointerCapture(ev.pointerId);
        }
        catch { }
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 2) {
            cancelLongPress();
            const [a, b] = [...pointers.values()];
            pinchBase = { d: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, zoom, tx0: gestTx, ty0: gestTy };
            gesture = "pinch";
            tapStart = null;
            return;
        }
        tapStart = { x: ev.clientX, y: ev.clientY };
        if (locating() && anchorLL && anchorBeds === 0) {
            const ll0 = latlon();
            if (ll0) {
                const c = localToClient(...toLocal(anchorLL, ll0.lat, ll0.lon));
                if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 30) {
                    gesture = "pinmove";
                    pinDragStart = { x: ev.clientX, y: ev.clientY };
                    return;
                }
            }
        }
        if ((mode === "rect" || mode === "lbed" || mode === "ubed" || mode === "trough") && pending) {
            const d = pendingBBox(), mpp = mppNow();
            if (d && mpp != null) {
                const c = localToClient(...rotHandlePos(d[1], mpp));
                if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 22) {
                    gesture = "rotate";
                    return;
                }
            }
        }
        if ((mode === "lbed" || mode === "ubed") && pending) {
            const n = notchWorldPos();
            const c = n && localToClient(n[0], n[1]);
            if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 22) {
                gesture = "notch";
                return;
            }
        }
        if (mode !== "corner" && pending) {
            const h = resizeHandleAt(ev.clientX, ev.clientY);
            if (h >= 0) {
                gesture = "resize";
                resizeAnchor = null;
                const d = pendingBBox();
                if (d) {
                    const cs = pendingCorners(d[0], d[1]);
                    resizeAnchor = [cs[(h + 2) % 4][0], cs[(h + 2) % 4][1]];
                }
                return;
            }
        }
        if (mode === "corner" && (vertexIx = vertexAt(ev.clientX, ev.clientY)) >= 0)
            gesture = "vertex";
        else if (mode !== "corner" && onPending(ev.clientX, ev.clientY))
            gesture = "pending";
        else
            gesture = "pan";
        cancelLongPress();
        if (gesture === "pan" && mode === "rect" && !pending && !locating() && !document.body.classList.contains("plan-needsloc")
            && !(document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)) {
            const w0 = clientToLocal(ev.clientX, ev.clientY);
            if (w0 && !bedAt(w0[0], w0[1], (mppNow() ?? 0) * BED_TAP_SLOP_PX)) {
                const pid = ev.pointerId;
                longPressTimer = window.setTimeout(() => {
                    longPressTimer = 0;
                    const pt = pointers.get(pid);
                    if (!pt || !tapStart || gesture !== "pan" || pointers.size !== 1)
                        return;
                    const w1 = clientToLocal(pt.x, pt.y);
                    if (!w1)
                        return;
                    gestTx = 0;
                    gestTy = 0;
                    gestScale = 1;
                    setWorldTransform(null);
                    gesture = "draw";
                    tapStart = null;
                    drawStart = [snap(w1[0]), snap(w1[1])];
                    buzz(15);
                    toast$1(copy.gmDrawing);
                }, LONG_PRESS_MS);
            }
        }
    });
    svg.addEventListener("pointermove", (ev) => {
        const prev = pointers.get(ev.pointerId);
        if (!prev)
            return;
        const dxPx = ev.clientX - prev.x, dyPx = ev.clientY - prev.y;
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (gesture === "pinch" && pinchBase && pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            const raw = Math.hypot(a.x - b.x, a.y - b.y) / pinchBase.d;
            gestScale = Math.max(Math.pow(2, ZOOM_MIN - pinchBase.zoom), Math.min(Math.pow(2, ZOOM_MAX - pinchBase.zoom), raw));
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            gestMx = ((pinchBase.midX - box.left) / box.width) * VIEW - pinchBase.tx0;
            gestMy = ((pinchBase.midY - box.top) / box.height) * viewH - pinchBase.ty0;
            gestTx = pinchBase.tx0 + ((midX - pinchBase.midX) / box.width) * VIEW;
            gestTy = pinchBase.ty0 + ((midY - pinchBase.midY) / box.height) * viewH;
            applyWorldTransform();
            return;
        }
        if (gesture === "rotate" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                let a = (Math.atan2(-(p[0] - pending.cx), p[1] - pending.cy) * 180) / Math.PI;
                a = Math.round(a / 5) * 5;
                pendingAngle = ((a % 360) + 360) % 360;
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (tapStart && Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y) > 8) {
            tapStart = null;
            cancelLongPress();
        }
        if (gesture === "resize" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                if (mode !== "circle" && resizeAnchor) {
                    const u = rotPt(1, 0, pendingAngle), v = rotPt(0, 1, pendingAngle);
                    const dx = p[0] - resizeAnchor[0], dy = p[1] - resizeAnchor[1];
                    const du = dx * u[0] + dy * u[1], dv = dx * v[0] + dy * v[1];
                    const floor = mode === "lbed" || mode === "ubed" ? 0.3 : 0.2;
                    const w = Math.max(floor, snapDim(Math.abs(du))), l = Math.max(floor, snapDim(Math.abs(dv)));
                    const su = du === 0 ? 1 : Math.sign(du), sv = dv === 0 ? 1 : Math.sign(dv);
                    pending = {
                        cx: resizeAnchor[0] + (u[0] * su * w + v[0] * sv * l) / 2,
                        cy: resizeAnchor[1] + (u[1] * su * w + v[1] * sv * l) / 2,
                    };
                    const [wid, lid] = mode === "lbed" ? ["lw", "ll"] : mode === "ubed" ? ["uw", "ul"]
                        : mode === "trough" ? ["tw", "tl"] : ["shapew", "shapel"];
                    setDim(wid, w);
                    setDim(lid, l);
                }
                else if (mode === "circle") {
                    const r = Math.max(0.1, snapDim(2 * Math.hypot(p[0] - pending.cx, p[1] - pending.cy)) / 2);
                    setDim("shaped", 2 * r);
                }
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (gesture === "notch" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                const lp = rotPt(p[0] - pending.cx, p[1] - pending.cy, -pendingAngle);
                if (mode === "lbed") {
                    const d = lDims();
                    if (d) {
                        setDim("lnw", Math.min(Math.max(0.1, snapDim(d.w / 2 - lp[0])), d.w - 0.1));
                        setDim("lnl", Math.min(Math.max(0.1, snapDim(d.l / 2 - lp[1])), d.l - 0.1));
                    }
                }
                else if (mode === "ubed") {
                    const d = uDims();
                    if (d) {
                        setDim("unw", Math.min(Math.max(0.1, snapDim(2 * Math.abs(lp[0]))), d.w - 0.2));
                        setDim("unl", Math.min(Math.max(0.1, snapDim(d.l / 2 - lp[1])), d.l - 0.1));
                    }
                }
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (gesture === "draw" && drawStart && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                const dx = p[0] - drawStart[0], dy = p[1] - drawStart[1];
                const w = Math.max(0.1, snapDim(Math.abs(dx))), l = Math.max(0.1, snapDim(Math.abs(dy)));
                const x1 = drawStart[0] + Math.sign(dx || 1) * w, y1 = drawStart[1] + Math.sign(dy || 1) * l;
                pending = { cx: (drawStart[0] + x1) / 2, cy: (drawStart[1] + y1) / 2 };
                pendingAngle = 0;
                setDim("shapew", w);
                setDim("shapel", l);
                notice = null;
                scheduleRedraw();
            }
            return;
        }
        if (tapStart || pointers.size !== 1)
            return;
        if (gesture === "pinmove") {
            const box = svg.getBoundingClientRect();
            const pinEl = svg.querySelector(".locpin");
            if (pinEl && pinDragStart && box.width >= 2 && box.height >= 2) {
                const vx = ((ev.clientX - pinDragStart.x) / box.width) * VIEW;
                const vy = ((ev.clientY - pinDragStart.y) / box.height) * viewH;
                pinEl.setAttribute("transform", `translate(${vx} ${vy})`);
            }
        }
        else if (gesture === "vertex") {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                tracePts[vertexIx] = [snap(p[0]), snap(p[1])];
                notice = null;
                scheduleRedraw();
            }
        }
        else if (gesture === "pending") {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                pending = applyMagnet(snap(p[0]), snap(p[1]));
                notice = null;
                scheduleRedraw();
            }
            edgePanCheck(ev.clientX, ev.clientY);
        }
        else if (gesture === "pan") {
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            gestTx += (dxPx / box.width) * VIEW;
            gestTy += (dyPx / box.height) * viewH;
            panSamples.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
            if (panSamples.length > 6)
                panSamples.shift();
            applyWorldTransform();
        }
    });
    const pointerEnd = (ev) => {
        cancelLongPress();
        edgePanStop();
        if (gesture === "draw" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            if (!pending && drawStart && ev.type !== "pointercancel") {
                pending = freeGround({ cx: drawStart[0], cy: drawStart[1] });
                redoPending = null;
            }
            drawStart = null;
            tapStart = null;
            void redraw();
            return;
        }
        if (gesture === "pinmove" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            tapStart = null;
            pinDragStart = null;
            if (ev.type !== "pointercancel")
                commitPinAt(ev.clientX, ev.clientY);
            else
                void redraw();
            return;
        }
        const wasTap = tapStart != null && gesture !== "pinch" && gesture !== "rotate"
            && gesture !== "resize" && gesture !== "notch" && pointers.size === 1;
        pointers.delete(ev.pointerId);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture();
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "pan" && !coastStart())
                commitGesture();
            gesture = "none";
            if (magnetGuides.length) {
                magnetGuides = [];
                magnetSig = "";
                scheduleRedraw();
            }
        }
        if (!wasTap || ev.type === "pointercancel") {
            tapStart = null;
            return;
        }
        tapStart = null;
        const p = clientToLocal(ev.clientX, ev.clientY);
        if (!p)
            return;
        if (locating()) {
            if (!anchorLL)
                return;
            if (anchorBeds > 0) {
                toast(copy.gmSpotSet);
                return;
            }
            commitPinAt(ev.clientX, ev.clientY);
            return;
        }
        if (mode === "corner" ? tracePts.length === 0 : !pending) {
            const tolM = (mppNow() ?? 0) * BED_TAP_SLOP_PX;
            const hit = bedAt(p[0], p[1], tolM);
            closeBedPopover();
            if (hit) {
                openBedPopover(hit);
                return;
            }
        }
        if (document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)
            return;
        if (document.body.classList.contains("plan-needsloc"))
            return;
        notice = null;
        if (mode === "corner") {
            if (vertexAt(ev.clientX, ev.clientY) >= 0)
                return;
            tracePts.push([snap(p[0]), snap(p[1])]);
            redoPts = [];
        }
        else {
            pending = freeGround({ cx: snap(p[0]), cy: snap(p[1]) });
            redoPending = null;
            frameDrop(ev.clientX, ev.clientY);
        }
        void redraw();
    };
    svg.addEventListener("pointerup", pointerEnd);
    svg.addEventListener("pointercancel", pointerEnd);
    const reconcilePointerEnd = (id) => {
        if (!pointers.has(id))
            return;
        pointers.delete(id);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture();
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "pan")
                commitGesture();
            gesture = "none";
            tapStart = null;
            cancelLongPress();
            drawStart = null;
        }
    };
    window.addEventListener("pointerup", (ev) => reconcilePointerEnd(ev.pointerId));
    window.addEventListener("pointercancel", (ev) => reconcilePointerEnd(ev.pointerId));
    svg.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        coastStop();
        const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
        const dz = Math.max(-1, Math.min(1, (-ev.deltaY * unit) / 240));
        if (dz)
            zoomAt(ev.clientX, ev.clientY, zoom + dz);
    }, { passive: false });
    const holdAspect = () => {
        const bb = svg.getBoundingClientRect();
        if (!(bb.width > 0 && bb.height > 0))
            return;
        const h = Math.max(80, Math.round(VIEW * (bb.height / bb.width)));
        svg.setAttribute("viewBox", `0 ${Math.round(((viewH - h) / 2) * 100) / 100} ${VIEW} ${h}`);
    };
    if (svg.parentElement)
        new ResizeObserver(() => { holdAspect(); if (drawOwed)
            void redraw();
        else
            scheduleRedraw(); }).observe(svg.parentElement);
    window.addEventListener("gg-sheet-settled", () => scheduleRedraw());
    const setMode = (m) => {
        mode = m;
        editingFrom = null;
        tracePts = [];
        pending = null;
        pendingAngle = 0;
        redoPts = [];
        redoPending = null;
        cancelLongPress();
        drawStart = null;
        notice = null;
        retireReach();
        for (const [id, mm] of [["modecorner", "corner"], ["moderect", "rect"], ["modecircle", "circle"],
            ["modelbed", "lbed"], ["modeubed", "ubed"], ["modetrough", "trough"]]) {
            $(id).className = mm === m ? "modebtn on" : "modebtn";
        }
        $("dimsrect").hidden = m !== "rect";
        $("dimscircle").hidden = m !== "circle";
        $("dimsl").hidden = m !== "lbed";
        $("dimsu").hidden = m !== "ubed";
        $("dimstrough").hidden = m !== "trough";
        window.dispatchEvent(new Event("gg-sheet-collapse"));
        void redraw();
    };
    $("modecorner").addEventListener("click", () => setMode("corner"));
    $("moderect").addEventListener("click", () => setMode("rect"));
    $("modecircle").addEventListener("click", () => setMode("circle"));
    $("modelbed").addEventListener("click", () => setMode("lbed"));
    $("modeubed").addEventListener("click", () => setMode("ubed"));
    $("modetrough").addEventListener("click", () => setMode("trough"));
    setDim("shapew", unitSystem() === "imperial" ? 4 * 0.3048 : 1.2);
    setDim("shapel", unitSystem() === "imperial" ? 8 * 0.3048 : 2.4);
    window.addEventListener("gg-step-changed", () => void redraw());
    $("mapnoticesx").addEventListener("click", () => {
        noticeDismissed = true;
        $("mapnotices").hidden = true;
        try {
            localStorage.setItem("gg-map-guided", "1");
        }
        catch { }
    });
    $("mapreachx").addEventListener("click", () => {
        reachSeenSession = true;
        $("mapreach").hidden = true;
    });
    $("mapcontainerx").addEventListener("click", () => {
        containerDismissed = true;
        $("mapcontainer").hidden = true;
    });
    const updateLayersChip = () => {
        const set = document.querySelector(".maplayers .ly-set");
        const open = !!set && !set.hidden;
        const off = [["areas", copy.plAreas], ["plantings", copy.plPlantings], ["labels", copy.plLabels]]
            .filter(([k]) => !layerState[k]).map(([, label]) => label);
        $("ly-toggle").textContent = open || off.length === 0 ? copy.plLayers
            : off.length === 1 ? fillCopy("gmLayersOff", { layer: off[0].toLowerCase() })
                : fillCopy("gmLayersHidden", { n: off.length });
    };
    $("ly-toggle").addEventListener("click", () => {
        const set = document.querySelector(".maplayers .ly-set");
        set.hidden = !set.hidden;
        $("ly-toggle").setAttribute("aria-expanded", String(!set.hidden));
        updateLayersChip();
    });
    $("ly-photo").addEventListener("click", () => {
        look = look === "photo" ? "illustrated" : "photo";
        $("ly-photo").classList.toggle("on", look === "photo");
        try {
            localStorage.setItem("gg-maplook", look);
        }
        catch { }
        void redraw();
    });
    $("ly-photo").classList.toggle("on", look === "photo");
    $("keytoggle").addEventListener("click", () => {
        keyOpen = !keyOpen;
        $("keytoggle").setAttribute("aria-expanded", String(keyOpen));
        void redraw();
    });
    for (const [id, key] of [["ly-areas", "areas"], ["ly-plantings", "plantings"], ["ly-labels", "labels"]]) {
        const btn = $(id);
        btn.classList.toggle("on", layerState[key]);
        btn.addEventListener("click", () => {
            layerState[key] = !layerState[key];
            btn.classList.toggle("on", layerState[key]);
            updateLayersChip();
            try {
                localStorage.setItem("gg-maplayers", JSON.stringify(layerState));
            }
            catch { }
            void redraw();
        });
    }
    updateLayersChip();
    {
        const TINTS = [["ly-t-season", "season"], ["ly-t-sun", "sun"],
            ["ly-t-soil", "soil"], ["ly-t-rotation", "rotation"]];
        const words = document.getElementById("tintwords");
        const paint = () => {
            for (const [id, mode] of TINTS)
                $(id).classList.toggle("on", layerState.tint === mode);
            if (words)
                words.textContent = TINT_WORDS[layerState.tint];
        };
        for (const [id, mode] of TINTS) {
            $(id).addEventListener("click", () => {
                layerState.tint = mode;
                paint();
                try {
                    localStorage.setItem("gg-maplayers", JSON.stringify(layerState));
                }
                catch { }
                void redraw();
            });
        }
        paint();
    }
    for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
        $(id).addEventListener("input", () => void redraw());
    }
    $("bedstructure").addEventListener("change", () => {
        const sel = $("bedstructure");
        const wasContainer = prevStructure === "container", nowContainer = sel.value === "container";
        if (wasContainer !== nowContainer) {
            for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
                const el2 = $(id);
                const v = parseFloat(el2.value);
                if (Number.isFinite(v) && v > 0) {
                    const m = wasContainer ? cmInToM(v) : lenToM(v);
                    el2.value = String(nowContainer ? mToCmIn(m) : mToInput(m));
                }
            }
            refreshSizeUnitDisplay();
        }
        prevStructure = sel.value;
        containerDismissed = false;
        void redraw();
    });
    $("mapzin").addEventListener("click", () => { coastStop(); const z = Math.min(ZOOM_MAX, zoom + 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapzout").addEventListener("click", () => { coastStop(); const z = Math.max(ZOOM_MIN, zoom - 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapc").addEventListener("click", () => { cx = 0; cy = 0; void redraw(); });
    $("mapuse").addEventListener("click", () => {
        void (async () => {
            const p = await getPlot(db, plotId());
            if (!p?.anchor)
                return;
            const [lat, lon] = fromLocal(p.anchor, cx, cy);
            app.setLocation?.(Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5);
            notice = copy.gmNoticeCentre;
            void redraw();
        })();
    });
    window.addEventListener("gg-bed-saved", (ev) => {
        void (async () => {
            const name = ev.detail?.bed;
            const p = await getPlot(db, plotId());
            const bed = name ? p?.beds?.find((b) => b.name === name) : undefined;
            if (!bed || !p?.anchor) {
                invalidatePlot();
                void redraw();
                return;
            }
            const pts = regionPoints(bed.region);
            if (!pts.length)
                return;
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
            const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
            zoom = fitZoom(p.anchor.lat, w, h);
            invalidatePlot();
            void redraw();
        })();
    });
    const doMoveGarden = async (lat, lon, address) => {
        const plot = await getPlot(db, plotId());
        const nBeds = plot?.beds.length ?? 0;
        const [bx, by] = bedsCentre(plot?.beds ?? []) ?? [0, 0];
        const [alat, alon] = fromLocal({ lat, lon }, -bx, -by);
        const typedAddr = address?.trim() || document.getElementById("addr")?.value.trim() || undefined;
        await moveGarden(db, plotId(), alat, alon, typedAddr);
        cx = bx;
        cy = by;
        tracePts = [];
        notice = nBeds > 0
            ? pluralCopy("gmNoticeMoved", nBeds)
            : copy.gmNoticeLocationSet;
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    app.placeBareGarden = async (lat, lon, address) => {
        const pid = plotId();
        const plot = await getPlot(db, pid);
        if (!plot?.anchor || (plot.anchor.lat === lat && plot.anchor.lon === lon))
            return false;
        if (!(await gardenIsBare(db, pid)) || pid !== plotId())
            return false;
        await doMoveGarden(lat, lon, address);
        return true;
    };
    const startNewHere = () => {
        const ll = latlon();
        if (ll)
            openGardenAdd({ lat: ll.lat, lon: ll.lon });
    };
    $("newgardenhere").addEventListener("click", startNewHere);
    $("farpick-new").addEventListener("click", startNewHere);
    const moveHere = (btn) => {
        void (async () => {
            const ll = latlon();
            if (!ll)
                return;
            const plot = await getPlot(db, plotId());
            const nBeds = plot?.beds.length ?? 0;
            if (nBeds > 0 && !moveArmed) {
                moveArmed = true;
                btn.textContent = pluralCopy("gmMoveArm", nBeds);
                if (moveArmTimer)
                    clearTimeout(moveArmTimer);
                moveArmTimer = window.setTimeout(() => { moveArmed = false; moveArmTimer = 0; btn.textContent = MOVE_LABEL; }, 4000);
                return;
            }
            moveArmed = false;
            if (moveArmTimer) {
                clearTimeout(moveArmTimer);
                moveArmTimer = 0;
            }
            try {
                await doMoveGarden(ll.lat, ll.lon);
            }
            catch (e) {
                btn.textContent = MOVE_LABEL;
                toast$1(`${e instanceof Error ? e.message : e}`, 5000);
            }
        })();
    };
    $("reanchor").addEventListener("click", () => moveHere($("reanchor")));
    $("farpick-move").addEventListener("click", () => moveHere($("farpick-move")));
    const undoLastAct = async () => {
        const act = lastAct;
        if (!act)
            return;
        lastAct = null;
        const pid = plotId();
        if (act.kind === "save") {
            const cur = (await getPlot(db, pid))?.beds.find((b) => b.name === act.name);
            if (!cur) {
                notice = fillCopy("gmUndoGone", { name: act.name });
            }
            else if (act.prev) {
                await placeBed(db, pid, act.name, act.prev.region, act.prev.rotation_deg, act.prev.sun ?? null, act.prev.structure ?? null, undefined, undefined, undefined, act.prev.rain ?? null);
                await moveBedPlantings(db, pid, cur, { region: act.prev.region, rotation_deg: act.prev.rotation_deg }, seasonId());
                notice = fillCopy("gmUndoEdit", { name: act.name });
            }
            else {
                await removeBed(db, pid, act.name, seasonId());
                notice = fillCopy("gmUndoSave", { name: act.name });
            }
        }
        else {
            await placeBed(db, pid, act.bed.name, act.bed.region, act.bed.rotation_deg, act.bed.sun ?? null, act.bed.structure ?? null, undefined, undefined, undefined, act.bed.rain ?? null);
            if (act.bed.planted) {
                const p2 = await getPlot(db, pid);
                const b2 = p2?.beds.find((b) => b.name === act.bed.name);
                if (p2 && b2) {
                    b2.planted = true;
                    await putPlot(db, p2);
                }
            }
            const sid = seasonId();
            if (sid != null)
                for (const q of act.plants)
                    await addPlanting(db, pid, sid, q);
            notice = act.plants.length
                ? fillCopy(act.plants.length === 1 ? "gmRestoredPlantsOne" : "gmRestoredPlantsMany", { name: act.bed.name, n: act.plants.length })
                : fillCopy("gmRestored", { name: act.bed.name });
        }
        buzz(20);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    $("areaundo").addEventListener("click", () => {
        notice = null;
        if (mode === "corner" && tracePts.length) {
            const p = tracePts.pop();
            if (p)
                redoPts.push(p);
        }
        else if (pending) {
            redoPending = pending;
            pending = null;
        }
        else if (lastAct) {
            void undoLastAct();
            return;
        }
        void redraw();
    });
    $("arearedo").addEventListener("click", () => {
        notice = null;
        if (mode === "corner") {
            const p = redoPts.pop();
            if (p)
                tracePts.push(p);
        }
        else if (redoPending) {
            pending = redoPending;
            redoPending = null;
        }
        void redraw();
    });
    $("areaclear").addEventListener("click", () => {
        retireReach();
        notice = null;
        tracePts = [];
        pending = null;
        redoPts = [];
        redoPending = null;
        editingFrom = null;
        void redraw();
    });
    document.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))
            return;
        if (!document.querySelector("#sec-ground[open], #step-plan[open]"))
            return;
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
            e.preventDefault();
            $(e.key.toLowerCase() === "y" || e.shiftKey ? "arearedo" : "areaundo").click();
            return;
        }
        if (!pending || e.ctrlKey || e.metaKey || e.altKey)
            return;
        const stepM = e.shiftKey ? 1 : 0.1;
        const nudge = {
            ArrowLeft: [-stepM, 0], ArrowRight: [stepM, 0], ArrowUp: [0, stepM], ArrowDown: [0, -stepM],
        };
        if (nudge[e.key]) {
            e.preventDefault();
            pending = { cx: snap(pending.cx + nudge[e.key][0]), cy: snap(pending.cy + nudge[e.key][1]) };
            notice = null;
            scheduleRedraw();
        }
        else if (e.key.toLowerCase() === "r"
            && (mode === "rect" || mode === "lbed" || mode === "ubed" || mode === "trough")) {
            pendingAngle = (((pendingAngle + (e.shiftKey ? -5 : 5)) % 360) + 360) % 360;
            notice = null;
            scheduleRedraw();
        }
        else if (e.key === "Escape" || e.key === "Delete") {
            redoPending = pending;
            pending = null;
            void redraw();
        }
    });
    $("areasave").addEventListener("click", () => {
        void (async () => {
            try {
                const name = ($("areaname")).value.trim();
                if (!name)
                    throw new Error(copy.gmErrNameArea);
                const r2 = (v) => Math.round(v * 100) / 100;
                const bedsNow = (await getPlot(db, plotId()))?.beds ?? [];
                const renaming = editingFrom && editingFrom !== name && bedsNow.some((b) => b.name === editingFrom) ? editingFrom : null;
                const oldBed = bedsNow.find((b) => b.name === (renaming ?? name));
                let region;
                let rotation;
                if (mode === "rect") {
                    const d = rectDims();
                    if (!d)
                        throw new Error(copy.gmErrSetWL);
                    if (!pending)
                        throw new Error(copy.gmErrPlaceSquare);
                    if (pendingAngle % 360 !== 0) {
                        region = { shape: "polygon", points: pendingCorners(d[0], d[1]).map(([x, y]) => [r2(x), r2(y)]) };
                        rotation = pendingAngle;
                        notice = fillCopy("gmSavedRotated", { name, w: fmtLen(d[0]), l: fmtLen(d[1]), deg: pendingAngle });
                    }
                    else {
                        region = { shape: "rect", x: r2(pending.cx - d[0] / 2), y: r2(pending.cy - d[1] / 2), w: r2(d[0]), h: r2(d[1]) };
                        notice = fillCopy("gmSavedRect", { name, w: fmtLen(d[0]), l: fmtLen(d[1]) });
                    }
                }
                else if (mode === "circle") {
                    const r = circleR();
                    if (!r)
                        throw new Error(copy.gmErrSetDiameter);
                    if (!pending)
                        throw new Error(copy.gmErrPlaceCircle);
                    const N = 32;
                    const points = [];
                    for (let i = 0; i < N; i++) {
                        const a = (2 * Math.PI * i) / N;
                        points.push([r2(pending.cx + r * Math.cos(a)), r2(pending.cy + r * Math.sin(a))]);
                    }
                    region = { shape: "polygon", points };
                    notice = fillCopy("gmSavedCircle", { name, d: fmtLen(2 * r) });
                }
                else if (mode === "lbed" || mode === "ubed" || mode === "trough") {
                    const bb = pendingBBox();
                    if (!bb)
                        throw new Error(copy.gmErrSetSize);
                    const pts = presetWorldPts();
                    if (!pending || !pts)
                        throw new Error(copy.gmErrPlaceBed);
                    region = { shape: "polygon", points: pts.map(([x, y]) => [r2(x), r2(y)]) };
                    if (pendingAngle % 360 !== 0)
                        rotation = pendingAngle;
                    if (mode === "lbed") {
                        const d = lDims();
                        notice = fillCopy(d ? "gmSavedLBedNotch" : "gmSavedLBed", { name, w: fmtLen(bb[0]), l: fmtLen(bb[1]), nw: d ? fmtLen(d.nw) : "", nl: d ? fmtLen(d.nl) : "" });
                    }
                    else if (mode === "ubed") {
                        const d = uDims();
                        notice = fillCopy(d ? "gmSavedUBedNotch" : "gmSavedUBed", { name, w: fmtLen(bb[0]), l: fmtLen(bb[1]), nw: d ? fmtLen(d.nw) : "", nl: d ? fmtLen(d.nl) : "" });
                    }
                    else {
                        notice = fillCopy("gmSavedTrough", { name, w: fmtLen(bb[0]), l: fmtLen(bb[1]) });
                    }
                }
                else {
                    if (tracePts.length < 3)
                        throw new Error(copy.gmErrThreeCorners);
                    region = { shape: "polygon", points: tracePts.map((p) => [p[0], p[1]]) };
                    notice = fillCopy("gmSavedTrace", { name });
                }
                const sunSel = ($("bedsun")).value;
                const sun = sunSel === "full" || sunSel === "part_shade" ? sunSel : null;
                const structSel = ($("bedstructure")).value;
                const structure = structSel === "raised" || structSel === "in_ground" || structSel === "container" || structSel === "field"
                    ? structSel : null;
                const gate = structure ? app.bedStructureBlockers?.(renaming ?? name) : null;
                if (gate && structure && gate.blocked.includes(structure) && structure !== oldBed?.structure) {
                    throw new Error(gate.reason(structure) ?? copy.gmErrStructure);
                }
                const laneFlip = ($("bedlanes")).value === "flip" ? true : null;
                const rainSel = ($("bedrain")).value;
                const rain = rainSel === "covered" || rainSel === "indoors" ? rainSel : null;
                if (renaming)
                    await renameBed(db, plotId(), renaming, name);
                countRung("bed-saved");
                await placeBed(db, plotId(), name, region, rotation, sun, structure, undefined, laneFlip, undefined, rain);
                if (structure === "container") {
                    const cpts = regionPoints(region);
                    const cxs = cpts.map((p) => p[0]), cys = cpts.map((p) => p[1]);
                    const maxSpan = Math.max(Math.max(...cxs) - Math.min(...cxs), Math.max(...cys) - Math.min(...cys));
                    const cnote = app.bedContainerNote?.(maxSpan) ?? null;
                    if (cnote)
                        notice = notice ? `${notice} ${cnote}` : cnote;
                }
                if (oldBed)
                    await moveBedPlantings(db, plotId(), oldBed, { region, rotation_deg: rotation }, seasonId());
                lastAct = { kind: "save", name, prev: oldBed ?? null };
                celebrateBed(region);
                tracePts = [];
                pending = null;
                pendingAngle = 0;
                editingFrom = null;
                retireReach();
                buzz(30);
                ($("areaname")).value = "";
                ($("bedsun")).value = "";
                ($("bedrain")).value = "";
                ($("bedstructure")).value = "in_ground";
                ($("bedlanes")).value = "";
                prevStructure = "in_ground";
                refreshSizeUnitDisplay();
                invalidatePlot();
                onBedsChanged();
                if (!oldBed) {
                    const ground = document.getElementById("sec-ground");
                    if (ground)
                        ground.open = true;
                    window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
                }
                void redraw();
            }
            catch (e) {
                toast$1(`${e instanceof Error ? e.message : e}`, 5000);
            }
        })();
    });
    $("plotdefault").addEventListener("click", () => {
        setDefaultPlot(defaultPlotId() === plotId() ? null : plotId());
        void renderPlotBar();
        void app.logRefresh?.();
    });
    ($("plotsel")).addEventListener("change", () => {
        tracePts = [];
        editingFrom = null;
        notice = null;
        onPlotSwitched(($("plotsel")).value);
    });
    return {
        redraw: () => void redraw(),
        centerOn: (lat, lon) => {
            void (async () => {
                const p = await getPlot(db, plotId());
                if (p?.anchor) {
                    const [x, y] = toLocal(p.anchor, lat, lon);
                    cx = x;
                    cy = y;
                    if (!(p.beds?.length ?? 0))
                        zoom = LOCATE_ZOOM;
                    void redraw();
                }
            })();
        },
        refit: () => {
            lastFitPlotId = null;
            lastPlot = null;
            void redraw();
        },
        refitIfDrifted: async () => {
            const p = await getPlot(db, plotId());
            const pts = (p?.beds ?? []).flatMap((b) => regionPoints(b.region));
            if (!pts.length)
                return;
            const lat = p?.anchor?.lat ?? anchorLat ?? 45;
            const mpp = metresPerPixel(lat, zoom);
            const xs = pts.map((q) => VIEW / 2 + (q[0] - cx) / mpp);
            const ys = pts.map((q) => viewH / 2 - (q[1] - cy) / mpp);
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const onScreen = x1 > 0 && x0 < VIEW && y1 > 0 && y0 < viewH;
            const fill = Math.max((x1 - x0) / VIEW, (y1 - y0) / viewH);
            if (!onScreen || fill < 0.25) {
                lastFitPlotId = null;
                lastPlot = null;
                void redraw();
            }
        },
        proposeRect: (w, l, structure, lat) => {
            if (proposalRect || proposalTaken)
                return;
            const bedCy = cy - l / 2 - 0.5;
            proposalRect = { cx, cy: bedCy, w, l, structure };
            cy = bedCy;
            if (Number.isFinite(lat))
                zoom = fitZoom(lat, w, l, 0.35);
            void redraw();
        },
        clearProposal: () => {
            if (!proposalRect && !proposalTaken)
                return;
            proposalRect = null;
            proposalTaken = false;
            void redraw();
        },
        proposalTakenNow: () => proposalTaken,
        dropProposal: () => {
            const dims = proposalRect ? { w: proposalRect.w, l: proposalRect.l } : null;
            proposalRect = null;
            proposalTaken = true;
            void redraw();
            return dims;
        },
        keepProposal: async (name, sun) => {
            if (!proposalRect)
                return false;
            const { cx: pcx, cy: pcy, w, l, structure } = proposalRect;
            const r2 = (v) => Math.round(v * 100) / 100;
            const region = { shape: "rect", x: r2(pcx - w / 2), y: r2(pcy - l / 2), w: r2(w), h: r2(l) };
            const struct = structure === "raised" || structure === "in_ground" || structure === "container" || structure === "field" ? structure : null;
            countRung("bed-saved");
            const sunV = sun === "full" || sun === "part_shade" ? sun : null;
            await placeBed(db, plotId(), name, region, undefined, sunV, struct, true);
            proposalRect = null;
            invalidatePlot();
            onBedsChanged();
            void redraw();
            return true;
        },
    };
}

let seq = 0;
function gardenMenu(o) {
    const id = `agmenu${++seq}`;
    const root = document.createElement("span");
    root.className = "ag-menuwrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ag-switch";
    btn.textContent = o.button;
    btn.setAttribute("aria-label", o.buttonAria);
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    const menu = document.createElement("div");
    menu.id = id;
    menu.className = "ag-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", o.menuAria);
    menu.hidden = true;
    root.append(btn, menu);
    let gardens = [];
    let pending = null;
    const items = () => [...menu.querySelectorAll('[role^="menuitem"]')];
    const draw = () => {
        menu.innerHTML = "";
        for (const g of gardens) {
            const it = document.createElement("button");
            it.type = "button";
            it.className = "ag-item" + (g.current ? " on" : "");
            it.setAttribute("role", "menuitemradio");
            it.setAttribute("aria-checked", String(g.current));
            it.tabIndex = -1;
            it.dataset.id = g.id;
            it.textContent = g.label;
            it.addEventListener("click", () => { close(true); if (!g.current)
                o.onPick(g.id); });
            menu.appendChild(it);
        }
        if (!o.addLabel || !o.onAdd)
            return;
        const onAdd = o.onAdd;
        const sep = document.createElement("div");
        sep.className = "ag-sep";
        sep.setAttribute("role", "separator");
        menu.appendChild(sep);
        const add = document.createElement("button");
        add.type = "button";
        add.className = "ag-item ag-add";
        add.setAttribute("role", "menuitem");
        add.tabIndex = -1;
        add.textContent = o.addLabel;
        add.addEventListener("click", () => { close(false); onAdd(); });
        menu.appendChild(add);
    };
    const outside = (e) => { if (!root.contains(e.target))
        close(false); };
    const open = (focus) => {
        if (!menu.hidden)
            return;
        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        document.addEventListener("pointerdown", outside, true);
        const list = items();
        const target = focus === "last" ? list[list.length - 1] : (list.find((x) => x.getAttribute("aria-checked") === "true") ?? list[0]);
        target?.focus({ preventScroll: true });
        menu.scrollIntoView({ block: "nearest" });
    };
    const close = (focusButton = false) => {
        if (menu.hidden)
            return;
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        document.removeEventListener("pointerdown", outside, true);
        if (pending) {
            gardens = pending;
            pending = null;
            draw();
        }
        if (focusButton)
            btn.focus();
    };
    btn.addEventListener("click", () => (menu.hidden ? open("current") : close(true)));
    btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open("current");
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            open("last");
        }
    });
    menu.addEventListener("keydown", (e) => {
        const list = items();
        const at = list.indexOf(document.activeElement);
        const move = (i) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
        if (e.key === "ArrowDown")
            move(at + 1);
        else if (e.key === "ArrowUp")
            move(at - 1);
        else if (e.key === "Home")
            move(0);
        else if (e.key === "End")
            move(list.length - 1);
        else if (e.key === "Escape") {
            e.preventDefault();
            close(true);
        }
        else if (e.key === "Tab")
            close(false);
    });
    return {
        root,
        update: (next) => { if (menu.hidden) {
            gardens = next;
            draw();
        }
        else
            pending = next; },
        close,
    };
}

let menu = null;
let nameBtn = null;
let latest = null;
const named = (p) => gardenNameOf(p);
function drawGardenLines(g) {
    latest = g;
    drawBanner(g);
    drawBedsElsewhere(g);
}
function drawBanner({ plot, all, where }) {
    const bar = document.getElementById("activegarden");
    if (!bar)
        return;
    const real = !!(plot?.anchor || (plot?.beds?.length ?? 0) > 0);
    if (!real || all.length <= 1) {
        menu?.close();
        bar.hidden = true;
        return;
    }
    if (!nameBtn || !menu || !bar.contains(nameBtn)) {
        bar.innerHTML = "";
        nameBtn = el$1("button", "ag-open");
        nameBtn.type = "button";
        nameBtn.addEventListener("click", () => { const wh = document.getElementById("step-where"); if (wh)
            wh.open = true; });
        menu = gardenMenu({
            button: copy.lgSwitch, buttonAria: copy.lgSwitchAria, menuAria: copy.lgGardenMenuAria,
            onPick: (id) => latest?.activate(id),
            ...(plusPreview() ? { addLabel: copy.logAddGardenBtn, onAdd: openGardenAdd } : {}),
        });
        bar.append(nameBtn, menu.root);
    }
    nameBtn.innerHTML = "";
    const agName = plot ? named(plot) : gardenNameOf(null, app.currentPlotId);
    el$1(nameBtn, "span", "ag-name", plot?.shared ? fillCopy("lgNameTagged", { name: agName, tag: copy.teamsSharedTag }) : agName);
    el$1(nameBtn, "span", "ag-where", ` · ${where ?? copy.lgLocationNotSet}`);
    nameBtn.title = copy.lgActiveGardenTitle;
    const def = defaultPlotId();
    menu.update(orderGardens(all, (p) => p, def).map((p) => {
        const base = p.id === def ? fillCopy("lgNameDefault", { name: named(p) }) : named(p);
        return { id: p.id, current: p.id === app.currentPlotId, label: p.shared ? fillCopy("lgNameTagged", { name: base, tag: copy.teamsSharedTag }) : base };
    }));
    bar.hidden = false;
}
function drawBedsElsewhere({ plot, all, edited, activate }) {
    const real = all.filter((p) => !p.example);
    const nameLine = document.getElementById("groundgarden");
    if (nameLine) {
        nameLine.hidden = !plot || !!plot.example || real.length <= 1;
        if (!nameLine.hidden && plot)
            nameLine.textContent = fillCopy("lgGardenNamed", { name: gardenShownName(named(plot), plot.shared) });
    }
    const bedless = !!plot && !plot.example && !plot.beds?.length && !madeThisVisit.has(plot.id);
    const withBeds = bedless ? real.filter((p) => p.id !== plot.id && !p.shared && (p.beds?.length ?? 0) > 0) : [];
    const target = withBeds.find((p) => p.id === pickGarden(withBeds, { edited }));
    for (const host of document.querySelectorAll(".bedselsewhere")) {
        host.hidden = !target;
        host.innerHTML = "";
        if (!target)
            continue;
        el$1(host, "span", "be-text", fillCopy("lgBedsElsewhere", { garden: named(target) }));
        host.append(" ");
        const go = el$1(host, "button", "btn btn-quiet tertiary be-go", fillCopy("lgBedsElsewhereGo", { garden: named(target) }));
        go.type = "button";
        go.addEventListener("click", () => activate(target.id));
    }
}

export { arrivalSettled, confirmWhereShown, drawGardenLines, endArrival, ensureWhereMap, firstBedHidden, followWhereMap, gardenAddDraw, show as gmapShow, initBedAdd, initGroundMap, initMyBedTrack, initPlanSheet, myBedMemberCount, openGardenAdd, proposeFirstBed, renderEligibility, renderGuilds, renderMyBed, renderSeason, setGuildFocus, setWhereMapCenter, updateStepStates, whereShown };
