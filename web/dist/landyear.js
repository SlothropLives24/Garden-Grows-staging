import './chunk-ejg0q7q9.js';
import { frostPlace, ensureYearCss, yearFigure, stretch, cropLine } from './chunk-lxoyu69a.js';
import { copy, appLang, fillCopy, midSentence } from './paint.js';
import { shelfGuides, shelfAnchor, GROW_SHELF, commonName, plantingLabel, resolveSpecies, warmDayFor, mmddShift, warmPlantMmdd, mmddShiftAround, indoorStart, seasonDoy, mmddDoyOf, scheduleClimate, resolveDtm, localiseProse, corpusEs, el, localTodayIso, confidenceWord, fmtMonthDay } from './core.js';
import { ensurePhotoRowCss, guideShelf, photoRow, photoCreditsLink } from './chunk-kbn0qi4u.js';
import { climateProv, provFacts } from './chunk-pdnkwjb0.js';
import { examplePlan } from './exampleplace.js';
import './chunk-f8narovd.js';
import './chunk-f08gghbd.js';
import './chunk-bm4hdmsn.js';

const LANDING_SHELF_CARDS = 6;
const SISTERS = [["zea_mays", null], ["phaseolus_vulgaris", "pole"], ["cucurbita_pepo", "vining"]];
function sisterName(bundle, id, group) {
    if (!group)
        return commonName(bundle, id);
    if (appLang() === "es") {
        const sp = bundle.species.find((s) => s.id === id);
        const es = sp?.cultivar_groups?.find((g) => String(g.id) === group)?.common_es;
        if (!(Array.isArray(es) ? es.length : es))
            return commonName(bundle, id);
    }
    return plantingLabel(bundle, id, group);
}
function settle$1(host, row) {
    if (!host)
        return;
    if (row)
        host.replaceChildren(row);
    else
        host.hidden = true;
    host.removeAttribute("aria-busy");
}
function drawShelf(host) {
    if (!host)
        return;
    const { shown, total, rest } = shelfGuides(GROW_SHELF, LANDING_SHELF_CARDS);
    if (!shown.length) {
        settle$1(host, null);
        return;
    }
    const anchor = shelfAnchor(GROW_SHELF);
    const door = rest > 0 ? { href: `../guides/${anchor ? "#" + anchor : ""}`, label: copy.landingLibAll.replace("{n}", String(total)) } : undefined;
    settle$1(host, guideShelf(shown, door, copy.landingLibTitle));
}
function drawFaces(bundle, host) {
    if (!host)
        return;
    const cards = SISTERS.map(([id, group]) => ({
        href: `../plants/${id.replace(/_/g, "-")}/`,
        name: sisterName(bundle, id, group),
        img: { src: `img/thumbs/${id}.webp`, srcset: `img/thumbs/t128_${id}.webp 128w, img/thumbs/${id}.webp 192w`, sizes: "8.5rem", width: 192, height: 192 },
    }));
    const row = photoRow(cards, { faces: true, onBand: true, label: copy.lgFacesLabel });
    row.appendChild(photoCreditsLink());
    settle$1(host, row);
}
async function renderRows(bundle) {
    await ensurePhotoRowCss();
    drawShelf(document.getElementById("lgshelf"));
    drawFaces(bundle, document.getElementById("lgfaces"));
}

