import { $ } from "../dom.js";
import { EXTENSION_STATES, NATIONAL_DIRECTORY } from "./extension_data.js";
function dist2(lat, lon, s) {
    const dlat = lat - s.lat;
    const dlon = (lon - s.lon) * Math.cos((lat * Math.PI) / 180);
    return dlat * dlat + dlon * dlon;
}
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
        return null;
    return best;
}
let userOverride = null;
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
        return;
    }
    if (guess.c !== lastAutoGuess) {
        userOverride = null;
        lastAutoGuess = guess.c;
    }
    const shown = EXTENSION_STATES.find((s) => s.c === (userOverride ?? guess.c)) ?? guess;
    const head = document.createElement("strong");
    head.textContent = "Your local extension office";
    panel.appendChild(head);
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
        renderExtension(site);
    });
    pick.appendChild(sel);
    pick.appendChild(document.createTextNode(". Not right? Change it."));
    panel.appendChild(pick);
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
