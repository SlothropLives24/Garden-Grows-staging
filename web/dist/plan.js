import { countRung } from "./analytics.js";
import { openSeason as activeSeason, priorSeasons as pastSeasons, seasonById, seasonId as currentSeasonId, setSeasonId, upsertSeasonSnapshot } from "./session.js";
import { eligibleSpecies, instantiate, resolveSpecies, substitutionVerdict } from "./engine/compiler.js";
import { BLOOM_ORDER, forageCandidates, forageInFlower } from "./engine/forage.js";
import { openBed, optimizeBed, bedArchetype, optimizedPlacement, strongestSupportRequirement, structureLine, virusNeighbours } from "./engine/openbed.js";
import { compose } from "./engine/composer.js";
import { SECTION_ORDER, bandRank, browsableGuilds, derivedGuilds, displayName, guildSection, guildStatus, laysOutAsHills, shortlistRank } from "./engine/guilds.js";
import { resolveClimate } from "./engine/intake.js";
import { backendConfigured, isSignedIn } from "./account.js";
import { familyName, humanize, humanizeFamilies, stripRuleCitations, titleCase } from "./engine/labels.js";
import { frostRiskRows, humanizeMMDD } from "./panels/frostrisk.js";
import { glossTerm } from "./glossary.js";
import { onionDaylengthNote } from "./panels/daylength.js";
import { accessBands as computeAccessBands, bedFrame, framesEqual, orientedToPlot, place, remapRegionBetweenBeds } from "./engine/place.js";
import { daylightHours, heightOrderingViolations, noonShadowLengthM, referenceDoy, shelterPredicate, shelteredByShadow } from "./engine/solar.js";
import { linkNameIn, linkNamesIn, plantHref, plantLink } from "./panels/plantcard.js";
import { VALUE_WORD } from "./engine/plantcard.js";
import { area as regionArea, fitDiagram, intersectArea, radialRingsFromFootprint, regionCentroid, regionPoints } from "./engine/regions.js";
import { heatWarnings, livingSupportLead, mechanismRows, memberSpecies, plantingWindowFor, spacingRows } from "./engine/schedule.js";
import { gardenTasks } from "./engine/tasks.js";
import { deriveHistory, seedNextPlan } from "./engine/seasonlog.js";
import { getPlot, getSeason, listSeeds, openLog, placeBed, putPlot, putSeason, setBedPlanted } from "./storage.js";
import { nextBedName, nextOrigin } from "./dimbed.js";
import { dayWord, plantedLine } from "./diary.js";
import { roleWords } from "./rolewords.js";
import { $, disclose, SVG_NS } from "./dom.js";
import { mark, markLink } from "./dossier.js";
import { bedPlate, plateKey, plateKeyInto } from "./gardenplate.js";
import { toast } from "./notices.js";
import { pointInPolygon } from "./groundmap/geometry.js";
import { scrollerFor, seat } from "./seat.js";
import { activeBundle, app, commonName, plantingLabel, ruleClaim } from "./state.js";
import { plotBlock } from "./plotlayer.js";
import { copy } from "./copy.js";
import { fmtArea, fmtCm, fmtKm, fmtLen, fmtTemp, localiseProse } from "./units.js";
export const NO_DATES_YET = "Your dates arrive with a location - set it on the Where step and they fill in here.";
export function seasonStartLine(year, saved, bedName) {
    return plantedLine(year, saved, bedName);
}
import { confidenceBadge, confidenceWord } from "./confidence.js";
import { bedHasSections, bedSeasonStatus, declaredPriorYear, mergePriorOccupancy, plantingOnBed } from "./occupancy.js";
import { PLANT_COLORS, appliedPlanDots, bedOrientation, bedStructure, carriedOccupancy, categoryLabel, filledMembers, guildPlacementGlimpse, guildPlantings, placeGuildPlants, placementSvg, planBedRegion, plantableArea, roleDensity, roleOverridesOf, scaledFillCounts, shelteredChosen, snapCountsToLayout, svgNumber, zoneColorMap } from "./placement.js";
export { appliedPlanDots, draftPlantings, guildPlacementGlimpse, guildPlantings } from "./placement.js";
export { bedHasSections, bedSeasonStatus, declaredPriorYear, mergePriorOccupancy, plantingOnBed, sectionParentName, sectionParentOf } from "./occupancy.js";
import { el } from "./dom.js";
export { confidenceBadge, confidenceWord };
export function renderClimate(res, zone, lat = null, cal = null) {
    const panel = $("climate");
    panel.innerHTML = "";
    delete panel.dataset.copyKey;
    const hasZone = !!(zone && zone.zone != null);
    if (!res && !hasZone && lat == null) {
        panel.textContent = copy.climateEmpty;
        panel.dataset.copyKey = "climateEmpty";
        return;
    }
    const card = document.createElement("div");
    card.className = "climatecard";
    const h = document.createElement("h2");
    h.className = "cc-title";
    h.textContent = "This ground's climate";
    if (res) {
        const loc = document.createElement("span");
        loc.className = "cc-loc";
        loc.textContent = `${fmtKm(res.distanceKm)} from ${titleCase(res.site.key)}`;
        h.appendChild(loc);
    }
    card.appendChild(h);
    const rows = document.createElement("dl");
    rows.className = "cc-rows";
    const row = (label, value, grade, glossKey) => {
        const dt = document.createElement("dt");
        if (glossKey) {
            dt.appendChild(document.createTextNode(label.replace(new RegExp(glossKey === "zone" ? "zone" : "tier", "i"), "").replace(/\s+$/, "") + " "));
            dt.appendChild(glossTerm(glossKey, glossKey === "zone" ? "zone" : "tier"));
        }
        else
            dt.textContent = label;
        rows.appendChild(dt);
        const dd = document.createElement("dd");
        dd.appendChild(value);
        if (grade) {
            const g = document.createElement("span");
            g.className = "cc-grade";
            g.textContent = grade;
            dd.appendChild(g);
        }
        rows.appendChild(dd);
    };
    const val = (bold, qual) => {
        const span = document.createElement("span");
        const b = document.createElement("b");
        b.textContent = bold;
        span.appendChild(b);
        if (qual) {
            const q = document.createElement("span");
            q.className = "cc-q";
            q.textContent = ` ${qual}`;
            span.appendChild(q);
        }
        return span;
    };
    if (hasZone)
        row("Hardiness zone", val(zone.label ?? String(zone.zone)), confidenceWord(zone.grade) ?? undefined, "zone");
    if (res) {
        const site = res.site;
        const lf = site.last_frost_32f ?? {};
        const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
        const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
        const whyR093 = (v) => {
            v.appendChild(document.createTextNode(" "));
            const a = document.createElement("a");
            a.className = "whytap";
            a.href = "#/why?rule=R-093";
            a.textContent = "Why this? →";
            markLink(a, { kind: "rule", id: "R-093" });
            v.appendChild(a);
            return v;
        };
        if (springObs) {
            row("Last spring frost", whyR093(val(`~${humanizeMMDD(springObs)}`, `· your ground's own date, from ${cal.spring.n} logged seasons · the general estimate said ~${lf.p50 ? humanizeMMDD(lf.p50) : "-"}`)));
        }
        else if (lf.p50) {
            row("Last spring frost", val(`~${humanizeMMDD(lf.p50)}`, lf.p10 ? `· safe after ~${humanizeMMDD(lf.p10)}` : undefined));
        }
        if (fallObs) {
            row("First fall freeze", whyR093(val(`~${humanizeMMDD(fallObs)}`, `· your ground's own date, from ${cal.fall.n} logged seasons · the general estimate said ~${site.first_freeze_32f_p50 ? humanizeMMDD(site.first_freeze_32f_p50) : "-"}`)));
        }
        else if (site.first_freeze_32f_p50) {
            row("First fall freeze", val(`~${humanizeMMDD(site.first_freeze_32f_p50)}`));
        }
        if (site.growing_season_days_p50 != null)
            row("Growing season", val(`~${site.growing_season_days_p50} days`));
        if (site.summer_night_tmin_c != null)
            row("Summer nights", val(`min ~${fmtTemp(site.summer_night_tmin_c)}`));
    }
    if (lat != null) {
        const a = Math.abs(lat);
        const dayLabel = a >= 38 ? "long-day" : a <= 35 ? "short-day" : "onion changeover";
        const solstice = lat < 0 ? 355 : 172;
        row("Daylength", val(dayLabel, `· ~${daylightHours(lat, solstice).toFixed(1)} h peak`));
    }
    card.appendChild(rows);
    const more = document.createElement("details");
    more.className = "cc-more";
    const sum = document.createElement("summary");
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "▸";
    chev.setAttribute("aria-hidden", "true");
    sum.appendChild(chev);
    sum.appendChild(document.createTextNode("How we know · frost risk by date"));
    more.appendChild(sum);
    const mb = document.createElement("div");
    mb.className = "cc-mbody";
    const para = (lead, rest) => {
        const p = document.createElement("p");
        const s = document.createElement("strong");
        s.textContent = lead;
        p.appendChild(s);
        p.appendChild(document.createTextNode(rest));
        mb.appendChild(p);
    };
    if (res) {
        const fr = frostRiskRows(res.site);
        if (fr.length >= 2) {
            para("Frost risk by planting date", " - chance a killing frost still comes after you plant:");
            const chips = document.createElement("div");
            chips.className = "cc-frost";
            for (const r of fr) {
                const chip = document.createElement("span");
                chip.className = "cc-fp";
                const date = document.createElement("b");
                date.textContent = r.label;
                const pct = document.createElement("span");
                pct.textContent = `${r.pct}%`;
                chip.append(date, document.createTextNode(" "), pct);
                chips.appendChild(chip);
            }
            mb.appendChild(chips);
        }
    }
    if (lat != null)
        para("Photoperiod", ` - latitude ${lat.toFixed(1)}° is ${onionDaylengthNote(lat)}`);
    if (res) {
        const prov = res.site.provenance ?? {};
        const fs = document.createElement("p");
        const st = document.createElement("strong");
        st.textContent = "Frost & season";
        fs.appendChild(st);
        fs.appendChild(document.createTextNode(` - ${confidenceWord(String(prov.grade ?? res.effectiveGrade))?.toLowerCase() ?? "estimated"} for your ground (`));
        fs.appendChild(glossTerm("tier", "tier"));
        fs.appendChild(document.createTextNode(` ${prov.tier ?? "?"}). ${res.caveat}`));
        mb.appendChild(fs);
    }
    if (hasZone) {
        const phzm = zone.method === "nearest_phzm_zipcode";
        para("Zone", phzm
            ? ` - USDA 2023 Plant Hardiness Zone Map ZIP listing (USDA-ARS & PRISM Climate Group, Oregon State University), nearest ZIP ~${zone.distance_km ?? "?"} km - derived data, not the official map.`
            : ` - ${zone.source ?? "USDA-equivalent, from the bundled site's climate normals"}.`);
    }
    if (lat != null)
        para("Daylength", " - astronomical, from your latitude; no twilight, no forecast, works offline.");
    more.appendChild(mb);
    card.appendChild(more);
    panel.appendChild(card);
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
            ? ` It needs more room, though: this pushes the team to ~${fmtArea(v.effective_footprint_min_m2)}, over your bed.`
            : ` It also needs a bit more room (~${fmtArea(v.effective_footprint_min_m2)} for the team).`)
        : "";
    if (v.verdict === "clean") {
        return said(`${name} works as the ${humanize(v.role)} - it does that job, nothing is lost.${space}`);
    }
    if (v.verdict === "adaptation") {
        const lost = v.predicate_fails.map(humanizeFamilies).join("; ");
        const forfeits = v.role_mechanisms.length
            ? ` You forfeit: ${v.role_mechanisms.map((m) => stripRuleCitations(m.claim)).join("; ")}.`
            : "";
        const keep = remedy ? ` To keep it, use: ${remedy}.` : "";
        return said(`${name} will grow here, but it doesn't do the ${humanize(v.role)}'s job (${lost}) - ` +
            `so this is a looser version, not a true ${displayName(guild)}.${forfeits}${keep}${space}`);
    }
    const why = v.site_reasons.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ");
    const alt = remedy ? ` Try instead: ${remedy}.` : "";
    return said(`${name} can't go here - ${why}.${alt}`);
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
function schedulingNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    if (sp?.scheduling_model !== "gdd")
        return null;
    return "no sowing or harvest dates for this one - it is timed by accumulated heat "
        + "(growing-degree days), which this app does not compute yet";
}
function invasiveNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const inv = sp?.invasive_status;
    if (!inv)
        return null;
    const where = (inv.regions ?? []).map((rg) => /^[A-Za-z]{2}$/.test(rg) ? rg.toUpperCase() : humanize(rg));
    const note = (inv.note ?? "").trim();
    const head = where.length ? `flagged invasive in ${where.join(", ")}` : "flagged invasive";
    return `${head}${note ? ` - ${stripRuleCitations(note)}` : ""} Check your state noxious weed list before planting it.`;
}
function containmentNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    if (sp?.spreads_unbidden !== true)
        return null;
    const why = typeof sp.spreads_unbidden_reason === "string" ? sp.spreads_unbidden_reason.trim() : "";
    return `spreads on its own${why ? ` - ${stripRuleCitations(why)}` : ""}`;
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
    return `first fruit in about ${span} ${hi === 1 ? "year" : "years"}`;
}
export function groupLabel(bundle, species, group) {
    return plantingLabel(bundle, species, group);
}
function fillerLabel(bundle, filler, group) {
    return groupLabel(bundle, filler, group);
}
const guildRoleChoices = new Map();
const roleChoiceKey = (bed, guildId, role) => `${bed}|${guildId}|${role}`;
const candbedValue = () => document.getElementById("candbed")?.value ?? "";
let compareIds = [];
let compareBed = "";
const COMPARE_MAX = 3;
function plotSiblings(exceptBed) {
    const openSeason = activeSeason() ?? undefined;
    return app.logSnapshot.beds
        .filter((b) => b.name !== exceptBed && !bedHasSections(b.name, app.logSnapshot.beds))
        .map((b) => {
        const live = (openSeason?.plantings ?? [])
            .filter((pl) => !pl.end_cause && plantingOnBed(pl.region, b.region));
        return { name: b.name, region: b.region, species: live.map((pl) => pl.species),
            members: live.map((pl) => ({ species: pl.species, group: pl.cultivar_group ?? null })) };
    });
}
function restoreRoleChoice(bed, guildId, role) {
    const live = guildRoleChoices.get(roleChoiceKey(bed, guildId, role));
    if (live)
        return live;
    const season = activeSeason();
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
function rolePlan(inst, site, guild, bundle, applyWrap = null) {
    const det = document.createElement("details");
    const sum = document.createElement("summary");
    const members = memberSpecies(guild);
    const filled = inst.roles.filter((r) => r.chosen).length;
    sum.className = "roleplansum";
    const rchev = document.createElement("span");
    rchev.className = "chev";
    rchev.textContent = "▸";
    rchev.setAttribute("aria-hidden", "true");
    sum.append(rchev, document.createTextNode(inst.roles.length
        ? `Plan: ${filled} of ${inst.roles.length} jobs can be filled here`
        : `Plan: ${members.length} plants`));
    det.appendChild(sum);
    const earlyBed = app.logSnapshot.beds.find((b) => b.name === (document.getElementById("candbed")?.value ?? ""));
    const earlyRegion = planBedRegion(earlyBed);
    const bedAreaEarly = earlyRegion ? plantableArea(earlyRegion, bedStructure(earlyBed, guild), earlyBed?.lane_flip ?? false) : null;
    const nSpeciesEarly = inst.roles.length || members.length;
    const earlyCounts = scaledFillCounts(inst.roles.map((rr) => ({ resolved: resolveSpecies((rr.chosen ?? rr.canonical ?? ""), null, bundle), density: roleDensity(guild, rr.role) })), bedAreaEarly, nSpeciesEarly);
    const roleCountById = new Map(inst.roles.map((rr, i) => [rr.role, earlyCounts[i]]));
    const roleSelects = [];
    for (const rr of inst.roles) {
        const p = document.createElement("p");
        p.className = "role";
        const head = document.createElement("strong");
        const words = roleWords(guild, rr.role);
        if (words) {
            head.appendChild(disclose(humanize(rr.role), () => words, "rolewhy"));
            head.appendChild(document.createTextNode(": "));
        }
        else {
            head.textContent = `${humanize(rr.role)}: `;
        }
        p.appendChild(head);
        const bits = [];
        const asSpecies = (id) => bundle.species.some((sp) => sp.id === id) ? id : null;
        for (const o of rr.options) {
            const name = fillerLabel(bundle, o.filler, o.group);
            if (o.eligible) {
                let s = o.filler === rr.chosen ? `${name}` : `or ${name}`;
                if (o.filler === rr.chosen) {
                    const n = roleCountById.get(rr.role) ?? 1;
                    if (n > 1)
                        s += ` (plant ${n})`;
                }
                if (o.kind !== "canonical" && o.cost)
                    s += ` (cost: ${stripRuleCitations(o.cost.trim())})`;
                if (o.cost_tags.length)
                    s += ` [${o.cost_tags.map(humanize).join(", ")}]`;
                const req = cultivarRequirement(bundle, o.filler);
                if (req)
                    s += ` - needs the '${req.cultivar}' cultivar: ${req.reason}`;
                const wait = bearingNote(bundle, o.filler);
                if (wait)
                    s += ` - ${wait}`;
                const cv = cultivarPartner(bundle, o.filler);
                if (cv)
                    s += ` - needs ${cv} different varieties within ${fmtLen(15)} to ${fmtLen(30)} to set fruit - a neighbour's tree can be the second, but two of the same will not do`;
                if (dioeciousNote(bundle, o.filler))
                    s += ` - needs a male pollenizer near the female to set fruit (usually two plants; some cultivars are self-fertile)`;
                const inv = invasiveNote(bundle, o.filler);
                if (inv)
                    s += ` - ${inv}`;
                const sched = schedulingNote(bundle, o.filler);
                if (sched)
                    s += ` - ${sched}`;
                for (const a of o.advisories ?? [])
                    s += ` - ${stripRuleCitations(humanizeFamilies(a.why))}`;
                bits.push({ text: s, species: asSpecies(o.filler), label: name, group: o.group ?? null });
            }
            else {
                const why = o.reasons.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ");
                bits.push({ text: `${name} - ${why}`, species: asSpecies(o.filler), label: name, group: o.group ?? null });
            }
        }
        if (!rr.options.length)
            bits.push({ text: rr.optional ? "(optional - no set plant for this job)" : "(no set plant for this job)", species: null, label: "", group: null });
        if (rr.chosen == null && !rr.optional && rr.options.length)
            bits.push({ text: "no plant can do this job here", species: null, label: "", group: null });
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
            skip.textContent = "skip (optional)";
            sel.insertBefore(skip, sel.firstChild);
        }
        if (!fillers.length) {
            const blank = document.createElement("option");
            blank.value = "";
            blank.textContent = "swap in a different plant…";
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
    const chosen = inst.roles.length
        ? inst.roles
            .filter((r) => r.chosen)
            .map((r) => [r.chosen, r.options.find((o) => o.filler === r.chosen)?.group ?? null])
        : members;
    const chosenIds = chosen.map(([sid]) => sid);
    if (!inst.roles.length && members.length) {
        const p = document.createElement("p");
        p.className = "role";
        p.appendChild(document.createTextNode("contains: "));
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
        h("p", "window", `Season here: last frost ~${w.last_frost_p50 ?? "?"} → first freeze ~${w.first_freeze_p50 ?? "?"} ` +
            `(~${w.growing_season_days ?? "?"} frost-free days).`);
        for (const hw of heatWarnings(chosenIds, site.lat ?? null, site.lon ?? null, bundle)) {
            const label = commonName(bundle, hw.species);
            const line = h("p", "heat", "");
            linkNameIn(line, `${label} - summer night min ${fmtTemp(hw.night_c)} exceeds ${fmtTemp(hw.night_max_c)}; expect a midsummer gap when it's too hot to set fruit.`, label, hw.species);
            mark(line, { kind: "rule", id: "R-030" });
        }
    }
    const rows = spacingRows(chosen, bundle).filter((r) => r.spread_cm !== null || r.days_to_maturity !== null);
    const groupOfChosen = new Map();
    for (const [sid, grp] of chosen) {
        const g = grp ?? null;
        groupOfChosen.set(sid, groupOfChosen.has(sid) && groupOfChosen.get(sid) !== g ? null : g);
    }
    if (rows.length) {
        const table = document.createElement("table");
        table.className = "spacing";
        table.innerHTML = "<tr><th>species</th><th>spread</th><th>height</th><th>days</th><th></th></tr>";
        for (const r of rows) {
            const tr = document.createElement("tr");
            const td = (t) => {
                const c = document.createElement("td");
                c.textContent = t;
                tr.appendChild(c);
            };
            const nameCell = document.createElement("td");
            nameCell.appendChild(plantLink(plantingLabel(bundle, r.species, groupOfChosen.get(r.species) ?? null), r.species, groupOfChosen.get(r.species) ?? null));
            tr.appendChild(nameCell);
            td(r.spread_cm === null ? "-" : fmtCm(r.spread_cm));
            td(r.height_cm === null ? "-" : fmtCm(r.height_cm));
            td(r.days_to_maturity === null ? "-" : `~${r.days_to_maturity}`);
            td(r.flags.join(", "));
            table.appendChild(tr);
        }
        const scroll = document.createElement("div");
        scroll.className = "tscroll";
        scroll.appendChild(table);
        det.appendChild(scroll);
    }
    const mech = mechanismRows(guild, bundle);
    for (const m of mech.rows) {
        const detail = m.rule && m.rule_mechanism ? ` - ${m.rule_mechanism}` : "";
        const el = h("p", "mech", `${stripRuleCitations(m.claim)}${detail}`);
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
            none.textContent = " · no rule backs this yet";
            el.appendChild(none);
        }
    }
    if (!mech.rows.length && mech.honesty_note)
        h("p", "honesty", stripRuleCitations(mech.honesty_note)).dataset.prose = "corpus";
    const gx = guild;
    for (const b of gx.surfaces_beliefs ?? []) {
        const p = h("p", "gbelief", "");
        const a = document.createElement("a");
        a.className = "whytap";
        a.href = `#/why?belief=${b}`;
        a.textContent = "The folklore this answers →";
        markLink(a, { kind: "belief", id: b });
        p.appendChild(a);
    }
    if (gx.planting_source && [...roleCountById.values()].some((n) => n > 1)) {
        const src = String(gx.planting_source).trim();
        const p = h("p", "gcount", "");
        p.appendChild(disclose("How we count", () => `The planting counts on this card come from ${src}.`));
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
    const memberDensity = (sid) => {
        const mem = (guild.members ?? []);
        const m = mem.find((x) => x.species === sid);
        return typeof m?.planting_density_m2 === "number" ? m.planting_density_m2 : undefined;
    };
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
            pa("Pick a bed under “Beds” (or draw one on the map) and this team can be planned onto it.");
            return;
        }
        const openSeason = currentSeasonId() != null
            ? activeSeason() : null;
        const planted = (openSeason?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region));
        const draftedHere = (Array.isArray(openSeason?.plan) ? openSeason.plan : [])
            .some((e) => e.area === bed.name && e.guild === guild.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "saveplan primary";
        if (planted) {
            btn.textContent = `“${bed.name}” is planted - open it on the Log`;
            btn.disabled = true;
        }
        else if (draftedHere) {
            btn.textContent = `Saved as “${bed.name}”’s plan - mark it planted on the bed’s card`;
            btn.disabled = true;
        }
        else if (openSeason) {
            btn.textContent = `Save as “${bed.name}”’s plan`;
            btn.addEventListener("click", () => void savePlanSelection(guild.id, bed.name, btn, bundle, site, roleSwapDeltas()));
        }
        else {
            btn.textContent = `Save as “${bed.name}”’s plan`;
            btn.addEventListener("click", () => void (async () => {
                btn.disabled = true;
                try {
                    const year = new Date().getFullYear();
                    if (!app.logDb)
                        throw new Error("the garden log isn’t ready yet - try again in a moment");
                    if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
                        await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                    }
                    await app.logRefresh?.();
                    if (currentSeasonId() == null)
                        throw new Error("season did not open - check the Log tab");
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
        const plantRows = spacingRows(chosenNow.map((c) => [c.sid, c.group]), bundle).filter((r) => r.height_cm !== null || r.spread_cm !== null);
        if (!(region && site.lat != null && plantRows.length >= (isRest ? 1 : 2)))
            return;
        const r003 = bundle.rules.find((x) => x.id === "R-003");
        const bedArea = plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false);
        const countBySpecies = new Map();
        const ringBySpecies = new Map();
        const moundBySpecies = new Map();
        const moundCapBySpecies = new Map();
        const roleBySpecies = new Map();
        const counts = scaledFillCounts(chosenNow.map((c) => ({ resolved: resolveSpecies(c.sid, c.group, bundle), density: c.density })), bedArea, chosenNow.length);
        chosenNow.forEach((c, i) => {
            countBySpecies.set(c.sid, counts[i]);
            if (c.role)
                roleBySpecies.set(c.sid, c.role);
            if (isRadial) {
                const ri = c.role ? RING_ORDER.indexOf(c.role) : -1;
                ringBySpecies.set(c.sid, ri >= 0 ? ri : RING_ORDER.length + i);
            }
            if (isHills) {
                moundBySpecies.set(c.sid, c.role ? MOUND_ROLES.has(c.role) : false);
                if (c.role && MOUND_CAP[c.role])
                    moundCapBySpecies.set(c.sid, MOUND_CAP[c.role]);
            }
        });
        const layoutKind = isRadial ? "orchard" : isHills ? "hills" : isShelter ? "shelter" : isGrid ? "grid" : "rows";
        const shelteredSet = shelteredChosen(chosenNow, bundle, isShelter);
        const occupied = carriedOccupancy(bed);
        const pl = place(plantRows.map((r) => ({ id: r.species, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countBySpecies.get(r.species) ?? 1, ring: ringBySpecies.get(r.species), mound: moundBySpecies.get(r.species), mound_cap: moundCapBySpecies.get(r.species), sheltered: shelteredSet.has(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
        const bedLabel = bed ? `"${bed.name}"` : "your bed";
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
        const introText = isRadial
            ? (trees.length === 1
                ? (centre === "tree"
                    ? `Where each plant goes in ${bedLabel} - one tree with its understory in rings out to the drip line (bulbs at the trunk, ground plants under the canopy, pollinators at the edge):`
                    : `Where each plant goes in ${bedLabel} - the ${centre} centred, its understory in rings out to the drip line:`)
                : `Where in ${bedLabel} - an orchard of ${trees.length} trees (~${fmtLen(treeR * 2)} apart), each with its own understory rings out to the drip line:`)
            : isHills
                ? (() => {
                    const supp = chosenNow.find((c) => c.role === "support");
                    const fix = chosenNow.find((c) => c.role === "fixer");
                    const fixName = fix ? commonName(bundle, fix.sid).toLowerCase() : "climbers";
                    if (fix)
                        introMarks.push({ label: fixName, species: fix.sid });
                    const suppName = supp && supp.sid !== "trellis_structure" ? commonName(bundle, supp.sid).toLowerCase() : "";
                    if (supp && suppName)
                        introMarks.push({ label: suppName, species: supp.sid });
                    const pair = supp && supp.sid === "trellis_structure"
                        ? `the ${fixName} climb a trellis on each mound`
                        : `the ${suppName || "support crop"} and ${fixName} share each mound`;
                    return `Where in ${bedLabel} - a grid of ${mounds.length} mound${mounds.length === 1 ? "" : "s"} (~${fmtLen(1)} apart): ${pair}, the squash and ground crops fill the gaps between them:`;
                })()
                : isShelter
                    ? (() => {
                        const shade = chosenNow.find((c) => c.role === "shade");
                        const shadeName = shade ? commonName(bundle, shade.sid).toLowerCase() : "the tall crop";
                        if (shade)
                            introMarks.push({ label: shadeName, species: shade.sid });
                        const tallest = Math.max(0, ...pl.zones.filter((z) => !shelteredSet.has(z.species)).map((z) => z.height_cm ?? 0));
                        const reach = site.lat != null && tallest > 0 ? noonShadowLengthM(tallest, site.lat, referenceDoy(site.lat, site.lon ?? null, bundle)) : 0;
                        const reachText = Number.isFinite(reach) && reach > 0 ? ` (about ${fmtLen(reach)} long at midsummer here)` : "";
                        const sunSide = pl.polar === "north" ? "south" : "north";
                        return `Where in ${bedLabel} - the ${shadeName} stands on the ${sunSide} side, the sun side, so its midday shadow${reachText} falls over the greens banded to the ${pl.polar}; that shade is the point:`;
                    })()
                    : isRest
                        ? `Where in ${bedLabel} - sown across the whole bed as a cover crop to rest the ground: the legume stand banks nitrogen and crowds out weeds, shedding disease pressure before the next crop:`
                        : isGrid
                            ? (pl.zones.some((z) => z.tiled === false)
                                ? `Where in ${bedLabel} - the tall crops banded to the ${pl.polar} (so their shadow falls off the bed), the similar-height rest interplanted through the space as one mixed motif:`
                                : `Where in ${bedLabel} - one mixed planting interplanted across the bed, every crop a similar height so none shades another:`)
                            : `Where in ${bedLabel} (tallest plants to the ${pl.polar}, so their midday shadow falls off the bed instead of over a shorter neighbour):`;
        const introEl = ph("p", "window", introText, introMarks);
        mark(introEl, { kind: "rule", id: isRest ? "R-015" : isShelter ? "R-156" : "R-003" });
        const spreadR = new Map(plantRows.filter((r) => r.spread_cm).map((r) => [r.species, r.spread_cm / 200]));
        const svg = placementSvg(pl.zones, bundle, mounds, bedOutline, ringsGuide, accessBands, spreadR);
        if (svg)
            placeWrap.appendChild(svg);
        const opp = pl.polar === "north" ? "south" : "north";
        const colours = zoneColorMap(pl.zones);
        pl.zones.forEach((z, i) => {
            if (z.count === 0)
                return;
            const ord = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][i] ?? `${i}th`;
            const oneTree = trees.length === 1;
            const where = pl.polar === "radial"
                ? (i === 0 ? (centre === "centre" ? "the centre" : `the centre (the ${centre})`)
                    : i === pl.zones.length - 1 ? "the drip-line ring"
                        : centre === "tree" ? `the ${ord} ring out from the trunk` : `the ${ord} ring out from the centre`)
                : pl.polar === "orchard"
                    ? (i === 0 ? (oneTree ? "the centre (the tree)" : "one at each tree")
                        : i === pl.zones.length - 1 ? (oneTree ? "the drip-line ring" : "at the drip line of each tree")
                            : `the ${ord} ring under each tree`)
                    : pl.polar === "hills"
                        ? (z.mound ? "on the mounds" : "in the gaps between the mounds")
                        : isShelter
                            ? (shelteredSet.has(z.species) ? `the ${pl.polar} side, in the shade` : `the ${opp} side, the sun side`)
                            : isRest
                                ? (roleBySpecies.get(z.species) === "fixer" ? "the cover-crop stand - across the whole bed" : "interplanted through the stand")
                                : isGrid
                                    ? (z.tiled ? "interplanted through the bed" : `banded to the ${pl.polar}`)
                                    : (i === 0 ? `the ${pl.polar} side` : i === pl.zones.length - 1 ? `the ${opp} side` : "the middle");
            placeWrap.appendChild(placementLine(bundle, z, where, colours.get(z.species)));
        });
        ph("p", "hint", pl.polar === "hills"
            ? "Interplanted on the mound method - the species share the ground, so there's no tall-shades-short to check."
            : pl.polar === "orchard"
                ? `${trees.length === 1 ? "One tree" : `${trees.length} trees`} with a shade-adapted understory in rings - the layout this team is built around.`
                : isShelter
                    ? "The shade is on purpose here - the greens sit in the tall crop's midday shadow, which is what keeps them from bolting in summer heat."
                    : isRest
                        ? "A rest year - the legume banks nitrogen and the stand sheds disease before the next crop. Not a compromise; it's the correct move."
                        : pl.violations.length
                            ? `${pl.violations.length} spot(s) where a taller plant would shade a shorter one - worth rearranging`
                            : "Looks good - nothing tall shades a shorter plant here.");
    };
    for (const sel of roleSelects)
        sel.addEventListener("change", paintPlacement);
    paintPlacement();
    const lead = livingSupportLead(guild, bundle);
    if (lead) {
        const climber = commonName(bundle, lead.climber), support = commonName(bundle, lead.support);
        const el = h("p", "lead", `Sow the ${climber} ~${lead.lead_days} days after the ` +
            `${support} is established (~6 in tall), not with it - a vine on an ` +
            `unrooted stalk pulls it over.`, [{ label: climber, species: lead.climber }, { label: support, species: lead.support }]);
        mark(el, { kind: "rule", id: lead.rule });
    }
    for (const vn of virusNeighbours(chosenIds.map((species) => ({ species })), plotSiblings(candbedValue()), bundle)) {
        const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
        const mine = list(vn.species.map((id) => commonName(bundle, id).toLowerCase()));
        const theirs = vn.with.map((w) => `${w.bed}'s ${list(w.species.map((id) => commonName(bundle, id).toLowerCase()))}`).join(" and ");
        const ids = [...vn.species, ...vn.with.flatMap((w) => w.species)].filter((id, i, arr) => arr.indexOf(id) === i);
        const el = h("p", "lead virusnbr", `You already grow ${theirs} this season, and brambles share the same aphid-borne viruses: if that `
            + `planting shows mosaic or crumbly fruit, it is the nearest source for the ${mine} here.`, ids.map((id) => ({ label: commonName(bundle, id).toLowerCase(), species: id })));
        mark(el, { kind: "rule", id: vn.rule });
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(det);
    if (placeWrap.childNodes.length)
        frag.appendChild(placeWrap);
    return frag;
}
export async function savePlanSelection(guildId, area, btn, _bundle, _site, roles, quiet = false) {
    const sid = currentSeasonId();
    if (!app.logDb || sid == null)
        return;
    try {
        const season = await getSeason(app.logDb, app.currentPlotId, sid);
        if (!season)
            throw new Error("no open season");
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        const kept = plan.filter((e) => e.area !== area);
        kept.push({ area, guild: guildId, saved: new Date().toISOString().slice(0, 10), ...(roles && roles.length ? { roles } : {}) });
        season.plan = kept;
        await putSeason(app.logDb, season);
        countRung("team-applied");
        const needsAccount = backendConfigured() && !isSignedIn();
        if (quiet) {
        }
        else if (needsAccount) {
            toast(`Draft saved for “${area}”. A free account lets you plant and track it.`, 8000, { label: "Sign in to plant it ›", go: () => { location.hash = "#/account"; } });
            btn.textContent = `Saved as “${area}”’s plan - sign in to plant and track it`;
        }
        else {
            toast(`Draft saved for “${area}”. When it’s in the ground, mark it planted on the bed’s card.`, 8000, { label: "Mark it planted ›", go: () => window.dispatchEvent(new CustomEvent("gg-sheet-reveal", { detail: { bed: area } })) });
            btn.textContent = `Saved as “${area}”’s plan - mark it planted on the bed’s card when it’s in the ground`;
        }
        btn.disabled = true;
        void app.logRefresh?.();
        window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: area, kind: "team" } }));
    }
    catch (e) {
        btn.textContent = `${e instanceof Error ? e.message : e}`;
    }
}
export function mergeSurvivingDetail(existing, fresh, bedRegion) {
    const isLiveOnBed = (p) => !p.end_cause && p.carried_over !== true && plantingOnBed(p.region, bedRegion);
    const live = existing.filter(isLiveOnBed);
    const rest = existing.filter((p) => !isLiveOnBed(p));
    const merged = fresh.map((f) => {
        const i = live.findIndex((p) => p.species === f.species
            && (p.cultivar_group ?? null) === (f.cultivar_group ?? null));
        if (i < 0)
            return f;
        const [old] = live.splice(i, 1);
        return { ...old, region: f.region };
    });
    return { rest, merged };
}
function materializeDraftInto(target, bed, guild, site, bundle, today, overrides) {
    const fresh = guildPlantings(guild, bed, site, bundle, overrides).map((p) => ({ ...p, sown: today }));
    const { rest, merged } = mergeSurvivingDetail(target.plantings ?? [], fresh, bed.region);
    target.plantings = [...rest, ...merged];
    target.plan = (Array.isArray(target.plan) ? target.plan : []).filter((e) => e.area !== bed.name);
    const pf = (Array.isArray(target.planted_from) ? target.planted_from : [])
        .filter((r) => r.area !== bed.name);
    target.planted_from = [...pf, { area: bed.name, guild: guild.id }];
    return merged.length;
}
function materializeMyBedDraft(target, bedRegion, bedName, draftPlantings, today) {
    const fresh = draftPlantings.map((p) => ({ ...p, sown: today }));
    const { rest, merged } = mergeSurvivingDetail(target.plantings ?? [], fresh, bedRegion);
    target.plantings = [...rest, ...merged];
    target.plan = (Array.isArray(target.plan) ? target.plan : []).filter((e) => e.area !== bedName);
    return merged.length;
}
export async function markBedPlanted(bedName, bundle, site) {
    const sid = currentSeasonId();
    if (!app.logDb || sid == null)
        return { ok: false, reason: "the garden log isn’t ready yet - try again in a moment" };
    const season = await getSeason(app.logDb, app.currentPlotId, sid);
    if (!season)
        return { ok: false, reason: "no open season" };
    const entry = (Array.isArray(season.plan) ? season.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    const myBedDraft = entry?.mybed === true && Array.isArray(entry.plantings) ? entry.plantings : null;
    if (!bed)
        return { ok: false, reason: "that bed isn’t on the map any more" };
    if (!guild && !myBedDraft)
        return { ok: false, reason: "this bed has no draft plan to plant - choose a plant team, or design it yourself, on the Plan tab first" };
    const today = new Date().toISOString().slice(0, 10);
    const todayYear = Number(today.slice(0, 4));
    if (todayYear !== season.id) {
        return { ok: false, canAdvanceTo: todayYear,
            reason: `You’re planting in ${todayYear}, but the open season is ${season.id}. Start the ${todayYear} season and plant there, so its dates land in the right year.` };
    }
    const planted = myBedDraft
        ? materializeMyBedDraft(season, bed.region, bedName, myBedDraft, today)
        : materializeDraftInto(season, bed, guild, site, bundle, today, roleOverridesOf(entry));
    await putSeason(app.logDb, season);
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, true);
    return { ok: true, planted };
}
export async function markBedPlantedAdvancingSeason(bedName, bundle, site) {
    const openId = currentSeasonId();
    if (!app.logDb || openId == null)
        return { ok: false, reason: "the garden log isn’t ready yet - try again in a moment" };
    const open = await getSeason(app.logDb, app.currentPlotId, openId);
    const entry = (Array.isArray(open?.plan) ? open.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    const myBedDraft = entry?.mybed === true && Array.isArray(entry.plantings) ? entry.plantings : null;
    if (!bed)
        return { ok: false, reason: "that bed isn’t on the map any more" };
    if (!guild && !myBedDraft)
        return { ok: false, reason: "this bed has no draft plan to plant - choose a plant team, or design it yourself, on the Plan tab first" };
    const today = new Date().toISOString().slice(0, 10);
    const todayYear = Number(today.slice(0, 4));
    const target0 = (await getSeason(app.logDb, app.currentPlotId, todayYear))
        ?? { id: todayYear, plot: app.currentPlotId, plantings: [], observations: [] };
    const target = seedNextPlan(open, target0);
    const planted = myBedDraft
        ? materializeMyBedDraft(target, bed.region, bedName, myBedDraft, today)
        : materializeDraftInto(target, bed, guild, site, bundle, today, roleOverridesOf(entry));
    await putSeason(app.logDb, target);
    if (open && openId !== todayYear) {
        open.plan = (Array.isArray(open.plan) ? open.plan : []).filter((e) => e.area !== bedName);
        await putSeason(app.logDb, open);
    }
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, true);
    return { ok: true, planted, seasonId: todayYear };
}
async function revertBedToDraft(bedName) {
    const sid = currentSeasonId();
    if (!app.logDb || sid == null)
        return { ok: false, reason: "the garden log isn’t ready yet - try again in a moment" };
    const season = await getSeason(app.logDb, app.currentPlotId, sid);
    if (!season)
        return { ok: false, reason: "no open season" };
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return { ok: false, reason: "that bed isn’t on the map any more" };
    const isLiveOnBed = (p) => !p.end_cause && p.carried_over !== true && plantingOnBed(p.region, bed.region);
    const removed = (season.plantings ?? []).filter(isLiveOnBed).length;
    season.plantings = (season.plantings ?? []).filter((p) => !isLiveOnBed(p));
    const pf = (Array.isArray(season.planted_from) ? season.planted_from : []);
    const rec = pf.find((r) => r.area === bedName);
    if (rec?.guild) {
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        if (!plan.some((e) => e.area === bedName))
            plan.push({ area: bedName, guild: rec.guild });
        season.plan = plan;
        season.planted_from = pf.filter((r) => r.area !== bedName);
    }
    await putSeason(app.logDb, season);
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, false);
    return { ok: true, removed, team: rec?.guild ?? null };
}
export function offSeasonNudge(guild, bundle, lastFrost, firstFreeze, todayISO) {
    if (!lastFrost && !firstFreeze)
        return null;
    const today = todayISO.slice(5);
    const byId = new Map(bundle.species.map((s) => [s.id, s]));
    const refs = [];
    for (const r of (guild.roles ?? []))
        if (typeof r.canonical === "string")
            refs.push({ sid: r.canonical, group: typeof r.canonical_group === "string" ? r.canonical_group : null });
    for (const m of guild.members ?? [])
        if (typeof m.species === "string")
            refs.push({ sid: m.species, group: typeof m.group === "string" ? m.group : null });
    const nm = (sid) => commonName(bundle, sid) || humanize(sid);
    const list = (crops) => {
        const u = [];
        for (const c of crops) {
            const label = nm(c.sid);
            if (!u.some((x) => x.label === label))
                u.push({ label, sid: c.sid, group: c.group });
        }
        const named = u.length <= 2 ? u : u.slice(0, 2);
        const text = u.length <= 2
            ? named.map((x) => x.label).join(" and ")
            : `${named.map((x) => x.label).join(", ")}, and ${u.length - 2} more`;
        return { text, marks: named.map((x) => ({ label: x.label, species: x.sid, group: x.group })) };
    };
    const isTender = (sp) => sp.frost_tolerance !== "hardy" && sp.frost_tolerance !== "half_hardy";
    const tenderCrops = () => refs.filter((r) => { const sp = byId.get(r.sid); return !!sp && isTender(sp); });
    if (lastFrost && today < lastFrost) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: `Heads up: your last spring frost (around ${humanizeMMDD(lastFrost)}) hasn’t passed yet. Frost-tender crops here (${l.text}) can be set back or killed by a late frost. You can plant anyway, or wait until after it.`, marks: l.marks };
    }
    if (firstFreeze && today > firstFreeze) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: `Heads up: your first fall freeze (around ${humanizeMMDD(firstFreeze)}) has already passed - it’s late to plant ${l.text} outdoors. You can plant anyway, or start next season instead.`, marks: l.marks };
    }
    if (firstFreeze) {
        const late = [];
        for (const r of refs) {
            const sp = byId.get(r.sid);
            if (!sp || sp.scheduling_model !== "dtm")
                continue;
            let dtm = sp.days_to_maturity;
            const groups = sp.cultivar_groups;
            if (r.group && Array.isArray(groups)) {
                const g = groups.find((cg) => cg.id === r.group);
                if (g && Array.isArray(g.days_to_maturity))
                    dtm = g.days_to_maturity;
            }
            if (!Array.isArray(dtm) || typeof dtm[0] !== "number")
                continue;
            const [mm, dd] = today.split("-").map(Number);
            const mat = new Date(2001, mm - 1, dd + dtm[0]);
            const matMd = mat.getFullYear() !== 2001 ? null : `${String(mat.getMonth() + 1).padStart(2, "0")}-${String(mat.getDate()).padStart(2, "0")}`;
            if (!matMd || matMd > firstFreeze)
                late.push({ sid: r.sid, group: r.group });
        }
        if (late.length) {
            const l = list(late);
            return { text: `Heads up: planting today, ${l.text} likely won’t reach maturity before your first freeze (around ${humanizeMMDD(firstFreeze)}). You can still plant - just know the harvest window is tight.`, marks: l.marks };
        }
    }
    return null;
}
export function historySource(bundle) {
    const priorSeasons = pastSeasons();
    const bedName = ($("candbed")).value;
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return { history: null, source: { kind: "none" } };
    const derived = deriveHistory(bed.region, priorSeasons, activeBundle(bundle));
    const tracked = derived.contributions.length > 0;
    const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, bed.region);
    const history = Object.keys(merged.history).length ? merged.history : null;
    return { history, source: { kind: "derived", bed: bed.name, derived: merged, tracked, declaredYear: declaredPriorYear() } };
}
export function renderEligibility(bundle, site, source) {
    const panel = $("eligibility");
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
        p(`This ground's history - bed "${source.bed}"${anyDeclared ? ", logged occupancy + what you declared grew here" : " ∩ what you logged"}:`, "provenance");
        if (site.season_year != null) {
            p(`Planting year ${site.season_year} (your open season) - rotation intervals count back from it.`, "provenance");
        }
        const isUserVariety = (sid) => app.userSpecies.some((u) => u.id === sid);
        for (const c of d.contributions) {
            if (c.species === "") {
                p(`· ${c.season}: ${familyName(c.family)} (declared)`, "provenance");
                continue;
            }
            const line = p(`· ${c.season}: ${familyName(c.family)} (`, "provenance");
            const name = commonName(bundle, c.species);
            if (!isUserVariety(c.species))
                line.appendChild(plantLink(name, c.species));
            else
                line.appendChild(document.createTextNode(name));
            line.appendChild(document.createTextNode(`, ${fmtArea(c.overlap_m2)} overlap)`));
        }
        if (d.unknown_species.length) {
            p(`logged species we don't know (carried nothing): ${d.unknown_species.map(humanize).join(", ")}`, "provenance");
        }
        if (!d.contributions.length) {
            p("Nothing logged or declared overlaps this bed - clean ground as far as we know.");
        }
    }
    const carried = Object.values(site.history ?? {}).flat();
    if (!carried.length) {
        if (source.kind === "none") {
            p("Log a season (the Log tab) and history derives itself - or tick what grew here recently.");
        }
        return;
    }
    const res = eligibleSpecies(site, bundle);
    const carriedFams = carried.map((e) => (typeof e === "string" ? e : e.family));
    p(`This bed grew ${[...new Set(carriedFams)].map(familyName).join(", ")} recently - ${res.eligible.length} plants are a fine choice now, ${res.blocked.length} are best avoided here for a while:`);
    for (const b of res.blocked) {
        const why = b.blocked_by.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ");
        const label = commonName(bundle, b.species);
        const line = p("", "blocked");
        linkNameIn(line, `${label} - ${why}`, label, b.species);
        for (const r of b.blocked_by)
            if (r.rule)
                mark(line, { kind: "rule", id: r.rule });
    }
    for (const s of res.suggestions) {
        const el = p(`Not many good options here - a ${s.families.map(familyName).join(" or ")} break would help: ${stripRuleCitations(humanizeFamilies(s.why))}.`, "suggest");
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
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(d.footprint.w * s) + 8));
    svg.setAttribute("height", String(Math.ceil(d.footprint.h * s) + 8));
    const rect = (r, cls, title) => {
        const el = document.createElementNS(SVG_NS, "rect");
        el.setAttribute("x", String(4 + r.x * s));
        el.setAttribute("y", String(4 + r.y * s));
        el.setAttribute("width", String(r.w * s));
        el.setAttribute("height", String(r.h * s));
        el.setAttribute("class", cls);
        const t = document.createElementNS(SVG_NS, "title");
        t.textContent = title;
        el.appendChild(t);
        svg.appendChild(el);
    };
    rect(d.bed, "bed", `your bed: ${fmtLen(bedW)} × ${fmtLen(bedL)}`);
    rect(d.footprint, fits ? "fp ok" : "fp over", `this plant team needs ${fmtArea(fmin ?? 0)} (at your bed's proportions)`);
    return svg;
}
function ringSvg(bedW, bedL, fmin, fits) {
    const ring = radialRingsFromFootprint(fmin ?? 0);
    if (!ring)
        return null;
    const dia = 2 * ring.r;
    const PX = 90;
    const s = PX / Math.max(bedW, bedL, dia);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(Math.max(bedW, dia) * s) + 8));
    svg.setAttribute("height", String(Math.ceil(Math.max(bedL, dia) * s) + 8));
    const bed = document.createElementNS(SVG_NS, "rect");
    bed.setAttribute("x", "4");
    bed.setAttribute("y", "4");
    bed.setAttribute("width", String(bedW * s));
    bed.setAttribute("height", String(bedL * s));
    bed.setAttribute("class", "bed");
    const bt = document.createElementNS(SVG_NS, "title");
    bt.textContent = `your bed: ${fmtLen(bedW)} × ${fmtLen(bedL)}`;
    bed.appendChild(bt);
    svg.appendChild(bed);
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(4 + (bedW * s) / 2));
    circle.setAttribute("cy", String(4 + (bedL * s) / 2));
    circle.setAttribute("r", String(ring.r * s));
    circle.setAttribute("class", fits ? "fp ok" : "fp over");
    const ct = document.createElementNS(SVG_NS, "title");
    ct.textContent = `drip-line ring ~${fmtLen(dia)} across (${fmtArea(fmin ?? 0)})`;
    circle.appendChild(ct);
    svg.appendChild(circle);
    return svg;
}
function pickedBedStructure() {
    const name = $("candbed")?.value ?? "";
    return app.logSnapshot.beds.find((b) => b.name === name)?.structure;
}
let guildFocus = null;
let guildMiss = null;
let guildFocusScrolled = false;
let nofitsOpen = false;
let allTeamsOpen = false;
export function setGuildFocus(id, known = true) {
    if (id == null) {
        guildFocus = null;
        guildMiss = null;
        return;
    }
    if (known) {
        guildFocus = id;
        guildMiss = null;
        guildFocusScrolled = false;
    }
    else {
        guildFocus = null;
        guildMiss = id;
    }
}
const missText = {
    absent: (id) => `That link pointed to a team we don't carry (${id}). Pick one below.`,
    unplannable: (id) => `That link pointed to a team we can't plan on a bed (${id}). Pick one below.`,
};
function guildMissNote(text) {
    const miss = document.createElement("p");
    miss.className = "guildmiss";
    miss.textContent = text;
    return miss;
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
    back.className = "stepnext teamslock-back";
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
    h.textContent = "First, make a bed to design";
    const body = document.createElement("p");
    body.className = "teamslock-body";
    body.textContent = "Designing your own bed arranges plants on a real bed — its size and shape. "
        + "Size or draw one up in “Beds” and you can lay it out here.";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "stepnext teamslock-back";
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
export function flashBedRow() {
    const row = document.querySelector(".dimbed");
    if (!row)
        return;
    row.classList.remove("flashcue");
    void row.offsetWidth;
    row.classList.add("flashcue");
    setTimeout(() => row.classList.remove("flashcue"), 1200);
}
export const GUILD_GUIDE = {
    three_sisters: { slug: "build-a-three-sisters-mound", label: "How to build a Three Sisters mound" },
    milpa: { slug: "what-is-a-milpa", label: "What is a milpa?" },
};
const FIRST_BED_W = 1.2192, FIRST_BED_L = 2.4384;
function firstBedLead(bundle) {
    const reg = { shape: "rect", x: 0, y: 0, w: FIRST_BED_W, h: FIRST_BED_L };
    const st = (g) => guildStatus(g, FIRST_BED_W, FIRST_BED_L, bundle, "raised", reg);
    const fitting = browsableGuilds(bundle).filter((g) => st(g).fits);
    if (!fitting.length)
        return null;
    const ranked = fitting.map((g, i) => ({ g, i }))
        .sort((a, b) => (shortlistRank(a.g.derived_harmony?.band, st(a.g).tier) - shortlistRank(b.g.derived_harmony?.band, st(b.g).tier)) || a.i - b.i);
    return ranked[0].g;
}
export function proposeFirstBed(bundle, site) {
    const host = document.getElementById("firstbed");
    if (!host)
        return;
    if (app.groundProposalTaken?.()) {
        host.hidden = true;
        return;
    }
    const lead = firstBedLead(bundle);
    if (!lead) {
        host.hidden = true;
        return;
    }
    const sub = document.getElementById("fb-sub");
    if (sub)
        sub.textContent = `A ${fmtLen(FIRST_BED_W)} × ${fmtLen(FIRST_BED_L)} raised bed, placed for you. Change anything by touching it.`;
    const team = document.getElementById("fb-team");
    if (team) {
        const claim = mechanismRows(lead, bundle).rows[0]?.claim ?? null;
        team.textContent = claim ? `${displayName(lead)}: ${stripRuleCitations(claim).replace(/\.$/, "")}.` : displayName(lead);
    }
    const first = document.getElementById("fb-first");
    if (first) {
        const year = currentSeasonId() ?? new Date().getFullYear();
        const todayIso = new Date().toISOString().slice(0, 10);
        const tasks = gardenTasks(lead, site.lat ?? null, site.lon ?? null, year, bundle).slice().sort((a, b) => a.date.localeCompare(b.date));
        const t0 = tasks.find((t) => t.date >= todayIso) ?? null;
        if (t0) {
            const what = t0.kind === "sow_climber" ? "sow the climber" : t0.kind === "install_support" ? "put the support in" : "plant after your last frost";
            first.textContent = `First job: ${dayWord(t0.date)}, ${what}.`;
            first.hidden = false;
        }
        else if (tasks.length) {
            first.textContent = "This year’s planting window here has passed - keep the bed and it’s ready come spring.";
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
    if (keep)
        keep.dataset.lead = lead.id;
    const other = document.getElementById("fb-other");
    if (other && !other.dataset.wired) {
        other.dataset.wired = "1";
        other.addEventListener("click", () => void otherTeamFirstBed());
    }
    const resize = document.getElementById("fb-resize");
    if (resize && !resize.dataset.wired) {
        resize.dataset.wired = "1";
        resize.addEventListener("click", () => {
            const nameEl = document.getElementById("areaname");
            if (nameEl && !nameEl.value.trim())
                nameEl.value = nextBedName(app.logSnapshot.beds);
            app.groundEditProposal?.();
        });
    }
    host.hidden = false;
    app.groundProposeRect?.(FIRST_BED_W, FIRST_BED_L, "raised", site.lat ?? 0);
}
async function makeFirstBed() {
    if (!app.logDb)
        return null;
    const beds = app.logSnapshot.beds;
    const name = nextBedName(beds);
    const kept = (await app.groundKeepProposal?.(name)) ?? false;
    if (!kept) {
        const o = nextOrigin(beds);
        countRung("bed-saved");
        await placeBed(app.logDb, app.currentPlotId, name, { shape: "rect", x: o.x, y: o.y, w: Math.round(FIRST_BED_W * 100) / 100, h: Math.round(FIRST_BED_L * 100) / 100 }, undefined, null, "raised", true);
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
async function keepFirstBed(bundle, site, btn) {
    btn.disabled = true;
    try {
        const leadId = btn.dataset.lead;
        const name = await makeFirstBed();
        if (!name) {
            btn.disabled = false;
            btn.textContent = "The garden log isn’t ready yet - try again in a moment";
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
    if (name)
        window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "step-plan" } }));
}
export function renderGuilds(bundle, site) {
    const list = $("guilds");
    list.innerHTML = "";
    {
        const h = document.createElement("p");
        h.className = "glosshint";
        h.appendChild(document.createTextNode("New here? A "));
        h.appendChild(glossTerm("team", "plant team"));
        h.appendChild(document.createTextNode(" is the unit this step works in, and the "));
        h.appendChild(glossTerm("fit", "fit verdict"));
        h.appendChild(document.createTextNode(" tells you whether a bed can take one."));
        list.appendChild(h);
    }
    app.markBedPlantedFromPlan = async (bedName, opts) => {
        const season = activeSeason();
        const now = new Date();
        if (season && !opts?.advance && now.getFullYear() !== season.id) {
            const yr = now.getFullYear();
            return { ok: false, canAdvanceTo: yr,
                reason: `You’re planting in ${yr}, but the open season is ${season.id}. Starting the ${yr} season keeps this planting's dates in the right year.` };
        }
        if (season && !opts?.advance && !opts?.force) {
            const entry = (Array.isArray(season.plan) ? season.plan : []).find((e) => e.area === bedName);
            const draftGuild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) ?? null : null;
            const csite = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle)?.site ?? null : null;
            const nudge = draftGuild ? offSeasonNudge(draftGuild, bundle, csite?.last_frost_32f?.p50 ?? null, csite?.first_freeze_32f_p50 ?? null, now.toISOString().slice(0, 10)) : null;
            if (nudge)
                return { ok: false, nudge: nudge.text };
            const bedRec = app.logSnapshot.beds.find((b) => b.name === bedName);
            if (draftGuild && bedRec) {
                const fresh = guildPlantings(draftGuild, bedRec, site, bundle, roleOverridesOf(entry));
                const { merged } = mergeSurvivingDetail(season.plantings ?? [], fresh, bedRec.region);
                const kept = merged.filter((m) => !fresh.includes(m) && !!(m.sown || m.transplanted)).length;
                if (kept > 0) {
                    const added = merged.length - kept;
                    return { ok: false, nudge: `${kept} of this team's plants ${kept === 1 ? "is" : "are"} already in the ground here - they keep their own dates, and this adds the other ${added} dated today.` };
                }
            }
        }
        const r = opts?.advance ? await markBedPlantedAdvancingSeason(bedName, bundle, site) : await markBedPlanted(bedName, bundle, site);
        if (r.ok) {
            await app.logRefresh?.();
            const newId = "seasonId" in r ? r.seasonId : undefined;
            if (typeof newId === "number" && currentSeasonId() !== newId) {
                setSeasonId(newId);
                await app.logRefresh?.();
            }
            app.groundRedraw?.();
            return { ok: true };
        }
        return { ok: false, reason: r.reason, canAdvanceTo: r.canAdvanceTo };
    };
    app.revertBedToDraftFromPlan = async (bedName) => {
        const r = await revertBedToDraft(bedName);
        if (r.ok) {
            await app.logRefresh?.();
            app.groundRedraw?.();
            return { ok: true, removed: r.removed ?? 0 };
        }
        return { ok: false, reason: r.reason };
    };
    app.teamLabel = (id) => { const g = bundle.guilds.find((x) => x.id === id); return g ? displayName(g) : null; };
    app.focusTeam = (id) => { setGuildFocus(id); renderGuilds(bundle, site); };
    app.openBedSheet = (bedName) => {
        const sheet = document.getElementById("bedsheet");
        const body = document.getElementById("bedsheetbody");
        if (!sheet || !body)
            return;
        const season = activeSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        const pfGuildId = !entry?.guild
            ? (season?.planted_from ?? [])
                .find((r) => r.area === bedName)?.guild
            : undefined;
        const plantedGuild = pfGuildId ? bundle.guilds.find((g) => g.id === pfGuildId) : undefined;
        if (!bed) {
            toast("that bed isn't on the map any more");
            return;
        }
        const liveOnBed = (Array.isArray(season?.plantings) ? season.plantings : [])
            .filter((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
        if (!guild && liveOnBed.length === 0) {
            toast("this bed has no plants yet - choose a team, or plant it, first");
            return;
        }
        body.replaceChildren();
        const pts = regionPoints(bed.region);
        const bw = Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]));
        const bl = Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
        const fmtDate = (iso) => {
            const d = new Date(`${iso}T12:00:00Z`);
            return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
        };
        const seasonYear = currentSeasonId() ?? new Date().getFullYear();
        el(body, "p", "bedsheet-kicker", `The ${seasonYear} planting`);
        el(body, "h1", "bedsheet-h1", bed.name);
        el(body, "p", "bedsheet-sub", [guild ? displayName(guild) : plantedGuild ? displayName(plantedGuild) : "Planted", `${fmtLen(bw)} × ${fmtLen(bl)}`,
            bed.structure ? humanize(bed.structure) : null,
            bed.sun === "full" ? "full sun" : bed.sun === "part_shade" ? "part shade" : null].filter(Boolean).join(" · "));
        const skinSeason = document.documentElement.dataset.season ?? "autumn";
        const voiceKey = `homeVoice${skinSeason.charAt(0).toUpperCase()}${skinSeason.slice(1)}`;
        const seasonalLine = (copy[voiceKey] ?? copy.homeVoiceAutumn);
        const voiceTeam = guild ?? plantedGuild;
        const lead = voiceTeam ? (mechanismRows(voiceTeam, bundle).rows[0]?.claim ?? null) : null;
        const voiceLine = voiceTeam && lead ? `${displayName(voiceTeam)}: ${stripRuleCitations(lead).replace(/\.$/, "")}.` : seasonalLine;
        if (voiceLine)
            el(body, "p", "bedsheet-voice", voiceLine);
        {
            const orn = document.createElementNS(SVG_NS, "svg");
            orn.setAttribute("class", "sprig-orn bedsheet-orn");
            orn.setAttribute("viewBox", "0 0 24 24");
            orn.setAttribute("aria-hidden", "true");
            const u = document.createElementNS(SVG_NS, "use");
            u.setAttribute("href", "#sprig");
            orn.appendChild(u);
            body.appendChild(orn);
        }
        const prevSeason = seasonById((currentSeasonId() ?? 0) - 1);
        const todayIso = new Date().toISOString().slice(0, 10);
        const glimpse = guild
            ? guildPlacementGlimpse(guild, bed, site, bundle, roleOverridesOf(entry))
            : bedPlate(bed, season ?? null, prevSeason, todayIso, (r) => plantingOnBed(r, bed.region));
        if (glimpse) {
            const fig = el(body, "figure", "bedsheet-fig");
            glimpse.svg.setAttribute("role", "img");
            glimpse.svg.setAttribute("aria-label", guild ? `where each plant goes in ${bed.name}` : `what is planted in ${bed.name}`);
            fig.appendChild(glimpse.svg);
            const cap = document.createElement("figcaption");
            cap.textContent = guild ? "Where each plant goes - north is up." : "What's in this bed - north is up.";
            fig.appendChild(cap);
            const ul = el(body, "ul", "bedsheet-legend");
            if (!guild && "model" in glimpse) {
                plateKeyInto(ul, plateKey(glimpse.model, (sid) => commonName(bundle, sid)), { tag: "li", counts: true });
            }
            else {
                for (const pl of glimpse.plants) {
                    const li = document.createElement("li");
                    const colour = pl.colour;
                    if (colour) {
                        const sw = document.createElement("i");
                        sw.className = "sw";
                        sw.style.background = colour;
                        li.append(sw);
                    }
                    li.append(document.createTextNode(`${colour ? " " : ""}${commonName(bundle, pl.species)} × ${pl.count}`));
                    ul.appendChild(li);
                }
            }
        }
        if (guild) {
            const buyH = el(body, "h2", "bedsheet-h2", "To gather");
            const buyList = el(body, "ul", "bedsheet-buy");
            void app.planReceipt?.(bedName).then((r) => {
                if (!r)
                    return;
                if (!r.sized) {
                    buyH.textContent = "Not sized yet - set a location on the Where step";
                    return;
                }
                if (r.toBuy === 0) {
                    buyH.textContent = "Your seed box covers it - nothing to buy";
                    return;
                }
                for (const k of r.kinds) {
                    const li = document.createElement("li");
                    li.textContent = `${k.label} × ${k.n}${k.owned ? " - in your seed box" : ""}`;
                    buyList.appendChild(li);
                }
            });
        }
        else {
            const sownDates = liveOnBed.map((p) => p.sown).filter((s) => !!s).sort();
            if (sownDates.length)
                el(body, "p", "bedsheet-note", `Planted ${fmtDate(sownDates[0])}`);
        }
        el(body, "h2", "bedsheet-h2", "Through the season");
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle)?.site ?? null : null;
        const lf = clim?.last_frost_32f?.p50, ff = clim?.first_freeze_32f_p50;
        if (lf || ff)
            el(body, "p", "bedsheet-season", [lf ? `last frost usually ${fmtDate(`${seasonYear}-${lf}`)}` : null, ff ? `first freeze usually ${fmtDate(`${seasonYear}-${ff}`)}` : null].filter(Boolean).join(" · "));
        const tl = el(body, "ul", "bedsheet-tasks");
        if (guild) {
            const tasks = gardenTasks(guild, site.lat ?? null, site.lon ?? null, seasonYear, bundle).slice().sort((a, b) => a.date.localeCompare(b.date));
            if (!tasks.length) {
                const li = document.createElement("li");
                li.textContent = NO_DATES_YET;
                tl.appendChild(li);
            }
            for (const t of tasks) {
                const li = document.createElement("li");
                const what = t.kind === "sow_climber" ? `sow ${t.species ? commonName(bundle, t.species) : "the climber"}${t.support ? ` (its support: ${commonName(bundle, t.support)})` : ""}`
                    : t.kind === "install_support" ? `put the support in${t.species ? ` (${commonName(bundle, t.species)})` : ""}`
                        : t.kind === "log_first_freeze" ? "note the first freeze" : "plant after last frost";
                li.textContent = `${fmtDate(t.date)} - ${what}`;
                tl.appendChild(li);
            }
        }
        else {
            const jobs = app.bedCalendarJobs?.(bedName, seasonYear) ?? [];
            if (!jobs.length) {
                const li = document.createElement("li");
                li.textContent = site.lat == null ? NO_DATES_YET : "Nothing dated for this bed yet - the Calendar fills in as the season turns.";
                tl.appendChild(li);
            }
            for (const j of jobs) {
                const li = document.createElement("li");
                li.textContent = `${fmtDate(j.date)} - ${j.text}`;
                tl.appendChild(li);
            }
        }
        el(body, "p", "bedsheet-foot", `Grown from Milpa Gardens · ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`);
        sheet.hidden = false;
        document.body.classList.add("bedsheet-open");
        bedSheetOpener = document.activeElement;
        for (const child of Array.from(document.body.children)) {
            if (child !== sheet) {
                child.setAttribute("inert", "");
                child.setAttribute("aria-hidden", "true");
            }
        }
        window.scrollTo(0, 0);
        document.getElementById("bedsheetclose")?.focus();
    };
    if (!app.bedSheetWired) {
        app.bedSheetWired = true;
        const close = () => {
            const sheet = document.getElementById("bedsheet");
            if (sheet)
                sheet.hidden = true;
            document.body.classList.remove("bedsheet-open");
            for (const child of Array.from(document.body.children)) {
                if (child !== sheet) {
                    child.removeAttribute("inert");
                    child.removeAttribute("aria-hidden");
                }
            }
            bedSheetOpener?.focus?.();
            bedSheetOpener = null;
        };
        document.getElementById("bedsheetclose")?.addEventListener("click", close);
        document.getElementById("bedsheetprint")?.addEventListener("click", () => window.print());
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("bedsheet-open"))
            close(); });
    }
    app.plannedSpotFor = (bedName, species) => {
        const season = activeSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return null;
        const hit = placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(entry)).find((p) => p.species === species);
        return hit ? { x: hit.x, y: hit.y, r: hit.r, group: hit.group } : null;
    };
    const bedPlantWindowFor = (bedName) => {
        const season = activeSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return { status: "none", first: null };
        const seasonYear = currentSeasonId() ?? new Date().getFullYear();
        const todayIso = new Date().toISOString().slice(0, 10);
        if (seasonYear !== Number(todayIso.slice(0, 4)))
            return { status: "open", first: null };
        const PLANTING = new Set(["plant_after_last_frost", "sow_climber", "install_support"]);
        const tasks = gardenTasks(guild, site.lat ?? null, site.lon ?? null, seasonYear, bundle)
            .filter((t) => PLANTING.has(t.kind)).slice().sort((a, b) => a.date.localeCompare(b.date));
        if (!tasks.length)
            return { status: "none", first: null };
        const t0 = tasks.find((t) => t.date >= todayIso) ?? null;
        if (t0) {
            const what = t0.kind === "sow_climber" ? "sow the climber" : t0.kind === "install_support" ? "put the support in" : "plant after last frost";
            return { status: "open", first: { date: t0.date, what } };
        }
        const placed = placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(entry));
        const win = plantingWindowFor(site.lat ?? null, site.lon ?? null, placed.map((p) => p.species), bundle);
        const ff = win?.first_freeze_p50 ?? null;
        let teamDtm = null;
        for (const r of spacingRows(placed.map((p) => [p.species, p.group ?? null]), bundle))
            if (r.days_to_maturity != null)
                teamDtm = Math.max(teamDtm ?? 0, r.days_to_maturity);
        if (ff && teamDtm != null) {
            const daysLeft = Math.round((Date.parse(`${seasonYear}-${ff}T12:00:00Z`) - Date.parse(`${todayIso}T12:00:00Z`)) / 86_400_000);
            if (teamDtm > daysLeft)
                return { status: "passed", first: null };
        }
        return { status: "open", first: null };
    };
    app.bedPlantWindow = (bedName) => bedPlantWindowFor(bedName);
    app.planReceipt = async (bedName) => {
        const season = activeSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return null;
        const placed = placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(entry));
        const counts = new Map();
        for (const p of placed)
            counts.set(p.species, (counts.get(p.species) ?? 0) + 1);
        let owned = new Set();
        try {
            if (app.logDb)
                owned = new Set((await listSeeds(app.logDb)).map((sd) => sd.species));
        }
        catch { }
        const kinds = [...counts.entries()].map(([sid, n]) => ({ label: commonName(bundle, sid), n, owned: owned.has(sid) }))
            .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
        const win = bedPlantWindowFor(bedName);
        return { sized: placed.length > 0, plants: placed.length, kinds, toBuy: kinds.filter((k) => !k.owned).length,
            areaNeededM2: guild.footprint_min_m2 ?? null, bedAreaM2: regionArea(bed.region),
            first: win.first, keptForSpring: win.status === "passed" };
    };
    if (app.logSnapshot.beds.length === 0) {
        list.appendChild(teamsLockNote());
        return;
    }
    if (guildMiss)
        list.appendChild(guildMissNote(missText.absent(guildMiss)));
    {
        const allBeds = app.logSnapshot.beds;
        const plannable = allBeds.filter((b) => !bedHasSections(b.name, allBeds));
        const block = plotBlock(bundle, plannable);
        if (block)
            list.appendChild(block);
    }
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
            bits.push(sun === "full" ? "full sun" : "part shade");
        let hist = "";
        const seasons = Object.keys(site.history ?? {}).sort();
        const last = seasons[seasons.length - 1];
        if (last) {
            const fams = [...new Set((site.history?.[last] ?? [])
                    .map((e) => (typeof e === "string" ? e : e.family)))];
            if (fams.length)
                hist = ` - after ${last}'s ${fams.map(familyName).join(" + ")}`;
        }
        basis.appendChild(document.createTextNode(`For your ${bits.join(" · ")} bed${hist}`));
        list.appendChild(basis);
    }
    const promotedByParent = new Map();
    for (const parent of greyed) {
        const kids = derivedGuilds(parent.id, bundle).filter((v) => st(v).fits);
        if (kids.length)
            promotedByParent.set(parent.id, kids);
    }
    const buildCard = (guild, promotedFrom = null, lead = false) => {
        const card = guildCard(guild, site, bundle, bw, bl, false, lead, promotedFrom);
        const status = st(guild);
        const body = (card.querySelector(".teambody") ?? card);
        const hoisted = promotedByParent.get(guild.id) ?? [];
        if (hoisted.length) {
            const up = document.createElement("p");
            up.className = "upref";
            up.textContent = `A smaller version fits your bed - ${hoisted.map(displayName).join(", ")}, above.`;
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
            label.textContent = `Variants of ${displayName(guild)} (${variants.length}):`;
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
            gl.textContent = `${gg.label} →`;
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
        b.className = "cmpbtn tertiary";
        const on = compareIds.includes(g.id);
        b.setAttribute("aria-pressed", String(on));
        b.textContent = on ? "Comparing" : "Compare";
        b.title = on ? "take this team out of the comparison" : "put this team side by side with others";
        b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (compareIds.includes(g.id))
                compareIds = compareIds.filter((x) => x !== g.id);
            else if (compareIds.length >= COMPARE_MAX) {
                toast(`Three at a time - take one out to add ${displayName(g)}`);
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
        const seasonYear = currentSeasonId() ?? new Date().getFullYear();
        const tasks = gardenTasks(g, site.lat ?? null, site.lon ?? null, seasonYear, bundle).slice().sort((a, b) => a.date.localeCompare(b.date));
        const win = plantingWindowFor(site.lat ?? null, site.lon ?? null, chosen.map((c) => c[0]), bundle);
        const dtms = spacingRows(chosen, bundle).map((r) => r.days_to_maturity).filter((d) => d != null);
        return {
            fit: s0.fits ? (s0.tier ? TIER_UI[s0.tier].label : "fits") : "won’t fit",
            band: harmonyBand(g).label,
            plants: placedN,
            jobs: n,
            first: tasks[0] ?? null,
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
        title.textContent = compareIds.length >= 2 ? `Side by side for “${bedNameNow}”` : "Comparing";
        head.appendChild(title);
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "tertiary cmpclear";
        clear.textContent = "Clear";
        clear.addEventListener("click", () => { compareIds = []; renderGuilds(bundle, site); });
        head.appendChild(clear);
        panel.appendChild(head);
        if (compareIds.length < 2) {
            const hint = document.createElement("p");
            hint.className = "compare-hint";
            hint.textContent = `${displayName(fittingById.get(compareIds[0]))} is in. Tap Compare on one or two more teams to see them side by side.`;
            panel.appendChild(hint);
        }
        else {
            const teams = compareIds.map((id) => fittingById.get(id));
            const facts = teams.map(teamFacts);
            const wrap = document.createElement("div");
            wrap.className = "compare-scroll";
            const table = document.createElement("table");
            table.className = "cmptable";
            const thead = document.createElement("thead");
            const hr = document.createElement("tr");
            hr.appendChild(document.createElement("th"));
            for (const t of teams) {
                const th = document.createElement("th");
                th.scope = "col";
                th.textContent = displayName(t);
                hr.appendChild(th);
            }
            thead.appendChild(hr);
            table.appendChild(thead);
            const tbody = document.createElement("tbody");
            const row = (label, cells, cls = "") => {
                const tr = document.createElement("tr");
                if (cls)
                    tr.className = cls;
                const th = document.createElement("th");
                th.scope = "row";
                th.textContent = label;
                tr.appendChild(th);
                for (const c of cells) {
                    const td = document.createElement("td");
                    td.textContent = c;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            };
            const fmtDate = (iso) => {
                const d = new Date(`${iso}T12:00:00Z`);
                return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
            };
            row("Fit", facts.map((f) => f.fit), "cmp-fit");
            row("Evidence", facts.map((f) => f.band), "cmp-band");
            row("Plants to place", facts.map((f) => (f.plants > 0 ? String(f.plants) : "not sized yet")), "cmp-plants");
            row("Jobs to fill", facts.map((f) => String(f.jobs)), "cmp-jobs");
            row("First task", facts.map((f) => f.first ? `${fmtDate(f.first.date)} - ${f.first.kind === "sow_climber" ? "sow the climber" : f.first.kind === "install_support" ? "put the support in" : "plant after last frost"}` : "dates arrive with a location"), "cmp-first");
            row("Season here", facts.map((f) => f.days != null
                ? (f.dtm != null ? `${f.days} frost-free days · longest crop ${f.dtm} days${f.dtm > f.days ? " - tight" : ""}${f.heat ? " · summer nights run hot" : ""}` : `${f.days} frost-free days${f.heat ? " · summer nights run hot" : ""}`)
                : "not known here"), "cmp-season");
            const tr = document.createElement("tr");
            tr.className = "cmp-save";
            tr.appendChild(document.createElement("th"));
            for (const t of teams) {
                const td = document.createElement("td");
                const b = document.createElement("button");
                b.type = "button";
                b.className = "primary cmpsave";
                b.textContent = `Save as “${bedNameNow}”’s plan`;
                b.addEventListener("click", () => void savePlanSelection(t.id, bedNameNow, b, bundle, site));
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
    let leadOpen = true;
    for (const f of ranked.slice(0, SHORTLIST_N)) {
        const c = buildCard(f.guild, f.from, leadOpen);
        leadOpen = false;
        c.querySelector("summary.teamsummary")?.appendChild(compareBtn(f.guild));
        list.appendChild(c);
        tops.push(c);
    }
    let allWrap = null;
    if (restIds.size > 0) {
        const details = document.createElement("details");
        details.className = "allteams";
        details.open = allTeamsOpen;
        const summ = document.createElement("summary");
        summ.className = "allteams-toggle";
        details.appendChild(summ);
        let shown = 0;
        details.addEventListener("toggle", () => { allTeamsOpen = details.open; });
        for (const sec of SECTION_ORDER) {
            const members = (bySection.get(sec) ?? []).filter((f) => restIds.has(f.guild.id));
            if (!members.length)
                continue;
            const head = document.createElement("h3");
            head.className = "teamsection";
            head.dataset.section = sec;
            head.textContent = SECTION_COPY[sec].h;
            details.appendChild(head);
            const sub = document.createElement("p");
            sub.className = "teamsection-sub";
            sub.textContent = SECTION_COPY[sec].sub;
            details.appendChild(sub);
            for (const f of members) {
                const c = buildCard(f.guild, f.from, false);
                c.querySelector("summary.teamsummary")?.appendChild(compareBtn(f.guild));
                details.appendChild(c);
                tops.push(c);
                shown++;
            }
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
            const dont = greyed.length === 1 ? "team doesn't" : "teams don't";
            t.textContent = bw != null && bl != null
                ? `${greyed.length} ${dont} fit your ${fmtArea(bw * bl)} bed`
                : `${greyed.length} ${dont} fit this bed`;
            const sub = document.createElement("span");
            sub.className = "nofits-sub";
            sub.textContent = "Shown greyed with the reason - never hidden.";
            const ch = document.createElement("span");
            ch.className = "chev";
            ch.textContent = "▾";
            ch.setAttribute("aria-hidden", "true");
            fold.append(t, sub, ch);
            details.appendChild(fold);
            const folded = [];
            for (const g of greyed) {
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
    if (matched && allWrap && allWrap.contains(matched) && !allWrap.open)
        allWrap.open = true;
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
}
function harmonyBand(guild) {
    const h = (guild.derived_harmony ?? {});
    if (h.band === "backed")
        return { key: "backed", label: "Well backed by the evidence", tip: "" };
    if (h.band === "partial")
        return { key: "partial", label: "Partly backed by the evidence", tip: "" };
    if (guild.guild_class === "culinary_bundle") {
        const note = guild.honesty_note?.trim();
        return { key: "kitchen", label: "Chosen for the kitchen", tip: note ?? "", corpusTip: !!note };
    }
    if (guild.guild_class === "ornamental_bundle") {
        const note = guild.honesty_note?.trim();
        return { key: "cut", label: "Grown to cut", tip: note ?? "", corpusTip: !!note };
    }
    if (guild.guild_class === "restorative") {
        return { key: "rest", label: "A rest for the soil",
            tip: "Its benefit is to next season's crop, not to a co-planting." };
    }
    return { key: "plain", label: "No graded mechanism yet", tip: "" };
}
const CLASS_WORDS = {
    polyculture: "Mixed planting", perennial_guild: "Perennial team", culinary_bundle: "Kitchen bundle",
    ornamental_bundle: "Cutting bundle", restorative: "Rest and cover", out_of_scope: "Not for a bed",
};
function classWords(guildClass) {
    return CLASS_WORDS[guildClass ?? ""] ?? humanize(guildClass ?? "").replace(/\bguild\b/gi, "team");
}
const FIT_WORDS = {
    full: "Fits your bed with room to spare", adequate: "Fits your bed, a little tight", marginal: "Just fits your bed",
};
const TIER_UI = {
    full: { on: 3, label: "fits fully" },
    adequate: { on: 2, label: "fits - tighter" },
    marginal: { on: 1, label: "fits - just" },
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
    chev.textContent = "▸";
    chev.setAttribute("aria-hidden", "true");
    summary.appendChild(chev);
    const info = document.createElement("div");
    info.className = "tinfo";
    const name = document.createElement("h3");
    name.className = "tname";
    name.textContent = displayName(guild);
    info.appendChild(name);
    const fpTxt = guild.footprint_min_m2 == null ? "? m²" : fmtArea(guild.footprint_min_m2);
    const foot = isRing ? `drip-line ring, ${fpTxt}` : `needs ${fpTxt}`;
    const meta = document.createElement("span");
    meta.className = "tmeta";
    meta.textContent = `${foot} · ${classWords(guild.guild_class)}`;
    info.appendChild(meta);
    const hb = harmonyBand(guild);
    const band = document.createElement("span");
    band.className = `hband hband-${hb.key}`;
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
        lin.textContent = `↳ a smaller version of ${displayName(promotedFrom)} (which needs ${pfp})`;
        info.appendChild(lin);
    }
    mark(info, { kind: "team", id: guild.id }, { label: "Why this team" });
    summary.appendChild(info);
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
        summary.appendChild(meter);
    }
    const chip = document.createElement("span");
    if (recommended) {
        chip.className = "fit rec";
        chip.textContent = "recommended";
    }
    else if (st.fits) {
        chip.className = "fit ok";
        chip.textContent = st.tier ? TIER_UI[st.tier].label : "fits";
    }
    else {
        chip.className = "fit no";
        chip.textContent = "won’t fit";
    }
    summary.appendChild(chip);
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
        const tabH = document.querySelector("#step-plan .bedtabs")?.getBoundingClientRect().height || 48;
        seat(scrollerFor(card), card, { offset: tabH + 6, motion: "smooth", reason: "team-card" });
    });
    const body = document.createElement("div");
    body.className = "teambody";
    if (bw != null && bl != null) {
        const why1 = document.createElement("p");
        why1.className = "teamwhy";
        const fitWords = st.fits ? (st.tier ? FIT_WORDS[st.tier] : "Fits your bed") : "Doesn’t fit your bed as it is";
        const hbw = harmonyBand(guild);
        why1.textContent = `${fitWords} · ${hbw.label.charAt(0).toLowerCase()}${hbw.label.slice(1)}`;
        body.appendChild(why1);
    }
    const applyWrap = document.createElement("div");
    applyWrap.className = "applybox";
    body.appendChild(applyWrap);
    const inst = st.fits ? instantiate(guild, site, bundle) : null;
    if (inst) {
        const faces = memberThumbs(inst, guild, bundle);
        if (faces.childElementCount)
            body.appendChild(faces);
    }
    const hrules = (guild.derived_harmony?.rules) ?? [];
    const mechbox = document.createElement("div");
    mechbox.className = "mechbox";
    if (hrules.length) {
        const mh = document.createElement("p");
        mh.className = "mech-h";
        mh.textContent = "What holds this team together:";
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
        const note = guild.honesty_note?.trim();
        const useNote = (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle") && !!note;
        if (useNote)
            p.dataset.prose = "corpus";
        p.textContent = useNote
            ? note
            : (hb.tip || "Nothing recorded yet about how these members affect each other.");
        mechbox.appendChild(p);
    }
    body.appendChild(mechbox);
    if (isRing) {
        const note = document.createElement("p");
        note.className = "ring-note";
        const canopyId = (guild.roles ?? []).find((r) => r.id === "canopy")?.canonical;
        const habit = typeof canopyId === "string"
            ? String(resolveSpecies(canopyId, null, bundle).habit ?? "") : "";
        const cw = { tree: "tree", shrub: "shrub", vine: "vine", cane: "bramble" }[habit] ?? "woody centre";
        note.textContent = `A perennial team built around a ${cw} - laid out as rings around it, out to the drip line, not a square bed. The ${cw} can sit wherever the rings fit.`;
        body.appendChild(note);
    }
    if (bw != null && bl != null) {
        const svg = isRing ? ringSvg(bw, bl, guild.footprint_min_m2, st.fits) : fitSvg(bw, bl, guild.footprint_min_m2, st.fits);
        if (svg) {
            const fig = document.createElement("figure");
            fig.className = "fitfig";
            const need = fmtArea(guild.footprint_min_m2 ?? 0);
            const bedTxt = `${fmtLen(bw)} × ${fmtLen(bl)}`;
            const sentence = isRing
                ? (st.fits ? `Your ${bedTxt} bed, outlined, and the ring this team grows out to, filled - it fits inside.`
                    : `Your ${bedTxt} bed, outlined, and the ring this team grows out to, dashed - it runs past the edge.`)
                : (st.fits ? `Your ${bedTxt} bed, outlined, and the ${need} this team needs, filled - it fits inside.`
                    : `Your ${bedTxt} bed, outlined, and the ${need} this team needs, dashed - it runs past the edge.`);
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", sentence);
            fig.appendChild(svg);
            const cap = document.createElement("figcaption");
            const legend = document.createElement("span");
            legend.className = "fitlegend";
            const swBed = document.createElement("i");
            swBed.className = "sw bed";
            const swFp = document.createElement("i");
            swFp.className = st.fits ? "sw fp ok" : "sw fp over";
            legend.append(swBed, document.createTextNode(" your bed "), swFp, document.createTextNode(st.fits ? " the space this team needs" : " the space this team needs, past the edge"));
            cap.append(document.createTextNode(sentence + " "), legend);
            fig.appendChild(cap);
            body.appendChild(fig);
        }
    }
    if (!st.fits && st.reason) {
        const why = document.createElement("p");
        why.className = "why";
        const area = bw != null && bl != null ? fmtArea(bw * bl) : "? m²";
        const reasonText = localiseProse(st.reason.text.charAt(0).toUpperCase() + st.reason.text.slice(1));
        why.textContent = `Doesn't fit your ${area} bed. `;
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
export function renderSeason(_bundle) {
    const step = $("step-season");
    const box = $("season");
    const sum = $("sum-season");
    box.innerHTML = "";
    const season = activeSeason();
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
        sum.textContent = "not started";
        p("No season started yet. Start it in the Log - that's where you track the season and close it out.", "hint");
        toLog("Open the Log →");
        return;
    }
    const plantings = season.plantings ?? [];
    const carried = plantings.filter((pl) => pl.carried_over === true).length;
    const ended = plantings.filter((pl) => !!pl.end_cause).length;
    const growing = plantings.length - carried - ended;
    const obs = season.observations ?? [];
    const frostCount = obs.filter((o) => o.event === "frost").length;
    const closed = !!season.closed_date;
    sum.textContent = closed ? `${season.id} · closed` : `${season.id} · ${growing} growing`;
    const head = document.createElement("p");
    head.className = "season-head";
    const strong = document.createElement("strong");
    strong.textContent = `Season ${season.id}`;
    head.appendChild(strong);
    const tag = document.createElement("span");
    tag.className = "hint";
    tag.textContent = closed ? ` · closed ${season.closed_date}` : " · tracking in the Log";
    head.appendChild(tag);
    box.appendChild(head);
    void frostCount;
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
    chip("grow", `${growing} growing`);
    if (carried)
        chip("over", `${carried} overwintering`);
    if (ended)
        chip("end", `${ended} ended`);
    chip("obs", `${obs.length} observation${obs.length === 1 ? "" : "s"}`);
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
        ? "This season is closed - reopen it, log a late frost, or start next year in the Log."
        : "Frost, ending plants, and closing the season live in the Log - this is the read-only glance.", "hint season-glance");
    toLog(closed ? "Open the Log →" : "Track & close in the Log →");
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
let bedSheetOpener = null;
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
export const myBedMemberCount = () => activeMyBed().members.reduce((n, m) => n + (m.count ?? 1), 0);
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
    const seasonId = currentSeasonId();
    if (seasonId == null)
        return;
    const season = seasonById(seasonId) ?? undefined;
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
    const season = activeSeason();
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
async function saveMyBedPlantings(tokens, grid, toWorld, seasonId, bedRegion, bedName, groupBySpecies, composed = false, supportIds = [], asDraft = false) {
    const db = await openLog();
    const season = await getSeason(db, app.currentPlotId, seasonId);
    if (!season)
        throw new Error("that season isn't open - reopen it in the Log tab and try again");
    const today = new Date().toISOString().slice(0, 10);
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
            ...(composed ? { composed: true } : {}) };
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
    const avail = host && host.clientWidth > 0 ? host.clientWidth - 12 : 240;
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
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit canvasbed");
    svg.setAttribute("width", String(Math.round(BW)));
    svg.setAttribute("height", String(Math.round(BH)));
    svg.setAttribute("viewBox", `0 0 ${svgNumber(BW)} ${svgNumber(BH)}`);
    svg.style.touchAction = "none";
    wrap.appendChild(svg);
    const content = document.createElementNS(SVG_NS, "g");
    content.setAttribute("transform", `translate(${svgNumber(ox)} ${svgNumber(oy)}) rotate(${svgNumber(rotDeg)}) translate(${svgNumber(-W / 2)} ${svgNumber(-H / 2)})`);
    svg.appendChild(content);
    const status = document.createElement("p");
    wrap.appendChild(status);
    const colours = new Map();
    for (const t of tokens)
        if (!colours.has(t.species))
            colours.set(t.species, PLANT_COLORS[colours.size % PLANT_COLORS.length]);
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
        const l = document.createElementNS(SVG_NS, "line");
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
        return [ns, ew].filter(Boolean).join("-") || "centre";
    };
    const tokenLabel = (t, bad) => `${plantingLabel(bundle, t.species, t.group)}, ${humanPos(t.col, t.row)} of the bed`
        + (bad ? ", shading a shorter plant" : "")
        + (fb.onMove ? ". Arrow keys move it" : "")
        + (fb.onRemove ? (fb.onMove ? ", Delete removes it" : ". Delete removes it") : "");
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
                    const cell = document.createElementNS(SVG_NS, "rect");
                    cell.setAttribute("x", String(svgNumber(c * cw)));
                    cell.setAttribute("y", String(svgNumber(r * ch)));
                    cell.setAttribute("width", String(svgNumber(cw)));
                    cell.setAttribute("height", String(svgNumber(ch)));
                    cell.setAttribute("class", off ? "celloff" : "cellocc");
                    if (occ) {
                        const ti = document.createElementNS(SVG_NS, "title");
                        ti.textContent = "an overwintering plant holds this ground - the layout plans around it";
                        cell.appendChild(ti);
                    }
                    content.appendChild(cell);
                }
        }
        let bed;
        if (outline) {
            bed = document.createElementNS(SVG_NS, "polygon");
            bed.setAttribute("points", outline.map(([x, y]) => `${svgNumber(x)},${svgNumber(y)}`).join(" "));
        }
        else {
            bed = document.createElementNS(SVG_NS, "rect");
            bed.setAttribute("x", "0");
            bed.setAttribute("y", "0");
            bed.setAttribute("width", String(W));
            bed.setAttribute("height", String(H));
        }
        bed.setAttribute("class", "bed");
        content.appendChild(bed);
        for (const poly of lanePolys) {
            const lane = document.createElementNS(SVG_NS, "polygon");
            lane.setAttribute("points", poly.map(([x, y]) => `${svgNumber(x)},${svgNumber(y)}`).join(" "));
            lane.setAttribute("class", "placelane");
            content.appendChild(lane);
        }
        for (const sup of fb.supports ?? []) {
            const lenPx = Math.min(W, sup.length_m * scale);
            const x0 = (W - lenPx) / 2;
            const y = sup.edge === "north" ? ch * 0.3 : H - ch * 0.3;
            const bar = document.createElementNS(SVG_NS, "rect");
            bar.setAttribute("x", String(svgNumber(x0)));
            bar.setAttribute("y", String(svgNumber(y - 2)));
            bar.setAttribute("width", String(svgNumber(lenPx)));
            bar.setAttribute("height", "4");
            bar.setAttribute("class", "supportbar");
            const cap = document.createElementNS(SVG_NS, "title");
            cap.textContent = `${commonName(bundle, sup.id)} - along the ${sup.edge} edge`;
            bar.appendChild(cap);
            content.appendChild(bar);
            const lbl = document.createElementNS(SVG_NS, "text");
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
            const c = document.createElementNS(SVG_NS, "circle");
            c.setAttribute("cx", String(svgNumber(t.col * cw)));
            c.setAttribute("cy", String(svgNumber(t.row * ch)));
            c.setAttribute("r", String(svgNumber(dotRadius(t.species))));
            c.setAttribute("fill", colours.get(t.species));
            c.setAttribute("fill-opacity", "0.6");
            c.setAttribute("class", "canvastoken");
            c.dataset.i = String(i);
            if (fb.onMove || fb.onRemove) {
                c.setAttribute("tabindex", "0");
                c.setAttribute("role", "button");
            }
            c.appendChild(document.createElementNS(SVG_NS, "title"));
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
            c.setAttribute("stroke", isBad ? "#dc2626" : col);
            c.setAttribute("stroke-width", isBad ? "2.5" : "1");
            c.setAttribute("class", isBad ? "canvastoken shade-bad" : "canvastoken");
            if (c.getAttribute("tabindex") !== null)
                c.setAttribute("aria-label", tokenLabel(t, isBad));
            const title = c.querySelector("title");
            if (title)
                title.textContent = `${plantingLabel(bundle, t.species, t.group)}${isBad ? " - would shade a shorter plant; drag it poleward" : ""}`;
        });
        const n = bad.size;
        status.className = n ? "why" : "hint";
        status.textContent = fb.lat == null
            ? ""
            : n
                ? `${n} plant${n === 1 ? "" : "s"} would cast shade over a shorter neighbour - drag the highlighted plant${n === 1 ? "" : "s"} to the ${fb.polar}, or reset to recommended.`
                : "Nothing here shades a shorter plant.";
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
function placementLine(bundle, z, where, colour) {
    const el = document.createElement("p");
    el.className = "role";
    const dot = document.createElement("span");
    dot.className = "pdot";
    dot.style.background = colour;
    el.appendChild(dot);
    const spacingCm = z.plants.length ? Math.round(z.plants[0].r * 200) : 0;
    const apart = z.count > 1 && spacingCm ? `, ~${fmtCm(spacingCm)} apart` : "";
    const packedM2 = z.count > 1 && z.plants.length
        ? z.count * (z.plants[0].r * 2) ** 2 : Infinity;
    const shownArea = Math.min(z.area_m2, packedM2);
    const zName = commonName(bundle, z.species);
    linkNameIn(el, ` plant ${z.count} × ${zName} (${fmtCm(z.height_cm)}): ${where}${apart}, ${fmtArea(shownArea)}`, zName, z.species);
    return el;
}
export function currentBedRegion() {
    const bedName = document.getElementById("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return planBedRegion(bed);
}
export function currentBedSun() {
    const bedName = document.getElementById("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return bed?.sun === "full" || bed?.sun === "part_shade" ? bed.sun : null;
}
export async function moveBedPlantings(db, plot, oldBed, newBed, seasonId) {
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
export function renderMyBed(bundle, site) {
    const q = $("mybedq");
    const listBox = $("mybedlist");
    const countLine = $("mybedcount");
    const memberBox = $("mybedmembers");
    const resultBox = $("mybedresult");
    if (!q || !listBox || !countLine || !memberBox || !resultBox)
        return;
    const mybed = $("mybed");
    const noBed = app.logHydrated && app.logSnapshot.beds.length === 0;
    const gated = [
        mybed?.querySelector('p.hint[data-copy="mybedHint"]'),
        mybed?.querySelector(".pickrow"),
        $("mybedbedrow"), memberBox, resultBox,
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
    const blockedWhy = new Map(elig.blocked.map((b) => [b.species, b.blocked_by.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ")]));
    const blockedRule = new Map(elig.blocked.map((b) => [b.species, String(b.blocked_by[0]?.rule ?? "")]));
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
        const open = activeSeason();
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
        const hits = all.filter((sid) => !term || commonName(bundle, sid).toLowerCase().includes(term));
        const groups = new Map();
        const PINNED = "In this garden";
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
                else if (mine.has(sid)) {
                    const t = document.createElement("span");
                    t.className = "picktail";
                    t.textContent = "growing now";
                    add.appendChild(t);
                }
                if (!why)
                    add.onclick = () => addSpecies(sid);
                row.appendChild(add);
                if (!why) {
                    const qty = document.createElement("span");
                    qty.className = "pickqty";
                    const mk = (txt, label, by) => {
                        const b = el("button", "pickstep", txt);
                        b.type = "button";
                        b.setAttribute("aria-label", `${label} ${commonName(bundle, sid)}`);
                        b.onclick = (e) => { e.stopPropagation(); addSpecies(sid, by); };
                        qty.appendChild(b);
                    };
                    mk("−", "one fewer", -1);
                    const n = document.createElement("b");
                    n.className = "pickn";
                    n.setAttribute("aria-live", "polite");
                    qty.appendChild(n);
                    mk("+", "one more", 1);
                    row.appendChild(qty);
                    rowCounts.set(sid, qty);
                }
                const info = document.createElement("a");
                info.className = "pickinfo";
                info.href = plantHref(sid);
                info.textContent = "\u203a";
                info.setAttribute("aria-label", `What we know about ${commonName(bundle, sid)}`);
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
                ? `Nothing matches “${q.value.trim()}”. Try a shorter word, or add it as your own plant below.`
                : "No plants available yet - set a location above.";
            listBox.appendChild(p);
        }
        countLine.textContent = hits.length
            ? `${hits.length} of ${all.length}${blocked ? ` · ${blocked} shown greyed, with the reason` : ""}`
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
        const obSite = region ? { ...site, region, occupied: myBedOccupied, structure: bed?.structure ?? "in_ground", lane_flip: bed?.lane_flip ?? false } : site;
        const ob = openBed(myBed.members, obSite, bundle);
        const fp = ob.footprint;
        const bedRow = document.getElementById("mybedbedrow");
        if (bedRow) {
            bedRow.innerHTML = "";
            if (app.logSnapshot.beds.length === 0) {
                const hint = document.createElement("p");
                hint.className = "hint";
                hint.textContent = "No saved beds yet - place one in “Beds” above, then pick it here to configure it.";
                bedRow.appendChild(hint);
            }
            else {
                const label = document.createElement("label");
                label.setAttribute("for", "mybedbedsel");
                label.textContent = "Select bed";
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
            empty.textContent = "No plants yet - add one above to see where it goes and what fires.";
            memberBox.appendChild(empty);
        }
        ob.members.forEach((m, i) => {
            const row = document.createElement("p");
            row.className = (m.eligible ? "role" : "why") + " memberrow";
            const blk = m.blockers.map((b) => stripRuleCitations(humanizeFamilies(b.why))).join("; ");
            const spread = containmentNote(bundle, m.species);
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
                    supNote = ` - ${word.toLowerCase()}${varies ? " (depends on the variety)" : ""}`;
                }
            }
            const tail = isStructureRow
                ? " - carries the climbers; the layout runs it along the shaded edge"
                : `${blk ? ` - ${blk}` : ""}${spread ? ` - ${spread}` : ""}${supNote}`;
            if (tail)
                label.appendChild(document.createTextNode(tail));
            if (supNote) {
                const ga = document.createElement("a");
                ga.href = "../guides/staking-and-support/";
                ga.textContent = "how to support it";
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
                gsel.setAttribute("aria-label", `${commonName(bundle, m.species)} variety`);
                const any = document.createElement("option");
                any.value = "";
                any.textContent = "any variety";
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
            rm.className = "tertiary rmbtn";
            rm.textContent = "Remove";
            rm.onclick = () => { myBed.members.splice(i, 1); myBedEdited(); paint(); };
            row.appendChild(rm);
            memberBox.appendChild(row);
        });
        const mySum = document.getElementById("sum-mybed");
        if (mySum) {
            const n = myBedMemberCount();
            mySum.textContent = n ? `${n} plant${n === 1 ? "" : "s"}` : "";
        }
        resultBox.innerHTML = "";
        const p = (cls, text) => {
            const el = document.createElement("p");
            el.className = cls;
            el.textContent = text;
            resultBox.appendChild(el);
            return el;
        };
        const grid = region ? bedGrid(region) : null;
        const groupOf = new Map(myBed.members.map((mm) => [mm.species, mm.group ?? null]));
        const tokSig = () => tokenSignature(myBed.members, grid);
        const pl = ob.placement;
        if (pl && grid) {
            const polar = pl.polar;
            const single = pl.zones.length < 2;
            mark(p("window", single
                ? `Your bed - drag the plant to where it really grows, or tap it to remove it${myBed.optimized ? " (optimized layout applied)" : ""}. Add plants one at a time and we'll order them tallest to the ${polar}; Optimise fills the bed at proper spacing:`
                : `Your bed - drag each plant to where it really grows, or tap one to remove it${myBed.optimized ? " (optimized layout applied)" : ""}. We've ordered them tallest to the ${polar}, so nothing shades a shorter neighbour; Optimise fills the bed at proper spacing:`), { kind: "rule", id: "R-003" });
            const bedO = bed ? bedOrientation(bed) : null;
            if (bedO && bed) {
                const EDGE = ["top", "right", "bottom", "left"];
                p("hint", `“${bed.name}” is rotated ${bed.rotation_deg}° - shown tilted to match the ground. ` +
                    `The tall row sits along its ${EDGE[bedO.orient.poleward_edge]} edge, the one facing most nearly ${polar}.`);
            }
            const toWorld = bedO
                ? (x, y) => orientedToPlot(x, y, bedO.orient.eff_w, bedO.orient.eff_l, bedO.orient.residual_deg, bedO.cx, bedO.cy)
                : undefined;
            const laneRects = region ? computeAccessBands(bed?.structure ?? "in_ground", region, bed?.lane_flip ?? false) : [];
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
            resultBox.appendChild(myBedCanvas(grid, bundle, { thresholdCm: r003?.trigger?.threshold_cm ?? 120, lat: site.lat ?? null, heightOf, sheltered, polar, toWorld, onMove: (key) => { onSaveReenable?.(); recordHistory(myBed, key); refreshHistoryButtons?.(); }, onRemove: removeToken, rotationDeg: bedO ? bedO.orient.residual_deg : 0, polygon: bedPolygon, occupied: myBedOccupied, laneBands, supports: supLines }, myBed.tokens));
            if (myBedOccupied.length) {
                const openSn = activeSeason();
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
                const noteEl = p("hint", "");
                linkNamesIn(noteEl, `${labels.join(", ")} overwinter${labels.length === 1 ? "s" : ""} here - the shaded cells are its ground, and the layout plans around it. To remove it, end it in the Log.`, marks);
                mark(noteEl, { kind: "rule", id: "R-002" });
            }
            const dh = p("hint", "Drag any plant to match your real bed, or tap one to remove it. ");
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "linky";
            reset.textContent = "Reset to recommended";
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
            undo.textContent = "↺ Undo";
            undo.title = "take back the last change to this bed";
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
            redo.textContent = "↻ Redo";
            redo.title = "put the change back";
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
            zoom.textContent = canvasZoom === 1 ? "Zoom in" : canvasZoom === 1.5 ? "Zoom in more" : "Zoom out";
            zoom.title = "a bigger canvas for fine placement";
            zoom.onclick = () => { canvasZoom = canvasZoom === 1 ? 1.5 : canvasZoom === 1.5 ? 2 : 1; paint(); };
            tools.append(undo, redo, zoom);
            refreshHistoryButtons = () => { undo.disabled = !(myBed.history?.length); redo.disabled = !(myBed.future?.length); };
            resultBox.insertBefore(tools, dh);
            const opp = polar === "north" ? "south" : "north";
            const colours = zoneColorMap(pl.zones);
            pl.zones.forEach((z, i) => {
                if (z.count === 0)
                    return;
                const where = single ? "the whole bed"
                    : i === 0 ? `the ${polar} side` : i === pl.zones.length - 1 ? `the ${opp} side` : "the middle";
                resultBox.appendChild(placementLine(bundle, z, where, colours.get(z.species)));
            });
            for (const sup of supLines) {
                const climbs = sup.for.map((sid) => commonName(bundle, sid).toLowerCase()).join(", ");
                const sl = p("role", `— ${commonName(bundle, sup.id)}: along the ${sup.edge} edge`
                    + ` (~${Math.round(sup.length_m * 39.37)} in)${climbs ? ` - the ${climbs} climb${sup.for.length === 1 ? "s" : ""} it` : ""}.`);
                mark(sl, { kind: "rule", id: "R-040" });
            }
            const totalInstances = myBed.members.reduce((n, m) => n + (m.count ?? 1), 0);
            const oneSpecies = myBed.members.length === 1;
            if (totalInstances >= 2 && site.lat != null) {
                const ARCH_LABEL = {
                    hills: "a mound grid (the climbers share the mounds, the vines fill the gaps)",
                    rings: "concentric rings (the woody centre, understory out to the drip line)",
                    grid: "a mixed bed (the tallest crops banded, the rest interplanted)",
                };
                const archLabel = (arch) => oneSpecies ? "an even stand - spaced to fill the bed" : (ARCH_LABEL[arch] ?? arch);
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
                    p("lead", before === after
                        ? `Filled & arranged as ${archLabel(arch)} - the same ${after} plant${after === 1 ? "" : "s"}, rearranged.`
                        : `Filled & arranged as ${archLabel(arch)} - ${before} plant${before === 1 ? "" : "s"} `
                            + `${after > before ? "filled out to" : "trimmed to"} ${after}, at each species' own spacing.`);
                    for (const [sp, w] of was) {
                        const n2 = now.get(sp) ?? 0;
                        const spName = commonName(bundle, sp);
                        if (n2 < w) {
                            linkNameIn(p("composeexcl", ""), n2 === 0
                                ? `${spName} - removed (was ${w}): the bed cannot hold it`
                                : `• reduced ${spName} from ${w} to ${n2} to fit`, spName, sp);
                        }
                        else if (n2 > w) {
                            linkNameIn(p("hint", ""), `• ${spName} ${w} to ${n2} to fill the bed`, spName, sp);
                        }
                    }
                    const controls = p("hint", "Drag to fine-tune, ");
                    const rev = document.createElement("button");
                    rev.type = "button";
                    rev.className = "linky";
                    rev.textContent = "↩ Revert to my layout";
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
                    reopt.textContent = "Re-arrange";
                    reopt.onclick = applyOptimize;
                    controls.appendChild(reopt);
                }
                else {
                    const optWrap = document.createElement("div");
                    optWrap.className = "bedtools";
                    const th = document.createElement("h4");
                    th.className = "bedtools-h";
                    th.textContent = "Improve this bed";
                    optWrap.appendChild(th);
                    const seam = document.createElement("p");
                    seam.className = "hint";
                    seam.textContent = "Fill and arrange spreads what you've chosen at each plant's own spacing - it never adds or "
                        + "removes a plant for rule reasons. Suggest companions, below, proposes what else belongs, with its reason.";
                    optWrap.appendChild(seam);
                    const optBtn = document.createElement("button");
                    optBtn.type = "button";
                    optBtn.className = "primary fillbtn";
                    optBtn.textContent = "Fill and arrange this bed";
                    optBtn.onclick = applyOptimize;
                    optWrap.appendChild(optBtn);
                    resultBox.appendChild(optWrap);
                }
            }
            if (bed && grid) {
                const applyBox = document.createElement("div");
                applyBox.className = "applybox";
                resultBox.appendChild(applyBox);
                const savedMap = bedOccupancyComposition(bed.region);
                const draftMap = draftComposition(myBed.members);
                const savedCount = [...savedMap.values()].reduce((a, b) => a + b, 0);
                const dirty = !compositionsEqual(savedMap, draftMap);
                const status = document.createElement("p");
                status.className = "bedstate";
                if (!savedCount && !draftMap.size) {
                    status.textContent = "Empty bed - add plants above, then save them to the Log.";
                }
                else if (dirty) {
                    status.classList.add("dirty");
                    status.textContent = savedCount
                        ? "● Unsaved changes - save to update the Log, or reset to what's saved."
                        : "● Draft not saved yet - save to add these plants to the Log.";
                }
                else {
                    status.classList.add("saved");
                    status.textContent = "This bed matches what's saved on the Log.";
                }
                applyBox.appendChild(status);
                const tokensToSave = () => myBed.tokens;
                const n = tokensToSave().length;
                const out = document.createElement("span");
                out.className = "hint";
                const seasonId = currentSeasonId();
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "saveplan primary";
                onSaveReenable = () => {
                    if (!btn.disabled)
                        return;
                    btn.disabled = false;
                    out.className = "hint";
                    out.textContent = " moved a plant - save again to update this bed.";
                };
                if (seasonId != null) {
                    btn.textContent = `save ${n} plant${n === 1 ? "" : "s"} → “${bed.name}” as a draft`;
                    btn.onclick = () => void (async () => {
                        btn.disabled = true;
                        out.className = "hint";
                        out.textContent = " saving…";
                        try {
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, seasonId, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), myBed.composed === true, myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species), true);
                            app.planDots = appliedPlanDots(bundle, site);
                            app.groundRedraw?.();
                            toast(`Saved “${bed.name}” as a draft (${saved} plant${saved === 1 ? "" : "s"}). Mark it planted when you’re ready.`);
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
                    btn.textContent = `start season ${year} & save ${n} plant${n === 1 ? "" : "s"} → “${bed.name}” as a draft`;
                    btn.onclick = () => void (async () => {
                        btn.disabled = true;
                        out.className = "hint";
                        out.textContent = " starting season…";
                        try {
                            if (!app.logDb)
                                throw new Error("the garden log isn't ready yet - try again in a moment");
                            if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
                                await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                            }
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, year, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), myBed.composed === true, myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species), true);
                            toast(`Started season ${year} and saved “${bed.name}” as a draft (${saved} plant${saved === 1 ? "" : "s"}). Mark it planted when you’re ready.`);
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
                    reset.textContent = savedCount ? "Reset to saved" : "Clear bed";
                    reset.title = savedCount
                        ? "discard unsaved changes and go back to what's saved on the Log"
                        : "clear this bed's draft and start over";
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
            p("hint", "Set your location (for the sun direction) and a bed size above to see the placement diagram.");
        }
        if (fp.bed_m2 != null && fp.total_m2 > 0) {
            const pl = fp.plantable_m2;
            const pathed = pl != null && pl < fp.bed_m2 - 1e-9;
            const ground = pathed ? `${fmtArea(pl)} of plantable ground` : `${fmtArea(fp.bed_m2)} bed`;
            const aside = pathed ? ` (your ${fmtArea(fp.bed_m2)} bed, less the paths it needs to reach).` : ".";
            if (fp.fits) {
                p("hint", `Footprint ~${fmtArea(fp.total_m2)} of your ${ground}${aside}`);
            }
            else if (myBed.optimized) {
                p("hint", `Arranged at each species' own spacing, they fill the bed. At maturity the canopy `
                    + `adds up to ~${fmtArea(fp.total_m2)} - more than your ${ground}, so the planting knits `
                    + `closed as it matures.`);
            }
            else {
                p("why", `These plants need ~${fmtArea(fp.total_m2)} - more than your ${ground}${aside}`);
            }
        }
        const seasonLabel = (t) => t.replace(/_/g, " ");
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
                return spread ? `${label} (${spread} cm across)` : label;
            });
            return { text: `In flower then: ${parts.join(", ")}.`, marks };
        };
        const outs = [];
        for (const f of ob.flags) {
            if (f.rule === "R-002")
                continue;
            const name = f.subject === null ? "" : commonName(bundle, f.subject);
            let msg = null;
            let extraMarks = [];
            if (f.rule === "R-040")
                msg = `${name} needs a strong support and nothing in the bed provides one.`;
            else if (f.rule === "R-001")
                msg = `plant at least ${f.need} ${name} in a block of 4+ rows for pollination - you have ${f.have}.`;
            else if (f.rule === "R-080") {
                const cv = cultivarPartner(bundle, f.subject);
                msg = cv
                    ? `${name} needs ${cv} different varieties to set fruit - you have ${f.have}. The second can be a neighbour's tree within ${fmtLen(15)} to ${fmtLen(30)}; two of the same variety will not pollinate each other.`
                    : `${name} needs at least ${f.need} plants to set fruit - you have ${f.have}.`;
            }
            else if (f.rule === "R-140") {
                msg = `${name} is dioecious - it needs a male pollenizer near the female to set fruit, and you have ${f.have}. A single plant, or several of the same sex, will not fruit (some cultivars are self-fertile).`;
            }
            else if (f.rule === "R-102") {
                const [lo, hi] = (f.bloom ?? ["early_summer", "late_summer"]);
                const when = lo === hi ? seasonLabel(lo) : `${seasonLabel(lo)} to ${seasonLabel(hi)}`;
                msg = `${name} needs an insect to carry pollen between its flowers, and nothing else in `
                    + `this bed is in flower from ${when}.`;
            }
            else if (f.rule === "R-107") {
                msg = "This is a container, and a container dries out faster than the ground: its soil "
                    + "volume is small and its whole root zone sits above ground. Check it at least once a "
                    + "day, and twice when it is hot, dry or windy.";
            }
            else if (f.rule === "R-142") {
                const lows = (f.low ?? []).map((id) => commonName(bundle, id));
                const steadies = (f.steady ?? []).map((id) => commonName(bundle, id));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                msg = `${list(steadies)} want${steadies.length === 1 ? "s" : ""} the soil kept steadily moist, and `
                    + `${list(lows)} want${lows.length === 1 ? "s" : ""} it to dry out between waterings. One bed gets one `
                    + `way of watering, so half of this planting will be unhappy whichever way you go. Give `
                    + `${lows.length === 1 ? lows[0] : "the dry-soil herbs"} a bed or a pot of ${lows.length === 1 ? "its" : "their"} own beside `
                    + `this one - the dry herb bed is built for exactly that.`;
                extraMarks = [...(f.low ?? []), ...(f.steady ?? [])]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-144") {
                const smalls = (f.small ?? []).map((id) => commonName(bundle, id));
                const res = (f.residue ?? []);
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                const covers = list(res.map((r) => `${commonName(bundle, r.species)} (give it about ${Math.round(r.lead_days / 7)} weeks after it is killed)`));
                msg = `This ground grew ${covers} last season, and its residue holds back small seeds while it breaks down. `
                    + `${list(smalls)} ${smalls.length === 1 ? "is" : "are"} sown small and straight into the ground, so `
                    + `${smalls.length === 1 ? "it" : "they"} may come up thin or not at all if sown too soon.`;
                extraMarks = [...(f.small ?? []), ...res.map((r) => r.species)]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-152") {
                const risk = (f.hosts ?? []).map((id) => commonName(bundle, id));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                const host = commonName(bundle, String(f.host ?? ""));
                msg = `This ground grew ${host} last season, and any tubers left behind come back as volunteers that carry `
                    + `late blight into ${list(risk)}.`;
                extraMarks = [String(f.host ?? ""), ...(f.hosts ?? [])]
                    .map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-157") {
                const ids = (f.species ?? []);
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                msg = `This bed holds ${list(ids.map((id) => commonName(bundle, id)))} together, and brambles share the same `
                    + `aphid-borne viruses: if either shows mosaic or crumbly fruit, it is the other's nearest source.`;
                extraMarks = ids.map((id) => ({ label: commonName(bundle, id), species: id }));
            }
            else if (f.rule === "R-155") {
                const sid = String(f.species ?? "");
                const kinds = (f.groups ?? []).map((g) => groupLabel(bundle, sid, g));
                const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                msg = `This bed holds ${list(kinds)} together, and corn's pollen decides the kernel: two kinds `
                    + `tasselling at once spoil each other, the sweet one worst.`;
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
                    remedy: typeof rule?.remedy === "string" ? stripRuleCitations(rule.remedy) : null,
                    severity: typeof rule?.severity === "string" ? rule.severity : "suboptimal",
                });
            }
        }
        for (const vn of virusNeighbours(myBed.members, plotSiblings(candbedValue()), bundle)) {
            const rule = bundle.rules.find((x) => x.id === vn.rule);
            const list = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
            const mine = list(vn.species.map((id) => commonName(bundle, id).toLowerCase()));
            const theirs = vn.with.map((w) => `${w.bed}'s ${list(w.species.map((id) => commonName(bundle, id).toLowerCase()))}`).join(" and ");
            outs.push({
                rule: vn.rule,
                text: `You already grow ${theirs} this season, and brambles share the same aphid-borne viruses: `
                    + `if that planting shows mosaic or crumbly fruit, it is the nearest source for the ${mine} here.`,
                names: [...vn.species, ...vn.with.flatMap((w) => w.species)]
                    .filter((id, i, arr) => arr.indexOf(id) === i)
                    .map((id) => ({ label: commonName(bundle, id).toLowerCase(), species: id })),
                remedy: typeof rule?.remedy === "string" ? stripRuleCitations(rule.remedy) : null,
                severity: typeof rule?.severity === "string" ? rule.severity : "suboptimal",
            });
        }
        const bloomRibbon = (r) => {
            const wrap = document.createElement("div");
            wrap.className = "bloomribbon";
            const row = (label, on, cls, what) => {
                const l = document.createElement("span");
                l.className = "brlabel";
                l.textContent = label;
                wrap.appendChild(l);
                const bar = document.createElement("span");
                bar.className = "brbar";
                on.forEach((v, i) => {
                    const cell = document.createElement("span");
                    const season = BLOOM_ORDER[i].replace(/_/g, " ");
                    cell.className = v ? `brcell ${cls}` : "brcell";
                    cell.title = v ? `${what} in ${season}` : `not ${what} in ${season}`;
                    bar.appendChild(cell);
                });
                wrap.appendChild(bar);
            };
            row("Needs insects", r.crop, "brcrop", "needs insects");
            row("In flower here", r.forage, "brforage", "something in flower");
            const spacer = document.createElement("span");
            wrap.appendChild(spacer);
            const scale = document.createElement("span");
            scale.className = "brscale";
            for (const t of BLOOM_ORDER) {
                const c = document.createElement("span");
                c.textContent = t.replace("early_", "e.").replace("late_", "l.").replace("mid", "mid")
                    .replace("_", " ").replace("summer", "sum").replace("spring", "spr");
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
                box.appendChild(fix);
            }
            if (o.rule === "R-040" && !myBed.members.some((m) => m.species === "trellis_structure")
                && (bundle.entities ?? []).some((e) => e.id === "trellis_structure")) {
                const add = document.createElement("button");
                add.type = "button";
                add.className = "linky";
                add.id = "addsupport";
                const ent = (bundle.entities ?? []).find((e) => e.id === "trellis_structure");
                const cost = Array.isArray(ent?.cost_usd) ? ` (~$${ent.cost_usd[0]}-$${ent.cost_usd[1]}, reusable)` : "";
                add.textContent = `Add a trellis to this bed →${cost}`;
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
            resultBox.appendChild(outCard(o));
        const sugLines = ob.suggestions.map((sug) => {
            const guild = bundle.guilds.find((g) => g.id === sug.guild);
            const gname = guild ? displayName(guild) : sug.guild;
            const marks = [];
            const missing = sug.missing_roles.map((mr) => {
                const ids = mr.fillers.slice(0, 3);
                const fillers = ids.map((s) => {
                    const label = commonName(bundle, s);
                    marks.push({ label, species: s });
                    return label;
                }).join(", ");
                return `a ${humanize(mr.role)}${fillers ? ` (e.g. ${fillers})` : ""}`;
            }).join(" and ");
            return { text: `This is most of a ${gname} - add ${missing} to complete it.`, marks };
        });
        const nFolded = softer.length + sugLines.length;
        if (nFolded) {
            const det = document.createElement("details");
            det.className = "more";
            const sum = document.createElement("summary");
            const label = document.createElement("span");
            label.textContent = `${nFolded} more suggestion${nFolded === 1 ? "" : "s"}`;
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
            resultBox.appendChild(det);
        }
        const compBox = document.createElement("div");
        compBox.className = "composebox";
        const ch = document.createElement("h4");
        ch.textContent = myBed.members.length ? "Suggest companions" : "Compose a fresh bed";
        compBox.appendChild(ch);
        const chint = document.createElement("p");
        chint.className = "hint";
        chint.textContent = myBed.members.length
            ? "Compose around what you've added: every proposal names the reason it is there, "
                + "and what your site rules out is shown with the rule that ruled it out."
            : "Compose a fresh bed from what we know about this ground - its history chooses the "
                + "anchor, every addition names its rule, and ground with nothing to say says so.";
        compBox.appendChild(chint);
        const cbtn = document.createElement("button");
        cbtn.type = "button";
        cbtn.id = "composebtn";
        cbtn.className = "secondary";
        cbtn.textContent = myBed.members.length ? "Suggest companions for these" : "Compose a fresh bed";
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
                location: "where this garden is",
                growing_area: "this bed's size",
                sun: "how much sun this bed gets",
            };
            if (res.refused) {
                const pr = document.createElement("p");
                pr.className = "lead";
                pr.textContent = "Not enough to compose from yet - this bed still needs: "
                    + res.missing_facts.map((f) => FACT_COPY[f.fact] ?? f.fact).join(", ") + ".";
                box.appendChild(pr);
                return;
            }
            if (res.proposal.length) {
                const ul = document.createElement("ul");
                ul.className = "composeplan";
                for (const p of res.proposal) {
                    const li = document.createElement("li");
                    const name = document.createElement("strong");
                    name.textContent = commonName(bundle, p.species) + (p.count > 1 ? ` ×${p.count}` : "");
                    li.appendChild(name);
                    const w = document.createElement("span");
                    w.className = "warrant";
                    if (p.warrant.kind === "want") {
                        w.textContent = " - you asked for it";
                    }
                    else if (p.warrant.kind === "ground") {
                        const a = document.createElement("a");
                        a.href = `#/why?rule=${p.warrant.rule}`;
                        a.textContent = stripRuleCitations(humanizeFamilies(p.warrant.why ?? ruleClaim(bundle, p.warrant.rule ?? "")));
                        markLink(a, { kind: "rule", id: p.warrant.rule ?? "" });
                        w.textContent = " - from your ground: ";
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
                            w.appendChild(document.createTextNode(` (for your ${commonName(bundle, beside).toLowerCase()})`));
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
                    ?? ("Nothing to propose on this ground - the exclusions below say why, "
                        + "and a short honest list beats a padded one.");
                box.appendChild(none);
            }
            for (const e of res.exclusions) {
                const pe = document.createElement("p");
                pe.className = "composeexcl";
                pe.textContent = `${commonName(bundle, e.species)} - ${e.why}`;
                box.appendChild(pe);
            }
            if (res.split) {
                const ps = document.createElement("p");
                ps.className = "composesplit";
                const lows = res.split.low.map((id) => commonName(bundle, id));
                const steadies = res.split.steady.map((id) => commonName(bundle, id));
                const join = (xs) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
                ps.append(`${join(lows)} want${lows.length === 1 ? "s" : ""} dry soil, and this bed will be watered for `
                    + `${join(steadies)}. Rather than drop ${lows.length === 1 ? "it" : "them"}, give ${lows.length === 1 ? "it" : "them"} a bed or a pot of `
                    + `${lows.length === 1 ? "its" : "their"} own beside this one: `);
                const team = bundle.guilds.find((g) => g.id === res.split?.team);
                const ta = document.createElement("a");
                ta.href = `#/plan?guild=${res.split.team}`;
                ta.textContent = team ? displayName(team) : res.split.team;
                ps.appendChild(ta);
                ps.append(" - ");
                const link = document.createElement("a");
                link.href = `#/why?rule=${res.split.rule}`;
                markLink(link, { kind: "rule", id: res.split.rule });
                link.textContent = "one bed gets one way of watering";
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
                    pn.append(`Your ${String(n.detail.from)}'s ${commonName(bundle, String(n.detail.species)).toLowerCase()} already serves this bed - `);
                    link.textContent = "no insectary added here";
                    pn.appendChild(link);
                    pn.append(".");
                }
                else if (n.kind === "serves_neighbour") {
                    pn.append(`The insectary here also serves ${String(n.detail.to)} - `);
                    link.textContent = "one border, both beds";
                    pn.appendChild(link);
                    pn.append(".");
                }
                else if (n.kind === "joint_block_possible") {
                    pn.append(`Corn's block could still clear its floor across the path with ${String(n.detail.with)} - `);
                    link.textContent = "see Your whole plot above";
                    link.removeAttribute("href");
                    pn.appendChild(link);
                    pn.append(".");
                }
                else if (n.kind === "forward_foreclosure") {
                    pn.append(`Planting ${familyName(String(n.detail.family))} here and in ${n.detail.with.join(", ")} closes both beds to them next year - `);
                    link.textContent = "the interval behind this";
                    pn.appendChild(link);
                    pn.append(".");
                }
                else if (n.kind === "kinds_across_beds") {
                    const sid = String(n.detail.species);
                    const mine = groupLabel(bundle, sid, String(n.detail.mine ?? ""));
                    const theirs = (n.detail.with ?? [])
                        .map((w) => `${w.bed}'s ${groupLabel(bundle, sid, w.group).toLowerCase()}`).join(" and ");
                    pn.append(`Your ${mine.toLowerCase()} here and ${theirs} will tassel in the same garden, and each kind's pollen spoils the other's kernels - `);
                    link.textContent = "250 feet apart, or 14 days apart in tasselling";
                    pn.appendChild(link);
                    pn.append(".");
                }
                else if (n.kind === "same_family_patch") {
                    pn.append(`Your ${familyName(String(n.detail.family))} here and in ${n.detail.with.join(", ")} make one unbroken host patch - easier for a specialist pest to find than a broken run - `);
                    link.textContent = "the reason to break it up";
                    pn.appendChild(link);
                    pn.append(".");
                }
                box.appendChild(pn);
            }
            const hb = document.createElement("p");
            hb.className = "composeband";
            hb.textContent = res.harmony.score > 0
                ? (res.harmony.band === "backed"
                    ? "This arrangement is well backed by the evidence."
                    : "Partly backed by the evidence - some of these carry a real mechanism together.")
                : "These all grow here, and nothing recorded says they affect each other.";
            box.appendChild(hb);
            if (res.disclosures.length) {
                const dd = document.createElement("p");
                dd.className = "hint";
                const names = {
                    rotation_history: "this ground's rotation history",
                    soil_test: "a soil test",
                };
                dd.textContent = "Unchecked, because this garden hasn't recorded it: "
                    + res.disclosures.map((d) => names[d.fact] ?? d.fact).join("; ") + ".";
                box.appendChild(dd);
            }
            if (res.novelty?.redirect && res.novelty.nearest) {
                const g = bundle.guilds.find((x) => x.id === res.novelty?.nearest);
                const pr = document.createElement("p");
                pr.className = "composeredirect";
                pr.textContent = "This is close to a documented planting - ";
                const a = document.createElement("a");
                a.href = `#/plan?guild=${res.novelty.nearest}`;
                a.textContent = g ? displayName(g) : res.novelty.nearest;
                pr.appendChild(a);
                pr.appendChild(document.createTextNode(" is the real version, with its provenance. Consider planting that instead."));
                box.appendChild(pr);
            }
            if (res.proposal.length) {
                const adopt = document.createElement("button");
                adopt.type = "button";
                adopt.id = "composeadopt";
                adopt.className = "stepnext";
                adopt.textContent = "Use this planting →";
                adopt.addEventListener("click", () => {
                    if (!myBed.baseline)
                        myBed.baseline = { members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) };
                    const known = (sid) => bundle.species.some((s) => s.id === sid)
                        || (bundle.entities ?? []).some((e) => e.id === sid);
                    myBed.members = res.proposal
                        .filter((p) => known(p.species))
                        .map((p) => ({ species: p.species, group: null, count: p.count }));
                    myBed.composed = true;
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
        resultBox.appendChild(compBox);
    };
    paint();
}
