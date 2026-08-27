// Pollinator forage — is anything in this garden in flower while an insect-pollinated crop needs
// insects? The TypeScript port of `engine/forage.py`, in the same relationship as
// season_log.py <-> seasonlog.ts: the Python module is the ORACLE, this mirrors it, and the two
// move in one commit. See docs/mockups/pollinator-forage.html for the design and its evidence.
//
// THE REFUSALS ARE THE DESIGN, and they are load-bearing enough to restate here rather than leave
// in the Python. This does not detect pollinators and never will: there is no bee census, no
// camera, and no weather feed (D-008). Bees fly in from outside, so a plot with nothing in flower
// is still visited. What this computes is arithmetic over the gardener's OWN plant list.
//
// That supports one sentence - "nothing you planted is in flower while your squash is" - and
// forbids two: "you have no pollinators", and "this is why your fruit failed". Every source read
// for this feature names WEATHER as the first cause of poor cucurbit set, and D-008 denies us
// weather, so weather can never be ruled out and forage can never be ruled in.
//
// GRADES DIFFER ACROSS THE TWO HALVES. That a cucurbit REQUIRES an insect vector is the species
// record's own `pollination.mode`, displayed - not a new claim. That adding flowers HELPS is R-052,
// grade C. A caller that renders both at one grade has misrepresented the corpus.
//
// ONE DELIBERATE SHAPE DIFFERENCE FROM THE ORACLE: Python indexes `cx["species"]` as a dict, while
// a Bundle carries `species` as an ARRAY (types.ts). These functions take the Bundle and look up by
// id, so the argument lists differ by that one substitution and nothing else.
// The bloom vocabulary. FIVE seasons, ending at late_summer - there is no `fall`, and a
// bloom_window naming one is an E-BLOOM error in the validator. Kept byte-identical to
// forage.py's BLOOM_ORDER.
export const BLOOM_ORDER = ["early_spring", "late_spring", "early_summer", "midsummer", "late_summer"];
// `pollinator_value` levels that count as FORAGE. `moderate` is deliberately excluded: the guild
// insectary roles predicate on [high, very_high], and a lens counting moderate would tell a
// gardener their squash feeds itself - cucurbita_pepo is `pollinator_value: moderate` and is the
// very crop asking the question.
export const FORAGE_LEVELS = ["high", "very_high"];
const speciesOf = (bundle, id) => bundle.species.find((s) => s.id === id);
/** (first, last) index into BLOOM_ORDER, inclusive, or null if this species records no bloom.
 *
 *  A SPAN, NOT A SET: yarrow's [late_spring, late_summer] means it is in flower through midsummer
 *  too, which is true of yarrow and false under a set reading. An unparseable token returns null
 *  rather than a guess. */
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
/** Inclusive overlap of two closed season spans. Either being null is not an overlap. */
export function spansOverlap(a, b) {
    if (a === null || b === null)
        return false;
    return a[0] <= b[1] && b[0] <= a[1];
}
/** Does this species require an insect to move its pollen? Reads the record's own
 *  `pollination.mode`. Corn is wind-pollinated (R-001 covers its geometry) and a tomato is
 *  self-fertile; neither is this feature's business. */
export function needsInsects(sp) {
    const poll = sp?.pollination;
    return !!poll && typeof poll === "object" && poll.mode === "insect";
}
/** Is this species recorded as feeding insects well enough to count? */
export function isForage(sp) {
    return FORAGE_LEVELS.includes(sp?.pollinator_value);
}
/** Of the species ALREADY PLANTED, which are forage in flower during `cropSpan`. Deduplicated,
 *  in the order given. An empty list is the gap - a statement about the plant list, never about
 *  insects. */
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
/** Forage species that WOULD be in flower during `cropSpan`, for the recommendation.
 *
 *  Ordered by how much of the crop's window each covers (most first), then by id so the list is
 *  stable across loads - a recommendation that reshuffles itself reads as arbitrary. Callers still
 *  owe the footprint gate (invariant 2): this returns what would help, not what fits. */
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
/** The whole lens for one crop. Null when the crop does not need insects, or when we cannot say -
 *  an unknown species, or a crop whose window we do not know.
 *
 *  Returning null for an unknown window is the honest answer: it is the difference between
 *  "nothing is in flower" and "we do not know when your squash flowers", and a UI that renders
 *  those the same way is lying about the second. Every insect-pollinated species in the CORPUS now
 *  carries a bloom_window, so in practice this arises for a USER-ADDED species, which never does. */
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
