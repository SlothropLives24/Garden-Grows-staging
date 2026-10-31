import './chunk-lutet8cz.js';
import { dayOfYearIso } from './chunk-d70vvzl3.js';
import { growsHereAt, resolveZone, el, commonName, categoryLabel, summerGreensAt, mark, displayName, scheduleClimate, nearerFoldRow, datesStationOf, datesCitation, stationFold, stationFrostLines, frostStationOf, frostWord, frostPossible, frostSomeWinters, frostRare, fmtKm, resolveSpecies, onWarmthPath, plural, monthDay, floorSay, warmthFloorFor, floorLine, warmthWindowsFor, rainsBeginFor, monthLong, seasonYearOf, fewestDays, whenWords, frostGate, monthRuns, runOccurrences, nextOpening, givenFrostGate, gateTenths, zoneSide, boltMonthsFor, resolveDtm, fmtMonthDay, needsInsects, cropFreeze, datedByDays, seasonDate, fallDate, warmthFloorClose, lineTemp, approxDays, plantingLabel, givenFirstFrost, $, remindChoice, setRemindChoice, app, num, resolvedField, sowByOf, addDaysISO, zipToLatLon, rememberLookupHemisphere, cropSearch, squareText, tellUsLine, markLink, plantLink, outsideUsTables, metricForVisit, teamClaim, glossTerm, plantHref, CHECK_SVG, fmtMonthDayYear, localTodayIso } from './core.js';
import { reasonLine, boltRun, monthsPhrase, strongestSupportRequirement, waterLines, seasonMonths } from './chunk-i55djf5h.js';
import { provFacts, climateProv } from './chunk-l9zpnf9a.js';
import { tasksToIcs, shareOrDownloadIcs } from './chunk-ezosgnab.js';
import { copy, fillCopy, midSentence, humanize, doorClaim, situationFromHash, stationDisplay, loadChunk, countRung, situations, containerCrops, quickCrops, headlineTeams, fillNodes, appLang, chunkReady } from './paint.js';
export { guildFromHash } from './paint.js';
import { teamsForPlant, forPots } from './chunk-k60vt8tj.js';
import { invasiveNote } from './chunk-e28r444y.js';
import { deviceCountry } from './addrrank.js';
import './chunk-l5cseoso.js';
import './chunk-h8sxf1mq.js';
import './chunk-dpsx67rd.js';

const SHELVES = ["fruiting_vegetable", "salad_green", "root", "bean_or_pea", "allium", "perennial_vegetable", "herb", "fruit",
    "flower", "cover_crop"];