function plantDay(site, sid, bundle, lat) {
    if (!site || !bundle.species.some((s) => s.id === sid))
        return null;
    const sp = resolveSpecies(sid, null, bundle);
    const p50 = site.last_frost_32f?.p50 ?? null, p10 = site.last_frost_32f?.p10 ?? null;
    if (!p50 || (site.growing_season_days_p50 ?? 0) >= 365 || sp.sow_season === "fall")
        return null;
    const tol = sp.frost_tolerance, model = sp.scheduling_model;
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const rule = (id) => (bundle.rules ?? []).find((r) => r.id === id);
    const wait = tol === "very_tender" ? num(rule("R-171")?.offset_days_after_last_frost) : 0;
    const wd = warmDayFor(site, sid, bundle);
    const gap = (a, b) => seasonDoy(mmddDoyOf(b) ?? 0, lat) - seasonDoy(mmddDoyOf(a) ?? 0, lat);
    const late0 = wait > 0 ? mmddShift(p50, Math.trunc(wait)) : null;
    const late = late0 ? warmPlantMmdd(late0, wd, lat) ?? late0 : null;
    let day, kind;
    if (late && late0) {
        day = late;
        kind = late !== late0 ? "warm_ground" : "warm";
    }
    else if (tol === "tender" || tol === "very_tender" || tol == null) {
        const d = warmPlantMmdd(p50, wd, lat) ?? p50;
        if (d !== p50 && (!p10 || gap(p10, d) >= 0)) {
            day = d;
            kind = "warm_ground";
        }
        else if (p10) {
            day = p10;
            kind = "safe";
        }
        else {
            day = p50;
            kind = "median";
        }
    }
    else {
        const offs = rule("R-096")?.offset_days_before_last_frost ?? {};
        const off = num(tol === "hardy" ? offs.hardy : offs.half_hardy);
        if (off > 0 && model === "dtm") {
            day = mmddShift(p50, -Math.trunc(off)) ?? mmddShiftAround(p50, -Math.trunc(off));
            kind = "cool";
        }
        else if (model === "dtm") {
            day = p50;
            kind = "median";
        }
        else
            return null;
    }
    if (!day)
        return null;
    return { mmdd: day, kind, indoor: indoorStart(sid, site, bundle, lat)?.mmdd ?? null };
}

const LANDING_STATION = { "first_freeze_28f": { "p50": "10-28", "share": 1.0 }, "first_freeze_32f": { "p10": "10-03", "p20": "10-06", "p30": "10-09", "p40": "10-12", "p50": "10-15" }, "first_freeze_32f_p50": "10-15", "growing_season_days_p50": 169, "key": "USW00014735", "last_frost_32f": { "p10": "05-11", "p20": "05-06", "p30": "05-02", "p40": "04-30", "p50": "04-27" }, "lat": 42.7431, "lon": -73.8092, "prcp_mly_mm": [66.0, 57.9, 78.5, 79.0, 86.6, 102.9, 115.6, 95.5, 94.7, 97.8, 75.9, 82.8], "provenance": { "grade": "A", "method": "nearest_ncei_station", "station": { "id": "USW00014735", "name": "Albany Ap Hcn" }, "tier": 1 }, "summer_day_tmax_c": 27.7, "summer_night_tmin_c": 15.6, "tmax_mly_c": [0.4, 2.2, 7.4, 15.1, 21.8, 26.3, 28.8, 27.8, 23.6, 16.4, 9.6, 3.4], "tmin_mly_c": [-8.9, -8, -3.3, 2.7, 8.9, 14.1, 16.9, 15.9, 11.4, 5.1, -0.2, -5.2] };

LANDING_STATION.key;
const LANDING_TEAM = "three_sisters";
const LANDING_TRANSPLANT = "solanum_lycopersicum";
const specOf = (bundle, sid) => bundle.species.find((s) => s.id === sid);
const daysOf = (sp, group) => {
    const dtm = sp && (sp.scheduling_model === "dtm" || sp.scheduling_model === "gdd") ? resolveDtm(sp, group) : null;
    return dtm ? Math.trunc(dtm[0]) : null;
};
const held = new WeakMap();
function withStation(bundle) {
    const sites = bundle.climate?.sites;
    if (!bundle.climate || !sites)
        return null;
    let b = held.get(bundle);
    if (!b) {
        b = { ...bundle, climate: { ...bundle.climate, sites: [...sites, LANDING_STATION] } };
        held.set(bundle, b);
    }
    return b;
}
function landingSample(bundle0, todayIso) {
    const bundle = withStation(bundle0);
    if (!bundle)
        return null;
    const at = LANDING_STATION;
    const clim = scheduleClimate(at.lat, at.lon, bundle, null);
    if (!clim || !at.last_frost_32f?.p50 || JSON.stringify(clim.site.last_frost_32f) !== JSON.stringify(at.last_frost_32f)
        || (clim.site.first_freeze_32f_p50 ?? null) !== (at.first_freeze_32f_p50 ?? null))
        return null;
    const place = copy.lgExamplePlace;
    const team = [];
    const guild = bundle.guilds.find((g) => g.id === LANDING_TEAM);
    const plan = guild ? examplePlan(bundle, { lat: at.lat, lon: at.lon, label: place, given: true }, { guild: LANDING_TEAM }, todayIso) : null;
    if (guild && plan && plan.team.id === LANDING_TEAM) {
        for (const role of guild.roles ?? []) {
            const sid = role.canonical, sp = sid ? specOf(bundle, sid) : undefined;
            const sown = plan.plantings.find((p) => p.species === sid)?.sown;
            const days = daysOf(sp, role.canonical_group ?? null);
            if (!sid || !sown || days == null || team.some((c) => c.species === sid))
                continue;
            team.push({ species: sid, name: commonName(bundle, sid), sown, indoor: null, days });
        }
    }
    let transplant = null;
    const sp = specOf(bundle, LANDING_TRANSPLANT);
    const year = (team[0]?.sown ?? todayIso).slice(0, 4);
    const day = plantDay(clim.site, LANDING_TRANSPLANT, bundle, at.lat);
    const days = daysOf(sp, null);
    if (day && days != null) {
        transplant = { species: LANDING_TRANSPLANT, name: commonName(bundle, LANDING_TRANSPLANT), sown: `${year}-${day.mmdd}`,
            indoor: day.indoor ? `${year}-${day.indoor}` : null, days };
    }
    return { place, key: at.key, lat: at.lat, lon: at.lon, site: at, source: climateProv(provFacts(clim)), team, transplant };
}
const LANDING_PAIR = { rule: "R-105", belief: "B-012" };
function pairRecord(list, id, grade) {
    const r = (list ?? []).find((x) => x?.id === id);
    return r && r.grade === grade && r.evidence?.status === "verified" ? r : null;
}
function claimHead(text) {
    const m = /^(.+?[.!?])\s+(\S.*)$/su.exec(text.replace(/\s+/g, " ").trim());
    return m ? [m[1], m[2]] : [text.trim(), ""];
}
function claimPlain(text) {
    return text.trim().replace(/\s*\([^()]*\)(?=[.!?]?$)/u, "");
}

