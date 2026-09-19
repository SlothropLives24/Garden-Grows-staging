import { flashBedRow } from "./plan.js";
import { bindSettling, ownScroll, scrollerFor, seat } from "./seat.js";
import { app, takePlanFresh } from "./state.js";
const $ = (id) => document.getElementById(id);
const HANDLE_PX = 48;
const TAP_PX = 6;
export function projectedStop(vis, v, stops) {
    const lo = Math.min(...stops.map(([, px]) => px)), hi = Math.max(...stops.map(([, px]) => px));
    const proj = Math.min(hi, Math.max(lo, vis + v * 160));
    return stops.reduce((p, q) => (Math.abs(q[1] - proj) < Math.abs(p[1] - proj) ? q : p))[0];
}
export function initPlanSheet() {
    app.resetPlanStep = () => openStepSilently("step-where");
    const shell = $("planshell"), sheet = $("plansheet"), grab = $("sheetgrab");
    if (!shell || !sheet || !grab)
        return;
    const wide = matchMedia("(min-width: 900px)");
    let stop = "def";
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
        sheet.addEventListener(ev, (e) => e.preventDefault());
    }
    const visiblePx = (s) => {
        const h = shell.clientHeight;
        const maxFrac = 0.6;
        return s === "max" ? h * maxFrac : s === "def" ? h * 0.4 : HANDLE_PX;
    };
    const restOpen = () => "def";
    let stopEcho = 0;
    let mapForward = false;
    const echoClaim = (ms) => {
        stopEcho++;
        setTimeout(() => { stopEcho = Math.max(0, stopEcho - 1); }, ms);
    };
    let settleTimer = 0;
    const settledNow = () => {
        clearTimeout(settleTimer);
        if (!shell.classList.contains("settling"))
            return;
        shell.classList.remove("settling");
        window.dispatchEvent(new Event("gg-sheet-settled"));
    };
    sheet.addEventListener("transitionend", (ev) => {
        if (ev.target === sheet && ev.propertyName === "height")
            settledNow();
    });
    bindSettling(() => shell.classList.contains("settling"));
    const apply = (vis, snap) => {
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (snap) {
            stop = snap;
            echoClaim(600);
        }
        const height = `${Math.max(HANDLE_PX, vis)}px`;
        const mapspace = `${Math.max(0, shell.clientHeight - vis)}px`;
        const changed = sheet.style.height !== height || shell.style.getPropertyValue("--mapspace") !== mapspace;
        sheet.style.height = height;
        shell.classList.toggle("stop-closed", vis <= HANDLE_PX + 8);
        shell.style.setProperty("--mapspace", mapspace);
        reserve(vis);
        if (!changed)
            return;
        shell.classList.add("settling");
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settledNow, 340);
    };
    const reserve = (vis) => {
        const body = document.getElementById("sheetbody");
        if (!body)
            return;
        if (!wide.matches && document.body.classList.contains("plan-browse")) {
            body.style.removeProperty("--reserve");
            return;
        }
        const chrome = sheet.clientHeight - body.clientHeight;
        body.style.setProperty("--reserve", `${Math.max(0, Math.round((wide.matches ? body.clientHeight + chrome : vis) - chrome))}px`);
    };
    const size = () => {
        if (!wide.matches && document.body.classList.contains("plan-browse")) {
            shell.style.removeProperty("height");
            shell.style.removeProperty("--mapspace");
            sheet.style.removeProperty("height");
            reserve(0);
            return;
        }
        const top = shell.getBoundingClientRect().top;
        const vh = window.visualViewport?.height ?? window.innerHeight;
        const nav = document.querySelector("header.site nav");
        const navH = nav && getComputedStyle(nav).position === "fixed"
            ? nav.getBoundingClientRect().height : 0;
        const px = `${Math.max(240, vh - Math.max(0, top) - navH - 4)}px`;
        const resized = shell.style.height !== px;
        shell.style.height = px;
        if (resized)
            shell.classList.add("resizing");
        if (!wide.matches)
            apply(visiblePx(stop), null);
        else {
            shell.style.removeProperty("--mapspace");
            reserve(0);
        }
        if (resized) {
            void shell.offsetHeight;
            requestAnimationFrame(() => shell.classList.remove("resizing"));
        }
    };
    let drag = null;
    let samples = [];
    const dragBegin = (y) => {
        drag = { y, vis: visiblePx(stop) };
        samples = [{ y, t: performance.now() }];
        shell.classList.add("dragging");
    };
    const dragMove = (y) => {
        if (!drag)
            return 0;
        samples.push({ y, t: performance.now() });
        if (samples.length > 6)
            samples.shift();
        apply(Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y))), null);
        return Math.abs(y - drag.y);
    };
    const dragEnd = (y, allowTap) => {
        if (!drag)
            return;
        const moved = Math.abs(y - drag.y);
        const vis = Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y)));
        drag = null;
        shell.classList.remove("dragging");
        if (allowTap && moved < TAP_PX) {
            const open = restOpen();
            apply(visiblePx(stop === "closed" ? open : "closed"), stop === "closed" ? open : "closed");
            return;
        }
        const last = samples[samples.length - 1];
        let first = last;
        for (const s of samples)
            if (last.t - s.t <= 120) {
                first = s;
                break;
            }
        const dt = last.t - first.t;
        const v = dt > 0 && Number.isFinite(dt) ? (first.y - last.y) / dt : 0;
        const next = projectedStop(vis, v, ["closed", "def", "max"].map((s) => [s, visiblePx(s)]));
        apply(visiblePx(next), next);
    };
    grab.addEventListener("pointerdown", (ev) => {
        if (wide.matches)
            return;
        try {
            grab.setPointerCapture(ev.pointerId);
        }
        catch { }
        dragBegin(ev.clientY);
    });
    grab.addEventListener("pointermove", (ev) => { if (drag)
        dragMove(ev.clientY); });
    const release = (ev) => dragEnd(ev.clientY, true);
    grab.addEventListener("pointerup", release);
    grab.addEventListener("pointercancel", release);
    {
        const path = $("pathbar");
        let pathDrag = false;
        path?.addEventListener("pointerdown", (ev) => {
            if (wide.matches)
                return;
            pathDrag = false;
            dragBegin(ev.clientY);
        });
        path?.addEventListener("pointermove", (ev) => {
            if (!drag)
                return;
            if (dragMove(ev.clientY) >= TAP_PX && !pathDrag) {
                pathDrag = true;
                try {
                    path.setPointerCapture(ev.pointerId);
                }
                catch { }
            }
        });
        const pathUp = (ev) => {
            if (!drag)
                return;
            const was = pathDrag;
            pathDrag = false;
            dragEnd(ev.clientY, false);
            if (was)
                path.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
        };
        path?.addEventListener("pointerup", pathUp);
        path?.addEventListener("pointercancel", pathUp);
    }
    window.addEventListener("pointerup", (ev) => { if (drag)
        release(ev); });
    window.addEventListener("pointercancel", (ev) => { if (drag)
        release(ev); });
    {
        let bodyClaim = null;
        const sheetBody = $("sheetbody");
        sheetBody?.addEventListener("touchstart", (ev) => {
            bodyClaim = (!wide.matches && !document.body.classList.contains("plan-browse")
                && ev.touches.length === 1 && sheetBody.scrollTop <= 0)
                ? { y: ev.touches[0].clientY, own: false } : null;
        }, { passive: true });
        sheetBody?.addEventListener("touchmove", (ev) => {
            if (!bodyClaim || ev.touches.length !== 1)
                return;
            const y = ev.touches[0].clientY;
            if (!bodyClaim.own) {
                const dy = y - bodyClaim.y;
                if (dy > 8 && sheetBody.scrollTop <= 0) {
                    bodyClaim.own = true;
                    dragBegin(bodyClaim.y);
                }
                else if (dy < -4) {
                    bodyClaim = null;
                    return;
                }
                else
                    return;
            }
            ev.preventDefault();
            dragMove(y);
        }, { passive: false });
        const bodyRelease = (ev) => {
            if (bodyClaim?.own && drag)
                dragEnd(ev.changedTouches[0]?.clientY ?? drag.y, false);
            bodyClaim = null;
        };
        sheetBody?.addEventListener("touchend", bodyRelease);
        sheetBody?.addEventListener("touchcancel", bodyRelease);
    }
    grab.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ")
            return;
        ev.preventDefault();
        const next = stop === "closed" ? restOpen() : "closed";
        apply(visiblePx(next), next);
    });
    const steps = Array.from(document.querySelectorAll("#sheetbody details.step"));
    const body = $("sheetbody");
    const companions = new Set(["sec-ground", "step-mybed"]);
    const paired = (a, b) => companions.has(a) && companions.has(b);
    const EDIT_STEPS = ["sec-ground", "step-mybed", "step-where"];
    const paintTitle = () => {
        const h = document.querySelector("#sheetbody h1 [data-copy='planTitle']");
        if (!h)
            return;
        if (!h.dataset.base && h.textContent)
            h.dataset.base = h.textContent;
        const isOpen = (id) => !!document.getElementById(id)?.open;
        let title = h.dataset.base ?? "";
        if (isOpen("sec-ground"))
            title = "Your beds";
        else if (isOpen("step-plan") || isOpen("step-mybed")) {
            const bed = document.getElementById("candbed")?.value?.trim() ?? "";
            title = bed || "This bed";
        }
        if (h.textContent !== title)
            h.textContent = title;
        const located = !!document.getElementById("lat")?.value;
        const tag = document.querySelector("#sheetbody > .tagline");
        if (tag)
            tag.hidden = title !== (h.dataset.base ?? "") || located;
    };
    document.getElementById("candbed")?.addEventListener("change", paintTitle);
    const updateMode = () => {
        paintTitle();
        const editing = EDIT_STEPS.some((id) => document.getElementById(id)?.open);
        const was = document.body.classList.contains("plan-edit");
        document.body.classList.toggle("plan-edit", editing);
        document.body.classList.toggle("plan-browse", !editing);
        document.body.classList.toggle("locating", !!document.getElementById("step-where")?.open);
        window.dispatchEvent(new Event("gg-step-changed"));
        document.body.classList.remove("map-showcase");
        if (editing && !was)
            window.scrollTo(0, 0);
        size();
    };
    let bedLanding = false;
    window.addEventListener("gg-bed-saved", (ev) => {
        if (wide.matches)
            return;
        if (ev.detail?.kind === "bed" && document.body.classList.contains("plan-edit")) {
            apply(visiblePx("max"), "max");
            bedLanding = true;
            const finalBody = visiblePx("max") - (sheet.clientHeight - body.clientHeight);
            let anchor = null;
            seat(body, () => {
                const l = document.getElementById("arealist");
                const e = document.getElementById("earned-ground");
                const c = document.getElementById("sec-ground")?.querySelector(".stepnext") ?? null;
                if (!e || e.hidden)
                    return null;
                if (!anchor) {
                    anchor = l && l.children.length ? "list" : "receipt";
                    if (anchor === "list" && l && c && c.getBoundingClientRect().bottom - l.getBoundingClientRect().top > finalBody - 6)
                        anchor = "receipt";
                }
                return anchor === "list" ? l : e;
            }, { offset: 6, hold: 1500, reason: "bed-saved" });
            return;
        }
        if (document.body.classList.contains("plan-edit")) {
            apply(visiblePx("closed"), "closed");
        }
        else {
            document.body.classList.add("map-showcase");
            seat(window, "top", { motion: "smooth", hold: 1500, protect: true, reason: "team-showcase" });
        }
    });
    document.getElementById("editground")?.addEventListener("click", () => {
        const g = document.getElementById("sec-ground");
        if (g)
            g.open = true;
    });
    for (const step of steps) {
        step.addEventListener("toggle", () => {
            if (!silentPick)
                arrived = true;
            updateMode();
            repaintPath?.();
            if (!step.open)
                return;
            if (!step.classList.contains("aside"))
                sheet.classList.remove("extras-open");
            for (const other of steps)
                if (other !== step && other.open && !paired(step.id, other.id))
                    other.open = false;
            if (silentPick)
                return;
            const target = step.id === "sec-ground" || step.id === "step-where" ? "def" : "max";
            if (!wide.matches && visiblePx(stop) !== visiblePx(target))
                apply(visiblePx(target), target);
            seat(body, step, { offset: 4, reason: "step-open" });
        });
    }
    for (const btn of document.querySelectorAll("button.stepnext")) {
        btn.addEventListener("click", () => {
            const next = document.getElementById(btn.dataset.next ?? "");
            if (next)
                next.open = true;
        });
    }
    const pathHost = document.getElementById("pathbar");
    const PATH_MAIN = [["step-where", "Where"], ["sec-ground", "Beds"], ["step-plan", "This bed"]];
    const ASIDE_IDS = ["sec-addplant", "step-season"];
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    repaintPath = () => {
        if (!pathHost)
            return;
        const nodes = PATH_MAIN.map(([id, label], i) => {
            const el = document.getElementById(id);
            const mybed = id === "step-plan" ? document.getElementById("step-mybed") : null;
            const sumFrom = mybed?.open && !el?.open ? mybed : el;
            return { id, label, n: i + 1, done: !!el?.classList.contains("done"), open: !!(el?.open || mybed?.open),
                sum: sumFrom?.querySelector(".stepsum")?.textContent ?? "" };
        });
        const extrasActive = sheet.classList.contains("extras-open")
            || ASIDE_IDS.some((id) => document.getElementById(id)?.open);
        let out = "";
        nodes.forEach((nd, i) => {
            if (i) {
                const prev = nodes[i - 1];
                const conn = prev.done && nd.done ? " done" : prev.done && nd.open ? " into" : "";
                out += `<span class="pconn${conn}"></span>`;
            }
            const locked = nd.id === "step-plan" && lastSeen.areaCount === 0;
            const cls = (nd.done ? " done" : "") + (nd.open ? " current" : "") + (locked ? " locked" : "");
            out += `<button type="button" class="pnode${cls}" data-step="${nd.id}"`
                + (locked ? ' aria-disabled="true"' : "")
                + (nd.open ? ' aria-current="step"' : "")
                + `><span class="pdotc">${nd.done && !nd.open ? CHECK : nd.n}</span>`
                + `<span class="plabel">${esc(nd.label)}</span>`
                + (nd.done && nd.sum ? `<span class="psum">${esc(nd.sum)}</span>` : "")
                + "</button>";
        });
        out += `<span class="pconn${nodes[2].done && extrasActive ? " into" : ""}"></span>`
            + `<button type="button" class="pnode extras${extrasActive ? " current" : ""}" data-extras="1"`
            + (extrasActive ? ' aria-current="step"' : "")
            + '><span class="pdotc">+</span><span class="plabel">extras</span></button>';
        pathHost.innerHTML = out;
        const peek = document.getElementById("sheetpeek");
        if (peek) {
            const active = nodes.find((nd) => nd.open)?.label ?? (extrasActive ? "extras" : null);
            peek.textContent = active ? `${active} - pull up to continue` : "Plan your garden - pull up";
        }
    };
    body.addEventListener("click", (e) => {
        const tab = e.target.closest(".bedtab");
        if (!tab)
            return;
        const target = tab.dataset.tab ?? "";
        const d = document.getElementById(target);
        if (d && !d.open)
            d.open = true;
        else if (d)
            seat(scrollerFor(d), d, { motion: "smooth", reason: "tab-reseat" });
    });
    const paintTabs = () => {
        const planOpen = !!document.getElementById("step-plan")?.open;
        const mybedOpen = !!document.getElementById("step-mybed")?.open;
        for (const t of document.querySelectorAll(".bedtab")) {
            const on = t.dataset.tab === "step-plan" ? planOpen && !mybedOpen : mybedOpen;
            t.setAttribute("aria-selected", String(on));
        }
    };
    for (const id of ["step-plan", "step-mybed"])
        document.getElementById(id)?.addEventListener("toggle", paintTabs);
    paintTabs();
    pathHost?.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn)
            return;
        if (btn.dataset.extras) {
            sheet.classList.add("extras-open");
            for (const s of steps)
                if (s.open && !s.classList.contains("aside"))
                    s.open = false;
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            repaintPath?.();
            seat(body, () => document.querySelector(".stepmore"), { offset: 4, motion: "smooth", reason: "extras" });
            return;
        }
        if (btn.dataset.step === "step-plan" && lastSeen.areaCount === 0) {
            const g = document.getElementById("sec-ground");
            if (g)
                g.open = true;
            flashBedRow();
            return;
        }
        const d = document.getElementById(btn.dataset.step ?? "");
        if (!d)
            return;
        if (d.open) {
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            seat(body, d, { offset: 4, motion: "smooth", reason: "step-reopen" });
        }
        else
            d.open = true;
    });
    repaintPath();
    body.addEventListener("scroll", () => {
        if (stopEcho > 0)
            return;
        if (ownScroll(body))
            return;
        if (mapForward)
            return;
        if (!wide.matches && stop === "def")
            apply(visiblePx("max"), "max");
    }, { passive: true });
    body.addEventListener("focusin", (ev) => {
        if (!wide.matches && stop !== "max")
            apply(visiblePx("max"), "max");
        const field = ev.target;
        if (field && body.contains(field)) {
            seat(body, field, { block: "nearest", offset: 12, motion: "smooth", hold: 600, reason: "field-focus" });
        }
    });
    document.getElementById("mapsvg")?.addEventListener("pointerdown", () => {
        if (!wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
    });
    {
        const savecard = document.getElementById("savecard");
        if (savecard) {
            let lastShowing = !savecard.hidden;
            new MutationObserver(() => {
                const showing = !savecard.hidden;
                if (showing === lastShowing)
                    return;
                lastShowing = showing;
                if (showing)
                    bedLanding = false;
                else if (bedLanding) {
                    bedLanding = false;
                    return;
                }
                if (wide.matches || !document.body.classList.contains("plan-edit"))
                    return;
                const to = showing ? "closed" : "def";
                apply(visiblePx(to), to);
            }).observe(savecard, { attributes: true, attributeFilter: ["hidden"] });
        }
    }
    window.addEventListener("gg-sheet-collapse", () => {
        if (!wide.matches)
            apply(visiblePx("closed"), "closed");
    });
    window.addEventListener("gg-sheet-map", () => {
        if (wide.matches)
            return;
        mapForward = true;
        if (visiblePx(stop) > visiblePx("def"))
            apply(visiblePx("def"), "def");
    });
    window.addEventListener("gg-sheet-reveal", (ev) => {
        const name = String(ev.detail?.bed ?? "");
        const el = name ? document.querySelector(`.bedcard[data-bed="${CSS.escape(name)}"]`) : null;
        if (!el)
            return;
        for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null)
            d.open = true;
        if (!wide.matches && visiblePx(stop) < visiblePx("def")) {
            mapForward = false;
            apply(visiblePx("def"), "def");
        }
        const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
        seat(scrollerFor(el), el, { offset: 6, motion, force: true, hold: 1500, reason: "next-act" });
    });
    window.addEventListener("gg-open-step", (ev) => {
        const step = String(ev.detail?.step ?? "");
        if (step)
            openStepSilently(step);
    });
    for (const el of [body, grab])
        el.addEventListener("pointerdown", () => { mapForward = false; }, { passive: true });
    const hdr = document.querySelector("header.site");
    let expandedAt = 0;
    document.getElementById("hdrtoggle")?.addEventListener("click", () => {
        hdr?.classList.add("expanded");
        expandedAt = Date.now();
    });
    const condense = () => hdr?.classList.remove("expanded");
    document.getElementById("mapsvg")?.addEventListener("pointerdown", condense);
    grab.addEventListener("pointerdown", condense);
    body.addEventListener("scroll", () => {
        if (Date.now() - expandedAt > 600)
            condense();
    }, { passive: true });
    window.addEventListener("resize", size);
    window.visualViewport?.addEventListener("resize", size);
    wide.addEventListener("change", size);
    window.addEventListener("hashchange", () => setTimeout(() => { stop = restOpen(); size(); }, 60));
    window.addEventListener("scroll", () => {
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (!document.getElementById("page-plan")?.hidden && window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    }, { passive: true });
    const above = new ResizeObserver(() => size());
    const header = document.querySelector("header.site");
    if (header)
        above.observe(header);
    for (const id of ["examplebanner", "draftbanner"]) {
        const el = document.getElementById(id);
        if (el)
            above.observe(el);
    }
    stop = restOpen();
    updateMode();
    setTimeout(size, 0);
    onLocated = (located) => {
        if (located && !wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
        if (located) {
            paintTitle();
            const addr = document.getElementById("addr");
            if (addr)
                seat(body, addr, { block: "nearest", hold: 1000, reason: "located" });
        }
    };
    liftColdWhereDrawer = () => { if (!wide.matches)
        apply(visiblePx("max"), "max"); };
}
let onLocated = null;
let liftColdWhereDrawer = null;
let wasLocated = false;
let repaintPath = null;
let arrived = false;
let lastSeen = { located: false, areaCount: 0 };
export function endArrival() {
    if (arrived)
        return;
    arrived = true;
    pickOpeningStep(lastSeen.located, lastSeen.areaCount);
    if (typeof document !== "undefined")
        document.body.classList.add("plan-arrived");
}
export function arrivalSettled() {
    return arrived;
}
let silentPick = false;
function holdTopBriefly(ms = 1200) {
    if (typeof window === "undefined")
        return;
    seat(window, "top", { hold: ms, protect: true, reason: "arrival" });
}
function pickOpeningStep(located, areaCount) {
    const want = takePlanFresh() ? "step-where" : (areaCount > 0 ? "step-plan" : "step-where");
    openStepSilently(want);
    if (want === "step-where" && !located)
        liftColdWhereDrawer?.();
}
function openStepSilently(want) {
    const target = document.getElementById(want);
    if (!target || target.open)
        return;
    for (const id of ["step-where", "sec-ground", "step-plan"]) {
        const el = document.getElementById(id);
        if (el && el !== target && el.open)
            el.open = false;
    }
    silentPick = true;
    target.open = true;
    silentPick = false;
    holdTopBriefly();
}
function setStep(id, done, summary) {
    const step = document.getElementById(id);
    if (!step)
        return;
    const sum = step.querySelector(".stepsum");
    if (sum)
        sum.textContent = summary;
    if (done != null) {
        step.classList.toggle("done", done);
        const badge = step.querySelector(".badge");
        if (badge) {
            if (!badge.dataset.n)
                badge.dataset.n = badge.textContent ?? "";
            badge.textContent = done ? "" : badge.dataset.n;
        }
    }
}
export function updateStepStates(s) {
    if (s.located && !wasLocated)
        onLocated?.(true);
    wasLocated = s.located;
    lastSeen = { located: s.located, areaCount: s.areaCount };
    setStep("step-where", s.located, s.located ? (s.zoneLabel ? `located · zone ${s.zoneLabel}` : "located") : "set your location");
    setStep("sec-ground", s.areaCount > 0, s.areaCount ? `${s.areaCount} bed${s.areaCount === 1 ? "" : "s"}` : "add a bed");
    document.getElementById("sec-ground")?.classList.toggle("has-beds", s.areaCount > 0);
    const need = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = met;
    };
    need("need-where", s.located);
    need("need-ground", s.areaCount > 0);
    const earned = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = !met;
    };
    earned("earned-where", s.located);
    earned("earned-ground", s.areaCount > 0);
    if (s.located) {
        const bits = [
            s.address ? s.address : null,
            s.zoneLabel ? `zone ${s.zoneLabel}` : null,
            s.frostP50 ? `last frost usually ${s.frostP50}` : null,
            s.freezeP50 ? `first freeze usually ${s.freezeP50}` : null,
            s.seasonDays != null ? `season ~${s.seasonDays} days` : null,
        ].filter(Boolean).join(" · ");
        const el = document.getElementById("earned-where");
        if (el)
            el.textContent = bits
                ? `Located. ${bits}. These are your ground's own odds, live wherever you plan and plant.`
                : "Located - your ground's own dates are live wherever you plan and plant.";
    }
    const fit = document.querySelectorAll("#guilds .guild.fits:not(.variant)").length;
    const total = document.querySelectorAll("#guilds .guild:not(.variant)").length;
    setStep("step-plan", null, total ? `${fit} of ${total} teams fit` : "");
    setStep("step-mybed", null, s.myBedCount ? `${s.myBedCount} plant${s.myBedCount === 1 ? "" : "s"}` : "");
    const ups = document.querySelectorAll("#uplist .upitem").length;
    setStep("sec-addplant", null, ups ? `${ups} added` : "");
    repaintPath?.();
}
