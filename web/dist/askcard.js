// The ask card's DOM layer (O27). The ranking lives in askrank.ts (pure, unit-tested); this
// module reads the app's live state, computes the card, and renders it in two places: the full
// card topping the Log (#askcard) and its one-line mirror on the Plan sheet (#askmini) - sign-in
// lands on the Plan page, so the journey's next step greets it there. Both hide signed out: the
// ask card is the authenticated journey's surface (the Log is already behind the account wall).
import { computeAsk } from "./askrank.js";
import { gardenWideTasks } from "./calendar.js";
import { humanize } from "./engine/labels.js";
import { matchSite } from "./engine/intake.js";
import { isSignedIn } from "./account.js";
import { linkNameIn } from "./panels/plantcard.js";
import { app, commonName } from "./state.js";
import { num } from "./dom.js";
import { go } from "./nav.js";
// rec 2: the re-arrival stamp. Read once per boot (the gap), then stamp now. Per-device
// localStorage - when this device last opened the app is a device fact, not account data.
const LAST_SEEN_KEY = "gg-last-seen";
let arrivalGapDays = null;
export function noteArrival(nowMs = Date.now()) {
    try {
        const prev = Number(localStorage.getItem(LAST_SEEN_KEY));
        arrivalGapDays = Number.isFinite(prev) && prev > 0 ? Math.floor((nowMs - prev) / 86400000) : null;
        localStorage.setItem(LAST_SEEN_KEY, String(nowMs));
    }
    catch {
        arrivalGapDays = null;
    }
    return arrivalGapDays;
}
/** The gap this boot read, for the state-aware home's welcome (home.ts). Read-only - the stamp is
 *  written once per boot by noteArrival, so every surface sees the SAME absence. */
export function daysAway() { return arrivalGapDays; }
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// rec 3: the ladder's crop, read where the answers page saved it - the suggested first planting
// for a garden seeded across the signup boundary.
function ladderCrop() {
    try {
        return JSON.parse(localStorage.getItem("gg-answers") ?? "{}").crop ?? null;
    }
    catch {
        return null;
    }
}
function followGo(g) {
    if (g.act === "logbed" && g.bed) {
        go("log");
        app.openLogBed?.(g.bed, g.species ?? null);
        return;
    }
    if (g.act === "log") {
        go("log");
        return;
    }
    if (g.act === "calendar") {
        go("calendar");
        return;
    }
    if (g.act === "soil") {
        go("log", "soilcard");
        return;
    }
    go("plan");
}
/** The live ask for THIS device, right now - null signed out (the ask card is the authenticated
 *  journey's surface). The one place the card's inputs are assembled, so the Log's card, the Plan
 *  mirror and the state-aware home (home.ts) are the same computation and cannot disagree. */
export function currentAskCard(bundle) {
    if (!isSignedIn())
        return null;
    const t = todayIso();
    const lat = num("lat"), lon = num("lon");
    const site = lat != null && lon != null ? matchSite(lat, lon, bundle) : null;
    return computeAsk({
        todayIso: t, site,
        seasons: app.logSnapshot.seasons, seasonId: app.logSnapshot.seasonId,
        beds: app.logSnapshot.beds,
        soilObservations: app.soilObservations ?? [], plot: app.currentPlotId,
        tasks: gardenWideTasks(bundle, Number(t.slice(0, 4))),
        bundle, answersCrop: ladderCrop(), daysAway: arrivalGapDays,
        cropLabel: (sid) => commonName(bundle, sid) || humanize(sid),
    });
}
/** Follow an ask's action from anywhere (the home's band reuses the Log card's own routing). */
export function followAsk(g) { followGo(g); }
/** Render the ask card on the Log (#askcard) + its compact mirror on the Plan sheet (#askmini). */
export function renderAskCards(bundle) {
    const host = document.getElementById("askcard");
    const mini = document.getElementById("askmini");
    if (!host && !mini)
        return;
    const card = currentAskCard(bundle);
    if (!card) {
        if (host)
            host.hidden = true;
        if (mini)
            mini.hidden = true;
        return;
    }
    if (host) {
        host.hidden = false;
        host.replaceChildren();
        if (card.ask) {
            const a = card.ask;
            const k = document.createElement("p");
            k.className = "ask-k";
            k.textContent = a.kicker;
            // O45: the crop the question names links to its card. `qNames` carries the id AND the exact
            // label askrank interpolated, so this wraps a name it was handed rather than one it found -
            // no prose is ever searched for a plant name.
            const q = document.createElement("p");
            q.className = "ask-q";
            if (a.qNames)
                linkNameIn(q, a.q, a.qNames.label, a.qNames.species);
            else
                q.textContent = a.q;
            const why = document.createElement("p");
            why.className = "ask-why";
            why.textContent = a.why;
            const goBtn = document.createElement("button");
            goBtn.type = "button";
            goBtn.className = "ask-go";
            goBtn.dataset.ask = a.key;
            goBtn.textContent = a.go.label;
            goBtn.addEventListener("click", () => followGo(a.go));
            host.append(k, q, why, goBtn);
            if (a.explainer) {
                const ex = document.createElement("a");
                ex.className = "ask-explainer";
                ex.href = a.explainer.href;
                ex.target = "_blank";
                ex.rel = "noopener";
                ex.textContent = a.explainer.label;
                host.append(ex);
            }
        }
        else if (card.quiet) {
            const q = document.createElement("p");
            q.className = "ask-quiet";
            if (card.quietNames)
                linkNameIn(q, card.quiet, card.quietNames.label, card.quietNames.species);
            else
                q.textContent = card.quiet;
            host.append(q);
        }
        if (card.waiting.length) {
            const w = document.createElement("p");
            w.className = "ask-later";
            // O46: a waiting line that IS a question names a crop, and that name links like every other.
            w.appendChild(document.createTextNode("Waiting its turn: "));
            card.waiting.forEach((item, i) => {
                if (i)
                    w.appendChild(document.createTextNode(" · "));
                if (item.names)
                    linkNameIn(w, item.text, item.names.label, item.names.species);
                else
                    w.appendChild(document.createTextNode(item.text));
            });
            w.appendChild(document.createTextNode("."));
            host.append(w);
        }
    }
    // The mirror: the one due ask as a single tappable line. Quiet state shows nothing here - the
    // mirror exists to surface a due ask, not to occupy the planner.
    if (mini) {
        if (card.ask) {
            mini.hidden = false;
            mini.replaceChildren();
            const b = document.createElement("button");
            b.type = "button";
            b.className = "askmini-line";
            b.dataset.ask = card.ask.key;
            // PLAIN TEXT, and it is one of the three documented places a plant name cannot link: this
            // mirror IS a button, and an anchor nested in a button is invalid markup and is how O33's
            // swallowed tap happened. The full card above carries the link.
            b.textContent = `${card.ask.kicker}: ${card.ask.q}`;
            const g = card.ask.go;
            b.addEventListener("click", () => followGo(g));
            mini.append(b);
        }
        else {
            mini.hidden = true;
        }
    }
}
