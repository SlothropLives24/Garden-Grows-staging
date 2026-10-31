import '../chunk-lutet8cz.js';
import { area, frostCalibration, frostPossible, resolveGround, ladder, phComparable, storageEstimate, app, isExamplePlot, openLog, getPlot, fmtArea, remindChoice, themeChoice, tempSystem, unitSystem, signedInEmail } from '../core.js';
import { fillCopy, copy, pluralCopy, appLang } from '../paint.js';
import '../chunk-l5cseoso.js';

function grounds(inp) {
    const list = [
        { region: null, structure: null },
        ...inp.beds.map((b) => ({ region: b.region, structure: b.structure ?? null })),
    ];
    return list.map((g) => {
        const r = resolveGround(inp.soilObservations, inp.plot, g.region);
        const obs = Object.keys(r.fields).length ? r.fields : null;
        const lad = ladder(obs, g.structure, r.src);
        const d = r.fields.drainage;
        return {
            rung: lad.rung,
            label: lad.label,
            recorded: obs !== null,
            ph: typeof r.fields.ph === "number" && phComparable(r.src.ph, r.fields.ph_method),
            phLab: typeof r.fields.ph === "number" && !phComparable(r.src.ph, r.fields.ph_method),
            drainage: typeof d === "string" && d !== "unknown",
            next: lad.next ? { costs: lad.next.costs, buys: lad.next.buys } : null,
        };
    });
}
const countCopy = (base, n, vars = {}) => fillCopy(`${base}${n === 1 ? "One" : "Many"}`, { n, ...vars });
function locationRow(inp) {
    const where = copy.gkLocWhere;
    if (inp.lat == null || inp.lon == null) {
        return { key: "location", label: copy.gkLocLabel, held: false,
            given: copy.gkNothingYet,
            earned: [],
            next: copy.gkLocNext,
            where };
    }
    const earned = [];
    if (inp.site?.last_frost_32f || inp.site?.first_freeze_32f_p50) {
        earned.push(copy.gkLocFrost);
    }
    if (inp.zone) {
        earned.push(fillCopy("gkLocZone", { zone: inp.zone }));
    }
    earned.push(copy.gkLocDay);
    if (inp.country)
        earned.push(copy.gkLocCountryEarned);
    if (!inp.site && inp.climateSettled)
        earned.push(inp.zone ? copy.gkLocNoFrost : copy.gkLocNoClimate);
    const ll = { lat: inp.lat.toFixed(2), lon: inp.lon.toFixed(2) };
    const at = inp.zone ? fillCopy("gkLocGivenZone", { ...ll, zone: inp.zone }) : fillCopy("gkLocGiven", ll);
    return { key: "location", label: copy.gkLocLabel, held: true,
        given: inp.country ? `${at} ${fillCopy("gkLocCountry", { country: inp.country })}` : at,
        earned,
        next: null,
        where };
}
function addressRow(inp) {
    const where = copy.gkAddrWhere;
    if (!inp.address && !inp.anchored) {
        return { key: "address", label: copy.gkAddrLabel, held: false,
            given: copy.gkAddrNone,
            earned: [],
            next: copy.gkAddrNext,
            where };
    }
    const earned = [copy.gkAddrSatellite, copy.gkAddrFrame];
    return { key: "address", label: copy.gkAddrLabel, held: !!inp.address,
        given: inp.address
            ? fillCopy(inp.anchored ? "gkAddrTypedAnchored" : "gkAddrTyped", { address: inp.address })
            : copy.gkAddrDropped,
        earned,
        next: null,
        where };
}
function groundRow(inp) {
    const where = copy.gkGroundWhere;
    if (inp.beds.length === 0) {
        return { key: "ground", label: copy.gkGroundLabel, held: false,
            given: copy.gkNothingYet,
            earned: [],
            next: copy.gkGroundNext,
            where };
    }
    const total = inp.beds.reduce((sum, b) => sum + area(b.region), 0);
    const sized = inp.beds.filter((b) => b.sized).length;
    const earned = [copy.gkGroundFit, copy.gkGroundPlace, copy.gkGroundRotation];
    const noSun = inp.beds.filter((b) => !b.sun).length;
    const next = sized > 0
        ? countCopy("gkGroundSized", sized)
        : noSun > 0
            ? countCopy("gkGroundNoSun", noSun)
            : null;
    return { key: "ground", label: copy.gkGroundLabel, held: true,
        given: countCopy(sized > 0 ? "gkGroundGivenSized" : "gkGroundGiven", inp.beds.length, { area: inp.fmtArea(total), sized }),
        earned, next, where };
}
function seasonsRow(inp) {
    const where = copy.gkSeasonsWhere;
    const plantings = inp.seasons.reduce((n, s) => n + (s.plantings?.length ?? 0), 0);
    const held = inp.seasons.length > 0 || inp.priorOccupancy > 0;
    if (!held) {
        return { key: "seasons", label: copy.gkSeasonsLabel, held: false,
            given: copy.gkNothingYet,
            earned: [],
            next: copy.gkSeasonsNext,
            where };
    }
    const earned = [];
    if (plantings > 0 || inp.priorOccupancy > 0) {
        earned.push(copy.gkSeasonsRotation);
    }
    let next = null;
    if (inp.site) {
        const cal = frostCalibration(inp.seasons, inp.site);
        if (cal.spring.calibrated || cal.fall.calibrated) {
            earned.push(copy.gkSeasonsOwnFrost);
        }
        else {
            const n = Math.max(cal.spring.n, cal.fall.n);
            const left = Math.max(0, cal.min_seasons - n);
            if (n > 0 || frostPossible(inp.site) !== false)
                next = countCopy("gkSeasonsMore", left);
        }
    }
    const parts = [];
    if (inp.seasons.length)
        parts.push(countCopy("gkPartSeason", inp.seasons.length));
    if (plantings)
        parts.push(countCopy("gkPartPlanting", plantings));
    if (inp.priorOccupancy)
        parts.push(countCopy("gkPartHistory", inp.priorOccupancy));
    return { key: "seasons", label: copy.gkSeasonsLabel, held: true,
        given: `${parts.join(", ")}.`,
        earned, next, where };
}
function soilRow(inp) {
    const where = copy.gkSoilWhere;
    const all = grounds(inp);
    const recorded = all.filter((g) => g.recorded);
    if (recorded.length === 0) {
        return { key: "soil", label: copy.gkSoilLabel, held: false,
            given: copy.gkSoilNone,
            earned: [],
            next: copy.gkSoilNext,
            where };
    }
    const earned = [];
    const phLive = recorded.some((g) => g.ph);
    const phLab = !phLive && recorded.some((g) => g.phLab);
    const drainageLive = recorded.some((g) => g.drainage);
    const lowest = all.reduce((a, b) => (b.rung < a.rung ? b : a));
    const rungLabels = recorded.map((g) => g.label);
    if (phLive) {
        earned.push(copy.gkSoilPh);
    }
    else if (phLab) {
        earned.push(copy.gkSoilPhLab);
    }
    if (drainageLive) {
        earned.push(copy.gkSoilDrainage);
    }
    if (!phLive && !phLab && !drainageLive) {
        earned.push(copy.gkSoilGatesNothing);
    }
    const counted = new Map();
    for (const l of rungLabels)
        counted.set(l, (counted.get(l) ?? 0) + 1);
    const given = [...counted.entries()].map(([l, n]) => (n > 1 ? fillCopy("gkSoilAt", { n, rung: l }) : l)).join(", ");
    return { key: "soil", label: copy.gkSoilLabel, held: true,
        given: countCopy("gkSoilGiven", recorded.length, { list: given }),
        earned,
        next: lowest.next ? `${lowest.next.costs} - ${lowest.next.buys}` : null,
        where };
}
const fmtBytes = (b) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
function photosRow(inp) {
    const where = inp.photos.usage != null && inp.photos.quota != null
        ? fillCopy("gkPhotosWhereQuota", { used: fmtBytes(inp.photos.usage), quota: fmtBytes(inp.photos.quota) })
        : copy.gkPhotosWhereNoQuota;
    if (inp.photos.count === 0) {
        return { key: "photos", label: copy.gkPhotosLabel, held: false,
            given: copy.gkNoneYet,
            earned: [],
            next: copy.gkPhotosNext,
            where };
    }
    return { key: "photos", label: copy.gkPhotosLabel, held: true,
        given: countCopy("gkPhotosGiven", inp.photos.count),
        earned: [copy.gkPhotosEarned],
        next: null,
        where };
}
function plantsRow(inp) {
    const where = copy.gkPlantsWhere;
    if (inp.userSpecies === 0) {
        return { key: "plants", label: copy.gkPlantsLabel, held: false,
            given: copy.gkPlantsNone,
            earned: [],
            next: copy.gkPlantsNext,
            where };
    }
    return { key: "plants", label: copy.gkPlantsLabel, held: true,
        given: countCopy("gkPlantsGiven", inp.userSpecies),
        earned: [copy.gkPlantsEarned],
        next: null,
        where };
}
function accountRow(inp) {
    if (!inp.signedIn) {
        return { key: "account", label: copy.gkAcctLabel, held: false,
            given: copy.gkAcctOut,
            earned: [],
            next: copy.gkAcctNext,
            where: copy.gkAcctWhereNone };
    }
    return { key: "account", label: copy.gkAcctLabel, held: true,
        given: fillCopy("gkAcctGiven", { email: inp.email ?? copy.gkAcctYours }),
        earned: [copy.gkAcctEarned],
        next: null,
        where: copy.gkAcctWhere };
}
function displayRow(inp) {
    const remind = inp.prefs.remind === "none" ? copy.gkDispNoRemind : fillCopy("gkDispRemind", { remind: inp.prefs.remind });
    return { key: "display", label: copy.gkDispLabel, held: true,
        given: fillCopy("gkDispGiven", { units: inp.prefs.units, temp: inp.prefs.temp, theme: inp.prefs.theme, remind }),
        earned: [copy.gkDispEarned],
        next: null,
        where: copy.gkDispWhere };
}
function gardenKnows(inp) {
    return [
        locationRow(inp),
        addressRow(inp),
        groundRow(inp),
        seasonsRow(inp),
        soilRow(inp),
        photosRow(inp),
        plantsRow(inp),
        accountRow(inp),
        displayRow(inp),
    ];
}
function knowsSummary(rows) {
    const facts = rows.filter((r) => r.key !== "display");
    const held = facts.filter((r) => r.held).length;
    if (held === 0) {
        return fillCopy("gkSummaryNone", { n: facts.length });
    }
    return fillCopy("gkSummary", { held, n: facts.length });
}

