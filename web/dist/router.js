// Hash router for the app shell (D-018). DOM-layer file - NOT part of the portable engine core.
// Routes are `#/plan`, `#/log`, … - each maps to a <section class="page" id="page-NAME"> in
// index.html. Unknown hashes fall back to the default page instead of a blank screen.
const DEFAULT_ROUTE = "plan";
export function currentRoute() {
    const m = location.hash.match(/^#\/([a-z]+)/);
    return m ? m[1] : DEFAULT_ROUTE;
}
function apply(route) {
    // #/content has no page since O55 - it is the EDIT-MODE BOOKMARK, owned by editor.ts, which
    // rewrites the hash itself. Touching it here would race that handler: this listener runs first
    // and the not-found fallback below would rewrite the hash to #/plan before the editor sees it.
    if (route === "content")
        return;
    const pages = document.querySelectorAll("main > section.page");
    let found = false;
    for (const p of pages) {
        const match = p.id === `page-${route}`;
        p.hidden = !match;
        if (match)
            found = true;
    }
    if (!found) {
        location.hash = `#/${DEFAULT_ROUTE}`;
        return;
    }
    setViewport(route); // O108b: lock pinch-zoom on Plan, leave every other route zoomable
    // the nav's active state (aria-current) is owned by nav.ts, which listens for the same event
    // the tab/window title says where you are - screen readers announce it on route change. The
    // landing (D-027) is the front door, so it carries the bare brand rather than a "Start -" prefix.
    document.title = route === "start"
        ? "Milpa Gardens"
        : `${route.charAt(0).toUpperCase()}${route.slice(1)} - Milpa Gardens`;
    // SCROLL TO THE TOP ONLY WHEN THE PAGE ACTUALLY CHANGED. A hash that changes only its QUERY -
    // `#/answers` -> `#/answers?situation=containers` - is the same page answering in place, and
    // yanking the visitor to the top made that read as a reload: measured, a tap on a chip at
    // scrollY 928 landed them at scrollY 0 with the answer they asked for at y=893, below the fold.
    // Arriving from ANOTHER page still starts at the top, which is what a new page owes a reader.
    if (route !== lastRoute)
        window.scrollTo(0, 0);
    lastRoute = route;
}
let lastRoute = null;
// O108b: the pinch-zoom lock is SCOPED to the Plan route, not forced on the whole app. index.html
// ships the accessible, zoomable default; only Plan - which carries the map and the My-bed drag
// canvas, the one place a browser pinch would fight the app's own gesture - re-locks it. Calendar,
// Log, Why and Account (four routes of five) stay zoomable, so text resizes and WCAG 1.4.4 holds
// where nothing needs the lock. Setting the meta's content at runtime is respected by mobile
// browsers; the map and canvas also keep touch-action:none, so on Plan this lock is belt-and-braces.
const VIEWPORT_BASE = "width=device-width, initial-scale=1";
function setViewport(route) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta)
        return;
    meta.setAttribute("content", route === "plan" ? `${VIEWPORT_BASE}, maximum-scale=1, user-scalable=no` : VIEWPORT_BASE);
}
export function initRouter() {
    window.addEventListener("hashchange", () => apply(currentRoute()));
    apply(currentRoute());
}
