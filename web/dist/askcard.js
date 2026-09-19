import { computeAsk } from "./askrank.js";
import { seasonId } from "./session.js";
import { gardenWideTasks } from "./calendar.js";
import { humanize } from "./engine/labels.js";
import { matchSite } from "./engine/intake.js";
import { isSignedIn } from "./account.js";
import { linkNameIn } from "./panels/plantcard.js";
import { app, commonName } from "./state.js";
import { num } from "./dom.js";
import { go } from "./nav.js";
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
export function daysAway() { return arrivalGapDays; }
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
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
export function currentAskCard(bundle) {
    if (!isSignedIn())
        return null;
    const t = todayIso();
    const lat = num("lat"), lon = num("lon");
    const site = lat != null && lon != null ? matchSite(lat, lon, bundle) : null;
    return computeAsk({
        todayIso: t, site,
        seasons: app.logSnapshot.seasons, seasonId: seasonId(),
        beds: app.logSnapshot.beds,
        soilObservations: app.soilObservations ?? [], plot: app.currentPlotId,
        tasks: gardenWideTasks(bundle, Number(t.slice(0, 4))),
        bundle, answersCrop: ladderCrop(), daysAway: arrivalGapDays,
        cropLabel: (sid) => commonName(bundle, sid) || humanize(sid),
    });
}
export function followAsk(g) { followGo(g); }
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
    if (mini) {
        if (card.ask) {
            mini.hidden = false;
            mini.replaceChildren();
            const b = document.createElement("button");
            b.type = "button";
            b.className = "askmini-line";
            b.dataset.ask = card.ask.key;
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
