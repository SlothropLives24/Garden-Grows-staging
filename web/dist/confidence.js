import { CONFIDENCE } from "./engine/display-vocab.gen.js";
export function confidenceWord(grade) {
    return CONFIDENCE[(grade ?? "").trim().toUpperCase()]?.word ?? null;
}
export const CONFIDENCE_GLOSS = Object.fromEntries(Object.entries(CONFIDENCE).map(([g, c]) => [g, c.gloss]));
export function confidenceGloss(grade) {
    return CONFIDENCE_GLOSS[(grade ?? "").trim().toUpperCase()] ?? null;
}
let confSeq = 0;
export function confidenceBadge(grade) {
    const key = (grade || "").trim().toUpperCase();
    const c = CONFIDENCE[key];
    if (!c)
        return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `conf ${c.cls}`;
    btn.setAttribute("aria-expanded", "false");
    const mk = document.createElement("span");
    mk.className = "mk";
    btn.appendChild(mk);
    btn.appendChild(document.createTextNode(c.word));
    let note = null;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!note) {
            note = document.createElement("span");
            note.className = "conf-g";
            note.id = `conf-g-${++confSeq}`;
            note.setAttribute("role", "note");
            note.textContent = `${c.word}: ${CONFIDENCE_GLOSS[key]}`;
            btn.setAttribute("aria-controls", note.id);
            btn.insertAdjacentElement("afterend", note);
        }
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
    });
    return btn;
}
