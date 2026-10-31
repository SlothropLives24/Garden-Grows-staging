import './chunk-lutet8cz.js';
import { copy, fillCopy, appLang, midSentence } from './paint.js';
import { fmtTemp, fmtRain, weekdayLong, app, el, tempSystem, weekdayShort, waterMonthsFor, gardenFrost, fmtMonthDay, bedLocator, resolveSpecies, resolveFrostTolerance, commonName } from './core.js';
import './chunk-l5cseoso.js';

const LOOK = 7;
const DRY_DAYS_READ = 6;
const WEEK = 7;
const SAID_DAYS = 30;
const LONG_DAY_NORTH = [4, 5, 6, 7, 8, 9];
const LONG_DAY_SOUTH = [10, 11, 12, 1, 2, 3];
const EPS = 1e-6;
const fToC = (f) => ((f - 32) * 5) / 9;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const monthOf = (iso) => Number(iso.slice(5, 7));
const uniq = (xs) => [...new Set(xs)];
const asDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const addDays = (iso, n) => {
    const d = asDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((asDate(b).getTime() - asDate(a).getTime()) / 86_400_000);
function watchRules(rules) {
    const byKind = (k) => rules.find((r) => r.trigger?.kind === k);
    const trig = (r) => (r?.trigger ?? {});
    const fr = byKind("forecast_frost"), tf = trig(fr);
    const lines = tf.low_at_or_below_f;
    let frost = null;
    if (fr && lines && typeof lines === "object" && isNum(tf.freeze_at_or_below_f) && isNum(tf.nights_ahead) && tf.nights_ahead >= 1) {
        const lineC = Object.fromEntries(Object.entries(lines)
            .filter((e) => isNum(e[1])).map(([tier, f]) => [tier, fToC(f)]));
        if (Object.keys(lineC).length)
            frost = { rule: fr.id, lineC, freezeC: fToC(tf.freeze_at_or_below_f), nights: Math.round(tf.nights_ahead) };
    }
    const he = byKind("hot_month_water"), th = trig(he);
    const heat = he && isNum(th.day_above_f) && isNum(th.night_above_f)
        ? { rule: he.id, dayC: fToC(th.day_above_f), nightC: fToC(th.night_above_f) } : null;
    const bo = byKind("bolt_month_harvest"), tb = trig(bo);
    const want = bo?.applies_to?.species;
    const bolt = bo && isNum(tb.forecast_days_in_a_row) && tb.forecast_days_in_a_row >= 1
        ? { rule: bo.id, days: Math.round(tb.forecast_days_in_a_row), species: Array.isArray(want) ? want.map(String) : typeof want === "string" ? [want] : [] }
        : null;
    const ra = byKind("month_rain_short"), tr = trig(ra);
    const rain = ra && isNum(tr.week_need_mm) && isNum(tr.all_yours_below)
        ? { rule: ra.id, weekMm: tr.week_need_mm, dryMm: tr.week_need_mm * tr.all_yours_below } : null;
    return { frost, heat, bolt, rain };
}
function forecastAlerts(i) {
    const ahead = i.days.filter((d) => d.date >= i.today).slice(0, LOOK);
    const outdoor = i.crops.filter((c) => c.rain !== "indoors");
    const out = [];
    const bedsOf = (cs) => uniq(cs.map((c) => c.bed).filter((b) => !!b));
    const f = i.rules.frost;
    if (f && outdoor.length) {
        const nights = new Set(Array.from({ length: f.nights }, (_, k) => addDays(i.today, k + 1)));
        const hit = [], at = [];
        let low = Infinity;
        for (const d of ahead) {
            if (!nights.has(d.date) || d.lo == null)
                continue;
            const lo = d.lo;
            const cold = outdoor.filter((c) => c.tier != null && isNum(f.lineC[c.tier]) && lo <= f.lineC[c.tier] + EPS);
            if (!cold.length)
                continue;
            hit.push(d.date);
            at.push(...cold);
            low = Math.min(low, lo);
        }
        if (hit.length)
            out.push({ watch: "frost", rule: f.rule, dates: hit, value: low, freeze: low <= f.freezeC + EPS,
                crops: uniq(at.map((c) => c.species)), beds: bedsOf(at) });
    }
    const h = i.rules.heat;
    if (h && outdoor.length) {
        const hot = ahead.filter((d) => d.hi != null && d.lo != null && d.hi > h.dayC && d.lo > h.nightC && !i.hotMonths.includes(monthOf(d.date)));
        if (hot.length)
            out.push({ watch: "heat", rule: h.rule, dates: hot.map((d) => d.date),
                value: Math.max(...hot.map((d) => d.hi)), night: Math.max(...hot.map((d) => d.lo)),
                crops: uniq(outdoor.map((c) => c.species)), beds: [] });
    }
    const b = i.rules.bolt;
    if (b) {
        const long = i.lat < 0 ? LONG_DAY_SOUTH : LONG_DAY_NORTH;
        const days = new Set(), at = [];
        let hi = -Infinity;
        for (const c of outdoor) {
            if (!b.species.includes(c.species) || c.boltC == null)
                continue;
            const thr = c.boltC;
            let run = [];
            const flush = () => {
                if (run.length >= b.days) {
                    for (const d of run)
                        days.add(d.date);
                    at.push(c);
                    hi = Math.max(hi, ...run.map((d) => d.hi));
                }
                run = [];
            };
            for (const d of ahead) {
                const warm = d.hi != null && d.hi >= thr - EPS && long.includes(monthOf(d.date));
                const next = run.length ? addDays(run[run.length - 1].date, 1) === d.date : true;
                if (!warm || !next)
                    flush();
                if (warm)
                    run.push(d);
            }
            flush();
        }
        if (at.length)
            out.push({ watch: "bolt", rule: b.rule, dates: [...days].sort(), value: hi, crops: uniq(at.map((c) => c.species)), beds: bedsOf(at) });
    }
    const r = i.rules.rain;
    const open = i.crops.filter((c) => c.rain === "open");
    if (r && open.length) {
        const read = ahead.filter((d) => d.rain != null);
        const total = read.reduce((s, d) => s + d.rain, 0);
        if (read.length && total >= r.weekMm - EPS) {
            out.push({ watch: "rain", rule: r.rule, dates: read.map((d) => d.date), value: total, crops: uniq(open.map((c) => c.species)),
                beds: bedsOf(open), dryBeds: bedsOf(i.crops.filter((c) => c.rain !== "open")) });
        }
        else if (read.length >= DRY_DAYS_READ && total < r.dryMm - EPS && !ahead.every((d) => i.dryMonths.includes(monthOf(d.date)))) {
            out.push({ watch: "dry", rule: r.rule, dates: read.map((d) => d.date), value: total, crops: uniq(open.map((c) => c.species)), beds: bedsOf(open) });
        }
    }
    return out;
}
function saidBefore(said, plot, a, today) {
    return said.some((s) => s.plot === plot && s.alert.watch === a.watch && (a.watch === "rain" || a.watch === "dry"
        ? daysBetween(s.on, today) < WEEK && s.on <= today
        : s.alert.dates.some((d) => a.dates.includes(d))));
}
function sayNow(said, plot, alerts, today) {
    const kept = said.filter((s) => s.on <= today && daysBetween(s.on, today) < SAID_DAYS);
    const fresh = alerts.filter((a) => !saidBefore(kept, plot, a, today));
    return { said: [...kept, ...fresh.map((alert) => ({ plot, on: today, alert }))], fresh };
}
function saidOn(said, plot, day) {
    return said.filter((s) => s.plot === plot && s.on === day).map((s) => s.alert);
}
function parseSaid(v) {
    if (!Array.isArray(v))
        return [];
    return v.filter((s) => !!s && typeof s === "object"
        && typeof s.plot === "string" && typeof s.on === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(s.on)
        && !!s.alert && typeof (s.alert.watch) === "string"
        && Array.isArray(s.alert.dates) && isNum(s.alert.value)
        && Array.isArray(s.alert.crops) && Array.isArray(s.alert.beds));
}
function listWords(names) {
    try {
        return new Intl.ListFormat(appLang() === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(names);
    }
    catch {
        return names.join(", ");
    }
}
function namesOf(names) {
    const u = uniq(names);
    return u.length <= 3 ? listWords(u) : fillCopy("nwListMore", { list: u.slice(0, 2).join(", "), n: u.length - 2 });
}
function cropsWords(a, name) {
    const crops = namesOf(a.crops.map(name));
    if (!a.beds.length)
        return crops;
    const where = a.beds.length === 1 ? a.beds[0] : fillCopy("nwBedsMany", { n: a.beds.length });
    return fillCopy("wwaCropsIn", { crops, where });
}
function nightWord(morning, said) {
    const k = daysBetween(said, morning);
    if (k === 1)
        return copy.wwaTonight;
    if (k === 2)
        return copy.wwaTomorrowNight;
    return fillCopy("wwaDayNight", { day: weekdayLong(asDate(addDays(morning, -1)).getUTCDay()) });
}
function fromWord(day, said) {
    const k = daysBetween(said, day);
    if (k <= 0)
        return copy.wwaFromToday;
    if (k === 1)
        return copy.wwaFromTomorrow;
    return fillCopy("wwaFromDay", { day: weekdayLong(asDate(day).getUTCDay()) });
}
function alertLine(a, said, name, temp = fmtTemp) {
    switch (a.watch) {
        case "frost":
            return fillCopy(a.freeze ? "wwaFreeze" : "wwaFrost", { when: listWords(a.dates.map((d) => nightWord(d, said))),
                low: temp(a.value), crops: cropsWords(a, name) });
        case "heat":
            return fillCopy("wwaHeat", { from: fromWord(a.dates[0], said), hi: temp(a.value), lo: temp(a.night ?? a.value) });
        case "bolt":
            return fillCopy("wwaBolt", { from: fromWord(a.dates[0], said), hi: temp(a.value), crops: cropsWords(a, name) });
        case "rain": {
            const dry = a.dryBeds ?? [];
            const rest = dry.length ? " " + fillCopy(dry.length === 1 ? "wwaRainDryOne" : "wwaRainDryMany", { beds: listWords(dry) }) : "";
            return fillCopy("wwaRain", { rain: fmtRain(a.value) }) + rest;
        }
        case "dry":
            return copy.wwaDry;
    }
}
const lineKind = (w) => (w === "frost" ? "frost" : w === "heat" || w === "bolt" ? "heat" : "water");
function frostWords(crops, rules, today, name) {
    const f = rules.frost;
    const lined = f ? crops.filter((c) => c.rain !== "indoors" && c.tier != null && isNum(f.lineC[c.tier])) : [];
    if (!f || !lined.length)
        return { line: null, bands: [] };
    const lineOf = (c) => f.lineC[c.tier];
    const tops = uniq(lined.map(lineOf));
    const line = Math.max(...tops);
    if (f.freezeC < line - EPS)
        tops.push(f.freezeC);
    const tonight = addDays(today, 1);
    const bands = uniq(tops).sort((a, b) => a - b).map((upTo) => {
        const at = lined.filter((c) => upTo <= lineOf(c) + EPS);
        const a = { watch: "frost", rule: f.rule, dates: [tonight], value: upTo, freeze: upTo <= f.freezeC + EPS,
            crops: uniq(at.map((c) => c.species)), beds: uniq(at.map((c) => c.bed).filter((b) => !!b)) };
        return { upTo: Math.round(upTo * 100) / 100, text: alertLine(a, today, name, () => "{low}") };
    });
    return { line: Math.round(line * 100) / 100, bands };
}

function cropsInGround(w, today) {
    const season = w.seasons.find((s) => s.id === w.seasonId);
    const locate = bedLocator([...w.beds]);
    const out = [];
    for (const p of season?.plantings ?? []) {
        const at = p.transplanted || p.sown;
        if (p.end_date || p.end_cause || !at || at > today)
            continue;
        const sp = w.bundle.species.find((x) => x.id === p.species);
        if (!sp)
            continue;
        const bed = p.region ? locate(p.region) ?? null : null;
        const thr = resolveSpecies(p.species, p.cultivar_group ?? null, w.bundle).bolt_risk?.threshold_c;
        out.push({ species: p.species, tier: resolveFrostTolerance(sp, p.cultivar_group) ?? null,
            boltC: typeof thr === "number" ? thr : null, bed, rain: w.beds.find((b) => b.name === bed)?.rain ?? "open" });
    }
    return out;
}
const SAID_KEY = "gg-forecast-said";
const readSaid = () => { try {
    return parseSaid(JSON.parse(localStorage.getItem(SAID_KEY) ?? "[]"));
}
catch {
    return [];
} };
const writeSaid = (s) => { try {
    localStorage.setItem(SAID_KEY, JSON.stringify(s));
}
catch { } };
function spotOf(lat, lon) {
    const r = (x) => { const v = Math.round(x * 10) / 10; return v === 0 ? 0 : v; };
    const la = r(lat), lo = r(lon);
    return { lat: la, lon: lo, key: `${la.toFixed(1)},${lo.toFixed(1)}` };
}
function daysFrom(row, today) {
    return (row?.days ?? []).filter((d) => d.date >= today).slice(0, 7);
}
function readWhen(readAt, now) {
    const mins = Math.max(0, Math.round((now - Date.parse(readAt)) / 60000));
    if (!Number.isFinite(mins))
        return "";
    return mins < 1 ? copy.acJustNow : mins < 60 ? fillCopy("acMinAgo", { n: mins })
        : mins < 60 * 24 ? fillCopy("acHoursAgo", { n: Math.round(mins / 60) }) : fmtMonthDay(readAt.slice(0, 10));
}
const FREEZING_C = 0;
const deg = (c) => `${Math.round(tempSystem() === "c" ? c : (c * 9) / 5 + 32)}°`;
const weekday = (iso) => weekdayShort(new Date(`${iso}T12:00:00Z`).getUTCDay());
const STALE_MS = 20 * 60_000;
function initForecast(deps) {
    const states = new Map();
    const shown = new Map();
    const rest = async (path, init = {}) => deps.authed(async (cfg, s) => {
        const r = await fetch(`${cfg.url}/rest/v1/${path}`, { ...init, headers: {
                "apikey": cfg.anonKey, "Authorization": `Bearer ${s.access_token}`, "Content-Type": "application/json",
                ...init.headers
            } });
        if (!r.ok)
            throw new Error(`weather watch: ${r.status}`);
        return r.status === 204 || init.method === "DELETE" || init.method === "POST" ? null : await r.json();
    });
    const redraw = (plotId) => { for (const [where, s] of shown)
        if (s.g.plotId === plotId)
            draw(where); };
    let bundleSeen = null;
    const nameOf = (sid) => midSentence(bundleSeen ? commonName(bundleSeen, sid) : app.speciesName?.(sid) ?? sid);
    const alertsFor = (g, days, today) => {
        const w = g.watch;
        if (!w || !days.length)
            return [];
        bundleSeen = w.bundle;
        const crops = cropsInGround(w, today);
        if (!crops.length)
            return [];
        const water = waterMonthsFor(gardenFrost(w.bundle, g.lat, g.lon, [...w.seasons]).site ?? null, w.bundle);
        return forecastAlerts({ today, days, crops, lat: g.lat, rules: watchRules(w.bundle.rules), hotMonths: water.hot, dryMonths: water.dry });
    };
    const frostForPush = (g, st, today) => {
        const w = g.watch;
        if (!w || !app.pushFrost)
            return;
        bundleSeen = w.bundle;
        const fw = frostWords(cropsInGround(w, today), watchRules(w.bundle.rules), today, nameOf);
        const name = g.name ?? (g.plotId === app.currentPlotId ? app.currentPlot?.name : null) ?? "";
        void app.pushFrost(g.plotId, name, fw, st.line).then((held) => { if (held)
            st.line = fw.line; });
    };
    const say = (plotId, alerts, today) => {
        if (!alerts.length)
            return;
        const r = sayNow(readSaid(), plotId, alerts, today);
        if (!r.fresh.length)
            return;
        writeSaid(r.said);
        setTimeout(() => app.noticesChanged?.(), 0);
    };
    const load = async (g) => {
        const spot = spotOf(g.lat, g.lon);
        const st = states.get(g.plotId) ?? { spot: spot.key, watch: "unknown", row: null, at: 0, busy: false, failed: false, line: null };
        states.set(g.plotId, st);
        st.busy = true;
        try {
            const pid = encodeURIComponent(g.plotId);
            const mine = await rest(`weather_watch?plot_id=eq.${pid}&select=lat,lon,frost_line_c`) ?? [];
            if (!mine.length) {
                st.watch = "off";
                st.row = null;
                st.line = null;
            }
            else {
                st.watch = "on";
                st.line = mine[0].frost_line_c == null ? null : Number(mine[0].frost_line_c);
                if (spotOf(Number(mine[0].lat), Number(mine[0].lon)).key !== spot.key) {
                    await rest(`weather_watch?plot_id=eq.${pid}`, { method: "PATCH", body: JSON.stringify({ lat: spot.lat, lon: spot.lon }), headers: { "Prefer": "return=minimal" } });
                }
                const rows = await rest(`weather_forecast?spot=eq.${encodeURIComponent(spot.key)}&select=spot,provider,read_at,days`) ?? [];
                st.row = rows[0] ?? null;
            }
            st.spot = spot.key;
            st.failed = false;
        }
        catch {
            st.failed = true;
        }
        st.at = Date.now();
        st.busy = false;
        redraw(g.plotId);
    };
    const turn = async (g, on) => {
        const st = states.get(g.plotId);
        if (!st || st.busy)
            return;
        st.busy = true;
        draw("home");
        draw("cal");
        const spot = spotOf(g.lat, g.lon);
        try {
            if (on)
                await rest("weather_watch?on_conflict=user_id,plot_id", { method: "POST",
                    body: JSON.stringify({ plot_id: g.plotId, lat: spot.lat, lon: spot.lon }), headers: { "Prefer": "resolution=merge-duplicates,return=minimal" } });
            else
                await rest(`weather_watch?plot_id=eq.${encodeURIComponent(g.plotId)}`, { method: "DELETE" });
        }
        catch {
            st.busy = false;
            st.failed = true;
            redraw(g.plotId);
            return;
        }
        st.busy = false;
        await load(g);
    };
    const draw = (where) => {
        const s = shown.get(where);
        if (!s)
            return;
        const { node, g } = s;
        const st = states.get(g.plotId);
        const h = where === "home" ? "h2" : "h3";
        const head = el(h, "wwh", g.name ? fillCopy("wwTitleAt", { garden: g.name }) : copy.wwTitle);
        head.id = `wwh-${where}`;
        const unit = el("span", "wwunit", tempSystem() === "c" ? " °C" : " °F");
        const parts = [head];
        const button = (label, on, cls) => {
            const b = el("button", cls, label);
            b.type = "button";
            b.disabled = !!st?.busy;
            b.addEventListener("click", () => void turn(g, on));
            return b;
        };
        if (!deps.session()) {
            parts.push(el("p", "wwnote", copy.wwSignIn));
            const b = el("button", "btn btn-secondary", copy.acSignIn);
            b.type = "button";
            b.addEventListener("click", () => { if (app.openAuthSheet)
                app.openAuthSheet();
            else
                location.hash = "#/account"; });
            parts.push(b);
        }
        else if (!st || st.watch === "unknown") {
            if (st?.failed)
                parts.push(el("p", "wwnote", copy.wwFailed));
            else
                node.setAttribute("aria-busy", "true");
        }
        else if (st.watch === "off") {
            parts.push(el("p", "wwnote", copy.wwOptBody), el("p", "wwfine", copy.wwOptPrivacy), button(copy.wwOn, true, "btn btn-secondary"));
            if (st.failed)
                parts.push(el("p", "wwnote", copy.wwFailed));
        }
        else {
            const days = daysFrom(st.row, todayIso());
            if (st.row?.provider === "none")
                parts.push(el("p", "wwnote", copy.wwAbroad));
            else if (!days.length)
                parts.push(el("p", "wwnote", copy.wwWaiting));
            else {
                head.append(unit);
                const ol = el("ol", "wwdays");
                for (const d of days) {
                    const li = el("li", "wwday");
                    const said = el("span", "vh", fillCopy("wwDayAria", {
                        day: weekday(d.date), hi: d.hi == null ? copy.wwNone : fmtTemp(d.hi), lo: d.lo == null ? copy.wwNone : fmtTemp(d.lo),
                        rain: d.rain == null ? copy.wwNone : fmtRain(d.rain)
                    }));
                    const dow = el("span", "wwdow", weekday(d.date));
                    const hi = el("span", "wwhi", d.hi == null ? "–" : deg(d.hi));
                    const lo = el("span", `wwlo${d.lo != null && d.lo <= FREEZING_C ? " frost" : ""}`, d.lo == null ? "–" : deg(d.lo));
                    const rain = el("span", `wwrain${d.rain ? " wet" : ""}`, d.rain == null ? "–" : d.rain ? fmtRain(d.rain) : "0");
                    for (const x of [dow, hi, lo, rain])
                        x.setAttribute("aria-hidden", "true");
                    li.append(said, dow, hi, lo, rain);
                    ol.append(li);
                }
                parts.push(ol);
                const today = todayIso();
                const alerts = alertsFor(g, days, today);
                if (alerts.length) {
                    const ul = el("ul", "wwalerts");
                    ul.setAttribute("aria-label", copy.wwaListAria);
                    for (const a of alerts) {
                        const li = el("li", `wwalert ${lineKind(a.watch)}`, alertLine(a, today, nameOf));
                        const slug = g.watch?.bundle.rules.find((r) => r.id === a.rule)?.page_slug;
                        if (typeof slug === "string" && slug) {
                            const why = el("a", "wwwhy", copy.clWhy);
                            why.href = `../rules/${slug}/`;
                            li.append(" ", why);
                        }
                        ul.append(li);
                    }
                    parts.push(ul);
                    say(g.plotId, alerts, today);
                }
                const from = st.row.provider === "nws" ? "wwFromNws" : "wwFromOpenMeteo";
                parts.push(el("p", "wwsrc", `${fillCopy(from, { when: readWhen(st.row.read_at, Date.now()) })} ${copy.wwNever}`));
            }
            if (st.failed)
                parts.push(el("p", "wwnote", copy.wwFailed));
            const offer = app.pushOffer?.();
            if (offer) {
                const line = el("p", "wwnote");
                line.append(offer);
                parts.push(line);
            }
            parts.push(button(copy.wwOff, false, "btn btn-quiet"));
            frostForPush(g, st, todayIso());
        }
        node.replaceChildren(...parts);
        if (st && st.watch !== "unknown")
            node.removeAttribute("aria-busy");
    };
    app.forecastStrip = (where, g) => {
        if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) {
            shown.delete(where);
            return null;
        }
        const prev = shown.get(where);
        const node = prev?.node ?? el("section", "wwstrip");
        node.setAttribute("aria-labelledby", `wwh-${where}`);
        shown.set(where, { node, g });
        const st = states.get(g.plotId);
        const moved = st && st.spot !== spotOf(g.lat, g.lon).key;
        if (deps.session() && (!st || (!st.busy && (moved || Date.now() - st.at > STALE_MS))))
            void load(g);
        draw(where);
        return node;
    };
    deps.onAuthChange(() => { states.clear(); for (const [where, s] of shown) {
        draw(where);
        if (deps.session())
            void load(s.g);
    } });
    app.forecastSaid = (plotId, day) => saidOn(readSaid(), plotId, day)
        .map((a) => ({ kind: lineKind(a.watch), text: alertLine(a, day, nameOf), jobs: 0 }));
    app.noticesChanged?.();
    app.homeRefresh?.();
    app.calendarRefresh?.();
}
const todayIso = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export { cropsInGround, daysFrom, initForecast, readWhen, spotOf };
