// Plan page (Phase A page-split): climate provenance, eligibility (§6.3), the fit diagrams
// (C4/D-015), the priced role plan with substitution verdicts (§6.2/D-006), and the guild
// browser. Rendering only - every verdict and number comes from the engine.
import { countRung } from "./analytics.js";
import { eligibleSpecies, instantiate, resolveSpecies, substitutionVerdict } from "./engine/compiler.js";
import { BLOOM_ORDER, forageCandidates, forageInFlower } from "./engine/forage.js";
import { openBed, optimizeBed, bedArchetype, optimizedPlacement, strongestSupportRequirement, structureLine } from "./engine/openbed.js";
import { compose } from "./engine/composer.js";
import { browsableGuilds, derivedGuilds, displayName, guildStatus, laysOutAsHills } from "./engine/guilds.js";
import { backendConfigured, isSignedIn } from "./account.js";
import { familyName, humanize, humanizeFamilies, stripRuleCitations, titleCase } from "./engine/labels.js";
import { frostRiskRows, humanizeMMDD } from "./panels/frostrisk.js";
import { onionDaylengthNote } from "./panels/daylength.js";
import { accessBands as computeAccessBands, bedFrame, framesEqual, orientedToPlot, orientRect, place, plotToOriented, remapRegionBetweenBeds } from "./engine/place.js";
import { daylightHours, heightOrderingViolations } from "./engine/solar.js";
import { linkNameIn, linkNamesIn, plantHref, plantLink } from "./panels/plantcard.js";
import { VALUE_WORD } from "./engine/plantcard.js";
import { area as regionArea, fitDiagram, intersectArea, parseRegion, radialRingsFromFootprint, regionCentroid, regionPoints } from "./engine/regions.js";
import { heatWarnings, livingSupportLead, mechanismRows, memberSpecies, plantingWindowFor, spacingRows } from "./engine/schedule.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { getPlot, getSeason, openLog, putPlot, putSeason, setBedPlanted } from "./storage.js";
import { $, lenM, SVG_NS } from "./dom.js";
import { toast } from "./notices.js";
import { pointInPolygon } from "./groundmap/geometry.js";
import { activeBundle, app, commonName, ruleClaim } from "./state.js";
import { plotBlock } from "./plotlayer.js";
import { copy } from "./copy.js";
import { fmtArea, fmtCm, fmtLen, fmtTemp } from "./units.js";
// ---------------------------------------------------------------- confidence badge (D-083)
// The homepage sells the product on plain-language confidence ("Well established", "A good hunch").
// Carry that vocabulary into the app: map each corpus GRADE to the landing's own words + its .lg-conf
// visual language (semantic ok/warn, not a new accent). Kept per mechanism so nothing is over-claimed.
const CONFIDENCE = {
    A: { word: "Well established", cls: "s" }, // named mechanism, evidence verified - the landing's "sure"
    B: { word: "Promising", cls: "p" }, // named mechanism, literature-backed but not airtight
    C: { word: "A good hunch", cls: "h" }, // plausible; field studies thin - the landing's "hunch"
    D: { word: "Contested", cls: "d" },
    F: { word: "Refuted", cls: "f" },
};
export function confidenceBadge(grade) {
    const c = CONFIDENCE[(grade || "").trim().toUpperCase()];
    if (!c)
        return null; // unknown/"?" grade → no badge rather than a fabricated confidence
    const span = document.createElement("span");
    span.className = `conf ${c.cls}`;
    const mk = document.createElement("span");
    mk.className = "mk";
    span.appendChild(mk);
    span.appendChild(document.createTextNode(c.word));
    return span;
}
// ---------------------------------------------------------------- climate panel
// One "This ground's climate" card, replacing four stacked text blocks (climate + frost-risk +
// daylength + a repeated solstice line) that grew tall the moment a location resolved. The numbers
// you plan around are compact stat rows; the frost-risk-by-date curve, the photoperiod note, and every
// provenance/evidence line fold behind a "how we know" disclosure - nothing deleted, the grade stays on
// the row (R-090: always told the tier). Zone, frost and daylength stay DISTINCT rows: three different
// geographic quantities, never conflated (CLAUDE.md, docs/CLIMATE.md).
// cal (D-122): the plot's R-093 frost calibration. Once 3+ logged seasons calibrate a boundary, the
// user's OWN observed date supersedes the model HERE too - the calendar (D-114) and the close nudge
// (D-115) already show the observed date, and this card disagreeing with them read as "my climate
// data isn't reaching the Plan." Same gate, same numbers, model kept visible as the qualifier.
export function renderClimate(res, zone, lat = null, cal = null) {
    const panel = $("climate");
    panel.innerHTML = "";
    delete panel.dataset.copyKey; // the stamp below is true only while the empty-state string shows
    const hasZone = !!(zone && zone.zone != null);
    if (!res && !hasZone && lat == null) {
        panel.textContent = copy.climateEmpty;
        panel.dataset.copyKey = "climateEmpty"; // O54: JS-rendered strings join spot mode
        return;
    }
    const card = document.createElement("div");
    card.className = "climatecard";
    // O82(e): a real h2 - this card is a top-level section of the Calendar page (its only host,
    // #climate), and as an h3 first on the page it skipped the outline straight from the page h1
    // (design_probe flagged h1→h3 on every calendar cell). .cc-title fixes its own size, so the
    // level change is structure, not restyle; an h2 here also precedes the year grid's month-card
    // h3s, so the year view's outline is clean too.
    const h = document.createElement("h2");
    h.className = "cc-title";
    h.textContent = "This ground's climate";
    if (res) {
        const loc = document.createElement("span");
        loc.className = "cc-loc";
        const d = res.distanceKm < 10 ? res.distanceKm.toFixed(1) : Math.round(res.distanceKm).toString();
        loc.textContent = `${d} km from ${titleCase(res.site.key)}`;
        h.appendChild(loc);
    }
    card.appendChild(h);
    const rows = document.createElement("dl");
    rows.className = "cc-rows";
    const row = (label, value, grade) => {
        const dt = document.createElement("dt");
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
    // bold headline value + a muted qualifier (e.g. "~Apr 23" + "· safe after ~May 8")
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
        row("Hardiness zone", val(zone.label ?? String(zone.zone)), zone.grade ?? undefined);
    if (res) {
        const site = res.site;
        const lf = site.last_frost_32f ?? {};
        const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
        const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
        if (springObs) {
            row("Last spring frost", val(`~${humanizeMMDD(springObs)}`, `· your ground's own date (${cal.spring.n} logged seasons, R-093) · model ~${lf.p50 ? humanizeMMDD(lf.p50) : "-"}`));
        }
        else if (lf.p50) {
            row("Last spring frost", val(`~${humanizeMMDD(lf.p50)}`, lf.p10 ? `· safe after ~${humanizeMMDD(lf.p10)}` : undefined));
        }
        if (fallObs) {
            row("First fall freeze", val(`~${humanizeMMDD(fallObs)}`, `· your ground's own date (${cal.fall.n} logged seasons, R-093) · model ~${site.first_freeze_32f_p50 ? humanizeMMDD(site.first_freeze_32f_p50) : "-"}`));
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
        const solstice = lat < 0 ? 355 : 172; // southern vs northern summer solstice
        row("Daylength", val(dayLabel, `· ~${daylightHours(lat, solstice).toFixed(1)} h peak`));
    }
    card.appendChild(rows);
    // The detail, folded: frost-risk curve, the photoperiod gate, and every provenance line.
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
        para("Frost & season", ` - grade ${res.effectiveGrade} (site ${prov.grade ?? "?"}, tier ${prov.tier ?? "?"}, ${prov.method ?? "unknown method"}). ${res.caveat}`);
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
// ---------------------------------------------------------------- role plan (§6.2 render)
// The priced role plan (§6.2), plus C5: the planting window with its R-030 heat gap, the spacing
// table with the corpus's own confidence caveats, and the guild's declared mechanisms with grades.
// A substitution verdict as a sentence - the engine emitted the data (verdict, the lost trait, the
// cited rule, the remedy); the words live here. The bright line D-006/D-007: we never loosen a rule,
// we say what a non-canonical choice costs and what keeps the guild intact.
// O46: it returns its MARKS with its words. The crops this sentence names are the pick the gardener
// just made and the alternates that would keep the guild intact - exactly the names someone reading
// a verdict wants to look up. They travel with the text rather than being recovered from it.
function substitutionSentence(v, bundle, guild) {
    const name = fillerLabel(bundle, v.filler, v.group);
    const remedyNames = v.remediation.map((r) => commonName(bundle, r.filler));
    const remedy = remedyNames.join(", ");
    // The filler leads every branch, so it claims its span first and the alternates take theirs
    // after it. A verdict with no remediation contributes no marks beyond the pick itself.
    const marks = [{ label: name, species: v.filler, group: v.group ?? null }];
    v.remediation.forEach((r, i) => marks.push({ label: remedyNames[i], species: r.filler }));
    const said = (text) => ({ text, marks });
    // A bigger pick needs more ground than the canonical the guild's minimum budgets. Surfaced on
    // every non-blocked verdict: eligible on its own gates, but the bed may still be too small for it.
    const space = v.extra_footprint_m2 > 0 && v.effective_footprint_min_m2 != null
        ? (v.footprint_exceeds_bed
            ? ` It needs more room, though: this pushes the guild to ~${fmtArea(v.effective_footprint_min_m2)}, over your bed.`
            : ` It also needs a bit more room (~${fmtArea(v.effective_footprint_min_m2)} for the guild).`)
        : "";
    if (v.verdict === "clean") {
        return said(`${name} works as the ${humanize(v.role)} - it does that job, nothing is lost.${space}`);
    }
    if (v.verdict === "adaptation") {
        const lost = v.predicate_fails.map(humanizeFamilies).join("; ");
        // name the exact forfeited mechanism(s) from the corpus role: tags, with grade
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
// A VARIETY'S OWN NAME, when it has one (maintainer, 2026-07-25). A cultivar group may carry its own
// `common` in the corpus, and seven of them do: Brassica oleracea's groups are broccoli, kale,
// cauliflower, brussels sprouts, kohlrabi, collards and cabbage. Labelling those by group id rendered
// BOTANICAL names at the user - "Italica", "Gongylodes", "Acephala" - for plants that have perfectly
// ordinary English ones. A gardener does not shop for a variety of cabbage called Gongylodes.
//
// So: a group with its own common name IS the option's name, standing alone. A group without one is a
// qualifier on its species ("cucumber - bush", "tomato - determinate"), which is right - a bush
// cucumber is a kind of cucumber in a way that kohlrabi is not a kind of cabbage.
/** A species that must be bought as a NAMED cultivar, with the corpus's own reason — or null.
 *
 * `cultivar_required` is not a cultivar_group: a group is one of several forms the species takes and
 * the user picks between them, whereas this says the OTHER forms are not safe to plant. Comfrey is
 * the only carrier today (`bocking_14`, "Sterile. Seeding comfrey is permanent and unwelcome.") and
 * the distinction is the whole point — the sterile hybrid is what makes it safe in a guild, where
 * seeding Symphytum officinale would not be. See its species note and ISSUES #14. */
function cultivarRequirement(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const cultivar = typeof sp?.cultivar_required === "string" ? sp.cultivar_required : "";
    if (!cultivar)
        return null;
    const reason = typeof sp?.cultivar_reason === "string" ? sp.cultivar_reason.trim() : "";
    // titleCase because a cultivar is a proper name — 'Bocking 14', never 'bocking 14'. The corpus
    // keeps the id lowercase and snake_cased, and the DISPLAY layer cases it, as groupLabel does.
    return { cultivar: titleCase(humanize(cultivar)), reason: stripRuleCitations(reason) };
}
/** How long before this plant fruits, in the corpus's own numbers — or null.
 *
 * `years_to_bearing` is on 8 fruiting perennials and, until 2026-07-26, was read by nothing (ISSUES
 * #15). It belongs on the role line for the same reason the cultivar requirement does: it is a
 * DECISION INPUT, not a footnote. A gardener choosing between the canopy options is choosing between
 * sour cherry at 2-5 years and pear at 3-8, and the whole premise of a perennial guild is the wait.
 * Shown on every eligible option, because the swap control below can pick any of them.
 *
 * The band is [soonest, latest] and is quoted as a band on purpose — rootstock, cultivar and site
 * move it, and this corpus does not model any of the three. "about" carries that; a single number
 * would be a precision the source does not have. */
/** How many DIFFERENT cultivars this species needs to set fruit, or null if it is not that kind of
 *  plant. Apple and pear are the two carriers.
 *
 *  This is not the same requirement as `min_plants`, and conflating them is the failure it exists to
 *  stop: R-080's claim is "2+ genetically distinct plants" and its mechanism is S-allele rejection,
 *  so two trees of the SAME variety satisfy any plant count and set no fruit. `min_cultivars` said
 *  so all along and was read by nothing (ISSUES #15). The engine cannot VERIFY distinctness — a
 *  cultivar is not modelled as an identity here — so everything downstream states the requirement
 *  rather than claiming it is met. */
/** Why this plant gets no predicted dates, when it does not — or null.
 *
 * `scheduling_model: gdd` means the crop is timed by ACCUMULATED HEAT, not by a day count. Corn is
 * the only species in the corpus that carries it, and there is no GDD accumulator in this engine
 * (dispatch.py has said so in its own docstring since it was written). Every Calendar path is gated
 * on `scheduling_model === "dtm"`, so corn produces no sow recommendation and no harvest window —
 * it is simply absent, with no explanation anywhere.
 *
 * DECLINING TO PREDICT IS CORRECT: corn carries `days_to_maturity` too, and using it would present a
 * day-count answer for a crop the corpus says is heat-driven — the same move invariant 3 forbids for
 * fertilizer. CLAUDE.md is explicit that a GDD model is real for corn and must not be faked. What was
 * missing is the SAYING. `gdd_base_c` was among the fields nothing read (ISSUES #15) and is the base
 * temperature that accumulator would need. See ISSUES #20. */
function schedulingNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    if (sp?.scheduling_model !== "gdd")
        return null;
    return "no sowing or harvest dates for this one - it is timed by accumulated heat "
        + "(growing-degree days), which this app does not compute yet";
}
/** Where this plant is flagged invasive, in the corpus's own words — or null.
 *
 * CLAUDE.md, under "what not to do": *"Do not recommend a woody nitrogen fixer without checking the
 * state noxious weed list. See R-082."* The corpus obeys that for the one species it BLACKLISTED
 * (autumn olive, excluded from the fixer role by name) and, until 2026-07-26, not at all for the one
 * it merely FLAGGED: `amorpha_fruticosa` is a shrub, fixes nitrogen, is offered as an alternative in
 * that same fixer role, and carries `invasive_status: {regions: [EU, western_US]}` — read by nothing
 * (ISSUES #15). A gardener in Oregon was offered it with no warning at all.
 *
 * THIS DOES NOT GATE, and that is deliberate. `regions` mixes state codes with region names
 * (`CA`, `OR`, `WA` beside `western_US`, `EU`), and there is no state-to-region map in this corpus.
 * Inventing one to decide whether to hide a plant from a given gardener would be exactly the guess
 * R-082 exists to forbid. So it TELLS, in the corpus's words, and points at the list R-082's own
 * remedy points at. See ISSUES #19. */
function invasiveNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const inv = sp?.invasive_status;
    if (!inv)
        return null;
    // A two-letter code is a state and stays upper-case; anything else is a region name to humanize.
    const where = (inv.regions ?? []).map((rg) => /^[A-Za-z]{2}$/.test(rg) ? rg.toUpperCase() : humanize(rg));
    const note = (inv.note ?? "").trim();
    const head = where.length ? `flagged invasive in ${where.join(", ")}` : "flagged invasive";
    return `${head}${note ? ` - ${stripRuleCitations(note)}` : ""} Check your state noxious weed list before planting it.`;
}
/** Whether this plant will take the bed if it is simply left alone, in the corpus's own words — or
 * null (ISSUES #14).
 *
 * `spreads_unbidden` is keyed on RUNNING, not on spreading: does the plant move without being cut or
 * tilled. That wording is doing work. Comfrey spreads vegetatively but only from disturbed roots, and
 * lemon balm spreads by seed and is bounded by deadheading — both are on rosters, both are right to
 * be, and a plain "spreads" flag would have evicted them. Spearmint is the only carrier.
 *
 * The validator keeps a runner off every guild roster (E-SPREADS), so a guild role line can never
 * show this. THIS is the surface that can: My-bed is where the gardener picks the plant themselves,
 * and spearmint's "contain it in a buried pot or a dedicated bed or it takes the plot" has been in
 * the species note since long before anything rendered, read by nobody.
 *
 * Shown even in a bed of its own, because a runner does not stop at the bed edge — the corpus's
 * reason names both remedies and it is the corpus's sentence, not a paraphrase. */
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
    const name = commonName(bundle, species);
    if (!group)
        return name;
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const groups = Array.isArray(sp?.cultivar_groups)
        ? sp.cultivar_groups : [];
    const g = groups.find((x) => String(x.id) === group);
    const own = typeof g?.common === "string" ? g.common
        : Array.isArray(g?.common) ? String(g.common[0]) : "";
    // A group's own name is ALWAYS the label when it has one - which also handles the group that
    // repeats its species ("Cabbage" for capitata, never "Cabbage - Capitata"). titleCase because the
    // corpus keeps `common` lowercase and the DISPLAY layer cases it uniformly (state.ts's commonName
    // does the same for species); without it the picker would mix "Broccoli" and "broccoli".
    if (own)
        return titleCase(own);
    return `${name} - ${humanize(group)}`;
}
// A filler's display label with its cultivar group made visible: "summer squash - zucchini",
// "cucumber - bush", and now "broccoli" rather than "cabbage - Italica". The swap options key by
// species id alone, so without the group a bush and a vining pick of the same species read
// identically - naming the group is what makes zucchini (a cultivar group of Cucurbita pepo, not a
// separate species) legible where it was invisible before.
function fillerLabel(bundle, filler, group) {
    return groupLabel(bundle, filler, group);
}
// Guild role swaps survive a card re-render (the Gap B follow-up). The card's selects are rebuilt on
// every draw(), which used to reset a swap to the canonical before you could save it. This session store
// - keyed by bed|guild|role, mirroring myBedConfigs' per-bed model - remembers each pick so the rebuilt
// select restores it. Session-only working state; the SAVE is what writes the choice to the plan entry.
const guildRoleChoices = new Map();
const roleChoiceKey = (bed, guildId, role) => `${bed}|${guildId}|${role}`;
const candbedValue = () => document.getElementById("candbed")?.value ?? "";
// The swap a role should OPEN on when its card renders: this session's pick first, else a swap already
// SAVED on the open season's plan entry (so revisiting a saved plan shows it), else null (canonical).
function restoreRoleChoice(bed, guildId, role) {
    const live = guildRoleChoices.get(roleChoiceKey(bed, guildId, role));
    if (live)
        return live;
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => {
        const r = e;
        return r.area === bed && r.guild === guildId;
    });
    return entry ? roleOverridesOf(entry).get(role) ?? null : null;
}
// Point a role select at a (species, group) option - matching the group too, since one species can have
// several group-pinned options (squash bush/vining/zucchini). Falls back to any option of that species.
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
    const members = memberSpecies(guild); // bundle-class guilds carry members, not roles
    const filled = inst.roles.filter((r) => r.chosen).length;
    // O84: this was the ONE disclosure in the app with no chevron - a bare summary that showed only
    // the tiny default marker and read as inert bold text, so the real plan behind it (the per-job
    // fillers, counts, swap select, placement) looked un-openable. Give it the app's rotating
    // chevron and accent colour, the .teamsummary / .cc-more pattern, so it reads as a control.
    sum.className = "roleplansum";
    const rchev = document.createElement("span");
    rchev.className = "chev";
    rchev.textContent = "▸";
    rchev.setAttribute("aria-hidden", "true");
    sum.append(rchev, document.createTextNode(inst.roles.length
        ? `Plan: ${filled} of ${inst.roles.length} jobs can be filled here`
        : `Plan: ${members.length} plants`));
    det.appendChild(sum);
    // The bed being planned (for the fill counts, D-055): a picked logged bed's shape else the entered
    // width×length. Read once here so the per-role "plant N" note and the placement agree.
    const earlyBed = app.logSnapshot.beds.find((b) => b.name === (document.getElementById("candbed")?.value ?? ""));
    const earlyRegion = planBedRegion(earlyBed);
    // PLANTABLE area (D-142 review, F-2): the fill sizes to the bed LESS its reserved lanes/paths, the
    // same base My-bed Optimize uses - counts sized to the whole bed then squeezed into the strips
    // rendered (and planted) as overcrowded rows.
    const bedAreaEarly = earlyRegion ? plantableArea(earlyRegion, bedStructure(earlyBed, guild), earlyBed?.lane_flip ?? false) : null;
    const nSpeciesEarly = inst.roles.length || members.length;
    // The per-role planting count for the "(plant N)" note - group-scaled the same way the placement
    // is, so the two agree (D-055), computed off each role's chosen/canonical filler.
    const earlyCounts = scaledFillCounts(inst.roles.map((rr) => ({ resolved: resolveSpecies((rr.chosen ?? rr.canonical ?? ""), null, bundle), density: roleDensity(guild, rr.role) })), bedAreaEarly, nSpeciesEarly);
    const roleCountById = new Map(inst.roles.map((rr, i) => [rr.role, earlyCounts[i]]));
    // The role swap <select>s, collected so the placement can follow the user's picks (not just the
    // canonical) - swapping sunflower into the support role puts sunflower in the layout.
    const roleSelects = [];
    for (const rr of inst.roles) {
        const p = document.createElement("p");
        p.className = "role";
        const head = document.createElement("strong");
        head.textContent = `${humanize(rr.role)}: `;
        p.appendChild(head);
        // O46: each bit remembers WHICH plant its sentence is about, so the name can link after the
        // bits are joined. `species` is null for a filler that is not a plant at all (a trellis
        // structure standing in for corn) and for the two trailing notes below - those render plain.
        const bits = [];
        const asSpecies = (id) => bundle.species.some((sp) => sp.id === id) ? id : null;
        for (const o of rr.options) {
            const name = fillerLabel(bundle, o.filler, o.group);
            if (o.eligible) {
                let s = o.filler === rr.chosen ? `${name}` : `or ${name}`;
                // How many of the chosen filler this role needs (corn a block of 12, tomatillo a pair) -
                // makes the planting quantity clear on the guild card, not just the role (D-054).
                if (o.filler === rr.chosen) {
                    const n = roleCountById.get(rr.role) ?? 1;
                    if (n > 1)
                        s += ` (plant ${n})`;
                }
                if (o.kind !== "canonical" && o.cost)
                    s += ` (cost: ${stripRuleCitations(o.cost.trim())})`;
                if (o.cost_tags.length)
                    s += ` [${o.cost_tags.map(humanize).join(", ")}]`;
                // A species that is only safe as a NAMED CULTIVAR says so here, on the line that names it.
                // The corpus has carried `cultivar_required` since before this rendered anything: it ships in
                // app-bundle.json and, until 2026-07-26, was read by nothing at all - so comfrey's "Sterile.
                // Seeding comfrey is permanent and unwelcome." was a warning the corpus knew and the gardener
                // never saw. Shown on EVERY eligible option rather than only the chosen one, because the
                // requirement is a purchasing instruction and the swap control below can pick any of them.
                const req = cultivarRequirement(bundle, o.filler);
                if (req)
                    s += ` - needs the '${req.cultivar}' cultivar: ${req.reason}`;
                // The WAIT, for anything that fruits. Same reasoning as the cultivar requirement above: the
                // corpus has carried `years_to_bearing` on eight fruiting perennials since before this
                // rendered anything, and a gardener picking a canopy is choosing between a 2-5 year wait and
                // a 3-8 year one with no way to see it (ISSUES #15).
                const wait = bearingNote(bundle, o.filler);
                if (wait)
                    s += ` - ${wait}`;
                // ...and whether one tree is enough. The guild has a single canopy role, so the plan shows
                // ONE apple and the gardener plants one; R-080 only speaks up afterwards, on a bed that has
                // already been planted. Said here it is a purchasing instruction, which is when it is
                // actionable - and it is why the two are worth distinguishing: sour cherry needs no partner
                // and apple needs a second VARIETY, and that difference decides which tree to buy.
                const cv = cultivarPartner(bundle, o.filler);
                if (cv)
                    s += ` - needs ${cv} different varieties nearby to set fruit (two of the same will not do)`;
                // ...and whether the corpus has flagged it invasive somewhere. Shown on every eligible
                // option for the same reason as the others: this is a decision made at the nursery, and the
                // role's swap control can pick any of them.
                const inv = invasiveNote(bundle, o.filler);
                if (inv)
                    s += ` - ${inv}`;
                // ...and whether the Calendar will be able to date it at all. Silence about an absence reads
                // as an oversight; the absence here is a deliberate refusal to fake a number.
                const sched = schedulingNote(bundle, o.filler);
                if (sched)
                    s += ` - ${sched}`;
                // ...and the warm end of its hardiness band (R-076, ISSUES #13 option E). Above the modelled
                // ceiling the plant is OFFERED, not greyed, because the true warm limit is a cultivar's — so
                // this rides on the eligible line as a purchasing note (choose a cultivar rated for the zone),
                // exactly like the cultivar/bearing/invasive notes above, never as a refusal.
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
        // Swap-in control: offer the plants APPROVED for this role - its canonical, any non-plant
        // substitute, and its curated alternatives (rr.options) - PLUS the user's OWN added varieties
        // (D-046). A user variety (source:"user", id "user:<slug>") is always available in any role: they
        // chose to add it, and rules fire on the pick via substitutionVerdict. This is NOT the whole
        // corpus - only the user's own species - so the curated browser stays curated for corpus plants;
        // open all-corpus selection remains the configurable/flexible garden's job (Phase F). Each pick
        // shows the verdict: clean (mechanism holds) / adaptation (mechanism lost), with the cost.
        const active = activeBundle(bundle);
        const sub = document.createElement("div");
        sub.className = "subst";
        const sel = document.createElement("select");
        sel.dataset.guild = guild.id;
        sel.dataset.role = rr.role;
        const listed = new Set();
        const fillers = [];
        // A role option is (species, cultivar group). The <option> value carries only the species id, so
        // the group rides along in a data attribute and is read back on pick - otherwise a group-pinned
        // alternative (zucchini, a bush cucumber) would resolve to the species' default group and its
        // verdict would be wrong.
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
        // Default the selection to the first approved species so the control opens on a real pick, not an
        // empty prompt - its verdict renders immediately. Only when nothing is selectable (the future
        // flexible-guild state, where a role has no predefined species and selection is open) do we fall
        // back to a "swap in a plant…" placeholder for the user to choose from.
        // O73b (maintainer, 2026-08-12): on a RESTORATIVE guild, an optional role defaults to SKIP -
        // a rest bed is the cover-crop stand, and auto-conscripting the optional overwinter garlic at
        // a coequal half-bed share made "a rest for the soil" read as half an allium crop. Scoped to
        // the restorative class only: the Four Sisters' optional squash cover and milpa's optional
        // quelites stay in their default plans (the sisters' cover IS the guild's mechanism; milpa's
        // density is a corpus value). The garlic stays one tap away in this same control, and a saved
        // pick restores like any other swap.
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
        // Remember the default (species + group) this select opened on, so a SAVE can store only what the
        // user actually CHANGED (Gap B deltas) - a role left untouched keeps tracking the corpus canonical.
        // Captured BEFORE the restore below, so the delta is always measured against the canonical default.
        sel.dataset.initSpecies = sel.value;
        sel.dataset.initGroup = sel.selectedOptions[0]?.dataset.group ?? "";
        // Restore a swap that would otherwise be lost when draw() rebuilds this select (Gap B follow-up):
        // this session's pick, else one already saved on the plan entry. Then a change writes back to the
        // store so the next re-render keeps it.
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
            // The role's OWN canonical is the guild's vetted default - never warn that it is a "looser
            // version." Corn is a weak-but-sufficient living support; it technically fails its own
            // support.provides:strong predicate (ISSUES#3), which must not surface as a yellow warning on
            // the default Three Sisters. Only a USER swap to a DIFFERENT plant carries the adaptation note.
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
        // O45 option A: a list of names is a list of links. Built name-by-name from the ids the list
        // was built from - `join`ing the labels and then hunting for them in the result would be the
        // prose-scanning this arc rules out.
        p.appendChild(document.createTextNode("contains: "));
        members.forEach(([sid, grp], i) => {
            if (i)
                p.appendChild(document.createTextNode(", "));
            p.appendChild(plantLink(commonName(bundle, sid), sid, grp ?? null));
        });
        det.appendChild(p);
    }
    // `marks` (O46) is how a sentence names its crops: each entry is a label this caller
    // interpolated, alongside the id it built that label from, and those spans become links to their
    // cards. Omitted, the text is set as plain text exactly as before - nothing here ever searches a
    // sentence for a plant name, and a label the sentence does not contain simply links nothing.
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
    // C5 calendar: the window this site allows, and whether summer heat carves a gap out of it.
    const w = plantingWindowFor(site.lat ?? null, site.lon ?? null, chosenIds, bundle);
    if (w) {
        h("p", "window", `Season here: last frost ~${w.last_frost_p50 ?? "?"} → first freeze ~${w.first_freeze_p50 ?? "?"} ` +
            `(~${w.growing_season_days ?? "?"} frost-free days).`);
        for (const hw of heatWarnings(chosenIds, site.lat ?? null, site.lon ?? null, bundle)) {
            const label = commonName(bundle, hw.species);
            const line = h("p", "heat", "");
            linkNameIn(line, `${label} - summer night min ${fmtTemp(hw.night_c)} exceeds ${fmtTemp(hw.night_max_c)}; expect a midsummer gap when it's too hot to set fruit.`, label, hw.species);
            line.title = ruleClaim(bundle, "R-030");
        }
    }
    // C5 spacing: numbers straight from the corpus, with its own confidence doubts shown.
    const rows = spacingRows(chosen, bundle).filter((r) => r.spread_cm !== null || r.days_to_maturity !== null);
    // Which cultivar each row's link should open. `SpacingRow` carries no group and is not widened
    // to add one: it is an ENGINE type with a Python oracle and conformance goldens, and a display
    // link is not a reason to move a frozen shape. The groups come from the same `chosen` list the
    // rows were computed from. A species chosen twice under DIFFERENT groups resolves to null - the
    // bare species card - on O41's rule: showing one cultivar's numbers under a name the gardener
    // did not pick is the untruth, and silence is not.
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
            // O45 option A, ruled 2026-08-02: the species column links too. The accent-coloured column
            // is a real cost in a table whose NUMBERS are the point, and it was weighed - any option
            // that leaves some names plain leaves "which of these is tappable?" askable, which is the
            // complaint this arc exists to close.
            const nameCell = document.createElement("td");
            nameCell.appendChild(plantLink(commonName(bundle, r.species), r.species, groupOfChosen.get(r.species) ?? null));
            tr.appendChild(nameCell);
            td(r.spread_cm === null ? "-" : fmtCm(r.spread_cm));
            td(r.height_cm === null ? "-" : fmtCm(r.height_cm));
            td(r.days_to_maturity === null ? "-" : `~${r.days_to_maturity}`);
            td(r.flags.join(", "));
            table.appendChild(tr);
        }
        // Wrap in a horizontal scroller: in a narrow card (a variant sub-card especially) the spacing
        // table can be wider than the column, and the page body must never scroll sideways.
        const scroll = document.createElement("div");
        scroll.className = "tscroll";
        scroll.appendChild(table);
        det.appendChild(scroll);
    }
    // C5 rulings-with-mechanism: the guild's declared claims, graded, citing their rules -
    // invariant 1 as UI. No mechanisms means saying so, not inventing one.
    const mech = mechanismRows(guild, bundle);
    for (const m of mech.rows) {
        const detail = m.rule && m.rule_mechanism ? ` - ${m.rule_mechanism}` : "";
        const el = h("p", "mech", `${stripRuleCitations(m.claim)}${detail}`);
        // Carry the landing's plain-language confidence badge onto the mechanism (D-083): the corpus
        // GRADE in the homepage's own words, PER mechanism, so a mixed guild reads honestly (two "Well
        // established" + one "Promising", never one collapsed label). The precise evidence line is elsewhere.
        const badge = confidenceBadge(m.grade);
        if (badge) {
            el.appendChild(document.createElement("br"));
            el.appendChild(badge);
        }
        if (m.rule)
            el.title = ruleClaim(bundle, m.rule);
    }
    if (!mech.rows.length && mech.honesty_note)
        h("p", "honesty", stripRuleCitations(mech.honesty_note));
    // Placement (Phase 3 / F2) - VISIBLE on the card, not buried in the collapsed details
    // (live feedback: nobody found it there). Renders for the ground selected under "This
    // ground"; nudges when areas exist but none is picked; and the configuration can be SAVED
    // into the open season's plan.
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
    // The plants to lay out follow the user's CURRENT role picks (the swap <select>s), not just the
    // canonical - so swapping sunflower into the support role puts sunflower in the layout. Non-plant
    // fillers (a trellis structure) carry no spread and drop out, which is why a small bed defaulting
    // to a trellis support shows two plants until a real plant is picked for it.
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
    // Gap B: the per-role swaps the user actually made - species and/or cultivar group DIFFERENT from the
    // default the select opened on. Stored on the plan entry so the swapped variety is what actually gets
    // PLANTED (materializeDraftInto), mapped (appliedPlanDots), and scheduled (Calendar). Only deltas are
    // kept; a role left at its default keeps tracking the corpus canonical.
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
    // D-056 rings archetype: a woody guild's understory sits in rings out from the trunk, ordered by
    // the corpus's own semantics - bulbs at the trunk (R-075), mulch/fixer under the canopy, insectary
    // at the drip edge (R-052). The tree (canopy) is the centre.
    const isRadial = guild.ground_entity === "radial_rings";
    const RING_ORDER = ["canopy", "bulb_ring", "mulch_producer", "fixer", "insectary"];
    // D-056 hills archetype: an interplanted polyculture (Three Sisters / Four Sisters / milpa) is a
    // grid of mounds, not bands - the `support` role marks it (corn or a trellis carrying climbers;
    // a companion pair like brassica+herbs has no support, so it stays rows). Corn + beans cluster ON
    // the mounds together (Cornell: same hills); the squash and other ground crops fill the gaps.
    const MOUND_ROLES = new Set(["support", "fixer"]);
    // A thinned hill holds ~4 corn (support) and ~3 beans (fixer), not the whole seed density (D-065) -
    // cap what a single mound shows so a small bed stops suggesting 47 corn stacked on nine mounds.
    const MOUND_CAP = { support: 4, fixer: 3 };
    const isHills = laysOutAsHills(guild); // shared D-056 dispatch (guilds.ts) - the map reads the same predicate
    // D-057 interplant grid: a culinary bundle (salsa/pizza/salad) or a companion PAIR (brassicas +
    // aromatic herbs - a polyculture with no support role, so not hills) isn't a tall-vs-short bed.
    // It lays out as ONE uniform grid over the whole bed, taller species poleward, filling it evenly -
    // not per-species strips. Open "My bed" and single-species covers keep the height-banded rows.
    const isGrid = !isRadial && !isHills
        && (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle"
            || guild.guild_class === "polyculture" || guild.guild_class === "restorative");
    // D-068: a restorative "rest year" (rotation break) is a COVER CROP, not a harvest bed - the legume
    // covers the whole bed as a green-manure stand and the optional overwinter crop shares the ground.
    // It uses the same uniform-fill grid, but reads and is framed as a rest bed, not a tall-vs-short plan.
    const isRest = guild.guild_class === "restorative";
    // The apply action - save this guild to the picked bed's season plan (starting the season
    // inline when none is open). Rendered into the card-top applyWrap, fit-gated, and NOT behind
    // the placement gate: applying needs a bed, not a drawable layout.
    const paintApply = () => {
        if (!applyWrap)
            return; // only fitting cards hand one in (rolePlan is fit-gated)
        applyWrap.innerHTML = "";
        const pa = (text) => {
            const e = document.createElement("p");
            e.className = "hint";
            e.textContent = text;
            applyWrap.appendChild(e);
        };
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        // With several saved beds, WHICH bed is part of applying (walkthrough round 6): an inline
        // picker above the save button mirrors the "Your ground" choice - switching beds re-runs
        // the whole plan for the new bed without leaving the card. One source of truth: this
        // select just drives #candbed and lets its change handler do the full redraw.
        // ISSUES #12: a sectioned parent is a pure container - drop it here too (mirrors #candbed), so
        // this list stays in lock-step with the option set #candbed actually holds. Gating on the
        // plannable count avoids showing a redundant one-option picker.
        const plannableBeds = app.logSnapshot.beds.filter((b) => !bedHasSections(b.name, app.logSnapshot.beds));
        if (bed && plannableBeds.length > 1) {
            const cand = document.getElementById("candbed");
            const row = document.createElement("label");
            row.className = "applybed";
            row.append("apply to bed: ");
            const sel = document.createElement("select");
            for (const b of plannableBeds) {
                const o = document.createElement("option");
                o.value = b.name;
                o.textContent = b.name;
                sel.appendChild(o);
            }
            sel.value = bed.name;
            sel.addEventListener("change", () => {
                cand.value = sel.value;
                cand.dispatchEvent(new Event("change"));
            });
            row.appendChild(sel);
            applyWrap.appendChild(row);
        }
        if (bed && app.logSnapshot.seasonId != null) {
            const openSeason = app.logSnapshot.seasons.find((sn) => sn.id === app.logSnapshot.seasonId);
            // D-135 three states. `planted` = the bed already carries real occupancy (it's in the ground);
            // re-planning it happens on the Log (clear it there first), so its button is locked here for every
            // team. `draftedHere` = THIS team is the bed's current draft; its button reads "saved as a draft"
            // and points at the Log to plant it. Any OTHER team stays a live "save as a draft" that replaces
            // the draft. A stale plan entry with no occupancy is just a draft - never a lock.
            const planted = (openSeason?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region));
            const draftedHere = (Array.isArray(openSeason?.plan) ? openSeason.plan : [])
                .some((e) => e.area === bed.name && e.guild === guild.id);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "saveplan";
            if (planted) {
                btn.textContent = `"${bed.name}" is planted - manage it on the Log (season ${app.logSnapshot.seasonId})`;
                btn.disabled = true;
            }
            else if (draftedHere) {
                btn.textContent = backendConfigured() && !isSignedIn()
                    ? `draft saved: ${displayName(guild)} → "${bed.name}" - a free account (below) lets you plant it`
                    : `draft saved: ${displayName(guild)} → "${bed.name}" - mark it Planted on the Log`;
                btn.disabled = true;
            }
            else {
                btn.textContent = `save as a draft: ${displayName(guild)} → "${bed.name}" (season ${app.logSnapshot.seasonId})`;
                btn.addEventListener("click", () => void savePlanSelection(guild.id, bed.name, btn, bundle, site, roleSwapDeltas()));
            }
            applyWrap.appendChild(btn);
        }
        else if (bed) {
            // No sign-in gate here (maintainer's ruling, walkthrough round 4): seasons are
            // browser-local data (D-013), so applying a guild works before any account exists.
            // The account comes AFTER - the handoff banner below the results invites it once a
            // plan is taking shape, and signing in then syncs what was built.
            const year = new Date().getFullYear();
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "saveplan";
            btn.textContent = `start season ${year} & save as a draft: ${displayName(guild)} → "${bed.name}"`;
            btn.addEventListener("click", () => void (async () => {
                btn.disabled = true;
                try {
                    if (!app.logDb)
                        throw new Error("the garden log isn't ready yet - try again in a moment");
                    if (!(await getSeason(app.logDb, app.currentPlotId, year))) {
                        await putSeason(app.logDb, { id: year, plot: app.currentPlotId, plantings: [], observations: [] });
                    }
                    await app.logRefresh?.(); // the refresh selects the newest season → seasonId is set
                    if (app.logSnapshot.seasonId == null)
                        throw new Error("season did not open - check the Log tab");
                    await savePlanSelection(guild.id, bed.name, btn, bundle, site, roleSwapDeltas());
                }
                catch (e) {
                    btn.textContent = `${e instanceof Error ? e.message : e}`;
                    btn.disabled = false;
                }
            })());
            applyWrap.appendChild(btn);
        }
        else {
            pa("pick a saved area under “Your ground” (or save one on the map) and this team can be applied to it.");
        }
    };
    const paintPlacement = () => {
        placeWrap.innerHTML = "";
        paintApply();
        const chosenNow = placementChosen();
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        // Every guild lays out over the actual bed (a picked logged bed, else the entered width×length).
        // A woody guild becomes an ORCHARD tiled over that bed (D-058): trees spaced at their drip-line
        // diameter (2·tree_r, from the guild footprint), one tree for a bed that fits exactly one.
        const region = planBedRegion(bed);
        const treeR = isRadial ? (radialRingsFromFootprint(guild.footprint_min_m2 ?? 0)?.r ?? 0) : 0;
        const plantRows = spacingRows(chosenNow.map((c) => [c.sid, c.group]), bundle).filter((r) => r.height_cm !== null || r.spread_cm !== null);
        // A rest bed lays out from ONE row (O73b): with the optional overwinter defaulting to skip,
        // the cover-crop stand is a single species across the whole bed - exactly the layout D-068
        // frames - and requiring two rows would blank the panel the moment the skip default landed.
        // Every other archetype keeps the >= 2 floor (one plant has no tall-vs-short to arrange).
        if (!(region && site.lat != null && plantRows.length >= (isRest ? 1 : 2)))
            return;
        const r003 = bundle.rules.find((x) => x.id === "R-003");
        // How many of each chosen filler to plant, FILLING the bed (D-055): a guild role's sourced
        // planting density (× the whole shared bed) gives the researched ratio, else each species fills
        // its share at its recommended spacing. The band and per-plant grid size to that.
        const bedArea = plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false); // less lanes/paths (F-2)
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
        const layoutKind = isRadial ? "orchard" : isHills ? "hills" : isGrid ? "grid" : "rows";
        // Plan around occupancy (D-117): keep the new layout OFF any perennial this bed carried forward.
        const occupied = carriedOccupancy(bed);
        const pl = place(plantRows.map((r) => ({ id: r.species, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countBySpecies.get(r.species) ?? 1, ring: ringBySpecies.get(r.species), mound: moundBySpecies.get(r.species), mound_cap: moundCapBySpecies.get(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
        const bedLabel = bed ? `"${bed.name}"` : "your bed";
        const mounds = pl.mounds ?? [];
        const trees = pl.trees ?? [];
        const ringsGuide = pl.rings_guide ?? [];
        const accessBands = pl.access_bands ?? [];
        const bedOutline = regionPoints(region);
        // The crops the intro sentence NAMES, filled in by the branch that names them. Only the hills
        // branch does: every other intro talks about the bed, the layout and the sun, and a generic
        // word in one of them ("the squash and ground crops fill the gaps") was NOT built from an id
        // and must not be linked on the strength of reading like a crop.
        const introMarks = [];
        // Built before the element, not inline in the `ph(...)` call: the hills branch FILLS
        // `introMarks` as a side effect of composing its sentence, and relying on left-to-right
        // argument evaluation to have run it first is the kind of correctness that holds by luck.
        // The centre's HABIT words the radial copy (QA sweep 2026-08-12): the blackberry ring's
        // centre is a bramble, the currant's a shrub, the grape's a vine on its arbour - "the tree"
        // and "bulbs at the trunk" were hardcoded from the fruit-tree guilds and read wrong on all
        // four non-tree rings. The tree keeps its richer sentence; the orchard branch stays
        // tree-only (nothing else produces multiple centres).
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
                // Name the ACTUAL support: the trellis small-bed lays out as hills too, and "the corn and
                // beans share each mound" on a corn-less team read as a bug (fill round 3, maintainer).
                ? (() => {
                    const supp = chosenNow.find((c) => c.role === "support");
                    const fix = chosenNow.find((c) => c.role === "fixer");
                    const fixName = fix ? commonName(bundle, fix.sid).toLowerCase() : "climbers";
                    // A trellis is not a species and has no card; the "support crop"/"climbers" fallbacks
                    // are not names at all. Only a mark backed by an id goes in.
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
                : isRest
                    ? `Where in ${bedLabel} - sown across the whole bed as a cover crop to rest the ground: the legume stand banks nitrogen and crowds out weeds, shedding disease pressure before the next crop:`
                    : isGrid
                        ? (pl.zones.some((z) => z.tiled === false)
                            ? `Where in ${bedLabel} - the tall crops banded to the ${pl.polar} (so their shadow falls off the bed), the similar-height rest interplanted through the space as one mixed motif:`
                            : `Where in ${bedLabel} - one mixed planting interplanted across the bed, every crop a similar height so none shades another:`)
                        : `Where in ${bedLabel} (tallest plants to the ${pl.polar}, so their midday shadow falls off the bed instead of over a shorter neighbour):`;
        const introEl = ph("p", "window", introText, introMarks);
        introEl.title = ruleClaim(bundle, isRest ? "R-015" : "R-003");
        // Mature-spread RADIUS in metres per species, from the same group-resolved rows the engine was
        // given - the sprawl halo's only input (see haloR).
        const spreadR = new Map(plantRows.filter((r) => r.spread_cm).map((r) => [r.species, r.spread_cm / 200]));
        const svg = placementSvg(pl.zones, bundle, mounds, bedOutline, ringsGuide, accessBands, spreadR);
        if (svg)
            placeWrap.appendChild(svg);
        const opp = pl.polar === "north" ? "south" : "north";
        const colours = zoneColorMap(pl.zones);
        // Radial zones come centre-first, out to the drip line; label each ring by its position. Hills
        // zones label by whether the species sits on the mounds or fills the gaps between them.
        pl.zones.forEach((z, i) => {
            // A zone whose whole count fell on occupied ground reads "plant 0 × …" - say nothing instead
            // (D-123, the D-120 leftover). The band stays on the diagram; there is just nothing to plant.
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
                ? `${trees.length === 1 ? "One tree" : `${trees.length} trees`} with a shade-adapted understory in rings - the layout the guild is built around.`
                : isRest
                    ? "A rest year - the legume banks nitrogen and the stand sheds disease before the next crop. Not a compromise; it's the correct move."
                    : pl.violations.length
                        ? `${pl.violations.length} spot(s) where a taller plant would shade a shorter one - worth rearranging`
                        : "Looks good - nothing tall shades a shorter plant here.");
    };
    for (const sel of roleSelects)
        sel.addEventListener("change", paintPlacement);
    paintPlacement();
    // R-033 timing: a living support (corn) carrying a must-climb vine (pole bean) needs a sow lead -
    // the vine goes in after the support stands, or it pulls an unrooted stalk over.
    const lead = livingSupportLead(guild, bundle);
    if (lead) {
        const climber = commonName(bundle, lead.climber), support = commonName(bundle, lead.support);
        const el = h("p", "lead", `Sow the ${climber} ~${lead.lead_days} days after the ` +
            `${support} is established (~6 in tall), not with it - a vine on an ` +
            `unrooted stalk pulls it over.`, [{ label: climber, species: lead.climber }, { label: support, species: lead.support }]);
        el.title = ruleClaim(bundle, lead.rule);
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(det);
    if (placeWrap.childNodes.length)
        frag.appendChild(placeWrap);
    return frag;
}
// A chosen configuration (guild → area) persists in the OPEN SEASON's `plan` field - the slot the
// D-013 schema reserved for exactly this. It rides everything the season rides: IndexedDB, account
// sync, and the byte-stable export. One configuration per area; re-saving replaces. Under D-135 a
// NAMED-guild save is a DRAFT (intent, not occupancy), so it is inherently non-destructive. The
// destructive-overwrite gate below now guards only the ONE path that still writes occupancy directly:
// the My-bed canvas (D-078), whose arrangement IS real plants and so can clobber a bed on re-save.
const armedOverwrite = new Set();
// keepsCarried: the My-bed save preserves carried-forward overwinterers (D-122) - its canvas laid its
// plants around them (blocked ground) - so the warning must not claim their removal, and a bed holding
// ONLY kept overwinterers overwrites nothing.
function bedOverwriteWarning(bedName, keepsCarried = false) {
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return null;
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    const existing = (season?.plantings ?? []).filter((p) => plantingOnBed(p.region, bed.region));
    const removable = keepsCarried ? existing.filter((p) => p.carried_over !== true) : existing;
    if (!removable.length)
        return null; // nothing this save would remove → free to arrange
    const kept = existing.length - removable.length;
    const keptNote = kept ? ` Your ${kept} overwintering plant${kept === 1 ? " is" : "s are"} kept.` : "";
    const n = removable.length, plants = `${n} plant${n === 1 ? "" : "s"}`;
    const notes = removable.filter((p) => (p.failures?.length ?? 0) > 0 || p.end_cause || p.carried_over).length;
    if (backendConfigured() && !isSignedIn()) {
        return `This replaces your saved bed “${bedName}” (${plants}).${keptNote} Sign in to keep a backup you can restore - tap again to replace.`;
    }
    if (notes) {
        return `“${bedName}” has ${notes} plant${notes === 1 ? "" : "s"} with notes - replacing removes ${n === 1 ? "it" : "them"}.${keptNote} Tap again to replace.`;
    }
    return null; // signed-in, nothing logged yet → re-arrange freely
}
/** Returns null to proceed, or a warning string to show (and arms so the NEXT call proceeds). */
function overwriteGate(bedName, keepsCarried = false) {
    const w = bedOverwriteWarning(bedName, keepsCarried);
    if (!w || armedOverwrite.has(bedName)) {
        armedOverwrite.delete(bedName);
        return null;
    }
    armedOverwrite.add(bedName);
    return w;
}
// D-135: saving a guild plan is now INTENT, never occupancy. It records a DRAFT - a plan entry
// (guild → bed) in the open season, nothing more. The bed shows hollow "planned" dots on the map and
// hollow, model-anchored recommendations on the Calendar, but nothing is "in the ground" until the
// gardener marks it Planted on the Log (markBedPlanted). That transition is where real plantings are
// written, dated to the actual planting day. This removes the old friction where one tap on the Plan
// tap jumped a bed straight to committed, trackable occupancy with no genuine draft stage between.
// Because saving no longer removes anything, the destructive-overwrite gate moved to markBedPlanted.
export async function savePlanSelection(guildId, area, btn, _bundle, _site, roles) {
    if (!app.logDb || app.logSnapshot.seasonId == null)
        return;
    try {
        const season = await getSeason(app.logDb, app.currentPlotId, app.logSnapshot.seasonId);
        if (!season)
            throw new Error("no open season");
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        const kept = plan.filter((e) => e.area !== area); // one draft per bed; re-saving replaces it
        // Gap B: persist the user's role swaps (deltas) so the swapped variety is what actually plants. Only
        // written when there IS a swap, so an unswapped plan entry stays exactly as before.
        kept.push({ area, guild: guildId, saved: new Date().toISOString().slice(0, 10), ...(roles && roles.length ? { roles } : {}) });
        season.plan = kept;
        await putSeason(app.logDb, season);
        countRung("team-applied"); // O29: a team is on a bed - counted after the write, never before it
        toast(`Draft plan saved: “${area}”`); // the transactional float (O12); the button keeps the next step
        // Signed out, the Log/Calendar pages are behind the account lock-panel - point at the account step
        // (the handoff banner below), the moment a draft becomes a real, planted, tracked bed (decision 4).
        btn.textContent = backendConfigured() && !isSignedIn()
            ? "saved as a draft on this device - a free account (below) lets you plant & track it"
            : "saved as a draft plan - mark it Planted on the Log when it’s in the ground";
        btn.disabled = true;
        void app.logRefresh?.();
        // the save reveal (round 10): the map centres on this bed and opens up - groundmap + sheet listen
        window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: area, kind: "team" } }));
    }
    catch (e) {
        btn.textContent = `${e instanceof Error ? e.message : e}`;
    }
}
// Slice-1b (ISSUES #11 follow-up (d): "a re-save writes species+region only"): a re-plant must not
// orphan the ledger. The overwrite keeps the ONE-current-layout rule, but a fresh plant that matches
// a LIVE planting already on this ground (same species + variety) ADOPTS that record - its real sown
// date, notes, failures and harvest fields ride along, and only its region moves to the new spot.
// And an ENDED planting is never dropped at all: it is occupancy HISTORY (rotation and the season
// review read it), and redrawing a layout cannot un-grow what grew. Only a live plant the new
// arrangement genuinely removes is dropped - behind the armed-overwrite confirm, as before. The
// matching is by identity (species+group), not position: the layout is what moved.
export function mergeSurvivingDetail(existing, fresh, bedRegion) {
    const isLiveOnBed = (p) => !p.end_cause && p.carried_over !== true && plantingOnBed(p.region, bedRegion);
    const live = existing.filter(isLiveOnBed);
    const rest = existing.filter((p) => !isLiveOnBed(p)); // carried, off-bed, and ENDED history all stay
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
// Shared core: write a guild draft into a specific season object as real occupancy (sown=today for
// NEW plants; a surviving plant keeps its own record - slice-1b above), and clear the fulfilled plan
// entry from it. Mutates `target` in place and returns the count. Callers persist `target` and set
// the bed's planted flag.
function materializeDraftInto(target, bed, guild, site, bundle, today, overrides) {
    const fresh = guildPlantings(guild, bed, site, bundle, overrides).map((p) => ({ ...p, sown: today }));
    const { rest, merged } = mergeSurvivingDetail(target.plantings ?? [], fresh, bed.region);
    target.plantings = [...rest, ...merged];
    target.plan = (Array.isArray(target.plan) ? target.plan : []).filter((e) => e.area !== bed.name);
    return merged.length;
}
export async function markBedPlanted(bedName, bundle, site) {
    if (!app.logDb || app.logSnapshot.seasonId == null)
        return { ok: false, reason: "the garden log isn’t ready yet - try again in a moment" };
    const season = await getSeason(app.logDb, app.currentPlotId, app.logSnapshot.seasonId);
    if (!season)
        return { ok: false, reason: "no open season" };
    const entry = (Array.isArray(season.plan) ? season.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    if (!bed)
        return { ok: false, reason: "that bed isn’t on the map any more" };
    if (!guild)
        return { ok: false, reason: "this bed has no draft plan to plant - choose a plant team for it on the Plan tab first" };
    const today = new Date().toISOString().slice(0, 10);
    // D-136/137 guard: planting stamps TODAY as the sow date, so today's year must match the open season,
    // or the planting lands in a season it doesn't belong to and falls off every calendar view. We don't
    // silently refuse or silently switch - we return the mismatch (canAdvanceTo) so the Log can OFFER to
    // start the current year's season and plant into it (D-137), the user's call.
    const todayYear = Number(today.slice(0, 4));
    if (todayYear !== season.id) {
        return { ok: false, canAdvanceTo: todayYear,
            reason: `You’re planting in ${todayYear}, but the open season is ${season.id}. Start the ${todayYear} season and plant there, so its dates land in the right year.` };
    }
    const planted = materializeDraftInto(season, bed, guild, site, bundle, today, roleOverridesOf(entry));
    await putSeason(app.logDb, season);
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, true);
    return { ok: true, planted };
}
// D-137: the "advance" the Log offers when today's year isn't the open season's. Create (or reuse) the
// current calendar year's season, carry this bed's draft into it, plant it there, and drop the draft
// from the old season so it isn't left dangling. The Log then makes that season active. This is the
// user OPTING to advance - never automatic.
export async function markBedPlantedAdvancingSeason(bedName, bundle, site) {
    if (!app.logDb || app.logSnapshot.seasonId == null)
        return { ok: false, reason: "the garden log isn’t ready yet - try again in a moment" };
    const openId = app.logSnapshot.seasonId;
    const open = await getSeason(app.logDb, app.currentPlotId, openId);
    const entry = (Array.isArray(open?.plan) ? open.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    if (!bed)
        return { ok: false, reason: "that bed isn’t on the map any more" };
    if (!guild)
        return { ok: false, reason: "this bed has no draft plan to plant - choose a plant team for it on the Plan tab first" };
    const today = new Date().toISOString().slice(0, 10);
    const todayYear = Number(today.slice(0, 4));
    const target = (await getSeason(app.logDb, app.currentPlotId, todayYear))
        ?? { id: todayYear, plot: app.currentPlotId, plantings: [], observations: [] };
    const planted = materializeDraftInto(target, bed, guild, site, bundle, today, roleOverridesOf(entry));
    await putSeason(app.logDb, target);
    // Drop the now-moved draft from the old season so it doesn't linger as a phantom plan there.
    if (open && openId !== todayYear) {
        open.plan = (Array.isArray(open.plan) ? open.plan : []).filter((e) => e.area !== bedName);
        await putSeason(app.logDb, open);
    }
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, true);
    return { ok: true, planted, seasonId: todayYear };
}
// D-137: a SOFT, non-blocking heads-up when today is outside the usual outdoor window for a guild's
// crops - you can still plant (the Log arms the nudge once; a second tap proceeds). Judged only from the
// plot's OWN frost dates: before the last spring frost is risky for frost-tender crops; after the first
// fall freeze is late; and in-season, a crop whose days-to-maturity can't finish before the first freeze
// is called out. No frost data → no judgement, no nudge. Names up to two crops so it stays concrete.
//
// O46: the words travel with their MARKS, because the Log links the names. `list` still truncates
// to ", and N more" - and a crop folded into that tail has no label in the text, so it carries no
// mark: when the sentence names two of five, two of five link, and that is the designed behaviour,
// not a missed site. Every crop the text does name resolves in the bundle (refs the bundle doesn't
// know are skipped by every branch below), so every mark has a card.
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
    // before the last spring frost - tender crops at risk
    if (lastFrost && today < lastFrost) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: `Heads up: your last spring frost (around ${humanizeMMDD(lastFrost)}) hasn’t passed yet. Frost-tender crops here (${l.text}) can be set back or killed by a late frost. You can plant anyway, or wait until after it.`, marks: l.marks };
    }
    // after the first fall freeze - late in the year
    if (firstFreeze && today > firstFreeze) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: `Heads up: your first fall freeze (around ${humanizeMMDD(firstFreeze)}) has already passed - it’s late to plant ${l.text} outdoors. You can plant anyway, or start next season instead.`, marks: l.marks };
    }
    // in-season, but too late for some crops to mature before the first freeze
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
            // today + days-to-maturity, within a nominal year; crossing the year (or past the freeze) = too late
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
/** The season that a manual "grew here recently" tick means: "last season" = the year being planted
 *  minus one (D-102). The planting year is the open season's id, else the browser's current year. */
