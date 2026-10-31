import './chunk-lutet8cz.js';
import { app, $, TODAY_ISO, remindersOn, plural, remindChoice, setRemindChoice, weekdayLong, setNotifyCadence, setNotifyWeekday, num, glossTerm, gardensNow, yearViewMonths, oneWarmWindow, tasksForYear, comingTasksForYear, isSignedIn, weekTaskPool, weekJobs, kickGardensLoad, commonName, prettyIso, freezeWord, monthDay, taskSentence, notifyWeekday, notifyCadence, daysBetween, currentGardenCtx, scheduleClimate, resolveZone, frostCalibration, renderClimate, undatedPlan, unfitPlan, isExamplePlot, MONTHS, monthRain, monthDryOnly, fmtRain, monthLong, el, weekdayShort, iso, category, groupAgenda, gardenFrost, MIN_SEASONS, taskWindow, stillTime, fmtMonthDayYear, isWindowEnd, lateSentence, openSeason, plantHref, plantingLabel, ruleClaim, markLink, isTeamPlantJob, isDone, canSetAside, isFutureDate, fileObservation, addPlanting, updatePlanting, endPlanting, addFailure, addPlantingNote, toast, frostNotedLine, heatNotedLine, plantEntryLine, setJobAside, jobKey, setOutRipen, seasonId, parseRegion, regionCentroid, regionPoints, celebrate, plantedLine, intersectArea, bedHasSections, frostSeverityLabel, OBSERVATION_SEVERITIES, endCauseLabel, END_CAUSES, failureSeverityLabel, FAILURE_SEVERITIES, dropStaleGardens, onGardensLoaded } from './core.js';
export { actSentence, allGardenSeasons, gardenWideTasks, isOwed, resolveDtm, weekSummary } from './core.js';
import { disableReminders, enableReminders, refreshReminders, remindersSupported } from './chunk-hdo2bedi.js';
import { icsAlarms, buildNotices, phonePlan, weekGlance } from './chunk-kbdsyvxe.js';
import { copy, fillNodes, humanize, fillCopy } from './paint.js';
import { undatedLines } from './chunk-or4xtote.js';
import { dayHeading } from './chunk-nhqolnsd.js';
import { unfitLine } from './chunk-nmt4lyi1.js';
import { shareOrDownloadIcs, tasksToIcs } from './chunk-ezosgnab.js';
import './chunk-l5cseoso.js';
import './chunk-iac2um9b.js';

