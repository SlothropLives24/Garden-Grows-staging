import './chunk-lutet8cz.js';
import { scheduleClimate, frostBand, fmtMonthDay, weekJobs, weekTaskPool, groupAgenda, taskSentence, seasonYearOf, gardenTasksShared, jobTitle, isWindowEnd, plantingLabel, frostRare, humanizeMMDD, el, localiseProse, corpusEs, commonName, confidenceBadge, gradeClassOfWord, confidenceWord } from './core.js';
import { doorClaim, copy, appLang, fillCopy, titleCase, humanize, whenIdle, markStarted, loadChunk } from './paint.js';
import { symptoms, answerRules } from './chunk-h38ll914.js';
import { symptomAnswer } from './chunk-ihqqrs44.js';
import { climateProv, provFacts } from './chunk-l9zpnf9a.js';
import { dayHeading } from './chunk-nhqolnsd.js';
import { examplePastSeasons } from './example.js';
import { aYearAgoThisWeek } from './chunk-e0bi5vda.js';
import './chunk-l5cseoso.js';
import './chunk-h8sxf1mq.js';

const bandSite = (bundle, key) => bundle.climate?.sites?.find((s) => s.key === key) ?? null;
const placeName = (site) => titleCase(humanize(site.key));
function bandFrost(bundle) {
    const at = bandSite(bundle, "minneapolis");
    if (!at)
        return null;
    const clim = scheduleClimate(at.lat, at.lon, bundle, null);
    if (!clim)
        return null;
    const { median, safe } = frostBand(clim.site);
    if (!median || !safe)
        return null;
    const freeze = frostRare(clim.site) ? null : clim.site.first_freeze_32f_p50 ?? null;
    return { place: placeName(at), median: median.label, safe: safe.label, firstFreeze: freeze ? humanizeMMDD(freeze) : null,
        source: climateProv(provFacts(clim)) };
}
const SAMPLE_PLOT = "landing-band-week";
const SAMPLE_BED_M = 2.4384;
const SAMPLE_CROPS = [
    { species: "lactuca_sativa" },
    { species: "brassica_juncea" },
    { species: "raphanus_sativus" },
    { species: "tetragonia_tetragonioides" },
    { species: "phaseolus_vulgaris", group: "bush" },
    { species: "solanum_lycopersicum" },
];
const FIRST_IN = new Set(["cool_season", "warm_set_out", "plant_cold_hardy", "warm_window"]);
const AGAIN_IN = new Set(["succession", "autumn"]);
const BED_DAY = new Set(["plant_after_last_frost", "plant_cold_hardy"]);
const MAX_PASSES = 8;
const WEEK_ITEMS = 3;
const CHORES = new Set(["cool_season", "warm_set_out", "warm_window", "start_indoors", "succession", "autumn", "care"]);
const READER_AS_KEEPER = /\b(you|your|yours|tu|tus|te|ti)\b/i;
function bandGarden(bundle, todayIso) {
    const at = bandSite(bundle, "houston");
    if (!at)
        return null;
    const year = seasonYearOf(todayIso, at.lat);
    const bed = { name: copy.exampleBedName, region: { shape: "rect", x: 0, y: 0, w: SAMPLE_BED_M, h: SAMPLE_BED_M } };
    const strip = SAMPLE_BED_M / SAMPLE_CROPS.length;
    const plantings = [];
    const season = { id: year, plot: SAMPLE_PLOT, observations: [], plantings,
        plan: [{ area: bed.name, mybed: true, plantings: SAMPLE_CROPS.map((c) => ({ species: c.species, cultivar_group: c.group ?? null })) }] };
    const ctx = { plotId: SAMPLE_PLOT, name: placeName(at), lat: at.lat, lon: at.lon, seasons: [season], seasonId: year, beds: [bed] };
    const logged = new Set();
    for (let pass = 0; pass < MAX_PASSES; pass++) {
        const jobs = gardenTasksShared(bundle, year, ctx).filter((t) => t.bed === bed.name && typeof t.date === "string").sort((a, b) => a.date.localeCompare(b.date));
        const ownDay = new Set(jobs.filter((t) => t.species && FIRST_IN.has(t.kind)).map((t) => t.species));
        const indoors = new Set(jobs.filter((t) => t.species && t.kind === "start_indoors").map((t) => t.species));
        let added = 0;
        for (const t of jobs) {
            if (t.date >= todayIso)
                break;
            SAMPLE_CROPS.forEach((c, i) => {
                const its = t.species === c.species && (FIRST_IN.has(t.kind) || AGAIN_IN.has(t.kind));
                const bedDay = !t.species && BED_DAY.has(t.kind) && !ownDay.has(c.species);
                if (!its && !bedDay)
                    return;
                const key = `${c.species}|${t.date}`;
                if (logged.has(key))
                    return;
                const first = !plantings.some((p) => p.species === c.species);
                logged.add(key);
                added++;
                plantings.push({ species: c.species, ...(c.group ? { cultivar_group: c.group } : {}),
                    region: { shape: "rect", x: strip * i + 0.05, y: 0.05, w: strip - 0.1, h: SAMPLE_BED_M - 0.1 },
                    ...(first && indoors.has(c.species) ? { transplanted: t.date } : { sown: t.date }) });
            });
        }
        if (!added)
            break;
    }
    return ctx;
}
function choreLine(sentence, t) {
    const title = jobTitle(sentence, t, appLang());
    return t.kind === "start_indoors" ? title.split(", ")[0] : title;
}
function bandWeek(bundle, todayIso) {
    const ctx = bandGarden(bundle, todayIso);
    if (!ctx)
        return null;
    const week = weekJobs(weekTaskPool(bundle, [ctx], todayIso, false), todayIso);
    const pool = groupAgenda(week.days.flatMap((d) => d.tasks));
    const items = pool.filter((t) => CHORES.has(t.kind))
        .map((t) => ({ date: t.date, day: dayHeading(t.date, todayIso), text: choreLine(taskSentence(t, bundle), t) }))
        .filter((it) => !READER_AS_KEEPER.test(it.text));
    return { place: ctx.name, items: (items.length ? items : pickingLines(bundle, pool, todayIso)).slice(0, WEEK_ITEMS) };
}
function pickingLines(bundle, pool, todayIso) {
    const seen = new Set();
    return pool.filter((t) => t.kind === "harvest_open" && !isWindowEnd(t) && t.species && !seen.has(t.species) && !!seen.add(t.species))
        .map((t) => ({ date: t.date, day: dayHeading(t.date, todayIso), text: fillCopy("clPickStart", { crop: plantingLabel(bundle, t.species, t.group ?? cropGroup(t.species)) }) }));
}
function cropGroup(species) {
    return SAMPLE_CROPS.find((c) => c.species === species)?.group ?? null;
}
const NEAR_DAYS = 7;
const WHOLE_YEAR = 183;
const DIARY_LINES = 2;
const DAY_MS = 86400000;
function mdOffset(todayIso, iso) {
    const doy = (s) => (Date.UTC(2001, Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) - Date.UTC(2001, 0, 1)) / DAY_MS;
    const d = doy(iso) - doy(todayIso);
    return d > 182 ? d - 365 : d < -182 ? d + 365 : d;
}
function noteLine(text) {
    const t = text.trim();
    return /[.!?…]$/.test(t) ? t : `${t}.`;
}
function bandDiary(todayIso) {
    const year = Number(todayIso.slice(0, 4));
    if (!Number.isFinite(year))
        return [];
    const seasons = examplePastSeasons(year);
    const notes = (days) => aYearAgoThisWeek(seasons, todayIso, days).filter((r) => r.kind === "note" && !r.species && !!r.text);
    const week = notes(NEAR_DAYS);
    const pool = (week.length >= 2 ? week : notes(WHOLE_YEAR)).map((r) => ({ r, off: mdOffset(todayIso, r.date) }));
    return pool.sort((a, b) => Math.abs(a.off) - Math.abs(b.off) || a.off - b.off).slice(0, DIARY_LINES)
        .sort((a, b) => a.off - b.off)
        .map(({ r }) => ({ date: r.date, label: fmtMonthDay(r.date), text: noteLine(r.text ?? "") }));
}
function bandTip(dayOfYear) {
    const c = doorClaim(dayOfYear);
    return { id: c.id, q: c.q };
}
function verdictLine(answer) {
    const a = answer.replace(/\s+/g, " ").trim();
    const m = /^(.+?[.!?])(?: (?=[A-ZÁÉÍÓÚÑ¿¡"“])|$)/u.exec(a);
    return m ? m[1] : a;
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
const BAND_SYMPTOM = { id: "blossom-end-rot", species: "solanum_lycopersicum" };

function ensureBandsCss() {
    if (document.getElementById("landbands-css"))
        return;
    const link = document.createElement("link");
    link.id = "landbands-css";
    link.rel = "stylesheet";
    link.href = "./landbands.css";
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
function linkDoor(id, label, href) {
    const a = el("a", "lg-band-door");
    a.href = href;
    a.dataset.door = id;
    a.append(el("span", null, label), goMark());
    return a;
}
function planDoor() {
    const b = el("button", "lg-band-door");
    b.type = "button";
    b.dataset.door = "plan";
    b.append(el("span", null, copy.door4Q), goMark());
    b.addEventListener("click", async () => {
        markStarted();
        await (await loadChunk("core")).startPlanning();
    });
    return b;
}
function goMark() {
    const s = el("span", "lg-band-go", "›");
    s.setAttribute("aria-hidden", "true");
    return s;
}
function doorRow(...doors) {
    const row = el("div", "lg-band-doors");
    row.append(...doors);
    return row;
}
function band(key, heading) {
    const box = el("article", "lg-band");
    box.dataset.band = key;
    const h = el("h3", "lg-band-h", heading);
    h.id = `lgband-${key}`;
    box.setAttribute("aria-labelledby", h.id);
    const body = el("div", "lg-band-out");
    box.append(h, body);
    return { box, body };
}
function kicker(text) { return el("p", "lg-band-k", text); }
function beforeBand(bundle) {
    const { box, body } = band("before", copy.doorsGroupBefore);
    const f = bandFrost(bundle);
    if (f) {
        body.appendChild(kicker(fillCopy("lgBandFrostK", { place: f.place })));
        const ul = el("ul", "lg-band-lines lg-band-frost");
        ul.appendChild(el("li", null, fillCopy("lgBandFrostHalf", { date: f.median })));
        const row = frostBand((bundle.climate?.sites ?? []).find((x) => x.key === "minneapolis") ?? {}).safe;
        const n = row && row.label === f.safe ? Math.round(row.pct / 10) : 0;
        if (n > 0)
            ul.appendChild(el("li", null, fillCopy(n === 1 ? "lgBandFrostLateOne" : "lgBandFrostLateMany", { n, date: f.safe })));
        if (f.firstFreeze)
            ul.appendChild(el("li", null, fillCopy("lgBandFrostFreeze", { date: f.firstFreeze })));
        body.append(ul, el("p", "lg-band-src", f.source));
    }
    box.appendChild(doorRow(linkDoor("when", copy.door1Q, "#/answers"), planDoor()));
    return box;
}
function datedLines(cls, rows) {
    const ul = el("ul", `lg-band-lines ${cls}`);
    let last = "";
    for (const r of rows) {
        const li = el("li");
        li.dataset.date = r.date;
        if (r.day !== last)
            li.append(el("b", "lg-band-day", r.day), " ");
        li.appendChild(el("span", "lg-band-text", r.text));
        last = r.day;
        ul.appendChild(li);
    }
    return ul;
}
function growingBand(bundle) {
    const { box, body } = band("growing", copy.doorsGroupGrowing);
    const s = symptoms(bundle).find((x) => x.id === BAND_SYMPTOM.id);
    if (s && answerRules(s, BAND_SYMPTOM.species, bundle).length) {
        body.appendChild(kicker(copy.lgBandWrongK)).classList.add("lg-band-k-wrong");
        body.appendChild(symptomAnswer(s, BAND_SYMPTOM.species, commonName(bundle, BAND_SYMPTOM.species), bundle));
    }
    box.appendChild(doorRow(linkDoor("now", copy.doorNowQ, "#/answers?situation=now"), linkDoor("wrong", copy.doorWrongQ, "#/log?wrong")));
    return box;
}
function fillWeek(growing, bundle, todayIso) {
    const w = bandWeek(bundle, todayIso);
    const items = w?.items ?? [];
    if (!w || !items.length)
        return;
    const jobs = items.map((it) => ({ ...it, text: verdictLine(it.text) }));
    growing.querySelector(".lg-band-out")?.prepend(kicker(fillCopy("lgBandWeekK", { place: w.place })), datedLines("lg-band-week", jobs));
}
function trackBand(todayIso) {
    const { box, body } = band("track", copy.doorsGroupTrack);
    const lines = bandDiary(todayIso);
    if (lines.length) {
        body.appendChild(kicker(copy.lgBandDiaryK));
        body.appendChild(datedLines("lg-band-diary", lines.map((d) => ({ date: d.date, day: d.label, text: d.text }))));
    }
    body.appendChild(el("p", "lg-band-line", copy.lgBandDiaryLine));
    box.appendChild(doorRow(linkDoor("diary", copy.doorDiaryQ, "#/log")));
    return box;
}
const TIPS_URL = () => (appLang() === "es" ? "../build/pages/tips-es.json" : "../build/pages/tips.json");
async function tipCard(id) {
    try {
        const res = await fetch(TIPS_URL());
        if (!res.ok)
            return null;
        const c = (await res.json())[id];
        return c && typeof c.verdict === "string" && c.verdict ? c : null;
    }
    catch {
        return null;
    }
}
function tipBand(id, q) {
    const { box, body } = band("tip", copy.doorsGroupTip);
    body.appendChild(el("p", "lg-band-q", q));
    box.appendChild(doorRow(linkDoor("tip", copy.lgBandTipDoor, `#/why?belief=${id}`)));
    return box;
}
function fillTip(tip, c) {
    const body = tip.querySelector(".lg-band-out"), q = tip.querySelector(".lg-band-q");
    if (!body || !q)
        return;
    const conf = el("span", "lg-band-conf");
    const badge = c.grade ? confidenceBadge(c.grade) : null;
    if (badge)
        conf.appendChild(badge);
    else if (c.word)
        conf.appendChild(el("span", `conf ${gradeClassOfWord(c.word)}`.trim(), c.word));
    if (conf.firstChild)
        q.append(" ", conf);
    body.appendChild(el("p", "lg-band-answer", c.verdict));
    if (c.title) {
        const src = el("p", "lg-band-src");
        src.appendChild(el("cite", null, c.title));
        if (c.publisher)
            src.append(el("span", "lg-band-sep", " \u00b7 "), el("span", "lg-band-pub", c.publisher));
        body.appendChild(src);
    }
}
const pad = (n) => String(n).padStart(2, "0");
function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayOfYear() {
    return Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
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
    card.append(chip, el("p", "lg-team", said), w, ev);
    return card;
}
function renderPair(bundle, host) {
    const rule = pairRecord(bundle.rules, LANDING_PAIR.rule, "A"), myth = pairRecord(bundle.beliefs, LANDING_PAIR.belief, "F");
    if (!rule?.claim || !myth?.belief) {
        host.hidden = true;
        host.removeAttribute("aria-busy");
        return;
    }
    const [head, rest] = claimHead(localiseProse(corpusEs(LANDING_PAIR.rule, "title") ?? rule.claim));
    const row = el("div", "lg-pair-row");
    row.append(pairCard("sure", "A", head, rest, `#/why?rule=${LANDING_PAIR.rule}`), pairCard("myth", "F", corpusEs(LANDING_PAIR.belief, "belief") ?? myth.belief, copy.lgPairMythWhy, `#/why?belief=${LANDING_PAIR.belief}`, "lgPairMythWhy"));
    const strip = host.parentElement, unscrolled = !!strip && strip.scrollLeft <= 1;
    host.replaceChildren(row);
    if (strip && unscrolled)
        strip.scrollLeft = 0;
    host.removeAttribute("aria-busy");
}
async function renderBands(bundle, host) {
    ensureBandsCss();
    const day = dayOfYear(), today = todayIso();
    const tip = bandTip(day);
    const card = tipCard(tip.id);
    const k = el("h2", "lg-proof-lead", copy.lgBandsKicker);
    k.id = "lgbands-k";
    const grid = el("div", "lg-bands-grid");
    const growing = growingBand(bundle), tipBox = tipBand(tip.id, tip.q);
    grid.append(beforeBand(bundle), growing, trackBand(today), tipBox);
    host.replaceChildren(k, grid);
    host.removeAttribute("aria-label");
    const week = new Promise((done) => whenIdle(() => {
        try {
            fillWeek(growing, bundle, today);
        }
        catch { }
        done();
    }, 1000));
    await Promise.all([week, card.then((c) => { if (c)
            fillTip(tipBox, c); })]);
    host.style.minHeight = "";
    host.removeAttribute("aria-busy");
}

export { renderBands, renderPair };
