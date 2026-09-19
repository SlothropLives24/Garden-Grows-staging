export const BLOOM_ORDER = ["early_spring", "late_spring", "early_summer", "midsummer", "late_summer"];
export const FORAGE_LEVELS = ["high", "very_high"];
const speciesOf = (bundle, id) => bundle.species.find((s) => s.id === id);
export function bloomSpan(sp) {
    const w = sp?.bloom_window;
    if (!Array.isArray(w) || w.length === 0)
        return null;
    const idx = [];
    for (const v of w) {
        const i = BLOOM_ORDER.indexOf(v);
        if (i < 0)
            return null;
        idx.push(i);
    }
    return [Math.min(...idx), Math.max(...idx)];
}
export function spansOverlap(a, b) {
    if (a === null || b === null)
        return false;
    return a[0] <= b[1] && b[0] <= a[1];
}
export function needsInsects(sp) {
    const poll = sp?.pollination;
    return !!poll && typeof poll === "object" && poll.mode === "insect";
}
export function isForage(sp) {
    return FORAGE_LEVELS.includes(sp?.pollinator_value);
}
export function forageInFlower(cropSpan, plantedIds, bundle) {
    const seen = new Set();
    const out = [];
    for (const sid of plantedIds) {
        if (seen.has(sid))
            continue;
        seen.add(sid);
        const sp = speciesOf(bundle, sid);
        if (sp && isForage(sp) && spansOverlap(bloomSpan(sp), cropSpan))
            out.push(sid);
    }
    return out;
}
export function forageCandidates(cropSpan, bundle, exclude = new Set()) {
    if (cropSpan === null)
        return [];
    const scored = [];
    for (const sp of bundle.species) {
        if (exclude.has(sp.id) || !isForage(sp))
            continue;
        const span = bloomSpan(sp);
        if (!spansOverlap(span, cropSpan))
            continue;
        const s = span;
        const covered = Math.min(s[1], cropSpan[1]) - Math.max(s[0], cropSpan[0]) + 1;
        scored.push([-covered, sp.id]);
    }
    scored.sort((a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return scored.map(([, sid]) => sid);
}
export function pollinationGap(cropId, cropSpan, plantedIds, bundle) {
    const sp = speciesOf(bundle, cropId);
    if (!sp || !needsInsects(sp))
        return null;
    if (cropSpan === null)
        return null;
    const present = forageInFlower(cropSpan, plantedIds, bundle);
    return {
        crop: cropId,
        crop_span: cropSpan,
        needs_insects: true,
        forage_present: present,
        gap: present.length === 0,
    };
}
