const DEFAULT_ROUTE = "plan";
export function currentRoute() {
    const m = location.hash.match(/^#\/([a-z]+)/);
    return m ? m[1] : DEFAULT_ROUTE;
}
function apply(route) {
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
    setViewport(route);
    document.title = route === "start"
        ? "Milpa Gardens"
        : `${route.charAt(0).toUpperCase()}${route.slice(1)} - Milpa Gardens`;
    if (route !== lastRoute)
        window.scrollTo(0, 0);
    lastRoute = route;
}
let lastRoute = null;
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