export function declaredPriorYear() {
    return (app.logSnapshot.seasonId ?? new Date().getFullYear()) - 1;
}
/** Fold the user's DECLARED pre-tracking seeds (D-102) into a derived history: any seed whose ground
 *  overlaps the candidate adds its families at the seed's year, so declared and logged occupancy sit
 *  in one year-keyed history and travel/expire through the same interval math. Engine untouched. */
export function mergePriorOccupancy(derived, seeds, candidate) {
    if (!seeds?.length)
        return derived;
    const cand = parseRegion(candidate);
    const history = {};
    for (const [k, v] of Object.entries(derived.history))
        history[k] = [...v];
    const contributions = [...derived.contributions];
    for (const seed of seeds) {
        const overlap = intersectArea(cand, parseRegion(seed.region));
        if (overlap <= 0)
            continue;
        const key = String(seed.year);
        history[key] = [...new Set([...(history[key] ?? []), ...seed.families])].sort();
        // species "" marks a DECLARED contribution (no species - family-level); displays as "declared"
        for (const fam of seed.families)
            contributions.push({ season: key, species: "", family: fam, overlap_m2: overlap });
    }
    return { history, contributions, unknown_species: derived.unknown_species, verticillium_reservoir: derived.verticillium_reservoir };
}
export function historySource(bundle) {
    // The season you are PLANNING is not its own prior history (walkthrough round 12) - derive from PRIOR
    // seasons only; the open season is the plan, not the record.
    const priorSeasons = app.logSnapshot.seasons.filter((s) => s.id !== app.logSnapshot.seasonId);
    const bedName = $("candbed").value;
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return { history: null, source: { kind: "none" } };
    // active bundle: a logged user variety carries its family into derived history like any species
    const derived = deriveHistory(bed.region, priorSeasons, activeBundle(bundle));
    const tracked = derived.contributions.length > 0; // real logged plantings on this ground
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
        // species "" = a DECLARED seed (D-102, family-level, no species); everything else is a logged
        // planting, and its name links (O46). Assembled from parts rather than searched for with
        // linkNameIn: the line also carries the family's common name, and "carrot family" beside
        // "Carrot" (or "borage family" beside "Borage") collides up to case - a span match here would
        // hold by luck, not construction. A logged user variety stays plain: this function receives
        // the ACTIVE bundle (user varieties folded in), so membership can't gate it - the card's own
        // refusal condition (not in the base bundle = a user variety) is the gate.
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
            p(`logged species the corpus doesn't know (carried nothing): ${d.unknown_species.map(humanize).join(", ")}`, "provenance");
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
        // O45: of every name on the Plan this is the one that most earns a link - a gardener told a
        // plant is REFUSED here is exactly the gardener who wants to read about it.
        const label = commonName(bundle, b.species);
        linkNameIn(p("", "blocked"), `${label} - ${why}`, label, b.species);
    }
    for (const s of res.suggestions) {
        const el = p(`Not many good options here - a ${s.families.map(familyName).join(" or ")} break would help: ${stripRuleCitations(humanizeFamilies(s.why))}.`, "suggest");
        el.title = ruleClaim(bundle, s.rule);
    }
}
// ---------------------------------------------------------------- fit diagram (C4, D-015)
// The bed and the guild's required footprint, drawn to the same scale. The footprint keeps the
// bed's proportions (engine/regions.ts), so the picture agrees with the m² gate by construction.
function fitSvg(bedW, bedL, fmin, fits) {
    const d = fitDiagram(bedW, bedL, fmin);
    if (!d || !d.footprint)
        return null;
    const PX = 90; // longest drawn edge, px
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
// A radial_rings guild (a fruit tree) is a drip-line CIRCLE, not a rect footprint: draw the ring
// centred in the bed, green when it fits, red when it overflows - the picture the circleFitsRect
// gate makes. The tree can sit anywhere, so the circle is centred for legibility, not placed.
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
// ---------------------------------------------------------------- guild browser
// The declared structure of the bed currently picked in the guild browser (#candbed) - drives the
// mound-guild gate on a raised bed (D-141 / R-098). Undefined when no bed is picked or it is unstated.
function pickedBedStructure() {
    const name = $("candbed")?.value ?? "";
    return app.logSnapshot.beds.find((b) => b.name === name)?.structure;
}
// O58 Phase 3: the `#/plan?guild=<id>` deep-link. A static guild page's "Plan this guild" CTA lands
// on the Plan page; app.ts's applyHashGuild validates the id against the bundle and calls setGuildFocus
// (or setGuildFocus(id, false) for a link to a team the corpus no longer carries). renderGuilds reads
// it: it opens that guild's card - instead of the default first team - once there is a bed to place it
// on, and shows a one-line refusal for a missing team otherwise. The focus PERSISTS for the session
// (renderGuilds rebuilds the list from scratch on every draw and re-opens a default card each time, so
// a one-shot would be reverted by the very next boot draw); the deep-linked team simply becomes the
// open-by-default one until the page reloads. The scroll happens only once (guildFocusScrolled).
let guildFocus = null;
let guildMiss = null;
let guildFocusScrolled = false;
// A1: whether the non-fitting run is unfolded. Session-only (like the map legend) - a fold state
// that survived reloads would hide the honesty row's count from a returning reader.
let nofitsOpen = false;
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
// The one-line "that link didn't land on a plannable team" refusal, by id. Two callers: a link to a
// team the corpus has no record of (`missText.absent`), and a link to a team that IS in the corpus
// but renders nowhere on a bed - an out-of-scope system, or a hand-typed id (`missText.unplannable`,
// O59b). Both carry the `.guildmiss` class and the offending id, so a stale link fails OUT LOUD
// instead of silently opening the default team.
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
// O58 linking: the two signature guilds that have a dedicated how-to guide. When you open one of
// these teams on the warm Plan, its card carries the guide - the warm-state counterpart to the cold
// coachband, contextual to the team in front of you. Only these two: a guild with no guide gets no
// link (asserted by the salad_garden negative in scenario 91). Static page, new tab, coachband form.
// EXPORTED for the slug-resolution test (O65), not because anything else consumes it: these slugs
// are hand-typed strings rendered as `../guides/<slug>/`, and nothing resolved them against the
// real files until now.
export const GUILD_GUIDE = {
    three_sisters: { slug: "build-a-three-sisters-mound", label: "How to build a Three Sisters mound" },
    milpa: { slug: "what-is-a-milpa", label: "What is a milpa?" },
};
export function renderGuilds(bundle, site) {
    const list = $("guilds");
    list.innerHTML = "";
    // A `#/plan?guild=` link to a team the corpus no longer carries refuses by name rather than sitting
    // silent - the same out-loud failure the crop deep-link gives, so a stale link never reads as "cold".
    if (guildMiss)
        list.appendChild(guildMissNote(missText.absent(guildMiss)));
    // O71: the whole-plot layer sits ABOVE the per-bed cards (DECISION-plot-composition §4: each
    // bed keeps its own card and band; this says what an ARRANGEMENT of them buys). Sectioned
    // containers are excluded the same way every planner surface excludes them - their sections
    // are the plannable ground.
    {
        const allBeds = app.logSnapshot.beds;
        const plannable = allBeds.filter((b) => !bedHasSections(b.name, allBeds));
        const block = plotBlock(bundle, plannable);
        if (block)
            list.appendChild(block);
    }
    // the fit gate's (w, l) come from the same region everything else plans on - the picked
    // bed's bounding dims (oriented if rotated), else the shape tool's W×L (D-079 slice 5)
    const reg = currentBedRegion();
    const pts = reg ? regionPoints(reg) : null;
    const bw = pts ? Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) : null;
    const bl = pts ? Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) : null;
    // D-141 / R-098: the picked bed's structure gates mound guilds off a raised bed (greyed + reason).
    // The REGION rides along too (F-6): a tree guild on a traced bed gates on the ring fitting the
    // actual outline, not the bounding box - a "fits" that then places nothing is a broken promise.
    const st = (g) => guildStatus(g, bw, bl, bundle, pickedBedStructure(), reg);
    const all = browsableGuilds(bundle);
    const greyed = all.filter((g) => !st(g).fits);
    // A1 (award-benchmark amendments): the BASIS line - the cards below are gated and worded for
    // THIS bed, so the step says its basis out loud (dims · sun · the ground's last season) instead
    // of leaving the list to read as generic. Stated, not "ranked": the order below stays the
    // corpus's own curation with fitting teams first - no invented score (the meter words a
    // margin, cases C-039). Only with a real bed: with no dims there is no basis to state.
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
        // O82(d): the bed's DESCRIPTOR (dims · sun) carries the word "bed"; the history is a trailing
        // clause after a dash - "For your 2.6 m × 6 m · full sun bed - after 2023's nightshades." The
        // old `... ${bits.join} bed` stranded "bed" after the history ("...nightshades bed").
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
    // Buried-variant fix: a greyed (too-big) parent's derived adaptations that THEMSELVES fit are
    // HOISTED into the fits group as first-class cards - the version you can plant belongs where you
    // scan, not nested inside the one you can't. The parent stays greyed below, pointing up to it, and
    // keeps only its non-fitting adaptations nested. (When a parent fits, nothing is hoisted and its
    // variants stay nested behind a tap, unchanged - D-084.)
    const promotedByParent = new Map();
    for (const parent of greyed) {
        const kids = derivedGuilds(parent.id, bundle).filter((v) => st(v).fits);
        if (kids.length)
            promotedByParent.set(parent.id, kids);
    }
    // Build one collapsible team card, with its variants nested in the body. Adaptations render as
    // sub-cards UNDER the parent - every variant reachable, the plan you read always the guild named on
    // it. `promotedFrom` set = this card IS a hoisted adaptation, so it carries a lineage line back to
    // the full-size parent it came from. A greyed parent drops its hoisted kids from the nested set and
    // gains an up-pointer to them.
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
            const rec = status.offer; // null for a fitting parent; the hoisted one is no longer nested
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
        // The contextual guide link, for the two teams that have one (three_sisters, milpa). Sits at the
        // foot of the open card's body - the warm-Plan counterpart to the cold coachband.
        const gg = GUILD_GUIDE[guild.id];
        if (gg) {
            const gl = document.createElement("a");
            gl.className = "teamguide";
            gl.href = `../guides/${gg.slug}/`;
            gl.target = "_blank";
            gl.rel = "noopener";
            gl.textContent = `${gg.label} →`;
            body.appendChild(gl);
        }
        return card;
    };
    // Fitting teams first, the ones that don't fit sunk to the bottom under a plain label - greyed, never
    // hidden (the corpus rule: show why, don't silently drop). Within the fits group, order follows corpus
    // order and a greyed parent contributes its hoisted adaptations in its own slot (D-084). guildStatus
    // is pure, so calling it here to partition is free of side effects.
    const tops = [];
    // A1: the FIRST fitting card is the step's lead and wears the existing recommended treatment
    // (sage border + elevation + the "recommended" chip word). "First" is the corpus's own curated
    // order with fitting teams first - the honest word for a curation, not a computed superlative.
    let leadOpen = true;
    for (const g of all) {
        if (st(g).fits) {
            const c = buildCard(g, null, leadOpen);
            leadOpen = false;
            list.appendChild(c);
            tops.push(c);
        }
        else
            for (const v of promotedByParent.get(g.id) ?? []) {
                const c = buildCard(v, g, leadOpen);
                leadOpen = false;
                list.appendChild(c);
                tops.push(c);
            }
    }
    if (greyed.length) {
        // A1: the non-fitters fold behind an HONEST count (the Why page's own O13 fold pattern). The
        // cards stay in the DOM either way - greyed with the reason, never hidden (invariant 2); the
        // fold only collapses the run visually, and its sub-line says the promise in as many words.
        // Session-sticky (nofitsOpen), so a re-render keeps the reader's choice; a deep link to a
        // folded team unfolds the group below.
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
        list.appendChild(fold);
        const folded = [];
        for (const g of greyed) {
            const c = buildCard(g);
            c.hidden = !nofitsOpen;
            list.appendChild(c);
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
    // Land on one real plan (the first fitting team, else the first shown), and run the list as an
    // ACCORDION - opening a team closes the previously open one, so the section stays scannable. Only
    // the TOP-LEVEL teams accordion; a team's nested variants open independently.
    //
    // O58 Phase 3 / O59b: a `#/plan?guild=` deep-link opens THAT team instead of the first, but only
    // once a bed exists to place it on (`reg`) - with no bed the focus waits, so a cold arrival that
    // lands on the Where/ground step still opens the named team the moment a bed is drawn. Resolve the
    // id in TWO passes, because a variant is a top-level card ONLY when its parent doesn't fit and it
    // hoists (D-084); otherwise it lives NESTED inside its parent's body. Pass 1: the top-level cards.
    // Pass 2: a nested variant card - whose parent must be opened for it to be on screen. An id that is
    // in the bundle but renders NOWHERE here (an out-of-scope system, or a hand-typed id) refuses by
    // name rather than silently opening the default - the same out-loud failure the absent-id path
    // gives, and the exact silent no-op O59b was filed to kill. It scrolls to the match once.
    let matched = null; // the card to scroll to (top-level or nested)
    let matchedTop = null; // the top-level card the accordion opens
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
    // A1: a deep link to a team inside the folded non-fit run unfolds the group - the named card
    // must be on screen, not merely present (the same promise the step-plan auto-open below keeps).
    if (matched && (matched.hidden || matchedTop?.hidden)) {
        nofitsOpen = true;
        list.querySelector(".nofits-toggle")?.setAttribute("aria-expanded", "true");
        for (const d of tops)
            if (d.hidden)
                d.hidden = false;
    }
    const opening = matchedTop ?? tops[0];
    if (opening) {
        opening.open = true;
        for (const o of tops)
            if (o !== opening)
                o.open = false;
    }
    if (matched && matched !== opening)
        matched.open = true; // a nested variant needs its own disclosure open
    if (matched && !guildFocusScrolled) {
        guildFocusScrolled = true;
        // The deep-linked card is only VISIBLE if the Plant-teams step itself is open. A cold arrival
        // from a static page's "Plan this guild" CTA lands with the stepper collapsed (D-140 folds the
        // optional steps), so without this the named team opens inside a closed <details> and the
        // gardener sees nothing (the 2026-08-12 QA sweep, probed: stepOpen false, card invisible).
        const step = document.getElementById("step-plan");
        if (step && !step.open)
            step.open = true;
        requestAnimationFrame(() => matched.scrollIntoView({ block: "center" }));
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
        return { key: "backed", label: "Corpus-backed", tip: "" };
    if (h.band === "partial")
        return { key: "partial", label: "Partly corpus-backed", tip: "" };
    if (guild.guild_class === "culinary_bundle") {
        const note = guild.honesty_note?.trim();
        return { key: "kitchen", label: "Chosen for the kitchen", tip: note ?? "" };
    }
    if (guild.guild_class === "ornamental_bundle") {
        const note = guild.honesty_note?.trim();
        return { key: "cut", label: "Grown to cut", tip: note ?? "" };
    }
    if (guild.guild_class === "restorative") {
        return { key: "rest", label: "A rest for the soil",
            tip: "Its benefit is to next season's crop, not to a co-planting." };
    }
    return { key: "plain", label: "No graded mechanism", tip: "" };
}
// One guild's card: header, footprint, fit diagram, the doesn't-fit reason, and - when it fits - its
// OWN role plan (so a card's plan always matches the guild named on it). Used for both the top-level
// parent card and each derived-variant sub-card (isVariant tightens the styling and heading level).
// A1: how each fit tier words itself on the chip, and how many of the three pills it lights.
const TIER_UI = {
    full: { on: 3, label: "fits fully" },
    adequate: { on: 2, label: "fits - tighter" },
    marginal: { on: 1, label: "fits - just" },
};
// P2.4 (D-189 sibling): the team's members shown as FACES - a row of the 192px built thumbs in the
// opened card, reusing the answers crop-thumb convention (img/thumbs/<id>.webp, gated on a corpus
// image block, data-spot-photo a door to the photo editor). Role guilds show their chosen fillers,
// bundle guilds their members; a species without a photo simply does not appear, the same graceful
// absence as the crop thumb. Returns an empty strip when nothing is photographed - callers gate on it.
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
            continue; // no corpus photo -> no face, no guess
        const im = document.createElement("img");
        im.className = "tmember-thumb";
        im.dataset.spotPhoto = sid; // O55: any photo surface is a door to the photo editor
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
    // A team is a COLLAPSIBLE card (D-084): the summary is a scannable row (name · footprint · fit),
    // the full plan lives in the body and reveals on tap - so the team LIST reads at a glance instead
    // of stacking every plan (the section was ~10,700 px of always-open cards).
    const card = document.createElement("details");
    // the recommended team wears its state on the CARD too (sage border, elevation - handoff 1b),
    // not only on the chip
    card.className = `guild team ${isVariant ? "variant " : ""}${recommended ? "rec " : ""}${st.fits ? "fits" : "greyed"}`;
    // O58 Phase 3: the card names its guild, so a `#/plan?guild=<id>` deep-link can find and open it.
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
    // A1: a real h3 (the measured Plan outline skip was h1 -> h3 with card titles as bare spans);
    // same .tname class and size - the heading is structure, not a re-style. Legal inside <summary>.
    const name = document.createElement("h3");
    name.className = "tname";
    name.textContent = displayName(guild);
    info.appendChild(name);
    const fpTxt = guild.footprint_min_m2 == null ? "? m²" : fmtArea(guild.footprint_min_m2);
    const foot = isRing ? `drip-line ring, ${fpTxt}` : `needs ${fpTxt}`;
    const meta = document.createElement("span");
    meta.className = "tmeta";
    meta.textContent = `${foot} · ${humanize(guild.guild_class)}`;
    info.appendChild(meta);
    // The harmony band, on the COLLAPSED summary so the comparison the defect is about ("all guilds
    // read as equal") happens at a glance, without opening each card.
    const hb = harmonyBand(guild);
    const band = document.createElement("span");
    band.className = `hband hband-${hb.key}`;
    band.textContent = hb.label;
    if (hb.tip)
        band.title = hb.tip;
    info.appendChild(band);
    // A hoisted adaptation names the full-size parent it came from, so its lineage stays legible and
    // the user knows a bigger bed unlocks the whole team (invariant 2: adaptation shown WITH the parent).
    if (promotedFrom) {
        const lin = document.createElement("span");
        lin.className = "lineage";
        const pfp = promotedFrom.footprint_min_m2 == null ? "? m²" : fmtArea(promotedFrom.footprint_min_m2);
        lin.textContent = `↳ a smaller version of ${displayName(promotedFrom)} (which needs ${pfp})`;
        info.appendChild(lin);
    }
    summary.appendChild(info);
    // A1 (award-benchmark amendments): the fit METER - the chip words the margin (fitTier: a plain
    // geometric ratio worded in three bands, engine-mirrored and conformance-pinned; never a score)
    // and three pills carry the same read at a glance. "fits" appeared eight times down the list
    // and carried no information; "fits fully / fits - tighter / fits - just" carries the margin.
    // The recommended lead keeps its word on the chip; its meter still shows its own tier.
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
    // Opening a team snaps it into view (round 10, maintainer): bottom cards used to open below
    // the fold, hiding the layout diagram and the bed/save row. The name (summary) lands at the
    // top, so the apply row + fit diagram beneath it are what fills the screen.
    card.addEventListener("toggle", () => {
        if (!card.open)
            return;
        // ...but NOT while the save reveal is running (walk round 6, maintainer: "the page moves a
        // bit and then snaps"). Saving a team redraws the team list, which re-creates this card in
        // its open state and fires this toggle - so this scroll-into-view raced the reveal's scroll
        // to the map, dragging the page ~300 px down before the reveal yanked it back. The reveal
        // owns the viewport for that beat; the card is being left behind on purpose.
        if (document.body.classList.contains("map-showcase"))
            return;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => {
            const sb = document.getElementById("sheetbody");
            if (sb && sb.contains(card) && sb.scrollHeight > sb.clientHeight + 8) {
                sb.scrollBy({ top: card.getBoundingClientRect().top - sb.getBoundingClientRect().top - 6, behavior });
            }
            else {
                card.scrollIntoView({ behavior, block: "start" });
            }
        }, 60);
    });
    const body = document.createElement("div");
    body.className = "teambody";
    // The apply action lives at the TOP of the body, always visible once the team is open - buried at
    // the bottom of the expanded plan it read as "there is no save button" (maintainer, Quick Plan).
    const applyWrap = document.createElement("div");
    applyWrap.className = "applybox";
    body.appendChild(applyWrap);
    // P2.4: the members' faces, right under the apply action. Only fitting teams instantiate their
    // roles, so the strip rides that; `inst` is reused for the plan body below (no double instantiate).
    const inst = st.fits ? instantiate(guild, site, bundle) : null;
    if (inst) {
        const faces = memberThumbs(inst, guild, bundle);
        if (faces.childElementCount)
            body.appendChild(faces);
    }
    // The mechanisms behind the band, each linking to its own evidence. Rule CODES never surface
    // (D-083) - the link text is the rule's own claim sentence. A backed/partial guild lists them; a
    // zero-band guild says plainly why there is nothing to list, from its own honesty note where it has
    // one (a culinary bundle) or the band's own reason (a restorative rest).
    const hrules = (guild.derived_harmony?.rules) ?? [];
    const mechbox = document.createElement("div");
    mechbox.className = "mechbox";
    if (hrules.length) {
        const mh = document.createElement("p");
        mh.className = "mech-h";
        mh.textContent = "What the corpus says binds these together:";
        mechbox.appendChild(mh);
        const ul = document.createElement("ul");
        for (const rid of hrules) {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = `#/why?rule=${rid}`;
            a.textContent = ruleClaim(bundle, rid);
            li.appendChild(a);
            ul.appendChild(li);
        }
        mechbox.appendChild(ul);
    }
    else {
        const p = document.createElement("p");
        p.className = "mech-none";
        const note = guild.honesty_note?.trim();
        p.textContent = ((guild.guild_class === "culinary_bundle"
            || guild.guild_class === "ornamental_bundle") && note)
            ? note
            : (hb.tip || "The corpus records no interaction between these members.");
        mechbox.appendChild(p);
    }
    body.appendChild(mechbox);
    if (isRing) {
        const note = document.createElement("p");
        note.className = "ring-note";
        // Worded by the centre's habit (QA sweep 2026-08-12): four of the five ring guilds have no
        // tree. The habit comes from the canopy role's canonical filler, resolved from the bundle.
        const canopyId = (guild.roles ?? []).find((r) => r.id === "canopy")?.canonical;
        const habit = typeof canopyId === "string"
            ? String(resolveSpecies(canopyId, null, bundle).habit ?? "") : "";
        const cw = { tree: "tree", shrub: "shrub", vine: "vine", cane: "bramble" }[habit] ?? "woody centre";
        note.textContent = `A perennial team built around a ${cw} - laid out as rings around it, out to the drip line, not a square bed. The ${cw} can sit wherever the rings fit.`;
        body.appendChild(note);
    }
    if (bw != null && bl != null) {
        const svg = isRing ? ringSvg(bw, bl, guild.footprint_min_m2, st.fits) : fitSvg(bw, bl, guild.footprint_min_m2, st.fits);
        if (svg)
            body.appendChild(svg);
    }
    if (!st.fits && st.reason) {
        const why = document.createElement("p");
        why.className = "why";
        const area = bw != null && bl != null ? fmtArea(bw * bl) : "? m²";
        // Rule codes never surface in the UI; the reason prose stands on its own, and the hover title
        // references the rule DIRECTLY by its claim sentence (ruleClaim), never by code.
        why.textContent = `Doesn't fit your ${area} bed. ${st.reason.text}`;
        if (st.reason.ruleId)
            why.title = ruleClaim(bundle, st.reason.ruleId);
        body.appendChild(why);
        // INVARIANT 2's SECOND HALF: "the reason AND the nearest eligible adaptation". For every other
        // guild the adaptation is a DERIVED variant and `st.offer` finds it. Milpa is the exception -
        // it has no derived children at all, so `offer` is null and the card used to end at the reason.
        // Its nearest eligible thing is a DIFFERENT GUILD, and the corpus says which in
        // `ruling_when_ineligible`: "At your scale you want Three Sisters, which is the same guild
        // adapted to a garden." That field was read by nothing (ISSUES #15), so the one guild whose
        // alternative could not be derived was also the one that never named it. Rendered from the
        // corpus verbatim - this is the author's sentence, not a template.
        const wi = guild.ruling_when_ineligible;
        if (typeof wi === "string" && wi.trim()) {
            const alt = document.createElement("p");
            alt.className = "why alt";
            alt.textContent = stripRuleCitations(wi.trim());
            body.appendChild(alt);
        }
    }
    if (inst)
        body.appendChild(rolePlan(inst, site, guild, bundle, applyWrap));
    card.appendChild(body);
    return card;
}
export function bedSeasonStatus(bedRegion, season) {
    if (!season)
        return { growing: 0, ended: 0, carried: 0, closed: false, label: "no season yet" };
    const on = (season.plantings ?? []).filter((pl) => plantingOnBed(pl.region, bedRegion));
    const carried = on.filter((pl) => pl.carried_over === true).length; // still alive, persists (3b)
    const ended = on.filter((pl) => !!pl.end_cause).length;
    const growing = on.length - carried - ended; // unresolved and still in the ground
    const closed = !!season.closed_date;
    let label;
    if (closed) {
        label = carried ? `dormant · ${carried} overwintering` : "dormant";
    }
    else if (!on.length) {
        label = "ready to plant";
    }
    else {
        const parts = [];
        if (growing)
            parts.push(`${growing} growing`);
        if (carried)
            parts.push(`${carried} overwintering`);
        if (ended)
            parts.push(`${ended} ended`);
        label = parts.length ? parts.join(" · ") : "done for the season";
    }
    return { growing, ended, carried, closed, label };
}
// The Plan-page season surface is now READ-ONLY (ISSUES #11 slice 3a): tracking, closing, and starting
// a season moved to the ledger (the Log tab) - Plan shows the active season and each bed's status at a
// glance and links across, but never edits it. "Plan shows, the ledger does" (maintainer, 2026-07-16).
// Editing here would fork the one ledger; the Log tab is the single home for the season loop.
export function renderSeason(_bundle) {
    const step = $("step-season");
    const box = $("season");
    const sum = $("sum-season");
    box.innerHTML = "";
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId) ?? null;
    const beds = app.logSnapshot.beds;
    // Reveal once there's a season or saved ground (as the handoff waits for planReady); a fresh, empty
    // stepper stays clean.
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
    // Keep the folded summary short so it never truncates (the frost/observation detail is in the chips).
    sum.textContent = closed ? `${season.id} · closed` : `${season.id} · ${growing} growing`;
    // Season head - id + a "tracking / closed" tag.
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
    // Counts as status chips (D-085) - the same chip language as the team fit chips + confidence badges,
    // in the app's semantic colours. Growing and observations always show; ended/overwintering only when
    // there are any (a zero chip is noise). `frostCount` still informs the folded summary above.
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
    // Per-bed status - a clean list (name + a status chip) instead of "· bed - text", read-only and
    // derived from occupancy. Green when something's growing, muted otherwise (ready / dormant / done).
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
const CANVAS_CELL_M = 0.30; // grid cell - fine enough to place a real bed, matches MIN_ROW_SPACING
// PER BED again (walkthrough round 19): each saved bed keys its OWN configuration, so different beds
// hold different plant sets. You pick the bed FIRST - the "Select bed" control at the top of the step
// drives #candbed - then build its layout, so switching beds never loses work (round 16's concern) and
// you can manage several beds at once (this round's). Keyed by the picked bed name ("" = the bare rect).
const myBedConfigs = new Map();
/** Which bed the configuration belongs to. Normally `#candbed`'s value; the subtlety is what to do
 *  BEFORE that select has been populated.
 *
 *  THE BUG THIS FIXES (maintainer, 2026-07-31: "easy to select plants which then disappear"). The
 *  picker paints all 73 tappable rows as soon as the step opens, but `#candbed` is filled later, by
 *  the log hydration. In that window the select holds ZERO options and its value is `""` - which is
 *  not a missing key, it is the BARE-RECT key, a different bed entirely. So a plant tapped in that
 *  window was filed under a bed that does not exist, and every read afterwards used "Bed A" and
 *  found nothing. The tap was not dropped by a race; it was filed in a drawer nobody opens again.
 *  Measured: ~100 ms in this container, and a whole page hydration on a phone - the maintainer's
 *  surface, where the deferred 3.7 MB ZIP table is competing for the same main thread.
 *
 *  Resolving it here rather than disabling the picker keeps the tap: the select is filled from the
 *  plannable beds and - since the restore only fires for a name already in the list - lands on the
 *  FIRST of them, so that is the bed the gardener was looking at and the bed their tap meant. */
