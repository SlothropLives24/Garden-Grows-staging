const KEY = "gg-perf";
function enabled() {
    try {
        const q = new URLSearchParams(location.search);
        if (q.has("perf")) {
            const on = q.get("perf") !== "0";
            try {
                on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY);
            }
            catch { }
            return on;
        }
        return localStorage.getItem(KEY) != null;
    }
    catch {
        return false;
    }
}
function routeOf() {
    const h = location.hash.replace(/^#\/?/, "");
    return (h.split(/[/?]/)[0] || "start");
}
export function initPerfHud() {
    if (!enabled())
        return;
    const hud = document.createElement("div");
    hud.id = "perfhud";
    hud.setAttribute("aria-hidden", "true");
    Object.assign(hud.style, {
        position: "fixed", left: "8px", bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)", zIndex: "2147483647",
        font: "600 12px/1.3 ui-monospace, monospace", color: "#fff", background: "rgba(20,20,20,.82)",
        padding: "4px 8px", borderRadius: "8px", pointerEvents: "none", maxWidth: "70vw", whiteSpace: "pre",
    });
    hud.textContent = "perf: tap a tab";
    const attach = () => { (document.body || document.documentElement).appendChild(hud); };
    if (document.body)
        attach();
    else
        window.addEventListener("DOMContentLoaded", attach, { once: true });
    let measuring = false;
    const measure = (from) => {
        if (measuring)
            return;
        measuring = true;
        const to = routeOf();
        const t0 = performance.now();
        let last = t0;
        let maxGap = 0;
        let content = -1;
        const page = document.getElementById(`page-${to}`);
        const hasContent = () => !!page && !page.hidden && page.getBoundingClientRect().height > 160
            && (page.innerText || "").trim().length > 24;
        const tick = () => {
            const now = performance.now();
            maxGap = Math.max(maxGap, now - last);
            last = now;
            if (content < 0 && hasContent())
                content = Math.round(now - t0);
            const done = content >= 0 || now - t0 > 8000;
            if (!done) {
                requestAnimationFrame(tick);
                return;
            }
            const total = content >= 0 ? content : Math.round(now - t0);
            const stall = Math.round(maxGap);
            const verdict = content < 0 ? "no content in 8s" : stall > total * 0.5 ? `blocked ${stall}ms (sync)` : `idle wait, worst stall ${stall}ms`;
            hud.textContent = `${from}→${to}  ${total}ms\n${verdict}`;
            measuring = false;
        };
        requestAnimationFrame(tick);
    };
    let from = routeOf();
    window.addEventListener("hashchange", () => {
        const prev = from;
        from = routeOf();
        if (from !== prev)
            measure(prev);
    });
}
