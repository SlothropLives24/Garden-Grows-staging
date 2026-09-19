export const CONFIDENCE = {
    A: { word: "Well established", cls: "s", gloss: "The rule names its mechanism, and the sources behind it have been read and checked." },
    B: { word: "Promising", cls: "p", gloss: "The mechanism is named and the literature backs it, but it is not airtight yet." },
    C: { word: "A good hunch", cls: "h", gloss: "Plausible by its mechanism, with field studies thin - a lean, not a law." },
    D: { word: "Contested", cls: "d", gloss: "The evidence points both ways, so the planner does not enforce it." },
    F: { word: "Refuted", cls: "f", gloss: "The claim did not survive its sources - kept so the folklore can be answered." },
};
export const FAMILY_COMMON = {
    solanaceae: "nightshades",
    cucurbitaceae: "cucurbits",
    brassicaceae: "brassicas",
    fabaceae: "legumes",
    amaryllidaceae: "onion family",
    apiaceae: "carrot family",
    asteraceae: "daisy family",
    amaranthaceae: "amaranth family",
    boraginaceae: "borage family",
    cleomaceae: "spiderflower family",
    elaeagnaceae: "oleaster family",
    lamiaceae: "mint family",
    poaceae: "grasses",
    rosaceae: "rose family",
    convolvulaceae: "morning-glory family",
    malvaceae: "mallow family",
};
export const RULE_CITATION_PATTERN = "\\s*\\((?:R-\\d+(?:\\s*[/,]\\s*R-\\d+)*)\\)";
export const RULE_REF_PATTERN = "\\b(?:rules?\\s+)?R-\\d+[a-z]?(?:\\s*(?:[/,&]|and|through|to|-)\\s*R-\\d+[a-z]?)*";
export const EVIDENCE_LINE = {
    verified: "Evidence: confirmed against {src} in the research-based literature.",
    verified_trivially: "Evidence: settled without a trial - {basis}.",
    verified_trivially_bare: "Evidence: settled without a trial.",
    unverified: "Evidence: not yet confirmed against {src}.",
    no_evidence_exists: "Evidence: none exists for the underlying claim - that absence is the point.",
    unknown: "Evidence: {status}.",
};
export const GOATCOUNTER_CODE = "milpa-garden";
export const MOUND_MIN_SPAN_M = 1.0;