function successionWhy(bundle, t) {
    const name = t.species ? (commonName(bundle, t.species) || humanize(t.species)) : copy.clThisCrop;
    const cadence = t.cadence ?? t.text?.match(/re-sow every ([^ ]+(?: days)?)/)?.[1];
    const from = t.anchor === "logged" ? copy.clFromLogged : t.guildName ? fillCopy("clFromTeamPlan", { team: t.guildName }) : copy.clFromPlan;
    const counted = cadence ? fillCopy("clSuccWhy", { from, crop: name, cadence }) : fillCopy("clSuccWhyPlain", { from, crop: name });
    const bound = t.closeBy && t.closeFreeze && t.dtmMin != null
        ? fillCopy(t.closeLine ? "clSuccBoundHard" : t.closeOdds || t.closeAfter ? "clSuccBoundLate" : "clSuccBound", { freeze: t.closeOdds || t.closeAfter ? freezeWord(t) : monthDay(t.closeFreeze), crop: name, days: t.dtmMin, date: prettyIso(t.closeBy) })
        : t.closeBy && t.warmNext ? fillCopy("clSuccBoundWarm", { crop: name, date: prettyIso(t.closeBy) })
            : copy.clSuccBoundPlain;
    return `${counted} ${bound}`;
}
let calYear = new Date().getFullYear();
let calLat = null;
let calMonth = new Date().getMonth();
let calView = "month";
let calViewChosen = false;
let calSelDay = null;
let calSelBed = null;
let calSelGarden = undefined;
let calSelFor = null;
function bedsWithTasks(all) {
    return [...new Set(all.map((t) => t.bed).filter((b) => !!b))].sort();
}
const inBedFocus = (t) => !calSelBed || !t.bed || t.bed === calSelBed;
function filterByBed(all) {
    if (!calSelBed)
        return all;
    return all.filter(inBedFocus);
}
function tasksInMonth(all, y, m) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    return all.filter((t) => t.date.slice(0, 7) === key);
}
function renderMonthGrid(all) {
    {
        const lab = $("calmlabel");
        lab.replaceChildren();
        const orn = document.createElementNS(SVG_NS, "svg");
        orn.setAttribute("class", "sprig-orn calm-orn");
        orn.setAttribute("viewBox", "0 0 24 24");
        orn.setAttribute("aria-hidden", "true");
        const ornUse = document.createElementNS(SVG_NS, "use");
        ornUse.setAttribute("href", "#sprig");
        orn.appendChild(ornUse);
        const mon = document.createElement("span");
        mon.className = "calm-mon";
        mon.textContent = MONTHS[calMonth];
        const yr = document.createElement("span");
        yr.className = "calm-yr";
        yr.textContent = String(calYear);
        lab.append(orn, mon, document.createTextNode(" "), yr);
    }
    const band = document.getElementById("calmonthband");
    if (band) {
        band.replaceChildren();
        for (let m = 0; m < 12; m++) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip calmchip" + (m === calMonth ? " on" : "");
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", m === calMonth ? "true" : "false");
            chip.textContent = MONTHS[m].slice(0, 3);
            chip.addEventListener("click", () => { calMonth = m; calViewChosen = true; renderCalendar(currentBundle); });
            band.appendChild(chip);
        }
        requestAnimationFrame(() => {
            const on = band.children[calMonth];
            if (on && band.scrollWidth > band.clientWidth) {
                const chips = [...band.children];
                const rel = (c) => c.offsetLeft - chips[0].offsetLeft;
                const want = rel(on) - band.clientWidth / 2 + on.offsetWidth / 2;
                const firstWhole = chips.find((c) => rel(c) >= want) ?? on;
                band.scrollLeft = Math.max(0, rel(firstWhole));
            }
        });
    }
    {
        const line = document.getElementById("calmrain");
        const r = currentBundle ? monthRain(currentBundle, calYear, calMonth, inBedFocus) : null;
        const dryNeed = !r && currentBundle ? monthDryOnly(currentBundle, calYear, calMonth, inBedFocus) : null;
        if (line) {
            line.hidden = !r && dryNeed == null;
            line.textContent = r ? fillCopy("clMonthRain", { month: monthLong(calMonth), rain: fmtRain(r.rain_mm), need: fmtRain(r.need_mm) })
                + (r.all_yours ? ` ${copy.clMonthRainAllYours}` : "")
                : dryNeed != null ? fillCopy("clMonthDryOnly", { month: monthLong(calMonth), need: fmtRain(dryNeed) }) : "";
        }
    }
    const dow = document.getElementById("caldow");
    if (dow && !dow.childElementCount)
        for (let i = 0; i < 7; i++)
            el(dow, "span", "", weekdayShort(i));
    const grid = $("calgrid");
    grid.replaceChildren();
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    const cells = [];
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = 0; i < first; i++)
        cells.push({ out: true, d: prevDays - first + 1 + i });
    for (let d = 1; d <= days; d++)
        cells.push({ out: false, d });
    while (cells.length % 7)
        cells.push({ out: true, d: cells.length - first - days + 1 });
    for (const c of cells) {
        const el = document.createElement(c.out ? "div" : "button");
        el.className = "calcell" + (c.out ? " out" : "");
        const dd = document.createElement("span");
        dd.className = "cd";
        dd.textContent = String(c.d);
        el.appendChild(dd);
        if (!c.out) {
            const day = iso(calYear, calMonth, c.d);
            if (day === todayIso)
                el.classList.add("today");
            if (day === calSelDay)
                el.classList.add("sel");
            const ts = all.filter((t) => t.date === day);
            if (ts.length) {
                el.classList.add("has");
                const dots = document.createElement("div");
                dots.className = "cdots";
                for (const cat of [...new Set(ts.map((t) => category(t)))]) {
                    const happened = ts.some((t) => category(t) === cat && t.kind === "logged");
                    const i = document.createElement("i");
                    i.className = `cdot ct-${cat} ${happened ? "is-logged" : "is-planned"}`;
                    dots.appendChild(i);
                }
                el.appendChild(dots);
            }
            el.addEventListener("click", () => {
                calSelDay = calSelDay === day ? null : day;
                renderCalendar(currentBundle);
            });
        }
        grid.appendChild(el);
    }
}
function freshRegion(fresh) {
    const spot = app.plannedSpotFor?.(fresh.bed, fresh.species) ?? null;
    if (spot) {
        const side = Math.max(0.2, spot.r * 2);
        return { shape: "rect", x: spot.x - side / 2, y: spot.y - side / 2, w: side, h: side };
    }
    const bed = app.logSnapshot.beds.find((b) => b.name === fresh.bed);
    if (!bed)
        throw new Error(copy.clBedGone);
    const [cx, cy] = regionCentroid(parseRegion(bed.region));
    return { shape: "rect", x: cx - 0.15, y: cy - 0.15, w: 0.3, h: 0.3 };
}
function didIt(t, bundle, card, btn, armed) {
    const today = TODAY_ISO();
    const open = (p) => {
        const slot = document.getElementById(logSlotId());
        if (slot)
            card.after(slot);
        calFormOpener?.setAttribute("aria-expanded", "false");
        calFormOpener = btn;
        btn.setAttribute("aria-expanded", "true");
        calFormOpen?.({ ...p, title: t.text ?? taskSentence(t, bundle) });
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        slot?.scrollIntoView({ behavior, block: "nearest" });
    };
    const season = openSeason();
    const live = (idx) => !season?.plantings?.[idx]?.end_cause;
    const onBed = openPlantings(bundle).filter((pp) => live(pp.idx) && (!t.bed || pp.bed === t.bed));
    const target = t.species ? onBed.find((pp) => pp.species === t.species) ?? null : null;
    if (t.kind === "harvest_open") {
        if (!target) {
            toast(fillCopy("clNoCropInLog", { crop: commonName(bundle, t.species), bed: t.bed ?? copy.clThatBed }));
            return;
        }
        const p = season?.plantings?.[target.idx];
        const endCard = isWindowEnd(t);
        open({ kind: p?.first_harvest || endCard ? "last_harvest" : "first_harvest", plantIdx: target.idx, date: today });
        return;
    }
    if (t.kind === "succession" || t.kind === "autumn" || t.kind === "cool_season" || t.kind === "warm_set_out" || t.kind === "warm_window" || t.kind === "start_indoors" || t.kind === "sow_climber") {
        const win = taskWindow(t, bundle, today);
        const setOut = (t.kind === "start_indoors" && win?.state === "closed" && setOutRipen(t, today) != null)
            || ((t.kind === "warm_set_out" || t.kind === "warm_window") && !!t.species && Number(bundle.species.find((s) => s.id === t.species)?.start_indoors_weeks) > 0)
            || t.rule === "R-187";
        const targetRec = target ? season?.plantings?.[target.idx] : undefined;
        const wouldOverwrite = !!targetRec && (setOut ? !!targetRec.transplanted : !!targetRec.sown);
        if (target && t.kind !== "succession" && t.kind !== "autumn" && !wouldOverwrite) {
            open({ kind: setOut ? "transplanted" : "sowed", plantIdx: target.idx, date: today });
            return;
        }
        if (t.species && t.bed) {
            const spot = app.plannedSpotFor?.(t.bed, t.species) ?? null;
            open({ kind: setOut ? "transplanted" : "sowed", newPlanting: { species: t.species, group: spot?.group ?? null, bed: t.bed, setOut }, date: today });
            return;
        }
        toast(copy.clSowingNoBed);
        return;
    }
    if (t.kind === "care") {
        const on = target ?? onBed[0] ?? null;
        if (on) {
            open({ kind: "note", plantIdx: on.idx, noteText: t.careNote ?? copy.clDoneNote, date: today });
            return;
        }
        if (t.bed)
            app.openLogBed?.(t.bed);
        else
            toast(copy.clNoteItInLog);
        return;
    }
    if (t.kind === "install_support") {
        const any = onBed[0] ?? null;
        if (any) {
            open({ kind: "note", plantIdx: any.idx, noteText: t.species ? fillCopy("clSupportInCrop", { crop: commonName(bundle, t.species) }) : copy.clSupportIn, date: today });
            return;
        }
        if (t.bed)
            app.openLogBed?.(t.bed);
        else
            toast(copy.clNoteSupportInLog);
        return;
    }
    if (t.kind === "log_first_freeze" || category(t) === "frost") {
        open({ kind: "frost", date: today });
        return;
    }
    if (isTeamPlantJob(t.kind)) {
        const hook = app.markBedPlantedFromPlan;
        if (!hook || !t.bed) {
            toast(copy.clStillLoading);
            return;
        }
        let callout = card.querySelector(".tcallout");
        if (!callout) {
            callout = document.createElement("p");
            callout.className = "tcallout";
            card.appendChild(callout);
        }
        if (!armed.confirmed) {
            armed.confirmed = true;
            const bedName = t.bed;
            const say = (n) => {
                callout.textContent = n != null ? plural("clPlantTeamAsk", n, { bed: bedName }) : fillCopy("clPlantTeamAsk", { bed: bedName });
            };
            say(null);
            void app.planReceipt?.(bedName).then((r) => { if (r && r.sized)
                say(r.plants); });
            return;
        }
        const plant = async (opts) => {
            btn.disabled = true;
            const r = await hook(t.bed, opts);
            if (r.ok) {
                celebrate(plantedLine(Number(t.date.slice(0, 4)), null, t.bed));
                await app.logRefresh?.();
                renderCalendar(bundle);
                return;
            }
            btn.disabled = false;
            if (r.canAdvanceTo != null) {
                const yr = r.canAdvanceTo;
                callout.replaceChildren(document.createTextNode(`${r.reason ?? ""} `));
                const adv = document.createElement("button");
                adv.type = "button";
                adv.className = "btn btn-secondary tdid";
                adv.textContent = fillCopy("clStartSeasonPlant", { year: yr });
                adv.addEventListener("click", () => void plant({ advance: true }));
                callout.appendChild(adv);
                return;
            }
            if (r.nudge) {
                armed.force = true;
                callout.textContent = fillCopy("clPlantAnyway", { nudge: r.nudge });
                return;
            }
            toast(r.reason ?? copy.clCouldNotPlant);
        };
        void plant(armed.force ? { force: true } : undefined);
        return;
    }
    toast(copy.clLogFromLogTab);
}
async function setAside(t, aside, bundle, btn) {
    const db = app.logDb;
    if (!db || t.season == null)
        return;
    btn.disabled = true;
    try {
        await setJobAside(db, app.currentPlotId, t.season, jobKey(t), aside);
    }
    catch (e) {
        btn.disabled = false;
        toast(e instanceof Error ? e.message : String(e));
        return;
    }
    toast(aside ? copy.clSetAsideToast : copy.clBroughtBack);
    await app.logRefresh?.();
    renderCalendar(bundle);
}
const LATE_OPEN = 3, STILL_OPEN = 5;
function uncoveredLine(bundle) {
    const lat = num("lat"), lon = num("lon");
    if (undatedSaysUncovered)
        return null;
    if (lat == null || lon == null || !app.climateSettled?.(lat, lon))
        return null;
    const fr = gardenFrost(bundle, lat, lon, app.logSnapshot.seasons);
    return fr.clim || fr.lastFrost || fr.firstFreeze ? null : fillCopy("clUncovered", { n: MIN_SEASONS });
}
let undatedSaysUncovered = false;
function renderUndated(bundle, chosen) {
    const el = document.getElementById("calundated");
    undatedSaysUncovered = false;
    if (!el)
        return;
    const lines = [];
    for (const g of chosen) {
        const u = undatedPlan(bundle, g);
        const said = undatedLines(u);
        if (!said.length)
            continue;
        if (u.place === "nosite")
            undatedSaysUncovered = true;
        lines.push(chosen.length > 1 ? `${g.name} - ${said.join(" ")}` : said.join(" "));
    }
    el.textContent = lines.join(" ");
    el.hidden = !lines.length;
}
function renderUnfit(bundle, chosen) {
    const el = document.getElementById("calunfit");
    if (!el)
        return;
    const lines = chosen.flatMap((g) => unfitPlan(bundle, g).map((u) => (chosen.length > 1 ? `${g.name} - ${unfitLine(u)}` : unfitLine(u))));
    el.replaceChildren(...lines.map((l) => Object.assign(document.createElement("span"), { textContent: `${l} ` })));
    if (lines.length)
        el.append(Object.assign(document.createElement("a"), { href: "#/plan", className: "calunfit-go", textContent: copy.hnOpenPlan }));
    el.hidden = !lines.length;
}
function renderGlance(all, bundle, todayIso) {
    const box = document.getElementById("calwkglance");
    const list = document.getElementById("calwkglancelist");
    if (!box || !list)
        return;
    const g = weekGlance(all, { today: todayIso, sentence: (t) => taskSentence(t, bundle), name: (sid) => commonName(bundle, sid) });
    list.replaceChildren(...g.lines.map((l) => {
        const li = document.createElement("li");
        li.className = `glance-${l.kind}`;
        li.textContent = l.text;
        return li;
    }), ...(g.more ? [Object.assign(document.createElement("li"), { className: "glance-more", textContent: plural("nwMore", g.more) })] : []));
    box.hidden = !g.lines.length;
}
function renderWeek(all, bundle, todayIso) {
    const panel = $("calweek");
    homeLogSlot();
    panel.replaceChildren();
    const jobs = weekJobs(all, todayIso);
    const n = jobs.due, c = jobs.closed, l = jobs.overdue, r = jobs.still;
    const closedTail = c ? plural("clWkClosedTail", c) : "";
    $("calwktitle").textContent = n
        ? plural("clWkTodo", n, { tail: (l ? plural("clWkOverdueTail", l) : "") + closedTail })
        : l ? fillCopy("clWkLate", { n: l, tail: closedTail })
            : c ? plural("clWkClosed", c)
                : copy.clWk;
    renderGlance(all, bundle, todayIso);
    const multiGarden = new Set(all.map((t) => t.plotId ?? "")).size > 1;
    const picks = pickCache(bundle);
    const reopenFold = () => {
        if (!jobs.between.length)
            return;
        const sec = document.createElement("section");
        sec.className = "calwkgroup reopen";
        const f = document.createElement("details");
        f.className = "calwkmore";
        const sum = document.createElement("summary");
        sum.textContent = plural("clWkReopenFold", jobs.between.length);
        f.append(sum, ...jobs.between.map((t) => taskCard(t, all, bundle, picks, multiGarden, daysBetween(t.date, todayIso))));
        sec.appendChild(f);
        panel.appendChild(sec);
    };
    if (!n && !jobs.late.length && !jobs.done.length) {
        const lat = num("lat"), lon = num("lon");
        const cold = lat == null || lon == null;
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = cold
            ? copy.clNoLocation
            : uncoveredLine(bundle) ?? copy.clWkNothing;
        panel.appendChild(p);
        reopenFold();
        return;
    }
    const group = (heading, cls, cards) => {
        const sec = document.createElement("section");
        sec.className = `calwkgroup ${cls}`;
        const h = document.createElement("h3");
        h.className = "calwkday";
        h.textContent = heading;
        sec.append(h, ...cards);
        panel.appendChild(sec);
    };
    const cardsOf = (ts) => ts.map((t) => taskCard(t, all, bundle, picks, multiGarden, daysBetween(t.date, todayIso)));
    const fold = (summary, cards) => {
        const more = document.createElement("details");
        more.className = "calwkmore";
        const sum = document.createElement("summary");
        sum.textContent = summary;
        more.append(sum, ...cards);
        return more;
    };
    if (l) {
        const cards = cardsOf(jobs.late.slice(0, l));
        group(copy.clLateGroup, "late", cards.slice(0, LATE_OPEN));
        if (cards.length > LATE_OPEN)
            panel.lastElementChild?.appendChild(fold(fillCopy("clMoreLate", { n: cards.length - LATE_OPEN }), cards.slice(LATE_OPEN)));
    }
    if (r) {
        const cards = cardsOf(jobs.late.slice(l, l + r));
        const open = cards.length > STILL_OPEN + 2 ? STILL_OPEN : cards.length;
        group(copy.clStillTimeGroup, "still", cards.slice(0, open));
        if (open < cards.length)
            panel.lastElementChild?.appendChild(fold(fillCopy("clMoreStill", { n: cards.length - open }), cards.slice(open)));
    }
    if (c) {
        const sec = document.createElement("section");
        sec.className = "calwkgroup closed";
        const f = fold(plural("clWkClosedFold", c), cardsOf(jobs.late.slice(l + r)));
        f.open = !n && !l;
        sec.appendChild(f);
        panel.appendChild(sec);
    }
    reopenFold();
    for (const d of jobs.days)
        group(dayHeading(d.date, todayIso), "day", d.tasks.map((t) => taskCard(t, all, bundle, picks, multiGarden)));
    if (jobs.done.length)
        group(copy.clDoneWeek, "done", jobs.done.map((t) => taskCard(t, all, bundle, picks, multiGarden)));
}
function renderAgenda(all, bundle) {
    const panel = $("caltasks");
    homeLogSlot();
    panel.replaceChildren();
    const monthTasks = tasksInMonth(all, calYear, calMonth);
    const list = groupAgenda(calSelDay ? all.filter((t) => t.date === calSelDay) : monthTasks);
    const multiGarden = new Set(list.map((t) => t.plotId ?? "")).size > 1;
    const shown = calSelDay ? list.length : groupAgenda(monthTasks).length;
    $("calagtitle").textContent = calSelDay
        ? fillCopy("clAgOn", { month: MONTHS[calMonth], day: Number(calSelDay.slice(8)) })
        : plural("clAgEvents", shown, { month: MONTHS[calMonth] });
    if (!list.length) {
        const lat = num("lat"), lon = num("lon");
        const cold = lat == null || lon == null;
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = cold
            ? copy.clNoLocation
            : calSelDay ? fillCopy("clAgNothingOn", { month: MONTHS[calMonth], day: Number(calSelDay.slice(8)) })
                : uncoveredLine(bundle) ?? copy.clAgEmpty;
        panel.appendChild(p);
        return;
    }
    const picks = pickCache(bundle);
    const cards = list.map((t) => taskCard(t, all, bundle, picks, multiGarden));
    if (calSelDay || cards.length <= AG_WHOLE) {
        panel.append(...cards);
        return;
    }
    const today = TODAY_ISO();
    const at = list.findIndex((t) => t.date >= today);
    const from = at >= AG_FOLD_MIN ? at : 0;
    const agFold = (summary, cs) => {
        const more = document.createElement("details");
        more.className = "calwkmore calagmore";
        const sum = document.createElement("summary");
        sum.textContent = summary;
        more.append(sum, ...cs);
        return more;
    };
    if (from)
        panel.appendChild(agFold(plural("clAgEarlier", from), cards.slice(0, from)));
    panel.append(...cards.slice(from, from + AG_OPEN));
    const rest = cards.slice(from + AG_OPEN);
    if (rest.length >= AG_FOLD_MIN)
        panel.appendChild(agFold(plural("clAgMore", rest.length), rest));
    else
        panel.append(...rest);
}
const AG_WHOLE = 12, AG_OPEN = 8, AG_FOLD_MIN = 3;
function pickCache(bundle) {
    let picksCache = null;
    return () => (picksCache ??= openPlantings(bundle));
}
function whyReveal(winLine, text, ruleLink) {
    const wrap = document.createElement("span");
    wrap.className = "twhy-wrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "twhy";
    btn.textContent = copy.clWhy;
    btn.setAttribute("aria-expanded", "false");
    const note = document.createElement("span");
    note.className = "twhy-g";
    note.id = `twhy-${++whySeq}`;
    note.setAttribute("role", "note");
    note.hidden = true;
    btn.setAttribute("aria-controls", note.id);
    if (winLine)
        note.appendChild(winLine);
    const derived = document.createElement("span");
    derived.className = "twhy-d";
    note.appendChild(derived);
    if (ruleLink)
        note.appendChild(ruleLink);
    let loaded = false;
    btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
        if (!open && !loaded && text) {
            loaded = true;
            void Promise.resolve(text()).then((s) => { derived.textContent = s; });
        }
    });
    wrap.append(btn, note);
    return wrap;
}
let whySeq = 0;
function taskCard(t, all, bundle, picks, multiGarden, late) {
    {
        const cat = category(t);
        const el = document.createElement("div");
        el.className = "caltask " + cat;
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = monthDay(t.date.slice(5));
        el.dataset.date = t.date;
        const body = document.createElement("div");
        body.className = "tbody";
        const win = taskWindow(t, bundle, TODAY_ISO());
        const past = (late != null && late > 0) || !!win?.kept;
        if (past && win && stillTime(t, TODAY_ISO())) {
            const st = document.createElement("span");
            st.className = "badge outline tone-positive tstill";
            st.textContent = !win.closeBy ? copy.clStillTimeOpenTag
                : fillCopy("clStillTimeTag", { date: win.closeBy.slice(0, 4) === TODAY_ISO().slice(0, 4) ? monthDay(win.closeBy.slice(5)) : fmtMonthDayYear(win.closeBy) });
            body.appendChild(st);
        }
        else if (past && win?.reopens) {
            const rt = document.createElement("span");
            rt.className = "badge outline tstill treopen";
            rt.textContent = fillCopy("clWinReopensTag", { date: win.reopens.slice(0, 4) === TODAY_ISO().slice(0, 4) ? monthDay(win.reopens.slice(5)) : fmtMonthDayYear(win.reopens) });
            body.appendChild(rt);
        }
        else if (past) {
            const lt = document.createElement("span");
            lt.className = win?.state === "closed" ? "badge outline tone-danger tlate closed" : "badge outline tone-danger tlate";
            lt.textContent = win?.kept ? fillCopy("clWinKeptTag", { year: win.kept })
                : win?.state === "closed" ? copy.clWinClosedTag
                    : plural(category(t) === "harvest" ? (isWindowEnd(t) ? "clPastEnd" : "clReady") : "clLateBy", late ?? 0);
            body.appendChild(lt);
        }
        if (t.coming) {
            const tag = document.createElement("span");
            tag.className = "badge outline tcoming";
            tag.textContent = fillCopy("clComingTag", { year: t.coming });
            body.appendChild(tag);
        }
        if (t.setAside) {
            el.classList.add("aside");
            const tag = document.createElement("span");
            tag.className = "badge outline taside";
            tag.textContent = copy.clSetAsideTag;
            body.appendChild(tag);
        }
        const ttl = document.createElement("div");
        ttl.className = "ttl";
        const passed = past || t.date < TODAY_ISO();
        const warmTail = win?.warm ? ` ${win.warm}` : "";
        ttl.textContent = (passed ? lateSentence(t.text ?? taskSentence(t, bundle), t) : (t.text ?? taskSentence(t, bundle))) + warmTail;
        body.appendChild(ttl);
        let winLine = null;
        if (win && (late != null || win.state !== "open")) {
            winLine = document.createElement("span");
            winLine.className = win.state === "closed" ? "twin closed" : "twin";
            winLine.textContent = win.line;
        }
        if (t.groupDates && t.groupDates.length > 1) {
            const rest = t.groupDates.slice(1).map((d) => monthDay(d.slice(5)));
            const ser = document.createElement("details");
            ser.className = "tseries";
            const sum = document.createElement("summary");
            sum.className = "tdates";
            sum.textContent = fillCopy("clThenSowings", { dates: rest.join(", "), n: t.groupDates.length });
            ser.appendChild(sum);
            const ul = document.createElement("ul");
            ul.className = "tserdates";
            const target = t.plotId === app.currentPlotId && t.species
                ? picks().find((pp) => pp.species === t.species && (!t.bed || pp.bed === t.bed)) ?? null
                : null;
            for (const d of [...t.groupDates].sort()) {
                const li = document.createElement("li");
                const dt = document.createElement("span");
                dt.textContent = monthDay(d.slice(5));
                li.appendChild(dt);
                if (target) {
                    const lg = document.createElement("button");
                    lg.type = "button";
                    lg.className = "tlog";
                    lg.textContent = copy.clLogIt;
                    lg.addEventListener("click", () => {
                        const rec = openSeason()?.plantings?.[target.idx];
                        if (rec?.sown && t.bed) {
                            const spot = app.plannedSpotFor?.(t.bed, t.species) ?? null;
                            calFormOpen?.({ kind: "sowed", newPlanting: { species: t.species, group: spot?.group ?? rec.cultivar_group ?? null, bed: t.bed }, date: d });
                        }
                        else
                            calFormOpen?.({ kind: "sowed", plantIdx: target.idx, date: d });
                        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                        document.getElementById(logSlotId())?.scrollIntoView({ behavior, block: "center" });
                    });
                    li.appendChild(lg);
                }
                ul.appendChild(li);
            }
            ser.appendChild(ul);
            body.appendChild(ser);
        }
        const linkSpecies = t.groupPlants?.length ? [...new Set(t.groupPlants.map((p) => p.species))] : t.species ? [t.species] : [];
        for (const sid of linkSpecies) {
            const pl = document.createElement("a");
            pl.className = "tplant";
            const grp = !t.groupPlants?.length && sid === t.species ? t.group ?? null : null;
            pl.href = plantHref(sid, grp);
            pl.textContent = `${grp ? plantingLabel(bundle, sid, grp) : commonName(bundle, sid)}\u00a0›`;
            body.appendChild(pl);
        }
        if (t.bed || (multiGarden && t.garden)) {
            const meta = document.createElement("div");
            meta.className = "tmeta";
            if (t.bed && t.plotId === app.currentPlotId) {
                const bedBtn = document.createElement("button");
                bedBtn.type = "button";
                bedBtn.className = "chip bed bedlink";
                bedBtn.textContent = `${t.bed}\u00a0›`;
                bedBtn.title = fillCopy("clOpenBedInLog", { bed: t.bed });
                bedBtn.addEventListener("click", () => app.openLogBed?.(t.bed, t.species ?? null));
                meta.appendChild(bedBtn);
            }
            else if (t.bed) {
                const bedTxt = document.createElement("span");
                bedTxt.className = "bed";
                bedTxt.textContent = t.bed;
                meta.appendChild(bedTxt);
            }
            if (multiGarden && t.garden) {
                const g = document.createElement("span");
                g.className = "gardentag";
                g.textContent = t.garden;
                meta.appendChild(g);
            }
            body.appendChild(meta);
        }
        el.title = t.tip
            ? t.tip
            : t.kind === "harvest_open"
                ? fillCopy("clHarvestEstTip", { crop: commonName(bundle, t.species) })
                : ruleClaim(bundle, t.rule);
        if (win && win.state === "open" && late == null)
            el.title = `${el.title} ${win.line}`.trim();
        let ruleLink = null;
        if (t.rule && /^R-\d/.test(t.rule) && t.kind !== "harvest_open") {
            ruleLink = document.createElement("a");
            ruleLink.className = "whytap";
            ruleLink.href = `#/why?rule=${t.rule}`;
            ruleLink.textContent = `${copy.dsSeeEvidence}\u00a0›`;
            markLink(ruleLink, { kind: "rule", id: t.rule });
        }
        const mine = t.plotId === app.currentPlotId;
        let whyText = null;
        if (t.species && mine && t.kind !== "logged") {
            const sid = t.species;
            let why = null;
            if (t.kind === "succession") {
                why = () => successionWhy(bundle, t);
            }
            else if (t.kind === "start_indoors" || isTeamPlantJob(t.kind) || t.kind === "cool_season" || t.kind === "warm_set_out") {
                const lat = num("lat"), lon = num("lon");
                if (lat != null && lon != null) {
                    why = () => import('./answers.js').then((m) => m.cropAnswer(sid, lat, lon, TODAY_ISO(), bundle)?.explain ?? copy.anDatesFromClimate);
                }
            }
            else if ((cat === "sow" || cat === "plant") && t.tip) {
                const tip = t.tip;
                why = () => tip;
            }
            else if (t.kind === "harvest_open") {
                const range = t.dtmRange;
                why = () => range ? fillCopy("clHarvestWhyRange", { crop: commonName(bundle, sid), lo: range[0], hi: range[1] })
                    : fillCopy("clHarvestWhy", { crop: commonName(bundle, sid) });
            }
            whyText = why;
        }
        if (winLine || whyText || ruleLink) {
            const row = document.createElement("div");
            row.className = "twhyrow";
            row.appendChild(whyReveal(winLine, whyText, ruleLink));
            body.appendChild(row);
        }
        const doneHere = t.kind !== "logged" && mine && isDone(t, all);
        const movedOn = !!win?.kept && !t.setAside && !doneHere;
        if (mine && t.season != null && canSetAside(t) && !doneHere && !movedOn) {
            const sk = document.createElement("button");
            sk.type = "button";
            sk.className = "tskip";
            sk.textContent = t.setAside ? copy.clBringBack : copy.clNotThisYear;
            if (!t.setAside)
                sk.title = copy.clNotThisYearTitle;
            sk.addEventListener("click", () => void setAside(t, !t.setAside, bundle, sk));
            body.appendChild(sk);
        }
        if (t.setAside) {
            el.append(when, body);
        }
        else if (doneHere) {
            el.classList.add("done");
            const dn = document.createElement("span");
            dn.className = "badge outline tone-positive tdone";
            dn.textContent = copy.clDoneTag;
            el.append(when, body, dn);
        }
        else if (t.kind !== "logged" && t.kind !== "heat_marker" && t.kind !== "water_marker" && mine && !movedOn) {
            const b = document.createElement("button");
            const frostMark = t.kind === "log_first_freeze" || category(t) === "frost";
            b.type = "button";
            b.className = "btn btn-secondary tdid";
            b.textContent = frostMark ? copy.clLogAFrost : copy.clDidIt;
            b.title = frostMark ? copy.clLogAFrostTitle : copy.clDidItTitle;
            b.setAttribute("aria-expanded", "false");
            const armed = { force: false };
            b.addEventListener("click", () => didIt(t, bundle, el, b, armed));
            el.append(when, body, b);
        }
        else {
            el.append(when, body);
        }
        return el;
    }
}
function renderYearGrid(all) {
    const span = yearViewMonths(calYear, calMonth, calLat);
    $("calylabel").textContent = span.label;
    const wrap = $("calyeargrid");
    wrap.replaceChildren();
    for (const { y, m } of span.months) {
        const days = new Date(y, m + 1, 0).getDate();
        const first = new Date(y, m, 1).getDay();
        const mt = tasksInMonth(all, y, m);
        const marked = new Map();
        for (const t of mt) {
            const d = Number(t.date.slice(8));
            if (!marked.has(d))
                marked.set(d, category(t));
        }
        const btn = document.createElement("button");
        btn.className = "calym";
        const h = document.createElement("h3");
        h.textContent = MONTHS[m].slice(0, 3);
        const g = document.createElement("div");
        g.className = "calymgrid";
        for (let i = 0; i < first; i++)
            g.appendChild(document.createElement("i"));
        for (let d = 1; d <= days; d++) {
            const i = document.createElement("i");
            if (marked.has(d))
                i.className = `has ct-${marked.get(d)}`;
            g.appendChild(i);
        }
        const count = document.createElement("div");
        count.className = "calymcount";
        const shownM = groupAgenda(mt).length;
        count.textContent = shownM ? plural("clYrEvents", shownM) : "";
        btn.append(h, g, count);
        btn.addEventListener("click", () => { calYear = y; calMonth = m; calSelDay = null; setView("month"); });
        wrap.appendChild(btn);
    }
}
let currentBundle = null;
function bedPosPhrase(pt, bedRegion) {
    const xs = regionPoints(bedRegion).map((q) => q[0]);
    const ys = regionPoints(bedRegion).map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX, spanY = maxY - minY;
    if (spanX <= 0 || spanY <= 0)
        return "";
    const fx = (pt[0] - minX) / spanX, fy = (pt[1] - minY) / spanY;
    const lr = fx < 0.34 ? copy.clPosLeft : fx > 0.66 ? copy.clPosRight : "";
    const fb = fy > 0.66 ? copy.clPosBack : fy < 0.34 ? copy.clPosFront : copy.clPosMiddle;
    return [fb, lr].filter(Boolean).join("-");
}
function openPlantings(bundle) {
    const open = openSeason();
    const beds = app.logSnapshot.beds;
    const bedOf = (region) => {
        try {
            const hits = beds.filter((b) => intersectArea(parseRegion(b.region), region) > 0);
            return hits.find((b) => !bedHasSections(b.name, beds)) ?? hits[0] ?? null;
        }
        catch {
            return null;
        }
    };
    return (open?.plantings ?? []).map((p, idx) => {
        let region = null;
        try {
            region = parseRegion(p.region);
        }
        catch {
            region = null;
        }
        const bed = region ? bedOf(region) : null;
        const pos = region && bed ? bedPosPhrase(regionCentroid(region), parseRegion(bed.region)) : "";
        const name = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
        const bedTail = bed ? ` - ${bed.name}` : "";
        const posTail = pos ? ` (${pos})` : "";
        return { idx, label: `${name}${bedTail}${posTail}`, species: p.species, group: p.cultivar_group ?? null, region, bed: bed?.name ?? "", pos };
    });
}
const SVG_NS = "http://www.w3.org/2000/svg";
function renderBedPicker(host, plants, selectedIdx, onPick) {
    const placed = plants.filter((p) => p.region);
    if (placed.length < 2)
        return null;
    const bedRegions = new Map();
    for (const b of app.logSnapshot.beds) {
        try {
            bedRegions.set(b.name, parseRegion(b.region));
        }
        catch { }
    }
    const ctxBeds = [...new Set(placed.map((p) => p.bed).filter(Boolean))].map((n) => bedRegions.get(n)).filter((r) => !!r);
    const pts = placed.map((p) => regionCentroid(p.region));
    for (const r of ctxBeds)
        pts.push(...regionPoints(r));
    const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
    const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
    const spanX = Math.max(0.5, maxX - minX), spanY = Math.max(0.5, maxY - minY);
    const PAD = 16, TARGET_W = 300, MAX_H = 220;
    const scale = Math.min((TARGET_W - 2 * PAD) / spanX, (MAX_H - 2 * PAD) / spanY);
    const vbW = spanX * scale + 2 * PAD, vbH = spanY * scale + 2 * PAD;
    const toSvg = (x, y) => [PAD + (x - minX) * scale, PAD + (maxY - y) * scale];
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
    svg.setAttribute("class", "calbedpick");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", copy.clPickAria);
    const bedLabels = [];
    for (const r of ctxBeds) {
        const name = [...bedRegions].find(([, rr]) => rr === r)?.[0] ?? "";
        const sp = regionPoints(r).map(([x, y]) => toSvg(x, y));
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", sp.map(([x, y]) => `${x},${y}`).join(" "));
        poly.setAttribute("class", "calpickbed");
        svg.appendChild(poly);
        const xs = sp.map((q) => q[0]), ys = sp.map((q) => q[1]);
        bedLabels.push({ name, x: xs.reduce((a, b) => a + b, 0) / xs.length, topY: Math.min(...ys) });
    }
    const cap = document.createElement("p");
    cap.className = "calpickcap";
    const dots = [];
    const paint = () => {
        const sel = selectedIdx();
        for (const g of dots) {
            const on = Number(g.dataset.idx) === sel;
            g.setAttribute("aria-pressed", String(on));
            g.querySelector("circle").setAttribute("class", on ? "calpickdot is-sel" : "calpickdot");
        }
        const p = plants.find((q) => q.idx === sel);
        cap.textContent = p ? fillCopy("clSelected", { plant: p.label }) : "";
    };
    for (const p of placed) {
        const [cx, cy] = toSvg(p.region ? regionCentroid(p.region)[0] : 0, p.region ? regionCentroid(p.region)[1] : 0);
        const g = document.createElementNS(SVG_NS, "g");
        g.dataset.idx = String(p.idx);
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute("aria-label", p.label);
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("cx", cx.toFixed(1));
        circle.setAttribute("cy", cy.toFixed(1));
        circle.setAttribute("r", "7");
        circle.setAttribute("class", "calpickdot");
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = p.label;
        g.append(circle, title);
        const pick = () => { onPick(p.idx); paint(); };
        g.addEventListener("click", pick);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
        } });
        svg.appendChild(g);
        dots.push(g);
    }
    for (const bl of bedLabels) {
        const t = document.createElementNS(SVG_NS, "text");
        t.setAttribute("x", bl.x.toFixed(1));
        t.setAttribute("y", Math.max(9, bl.topY - 4).toFixed(1));
        t.setAttribute("class", "calpickbedlabel");
        t.textContent = bl.name;
        svg.appendChild(t);
    }
    host.append(svg, cap);
    paint();
    return paint;
}
let calFormOpen = null;
let calFormOpener = null;
function closeFormFocus() {
    const b = calFormOpener;
    calFormOpener = null;
    if (b && b.isConnected) {
        b.setAttribute("aria-expanded", "false");
        b.focus();
    }
}
const logSlotId = () => calView === "week" ? "calwklog" : "callog";
function homeLogSlot() {
    const slot = document.getElementById(logSlotId());
    if (!slot)
        return;
    if (calView === "week")
        (document.getElementById("calwkglance") ?? document.getElementById("calwktitle"))?.after(slot);
    else
        document.getElementById("caltasks")?.before(slot);
}
function renderLogForm(bundle, prefill) {
    $("callog").replaceChildren();
    $("calwklog").replaceChildren();
    const slot = $(logSlotId());
    const db = app.logDb;
    if (!db)
        return;
    const seasonId$1 = seasonId();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary callogbtn";
    btn.textContent = copy.clLogEvent;
    slot.appendChild(btn);
    calFormOpen = (p) => renderLogForm(bundle, p);
    const openForm = () => {
        if (seasonId$1 == null) {
            const h = document.createElement("p");
            h.className = "hint";
            h.textContent = copy.clStartSeasonFirst;
            slot.replaceChildren(h);
            return;
        }
        const plants = openPlantings(bundle);
        const fresh = prefill?.newPlanting ?? null;
        const f = document.createElement("div");
        f.className = "callogform";
        if (prefill?.title) {
            const ttl = document.createElement("p");
            ttl.className = "callogtitle";
            ttl.textContent = fillCopy("clDidItFor", { job: prefill.title.split(" - ")[0].replace(/[.:]$/, "") });
            f.appendChild(ttl);
        }
        const kind = el("select");
        kind.setAttribute("aria-label", copy.clAriaWhatHappened);
        for (const [v, label] of [["frost", copy.clOptFrost], ["heat", copy.clOptHeat], ["sowed", copy.clOptSowed], ["transplanted", copy.clOptTransplanted],
            ["first_harvest", copy.clOptFirstHarvest], ["last_harvest", copy.clOptLastHarvest], ["ended", copy.clOptEnded], ["problem", copy.clOptProblem], ["note", copy.clOptNote]]) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = label;
            kind.appendChild(o);
        }
        const plant = el("select");
        plant.setAttribute("aria-label", copy.clAriaWhichPlant);
        for (const { idx, label } of plants) {
            const o = document.createElement("option");
            o.value = String(idx);
            o.textContent = label;
            plant.appendChild(o);
        }
        const freshLine = el("p", "hint callognew");
        freshLine.hidden = !fresh;
        if (fresh)
            freshLine.textContent = fresh.setOut
                ? fillCopy("clFreshSetOut", { crop: commonName(bundle, fresh.species), bed: fresh.bed })
                : fillCopy("clFreshSow", { crop: commonName(bundle, fresh.species), bed: fresh.bed });
        const pick = el("div", "calpickwrap");
        const repaintPick = renderBedPicker(pick, plants, () => Number(plant.value), (idx) => { plant.value = String(idx); });
        plant.addEventListener("change", () => repaintPick?.());
        const sev = el("select");
        sev.setAttribute("aria-label", copy.clAriaSeverity);
        const what = el("input");
        what.type = "text";
        what.placeholder = copy.clWhatPh;
        what.setAttribute("aria-label", copy.clAriaWhat);
        const note = el("input");
        note.type = "text";
        note.placeholder = copy.clNotePh;
        note.setAttribute("aria-label", copy.clAriaNote);
        const date = el("input");
        date.type = "date";
        date.setAttribute("aria-label", copy.clAriaDate);
        const today = TODAY_ISO();
        date.max = today;
        const offered = calSelDay ?? (calView === "week" ? today : iso(calYear, calMonth, Math.min(new Date().getDate(), new Date(calYear, calMonth + 1, 0).getDate())));
        date.value = isFutureDate(offered, today) ? today : offered;
        const err = el("p", "callogerr");
        const setOpts = (el, opts, label) => { el.replaceChildren(); for (const v of opts) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = label(v);
            el.appendChild(o);
        } };
        const sync = () => {
            const k = kind.value;
            const obs = k === "frost" || k === "heat";
            plant.hidden = obs || !!fresh;
            pick.hidden = obs || !repaintPick || !!fresh || prefill?.plantIdx != null;
            what.hidden = k !== "problem";
            note.hidden = !(obs || k === "note");
            note.placeholder = k === "note" ? copy.clNotePhExample : copy.clNotePh;
            sev.hidden = !(k === "frost" || k === "ended" || k === "problem");
            if (k === "frost")
                setOpts(sev, OBSERVATION_SEVERITIES, frostSeverityLabel);
            else if (k === "ended")
                setOpts(sev, END_CAUSES, endCauseLabel);
            else if (k === "problem")
                setOpts(sev, FAILURE_SEVERITIES, failureSeverityLabel);
        };
        kind.addEventListener("change", sync);
        sync();
        const save = el("button", "btn btn-primary callogbtn");
        save.type = "button";
        save.textContent = copy.clSave;
        const cancel = el("button", "linky callogcancel");
        cancel.type = "button";
        cancel.textContent = copy.clCancel;
        cancel.addEventListener("click", () => { homeLogSlot(); renderLogForm(bundle); closeFormFocus(); });
        save.addEventListener("click", () => void (async () => {
            err.textContent = "";
            const k = kind.value, d = date.value, idx = Number(plant.value);
            try {
                if (!d)
                    throw new Error(copy.clErrPickDate);
                if (isFutureDate(d, TODAY_ISO()))
                    throw new Error(copy.lgErrFutureDate);
                if (k === "frost" || k === "heat") {
                    const filed = await fileObservation(db, app.currentPlotId, { date: d, event: k,
                        ...(k === "frost" ? { severity: sev.value } : {}),
                        ...(note.value.trim() ? { note: note.value.trim() } : {}) });
                    window.dispatchEvent(new CustomEvent("gg-log-year", { detail: { year: filed.seasonId } }));
                }
                else if ((k === "sowed" || k === "transplanted") && fresh) {
                    await addPlanting(db, app.currentPlotId, seasonId$1, { species: fresh.species,
                        ...(fresh.group ? { cultivar_group: fresh.group } : {}), region: freshRegion(fresh),
                        ...(k === "transplanted" ? { transplanted: d } : { sown: d }) });
                }
                else {
                    if (!plants.length)
                        throw new Error(copy.clErrNoPlants);
                    if (k === "sowed")
                        await updatePlanting(db, app.currentPlotId, seasonId$1, idx, { sown: d });
                    else if (k === "transplanted")
                        await updatePlanting(db, app.currentPlotId, seasonId$1, idx, { transplanted: d });
                    else if (k === "first_harvest")
                        await updatePlanting(db, app.currentPlotId, seasonId$1, idx, { first_harvest: d });
                    else if (k === "last_harvest")
                        await updatePlanting(db, app.currentPlotId, seasonId$1, idx, { last_harvest: d });
                    else if (k === "ended")
                        await endPlanting(db, app.currentPlotId, seasonId$1, idx, sev.value, d);
                    else if (k === "problem") {
                        if (!what.value.trim())
                            throw new Error(copy.clErrNameProblem);
                        await addFailure(db, app.currentPlotId, seasonId$1, idx, { date: d, mode: what.value.trim(), severity: sev.value });
                    }
                    else if (k === "note") {
                        if (!note.value.trim())
                            throw new Error(copy.clErrWriteNote);
                        await addPlantingNote(db, app.currentPlotId, seasonId$1, idx, { date: d, text: note.value.trim() });
                    }
                }
                await app.logRefresh?.();
                const pp = plants.find((p) => p.idx === idx);
                const who = pp ? plantingLabel(bundle, pp.species, pp.group) : "";
                toast(k === "frost" ? frostNotedLine(d) : k === "heat" ? heatNotedLine(d)
                    : plantEntryLine(k, who, d, k === "problem" ? what.value : ""));
                homeLogSlot();
                closeFormFocus();
                renderCalendar(bundle);
            }
            catch (e) {
                err.textContent = String(e instanceof Error ? e.message : e);
            }
        })());
        f.append(kind, pick, plant, freshLine, sev, what, note, date, save, cancel, err);
        if (prefill) {
            if (prefill.kind) {
                kind.value = prefill.kind;
                sync();
            }
            if (prefill.plantIdx != null) {
                plant.value = String(prefill.plantIdx);
                repaintPick?.();
            }
            if (prefill.date)
                date.value = isFutureDate(prefill.date, date.max) ? date.max : prefill.date;
            if (prefill.noteText)
                note.value = prefill.noteText;
        }
        btn.replaceWith(f);
        if (prefill)
            date.focus();
    };
    btn.addEventListener("click", openForm);
    if (prefill)
        openForm();
}
function renderBedFilter(all, allowBeds) {
    const row = $("calbeds");
    if (!allowBeds) {
        calSelBed = null;
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    const beds = bedsWithTasks(all);
    if (calSelBed && !beds.includes(calSelBed))
        calSelBed = null;
    if (beds.length < 2) {
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    row.hidden = false;
    row.replaceChildren();
    const chip = (label, bed) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "calbed";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(calSelBed === bed));
        b.addEventListener("click", () => {
            calSelBed = bed;
            calSelDay = null;
            renderCalendar(currentBundle);
        });
        return b;
    };
    row.appendChild(chip(copy.clAllBeds, null));
    for (const bed of beds)
        row.appendChild(chip(bed, bed));
}
function resolveSelGarden(gardens) {
    if (calSelGarden !== undefined && calSelFor !== app.currentPlotId) {
        calSelGarden = undefined;
        calSelBed = null;
        calSelDay = null;
    }
    if (calSelGarden === undefined)
        return app.currentPlotId;
    if (calSelGarden === null)
        return null;
    return gardens.some((g) => g.plotId === calSelGarden) ? calSelGarden : app.currentPlotId;
}
function renderGardenFilter(gardens, sel) {
    const row = $("calgardens");
    if (gardens.length < 2) {
        row.hidden = true;
        row.replaceChildren();
        return;
    }
    row.hidden = false;
    row.replaceChildren();
    const chip = (label, id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "calbed";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(sel === id));
        b.addEventListener("click", () => {
            calSelGarden = id;
            calSelFor = app.currentPlotId;
            calSelBed = null;
            calSelDay = null;
            renderCalendar(currentBundle);
        });
        return b;
    };
    row.appendChild(chip(copy.clAllGardens, null));
    for (const g of gardens) {
        const b = chip(g.name, g.plotId);
        if (g.plotId === app.currentPlotId)
            b.setAttribute("aria-current", "true");
        row.appendChild(b);
    }
}
function renderFocusClimate(bundle, gardens, sel, chosen) {
    for (const g of chosen)
        if (g.lat != null && g.lon != null)
            app.ensureZipData?.(g.lat, g.lon);
    const focus = gardens.find((g) => g.plotId === (sel ?? app.currentPlotId));
    const nudge = document.getElementById("calplannudge");
    if (nudge)
        nudge.dataset.plot = focus?.plotId ?? "";
    if (!focus)
        return;
    const { lat, lon } = focus;
    const clim = lat != null && lon != null ? scheduleClimate(lat, lon, bundle) : null;
    const zone = lat != null && lon != null ? resolveZone(lat, lon, bundle) : null;
    const own = !clim && lat != null && lon != null && !!app.climateSettled?.(lat, lon);
    const fcal = clim ? frostCalibration(focus.seasons, clim.site) : own ? frostCalibration(focus.seasons, null, lat) : null;
    const reading = lat != null && lon != null && !app.climateSettled?.(lat, lon);
    renderClimate(clim, zone, lat, fcal, gardens.length > 1 ? focus.name : null, focus.plotId, reading);
}
function placeForecast(gardens, sel) {
    if (!app.forecastStrip)
        return;
    const f = gardens.find((g) => g.plotId === (sel ?? app.currentPlotId));
    const node = app.forecastStrip("cal", f && f.lat != null && f.lon != null && !isExamplePlot(f.plotId)
        ? { plotId: f.plotId, lat: f.lat, lon: f.lon, name: gardens.length > 1 ? f.name : null,
            watch: currentBundle ? { bundle: currentBundle, seasons: f.seasons, seasonId: f.seasonId, beds: f.beds } : undefined } : null);
    const title = document.getElementById("calwktitle");
    if (node && title)
        title.after(node);
    else
        document.querySelector("#calweekview > .wwstrip")?.remove();
}
function renderCalendar(bundle) {
    {
        const located = num("lat") != null && num("lon") != null;
        const nl = document.getElementById("calnoloc");
        if (nl)
            nl.hidden = located;
        const sl = document.getElementById("calsetloc");
        if (sl)
            sl.hidden = located;
        const ce = document.getElementById("calempty");
        if (ce)
            ce.hidden = located;
        document.getElementById("page-calendar")?.classList.toggle("calcold", !located);
    }
    {
        const tl = document.getElementById("caltagline");
        if (tl && !tl.firstChild)
            fillNodes(tl, copy.calendarTagline, { windows: glossTerm("window", copy.clWindowsWord) });
    }
    currentBundle = bundle;
    dropStaleGardens();
    const gardens = gardensNow();
    const sel = resolveSelGarden(gardens);
    const chosen = sel === null ? gardens : gardens.filter((g) => g.plotId === sel);
    calLat = chosen.length === 1 ? chosen[0].lat : num("lat");
    const years = calView === "year" ? yearViewMonths(calYear, calMonth, calLat).years : [calYear];
    const everything = oneWarmWindow(chosen.flatMap((g) => years.flatMap((y) => [...tasksForYear(bundle, y, g), ...comingTasksForYear(bundle, y, g)])));
    if (!isSignedIn()) {
        const extra = (app.answersTasks?.() ?? []);
        everything.push(...extra.filter((t) => typeof t.date === "string" && years.some((y) => t.date.startsWith(String(y)))));
    }
    renderGardenFilter(gardens, sel);
    renderFocusClimate(bundle, gardens, sel, chosen);
    renderUndated(bundle, chosen);
    renderUnfit(bundle, chosen);
    renderBedFilter(everything, sel !== null);
    const all = filterByBed(everything);
    const today = TODAY_ISO();
    const weekPool = filterByBed(weekTaskPool(bundle, chosen, today, !isSignedIn()));
    if (!calViewChosen) {
        const j = weekJobs(weekPool, today);
        applyView(j.due || j.late.length ? "week" : "month");
    }
    if (calView === "week") {
        renderWeek(weekPool, bundle, today);
        placeForecast(gardens, sel);
        renderLogForm(bundle);
    }
    else if (calView === "month") {
        renderMonthGrid(all);
        renderAgenda(all, bundle);
        renderLogForm(bundle);
    }
    else
        renderYearGrid(all);
    kickGardensLoad();
    renderReminderState();
    if (remindersOn())
        void refreshReminders(buildReminderPlan());
}
function applyView(v) {
    calView = v;
    $("calv-week").setAttribute("aria-pressed", String(v === "week"));
    $("calv-month").setAttribute("aria-pressed", String(v === "month"));
    $("calv-year").setAttribute("aria-pressed", String(v === "year"));
    $("calweekview").hidden = v !== "week";
    $("calmonthview").hidden = v !== "month";
    $("calyearview").hidden = v !== "year";
}
function setView(v) {
    calViewChosen = true;
    applyView(v);
    if (currentBundle)
        renderCalendar(currentBundle);
}
function upcomingTasks() {
    const today = TODAY_ISO();
    return taskPool().filter((t) => typeof t.date === "string" && t.date >= today);
}
function taskPool() {
    const today = TODAY_ISO();
    return filterByBed(weekTaskPool(currentBundle, [currentGardenCtx()], today, !isSignedIn(), daysBetween(today, `${Number(today.slice(0, 4)) + 1}-12-31`)));
}
function noticeOpts() {
    const b = currentBundle;
    return { today: TODAY_ISO(), cadence: notifyCadence(), weekday: notifyWeekday(),
        sentence: (t) => taskSentence(t, b), name: (sid) => commonName(b, sid),
        ...(app.forecastSaid ? { forecast: app.forecastSaid } : {}) };
}
function buildReminderPlan() {
    return phonePlan(taskPool(), noticeOpts());
}
function refreshReminderPlan(bundle) {
    currentBundle = bundle;
    if (remindersOn())
        void refreshReminders(buildReminderPlan());
}
function renderInstall() {
    const row = document.getElementById("calinstall");
    if (!row)
        return;
    row.replaceChildren();
    const nav = navigator;
    const installed = matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    const offer = globalThis.ggInstallOffer ?? null;
    const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
    if (!installed && offer) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary calinstallbtn";
        b.textContent = copy.clInstallBtn;
        b.addEventListener("click", () => void (async () => {
            await offer.prompt();
            await offer.userChoice.catch(() => null);
            globalThis.ggInstallOffer = null;
            renderInstall();
        })());
        row.append(document.createTextNode(`${copy.clInstallWhy} `), b);
    }
    else if (!installed && ios)
        row.textContent = copy.clInstallIos;
    row.hidden = !row.firstChild;
}
function paintNotify() {
    const how = document.getElementById("calnotifyhow");
    const day = document.getElementById("calnotifyday");
    if (!how || !day)
        return;
    how.value = notifyCadence();
    day.value = String(notifyWeekday());
    day.closest(".notifyday")?.toggleAttribute("hidden", notifyCadence() !== "weekly");
}
function renderReminderState(status) {
    renderInstall();
    paintNotify();
    const btn = $("calnotify");
    const hint = $("calnotifyhint");
    const push = app.pushControl?.() ?? null;
    if (push && push.parentElement !== $("calexport"))
        $("calexport").append(push);
    if (push?.dataset.on === "1" || !remindersSupported()) {
        btn.hidden = true;
        hint.hidden = true;
        return;
    }
    btn.hidden = false;
    const on = remindersOn();
    btn.textContent = on ? copy.clRemindersOnBtn : copy.clRemindMeBtn;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const msg = status ?? (on
        ? copy.clRemindersOnHint
        : copy.clRemindersOffHint);
    hint.textContent = msg;
    hint.hidden = false;
}
function initCalendar(bundle) {
    addEventListener("gg-install", renderInstall);
    currentBundle = bundle;
    onGardensLoaded(() => { if (currentBundle)
        renderCalendar(currentBundle); });
    app.calendarRefresh = () => { if (currentBundle)
        renderCalendar(currentBundle); };
    calYear = new Date().getFullYear();
    calMonth = new Date().getMonth();
    $("calv-week").addEventListener("click", () => setView("week"));
    $("calv-month").addEventListener("click", () => setView("month"));
    $("calv-year").addEventListener("click", () => setView("year"));
    app.openWeek = async (plotId, bed, day) => {
        if (plotId && plotId !== app.currentPlotId)
            await app.switchPlot?.(plotId);
        calSelGarden = app.currentPlotId;
        calSelFor = app.currentPlotId;
        calSelBed = bed ?? null;
        calSelDay = null;
        calViewChosen = true;
        const first = bed && app.bedPlantWindow?.(bed)?.status === "passed" ? (app.bedFacts?.(bed)?.next ?? null) : null;
        const at = day ?? (first && !first.late ? first.date : null);
        if (at) {
            calYear = Number(at.slice(0, 4));
            calMonth = Number(at.slice(5, 7)) - 1;
            calSelDay = at;
            applyView("month");
        }
        else
            applyView("week");
        if (currentBundle)
            renderCalendar(currentBundle);
        location.hash = "#/calendar";
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => {
            const view = document.getElementById(at ? "calmonthview" : "calweekview");
            if (at && view)
                view.style.scrollMarginTop = "4.5rem";
            view?.scrollIntoView({ behavior, block: "start" });
        }, 80);
    };
    $("calprev").addEventListener("click", () => {
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        calSelDay = null;
        calViewChosen = true;
        renderCalendar(currentBundle);
    });
    $("calnext").addEventListener("click", () => {
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        calSelDay = null;
        calViewChosen = true;
        renderCalendar(currentBundle);
    });
    $("calyprev").addEventListener("click", () => { calYear--; renderCalendar(currentBundle); });
    $("calynext").addEventListener("click", () => { calYear++; renderCalendar(currentBundle); });
    $("calics").addEventListener("click", () => {
        const list = upcomingTasks();
        if (!list.length)
            return;
        const slug = calSelBed ? calSelBed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
        const o = { ...noticeOpts(), forecast: undefined };
        const alarms = icsAlarms(list, buildNotices(taskPool(), { ...o, from: o.today, to: list[list.length - 1]?.date ?? o.today }));
        void shareOrDownloadIcs(tasksToIcs(list, currentBundle, remindChoice(), new Date(), alarms), `garden-${slug ? slug + "-" : ""}${TODAY_ISO().slice(0, 4)}.ics`);
    });
    $("calnotify").addEventListener("click", () => {
        void (async () => {
            if (remindersOn()) {
                await disableReminders();
                renderReminderState(copy.clRemindersTurnedOff);
                return;
            }
            const res = await enableReminders(buildReminderPlan());
            if (res.ok) {
                renderReminderState(res.background
                    ? plural("clRemindersArmed", res.count)
                    : copy.clRemindersStoredOnly);
            }
            else {
                const why = res.reason === "denied" ? copy.clRemindersDenied
                    : res.reason === "empty" ? copy.clRemindersEmpty
                        : copy.clRemindersUnsupported;
                renderReminderState(why);
            }
        })();
    });
    const remindSel = $("calremind");
    remindSel.value = remindChoice();
    remindSel.addEventListener("change", () => setRemindChoice(remindSel.value));
    const howSel = $("calnotifyhow"), daySel = $("calnotifyday");
    daySel.replaceChildren(...[6, 0, 1, 2, 3, 4, 5].map((d) => {
        const o = document.createElement("option");
        o.value = String(d);
        o.textContent = weekdayLong(d);
        return o;
    }));
    paintNotify();
    const keepPlan = () => { if (remindersOn() && currentBundle)
        void refreshReminders(buildReminderPlan()); };
    howSel.addEventListener("change", () => { setNotifyCadence(howSel.value); paintNotify(); keepPlan(); });
    daySel.addEventListener("change", () => { setNotifyWeekday(Number(daySel.value)); keepPlan(); });
}

export { category, groupAgenda, initCalendar, lateSentence, monthDay, refreshReminderPlan, renderCalendar, shareOrDownloadIcs, successionWhy, taskSentence, taskWindow, tasksToIcs, weekJobs };