//  Resolving the key from the bed list instead was tried and does NOT work: at that moment
//  `app.logSnapshot.beds` is empty too - the picker paints from the corpus bundle, which is ready
//  long before the log is. Nothing knows the bed yet, so the tap is HELD here and adopted by the
//  bed the moment one is known. The gardener's tap is never refused and never silently dropped.
let provisionalMyBed = null;
// The picker's ORDERING, held across re-renders so a tap cannot re-sort the list under a thumb.
// Module-level on purpose: adding a plant re-enters renderMyBed, so anything scoped inside it would
// be recomputed on every add and the row would jump exactly as before. Invalidated by the filter,
// the bed, and re-opening the step - see renderPick.
let pickOrderSnapshot = null;
const newMyBedState = () => ({ members: [], tokens: [], tokenSig: "", baseline: null, optimized: false, reseeded: false });
function activeMyBed() {
    const sel = document.getElementById("candbed");
    // ZERO OPTIONS is the tell, not an empty value: `""` is a legitimate key (the bare rect, for a
    // gardener with no saved beds), so it cannot be used to detect "not ready yet".
    if (!sel || !sel.options.length) {
        if (!provisionalMyBed)
            provisionalMyBed = newMyBedState();
        return provisionalMyBed;
    }
    const key = sel.value;
    // The adoption, once, at the hydration boundary: anything tapped before the beds were known
    // belongs to the bed that then appears. Guarded so it can only ever fill an EMPTY configuration -
    // it must not overwrite a bed the gardener has already built - and cleared immediately, so this
    // can never fire again later in the session.
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
// Editing the plants is a fresh, un-optimized layout: forcing a token reseed (empty sig) and dropping
// the Revert baseline, so the canvas re-lays the new set and nothing dangles from a prior Optimize.
const myBedEdited = () => { const c = activeMyBed(); c.optimized = false; c.baseline = null; c.tokenSig = ""; };
/** How many plants the active bed's configuration holds - the step-4 summary (D-079 slice 3). */
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
// Seed one token per plant from the prescribed placement at the engine's EXACT position - NOT snapped
// to a cell (the reported "strictly limited to inside cells"). col/row are the token's continuous
// position in cell units (col*cellW from the west edge), so the seed lands exactly where the engine
// placed the plant, with the same sub-cell freedom a drag has (and finer). The engine already spaces
// the plants and keeps them off the reserved lanes (the reflow), so no collision snap is needed; a
// `blocked` cell (a lane / carried perennial the layout couldn't avoid) nudges to the nearest clear
// spot. row 0 = the poleward (north) edge so tallest-north reads top-down.
function seatTokens(pl, grid, groupOf, blocked) {
    const out = [];
    const loC = 0.5, hiC = grid.cols - 0.5, loR = 0.5, hiR = grid.rows - 0.5; // the canvas's own bounds
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const clear = (col, row) => {
        if (!blocked?.(col, row))
            return [col, row];
        // Safety net only (the engine's reflow already keeps plants off lanes): nudge to the nearest cell
        // that clears, in 0.25-cell steps, so a stray plant on a lane/perennial slides into the planting.
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
/** A planting sits "on" a bed when at least half of its ground overlaps the bed's footprint. The
 *  link between a bed and its plants is GEOMETRIC (D-002) - occupancy is ground-rooted, never keyed
 *  by a bed id - so this is how "what is in this bed" is derived for both overwrite and move. */
export function plantingOnBed(plantingRegion, bedRegion) {
    const a = regionArea(plantingRegion);
    return a > 0 && intersectArea(plantingRegion, bedRegion) >= 0.5 * a;
}
/** ISSUES #12 sub-sections. A section bed is named "<parent> N" (numeric suffix). Given a bed name and
 *  the set of existing bed names, return the PARENT name when this bed is a section of an existing bed,
 *  else null. Kept as a pure string helper so the picker (log.ts), the map label (groundmap.ts), and
 *  tests all read sections the same way. */
export function sectionParentName(name, bedNames) {
    const m = name.match(/^(.*) (\d+)$/);
    if (!m)
        return null;
    for (const n of bedNames)
        if (n === m[1])
            return m[1];
    return null;
}
/** True when `name` is a sectioned CONTAINER: some bed in `beds` is a section of it. Once a bed has
 *  sections the plan lives in the sections, so the container is not itself offered as a plannable
 *  target (its outline/structure are still edited from "Your ground"). */
export function bedHasSections(name, beds) {
    const names = beds.map((b) => b.name);
    return beds.some((b) => sectionParentName(b.name, names) === name);
}
/** The canvas reseed signature: the plant set (species×count) plus the bed's grid resolution. When
 *  it changes the tokens re-seed to the recommended layout; when it matches they persist (a manual
 *  drag, an Optimize, or a read-back). Shared by the paint path and reseedBedFromOccupancy so the two
 *  never drift - a reseed that computed this differently would be clobbered on the next repaint. */
function tokenSignature(members, grid) {
    return members.map((m) => `${m.species}:${m.count ?? 1}`).sort().join(",") + `|${grid ? `${grid.cols}x${grid.rows}` : "-"}`;
}
/** Read-back (ISSUES #11 slice 1) - the inverse of saveMyBedPlantings. Reconstitute a saved bed's
 *  Configurable-Bed working set from what is ALREADY in its ground: the OPEN season's plantings that
 *  sit on the bed (geometric, ground-rooted - never a stored layout blob) become members (species+
 *  group, tallied to counts) and tokens (each planting's centroid mapped back through the same
 *  frame→plot transform save applied, inverted). So reopening a bed shows the arrangement you saved,
 *  editable. No-op with no open season, nothing on the bed, or a config the user already has plants in
 *  (the caller fires it once per bed per session, so clearing a bed by hand is never undone). */
function reseedBedFromOccupancy(bed, region, myBed) {
    if (myBed.members.length)
        return; // never clobber work in progress
    const seasonId = app.logSnapshot.seasonId;
    if (seasonId == null)
        return;
    const season = app.logSnapshot.seasons.find((s) => s.id === seasonId);
    // Only reconstitute plants still IN THE GROUND - live plantings of THIS draft. An ENDED planting
    // is gone. A CARRIED-OVER perennial (D-122) is deliberately NOT a member: it is fixed ground the
    // layout plans around (its cells are blocked on the canvas and the save preserves it) - as a
    // draggable token, a member edit's re-seed used to move a plant that is physically in the ground,
    // and the save rewrote it as a plain cell-sized planting, losing the marker and its footprint.
    const onBed = (season?.plantings ?? []).filter((p) => !p.end_cause && p.carried_over !== true && plantingOnBed(p.region, bed.region));
    const savedSupports = bed.supports ?? [];
    if (!onBed.length) {
        // A bed with no live plantings can still carry its saved SUPPORTS (O80b) - the panel outlives
        // the season, so it comes back as a member even into an otherwise empty draft.
        if (savedSupports.length)
            myBed.members = savedSupports.map((s) => ({ species: s.id, count: 1 }));
        return;
    }
    const grid = bedGrid(region);
    const bedO = bedOrientation(bed);
    // Invert save's frame→plot map: a rotated bed's cells were laid in its own frame and rotated to
    // plot (orientedToPlot); undo the residual rotation about the bed centre. A rect bed is identity -
    // its grid is already in plot coordinates.
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
    // O80b: the bed's saved SUPPORTS come back too - a structure is a member (removable, drawn as
    // the poleward bar), never a token, so it rides beside the occupancy read-back.
    for (const sup of savedSupports) {
        if (!members.some((m) => m.species === sup.id))
            members.push({ species: sup.id, count: 1 });
    }
    myBed.members = members;
    myBed.tokens = tokens;
    myBed.tokenSig = tokenSignature(members, grid); // match paint's tokSig so the read-back tokens stand
    myBed.baseline = null;
    myBed.optimized = false;
}
// The bed's SAVED composition (live occupancy on its ground) and the current DRAFT (myBed.members) as
// species×count maps - so "unsaved changes" and the reset target are read the same way (walkthrough #2b:
// iterate a bed's plants freely, see plainly what's committed to the Log, and reset a draft you don't
// want). Ended plantings are gone, so they don't count as "saved".
function bedOccupancyComposition(bedRegion) {
    const m = new Map();
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    for (const p of season?.plantings ?? []) {
        // carried perennials are fixed ground, not draft material (D-122) - the draft never contains
        // them, so counting them here would flag a permanent phantom "unsaved change"
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
// Write a My-bed arrangement into the season log as real occupancy (D-078 slice 3, option B): each
// token becomes a Planting at its cell's GROUND coordinates, so the layout counts as what grew on
// the bed - never the corpus (CLAUDE.md). Used by both the drag canvas (dragged tokens) and the
// applied/optimised arrangement (tokens seated from the prescribed placement).
async function saveMyBedPlantings(tokens, grid, toWorld, seasonId, bedRegion, bedName, groupBySpecies, composed = false, // O68: the set came from the composer - each planting saves distinguishable
supportIds = []) {
    const db = await openLog();
    const season = await getSeason(db, app.currentPlotId, seasonId);
    if (!season)
        throw new Error("that season isn't open - reopen it in the Log tab and try again");
    // Stamp today as the sow date, exactly as the named-guild "Mark as planted" path does
    // (materializeDraftInto). Saving a configured bed IS the act of planting it, so each plant needs a
    // real in-ground date - without one the Calendar's log-anchored recommendations (D-134) have no
    // anchor and silently skip every plant, so a planted bed shows no harvest/succession dates. The date
    // is editable per-plant in the Log.
    const today = new Date().toISOString().slice(0, 10);
    const newPlantings = tokens.map((t) => {
        // one cell-sized region CENTRED on the token (half-cell positions included)
        const x0 = grid.x0 + (t.col - 0.5) * grid.cellW, y0 = grid.y1 - (t.row + 0.5) * grid.cellH;
        // On a rotated bed the grid is bed-local - occupancy must land on GROUND, so each cell's
        // corners map through the frame→plot transform to a polygon.
        const cellRegion = toWorld
            ? { shape: "polygon",
                points: [[x0, y0 + grid.cellH], [x0 + grid.cellW, y0 + grid.cellH],
                    [x0 + grid.cellW, y0], [x0, y0]].map(([px, py]) => {
                    const [wx, wy] = toWorld(px, py);
                    return [wx, wy];
                }) }
            : { shape: "rect", x: x0, y: y0, w: grid.cellW, h: grid.cellH };
        // Read the variety from the MEMBER (species -> group is unique on a My-bed), not the token: a token
        // seeded before a variety was picked carries a stale "any variety", and a same-count reseed doesn't
        // always refresh it before Save fires. The member is the source of truth, so the saved DTM is exact.
        const grp = groupBySpecies.get(t.species) ?? t.group ?? null;
        return { species: t.species, ...(grp ? { cultivar_group: grp } : {}), region: cellRegion, sown: today,
            ...(composed ? { composed: true } : {}) };
    });
    // OVERWRITE (walkthrough round 12): a saved bed holds ONE current layout, so saving REPLACES it -
    // or a second save (e.g. after Optimize) doubles the plants. The link is geometric (footprint
    // overlap), never a bed id - occupancy stays ground-rooted. Only THIS season is rewritten; past
    // seasons keep their history untouched (that is the whole point of ground-rooting, CLAUDE.md).
    // Carried overwinterers survive the My-bed save too (D-122): they are not tokens (reseed skips
    // them), the canvas blocked their ground, so the written arrangement planned around them.
    // Slice-1b: the replace is by IDENTITY, not wholesale (mergeSurvivingDetail) - a plant that stays
    // in the layout keeps its record (sown date, notes, failures); an ended planting stays as history;
    // only a plant the new arrangement removes is dropped.
    const { rest: kept, merged } = mergeSurvivingDetail(season.plantings ?? [], newPlantings, bedRegion);
    // Seamless with named guilds (round 14): a bed holds ONE arrangement, so saving the configured bed
    // also drops any named-guild plan (Three Sisters etc.) parked on the SAME bed - otherwise its
    // planned dots keep rendering, overlaid on the saved plants. season.plan is keyed by area (bed name).
    const plan = (Array.isArray(season.plan) ? season.plan : []).filter((e) => e.area !== bedName);
    const updated = await putSeason(db, { ...season, plantings: [...kept, ...merged], plan });
    // O80b: the bed's support STRUCTURES persist on the BED record, not in occupancy - a 5-20 year
    // panel is not a planting and must survive the season turning (maintainer decision 2026-08-13,
    // bed-attached). Written from the draft's structure members on every save; removing the trellis
    // from the draft and saving removes it here too.
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
    // the save reveal (round 10): centre + open the map on the just-saved bed (groundmap + sheet listen)
    window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: bedName, kind: "team" } }));
    const i = app.logSnapshot.seasons.findIndex((s) => s.id === seasonId);
    if (i >= 0)
        app.logSnapshot.seasons[i] = updated;
    else
        app.logSnapshot.seasons.push(updated);
    return newPlantings.length;
}
function myBedCanvas(grid, bundle, fb, tokens) {
    const PX = 240;
    const scale = PX / Math.max(grid.w, grid.h, 0.1);
    const W = grid.w * scale, H = grid.h * scale;
    const cw = grid.cellW * scale, ch = grid.cellH * scale;
    // Draw the whole canvas tilted to the bed's real ground orientation (D-086). SVG rotate is
    // clockwise-positive (y-down); the world = the layout frame rotated by +residual in plot space
    // (y-up), which is -residual on screen - so the SVG angle is the negated residual. A rotated W×H
    // rect needs a larger square-ish viewport or its corners clip.
    const rotDeg = -(fb.rotationDeg ?? 0);
    const th = rotDeg * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    const BW = Math.abs(W * ct) + Math.abs(H * st), BH = Math.abs(W * st) + Math.abs(H * ct);
    const ox = BW / 2, oy = BH / 2; // rotation centre in viewport coords
    const wrap = document.createElement("div");
    wrap.className = "canvaswrap";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit canvasbed");
    svg.setAttribute("width", String(Math.round(BW)));
    svg.setAttribute("height", String(Math.round(BH)));
    svg.setAttribute("viewBox", `0 0 ${svgNumber(BW)} ${svgNumber(BH)}`);
    svg.style.touchAction = "none";
    wrap.appendChild(svg);
    // All content lives in this group, centred and rotated; draw() clears/repopulates the group (never
    // the svg), so its local coords stay the plain (0..W, 0..H) grid frame the drag math already uses.
    const content = document.createElementNS(SVG_NS, "g");
    content.setAttribute("transform", `translate(${svgNumber(ox)} ${svgNumber(oy)}) rotate(${svgNumber(rotDeg)}) translate(${svgNumber(-W / 2)} ${svgNumber(-H / 2)})`);
    svg.appendChild(content);
    const status = document.createElement("p");
    wrap.appendChild(status);
    const colours = new Map();
    for (const t of tokens)
        if (!colours.has(t.species))
            colours.set(t.species, PLANT_COLORS[colours.size % PLANT_COLORS.length]);
    // A DOT'S SIZE IS THE PLANT'S OWN ROOM (maintainer, 2026-07-31; approved).
    //
    // It used to be one radius for the WHOLE bed, derived from the single closest pair of tokens, so
    // that no two dots could ever overlap. Two things were wrong with that. One crowded pair shrank
    // every dot in the bed - measured: all 84 dots dropping 10.56 -> 7.34px the moment Optimise packed
    // it - and, worse, the size carried no meaning at all: a corn and a radish drew identically. The
    // drawing said "these plants are the same" while the engine's own footprints said 2.2 ft² and
    // 10.8 ft².
    //
    // Now each dot is the species' mature spread, drawn to the canvas's own scale. A squash reads
    // bigger than a radish because it IS bigger, and a bed packed past its spacing now LOOKS packed -
    // overlap is the honest signal it always should have been, and the one the "odd fills" report was
    // really about. Floored so every dot stays a grabbable drag target, capped so one sprawler cannot
    // swallow the bed. A species with no spread recorded keeps the old density-derived size rather
    // than inventing one.
    let closest = Infinity;
    for (let i = 0; i < tokens.length; i++)
        for (let j = i + 1; j < tokens.length; j++) {
            const dx = (tokens[i].col - tokens[j].col) * cw, dy = (tokens[i].row - tokens[j].row) * ch;
            const d = dx * dx + dy * dy;
            if (d < closest)
                closest = d;
        }
    const rr = Math.max(1.5, Math.min(Math.min(cw, ch) * 0.44, closest === Infinity ? Infinity : Math.sqrt(closest) * 0.47));
    const MIN_GRAB = 9; // a dot smaller than this cannot be dragged
    const MAX_DOT = Math.min(cw, ch) * 1.25; // a sprawler may exceed its cell, not the bed
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
    // A non-rect bed's true outline, mapped from plot metres to the canvas's local (0..W, 0..H) frame
    // (x grows east, y flips because plot-y is up and SVG-y is down). `inside(col, row)` then tests a grid
    // node against it, so cells off the bed can be greyed, drops blocked, and seeded plants pulled inside.
    const outline = fb.polygon
        ? fb.polygon.map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale])
        : null;
    const inside = (col, row) => !outline || pointInPolygon(col * cw, row * ch, outline);
    // Occupied ground (D-122): a carried perennial's footprint, mapped into the same local px frame as
    // the outline. A cell whose centre falls inside is blocked exactly like off-bed ground.
    const occPolys = (fb.occupied ?? []).map((r) => regionPoints(r).map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale]));
    const occAt = (col, row) => occPolys.some((poly) => pointInPolygon(col * cw, row * ch, poly));
    // D-141: reserved access bands mapped to the same local frame - a token can't seed/drop onto a lane.
    const lanePolys = (fb.laneBands ?? []).map((poly) => poly.map(([px, py]) => [(px - grid.x0) * scale, (grid.y1 - py) * scale]));
    const laneAt = (col, row) => lanePolys.some((poly) => pointInPolygon(col * cw, row * ch, poly));
    const freeGround = (col, row) => inside(col, row) && !occAt(col, row) && !laneAt(col, row);
    // Nearest half-cell that is inside the bed and not already taken - the shared snap for a drop that
    // lands off-bed/on-a-plant and for pulling a seeded plant onto the ground. Steps stay on the 0.5 grid
    // (exact in binary, so the occupied-set keys never drift).
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
                        continue; // the ring at this radius only
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
    // A seeded/optimized layout is bounding-box based, so on a round or traced bed some plants can land
    // off the ground - and a read-back token can sit on a perennial's footprint (D-122) - pull any such
    // token onto the nearest free cell before drawing.
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
    // D-078 slice 2: R-003 fires on the ARRANGED positions. Feed the tokens (each with a unique id so a
    // violation maps back to the exact token) through the same solar.heightOrderingViolations the engine
    // uses, so the shading verdict on the user's own layout can't drift from the recommendation's. A
    // token is flagged when it is a TALL plant sitting equatorward of a shorter one - drag it poleward.
    const offenders = () => {
        const bad = new Set();
        if (fb.lat == null)
            return bad;
        const layout = tokens.map((t, i) => {
            const bx = grid.x0 + t.col * grid.cellW;
            const by = grid.y1 - t.row * grid.cellH;
            const [x, y] = fb.toWorld ? fb.toWorld(bx, by) : [bx, by];
            return { id: `${t.species}#${i}`, x, y, height_cm: fb.heightOf.get(t.species) ?? 0 };
        });
        for (const v of heightOrderingViolations(layout, fb.thresholdCm, fb.lat)) {
            const i = Number(String(v.tall).split("#")[1]);
            if (!Number.isNaN(i))
                bad.add(i);
        }
        return bad;
    };
    // O108a: a coarse, human position for the token's aria-label, so a keyboard/screen-reader user
    // hears WHERE a plant is and where it moved to - the canvas frame is y-down with north at y=0 (the
    // same poleward=top convention the zone bands and the support bar use), x growing east.
    const humanPos = (col, row) => {
        const ns = row < grid.rows / 3 ? "north" : row > grid.rows * 2 / 3 ? "south" : "";
        const ew = col < grid.cols / 3 ? "west" : col > grid.cols * 2 / 3 ? "east" : "";
        return [ns, ew].filter(Boolean).join("-") || "centre";
    };
    // The token's spoken identity: what it is, where it sits, whether it shades, and how to operate it.
    // Re-read by the screen reader every time the token is re-focused after a nudge (draw() rebuilds
    // the node), which is how a move is announced WITHOUT adding an aria-live region (O108c is a
    // separate, measure-first concern - this stays self-contained to the token the user is holding).
    const tokenLabel = (t, bad) => `${commonName(bundle, t.species)}, ${humanPos(t.col, t.row)} of the bed`
        + (bad ? ", shading a shorter plant" : "")
        + (fb.onMove ? ". Arrow keys move it" : "")
        + (fb.onRemove ? (fb.onMove ? ", Delete removes it" : ". Delete removes it") : "");
    const draw = () => {
        while (content.firstChild)
            content.removeChild(content.firstChild);
        // Cells whose CENTRE is off the bed are greyed (drawn first, under everything) - a round or traced
        // bed doesn't fill its grid, so this shows which squares aren't ground.
        if (outline || occPolys.length) {
            for (let c = 0; c < grid.cols; c++)
                for (let r = 0; r < grid.rows; r++) {
                    const off = !inside(c + 0.5, r + 0.5);
                    const occ = !off && occAt(c + 0.5, r + 0.5); // occupied ground (D-122): a carried perennial's cell
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
        // The bed's real footprint: its true outline (round/traced) or the plain box.
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
        // D-141: the reserved access bands (field lanes / raised-bed paths) on the design canvas, so
        // design-your-own-bed reads the structure - a faint walkway you keep clear, same as the guild card.
        for (const poly of lanePolys) {
            const lane = document.createElementNS(SVG_NS, "polygon");
            lane.setAttribute("points", poly.map(([x, y]) => `${svgNumber(x)},${svgNumber(y)}`).join(" "));
            lane.setAttribute("class", "placelane");
            content.appendChild(lane);
        }
        // O80b: the support structure, drawn where the layout runs it - a bar along the poleward edge
        // (its shadow falls OUT of the bed there, the same R-003 logic that bands tall plants). The
        // canvas frame is y-down with the top edge poleward in the northern hemisphere (the placement
        // convention every zone line already uses), so north = y near 0, south = y near H. Monochrome
        // (D-105) with the structure's name along it; a recommendation layer, not a draggable token.
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
        // BIGGEST FIRST, so the small ones stay on top and stay tappable. Now that a dot is the plant's
        // real spread, a squash genuinely overlaps its neighbours - which is the honest picture - but
        // painting in token order would bury a radish under it and make it undraggable. Drawing order
        // only; `i` stays the token's true index, which the drag, the removal and the shade highlight
        // all key on. (The old tree special-case, F-11's 1.8x, is GONE: a tree draws large now because
        // its spread IS large, so the exception it existed to make has become the rule.)
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
            // O108a: this is the product's ONE sanctioned canvas (D-078), and it existed with no keyboard
            // path at all - `pointerdown` only, so a keyboard or switch user could not say "the rhubarb is
            // actually here", which is the one thing My-bed is for. An interactive token (onMove or
            // onRemove wired) is now a focus stop that arrow keys move and Delete removes; a read-only
            // recommendation canvas stays non-interactive.
            if (fb.onMove || fb.onRemove) {
                c.setAttribute("tabindex", "0");
                c.setAttribute("role", "button");
            }
            c.appendChild(document.createElementNS(SVG_NS, "title"));
            content.appendChild(c);
        });
        restyle();
    };
    // The shade verdict and each token's spoken/hover text, applied to the EXISTING circles. Split out
    // of draw() (O108a) so a keyboard nudge can update in place - moving one node and re-styling the
    // rest - WITHOUT destroying and recreating the focused token, which drops focus to <body> in
    // Chromium and would force a Tab-back after every arrow press. draw() calls it after building;
    // the nudge calls it after moving one circle. Both read tokens[] for the current positions.
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
                title.textContent = `${commonName(bundle, t.species)}${isBad ? " - would shade a shorter plant; drag it poleward" : ""}`;
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
    let downAt = null; // pointer-down position, to tell a TAP from a DRAG
    // pointer → the grid's own (0..W, 0..H) frame: to viewport coords, then invert the content
    // transform (un-translate the centre, un-rotate, re-centre) so a tilted canvas drags correctly.
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
        // A TAP (pressed and released on the same plant without dragging it) removes that one plant, so you
        // can pick exactly which dot to delete. "Didn't drag" = the pointer moved less than a third of a
        // cell from where it went down - a real drag always crosses that; a tap never does.
        const tapped = fb.onRemove && downAt !== null
            && Math.hypot(sx - downAt[0], sy - downAt[1]) < Math.min(cw, ch) / 3;
        if (tapped) {
            const i = active;
            active = null;
            downAt = null;
            fb.onRemove(i);
            return;
        }
        // snap to the nearest HALF cell (round 8): whole = a grid intersection, half = a cell centre -
        // both honest drop targets. snapValid then pulls it to the nearest cell that's inside the bed's
        // real shape AND free - so a drop off a round/traced bed (or on another plant) lands somewhere real.
        const rc = Math.round((sx / cw) * 2) / 2, rr2 = Math.round((sy / ch) * 2) / 2;
        const [nc, nr] = snapValid(rc, rr2, active);
        const moved = tokens[active].col !== nc || tokens[active].row !== nr;
        tokens[active].col = nc;
        tokens[active].row = nr;
        active = null;
        downAt = null;
        draw();
        if (moved)
            fb.onMove?.(); // the layout changed - let a saved bed re-enable its save button
    };
    // A CANCELLED drag (the sheet drag / a scroll stole the pointer) fires pointercancel - and must NOT
    // snap to that event's coordinates, which are stale/zero on iOS and threw the plant to the top-left
    // corner (round 19, the old handler routed pointercancel to drop). Abort instead: redraw at the
    // token's stored position so it stays exactly where it was. (Only pointercancel - NOT
    // lostpointercapture, which also fires on every normal pointerup release and would abort real drops.)
    const cancel = () => {
        if (active === null)
            return;
        active = null;
        draw();
    };
    svg.addEventListener("pointerup", drop);
    svg.addEventListener("pointercancel", cancel);
    // O108a: the keyboard path. A focused token (Tab reaches each plant) moves by half a cell per
    // arrow - the SAME 0.5 granularity the drag drop snaps to - through snapValid, so a keyboard move
    // can no more land off the bed, on a lane, or on another plant than a drag can. draw() rebuilds
    // the token node, so the moved token is re-focused by index right after (which also re-announces
    // its new position via the aria-label). Delete/Backspace, and Enter/Space (the button's own
    // activation, matching tap-to-remove), remove the plant. Arrows and Space are preventDefault'd so
    // the page does not scroll under the gesture.
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
            // Move THIS node in place (not draw(), which would recreate and drop focus) and restyle the
            // rest, so the moved token stays focused - and the screen reader re-reads its new aria-label.
            el.setAttribute("cx", String(svgNumber(nc * cw)));
            el.setAttribute("cy", String(svgNumber(nr * ch)));
            restyle();
            if (moved)
                fb.onMove();
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
function svgNumber(x) { return Math.round(x * 100) / 100; }
// Distinct hues per species so the plants on the tile are TELLABLE APART (they used to be all
// green shades) - the same index colours the dot on the diagram and the swatch on its text line, so
// colour maps colour→species between the tile and the list below it.
const PLANT_COLORS = ["#15803d", "#b45309", "#2563eb", "#9333ea", "#dc2626", "#0891b2", "#ca8a04", "#db2777"];
// Colours are assigned PER DIAGRAM, distinct within it - each species in this card/bed gets its own
// palette slot by first appearance, so two species never share a colour on the same tile (the old
// global session memo wrapped the 8-colour palette and collided). Multiples of one species share a
// colour (one zone). A guild rarely has > 8 species; past that the palette repeats within the tile.
function zoneColorMap(zones) {
    const m = new Map();
    for (const z of zones)
        if (!m.has(z.species))
            m.set(z.species, PLANT_COLORS[m.size % PLANT_COLORS.length]);
    return m;
}
// One placement line: a colour swatch matching the plant's dots on the diagram, then the planting
// ("plant 4 × corn (260 cm): the north side, ~45 cm apart, 3.36 m²").
function placementLine(bundle, z, where, colour) {
    const el = document.createElement("p");
    el.className = "role";
    const dot = document.createElement("span");
    dot.className = "pdot";
    dot.style.background = colour;
    el.appendChild(dot);
    const spacingCm = z.plants.length ? Math.round(z.plants[0].r * 200) : 0;
    const apart = z.count > 1 && spacingCm ? `, ~${fmtCm(spacingCm)} apart` : "";
    // O73a: the engine's area_m2 is count x mature-spread² (the share-of-ground model), but the
    // layout PACKS at the researched in-row spacing - and where spread outruns spacing (cosmos:
    // 60-90 cm spread, 30 cm spacing, both sourced) the label claimed more ground than the bed
    // holds (174 ft² inside a 97 ft² bed, the 2026-08-12 QA sweep). The DISPLAYED area is capped
    // at what the packed planting actually occupies (count x spacing²); the engine's number is
    // untouched - it stays the honest canopy-share input the fit and footprint models need.
    const packedM2 = z.count > 1 && z.plants.length
        ? z.count * (z.plants[0].r * 2) ** 2 : Infinity;
    const shownArea = Math.min(z.area_m2, packedM2);
    // O46: the plant this placement line is about opens its card.
    const zName = commonName(bundle, z.species);
    linkNameIn(el, ` plant ${z.count} × ${zName} (${fmtCm(z.height_cm)}): ${where}${apart}, ${fmtArea(shownArea)}`, zName, z.species);
    return el;
}
// How many of a species a planting needs, from the corpus (D-054): corn's block minimum for wind
// pollination (R-001), a self-incompatible crop's minimum to set fruit (R-080), else one. No count
// is invented where the corpus is silent - the spacing (mature_spread) governs the rest.
// The bed to lay out. During INITIAL PLANNING - location set, bed width×length entered, no season
// logged yet - placement should already work off the size the user just defined, so it falls back to
// a rect from the Plan form's bed dimensions. A picked season-log bed (its exact traced shape) wins
// when one exists. (D-054 follow-up: placement is a planning tool, not gated on a logged bed.)
function planBedRegion(bed) {
    if (bed) {
        // D-079 slice 4: a ROTATED rect bed lays out edge-aligned in its own frame - the oriented
        // dims (top edge = the edge facing most nearly true north, flip at 45°), not the raw
        // world-frame polygon, which would band by north and clip ragged against the tilt.
        const o = bedOrientation(bed);
        if (o)
            return { shape: "rect", x: 0, y: 0, w: o.orient.eff_w, h: o.orient.eff_l };
        return bed.region;
    }
    // No picked bed: the rect TOOL's W×L is the planning size (D-079 s5 - the old Quick Plan
    // fieldset is gone; typing a size into the shape tool is just another way to make a bed).
    const w = lenM("shapew"), l = lenM("shapel");
    return w != null && l != null && w > 0 && l > 0 ? { shape: "rect", x: 0, y: 0, w, h: l } : null;
}
/** The bed the Plan page is currently planning: the picked saved area (oriented if rotated),
 *  else a rect from the shape tool's W×L. The one source guild fit, placement, and the
 *  intake's bed_m2 all read, so they can never disagree (D-079 slice 5). */
