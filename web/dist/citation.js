import { humanizeFamilies, humanizeRuleRefs, stripRuleCitations } from "./engine/labels.js";
import { EVIDENCE_LINE } from "./engine/display-vocab.gen.js";
import { el } from "./dom.js";
export function prose(text) {
    return stripRuleCitations(humanizeFamilies(text));
}
export function readerProse(v) {
    const t = String(v ?? "").trim();
    if (!t)
        return null;
    return /\ba human\b|read by a human|signed off|\bISSUES\b|dispatch\.py|conformance case|HAS NO SURFACE|\bC-0\d\d\b|derived composition/i.test(t) ? null : t;
}
export const SOURCE_URL = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:edu|org|gov|com|net|io|uk)(?:\/[^\s,;"')\]]*)?/i;
export function citationLine(pointer, parent) {
    const text = humanizeRuleRefs(stripRuleCitations(pointer));
    const p = el(parent, "p", "prov");
    const m = SOURCE_URL.exec(text);
    if (!m) {
        p.textContent = text;
        return;
    }
    const url = m[0].replace(/[.,;:'")\]]+$/, "");
    p.appendChild(document.createTextNode(text.slice(0, m.index)));
    const a = document.createElement("a");
    a.href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    a.textContent = url;
    a.rel = "noreferrer";
    a.target = "_blank";
    p.appendChild(a);
    p.appendChild(document.createTextNode(text.slice(m.index + url.length)));
}
export function sourcesDisclosure(status, pointers, parent) {
    if (!pointers.length || status === "verified_trivially")
        return;
    const n = pointers.length;
    const det = el(parent, "details", "sources");
    el(det, "summary", null, status === "verified"
        ? `the ${n === 1 ? "source" : `${n} sources`}`
        : `what this rests on - ${n === 1 ? "one pointer" : `${n} pointers`}`);
    for (const p of pointers)
        citationLine(p, det);
}
export function evidenceLine(status, pointers) {
    const clean = pointers.map((p) => String(p ?? "")).filter((s) => s.trim());
    const n = clean.length;
    const src = n ? `${n} source${n === 1 ? "" : "s"}` : "no source";
    const firstPtr = (clean[0] ?? "").trim();
    const trivialBasis = firstPtr && firstPtr.length <= 48 ? firstPtr : "";
    const map = {
        verified: ["ev ok", EVIDENCE_LINE.verified.replace("{src}", src)],
        verified_trivially: ["ev ok", trivialBasis
                ? EVIDENCE_LINE.verified_trivially.replace("{basis}", trivialBasis)
                : EVIDENCE_LINE.verified_trivially_bare],
        unverified: ["ev", EVIDENCE_LINE.unverified.replace("{src}", src === "no source" ? "any source" : `its ${src}`)],
        no_evidence_exists: ["ev", EVIDENCE_LINE.no_evidence_exists],
    };
    const [cls, text] = map[status] ?? ["ev", EVIDENCE_LINE.unknown.replace("{status}", status || "unknown")];
    return { cls, text };
}
export function enforcementWords(severity, ruling) {
    const cost = {
        fatal: "ignored, the planting fails",
        costly: "ignored, real yield is lost",
        suboptimal: "ignored, it still works, just worse",
    };
    const does = {
        block: "the planner refuses it",
        warn: "the planner warns you",
        advise: "the planner suggests it",
        inert: "nothing to enforce",
        refute: "a correction, not a rule",
    };
    const parts = [cost[severity], does[ruling]].filter((x) => !!x);
    return parts.join(" · ");
}
