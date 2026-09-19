import { scrollerFor, seat } from "./seat.js";
import { html, render, useEffect, useState } from "./ui.js";
import { currentRoute } from "./router.js";
import { buzz } from "./haptics.js";
const SECTIONS = [
    { route: "plan", label: "Plan", icon: [
            "M7 20h10",
            "M10 20c5.5-2.5.8-6.4 3-10",
            "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
            "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
        ] },
    { route: "calendar", label: "Calendar", icon: [
            "M8 2v4", "M16 2v4", "M3 10h18",
            "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
        ] },
    { route: "log", label: "Log", lockable: true, icon: [
            "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z", "m15 5 4 4",
        ] },
    { route: "why", label: "Evidence", icon: [
            "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z",
            "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
        ] },
    { route: "account", label: "Account", icon: [
            "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
            "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
        ] },
];
let gated = false;
const gatedListeners = new Set();
export function setNavGated(g) {
    gated = g;
    for (const fn of gatedListeners)
        fn(g);
}
export function go(route, target) {
    const seatTarget = () => {
        if (!target)
            return;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => {
            const el = document.getElementById(target);
            if (!el)
                return;
            for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null)
                d.open = true;
            seat(scrollerFor(el), el, { offset: 8, motion: behavior === "smooth" ? "smooth" : "instant", force: true, hold: 1200, reason: "deep-link" });
        }, 80);
    };
    if (currentRoute() === route)
        seatTarget();
    else {
        window.addEventListener("hashchange", () => setTimeout(seatTarget, 0), { once: true });
        location.hash = `#/${route}`;
    }
}
function NavTabs() {
    const [isGated, setGated] = useState(gated);
    const [route, setRoute] = useState(currentRoute());
    useEffect(() => {
        gatedListeners.add(setGated);
        const onHash = () => setRoute(currentRoute());
        window.addEventListener("hashchange", onHash);
        return () => {
            gatedListeners.delete(setGated);
            window.removeEventListener("hashchange", onHash);
        };
    }, []);
    return html `<div class="navrow">
    ${SECTIONS.map((s) => html `
      <a class=${"tab tab-" + s.route} key=${s.route} href=${"#/" + s.route}
         aria-current=${route === s.route ? "page" : null}
         title=${isGated && s.lockable ? "Sign in to open - everything on this device carries over" : null}
         onClick=${() => {
        buzz(8);
        setRoute(s.route);
    }}
      ><svg class="tabicon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
            stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"
        >${s.icon.map((d) => html `<path d=${d} key=${d} />`)}</svg><span class="tablabel"
        >${s.label}</span>${isGated && s.lockable ? html `<span class="navlock">sign in</span>` : ""}</a>`)}
  </div>`;
}
export function initNav() {
    const host = document.querySelector("header.site nav");
    if (!host)
        return;
    host.textContent = "";
    render(html `<${NavTabs} />`, host);
}
