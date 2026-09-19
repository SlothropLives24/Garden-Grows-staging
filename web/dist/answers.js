import { plantHref, plantLink } from "./panels/plantcard.js";
import { needsInsects } from "./engine/forage.js";
import { strongestSupportRequirement } from "./engine/openbed.js";
import { VALUE_WORD } from "./engine/plantcard.js";
import { resolveClimate, resolveZone, zipToLatLon } from "./engine/intake.js";
import { resolveSpecies } from "./engine/compiler.js";
import { displayName } from "./engine/guilds.js";
import { resolveDtm, shareOrDownloadIcs, tasksToIcs, monthDay } from "./calendar.js";
import { remindChoice, setRemindChoice } from "./units.js";
import { countRung } from "./analytics.js";
import { $ } from "./dom.js";
import { mark, markLink } from "./dossier.js";
import { glossTerm } from "./glossary.js";
import { confidenceWord } from "./confidence.js";
import { containerCrops, headlineTeams, quickCrops, situationFromHash, situations } from "./doors.js";
import { CHECK_SVG } from "./panels/soil.js";
import { app, commonName } from "./state.js";
import { humanize } from "./engine/labels.js";
export function climateAnswer(lat, lon, bundle) {
    const clim = resolveClimate(lat, lon, bundle);
    if (!clim)
        return null;
    const zone = resolveZone(lat, lon, bundle);
    const site = clim.site;
    const hard = site.hardiness;
    const stn = (site.provenance?.station ?? null);
    return {
        lastP50: site.last_frost_32f?.p50 ?? null,
        lastP10: site.last_frost_32f?.p10 ?? null,
        firstFreeze: site.first_freeze_32f_p50 ?? null,
        seasonDays: site.growing_season_days_p50 ?? null,
        zoneLabel: zone?.label ?? (zone?.zone != null ? String(zone.zone) : null)
            ?? hard?.label ?? (hard?.zone != null ? String(hard.zone) : null),
        stationName: stn?.name ?? null,
        distanceKm: clim.distanceKm,
        grade: clim.effectiveGrade,
        caveat: clim.caveat,
    };
}
export function nextOccurrence(mmdd, todayIso) {
    const year = Number(todayIso.slice(0, 4));
    const thisYear = `${year}-${mmdd}`;
    return thisYear >= todayIso ? thisYear : `${year + 1}-${mmdd}`;
}
const mmddShift = (mmdd, days) => {
    const [mm, dd] = mmdd.split("-").map(Number);
    if (!mm || !dd)
        return null;
    const d = new Date(2001, mm - 1, dd + days);
    if (d.getFullYear() !== 2001)
        return null;
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function cropAnswer(sid, lat, lon, todayIso, bundle) {
    const clim = resolveClimate(lat, lon, bundle);
    const site = clim?.site;
    if (!site)
        return null;
    if (!bundle.species.some((s) => s.id === sid))
        return null;
    const sp = resolveSpecies(sid, null, bundle);
    const label = commonName(bundle, sid) || humanize(sid);
    const p50 = site.last_frost_32f?.p50 ?? null;
    const p10 = site.last_frost_32f?.p10 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    const rows = [];
    const tasks = [];
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
    if (wk && p50) {
        const d = mmddShift(p50, -wk * 7);
        if (d)
            dated("indoors", "Start seeds indoors around", d, "start_indoors", `Start ${label} seeds indoors - about ${wk} weeks before your last frost; set the seedlings out after it.`);
    }
    if (!fallSown && p50) {
        if (tol === "tender" || tol == null) {
            if (p10) {
                dated("setout-safe", "Set plants out (frost-tender): a safe bet is", p10, "plant_after_last_frost", `Set ${label} out - past the date only 1 year in 10 still frosts after.`);
                rows.push({ key: "setout-median", label: "Feeling lucky? Half of years are frost-free by", date: nextOccurrence(p50, todayIso), note: null });
                setOutMmdd = p10;
            }
            else {
                dated("setout-median", "Set plants out after your median last frost", p50, "plant_after_last_frost", `Set ${label} out - your median last frost has passed.`);
                setOutMmdd = p50;
            }
        }
        else {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const offs = (r096?.offset_days_before_last_frost ?? null);
            const off = tol === "hardy" ? offs?.hardy : offs?.half_hardy;
            if (off && off > 0 && model === "dtm") {
                const d = mmddShift(p50, -off);
                const weeks = Math.round(off / 7);
                if (d) {
                    dated("cool-sow", `Sow or set out (${tol === "hardy" ? "cold-hardy" : "half-hardy"}) from about`, d, "cool_season", `Sow or set out ${label} - ${tol === "hardy" ? "cold-hardy" : "half-hardy"}, so it can go in about ${weeks} week${weeks === 1 ? "" : "s"} before your last frost.`);
                    setOutMmdd = d;
                }
            }
            else if (model === "dtm") {
                dated("setout-median", "Plant from your median last frost", p50, "plant_after_last_frost", `Plant ${label} - your median last frost has passed.`);
                setOutMmdd = p50;
            }
        }
    }
    if (fallSown) {
        rows.push({ key: "fall-sown", label: "", date: null,
            note: `${label} is fall-planted - it goes in ahead of winter, not on a spring date. ` });
    }
    const zr = sp.hardiness_zone;
    if (Array.isArray(zr) && typeof zr[0] === "number" && typeof zr[1] === "number") {
        const zone = resolveZone(lat, lon, bundle);
        const zn = zone && typeof zone.zone === "number" ? zone.zone : null;
        const zl = zone?.label ?? (zn != null ? String(zn) : null);
        const conf = (sp.confidence ?? {});
        const est = (conf.estimated ?? []).includes("hardiness_zone") ? " The rated range is an estimate." : "";
        if (zn != null) {
            rows.push({ key: "zone", label: "", date: null,
                note: zn >= zr[0] && zn <= zr[1]
                    ? `Rated for zones ${zr[0]}-${zr[1]}; your zone ${zl} sits inside the range.${est}`
                    : `Rated for zones ${zr[0]}-${zr[1]} - your zone ${zl} falls outside it, so overwintering is a real risk.${est}` });
        }
    }
    const night = site.summer_night_tmin_c ?? null;
    const nightMax = typeof sp.night_temp_max_c === "number" ? sp.night_temp_max_c : null;
    if (night != null && nightMax != null && night > nightMax) {
        rows.push({ key: "heat", label: "", date: null,
            note: `Heads up: your typical summer nights run warmer than ${label} sets fruit in - midsummer may pause it. Plant for spring and fall shoulders.` });
    }
    if (needsInsects(sp)) {
        rows.push({ key: "insect-vector", label: "", date: null,
            note: `${label} cannot pollinate itself - an insect has to carry pollen from its male flowers `
                + `to its female ones. Worth planning something that flowers alongside it.` });
    }
    {
        const strongest = strongestSupportRequirement(sp);
        const word = VALUE_WORD["support.requires"][strongest];
        if (word) {
            const varies = strongest !== String(sp.support?.requires ?? "none");
            rows.push({ key: "support", label: "", date: null,
                note: `${word.replace(/^Needs/, `${label} needs`).replace(/^Better/, `${label} is better`)}`
                    + `${varies ? " (depends on the variety - bush types stand on their own)" : ""}`
                    + `, set at planting time.` });
        }
    }
    if (ff) {
        rows.push({ key: "freeze", label: "Season ends (first fall freeze, typical year)", date: nextOccurrence(ff, todayIso), note: null });
        tasks.push({ date: nextOccurrence(ff, todayIso), kind: "log_first_freeze", species: null, cat: "frost",
            text: `First fall freeze (median) - the season's end for tender crops.` });
    }
    if (!fallSown && model === "dtm" && setOutMmdd && ff) {
        const year = todayIso.slice(0, 4);
        const windowPassed = `${year}-${setOutMmdd}` < todayIso;
        const freezeThisYear = `${year}-${ff}`;
        const seasonRunning = todayIso <= freezeThisYear;
        const daysTo = (aIso, bIso) => {
            const p = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))).getTime();
            return Math.round((p(bIso) - p(aIso)) / 86400000);
        };
        if (windowPassed && seasonRunning) {
            const daysLeft = daysTo(todayIso, freezeThisYear);
            const dtm = resolveDtm(sp, null);
            const MARGIN = 7;
            if (dtm && dtm[0] + MARGIN <= daysLeft) {
                const how = wk ? "from a started plant you can buy now" : "sown now";
                rows.push({ key: "still-fits", label: "", date: null,
                    note: `Missed spring? ${label} still fits: about ${daysLeft} frost-free days remain and it needs ~${dtm[0]}, ${how}. The dates above are next spring's.` });
                tasks.push({ date: todayIso, kind: "cool_season", species: sid, cat: "sow",
                    text: `${wk ? "Plant" : "Sow"} ${label} now - it can still mature (~${dtm[0]} days) before your typical first freeze (~${monthDay(ff)}).` });
            }
            else if (dtm) {
                const fits = bundle.species
                    .map((s) => s)
                    .filter((s) => s.scheduling_model === "dtm" && s.sow_season !== "fall" && s.id !== sid)
                    .map((s) => ({ id: s.id, dtm: resolveDtm(s, null) }))
                    .filter((x) => !!x.dtm && x.dtm[0] + MARGIN <= daysLeft)
                    .sort((a, b) => a.dtm[0] - b.dtm[0])
                    .slice(0, 4);
                const alts = fits.map((f) => commonName(bundle, f.id) || humanize(f.id)).join(", ");
                rows.push({ key: "still-fits-no", label: "", date: null,
                    note: `Missed spring? Honest answer: planted now, ${label} likely won't beat your first freeze - it needs ~${dtm[0]} days and about ${daysLeft} remain. The dates above are next spring's.`
                        + (alts ? ` Still fits today: ${alts}.` : " The season is past new sowings.") });
            }
        }
    }
    const bits = [];
    if (wk)
        bits.push(`the indoor start is ${label}'s own ${wk}-week lead before your median last frost`);
    if (tol === "tender" || tol == null)
        bits.push("set-out waits for frost to pass because it is frost-tender");
    if (tol === "hardy" || tol === "half_hardy")
        bits.push("it is cold-hardy enough to go in ahead of the last frost");
    return { species: sid, rows, tasks,
        explain: bits.length ? `Your dates, not a seed packet's: ${bits.join("; ")}.` : "Your dates come from your resolved climate, not a seed packet." };
}
export function cropTeams(sid, bundle) {
    const carries = (g) => {
        const members = (g.members ?? []);
        if (members.some((m) => m.species === sid))
            return true;
        return (g.roles ?? []).some((r) => r.canonical === sid);
    };
    return bundle.guilds.filter(carries);
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
};
const QUICK = ["solanum_lycopersicum", "capsicum_annuum", "allium_sativum", "cucurbita_pepo", "lactuca_sativa", "ocimum_basilicum"];
const fmtDate = (iso, todayIso) => {
    const md = monthDay(iso.slice(5));
    return iso.slice(0, 4) === todayIso.slice(0, 4) ? md : `${md}, ${iso.slice(0, 4)}`;
};
const glossFirstMedianIn = (host) => {
    const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        if (node.parentElement?.closest(".glossterm"))
            continue;
        const m = /\bmedian\b/i.exec(node.nodeValue ?? "");
        if (!m)
            continue;
        const word = node.splitText(m.index);
        word.splitText(m[0].length);
        word.parentNode?.replaceChild(glossTerm("median", word.nodeValue ?? "median"), word);
        return;
    }
};
export function cropFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("crop");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}
export function zipFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("zip");
    if (!raw)
        return null;
    const z = raw.trim();
    return /^\d{5}$/.test(z) ? z : null;
}
export function guildFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("guild");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}
function nameList(host, items) {
    items.forEach((it, i) => {
        if (i)
            host.appendChild(document.createTextNode(" · "));
        host.appendChild(plantLink(it.label, it.id));
    });
}
export const SITUATION_GUIDE = {
    containers: { slug: "container-vegetable-gardening", label: "Growing vegetables in containers" },
    earlystart: { slug: "read-a-planting-calendar", label: "How to read a planting calendar" },
    midseason: { slug: "succession-planting", label: "Succession planting" },
    shade: { slug: "where-to-put-a-garden", label: "Where to put a garden - sun and shade" },
    clay: { slug: "build-a-raised-bed", label: "How to build a raised bed" },
};
export function initAnswers(bundle, hooks) {
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
        btn.textContent = "change";
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
    const renderClimateCard = () => {
        if (state.lat == null || state.lon == null) {
            climCard.hidden = true;
            renderCrop();
            return;
        }
        const a = climateAnswer(state.lat, state.lon, bundle);
        if (!a) {
            climCard.hidden = false;
            climCard.innerHTML = "";
            const p = document.createElement("p");
            p.className = "ans-noresolve";
            p.textContent = "We can't resolve a climate for that point - the resolver refuses rather than guesses. Try a nearby ZIP.";
            climCard.append(p);
            renderCrop();
            return;
        }
        countRung("rung-loc");
        climCard.hidden = false;
        climCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `Your climate - ZIP ${state.zip ?? ""}`;
        climCard.append(h);
        if (a.lastP50) {
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = `Last spring frost: usually around ${monthDay(a.lastP50)}`;
            climCard.append(big);
        }
        const row = (label, value) => {
            const div = document.createElement("div");
            div.className = "ans-row";
            const l = document.createElement("span");
            l.textContent = label;
            const v = document.createElement("span");
            v.textContent = value;
            div.append(l, v);
            climCard.append(div);
        };
        if (a.lastP10)
            row("A safe bet (1 year in 10 still frosts)", `after ${monthDay(a.lastP10)}`);
        if (a.firstFreeze)
            row("First fall freeze, typical year", monthDay(a.firstFreeze));
        if (a.seasonDays != null)
            row("Growing season", `about ${a.seasonDays} days`);
        if (a.zoneLabel)
            row("Hardiness zone (perennials)", a.zoneLabel);
        editing.zip = false;
        setReceipt("zip", `${state.zip ?? "Located"} - ${a.zoneLabel ? `zone ${a.zoneLabel.replace(/^zone\s*/i, "")}` : "located"}`
            + (a.lastP50 ? `, last frost ${monthDay(a.lastP50)}` : ""));
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        const word = confidenceWord(a.grade) ?? a.grade;
        prov.textContent = a.stationName
            ? `From NOAA weather station ${a.stationName}${a.distanceKm > 2 ? `, ~${Math.round(a.distanceKm)} km away` : ""} - ${word}. Odds from 30 years of records, not promises.`
            : `${a.caveat} ${word}.`;
        mark(prov, { kind: "rule", id: "R-090" });
        climCard.append(prov);
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
    const renderSituation = (arriving = false) => {
        const host = document.getElementById("anssituation");
        if (!host)
            return;
        const sit = situationFromHash(location.hash);
        host.hidden = !sit;
        host.innerHTML = "";
        if (!sit)
            return;
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
            const fits = containerCrops(bundle.species, span, 14);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = `Fits a pot up to ${span} cm across`;
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, fits.map((f) => ({ id: f.id, label: f.name })));
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Computed from each plant's own mature spread and root depth against the container "
                + "rule's pot size - not a list of what usually gets recommended. Deep-rooted crops and anything "
                + "needing a pollination block are left out, and the reason is the plant's own record.";
            mark(prov, { kind: "rule", id: "R-098" });
            card.append(k, big, prov);
        }
        else if (sit.id === "midseason") {
            const quick = quickCrops(bundle.species, 10);
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Fastest to finish";
            const big = document.createElement("p");
            big.className = "ans-big";
            quick.forEach((c, i) => {
                if (i)
                    big.appendChild(document.createTextNode(" · "));
                big.appendChild(plantLink(c.name, c.id));
                big.appendChild(document.createTextNode(` ${c.days}d`));
            });
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Days to maturity from the corpus, soonest first.";
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = "Give a ZIP below and the dates say which of these still beat your own first freeze - "
                + "a crop that cannot finish is told so plainly rather than quietly recommended.";
            mark(prov2, { kind: "rule", id: "R-032" });
            card.append(k, big, prov, prov2);
        }
        else if (sit.id === "earlystart") {
            const r096 = bundle.rules.find((r) => r.id === "R-096");
            const off = r096?.offset_days_before_last_frost ?? { hardy: 21, half_hardy: 14 };
            const hardy = bundle.species
                .filter((sp) => sp.frost_tolerance === "hardy" && String(sp.category ?? "") !== "cover_crop"
                && String(sp.category ?? "") !== "flower" && String(sp.lifespan ?? "") === "annual")
                .map((sp) => ({ id: String(sp.id), label: sp.common?.[0] ?? "" }))
                .filter((x) => !!x.label).sort((a, b) => a.label.localeCompare(b.label));
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = `Out about ${off.hardy ?? 21} days before your last frost`;
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, hardy);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = `These are the hardy annuals: roughly ${off.hardy ?? 21} days before the last `
                + `frost for hardy crops, ${off.half_hardy ?? 14} for half-hardy.`;
            mark(prov, { kind: "rule", id: "R-096" });
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = "Tender crops wait for the frost itself - the calendar dates each one against your own ZIP "
                + "rather than a packet's guess.";
            mark(prov2, { kind: "rule", id: "R-031" });
            card.append(k, big, prov, prov2);
        }
        else if (sit.id === "shade") {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Shade is a gate, not a preference";
            const shade = bundle.species
                .filter((sp) => sp.light_min === "shade" || sp.light_min === "part_sun")
                .map((sp) => ({ id: String(sp.id), label: sp.common?.[0] ?? "" }))
                .filter((x) => !!x.label).sort((a, b) => a.label.localeCompare(b.label));
            const big = document.createElement("p");
            big.className = "ans-big";
            nameList(big, shade);
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "These tolerate part sun or less, by their own light requirement. The planner "
                + "refuses to place a full-sun plant in ground you have marked shaded.";
            mark(prov, { kind: "rule", id: "R-005" });
            const prov2 = document.createElement("p");
            prov2.className = "ans-prov";
            prov2.textContent = "It also computes the shadow a taller neighbour casts rather than leaving you to guess.";
            mark(prov2, { kind: "rule", id: "R-004" });
            card.append(k, big, prov, prov2);
        }
        else {
            const k = document.createElement("p");
            k.className = "ans-k";
            k.textContent = "Heavy clay";
            const big = document.createElement("p");
            big.className = "ans-big";
            big.textContent = "Do not add sand.";
            const prov = document.createElement("p");
            prov.className = "ans-prov";
            prov.textContent = "Sand plus clay is the one \"fix\" that reliably makes things worse - the mixture "
                + "sets harder than what you started with. Organic matter is the answer, and standing water after "
                + "rain is a site problem to solve before planting into it.";
            mark(prov, { kind: "rule", id: "R-100" });
            const link = document.createElement("a");
            link.className = "ans-more";
            link.href = "#/why?belief=B-015";
            link.textContent = "See the evidence on sand and clay →";
            markLink(link, { kind: "belief", id: "B-015" });
            card.append(k, big, prov, link);
        }
        const g = SITUATION_GUIDE[sit.id];
        if (g) {
            const gl = document.createElement("a");
            gl.className = "ans-more ans-guide";
            gl.href = `../guides/${g.slug}/`;
            gl.textContent = `${g.label} →`;
            card.append(gl);
        }
    };
    const renderTeams = () => {
        teamsCard.hidden = false;
        teamsCard.innerHTML = "";
        if (!state.crop) {
            const h = document.createElement("p");
            h.className = "ans-k";
            h.textContent = "The kinds of team we can defend";
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
                    w.textContent = ` - ${t.mechanism}`;
                    row.append(w);
                }
                teamsCard.append(row);
            }
            const prov0 = document.createElement("p");
            prov0.className = "ans-prov";
            prov0.textContent = `${answer.more} more, sized to the bed you have. Name a crop above and this narrows to `
                + "the teams that carry it. There is no companion-planting chart here - most of those trace to folklore, "
                + "and every team above names the mechanism it rests on.";
            teamsCard.append(prov0);
            return;
        }
        const teams = cropTeams(state.crop, bundle);
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `${cropLabel(state.crop)}'s teams`;
        teamsCard.append(h);
        const more = document.createElement("p");
        more.className = "ans-more";
        const ma = document.createElement("a");
        ma.href = plantHref(state.crop);
        ma.textContent = `Everything recorded about ${cropLabel(state.crop).toLowerCase()}`;
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
            none.textContent = `None of the curated teams carries ${cropLabel(state.crop)} yet.`;
            teamsCard.append(none);
        }
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = "These are the teams the engine can defend - each pairing names its mechanism and its sources. "
            + "There is no companion-planting chart here, and that is deliberate: most of those charts trace to folklore.";
        teamsCard.append(prov);
    };
    const renderCrop = () => {
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
            nextRow.hidden = !state.crop && state.lat == null;
            return;
        }
        const t = todayIso();
        const a = cropAnswer(state.crop, state.lat, state.lon, t, bundle);
        if (!a) {
            datesCard.hidden = true;
            icsRow.hidden = true;
            return;
        }
        countRung("rung-crop");
        datesCard.hidden = false;
        if (!editing.zip)
            climCard.hidden = true;
        requestAnimationFrame(() => requestAnimationFrame(() => revealIfOffscreen(datesCard)));
        datesCard.innerHTML = "";
        const h = document.createElement("p");
        h.className = "ans-k";
        h.textContent = `${cropLabel(state.crop)} in ${state.zip ?? "your ZIP"}`;
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
        let first = true;
        for (const r of a.rows) {
            if (r.note !== null) {
                const p = document.createElement("p");
                p.className = "ans-note";
                p.textContent = r.note;
                datesCard.append(p);
            }
            else if (first && r.date) {
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
        const prov = document.createElement("p");
        prov.className = "ans-prov";
        prov.textContent = a.explain;
        datesCard.append(prov);
        glossFirstMedianIn(datesCard);
        icsRow.hidden = a.tasks.length === 0;
        nextRow.hidden = false;
    };
    const applyZip = (raw) => {
        const five = /^\d{5}/.test(raw.trim());
        if (five)
            app.ensureZipData?.(null, null, raw);
        const hit = zipToLatLon(raw, bundle.zip_index?.zips ?? null);
        if (hit) {
            state.zip = raw.trim();
            state.lat = hit.lat;
            state.lon = hit.lon;
            saveState(state);
            app.ensureZipData?.(hit.lat, hit.lon);
            hint.textContent = "";
            renderClimateCard();
        }
        else if (five) {
            const z3 = raw.trim().slice(0, 3);
            const loaded = Object.keys(bundle.zip_index?.zips ?? {}).some((z) => z.startsWith(z3));
            hint.textContent = loaded
                ? "We don't have that ZIP (some are PO-box only) - try a neighboring one."
                : "Still loading the ZIP table - give it a second and type again.";
        }
        else {
            hint.textContent = "";
        }
    };
    zipEl.addEventListener("input", () => applyZip(zipEl.value));
    for (const sid of QUICK) {
        if (!bundle.species.some((s) => s.id === sid))
            continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ans-chip";
        b.dataset.sid = sid;
        b.textContent = cropLabel(sid);
        b.addEventListener("click", () => { state.crop = sid; saveState(state); renderCrop(); });
        chipsEl.append(b);
    }
    const renderFilter = () => {
        const q = filterEl.value.trim().toLowerCase();
        filterList.innerHTML = "";
        if (q.length < 2)
            return;
        const hits = bundle.species.filter((s) => {
            const common = Array.isArray(s.common) ? s.common.join(" ") : String(s.common ?? "");
            return `${common} ${s.id}`.toLowerCase().includes(q);
        }).slice(0, 12);
        for (const s of hits) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ans-chip";
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
        const a = cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle);
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
    const applyHashCrop = () => {
        const want = cropFromHash(location.hash);
        if (!want)
            return false;
        if (!bundle.species.some((s) => s.id === want)) {
            cropHint.textContent = `That link asked for a crop we don't carry (${want}). Pick one below and the dates still work.`;
            return false;
        }
        cropHint.textContent = "";
        if (state.crop !== want) {
            state.crop = want;
            saveState(state);
        }
        renderCrop();
        return true;
    };
    const focusForDoor = () => {
        const zipped = applyHashZip();
        const carried = applyHashCrop();
        if (zipped && !carried) {
            filterEl.focus();
            return;
        }
        if (!carried && location.hash.includes("teams"))
            filterEl.focus();
        else
            zipEl.focus();
    };
    window.addEventListener("hashchange", () => {
        if (!location.hash.startsWith("#/answers"))
            return;
        renderSituation();
        renderSituationRow();
        if (situationFromHash(location.hash))
            return;
        focusForDoor();
    });
    app.answersTasks = () => {
        if (!state.crop || state.lat == null || state.lon == null)
            return [];
        return cropAnswer(state.crop, state.lat, state.lon, todayIso(), bundle)?.tasks ?? [];
    };
    if (state.zip)
        zipEl.value = state.zip;
    renderClimateCard();
    renderCrop();
    renderSituation(true);
    renderSituationRow();
    applyHashZip();
    applyHashCrop();
    return () => {
        if (zipEl.value.trim() && (state.lat == null || state.lon == null))
            applyZip(zipEl.value);
        else
            renderClimateCard();
    };
}