const SHOWN = 8;
function foldChips(chips) {
    const all = [...chips.children];
    if (all.length <= SHOWN + 1)
        return;
    for (const c of all.slice(SHOWN))
        c.hidden = true;
    const more = el("button", "chip ans-chip gh-more", fillCopy("ghMore", { n: all.length - SHOWN }));
    more.type = "button";
    more.addEventListener("click", () => { for (const c of all)
        c.hidden = false; more.remove(); });
    chips.appendChild(more);
}
function chipFor(sid, bundle, pick, note) {
    const b = el("button", "chip ans-chip gh-chip", note ? `${commonName(bundle, sid)} ${note}` : commonName(bundle, sid));
    b.type = "button";
    b.dataset.sid = sid;
    b.addEventListener("click", () => pick(sid));
    return b;
}
function byReason(rows, bundle, pick, wanted, zoneLabel) {
    const groups = new Map();
    for (const row of rows) {
        for (const r of row.reasons) {
            if (!wanted(r))
                continue;
            const line = reasonLine(r, zoneLabel);
            const key = `${r.rule}|${line}`;
            const g = groups.get(key) ?? { rule: r.rule, line, plants: [] };
            g.plants.push({ sid: row.species, note: r.kind === "season_short" ? fillCopy("ghDaysNote", { days: r.days }) : undefined });
            groups.set(key, g);
        }
    }
    return [...groups.values()].sort((a, b) => b.plants.length - a.plants.length || (a.line < b.line ? -1 : 1)).map((g) => {
        const box = el("div", "gh-reason");
        box.dataset.rule = g.rule;
        const p = el("p", "gh-why", g.line);
        mark(p, { kind: "rule", id: g.rule });
        box.appendChild(p);
        const chips = el("div", "ans-chips gh-chips");
        for (const x of g.plants.sort((a, b) => commonName(bundle, a.sid).localeCompare(commonName(bundle, b.sid))))
            chips.appendChild(chipFor(x.sid, bundle, pick, x.note));
        foldChips(chips);
        box.appendChild(chips);
        return box;
    });
}
function ensureGrowsCss() {
    if (document.getElementById("growshere-css"))
        return;
    const link = document.createElement("link");
    link.id = "growshere-css";
    link.rel = "stylesheet";
    link.href = "./growshere.css";
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
function renderGrowsHere(host, bundle, lat, lon, country, pick) {
    const rows = growsHereAt(lat, lon, bundle, country);
    const zl = resolveZone(lat, lon, bundle, country)?.label;
    const zoneLabel = typeof zl === "string" ? zl.replace(/^zone\s*/i, "") : null;
    ensureGrowsCss();
    host.replaceChildren();
    if (!rows.length) {
        host.hidden = true;
        return;
    }
    host.hidden = false;
    const fits = rows.filter((r) => r.verdict === "fits");
    const care = rows.filter((r) => r.verdict === "care");
    const not = rows.filter((r) => r.verdict === "not");
    host.appendChild(el("p", "ans-k", copy.ghHead));
    const noRecord = !fits.length && rows.some((r) => r.reasons.some((x) => x.kind === "season_unknown"));
    host.appendChild(el("p", "gh-lead", noRecord ? fillCopy("ghLeadNoRecord", { total: bundle.species.length })
        : fillCopy(care.length ? "ghLeadCare" : "ghLead", { fits: fits.length, care: care.length, total: bundle.species.length })));
    const cat = (sid) => String(bundle.species.find((s) => s.id === sid)?.category ?? "");
    const shelves = el("div", "gh-shelves");
    const order = [...SHELVES, ...new Set(fits.map((r) => cat(r.species)).filter((c) => !SHELVES.includes(c)))];
    for (const c of order) {
        const on = fits.filter((r) => cat(r.species) === c).sort((a, b) => commonName(bundle, a.species).localeCompare(commonName(bundle, b.species)));
        if (!on.length)
            continue;
        const shelf = el("div", "gh-shelf");
        shelf.dataset.category = c;
        shelf.appendChild(el("p", "gh-shelf-k", categoryLabel(c)));
        const chips = el("div", "ans-chips gh-chips");
        for (const r of on)
            chips.appendChild(chipFor(r.species, bundle, pick));
        foldChips(chips);
        shelf.appendChild(chips);
        shelves.appendChild(shelf);
    }
    if (fits.length) {
        const sec = el("section", "gh-sec gh-fits");
        sec.appendChild(el("p", "gh-sec-k", copy.ghFits));
        sec.appendChild(shelves);
        host.appendChild(sec);
    }
    if (care.length) {
        const sec = el("section", "gh-sec gh-care");
        sec.appendChild(el("p", "gh-sec-k", copy.ghCare));
        for (const g of byReason(care, bundle, pick, () => true, zoneLabel))
            sec.appendChild(g);
        const greens = summerGreensAt(lat, lon, bundle, country);
        const boltBox = sec.querySelector('.gh-reason[data-rule="R-172"]');
        if (greens && boltBox) {
            const box = el("div", "gh-greens");
            box.dataset.rule = greens.rule;
            const p = el("p", "gh-why", copy.ghGreens);
            mark(p, { kind: "rule", id: greens.rule });
            box.appendChild(p);
            const chips = el("div", "ans-chips gh-chips");
            for (const sid of greens.species)
                chips.appendChild(chipFor(sid, bundle, pick));
            box.appendChild(chips);
            boltBox.appendChild(box);
        }
        host.appendChild(sec);
    }
    if (not.length) {
        const d = el("details", "gh-sec gh-not");
        d.appendChild(el("summary", "", fillCopy("ghNot", { n: not.length })));
        for (const g of byReason(not, bundle, pick, (r) => r.kind === "season_short" || r.kind === "zone_cold" || r.kind === "warm_short", zoneLabel))
            d.appendChild(g);
        host.appendChild(d);
    }
}

function zoneLabelAt(lat, lon, bundle, country) {
    const zone = resolveZone(lat, lon, bundle, country);
    return zone?.label ?? (zone?.zone != null ? String(zone.zone) : null);
}
function climateAnswer(lat, lon, bundle, country) {
    const clim = scheduleClimate(lat, lon, bundle, country);
    if (!clim)
        return null;
    const zone = resolveZone(lat, lon, bundle, country);
    const site = clim.site;
    const hard = site.hardiness;
    return {
        lastP50: site.last_frost_32f?.p50 ?? null,
        lastP10: site.last_frost_32f?.p10 ?? null,
        firstFreeze: site.first_freeze_32f_p50 ?? null,
        seasonDays: site.growing_season_days_p50 ?? null,
        warm: frostRare(site),
        some: frostSomeWinters(site) != null,
        frostYears: typeof site.frost_years === "number" ? site.frost_years : null,
        years: typeof site.years === "number" ? site.years : null,
        zoneLabel: zone?.label ?? (zone?.zone != null ? String(zone.zone) : null)
            ?? hard?.label ?? (hard?.zone != null ? String(hard.zone) : null),
        caveat: clim.caveat,
        ...provFacts(clim),
        frostPossible: frostPossible(site) !== false,
        word: frostWord(site),
        station: frostStationOf(site),
        stationLines: stationFrostLines(site, false),
        square: (clim.model !== undefined ? clim.model?.square : clim.square) ?? null,
        fold: datesStationOf(site) ? stationFold(site, "anDatesFoldRest", "anFoldCountRest") : [],
        citation: datesStationOf(site) ? datesCitation(bundle) : null,
        nearer: nearerFoldRow(site, true),
    };
}
function climateCardFrost(a) {
    const st = a.station;
    const big = !a.rare ? null : a.word === "most" ? copy.anFrostMostBig : a.word === "some" || a.some ? copy.anFrostSomeBig : copy.anFrostRareBig;
    const frost = st
        ? fillCopy(st.frost_winters > 0 ? "anFrostStationV" : "anFrostStationNoneV", { n: st.frost_winters, years: st.winters, station: stationDisplay(st.name), dist: fmtKm(st.km) })
        : a.rare && a.years != null && a.frostYears != null
            ? (a.frostYears > 0 ? fillCopy("anFrostOddsV", { n: a.frostYears, years: a.years }) : fillCopy("anFrostNoneV", { years: a.years }))
            : null;
    const warn = !a.modeled || a.given || !a.frostPossible ? null
        : a.stationLines.length ? a.stationLines.join(" ")
            : a.rare ? (a.some ? copy.anModelWarnSome : copy.anModelWarnRare) : copy.anModelWarn;
    return { big, frost, warn };
}
function datesFold(a) {
    const more = document.createElement("details");
    more.className = "cc-more disclosure ans-how";
    const sum = document.createElement("summary");
    sum.textContent = copy.plHowWeKnowRare;
    const body = document.createElement("div");
    body.className = "cc-mbody";
    const paras = [...a.fold.slice(0, 1), ...(a.citation ? [{ lead: copy.fsCiteLead, rest: ` - ${a.citation}` }] : []),
        ...(a.nearer ? [a.nearer] : []), ...a.fold.slice(1)];
    for (const { lead, rest } of paras) {
        const p = document.createElement("p");
        const s = document.createElement("strong");
        s.textContent = lead;
        p.append(s, document.createTextNode(rest));
        body.append(p);
    }
    more.append(sum, body);
    return more;
}
function nextOccurrence(mmdd, todayIso) {
    const year = Number(todayIso.slice(0, 4));
    const thisYear = `${year}-${mmdd}`;
    return thisYear >= todayIso ? thisYear : `${year + 1}-${mmdd}`;
}
const mmddShiftAround = (mmdd, days) => {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(2001, mm - 1, dd + days);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mmddShift = (mmdd, days) => {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(2001, mm - 1, dd + days);
    if (d.getFullYear() !== 2001)
        return null;
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mmddDays = (a, b) => {
    const at = (s) => { const [m, d] = s.split("-").map(Number); return new Date(2001, (m || 1) - 1, d || 1).getTime(); };
    return Math.round((at(b) - at(a)) / 86400000);
};
const SUPPORT_NOTE = {
    strong: "anSupportStrong", optional_strong: "anSupportOptional", moderate: "anSupportModerate", weak: "anSupportWeak",
};
function sowableByDays(bundle) {
    const out = [];
    for (const s of bundle.species) {
        const id = String(s.id);
        if (s.scheduling_model === "dtm") {
            if (s.sow_season !== "fall")
                out.push({ id, group: null, sp: s });
            continue;
        }
        for (const g of s.cultivar_groups ?? []) {
            const gid = String(g.id);
            if (resolvedField(s, gid, "scheduling_model") === "dtm" && resolvedField(s, gid, "sow_season") !== "fall")
                out.push({ id, group: gid, sp: s });
        }
    }
    return out;
}
function cropAnswer(sid, lat, lon, todayIso, bundle, country) {
    if (!bundle.species.some((s) => s.id === sid))
        return null;
    const site = scheduleClimate(lat, lon, bundle, country)?.site ?? null;
    const sp = resolveSpecies(sid, null, bundle);
    const label = commonName(bundle, sid) || humanize(sid);
    const p50 = site?.last_frost_32f?.p50 ?? null;
    const p10 = site?.last_frost_32f?.p10 ?? null;
    const ff = site?.first_freeze_32f_p50 ?? null;
    const rows = [];
    const tasks = [];
    if (!site)
        rows.push({ key: "no-dates", label: "", date: null, note: fillCopy("anNoDatesCrop", { crop: label }) });
    const warm = onWarmthPath(site);
    const dated = (key, rowLabel, mmdd, kind, text) => {
        const date = nextOccurrence(mmdd, todayIso);
        rows.push({ key, label: rowLabel, date, note: null });
        tasks.push({ date, kind, species: sid, text, cat: kind === "start_indoors" ? "sow" : "plant" });
    };
    const tol = sp.frost_tolerance;
    const model = sp.scheduling_model;
    const fallSown = sp.sow_season === "fall";
    const wk = typeof sp.start_indoors_weeks === "number" && sp.start_indoors_weeks > 0 ? sp.start_indoors_weeks : null;
    let setOutMmdd = null;
    let setOutLeadDays = null;
    const indoorRow = () => {
        if (!(wk && p50 && !warm))
            return;
        const setOutIso = nextOccurrence(setOutMmdd ?? p50, todayIso);
        let y = Number(setOutIso.slice(0, 4));
        if (`${y}-${p50}` > setOutIso)
            y -= 1;
        const d = new Date(Date.UTC(y, Number(p50.slice(0, 2)) - 1, Number(p50.slice(3, 5)) - wk * 7));
        const indoorIso = d.toISOString().slice(0, 10);
        const passed = indoorIso < todayIso;
        rows.unshift({ key: "indoors", label: copy.anIndoorsL, date: indoorIso, note: passed ? fillCopy("anIndoorsPassed", { crop: midSentence(label) }) : null });
        tasks.push({ date: passed ? todayIso : indoorIso, kind: "start_indoors", species: sid, text: fillCopy("anIndoorsT", { crop: label, n: wk }), cat: "sow" });
    };
    const r171 = bundle.rules.find((r) => r.id === "R-171");
    const warmWait = tol === "very_tender" ? Number(r171?.offset_days_after_last_frost) || 0 : 0;
    const warmWeeks = Math.round(warmWait / 7);
    if (!fallSown && p50 && !warm) {
        const late = warmWait > 0 ? mmddShift(p50, warmWait) : null;
        if (late) {
            const d = p10 && mmddDays(late, p10) > 0 ? p10 : late;
            dated("setout-warm", copy.anWarmL, d, "warm_set_out", plural("anWarmT", warmWeeks, { crop: label }));
            setOutMmdd = d;
        }
        else if (tol === "tender" || tol === "very_tender" || tol == null) {
            if (p10) {
                dated("setout-safe", copy.anSafeL, p10, "plant_after_last_frost", fillCopy("anSafeT", { crop: label }));
                rows.push({ key: "setout-median", label: copy.anLuckyL, date: nextOccurrence(p50, todayIso), note: null });
                setOutMmdd = p10;
            }
            else {
                dated("setout-median", copy.anMedianL, p50, "plant_after_last_frost", fillCopy("anMedianT", { crop: label }));
                setOutMmdd = p50;
            }
        }
        else {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const offs = (r096?.offset_days_before_last_frost ?? null);
            const off = tol === "hardy" ? offs?.hardy : offs?.half_hardy;
            if (off && off > 0 && model === "dtm") {
                const d = mmddShift(p50, -off) ?? mmddShiftAround(p50, -off);
                const weeks = Math.round(off / 7);
                const hardiness = tol === "hardy" ? copy.clColdHardy : copy.clHalfHardy;
                if (d) {
                    dated("cool-sow", fillCopy("anCoolL", { hardiness }), d, "cool_season", fillCopy(weeks === 1 ? "anCoolTOne" : "anCoolTMany", { crop: label, hardiness, n: weeks }));
                    setOutMmdd = d;
                    setOutLeadDays = off;
                }
            }
            else if (model === "dtm") {
                dated("setout-median", copy.anPlantMedianL, p50, "plant_after_last_frost", fillCopy("anPlantMedianT", { crop: label }));
                setOutMmdd = p50;
            }
        }
    }
    indoorRow();
    const ruleCrops = (id) => [].concat(bundle.rules.find((r) => r.id === id)?.applies_to?.species ?? []);
    if (fallSown && !warm) {
        const lead = sp.fall_sow_days_before_frost;
        const cover = ff && ruleCrops("R-170").includes(sid) && Array.isArray(lead) && lead.length === 2
            ? { lo: Number(lead[0]), hi: Number(lead[1]) } : null;
        const from = cover && ff ? mmddShift(ff, -cover.hi) : null;
        const to = cover && ff ? mmddShift(ff, -cover.lo) : null;
        if (cover && ff && from && to) {
            const toIso = nextOccurrence(to, todayIso);
            const fromIso = `${toIso.slice(0, 4)}-${from}`;
            const wks = (d) => Math.round(d / 7);
            rows.push({ key: "fall-cover", label: copy.anCoverFromL, date: fromIso, note: null });
            rows.push({ key: "fall-cover-by", label: copy.anCoverByL, date: toIso, note: null });
            tasks.push({ date: fromIso, kind: "autumn", species: sid, cat: "sow",
                text: fillCopy("clCoverSow", { crop: label, from: monthDay(from), to: monthDay(to), lo: wks(cover.lo), hi: wks(cover.hi), freeze: monthDay(ff) }) });
        }
        else if (ff && ruleCrops("R-122").includes(sid)) {
            rows.push({ key: "fall-sown", label: "", date: null,
                note: fillCopy("clGarlic", { crop: label, date: monthDay(ff) }) });
        }
        else {
            rows.push({ key: "fall-sown", label: "", date: null,
                note: fillCopy("anFallSown", { crop: label }) });
        }
    }
    else if (site && p50 && !warm && !rows.some((r) => r.date)) {
        rows.push({ key: "no-plant-date", label: "", date: null,
            note: fillCopy(model === "perennial" ? "anPerennialNoDate" : "anNoPlantDate", { crop: label }) });
    }
    if (site && !warm && !fallSown) {
        const say = floorSay(warmthFloorFor(site, sid, bundle));
        if (say)
            rows.push({ key: "warm-floor", label: "", date: null, note: floorLine(say, [label]) });
    }
    if (warm && site) {
        const w = warmthWindowsFor(site, lat, [sid], bundle)[sid];
        if (site.temps === "months_only")
            rows.push({ key: "warm-none", label: "", date: null, note: copy.anWarmHeld });
        else if (!w && ruleCrops("R-187").includes(sid) && rainsBeginFor(site, bundle)) {
            const month = rainsBeginFor(site, bundle).month;
            if (month) {
                const mm = String(month).padStart(2, "0");
                const date = todayIso.slice(5, 7) === mm ? todayIso : nextOccurrence(`${mm}-01`, todayIso);
                rows.push({ key: "rains-plant", label: copy.anRainsL, date, note: null });
                rows.push({ key: "rains-note", label: "", date: null, note: fillCopy("anRainsNote", { crop: midSentence(label) }) });
                tasks.push({ date, kind: "warm_window", species: sid, cat: "plant", rule: "R-187",
                    text: fillCopy("clRainsPlant", { crop: label, month: monthLong(month - 1) }), tip: copy.clRainsTip });
            }
            else
                rows.push({ key: "rains-any", label: "", date: null, note: fillCopy("anRainsAny", { crop: midSentence(label) }) });
        }
        else if (!w)
            rows.push({ key: "warm-none", label: "", date: null, note: fillCopy("anWarmNoLimit", { crop: midSentence(label) }) });
        else if (!w.months.length)
            rows.push({ key: "warm-none", label: "", date: null, note: fillCopy("anWarmNone", { crop: midSentence(label) }) });
        else {
            const sy = seasonYearOf(todayIso, lat);
            const days = fewestDays(sp.days_to_maturity);
            const before = w.before ?? null;
            const when = whenWords(w.months, { days, after: w.after, year: sy, lat, before });
            const sow = when ? fillCopy("clWarmSow", { crop: label, when }) : fillCopy("clWarmSowAll", { crop: label });
            const gate = frostGate(site);
            const occs = monthRuns(w.months).flatMap((r) => [sy, sy + 1].flatMap((y) => runOccurrences(r, y, lat, w.after)
                .map((o) => {
                const by = (b) => (r.len === 12 || days == null ? o.end : sowByOf(o, days, b)), end = by(before);
                return { start: o.start, end, all: r.len === 12, next: nextOpening(w.months, r.to) ?? r.from, frost: end !== by(null) };
            })))
                .sort((a, b) => a.start.localeCompare(b.start));
            rows.push({ key: "warm-window", label: "", date: null, note: sow
                    + (w.care ? ` ${fillCopy("clWarmCare", { crop: label })}` : "")
                    + (w.after && gate ? ` ${givenFrostGate(site) ? fillCopy("clWarmAfterGiven", { date: monthDay(w.after) })
                        : plural("clWarmAfter", gateTenths(gate.pct), { date: monthDay(w.after) })}` : "")
                    + (before && occs.some((o) => o.frost) ? ` ${fillCopy("clWarmBeforeGiven", { date: monthDay(before) })}` : "") });
            const now = occs.find((o) => o.start <= todayIso && todayIso <= o.end);
            const next = occs.find((o) => o.start > todayIso);
            if (now) {
                if (!now.all)
                    rows.push({ key: "warm-open", label: copy.anWarmOpenL, date: now.end, note: null });
                rows.push({ key: "warm-now", label: "", date: null, note: fillCopy("anWarmNow", { crop: label }) });
                tasks.push({ date: todayIso, kind: "warm_window", species: sid, cat: "sow", text: sow, closeBy: now.end, ...(now.all ? {} : { warmNext: now.next }) });
            }
            else if (next) {
                rows.push({ key: "warm-next", label: copy.anWarmNextL, date: next.start, note: null });
                tasks.push({ date: next.start, kind: "warm_window", species: sid, cat: "sow", text: sow, closeBy: next.end, warmNext: next.next });
            }
        }
    }
    const zr = sp.hardiness_zone;
    if (Array.isArray(zr) && typeof zr[0] === "number" && typeof zr[1] === "number") {
        const zone = resolveZone(lat, lon, bundle, country);
        const zn = zone && typeof zone.zone === "number" ? zone.zone : null;
        const zl = zone?.label ?? (zn != null ? String(zn) : null);
        const conf = (sp.confidence ?? {});
        const est = (conf.estimated ?? []).includes("hardiness_zone") ? ` ${copy.anZoneEstimate}` : "";
        if (zn != null) {
            const side = zoneSide(zr, zn);
            rows.push({ key: "zone", label: "", date: null,
                note: fillCopy(side === "in" ? "anZoneIn" : side === "above" ? "anZoneWarm" : "anZoneOut", { lo: zr[0], hi: zr[1], zone: String(zl), estimate: est }) });
        }
        else {
            rows.push({ key: "zone-none", label: "", date: null, note: fillCopy("anZoneNone", { crop: label, lo: zr[0], hi: zr[1] }) });
        }
    }
    const night = site?.summer_night_tmin_c ?? null;
    const nightMax = typeof sp.night_temp_max_c === "number" ? sp.night_temp_max_c : null;
    if (night != null && nightMax != null && night > nightMax) {
        rows.push({ key: "heat", label: "", date: null,
            note: fillCopy("anHeat", { crop: midSentence(label) }) });
    }
    const bolt = boltMonthsFor(site, lat, [sid], bundle)[sid] ?? null;
    if (bolt) {
        const days = resolveDtm(sp, null)?.[0] ?? null;
        const run = boltRun(bolt);
        const md = (m) => {
            const d = new Date(Date.UTC(2001, m - 1, 1 - (days ?? 0)));
            return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        };
        const fallMd = days && run ? md(run[1] === 12 ? 1 : run[1] + 1) : null;
        rows.push({ key: "bolt", label: "", date: null, note: days && run && fallMd && !warm
                ? fillCopy("anBolt", { name: label, months: monthsPhrase(bolt), spring: fmtMonthDay(md(run[0])), fall: fmtMonthDay(fallMd) })
                : fillCopy("plBoltMonths", { name: label, months: monthsPhrase(bolt) }) });
        if (fallMd && !warm) {
            const fallIso = nextOccurrence(fallMd, todayIso);
            const lead = rows.findIndex((r) => r.date && r.key !== "freeze");
            if (lead >= 0 && fallIso < rows[lead].date) {
                rows.splice(lead, 0, { key: "bolt-fall", label: copy.anBoltFallL, date: fallIso, note: null });
                tasks.push({ date: fallIso, kind: "autumn", species: sid, cat: "sow", text: fillCopy("anBoltFallT", { crop: label }) });
            }
        }
    }
    if (needsInsects(sp)) {
        rows.push({ key: "insect-vector", label: "", date: null,
            note: fillCopy("anInsect", { crop: label }) });
    }
    {
        const strongest = strongestSupportRequirement(sp);
        const key = SUPPORT_NOTE[strongest];
        if (key) {
            const varies = strongest !== String(sp.support?.requires ?? "none");
            rows.push({ key: "support", label: "", date: null,
                note: `${fillCopy(key, { crop: label })}${varies ? ` ${copy.anSupportVaries}` : ""}` });
        }
    }
    if (ff && !warm) {
        const plantedIso = setOutMmdd ? nextOccurrence(setOutMmdd, todayIso) : null;
        const endIso = plantedIso && nextOccurrence(ff, todayIso) < plantedIso ? nextOccurrence(ff, plantedIso) : nextOccurrence(ff, todayIso);
        rows.push({ key: "freeze", label: copy.anFreezeL, date: endIso, note: null });
        tasks.push({ date: endIso, kind: "log_first_freeze", species: null, cat: "frost",
            text: copy.anFreezeT });
    }
    if (site) {
        const lines = waterLines(site, bundle, seasonMonths(site.last_frost_32f?.p50, ff, frostRare(site)));
        if (lines.hot)
            rows.push({ key: "water-hot", label: "", date: null, note: lines.hot });
        if (lines.dry)
            rows.push({ key: "water-dry", label: "", date: null, note: lines.dry });
    }
    const own = site && ff ? cropFreeze(site, sid, bundle) : null;
    const lensFf = own?.mmdd ?? null;
    const hard = !!own && own.line_f < 32 ? "Hard" : "";
    const open = !!own && !own.mmdd && !own.counted && own.line_f < 32;
    if (!fallSown && datedByDays(sp, null) && setOutMmdd && ff && (lensFf || open)) {
        let sy = seasonYearOf(todayIso, lat);
        const leadIso = (y) => (setOutLeadDays && p50 ? addDaysISO(seasonDate(p50, y, lat), -setOutLeadDays) : null);
        const nextLead = leadIso(sy + 1);
        if (nextLead && nextLead <= todayIso)
            sy += 1;
        const windowPassed = (leadIso(sy) ?? seasonDate(setOutMmdd, sy, lat)) < todayIso;
        const freezeThisYear = lensFf ? fallDate(lensFf, sy, lat) : null;
        const seasonRunning = !freezeThisYear || todayIso <= freezeThisYear;
        const daysTo = (aIso, bIso) => {
            const p = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))).getTime();
            return Math.round((p(bIso) - p(aIso)) / 86400000);
        };
        if (windowPassed && seasonRunning) {
            const daysLeft = freezeThisYear ? daysTo(todayIso, freezeThisYear) : Infinity;
            const dtm = resolveDtm(sp, null);
            const MARGIN = 7;
            const readyMonth = (days) => new Date(Date.UTC(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)) + days)).getUTCMonth() + 1;
            if (dtm && dtm[0] + MARGIN <= daysLeft && bolt?.includes(readyMonth(dtm[0]))) {
                rows.push({ key: "still-fits-hot", label: "", date: null,
                    note: fillCopy(`anStillHot${hard}`, { crop: label, month: monthLong(readyMonth(dtm[0]) - 1) }) });
            }
            else if (dtm && dtm[0] + MARGIN <= daysLeft) {
                const how = wk ? copy.anHowStarted : copy.anHowSown;
                const fits = open ? "Open" : hard;
                const warmDay = warmthFloorClose(site, sid, bundle, sy, lat);
                const cool = warmDay && warmDay.last <= todayIso ? ` ${fillCopy(wk ? "anStillWarmCoolPlant" : "anStillWarmCoolSow", { crop: midSentence(label) })}` : "";
                rows.push({ key: "still-fits", label: "", date: null,
                    note: fillCopy(`anStillFits${fits}`, { crop: label, left: daysLeft, days: dtm[0], how, temp: lineTemp(own.line_f) })
                        + (approxDays(sp, null) ? ` ${fillCopy("clApproxWarmth", { crop: label })}` : "") + cool });
                tasks.push({ date: todayIso, kind: "cool_season", species: sid, cat: "sow",
                    text: fillCopy(`${wk ? "anStillFitsPlantT" : "anStillFitsSowT"}${fits}`, { crop: label, days: dtm[0], freeze: lensFf ? monthDay(lensFf) : "" }) });
            }
            else if (dtm) {
                const leftFor = (id, group) => {
                    const f = cropFreeze(site, group ? `${id}/${group}` : id, bundle);
                    return f.mmdd ? daysTo(todayIso, fallDate(f.mmdd, sy, lat)) : f.counted ? null : Infinity;
                };
                const fits = sowableByDays(bundle)
                    .filter((c) => c.id !== sid)
                    .map((c) => ({ ...c, dtm: resolveDtm(c.sp, c.group), left: leftFor(c.id, c.group) }))
                    .filter((x) => !!x.dtm && x.left !== null && x.dtm[0] + MARGIN <= x.left
                    && !(boltMonthsFor(site, lat, [x.id], bundle)[x.id] ?? []).includes(readyMonth(x.dtm[0])))
                    .sort((a, b) => a.dtm[0] - b.dtm[0])
                    .slice(0, 4);
                const alts = fits.map((f) => (f.group ? plantingLabel(bundle, f.id, f.group) : commonName(bundle, f.id)) || humanize(f.id)).join(", ");
                rows.push({ key: "still-fits-no", label: "", date: null,
                    note: `${fillCopy(`anStillNo${hard}`, { crop: label, days: dtm[0], left: daysLeft })} ${alts ? fillCopy("anStillToday", { crops: alts }) : copy.anSeasonPast}` });
            }
        }
    }
    {
        const est = (sp.confidence ?? {}).estimated ?? [];
        const isEst = (f) => est.some((e) => e === f || e.endsWith(`.${f}`));
        if (isEst("frost_tolerance") && rows.some((r) => ["setout-safe", "setout-median", "setout-warm", "cool-sow"].includes(r.key)))
            rows.push({ key: "estimate-tol", label: "", date: null, note: fillCopy("anTolEstimate", { crop: label }) });
        if (isEst("month_mean_temp_c") && rows.some((r) => r.key === "warm-window"))
            rows.push({ key: "estimate-warm", label: "", date: null, note: fillCopy("anWarmEstimate", { crop: label }) });
        if (isEst("days_to_maturity") && rows.some((r) => r.key === "still-fits" || r.key === "still-fits-no" || r.key === "still-fits-hot"))
            rows.push({ key: "estimate-dtm", label: "", date: null, note: fillCopy("anDtmEstimate", { crop: label }) });
    }
    const hasFrostDates = !!(site?.last_frost_32f?.p50 || site?.first_freeze_32f_p50);
    const fy = site?.frost_years, fyears = site?.years;
    const some = frostSomeWinters(site);
    const counted = typeof fy === "number" && fy > 0 && typeof fyears === "number";
    const word = frostWord(site), rec = !!frostStationOf(site);
    const gateDate = some ?? (site ? frostGate(site)?.date ?? null : null);
    const given = givenFrostGate(site), first = givenFirstFrost(site);
    if (site && frostRare(site) && !given && !first)
        rows.push({ key: "frost-rare", label: "", date: null,
            note: word === "most" ? (gateDate && counted ? fillCopy("anFrostMost", { n: fy, years: fyears, date: fmtMonthDay(gateDate) }) : copy.anFrostMostNoDate)
                : word === "some" && !some ? copy.anFrostSomeNoDate
                    : some ? (counted ? fillCopy(rec ? "anFrostSomeRec" : "anFrostSome", { n: fy, years: fyears, date: fmtMonthDay(some) }) : fillCopy("anFrostSomeNoCount", { date: fmtMonthDay(some) }))
                        : warm && counted ? fillCopy(rec ? "anFrostOddsRec" : "anFrostOdds", { n: fy, years: fyears })
                            : warm || !hasFrostDates ? copy.anFrostRareNoDates : copy.anFrostRare });
    if (!site)
        return { species: sid, rows, tasks, explain: "" };
    const warmWhy = given ? fillCopy("clWarmWhyGiven", { crop: label, date: fmtMonthDay(given) })
        : first ? fillCopy("clWarmWhyFirstGiven", { crop: label, date: fmtMonthDay(first) })
            : word === "most" ? (gateDate ? fillCopy("clWarmWhyMost", { crop: label, date: fmtMonthDay(gateDate) }) : fillCopy("clWarmWhyMostNoDate", { crop: label }))
                : some ? fillCopy("clWarmWhySome", { crop: label, date: fmtMonthDay(some) })
                    : word === "some" ? fillCopy("clWarmWhySomeNoDate", { crop: label }) : fillCopy("clWarmWhy", { crop: label });
    if (warm)
        return { species: sid, rows, tasks, explain: rows.some((r) => r.key === "warm-window") ? warmWhy : copy.anDatesFromClimate };
    const bits = [];
    if (wk && rows.some((r) => r.key === "indoors"))
        bits.push(fillCopy("anWhyIndoor", { crop: label, n: wk }));
    if (warmWait > 0)
        bits.push(plural("anWhyVeryTender", warmWeeks));
    else if (tol === "tender" || tol === "very_tender" || tol == null)
        bits.push(copy.anWhyTender);
    if ((tol === "hardy" || tol === "half_hardy") && rows.some((r) => r.key === "cool-sow"))
        bits.push(copy.anWhyHardy);
    if (rows.some((r) => r.key === "fall-cover"))
        bits.push(copy.anWhyCover);
    return { species: sid, rows, tasks,
        explain: bits.length ? fillCopy("anWhy", { reasons: bits.join("; ") }) : copy.anDatesFromClimate };
}
function sowableNow(candidates, lat, lon, todayIso, bundle, max = 3) {
    const out = [];
    const weekOut = weekAfter(todayIso);
    for (const sid of candidates) {
        const a = cropAnswer(sid, lat, lon, todayIso, bundle);
        if (a && nowKind(a, todayIso, weekOut))
            out.push(sid);
        if (out.length >= max)
            break;
    }
    return out;
}
const weekAfter = (todayIso) => { const d = new Date(`${todayIso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); };
function nowKind(a, todayIso, weekOut) {
    if (a.rows.some((r) => r.key === "warm-now")
        || a.rows.some((r) => (r.key === "cool-sow" || r.key === "setout-safe" || r.key === "setout-median") && !!r.date && r.date >= todayIso && r.date <= weekOut))
        return "week";
    return a.rows.some((r) => r.key === "still-fits") ? "finish" : null;
}
function plantNow(candidates, lat, lon, todayIso, bundle, country) {
    const out = { week: [], finish: [] };
    const weekOut = weekAfter(todayIso);
    for (const sid of candidates) {
        const a = cropAnswer(sid, lat, lon, todayIso, bundle, country);
        const kind = a ? nowKind(a, todayIso, weekOut) : null;
        if (kind)
            out[kind].push(sid);
    }
    return out;
}
function cropTeams(sid, bundle) {
    const ids = new Set(teamsForPlant(sid, bundle));
    return bundle.guilds.filter((g) => ids.has(g.id));
}
function answersTrail(at, bundle) {
    const located = at.lat != null && at.lon != null && Number.isFinite(at.lat) && Number.isFinite(at.lon);
    const where = at.zip && /^\d{5}$/.test(at.zip) ? { zip: at.zip }
        : located ? { place: { lat: at.lat, lon: at.lon, place: at.place ?? "", ...(at.country ? { country: at.country } : {}) } } : {};
    const crop = at.crop && bundle.species.some((s) => s.id === at.crop) ? at.crop : null;
    const named = crop ? { crop, cropName: midSentence(commonName(bundle, crop) || humanize(crop)) } : {};
    const tipOf = (id) => {
        const b = typeof id === "string" ? bundle.beliefs.find((x) => x.id === id) : undefined;
        return b ? { id: String(b.id), q: String(b.belief ?? b.id) } : undefined;
    };
    const today = tipOf(doorClaim(at.day).id);
    if (situationFromHash(at.hash)?.id === "now")
        return located && at.climate ? { surface: "now", known: where, anchor: "situation" } : null;
    if (new URLSearchParams(at.hash.split("?")[1] ?? "").has("teams")) {
        const team = crop ? cropTeams(crop, bundle)[0] : undefined;
        const surfaced = team?.surfaces_beliefs?.[0];
        return { surface: "teams", anchor: "teams",
            known: { ...where, ...named, ...(team ? { team: team.id, teamName: displayName(team), tip: tipOf(surfaced) } : {}) } };
    }
    if (crop && located && at.dates) {
        return at.ics ? { surface: "when", known: { ...where, ...named }, anchor: "dates" }
            : { surface: "place", known: { ...where, ...named, tip: today }, anchor: "dates" };
    }
    if (!crop && located && at.climate)
        return { surface: "place", known: { ...where, tip: today }, anchor: "climate" };
    return null;
}
const STATE_KEY = "gg-answers";
const loadState = () => {
    try {
        return JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}");
    }
    catch {
        return {};
    }
};
const saveState = (s) => {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(s));
    }
    catch { }
    if (typeof s.lat === "number")
        rememberLookupHemisphere(s.lat);
};
const QUICK = ["solanum_lycopersicum", "capsicum_annuum", "allium_sativum", "cucurbita_pepo", "lactuca_sativa", "ocimum_basilicum"];
const fmtDate = (iso, todayIso) => iso.slice(0, 4) === todayIso.slice(0, 4) ? monthDay(iso.slice(5)) : fmtMonthDayYear(iso);
const glossFirstMedianIn = (host) => {
    const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        if (node.parentElement?.closest(".glossterm"))
            continue;
        const m = /\b(median|mediana)\b/i.exec(node.nodeValue ?? "");
        if (!m)
            continue;
        const word = node.splitText(m.index);
        word.splitText(m[0].length);
        word.parentNode?.replaceChild(glossTerm("median", word.nodeValue ?? "median"), word);
        return;
    }
};
function cropFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("crop");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}
function zipFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("zip");
    if (!raw)
        return null;
    const z = raw.trim();
    return /^\d{5}$/.test(z) ? z : null;
}
function cityLabel(c, es, k) {
    const city = k.cityName(c, es), country = k.countryName(c, es), near = k.nearName(c, es);
    if (near)
        return fillCopy("anCityNear", { city, country, near });
    return country && ` ${k.fold(city)} `.includes(` ${k.fold(country)} `) ? city : `${city}, ${country}`;
}
function placeLabel(c, list, es, k) {
    const own = k.fold(k.cityName(c, es));
    const shared = list.some((o) => o !== c && [k.cityName(o, es), o[9] ?? ""].some((n) => !!n && k.fold(n) === own));
    return shared ? cityLabel(c, es, k) : k.cityName(c, es);
}
function placeFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const p = new URLSearchParams(String(hash).slice(q + 1));
    const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec((p.get("at") ?? "").trim());
    if (!m)
        return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    const cc = (p.get("cc") ?? "").trim().toUpperCase();
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180
        ? { lat, lon, place: (p.get("place") ?? "").trim().slice(0, 80), ...(/^[A-Z]{2}$/.test(cc) ? { country: cc } : {}) } : null;
}
function queryFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = (new URLSearchParams(String(hash).slice(q + 1)).get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    return raw.length >= 2 ? raw : null;
}
function nameList(host, items) {
    items.forEach((it, i) => {
        if (i)
            host.appendChild(document.createTextNode(" · "));
        host.appendChild(plantLink(it.label, it.id));
    });
}
const SITUATION_GUIDE = {
    containers: { slug: "container-vegetable-gardening", label: copy.anGuideContainers },
    earlystart: { slug: "read-a-planting-calendar", label: copy.anGuideCalendar },
    midseason: { slug: "succession-planting", label: copy.anGuideSuccession },
    shade: { slug: "where-to-put-a-garden", label: copy.anGuideShade },
    clay: { slug: "build-a-raised-bed", label: copy.anGuideRaisedBed },
};
function initAnswers(bundle, hooks, arrivedByTap = false) {
    const state = loadState();
    const todayIso = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const zipEl = $("anszip");
    const hint = $("anszip-hint");
    const climCard = $("ansclimate");
    const chipsEl = $("anschips");
    const cropHint = $("anscrop-hint");
    const filterEl = $("anscropq");
    const filterList = $("anscroplist");
    const datesCard = $("ansdates");
    const icsRow = $("ansicsrow");
    const teamsCard = $("ansteams");
    const nextRow = $("ansnext");
    const planBtn = $("ansplan");
    const icsHome = () => { if (icsRow.previousElementSibling !== datesCard)
        datesCard.after(icsRow); };
    let teamsUntil = 0;
    const teamsHeld = () => teamsUntil > performance.now();
    const teamsBlock = () => (teamsCard.closest(".ans-block") ?? teamsCard);
    const holdTeams = () => {
        teamsUntil = performance.now() + 6000;
        const stop = () => { teamsUntil = 0; for (const e of ["wheel", "touchstart", "keydown", "mousedown"])
            removeEventListener(e, stop); };
        for (const e of ["wheel", "touchstart", "keydown", "mousedown"])
            addEventListener(e, stop, { passive: true });
    };
    const keepTeamsInView = (tries = 0) => {
        if (!teamsHeld())
            return;
        const block = teamsBlock();
        if (!block.offsetParent && tries < 40) {
            setTimeout(() => keepTeamsInView(tries + 1), 100);
            return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => revealFully(block)));
    };
    let trailQueued = false;
    const drawAnswersTrail = () => {
        trailQueued = false;
        const located = state.lat != null && state.lon != null;
        const t = answersTrail({ hash: location.hash, day: dayOfYearIso(localTodayIso()), crop: state.crop ?? null, zip: state.zip ?? null,
            lat: state.lat ?? null, lon: state.lon ?? null, place: state.place ?? null, country: state.country ?? null,
            climate: located && !!climateAnswer(state.lat, state.lon, bundle, state.country),
            dates: !datesCard.hidden, ics: !icsRow.hidden }, bundle);
        const takesIcs = t?.surface === "when";
        if (!takesIcs)
            icsHome();
        if (!t) {
            nextRow.hidden = true;
            return;
        }
        const anchor = t.anchor === "dates" ? (icsRow.hidden || takesIcs ? datesCard : icsRow)
            : t.anchor === "climate" ? climCard : t.anchor === "teams" ? teamsCard : document.getElementById("anssituation") ?? teamsCard;
        if (nextRow.previousElementSibling !== anchor)
            anchor.after(nextRow);
        const view = chunkReady("trail");
        if (!view) {
            nextRow.hidden = !(t.surface === "place" || t.surface === "now") || planBtn.parentElement !== nextRow;
            void loadChunk("trail").then(trailSoon, () => { });
            return;
        }
        nextRow.hidden = false;
        if (t.surface === "teams")
            keepTeamsInView();
        view.drawTrail(nextRow, t.surface, t.known, {
            adopt: { ansplan: planBtn, ...(takesIcs ? { ics: icsRow } : {}) },
            go: (s) => {
                if (s.id !== "plan" || !s.hash?.startsWith("#/plan"))
                    return false;
                hooks.plantWithLocation(state.lat ?? null, state.lon ?? null, state.zip ?? null, s.hash);
                return true;
            },
        });
    };
    const trailSoon = () => {
        if (trailQueued)
            return;
        trailQueued = true;
        queueMicrotask(drawAnswersTrail);
    };
    void loadChunk("trail").catch(() => { });
    const editing = { zip: false, crop: false };
    const setReceipt = (which, summary) => {
        const box = document.getElementById(`ans${which}-receipt`);
        const form = document.getElementById(`ans${which}-form`);
        if (!box || !form)
            return;
        const folded = !!summary && !editing[which];
        box.hidden = !folded;
        form.hidden = folded;
        if (!folded)
            return;
        box.replaceChildren();
        const tick = document.createElement("span");
        tick.className = "ans-r-tick";
        tick.innerHTML = CHECK_SVG;
        const t = document.createElement("span");
        t.className = "ans-r-t";
        t.textContent = summary;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ans-r-edit";
        btn.dataset.reopen = which;
        btn.textContent = copy.anChange;
        btn.addEventListener("click", () => {
            editing[which] = true;
            setReceipt(which, summary);
            if (which === "zip" && state.lat != null && state.lon != null)
                climCard.hidden = false;
            document.getElementById(which === "zip" ? "anszip" : "anscropq")?.focus();
        });
        box.append(tick, t, btn);
    };
    const MARGIN = 16;
    const readableBand = () => {
        const vv = window.visualViewport;
        let top = vv ? vv.offsetTop : 0;
        let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        for (const el of document.querySelectorAll("header.site nav, header.site")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden")
                continue;
            if (cs.position !== "fixed" && cs.position !== "sticky")
                continue;
            const r = el.getBoundingClientRect();
            if (r.height <= 0)
                continue;
            const mid = (top + bottom) / 2;
            if (r.top > mid)
                bottom = Math.min(bottom, r.top);
            else if (r.bottom < mid)
                top = Math.max(top, r.bottom);
        }
        return { top, bottom };
    };
    const overshoot = (el) => {
        const r = el.getBoundingClientRect();
        const band = readableBand();
        const room = band.bottom - band.top;
        if (r.height > room - MARGIN * 2)
            return r.top - band.top - MARGIN;
        if (r.bottom > band.bottom - MARGIN)
            return r.bottom - band.bottom + MARGIN;
        if (r.top < band.top + MARGIN)
            return r.top - band.top - MARGIN;
        return 0;
    };
    const revealFully = (el, tries = 0) => {
        if (el.hidden || !el.offsetParent)
            return;
        const delta = overshoot(el);
        if (Math.abs(delta) < 2)
            return;
        if (tries > 0 && Math.abs(delta) > 600)
            return;
        if (tries >= 3)
            return;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        window.scrollBy({ top: delta, behavior });
        const recheck = () => revealFully(el, tries + 1);
        if ("onscrollend" in window)
            window.addEventListener("scrollend", recheck, { once: true });
        else
            setTimeout(recheck, 320);
        window.visualViewport?.addEventListener("resize", recheck, { once: true });
    };
    const revealWhenSettled = (el) => {
        requestAnimationFrame(() => requestAnimationFrame(() => revealFully(el)));
    };
    const revealIfOffscreen = (el) => {
        if (el.hidden)
            return;
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.offsetParent !== null)
            return;
        revealFully(el);
    };
    const growsCard = $("ansgrows");
    const renderGrows = () => {
        if (state.lat == null || state.lon == null || !app.climateSettled?.(state.lat, state.lon)) {
            growsCard.hidden = true;
            return;
        }
        renderGrowsHere(growsCard, bundle, state.lat, state.lon, state.country, (sid) => { state.crop = sid; saveState(state); renderCrop(); });
    };
    const renderClimateCard = () => {
        renderGrows();
        if (situationFromHash(location.hash)?.id === "now")
            renderSituation();
        if (state.lat == null || state.lon == null) {
            climCard.hidden = true;
            renderCrop();
            return;
        }
        const a = climateAnswer(state.lat, state.lon, bundle, state.country);
        if (!a) {
            climCard.hidden = false;
            climCard.innerHTML = "";
            const p = document.createElement("p");
            p.className = "ans-noresolve";
            p.textContent = state.zip ? copy.anNoResolve : copy.anNoDatesHere;
            if (!state.zip) {
                const k = document.createElement("p");
                k.className = "ans-k";
                k.textContent = copy.anClimateKNear;
                climCard.append(k);
            }
            climCard.append(p);
            const zl = state.zip ? null : zoneLabelAt(state.lat, state.lon, bundle, state.country);
            if (zl) {
                const div = document.createElement("div");
                div.className = "ans-row";
                const l = document.createElement("span");
                l.textContent = copy.anZoneL;
                const v = document.createElement("span");
                v.textContent = zl;
                div.append(l, v);
                climCard.append(div);
                editing.zip = false;
                setReceipt("zip", fillCopy("anRcptZone", { where: copy.anLocatedWhere, zone: zl.replace(/^zone\s*/i, ""), date: "" }));
            }
            renderCrop();
            return;
        }
        countRung("rung-loc");
        climCard.hidden = false;
        climCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = state.zip ? fillCopy("anClimateK", { zip: state.zip }) : copy.anClimateKNear;
        climCard.append(h);
        const cf = climateCardFrost(a);
        if (a.rare || a.lastP50) {
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = cf.big ?? fillCopy(a.given ? "anLastFrostGivenBig" : "anLastFrostBig", { date: monthDay(a.lastP50) });
            climCard.append(big);
        }
        const mail = [h.textContent ?? "", climCard.querySelector(".ans-big")?.textContent ?? ""];
        const row = (label, value) => {
            const div = document.createElement("div");
            div.className = "ans-row";
            const l = document.createElement("span");
            l.textContent = label;
            const v = document.createElement("span");
            v.textContent = value;
            div.append(l, v);
            climCard.append(div);
            mail.push(`${label}: ${value}`);
        };
        if (a.rare) {
            if (cf.frost)
                row(copy.anFrostL, cf.frost);
            if (a.word !== "most")
                row(copy.anSeasonL, copy.plAllYear);
        }
        else {
            if (cf.frost)
                row(copy.anFrostL, cf.frost);
            if (a.lastP10)
                row(copy.anSafeBetL, fillCopy("anAfterDate", { date: monthDay(a.lastP10) }));
            if (a.firstFreeze)
                row(copy.anFirstFreezeL, monthDay(a.firstFreeze));
            if (a.seasonDays != null)
                row(copy.anSeasonL, a.warm ? copy.plAllYear : fillCopy("anSeasonV", { n: a.seasonDays }));
        }
        if (a.zoneLabel)
            row(copy.anZoneL, a.zoneLabel);
        editing.zip = false;
        const where = state.zip ?? state.place ?? copy.anLocatedWhere;
        const frostDate = a.lastP50 && !a.rare ? monthDay(a.lastP50) : "";
        setReceipt("zip", a.zoneLabel
            ? fillCopy(frostDate ? "anRcptZoneFrost" : "anRcptZone", { where, zone: a.zoneLabel.replace(/^zone\s*/i, ""), date: frostDate })
            : fillCopy(frostDate ? "anRcptLocatedFrost" : "anRcptLocated", { where, date: frostDate }));
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = climateProv(a);
        if (!state.zip && state.place)
            mail.splice(1, 0, state.place);
        mail.push(prov.textContent ?? "");
        mark(prov, { kind: "rule", id: "R-090" });
        climCard.append(prov);
        const sq = a.given || !a.modeled ? "" : squareText(a.square, a.distanceKm, !!a.datesStation, a.datesStation ? copy.wsqSdLead : "");
        if (sq) {
            const which = document.createElement("p");
            which.className = "ans-prov ans-square";
            which.textContent = sq;
            climCard.append(which);
        }
        if (cf.warn) {
            const warn = document.createElement("p");
            warn.className = "cc-warn";
            warn.textContent = cf.warn;
            climCard.append(warn);
        }
        if (a.datesStation && !a.given)
            climCard.append(datesFold(a));
        climCard.append(tellUsLine(mail));
        revealIfOffscreen(climCard);
        renderCrop();
    };
    const cropLabel = (sid) => commonName(bundle, sid) || humanize(sid);
    let sitRowBuilt = false;
    const renderSituationRow = () => {
        const box = document.getElementById("anssituations");
        const row = document.getElementById("anssitrow");
        if (!box || !row)
            return;
        if (!sitRowBuilt) {
            for (const sit of situations(new Date().getMonth() + 1)) {
                const a = document.createElement("a");
                a.className = "ans-sit";
                a.href = sit.href;
                a.dataset.situation = sit.id;
                const l = document.createElement("span");
                l.className = "ans-sit-l";
                l.textContent = sit.label;
                const w = document.createElement("span");
                w.className = "ans-sit-w";
                w.textContent = sit.why;
                a.append(l, w);
                row.append(a);
            }
            sitRowBuilt = true;
        }
        const given = !!state.zip || !!state.crop || location.hash.includes("teams");
        box.hidden = !given;
    };
    const renderNow = (host) => {
        const h = document.createElement("p");
        h.className = "ans-sit-h";
        h.textContent = copy.doorNowQ;
        const card = document.createElement("div");
        card.className = "ans-card";
        host.append(h, card);
        if (state.lat == null || state.lon == null) {
            const ask = document.createElement("p");
            ask.textContent = copy.anNowAsk;
            card.append(ask);
            return;
        }
        const clim = climateAnswer(state.lat, state.lon, bundle, state.country);
        if (!clim) {
            const none = document.createElement("p");
            none.textContent = copy.anNoDatesHere;
            card.append(none);
            return;
        }
        const crops = quickCrops(bundle.species, bundle.species.length).map((c) => c.id);
        const now = plantNow(crops, state.lat, state.lon, todayIso(), bundle, state.country);
        for (const [kicker, ids] of [[copy.anNowWeekK, now.week], [copy.anNowFinishK, now.finish]]) {
            if (!ids.length)
                continue;
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = kicker;
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, ids.map((id) => ({ id, label: cropLabel(id) })));
            card.append(k, big);
        }
        if (!now.week.length && !now.finish.length) {
            const none = document.createElement("p");
            none.textContent = copy.anNowNone;
            card.append(none);
        }
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = copy.anNowProv;
        mark(prov, { kind: "rule", id: clim.warm ? "R-183" : "R-032" });
        card.append(prov);
        revealIfOffscreen(host);
    };
    const sitRowHost = document.getElementById("anssituations");
    const whereBlock = document.getElementById("ansclimate")?.closest(".ans-block") ?? null;
    const renderSituation = (arriving = false) => {
        trailSoon();
        const host = document.getElementById("anssituation");
        if (!host)
            return;
        const sit = situationFromHash(location.hash);
        host.hidden = !sit;
        host.innerHTML = "";
        if (!sit)
            return;
        const after = sit.id === "now" ? whereBlock : sitRowHost;
        if (after && host.previousElementSibling !== after)
            after.after(host);
        if (sit.id === "now") {
            renderNow(host);
            return;
        }
        const h = document.createElement("p");
        h.className = "ans-sit-h";
        h.textContent = sit.label;
        host.append(h);
        const card = document.createElement("div");
        card.className = "ans-card";
        host.append(card);
        revealWhenSettled(host);
        if (!arriving) {
            host.classList.remove("ans-fresh");
            void host.offsetWidth;
            host.classList.add("ans-fresh");
        }
        if (sit.id === "containers") {
            const r098 = bundle.rules.find((r) => r.id === "R-098");
            const span = r098?.params?.container_max_span_cm ?? 75;
            const fits = containerCrops(bundle.species, span, bundle.species.length);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = fillCopy("anPotK", { span });
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, fits.map((f) => ({ id: f.id, label: cropLabel(f.id) })));
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = copy.anPotProv;
            mark(prov, { kind: "rule", id: "R-098" });
            card.append(k, big, prov);
            const potTeams = bundle.guilds.filter((g) => forPots(g));
            if (potTeams.length) {
                const t = document.createElement("p");
                t.className = "ans-more";
                t.append(document.createTextNode(`${copy.anPotTeams} `));
                potTeams.forEach((g, i) => {
                    if (i)
                        t.appendChild(document.createTextNode(" · "));
                    const a = document.createElement("a");
                    a.href = `#/plan?guild=${g.id}`;
                    a.textContent = displayName(g);
                    markLink(a, { kind: "team", id: g.id });
                    t.appendChild(a);
                });
                card.append(t);
            }
        }
        else if (sit.id === "midseason") {
            const quick = quickCrops(bundle.species, 10);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = copy.anFastK;
            const big = document.createElement("p");
            big.className = "ans-big";
            quick.forEach((c, i) => {
                if (i)
                    big.appendChild(document.createTextNode(" · "));
                big.appendChild(plantLink(cropLabel(c.id), c.id));
                big.appendChild(document.createTextNode(` ${fillCopy("anFastDays", { n: c.days })}`));
            });
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = copy.anFastProv;
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = copy.anFastProv2;
            mark(prov2, { kind: "rule", id: "R-032" });
            card.append(k, big, prov, prov2);
        }
        else if (sit.id === "earlystart") {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const off = r096?.offset_days_before_last_frost ?? { hardy: 21, half_hardy: 14 };
            const hardy = bundle.species
                .filter((sp) => sp.frost_tolerance === "hardy" && String(sp.category ?? "") !== "cover_crop"
                && String(sp.category ?? "") !== "flower" && String(sp.lifespan ?? "") === "annual")
                .filter((sp) => !!sp.common?.[0])
                .map((sp) => ({ id: String(sp.id), label: cropLabel(String(sp.id)) }))
                .sort((a, b) => a.label.localeCompare(b.label));
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = fillCopy("anEarlyK", { n: off.hardy ?? 21 });
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, hardy);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = fillCopy("anEarlyProv", { hardy: off.hardy ?? 21, halfHardy: off.half_hardy ?? 14 });
            mark(prov, { kind: "rule", id: "R-096" });
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = copy.anEarlyProv2;
            mark(prov2, { kind: "rule", id: "R-031" });
            card.append(k, big, prov, prov2);
        }
        else if (sit.id === "shade") {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = copy.anShadeK;
            const shade = bundle.species
                .filter((sp) => sp.light_min === "shade" || sp.light_min === "part_sun")
                .filter((sp) => !!sp.common?.[0])
                .map((sp) => ({ id: String(sp.id), label: cropLabel(String(sp.id)) }))
                .sort((a, b) => a.label.localeCompare(b.label));
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, shade);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = copy.anShadeProv;
            mark(prov, { kind: "rule", id: "R-005" });
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = copy.anShadeProv2;
            mark(prov2, { kind: "rule", id: "R-004" });
            card.append(k, big, prov, prov2);
        }
        else {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = copy.anClayK;
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = copy.anClayBig;
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = copy.anClayProv;
            mark(prov, { kind: "rule", id: "R-100" });
            const link = document.createElement("a");
            link.className = "ans-more";
            link.href = "#/why?belief=B-015";
            link.textContent = copy.anClayLink;
            markLink(link, { kind: "belief", id: "B-015" });
            card.append(k, big, prov, link);
        }
        const g = SITUATION_GUIDE[sit.id];
        if (g) {
            const gl = document.createElement("a");
            gl.className = "ans-more ans-guide";
            gl.href = `../guides/${g.slug}/`;
            gl.textContent = `${g.label}\u00a0›`;
            card.append(gl);
        }
    };
    const renderTeams = () => {
        teamsCard.hidden = false;
        teamsCard.innerHTML = "";
        if (!state.crop) {
            const h = document.createElement("p");
            h.className = "ans-k";
            h.textContent = copy.anTeamsK;
            teamsCard.append(h);
            const answer = headlineTeams(bundle.guilds, (g) => displayName(g));
            for (const t of answer.shown) {
                const row = document.createElement("p");
                row.className = "ans-team";
                const n = document.createElement("b");
                n.textContent = t.name;
                row.append(n);
                if (t.mechanism) {
                    const w = document.createElement("span");
                    w.textContent = ` - ${teamClaim(bundle.guilds.find((g) => g.id === t.id) ?? {}, t.mechanism)}`;
                    row.append(w);
                }
                teamsCard.append(row);
            }
            const prov0 = document.createElement("p");
            prov0.className = "ans-prov";
            fillNodes(prov0, fillCopy("anTeamsMore", { n: answer.more }), { teams: glossTerm("team", copy.anTeamsWord) });
            teamsCard.append(prov0);
            return;
        }
        const teams = cropTeams(state.crop, bundle);
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = fillCopy("anCropTeams", { crop: cropLabel(state.crop) });
        teamsCard.append(h);
        const more = document.createElement("p");
        more.className = "ans-more";
        const ma = document.createElement("a");
        ma.href = plantHref(state.crop);
        ma.textContent = fillCopy("anEverything", { crop: cropLabel(state.crop).toLowerCase() });
        more.append(ma);
        teamsCard.append(more);
        if (teams.length) {
            const big = document.createElement("p");
            big.className = "ans-big";
            teams.forEach((g, i) => {
                if (i)
                    big.appendChild(document.createTextNode(" · "));
                const a = document.createElement("a");
                a.href = `#/plan?guild=${g.id}`;
                a.textContent = displayName(g);
                markLink(a, { kind: "team", id: g.id });
                big.appendChild(a);
            });
            teamsCard.append(big);
        }
        else {
            const none = document.createElement("p");
            none.className = "ans-big";
            none.textContent = fillCopy("anNoTeams", { crop: cropLabel(state.crop) });
            teamsCard.append(none);
        }
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = copy.anTeamsProv;
        teamsCard.append(prov);
    };
    const renderCrop = () => {
        trailSoon();
        for (const b of chipsEl.querySelectorAll("button")) {
            b.classList.toggle("on", b.dataset.sid === state.crop);
        }
        renderTeams();
        renderSituationRow();
        if (state.crop)
            editing.crop = false;
        setReceipt("crop", state.crop ? cropLabel(state.crop) : null);
        if (!state.crop || state.lat == null || state.lon == null) {
            if (state.lat != null && state.lon != null)
                climCard.hidden = false;
            datesCard.hidden = true;
            icsRow.hidden = true;
            return;
        }
        const t = todayIso();
        const a = cropAnswer(state.crop, state.lat, state.lon, t, bundle, state.country);
        if (!a) {
            datesCard.hidden = true;
            icsRow.hidden = true;
            return;
        }
        countRung("rung-crop");
        datesCard.hidden = false;
        if (!editing.zip && document.getElementById("anszip-receipt")?.hidden === false)
            climCard.hidden = true;
        if (!teamsHeld())
            requestAnimationFrame(() => requestAnimationFrame(() => revealIfOffscreen(datesCard)));
        datesCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = state.zip ? fillCopy("anCropIn", { crop: cropLabel(state.crop), zip: state.zip })
            : fillCopy("anCropNear", { crop: cropLabel(state.crop) });
        const crec = bundle.species.find((s) => s.id === state.crop);
        if (typeof crec?.image?.artist === "string") {
            const im = document.createElement("img");
            im.className = "ans-cropimg";
            im.dataset.spotPhoto = state.crop;
            im.src = `img/thumbs/${encodeURIComponent(state.crop)}.webp`;
            im.alt = "";
            im.width = 192;
            im.height = 192;
            im.loading = "lazy";
            im.decoding = "async";
            h.prepend(im);
        }
        datesCard.append(h);
        const weed = invasiveNote(bundle, state.crop);
        if (weed) {
            const p = document.createElement("p");
            p.className = "ans-note ans-weed";
            p.textContent = weed.charAt(0).toUpperCase() + weed.slice(1);
            datesCard.append(p);
        }
        let first = true;
        for (const r of a.rows) {
            if (r.note !== null) {
                const p = document.createElement("p");
                p.className = "ans-note";
                p.textContent = r.note;
                datesCard.append(p);
            }
            else if (first && r.date && r.key !== "freeze") {
                const band = document.createElement("div");
                band.className = "ans-deep";
                const bl = document.createElement("p");
                bl.className = "ans-deep-l";
                bl.textContent = r.label;
                const bd = document.createElement("p");
                bd.className = "ans-deep-d";
                bd.textContent = fmtDate(r.date, t);
                band.append(bl, bd);
                datesCard.append(band);
                first = false;
            }
            else if (r.date) {
                const div = document.createElement("div");
                div.className = "ans-row";
                const l = document.createElement("span");
                l.textContent = r.label;
                const v = document.createElement("span");
                v.textContent = fmtDate(r.date, t);
                div.append(l, v);
                datesCard.append(div);
            }
        }
        if (a.explain) {
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = a.explain;
            datesCard.append(prov);
        }
        glossFirstMedianIn(datesCard);
        icsRow.hidden = a.tasks.length === 0;
    };
    const cityBox = $("anscity");
    let cityAsked = "";
    const applyCityHit = (c, name) => {
        state.zip = undefined;
        state.lat = c[4];
        state.lon = c[5];
        state.place = name;
        state.country = c[6] || undefined;
        saveState(state);
        if (outsideUsTables(state.country))
            metricForVisit();
        cityBox.hidden = true;
        cityBox.replaceChildren();
        hint.textContent = "";
        hint.classList.remove("err");
        app.ensureZipData?.(c[4], c[5]);
        renderClimateCard();
        cropQuestionIntoView();
    };
    const cropQuestionIntoView = () => {
        requestAnimationFrame(() => document.getElementById("ans-crop-h")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    };
    let lookupToken = 0;
    const postcodeAbroad = (raw) => {
        const d = raw.trim().replace(/[\s-]+/g, "");
        if (!/^\d{4,6}$/.test(d))
            return false;
        const home = deviceCountry();
        return d.length === 5 ? !!home && home !== "us" : home !== "us";
    };
    const applyPlaceHit = (c) => {
        const parts = c.secondary.split(",").map((p) => p.trim()).filter(Boolean);
        const tail = parts[parts.length - 1];
        const name = tail && tail !== c.primary ? `${c.primary}, ${tail}` : c.primary;
        lookupToken++;
        zipEl.value = name;
        cityAsked = name;
        state.zip = undefined;
        state.lat = c.lat;
        state.lon = c.lon;
        state.place = name;
        state.country = c.cc?.toUpperCase() || undefined;
        saveState(state);
        if (outsideUsTables(state.country))
            metricForVisit();
        cityBox.hidden = true;
        cityBox.replaceChildren();
        hint.textContent = "";
        hint.classList.remove("err");
        app.ensureZipData?.(c.lat, c.lon);
        renderClimateCard();
        cropQuestionIntoView();
    };
    const lookUp = (asked) => {
        const token = ++lookupToken;
        cityBox.replaceChildren();
        cityBox.hidden = true;
        hint.textContent = fillCopy("anPlaceLooking", { query: asked });
        hint.classList.remove("err");
        const failed = () => { if (token === lookupToken) {
            hint.textContent = copy.anPlaceOffline;
            hint.classList.add("err");
        } };
        if (!app.searchPlaces) {
            failed();
            return;
        }
        void app.searchPlaces(asked).then(({ rows, unreachable }) => {
            if (token !== lookupToken)
                return;
            if (rows.length === 1) {
                applyPlaceHit(rows[0]);
                return;
            }
            if (!rows.length) {
                if (unreachable) {
                    failed();
                    return;
                }
                hint.textContent = fillCopy("anPlaceNone", { query: asked });
                hint.classList.add("err");
                return;
            }
            hint.textContent = copy.anPlacePick;
            for (const c of rows) {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "chip ans-chip ans-placechoice";
                const p = document.createElement("span");
                p.className = "ans-place-p";
                p.textContent = c.primary;
                b.append(p);
                if (c.secondary) {
                    const s = document.createElement("span");
                    s.className = "ans-place-s";
                    s.textContent = c.secondary;
                    b.append(s);
                }
                b.addEventListener("click", () => applyPlaceHit(c));
                cityBox.appendChild(b);
            }
            cityBox.hidden = false;
        }, failed);
    };
    const offerLookUp = (asked) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary ans-placefind";
        b.textContent = fillCopy("anPlaceFind", { query: asked });
        b.addEventListener("click", () => lookUp(asked));
        cityBox.appendChild(b);
        cityBox.hidden = false;
    };
    const applyCity = (raw) => {
        const asked = raw.trim();
        cityAsked = asked;
        lookupToken++;
        void import('./citylist.js').then(async (m) => {
            if (m.fold(asked).length < 2) {
                cityBox.hidden = true;
                hint.textContent = "";
                hint.classList.remove("err");
                return;
            }
            hint.textContent = copy.anCityLoading;
            hint.classList.remove("err");
            const cities = await m.loadCities();
            if (cityAsked !== asked)
                return;
            const { exact, near } = m.matchCities(cities, asked);
            const es = appLang() === "es";
            if (exact.length === 1) {
                applyCityHit(exact[0], placeLabel(exact[0], cities, es, m));
                return;
            }
            const pick = exact.length ? exact : near;
            cityBox.replaceChildren();
            if (pick.length) {
                hint.textContent = copy.anCityPick;
                for (const c of pick) {
                    const b = document.createElement("button");
                    b.type = "button";
                    b.className = "chip ans-chip ans-citychoice";
                    b.textContent = cityLabel(c, es, m);
                    b.addEventListener("click", () => { zipEl.value = b.textContent ?? ""; cityAsked = zipEl.value; applyCityHit(c, placeLabel(c, cities, es, m)); });
                    cityBox.appendChild(b);
                }
                if (m.fold(asked).length >= 3)
                    offerLookUp(asked);
                cityBox.hidden = false;
                return;
            }
            cityBox.hidden = true;
            const long = m.fold(asked).length >= 3;
            hint.textContent = long ? fillCopy("anPlaceOffer", { query: asked }) : "";
            hint.classList.remove("err");
            if (long)
                offerLookUp(asked);
        }, () => { hint.textContent = ""; });
    };
    const applyZip = (raw) => {
        if (/[^\d\s-]/.test(raw)) {
            applyCity(raw);
            return;
        }
        cityAsked = "";
        cityBox.hidden = true;
        cityBox.replaceChildren();
        lookupToken++;
        if (postcodeAbroad(raw)) {
            hint.textContent = copy.anPostcodeOffer;
            hint.classList.remove("err");
            offerLookUp(raw.trim());
            return;
        }
        const five = /^\d{5}/.test(raw.trim());
        if (five)
            app.ensureZipData?.(null, null, raw);
        const hit = zipToLatLon(raw, bundle.zip_index?.zips ?? null);
        if (hit) {
            state.zip = raw.trim();
            state.lat = hit.lat;
            state.lon = hit.lon;
            state.place = undefined;
            state.country = undefined;
            saveState(state);
            app.ensureZipData?.(hit.lat, hit.lon);
            hint.textContent = "";
            renderClimateCard();
        }
        else if (five) {
            const z3 = raw.trim().slice(0, 3);
            const loaded = Object.keys(bundle.zip_index?.zips ?? {}).some((z) => z.startsWith(z3));
            hint.textContent = loaded || zipRetried === raw.trim() ? copy.anZipMissing : copy.anZipLoading;
            hint.classList.toggle("err", loaded || zipRetried === raw.trim());
            if (!loaded && zipRetried !== raw.trim()) {
                const again = raw.trim();
                window.setTimeout(() => { if (zipEl.value.trim() === again) {
                    zipRetried = again;
                    applyZip(again);
                } }, 3000);
            }
        }
        else if (/\D/.test(raw.trim()) || raw.trim().length > 5) {
            hint.textContent = copy.anZipFormat;
            hint.classList.add("err");
        }
        else {
            hint.textContent = "";
            hint.classList.remove("err");
        }
    };
    let zipRetried = "";
    zipEl.addEventListener("input", () => applyZip(zipEl.value));
    zipEl.addEventListener("change", () => {
        const v = zipEl.value.trim();
        if (v && /^[\d\s-]+$/.test(v) && !/^\d{5}$/.test(v) && !postcodeAbroad(v)) {
            hint.textContent = copy.anZipFormat;
            hint.classList.add("err");
        }
    });
    zipEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter")
            return;
        const find = cityBox.querySelector(".ans-placefind");
        if (find && !cityBox.hidden) {
            e.preventDefault();
            find.click();
        }
    });
    for (const sid of QUICK) {
        if (!bundle.species.some((s) => s.id === sid))
            continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip ans-chip";
        b.dataset.sid = sid;
        b.textContent = cropLabel(sid);
        b.addEventListener("click", () => { state.crop = sid; saveState(state); renderCrop(); });
        chipsEl.append(b);
    }
    const renderFilter = () => {
        const q = filterEl.value.trim();
        filterList.innerHTML = "";
        if (q.length < 2)
            return;
        const found = cropSearch(bundle, bundle.species.map((s) => s.id), q);
        const hits = found.hits.slice(0, 12).map((id) => ({ id }));
        if (!found.exact || !hits.length) {
            const note = document.createElement("p");
            note.className = "ans-note";
            note.textContent = fillCopy(hits.length ? "anFilterClosest" : "anFilterNone", { q });
            filterList.append(note);
        }
        for (const s of hits) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "chip ans-chip";
            b.dataset.sid = s.id;
            b.textContent = cropLabel(s.id);
            b.addEventListener("click", () => {
                state.crop = s.id;
                saveState(state);
                filterEl.value = "";
                filterList.innerHTML = "";
                renderCrop();
            });
            filterList.append(b);
        }
    };
    filterEl.addEventListener("input", renderFilter);
    const remindSel = $("ansremind");
    remindSel.value = remindChoice();
    remindSel.addEventListener("change", () => setRemindChoice(remindSel.value));
    $("ansics").addEventListener("click", () => {
        if (!state.crop || state.lat == null || state.lon == null)
            return;
        const a = cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle, state.country);
        if (!a || !a.tasks.length)
            return;
        const ics = tasksToIcs(a.tasks, bundle, remindChoice());
        void shareOrDownloadIcs(ics, `milpa-${state.crop}.ics`);
    });
    $("ansplan").addEventListener("click", () => hooks.plantWithLocation(state.lat ?? null, state.lon ?? null, state.zip ?? null));
    const applyHashZip = () => {
        const want = zipFromHash(location.hash);
        if (!want || state.zip === want)
            return false;
        zipEl.value = want;
        applyZip(want);
        return true;
    };
    const applyHashPlace = () => {
        const want = placeFromHash(location.hash);
        if (!want || (!state.zip && state.lat === want.lat && state.lon === want.lon && state.country === want.country))
            return false;
        state.zip = undefined;
        state.lat = want.lat;
        state.lon = want.lon;
        state.place = want.place || undefined;
        state.country = want.country;
        saveState(state);
        if (outsideUsTables(want.country))
            metricForVisit();
        zipEl.value = "";
        app.ensureZipData?.(want.lat, want.lon);
        renderClimateCard();
        return true;
    };
    const applyHashQuery = () => {
        const want = queryFromHash(location.hash);
        if (!want || zipEl.value.trim() === want)
            return false;
        editing.zip = true;
        renderClimateCard();
        zipEl.value = want;
        applyZip(want);
        return true;
    };
    const applyHashCrop = () => {
        const want = cropFromHash(location.hash);
        if (!want)
            return false;
        if (!bundle.species.some((s) => s.id === want)) {
            cropHint.textContent = fillCopy("anBadCropLink", { crop: want });
            return false;
        }
        cropHint.textContent = "";
        if (state.crop !== want) {
            state.crop = want;
            saveState(state);
        }
        if (new URLSearchParams(location.hash.split("?")[1] ?? "").has("teams"))
            holdTeams();
        renderCrop();
        keepTeamsInView();
        return true;
    };
    const focusForDoor = () => {
        const zipped = applyHashZip() || applyHashPlace() || applyHashQuery();
        const carried = applyHashCrop();
        if (!matchMedia("(pointer: fine)").matches)
            return;
        if (zipped && !carried) {
            filterEl.focus();
            return;
        }
        if (carried && location.hash.includes("teams"))
            return;
        if (!carried && location.hash.includes("teams"))
            filterEl.focus();
        else
            zipEl.focus();
    };
    const onAnswersHash = () => {
        if (!location.hash.startsWith("#/answers"))
            return;
        renderSituation();
        renderSituationRow();
        if (situationFromHash(location.hash) && situationFromHash(location.hash)?.id !== "now")
            return;
        focusForDoor();
    };
    window.addEventListener("hashchange", onAnswersHash);
    app.answersTasks = () => {
        if (!state.crop || state.lat == null || state.lon == null)
            return [];
        return cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle, state.country)?.tasks ?? [];
    };
    if (state.zip)
        zipEl.value = state.zip;
    if (state.lat == null || state.lon == null) {
        const la = num("lat"), lo = num("lon");
        if (la != null && lo != null) {
            state.lat = la;
            state.lon = lo;
        }
    }
    if (!state.zip && state.lat != null && state.lon != null)
        app.ensureZipData?.(state.lat, state.lon);
    renderClimateCard();
    renderCrop();
    if (arrivedByTap) {
        renderSituationRow();
        onAnswersHash();
    }
    else {
        renderSituation(true);
        renderSituationRow();
        applyHashZip();
        applyHashPlace();
        applyHashQuery();
        applyHashCrop();
    }
    return () => {
        if (zipEl.value.trim() && (state.lat == null || state.lon == null))
            applyZip(zipEl.value);
        else
            renderClimateCard();
    };
}

export { SITUATION_GUIDE, answersTrail, cityLabel, climateAnswer, climateCardFrost, climateProv, cropAnswer, cropFromHash, cropTeams, initAnswers, nextOccurrence, placeFromHash, placeLabel, plantNow, queryFromHash, sowableByDays, sowableNow, zipFromHash };
