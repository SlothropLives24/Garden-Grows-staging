// The STRANGER's front door (O34, approved 2026-08-01). The pure half: what the four doors say
// today and where the situation row goes. Every input is handed in, nothing here touches the DOM -
// same split as askrank/askcard and homefacts/home, and for the same reason: the words a visitor
// meets first are worth pinning by test.
//
// WHAT O34 FOUND, MEASURED AGAINST THE EIGHT PERSONAS. Two of the four doors landed on the SAME
// surface (door 1 and door 2 both opened `#/answers`, and the teams answer was a card on the dates
// screen). Two personas had no door at all: Priya, whose containers make every "trace your beds"
// prompt tell her she is not the customer, and Maya, whose question is not gardening at all but
// "where is the catch". This module carries the two fixes that are pure: door 3 asking a REAL
// claim instead of an abstract one, and the situation row.
// The claims door 3 rotates through. Every one is a belief the corpus actually holds an answer to
// (`#/why?belief=<id>`), phrased as the question a gardener would type rather than as the flat
// assertion the corpus files it under. Chosen for RECOGNITION - these are the ones people arrive
// already believing, which is what makes "look it up" an offer rather than a chore.
const CLAIMS = [
    { id: "B-005", q: "Do eggshells stop slugs?" },
    { id: "B-004", q: "Do Epsom salts stop blossom end rot?" },
    { id: "B-011", q: "Do marigolds keep pests away?" },
    { id: "B-006", q: "Do coffee grounds make soil acidic?" },
    { id: "B-003", q: "Does planting by the moon work?" },
    // (B-015, sand into clay, is deliberately NOT here: the clay SITUATION owns that answer, and a
    //  door offering the same claim as a chip below it is the overlap this whole item removes.)
    { id: "B-012", q: "Does midday watering scorch leaves?" },
    { id: "B-009", q: "Do pot shards help a container drain?" },
];
/** The claim door 3 asks today. Rotates by the day so the front door is not the same sentence
 *  forever - a returning stranger meets a different question - and is stable WITHIN a day, because
 *  a door that changes while you look at it is a door you cannot point a friend at. */
export function doorClaim(dayOfYear) {
    return CLAIMS[Math.abs(Math.trunc(dayOfYear)) % CLAIMS.length];
}
/** Every claim the door can ask - the e2e sweep walks these to prove none is a dead end. */
export function allDoorClaims() { return CLAIMS.slice(); }
// THE SITUATION ROW. O34's fourth ruling: a quiet row that shapes the journey without multiplying
// top-level doors. It lives ONE LAYER DEEPER than first built (maintainer, 2026-08-01): under the
// landing's doors it spent the front page's most valuable space asking a second set of intake
// questions before the visitor had been given anything. On the answers page it appears only once
// an answer is on screen, which makes it a refinement rather than a toll. Each entry routes somewhere that genuinely answers it - none of them is a
// filter that lands on the same screen as its neighbour, which is the exact defect O34 exists to
// fix and would be embarrassing to reintroduce one line below it.
//
// ON THE APPROVED LIST — the swap was FLAGGED AND RULED (maintainer, 2026-08-01: "shade in place
// of no yard is fine, user can specify eventually"). The original ruling wrote "containers · no
// yard · mid-season · clay soil". Three stand. "No yard" does not: it is what a gardener with only
// a balcony calls containers, so it would have pointed at the same answer as its neighbour — the
// exact overlap this item exists to remove, one line below the fix. SHADE takes its place: a
// distinct situation the engine already computes (R-004's shadow intersection, R-005 refusing
// sun-lovers in ground marked shaded), and one a walled yard or north-facing plot arrives with
// just as often.
//
// THE EVENTUAL SHAPE, recorded so it is not re-litigated: this row is a FIXED FOUR, and the
// maintainer's "user can specify eventually" points at the version where the gardener names their
// own situation rather than picking from ours. That is a real future item, not this one — it needs
// somewhere to PUT the answer (a per-visitor situation is state, and a stranger has none), which is
// a decision about storage before it is a decision about doors.
const SITUATIONS = [
    {
        // The SEASONAL pair's other half. "It's already late to start" is wrong in March, and a chip
        // that is wrong for half the year is not contextual - it is furniture (maintainer: "ensure all
        // questions on this page are contextual").
        id: "earlystart", label: "I want to get going early",
        href: "#/answers?situation=earlystart",
        why: "What goes out BEFORE your last frost, and how far before",
    },
    {
        id: "containers", label: "I only have containers",
        href: "#/answers?situation=containers",
        why: "What actually fits a pot - by root depth and spread, not by wishful thinking",
    },
    {
        id: "midseason", label: "It's already late to start",
        href: "#/answers?situation=midseason",
        why: "The crops that finish fastest, by days to maturity",
    },
    {
        id: "shade", label: "My garden is shady",
        href: "#/answers?situation=shade",
        why: "What tolerates it - and the rule that refuses to place sun-lovers in shadow",
    },
    {
        id: "clay", label: "I have heavy clay",
        href: "#/answers?situation=clay",
        why: "What clay actually needs, and the fix that makes it worse",
    },
];
/** Every situation the app can answer - for hash lookup, which must resolve a deep link whatever
 *  month it arrives in. The ROW is a contextual subset; the vocabulary is not. */
