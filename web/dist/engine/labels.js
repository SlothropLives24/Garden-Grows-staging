// Display labels - the app shows human names; the corpus keeps the scientific/id record. Pure and
// DOM-free (portable to the RN app), so web/test.mjs can pin it.
/** A snake_case id or vocabulary token → a human label: "mulch_producer" → "Mulch producer",
 *  "septoria_leaf_spot" → "Septoria leaf spot". For role names, cost tags, guild classes, modes. */
export function humanize(id) {
    return String(id).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
/** Title Case for user-facing species/entity NAMES: uppercase every word-initial letter so the
 *  corpus's mostly-lowercase `common` names ("common bean") read uniformly ("Common Bean"). Only
 *  word-start LOWERCASE letters are touched (after start / space / hyphen / slash / open-paren), so
 *  proper nouns already capitalised ("European", "Swiss chard", "Rocky Mountain bee plant") and
 *  interior letters are left exactly as written. NOT for scientific binomials - a "Zea mays"
 *  fallback keeps its lowercase epithet because callers title-case the common name, not the id. */
export function titleCase(s) {
    return String(s).replace(/(^|[\s\-/(])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
}
// Botanical families → friendly common names for display; the corpus keeps the scientific family.
// Every family currently in the corpus is mapped; the -aceae fallback catches anything new.
const FAMILY_COMMON = {
    solanaceae: "nightshades", cucurbitaceae: "cucurbits", brassicaceae: "brassicas",
    fabaceae: "legumes", amaryllidaceae: "onion family", apiaceae: "carrot family",
    asteraceae: "daisy family", amaranthaceae: "amaranth family", boraginaceae: "borage family",
    cleomaceae: "spiderflower family", elaeagnaceae: "oleaster family", lamiaceae: "mint family",
    poaceae: "grasses", rosaceae: "rose family",
    convolvulaceae: "morning-glory family", malvaceae: "mallow family",
};
/** A botanical family → its common name, or a humanised fallback for an unmapped family. */
export function familyName(fam) {
    return FAMILY_COMMON[String(fam).toLowerCase()] ?? humanize(fam);
}
/** Replace scientific family tokens (words ending in -aceae, any case - the reasons use both
 *  "solanaceae" and "Solanaceae") inside an engine-produced string with their common names, so
 *  rule reasons read plainly too. */
export function humanizeFamilies(text) {
    return String(text).replace(/\b[a-z]+aceae\b/gi, (m) => familyName(m));
}
/** Drop parenthetical rule-code citations from user-facing text. Rule codes (R-###) are backend
 *  corpus identifiers and must never surface in the UI (maintainer): the corpus keeps its
 *  cross-references, the display drops the citation form - " (R-010)", " (R-010/R-011)",
 *  " (R-010, R-011)" - leaving the sentence clean. Only parentheticals made up ENTIRELY of rule
 *  codes are removed, so "(prior Solanaceae)" and the like stay. Shared so every render site that
 *  shows corpus text or an engine reason strips codes the same way. */
export function stripRuleCitations(text) {
    return String(text).replace(/\s*\((?:R-\d+(?:\s*[/,]\s*R-\d+)*)\)/g, "").trim();
}
/** The other half of the same rule, for text where a code is the SUBJECT rather than a citation.
 *  Two evidence pointers cross-reference sibling rules inline - "Same soilborne-persistence basis
 *  as R-010/R-011" - so deleting the code the way stripRuleCitations does would mangle the
 *  sentence. Naming the reference instead keeps it readable and keeps codes off the page. A run of
 *  codes joined by / or , collapses to one phrase. Display-only: the corpus keeps its codes. */
export function humanizeRuleRefs(text) {
    return String(text).replace(/\b(?:rules?\s+)?R-\d+[a-z]?(?:\s*(?:[/,&]|and|through|to|-)\s*R-\d+[a-z]?)*/gi, (m) => ((m.match(/R-\d/g) ?? []).length > 1 ? "other rules here" : "another rule here"));
}
