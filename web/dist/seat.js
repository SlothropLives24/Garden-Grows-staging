export function seatNext(phase, ev, motion) {
    if (ev === "user" || ev === "expire" || ev === "supersede")
        return { phase: "done", act: null };
    switch (phase) {
        case "waiting":
            if (ev === "settled")
                return motion === "smooth" ? { phase: "flight", act: "seat" } : { phase: "hold", act: "seat" };
            return { phase: "waiting", act: null };
        case "flight":
            if (ev === "landed")
                return { phase: "hold", act: "correct" };
            return { phase: "flight", act: null };
        case "hold":
            if (ev === "reflow" || ev === "settled")
                return { phase: "hold", act: "correct" };
            return { phase: "hold", act: null };
        case "done":
            return { phase: "done", act: null };
    }
}
let settling = () => false;
let settledEvent = "gg-sheet-settled";
export function bindSettling(isSettling, event = "gg-sheet-settled") {
    settling = isSettling;
    settledEvent = event;
}
const live = new Map();
const own = new Map();
const isWin = (s) => typeof Window !== "undefined" && s instanceof Window;
const scrollTopOf = (s) => (isWin(s) ? s.scrollY : s.scrollTop);
const viewOf = (s) => {
    if (isWin(s))
        return { top: 0, bottom: s.innerHeight, height: s.innerHeight };
    const r = s.getBoundingClientRect();
    return { top: r.top + s.clientTop, bottom: r.top + s.clientTop + s.clientHeight, height: s.clientHeight };
};
const maxScroll = (s) => isWin(s)
    ? Math.max(0, document.documentElement.scrollHeight - s.innerHeight)
    : Math.max(0, s.scrollHeight - s.clientHeight);
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export function ownScroll(s) { return (own.get(s) ?? 0) > 0; }
function claimOwn(s, ms) {
    own.set(s, (own.get(s) ?? 0) + 1);
    setTimeout(() => own.set(s, Math.max(0, (own.get(s) ?? 0) - 1)), ms);
}
export function scrollerFor(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1)
            return p;
    }
    return window;
}
function goal(s) {
    const cur = scrollTopOf(s.scroller);
    if (s.target === "top")
        return 0;
    const el = typeof s.target === "function" ? s.target() : s.target;
    if (!el || !el.isConnected || el.hidden)
        return null;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0)
        return null;
    const v = viewOf(s.scroller);
    let want;
    if (s.opts.block === "nearest") {
        if (r.top >= v.top && r.bottom <= v.bottom)
            return cur;
        want = r.top < v.top ? cur + (r.top - v.top) - s.opts.offset : cur + (r.bottom - v.bottom) + s.opts.offset;
    }
    else if (s.opts.block === "center") {
        want = cur + (r.top - v.top) - Math.max(0, (v.height - r.height) / 2);
    }
    else {
        want = cur + (r.top - v.top) - s.opts.offset;
    }
    return Math.max(0, Math.min(maxScroll(s.scroller), Math.round(want)));
}
function scrollTo(s, top, motion) {
    claimOwn(s.scroller, motion === "smooth" ? 900 : 300);
    const behavior = motion === "smooth" ? "smooth" : "auto";
    if (isWin(s.scroller))
        s.scroller.scrollTo({ top, behavior });
    else
        s.scroller.scrollTo({ top, behavior });
}
function end(s, ev) {
    if (s.phase === "done")
        return;
    s.phase = seatNext(s.phase, ev, s.opts.motion).phase;
    cancelAnimationFrame(s.raf);
    for (const c of s.cleanup.splice(0))
        c();
    if (live.get(s.scroller) === s)
        live.delete(s.scroller);
}
function feed(s, ev) {
    if (s.phase === "done")
        return;
    const before = s.phase;
    const { phase, act } = seatNext(s.phase, ev, s.opts.motion);
    if (phase === "done") {
        end(s, ev);
        return;
    }
    s.phase = phase;
    if (act === "seat") {
        const top = goal(s);
        const cur = scrollTopOf(s.scroller);
        const moved = top != null && Math.abs(top - cur) > 2;
        if (moved)
            scrollTo(s, top, s.opts.motion);
        if (phase === "flight")
            armFlight(s, moved);
    }
    else if (act === "correct") {
        const top = goal(s);
        if (top != null && Math.abs(top - scrollTopOf(s.scroller)) > 2)
            scrollTo(s, top, "instant");
    }
    if (phase === "hold" && before !== "hold")
        armHold(s);
}
function armFlight(s, moved) {
    if (!moved) {
        feed(s, "landed");
        return;
    }
    const tgt = isWin(s.scroller) ? document : s.scroller;
    let done = false;
    const landed = () => { if (!done) {
        done = true;
        feed(s, "landed");
    } };
    if ("onscrollend" in window) {
        tgt.addEventListener("scrollend", landed, { once: true });
        s.cleanup.push(() => tgt.removeEventListener("scrollend", landed));
    }
    else {
        let last = scrollTopOf(s.scroller), still = 0;
        const tick = setInterval(() => {
            const now = scrollTopOf(s.scroller);
            still = now === last ? still + 1 : 0;
            last = now;
            if (still >= 2) {
                clearInterval(tick);
                landed();
            }
        }, 50);
        s.cleanup.push(() => clearInterval(tick));
    }
    const cap = setTimeout(landed, 900);
    s.cleanup.push(() => clearTimeout(cap));
}
function armHold(s) {
    const reflow = () => {
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(() => feed(s, "reflow"));
    };
    const root = isWin(s.scroller) ? document.body : s.scroller;
    const mo = new MutationObserver(reflow);
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "open", "class", "style"] });
    s.cleanup.push(() => mo.disconnect());
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(reflow);
        if (!isWin(s.scroller))
            ro.observe(s.scroller);
        const el = typeof s.target === "function" ? s.target() : s.target;
        if (el && el !== "top")
            ro.observe(el);
        s.cleanup.push(() => ro.disconnect());
    }
    const st = isWin(s.scroller) ? window : s.scroller;
    st.addEventListener("scroll", reflow, { passive: true });
    s.cleanup.push(() => st.removeEventListener("scroll", reflow));
    window.addEventListener(settledEvent, reflow);
    s.cleanup.push(() => window.removeEventListener(settledEvent, reflow));
    window.visualViewport?.addEventListener("resize", reflow);
    s.cleanup.push(() => window.visualViewport?.removeEventListener("resize", reflow));
    const expire = setTimeout(() => feed(s, "expire"), s.opts.hold);
    s.cleanup.push(() => clearTimeout(expire));
}
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
export function seat(scroller, target, o = {}) {
    const cur = live.get(scroller);
    if (cur && cur.opts.protect && cur.phase !== "done" && !o.force)
        return false;
    if (cur)
        end(cur, "supersede");
    const motion = o.motion === "smooth" && !reduced() ? "smooth" : "instant";
    const s = {
        scroller, target, phase: "waiting", cleanup: [], raf: 0,
        opts: { offset: 0, block: "start", hold: 1000, protect: false, ...o, motion },
    };
    live.set(scroller, s);
    const cancel = o.cancelOn ?? (isWin(scroller) ? ["pointerdown", "wheel", "touchstart", "keydown"] : ["pointerdown", "wheel", "touchstart"]);
    const tgt = isWin(scroller) ? window : scroller;
    const onUser = (ev) => {
        if (ev.type === "keydown" && !isWin(scroller) && !NAV_KEYS.has(ev.key))
            return;
        feed(s, "user");
    };
    for (const ev of cancel) {
        tgt.addEventListener(ev, onUser, { passive: true, capture: true });
        s.cleanup.push(() => tgt.removeEventListener(ev, onUser, { capture: true }));
    }
    if (motion === "instant" || !settling()) {
        feed(s, "settled");
    }
    else {
        const onSettled = () => feed(s, "settled");
        window.addEventListener(settledEvent, onSettled, { once: true });
        s.cleanup.push(() => window.removeEventListener(settledEvent, onSettled));
        const cap = setTimeout(onSettled, 700);
        s.cleanup.push(() => clearTimeout(cap));
    }
    return true;
}
export function release(scroller) {
    const cur = live.get(scroller);
    if (cur)
        end(cur, "user");
}
export function seatPhase(scroller) {
    const cur = live.get(scroller);
    return cur ? { phase: cur.phase, reason: cur.opts.reason } : null;
}