export function currentBedRegion() {
    const bedName = document.getElementById("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return planBedRegion(bed);
}
/** The declared sun exposure (R-005) of the picked bed, or null when unstated / no bed picked.
 *  site.sun sources from the SAME selected bed as currentBedRegion, so the fit, placement, and
 *  eligibility all reason about one bed's real exposure - set once in the bed edit form. */
export function currentBedSun() {
    const bedName = document.getElementById("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return bed?.sun === "full" || bed?.sun === "part_shade" ? bed.sun : null;
}
// A rotated rect bed's stored truth is its 4-corner polygon (occupancy needs no new geometry);
// rotation_deg is app-layer metadata. The corners are saved top-left → top-right → bottom-right
// → bottom-left in the bed's own frame, so the first two edges give (w, l) back exactly.
function bedOrientation(bed) {
    const a = bed.rotation_deg;
    if (!a || bed.region.shape !== "polygon" || bed.region.points.length !== 4)
        return null;
    const p = bed.region.points;
    const r2 = (v) => Math.round(v * 100) / 100;
    const w = r2(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]));
    const l = r2(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]));
    const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
    const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
    return { orient: orientRect(w, l, a), cx, cy, w, l };
}
// Plan around occupancy (D-117/D-118/D-119): the carried-forward perennial footprints on a bed, in the SAME frame
// place() lays out in, to keep a new season's layout OFF them. A NON-rotated bed lays out in plot coordinates
// - the footprints' own frame - so they pass through directly. A ROTATED bed lays out in its oriented,
// 0-origin frame (planBedRegion), so each footprint is carried into that frame via plotToOriented (D-119).
// Shared by both Plan placement call sites so they never diverge.
function carriedOccupancy(bed) {
    if (!bed)
        return [];
    const openSeason = app.logSnapshot.seasons.find((sn) => sn.id === app.logSnapshot.seasonId);
    const o = bedOrientation(bed);
    const out = [];
    for (const pp of (openSeason?.plantings ?? [])) {
        if (pp.carried_over !== true || pp.end_cause)
            continue;
        let r;
        try {
            r = parseRegion(pp.region);
        }
        catch {
            continue; /* unparseable footprint isn't excluded - layout still valid */
        }
        // ANY overlap makes this ground occupied (D-120 fix): a perennial straddling the bed edge - the case a
        // between-season bed resize/move creates - must still be avoided. `plantingOnBed`'s ≥50% "substantially
        // on this bed" test would skip a mostly-outside perennial and let new plants land on its in-bed part.
        // Its out-of-bed portion is moot: place() only ever emits cells inside the bed region.
        if (intersectArea(r, bed.region) <= 0)
            continue;
        if (!o) {
            out.push(r);
            continue;
        } // non-rotated: plot coords already align
        const pts = regionPoints(r).map(([px, py]) => plotToOriented(px, py, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy));
        out.push({ shape: "polygon", points: pts });
    }
    return out;
}
// --- moving a bed carries its plants (walkthrough round 12) ------------------------------------
/** Move a bed's plants with it: the OPEN season's plantings on the old footprint are remapped to the
 *  new frame when the user repositions/rotates/resizes a saved bed. Past seasons are left untouched -
 *  ground-rooted history must survive a redesign (CLAUDE.md); only the season being planned follows
 *  the bed. No-op if the bed did not actually move, if no season is open, or if nothing sits on it. */
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
    const i = app.logSnapshot.seasons.findIndex((s) => s.id === seasonId);
    if (i >= 0)
        app.logSnapshot.seasons[i] = updated;
    else
        app.logSnapshot.seasons.push(updated);
}
/** Build a role → override map from a plan entry's stored `roles` deltas (Gap B). Tolerant of a legacy
 *  entry with no `roles` - returns an empty map, so the canonical path is unchanged. */
