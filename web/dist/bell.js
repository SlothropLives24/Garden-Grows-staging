import './chunk-lutet8cz.js';
import { TODAY_ISO, app, el, weekdayLong, fmtMonthDay, weekTaskPool, isSignedIn, currentGardenCtx, notifyCadence, weekdayShort, commonName, taskSentence, notifyWeekday } from './core.js';
import { keptMarks, bellList, noticeBody, addDays, bellBadge } from './chunk-kbdsyvxe.js';
import { copy, fillCopy } from './paint.js';
import './chunk-l5cseoso.js';

const READ_KEY = "gg-notice-read";
let bundleNow = null;
let wired = false;
function readMarks() {
    try {
        const v = JSON.parse(localStorage.getItem(READ_KEY) ?? "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    }
    catch {
        return {};
    }
}
function writeMarks(m) {
    try {
        localStorage.setItem(READ_KEY, JSON.stringify(m));
    }
    catch { }
}
function poolFor(bundle, today) {
    return weekTaskPool(bundle, [currentGardenCtx()], addDays(today, -29), !isSignedIn(), 35);
}
function current(bundle) {
    const today = TODAY_ISO();
    const marks = keptMarks(readMarks(), today);
    const pool = poolFor(bundle, today);
    return { today, marks, pool, ...bellList(pool, { today, cadence: notifyCadence(), weekday: notifyWeekday(),
            sentence: (t) => taskSentence(t, bundle), name: (sid) => commonName(bundle, sid),
            ...(app.forecastSaid ? { forecast: app.forecastSaid } : {}) }, marks) };
}
function whenWord(date, today) {
    if (date === today)
        return copy.nbToday;
    if (date === addDays(today, -1))
        return copy.nbYesterday;
    const d = new Date(`${date}T12:00:00Z`).getUTCDay();
    return fillCopy("nbWhen", { day: weekdayShort(d), date: fmtMonthDay(date) });
}
function paintButton(unread, hasGarden) {
    const btn = document.getElementById("hbell");
    const badge = document.getElementById("hbellcount");
    if (!btn || !badge)
        return;
    btn.hidden = !hasGarden;
    const b = bellBadge(unread);
    badge.textContent = b;
    badge.hidden = !b;
    btn.setAttribute("aria-label", unread ? fillCopy(unread === 1 ? "nbAriaNewOne" : "nbAriaNewMany", { n: unread }) : copy.nbAria);
}
function setOpen(open, focusBack = false) {
    const panel = document.getElementById("bellpanel");
    const btn = document.getElementById("hbell");
    if (!panel || !btn)
        return;
    if (open) {
        const r = btn.getBoundingClientRect();
        panel.style.top = `${Math.round(r.bottom + 6)}px`;
        renderPanel();
    }
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open)
        (panel.querySelector(".bellitem, .bellmark:not([disabled]), .bellclose"))?.focus();
    else if (focusBack)
        btn.focus();
}
function markRead(ids) {
    const today = TODAY_ISO();
    const m = keptMarks(readMarks(), today);
    for (const id of ids)
        m[id] = today;
    writeMarks(m);
}
const stripe = (n) => (n.kind === "headsup" ? n.lines[0]?.kind ?? "week" : "week");
function renderPanel() {
    const panel = document.getElementById("bellpanel");
    if (!panel || !bundleNow)
        return;
    const c = current(bundleNow);
    const head = el("div", "bellhead");
    const h = el("h2", "bellh", copy.nbTitle);
    h.id = "bellpanelh";
    const mark = el("button", "bellmark", copy.nbMarkAll);
    mark.type = "button";
    mark.disabled = !c.items.some((x) => x.fresh && !x.read);
    mark.addEventListener("click", () => {
        markRead(c.items.map((x) => x.notice.id));
        renderPanel();
        paintButton(0, true);
        panel.querySelector(".bellitem")?.focus();
    });
    const close = el("button", "bellclose", "×");
    close.type = "button";
    close.setAttribute("aria-label", copy.nbClose);
    close.addEventListener("click", () => setOpen(false, true));
    head.append(h, mark, close);
    const body = [];
    if (!c.items.length) {
        const cad = notifyCadence();
        body.push(el("p", "bellempty", cad === "weekly" ? fillCopy("nbEmptyWeekly", { day: weekdayLong(notifyWeekday()) })
            : cad === "daily" ? copy.nbEmptyDaily : copy.nbEmptyHeads));
    }
    else {
        const ul = el("ul", "belllist");
        for (const { notice: n, read, fresh } of c.items) {
            const isNew = fresh && !read;
            const li = el("li");
            const b = el("button", `bellitem${isNew ? "" : " read"} stripe-${stripe(n)}`);
            b.type = "button";
            b.dataset.id = n.id;
            const top = el("span", "belltop");
            if (isNew) {
                top.append(el("span", "belldot"));
                top.append(el("span", "vh", copy.nbNew));
            }
            top.append(el("span", "belltitle", n.title), el("span", "bellwhen", n.to > n.date
                ? fillCopy("nbRange", { from: fmtMonthDay(n.date), to: fmtMonthDay(n.to) }) : whenWord(n.date, c.today)));
            b.append(top);
            for (const line of noticeBody(n).split("\n"))
                b.append(el("span", "bellline", line));
            b.addEventListener("click", () => {
                markRead([n.id]);
                setOpen(false);
                if (bundleNow)
                    refreshBell(bundleNow);
                void app.openWeek?.(undefined, null, n.kind === "headsup" ? n.date : undefined);
            });
            li.append(b);
            ul.append(li);
        }
        body.push(ul);
    }
    const foot = el("button", "bellfoot", copy.nbSettings);
    foot.type = "button";
    foot.addEventListener("click", () => {
        setOpen(false);
        void app.openWeek?.().then(() => {
            const d = document.getElementById("calexport");
            if (d) {
                d.open = true;
                d.scrollIntoView({ block: "start" });
                d.querySelector("select")?.focus();
            }
        });
    });
    panel.replaceChildren(head, ...body, foot);
}
function wire() {
    if (wired)
        return;
    const btn = document.getElementById("hbell");
    const panel = document.getElementById("bellpanel");
    if (!btn || !panel)
        return;
    wired = true;
    btn.addEventListener("click", () => setOpen(panel.hasAttribute("hidden")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden)
        setOpen(false, true); });
    document.addEventListener("pointerdown", (e) => {
        if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target))
            setOpen(false);
    });
    addEventListener("hashchange", () => { if (!panel.hidden)
        setOpen(false); });
}
function refreshBell(bundle) {
    bundleNow = bundle;
    wire();
    const c = current(bundle);
    paintButton(c.unread, c.pool.length > 0);
    writeMarks(c.marks);
    const panel = document.getElementById("bellpanel");
    if (panel && !panel.hidden)
        renderPanel();
}

export { refreshBell };