export function allSituations() { return SITUATIONS.slice(); }
/** The situations worth OFFERING in `month` (1-12).
 *
 *  Three are true all year - what fits a pot, what tolerates shade, what clay needs. The fourth is
 *  the season's own question, and it flips: through the growing months the useful question is what
 *  still has time to finish; the rest of the year it is what can go out earliest. Offering "it's
 *  already late to start" in March is the kind of thing that tells a reader the page is not paying
 *  attention. */
export function situations(month) {
    const seasonal = month >= 6 && month <= 9 ? "midseason" : "earlystart";
    const keep = new Set(["containers", "shade", "clay", seasonal]);
    return SITUATIONS.filter((s) => keep.has(s.id));
}
/** The situation named by a hash, if any - `#/answers?situation=containers`. */
export function situationFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("situation");
    if (!raw)
        return null;
    return SITUATIONS.find((s) => s.id === raw) ?? null;
}
/** The corpus records spread as a [min, max] RANGE (and a user variety may carry a scalar), so read
 *  both shapes and judge on the TOP of the range - a plant that fits only at its smallest is not a
 *  plant that fits. */
const topOfRange = (v) => {
    if (Array.isArray(v)) {
        const nums = v.map(Number).filter((n) => Number.isFinite(n));
        return nums.length ? Math.max(...nums) : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
export function containerCrops(species, maxSpanCm, limit = 12) {
    const out = [];
    for (const sp of species) {
        const spread = topOfRange(sp.mature_spread_cm);
        const depth = String(sp.root_depth ?? "");
        if (spread == null || spread <= 0)
            continue; // no number, no claim
        if (spread > maxSpanCm)
            continue; // wider than the pot itself
        if (depth === "deep")
            continue; // a taproot wants ground, not a pot
        // A CROP THAT NEEDS A BLOCK CANNOT BE A CONTAINER CROP, and the corpus says which ones those
        // are: corn carries `pollination.block_min_plants: 12` (R-001's pollination block). Excluded by
        // its own data rather than by my taste - a mechanical spread filter alone happily recommends
        // corn in a pot, which is the kind of confident nonsense this project exists not to print.
        const poll = sp.pollination;
        if (Number(poll?.block_min_plants) > 1)
            continue;
        // Cover crops and ornamentals are not what "what can I grow in containers" is asking. Category
        // is the corpus's own reader-facing grouping (D-155), so this narrows by a field the corpus
        // maintains rather than by a list I would have to keep true myself.
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        // NO lifespan filter: a perennial herb in a pot is the most ordinary container planting there
        // is, and excluding perennials would drop thyme, chives and rosemary - the answers a balcony
        // gardener most wants. A fruit tree is already excluded by its spread, which is the honest
        // reason to exclude it rather than by a category it shares with thyme.
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, spreadCm: spread, rootDepth: depth });
    }
    // Smallest first: the tightest space is the one that made someone tap this.
    out.sort((a, b) => (a.spreadCm - b.spreadCm) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
/** An ADAPTATION rather than a team in its own right - the corpus names them that way, in the
 *  display name a reader sees: "Three Sisters (small bed)", "pizza garden (patio)". They belong on
 *  the plan, where a footprint gate offers them; they do not belong in a list whose job is to show
 *  what KINDS of team exist. */
const isAdaptation = (name) => /\(/.test(name);
/** The teams to show when the visitor has named no crop: ONE of each kind we hold, so the list
 *  shows the RANGE rather than the inventory, plus an honest count of the rest. Listing all
 *  thirteen was the wordiness - and a wall of names is not an answer, it is a catalogue. */
export function headlineTeams(guilds, nameOf) {
    const plantable = guilds.filter((g) => String(g.guild_class ?? "") !== "out_of_scope");
    const order = ["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle"];
    const shown = [];
    for (const cls of order) {
        const pick = plantable.find((g) => String(g.guild_class) === cls && !isAdaptation(nameOf(g)));
        if (!pick)
            continue;
        const mech = (pick.mechanisms ?? [])
            .map((m) => m?.claim).find((c) => !!c) ?? null;
        shown.push({ id: String(pick.id), name: nameOf(pick), mechanism: mech });
    }
    return { shown, more: Math.max(0, plantable.length - shown.length) };
}
/** The crops that finish fastest, by the corpus's own days-to-maturity. This is what makes the
 *  late-to-start situation its OWN answer rather than a second copy of door 1: door 1 tells you
 *  when to plant a crop you have already chosen; this tells you which crops are still worth
 *  choosing. GDD-scheduled species carry no DTM and are simply absent - never estimated. */
export function quickCrops(species, limit = 10) {
    const out = [];
    for (const sp of species) {
        if (String(sp.scheduling_model ?? "") !== "dtm")
            continue;
        // Same narrowing as the container answer, for the same reason: "what can I still start" is
        // asking about food, and a cover crop or a bedding flower answering it would be the list
        // padding itself. Category is the corpus's own reader-facing grouping (D-155).
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        const dtm = sp.days_to_maturity;
        const low = Array.isArray(dtm) ? Number(dtm[0]) : Number(dtm);
        if (!Number.isFinite(low) || low <= 0)
            continue;
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, days: low });
    }
    out.sort((a, b) => (a.days - b.days) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
