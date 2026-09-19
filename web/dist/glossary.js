import { CONFIDENCE_GLOSS } from "./confidence.js";
import { markLink } from "./dossier.js";
export const GLOSSARY = {
    team: { term: "plant team", guide: "companion-planting-honestly",
        gloss: "A few plants grown together because they help each other - one climbs, one feeds the soil, one shades out weeds. The team fits a bed as a whole, not one plant at a time." },
    window: { term: "window", guide: "read-a-planting-calendar",
        gloss: "The stretch of days when a crop can still go in and ripen before your first frost. Miss the far end and it runs out of season." },
    rotation: { term: "rotation", guide: "crop-rotation",
        gloss: "Not planting the same family in the same ground two years running - it starves the pests and diseases that overwinter waiting for it." },
    zone: { term: "zone", guide: "frost-dates-zones-daylength",
        gloss: "How cold your winters get, on the USDA scale. It decides which perennials live through them - an annual doesn't care about your zone." },
    fit: { term: "fit verdict",
        gloss: "Whether a bed is big enough and gets enough sun for a team - a plain yes, a greyed no with the reason, never a maybe." },
    tier: { term: "tier",
        gloss: "How sure we are of a number: measured at a weather station, modelled from the terrain nearby, or estimated from farther off. The app always says which." },
    median: { term: "median",
        gloss: "The middle of the range: half the years the date falls earlier, half later. A median frost date is a coin-flip year, not a guarantee - which is why the app also shows how late a cold year can still run." },
    established: { term: "well established", gloss: CONFIDENCE_GLOSS.A },
    promising: { term: "promising", gloss: CONFIDENCE_GLOSS.B },
    hunch: { term: "a good hunch", gloss: CONFIDENCE_GLOSS.C },
};
let glossSeq = 0;
function guideMoreLink(guide) {
    const a = document.createElement("a");
    a.className = "glossterm-more";
    a.href = `../guides/${guide}/`;
    a.rel = "noopener";
    a.textContent = "more ›";
    markLink(a, { kind: "page", id: `guide/${guide}` });
    return a;
}
export function glossTerm(key, labelOverride) {
    const e = GLOSSARY[key];
    const span = document.createElement("span");
    span.className = "glossterm";
    const id = `gloss-${key}-${++glossSeq}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "glossterm-t";
    btn.textContent = labelOverride ?? e.term;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    btn.title = "what this means";
    const note = document.createElement("span");
    note.className = "glossterm-g";
    note.id = id;
    note.setAttribute("role", "note");
    note.appendChild(document.createTextNode(e.gloss));
    if (e.guide) {
        note.appendChild(document.createTextNode(" "));
        note.appendChild(guideMoreLink(e.guide));
    }
    note.hidden = true;
    btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
    });
    span.append(btn, note);
    return span;
}
export function renderGlossary(parent) {
    const dl = document.createElement("dl");
    dl.className = "glosslist";
    for (const key of Object.keys(GLOSSARY)) {
        const { term, gloss, guide } = GLOSSARY[key];
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.appendChild(document.createTextNode(gloss));
        if (guide) {
            dd.appendChild(document.createTextNode(" "));
            dd.appendChild(guideMoreLink(guide));
        }
        dl.append(dt, dd);
    }
    parent.appendChild(dl);
}