export function roleOverridesOf(entry) {
    const m = new Map();
    const roles = entry && Array.isArray(entry.roles) ? entry.roles : [];
    for (const r of roles) {
        const rr = r;
        if (typeof rr.role === "string" && typeof rr.species === "string") {
            m.set(rr.role, { species: rr.species, group: typeof rr.group === "string" ? rr.group : null });
        }
    }
    return m;
}
// Shared by placeGuildPlants and the guildPlantings fallback so both agree on WHAT is planted. With a
// role-override map (Gap B), a role the user swapped resolves to their chosen variety+group instead of
// the canonical; an empty/absent map is the original canonical behaviour, byte-for-byte.
function guildChosenSpecies(guild, site, bundle, overrides) {
    const inst = instantiate(guild, site, bundle);
    const memDensity = (sid) => {
        const mem = (guild.members ?? []);
        const m = mem.find((x) => x.species === sid);
        return typeof m?.planting_density_m2 === "number" ? m.planting_density_m2 : undefined;
    };
    const chosen = [];
    if (inst.roles.length) {
        for (const r of inst.roles) {
            const ov = overrides?.get(r.role);
            const sid = ov ? ov.species : (r.chosen ?? r.canonical);
            if (sid)
                chosen.push({ sid, group: ov ? ov.group : null, density: roleDensity(guild, r.role), role: r.role });
        }
    }
    else {
        for (const [sid, group] of memberSpecies(guild))
            chosen.push({ sid, group, density: memDensity(sid) });
    }
    return chosen;
}
// Lay a named guild out on a bed and return each plant in PLOT coordinates (position + spacing radius
// + species + cultivar group). The single placement core: appliedPlanDots renders these as the map's
// hollow "planned" dots, and guildPlantings turns them into real occupancy when a guild is SAVED -
// one code path, so the planned dots and the materialised plantings can never drift.
// The instantiate→place pipeline for a guild on a bed, shared by every surface that needs the actual
// layout: the map's per-plant dots (placeGuildPlants), the SAVE occupancy (guildPlantings), and the
// landing's real placement diagram (guildPlacementSvg). Factored out so those three can never disagree
// about WHAT is placed WHERE - the same reason spacingRows and place() are single sources. Returns null
// when there is nothing to lay out (no location, or too few plants to arrange).
function computeGuildPlacement(guild, bed, site, bundle, overrides) {
    if (site.lat == null)
        return null;
    const r003 = bundle.rules.find((x) => x.id === "R-003");
    const RING_ORDER = ["canopy", "bulb_ring", "mulch_producer", "fixer", "insectary"];
    const MOUND_ROLES = new Set(["support", "fixer"]);
    const MOUND_CAP = { support: 4, fixer: 3 };
    const isRadial = guild.ground_entity === "radial_rings";
    const isHills = laysOutAsHills(guild); // shared D-056 dispatch (guilds.ts) - the map reads the same predicate
    const isGrid = !isRadial && !isHills
        && (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle"
            || guild.guild_class === "polyculture" || guild.guild_class === "restorative");
    const isRest = guild.guild_class === "restorative";
    const chosen = guildChosenSpecies(guild, site, bundle, overrides);
    const groupBySpecies = new Map();
    for (const c of chosen)
        if (!groupBySpecies.has(c.sid))
            groupBySpecies.set(c.sid, c.group);
    const region = planBedRegion(bed);
    const plantRows = spacingRows(chosen.map((c) => [c.sid, c.group]), bundle)
        .filter((r) => r.height_cm !== null || r.spread_cm !== null);
    if (!region || plantRows.length < 2)
        return null;
    const treeR = isRadial ? (radialRingsFromFootprint(guild.footprint_min_m2 ?? 0)?.r ?? 0) : 0;
    const counts = scaledFillCounts(chosen.map((c) => ({ resolved: resolveSpecies(c.sid, c.group, bundle), density: c.density })), plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false), chosen.length);
    const countBySpecies = new Map();
    const ringBySpecies = new Map();
    const moundBySpecies = new Map();
    const moundCapBySpecies = new Map();
    chosen.forEach((c, i) => {
        countBySpecies.set(c.sid, counts[i]);
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
    const layoutKind = isRadial ? "orchard" : isHills ? "hills" : isGrid ? "grid" : "rows";
    // Plan around occupancy (D-118): same exclusion as the guild placement, so this surface agrees.
    const occupied = carriedOccupancy(bed);
    const pl = place(plantRows.map((r) => ({ id: r.species, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countBySpecies.get(r.species) ?? 1, ring: ringBySpecies.get(r.species), mound: moundBySpecies.get(r.species), mound_cap: moundCapBySpecies.get(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
    return { pl, plantRows, region, isRest, groupBySpecies };
}
/** The landing's real product glimpse (audit R3, option C; reworked on the maintainer's design pass):
 *  the ACTUAL three-sisters mound layout the planner draws, rendered from the corpus through the same
 *  place()/placementSvg the Plan page uses - real product output that cannot rot into a lie (unlike a
 *  screenshot or a hand-drawn mockup). Besides the SVG it returns a LEGEND built from the same zones -
 *  each species' real placed count with the exact colour its dots wear (zoneColorMap is deterministic,
 *  so these are the diagram's own colours, not a parallel palette that could drift). A fixed example
 *  bed + curated latitude: this is "what a planned bed looks like", not the visitor's garden. Returns
 *  null if the layout can't be computed, so the landing simply omits the whole card. */
export function guildPlacementGlimpse(guild, bed, site, bundle) {
    const computed = computeGuildPlacement(guild, bed, site, bundle);
    if (!computed)
        return null;
    const { pl, plantRows } = computed;
    const mounds = pl.mounds ?? [];
    const ringsGuide = pl.rings_guide ?? [];
    const accessBands = pl.access_bands ?? [];
    const bedOutline = regionPoints(bed.region);
    const spreadR = new Map(plantRows.filter((r) => r.spread_cm).map((r) => [r.species, r.spread_cm / 200]));
    const svg = placementSvg(pl.zones, bundle, mounds, bedOutline, ringsGuide, accessBands, spreadR);
    if (!svg)
        return null;
    // placementSvg sizes itself with width/height ATTRIBUTES and no viewBox - fine on the Plan page,
    // which shows it at native size, but CSS scaling (the landing fits it to the card) then stretches
    // the ELEMENT while the drawing stays native-size in the top-left corner (the audit-rework's
    // "off centre, dead background" bug, verified via getBBox). A viewBox derived from its own
    // attributes makes the drawing scale WITH the element; the Plan page is untouched.
    const w = svg.getAttribute("width"), hgt = svg.getAttribute("height");
    if (w && hgt)
        svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    const colours = zoneColorMap(pl.zones);
    const counts = new Map();
    for (const z of pl.zones)
        counts.set(z.species, (counts.get(z.species) ?? 0) + (z.plants?.length ?? 0));
    const plants = [...counts.entries()].filter(([, n]) => n > 0)
        .map(([species, count]) => ({ species, count, colour: colours.get(species) ?? "" }));
    return { svg, plants };
}
function placeGuildPlants(guild, bed, site, bundle, overrides) {
    const out = [];
    const computed = computeGuildPlacement(guild, bed, site, bundle, overrides);
    if (!computed)
        return out;
    const { pl, groupBySpecies } = computed;
    // a rotated bed lays out in its oriented frame - map each plant back onto the ground
    const o = bedOrientation(bed);
    for (const z of pl.zones) {
        for (const cell of z.plants ?? []) {
            const [x, y] = o
                ? orientedToPlot(cell.x, cell.y, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy)
                : [cell.x, cell.y];
            out.push({ x, y, r: cell.r, species: z.species, group: groupBySpecies.get(z.species) ?? null });
        }
    }
    return out;
}
/** The occupancy a named guild materialises when it is SAVED to a bed (walkthrough round 20): the
 *  same per-plant layout the map computes, turned into real `plantings` so the bed reads as PLANTED -
 *  the Log shows what's growing, the close ceremony can end/carry it over, removing the bed takes it
 *  with it. Each plant is a small cell-region centred on its plot position (the map draws its filled
 *  dot at that midpoint). Falls back to one planting per guild species on the bed's own footprint when
 *  the layout can't be computed (no location, or too few plants to arrange), so the bed is never left
 *  reading "ready to plant" after a guild was saved. */
export function guildPlantings(guild, bed, site, bundle, overrides) {
    const placed = placeGuildPlants(guild, bed, site, bundle, overrides);
    if (placed.length) {
        return placed.map((p) => {
            const half = Math.max(0.05, Math.min(p.r, 0.15)); // small cell so an edge plant still sits inside the bed
            const region = { shape: "rect", x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 };
            return { species: p.species, ...(p.group ? { cultivar_group: p.group } : {}), region };
        });
    }
    return guildChosenSpecies(guild, site, bundle, overrides).map((c) => ({ species: c.sid, ...(c.group ? { cultivar_group: c.group } : {}), region: bed.region }));
}
/** The applied season plan drawn on GROUND (walkthrough round 5): for every plan entry of the
 *  open season, recompute the layout the guild card shows and return per-plant dots in PLOT
 *  coordinates for the map to render. Planned, not planted: these are the map's hollow dots. A bed
 *  that already carries occupancy for its guild is SKIPPED - once saved, the guild materialises as
 *  real plantings (filled dots, round 20); drawing the planned dots too would double every plant. */
export function appliedPlanDots(bundle, site) {
    const season = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
    const entries = (Array.isArray(season?.plan) ? season.plan : []);
    const out = [];
    if (!entries.length || site.lat == null)
        return out;
    for (const e of entries) {
        const bed = app.logSnapshot.beds.find((b) => b.name === e.area);
        const guild = bundle.guilds.find((g) => g.id === e.guild);
        if (!bed || !guild)
            continue;
        // saved → materialised as occupancy; the filled dots carry it, so don't also draw hollow ones
        if ((season?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region)))
            continue;
        // Gap B: the map's planned dots reflect the user's role swaps too, so the preview matches what plants.
        for (const p of placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(e)))
            out.push({ x: p.x, y: p.y, species: p.species });
    }
    return out;
}
function guildPlantCount(resolved) {
    const poll = resolved.pollination;
    if (poll?.block_min_plants)
        return poll.block_min_plants;
    if (poll?.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
// The plant-to-plant spacing to plan at: the recommended in-row spacing (sourced, on the species) -
// the real planting distance - falling back to the mature canopy spread. Returns the m² one plant
// occupies (a square at that spacing, 30 cm floor).
function plantSpacingM2(resolved) {
    let s = resolved.spacing_in_row_cm;
    if (typeof s !== "number") {
        let ms = resolved.mature_spread_cm;
        if (Array.isArray(ms))
            ms = ms.length ? ms[ms.length - 1] : undefined;
        s = typeof ms === "number" ? ms : undefined;
    }
    const cm = Math.max(typeof s === "number" ? s : 30, 30);
    return (cm / 100) ** 2;
}
// The placement diagram's dot budget (D-141 follow-up). The fill counts are computed at the crops'
// RESEARCHED spacing (rawFillCount), so a large dense guild fills its bed - Three Sisters on a 7.5 m
// bed wants ~280 corn at 5/m², and must READ full, not be throttled to a flat per-species 120 (which
// left big beds looking half-empty). This bounds the TOTAL dots drawn, not each species, so a small
// bed is untouched and only a genuinely huge planting is scaled down - the crop-to-crop RATIO always
// survives (the whole set scales by one factor). Sized to fill a realistic consumer bed (~60 m²) at
// full density; past that the diagram thins uniformly rather than drawing thousands of dots.
const FILL_DOT_BUDGET = 700;
// How many of a species to PROPOSE for a guild, filling the bed - the UNCAPPED raw count (D-055).
// Two paths:
//   - RESEARCH density: a guild role's sourced planting_density_m2 (plants/m²) × the whole bed - the
//     crops interplant over the shared ground, so the RATIO between them is the researched ratio
//     (Three Sisters: corn ≈ beans, squash sparse), scaling to any bed.
//   - Fallback (no density yet): each of the N species gets an equal share of the bed and is planted
//     to capacity at its own recommended spacing.
// The corpus minimum (corn's block, a self-incompatible pair) is respected. The render/perf cap is
// applied ACROSS the guild by scaledFillCounts, not here, so the ratio survives it.
function rawFillCount(resolved, bedArea, nSpecies, density) {
    const corpusMin = guildPlantCount(resolved);
    if (bedArea == null || bedArea <= 0)
        return corpusMin;
    if (density != null && density > 0)
        return Math.max(Math.round(density * bedArea), corpusMin);
    const sm2 = plantSpacingM2(resolved);
    if (sm2 <= 0)
        return corpusMin;
    const wholeBedCap = Math.max(1, Math.floor(bedArea / sm2));
    const share = bedArea / Math.max(1, nSpecies);
    const fit = Math.max(1, Math.floor(share / sm2));
    return Math.min(Math.max(fit, Math.min(corpusMin, wholeBedCap)), wholeBedCap);
}
// The fill counts for a guild's crops, filling the bed at researched density and bounded ACROSS the
// set by FILL_DOT_BUDGET so the RATIO survives (D-055 follow-up / D-141): only when the TOTAL dots
// would exceed the budget is every crop scaled down by the same factor. A realistic bed (Three
// Sisters filling a 7.5 m bed, ~540 plants) stays under budget and fills fully; the old per-species
// 120 cap throttled it to ~73% and read half-empty.
function scaledFillCounts(items, bedArea, nSpecies) {
    const raw = items.map((it) => rawFillCount(it.resolved, bedArea, nSpecies, it.density));
    const total = raw.reduce((s, n) => s + n, 0);
    if (total <= FILL_DOT_BUDGET)
        return raw;
    const k = FILL_DOT_BUDGET / total;
    return raw.map((n) => Math.max(1, Math.round(n * k)));
}
// Scale a My-bed's member counts UP to fill the PLANTABLE area (the bed less its reserved access
// lanes) at each species' researched spacing (D-141) - the same fill the prescribed guilds use, no
// invented density. Never shrinks a count set on purpose. Shared by the initial seed and Optimise so a
// hand-built bed reads full from the moment a plant is added, then you drag / tap-to-remove / Optimise.
function filledMembers(members, plantable, bundle) {
    if (plantable <= 0 || !members.length)
        return members.map((m) => ({ ...m }));
    // O80a: a structure is never FILLED - one trellis serves the row; pricing it at the 30 cm
    // spacing floor would "fill out" a bed with dozens of cattle panels (the G6 trap, recorded in
    // docs/DECISION-plant-support.md). Its count passes through untouched.
    const isStructure = (m) => resolveSpecies(m.species, m.group ?? null, bundle).entity_class === "structure";
    const plants = members.filter((m) => !isStructure(m));
    const counts = scaledFillCounts(plants.map((m) => ({ resolved: resolveSpecies(m.species, m.group ?? null, bundle) })), plantable, plants.length);
    let i = 0;
    return members.map((m) => isStructure(m)
        ? { ...m }
        : { ...m, count: Math.max(counts[i++], m.count ?? 1) });
}
// D-143 (maintainer, 2026-07-24): the layout is the truth the plant list follows. For a MOUND bed
// the thinned hills (D-065) seat fewer plants than raw density fills - the count snaps to what the
// placement actually seated, so the member list, the canvas, and the planting agree. For a RINGS
// bed each understory circle holds its circumference over the species' own spacing - 103 chives
// stop rendering as a solid rope. Returns the snapped members, or null when nothing changed
// (grid/graded layouts seat everything, so they always return null).
function snapCountsToLayout(members, pl, arch, bundle) {
    if (arch === "hills") {
        const placed = new Map(pl.zones.map((z) => [z.species, z.count]));
        const out = members.map((m) => ({ ...m, count: Math.max(1, placed.get(m.species) ?? (m.count ?? 1)) }));
        return out.some((m, i) => m.count !== (members[i].count ?? 1)) ? out : null;
    }
    if (arch === "rings") {
        const ringOf = new Map(pl.zones.map((z) => [z.species, z.ring?.r ?? null]));
        const out = members.map((m) => {
            const rr = ringOf.get(m.species);
            if (rr == null || rr <= 0)
                return { ...m, count: m.count ?? 1 }; // the tree / centre cluster
            const spacing = Math.sqrt(plantSpacingM2(resolveSpecies(m.species, m.group ?? null, bundle)));
            const cap = Math.max(1, Math.floor((2 * Math.PI * rr) / Math.max(spacing, 0.05)));
            return { ...m, count: Math.min(m.count ?? 1, cap) };
        });
        return out.some((m, i) => m.count !== (members[i].count ?? 1)) ? out : null;
    }
    return null;
}
// The plantable area of a bed region: its area less the reserved access lanes/paths (R-098), so a fill
// doesn't overrun its own walkways. structure resolves absent -> in_ground (walked rows).
function plantableArea(region, structure, laneFlip = false) {
    const lanes = computeAccessBands(structure, region, laneFlip);
    const laneArea = lanes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    return Math.max(0.1, regionArea(region) - laneArea);
}
// The physical structure that drives the fill (D-141 / R-098): the bed's own declared structure wins;
// else the guild's default (milpa = field); else in_ground (reach-from-edge). Only "field" changes the
// layout today (opens walking lanes in a deep hills field); every other value lays out as it does now.
function bedStructure(bed, guild) {
    return bed?.structure ?? guild?.default_structure ?? "in_ground";
}
// A guild role's sourced planting density, if it carries one (D-055). Read from the raw guild, since
// the resolved-role object the compiler returns doesn't copy guild-authored extras.
function roleDensity(guild, roleId) {
    const d = (guild.roles ?? []).find((r) => r.id === roleId)?.planting_density_m2;
    return typeof d === "number" ? d : undefined;
}
let placementSvgSeq = 0; // unique clipPath ids - several placement diagrams render per page (F-7)
// The placement diagram: faint species bands with the engine-computed per-plant grid drawn on top
// (D-054) - each dot is one plant at its real spacing, so the card reads as an executable planting.
// The SVG is sized to the ACTUAL drawn content (polygon points AND every dot's centre ± its radius),
// so nothing spills over the card edge, and the dot radius is capped so a big tree stays a dot rather
// than a blob that overflows the tile.
function placementSvg(zones, bundle, mounds = [], bedOutline = [], ringsGuide = [], accessBands = [], spreadR = new Map()) {
    // The coordinate frame spans ALL content - the bed outline, band polygons, every plant dot,
    // (radial layout) each ring's extent, (hills layout) each mound's circle, and (orchard) each
    // tree's ring guides - so a rings/hills/orchard diagram (empty polygons) is framed by its circles.
    const allX = [], allY = [];
    for (const q of bedOutline) {
        allX.push(q[0]);
        allY.push(q[1]);
    }
    for (const z of zones) {
        for (const q of z.polygon) {
            allX.push(q[0]);
            allY.push(q[1]);
        }
        for (const pc of z.plants) {
            allX.push(pc.x);
            allY.push(pc.y);
        }
        if (z.ring) {
            allX.push(z.ring.cx - z.ring.r, z.ring.cx + z.ring.r);
            allY.push(z.ring.cy - z.ring.r, z.ring.cy + z.ring.r);
        }
    }
    for (const m of mounds) {
        allX.push(m.cx - m.r, m.cx + m.r);
        allY.push(m.cy - m.r, m.cy + m.r);
    }
    for (const g of ringsGuide) {
        allX.push(g.cx - g.r, g.cx + g.r);
        allY.push(g.cy - g.r, g.cy + g.r);
    }
    for (const b of accessBands) {
        allX.push(b.x0, b.x1);
        allY.push(b.y0, b.y1);
    }
    if (!allX.length)
        return null;
    const px0 = Math.min(...allX), py1 = Math.max(...allY);
    const spanX = Math.max(...allX) - px0, spanY = py1 - Math.min(...allY);
    const sc = 180 / Math.max(spanX, spanY, 0.1);
    const rawX = (x) => (x - px0) * sc;
    const rawY = (y) => (py1 - y) * sc;
    // Draw each plant dot near its full cell radius so an interplanted grid/graded bed READS as full - at
    // 0.82 the dots left big gaps and a correctly-spaced bed looked half-empty (the reported "grow lanes
    // 50% or less", "middle grow areas light"). The clustered corn+beans ON a mound already read well and
    // would blob if enlarged, so ONLY those keep the tighter factor; the between-mound squash and every
    // grid/graded bed fill their cells. Engine r is already half the cell, so 0.96 nearly touches without
    // overlapping; a big tree is still capped to a dot.
    // 2.4 px floor (fill review F-10): a shrunken edge dot at a sharp corner rendered as a 1.6 px
    // speck that read as debris; 2.4 px stays visibly a plant without inflating true containment.
    // 0.94 fill (F-12): dots drawn tangent to the border read as poking past it at phone scale -
    // stroke width plus antialiasing - so every dot keeps a hair of visual air off its cell edge.
    const drawR = (r, fill = 0.94) => Math.min(Math.max(r * sc * fill, 2.4), 20);
    const zoneFill = (z) => (mounds.length && z.mound !== false) ? 0.82 : 0.94;
    // VINE-SPRAWL HALO (maintainer, cosmetic). On a mound bed the gap crop is deliberately sparse -
    // squash at the Cornell 0.6/m2 lands on roughly every seventh hill gap - and at that density a
    // big milpa read as "the squash is missing" rather than "the squash is a vine that needs the
    // room". The dot cannot say so on its own: drawR caps at 20 px, so a 2 m sprawl draws the same
    // size as a 20 cm onion. The halo is that plant's OWN radius from the engine - the footprint it
    // was actually spaced on - drawn uncapped and very faint behind the dot, so the gaps read as the
    // vine's room. It adds no plants and changes no count; the density is sourced and stays.
    // The plant's DRAWN radius is not its sprawl: a gap dot is shrunk to fit between the mounds it
    // sits among (gapFitR), so pc.r is the room it has, not the ground it will cover. The halo has to
    // come from the resolved cultivar's mature spread - vining Cucurbita pepo is a 4 m vine where the
    // bush group is 1 m, and only the caller knows which group was chosen.
    const haloR = (z, r) => {
        if (!mounds.length || z.mound !== false)
            return 0; // gap crops on a mound bed only
        const spread = spreadR.get(z.species);
        if (!spread)
            return 0;
        const full = spread * sc;
        return full > drawR(r, zoneFill(z)) + 2 ? full : 0; // only when it says more than the dot
    };
    // Pixel bounding box of everything we will draw, so the viewport contains it all (no overflow).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const bump = (x, y, pad = 0) => {
        minX = Math.min(minX, x - pad);
        maxX = Math.max(maxX, x + pad);
        minY = Math.min(minY, y - pad);
        maxY = Math.max(maxY, y + pad);
    };
    for (const z of zones) {
        for (const q of z.polygon)
            bump(rawX(q[0]), rawY(q[1]));
        for (const pc of z.plants)
            bump(rawX(pc.x), rawY(pc.y), drawR(pc.r)); // halos clip to the bed, so they never widen the frame
        if (z.ring && z.ring.r > 0) {
            bump(rawX(z.ring.cx), rawY(z.ring.cy), z.ring.r * sc);
        }
    }
    for (const m of mounds)
        bump(rawX(m.cx), rawY(m.cy), m.r * sc);
    for (const g of ringsGuide)
        bump(rawX(g.cx), rawY(g.cy), g.r * sc);
    for (const b of accessBands) {
        bump(rawX(b.x0), rawY(b.y0));
        bump(rawX(b.x1), rawY(b.y1));
    }
    for (const q of bedOutline)
        bump(rawX(q[0]), rawY(q[1]));
    if (!Number.isFinite(minX))
        return null;
    const M = 4;
    const px = (x) => svgNumber(M + rawX(x) - minX);
    const py = (y) => svgNumber(M + rawY(y) - minY);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(maxX - minX) + 2 * M));
    svg.setAttribute("height", String(Math.ceil(maxY - minY) + 2 * M));
    const colours = zoneColorMap(zones);
    // The bed outline first, under everything, so the planting reads as sitting inside its borders.
    // Its polygon doubles as a CLIP for the ring GUIDE circles (fill review F-7): an edge tree's
    // understory guide crossed a traced outline - the one containment leak the review measured. The
    // engine keeps every PLANT disc inside; the drawn guides get clipped at the border like a real
    // bed edge would cut a mulch ring.
    let guideClip = null;
    if (bedOutline.length >= 3) {
        const bed = document.createElementNS(SVG_NS, "polygon");
        const ptsAttr = bedOutline.map((q) => `${px(q[0])},${py(q[1])}`).join(" ");
        bed.setAttribute("points", ptsAttr);
        bed.setAttribute("class", "bed");
        svg.appendChild(bed);
        guideClip = `fitclip-${++placementSvgSeq}`;
        const defs = document.createElementNS(SVG_NS, "defs");
        const clip = document.createElementNS(SVG_NS, "clipPath");
        clip.setAttribute("id", guideClip);
        const cpoly = document.createElementNS(SVG_NS, "polygon");
        cpoly.setAttribute("points", ptsAttr);
        clip.appendChild(cpoly);
        defs.appendChild(clip);
        svg.appendChild(defs);
    }
    // D-141: draw the reserved access bands (field lanes / raised-bed paths) as faint dashed lanes under
    // everything, so an empty band reads as a WALKWAY you keep clear, not as missing plants.
    for (const b of accessBands) {
        const bx0 = M + rawX(b.x0) - minX, bx1 = M + rawX(b.x1) - minX;
        const byTop = M + rawY(b.y1) - minY, byBot = M + rawY(b.y0) - minY;
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", String(svgNumber(Math.min(bx0, bx1))));
        rect.setAttribute("y", String(svgNumber(Math.min(byTop, byBot))));
        rect.setAttribute("width", String(svgNumber(Math.abs(bx1 - bx0))));
        rect.setAttribute("height", String(svgNumber(Math.abs(byBot - byTop))));
        rect.setAttribute("class", "placelane"); // faint wash + dashed edge; themed in styles.css
        svg.appendChild(rect);
    }
    // orchard layout: draw each tree's understory ring as a faint guide circle (many trees per plot),
    // clipped to the bed outline (F-7) so an edge tree's guide never crosses a traced border.
    for (const g of ringsGuide) {
        const circ = document.createElementNS(SVG_NS, "circle");
        circ.setAttribute("cx", String(px(g.cx)));
        circ.setAttribute("cy", String(py(g.cy)));
        circ.setAttribute("r", String(svgNumber(g.r * sc)));
        circ.setAttribute("fill", "none");
        circ.setAttribute("stroke", "#8886");
        if (guideClip)
            circ.setAttribute("clip-path", `url(#${guideClip})`);
        svg.appendChild(circ);
    }
    // The sprawl halos go down UNDER the mounds and every dot - the vine grows across the ground the
    // hills sit on, so it belongs beneath them; drawn over the top it tinted the mounds and buried
    // the layout it was meant to explain. Clipped to the bed (the same clip the ring guides use):
    // a real vine does run past a bed edge, but a circle hanging outside the outline reads as a plant
    // planted outside the bed, which is a lie the diagram must not tell.
    zones.forEach((z) => {
        const col = colours.get(z.species);
        for (const pc of z.plants) {
            const hr = haloR(z, pc.r);
            if (!hr)
                continue;
            const h = document.createElementNS(SVG_NS, "circle");
            h.setAttribute("cx", String(px(pc.x)));
            h.setAttribute("cy", String(py(pc.y)));
            h.setAttribute("r", String(svgNumber(hr)));
            // OUTLINE ONLY, no fill. Eighteen 2 m vines on a 6 m bed genuinely do cover the ground, so a
            // filled halo was accurate and useless: the overlaps stacked into one flat haze that dulled
            // the mounds. As rings they stay countable - you can see one vine's reach, and see it meet
            // its neighbour's, which is the thing the sparse dot count needed explaining.
            h.setAttribute("fill", "none");
            h.setAttribute("stroke", col);
            h.setAttribute("stroke-opacity", "0.42");
            h.setAttribute("stroke-dasharray", "3 3"); // dashed: ground it grows INTO, not a bed feature
            h.setAttribute("class", "sprawl");
            if (guideClip)
                h.setAttribute("clip-path", `url(#${guideClip})`);
            svg.appendChild(h);
        }
    });
    // hills layout: draw the mounds as faint earth-brown discs first, so the co-located plant dots
    // sit on top of them and the gaps between read as gaps.
    for (const m of mounds) {
        const circ = document.createElementNS(SVG_NS, "circle");
        circ.setAttribute("cx", String(px(m.cx)));
        circ.setAttribute("cy", String(py(m.cy)));
        circ.setAttribute("r", String(svgNumber(m.r * sc)));
        circ.setAttribute("fill", "#a1662f22");
        circ.setAttribute("stroke", "#a1662f66");
        svg.appendChild(circ);
    }
    zones.forEach((z) => {
        if (z.ring) {
            // radial layout: draw the ring circle as a faint guide (skip r=0, the tree centre)
            if (z.ring.r > 0) {
                const circ = document.createElementNS(SVG_NS, "circle");
                circ.setAttribute("cx", String(px(z.ring.cx)));
                circ.setAttribute("cy", String(py(z.ring.cy)));
                circ.setAttribute("r", String(svgNumber(z.ring.r * sc)));
                circ.setAttribute("fill", "none");
                circ.setAttribute("stroke", `${colours.get(z.species)}66`);
                svg.appendChild(circ);
            }
            return;
        }
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", z.polygon.map((q) => `${px(q[0])},${py(q[1])}`).join(" "));
        poly.setAttribute("fill", `${colours.get(z.species)}14`); // a faint wash of the species' own colour
        poly.setAttribute("stroke", "#8884");
        svg.appendChild(poly);
    });
    zones.forEach((z) => {
        const col = colours.get(z.species);
        // Mound-cluster dots get a SURFACE-coloured halo stroke (fill review F-9): four corn discs
        // overlap into one blob on a 0.4 m cluster ring, and the smaller bean dots vanished into it.
        // The halo separates each overlapping disc, in both themes; gap/grid dots keep the plain edge.
        const onMound = mounds.length > 0 && z.mound !== false;
        for (const pc of z.plants) {
            const c = document.createElementNS(SVG_NS, "circle");
            c.setAttribute("cx", String(px(pc.x)));
            c.setAttribute("cy", String(py(pc.y)));
            c.setAttribute("r", String(svgNumber(drawR(pc.r, zoneFill(z)))));
            c.setAttribute("fill", col);
            c.setAttribute("fill-opacity", "0.55");
            c.setAttribute("stroke", onMound ? "var(--surface)" : col);
            if (onMound)
                c.setAttribute("stroke-width", "1.25");
            const t = document.createElementNS(SVG_NS, "title");
            t.textContent = `${commonName(bundle, z.species)} - 1 of ${z.count}`;
            c.appendChild(t);
            svg.appendChild(c);
        }
    });
    return svg;
}
// D-155's `category` slugs as the words a gardener reads. A slug with no label here still renders
// (humanised) rather than vanishing - a new category must never silently drop its plants out of the
// picker's groups, which is the failure the Why page's chip cover taught (O13).
const CATEGORY_LABEL = {
    fruiting_vegetable: "Fruiting vegetables",
    herb: "Herbs",
    fruit: "Fruit & berries",
    salad_green: "Salad & greens",
    root: "Roots & tubers",
    bean_or_pea: "Beans & peas",
    cover_crop: "Cover crops & soil builders",
    allium: "Onions & garlic",
    flower: "Flowers",
};
const categoryLabel = (slug) => CATEGORY_LABEL[slug] ?? (slug ? titleCase(humanize(slug)) : "Other plants");
export function renderMyBed(bundle, site) {
    const q = $("mybedq");
    const listBox = $("mybedlist");
    const countLine = $("mybedcount");
    const memberBox = $("mybedmembers");
    const resultBox = $("mybedresult");
    if (!q || !listBox || !countLine || !memberBox || !resultBox)
        return;
    // THE PICKER (O14). A native <select> of 73 is a scroll wheel on iOS - tedious now, unusable at
    // 200 - so this is a type-to-filter list instead. Three things it must keep doing:
    //
    //   1. Offer what THIS ground can grow (D-006), and show what it cannot. Blocked plants STAY IN
    //      THE LIST, greyed, CARRYING THEIR REASON. Invariant 2 wants the reason shown, and this
    //      surface used to render a bare "- blocked" with the corpus's sentence nowhere - the third
    //      place that shape was found (after R-098's hover-only title and the Log's docked
    //      confirmations). A filter that dropped blocked plants would be worse still: hiding a
    //      refusal behind a search box, where nobody would ever notice it had been hidden.
    //   2. Put what is ALREADY IN THIS GARDEN first. The season log knows; most additions are a
    //      second courgette, not a plant you have never grown.
    //   3. Group by the species' reader-facing `category` (D-155) - never `family`, which is Latin
    //      and belongs to the rotation engine.
    const elig = eligibleSpecies(site, bundle);
    const blockedWhy = new Map(elig.blocked.map((b) => [b.species, b.blocked_by.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ")]));
    const blockedRule = new Map(elig.blocked.map((b) => [b.species, String(b.blocked_by[0]?.rule ?? "")]));
    // THE LIST MUST NOT MOVE UNDER A THUMB (maintainer, 2026-07-31). Adding used to re-render the
    // whole picker, which re-grouped it: the tapped plant jumped into "In this garden" at the top -
    // measured at 2937px -> 529px inside the list's own scroll space - and a DIFFERENT plant slid
    // under the finger. A second tap then added something the gardener never chose, which is exactly
    // the reported "easy to select plants, which then disappear".
    //
    // So the count changes IN PLACE and the ordering is a snapshot: the pinned group re-sorts when
    // the picker is next built (a filter keystroke, a bed switch, re-opening the step), never in
    // response to your own tap. Nothing you are looking at moves while you are looking at it.
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
            myBed.members.push({ species: sid, count: by }); // a NEW species lands as ONE plant - incremental, not a filled bed (maintainer). Optimise fills on demand.
        }
        myBedEdited(); // a new plant is a fresh layout - reseed, drop any optimize/revert context
        paint();
        refreshRow(sid); // IN PLACE - see above. Never renderPick(), which would re-sort mid-tap.
    };
    // What this garden already grows: the open season's plantings plus whatever is in the bed being
    // configured. Snapshotted (see pickOrderSnapshot) so it cannot re-sort under a thumb.
    const inGarden = () => {
        const open = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
        return new Set([
            ...(open?.plantings ?? []).filter((p) => !p.end_cause).map((p) => p.species),
            ...activeMyBed().members.map((m) => m.species),
        ]);
    };
    function renderPick() {
        const term = q.value.trim().toLowerCase();
        // THE ORDERING IS A SNAPSHOT, and it has to be module-level to work: adding a plant calls
        // paint(), which re-enters renderMyBed and rebuilds this list from scratch, so a snapshot held
        // in a local would be recomputed every time and the row would jump anyway (measured: it did).
        // The pinned group therefore re-sorts when the FILTER or the BED changes, or when the step is
        // re-opened - all deliberate acts - and never as a consequence of your own tap.
        const bedSel = document.getElementById("candbed");
        const bedReady = !!(bedSel && bedSel.options.length);
        const bedKey = bedSel?.value ?? "";
        if (pickOrderSnapshot && !pickOrderSnapshot.ready && bedReady) {
            // Hydration, not a bed switch. The list was already on screen and tappable before the beds
            // were known (that is the whole reason activeMyBed has to hold a provisional configuration),
            // so treating this as a change re-sorted the list a beat after the first tap - which looks
            // exactly like the tap did it. Carry the ordering over to the bed that just appeared.
            pickOrderSnapshot = { ...pickOrderSnapshot, bed: bedKey, ready: true };
        }
        if (!pickOrderSnapshot || pickOrderSnapshot.bed !== bedKey || pickOrderSnapshot.term !== term) {
            pickOrderSnapshot = { bed: bedKey, term, ready: bedReady, mine: inGarden() };
        }
        const mine = pickOrderSnapshot.mine;
        const all = [...elig.eligible, ...elig.blocked.map((b) => b.species)];
        const hits = all.filter((sid) => !term || commonName(bundle, sid).toLowerCase().includes(term));
        // group: "in this garden" pinned, then by category, each alphabetical
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
        // A rebuild resets scrollTop to 0, which is its own version of the list moving under you - you
        // tap a plant forty rows down and the list snaps back to the top. Hold the position across it.
        const keepScroll = listBox.scrollTop;
        listBox.innerHTML = "";
        rowCounts.clear(); // the old rows are gone; holding their nodes would leak and update nothing
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
                // A CONTAINER, not a <button>: the row now carries its own quantity controls, and a button
                // inside a button is invalid markup that no browser wires up predictably. The tap target is
                // `.pickadd`, which fills the row - so tapping the name still adds one, exactly as before.
                const row = document.createElement("div");
                row.className = why ? "pickrow-item blocked" : "pickrow-item";
                row.dataset.species = sid;
                row.setAttribute("role", "option");
                row.setAttribute("aria-selected", "false");
                if (why)
                    blocked++;
                const add = document.createElement("button");
                add.type = "button";
                add.className = "pickadd";
                if (why)
                    add.disabled = true;
                const nm = document.createElement("span");
                nm.className = "nm";
                nm.textContent = commonName(bundle, sid);
                add.appendChild(nm);
                if (why) {
                    // THE REASON, on the row. Not a title attribute - a phone never shows one (O16 fixed the
                    // same fault on the map's structure gate). The rule's own sentence, code stripped.
                    const w = document.createElement("span");
                    w.className = "pickwhy";
                    w.textContent = why;
                    const rule = blockedRule.get(sid);
                    if (rule)
                        w.title = ruleClaim(bundle, rule);
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
                // THE QUANTITY, ON THE ROW ITSELF. Six tomatoes is six taps in one place: the row does not
                // move, and the count is where the finger already is. Before this, the only steppers lived
                // in the member list BELOW the whole 302px picker - measured 277px away, a third of a phone
                // screen - and they were 26x22px, well under a thumb's ~44px.
                if (!why) {
                    const qty = document.createElement("span");
                    qty.className = "pickqty";
                    const mk = (txt, label, by) => {
                        const b = document.createElement("button");
                        b.type = "button";
                        b.className = "pickstep";
                        b.textContent = txt;
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
                // THE CARD LINK (2026-08-02 ruling). Its own tap target at the row's end, deliberately NOT
                // the row itself: the row IS the add button, and O33 fixed a swallowed tap here by making
                // that gesture handling careful. A second whole-row gesture is the exact change that caused
                // the original fault, so this is a small, separately-labelled control instead.
                //
                // It is a LINK and not a button because it navigates rather than changing anything - the
                // same distinction the Log's plant panel draws, where the writing controls are buttons.
                const info = document.createElement("a");
                info.className = "pickinfo";
                info.href = plantHref(sid);
                info.textContent = "\u203a";
                info.setAttribute("aria-label", `What the corpus records about ${commonName(bundle, sid)}`);
                // The row is an ARIA option; a focusable child inside it confuses a screen reader walking
                // the listbox, so the link is skipped in that traversal and reached by its own label.
                info.addEventListener("click", (e) => { e.stopPropagation(); });
                row.appendChild(info);
                listBox.appendChild(row);
                if (!why)
                    refreshRow(sid); // paint the count this bed already holds
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
    // Re-opening the step is a deliberate act and a fresh look at the list, so the pinned group may
    // re-sort then: what you have added since is now genuinely "in this garden". Registered once -
    // renderMyBed runs on every draw, and a second listener would be harmless but is still a leak.
    const step = document.getElementById("step-mybed");
    if (step && !step.dataset.pickresort) {
        step.dataset.pickresort = "1";
        step.addEventListener("toggle", () => { pickOrderSnapshot = null; });
    }
    q.oninput = () => renderPick();
    renderPick();
    const paint = () => {
        // Placement uses the picked logged bed's traced shape, else the width×length entered on the Plan
        // form - so My bed lays out during initial planning, before any season is logged. History/site
        // come straight from the Plan form. The working config is PER BED (round 13): the picked bed keys
        // its own plants/arrangement/tokens, so switching beds is seamless.
        const bedName = document.getElementById("candbed")?.value ?? "";
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const myBed = activeMyBed(); // the picked bed's own configuration (round 19)
        const region = planBedRegion(bed);
        // Read-back (ISSUES #11 slice 1): the first time a saved bed is opened this session, reconstitute
        // whatever is already in its ground onto the canvas, so tap-to-edit shows the arrangement you saved
        // rather than an empty bed. Once per bed (reseeded) - clearing a bed by hand must stay cleared.
        if (bed && region && !myBed.reseeded) {
            reseedBedFromOccupancy(bed, region, myBed);
            myBed.reseeded = true;
        }
        // Carried-forward perennials are FIXED ground on this canvas (D-122, closing the D-121 fork):
        // they are not draft members (reseed skips them), the seed/optimize layouts plan AROUND their
        // footprints (occupied → place(), D-116), their cells are blocked on the canvas, and the save
        // keeps them. Removing one is a Log lifecycle event (end it), not a replan.
        const myBedOccupied = carriedOccupancy(bed);
        // Placement is INCREMENTAL (maintainer): a freshly added species lands as one plant and each further
        // Add bumps its count by one, so you build the bed up plant by plant. To fill it at researched
        // spacing in one move, use Optimise (the offer below) - that path still scales every member up.
        // D-141 / R-098: the bed's declared structure drives the Optimise layout too - a field opens the
        // same walking lanes here as a named guild does on Plan.
        const obSite = region ? { ...site, region, occupied: myBedOccupied, structure: bed?.structure ?? "in_ground", lane_flip: bed?.lane_flip ?? false } : site;
        const ob = openBed(myBed.members, obSite, bundle);
        const fp = ob.footprint; // footprint fit; also read by the Optimize offer below
        // "Select bed" at the TOP of the step (round 19): pick which bed you're configuring BEFORE adding
        // plants - each bed keeps its own configuration. It drives #candbed (the one source of truth), so
        // the whole plan re-renders for the chosen bed. No saved bed yet → point to "Your ground".
        const bedRow = document.getElementById("mybedbedrow");
        if (bedRow) {
            bedRow.innerHTML = "";
            if (app.logSnapshot.beds.length === 0) {
                const hint = document.createElement("p");
                hint.className = "hint";
                hint.textContent = "No saved beds yet - place one in “Your ground” above, then pick it here to configure it.";
                bedRow.appendChild(hint);
            }
            else {
                const label = document.createElement("label");
                label.setAttribute("for", "mybedbedsel");
                label.textContent = "Select bed";
                const sel = document.createElement("select");
                sel.id = "mybedbedsel";
                // ISSUES #12: a sectioned parent is a pure container - configure its sections, not the whole
                // bed - so it is not offered here either (mirrors the #candbed picker).
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
                    cand.dispatchEvent(new Event("change")); // one source of truth → whole plan re-renders for this bed
                });
                bedRow.append(label, sel);
            }
        }
        // The member list, each removable.
        memberBox.innerHTML = "";
        if (!myBed.members.length) {
            const empty = document.createElement("p");
            empty.className = "hint";
            empty.textContent = "No plants yet - add one above to see where it goes and what fires.";
            memberBox.appendChild(empty);
        }
        ob.members.forEach((m, i) => {
            const row = document.createElement("p");
            row.className = m.eligible ? "role" : "why";
            const blk = m.blockers.map((b) => stripRuleCitations(humanizeFamilies(b.why))).join("; ");
            // A plant that runs on its own says so on its own row. This is the only surface that can say
            // it: E-SPREADS keeps a runner off every guild roster, so the guild role lines above are dead
            // to it by construction, and My-bed is exactly where the gardener puts one there themselves.
            // It does NOT block - mint in a bed is a legitimate choice, it just has a condition attached.
            const spread = containmentNote(bundle, m.species);
            // O80a: a STRUCTURE member (the adopted trellis) is a real row - it can be removed - but it
            // is not a plant: count pinned at 1 (one panel serves the row; the fill already exempts it),
            // no variety, no link (structures have no plant card), and its line says what it is for.
            const rawRec = (bundle.species.find((s) => s.id === m.species)
                ?? (bundle.entities ?? []).find((e) => e.id === m.species));
            const isStructureRow = rawRec?.entity_class === "structure";
            // THE NAME IS A LINK (2026-08-02). This row is the bed's contents - the thing a gardener
            // looks at most on this screen - and it was plain text. The rest of the line stays text so
            // the tap target is the name itself and not the whole row.
            const label = document.createElement("span");
            label.appendChild(document.createTextNode(`${m.eligible ? "·" : ""} ${m.count} × `));
            if (isStructureRow)
                label.appendChild(document.createTextNode(commonName(bundle, m.species)));
            else
                label.appendChild(plantLink(commonName(bundle, m.species), m.species, m.group ?? null));
            // O80b: the support need, said AT PICK TIME in the plant card's own words - the strongest
            // requirement across varieties until one is picked ("advise until resolved", maintainer
            // 2026-08-13), the picked variety's own value after. The fatal R-040 stays resolved-only.
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
                label.title = ruleClaim(bundle, m.blockers[0].rule);
            row.appendChild(label);
            // Cultivar-group picker (D-054 follow-up): a species modelled with cultivar groups - a determinate
            // vs indeterminate tomato, a bush vs vining squash - differs in footprint AND days-to-maturity. Let
            // the user pin the variety so placement and the Calendar use its real numbers instead of the wide
            // span across all groups. The group rides member.group → the placement's groupOf → the saved
            // planting's cultivar_group (the plumbing already existed; this is the missing control).
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
                    // The variety's OWN name where the corpus gives it one (groupLabel): "kohlrabi", not
                    // "Gongylodes". Where it doesn't, the species-qualified form ("cucumber - bush").
                    o.value = String(g.id);
                    o.textContent = groupLabel(bundle, m.species, String(g.id));
                    gsel.appendChild(o);
                }
                gsel.value = myBed.members[i].group ?? "";
                gsel.onchange = () => {
                    const g = gsel.value || null;
                    myBed.members[i].group = g;
                    // Carry the variety onto every token of this species NOW (member.group is the source of truth):
                    // the save reads each token's group, and a same-count reseed wouldn't have to run, so a stale
                    // "any variety" could otherwise be written for some plants. (Surfaced once the seed fills.)
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
            // − drops one (removing the plant at zero); + adds one; remove clears the species.
            // A structure keeps only "remove": one panel serves the row, so counting it is meaningless.
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
            rm.className = "linky";
            rm.textContent = " remove";
            rm.onclick = () => { myBed.members.splice(i, 1); myBedEdited(); paint(); };
            row.appendChild(rm);
            memberBox.appendChild(row);
        });
        // Keep the step-4 summary chip live - member edits repaint here without a full draw()
        // (D-079 slice 3; written directly to avoid a plan↔sheet import cycle).
        const mySum = document.getElementById("sum-mybed");
        if (mySum) {
            const n = myBedMemberCount();
            mySum.textContent = n ? `${n} plant${n === 1 ? "" : "s"}` : "";
        }
        // The results: placement, footprint, bed-level flags, and complete-a-guild suggestions.
        resultBox.innerHTML = "";
        const p = (cls, text) => {
            const el = document.createElement("p");
            el.className = cls;
            el.textContent = text;
            resultBox.appendChild(el);
            return el;
        };
        // Placement - the Configurable Bed is ALWAYS the draggable canvas (walkthrough round 15): plants
        // can be freely moved at every stage - initial, after Optimize, after Revert. The recommended
        // layout SEEDS the tokens; Optimize re-seats them to an arranged/trimmed layout; a manual drag
        // persists. (The named guilds keep their read-only archetype diagrams - this change is My-bed only.)
        const grid = region ? bedGrid(region) : null;
        const groupOf = new Map(myBed.members.map((mm) => [mm.species, mm.group ?? null]));
        const tokSig = () => tokenSignature(myBed.members, grid);
        const pl = ob.placement;
        if (pl && grid) {
            const polar = pl.polar;
            // One plant has no neighbour to shade, so don't claim a height-ordering we didn't do (round 20).
            const single = pl.zones.length < 2;
            p("window", single
                ? `Your bed - drag the plant to where it really grows, or tap it to remove it${myBed.optimized ? " (optimized layout applied)" : ""}. Add plants one at a time and we'll order them tallest to the ${polar}; Optimise fills the bed at proper spacing:`
                : `Your bed - drag each plant to where it really grows, or tap one to remove it${myBed.optimized ? " (optimized layout applied)" : ""}. We've ordered them tallest to the ${polar}, so nothing shades a shorter neighbour; Optimise fills the bed at proper spacing:`).title = ruleClaim(bundle, "R-003");
            // D-079 slice 4 / D-086: a rotated bed lays out in its OWN frame but is DRAWN tilted to match how
            // it sits on the ground (the map + the Log tile). Name the edge the tall row hugs and hand the
            // canvas both the frame→plot transform (R-003 check) and the residual tilt (the drawing angle).
            const bedO = bed ? bedOrientation(bed) : null;
            if (bedO && bed) {
                const EDGE = ["top", "right", "bottom", "left"];
                p("hint", `“${bed.name}” is rotated ${bed.rotation_deg}° - shown tilted to match the ground. ` +
                    `The tall row sits along its ${EDGE[bedO.orient.poleward_edge]} edge, the one facing most nearly ${polar}.`);
            }
            const toWorld = bedO
                ? (x, y) => orientedToPlot(x, y, bedO.orient.eff_w, bedO.orient.eff_l, bedO.orient.residual_deg, bedO.cx, bedO.cy)
                : undefined;
            // D-141: the bed's reserved lanes/paths, in the region frame the grid uses - so the SEED keeps
            // plants out of them (a cell whose centre falls in a band is off-limits, like occupied ground).
            const laneRects = region ? computeAccessBands(bed?.structure ?? "in_ground", region, bed?.lane_flip ?? false) : [];
            // Block a cell whose TOKEN DOT would cross a walkway, not only one whose centre sits in it: on the
            // coarse canvas grid a cell just outside the path still draws its disc over it (the reported
            // "placing on the walking path border"). Inset by the drawn dot radius (~0.44 of a cell) so the
            // whole token stays clear of the path.
            const laneMargin = 0.44 * Math.min(grid.cellW, grid.cellH);
            // col/row are the token's position in cell units (col*cellW from the west edge - the half-cell
            // grid the seed and the drag share), so the lane test reads the position directly, not a cell index.
            const laneCell = (col, row) => {
                const x = grid.x0 + col * grid.cellW, y = grid.y1 - row * grid.cellH;
                return laneRects.some((b) => b.x0 - laneMargin <= x && x < b.x1 + laneMargin && b.y0 - laneMargin <= y && y < b.y1 + laneMargin);
            };
            // Seed the canvas to the recommended layout when the plants OR the bed change - this also drops
            // any optimize/revert context (switching beds or editing plants is a fresh layout). A manual drag
            // (same plants + bed) keeps its positions; Optimize/Revert set the tokens directly.
            if (tokSig() !== myBed.tokenSig) {
                myBed.tokens = seatTokens(pl, grid, groupOf, laneCell);
                myBed.tokenSig = tokSig();
                myBed.baseline = null;
                myBed.optimized = false;
            }
            // Heights per species for the live R-003 check (slice 2), resolved like the recommendation does.
            const heightOf = new Map();
            for (const [sp, gp] of groupOf) {
                const h = resolveSpecies(sp, gp, bundle).mature_height_cm;
                heightOf.set(sp, Array.isArray(h) ? Number(h[h.length - 1]) : Number(h ?? 0));
            }
            const r003 = bundle.rules.find((x) => x.id === "R-003");
            // Dragging a plant redraws the canvas in place (no full re-render), so a save button already in
            // its "saved" state won't refresh on its own - this hook lets a move re-enable it (round 17).
            let onSaveReenable = null;
            // A non-rotated polygon bed (round → 32-gon, traced → its outline) draws its true shape and masks
            // off-bed cells; a rect or rotated-rect fills its box, so no polygon is passed (it uses rotationDeg).
            const bedPolygon = region && region.shape === "polygon" ? regionPoints(region) : undefined;
            const laneBands = laneRects.map((b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]);
            // Tap-to-remove (maintainer ask): pick exactly which dot to delete. Drop the tapped token AND
            // decrement that species' member count (dropping the member at zero), then keep the rest of the
            // arrangement - sync the reseed signature to the new member set so the repaint doesn't re-seed.
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
                myBed.tokenSig = tokenSignature(myBed.members, grid); // members changed - keep the layout, don't reseed
                myBed.optimized = false;
                myBed.baseline = null; // a manual edit is a fresh layout (like a drag off an optimize)
                onSaveReenable?.();
                paint();
            };
            // O80b: the support structures' recommended placement - the poleward-edge line, computed by
            // the same engine helper the oracle pins (structureLine), drawn on the canvas and said in
            // words with the zone lines below.
            const supLines = structureLine(myBed.members, obSite, bundle);
            resultBox.appendChild(myBedCanvas(grid, bundle, { thresholdCm: r003?.trigger?.threshold_cm ?? 120, lat: site.lat ?? null, heightOf, polar, toWorld, onMove: () => onSaveReenable?.(), onRemove: removeToken, rotationDeg: bedO ? bedO.orient.residual_deg : 0, polygon: bedPolygon, occupied: myBedOccupied, laneBands, supports: supLines }, myBed.tokens));
            // Name the fixed ground (D-122): the blocked cells are a carried perennial, not dead space.
            if (myBedOccupied.length) {
                const openSn = app.logSnapshot.seasons.find((sn) => sn.id === app.logSnapshot.seasonId);
                // O46: the names keep their ids (the old Set deduped labels and threw the ids away), so
                // each carried crop links to its card. Deduped by label as before; a carried user variety
                // has no card - its label stays in the sentence and contributes no mark. Gated on
                // app.userSpecies, not bundle membership: this function gets the ACTIVE bundle.
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
                noteEl.title = ruleClaim(bundle, "R-002");
            }
            const dh = p("hint", "Drag any plant to match your real bed, or tap one to remove it. ");
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "linky";
            reset.textContent = "reset to recommended";
            reset.onclick = () => { myBedEdited(); paint(); };
            dh.appendChild(reset);
            // Recommended positions, in words (the canvas shows the live arrangement; this is the guidance).
            const opp = polar === "north" ? "south" : "north";
            const colours = zoneColorMap(pl.zones);
            pl.zones.forEach((z, i) => {
                if (z.count === 0)
                    return; // all of it fell on occupied ground (D-123)
                const where = single ? "the whole bed"
                    : i === 0 ? `the ${polar} side` : i === pl.zones.length - 1 ? `the ${opp} side` : "the middle";
                resultBox.appendChild(placementLine(bundle, z, where, colours.get(z.species)));
            });
            // The structure's own line, in the same prose the plants get: WHERE it goes and who climbs it.
            for (const sup of supLines) {
                const climbs = sup.for.map((sid) => commonName(bundle, sid).toLowerCase()).join(", ");
                const sl = p("role", `— ${commonName(bundle, sup.id)}: along the ${sup.edge} edge`
                    + ` (~${Math.round(sup.length_m * 39.37)} in)${climbs ? ` - the ${climbs} climb${sup.for.length === 1 ? "s" : ""} it` : ""}.`);
                sl.title = ruleClaim(bundle, "R-040");
            }
            // OPTIMIZE / REVERT - one reliable click each (walkthrough round 16b). Optimize APPLIES on the
            // click: no fragile two-step proposal populated in place, which a stray map re-render could wipe
            // between "Optimize" and "Apply" (the reported "optimization doesn't happen"). It snapshots the
            // current layout ONCE, trims to fit + arranges into the bed's archetype, and re-seats the canvas
            // (still draggable). What it changed is shown below, and Revert restores the pre-optimize layout
            // EXACTLY. rings skip the trim (vertical stacking isn't crowding). Always available - so
            // optimizing always optimizes, even across cycles of edits and reverts.
            // Offer Optimize whenever there are 2+ plant INSTANCES to arrange - including MULTIPLES of a
            // single species (round 21): it proposes their even distribution across the bed and trims the
            // count to what fits. A lone single plant (round 20) has nothing to distribute, so it stays out.
            const totalInstances = myBed.members.reduce((n, m) => n + (m.count ?? 1), 0);
            const oneSpecies = myBed.members.length === 1;
            if (totalInstances >= 2 && site.lat != null) {
                // O76 §2.3: layout archetypes, not guild names - the guild vocabulary belongs to the
                // cards and to compose's redirect, and a LAYOUT called "Three-Sisters-style" blurred the
                // seam between arranging and proposing.
                const ARCH_LABEL = {
                    hills: "a mound grid (the climbers share the mounds, the vines fill the gaps)",
                    rings: "concentric rings (the woody centre, understory out to the drip line)",
                    grid: "a mixed bed (the tallest crops banded, the rest interplanted)",
                };
                // One species has no "mixed bed" to band - it's an even stand spaced to fit (round 21).
                const archLabel = (arch) => oneSpecies ? "an even stand - spaced to fill the bed" : (ARCH_LABEL[arch] ?? arch);
                const applyOptimize = () => {
                    myBed.pendingArrange = false;
                    const arch = bedArchetype(myBed.members, bundle);
                    // Optimize FILLS the bed (D-141, maintainer): each species you picked is scaled up to plant
                    // its share of the bed at that species' own researched spacing - the same fill the prescribed
                    // guilds use, no invented density - so a hand-built bed reads full instead of a few plants
                    // stranded in open ground. It never CUTS below what you set (a deliberately crowded annual
                    // bed keeps every plant; the graded layout condenses and the R-002 footprint flag advises the
                    // crowding), and it fills against the PLANTABLE area - the reserved access lanes (R-098) are
                    // subtracted so the fill doesn't crowd its own paths. The ONE case that still TRIMS is a
                    // mini-ORCHARD: multiple trees the bed physically can't hold (you can't pack 25 peaches into
                    // 4m²) are cut to what fits. A single fruit-tree guild keeps its tree + understory.
                    const treeCount = myBed.members.reduce((n, m) => n + (resolveSpecies(m.species, m.group ?? null, bundle).habit === "tree" ? (m.count ?? 1) : 0), 0);
                    const plantable = region ? plantableArea(region, bed?.structure ?? "in_ground", bed?.lane_flip ?? false) : 0;
                    const opt = (arch === "rings" && treeCount > 1)
                        ? optimizeBed(myBed.members, obSite, bundle)
                        : { members: filledMembers(myBed.members, plantable, bundle) };
                    if (!myBed.baseline)
                        myBed.baseline = { members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) };
                    myBed.members = opt.members.map((m) => ({ species: m.species, group: m.group ?? null, count: m.count ?? 1 }));
                    let optPl = optimizedPlacement(myBed.members, obSite, bundle).placement;
                    // D-143 (maintainer, 2026-07-24): the LAYOUT is the truth the plant list follows. A mound
                    // bed seats what its thinned hills hold (D-065), and a rings bed holds what its circles
                    // have circumference for - so the member counts SNAP to the layout and the placement
                    // re-runs once on the snapped counts (a fixed point: everything now seats). The list, the
                    // canvas, and what gets planted agree; the fill summary below reports the real numbers.
                    if (optPl) {
                        const snapped = snapCountsToLayout(myBed.members, optPl, arch, bundle);
                        if (snapped) {
                            myBed.members = snapped;
                            optPl = optimizedPlacement(myBed.members, obSite, bundle).placement;
                        }
                    }
                    myBed.tokens = optPl ? seatTokens(optPl, grid, new Map(myBed.members.map((mm) => [mm.species, mm.group ?? null])), laneCell) : myBed.tokens;
                    myBed.optimized = true;
                    myBed.tokenSig = tokSig(); // members changed; set the sig so the reseed keeps the arranged tokens
                    paint();
                };
                // The adopt handoff (O76 decision 2): a queued arrange runs through the SAME path the
                // button uses, next paint after adoption. One-shot; the gate above (2+ instances, a
                // located site) already held or we would not be here.
                if (myBed.pendingArrange) {
                    // Next frame, not mid-render: applyOptimize repaints, and painting while painting is
                    // the exact async-wipe class scenario 86 once caught.
                    myBed.pendingArrange = false;
                    requestAnimationFrame(applyOptimize);
                }
                if (myBed.optimized && myBed.baseline) {
                    const arch = bedArchetype(myBed.members, bundle);
                    // What the trim changed, derived from the snapshot (so it survives any re-render).
                    const tally = (ms) => { const t = new Map(); for (const m of ms)
                        t.set(m.species, (t.get(m.species) ?? 0) + (m.count ?? 1)); return t; };
                    const was = tally(myBed.baseline.members), now = tally(myBed.members);
                    // SAY WHAT IT DID, IN ONE NUMBER FIRST (maintainer, 2026-07-31; approved). Optimise fills
                    // the bed at each species' own spacing, which can turn 17 plants into 84 - a jump that was
                    // reported as "odd results" precisely because the per-species lines below stated every
                    // change except the one a gardener notices first. The total is not a warning: filling IS
                    // the feature. It just has to be said out loud rather than left to be discovered.
                    const sum = (t) => [...t.values()].reduce((a, b) => a + b, 0);
                    const before = sum(was), after = sum(now);
                    p("lead", before === after
                        ? `Filled & arranged as ${archLabel(arch)} - the same ${after} plant${after === 1 ? "" : "s"}, rearranged.`
                        : `Filled & arranged as ${archLabel(arch)} - ${before} plant${before === 1 ? "" : "s"} `
                            + `${after > before ? "filled out to" : "trimmed to"} ${after}, at each species' own spacing.`);
                    for (const [sp, w] of was) {
                        const n2 = now.get(sp) ?? 0;
                        // O46: the optimizer names the plant it trimmed or grew - and that name links, because
                        // "why did it remove three of these?" is answered on the plant's own card.
                        const spName = commonName(bundle, sp);
                        if (n2 < w) {
                            // A removal is the one membership-shaped act in the geometry tool - it wears the
                            // same greyed-with-reason face as every exclusion (O76 SS2.4, invariant 2).
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
                    rev.textContent = "↩ revert to my layout";
                    rev.onclick = () => {
                        myBed.members = myBed.baseline.members;
                        myBed.tokens = myBed.baseline.tokens;
                        myBed.baseline = null;
                        myBed.optimized = false;
                        myBed.tokenSig = tokSig(); // matches the restored members+grid, so the reseed does not clobber
                        paint();
                    };
                    controls.appendChild(rev);
                    controls.appendChild(document.createTextNode(" · "));
                    const reopt = document.createElement("button");
                    reopt.type = "button";
                    reopt.className = "linky";
                    reopt.textContent = "re-arrange";
                    reopt.onclick = applyOptimize;
                    controls.appendChild(reopt);
                }
                else {
                    const optWrap = document.createElement("div");
                    optWrap.className = "subst";
                    const seam = document.createElement("p");
                    seam.className = "hint";
                    seam.textContent = "Fills and arranges what you've already chosen - it never adds or "
                        + "removes a plant for rule reasons; compose (below) does that.";
                    optWrap.appendChild(seam);
                    const optBtn = document.createElement("button");
                    optBtn.type = "button";
                    optBtn.className = "linky";
                    optBtn.textContent = "Fill & arrange this bed →";
                    optBtn.onclick = applyOptimize;
                    optWrap.appendChild(optBtn);
                    resultBox.appendChild(optWrap);
                }
            }
            // APPLY the configured bed to a saved bed (walkthrough round 11). The named guild cards carry
            // this affordance in .applybox; the Configurable Bed Option lacked it once optimised - the
            // only save lived in the drag-canvas branch and dead-ended when no season was open. Now it
            // renders under BOTH the drag canvas AND the optimised arrangement, with the same bed picker
            // and inline start-season as the guild cards. It saves the CURRENT arrangement as occupancy
            // (dragged tokens on the canvas; the seated prescribed placement otherwise) - real ground,
            // never the corpus. Gated on a PLACED bed: a bare W×L rect has no ground to save onto.
            if (bed && grid) {
                const applyBox = document.createElement("div");
                applyBox.className = "applybox";
                resultBox.appendChild(applyBox);
                // Draft vs saved (walkthrough #2b): the plants above are a DRAFT - nothing reaches the Log
                // until you save - so say plainly whether the draft matches what's committed, and offer a
                // Reset to bail out of an experiment. Composition-level (what plants, how many); a fine drag
                // is handled separately by the save-button re-enable below.
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
                // The bed picker moved to the TOP of the step ("Select bed", round 19) - you choose the bed
                // before configuring it, not down here at save time, so multiple beds are easy to manage.
                // Tokens to save: the user's dragged canvas if that is the current view, else the tokens
                // seated from the prescribed/optimised placement (so "Apply arrangement" is savable too).
                // Save the CURRENT view: the user's dragged canvas when freeform, else the seated tokens of
                // the applied/optimized arrangement - so hitting save after Apply saves the optimization.
                const tokensToSave = () => myBed.tokens; // the canvas IS the layout now (round 15)
                const n = tokensToSave().length;
                const out = document.createElement("span");
                out.className = "hint";
                const seasonId = app.logSnapshot.seasonId;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "saveplan";
                // After a save the button disables and shows "Saved". Dragging a plant afterwards changes the
                // layout, so re-enable the button (and clear the confirmation) so the move can be saved (round 17).
                onSaveReenable = () => {
                    if (!btn.disabled)
                        return;
                    btn.disabled = false;
                    out.className = "hint";
                    out.textContent = " moved a plant - save again to update this bed.";
                };
                if (seasonId != null) {
                    btn.textContent = `save ${n} plant${n === 1 ? "" : "s"} → “${bed.name}” (season ${seasonId})`;
                    btn.onclick = () => void (async () => {
                        const warn = overwriteGate(bed.name, true); // the My-bed save keeps carried overwinterers too (D-122)
                        if (warn) {
                            out.className = "why";
                            out.textContent = ` ${warn}`;
                            return;
                        } // armed - tap save again
                        btn.disabled = true;
                        out.className = "hint";
                        out.textContent = " saving…";
                        try {
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, seasonId, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), myBed.composed === true, myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species));
                            // Update the ground map IMMEDIATELY (round 14): recompute the plan dots (the cleared
                            // guild's dots drop) and redraw - the map read stale until the next draw() before, which
                            // is the "lag before you see it on the map". Fast, in-memory; no store re-read.
                            app.planDots = appliedPlanDots(bundle, site);
                            app.groundRedraw?.();
                            // Refresh the LOG too (walkthrough): saving persisted the plants and redrew the map, but
                            // the Log view kept its old plants - only the start-a-season and guild-save paths refreshed
                            // it, this open-season branch was missed. The confirmation FLOATS (O12) so the repaint
                            // logRefresh triggers can't wipe it.
                            toast(`Saved ${saved} plant${saved === 1 ? "" : "s"} to “${bed.name}”, season ${seasonId}`);
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
                    // No open season: start one inline and save, exactly as the guild cards do. No sign-in gate
                    // - seasons are browser-local (D-013); the account comes after (maintainer's round-4 ruling).
                    const year = new Date().getFullYear();
                    btn.textContent = `start season ${year} & save ${n} plant${n === 1 ? "" : "s"} → “${bed.name}”`;
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
                            const saved = await saveMyBedPlantings(tokensToSave(), grid, toWorld, year, bed.region, bed.name, new Map(myBed.members.map((m) => [m.species, m.group ?? null])), myBed.composed === true, myBed.members.filter((m) => (bundle.entities ?? []).some((e) => e.id === m.species)).map((m) => m.species));
                            // logRefresh selects the newest season (→ seasonId set) and repaints this panel; the
                            // confirmation floats (O12), so the repaint can't wipe it.
                            toast(`Started season ${year} and saved ${saved} plant${saved === 1 ? "" : "s"} to “${bed.name}”`);
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
                // Reset - bail out of a draft. With saved occupancy it reverts to that (discard unsaved edits);
                // with nothing saved it clears the bed so you can start over. Either way paint() re-reads the
                // saved occupancy (reseeded=false), so the canvas matches the Log again.
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
        // Footprint fit - only once there are plants; "~0 m² of your 4 m² bed" on an empty bed is noise.
        // O30: the fit is judged against the PLANTABLE ground (the bed less its reserved paths, R-098),
        // so when the two differ the sentence names the plantable figure and says where the rest went -
        // quoting the bed's outline while measuring against something smaller is how a user ends up
        // arguing with arithmetic they cannot see.
        if (fp.bed_m2 != null && fp.total_m2 > 0) {
            const pl = fp.plantable_m2;
            const pathed = pl != null && pl < fp.bed_m2 - 1e-9;
            const ground = pathed ? `${fmtArea(pl)} of plantable ground` : `${fmtArea(fp.bed_m2)} bed`;
            const aside = pathed ? ` (your ${fmtArea(fp.bed_m2)} bed, less the paths it needs to reach).` : ".";
            if (fp.fits) {
                p("hint", `Footprint ~${fmtArea(fp.total_m2)} of your ${ground}${aside}`);
            }
            else if (myBed.optimized) {
                // O77 (maintainer, 2026-08-13): once the bed is ARRANGED the plants seat at each species'
                // researched IN-ROW spacing - the diagram just above shows them fitting - so R-002's
                // mature-SPREAD overflow is the expected canopy-knit of a filled bed, not a bed that
                // cannot hold them. Two prices, both real: they fill the bed AS PLANTED, and their mature
                // canopies add up past it. Naming both keeps R-002's geometry visible (the ~figure, over
                // the bed) without the bald "needs more than your bed" that flatly contradicts the
                // arrangement on the same screen. R-002 still fires in the engine; this is how an arranged
                // bed READS it, and a manual edit (which clears `optimized`) returns the plain warning.
                p("hint", `Arranged at each species' own spacing, they fill the bed. At maturity the canopy `
                    + `adds up to ~${fmtArea(fp.total_m2)} - more than your ${ground}, so the planting knits `
                    + `closed as it matures.`);
            }
            else {
                p("why", `These plants need ~${fmtArea(fp.total_m2)} - more than your ${ground}${aside}`);
            }
        }
        // Bed-level flags (R-002 is shown above with the footprint; surface the rest), TRIAGED BY THE
        // CORPUS'S OWN SEVERITY (O12, approved mockup 2026-07-29): fatal and costly stay OPEN as
        // anchored, severity-striped cards, each carrying the rule's remedy; anything softer folds
        // behind a count together with the complete-a-guild suggestions. Never a toast, never a
        // modal - invariant 2 wants the reason shown, not dismissed; the screen is won back by
        // folding and ranking, not by making reasons temporary.
        // "early_summer" -> "early summer". The corpus's season tokens are machine vocabulary; a
        // gardener reads words.
        const seasonLabel = (t) => t.replace(/_/g, " ");
        // What would close a forage gap: species already in the corpus that WOULD be in flower then,
        // named with the space each needs so the gardener can judge fit rather than being sold a plant
        // that does not fit the bed (invariant 2's spirit - a suggestion that cannot fit is not a
        // suggestion). Capped at three: this is an aside on a bed report, not a catalogue.
        // O46: it returns its MARKS with its words. The offer is a list of plants the gardener is being
        // asked to consider, so they are exactly the names someone wants to open - and the LABEL is the
        // crop name alone, never the "(45 cm across)" that follows it, so the link stays on the plant.
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
            // A NULL subject means the flag is about the BED, not a plant (R-107). Computing a plant name
            // from it would be meaningless, so the name is only derived where there is a subject.
            const name = f.subject === null ? "" : commonName(bundle, f.subject);
            let msg = null;
            if (f.rule === "R-040")
                msg = `${name} needs a strong support and nothing in the bed provides one.`;
            else if (f.rule === "R-001")
                msg = `plant at least ${f.need} ${name} in a block of 4+ rows for pollination - you have ${f.have}.`;
            // R-080 says "2+ GENETICALLY DISTINCT plants", and for apple and pear that is a second
            // CULTIVAR, not a second tree - two Honeycrisp are two plants and no fruit. `min_cultivars`
            // carried that and was read by nothing (ISSUES #15), so this line said "plants" for every
            // species and was wrong exactly where it mattered most.
            else if (f.rule === "R-080") {
                const cv = cultivarPartner(bundle, f.subject);
                msg = cv
                    ? `${name} needs ${cv} different varieties to set fruit - you have ${f.have}. Two of the same variety will not pollinate each other.`
                    : `${name} needs at least ${f.need} plants to set fruit - you have ${f.have}.`;
            }
            // R-102: the crop needs an insect vector and nothing else in this bed flowers while it does.
            //
            // THREE THINGS THIS SENTENCE MUST NOT DO, all of them one careless clause away. It must not
            // say the gardener HAS no pollinators - bees arrive from outside the bed and we cannot see
            // them. It must not say this is why anything failed - every source names weather first and
            // D-008 denies us weather. And it must not promise the fix works: the rule's own `remedy`,
            // rendered below, carries "a reasonably supported suggestion, not a proven fix", which is
            // R-052's grade in plain words. What it CAN say is what is true: this crop needs an insect,
            // and nothing you planted is in flower when it does.
            else if (f.rule === "R-102") {
                const [lo, hi] = (f.bloom ?? ["early_summer", "late_summer"]);
                const when = lo === hi ? seasonLabel(lo) : `${seasonLabel(lo)} to ${seasonLabel(hi)}`;
                msg = `${name} needs an insect to carry pollen between its flowers, and nothing else in `
                    + `this bed is in flower from ${when}.`;
            }
            // R-107: the only flag here that names no plant. A container's water demand belongs to the
            // vessel, so the sentence is about the bed and every occupant inherits it. It says CHECK more
            // often, never how much to give - that is weather, and the refusal rule owns it.
            else if (f.rule === "R-107") {
                msg = "This is a container, and a container dries out faster than the ground: its soil "
                    + "volume is small and its whole root zone sits above ground. Check it at least once a "
                    + "day, and twice when it is hot, dry or windy.";
            }
            if (msg) {
                const rule = bundle.rules.find((x) => x.id === f.rule);
                const offer = f.rule === "R-102" && f.bloom
                    ? forageOffer(f.bloom, ob.members.map((m) => m.species))
                    : null;
                // The picture of the same gap: when the crop needs insects, against when this bed feeds
                // them. Season-by-season, five cells - the corpus's whole bloom vocabulary, and the reason
                // this is NOT a calendar (it has no days in it, and the season-to-date mapping does not
                // exist; see the survey's Calendar refusal).
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
                    // The flag's own subject first, then whatever the appended offer named. The subject
                    // leads the sentence, so it claims its span before the offer's list is reached.
                    names: [
                        ...(f.subject && name ? [{ label: name, species: f.subject }] : []),
                        ...(offer?.marks ?? []),
                    ],
                    remedy: typeof rule?.remedy === "string" ? stripRuleCitations(rule.remedy) : null,
                    severity: typeof rule?.severity === "string" ? rule.severity : "suboptimal",
                });
            }
        }
        // The bloom ribbon: two rows of five seasons - when this crop needs insects, and when anything
        // in the bed is in flower. The mismatch is the gap the sentence already states; drawing it makes
        // "from early summer to late summer" legible at a glance on a phone.
        //
        // NOT A CALENDAR, and it must never be mistaken for one: there are no days in it, because the
        // season-to-date mapping does not exist in the corpus. That is the same reason R-102 is kept off
        // the Calendar entirely (survey ruling, 2026-08-02).
        //
        // Colour is NOT the only channel: each cell carries a text title, and the row labels say which
        // is which, so the picture is redundant with the sentence above it rather than load-bearing.
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
            // O46: the crop a flag is about opens its card. A gardener told their bed has a problem with
            // a named plant is exactly who wants that plant's record - the same argument as the blocked
            // list. A bed-level flag (R-107) carries no name and renders plain.
            if (o.names?.length)
                linkNamesIn(claim, o.text, o.names);
            else
                claim.textContent = o.text;
            claim.title = ruleClaim(bundle, o.rule); // the rule's own sentence, one hover away
            box.appendChild(claim);
            if (o.ribbon)
                box.appendChild(bloomRibbon(o.ribbon));
            if (o.remedy) {
                const fix = document.createElement("p");
                fix.className = "outfix";
                fix.textContent = o.remedy;
                box.appendChild(fix);
            }
            // O80b: R-040's remedy is ACTIONABLE - the corpus already holds the object the remedy names
            // (the trellis entity: cattle panel, bamboo tripod, string trellis), so offer it as one tap
            // instead of leaving the gardener to hunt the picker for a thing the picker doesn't list.
            // The layout runs it along the shaded edge; the fill never multiplies it.
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
        // Complete-a-guild suggestions, grounded in the curated guilds - suggestions by nature, so
        // they live in the fold with the softer flags.
        // O46: a suggestion is a list of plants the gardener is being asked to go and get, so the
        // "(e.g. Borage, Dill)" examples are the names most worth opening on this whole card. The ids
        // are already in hand - `mr.fillers` is what the labels were built FROM.
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
        // ---- O68: "A planting for your bed" -------------------------------------------------------
        // The composed planting (DECISION-custom-guild.md): treats the plants added above as the
        // gardener's ASKS and proposes a planting where every element carries the rule that put it
        // there - a want, a graded positive rule, or a structural fit. Never called a guild; a
        // near-guild result REDIRECTS to the documented version. No canvas - adopting the proposal
        // hands it to this same bed, and the existing layout/save paths carry it from there.
        const compBox = document.createElement("div");
        compBox.className = "composebox";
        const ch = document.createElement("h4");
        ch.textContent = "A planting for your bed";
        compBox.appendChild(ch);
        const chint = document.createElement("p");
        chint.className = "hint";
        // O75b (maintainer): with picks, compose builds AROUND them; with none, it is a FRESH TAKE
        // from what the corpus knows about this ground - two different promises, said plainly.
        chint.textContent = myBed.members.length
            ? "Compose around what you've added: every proposal names the reason it is there, "
                + "and what your site rules out is shown with the rule that ruled it out."
            : "Compose a fresh bed from what we know about this ground - its history chooses the "
                + "anchor, every addition names its rule, and ground with nothing to say says so.";
        compBox.appendChild(chint);
        const cbtn = document.createElement("button");
        cbtn.type = "button";
        cbtn.id = "composebtn";
        cbtn.className = "stepnext";
        cbtn.textContent = myBed.members.length ? "Compose around these →" : "Compose a fresh bed →";
        compBox.appendChild(cbtn);
        const cout = document.createElement("div");
        cout.id = "composeout";
        compBox.appendChild(cout);
        cbtn.addEventListener("click", () => {
            // O76 SS3 (decision 4): the sibling beds' OPEN-SEASON LIVE plantings ride along - the
            // composer's licensed window onto the rest of the plot. Sections are excluded the same
            // way every planner surface excludes them.
            const openSeason = app.logSnapshot.seasons.find((s2) => s2.id === app.logSnapshot.seasonId);
            const sibs = app.logSnapshot.beds
                .filter((b) => b.name !== candbedValue() && !bedHasSections(b.name, app.logSnapshot.beds))
                .map((b) => ({ name: b.name, region: b.region,
                species: (openSeason?.plantings ?? [])
                    .filter((pl) => !pl.end_cause && plantingOnBed(pl.region, b.region))
                    .map((pl) => pl.species) }));
            myBed.composeResult = compose({ ...obSite, siblings: sibs }, myBed.members.map((m) => m.species), bundle);
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
            // The proposal, each element with its warrant - clickable to the rule's own claim (D-083:
            // the link text is the claim, never the code).
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
                        // The fresh-take anchor: the ground's own why, with the rule's claim as the link.
                        const a = document.createElement("a");
                        a.href = `#/why?rule=${p.warrant.rule}`;
                        a.textContent = stripRuleCitations(humanizeFamilies(p.warrant.why ?? ruleClaim(bundle, p.warrant.rule ?? "")));
                        a.title = ruleClaim(bundle, p.warrant.rule ?? "");
                        w.textContent = " - from your ground: ";
                        w.appendChild(a);
                    }
                    else {
                        const a = document.createElement("a");
                        a.href = `#/why?rule=${p.warrant.rule}`;
                        a.textContent = stripRuleCitations(ruleClaim(bundle, p.warrant.rule ?? ""));
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
            // Exclusions: greyed, each with its reason (invariant 2 - never silently dropped).
            for (const e of res.exclusions) {
                const pe = document.createElement("p");
                pe.className = "composeexcl";
                pe.textContent = `${commonName(bundle, e.species)} - ${e.why}`;
                box.appendChild(pe);
            }
            // O76 SS3: what the SIBLING BEDS contribute - each line names its rule by claim (D-083).
            for (const n of res.neighbours ?? []) {
                const pn = document.createElement("p");
                pn.className = "composenbr";
                const link = document.createElement("a");
                link.href = `#/why?rule=${n.rule}`;
                link.title = ruleClaim(bundle, n.rule);
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
                else if (n.kind === "same_family_patch") {
                    // R-111: an unbroken single-family run across ADJACENT beds is a larger host patch. Named,
                    // never docked - a massed block can be the right call, so this discloses the trade-off.
                    pn.append(`Your ${familyName(String(n.detail.family))} here and in ${n.detail.with.join(", ")} make one unbroken host patch - easier for a specialist pest to find than a broken run - `);
                    link.textContent = "the reason to break it up";
                    pn.appendChild(link);
                    pn.append(".");
                }
                box.appendChild(pn);
            }
            // The band, honestly applied: zero interaction reads like the culinary bundles do.
            const hb = document.createElement("p");
            hb.className = "composeband";
            hb.textContent = res.harmony.score > 0
                ? (res.harmony.band === "backed"
                    ? "The corpus backs this arrangement."
                    : "Partly corpus-backed - some of these carry a real mechanism together.")
                : "These all grow here, and the corpus claims no interaction between them.";
            box.appendChild(hb);
            // Disclosure: what was NOT checked, named plainly (the O28 pattern).
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
            // The redirect: near a documented guild, offer the real one instead of a near-copy.
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
            // Adopt: the proposal becomes this bed's member list; the normal layout/save flow carries
            // it, and the save writes each planting composed: true (maintainer decision 2026-08-12).
            if (res.proposal.length) {
                const adopt = document.createElement("button");
                adopt.type = "button";
                adopt.id = "composeadopt";
                adopt.className = "stepnext";
                adopt.textContent = "Use this planting →";
                adopt.addEventListener("click", () => {
                    // Revert points at the PRE-ADOPT bed (the baseline applyOptimize would otherwise take).
                    if (!myBed.baseline)
                        myBed.baseline = { members: cloneMembers(myBed.members), tokens: cloneTokens(myBed.tokens) };
                    // O80a (bug B1, docs/DECISION-plant-support.md): the trellis lives in bundle.ENTITIES,
                    // not bundle.species - the old species-only check silently discarded it on every adopt,
                    // leaving R-040 firing on the very bed the proposal was meant to fix. A proposed member
                    // survives adoption if EITHER list resolves it.
                    const known = (sid) => bundle.species.some((s) => s.id === sid)
                        || (bundle.entities ?? []).some((e) => e.id === sid);
                    myBed.members = res.proposal
                        .filter((p) => known(p.species))
                        .map((p) => ({ species: p.species, group: null, count: p.count }));
                    myBed.composed = true;
                    myBed.composeResult = null;
                    myBed.optimized = false;
                    myBed.tokenSig = "";
                    myBed.pendingArrange = true; // O76 decision 2: the handoff - adopt ends arranged
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