const UNIT_LABEL = { metric: copy.pnKnowsUnitsMetric, imperial: copy.pnKnowsUnitsImperial };
const THEME_LABEL = { system: copy.pnKnowsThemeDevice, light: copy.acLight, dark: copy.acDark };
const REMIND_LABEL = { morning: copy.pnKnowsRemindMorning, evening: copy.pnKnowsRemindEvening };
let estCache = null;
let estAsked = false;
let knowsMoreOpen = false;
let indexWired = false;
function wireAcctIndex() {
    const nav = document.getElementById("acctindex");
    if (indexWired || !nav)
        return;
    indexWired = true;
    const links = [...nav.querySelectorAll('a[href^="#"]')].filter((a) => !a.getAttribute("href")?.startsWith("#/"));
    const groupOf = (a) => document.getElementById((a.getAttribute("href") ?? "").slice(1));
    const mark = (a) => {
        for (const l of links) {
            if (l === a)
                l.setAttribute("aria-current", "location");
            else
                l.removeAttribute("aria-current");
        }
    };
    nav.addEventListener("click", (e) => {
        const a = e.target?.closest("a");
        const group = a && links.includes(a) ? groupOf(a) : null;
        if (!a || !group)
            return;
        e.preventDefault();
        const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        group.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
        if (!group.hasAttribute("tabindex"))
            group.setAttribute("tabindex", "-1");
        group.focus({ preventScroll: true });
        mark(a);
    });
    if (typeof IntersectionObserver !== "function")
        return;
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
        for (const en of entries)
            seen.set(en.target, en.isIntersecting);
        const here = links.find((l) => { const g = groupOf(l); return !!g && seen.get(g) === true; });
        if (here)
            mark(here);
    }, { rootMargin: "-15% 0px -70% 0px" });
    for (const l of links) {
        const g = groupOf(l);
        if (g)
            io.observe(g);
    }
}
let countryOf = null;
let countryAsking = null;
function countryFor(site, lat, lon, zone) {
    const plot = app.currentPlotId;
    const key = `${plot}|${lat}|${lon}`;
    if (countryOf?.key === key)
        return countryOf.code ?? undefined;
    if (countryAsking !== key) {
        countryAsking = key;
        void openLog().then((db) => getPlot(db, plot)).then((p) => {
            countryOf = { key, code: p?.country ?? null };
            if (countryAsking === key && countryOf.code)
                renderGardenKnows(site, lat, lon, zone);
        }).catch(() => { });
    }
    return undefined;
}
function countryName(code) {
    if (!code)
        return null;
    try {
        return new Intl.DisplayNames([appLang()], { type: "region" }).of(code) ?? code;
    }
    catch {
        return code;
    }
}
function renderGardenKnows(site, lat, lon, zone) {
    wireAcctIndex();
    const panel = document.getElementById("knowsrows");
    const summary = document.getElementById("knowssummary");
    if (!panel || !summary)
        return;
    if (!estAsked) {
        estAsked = true;
        void storageEstimate().then((e) => {
            if (e) {
                estCache = e;
                renderGardenKnows(site, lat, lon, zone);
            }
        });
    }
    const rows = gardenKnows({
        signedIn: signedInEmail() !== null,
        email: signedInEmail(),
        site, lat, lon, zone,
        climateSettled: lat != null && lon != null && !!app.climateSettled?.(lat, lon),
        address: app.currentPlot?.address?.trim() || null,
        anchored: !!app.currentPlot?.anchor,
        country: countryName(countryFor(site, lat, lon, zone)),
        beds: app.logSnapshot.beds.map((b) => ({
            name: b.name, region: b.region, structure: b.structure, sun: b.sun, sized: b.sized,
        })),
        seasons: app.logSnapshot.seasons,
        priorOccupancy: app.logSnapshot.priorOccupancy.length,
        soilObservations: app.soilObservations,
        plot: app.currentPlotId,
        photos: {
            count: app.logSnapshot.seasons.flatMap((s) => s.plantings ?? [])
                .flatMap((p) => p.notes ?? []).filter((n) => n.photo).length,
            usage: estCache?.usage ?? null,
            quota: estCache?.quota ?? null,
        },
        userSpecies: app.userSpecies.length,
        prefs: {
            units: UNIT_LABEL[unitSystem()] ?? unitSystem(),
            temp: tempSystem() === "c" ? "°C" : "°F",
            theme: THEME_LABEL[themeChoice()] ?? themeChoice(),
            remind: remindChoice() === "none" ? "none" : REMIND_LABEL[remindChoice()] ?? remindChoice(),
        },
        fmtArea,
    });
    const ex = document.getElementById("knowsexample");
    if (ex)
        ex.hidden = !isExamplePlot(app.currentPlotId);
    summary.textContent = knowsSummary(rows);
    const held = rows.filter((r) => r.held), open = rows.filter((r) => !r.held);
    const kids = held.map(rowEl);
    if (open.length) {
        const more = document.createElement("details");
        more.className = "knowsmore disclosure";
        more.open = knowsMoreOpen;
        more.addEventListener("toggle", () => { knowsMoreOpen = more.open; });
        const sum = document.createElement("summary");
        sum.textContent = pluralCopy("pnKnowsMore", open.length);
        more.append(sum, ...open.map(rowEl));
        kids.push(more);
    }
    panel.replaceChildren(...kids);
}
function rowEl(row) {
    const det = document.createElement("details");
    det.className = `knowsrow ${row.held ? "held" : "open"}`;
    det.dataset.knows = row.key;
    const sum = document.createElement("summary");
    const st = document.createElement("span");
    st.className = "knowsst";
    st.textContent = row.key === "display" ? copy.pnKnowsKept : row.held ? copy.pnKnowsGiven : copy.pnKnowsNotGiven;
    const head = document.createElement("span");
    head.className = "knowshead";
    const label = document.createElement("b");
    label.textContent = row.label;
    const given = document.createElement("span");
    given.className = "knowsgiven";
    given.textContent = row.given;
    head.append(label, given);
    sum.append(st, head);
    det.append(sum);
    const body = document.createElement("div");
    body.className = "knowsbody";
    if (row.earned.length) {
        body.append(part(copy.pnKnowsBuys, row.earned));
    }
    else if (row.held) {
        body.append(part(copy.pnKnowsBuys, [copy.pnKnowsNothingYet]));
    }
    if (row.next)
        body.append(part(row.held ? copy.pnKnowsNextBuys : copy.pnKnowsWouldBuy, [row.next]));
    body.append(part(copy.pnKnowsWhere, [row.where]));
    det.append(body);
    return det;
}
function part(title, lines) {
    const wrap = document.createElement("div");
    wrap.className = "knowspart";
    const h = document.createElement("span");
    h.className = "knowsparth";
    h.textContent = title;
    wrap.append(h);
    for (const line of lines) {
        const p = document.createElement("p");
        p.textContent = line;
        wrap.append(p);
    }
    return wrap;
}

export { renderGardenKnows };
