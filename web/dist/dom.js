import { lenToM } from "./units.js";
export const $ = (id) => document.getElementById(id);
export function el(a, b, c, d) {
    const [parent, tag, cls, text] = typeof a === "string" ? [null, a, b, c ?? undefined] : [a, b, c, d];
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    if (parent)
        parent.appendChild(e);
    return e;
}
export function num(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : null;
}
export function lenM(id) {
    const v = num(id);
    return v == null ? null : lenToM(v);
}
export const LEN_INPUT_IDS = ["shapew", "shapel", "shaped", "dimw", "diml", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"];
export const SVG_NS = "http://www.w3.org/2000/svg";
export function familiesOf(bundle) {
    return [...new Set(bundle.species.map((s) => s.family).filter(Boolean))].sort();
}
let discloseSeq = 0;
export function disclose(label, text, cls = "twhy") {
    const wrap = document.createElement("span");
    wrap.className = `${cls}-wrap`;
    const id = `${cls}-${++discloseSeq}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.textContent = label;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    const note = document.createElement("span");
    note.className = `${cls}-g`;
    note.id = id;
    note.setAttribute("role", "note");
    note.hidden = true;
    let loaded = false;
    btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        note.hidden = open;
        if (!open && !loaded) {
            loaded = true;
            void Promise.resolve(text()).then((s) => { note.textContent = s; });
        }
    });
    wrap.append(btn, note);
    return wrap;
}