const lower = (name) => (appLang() === "es" ? name.charAt(0).toLowerCase() + name.slice(1) : midSentence(name));
function lines(s, crops, filled) {
    return crops.map((c) => cropLine(lower(c.name), c.sown, c.days, s.lat, { filled, indoor: c.indoor }))
        .filter((c) => !!c);
}
function settle(host, drawn) {
    if (!host)
        return;
    if (drawn)
        host.replaceChildren(drawn);
    else
        host.hidden = true;
    host.removeAttribute("aria-busy");
}
function heroTwin(s) {
    const item = (c) => (c.indoor
        ? fillCopy("lgYearIndoorItem", { crop: lower(c.name), indoor: fmtMonthDay(c.indoor), date: fmtMonthDay(c.sown) })
        : fillCopy("lgTeamWhenItem", { crop: lower(c.name), date: fmtMonthDay(c.sown) }));
    const list = new Intl.ListFormat(appLang(), { type: "conjunction" }).format([...s.team, ...(s.transplant ? [s.transplant] : [])].map(item));
    return fillCopy("lgYearTwin", { place: s.place, last: fmtMonthDay(s.site.last_frost_32f?.p50 ?? ""), first: fmtMonthDay(s.site.first_freeze_32f_p50 ?? ""), list });
}
function heroRing(s, place, todayIso) {
    const garden = [...s.team, ...(s.transplant ? [s.transplant] : [])];
    const days = s.site.growing_season_days_p50;
    return yearFigure({
        twin: heroTwin(s),
        place, lat: s.lat, crops: lines(s, garden, true), todayIso, band: true,
        season: { last: s.site.last_frost_32f?.p50 ?? null, first: s.site.first_freeze_32f_p50 ?? null },
        aria: fillCopy("lgYearAria", { place: s.place }),
        says: typeof days === "number" && days > 0 && days < 365 ? fillCopy("yrSaysDays", { n: days }) : undefined,
        src: `${fillCopy("lgYearWhose", { place: s.place })} ${s.source}`,
    });
}
function stateRing(s, place, caption, crops, last) {
    const fig = yearFigure({ place, lat: s.lat, crops, last: last ? { days: [] } : null, aria: "", small: true });
    if (!fig)
        return null;
    fig.appendChild(el("figcaption", null, caption));
    return fig;
}
function stateRings(s, place) {
    const garden = [...s.team, ...(s.transplant ? [s.transplant] : [])];
    const open = document.getElementById("lgstate-open"), acct = document.getElementById("lgstate-acct");
    const one = stateRing(s, place, copy.lgStatePlace, [], false);
    const three = [stateRing(s, place, copy.lgStatePlanned, lines(s, garden, false), false),
        stateRing(s, place, copy.lgStateGround, lines(s, garden, true), false),
        stateRing(s, place, copy.lgStateSecond, lines(s, garden, true), true)].filter((x) => !!x);
    if (!one || three.length !== 3) {
        settle(open, null);
        settle(acct, null);
        return;
    }
    open?.replaceChildren(one);
    acct?.replaceChildren(...three);
}
function teamYear(s, place) {
    if (!s.team.length)
        return null;
    const fig = yearFigure({ place, lat: s.lat, crops: lines(s, s.team, true), aria: fillCopy("lgTeamYearAria", { place: s.place }), small: true, band: true });
    if (!fig)
        return null;
    const items = s.team.map((c) => fillCopy("lgTeamWhenItem", { crop: lower(c.name), date: fmtMonthDay(c.sown) }));
    const list = new Intl.ListFormat(appLang(), { type: "conjunction" }).format(items);
    fig.appendChild(el("figcaption", null, fillCopy("lgTeamWhen", { place: s.place, list })));
    return fig;
}
function flatYear(place) {
    try {
        const fig = stretch(place, 32, 349, { W: 1152, m: 4, arch: 9, frost: true });
        const box = el("figure", "yr yr-small");
        box.innerHTML = `<svg class="yr-fig" viewBox="0 26 1152 50" aria-hidden="true" focusable="false" preserveAspectRatio="none">${fig.svg}</svg>`;
        return box;
    }
    catch {
        return null;
    }
}
function pairCard(cls, grade, said, why, href, whyKey) {
    const chip = el("span", `lg-conf ${grade === "A" ? "s" : "f"}`);
    chip.dataset.grade = grade;
    chip.append(el("span", "mk"), " ", el("span", "lg-conf-w", confidenceWord(grade) ?? ""));
    const w = el("p", "lg-why", why);
    if (whyKey)
        w.dataset.copyKey = whyKey;
    const ev = el("a", "lg-rec-ev", copy.lgSeeEvidence);
    ev.href = href;
    const card = el("article", `lg-rec ${cls}`);
    card.append(chip, el("h3", "lg-team", said), w, ev);
    return card;
}
function renderPair(bundle, host) {
    const rule = pairRecord(bundle.rules, LANDING_PAIR.rule, "A"), myth = pairRecord(bundle.beliefs, LANDING_PAIR.belief, "F");
    if (!rule?.claim || !myth?.belief) {
        settle(host, null);
        return;
    }
    const [head, rest] = claimHead(localiseProse(corpusEs(LANDING_PAIR.rule, "title") ?? rule.claim));
    const row = el("div", "lg-pair-row");
    row.append(pairCard("sure", "A", head, rest, `#/why?rule=${LANDING_PAIR.rule}`), pairCard("myth", "F", claimPlain(corpusEs(LANDING_PAIR.belief, "belief") ?? myth.belief), copy.lgPairMythWhy, `#/why?belief=${LANDING_PAIR.belief}`, "lgPairMythWhy"));
    settle(host, row);
}
async function renderYear(bundle) {
    const pair = document.getElementById("lgpair");
    if (pair)
        renderPair(bundle, pair);
    void renderRows(bundle).catch(() => { for (const id of ["lgshelf", "lgfaces"]) {
        const h = document.getElementById(id);
        if (h && !h.firstElementChild) {
            h.hidden = true;
            h.removeAttribute("aria-busy");
        }
    } });
    const hero = document.getElementById("lgyear"), teamHost = document.getElementById("lgteamyear");
    const flat = document.getElementById("lgflat"), foot = document.getElementById("lgfootring");
    const today = localTodayIso();
    const s = landingSample(bundle, today);
    let place = null;
    try {
        place = s ? frostPlace(s.site, s.key, s.lat) : null;
    }
    catch {
        place = null;
    }
    const states = [document.getElementById("lgstate-open"), document.getElementById("lgstate-acct")];
    if (!s || !place || !(await ensureYearCss())) {
        for (const h of [hero, teamHost, flat, foot, ...states])
            settle(h, null);
        return;
    }
    settle(hero, heroRing(s, place, today));
    settle(teamHost, teamYear(s, place));
    stateRings(s, place);
    const line = flatYear(place);
    if (flat && line)
        flat.replaceChildren(line);
    const big = yearFigure({ place, lat: s.lat, crops: lines(s, [...s.team, ...(s.transplant ? [s.transplant] : [])], true), aria: "", small: true, band: true });
    if (foot && big)
        foot.replaceChildren(big);
}

export { renderPair, renderYear };
