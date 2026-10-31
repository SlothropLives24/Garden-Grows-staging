import { dateLocale, copy, numberLocale, storeLang, storedLang, appLang, langChosen, fillCopy, stationDisplay, CONFIDENCE as CONFIDENCE$1, CONFIDENCE_ES, stripRuleCitations, humanizeFamilies, familyName, familyInProse, nameAsLabel, titleCase, humanize, MOUND_MIN_SPAN_M, markPlantName, plainClaim, loadChunk, chunkReady, onChunkLoaded, currentRoute, markLoading, clearLoading, markFailed, chunkFor, plusPreview, fillNodes, noteSignInStart, countRung, captured, midSentence, pluralCopy, go, countGardenActive, familyShown, signInMayMove, buzz, esGuide, enOnly, daysAway, showingOriginals, setShowingOriginals, awaitingHome, whenIdle, isStarted, markStarted, bundleInfoLine, applySeasonalCopy, langPending, markHomeworthy, guildFromHash, seat, homeSettled, settleHome, clearStarted } from './paint.js';

function localTodayIso(now = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const plantHref = (id, group) => `#/plant?id=${encodeURIComponent(id)}${group ? `&group=${encodeURIComponent(group)}` : ""}`;
function plantLink(name, id, group) {
    const a = document.createElement("a");
    a.className = "pname";
    a.href = plantHref(id, group ?? null);
    a.textContent = name;
    return a;
}
function linkNameIn(host, text, label, speciesId, group) {
    const cut = splitAroundLabel(text, label);
    if (!cut) {
        host.appendChild(document.createTextNode(text));
        return;
    }
    if (cut.before)
        host.appendChild(document.createTextNode(cut.before));
    host.appendChild(plantLink(cut.hit, speciesId, group ?? null));
    if (cut.after)
        host.appendChild(document.createTextNode(cut.after));
}
function linkNamesIn(host, text, marks) {
    const spans = claimLabels(text, marks.map((m) => m.label));
    const hits = spans
        .map((at, i) => ({ at, mark: marks[i] }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const h of hits) {
        if (h.at > cursor)
            host.appendChild(document.createTextNode(text.slice(cursor, h.at)));
        host.appendChild(plantLink(h.mark.label, h.mark.species, h.mark.group ?? null));
        cursor = h.at + h.mark.label.length;
    }
    if (cursor < text.length)
        host.appendChild(document.createTextNode(text.slice(cursor)));
}
function claimLabels(text, labels) {
    const taken = [];
    const spans = new Array(labels.length).fill(-1);
    const order = labels.map((_, i) => i).sort((a, b) => labels[b].length - labels[a].length || a - b);
    for (const i of order) {
        const label = labels[i];
        if (!label)
            continue;
        for (let at = text.indexOf(label); at >= 0; at = text.indexOf(label, at + 1)) {
            const end = at + label.length;
            if (taken.some(([s, e]) => at < e && s < end))
                continue;
            taken.push([at, end]);
            spans[i] = at;
            break;
        }
    }
    return spans;
}
function splitAroundLabel(text, label) {
    if (!label)
        return null;
    const at = text.indexOf(label);
    if (at < 0)
        return null;
    return { before: text.slice(0, at), hit: label, after: text.slice(at + label.length) };
}

const BLOOM_ORDER = ["early_spring", "late_spring", "early_summer", "midsummer", "late_summer"];
const FORAGE_LEVELS = ["high", "very_high"];
const speciesOf = (bundle, id) => bundle.species.find((s) => s.id === id);
function bloomSpan(sp) {
    const w = sp?.bloom_window;
    if (!Array.isArray(w) || w.length === 0)
        return null;
    const idx = [];
    for (const v of w) {
        const i = BLOOM_ORDER.indexOf(v);
        if (i < 0)
            return null;
        idx.push(i);
    }
    return [Math.min(...idx), Math.max(...idx)];
}
function spansOverlap(a, b) {
    if (a === null || b === null)
        return false;
    return a[0] <= b[1] && b[0] <= a[1];
}
function needsInsects(sp) {
    const poll = sp?.pollination;
    return !!poll && typeof poll === "object" && poll.mode === "insect";
}
function isForage(sp) {
    return FORAGE_LEVELS.includes(sp?.pollinator_value);
}
function forageInFlower(cropSpan, plantedIds, bundle) {
    const seen = new Set();
    const out = [];
    for (const sid of plantedIds) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const sp = speciesOf(bundle, sid);
        if (sp && isForage(sp) && spansOverlap(bloomSpan(sp), cropSpan))
            out.push(sid);
    }
    return out;
}
function forageCandidates(cropSpan, bundle, exclude = new Set()) {
    if (cropSpan === null)
        return [];
    const scored = [];
    for (const sp of bundle.species) {
        if (exclude.has(sp.id) || !isForage(sp))
            continue;
        const span = bloomSpan(sp);
        if (!spansOverlap(span, cropSpan))
            continue;
        const s = span;
        const covered = Math.min(s[1], cropSpan[1]) - Math.max(s[0], cropSpan[0]) + 1;
        scored.push([-covered, sp.id]);
    }
    scored.sort((a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return scored.map(([, sid]) => sid);
}

function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371.0088;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(bLat - aLat);
    const dLon = rad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
const GRADE_RANK = { A: 0, B: 1, C: 2 };
function worseGrade(a, b) {
    return GRADE_RANK[a] >= GRADE_RANK[b] ? a : b;
}
function distanceGrade(km) {
    if (km <= 2)
        return "A";
    if (km <= 80)
        return "B";
    return "C";
}
function caveatFor(site, km) {
    const d = km < 10 ? km.toFixed(1) : Math.round(km).toString();
    if (km <= 2)
        return `${d} km from the resolved site "${site.key}" - effectively on-site.`;
    if (km <= 80)
        return (`${d} km from the resolved site "${site.key}" - inside the calibrated 80 km range, ` +
            `but the frost dates are the site's, not your ground's.`);
    return (`${d} km from the NEAREST resolved site ("${site.key}") - beyond the calibrated 80 km range. ` +
        `Treat these dates as a rough regional sketch (grade C).`);
}
const MATCH_TOLERANCE_KM = 80.0;
const STATION_SKETCH_REACH_KM = 160.0;
const US_TABLE_COUNTRIES = new Set(["US", "PR", "VI", "GU", "AS", "MP", "UM"]);
const usTableSite = (site) => String(site.provenance?.method).startsWith("nearest_ncei");
let gardenCountries = [];
function noteGardenCountries(gardens) {
    gardenCountries = gardens.flatMap((g) => (g.anchor && g.country ? [[g.anchor.lat, g.anchor.lon, g.country]] : []));
}
function gardenCountryAt(lat, lon) {
    const here = new Set(gardenCountries.filter(([a, b]) => Math.abs(a - (lat ?? NaN)) <= 1e-4 && Math.abs(b - (lon ?? NaN)) <= 1e-4).map((g) => g[2]));
    return here.size === 1 ? [...here][0] : undefined;
}
let gardenOwnFrost = [];
let ownFrostMemo = new Map();
function noteOwnFrost(gardens) {
    gardenOwnFrost = gardens.flatMap((g) => (g.anchor && (g.frost_own?.last || g.frost_own?.first) ? [[g.anchor.lat, g.anchor.lon, g.frost_own]] : []));
    ownFrostMemo = new Map();
}
function ownFrostAt(lat, lon) {
    const here = gardenOwnFrost.filter(([a, b]) => Math.abs(a - (lat ?? NaN)) <= 1e-4 && Math.abs(b - (lon ?? NaN)) <= 1e-4);
    return here.length && here.every((g) => g[2].last === here[0][2].last && g[2].first === here[0][2].first) ? here[0][2] : undefined;
}
const mdDoy = (md) => {
    const [m, d] = md.split("-").map(Number);
    return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000) + 1;
};
const doyMd$1 = (doy) => {
    const d = new Date(Date.UTC(2001, 0, 1) + (((doy - 1) % 365 + 365) % 365) * 86400000);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
function lateFallFrostOf(cell) {
    const last = cell.last_frost_32f?.p50, days = cell.growing_season_days_p50;
    if (cell.frost_free || cell.first_freeze_32f_p50 || !last || (typeof days === "number" && days >= 365))
        return null;
    const ff = cell.first_freeze_32f ?? {};
    for (const [k, n] of [["p40", 4], ["p30", 3], ["p20", 2], ["p10", 1]]) {
        const mmdd = ff[k];
        if (mmdd)
            return { mmdd, in_ten: n, days: null };
    }
    return typeof days === "number" ? { mmdd: doyMd$1(mdDoy(last) + days), in_ten: null, days } : null;
}
function shiftFreezeLine(f28, from32, to32) {
    if (!f28 || !to32 || from32 === to32)
        return f28 ?? null;
    if (!from32)
        return null;
    if (!f28.p50)
        return f28;
    const moved = ((mdDoy(to32) - mdDoy(from32)) % 365 + 365 + 182) % 365 - 182;
    return { ...f28, p50: doyMd$1(mdDoy(f28.p50) + moved) };
}
function ownFrostResolution(base, own, lat, lon) {
    const b = base?.site;
    const last = own.last ?? null, first = own.first ?? null;
    const lf = last ? { p50: last } : (b?.last_frost_32f ?? {});
    const ff = first ?? (b && !frostRare(b) ? b.first_freeze_32f_p50 ?? null : null);
    const lfMd = lf.p50 ?? null;
    const days = lfMd && ff ? ((mdDoy(ff) - mdDoy(lfMd) + 365) % 365) || 365 : null;
    const site = { ...(b ?? { key: "own_window", lat, lon }), last_frost_32f: lf, first_freeze_32f_p50: ff,
        own_window: { last, first } };
    delete site.frost_free;
    delete site.frost_station;
    delete site.frost_model;
    delete site.frost_provenance;
    if (!(b && frostRare(b) && first && !last)) {
        delete site.frost_years;
        delete site.years;
    }
    if (first && b?.first_freeze_28f) {
        const f28 = shiftFreezeLine(b.first_freeze_28f, frostRare(b) ? null : b.first_freeze_32f_p50 ?? null, first);
        if (f28)
            site.first_freeze_28f = f28;
        else
            delete site.first_freeze_28f;
    }
    if (b && frostRare(b) && !(last && first))
        site.growing_season_days_p50 = b.growing_season_days_p50;
    else if (days != null)
        site.growing_season_days_p50 = days;
    else
        delete site.growing_season_days_p50;
    return { site, distanceKm: base?.distanceKm ?? 0, effectiveGrade: base?.effectiveGrade ?? "C",
        caveat: "Frost dates the gardener gave for this garden (D-322); the station's or the model's are kept beside them.",
        model: base };
}
const abroadAt = (lat, lon, cc) => {
    cc = cc === undefined ? gardenCountryAt(lat, lon) : cc;
    return outsideUsTables(cc);
};
const outsideUsTables = (cc) => !!cc && !US_TABLE_COUNTRIES.has(cc.toUpperCase());
function matchSite(lat, lon, bundle, abroad) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    let best = null;
    let bestKm = Infinity;
    for (const site of bundle.climate?.sites ?? []) {
        if (abroad && usTableSite(site))
            continue;
        const km = haversineKm(lat, lon, site.lat, site.lon);
        if (km < bestKm) {
            best = site;
            bestKm = km;
        }
    }
    return best && bestKm <= MATCH_TOLERANCE_KM ? best : null;
}
function frostRare(site) {
    return (site?.growing_season_days_p50 ?? 0) >= 365;
}
function frostGate(site) {
    const lf = (site?.last_frost_32f ?? {});
    if (lf.p50)
        return { date: lf.p50, pct: 50 };
    const fy = site?.frost_years, years = site?.years;
    if (typeof fy === "number" && typeof years === "number" && years > 0 && fy / years >= 0.25) {
        const pcts = Object.keys(lf).filter((k) => /^p\d+$/.test(k) && lf[k]).map((k) => Number(k.slice(1))).sort((a, b) => a - b);
        if (pcts.length) {
            const p = pcts[0];
            return { date: lf[`p${p}`], pct: p };
        }
    }
    return null;
}
function frostSomeWinters(site) {
    if (!site || !frostRare(site))
        return null;
    const fy = site.frost_years, years = site.years;
    if (typeof fy !== "number" || typeof years !== "number" || years <= 0 || fy / years < 0.25)
        return null;
    return frostGate(site)?.date ?? null;
}
const FROST_STATION_KM = 25.0;
const FROST_SOME_SHARE = 0.25;
const FROST_MOST_SHARE = 0.5;
function stationFrostWord(winters, frostWinters) {
    const share = winters > 0 ? frostWinters / winters : 0;
    return share < FROST_SOME_SHARE ? "rare" : share <= FROST_MOST_SHARE ? "some" : "most";
}
function bearingDeg(lat1, lon1, lat2, lon2) {
    const r = (d) => (d * Math.PI) / 180;
    const p1 = r(lat1), p2 = r(lat2), dl = r(lon2 - lon1);
    const th = (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * 180) / Math.PI;
    return (th + 360) % 360;
}
const stationIndex = new WeakMap();
function stationsNear(rows, lat, lon) {
    let idx = stationIndex.get(rows);
    if (!idx) {
        idx = new Map();
        for (const r of rows) {
            const k = `${Math.floor(r[2])},${Math.floor(r[3])}`;
            const list = idx.get(k);
            if (list)
                list.push(r);
            else
                idx.set(k, [r]);
        }
        stationIndex.set(rows, idx);
    }
    const i = Math.floor(lat), j = Math.floor(lon), out = [];
    for (const a of [i - 1, i, i + 1])
        for (const b of [j - 1, j, j + 1])
            out.push(...(idx.get(`${a},${(((b + 180) % 360) + 360) % 360 - 180}`) ?? []));
    return out;
}
function frostStationFor(lat, lon, rows) {
    const r = frostStationRow(lat, lon, rows, false);
    return r && r.station;
}
function datedFrostStationFor(lat, lon, rows) {
    const r = frostStationRow(lat, lon, rows, true);
    if (!r)
        return null;
    const row = r.row;
    return { ...r.station, years: row[8], last_frost_32f: row[9] ?? null, first_freeze_32f: row[10] ?? null,
        growing_season_days_p50: row[11], first_freeze_28f: row[12] ?? null };
}
function frostStationRow(lat, lon, rows, dated) {
    let best = null, bestShare = -1, bestKm = Infinity;
    for (const r of stationsNear(rows ?? [], lat, lon)) {
        if (dated && r.length <= 8)
            continue;
        const km = haversineKm(lat, lon, r[2], r[3]);
        if (km > FROST_STATION_KM)
            continue;
        const octant = Math.floor(((bearingDeg(r[2], r[3], lat, lon) + 22.5) % 360) / 45);
        if (km > r[7][octant])
            continue;
        const share = r[5] ? r[6] / r[5] : 0;
        if (share > bestShare || (share === bestShare && (km < bestKm || (km === bestKm && best !== null && r[0] < best[0])))) {
            best = r;
            bestShare = share;
            bestKm = km;
        }
    }
    if (!best)
        return null;
    return { row: best, station: { id: best[0], name: best[1], lat: best[2], lon: best[3], elev_m: best[4], km: Math.round(bestKm * 10) / 10,
            winters: best[5], frost_winters: best[6] } };
}
const NEARER_GAP_DAYS = 14;
const doyOf = (mmdd) => {
    const [m, d] = mmdd.split("-").map(Number);
    return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000) + 1;
};
const daysSooner = (later, earlier) => ((doyOf(later) - doyOf(earlier) + 182) % 365 + 365) % 365 - 182;
function nearerDatedStation(lat, lon, dated, rows) {
    const p50 = dated?.last_frost_32f?.p50;
    if (!dated || !p50 || (dated.growing_season_days_p50 ?? 365) >= 365)
        return null;
    const ruleKm = haversineKm(lat, lon, dated.lat, dated.lon);
    let best = null;
    for (const r of stationsNear(rows ?? [], lat, lon)) {
        if (r.length <= 8 || r[0] === dated.id)
            continue;
        const km = haversineKm(lat, lon, r[2], r[3]);
        if (km >= ruleKm || km > FROST_STATION_KM)
            continue;
        const octant = Math.floor(((bearingDeg(r[2], r[3], lat, lon) + 22.5) % 360) / 45);
        if (km > r[7][octant])
            continue;
        const q = (r[11] ?? 365) < 365 ? r[9]?.p50 ?? null : null;
        if (q && daysSooner(p50, q) <= NEARER_GAP_DAYS)
            continue;
        if (!best || km < best.km || (km === best.km && r[0] < best.r[0]))
            best = { r, q, km };
    }
    if (!best)
        return null;
    const { r, q, km } = best;
    return { id: r[0], name: r[1], km: Math.round(km * 10) / 10, winters: r[5], frost_winters: r[6], years: r[8],
        last_frost_p50: q, days_sooner: q ? daysSooner(p50, q) : null };
}
function withNearer(site, lat, lon, dated, rows) {
    if (!site.frost_provenance)
        return site;
    const near = nearerDatedStation(lat, lon, dated, rows);
    return near ? { ...site, frost_nearer: near } : site;
}
function gateByStation(site, st) {
    const word = stationFrostWord(st.winters, st.frost_winters);
    const out = { ...site, frost_station: { ...st },
        frost_model: site.frost_model ?? { frost_years: site.frost_years ?? null, years: site.years ?? null,
            last_frost_32f: site.last_frost_32f ?? null,
            first_freeze_32f_p50: site.first_freeze_32f_p50 ?? null, growing_season_days_p50: site.growing_season_days_p50 ?? null },
        frost_years: st.frost_winters, years: st.winters };
    if (word === "rare" || word === "some") {
        out.frost_free = true;
        out.growing_season_days_p50 = 365;
    }
    if (word === "some") {
        const lf = Object.fromEntries(Object.entries((site.last_frost_32f ?? {})).filter(([k, v]) => k !== "p50" && v));
        out.last_frost_32f = Object.keys(lf).length ? lf : null;
        out.first_freeze_32f_p50 = null;
        delete out.first_freeze_32f;
        delete out.late_fall_frost;
    }
    if (word === "rare") {
        out.last_frost_32f = null;
        out.first_freeze_32f_p50 = null;
        delete out.first_freeze_32f;
        delete out.late_fall_frost;
        delete out.first_freeze_28f;
    }
    return out;
}
function datesByStation(site, st) {
    const { last_frost_32f: lf, first_freeze_32f: ff, growing_season_days_p50: days, first_freeze_28f: f28, ...named } = st;
    const out = { ...site,
        frost_model: site.frost_model ?? { frost_years: site.frost_years ?? null, years: site.years ?? null,
            last_frost_32f: site.last_frost_32f ?? null,
            first_freeze_32f_p50: site.first_freeze_32f_p50 ?? null, growing_season_days_p50: site.growing_season_days_p50 ?? null },
        frost_provenance: { tier: 1, grade: "B", method: "ghcn_daily_station", station: named } };
    delete out.frost_free;
    delete out.first_freeze_32f;
    delete out.first_freeze_28f;
    delete out.late_fall_frost;
    let keep28 = f28;
    if (days < 365) {
        out.last_frost_32f = lf;
        out.first_freeze_32f_p50 = ff?.p50 ?? null;
        out.growing_season_days_p50 = days;
        if (ff)
            out.first_freeze_32f = ff;
        const late = lateFallFrostOf(out);
        if (late)
            out.late_fall_frost = late;
    }
    else {
        const ws = site.frost_station;
        const rare = stationFrostWord(ws?.winters ?? 0, ws?.frost_winters ?? 0) === "rare";
        const early = Object.fromEntries(Object.entries(lf ?? {}).filter(([k, v]) => k !== "p50" && v));
        out.frost_free = true;
        out.growing_season_days_p50 = 365;
        out.first_freeze_32f_p50 = null;
        out.last_frost_32f = rare || !Object.keys(early).length ? null : early;
        if (rare)
            keep28 = null;
    }
    if (keep28)
        out.first_freeze_28f = keep28;
    const ws = site.frost_station;
    if (stationFrostWord(ws?.winters ?? 0, ws?.frost_winters ?? 0) !== "rare" && frostGate(out) == null && frostGate(site) != null)
        return site;
    return out;
}
function frostWord(site) {
    if (!site || !frostRare(site))
        return null;
    const st = site.frost_station;
    if (st && typeof st.winters === "number")
        return stationFrostWord(st.winters, st.frost_winters);
    return frostSomeWinters(site) != null ? "some" : "rare";
}
function givenFrostGate(site) {
    return frostRare(site) ? site?.own_window?.last ?? null : null;
}
function givenFirstFrost(site) {
    return frostRare(site) ? site?.own_window?.first ?? null : null;
}
const frostGiven = (site) => frostRare(site) && !!site?.own_window;
const frostStationOf = (site) => site?.frost_station ?? null;
const modelSite = (site) => site?.provenance?.method === "nearest_era5_cell" || site?.provenance?.method === MODEL_BUILT_SITE;
const frostDatesModelled = (site) => modelSite(site) && !site?.frost_provenance;
const FROST_GATE_CALIBRATED_C = 12.9;
const FROST_GATE_MARGIN_C = 0.2;
const FROST_GATE_LOW_C = Math.round((FROST_GATE_CALIBRATED_C + FROST_GATE_MARGIN_C) * 10) / 10;
function frostPossible(site) {
    if (!site)
        return null;
    if (site.provenance?.method !== "nearest_era5_cell")
        return true;
    if (!frostRare(site) || (typeof site.frost_years === "number" && site.frost_years > 0))
        return true;
    const lows = site.tmin_mly_c;
    if (!Array.isArray(lows) || lows.length !== 12 || lows.some((x) => typeof x !== "number"))
        return true;
    const st = site.temps_station;
    if (site.temps === "station" && st && haversineKm(site.lat, site.lon, st.lat, st.lon) > GLOBAL_ZONE_TOLERANCE_KM)
        return true;
    return Math.min(...lows) <= FROST_GATE_LOW_C;
}
const TROPICS_LAT = 23.44;
function frostAsked(site, lat) {
    const gate = frostPossible(site);
    if (gate !== null)
        return gate;
    return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) >= TROPICS_LAT;
}
function worldwideFrostClean(bundle) {
    return bundle.global_frost?.elevation_downscaling === "off";
}
function scheduleClimate(lat, lon, bundle, country) {
    return resolveClimate(lat, lon, bundle, true, country);
}
function scheduleSite(lat, lon, bundle, country) {
    return lat != null && lon != null ? scheduleClimate(lat, lon, bundle, country)?.site ?? null : null;
}
const climateMemo = new WeakMap();
const NO_LIST = {};
function resolveClimate(lat, lon, bundle, cleanOnly = false, country) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    const sites = (bundle.climate?.sites ?? NO_LIST);
    const world = (bundle.global_frost ?? NO_LIST);
    let bySites = climateMemo.get(sites);
    if (!bySites) {
        bySites = new WeakMap();
        climateMemo.set(sites, bySites);
    }
    let memo = bySites.get(world);
    if (!memo) {
        memo = new Map();
        bySites.set(world, memo);
    }
    const abroad = abroadAt(lat, lon, country);
    const key = `${lat},${lon}|${cleanOnly ? 1 : 0}|${abroad ? 1 : 0}|${worldwideFrostClean(bundle) ? 1 : 0}`;
    const own = ownFrostAt(lat, lon);
    let out;
    if (memo.has(key))
        out = memo.get(key);
    else {
        out = resolveClimateFresh(lat, lon, bundle, cleanOnly, abroad);
        memo.set(key, out);
    }
    if (!own)
        return out;
    const kept = ownFrostMemo.get(key);
    if (kept && kept.base === out)
        return kept.out;
    const mine = ownFrostResolution(out, own, lat, lon);
    ownFrostMemo.set(key, { base: out, out: mine });
    return mine;
}
const SQUARE_LAND_MIN = 0.5;
const SQUARE_NEAR_RATIO = 1.25;
const SQUARE_GROUND_BAND_M = 100.0;
const TOWN_HEIGHT_KM = 25.0;
const townIndex = new WeakMap();
const mostlyWater = (c) => typeof c.land_share === "number" && c.land_share < SQUARE_LAND_MIN;
function placeHeight(lat, lon, towns) {
    if (!Array.isArray(towns) || !towns.length)
        return null;
    let idx = townIndex.get(towns);
    if (!idx) {
        idx = new Map();
        towns.forEach((t, i) => {
            const k = `${Math.floor(t[0])},${Math.floor(t[1])}`;
            (idx.get(k) ?? idx.set(k, []).get(k)).push([i, t]);
        });
        townIndex.set(towns, idx);
    }
    const i0 = Math.floor(lat), j0 = Math.floor(lon);
    const span = 1 + Math.trunc(TOWN_HEIGHT_KM / (111.0 * Math.max(0.05, Math.cos((Math.min(89.0, Math.abs(lat) + 1.0) * Math.PI) / 180))));
    let best = null;
    let bestKm = Infinity, bestI = Infinity;
    for (let a = i0 - 1; a <= i0 + 1; a++) {
        for (let b = j0 - span; b <= j0 + span; b++) {
            for (const [i, t] of idx.get(`${a},${((b + 180) % 360 + 360) % 360 - 180}`) ?? []) {
                const km = haversineKm(lat, lon, t[0], t[1]);
                if (km <= TOWN_HEIGHT_KM && (km < bestKm || (km === bestKm && i < bestI))) {
                    best = t;
                    bestKm = km;
                    bestI = i;
                }
            }
        }
    }
    return best ? { m: best[2], km: Math.round(bestKm * 10) / 10 } : null;
}
function chooseSquare(lat, lon, cells, towns) {
    let near = null, land = null;
    let nearKm = Infinity, landKm = Infinity;
    for (const c of cells) {
        const km = haversineKm(lat, lon, c.lat, c.lon);
        if (km < nearKm) {
            near = c;
            nearKm = km;
        }
        if (km < landKm && !mostlyWater(c)) {
            land = c;
            landKm = km;
        }
    }
    if (!near)
        return null;
    const square = {};
    const h = placeHeight(lat, lon, towns);
    if (mostlyWater(near)) {
        if (land && landKm <= GLOBAL_ZONE_TOLERANCE_KM) {
            const lg = land.ground_m;
            if (!h || (typeof lg === "number" && Math.abs(lg - h.m) <= SQUARE_GROUND_BAND_M)) {
                return { cell: land, km: landKm, square: { water: { km: Math.round(nearKm * 10) / 10 } } };
            }
        }
        else {
            square.only_water = true;
        }
    }
    const g = near.ground_m;
    if (h && typeof g === "number" && Math.abs(g - h.m) > SQUARE_GROUND_BAND_M) {
        const reach = Math.min(SQUARE_NEAR_RATIO * nearKm, GLOBAL_ZONE_TOLERANCE_KM);
        let best = near, bestKm = nearKm, bestDz = Math.abs(g - h.m);
        for (const c of cells) {
            const cg = c.ground_m;
            if (c === near || typeof cg !== "number")
                continue;
            const km = haversineKm(lat, lon, c.lat, c.lon);
            const dz = Math.abs(cg - h.m);
            if (km <= reach && (dz < bestDz || (dz === bestDz && km < bestKm))) {
                best = c;
                bestKm = km;
                bestDz = dz;
            }
        }
        if (best !== near) {
            square.height = { m: h.m, town_km: h.km, ground_m: best.ground_m, near_km: Math.round(nearKm * 10) / 10, near_ground_m: g };
            return { cell: best, km: bestKm, square };
        }
    }
    return { cell: near, km: nearKm, square };
}
const datesCaveat = (st, rest) => `Frost dates from GHCN-Daily station ${st.id} (${Math.round(st.km)} km; D-363), grade B - a hollow or low ground nearby `
    + `can frost later than the station; the rest from ${rest}. ${LOG_OWN}`;
const LOG_OWN = "Log your own frosts and after three seasons they supersede this.";
const MODEL_BUILT_SITE = "era5_open_meteo_daily_min";
function resolveClimateFresh(lat, lon, bundle, cleanOnly, abroad) {
    let best = null;
    let bestKm = Infinity;
    const rows = bundle.global_frost?.stations;
    for (const site of bundle.climate?.sites ?? []) {
        if (abroad && usTableSite(site))
            continue;
        const km = haversineKm(lat, lon, site.lat, site.lon);
        if (km < bestKm) {
            best = site;
            bestKm = km;
        }
    }
    if ((!best || bestKm > MATCH_TOLERANCE_KM) && (!cleanOnly || worldwideFrostClean(bundle))) {
        const world = bundle.global_frost;
        const pick = chooseSquare(lat, lon, world?.cells ?? [], world?.towns);
        const cell = pick?.cell ?? null;
        const cellKm = pick?.km ?? Infinity;
        if (cell !== null && cellKm <= GLOBAL_ZONE_TOLERANCE_KM) {
            const site = {
                key: `era5_${cell.lat.toFixed(0)}_${cell.lon.toFixed(0)}`,
                lat: cell.lat, lon: cell.lon,
                last_frost_32f: cell.last_frost_32f,
                first_freeze_32f_p50: cell.first_freeze_32f_p50,
                growing_season_days_p50: cell.growing_season_days_p50,
                summer_night_tmin_c: cell.summer_night_tmin_c,
                ...(cell.tmax_mly_c ? { summer_day_tmax_c: cell.summer_day_tmax_c, tmax_mly_c: cell.tmax_mly_c } : {}),
                ...(cell.tmin_mly_c ? { tmin_mly_c: cell.tmin_mly_c } : {}),
                ...(cell.prcp_mly_mm ? { prcp_mly_mm: cell.prcp_mly_mm } : {}),
                ...(cell.temps ? { temps: cell.temps } : {}),
                ...(cell.temps_station ? { temps_station: cell.temps_station } : {}),
                ...(Array.isArray(cell.rain_dry_months) && cell.rain_dry_months.length ? { rain_dry_months: cell.rain_dry_months } : {}),
                ...(cell.frost_free ? { frost_free: true } : {}),
                ...(cell.years ? { frost_years: cell.frost_years, years: cell.years } : {}),
                ...(cell.first_freeze_28f ? { first_freeze_28f: cell.first_freeze_28f } : {}),
                provenance: { tier: 3, grade: "C", method: "nearest_era5_cell" },
            };
            const late = lateFallFrostOf(cell);
            if (late)
                site.late_fall_frost = late;
            const station = frostStationFor(lat, lon, rows);
            const dated = station ? datedFrostStationFor(lat, lon, rows) : null;
            const gated = station ? gateByStation(site, station) : site;
            const out = dated ? withNearer(datesByStation(gated, dated), lat, lon, dated, rows) : gated;
            return {
                site: out,
                distanceKm: cellKm,
                effectiveGrade: out.frost_provenance ? "B" : "C",
                caveat: out.frost_provenance
                    ? datesCaveat(out.frost_provenance.station, `the ERA5 reanalysis cell this point reads (${Math.round(cellKm)} km)`)
                    : `Frost dates derived from the ~25 km ERA5 reanalysis cell this point reads (${Math.round(cellKm)} km; `
                        + `D-358, height first: the nearest, or the near square on the place's own ground); `
                        + `no NCEI station coverage outside the US. Model output, grade C - terrain finer than the cell `
                        + `(a frost hollow, a south slope) is not resolved. ${LOG_OWN}`,
                ...(pick && Object.keys(pick.square).length ? { square: pick.square } : {}),
            };
        }
    }
    if (!best || bestKm > STATION_SKETCH_REACH_KM)
        return null;
    if (best.provenance?.method === MODEL_BUILT_SITE) {
        const station = frostStationFor(lat, lon, rows), dated = station && datedFrostStationFor(lat, lon, rows);
        const out = dated ? datesByStation(gateByStation(best, station), dated) : null;
        if (out?.frost_provenance && dated)
            return { site: withNearer(out, lat, lon, dated, rows), distanceKm: bestKm, effectiveGrade: "B",
                caveat: datesCaveat(out.frost_provenance.station, `the hand-set point "${best.key}" (${Math.round(bestKm)} km)`) };
    }
    const siteGrade = best.provenance?.grade || "C";
    return {
        site: best,
        distanceKm: bestKm,
        effectiveGrade: worseGrade(siteGrade, distanceGrade(bestKm)),
        caveat: caveatFor(best, bestKm),
    };
}
function zipToLatLon(zip, table) {
    const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(zip);
    if (!m || !table)
        return null;
    const hit = table[m[1]];
    if (!hit)
        return null;
    const [lat, lon] = hit.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
const ZONE_ZIP_TOLERANCE_KM = 80.0;
const ZONE_A_KM = 10.0;
const GLOBAL_ZONE_TOLERANCE_KM = 160.0;
function zoneInt(label) {
    const m = /^(\d+)/.exec(label);
    return m ? parseInt(m[1], 10) : null;
}
const zoneCache = new WeakMap();
function resolveZone(lat, lon, bundle, country) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    const abroad = abroadAt(lat, lon, country);
    let byPoint = zoneCache.get(bundle);
    if (!byPoint) {
        byPoint = new Map();
        zoneCache.set(bundle, byPoint);
    }
    const b = bundle;
    const tables = `${b.zip_index ? 1 : 0}${b.zip_zones ? 1 : 0}${b.global_zones ? 1 : 0}`;
    const key = `${lat},${lon}|${tables}|${b._zipEpoch ?? 0}|${abroad}`;
    const cached = byPoint.get(key);
    if (cached !== undefined)
        return cached;
    const centroids = abroad ? {} : bundle.zip_index?.zips ?? {};
    const zones = bundle.zip_zones?.zones ?? {};
    let bestZip = null;
    let bestKm = Infinity;
    for (const [z, ll] of Object.entries(centroids)) {
        if (!(z in zones))
            continue;
        const c = ll.indexOf(",");
        const zla = Number(ll.slice(0, c));
        const zlo = Number(ll.slice(c + 1));
        const km = haversineKm(lat, lon, zla, zlo);
        if (km < bestKm) {
            bestKm = km;
            bestZip = z;
        }
    }
    let result;
    if (bestZip !== null && bestKm <= ZONE_ZIP_TOLERANCE_KM) {
        const label = zones[bestZip];
        result = {
            zone: zoneInt(label),
            label,
            grade: bestKm <= ZONE_A_KM ? "A" : "B",
            source: `USDA ${bundle.zip_zones?.vintage ?? ""} PHZM ZIP-code listing (PRISM/OSU)`,
            method: "nearest_phzm_zipcode",
            zip: bestZip,
            distance_km: Math.round(bestKm * 10) / 10,
        };
    }
    else {
        const site = matchSite(lat, lon, bundle, abroad);
        result = (site?.hardiness) ?? null;
        if (result === null) {
            const gz = bundle.global_zones;
            const cells = gz?.cells ?? [];
            let bestCell = null;
            let bestCellKm = Infinity;
            for (const c of cells) {
                const km = haversineKm(lat, lon, c[0], c[1]);
                if (km < bestCellKm) {
                    bestCellKm = km;
                    bestCell = c;
                }
            }
            if (bestCell !== null && bestCellKm <= GLOBAL_ZONE_TOLERANCE_KM) {
                const label = bestCell[3];
                result = {
                    zone: zoneInt(label),
                    label,
                    grade: "C",
                    source: `Derived from ERA5 daily minima (Open-Meteo), ${gz?.period ?? ""} - USDA-equivalent band`,
                    method: "nearest_era5_cell",
                    extreme_min_c: bestCell[2],
                    distance_km: Math.round(bestCellKm * 10) / 10,
                    caveat: "USDA-equivalent zone from the average annual extreme minimum temperature, "
                        + "derived from the ~25 km ERA5 reanalysis cell nearest this point (no NCEI/PHZM "
                        + "coverage outside the US); model output, grade C - terrain finer than the cell "
                        + "(frost hollows, slopes) is not resolved.",
                };
            }
        }
    }
    byPoint.set(key, result);
    return result;
}

const rotationCache = new WeakMap();
function rotationMaps(bundle) {
    const hit = rotationCache.get(bundle);
    if (hit)
        return hit;
    const rules = new Set();
    const byFamily = {};
    const years = {};
    for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        const trig = (r.trigger ?? {});
        if (trig.kind !== "rotation_interval")
            continue;
        rules.add(r.id);
        if (trig.family) {
            byFamily[trig.family] = r.id;
            if (typeof trig.years === "number")
                years[trig.family] = trig.years;
        }
    }
    const r013 = bundle.rules.find((r) => r.id === "R-013");
    const breaks = new Set((r013?.trigger?.breaks) ?? []);
    const maps = { rules, byFamily, years, breaks };
    rotationCache.set(bundle, maps);
    return maps;
}
function rotationRules(bundle) { return rotationMaps(bundle).rules; }
function familyRotationRule(bundle) { return rotationMaps(bundle).byFamily; }
function familyRotationYears(bundle) { return rotationMaps(bundle).years; }
function breakFamilies(bundle) { return rotationMaps(bundle).breaks; }
const cxCache = new WeakMap();
function cx(bundle) {
    let c = cxCache.get(bundle);
    if (!c) {
        c = {
            species: new Map(bundle.species.map((s) => [s.id, s])),
            entities: new Map(bundle.entities.map((e) => [e.id, e])),
            guilds: new Map(bundle.guilds.map((g) => [g.id, g])),
        };
        cxCache.set(bundle, c);
    }
    return c;
}
function pyRepr(v) {
    if (v === null || v === undefined)
        return "None";
    if (v === true)
        return "True";
    if (v === false)
        return "False";
    if (typeof v === "string")
        return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    if (Array.isArray(v))
        return `[${v.map(pyRepr).join(", ")}]`;
    return String(v);
}
function pyStr(v) {
    if (v === null || v === undefined)
        return "None";
    if (v === true)
        return "True";
    if (v === false)
        return "False";
    if (Array.isArray(v))
        return pyRepr(v);
    return String(v);
}
function gFmt(n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15)
        return String(n);
    return String(parseFloat(n.toPrecision(6)));
}
function num$1(v) {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    if (x === null || x === undefined || typeof x === "object")
        return null;
    if (typeof x === "boolean")
        return x ? 1 : 0;
    if (typeof x === "string" && x.trim() === "")
        return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
}
function pathGet(resolved, dotted) {
    let cur = resolved;
    for (const part of dotted.split(".")) {
        if (cur === null || typeof cur !== "object" || Array.isArray(cur))
            return undefined;
        cur = cur[part];
    }
    return cur;
}
function matches(resolved, predicate) {
    const fails = [];
    for (const [field, want] of Object.entries(predicate ?? {})) {
        const have = pathGet(resolved, field);
        if (want !== null && typeof want === "object" && !Array.isArray(want) && ("min" in want || "max" in want)) {
            const bound = want;
            const got = num$1(have);
            if (got === null) {
                fails.push(`${field} missing`);
                continue;
            }
            if (bound.min !== undefined && got < bound.min)
                fails.push(`${field} ${gFmt(got)} below min ${pyStr(bound.min)}`);
            if (bound.max !== undefined && got > bound.max)
                fails.push(`${field} ${gFmt(got)} above max ${pyStr(bound.max)}`);
        }
        else if (Array.isArray(want)) {
            if (!want.some((w) => w === have))
                fails.push(`${field} is ${pyRepr(have)}, need one of ${pyStr(want)}`);
        }
        else if (have !== want && !(have === undefined && want === null)) {
            fails.push(`${field} is ${pyRepr(have)}, need ${pyRepr(want)}`);
        }
    }
    return [fails.length === 0, fails];
}
function resolveSpecies(sid, group, bundle) {
    const c = cx(bundle);
    const sp = { ...(c.species.get(sid) ?? c.entities.get(sid) ?? {}) };
    const groups = sp.cultivar_groups;
    if (groups && groups.length) {
        const chosen = (group ? groups.find((g) => g.id === group) : undefined) ?? groups[0];
        for (const [k, v] of Object.entries(chosen))
            if (k !== "id")
                sp[k] = v;
        sp.cultivar_group = chosen.id;
    }
    return sp;
}
function resolvedField(sp, group, key) {
    if (!sp)
        return undefined;
    const groups = Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : [];
    if (groups.length && key !== "id") {
        const chosen = (group ? groups.find((g) => g.id === group) : undefined) ?? groups[0];
        if (chosen && key in chosen)
            return chosen[key];
    }
    return sp[key];
}
const round4$1 = (x) => Math.round(x * 1e4) / 1e4;
function speciesFootprintM2(resolved) {
    const s = num$1(resolved.mature_spread_cm);
    if (s === null)
        return 0;
    const cm = Math.max(s, 30);
    return round4$1((cm / 100) ** 2);
}
function roleCanonicalFootprintM2(role, bundle) {
    if (!role.canonical)
        return 0;
    return speciesFootprintM2(resolveSpecies(role.canonical, role.canonical_group ?? null, bundle));
}
function parseYear(key) {
    if (!/^-?\d+$/.test(key))
        return null;
    return parseInt(key, 10);
}
function historyFamilies(fams) {
    const out = [];
    for (const e of fams ?? []) {
        const [fam, load] = typeof e === "object" && e !== null ? [e.family, e.load ?? "full"] : [e, "full"];
        if (fam)
            out.push([fam, load === "full" || load === "partial" ? load : "full"]);
    }
    return out;
}
function everCarried(site) {
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return new Set();
    const out = new Set();
    for (const fams of Object.values(history))
        for (const [fam] of historyFamilies(fams))
            out.add(fam);
    return out;
}
function currentPlantingYear(site) {
    if (typeof site.season_year === "number" && Number.isInteger(site.season_year))
        return site.season_year;
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return null;
    const years = Object.keys(history)
        .map(parseYear)
        .filter((y) => y !== null);
    return years.length ? Math.max(...years) + 1 : null;
}
function effectiveInterval(baseYears, load) {
    return load === "partial" ? Math.max(1, Math.ceil(baseYears / 2)) : baseYears;
}
function familyWithinInterval(site, family, baseYears) {
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return false;
    const cur = currentPlantingYear(site);
    for (const [key, fams] of Object.entries(history)) {
        const year = parseYear(key);
        for (const [fam, load] of historyFamilies(fams)) {
            if (fam !== family)
                continue;
            if (year === null)
                return true;
            if (cur !== null && cur - year < effectiveInterval(baseYears, load))
                return true;
        }
    }
    return false;
}
function growingWindow(site, bundle) {
    const ffd = site.frost_free_days;
    if (ffd !== null && ffd !== undefined) {
        const n = num$1(ffd);
        return [n === null ? null : Math.trunc(n), null];
    }
    if (site.lat == null || site.lon == null)
        return [null, null];
    const best = scheduleSite(site.lat, site.lon, bundle);
    return [best ? (best.growing_season_days_p50 ?? null) : null, best ?? null];
}
function inScope(resolved, rule) {
    const at = rule?.applies_to ?? null;
    return !!at && Object.keys(at).length > 0 && matches(resolved, at)[0];
}
const MONTH_CUM$1 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const mmddToDoy$1 = (s) => {
    if (typeof s !== "string" || !/^\d\d-\d\d$/.test(s))
        return null;
    const m = Number(s.slice(0, 2)), d = Number(s.slice(3, 5));
    return m >= 1 && m <= 12 ? MONTH_CUM$1[m - 1] + d : null;
};
function cropFreeze(site, key, bundle) {
    const [sid, grp] = key.split("/");
    const sp = resolveSpecies(sid, grp || null, bundle);
    const ff32 = site?.first_freeze_32f_p50 ?? null;
    const at32 = { mmdd: ff32, line_f: 32, counted: ff32 != null };
    const rule = bundle.rules.find((r) => r.id === "R-188");
    const tol = sp.frost_tolerance;
    if (!rule || typeof tol !== "string" || !inScope(sp, rule))
        return at32;
    const trig = (rule.trigger ?? {});
    const own = typeof sp.freeze_line_f === "number" ? sp.freeze_line_f : null;
    const line = own || trig.line_f?.[tol] || 32;
    if (line >= 32)
        return at32;
    const f = (site?.first_freeze_28f && typeof site.first_freeze_28f === "object" ? site.first_freeze_28f : {});
    if (typeof f.share === "number" && f.share < Number(trig.counts_from_share ?? 0))
        return { mmdd: null, line_f: 28, counted: false };
    if (f.p50)
        return { mmdd: f.p50, line_f: 28, counted: true };
    return at32;
}
function inScopeUntiered(resolved, rule) {
    if (!rule)
        return false;
    const at = Object.fromEntries(Object.entries(rule.applies_to ?? {}).filter(([k]) => k !== "frost_tolerance"));
    return Object.keys(at).length === 0 || matches(resolved, at)[0];
}
function cropSeasonDays(site, key, bundle, frostFree) {
    if (frostFree == null)
        return [null, null];
    const [sid, grp] = key.split("/");
    const sp = resolveSpecies(sid, grp || null, bundle);
    const r032 = bundle.rules.find((r) => r.id === "R-032");
    if (!r032?.applies_to || Object.keys(r032.applies_to).length === 0 || inScope(sp, r032))
        return ["R-032", Math.trunc(frostFree)];
    if (sp.frost_tolerance == null)
        return inScopeUntiered(sp, r032) ? ["R-032", Math.trunc(frostFree)] : [null, null];
    if (!inScope(sp, bundle.rules.find((r) => r.id === "R-188")))
        return [null, null];
    const f = cropFreeze(site, key, bundle);
    if (f.line_f >= 32)
        return ["R-188", Math.trunc(frostFree)];
    if (!f.counted)
        return ["R-188", null];
    const a = mmddToDoy$1(site?.first_freeze_32f_p50), b = mmddToDoy$1(f.mmdd);
    return ["R-188", Math.trunc(frostFree) + (a && b ? (((b - a) % 365) + 365) % 365 : 0)];
}
function seasonRule(resolved, site, bundle) {
    const [frostFree, cl] = growingWindow(site, bundle);
    const sid = resolved.id, grp = resolved.cultivar_group;
    if (typeof sid !== "string" || !sid)
        return [null, null];
    return cropSeasonDays(cl, typeof grp === "string" && grp ? `${sid}/${grp}` : sid, bundle, frostFree);
}
function hardinessZone(site, bundle) {
    const z = site.hardiness_zone ?? site.zone;
    if (z !== null && z !== undefined)
        return z;
    if (site.lat == null || site.lon == null)
        return null;
    const hz = resolveZone(site.lat, site.lon, bundle);
    const zone = hz ? hz.zone : undefined;
    return zone ?? null;
}
function zoneSide(band, zone) {
    if (!band || !band.length || zone === null || zone === undefined)
        return null;
    const lo = band[0], hi = band[band.length - 1];
    if (zone < lo)
        return "below";
    if (zone > hi)
        return "above";
    return "in";
}
function perennialBand(resolved) {
    return resolved.lifespan === "annual" || resolved.lifespan === "biennial"
        ? undefined : resolved.hardiness_zone;
}
function advisories(resolved, site, bundle) {
    const out = [];
    const [seasonBy, windowDays] = seasonRule(resolved, site, bundle);
    const dtm = num$1(resolved.days_to_maturity);
    if (seasonBy === "R-188" && windowDays !== null && dtm !== null && dtm > windowDays) {
        out.push({ rule: "R-188", why: `needs ${gFmt(dtm)} days to mature; window to the first hard freeze is ${windowDays}` });
    }
    const hz = perennialBand(resolved);
    const zone = hardinessZone(site, bundle);
    if (zoneSide(hz, zone) === "above") {
        out.push({
            rule: "R-076",
            why: `zone ${zone} is above the modelled ${hz[0]}-${hz[hz.length - 1]}; the warm limit is a `
                + `cultivar's, so look for one rated for your zone`,
        });
    }
    for (const r of bundle.rules) {
        const t = (r.trigger ?? {});
        if (t.kind !== "prior_season_host" || !t.host || !t.pathogen)
            continue;
        const last = site.last_season_species ?? [];
        const path = resolved.pathogens;
        if (last.includes(t.host) && Array.isArray(path) && path.includes(t.pathogen)) {
            out.push({ rule: r.id, why: hostWhy(t, bundle) });
        }
    }
    const residue = site.allelopathic_residue ?? [];
    if (residue.length && smallSeededDirectSown(resolved)) {
        const who = residue.map((r) => `${r.species} - wait about ${r.lead_days} days after killing it`).join("; ");
        out.push({ rule: "R-144", why: `small seed sown into last season's allelopathic residue (${who}), or set transplants` });
    }
    return out;
}
function smallSeededDirectSown(resolved) {
    if (resolved.start_indoors_weeks !== undefined && resolved.start_indoors_weeks !== null)
        return false;
    const d = resolved.sowing_depth_cm;
    if (d === undefined || d === null)
        return false;
    const top = Array.isArray(d) ? Math.max(...d) : d;
    return typeof top === "number" && top <= 1.3;
}
function hostWhy(t, bundle) {
    const sp = bundle.species.find((x) => x.id === t.host);
    const common = sp?.common;
    const host = Array.isArray(common) && common.length ? String(common[0]) : String(t.host ?? "");
    return `last season's ${host} here can come back as volunteers carrying ${t.disease ?? t.pathogen ?? ""}`;
}
function rotationReasons(resolved, site, bundle) {
    const reasons = [];
    const fam = resolved.family;
    const byFamily = familyRotationRule(bundle);
    if (fam && fam in byFamily) {
        const base = familyRotationYears(bundle)[fam];
        if (base !== undefined && familyWithinInterval(site, fam, base)) {
            reasons.push({ rule: byFamily[fam], why: `ground carried ${fam}` });
        }
    }
    if (reasons.length) {
        const last = site.last_season_species ?? [];
        for (const r of [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
            const t = (r.trigger ?? {});
            if (t.kind !== "prior_season_host" || !t.host || !t.pathogen)
                continue;
            const path = resolved.pathogens;
            if (last.includes(t.host) && Array.isArray(path) && path.includes(t.pathogen)) {
                reasons.push({ rule: r.id, why: hostWhy(t, bundle) });
            }
        }
    }
    if (resolved.verticillium_susceptible) {
        const famPresent = everCarried(site).has("solanaceae");
        if (famPresent) {
            reasons.push({ rule: "R-094", why: `Verticillium-susceptible; ground held Solanaceae` });
        }
        else if (site.verticillium_reservoir) {
            reasons.push({ rule: "R-095", why: `Verticillium-susceptible; ground held a logged Verticillium host` });
        }
    }
    return reasons;
}
function ineligibility(resolved, role, site, bundle) {
    const reasons = [...rotationReasons(resolved, site, bundle)];
    const sid = resolved.id;
    if (sid && (role.excluded ?? []).includes(sid)) {
        reasons.push({ rule: role.exclusion_reason ?? null, why: `${sid} is excluded from this role` });
    }
    const [seasonBy, windowDays] = seasonRule(resolved, site, bundle);
    const dtm = num$1(resolved.days_to_maturity);
    if (seasonBy === "R-032" && windowDays !== null && dtm !== null && dtm > windowDays) {
        reasons.push({ rule: "R-032", why: `needs ${gFmt(dtm)} days to mature; window is ${windowDays}` });
    }
    if (resolved.light_min === "full_sun" && ![null, undefined, "full", "full_sun"].includes(site.sun)) {
        reasons.push({ rule: "R-005", why: `needs full sun; bed is ${pyStr(site.sun)}` });
    }
    const hz = perennialBand(resolved);
    const zone = hardinessZone(site, bundle);
    if (zoneSide(hz, zone) === "below") {
        reasons.push({
            rule: "R-076",
            why: `zone ${zone} is below the modelled ${hz[0]}-${hz[hz.length - 1]}; `
                + `colder than this plant is winter-hardy to`,
        });
    }
    return reasons;
}
function candidates(role) {
    const out = [];
    if (role.canonical)
        out.push([role.canonical, role.canonical_group ?? null, "canonical", {}]);
    if (role.substitute)
        out.push([role.substitute, null, "substitute", {}]);
    if (role.alternative)
        out.push([role.alternative, null, "alternative", {}]);
    for (const a of role.alternatives ?? []) {
        if (typeof a === "string")
            out.push([a, null, "alternative", {}]);
        else {
            const own = {};
            const rec = a;
            if ("cost" in rec)
                own.cost = rec.cost ?? null;
            if ("cost_tags" in rec)
                own.cost_tags = rec.cost_tags ?? [];
            out.push([a.species, a.group ?? null, "alternative", own]);
        }
    }
    return out;
}
function resolveRole(role, site, bundle) {
    const predicate = role.predicate ?? {};
    const canonicalFp = roleCanonicalFootprintM2(role, bundle);
    const options = [];
    for (const [sid, group, kind, own] of candidates(role)) {
        const resolved = resolveSpecies(sid, group, bundle);
        const reasons = ineligibility(resolved, role, site, bundle);
        const advs = advisories(resolved, site, bundle);
        const fp = speciesFootprintM2(resolved);
        const opt = {
            filler: sid,
            group,
            kind,
            eligible: reasons.length === 0,
            reasons,
            advisories: advs,
            cost: kind === "substitute"
                ? (role.cost ?? null)
                : kind === "alternative"
                    ? ("cost" in own ? (own.cost ?? null) : (role.alternative_cost ?? null))
                    : null,
            cost_tags: kind === "alternative" ? ("cost_tags" in own ? (own.cost_tags ?? []) : (role.cost_tags ?? [])) : [],
            footprint_m2: fp,
            extra_footprint_m2: round4$1(Math.max(0, fp - canonicalFp)),
        };
        if (kind === "canonical" && Object.keys(predicate).length) {
            const [ok, fails] = matches(resolved, predicate);
            if (!ok)
                opt.predicate_mismatch = fails;
        }
        options.push(opt);
    }
    const chosen = options.find((o) => o.eligible)?.filler ?? null;
    return {
        role: role.id,
        predicate,
        optional: Boolean(role.optional),
        canonical: role.canonical ?? null,
        chosen,
        options,
    };
}
const FILLINGS_CAP = 24;
function instantiate(guildOrId, site, bundle) {
    const guild = typeof guildOrId === "string" ? cx(bundle).guilds.get(guildOrId) : guildOrId;
    const bed = site.bed_m2;
    const fmin = guild.footprint_min_m2;
    const fitsFootprint = bed === null || bed === undefined || fmin === null || fmin === undefined || fmin <= bed;
    const roles = (guild.roles ?? []).map((r) => resolveRole(r, site, bundle));
    let incomplete = false;
    const pools = [];
    for (const rr of roles) {
        const picks = rr.options.filter((o) => o.eligible);
        if (!picks.length) {
            if (!rr.optional) {
                incomplete = true;
                break;
            }
            continue;
        }
        pools.push(picks.map((o) => [rr.role, o.filler]));
    }
    const fillings = [];
    const total = incomplete ? 0 : (pools.length ? pools.reduce((n, p) => n * p.length, 1) : 0);
    if (!incomplete) {
        const walk = (i, acc) => {
            if (fillings.length >= FILLINGS_CAP)
                return;
            if (i === pools.length) {
                fillings.push(Object.fromEntries(acc));
                return;
            }
            for (const pair of pools[i]) {
                if (fillings.length >= FILLINGS_CAP)
                    return;
                walk(i + 1, [...acc, pair]);
            }
        };
        walk(0, []);
    }
    return {
        guild: guild.id,
        fits_footprint: fitsFootprint,
        footprint_min_m2: fmin ?? null,
        footprint_reason: guild.footprint_reason ?? null,
        roles,
        fillings,
        fillings_total: total,
        fillings_truncated: total > fillings.length,
    };
}
function substitutionVerdict(guildOrId, roleId, filler, group, site, bundle) {
    const guild = typeof guildOrId === "string" ? cx(bundle).guilds.get(guildOrId) : guildOrId;
    const role = (guild.roles ?? []).find((r) => r.id === roleId);
    if (!role)
        throw new Error(`guild ${guild.id} has no role ${JSON.stringify(roleId)}`);
    const predicate = role.predicate ?? {};
    const resolved = resolveSpecies(filler, group, bundle);
    const [predicateOk, predicateFails] = matches(resolved, predicate);
    const siteReasons = ineligibility(resolved, role, site, bundle);
    const advs = advisories(resolved, site, bundle);
    const remediation = [];
    for (const [sid, g, kind] of candidates(role)) {
        if (sid === filler && g === group)
            continue;
        const rr = resolveSpecies(sid, g, bundle);
        const [rok] = matches(rr, predicate);
        if (rok && ineligibility(rr, role, site, bundle).length === 0) {
            remediation.push({ filler: sid, group: g, kind });
        }
    }
    const mechs = guild.mechanisms ?? [];
    const roleMechanisms = mechs
        .filter((m) => m.role === roleId)
        .map((m) => ({ claim: m.claim, grade: m.grade, rule: m.rule ?? null }));
    const fp = speciesFootprintM2(resolved);
    const canonicalFp = roleCanonicalFootprintM2(role, bundle);
    const extra = round4$1(Math.max(0, fp - canonicalFp));
    const fmin = guild.footprint_min_m2;
    const effectiveMin = fmin === null || fmin === undefined ? null : round4$1(fmin + extra);
    const bed = site.bed_m2;
    const footprintExceedsBed = bed !== null && bed !== undefined && effectiveMin !== null && effectiveMin > bed;
    const verdict = siteReasons.length ? "blocked" : (predicateOk ? "clean" : "adaptation");
    return {
        guild: guild.id, role: roleId, filler, group,
        canonical: role.canonical ?? null,
        predicate, predicate_ok: predicateOk, predicate_fails: predicateFails,
        site_reasons: siteReasons, advisories: advs, verdict, mechanism_risk: verdict === "adaptation",
        role_mechanisms: roleMechanisms,
        footprint_m2: fp, extra_footprint_m2: extra,
        effective_footprint_min_m2: effectiveMin, footprint_exceeds_bed: footprintExceedsBed,
        remediation,
    };
}
function thinBreakSuggestion(site, bundle) {
    const rule = bundle.rules.find((r) => r.id === "R-013");
    if (!rule)
        return null;
    const years = familyRotationYears(bundle);
    const breaks = breakFamilies(bundle);
    const blockedFams = Object.keys(familyRotationRule(bundle)).filter((fam) => breaks.has(fam) && years[fam] !== undefined && familyWithinInterval(site, fam, years[fam]));
    if (!blockedFams.length)
        return null;
    const suggests = (rule.trigger?.suggests) ?? [];
    return {
        rule: "R-013",
        families: suggests,
        why: `ground is within the rotation interval for ${[...blockedFams].sort().join(", ")}; ` +
            `an allium or apiaceous crop is unrelated to all three and breaks the host cycle`,
    };
}
function priorSeasonCredit(site, bundle) {
    const rule = bundle.rules.find((r) => r.id === "R-015");
    const history = site.history;
    if (!rule || !history || typeof history !== "object" || Array.isArray(history))
        return null;
    const cur = currentPlantingYear(site);
    const fam = rule.trigger?.family;
    if (cur === null || !fam)
        return null;
    for (const [key, fams] of Object.entries(history)) {
        if (parseYear(key) !== cur - 1)
            continue;
        if (historyFamilies(fams).some(([f]) => f === fam)) {
            return { rule: "R-015",
                why: `${fam} grew here in ${cur - 1}; residue mineralizes N for this season's crop` };
        }
    }
    return null;
}
function heldRotationFamilies(base, history, year, bundle) {
    const site = { ...base, history, season_year: year };
    const e = eligibleSpecies(site, bundle);
    const rules = rotationRules(bundle);
    const held = new Set();
    for (const b of e.blocked) {
        if (b.family && b.blocked_by.some((r) => r.rule !== null && rules.has(r.rule)))
            held.add(b.family);
    }
    return held;
}
function eligibleSpecies(site, bundle) {
    const c = cx(bundle);
    const eligible = [];
    const blocked = [];
    for (const sid of [...c.species.keys()].sort()) {
        const resolved = resolveSpecies(sid, null, bundle);
        const reasons = rotationReasons(resolved, site, bundle);
        if (reasons.length) {
            blocked.push({ species: sid, family: resolved.family ?? null, blocked_by: reasons });
        }
        else {
            eligible.push(sid);
        }
    }
    const sug = thinBreakSuggestion(site, bundle);
    return { eligible, blocked, suggestions: sug ? [sug] : [] };
}

const RESERVED_SHAPES = new Set(["circle", "radial_rings"]);
function parseRegion(raw) {
    const r = raw;
    const shape = r?.shape;
    if (shape === "polygon") {
        const pts = r.points;
        const ok = Array.isArray(pts) && pts.length >= 3 && pts.every((p) => Array.isArray(p) && p.length === 2
            && typeof p[0] === "number" && Number.isFinite(p[0])
            && typeof p[1] === "number" && Number.isFinite(p[1]));
        if (!ok)
            throw new Error(`polygon region needs at least 3 finite [x, y] points, got ${JSON.stringify(raw)}`);
        const points = pts.map((p) => [p[0], p[1]]);
        if (!isSimplePolygon(points)) {
            throw new Error(`polygon region must not self-intersect or touch itself, got ${JSON.stringify(raw)}`);
        }
        if (polygonArea(points) <= 0)
            throw new Error(`polygon region has zero area, got ${JSON.stringify(raw)}`);
        return { shape: "polygon", points };
    }
    if (shape !== "rect") {
        if (typeof shape === "string" && RESERVED_SHAPES.has(shape)) {
            throw new Error(`region shape "${shape}" is reserved but not implemented (D-015)`);
        }
        throw new Error(`unknown region shape ${JSON.stringify(shape)}`);
    }
    const nums = [r.x, r.y, r.w, r.h].map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
    if (nums.some((v) => v === null) || nums[2] < 0 || nums[3] < 0) {
        throw new Error(`rect region needs finite x/y and non-negative w/h, got ${JSON.stringify(raw)}`);
    }
    return { shape: "rect", x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}
function area(r) {
    if (r.shape === "radial_rings")
        return Math.PI * r.r * r.r;
    if (r.shape === "polygon")
        return polygonArea(r.points);
    return r.w * r.h;
}
function minReachSpanM(r) {
    if (r.shape === "polygon") {
        const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1]);
        return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }
    return Math.min(r.w, r.h);
}
function intersectArea(a, b) {
    if (a.shape === "rect" && b.shape === "rect") {
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return w > 0 && h > 0 ? w * h : 0;
    }
    return polygonIntersectArea(regionPoints(a), regionPoints(b));
}
const EPS = 1e-9;
function signedArea2(pts) {
    let s = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        s += x1 * y2 - x2 * y1;
    }
    return s;
}
function polygonArea(pts) {
    return Math.abs(signedArea2(pts)) / 2;
}
function cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}
function segmentsTouch(p, q, r, s) {
    const d1 = cross(p[0], p[1], q[0], q[1], r[0], r[1]);
    const d2 = cross(p[0], p[1], q[0], q[1], s[0], s[1]);
    const d3 = cross(r[0], r[1], s[0], s[1], p[0], p[1]);
    const d4 = cross(r[0], r[1], s[0], s[1], q[0], q[1]);
    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS))
        && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS)))
        return true;
    const onSegment = (a, b, c, d) => Math.abs(d) <= EPS
        && Math.min(a[0], b[0]) - EPS <= c[0] && c[0] <= Math.max(a[0], b[0]) + EPS
        && Math.min(a[1], b[1]) - EPS <= c[1] && c[1] <= Math.max(a[1], b[1]) + EPS;
    return onSegment(p, q, r, d1) || onSegment(p, q, s, d2)
        || onSegment(r, s, p, d3) || onSegment(r, s, q, d4);
}
function isSimplePolygon(pts) {
    const n = pts.length;
    if (n < 3)
        return false;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (j === i + 1 || (i === 0 && j === n - 1))
                continue;
            if (segmentsTouch(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]))
                return false;
        }
    }
    return true;
}
function pointInTri(p, a, b, c) {
    return cross(a[0], a[1], b[0], b[1], p[0], p[1]) >= -EPS
        && cross(b[0], b[1], c[0], c[1], p[0], p[1]) >= -EPS
        && cross(c[0], c[1], a[0], a[1], p[0], p[1]) >= -EPS;
}
function triangulate(pts) {
    const order = pts.map((_, i) => i);
    if (signedArea2(pts) < 0)
        order.reverse();
    const tris = [];
    while (order.length > 3) {
        const n = order.length;
        let clipped = false;
        for (let k = 0; k < n; k++) {
            const ia = order[(k - 1 + n) % n], ib = order[k], ic = order[(k + 1) % n];
            const a = pts[ia], b = pts[ib], c = pts[ic];
            const cr = cross(a[0], a[1], b[0], b[1], c[0], c[1]);
            if (Math.abs(cr) <= EPS) {
                order.splice(k, 1);
                clipped = true;
                break;
            }
            if (cr < 0)
                continue;
            if (order.some((j) => j !== ia && j !== ib && j !== ic && pointInTri(pts[j], a, b, c)))
                continue;
            tris.push([a, b, c]);
            order.splice(k, 1);
            clipped = true;
            break;
        }
        if (!clipped)
            throw new Error("triangulation failed - polygon is not simple");
    }
    if (order.length === 3) {
        const a = pts[order[0]], b = pts[order[1]], c = pts[order[2]];
        if (Math.abs(cross(a[0], a[1], b[0], b[1], c[0], c[1])) > EPS)
            tris.push([a, b, c]);
    }
    return tris;
}
function isect(a, b, p, q) {
    const dp = cross(a[0], a[1], b[0], b[1], p[0], p[1]);
    const dq = cross(a[0], a[1], b[0], b[1], q[0], q[1]);
    const t = dp / (dp - dq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}
function convexClip(subject, clip) {
    let out = [...subject];
    const m = clip.length;
    for (let i = 0; i < m; i++) {
        if (!out.length)
            return [];
        const a = clip[i], b = clip[(i + 1) % m];
        const prev = out;
        out = [];
        for (let j = 0; j < prev.length; j++) {
            const p = prev[j], q = prev[(j + 1) % prev.length];
            const pin = cross(a[0], a[1], b[0], b[1], p[0], p[1]) >= -EPS;
            const qin = cross(a[0], a[1], b[0], b[1], q[0], q[1]) >= -EPS;
            if (pin) {
                out.push(p);
                if (!qin)
                    out.push(isect(a, b, p, q));
            }
            else if (qin) {
                out.push(isect(a, b, p, q));
            }
        }
    }
    return out;
}
function polygonIntersectArea(aPts, bPts) {
    const bTris = triangulate(bPts);
    let total = 0;
    for (const ta of triangulate(aPts)) {
        for (const tb of bTris) {
            const piece = convexClip([...ta], [...tb]);
            if (piece.length >= 3) {
                const pieceArea = polygonArea(piece);
                if (pieceArea > EPS)
                    total += pieceArea;
            }
        }
    }
    return total;
}
function rectPoints(r) {
    const { x, y, w, h } = r;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
function regionPoints(r) {
    return r.shape === "polygon" ? r.points.map((p) => [p[0], p[1]]) : rectPoints(r);
}
function polygonCentroid(pts) {
    const a2 = signedArea2(pts);
    const n = pts.length;
    if (Math.abs(a2) <= EPS) {
        let sx = 0, sy = 0;
        for (const p of pts) {
            sx += p[0];
            sy += p[1];
        }
        return [sx / n, sy / n];
    }
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        const w = x1 * y2 - x2 * y1;
        cx += (x1 + x2) * w;
        cy += (y1 + y2) * w;
    }
    return [cx / (3 * a2), cy / (3 * a2)];
}
function regionCentroid(r) {
    return r.shape === "polygon" ? polygonCentroid(r.points) : [r.x + r.w / 2, r.y + r.h / 2];
}
function radialRingsFromFootprint(footprintMinM2, cx = 0, cy = 0) {
    if (!Number.isFinite(footprintMinM2) || footprintMinM2 <= 0)
        return null;
    return { shape: "radial_rings", cx, cy, r: Math.sqrt(footprintMinM2 / Math.PI) };
}
function circleFitsRect(ring, bedWm, bedLm) {
    return 2 * ring.r <= bedWm && 2 * ring.r <= bedLm;
}
function fitDiagram(bedWm, bedLm, footprintMinM2) {
    if (!Number.isFinite(bedWm) || !Number.isFinite(bedLm) || bedWm <= 0 || bedLm <= 0)
        return null;
    const bed = { shape: "rect", x: 0, y: 0, w: bedWm, h: bedLm };
    if (footprintMinM2 == null || footprintMinM2 <= 0)
        return { bed, footprint: null, overflow: false };
    const ratio = Math.sqrt(footprintMinM2 / (bedWm * bedLm));
    return {
        bed,
        footprint: { shape: "rect", x: 0, y: 0, w: bedWm * ratio, h: bedLm * ratio },
        overflow: ratio > 1,
    };
}
const ADJACENT_MAX_GAP_M = 0.6;
function segDist(p, a, b) {
    const [ax, ay] = a, [bx, by] = b, [px, py] = p;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    if (L2 <= EPS)
        return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function regionGapM(a, b) {
    if (a.shape === "rect" && b.shape === "rect") {
        const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
        const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
        return Math.hypot(dx, dy);
    }
    const pa = regionPoints(a), pb = regionPoints(b);
    if (polygonIntersectArea(pa, pb) > 0)
        return 0;
    let best = Infinity;
    for (const [pts, other] of [[pa, pb], [pb, pa]]) {
        const n = other.length;
        for (const p of pts) {
            for (let i = 0; i < n; i++) {
                const d = segDist(p, other[i], other[(i + 1) % n]);
                if (d < best)
                    best = d;
            }
        }
    }
    return best;
}
function adjacent(a, b) {
    return regionGapM(a, b) <= ADJACENT_MAX_GAP_M;
}

const MIN_ALTITUDE_DEG = 3.0;
const DEG2RAD = Math.PI / 180.0;
function solarDeclinationDeg$1(dayOfYear) {
    return 23.45 * Math.sin(DEG2RAD * (360.0 * (284 + dayOfYear)) / 365.0);
}
function daylightHours(latDeg, dayOfYear) {
    const decl = solarDeclinationDeg$1(dayOfYear);
    const x = -Math.tan(DEG2RAD * latDeg) * Math.tan(DEG2RAD * decl);
    if (x <= -1)
        return 24;
    if (x >= 1)
        return 0;
    const h0Deg = Math.acos(x) / DEG2RAD;
    return Math.floor((2 * h0Deg / 15) * 1e4 + 0.5) / 1e4;
}
function noonAltitudeDeg(latDeg, dayOfYear) {
    const alt = 90.0 - Math.abs(latDeg - solarDeclinationDeg$1(dayOfYear));
    return Math.max(alt, 0.0);
}
function polarIsNorth(latDeg) {
    return latDeg >= 0.0;
}
function noonShadowLengthM(heightCm, latDeg, dayOfYear) {
    const alt = noonAltitudeDeg(latDeg, dayOfYear);
    if (alt < MIN_ALTITUDE_DEG)
        return Infinity;
    return heightCm / 100.0 / Math.tan(DEG2RAD * alt);
}
function sameTeam(a, b, inner) {
    if (!a.team || a.team !== b.team)
        return false;
    inner?.add(a.team);
    return true;
}
function heightCm$1(plant) {
    const h = plant.height_cm;
    return Array.isArray(h) ? Number(h[h.length - 1]) : Number(h);
}
function footprintRect(plant) {
    const half = (plant.footprint_m ?? 0.3) / 2.0;
    return [plant.x - half, plant.y - half, plant.x + half, plant.y + half];
}
function shadowPolygon(plant, latDeg, dayOfYear) {
    const height = heightCm$1(plant);
    if (height <= 0)
        return null;
    let length = noonShadowLengthM(height, latDeg, dayOfYear);
    const [x0, y0, x1, y1] = footprintRect(plant);
    if (!Number.isFinite(length))
        length = 1e6;
    if (polarIsNorth(latDeg))
        return [x0, y1, x1, y1 + length];
    return [x0, y0 - length, x1, y0];
}
function boxesOverlap(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
function heightOrderingViolations(plants, thresholdCm, latDeg, inner) {
    const north = polarIsNorth(latDeg);
    const polarness = (p) => (north ? p.y : -p.y);
    const out = [];
    for (const tall of plants) {
        const th = heightCm$1(tall);
        if (th <= thresholdCm)
            continue;
        for (const shorter of plants) {
            if (shorter === tall)
                continue;
            if (shorter.sheltered)
                continue;
            if (heightCm$1(shorter) < th && polarness(shorter) > polarness(tall)) {
                if (sameTeam(tall, shorter, inner))
                    continue;
                out.push({ tall: tall.id, shorter: shorter.id, tall_height_cm: th, shorter_height_cm: heightCm$1(shorter) });
            }
        }
    }
    return out;
}
function shadowIntersections(plants, latDeg, dayOfYear, inner) {
    const out = [];
    for (const target of plants) {
        if (!target.needs_sun)
            continue;
        const tfoot = footprintRect(target);
        const th = heightCm$1(target);
        for (const caster of plants) {
            if (caster === target || heightCm$1(caster) <= th)
                continue;
            if (!("casts_shade" in caster ? caster.casts_shade : true))
                continue;
            const shade = shadowPolygon(caster, latDeg, dayOfYear);
            if (shade && boxesOverlap(shade, tfoot) && !sameTeam(caster, target, inner))
                out.push({ target: target.id, caster: caster.id, shadow: shade });
        }
    }
    return out;
}
function shelterIntersections(plants, latDeg, dayOfYear) {
    const out = [];
    for (const target of plants) {
        if (!target.sheltered)
            continue;
        const tfoot = footprintRect(target);
        const th = heightCm$1(target);
        for (const caster of plants) {
            if (caster === target || heightCm$1(caster) <= th)
                continue;
            if (!("casts_shade" in caster ? caster.casts_shade : true))
                continue;
            const shade = shadowPolygon(caster, latDeg, dayOfYear);
            if (shade && boxesOverlap(shade, tfoot))
                out.push({ target: target.id, caster: caster.id, shadow: shade });
        }
    }
    return out;
}
function shelteredByShadow(resolved, shelters) {
    if (!shelters || !Object.keys(shelters).length)
        return false;
    if (shelters.bolt_risk === "present" && !resolved.bolt_risk)
        return false;
    if ("light_min" in shelters && resolved.light_min !== shelters.light_min)
        return false;
    return true;
}
function shelterPredicate(bundle) {
    const r156 = bundle.rules.find((r) => r.id === "R-156");
    return r156?.trigger?.shelters ?? {};
}
const MONTH_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function mmddToDoy(s) {
    if (typeof s !== "string")
        return null;
    const month = parseInt(s.slice(0, 2), 10);
    const day = parseInt(s.slice(3, 5), 10);
    if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12)
        return null;
    return MONTH_CUM[month - 1] + day;
}
function referenceDoy(lat, lon, bundle) {
    const cl = scheduleSite(lat, lon, bundle);
    if (cl) {
        const lf = mmddToDoy(cl.last_frost_32f?.p50);
        let ff = mmddToDoy(cl.first_freeze_32f_p50);
        if (lf !== null && ff !== null) {
            if (ff < lf)
                ff += 365;
            return ((Math.floor((lf + ff) / 2) - 1) % 365) + 1;
        }
    }
    return lat !== null && lat < 0 ? 355 : 172;
}
const maxNum$1 = (v) => {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    return x === null || x === undefined ? null : Number(x);
};
function geometryRules(layout, site, bundle, inner) {
    const lat = site.lat;
    if (!layout || !layout.length || lat === null || lat === undefined)
        return [];
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const r003Trigger = ruleById.get("R-003")?.trigger;
    const shelters = shelterPredicate(bundle);
    const honourShelter = r003Trigger?.sheltered_by === "R-156";
    const plants = [];
    for (const item of layout) {
        const r = resolveSpecies(item.species, item.group ?? null, bundle);
        const height = r.mature_height_cm;
        if (height === null || height === undefined)
            continue;
        const spread = maxNum$1(r.mature_spread_cm);
        const plant = {
            id: item.species,
            x: item.x,
            y: item.y,
            height_cm: height,
            footprint_m: spread ? spread / 100.0 : 0.3,
            needs_sun: r.light_min === "full_sun",
            sheltered: honourShelter && shelteredByShadow(r, shelters),
            team: item.team ?? null,
        };
        if ("casts_shade" in r)
            plant.casts_shade = r.casts_shade;
        else
            plant.casts_shade = true;
        plants.push(plant);
    }
    const fired = (rule, subject, why) => ({
        rule,
        ruling: String(ruleById.get(rule)?.derived_ruling ?? ""),
        subject,
        why,
    });
    const out = [];
    const threshold = r003Trigger?.threshold_cm ?? 120;
    for (const v of heightOrderingViolations(plants, threshold, lat, inner)) {
        out.push(fired("R-003", [v.tall, v.shorter], `${v.tall} (${gFmt(v.tall_height_cm)} cm) sits equatorward of shorter ${v.shorter} (${gFmt(v.shorter_height_cm)} cm)`));
    }
    const doy = referenceDoy(lat, site.lon ?? null, bundle);
    for (const hit of shadowIntersections(plants, lat, doy, inner)) {
        out.push(fired("R-004", [hit.target], `${hit.target} sits in the computed noon shadow of ${hit.caster}`));
    }
    if (Object.keys(shelters).length && ruleById.has("R-156")) {
        for (const hit of shelterIntersections(plants, lat, doy)) {
            out.push(fired("R-156", [hit.target], `${hit.target} sits in the computed noon shadow of ${hit.caster}, the summer shade it wants`));
        }
    }
    return out;
}

function heightCm(p) {
    const h = p.height_cm;
    if (Array.isArray(h))
        return h[h.length - 1];
    return h != null ? h : 0;
}
function spreadCm(p) {
    let s = p.spread_cm;
    if (Array.isArray(s))
        s = s.length ? s[s.length - 1] : undefined;
    let spread = s != null ? s : 30;
    if (spread < 30)
        spread = 30;
    return spread;
}
function count(p) {
    const c = Math.trunc(Number(p.count));
    return Number.isFinite(c) && c >= 1 ? c : 1;
}
function weight(p, capCm) {
    let s = spreadCm(p);
    if (capCm !== undefined)
        s = Math.min(s, capCm);
    return count(p) * s * s;
}
const round4 = (x) => Math.floor(x * 1e4 + 0.5) / 1e4;
function ringIndex(p) {
    if (p.ring == null)
        return null;
    const r = Math.trunc(Number(p.ring));
    return Number.isFinite(r) ? r : null;
}
function ringPositions(cx, cy, radius, cnt, spreadCmVal, angle0 = 0) {
    const pr = Math.max(spreadCmVal / 100, 0.30) / 2;
    const cells = [];
    if (radius <= 1e-9) {
        if (cnt <= 1)
            return [{ x: round4(cx), y: round4(cy), r: round4(pr) }];
        const cluster = pr < 0.35 ? pr : 0.35;
        for (let k = 0; k < cnt; k++) {
            const a = angle0 + 2 * Math.PI * k / cnt;
            cells.push({ x: round4(cx + cluster * Math.cos(a)), y: round4(cy + cluster * Math.sin(a)), r: round4(pr) });
        }
        return cells;
    }
    for (let k = 0; k < cnt; k++) {
        const a = angle0 + 2 * Math.PI * k / cnt;
        cells.push({ x: round4(cx + radius * Math.cos(a)), y: round4(cy + radius * Math.sin(a)), r: round4(pr) });
    }
    return cells;
}
function placeRings(plants, region) {
    const reg = region;
    const R = Number(reg.r ?? 0);
    const cx = Number(reg.cx ?? 0);
    const cy = Number(reg.cy ?? 0);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const indexed = ordered.map((p, i) => [ringIndex(p) ?? i, p]);
    const maxRing = indexed.reduce((m, [ri]) => Math.max(m, ri), 0);
    indexed.sort((A, B) => A[0] - B[0] || heightCm(B[1]) - heightCm(A[1]) || String(A[1].id).localeCompare(String(B[1].id)));
    let canopyPr = 0;
    for (const [ri, p] of indexed) {
        if (ri <= 0)
            canopyPr = Math.max(canopyPr, Math.max(spreadCm(p) / 100, 0.30) / 2);
    }
    const base = R > 0 ? Math.min(canopyPr, 0.6 * R) : 0;
    const zones = indexed.map(([ri, p]) => {
        const cnt = count(p);
        let radius = ri <= 0 ? 0 : base + (R - base) * ri / Math.max(1, maxRing);
        const pr = Math.max(spreadCm(p) / 100, 0.30) / 2;
        if (radius + pr > R)
            radius = R > pr + 0.0001 ? R - pr - 0.0001 : 0;
        return {
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cnt * (spreadCm(p) / 100) ** 2),
            centroid: [round4(cx), round4(cy)], height_cm: heightCm(p),
            count: cnt, plants: ringPositions(cx, cy, radius, cnt, spreadCm(p), ri <= 0 ? 0 : (2.399963229728653 * ri) % (2 * Math.PI)),
            ring: { cx: round4(cx), cy: round4(cy), r: round4(radius) },
        };
    });
    return { polar: "radial", zones, violations: [] };
}
function mostInteriorPoint(pts, rx0, width, yLo, height) {
    let best = null, bestD2 = 0;
    for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
            const x = rx0 + (i + 0.5) * width / 25;
            const y = yLo + (j + 0.5) * height / 25;
            if (pointInPolygon(pts, x, y)) {
                const d2 = minEdgeDistSq(pts, x, y);
                if (d2 > bestD2) {
                    bestD2 = d2;
                    best = [x, y];
                }
            }
        }
    }
    return { best, d2: bestD2 };
}
function circleFitsRegion(ring, region) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), w = Math.max(...xs) - rx0;
    const y0 = Math.min(...ys), h = Math.max(...ys) - y0;
    if (region.shape !== "polygon")
        return circleFitsRect({ r: ring.r }, w, h);
    const { d2 } = mostInteriorPoint(pts, rx0, w, y0, h);
    return d2 >= ring.r * ring.r;
}
function placeOrchard(plants, region, treeR) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const clipPts = region.shape === "polygon" ? pts : null;
    const canopyDia = plants.reduce((mx, p) => Math.max(mx, spreadCm(p) / 100), 0);
    const spacing = treeR > 0 ? Math.max(2 * treeR, canopyDia) : Math.max(width, height);
    const ncols = spacing > 0 ? Math.max(1, Math.trunc(width / spacing)) : 1;
    const nrows = spacing > 0 ? Math.max(1, Math.trunc(height / spacing)) : 1;
    const cellW = width / ncols, cellH = height / nrows;
    const treeCenters = [];
    for (let r = 0; r < nrows; r++) {
        const n = hexRowCap(ncols, r);
        const xstart = rx0 + (width - n * cellW) / 2;
        for (let c = 0; c < n; c++) {
            const tx = xstart + (c + 0.5) * cellW, ty = yLo + (r + 0.5) * cellH;
            if (clipPts === null || pointInPolygon(clipPts, tx, ty))
                treeCenters.push([tx, ty]);
        }
    }
    if (!treeCenters.length && clipPts !== null) {
        const { best } = mostInteriorPoint(pts, rx0, width, yLo, height);
        if (best)
            treeCenters.push(best);
    }
    const ntrees = treeCenters.length;
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const indexed = ordered.map((p, i) => [ringIndex(p) ?? i, p]);
    const maxRing = indexed.reduce((m, [ri]) => Math.max(m, ri), 0);
    indexed.sort((A, B) => A[0] - B[0] || heightCm(B[1]) - heightCm(A[1]) || String(A[1].id).localeCompare(String(B[1].id)));
    const rOuter = treeR > 0 ? 0.9 * Math.min(treeR, 0.5 * Math.min(cellW, cellH)) : 0;
    const zones = [];
    const ringsGuide = [];
    const seen = new Set();
    for (const [ri, p] of indexed) {
        const radius = ri <= 0 ? 0 : rOuter * ri / Math.max(1, maxRing);
        const perTree = ri <= 0 ? treeCenters.map(() => 1) : evenPick(count(p), ntrees);
        const cells = [];
        for (let ti = 0; ti < ntrees; ti++) {
            const nHere = perTree[ti];
            if (nHere <= 0)
                continue;
            const [tx, ty] = treeCenters[ti];
            const canopy = radius <= 1e-9;
            for (const cell of ringPositions(tx, ty, radius, nHere, spreadCm(p))) {
                const keep = canopy
                    ? pointInPolygon(pts, cell.x, cell.y)
                    : clipPts !== null
                        ? dotInPolygon(pts, cell.x, cell.y, cell.r)
                        : (pointInPolygon(pts, cell.x, cell.y)
                            && rx0 + cell.r <= cell.x && cell.x <= rx1 - cell.r
                            && yLo + cell.r <= cell.y && cell.y <= yHi - cell.r);
                if (keep)
                    cells.push(cell);
            }
            const key = `${ti}:${round4(radius)}`;
            if (radius > 1e-9 && !seen.has(key)) {
                seen.add(key);
                ringsGuide.push({ cx: round4(tx), cy: round4(ty), r: round4(radius) });
            }
        }
        const cx = cells.length ? cells.reduce((s, cc) => s + cc.x, 0) / cells.length : (rx0 + rx1) / 2;
        const cy = cells.length ? cells.reduce((s, cc) => s + cc.y, 0) / cells.length : (yLo + yHi) / 2;
        zones.push({
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: [round4(cx), round4(cy)], height_cm: heightCm(p),
            count: cells.length, plants: cells,
        });
    }
    const trees = treeCenters.map(([tx, ty]) => ({ cx: round4(tx), cy: round4(ty) }));
    return { polar: "orchard", zones, violations: [], trees, rings_guide: ringsGuide };
}
const MIN_ROW_SPACING_M = 0.30;
const HILL_SPACING_M = 1.0;
const HILL_CLUSTER_R = 0.2;
const MOUND_GUIDE_R = 0.35;
const ALLEY_PERIOD = 3;
function isMound(p) {
    return Boolean(p.mound);
}
function evenPick(n, k) {
    if (k <= 0)
        return [];
    const out = [];
    for (let i = 0; i < k; i++)
        out.push(Math.floor((i + 1) * n / k) - Math.floor(i * n / k));
    return out;
}
function moundCap(sp) {
    const c = Math.trunc(Number(sp.mound_cap));
    return Number.isFinite(c) && c > 0 ? c : 0;
}
function clusterFitR(x, y, pr, rx0, rx1, yLo, yHi, clipPts) {
    let room;
    if (clipPts !== null) {
        const d2 = minEdgeDistSq(clipPts, x, y);
        if (d2 >= pr * pr - 1e-9)
            return pr;
        room = Math.sqrt(d2) - 0.01;
    }
    else {
        room = Math.min(x - rx0, rx1 - x, y - yLo, yHi - y);
        if (room >= pr - 1e-9)
            return pr;
        room -= 0.01;
    }
    const floor = pr * EDGE_MIN_FRAC;
    return room > floor ? room : floor;
}
function hillCells(centers, species, clusterR, rx0, rx1, yLo, yHi, clipPts) {
    const k = centers.length;
    const alloc = new Map();
    for (const sp of species) {
        const cap = moundCap(sp);
        alloc.set(sp.id, evenPick(count(sp), k).map((a) => (cap ? Math.min(a, cap) : a)));
    }
    const cells = new Map();
    for (const sp of species)
        cells.set(sp.id, []);
    for (let ci = 0; ci < centers.length; ci++) {
        const [hx, hy] = centers[ci];
        const tokens = [];
        for (const sp of species) {
            const n = alloc.get(sp.id)[ci];
            for (let t = 0; t < n; t++)
                tokens.push(sp);
        }
        const m = tokens.length;
        for (let j = 0; j < m; j++) {
            const sp = tokens[j];
            const pr = Math.max(spreadCm(sp) / 100, 0.30) / 2;
            let x, y;
            if (m <= 1) {
                x = round4(hx);
                y = round4(hy);
            }
            else {
                const a = 2 * Math.PI * j / m;
                x = round4(hx + clusterR * Math.cos(a));
                y = round4(hy + clusterR * Math.sin(a));
            }
            cells.get(sp.id).push({ x, y, r: round4(clusterFitR(x, y, pr, rx0, rx1, yLo, yHi, clipPts)) });
        }
    }
    return cells;
}
function meanCentroid(cells, fallback) {
    if (!cells.length)
        return [round4(fallback[0]), round4(fallback[1])];
    let sx = 0, sy = 0;
    for (const c of cells) {
        sx += c.x;
        sy += c.y;
    }
    return [round4(sx / cells.length), round4(sy / cells.length)];
}
function interleave(gapSpecies) {
    const remaining = gapSpecies.map((sp) => [String(sp.id), count(sp)]);
    const tokens = [];
    while (remaining.some(([, c]) => c > 0)) {
        for (const pair of remaining) {
            if (pair[1] > 0) {
                tokens.push(pair[0]);
                pair[1] -= 1;
            }
        }
    }
    return tokens;
}
function evenIndex(j, k, n) {
    if (k <= 1)
        return Math.floor((n - 1) / 2);
    return Math.floor((j * (n - 1) + Math.floor((k - 1) / 2)) / (k - 1));
}
function spreadAssign(counts, p) {
    const total = counts.reduce((s, c) => s + c, 0);
    const cap = Math.min(p, total);
    const placed = counts.map(() => 0);
    const out = [];
    for (let i = 0; i < cap; i++) {
        let best = -1, bestNum = 0;
        for (let j = 0; j < counts.length; j++) {
            if (placed[j] >= counts[j])
                continue;
            const num = counts[j] * (i + 1) - placed[j] * total;
            if (best < 0 || num > bestNum) {
                best = j;
                bestNum = num;
            }
        }
        if (best < 0)
            break;
        out.push(best);
        placed[best] += 1;
    }
    return out;
}
function gapPlantCells(gapSpecies, hillCenters, ncols, nrows, rx0, rx1, yLo, yHi, cellW, cellH, clipPts, alley, laneAxis, moundR) {
    const cells = new Map();
    for (const sp of gapSpecies)
        cells.set(String(sp.id), []);
    const total = gapSpecies.reduce((s, sp) => s + count(sp), 0);
    if (total <= 0 || !gapSpecies.length)
        return cells;
    const nc = ncols - 1, nr = nrows - 1;
    let points = [];
    let dotR = round4(Math.min(cellW, cellH) * 0.30);
    const laneLo0 = laneAxis === "x" ? rx0 : yLo;
    const laneCellSpan = laneAxis === "x" ? cellW : cellH;
    const laneSpans = [...alley].sort((a, b) => a - b).map((i) => [laneLo0 + i * laneCellSpan, laneLo0 + (i + 1) * laneCellSpan]);
    const inLane = (x, y, r) => {
        const v = laneAxis === "x" ? x : y;
        const m = Math.min(r, PATH_INSET_MAX_M);
        return laneSpans.some(([lo, hi]) => v + m > lo && v - m < hi);
    };
    const ringPoints = () => {
        dotR = round4(Math.min(cellW, cellH) * 0.12);
        const ringR = moundR + dotR + 0.05;
        const alloc = hillCenters.length ? evenPick(total, hillCenters.length) : [];
        for (let mi = 0; mi < hillCenters.length; mi++) {
            const [hx, hy] = hillCenters[mi];
            const k = alloc[mi];
            for (let m = 0; m < k; m++) {
                const a = 2 * Math.PI * (m + 0.5) / k;
                for (let s = 0; s < RING_SWEEP_STEPS; s++) {
                    const aa = a + 2 * Math.PI * s / RING_SWEEP_STEPS;
                    const x = round4(hx + ringR * Math.cos(aa)), y = round4(hy + ringR * Math.sin(aa));
                    if (rx0 + dotR <= x && x <= rx1 - dotR && yLo + dotR <= y && y <= yHi - dotR
                        && !inLane(x, y, dotR)
                        && (clipPts === null || dotInPolygon(clipPts, x, y, dotR))) {
                        points.push([x, y, dotR]);
                        break;
                    }
                }
            }
        }
    };
    const gapFitR = (x, y) => {
        const d = hillCenters.length
            ? Math.min(...hillCenters.map(([hx, hy]) => Math.hypot(x - hx, y - hy))) : Infinity;
        const room = d - (moundR - 0.01);
        if (room >= dotR - 1e-9)
            return dotR;
        const rr = room - 0.01;
        const floor = dotR * EDGE_MIN_FRAC;
        return rr > floor ? rr : null;
    };
    if (nc >= 1 && nr >= 1) {
        const safeR = [];
        for (let r = 0; r < nr; r++)
            if (laneAxis !== "y" || (!alley.has(r) && !alley.has(r + 1)))
                safeR.push(r);
        const safeC = [];
        for (let c = 0; c < nc; c++)
            if (laneAxis !== "x" || (!alley.has(c) && !alley.has(c + 1)))
                safeC.push(c);
        let gapTarget = total;
        if (clipPts !== null) {
            const ca = polygonArea(clipPts);
            if (ca > 0) {
                const ratio = ((rx1 - rx0) * (yHi - yLo)) / ca;
                if (ratio > 1.0 + 1e-9)
                    gapTarget = Math.ceil(total * ratio);
            }
        }
        if (safeC.length && safeR.length) {
            let [gc, gr] = gridDims(gapTarget, 1.0, safeC.length, safeR.length);
            gc = Math.min(gc, safeC.length);
            gr = Math.min(gr, safeR.length);
            for (let k = 0; k < gr; k++) {
                const r = safeR[evenIndex(k, gr, safeR.length)];
                for (let j = 0; j < gc; j++) {
                    const c = safeC[evenIndex(j, gc, safeC.length)];
                    const x = rx0 + (c + 1) * cellW, y = yLo + (r + 1) * cellH;
                    const rr = gapFitR(x, y);
                    if (rr !== null && (clipPts === null || dotInPolygon(clipPts, x, y, rr)))
                        points.push([round4(x), round4(y), round4(rr)]);
                }
            }
        }
        if (!points.length && hillCenters.length)
            ringPoints();
    }
    else {
        ringPoints();
    }
    if (clipPts !== null && points.length > total) {
        points = Array.from({ length: total }, (_, i) => points[Math.floor(i * points.length / total)]);
    }
    const idx = spreadAssign(gapSpecies.map((sp) => count(sp)), points.length);
    for (let i = 0; i < idx.length; i++) {
        cells.get(String(gapSpecies[idx[i]].id)).push({ x: points[i][0], y: points[i][1], r: points[i][2] });
    }
    return cells;
}
function placeHills(plants, region, structure, laneFlip = false) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const ncols = Math.max(1, Math.trunc(width / HILL_SPACING_M));
    const nrows = Math.max(1, Math.trunc(height / HILL_SPACING_M));
    const cellW = width / ncols, cellH = height / nrows;
    const clipPts = region.shape === "polygon" ? pts : null;
    const byHeight = (a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id));
    let moundSpecies = plants.filter(isMound).sort(byHeight);
    let gapSpecies = plants.filter((p) => !isMound(p)).sort(byHeight);
    if (!moundSpecies.length) {
        moundSpecies = gapSpecies;
        gapSpecies = [];
    }
    const maxMoundPr = moundSpecies.length
        ? Math.max(...moundSpecies.map((sp) => Math.max(spreadCm(sp) / 100, 0.30) / 2)) : MOUND_GUIDE_R;
    const moundR = Math.max(MOUND_GUIDE_R, HILL_CLUSTER_R + maxMoundPr) + 0.01;
    const keepR = HILL_CLUSTER_R + maxMoundPr * EDGE_MIN_FRAC + 0.01;
    let laneAxis = width < height ? "x" : "y";
    if (laneFlip)
        laneAxis = laneAxis === "x" ? "y" : "x";
    const nAlong = laneAxis === "x" ? ncols : nrows;
    const alleyIdx = new Set();
    if (structure === "field" && nAlong >= ALLEY_PERIOD && isRectangularBed(region)) {
        for (let i = 0; i < nAlong; i++)
            if (i % ALLEY_PERIOD === ALLEY_PERIOD - 1 && i !== nAlong - 1)
                alleyIdx.add(i);
    }
    const candidates = [];
    for (let r = 0; r < nrows; r++)
        for (let c = 0; c < ncols; c++) {
            if (alleyIdx.has(laneAxis === "x" ? c : r))
                continue;
            candidates.push([rx0 + (c + 0.5) * cellW, yLo + (r + 0.5) * cellH]);
        }
    let hillCenters = clipPts === null ? candidates : candidates.filter(([hx, hy]) => dotInPolygon(clipPts, hx, hy, keepR));
    if (!hillCenters.length && candidates.length && clipPts !== null) {
        const pool = [...candidates, [(rx0 + rx1) / 2, (yLo + yHi) / 2]];
        let best = pool[0], bestD = -Infinity;
        for (const [hx, hy] of pool) {
            const d = pointInPolygon(clipPts, hx, hy) ? minEdgeDistSq(clipPts, hx, hy) : -1;
            if (d > bestD) {
                bestD = d;
                best = [hx, hy];
            }
        }
        hillCenters = [best];
    }
    const moundCells = hillCells(hillCenters, moundSpecies, HILL_CLUSTER_R, rx0, rx1, yLo, yHi, clipPts);
    const gapCells = gapPlantCells(gapSpecies, hillCenters, ncols, nrows, rx0, rx1, yLo, yHi, cellW, cellH, clipPts, alleyIdx, laneAxis, moundR);
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = [...plants].sort(byHeight).map((p) => {
        const sid = String(p.id);
        const onMound = moundCells.has(sid);
        const cells = moundCells.get(sid) ?? gapCells.get(sid) ?? [];
        return {
            species: sid, y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells, mound: onMound,
        };
    });
    const guideRoom = (hx, hy) => clipPts ? Math.sqrt(minEdgeDistSq(clipPts, hx, hy)) : Math.min(hx - rx0, rx1 - hx, hy - yLo, yHi - hy);
    const mounds = hillCenters.map(([hx, hy]) => ({
        cx: round4(hx), cy: round4(hy),
        r: round4(Math.min(MOUND_GUIDE_R, Math.max(0, guideRoom(hx, hy) - 0.01))),
    }));
    return { polar: "hills", zones, violations: [], mounds };
}
function placeGrid(plants, region, latDeg, thresholdCm, band = true) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0, height = yHi - yLo;
    const north = polarIsNorth(latDeg);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    const total = ordered.reduce((s, p) => s + count(p), 0);
    if (total <= 0)
        return { polar: north ? "north" : "south", zones: [], violations: [] };
    let minD = Math.max(...ordered.map((p) => spreadCm(p) / 100), 0.30);
    if (minD < 0.30)
        minD = 0.30;
    const heights = ordered.map((p) => heightCm(p)).sort((a, b) => a - b);
    const m = heights.length;
    const medianH = m % 2 ? heights[(m - 1) / 2] : (heights[m / 2 - 1] + heights[m / 2]) / 2;
    const isTall = (p) => heightCm(p) >= thresholdCm || heightCm(p) > 1.5 * medianH;
    const tall = ordered.filter((p) => band && isTall(p));
    const short = ordered.filter((p) => !(band && isTall(p)));
    const nTall = tall.reduce((s, p) => s + count(p), 0);
    const clipPts = region.shape === "polygon" ? pts : null;
    let nTarget = total;
    if (clipPts !== null) {
        const clipArea = polygonArea(pts);
        if (clipArea > 0) {
            const ratio = (width * height) / effectiveClipArea(pts, clipArea, total);
            if (ratio > 1.0 + 1e-9)
                nTarget = Math.ceil(total * ratio);
        }
    }
    minD = fillSpacing(minD, width, height, nTarget);
    let [cols, rows] = gridDims(nTarget, minD, width, height);
    if (nTall > cols) {
        const want = Math.min(nTall, Math.max(1, Math.trunc(width / MIN_ROW_SPACING_M)));
        if (want > cols) {
            cols = Math.min(want, nTarget);
            rows = Math.ceil(nTarget / cols);
        }
    }
    rows = hexRows(cols, rows, nTarget);
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let kept = [];
    let remaining = nTarget;
    if (clipPts !== null) {
        kept = placeChordRows(clipPts, rows, cellH, cellW, r, total, north ? yHi : yLo, north);
    }
    else {
        const perRow = [];
        let left = remaining;
        for (let row = 0; row < rows && left > 0; row++) {
            const take = Math.min(hexRowCap(cols, row), left);
            perRow.push(take);
            left -= take;
        }
        if (perRow.length >= 2 && perRow[perRow.length - 1] < 0.55 * hexRowCap(cols, perRow.length - 1)) {
            const tot2 = perRow[perRow.length - 2] + perRow[perRow.length - 1];
            perRow[perRow.length - 2] = tot2 - Math.floor(tot2 / 2);
            perRow[perRow.length - 1] = Math.floor(tot2 / 2);
        }
        for (let row = 0; row < perRow.length; row++) {
            const y = north ? yHi - (row + 0.5) * cellH : yLo + (row + 0.5) * cellH;
            const cap = hexRowCap(cols, row);
            const n = perRow[row];
            const soft = n < cap && n > 1;
            const step = soft ? width / n : cellW;
            const xstart = soft ? rx0 : rx0 + (width - n * cellW) / 2;
            for (let c = 0; c < n; c++) {
                const x = xstart + (c + 0.5) * step;
                kept.push({ x, y, r });
            }
        }
    }
    const orderIds = [];
    for (const p of tall)
        for (let t = 0; t < count(p); t++)
            orderIds.push(String(p.id));
    for (const id of interleave(short))
        orderIds.push(id);
    const cellsBy = new Map();
    for (const p of ordered)
        cellsBy.set(String(p.id), []);
    if (kept.length > total)
        kept = Array.from({ length: total }, (_, i) => kept[Math.floor(i * kept.length / total)]);
    for (let idx = 0; idx < kept.length; idx++)
        cellsBy.get(orderIds[idx]).push(kept[idx]);
    const tiledIds = new Set(short.map((p) => String(p.id)));
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = ordered.map((p) => {
        const cells = cellsBy.get(String(p.id));
        return {
            species: String(p.id), y0: 0, y1: 0, polygon: [],
            area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells, tiled: tiledIds.has(String(p.id)),
        };
    });
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
const TIER_TALL_CM = 90;
const TIER_LOW_CM = 35;
function tierOf(p) {
    const h = heightCm(p);
    return h >= TIER_TALL_CM ? 0 : (h >= TIER_LOW_CM ? 1 : 2);
}
function placeGraded(plants, region, latDeg, thresholdCm) {
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const width = rx1 - rx0;
    const north = polarIsNorth(latDeg);
    const isPoly = region.shape === "polygon";
    const tiers = new Map();
    for (const p of plants) {
        const t = tierOf(p);
        (tiers.get(t) ?? tiers.set(t, []).get(t)).push(p);
    }
    const order = [...tiers.keys()].sort((a, b) => a - b);
    const bands = order.map((t) => {
        const mem = tiers.get(t);
        const cnt = mem.reduce((s, p) => s + count(p), 0);
        const sp = Math.max(...mem.map((p) => spreadCm(p))) / 100;
        const cols = Math.max(1, Math.min(cnt, sp > 0 ? Math.floor(width / sp) : cnt));
        const rows = Math.max(1, Math.ceil(cnt / cols));
        return { mem, cnt, sp, rows };
    });
    const totalRows = bands.reduce((s, b) => s + b.rows, 0) || 1;
    const cellsBy = new Map();
    for (const p of plants)
        cellsBy.set(String(p.id), []);
    let cur = north ? yHi : yLo;
    for (const b of bands) {
        const depth = (yHi - yLo) * b.rows / totalRows;
        const bandLo = north ? cur - depth : cur, bandHi = north ? cur : cur + depth;
        const clipPts = isPoly ? pts : null;
        const clipArea = isPoly ? stripArea(pts, rx0 - 1.0, rx1 + 1.0, bandLo, bandHi) : null;
        const cells = grid(b.cnt, b.sp * 100, rx0, rx1, bandLo, bandHi, north, clipPts, clipArea);
        let toks;
        if (b.mem.some((p) => heightCm(p) >= thresholdCm)) {
            toks = [];
            for (const p of [...b.mem].sort((a, c) => heightCm(c) - heightCm(a) || String(a.id).localeCompare(String(c.id)))) {
                for (let k = 0; k < count(p); k++)
                    toks.push(String(p.id));
            }
        }
        else {
            toks = interleave(b.mem);
        }
        for (let i = 0; i < Math.min(cells.length, toks.length); i++)
            cellsBy.get(toks[i]).push(cells[i]);
        cur = north ? bandLo : bandHi;
    }
    const bedCenter = [(rx0 + rx1) / 2, (yLo + yHi) / 2];
    const zones = plants.map((p) => {
        const cells = cellsBy.get(String(p.id));
        const cys = cells.map((c) => c.y);
        return {
            species: String(p.id),
            y0: cys.length ? Math.min(...cys) : 0, y1: cys.length ? Math.max(...cys) : 0,
            polygon: [], area_m2: round4(cells.length * (spreadCm(p) / 100) ** 2),
            centroid: meanCentroid(cells, bedCenter), height_cm: heightCm(p),
            count: cells.length, plants: cells,
        };
    });
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
function pointInPolygon(pts, x, y) {
    let inside = false;
    const n = pts.length;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
            inside = !inside;
        j = i;
    }
    return inside;
}
function minEdgeDistSq(pts, x, y) {
    let best = Infinity;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[(i + 1) % n][0], by = pts[(i + 1) % n][1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        let t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
        if (t < 0)
            t = 0;
        else if (t > 1)
            t = 1;
        const px = ax + t * dx, py = ay + t * dy;
        const d2 = (x - px) * (x - px) + (y - py) * (y - py);
        if (d2 < best)
            best = d2;
    }
    return best;
}
function dotInPolygon(pts, x, y, r) {
    return pointInPolygon(pts, x, y) && minEdgeDistSq(pts, x, y) >= r * r - 1e-9;
}
const EDGE_MIN_FRAC = 0.35;
const RING_SWEEP_STEPS = 16;
function rowIntervals(pts, y) {
    const xs = [];
    const n = pts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y))
            xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let k = 0; k + 1 < xs.length; k += 2)
        out.push([xs[k], xs[k + 1]]);
    return out;
}
function placeChordRows(clipPts, rows, cellH, cellW, r, total, yStart, north) {
    const rMin = r * EDGE_MIN_FRAC;
    const segs = [];
    for (let row = 0; row < rows; row++) {
        const y = north ? yStart - (row + 0.5) * cellH : yStart + (row + 0.5) * cellH;
        for (const [ax, bx] of rowIntervals(clipPts, y)) {
            const usable = bx - ax - 2 * rMin;
            if (usable <= 0)
                continue;
            segs.push({ y, ax, n: Math.max(1, Math.trunc(usable / cellW)), usable, row });
        }
    }
    let cTotal = segs.reduce((s, g) => s + g.n, 0);
    while (cTotal > total) {
        let bi = -1;
        for (let i = 0; i < segs.length; i++)
            if (segs[i].n > 0 && (bi < 0 || segs[i].n > segs[bi].n))
                bi = i;
        if (bi < 0)
            break;
        segs[bi].n--;
        cTotal--;
    }
    const out = [];
    for (const g of segs) {
        if (g.n <= 0)
            continue;
        const step = g.usable / g.n;
        const shift = g.row % 2 ? 0.25 : -0.25;
        for (let c = 0; c < g.n; c++) {
            const x = g.ax + rMin + (c + 0.5 + shift) * step;
            const rr = edgeFitR(clipPts, x, g.y, r);
            if (rr !== null)
                out.push({ x, y: g.y, r: rr });
        }
    }
    return out;
}
function edgeFitR(pts, x, y, r) {
    if (!pointInPolygon(pts, x, y))
        return null;
    const d2 = minEdgeDistSq(pts, x, y);
    if (d2 >= r * r - 1e-9)
        return r;
    const d = Math.sqrt(d2) - 0.01;
    return d >= r * EDGE_MIN_FRAC ? d : null;
}
function effectiveClipArea(pts, area, count) {
    if (count <= 0 || area <= 0)
        return area;
    let perim = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const dx = pts[(i + 1) % n][0] - pts[i][0], dy = pts[(i + 1) % n][1] - pts[i][1];
        perim += Math.sqrt(dx * dx + dy * dy);
    }
    const rEst = 0.5 * Math.sqrt(area / count);
    const eff = area - perim * rEst * EDGE_MIN_FRAC;
    const floor = 0.25 * area;
    return eff > floor ? eff : floor;
}
function gridDims(cnt, minD, width, height) {
    if (cnt <= 1)
        return [1, 1];
    const maxCols = Math.max(1, Math.trunc(width / minD));
    const maxRows = Math.max(1, Math.trunc(height / minD));
    let best = null;
    for (let cols = 1; cols <= maxCols; cols++) {
        const rows = Math.ceil(cnt / cols);
        if (rows > maxRows && cols < maxCols)
            continue;
        const cw = width / cols;
        const ch = height / rows;
        const lo = cw <= ch ? cw : ch;
        const hi = cw <= ch ? ch : cw;
        const score = lo > 0 ? hi / lo : 1e18;
        if (best === null || score < best[0])
            best = [score, cols, rows];
    }
    return [best[1], best[2]];
}
function hexRowCap(cols, row) {
    if (row % 2 === 0)
        return cols;
    return cols > 1 ? cols - 1 : 1;
}
function hexCapacity(cols, rows) {
    let cap = 0;
    for (let r = 0; r < rows; r++)
        cap += hexRowCap(cols, r);
    return cap;
}
function hexRows(cols, rows, n) {
    while (hexCapacity(cols, rows) < n)
        rows++;
    return rows;
}
function fillSpacing(minD, width, height, cnt) {
    if (cnt > 0 && width > 0 && height > 0) {
        const natural = Math.sqrt(width * height / cnt);
        if (natural < minD)
            return natural;
    }
    return minD;
}
function grid(cnt, spreadCmVal, rx0, rx1, bandLo, bandHi, north, clipPts = null, clipArea = null) {
    if (cnt <= 0)
        return [];
    let minD = spreadCmVal / 100;
    if (minD < 0.30)
        minD = 0.30;
    const width = rx1 - rx0;
    const height = bandHi - bandLo;
    let nTarget = cnt;
    if (clipPts !== null && clipArea && clipArea > 0) {
        const ratio = (width * height) / effectiveClipArea(clipPts, clipArea, cnt);
        if (ratio > 1.0 + 1e-9)
            nTarget = Math.ceil(cnt * ratio);
    }
    minD = fillSpacing(minD, width, height, nTarget);
    let [cols, rows] = gridDims(nTarget, minD, width, height);
    rows = hexRows(cols, rows, nTarget);
    const cellW = width / cols;
    const cellH = height / rows;
    const r = (cellW <= cellH ? cellW : cellH) / 2;
    let cells = [];
    let remaining = nTarget;
    if (clipPts !== null) {
        cells = placeChordRows(clipPts, rows, cellH, cellW, r, cnt, north ? bandHi : bandLo, north);
    }
    else
        for (let row = 0; row < rows && remaining > 0; row++) {
            const y = north ? bandHi - (row + 0.5) * cellH : bandLo + (row + 0.5) * cellH;
            const n = Math.min(hexRowCap(cols, row), remaining);
            const xstart = rx0 + (width - n * cellW) / 2;
            for (let c = 0; c < n; c++) {
                const x = xstart + (c + 0.5) * cellW;
                cells.push({ x, y, r });
            }
            remaining -= n;
        }
    if (clipPts !== null && cells.length > cnt) {
        cells = Array.from({ length: cnt }, (_, i) => cells[Math.floor(i * cells.length / cnt)]);
    }
    return cells;
}
function stripArea(pts, x0, x1, y0, y1) {
    if (y1 <= y0)
        return 0;
    const strip = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return polygonIntersectArea(pts, strip);
}
function cellBlocked(x, y, occupied) {
    return occupied.some((o) => pointInPolygon(regionPoints(o), x, y));
}
function excludeOccupied(result, occupied) {
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => !cellBlocked(c.x, c.y, occupied));
        z.count = z.plants.length;
    }
    return result;
}
const FIELD_LANE_LAYOUTS = new Set(["rows", "grid", "graded"]);
const STRIP_MAX_M = 1.22;
const PATH_M = 0.5;
const INGROUND_STRIP_MAX_M = 3.0;
const INGROUND_WORK_STRIP_M = 2.2;
const REACH_TOL_M = 0.015;
const PATH_INSET_MAX_M = 0.25;
function fieldBands(x0, x1, y0, y1, flip = false) {
    const width = x1 - x0, height = y1 - y0;
    let axis = width < height ? "x" : "y";
    if (flip)
        axis = axis === "x" ? "y" : "x";
    const span = axis === "x" ? width : height;
    const lo0 = axis === "x" ? x0 : y0;
    const n = Math.max(1, Math.trunc(span / HILL_SPACING_M));
    if (n < ALLEY_PERIOD)
        return { axis, bands: [] };
    const cell = span / n;
    const bands = [];
    for (let r = 0; r < n; r++)
        if (r % ALLEY_PERIOD === ALLEY_PERIOD - 1 && r !== n - 1)
            bands.push([lo0 + r * cell, lo0 + (r + 1) * cell]);
    return { axis, bands };
}
function pathBands(x0, x1, yLo, yHi, stripMax, workMax, flip = false) {
    const width = x1 - x0, height = yHi - yLo;
    if (Math.min(width, height) <= stripMax + REACH_TOL_M)
        return { axis: "y", bands: [] };
    const work = workMax ?? stripMax;
    let axis = width < height ? "x" : "y";
    if (flip)
        axis = axis === "x" ? "y" : "x";
    const span = axis === "x" ? width : height;
    const lo0 = axis === "x" ? x0 : yLo;
    const n = Math.ceil((span + PATH_M) / (work + PATH_M));
    if (n <= 1)
        return { axis, bands: [] };
    const stripW = (span - (n - 1) * PATH_M) / n;
    const bands = [];
    for (let k = 0; k < n - 1; k++) {
        const start = lo0 + (k + 1) * stripW + k * PATH_M;
        bands.push([start, start + PATH_M]);
    }
    return { axis, bands };
}
function dropCellsInBands(result, axis, bands) {
    if (!bands.length)
        return result;
    for (const z of result.zones) {
        z.plants = z.plants.filter((c) => { const v = axis === "x" ? c.x : c.y; const m = Math.min(c.r, PATH_INSET_MAX_M); return !bands.some(([lo, hi]) => v + m > lo && v - m < hi); });
        z.count = z.plants.length;
    }
    return result;
}
function reflowIntoStrips(result, axis, bands, lo, hi) {
    if (!bands.length)
        return result;
    const sorted = [...bands].map((b) => [b[0], b[1]]).sort((a, b) => a[0] - b[0]);
    const strips = [];
    let cur = lo;
    for (const [blo, bhi] of sorted) {
        if (blo > cur + 1e-9)
            strips.push([cur, blo]);
        cur = Math.max(cur, bhi);
    }
    if (hi > cur + 1e-9)
        strips.push([cur, hi]);
    if (!strips.length)
        return result;
    const coords = [...new Set(result.zones.flatMap((z) => z.plants.map((c) => (axis === "x" ? c.x : c.y))))].sort((a, b) => a - b);
    const R = coords.length;
    if (R < 1)
        return result;
    const dotR = Math.max(0, ...result.zones.flatMap((z) => z.plants.map((c) => c.r)));
    const spanTotal = strips.reduce((s, [s0, s1]) => s + (s1 - s0), 0);
    const halfPitch = spanTotal / (2.0 * R);
    const usable = strips.map(([s0, s1]) => { const m = Math.min(dotR, (s1 - s0) * 0.45, halfPitch); return [s0 + m, s1 - m]; });
    const totalUsable = usable.reduce((s, [a, b]) => s + (b - a), 0);
    if (totalUsable <= 0)
        return result;
    const pitch = totalUsable / R;
    const newPos = [];
    let cumLen = 0.0;
    let assigned = 0;
    for (const [a, b] of usable) {
        cumLen += b - a;
        const nI = Math.floor(R * cumLen / totalUsable + 0.5) - assigned;
        assigned += nI;
        const mid = (a + b) / 2.0;
        for (let t = 0; t < nI; t++)
            newPos.push(round4(mid + (t - (nI - 1) / 2.0) * pitch));
    }
    const map = new Map();
    coords.forEach((c, j) => map.set(c, newPos[j]));
    for (const z of result.zones)
        for (const cell of z.plants) {
            if (axis === "x")
                cell.x = map.get(cell.x);
            else
                cell.y = map.get(cell.y);
        }
    for (const z of result.zones)
        for (const cell of z.plants) {
            const v = axis === "x" ? cell.x : cell.y;
            for (const [s0, s1] of strips) {
                if (s0 - 1e-9 <= v && v <= s1 + 1e-9) {
                    const fit = Math.min(v - s0, s1 - v);
                    if (fit < cell.r)
                        cell.r = round4(fit);
                    break;
                }
            }
        }
    return result;
}
function openLanes(result, region, split) {
    const { axis, bands } = split;
    if (!bands.length)
        return result;
    if (region.shape !== "rect")
        return dropCellsInBands(result, axis, bands);
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const lo = axis === "x" ? Math.min(...xs) : Math.min(...ys);
    const hi = axis === "x" ? Math.max(...xs) : Math.max(...ys);
    return reflowIntoStrips(result, axis, bands, lo, hi);
}
function isRectangularBed(region) {
    if (region.shape === "rect")
        return true;
    if (region.shape === "polygon" && region.points.length === 4) {
        const p = region.points;
        const d1 = Math.hypot(p[0][0] - p[2][0], p[0][1] - p[2][1]);
        const d2 = Math.hypot(p[1][0] - p[3][0], p[1][1] - p[3][1]);
        const mx1 = (p[0][0] + p[2][0]) / 2, my1 = (p[0][1] + p[2][1]) / 2;
        const mx2 = (p[1][0] + p[3][0]) / 2, my2 = (p[1][1] + p[3][1]) / 2;
        return Math.abs(d1 - d2) < 1e-6 && Math.abs(mx1 - mx2) < 1e-6 && Math.abs(my1 - my2) < 1e-6;
    }
    return false;
}
function openFieldLanes(result, region, flip = false) {
    if (!isRectangularBed(region))
        return result;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return openLanes(result, region, fieldBands(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), flip));
}
function openStripPaths(result, region, stripMax, workMax, flip = false) {
    if (!isRectangularBed(region))
        return result;
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return openLanes(result, region, pathBands(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), stripMax, workMax, flip));
}
function accessBands(structure, region, flip = false) {
    if (!isRectangularBed(region))
        return [];
    const pts = regionPoints(region);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (structure === "field") {
        const { axis, bands } = fieldBands(rx0, rx1, y0, y1, flip);
        return bands.map(([lo, hi]) => axis === "x"
            ? { x0: lo, y0, x1: hi, y1, kind: "lane" }
            : { x0: rx0, y0: lo, x1: rx1, y1: hi, kind: "lane" });
    }
    if (structure === "raised" || structure === "in_ground") {
        const { axis, bands } = structure === "raised"
            ? pathBands(rx0, rx1, y0, y1, STRIP_MAX_M, undefined, flip)
            : pathBands(rx0, rx1, y0, y1, INGROUND_STRIP_MAX_M, INGROUND_WORK_STRIP_M, flip);
        return bands.map(([lo, hi]) => axis === "x"
            ? { x0: lo, y0, x1: hi, y1, kind: "path" }
            : { x0: rx0, y0: lo, x1: rx1, y1: hi, kind: "path" });
    }
    return [];
}
function accessBandPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return [];
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    return bands.map((b) => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
        .map(([x, y]) => orientedToPlot(x, y, f.effW, f.effL, f.residualDeg, f.cx, f.cy)));
}
function plantableStripPolygons(bed) {
    if (!isRectangularBed(bed.region))
        return [];
    const f = bedFrame(bed);
    const bands = accessBands(bed.structure, { shape: "rect", x: 0, y: 0, w: f.effW, h: f.effL }, bed.lane_flip ?? false);
    if (!bands.length)
        return [];
    const axisY = bands.every((b) => b.x0 <= 1e-9 && Math.abs(b.x1 - f.effW) <= 1e-9);
    const span = axisY ? f.effL : f.effW;
    const cuts = bands.map((b) => (axisY ? [b.y0, b.y1] : [b.x0, b.x1])).sort((a, b) => a[0] - b[0]);
    const strips = [];
    let cur = 0;
    for (const [lo, hi] of cuts) {
        if (lo > cur + 1e-9)
            strips.push([cur, lo]);
        cur = Math.max(cur, hi);
    }
    if (span > cur + 1e-9)
        strips.push([cur, span]);
    return strips.map((s) => {
        const [x0, x1, y0, y1] = axisY ? [0, f.effW, s[0], s[1]] : [s[0], s[1], 0, f.effL];
        return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            .map(([x, y]) => orientedToPlot(x, y, f.effW, f.effL, f.residualDeg, f.cx, f.cy));
    });
}
function place(plants, region, latDeg, thresholdCm = 120, layoutKind = "rows", treeR = 0, band = true, occupied = [], structure, laneFlip = false) {
    let result = placeCore(plants, region, latDeg, thresholdCm, layoutKind, treeR, band, structure, laneFlip);
    if (occupied.length)
        result = excludeOccupied(result, occupied);
    if (region.shape !== "radial_rings") {
        if (FIELD_LANE_LAYOUTS.has(layoutKind)) {
            if (structure === "field")
                result = openFieldLanes(result, region, laneFlip);
            else if (structure === "raised")
                result = openStripPaths(result, region, STRIP_MAX_M, undefined, laneFlip);
            else if (structure === "in_ground")
                result = openStripPaths(result, region, INGROUND_STRIP_MAX_M, INGROUND_WORK_STRIP_M, laneFlip);
        }
        if (FIELD_LANE_LAYOUTS.has(layoutKind) || (layoutKind === "hills" && structure === "field")) {
            const bands = accessBands(structure, region, laneFlip);
            if (bands.length)
                result.access_bands = bands;
        }
    }
    return result;
}
function placeCore(plants, region, latDeg, thresholdCm = 120, layoutKind = "rows", treeR = 0, band = true, structure, laneFlip = false) {
    if (region.shape === "radial_rings")
        return placeRings(plants, region);
    if (layoutKind === "hills")
        return placeHills(plants, region, structure, laneFlip);
    if (layoutKind === "graded")
        return placeGraded(plants, region, latDeg, thresholdCm);
    if (layoutKind === "grid")
        return placeGrid(plants, region, latDeg, thresholdCm, band);
    if (layoutKind === "orchard")
        return placeOrchard(plants, region, treeR);
    if (layoutKind === "shelter")
        return placeShelter(plants, region, latDeg, thresholdCm);
    const ordered = [...plants].sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    return placeBands(plants, ordered, region, latDeg, thresholdCm);
}
function placeShelter(plants, region, latDeg, thresholdCm) {
    const sheltered = plants.filter((p) => p.sheltered).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const rest = plants.filter((p) => !p.sheltered).sort((a, b) => heightCm(b) - heightCm(a) || String(a.id).localeCompare(String(b.id)));
    return placeBands(plants, [...sheltered, ...rest], region, latDeg, thresholdCm);
}
function placeBands(plants, ordered, region, latDeg, thresholdCm) {
    const pts = regionPoints(region);
    const total = polygonArea(pts);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const rx0 = Math.min(...xs);
    const rx1 = Math.max(...xs);
    const x0 = rx0 - 1;
    const x1 = rx1 + 1;
    const yLo = Math.min(...ys);
    const yHi = Math.max(...ys);
    const north = polarIsNorth(latDeg);
    const isPoly = region.shape === "polygon";
    const bedCapCm = Math.min(rx1 - rx0, yHi - yLo) * 100.0;
    const weights = ordered.map((p) => weight(p, bedCapCm));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const zones = [];
    let cur = north ? yHi : yLo;
    for (let i = 0; i < ordered.length; i++) {
        const p = ordered[i];
        const share = wsum > 0 ? total * (weights[i] / wsum) : 0;
        let cut;
        if (i === ordered.length - 1) {
            cut = north ? yLo : yHi;
        }
        else {
            let lo = north ? yLo : cur;
            let hi = north ? cur : yHi;
            for (let it = 0; it < 50; it++) {
                const mid = (lo + hi) / 2;
                const a = north ? stripArea(pts, x0, x1, mid, cur) : stripArea(pts, x0, x1, cur, mid);
                if (north) {
                    if (a < share)
                        hi = mid;
                    else
                        lo = mid;
                }
                else {
                    if (a < share)
                        lo = mid;
                    else
                        hi = mid;
                }
            }
            cut = (lo + hi) / 2;
        }
        const bandLo = north ? cut : cur;
        const bandHi = north ? cur : cut;
        const strip = [[x0, bandLo], [x1, bandLo], [x1, bandHi], [x0, bandHi]];
        const poly = convexClip(pts, strip);
        const zoneArea = stripArea(pts, x0, x1, bandLo, bandHi);
        const c = poly.length >= 3 ? polygonCentroid(poly) : [(x0 + x1) / 2, (bandLo + bandHi) / 2];
        const cells = grid(count(p), spreadCm(p), rx0, rx1, bandLo, bandHi, north, isPoly ? poly : null, isPoly ? zoneArea : null);
        zones.push({
            species: String(p.id), y0: bandLo, y1: bandHi,
            polygon: poly.map((q) => [q[0], q[1]]), area_m2: zoneArea,
            centroid: [c[0], c[1]], height_cm: heightCm(p),
            count: cells.length, plants: cells,
        });
        cur = cut;
    }
    const byId = new Map(plants.map((p) => [String(p.id), p]));
    const layout = zones.map((z) => ({ id: z.species, x: z.centroid[0], y: z.centroid[1], height_cm: z.height_cm,
        sheltered: !!byId.get(String(z.species))?.sheltered }));
    const violations = heightOrderingViolations(layout, thresholdCm, latDeg);
    return { polar: north ? "north" : "south", zones, violations };
}
function orientRect(w, l, angleDeg) {
    const a = ((angleDeg % 360) + 360) % 360;
    const quarters = Math.floor((a + 45.0) / 90.0);
    const q = quarters % 4;
    const r = a - 90.0 * quarters;
    const swap = q % 2 === 1;
    return { eff_w: swap ? l : w, eff_l: swap ? w : l, poleward_edge: q, residual_deg: round4(r) };
}
function orientedToPlot(x, y, effW, effL, residualDeg, cx, cy) {
    const dx = x - effW / 2.0, dy = y - effL / 2.0;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(cx + dx * c - dy * s), round4(cy + dx * s + dy * c)];
}
function plotToOriented(px, py, effW, effL, residualDeg, cx, cy) {
    const rx = px - cx, ry = py - cy;
    const t = residualDeg * Math.PI / 180.0;
    const c = Math.cos(t), s = Math.sin(t);
    return [round4(rx * c + ry * s + effW / 2.0), round4(-rx * s + ry * c + effL / 2.0)];
}
function bedFrame(bed) {
    const a = bed.rotation_deg;
    if (a && a % 360 !== 0 && bed.region.shape === "polygon" && bed.region.points.length === 4) {
        const p = bed.region.points;
        const r2 = (v) => Math.round(v * 100) / 100;
        const w = r2(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]));
        const l = r2(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]));
        const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
        const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
        const o = orientRect(w, l, a);
        return { cx, cy, effW: o.eff_w, effL: o.eff_l, residualDeg: o.residual_deg };
    }
    if (bed.region.shape === "rect") {
        const r = bed.region;
        return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, effW: Math.max(1e-6, r.w), effL: Math.max(1e-6, r.h), residualDeg: 0 };
    }
    const pts = regionPoints(bed.region);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, effW: Math.max(1e-6, x1 - x0), effL: Math.max(1e-6, y1 - y0), residualDeg: 0 };
}
function framesEqual(a, b) {
    return Math.abs(a.cx - b.cx) < 1e-3 && Math.abs(a.cy - b.cy) < 1e-3 && Math.abs(a.effW - b.effW) < 1e-3
        && Math.abs(a.effL - b.effL) < 1e-3 && Math.abs((((a.residualDeg - b.residualDeg) % 360) + 360) % 360) < 1e-3;
}
function plotToFrac(px, py, f) {
    const dx = px - f.cx, dy = py - f.cy, t = -f.residualDeg * Math.PI / 180;
    const c = Math.cos(t), s = Math.sin(t);
    return [((dx * c - dy * s) + f.effW / 2) / f.effW, ((dx * s + dy * c) + f.effL / 2) / f.effL];
}
function fracToPlot(fx, fy, f) {
    const lx = fx * f.effW - f.effW / 2, ly = fy * f.effL - f.effL / 2, t = f.residualDeg * Math.PI / 180;
    const c = Math.cos(t), s = Math.sin(t), r2 = (v) => Math.round(v * 100) / 100;
    return [r2(f.cx + lx * c - ly * s), r2(f.cy + lx * s + ly * c)];
}
function remapRegionBetweenBeds(region, oldBed, newBed) {
    const oldF = bedFrame(oldBed), newF = bedFrame(newBed);
    return { shape: "polygon", points: regionPoints(region).map((p) => {
            const [fx, fy] = plotToFrac(p[0], p[1], oldF);
            return fracToPlot(fx, fy, newF);
        }) };
}

const cache = new Map();
function fmt(opts, locale = dateLocale()) {
    const key = `${locale} ${JSON.stringify(opts)}`;
    let f = cache.get(key);
    if (!f) {
        f = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts });
        cache.set(key, f);
    }
    return f;
}
function at(y, m1, d) {
    return new Date(Date.UTC(y, m1 - 1, d, 12));
}
function parse(s) {
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m)
        return at(Number(m[1]), Number(m[2]), Number(m[3]));
    m = /^(\d{2})-(\d{2})$/.exec(s);
    if (m)
        return at(2001, Number(m[1]), Number(m[2]));
    return null;
}
const sep = (s) => s.replace(/\bsept\b/, "sep");
function fmtMonthDay(s) {
    const d = parse(s);
    return d ? sep(fmt({ month: "short", day: "numeric" }).format(d)) : s;
}
function fmtMonthDayLong(s) {
    const d = parse(s);
    return d ? fmt({ month: "long", day: "numeric" }).format(d) : s;
}
function fmtMonthDayYear(s, locale = dateLocale()) {
    const d = parse(s);
    return d ? sep(fmt({ month: "short", day: "numeric", year: "numeric" }, locale).format(d)) : s;
}
function monthShort(m0) {
    return sep(fmt({ month: "short" }).format(at(2001, m0 + 1, 1)).replace(/\.$/, ""));
}
function monthLong(m0) {
    return fmt({ month: "long" }).format(at(2001, m0 + 1, 1));
}
function weekdayLong(d0) {
    return fmt({ weekday: "long" }).format(at(2023, 1, 1 + d0));
}
function weekdayShort(d0) {
    return fmt({ weekday: "short" }).format(at(2023, 1, 1 + d0)).replace(/\.$/, "");
}

const SOUTH_SEASON_START_MONTH = 7;
const SPRING_FALL_SPLIT = 182;
const SEASONS$1 = ["winter", "spring", "summer", "autumn"];
const CUM$1 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function isSouthern(lat) {
    return typeof lat === "number" && Number.isFinite(lat) && lat < 0;
}
function tropical(lat) {
    return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) < 10;
}
function seasonYearOf(isoDate, lat) {
    const y = Number(isoDate.slice(0, 4)), m = Number(isoDate.slice(5, 7));
    return isSouthern(lat) && m < SOUTH_SEASON_START_MONTH ? y - 1 : y;
}
function seasonDate(mmdd, seasonYear, lat) {
    const m = Number(mmdd.slice(0, 2));
    const y = isSouthern(lat) && m < SOUTH_SEASON_START_MONTH ? seasonYear + 1 : seasonYear;
    return `${y}-${mmdd}`;
}
function fallDate(mmdd, seasonYear, lat) {
    const m = Number(mmdd.slice(0, 2));
    if (isSouthern(lat))
        return `${m <= 8 ? seasonYear + 1 : seasonYear}-${mmdd}`;
    return `${m < 7 ? seasonYear + 1 : seasonYear}-${mmdd}`;
}
function fallSeasonDoy(mmdd, lat) {
    const m = Number(mmdd.slice(0, 2));
    const d = seasonDoy(mmddDoyOf(mmdd) ?? 0, lat);
    return (isSouthern(lat) ? m >= 7 && m <= 8 : m < 7) ? d + 365 : d;
}
function seasonDoy(doy, lat) {
    if (!isSouthern(lat))
        return doy;
    return (((doy - SPRING_FALL_SPLIT) % 365) + 365) % 365 + 1;
}
function mmddDoyOf(mmdd) {
    if (typeof mmdd !== "string" || mmdd.length < 5)
        return null;
    const m = Number(mmdd.slice(0, 2)), d = Number(mmdd.slice(3, 5));
    if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12)
        return null;
    return CUM$1[m - 1] + d;
}
function frostSide(doy, lat) {
    const early = doy < SPRING_FALL_SPLIT;
    if (isSouthern(lat))
        return early ? "fall" : "spring";
    return early ? "spring" : "fall";
}
function seasonName(month, lat) {
    const north = SEASONS$1[Math.floor((month % 12) / 3)];
    return isSouthern(lat) ? SEASONS$1[(SEASONS$1.indexOf(north) + 2) % 4] : north;
}
function northernMonth(month, lat) {
    return isSouthern(lat) ? ((month + 5) % 12) + 1 : month;
}

const IN = () => copy.unitIn, FT = (v) => (v != null && +v === 1 ? copy.unitFtOne : copy.unitFt), FT2 = (v) => (v != null && +v === 1 ? copy.unitFt2One : copy.unitFt2);
const KEY = "gg-units";
const TEMP_KEY = "gg-temp";
const PREF_AT_KEY = "gg-prefs-at";
const M_PER_FT = 0.3048;
function regionMetric(langs) {
    let tags = [];
    {
        try {
            tags = navigator.languages?.length ? navigator.languages : [navigator.language];
        }
        catch {
            tags = [];
        }
    }
    for (const tag of tags) {
        const m = /^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2}|\d{3})(?:-|$)/i.exec(tag ?? "");
        if (m)
            return !["US", "LR", "MM"].includes(m[1].toUpperCase());
    }
    return false;
}
let system = "imperial";
try {
    const u = localStorage.getItem(KEY);
    if (u === "metric" || (u === null && regionMetric()))
        system = "metric";
}
catch {
}
let temp = "f";
try {
    const t = localStorage.getItem(TEMP_KEY);
    if (t === "c" || (t === null && regionMetric()))
        temp = "c";
}
catch {
}
const unitSystem = () => system;
const lengthUnit = () => (system === "metric" ? "m" : "ft");
const tempSystem = () => temp;
const THEME_KEY = "gg-theme";
let theme = "system";
try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark")
        theme = t;
}
catch {
}
const darkMq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
const themeChoice = () => theme;
function applyTheme() {
    const resolved = theme === "system" ? (darkMq?.matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#16140f" : "#272e1b");
}
darkMq?.addEventListener("change", () => { if (theme === "system")
    applyTheme(); });
function setThemeChoice(t) {
    theme = t;
    try {
        localStorage.setItem(THEME_KEY, t);
    }
    catch { }
    stampPrefs();
    applyTheme();
}
const SEASON_KEY = "gg-season";
const HEMI_KEY = "gg-hemi";
const HEMI_SRC_KEY = "gg-hemi-src";
const SEASONS = ["spring", "summer", "autumn", "winter"];
let season = "follow";
try {
    const s = localStorage.getItem(SEASON_KEY);
    if (s && SEASONS.includes(s))
        season = s;
}
catch {
}
function seasonOf(d, southern = false) {
    return seasonName(d.getMonth() + 1, southern ? -1 : 1);
}
function southernHemisphere() {
    try {
        return localStorage.getItem(HEMI_KEY) === "s";
    }
    catch {
        return false;
    }
}
function rememberHemisphere(lat) {
    if (!Number.isFinite(lat))
        return;
    try {
        localStorage.setItem(HEMI_KEY, lat < 0 ? "s" : "n");
        localStorage.removeItem(HEMI_SRC_KEY);
    }
    catch { }
}
function rememberLookupHemisphere(lat) {
    if (!Number.isFinite(lat))
        return;
    try {
        if (localStorage.getItem(HEMI_KEY) !== null && localStorage.getItem(HEMI_SRC_KEY) !== "lookup")
            return;
        localStorage.setItem(HEMI_KEY, lat < 0 ? "s" : "n");
        localStorage.setItem(HEMI_SRC_KEY, "lookup");
    }
    catch {
        return;
    }
    if (typeof document !== "undefined")
        applySeason();
}
const seasonChoice = () => season;
const resolvedSeason = (now = new Date()) => season === "follow" ? seasonOf(now, southernHemisphere()) : season;
function applySeason() {
    document.documentElement.dataset.season = resolvedSeason();
}
function setSeasonChoice(s) {
    season = s;
    try {
        localStorage.setItem(SEASON_KEY, s);
    }
    catch { }
    stampPrefs();
    applySeason();
}
const SILO_KEY = "gg-silo";
let silo = "on";
try {
    if (localStorage.getItem(SILO_KEY) === "off")
        silo = "off";
}
catch {
}
const siloChoice = () => silo;
function applySilo() {
    if (silo === "off")
        document.documentElement.setAttribute("data-silo", "off");
    else
        document.documentElement.removeAttribute("data-silo");
}
function setSiloChoice(s) {
    silo = s;
    try {
        localStorage.setItem(SILO_KEY, s);
    }
    catch { }
    applySilo();
}
const REMIND_KEY = "gg-remind";
let remind = "morning";
try {
    const r = localStorage.getItem(REMIND_KEY);
    if (r === "evening" || r === "none")
        remind = r;
}
catch {
}
const remindChoice = () => remind;
function setRemindChoice(r) {
    remind = r;
    try {
        localStorage.setItem(REMIND_KEY, r);
    }
    catch { }
    stampPrefs();
}
const CADENCE_KEY = "gg-notify-cadence";
const WEEKDAY_KEY = "gg-notify-weekday";
const isCadence = (v) => v === "weekly" || v === "daily" || v === "headsups";
const isWeekday = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6;
let cadence = "weekly";
let weekday = 6;
try {
    const c = localStorage.getItem(CADENCE_KEY);
    if (isCadence(c))
        cadence = c;
    const w = Number(localStorage.getItem(WEEKDAY_KEY) ?? "");
    if (localStorage.getItem(WEEKDAY_KEY) != null && isWeekday(w))
        weekday = w;
}
catch {
}
const notifyCadence = () => cadence;
const notifyWeekday = () => weekday;
function setNotifyCadence(c) {
    cadence = c;
    try {
        localStorage.setItem(CADENCE_KEY, c);
    }
    catch { }
    stampPrefs();
}
function setNotifyWeekday(w) {
    if (!isWeekday(w))
        return;
    weekday = w;
    try {
        localStorage.setItem(WEEKDAY_KEY, String(w));
    }
    catch { }
    stampPrefs();
}
const PACE_KEY = "gg-pace";
let pace = null;
try {
    const p = localStorage.getItem(PACE_KEY);
    if (p === "full" || p === "light")
        pace = p;
}
catch {
}
const paceChoice = () => pace;
function setPaceChoice(p) {
    pace = p;
    try {
        localStorage.setItem(PACE_KEY, p);
    }
    catch { }
    stampPrefs();
}
const HOUSE_KEY = "gg-household";
const houseOk = (h) => h === "none" || (!!h && typeof h === "object"
    && Number.isInteger(h.adults) && Number.isInteger(h.children)
    && h.adults >= 0 && h.children >= 0
    && h.adults + h.children >= 1
    && h.adults <= 30 && h.children <= 30);
let household = null;
try {
    const raw = localStorage.getItem(HOUSE_KEY);
    const h = raw ? JSON.parse(raw) : null;
    if (houseOk(h))
        household = h;
}
catch {
}
const householdChoice = () => household;
function setHousehold(h) {
    if (!houseOk(h))
        return;
    household = h;
    try {
        localStorage.setItem(HOUSE_KEY, JSON.stringify(h));
    }
    catch { }
    stampPrefs();
}
const SPACE_KEY = "gg-space";
const AFTER_KEY = "gg-after";
const SPACES = ["ground", "raised", "pots", "changing"];
const AFTERS = ["food", "pollinators", "kids", "little"];
let space = null;
let after = null;
try {
    const sp = localStorage.getItem(SPACE_KEY);
    if (sp && SPACES.includes(sp))
        space = sp;
    const af = localStorage.getItem(AFTER_KEY);
    if (af && AFTERS.includes(af))
        after = af;
}
catch {
}
const spaceChoice = () => space;
const afterChoice = () => after;
function setSpaceChoice(s) {
    space = s;
    try {
        localStorage.setItem(SPACE_KEY, s);
    }
    catch { }
    stampPrefs();
}
function setAfterChoice(a) {
    after = a;
    try {
        localStorage.setItem(AFTER_KEY, a);
    }
    catch { }
    stampPrefs();
}
const appLangChoice = () => storedLang() ?? appLang();
function setLangChoice(l) {
    const reload = storeLang(l);
    stampPrefs();
    return reload;
}
function stampPrefs() {
    try {
        localStorage.setItem(PREF_AT_KEY, String(Date.now()));
    }
    catch {
    }
}
function setUnitSystem(sys) {
    system = sys;
    try {
        localStorage.setItem(KEY, sys);
    }
    catch {
    }
    stampPrefs();
}
function metricForVisit() {
    try {
        if (localStorage.getItem(KEY) !== null || localStorage.getItem(TEMP_KEY) !== null)
            return false;
    }
    catch {
        return false;
    }
    if (system === "metric" && temp === "c")
        return false;
    system = "metric";
    temp = "c";
    return true;
}
function setTempSystem(t) {
    temp = t;
    try {
        localStorage.setItem(TEMP_KEY, t);
    }
    catch {
    }
    stampPrefs();
}
function prefRecord() {
    let at = null;
    try {
        const v = localStorage.getItem(PREF_AT_KEY);
        at = v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    }
    catch {
    }
    return { record: { units: system, temp, theme, remind, season, ...(pace ? { pace } : {}), ...(household ? { household } : {}), ...(space ? { space } : {}), ...(after ? { after } : {}), ...(langChosen() ? { lang: appLangChoice() } : {}), cadence, weekday }, updatedAt: at };
}
function applyPrefRecord(rec, atMs) {
    const changed = rec.units !== system || rec.temp !== temp
        || (rec.theme != null && rec.theme !== theme)
        || (rec.remind != null && rec.remind !== remind)
        || (rec.season != null && rec.season !== season)
        || (rec.pace != null && rec.pace !== pace)
        || (rec.household != null && JSON.stringify(rec.household) !== JSON.stringify(household))
        || (rec.space != null && rec.space !== space) || (rec.after != null && rec.after !== after)
        || ((rec.lang === "en" || rec.lang === "es") && rec.lang !== appLangChoice())
        || (isCadence(rec.cadence) && rec.cadence !== cadence) || (isWeekday(rec.weekday) && rec.weekday !== weekday);
    if (rec.units === "metric" || rec.units === "imperial") {
        system = rec.units;
        try {
            localStorage.setItem(KEY, system);
        }
        catch { }
    }
    if (rec.temp === "c" || rec.temp === "f") {
        temp = rec.temp;
        try {
            localStorage.setItem(TEMP_KEY, temp);
        }
        catch { }
    }
    if (rec.theme === "system" || rec.theme === "light" || rec.theme === "dark") {
        theme = rec.theme;
        try {
            localStorage.setItem(THEME_KEY, theme);
        }
        catch { }
        applyTheme();
    }
    if (rec.remind === "morning" || rec.remind === "evening" || rec.remind === "none") {
        remind = rec.remind;
        try {
            localStorage.setItem(REMIND_KEY, remind);
        }
        catch { }
    }
    if (rec.season === "follow" || SEASONS.includes(rec.season ?? "")) {
        season = rec.season;
        try {
            localStorage.setItem(SEASON_KEY, season);
        }
        catch { }
        applySeason();
    }
    if (rec.pace === "full" || rec.pace === "light") {
        pace = rec.pace;
        try {
            localStorage.setItem(PACE_KEY, pace);
        }
        catch { }
    }
    if (rec.space && SPACES.includes(rec.space)) {
        space = rec.space;
        try {
            localStorage.setItem(SPACE_KEY, space);
        }
        catch { }
    }
    if (rec.after && AFTERS.includes(rec.after)) {
        after = rec.after;
        try {
            localStorage.setItem(AFTER_KEY, after);
        }
        catch { }
    }
    if (isCadence(rec.cadence)) {
        cadence = rec.cadence;
        try {
            localStorage.setItem(CADENCE_KEY, cadence);
        }
        catch { }
    }
    if (isWeekday(rec.weekday)) {
        weekday = rec.weekday;
        try {
            localStorage.setItem(WEEKDAY_KEY, String(weekday));
        }
        catch { }
    }
    if (rec.lang === "en" || rec.lang === "es")
        storeLang(rec.lang);
    if (houseOk(rec.household)) {
        household = rec.household;
        try {
            localStorage.setItem(HOUSE_KEY, JSON.stringify(household));
        }
        catch { }
    }
    if (typeof atMs === "number" && Number.isFinite(atMs)) {
        try {
            localStorage.setItem(PREF_AT_KEY, String(atMs));
        }
        catch { }
    }
    return changed;
}
const lenToM = (v) => (system === "metric" ? v : v * M_PER_FT);
const mToInput = (m) => +(system === "metric" ? m : m / M_PER_FT).toFixed(2);
const bedDepthWord = (cm) => system === "metric" ? `${Math.round(cm)} cm` : `${Math.round(cm / 2.54)} ${IN()}`;
const fmtLen = (m) => {
    if (system === "metric")
        return `${fmtDec(m, 2)} m`;
    const ft = m / M_PER_FT;
    if (ft < 1)
        return `${Math.round(ft * 12)} ${IN()}`;
    const v = ft >= 3 ? Math.round(ft) : Math.round(ft * 2) / 2;
    return `${fmtDec(v, 1)} ${FT(v)}`;
};
const fmtDec = (v, max = 2, min = 0) => {
    const s = min ? v.toFixed(min) : String(+v.toFixed(max));
    return decimalMark() === "," ? s.replace(".", ",") : s;
};
let markSeen = "", mark$1 = ".";
const decimalMark = () => {
    const loc = numberLocale();
    if (loc !== markSeen) {
        markSeen = loc;
        try {
            mark$1 = new Intl.NumberFormat(loc).format(1.5).includes(",") ? "," : ".";
        }
        catch {
            mark$1 = ".";
        }
    }
    return mark$1;
};
const fmtArea = (m2) => {
    if (system === "metric")
        return `${fmtDec(m2, 2)} m²`;
    const ft2 = m2 / (M_PER_FT * M_PER_FT);
    const v = ft2 >= 10 ? Math.round(ft2) : +ft2.toFixed(1);
    return `${fmtDec(v, 1)} ${FT2(v)}`;
};
const fmtAreaApart = (a, b) => {
    const fa = fmtArea(a), fb = fmtArea(b);
    if (fa !== fb || Math.abs(a - b) < 1e-9)
        return [fa, fb];
    const k = system === "metric" ? 1 : M_PER_FT * M_PER_FT, unit = system === "metric" ? "m²" : FT2();
    for (const d of system === "metric" ? [3, 4] : [1, 2]) {
        const x = fmtDec(a / k, d, d), y = fmtDec(b / k, d, d);
        if (x !== y)
            return [`${x} ${unit}`, `${y} ${unit}`];
    }
    return [fa, fb];
};
const fmtHeight = (m) => system === "metric" ? `${Math.round(m)} m` : `${Math.round(m / M_PER_FT)} ${FT(Math.round(m / M_PER_FT))}`;
const fmtKm = (km) => {
    const v = system === "metric" ? km : km / 1.609344;
    return `${fmtDec(v, v < 10 ? 1 : 0)} ${system === "metric" ? "km" : "mi"}`;
};
const fmtCm = (cm) => fmtCmValue(cm);
const fmtCmValue = (v, fine = false) => {
    const nums = (Array.isArray(v) ? v : [v]).map(Number);
    const join = (parts) => (new Set(parts).size === 1 ? parts[0] : parts.join("–"));
    if (!fine && Math.max(...nums) >= 100) {
        const m = (cm) => fmtDec(cm / 100, 1);
        const ft = (cm) => `${+(cm / 2.54 / 12).toFixed(0)}`;
        const lo = Math.min(...nums), hi = Math.max(...nums);
        if (Array.isArray(v) && nums.length === 2 && lo < 46) {
            return system === "metric" ? `${lo} cm–${m(hi)} m` : `${+(lo / 2.54).toFixed(0)} ${IN()}–${ft(hi)} ${FT()}`;
        }
        const f = join(nums.map(ft));
        return system === "metric" ? `${join(nums.map(m))} m` : `${f} ${FT(f)}`;
    }
    const one = (cm) => system === "metric" ? fmtDec(cm, 2) : fmtDec(cm / 2.54, fine ? 1 : 0);
    const word = system === "metric" ? "cm" : IN();
    return `${join(nums.map(one))} ${word}`;
};
const fmtRain = (mm) => {
    if (system === "metric")
        return `${mm < 10 ? +mm.toFixed(1) : Math.round(mm)} mm`;
    const v = mm / 25.4;
    return `${v < 0.1 ? +v.toFixed(2) : +v.toFixed(1)} ${IN()}`;
};
const fmtTemp = (c) => temp === "c" ? `${+c.toFixed(0)} °C` : `${+((c * 9) / 5 + 32).toFixed(0)} °F`;
const localiseProse = (text) => {
    if (system === "metric")
        return text;
    const num = (v) => parseFloat(v.replace(",", "."));
    const ft = (m) => `${+(m / M_PER_FT).toFixed(1)}`;
    const inch = (cm) => `${Math.round(cm / 2.54)}`;
    const ftArea = (m2) => `${+(m2 / (M_PER_FT * M_PER_FT)).toFixed(1)}`;
    const inArea = (cm2) => `${Math.round(cm2 / (2.54 * 2.54))}`;
    const fig = String.raw `~?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?`;
    const imp = String.raw `(?:in|inches|ft|feet|pulgadas|pulg|pies|pie)\b\.?`, met = String.raw `(?:cm|mm|m)(?![²2])\b`;
    return text
        .replace(new RegExp(`(${fig}\\s*${imp})\\s*\\(${fig}\\s*${met}\\)`, "g"), "$1")
        .replace(new RegExp(`${fig}\\s*${met}\\s*\\((${fig}\\s*${imp})\\)`, "g"), "$1")
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*m(?:²|2\b)/g, (_m, t, a) => `${t}${ftArea(num(a))} ${FT2(ftArea(num(a)))}`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*cm(?:²|2\b)/g, (_m, t, a) => `${t}${inArea(num(a))} ${copy.unitIn2}`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)(\s*[-–]\s*)(\d+(?:[.,]\d+)?)\s*m(?![²2])\b/g, (_m, t, a, dash, b) => `${t}${ft(num(a))}${dash}${ft(num(b))} ${copy.unitFeetProse}`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*m(?![²2])\b/g, (_m, t, a) => `${t}${ft(num(a))} ${+ft(num(a)) === 1 ? copy.unitFtOne : copy.unitFeetProse}`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)(\s*[-–]\s*)(\d+(?:[.,]\d+)?)\s*cm(?![²2])\b/g, (_m, t, a, dash, b) => `${t}${inch(num(a))}${dash}${inch(num(b))} ${copy.unitInchesProse}`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*cm(?![²2])\b/g, (_m, t, a) => `${t}${inch(num(a))} ${copy.unitInchesProse}`);
};
const DEVICE_KEYS = [KEY, TEMP_KEY, THEME_KEY, SEASON_KEY, REMIND_KEY, PACE_KEY, HOUSE_KEY, SPACE_KEY, AFTER_KEY, PREF_AT_KEY, "gg-lang"];
const ASIDE_KEY = "gg-prefs-device";
function setDevicePrefsAside() {
    try {
        const aside = {};
        for (const k of DEVICE_KEYS)
            aside[k] = localStorage.getItem(k);
        localStorage.setItem(ASIDE_KEY, JSON.stringify(aside));
    }
    catch { }
}
function restoreDevicePrefs() {
    let aside = {};
    try {
        const raw = localStorage.getItem(ASIDE_KEY);
        const v = raw ? JSON.parse(raw) : null;
        if (v && typeof v === "object")
            aside = v;
    }
    catch { }
    const get = (k) => (typeof aside[k] === "string" ? aside[k] : null);
    try {
        for (const k of DEVICE_KEYS) {
            const v = get(k);
            if (v == null)
                localStorage.removeItem(k);
            else
                localStorage.setItem(k, v);
        }
        localStorage.removeItem(ASIDE_KEY);
    }
    catch { }
    system = get(KEY) === "metric" ? "metric" : "imperial";
    temp = get(TEMP_KEY) === "c" ? "c" : "f";
    const t = get(THEME_KEY);
    theme = t === "light" || t === "dark" ? t : "system";
    const s = get(SEASON_KEY);
    season = s && SEASONS.includes(s) ? s : "follow";
    const r = get(REMIND_KEY);
    remind = r === "evening" || r === "none" ? r : "morning";
    const p = get(PACE_KEY);
    pace = p === "full" || p === "light" ? p : null;
    let h = null;
    try {
        h = JSON.parse(get(HOUSE_KEY) ?? "null");
    }
    catch { }
    household = houseOk(h) ? h : null;
    const sp = get(SPACE_KEY);
    space = sp && SPACES.includes(sp) ? sp : null;
    const af = get(AFTER_KEY);
    after = af && AFTERS.includes(af) ? af : null;
    applyTheme();
    applySeason();
    const l = get("gg-lang");
    return (l === "es" ? "es" : "en") !== appLang();
}

const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
const MIN_SEASONS = 3;
const OWN_RECORD = "garden_own_log";
function doyMd(m, d) {
    return m >= 1 && m <= 12 ? CUM[m - 1] + d : null;
}
function mmddDoy(s) {
    if (typeof s !== "string")
        return null;
    const parts = s.split("-");
    if (parts.length !== 2)
        return null;
    const m = Number(parts[0]), d = Number(parts[1]);
    if (!Number.isInteger(m) || !Number.isInteger(d))
        return null;
    return doyMd(m, d);
}
function obsDoy(date) {
    if (typeof date !== "string" || date.length < 10)
        return null;
    const m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
    if (!Number.isInteger(m) || !Number.isInteger(d))
        return null;
    return doyMd(m, d);
}
function fromDoy(doy) {
    const n = Math.max(1, Math.min(365, Math.floor(doy + 0.5)));
    for (let m = 0; m < 12; m++) {
        if (n < STARTS[m + 1])
            return `${String(m + 1).padStart(2, "0")}-${String(n - STARTS[m] + 1).padStart(2, "0")}`;
    }
    return "12-31";
}
function median(vals) {
    const s = [...vals].sort((a, b) => a - b);
    const n = s.length;
    const mid = n >> 1;
    return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function seasonBoundaryDoy(season, isSpring, lat) {
    let best = null;
    for (const o of season.observations ?? []) {
        if (o.event !== "frost")
            continue;
        const doy = obsDoy(o.date);
        if (doy === null)
            continue;
        const side = frostSide(doy, lat);
        if (isSpring) {
            if (side === "spring" && (best === null || doy > best))
                best = doy;
        }
        else if (side === "fall" && (best === null || doy < best))
            best = doy;
    }
    return best;
}
function boundary(seasons, modelMmdd, isSpring, lat, own) {
    const modelDoy = mmddDoy(modelMmdd);
    const points = [];
    const observed = [];
    for (const s of seasons ?? []) {
        const od = seasonBoundaryDoy(s, isSpring, lat);
        if (od === null || (modelDoy === null && !own))
            continue;
        observed.push(od);
        points.push({
            season: s.id,
            observed: fromDoy(od),
            model: modelMmdd,
            offset_days: own ? null : od - modelDoy,
        });
    }
    points.sort((a, b) => a.season - b.season);
    const n = points.length;
    const calibrated = n >= MIN_SEASONS;
    if (own) {
        return { n, per_season: points, median_offset_days: null, offset_range: null, calibrated,
            calibrated_date: calibrated ? fromDoy(median(observed)) : null, own: true };
    }
    const offsets = points.map((p) => p.offset_days);
    const med = offsets.length ? median(offsets) : null;
    const calibratedDate = calibrated && modelDoy !== null && med !== null ? fromDoy(modelDoy + med) : null;
    return {
        n,
        per_season: points,
        median_offset_days: med,
        offset_range: offsets.length ? [Math.min(...offsets), Math.max(...offsets)] : null,
        calibrated,
        calibrated_date: calibratedDate,
        own: false,
    };
}
function shiftFrostDate(mmdd, days) {
    const doy = mmddDoy(mmdd);
    return doy === null ? mmdd : fromDoy(doy + days);
}
function frostCalibration(seasons, site, lat) {
    const own = !site || site.provenance?.method === OWN_RECORD;
    const la = site ? site.lat : lat;
    const modelSpring = own ? null : (site?.last_frost_32f ?? {}).p50 ?? null;
    const modelFall = own ? null : site?.first_freeze_32f_p50 ?? null;
    return {
        min_seasons: MIN_SEASONS,
        model: { last_frost_p50: modelSpring, first_freeze_p50: modelFall },
        spring: boundary(seasons, modelSpring, true, la, own),
        fall: boundary(seasons, modelFall, false, la, own),
    };
}
function ownFrostSite(cal, lat, lon) {
    const sp = cal.spring.own && cal.spring.calibrated ? cal.spring.calibrated_date : null;
    const fa = cal.fall.own && cal.fall.calibrated ? cal.fall.calibrated_date : null;
    if (!sp && !fa)
        return null;
    return {
        key: "own_log", lat, lon,
        last_frost_32f: sp ? { p50: sp } : {},
        first_freeze_32f_p50: fa,
        provenance: { method: OWN_RECORD, seasons: Math.max(cal.spring.n, cal.fall.n) },
    };
}

const stationLabel = (st) => stationDisplay(st.name);
const stationWordOf = (st) => stationFrostWord(st.winters, st.frost_winters);
const datesStationOf = (site) => site?.frost_provenance?.station ?? null;
const datesCitation = (bundle) => bundle?.global_frost?.stations_source?.citation ?? null;
function datesPlaceLine(site) {
    const ds = datesStationOf(site);
    return !ds ? null : ds.km < 1.6 ? fillCopy("plClimateAtStation", { station: stationLabel(ds) })
        : fillCopy("plClimateStation", { dist: fmtKm(ds.km), station: stationLabel(ds) });
}
function datesRowQ(site) {
    const ds = datesStationOf(site);
    return ds ? fillCopy("fsRowQ", { station: stationLabel(ds) }) : null;
}
function stationCountQ(site, inYears = false) {
    const st = frostStationOf(site);
    if (!st)
        return null;
    const v = { n: st.frost_winters, years: st.winters, station: stationLabel(st), dist: fmtKm(st.km) };
    return fillCopy(st.frost_winters > 0 ? (inYears ? "fsCountQYears" : "fsCountQ") : (inYears ? "fsCountNoneQYears" : "fsCountNoneQ"), v);
}
function stationModelLine(site) {
    const st = frostStationOf(site), m = site?.frost_model;
    if (!st || !m)
        return null;
    const my = typeof m.years === "number" ? m.years : null, mfy = typeof m.frost_years === "number" ? m.frost_years : null;
    const word = stationWordOf(st);
    if (word === "rare") {
        const p50 = m.last_frost_32f?.p50;
        return p50 && (m.growing_season_days_p50 ?? 365) < 365 && my != null && mfy != null
            ? fillCopy("fsModelAside", { m: mfy, my, date: fmtMonthDay(p50) }) : null;
    }
    if (!frostWord(site))
        return null;
    const gate = frostGate(site ?? null);
    if (gate) {
        const later = my != null && mfy != null && my > 0 && st.winters > 0 && st.frost_winters / st.winters > mfy / my;
        return later ? fillCopy("fsModelLater", { date: fmtMonthDay(gate.date), m: mfy, my }) : null;
    }
    return mfy && my ? fillCopy("fsModelNoDateFew", { m: mfy, my }) : copy.fsModelNoDate;
}
function stationFrostLines(site, garden) {
    const st = frostStationOf(site);
    if (!st || frostPossible(site) === false)
        return [];
    const rare = stationWordOf(st) === "rare";
    const every = st.winters > 0 && st.frost_winters >= st.winters;
    const modelDates = !frostWord(site) && !!site?.last_frost_32f?.p50 && !datesStationOf(site);
    const everyKey = modelDates ? (garden ? "fsNoteBare" : "fsNoteAnswersBare") : (garden ? "fsNoteEvery" : "fsNoteAnswersEvery");
    const note = every && !rare ? fillCopy(everyKey, { dist: fmtKm(st.km) })
        : fillCopy(garden ? (rare ? "fsNoteRare" : "fsNote") : (rare ? "fsNoteAnswersRare" : "fsNoteAnswers"), { dist: fmtKm(st.km) });
    const ds = datesStationOf(site);
    if (ds && !rare) {
        const gate = frostGate(site ?? null), two = ds.id !== st.id;
        const d = { station: stationLabel(ds), years: ds.years, dstation: stationLabel(ds), ddist: fmtKm(ds.km), date: gate ? fmtMonthDay(gate.date) : "" };
        const later = two && ds.winters > 0 && st.frost_winters / st.winters > ds.frost_winters / ds.winters;
        const said = two ? `${fillCopy(stationWordOf(st) === "some" ? "fsWordSome" : "fsWordMost", { station: stationLabel(st), dist: fmtKm(st.km), n: st.frost_winters, years: st.winters })} ` : "";
        const out = !frostWord(site) ? [said + fillCopy(two ? (later ? "fsDatesTwoLater" : "fsDatesTwo") : "fsDates", d)]
            : gate ? [said + fillCopy(two ? (later ? "fsGateTwoLater" : "fsGateTwo") : "fsGate", d)]
                : [note, fillCopy("fsDatesNoDate", d)];
        if (garden)
            out.push(copy.fsOwn);
        return out;
    }
    const lines = [note];
    const model = stationModelLine(site);
    if (model)
        lines.push(model);
    if (!frostWord(site) && site?.last_frost_32f?.p50)
        lines.push(copy.fsModelDates);
    if (garden)
        lines.push(copy.fsOwn);
    return lines;
}
function stationFold(site, rest = "fsDatesFoldRest", countRest = "fsFoldRest") {
    const st = frostStationOf(site);
    if (!st)
        return [];
    const count = { lead: copy.fsFoldLead, rest: fillCopy(countRest, { station: stationLabel(st), dist: fmtKm(st.km),
            n: st.frost_winters, years: st.winters, zero: fmtTemp(0) }) };
    const ds = datesStationOf(site);
    if (!ds)
        return [{ ...count, rest: count.rest + copy.fsFoldModel }];
    const m = site?.frost_model, my = m?.years, mfy = m?.frost_years, p50 = m?.last_frost_32f?.p50;
    const dated = !!p50 && (m?.growing_season_days_p50 ?? 365) < 365;
    const model = typeof my !== "number" || typeof mfy !== "number" ? (dated ? fillCopy("fsDatesFoldModelDateOnly", { date: fmtMonthDay(p50) }) : "")
        : dated ? fillCopy("fsDatesFoldModel", { date: fmtMonthDay(p50), m: mfy, my })
            : fillCopy(mfy ? "fsDatesFoldModelNoDate" : "fsDatesFoldModelNone", { m: mfy, my });
    return [{ lead: copy.plFrostDatesRow, rest: fillCopy(rest, { station: stationLabel(ds), id: ds.id, dist: fmtKm(ds.km), years: ds.years }) + model }, count];
}
function nearerFoldRow(site, spot = false) {
    const n = site?.frost_nearer;
    if (!n)
        return null;
    const key = n.days_sooner ? "fsNearerSooner" : !n.frost_winters ? "fsNearerNone"
        : 2 * n.frost_winters < n.winters ? "fsNearerFew" : "fsNearerLate";
    return { lead: copy.fsNearerLead, rest: fillCopy(key, { station: stationDisplay(n.name), dist: fmtKm(n.km),
            place: spot ? copy.fsNearerSpot : copy.fsNearerGarden, date: n.last_frost_p50 ? fmtMonthDay(n.last_frost_p50) : "",
            days: n.days_sooner ?? 0, k: n.frost_winters, n: n.winters }) };
}
function warmTipKey(site, care) {
    if (givenFrostGate(site))
        return care ? "clWarmTipCareGiven" : "clWarmTipGiven";
    if (givenFirstFrost(site))
        return care ? "clWarmTipCareFirstGiven" : "clWarmTipFirstGiven";
    const w = frostWord(site);
    if (care)
        return w === "most" ? "clWarmTipCareMost" : w === "some" ? "clWarmTipCareSome" : "clWarmTipCare";
    return w === "most" ? "clWarmTipMost" : w === "some" ? "clWarmTipSome" : "clWarmTip";
}
function stationMarkerTip(clim, word) {
    const st = frostStationOf(clim?.site), ds = datesStationOf(clim?.site);
    if (!st || !clim)
        return null;
    if (ds)
        return fillCopy("clStationDatesTip", { station: stationLabel(ds), dist: fmtKm(ds.km), word, min: MIN_SEASONS });
    return fillCopy("clStationCountTip", { station: stationLabel(st), dist: fmtKm(st.km), cdist: fmtKm(clim.distanceKm), word, min: MIN_SEASONS });
}

const CONFIDENCE = appLang() === "es"
    ? Object.fromEntries(Object.entries(CONFIDENCE$1).map(([g, c]) => [g, { ...c, ...CONFIDENCE_ES[g] }]))
    : CONFIDENCE$1;
function confidenceWord(grade) {
    return CONFIDENCE[(grade ?? "").trim().toUpperCase()]?.word ?? null;
}
const CONFIDENCE_GLOSS = Object.fromEntries(Object.entries(CONFIDENCE).map(([g, c]) => [g, c.gloss]));
function gradeClassOfWord(word) {
    const w = (word ?? "").trim().toLowerCase();
    const hit = Object.values(CONFIDENCE).find((c) => c.word.toLowerCase() === w)
        ?? Object.values(CONFIDENCE$1).find((c) => c.word.toLowerCase() === w);
    return hit?.cls ?? "";
}
let confSeq = 0;
function confidenceBadge(grade) {
    const key = (grade || "").trim().toUpperCase();
    const c = CONFIDENCE[key];
    if (!c)
        return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `conf ${c.cls}`;
    btn.setAttribute("aria-expanded", "false");
    const mk = document.createElement("span");
    mk.className = "mk";
    btn.appendChild(mk);
    btn.appendChild(document.createTextNode(c.word));
    let note = null;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!note) {
            note = document.createElement("span");
            note.className = "conf-g";
            note.id = `conf-g-${++confSeq}`;
            note.setAttribute("role", "note");
            note.textContent = `${c.word}: ${CONFIDENCE_GLOSS[key]}`;
            btn.setAttribute("aria-controls", note.id);
            btn.insertAdjacentElement("afterend", note);
        }
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
    });
    return btn;
}
function refutationVerdict(rule) {
    if (!rule || !rule.claim_refuted || rule.claim)
        return null;
    return ["C", "D"].includes(String(rule.grade ?? "").trim().toUpperCase()) ? "partly" : "out";
}
function shownGrade(rule) {
    return refutationVerdict(rule) === "out" ? "F" : String(rule.grade ?? "").trim().toUpperCase();
}
function ruleStanding(rule) {
    const out = [];
    if (refutationVerdict(rule) === "partly") {
        const said = document.createElement("span");
        said.className = "partly";
        said.textContent = `${copy.pcPartlyHolds} `;
        out.push(said);
    }
    const badge = confidenceBadge(shownGrade(rule));
    if (badge)
        out.push(badge);
    return out;
}

const fam = (f) => familyName(f.trim());
const famP = (f) => familyInProse(f.trim());
const famList = (s) => new Intl.ListFormat(dateLocale(), { type: "conjunction" }).format(s.split(/\s*,\s*/).filter(Boolean).map(famP));
const SHAPES = [
    [/^ground carried ([a-z]+aceae)$/i, (m) => fillCopy("rsCarried", { family: fam(m[1]) })],
    [/^Verticillium-susceptible; ground held Solanaceae$/i, () => copy.rsVertNightshade],
    [/^Verticillium-susceptible; ground held a logged Verticillium host$/i, () => copy.rsVertHost],
    [/^([a-z]+aceae) grew here in (\d{4}); residue mineralizes N for this season's crop$/i,
        (m) => fillCopy("rsResidueN", { family: famP(m[1]), year: m[2] })],
    [/^an allium or apiaceous planting breaks the cycle of every family this ground is holding$/i, () => copy.rsBreakAll],
    [/^ground is within the rotation interval for (.+); an allium or apiaceous crop is unrelated to all three and breaks the host cycle$/i,
        (m) => fillCopy("rsIntervalBreak", { families: famList(m[1]) })],
    [/^([a-z]+aceae) is still inside its rotation interval here$/i, (m) => fillCopy("rsStillInside", { family: fam(m[1]) })],
    [/^deposits a full legume green-manure load; next season's heavy feeder collects the credit$/i, () => copy.rsBanksN],
    [/^needs (\d+(?:\.\d+)?) days to mature; window is (\d+)$/i, (m) => fillCopy("rsNeedsDays", { dtm: m[1], window: m[2] })],
    [/^needs (\d+(?:\.\d+)?) days to mature; window to the first hard freeze is (\d+)$/i, (m) => fillCopy("rsNeedsDaysHard", { dtm: m[1], window: m[2] })],
    [/^needs full sun; bed is .+$/i, () => copy.rsFullSun],
    [/^zone (\S+) is below the modelled (\S+)-(\S+); colder than this plant is winter-hardy to$/i,
        (m) => fillCopy("rsZoneBelow", { zone: m[1], lo: m[2], hi: m[3] })],
    [/^zone (\S+) is above the modelled (\S+)-(\S+); the warm limit is a cultivar's, so look for one rated for your zone$/i,
        (m) => fillCopy("rsZoneAbove", { zone: m[1], lo: m[2], hi: m[3] })],
];
function climateCaveat(km) {
    if (km <= 2)
        return copy.climCaveatOnSite;
    return fillCopy(km <= 80 ? "climCaveatNear" : "climCaveatFar", { dist: fmtKm(km) });
}
function reasonText(why) {
    const w = String(why ?? "").trim();
    for (const [re, say] of SHAPES) {
        const m = w.match(re);
        if (m)
            return say(m);
    }
    return stripRuleCitations(humanizeFamilies(w));
}

function squareText(square, distKm, stationDates = false, lead = "") {
    if (!square)
        return "";
    const h = square.height;
    const parts = [];
    if (lead)
        parts.push(lead);
    if (square.water)
        parts.push(fillCopy("wsqWater", { ndist: fmtKm(square.water.km), dist: fmtKm(distKm) }));
    if (square.only_water)
        parts.push(copy.wsqOnlyWater, ...(stationDates ? [] : [copy.wsqOnlyWaterFrost]));
    if (h) {
        parts.push(fillCopy(h.town_km < 1 ? "wsqHeight" : "wsqHeightTown", {
            dist: fmtKm(distKm), ground: fmtHeight(h.ground_m), height: fmtHeight(h.m), tdist: fmtKm(h.town_km),
            ndist: fmtKm(h.near_km), nground: fmtHeight(h.near_ground_m),
        }));
    }
    return parts.join(" ");
}

function fitTier(guild, bedW, bedL, region) {
    if (bedW == null || bedL == null || !(bedW * bedL > 0))
        return null;
    const fm = guild.footprint_min_m2 ?? 0;
    let ratio = fm / (bedW * bedL);
    if (guild.ground_entity === "radial_rings") {
        const ring = radialRingsFromFootprint(fm);
        if (ring && region?.shape !== "polygon")
            ratio = Math.max(ratio, (ring.r * 2) / Math.min(bedW, bedL));
    }
    else if (isHillsGuild(guild)) {
        ratio = Math.max(ratio, MOUND_MIN_SPAN_M / Math.min(bedW, bedL));
    }
    return ratio <= 0.6 ? "full" : ratio <= 0.85 ? "adequate" : "marginal";
}
const ruleById = (bundle) => new Map(bundle.rules.map((r) => [r.id, r]));
function reasonFor(guild, rules) {
    const fr = guild.footprint_reason;
    if (typeof fr === "string" && /^R-\d+/.test(fr)) {
        const rule = rules.get(fr);
        const text = rule?.mechanism || rule?.claim || `see ${fr}`;
        return { ruleId: fr, text: String(text).trim() };
    }
    return { ruleId: null, text: (fr || "needs more space than this bed").toString().trim() };
}
function fitsBed(guild, bedW, bedL, region) {
    const fmin = guild.footprint_min_m2 ?? 0;
    if (guild.ground_entity === "radial_rings") {
        const ring = radialRingsFromFootprint(fmin);
        if (!ring)
            return fmin <= bedW * bedL;
        if (region && region.shape === "polygon")
            return circleFitsRegion(ring, region);
        return circleFitsRect(ring, bedW, bedL);
    }
    if (isHillsGuild(guild)) {
        if (region && region.shape === "polygon") {
            if (!circleFitsRegion({ r: MOUND_MIN_SPAN_M / 2 }, region))
                return false;
        }
        else if (Math.min(bedW, bedL) < MOUND_MIN_SPAN_M)
            return false;
    }
    return fmin <= bedW * bedL;
}
function isMoundGuild(guild) {
    return guild.guild_class === "polyculture" && (guild.roles ?? []).some((r) => r.id === "support");
}
function laysOutAsHills(guild) {
    return guild.guild_class === "polyculture" && guild.ground_entity !== "radial_rings"
        && (guild.roles ?? []).some((r) => r.id === "support");
}
function isHillsGuild(guild) {
    if (guild.layout === "shelter")
        return false;
    return (guild.roles ?? []).some((r) => r.canonical === "zea_mays");
}
function isPerennialGuild(guild) {
    return guild.ground_entity === "radial_rings"
        || (guild.guild_class === "perennial_guild" && (guild.roles ?? []).some((r) => r.id === "canopy"));
}
function guildStatus(guild, bedW, bedL, bundle, structure, region) {
    const moundOnRaised = structure === "raised" && isMoundGuild(guild);
    const perennialOffGround = isPerennialGuild(guild)
        && (structure === "raised" || structure === "field" || structure === "container");
    const spaceFits = bedW == null || bedL == null || fitsBed(guild, bedW, bedL, region);
    if (!moundOnRaised && !perennialOffGround && spaceFits) {
        return { guild, fits: true, reason: null, offer: null, tier: fitTier(guild, bedW, bedL, region), spaceFits };
    }
    const offer = bundle.guilds
        .filter((g) => g.derived_from === guild.id && (bedW == null || bedL == null || fitsBed(g, bedW, bedL, region))
        && !(structure === "raised" && isMoundGuild(g))
        && !(isPerennialGuild(g) && (structure === "raised" || structure === "field" || structure === "container")))
        .sort((a, b) => (b.footprint_min_m2 ?? 0) - (a.footprint_min_m2 ?? 0))[0] ?? null;
    const ring = guild.ground_entity === "radial_rings" ? radialRingsFromFootprint(guild.footprint_min_m2 ?? 0) : null;
    const ringOnTrace = !!ring && region?.shape === "polygon";
    const hillsNarrow = isHillsGuild(guild) && bedW != null && bedL != null
        && (guild.footprint_min_m2 ?? 0) <= bedW * bedL;
    const reason = perennialOffGround
        ? { ruleId: "R-076",
            text: "a fruit tree needs deep, permanent ground; plant it in-ground, not a raised bed, a tilled field, or a container." }
        : moundOnRaised
            ? { ruleId: "R-098",
                text: "this team is planted on mounds you tend by walking between them; a raised bed is reached from its edges and never stepped in. Grow it in-ground or as a field, or pick a bed-friendly team." }
            : ring && !offer
                ? { ruleId: "R-073",
                    text: ringOnTrace
                        ? `the drip-line ring is ~${(2 * ring.r).toFixed(1)} m across and no part of this bed's outline is wide enough to hold it - a round footprint wants an open, square-ish area`
                        : `the drip-line ring is ~${(2 * ring.r).toFixed(1)} m across and needs a wider bed - a round footprint wants a square-ish bed` }
                : hillsNarrow
                    ? { ruleId: null,
                        text: `this team plants on mounds about ${MOUND_MIN_SPAN_M} m across (corn on hills, squash working the ground between); this bed is narrower than one mound` }
                    : reasonFor(guild, ruleById(bundle));
    return { guild, fits: false, offer, reason, tier: null, spaceFits };
}
const SECTION_ORDER = ["teams", "rings", "bundles", "rest"];
const BAND_RANK = { backed: 0, partial: 1, none: 2 };
function guildSection(guild) {
    const gc = guild.guild_class;
    if (gc === "restorative")
        return "rest";
    if (gc === "culinary_bundle" || gc === "ornamental_bundle")
        return "bundles";
    if (gc === "perennial_guild" && guild.ground_entity === "radial_rings")
        return "rings";
    if (gc === "polyculture" || gc === "perennial_guild")
        return "teams";
    return null;
}
function bandRank(band) {
    return BAND_RANK[band ?? ""] ?? Object.keys(BAND_RANK).length;
}
const TIER_RANK = { full: 0, adequate: 1, marginal: 2 };
function shortlistRank(band, tier) {
    return bandRank(band) * 10 + (TIER_RANK[tier ?? "marginal"] ?? 2);
}
function browsableGuilds(bundle) {
    const SHOWN = new Set(["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle",
        "restorative"]);
    return bundle.guilds.filter((g) => SHOWN.has(g.guild_class) && !g.derived_from);
}
function derivedGuilds(parentId, bundle) {
    return bundle.guilds
        .filter((g) => g.derived_from === parentId)
        .sort((a, b) => (a.footprint_min_m2 ?? 0) - (b.footprint_min_m2 ?? 0));
}
let localName = null;
function useLocalGuildNames(fn) { localName = fn; }
function displayName(guild) {
    const local = localName?.(guild.id);
    if (local)
        return local;
    const raw = nameAsLabel(titleCase(guild.common?.[0] ?? humanize(guild.id)).replace(/\bGuild\b/g, "Team"));
    return raw.replace(/^([^\s,]+) ([^\s,]+) and (\S+)$/, "$1, $2 and $3");
}

const mod = appLang() === "es" ? await import('./corpus-es.gen.js') : null;
const table = mod?.corpusEs ?? {};
const speciesNames = mod?.speciesNameEs ?? {};
const regional = mod?.regionalEs ?? {};
function regionalName(text, country) {
    const words = country && regional[country];
    if (!words)
        return text;
    return text.replace(new RegExp(`\\b(${Object.keys(words).join("|")})\\b`, "gi"), (m) => {
        const w = words[m.toLowerCase()];
        return m[0] === m[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
    });
}
function speciesNameEs(sid) {
    return speciesNames[sid] ?? null;
}
function corpusEs(id, field) {
    return table[`${id}.${field}`] ?? null;
}
if (appLang() === "es")
    useLocalGuildNames((id) => table[`${id}.name`] ?? null);
function teamClaim(guild, claim) {
    if (appLang() !== "es")
        return claim;
    const ms = (Array.isArray(guild.mechanisms) ? guild.mechanisms : []);
    const i = ms.findIndex((m) => m && String(m.claim ?? "") === claim);
    return (i >= 0 ? table[`${String(guild.id)}.mechanisms.${i}`] : undefined) ?? claim;
}
function corpusText(id, field, english) {
    return table[`${id}.${field}`] ?? english;
}
const corpusWantsEs = () => appLang() === "es";

const LIFESPANS = ["annual", "biennial", "perennial"];
const FROST_TOLERANCES = ["very_tender", "tender", "half_hardy", "hardy"];
const LIGHT_LEVELS = ["full_sun", "part_sun", "part_shade", "full_shade"];
const FEEDER_CLASSES = ["heavy", "moderate", "light", "fixer", "none"];
const GROUND_COVERAGES = ["none", "low", "moderate", "high"];
const POLLINATOR_VALUES = ["none", "low", "moderate", "high", "very_high"];
const SOW_SEASONS = ["spring", "fall"];
const SUPPORT_PROVIDES = ["none", "weak", "strong"];
const SUPPORT_REQUIRES = ["none", "weak", "moderate", "optional_strong", "strong"];
const USER_SPECIES_FIELDS = new Set(["id", "source", "common", "family", "lifespan",
    "frost_tolerance", "light_min", "feeder_class", "n_fixing", "habit", "ground_coverage",
    "casts_shade", "pollinator_value", "volatile_aromatic", "verticillium_susceptible",
    "mature_height_cm", "mature_spread_cm", "days_to_maturity", "hardiness_zone", "support", "notes",
    "succession_interval_days", "start_indoors_weeks", "sow_season", "night_temp_max_c"]);
const SUPPORT_FIELDS = new Set(["provides", "requires", "provides_load_vines"]);
const ROLE_TRAITS = ["habit", "n_fixing", "casts_shade", "ground_coverage", "pollinator_value",
    "volatile_aromatic", "frost_tolerance", "light_min", "feeder_class", "mature_height_cm",
    "mature_spread_cm", "support"];
const ID_RE$1 = /^user:[a-z0-9_]+$/;
const USER_SPECIES_NAME_MAX = 200;
const USER_SPECIES_TEXT_MAX = 5000;
const got$2 = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord$1 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum$1 = (v) => typeof v === "number" && Number.isFinite(v);
function isMeasure(v) {
    if (isNum$1(v))
        return true;
    if (Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every(isNum$1)) {
        return v.length === 1 || v[0] <= v[1];
    }
    return false;
}
function unknownFields$1(rec, allowed, prefix, errors) {
    for (const k of Object.keys(rec).filter((k) => !allowed.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
}
function checkEnum(rec, key, allowed, prefix, errors) {
    if (key in rec && !allowed.includes(rec[key])) {
        errors.push(`${prefix}.${key}: ${got$2(rec, key)} is not one of ${allowed.join(" | ")}`);
    }
}
function checkBool(rec, key, prefix, errors) {
    if (key in rec && typeof rec[key] !== "boolean") {
        errors.push(`${prefix}.${key}: expected true or false, got ${got$2(rec, key)}`);
    }
}
function checkMeasure(rec, key, prefix, errors) {
    if (key in rec && !isMeasure(rec[key])) {
        errors.push(`${prefix}.${key}: expected a number or [lo, hi], got ${got$2(rec, key)}`);
    }
}
function validateUserSpecies(raw, prefix = "user_species") {
    if (!isRecord$1(raw))
        return [`${prefix}: not a record`];
    const errors = [];
    unknownFields$1(raw, USER_SPECIES_FIELDS, prefix, errors);
    if (typeof raw.id !== "string" || !ID_RE$1.test(raw.id)) {
        errors.push(`${prefix}.id: expected "user:<slug>" (lowercase a-z 0-9 _), got ${got$2(raw, "id")}`);
    }
    if (!("common" in raw)) {
        errors.push(`${prefix}.common: a plant needs a name, got missing`);
    }
    else {
        const common = raw.common;
        if (typeof common === "string") {
            if (common === "")
                errors.push(`${prefix}.common: expected a non-empty name, got ${JSON.stringify(common)}`);
            else if (common.length > USER_SPECIES_NAME_MAX)
                errors.push(`${prefix}.common: longer than ${USER_SPECIES_NAME_MAX} characters`);
        }
        else if (Array.isArray(common)) {
            if (common.length === 0 || !common.every((x) => typeof x === "string" && x !== "")) {
                errors.push(`${prefix}.common: expected non-empty names, got ${JSON.stringify(common)}`);
            }
            else if (common.some((x) => x.length > USER_SPECIES_NAME_MAX)) {
                errors.push(`${prefix}.common: a name longer than ${USER_SPECIES_NAME_MAX} characters`);
            }
        }
        else {
            errors.push(`${prefix}.common: expected a name or list of names, got ${JSON.stringify(common)}`);
        }
    }
    if ("source" in raw && raw.source !== "user") {
        errors.push(`${prefix}.source: must be "user" if present, got ${got$2(raw, "source")}`);
    }
    if ("family" in raw && (typeof raw.family !== "string" || raw.family === "")) {
        errors.push(`${prefix}.family: expected a non-empty family name, got ${got$2(raw, "family")}`);
    }
    else if ("family" in raw && raw.family.length > USER_SPECIES_NAME_MAX) {
        errors.push(`${prefix}.family: longer than ${USER_SPECIES_NAME_MAX} characters`);
    }
    if ("habit" in raw && (typeof raw.habit !== "string" || raw.habit === "")) {
        errors.push(`${prefix}.habit: expected a non-empty habit, got ${got$2(raw, "habit")}`);
    }
    else if ("habit" in raw && raw.habit.length > USER_SPECIES_NAME_MAX) {
        errors.push(`${prefix}.habit: longer than ${USER_SPECIES_NAME_MAX} characters`);
    }
    checkEnum(raw, "lifespan", LIFESPANS, prefix, errors);
    checkEnum(raw, "frost_tolerance", FROST_TOLERANCES, prefix, errors);
    checkEnum(raw, "light_min", LIGHT_LEVELS, prefix, errors);
    checkEnum(raw, "feeder_class", FEEDER_CLASSES, prefix, errors);
    checkEnum(raw, "ground_coverage", GROUND_COVERAGES, prefix, errors);
    checkEnum(raw, "pollinator_value", POLLINATOR_VALUES, prefix, errors);
    checkEnum(raw, "sow_season", SOW_SEASONS, prefix, errors);
    for (const key of ["n_fixing", "casts_shade", "volatile_aromatic", "verticillium_susceptible"]) {
        checkBool(raw, key, prefix, errors);
    }
    for (const key of ["mature_height_cm", "mature_spread_cm", "days_to_maturity", "succession_interval_days"]) {
        checkMeasure(raw, key, prefix, errors);
    }
    if ("start_indoors_weeks" in raw
        && !(isNum$1(raw.start_indoors_weeks) && raw.start_indoors_weeks >= 0)) {
        errors.push(`${prefix}.start_indoors_weeks: expected a non-negative number, `
            + `got ${got$2(raw, "start_indoors_weeks")}`);
    }
    if ("night_temp_max_c" in raw && !isNum$1(raw.night_temp_max_c)) {
        errors.push(`${prefix}.night_temp_max_c: expected a number, got ${got$2(raw, "night_temp_max_c")}`);
    }
    if ("hardiness_zone" in raw) {
        const hz = raw.hardiness_zone;
        const ok = Array.isArray(hz) && hz.length === 2 && hz.every(isNum$1) && hz[0] <= hz[1];
        if (!ok)
            errors.push(`${prefix}.hardiness_zone: expected [lo, hi] zones, got ${got$2(raw, "hardiness_zone")}`);
    }
    if ("support" in raw) {
        const support = raw.support;
        if (!isRecord$1(support)) {
            errors.push(`${prefix}.support: expected a record, got ${got$2(raw, "support")}`);
        }
        else {
            for (const k of Object.keys(support).filter((k) => !SUPPORT_FIELDS.has(k)).sort()) {
                errors.push(`${prefix}.support: unknown field "${k}"`);
            }
            for (const k of ["provides", "requires"]) {
                if (k in support && (typeof support[k] !== "string" || support[k] === "")) {
                    errors.push(`${prefix}.support.${k}: expected a non-empty string, got ${got$2(support, k)}`);
                }
                else if (k in support && support[k].length > USER_SPECIES_NAME_MAX) {
                    errors.push(`${prefix}.support.${k}: longer than ${USER_SPECIES_NAME_MAX} characters`);
                }
            }
            if ("provides_load_vines" in support
                && !(isNum$1(support.provides_load_vines) && support.provides_load_vines >= 0)) {
                errors.push(`${prefix}.support.provides_load_vines: expected a non-negative number, `
                    + `got ${got$2(support, "provides_load_vines")}`);
            }
        }
    }
    if ("notes" in raw && typeof raw.notes !== "string") {
        errors.push(`${prefix}.notes: expected a string, got ${got$2(raw, "notes")}`);
    }
    else if ("notes" in raw && raw.notes.length > USER_SPECIES_TEXT_MAX) {
        errors.push(`${prefix}.notes: longer than ${USER_SPECIES_TEXT_MAX} characters`);
    }
    return errors;
}
function capabilities$1(raw) {
    const has = (key) => key in raw && raw[key] !== null && raw[key] !== undefined;
    const rotation = Boolean(raw.family);
    const placement = has("mature_spread_cm");
    const schedule = has("days_to_maturity");
    const guild_role = ROLE_TRAITS.some((t) => has(t));
    const limits = [];
    if (!rotation)
        limits.push("rotation history not tracked: no family");
    if (!placement)
        limits.push("cannot be placed in a bed: no mature_spread_cm");
    if (!schedule)
        limits.push("no calendar dates: no days_to_maturity");
    if (!guild_role)
        limits.push("cannot fill a guild role: no matchable traits");
    return { rotation, placement, schedule, guild_role, limits };
}
function mergeUserSpecies(bundle, records) {
    const extra = [];
    for (const rec of records ?? []) {
        if (!isRecord$1(rec))
            continue;
        const sid = rec.id;
        if (typeof sid !== "string" || !ID_RE$1.test(sid))
            continue;
        const merged = { ...rec, source: "user" };
        if (typeof merged.family === "string")
            merged.family = merged.family.toLowerCase();
        extra.push(merged);
    }
    return { ...bundle, species: [...bundle.species, ...extra] };
}

const OBSERVATION_EVENTS = ["note", "frost", "heat"];
const OBSERVATION_SEVERITIES = ["light", "hard"];
const END_CAUSES = ["frost", "disease", "pest", "pulled", "drought", "unknown"];
const FAILURE_SEVERITIES = ["light", "moderate", "severe"];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const validPlantingId = (v) => typeof v === "string" && ID_RE.test(v);
const TOMB_FIELDS = new Set(["id", "at"]);
const PLANTED_FROM_FIELDS = new Set(["area", "guild"]);
const SET_ASIDE_FIELDS = new Set(["job", "at", "back"]);
function validTombAt(v) {
    if (typeof v !== "string" || v.length !== 20 || v[10] !== "T" || !v.endsWith("Z"))
        return false;
    if (!validDate(v.slice(0, 10)))
        return false;
    const [h, m, sec] = v.slice(11, 19).split(":").map(Number);
    return Number.isInteger(h) && Number.isInteger(m) && Number.isInteger(sec)
        && h >= 0 && h <= 23 && m >= 0 && m <= 59 && sec >= 0 && sec <= 59;
}
const SEASON_FIELDS = new Set(["id", "plot", "plan", "observations", "plantings", "outcome_notes", "closed_date",
    "removed_plantings", "removed_observations", "next_plan", "planted_from", "set_aside"]);
const OBSERVATION_FIELDS = new Set(["id", "date", "event", "severity", "damage", "note"]);
const PLANTING_FIELDS = new Set(["id", "species", "cultivar_group", "variety", "region", "sown", "transplanted",
    "first_harvest", "last_harvest", "end_cause", "end_date", "carried_over", "yield_kg", "failures", "notes", "composed"]);
const FAILURE_FIELDS = new Set(["date", "mode", "severity"]);
const NOTE_FIELDS = new Set(["date", "text", "photo"]);
const SEASON_NAME_MAX = 200;
const SEASON_TEXT_MAX = 5000;
const SEASON_BLOB_MAX = 20000;
const SEASON_LIST_MAX = 2000;
const got$1 = (rec, key) => (key in rec ? JSON.stringify(rec[key]) : "missing");
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const inVocab = (v, vocab) => typeof v === "string" && vocab.includes(v);
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function validDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s))
        return false;
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    if (m < 1 || m > 12)
        return false;
    let days = DAYS_IN_MONTH[m - 1];
    if (m === 2 && y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))
        days = 29;
    return d >= 1 && d <= days;
}
function unknownFields(rec, allowed, prefix, errors) {
    for (const k of Object.keys(rec).filter((k) => !allowed.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
}
function checkDate(rec, key, prefix, errors, required) {
    if (!(key in rec) && !required)
        return;
    if (!(key in rec) || !validDate(rec[key])) {
        errors.push(`${prefix}.${key}: expected YYYY-MM-DD, got ${got$1(rec, key)}`);
    }
}
function checkStr(rec, key, prefix, errors, what = "a string", max = SEASON_NAME_MAX) {
    if (!(key in rec))
        return;
    const v = rec[key];
    if (typeof v !== "string" || v === "")
        errors.push(`${prefix}.${key}: expected ${what}, got ${got$1(rec, key)}`);
    else if (v.length > max)
        errors.push(`${prefix}.${key}: longer than ${max} characters`);
}
function tooMany(items, prefix, key, errors) {
    if (items.length <= SEASON_LIST_MAX)
        return false;
    errors.push(`${prefix}.${key}: more than ${SEASON_LIST_MAX} entries`);
    return true;
}
function checkOpaqueList(raw, key, errors) {
    if (!(key in raw))
        return;
    const items = raw[key];
    if (!Array.isArray(items)) {
        errors.push(`season.${key}: expected a list, got ${got$1(raw, key)}`);
        return;
    }
    if (tooMany(items, "season", key, errors))
        return;
    items.forEach((entry, i) => {
        if ((JSON.stringify(entry) ?? "").length > SEASON_BLOB_MAX) {
            errors.push(`season.${key}[${i}]: longer than ${SEASON_BLOB_MAX} characters when serialised`);
        }
    });
}
function validateObservation$1(obs, prefix, errors) {
    if (!isRecord(obs)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(obs, OBSERVATION_FIELDS, prefix, errors);
    if ("id" in obs && !validPlantingId(obs.id)) {
        errors.push(`${prefix}.id: expected a short [A-Za-z0-9_-] id, got ${got$1(obs, "id")}`);
    }
    checkDate(obs, "date", prefix, errors, true);
    const event = obs.event;
    if (!inVocab(event, OBSERVATION_EVENTS)) {
        errors.push(`${prefix}.event: ${got$1(obs, "event")} is not one of ${OBSERVATION_EVENTS.join(" | ")}`);
    }
    if (!("severity" in obs)) {
        if (event === "frost") {
            errors.push(`${prefix}.severity: required for a frost observation (${OBSERVATION_SEVERITIES.join(" | ")})`);
        }
    }
    else if (!inVocab(obs.severity, OBSERVATION_SEVERITIES)) {
        errors.push(`${prefix}.severity: ${got$1(obs, "severity")} is not one of ${OBSERVATION_SEVERITIES.join(" | ")}`);
    }
    checkStr(obs, "damage", prefix, errors, "a string", SEASON_TEXT_MAX);
    checkStr(obs, "note", prefix, errors, "a string", SEASON_TEXT_MAX);
}
function validateFailure(f, prefix, errors) {
    if (!isRecord(f)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(f, FAILURE_FIELDS, prefix, errors);
    checkDate(f, "date", prefix, errors, true);
    if (typeof f.mode !== "string" || f.mode === "") {
        errors.push(`${prefix}.mode: expected a failure mode, got ${got$1(f, "mode")}`);
    }
    else if (f.mode.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.mode: longer than ${SEASON_NAME_MAX} characters`);
    }
    if (!inVocab(f.severity, FAILURE_SEVERITIES)) {
        errors.push(`${prefix}.severity: ${got$1(f, "severity")} is not one of ${FAILURE_SEVERITIES.join(" | ")}`);
    }
}
function validateNote(n, prefix, errors) {
    if (!isRecord(n)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(n, NOTE_FIELDS, prefix, errors);
    checkDate(n, "date", prefix, errors, true);
    if (typeof n.text !== "string" || n.text === "") {
        errors.push(`${prefix}.text: expected note text, got ${got$1(n, "text")}`);
    }
    else if (n.text.length > SEASON_TEXT_MAX) {
        errors.push(`${prefix}.text: longer than ${SEASON_TEXT_MAX} characters`);
    }
    if ("photo" in n && (typeof n.photo !== "string" || n.photo === ""
        || n.photo.includes("/") || n.photo.includes("\\"))) {
        errors.push(`${prefix}.photo: expected a photo filename, got ${got$1(n, "photo")}`);
    }
    else if (typeof n.photo === "string" && n.photo.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.photo: longer than ${SEASON_NAME_MAX} characters`);
    }
}
function validatePlanting(p, prefix, errors, complete) {
    if (!isRecord(p)) {
        errors.push(`${prefix}: not a record`);
        return;
    }
    unknownFields(p, PLANTING_FIELDS, prefix, errors);
    if ("id" in p && !validPlantingId(p.id)) {
        errors.push(`${prefix}.id: expected a short [A-Za-z0-9_-] id, got ${got$1(p, "id")}`);
    }
    if (typeof p.species !== "string" || p.species === "") {
        errors.push(`${prefix}.species: expected a species id, got ${got$1(p, "species")}`);
    }
    else if (p.species.length > SEASON_NAME_MAX) {
        errors.push(`${prefix}.species: longer than ${SEASON_NAME_MAX} characters`);
    }
    checkStr(p, "cultivar_group", prefix, errors);
    checkStr(p, "variety", prefix, errors);
    if (!("region" in p)) {
        errors.push(`${prefix}.region: missing (a planting is somewhere)`);
    }
    else {
        try {
            parseRegion(p.region);
        }
        catch (e) {
            errors.push(`${prefix}.region: ${e.message}`);
        }
    }
    for (const key of ["sown", "transplanted", "first_harvest", "last_harvest"]) {
        checkDate(p, key, prefix, errors, false);
    }
    let carried = false;
    if ("carried_over" in p) {
        if (p.carried_over === true)
            carried = true;
        else
            errors.push(`${prefix}.carried_over: expected true, got ${got$1(p, "carried_over")}`);
        if ("end_cause" in p || "end_date" in p) {
            errors.push(`${prefix}.carried_over: a carried-over planting has no end_cause/end_date (it did not end)`);
        }
    }
    if (!carried && (complete || "end_cause" in p || "end_date" in p)) {
        if (!inVocab(p.end_cause, END_CAUSES)) {
            errors.push(`${prefix}.end_cause: ${got$1(p, "end_cause")} is not one of ${END_CAUSES.join(" | ")}`);
        }
        checkDate(p, "end_date", prefix, errors, true);
    }
    if ("yield_kg" in p && (!isNum(p.yield_kg) || p.yield_kg < 0)) {
        errors.push(`${prefix}.yield_kg: expected a non-negative number, got ${got$1(p, "yield_kg")}`);
    }
    if ("failures" in p) {
        if (!Array.isArray(p.failures)) {
            errors.push(`${prefix}.failures: expected a list, got ${got$1(p, "failures")}`);
        }
        else if (!tooMany(p.failures, prefix, "failures", errors)) {
            p.failures.forEach((f, j) => validateFailure(f, `${prefix}.failures[${j}]`, errors));
        }
    }
    if ("notes" in p) {
        if (!Array.isArray(p.notes)) {
            errors.push(`${prefix}.notes: expected a list, got ${got$1(p, "notes")}`);
        }
        else if (!tooMany(p.notes, prefix, "notes", errors)) {
            p.notes.forEach((n, j) => validateNote(n, `${prefix}.notes[${j}]`, errors));
        }
    }
}
function seedNextPlan(prev, target) {
    const seeded = (prev?.next_plan ?? [])
        .filter((e) => e.year === target.id && typeof e.area === "string" && typeof e.guild === "string");
    if (!seeded.length)
        return target;
    const have = new Set((target.plan ?? []).map((e) => e.area));
    const plan = [...(target.plan ?? []),
        ...seeded.filter((e) => !have.has(e.area)).map(({ area, guild, saved }) => ({ area, guild, ...(saved ? { saved } : {}) }))];
    return { ...target, plan };
}
function deriveHistory(candidate, seasons, bundle) {
    const cand = parseRegion(candidate);
    const familyOf = new Map(bundle.species.map((s) => [s.id, s.family]));
    const hostOf = new Map(bundle.species.map((s) => [s.id, !!s.verticillium_host]));
    const leadOf = new Map(bundle.species.map((s) => [s.id, s.allelopathy?.residue_lead_days]));
    const history = {};
    const contributions = [];
    const unknown = [];
    let reservoirHost = false;
    const residueBySeason = new Map();
    let latestAny = null;
    const ordered = [...seasons].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    for (const season of ordered) {
        const sid = String(season.id);
        const families = new Set();
        for (const p of season.plantings ?? []) {
            const overlap = intersectArea(cand, parseRegion(p.region));
            if (overlap <= 0)
                continue;
            if (latestAny === null || sid > latestAny)
                latestAny = sid;
            if (!familyOf.has(p.species)) {
                if (!unknown.includes(p.species))
                    unknown.push(p.species);
                continue;
            }
            const family = familyOf.get(p.species);
            if (!family)
                continue;
            families.add(family);
            if (hostOf.get(p.species))
                reservoirHost = true;
            const lead = leadOf.get(p.species);
            if (typeof lead === "number") {
                const list = residueBySeason.get(sid) ?? [];
                if (!list.some((r) => r.species === p.species))
                    list.push({ species: p.species, lead_days: lead });
                residueBySeason.set(sid, list);
            }
            contributions.push({ season: sid, species: p.species, family, overlap_m2: overlap });
        }
        if (families.size)
            history[sid] = [...families].sort();
    }
    const residueSeasons = [...residueBySeason.keys()].sort();
    const latest = residueSeasons.length ? residueSeasons[residueSeasons.length - 1] : null;
    const allelopathic_residue = latest !== null && latest === latestAny
        ? [...residueBySeason.get(latest)].sort((a, b) => (a.species < b.species ? -1 : a.species > b.species ? 1 : 0))
        : [];
    const last_season_species = latestAny !== null
        ? [...new Set(contributions.filter((c) => c.season === latestAny).map((c) => c.species))].sort()
        : [];
    return { history, contributions, unknown_species: unknown.sort(), verticillium_reservoir: reservoirHost, allelopathic_residue, last_season_species };
}
function forwardCarried(prev, existing) {
    const out = [];
    for (const p of prev) {
        if (p.carried_over !== true || p.end_cause)
            continue;
        if ([...existing, ...out].some((q) => q.species === p.species && intersectArea(parseRegion(q.region), parseRegion(p.region)) > 0))
            continue;
        const fwd = { species: p.species, region: parseRegion(p.region), carried_over: true };
        if (p.cultivar_group)
            fwd.cultivar_group = p.cultivar_group;
        if (p.variety)
            fwd.variety = p.variety;
        if (p.sown)
            fwd.sown = p.sown;
        out.push(fwd);
    }
    return out;
}
function validateSeason(raw, complete = false) {
    if (!isRecord(raw))
        return ["season: not a record"];
    const errors = [];
    unknownFields(raw, SEASON_FIELDS, "season", errors);
    if (!Number.isInteger(raw.id)) {
        errors.push(`season.id: expected an integer year, got ${got$1(raw, "id")}`);
    }
    if (typeof raw.plot !== "string" || raw.plot === "") {
        errors.push(`season.plot: expected a non-empty string, got ${got$1(raw, "plot")}`);
    }
    else if (raw.plot.length > SEASON_NAME_MAX) {
        errors.push(`season.plot: longer than ${SEASON_NAME_MAX} characters`);
    }
    checkOpaqueList(raw, "plan", errors);
    checkOpaqueList(raw, "next_plan", errors);
    checkStr(raw, "outcome_notes", "season", errors, "a string", SEASON_BLOB_MAX);
    checkDate(raw, "closed_date", "season", errors, false);
    for (const key of ["removed_plantings", "removed_observations"]) {
        if (!(key in raw))
            continue;
        const tombs = raw[key];
        if (!Array.isArray(tombs)) {
            errors.push(`season.${key}: expected a list, got ${got$1(raw, key)}`);
        }
        else if (!tooMany(tombs, "season", key, errors)) {
            tombs.forEach((t, i) => {
                if (!isRecord(t)) {
                    errors.push(`${key}[${i}]: not a record`);
                    return;
                }
                unknownFields(t, TOMB_FIELDS, `${key}[${i}]`, errors);
                if (!validPlantingId(t.id)) {
                    errors.push(`${key}[${i}].id: expected a short [A-Za-z0-9_-] id, got ${got$1(t, "id")}`);
                }
                if (!validTombAt(t.at)) {
                    errors.push(`${key}[${i}].at: expected an ISO UTC instant (YYYY-MM-DDThh:mm:ssZ), got ${got$1(t, "at")}`);
                }
            });
        }
    }
    if ("planted_from" in raw) {
        const pf = raw.planted_from;
        if (!Array.isArray(pf)) {
            errors.push(`season.planted_from: expected a list, got ${got$1(raw, "planted_from")}`);
        }
        else if (!tooMany(pf, "season", "planted_from", errors)) {
            pf.forEach((r, i) => {
                if (!isRecord(r)) {
                    errors.push(`planted_from[${i}]: not a record`);
                    return;
                }
                unknownFields(r, PLANTED_FROM_FIELDS, `planted_from[${i}]`, errors);
                if (typeof r.area !== "string" || !r.area) {
                    errors.push(`planted_from[${i}].area: expected a non-empty string, got ${got$1(r, "area")}`);
                }
                else if (r.area.length > SEASON_NAME_MAX) {
                    errors.push(`planted_from[${i}].area: longer than ${SEASON_NAME_MAX} characters`);
                }
                if (typeof r.guild !== "string" || !r.guild) {
                    errors.push(`planted_from[${i}].guild: expected a non-empty string, got ${got$1(r, "guild")}`);
                }
                else if (r.guild.length > SEASON_NAME_MAX) {
                    errors.push(`planted_from[${i}].guild: longer than ${SEASON_NAME_MAX} characters`);
                }
            });
        }
    }
    if ("set_aside" in raw) {
        const sa = raw.set_aside;
        if (!Array.isArray(sa)) {
            errors.push(`season.set_aside: expected a list, got ${got$1(raw, "set_aside")}`);
        }
        else if (!tooMany(sa, "season", "set_aside", errors)) {
            sa.forEach((r, i) => {
                if (!isRecord(r)) {
                    errors.push(`set_aside[${i}]: not a record`);
                    return;
                }
                unknownFields(r, SET_ASIDE_FIELDS, `set_aside[${i}]`, errors);
                if (typeof r.job !== "string" || !r.job) {
                    errors.push(`set_aside[${i}].job: expected a non-empty string, got ${got$1(r, "job")}`);
                }
                else if (r.job.length > SEASON_NAME_MAX) {
                    errors.push(`set_aside[${i}].job: longer than ${SEASON_NAME_MAX} characters`);
                }
                if (!validTombAt(r.at)) {
                    errors.push(`set_aside[${i}].at: expected an ISO UTC instant (YYYY-MM-DDThh:mm:ssZ), got ${got$1(r, "at")}`);
                }
                if ("back" in r && r.back !== true) {
                    errors.push(`set_aside[${i}].back: expected true, got ${got$1(r, "back")}`);
                }
            });
        }
    }
    const effectiveComplete = complete || "closed_date" in raw;
    for (const key of ["observations", "plantings"]) {
        if (!(key in raw))
            continue;
        const items = raw[key];
        if (!Array.isArray(items)) {
            errors.push(`season.${key}: expected a list, got ${got$1(raw, key)}`);
            continue;
        }
        if (tooMany(items, "season", key, errors))
            continue;
        items.forEach((item, i) => {
            if (key === "observations")
                validateObservation$1(item, `observations[${i}]`, errors);
            else
                validatePlanting(item, `plantings[${i}]`, errors, effectiveComplete);
        });
    }
    for (const [key, what] of [["plantings", "planting"], ["observations", "observation"]]) {
        const items = raw[key];
        if (!Array.isArray(items))
            continue;
        const seen = new Map();
        items.forEach((p, i) => {
            const pid = isRecord(p) ? p.id : undefined;
            if (typeof pid === "string" && pid) {
                const first = seen.get(pid);
                if (first !== undefined) {
                    errors.push(`${key}[${i}].id: duplicate of ${key}[${first}].id `
                        + `(${JSON.stringify(pid)}) - ${what} ids must be unique within a season`);
                }
                else
                    seen.set(pid, i);
            }
        });
    }
    return errors;
}

const TEXTURES = ["sand", "sandy_loam", "loam", "clay_loam", "clay", "unknown"];
const DRAINAGES = ["fast", "free", "slow", "waterlogged", "unknown"];
const SOURCES = ["declared", "field_test", "kit", "lab"];
const MEDIUMS = ["purchased_mix", "compost_blend", "native_soil", "unknown"];
const NUTRIENTS = ["p", "k", "ca", "mg", "s"];
const NUTRIENT_LEVELS = ["very_low", "low", "medium", "optimum", "high", "very_high"];
const OM_MIN = 0.0, OM_MAX = 100.0;
const REPORT_FIELDS = ["buffer_ph", "om_pct", "lab", "report_id", "nutrients",
    "lab_recommendation", "other_scale"];
const PH_METHODS = ["water", "calcium_chloride", "other_salt", "unknown"];
const PH_METHOD_COMPARED = "water";
const SOIL_FIELDS = new Set(["plot", "region", "date", "source", "texture", "drainage", "notes",
    "medium", "ph", "ph_method", "amendment", ...REPORT_FIELDS]);
const PH_MIN = 3.0, PH_MAX = 10.0;
const KIT_PRECISION = 0.5;
const AMENDMENTS = ["lime", "sulfur", "compost", "manure", "mulch", "other"];
const PH_AMENDMENTS = ["lime", "sulfur"];
const FACT_FIELDS = ["texture", "drainage", "medium", "ph", "amendment", ...REPORT_FIELDS];
const PH_SOURCES = ["kit", "lab"];
const MEDIUM_STRUCTURES = ["container", "raised"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOIL_NAME_MAX = 200;
const SOIL_TEXT_MAX = 5000;
function j(v) {
    if (v === undefined)
        return "missing";
    if (v === null)
        return "null";
    if (Array.isArray(v))
        return `[${v.map((x) => j(x)).join(", ")}]`;
    if (typeof v === "object") {
        const o = v;
        return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}: ${j(o[k])}`).join(", ")}}`;
    }
    return JSON.stringify(v);
}
function got(rec, key) {
    return key in rec ? j(rec[key]) : "missing";
}
function pyList(items) {
    return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}
const CLUBROOT_RULE = "R-146";
const CLUBROOT_PATHOGEN = "plasmodiophora_brassicae";
function clubrootCautions(ground, resolved, site, bundle) {
    if (!ground)
        return [];
    const path = (resolved ?? {}).pathogens;
    if (!Array.isArray(path) || !path.includes(CLUBROOT_PATHOGEN))
        return [];
    const ph = (ground.fields ?? {}).ph;
    if (typeof ph !== "number" || !Number.isFinite(ph))
        return [];
    if (!phComparable((ground.src ?? {}).ph, (ground.fields ?? {}).ph_method))
        return [];
    const rule = bundle.rules.find((r) => r.id === CLUBROOT_RULE);
    const trig = rule?.trigger ?? {};
    const phMin = trig.ph_min;
    const within = typeof trig.within === "string" ? trig.within : "R-012";
    if (typeof phMin !== "number" || ph >= phMin)
        return [];
    const years = bundle.rules.find((r) => r.id === within)?.trigger?.years;
    if (typeof years !== "number")
        return [];
    if (!familyWithinInterval(site, "brassicaceae", years))
        return [];
    const short = Math.round((phMin - ph) * 100) / 100;
    return [{
            rule: CLUBROOT_RULE,
            why: `this ground carried brassicas within the last ${years} years and its pH ${n(ph)} `
                + `sits ${n(short)} below ${n(phMin)}: clubroot's resting spores germinate in acid `
                + `soil, and raising the pH is the lever every clubroot guide we read names`,
        }];
}
const LIME_RULE = "R-145";
const SCAB_PH_MAX = 5.2;
const SCAB_PATHOGEN = "streptomyces_scabies";
function limeCautions(ground, resolved) {
    if (!ground)
        return [];
    const path = (resolved ?? {}).pathogens;
    if (!Array.isArray(path) || !path.includes(SCAB_PATHOGEN))
        return [];
    const limes = (ground.amendments ?? []).filter((a) => a.amendment === "lime");
    if (!limes.length)
        return [];
    const last = limes[limes.length - 1];
    const ph = (ground.fields ?? {}).ph;
    const phDate = (ground.as_of ?? {}).ph;
    const isNum = typeof ph === "number" && Number.isFinite(ph)
        && phComparable((ground.src ?? {}).ph, (ground.fields ?? {}).ph_method);
    if (isNum && String(phDate ?? "") >= String(last.date ?? "") && ph <= SCAB_PH_MAX)
        return [];
    const when = last.date ? ` on ${String(last.date)}` : "";
    const tail = isNum ? `, and the pH ${n(ph)} read on or after that day is above ${n(SCAB_PH_MAX)}` : "";
    return [{
            rule: LIME_RULE,
            why: `this ground was limed${when}${tail}: common scab worsens as soil pH rises, and `
                + `this plant wants it at or below about ${n(SCAB_PH_MAX)}`,
        }];
}
function n(v) {
    return Number.isInteger(v) ? String(Math.trunc(v)) : String(Math.round(v * 100) / 100);
}
function validateObservation(raw, prefix = "soil") {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        return [`${prefix}: not a record`];
    const rec = raw;
    const errors = [];
    for (const k of Object.keys(rec).filter((k) => !SOIL_FIELDS.has(k)).sort()) {
        errors.push(`${prefix}: unknown field "${k}"`);
    }
    const plot = rec.plot;
    if (typeof plot !== "string" || !plot) {
        errors.push(`${prefix}.plot: expected a non-empty plot id, got ${got(rec, "plot")}`);
    }
    const date = rec.date;
    if (typeof date !== "string" || !DATE_RE.test(date)) {
        errors.push(`${prefix}.date: expected an ISO date (soil changes, so WHEN is part of the ` +
            `observation), got ${got(rec, "date")}`);
    }
    const source = rec.source;
    const sourceOk = typeof source === "string" && SOURCES.includes(source);
    if (!("source" in rec) || !sourceOk) {
        errors.push(`${prefix}.source: expected one of ${pyList(SOURCES)}, got ${got(rec, "source")}`);
    }
    const isPhSource = typeof source === "string" && PH_SOURCES.includes(source);
    if ("ph" in rec) {
        const ph = rec.ph;
        if (typeof ph !== "number" || !Number.isFinite(ph)) {
            errors.push(`${prefix}.ph: expected a number, got ${got(rec, "ph")}`);
        }
        else if (!(PH_MIN <= ph && ph <= PH_MAX)) {
            errors.push(`${prefix}.ph: ${n(ph)} is outside ${n(PH_MIN)}-${n(PH_MAX)}, which no ` +
                `garden soil reaches - check for a slipped decimal point or a broken meter`);
        }
        if (sourceOk && !isPhSource) {
            errors.push(`${prefix}.ph: a pH needs a measurement behind it, and source ` +
                `"${source}" is not one. Use ${pyList(PH_SOURCES)}.`);
        }
    }
    else if (source === "kit" || (source === "lab" && !REPORT_FIELDS.some((k) => k in rec))) {
        errors.push(`${prefix}.ph: source "${source}" is a pH reading, so the pH is what it is ` +
            `for - record it, or use a lower tier.`);
    }
    if ("ph_method" in rec) {
        const m = rec.ph_method;
        if (typeof m !== "string" || !PH_METHODS.includes(m)) {
            errors.push(`${prefix}.ph_method: expected one of ${pyList(PH_METHODS)}, got ${got(rec, "ph_method")}`);
        }
        if (!("ph" in rec)) {
            errors.push(`${prefix}.ph_method: says how a pH was measured, so it needs a pH beside it`);
        }
        if (sourceOk && source !== "lab") {
            errors.push(`${prefix}.ph_method: only a lab report says which solution a pH was measured ` +
                `in, and source "${source}" is not one`);
        }
    }
    const present = REPORT_FIELDS.filter((k) => k in rec);
    if (present.length && sourceOk && source !== "lab") {
        errors.push(`${prefix}: ${pyList(present)} come off a lab report, and source "${source}" is ` +
            `not one. A buffer pH does not come off a home kit.`);
    }
    if ("buffer_ph" in rec) {
        const b = rec.buffer_ph;
        if (typeof b !== "number" || !Number.isFinite(b)) {
            errors.push(`${prefix}.buffer_ph: expected a number, got ${got(rec, "buffer_ph")}`);
        }
        else if (!(PH_MIN <= b && b <= PH_MAX)) {
            errors.push(`${prefix}.buffer_ph: ${n(b)} is outside ${n(PH_MIN)}-${n(PH_MAX)}`);
        }
    }
    if ("om_pct" in rec) {
        const o = rec.om_pct;
        if (typeof o !== "number" || !Number.isFinite(o)) {
            errors.push(`${prefix}.om_pct: expected a number, got ${got(rec, "om_pct")}`);
        }
        else if (!(OM_MIN <= o && o <= OM_MAX)) {
            errors.push(`${prefix}.om_pct: ${n(o)} is outside ${n(OM_MIN)}-${n(OM_MAX)} percent`);
        }
    }
    for (const key of ["lab", "report_id", "lab_recommendation"]) {
        if (key in rec && (typeof rec[key] !== "string" || !rec[key].trim())) {
            errors.push(`${prefix}.${key}: expected non-empty text, got ${got(rec, key)}`);
        }
        else if (key in rec && rec[key].length > (key === "lab_recommendation" ? SOIL_TEXT_MAX : SOIL_NAME_MAX)) {
            errors.push(`${prefix}.${key}: longer than ${key === "lab_recommendation" ? SOIL_TEXT_MAX : SOIL_NAME_MAX} characters`);
        }
    }
    if ("nutrients" in rec) {
        const nut = rec.nutrients;
        if (nut === null || typeof nut !== "object" || Array.isArray(nut)) {
            errors.push(`${prefix}.nutrients: expected a record of nutrient to level, got ` +
                `${got(rec, "nutrients")}`);
        }
        else {
            const m = nut;
            for (const k of Object.keys(m).sort()) {
                if (!NUTRIENTS.includes(k)) {
                    errors.push(`${prefix}.nutrients: "${k}" is not one of ${pyList(NUTRIENTS)}`);
                    continue;
                }
                const v = m[k];
                if (typeof v === "number") {
                    errors.push(`${prefix}.nutrients.${k}: give the level your lab CONCLUDED ` +
                        `(${pyList(NUTRIENT_LEVELS)}), not the number it measured. We store what the report ` +
                        `says, and we never do arithmetic on it.`);
                }
                else if (typeof v !== "string" || !NUTRIENT_LEVELS.includes(v)) {
                    errors.push(`${prefix}.nutrients.${k}: expected one of ${pyList(NUTRIENT_LEVELS)}, ` +
                        `got ${j(v)}`);
                }
            }
        }
    }
    if ("other_scale" in rec) {
        const scale = rec.other_scale;
        if (!Array.isArray(scale) || !scale.length) {
            errors.push(`${prefix}.other_scale: expected a list of the nutrients your report grades on another ` +
                `scale, got ${got(rec, "other_scale")}`);
        }
        else {
            const nut = rec.nutrients;
            const levels = nut !== null && typeof nut === "object" && !Array.isArray(nut) ? nut : {};
            for (const k of scale) {
                if (typeof k !== "string" || !NUTRIENTS.includes(k)) {
                    errors.push(`${prefix}.other_scale: ${j(k)} is not one of ${pyList(NUTRIENTS)}`);
                }
                else if (k in levels) {
                    errors.push(`${prefix}.other_scale: "${k}" has a level in nutrients too - a report grades a ` +
                        `nutrient one way, so it is one or the other`);
                }
            }
            const names = scale.filter((k) => typeof k === "string");
            if (new Set(names).size !== names.length)
                errors.push(`${prefix}.other_scale: names a nutrient more than once`);
        }
    }
    if (!FACT_FIELDS.some((k) => k in rec)) {
        errors.push(`${prefix}: this records nothing - give a texture, a drainage, a medium, a pH, ` +
            `or an amendment`);
    }
    if ("texture" in rec &&
        (typeof rec.texture !== "string" || !TEXTURES.includes(rec.texture))) {
        errors.push(`${prefix}.texture: expected one of ${pyList(TEXTURES)}, got ${got(rec, "texture")}`);
    }
    if ("amendment" in rec &&
        (typeof rec.amendment !== "string" || !AMENDMENTS.includes(rec.amendment))) {
        errors.push(`${prefix}.amendment: expected one of ${pyList(AMENDMENTS)}, got ${got(rec, "amendment")}`);
    }
    if ("drainage" in rec &&
        (typeof rec.drainage !== "string" || !DRAINAGES.includes(rec.drainage))) {
        errors.push(`${prefix}.drainage: expected one of ${pyList(DRAINAGES)}, got ${got(rec, "drainage")}`);
    }
    if ("medium" in rec &&
        (typeof rec.medium !== "string" || !MEDIUMS.includes(rec.medium))) {
        errors.push(`${prefix}.medium: expected one of ${pyList(MEDIUMS)}, got ${got(rec, "medium")}`);
    }
    if ("notes" in rec && typeof rec.notes !== "string") {
        errors.push(`${prefix}.notes: expected text, got ${got(rec, "notes")}`);
    }
    else if ("notes" in rec && rec.notes.length > SOIL_TEXT_MAX) {
        errors.push(`${prefix}.notes: longer than ${SOIL_TEXT_MAX} characters`);
    }
    if ("region" in rec && rec.region !== null && rec.region !== undefined &&
        (typeof rec.region !== "object" || Array.isArray(rec.region))) {
        errors.push(`${prefix}.region: expected a region record or none (none means the whole ` +
            `plot), got ${got(rec, "region")}`);
    }
    return errors;
}
function asksFor(structure) {
    return structure && MEDIUM_STRUCTURES.includes(structure) ? "medium" : "soil";
}
function phComparable(source, method) {
    return source === "kit" || (source === "lab" && method === PH_METHOD_COMPARED);
}
const PH_UNCOMPARED_CACL2 = "this pH was measured in calcium chloride: it is recorded, and no plant is checked " +
    "against it, because every pH range here is in water pH";
const PH_UNCOMPARED_SALT = "this pH was measured in a salt solution: it is recorded, and no plant is checked " +
    "against it, because every pH range here is in water pH";
const PH_METHOD_UNKNOWN = "which solution this pH was measured in is not recorded: no plant is checked against it " +
    "until it is";
function capabilities(obs, structure, src) {
    if (obs && Object.keys(obs).length === 0)
        obs = null;
    const asks = asksFor(structure);
    const knownTexture = !!obs && obs.texture !== undefined && obs.texture !== null &&
        obs.texture !== "unknown";
    const knownDrainage = !!obs && "drainage" in obs && obs.drainage !== undefined &&
        obs.drainage !== null && obs.drainage !== "unknown";
    const knownMedium = !!obs && "medium" in obs && obs.medium !== undefined &&
        obs.medium !== null && obs.medium !== "unknown";
    const how = (field) => (src ? src[field] : obs ? obs.source : undefined);
    const measured = !!obs && how("texture") === "field_test";
    const ph = obs ? obs.ph : undefined;
    const knownPh = typeof ph === "number" && Number.isFinite(ph);
    const kit = !!obs && how("ph") === "kit";
    const comparable = knownPh && phComparable(how("ph"), obs?.ph_method);
    const report = !!obs && REPORT_FIELDS.some((k) => k in obs);
    const limits = [];
    if (!obs) {
        limits.push("nothing recorded for this ground yet: nothing here is adjusted for it");
    }
    if (asks === "medium") {
        if (obs && !knownMedium)
            limits.push("what this bed is filled with is not recorded");
        if (structure === "container") {
            limits.push("a container is filled with a bought or mixed medium, so nothing here is " +
                "inferred from your native ground");
        }
        else {
            limits.push("a raised bed sits ON native ground: its fill is recorded, but drainage " +
                "still depends on what is underneath");
        }
    }
    else if (obs) {
        if (!knownTexture)
            limits.push("texture unknown: watering and root-spread guidance stays generic");
        else if (!measured)
            limits.push("texture declared, not measured: a ribbon test would firm it up");
        if (!knownDrainage)
            limits.push("drainage not recorded: waterlogging risk is not assessed");
        else if (obs.drainage === "slow") {
            limits.push("slow drainage is recorded but not gated: the waterlogging rule fires on " +
                "water that STANDS after rain, which is what the sources measure");
        }
    }
    if (!knownPh && report) {
        limits.push("your lab report is recorded without a pH reading: pH-sensitive plants are not gated " +
            "until a pH is recorded");
    }
    else if (!knownPh) {
        limits.push("no soil test: pH-sensitive plants are not gated, and no fertilizer amount is " +
            "offered (a soil test is the only honest source for one)");
    }
    else {
        if (kit) {
            limits.push(`a home kit resolves about +/-${n(KIT_PRECISION)} pH: this reading gates ` +
                `plants but a lab test is what a lime rate needs`);
        }
        if (!comparable) {
            const m = obs?.ph_method;
            limits.push(m === "calcium_chloride" ? PH_UNCOMPARED_CACL2 : m === "other_salt" ? PH_UNCOMPARED_SALT
                : PH_METHOD_UNKNOWN);
        }
        else {
            limits.push("only the LOW side is gated: no source read publishes a per-crop maximum for " +
                "a vegetable, so a pH above a plant's range is not flagged");
        }
        if (!report) {
            limits.push("still no fertilizer amount and no lime rate: a rate is the lab's to give, from a " +
                "lime requirement test of this soil, and no lab report is recorded yet");
        }
    }
    if (report) {
        if (!obs?.lab) {
            limits.push("which lab produced this report is not recorded: a reading is only as " +
                "good as its source, and the report is what we repeat back");
        }
        limits.push("a lime or sulfur rate PRINTED ON your report is a real one for this soil, whichever " +
            "lime requirement method your lab used - use that number, not one from us and not one " +
            "from the internet (R-101). If it prints none, ask your lab for its lime or sulfur recommendation");
        limits.push("nutrient levels are repeated as your lab worded them and are never " +
            "converted into an amount - that arithmetic is the lab's, not ours");
    }
    return { asks, texture: knownTexture && asks === "soil", drainage: knownDrainage,
        medium: knownMedium, measured, chemistry: knownPh, report,
        gates_rules: comparable, limits };
}
const RUNGS = ["nothing recorded", "described", "field tested", "pH measured",
    "lab report"];
const RUNG_STEP = [
    null,
    ["about two minutes", "texture guidance, drainage warnings, and the waterlogging rule"],
    ["twenty minutes and nothing", "the same, graded higher - a measurement instead of a guess"],
    ["a home kit", "the pH rule, so plants below their floor are named"],
    ["a lab test and about two weeks", "your lab's own recommendation, repeated faithfully"],
];
const REPORT_FROM_LAB = ["a few minutes copying in the rest of your lab report",
    "your lab's own recommendation, repeated faithfully"];
function rung(obs, structure, src) {
    if (!obs)
        return 0;
    const how = (field) => (src !== undefined && src !== null ? src[field] : obs.source);
    const present = REPORT_FIELDS.filter((k) => k in obs);
    if (present.length && how(present[0]) === "lab")
        return 4;
    if (typeof obs.ph === "number" && Number.isFinite(obs.ph))
        return 3;
    const knownField = asksFor(structure) === "medium" ? "medium" : "texture";
    if (how(knownField) === "field_test")
        return 2;
    const known = obs[knownField];
    if (known !== undefined && known !== null && known !== "unknown")
        return 1;
    return obs.drainage !== undefined && obs.drainage !== null && obs.drainage !== "unknown" ? 1 : 0;
}
function ladder(obs, structure, src) {
    const at = rung(obs, structure, src);
    let step = at + 1 < RUNGS.length ? RUNG_STEP[at + 1] : null;
    if (at === 3 && obs && (src !== undefined && src !== null ? src.ph : obs.source) === "lab")
        step = REPORT_FROM_LAB;
    return {
        rung: at,
        of: RUNGS.length - 1,
        label: RUNGS[at],
        next: step === null || step === undefined
            ? null
            : { label: RUNGS[at + 1], costs: step[0], buys: step[1] },
    };
}
const PH_RULE = "R-099";
const DRAINAGE_RULE = "R-100";
function phCautions(obs, resolved) {
    if (!obs)
        return [];
    const ph = obs.ph;
    if (typeof ph !== "number" || !Number.isFinite(ph))
        return [];
    if (!phComparable(obs.source, obs.ph_method))
        return [];
    const rng = (resolved ?? {}).ph_range;
    if (!Array.isArray(rng) || rng.length < 1)
        return [];
    const ceiling = rng.length > 1 ? rng[1] : null;
    if (resolved?.acid_requiring && typeof ceiling === "number" && Number.isFinite(ceiling)
        && ph > ceiling) {
        const over = Math.round((ph - ceiling) * 100) / 100;
        const hedgeHi = obs.source === "kit" && over <= KIT_PRECISION
            ? ` (a home kit resolves about +/-${n(KIT_PRECISION)}, so this is marginal)` : "";
        return [{ rule: PH_RULE,
                why: `soil pH ${n(ph)} is ${n(over)} above this plant's ceiling of ${n(ceiling)}, and it ` +
                    `needs acid soil: above its range iron stops being available and the leaves yellow while ` +
                    `the veins stay green${hedgeHi}` }];
    }
    const floor = rng[0];
    if (typeof floor !== "number" || !Number.isFinite(floor) || ph >= floor)
        return [];
    const short = Math.round((floor - ph) * 100) / 100;
    const hedge = obs.source === "kit" && short <= KIT_PRECISION
        ? ` (a home kit resolves about +/-${n(KIT_PRECISION)}, so this is marginal)` : "";
    return [{ rule: PH_RULE,
            why: `soil pH ${n(ph)} is ${n(short)} below this plant's floor of ${n(floor)}${hedge}` }];
}
function drainageCautions(obs, hasPerennial = false) {
    if (!obs || obs.drainage !== "waterlogged")
        return [];
    const mound = hasPerennial
        ? "up to 2 feet with a gradual slope, for the trees and perennials here"
        : "8 to 10 inches for annuals";
    return [{
            rule: DRAINAGE_RULE,
            why: "you told us this ground stands water after rain: roots suffocate in saturated soil, " +
                "and standing water is what lets Phytophthora reach a root at all",
            remedy: `plant on a mound or berm - ${mound} - and never bury the root crown or graft union`,
        }];
}
function forGround(observations, plot, regionKey = null) {
    const out = [];
    for (const o of observations ?? []) {
        if (!o || typeof o !== "object" || Array.isArray(o))
            continue;
        const rec = o;
        if (rec.plot !== plot)
            continue;
        const key = rec.region ?? null;
        if (regionKey === null || regionKey === undefined) {
            if (key !== null)
                continue;
        }
        else if (j(key) !== j(regionKey))
            continue;
        out.push(rec);
    }
    out.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    return out;
}
function resolveGround(observations, plot, regionKey = null) {
    const rows = forGround(observations, plot, regionKey);
    const fields = {};
    const as_of = {};
    const src = {};
    for (const o of rows) {
        for (const k of [...FACT_FIELDS, "source", "notes"]) {
            if (k === "ph")
                continue;
            if (k in o && o[k] !== null && o[k] !== undefined) {
                fields[k] = o[k];
                as_of[k] = o.date;
                src[k] = o.source;
            }
        }
    }
    const amended = rows.filter((o) => PH_AMENDMENTS.includes(o.amendment));
    delete fields.amendment;
    delete as_of.amendment;
    delete src.amendment;
    const readings = rows.filter((o) => "ph" in o && o.ph !== null && o.ph !== undefined);
    const stands = (o) => !amended.some((a) => String(a.date ?? "") > String(o.date ?? ""));
    const compared = readings.filter((o) => stands(o) && phComparable(o.source, o.ph_method));
    const uncompared = readings.filter((o) => stands(o) && !phComparable(o.source, o.ph_method));
    const lead = compared.length ? compared[compared.length - 1] : uncompared.length ? uncompared[uncompared.length - 1] : null;
    const also = compared.length && uncompared.length ? uncompared[uncompared.length - 1] : null;
    if (lead) {
        fields.ph = lead.ph;
        as_of.ph = lead.date;
        src.ph = lead.source;
    }
    if (lead && lead.ph_method !== null && lead.ph_method !== undefined) {
        fields.ph_method = lead.ph_method;
        as_of.ph_method = lead.date;
        src.ph_method = lead.source;
    }
    const superseded = {};
    if (readings.length && !lead) {
        const newest = String(readings[readings.length - 1].date ?? "");
        const later = amended.filter((o) => String(o.date ?? "") > newest);
        const last = later[later.length - 1];
        superseded.ph = { by: last.amendment, date: last.date };
        delete fields.buffer_ph;
        delete as_of.buffer_ph;
        delete src.buffer_ph;
    }
    return {
        fields, as_of, src, superseded,
        ph_also: also ? { ph: also.ph, ph_method: also.ph_method ?? null, date: also.date ?? null, source: also.source ?? null } : null,
        date: rows.length ? rows[rows.length - 1].date : null,
        amendments: rows.filter((o) => o.amendment).map((o) => ({ amendment: o.amendment, date: o.date })),
    };
}

function seasonForDate(isoDate, lat) {
    return seasonYearOf(isoDate, lat);
}
function isFutureDate(isoDate, todayIso) {
    return /^\d{4}-\d\d-\d\d$/.test(isoDate) && isoDate > todayIso;
}
function mintObservationId(taken = new Set()) {
    for (;;) {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const id = "ob-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        if (!taken.has(id))
            return id;
    }
}
function legacyObservationId(o, nth = 0) {
    const text = [o.date, o.event, o.severity ?? "", o.damage ?? "", o.note ?? ""].join("|");
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `ob-${h.toString(16).padStart(8, "0")}${nth ? `-${nth + 1}` : ""}`;
}
function withObservationIds(list) {
    const taken = new Set(list.map((o) => o.id).filter((x) => !!x));
    const nth = new Map();
    return list.map((o) => {
        if (o.id)
            return o;
        const base = legacyObservationId(o);
        let n = nth.get(base) ?? 0;
        let id = legacyObservationId(o, n);
        while (taken.has(id))
            id = legacyObservationId(o, ++n);
        nth.set(base, n + 1);
        taken.add(id);
        return { ...o, id };
    });
}
function tombstoneMap(...lists) {
    const out = new Map();
    for (const list of lists)
        for (const t of list ?? []) {
            const prev = out.get(t.id);
            if (prev === undefined || t.at > prev)
                out.set(t.id, t.at);
        }
    return out;
}
function tombstoneList(m) {
    if (!m.size)
        return undefined;
    return [...m].map(([id, at]) => ({ id, at })).sort((x, y) => (x.id < y.id ? -1 : 1));
}
function sortObservations(list) {
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id ?? "") < (b.id ?? "") ? -1 : (a.id ?? "") > (b.id ?? "") ? 1 : 0));
}
function misfiledEntries(seasons, lat, todayIso) {
    const out = [];
    for (const s of seasons)
        for (const o of withObservationIds(s.observations ?? [])) {
            if (!/^\d{4}-\d\d-\d\d$/.test(o.date) || isFutureDate(o.date, todayIso))
                continue;
            const to = seasonForDate(o.date, lat);
            if (to !== s.id)
                out.push({ from: s.id, to, obs: o });
        }
    return out;
}
function futureDated(seasons, todayIso) {
    return seasons.flatMap((s) => withObservationIds(s.observations ?? []).filter((o) => isFutureDate(o.date, todayIso)).map((obs) => ({ seasonId: s.id, obs })));
}
function entryKind(rowKind, event) {
    switch (rowKind) {
        case "sow":
        case "plant":
        case "harvest":
        case "ended":
        case "problem":
        case "note": return rowKind;
        default: return event === "note" ? "note" : "weather";
    }
}
const DIARY_KINDS = ["sowing", "harvest", "ended", "weather", "problem", "note"];
function diaryKind(k) {
    return k === "sow" || k === "plant" ? "sowing" : k;
}
const WHOLE_GARDEN = "";
function selectRows(rows, f) {
    return rows.filter((r) => (f.bed === null || (r.bed ?? WHOLE_GARDEN) === f.bed) && (f.kind === null || r.fk === f.kind));
}
function hiddenRows(rows, f) {
    return rows.length - selectRows(rows, f).length;
}
function chipRows(rows, f, chip) {
    return selectRows(rows, "bed" in chip ? { bed: chip.bed, kind: f.kind } : { bed: f.bed, kind: chip.kind }).length;
}
function seasonLine(seasons, todayIso, lat) {
    const year = seasonYearOf(todayIso, lat);
    const growing = seasons.find((s) => s.id === year && !s.closed_date)?.id ?? null;
    const planned = new Set(seasons.filter((s) => s.id > year).map((s) => s.id));
    for (const s of seasons)
        for (const e of s.next_plan ?? []) {
            if (e && typeof e === "object" && "year" in e && typeof e.year === "number" && e.year > year)
                planned.add(e.year);
        }
    return {
        growing,
        planning: [...planned].sort((a, b) => a - b),
        past: seasons.filter((s) => s.id < year || (s.id === year && !!s.closed_date)).map((s) => s.id).sort((a, b) => b - a),
    };
}
const PLANTING_DATE_FIELDS = ["sown", "transplanted", "first_harvest", "last_harvest", "end_date"];
function futurePlantingDates(seasons, todayIso) {
    const out = [];
    for (const s of seasons)
        (s.plantings ?? []).forEach((p, index) => {
            for (const field of PLANTING_DATE_FIELDS) {
                const date = p[field];
                if (typeof date === "string" && isFutureDate(date, todayIso))
                    out.push({ seasonId: s.id, index, plantingId: p.id, field, date });
            }
        });
    return out;
}

function plotIdFor(name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return (activeWorkspace() === "account" ? "plot_" : "draft_") + slug;
}
const DB_NAME = "garden-grows-log";
const DB_VERSION = 11;
const SESSION_KEY = "gg-sync-session";
function sessionPresent() {
    try {
        return typeof localStorage !== "undefined" && localStorage.getItem(SESSION_KEY) !== null;
    }
    catch {
        return false;
    }
}
function activeWorkspace() {
    return sessionPresent() ? "account" : "draft";
}
function plotVisible(plot) {
    return !!plot.example || (plot.owner ?? "draft") === activeWorkspace();
}
function defaultWorkspacePlotId() {
    return activeWorkspace() === "account" ? "plot_home" : "draft_home";
}
const seasonKey = (plot, id) => `${plot}:${id}`;
function asPromise(r) {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
function openLog() {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = (ev) => {
            const db = open.result;
            const oldVersion = ev.oldVersion;
            if (!db.objectStoreNames.contains("plots"))
                db.createObjectStore("plots", { keyPath: "id" });
            if (!db.objectStoreNames.contains("sync_meta"))
                db.createObjectStore("sync_meta", { keyPath: "key" });
            if (!db.objectStoreNames.contains("user_species"))
                db.createObjectStore("user_species", { keyPath: "id" });
            if (!db.objectStoreNames.contains("sync_backups"))
                db.createObjectStore("sync_backups", { autoIncrement: true });
            if (!db.objectStoreNames.contains("soil_observations"))
                db.createObjectStore("soil_observations");
            if (!db.objectStoreNames.contains("photos"))
                db.createObjectStore("photos");
            if (!db.objectStoreNames.contains("plot_tombstones"))
                db.createObjectStore("plot_tombstones", { keyPath: "id" });
            if (!db.objectStoreNames.contains("posts"))
                db.createObjectStore("posts");
            if (!db.objectStoreNames.contains("seeds"))
                db.createObjectStore("seeds", { keyPath: "id" });
            if (!db.objectStoreNames.contains("seasons")) {
                db.createObjectStore("seasons");
            }
            else if (oldVersion < 3) {
                const tx = open.transaction;
                const oldSeasons = tx.objectStore("seasons");
                oldSeasons.getAll().onsuccess = (e) => {
                    const rows = e.target.result;
                    db.deleteObjectStore("seasons");
                    const ns = db.createObjectStore("seasons");
                    for (const s of rows)
                        ns.put(s, seasonKey(s.plot, s.id));
                };
                const meta = tx.objectStore("sync_meta");
                meta.getAll().onsuccess = (e) => {
                    for (const m of e.target.result) {
                        const match = /^season:(\d+)$/.exec(m.key);
                        if (match) {
                            meta.delete(m.key);
                            meta.put({ key: `season:plot_home:${match[1]}`, updatedAt: m.updatedAt });
                        }
                    }
                };
            }
            if (oldVersion > 0 && oldVersion < 7) {
                const owner = sessionPresent() ? "account" : "draft";
                const ps = open.transaction.objectStore("plots");
                ps.getAll().onsuccess = (e) => {
                    for (const p of e.target.result) {
                        if (!p.example && !p.owner)
                            ps.put({ ...p, owner });
                    }
                };
            }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error(copy.ntStorageLocked));
    });
}
function store(db, name, mode) {
    return db.transaction(name, mode).objectStore(name);
}
async function listSeasons(db, plot) {
    const all = await asPromise(store(db, "seasons", "readonly").getAll());
    return plot === undefined ? all : all.filter((s) => s.plot === plot);
}
function getSeason(db, plot, id) {
    return asPromise(store(db, "seasons", "readonly").get(seasonKey(plot, id)));
}
let onLocalWrite = null;
function setOnLocalWrite(cb) { onLocalWrite = cb; }
function stamp(db, key) {
    const done = asPromise(store(db, "sync_meta", "readwrite").put({ key, updatedAt: Date.now() }));
    onLocalWrite?.();
    return done;
}
function listSyncMeta(db) {
    return asPromise(store(db, "sync_meta", "readonly").getAll());
}
function mintPlantingId(taken) {
    for (;;) {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const id = "pl-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        if (!taken.has(id)) {
            taken.add(id);
            return id;
        }
    }
}
async function putSeason(db, season) {
    const taken = new Set((season.plantings ?? []).map((p) => p.id).filter((x) => !!x));
    const plantings = (season.plantings ?? []).map((p) => (p.id ? p : { ...p, id: mintPlantingId(taken) }));
    const next = season.plantings ? { ...season, plantings } : { ...season };
    const existing = await getSeason(db, season.plot, season.id);
    const now = new Date().toISOString().slice(0, 19) + "Z";
    const alive = new Set(plantings.map((p) => p.id));
    const tombs = new Map();
    for (const t of [...(existing?.removed_plantings ?? []), ...(next.removed_plantings ?? [])]) {
        const prev = tombs.get(t.id);
        if (prev === undefined || t.at > prev)
            tombs.set(t.id, t.at);
    }
    for (const p of existing?.plantings ?? []) {
        if (p.id && !alive.has(p.id) && !tombs.has(p.id))
            tombs.set(p.id, now);
    }
    const removed = [...tombs].filter(([id]) => !alive.has(id))
        .map(([id, at]) => ({ id, at }))
        .sort((x, y) => (x.id < y.id ? -1 : 1));
    if (removed.length)
        next.removed_plantings = removed;
    else
        delete next.removed_plantings;
    if (next.observations || existing?.removed_observations || next.removed_observations) {
        const obsTombs = tombstoneMap(existing?.removed_observations, next.removed_observations);
        if (next.observations)
            next.observations = withObservationIds(next.observations).filter((o) => !obsTombs.has(o.id));
        const list = tombstoneList(obsTombs);
        if (list)
            next.removed_observations = list;
        else
            delete next.removed_observations;
    }
    const errors = validateSeason(next);
    if (errors.length)
        throw new Error(`refusing to store an invalid season:\n${errors.join("\n")}`);
    await asPromise(store(db, "seasons", "readwrite").put(next, seasonKey(next.plot, next.id)));
    await stamp(db, `season:${next.plot}:${next.id}`);
    return next;
}
const KEEP_BACKUPS = 20;
async function backupReplaced(db, kind, key, existing, incoming) {
    if (existing === undefined || JSON.stringify(existing) === JSON.stringify(incoming))
        return;
    const s = store(db, "sync_backups", "readwrite");
    await asPromise(s.add({ kind, key, record: existing, replacedAt: Date.now() }));
    const keys = await asPromise(s.getAllKeys());
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_BACKUPS)))
        await asPromise(s.delete(k));
}
async function keepCopyOfGarden(db, plotId) {
    const plot = await getPlot(db, plotId);
    if (plot)
        await backupReplaced(db, "plot", plotId, plot, null);
    for (const sn of await listSeasons(db, plotId))
        await backupReplaced(db, "season", seasonKey(plotId, sn.id), sn, null);
    for (const po of await listPosts(db, plotId))
        await backupReplaced(db, "post", `${plotId}:${po.id}`, po, null);
}
async function listSyncBackups(db) {
    const s = store(db, "sync_backups", "readonly");
    const [keys, rows] = [await asPromise(s.getAllKeys()), await asPromise(s.getAll())];
    return rows.map((r, i) => ({ ...r, id: keys[i] })).sort((a, b) => b.replacedAt - a.replacedAt);
}
async function restoreSyncBackup(db, id) {
    const b = (await listSyncBackups(db)).find((x) => x.id === id);
    if (!b)
        throw new Error(copy.ntBackupGone);
    if (b.kind === "season")
        await putSeason(db, b.record);
    else if (b.kind === "plot")
        await putPlot(db, b.record);
    else if (b.kind === "post")
        await putPost(db, b.record);
    else
        await putUserSpecies(db, b.record);
    await asPromise(store(db, "sync_backups", "readwrite").delete(id));
    return b;
}
async function putSeasonFromSync(db, season, remoteUpdatedAt) {
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`refusing to store an invalid season:\n${errors.join("\n")}`);
    const existing = await getSeason(db, season.plot, season.id);
    await backupReplaced(db, "season", seasonKey(season.plot, season.id), existing, season);
    await asPromise(store(db, "seasons", "readwrite").put(season, seasonKey(season.plot, season.id)));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `season:${season.plot}:${season.id}`, updatedAt: remoteUpdatedAt }));
    return season;
}
function mintPostId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return "post-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function putPost(db, post) {
    if (!post.plot || !post.id)
        throw new Error("a post needs a plot and an id");
    await asPromise(store(db, "posts", "readwrite").put(post, seasonKey(post.plot, post.id)));
    await stamp(db, `post:${post.plot}:${post.id}`);
    return post;
}
async function listPosts(db, plot) {
    const all = await asPromise(store(db, "posts", "readonly").getAll());
    const rows = plot ? all.filter((p) => p.plot === plot) : all;
    return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
function validatePost(p) {
    const errors = [];
    if (typeof p !== "object" || p === null)
        return ["post is not an object"];
    const o = p;
    if (typeof o.plot !== "string" || !o.plot)
        errors.push("post.plot must be a non-empty string");
    if (typeof o.id !== "string" || !/^post-[0-9a-f]+$/.test(o.id))
        errors.push("post.id must be a 'post-<hex>' string");
    if (typeof o.author !== "string")
        errors.push("post.author must be a string");
    if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at)))
        errors.push("post.at must be an ISO instant");
    if (typeof o.body !== "string")
        errors.push("post.body must be a string");
    else if (o.body.length > 20000)
        errors.push("post.body exceeds 20000 characters");
    if ("deleted" in o && typeof o.deleted !== "boolean")
        errors.push("post.deleted, if present, must be a boolean");
    return errors;
}
async function putPostFromSync(db, post, remoteUpdatedAt) {
    const errors = validatePost(post);
    if (errors.length)
        throw new Error(`refusing to store an invalid post:\n${errors.join("\n")}`);
    await asPromise(store(db, "posts", "readwrite").put(post, seasonKey(post.plot, post.id)));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `post:${post.plot}:${post.id}`, updatedAt: remoteUpdatedAt }));
    return post;
}
function deletePost(db, plot, id) {
    return asPromise(store(db, "posts", "readwrite").delete(seasonKey(plot, id)));
}
function deleteSeason(db, plot, id) {
    return asPromise(store(db, "seasons", "readwrite").delete(seasonKey(plot, id)));
}
async function updateSeason(db, plot, id, mutate) {
    const season = await getSeason(db, plot, id);
    if (!season)
        throw new Error(`no season ${id} in the log for this address`);
    mutate(season);
    return putSeason(db, season);
}
function addPlanting(db, plot, seasonId, planting) {
    return updateSeason(db, plot, seasonId, (s) => {
        (s.plantings ??= []).push(planting);
    });
}
function addObservation(db, plot, seasonId, obs) {
    return updateSeason(db, plot, seasonId, (s) => {
        const taken = new Set([...(s.observations ?? []), ...(s.removed_observations ?? [])].map((o) => o.id).filter((x) => !!x));
        (s.observations ??= []).push(obs.id ? obs : { ...obs, id: mintObservationId(taken) });
    });
}
async function fileObservation(db, plot, obs) {
    const seasonId = seasonForDate(obs.date, (await getPlot(db, plot))?.anchor?.lat ?? null);
    if (!(await getSeason(db, plot, seasonId)))
        await putSeason(db, { id: seasonId, plot, plantings: [], observations: [] });
    const saved = await addObservation(db, plot, seasonId, obs);
    const stored = (saved.observations ?? [])[(saved.observations ?? []).length - 1];
    return { seasonId, obs: stored };
}
async function removeObservation(db, plot, seasonId, id) {
    let gone = null;
    await updateSeason(db, plot, seasonId, (s) => {
        s.observations = withObservationIds(s.observations ?? []);
        gone = s.observations.find((o) => o.id === id) ?? null;
        s.observations = s.observations.filter((o) => o.id !== id);
        const at = new Date().toISOString().slice(0, 19) + "Z";
        s.removed_observations = tombstoneList(tombstoneMap(s.removed_observations, [{ id, at }]));
    });
    return gone;
}
async function moveObservation(db, plot, from, to, obs) {
    if (!(await getSeason(db, plot, to)))
        await putSeason(db, { id: to, plot, plantings: [], observations: [] });
    const target = await getSeason(db, plot, to);
    const there = (target?.observations ?? []).some((o) => o.id === obs.id) || (target?.removed_observations ?? []).some((t) => t.id === obs.id);
    if (!there)
        await addObservation(db, plot, to, obs);
    await removeObservation(db, plot, from, obs.id);
}
async function changeObservation(db, plot, seasonId, id, next) {
    const fresh = { ...next };
    delete fresh.id;
    if (seasonForDate(fresh.date, (await getPlot(db, plot))?.anchor?.lat ?? null) === seasonId) {
        let newId = "";
        const saved = await updateSeason(db, plot, seasonId, (s) => {
            const list = withObservationIds(s.observations ?? []);
            if (!list.some((o) => o.id === id))
                throw new Error(copy.lgEntryMoved);
            newId = mintObservationId(new Set([...list, ...(s.removed_observations ?? [])].map((o) => o.id).filter((x) => !!x)));
            s.observations = [...list.filter((o) => o.id !== id), { ...fresh, id: newId }];
            const at = new Date().toISOString().slice(0, 19) + "Z";
            s.removed_observations = tombstoneList(tombstoneMap(s.removed_observations, [{ id, at }]));
        });
        return { seasonId, obs: (saved.observations ?? []).find((o) => o.id === newId) ?? { ...fresh, id: newId } };
    }
    const filed = await fileObservation(db, plot, fresh);
    await removeObservation(db, plot, seasonId, id);
    return filed;
}
function changePlantingEntry(db, plot, seasonId, plantingId, key, index, was, next) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = (s.plantings ?? []).find((x) => x.id === plantingId);
        const list = (p?.[key] ?? []);
        if (!p || JSON.stringify(list[index]) !== JSON.stringify(was))
            throw new Error(copy.lgEntryMoved);
        const out = [...list];
        if (next)
            out[index] = next;
        else
            out.splice(index, 1);
        p[key] = out;
    });
}
function restorePlantingEntry(db, plot, seasonId, plantingId, key, index, entry) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = (s.plantings ?? []).find((x) => x.id === plantingId);
        if (!p)
            throw new Error(copy.lgEntryMoved);
        const out = [...(p[key] ?? [])];
        out.splice(Math.min(index, out.length), 0, entry);
        p[key] = out;
    });
}
function setJobAside(db, plot, seasonId, job, aside) {
    return updateSeason(db, plot, seasonId, (s) => {
        const at = new Date().toISOString().slice(0, 19) + "Z";
        const rest = (s.set_aside ?? []).filter((e) => e.job !== job);
        s.set_aside = [...rest, aside ? { job, at } : { job, at, back: true }].sort((a, b) => (a.job < b.job ? -1 : 1));
    });
}
function addFailure(db, plot, seasonId, index, failure) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.failures ??= []).push(failure);
    });
}
function addPlantingNote(db, plot, seasonId, index, note) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.notes ??= []).push(note);
    });
}
const photoKey = (plot, seasonId, name) => `${plot}:${seasonId}:${name}`;
let persistAsked = false;
function ensurePersisted() {
    if (persistAsked)
        return;
    persistAsked = true;
    try {
        void navigator.storage?.persist?.();
    }
    catch { }
}
async function storageEstimate() {
    try {
        const e = await navigator.storage?.estimate?.();
        if (e && typeof e.usage === "number" && typeof e.quota === "number")
            return { usage: e.usage, quota: e.quota };
    }
    catch { }
    return null;
}
function putPhoto(db, plot, seasonId, name, blob) {
    ensurePersisted();
    return asPromise(store(db, "photos", "readwrite").put(blob, photoKey(plot, seasonId, name))).then(() => undefined);
}
function getPhoto(db, plot, seasonId, name) {
    return asPromise(store(db, "photos", "readonly").get(photoKey(plot, seasonId, name)));
}
function endPlanting(db, plot, seasonId, index, end_cause, end_date) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        p.end_cause = end_cause;
        p.end_date = end_date;
        delete p.carried_over;
    });
}
function removePlanting(db, plot, seasonId, index) {
    return updateSeason(db, plot, seasonId, (s) => {
        if (!s.plantings?.[index])
            throw new Error(`no planting #${index} in season ${seasonId}`);
        s.plantings.splice(index, 1);
    });
}
function updatePlanting(db, plot, seasonId, index, patch) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        const rec = p;
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === "")
                delete rec[k];
            else
                rec[k] = v;
        }
        if (rec.end_cause || rec.end_date)
            delete rec.carried_over;
    });
}
function listPlots(db, workspace) {
    const all = asPromise(store(db, "plots", "readonly").getAll());
    if (workspace === "all")
        return all;
    if (workspace)
        return all.then((ps) => ps.filter((p) => !p.example && (p.owner ?? "draft") === workspace));
    return all.then((ps) => ps.filter(plotVisible));
}
function getPlot(db, id) {
    return asPromise(store(db, "plots", "readonly").get(id));
}
async function putPlot(db, plot) {
    if (!plot.id)
        throw new Error("a plot needs an id");
    for (const bed of plot.beds)
        parseRegion(bed.region);
    if (!plot.example && !plot.owner)
        plot.owner = activeWorkspace();
    if (!plot.example)
        ensurePersisted();
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await stamp(db, `plot:${plot.id}`);
    return plot;
}
function deletePlot(db, id) {
    return asPromise(store(db, "plots", "readwrite").delete(id));
}
function listPlotTombstones(db) {
    return asPromise(store(db, "plot_tombstones", "readonly").getAll());
}
function putPlotTombstone(db, t) {
    return asPromise(store(db, "plot_tombstones", "readwrite").put(t));
}
function deletePlotTombstone(db, id) {
    return asPromise(store(db, "plot_tombstones", "readwrite").delete(id));
}
async function eraseGarden(db, plotId, opts) {
    const plot = await getPlot(db, plotId);
    const name = opts.name ?? plot?.name ?? plotId;
    const seasons = await listSeasons(db, plotId);
    if (plot)
        await backupReplaced(db, "plot", plotId, plot, null);
    for (const sn of seasons) {
        await backupReplaced(db, "season", `${plotId}:${sn.id}`, sn, null);
        await deleteSeason(db, plotId, sn.id);
    }
    for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === plotId)) {
        await deleteSoilObservation(db, rec, false);
    }
    if (plot)
        await deletePlot(db, plotId);
    const meta = store(db, "sync_meta", "readwrite");
    await asPromise(meta.delete(`plot:${plotId}`));
    for (const sn of seasons)
        await asPromise(store(db, "sync_meta", "readwrite").delete(`season:${plotId}:${sn.id}`));
    if (opts.tombstone) {
        await putPlotTombstone(db, { id: plotId, name, deletedAt: opts.deletedAt ?? Date.now() });
        onLocalWrite?.();
    }
    return { name, seasons: seasons.length };
}
async function setGardenClosed(db, plotId, date) {
    const plot = await getPlot(db, plotId);
    if (!plot || plot.example || plot.shared)
        return plot;
    const next = { ...plot };
    if (date)
        next.closed_date = date;
    else
        delete next.closed_date;
    return putPlot(db, next);
}
async function eraseAccountData(db, { photos = false } = {}) {
    const all = await listPlots(db, "all");
    const acct = all.filter((p) => !p.example && (p.owner ?? "draft") === "account").map((p) => p.id);
    const drafts = all.filter((p) => !p.example && (p.owner ?? "draft") === "draft").map((p) => p.id);
    for (const id of acct) {
        for (const sn of await listSeasons(db, id))
            await deleteSeason(db, id, sn.id);
        for (const po of await listPosts(db, id))
            await deletePost(db, id, po.id);
        for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === id))
            await deleteSoilObservation(db, rec, false);
        await deletePlot(db, id);
    }
    for (const name of ["user_species", "seeds", "plot_tombstones", "sync_backups"])
        await asPromise(store(db, name, "readwrite").clear());
    const draftKey = (k) => drafts.some((d) => k.endsWith(`:${d}`) || k.includes(`:${d}:`));
    for (const m of await listSyncMeta(db))
        if (!draftKey(m.key))
            await asPromise(store(db, "sync_meta", "readwrite").delete(m.key));
    const keys = await asPromise(store(db, "photos", "readonly").getAllKeys());
    if (photos) {
        const own = [...drafts, ...all.filter((p) => p.example).map((p) => p.id)];
        for (const k of keys)
            if (!own.some((id) => String(k).startsWith(`${id}:`)))
                await asPromise(store(db, "photos", "readwrite").delete(k));
        return { photosKept: 0 };
    }
    return { photosKept: keys.filter((k) => acct.some((id) => String(k).startsWith(`${id}:`))).length };
}
async function freePlotId(db, base) {
    let id = base;
    for (let n = 2; await getPlot(db, id); n++)
        id = `${base}_${n}`;
    return id;
}
async function rekeyPlot(db, oldId, newId, changes = {}) {
    const plot = await getPlot(db, oldId);
    if (!plot)
        throw new Error(`no garden with id ${oldId}`);
    if (oldId !== newId && await getPlot(db, newId))
        throw new Error(`a garden with id ${newId} already exists`);
    const moved = { ...plot, ...changes, id: newId };
    await putPlot(db, moved);
    for (const sn of await listSeasons(db, oldId)) {
        await putSeason(db, { ...sn, plot: newId });
        await deleteSeason(db, oldId, sn.id);
    }
    for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === oldId)) {
        await deleteSoilObservation(db, rec, false);
        await putSoilObservation(db, { ...rec, plot: newId });
    }
    if (oldId !== newId) {
        const prefix = `${oldId}:`;
        const keys = (await asPromise(store(db, "photos", "readonly").getAllKeys()))
            .filter((k) => typeof k === "string" && k.startsWith(prefix));
        for (const k of keys) {
            const blob = await asPromise(store(db, "photos", "readonly").get(k));
            if (blob)
                await asPromise(store(db, "photos", "readwrite").put(blob, `${newId}:${k.slice(prefix.length)}`));
            await asPromise(store(db, "photos", "readwrite").delete(k));
        }
        await deletePlot(db, oldId);
        await asPromise(store(db, "sync_meta", "readwrite").delete(`plot:${oldId}`));
    }
    return moved;
}
const PLOT_NAME_MAX = 200;
const PLOT_ADDRESS_MAX = 500;
const PLOT_EMAIL_MAX = 320;
const PLOT_BEDS_MAX = 500;
const PLOT_LIST_MAX = 2000;
const PLOT_SUPPORTS_MAX = 50;
const OWN_PLOT_ID_RE = /^(?:plot|draft)_[a-z0-9_]{1,100}$/;
const ACCOUNT_PLOT_ID_RE = /^plot_[a-z0-9_]{1,100}$/;
const SHARED_PLOT_ID_RE = /^shared:[A-Za-z0-9-]{1,8}:plot_[a-z0-9_]{1,100}$/;
const BED_SUN = new Set(["full", "part_shade"]);
const BED_STRUCTURE = new Set(["raised", "in_ground", "container", "field"]);
const BED_RAIN = new Set(["covered", "indoors"]);
function isRec(v) { return typeof v === "object" && v !== null && !Array.isArray(v); }
function finiteIn(v, lo, hi) { return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi; }
function plotStr(rec, key, prefix, max, errors, required = false) {
    if (!(key in rec)) {
        if (required)
            errors.push(`${prefix}.${key} is missing`);
        return;
    }
    const v = rec[key];
    if (typeof v !== "string" || v === "")
        errors.push(`${prefix}.${key} must be a non-empty string`);
    else if (v.length > max)
        errors.push(`${prefix}.${key} is longer than ${max} characters`);
}
function plotBool(rec, key, prefix, errors) {
    if (key in rec && typeof rec[key] !== "boolean")
        errors.push(`${prefix}.${key}, if present, must be a boolean`);
}
function plotRegion(rec, prefix, errors) {
    if (!("region" in rec)) {
        errors.push(`${prefix}.region is missing`);
        return;
    }
    try {
        parseRegion(rec.region);
    }
    catch (e) {
        errors.push(`${prefix}.region: ${e.message}`);
    }
}
function validatePlot(p) {
    const errors = [];
    if (!isRec(p))
        return ["plot is not an object"];
    const sharedId = typeof p.id === "string" && SHARED_PLOT_ID_RE.test(p.id);
    if (typeof p.id !== "string" || !(OWN_PLOT_ID_RE.test(p.id) || sharedId)) {
        errors.push("plot.id must be a plot_<slug>, draft_<slug> or shared:<owner>:plot_<slug> id");
    }
    if ("shared" in p) {
        if (!isRec(p.shared))
            errors.push("plot.shared, if present, must be an object");
        else {
            plotStr(p.shared, "ownerId", "plot.shared", 64, errors, true);
            plotStr(p.shared, "plot", "plot.shared", PLOT_NAME_MAX, errors, true);
            if (typeof p.shared.plot === "string" && !ACCOUNT_PLOT_ID_RE.test(p.shared.plot))
                errors.push("plot.shared.plot must be the owner's plot_<slug> id");
            plotStr(p.shared, "ownerEmail", "plot.shared", PLOT_EMAIL_MAX, errors);
            plotStr(p.shared, "teamName", "plot.shared", PLOT_NAME_MAX, errors);
            if (typeof p.id === "string" && !sharedId)
                errors.push("plot.shared is present but plot.id is not a shared:<owner>:plot_<slug> id");
        }
    }
    else if (sharedId)
        errors.push("plot.id is a shared id but plot.shared is missing");
    if ("owner" in p && p.owner !== "draft" && p.owner !== "account")
        errors.push('plot.owner, if present, must be "draft" or "account"');
    plotBool(p, "example", "plot", errors);
    plotStr(p, "name", "plot", PLOT_NAME_MAX, errors);
    plotStr(p, "address", "plot", PLOT_ADDRESS_MAX, errors);
    plotStr(p, "country", "plot", 2, errors);
    if ("closed_date" in p && (typeof p.closed_date !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(p.closed_date))) {
        errors.push("plot.closed_date, if present, must be a YYYY-MM-DD date");
    }
    if ("frost_own" in p) {
        const fo = p.frost_own;
        const md = (v) => v === null || (typeof v === "string" && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v));
        if (!fo || typeof fo !== "object" || !md(fo.last) || !md(fo.first) || typeof fo.at !== "number")
            errors.push("plot.frost_own, if present, must be {last, first, at}: MM-DD dates or null, and a time");
    }
    if ("anchor" in p) {
        if (!isRec(p.anchor) || !finiteIn(p.anchor.lat, -90, 90) || !finiteIn(p.anchor.lon, -180, 180)) {
            errors.push("plot.anchor must be {lat, lon} with finite lat in [-90, 90] and lon in [-180, 180]");
        }
    }
    if (!Array.isArray(p.beds))
        errors.push("plot.beds must be a list");
    else if (p.beds.length > PLOT_BEDS_MAX)
        errors.push(`plot.beds has more than ${PLOT_BEDS_MAX} entries`);
    else {
        const names = new Map();
        p.beds.forEach((b, i) => {
            const prefix = `plot.beds[${i}]`;
            if (!isRec(b)) {
                errors.push(`${prefix} is not an object`);
                return;
            }
            plotStr(b, "name", prefix, PLOT_NAME_MAX, errors, true);
            if (typeof b.name === "string") {
                const first = names.get(b.name);
                if (first !== undefined)
                    errors.push(`${prefix}.name duplicates plot.beds[${first}].name - bed names are unique within a plot`);
                else
                    names.set(b.name, i);
            }
            plotRegion(b, prefix, errors);
            if ("rotation_deg" in b && !finiteIn(b.rotation_deg, -360, 360))
                errors.push(`${prefix}.rotation_deg must be a finite number of degrees`);
            for (const k of ["planted", "lane_flip", "sized"])
                plotBool(b, k, prefix, errors);
            if ("sun" in b && !BED_SUN.has(b.sun))
                errors.push(`${prefix}.sun must be one of ${[...BED_SUN].join(" | ")}`);
            if ("structure" in b && !BED_STRUCTURE.has(b.structure))
                errors.push(`${prefix}.structure must be one of ${[...BED_STRUCTURE].join(" | ")}`);
            if ("rain" in b && !BED_RAIN.has(b.rain))
                errors.push(`${prefix}.rain must be one of ${[...BED_RAIN].join(" | ")} (absent = open sky)`);
            if ("supports" in b) {
                if (!Array.isArray(b.supports))
                    errors.push(`${prefix}.supports must be a list`);
                else if (b.supports.length > PLOT_SUPPORTS_MAX)
                    errors.push(`${prefix}.supports has more than ${PLOT_SUPPORTS_MAX} entries`);
                else
                    b.supports.forEach((s, j) => {
                        if (!isRec(s))
                            errors.push(`${prefix}.supports[${j}] is not an object`);
                        else
                            plotStr(s, "id", `${prefix}.supports[${j}]`, PLOT_NAME_MAX, errors, true);
                    });
            }
        });
    }
    if ("removedBeds" in p) {
        if (!Array.isArray(p.removedBeds))
            errors.push("plot.removedBeds must be a list");
        else if (p.removedBeds.length > PLOT_LIST_MAX)
            errors.push(`plot.removedBeds has more than ${PLOT_LIST_MAX} entries`);
        else
            p.removedBeds.forEach((t, i) => {
                const prefix = `plot.removedBeds[${i}]`;
                if (!isRec(t)) {
                    errors.push(`${prefix} is not an object`);
                    return;
                }
                plotStr(t, "name", prefix, PLOT_NAME_MAX, errors, true);
                if (!finiteIn(t.at, 0, 8.64e15))
                    errors.push(`${prefix}.at must be a finite ms-epoch time`);
            });
    }
    if ("prior_occupancy" in p) {
        if (!Array.isArray(p.prior_occupancy))
            errors.push("plot.prior_occupancy must be a list");
        else if (p.prior_occupancy.length > PLOT_LIST_MAX)
            errors.push(`plot.prior_occupancy has more than ${PLOT_LIST_MAX} entries`);
        else
            p.prior_occupancy.forEach((o, i) => {
                const prefix = `plot.prior_occupancy[${i}]`;
                if (!isRec(o)) {
                    errors.push(`${prefix} is not an object`);
                    return;
                }
                plotRegion(o, prefix, errors);
                if (!Number.isInteger(o.year) || !finiteIn(o.year, 1900, 2200))
                    errors.push(`${prefix}.year must be a plausible integer year`);
                if (!Array.isArray(o.families))
                    errors.push(`${prefix}.families must be a list`);
                else if (o.families.length > PLOT_SUPPORTS_MAX)
                    errors.push(`${prefix}.families has more than ${PLOT_SUPPORTS_MAX} entries`);
                else if (!o.families.every((f) => typeof f === "string" && f !== "" && f.length <= PLOT_NAME_MAX))
                    errors.push(`${prefix}.families must be non-empty family keys`);
            });
    }
    return errors;
}
async function putPlotFromSync(db, plot, remoteUpdatedAt) {
    const errors = validatePlot(plot);
    if (errors.length)
        throw new Error(`refusing to store an invalid plot:\n${errors.join("\n")}`);
    let existing = await getPlot(db, plot.id);
    if (existing && !existing.example && (existing.owner ?? "draft") === "draft") {
        await rekeyPlot(db, plot.id, await freePlotId(db, `draft_${plot.id.replace(/^(?:plot|draft)_/, "")}`));
        existing = undefined;
    }
    plot.owner = "account";
    await backupReplaced(db, "plot", plot.id, existing, plot);
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `plot:${plot.id}`, updatedAt: remoteUpdatedAt }));
    return plot;
}
let placeCc = null;
function notePlaceCountry(lat, lon, cc) {
    placeCc = cc ? [lat, lon, cc.toUpperCase()] : null;
}
function placeCountry(lat, lon) {
    return placeCc && Math.abs(placeCc[0] - lat) < 0.25 && Math.abs(placeCc[1] - lon) < 0.35 ? placeCc[2] : undefined;
}
async function setPlotAnchorOnce(db, plotId, lat, lon, address) {
    const found = await getPlot(db, plotId);
    if (!found && !plotId.startsWith(activeWorkspace() === "account" ? "plot_" : "draft_"))
        return { id: plotId, beds: [] };
    const plot = found ?? { id: plotId, beds: [] };
    if (!plot.anchor) {
        plot.anchor = { lat, lon };
        rememberHemisphere(lat);
        const a = address?.trim();
        if (a && !plot.address)
            plot.address = a;
        const cc = placeCountry(lat, lon);
        if (cc)
            plot.country = cc;
        return putPlot(db, plot);
    }
    return plot;
}
async function moveGarden(db, plotId, lat, lon, address) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    plot.anchor = { lat, lon };
    rememberHemisphere(lat);
    const a = address?.trim();
    if (a)
        plot.address = a;
    else
        delete plot.address;
    const cc = placeCountry(lat, lon);
    if (cc)
        plot.country = cc;
    else
        delete plot.country;
    return putPlot(db, plot);
}
async function setBedPlanted(db, plotId, name, planted) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const bed = plot.beds.find((b) => b.name === name);
    if (bed) {
        if (planted)
            bed.planted = true;
        else
            delete bed.planted;
    }
    return putPlot(db, plot);
}
async function removeBed(db, plotId, name, openSeasonId = null) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const removed = plot.beds.find((b) => b.name === name);
    plot.beds = plot.beds.filter((b) => b.name !== name);
    if (removed)
        plot.removedBeds = [...(plot.removedBeds ?? []).filter((t) => t.name !== name), { name, at: Date.now() }];
    if (openSeasonId != null && removed) {
        const season = await getSeason(db, plotId, openSeasonId);
        if (season) {
            const ps = season.plantings ?? [];
            const keptP = ps.filter((p) => { const a = area(p.region); return !(a > 0 && intersectArea(p.region, removed.region) >= 0.5 * a); });
            const plan = (Array.isArray(season.plan) ? season.plan : []);
            const keptPlan = plan.filter((e) => e.area !== name);
            const nextPlan = (Array.isArray(season.next_plan) ? season.next_plan : []);
            const keptNext = nextPlan.filter((e) => e.area !== name);
            if (keptP.length !== ps.length || keptPlan.length !== plan.length || keptNext.length !== nextPlan.length) {
                await putSeason(db, { ...season, plantings: keptP, plan: keptPlan, ...(nextPlan.length ? { next_plan: keptNext } : {}) });
            }
        }
    }
    return putPlot(db, plot);
}
async function renameBed(db, plotId, oldName, newName) {
    const nn = newName.trim();
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    if (!nn)
        throw new Error(copy.ntBedNeedsName);
    if (nn === oldName)
        return plot;
    if (plot.beds.some((b) => b.name === nn))
        throw new Error(fillCopy("ntBedExists", { name: nn }));
    const bed = plot.beds.find((b) => b.name === oldName);
    if (!bed)
        throw new Error(fillCopy("ntNoBed", { name: oldName }));
    bed.name = nn;
    plot.removedBeds = [...(plot.removedBeds ?? []).filter((t) => t.name !== oldName && t.name !== nn), { name: oldName, at: Date.now() }];
    if (!plot.removedBeds.length)
        delete plot.removedBeds;
    await putPlot(db, plot);
    for (const season of await listSeasons(db, plotId)) {
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        const nextPlan = (Array.isArray(season.next_plan) ? season.next_plan : []);
        const inPlan = plan.some((e) => e.area === oldName), inNext = nextPlan.some((e) => e.area === oldName);
        if (inPlan || inNext) {
            await putSeason(db, { ...season,
                ...(inPlan ? { plan: plan.map((e) => (e.area === oldName ? { ...e, area: nn } : e)) } : {}),
                ...(inNext ? { next_plan: nextPlan.map((e) => (e.area === oldName ? { ...e, area: nn } : e)) } : {}) });
        }
    }
    return plot;
}
async function setPlotName(db, plotId, name) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const nn = name.trim();
    if (nn)
        plot.name = nn;
    else
        delete plot.name;
    return putPlot(db, plot);
}
async function setGardenFrost(db, plotId, last, first) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    plot.frost_own = { last, first, at: Date.now() };
    return putPlot(db, plot);
}
async function placeBed(db, plotId, name, region, rotationDeg, sun, structure, sized, laneFlip, depthCm, rain) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const prev = plot.beds.find((b) => b.name === name);
    const bed = { name, region: parseRegion(region) };
    if (sized)
        bed.sized = true;
    if (typeof rotationDeg === "number" && Number.isFinite(rotationDeg) && rotationDeg % 360 !== 0) {
        bed.rotation_deg = ((rotationDeg % 360) + 360) % 360;
    }
    if (prev?.planted)
        bed.planted = true;
    const nextSun = sun === undefined ? prev?.sun : (sun ?? undefined);
    if (nextSun === "full" || nextSun === "part_shade")
        bed.sun = nextSun;
    const nextStruct = structure === undefined ? prev?.structure : (structure ?? undefined);
    if (nextStruct === "raised" || nextStruct === "in_ground" || nextStruct === "container" || nextStruct === "field") {
        bed.structure = nextStruct;
    }
    const nextDepth = depthCm === undefined ? prev?.depth_cm : (depthCm ?? undefined);
    if (typeof nextDepth === "number" && Number.isFinite(nextDepth) && nextDepth > 0
        && (bed.structure === "raised" || bed.structure === "container")) {
        bed.depth_cm = Math.round(nextDepth * 10) / 10;
    }
    const nextRain = rain === undefined ? prev?.rain : (rain ?? undefined);
    if (nextRain === "covered" || nextRain === "indoors")
        bed.rain = nextRain;
    const nextFlip = laneFlip === undefined ? prev?.lane_flip : (laneFlip ?? undefined);
    if (nextFlip === true)
        bed.lane_flip = true;
    plot.beds = [...plot.beds.filter((b) => b.name !== name), bed];
    if (plot.removedBeds?.length) {
        const remaining = plot.removedBeds.filter((t) => t.name !== name);
        if (remaining.length)
            plot.removedBeds = remaining;
        else
            delete plot.removedBeds;
    }
    return putPlot(db, plot);
}
async function setPriorOccupancy(db, plotId, region, year, families) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const key = JSON.stringify(parseRegion(region));
    const rest = (plot.prior_occupancy ?? []).filter((s) => JSON.stringify(parseRegion(s.region)) !== key);
    const fams = [...new Set(families)].filter(Boolean).sort();
    if (fams.length)
        plot.prior_occupancy = [...rest, { region: parseRegion(region), year, families: fams }];
    else if (rest.length)
        plot.prior_occupancy = rest;
    else
        delete plot.prior_occupancy;
    return putPlot(db, plot);
}
function listUserSpecies(db) {
    return asPromise(store(db, "user_species", "readonly").getAll());
}
const soilBase = (rec) => `${rec.plot}:${rec.date}:${rec.region ? JSON.stringify(rec.region) : ""}`;
const soilKey = (rec) => soilBase(rec) + (rec.ph !== undefined ? (rec.ph_method === "calcium_chloride" || rec.ph_method === "other_salt" ? ":ph:salt"
    : rec.ph_method === "unknown" ? ":ph:unsure" : ":ph")
    : REPORT_FIELDS.some((k) => rec[k] !== undefined) ? ":report"
        : rec.texture !== undefined || rec.medium !== undefined ? ""
            : rec.amendment !== undefined ? `:amendment:${String(rec.amendment)}` : ":drainage");
const soilStore = (db, mode) => store(db, "soil_observations", mode);
const soilAt = (db, key) => asPromise(soilStore(db, "readonly").get(key));
function listSoilObservations(db) {
    return asPromise(soilStore(db, "readonly").getAll());
}
async function listSoilEntries(db) {
    const s = soilStore(db, "readonly");
    const [at, recs] = await Promise.all([asPromise(s.getAllKeys()), asPromise(s.getAll())]);
    return recs.map((rec, i) => ({ at: String(at[i]), key: soilKey(rec), rec }));
}
async function putSoilFromSync(db, key, rec, at) {
    const gone = "deleted_at" in rec;
    const errors = gone ? [] : validateObservation(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const k = gone ? key : soilKey(rec);
    for (const e of await listSoilEntries(db))
        if (e.key === k)
            await asPromise(soilStore(db, "readwrite").delete(e.at));
    if (!gone)
        await asPromise(soilStore(db, "readwrite").put(rec, k));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `soil:${k}`, updatedAt: at, gone }));
}
async function putSoilObservation(db, rec) {
    const errors = validateObservation(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const key = soilKey(rec);
    const prev = await soilAt(db, key);
    const home = prev && soilKey(prev);
    if (home && home !== key && !(await soilAt(db, home))) {
        await asPromise(soilStore(db, "readwrite").put(prev, home));
        await stamp(db, `soil:${home}`);
    }
    await asPromise(soilStore(db, "readwrite").put(rec, key));
    await stamp(db, `soil:${key}`);
    return rec;
}
async function deleteSoilObservation(db, rec, gone = true) {
    const base = soilBase(rec);
    const old = base !== soilKey(rec) ? await soilAt(db, base) : undefined;
    const key = old && JSON.stringify(old) === JSON.stringify(rec) ? base : soilKey(rec);
    await asPromise(soilStore(db, "readwrite").delete(key));
    if (gone) {
        await asPromise(store(db, "sync_meta", "readwrite").put({ key: `soil:${soilKey(rec)}`, updatedAt: Date.now(), gone }));
        onLocalWrite?.();
    }
}
async function putUserSpecies(db, rec) {
    const errors = validateUserSpecies(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    await asPromise(store(db, "user_species", "readwrite").put(rec));
    await stamp(db, `user_species:${rec.id}`);
    return rec;
}
async function deleteUserSpecies(db, id) {
    await asPromise(store(db, "user_species", "readwrite").delete(id));
    await asPromise(store(db, "sync_meta", "readwrite").delete(`user_species:${id}`));
}
async function putUserSpeciesFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateUserSpecies(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listUserSpecies(db)).find((u) => u.id === rec.id);
    await backupReplaced(db, "user_species", rec.id, existing, rec);
    await asPromise(store(db, "user_species", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `user_species:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}
function validateSeed(rec) {
    const errs = [];
    if (!rec || typeof rec !== "object")
        return ["seed is not an object"];
    if (typeof rec.id !== "string" || !rec.id)
        errs.push("seed.id must be a non-empty string");
    if (typeof rec.species !== "string" || !rec.species)
        errs.push("seed.species must be a non-empty string");
    for (const f of ["group", "variety", "quantity", "notes"]) {
        if (rec[f] !== undefined && typeof rec[f] !== "string")
            errs.push(`seed.${f} must be a string`);
        if (typeof rec[f] === "string" && rec[f].length > 500)
            errs.push(`seed.${f} is too long`);
    }
    if (rec.year !== undefined && (typeof rec.year !== "number" || !Number.isInteger(rec.year)
        || rec.year < 1900 || rec.year > 2200))
        errs.push("seed.year must be a plausible year");
    return errs;
}
function mintSeedId() {
    return `seed_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function listSeeds(db) {
    return asPromise(store(db, "seeds", "readonly").getAll());
}
async function putSeed(db, rec) {
    const errors = validateSeed(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    await asPromise(store(db, "seeds", "readwrite").put(rec));
    await stamp(db, `seed:${rec.id}`);
    return rec;
}
async function deleteSeed(db, id) {
    await asPromise(store(db, "seeds", "readwrite").delete(id));
    await asPromise(store(db, "sync_meta", "readwrite").delete(`seed:${id}`));
}
async function putSeedFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateSeed(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listSeeds(db)).find((s) => s.id === rec.id);
    await backupReplaced(db, "seed", rec.id, existing, rec);
    await asPromise(store(db, "seeds", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `seed:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}

const SPECIES_SLOTS = 8;
const slotColour = (i) => `var(--sp${(((i % SPECIES_SLOTS) + SPECIES_SLOTS) % SPECIES_SLOTS) + 1})`;
const tint = (colour, pct) => `color-mix(in srgb, ${colour} ${pct}%, transparent)`;
function speciesColours(order) {
    const slot = new Map();
    for (const s of order)
        if (s && !slot.has(s))
            slot.set(s, slot.size);
    return (sid) => {
        let i = slot.get(sid);
        if (i === undefined) {
            i = slot.size;
            slot.set(sid, i);
        }
        return slotColour(i);
    };
}
function gardenSpeciesOrder(seasons, openSeasonId, drafts = [], planDots = []) {
    const out = [];
    const add = (s) => { if (s && !out.includes(s))
        out.push(s); };
    const open = seasons.find((s) => s.id === openSeasonId);
    for (const p of open?.plantings ?? [])
        add(p.species);
    for (const p of drafts)
        add(p.species);
    for (const d of planDots)
        add(d.species);
    for (const s of [...seasons].filter((x) => x !== open).sort((a, b) => b.id - a.id)) {
        for (const p of s.plantings ?? [])
            add(p.species);
    }
    return out;
}

const app = {
    speciesName: null,
    planDots: [],
    draftPlantings: [],
    logSnapshot: { seasons: [], beds: [], seasonId: null, priorOccupancy: [] },
    currentPlot: null,
    userSpecies: [],
    soilObservations: [],
    answersTasks: null,
    soilRefresh: null,
    syntheticOn: false,
    currentPlotId: (() => {
        try {
            return sessionStorage.getItem("gg-plot-chosen") ?? defaultPlotId() ?? localStorage.getItem("gg-plot") ?? defaultWorkspacePlotId();
        }
        catch {
            return defaultWorkspacePlotId();
        }
    })(),
    plotGuessed: (() => {
        try {
            return !sessionStorage.getItem("gg-plot-chosen") && !defaultPlotId() && !localStorage.getItem("gg-plot");
        }
        catch {
            return true;
        }
    })(),
    logRefresh: null,
    logHydrated: false,
    ensureZipData: null,
    climateSettled: null,
    climateDataArrived: null,
    openLogBed: null,
    markBedPlantedFromPlan: null,
    revertBedToDraftFromPlan: null,
    teamLabel: null,
    openBedSheet: null,
    planReceipt: null,
    bedPlantWindow: null,
    draftPlantWindow: null,
    bedCalendarJobs: null,
    plannedSpotFor: null,
    refreshUserPlantsUI: null,
    groundRedraw: null,
    groundCenterOn: null,
    groundRefit: null,
    groundRefitIfDrifted: null,
    groundProposeRect: null,
    groundClearProposal: null,
    groundKeepProposal: null,
    groundProposalTaken: null,
    groundDropProposal: null,
    bedAddOpenAt: null,
    logDb: null,
    setLocation: null,
    placeBareGarden: null,
    searchPlaces: null,
    guildIsHills: null,
    bedRotationSeasons: null,
    applyPrefs: null,
    pushPrefs: null,
    syncPrefControls: null,
    onSignIn: null,
    openAuthSheet: null,
    forecastStrip: null,
    forecastSaid: null,
    noticesChanged: null,
    pushControl: null,
    pushOffer: null,
    pushFrost: null,
    closeAuthSheet: null,
    onSignOut: null,
    resetPlanStep: null,
    planSheetMax: null,
    planShowList: null,
    markStarted: null,
    clearStarted: null,
    bedReachNote: null,
    bedContainerNote: null,
    bedStructureBlockers: null,
    showExample: null,
    removeExample: null,
    refreshAuthGate: null,
    homeRefresh: null,
    calendarRefresh: null,
    pull: null,
    invalidateHomePosts: null,
    switchPlot: null,
    openGardenAdd: null,
    afterSync: null,
    landOnDefault: null,
    openWeek: null,
    gardenFacts: null,
    bedFacts: null,
    refreshDraftBanner: null,
    startNextSeason: null,
    viewAs: null,
    refreshEditEntry: null,
};
function setCurrentPlot(id, chosen = false) {
    app.currentPlotId = id;
    app.plotGuessed = false;
    try {
        localStorage.setItem("gg-plot", id);
    }
    catch { }
    if (chosen) {
        try {
            sessionStorage.setItem(CHOSEN_KEY, id);
        }
        catch { }
    }
}
const CHOSEN_KEY = "gg-plot-chosen";
function chosenPlotId() {
    try {
        return sessionStorage.getItem(CHOSEN_KEY);
    }
    catch {
        return null;
    }
}
function clearChosenPlot() {
    try {
        sessionStorage.removeItem(CHOSEN_KEY);
    }
    catch { }
}
function pickGarden(shown, o = {}) {
    const visible = shown.filter((p) => !p.closed_date);
    const has = (id) => !!id && visible.some((p) => p.id === id);
    if (has(o.chosen))
        return o.chosen;
    if (has(o.def))
        return o.def;
    if (!o.def && has(o.last))
        return o.last;
    const owns = visible.filter((p) => !p.example && !p.shared);
    const at = (id) => o.edited?.get(id) ?? 0;
    const bedded = owns.filter((p) => (p.beds?.length ?? 0) > 0)
        .sort((a, b) => (b.beds?.length ?? 0) - (a.beds?.length ?? 0) || at(b.id) - at(a.id));
    return (bedded[0] ?? owns[0] ?? visible.find((p) => !p.example) ?? visible[0])?.id ?? null;
}
function acctDefault() {
    try {
        const v = JSON.parse(localStorage.getItem("gg-default-garden") ?? "null");
        return v && typeof v === "object" && (typeof v.id === "string" || v.id === null) ? { id: v.id, at: typeof v.at === "number" ? v.at : null } : null;
    }
    catch {
        return null;
    }
}
function defaultPlotId() {
    try {
        const legacy = localStorage.getItem("gg-default-plot");
        if (activeWorkspace() === "draft")
            return legacy?.startsWith("draft_") ? legacy : null;
        const acct = acctDefault();
        return acct ? acct.id : (legacy && !legacy.startsWith("draft_") ? legacy : null);
    }
    catch {
        return null;
    }
}
function setDefaultPlot(id) {
    try {
        if (activeWorkspace() === "draft") {
            if (id)
                localStorage.setItem("gg-default-plot", id);
            else
                localStorage.removeItem("gg-default-plot");
            return;
        }
        localStorage.setItem("gg-default-garden", JSON.stringify({ id, at: Date.now() }));
        if (!localStorage.getItem("gg-default-plot")?.startsWith("draft_"))
            localStorage.removeItem("gg-default-plot");
    }
    catch {
        return;
    }
    app.pushPrefs?.();
}
function forgetAccountDefault() {
    try {
        localStorage.removeItem("gg-default-garden");
        if (!localStorage.getItem("gg-default-plot")?.startsWith("draft_"))
            localStorage.removeItem("gg-default-plot");
    }
    catch { }
}
function paintDefaultToggle(btn, isDef) {
    btn.classList.add("garden-def");
    btn.classList.toggle("on", isDef);
    btn.setAttribute("aria-pressed", String(isDef));
    btn.textContent = isDef ? copy.lgDefaultGarden : copy.lgSetDefault;
    btn.title = isDef ? copy.lgDefaultOnTitle : copy.lgDefaultOffTitle;
}
function defaultToggle(isDef, onTap) {
    const b = document.createElement("button");
    b.type = "button";
    paintDefaultToggle(b, isDef);
    b.addEventListener("click", onTap);
    return b;
}
const LEGACY_DEFAULT_AT = 1;
function defaultGardenRecord() {
    const a = acctDefault();
    if (a)
        return { record: { default: a.id }, updatedAt: a.at };
    if (activeWorkspace() === "draft")
        return null;
    const legacy = (() => { try {
        return localStorage.getItem("gg-default-plot");
    }
    catch {
        return null;
    } })();
    return legacy && !legacy.startsWith("draft_") ? { record: { default: legacy }, updatedAt: LEGACY_DEFAULT_AT } : null;
}
function applyDefaultGarden(record, atMs) {
    const id = record?.default;
    try {
        localStorage.setItem("gg-default-garden", JSON.stringify({ id: typeof id === "string" && id ? id : null, at: Number.isFinite(atMs) ? atMs : null }));
    }
    catch { }
}
function activeBundle(bundle) {
    if (!app.userSpecies.length)
        return bundle;
    const scheduled = app.userSpecies.map((s) => {
        const rec = s;
        if (rec.scheduling_model)
            return s;
        const model = rec.lifespan === "perennial" ? "perennial"
            : rec.days_to_maturity != null ? "dtm" : undefined;
        return model ? { ...rec, scheduling_model: model } : s;
    });
    return mergeUserSpecies(bundle, scheduled);
}
const regionalEs = (name, country = app.currentPlot?.country) => regionalName(name, country);
function commonName(bundle, sid) {
    const es = appLang() === "es" ? speciesNameEs(sid) ?? spanishNames(bundle, sid)[0] ?? corpusEs(sid, "common.0") ?? undefined : undefined;
    if (es)
        return markPlantName(sentenceCase(regionalEs(es)));
    const [en, corpus] = englishNamed(bundle, sid);
    return corpus && appLang() !== "es" && !app.userSpecies.some((u) => u.id === sid) ? markPlantName(en) : en;
}
const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && !!x) : [];
function spanishNames(bundle, sid) {
    const sp = bundle.species.find((s) => s.id === sid);
    if (!sp)
        return [];
    const own = esList(sp.common_es);
    if (own.length)
        return own;
    const groups = Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : [];
    return esList(groups[0]?.common_es);
}
function searchNames(bundle, sid) {
    const sp = bundle.species.find((s) => s.id === sid);
    const common = sp?.common;
    const en = Array.isArray(common) ? common.map(String) : typeof common === "string" ? [common] : [];
    const groups = Array.isArray(sp?.cultivar_groups) ? sp.cultivar_groups : [];
    const groupEn = groups.flatMap((g) => typeof g.common === "string" ? [g.common] : []);
    const shownEs = speciesNameEs(sid);
    return [...en, ...groupEn, ...esList(sp?.common_es), ...groups.flatMap((g) => esList(g.common_es)), ...(shownEs ? [shownEs] : []),
        englishName(bundle, sid), sid.replace(/_/g, " ")];
}
function foldWord(w) {
    const f = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return f.length > 4 && f.endsWith("ies") ? `${f.slice(0, -3)}y` : f;
}
const foldWords = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(foldWord);
const wordMeets = (q, n) => n.startsWith(q) || (n.length >= 3 && q.startsWith(n) && /^e?s$/.test(q.slice(n.length)));
function cropSearch(bundle, ids, query) {
    const q = foldWords(query);
    if (!q.length)
        return { hits: [...ids], exact: true };
    const named = ids.map((sid) => ({ sid, names: searchNames(bundle, sid).map(foldWords) }));
    const exact = named.filter((x) => x.names.some((nw) => q.every((qw) => nw.some((w) => wordMeets(qw, w))))).map((x) => x.sid);
    if (exact.length)
        return { hits: exact, exact: true };
    const long = q.filter((w) => w.length >= 3);
    return { hits: named.filter((x) => x.names.some((nw) => long.some((qw) => nw.some((w) => wordMeets(qw, w))))).map((x) => x.sid), exact: false };
}
function englishName(bundle, sid) {
    return englishNamed(bundle, sid)[0];
}
function englishNamed(bundle, sid) {
    const corpusHit = bundle.species.find((s) => s.id === sid) ?? bundle.entities.find((e) => e.id === sid);
    const hit = corpusHit ?? app.userSpecies.find((s) => s.id === sid);
    const c = hit?.common;
    const name = Array.isArray(c) ? c[0] : (typeof c === "string" ? c : undefined);
    if (name == null)
        return [humanize(sid), false];
    return corpusHit ? [sentenceCase(name), true] : [titleCase(name), false];
}
function plantingLabel(bundle, sid, group) {
    const name = commonName(bundle, sid);
    if (!group)
        return name;
    const sp = bundle.species.find((s) => s.id === sid)
        ?? app.userSpecies.find((s) => s.id === sid);
    const groups = Array.isArray(sp?.cultivar_groups)
        ? sp.cultivar_groups : [];
    const g = groups.find((x) => String(x.id) === group);
    const es = appLang() === "es" ? esList(g?.common_es)[0] : undefined;
    if (es)
        return markPlantName(sentenceCase(es));
    const own = typeof g?.common === "string" ? g.common
        : Array.isArray(g?.common) ? String(g.common[0]) : "";
    if (own && appLang() === "es")
        return fillCopy("plGroupEn", { name, group: sentenceCase(own) });
    return own ? markPlantName(sentenceCase(own)) : `${name} - ${humanize(group)}`;
}
function gardenShownName(name, shared) {
    return shared ? fillCopy("lgNameTagged", { name, tag: copy.teamsSharedTag }) : name;
}
const gardenLat = () => app.currentPlot?.anchor?.lat ?? null;
function ruleClaimAsRecorded(bundle, id) {
    const r = bundle.rules.find((x) => x.id === id);
    return (r?.claim ?? r?.claim_refuted ?? "").trim();
}
function ruleClaim(bundle, id) {
    const r = bundle.rules.find((x) => x.id === id);
    const es = corpusEs(id, "title");
    if (es)
        return localiseProse(es);
    return localiseProse(plainClaim(r?.title?.trim() || ruleClaimAsRecorded(bundle, id), gardenLat()));
}
const regionLabel = (r) => r.shape === "polygon"
    ? fillCopy("stTraced", { area: fmtArea(area(r)), n: r.points.length })
    : fillCopy("stRectAt", { w: fmtLen(r.w), l: fmtLen(r.h), x: fmtLen(r.x), y: fmtLen(r.y) });
function isRoundPolygon(pts) {
    if (pts.length < 12)
        return false;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const rs = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    return mean > 0 && Math.max(...rs.map((r) => Math.abs(r - mean))) / mean < 0.08;
}
function bedShapeLabel(bed) {
    const r = bed.region;
    if (r.shape !== "polygon")
        return `${fmtLen(r.w)} × ${fmtLen(r.h)}`;
    const pts = r.points;
    if (bed.rotation_deg && bed.rotation_deg % 360 !== 0 && pts.length === 4) {
        const w = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
        const l = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
        return fillCopy("stRotated", { w: fmtLen(w), l: fmtLen(l), deg: Math.round(bed.rotation_deg) });
    }
    if (isRoundPolygon(pts)) {
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const meanR = pts.reduce((s, [x, y]) => s + Math.hypot(x - cx, y - cy), 0) / pts.length;
        return fillCopy("stRoundAcross", { d: fmtLen(2 * meanR) });
    }
    return fillCopy("stTraced", { area: fmtArea(area(r)), n: pts.length });
}
const PLAN_FRESH_KEY = "gg-plan-fresh";
function markPlanFresh() {
    try {
        localStorage.setItem(PLAN_FRESH_KEY, "1");
    }
    catch { }
}
function takePlanFresh(spend = true) {
    try {
        const on = localStorage.getItem(PLAN_FRESH_KEY) === "1";
        if (on && spend)
            localStorage.removeItem(PLAN_FRESH_KEY);
        return on;
    }
    catch {
        return false;
    }
}
const MY_PLANTS_KEY = "gg-mine";
function rememberMyPlants(own) {
    if (!own)
        return;
    const ids = gardenPlants()
        .filter((sid) => /^[a-z][a-z0-9_]*$/.test(sid)).slice(0, 12);
    try {
        if (ids.length)
            localStorage.setItem(MY_PLANTS_KEY, ids.join(","));
        else
            localStorage.removeItem(MY_PLANTS_KEY);
    }
    catch { }
}
function gardenColours() {
    return speciesColours(gardenPlants());
}
function gardenPlants() {
    return gardenSpeciesOrder(app.logSnapshot.seasons, app.logSnapshot.seasonId, app.draftPlantings, app.planDots);
}

let pointer = null;
function seasonId() {
    return pointer;
}
function setSeasonId(id) {
    pointer = id;
    app.logSnapshot.seasonId = id;
}
function resolveSeasonId(seasons, chosen) {
    const open = seasons.filter((s) => !s.closed_date);
    if (chosen != null && open.some((s) => s.id === chosen))
        return chosen;
    return open.length ? open.reduce((a, b) => (a.id >= b.id ? a : b)).id : null;
}
function openSeason() {
    return pointer == null ? null : app.logSnapshot.seasons.find((s) => s.id === pointer) ?? null;
}
function priorSeasons() {
    return app.logSnapshot.seasons.filter((s) => s.id !== pointer);
}
function seasonById(id) {
    return id == null ? null : app.logSnapshot.seasons.find((s) => s.id === id) ?? null;
}
function upsertSeasonSnapshot(updated) {
    const i = app.logSnapshot.seasons.findIndex((s) => s.id === updated.id);
    if (i >= 0)
        app.logSnapshot.seasons[i] = updated;
    else
        app.logSnapshot.seasons.push(updated);
}
function lifespanPersists(species, group = null) {
    const life = resolvedField(species, group, "lifespan");
    return life === "perennial" || life === "biennial";
}
function resolvePlantingAtClose(p, cause, date, persists) {
    if (p.end_cause || p.carried_over)
        return p;
    return persists(p.species, p.cultivar_group ?? null) ? { ...p, carried_over: true } : { ...p, end_cause: cause, end_date: date };
}
function closedBed(season, onBed, resolve) {
    return { ...season, plantings: (season.plantings ?? []).map((p) => (onBed(p) ? resolve(p) : p)) };
}
function rolledSeason(season, resolve, date) {
    return { ...season, plantings: (season.plantings ?? []).map(resolve), closed_date: date };
}
function reopenedSeason(season) {
    const reopened = { ...season };
    delete reopened.closed_date;
    return reopened;
}
function nextSeasonFrom(season, existing, plotId, nextId = season.id + 1) {
    const base = existing ?? { id: nextId, plot: plotId, plantings: [], observations: [] };
    const forwarded = forwardCarried(season.plantings ?? [], base.plantings ?? []);
    const plantings = [...(base.plantings ?? []), ...forwarded];
    return { season: seedNextPlan(season, { ...base, plantings }), carried: forwarded.length };
}
function comingSeasonAfter(last, todayIso, lat, freezeMmdd) {
    const cur = seasonYearOf(todayIso, lat);
    const over = freezeMmdd != null && fallDate(freezeMmdd, cur, lat) < todayIso;
    return Math.max(last + 1, over ? cur + 1 : cur);
}
function seasonAfter(id, seasons, todayIso, lat, freezeMmdd) {
    if (seasons.some((s) => s.id > id))
        return id + 1;
    return comingSeasonAfter(id, todayIso, lat, freezeMmdd);
}
function carriedDrafts(seasons, todayIso, lat, freezeMmdd) {
    if (!seasons.length)
        return null;
    const last = seasons.reduce((a, b) => (b.id > a.id ? b : a));
    const drafts = (last.next_plan ?? []);
    if (!drafts.length)
        return null;
    const coming = seasonAfter(last.id, seasons, todayIso, lat, freezeMmdd);
    const started = new Set(seasons.map((s) => s.id));
    const passed = (e) => typeof e.year === "number" && typeof e.area === "string" && e.year > last.id && e.year < coming && !started.has(e.year);
    if (!drafts.some(passed))
        return null;
    const keep = new Map();
    for (const e of drafts) {
        if (typeof e.area !== "string" || !(e.year === coming || passed(e)))
            continue;
        const had = keep.get(e.area);
        if (!had || had.year !== coming && (e.year === coming || e.year > had.year))
            keep.set(e.area, e);
    }
    const next_plan = drafts.flatMap((e) => !passed(e) ? [e] : keep.get(e.area) === e ? [{ ...e, year: coming }] : []);
    return { seasonId: last.id, next_plan };
}

function monthRuns(months) {
    const set = new Set(months.filter((m) => m >= 1 && m <= 12));
    if (!set.size)
        return [];
    if (set.size === 12)
        return [{ from: 1, to: 12, len: 12 }];
    const out = [];
    for (let m = 1; m <= 12; m++) {
        if (!set.has(m) || set.has(m === 1 ? 12 : m - 1))
            continue;
        let len = 0;
        for (let e = m; set.has(e) && len < 12; e = e === 12 ? 1 : e + 1)
            len++;
        out.push({ from: m, to: ((m + len - 2) % 12) + 1, len });
    }
    return out;
}
function seasonBounds(year, lat) {
    return isSouthern(lat) ? { start: `${year}-07-01`, end: `${year + 1}-06-30` } : { start: `${year}-01-01`, end: `${year}-12-31` };
}
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => {
    const d = new Date(Date.UTC(y, m, 0));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
function runOccurrences(r, year, lat, after = null) {
    const b = seasonBounds(year, lat);
    if (r.len === 12)
        return [{ start: b.start, end: b.end }];
    const y0 = Number(b.start.slice(0, 4));
    const out = [];
    for (const y of [y0 - 1, y0, y0 + 1]) {
        const first = after && Number(after.slice(0, 2)) === r.from ? `${y}-${after}` : `${y}-${pad(r.from)}-01`;
        const end = lastDay(y, r.from - 1 + r.len);
        if (end < b.start || first > b.end)
            continue;
        out.push({ start: first, end });
    }
    return out;
}
const MONTH_LEN_DAYS$2 = 30.4;
function sowByOf(o, days, before = null) {
    if (!Number.isFinite(days) || days <= 0)
        return o.end;
    const n = Math.max(1, Math.ceil(days / MONTH_LEN_DAYS$2));
    const grown = new Date(`${lastDay(Number(o.end.slice(0, 4)), Number(o.end.slice(5, 7)) + n - 1)}T00:00:00Z`);
    grown.setUTCDate(grown.getUTCDate() - days);
    let by = grown.toISOString().slice(0, 10);
    if (before) {
        const frost = new Date(`${nextOn(before, o.start)}T00:00:00Z`);
        frost.setUTCDate(frost.getUTCDate() - days);
        const fb = frost.toISOString().slice(0, 10);
        if (fb < by)
            by = fb;
    }
    return by < o.start ? o.start : by > o.end ? o.end : by;
}
const nextOn = (mmdd, iso) => `${Number(iso.slice(0, 4)) + (`${iso.slice(0, 4)}-${mmdd}` < iso ? 1 : 0)}-${mmdd}`;
function fewestDays(dtm) {
    const d = Array.isArray(dtm) ? Math.min(...dtm) : Number(dtm);
    return dtm != null && Number.isFinite(d) && d > 0 ? d : null;
}
const COMMON_YEAR = 2025;
function sowSpans(months, days, after = null, year = null, lat = null, before = null) {
    return monthRuns(months).map((r) => {
        if (r.len === 12)
            return { from: 1, start: null, close: null, whole: true, all: true };
        let occ;
        let s0 = "";
        if (year == null) {
            const first = after && Number(after.slice(0, 2)) === r.from ? `${COMMON_YEAR}-${after}` : `${COMMON_YEAR}-${pad(r.from)}-01`;
            occ = [{ start: first, end: lastDay(COMMON_YEAR, r.from - 1 + r.len) }];
        }
        else {
            occ = runOccurrences(r, year, lat, after);
            s0 = seasonBounds(year, lat).start;
        }
        const dated = occ.map((o) => ({ start: o.start, close: days == null ? o.end : sowByOf(o, days, before) }));
        const pick = dated.find((o) => year == null || o.close >= s0) ?? dated[dated.length - 1];
        const next = new Date(`${pick.close}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        return { from: r.from, start: pick.start, close: pick.close, whole: next.getUTCDate() === 1, all: false };
    });
}
function sowMonths(months, days, after = null, before = null) {
    const out = new Set();
    for (const s of sowSpans(months, days, after, null, null, before)) {
        if (s.all)
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const last = (Number(s.close.slice(0, 4)) - COMMON_YEAR) * 12 + Number(s.close.slice(5, 7));
        for (let m = s.from; m <= last; m++)
            out.add(((m - 1) % 12) + 1);
    }
    return [...out].sort((a, b) => a - b);
}

function nightMaxOf(resolved) {
    const v = resolved.night_temp_max_c;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function plantingWindowFor(lat, lon, speciesIds, bundle) {
    if (lat == null || lon == null)
        return null;
    const cl = scheduleSite(lat, lon, bundle);
    if (!cl)
        return null;
    const night = cl.summer_night_tmin_c ?? null;
    let heatLimited = false;
    for (const sid of speciesIds) {
        const nightMax = nightMaxOf(resolveSpecies(sid, null, bundle));
        if (nightMax !== null && night !== null && night > nightMax)
            heatLimited = true;
    }
    return {
        last_frost_p50: cl.last_frost_32f?.p50 ?? null,
        first_freeze_p50: cl.first_freeze_32f_p50 ?? null,
        growing_season_days: cl.growing_season_days_p50 ?? null,
        heat_limited: heatLimited,
    };
}
const LONG_DAY_NORTH = [4, 5, 6, 7, 8, 9];
const LONG_DAY_SOUTH = [10, 11, 12, 1, 2, 3];
function boltMonthsFor(site, lat, speciesIds, bundle) {
    const rule = (bundle.rules ?? []).find((r) => r.id === "R-172");
    const tmax = site?.tmax_mly_c;
    if (!rule || lat == null || !Array.isArray(tmax) || tmax.length !== 12)
        return {};
    const want = rule.applies_to?.species;
    const covered = new Set(Array.isArray(want) ? want : want ? [want] : []);
    const longDays = lat < 0 ? LONG_DAY_SOUTH : LONG_DAY_NORTH;
    const out = {};
    for (const sid of speciesIds) {
        if (!covered.has(sid))
            continue;
        const thr = resolveSpecies(sid, null, bundle).bolt_risk?.threshold_c;
        if (typeof thr !== "number")
            continue;
        const months = [];
        for (let m = 1; m <= 12; m++)
            if (longDays.includes(m) && tmax[m - 1] >= thr)
                months.push(m);
        if (months.length)
            out[sid] = months;
    }
    return out;
}
function hotHarvestMonthsFor(site, speciesIds, bundle) {
    const tmax = site?.tmax_mly_c;
    if (!Array.isArray(tmax) || tmax.length !== 12)
        return {};
    const out = {};
    for (const r of (bundle.rules ?? [])) {
        const dayF = r.trigger?.day_at_or_above_f;
        if (r.trigger?.kind !== "hot_month_harvest" || typeof dayF !== "number")
            continue;
        const dayC = ((dayF - 32) * 5) / 9;
        const months = [];
        for (let m = 1; m <= 12; m++)
            if (tmax[m - 1] >= dayC)
                months.push(m);
        if (!months.length)
            continue;
        const want = r.applies_to?.species;
        for (const sid of Array.isArray(want) ? want : want ? [want] : []) {
            if (!speciesIds.includes(sid))
                continue;
            const set = out[sid] ?? (out[sid] = new Set());
            for (const m of months)
                set.add(m);
        }
    }
    return Object.fromEntries(Object.entries(out).map(([sid, set]) => [sid, [...set].sort((a, b) => a - b)]));
}
const MONTH_LEN_DAYS$1 = 30.4;
function nightBounds(sid, sp, bundle) {
    let lo = null, hi = null;
    for (const r of (bundle.rules ?? [])) {
        const want = r.applies_to?.species;
        if (!(Array.isArray(want) ? want : want ? [want] : []).includes(sid))
            continue;
        if (r.trigger?.kind === "night_temp_below" && typeof sp.night_temp_min_c === "number")
            lo = sp.night_temp_min_c;
        else if (r.trigger?.kind === "night_temp_exceeds" && typeof sp.night_temp_max_c === "number")
            hi = sp.night_temp_max_c;
    }
    return [lo, hi];
}
function warmthWindowsFor(site, lat, keys, bundle) {
    const tmax = twelve(site?.tmax_mly_c), tmin = twelve(site?.tmin_mly_c);
    if (!(bundle.rules ?? []).some((r) => r.id === "R-183") || !tmax || !tmin)
        return {};
    if (site?.temps === "months_only")
        return {};
    const mean = tmax.map((h, i) => (h + tmin[i]) / 2);
    const yearly = mean.reduce((a, b) => a + b, 0) / 12;
    const species = [...new Set(keys.map((k) => k.split("/")[0]))].sort();
    const bolt = boltMonthsFor(site, lat, species, bundle);
    const hot = hotHarvestMonthsFor(site, species, bundle);
    const rules = (bundle.rules ?? []);
    const gate = rules.some((r) => r.id === "R-031") ? frostGate(site) : null;
    const r031 = rules.find((r) => r.id === "R-031")?.applies_to?.frost_tolerance;
    const tender = Array.isArray(r031) ? r031.map(String) : r031 != null ? [String(r031)] : [];
    const coolRun = (from, step, stop = -1) => {
        const run = new Set();
        for (let g = from; mean[g] < yearly && !run.has(g) && g !== stop; g = (g + step + 12) % 12)
            run.add(g);
        return run.add(from);
    };
    const gidx = gate ? Number(gate.date.slice(0, 2)) - 1 : -1;
    const gated = gate ? coolRun(gidx, -1) : new Set();
    const first = givenFirstFrost(site);
    const fidx = first ? Number(first.slice(0, 2)) - 1 : -1;
    const frosty = first ? coolRun(fidx, 1, gidx) : new Set();
    const out = {};
    for (const key of keys) {
        const [sid, grp] = key.split("/");
        const sp = resolveSpecies(sid, grp || null, bundle);
        const lim = sp.month_mean_temp_c;
        const dtm = sp.days_to_maturity;
        if (!lim || typeof lim.min !== "number" || typeof lim.max !== "number" || dtm == null)
            continue;
        const days = Array.isArray(dtm) ? Math.min(...dtm) : Number(dtm);
        const n = Math.max(1, Math.ceil(days / MONTH_LEN_DAYS$1));
        const [loNight, hiNight] = nightBounds(sid, sp, bundle);
        const noHarvest = new Set([...(bolt[sid] ?? []), ...(hot[sid] ?? [])]);
        const harvestOk = (last) => !noHarvest.has(last + 1) && !(loNight != null && tmin[last] < loNight) && !(hiNight != null && tmin[last] > hiNight);
        const gateHere = !!gate && tender.includes(String(sp.frost_tolerance));
        const firstHere = !!first && tender.includes(String(sp.frost_tolerance));
        const frostOk = (span) => (!gateHere || span.every((i, k) => !gated.has(i) || (k === 0 && i === gidx)))
            && (!firstHere || span.every((i, k) => !frosty.has(i) || (k === n - 1 && i === fidx
                && (mmddToDoy$1(first) - (gateHere && span[0] === gidx ? mmddToDoy$1(gate.date) : MONTH_CUM$1[span[0]] + 1) + 365) % 365 >= days)));
        const windowMonths = (monthOk) => {
            const months = [];
            for (let s = 0; s < 12; s++) {
                const span = Array.from({ length: n }, (_, k) => (s + k) % 12);
                if (span.every(monthOk) && harvestOk(span[n - 1]) && frostOk(span))
                    months.push(s + 1);
            }
            return months;
        };
        const { min, max } = lim;
        let months = windowMonths((i) => min <= mean[i] && mean[i] <= max);
        let care = false;
        if (!months.length && mean.every((m) => m > max)) {
            months = windowMonths((i) => mean[i] < yearly);
            care = months.length > 0;
        }
        out[key] = { months, care, after: gateHere && months.includes(gidx + 1) ? gate.date : null, ...(firstHere ? { before: first } : {}) };
    }
    return out;
}
function warmthFloorRule(bundle) {
    const rules = (bundle.rules ?? []).filter((r) => r.trigger?.kind === "warmth_floor");
    return rules.sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))[0] ?? null;
}
function warmRun(ok) {
    if (ok.every(Boolean))
        return 12;
    let best = 0, cur = 0;
    for (const v of [...ok, ...ok]) {
        cur = v ? cur + 1 : 0;
        best = Math.max(best, cur);
    }
    return best;
}
function warmthFloorFor(site, key, bundle, rule = warmthFloorRule(bundle)) {
    if (!rule || !site)
        return null;
    const days = site.growing_season_days_p50;
    if (typeof days !== "number" || days >= 365)
        return null;
    const [sid, grp] = key.split("/");
    const want = rule.applies_to?.species;
    if (!(Array.isArray(want) ? want : want ? [want] : []).includes(sid) || !bundle.species.some((s) => s.id === sid))
        return null;
    const sp = resolveSpecies(sid, grp || null, bundle);
    const lim = sp.month_mean_temp_c;
    const dtm = sp.days_to_maturity;
    if (sp.scheduling_model === "perennial" || sp.lifespan === "perennial" || !lim || typeof lim.min !== "number" || dtm == null)
        return null;
    const id = String(rule.id);
    if (site.temps === "months_only")
        return { rule: id, kind: "warm_held" };
    const tmax = twelve(site.tmax_mly_c), tmin = twelve(site.tmin_mly_c);
    if (!tmax || !tmin)
        return null;
    const floor = lim.min;
    const need = Math.max(1, Math.ceil((Array.isArray(dtm) ? Number(dtm[0]) : Number(dtm)) / MONTH_LEN_DAYS$1));
    const ok = tmax.map((h, i) => (h + tmin[i]) / 2 >= floor);
    if (warmRun(ok) >= need)
        return null;
    const warm = ok.map((v, i) => (v ? i + 1 : 0)).filter(Boolean);
    return warm.length ? { rule: id, kind: "floor_few", floor_c: floor, need, months: warm } : { rule: id, kind: "floor_none", floor_c: floor, need };
}
function warmthFloorClose(site, key, bundle, year, lat, rule = warmthFloorRule(bundle)) {
    if (!rule || !site || warmthFloorFor(site, key, bundle, rule) !== null)
        return null;
    const season = site.growing_season_days_p50;
    if (typeof season !== "number" || season >= 365 || site.temps === "months_only")
        return null;
    const [sid, grp] = key.split("/");
    const want = rule.applies_to?.species;
    if (!(Array.isArray(want) ? want : want ? [want] : []).includes(sid) || !bundle.species.some((s) => s.id === sid))
        return null;
    const sp = resolveSpecies(sid, grp || null, bundle);
    const lim = sp.month_mean_temp_c;
    const dtm = sp.days_to_maturity;
    const r031 = (bundle.rules ?? []).find((r) => r.id === "R-031")?.applies_to?.frost_tolerance;
    const tender = Array.isArray(r031) ? r031.map(String) : r031 != null ? [String(r031)] : [];
    if (sp.scheduling_model === "perennial" || sp.lifespan === "perennial" || !lim || typeof lim.min !== "number" || dtm == null
        || !tender.includes(String(sp.frost_tolerance)))
        return null;
    const tmax = twelve(site.tmax_mly_c), tmin = twelve(site.tmin_mly_c);
    if (!tmax || !tmin)
        return null;
    const floor = lim.min;
    const days = Array.isArray(dtm) ? Math.min(...dtm) : Number(dtm);
    const need = Math.max(1, Math.ceil(days / MONTH_LEN_DAYS$1));
    const ok = tmax.map((h, i) => (h + tmin[i]) / 2 >= floor);
    const months = Array.from({ length: 12 }, (_, s) => s + 1).filter((m) => Array.from({ length: need }, (_, k) => ok[(m - 1 + k) % 12]).every(Boolean));
    if (ok.every(Boolean) || !months.length)
        return null;
    const lasts = sowSpans(months, days, null, year, lat).filter((s) => !s.all).map((s) => s.close);
    return lasts.length ? { rule: String(rule.id), last: lasts.reduce((a, b) => (a > b ? a : b)), floor_c: floor, months } : null;
}
function rainsBeginFor(site, bundle) {
    const days = site?.growing_season_days_p50;
    if (!(bundle.rules ?? []).some((r) => r.id === "R-187") || typeof days !== "number" || days < 365)
        return null;
    const dry = new Set(waterMonthsFor(site, bundle).dry);
    if (!dry.size)
        return twelve(site?.prcp_mly_mm) ? { month: null } : null;
    if (dry.size === 12)
        return null;
    const runs = [];
    for (let m = 1; m <= 12; m++) {
        if (!dry.has(m) || dry.has(m === 1 ? 12 : m - 1))
            continue;
        let n = 0, e = m;
        while (dry.has(e) && n < 12) {
            n++;
            e = e === 12 ? 1 : e + 1;
        }
        runs.push([n, m, e]);
    }
    runs.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return { month: runs[0][2] };
}
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const fToC = (f) => (f - 32) * 5 / 9;
const twelve = (v) => Array.isArray(v) && v.length === 12 ? v : null;
function waterMonthsFor(site, bundle) {
    const out = { rain: [], hot: [], dry: [] };
    if (!site)
        return out;
    const trig = (id) => (bundle.rules ?? []).find((r) => r.id === id)?.trigger ?? {};
    const t174 = trig("R-174");
    const week = t174.week_need_mm, frac = t174.all_yours_below, prcp = twelve(site.prcp_mly_mm);
    if (prcp && typeof week === "number" && typeof frac === "number") {
        for (let m = 1; m <= 12; m++) {
            const need = week * MONTH_DAYS[m - 1] / 7;
            out.rain.push({ month: m, rain_mm: prcp[m - 1], need_mm: need, all_yours: prcp[m - 1] < frac * need });
        }
        out.dry = out.rain.filter((r) => r.all_yours).map((r) => r.month);
    }
    else if (!prcp && Array.isArray(site.rain_dry_months)) {
        out.dry = site.rain_dry_months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
    }
    const t175 = trig("R-175");
    const dayF = t175.day_above_f, nightF = t175.night_above_f;
    const tmax = twelve(site.tmax_mly_c), tmin = twelve(site.tmin_mly_c);
    if (tmax && tmin && typeof dayF === "number" && typeof nightF === "number") {
        const dayC = fToC(dayF), nightC = fToC(nightF);
        for (let m = 1; m <= 12; m++)
            if (tmax[m - 1] > dayC && tmin[m - 1] > nightC)
                out.hot.push(m);
    }
    return out;
}
function boltWarnings(speciesIds, lat, lon, bundle) {
    if (lat == null || lon == null)
        return [];
    const by = boltMonthsFor(scheduleSite(lat, lon, bundle), lat, speciesIds, bundle);
    return speciesIds.filter((sid) => by[sid]).map((sid) => ({ species: sid, months: by[sid] }));
}
function warmestNightC(site) {
    const lows = site?.tmin_mly_c;
    if (Array.isArray(lows) && lows.length === 12 && lows.every((v) => typeof v === "number"))
        return Math.max(...lows);
    return typeof site?.summer_night_tmin_c === "number" ? site.summer_night_tmin_c : null;
}
function heatWarnings(speciesIds, lat, lon, bundle) {
    if (lat == null || lon == null)
        return [];
    const cl = scheduleSite(lat, lon, bundle);
    const night = warmestNightC(cl);
    if (night === null)
        return [];
    const out = [];
    for (const sid of speciesIds) {
        const nightMax = nightMaxOf(resolveSpecies(sid, null, bundle));
        if (nightMax !== null && night > nightMax) {
            out.push({ species: sid, night_c: night, night_max_c: nightMax });
        }
    }
    return out;
}
const maxNum = (v) => {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    return typeof x === "number" && Number.isFinite(x) ? x : null;
};
const SPACING_FIELDS = ["mature_spread_cm", "mature_height_cm", "days_to_maturity"];
function spacingRows(speciesWithGroups, bundle) {
    const seen = new Set();
    const rows = [];
    for (const [sid, group] of speciesWithGroups) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const r = resolveSpecies(sid, group, bundle);
        const conf = (r.confidence ?? {});
        const flags = [];
        for (const status of ["estimated", "contested"]) {
            for (const field of conf[status] ?? []) {
                if (SPACING_FIELDS.includes(field))
                    flags.push(`${field} ${status}`);
            }
        }
        rows.push({
            species: sid,
            spread_cm: maxNum(r.mature_spread_cm),
            height_cm: maxNum(r.mature_height_cm),
            days_to_maturity: maxNum(r.days_to_maturity),
            flags,
        });
    }
    return rows;
}
function memberSpecies(guild) {
    return (guild.members ?? []).map((m) => [
        String(m.species),
        m.group ?? null,
    ]);
}
function mechanismRows(guild, bundle) {
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const rows = [];
    for (const m of (guild.mechanisms ?? [])) {
        const rid = m.rule ?? null;
        const rule = rid ? ruleById.get(rid) : undefined;
        rows.push({
            claim: String(m.claim ?? ""),
            grade: String(m.grade ?? "?"),
            rule: rid,
            rule_mechanism: rule ? (rule.mechanism ?? rule.claim ?? null) : null,
            rule_ruling: rule ? (rule.derived_ruling ?? null) : null,
        });
    }
    return { rows, honesty_note: (guild.honesty_note ?? null)?.trim() ?? null };
}
function guildMembers(guild, bundle) {
    const speciesIds = new Set(bundle.species.map((s) => s.id));
    const entityIds = new Set(bundle.entities.map((e) => e.id));
    const members = [];
    for (const m of (guild.members ?? [])) {
        members.push(resolveSpecies(m.species, m.group ?? null, bundle));
    }
    for (const role of (guild.roles ?? [])) {
        const canon = role.canonical;
        if (canon && (speciesIds.has(canon) || entityIds.has(canon))) {
            members.push(resolveSpecies(canon, role.canonical_group ?? null, bundle));
        }
    }
    return members;
}
function livingSupportLead(guild, bundle) {
    if (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle")
        return null;
    const members = guildMembers(guild, bundle);
    const provides = (m) => m.support?.provides;
    const requires = (m) => m.support?.requires;
    const support = members.find((m) => (provides(m) === "weak" || provides(m) === "strong") && m.entity_class === undefined);
    const climber = members.find((m) => requires(m) === "strong");
    if (!support || !climber)
        return null;
    const lead = (bundle.rules.find((r) => r.id === "R-033")?.trigger?.days) ?? null;
    return {
        rule: "R-033",
        lead_days: lead,
        support: support.id,
        climber: climber.id,
        why: `a vine that must climb shares a living support; sow it ~${lead} days ` +
            `after the support establishes, not with it`,
    };
}

function shiftMmdd(mmdd, days) {
    const doy = mmddDoy(mmdd);
    if (doy === null)
        return null;
    const shifted = doy + days;
    if (shifted < 1 || shifted > 365)
        return null;
    return fromDoy(shifted);
}
function springPlantedTeam(guild, bundle) {
    const want = bundle.rules.find((r) => r.id === "R-031")?.applies_to?.frost_tolerance;
    const tiers = [want ?? []].flat();
    return guildMembers(guild, bundle).some((m) => m.sow_season !== "fall"
        && (tiers.includes(m.frost_tolerance) || m.scheduling_model === "dtm" || m.scheduling_model === "gdd"));
}
const isTeamPlantJob = (kind) => kind === "plant_after_last_frost" || kind === "plant_cold_hardy";
function coldHardyLead(guild, bundle) {
    const offs = bundle.rules.find((r) => r.id === "R-096")
        ?.offset_days_before_last_frost;
    if (!offs)
        return null;
    const want = bundle.rules.find((r) => r.id === "R-031")?.applies_to?.frost_tolerance;
    const tiers = [want ?? []].flat();
    let lead = null;
    for (const m of guildMembers(guild, bundle)) {
        if (m.sow_season === "fall" || !(tiers.includes(m.frost_tolerance) || m.scheduling_model === "dtm" || m.scheduling_model === "gdd"))
            continue;
        if (tiers.includes(m.frost_tolerance))
            return null;
        const off = offs[String(m.frost_tolerance)];
        if (typeof off !== "number" || off <= 0)
            return null;
        lead = lead === null ? off : Math.min(lead, off);
    }
    return lead;
}
const isoAddDays = (iso, n) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
function gardenTasks(guild, lat, lon, seasonYear, bundle, held = null) {
    const site = held ?? scheduleSite(lat, lon, bundle);
    if (!site)
        return [];
    const out = [];
    const lf = (site.last_frost_32f ?? {}).p50 ?? null;
    const lf10 = (site.last_frost_32f ?? {}).p10 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    if (lf && springPlantedTeam(guild, bundle)) {
        const hardyLead = coldHardyLead(guild, bundle);
        const earlyDate = hardyLead ? isoAddDays(seasonDate(lf, seasonYear, lat), -hardyLead) : null;
        if (hardyLead && earlyDate) {
            out.push({ date: earlyDate, kind: "plant_cold_hardy", rule: "R-096", species: null, days_before_last_frost: hardyLead });
        }
        else {
            out.push({ date: seasonDate(lf, seasonYear, lat), kind: "plant_after_last_frost", rule: "R-031", species: null, frost_risk_until: lf10 });
        }
        const lead = livingSupportLead(guild, bundle);
        if (lead && lead.lead_days) {
            const sow = shiftMmdd(lf, lead.lead_days);
            if (sow) {
                out.push({ date: seasonDate(sow, seasonYear, lat), kind: "sow_climber", rule: lead.rule, species: lead.climber, support: lead.support, lead_days: lead.lead_days });
            }
        }
        outer: for (const role of guild.roles ?? []) {
            for (const key of ["canonical", "substitute"]) {
                const sid = role[key];
                if (typeof sid === "string"
                    && (bundle.entities ?? []).some((e) => e.id === sid && e.entity_class === "structure")) {
                    out.push({ date: seasonDate(lf, seasonYear, lat), kind: "install_support", rule: "R-040", species: sid });
                    break outer;
                }
            }
        }
    }
    if (ff)
        out.push({ date: fallDate(ff, seasonYear, lat), kind: "log_first_freeze", rule: site.provenance?.method === OWN_RECORD ? "R-093b" : "R-093", species: null });
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
    return out;
}

const listOf = (names) => {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
};
function warmMonthList(months) {
    const have = new Set(months);
    const start = [...have].sort((a, b) => a - b).find((m) => !have.has(m === 1 ? 12 : m - 1)) ?? Math.min(...have);
    const order = Array.from({ length: 12 }, (_, k) => ((start - 1 + k) % 12) + 1).filter((m) => have.has(m));
    return listOf(order.map((m) => monthLong(m - 1)));
}
const floorSay = (w) => w && (w.kind === "floor_none" || w.kind === "floor_few") ? w : null;
function floorLine(say, crops) {
    const n = crops.length === 1 ? "One" : "Many";
    const vars = { crops: listOf(crops), temp: fmtTemp(say.floor_c) };
    return say.kind === "floor_none"
        ? fillCopy(`clFloorNone${n}`, vars)
        : fillCopy(`clFloorFew${n}`, { ...vars, months: warmMonthList(say.months), n: say.need });
}
function floorLines(rows) {
    const groups = new Map();
    for (const r of rows) {
        const k = r.say.kind === "floor_none" ? `none|${r.say.floor_c}` : `few|${r.say.floor_c}|${r.say.need}|${r.say.months.join(",")}`;
        const g = groups.get(k) ?? { say: r.say, crops: [] };
        if (!g.crops.includes(r.label))
            g.crops.push(r.label);
        groups.set(k, g);
    }
    return [...groups.values()].map((g) => floorLine(g.say, g.crops));
}
const floorApprox = () => copy.clFloorApprox;
function warmLateLine(how, date, crops) {
    if (crops.length > 1)
        return fillCopy("clWarmLatePlantMany", { date, crops: listOf(crops) });
    const key = how === "start" ? "clWarmLateStart" : how === "plant" ? "clWarmLatePlant" : "clWarmLateSow";
    return fillCopy(key, { date, crop: crops[0] ?? "" });
}

function onWarmthPath(site, ownFrost = false) {
    return !!site && frostRare(site) && !ownFrost;
}
const oneRun = (r) => r.len === 1
    ? fillCopy("clWarmWhenOne", { month: monthLong(r.from - 1) })
    : fillCopy("clWarmWhenSpan", { from: monthLong(r.from - 1), to: monthLong(r.to - 1) });
function spanWords(s) {
    if (s.all)
        return null;
    const start = s.start, close = s.close, cm = Number(close.slice(5, 7));
    if (s.whole)
        return s.from === cm
            ? fillCopy("clWarmWhenOne", { month: monthLong(s.from - 1) })
            : fillCopy("clWarmWhenSpan", { from: monthLong(s.from - 1), to: monthLong(cm - 1) });
    if (s.from !== cm)
        return fillCopy("clWarmWhenSpanDay", { from: monthLong(s.from - 1), to: fmtMonthDayLong(close) });
    return start === close ? fillCopy("clWarmWhenDay", { date: fmtMonthDayLong(close) })
        : fillCopy("clWarmWhenDays", { from: fmtMonthDayLong(start), to: fmtMonthDayLong(close) });
}
const orWords = (parts) => {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "disjunction" }).format(parts);
    }
    catch {
        return parts.join(", ");
    }
};
function whenWords(months, by) {
    const runs = monthRuns(months);
    if (!runs.length || runs[0].len === 12)
        return null;
    const parts = by ? sowSpans(months, by.days, by.after ?? null, by.year ?? null, by.lat ?? null, by.before ?? null).map((s) => spanWords(s))
        : runs.map(oneRun);
    return orWords(parts);
}
function runWords(r, by) {
    if (r.len === 12)
        return null;
    if (!by)
        return oneRun(r);
    const months = Array.from({ length: r.len }, (_v, k) => ((r.from - 1 + k) % 12) + 1);
    return spanWords(sowSpans(months, by.days, by.after ?? null, by.year ?? null, by.lat ?? null, by.before ?? null)[0]);
}
function nextOpening(months, m) {
    const runs = monthRuns(months);
    if (!runs.length || runs[0].len === 12)
        return null;
    for (let k = 1; k <= 12; k++) {
        const c = ((m - 1 + k) % 12) + 1;
        if (runs.some((r) => r.from === c))
            return c;
    }
    return null;
}
const gateTenths = (pct) => Math.max(1, Math.round(pct / 10));
function firstFrostLine(site) {
    const first = givenFirstFrost(site);
    return first ? fillCopy("homeVoiceFrostFirstGiven", { date: fmtMonthDay(first) }) : null;
}
function seasonAllYearLine(site) {
    if (!site || !frostRare(site))
        return null;
    const first = firstFrostLine(site);
    if (first)
        return first;
    const gate = frostGate(site);
    if (frostWord(site) === "most")
        return gate ? fillCopy("plSeasonMostGate", { date: fmtMonthDay(gate.date) }) : copy.plSeasonMostNoDate;
    if (gate)
        return fillCopy("plSeasonAllYearGate", { date: fmtMonthDay(gate.date) });
    const fy = site.frost_years, years = site.years;
    if (typeof fy === "number" && fy > 0 && typeof years === "number")
        return fillCopy("plSeasonAllYearOdds", { n: fy, years });
    return copy.plSeasonAllYear;
}
function plateFrostLine(site) {
    const given = givenFrostGate(site);
    if (given)
        return fillCopy("homeVoiceFrostGiven", { date: fmtMonthDay(given) });
    const first = firstFrostLine(site);
    if (first)
        return first;
    const w = frostWord(site);
    if (!w)
        return null;
    const gate = frostGate(site ?? null);
    if (w === "most")
        return gate ? fillCopy("homeVoiceFrostMost", { date: fmtMonthDay(gate.date) }) : copy.homeVoiceFrostMostNoDate;
    if (w === "some")
        return gate ? fillCopy("homeVoiceFrostSome", { date: fmtMonthDay(gate.date) }) : copy.homeVoiceFrostSomeNoDate;
    return copy.homeVoiceFrostRare;
}

const NOT_HERE = new Set(["season_short", "zone_cold", "warm_short"]);
const MONTH_LEN_DAYS = 30.4;
function monthMeans(site) {
    const tmax = site?.tmax_mly_c, tmin = site?.tmin_mly_c;
    if (!Array.isArray(tmax) || !Array.isArray(tmin) || tmax.length !== 12 || tmin.length !== 12 || site?.temps === "months_only")
        return null;
    return tmax.map((h, i) => (h + tmin[i]) / 2);
}
function longestRun(ok) {
    if (ok.every(Boolean))
        return 12;
    let best = 0, cur = 0;
    for (const v of [...ok, ...ok]) {
        cur = v ? cur + 1 : 0;
        best = Math.max(best, cur);
    }
    return Math.min(best, 11);
}
const firstNum = (v) => (Array.isArray(v) ? (typeof v[0] === "number" ? v[0] : null) : typeof v === "number" ? v : null);
const named = (r) => {
    const s = r.applies_to?.species;
    return Array.isArray(s) ? s.map(String) : typeof s === "string" ? [s] : [];
};
function fastestDays(sp) {
    const vals = [sp.days_to_maturity, ...(sp.cultivar_groups ?? []).map((g) => g.days_to_maturity)];
    const got = vals.map(firstNum).filter((x) => x !== null);
    return got.length ? Math.min(...got) : null;
}
const perennialRec = (r) => r.scheduling_model === "perennial" || r.lifespan === "perennial";
function seasonalForms(sid, sp, bundle) {
    return (sp.cultivar_groups ?? [])
        .map((g) => resolveSpecies(sid, g.id ?? null, bundle))
        .filter((res) => !perennialRec(res));
}
function summerGreens(site, lat, zone, bundle) {
    const rule = [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : 1))
        .find((r) => r.trigger?.kind === "bolt_month_greens");
    if (!rule)
        return null;
    const duringId = rule.trigger?.during;
    const during = bundle.rules.find((r) => r.id === duringId);
    if (!during)
        return null;
    const bolt = boltMonthsFor(site, lat, [...named(during)].sort(), bundle);
    const months = [...new Set(Object.values(bolt).flat())].sort((a, b) => a - b);
    const ids = new Set(bundle.species.map((s) => s.id));
    const listed = named(rule).filter((sid) => ids.has(sid));
    const verdict = new Map(growsHere(site, lat, zone, bundle, listed).map((r) => [r.species, r.verdict]));
    const greens = listed.filter((sid) => verdict.get(sid) !== "not");
    return months.length && greens.length ? { rule: rule.id, months, species: greens } : null;
}
function summerGreensAt(lat, lon, bundle, country) {
    const site = scheduleClimate(lat, lon, bundle, country)?.site ?? null;
    const z = resolveZone(lat, lon, bundle, country)?.zone;
    return summerGreens(site, lat, typeof z === "number" ? z : null, bundle);
}
function daylengthType(lat, bundle) {
    const trig = (bundle.rules.find((r) => r.id === "R-081")?.trigger ?? {});
    const shortUntil = trig.short_day_until_lat, longFrom = trig.long_day_from_lat;
    if (lat == null || typeof shortUntil !== "number" || typeof longFrom !== "number")
        return null;
    const a = Math.abs(lat);
    return { rule: "R-081", kind: "daylength", type: a >= shortUntil ? "long_day" : a <= longFrom ? "short_day" : "either" };
}
function growsHere(site, lat, zone, bundle, speciesIds) {
    const ids = [...(speciesIds ?? bundle.species.map((s) => s.id))].sort();
    const seasonDays = typeof site?.growing_season_days_p50 === "number" ? site.growing_season_days_p50 : null;
    const noRecord = seasonDays === null && !site?.provenance;
    const night = warmestNightC(site);
    const bolt = boltMonthsFor(site, lat, ids, bundle);
    const hot = hotHarvestMonthsFor(site, ids, bundle);
    const mean = monthMeans(site);
    const held = mean === null && site?.temps === "months_only";
    const frostRare = seasonDays !== null && seasonDays >= 365;
    const warm = frostRare && mean ? warmthWindowsFor(site, lat, ids, bundle) : {};
    const slowRules = [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : 1))
        .filter((r) => r.trigger?.kind === "slow_growth_months");
    const floorRule = warmthFloorRule(bundle);
    const r031 = bundle.rules.find((r) => r.id === "R-031")?.applies_to?.frost_tolerance;
    const tender = Array.isArray(r031) ? r031.map(String) : r031 != null ? [String(r031)] : [];
    const hotRule = (sid) => [...bundle.rules].sort((a, b) => (a.id < b.id ? -1 : 1))
        .find((r) => r.trigger?.kind === "hot_month_harvest" && named(r).includes(sid))?.id ?? null;
    const nightRule = (sid) => bundle.rules.find((r) => r.trigger?.kind === "night_temp_exceeds" && named(r).includes(sid))?.id ?? null;
    const seasonReason = (key, frostFree, fastest) => {
        const [rule, days] = cropSeasonDays(site, key, bundle, frostFree);
        if (fastest === null || days === null || fastest <= days)
            return null;
        if (rule === "R-032")
            return { rule: "R-032", kind: "season_short", days: Math.trunc(fastest), frost_free_days: Math.trunc(frostFree) };
        if (rule === "R-188")
            return { rule: "R-188", kind: "hardy_short", days: Math.trunc(fastest), season_days: Math.trunc(days) };
        return null;
    };
    const out = [];
    for (const sid of ids) {
        const sp = bundle.species.find((s) => s.id === sid);
        if (!sp || sp.status === "BLACKLISTED")
            continue;
        const r = resolveSpecies(sid, null, bundle);
        const reasons = [];
        const perennial = perennialRec(r);
        const seasonal = perennial ? seasonalForms(sid, sp, bundle) : [];
        const hz = r.hardiness_zone;
        if (perennial && Array.isArray(hz) && hz.length) {
            const side = zoneSide(hz, zone);
            const lo = hz[0], hi = hz[hz.length - 1];
            if (side === "below" || side === "above")
                reasons.push({ rule: "R-076", kind: side === "below" ? "zone_cold" : "zone_warm", zone: zone, lo, hi });
            else if (side === null)
                reasons.push({ rule: "R-076", kind: "zone_unknown", lo, hi });
        }
        if (!perennial && seasonDays !== null) {
            const sr = seasonReason(sid, seasonDays, fastestDays(sp));
            if (sr)
                reasons.push(sr);
        }
        else if (seasonal.length && seasonDays !== null) {
            let best = null;
            for (const f of seasonal) {
                const d = firstNum(f.days_to_maturity);
                if (d !== null && (!best || d < best.days))
                    best = { days: d, form: f };
            }
            const sr = best ? seasonReason(`${sid}/${String(best.form.cultivar_group)}`, seasonDays, best.days) : null;
            if (sr)
                reasons.push(sr);
        }
        else if (noRecord && (!perennial || seasonal.length)) {
            reasons.push({ rule: "R-032", kind: "season_unknown" });
        }
        if (bolt[sid])
            reasons.push({ rule: "R-172", kind: "bolt", months: bolt[sid] });
        if (hot[sid])
            reasons.push({ rule: hotRule(sid), kind: "hot_harvest", months: hot[sid] });
        const nr = nightRule(sid), limit = r.night_temp_max_c;
        if (nr && typeof limit === "number" && night !== null && night > limit)
            reasons.push({ rule: nr, kind: "night_heat", night_c: night, limit_c: limit });
        if (r.photoperiod) {
            const dl = daylengthType(lat, bundle);
            if (dl)
                reasons.push(dl);
        }
        const lim = r.month_mean_temp_c, dtm = r.days_to_maturity, w = warm[sid];
        if (!perennial && mean && frostRare && lim && typeof lim.min === "number" && dtm != null && w) {
            if (w.months.length) {
                if (w.care)
                    reasons.push({ rule: "R-183", kind: "warm_care", months: sowMonths(w.months, fewestDays(dtm), w.after, w.before ?? null) });
            }
            else {
                const n = Math.max(1, Math.ceil((Array.isArray(dtm) ? Math.min(...dtm) : Number(dtm)) / MONTH_LEN_DAYS));
                reasons.push({ rule: "R-183", kind: longestRun(mean.map((m) => m >= lim.min)) < n ? "warm_short" : "warm_none" });
            }
        }
        else if (!perennial && held && frostRare && lim && typeof lim.min === "number" && dtm != null) {
            reasons.push({ rule: "R-183", kind: "warm_held" });
        }
        const floor = !perennial && floorRule ? warmthFloorFor(site, sid, bundle, floorRule) : null;
        if (floor)
            reasons.push(floor);
        const range = r.month_mean_temp_c;
        if (!perennial && held && seasonDays !== null && tender.includes(String(r.frost_tolerance)) && typeof range?.min !== "number") {
            const pathRule = frostRare ? "R-183" : floorRule?.id;
            if (pathRule)
                reasons.push({ rule: String(pathRule), kind: "warm_held" });
        }
        for (const rule of slowRules) {
            const field = rule.trigger?.field;
            const below = field ? r[field] : undefined;
            if (mean && named(rule).includes(sid) && typeof below === "number") {
                const cool = mean.map((m, i) => (m < below ? i + 1 : 0)).filter(Boolean);
                if (cool.length)
                    reasons.push({ rule: rule.id, kind: "slow_months", months: cool, below_c: below });
            }
            else if (held && named(rule).includes(sid) && typeof below === "number") {
                reasons.push({ rule: rule.id, kind: "slow_held" });
            }
        }
        const kinds = new Set(reasons.map((x) => x.kind));
        const gone = seasonal.length ? kinds.has("zone_cold") && kinds.has("season_short") : reasons.some((x) => NOT_HERE.has(x.kind));
        const verdict = gone ? "not" : reasons.length ? "care" : "fits";
        out.push({ species: sid, verdict, reasons });
    }
    return out;
}
function growsHereAt(lat, lon, bundle, country) {
    const site = scheduleClimate(lat, lon, bundle, country)?.site ?? null;
    const z = resolveZone(lat, lon, bundle, country)?.zone;
    return growsHere(site, lat, typeof z === "number" ? z : null, bundle);
}

const $$1 = (id) => document.getElementById(id);
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
function emptyState(reason, action, href) {
    const box = document.createElement("div");
    box.className = "empty";
    const p = document.createElement("p");
    p.textContent = reason;
    const a = document.createElement("a");
    a.className = "btn btn-secondary";
    a.href = href;
    a.textContent = action;
    box.append(p, a);
    return box;
}
function el$1(a, b, c, d) {
    const [parent, tag, cls, text] = typeof a === "string" ? [null, a, b, c ?? undefined] : [a, b, c, d];
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    if (parent)
        parent.appendChild(e);
    return e;
}
function num(id) {
    const v = parseFloat($$1(id).value);
    return Number.isFinite(v) ? v : null;
}
function lenM(id) {
    const v = num(id);
    return v == null ? null : lenToM(v);
}
const LEN_INPUT_IDS = ["shapew", "shapel", "shaped", "dimw", "diml", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"];
const SVG_NS$1 = "http://www.w3.org/2000/svg";
function familiesOf(bundle) {
    return [...new Set(bundle.species.map((s) => s.family).filter(Boolean))].sort();
}
let discloseSeq = 0;
function disclose(label, text, cls = "twhy") {
    const wrap = document.createElement("span");
    wrap.className = `${cls}-wrap`;
    const id = `${cls}-${++discloseSeq}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.textContent = label;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    const note = document.createElement("span");
    note.className = `${cls}-g`;
    note.id = id;
    note.setAttribute("role", "note");
    note.hidden = true;
    let loaded = false;
    btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
        if (!open && !loaded) {
            loaded = true;
            void Promise.resolve(text()).then((s) => { note.textContent = s; });
        }
    });
    wrap.append(btn, note);
    return wrap;
}

function plantingOnBed(plantingRegion, bedRegion) {
    const a = area(plantingRegion);
    return a > 0 && intersectArea(plantingRegion, bedRegion) >= 0.5 * a;
}
function sectionParentName(name, bedNames) {
    const m = name.match(/^(.*) (\d+)$/);
    if (!m)
        return null;
    for (const n of bedNames)
        if (n === m[1])
            return m[1];
    return null;
}
function sectionParentOf(bed, beds) {
    const parentName = sectionParentName(bed.name, beds.map((b) => b.name));
    if (parentName === null)
        return null;
    const parent = beds.find((b) => b.name === parentName);
    if (!parent)
        return null;
    const a = area(bed.region);
    return a > 0 && intersectArea(bed.region, parent.region) >= 0.5 * a ? parentName : null;
}
function bedHasSections(name, beds) {
    return beds.some((b) => sectionParentOf(b, beds) === name);
}
const inGround = (pl) => !!(pl.sown || pl.transplanted) || pl.carried_over === true;
function bedSeasonStatus(bedRegion, season) {
    if (!season)
        return { growing: 0, planned: 0, ended: 0, carried: 0, closed: false, label: copy.ocNoSeason };
    const on = (season.plantings ?? []).filter((pl) => plantingOnBed(pl.region, bedRegion));
    const carried = on.filter((pl) => pl.carried_over === true).length;
    const ended = on.filter((pl) => !!pl.end_cause).length;
    const planned = on.filter((pl) => !pl.end_cause && !inGround(pl)).length;
    const growing = on.length - carried - ended - planned;
    const closed = !!season.closed_date;
    let label;
    if (closed) {
        label = carried ? fillCopy("ocDormantCarried", { n: carried }) : copy.ocDormant;
    }
    else if (!on.length) {
        label = copy.ocReady;
    }
    else {
        const parts = [];
        if (growing)
            parts.push(fillCopy("ocGrowing", { n: growing }));
        if (planned)
            parts.push(fillCopy("ocPlanned", { n: planned }));
        if (carried)
            parts.push(fillCopy("ocOverwintering", { n: carried }));
        if (ended)
            parts.push(fillCopy("ocEnded", { n: ended }));
        label = parts.length ? parts.join(" · ") : copy.ocDone;
    }
    return { growing, planned, ended, carried, closed, label };
}
function declaredPriorYear() {
    return (seasonId() ?? new Date().getFullYear()) - 1;
}
function mergePriorOccupancy(derived, seeds, candidate) {
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
        for (const fam of seed.families)
            contributions.push({ season: key, species: "", family: fam, overlap_m2: overlap });
    }
    return { history, contributions, unknown_species: derived.unknown_species, verticillium_reservoir: derived.verticillium_reservoir,
        allelopathic_residue: derived.allelopathic_residue, last_season_species: derived.last_season_species };
}

function svgNumber(x) { return Math.round(x * 100) / 100; }
function zoneColorMap(zones, colourOf = gardenColours()) {
    const m = new Map();
    for (const z of zones)
        if (!m.has(z.species))
            m.set(z.species, colourOf(z.species));
    return m;
}
function shelteredChosen(chosen, bundle, isShelter) {
    const out = new Set();
    if (!isShelter)
        return out;
    const shelters = shelterPredicate(bundle);
    for (const c of chosen) {
        if (shelteredByShadow(resolveSpecies(c.sid, c.group, bundle), shelters))
            out.add(c.sid);
    }
    return out;
}
function planBedRegion(bed) {
    if (bed) {
        const o = bedOrientation(bed);
        if (o)
            return { shape: "rect", x: 0, y: 0, w: o.orient.eff_w, h: o.orient.eff_l };
        return bed.region;
    }
    const w = lenM("shapew"), l = lenM("shapel");
    return w != null && l != null && w > 0 && l > 0 ? { shape: "rect", x: 0, y: 0, w, h: l } : null;
}
function bedTeamStatus(guild, bed, bundle) {
    const reg = planBedRegion(bed);
    const pts = reg ? regionPoints(reg) : null;
    const bw = pts ? Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) : null;
    const bl = pts ? Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) : null;
    return guildStatus(guild, bw, bl, bundle, bed.structure, reg);
}
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
function carriedOccupancy(bed) {
    if (!bed)
        return [];
    const openSeason$1 = openSeason();
    const o = bedOrientation(bed);
    const out = [];
    for (const pp of (openSeason$1?.plantings ?? [])) {
        if (pp.carried_over !== true || pp.end_cause)
            continue;
        let r;
        try {
            r = parseRegion(pp.region);
        }
        catch {
            continue;
        }
        if (intersectArea(r, bed.region) <= 0)
            continue;
        if (!o) {
            out.push(r);
            continue;
        }
        const pts = regionPoints(r).map(([px, py]) => plotToOriented(px, py, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy));
        out.push({ shape: "polygon", points: pts });
    }
    return out;
}
function roleOverridesOf(entry) {
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
function layoutKeys(chosen) {
    const groupsOf = new Map();
    for (const c of chosen) {
        if (!groupsOf.has(c.sid))
            groupsOf.set(c.sid, new Set());
        groupsOf.get(c.sid).add(c.group ?? "");
    }
    return chosen.map((c) => ((groupsOf.get(c.sid)?.size ?? 0) > 1 ? `${c.sid}@${c.group ?? ""}` : c.sid));
}
function layoutRows(chosen, bundle, keep = (r) => r.height_cm !== null || r.spread_cm !== null) {
    const keys = layoutKeys(chosen);
    const seen = new Set();
    const out = [];
    chosen.forEach((c, i) => {
        if (seen.has(keys[i]))
            return;
        seen.add(keys[i]);
        const [row] = spacingRows([[c.sid, c.group]], bundle);
        if (row && keep(row))
            out.push({ ...row, key: keys[i], group: c.group });
    });
    return out;
}
function unkeyZones(zones, rows) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const z of zones) {
        const r = byKey.get(z.species);
        if (r) {
            z.species = r.species;
            z.group = r.group;
        }
    }
}
function centrePair(resolved) {
    const poll = resolved?.pollination;
    return resolved?.habit === "vine" && poll?.dioecious === true;
}
function roleLineCount(guild, roleId, resolved, fill) {
    if (resolved.entity_class === "structure")
        return null;
    const ring = guild.ground_entity === "radial_rings";
    return ring && roleId === "canopy" && centrePair(resolved) ? Math.max(2, fill) : fill;
}
function computeGuildPlacement(guild, bed, site, bundle, overrides) {
    if (site.lat == null)
        return null;
    const r003 = bundle.rules.find((x) => x.id === "R-003");
    const RING_ORDER = ["canopy", "bulb_ring", "mulch_producer", "fixer", "insectary"];
    const MOUND_ROLES = new Set(["support", "fixer"]);
    const MOUND_CAP = { support: 4, fixer: 3 };
    const isRadial = guild.ground_entity === "radial_rings";
    const isHills = laysOutAsHills(guild);
    const isShelter = guild.layout === "shelter";
    const isGrid = !isRadial && !isHills && !isShelter
        && (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle"
            || guild.guild_class === "polyculture" || guild.guild_class === "restorative");
    const isRest = guild.guild_class === "restorative";
    const chosen = guildChosenSpecies(guild, site, bundle, overrides);
    const shelteredSet = shelteredChosen(chosen, bundle, isShelter);
    const region = planBedRegion(bed);
    const keys = layoutKeys(chosen);
    const plantRows = layoutRows(chosen, bundle);
    if (!region || plantRows.length < (isRest ? 1 : 2))
        return null;
    const treeR = isRadial ? (radialRingsFromFootprint(guild.footprint_min_m2 ?? 0)?.r ?? 0) : 0;
    const counts = scaledFillCounts(chosen.map((c) => ({ resolved: resolveSpecies(c.sid, c.group, bundle), density: c.density })), plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false), chosen.length);
    const countByKey = new Map();
    const ringByKey = new Map();
    const moundByKey = new Map();
    const moundCapByKey = new Map();
    chosen.forEach((c, i) => {
        const k = keys[i];
        countByKey.set(k, counts[i]);
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
    const occupied = carriedOccupancy(bed);
    const pl = place(plantRows.map((r) => ({ id: r.key, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countByKey.get(r.key) ?? 1, ring: ringByKey.get(r.key), mound: moundByKey.get(r.key), mound_cap: moundCapByKey.get(r.key), sheltered: shelteredSet.has(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
    unkeyZones(pl.zones, plantRows);
    return { pl, plantRows, region, isRest };
}
function guildPlacementGlimpse(guild, bed, site, bundle, overrides) {
    const computed = computeGuildPlacement(guild, bed, site, bundle, overrides);
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
    const { pl } = computed;
    const o = bedOrientation(bed);
    for (const z of pl.zones) {
        for (const cell of z.plants ?? []) {
            const [x, y] = o
                ? orientedToPlot(cell.x, cell.y, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy)
                : [cell.x, cell.y];
            out.push({ x, y, r: cell.r, species: z.species, group: z.group ?? null });
        }
    }
    return out;
}
function guildPlantings(guild, bed, site, bundle, overrides) {
    const placed = placeGuildPlants(guild, bed, site, bundle, overrides);
    if (placed.length) {
        return placed.map((p) => {
            const half = Math.max(0.05, Math.min(p.r, 0.15));
            const region = { shape: "rect", x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 };
            return { species: p.species, ...(p.group ? { cultivar_group: p.group } : {}), region };
        });
    }
    return guildChosenSpecies(guild, site, bundle, overrides).map((c) => ({ species: c.sid, ...(c.group ? { cultivar_group: c.group } : {}), region: bed.region }));
}
function appliedPlanDots(bundle, site) {
    const season = openSeason();
    const entries = (Array.isArray(season?.plan) ? season.plan : []);
    const out = [];
    if (!entries.length)
        return out;
    for (const e of entries) {
        const bed = app.logSnapshot.beds.find((b) => b.name === e.area);
        if (!bed)
            continue;
        if ((season?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region)))
            continue;
        if (e.mybed === true && Array.isArray(e.plantings)) {
            for (const pl of e.plantings) {
                const cs = regionPoints(pl.region);
                if (!cs.length)
                    continue;
                out.push({ x: cs.reduce((a, p) => a + p[0], 0) / cs.length, y: cs.reduce((a, p) => a + p[1], 0) / cs.length, species: pl.species });
            }
            continue;
        }
        const guild = bundle.guilds.find((g) => g.id === e.guild);
        if (!guild || site.lat == null)
            continue;
        for (const p of placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(e)))
            out.push({ x: p.x, y: p.y, species: p.species });
    }
    return out;
}
function draftPlantings(bundle, site, season, beds) {
    const s = season !== undefined ? season : openSeason();
    const bedList = beds ?? app.logSnapshot.beds;
    const entries = (Array.isArray(s?.plan) ? s.plan : []);
    const out = [];
    if (!entries.length)
        return out;
    for (const e of entries) {
        const bed = bedList.find((b) => b.name === e.area);
        if (!bed)
            continue;
        if ((s?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region)))
            continue;
        if (e.mybed === true && Array.isArray(e.plantings)) {
            for (const pl of e.plantings) {
                if (pl && typeof pl.species === "string" && pl.region) {
                    out.push({ species: pl.species, ...(pl.cultivar_group ? { cultivar_group: pl.cultivar_group } : {}), region: pl.region });
                }
            }
            continue;
        }
        const guild = bundle.guilds.find((g) => g.id === e.guild);
        if (!guild || site.lat == null)
            continue;
        for (const p of guildPlantings(guild, bed, site, bundle, roleOverridesOf(e)))
            out.push(p);
    }
    return out;
}
function guildPlantCount(resolved) {
    const poll = resolved.pollination;
    if (poll?.block_min_plants)
        return poll.block_min_plants;
    if (poll?.dioecious)
        return 2;
    if (poll?.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
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
const FILL_DOT_BUDGET = 700;
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
function scaledFillCounts(items, bedArea, nSpecies) {
    const raw = items.map((it) => rawFillCount(it.resolved, bedArea, nSpecies, it.density));
    const total = raw.reduce((s, n) => s + n, 0);
    if (total <= FILL_DOT_BUDGET)
        return raw;
    const k = FILL_DOT_BUDGET / total;
    return raw.map((n) => Math.max(1, Math.round(n * k)));
}
function filledMembers(members, plantable, bundle) {
    if (plantable <= 0 || !members.length)
        return members.map((m) => ({ ...m }));
    const isStructure = (m) => resolveSpecies(m.species, m.group ?? null, bundle).entity_class === "structure";
    const plants = members.filter((m) => !isStructure(m));
    const counts = scaledFillCounts(plants.map((m) => ({ resolved: resolveSpecies(m.species, m.group ?? null, bundle) })), plantable, plants.length);
    let i = 0;
    return members.map((m) => isStructure(m)
        ? { ...m }
        : { ...m, count: Math.max(counts[i++], m.count ?? 1) });
}
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
                return { ...m, count: m.count ?? 1 };
            const spacing = Math.sqrt(plantSpacingM2(resolveSpecies(m.species, m.group ?? null, bundle)));
            const cap = Math.max(1, Math.floor((2 * Math.PI * rr) / Math.max(spacing, 0.05)));
            return { ...m, count: Math.min(m.count ?? 1, cap) };
        });
        return out.some((m, i) => m.count !== (members[i].count ?? 1)) ? out : null;
    }
    return null;
}
function plantableArea(region, structure, laneFlip = false) {
    const lanes = accessBands(structure, region, laneFlip);
    const laneArea = lanes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    return Math.max(0.1, area(region) - laneArea);
}
function bedStructure(bed, guild) {
    return bed?.structure ?? guild?.default_structure ?? "in_ground";
}
function roleDensity(guild, roleId) {
    const d = (guild.roles ?? []).find((r) => r.id === roleId)?.planting_density_m2;
    return typeof d === "number" ? d : undefined;
}
let placementSvgSeq = 0;
function placementSvg(zones, bundle, mounds = [], bedOutline = [], ringsGuide = [], accessBands = [], spreadR = new Map()) {
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
    const drawR = (r, fill = 0.94) => Math.min(Math.max(r * sc * fill, 2.4), 20);
    const zoneFill = (z) => (mounds.length && z.mound !== false) ? 0.82 : 0.94;
    const haloR = (z, r) => {
        if (!mounds.length || z.mound !== false)
            return 0;
        const spread = spreadR.get(z.species);
        if (!spread)
            return 0;
        const full = spread * sc;
        return full > drawR(r, zoneFill(z)) + 2 ? full : 0;
    };
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
            bump(rawX(pc.x), rawY(pc.y), drawR(pc.r));
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
    const svg = document.createElementNS(SVG_NS$1, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(maxX - minX) + 2 * M));
    svg.setAttribute("height", String(Math.ceil(maxY - minY) + 2 * M));
    const colours = zoneColorMap(zones);
    let guideClip = null;
    if (bedOutline.length >= 3) {
        const bed = document.createElementNS(SVG_NS$1, "polygon");
        const ptsAttr = bedOutline.map((q) => `${px(q[0])},${py(q[1])}`).join(" ");
        bed.setAttribute("points", ptsAttr);
        bed.setAttribute("class", "bed");
        svg.appendChild(bed);
        guideClip = `fitclip-${++placementSvgSeq}`;
        const defs = document.createElementNS(SVG_NS$1, "defs");
        const clip = document.createElementNS(SVG_NS$1, "clipPath");
        clip.setAttribute("id", guideClip);
        const cpoly = document.createElementNS(SVG_NS$1, "polygon");
        cpoly.setAttribute("points", ptsAttr);
        clip.appendChild(cpoly);
        defs.appendChild(clip);
        svg.appendChild(defs);
    }
    for (const b of accessBands) {
        const bx0 = M + rawX(b.x0) - minX, bx1 = M + rawX(b.x1) - minX;
        const byTop = M + rawY(b.y1) - minY, byBot = M + rawY(b.y0) - minY;
        const rect = document.createElementNS(SVG_NS$1, "rect");
        rect.setAttribute("x", String(svgNumber(Math.min(bx0, bx1))));
        rect.setAttribute("y", String(svgNumber(Math.min(byTop, byBot))));
        rect.setAttribute("width", String(svgNumber(Math.abs(bx1 - bx0))));
        rect.setAttribute("height", String(svgNumber(Math.abs(byBot - byTop))));
        rect.setAttribute("class", "placelane");
        svg.appendChild(rect);
    }
    for (const g of ringsGuide) {
        const circ = document.createElementNS(SVG_NS$1, "circle");
        circ.setAttribute("cx", String(px(g.cx)));
        circ.setAttribute("cy", String(py(g.cy)));
        circ.setAttribute("r", String(svgNumber(g.r * sc)));
        circ.setAttribute("fill", "none");
        circ.setAttribute("stroke", "#8886");
        if (guideClip)
            circ.setAttribute("clip-path", `url(#${guideClip})`);
        svg.appendChild(circ);
    }
    zones.forEach((z) => {
        const col = colours.get(z.species);
        for (const pc of z.plants) {
            const hr = haloR(z, pc.r);
            if (!hr)
                continue;
            const h = document.createElementNS(SVG_NS$1, "circle");
            h.setAttribute("cx", String(px(pc.x)));
            h.setAttribute("cy", String(py(pc.y)));
            h.setAttribute("r", String(svgNumber(hr)));
            h.setAttribute("fill", "none");
            h.style.stroke = col;
            h.setAttribute("stroke-opacity", "0.42");
            h.setAttribute("stroke-dasharray", "3 3");
            h.setAttribute("class", "sprawl");
            if (guideClip)
                h.setAttribute("clip-path", `url(#${guideClip})`);
            svg.appendChild(h);
        }
    });
    for (const m of mounds) {
        const circ = document.createElementNS(SVG_NS$1, "circle");
        circ.setAttribute("cx", String(px(m.cx)));
        circ.setAttribute("cy", String(py(m.cy)));
        circ.setAttribute("r", String(svgNumber(m.r * sc)));
        circ.setAttribute("fill", "#a1662f22");
        circ.setAttribute("stroke", "#a1662f66");
        svg.appendChild(circ);
    }
    zones.forEach((z) => {
        if (z.ring) {
            if (z.ring.r > 0) {
                const circ = document.createElementNS(SVG_NS$1, "circle");
                circ.setAttribute("cx", String(px(z.ring.cx)));
                circ.setAttribute("cy", String(py(z.ring.cy)));
                circ.setAttribute("r", String(svgNumber(z.ring.r * sc)));
                circ.setAttribute("fill", "none");
                circ.style.stroke = tint(colours.get(z.species), 40);
                svg.appendChild(circ);
            }
            return;
        }
        const poly = document.createElementNS(SVG_NS$1, "polygon");
        poly.setAttribute("points", z.polygon.map((q) => `${px(q[0])},${py(q[1])}`).join(" "));
        poly.style.fill = tint(colours.get(z.species), 8);
        poly.setAttribute("stroke", "#8884");
        svg.appendChild(poly);
    });
    zones.forEach((z) => {
        const col = colours.get(z.species);
        const onMound = mounds.length > 0 && z.mound !== false;
        for (const pc of z.plants) {
            const c = document.createElementNS(SVG_NS$1, "circle");
            c.setAttribute("cx", String(px(pc.x)));
            c.setAttribute("cy", String(py(pc.y)));
            c.setAttribute("r", String(svgNumber(drawR(pc.r, zoneFill(z)))));
            c.style.fill = col;
            c.setAttribute("fill-opacity", "0.55");
            c.style.stroke = onMound ? "var(--surface)" : col;
            c.setAttribute("data-species", z.species);
            if (onMound)
                c.setAttribute("stroke-width", "1.25");
            const t = document.createElementNS(SVG_NS$1, "title");
            t.textContent = fillCopy("gmZoneOneOf", { name: commonName(bundle, z.species), n: z.count });
            c.appendChild(t);
            svg.appendChild(c);
        }
    });
    return svg;
}
const CATEGORY_LABEL = {
    fruiting_vegetable: copy.gmCatFruitingVeg,
    herb: copy.gmCatHerbs,
    fruit: copy.gmCatFruit,
    salad_green: copy.gmCatSalad,
    root: copy.gmCatRoots,
    bean_or_pea: copy.gmCatBeans,
    cover_crop: copy.gmCatCover,
    allium: copy.gmCatAllium,
    flower: copy.gmCatFlowers,
    perennial_vegetable: copy.gmCatPerennialVeg,
};
const categoryLabel = (slug) => CATEGORY_LABEL[slug] ?? (slug ? titleCase(humanize(slug)) : copy.gmCatOther);
function historySource(bundle) {
    const priorSeasons$1 = priorSeasons();
    const bedName = ($$1("candbed")).value;
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return { history: null, source: { kind: "none" } };
    const derived = deriveHistory(bed.region, priorSeasons$1, activeBundle(bundle));
    const tracked = derived.contributions.length > 0;
    const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, bed.region);
    const history = Object.keys(merged.history).length ? merged.history : null;
    return { history, source: { kind: "derived", bed: bed.name, derived: merged, tracked, declaredYear: declaredPriorYear() } };
}
function currentBedRegion() {
    const bedName = $$1("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return planBedRegion(bed);
}
function currentBedSun() {
    const bedName = $$1("candbed")?.value ?? "";
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    return bed?.sun === "full" || bed?.sun === "part_shade" ? bed.sun : null;
}

const FROST_SEVERITY = { light: "lgFrostSevLight", hard: "lgFrostSevHard" };
const FROST_SEVERITY_WORD = { light: "lgFrostSevLightWord", hard: "lgFrostSevHardWord" };
const END_CAUSE = {
    frost: "clOptFrost", disease: "lgEndCauseDisease", pest: "lgEndCausePest",
    pulled: "lgEndCausePulled", drought: "lgEndCauseDrought", unknown: "lgEndCauseUnknown",
};
const FAILURE_SEVERITY = { light: "lgFailSevLight", moderate: "lgFailSevModerate", severe: "lgFailSevSevere" };
const word = (map, v) => (Object.prototype.hasOwnProperty.call(map, v) ? copy[map[v]] : v);
const frostSeverityLabel = (v) => word(FROST_SEVERITY, v);
const frostSeverityWord = (v) => word(FROST_SEVERITY_WORD, v);
const endCauseLabel = (v) => word(END_CAUSE, v);
const failureSeverityLabel = (v) => word(FAILURE_SEVERITY, v);
const failureSeverityWord = (v) => {
    const w = failureSeverityLabel(v);
    return w === v ? v : w.charAt(0).toLocaleLowerCase() + w.slice(1);
};
const END_WORD = {
    frost: "rvBeatEndFrost", disease: "rvBeatEndDisease", pest: "rvBeatEndPest",
    pulled: "rvBeatEndPulled", drought: "rvBeatEndDrought", unknown: "rvBeatEndUnknown",
};
function endCausePhrase(cause) {
    if (!cause)
        return copy.clEndRemoved;
    return copy[END_WORD[cause] ?? "rvBeatEndUnknown"];
}

const gardenClosed = (p) => !!p.closed_date;
function openGardens(items) {
    return items.filter((p) => !p.closed_date);
}
const collators = new Map();
function collator(lang) {
    let c = collators.get(lang);
    if (!c) {
        c = new Intl.Collator(lang, { sensitivity: "base", numeric: true });
        collators.set(lang, c);
    }
    return c;
}
function orderGardens(items, key, defaultId, lang = appLang()) {
    const coll = collator(lang);
    const group = (k) => (k.id === defaultId ? 0 : k.example ? 3 : k.shared ? 2 : 1);
    return items
        .map((item) => ({ item, k: key(item) }))
        .sort((a, b) => group(a.k) - group(b.k)
        || coll.compare(a.k.name ?? a.k.id, b.k.name ?? b.k.id)
        || (a.k.id < b.k.id ? -1 : a.k.id > b.k.id ? 1 : 0))
        .map((x) => x.item);
}

let el = null;
let timer = 0;
function toast(text, ms, action, opts) {
    if (!el || !document.body.contains(el)) {
        el = document.createElement("div");
        el.id = "plantoast";
        el.setAttribute("role", "status");
        document.body.appendChild(el);
    }
    const marked = !!opts?.celebrate;
    el.classList.toggle("celebrate", marked);
    el.classList.toggle("wrap", !!opts?.wrap);
    let dwell = ms ?? (marked ? 5200 : 2500);
    el.textContent = text;
    if (action) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "toast-act";
        b.textContent = action.label;
        b.addEventListener("click", () => { el?.classList.remove("show"); action.go(); });
        el.append(" ", b);
        if (dwell < 8000)
            dwell = 8000;
    }
    el.classList.add("show");
    clearTimeout(timer);
    timer = window.setTimeout(() => el?.classList.remove("show"), dwell);
}
function initOfflineNote(text) {
    const note = document.createElement("div");
    note.id = "offlinenote";
    note.className = "notice offlinenote";
    note.setAttribute("role", "status");
    note.hidden = true;
    const paint = () => {
        const off = navigator.onLine === false;
        if (off)
            note.textContent = text();
        note.hidden = !off;
    };
    const main = document.querySelector("main");
    if (main)
        main.prepend(note);
    else
        document.body.prepend(note);
    window.addEventListener("offline", paint);
    window.addEventListener("online", paint);
    paint();
}
function standingNote(id, lines, closeLabel, opts = {}) {
    let note = document.getElementById(id);
    if (!note) {
        note = document.createElement("div");
        note.id = id;
        note.setAttribute("role", "status");
        const main = document.querySelector("main");
        if (main)
            main.prepend(note);
        else
            document.body.prepend(note);
    }
    note.className = "acctnotice";
    const body = document.createElement("div");
    body.className = "acctnotice-body";
    for (const line of lines) {
        const p = document.createElement("p");
        p.textContent = line;
        body.append(p);
    }
    if (opts.actions?.length) {
        const row = document.createElement("div");
        row.className = "acctnotice-actions";
        for (const a of opts.actions) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "acctnotice-act btn btn-primary primary";
            b.textContent = a.label;
            b.addEventListener("click", a.run);
            row.append(b);
        }
        body.append(row);
    }
    const x = document.createElement("button");
    x.type = "button";
    x.className = "acctnotice-x";
    x.setAttribute("aria-label", closeLabel);
    x.textContent = "×";
    const box = note;
    x.addEventListener("click", () => { box.hidden = true; box.className = ""; box.replaceChildren(); opts.onClose?.(); });
    note.replaceChildren(body, x);
    note.hidden = false;
}
function celebrate(text) {
    toast(text, undefined, undefined, { celebrate: true });
}

const pending = new Map();
const pendingChunk = new Map();
const pendingLoaded = new Map();
let wired = false;
function markPanelOffline(id) {
    const panel = typeof document === "undefined" ? null : document.getElementById(id);
    if (!panel || panel.querySelector(":scope > .panelnote"))
        return;
    const note = document.createElement("p");
    note.className = "hint panelnote";
    note.setAttribute("role", "status");
    note.textContent = copy.apPanelNeedsConnection;
    panel.prepend(note);
    panel.classList.add("paneloffline");
}
function clearPanelOffline(id) {
    const panel = typeof document === "undefined" ? null : document.getElementById(id);
    if (!panel)
        return;
    panel.classList.remove("paneloffline");
    panel.querySelector(":scope > .panelnote")?.remove();
}
function wire() {
    if (wired)
        return;
    wired = true;
    onChunkLoaded((k) => {
        for (const [key, p] of [...pendingLoaded]) {
            if (p.chunk !== k)
                continue;
            pendingLoaded.delete(key);
            p.fn(chunkReady(k));
        }
        if (typeof location !== "undefined")
            runChunkHeld(currentRoute(), k);
    });
    if (typeof window !== "undefined")
        window.addEventListener("hashchange", () => flush(currentRoute()));
}
function whenShown(route, key, fn) {
    wire();
    if (currentRoute() === route) {
        pending.delete(key);
        fn();
        return;
    }
    pending.set(key, { route, fn });
}
function whenShownChunk(route, chunk, key, fn, panel) {
    wire();
    const routes = Array.isArray(route) ? route : [route];
    const here = currentRoute();
    const ready = chunkReady(chunk);
    if (ready && routes.includes(here)) {
        pendingChunk.delete(key);
        if (panel)
            clearPanelOffline(panel);
        fn(ready);
        return;
    }
    pendingChunk.set(key, { routes, chunk, fn: fn, panel });
    if (routes.includes(here))
        enterChunk(here, chunk);
}
function whenLoaded(chunk, key, fn) {
    wire();
    const ready = chunkReady(chunk);
    if (ready) {
        pendingLoaded.delete(key);
        fn(ready);
        return;
    }
    pendingLoaded.set(key, { chunk, fn: fn });
}
function runChunkHeld(route, k) {
    const m = chunkReady(k);
    if (!m)
        return;
    for (const [key, p] of [...pendingChunk]) {
        if (p.chunk !== k || !p.routes.includes(route))
            continue;
        pendingChunk.delete(key);
        if (p.panel)
            clearPanelOffline(p.panel);
        p.fn(m);
    }
    settleLoading(route);
}
const isPanelChunk = (route, k) => chunkFor(route) !== k;
function settleLoading(route) {
    for (const p of pendingChunk.values())
        if (p.routes.includes(route) && !isPanelChunk(route, p.chunk) && !chunkReady(p.chunk))
            return;
    clearLoading(route);
}
function partial(route, k) {
    for (const p of pendingChunk.values())
        if (p.chunk === k && p.routes.includes(route) && p.panel)
            markPanelOffline(p.panel);
}
function enterChunk(route, k) {
    if (chunkReady(k)) {
        runChunkHeld(route, k);
        return;
    }
    const panel = isPanelChunk(route, k);
    if (!panel)
        markLoading(route);
    loadChunk(k).then(() => { if (currentRoute() === route)
        runChunkHeld(route, k);
    else if (!panel)
        clearLoading(route); }, () => {
        if (currentRoute() !== route) {
            if (!panel)
                clearLoading(route);
            return;
        }
        if (panel)
            partial(route, k);
        else
            markFailed(route);
    });
}
function flush(route) {
    for (const [key, p] of [...pending]) {
        if (p.route !== route)
            continue;
        pending.delete(key);
        p.fn();
    }
    const need = new Set();
    for (const p of pendingChunk.values())
        if (p.routes.includes(route))
            need.add(p.chunk);
    for (const k of need)
        enterChunk(route, k);
}
function loadSync() {
    return loadChunk("sync").catch((e) => {
        throw new Error(`could not reach the backend (${e instanceof Error ? e.message : String(e)})`);
    });
}

const SES_KEY = "gg-sync-session";
const OWNER_KEY = "gg-account-owner";
const ENDED_KEY = "gg-session-ended";
const ENDED_NOTE = "sessionendednote";
const $ = (id) => document.getElementById(id);
function loadJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function saveJson(key, v) {
    try {
        if (v === null)
            localStorage.removeItem(key);
        else
            localStorage.setItem(key, JSON.stringify(v));
    }
    catch { }
}
let signedInState = loadJson(SES_KEY) !== null;
let emailState = loadJson(SES_KEY)?.email ?? null;
if (signedInState)
    void loadSync().catch(() => { });
let backendState = false;
const authListeners = [];
const isSignedIn = () => signedInState;
const signedInEmail = () => emailState;
const backendConfigured = () => backendState;
function onAuthChange(cb) {
    authListeners.push(cb);
}
function fireAuth() {
    for (const cb of authListeners)
        cb();
}
function friendlyAuthError(raw) {
    if (raw.includes("Invalid login credentials")) {
        return [copy.acErrWrongPassword];
    }
    if (raw.includes("Email not confirmed")) {
        return [copy.acErrUnconfirmed];
    }
    if (raw.includes("already registered")) {
        return [copy.acErrAlreadyRegistered];
    }
    if (raw.includes("you can only request this")) {
        return [copy.acErrRateLimit];
    }
    if (/otp_expired|invalid or has expired|Token has expired or is invalid|token not found|malformed/i.test(raw)) {
        return [copy.acErrLinkExpired];
    }
    if (/email rate limit|over_email_send_rate_limit/i.test(raw))
        return [copy.acErrEmailLimit];
    if (/request rate limit|over_request_rate_limit|too many requests/i.test(raw))
        return [copy.acErrTooManyTries];
    if (raw.includes("could not reach the backend"))
        return [copy.acErrCantReach];
    if (raw.includes("temporarily unavailable"))
        return [copy.acErrServiceDown];
    return [raw];
}
function initAccount(db, onPulled) {
    let defaultCfg = null;
    let session = loadJson(SES_KEY);
    const SIGNED_OUT_KEY = "gg-signed-out";
    const SIGNED_OUT_ALL_KEY = "gg-signed-out-all";
    try {
        const how = sessionStorage.getItem(SIGNED_OUT_KEY);
        const everywhere = sessionStorage.getItem(SIGNED_OUT_ALL_KEY) === "1";
        sessionStorage.removeItem(SIGNED_OUT_ALL_KEY);
        const deleted = how ? { deleted: copy.acAccountDeleted, "deleted+drafts": copy.acAccountDeletedDrafts,
            "deleted-kept": copy.acAccountDeletedKept }[how] : undefined;
        if (how && deleted) {
            sessionStorage.removeItem(SIGNED_OUT_KEY);
            standingNote("acctdeletednote", [deleted], copy.acDismiss);
        }
        else if (how) {
            sessionStorage.removeItem(SIGNED_OUT_KEY);
            const said = { gone: copy.acSignedOutGone, photos: copy.acSignedOutPhotos, "gone+drafts": copy.acSignedOutGoneDrafts,
                "photos+drafts": copy.acSignedOutPhotosDrafts }[how] ?? copy.acSignedOutToast;
            toast(everywhere ? `${copy.acSignedOutEverywhere} ${said}` : said, 9000, undefined, { wrap: true });
        }
    }
    catch { }
    const eff = () => defaultCfg;
    const report = (lines) => {
        const box = $("syncreport");
        box.innerHTML = "";
        for (const line of lines) {
            const p = document.createElement("p");
            p.className = "hint";
            p.textContent = line;
            box.appendChild(p);
        }
    };
    const clearNotice = () => { const b = $("acctnotice"); b.hidden = true; b.className = ""; b.innerHTML = ""; };
    const notice = (kind, lines, actions) => {
        const box = $("acctnotice");
        box.className = `acctnotice ${kind}`;
        box.innerHTML = "";
        const body = document.createElement("div");
        body.className = "acctnotice-body";
        for (const line of lines) {
            const p = document.createElement("p");
            p.textContent = line;
            body.appendChild(p);
        }
        if (actions?.length) {
            const row = document.createElement("div");
            row.className = "acctnotice-actions";
            for (const a of actions) {
                const b = document.createElement("button");
                b.type = "button";
                b.className = a.primary ? "acctnotice-act btn btn-primary primary" : "acctnotice-act btn btn-secondary";
                b.textContent = a.label;
                b.addEventListener("click", a.run);
                row.appendChild(b);
            }
            body.appendChild(row);
        }
        const x = document.createElement("button");
        x.type = "button";
        x.className = "acctnotice-x";
        x.setAttribute("aria-label", copy.acDismiss);
        x.textContent = "×";
        x.addEventListener("click", clearNotice);
        box.append(body, x);
        box.hidden = false;
    };
    const resendAction = (email) => ({
        label: copy.acResendConfirmation,
        run: () => {
            void (async () => {
                const cfg = eff();
                const to = email().trim();
                if (!cfg) {
                    notice("error", [copy.acErrEnterEmailInForm]);
                    return;
                }
                if (!to) {
                    const field = $("acctemail");
                    field.scrollIntoView({ block: "center" });
                    field.focus();
                    report([copy.acErrEnterEmailInForm]);
                    return;
                }
                try {
                    await (await loadSync()).resendConfirmation(cfg, to);
                    notice("info", [fillCopy("acResendSent", { email: to })]);
                }
                catch (e) {
                    notice("error", friendlyAuthError(`${e instanceof Error ? e.message : e}`));
                }
            })();
        },
    });
    const status = () => {
        backendState = eff() !== null;
        signedInState = session !== null;
        emailState = session?.email ?? null;
        $("acctstatus").textContent = !eff()
            ? copy.acStatusNoBackend
            : session
                ? fillCopy("acStatusSignedIn", { email: session.email })
                : copy.acStatusSignedOut;
        const promiseBody = document.getElementById("acctpromisebody");
        if (promiseBody)
            promiseBody.textContent = session ? copy.accountPromiseBodyIn : copy.accountPromiseBody;
        const promiseTitle = document.querySelector('#page-account .acctpromise [data-copy="accountPromiseTitle"]');
        if (promiseTitle)
            promiseTitle.textContent = session ? copy.accountPromiseTitleIn : copy.accountPromiseTitle;
        $("acctsignedout").hidden = !!session;
        $("acctsignedin").hidden = !session;
        $("acctstatus").hidden = !!session;
        for (const el of document.querySelectorAll("#page-account [data-acct-in]"))
            el.hidden = !session || (el.hasAttribute("data-plus") && !plusPreview());
        if (session) {
            const line = $("acctwholine");
            const who = document.createElement("b");
            who.id = "acctwho";
            who.textContent = session.email;
            line.textContent = "";
            fillNodes(line, copy.acSignedInLine, { email: who });
        }
        const chip = $("authchip");
        chip.textContent = session ? "" : copy.navLockTag;
        if (session) {
            const who = document.createElement("span");
            who.className = "authchip-who";
            who.textContent = `● ${session.email}`;
            chip.append(who);
        }
        chip.className = session ? "chip hacct authchip on" : "chip hacct authchip";
        chip.title = session ? fillCopy("acChipTitleIn", { email: session.email }) : copy.authChipTitle;
        if (session) {
            chip.setAttribute("aria-haspopup", "menu");
            chip.setAttribute("aria-controls", "acctmenu");
            chip.setAttribute("aria-expanded", "false");
            void import('./acctmenu.js').then((m) => m.wireAcctMenu(() => session !== null)).catch(() => { });
        }
        else {
            chip.removeAttribute("aria-haspopup");
            chip.removeAttribute("aria-controls");
            chip.removeAttribute("aria-expanded");
            const menu = document.getElementById("acctmenu");
            if (menu)
                menu.hidden = true;
        }
        fireAuth();
        app.refreshDraftBanner?.();
        app.refreshEditEntry?.(true);
    };
    const setSession = (s) => {
        const signingIn = !session && !!s, signingOut = !!session && !s;
        if (signingIn)
            setDevicePrefsAside();
        session = s;
        saveJson(SES_KEY, s);
        if (s) {
            saveJson(ENDED_KEY, null);
            const note = document.getElementById(ENDED_NOTE);
            if (note) {
                note.hidden = true;
                note.className = "";
                note.replaceChildren();
            }
        }
        if (signingOut) {
            if (!restoreDevicePrefs())
                app.applyPrefs?.(prefRecord().record);
        }
        status();
    };
    const gatherLocal = async () => {
        const meta = await listSyncMeta(db);
        const metaByKey = new Map(meta.map((m) => [m.key, m.updatedAt]));
        const plots = (await listPlots(db)).filter((p) => !p.example && !p.shared);
        const plotIds = new Set(plots.map((p) => p.id));
        const seasons = (await listSeasons(db)).filter((s) => plotIds.has(s.plot));
        const posts = (await listPosts(db)).filter((p) => plotIds.has(p.plot));
        const userSpecies = await listUserSpecies(db);
        const seeds = await listSeeds(db);
        return [
            ...seasons.map((s) => ({
                kind: "season", key: `${s.plot}:${s.id}`, record: s,
                updatedAt: metaByKey.get(`season:${s.plot}:${s.id}`) ?? null,
            })),
            ...posts.map((p) => ({
                kind: "post", key: `${p.plot}:${p.id}`, record: p,
                updatedAt: metaByKey.get(`post:${p.plot}:${p.id}`) ?? null,
            })),
            ...plots.map((p) => ({
                kind: "plot", key: p.id, record: p,
                updatedAt: metaByKey.get(`plot:${p.id}`) ?? null,
            })),
            ...userSpecies.map((u) => ({
                kind: "user_species", key: u.id, record: u,
                updatedAt: metaByKey.get(`user_species:${u.id}`) ?? null,
            })),
            ...seeds.map((s) => ({
                kind: "seed", key: s.id, record: s,
                updatedAt: metaByKey.get(`seed:${s.id}`) ?? null,
            })),
            ...(await loadSync()).soilRecords(await listSoilEntries(db), meta, plotIds),
            ...(await listPlotTombstones(db)).map((t) => ({
                kind: "plot_tombstone", key: t.id,
                record: { deleted_at: new Date(t.deletedAt).toISOString(), name: t.name },
                updatedAt: t.deletedAt,
            })),
            ...(() => {
                const pr = prefRecord();
                return pr.updatedAt != null ? [{ kind: "pref", key: "display", record: pr.record, updatedAt: pr.updatedAt }] : [];
            })(),
            ...(() => {
                const g = defaultGardenRecord();
                return g?.updatedAt != null ? [{ kind: "pref", key: "garden", record: g.record, updatedAt: g.updatedAt }] : [];
            })(),
        ];
    };
    const syncShared = async (sharedByOwner) => {
        const cfg = eff();
        const notes = [];
        const gone = [];
        let applied = 0;
        if (!cfg || !session)
            return { applied, notes, gone };
        const { fromSharedPlot, fromSharedPost, fromSharedSeason, planMerge, pushRecords, toSharedPlot, toSharedPost, toSharedSeason } = await loadSync();
        const localShared = (await listPlots(db, "all")).filter((p) => p.shared);
        const metaByKey = new Map((await listSyncMeta(db)).map((m) => [m.key, m.updatedAt]));
        const lastAt = lastSyncAt || (loadJson(LAST_SYNC_KEY)?.at ?? 0);
        for (const lp of localShared) {
            const mark = lp.shared;
            const stillShared = (sharedByOwner.get(mark.ownerId) ?? []).some((r) => r.kind === "plot" && r.key === mark.plot);
            if (!stillShared) {
                const unsent = lastAt > 0 && [...metaByKey].some(([k, at]) => (at ?? 0) > lastAt
                    && (k === `plot:${lp.id}` || k.startsWith(`season:${lp.id}:`) || k.startsWith(`post:${lp.id}:`)));
                if (unsent)
                    await keepCopyOfGarden(db, lp.id);
                gone.push({ name: gardenShownName(lp.name ?? mark.plot, true), unsent });
                for (const s of await listSeasons(db, lp.id))
                    await deleteSeason(db, lp.id, s.id);
                for (const po of await listPosts(db, lp.id))
                    await deletePost(db, lp.id, po.id);
                await deletePlot(db, lp.id);
                applied++;
                notes.push(`the shared garden "${lp.name ?? mark.plot}" is no longer shared with you - removed from this device.`);
            }
        }
        for (const [owner, rows] of sharedByOwner) {
            const localRecs = [];
            for (const lp of localShared.filter((p) => p.shared.ownerId === owner)) {
                const wire = fromSharedPlot(lp);
                if (!wire)
                    continue;
                localRecs.push({ kind: "plot", key: wire.key, record: wire.record, updatedAt: metaByKey.get(`plot:${lp.id}`) ?? null, ownerId: owner });
                for (const s of await listSeasons(db, lp.id)) {
                    const ws = fromSharedSeason(s, lp.shared);
                    localRecs.push({ kind: "season", key: ws.key, record: ws.record, updatedAt: metaByKey.get(`season:${lp.id}:${s.id}`) ?? null, ownerId: owner });
                }
                for (const po of await listPosts(db, lp.id)) {
                    const wp = fromSharedPost(po, lp.shared);
                    localRecs.push({ kind: "post", key: wp.key, record: wp.record, updatedAt: metaByKey.get(`post:${lp.id}:${po.id}`) ?? null, ownerId: owner });
                }
            }
            const plan = planMerge(localRecs, rows);
            const applyOne = async (kind, record, at) => {
                if (kind === "plot")
                    await putPlotFromSync(db, toSharedPlot(record, { ownerId: owner, plot: record.id }), at);
                else if (kind === "season")
                    await putSeasonFromSync(db, toSharedSeason(record, owner), at);
                else if (kind === "post")
                    await putPostFromSync(db, toSharedPost(record, owner), at);
            };
            for (const r of plan.pull) {
                try {
                    await applyOne(r.kind, r.record, Date.parse(r.updated_at));
                    applied++;
                }
                catch (e) {
                    notes.push(`refused to apply shared ${r.kind}: ${e instanceof Error ? e.message : e}`);
                }
            }
            for (const m of plan.merged) {
                try {
                    await applyOne(m.kind, m.record, m.updatedAt ?? Date.now());
                    applied++;
                }
                catch (e) {
                    notes.push(`refused to merge shared ${m.kind}: ${e instanceof Error ? e.message : e}`);
                }
            }
            const toPush = [...plan.push, ...plan.merged.map((m) => ({ ...m, ownerId: owner }))];
            if (toPush.length) {
                const res = await pushRecords(cfg, session, toPush);
                for (const fl of res.failures)
                    notes.push(`couldn't sync a shared ${fl.kind} to its owner: ${fl.error}`);
            }
        }
        return { applied, notes, gone };
    };
    let teamsUi = null;
    let lastSyncAt = 0;
    let leaving = false;
    const LAST_SYNC_KEY = "gg-sync-last";
    const renderLastSync = () => {
        const line = document.getElementById("lastsync");
        if (!line)
            return;
        const last = loadJson(LAST_SYNC_KEY);
        line.hidden = !last || !session;
        if (!last || !session)
            return;
        const mins = Math.max(0, Math.round((Date.now() - last.at) / 60000));
        const when = mins < 1 ? copy.acJustNow : mins < 60 ? fillCopy("acMinAgo", { n: mins })
            : mins < 60 * 24 ? fillCopy("acHoursAgo", { n: Math.round(mins / 60) }) : new Date(last.at).toLocaleDateString(dateLocale());
        const behind = last.notes.some((n) => /couldn't push/.test(n));
        line.textContent = fillCopy(behind ? "acLastSyncedBehind" : "acLastSynced", { when });
    };
    const host = {
        cfg: eff, live: () => session, stored: () => loadJson(SES_KEY),
        keep: (s, store) => { session = s; if (store)
            saveJson(SES_KEY, s); },
        ended: () => endSession(),
        words: { expired: copy.acErrSessionExpired, signInFirst: copy.acErrSignInFirst },
    };
    const freshSession = async () => (await loadSync()).freshSession(host);
    const authed = async (fn) => (await loadSync()).authed(host, fn);
    const endSession = () => {
        if (session)
            saveJson(ENDED_KEY, { email: session.email });
        setSession(null);
        showEnded();
    };
    const showEnded = () => {
        const ended = loadJson(ENDED_KEY);
        if (!ended || session)
            return;
        const field = $("acctemail");
        if (!field.value)
            field.value = ended.email;
        standingNote(ENDED_NOTE, [copy.acSessionEndedNote, copy.acSessionEndedSafe], copy.acDismiss, {
            actions: [{ label: copy.acSessionEndedSignIn, run: () => { openAuthSheet(); if (field.value)
                        $("acctpass").focus(); } }],
            onClose: () => saveJson(ENDED_KEY, null),
        });
    };
    const beginSession = async (s) => {
        const { ownerOf, sameOwner } = await loadSync();
        const was = loadJson(OWNER_KEY), now = ownerOf(s);
        if (was && !sameOwner(was, now)) {
            await eraseAccountData(db, { photos: true });
            forgetAccountDefault();
            saveJson(LAST_SYNC_KEY, null);
            console.info("account: another account's copy left this device before this sign-in");
        }
        saveJson(OWNER_KEY, now);
        setSession(s);
    };
    const runSync = async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error(copy.acErrSignInFirst);
        await freshSession();
        if (!session)
            throw new Error(copy.acErrSessionExpired);
        const { deleteRecords, ownerOf, partitionRemote, planMerge, pullRecords, pushRecords, renewOrEnd } = await loadSync();
        if (!loadJson(OWNER_KEY))
            saveJson(OWNER_KEY, ownerOf(session));
        let remote;
        try {
            remote = await pullRecords(cfg, session);
        }
        catch {
            remote = await pullRecords(cfg, await renewOrEnd(host, cfg));
        }
        const remoteExampleIds = new Set(remote.filter((r) => r.kind === "plot" && r.record.example).map((r) => r.key));
        remoteExampleIds.add("plot_example");
        remote = remote.filter((r) => {
            if (r.kind === "plot")
                return !remoteExampleIds.has(r.key);
            if (r.kind === "season")
                return !remoteExampleIds.has(r.record.plot ?? r.key.split(":")[0]);
            return true;
        });
        const { own, sharedByOwner } = partitionRemote(remote, session.userId);
        remote = own;
        const splitNotes = [];
        {
            const remotePlots = new Map(remote.filter((r) => r.kind === "plot").map((r) => [r.key, r.record]));
            for (const lp of await listPlots(db)) {
                const rp = remotePlots.get(lp.id);
                if (!rp?.anchor || !lp.anchor)
                    continue;
                const dLat = lp.anchor.lat - rp.anchor.lat;
                const dLon = (lp.anchor.lon - rp.anchor.lon) * Math.cos((rp.anchor.lat * Math.PI) / 180);
                const meters = Math.hypot(dLat, dLon) * 111_000;
                if (meters < 250)
                    continue;
                let newId = `${lp.id}_device`;
                for (let n = 2; (await getPlot(db, newId)) || remotePlots.has(newId); n++)
                    newId = `${lp.id}_device_${n}`;
                const moved = await rekeyPlot(db, lp.id, newId, { name: fillCopy("acThisDeviceGardenName", { name: lp.name ?? copy.acGardenFallbackName }) });
                console.info(`sync: split local plot ${lp.id} -> ${newId} (anchors ${Math.round(meters)} m apart)`);
                splitNotes.push(fillCopy("acSplitNote", { name: lp.name ?? lp.id, kept: `${moved.name}` }));
            }
        }
        const plan = planMerge(await gatherLocal(), remote);
        const lines = [...splitNotes];
        let erased = 0;
        for (const e of plan.eraseLocal) {
            try {
                const had = await getPlot(db, e.plotId);
                await eraseGarden(db, e.plotId, { tombstone: true, name: e.name, deletedAt: e.deletedAt });
                if (had) {
                    erased++;
                    lines.push(fillCopy("acErasedNote", { name: `${e.name}` }));
                }
            }
            catch (err) {
                lines.push(fillCopy("acEraseFailed", { name: `${e.name}`, error: `${err instanceof Error ? err.message : err}` }));
            }
        }
        if (plan.deleteRemote.length)
            await deleteRecords(cfg, session, plan.deleteRemote);
        for (const id of plan.clearLocalTombstones)
            await deletePlotTombstone(db, id);
        let applied = 0;
        let postsPulled = false;
        for (const r of plan.pull) {
            try {
                const at = Date.parse(r.updated_at);
                if (r.kind === "post")
                    postsPulled = true;
                if (r.kind === "season")
                    await putSeasonFromSync(db, r.record, at);
                else if (r.kind === "plot")
                    await putPlotFromSync(db, r.record, at);
                else if (r.kind === "post")
                    await putPostFromSync(db, r.record, at);
                else if (r.kind === "user_species")
                    await putUserSpeciesFromSync(db, r.record, at);
                else if (r.kind === "seed")
                    await putSeedFromSync(db, r.record, at);
                else if (r.kind === "soil")
                    await putSoilFromSync(db, r.key, r.record, at);
                else if (r.kind === "pref" && r.key === "garden")
                    applyDefaultGarden(r.record, at);
                else if (r.kind === "pref") {
                    app.applyPrefs?.(r.record, at);
                }
                else {
                    lines.push(fillCopy("acSkippedKind", { kind: r.kind }));
                    continue;
                }
                applied++;
            }
            catch (e) {
                lines.push(fillCopy("acRefusedApply", { kind: r.kind, key: r.key, error: `${e instanceof Error ? e.message : e}` }));
            }
        }
        let mergedApplied = 0;
        for (const m of plan.merged) {
            try {
                if (m.kind === "season")
                    await putSeasonFromSync(db, m.record, m.updatedAt ?? Date.now());
                else
                    await putPlotFromSync(db, m.record, m.updatedAt ?? Date.now());
                mergedApplied++;
            }
            catch (e) {
                lines.push(fillCopy("acRefusedMerge", { kind: m.kind, key: m.key, error: `${e instanceof Error ? e.message : e}` }));
            }
        }
        const pushRes = await pushRecords(cfg, session, [...plan.push, ...plan.merged]);
        console.info(`sync: ${pushRes.pushed} pushed, ${applied} pulled, ${mergedApplied} merged, ${plan.skipped} already identical.`, plan.notes);
        for (const fl of pushRes.failures) {
            console.warn(`sync: couldn't push ${fl.count} ${fl.kind} record${fl.count === 1 ? "" : "s"}: ${fl.error}`
                + " - if this names garden_records_kind_check, the backend predates this record kind; re-run the schema in docs/ACCOUNTS-SETUP.md.");
        }
        if (pushRes.failures.length) {
            lines.push(copy.acSyncPartial);
        }
        const shared = await syncShared(sharedByOwner);
        for (const n of shared.notes)
            console.info(`sync (shared): ${n}`);
        if (shared.gone.length) {
            const said = [...shared.gone.map((g) => fillCopy("acSharedGone", { name: g.name })), ...(shared.gone.some((g) => g.unsent) ? [copy.acSharedGoneKept] : [])];
            standingNote("gardengonenote", said, copy.acDismiss);
            toast(said.join(" "), 9000, undefined, { wrap: true });
        }
        if (shared.applied)
            void teamsUi?.refresh();
        if (postsPulled)
            app.invalidateHomePosts?.();
        if (applied || mergedApplied || erased || shared.applied)
            onPulled();
        await app.afterSync?.();
        lastSyncAt = Date.now();
        app.pull = null;
        const firstHere = !loadJson(LAST_SYNC_KEY);
        saveJson(LAST_SYNC_KEY, {
            at: lastSyncAt, pushed: pushRes.pushed, pulled: applied, merged: mergedApplied,
            skipped: plan.skipped,
            notes: [...plan.notes, ...pushRes.failures.map((fl) => `couldn't push ${fl.count} ${fl.kind}: ${fl.error}`)].slice(0, 6),
        });
        renderLastSync();
        if (firstHere)
            app.homeRefresh?.();
        return lines;
    };
    const AUTO_SYNC_MS = 2500;
    let autoTimer = null;
    const quietSync = async () => {
        if (!eff() || !session || leaving)
            return;
        try {
            const lines = await runSync();
            const failed = lines.find((l) => l === copy.acSyncPartial);
            if (failed)
                report([failed, copy.acAutoSyncRetry]);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            report(msg === copy.acErrSessionExpired ? [] : [fillCopy("acAutoSyncFailed", { error: msg }), copy.acItWillRetry]);
        }
    };
    const scheduleSync = () => {
        if (!eff() || !session)
            return;
        if (autoTimer != null)
            clearTimeout(autoTimer);
        autoTimer = window.setTimeout(() => { autoTimer = null; void quietSync(); }, AUTO_SYNC_MS);
    };
    const flushSync = () => {
        if (autoTimer == null)
            return;
        clearTimeout(autoTimer);
        autoTimer = null;
        void quietSync();
    };
    setOnLocalWrite(scheduleSync);
    app.pushPrefs = scheduleSync;
    window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden")
        flushSync(); });
    window.addEventListener("pagehide", flushSync);
    window.addEventListener("online", () => { if (eff() && session)
        void quietSync(); });
    const FOREGROUND_PULL_MIN_MS = 60_000;
    window.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible")
            return;
        if (!eff() || !session)
            return;
        if (Date.now() - lastSyncAt < FOREGROUND_PULL_MIN_MS)
            return;
        void quietSync();
    });
    window.addEventListener("storage", (e) => {
        if (e.key !== SES_KEY || leaving)
            return;
        let next = null;
        try {
            next = e.newValue ? JSON.parse(e.newValue) : null;
        }
        catch {
            return;
        }
        if (next && session && next.email === session.email) {
            session = next;
            return;
        }
        if (!next && !session)
            return;
        leaving = true;
        location.reload();
    });
    const run = (btn, fn) => {
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = copy.acWorking;
        clearNotice();
        fn().then(report).catch((e) => {
            const raw = `${e instanceof Error ? e.message : e}`;
            const actions = raw.includes("Email not confirmed")
                ? [resendAction(() => ($("acctemail")).value)]
                : undefined;
            notice("error", friendlyAuthError(raw), actions);
        })
            .finally(() => {
            btn.disabled = false;
            if (btn.textContent === copy.acWorking)
                btn.textContent = label;
        });
    };
    const act = (id, fn) => {
        $(id).addEventListener("click", () => run($(id), fn));
    };
    const creds = () => {
        const email = ($("acctemail")).value.trim();
        const pass = ($("acctpass")).value;
        if (!email || !pass)
            throw new Error(copy.acErrEmailAndPassword);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new Error(copy.acErrBadEmail);
        const cfg = eff();
        if (!cfg)
            throw new Error(copy.acErrNoBackend);
        return [cfg, email, pass];
    };
    let authMode = "signin";
    const setAuthMode = (m) => {
        authMode = m;
        const signup = m === "signup";
        $("acctlegend").textContent = signup ? copy.acCreateAccount : copy.acSignIn;
        $("acctsignin").textContent = signup ? copy.acCreateAccount : copy.acSignIn;
        const pass = $("acctpass");
        pass.setAttribute("autocomplete", signup ? "new-password" : "current-password");
        if (signup)
            pass.setAttribute("minlength", "8");
        else
            pass.removeAttribute("minlength");
        $("acctpwhint").hidden = !signup;
        $("acctswitchrow").hidden = signup;
        $("acctbackrow").hidden = !signup;
        if (signup)
            ($("acctemail")).focus();
    };
    $("acctsignup").addEventListener("click", () => setAuthMode("signup"));
    $("acctback").addEventListener("click", () => setAuthMode("signin"));
    const SIGNUP_KEY = "gg-signup-email";
    const rememberSignup = (email) => { try {
        localStorage.setItem(SIGNUP_KEY, email.trim().toLowerCase());
    }
    catch { } };
    const ownSignup = (email) => { try {
        return localStorage.getItem(SIGNUP_KEY) === email.trim().toLowerCase();
    }
    catch {
        return false;
    } };
    const forgetSignup = () => { try {
        localStorage.removeItem(SIGNUP_KEY);
    }
    catch { } };
    const fillSignupEmail = () => {
        const field = $("acctemail");
        if (!field.value) {
            try {
                field.value = localStorage.getItem(SIGNUP_KEY) ?? "";
            }
            catch { }
        }
        return !!field.value.trim();
    };
    const AUTH_PORTAL_IDS = ["acctnotice", "acctsignedout"];
    let authOpener = null;
    let authHomes = [];
    const closeAuthSheet = () => {
        const sheet = $("authsheet");
        if (sheet.hidden)
            return;
        for (const h of [...authHomes].reverse())
            h.parent.insertBefore(h.el, h.next);
        authHomes = [];
        sheet.hidden = true;
        $("authscrim").hidden = true;
        document.body.classList.remove("authsheet-open");
        const back = authOpener;
        authOpener = null;
        back?.focus();
    };
    const openAuthSheet = () => {
        if (isSignedIn())
            return;
        authOpener = document.activeElement ?? null;
        setAuthMode("signin");
        const body = $("authsheetbody");
        authHomes = AUTH_PORTAL_IDS.map((id) => { const el = $(id); return { el, parent: el.parentNode, next: el.nextSibling }; });
        for (const { el } of authHomes)
            body.appendChild(el);
        $("acctsignedout").hidden = false;
        $("authscrim").hidden = false;
        $("authsheet").hidden = false;
        document.body.classList.add("authsheet-open");
        ($("acctemail")).focus();
    };
    {
        const prefs = document.getElementById("sec-prefs");
        const form = document.getElementById("acctsignedout");
        const note = document.getElementById("acctnotice");
        if (prefs?.parentNode && form) {
            if (note)
                prefs.parentNode.insertBefore(note, prefs);
            prefs.parentNode.insertBefore(form, prefs);
        }
    }
    $("authsheetclose").addEventListener("click", () => closeAuthSheet());
    $("authscrim").addEventListener("click", () => closeAuthSheet());
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("authsheet-open")) {
            e.preventDefault();
            closeAuthSheet();
        }
    });
    app.openAuthSheet = () => openAuthSheet();
    app.closeAuthSheet = () => closeAuthSheet();
    ($("signinform")).addEventListener("submit", (ev) => {
        ev.preventDefault();
        noteSignInStart(location.hash);
        if (authMode === "signup") {
            run($("acctsignin"), async () => {
                const [c, email, pass] = creds();
                if (pass.length < 8)
                    throw new Error(copy.acErrPasswordShort);
                const s = await (await loadSync()).signUp(c, email, pass);
                rememberSignup(email);
                if (!s) {
                    notice("info", [
                        fillCopy("acSignupSent", { email }),
                        copy.acSignupAlreadyHave,
                    ], [resendAction(() => email)]);
                    ($("acctpass")).value = "";
                    setAuthMode("signin");
                    return [];
                }
                await beginSession(s);
                countRung("account-made");
                toast(fillCopy("acAccountCreatedToast", { email }));
                const lines = await runSync();
                try {
                    await app.onSignIn?.();
                }
                catch { }
                return lines;
            });
            return;
        }
        run($("acctsignin"), async () => {
            const [c, email, pass] = creds();
            await beginSession(await (await loadSync()).signIn(c, email, pass));
            toast(fillCopy("acSignedInToast", { email }));
            const lines = await runSync();
            try {
                await app.onSignIn?.();
            }
            catch { }
            return lines;
        });
    });
    act("pwforgot", async () => {
        const cfg = eff();
        if (!cfg)
            throw new Error(copy.acErrNoBackend);
        const email = ($("acctemail")).value.trim();
        if (!email)
            throw new Error(copy.acErrEnterEmailAbove);
        await (await loadSync()).recoverPassword(cfg, email);
        notice("info", [fillCopy("acRecoverySent", { email })]);
        return [];
    });
    act("passchange", async () => {
        if (!eff() || !session)
            throw new Error(copy.acErrSignInFirst);
        const pw = ($("newpass")).value;
        if (pw.length < 8)
            throw new Error(copy.acErrPasswordShort);
        const { updateUser } = await loadSync();
        await authed((cfg, s) => updateUser(cfg, s, { password: pw }));
        ($("newpass")).value = "";
        notice("info", [copy.acPasswordChanged]);
        return [];
    });
    act("emailchange", async () => {
        if (!eff() || !session)
            throw new Error(copy.acErrSignInFirst);
        const email = ($("newemail")).value.trim();
        if (!email)
            throw new Error(copy.acErrEnterNewEmail);
        const { updateUser } = await loadSync();
        await authed((cfg, s) => updateUser(cfg, s, { email }));
        ($("newemail")).value = "";
        notice("info", [fillCopy("acEmailChangeSent", { email })]);
        return [];
    });
    const finishSignOut = async (erase, mode = "out") => {
        leaving = true;
        saveJson(ENDED_KEY, null);
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const f = document.getElementById(id);
            if (f)
                f.value = "";
        }
        const cfg = eff();
        if (cfg && session && mode === "out") {
            const s = session;
            await loadSync().then((m) => m.signOut(cfg, s), () => undefined);
        }
        let how = "kept";
        if (mode === "deleted") {
            try {
                await eraseAccountData(db, { photos: true });
                forgetAccountDefault();
                saveJson(LAST_SYNC_KEY, null);
                saveJson(OWNER_KEY, null);
                how = (await listPlots(db, "all")).some((p) => p.owner === "draft" && !p.example) ? "deleted+drafts" : "deleted";
            }
            catch {
                how = "deleted-kept";
            }
        }
        else if (erase) {
            try {
                const { photosKept } = await eraseAccountData(db);
                forgetAccountDefault();
                saveJson(LAST_SYNC_KEY, null);
                how = photosKept ? "photos" : "gone";
                if ((await listPlots(db, "all")).some((p) => p.owner === "draft" && !p.example))
                    how += "+drafts";
            }
            catch {
                how = "kept";
            }
        }
        setSession(null);
        try {
            await app.onSignOut?.();
        }
        catch { }
        markPlanFresh();
        try {
            app.resetPlanStep?.();
        }
        catch { }
        try {
            sessionStorage.setItem(SIGNED_OUT_KEY, how);
            if (mode === "everywhere")
                sessionStorage.setItem(SIGNED_OUT_ALL_KEY, "1");
        }
        catch { }
        location.hash = "#/start";
        location.reload();
    };
    act("acctsignout", async () => {
        const cfg = eff();
        if (!cfg || !session) {
            await finishSignOut(false);
            return [];
        }
        if (autoTimer != null) {
            clearTimeout(autoTimer);
            autoTimer = null;
        }
        let reached = false;
        try {
            reached = !(await runSync()).includes(copy.acSyncPartial);
        }
        catch {
            reached = false;
        }
        if (!session) {
            await finishSignOut(false);
            return [];
        }
        if (reached) {
            await finishSignOut(true);
            return [];
        }
        location.hash = "#/account";
        notice("error", [copy.acSignOutOffline], [
            { label: copy.acStaySignedIn, primary: true, run: clearNotice },
            { label: copy.acSignOutKeepCopy, run: () => { clearNotice(); void finishSignOut(false); } },
        ]);
        const card = document.getElementById("acctnotice");
        if (card) {
            card.scrollIntoView({ block: "center" });
            card.querySelector(".acctnotice-act")?.focus({ preventScroll: true });
        }
        return [];
    });
    act("acctsignouteverywhere", async () => {
        if (!eff() || !session)
            throw new Error(copy.acErrSignInFirst);
        if (autoTimer != null) {
            clearTimeout(autoTimer);
            autoTimer = null;
        }
        let reached = false;
        try {
            reached = !(await runSync()).includes(copy.acSyncPartial);
        }
        catch {
            reached = false;
        }
        if (!session) {
            await finishSignOut(false);
            return [];
        }
        const { signOutEverywhere } = await loadSync();
        await authed((c, s) => signOutEverywhere(c, s));
        await finishSignOut(reached, "everywhere");
        return [];
    });
    act("acctdelete", async () => {
        const cfg = eff();
        if (!cfg || !session)
            throw new Error(copy.acErrSignInFirst);
        const DELETE_PHRASE = copy.acDeletePhrase;
        const typed = ($("delconfirm")).value.trim().toLowerCase();
        if (typed !== DELETE_PHRASE.toLowerCase() && typed !== "delete my account") {
            throw new Error(fillCopy("acErrTypeDeletePhrase", { phrase: DELETE_PHRASE }));
        }
        const pw = ($("delpass")).value;
        if (!pw)
            throw new Error(copy.acErrDeletePassword);
        const { deleteAccount, signIn } = await loadSync();
        await signIn(cfg, session.email, pw);
        await authed((c, s) => deleteAccount(c, s));
        await finishSignOut(true, "deleted");
        return [];
    });
    if (plusPreview())
        void import('./teams.js').then(({ initTeams }) => {
            teamsUi = initTeams({
                cfg: eff, session: () => session, fresh: freshSession, onAuthChange,
                listOwnGardens: async () => orderGardens((await listPlots(db)).filter((p) => !p.example && !p.shared && !p.closed_date), (p) => p, defaultPlotId())
                    .map((p) => ({ id: p.id, name: p.name ?? p.id })),
                listSharedGardens: async () => orderGardens((await listPlots(db, "all")).filter((p) => p.shared), (p) => p, defaultPlotId())
                    .map((p) => ({ ownerId: p.shared.ownerId, plot: p.shared.plot, name: p.name ?? p.shared.plot })),
                onSharedChange: () => void quietSync(),
            });
        }, (e) => console.warn("[garden circles] the panel did not load", e));
    if (plusPreview())
        void import('./forecast.js').then(({ initForecast }) => initForecast({ session: () => session, authed, onAuthChange }), (e) => console.warn("[weather watch] the strip did not load", e));
    if (plusPreview())
        void import('./push.js').then(({ initPush }) => initPush({ session: () => session, authed, onAuthChange }), (e) => console.warn("[weather watch] push did not load", e));
    status();
    renderLastSync();
    showEnded();
    void (async () => {
        try {
            const res = await fetch("./backend.json");
            if (res.ok) {
                const body = await res.json();
                if (body.url && body.anonKey)
                    defaultCfg = { url: body.url.replace(/\/+$/, ""), anonKey: body.anonKey };
            }
        }
        catch { }
        const cfg = eff();
        let landAfterBootSync = null;
        let bootGreeting = [];
        const adoptLinkSession = async (tok, email, deferred) => {
            const hadSession = session !== null;
            noteSignInStart(location.hash);
            await beginSession({ access_token: tok.access_token, refresh_token: tok.refresh_token, email });
            if (tok.type === "recovery") {
                notice("info", [copy.acRecoveryVerified]);
                document.getElementById("newpass")?.focus();
            }
            else {
                bootGreeting = [fillCopy("acEmailConfirmedWelcome", { email }),
                    copy.acOpenInUsualBrowser];
                report(bootGreeting);
            }
            const land = !hadSession && tok.type !== "recovery";
            const adoptDrafts = tok.type === "signup" && ownSignup(email);
            if (adoptDrafts)
                forgetSignup();
            if (!deferred) {
                landAfterBootSync = land ? { adoptDrafts } : null;
                return;
            }
            try {
                report([...bootGreeting, ...(await runSync())]);
            }
            catch (e) {
                report([...bootGreeting, fillCopy("acAutoSyncFailed", { error: `${e instanceof Error ? e.message : e}` })]);
            }
            if (land) {
                try {
                    await app.onSignIn?.({ adoptDrafts });
                }
                catch { }
            }
        };
        if (captured.auth && cfg) {
            const tok = captured.auth;
            captured.auth = null;
            try {
                const who = await (await loadSync()).getUser(cfg, tok.access_token);
                if (session && session.email !== who.email) {
                    report([fillCopy("acIgnoredLink", { email: who.email, current: session.email })]);
                }
                else if (session) {
                    await adoptLinkSession(tok, who.email, false);
                }
                else {
                    notice("info", [
                        fillCopy("acLinkWantsSignIn", { email: who.email }),
                        copy.acLinkContinueOnly,
                    ], [
                        { label: fillCopy("acSignInAs", { email: who.email }), primary: true, run: () => { clearNotice(); void adoptLinkSession(tok, who.email, true); } },
                        { label: copy.acIgnoreLink, run: () => { clearNotice(); report([copy.acLinkIgnored]); } },
                    ]);
                }
            }
            catch (e) {
                report([fillCopy("acLinkDidntVerify", { error: `${e instanceof Error ? e.message : e}` })]);
            }
        }
        if (captured.confirm && cfg) {
            const link = captured.confirm;
            captured.confirm = null;
            const words = {
                signup: { lines: [copy.acConfirmSignupHead, copy.acConfirmSignupBody], tap: copy.acConfirmSignupTap },
                recovery: { lines: [copy.acConfirmRecoveryHead, copy.acConfirmRecoveryBody], tap: copy.acConfirmRecoveryTap },
                email_change: { lines: [copy.acConfirmEmailChangeHead, copy.acConfirmEmailChangeBody], tap: copy.acConfirmEmailChangeTap },
            };
            const w = words[link.type];
            const refused = (raw) => {
                if (/could not reach the backend|temporarily unavailable/.test(raw)) {
                    notice("error", friendlyAuthError(raw), [confirmTap]);
                    return;
                }
                const known = link.type === "signup" && fillSignupEmail();
                notice("error", friendlyAuthError(raw), link.type === "signup"
                    ? [resendAction(() => ($("acctemail")).value)]
                    : link.type === "recovery" ? [{ label: copy.acSendNewResetLink, run: () => { clearNotice(); $("pwforgot")?.click(); } }] : undefined);
                if (link.type === "signup")
                    report(known ? [] : [copy.acTypeEmailThenResend]);
            };
            const confirmTap = { label: w.tap, primary: true, run: () => {
                    void (async () => {
                        clearNotice();
                        let tok;
                        try {
                            tok = await (await loadSync()).verifyTokenHash(cfg, link.type, link.tokenHash);
                        }
                        catch (e) {
                            refused(`${e instanceof Error ? e.message : e}`);
                            return;
                        }
                        if (!tok) {
                            notice("ok", [copy.acEmailChangeHalfDone]);
                            return;
                        }
                        const who = tok.email || (await (await loadSync()).getUser(cfg, tok.access_token)).email;
                        const linkTok = { access_token: tok.access_token, refresh_token: tok.refresh_token, type: link.type };
                        if (session && session.email !== who) {
                            report([fillCopy("acIgnoredLink", { email: who, current: session.email })]);
                        }
                        else if (session) {
                            await adoptLinkSession(linkTok, who, true);
                        }
                        else {
                            notice("info", link.type === "signup" ? [
                                fillCopy("acSignupConfirmedAsk", { email: who }),
                                copy.acSignupContinueOnly,
                            ] : [
                                fillCopy("acLinkWantsSignIn", { email: who }),
                                copy.acLinkContinueOnly,
                            ], [
                                { label: fillCopy("acSignInAs", { email: who }), primary: true, run: () => { clearNotice(); void adoptLinkSession(linkTok, who, true); } },
                                { label: copy.acIgnoreLink, run: () => { clearNotice(); report([copy.acLinkIgnored]); } },
                            ]);
                        }
                    })();
                } };
            notice("info", w.lines, [confirmTap]);
        }
        if (captured.error && cfg) {
            const err = captured.error;
            captured.error = null;
            const known = fillSignupEmail();
            notice("error", friendlyAuthError(`${err.code} ${err.description}`), [resendAction(() => ($("acctemail")).value)]);
            report([known ? copy.acLinkErrorHelpFilled : copy.acLinkErrorHelp]);
        }
        status();
        if (cfg && session) {
            try {
                report([...bootGreeting, ...(await runSync())]);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                report([...bootGreeting, ...(msg === copy.acErrSessionExpired ? [] : [fillCopy("acAutoSyncFailed", { error: msg })])]);
                app.pull = "failed";
                app.homeRefresh?.();
            }
            if (landAfterBootSync) {
                try {
                    await app.onSignIn?.(landAfterBootSync);
                }
                catch { }
            }
            else {
                try {
                    await app.landOnDefault?.();
                }
                catch { }
            }
        }
        else if (session) {
            app.pull = "none";
            app.homeRefresh?.();
        }
    })();
}

const listWords = (names) => {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
};
const plural = (base, n, vars = {}) => fillCopy(`${base}${n === 1 ? "One" : "Many"}`, { n, ...vars });
function jobKey(t) {
    return [t.kind, t.rule ?? "", t.bed ?? "", t.species ?? "", t.group ?? ""].join("|")
        + (t.windowEnd ? "|end" : "") + (t.keptFor ? `|kept${t.keptFor}` : "");
}
const canSetAside = (t) => t.kind !== "logged" && t.kind !== "harvest_open" && !isMarker(t);
function setAsideKeys(season) {
    const newest = new Map();
    for (const e of season?.set_aside ?? []) {
        const cur = newest.get(e.job);
        if (!cur || e.at >= cur.at)
            newest.set(e.job, e);
    }
    return new Set([...newest].filter(([, e]) => !e.back).map(([job]) => job));
}
const MONTHS = [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
    copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec];
const category = (t) => t.cat ?? (t.kind === "sow_climber" ? "sow" : t.kind === "harvest_open" ? "harvest"
    : t.kind === "log_first_freeze" ? "frost" : "plant");
const isMarker = (t) => { const c = category(t); return c === "frost" || c === "heat" || c === "water"; };
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ym = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
function growingMonthsOfSeason(tasks, from, to, end, lastFrost, firstFreeze, rare) {
    const inSpan = tasks.filter((t) => typeof t.date === "string" && t.date >= from && t.date <= to && !t.ended && t.coming == null);
    const indoors = new Set(["start_indoors", "stratify_start", "care", "install_support"]);
    const starts = inSpan.filter((t) => (category(t) === "plant" || category(t) === "sow") && !indoors.has(t.kind)).map((t) => t.date);
    const ends = [];
    for (const t of inSpan)
        if (category(t) === "harvest") {
            ends.push(t.date);
            if (t.windowCloses && t.windowCloses <= to)
                ends.push(t.windowCloses);
        }
    const live = inSpan.some((t) => t.live);
    if (!starts.length && !ends.length && !live)
        return [];
    const lo = starts.length && !live ? starts.reduce((a, b) => (a < b ? a : b)) : from;
    const hi = ends.length ? [...ends, ...starts].reduce((a, b) => (a > b ? a : b)) : end;
    const y0 = Number(from.slice(0, 4)), y1 = Number(to.slice(0, 4));
    const frostFree = [];
    for (let y = y0; y <= y1; y++) {
        if (rare || !lastFrost)
            frostFree.push([`${y}-01-01`, `${y}-12-31`]);
        else if (!firstFreeze)
            frostFree.push([`${y}-${lastFrost}`, `${y}-12-31`]);
        else if (lastFrost <= firstFreeze)
            frostFree.push([`${y}-${lastFrost}`, `${y}-${firstFreeze}`]);
        else
            frostFree.push([`${y}-01-01`, `${y}-${firstFreeze}`], [`${y}-${lastFrost}`, `${y}-12-31`]);
    }
    const out = [];
    for (let y = y0, m = Number(from.slice(5, 7)); ym(y, m) <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
        const a = `${ym(y, m)}-01`, b = `${ym(y, m)}-${MONTH_LAST_DAY[m - 1]}`;
        if (lo <= b && hi >= a && frostFree.some(([s, e]) => s <= b && e >= a))
            out.push(ym(y, m));
    }
    return out;
}
function seasonGrowing(year, lat, fr, core, keep) {
    const b = seasonBounds(year, lat);
    return isSouthern(lat)
        ? growingMonthsOfSeason([...core(year), ...core(year + 1)].filter(keep), b.start, b.end, b.end, fr.lastFrost, fr.firstFreeze, fr.rare)
        : growingMonthsOfSeason(core(year).filter(keep), b.start, `${year + 1}-06-30`, b.end, fr.lastFrost, fr.firstFreeze, fr.rare);
}
function growingAround(year, lat, fr, core, keep, next) {
    const seasons = isSouthern(lat) ? [year] : next ? [year - 1, year, year + 1] : [year - 1, year];
    return new Set(seasons.flatMap((s) => seasonGrowing(s, lat, fr, core, keep)));
}
function growsInMonth(bundle, ctx, year, m0, keep = () => true) {
    if (ctx.lat == null || ctx.lon == null)
        return false;
    const lat = ctx.lat, k = ym(year, m0 + 1);
    const fr = gardenFrost(bundle, lat, ctx.lon, ctx.seasons);
    return growingAround(seasonYearOf(`${k}-01`, lat), lat, fr, (y) => gardenCoreShared(bundle, y, ctx), keep, false).has(k);
}
function waterNow(tasks, todayIso) {
    const order = ["R-175", "R-174", "R-173"];
    return tasks.filter((t) => t.kind === "water_marker" && t.date <= todayIso && !!t.runEnd && todayIso <= t.runEnd)
        .sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule));
}
let calOtherGardens = null;
let calGardensBuiltFor = null;
let calGardensLoading = false;
const calGardenNames = new Map();
const calGardenKeys = new Map();
function yearViewMonths(calYear, calMonth, lat) {
    if (!isSouthern(lat))
        return { months: Array.from({ length: 12 }, (_, m) => ({ y: calYear, m })), label: String(calYear), years: [calYear] };
    const s = calMonth >= 6 ? calYear : calYear - 1;
    return { months: Array.from({ length: 12 }, (_, k) => ({ y: k < 6 ? s : s + 1, m: (k + 6) % 12 })), label: `${s}–${String(s + 1).slice(2)}`, years: [s, s + 1] };
}
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const isWindowEnd = (t) => t.windowEnd === true;
const takesTeamWindow = (t) => t.kind === "install_support";
function teamWindow(t) {
    const out = {};
    for (const k of ["closeBy", "closeFreeze", "closeLine", "closeOdds", "closeAfter", "dtmMin", "lastFrost", "fits", "noHardFreeze", "autumnNext"]) {
        if (t[k] !== undefined)
            copyField(out, t, k);
    }
    return out;
}
function copyField(out, t, k) { out[k] = t[k]; }
function lateSentence(sentence, t, lang = appLang()) {
    const when = monthDay$1(t.date.slice(5));
    if (lang === "es") {
        return sentence
            .replace(/: hoy es la fecha mediana de la última helada/, `: la fecha mediana de la última helada fue el ${when}`)
            .replace(/^(Siembra o trasplanta .+?) ahora\. /, "$1. ")
            .replace(/^(Trasplanta o siembra .+?) ahora\. /, "$1. ")
            .replace(/^(Siembra .+?) ahora\. (Todos sus cultivos)/, "$1. $2")
            .replace(/^(Siembra .+? en semilleros bajo techo) ahora, /, "$1, ")
            .replace(/^La primera helada de otoño llega por estos días\. /, `La primera helada de otoño se esperaba hacia el ${when}. `);
    }
    return sentence
        .replace(/: today is the median last frost/, `: the median last frost was ${when}`)
        .replace(/^(Sow or set out .+?) now\. /, "$1. ")
        .replace(/^(Set out or sow .+?) now\. /, "$1. ")
        .replace(/^(Plant .+?) now\. (All its crops)/, "$1. $2")
        .replace(/^(Start .+? seeds indoors) now, /, "$1, ")
        .replace(/^First fall frost arrives around now\. /, `First fall frost was due around ${when}. `);
}
function taskSentence(t, bundle) {
    if (t.text)
        return t.text;
    if (t.kind === "plant_after_last_frost") {
        const team = t.guildName ?? copy.clThisTeam;
        return t.frost_risk_until ? fillCopy("clPlantTeamRisk", { team, date: monthDay$1(t.frost_risk_until) }) : fillCopy("clPlantTeam", { team });
    }
    if (t.kind === "plant_cold_hardy") {
        return plural("clPlantTeamHardy", Math.round((t.days_before_last_frost ?? 0) / 7), { team: t.guildName ?? copy.clThisTeam });
    }
    if (t.kind === "sow_climber") {
        return fillCopy("clSowClimber", { crop: commonName(bundle, t.species), days: String(t.lead_days), support: commonName(bundle, t.support) });
    }
    if (t.kind === "install_support") {
        return fillCopy("clSetSupport", { support: commonName(bundle, t.species) });
    }
    if (t.kind === "harvest_open") {
        const range = t.dtmRange && t.dtmRange[0] !== t.dtmRange[1] ? `${t.dtmRange[0]}–${t.dtmRange[1]}` : `${t.dtmRange?.[0]}`;
        const crop = plantingLabel(bundle, t.species, t.group ?? null);
        const base = t.dtmRange
            ? fillCopy("clHarvestReady", { crop, days: range })
            : fillCopy("clHarvestReadyNow", { crop });
        const said = t.pastFreeze
            ? fillCopy(t.closeLine ? "clHarvestPastFreezeHard" : "clHarvestPastFreeze", { base, date: monthDay$1(t.pastFreeze) })
            : base;
        const warm = t.approx ? `${said} ${fillCopy("clApproxWarmth", { crop: commonName(bundle, t.species) })}` : said;
        return t.coolApprox ? `${warm} ${floorApprox()}` : warm;
    }
    return copy.clFirstFreezeNow;
}
function frostAsk(n, min) {
    return fillCopy("clFrostAsk", { n, min, more: Math.max(1, min - n) });
}
function addDaysISO(isoDate, n) {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d)
        return null;
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function shiftDays(year, mmdd, n, lat = null, lead = false) {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = addDaysISO(seasonDate(mmdd, year, lat), n);
    if (!d)
        return null;
    return lead || isSouthern(lat) || d.slice(0, 4) === String(year) ? d : null;
}
const LEAD = ["start_indoors", "stratify_start", "cool_season", "plant_cold_hardy"];
const monthDay$1 = (mmdd) => {
    if (!mmdd)
        return "";
    const [mm, dd] = mmdd.split("-").map(Number);
    return mm && dd ? fillCopy("clMonthDay", { month: MONTHS[mm - 1].slice(0, 3), day: dd }) : mmdd;
};
function bedLocator(beds) {
    const perCall = (region) => {
        try {
            const r = parseRegion(region);
            const hits = beds.filter((b) => intersectArea(parseRegion(b.region), r) > 0);
            return (hits.find((b) => !bedHasSections(b.name, beds)) ?? hits[0])?.name;
        }
        catch {
            return undefined;
        }
    };
    let parsed;
    const containers = new Set();
    try {
        parsed = beds.map((b) => ({ name: b.name, r: parseRegion(b.region) }));
        for (const b of beds) {
            const p = sectionParentOf(b, beds);
            if (p !== null)
                containers.add(p);
        }
    }
    catch {
        return perCall;
    }
    return (region) => {
        try {
            const r = parseRegion(region);
            const hits = parsed.filter((b) => intersectArea(b.r, r) > 0);
            return (hits.find((b) => !containers.has(b.name)) ?? hits[0])?.name;
        }
        catch {
            return undefined;
        }
    };
}
function loggedEvents(bundle, ctx, keep) {
    const bedOf = bedLocator(ctx.beds);
    const out = [];
    let season;
    const add = (date, cat, text, species, bed, ended = false, act, label, endCause) => {
        if (date && keep(date, season))
            out.push({ date, kind: "logged", cat, text, species, bed, rule: "logged", tip: copy.clLoggedTip, ...(ended ? { ended } : {}),
                ...((act || endCause !== undefined) && label ? { groupPlants: [{ species, label, n: 1 }] } : {}),
                ...(act && label ? { act } : {}), ...(endCause !== undefined && label ? { endCause } : {}),
                of: season.id, ofDate: seasonYearOf(date, ctx.lat) });
    };
    for (season of ctx.seasons) {
        for (const pl of season.plantings ?? []) {
            const bed = bedOf(pl.region), s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
            const gone = !!(pl.end_cause || pl.end_date);
            add(pl.sown, "plant", fillCopy("clActSowed", { plants: s }), pl.species, bed, gone, "sowed", s);
            add(pl.transplanted, "plant", fillCopy("clActTransplanted", { plants: s }), pl.species, bed, gone, "transplanted", s);
            add(pl.first_harvest, "harvest", fillCopy("clActFirstHarvest", { plants: s }), pl.species, bed, gone, "first_harvest", s);
            add(pl.last_harvest, "harvest", fillCopy("clActLastHarvest", { plants: s }), pl.species, bed, gone, "last_harvest", s);
            if (pl.end_date) {
                const cause = endCausePhrase(pl.end_cause);
                add(pl.end_date, "ended", fillCopy("clEnded", { plant: s, cause }), pl.species, bed, false, undefined, s, cause);
            }
            for (const f of pl.failures ?? [])
                add(f.date, "ended", fillCopy("clFailure", { plant: s, mode: f.mode, severity: failureSeverityWord(f.severity) }), pl.species, bed);
            for (const n of pl.notes ?? [])
                add(n.date, "note", fillCopy("clNoteOn", { plant: s, text: n.text }), pl.species, bed);
        }
        for (const o of season.observations ?? []) {
            if (!o.date || !keep(o.date, season))
                continue;
            const label = o.event === "frost" ? (o.severity ? fillCopy("clFrostObservedSev", { severity: frostSeverityWord(o.severity) }) : copy.clFrostObserved) : copy.clHeatObserved;
            out.push({ date: o.date, kind: "logged", cat: "frost", species: null, rule: "logged",
                text: o.note ? fillCopy("clObsNote", { label, note: o.note }) : label,
                tip: copy.clObsTip });
        }
    }
    return out;
}
function roleSwaps(plan) {
    const m = new Map();
    const roles = plan?.roles;
    for (const r of (Array.isArray(roles) ? roles : [])) {
        if (typeof r.role === "string" && typeof r.species === "string")
            m.set(r.role, { species: r.species, group: typeof r.group === "string" ? r.group : null });
    }
    return m;
}
function swappedGuild(guild, swaps) {
    return swaps.size ? { ...guild, roles: (guild.roles ?? []).map((r) => {
            const ov = swaps.get(r.id);
            return ov ? { ...r, canonical: ov.species, canonical_group: ov.group } : r;
        }) } : guild;
}
function teamName(bundle, team, swaps) {
    const said = [];
    for (const r of team.roles ?? []) {
        const ov = swaps.get(r.id);
        const was = ov && typeof r.canonical === "string" ? plantingLabel(bundle, r.canonical, r.canonical_group ?? null) : "";
        const now = ov ? plantingLabel(bundle, ov.species, ov.group) : "";
        if (was && now && now !== was)
            said.push(fillCopy("clSwapIn", { crop: midSentence(now), was: midSentence(was) }));
    }
    return said.length ? fillCopy("clTeamSwapped", { team: displayName(team), swaps: listWords(said) }) : displayName(team);
}
function guildMemberRefs(guild) {
    const refs = [];
    for (const role of guild.roles ?? []) {
        const r = role;
        if (typeof r.canonical === "string")
            refs.push({ sid: r.canonical, group: typeof r.canonical_group === "string" ? r.canonical_group : null });
    }
    for (const m of guild.members ?? []) {
        if (typeof m.species === "string")
            refs.push({ sid: m.species, group: typeof m.group === "string" ? m.group : null });
    }
    return refs;
}
function dedupeRefs(refs) {
    const seen = new Set();
    const out = [];
    for (const r of refs) {
        const k = `${r.sid}|${r.group ?? ""}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(r);
    }
    return out;
}
function resolveFrostTolerance(sp, group) {
    if (group && Array.isArray(sp.cultivar_groups)) {
        const g = sp.cultivar_groups.find((cg) => cg.id === group);
        if (g && typeof g.frost_tolerance === "string")
            return g.frost_tolerance;
    }
    return typeof sp.frost_tolerance === "string" ? sp.frost_tolerance : undefined;
}
function frostToleranceDisputed(sp, group) {
    const contested = sp.confidence?.contested;
    const paths = Array.isArray(contested) ? contested.map(String) : [];
    if (group && Array.isArray(sp.cultivar_groups)) {
        const g = sp.cultivar_groups.find((cg) => cg.id === group);
        if (g && typeof g.frost_tolerance === "string")
            return paths.includes(`cultivar_groups.${group}.frost_tolerance`);
    }
    return paths.includes("frost_tolerance");
}
function resolveDtm(sp, group) {
    const asRange = (d) => typeof d === "number" && Number.isFinite(d) ? [d, d]
        : Array.isArray(d) && typeof d[0] === "number" ? [d[0], d[d.length - 1]] : null;
    const groups = sp.cultivar_groups;
    if (group && Array.isArray(groups)) {
        const g = groups.find((cg) => cg.id === group);
        const r = g && asRange(g.days_to_maturity);
        if (r)
            return r;
    }
    const own = asRange(sp.days_to_maturity);
    if (own)
        return own;
    if (Array.isArray(groups)) {
        const ranges = groups
            .map((g) => asRange(g.days_to_maturity)).filter((r) => !!r);
        if (ranges.length)
            return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
    }
    return null;
}
const schedulingModel = (sp, group) => resolvedField(sp, group, "scheduling_model");
const datedByDays = (sp, group) => {
    const m = schedulingModel(sp, group);
    return m === "dtm" || m === "gdd";
};
const approxDays = (sp, group) => schedulingModel(sp, group) === "gdd";
function frostTender(sp, group) {
    if (!sp)
        return false;
    const groups = Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : [];
    const g = group ? groups.find((cg) => cg.id === group) : undefined;
    const ft = g && g.frost_tolerance != null ? g.frost_tolerance : sp.frost_tolerance;
    return ft === "tender" || ft === "very_tender";
}
function frostCutClose(opens, closes, freezeIso, tender) {
    if (!tender || !freezeIso || closes <= freezeIso)
        return closes;
    return freezeIso > opens ? freezeIso : opens;
}
const windowFreeze = (fr, lat, bundle) => {
    const mmdd = fr?.firstFreeze ?? fr?.lateFreeze?.mmdd ?? null;
    return fr && mmdd ? { mmdd, lat: lat ?? null, ...(bundle ? { of: (sid, group) => cropCutOf(fr, sid, group, bundle) } : {}) }
        : fr?.site ? { mmdd: fr.rare ? givenFirstFrost(fr.site) : null, lat: lat ?? null, none: true } : null;
};
function cropCutOf(fr, sid, group, bundle) {
    const c = cropCloseOf(fr, sid, group, bundle);
    if (!c)
        return null;
    const sp = bundle.species.find((x) => x.id === sid);
    const hardy = inScope(resolveSpecies(sid, group, bundle), bundle.rules.find((r) => r.id === "R-188"));
    return { ...c, cuts: frostTender(sp, group) || hardy };
}
function harvestSpanOf(sp, group) {
    if (!sp)
        return null;
    const groups = Array.isArray(sp.cultivar_groups) ? sp.cultivar_groups : [];
    const g = group ? groups.find((cg) => cg.id === group) : undefined;
    const v = g && g.harvest_span_days != null ? g.harvest_span_days : sp.harvest_span_days;
    return Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" ? [v[0], v[1]] : null;
}
function plantingWindow(pl, sp, freeze) {
    const anchor = pl.transplanted || pl.sown;
    if (!anchor || !sp || !datedByDays(sp, pl.cultivar_group))
        return null;
    const dtm = resolveDtm(sp, pl.cultivar_group);
    if (!dtm)
        return null;
    const opens = addDaysISO(anchor, dtm[0]);
    const span = harvestSpanOf(sp, pl.cultivar_group);
    const byDtm = addDaysISO(anchor, Math.max(dtm[0], dtm[1]));
    const bySpan = span && opens ? addDaysISO(opens, span[1]) : null;
    const byDays = bySpan && byDtm && bySpan > byDtm ? bySpan : byDtm;
    if (!opens || !byDays)
        return null;
    const own = freeze?.of && pl.species ? freeze.of(pl.species, pl.cultivar_group ?? null) : undefined;
    const cutMmdd = own === undefined ? freeze?.mmdd ?? null : own?.cuts ? own.mmdd : null;
    const cuts = own === undefined ? frostTender(sp, pl.cultivar_group) : !!own?.cuts;
    const freezeIso = cutMmdd && freeze ? fallDate(cutMmdd, seasonYearOf(anchor, freeze.lat), freeze.lat) : null;
    if (freeze?.none) {
        const end = seasonBounds(seasonYearOf(anchor, freeze.lat), freeze.lat).end;
        const run = byDays > end ? byDays : end, closes = frostCutClose(opens, run, freezeIso, cuts);
        return { anchor, opens, closes, dtm, approx: approxDays(sp, pl.cultivar_group), frostCut: closes !== run, open: closes === run };
    }
    const closes = frostCutClose(opens, byDays, freezeIso, cuts);
    return { anchor, opens, closes, dtm, approx: approxDays(sp, pl.cultivar_group), frostCut: closes !== byDays, open: false };
}
function currentGardenCtx() {
    return { plotId: app.currentPlotId, name: calGardenNames.get(app.currentPlotId) ?? copy.clThisGarden,
        lat: num("lat"), lon: num("lon"), seasons: app.logSnapshot.seasons, seasonId: seasonId(), beds: app.logSnapshot.beds };
}
const keptForSpring = (ctx, e) => ctx.plotId === app.currentPlotId && !!e.area
    && app.bedPlantWindow?.(e.area)?.status === "passed";
function monthRain(bundle, year, m0, keep = () => true) {
    const ctx = currentGardenCtx();
    if (ctx.lat == null || ctx.lon == null)
        return null;
    if (ctx.beds.length && ctx.beds.every((b) => b.rain === "covered" || b.rain === "indoors"))
        return null;
    const fr = gardenFrost(bundle, ctx.lat, ctx.lon, ctx.seasons);
    if (!fr.site)
        return null;
    if (!growsInMonth(bundle, ctx, year, m0, keep))
        return null;
    return waterMonthsFor(fr.site, bundle).rain.find((r) => r.month === m0 + 1) ?? null;
}
function monthDryOnly(bundle, year, m0, keep = () => true) {
    const ctx = currentGardenCtx();
    if (ctx.lat == null || ctx.lon == null)
        return null;
    if (ctx.beds.length && ctx.beds.every((b) => b.rain === "covered" || b.rain === "indoors"))
        return null;
    const fr = gardenFrost(bundle, ctx.lat, ctx.lon, ctx.seasons);
    if (!fr.site)
        return null;
    const w = waterMonthsFor(fr.site, bundle);
    if (w.rain.length || !w.dry.includes(m0 + 1))
        return null;
    const week = bundle.rules.find((r) => r.id === "R-174")?.trigger?.week_need_mm;
    if (typeof week !== "number")
        return null;
    if (!growsInMonth(bundle, ctx, year, m0, keep))
        return null;
    return week * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m0] / 7;
}
function gardenWideTasks(bundle, year) {
    const out = tasksForYear(bundle, year, currentGardenCtx());
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        out.push(...extra.filter((t) => typeof t.date === "string" && t.date.startsWith(String(year))));
    }
    return out;
}
function tasksForYear(bundle, year, ctx) {
    return yearTasks(bundle, year, ctx, gardenTasksFor);
}
function yearTasks(bundle, year, ctx, get, from = "") {
    const yr = String(year), inYr = (t) => typeof t.date === "string" && t.date.startsWith(yr);
    const by = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : 1);
    const since = (t) => !from || typeof t.date !== "string" || t.date >= from;
    if (isSouthern(ctx.lat))
        return southWarmOnce([...get(bundle, year - 1, ctx), ...get(bundle, year, ctx)].filter(since)).filter(inYr).sort(by);
    const own = get(bundle, year, ctx), plant = own.find((t) => isTeamPlantJob(t.kind));
    const next = plant && plant.date > `${yr}-04` ? [] : get(bundle, year + 1, ctx).filter((t) => LEAD.includes(t.kind) && inYr(t));
    const stray = (t) => LEAD.includes(t.kind) && !inYr(t);
    return next.length || own.some(stray) ? [...own.filter((t) => !stray(t)), ...next].sort(by) : own;
}
function southWarmOnce(tasks) {
    const first = new Map();
    const keyOf = (t) => `${t.plotId ?? ""}|${t.bed ?? ""}|${t.species ?? ""}|${t.group ?? ""}|${t.closeBy}`;
    for (const t of tasks)
        if (warmOnce(t) && t.closeBy) {
            const k = keyOf(t), d = first.get(k);
            if (!d || t.date < d)
                first.set(k, t.date);
        }
    return tasks.filter((t) => !warmOnce(t) || !t.closeBy || first.get(keyOf(t)) === t.date);
}
const warmOnce = (t) => t.kind === "warm_window" || (t.kind === "install_support" && !t.closeFreeze);
function oneWarmWindow(tasks) {
    const keyOf = (t) => `${t.plotId ?? ""}|${t.bed ?? ""}|${t.species ?? ""}|${t.group ?? ""}|${t.rule}|${t.closeBy}|${t.coming ?? ""}`;
    const first = new Map();
    for (const t of tasks) {
        if (!warmOnce(t) || !t.closeBy)
            continue;
        const k = keyOf(t), cur = first.get(k);
        if (!cur || t.date < cur.date)
            first.set(k, t);
    }
    return tasks.filter((t) => !warmOnce(t) || !t.closeBy || first.get(keyOf(t)) === t);
}
const objIds = new WeakMap();
let nextObjId = 1;
const objId = (o) => {
    if (!o || typeof o !== "object")
        return 0;
    let id = objIds.get(o);
    if (id === undefined) {
        id = nextObjId++;
        objIds.set(o, id);
    }
    return id;
};
const TASK_MEMO_MAX = 24;
const taskMemo = new Map();
function gardenTasksKey(bundle, year, ctx) {
    const active = ctx.plotId === app.currentPlotId;
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    const plan = open && Array.isArray(open.plan) ? open.plan : [];
    const kept = active ? plan.map((e) => (e.area ? app.bedPlantWindow?.(e.area)?.status ?? "" : "")) : [];
    const b = bundle;
    return JSON.stringify([year, ctx.plotId, ctx.name, ctx.lat, ctx.lon, ctx.seasonId, active, kept, TODAY_ISO(),
        appLang(), unitSystem(), objId(bundle), objId(b.species), objId(b.guilds), objId(b.rules), objId(b.entities),
        objId(b.climate), objId(b.climate?.sites), objId(b.global_frost), b._zipEpoch ?? 0,
        gardenCountryAt(ctx.lat, ctx.lon),
        ownFrostAt(ctx.lat, ctx.lon) ?? null,
        app.userSpecies, ctx.seasons, ctx.beds]);
}
const copyTasks = (list) => list.map((t) => ({ ...t }));
const coreMemo = new Map();
const memoGet = (memo, key, build) => {
    let hit = memo.get(key);
    if (hit) {
        memo.delete(key);
        memo.set(key, hit);
        return hit;
    }
    hit = build();
    memo.set(key, hit);
    while (memo.size > TASK_MEMO_MAX)
        memo.delete(memo.keys().next().value);
    return hit;
};
function gardenCoreShared(bundle, year, ctx) {
    if (ctx.lat == null || ctx.lon == null)
        return [];
    return memoGet(coreMemo, gardenTasksKey(bundle, year, ctx), () => buildCore(bundle, year, ctx));
}
function gardenTasksShared(bundle, year, ctx) {
    if (ctx.lat == null || ctx.lon == null)
        return [];
    return memoGet(taskMemo, gardenTasksKey(bundle, year, ctx), () => finishBuild(bundle, year, ctx, copyTasks(gardenCoreShared(bundle, year, ctx)), (y) => gardenCoreShared(bundle, y, ctx)));
}
function gardenTasksFor(bundle, year, ctx) {
    return copyTasks(gardenTasksShared(bundle, year, ctx));
}
function comingSeasonTasks(bundle, last, next, ctx = currentGardenCtx()) {
    const coming = seedNextPlan(last, { id: next, plot: ctx.plotId, plantings: [], observations: [] });
    return gardenTasksFor(bundle, next, { ...ctx, plotId: `${ctx.plotId}#coming`, seasonId: next,
        seasons: [...ctx.seasons.filter((s) => s.id !== next), coming] });
}
function comingTasksForYear(bundle, year, ctx) {
    if (!ctx.seasons.length)
        return [];
    const last = ctx.seasons.find((s) => s.id === ctx.seasonId) ?? ctx.seasons.reduce((a, b) => (a.id >= b.id ? a : b));
    const kept = new Set((last.closed_date || last.id !== ctx.seasonId || !Array.isArray(last.plan) ? [] : last.plan)
        .filter((e) => keptForSpring(ctx, e)).map((e) => e.area));
    const next = new Set((last.next_plan ?? []).map((e) => e.year).filter((y) => typeof y === "number" && y > last.id && Math.abs(y - year) <= 1 && !ctx.seasons.some((s) => s.id === y)));
    const keptIn = kept.size ? gardenSeasonAfter(bundle, last.id, ctx.seasons, TODAY_ISO(), ctx.lat, ctx.lon) : null;
    return [...next].flatMap((n) => comingSeasonTasks(bundle, last, n, ctx)
        .filter((t) => !!t.guildName && t.date.startsWith(String(year)) && !(n === keptIn && kept.has(t.bed)))
        .map((t) => ({ ...t, coming: n })));
}
function gardenSeasonAfter(bundle, id, seasons, todayIso, lat, lon) {
    const freeze = lat != null && lon != null ? gardenFrost(bundle, lat, lon, seasons).firstFreeze : null;
    return seasonAfter(id, seasons, todayIso, lat ?? null, freeze);
}
function gardenFrost(bundle, lat, lon, seasons) {
    const clim = scheduleClimate(lat, lon, bundle);
    const ownCal = clim || !app.climateSettled?.(lat, lon) ? null : frostCalibration(seasons, null, lat);
    const own = ownCal ? ownFrostSite(ownCal, lat, lon) : null;
    const site = clim?.site ?? own;
    const cal = clim ? frostCalibration(seasons, clim.site) : own ? ownCal : null;
    const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
    const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
    const rare = frostRare(site);
    const modelLf0 = (site?.last_frost_32f ?? {}).p50 ?? null;
    const firstFreeze = fallObs ?? (rare ? null : site?.first_freeze_32f_p50) ?? null;
    const late = firstFreeze || rare ? null : site?.late_fall_frost ?? null;
    const lastPlan = springObs ?? modelLf0;
    const lateFreeze = !late ? null : late.days != null
        ? (lastPlan ? { ...late, mmdd: (addDaysISO(`2001-${lastPlan}`, late.days) ?? "").slice(5) } : null) : late;
    const closeFreeze = firstFreeze ?? lateFreeze?.mmdd ?? null;
    const f28 = own ? null : fallObs ? shiftFreezeLine(site?.first_freeze_28f ?? null, rare ? null : site?.first_freeze_32f_p50, fallObs)
        : site?.first_freeze_28f ?? null;
    return {
        clim, site, cal, rare,
        lastFrost: springObs ?? modelLf0,
        firstFreeze,
        springOwn: !!springObs, fallOwn: !!fallObs, ownRecord: !!own,
        springGiven: !springObs && !!site?.own_window?.last, fallGiven: !fallObs && !!site?.own_window?.first,
        springShiftDays: springObs && modelLf0 ? (mmddDoy(springObs) ?? 0) - (mmddDoy(modelLf0) ?? 0) : 0,
        freezeSite: { first_freeze_32f_p50: closeFreeze, first_freeze_28f: closeFreeze ? f28 : null },
        lateFreeze,
    };
}
function cropCloseOf(fr, sid, group, bundle) {
    if (!fr?.freezeSite.first_freeze_32f_p50)
        return null;
    const f = cropFreeze(fr.freezeSite, group ? `${sid}/${group}` : sid, bundle);
    return f.mmdd ? { mmdd: f.mmdd, line: f.line_f } : null;
}
function cropOpenOf(fr, sid, group, bundle) {
    if (!fr?.freezeSite.first_freeze_32f_p50)
        return null;
    const f = cropFreeze(fr.freezeSite, group ? `${sid}/${group}` : sid, bundle);
    return !f.mmdd && !f.counted && f.line_f < 32 ? f.line_f : null;
}
function warmPlanTasks(bundle, year, lat, site, area, memberRefs, guild, guildName, outdoors, today = TODAY_ISO()) {
    const out = [];
    const speciesById = new Map(bundle.species.map((s) => [s.id, s]));
    const seen = new Set();
    const refs = memberRefs.filter(({ sid, group }) => { const k = `${sid}|${group ?? ""}`; if (seen.has(k))
        return false; seen.add(k); return true; });
    const keyOf = (sid, group) => (group ? `${sid}/${group}` : sid);
    const windows = warmthWindowsFor(site, lat, refs.map((r) => keyOf(r.sid, r.group)), bundle);
    const gate = frostGate(site);
    const season = seasonBounds(year, lat);
    const over = today > season.end;
    const jobDay = (o) => {
        const d = o.start < season.start ? season.start : o.start;
        return d < today && today <= o.end && today <= season.end ? today : d;
    };
    const sowings = (r, after, days, before = null) => runOccurrences(r, year, lat, after).map((o) => {
        const by = (b) => (r.len === 12 || days == null ? o.end : sowByOf(o, days, b)), end = by(before);
        return { start: o.start, runEnd: o.end, end, frost: end !== by(null) };
    }).filter((o) => o.end >= season.start);
    const daysOf = (sid, group) => fewestDays(resolveSpecies(sid, group, bundle).days_to_maturity);
    const lead = guild ? livingSupportLead(guild, bundle) : null;
    const leadDays = lead?.lead_days ?? 0;
    const supportStarts = [];
    if (lead && leadDays > 0) {
        const sref = refs.find((r) => r.sid === lead.support);
        const sw = sref ? windows[keyOf(sref.sid, sref.group)] : undefined;
        if (sw)
            for (const r of monthRuns(sw.months))
                for (const o of sowings(r, sw.after, daysOf(sref.sid, sref.group), sw.before))
                    supportStarts.push(jobDay(o));
    }
    for (const { sid, group } of refs) {
        const w = windows[keyOf(sid, group)];
        const sp = speciesById.get(sid);
        if (!w || !w.months.length || !sp)
            continue;
        const lim = resolveSpecies(sid, group, bundle).month_mean_temp_c;
        const label = plantingLabel(bundle, sid, group) || humanize(sid);
        const dtm = datedByDays(sp, group) ? resolveDtm(sp, group) : null;
        const tip = fillCopy(warmTipKey(site, !!w.care), { crop: label, min: fmtTemp(lim.min), max: fmtTemp(lim.max) });
        const succ = sp.succession_interval_days;
        const interval = Array.isArray(succ) && typeof succ[0] === "number" ? succ : sp.bolt_risk ? [21, 21] : null;
        const cadence = interval ? (interval[0] === interval[1] ? fillCopy("clCadence", { n: interval[0] }) : fillCopy("clCadenceRange", { lo: interval[0], hi: interval[1] })) : "";
        const pause = new Set(outdoors ? heatPauseMonths(site, lat, sid, bundle) : []);
        const climber = !!lead && leadDays > 0 && lead.climber === sid;
        const days = daysOf(sid, group);
        let resows = 0;
        const starts = monthRuns(w.months).flatMap((r) => runOccurrences(r, year, lat, w.after).map((o) => o.start)).sort();
        for (const r of monthRuns(w.months)) {
            const allYear = r.len === 12;
            const when = runWords(r, { days, after: w.after, year, lat, before: w.before });
            const next = allYear ? undefined : nextOpening(w.months, r.to) ?? r.from;
            for (const occ of sowings(r, w.after, days, w.before)) {
                const reopen = allYear ? undefined : starts.find((s) => s > occ.runEnd);
                let date = jobDay(occ);
                const sownToday = date === today && occ.start < today;
                let opensOn = occ.start < season.start ? season.start : occ.start;
                let climbNote = "";
                if (climber) {
                    const stalk = supportStarts.filter((s) => s <= occ.end).sort().pop();
                    const after = stalk ? addDaysISO(stalk, leadDays) : null;
                    if (after && after > date && after <= occ.end)
                        date = after;
                    if (after && after > opensOn && after <= occ.end)
                        opensOn = after;
                    climbNote = ` ${fillCopy("clSowClimber", { crop: label, days: String(leadDays), support: commonName(bundle, lead.support) })}`;
                }
                let text = (when ? fillCopy("clWarmSow", { crop: label, when }) : fillCopy("clWarmSowAll", { crop: label })) + climbNote;
                if (allYear && interval)
                    text += ` ${plural("clWarmResow", Math.max(1, Math.round(interval[0] / 7)))}`;
                if (w.care)
                    text += ` ${fillCopy("clWarmCare", { crop: label })}`;
                if (w.after && gate && date.slice(5) === w.after)
                    text += ` ${givenFrostGate(site) ? fillCopy("clWarmAfterGiven", { date: monthDay$1(w.after) })
                        : plural("clWarmAfter", gateTenths(gate.pct), { date: monthDay$1(w.after) })}`;
                if (occ.frost)
                    text += ` ${fillCopy("clWarmBeforeGiven", { date: monthDay$1(w.before) })}`;
                out.push({ date, kind: "warm_window", cat: "sow", rule: "R-183", species: sid, group, bed: area, guildName, text, tip,
                    closeBy: occ.end, ...(allYear ? {} : { warmNext: next }), ...(reopen ? { warmReopen: reopen } : {}), ...(dtm ? { dtmMin: dtm[0] } : {}),
                    ...(opensOn < date ? { opensOn } : {}) });
                if (interval && dtm) {
                    const from = sownToday ? date : occ.start;
                    for (let k = 1; resows < 24; k++) {
                        const sd = addDaysISO(from, interval[0] * k);
                        if (!sd || sd > occ.end || sd > season.end)
                            break;
                        if (sd <= date)
                            continue;
                        const ready = addDaysISO(sd, dtm[0]);
                        if (ready && pause.has(Number(ready.slice(5, 7))))
                            continue;
                        resows++;
                        out.push({ date: sd, kind: "succession", cat: "sow", rule: "R-034", species: sid, group, bed: area, guildName, anchor: "planned",
                            text: fillCopy("clSowMore", { crop: label, cadence }), cadence, every: interval[0], tip: fillCopy("clSuccTipWarm", { crop: label }),
                            closeBy: occ.end, ...(allYear ? {} : { warmNext: next }), dtmMin: dtm[0] });
                    }
                }
                if (dtm && (over ? occ.start >= season.start : date >= today && (occ.start >= season.start || today >= season.start))) {
                    const opens = addDaysISO(date, dtm[0]);
                    const byDays = addDaysISO(date, Math.max(dtm[0], dtm[1]));
                    const closes = frostCutClose(opens ?? date, byDays && byDays > season.end ? byDays : season.end, w.before && nextOn(w.before, date), true);
                    if (opens)
                        out.push({ date: opens, kind: "harvest_open", rule: "days-to-maturity", species: sid, group, bed: area, guildName,
                            dtmRange: [dtm[0], dtm[1]], anchor: "planned", ...(closes ? { windowCloses: closes } : {}), ...(approxDays(sp, group) ? { approx: true } : {}) });
                }
            }
        }
    }
    const r187 = [].concat(bundle.rules.find((r) => r.id === "R-187")?.applies_to?.species ?? []);
    const rains = r187.length ? rainsBeginFor(site, bundle) : null;
    if (rains?.month) {
        const mm = String(rains.month).padStart(2, "0");
        const first = seasonDate(`${mm}-01`, year, lat);
        const end = new Date(Date.UTC(Number(first.slice(0, 4)), rains.month, 0)).toISOString().slice(0, 10);
        const date = jobDay({ start: first, end });
        for (const { sid, group } of refs) {
            if (!r187.includes(sid) || windows[keyOf(sid, group)])
                continue;
            const label = plantingLabel(bundle, sid, group) || humanize(sid);
            out.push({ date, kind: "warm_window", cat: "plant", rule: "R-187", species: sid, group, bed: area, guildName,
                text: fillCopy("clRainsPlant", { crop: label, month: monthLong(rains.month - 1) }), tip: copy.clRainsTip, closeBy: end });
        }
    }
    if (guild) {
        const sows = out.filter((t) => t.kind === "warm_window" && !!t.closeBy).sort((a, b) => a.date.localeCompare(b.date));
        const structure = sows.length ? (guild.roles ?? []).flatMap((role) => [role.canonical, role.substitute])
            .find((s) => typeof s === "string" && (bundle.entities ?? []).some((e) => e.id === s && e.entity_class === "structure")) : undefined;
        if (typeof structure === "string") {
            const runs = [];
            for (const t of sows) {
                const cur = runs[runs.length - 1];
                if (cur && t.date <= cur.closeBy) {
                    if (t.closeBy > cur.closeBy) {
                        cur.closeBy = t.closeBy;
                        cur.warmNext = t.warmNext;
                    }
                }
                else
                    runs.push({ date: t.date, opens: t.opensOn ?? t.date, closeBy: t.closeBy, warmNext: t.warmNext });
            }
            runs.forEach((r, i) => out.push({ date: r.date, kind: "install_support", rule: "R-040", species: structure, bed: area, guildName,
                closeBy: r.closeBy, ...(r.warmNext ? { warmNext: r.warmNext } : {}), ...(runs[i + 1] ? { warmReopen: runs[i + 1].opens } : {}) }));
        }
    }
    return out;
}
function unfitOf(bundle, beds, plan) {
    const team = plan.guild ? bundle.guilds.find((g) => g.id === plan.guild) : undefined;
    const bed = team && plan.area ? beds.find((b) => b.name === plan.area) : undefined;
    if (!team || !bed)
        return null;
    const st = bedTeamStatus(team, bed, bundle);
    if (st.fits)
        return null;
    const needs = Number(team.footprint_min_m2 || 0), has = area(parseRegion(bed.region));
    const cause = st.spaceFits === false ? (needs > has + 1e-9 ? "space" : "shape") : st.reason?.ruleId === "R-098" ? "mound" : "ground";
    return { bed: bed.name, guild: team.id, team: teamName(bundle, team, roleSwaps(plan)), cause, needs, has,
        offer: st.offer ? { id: st.offer.id, name: displayName(st.offer) } : null };
}
function unfitPlan(bundle, ctx) {
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    if (!open || open.closed_date || !Array.isArray(open.plan))
        return [];
    return open.plan.map((e) => unfitOf(bundle, ctx.beds, e)).filter((u) => !!u);
}
function undatedPlan(bundle, ctx) {
    const none = { place: null, crops: [], beds: [] };
    const lat = ctx.lat, lon = ctx.lon;
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    if (lat == null || lon == null || !open || open.closed_date || !Array.isArray(open.plan))
        return none;
    const beds = [];
    for (const plan of open.plan) {
        if (!plan.area || unfitOf(bundle, ctx.beds, plan))
            continue;
        const team = bundle.guilds.find((g) => g.id === plan.guild);
        const guild = team && swappedGuild(team, roleSwaps(plan));
        const mine = !guild && plan.mybed === true && Array.isArray(plan.plantings) ? plan.plantings : null;
        if (!guild && !mine)
            continue;
        beds.push({ bed: plan.area, refs: guild ? dedupeRefs(guildMemberRefs(guild)) : dedupeRefs((mine ?? []).map((p) => ({ sid: p.species, group: p.cultivar_group ?? null }))) });
    }
    if (!beds.length)
        return none;
    const names = beds.map((b) => b.bed);
    const fr = gardenFrost(bundle, lat, lon, ctx.seasons);
    if (!fr.site)
        return app.climateSettled?.(lat, lon) && !fr.lastFrost && !fr.firstFreeze ? { place: "nosite", crops: [], beds: names } : none;
    if (!onWarmthPath(fr.site, fr.springOwn || fr.ownRecord))
        return { ...none, beds: names };
    if (fr.site.temps === "months_only")
        return { place: "held", crops: [], beds: names };
    const keyOf = (r) => (r.group ? `${r.sid}/${r.group}` : r.sid);
    const windows = warmthWindowsFor(fr.site, lat, beds.flatMap((b) => b.refs.map(keyOf)), bundle);
    const r187 = [].concat(bundle.rules.find((r) => r.id === "R-187")?.applies_to?.species ?? []);
    const rains = r187.length ? rainsBeginFor(fr.site, bundle) : null;
    const crops = [];
    for (const b of beds)
        for (const r of b.refs) {
            if (!bundle.species.some((s) => s.id === r.sid))
                continue;
            const w = windows[keyOf(r)];
            if (w?.months.length)
                continue;
            if (!w && r187.includes(r.sid) && rains)
                continue;
            crops.push({ bed: b.bed, species: r.sid, group: r.group, label: plantingLabel(bundle, r.sid, r.group) || humanize(r.sid), why: w ? "norun" : "nolimit" });
        }
    return { place: null, crops, beds: names };
}
function floorPlan(bundle, ctx) {
    const lat = ctx.lat, lon = ctx.lon;
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    const rule = warmthFloorRule(bundle);
    if (lat == null || lon == null || !open || open.closed_date || !Array.isArray(open.plan) || !rule)
        return [];
    const fr = gardenFrost(bundle, lat, lon, ctx.seasons);
    if (!fr.site || onWarmthPath(fr.site, fr.springOwn || fr.ownRecord))
        return [];
    const indoor = new Set(ctx.beds.filter((b) => b.rain === "indoors").map((b) => b.name));
    const out = [];
    for (const plan of open.plan) {
        if (!plan.area || indoor.has(plan.area))
            continue;
        if (unfitOf(bundle, ctx.beds, plan))
            continue;
        const team = bundle.guilds.find((g) => g.id === plan.guild);
        const guild = team && swappedGuild(team, roleSwaps(plan));
        const mine = !guild && plan.mybed === true && Array.isArray(plan.plantings) ? plan.plantings : null;
        if (!guild && !mine)
            continue;
        const refs = guild ? dedupeRefs(guildMemberRefs(guild)) : dedupeRefs((mine ?? []).map((p) => ({ sid: p.species, group: p.cultivar_group ?? null })));
        for (const r of refs) {
            if (!bundle.species.some((s) => s.id === r.sid))
                continue;
            const say = floorSay(warmthFloorFor(fr.site, r.group ? `${r.sid}/${r.group}` : r.sid, bundle, rule));
            if (say)
                out.push({ bed: plan.area, species: r.sid, group: r.group, label: plantingLabel(bundle, r.sid, r.group) || humanize(r.sid), say });
        }
    }
    return out;
}
function finishBuild(bundle, year, ctx, out, core) {
    out.push(...seasonWater(bundle, year, ctx, core));
    const tracking = ctx.seasons.find((x) => x.id === ctx.seasonId);
    const aside = setAsideKeys(tracking);
    for (const t of out) {
        t.garden = ctx.name;
        t.plotId = ctx.plotId;
        if (t.of == null && t.kind !== "logged")
            t.of = year;
        if (tracking && canSetAside(t)) {
            t.season = tracking.id;
            if (aside.has(jobKey(t)))
                t.setAside = true;
        }
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : 1));
    return out;
}
function buildCore(bundle, year, ctx) {
    const lat = ctx.lat, lon = ctx.lon;
    if (lat == null || lon == null)
        return [];
    const out = [];
    const speciesById = new Map(bundle.species.map((s) => [s.id, s]));
    const indoorBeds = new Set(ctx.beds.filter((b) => b.rain === "indoors").map((b) => b.name));
    const outdoorBed = (name) => !name || !indoorBeds.has(name);
    const r096 = bundle.rules.find((r) => r.id === "R-096");
    const coolOffsets = (r096?.offset_days_before_last_frost ?? null);
    const r162 = bundle.rules.find((r) => r.id === "R-162");
    const stratifyLead = Number(r162?.trigger?.stratify_lead_days) || 0;
    const r171 = bundle.rules.find((r) => r.id === "R-171");
    const warmWait = Number(r171?.offset_days_after_last_frost) || 0;
    const fr = gardenFrost(bundle, lat, lon, ctx.seasons);
    const clim = fr.clim;
    const site = fr.site;
    const stnName = clim?.site.provenance?.station?.name;
    const prov = clim && clim.distanceKm > 2 && stnName
        ? " " + fillCopy("clNearestStation", { station: stationDisplay(stnName), dist: fmtKm(clim.distanceKm), word: confidenceWord(clim.effectiveGrade) ?? copy.clUnrated })
        : "";
    const givenTip = (est) => (est ? fillCopy("clGivenTip", { date: monthDay$1(est) }) : clim ? copy.clGivenTipNoDate : copy.clGivenTipNone);
    const est = clim?.model ?? clim;
    const gw = est ? (confidenceWord(est.effectiveGrade) ?? copy.clUnrated).toLowerCase() : "";
    const stationTip = (est && stationMarkerTip(est, gw))
        ?? (frostDatesModelled(est?.site) ? fillCopy("clModelTip", { dist: fmtKm(est.distanceKm), word: gw }) : copy.clStationTip);
    const cal = fr.cal;
    const springObs = fr.springOwn ? fr.lastFrost : null;
    const fallObs = fr.fallOwn ? fr.firstFreeze : null;
    const rare = fr.rare;
    const warmPath = onWarmthPath(site, fr.springOwn || fr.ownRecord);
    const freezeMmdd = fr.firstFreeze;
    const givenFirst = rare && !fallObs ? givenFirstFrost(site) : null;
    const closeMmdd = freezeMmdd ?? fr.lateFreeze?.mmdd ?? null;
    const lateOdds = freezeMmdd || !fr.lateFreeze ? {}
        : fr.lateFreeze.in_ten ? { closeOdds: fr.lateFreeze.in_ten } : fr.lateFreeze.days != null ? { closeAfter: fr.lateFreeze.days } : {};
    const lateWord = freezeMmdd || !fr.lateFreeze ? null : freezeWord({ closeFreeze: fr.lateFreeze.mmdd, ...lateOdds });
    const modelLf0 = (site?.last_frost_32f ?? {}).p50 ?? null;
    const springShiftDays = fr.springShiftDays;
    if (site) {
        const lf10 = (site.last_frost_32f ?? {}).p10;
        const lf = springObs ?? modelLf0;
        const ff = fallObs ?? (rare && !fr.fallGiven ? null : site.first_freeze_32f_p50);
        const springAsk = cal && !cal.spring.calibrated && cal.spring.n > 0
            ? " " + frostAsk(cal.spring.n, cal.min_seasons)
            : "";
        const fallAsk = cal && !cal.fall.calibrated && cal.fall.n > 0
            ? " " + frostAsk(cal.fall.n, cal.min_seasons)
            : "";
        if (lf)
            out.push({ date: `${year}-${lf}`, kind: "log_first_freeze", cat: "frost", rule: "R-031", species: null,
                text: springObs
                    ? fillCopy(fr.ownRecord ? "clLastFrostOwn" : "clLastFrostObserved", { n: cal.spring.n })
                    : fr.springGiven ? copy.clLastFrostGiven + springAsk
                        : rare
                            ? (frostSomeWinters(site)
                                ? (lf10 ? fillCopy("clFrostSomeLate", { date: monthDay$1(lf10) }) : copy.clFrostSome)
                                : (lf10 ? fillCopy("clFrostRareLate", { date: monthDay$1(lf10) }) : copy.clFrostRare)) + springAsk
                            : (lf10 ? fillCopy("clLastFrostMedianLate", { date: monthDay$1(lf10) }) : copy.clLastFrostMedian) + springAsk,
                tip: springObs ? (fr.ownRecord ? copy.clOwnTip : copy.clFittedTip)
                    : fr.springGiven ? givenTip(clim?.model?.site.last_frost_32f?.p50)
                        : `${stationTip}${prov}${cal && cal.spring.n ? " " + fillCopy("clLoggedToward", { n: cal.spring.n }) : ""}` });
        if (ff)
            out.push({ date: `${year}-${ff}`, kind: "log_first_freeze", cat: "frost", rule: fr.ownRecord ? "R-093b" : "R-093", species: null,
                text: fallObs
                    ? fillCopy(fr.ownRecord ? "clFirstFreezeOwn" : "clFirstFreezeObserved", { n: cal.fall.n })
                    : fr.fallGiven ? copy.clFirstFreezeGiven + (fallAsk ? fallAsk : "")
                        : copy.clFirstFreezeMedian + (fallAsk || ` ${fillCopy("clFrostAskFirst", { min: cal?.min_seasons ?? MIN_SEASONS })}`),
                tip: fallObs ? (fr.ownRecord ? copy.clOwnTip : copy.clFittedTip)
                    : fr.fallGiven ? givenTip(clim?.model && !frostRare(clim.model.site) ? clim.model.site.first_freeze_32f_p50 : null)
                        : `${stationTip}${prov}${cal && cal.fall.n ? " " + fillCopy("clLoggedToward", { n: cal.fall.n }) : ""}` });
    }
    if (site) {
        const yearSeason = ctx.seasons.find((x) => x.id === year && !x.closed_date);
        const grown = new Set();
        const bedAt = bedLocator(ctx.beds);
        for (const p of yearSeason?.plantings ?? [])
            if (p.species && outdoorBed(bedAt(p.region)))
                grown.add(p.species);
        const yearPlan = (yearSeason && Array.isArray(yearSeason.plan) ? yearSeason.plan : []);
        for (const pl of yearPlan) {
            if (!outdoorBed(pl.area))
                continue;
            if (unfitOf(bundle, ctx.beds, pl))
                continue;
            const g = bundle.guilds.find((x) => x.id === pl.guild);
            if (g)
                for (const r of guildMemberRefs(g))
                    grown.add(r.sid);
            for (const p of pl.plantings ?? [])
                if (p.species)
                    grown.add(p.species);
        }
        const bolt = boltMonthsFor(site, lat, [...grown], bundle);
        const crops = Object.keys(bolt).filter((sid) => bolt[sid]?.length).sort();
        const months = [...new Set(crops.flatMap((sid) => bolt[sid]))].sort((a, b) => a - b);
        if (crops.length && months.length < 12) {
            const greens = summerGreens(site, lat, null, bundle);
            let greensTip = "";
            if (greens) {
                const gn = greens.species.map((sid) => commonName(bundle, sid));
                let gl = gn.join(", ");
                try {
                    gl = new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(gn);
                }
                catch { }
                greensTip = " " + fillCopy("clHeatBoltGreens", { crops: gl });
            }
            const names = crops.map((sid) => commonName(bundle, sid));
            let list = names.join(", ");
            try {
                list = new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
            }
            catch { }
            const inSet = new Set(months);
            for (const start of months.filter((m) => !inSet.has(m === 1 ? 12 : m - 1))) {
                let end = start;
                while (inSet.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== start)
                    end = end === 12 ? 1 : end + 1;
                out.push({ date: seasonDate(`${String(start).padStart(2, "0")}-01`, year, lat), kind: "heat_marker", cat: "heat", rule: "R-172",
                    species: null,
                    text: end === start ? fillCopy("clHeatBoltOne", { crops: list, month: monthLong(start - 1) })
                        : fillCopy("clHeatBoltSpan", { crops: list, from: monthLong(start - 1), to: monthLong(end - 1) }),
                    tip: fillCopy("clHeatBoltTip", { temp: fmtTemp(Number(speciesById.get(crops[0])?.bolt_risk?.threshold_c ?? 24)) })
                        + greensTip });
            }
        }
        const lows = Array.isArray(site.tmin_mly_c) && site.tmin_mly_c.length === 12 ? site.tmin_mly_c : null;
        if (lows) {
            const nightRules = bundle.rules.filter((r) => r.trigger?.kind === "night_temp_exceeds");
            const named = (sid) => nightRules.find((r) => [].concat(r.applies_to?.species ?? []).includes(sid));
            const hot = [];
            for (const sid of [...grown].sort()) {
                const rule = named(sid);
                const ceiling = speciesById.get(sid)?.night_temp_max_c;
                if (!rule || typeof ceiling !== "number")
                    continue;
                const months = lows.map((v, i) => (v > ceiling ? i + 1 : 0)).filter(Boolean);
                if (months.length && months.length < 12)
                    hot.push({ sid, rule: rule.id, ceiling, months });
            }
            hot.sort((a, b) => a.rule.localeCompare(b.rule));
            const groups = new Map();
            for (const h of hot) {
                const k = `${h.ceiling}|${h.months.join(",")}`;
                groups.set(k, [...(groups.get(k) ?? []), h]);
            }
            for (const group of groups.values()) {
                const names = group.map((h) => commonName(bundle, h.sid));
                let list = names.join(", ");
                try {
                    list = new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
                }
                catch { }
                const inSet = new Set(group[0].months);
                const tomato = group.find((h) => h.rule === "R-030");
                for (const start of group[0].months.filter((m) => !inSet.has(m === 1 ? 12 : m - 1))) {
                    let end = start;
                    while (inSet.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== start)
                        end = end === 12 ? 1 : end + 1;
                    const night = fmtTemp(group[0].ceiling);
                    out.push({ date: seasonDate(`${String(start).padStart(2, "0")}-01`, year, lat), kind: "heat_marker", cat: "heat", rule: (tomato ?? group[0]).rule,
                        species: null,
                        text: end === start ? fillCopy("clHotNightsOne", { crops: list, month: monthLong(start - 1), night })
                            : fillCopy("clHotNightsSpan", { crops: list, from: monthLong(start - 1), to: monthLong(end - 1), night }),
                        tip: tomato ? copy.clHotNightsTip : copy.clHotNightsTipPepper });
                }
            }
        }
    }
    const open = ctx.seasons.find((s) => s.id === ctx.seasonId);
    const planLive = !!open && open.id === year && !open.closed_date;
    const openPlan = (!!open && !open.closed_date && Array.isArray(open.plan) ? open.plan : []);
    const kept = (e) => keptForSpring(ctx, e);
    const nextYear = open ? seasonAfter(open.id, ctx.seasons, TODAY_ISO(), lat, fr.firstFreeze) : null;
    const accepted = !planLive && !!open && year === nextYear
        ? (seedNextPlan(open, { id: year, plot: ctx.plotId, plantings: [], observations: [] }).plan ?? []) : [];
    const plans = planLive ? openPlan : !!open && year === nextYear
        ? openPlan.filter(kept).map((e) => accepted.find((d) => d.area === e.area) ?? e) : [];
    const closeIso = closeMmdd ? fallDate(closeMmdd, year, lat) : null;
    const lastFrostIso = site ? (springObs ?? modelLf0) : null;
    const lfIso = lastFrostIso ? seasonDate(lastFrostIso, year, lat) : undefined;
    const dtmMinOf = (sid, group) => {
        const sp = speciesById.get(sid);
        if (!datedByDays(sp, group))
            return null;
        const r = resolveDtm(sp, group);
        return r ? r[0] : null;
    };
    const warmDayRule = warmthFloorRule(bundle);
    const windowOf = (sid, group, lead = 0) => {
        const d = dtmMinOf(sid, group);
        const c = closeIso ? cropCloseOf(fr, sid, group, bundle) : null;
        const open = closeIso && !c ? cropOpenOf(fr, sid, group, bundle) : null;
        if (d != null && open != null)
            return { open: true, dtmMin: d, line: open };
        if (d == null || !c)
            return null;
        const closeBy = addDaysISO(fallDate(c.mmdd, year, lat), -(d + lead));
        if (!closeBy)
            return null;
        const last = warmDayRule && site ? warmthFloorClose(site, group ? `${sid}/${group}` : sid, bundle, year, lat, warmDayRule) : null;
        const warm = last ? addDaysISO(last.last, -lead) : null;
        return { closeBy, dtmMin: d, freeze: c.mmdd, line: c.line, ...(warm && warm < closeBy ? { warm } : {}) };
    };
    for (const plan of plans) {
        const team = bundle.guilds.find((g) => g.id === plan.guild);
        const swaps = roleSwaps(plan);
        const guild = team && swappedGuild(team, swaps);
        const planFrom = out.length;
        const myBedPlants = !guild && plan.mybed === true && Array.isArray(plan.plantings) ? plan.plantings : null;
        if (!guild && !myBedPlants)
            continue;
        if (unfitOf(bundle, ctx.beds, plan))
            continue;
        const guildName = team ? teamName(bundle, team, swaps) : (plan.area ?? copy.clYourDesign);
        const memberRefs = guild
            ? guildMemberRefs(guild)
            : dedupeRefs((myBedPlants ?? []).map((p) => ({ sid: p.species, group: p.cultivar_group ?? null })));
        if (warmPath && site) {
            out.push(...warmPlanTasks(bundle, year, lat, site, plan.area, memberRefs, guild ?? null, guildName, outdoorBed(plan.area)));
            continue;
        }
        const floorRule = warmthFloorRule(bundle);
        const floorOf = (sid, group) => floorRule && site && outdoorBed(plan.area) ? floorSay(warmthFloorFor(site, group ? `${sid}/${group}` : sid, bundle, floorRule)) : null;
        const fits = [];
        for (const r of memberRefs) {
            if (fits.some((f) => f.species === r.sid))
                continue;
            const w = windowOf(r.sid, r.group);
            if (w && !("open" in w))
                fits.push({ species: r.sid, ...w });
        }
        const teamClose = fits.length ? fits.reduce((a, b) => (a.closeBy < b.closeBy ? a : b)) : null;
        const teamOpen = teamClose ? null : memberRefs.map((r) => windowOf(r.sid, r.group))
            .find((w) => !!w && "open" in w) ?? null;
        const warmRefs = warmWait > 0 ? memberRefs.filter(({ sid, group }) => {
            const sp = speciesById.get(sid);
            return !!sp && schedulingModel(sp, group) === "dtm" && sp.sow_season !== "fall" && resolveFrostTolerance(sp, group) === "very_tender";
        }) : [];
        const outdoor = outdoorBed(plan.area);
        const fitsHere = outdoor ? fits : fits.map(({ warm: _w, ...f }) => f);
        const win = (w) => !w || !closeMmdd ? {} : "open" in w ? { dtmMin: w.dtmMin, noHardFreeze: w.line, lastFrost: lfIso, fits: fitsHere }
            : { closeBy: w.closeBy, dtmMin: w.dtmMin, closeFreeze: w.freeze, ...(w.line < 32 ? { closeLine: w.line } : lateOdds), lastFrost: lfIso, fits: fitsHere,
                ...(outdoor && w.warm ? { warmBy: w.warm } : {}) };
        let plantMmdd = null;
        if (guild) {
            for (const t of gardenTasks(guild, lat, lon, year, bundle, fr.ownRecord ? site : null)) {
                if (t.kind === "log_first_freeze")
                    continue;
                let tt = t;
                if (springShiftDays && (isTeamPlantJob(t.kind) || t.kind === "sow_climber")) {
                    const shifted = t.kind === "plant_cold_hardy" ? addDaysISO(t.date, springShiftDays) : shiftDays(year, t.date.slice(5), springShiftDays, lat);
                    if (shifted)
                        tt = { ...t, date: shifted };
                }
                if (tt.kind === "plant_after_last_frost") {
                    plantMmdd = tt.date.slice(5);
                    if (springObs && tt.date.slice(5) === springObs)
                        tt = { ...tt, text: fillCopy("clPlantObserved", { team: guildName, n: cal.spring.n }) };
                }
                const w = isTeamPlantJob(tt.kind) ? win(teamClose ?? teamOpen)
                    : tt.kind === "sow_climber" && tt.species ? win(windowOf(tt.species, null)) : {};
                out.push({ ...tt, bed: plan.area, guildName, ...w });
            }
            plantMmdd ??= modelLf0 && (shiftDays(year, modelLf0, springShiftDays, lat)?.slice(5) ?? modelLf0);
        }
        else if (lastFrostIso) {
            plantMmdd = lastFrostIso;
            const observed = !!springObs && lastFrostIso === springObs;
            out.push({ date: seasonDate(lastFrostIso, year, lat), kind: "plant_after_last_frost", rule: "R-031", species: null,
                frost_risk_until: (site?.last_frost_32f ?? {}).p10 ?? null, bed: plan.area, guildName,
                ...(observed ? { text: fillCopy("clPlantObserved", { team: guildName, n: cal.spring.n }) } : {}),
                ...win(teamClose ?? teamOpen) });
        }
        if (warmRefs.length) {
            const pt = out.slice(planFrom).find((x) => x.kind === "plant_after_last_frost");
            if (pt) {
                const crops = [...new Set(warmRefs.map(({ sid, group }) => plantingLabel(bundle, sid, group) || humanize(sid)))];
                pt.text = `${taskSentence(pt, bundle)} ${plural("clPlantTeamHold", Math.round(warmWait / 7), { crops: listWords(crops) })}`;
            }
        }
        if (plantMmdd && coolOffsets) {
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                const key = `${sid}|${group ?? ""}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                const sp = speciesById.get(sid);
                if (!sp || schedulingModel(sp, group) !== "dtm" || sp.sow_season === "fall")
                    continue;
                const tol = resolveFrostTolerance(sp, group);
                const off = tol === "hardy" ? coolOffsets.hardy : tol === "half_hardy" ? coolOffsets.half_hardy : 0;
                if (!off || off <= 0)
                    continue;
                const date = shiftDays(year, plantMmdd, -off, lat, true);
                if (!date)
                    continue;
                const label = plantingLabel(bundle, sid, group) || humanize(sid);
                const weeks = Math.round(off / 7);
                out.push({ date, kind: "cool_season", cat: "plant", rule: "R-096", species: sid, group, bed: plan.area, guildName,
                    text: plural("clCoolSow", weeks, { crop: label, hardiness: tol === "hardy" ? copy.clColdHardy : copy.clHalfHardy })
                        + (frostToleranceDisputed(sp, group) ? ` ${copy.clTierDisputed}` : ""),
                    ...win(windowOf(sid, group)) });
            }
        }
        if (plantMmdd) {
            const ownSow = new Map();
            for (const t of out.slice(planFrom)) {
                if (!t.species || (t.kind !== "sow_climber" && t.kind !== "cool_season"))
                    continue;
                const first = ownSow.get(t.species);
                if (!first || t.date < first)
                    ownSow.set(t.species, t.date);
            }
            const north = !isSouthern(lat), yr = String(year);
            const ffmmdd = closeMmdd;
            const freeze32 = ffmmdd ? fallDate(ffmmdd, year, lat) : null;
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const sp = speciesById.get(sid);
                if (!sp || schedulingModel(sp, group) !== "dtm")
                    continue;
                const succ = sp.succession_interval_days;
                const interval = Array.isArray(succ) && typeof succ[0] === "number"
                    ? succ
                    : (sp.bolt_risk ? [21, 21] : null);
                if (!interval)
                    continue;
                const step = interval[0];
                const cadence = interval[0] === interval[1] ? fillCopy("clCadence", { n: interval[0] }) : fillCopy("clCadenceRange", { lo: interval[0], hi: interval[1] });
                let dtm = sp.days_to_maturity;
                const groups = sp.cultivar_groups;
                if (group && Array.isArray(groups)) {
                    const g = groups.find((cg) => cg.id === group);
                    if (g && Array.isArray(g.days_to_maturity))
                        dtm = g.days_to_maturity;
                }
                if (!Array.isArray(dtm) || typeof dtm[0] !== "number")
                    continue;
                const dtmMin = dtm[0];
                const label = commonName(bundle, sid) || humanize(sid);
                const own28 = freeze32 ? cropCloseOf(fr, sid, group, bundle) : null;
                const open28 = !own28 && freeze32 ? cropOpenOf(fr, sid, group, bundle) : null;
                const freeze = own28 ? fallDate(own28.mmdd, year, lat) : open28 != null ? seasonBounds(year, lat).end : freeze32;
                const boltIn = new Set(outdoorBed(plan.area) ? heatPauseMonths(site, lat, sid, bundle) : []);
                let boltSkips = 0;
                for (let k = 1; k <= 24 + boltSkips; k++) {
                    const own = ownSow.get(sid);
                    const sd = own ? addDaysISO(own, step * k) : shiftDays(year, plantMmdd, step * k, lat);
                    if (!sd || (north && sd.slice(0, 4) > yr))
                        break;
                    if (north && sd.slice(0, 4) < yr)
                        continue;
                    if (freeze) {
                        const mature = addDaysISO(sd, dtmMin);
                        if (!mature || mature > freeze)
                            break;
                    }
                    else if (k > 2)
                        break;
                    if (boltIn.size && boltIn.has(Number(addDaysISO(sd, dtmMin)?.slice(5, 7)))) {
                        boltSkips++;
                        continue;
                    }
                    out.push({ date: sd, kind: "succession", cat: "sow", rule: "R-034", species: sid, bed: plan.area, guildName, anchor: "planned",
                        text: fillCopy("clSowMore", { crop: label, cadence }), cadence, every: step,
                        tip: copy.clSuccTipPlanned, ...win(windowOf(sid, group)) });
                }
            }
        }
        {
            const pt = out.slice(planFrom).find((x) => isTeamPlantJob(x.kind));
            const early = out.slice(planFrom).filter((x) => x.kind === "cool_season" && x.species && (!pt || x.date < pt.date)).sort((a, b) => a.date.localeCompare(b.date));
            if (pt && early.length) {
                const byDate = new Map();
                for (const e of early) {
                    const label = plantingLabel(bundle, e.species, e.group ?? null) || humanize(e.species);
                    const crops = byDate.get(e.date) ?? [];
                    if (!crops.includes(label))
                        crops.push(label);
                    byDate.set(e.date, crops);
                }
                const lines = [...byDate].map(([d, crops]) => plural("clPlantTeamEarly", crops.length, { crops: listWords(crops), date: monthDay$1(d.slice(5)) }));
                pt.text = `${pt.text ?? taskSentence(pt, bundle)} ${lines.join(" ")}`;
            }
        }
        if (plantMmdd && warmRefs.length) {
            const seen = new Set();
            for (const { sid, group } of warmRefs) {
                const key = `${sid}|${group ?? ""}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                const date = shiftDays(year, plantMmdd, warmWait, lat);
                if (!date)
                    continue;
                const label = plantingLabel(bundle, sid, group) || humanize(sid);
                const sp = speciesById.get(sid);
                out.push({ date, kind: "warm_set_out", cat: "plant", rule: "R-171", species: sid, group, bed: plan.area, guildName,
                    text: plural("clWarmSetOut", Math.round(warmWait / 7), { crop: label })
                        + (sp && frostToleranceDisputed(sp, group) ? ` ${copy.clTierDisputed}` : ""),
                    ...win(windowOf(sid, group)) });
            }
        }
        if (plantMmdd && closeIso && coolOffsets) {
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                const key = `${sid}|${group ?? ""}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                const sp = speciesById.get(sid);
                if (!sp || schedulingModel(sp, group) !== "dtm" || sp.sow_season === "fall" || sp.bolt_risk || Array.isArray(sp.succession_interval_days))
                    continue;
                const tol = resolveFrostTolerance(sp, group);
                const off = tol === "hardy" ? coolOffsets.hardy : tol === "half_hardy" ? coolOffsets.half_hardy : 0;
                if (!off || off <= 0)
                    continue;
                const dtm = resolveDtm(sp, group ?? null);
                const w = windowOf(sid, group);
                const spring = shiftDays(year, plantMmdd, -off, lat);
                if (!dtm || !w || !spring)
                    continue;
                const springDone = addDaysISO(spring, dtm[1]);
                if ("open" in w) {
                    if (!springDone)
                        continue;
                    const label = plantingLabel(bundle, sid, group) || humanize(sid);
                    out.push({ date: springDone, kind: "autumn", cat: "sow", rule: "R-188", species: sid, group, bed: plan.area, guildName,
                        text: fillCopy("clAutumnSowOpen", { crop: label, temp: lineTemp(w.line) }),
                        tip: fillCopy("clAutumnTipOpen", { crop: label, temp: lineTemp(w.line) }), ...win(w) });
                    handOverToAutumn(out, plan.area, sid, group, springDone);
                    continue;
                }
                if (!springDone || w.closeBy <= springDone)
                    continue;
                const date = addDaysISO(w.closeBy, -AUTUMN_LEAD_DAYS);
                if (!date)
                    continue;
                const label = plantingLabel(bundle, sid, group) || humanize(sid);
                const hard = w.line < 32;
                handOverToAutumn(out, plan.area, sid, group, date < springDone ? springDone : date);
                out.push({ date: date < springDone ? springDone : date, kind: "autumn", cat: "sow", rule: hard ? "R-188" : "R-032", species: sid, group, bed: plan.area, guildName,
                    text: !hard && lateWord ? fillCopy("clAutumnSowLate", { crop: label, by: monthDay$1(w.closeBy.slice(5)), days: dtm[0], freeze: lateWord })
                        : fillCopy(hard ? "clAutumnSowHard" : "clAutumnSow", { crop: label, by: monthDay$1(w.closeBy.slice(5)), days: dtm[0], freeze: monthDay$1(w.freeze) }),
                    tip: hard ? fillCopy("clAutumnTipHard", { crop: label, temp: lineTemp(w.line) }) : fillCopy(lateWord ? "clAutumnTipLate" : "clAutumnTip", { crop: label }),
                    ...win(w) });
            }
        }
        if (closeIso) {
            const r122 = bundle.rules.find((r) => r.id === "R-122");
            const fallCrops = [].concat(r122?.applies_to?.species ?? []);
            const seen = new Set();
            for (const { sid } of memberRefs) {
                if (seen.has(sid) || !fallCrops.includes(sid))
                    continue;
                seen.add(sid);
                const date = addDaysISO(closeIso, -AUTUMN_LEAD_DAYS * 2);
                if (!date)
                    continue;
                const label = commonName(bundle, sid) || humanize(sid);
                out.push({ date, kind: "autumn", cat: "plant", rule: "R-122", species: sid, bed: plan.area, guildName,
                    text: lateWord ? fillCopy("clGarlicLate", { crop: label, freeze: lateWord }) : fillCopy("clGarlic", { crop: label, date: monthDay$1(freezeMmdd) }),
                    tip: fillCopy(lateWord ? "clGarlicTipLate" : "clGarlicTip", { crop: label }) });
            }
        }
        if (closeIso) {
            const r170 = bundle.rules.find((r) => r.id === "R-170");
            const covers = [].concat(r170?.applies_to?.species ?? []);
            const seen = new Set();
            for (const { sid } of memberRefs) {
                if (seen.has(sid) || !covers.includes(sid))
                    continue;
                seen.add(sid);
                const lead = speciesById.get(sid)?.fall_sow_days_before_frost;
                if (!Array.isArray(lead) || lead.length !== 2)
                    continue;
                const [lo, hi] = lead.map(Number);
                const from = addDaysISO(closeIso, -hi), to = addDaysISO(closeIso, -lo);
                if (!from || !to)
                    continue;
                const label = commonName(bundle, sid) || humanize(sid);
                const wk = (d) => Math.round(d / 7);
                out.push({ date: from, kind: "autumn", cat: "sow", rule: "R-170", species: sid, bed: plan.area, guildName,
                    text: fillCopy(lateWord ? "clCoverSowLate" : "clCoverSow", { crop: label, from: monthDay$1(from.slice(5)), to: monthDay$1(to.slice(5)), lo: wk(lo), hi: wk(hi), freeze: lateWord ?? monthDay$1(freezeMmdd) }),
                    tip: fillCopy(lateWord ? "clCoverTipLate" : "clCoverTip", { crop: label }) });
            }
        }
        if (plantMmdd) {
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const wk = speciesById.get(sid)?.start_indoors_weeks;
                if (typeof wk !== "number" || wk <= 0)
                    continue;
                const date = shiftDays(year, plantMmdd, -wk * 7, lat, true);
                const label = commonName(bundle, sid) || humanize(sid);
                if (date)
                    out.push({ date, kind: "start_indoors", cat: "sow", rule: "R-097", species: sid, bed: plan.area, guildName,
                        text: fillCopy("clStartIndoors", { crop: label, n: wk }),
                        ...win(windowOf(sid, group, wk * 7)) });
                const wait = warmRefs.some((r) => r.sid === sid) ? warmWait : 0;
                const hard = shiftDays(year, plantMmdd, wait - HARDEN_OFF_LEAD_DAYS, lat);
                if (hard)
                    out.push({ date: hard, kind: "care", cat: "plant", rule: "R-115", species: sid, bed: plan.area, guildName,
                        careNote: copy.clHardenNote,
                        text: fillCopy("clHardenOff", { crop: label }) });
                const setOut = shiftDays(year, plantMmdd, wait, lat);
                if (setOut)
                    out.push({ date: setOut, kind: "care", cat: "plant", rule: "R-118", species: sid, bed: plan.area, guildName,
                        careNote: copy.clCollarsNote,
                        text: fillCopy("clCollars", { crop: label }) });
            }
        }
        if (plantMmdd && stratifyLead > 0) {
            const seen = new Set();
            for (const { sid } of memberRefs) {
                if (seen.has(sid))
                    continue;
                seen.add(sid);
                const treat = speciesById.get(sid)?.seed_treatment;
                const strat = Array.isArray(treat)
                    ? treat.find((t) => t.kind === "stratify")
                    : undefined;
                if (!strat)
                    continue;
                const date = shiftDays(year, plantMmdd, -stratifyLead, lat, true);
                if (!date)
                    continue;
                const label = commonName(bundle, sid) || humanize(sid);
                const weeks = Math.round(stratifyLead / 7);
                out.push({ date, kind: "stratify_start", cat: "sow", rule: "R-162", species: sid, bed: plan.area, guildName,
                    text: fillCopy("clStratify", { crop: label, n: weeks }) });
            }
        }
        {
            const jobs = out.slice(planFrom);
            const outJob = (k) => k === "cool_season" || k === "warm_set_out" || k === "sow_climber";
            const say1 = (t, line) => { t.text = `${t.text ?? taskSentence(t, bundle)} ${line}`; };
            const onTeam = [];
            const seen = new Set();
            for (const { sid, group } of memberRefs) {
                const key = `${sid}|${group ?? ""}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                const say = floorOf(sid, group);
                if (!say)
                    continue;
                const label = plantingLabel(bundle, sid, group) || humanize(sid);
                const line = floorLine(say, [label]);
                const own = jobs.filter((t) => t.species === sid && (t.group == null || t.group === group)).sort((a, b) => a.date.localeCompare(b.date));
                const start = own.find((t) => t.kind === "start_indoors");
                const outdoors = own.find((t) => outJob(t.kind));
                if (start && !start.text?.endsWith(line))
                    say1(start, line);
                if (outdoors)
                    say1(outdoors, line);
                else
                    onTeam.push({ label, say });
            }
            const pt = onTeam.length ? jobs.find((x) => isTeamPlantJob(x.kind)) : undefined;
            if (pt)
                say1(pt, floorLines(onTeam).join(" "));
        }
        {
            const team = out.slice(planFrom).find((x) => isTeamPlantJob(x.kind));
            if (team)
                for (let i = planFrom; i < out.length; i++)
                    if (out[i].kind === "install_support")
                        out[i] = { ...out[i], ...teamWindow(team) };
        }
        if (plantMmdd) {
            const inGround = new Map();
            for (const t of out.slice(planFrom)) {
                if (!t.species || !(t.kind === "sow_climber" || t.kind === "cool_season" || t.kind === "warm_set_out"))
                    continue;
                const k = `${t.species}|${t.group ?? ""}`;
                if (!inGround.has(k))
                    inGround.set(k, t.date);
                if (!inGround.has(t.species))
                    inGround.set(t.species, t.date);
            }
            const sownOn = (sid, group) => inGround.get(`${sid}|${group ?? ""}`) ?? inGround.get(sid);
            const todayIso = TODAY_ISO();
            const seasonNow = seasonBounds(year, lat);
            const underWay = todayIso >= seasonNow.start && todayIso <= seasonNow.end;
            const harvestTargets = guild && guild.roles?.length ? guildMemberRefs({ ...guild, members: [] }) : memberRefs;
            for (const { sid, group } of harvestTargets) {
                const sp = sid ? speciesById.get(sid) : undefined;
                if (!sid || !sp || !datedByDays(sp, group ?? null))
                    continue;
                if (sp.sow_season === "fall" && !sownOn(sid, group))
                    continue;
                const dtm = resolveDtm(sp, group ?? null);
                if (!dtm)
                    continue;
                const floor = floorOf(sid, group);
                if (floor?.kind === "floor_none")
                    continue;
                const base = sownOn(sid, group)?.slice(5) ?? plantMmdd;
                const plantedIso = sownOn(sid, group) ?? seasonDate(plantMmdd, year, lat);
                const late = underWay && plantedIso < todayIso;
                const fromToday = late ? addDaysISO(todayIso, dtm[0]) : null;
                const own = closeIso ? cropCloseOf(fr, sid, group ?? null, bundle) : null;
                const ownIso = own ? fallDate(own.mmdd, year, lat) : null;
                if (late && (!fromToday || (ownIso && fromToday > ownIso)))
                    continue;
                const date = fromToday ? (isSouthern(lat) || fromToday.slice(0, 4) === String(year) ? fromToday : null)
                    : shiftDays(year, base, dtm[0], lat);
                const span = harvestSpanOf(sp, group ?? null);
                const byDtm = date ? addDaysISO(date, Math.max(0, dtm[1] - dtm[0])) : null;
                const bySpan = span && date ? addDaysISO(date, span[1]) : null;
                const byDays = bySpan && byDtm && bySpan > byDtm ? bySpan : byDtm;
                const cut = closeIso ? cropCutOf(fr, sid, group ?? null, bundle) : null;
                const cutIso = cut?.cuts ? fallDate(cut.mmdd, year, lat) : null;
                const seasonEnd = seasonBounds(year, lat).end;
                const windowCloses = !date || !byDays ? undefined : !closeIso && site ? (byDays > seasonEnd ? byDays : seasonEnd)
                    : frostCutClose(date, byDays, cutIso, !!cut?.cuts);
                const pastFreeze = date && own && ownIso && date > ownIso ? own.mmdd : undefined;
                if (date)
                    out.push({ date, kind: "harvest_open", rule: "days-to-maturity", species: sid, group: group ?? null,
                        bed: plan.area, guildName, dtmRange: [dtm[0], dtm[1]], pastFreeze, ...(pastFreeze && own && own.line < 32 ? { closeLine: own.line } : {}),
                        anchor: "planned", ...(windowCloses ? { windowCloses } : {}),
                        ...(approxDays(sp, group ?? null) ? { approx: true } : {}), ...(floor ? { coolApprox: true } : {}) });
            }
        }
        if (planLive && kept(plan)) {
            const nextE = (open?.next_plan ?? [])
                .find((e) => e.area === plan.area && e.year === nextYear && typeof e.guild === "string");
            const nextG = nextE ? bundle.guilds.find((g) => g.id === nextE.guild) : undefined;
            const keptTeam = nextG ? displayName(nextG) : undefined;
            out.splice(planFrom, out.length - planFrom, ...out.slice(planFrom)
                .filter((t) => t.kind !== "harvest_open")
                .map((t) => t.kind === "autumn" ? t : { ...t, keptFor: nextYear ?? year + 1, ...(keptTeam ? { keptTeam } : {}) }));
        }
    }
    {
        const yr = String(year);
        out.push(...loggedEvents(bundle, ctx, (date) => date.slice(0, 4) === yr));
    }
    {
        const season = ctx.seasons.find((s) => s.id === ctx.seasonId);
        const bedOf = bedLocator(ctx.beds);
        const planned = new Set((Array.isArray(season?.plan) ? season.plan : []).map((e) => e.area));
        const yrStr = String(year);
        const emitted = new Set();
        const push = (t) => {
            const k = `${t.date}|${t.kind}|${t.species}|${t.bed ?? ""}`;
            if (emitted.has(k))
                return;
            emitted.add(k);
            out.push(season ? { ...t, of: season.id } : t);
        };
        {
            const thinRule = (bundle.rules ?? []).find((r) => r.id === "R-117");
            const thinSpecies = new Set([thinRule?.applies_to?.species ?? []].flat());
            for (const pl of (season && !season.closed_date ? season.plantings : undefined) ?? []) {
                if (pl.end_cause || !pl.sown || pl.transplanted || !thinSpecies.has(pl.species))
                    continue;
                const dtg = speciesById.get(pl.species)?.days_to_germinate;
                const up = Array.isArray(dtg) ? dtg[dtg.length - 1] : dtg;
                if (typeof up !== "number")
                    continue;
                const d = addDaysISO(pl.sown, up);
                if (!d || d.slice(0, 4) !== yrStr)
                    continue;
                const s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
                push({ date: d, kind: "care", cat: "plant", rule: "R-117", species: pl.species, bed: bedOf(pl.region),
                    careNote: copy.clThinNote, tip: copy.clThinTip,
                    text: fillCopy("clThin", { crop: s, tall: fmtCmValue(2.5), apart: fmtCmValue([2.5, 5]) }) });
            }
        }
        {
            const cropsOf = (id) => {
                const r = (bundle.rules ?? []).find((x) => x.id === id);
                return new Set([r?.applies_to?.species ?? []].flat());
            };
            const brambles = cropsOf("R-133"), asparagus = cropsOf("R-134"), grapes = cropsOf("R-136");
            const seasonsSorted = [...ctx.seasons].sort((a, b) => a.id - b.id);
            const sameGround = (a, b) => {
                try {
                    return intersectArea(parseRegion(a), parseRegion(b)) > 0;
                }
                catch {
                    return false;
                }
            };
            const earlierPicks = (pl) => seasonsSorted.filter((sn) => sn.id < year
                && (sn.plantings ?? []).some((q) => q.species === pl.species && !!q.first_harvest && sameGround(q.region, pl.region))).length;
            for (const pl of (season && !season.closed_date ? season.plantings : undefined) ?? []) {
                if (pl.end_cause)
                    continue;
                const planted = pl.transplanted || pl.sown;
                const age = planted ? year - Number(planted.slice(0, 4)) : null;
                const s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
                if (brambles.has(pl.species) && pl.last_harvest && pl.last_harvest.slice(0, 4) === yrStr) {
                    push({ date: pl.last_harvest, kind: "care", cat: "plant", rule: "R-133", species: pl.species, bed: bedOf(pl.region), live: true,
                        careNote: copy.clCanesNote, tip: copy.clCanesTip,
                        text: fillCopy("clCanes", { crop: s }) });
                }
                if (asparagus.has(pl.species) && age != null && age >= 1 && pl.first_harvest && pl.first_harvest.slice(0, 4) === yrStr) {
                    const firstYear = earlierPicks(pl) === 0;
                    const days = firstYear ? 14 : age >= 3 ? 56 : null;
                    const d = days != null ? addDaysISO(pl.first_harvest, days) : null;
                    if (d)
                        push({ date: d, kind: "care", cat: "plant", rule: "R-134", species: pl.species, bed: bedOf(pl.region), live: true,
                            careNote: copy.clPickNote, tip: fillCopy("clPickTip", { span: firstYear ? copy.clPickFirstYear : copy.clPickLaterYears }),
                            text: fillCopy("clPickStop", { crop: s }) });
                }
                if (grapes.has(pl.species) && age != null && age >= 1 && (ctx.lat ?? 0) > 0) {
                    push({ date: `${yrStr}-02-01`, until: `${yrStr}-03-31`, kind: "care", cat: "plant", rule: "R-136", species: pl.species, bed: bedOf(pl.region), live: true,
                        careNote: copy.clVineNote, tip: copy.clVineTip,
                        text: fillCopy("clVine", { crop: s }) });
                }
            }
        }
        const loggedOnPlan = new Set();
        for (const pl of (season && !season.closed_date ? season.plantings : undefined) ?? []) {
            if (pl.end_cause)
                continue;
            if (!(pl.transplanted || pl.sown))
                continue;
            const bed = bedOf(pl.region);
            const onPlan = !!bed && planned.has(bed);
            const sp = speciesById.get(pl.species);
            const win = plantingWindow(pl, sp, windowFreeze(fr, lat, bundle));
            if (!win || !sp)
                continue;
            if (onPlan)
                loggedOnPlan.add(`${pl.species}|${bed}`);
            const { anchor, dtm } = win;
            const s = plantingLabel(bundle, pl.species, pl.cultivar_group ?? null);
            const approx = win.approx ? ` ${fillCopy("clApproxWarmth", { crop: s })}` : "";
            const ownA = closeMmdd ? cropCloseOf(fr, pl.species, pl.cultivar_group ?? null, bundle) : null;
            const openA = !ownA && closeMmdd ? cropOpenOf(fr, pl.species, pl.cultivar_group ?? null, bundle) : null;
            const freezeA = ownA ? fallDate(ownA.mmdd, seasonYearOf(anchor, lat), lat)
                : openA != null ? seasonBounds(seasonYearOf(anchor, lat), lat).end : null;
            const tipBase = copy.clLogHarvestTip;
            const emitHarvest = (d, ready, late, end = false) => {
                if (d.slice(0, 4) !== yrStr)
                    return;
                const pastFreeze = freezeA && ownA && d > freezeA ? ownA.mmdd : undefined;
                push({ date: d, kind: "harvest_open", cat: "harvest", rule: "days-to-maturity", species: pl.species, bed,
                    text: (pastFreeze ? late : ready) + approx, tip: tipBase, pastFreeze, ...(pastFreeze && ownA && ownA.line < 32 ? { closeLine: ownA.line } : {}),
                    ...(end ? { windowEnd: true } : {}),
                    ...(!end && win.open ? { windowCloses: win.closes } : {}),
                    ...(win.approx ? { approx: true } : {}) });
            };
            const ownFreeze = monthDay$1(ownA?.mmdd ?? freezeMmdd ?? givenFirst ?? "");
            const hardA = !!ownA && ownA.line < 32 ? "Hard" : "";
            emitHarvest(win.opens, fillCopy("clLogReady", { crop: s, days: dtm[0] }), fillCopy(`clLogReadyLate${hardA}`, { crop: s, days: dtm[0], freeze: ownFreeze }));
            if (win.closes > win.opens && !win.open) {
                const daysIn = daysBetween$1(anchor, win.closes);
                emitHarvest(win.closes, win.frostCut && (freezeMmdd || givenFirst) ? fillCopy(`clLogEndFrost${hardA}`, { crop: s, days: daysIn, freeze: ownFreeze }) : fillCopy("clLogEnd", { crop: s, days: daysIn }), fillCopy(`clLogEndLate${hardA}`, { crop: s, days: daysIn, freeze: ownFreeze }), true);
            }
            const succ = sp.succession_interval_days;
            if (Array.isArray(succ) && typeof succ[0] === "number") {
                if (onPlan)
                    loggedOnPlan.add(`run|${pl.species}|${bed}`);
                const step = succ[0];
                const cadence = succ[0] === succ[1] ? fillCopy("clCadence", { n: String(succ[0]) }) : fillCopy("clCadenceRange", { lo: String(succ[0]), hi: String(succ[1]) });
                const boltIn = new Set(outdoorBed(bed) ? heatPauseMonths(site, lat, pl.species, bundle) : []);
                let boltSkips = 0;
                for (let k = 1; k <= 24 + boltSkips; k++) {
                    const d = addDaysISO(anchor, step * k);
                    if (!d)
                        break;
                    if (freezeA) {
                        const mature = addDaysISO(d, dtm[0]);
                        if (!mature || mature > freezeA)
                            break;
                    }
                    else if (k > 2)
                        break;
                    if (boltIn.size && boltIn.has(Number(addDaysISO(d, dtm[0])?.slice(5, 7)))) {
                        boltSkips++;
                        continue;
                    }
                    if (d.slice(0, 4) !== yrStr)
                        continue;
                    const closeBy = freezeA ? addDaysISO(freezeA, -dtm[0]) : null;
                    push({ date: d, kind: "succession", cat: "sow", rule: "R-034", species: pl.species, bed, anchor: "logged",
                        text: fillCopy("clSowMore", { crop: s, cadence }), cadence, every: step,
                        tip: copy.clSuccTipLogged,
                        ...(closeBy && closeMmdd && ownA ? { closeBy, dtmMin: dtm[0], closeFreeze: ownA.mmdd, ...(ownA.line < 32 ? { closeLine: ownA.line } : lateOdds) } : {}) });
                }
            }
        }
        if (planLive && loggedOnPlan.size) {
            const keep = out.filter((t) => !(t.anchor === "planned" && (t.kind === "harvest_open" ? loggedOnPlan.has(`${t.species}|${t.bed}`)
                : t.kind === "succession" && loggedOnPlan.has(`run|${t.species}|${t.bed}`))));
            out.splice(0, out.length, ...keep);
        }
    }
    return out;
}
function seasonWater(bundle, year, ctx, core) {
    const lat = ctx.lat, lon = ctx.lon;
    if (lat == null || lon == null)
        return [];
    const fr = gardenFrost(bundle, lat, lon, ctx.seasons);
    const site = fr.site;
    if (!site)
        return [];
    const south = isSouthern(lat);
    const months = south
        ? Array.from({ length: 12 }, (_v, k) => ({ y: k < 6 ? year : year + 1, m: ((k + 6) % 12) + 1 }))
        : [{ y: year - 1, m: 12 }, ...Array.from({ length: 23 }, (_v, k) => ({ y: k < 12 ? year : year + 1, m: (k % 12) + 1 }))];
    const mine = (x) => south || x.y === year;
    const key = (x) => ym(x.y, x.m);
    const grow = growingAround(year, lat, fr, core, () => true, true);
    if (!months.some((x) => mine(x) && grow.has(key(x))))
        return [];
    const indoorBeds = new Set(ctx.beds.filter((b) => b.rain === "indoors").map((b) => b.name));
    const roofedNames = new Set(ctx.beds.filter((b) => b.rain === "covered" || b.rain === "indoors").map((b) => b.name));
    const growOutdoors = growingAround(year, lat, fr, core, (t) => !t.bed || !indoorBeds.has(t.bed), true);
    const growOpen = growingAround(year, lat, fr, core, (t) => !t.bed || !roofedNames.has(t.bed), true);
    const runsOf = (set, g) => {
        const inSet = new Set(set);
        const runs = [];
        let cur = null;
        for (const x of south || inSet.size < 12 ? months : months.filter(mine)) {
            if (inSet.has(x.m) && g.has(key(x))) {
                if (cur)
                    cur[1] = x;
                else
                    cur = [x, x];
            }
            else if (cur) {
                runs.push(cur);
                cur = null;
            }
        }
        if (cur)
            runs.push(cur);
        return runs.filter(([a]) => mine(a));
    };
    const out = [];
    const water = waterMonthsFor(site, bundle);
    const at = (x) => `${key(x)}-01`;
    const end = (x) => `${key(x)}-${MONTH_LAST_DAY[x.m - 1]}`;
    const span = (one, many, [a, b], vars) => key(a) === key(b) ? fillCopy(one, { month: monthLong(a.m - 1), ...vars }) : fillCopy(many, { from: monthLong(a.m - 1), to: monthLong(b.m - 1), ...vars });
    const t175 = (bundle.rules.find((r) => r.id === "R-175")?.trigger ?? {});
    if (typeof t175.day_above_f === "number" && typeof t175.night_above_f === "number") {
        const fc = (f) => fmtTemp((f - 32) * 5 / 9);
        const pots = ctx.beds.filter((b) => b.structure === "container" && b.rain !== "indoors").map((b) => b.name);
        const potLine = pots.length && bundle.rules.some((r) => r.id === "R-107") ? " " + plural("clWaterHotPots", pots.length, { beds: listWords(pots) }) : "";
        for (const run of runsOf(water.hot, growOutdoors)) {
            out.push({ date: at(run[0]), runEnd: end(run[1]), kind: "water_marker", cat: "water", rule: "R-175", species: null,
                text: span("clWaterHotOne", "clWaterHotSpan", run, { day: fc(t175.day_above_f), night: fc(t175.night_above_f) }) + potLine,
                tip: copy.clWaterHotTip });
        }
    }
    const roofed = ctx.beds.filter((b) => b.rain === "covered" || b.rain === "indoors").map((b) => b.name);
    const allRoofed = ctx.beds.length > 0 && roofed.length === ctx.beds.length;
    const t174 = (bundle.rules.find((r) => r.id === "R-174")?.trigger ?? {});
    if (!allRoofed && typeof t174.week_need_mm === "number") {
        const week = fmtRain(t174.week_need_mm);
        for (const run of runsOf(water.dry, growOpen)) {
            out.push({ date: at(run[0]), runEnd: end(run[1]), kind: "water_marker", cat: "water", rule: "R-174", species: null,
                text: span("clWaterDryOne", "clWaterDrySpan", run, { week }), tip: fillCopy("clWaterDryTip", { week }) });
        }
    }
    if (roofed.length && bundle.rules.some((r) => r.id === "R-173")) {
        const ms = months.filter((x) => mine(x) && grow.has(key(x)));
        out.push({ date: at(ms[0]), runEnd: end(ms[ms.length - 1]), beds: roofed, kind: "water_marker", cat: "water", rule: "R-173", species: null,
            text: plural("clWaterRoofed", roofed.length, { beds: listWords(roofed) }), tip: copy.clWaterRoofedTip });
    }
    return out;
}
function groupAgenda(list) {
    const out = [];
    const rep = new Map();
    const acts = new Map();
    const ends = new Map();
    for (const t of list) {
        if (t.kind === "succession" && t.species) {
            const key = `${t.species}|${t.bed ?? ""}|${t.plotId ?? ""}`;
            const first = rep.get(key);
            if (first) {
                first.groupDates.push(t.date);
                continue;
            }
            const card = { ...t, groupDates: [t.date] };
            rep.set(key, card);
            out.push(card);
        }
        else if (t.kind === "logged" && t.act && t.groupPlants?.length) {
            const key = `${t.date}|${t.plotId ?? ""}|${t.bed ?? ""}|${t.act}`;
            const first = acts.get(key);
            if (first) {
                const plants = first.groupPlants;
                for (const p of t.groupPlants) {
                    const hit = plants.find((x) => x.label === p.label);
                    if (hit)
                        hit.n += p.n;
                    else
                        plants.push({ ...p });
                }
                first.text = actSentence(first.act, plants);
                first.ended = first.ended && t.ended;
                continue;
            }
            const card = { ...t, groupPlants: t.groupPlants.map((p) => ({ ...p })) };
            acts.set(key, card);
            out.push(card);
        }
        else if (t.kind === "logged" && t.endCause !== undefined && t.groupPlants?.length === 1) {
            const p = t.groupPlants[0];
            const key = `${t.date}|${t.plotId ?? ""}|${t.bed ?? ""}|${p.label}|${t.endCause}`;
            const first = ends.get(key);
            if (first) {
                const q = first.groupPlants[0];
                q.n += p.n;
                const text = fillCopy("clEndedCount", { plant: fillCopy("clActCount", { n: q.n, plant: q.label }), cause: t.endCause });
                first.text = text.charAt(0).toUpperCase() + text.slice(1);
                continue;
            }
            const card = { ...t, groupPlants: [{ ...p }] };
            ends.set(key, card);
            out.push(card);
        }
        else {
            out.push(t);
        }
    }
    return out;
}
function actSentence(act, plants) {
    const key = act === "sowed" ? "clActSowed" : act === "transplanted" ? "clActTransplanted" : act === "first_harvest" ? "clActFirstHarvest" : "clActLastHarvest";
    const one = plants.length === 1 && plants[0].n === 1;
    return fillCopy(key, { plants: one ? plants[0].label : plants.map((p) => (p.n > 1 ? fillCopy("clActCount", { n: p.n, plant: p.label }) : p.label)).join(" + ") });
}
const DONE_GRACE_DAYS = 7;
const HARDEN_OFF_LEAD_DAYS = 14;
const AUTUMN_LEAD_DAYS = 14;
function heatPauseMonths(site, lat, sid, bundle) {
    return [...(boltMonthsFor(site, lat, [sid], bundle)[sid] ?? []), ...(hotHarvestMonthsFor(site, [sid], bundle)[sid] ?? [])];
}
const TODAY_ISO = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()); };
const daysBetween$1 = (a, b) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
function isDone(t, all) {
    return doneIn(loggedIndex(all), t);
}
function loggedIndex(all) {
    const idx = new Map();
    for (const e of all) {
        if (e.kind !== "logged")
            continue;
        const k = e.plotId ?? "";
        (idx.get(k) ?? idx.set(k, []).get(k)).push(e);
    }
    return idx;
}
function doneIn(idx, t) {
    if (t.kind === "logged")
        return false;
    const cat = category(t);
    const logged = idx.get(t.plotId ?? "") ?? [];
    const sameBed = (e) => !t.bed ? !e.bed : e.bed === t.bed;
    const sameSpecies = (e) => !t.species || e.species === t.species;
    const since = addDaysISO(t.date, -DONE_GRACE_DAYS) ?? t.date;
    const ofJob = (e) => t.of == null || e.of == null || e.of === t.of || e.ofDate === t.of || e.date >= since;
    if (cat === "harvest")
        return logged.some((e) => category(e) === "harvest" && sameBed(e) && sameSpecies(e) && ofJob(e));
    if (cat === "frost")
        return logged.some((e) => category(e) === "frost" && Math.abs(daysBetween$1(e.date, t.date)) <= 30);
    if (isTeamPlantJob(t.kind))
        return logged.some((e) => category(e) === "plant" && sameBed(e) && e.date >= since);
    if (t.kind === "care")
        return logged.some((e) => category(e) === "note" && sameBed(e) && sameSpecies(e) && e.date >= since)
            || ((t.rule === "R-115" || t.rule === "R-118") && logged.some((e) => e.act === "transplanted" && sameBed(e) && sameSpecies(e) && ofJob(e)));
    const resowSince = t.kind === "succession" && t.every && t.every <= DONE_GRACE_DAYS ? addDaysISO(t.date, 1 - t.every) ?? since : since;
    if (t.kind === "succession" || t.kind === "autumn")
        return logged.some((e) => category(e) === "plant" && sameBed(e) && sameSpecies(e) && e.date >= resowSince);
    return logged.some((e) => category(e) === "plant" && sameBed(e) && sameSpecies(e) && ofJob(e));
}
const CLOSING_DAYS = 14;
const prettyIso = (iso) => monthDay$1(iso.slice(5));
const freezeWord = (t) => t.closeOdds ? fillCopy("clFreezeOdds", { date: monthDay$1(t.closeFreeze ?? ""), n: t.closeOdds })
    : t.closeAfter ? fillCopy("clFreezeSeason", { date: monthDay$1(t.closeFreeze ?? ""), days: t.closeAfter }) : `~${monthDay$1(t.closeFreeze ?? "")}`;
const closeWord = (iso, todayIso) => iso.slice(0, 4) === todayIso.slice(0, 4) ? prettyIso(iso) : fmtMonthDayYear(iso);
function handOverToAutumn(out, bed, sid, group, day) {
    for (const t of out) {
        if (t.kind === "cool_season" && t.bed === bed && t.species === sid && (t.group ?? null) === (group ?? null) && t.date < day && (t.closeBy ?? "") > day) {
            t.closeBy = day;
            t.autumnNext = true;
            t.closeLine = t.closeOdds = undefined;
        }
    }
}
function taskWindow(t, bundle, todayIso) {
    if (takesTeamWindow(t))
        return t.closeBy || t.noHardFreeze
            ? taskWindow({ ...t, kind: t.warmNext && !t.closeFreeze ? "warm_window" : "plant_after_last_frost", species: null, group: null }, bundle, todayIso)
            : null;
    if (keptClosed(t, todayIso))
        return { state: "closed", closeBy: t.closeBy ?? t.date, kept: t.keptFor,
            line: t.keptTeam ? fillCopy("clWinKeptLineTeam", { year: t.keptFor, team: t.keptTeam }) : fillCopy("clWinKeptLine", { year: t.keptFor }) };
    if (t.autumnNext && t.species && todayIso > t.closeBy)
        return { state: "closed", closeBy: t.closeBy, line: fillCopy("clWinAutumnNext", { crop: plantingLabel(bundle, t.species, t.group) || humanize(t.species) }) };
    if (t.closeBy && t.warmNext && !t.closeFreeze) {
        if (t.kind === "harvest_open" || t.kind === "logged" || t.kind === "install_support" || isMarker(t))
            return null;
        const crop = t.species ? (plantingLabel(bundle, t.species, t.group) || humanize(t.species)) : (t.guildName ?? copy.clThisTeam);
        const wv = { by: closeWord(t.closeBy, todayIso), crop, month: monthLong(t.warmNext - 1) };
        if (todayIso <= t.closeBy)
            return { state: daysBetween$1(todayIso, t.closeBy) <= CLOSING_DAYS ? "closing" : "open", closeBy: t.closeBy, line: fillCopy("clWinWarmBy", wv) };
        if (t.warmReopen && t.warmReopen > todayIso)
            return { state: "closed", closeBy: t.closeBy, reopens: t.warmReopen,
                line: fillCopy("clWinWarmReopens", { ...wv, date: closeWord(t.warmReopen, todayIso) }) };
        return { state: "closed", closeBy: t.closeBy, line: fillCopy("clWinWarmClosed", wv) };
    }
    if (!t.closeBy && t.noHardFreeze && !(t.kind === "harvest_open" || t.kind === "logged" || t.kind === "install_support" || isMarker(t))) {
        if (!t.species)
            return { state: "open", closeBy: "", line: fillCopy("clWinNoHardFreezeTeam", { team: t.guildName ?? copy.clThisTeam, temp: lineTemp(t.noHardFreeze) }) };
        const crop = plantingLabel(bundle, t.species, t.group) || humanize(t.species);
        return { state: "open", closeBy: "", line: fillCopy("clWinNoHardFreeze", { crop, temp: lineTemp(t.noHardFreeze) }) };
    }
    if (!t.closeBy || !t.closeFreeze)
        return null;
    if (t.kind === "harvest_open" || t.kind === "logged" || t.kind === "install_support" || isMarker(t))
        return null;
    const name = (sid) => sid ? (commonName(bundle, sid) || humanize(sid)) : (t.guildName ?? copy.clThisTeam);
    const freeze = freezeWord(t);
    const by = closeWord(t.closeBy, todayIso);
    const slowest = isTeamPlantJob(t.kind) && t.fits?.length
        ? name(t.fits.reduce((a, b) => (a.closeBy < b.closeBy ? a : b)).species) : name(t.species);
    const vars = { by, crop: slowest, freeze };
    const hard = t.closeLine ? "Hard" : "";
    const hv = t.closeLine ? { ...vars, temp: lineTemp(t.closeLine) } : vars;
    if (todayIso <= t.closeBy) {
        const days = daysBetween$1(todayIso, t.closeBy);
        const warm = warmLateSay(t, bundle, todayIso);
        return { state: days <= CLOSING_DAYS ? "closing" : "open", closeBy: t.closeBy,
            line: fillCopy(`${t.kind === "start_indoors" ? "clWinStartBy" : isTeamPlantJob(t.kind) || t.kind === "warm_set_out" ? "clWinPlantBy" : "clWinSowBy"}${hard}`, hv),
            ...(warm ? { warm } : {}) };
    }
    const closedKey = `${t.kind === "start_indoors" ? "clWinClosedStart" : isTeamPlantJob(t.kind) || t.kind === "warm_set_out" ? "clWinClosedPlant" : "clWinClosedSow"}${hard}`;
    return { state: "closed", closeBy: t.closeBy, line: fillCopy(closedKey, { ...hv, alt: windowAlternative(t, bundle, todayIso) }) };
}
function warmLateSay(t, bundle, todayIso) {
    const word = (iso) => closeWord(iso, todayIso);
    if (isTeamPlantJob(t.kind)) {
        const byDay = new Map();
        for (const f of t.fits ?? []) {
            if (!f.warm || todayIso < f.warm || todayIso > f.closeBy)
                continue;
            const crops = byDay.get(f.warm) ?? [];
            const label = commonName(bundle, f.species) || humanize(f.species);
            if (!crops.includes(label))
                crops.push(label);
            byDay.set(f.warm, crops);
        }
        const lines = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, crops]) => warmLateLine("plant", word(d), crops));
        return lines.length ? lines.join(" ") : null;
    }
    if (!t.warmBy || !t.species || todayIso < t.warmBy || !t.closeBy || todayIso > t.closeBy)
        return null;
    const started = Number(bundle.species.find((s) => s.id === t.species)?.start_indoors_weeks) > 0;
    const how = t.kind === "start_indoors" ? "start" : t.kind === "warm_set_out" && started ? "plant" : "sow";
    return warmLateLine(how, word(t.warmBy), [plantingLabel(bundle, t.species, t.group ?? null) || humanize(t.species)]);
}
function warmLateLines(tasks, bedName, todayIso, bundle) {
    const crops = new Map();
    const word = (iso) => closeWord(iso, todayIso);
    for (const t of tasks) {
        if (t.bed !== bedName || t.kind === "start_indoors")
            continue;
        if (isTeamPlantJob(t.kind)) {
            for (const f of t.fits ?? [])
                if (f.warm && f.warm <= todayIso && todayIso <= f.closeBy && !crops.has(f.species))
                    crops.set(f.species, { day: f.warm, label: commonName(bundle, f.species) || humanize(f.species) });
        }
        else if (t.species && t.warmBy && t.closeBy && t.warmBy <= todayIso && todayIso <= t.closeBy) {
            crops.set(t.species, { day: t.warmBy, label: plantingLabel(bundle, t.species, t.group ?? null) || humanize(t.species) });
        }
    }
    const byDay = new Map();
    for (const { day, label } of crops.values()) {
        const xs = byDay.get(day) ?? [];
        if (!xs.includes(label))
            xs.push(label);
        byDay.set(day, xs);
    }
    return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, xs]) => warmLateLine("plant", word(d), xs));
}
function setOutRipen(t, todayIso) {
    const freezeIso = t.closeFreeze && t.closeBy ? onOrAfter(t.closeFreeze, t.closeBy) : null;
    if (t.kind !== "start_indoors" || t.dtmMin == null || !freezeIso)
        return null;
    const setOut = t.lastFrost && todayIso < t.lastFrost ? t.lastFrost : todayIso;
    const ripen = addDaysISO(setOut, t.dtmMin);
    return ripen && ripen <= freezeIso ? { setOut, ripen } : null;
}
function windowAlternative(t, bundle, todayIso) {
    const name = (sid) => commonName(bundle, sid) || humanize(sid);
    const freeze = freezeWord(t);
    const so = setOutRipen(t, todayIso);
    if (so) {
        return so.setOut === todayIso
            ? fillCopy("clAltSetOutNow", { date: prettyIso(so.ripen) })
            : fillCopy("clAltSetOutAfter", { frost: prettyIso(so.setOut), date: prettyIso(so.ripen) });
    }
    const fits = (t.fits ?? []).filter((f) => f.closeBy >= todayIso && f.species !== t.species)
        .sort((a, b) => b.closeBy.localeCompare(a.closeBy));
    if (fits.length) {
        const named = fits.slice(0, 2);
        const list = named.length > 1 ? fillCopy("clAltOr", { a: name(named[0].species), b: name(named[1].species) }) : name(named[0].species);
        const vars = { list, crop: name(named[0].species), date: prettyIso(named[0].closeBy) };
        return fits.length > 2 ? fillCopy("clAltFitsMore", { ...vars, n: fits.length - 2 }) : fillCopy("clAltFits", vars);
    }
    return fillCopy(t.closeLine ? "clAltNextSeasonHard" : "clAltNextSeason", { freeze });
}
const keptClosed = (t, todayIso) => !!t.keptFor && t.date < todayIso;
const onOrAfter = (mmdd, iso) => {
    const y = Number(iso.slice(0, 4));
    return `${y}-${mmdd}` >= iso ? `${y}-${mmdd}` : `${y + 1}-${mmdd}`;
};
const lineTemp = (lineF) => fmtTemp((lineF - 32) * 5 / 9);
const lapsedResow = (t, todayIso) => t.kind === "succession" && !!t.closeBy && t.closeBy < todayIso;
const windowClosed = (t, todayIso) => keptClosed(t, todayIso) || (!!t.closeBy && t.closeBy < todayIso);
const stillTime = (t, todayIso) => t.kind !== "succession" && category(t) !== "harvest"
    && typeof t.date === "string" && t.date < todayIso && !windowClosed(t, todayIso)
    && (!!t.closeBy || !!t.noHardFreeze);
const closingSoon = (t, todayIso) => !!t.closeBy && daysBetween$1(todayIso, t.closeBy) <= CLOSING_DAYS;
const byDate = (a, b) => a.date.localeCompare(b.date);
function latestOfRuns(list) {
    const keep = new Map();
    const out = [];
    for (const t of list) {
        if (t.kind !== "succession" || !t.species) {
            out.push(t);
            continue;
        }
        const key = `${t.species}|${t.bed ?? ""}|${t.plotId ?? ""}`;
        const cur = keep.get(key);
        if (!cur || cur.date < t.date)
            keep.set(key, t);
    }
    return [...out, ...keep.values()];
}
function weekJobs(all, todayIso, days = 7) {
    const endIso = addDaysISO(todayIso, days) ?? todayIso;
    const idx = loggedIndex(all);
    const done = (t) => doneIn(idx, t);
    const open0 = all.filter((t) => t.kind !== "logged" && !t.setAside && typeof t.date === "string" && (!t.until || todayIso <= t.until) && liveIn(idx, t));
    const teamDay = new Set(open0.filter((t) => t.kind === "plant_cold_hardy" && t.guildName).map((t) => `${t.plotId ?? ""}|${t.bed ?? ""}|${t.date}|${t.guildName}`));
    const open = open0.filter((t) => !(t.kind === "cool_season" && t.guildName && teamDay.has(`${t.plotId ?? ""}|${t.bed ?? ""}|${t.date}|${t.guildName}`)));
    const rank = (t) => (windowClosed(t, todayIso) ? 3 : stillTime(t, todayIso) ? (closingSoon(t, todayIso) ? 1 : 2) : 0);
    const reopens = (t) => !!t.warmReopen && !!t.closeBy && t.closeBy < todayIso;
    const passed = latestOfRuns(open.filter((t) => t.date < todayIso && !isMarker(t) && !done(t) && !lapsedResow(t, todayIso)));
    const between = passed.filter((t) => reopens(t) && t.warmReopen > todayIso)
        .sort((a, b) => a.warmReopen.localeCompare(b.warmReopen) || byDate(a, b));
    const late = passed.filter((t) => !reopens(t))
        .sort((a, b) => (rank(a) - rank(b)) || (rank(a) === 3 ? byDate(a, b) : byDate(b, a)));
    const closed = late.filter((t) => windowClosed(t, todayIso)).length;
    const still = late.filter((t) => stillTime(t, todayIso)).length;
    const week = open.filter((t) => t.date >= todayIso && t.date <= endIso).sort(byDate);
    const doneWeek = week.filter(done);
    const todo = week.filter((t) => !done(t));
    const byDay = new Map();
    for (const t of todo)
        (byDay.get(t.date) ?? byDay.set(t.date, []).get(t.date)).push(t);
    const due = todo.filter((t) => !isMarker(t)).length + still;
    return { late, days: [...byDay].map(([date, tasks]) => ({ date, tasks })), done: doneWeek, due, overdue: late.length - closed - still, still, closed, between };
}
function liveIn(idx, t) {
    if (t.live)
        return true;
    return (t.kind !== "succession" && t.kind !== "harvest_open" && t.kind !== "care") || !t.species
        || (idx.get(t.plotId ?? "") ?? []).some((e) => category(e) === "plant" && !e.ended && e.species === t.species
            && (!t.bed || e.bed === t.bed));
}
function isOwed(t, all) {
    return owedFor(all)(t);
}
function owedFor(all, today = TODAY_ISO()) {
    const idx = loggedIndex(all);
    return (t) => t.kind !== "logged" && !t.setAside && typeof t.date === "string" && (!t.until || today <= t.until)
        && !lapsedResow(t, today) && liveIn(idx, t) && !doneIn(idx, t);
}
function weekTaskPool(bundle, gardens, todayIso, withAnswers, days = 7) {
    return taskPool(bundle, gardens, todayIso, withAnswers, days, gardenTasksFor);
}
function seasonHeadSpan(todayIso, lat) {
    const y = seasonYearOf(todayIso, lat);
    return y < Number(todayIso.slice(0, 4)) ? { year: y, from: `${y}-07-01`, to: `${y}-12-31` } : null;
}
function seasonRecordsBefore(bundle, ctx, id, before) {
    return loggedEvents(bundle, ctx, (date, season) => season.id === id && date < before)
        .map((t) => ({ ...t, garden: ctx.name, plotId: ctx.plotId }));
}
function taskPool(bundle, gardens, todayIso, withAnswers, days, get) {
    const endIso = addDaysISO(todayIso, days) ?? todayIso;
    const years = [...new Set([Number(todayIso.slice(0, 4)), Number(endIso.slice(0, 4))])];
    const pool = (g) => {
        const season = seasonYearOf(todayIso, g.lat), own = get(bundle, season, g);
        const h = seasonHeadSpan(todayIso, g.lat);
        const head = h ? own.filter((t) => typeof t.date === "string" && t.date >= h.from && t.date <= h.to) : [];
        const from = seasonBounds(season, g.lat).start;
        const lead = own.filter((t) => t.kind !== "logged" && typeof t.date === "string" && t.date < from);
        const rest = [...head, ...years.flatMap((y) => yearTasks(bundle, y, g, get, from))].filter((t) => typeof t.date !== "string" || t.date >= from);
        const carried = isSouthern(g.lat) ? [] : get(bundle, season - 1, g).filter((t) => t.kind === "water_marker" && !!t.runEnd && t.runEnd >= from);
        return [...lead, ...carried, ...seasonRecordsBefore(bundle, g, season, from), ...rest];
    };
    const out = oneWarmWindow(gardens.flatMap(pool));
    if (withAnswers) {
        const spans = gardens.flatMap((g) => seasonHeadSpan(todayIso, g.lat) ?? []);
        const extra = (app.answersTasks?.() ?? []);
        out.push(...extra.filter((t) => typeof t.date === "string"
            && (years.some((y) => t.date.startsWith(String(y))) || spans.some((s) => t.date >= s.from && t.date <= s.to))));
    }
    return out;
}
function openSeasonId(seasons) {
    const pool = seasons.filter((s) => !s.closed_date);
    const use = pool.length ? pool : seasons;
    return use.length ? Math.max(...use.map((s) => s.id)) : null;
}
let calGardensSig = "";
let calGardensAgain = false;
function noteGardens(plots) {
    noteGardenCountries(plots);
    noteOwnFrost(plots);
    const sig = JSON.stringify(plots.map((p) => [p.id, p.name ?? null, !!p.shared, p.anchor?.lat ?? null, p.anchor?.lon ?? null, p.closed_date ?? null,
        p.frost_own?.last ?? null, p.frost_own?.first ?? null]));
    if (sig === calGardensSig)
        return;
    calGardensSig = sig;
    if (calOtherGardens === null)
        return;
    if (calGardensLoading) {
        calGardensAgain = true;
        return;
    }
    void loadOtherGardens();
}
async function loadOtherGardens() {
    const db = app.logDb;
    if (!db || calGardensLoading)
        return;
    calGardensLoading = true;
    try {
        const plots = await listPlots(db);
        calGardenNames.clear();
        calGardenKeys.clear();
        for (const p of plots)
            calGardenKeys.set(p.id, { id: p.id, name: p.name ?? null, shared: !!p.shared, example: !!p.example });
        for (const p of plots)
            calGardenNames.set(p.id, gardenShownName(p.name ?? copy.clGardenFallback, p.shared));
        const others = [];
        for (const p of plots) {
            if (p.id === app.currentPlotId)
                continue;
            const seasons = await listSeasons(db, p.id);
            others.push({ plotId: p.id, name: calGardenNames.get(p.id) ?? copy.clGardenFallback, lat: p.anchor?.lat ?? null, lon: p.anchor?.lon ?? null,
                seasons, seasonId: openSeasonId(seasons), beds: p.beds ?? [], ...(p.closed_date ? { closed: true } : {}) });
        }
        calOtherGardens = others;
        calGardensBuiltFor = app.currentPlotId;
    }
    finally {
        calGardensLoading = false;
    }
    if (calGardensAgain) {
        calGardensAgain = false;
        void loadOtherGardens();
        return;
    }
    gardensLoaded?.();
    app.homeRefresh?.();
}
function allGardenSeasons() {
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
    if (calOtherGardens === null) {
        void loadOtherGardens();
        return null;
    }
    return [currentGardenCtx(), ...(calOtherGardens ?? []).filter((g) => g.plotId !== app.currentPlotId)].map((g) => g.seasons);
}
function weekSummary(bundle, todayIso) {
    const j = weekJobs(weekTaskPool(bundle, [currentGardenCtx()], todayIso, !isSignedIn()), todayIso);
    const ranked = [...j.late.filter((t) => !windowClosed(t, todayIso)),
        ...j.days.flatMap((d) => d.tasks).filter((t) => !isMarker(t))];
    const [firstTask = null, secondTask = null] = ranked;
    const firstSentence = firstTask ? taskSentence(firstTask, bundle) : null;
    return { due: j.due, late: j.overdue, closed: j.closed,
        first: firstSentence ? shortJob(firstSentence) : null,
        second: secondTask ? shortJob(taskSentence(secondTask, bundle)) : null,
        firstDetail: firstSentence ? jobDetail(firstSentence) : null,
        firstTask };
}
function shortJob(sentence) {
    const head = sentence.split(/ - | \u2014 |: |\. /)[0].replace(/[.:]\s*$/, "").trim();
    return head || sentence;
}
function jobDetail(sentence) {
    const m = / - | \u2014 |: |\. /.exec(sentence);
    if (!m)
        return null;
    const rest = sentence.slice(m.index + m[0].length).trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}
function jobTitle(sentence, t, lang = appLang()) {
    return shortJob(lateSentence(sentence, t, lang));
}
function gardensNow() {
    const others = (calOtherGardens ?? []).filter((g) => g.plotId !== app.currentPlotId && !g.closed);
    return orderGardens([currentGardenCtx(), ...others], (g) => calGardenKeys.get(g.plotId) ?? { id: g.plotId, name: g.name }, defaultPlotId());
}
let gardensLoaded = null;
function onGardensLoaded(fn) { gardensLoaded = fn; }
function dropStaleGardens() {
    if (calOtherGardens !== null && calGardensBuiltFor !== app.currentPlotId)
        calOtherGardens = null;
}
function kickGardensLoad() { if (calOtherGardens === null)
    void loadOtherGardens(); }
let factsBundle = null;
function installCalFacts(bundle) { factsBundle = bundle; }
function calFactsBundle() { return factsBundle; }

const dossierState = { bundle: null, stack: [] };
let _wired = false;
let _opener = null;
let _ticket = 0;
const sheetOpen = () => document.body.classList.contains("dossier-open");
function initDossier(bundle) {
    dossierState.bundle = bundle;
    if (_wired)
        return;
    _wired = true;
    document.getElementById("dossiersheetclose")?.addEventListener("click", closeDossier);
    document.getElementById("dossierscrim")?.addEventListener("click", closeDossier);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sheetOpen()) {
            e.preventDefault();
            closeDossier();
        }
    });
    document.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        const a = e.target?.closest?.("a[href]");
        if (!a)
            return;
        if (a.closest("header.site, #navmenu, #navsheet, #sitefoot") || (a.closest("#page-start .landing") && !a.closest("#homereturn")))
            return;
        const m = /(?:^|\/)(guides|explainers)\/([a-z0-9-]+)\/?$/.exec(a.getAttribute("href") ?? "");
        if (!m)
            return;
        e.preventDefault();
        openFrom(a, { kind: "page", id: `${m[1] === "guides" ? "guide" : "explainer"}/${m[2]}` });
    });
}
function showSheet() {
    const s = document.getElementById("dossiersheet");
    if (!s)
        return;
    if (!sheetOpen()) {
        document.body.classList.add("dossier-open");
        s.hidden = false;
    }
    document.getElementById("dossiersheetclose")?.focus();
}
function closeDossier() {
    const s = document.getElementById("dossiersheet");
    if (!s)
        return;
    document.body.classList.remove("dossier-open");
    s.hidden = true;
    dossierState.stack.length = 0;
    const back = _opener;
    _opener = null;
    back?.focus();
}
function openFrom(opener, atom) {
    _opener = opener;
    dossierState.stack.length = 0;
    const ticket = ++_ticket;
    const ready = chunkReady("dossier");
    if (ready) {
        ready.openDossier(atom);
        return;
    }
    const body = document.getElementById("dossiersheetbody");
    if (!body)
        return;
    body.replaceChildren();
    const line = el$1(body, "p", "dossier-page-loading", atom.kind !== "page" ? copy.dsOpeningEvidence
        : atom.id.startsWith("explainer/") ? copy.dsOpeningExplainer : copy.dsOpeningGuide);
    showSheet();
    const current = () => ticket === _ticket && sheetOpen() && line.isConnected;
    loadChunk("dossier").then((m) => {
        if (!current())
            return;
        m.openDossier(atom);
        if (line.isConnected)
            closeDossier();
    }, () => {
        if (!current())
            return;
        line.className = "hint dossier-offline";
        line.setAttribute("role", "status");
        line.textContent = copy.apPanelNeedsConnection;
    });
}
function mark(host, atom, opts) {
    if (!atom?.id)
        return null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dossier-mark";
    b.textContent = `${opts?.label ?? copy.dsSeeEvidence} ›`;
    b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFrom(b, atom);
    });
    host.appendChild(b);
    return b;
}
function markLink(a, atom) {
    if (!atom?.id || a.dataset.dossierWired === "1")
        return;
    a.dataset.dossierWired = "1";
    a.classList.add("dossier-marklink");
    a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)
            return;
        e.preventDefault();
        e.stopPropagation();
        openFrom(a, atom);
    });
}
function markControl(btn, atom) {
    if (!atom?.id || btn.dataset.dossierWired === "1")
        return;
    btn.dataset.dossierWired = "1";
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFrom(btn, atom);
    });
}

const GLOSSARY = {
    team: { term: copy.glossTeamTerm, guide: "companion-planting-honestly", gloss: copy.glossTeamBody },
    window: { term: copy.glossWindowTerm, guide: "read-a-planting-calendar", gloss: copy.glossWindowBody },
    rotation: { term: copy.glossRotationTerm, guide: "crop-rotation", gloss: copy.glossRotationBody },
    zone: { term: copy.glossZoneTerm, guide: "frost-dates-zones-daylength", gloss: copy.glossZoneBody },
    fit: { term: copy.glossFitTerm, gloss: copy.glossFitBody },
    tier: { term: copy.glossTierTerm, gloss: copy.glossTierBody },
    median: { term: copy.glossMedianTerm, gloss: copy.glossMedianBody },
    firstFrost: { term: copy.glossFirstFrostTerm, guide: "frost-dates", gloss: copy.glossFirstFrostBody },
    established: { term: copy.glossEstablishedTerm, gloss: CONFIDENCE_GLOSS.A },
    promising: { term: copy.glossPromisingTerm, gloss: CONFIDENCE_GLOSS.B },
    hunch: { term: copy.glossHunchTerm, gloss: CONFIDENCE_GLOSS.C },
};
let glossSeq = 0;
function guideMoreLink(guide) {
    const a = document.createElement("a");
    a.className = "glossterm-more";
    a.href = `../guides/${guide}/`;
    a.rel = "noopener";
    a.textContent = copy.glossMore;
    markLink(a, { kind: "page", id: `guide/${guide}` });
    return a;
}
function glossTerm(key, labelOverride) {
    const e = GLOSSARY[key];
    const span = document.createElement("span");
    span.className = "glossterm";
    const id = `gloss-${key}-${++glossSeq}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "glossterm-t";
    btn.textContent = labelOverride ?? e.term;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    btn.title = copy.glossTitle;
    const note = document.createElement("span");
    note.className = "glossterm-g";
    note.id = id;
    note.setAttribute("role", "note");
    note.appendChild(document.createTextNode(e.gloss));
    if (e.guide) {
        note.appendChild(document.createTextNode(" "));
        note.appendChild(guideMoreLink(e.guide));
    }
    note.hidden = true;
    btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
    });
    span.append(btn, note);
    return span;
}
function renderGlossary(parent) {
    const dl = document.createElement("dl");
    dl.className = "glosslist";
    for (const key of Object.keys(GLOSSARY)) {
        const { term, gloss, guide } = GLOSSARY[key];
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.appendChild(document.createTextNode(gloss));
        if (guide) {
            dd.appendChild(document.createTextNode(" "));
            dd.appendChild(guideMoreLink(guide));
        }
        dl.append(dt, dd);
    }
    parent.appendChild(dl);
}

const CONTACT_EMAIL = "contact@milpa.garden";
function tellUsHref(lines) {
    const body = [copy.tellUsBodyLead, ...lines.filter((l) => l.trim()), "", copy.tellUsBodyAsk, ""].join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(copy.tellUsSubject)}&body=${encodeURIComponent(body)}`;
}
function tellUsLine(lines) {
    const p = document.createElement("p");
    p.className = "tellus";
    const a = document.createElement("a");
    a.href = tellUsHref(lines);
    a.textContent = copy.tellUs;
    p.appendChild(a);
    return p;
}
function rowText(label, value) {
    const v = value.cloneNode(true);
    v.querySelectorAll(".whytap, .glossterm-g").forEach((e) => e.remove());
    return `${label.trim()}: ${(v.textContent ?? "").replace(/\s+/g, " ").trim()}`;
}

const REM_FLAG = "gg-reminders-on";
function remindersOn() {
    try {
        return localStorage.getItem(REM_FLAG) === "1";
    }
    catch {
        return false;
    }
}

const EXAMPLE_PLOT_ID = "plot_example";
const isExamplePlot = (id) => id === EXAMPLE_PLOT_ID;

function recollectionLine(r, name) {
    const day = dayWord(r.date);
    const when = r.yearsAgo === 1 ? day : fillCopy("lgRecWhenYear", { day, year: r.year });
    switch (r.kind) {
        case "sowed": return fillCopy("lgRecSowed", { when, name });
        case "transplanted": return fillCopy("lgRecSetOut", { when, name });
        case "first_harvest": return fillCopy("lgRecFirstHarvest", { when, name: name.toLowerCase() });
        case "last_harvest": return fillCopy("lgRecLastHarvest", { when, name: name.toLowerCase() });
        case "note": return r.species
            ? fillCopy("lgRecNoteOn", { when, name, text: stop(r.text ?? "") })
            : fillCopy("lgRecNote", { when, text: stop(r.text ?? copy.lgRecANote) });
        case "frost": return fillCopy("lgRecFrost", { when });
        case "heat": return fillCopy("lgRecHeat", { when });
        default: return fillCopy("lgRecOther", { when });
    }
}
function stop(text) {
    const t = text.trimEnd();
    return /[.!?…]$/.test(t) ? t : `${t}.`;
}
function dayWord(iso) {
    return fmtMonthDay(iso);
}
function frostNotedLine(iso, standing) {
    return fillCopy(standing?.live ? "lgFrostNotedLive" : "lgFrostNoted", { day: dayWord(iso) });
}
function heatNotedLine(iso) {
    return fillCopy("lgHeatNoted", { day: dayWord(iso) });
}
function weatherNotedLine(what, iso) {
    const w = what.trim();
    return fillCopy("lgWeatherNoted", { what: `${w.charAt(0).toUpperCase()}${w.slice(1)}`, day: dayWord(iso) });
}
function noteLoggedLine(iso) {
    return fillCopy("lgNoteLogged", { day: dayWord(iso) });
}
function plantedLine(year, n, bed) {
    if (n == null)
        return fillCopy("lgPlantedTeam", { year, bed });
    return fillCopy(n === 1 ? "lgPlantedOne" : "lgPlantedMany", { year, n, bed });
}
function plantEntryLine(kind, name, iso, detail = "") {
    const n = name.trim() || copy.lgDiaryThePlant;
    const cap = `${n.charAt(0).toUpperCase()}${n.slice(1)}`;
    const day = dayWord(iso);
    switch (kind) {
        case "sowed": return fillCopy("lgDiarySowed", { name: cap, day });
        case "transplanted": return fillCopy("lgDiarySetOut", { name: cap, day });
        case "first_harvest": return fillCopy("lgDiaryFirstHarvest", { name: n.toLowerCase(), day });
        case "last_harvest": return fillCopy("lgDiaryLastHarvest", { name: n.toLowerCase(), day });
        case "ended": return fillCopy("lgDiaryEnded", { name: cap, day });
        case "problem": return fillCopy("lgDiaryProblem", { name: n, detail: detail.trim() || copy.lgDiaryAProblem, day });
        case "note": return fillCopy("lgDiaryNote", { name: n, day });
        default: return fillCopy("lgDiaryOther", { name: cap, day });
    }
}
function graduationLine() {
    return copy.lgGraduation;
}

function humanizeMMDD(mmdd) {
    const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
    if (!m)
        return mmdd;
    const mon = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (mon < 0 || mon > 11 || day < 1 || day > 31)
        return mmdd;
    return fmtMonthDay(mmdd);
}
function frostRiskRows(site) {
    const lf = site.last_frost_32f ?? {};
    const rows = [];
    for (const [k, v] of Object.entries(lf)) {
        const m = /^p(\d+)$/.exec(k);
        if (m && typeof v === "string")
            rows.push({ pct: Number(m[1]), date: v, label: humanizeMMDD(v) });
    }
    rows.sort((a, b) => a.pct - b.pct);
    return rows;
}
function frostBand(site) {
    const rows = frostRiskRows(site);
    return {
        rows,
        median: rows.find((r) => r.pct === 50) ?? null,
        safe: rows.length ? rows[0] : null,
    };
}

const DEG = Math.PI / 180;
function solarDeclinationDeg(dayOfYear) {
    return 23.45 * Math.sin((DEG * 360 * (284 + dayOfYear)) / 365);
}
function daylengthHours(latDeg, dayOfYear) {
    const decl = solarDeclinationDeg(dayOfYear) * DEG;
    const lat = latDeg * DEG;
    const cosH = -Math.tan(lat) * Math.tan(decl);
    if (cosH <= -1)
        return 24;
    if (cosH >= 1)
        return 0;
    const h = Math.acos(cosH);
    return (2 * h) / DEG / 15;
}
function dayOfYear(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const here = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.round((here - start) / 86_400_000);
}
function onionDaylengthNote(latDeg) {
    const a = Math.abs(latDeg);
    if (a >= 38)
        return copy.pnOnionLongDay;
    if (a <= 35)
        return copy.pnOnionShortDay;
    return copy.pnOnionChangeover;
}

const modeledSite = (res) => modelSite(res.site);
function renderClimate(res, zone, lat = null, cal = null, garden = null, plotId = null, reading = false) {
    const panel = $$1("climate");
    const own = res?.site.own_window ?? null;
    const est = res && res.model !== undefined ? res.model : res;
    const estLf = est?.site.last_frost_32f?.p50 ?? null, estFf = est && !frostRare(est.site) ? est.site.first_freeze_32f_p50 ?? null : null;
    panel.innerHTML = "";
    delete panel.dataset.copyKey;
    const hasZone = !!(zone && zone.zone != null);
    if (!res && !hasZone && lat == null) {
        if (garden) {
            panel.textContent = fillCopy("clClimateNoPlace", { garden });
            return;
        }
        panel.textContent = copy.climateEmpty;
        panel.dataset.copyKey = "climateEmpty";
        return;
    }
    const card = document.createElement("div");
    card.className = "climatecard";
    let placeLine = "";
    const mail = [];
    const MAIL_ROWS = new Set([copy.plFrostRow, copy.plLastFrostRow, copy.plFirstFreezeRow, copy.plSeasonRow, copy.plFrostDatesRow]);
    const h = document.createElement("h2");
    h.className = "cc-title";
    h.textContent = garden ? fillCopy("clClimateAt", { garden }) : copy.plClimateH;
    if (est) {
        const loc = document.createElement("span");
        loc.className = "cc-loc";
        const stn = est.site.provenance?.station?.name;
        const at = est.distanceKm < 1.6;
        loc.textContent = stn
            ? (at ? fillCopy("plClimateAtStation", { station: stationDisplay(stn) }) : fillCopy("plClimateStation", { dist: fmtKm(est.distanceKm), station: stationDisplay(stn) }))
            : datesPlaceLine(est.site) ?? (modeledSite(est) ? (at ? copy.plClimateModelAt : fillCopy("plClimateModel", { dist: fmtKm(est.distanceKm) }))
                : (at ? fillCopy("plClimateAt", { place: titleCase(est.site.key) }) : fillCopy("plClimateFrom", { dist: fmtKm(est.distanceKm), place: titleCase(est.site.key) })));
        h.appendChild(loc);
        placeLine = loc.textContent ?? "";
    }
    card.appendChild(h);
    const rows = document.createElement("dl");
    rows.className = "cc-rows";
    const row = (label, value, grade, glossKey) => {
        const dt = document.createElement("dt");
        if (glossKey) {
            const term = glossKey === "zone" ? copy.glossZoneTerm : copy.glossTierTerm;
            const at = label.toLowerCase().indexOf(term.toLowerCase());
            if (at >= 0) {
                if (at > 0)
                    dt.appendChild(document.createTextNode(label.slice(0, at)));
                dt.appendChild(glossTerm(glossKey, label.slice(at, at + term.length)));
                if (at + term.length < label.length)
                    dt.appendChild(document.createTextNode(label.slice(at + term.length)));
            }
            else {
                dt.appendChild(document.createTextNode(label + " "));
                dt.appendChild(glossTerm(glossKey));
            }
        }
        else
            dt.textContent = label;
        if (MAIL_ROWS.has(label))
            mail.push(rowText(label, value));
        rows.appendChild(dt);
        const dd = document.createElement("dd");
        dd.appendChild(value);
        if (grade) {
            const g = document.createElement("span");
            g.className = `grade cc-grade ${gradeClassOfWord(grade)}`.trim();
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
    const whyR093 = (v, id = "R-093") => {
        v.appendChild(document.createTextNode(" "));
        const a = document.createElement("a");
        a.className = "whytap";
        a.href = `#/why?rule=${id}`;
        a.textContent = copy.pcWhyThis;
        markLink(a, { kind: "rule", id });
        v.appendChild(a);
        return v;
    };
    if (hasZone)
        row(copy.plZoneRow, val(zone.label ?? String(zone.zone)), confidenceWord(zone.grade) ?? undefined, "zone");
    else if (lat != null && !reading)
        row(copy.plZoneRow, val(copy.plZoneNone, copy.plZoneNoneQ), undefined, "zone");
    if (res) {
        const site = res.site;
        const lf = site.last_frost_32f ?? {};
        const springObs = cal?.spring.calibrated ? cal.spring.calibrated_date : null;
        const fallObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
        const given = frostGiven(site);
        const rare = frostRare(site) && !springObs && !fallObs && !given;
        const fy = site.frost_years, fyears = site.years;
        const trop = tropical(lat);
        const odds = typeof fy === "number" && typeof fyears === "number"
            ? (fy > 0 ? fillCopy(trop ? "plFrostOddsQYears" : "plFrostOddsQ", { n: fy, years: fyears }) : fillCopy(trop ? "plFrostNoneQYears" : "plFrostNoneQ", { years: fyears })) : copy.plFrostRareQ;
        const mostWord = trop ? copy.plFrostMostYears : copy.plFrostMost, someWord = trop ? copy.plFrostSomeYears : copy.plFrostSome;
        const word = frostWord(site), stQ = stationCountQ(site, trop);
        if (rare)
            row(copy.plFrostRow, val(word === "most" ? mostWord : word === "some" ? someWord : copy.plFrostRare, stQ ?? odds));
        else if (stQ && !springObs && !fallObs && !own)
            row(copy.plFrostRow, val(mostWord, stQ));
        const yours = (date) => (date ? fillCopy("plOwnFrostQ", { date: humanizeMMDD(date) }) : copy.plOwnFrostQNone);
        if (rare) ;
        else if (!springObs && own?.last) {
            row(copy.plLastFrostRow, val(humanizeMMDD(own.last), yours(estLf)));
        }
        else if (springObs) {
            row(copy.plLastFrostRow, whyR093(val(`~${humanizeMMDD(springObs)}`, fillCopy("plOwnDateQ", { n: cal.spring.n, date: lf.p50 ? humanizeMMDD(lf.p50) : "-" }))));
        }
        else if (lf.p50) {
            row(copy.plLastFrostRow, val(`~${humanizeMMDD(lf.p50)}`, [lf.p10 ? fillCopy("plSafeAfterQ", { date: humanizeMMDD(lf.p10) }) : "", datesRowQ(site) ?? ""].filter(Boolean).join(" ") || undefined));
        }
        if (!fallObs && own?.first) {
            row(copy.plFirstFreezeRow, val(humanizeMMDD(own.first), yours(estFf)));
        }
        else if (fallObs) {
            row(copy.plFirstFreezeRow, whyR093(val(`~${humanizeMMDD(fallObs)}`, fillCopy("plOwnDateQ", { n: cal.fall.n, date: site.first_freeze_32f_p50 ? humanizeMMDD(site.first_freeze_32f_p50) : "-" }))));
        }
        else if (site.first_freeze_32f_p50 && !rare) {
            row(copy.plFirstFreezeRow, val(`~${humanizeMMDD(site.first_freeze_32f_p50)}`));
        }
        if (site.growing_season_days_p50 != null && !(rare && !given && word === "most"))
            row(copy.plSeasonRow, val(rare || given ? copy.plAllYear : fillCopy("plAboutDays", { n: site.growing_season_days_p50 })));
        const tempsQ = site.temps === "station" ? copy.plTempsStationQ : site.temps === "model" ? copy.plTempsModelQ : undefined;
        const daysRow = tropical(lat) ? copy.plWarmestDaysRow : copy.plSummerDaysRow, nightsRow = tropical(lat) ? copy.plWarmestNightsRow : copy.plSummerNightsRow;
        if (site.temps === "months_only")
            row(daysRow, val(copy.plTempsHeld, copy.plTempsHeldQ));
        else {
            if (site.summer_night_tmin_c != null)
                row(nightsRow, val(fillCopy("plMinTemp", { temp: fmtTemp(site.summer_night_tmin_c) }), site.summer_day_tmax_c != null ? undefined : tempsQ));
            if (site.summer_day_tmax_c != null)
                row(daysRow, val(fillCopy("plMaxTemp", { temp: fmtTemp(site.summer_day_tmax_c) }), tempsQ));
        }
        const prcp = site.prcp_mly_mm;
        if (Array.isArray(prcp) && prcp.length === 12) {
            const dry = prcp.indexOf(Math.min(...prcp)), wet = prcp.indexOf(Math.max(...prcp));
            row(copy.plRainRow, val(fillCopy("plRainDryWet", { dry: monthLong(dry), dryRain: fmtRain(prcp[dry]), wet: monthLong(wet), wetRain: fmtRain(prcp[wet]) })));
        }
        else if (Array.isArray(site.rain_dry_months) && site.rain_dry_months.length) {
            const dm = site.rain_dry_months, words = dm.map((m) => monthLong(m - 1));
            let months = words.join(", ");
            try {
                months = new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(words);
            }
            catch { }
            row(copy.plRainRow, val(dm.length === 12 ? copy.plRainDryAllYear : fillCopy("plRainDryMonths", { months })));
        }
    }
    if (!res && lat != null) {
        const ownSp = cal?.spring.own && cal.spring.calibrated ? cal.spring.calibrated_date : null;
        const ownFa = cal?.fall.own && cal.fall.calibrated ? cal.fall.calibrated_date : null;
        const ownGrade = confidenceWord(dossierState.bundle?.rules.find((r) => r.id === "R-093b")?.grade) ?? undefined;
        if (ownSp)
            row(copy.plLastFrostRow, whyR093(val(`~${humanizeMMDD(ownSp)}`, fillCopy("plOwnRecordQ", { n: cal.spring.n })), "R-093b"), ownGrade);
        if (ownFa)
            row(copy.plFirstFreezeRow, whyR093(val(`~${humanizeMMDD(ownFa)}`, fillCopy("plOwnRecordQ", { n: cal.fall.n })), "R-093b"), ownGrade);
        if (!ownSp && !ownFa)
            row(copy.plFrostDatesRow, reading ? val(copy.plClimateReading) : val(copy.plNotCovered, cal?.spring.own && (cal.spring.n > 0 || cal.fall.n > 0 || frostAsked(null, lat)) ? fillCopy("plNotCoveredOwnQ", { min: cal.min_seasons }) : copy.plNotCoveredQ));
    }
    if (lat != null) {
        const a = Math.abs(lat);
        const dayLabel = a >= 38 ? copy.plLongDay : a <= 35 ? copy.plShortDay : copy.plOnionChangeover;
        const solstice = lat < 0 ? 355 : 172;
        row(copy.plDaylengthRow, val(dayLabel, fillCopy("plPeakHours", { h: daylightHours(lat, solstice).toFixed(1) })));
    }
    card.appendChild(rows);
    const noFrost = !!est && frostPossible(est.site) === false;
    if (plotId && (res || lat != null) && !(noFrost && !own)) {
        const box = document.createElement("div");
        box.className = "cc-own";
        const some = !!est && frostSomeWinters(est.site) != null;
        const rare = !!est && frostRare(est.site) && !some;
        const modeled = !!est && frostDatesModelled(est.site);
        const stLines = !!est && !own ? stationFrostLines(est.site, true) : [];
        if (stLines.length) {
            const warn = document.createElement("p");
            warn.className = "cc-warn";
            warn.textContent = stLines.join(" ");
            box.appendChild(warn);
        }
        else if (modeled && !own && !noFrost && !frostStationOf(est?.site)) {
            const warn = document.createElement("p");
            warn.className = "cc-warn";
            warn.textContent = some ? copy.plOwnFrostWarnSome : rare ? copy.plOwnFrostWarnRare : copy.plOwnFrostWarn;
            box.appendChild(warn);
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-ghost cc-ownbtn";
        btn.textContent = own ? copy.plOwnFrostChange : modeled ? copy.plOwnFrostEnter : copy.plOwnFrostKnow;
        btn.addEventListener("click", () => {
            btn.hidden = true;
            void import('./ownfrost.js').then((m) => m.openOwnFrostForm(box, plotId, {
                last: own?.last ?? (estLf ?? null), first: own?.first ?? (estFf ?? null)
            }, !!own, () => { btn.hidden = false; btn.focus(); }));
        });
        box.appendChild(btn);
        card.appendChild(box);
    }
    else if (est && modeledSite(est) && !own && !noFrost) {
        const some = frostSomeWinters(est.site) != null, rare = frostRare(est.site) && !some;
        const stLines = stationFrostLines(est.site, false);
        const warn = document.createElement("p");
        warn.className = "cc-warn";
        warn.textContent = stLines.length ? stLines.join(" ") : some ? copy.anModelWarnSome : rare ? copy.anModelWarnRare : copy.anModelWarn;
        card.appendChild(warn);
    }
    if (res || lat != null)
        card.appendChild(tellUsLine([placeLine, ...mail]));
    const more = document.createElement("details");
    more.className = "cc-more disclosure";
    const sum = document.createElement("summary");
    const rareFold = !!est && frostRare(est.site) && !own && !cal?.spring.calibrated && !cal?.fall.calibrated;
    sum.appendChild(document.createTextNode(rareFold ? copy.plHowWeKnowRare : copy.plHowWeKnow));
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
    if (own)
        para(copy.plOwnFrostFoldLead, copy.plOwnFrostFoldRest);
    const sf = est ? stationFold(est.site) : [];
    const cite = est && datesStationOf(est.site) ? datesCitation(dossierState.bundle) : null;
    if (sf.length > 1)
        para(sf[0].lead, sf[0].rest);
    if (cite)
        para(copy.fsCiteLead, ` - ${cite}`);
    const near = est ? nearerFoldRow(est.site) : null;
    if (near)
        para(near.lead, near.rest);
    if (est) {
        const fr = frostRiskRows(est.site);
        if (fr.length >= 2) {
            para(copy.plFrostRiskLead, copy.plFrostRiskRest);
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
        para(copy.plPhotoperiodLead, fillCopy("plPhotoperiodRest", { lat: lat.toFixed(1), note: onionDaylengthNote(lat) }));
    if (est) {
        const prov = est.site.provenance ?? {};
        const fs = document.createElement("p");
        const st = document.createElement("strong");
        st.textContent = copy.plFrostSeasonLead;
        fs.appendChild(st);
        const [fsHead, fsTail] = fillCopy("plFrostSeasonRest", {
            conf: confidenceWord(est.effectiveGrade)?.toLowerCase() ?? copy.plEstimated,
            tier: String(prov.tier ?? "?"),
            caveat: datesStationOf(est.site) ? ""
                : frostDatesModelled(est.site) ? fillCopy("anModelCaveat", { dist: fmtKm(est.distanceKm) }) : climateCaveat(est.distanceKm),
        }).split("{tierTerm}");
        fs.appendChild(document.createTextNode(fsHead));
        const TIER_WORD = { 1: copy.plTierA, 2: copy.plTierB, 3: copy.plTierC, A: copy.plTierA, B: copy.plTierB, C: copy.plTierC };
        const tierWord = TIER_WORD[String((est.site.frost_provenance ?? prov).tier ?? "")] ?? copy.plTierUnknown;
        fs.appendChild(glossTerm("tier", tierWord));
        fs.appendChild(document.createTextNode(fsTail ?? ""));
        mb.appendChild(fs);
        const sd = !!est.site.frost_provenance;
        const sq = squareText(est.square, est.distanceKm, sd, sd ? copy.wsqSdLead : "");
        if (sq)
            para(copy.wsqLead, fillCopy("wsqRest", { text: sq }));
        const count = sf[sf.length - 1];
        if (count)
            para(count.lead, count.rest);
        const own = document.createElement("p");
        own.className = "cc-owndates";
        own.textContent = copy.clOwnDatesNote;
        mb.appendChild(own);
    }
    if (hasZone) {
        const phzm = zone.method === "nearest_phzm_zipcode";
        const zkm = Number(zone.distance_km);
        const zdist = Number.isFinite(zkm) ? fmtKm(zkm) : "?";
        para(copy.plZoneLead, phzm
            ? fillCopy("plZonePhzm", { dist: zdist })
            : zone.method === "nearest_era5_cell" ? fillCopy("plZoneModel", { dist: zdist })
                : ` - ${zone.source ?? copy.plZoneEquivalent}.`);
    }
    if (lat != null)
        para(copy.plDaylengthRow, copy.plDaylengthRest);
    more.appendChild(mb);
    card.appendChild(more);
    panel.appendChild(card);
}

const SVG_NS = "http://www.w3.org/2000/svg";
function plantState(p, todayIso, harvestOpensIso, harvestClosesIso) {
    if (p.end_cause)
        return "ended";
    if (p.carried_over === true)
        return "carried";
    if (p.first_harvest && p.first_harvest <= todayIso)
        return "picked";
    if (harvestOpensIso && todayIso >= harvestOpensIso && !(harvestClosesIso && todayIso > harvestClosesIso))
        return "window";
    const inGround = p.transplanted || p.sown;
    if (inGround && inGround <= todayIso)
        return "ground";
    return "planned";
}
function heldRadius(region) {
    const pts = regionPoints(region);
    if (!pts.length)
        return 0;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return Math.max(0, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2);
}
function plotBounds(beds) {
    const xs = [], ys = [];
    for (const b of beds)
        for (const [x, y] of b.points) {
            xs.push(x);
            ys.push(y);
        }
    if (!xs.length)
        return { minX: 0, minY: 0, w: 1, h: 1 };
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { minX, minY, w: Math.max(Math.max(...xs) - minX, 0.3), h: Math.max(Math.max(...ys) - minY, 0.3) };
}
function fanOutStacked(plants) {
    const key = (p) => `${p.at[0].toFixed(3)},${p.at[1].toFixed(3)},${p.r.toFixed(3)}`;
    const groups = new Map();
    plants.forEach((p, i) => { const k = key(p); const g = groups.get(k); if (g)
        g.push(i);
    else
        groups.set(k, [i]); });
    const out = plants.slice();
    for (const idxs of groups.values()) {
        if (idxs.length < 2)
            continue;
        idxs.forEach((i, j) => {
            const p = plants[i];
            const a = (2 * Math.PI * j) / idxs.length - Math.PI / 2;
            out[i] = { ...p, at: [p.at[0] + (p.r / 2) * Math.cos(a), p.at[1] + (p.r / 2) * Math.sin(a)], r: p.r / 2 };
        });
    }
    return out;
}
function plateModel(plot, season, prev, todayIso, harvestOpens) {
    const beds = (plot?.beds ?? []).map((b) => ({ name: b.name, points: regionPoints(b.region) }));
    const stateOf = (p) => {
        const w = harvestOpens?.(p) ?? null;
        return typeof w === "string" || w === null ? plantState(p, todayIso, w) : plantState(p, todayIso, w.opens, w.closes);
    };
    const plants = fanOutStacked((season?.plantings ?? []).map((p) => ({
        species: p.species,
        state: stateOf(p),
        at: regionCentroid(p.region),
        r: heldRadius(p.region),
    })));
    const ghosts = (prev?.plantings ?? []).map((p) => ({ species: p.species, at: regionCentroid(p.region), year: prev?.id, r: heldRadius(p.region) }));
    return { beds, plants, ghosts, bounds: plotBounds(beds) };
}
function bedPlate(bed, season, prev, todayIso, onBed, harvestOpens, opts) {
    const onBedPlantings = (season?.plantings ?? []).filter((p) => onBed(p.region));
    if (!onBedPlantings.length)
        return null;
    const ghostsOnBed = (prev?.plantings ?? []).filter((p) => onBed(p.region));
    const model = plateModel({ beds: [bed] }, { ...(season ?? { id: 0, plot: "" }), plantings: onBedPlantings }, { ...(prev ?? { id: 0, plot: "" }), plantings: ghostsOnBed }, todayIso, harvestOpens);
    const svg = renderPlate(model, { ...opts, label: opts?.label ?? `what is planted in ${bed.name} - north is up` });
    const counts = new Map();
    for (const p of model.plants)
        if (p.state !== "ended")
            counts.set(p.species, (counts.get(p.species) ?? 0) + 1);
    const plants = [...counts.entries()].map(([species, count]) => ({ species, count }));
    return { svg, plants, model };
}
const plateColours = (model) => speciesColours([...model.plants.map((p) => p.species), ...model.ghosts.map((g) => g.species)]);
const NS_SVG = "http://www.w3.org/2000/svg";
function plantMark(species, state, cx, cy, rr, colour) {
    const halo = document.createElementNS(NS_SVG, "circle");
    halo.setAttribute("cx", String(cx));
    halo.setAttribute("cy", String(cy));
    halo.setAttribute("r", String(rr));
    halo.setAttribute("class", "plate-halo");
    halo.setAttribute("data-species", species);
    const dot = document.createElementNS(NS_SVG, "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", String(rr));
    dot.setAttribute("class", `plate-plant plate-${state}`);
    dot.setAttribute("data-species", species);
    dot.setAttribute("data-state", state);
    dot.style.setProperty("--c", colour);
    const out = [halo, dot];
    if (state === "picked") {
        const heart = document.createElementNS(NS_SVG, "circle");
        heart.setAttribute("cx", String(cx));
        heart.setAttribute("cy", String(cy));
        heart.setAttribute("r", String(Math.max(2, rr * 0.34)));
        heart.setAttribute("class", "plate-pick");
        heart.setAttribute("data-species", species);
        out.push(heart);
    }
    return out;
}
const markRadius = (heldPx, floor) => Math.max(floor, Number.isFinite(heldPx) ? heldPx : 0);
const MIN_TALL = 0.35;
function plateFrame(W, H) {
    const vw = Math.max(W, H);
    return [vw, Math.min(vw, Math.max(H, vw * MIN_TALL))];
}
function renderPlate(model, opts) {
    const { minX, minY, w, h } = model.bounds;
    const side = Math.max(w, h);
    const PXX = opts?.pxPerSide ?? 320;
    const scale = PXX / side;
    const W = w * scale, H = h * scale, PAD = 10;
    const sx = (x) => (x - minX) * scale;
    const sy = (y) => H - (y - minY) * scale;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "gardenplate");
    const [vw, vh] = plateFrame(W, H);
    svg.setAttribute("viewBox", `${(W - vw) / 2 - PAD} ${(H - vh) / 2 - PAD} ${vw + 2 * PAD} ${vh + 2 * PAD}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts?.label ?? "your garden, drawn as it is now - north is up");
    const colourOf = opts?.colourOf ?? plateColours(model);
    for (const g of model.ghosts) {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", String(sx(g.at[0])));
        c.setAttribute("cy", String(sy(g.at[1])));
        c.setAttribute("r", String(markRadius(g.r * scale, 5)));
        c.setAttribute("class", "plate-ghost");
        c.setAttribute("data-species", g.species);
        c.style.setProperty("--c", colourOf(g.species));
        svg.appendChild(c);
    }
    for (const b of model.beds) {
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", b.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" "));
        poly.setAttribute("class", "plate-bed");
        poly.setAttribute("data-bed", b.name);
        svg.appendChild(poly);
    }
    for (const p of model.plants) {
        const cx = sx(p.at[0]), cy = sy(p.at[1]);
        const rr = markRadius(p.r * scale, 6);
        svg.append(...plantMark(p.species, p.state, cx, cy, rr, colourOf(p.species)));
        if (p.state === "ended") {
            const strike = document.createElementNS(SVG_NS, "line");
            strike.setAttribute("x1", String(cx - rr));
            strike.setAttribute("y1", String(cy - rr));
            strike.setAttribute("x2", String(cx + rr));
            strike.setAttribute("y2", String(cy + rr));
            strike.setAttribute("class", "plate-struck");
            strike.setAttribute("data-species", p.species);
            svg.appendChild(strike);
        }
    }
    return svg;
}
const STATE_WORDS = {
    planned: copy.plateStPlanned, ground: copy.plateStGround, window: copy.plateStWindow,
    picked: copy.plateStPicked, ended: copy.plateStEnded, carried: copy.plateStCarried,
};
const ghostWord = (year) => (year ? fillCopy("plateStGhostYear", { year }) : copy.plateStGhost);
const stateWord = (state) => STATE_WORDS[state];
function plateKey(model, nameOf) {
    const rows = [];
    const seen = new Map();
    for (const p of model.plants) {
        const k = `${p.species}|${p.state}`;
        const had = seen.get(k);
        if (had) {
            had.count++;
            continue;
        }
        const row = { species: p.species, name: nameOf(p.species), word: stateWord(p.state), state: p.state, count: 1 };
        seen.set(k, row);
        rows.push(row);
    }
    const ghosted = new Map();
    for (const g of model.ghosts) {
        const k = `${g.species}|${g.year ?? ""}`;
        const had = ghosted.get(k);
        if (had) {
            had.count++;
            continue;
        }
        const row = { species: g.species, name: nameOf(g.species), word: ghostWord(g.year), state: "ghost", year: g.year, count: 1 };
        ghosted.set(k, row);
        rows.push(row);
    }
    return rows;
}
function plateKeyLabel(r, counts = false) {
    return `${r.name}${counts && r.count > 1 ? ` × ${r.count}` : ""} - ${r.word}`;
}
function plateKeyInto(host, rows, opts) {
    if (!rows.length)
        return host;
    host.classList.add("plate-key");
    const marks = opts?.marks ?? null;
    const toggles = [];
    let picked = null;
    const pick = (species) => {
        picked = species;
        if (marks) {
            marks.classList.toggle("plate-picking", species !== null);
            for (const m of marks.querySelectorAll("[data-species]")) {
                m.classList.toggle("plate-dim", species !== null && m.dataset.species !== species);
            }
        }
        for (const b of toggles)
            b.setAttribute("aria-pressed", String(b.dataset.species === species));
    };
    for (const r of rows) {
        const item = document.createElement(opts?.tag ?? "span");
        item.className = "hg-leg";
        const sw = document.createElement("span");
        sw.className = `hg-sw plate-sw plate-${r.state}`;
        if (opts?.colourOf)
            sw.style.setProperty("--c", opts.colourOf(r.species));
        sw.dataset.species = r.species;
        const nm = document.createElement("span");
        nm.textContent = plateKeyLabel(r, opts?.counts);
        if (marks) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "plate-keybtn";
            b.dataset.species = r.species;
            b.setAttribute("aria-pressed", "false");
            b.append(sw, nm);
            b.addEventListener("click", (e) => { e.stopPropagation(); pick(picked === r.species ? null : r.species); });
            toggles.push(b);
            item.append(b);
        }
        else {
            item.append(sw, nm);
        }
        host.append(item);
    }
    return host;
}
function plateMarksInto(group, model, toPx, nameOf, colourOf = plateColours(model)) {
    const NS = "http://www.w3.org/2000/svg";
    const heldPx = (x, y, r) => { const [ax, ay] = toPx(x, y); const [bx, by] = toPx(x + r, y); return Math.hypot(bx - ax, by - ay); };
    for (const g of model.ghosts) {
        const [cx, cy] = toPx(g.at[0], g.at[1]);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(cx));
        c.setAttribute("cy", String(cy));
        c.setAttribute("r", String(markRadius(heldPx(g.at[0], g.at[1], g.r), 5)));
        c.setAttribute("class", "plate-ghost");
        c.setAttribute("data-species", g.species);
        c.style.setProperty("--c", colourOf(g.species));
        const t = document.createElementNS(NS, "title");
        t.textContent = `${nameOf(g.species)} - ${ghostWord(g.year)}`;
        c.append(t);
        group.append(c);
    }
    model.plants.forEach((p, i) => {
        const [cx, cy] = toPx(p.at[0], p.at[1]);
        const rr = markRadius(heldPx(p.at[0], p.at[1], p.r), 6);
        const marks = plantMark(p.species, p.state, cx, cy, rr, colourOf(p.species));
        const dot = marks[1];
        dot.setAttribute("data-idx", String(i));
        const t = document.createElementNS(NS, "title");
        t.textContent = `${nameOf(p.species)} - ${stateWord(p.state)}`;
        dot.append(t);
        group.append(...marks);
        if (p.state === "ended") {
            const line = document.createElementNS(NS, "line");
            line.setAttribute("x1", String(cx - rr));
            line.setAttribute("y1", String(cy - rr));
            line.setAttribute("x2", String(cx + rr));
            line.setAttribute("y2", String(cy + rr));
            line.setAttribute("class", "plate-struck");
            line.setAttribute("data-species", p.species);
            group.append(line);
        }
    });
}

function structureWord(s) {
    const w = { in_ground: copy.bedStructInGround, raised: copy.bedStructRaised,
        container: copy.bedStructContainer, field: copy.bedStructField };
    return w[s] ?? humanize(s);
}

function mergeSurvivingDetail(existing, fresh, bedRegion) {
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
async function markBedPlanted(bedName, bundle, site) {
    const sid = seasonId();
    if (!app.logDb || sid == null)
        return { ok: false, reason: copy.plLogNotReady };
    const season = await getSeason(app.logDb, app.currentPlotId, sid);
    if (!season)
        return { ok: false, reason: copy.plNoOpenSeason };
    const entry = (Array.isArray(season.plan) ? season.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    const myBedDraft = entry?.mybed === true && Array.isArray(entry.plantings) ? entry.plantings : null;
    if (!bed)
        return { ok: false, reason: copy.plBedGone };
    if (!guild && !myBedDraft)
        return { ok: false, reason: copy.plNoDraftToPlant };
    const today = localTodayIso();
    const todayYear = Number(today.slice(0, 4));
    if (todayYear !== season.id) {
        return { ok: false, canAdvanceTo: todayYear,
            reason: fillCopy("plYearMismatch", { year: todayYear, open: season.id }) };
    }
    const planted = myBedDraft
        ? materializeMyBedDraft(season, bed.region, bedName, myBedDraft, today)
        : materializeDraftInto(season, bed, guild, site, bundle, today, roleOverridesOf(entry));
    await putSeason(app.logDb, season);
    await setBedPlanted(app.logDb, app.currentPlotId, bedName, true);
    return { ok: true, planted };
}
async function markBedPlantedAdvancingSeason(bedName, bundle, site) {
    const openId = seasonId();
    if (!app.logDb || openId == null)
        return { ok: false, reason: copy.plLogNotReady };
    const open = await getSeason(app.logDb, app.currentPlotId, openId);
    const entry = (Array.isArray(open?.plan) ? open.plan : [])
        .find((e) => e.area === bedName);
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
    const myBedDraft = entry?.mybed === true && Array.isArray(entry.plantings) ? entry.plantings : null;
    if (!bed)
        return { ok: false, reason: copy.plBedGone };
    if (!guild && !myBedDraft)
        return { ok: false, reason: copy.plNoDraftToPlant };
    const today = localTodayIso();
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
    const sid = seasonId();
    if (!app.logDb || sid == null)
        return { ok: false, reason: copy.plLogNotReady };
    const season = await getSeason(app.logDb, app.currentPlotId, sid);
    if (!season)
        return { ok: false, reason: copy.plNoOpenSeason };
    const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
    if (!bed)
        return { ok: false, reason: copy.plBedGone };
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
function offSeasonNudge(guild, bundle, lastFrost, firstFreeze, todayISO, lat = null, site = null) {
    if (!lastFrost && !firstFreeze)
        return null;
    const sd = (mmdd) => seasonDoy(mmddDoyOf(mmdd) ?? 0, lat);
    const today = sd(todayISO.slice(5));
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
            ? named.map((x) => x.label).join(copy.plAndJoin)
            : fillCopy("plAndMore", { list: named.map((x) => x.label).join(", "), n: u.length - 2 });
        return { text, marks: named.map((x) => ({ label: x.label, species: x.sid, group: x.group })) };
    };
    const isTender = (sp) => sp.frost_tolerance !== "hardy" && sp.frost_tolerance !== "half_hardy";
    const tenderCrops = () => refs.filter((r) => { const sp = byId.get(r.sid); return !!sp && isTender(sp); });
    if (lastFrost && today < sd(lastFrost)) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: fillCopy("plNudgeBeforeFrost", { date: humanizeMMDD(lastFrost), crops: l.text }), marks: l.marks };
    }
    if (firstFreeze && today > fallSeasonDoy(firstFreeze, lat)) {
        const t = tenderCrops();
        if (!t.length)
            return null;
        const l = list(t);
        return { text: fillCopy("plNudgeAfterFreeze", { date: humanizeMMDD(firstFreeze), crops: l.text }), marks: l.marks };
    }
    if (firstFreeze) {
        const late = [];
        let bound = null;
        for (const r of refs) {
            const sp = byId.get(r.sid);
            const model = sp ? resolvedField(sp, r.group, "scheduling_model") : undefined;
            if (!sp || (model !== "dtm" && model !== "gdd"))
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
            const f = cropFreeze({ first_freeze_32f_p50: firstFreeze, first_freeze_28f: site?.first_freeze_28f ?? null }, r.group ? `${r.sid}/${r.group}` : r.sid, bundle);
            if (!f.mmdd)
                continue;
            const mat = today + dtm[0];
            if (mat > fallSeasonDoy(f.mmdd, lat)) {
                late.push({ sid: r.sid, group: r.group });
                if (!bound || fallSeasonDoy(f.mmdd, lat) < fallSeasonDoy(bound.mmdd, lat))
                    bound = { mmdd: f.mmdd, line: f.line_f };
            }
        }
        if (late.length) {
            const l = list(late);
            const hard = !!bound && bound.line < 32;
            return { text: fillCopy(hard ? "plNudgeTooLateHard" : "plNudgeTooLate", { crops: l.text, date: humanizeMMDD(hard ? bound.mmdd : firstFreeze) }), marks: l.marks };
        }
    }
    return null;
}

const NO_DATES_YET = copy.plNoDatesYet;
const jobWhat = (kind, afterFrost) => kind === "sow_climber" ? copy.plJobSowClimber : kind === "install_support" ? copy.plJobSupport
    : kind === "plant_cold_hardy" ? copy.plTaskBeforeFrost : afterFrost;
function teamPlantWindow(guild, bed, site, bundle, overrides, seasonYear, todayIso, firstFreeze, springShiftDays = 0) {
    if (seasonYear !== seasonYearOf(todayIso, site.lat))
        return { status: "open" };
    const PLANTING = new Set(["plant_after_last_frost", "plant_cold_hardy", "sow_climber", "install_support"]);
    const shifted = (t) => springShiftDays && (isTeamPlantJob(t.kind) || t.kind === "sow_climber") ? shiftDays(seasonYear, t.date.slice(5), springShiftDays, site.lat ?? null) ?? t.date : t.date;
    const tasks = gardenTasks(guild, site.lat ?? null, site.lon ?? null, seasonYear, bundle)
        .filter((t) => PLANTING.has(t.kind)).map((t) => ({ ...t, date: shifted(t) })).sort((a, b) => a.date.localeCompare(b.date));
    if (!tasks.length)
        return { status: "none" };
    const t0 = tasks.find((t) => t.date >= todayIso) ?? null;
    if (t0)
        return { status: "open", first: t0 };
    const late = tasks[tasks.length - 1].date;
    const placed = placeGuildPlants(guild, bed, site, bundle, overrides);
    const freezes = typeof firstFreeze === "string" || firstFreeze == null ? { first_freeze_32f_p50: firstFreeze ?? null, first_freeze_28f: null } : firstFreeze;
    const groupOf = new Map();
    for (const r of guild.roles ?? []) {
        const ov = overrides?.get(r.id);
        const sid = ov ? ov.species : r.canonical;
        if (typeof sid === "string" && !groupOf.has(sid))
            groupOf.set(sid, ov ? ov.group : typeof r.canonical_group === "string" ? r.canonical_group : null);
    }
    for (const m of guild.members ?? [])
        if (typeof m.species === "string" && !groupOf.has(m.species))
            groupOf.set(m.species, typeof m.group === "string" ? m.group : null);
    let holdBy = null;
    for (const sid of new Set(placed.map((p) => p.species))) {
        const sp = bundle.species.find((s) => s.id === sid);
        const group = groupOf.has(sid) ? groupOf.get(sid) : placed.find((p) => p.species === sid)?.group ?? null;
        const dtm = datedByDays(sp, group) ? resolveDtm(sp, group) : null;
        const c = dtm ? cropCloseOf({ freezeSite: freezes }, sid, group, bundle) : null;
        if (!dtm || !c)
            continue;
        const closeBy = new Date(Date.parse(`${fallDate(c.mmdd, seasonYear, site.lat)}T12:00:00Z`) - dtm[0] * 86_400_000).toISOString().slice(0, 10);
        if (!holdBy || closeBy < holdBy.closeBy)
            holdBy = { species: sid, group, closeBy, days: dtm[0], freeze: c.mmdd, line: c.line };
    }
    if (holdBy && holdBy.closeBy < todayIso)
        return { status: "passed", late, holdBy };
    return { status: "open", late, ...(holdBy ? { holdBy } : {}) };
}
function heldByLine(bundle, h) {
    if (!h)
        return "";
    const crop = plantingLabel(bundle, h.species, h.group) || commonName(bundle, h.species);
    return fillCopy(h.line < 32 ? "plHeldByHard" : "plHeldBy", { crop, days: h.days, freeze: fmtMonthDay(h.freeze) });
}
function gardenBounds(site, bundle) {
    if (site.lat == null || site.lon == null)
        return { freeze: null, shift: 0 };
    const fr = gardenFrost(bundle, site.lat, site.lon, app.logSnapshot.seasons ?? []);
    return { freeze: fr.freezeSite, shift: fr.springShiftDays };
}
let bedSheetOpener = null;
function installPlanSeams(bundle, site) {
    app.markBedPlantedFromPlan = async (bedName, opts) => {
        const season = openSeason();
        const now = new Date();
        const nowSeason = seasonYearOf(localTodayIso(now), site.lat);
        if (season && !opts?.advance && nowSeason !== season.id) {
            const yr = nowSeason;
            return { ok: false, canAdvanceTo: yr,
                reason: fillCopy("plYearMismatchStart", { year: yr, open: season.id }) };
        }
        if (season && !opts?.advance && !opts?.force) {
            const entry = (Array.isArray(season.plan) ? season.plan : []).find((e) => e.area === bedName);
            const draftGuild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) ?? null : null;
            const csite = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle)?.site ?? null : null;
            const nudge = draftGuild ? offSeasonNudge(draftGuild, bundle, csite?.last_frost_32f?.p50 ?? null, csite?.first_freeze_32f_p50 ?? null, localTodayIso(now), site.lat, csite) : null;
            if (nudge)
                return { ok: false, nudge: nudge.text };
            const bedRec = app.logSnapshot.beds.find((b) => b.name === bedName);
            if (draftGuild && bedRec) {
                const fresh = guildPlantings(draftGuild, bedRec, site, bundle, roleOverridesOf(entry));
                const { merged } = mergeSurvivingDetail(season.plantings ?? [], fresh, bedRec.region);
                const kept = merged.filter((m) => !fresh.includes(m) && !!(m.sown || m.transplanted)).length;
                if (kept > 0) {
                    const added = merged.length - kept;
                    return { ok: false, nudge: fillCopy(kept === 1 ? "plAlreadyInOne" : "plAlreadyInMany", { n: kept, added }) };
                }
            }
        }
        const r = opts?.advance ? await markBedPlantedAdvancingSeason(bedName, bundle, site) : await markBedPlanted(bedName, bundle, site);
        if (r.ok) {
            await app.logRefresh?.();
            const newId = "seasonId" in r ? r.seasonId : undefined;
            if (typeof newId === "number" && seasonId() !== newId) {
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
    app.openBedSheet = (bedName) => {
        const sheet = document.getElementById("bedsheet");
        const body = document.getElementById("bedsheetbody");
        if (!sheet || !body)
            return;
        const season = openSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        const pfGuildId = !entry?.guild
            ? (season?.planted_from ?? [])
                .find((r) => r.area === bedName)?.guild
            : undefined;
        const plantedGuild = pfGuildId ? bundle.guilds.find((g) => g.id === pfGuildId) : undefined;
        if (!bed) {
            toast(copy.plBedGoneStraight);
            return;
        }
        const liveOnBed = (Array.isArray(season?.plantings) ? season.plantings : [])
            .filter((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
        if (!guild && liveOnBed.length === 0) {
            toast(copy.plSheetNoPlants);
            return;
        }
        body.replaceChildren();
        const pts = regionPoints(bed.region);
        const bw = Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]));
        const bl = Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
        const fmtDate = fmtMonthDay;
        const seasonYear = (seasonId() ?? new Date().getFullYear()) + (guild && bedPlantWindowFor(bedName).status === "passed" ? 1 : 0);
        el$1(body, "p", "bedsheet-kicker", fillCopy("plSheetKicker", { year: seasonYear }));
        el$1(body, "h1", "bedsheet-h1", bed.name);
        el$1(body, "p", "bedsheet-sub", [guild ? displayName(guild) : plantedGuild ? displayName(plantedGuild) : copy.plPlanted, `${fmtLen(bw)} × ${fmtLen(bl)}`,
            bed.structure ? structureWord(bed.structure) : null,
            bed.sun === "full" ? copy.plFullSunLc : bed.sun === "part_shade" ? copy.plPartShadeLc : null].filter(Boolean).join(" · "));
        const skinSeason = document.documentElement.dataset.season ?? "autumn";
        const voiceKey = `homeVoice${skinSeason.charAt(0).toUpperCase()}${skinSeason.slice(1)}`;
        const hereSite = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle)?.site ?? null : null;
        const seasonalLine = (plateFrostLine(hereSite) ?? copy[voiceKey] ?? copy.homeVoiceAutumn);
        const voiceTeam = guild ?? plantedGuild;
        const lead = voiceTeam ? (mechanismRows(voiceTeam, bundle).rows[0]?.claim ?? null) : null;
        const voiceLine = voiceTeam && lead ? `${displayName(voiceTeam)}: ${plainClaim(stripRuleCitations(teamClaim(voiceTeam, lead)), gardenLat()).replace(/\.$/, "")}.` : seasonalLine;
        if (voiceLine)
            el$1(body, "p", "bedsheet-voice", voiceLine);
        {
            const orn = document.createElementNS(SVG_NS$1, "svg");
            orn.setAttribute("class", "sprig-orn bedsheet-orn");
            orn.setAttribute("viewBox", "0 0 24 24");
            orn.setAttribute("aria-hidden", "true");
            const u = document.createElementNS(SVG_NS$1, "use");
            u.setAttribute("href", "#sprig");
            orn.appendChild(u);
            body.appendChild(orn);
        }
        const prevSeason = seasonById((seasonId() ?? 0) - 1);
        const todayIso = localTodayIso();
        const glimpse = guild
            ? guildPlacementGlimpse(guild, bed, site, bundle, roleOverridesOf(entry))
            : bedPlate(bed, season ?? null, prevSeason, todayIso, (r) => plantingOnBed(r, bed.region), undefined, { colourOf: gardenColours() });
        if (glimpse) {
            const fig = el$1(body, "figure", "bedsheet-fig");
            glimpse.svg.setAttribute("role", "img");
            glimpse.svg.setAttribute("aria-label", fillCopy(guild ? "plSheetAriaPlan" : "plSheetAriaPlanted", { bed: bed.name }));
            fig.appendChild(glimpse.svg);
            const cap = document.createElement("figcaption");
            cap.textContent = guild ? copy.plSheetCapPlan : copy.plSheetCapPlanted;
            fig.appendChild(cap);
            const ul = el$1(body, "ul", "bedsheet-legend");
            if (!guild && "model" in glimpse) {
                plateKeyInto(ul, plateKey(glimpse.model, (sid) => commonName(bundle, sid)), { tag: "li", counts: true, colourOf: gardenColours(), marks: glimpse.svg });
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
            const buyH = el$1(body, "h2", "bedsheet-h2", copy.plSheetToGather);
            const buyList = el$1(body, "ul", "bedsheet-buy");
            void app.planReceipt?.(bedName).then((r) => {
                if (!r)
                    return;
                if (!r.sized) {
                    buyH.textContent = copy.plSheetNotSized;
                    return;
                }
                if (r.toBuy === 0) {
                    buyH.textContent = copy.plSheetSeedBoxCovers;
                    return;
                }
                for (const k of r.kinds) {
                    const li = document.createElement("li");
                    li.textContent = `${k.label} × ${k.n}${k.owned ? copy.plInSeedBox : ""}`;
                    buyList.appendChild(li);
                }
            });
        }
        else {
            const sownDates = liveOnBed.map((p) => p.sown).filter((s) => !!s).sort();
            if (sownDates.length)
                el$1(body, "p", "bedsheet-note", fillCopy("plPlantedOn", { date: fmtDate(sownDates[0]) }));
        }
        el$1(body, "h2", "bedsheet-h2", copy.plSheetThroughSeason);
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle)?.site ?? null : null;
        const lf = clim?.last_frost_32f?.p50, ff = clim?.first_freeze_32f_p50;
        const allYear = seasonAllYearLine(clim);
        if (allYear)
            el$1(body, "p", "bedsheet-season", allYear);
        else if (lf || ff)
            el$1(body, "p", "bedsheet-season", [lf ? fillCopy("plLastFrostUsually", { date: fmtDate(seasonDate(lf, seasonYear, site.lat)) }) : null, ff ? fillCopy("plFirstFreezeUsually", { date: fmtDate(fallDate(ff, seasonYear, site.lat)) }) : null].filter(Boolean).join(" · "));
        const tl = el$1(body, "ul", "bedsheet-tasks");
        if (guild && !onWarmthPath(clim)) {
            const tasks = gardenTasks(guild, site.lat ?? null, site.lon ?? null, seasonYear, bundle).slice().sort((a, b) => a.date.localeCompare(b.date));
            if (!tasks.length) {
                const li = document.createElement("li");
                li.textContent = NO_DATES_YET;
                tl.appendChild(li);
            }
            for (const t of tasks) {
                const li = document.createElement("li");
                const what = t.kind === "sow_climber" ? `${fillCopy("plTaskSow", { plant: t.species ? commonName(bundle, t.species) : copy.plTheClimber })}${t.support ? " " + fillCopy("plTaskItsSupport", { plant: commonName(bundle, t.support) }) : ""}`
                    : t.kind === "install_support" ? `${copy.plJobSupport}${t.species ? ` (${commonName(bundle, t.species)})` : ""}`
                        : t.kind === "log_first_freeze" ? copy.plTaskNoteFreeze : jobWhat(t.kind, copy.plTaskAfterFrost);
                li.textContent = `${fmtDate(t.date)} - ${what}`;
                tl.appendChild(li);
            }
        }
        else {
            const jobs = app.bedCalendarJobs?.(bedName, seasonYear) ?? [];
            if (!jobs.length) {
                const li = document.createElement("li");
                li.textContent = site.lat == null ? NO_DATES_YET : copy.plSheetNothingDated;
                tl.appendChild(li);
            }
            for (const j of jobs) {
                const li = document.createElement("li");
                li.textContent = `${fmtDate(j.date)} - ${j.text}`;
                tl.appendChild(li);
            }
        }
        el$1(body, "p", "bedsheet-foot", fillCopy("plSheetFoot", { date: fmtMonthDayYear(localTodayIso()) }));
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
        const season = openSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return null;
        const hit = placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(entry)).find((p) => p.species === species);
        return hit ? { x: hit.x, y: hit.y, r: hit.r, group: hit.group } : null;
    };
    const windowMemo = new Map();
    const bedPlantWindowFor = (bedName, draft) => {
        const season = openSeason();
        const entry = draft ?? (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return { status: "none", first: null, late: null };
        if (!bedTeamStatus(guild, bed, bundle).fits)
            return { status: "none", first: null, late: null };
        const seasonYear = seasonId() ?? new Date().getFullYear();
        const todayIso = localTodayIso();
        const { freeze, shift } = gardenBounds(site, bundle);
        const key = JSON.stringify([todayIso, seasonYear, entry, bed, freeze, shift]);
        let w = windowMemo.get(key);
        if (!w) {
            w = teamPlantWindow(guild, bed, site, bundle, roleOverridesOf(entry), seasonYear, todayIso, freeze, shift);
            windowMemo.set(key, w);
        }
        return { status: w.status, first: w.first ? { date: w.first.date, what: jobWhat(w.first.kind, copy.plTaskAfterFrost) } : null, late: w.late ?? null,
            ...(w.status === "open" && w.late ? { until: w.holdBy?.closeBy ?? null } : {}),
            ...(w.status === "passed" && w.holdBy ? { heldBy: heldByLine(bundle, w.holdBy) } : {}) };
    };
    app.bedPlantWindow = (bedName) => bedPlantWindowFor(bedName);
    app.draftPlantWindow = (draft) => bedPlantWindowFor(draft.area, draft);
    app.planReceipt = async (bedName) => {
        const season = openSeason();
        const entry = (Array.isArray(season?.plan) ? season.plan : []).find((e) => e.area === bedName);
        const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
        const guild = entry?.guild ? bundle.guilds.find((g) => g.id === entry.guild) : undefined;
        if (!entry || !bed || !guild)
            return null;
        const placed = placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(entry));
        const counts = new Map();
        for (const p of placed) {
            const k = `${p.species}|${p.group ?? ""}`;
            const c = counts.get(k) ?? { sid: p.species, group: p.group ?? null, n: 0 };
            c.n++;
            counts.set(k, c);
        }
        let seeds = [];
        try {
            if (app.logDb)
                seeds = await listSeeds(app.logDb);
        }
        catch { }
        const ownedOf = (sid, group) => seeds.some((sd) => sd.species === sid && (!group || !sd.group || sd.group === group));
        const kinds = [...counts.values()].map(({ sid, group, n }) => ({ label: plantingLabel(bundle, sid, group), n, owned: ownedOf(sid, group) }))
            .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
        const win = bedPlantWindowFor(bedName);
        return { sized: placed.length > 0, plants: placed.length, kinds, toBuy: kinds.filter((k) => !k.owned).length,
            areaNeededM2: guild.footprint_min_m2 ?? null, bedAreaM2: area(bed.region),
            first: win.first, keptForSpring: win.status === "passed", late: win.status === "open" ? win.late ?? null : null,
            until: win.status === "open" ? win.until ?? null : null,
            ...(win.heldBy ? { heldBy: win.heldBy } : {}) };
    };
}

const FIRST_BED_W = 1.2192, FIRST_BED_L = 2.4384;
const firstBedSize = (metric) => (metric ? [1.2, 2.4] : [FIRST_BED_W, FIRST_BED_L]);
function nextBedName(beds, nameOf = (n) => `Bed ${n}`) {
    const taken = new Set(beds.map((b) => b.name));
    for (let n = 1;; n++) {
        const name = nameOf(n);
        if (!taken.has(name))
            return name;
    }
}
function nextOrigin(beds) {
    let right = 0;
    for (const b of beds) {
        try {
            for (const [x] of regionPoints(parseRegion(b.region)))
                right = Math.max(right, x);
        }
        catch { }
    }
    const r2 = (v) => Math.round(v * 100) / 100;
    return { x: beds.length ? r2(right + 0.5) : 0, y: 0 };
}

let localHelp = null;
function withLocalHelp(fn) {
    if (localHelp)
        fn(localHelp);
    else
        void import('./panels/extension.js').then((m) => { localHelp = m; fn(m); }, () => { });
}

function ledgerRing(seasons, site, lat = null) {
    const min = MIN_SEASONS;
    if (!site && lat == null) {
        return { state: "wait", n: 0, min, frac: 0, center: `0/${min}`,
            label: copy.lrNoSite };
    }
    const cal = frostCalibration(seasons, site, lat);
    if (cal.spring.calibrated || cal.fall.calibrated) {
        return { state: "live", n: cal.min_seasons, min: cal.min_seasons, frac: 1, center: copy.earnEarned,
            label: cal.spring.own ? copy.lrLiveOwn : copy.lrLive };
    }
    const n = Math.max(cal.spring.n, cal.fall.n);
    const frac = cal.min_seasons > 0 ? Math.min(1, n / cal.min_seasons) : 0;
    if (n > 0) {
        const left = Math.max(0, cal.min_seasons - n);
        return { state: "part", n, min: cal.min_seasons, frac, center: `${n}/${cal.min_seasons}`,
            label: fillCopy(left === 1 ? "lrPartOne" : "lrPartMany", { left }) };
    }
    return { state: "wait", n: 0, min: cal.min_seasons, frac: 0, center: `0/${cal.min_seasons}`,
        label: fillCopy("lrWait", { n: cal.min_seasons }) };
}

function groundKeys(obs, plot) {
    const seen = new Set();
    const keys = [];
    for (const o of obs) {
        const rec = o;
        if (!rec || typeof rec !== "object" || rec.plot !== plot)
            continue;
        const key = rec.region ?? null;
        const j = JSON.stringify(key);
        if (seen.has(j))
            continue;
        seen.add(j);
        keys.push(key);
    }
    return keys;
}
function ledgerEarned(seasons, site, soilObservations, plot, lat = null) {
    const rows = [];
    if (!site && lat == null) {
        rows.push({ key: "frost", state: "wait", badge: copy.earnNotYet, text: copy.earnFrostNoLoc });
    }
    else {
        const cal = frostCalibration(seasons, site, lat);
        if (cal.spring.calibrated || cal.fall.calibrated) {
            rows.push({ key: "frost", state: "live", badge: copy.earnEarned, text: cal.spring.own ? copy.earnFrostLiveOwn : copy.earnFrostLive });
        }
        else {
            const n = Math.max(cal.spring.n, cal.fall.n);
            if (n > 0) {
                const left = Math.max(0, cal.min_seasons - n);
                rows.push({ key: "frost", state: "part", badge: fillCopy("earnOf", { n, min: cal.min_seasons }),
                    text: fillCopy(left === 1 ? "earnFrostPartOne" : "earnFrostPartMany", { left }) });
            }
            else if (frostAsked(site, lat)) {
                rows.push({ key: "frost", state: "wait", badge: copy.earnNotYet, text: fillCopy("earnFrostWait", { min: cal.min_seasons }) });
            }
        }
    }
    let phLive = false;
    let phLab = false;
    let phUnsure = false;
    let drainageLive = false;
    for (const key of groundKeys(soilObservations, plot)) {
        const g = resolveGround(soilObservations, plot, key);
        if (typeof g.fields.ph === "number") {
            if (phComparable(g.src.ph, g.fields.ph_method))
                phLive = true;
            else if ((g.fields.ph_method ?? "unknown") === "unknown")
                phUnsure = true;
            else
                phLab = true;
        }
        const d = g.fields.drainage;
        if (typeof d === "string" && d !== "unknown")
            drainageLive = true;
    }
    rows.push(phLive
        ? { key: "ph", state: "live", badge: copy.earnEarned, text: copy.earnPhLive }
        : { key: "ph", state: "wait", badge: copy.earnNotYet,
            text: phUnsure ? copy.earnPhUnsure : phLab ? copy.earnPhLab : copy.earnPhWait });
    rows.push(drainageLive
        ? { key: "drainage", state: "live", badge: copy.earnEarned, text: copy.earnDrainLive }
        : { key: "drainage", state: "wait", badge: copy.earnNotYet, text: copy.earnDrainWait });
    return rows;
}

function feedTime(iso) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    const days = Math.floor(mins / (60 * 24));
    return mins < 1 ? copy.feedJustNow : mins < 60 ? fillCopy("feedMins", { n: mins })
        : mins < 60 * 24 ? fillCopy("feedHours", { n: Math.round(mins / 60) })
            : days < 7 ? pluralCopy("feedDays", days)
                : new Date(iso).toLocaleDateString(dateLocale());
}
function postBody(text, cls) {
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text;
    return p;
}

const regionPts = (r) => {
    if (r.shape === "rect" && r.x != null && r.y != null && r.w != null && r.h != null) {
        return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    }
    if (r.shape === "polygon" && Array.isArray(r.points)) {
        return r.points.filter((p) => p.length >= 2).map((p) => [p[0], p[1]]);
    }
    return [];
};
const regionCentre = (r) => {
    const pts = regionPts(r);
    if (!pts.length)
        return null;
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};
function plateScale(frame, viewW, viewH, fill = 0.82) {
    return Math.max(frame.w / (viewW * fill), frame.h / (viewH * fill), 1e-6);
}
function project(pt, v) {
    return [v.w / 2 + (pt[0] - v.cx) / v.mpp, v.h / 2 - (pt[1] - v.cy) / v.mpp];
}
function gardenFrame(beds, plantings) {
    const gBeds = [];
    for (const b of beds) {
        const pts = regionPts(b.region);
        if (pts.length >= 3)
            gBeds.push({ name: b.name, planted: !!b.planted, pts, ...(b.structure ? { structure: b.structure } : {}) });
    }
    if (!gBeds.length)
        return null;
    const xs = gBeds.flatMap((b) => b.pts.map((p) => p[0]));
    const ys = gBeds.flatMap((b) => b.pts.map((p) => p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const dots = [];
    for (const p of plantings) {
        const c = regionCentre(p.region);
        if (c && c[0] >= minX - 1 && c[0] <= maxX + 1 && c[1] >= minY - 1 && c[1] <= maxY + 1) {
            dots.push({ x: c[0], y: c[1], species: p.species });
        }
    }
    return {
        beds: gBeds, dots,
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        w: Math.max(0.5, maxX - minX), h: Math.max(0.5, maxY - minY),
    };
}

const VIEW_W = 440, VIEW_H = 250;
const FIT_FRAC = 0.82;
const yardCtx = new WeakMap();
let figSeq = 0;
function renderGlance(frame, anchor, onBed, onOpen, plate = null, dateline = null) {
    const NS = "http://www.w3.org/2000/svg";
    const wrap = document.createElement("div");
    wrap.className = "home-view";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "home-glance");
    svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", fillCopy("hfGlanceAria", { beds: frame.beds.map((b) => b.name).join(", ") }));
    const mpp = plateScale(frame, VIEW_W, VIEW_H, FIT_FRAC);
    svg.dataset.mpp = mpp.toFixed(4);
    const proj = { cx: frame.cx, cy: frame.cy, mpp, w: VIEW_W, h: VIEW_H };
    const toPx = (xm, ym) => project([xm, ym], proj);
    const uid = `hg${++figSeq}`;
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML =
        `<pattern id="${uid}-lawn" width="14" height="14" patternUnits="userSpaceOnUse">` +
            `<path class="hg-blade" d="M2 11l1.6-3.4M7 12.5l1.4-3M11 6l1.2-2.6M5 5l1-2.2"/></pattern>` +
            `<pattern id="${uid}-soil" width="7" height="7" patternUnits="userSpaceOnUse">` +
            `<circle class="hg-grain" cx="1.6" cy="1.8" r=".75"/><circle class="hg-grain" cx="5.1" cy="4.6" r=".6"/><circle class="hg-grain" cx="3.4" cy="6.2" r=".45"/></pattern>` +
            `<radialGradient id="${uid}-vig" cx="50%" cy="46%" r="72%">` +
            `<stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".2"/></radialGradient>`;
    svg.append(defs);
    const rect = (cls, fill) => {
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("class", cls);
        r.setAttribute("x", "0");
        r.setAttribute("y", "0");
        r.setAttribute("width", String(VIEW_W));
        r.setAttribute("height", String(VIEW_H));
        if (fill)
            r.setAttribute("fill", fill);
        return r;
    };
    svg.append(rect("hg-ground"), rect("hg-lawnmark", `url(#${uid}-lawn)`), rect("hg-vignette", `url(#${uid}-vig)`));
    for (const bed of frame.beds) {
        const pts = bed.pts.map((p) => toPx(p[0], p[1]));
        const shade = document.createElementNS(NS, "polygon");
        shade.setAttribute("class", "hg-shade");
        shade.setAttribute("points", pts.map(([x, y]) => `${x + 2.5},${y + 3.5}`).join(" "));
        svg.append(shade);
        const poly = document.createElementNS(NS, "polygon");
        const edge = bed.structure === "in_ground" || bed.structure === "field" ? " inground" : "";
        poly.setAttribute("class", (bed.planted ? "hg-bed planted" : "hg-bed") + edge + (plate ? " plate-bed" : ""));
        poly.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
        poly.dataset.bed = bed.name;
        poly.addEventListener("click", (ev) => { ev.stopPropagation(); onBed(bed.name); });
        for (const [k, v] of [["tabindex", "0"], ["role", "button"], ["aria-label", bed.name]])
            poly.setAttribute(k, v);
        poly.addEventListener("keydown", (ev) => {
            if (ev.key !== "Enter" && ev.key !== " ")
                return;
            ev.preventDefault();
            ev.stopPropagation();
            onBed(bed.name);
        });
        svg.append(poly);
        const grain = document.createElementNS(NS, "polygon");
        grain.setAttribute("class", "hg-soilgrain");
        grain.setAttribute("fill", `url(#${uid}-soil)`);
        grain.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
        svg.append(grain);
    }
    const nameOf = (sid) => app.speciesName?.(sid) ?? sid;
    if (plate)
        paintMarks(svg, plate, toPx, nameOf);
    const colorOf = gardenColours();
    const legend = new Map();
    const unit = Math.max(VIEW_W, VIEW_H);
    for (const d of plate ? [] : frame.dots) {
        const [px, py] = toPx(d.x, d.y);
        const colour = colorOf(d.species);
        const name = app.speciesName?.(d.species) ?? d.species;
        if (!legend.has(d.species))
            legend.set(d.species, colour);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "hg-dot");
        c.setAttribute("cx", String(px));
        c.setAttribute("cy", String(py));
        c.setAttribute("r", String(Math.min(Math.max(0.18 / mpp, 3), unit * 0.02)));
        c.style.fill = colour;
        c.setAttribute("data-species", d.species);
        const tip = document.createElementNS(NS, "title");
        tip.textContent = name;
        c.append(tip);
        svg.append(c);
    }
    for (const bed of frame.beds) {
        const cx = bed.pts.reduce((a, p) => a + p[0], 0) / bed.pts.length;
        const cy = bed.pts.reduce((a, p) => a + p[1], 0) / bed.pts.length;
        const [px, py] = toPx(cx, cy);
        const label = document.createElementNS(NS, "text");
        label.setAttribute("class", plate ? "hg-name plate-bedname" : "hg-name");
        label.setAttribute("x", String(px));
        label.setAttribute("y", String(py));
        label.textContent = bed.name;
        svg.append(label);
    }
    svg.addEventListener("click", onOpen);
    wrap.append(svg);
    yardCtx.set(wrap, { svg, toPx, nameOf });
    if (plate)
        paintCaptionAndKey(wrap, svg, plate, dateline, nameOf);
    if (legend.size) {
        const row = document.createElement("div");
        row.className = "hg-legend";
        for (const [sid, colour] of legend) {
            const item = document.createElement("span");
            item.className = "hg-leg";
            const sw = document.createElement("span");
            sw.className = "hg-sw";
            sw.style.background = colour;
            const nm = document.createElement("span");
            nm.textContent = app.speciesName?.(sid) ?? sid;
            item.append(sw, nm);
            row.append(item);
        }
        wrap.append(row);
    }
    return wrap;
}
function paintMarks(svg, plate, toPx, nameOf) {
    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "gardenplate");
    plateMarksInto(g, plate, toPx, nameOf, gardenColours());
    const old = svg.querySelector(":scope > g.gardenplate");
    if (old)
        old.replaceWith(g);
    else
        svg.append(g);
}
function paintCaptionAndKey(wrap, svg, plate, dateline, nameOf) {
    wrap.querySelectorAll(":scope > .home-plate-cap, :scope > .plate-key").forEach((n) => n.remove());
    const after = [];
    if (dateline) {
        const cap = document.createElement("p");
        cap.className = "home-plate-cap";
        cap.textContent = dateline;
        after.push(cap);
    }
    const rows = plateKey(plate, nameOf);
    if (rows.length) {
        const key = document.createElement("div");
        key.className = "hg-legend";
        after.push(plateKeyInto(key, rows, { colourOf: gardenColours(), marks: svg }));
    }
    let anchor = svg;
    while (anchor.parentElement && anchor.parentElement !== wrap)
        anchor = anchor.parentElement;
    anchor.after(...after);
}
function yardFigure(frame, anchor, onBed, onOpen, plate, dateline) {
    return renderGlance(frame, anchor, onBed, onOpen, plate, dateline);
}
function yardRepaint(wrap, plate, dateline) {
    const c = yardCtx.get(wrap);
    if (!c)
        return;
    paintMarks(c.svg, plate, c.toPx, c.nameOf);
    paintCaptionAndKey(wrap, c.svg, plate, dateline, c.nameOf);
}
function hasGround() {
    return app.logSnapshot.beds.length > 0 || app.logSnapshot.seasons.length > 0;
}

function gardenNameOf(p, id = p?.id ?? "") {
    const n = p?.name;
    if (typeof n === "string" && n.trim())
        return n;
    return id === "plot_home" || id === "draft_home" ? copy.gmHomeGarden : copy.hmYourGarden;
}

const SOIL_COMPOSER_EVENTS = [
    ["soil_waterlogged", copy.lgSoilWaterlogged],
    ["soil_lime", copy.lgSoilLime],
    ["soil_sulfur", copy.lgSoilSulfur],
    ["soil_compost", copy.lgSoilCompost],
];
const exampleData = () => import('./example.js');
let justLogged = null;
let lastEarnedSite = null;
let lastEarnedLat = null;
function renderEarned(site, seasons, plot, lat = null) {
    lastEarnedSite = site;
    lastEarnedLat = lat;
    const panel = document.getElementById("earnedstrip");
    if (!panel)
        return;
    panel.innerHTML = "";
    for (const row of ledgerEarned(seasons, site, app.soilObservations ?? [], plot, lat)) {
        const div = document.createElement("div");
        div.className = `earnedrow ${row.state}`;
        const st = document.createElement("span");
        st.className = "earnedst";
        st.textContent = row.badge;
        const what = document.createElement("span");
        what.className = "earnedwhat";
        what.textContent = row.text;
        div.append(st, what);
        panel.append(div);
    }
}
async function setupLog(bundle, onLogChange) {
    const opening = openLog();
    app.soilRefresh = async () => { app.soilObservations = await listSoilObservations(await opening); };
    whenLoaded("logpage", "log:soilhooks", (m) => {
        m.setSoilHooks({
            save: async (rec) => {
                await putSoilObservation(await opening, rec);
                await app.soilRefresh?.();
                onLogChange();
            },
            stored: async () => { await app.soilRefresh?.(); return app.soilObservations; },
        });
        m.setSoilJump((ground) => {
            m.reselectSoilGround(ground);
            go("log", "soilcard");
        });
    });
    let db;
    try {
        db = await opening;
    }
    catch (e) {
        $$1("logmsg").textContent = fillCopy("lgStorageOff", { err: String(e) });
        return;
    }
    app.userSpecies = await listUserSpecies(db);
    app.soilObservations = await listSoilObservations(db);
    const msg = (text, err = false) => {
        const m = $$1("logmsg");
        m.textContent = text;
        m.className = err ? "hint err" : "hint";
    };
    const said = (text) => {
        msg("");
        toast(text);
    };
    const sang = (text) => {
        msg("");
        celebrate(text);
    };
    const fillSelect = (id, values, labels) => {
        const sel = $$1(id);
        sel.innerHTML = "";
        for (const v of values) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = labels ? labels(v) : v;
            sel.appendChild(o);
        }
    };
    const EVENT_WORD = { note: copy.clOptNote, frost: copy.clOptFrost, heat: copy.clOptHeat };
    fillSelect("obsevent", OBSERVATION_EVENTS, (v) => EVENT_WORD[v] ?? v);
    fillSelect("obssev", OBSERVATION_SEVERITIES, frostSeverityLabel);
    {
        const ev = $$1("obsevent");
        const grp = document.createElement("optgroup");
        grp.label = copy.lgSoilGroup;
        for (const [value, label] of SOIL_COMPOSER_EVENTS) {
            const o = document.createElement("option");
            o.value = value;
            o.textContent = label;
            grp.appendChild(o);
        }
        ev.appendChild(grp);
    }
    {
        const ev = $$1("obsevent"), sv = $$1("obssev");
        const gr = $$1("obsground");
        const syncSev = () => {
            const soil = ev.value.startsWith("soil_");
            sv.hidden = soil || ev.value !== "frost";
            gr.hidden = !soil;
        };
        ev.addEventListener("change", syncSev);
        syncSev();
    }
    {
        const wide = matchMedia("(min-width: 768px)");
        const setFold = () => {
            for (const id of ["fold-garden", "fold-supplies"]) {
                const f = document.getElementById(id);
                if (f)
                    f.open = wide.matches;
            }
        };
        setFold();
        wide.addEventListener("change", setFold);
    }
    const today = localTodayIso();
    ($$1("obsdate")).value = today;
    const capDate = () => { ($$1("obsdate")).max = localTodayIso(); };
    capDate();
    document.getElementById("obsdate")?.addEventListener("focus", capDate);
    const seasonSel = $$1("logseason");
    const currentSeasonId = seasonId;
    const persists = (speciesId, group) => {
        const s = bundle.species.find((x) => x.id === speciesId)
            ?? app.userSpecies.find((x) => x.id === speciesId);
        return lifespanPersists(s, group);
    };
    const resolvePlanting = (p, cause, date) => resolvePlantingAtClose(p, cause, date, persists);
    const view = { viewedYear: null, reselect: null, openSpecies: null, find: { plot: "", bed: null, kind: null, open: new Set() } };
    addEventListener("gg-log-year", (e) => {
        const y = e.detail?.year;
        if (typeof y === "number")
            view.viewedYear = y;
    });
    const fmtMD = (md) => (md ? fmtMonthDay(md) : null);
    const round2 = (n) => Math.round(n * 100) / 100;
    const localityBit = (plot) => {
        const addr = plot?.address?.trim();
        if (addr)
            return addr;
        const anchor = plot?.anchor;
        if (!anchor)
            return null;
        const clim = resolveClimate(anchor.lat, anchor.lon, bundle);
        const stn = clim?.site?.provenance?.station?.name;
        const modeled = clim?.site?.provenance?.method === "nearest_era5_cell";
        if (clim?.site?.key && clim.distanceKm < 60 && !modeled)
            return fillCopy("lgNearPlace", { place: stn ? stationDisplay(stn) : titleCase(humanize(clim.site.key)) });
        return `${round2(anchor.lat)}, ${round2(anchor.lon)}`;
    };
    const locationLabel = (plot) => {
        const bits = [];
        const loc = localityBit(plot);
        if (loc)
            bits.push(loc);
        const anchor = plot?.anchor;
        if (anchor) {
            const zone = resolveZone(anchor.lat, anchor.lon, bundle);
            if (zone && zone.zone != null)
                bits.push(fillCopy("lgZone", { zone: zone.label ?? zone.zone }));
        }
        return bits.length ? bits.join(" · ") : null;
    };
    let whereFor = null;
    const rewhere = () => {
        if (!whereFor || (whereFor.plot && whereFor.plot.id !== app.currentPlotId))
            return;
        const { plot, all } = whereFor;
        renderGardensClimate(all);
        renderActiveGarden(plot, all);
        const host = document.getElementById("loglocations");
        const head = host?.querySelector(":scope > .loc-head");
        if (!host || !head)
            return;
        const where = locationLabel(plot);
        let w = host.querySelector(":scope > .loc-where");
        if (!where) {
            w?.remove();
            return;
        }
        if (!w) {
            w = el$1("p", "loc-where");
            head.after(w);
        }
        w.textContent = where;
    };
    app.climateDataArrived = rewhere;
    let seenEdits = new Map();
    const renderActiveGarden = (plot, all) => {
        const lines = { plot, all, where: locationLabel(plot), edited: seenEdits, activate: (id) => void activatePlot(id) };
        whenLoaded("plan", "log:gardenlines", (m) => m.drawGardenLines(lines));
    };
    const renderRestore = async () => {
        const sec = document.getElementById("gardenrestore");
        if (!sec)
            return;
        const plotId = app.currentPlotId;
        const mine = (await listSyncBackups(db)).filter((b) => (b.kind === "plot" && b.key === plotId) || (b.kind === "season" && b.key.startsWith(`${plotId}:`)));
        sec.hidden = mine.length === 0;
        if (sec.hidden)
            return;
        const list = $$1("restorelist");
        list.innerHTML = "";
        for (const b of mine) {
            const row = el$1("div", "restorerow");
            const mins = Math.max(0, Math.round((Date.now() - b.replacedAt) / 60000));
            const when = mins < 1 ? copy.lgJustNow : mins < 60 ? fillCopy("lgMinAgo", { n: mins })
                : mins < 60 * 24 ? fillCopy("lgHoursAgo", { n: Math.round(mins / 60) }) : new Date(b.replacedAt).toLocaleDateString(dateLocale());
            const what = b.kind === "season"
                ? fillCopy("lgRestoreSeason", { label: copy.restoreSeasonLabel, year: b.key.slice(plotId.length + 1), n: (b.record.plantings ?? []).length })
                : fillCopy("lgRestoreLayout", { label: copy.restoreLayoutLabel, n: (b.record.beds ?? []).length });
            const lab = el$1("span", "hint");
            lab.textContent = fillCopy("lgRestoreReplaced", { what, when });
            const btn = el$1("button");
            btn.type = "button";
            btn.textContent = copy.restoreBtn;
            btn.addEventListener("click", async () => {
                if (!btn.classList.contains("arm")) {
                    btn.classList.add("arm");
                    btn.textContent = copy.restoreArmedBtn;
                    return;
                }
                btn.disabled = true;
                try {
                    await restoreSyncBackup(db, b.id);
                    msg(copy.restoreDone);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                    btn.disabled = false;
                }
            });
            row.append(lab, btn);
            list.appendChild(row);
        }
    };
    const renderFeed = async (plot) => {
        const sec = document.getElementById("gardenfeed");
        if (!sec)
            return;
        const show = isSignedIn() && !!plot && !plot.example;
        sec.hidden = !show;
        if (!show)
            return;
        ($$1("feedbody")).placeholder = copy.feedPostPlaceholder;
        const me = (signedInEmail() ?? "").toLowerCase();
        const list = $$1("feedlist");
        list.innerHTML = "";
        const posts = (await listPosts(db, app.currentPlotId)).filter((p) => !p.deleted);
        if (!posts.length) {
            const e = el$1("p", "hint");
            e.textContent = copy.feedEmpty;
            list.appendChild(e);
            return;
        }
        for (const po of posts) {
            const card = el$1("div", "feedpost");
            const head = el$1("div", "feedpost-head");
            const who = el$1("span", "feedpost-who");
            who.textContent = po.author || copy.lgAGardener;
            const when = el$1("span", "feedpost-when");
            when.textContent = ` · ${feedTime(po.at)}`;
            head.append(who, when);
            const body = postBody(po.body, "feedpost-body");
            card.append(head, body);
            if (po.author && po.author.toLowerCase() === me) {
                const del = el$1("button", "feedpost-del");
                del.type = "button";
                del.textContent = copy.feedDeleteBtn;
                del.addEventListener("click", async () => { await putPost(db, { ...po, deleted: true }); await refresh(); });
                card.appendChild(del);
            }
            list.appendChild(card);
        }
    };
    const renderGardensClimate = (allPlots) => {
        const host = $$1("gardensclimate");
        host.innerHTML = "";
        if (allPlots.length < 2)
            return;
        for (const pl of allPlots)
            if (pl.anchor)
                app.ensureZipData?.(pl.anchor.lat, pl.anchor.lon);
        const def = defaultPlotId();
        const intro = el$1("p", "hint");
        intro.textContent = copy.lgGardensIntro;
        host.appendChild(intro);
        const wrap = el$1("div", "gc-cards");
        for (const pl of orderGardens(allPlots, (p) => p, def)) {
            const card = el$1("div", "gc-card" + (pl.id === app.currentPlotId ? " active" : ""));
            const head = el$1("div", "gc-head");
            const shown = gardenShownName(gardenNameOf(pl), pl.shared);
            const nm = el$1("span", "gc-name");
            nm.textContent = pl.id === def ? fillCopy("lgNameDefault", { name: shown }) : shown;
            head.appendChild(nm);
            const anchor = pl.anchor;
            if (anchor) {
                const zone = resolveZone(anchor.lat, anchor.lon, bundle);
                if (zone && zone.zone != null) {
                    const z = el$1("span", "gc-zone");
                    z.textContent = fillCopy("lgZone", { zone: zone.label ?? zone.zone });
                    head.appendChild(z);
                }
                card.appendChild(head);
                const loc = localityBit(pl);
                if (loc) {
                    const w = el$1("div", "gc-where");
                    w.textContent = loc;
                    card.appendChild(w);
                }
                const site = scheduleClimate(anchor.lat, anchor.lon, bundle)?.site;
                const lf = fmtMD(site?.last_frost_32f?.p50);
                const ff = fmtMD(site?.first_freeze_32f_p50);
                const line = el$1("div", "gc-frost");
                if (lf || ff) {
                    const days = site?.growing_season_days_p50;
                    line.textContent = days ? fillCopy("lgGcFrostDays", { last: lf ?? "?", first: ff ?? "?", days }) : fillCopy("lgGcFrost", { last: lf ?? "?", first: ff ?? "?" });
                }
                else {
                    line.textContent = copy.lgGcNoStation;
                    line.classList.add("muted");
                }
                card.appendChild(line);
            }
            else {
                card.appendChild(head);
                const line = el$1("div", "gc-frost muted");
                line.textContent = copy.lgGcNoLocation;
                card.appendChild(line);
            }
            if (pl.id !== app.currentPlotId)
                card.addEventListener("click", () => void activatePlot(pl.id));
            wrap.appendChild(card);
        }
        host.appendChild(wrap);
    };
    const openCards = new Set();
    app.openLogBed = (bedName, species) => {
        openCards.add(bedName);
        view.openSpecies = species ? { bed: bedName, species } : null;
        location.hash = "#/log";
        void refresh().then(async () => {
            const fold = document.getElementById("fold-garden");
            if (fold && !fold.open)
                fold.open = true;
            for (let i = 0; i < 20; i++) {
                const card = [...document.querySelectorAll("#page-log .card")].find((c) => c.dataset.bed === bedName);
                if (card && card.getClientRects().length) {
                    card.scrollIntoView({ block: "start", behavior: "smooth" });
                    (card.querySelector(".markplanted") ?? card.querySelector(".card-head"))?.focus({ preventScroll: true });
                    return;
                }
                await new Promise((r) => requestAnimationFrame(() => r(null)));
            }
        });
    };
    const closeBed = async (season, bed, cause, date) => {
        try {
            await putSeason(db, closedBed(season, (p) => plantingOnBed(p.region, bed.region), (p) => resolvePlanting(p, cause, date)));
            said(fillCopy("lgClosedBed", { name: bed.name }));
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const rollSeason = async (season, cause, date) => {
        try {
            await putSeason(db, rolledSeason(season, (p) => resolvePlanting(p, cause, date), date));
            said(fillCopy("lgSeasonClosedToast", { year: season.id }));
            const petals = document.createElement("div");
            petals.className = "confetti";
            petals.setAttribute("aria-hidden", "true");
            const hues = ["#4a9d5f", "#e8a33d", "#d97ba4", "#7fb069", "#c4574e"];
            for (let i = 0; i < 14; i++) {
                const petal = document.createElement("i");
                petal.style.setProperty("--x", `${(i * 71) % 100}%`);
                petal.style.setProperty("--d", `${(1.1 + (i % 5) * 0.22).toFixed(2)}s`);
                petal.style.background = hues[i % hues.length];
                petals.appendChild(petal);
            }
            document.body.appendChild(petals);
            setTimeout(() => petals.remove(), 3000);
            buzz([30, 40, 30]);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const reopenSeason = async (season) => {
        try {
            await putSeason(db, reopenedSeason(season));
            said(fillCopy("lgSeasonReopened", { year: season.id }));
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const nextSeasonFor = (season) => {
        const a = app.currentPlot?.anchor ?? null;
        const freeze = a ? gardenFrost(bundle, a.lat, a.lon, app.logSnapshot.seasons).firstFreeze : null;
        return seasonAfter(season.id, app.logSnapshot.seasons ?? [], localTodayIso(), a?.lat ?? null, freeze);
    };
    const reactivateNextSeason = async (season, target) => {
        try {
            const nextId = target ?? nextSeasonFor(season);
            const existing = await getSeason(db, app.currentPlotId, nextId);
            const { season: next, carried } = nextSeasonFrom(season, existing ?? null, app.currentPlotId, nextId);
            await putSeason(db, next);
            setSeasonId(nextId);
            view.viewedYear = nextId;
            if (carried) {
                msg(fillCopy(carried === 1 ? "lgCarriedOne" : "lgCarriedMany", { year: nextId, n: carried, prev: season.id }));
            }
            else {
                sang(fillCopy("lgSeasonStartedFresh", { year: nextId }));
            }
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const photoUrlCache = new Map();
    const photoInto = (img, seasonId, name) => {
        const key = `${app.currentPlotId}:${seasonId}:${name}`;
        const hit = photoUrlCache.get(key);
        if (hit) {
            img.src = hit;
            return;
        }
        void getPhoto(db, app.currentPlotId, seasonId, name).then((b) => {
            if (!b) {
                const note = document.createElement("span");
                note.className = "hint photomissing";
                note.textContent = copy.lgPhotoMissing;
                img.replaceWith(note);
                return;
            }
            const url = URL.createObjectURL(b);
            photoUrlCache.set(key, url);
            img.src = url;
        });
    };
    let wrongOpen = false;
    let wrongShown = null;
    let wrongCrop = null;
    const liveCrops = (seasons) => {
        const open = seasons.find((s) => s.id === seasonId());
        return (open?.plantings ?? []).map((p, idx) => ({ species: p.species, idx, ended: !!(p.end_cause || p.end_date) }))
            .filter((p) => !p.ended).map(({ species, idx }) => ({ species, idx }));
    };
    const renderWrong = (seasons) => {
        const door = document.getElementById("wrongdoor");
        const body = document.getElementById("wrongbody");
        if (!door || !body)
            return;
        door.setAttribute("aria-expanded", String(wrongOpen));
        body.hidden = !wrongOpen;
        body.replaceChildren();
        if (!wrongOpen)
            return;
        const lp = chunkReady("logpage");
        if (!lp) {
            void loadChunk("logpage").then(() => renderWrong(app.logSnapshot.seasons), () => { });
            return;
        }
        const { symptomAnswer, symptomChips, symptomFits, symptomNotHere, symptoms, symptomsFor } = lp;
        const live = liveCrops(seasons);
        const growing = [...new Set([...(wrongCrop ? [wrongCrop] : []), ...live.map((p) => p.species)])];
        const list = symptomsFor(bundle, growing);
        body.appendChild(symptomChips(list, (s) => { wrongShown = s.id; renderWrong(seasons); }));
        body.appendChild(symptomNotHere());
        viewWrongOnce();
        const s = list.find((x) => x.id === wrongShown) ?? symptoms(bundle).find((x) => x.id === wrongShown);
        if (!s)
            return;
        const on = live.find((p) => symptomFits(s, p.species, bundle)) ?? null;
        const name = on ? commonName(bundle, on.species).replace(/^./, (c) => c.toUpperCase()) : null;
        const act = on && name ? { label: fillCopy("lgNoteItOn", { name }), run: () => {
                const sid = seasonId();
                if (sid == null)
                    return;
                void addPlantingNote(db, app.currentPlotId, sid, on.idx, { date: localTodayIso(), text: `Spotted: ${s.label.toLowerCase()}` })
                    .then(async () => { toast(fillCopy("lgNotedOnThe", { name })); await refresh(); });
            } } : undefined;
        const about = on?.species ?? (wrongCrop && symptomFits(s, wrongCrop, bundle) ? wrongCrop : null);
        const aboutName = name ?? (about ? commonName(bundle, about).replace(/^./, (c) => c.toUpperCase()) : null);
        const card = symptomAnswer(s, about, aboutName, bundle, act);
        body.appendChild(card);
        lp.wrongTrail(card, s, about, bundle);
    };
    const openWrong = (id, glide = true) => {
        wrongOpen = true;
        wrongShown = id;
        renderWrong(app.logSnapshot.seasons);
        document.getElementById("wrong")?.scrollIntoView({ block: "start", behavior: glide && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
    };
    let wrongToView = false;
    const applyWrongHash = () => {
        const h = location.hash, q = h.indexOf("?");
        if (!/^#\/log\?/.test(h))
            return;
        const p = new URLSearchParams(h.slice(q + 1));
        if (!p.has("wrong"))
            return;
        const crop = (p.get("crop") ?? "").trim().toLowerCase();
        wrongCrop = /^[a-z0-9_]+$/.test(crop) && bundle.species.some((x) => x.id === crop) ? crop : null;
        wrongToView = true;
        openWrong(p.get("wrong") || null, false);
    };
    const viewWrongOnce = () => {
        if (!wrongToView || !document.querySelector("#wrongbody .wrong-chips"))
            return;
        wrongToView = false;
        requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("wrong")?.scrollIntoView({ block: "start" })));
    };
    window.addEventListener("hashchange", applyWrongHash);
    document.getElementById("wrongdoor")?.addEventListener("click", () => {
        wrongOpen = !wrongOpen;
        if (!wrongOpen)
            wrongShown = null;
        renderWrong(app.logSnapshot.seasons);
    });
    applyWrongHash();
    document.getElementById("obsnote")?.addEventListener("input", () => {
        const hint = document.getElementById("wronghint");
        if (!hint)
            return;
        const lp = chunkReady("logpage");
        if (!lp) {
            void loadChunk("logpage").then(() => document.getElementById("obsnote")?.dispatchEvent(new Event("input")), () => { });
            return;
        }
        const s = lp.symptomInNote(bundle, ($$1("obsnote")).value);
        hint.replaceChildren();
        hint.hidden = !s;
        if (!s)
            return;
        hint.appendChild(document.createTextNode(copy.lgSoundsLike + " "));
        const b = document.createElement("button");
        b.type = "button";
        b.className = "linky wronghint-go";
        b.textContent = fillCopy("lgSeeWhatHelps", { symptom: s.label.toLowerCase() });
        b.addEventListener("click", () => openWrong(s.id));
        hint.appendChild(b);
    });
    const FROST_WORD = /(^|[^\p{L}])(frost(s|ed|y)?|helad[ao]s?|hel[oó]|escarcha)(?![\p{L}])/iu;
    const syncFrostHint = () => {
        const hint = document.getElementById("frosthint");
        if (!hint)
            return;
        const ev = $$1("obsevent");
        const show = ev.value === "note" && FROST_WORD.test($$1("obsnote").value);
        if (show !== hint.hidden)
            return;
        hint.replaceChildren();
        hint.hidden = !show;
        if (!show)
            return;
        hint.appendChild(document.createTextNode(copy.lgFrostAsk + " "));
        const b = document.createElement("button");
        b.type = "button";
        b.className = "linky frosthint-go";
        b.textContent = copy.lgFrostAskGo;
        b.addEventListener("click", () => { ev.value = "frost"; ev.dispatchEvent(new Event("change")); ev.focus(); });
        hint.appendChild(b);
    };
    document.getElementById("obsnote")?.addEventListener("input", syncFrostHint);
    document.getElementById("obsevent")?.addEventListener("change", syncFrostHint);
    const refKey = (r) => r.kind === "obs" ? `ob:${r.seasonId}:${r.obs.id}` : `pl:${r.seasonId}:${r.plantingId}:${r.key}:${r.index}`;
    let editing = null;
    const ensureEditCss = () => {
        if (document.getElementById("logedit-css"))
            return;
        const link = document.createElement("link");
        link.id = "logedit-css";
        link.rel = "stylesheet";
        link.href = "./logedit.css";
        const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
        (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
    };
    let diaryGarden = null;
    const inGarden = () => (diaryGarden ? chunkReady("logpage")?.gardenWords(diaryGarden) ?? null : null);
    const offerUndo = (text, undo, undone = copy.lgUndone) => {
        toast(text, 9000, { label: copy.lgUndo, go: () => {
                void undo().then(async () => { toast(undone); await refresh(); }, (e) => msg(String(e instanceof Error ? e.message : e), true));
            } });
    };
    const fresh = (o) => { const c = { ...o }; delete c.id; return c; };
    const deleteEntry = async (r) => {
        const plot = app.currentPlotId;
        const words = inGarden();
        if (r.kind === "obs") {
            await removeObservation(db, plot, r.seasonId, r.obs.id);
            const day = fmtMonthDayYear(r.obs.date);
            offerUndo(words ? words.deleted(day) : fillCopy("lgEntryDeleted", { day }), async () => {
                const back = await fileObservation(db, plot, fresh(r.obs));
                if (plot === app.currentPlotId)
                    view.viewedYear = back.seasonId;
            }, words?.undone);
        }
        else {
            await changePlantingEntry(db, plot, r.seasonId, r.plantingId, r.key, r.index, r.value, null);
            const day = fmtMonthDayYear(r.value.date);
            offerUndo(words ? words.deleted(day) : fillCopy("lgEntryDeleted", { day }), async () => {
                await restorePlantingEntry(db, plot, r.seasonId, r.plantingId, r.key, r.index, r.value);
            }, words?.undone);
        }
    };
    const saveEntry = async (r, next) => {
        const plot = app.currentPlotId;
        const words = inGarden();
        const saved = words ? words.saved : copy.lgEntrySaved;
        if (r.kind === "obs") {
            const moved = await changeObservation(db, plot, r.seasonId, r.obs.id, next);
            view.viewedYear = moved.seasonId;
            offerUndo(saved, async () => {
                await removeObservation(db, plot, moved.seasonId, moved.obs.id);
                const back = await fileObservation(db, plot, fresh(r.obs));
                if (plot === app.currentPlotId)
                    view.viewedYear = back.seasonId;
            }, words?.undone);
        }
        else {
            await changePlantingEntry(db, plot, r.seasonId, r.plantingId, r.key, r.index, r.value, next);
            offerUndo(saved, async () => {
                await changePlantingEntry(db, plot, r.seasonId, r.plantingId, r.key, r.index, next, r.value);
            }, words?.undone);
        }
    };
    const editButton = (key) => [...document.querySelectorAll("#logtimeline .tl-edit")].find((b) => b.dataset.ref === key) ?? null;
    const entryEditor = (r) => {
        const box = el$1("div", "tl-editor");
        const where = inGarden();
        if (where)
            box.appendChild(el$1("p", "tl-ed-in", where.editorIn));
        const field = (cls, node) => { node.classList.add(cls); box.appendChild(node); return node; };
        const date = field("tl-ed-date", el$1("input"));
        const was = r.kind === "obs" ? r.obs.date : r.value.date;
        date.type = "date";
        date.max = was > localTodayIso() ? was : localTodayIso();
        date.setAttribute("aria-label", copy.clAriaDate);
        date.value = was;
        const isProblem = r.kind === "pinned" && r.key === "failures";
        const isFrost = r.kind === "obs" && r.obs.event === "frost";
        let sev = null, what = null;
        if (isFrost || isProblem) {
            sev = field("tl-ed-sev", el$1("select"));
            sev.setAttribute("aria-label", copy.clAriaSeverity);
            for (const v of isFrost ? OBSERVATION_SEVERITIES : FAILURE_SEVERITIES) {
                const o = document.createElement("option");
                o.value = v;
                o.textContent = isFrost ? frostSeverityLabel(v) : failureSeverityLabel(v);
                sev.appendChild(o);
            }
            sev.value = r.kind === "obs" ? r.obs.severity ?? "light" : r.value.severity;
        }
        if (isProblem) {
            what = field("tl-ed-what", el$1("input"));
            what.type = "text";
            what.placeholder = copy.clWhatPh;
            what.setAttribute("aria-label", copy.clAriaWhat);
            what.value = r.value.mode;
        }
        let note = null;
        if (!isProblem) {
            note = field("tl-ed-note", el$1("input"));
            note.type = "text";
            note.setAttribute("aria-label", copy.clAriaNote);
            note.placeholder = r.kind === "obs" && r.obs.event !== "note" ? copy.clNotePh : copy.clNotePhExample;
            note.value = r.kind === "obs" ? r.obs.note ?? "" : r.value.text;
        }
        const err = el$1("p", "tl-ed-err");
        err.setAttribute("role", "alert");
        const done = () => { editing = null; };
        const save = el$1("button", "btn btn-primary tl-ed-save");
        save.type = "button";
        save.textContent = copy.lgSaveChanges;
        save.addEventListener("click", () => void (async () => {
            err.textContent = "";
            try {
                const d = date.value;
                if (!/^\d{4}-\d\d-\d\d$/.test(d))
                    throw new Error(copy.clErrPickDate);
                if (isFutureDate(d, localTodayIso()) && d !== (r.kind === "obs" ? r.obs.date : r.value.date))
                    throw new Error(copy.lgErrFutureDate);
                const words = note?.value.trim() ?? "";
                let next;
                if (r.kind === "obs") {
                    if (r.obs.event === "note" && !words)
                        throw new Error(copy.lgWriteALine);
                    const o = { ...fresh(r.obs), date: d };
                    if (isFrost && sev)
                        o.severity = sev.value;
                    if (words)
                        o.note = words;
                    else
                        delete o.note;
                    next = o;
                }
                else if (isProblem) {
                    if (!what?.value.trim())
                        throw new Error(copy.clErrNameProblem);
                    next = { date: d, mode: what.value.trim(), severity: sev.value };
                }
                else {
                    if (!words)
                        throw new Error(copy.clErrWriteNote);
                    next = { ...r.value, date: d, text: words };
                }
                await saveEntry(r, next);
                done();
                await refresh();
            }
            catch (e) {
                err.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        const del = el$1("button", "btn btn-secondary tl-ed-del");
        del.type = "button";
        del.textContent = copy.lgDeleteEntry;
        del.addEventListener("click", () => void (async () => {
            err.textContent = "";
            try {
                await deleteEntry(r);
                done();
                await refresh();
            }
            catch (e) {
                err.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        const cancel = el$1("button", "linky tl-ed-cancel");
        cancel.type = "button";
        cancel.textContent = copy.clCancel;
        cancel.addEventListener("click", () => { done(); renderTimeline(app.logSnapshot.seasons, app.logSnapshot.beds); editButton(refKey(r))?.focus(); });
        const row = el$1("div", "tl-ed-acts");
        row.append(save, del, cancel);
        box.append(row, err);
        return box;
    };
    const logTrail = () => {
        whenShownChunk("log", "logpage", "log:trail", (lp) => {
            const lat = num("lat"), lon = num("lon");
            lp.logTrail(lat != null && lon != null && !isExamplePlot(app.currentPlotId) ? { lat, lon } : null);
        });
    };
    window.addEventListener("hashchange", () => { if (currentRoute() === "log")
        logTrail(); });
    const syncFind = (beds) => {
        const f = view.find;
        if (f.plot !== app.currentPlotId) {
            f.plot = app.currentPlotId;
            f.bed = null;
            f.kind = null;
            f.open.clear();
        }
        if (f.bed && !beds.some((b) => b.name === f.bed))
            f.bed = null;
    };
    const drawFind = (seasons, beds, every) => {
        chunkReady("logpage")?.drawFind({
            view, seasons, beds, every, refresh, nextSeasonFor, reactivateNextSeason, garden: diaryGarden,
            rerender: () => { editing = null; renderTimeline(seasons, beds); },
        });
    };
    const renderTimeline = (seasons, beds) => {
        const host = document.getElementById("logtimeline");
        if (!host)
            return;
        host.textContent = "";
        const lp = chunkReady("logpage");
        if (!lp) {
            whenShownChunk("log", "logpage", "log:timeline", () => renderTimeline(app.logSnapshot.seasons, app.logSnapshot.beds));
            return;
        }
        syncFind(beds);
        const viewed = seasons.find((s) => s.id === view.viewedYear) ?? seasons[seasons.length - 1] ?? null;
        if (!viewed) {
            drawFind(seasons, beds, null);
            return;
        }
        const bedFor = (p) => {
            const cands = beds.filter((b) => plantingOnBed(p.region, b.region));
            return (cands.find((b) => !bedHasSections(b.name, beds)) ?? cands[0])?.name ?? null;
        };
        const entriesOf = (season) => {
            const entries = [];
            for (const p of season.plantings ?? []) {
                const name = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
                const low = name.toLowerCase();
                const bed = bedFor(p);
                if (p.sown)
                    entries.push({ date: p.sown, kind: "sow", dk: "sowed", text: name, bed, species: p.species, label: name });
                if (p.transplanted)
                    entries.push({ date: p.transplanted, kind: "plant", dk: "transplanted", text: name, bed, species: p.species, label: name });
                if (p.first_harvest)
                    entries.push({ date: p.first_harvest, kind: "harvest", dk: "first_harvest", text: low, bed, species: p.species, label: low });
                if (p.last_harvest && p.last_harvest !== p.first_harvest)
                    entries.push({ date: p.last_harvest, kind: "harvest", dk: "last_harvest", text: low, bed, species: p.species, label: low });
                if (p.end_date && p.end_cause)
                    entries.push({ date: p.end_date, kind: "ended", dk: "ended", text: name, bed, species: p.species, label: name, detail: humanize(p.end_cause).toLowerCase() });
                const pin = (key, index, value) => p.id ? { kind: "pinned", seasonId: season.id, plantingId: p.id, key, index, value } : undefined;
                (p.failures ?? []).forEach((f, i) => entries.push({ date: f.date, kind: "problem", dk: "note", text: `${name}: ${f.mode}`, bed, species: p.species, label: name, ref: pin("failures", i, f) }));
                (p.notes ?? []).forEach((n, i) => entries.push({ date: n.date, kind: "note", dk: "note", text: `${name}: ${n.text}`, bed, species: p.species, label: name, photo: n.photo, ref: pin("notes", i, n) }));
            }
            for (const o of withObservationIds(season.observations ?? [])) {
                const ref = { kind: "obs", seasonId: season.id, obs: o };
                const extra = o.note || o.damage || "";
                if (o.event === "note") {
                    entries.push({ date: o.date, kind: "weather", dk: "weather", text: extra || `${copy.clOptNote}.`, bed: null, species: null, label: "", ref });
                    continue;
                }
                const base = o.event === "frost" ? copy.lgTlFrost : o.event === "heat" ? copy.lgTlHeat : humanize(o.event);
                entries.push({ date: o.date, kind: "weather", dk: "weather", text: extra ? `${base}: ${extra}` : `${base}.`, bed: null, species: null, label: "", ref });
            }
            return entries.sort((a, b) => b.date.localeCompare(a.date)).map((e) => {
                const ek = entryKind(e.kind, e.ref?.kind === "obs" ? e.ref.obs.event : null);
                return { ...e, ek, fk: diaryKind(ek) };
            });
        };
        const perYear = new Map(seasons.map((s) => [s.id, entriesOf(s)]));
        if (![...perYear.values()].some((l) => l.length)) {
            drawFind(seasons, beds, null);
            return;
        }
        const alsoOpen = (perYear.get(viewed.id) ?? []).length ? null
            : [...seasons].sort((a, b) => b.id - a.id).find((s) => (perYear.get(s.id) ?? []).length)?.id ?? null;
        ensureEditCss();
        const groupRows = (entries) => {
            const groups = new Map();
            for (const e of entries) {
                const key = `${e.date}|${e.kind}|${e.dk}|${e.detail ?? ""}|${e.bed ?? ""}|${e.ref ? refKey(e.ref) : ""}`;
                const g = groups.get(key);
                if (g)
                    g.parts.push(e);
                else
                    groups.set(key, { ...e, parts: [e] });
            }
            return [...groups.values()];
        };
        const tally = (parts, host) => {
            const counts = new Map();
            for (const e of parts) {
                const c = counts.get(e.text);
                if (c)
                    c.n++;
                else
                    counts.set(e.text, { n: 1, e });
            }
            let first = true;
            for (const [text, { n, e }] of counts) {
                if (!first)
                    host.appendChild(document.createTextNode(" + "));
                first = false;
                if (n > 1)
                    host.appendChild(document.createTextNode(`${n} × `));
                if (e.species)
                    linkNameIn(host, text, e.label, e.species);
                else
                    host.appendChild(document.createTextNode(text));
            }
        };
        const frameOf = (dk, detail, iso) => {
            const day = dayWord(iso);
            const cut = (key, vars = {}) => {
                const [pre, post = ""] = fillCopy(key, { ...vars, day }).split("{name}");
                return { pre, post };
            };
            switch (dk) {
                case "sowed": return cut("lgDiarySowed");
                case "transplanted": return cut("lgDiarySetOut");
                case "first_harvest": return cut("lgDiaryFirstHarvest");
                case "last_harvest": return cut("lgDiaryLastHarvest");
                case "ended": return detail ? cut("lgDiaryEndedWhy", { detail }) : cut("lgDiaryEnded");
                default: return null;
            }
        };
        const CAP = 12;
        const render = (list, into, seasonOf) => {
            for (const e of list) {
                const row = el$1("div", `tl-e tl-${e.kind}`);
                if (justLogged && e.parts.some((q) => q.date === justLogged.date && q.kind === justLogged.kind)) {
                    row.classList.add("tl-new");
                    justLogged = null;
                }
                row.appendChild(el$1("span", "tl-dot"));
                const k = el$1("span", "tl-k");
                k.textContent = fmtMonthDayYear(e.date);
                row.appendChild(k);
                const s = el$1("p", "tl-s");
                const frame = frameOf(e.dk, e.detail, e.date);
                if (frame) {
                    if (frame.pre)
                        s.appendChild(document.createTextNode(frame.pre));
                    tally(e.parts, s);
                    s.appendChild(document.createTextNode(frame.post));
                }
                else {
                    tally(e.parts, s);
                }
                row.appendChild(s);
                const withPhotos = e.parts.filter((q) => q.photo);
                if (withPhotos.length) {
                    const strip = el$1("div", "photostrip");
                    for (const q of withPhotos) {
                        const img = document.createElement("img");
                        img.className = "photothumb";
                        img.loading = "lazy";
                        img.alt = fillCopy("lgPhotoAltShort", { text: q.text });
                        img.addEventListener("click", () => img.classList.toggle("photobig"));
                        photoInto(img, seasonOf, q.photo);
                        strip.appendChild(img);
                    }
                    row.appendChild(strip);
                }
                const tag = el$1("span", e.bed ? "tl-bed" : "tl-bed whole");
                tag.textContent = e.bed ?? copy.lgWholeGarden;
                const foot = el$1("span", "tl-foot");
                foot.append(tag, el$1("span", "tl-kind", lp.kindWord(e.ek)));
                row.appendChild(foot);
                if (e.ref && e.parts.length === 1) {
                    const ref = e.ref;
                    const edit = el$1("button", "linky tl-edit");
                    edit.type = "button";
                    edit.textContent = copy.lgEdit;
                    edit.setAttribute("aria-label", fillCopy("lgEditAria", { entry: `${k.textContent}, ${s.textContent ?? ""}` }));
                    edit.dataset.ref = refKey(ref);
                    edit.setAttribute("aria-expanded", String(editing === refKey(ref)));
                    edit.addEventListener("click", () => {
                        editing = editing === refKey(ref) ? null : refKey(ref);
                        renderTimeline(seasons, beds);
                        if (editing)
                            document.querySelector("#logtimeline .tl-editor .tl-ed-date")?.focus();
                        else
                            editButton(refKey(ref))?.focus();
                    });
                    foot.appendChild(edit);
                    if (editing === refKey(ref))
                        row.appendChild(entryEditor(ref));
                }
                into.appendChild(row);
            }
        };
        const editingYear = Number(/^(?:ob|pl):(\d+):/.exec(editing ?? "")?.[1] ?? NaN);
        const every = new Map([...perYear].map(([id, list]) => [id, groupRows(list)]));
        const filter = { bed: view.find.bed, kind: view.find.kind };
        drawFind(seasons, beds, every);
        let anyShown = false;
        for (const season of [...seasons].sort((a, b) => b.id - a.id)) {
            const all = every.get(season.id) ?? [];
            const rows = selectRows(all, filter);
            if (rows.length)
                anyShown = true;
            const sec = el$1("section", "tl-year");
            sec.dataset.year = String(season.id);
            const here = season.id === viewed.id || season.id === alsoOpen;
            const open = rows.length > 0 && (here || view.find.open.has(season.id) || editingYear === season.id);
            const h = el$1("h2", "tl-yh");
            h.tabIndex = -1;
            const label = (into) => {
                into.append(el$1("span", "tl-yy", String(season.id)), " ", el$1("span", "tl-yn", lp.yearCount(rows.length, all.length)));
            };
            if (here || !rows.length)
                label(h);
            else {
                const b = el$1("button", "tl-yb");
                b.type = "button";
                b.setAttribute("aria-expanded", String(open));
                label(b);
                b.addEventListener("click", () => {
                    if (open) {
                        view.find.open.delete(season.id);
                        if (editingYear === season.id)
                            editing = null;
                    }
                    else
                        view.find.open.add(season.id);
                    renderTimeline(seasons, beds);
                    host.querySelector(`.tl-year[data-year="${season.id}"] .tl-yb`)?.focus();
                });
                h.appendChild(b);
            }
            sec.appendChild(h);
            if (open) {
                const wrap = el$1("div", "tl");
                const editingAt = editing ? rows.findIndex((g) => g.ref && refKey(g.ref) === editing) : -1;
                const cap = editingAt >= CAP ? rows.length : CAP;
                render(rows.slice(0, cap), wrap, season.id);
                if (rows.length > cap) {
                    const more = document.createElement("button");
                    more.type = "button";
                    more.className = "tl-more";
                    more.textContent = fillCopy("lgShowEarlier", { n: rows.length - cap });
                    more.addEventListener("click", () => { more.remove(); render(rows.slice(cap), wrap, season.id); }, { once: true });
                    wrap.appendChild(more);
                }
                sec.appendChild(wrap);
            }
            host.appendChild(sec);
        }
        if (!anyShown)
            host.appendChild(el$1("p", "hint tl-none", lp.nothingMatches()));
    };
    const locCtx = () => ({
        bundle, db, today, view, openCards, msg, said, sang, refresh, closeBed, rollSeason, reopenSeason,
        reactivateNextSeason, nextSeasonFor, persists, photoInto, locationLabel, fmtMD, activatePlot: (id, chosen) => activatePlot(id, chosen),
    });
    const showPlace = (plot) => {
        const set = (id, v) => { const f = document.getElementById(id); if (f)
            f.value = v; };
        set("lat", plot?.anchor ? String(Math.round(plot.anchor.lat * 1e5) / 1e5) : "");
        set("lon", plot?.anchor ? String(Math.round(plot.anchor.lon * 1e5) / 1e5) : "");
        for (const id of plot?.anchor ? ["zip", "plus"] : ["zip", "plus", "addr"])
            set(id, "");
    };
    const gardenEdits = async () => {
        const at = new Map();
        for (const m of await listSyncMeta(db)) {
            const id = m.key.startsWith("plot:") ? m.key.slice(5)
                : m.key.startsWith("season:") ? m.key.slice(7, m.key.lastIndexOf(":")) : null;
            if (id && m.updatedAt > (at.get(id) ?? 0))
                at.set(id, m.updatedAt);
        }
        return at;
    };
    const MOVED_KEY = "gg-log-moved";
    const movedNotes = () => {
        try {
            const v = JSON.parse(localStorage.getItem(MOVED_KEY) ?? "{}");
            return v && typeof v === "object" ? v : {};
        }
        catch {
            return {};
        }
    };
    const saveMoved = (v) => {
        try {
            localStorage.setItem(MOVED_KEY, JSON.stringify(v));
        }
        catch { }
    };
    let repairRun = null;
    const repairLog = () => repairRun ??= (async () => {
        let moved = false;
        const notes = movedNotes();
        try {
            for (const p of await listPlots(db)) {
                if (p.example || p.shared || isExamplePlot(p.id))
                    continue;
                try {
                    const seasons = await listSeasons(db, p.id);
                    const a = p.anchor ?? null;
                    const freeze = a ? gardenFrost(bundle, a.lat, a.lon, seasons).firstFreeze : null;
                    const carried = carriedDrafts(seasons, localTodayIso(), a?.lat ?? null, freeze);
                    const held = carried ? seasons.find((s) => s.id === carried.seasonId) : null;
                    if (carried && held) {
                        await putSeason(db, { ...held, next_plan: carried.next_plan });
                        moved = true;
                    }
                }
                catch (e) {
                    console.warn("repair: a passed year's drafts stayed put", e);
                }
                for (const m of misfiledEntries(await listSeasons(db, p.id), p.anchor?.lat ?? null, localTodayIso())) {
                    try {
                        await moveObservation(db, p.id, m.from, m.to, m.obs);
                    }
                    catch (e) {
                        console.warn("repair: an entry stayed put", e);
                        continue;
                    }
                    moved = true;
                    const byYear = (notes[p.id] ??= {});
                    byYear[String(m.to)] = (byYear[String(m.to)] ?? 0) + 1;
                    if (p.id === app.currentPlotId)
                        view.viewedYear = m.to;
                }
            }
        }
        catch (e) {
            console.warn("repair: put off to the next visit", e);
        }
        finally {
            repairRun = null;
        }
        if (moved)
            saveMoved(notes);
        return moved;
    })();
    const renderMoved = () => {
        const host = document.getElementById("logmoved");
        if (!host)
            return;
        const mine = movedNotes()[app.currentPlotId] ?? {};
        const years = Object.keys(mine).sort().reverse();
        host.replaceChildren();
        host.hidden = !years.length;
        if (host.hidden)
            return;
        ensureEditCss();
        const body = el$1("div", "acctnotice-body");
        const acts = el$1("div", "acctnotice-actions");
        for (const y of years) {
            const n = mine[y];
            const line = el$1("p");
            line.textContent = n === 1 ? fillCopy("lgMovedOne", { year: y }) : fillCopy("lgMovedMany", { n, year: y });
            body.appendChild(line);
            const show = el$1("button", "btn btn-secondary lm-show");
            show.type = "button";
            show.textContent = fillCopy("lgMovedShow", { year: y });
            show.addEventListener("click", () => { view.viewedYear = Number(y); void refresh(); });
            acts.appendChild(show);
        }
        const ok = el$1("button", "linky lm-ok");
        ok.type = "button";
        ok.textContent = copy.lgMovedOk;
        ok.addEventListener("click", () => { const all = movedNotes(); delete all[app.currentPlotId]; saveMoved(all); renderMoved(); });
        acts.appendChild(ok);
        body.appendChild(acts);
        host.appendChild(body);
    };
    let repairedHere = false;
    const KEPT_KEY = "gg-future-kept";
    const keptFuture = () => {
        try {
            const v = JSON.parse(localStorage.getItem(KEPT_KEY) ?? "[]");
            return new Set(Array.isArray(v) ? v.map(String) : []);
        }
        catch {
            return new Set();
        }
    };
    const keepFuture = (key) => {
        try {
            localStorage.setItem(KEPT_KEY, JSON.stringify([...keptFuture(), key]));
        }
        catch { }
    };
    const renderFuture = (seasons) => {
        const host = document.getElementById("logfuture");
        if (!host)
            return;
        const kept = keptFuture();
        const today = localTodayIso();
        const items = futureDated(seasons, today).map((f) => ({
            ref: { kind: "obs", seasonId: f.seasonId, obs: f.obs }, date: f.obs.date, key: `${app.currentPlotId}:${f.obs.id}`,
            what: f.obs.event === "frost" ? `${copy.lgTlFrost}.` : f.obs.event === "heat" ? `${copy.lgTlHeat}.` : f.obs.note || `${copy.clOptNote}.`,
        }));
        for (const s of seasons)
            for (const p of s.plantings ?? []) {
                if (!p.id)
                    continue;
                const name = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
                (p.failures ?? []).forEach((f, i) => { if (isFutureDate(f.date, today))
                    items.push({ ref: { kind: "pinned", seasonId: s.id, plantingId: p.id, key: "failures", index: i, value: f }, date: f.date, what: `${name}: ${f.mode}`, key: `${app.currentPlotId}:${p.id}:f:${i}:${f.date}` }); });
                (p.notes ?? []).forEach((n, i) => { if (isFutureDate(n.date, today))
                    items.push({ ref: { kind: "pinned", seasonId: s.id, plantingId: p.id, key: "notes", index: i, value: n }, date: n.date, what: `${name}: ${n.text}`, key: `${app.currentPlotId}:${p.id}:n:${i}:${n.date}` }); });
            }
        const lp = chunkReady("logpage");
        if (lp)
            for (const f of futurePlantingDates(seasons, today)) {
                const p = seasons.find((s) => s.id === f.seasonId)?.plantings?.[f.index];
                if (!p)
                    continue;
                items.push({ plant: f, date: f.date, what: lp.plantingDateWords(f.field, plantingLabel(bundle, p.species, p.cultivar_group ?? null)),
                    key: `${app.currentPlotId}:${f.seasonId}:${f.plantingId ?? `i${f.index}`}:${f.field}:${f.date}` });
            }
        const shownItems = items.filter((f) => !kept.has(f.key));
        host.replaceChildren();
        host.hidden = !shownItems.length || isExamplePlot(app.currentPlotId);
        if (host.hidden)
            return;
        ensureEditCss();
        const body = el$1("div", "acctnotice-body");
        const head = el$1("p");
        head.textContent = shownItems.length === 1 ? copy.lgFutureOne : fillCopy("lgFutureMany", { n: shownItems.length });
        body.appendChild(head);
        for (const f of shownItems) {
            const { ref, plant } = f;
            const plot = app.currentPlotId;
            const line = el$1("p", "lf-what");
            line.textContent = fillCopy("lgFutureRow", { day: fmtMonthDayYear(f.date), text: f.what });
            const acts = el$1("div", "acctnotice-actions");
            const btn = (cls, label, go) => {
                const b = el$1("button", `btn btn-secondary ${cls}`);
                b.type = "button";
                b.textContent = label;
                b.addEventListener("click", () => void Promise.resolve(go()).catch((e) => msg(String(e instanceof Error ? e.message : e), true)));
                acts.appendChild(b);
                return b;
            };
            if (ref) {
                btn("lf-fix", copy.lgFutureFix, async () => {
                    view.viewedYear = ref.seasonId;
                    view.find.bed = null;
                    view.find.kind = null;
                    editing = refKey(ref);
                    await refresh();
                    const d = document.querySelector("#logtimeline .tl-editor .tl-ed-date");
                    d?.scrollIntoView({ block: "center" });
                    d?.focus();
                });
                btn("lf-del", copy.lgFutureDelete, async () => { await deleteEntry(ref); await refresh(); });
            }
            else if (plant) {
                btn("lf-fix", copy.lgFutureFix, () => {
                    if (acts.nextElementSibling?.classList.contains("lf-fixform"))
                        return;
                    const form = el$1("div", "lf-fixform");
                    const date = el$1("input");
                    date.type = "date";
                    date.value = plant.date;
                    date.max = localTodayIso();
                    date.setAttribute("aria-label", copy.clAriaDate);
                    const err = el$1("p", "tl-ed-err");
                    err.setAttribute("role", "alert");
                    const save = el$1("button", "btn btn-primary lf-fixsave", copy.lgSaveChanges);
                    save.type = "button";
                    save.addEventListener("click", () => void (async () => {
                        err.textContent = "";
                        try {
                            if (!/^\d{4}-\d\d-\d\d$/.test(date.value))
                                throw new Error(copy.clErrPickDate);
                            if (isFutureDate(date.value, localTodayIso()))
                                throw new Error(copy.lgErrFutureDate);
                            const now = (await getSeason(db, plot, plant.seasonId))?.plantings?.[plant.index];
                            if (!now || now[plant.field] !== plant.date || (plant.plantingId && now.id !== plant.plantingId))
                                throw new Error(copy.lgEntryMoved);
                            const patch = {};
                            patch[plant.field] = date.value;
                            await updatePlanting(db, plot, plant.seasonId, plant.index, patch);
                            await refresh();
                        }
                        catch (e) {
                            err.textContent = String(e instanceof Error ? e.message : e);
                        }
                    })());
                    const cancel = el$1("button", "linky tl-ed-cancel", copy.clCancel);
                    cancel.type = "button";
                    cancel.addEventListener("click", () => form.remove());
                    form.append(date, save, cancel, err);
                    acts.after(form);
                    date.focus();
                });
            }
            btn("lf-keep", copy.lgFutureKeep, () => { keepFuture(f.key); renderFuture(app.logSnapshot.seasons); });
            body.append(line, acts);
        }
        host.appendChild(body);
    };
    let locDraws = 0;
    const refresh = async () => {
        const draw = ++locDraws;
        {
            const k = chunkFor(currentRoute());
            if (k)
                await loadChunk(k).catch(() => { });
        }
        {
            const every = await listPlots(db);
            const shown = openGardens(every);
            if (activeWorkspace() === "draft") {
                const d = defaultPlotId();
                if (d && !shown.some((p) => p.id === d))
                    setDefaultPlot(null);
            }
            const ch = chosenPlotId();
            if (ch && !shown.some((p) => p.id === ch))
                clearChosenPlot();
            const guessed = app.plotGuessed && shown.some((p) => !p.example);
            if (guessed || !shown.some((p) => p.id === app.currentPlotId)) {
                const target = pickGarden(shown.filter((p) => !p.example), { def: defaultPlotId(), edited: await gardenEdits() }) ?? defaultWorkspacePlotId();
                if (guessed)
                    app.plotGuessed = false;
                if (target !== app.currentPlotId) {
                    setCurrentPlot(target);
                    showPlace(shown.find((p) => p.id === target));
                    window.dispatchEvent(new Event("gg-garden-shown"));
                    app.refreshAuthGate?.();
                }
            }
        }
        if (!repairedHere && !isSignedIn()) {
            repairedHere = true;
            void repairLog();
        }
        if (repairRun)
            await repairRun;
        const seasons = (await listSeasons(db, app.currentPlotId)).sort((a, b) => a.id - b.id);
        const chosen = seasonId();
        fillSelect("logseason", seasons.map((s) => String(s.id)));
        setSeasonId(resolveSeasonId(seasons, chosen));
        seasonSel.value = seasonId() == null ? "" : String(seasonId());
        const plot = await getPlot(db, app.currentPlotId);
        if (plot?.anchor && num("lat") == null && num("lon") == null) {
            ($$1("lat")).value = String(Math.round(plot.anchor.lat * 1e5) / 1e5);
            ($$1("lon")).value = String(Math.round(plot.anchor.lon * 1e5) / 1e5);
            window.dispatchEvent(new Event("gg-garden-shown"));
        }
        const beds = plot?.beds ?? [];
        const everyPlot = await listPlots(db);
        noteGardens(everyPlot);
        const allPlots = openGardens(everyPlot);
        const closedPlots = everyPlot.filter(gardenClosed);
        app.currentPlot = plot ? { address: plot.address, anchor: plot.anchor, name: plot.name, shared: !!plot.shared, country: plot.country } : null;
        diaryGarden = plot && allPlots.length > 1 ? gardenShownName(gardenNameOf(plot), plot.shared) : null;
        if (plot?.anchor && Number.isFinite(plot.anchor.lat)) {
            rememberHemisphere(plot.anchor.lat);
            applySeason();
        }
        app.logSnapshot = { seasons, beds, seasonId: currentSeasonId(), priorOccupancy: plot?.prior_occupancy ?? [] };
        rememberMyPlants(!isExamplePlot(app.currentPlotId));
        {
            const lp = chunkReady("logpage");
            if (lp)
                lp.renderLocations(locCtx(), seasons, beds, plot, allPlots, closedPlots);
            else if (draw === locDraws)
                whenLoaded("logpage", "log:locations", (m) => { if (draw === locDraws)
                    m.renderLocations(locCtx(), seasons, beds, plot, allPlots, closedPlots); });
        }
        renderWrong(seasons);
        renderMoved();
        renderFuture(seasons);
        renderTimeline(seasons, beds);
        logTrail();
        const viewedSeason = seasons.find((s) => s.id === seasonId());
        const drawSeeds = async (m) => {
            await m.renderSeedBox(db, bundle);
            await m.renderShoppingList(db, bundle, viewedSeason?.plantings ?? [], viewedSeason ?? null, beds, plot?.anchor ?? null);
        };
        if (currentRoute() === "log") {
            const m = await loadChunk("logpage").catch(() => null);
            if (m)
                await drawSeeds(m);
        }
        else
            whenShownChunk("log", "logpage", "log:seedbox", (m) => { void drawSeeds(m); });
        whereFor = { plot, all: allPlots };
        seenEdits = await gardenEdits();
        renderGardensClimate(allPlots);
        renderActiveGarden(plot, allPlots);
        await renderFeed(plot);
        await renderRestore();
        const wLegend = document.querySelector("#sec-weather legend");
        if (wLegend)
            wLegend.textContent = plot?.name ? fillCopy("lgNamedWeather", { name: gardenShownName(plot.name, plot.shared) }) : copy.lgGroundWeather;
        countGardenActive(plot);
        const cand = $$1("candbed");
        const candChosen = cand.value;
        const plannable = beds.filter((b) => !bedHasSections(b.name, beds));
        fillSelect("candbed", plannable.map((b) => b.name), (v) => v);
        {
            const gr = $$1("obsground");
            const keep = gr.value;
            gr.innerHTML = "";
            for (const [value, label] of [["", copy.lgTheWholeGarden],
                ...beds.map((b) => [b.name, b.name])]) {
                const o = document.createElement("option");
                o.value = value;
                o.textContent = label;
                gr.appendChild(o);
            }
            if ([...gr.options].some((o) => o.value === keep))
                gr.value = keep;
        }
        if (plannable.some((b) => b.name === candChosen))
            cand.value = candChosen;
        else if (plannable.length)
            cand.value = plannable[0].name;
        if (app.refreshUserPlantsUI)
            await app.refreshUserPlantsUI();
        await app.soilRefresh?.();
        onLogChange();
    };
    const trouble = (text, door) => {
        const n = $$1("lognudge");
        n.textContent = text;
        n.classList.add("err");
        n.hidden = false;
        if (door) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "linklike";
            b.textContent = door.label;
            b.addEventListener("click", door.go);
            n.append(" ", b);
        }
    };
    const clearTrouble = () => {
        const n = $$1("lognudge");
        if (n.classList.contains("err")) {
            n.classList.remove("err");
            n.textContent = "";
            n.hidden = true;
        }
    };
    const act = (id, fn) => {
        $$1(id).addEventListener("click", () => {
            clearTrouble();
            fn().then((note) => {
                if (note == null)
                    return;
                said(note);
                return refresh();
            }).catch((e) => {
                const text = String(e instanceof Error ? e.message : e);
                msg(text, true);
                const door = e.door === "season"
                    ? { label: copy.lgTakeMeThere, go: () => { const b = document.getElementById("seasonstart"); b?.scrollIntoView({ block: "center" }); b?.focus(); } }
                    : undefined;
                trouble(text, door);
            });
        });
    };
    act("feedpost", async () => {
        if (!isSignedIn())
            throw new Error(copy.lgSignInToPost);
        const input = $$1("feedbody");
        const body = input.value.trim();
        if (!body)
            throw new Error(copy.lgWriteSomething);
        await putPost(db, { plot: app.currentPlotId, id: mintPostId(), author: signedInEmail() ?? "", at: new Date().toISOString(), body });
        input.value = "";
        return copy.lgPosted;
    });
    let skipReader = false;
    const lineHost = () => document.getElementById("logline");
    const hideLine = () => { const h = lineHost(); if (h && !h.hidden) {
        h.hidden = true;
        h.replaceChildren();
    } };
    document.getElementById("obsnote")?.addEventListener("input", hideLine);
    document.getElementById("obsevent")?.addEventListener("change", hideLine);
    document.getElementById("obsnote")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        $$1("obsadd").click();
    } });
    act("obsadd", async () => {
        const rawEvent = ($$1("obsevent")).value;
        if (rawEvent.startsWith("soil_")) {
            const date = ($$1("obsdate")).value;
            if (isFutureDate(date, localTodayIso()))
                throw new Error(copy.lgErrFutureDate);
            const groundName = ($$1("obsground")).value;
            const bed = app.logSnapshot.beds.find((b) => b.name === groundName) ?? null;
            const rec = { plot: app.currentPlotId, date, source: "declared" };
            if (rawEvent === "soil_waterlogged")
                rec.drainage = "waterlogged";
            else
                rec.amendment = rawEvent.slice("soil_".length);
            if (bed?.region)
                rec.region = bed.region;
            const note = ($$1("obsnote")).value.trim();
            if (note)
                rec.notes = note;
            await putSoilObservation(db, rec);
            ($$1("obsnote")).value = "";
            await app.soilRefresh?.();
            onLogChange();
            const ground = groundName || copy.lgTheWholeGarden;
            return rawEvent === "soil_waterlogged"
                ? fillCopy("lgNotedWater", { ground })
                : rec.amendment === "lime" || rec.amendment === "sulfur"
                    ? fillCopy("lgNotedAmend", { ground })
                    : fillCopy("lgNotedAdded", { ground });
        }
        const event = rawEvent;
        const note = ($$1("obsnote")).value.trim();
        if (event === "note" && !note)
            throw new Error(copy.lgWriteALine);
        const obs = { date: ($$1("obsdate")).value, event };
        if (!/^\d{4}-\d\d-\d\d$/.test(obs.date))
            throw new Error(copy.clErrPickDate);
        if (isFutureDate(obs.date, localTodayIso()))
            throw new Error(copy.lgErrFutureDate);
        if (event === "note" && !skipReader && lineHost()) {
            const lp = await loadChunk("logpage").catch(() => null);
            const today = localTodayIso();
            const growing = openSeason();
            const reading = lp ? lp.readLogLine(note, lp.lineContext(bundle, today, growing, growing ? app.logSnapshot.beds : [], obs.date)) : null;
            if (lp && reading) {
                const seasonDoor = { label: copy.lgTakeMeThere, go: () => { const b = document.getElementById("seasonstart"); b?.scrollIntoView({ block: "center" }); b?.focus(); } };
                lp.drawLineCard({
                    bundle, db, plot: app.currentPlotId, lat: app.currentPlot?.anchor?.lat ?? null, season: growing, beds: app.logSnapshot.beds, today,
                    line: note, reading, host: lineHost(), ensureCss: ensureEditCss, said, sang, refresh,
                    keepNote: () => { skipReader = true; $$1("obsadd").click(); },
                    fileWeather: (ev, severity, date) => {
                        hideLine();
                        const evSel = $$1("obsevent");
                        evSel.value = ev;
                        evSel.dispatchEvent(new Event("change"));
                        if (severity)
                            $$1("obssev").value = severity;
                        $$1("obsdate").value = date;
                        $$1("obsadd").click();
                    },
                    done: () => { hideLine(); $$1("obsnote").value = ""; syncFrostHint(); },
                    noSeason: () => trouble(copy.lgStartSeasonFirst, seasonDoor),
                });
                return null;
            }
        }
        skipReader = false;
        if (event === "frost")
            obs.severity = ($$1("obssev")).value;
        if (note)
            obs.note = note;
        const plot = app.currentPlotId;
        const season = seasonForDate(obs.date, (await getPlot(db, plot))?.anchor?.lat ?? null);
        view.viewedYear = season;
        view.find.bed = null;
        view.find.kind = null;
        await fileObservation(db, plot, obs);
        ($$1("obsnote")).value = "";
        {
            const ev = $$1("obsevent");
            if (ev.value !== "note") {
                ev.value = "note";
                ev.dispatchEvent(new Event("change"));
            }
        }
        syncFrostHint();
        justLogged = { date: obs.date, kind: "weather" };
        const nudge = $$1("lognudge");
        nudge.hidden = true;
        {
            const wh = document.getElementById("wronghint");
            if (wh)
                wh.hidden = true;
        }
        const standing = (seasons) => ledgerEarned(seasons, lastEarnedSite, app.soilObservations ?? [], app.currentPlotId, lastEarnedLat)
            .find((r) => r.key === "frost");
        const before = standing(app.logSnapshot.seasons);
        const held = app.logSnapshot.seasons;
        const after = standing(held.some((s) => s.id === season)
            ? held.map((s) => (s.id === season ? { ...s, observations: [...(s.observations ?? []), obs] } : s))
            : [...held, { id: season, plot, plantings: [], observations: [obs] }]);
        const graduated = !!before && !!after && before.state !== "live" && after.state === "live";
        if (before && after && (after.state !== before.state || after.badge !== before.badge)) {
            nudge.textContent = graduated
                ? graduationLine()
                : fillCopy("lgFrostLogged", { badge: after.badge.toLowerCase() });
            nudge.hidden = false;
        }
        const label = ($$1("obsevent")).selectedOptions[0]?.textContent?.trim() || humanize(event);
        if (graduated)
            return graduationLine();
        return event === "frost" ? frostNotedLine(obs.date, { live: after?.state === "live" }) : event === "note" ? noteLoggedLine(obs.date)
            : event === "heat" ? heatNotedLine(obs.date) : weatherNotedLine(label, obs.date);
    });
    $$1("frostdemo").addEventListener("click", () => {
        const lat = num("lat"), lon = num("lon");
        if (lat == null || lon == null) {
            const text = copy.lgSetLocationFirst;
            msg(text, true);
            trouble(text, { label: copy.lgSetLocation, go: () => go("plan", "step-where") });
            return;
        }
        app.syntheticOn = true;
        $$1("frostdemoclear").hidden = false;
        onLogChange();
        said(copy.lgDemoLoaded);
    });
    $$1("frostdemoclear").addEventListener("click", () => {
        app.syntheticOn = false;
        $$1("frostdemoclear").hidden = true;
        onLogChange();
        said(copy.lgDemoCleared);
    });
    act("logexport", async () => {
        const season = currentSeasonId();
        if (season == null)
            throw Object.assign(new Error(copy.lgStartSeasonFirst), { door: "season" });
        const rec = (await listSeasons(db, app.currentPlotId)).find((s) => s.id === season);
        if (!rec)
            throw new Error(fillCopy("lgNoSeasonInLog", { year: season }));
        const { emitSeason } = await loadChunk("logpage");
        const text = emitSeason(rec);
        ($$1("logfile")).value = text;
        ($$1("logfilebox")).open = true;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "application/yaml" }));
        a.download = `season-${season}.yaml`;
        a.click();
        URL.revokeObjectURL(a.href);
        const named = (rec.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
            .filter((x) => !!x);
        if (!named.length)
            return fillCopy("lgExported", { year: season });
        const entries = [];
        const missing = [];
        for (const name of named) {
            const blob = await getPhoto(db, app.currentPlotId, season, name);
            if (blob)
                entries.push({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
            else
                missing.push(name);
        }
        if (entries.length) {
            const z = document.createElement("a");
            z.href = URL.createObjectURL((await loadChunk("logpage")).buildStoreZip(entries));
            z.download = `season-${season}-photos.zip`;
            z.click();
            URL.revokeObjectURL(z.href);
        }
        const one = (k) => (k === 1 ? "One" : "Many");
        const exportKey = (entries.length && missing.length ? `lgExportedBoth${one(entries.length)}${one(missing.length)}`
            : entries.length ? `lgExportedPhotos${one(entries.length)}` : `lgExportedMissing${one(missing.length)}`);
        return fillCopy(exportKey, { year: season, n: entries.length, m: missing.length });
    });
    $$1("logimportfiles")?.addEventListener("change", () => void (async () => {
        const inp = $$1("logimportfiles");
        const files = Array.from(inp.files ?? []);
        if (!files.length)
            return;
        try {
            const yaml = files.find((f) => /\.ya?ml$/i.test(f.name));
            const zip = files.find((f) => /\.zip$/i.test(f.name));
            if (!yaml && !zip)
                throw new Error(copy.lgChooseImport);
            const { emitSeason, parseSeasonFile, readStoreZip } = await loadChunk("logpage");
            let season = null;
            if (yaml) {
                const text = await yaml.text();
                ($$1("logfile")).value = text;
                season = parseSeasonFile(text);
                const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
                const replaced = existing && emitSeason(existing) !== text;
                await putSeason(db, season);
                setSeasonId(season.id);
                if (replaced)
                    msg(fillCopy("lgImportReplaced", { year: season.id }));
            }
            let restored = 0, skipped = 0;
            if (zip) {
                const target = season ?? (await listSeasons(db, app.currentPlotId)).find((s) => s.id === currentSeasonId()) ?? null;
                if (!target)
                    throw new Error(copy.lgImportZipFirst);
                const namedSet = new Set((target.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
                    .filter((x) => !!x));
                for (const entry of readStoreZip(await zip.arrayBuffer())) {
                    if (!namedSet.has(entry.name)) {
                        skipped++;
                        continue;
                    }
                    await putPhoto(db, target.plot, target.id, entry.name, new Blob([entry.bytes], { type: "image/jpeg" }));
                    restored++;
                }
            }
            await refresh();
            const parts = [
                season ? fillCopy("lgImportedCounts", { year: season.id, p: season.plantings?.length ?? 0, o: season.observations?.length ?? 0 }) : null,
                restored ? pluralCopy("lgPhotosRestored", restored) : null,
                skipped ? pluralCopy("lgZipSkipped", skipped) : null,
            ].filter(Boolean);
            msg(parts.join("; ") + ".");
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
        finally {
            inp.value = "";
        }
    })());
    act("logimport", async () => {
        const text = ($$1("logfile")).value;
        if (!text.trim()) {
            ($$1("logfilebox")).open = true;
            $$1("logfile").focus();
            return copy.lgPasteFirst;
        }
        const { emitSeason, parseSeasonFile } = await loadChunk("logpage");
        const season = parseSeasonFile(text);
        const plotNote = season.plot !== app.currentPlotId
            ? " " + fillCopy("lgPlotNote", { plot: season.plot })
            : "";
        const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
        const replaced = existing && emitSeason(existing) !== text;
        await putSeason(db, season);
        setSeasonId(season.id);
        return fillCopy(replaced ? "lgImportedReplaced" : "lgImportedDone", { year: season.id, p: season.plantings?.length ?? 0, o: season.observations?.length ?? 0 }) + plotNote;
    });
    seasonSel.addEventListener("change", () => {
        const picked = seasonSel.value;
        setSeasonId(picked === "" ? null : Number(picked));
        void refresh();
    });
    app.logRefresh = refresh;
    {
        const upFamilies = $$1("upfamilies");
        for (const f of familiesOf(bundle)) {
            const o = document.createElement("option");
            o.value = familyShown(f);
            upFamilies.appendChild(o);
        }
        const setMsg = (span, text, err = false) => {
            span.textContent = text;
            span.className = err ? "hint err" : "hint";
        };
        const limitWords = (rec) => {
            const cap = capabilities$1(rec);
            return [...(cap.rotation ? [] : [copy.lgLimitRotation]), ...(cap.placement ? [] : [copy.lgLimitPlacement]),
                ...(cap.schedule ? [] : [copy.lgLimitSchedule]), ...(cap.guild_role ? [] : [copy.lgLimitRole])];
        };
        const capLine = (rec) => {
            const limits = limitWords(rec);
            return limits.length
                ? fillCopy("lgCapLimits", { limits: limits.join("; ") })
                : copy.lgCapFull;
        };
        const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const uniqueId = (slug) => {
            const base = `user:${slug}`;
            if (!app.userSpecies.some((s) => s.id === base))
                return base;
            for (let n = 2;; n++)
                if (!app.userSpecies.some((s) => s.id === `${base}_${n}`))
                    return `${base}_${n}`;
        };
        const reloadPlants = async () => {
            app.userSpecies = await listUserSpecies(db);
            $$1("uplisthint").textContent = app.userSpecies.length ? copy.lgUpListHint : "";
            renderManagedPlants($$1("uplist"), false);
            const mp = document.getElementById("myplants");
            if (mp)
                renderManagedPlants(mp, true);
        };
        app.refreshUserPlantsUI = reloadPlants;
        const makeSaver = (form, existingId, msg, btnLabel, onSaved) => {
            let armed = false;
            return () => {
                const { name, traits } = form.read();
                if (!name) {
                    msg(copy.lgNeedName, true);
                    armed = false;
                    return;
                }
                const slug = slugify(name);
                if (!slug) {
                    msg(copy.lgNameLetters, true);
                    armed = false;
                    return;
                }
                const id = existingId ?? uniqueId(slug);
                const rec = { id, source: "user", common: name, ...traits };
                const errors = validateUserSpecies(rec);
                if (errors.length) {
                    msg(errors[0], true);
                    armed = false;
                    return;
                }
                const limits = limitWords(rec);
                if (limits.length && !armed) {
                    armed = true;
                    msg(fillCopy(existingId ? "lgHeadsUpSave" : "lgHeadsUpAdd", { limits: limits.join("; "), btn: btnLabel }));
                    return;
                }
                putUserSpecies(db, rec)
                    .then(async () => { onSaved(rec); onLogChange(); await reloadPlants(); })
                    .catch((e) => msg(String(e instanceof Error ? e.message : e), true));
            };
        };
        function renderManagedPlants(container, editable) {
            if (editable && container.querySelector(".upedit"))
                return;
            container.innerHTML = "";
            if (!app.userSpecies.length) {
                const p = el$1("p", "hint");
                if (!editable)
                    return;
                p.textContent = copy.lgNoAddedPlantsEdit;
                container.appendChild(p);
                return;
            }
            for (const rec of [...app.userSpecies].sort((a, b) => a.id.localeCompare(b.id))) {
                const row = el$1("div", "upitem");
                const fam = ` · ${typeof rec.family === "string" ? familyName(rec.family) : copy.lgNoFamily}`;
                const label = el$1("span");
                label.textContent = `${commonName(bundle, rec.id)}${fam} - ${capLine(rec)}`;
                row.appendChild(label);
                if (editable) {
                    const edit = el$1("button");
                    edit.type = "button";
                    edit.className = "btn btn-quiet link";
                    edit.textContent = copy.lgEditLower;
                    edit.addEventListener("click", () => toggleEditForm(container, row, rec));
                    const rm = el$1("button");
                    rm.type = "button";
                    rm.className = "btn btn-quiet link";
                    rm.textContent = copy.lgRemove;
                    rm.addEventListener("click", () => void deleteUserSpecies(db, rec.id)
                        .then(async () => { await reloadPlants(); onLogChange(); })
                        .catch(() => { }));
                    row.append(edit, rm);
                }
                container.appendChild(row);
            }
        }
        function toggleEditForm(container, row, rec) {
            const open = row.nextElementSibling;
            if (open && open.classList.contains("upedit")) {
                open.remove();
                return;
            }
            const lp = chunkReady("logpage");
            if (!lp) {
                void loadChunk("logpage").then(() => toggleEditForm(container, row, rec), () => { });
                return;
            }
            container.querySelectorAll(".upedit").forEach((e) => e.remove());
            const box = el$1("div", "upedit");
            const form = lp.plantEditorForm({ seed: rec });
            const msgEl = el$1("span", "hint");
            const save = el$1("button");
            save.type = "button";
            save.className = "btn btn-primary primary";
            save.textContent = copy.lgSaveCap;
            const cancel = el$1("button");
            cancel.type = "button";
            cancel.className = "link";
            cancel.textContent = copy.lgCancelLower;
            save.addEventListener("click", makeSaver(form, rec.id, (t, err) => setMsg(msgEl, t, err), copy.lgSaveCap, () => box.remove()));
            cancel.addEventListener("click", () => { box.remove(); void reloadPlants(); });
            const actions = el$1("div", "uprow actions");
            actions.append(save, cancel, msgEl);
            box.append(form.root, actions);
            row.after(box);
        }
        const mountAddForm = () => { whenShownChunk("plan", "logpage", "plan:upform", (lp) => mountAddFormWith(lp), "upaddpanel"); };
        const mountAddFormWith = (lp) => {
            const host = $$1("upform-host");
            host.innerHTML = "";
            const form = lp.plantEditorForm({ suggest: (n) => lp.suggestFromName(n, bundle.species),
                nameOf: (sid) => commonName(bundle, sid),
                keep: async (sid, variety) => {
                    await putSeed(db, { id: mintSeedId(), species: sid, variety });
                    await app.logRefresh?.();
                    const plant = commonName(bundle, sid).toLocaleLowerCase();
                    return fillCopy("pfKeptVariety", { variety, plant });
                } });
            host.appendChild(form.root);
            const addMsg = (t, err = false) => setMsg($$1("upmsg"), t, err);
            ($$1("upadd")).onclick = makeSaver(form, undefined, addMsg, copy.lgAddPlant, (rec) => {
                addMsg(fillCopy("lgAdded", { name: commonName(bundle, rec.id) }));
                mountAddFormWith(lp);
            });
        };
        mountAddForm();
        void reloadPlants();
    }
    let mapRefit = null;
    let refitPending = false;
    const refitMap = () => { if (mapRefit)
        mapRefit();
    else
        refitPending = true; };
    const activatePlot = async (id, chosen = true) => {
        setCurrentPlot(id, chosen);
        showPlace(await getPlot(db, id));
        refitMap();
        window.dispatchEvent(new Event("gg-garden-shown"));
        await refresh();
        app.refreshAuthGate?.();
    };
    app.switchPlot = (id) => activatePlot(id);
    const gardensNow = async () => openGardens(await listPlots(db)).filter((p) => !p.example);
    const clearVanishedDefault = async () => {
        const def = defaultPlotId();
        if (def && !(await gardensNow()).some((p) => p.id === def))
            setDefaultPlot(null);
    };
    app.afterSync = async () => { await clearVanishedDefault(); if (await repairLog())
        await refresh(); };
    app.landOnDefault = async () => {
        if (chosenPlotId())
            return;
        const def = defaultPlotId();
        if (def && def !== app.currentPlotId && (await gardensNow()).some((p) => p.id === def))
            await activatePlot(def, false);
    };
    const deviceDraftDefault = () => {
        try {
            const v = localStorage.getItem("gg-default-plot");
            return v?.startsWith("draft_") ? v : null;
        }
        catch {
            return null;
        }
    };
    const draftIsReal = async (p) => (p.beds?.length ?? 0) > 0 || p.id !== "draft_home" || p.id === deviceDraftDefault()
        || (await listSeasons(db, p.id)).length > 0;
    const discardDraft = async (p) => {
        for (const sn of await listSeasons(db, p.id))
            await deleteSeason(db, p.id, sn.id);
        for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === p.id)) {
            await deleteSoilObservation(db, rec);
        }
        await deletePlot(db, p.id);
    };
    const adoptDraft = async (p) => {
        const base = plotIdFor(p.name ?? "home");
        return rekeyPlot(db, p.id, await freePlotId(db, base), { owner: "account" });
    };
    const KEPT = "gg-drafts-kept";
    const keptDrafts = () => {
        try {
            const v = JSON.parse(localStorage.getItem(KEPT) ?? "[]");
            return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
        }
        catch {
            return [];
        }
    };
    const keepDrafts = (ids) => {
        try {
            localStorage.setItem(KEPT, JSON.stringify([...new Set([...keptDrafts(), ...ids])]));
        }
        catch { }
    };
    const pendingDrafts = async (offer = false) => {
        const out = [];
        const kept = offer ? keptDrafts() : [];
        for (const p of await listPlots(db, "draft")) {
            if (await draftIsReal(p)) {
                if (!kept.includes(p.id))
                    out.push(p);
            }
            else
                await discardDraft(p);
        }
        return out;
    };
    const renderDraftBanner = async () => {
        const box = document.getElementById("draftbanner");
        if (!box)
            return;
        const drafts = isSignedIn() ? await pendingDrafts(true) : [];
        box.hidden = drafts.length === 0;
        if (!drafts.length) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = "";
        const devDef = deviceDraftDefault();
        const items = drafts.map((d) => fillCopy("lgDraftItem", { name: d.name ?? copy.lgUnnamed,
            beds: d.beds?.length ? pluralCopy("lgBeds", d.beds.length) : copy.lgDraftNoBeds }));
        const what = new Intl.ListFormat(appLang(), { type: "conjunction" }).format(items);
        const p = document.createElement("p");
        p.textContent = fillCopy(drafts.length === 1 ? "lgDraftOfferOne" : "lgDraftOfferMany", { what });
        const defDraft = drafts.find((d) => d.id === devDef);
        if (defDraft)
            p.textContent += " " + fillCopy(defaultPlotId() ? "lgDraftOfferDefaultKept" : "lgDraftOfferDefaultNew", { name: defDraft.name ?? copy.lgUnnamed });
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = copy.lgAddToAccount;
        add.addEventListener("click", () => void (async () => {
            const adopted = [];
            let newDef = null;
            for (const d of await pendingDrafts(true)) {
                const np = await adoptDraft(d);
                adopted.push(np);
                if (d.id === devDef)
                    newDef = np.id;
            }
            if (newDef && !defaultPlotId())
                setDefaultPlot(newDef);
            box.hidden = true;
            const acctDef = defaultPlotId();
            const stay = !!acctDef && acctDef !== newDef && (await gardensNow()).some((p) => p.id === acctDef);
            if (adopted.length)
                await activatePlot(stay ? acctDef : (newDef ?? adopted[0].id), !stay);
        })());
        const keep = document.createElement("button");
        keep.type = "button";
        keep.textContent = copy.lgKeepOnDevice;
        keep.addEventListener("click", () => {
            keepDrafts(drafts.map((d) => d.id));
            box.hidden = true;
            box.innerHTML = "";
        });
        const row = document.createElement("div");
        row.className = "logrow";
        row.append(add, keep);
        box.append(p, row);
    };
    app.refreshDraftBanner = () => void renderDraftBanner();
    app.startNextSeason = async (target) => {
        const closed = (app.logSnapshot.seasons ?? []).filter((s) => s.closed_date);
        if (!closed.length)
            return;
        const newest = closed.reduce((a, b) => (a.id >= b.id ? a : b));
        const full = await getSeason(db, app.currentPlotId, newest.id);
        if (full)
            await reactivateNextSeason(full, target);
    };
    app.onSignIn = async (opts) => {
        app.closeAuthSheet?.();
        const accountPlots = await listPlots(db);
        if (!accountPlots.length) {
            if (opts?.adoptDrafts === false) {
                if ((await pendingDrafts(true)).length) {
                    await renderDraftBanner();
                    if (signInMayMove(location.hash))
                        location.hash = "#/plan";
                    return;
                }
            }
            else {
                const devDef = deviceDraftDefault();
                let newDef = null;
                for (const d of await pendingDrafts(true)) {
                    const np = await adoptDraft(d);
                    if (d.id === devDef)
                        newDef = np.id;
                }
                if (newDef && !defaultPlotId())
                    setDefaultPlot(newDef);
            }
        }
        let plots = await listPlots(db);
        void renderDraftBanner();
        if (!plots.length) {
            let ladder = {};
            try {
                ladder = JSON.parse(localStorage.getItem("gg-answers") ?? "{}");
            }
            catch { }
            if (typeof ladder.lat !== "number" || typeof ladder.lon !== "number")
                return;
            await setPlotAnchorOnce(db, defaultWorkspacePlotId(), ladder.lat, ladder.lon, ladder.zip ? `ZIP ${ladder.zip}` : undefined);
            plots = await listPlots(db);
            if (!plots.length)
                return;
        }
        app.markStarted?.();
        clearChosenPlot();
        await activatePlot(pickGarden(plots, { def: defaultPlotId(), edited: await gardenEdits() }) ?? (openGardens(plots)[0] ?? plots[0]).id, false);
        if (hasGround()) {
            if (signInMayMove(location.hash))
                location.hash = "#/start";
            return;
        }
        if (!signInMayMove(location.hash))
            return;
        location.hash = "#/plan";
        const ground = document.getElementById("sec-ground");
        if (ground)
            ground.open = true;
    };
    app.onSignOut = async () => {
        const drafts = (await listPlots(db)).filter((p) => !p.example);
        clearChosenPlot();
        setCurrentPlot(pickGarden(drafts, { def: defaultPlotId() }) ?? defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        void renderDraftBanner();
        refitMap();
        window.dispatchEvent(new Event("gg-garden-shown"));
        await refresh();
        app.refreshAuthGate?.();
    };
    app.showExample = async (from) => {
        const n = new Date();
        const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
        await (await exampleData()).seedExampleGarden(db, n.getFullYear(), bundle, today, (sid, group) => {
            const sp = bundle.species.find((x) => x.id === sid);
            return sp && datedByDays(sp, group) ? resolveDtm(sp, group) : null;
        });
        app.markStarted?.();
        await activatePlot(EXAMPLE_PLOT_ID);
        if (from === undefined || location.hash === from)
            location.hash = "#/start";
    };
    app.removeExample = async (toLanding = false) => {
        await (await exampleData()).removeExampleGarden(db);
        const rest = (await listPlots(db)).filter((p) => !p.example);
        if (rest.length) {
            await activatePlot(pickGarden(rest, { def: defaultPlotId() }) ?? (openGardens(rest)[0] ?? rest[0]).id, false);
            location.hash = "#/plan";
            return;
        }
        setCurrentPlot(defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        window.dispatchEvent(new Event("gg-garden-shown"));
        markPlanFresh();
        try {
            app.resetPlanStep?.();
        }
        catch { }
        await refresh();
        app.refreshAuthGate?.();
        if (!toLanding) {
            location.hash = "#/plan";
            return;
        }
        app.clearStarted?.();
        location.hash = "#/start";
        window.scrollTo(0, 0);
    };
    initAccount(db, () => void refresh());
    app.logDb = db;
    whenLoaded("plan", "ground:init", (m) => {
        const gm = m.initGroundMap(db, () => app.currentPlotId, () => {
            const lat = num("lat"), lon = num("lon");
            return lat != null && lon != null ? { lat, lon } : null;
        }, () => void refresh(), (id) => void activatePlot(id));
        app.groundRedraw = gm.redraw;
        app.groundCenterOn = gm.centerOn;
        app.groundRefit = gm.refit;
        app.groundRefitIfDrifted = gm.refitIfDrifted;
        app.groundProposeRect = gm.proposeRect;
        app.groundClearProposal = gm.clearProposal;
        app.groundKeepProposal = gm.keepProposal;
        app.groundDropProposal = gm.dropProposal;
        app.groundProposalTaken = gm.proposalTakenNow;
        mapRefit = gm.refit;
        if (refitPending) {
            refitPending = false;
            gm.refit();
        }
        else
            void gm.redraw();
    });
    await refresh();
    void renderDraftBanner();
}

const contentIndex$1 = [
    { "slug": "frost-dates", "title": "Understanding your frost dates", "description": "Your last and first frost dates are the clock the whole garden runs on. What they mean, why they're a probability, and how they decide when each crop can go out.", "shelf": "Start here", "hero": "ocimum_basilicum", "thumb": "card_scene_frost-covered-plants", "plants": ["ocimum_basilicum"], "related": ["plant-your-first-bed"] },
    { "slug": "frost-dates-zones-daylength", "title": "Frost dates vs hardiness zones vs day length", "description": "Three different numbers describe your climate, and they do three different jobs. Your zone, your frost dates, and your latitude each answer their own question. Most garden tools blur them into \"your zone,\" which is a mistake. Here's which is which.", "shelf": "Start here", "hero": "allium_cepa", "thumb": "card_allium_cepa", "plants": ["allium_cepa"], "related": ["frost-dates", "crop-rotation"] },
    { "slug": "read-a-planting-calendar", "title": "How to read a planting calendar", "description": "A planting chart that says \"sow in April\" is wrong for most of the country. The skill worth having is reading any calendar as an offset from your own frost dates. Here's how, at both ends of the season.", "shelf": "Start here", "hero": "pisum_sativum", "thumb": "card_scene_cold-frame-cloche", "plants": ["pisum_sativum"], "related": ["frost-dates", "starting-seeds-indoors", "plant-your-first-bed"] },
    { "slug": "where-to-put-a-garden", "title": "Where to put a garden: sun, water, and drainage", "description": "The single biggest decision you make is where the garden goes, and you make it before you plant anything. Here's how much sun vegetables need, why standing water is a dealbreaker, and how the site shapes the plan.", "shelf": "Start here", "hero": "solanum_lycopersicum", "thumb": "card_scene_allotment-plots", "plants": ["solanum_lycopersicum"], "related": ["garden-types", "plant-your-first-bed", "build-a-raised-bed"] },
    { "slug": "garden-types", "title": "Choosing a field, an in-ground bed, a raised bed or a container", "description": "The four ways to hold a garden, what each one costs and buys, and how to pick the one that fits your yard, your soil, and how much work you want.", "shelf": "Start here", "hero": null, "thumb": "card_scene_garden-rows-field", "plants": [], "related": ["plant-your-first-bed", "raised-bed-soil"] },
    { "slug": "build-a-raised-bed", "title": "How to build a raised garden bed", "description": "How wide, how long, how deep, and what to build it from. Width is the one dimension that matters, the rest is up to you, and here's how to fill it without wasting money.", "shelf": "Know your ground", "hero": "daucus_carota", "thumb": "card_scene_garden-tools", "plants": ["daucus_carota"], "related": ["garden-types", "raised-bed-soil", "plant-your-first-bed"] },
    { "slug": "container-vegetable-gardening", "title": "Container vegetable gardening for beginners", "description": "You can grow real food in pots on a patio, balcony, or step. Here's how to pick the pot, what to fill it with, what to grow, and the one habit that decides whether it lives.", "shelf": "Know your ground", "hero": "capsicum_annuum", "thumb": "card_capsicum_annuum", "plants": ["capsicum_annuum"], "related": ["garden-types", "plant-your-first-bed"] },
    { "slug": "raised-bed-soil", "title": "What to do with last year's raised bed soil", "description": "Your raised bed soil isn't used up at the end of the season. Here's why it settles, how to refresh it with compost, and why replacing it is almost never the answer.", "shelf": "Know your ground", "hero": null, "thumb": "card_scene_garden-beds-summer", "plants": [], "related": ["rotate-or-replace-raised-bed", "garden-types"] },
    { "slug": "the-soil-test", "title": "The soil test, the best buy in gardening", "description": "A soil test replaces guessing with knowing. Here's what it measures, why no tool should hand you fertilizer numbers without one, and how to take one. The rare piece of garden advice that saves money.", "shelf": "Know your ground", "hero": null, "thumb": "card_scene_garden-fork-digging", "plants": [], "related": ["raised-bed-soil", "build-a-raised-bed", "where-to-put-a-garden"] },
    { "slug": "soil-myths", "title": "Soil myths about sand in clay, coffee grounds and banana peels", "description": "The most-repeated soil advice online is free, sounds sensible, and mostly does nothing. One tip makes your soil worse. Here's each one, and the boring thing that works.", "shelf": "Myths", "hero": null, "thumb": "card_scene_mulch-straw-bed", "plants": [], "related": ["the-soil-test", "raised-bed-soil", "build-a-raised-bed", "cover-crops-and-green-manure"] },
    { "slug": "cover-crops-and-green-manure", "title": "Cover crops and green manure for the home garden", "description": "A cover crop is a plant you grow to feed the soil. Here's what they do, which kind fixes nitrogen and which just builds organic matter, and how to fit one into a small garden's off-season.", "shelf": "Know your ground", "hero": null, "thumb": "card_scene_cover-crop-field", "plants": [], "related": ["crop-rotation", "do-beans-feed-the-corn", "the-soil-test"] },
    { "slug": "rotate-or-replace-raised-bed", "title": "Do you need to rotate crops in a raised bed?", "description": "Yes. The pests and diseases live in the soil, so a raised bed needs rotating like any ground. Here's why, and why digging out the soil is the costly way to do the same job.", "shelf": "Know your ground", "hero": "solanum_lycopersicum", "thumb": "card_scene_wheelbarrow-garden", "plants": ["solanum_lycopersicum"], "related": ["crop-rotation", "raised-bed-soil"] },
    { "slug": "crop-rotation", "title": "Crop rotation for the home garden", "description": "Move crops by plant family so soil-borne pests and diseases can't settle in. What to rotate, how far apart, and what rotation can and can't do.", "shelf": "Know your ground", "hero": "solanum_tuberosum", "thumb": "card_solanum_tuberosum", "plants": ["solanum_tuberosum", "solanum_lycopersicum"], "related": [] },
    { "slug": "berries-after-tomatoes", "title": "Don't plant berries where the tomatoes were: the rotation rule that rotation misses", "description": "You can rotate perfectly, wait three years, clear the debris, and still kill a raspberry patch. Verticillium ignores plant families and lingers in soil for years.", "shelf": "Know your ground", "hero": "rubus_idaeus", "thumb": "card_rubus_idaeus", "plants": ["rubus_idaeus"], "related": ["crop-rotation", "rotate-or-replace-raised-bed", "fruit-tree-guild", "currants-and-gooseberries"] },
    { "slug": "starting-seeds-indoors", "title": "Starting seeds indoors", "description": "Which crops need a head start, how many weeks before your last frost to sow them, and the list of what you should sow straight in the ground instead.", "shelf": "Keep it alive", "hero": "solanum_melongena", "thumb": "card_scene_seedling-emerging", "plants": ["solanum_melongena", "solanum_lycopersicum"], "related": ["frost-dates", "plant-your-first-bed"] },
    { "slug": "getting-seeds-to-come-up", "title": "Getting seeds to come up", "description": "A seed comes up when a few things line up: soil in its germination range, steady moisture, and for some seeds a dormancy broken first or a glimpse of light. Here is what each kind asks for, and why.", "shelf": "Keep it alive", "hero": null, "thumb": "card_scene_hand-sowing", "plants": ["daucus_carota"], "related": ["starting-seeds-indoors", "frost-dates"] },
    { "slug": "transplanting-seedlings", "title": "How to transplant seedlings", "description": "Moving a seedling into the garden is where a lot of them get set back or killed. How to harden off, handle, and set a transplant, plus the one crop you plant deeper than it grew, and the reason.", "shelf": "Keep it alive", "hero": "solanum_lycopersicum", "thumb": "card_scene_spring-planting-bed", "plants": ["solanum_lycopersicum"], "related": ["starting-seeds-indoors", "plant-your-first-bed"] },
    { "slug": "succession-planting", "title": "Succession planting for a steady harvest", "description": "Plant all your lettuce at once and you get a wall of it for two weeks, then nothing. Succession planting, in small staggered sowings, gives you a steady supply of the crops you eat continuously.", "shelf": "Keep it alive", "hero": "lactuca_sativa", "thumb": "card_scene_autumn-harvest-basket", "plants": ["lactuca_sativa"], "related": ["read-a-planting-calendar", "plant-your-first-bed", "crop-rotation"] },
    { "slug": "growing-root-vegetables", "title": "Growing carrots and other root vegetables", "description": "Roots are among the easiest crops to grow and the easiest to get subtly wrong. Here's the loose soil they need, why feeding them like leafy crops backfires, and what causes forked carrots.", "shelf": "What to grow", "hero": "daucus_carota", "thumb": "card_scene_root-vegetables-harvest", "plants": ["daucus_carota"], "related": ["the-soil-test", "build-a-raised-bed", "succession-planting"] },
    { "slug": "plant-your-first-bed", "title": "Plant your first bed, step by step", "description": "A first-season walkthrough. Pick a few forgiving crops, count from your frost dates, start what needs a head start, harden it off, and get it in the ground at the right time.", "shelf": "Start here", "hero": "lactuca_sativa", "thumb": "card_lactuca_sativa", "plants": ["lactuca_sativa"], "related": ["frost-dates", "garden-types", "crop-rotation"] },
    { "slug": "bush-or-vining", "title": "Bush or vining squash, and how much room each needs", "description": "Two packets can both say \"squash\" and grow plants that need four times the room. The habit word on the packet is what decides your spacing.", "shelf": "What to grow", "hero": "cucurbita_pepo", "thumb": "card_scene_pumpkin-patch", "plants": ["cucurbita_pepo"], "related": ["plant-your-first-bed", "build-a-three-sisters-mound", "staking-and-support", "container-vegetable-gardening"] },
    { "slug": "build-a-three-sisters-mound", "title": "How to build a Three Sisters mound", "description": "What the mound is for, how big to shape it, and the staggered order to plant corn, beans, and squash, plus the exact block the corn needs to pollinate.", "shelf": "What to grow", "hero": "zea_mays", "thumb": "card_zea_mays", "plants": ["zea_mays", "phaseolus_vulgaris", "cucurbita_pepo"], "related": ["staking-and-support", "companion-planting-honestly", "plant-your-first-bed"] },
    { "slug": "do-beans-feed-the-corn", "title": "Do beans really feed the corn?", "description": "The most repeated fact about the Three Sisters, that the beans fix nitrogen to feed the corn beside them, is half true, and the wrong half is the one people rely on. Here's what happens.", "shelf": "What to grow", "hero": "phaseolus_vulgaris", "thumb": "card_scene_hand-sowing", "plants": ["phaseolus_vulgaris"], "related": ["build-a-three-sisters-mound", "crop-rotation", "companion-planting-honestly"] },
    { "slug": "what-is-a-milpa", "title": "What is a milpa? The fuller system behind the Three Sisters", "description": "The Three Sisters is the famous three-crop version; the milpa it comes from is a whole interplanted field. What the milpa adds, what it looks like planted, and how to grow a piece of one.", "shelf": "What to grow", "hero": "zea_mays", "thumb": "card_scene_corn-field-rows", "plants": ["zea_mays", "phaseolus_vulgaris", "cucurbita_moschata", "capsicum_annuum", "amaranthus_cruentus"], "related": ["build-a-three-sisters-mound", "do-beans-feed-the-corn", "crop-rotation"] },
    { "slug": "companion-planting-honestly", "title": "What the evidence says about companion planting", "description": "Most companion-planting chart entries are tradition, and few were ever tested. Here's the short list of pairings that hold up, the famous ones that don't, and how to tell which is which.", "shelf": "Myths", "hero": "tagetes_patula", "thumb": "card_scene_marigold-field", "plants": ["tagetes_patula"], "related": ["crop-rotation"] },
    { "slug": "fruit-tree-guild", "title": "The fruit tree guild, role by role: which parts are load-bearing and which are folklore", "description": "The permaculture apple-tree guild looks the same on every blog. Some of it is real and some has nothing behind it. Here is the whole thing graded, claim by claim.", "shelf": "What to grow", "hero": null, "thumb": "card_scene_berry-bushes-fruit", "plants": ["malus_domestica", "trifolium_repens", "symphytum_x_uplandicum", "narcissus_spp", "achillea_millefolium", "elaeagnus_umbellata"], "related": ["companion-planting-honestly", "crop-rotation", "build-a-three-sisters-mound"] },
    { "slug": "pollination-and-fruit-set", "title": "Why is my squash not setting fruit? Pollination for the home gardener", "description": "Lots of flowers and no fruit is usually a pollination problem. How squash, cucumbers, corn, and the crops that need a partner get pollinated, and the short list of what you can do about it.", "shelf": "What to grow", "hero": "cucurbita_pepo", "thumb": "card_scene_pollinator-bee-flower", "plants": ["cucurbita_pepo", "zea_mays"], "related": ["companion-planting-honestly", "build-a-three-sisters-mound"] },
    { "slug": "do-plants-affect-their-neighbours", "title": "Do plants really affect their neighbors? Allelopathy, living mulch, and what the evidence supports", "description": "Some plants do change the ground for the ones beside them, and one will kill your tomatoes. The real effects look nothing like the companion chart.", "shelf": "What to grow", "hero": null, "thumb": "card_scene_celery-cabbage-bed", "plants": ["helianthus_annuus", "foeniculum_vulgare"], "related": ["companion-planting-honestly", "crop-rotation", "build-a-three-sisters-mound", "cover-crops-and-green-manure"] },
    { "slug": "growing-tomatoes", "title": "Growing tomatoes, starting with bush or vining", "description": "A tomato is either determinate or indeterminate. That one word on the label decides its spacing, its support, and when it stops. Everything else follows.", "shelf": "What to grow", "hero": "solanum_lycopersicum", "thumb": "card_scene_tomatoes-on-vine", "plants": ["solanum_lycopersicum"], "related": ["staking-and-support", "why-tomatoes-dont-set-fruit", "blossom-end-rot", "starting-seeds-indoors", "crop-rotation"] },
    { "slug": "how-to-water", "title": "How to water a vegetable garden", "description": "How often, how much, and how to water. Why no one can hand you a watering schedule, the finger test that replaces it, the inch a week your rain counts toward, and the habits (deep, at the base, early, under mulch) that prevent most trouble.", "shelf": "Keep it alive", "hero": "cucurbita_pepo", "thumb": "card_scene_watering-can-bed", "plants": ["cucurbita_pepo"], "related": ["plant-your-first-bed", "container-vegetable-gardening", "where-to-put-a-garden"] },
    { "slug": "growing-beans", "title": "Growing beans: pole or bush, and what the roots leave behind", "description": "The same bean is a knee-high bush or an all-season climbing vine, and the packet says which. How to grow both, and the truth about the nitrogen everyone repeats.", "shelf": "What to grow", "hero": "phaseolus_vulgaris", "thumb": "card_phaseolus_vulgaris", "plants": ["phaseolus_vulgaris"], "related": ["staking-and-support", "do-beans-feed-the-corn", "build-a-three-sisters-mound", "cover-crops-and-green-manure", "succession-planting"] },
    { "slug": "floating-row-covers", "title": "Floating row covers: frost protection, pest exclusion, and the one rule", "description": "A lightweight fabric that buys you a few degrees of frost, keeps pests off physically, and warms the soil. There's one hard rule about when you have to take it off, or you'll get no fruit.", "shelf": "Keep it alive", "hero": "brassica_oleracea", "thumb": "card_brassica_oleracea", "plants": ["brassica_oleracea"], "related": ["pollination-and-fruit-set", "frost-dates", "plant-your-first-bed"] },
    { "slug": "growing-peas", "title": "Growing peas, the crop to plant earlier than feels right", "description": "Peas punish waiting. They go in weeks before the last frost, climb with tendrils, and quit the moment summer arrives, which changes how you plan the whole row.", "shelf": "What to grow", "hero": "pisum_sativum", "thumb": "card_pisum_sativum", "plants": ["pisum_sativum"], "related": ["staking-and-support", "growing-beans", "read-a-planting-calendar", "succession-planting"] },
    { "slug": "growing-cucumbers", "title": "Growing cucumbers on a trellis", "description": "Cucumbers grow fine on the ground and better up a trellis, with straighter fruit in less space. Vining or bush, why you pick daily, and why a bitter one is stressed.", "shelf": "What to grow", "hero": "cucumis_sativus", "thumb": "card_cucumis_sativus", "plants": ["cucumis_sativus"], "related": ["staking-and-support", "bush-or-vining", "pollination-and-fruit-set", "how-to-water", "crop-rotation"] },
    { "slug": "growing-fava-beans", "title": "Growing fava beans, a cool-season bean you grow like a pea", "description": "Fava beans (Vicia faba) are a legume you grow like peas. Sow them early into cold ground and they finish before real summer heat arrives.", "shelf": "What to grow", "hero": "vicia_faba", "thumb": "card_vicia_faba", "plants": ["vicia_faba"], "related": ["growing-peas", "growing-beans", "cover-crops-and-green-manure", "crop-rotation"] },
    { "slug": "why-tomatoes-dont-set-fruit", "title": "Why won't my tomatoes set fruit? Heat, blossom drop, and the shade-cloth mistake", "description": "A tomato plant covered in flowers that drop without making fruit is usually being stopped by the temperature, and specifically by the night temperature. That's why the shade cloth everyone reaches for does nothing.", "shelf": "Keep it alive", "hero": "solanum_lycopersicum", "thumb": "card_scene_harvest-basket-vegetables", "plants": ["solanum_lycopersicum"], "related": ["staking-and-support", "pollination-and-fruit-set", "blossom-end-rot", "how-to-water"] },
    { "slug": "blossom-end-rot", "title": "Why tomatoes rot at the bottom, and how to stop blossom-end rot", "description": "The sunken black patch on the bottom of your tomatoes isn't a disease and usually isn't a calcium shortage, so eggshells and Epsom salts won't help. Here's what it is and the fix that works.", "shelf": "Keep it alive", "hero": "solanum_lycopersicum", "thumb": "card_solanum_lycopersicum", "plants": ["solanum_lycopersicum"], "related": ["how-to-water", "the-soil-test"] },
    { "slug": "growing-potatoes", "title": "Growing potatoes from seed tubers", "description": "The potato (Solanum tuberosum) is a nightshade, kin to tomatoes and peppers, grown from pieces of tuber instead of seed. That decides most of how you grow it.", "shelf": "What to grow", "hero": "solanum_tuberosum", "thumb": "card_solanum_tuberosum", "plants": ["solanum_tuberosum", "solanum_lycopersicum"], "related": ["crop-rotation", "harvest-and-keeping", "the-soil-test", "how-to-water", "growing-tomatoes"] },
    { "slug": "growing-summer-squash", "title": "Growing summer squash, where a few plants are plenty", "description": "The most over-planted vegetable in the garden. Why a row of zucchini buries a household, what bush-or-vining changes about its space, and why the first flowers fall off.", "shelf": "What to grow", "hero": "cucurbita_pepo", "thumb": "card_cucurbita_pepo", "plants": ["cucurbita_pepo"], "related": ["bush-or-vining", "staking-and-support", "growing-cucumbers", "pollination-and-fruit-set", "build-a-three-sisters-mound"] },
    { "slug": "growing-grapes", "title": "Growing grapes, starting with the trellis", "description": "A grape lives twenty years, needs its trellis up before planting day, and wants the job most gardeners skip, which is real pruning.", "shelf": "What to grow", "hero": "vitis_spp", "thumb": "card_vitis_spp", "plants": ["vitis_spp"], "related": ["staking-and-support", "fruit-tree-guild", "currants-and-gooseberries", "where-to-put-a-garden"] },
    { "slug": "homemade-pest-remedies", "title": "Which homemade pest and weed remedies work", "description": "Dish soap, vinegar, eggshells and human hair are the free kitchen-cupboard fixes. The one most often sold as the safe choice is the one that damages your plants.", "shelf": "Myths", "hero": null, "thumb": "card_scene_zucchini-plant", "plants": [], "related": ["soil-myths", "floating-row-covers", "companion-planting-honestly", "blossom-end-rot"] },
    { "slug": "growing-onions-and-garlic", "title": "Growing onions by day length and garlic from a fall planting", "description": "Onions (Allium cepa) and garlic (Allium sativum) are close cousins on opposite calendars. Onions go in early in spring, garlic in autumn.", "shelf": "What to grow", "hero": "allium_cepa", "thumb": "card_allium_cepa", "plants": ["allium_cepa", "allium_sativum"], "related": ["frost-dates-zones-daylength", "harvest-and-keeping", "crop-rotation", "how-to-water"] },
    { "slug": "staking-and-support", "title": "How to stake, cage and trellis your plants", "description": "Some plants can't hold themselves up, and left on the ground they sprawl, rot, and yield poorly. Which crops need support, what kind, and why you put it in the day you plant.", "shelf": "Keep it alive", "hero": "phaseolus_vulgaris", "thumb": "card_scene_bean-teepee-trellis", "plants": ["phaseolus_vulgaris"], "related": ["growing-tomatoes", "growing-beans", "growing-grapes", "build-a-three-sisters-mound", "bush-or-vining"] },
    { "slug": "garden-folklore", "title": "Garden folklore about moon planting, midday watering and talking to plants", "description": "Old beliefs that cost nothing to hold, except the one that leaves a wilting plant unwatered in a heatwave. What's known about each.", "shelf": "Myths", "hero": null, "thumb": "card_scene_hand-sowing", "plants": [], "related": ["how-to-water", "soil-myths", "homemade-pest-remedies", "read-a-planting-calendar"] },
    { "slug": "growing-rhubarb", "title": "Growing rhubarb for its stalks, since the leaves are poisonous", "description": "Rhubarb is one of the easiest perennials to plant, and the only common vegetable where part of the harvest is toxic. Which part, why, and the myths worth ignoring.", "shelf": "What to grow", "hero": "rheum_rhabarbarum", "thumb": "card_rheum_rhabarbarum", "plants": ["rheum_rhabarbarum"], "related": ["fruit-tree-guild", "crop-rotation", "where-to-put-a-garden"] },
    { "slug": "currants-and-gooseberries", "title": "Growing currants and gooseberries, once your local rules allow them", "description": "One of the few fruits that crop in part shade, and the only one with a legal history. What that old ban protects, and how to plant around it.", "shelf": "What to grow", "hero": "ribes_spp", "thumb": "card_ribes_spp", "plants": ["ribes_spp"], "related": ["fruit-tree-guild", "where-to-put-a-garden", "crop-rotation"] },
    { "slug": "making-compost", "title": "Making compost in hot piles and cold piles", "description": "How to make compost that finishes: what goes in, hot versus cold piles, which myths to skip, and the one contamination risk to take seriously.", "shelf": "Know your ground", "hero": null, "thumb": "card_scene_compost-pile-garden", "plants": [], "related": ["the-soil-test", "raised-bed-soil", "cover-crops-and-green-manure", "soil-myths"] },
    { "slug": "whats-eating-my-plants", "title": "What's eating my plants? Reading the damage before you act", "description": "Match the holes, the trails and the cut stems to the culprit first, then use the fix that works. Most of it isn't spray, and some damage costs nothing.", "shelf": "Keep it alive", "hero": null, "thumb": "card_scene_leafy-greens-bed", "plants": [], "related": ["homemade-pest-remedies", "floating-row-covers", "companion-planting-honestly", "crop-rotation"] },
    { "slug": "seed-saving", "title": "Saving seed that comes true", "description": "Tomatoes, peppers, beans and peas come true from saved seed. Squash, corn and the cabbages will surprise you. Which is which, and how to clean, dry and store seed.", "shelf": "What to grow", "hero": null, "thumb": "card_scene_pepper-plants-fruiting", "plants": ["solanum_tuberosum"], "related": ["starting-seeds-indoors", "growing-tomatoes", "growing-beans"] },
    { "slug": "harvest-and-keeping", "title": "When to pick your harvest, and how to make it keep", "description": "The picking signs for each crop, which ones must cure before they'll keep, the three kinds of pantry, and what should never see the refrigerator.", "shelf": "Keep it alive", "hero": null, "thumb": "card_scene_winter-allotment-plots", "plants": ["allium_cepa", "allium_sativum", "solanum_tuberosum", "asparagus_officinalis", "rheum_rhabarbarum"], "related": ["succession-planting", "seed-saving", "growing-root-vegetables"] },
    { "slug": "cold-frames-and-low-tunnels", "title": "Cold frames and low tunnels for extra weeks of season", "description": "What cold frames, low tunnels and row covers really buy: the degrees, the weeks, and the venting chore that decides everything. Plus what to grow under each.", "shelf": "Keep it alive", "hero": null, "thumb": "card_scene_greenhouse-garden", "plants": [], "related": ["floating-row-covers", "frost-dates", "starting-seeds-indoors", "transplanting-seedlings"] },
    { "slug": "weeds", "title": "Controlling weeds, and the weed folklore that fails", "description": "Two habits beat everything: never let a weed set seed, and keep the soil covered. The mulch depths, the shallow hoe, the vinegar myth, and the weeds you plant yourself.", "shelf": "Know your ground", "hero": null, "thumb": "card_scene_garden-path-beds", "plants": ["mentha_spicata", "melissa_officinalis"], "related": ["making-compost", "cover-crops-and-green-manure", "soil-myths"] },
];
const GROW_SHELF = "What to grow";
const START_SHELF = "Start here";
const SHELF_ANCHOR = { "Start here": "start-here", "Know your ground": "know-your-ground", "What to grow": "what-to-grow", "Keep it alive": "keep-it-alive", "Myths": "myths" };
const speciesWithCard = ["allium_cepa", "brassica_oleracea", "capsicum_annuum", "cucumis_sativus", "cucurbita_pepo", "daucus_carota", "lactuca_sativa", "ocimum_basilicum", "phaseolus_vulgaris", "pisum_sativum", "rheum_rhabarbarum", "ribes_spp", "rubus_idaeus", "solanum_lycopersicum", "solanum_melongena", "solanum_tuberosum", "tagetes_patula", "vicia_faba", "vitis_spp", "zea_mays"];

const contentIndex = contentIndex$1.map((e) => ({ ...e, ...esGuide(e.slug) }));
function speciesThumb(id) {
    return speciesWithCard.includes(id) ? `card_${id}` : null;
}
function cardSrcset(thumb) {
    return thumb.startsWith("card_") ? `img/thumbs/${thumb.replace("card_", "card480_")}.webp 480w, img/thumbs/${thumb}.webp 720w` : null;
}
const CARD_SIZES = "(max-width: 46rem) 60vw, 22rem";
function guidesForSpecies(ids, index = contentIndex, exclude = []) {
    const out = [];
    const taken = new Set(exclude);
    for (const id of ids) {
        const free = (e) => !taken.has(e.slug);
        const pick = index.find((e) => e.shelf === GROW_SHELF && e.plants.includes(id) && free(e))
            ?? index.find((e) => e.hero === id && free(e))
            ?? index.find((e) => e.plants.includes(id) && free(e));
        if (!pick)
            continue;
        taken.add(pick.slug);
        out.push({ species: id, guide: pick });
    }
    return out;
}
function guideCountForSpecies(ids, index = contentIndex) {
    const seen = new Set();
    for (const e of index)
        if (e.plants.some((p) => ids.includes(p)))
            seen.add(e.slug);
    return seen.size;
}
function guideBySlug(slug) {
    return contentIndex.find((e) => e.slug === slug) ?? null;
}
function shelfGuides(shelf, limit, exclude = [], index = contentIndex) {
    const all = index.filter((e) => e.shelf === shelf);
    const free = all.filter((e) => !exclude.includes(e.slug));
    const shown = free.slice(0, limit);
    return { shown, total: all.length, rest: free.length - shown.length };
}
function shelfAnchor(shelf) {
    return SHELF_ANCHOR[shelf] ?? "";
}

const card = (g) => ({ slug: g.slug, title: g.title, thumb: g.thumb });
function coachBand(host, heading, cards, show) {
    if (!host)
        return;
    host.hidden = false;
    host.classList.remove("coachfold");
    host.classList.add("coachband");
    const h = document.createElement("p");
    h.className = "coachband-h";
    h.textContent = heading;
    const grid = document.createElement("div");
    grid.className = "coachband-cards";
    for (const c of cards) {
        const a = document.createElement("a");
        a.className = "coachcard";
        a.href = `../guides/${c.slug}/`;
        if (c.thumb) {
            const im = document.createElement("img");
            im.className = "coachcard-img";
            im.src = `img/thumbs/${c.thumb}.webp`;
            const set = cardSrcset(c.thumb);
            if (set) {
                im.srcset = set;
                im.sizes = CARD_SIZES;
            }
            im.alt = "";
            im.width = 720;
            im.height = 360;
            im.loading = "lazy";
            im.decoding = "async";
            a.appendChild(im);
        }
        const t = document.createElement("span");
        t.className = "coachcard-t";
        t.textContent = c.title;
        if (enOnly(`guides/${c.slug}/`))
            t.lang = "en";
        a.append(t);
        grid.appendChild(a);
    }
    if (grid.querySelector("[lang=en]")) {
        const note = document.createElement("p");
        note.className = "hint shelf-lang";
        note.textContent = copy.shelfEnglish;
        host.replaceChildren(h, note, grid);
        return;
    }
    host.replaceChildren(h, grid);
}
function coachFold(host, heading, cards, show) {
    if (!host)
        return;
    host.hidden = false;
    host.classList.remove("coachband");
    host.classList.add("coachfold");
    const det = document.createElement("details");
    det.className = "coachfold-d";
    const sum = document.createElement("summary");
    sum.className = "coachfold-s";
    sum.textContent = heading;
    det.appendChild(sum);
    const ul = document.createElement("ul");
    ul.className = "coachfold-list";
    for (const c of cards) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "coachfold-link";
        a.href = `../guides/${c.slug}/`;
        a.textContent = c.title;
        if (enOnly(`guides/${c.slug}/`))
            a.lang = "en";
        li.appendChild(a);
        ul.appendChild(li);
    }
    det.appendChild(ul);
    host.replaceChildren(det);
}
const COACH_HEADING = copy.coachHeading;
const COACH_HEADING_FOLD = copy.coachHeadingFold;
const picks = (slugs) => slugs.map((slug) => guideBySlug(slug)).filter((g) => !!g).map(card);
const COACH_WHERE = picks(["garden-types", "frost-dates", "plant-your-first-bed"]);

const EXPLAINERS = {
    frost: { label: copy.akExplFrost,
        href: "../explainers/your-zone-does-not-know-your-frost-date/" },
    rotation: { label: copy.akExplRotation,
        href: "../explainers/rotation-belongs-to-the-ground/" },
    pollination: { label: copy.akExplPollination,
        href: "../explainers/what-pollination-actually-needs/" },
};
const sDoy = (d, lat) => (d == null ? null : seasonDoy(d, lat));
const isoDoy = (iso, lat) => sDoy(mmddDoy(iso.slice(5)), lat);
const mmDoy = (mmdd, lat) => sDoy(mmddDoy(mmdd), lat);
const daysBetween = (aIso, bIso) => {
    const a = new Date(Number(aIso.slice(0, 4)), Number(aIso.slice(5, 7)) - 1, Number(aIso.slice(8, 10)));
    const b = new Date(Number(bIso.slice(0, 4)), Number(bIso.slice(5, 7)) - 1, Number(bIso.slice(8, 10)));
    return Math.round((b.getTime() - a.getTime()) / 86400000);
};
const monthDayShort = (mmdd) => {
    const M = [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
        copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec];
    const [mm, dd] = mmdd.split("-").map(Number);
    return mm && dd ? fillCopy("clMonthDay", { month: M[mm - 1].slice(0, 3), day: dd }) : mmdd;
};
function seasonPosition(todayIso, site) {
    if (!site)
        return null;
    const lf = site.last_frost_32f?.p50 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    const today = isoDoy(todayIso, site.lat);
    if (today == null)
        return null;
    if (frostRare(site))
        return null;
    const lfD = lf ? mmDoy(lf, site.lat) : null;
    const ffD = ff ? fallSeasonDoy(ff, site.lat) : null;
    if (lfD != null && today < lfD) {
        const weeks = Math.max(1, Math.round((lfD - today) / 7));
        return fillCopy(weeks === 1 ? "akPosLastFrostOne" : "akPosLastFrostMany", { n: weeks });
    }
    if (ffD != null && today > ffD)
        return copy.akPosPastFreeze;
    if (ffD != null) {
        const weeks = Math.max(1, Math.round((ffD - today) / 7));
        return weeks <= 6 ? fillCopy(weeks === 1 ? "akPosFirstFreezeOne" : "akPosFirstFreezeMany", { n: weeks }) : copy.akPosFullSwing;
    }
    return null;
}
function computeAsk(inp) {
    const asks = [];
    const open = inp.seasons.find((s) => s.id === inp.seasonId) ?? null;
    const cal = inp.site ? frostCalibration(inp.seasons, inp.site) : null;
    const sLat = inp.site?.lat ?? null;
    const today = isoDoy(inp.todayIso, sLat);
    const nowSeason = seasonYearOf(inp.todayIso, sLat);
    if (inp.site && cal && today != null) {
        const seasonObs = (open?.observations ?? []).filter((o) => o.event === "frost" && !!o.date && seasonYearOf(o.date, sLat) === nowSeason);
        const bounds = [];
        const lf50 = inp.site.last_frost_32f?.p50 ?? null;
        const lf10 = inp.site.last_frost_32f?.p10 ?? null;
        const ff50 = inp.site.first_freeze_32f_p50 ?? null;
        if (lf50) {
            const lo = (mmDoy(lf50, sLat) ?? 0) - 30;
            const hi = (lf10 ? mmDoy(lf10, sLat) ?? mmDoy(lf50, sLat) : mmDoy(lf50, sLat)) + 7;
            bounds.push({ b: "spring", lo, hi, date: monthDayShort(lf50) });
        }
        if (ff50) {
            const d = mmDoy(ff50, sLat) ?? 0;
            bounds.push({ b: "fall", lo: d - 21, hi: d + 21, date: monthDayShort(ff50) });
        }
        for (const w of bounds) {
            if (w.lo == null || w.hi == null || today < w.lo || today > w.hi)
                continue;
            const side = cal[w.b];
            if (side.calibrated)
                continue;
            const tapped = seasonObs.some((o) => {
                const d = isoDoy(o.date ?? "", sLat);
                return d != null && d >= w.lo - 7 && d <= w.hi + 7;
            });
            if (tapped)
                continue;
            const n = side.n;
            const left = Math.max(1, cal.min_seasons - n);
            asks.push({
                key: `frost-${w.b}`, kicker: copy.akKickerAroundNow,
                q: w.b === "fall" ? copy.akFrostFallQ : copy.akFrostSpringQ,
                why: fillCopy(w.b === "fall" ? (n > 0 ? "akFrostWhyFallLogged" : "akFrostWhyFallFirst")
                    : (n > 0 ? "akFrostWhySpringLogged" : "akFrostWhySpringFirst"), { date: w.date, n, min: cal.min_seasons, left }),
                go: { label: copy.akFrostGo, act: "log", target: "frost" },
                explainer: n > 0 ? EXPLAINERS.frost : undefined,
            });
            break;
        }
    }
    {
        const planAreas = (Array.isArray(open?.plan) ? open.plan : [])
            .map((e) => e.area).filter((a) => !!a);
        const gap = planAreas.find((a) => {
            const bed = inp.beds.find((b) => b.name === a);
            if (!bed || bed.planted)
                return false;
            const win = inp.bedWindow?.(a);
            return !win || (win.status !== "passed" && !(win.first && daysBetween(inp.todayIso, win.first.date) > 7));
        });
        if (gap) {
            asks.push({
                key: "reality-gap", kicker: copy.akKickerThisWeek,
                q: fillCopy("akGapQ", { bed: gap }),
                why: copy.akGapWhy,
                go: { label: copy.akGapGo, act: "logbed", bed: gap },
            });
        }
    }
    {
        const dated = inp.tasks
            .filter((t) => t.kind !== "logged" && t.kind !== "log_first_freeze" && t.kind !== "heat_marker" && t.kind !== "water_marker" && typeof t.date === "string")
            .filter((t) => !(t.kind === "harvest_open" && t.anchor === "planned"))
            .filter((t) => {
            const d = daysBetween(inp.todayIso, t.date);
            return d >= -3 && d <= 10;
        })
            .sort((a, b) => (a.date < b.date ? -1 : 1));
        const t = dated[0];
        if (t) {
            const d = daysBetween(inp.todayIso, t.date);
            const when = d < 0 ? fillCopy(d === -1 ? "akAgoOne" : "akAgoMany", { n: -d }) : d === 0 ? copy.akWhenToday
                : d === 1 ? copy.akWhenTomorrow : fillCopy("akInDays", { n: d });
            const label = t.species ? inp.cropLabel(t.species) : null;
            const end = t.windowEnd === true;
            asks.push({
                key: `task-${t.kind}`, kicker: copy.akKickerThisWeek,
                q: t.kind === "harvest_open" && label
                    ? (t.bed ? fillCopy(end ? (d < 0 ? "akHarvestEndQBedPast" : "akHarvestEndQBed") : d < 0 ? "akHarvestQBedPast" : "akHarvestQBed", { crop: label, bed: t.bed, when })
                        : fillCopy(end ? (d < 0 ? "akHarvestEndQPast" : "akHarvestEndQ") : d < 0 ? "akHarvestQPast" : "akHarvestQ", { crop: label, when }))
                    : `${(t.text ?? "").replace(/\s+$/, "") || fillCopy("akTaskLands", { when })}`,
                why: t.kind === "harvest_open"
                    ? copy.akHarvestWhy
                    : fillCopy("akTaskWhy", { date: monthDayShort(t.date.slice(5)) }),
                go: t.bed ? { label: fillCopy("akOpenBedLog", { bed: t.bed }), act: "logbed", bed: t.bed, species: t.species ?? undefined }
                    : { label: copy.akOpenCalendar, act: "calendar" },
                ...(t.kind === "harvest_open" && label && t.species
                    ? { qNames: { label, species: t.species } } : {}),
            });
        }
    }
    {
        const plantings = (open?.plantings ?? []).filter((p) => !p.end_cause);
        const inGround = (p) => !!(p.sown || p.transplanted) || p.carried_over === true;
        const standing = new Set([...plantings.filter(inGround), ...plantings.filter((p) => !inGround(p))].map((p) => p.species));
        const speciesOf = (sid) => inp.bundle.species.find((s) => s.id === sid);
        let phKnown = false, drainKnown = false;
        let phUnsure = false, phSalt = false;
        const seen = new Set();
        for (const o of inp.soilObservations) {
            const rec = o;
            if (!rec || rec.plot !== inp.plot)
                continue;
            const j = JSON.stringify(rec.region ?? null);
            if (seen.has(j))
                continue;
            seen.add(j);
            const g = resolveGround(inp.soilObservations, inp.plot, rec.region ?? null);
            if (typeof g.fields.ph === "number" && phComparable(g.src.ph, g.fields.ph_method))
                phKnown = true;
            else if (typeof g.fields.ph === "number") {
                if ((g.fields.ph_method ?? "unknown") === "unknown")
                    phUnsure = true;
                else
                    phSalt = true;
            }
            const d = g.fields.drainage;
            if (typeof d === "string" && d !== "unknown")
                drainKnown = true;
        }
        if (plantings.length) {
            const phSensitive = [...standing].find((sid) => Array.isArray(speciesOf(sid)?.ph_range));
            if (!phKnown && phSensitive) {
                const planned = !plantings.some((p) => p.species === phSensitive && inGround(p));
                const crop = inp.cropLabel(phSensitive);
                asks.push({
                    key: "ph", kicker: copy.akKickerReady,
                    q: fillCopy(phUnsure ? "akPhMethodQ" : phSalt ? "akPhWaterQ" : planned ? "akPhQPlanned" : "akPhQ", { crop }),
                    why: phUnsure ? copy.akPhMethodWhy : phSalt ? copy.akPhWaterWhy : copy.akPhWhy,
                    go: { label: phUnsure ? copy.akPhMethodGo : copy.akPhGo, act: phUnsure ? "soilmethod" : phSalt ? "soilwater" : "soil" },
                    qNames: { label: crop, species: phSensitive },
                });
            }
            if (!drainKnown) {
                asks.push({
                    key: "drainage", kicker: copy.akKickerRain,
                    q: copy.akDrainQ,
                    why: copy.akDrainWhy,
                    go: { label: copy.akDrainGo, act: "log" },
                });
            }
        }
        {
            const gapped = plantings.map((p) => p.species).filter((sid, i, a) => a.indexOf(sid) === i)
                .find((sid) => {
                const sp = speciesOf(sid);
                const span = bloomSpan(sp);
                if (!needsInsects(sp) || span === null)
                    return false;
                const others = plantings.map((p) => p.species).filter((x) => x !== sid);
                return forageInFlower(span, others, inp.bundle).length === 0;
            });
            if (gapped) {
                asks.push({
                    key: "forage", kicker: copy.akKickerBefore,
                    q: fillCopy("akForageQ", { crop: inp.cropLabel(gapped) }),
                    qNames: { label: inp.cropLabel(gapped), species: gapped },
                    why: copy.akForageWhy,
                    go: { label: copy.akForageGo, act: "plan" },
                    explainer: EXPLAINERS.pollination,
                });
            }
        }
        const fullSun = (sid) => speciesOf(sid)?.light_min === "full_sun";
        const sunBed = inp.beds.find((b) => !b.sun && b.planted
            && plantings.some((p) => fullSun(p.species)));
        if (sunBed) {
            asks.push({
                key: "sun", kicker: copy.akKickerLook,
                q: fillCopy("akSunQ", { bed: sunBed.name }),
                why: copy.akSunWhy,
                go: { label: fillCopy("akOpenBed", { bed: sunBed.name }), act: "logbed", bed: sunBed.name },
            });
        }
    }
    if (inp.site && open && !open.closed_date && (open.plantings ?? []).length && today != null) {
        const ffObs = cal?.fall.calibrated ? cal.fall.calibrated_date : null;
        const ff = ffObs ?? (frostRare(inp.site) ? null : inp.site.first_freeze_32f_p50) ?? null;
        const ffD = ff ? mmDoy(ff, sLat) : null;
        if (ffD != null && today > ffD + 14) {
            asks.push({
                key: "season-close", kicker: fillCopy("akKickerSeason", { year: open.id }),
                q: copy.akCloseQ,
                why: copy.akCloseWhy,
                go: { label: fillCopy("akCloseGo", { year: open.id }), act: "log" },
                explainer: EXPLAINERS.rotation,
            });
        }
    }
    if (!inp.beds.length && !(open?.plantings ?? []).length && inp.answersCrop) {
        asks.push({
            key: "ladder-crop", kicker: copy.akKickerPickUp,
            q: fillCopy("akLadderQ", { crop: inp.cropLabel(inp.answersCrop) }),
            why: copy.akLadderWhy,
            go: { label: copy.akLadderGo, act: "plan" },
            qNames: { label: inp.cropLabel(inp.answersCrop), species: inp.answersCrop },
        });
    }
    const [first, ...rest] = asks;
    let quiet = null;
    let quietNames;
    if (!first) {
        const next = inp.tasks
            .filter((t) => t.kind !== "logged" && typeof t.date === "string" && daysBetween(inp.todayIso, t.date) > 0)
            .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
        quiet = next
            ? (next.species
                ? fillCopy("akQuietNextCrop", { date: monthDayShort(next.date.slice(5)), crop: inp.cropLabel(next.species) })
                : fillCopy("akQuietNext", { date: monthDayShort(next.date.slice(5)) }))
            : copy.akQuiet;
        if (next?.species)
            quietNames = { label: inp.cropLabel(next.species), species: next.species };
    }
    let card = {
        ask: first ?? null,
        waiting: rest.slice(0, 2).map((a) => {
            const canned = a.key === "frost-spring" || a.key === "frost-fall"
                ? copy.akWaitFrost : a.key === "reality-gap"
                ? copy.akWaitGap : a.key === "ph"
                ? (a.go.act === "soilmethod" ? copy.akWaitPhMethod : a.go.act === "soilwater" ? copy.akWaitPhWater : copy.akWaitPh) : a.key === "drainage"
                ? copy.akWaitDrainage : a.key === "sun"
                ? copy.akWaitSun : a.key === "season-close"
                ? copy.akWaitClose : null;
            return canned ? { text: canned } : { text: a.q.replace(/\.\s*$/, ""), ...(a.qNames ? { names: a.qNames } : {}) };
        }),
        quiet,
        ...(quietNames ? { quietNames } : {}),
    };
    if (inp.daysAway != null && inp.daysAway >= 60) {
        const pos = seasonPosition(inp.todayIso, inp.site);
        const kicker = pos ? fillCopy("akWelcomePos", { pos }) : copy.akWelcome;
        card = card.ask ? { ...card, ask: { ...card.ask, kicker } } : { ...card, quiet: `${kicker}. ${card.quiet ?? ""}`.trim() };
    }
    return card;
}

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function ladderCrop() {
    try {
        return JSON.parse(localStorage.getItem("gg-answers") ?? "{}").crop ?? null;
    }
    catch {
        return null;
    }
}
function followGo(g) {
    if (g.act === "logbed" && g.bed) {
        go("log");
        app.openLogBed?.(g.bed, g.species ?? null);
        return;
    }
    if (g.act === "log") {
        go("log", g.target);
        return;
    }
    if (g.act === "calendar") {
        go("calendar");
        return;
    }
    if (g.act === "soil") {
        go("log", "soilcard");
        return;
    }
    if (g.act === "soilmethod" || g.act === "soilwater") {
        const kind = g.act === "soilwater" ? "water" : "method";
        whenLoaded("logpage", "ask:soilentry", (m) => m.openSoilEntry(kind));
        go("log", kind === "water" ? "soilphentry" : "soilphmethodq");
        return;
    }
    go("plan");
}
function currentAskCard(bundle) {
    if (!isSignedIn() && !app.logSnapshot.beds.length)
        return null;
    const t = todayIso();
    const lat = num("lat"), lon = num("lon");
    const site = scheduleSite(lat, lon, bundle);
    return computeAsk({
        todayIso: t, site,
        seasons: app.logSnapshot.seasons, seasonId: seasonId(),
        beds: app.logSnapshot.beds,
        soilObservations: app.soilObservations ?? [], plot: app.currentPlotId,
        tasks: gardenWideTasks(bundle, Number(t.slice(0, 4))),
        bundle, answersCrop: ladderCrop(), daysAway: daysAway(),
        cropLabel: (sid) => commonName(bundle, sid) || humanize(sid),
        bedWindow: (b) => app.bedPlantWindow?.(b) ?? null,
    });
}
function followAsk(g) { followGo(g); }
function renderAskCards(bundle) {
    const host = document.getElementById("askcard");
    const mini = document.getElementById("askmini");
    if (!host && !mini)
        return;
    const card = currentAskCard(bundle);
    if (!card) {
        if (host)
            host.hidden = true;
        if (mini)
            mini.hidden = true;
        return;
    }
    if (host) {
        host.hidden = false;
        host.replaceChildren();
        if (card.ask) {
            const a = card.ask;
            const k = document.createElement("p");
            k.className = "ask-k";
            k.textContent = a.kicker;
            const q = document.createElement("p");
            q.className = "ask-q";
            if (a.qNames)
                linkNameIn(q, a.q, a.qNames.label, a.qNames.species);
            else
                q.textContent = a.q;
            const why = document.createElement("p");
            why.className = "ask-why";
            why.textContent = a.why;
            const goBtn = document.createElement("button");
            goBtn.type = "button";
            goBtn.className = "ask-go";
            goBtn.dataset.ask = a.key;
            goBtn.textContent = a.go.label;
            goBtn.addEventListener("click", () => followGo(a.go));
            host.append(k, q, why, goBtn);
            if (a.explainer) {
                const ex = document.createElement("a");
                ex.className = "ask-explainer";
                ex.href = a.explainer.href;
                ex.textContent = a.explainer.label;
                host.append(ex);
            }
        }
        else if (card.quiet) {
            const q = document.createElement("p");
            q.className = "ask-quiet";
            if (card.quietNames)
                linkNameIn(q, card.quiet, card.quietNames.label, card.quietNames.species);
            else
                q.textContent = card.quiet;
            host.append(q);
        }
        if (card.waiting.length) {
            const w = document.createElement("p");
            w.className = "ask-later";
            const list = document.createElement("span");
            card.waiting.forEach((item, i) => {
                if (i)
                    list.appendChild(document.createTextNode(" · "));
                if (item.names)
                    linkNameIn(list, item.text, item.names.label, item.names.species);
                else
                    list.appendChild(document.createTextNode(item.text));
            });
            const frag = document.createDocumentFragment();
            frag.append(...list.childNodes);
            fillNodes(w, copy.akWaitingLine, { list: frag });
            host.append(w);
        }
    }
    if (mini) {
        if (card.ask) {
            mini.hidden = false;
            mini.replaceChildren();
            const b = document.createElement("button");
            b.type = "button";
            b.className = "askmini-line";
            b.dataset.ask = card.ask.key;
            b.textContent = fillCopy("akMiniLine", { kicker: card.ask.kicker, q: card.ask.q });
            const g = card.ask.go;
            b.addEventListener("click", () => followGo(g));
            mini.append(b);
        }
        else {
            mini.hidden = true;
        }
    }
}

let key;
let loaded = false;
async function loadMapsConfig() {
    if (loaded)
        return;
    loaded = true;
    try {
        const res = await fetch("./maps.json", { cache: "no-store" });
        if (res.ok) {
            const body = (await res.json());
            const clean = (v) => typeof v === "string" && v.trim() ? v.trim() : undefined;
            key = clean(body.apiKey) ?? clean(body.tilesKey) ?? clean(body.geocodingKey);
        }
    }
    catch {
    }
}
const mapsApiKey = () => key;
let mapsJsLoading = null;
function loadMapsJs() {
    const w = window;
    if (w.google?.maps?.Geocoder)
        return Promise.resolve(true);
    if (mapsJsLoading)
        return mapsJsLoading;
    const k = key;
    if (!k)
        return Promise.resolve(false);
    mapsJsLoading = new Promise((resolve) => {
        const cb = "__ggMapsReady";
        const g = window;
        const finish = (ok) => { clearTimeout(timer); delete g[cb]; resolve(ok); };
        const timer = setTimeout(() => finish(false), 6000);
        g[cb] = () => finish(!!w.google?.maps?.Geocoder);
        const s = document.createElement("script");
        s.async = true;
        s.onerror = () => finish(false);
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(k) +
            "&libraries=places,marker&v=weekly&callback=" + cb + "&loading=async";
        document.head.appendChild(s);
    });
    return mapsJsLoading;
}

function originalsButton() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-quiet mt-orig";
    const on = showingOriginals();
    b.textContent = on ? copy.langOriginalsBack : copy.langOriginals;
    b.addEventListener("click", () => { setShowingOriginals(!on); location.reload(); });
    return b;
}
function mountMtNotice(pageId) {
    if (appLang() !== "es")
        return;
    const page = document.getElementById(pageId);
    if (!page || page.querySelector(":scope > .mtnote"))
        return;
    const box = document.createElement("div");
    box.className = "notice mtnote";
    const p = document.createElement("p");
    p.textContent = showingOriginals() ? copy.langOriginalsOn : copy.langNote;
    box.append(p, originalsButton());
    const h1 = page.querySelector("h1");
    const anchor = h1 && h1.parentElement !== page ? h1.parentElement : h1;
    if (anchor)
        anchor.insertAdjacentElement("afterend", box);
    else
        page.prepend(box);
}
function mountLangBar(onChoose) {
    const host = document.getElementById("langbar");
    if (!host)
        return;
    for (const twin of document.querySelectorAll("[data-lbpre]"))
        twin.remove();
    host.replaceChildren();
    const button = (l, text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip home-pace-a";
        b.dataset.lang = l;
        b.textContent = text;
        b.addEventListener("click", () => onChoose(l));
        return b;
    };
    const p = document.createElement("p");
    p.className = "home-pace-q";
    if (appLang() === "es") {
        host.className = "langbar langnote notice mtnote";
        p.textContent = showingOriginals() ? copy.langOriginalsOn : copy.langNote;
        const toEn = button("en", copy.langNoteEnglish);
        toEn.className = "btn btn-quiet mt-switch";
        host.append(p, originalsButton(), toEn);
    }
    else {
        host.hidden = true;
        return;
    }
    host.hidden = false;
}

function maturityTier(seasons, signedIn) {
    if (!signedIn)
        return "established";
    const species = new Set(seasons.flatMap((s) => (s.plantings ?? []).map((p) => p.species))).size;
    const seasonsPlanted = seasons.filter((s) => s.closed_date != null && (s.plantings ?? []).length > 0).length;
    if (seasonsPlanted >= 2 || species >= 20)
        return "established";
    if (seasonsPlanted >= 1 || species >= 8)
        return "growing";
    return "new";
}

function guideShelf(entries, door) {
    const strip = document.createElement("div");
    strip.className = "shelf";
    for (const g of entries) {
        const a = document.createElement("a");
        a.className = "shelfcard";
        a.href = `../guides/${g.slug}/`;
        a.dataset.guide = g.slug;
        if (enOnly(`guides/${g.slug}/`))
            a.lang = "en";
        if (g.thumb) {
            const im = document.createElement("img");
            im.className = "shelfcard-img";
            im.src = `img/thumbs/${g.thumb}.webp`;
            const set = cardSrcset(g.thumb);
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
        const t = document.createElement("span");
        t.className = "shelfcard-t";
        t.textContent = g.title;
        a.append(t);
        strip.appendChild(a);
    }
    if (door) {
        const d = document.createElement("a");
        d.className = "shelf-door";
        d.href = door.href;
        const l = document.createElement("span");
        l.className = "shelf-door-l";
        l.textContent = `${door.label}\u00a0›`;
        d.appendChild(l);
        strip.appendChild(d);
    }
    if (!strip.querySelector("[lang=en]"))
        return strip;
    const wrap = document.createElement("div");
    wrap.className = "shelfwrap";
    const note = document.createElement("p");
    note.className = "hint shelf-lang";
    note.textContent = copy.shelfEnglish;
    wrap.append(note, strip);
    return wrap;
}

const LANDING_RULE_ID = "R-033";
function wordLandingGrades() {
    for (const el of document.querySelectorAll("#page-start .lg-conf[data-grade] .lg-conf-w")) {
        const w = confidenceWord(el.closest(".lg-conf")?.dataset.grade);
        if (w)
            el.textContent = w;
    }
}
const GRADE_CLASS = { A: "s", B: "p", C: "h" };
function gradeSistersClaims(bundle) {
    const mechs = ((bundle.guilds ?? []).find((g) => g.id === "three_sisters")?.mechanisms ?? []);
    for (const li of document.querySelectorAll("#page-start .lg-claims li[data-role]")) {
        const m = mechs.find((x) => x.role === li.dataset.role && (li.dataset.rule ? x.rule === li.dataset.rule : !x.rule));
        const badge = li.querySelector(".lg-conf");
        if (!m?.grade || !badge || !GRADE_CLASS[m.grade])
            continue;
        badge.dataset.grade = m.grade;
        badge.className = `lg-conf ${GRADE_CLASS[m.grade]}`;
    }
}
function renderLandingProduct(bundle) {
    gradeSistersClaims(bundle);
    wordLandingGrades();
    const host = document.getElementById("lgproduct");
    if (!host)
        return;
    const guild = (bundle.guilds ?? []).find((g) => g.id === "three_sisters");
    const rule = (bundle.rules ?? []).find((r) => r.id === LANDING_RULE_ID);
    const exampleBed = { region: { shape: "rect", x: 0, y: 0, w: 3.048, h: 3.048 } };
    const glimpse = guild ? guildPlacementGlimpse(guild, exampleBed, { lat: 40, lon: -88 }, bundle) : null;
    if (!glimpse && !rule?.mechanism) {
        host.hidden = true;
        host.removeAttribute("aria-busy");
        return;
    }
    host.innerHTML = "";
    const h = document.createElement("h2");
    h.className = "lg-h2";
    h.textContent = copy.landingProductTitle;
    h.dataset.copyKey = "landingProductTitle";
    host.appendChild(h);
    const row = document.createElement("div");
    row.className = "lg-glimpses";
    if (glimpse) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductPlaceKicker;
        k.dataset.copyKey = "landingProductPlaceKicker";
        const frame = document.createElement("div");
        frame.className = "lg-plan-frame";
        glimpse.svg.setAttribute("role", "img");
        glimpse.svg.setAttribute("aria-label", copy.lgPlanAria);
        frame.appendChild(glimpse.svg);
        const legend = document.createElement("ul");
        legend.className = "lg-legend";
        for (const p of glimpse.plants) {
            const li = document.createElement("li");
            const dot = document.createElement("span");
            dot.className = "lg-ldot";
            dot.style.background = p.colour;
            li.append(dot, `${p.count} × ${commonName(bundle, p.species)}`);
            legend.appendChild(li);
        }
        const chip = document.createElement("span");
        chip.className = "lg-fits";
        chip.textContent = copy.lgFitsChip;
        const cap = document.createElement("figcaption");
        cap.textContent = copy.landingProductPlaceCap;
        cap.dataset.copyKey = "landingProductPlaceCap";
        fig.append(k, frame, legend, chip, cap);
        row.appendChild(fig);
    }
    if (rule?.mechanism && rule.claim) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductRuleKicker;
        k.dataset.copyKey = "landingProductRuleKicker";
        const card = document.createElement("div");
        card.className = "lg-rulecard";
        const badge = confidenceBadge(rule.grade ?? "");
        if (badge)
            card.appendChild(badge);
        const claim = document.createElement("p");
        claim.className = "lg-rc-claim";
        claim.textContent = localiseProse(corpusEs(LANDING_RULE_ID, "title") ?? plainClaim(rule.title?.trim() || rule.claim));
        const mech = document.createElement("p");
        mech.className = "lg-rc-mech";
        const mechText = corpusEs(LANDING_RULE_ID, "mechanism") ?? rule.mechanism;
        const sentences = mechText.match(/[^.]+\.?/g) ?? [mechText];
        mech.textContent = sentences.slice(0, 2).join("").trim();
        card.append(claim, mech);
        const ev = document.createElement("a");
        ev.className = "lg-rec-ev";
        ev.href = `#/why?rule=${LANDING_RULE_ID}`;
        ev.textContent = copy.lgSeeEvidence;
        fig.append(k, card, ev);
        row.appendChild(fig);
    }
    host.appendChild(row);
    host.hidden = false;
    host.removeAttribute("aria-busy");
}
function armLandingMotion() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    if (!("IntersectionObserver" in window))
        return;
    const els = Array.from(document.querySelectorAll("#page-start [data-reveal]"));
    if (!els.length)
        return;
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
                e.target.classList.add("in");
                io.unobserve(e.target);
            }
        }
    }, { threshold: 0.15 });
    for (const e of els) {
        e.classList.add("pre");
        io.observe(e);
    }
    window.addEventListener("scroll", () => {
        for (const e of els) {
            if (e.classList.contains("pre") && !e.classList.contains("in")
                && e.getBoundingClientRect().top < 0) {
                e.classList.add("in");
                io.unobserve(e);
            }
        }
    }, { passive: true });
}
const LANDING_SHELF_CARDS = 6;
function renderLandingLibrary() {
    const sec = document.getElementById("lglib");
    if (!sec)
        return;
    const { shown, total, rest } = shelfGuides(GROW_SHELF, LANDING_SHELF_CARDS);
    sec.querySelector(".shelf")?.remove();
    if (!shown.length) {
        sec.hidden = true;
        return;
    }
    const door = rest > 0
        ? { href: `../guides/${shelfAnchor(GROW_SHELF) ? "#" + shelfAnchor(GROW_SHELF) : ""}`, label: copy.landingLibAll.replace("{n}", String(total)) }
        : undefined;
    sec.appendChild(guideShelf(shown, door));
    sec.hidden = false;
}
function glossConfidenceRow() {
    const row = document.querySelector('#page-start [data-copy="landingConfidenceRow"]');
    if (!row || row.querySelector(".glossterm"))
        return;
    const text = copy.landingConfidenceRow;
    const colon = text.indexOf(":");
    const words = text.slice(colon + 1).split("·").map((w) => w.trim());
    if (colon < 0 || words.length !== 3)
        return;
    row.textContent = text.slice(0, colon + 1) + " ";
    ["established", "promising", "hunch"].forEach((key, i) => {
        if (i)
            row.appendChild(document.createTextNode(" · "));
        row.appendChild(glossTerm(key, words[i]));
    });
}
function mountBands(bundle) {
    const lib = document.getElementById("lglib");
    const away = () => document.body.classList.contains("home-returning");
    if (!lib || document.getElementById("lgbands") || awaitingHome() || away())
        return;
    const host = document.createElement("section");
    host.className = "lg-bands";
    host.id = "lgbands";
    host.setAttribute("aria-labelledby", "lgbands-k");
    host.setAttribute("aria-label", copy.lgBandsKicker);
    host.setAttribute("aria-busy", "true");
    host.dataset.reveal = "";
    const es = appLang() === "es";
    host.style.minHeight = matchMedia("(min-width: 780px)").matches ? (es ? "45rem" : "42rem") : (es ? "70rem" : "65rem");
    lib.before(host);
    let io = null, started = false;
    const go = () => {
        if (started || away() || document.getElementById("page-start")?.hidden)
            return;
        started = true;
        io?.disconnect();
        const pair = document.getElementById("lgpair");
        loadChunk("bands").then((m) => { if (pair)
            m.renderPair(bundle, pair); return m.renderBands(bundle, host); }).catch(() => {
            for (const h of [host, pair])
                if (h?.hasAttribute("aria-busy")) {
                    h.hidden = true;
                    h.removeAttribute("aria-busy");
                }
        });
    };
    const arm = () => {
        if ("IntersectionObserver" in window) {
            io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting))
                go(); }, { rootMargin: "800px 0px" });
            io.observe(host);
        }
        whenIdle(go, 4000);
    };
    if (document.readyState === "complete")
        arm();
    else
        addEventListener("load", arm, { once: true });
}
function renderLanding(bundle) {
    renderLandingProduct(bundle);
    renderLandingLibrary();
    mountBands(bundle);
    glossConfidenceRow();
    armLandingMotion();
}

const KEEP_COPY = [copy.acGateCalendarKeep, copy.acGateCalendarSignIn];
const DIARY_COPY = {
    log: [copy.acGateLogBehind, copy.acGateLogSignIn],
    review: [copy.acGateReviewBehind, copy.acGateReviewSignIn],
};
const MON = [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
    copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec];
const GATED_PAGES = ["calendar", "log", "review"];
function authGateState(f) {
    const page = (pid) => {
        if (f.signedIn)
            return { locked: false, panelHidden: true, lines: null };
        if (f.onExample)
            return { locked: false, panelHidden: true, lines: null };
        if (f.backend) {
            let frost = copy.acGateFrost;
            if (pid === "calendar" && f.medianLastFrost) {
                const [mm, dd] = f.medianLastFrost.split("-").map(Number);
                const date = fillCopy("clMonthDay", { month: `${MON[(mm ?? 1) - 1]?.slice(0, 3)}`, day: dd });
                frost = fillCopy("acGateFrostDated", { date });
            }
            const line1 = pid === "calendar" ? KEEP_COPY[0].replace("{frost}", () => frost) : DIARY_COPY[pid][0];
            return { locked: false, panelHidden: false, lines: [line1, pid === "calendar" ? KEEP_COPY[1] : DIARY_COPY[pid][1]] };
        }
        return { locked: false, panelHidden: true, lines: null };
    };
    return { pages: { calendar: page("calendar"), log: page("log"), review: page("review") } };
}
let liveBundle = null;
function setGateBundle(bundle) { liveBundle = bundle; }
function initAuthGate() {
    return () => {
        const lat = num("lat"), lon = num("lon");
        const lf = liveBundle && lat != null && lon != null
            ? resolveClimate(lat, lon, liveBundle)?.site.last_frost_32f?.p50 : null;
        const state = authGateState({
            signedIn: isSignedIn(), backend: backendConfigured(), onExample: isExamplePlot(app.currentPlotId), medianLastFrost: lf ?? null,
        });
        for (const pid of GATED_PAGES) {
            const sec = document.getElementById(`page-${pid}`);
            let panel = sec.querySelector(".lockpanel");
            if (!panel) {
                panel = document.createElement("div");
                panel.className = "lockpanel";
                panel.appendChild(document.createElement("p"));
                panel.appendChild(document.createElement("p"));
                const b = document.createElement("button");
                b.type = "button";
                b.className = "btn btn-primary primary";
                b.textContent = copy.acGateSignInBtn;
                b.addEventListener("click", () => { if (app.openAuthSheet)
                    app.openAuthSheet();
                else
                    location.hash = "#/account"; });
                panel.appendChild(b);
                const tagline = sec.querySelector(".tagline");
                sec.insertBefore(panel, tagline ? tagline.nextSibling : sec.children[1] ?? null);
            }
            const [p1, p2] = [...panel.querySelectorAll("p")];
            const g = state.pages[pid];
            sec.classList.toggle("locked", g.locked);
            panel.hidden = g.panelHidden;
            if (g.lines) {
                p1.textContent = g.lines[0];
                p2.textContent = g.lines[1];
            }
        }
    };
}

const addrRank = () => import('./addrrank.js');
const GRID_BASE_URL = "../build/zip-grid/base.json";
const GRID_DEG = 2.5;
const gridCell = (lat, lon) => [Math.floor(lat / GRID_DEG), Math.floor(lon / GRID_DEG)];
const MONTHS_FULL = [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
    copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec];
const monthDay = (mm, dd) => fillCopy("clMonthDay", { month: MONTHS_FULL[(mm ?? 1) - 1].slice(0, 3), day: String(dd) });
function renderLedgerRing(site, seasons, lat = null) {
    const dial = document.getElementById("ledgerringdial");
    const num = document.getElementById("ledgerringnum");
    const label = document.getElementById("ledgerringlabel");
    const wrap = document.getElementById("ledgerring");
    if (!dial || !num || !label || !wrap)
        return;
    const ring = ledgerRing(seasons, site, lat);
    dial.style.setProperty("--frac", String(ring.frac));
    num.textContent = ring.center;
    label.textContent = ring.label;
    wrap.classList.toggle("live", ring.state === "live");
    wrap.hidden = ring.state === "wait" && ring.n === 0;
}
function main2(bundle) {
    setGateBundle(bundle);
    initDossier(bundle);
    $$1("info").textContent = bundleInfoLine(bundle);
    renderLanding(bundle);
    const homeNow = () => {
        const h = chunkReady("home");
        if (h) {
            markHomeworthy(h.renderHomeNow(activeBundle(bundle)), homeSettled());
            return;
        }
        if (hasGround() || app.currentPlot?.anchor)
            void loadChunk("home").catch(() => { });
    };
    onChunkLoaded((k) => { if (k === "home")
        homeNow(); });
    app.homeRefresh = homeNow;
    app.invalidateHomePosts = () => { chunkReady("home")?.invalidateHomePosts(); };
    window.addEventListener("hashchange", () => {
        if (!location.hash.startsWith("#/start"))
            return;
        homeNow();
    });
    let prevRoutePlan = currentRoute() === "plan";
    window.addEventListener("hashchange", () => {
        const nowPlan = currentRoute() === "plan";
        if (nowPlan && !prevRoutePlan && app.logSnapshot.beds.length > 0) {
            requestAnimationFrame(() => { if (currentRoute() === "plan")
                void app.groundRefitIfDrifted?.(); });
        }
        prevRoutePlan = nowPlan;
    });
    const fams = $$1("families");
    for (const f of [...familiesOf(bundle)].sort((a, b) => familyName(a).localeCompare(familyName(b)))) {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = f;
        cb.className = "fam";
        const name = document.createElement("span");
        name.textContent = titleCase(familyName(f));
        label.appendChild(cb);
        label.appendChild(name);
        fams.appendChild(label);
    }
    const siteFromForm = () => {
        const sunVal = currentBedSun();
        const { history, source } = historySource(bundle);
        return {
            site: {
                bed_m2: (() => { const r = currentBedRegion(); return r ? area(r) : null; })(),
                lat: num("lat"),
                lon: num("lon"),
                sun: sunVal,
                history,
                verticillium_reservoir: source.kind === "derived" ? source.derived.verticillium_reservoir : false,
                allelopathic_residue: source.kind === "derived" ? source.derived.allelopathic_residue : [],
                last_season_species: source.kind === "derived" ? source.derived.last_season_species : [],
                season_year: seasonId(),
            },
            source,
        };
    };
    let reviewRedraw = null;
    const gardenLabel = () => gardenNameOf(app.currentPlot, app.currentPlotId);
    const reviewData = () => {
        const label = gardenLabel();
        const { site } = siteFromForm();
        const clim = site.lat != null && site.lon != null ? scheduleClimate(site.lat, site.lon, bundle) : null;
        const ab = activeBundle(bundle);
        return {
            bundle: ab,
            seasons: app.logSnapshot.seasons,
            beds: app.logSnapshot.beds,
            priorOccupancy: app.logSnapshot.priorOccupancy,
            clim: clim?.site ?? null,
            site,
            plotLabel: gardenShownName(label, app.currentPlot?.shared),
            commonName: (sid) => commonName(ab, sid),
            ruleClaim: (id) => ruleClaim(bundle, id),
        };
    };
    whenShownChunk("share", "share", "share:init", (m) => m.initShare(() => bundle));
    const shareCurrentPlan = async () => {
        const box = $$1("sharebox"), msg = $$1("shareboxmsg"), urlEl = $$1("shareurl");
        const seasons = app.logSnapshot.seasons;
        const season = seasons.find((s) => s.id === seasonId()) ?? seasons[seasons.length - 1] ?? null;
        const beds = app.logSnapshot.beds;
        box.hidden = false;
        if (!beds.length && !(season?.plantings ?? []).length) {
            urlEl.hidden = true;
            msg.textContent = copy.apShareNothing;
            return;
        }
        const ab = activeBundle(bundle);
        const label = gardenLabel();
        const { buildSharePayload, encodeShare } = await loadChunk("share");
        const payload = buildSharePayload(label, beds, season, bundle, app.draftPlantings);
        for (const q of payload.plants)
            if (q.n)
                q.n = commonName(ab, q.s);
        const url = `${location.origin}${location.pathname}#/share/${await encodeShare(payload)}`;
        urlEl.hidden = false;
        urlEl.textContent = url;
        msg.textContent = fillCopy("apShareTravels", { n: url.length });
        const nav = navigator;
        if (nav.canShare?.({ url })) {
            try {
                await nav.share({ title: copy.apShareTitle, url });
                return;
            }
            catch { }
        }
        try {
            await navigator.clipboard.writeText(url);
            toast(copy.apShareCopied);
        }
        catch { }
    };
    ($$1("sharebtn")).addEventListener("click", () => {
        const box = $$1("sharebox");
        if (!box.hidden) {
            box.hidden = true;
            return;
        }
        void shareCurrentPlan();
    });
    ($$1("shareclose")).addEventListener("click", () => { $$1("sharebox").hidden = true; });
    const draw = () => {
        document.documentElement.dataset.maturity = maturityTier(app.logSnapshot.seasons, isSignedIn());
        const hasLog = app.logSnapshot.seasons.length > 0;
        const located = num("lat") != null && num("lon") != null;
        if (located)
            app.ensureZipData?.(num("lat"), num("lon"));
        if (hasLog || located)
            markStarted();
        const exBanner = document.getElementById("examplebanner");
        if (exBanner)
            exBanner.hidden = !isExamplePlot(app.currentPlotId);
        $$1("candrow").hidden = app.logSnapshot.beds.length === 0;
        whenShown("plan", "plan:coach", () => {
            const cw = document.getElementById("coach-where");
            if (located)
                coachFold(cw, COACH_HEADING_FOLD, COACH_WHERE);
            else
                coachBand(cw, COACH_HEADING, COACH_WHERE);
        });
        const { site, source } = siteFromForm();
        {
            const showProposal = located && app.logHydrated && app.logSnapshot.beds.length === 0;
            const nextRow = document.getElementById("where-next-row");
            if (nextRow)
                nextRow.hidden = showProposal;
            if (showProposal)
                whenLoaded("plan", "plan:firstbed", (m) => m.proposeFirstBed(bundle, site));
            else {
                whenLoaded("plan", "plan:firstbed", (m) => m.firstBedHidden());
                const fb = document.getElementById("firstbed");
                if (fb)
                    fb.hidden = true;
                app.groundClearProposal?.();
            }
        }
        const declaring = source.kind === "derived" && !source.tracked;
        const changing = spaceChoice() === "changing";
        $$1("sec-eligibility").hidden = !declaring || !(isSignedIn() || changing);
        if (declaring) {
            $$1("famhint").textContent = changing
                ? copy.apFamHintChanging
                : copy.apFamHint;
            const bed = app.logSnapshot.beds.find((b) => b.name === ($$1("candbed")).value);
            const seedKey = bed ? JSON.stringify(bed.region) : null;
            const seed = seedKey ? app.logSnapshot.priorOccupancy.find((s) => JSON.stringify(s.region) === seedKey) : undefined;
            const fams = new Set(seed?.families ?? []);
            for (const cb of document.querySelectorAll("#families input.fam"))
                cb.checked = fams.has(cb.value);
        }
        const clim = site.lat != null && site.lon != null ? scheduleClimate(site.lat, site.lon, bundle) : null;
        const zone = site.lat != null && site.lon != null ? resolveZone(site.lat, site.lon, bundle) : null;
        const ownLat = !clim && site.lat != null && site.lon != null && app.climateSettled?.(site.lat, site.lon) ? site.lat : null;
        const fcal = clim ? frostCalibration(app.logSnapshot.seasons, clim.site)
            : ownLat != null ? frostCalibration(app.logSnapshot.seasons, null, ownLat) : null;
        const reading = site.lat != null && site.lon != null && !app.climateSettled?.(site.lat, site.lon);
        renderClimate(clim, zone, site.lat ?? null, fcal, null, app.currentPlotId, reading);
        withLocalHelp((m) => m.renderExtension(site));
        whenLoaded("logpage", "log:soil", (m) => {
            const openSeason$1 = openSeason();
            const soilPlantings = (openSeason$1?.plantings ?? [])
                .filter((p) => !p.end_date)
                .map((p) => {
                const resolved = resolveSpecies(p.species, p.cultivar_group ?? null, activeBundle(bundle));
                const common = plantingLabel(activeBundle(bundle), p.species, p.cultivar_group ?? null);
                return {
                    label: common || humanize(p.species),
                    region: p.region,
                    resolved,
                    species: p.species,
                };
            });
            m.renderSoil(app.currentPlotId, app.soilObservations, site.lat ?? null, site.lon ?? null, app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })), soilPlantings, (region) => {
                if (!region)
                    return null;
                try {
                    const prior = priorSeasons();
                    const reg = region;
                    const derived = deriveHistory(reg, prior, activeBundle(bundle));
                    const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, reg);
                    return { history: merged.history, season_year: seasonId() ?? undefined };
                }
                catch {
                    return null;
                }
            }, activeBundle(bundle));
            m.renderSoilSummary(app.currentPlotId, app.soilObservations, app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })));
        });
        whenLoaded("plan", "plan:eligibility", (m) => m.renderEligibility(activeBundle(bundle), site, source));
        whenShownChunk("log", "logpage", "log:frost", (m) => {
            const synth = app.syntheticOn && clim ? m.makeSyntheticSeasons(clim.site) : [];
            m.renderFrost(clim?.site ?? null, [...app.logSnapshot.seasons, ...synth], app.syntheticOn, ownLat);
        });
        renderEarned(clim?.site ?? null, app.logSnapshot.seasons, app.currentPlotId, ownLat);
        renderLedgerRing(clim?.site ?? null, app.logSnapshot.seasons, ownLat);
        whenShownChunk("account", "account", "account:knows", (m) => m.renderGardenKnows(clim?.site ?? null, site.lat ?? null, site.lon ?? null, zone?.label ?? (zone?.zone != null ? String(zone.zone) : null)));
        whenShownChunk("log", "logpage", "log:solar", (m) => m.renderSolar(bundle, site));
        installPlanSeams(bundle, site);
        whenShownChunk("plan", "plan", "plan:teams", (m) => m.renderGuilds(bundle, site));
        whenShownChunk("plan", "plan", "plan:nextseason", (m) => m.renderNextSeason(bundle, site));
        whenShownChunk("plan", "plan", "plan:mybed", (m) => m.renderMyBed(activeBundle(bundle), site));
        whenLoaded("plan", "plan:season", (m) => m.renderSeason(activeBundle(bundle)));
        installCalFacts(activeBundle(bundle));
        whenShownChunk("calendar", "calendar", "calendar", (m) => { wireCalendar(m); m.renderCalendar(activeBundle(bundle)); });
        keepRemindersInStep(activeBundle(bundle));
        renderAskCards(activeBundle(bundle));
        app.draftPlantings = draftPlantings(activeBundle(bundle), site);
        homeNow();
        whenShownChunk("review", "review", "review", (m) => { if (reviewRedraw)
            reviewRedraw();
        else
            reviewRedraw = m.initReview(reviewData); });
        app.planDots = appliedPlanDots(activeBundle(bundle), site);
        rememberMyPlants(!isExamplePlot(app.currentPlotId));
        app.groundRedraw?.();
        const planReady = app.logSnapshot.beds.length > 0;
        const handoff = $$1("handoff");
        const line = handoff.querySelector("p");
        const go = $$1("handoffgo");
        if (planReady && app.logSnapshot.seasons.length === 0) {
            line.innerHTML = copy.apHandoffLogHtml;
            go.textContent = copy.apHandoffLogBtn;
            handoff.hidden = false;
        }
        else {
            handoff.hidden = true;
        }
        const stepFacts = {
            located,
            zoneLabel: zone ? (zone.label ?? String(zone.zone ?? "")) || null : null,
            areaCount: app.logSnapshot.beds.length,
            planned: (() => {
                const sn = openSeason();
                const drafted = Array.isArray(sn?.plan) ? sn.plan.length : 0;
                const live = Array.isArray(sn?.plantings)
                    ? sn.plantings.filter((p) => !p.end_cause).length : 0;
                return drafted > 0 || live > 0;
            })(),
            frostP50: (() => {
                const lf = clim?.site.last_frost_32f?.p50;
                if (!lf)
                    return null;
                const [mm, dd] = lf.split("-").map(Number);
                return monthDay(mm, dd);
            })(),
            freezeP50: (() => {
                const ff = clim?.site.first_freeze_32f_p50;
                if (!ff)
                    return null;
                const [mm, dd] = ff.split("-").map(Number);
                return monthDay(mm, dd);
            })(),
            address: app.currentPlot?.address?.trim() || null,
            seasonDays: frostGiven(clim?.site) ? null : clim?.site.growing_season_days_p50 ?? null,
            frostRare: frostRare(clim?.site) && !frostGiven(clim?.site),
            frostSome: frostWord(clim?.site) === "some",
            frostMost: frostWord(clim?.site) === "most",
            frostNone: site.lat != null && site.lon != null && !clim,
            frostOwn: !!clim?.site.own_window,
            frostModeled: frostDatesModelled(clim?.site),
            frostImpossible: frostPossible(clim?.site) === false,
            frostLast: clim?.site.last_frost_32f?.p50 ?? null,
            frostFirst: clim?.site.first_freeze_32f_p50 ?? null,
            plotId: app.currentPlotId || null,
        };
        whenLoaded("plan", "plan:steps", (m) => m.updateStepStates({ ...stepFacts, myBedCount: m.myBedMemberCount() }));
        whenLoaded("plan", "plan:gardenadd-draw", (m) => m.gardenAddDraw(located));
        applyAuthGate();
        const du = document.getElementById("dimunit");
        if (du)
            du.textContent = lengthUnit();
        const up = document.getElementById("traceupgrade");
        if (up)
            up.hidden = !app.logSnapshot.beds.some((b) => b.sized && b.structure !== "container");
        const sz = document.getElementById("soilzone");
        if (sz)
            sz.hidden = app.logSnapshot.beds.length === 0;
        const cont = document.getElementById("ground-continue");
        if (cont) {
            const bedReady = app.logSnapshot.beds.length > 0;
            cont.disabled = !bedReady;
            cont.textContent = bedReady ? copy.planGroundContinue : copy.planGroundContinueLocked;
        }
        const nudgeRow = document.getElementById("teams-nudge-row");
        if (nudgeRow) {
            const hasBed = app.logSnapshot.beds.length > 0;
            nudgeRow.hidden = !hasBed;
            if (hasBed) {
                const open = openSeason();
                const hasDraft = Array.isArray(open?.plan) && open.plan.length > 0;
                const btn = document.getElementById("teamsnudge");
                if (btn) {
                    const noFit = !hasDraft && document.getElementById("guilds")?.dataset.teamsFit === "0";
                    btn.textContent = hasDraft ? copy.apNudgeDates : noFit ? copy.apNudgeOwn : copy.apNudgePick;
                    btn.dataset.hasDraft = hasDraft ? "1" : "";
                    btn.dataset.noFit = noFit ? "1" : "";
                }
            }
        }
    };
    const commitPlace = (lat, lon, label) => {
        void app.placeBareGarden?.(lat, lon, label)?.catch(() => { });
    };
    const setLocation = (lat, lon, said) => {
        ($$1("lat")).value = String(lat);
        ($$1("lon")).value = String(lon);
        if (said)
            $$1("ziphint").textContent = said;
        draw();
    };
    const syncWhereMap = () => {
        const p = chunkReady("plan");
        if (!document.body.classList.contains("locating")) {
            p?.gmapShow(false);
            return;
        }
        if (!p)
            return;
        void p.ensureWhereMap(p.whereShown, (lat, lon) => {
            setLocation(lat, lon, copy.gmPinMoved);
            commitPlace(lat, lon);
        }).then((up) => { if (up)
            void p.confirmWhereShown(); });
    };
    window.addEventListener("gg-step-changed", syncWhereMap);
    window.addEventListener("gg-garden-shown", () => {
        const p = chunkReady("plan");
        if (!p)
            return;
        const at = p.whereShown();
        p.followWhereMap(at.lat, at.lon);
        void p.confirmWhereShown();
    });
    const openGardenAdd = () => {
        if (currentRoute() !== "plan")
            location.hash = "#/plan";
        whenShownChunk("plan", "plan", "plan:gardenadd", (m) => m.openGardenAdd());
    };
    for (const id of ["gardenadd-open", "plotaddtoggle"])
        document.getElementById(id)?.addEventListener("click", openGardenAdd);
    app.openGardenAdd = (o) => {
        if (currentRoute() !== "plan")
            location.hash = "#/plan";
        whenShownChunk("plan", "plan", "plan:gardenadd", (m) => m.openGardenAdd(null, o));
    };
    if (!plusPreview()) {
        const b = document.getElementById("plotaddtoggle");
        if (b)
            b.hidden = true;
    }
    syncWhereMap();
    let censusFailWhy = "";
    let osmUnreachable = false;
    const censusAttempt = (endpoint, params) => new Promise((resolve) => {
        const cb = "__ggCensus" + Math.floor(Math.random() * 1e9);
        const script = document.createElement("script");
        const w = window;
        const done = (v) => {
            clearTimeout(timer);
            delete w[cb];
            script.remove();
            resolve(v);
        };
        const timer = setTimeout(() => done(null), 3500);
        w[cb] = (body) => {
            const m = body.result?.addressMatches?.[0];
            done(m ? { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress } : "no-match");
        };
        script.onerror = () => done(null);
        script.src = "https://geocoding.geo.census.gov/geocoder/locations/" + endpoint +
            "?benchmark=Public_AR_Current&format=jsonp&callback=" + cb + "&" + params;
        document.head.appendChild(script);
    });
    const censusGeocode = async (q) => {
        const attempts = [censusAttempt("onelineaddress", "address=" + encodeURIComponent(q))];
        const parts = q.split(",").map((t) => t.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const rest = parts.slice(2).join(" ");
            const zip = /\b\d{5}\b/.exec(rest)?.[0];
            const state = rest.replace(/\b\d{5}(-\d+)?\b/, "").trim();
            let p = "street=" + encodeURIComponent(parts[0]) + "&city=" + encodeURIComponent(parts[1]);
            if (state)
                p += "&state=" + encodeURIComponent(state);
            if (zip)
                p += "&zip=" + zip;
            attempts.push(censusAttempt("address", p));
        }
        const results = await Promise.all(attempts);
        const hit = results.find((r) => r !== null && r !== "no-match");
        if (hit)
            return hit;
        censusFailWhy = results.some((r) => r === "no-match")
            ? `house-number service found no match${attempts.length > 1 ? " (one-line and structured forms both tried)" : ""}`
            : "house-number service didn't answer";
        return null;
    };
    let googleFailWhy = "";
    const googleGeocode = async (q) => {
        googleFailWhy = "";
        const key = mapsApiKey();
        if (!key)
            return null;
        if (!(await loadMapsJs())) {
            googleFailWhy = "Google Maps didn’t load";
            return null;
        }
        try {
            const geocoder = new window.google.maps.Geocoder();
            const { results } = await geocoder.geocode({ address: q, region: (await addrRank()).region() });
            const r = results?.[0];
            if (r) {
                const lt = r.geometry.location_type;
                return {
                    lat: r.geometry.location.lat(), lon: r.geometry.location.lng(),
                    label: r.formatted_address,
                    exact: lt === "ROOFTOP" || lt === "RANGE_INTERPOLATED",
                    cc: r.address_components?.find((c) => c.types.includes("country"))?.short_name,
                };
            }
            googleFailWhy = "Google: no result";
        }
        catch (e) {
            const code = e.code;
            const msg = e.message;
            googleFailWhy = "Google: " + (code || msg || "geocode failed").slice(0, 120);
        }
        return null;
    };
    let placesLib = null;
    let placesToken = null;
    let placesDead = false;
    let placesWhy = "";
    const loadPlaces = async () => {
        if (placesDead)
            return false;
        if (placesLib?.AutocompleteSuggestion)
            return true;
        const key = mapsApiKey();
        if (!key) {
            placesWhy = "no Google key - keyless address search";
            return false;
        }
        if (!(await loadMapsJs())) {
            placesDead = true;
            placesWhy = "Google Maps JS did not load";
            return false;
        }
        try {
            const maps = window.google.maps;
            placesLib = maps.places?.AutocompleteSuggestion ? maps.places
                : maps.importLibrary ? await maps.importLibrary("places") : null;
            if (!placesLib?.AutocompleteSuggestion) {
                placesDead = true;
                placesWhy = "Places library loaded but AutocompleteSuggestion is missing (enable 'Places API (New)' on the key)";
                return false;
            }
            placesWhy = "";
            return true;
        }
        catch (e) {
            placesDead = true;
            placesWhy = "Places failed to load: " + String(e?.message ?? e).slice(0, 80);
            return false;
        }
    };
    const newPlacesSession = () => {
        const T = placesLib?.AutocompleteSessionToken;
        placesToken = T ? new T() : null;
    };
    const placesSuggest = async (q) => {
        if (!(await loadPlaces()))
            return null;
        try {
            if (!placesToken)
                newPlacesSession();
            const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: q, sessionToken: placesToken ?? undefined,
                region: (await addrRank()).region(),
            });
            const out = [];
            for (const s of suggestions || []) {
                const p = s.placePrediction;
                if (!p)
                    continue;
                const primary = p.mainText?.text ?? p.text?.text ?? "";
                if (!primary)
                    continue;
                out.push({ lat: NaN, lon: NaN, label: [primary, p.secondaryText?.text].filter(Boolean).join(", "),
                    primary, secondary: p.secondaryText?.text ?? "", exact: true, us: /\bUSA\b/.test(p.secondaryText?.text ?? ""), pred: p });
            }
            return out.slice(0, 5);
        }
        catch (e) {
            placesDead = true;
            placesWhy = "Places request failed: " + String(e?.message ?? e).slice(0, 80);
            return null;
        }
    };
    app.speciesName = (sid) => commonName(activeBundle(bundle), sid);
    {
        const r006 = bundle.rules.find((x) => x.id === "R-006");
        const thresholdM = (r006?.trigger?.threshold_cm ?? 120) / 100;
        app.bedReachNote = (minSpanM) => minSpanM > thresholdM + 1e-9
            ? copy.apReachNote
            : null;
    }
    {
        const r098 = bundle.rules.find((x) => x.id === "R-098");
        const maxSpanM = (r098?.params?.container_max_span_cm ?? 75) / 100;
        app.bedContainerNote = (spanM) => spanM > maxSpanM + 1e-9
            ? fillCopy("apContainerNote", { cm: Math.round(maxSpanM * 100) })
            : null;
    }
    {
        const STRUCTS = ["raised", "in_ground", "container", "field"];
        const guildSpecies = (g) => {
            const out = new Set();
            for (const r of g.roles ?? []) {
                if (r.canonical)
                    out.add(r.canonical);
                if (r.substitute)
                    out.add(r.substitute);
                if (r.alternative)
                    out.add(r.alternative);
                for (const a of r.alternatives ?? [])
                    out.add(typeof a === "string" ? a : a.species);
            }
            for (const m of g.members ?? [])
                if (m.species)
                    out.add(m.species);
            return out;
        };
        const constrained = bundle.guilds.filter((g) => STRUCTS.some((s) => !guildStatus(g, null, null, bundle, s).fits));
        const matchBySpecies = (sp) => {
            let best = null, bestSize = Infinity;
            for (const g of constrained) {
                const gs = guildSpecies(g);
                if (![...sp].every((s) => gs.has(s)))
                    continue;
                if (gs.size < bestSize) {
                    best = g;
                    bestSize = gs.size;
                }
            }
            return best;
        };
        app.bedStructureBlockers = (bedName) => {
            const empty = { blocked: [], reason: () => null };
            const open = openSeason();
            let guild = null;
            const entry = open?.plan?.find((e) => e.area === bedName);
            if (entry?.guild)
                guild = bundle.guilds.find((g) => g.id === entry.guild) ?? null;
            if (!guild && open) {
                const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
                if (bed) {
                    const sp = new Set((open.plantings ?? [])
                        .filter((pl) => !pl.carried_over && plantingOnBed(pl.region, bed.region))
                        .map((pl) => pl.species));
                    if (sp.size)
                        guild = matchBySpecies(sp);
                }
            }
            if (!guild)
                return empty;
            const reasons = new Map();
            for (const s of STRUCTS) {
                const st = guildStatus(guild, null, null, bundle, s);
                if (!st.fits && st.reason)
                    reasons.set(s, st.reason.text);
            }
            return { blocked: [...reasons.keys()], reason: (s) => reasons.get(s) ?? null };
        };
    }
    app.guildIsHills = (guildId) => {
        const g = bundle.guilds.find((x) => x.id === guildId);
        return !!g && laysOutAsHills(g);
    };
    app.bedRotationSeasons = (region) => {
        try {
            const prior = priorSeasons();
            const derived = deriveHistory(region, prior, activeBundle(bundle));
            const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, region);
            const years = Object.keys(merged.history).map(Number).filter(Number.isFinite);
            if (!years.length)
                return null;
            const now = seasonId() ?? new Date().getFullYear();
            return Math.max(0, now - Math.max(...years));
        }
        catch {
            return null;
        }
    };
    app.setLocation = (lat, lon, said) => {
        ($$1("lat")).value = String(lat);
        ($$1("lon")).value = String(lon);
        $$1("ziphint").textContent = said ?? fillCopy("apLocationFromCentre", { lat, lon });
        draw();
    };
    let applyToken = 0;
    const applyAddr = (lat, lon, label, cc, place) => {
        applyToken++;
        notePlaceCountry(lat, lon, cc);
        ($$1("lat")).value = String(Math.round(lat * 1e5) / 1e5);
        ($$1("lon")).value = String(Math.round(lon * 1e5) / 1e5);
        $$1("ziphint").textContent = label;
        $$1("addrlist").replaceChildren();
        ($$1("addr")).blur();
        window.dispatchEvent(new Event("gg-sheet-locating"));
        draw();
        app.groundCenterOn?.(lat, lon);
        chunkReady("plan")?.setWhereMapCenter(lat, lon);
        commitPlace(Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, place);
        requestAnimationFrame(() => window.dispatchEvent(new Event("gg-sheet-map")));
        settleSheetAfterCommit();
    };
    const settleSheetAfterCommit = () => {
        const sb = document.getElementById("sheetbody");
        if (!sb)
            return;
        seat(sb, "top", { hold: 2500, reason: "address-commit" });
    };
    const searchCandidates = async (q) => {
        const A = await addrRank();
        const home = A.deviceCountry();
        const es = appLang() === "es";
        const fromZip = async () => {
            const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(q);
            if (!m || !A.zipMeansUs(home, es))
                return [];
            app.ensureZipData?.(null, null, m[1]);
            for (let i = 0; i < 40; i++) {
                const hit = zipToLatLon(m[1], bundle.zip_index?.zips ?? null);
                if (hit) {
                    const label = `ZIP ${m[1]}, USA`;
                    return [{ lat: hit.lat, lon: hit.lon, label, ...A.splitLabel(label), exact: false, us: true, cc: "US",
                            note: copy.apNoteZipMiddle }];
                }
                await new Promise((r) => setTimeout(r, 100));
            }
            return [];
        };
        const fromGoogle = async () => {
            const g = await googleGeocode(q);
            return g ? [{ lat: g.lat, lon: g.lon, label: g.label, ...A.splitLabel(g.label), exact: g.exact,
                    us: /\bUSA\b/.test(g.label), cc: g.cc, note: g.exact ? undefined : copy.apNoteApprox }] : [];
        };
        const fromCensus = async () => {
            if (home && home !== "us")
                return [];
            const us = await censusGeocode(q);
            return us ? [{ lat: us.lat, lon: us.lon, label: us.label, ...A.splitLabel(us.label), exact: true, us: true, cc: "US" }] : [];
        };
        const fromNominatim = async () => {
            const rows = await A.fromOsm(q, es, copy.apNoteStreet);
            osmUnreachable = rows === null;
            return rows ?? [];
        };
        for (const stage of [fromZip, fromGoogle, fromCensus, fromNominatim]) {
            const kept = A.collapse(await stage(), home);
            if (kept.length)
                return kept;
        }
        return [];
    };
    app.searchPlaces = async (q) => {
        const rows = await searchCandidates(q);
        return { rows, unreachable: !rows.length && osmUnreachable };
    };
    const applyCandidate = (c) => applyAddr(c.lat, c.lon, c.note ? fillCopy("apPinnedLabelNote", { label: c.label, note: `${c.note.charAt(0).toUpperCase()}${c.note.slice(1)}` })
        : fillCopy("apPinnedLabel", { label: c.label }), c.cc, c.label);
    {
        const ul = document.getElementById("uselocation");
        if (ul && typeof navigator !== "undefined" && navigator.geolocation) {
            ul.hidden = false;
            ul.addEventListener("click", () => {
                $$1("ziphint").textContent = copy.apFindingYou;
                ul.disabled = true;
                const my = applyToken;
                navigator.geolocation.getCurrentPosition((pos) => {
                    ul.disabled = false;
                    if (my !== applyToken)
                        return;
                    ($$1("addr")).value = "";
                    applyAddr(pos.coords.latitude, pos.coords.longitude, copy.apPinnedHere);
                }, (err) => {
                    ul.disabled = false;
                    if (my !== applyToken)
                        return;
                    $$1("ziphint").textContent = err.code === err.PERMISSION_DENIED
                        ? copy.apLocationOff
                        : copy.apLocationFailed;
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
            });
        }
    }
    {
        const uz = document.getElementById("usezip");
        let prior = {};
        const offer = () => {
            if (!uz)
                return;
            try {
                prior = JSON.parse(localStorage.getItem("gg-answers") ?? "{}");
            }
            catch {
                prior = {};
            }
            const said = !Number.isFinite(prior.lat) || !Number.isFinite(prior.lon) ? ""
                : prior.zip ? fillCopy("apUseZip", { zip: prior.zip }) : prior.place ? fillCopy("apUsePlace", { place: prior.place }) : "";
            if (!said) {
                delete uz.dataset.offer;
                uz.hidden = true;
                return;
            }
            uz.textContent = said;
            uz.dataset.offer = "1";
            uz.hidden = !!($$1("lat")).value;
        };
        uz?.addEventListener("click", () => {
            uz.hidden = true;
            if (prior.zip) {
                applyAddr(prior.lat, prior.lon, fillCopy("apPinnedZip", { zip: prior.zip }), "US");
            }
            else if (prior.place) {
                applyAddr(prior.lat, prior.lon, fillCopy("apPinnedLabel", { label: prior.place }), prior.country, prior.place);
            }
        });
        offer();
        window.addEventListener("hashchange", () => { if (/^#\/plan\b/.test(location.hash))
            offer(); });
    }
    const applyPlacePick = async (pick) => {
        $$1("ziphint").textContent = fillCopy("apPinning", { place: pick.primary });
        try {
            const place = pick.pred.toPlace();
            await place.fetchFields({ fields: ["location", "formattedAddress", "addressComponents"] });
            const loc = place.location;
            if (!loc)
                throw new Error("no location on the picked place");
            applyAddr(loc.lat(), loc.lng(), fillCopy("apPinnedLabel", { label: place.formattedAddress || pick.label }), place.addressComponents?.find((c) => c.types.includes("country"))?.shortText ?? undefined, place.formattedAddress || pick.label);
            newPlacesSession();
        }
        catch {
            $$1("ziphint").textContent = copy.apLookingUp;
            void searchCandidates(pick.label).then((cs) => {
                if (cs[0])
                    applyCandidate(cs[0]);
                else
                    $$1("ziphint").textContent = copy.apCouldNotPin;
            });
        }
    };
    let addrTimer = 0;
    let addrToken = 0;
    const placeAddrList = () => {
        const list = $$1("addrlist");
        const addrEl = $$1("addr");
        if (!list.childElementCount)
            return;
        const f = addrEl.getBoundingClientRect();
        const vv = window.visualViewport;
        let viewTop = vv ? vv.offsetTop : 0;
        let viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        for (const el of document.querySelectorAll("header.site, header.site nav")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden")
                continue;
            if (cs.position !== "fixed" && cs.position !== "sticky")
                continue;
            const r = el.getBoundingClientRect();
            if (r.height <= 0)
                continue;
            const mid = (viewTop + viewBottom) / 2;
            if (r.top > mid)
                viewBottom = Math.min(viewBottom, r.top);
            else if (r.bottom < mid)
                viewTop = Math.max(viewTop, r.bottom);
        }
        if (f.bottom < viewTop || f.top > viewBottom) {
            list.replaceChildren();
            return;
        }
        const gap = 4, margin = 8;
        const below = viewBottom - (f.bottom + gap) - margin;
        const above = (f.top - gap) - viewTop - margin;
        list.style.left = `${Math.round(f.left)}px`;
        list.style.width = `${Math.round(f.width)}px`;
        if (below >= above) {
            list.style.top = `${Math.round(f.bottom + gap)}px`;
            list.style.bottom = "auto";
            list.style.maxHeight = `${Math.max(64, Math.floor(below))}px`;
        }
        else {
            list.style.top = "auto";
            list.style.bottom = `${Math.round(window.innerHeight - (f.top - gap))}px`;
            list.style.maxHeight = `${Math.max(64, Math.floor(above))}px`;
        }
    };
    const repositionAddrIfOpen = () => { if (($$1("addrlist")).childElementCount)
        placeAddrList(); };
    const ensureAddrVisible = () => {
        const sb = document.getElementById("sheetbody");
        const addrEl = $$1("addr");
        if (!sb)
            return;
        seat(sb, addrEl, { block: "nearest", offset: 8, hold: 600, reason: "addr-visible" });
    };
    document.getElementById("sheetbody")?.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.visualViewport?.addEventListener("resize", repositionAddrIfOpen);
    window.visualViewport?.addEventListener("scroll", repositionAddrIfOpen);
    const renderRows = (cands, onPick) => {
        const list = $$1("addrlist");
        list.replaceChildren();
        for (const c of cands) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "addrrow";
            const main = document.createElement("span");
            main.className = "addr-primary";
            main.textContent = c.primary || c.label;
            b.appendChild(main);
            const secText = [c.secondary, c.note].filter(Boolean).join(" · ");
            if (secText) {
                const sec = document.createElement("span");
                sec.className = "addr-secondary";
                sec.textContent = secText;
                b.appendChild(sec);
            }
            b.addEventListener("click", () => onPick(c));
            list.appendChild(b);
        }
        placeAddrList();
    };
    const runAddrSearch = (auto = false) => {
        const q = ($$1("addr")).value.trim();
        const hint = $$1("ziphint");
        const list = $$1("addrlist");
        if (q.length < 5 && !/^\d{4}$/.test(q)) {
            list.replaceChildren();
            if (q) {
                ++addrToken;
                hint.textContent = copy.apNoMatchesYet;
            }
            return;
        }
        const token = ++addrToken;
        hint.textContent = copy.apLookingUp;
        void searchCandidates(q).then(async (cands) => {
            if (token !== addrToken)
                return;
            list.replaceChildren();
            if (!cands.length) {
                const why = [googleFailWhy, censusFailWhy].filter(Boolean).join("; ");
                if (why) {
                    console.warn("[geocode]", why);
                    hint.dataset.why = why;
                }
                else
                    delete hint.dataset.why;
                const unreachable = (typeof navigator !== "undefined" && navigator.onLine === false)
                    || (osmUnreachable && !/no match/.test(censusFailWhy) && googleFailWhy !== "Google: no result");
                hint.textContent = unreachable ? copy.apLookupDown : copy.apNoMatch;
                return;
            }
            if (auto && (await addrRank()).oneCountry(cands) && (cands.length === 1 || !cands[0].note)) {
                applyCandidate(cands[0]);
                return;
            }
            hint.textContent = cands.length === 1 ? copy.apOneMatch : copy.apTapYourAddress;
            renderRows(cands, applyCandidate);
        });
    };
    const runAddr = async (auto = false) => {
        const q = ($$1("addr")).value.trim();
        const list = $$1("addrlist");
        const hint = $$1("ziphint");
        if (!mapsApiKey() || (await addrRank()).zipFirst(q, appLang() === "es")) {
            runAddrSearch(auto);
            return;
        }
        if (q.length < 3) {
            list.replaceChildren();
            return;
        }
        const token = ++addrToken;
        hint.textContent = copy.apFindingAddresses;
        void placesSuggest(q).then((picks) => {
            if (token !== addrToken)
                return;
            if (picks === null) {
                runAddrSearch(auto);
                if (placesWhy) {
                    console.warn("[places]", placesWhy);
                    hint.dataset.why = placesWhy;
                }
                return;
            }
            if (auto && picks.length) {
                void applyPlacePick(picks[0]);
                return;
            }
            if (!picks.length) {
                list.replaceChildren();
                hint.textContent = copy.apNoMatchesYet;
                return;
            }
            hint.textContent = copy.apTapYourAddress;
            renderRows(picks, (p) => void applyPlacePick(p));
        });
    };
    ($$1("addr")).addEventListener("input", () => {
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), mapsApiKey() ? 300 : 450);
    });
    $$1("addrform").addEventListener("submit", (e) => {
        e.preventDefault();
        if (addrTimer)
            clearTimeout(addrTimer);
        runAddr(true);
    });
    ($$1("addr")).addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (addrTimer)
                clearTimeout(addrTimer);
            runAddr(true);
        }
    });
    let composeTimer = 0;
    const composeAddr = () => {
        const addrEl = $$1("addr");
        const street = addrEl.value.split(",")[0].trim();
        const city = ($$1("addrcity")).value.trim();
        const state = ($$1("addrstate")).value.trim();
        const zip = ($$1("addrzip")).value.trim();
        if (!street || !city)
            return;
        const full = `${street}, ${city}${state ? `, ${state}` : ""}${zip ? ` ${zip}` : ""}`;
        if (addrEl.value === full)
            return;
        addrEl.value = full;
        ensureAddrVisible();
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), 400);
    };
    for (const id of ["addrcity", "addrstate", "addrzip"]) {
        for (const evt of ["input", "change"]) {
            $$1(id).addEventListener(evt, () => {
                if (composeTimer)
                    clearTimeout(composeTimer);
                composeTimer = window.setTimeout(composeAddr, 50);
            });
        }
    }
    for (const id of ["lat", "lon", "shapew", "shapel"]) {
        $$1(id).addEventListener("input", draw);
    }
    for (const id of ["lat", "lon"]) {
        $$1(id).addEventListener("input", draw);
    }
    fams.addEventListener("change", () => {
        void (async () => {
            const bed = app.logSnapshot.beds.find((b) => b.name === ($$1("candbed")).value);
            const db = app.logDb;
            if (bed && db) {
                const checked = [...document.querySelectorAll("#families input.fam:checked")].map((cb) => cb.value);
                await setPriorOccupancy(db, app.currentPlotId, bed.region, declaredPriorYear(), checked);
                await app.logRefresh?.();
            }
            draw();
        })();
    });
    $$1("candbed").addEventListener("change", draw);
    $$1("handoffgo").addEventListener("click", () => { location.hash = "#/log"; });
    onAuthChange(() => draw());
    whenShownChunk("plant", "plant", "plant:init", (m) => m.initPlantRoute(bundle));
    const applyGuildFromHash = () => {
        if (currentRoute() !== "plan") {
            chunkReady("plan")?.setGuildFocus(null);
            return;
        }
        const want = guildFromHash(location.hash);
        whenShownChunk("plan", "plan", "plan:guildfocus", (m) => {
            if (!want) {
                m.setGuildFocus(null);
                return;
            }
            m.setGuildFocus(want, bundle.guilds.some((g) => g.id === want));
            draw();
        });
    };
    window.addEventListener("hashchange", applyGuildFromHash);
    whenShownChunk(["account", "content"], "edit", "edit:init", (m) => m.initEditor(bundle));
    whenShownChunk("why", "why", "why:init", (m) => m.initWhyRoute(bundle));
    let calendarWired = false;
    const wireCalendar = (m) => {
        if (calendarWired)
            return;
        calendarWired = true;
        m.initCalendar(activeBundle(bundle));
    };
    app.openWeek = async (plotId, bed, day) => {
        const m = await loadChunk("calendar");
        wireCalendar(m);
        await app.openWeek?.(plotId, bed, day);
    };
    const keepRemindersInStep = (b) => {
        const cal = calendarWired ? chunkReady("calendar") : null;
        if (cal) {
            if (currentRoute() !== "calendar")
                cal.refreshReminderPlan(b);
        }
        else if (remindersOn())
            void loadChunk("calendar").then((m) => m.refreshReminderPlan(b), () => { });
        const bell = chunkReady("bell");
        if (bell)
            bell.refreshBell(b);
        else if (hasGround() || app.currentPlot?.anchor)
            whenIdle(() => { void loadChunk("bell").then((m) => m.refreshBell(b), () => { }); });
    };
    app.noticesChanged = () => {
        const b = activeBundle(bundle);
        if (calendarWired && currentRoute() === "calendar")
            chunkReady("calendar")?.refreshReminderPlan(b);
        keepRemindersInStep(b);
    };
    app.bedCalendarJobs = (bedName, year) => {
        const b = activeBundle(bundle);
        const today = localTodayIso();
        return gardenWideTasks(b, year)
            .filter((t) => t.bed === bedName && ((t.date ?? "") >= today || (t.kind === "warm_window" && !!t.closeBy && t.closeBy >= today)))
            .sort((a, c) => (a.date ?? "").localeCompare(c.date ?? ""))
            .slice(0, 8)
            .map((t) => ({ date: t.date, text: taskSentence(t, b) }));
    };
    const applyUnitLabels = () => {
        for (const s of document.querySelectorAll(".ulen"))
            s.textContent = lengthUnit();
    };
    const convertLenInputs = (metres) => {
        LEN_INPUT_IDS.forEach((id, i) => {
            const m = metres[i];
            if (m != null)
                $$1(id).value = String(mToInput(m));
        });
    };
    const syncPrefControls = () => {
        ($$1("prefunits")).value = unitSystem();
        ($$1("preftemp")).value = tempSystem();
        ($$1("preftheme")).value = themeChoice();
        ($$1("prefseason")).value = seasonChoice();
        ($$1("prefsilo")).value = siloChoice();
        ($$1("prefpace")).value = paceChoice() ?? "full";
        ($$1("prefspace")).value = spaceChoice() ?? "";
        ($$1("prefafter")).value = afterChoice() ?? "";
        ($$1("preflang")).value = storedLang() ?? appLang();
        const hh = householdChoice();
        ($$1("prefadults")).value = hh && hh !== "none" ? String(hh.adults) : "0";
        ($$1("prefchildren")).value = hh && hh !== "none" ? String(hh.children) : "0";
    };
    app.syncPrefControls = syncPrefControls;
    if (unitSystem() === "imperial") {
        const metres = LEN_INPUT_IDS.map((id) => num(id));
        convertLenInputs(metres);
    }
    $$1("prefunits").addEventListener("change", () => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id));
        setUnitSystem(($$1("prefunits")).value === "imperial" ? "imperial" : "metric");
        convertLenInputs(metres);
        applyUnitLabels();
        draw();
        void app.logRefresh?.();
        void app.pushPrefs?.();
    });
    $$1("preftemp").addEventListener("change", () => {
        setTempSystem(($$1("preftemp")).value === "f" ? "f" : "c");
        draw();
        void app.logRefresh?.();
        void app.pushPrefs?.();
    });
    $$1("preftheme").addEventListener("change", () => {
        const v = ($$1("preftheme")).value;
        setThemeChoice(v === "dark" || v === "light" ? v : "system");
        void app.pushPrefs?.();
    });
    $$1("prefseason").addEventListener("change", () => {
        const v = ($$1("prefseason")).value;
        const ok = ["follow", "spring", "summer", "autumn", "winter"].includes(v);
        setSeasonChoice((ok ? v : "follow"));
        applySeasonalCopy();
        void app.pushPrefs?.();
    });
    $$1("prefsilo").addEventListener("change", () => {
        setSiloChoice(($$1("prefsilo")).value === "off" ? "off" : "on");
    });
    const onHouseChange = () => {
        const n = (id) => Math.max(0, Math.min(30, Math.round(Number(($$1(id)).value) || 0)));
        const adults = n("prefadults"), children = n("prefchildren");
        setHousehold(adults + children >= 1 ? { adults, children } : "none");
        void app.pushPrefs?.();
        app.homeRefresh?.();
    };
    $$1("prefadults").addEventListener("change", onHouseChange);
    $$1("prefspace").addEventListener("change", () => {
        const v = ($$1("prefspace")).value;
        if (v === "ground" || v === "raised" || v === "pots" || v === "changing")
            setSpaceChoice(v);
        void app.pushPrefs?.();
        app.homeRefresh?.();
    });
    $$1("prefafter").addEventListener("change", () => {
        const v = ($$1("prefafter")).value;
        if (v === "food" || v === "pollinators" || v === "kids" || v === "little") {
            setAfterChoice(v);
            if (v === "little") {
                setPaceChoice("light");
                app.syncPrefControls?.();
            }
        }
        void app.pushPrefs?.();
        app.homeRefresh?.();
    });
    $$1("prefchildren").addEventListener("change", onHouseChange);
    const chooseLang = (l) => {
        const reload = setLangChoice(l);
        void app.pushPrefs?.();
        if (reload)
            location.reload();
        else {
            mountLangBar(chooseLang);
            syncPrefControls();
        }
    };
    $$1("preflang").addEventListener("change", () => chooseLang(($$1("preflang")).value === "es" ? "es" : "en"));
    mountLangBar(chooseLang);
    initOfflineNote(() => copy.offlineNote);
    document.getElementById("skiplink")?.addEventListener("click", () => {
        const page = document.querySelector("main > section.page:not([hidden]) h1") ?? document.querySelector("main");
        if (page && page.tagName === "H1" && !page.hasAttribute("tabindex"))
            page.setAttribute("tabindex", "-1");
        page?.focus();
    });
    mountMtNotice("page-account");
    mountMtNotice("page-why");
    $$1("prefpace").addEventListener("change", () => {
        setPaceChoice(($$1("prefpace")).value === "light" ? "light" : "full");
        void app.pushPrefs?.();
        app.homeRefresh?.();
    });
    applyTheme();
    applySeason();
    applySilo();
    whenIdle(() => { void loadChunk("decor").then((m) => m.mountSilhouettes(), () => { }); });
    applyUnitLabels();
    syncPrefControls();
    app.applyPrefs = (rec, atMs) => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id));
        const changed = applyPrefRecord(rec, atMs);
        if (langPending()) {
            location.reload();
            return changed;
        }
        convertLenInputs(metres);
        applyUnitLabels();
        syncPrefControls();
        if (changed) {
            draw();
            void app.logRefresh?.();
        }
        return changed;
    };
    draw();
    setupLog(bundle, draw).then(() => {
        app.logHydrated = true;
        draw();
        whenLoaded("plan", "plan:arrival", (m) => m.endArrival());
        applyGuildFromHash();
        settleHome();
        homeNow();
    }).catch((e) => {
        $$1("logmsg").textContent = fillCopy("apLogFailed", { error: String(e) });
    });
    document.getElementById("teamsnudge")?.addEventListener("click", (e) => {
        if (e.currentTarget.dataset.hasDraft === "1")
            location.hash = "#/calendar";
        else if (e.currentTarget.dataset.noFit === "1")
            window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "step-mybed" } }));
        else
            window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "step-plan" } }));
    });
    document.getElementById("calplannudge")?.addEventListener("click", (e) => void (async () => {
        const id = e.currentTarget.dataset.plot;
        if (id && id !== app.currentPlotId)
            await app.switchPlot?.(id);
        location.hash = "#/plan";
    })());
    document.getElementById("calsetloc")?.addEventListener("click", () => go("plan", "step-where"));
    const BED_PRESETS = (metric) => {
        const [a, b, c, d, e] = metric ? [1.2, 2.4, 0.9, 3, 0.6] : [1.2192, 2.4384, 0.9144, 3.048, 0.6096];
        return [{ w: a, l: b, structure: "raised", what: copy.apPresetRaised }, { w: a, l: a, structure: "in_ground", what: copy.apPresetSquare },
            { w: c, l: d, structure: "in_ground", what: copy.apPresetRow }, { w: e, l: e, structure: "container", what: copy.apPresetContainer }];
    };
    const renderBedPresets = () => {
        const host = document.getElementById("bedpresets");
        if (!host)
            return;
        host.replaceChildren();
        for (const pr of BED_PRESETS(unitSystem() === "metric")) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "bedpreset";
            b.dataset.structure = pr.structure;
            b.textContent = fillCopy("apPresetLabel", { w: fmtDec(Number(mToInput(pr.w)), 2), l: fmtDec(Number(mToInput(pr.l)), 2), unit: lengthUnit(), what: pr.what });
            b.title = copy.apPresetTitle;
            b.addEventListener("click", () => {
                ($$1("dimw")).value = String(mToInput(pr.w));
                ($$1("diml")).value = String(mToInput(pr.l));
                ($$1("dimstructure")).value = pr.structure;
                ($$1("dimmake")).click();
            });
            host.appendChild(b);
        }
    };
    renderBedPresets();
    whenLoaded("plan", "plan:bedadd", (m) => {
        m.initMyBedTrack();
        m.initBedAdd({
            startTrace: () => { document.getElementById("moderect")?.click(); },
        });
    });
    $$1("prefunits").addEventListener("change", renderBedPresets);
    document.getElementById("dimmake")?.addEventListener("click", () => {
        void (async () => {
            const msg = $$1("dimbedmsg");
            try {
                const w = lenM("dimw"), l = lenM("diml");
                if (w == null || l == null || w <= 0 || l <= 0) {
                    msg.textContent = copy.apDimBothNumbers;
                    return;
                }
                if (!app.logDb)
                    throw new Error(copy.apErrStorageOpening);
                const beds = app.logSnapshot.beds;
                const name = nextBedName(beds, (n) => fillCopy("bedDefaultName", { n }));
                const o = nextOrigin(beds);
                const r2 = (v) => Math.round(v * 100) / 100;
                const structure = ($$1("dimstructure")).value;
                const sunSel = $$1("dimsun")?.value ?? "";
                const sun = sunSel === "full" || sunSel === "part_shade" ? sunSel : null;
                const rainSel = $$1("dimrain")?.value ?? "";
                const rain = rainSel === "covered" || rainSel === "indoors" ? rainSel : null;
                countRung("bed-saved");
                const depthEl = document.getElementById("ba-depth");
                const depthIn = depthEl ? Number(depthEl.value) : NaN;
                const depthCm = Number.isFinite(depthIn) && depthIn > 0 ? depthIn * 2.54 : null;
                await placeBed(app.logDb, app.currentPlotId, name, { shape: "rect", x: o.x, y: o.y, w: r2(w), h: r2(l) }, undefined, sun, structure, true, undefined, depthCm, rain);
                msg.textContent = fillCopy("apMadeBed", { name });
                ($$1("dimw")).value = "";
                ($$1("diml")).value = "";
                await app.logRefresh?.();
                const sel = document.getElementById("candbed");
                if (sel) {
                    sel.value = name;
                    sel.dispatchEvent(new Event("change"));
                }
                window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
            }
            catch (e) {
                msg.textContent = `${e instanceof Error ? e.message : e}`;
            }
        })();
    });
    let baseLoad = "idle";
    let manifest = null;
    let zip3Cells = {};
    const cellState = new Map();
    const wanted = [];
    const bump = () => { const b = bundle; b._zipEpoch = (b._zipEpoch ?? 0) + 1; };
    const mergeCell = (body) => {
        if (body.zips) {
            bundle.zip_index = bundle.zip_index ?? { zips: {} };
            Object.assign((bundle.zip_index.zips ??= {}), body.zips);
        }
        if (body.zones) {
            bundle.zip_zones = bundle.zip_zones ?? { zones: {} };
            Object.assign((bundle.zip_zones.zones ??= {}), body.zones);
        }
        const st = body.stations;
        if (Array.isArray(st) && st.length && bundle.climate?.sites) {
            bundle.climate.sites = [...bundle.climate.sites, ...st];
        }
        bump();
    };
    const fetchCell = (ci, cj) => {
        const k = `${ci},${cj}`;
        if (cellState.has(k))
            return;
        cellState.set(k, "loading");
        void fetch(`../build/zip-grid/c${ci}_${cj}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .then((cell) => {
            if (cell) {
                mergeCell(cell);
                cellState.set(k, "done");
                draw();
                answersRefresh?.();
                app.climateDataArrived?.();
            }
            else
                cellState.delete(k);
        })
            .catch(() => cellState.delete(k));
    };
    const serve = (req) => {
        if (Number.isFinite(req.lat) && Number.isFinite(req.lon)) {
            if (!manifest)
                return;
            const [ci, cj] = gridCell(req.lat, req.lon);
            for (let di = -1; di <= 1; di++)
                for (let dj = -1; dj <= 1; dj++) {
                    if (manifest.has(`${ci + di},${cj + dj}`))
                        fetchCell(ci + di, cj + dj);
                }
            return;
        }
        const z3 = req.zip?.replace(/\D/g, "").slice(0, 3);
        if (z3 && z3.length === 3)
            for (const [ci, cj] of zip3Cells[z3] ?? [])
                fetchCell(ci, cj);
    };
    const ensureZipData = (lat, lon, zip) => {
        const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
        const hasZip = !!zip && /\d{3}/.test(zip);
        if (!hasLoc && !hasZip)
            return;
        const req = { lat, lon, zip };
        if (baseLoad === "done") {
            serve(req);
            return;
        }
        wanted.push(req);
        if (baseLoad === "loading")
            return;
        baseLoad = "loading";
        void fetch(GRID_BASE_URL)
            .then((r) => (r.ok ? r.json() : null))
            .then((base) => {
            if (!base) {
                baseLoad = "idle";
                return;
            }
            manifest = new Set((base.manifest ?? []).map(([i, j]) => `${i},${j}`));
            zip3Cells = base.zip3_cells ?? {};
            if (base.zip_index_meta)
                bundle.zip_index = { ...base.zip_index_meta, zips: bundle.zip_index?.zips ?? {} };
            if (base.zip_zones_meta)
                bundle.zip_zones = { ...base.zip_zones_meta, zones: bundle.zip_zones?.zones ?? {} };
            const b = bundle;
            if (base.global_zones)
                b.global_zones = base.global_zones;
            if (base.global_frost)
                b.global_frost = base.global_frost;
            baseLoad = "done";
            bump();
            while (wanted.length)
                serve(wanted.shift());
            draw();
            answersRefresh?.();
            app.climateDataArrived?.();
        })
            .catch(() => { baseLoad = "idle"; });
    };
    app.ensureZipData = ensureZipData;
    app.climateSettled = (lat, lon) => {
        if (baseLoad !== "done" || !manifest)
            return false;
        const [ci, cj] = gridCell(lat, lon);
        for (let di = -1; di <= 1; di++)
            for (let dj = -1; dj <= 1; dj++) {
                const k = `${ci + di},${cj + dj}`;
                if (manifest.has(k) && cellState.get(k) !== "done")
                    return false;
            }
        return true;
    };
    const bootHash = location.hash;
    let answersWired = false;
    const wireAnswers = (m) => {
        if (answersWired)
            return;
        answersWired = true;
        const arrivedByTap = currentRoute() === "answers" && location.hash !== bootHash;
        answersRefresh = m.initAnswers(bundle, {
            plantWithLocation: (lat, lon, zip, to = "#/plan") => void (async () => {
                countRung("to-planner");
                markStarted();
                if (isExamplePlot(app.currentPlotId)) {
                    const exLat = num("lat"), exLon = num("lon");
                    for (let i = 0; i < 120 && !app.removeExample; i++)
                        await new Promise((r) => setTimeout(r, 100));
                    await app.removeExample?.(false);
                    if (!zip && lat === exLat && lon === exLon)
                        lat = lon = null;
                }
                if (lat != null && lon != null) {
                    setLocation(lat, lon, zip ? fillCopy("apLocatedFromZip", { zip }) : undefined);
                    chunkReady("plan")?.followWhereMap(lat, lon);
                }
                location.hash = to;
            })(),
        }, arrivedByTap);
    };
    whenShownChunk("answers", "answers", "answers:init", wireAnswers);
    if (answersCropSaved())
        void loadChunk("answers").then((m) => { wireAnswers(m); draw(); }, () => { });
    if (Number.isFinite(num("lat")) && Number.isFinite(num("lon")))
        ensureZipData(num("lat"), num("lon"));
}
const applyAuthGate = initAuthGate();
app.refreshAuthGate = applyAuthGate;
let answersRefresh = null;
app.markStarted = markStarted;
app.clearStarted = clearStarted;
async function startCore(bundleP) {
    if (perfAsked())
        void loadChunk("perf").then((m) => m.initPerfHud(), () => { });
    const markupOpen = new Set([...document.querySelectorAll("#sheetbody details.step[open]")].map((d) => d.id));
    whenLoaded("plan", "plan:sheet", (m) => {
        const opened = [...document.querySelectorAll("#sheetbody details.step[open]")].filter((d) => !markupOpen.has(d.id));
        m.initPlanSheet();
        opened.at(-1)?.dispatchEvent(new Event("toggle"));
        window.dispatchEvent(new Event("gg-step-changed"));
    });
    onAuthChange(applyAuthGate);
    applyAuthGate();
    void loadMapsConfig().then(() => {
        app.homeRefresh?.();
        window.dispatchEvent(new Event("gg-step-changed"));
    });
    main2(await bundleP);
    if (isStarted())
        whenIdle(() => { void loadChunk("plan").catch(() => { }); }, 1500);
}
function answersCropSaved() {
    try {
        return !!JSON.parse(localStorage.getItem("gg-answers") ?? "{}").crop;
    }
    catch {
        return false;
    }
}
function perfAsked() {
    try {
        return new URLSearchParams(location.search).has("perf") || localStorage.getItem("gg-perf") != null;
    }
    catch {
        return false;
    }
}
function planArrivalSettled() { return chunkReady("plan")?.arrivalSettled() ?? false; }
async function startPlanning() {
    if (isExamplePlot(app.currentPlotId) && app.removeExample)
        await app.removeExample();
    else
        location.hash = "#/plan";
}
async function seeExample(from = location.hash) {
    void loadChunk("home").catch(() => { });
    for (let i = 0; i < 120 && !app.showExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.showExample?.(from);
}
async function closeExample() {
    for (let i = 0; i < 120 && !app.removeExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.removeExample?.(true);
}
async function startOwnGarden() {
    markStarted();
    for (let i = 0; i < 120 && !app.removeExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.removeExample?.(false);
}

var core = /*#__PURE__*/Object.freeze({
    __proto__: null,
    closeExample: closeExample,
    planArrivalSettled: planArrivalSettled,
    seeExample: seeExample,
    startCore: startCore,
    startOwnGarden: startOwnGarden,
    startPlanning: startPlanning
});

export { $$1 as $, AMENDMENTS, BLOOM_ORDER, CARD_SIZES, CHECK_SVG, DIARY_KINDS, DRAINAGES, END_CAUSES, EXAMPLE_PLOT_ID, FAILURE_SEVERITIES, FEEDER_CLASSES, FROST_TOLERANCES, GLOSSARY, GROUND_COVERAGES, LIFESPANS, LIGHT_LEVELS, MEDIUMS, MIN_SEASONS, MONTHS, NUTRIENTS, NUTRIENT_LEVELS, OBSERVATION_SEVERITIES, PATH_M, PH_MAX, PH_METHODS, PH_MIN, POLLINATOR_VALUES, REM_FLAG, REPORT_FIELDS, RUNGS, SECTION_ORDER, SOW_SEASONS, START_SHELF, SUPPORT_PROVIDES, SUPPORT_REQUIRES, SVG_NS$1 as SVG_NS, TEXTURES, TODAY_ISO, WHOLE_GARDEN, accessBandPolygons, accessBands, actSentence, activeBundle, addDaysISO, addFailure, addPlanting, addPlantingNote, adjacent, afterChoice, allGardenSeasons, app, appliedPlanDots, approxDays, area, asksFor, bandRank, bedDepthWord, bedFrame, bedHasSections, bedLocator, bedOrientation, bedSeasonStatus, bedShapeLabel, bedStructure, bloomSpan, boltMonthsFor, boltWarnings, breakFamilies, browsableGuilds, calFactsBundle, canSetAside, candidates, capabilities, cardSrcset, carriedOccupancy, category, categoryLabel, celebrate, centrePair, chipRows, claimLabels, climateCaveat, closeExample, clubrootCautions, comingSeasonAfter, comingSeasonTasks, comingTasksForYear, commonName, confidenceBadge, confidenceWord, core, corpusEs, corpusText, corpusWantsEs, cropFreeze, cropSearch, currentAskCard, currentBedRegion, currentBedSun, currentGardenCtx, currentPlantingYear, datedByDays, datesCitation, datesStationOf, dayOfYear, dayWord, daylengthHours, daysBetween$1 as daysBetween, defaultPlotId, defaultToggle, defaultWorkspacePlotId, deletePlot, deleteSeason, deleteSeed, deleteSoilObservation, deriveHistory, derivedGuilds, disclose, displayName, dossierState, draftPlantings, drainageCautions, dropStaleGardens, el$1 as el, eligibleSpecies, emptyState, endCauseLabel, endCausePhrase, endPlanting, englishName, eraseGarden, failureSeverityLabel, failureSeverityWord, fallDate, familyRotationRule, familyWithinInterval, feedTime, fewestDays, fileObservation, filledMembers, firstBedSize, fitDiagram, floorLine, floorLines, floorPlan, floorSay, fmtArea, fmtAreaApart, fmtCm, fmtCmValue, fmtDec, fmtKm, fmtLen, fmtMonthDay, fmtMonthDayYear, fmtRain, fmtTemp, followAsk, forageCandidates, forageInFlower, framesEqual, freePlotId, freezeWord, frostAsked, frostBand, frostCalibration, frostDatesModelled, frostGate, frostGiven, frostNotedLine, frostPossible, frostRare, frostSeverityLabel, frostSeverityWord, frostSide, frostSomeWinters, frostStationOf, frostWord, gardenBounds, gardenClosed, gardenColours, gardenFrame, gardenFrost, gardenLat, gardenNameOf, gardenPlants, gardenSeasonAfter, gardenShownName, gardenTasks, gardenTasksShared, gardenWideTasks, gardensNow, gateTenths, geometryRules, getPhoto, getPlot, getSeason, givenFirstFrost, givenFrostGate, glossTerm, gradeClassOfWord, groupAgenda, growsHereAt, guideBySlug, guideCountForSpecies, guideShelf, guidesForSpecies, guildPlantings, guildSection, guildStatus, hasGround, heatNotedLine, heatWarnings, heightOrderingViolations, heldByLine, heldRotationFamilies, hiddenRows, householdChoice, humanizeMMDD, inGround, ineligibility, installPlanSeams, instantiate, intersectArea, isDone, isExamplePlot, isForage, isFutureDate, isMarker, isOwed, isSignedIn, isSimplePolygon, isSouthern, isTeamPlantJob, isWindowEnd, iso, jobKey, jobTitle, jobWhat, kickGardensLoad, ladder, lateFallFrostOf, lateSentence, layoutKeys, layoutRows, laysOutAsHills, lenM, lenToM, lengthUnit, limeCautions, lineTemp, linkNameIn, linkNamesIn, listPlots, listPosts, listSeasons, listSeeds, listSoilObservations, livingSupportLead, loadMapsJs, loadSync, localTodayIso, localiseProse, mToInput, mapsApiKey, mark, markBedPlanted, markBedPlantedAdvancingSeason, markControl, markLink, matchSite, matches, mechanismRows, memberSpecies, mergePriorOccupancy, mergeSurvivingDetail, metricForVisit, minReachSpanM, mintSeedId, mmddDoy, modelSite, monthDay$1 as monthDay, monthDryOnly, monthLong, monthRain, monthRuns, monthShort, moveGarden, nearerFoldRow, needsInsects, nextBedName, nextOpening, nextOrigin, noonShadowLengthM, northernMonth, notifyCadence, notifyWeekday, num, offSeasonNudge, onGardensLoaded, onWarmthPath, oneWarmWindow, openGardens, openLog, openSeason, orderGardens, orientedToPlot, outsideUsTables, owedFor, ownFrostAt, paceChoice, paintDefaultToggle, parseRegion, phCautions, phComparable, pickGarden, place, placeBed, placeCountry, placeGuildPlants, placementSvg, planArrivalSettled, planBedRegion, plantEntryLine, plantHref, plantLink, plantableArea, plantableStripPolygons, plantedLine, plantingLabel, plantingOnBed, plantingWindow, plantingWindowFor, plateColours, plateKey, plateKeyInto, plateModel, plotIdFor, plural, polygonArea, postBody, prettyIso, priorSeasonCredit, priorSeasons, putPhoto, putPlot, putSeason, putSeed, putSoilObservation, radialRingsFromFootprint, rainsBeginFor, reasonText, recollectionLine, referenceDoy, refutationVerdict, regionCentroid, regionLabel, regionPoints, remapRegionBetweenBeds, rememberLookupHemisphere, remindChoice, remindersOn, removeBed, removePlanting, renameBed, renderClimate, renderGlossary, renderPlate, resolveDtm, resolveFrostTolerance, resolveGround, resolveRole, resolveSpecies, resolveZone, resolvedField, roleDensity, roleLineCount, roleOverridesOf, rotationRules, ruleClaim, ruleStanding, runOccurrences, scaledFillCounts, scheduleClimate, scheduleSite, seasonAfter, seasonAllYearLine, seasonById, seasonChoice, seasonDate, seasonId, seasonLine, seasonName, seasonYearOf, sectionParentOf, seeExample, setAfterChoice, setBedPlanted, setDefaultPlot, setGardenClosed, setGardenFrost, setHousehold, setJobAside, setNotifyCadence, setNotifyWeekday, setOutRipen, setPaceChoice, setPlotAnchorOnce, setPlotName, setRemindChoice, setSeasonId, setSpaceChoice, shelfAnchor, shelfGuides, shelterPredicate, shelteredByShadow, shelteredChosen, shiftFrostDate, shortlistRank, showSheet, signedInEmail, smallSeededDirectSown, snapCountsToLayout, sortObservations, sowByOf, spaceChoice, spacingRows, speciesThumb, splitAroundLabel, squareText, startCore, startOwnGarden, startPlanning, stationFold, stationFrostLines, stationLabel, stillTime, storageEstimate, structureWord, substitutionVerdict, summerGreensAt, svgNumber, takePlanFresh, taskPool, taskSentence, taskWindow, tasksForYear, teamClaim, teamPlantWindow, tellUsLine, tempSystem, themeChoice, thinBreakSuggestion, toast, tombstoneList, tombstoneMap, tropical, undatedPlan, unfitPlan, unitSystem, unkeyZones, updatePlanting, upsertSeasonSnapshot, validateSeason, warmLateLines, warmMonthList, warmthFloorClose, warmthFloorFor, warmthFloorRule, warmthWindowsFor, waterMonthsFor, waterNow, weekJobs, weekSummary, weekTaskPool, weekdayLong, weekdayShort, whenWords, windowClosed, windowFreeze, withLocalHelp, withObservationIds, yardFigure, yardRepaint, yearViewMonths, zipToLatLon, zoneColorMap, zoneSide };
