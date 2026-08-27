// The section navigation (D-025; Organic redesign): five sections, every surface one hop away.
// One DOM, two presentations - a fixed five-tab bottom bar on phones (the design's "garden
// path" chrome), an inline top-bar link row on wide screens (CSS switches at 768px; the
// Account tab hides on desktop where the auth chip covers it). The old dropdown menus are
// retired: deep-link targets live in each screen's own UI now. DOM layer, rendered with the
// vendored shell framework (D-024). Icons are inline Lucide strokes (D-105: no emoji, ever).
import { html, render, useEffect, useState } from "./ui.js";
import { currentRoute } from "./router.js";
// Lucide icon paths (lucide.dev, ISC) at the design's stroke settings; drawn inline so the
// CSP stays self-contained and the glyphs inherit currentColor.
const SECTIONS = [
    { route: "plan", label: "Plan", icon: [
            "M7 20h10",
            "M10 20c5.5-2.5.8-6.4 3-10",
            "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
            "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
        ] },
    // calendar: not lockable since phase C (the D-023 amendment) - it SEES signed out; the account
    // keeps. Only the Log still wears the padlock.
    { route: "calendar", label: "Calendar", icon: [
            "M8 2v4", "M16 2v4", "M3 10h18",
            "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
        ] },
    { route: "log", label: "Log", lockable: true, icon: [
            "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z", "m15 5 4 4",
        ] },
    { route: "why", label: "Why", icon: [
            "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z",
            "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
        ] },
    { route: "account", label: "Account", icon: [
            "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
            "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
        ] },
];
// The D-023 gate state lives in app.ts (it knows the session + backend); the nav only wears
// it. Module-level so setNavGated works whether or not the component has mounted yet.
let gated = false;
const gatedListeners = new Set();
export function setNavGated(g) {
    gated = g;
    for (const fn of gatedListeners)
        fn(g);
}
/** Route, then scroll to a deep-link target - kept for in-page callers now that the nav's
 *  dropdowns are gone (the targets moved into each screen's own UI). Setting location.hash
 *  fires the router asynchronously (and the router scrolls to top), so the deep-link scroll
 *  must run after that - the once-listener registers AFTER the router's, so it fires second,
 *  and the setTimeout puts the scroll after its reset. */
export function go(route, target) {
    const scroll = () => {
        if (!target)
            return;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => {
            // THE TARGET IS RESOLVED HERE, NOT BEFORE THE TIMEOUT. A panel that rebuilds its DOM during
            // these 80 ms - which a caller that changes panel state before navigating routinely does -
            // leaves an element resolved earlier DETACHED, and scrollIntoView on a detached node is a
            // silent no-op: the navigation looks like it worked and the page never moves, stranding the
            // user wherever they were. Reported from the phone as being "bumped down" to another section.
            const el = document.getElementById(target);
            if (!el)
                return;
            // A deep-link target may sit inside a collapsed workflow step (D-079 slice 3) - open the
            // enclosing <details> chain first, or scrollIntoView lands on a hidden element.
            for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null)
                d.open = true;
            // Plan-sheet targets scroll ONLY the sheet body - scrollIntoView would also scroll the
            // page (overflow:hidden still scrolls programmatically) and shove the map toolbar under
            // the sticky header. Other pages scroll normally.
            const sb = document.getElementById("sheetbody");
            if (sb && sb.contains(el)) {
                sb.scrollBy({ top: el.getBoundingClientRect().top - sb.getBoundingClientRect().top - 8, behavior });
            }
            else {
                el.scrollIntoView({ behavior, block: "start" });
            }
        }, 80);
    };
    if (currentRoute() === route)
        scroll();
    else {
        window.addEventListener("hashchange", () => setTimeout(scroll, 0), { once: true });
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
      ><svg class="tabicon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
            stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"
        >${s.icon.map((d) => html `<path d=${d} key=${d} />`)}</svg><span class="tablabel"
        >${s.label}</span>${isGated && s.lockable ? html `<span class="navlock">locked</span>` : ""}</a>`)}
  </div>`;
}
export function initNav() {
    const host = document.querySelector("header.site nav");
    if (!host)
        return;
    host.textContent = "";
    render(html `<${NavTabs} />`, host);
}
