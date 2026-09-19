import { resolveClimate } from "./engine/intake.js";
import { backendConfigured, isSignedIn } from "./account.js";
import { num } from "./dom.js";
import { isExamplePlot } from "./example.js";
import { app } from "./state.js";
const KEEP_COPY = [
    "This calendar draws live from what this device knows - the frost odds around your site's real median last frost, and any beds you've planned. One tap exports it, reminder included.",
    "Sign in (or create a free account) and your logged plantings and frost records join these dates - kept, on every device.",
];
const LOCK_COPY = {
    log: [
        "Behind this tab: your garden's log - what grew where, so rotation warnings follow the actual ground; and your own frost observations, which after three logged seasons supersede the general estimate for your yard.",
        "Create a free account (or sign in) and your log follows you to every device - with a plain-file export you can always walk away with.",
    ],
    review: [
        "Behind this tab: the season in review, built from your own log - what grew and what it suffered, what your logged frosts are teaching, and what next year's rotation allows on each bed, every warning cited.",
        "Create a free account (or sign in) and the review follows your log to every device.",
    ],
};
const NO_BACKEND_COPY = "This copy of the app has no account service, so everything stays on this device.";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GATED_PAGES = ["calendar", "log", "review"];
export function authGateState(f) {
    const gated = !f.signedIn && f.backend && !f.onExample;
    const page = (pid) => {
        if (f.signedIn)
            return { locked: false, panelHidden: true, lines: null };
        if (f.onExample)
            return { locked: false, panelHidden: true, lines: null };
        if (f.backend) {
            let line1 = pid === "calendar" ? KEEP_COPY[0] : LOCK_COPY[pid][0];
            if (pid === "calendar" && f.medianLastFrost) {
                const [mm, dd] = f.medianLastFrost.split("-").map(Number);
                line1 = line1.replace("your site's real median last frost", `your site's real median last frost (${MON[(mm ?? 1) - 1]} ${dd})`);
            }
            return { locked: pid !== "calendar", panelHidden: false, lines: [line1, pid === "calendar" ? KEEP_COPY[1] : LOCK_COPY[pid][1]] };
        }
        return { locked: false, panelHidden: false, lines: [NO_BACKEND_COPY, ""] };
    };
    return { gated, pages: { calendar: page("calendar"), log: page("log"), review: page("review") } };
}
let liveBundle = null;
export function setGateBundle(bundle) { liveBundle = bundle; }
export function initAuthGate(onGated) {
    return () => {
        const lat = num("lat"), lon = num("lon");
        const lf = liveBundle && lat != null && lon != null
            ? resolveClimate(lat, lon, liveBundle)?.site.last_frost_32f?.p50 : null;
        const state = authGateState({
            signedIn: isSignedIn(), backend: backendConfigured(), onExample: isExamplePlot(app.currentPlotId), medianLastFrost: lf ?? null,
        });
        for (const pid of GATED_PAGES) {
            const sec = document.getElementById(`page-${pid}`);
            let panel = sec.querySelector(".lockpanel");
            if (!panel) {
                panel = document.createElement("div");
                panel.className = "lockpanel";
                panel.appendChild(document.createElement("p"));
                panel.appendChild(document.createElement("p"));
                const b = document.createElement("button");
                b.type = "button";
                b.className = "primary";
                b.textContent = "Sign in / create account";
                b.addEventListener("click", () => { if (app.openAuthSheet)
                    app.openAuthSheet();
                else
                    location.hash = "#/account"; });
                panel.appendChild(b);
                const tagline = sec.querySelector(".tagline");
                sec.insertBefore(panel, tagline ? tagline.nextSibling : sec.children[1] ?? null);
            }
            const [p1, p2] = [...panel.querySelectorAll("p")];
            const g = state.pages[pid];
            sec.classList.toggle("locked", g.locked);
            panel.hidden = g.panelHidden;
            if (g.lines) {
                p1.textContent = g.lines[0];
                p2.textContent = g.lines[1];
            }
        }
        onGated(state.gated);
    };
}
