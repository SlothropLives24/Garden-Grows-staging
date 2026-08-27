// Tiny DOM/form helpers shared by every page module (Phase A page-split). App layer only -
// the engine never sees these; it is handed values, not elements.
import { lenToM } from "./units.js";
export const $ = (id) => document.getElementById(id);
export function num(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : null;
}
// A length input read in the user's chosen unit system, returned in metres (units.ts).
export function lenM(id) {
    const v = num(id);
    return v == null ? null : lenToM(v);
}
// Every input that holds a length. HTML ships metric defaults; toggling (or a stored imperial
// preference at startup) converts the visible values in place - storage never leaves metres.
export const LEN_INPUT_IDS = ["shapew", "shapel", "shaped", "dimw", "diml", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"];
export const SVG_NS = "http://www.w3.org/2000/svg";
export function familiesOf(bundle) {
    return [...new Set(bundle.species.map((s) => s.family).filter(Boolean))].sort();
}
