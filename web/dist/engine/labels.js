export function humanize(id) {
    return String(id).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
export function titleCase(s) {
    return String(s).replace(/(^|[\s\-/(])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
}
import { FAMILY_COMMON, RULE_CITATION_PATTERN, RULE_REF_PATTERN } from "./display-vocab.gen.js";
const RULE_CITATION = new RegExp(RULE_CITATION_PATTERN, "g");
const RULE_REF = new RegExp(RULE_REF_PATTERN, "gi");
export function familyName(fam) {
    return FAMILY_COMMON[String(fam).toLowerCase()] ?? humanize(fam);
}
export function humanizeFamilies(text) {
    return String(text).replace(/\b[a-z]+aceae\b/gi, (m) => familyName(m));
}
export function stripRuleCitations(text) {
    return String(text).replace(RULE_CITATION, "").trim();
}
export function humanizeRuleRefs(text) {
    return String(text).replace(RULE_REF, (m) => ((m.match(/R-\d/g) ?? []).length > 1 ? "other rules here" : "another rule here"));
}
