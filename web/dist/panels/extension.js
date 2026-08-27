// Phase D (D-041) - the extension-office panel: given the resolved location, link the user's
// land-grant Cooperative Extension program, shown inline on Plan under the daylength panel.
//
// Read-only and NEVER an engine input (D-008): it informs the human, the solver never reads it back.
// Its data is BUNDLED and read offline (D-039, extension_data.ts) - no runtime call. It lives under
// web/src/panels/, not the DOM-free engine/ subtree; the engine never imports it and it is not in the
// conformance oracle. The resolver (stateForLatLon) is pure and pinned in web/test.mjs; only the
// render function touches the DOM.
//
// State is DERIVED from lat/lon offline (there is no state field in the location or climate data),
// so it is a best-effort GUESS the user can correct - the panel says so and shows a state selector.
import { $ } from "../dom.js";
import { EXTENSION_STATES, NATIONAL_DIRECTORY } from "./extension_data.js";
// Squared great-circle-ish distance (lon scaled by cos-latitude), good enough to rank centroids.
function dist2(lat, lon, s) {
    const dlat = lat - s.lat;
    const dlon = (lon - s.lon) * Math.cos((lat * Math.PI) / 180);
    return dlat * dlat + dlon * dlon;
}
// Best-effort state from a point: prefer states whose bounding box contains it (breaking ties by
// nearest centroid), else fall back to the nearest centroid overall - but only if it is plausibly
// within the US (≤ ~4° away), so a non-US location yields null and the panel stays absent. The bbox
// data is approximate; this is a seed for the user-correctable selector, not an authoritative lookup.
export function stateForLatLon(lat, lon) {
    const inBox = EXTENSION_STATES.filter((s) => lat >= s.bb[0] && lat <= s.bb[1] && lon >= s.bb[2] && lon <= s.bb[3]);
    const pool = inBox.length ? inBox : EXTENSION_STATES;
    let best = pool[0];
    let bestD = dist2(lat, lon, pool[0]);
    for (const s of pool) {
        const d = dist2(lat, lon, s);
        if (d < bestD) {
            best = s;
            bestD = d;
        }
    }
    if (!inBox.length && bestD > 16)
        return null; // ~4° from any state centroid → treat as outside the US
    return best;
}
// ---------------------------------------------------------------- render (DOM layer)
// The user's manual state pick survives redraws at the same location; a move to a new auto-guess
// clears it so the panel follows the new location. Module-level because the panel is rebuilt each draw.
let userOverride = null;
/** The state this location resolves to, WITH the user's correction applied — the single answer both
 *  the extension card and the soil card must give. Exported because the soil panel needs the same
 *  state, and a second resolver drifted: it took the first bounding-box match rather than the nearest
 *  centroid, and the boxes overlap enough that a garden near a border resolved to the wrong state's
 *  lab (reported: Minnesota, from a garden that is not in Minnesota). One resolver, one answer. */
export function effectiveState(lat, lon) {
    if (lat == null || lon == null)
        return null;
    const guess = stateForLatLon(lat, lon);
    if (!guess)
        return null;
    return EXTENSION_STATES.find((s) => s.c === (userOverride ?? guess.c)) ?? guess;
}
let lastAutoGuess = null;
export function renderExtension(site) {
    const panel = $("extension");
    panel.innerHTML = "";
    if (!site || site.lat == null || site.lon == null) {
        lastAutoGuess = null;
        return;
    }
    const guess = stateForLatLon(site.lat, site.lon);
    if (!guess) {
        lastAutoGuess = null;
        return; // outside the US directory - silently absent
    }
    if (guess.c !== lastAutoGuess) {
        userOverride = null; // the location moved to a new state → follow it, drop a stale manual pick
        lastAutoGuess = guess.c;
    }
    const shown = EXTENSION_STATES.find((s) => s.c === (userOverride ?? guess.c)) ?? guess;
    const head = document.createElement("strong");
    head.textContent = "Your local extension office";
    panel.appendChild(head);
    // "Looks like you're in [select]." - the guess, correctable.
    const pick = document.createElement("p");
    pick.appendChild(document.createTextNode("Looks like you're in "));
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Your state");
    for (const s of EXTENSION_STATES) {
        const o = document.createElement("option");
        o.value = s.c;
        o.textContent = s.name;
        if (s.c === shown.c)
            o.selected = true;
        sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
        userOverride = sel.value;
        renderExtension(site); // same location → guess unchanged → the override sticks
    });
    pick.appendChild(sel);
    pick.appendChild(document.createTextNode(". Not right? Change it."));
    panel.appendChild(pick);
    // The office link. Direct where confidently known; otherwise name the program and route to the
    // national directory, which always resolves.
    const line = document.createElement("p");
    if (shown.url) {
        const a = document.createElement("a");
        a.href = shown.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = shown.inst;
        line.appendChild(a);
    }
    else {
        line.appendChild(document.createTextNode(`${shown.inst} - `));
        const a = document.createElement("a");
        a.href = NATIONAL_DIRECTORY;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "find it in the national directory";
        line.appendChild(a);
    }
    panel.appendChild(line);
    // Always offer the county-office finder.
    const county = document.createElement("p");
    county.appendChild(document.createTextNode("Find your county office: "));
    const nat = document.createElement("a");
    nat.href = NATIONAL_DIRECTORY;
    nat.target = "_blank";
    nat.rel = "noopener noreferrer";
    nat.textContent = "Cooperative Extension directory (USDA NIFA)";
    county.appendChild(nat);
    panel.appendChild(county);
    const prov = document.createElement("p");
    prov.className = "provenance";
    prov.textContent =
        "Every US state has a land-grant Cooperative Extension program (Morrill Act). Links last checked " +
            "2026-07 and may move - the national directory always resolves. Your state is a guess from your " +
            "location; correct it above if it's wrong.";
    panel.appendChild(prov);
}
