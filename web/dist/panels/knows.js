// The Account page's "What your garden knows" panel (O28) - the DOM half of gardenknows.ts.
// The inventory itself is pure and lives there; this only assembles the input from app state and
// lays the rows out. Each row folds: heading + what is held always visible, the detail (what it
// buys, what the next would buy, where it lives) behind a disclosure, so a complete list of nine
// facts (photos joined with D-171) still reads on a phone.
import { signedInEmail } from "../account.js";
import { gardenKnows, knowsSummary } from "../gardenknows.js";
import { app } from "../state.js";
import { storageEstimate } from "../storage.js";
import { fmtArea, remindChoice, tempSystem, themeChoice, unitSystem } from "../units.js";
const UNIT_LABEL = { metric: "metres and centimetres", imperial: "feet and inches" };
const THEME_LABEL = { system: "device", light: "light", dark: "dark" };
// The storage estimate is async and the render path is not: the first render reports "will not
// say", the answer re-renders the panel once when it lands (same args), and later renders read
// the cached value. estimate() is a snapshot either way - a stale-by-one-photo number is fine
// for a row whose job is honesty about scale, and the count itself is always live.
let estCache = null;
let estAsked = false;
export function renderGardenKnows(site, lat, lon, zone) {
    const panel = document.getElementById("knowsrows");
    const summary = document.getElementById("knowssummary");
    if (!panel || !summary)
        return;
    if (!estAsked) {
        estAsked = true;
        void storageEstimate().then((e) => {
            if (e) {
                estCache = e;
                renderGardenKnows(site, lat, lon, zone);
            }
        });
    }
    const rows = gardenKnows({
        signedIn: signedInEmail() !== null,
        email: signedInEmail(),
        site, lat, lon, zone,
        address: app.currentPlot?.address?.trim() || null,
        anchored: !!app.currentPlot?.anchor,
        beds: app.logSnapshot.beds.map((b) => ({
            name: b.name, region: b.region, structure: b.structure, sun: b.sun, sized: b.sized,
        })),
        seasons: app.logSnapshot.seasons,
        priorOccupancy: app.logSnapshot.priorOccupancy.length,
        soilObservations: app.soilObservations,
        plot: app.currentPlotId,
        photos: {
            count: app.logSnapshot.seasons.flatMap((s) => s.plantings ?? [])
                .flatMap((p) => p.notes ?? []).filter((n) => n.photo).length,
            usage: estCache?.usage ?? null,
            quota: estCache?.quota ?? null,
        },
        userSpecies: app.userSpecies.length,
        prefs: {
            units: UNIT_LABEL[unitSystem()] ?? unitSystem(),
            temp: tempSystem() === "c" ? "°C" : "°F",
            theme: THEME_LABEL[themeChoice()] ?? themeChoice(),
            remind: remindChoice(),
        },
        fmtArea,
    });
    summary.textContent = knowsSummary(rows);
    panel.replaceChildren(...rows.map(rowEl));
}
function rowEl(row) {
    const det = document.createElement("details");
    det.className = `knowsrow ${row.held ? "held" : "open"}`;
    det.dataset.knows = row.key;
    const sum = document.createElement("summary");
    // The state word carries no icon (D-105): "GIVEN" / "NOT GIVEN" in the same monospace column the
    // Log's earn-strip uses, so the two surfaces read as one grammar.
    const st = document.createElement("span");
    st.className = "knowsst";
    st.textContent = row.held ? "GIVEN" : "NOT GIVEN";
    const head = document.createElement("span");
    head.className = "knowshead";
    const label = document.createElement("b");
    label.textContent = row.label;
    const given = document.createElement("span");
    given.className = "knowsgiven";
    given.textContent = row.given;
    head.append(label, given);
    sum.append(st, head);
    det.append(sum);
    const body = document.createElement("div");
    body.className = "knowsbody";
    if (row.earned.length) {
        body.append(part("What it buys", row.earned));
    }
    else if (row.held) {
        body.append(part("What it buys", ["Nothing yet."]));
    }
    if (row.next)
        body.append(part(row.held ? "What the next one buys" : "What it would buy", [row.next]));
    body.append(part("Where it lives", [row.where]));
    det.append(body);
    return det;
}
function part(title, lines) {
    const wrap = document.createElement("div");
    wrap.className = "knowspart";
    const h = document.createElement("span");
    h.className = "knowsparth";
    h.textContent = title;
    wrap.append(h);
    for (const line of lines) {
        const p = document.createElement("p");
        p.textContent = line;
        wrap.append(p);
    }
    return wrap;
}
