// The plant card — one surface, opened from everywhere a plant is named.
//
// WHY A ROUTE AND NOT A MODAL. `#/plant?id=<species>&group=<g>` is the sibling of `#/why?rule=`.
// Being a real route buys three things a modal cannot: the back button works, the 73 static
// species pages can link IN (today the linkage is one-way — they link into the app and nothing
// links back), and a gardener can send someone a plant.
//
// WHY ONE COMPONENT. The picker, the Log's plant panel, a Calendar task, the Answers crop rung and
// the Home questions all name species. Each could have grown its own detail view; they open this
// one instead. That is a single testable rule rather than five design decisions, and it is why the
// card takes a species id and nothing else.
//
// WHAT IT MAY NOT DO. D-161: a species carries no reader-facing prose field, because rendered
// free-text has no evidence block and is where ungraded claims collect. So this renders typed
// graded facts and the rules that fire — never a blurb. And per CLAUDE.md there is no companion
// grid: the card names the curated GUILDS a plant belongs to, and links the refutations that
// explain why the usual chart is wrong.
import { cardRecord, cardRows, formatValue, guildsPlacing, sectioned } from "../engine/plantcard.js";
import { displayName } from "../engine/guilds.js";
import { stripRuleCitations } from "../engine/labels.js";
import { app, commonName, ruleClaim } from "../state.js";
const $ = (id) => document.getElementById(id);
let focus = null;
/** Parse `#/plant?id=…&group=…`. Mirrors doors.ts's `situationFromHash` idiom. */
export function plantFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const p = new URLSearchParams(String(hash).slice(q + 1));
    const id = p.get("id");
    return id ? { id, group: p.get("group") } : null;
}
export function setPlantFocus(f) { focus = f; }
/** The href every other surface uses. One place builds it, so a link cannot drift from the route. */
export const plantHref = (id, group) => `#/plant?id=${encodeURIComponent(id)}${group ? `&group=${encodeURIComponent(group)}` : ""}`;
const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text !== undefined)
        n.textContent = text;
    return n;
};
/** A plant's name, as a link to its card. THE ONE WAY a name should reach a screen.
 *
 *  WHY A HELPER AND NOT PER-SITE ANCHORS (2026-08-02, second staging walk). The card shipped
 *  reachable from four places out of the ~72 sites that render a plant name, because I wired the
 *  four I had designed and never audited the rest. The maintainer could find exactly one. A helper
 *  makes a linked name the DEFAULT construction rather than a thing each site remembers to do.
 *
 *  WHERE IT CANNOT BE USED, and these are HTML limits rather than choices:
 *    - inside `<option>` (a select's items admit no elements) — the bed and species dropdowns;
 *    - inside `<button>` (a link nested in a button is invalid and is how O33's swallowed tap
 *      happened) — the picker row, which carries its own separate chevron instead;
 *    - in a toast, which has gone before it could be tapped;
 *    - INSIDE AN ANCHOR THAT ALREADY SERVES THE SAME INTENT (added 2026-08-02, O46) - the shared
 *      plan's call to action reads "When would Tomato grow at your place?" and is itself a link to
 *      that crop's dates. Nesting an anchor is invalid markup for the same reason the button case
 *      is, and there is no false affordance to fix: it looks like a link because it IS one.
 *  Those sites keep plain text. Everywhere else takes this.
 *
 *  A FIFTH CASE IS NOT AN EXEMPTION BUT A LIMIT: a user-added variety has no card, because its id
 *  resolves to nothing in the bundle. Those names stay plain AND must not wear `.pname`. */
export function plantLink(name, id, group) {
    const a = document.createElement("a");
    a.className = "pname";
    a.href = plantHref(id, group ?? null);
    a.textContent = name;
    return a;
}
/** Append `text` to `host` with the FIRST occurrence of `label` turned into a link to its card.
 *
 *  WHY THIS EXISTS (O45, ruled 2026-08-02 option A). Most plant names in this app do not stand
 *  alone - they sit inside a sentence the code composed ("Tomato in Bed A reaches its harvest
 *  window in 3 days"). `plantLink` covers the standalone case; without this, everything phrased as
 *  a sentence stays unlinked, and a gardener has to work out which names are tappable. That is
 *  precisely the complaint this arc is answering.
 *
 *  THE SAFETY RULE, AND IT IS THE WHOLE ARGUMENT FOR THE SIGNATURE. The caller passes the label it
 *  ITSELF interpolated, alongside the species id it built that label from. This never searches for
 *  plant names in arbitrary prose. Scanning would be the same class of error as the crop-table name
 *  matching that gave beet the Swiss-chard sowing depth - and worse here, because "bean", "squash"
 *  and "corn" are ordinary English words.
 *
 *  FIRST OCCURRENCE ONLY: a sentence naming a crop three times would otherwise become three
 *  accent-coloured links, which is noise wearing the costume of an affordance.
 *
 *  IF THE LABEL IS NOT IN THE TEXT, THE TEXT RENDERS WHOLE AND PLAIN. A linking helper must never
 *  be able to drop a word of what a rule says; losing the link is the cheap failure, losing the
 *  sentence is not. */
export function linkNameIn(host, text, label, speciesId, group) {
    const cut = splitAroundLabel(text, label);
    if (!cut) {
        host.appendChild(document.createTextNode(text));
        return;
    }
    if (cut.before)
        host.appendChild(document.createTextNode(cut.before));
    host.appendChild(plantLink(cut.hit, speciesId, group ?? null));
    if (cut.after)
        host.appendChild(document.createTextNode(cut.after));
}
/** Append `text` to `host` with SEVERAL caller-supplied labels linked, each to its own card.
 *
 *  WHY THIS EXISTS (O46's tail). `linkNameIn` links one label, and most of what was left plain
 *  names more than one crop in a single sentence - "Sow the Pole bean ~14 days after the Corn is
 *  established", "the corn and beans share each mound", a substitution verdict that names the
 *  filler and then its alternates. Those were not left because they are fiddly; they were left
 *  because the helper did not cover them.
 *
 *  THE SAFETY RULE IS UNCHANGED and is still the whole argument for the signature: every label
 *  arrives from the caller that interpolated it, next to the id it built that label from. Prose is
 *  never searched for a plant name.
 *
 *  MARKS MAY ARRIVE IN ANY ORDER. Longer labels claim their spans first (see `claimLabels` for
 *  why that is a correctness rule, not tidiness), each takes the first unclaimed occurrence, and
 *  the spans are then laid out by POSITION, not by argument order. Walking the tail instead would
 *  make a caller that lists its crops in a different order than it interpolated them silently lose
 *  a link - a correctness that holds by luck, which is the exact failure this arc kept hitting in
 *  its selectors.
 *
 *  ONE OCCURRENCE PER MARK, and if a label is not in the text that mark links nothing while THE
 *  TEXT STILL RENDERS WHOLE. Losing a link is the cheap failure; losing a word of what a rule says
 *  is not. */
export function linkNamesIn(host, text, marks) {
    const spans = claimLabels(text, marks.map((m) => m.label));
    const hits = spans
        .map((at, i) => ({ at, mark: marks[i] }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const h of hits) {
        if (h.at > cursor)
            host.appendChild(document.createTextNode(text.slice(cursor, h.at)));
        host.appendChild(plantLink(h.mark.label, h.mark.species, h.mark.group ?? null));
        cursor = h.at + h.mark.label.length;
    }
    if (cursor < text.length)
        host.appendChild(document.createTextNode(text.slice(cursor)));
}
/** Where each label sits, or -1 for one that is absent or whose every occurrence is already spoken
 *  for. Separated from the DOM assembly above for the same reason `splitAroundLabel` is: this is
 *  where the edges live (a label absent, a label appearing twice, two marks sharing a label, a
 *  label that is a SUBSTRING of another), and it is the half worth pinning. Returns one entry per
 *  label, in the order given.
 *
 *  LONGER LABELS CLAIM FIRST, whatever order the caller listed them in. Claiming in argument order
 *  let "bean" (listed first) claim the span INSIDE "Pole bean" - an anchor that reads as the tail
 *  of one plant's name but opens another plant's card, which is the exact wrong-card fault the
 *  aside rule exists to prevent. The review that shipped this said "no caller passes that order";
 *  the hills intro can (its marks are pushed fixer-first, and a user-added variety may fill either
 *  role with any name), so the guarantee moved from an assertion about callers into the function.
 *  Ties keep argument order, so two marks sharing a label still take successive occurrences. */
export function claimLabels(text, labels) {
    const taken = [];
    const spans = new Array(labels.length).fill(-1);
    const order = labels.map((_, i) => i).sort((a, b) => labels[b].length - labels[a].length || a - b);
    for (const i of order) {
        const label = labels[i];
        if (!label)
            continue;
        for (let at = text.indexOf(label); at >= 0; at = text.indexOf(label, at + 1)) {
            const end = at + label.length;
            if (taken.some(([s, e]) => at < e && s < end))
                continue;
            taken.push([at, end]);
            spans[i] = at;
            break;
        }
    }
    return spans;
}
/** The decision inside `linkNameIn`, separated so it is testable without a DOM: where the first
 *  occurrence of `label` sits in `text`, or null when it is not there and the text must render
 *  whole. This is where every edge lives (label absent, label at either end, empty label), and it
 *  is the half worth pinning - the DOM assembly above is three appends. */
export function splitAroundLabel(text, label) {
    if (!label)
        return null;
    const at = text.indexOf(label);
    if (at < 0)
        return null;
    return { before: text.slice(0, at), hit: label, after: text.slice(at + label.length) };
}
/** A cultivar group's chip label: the gardener's word first, the corpus term after it where they
 *  differ. Seed packets say "determinate", so dropping it would cost a reader the word they will
 *  meet on the packet - but leading with it is what made two tomato chips read as the same word on
 *  a phone (staging walk, 2026-08-02). A group whose `common` IS its id shows the one word. */
export function groupLabel(g) {
    const id = String(g.id ?? "");
    const common = g.common ? String(g.common) : "";
    const idWords = id.replace(/_/g, " ");
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    if (!common)
        return cap(idWords);
    // THE CORPUS TERM IS KEPT ONLY WHERE IT ADDS SOMETHING. "Pole bean / pole" is noise, but
    // "Bush tomato / determinate" is not: `determinate` is the word on the seed packet, and
    // `rootstock` is what actually decides how big an apple tree gets. So the id is dropped when it
    // is already a word inside the common name, and shown when it is genuinely a second term.
    const words = new Set(common.toLowerCase().split(/\s+/));
    const redundant = idWords.toLowerCase().split(/\s+/).every((w) => words.has(w));
    return redundant ? cap(common) : `${cap(common)} / ${idWords}`;
}
/** Which way round to read this card, decided from what the gardener has ACTUALLY done.
 *
 *  Chosen over a calendar rule deliberately (maintainer, 2026-08-02): a fall crop going into the
 *  ground in July still needs planting instructions, and a month gate would have buried them. The
 *  three modes are exhaustive and `reference` is the one that matters most - it is what the picker,
 *  a plant you do not grow, and all 73 static species pages see, so the DEFAULT order has to read
 *  well on its own rather than being an afterthought.
 *
 *    planting  - planned in the open season, no `sown` date yet -> lead with how to plant it
 *    growing   - sown and not ended                             -> default order
 *    reference - not in this garden, ended, or no garden at all -> default order */
export function cardMode(speciesId) {
    const snap = app.logSnapshot;
    const season = snap.seasons.find((s) => s.id === snap.seasonId);
    const live = (season?.plantings ?? []).filter((pl) => pl.species === speciesId && !pl.end_date);
    if (!live.length)
        return "reference";
    // Any live planting still awaiting a sow date puts the card in planting mode: if you have three
    // tomatoes in and a fourth still to go in, you still want the depth.
    return live.some((pl) => !pl.sown) ? "planting" : "growing";
}
export function renderPlantCard(bundle) {
    const box = $("plantcard");
    const head = $("plant-h");
    if (!box || !head)
        return;
    box.replaceChildren();
    if (!focus) {
        head.textContent = "Plant";
        box.appendChild(el("p", "pc-hint", "Pick a plant to see what the corpus records about it."));
        return;
    }
    const rec = bundle.species.find((s) => s.id === focus.id);
    if (!rec) {
        // An unknown id is a REFUSAL, not an empty card. A user-added species lives in the browser and
        // is not in the bundle, so this is reachable in normal use and must say something true.
        head.textContent = "Plant";
        box.appendChild(el("p", "pc-hint", "We have no record for that plant. Plants you added yourself live on this device - the Log's "
            + "“My added plants” is where they are edited."));
        return;
    }
    const name = commonName(bundle, focus.id);
    head.textContent = name;
    // O44 — a reference photo, when the corpus carries one. Not prose and not a claim (D-161): a
    // credited image, lazy-loaded and never precached, so it costs nothing on cold boot. The file is
    // the base species' (a cultivar group has no photo of its own in the first pass); if it is missing
    // the figure removes itself rather than leaving a broken frame — the graceful-absence rule the
    // rows already use, one surface over.
    const img = rec.image;
    if (img && typeof img.artist === "string") {
        const fig = el("figure", "pc-photo");
        fig.dataset.spotPhoto = focus.id; // O54: the photo joins spot mode; its chip jumps to the Photos tab
        const im = el("img");
        im.src = `img/${encodeURIComponent(focus.id)}.webp`;
        im.alt = typeof img.alt === "string" ? img.alt : "";
        im.loading = "lazy";
        im.decoding = "async";
        im.onerror = () => fig.remove();
        fig.appendChild(im);
        fig.appendChild(el("figcaption", "pc-credit", `Photo: ${img.artist} · ${String(img.licence ?? "")}`));
        box.appendChild(fig);
    }
    // The cultivar group matters enough to name: a determinate tomato and an indeterminate one are
    // different plants for every number below, which is why the card is per (species, group) and
    // cannot be precomputed at build time.
    //
    // O41 (ruled 2026-08-02): with NO group chosen the card describes the species BARE. It used to
    // describe groups[0] - the planner's default - which printed one cultivar's numbers under the
    // species' name. `cardRecord` owns that choice so it is testable without a DOM.
    const resolved = cardRecord(focus.id, focus.group, bundle) ?? {};
    const groups = (rec.cultivar_groups ?? []);
    if (groups.length) {
        box.appendChild(el("p", "pc-k", "Variety"));
        const strip = el("div", "pc-chips");
        for (const g of groups) {
            const gid = String(g.id);
            // NOTHING is lit when nothing was chosen. Lighting groups[0] said "you are looking at the
            // determinate" to a gardener who never said so, which is the same untruth as the numbers.
            const a = el("a", `pc-chip${gid === focus.group ? " on" : ""}`, groupLabel(g));
            a.href = plantHref(focus.id, gid);
            strip.appendChild(a);
        }
        box.appendChild(strip);
        if (!focus.group) {
            // The chips are the invitation, so the card says what they are for. Without this the short
            // card reads as "we know little about tomatoes" rather than "pick which tomato".
            box.appendChild(el("p", "pc-hint", "Size, timing and support depend on the variety. Pick one above to see them."));
        }
    }
    // --- what the corpus records -------------------------------------------------------------
    const rows = cardRows(resolved);
    const lead = cardMode(focus.id) === "planting" ? "How to plant it" : null;
    for (const [section, members] of sectioned(rows, lead)) {
        box.appendChild(el("p", "pc-k", section));
        for (const r of members) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, r.label));
            const val = el("span", undefined, formatValue(r));
            if (r.soft) {
                // The tier rides ON the number. A soft figure whose softness is disclosed in another
                // section is disclosed in name only, and the app has less room than a web page.
                val.appendChild(el("span", "pc-soft", r.soft === "contested" ? "contested" : "estimated"));
            }
            row.appendChild(val);
            box.appendChild(row);
        }
    }
    // --- the rules that apply ------------------------------------------------------------------
    // The static page shows the rules that COULD apply; the app can show which fire on a real bed.
    // This card is the species-level view, so it shows the same set the page does - the bed-level
    // view is the Plan's own report. That asymmetry is deliberate and recorded in the plan.
    const applies = bundle.rules.filter((r) => {
        // A LIST IS AS VALID AS A STRING HERE, and reading only the string was a silent bug: a rule
        // scoped to several species would simply never appear on any of their cards, with nothing
        // logged - the same never-fires class the validator's E-ROLEREF comment describes. No shipped
        // rule uses a list yet, so nothing was visibly broken; R-108 will be the first.
        const t = r.applies_to;
        const v = t?.species;
        return Array.isArray(v) ? v.includes(focus.id) : v === focus.id;
    });
    if (applies.length) {
        box.appendChild(el("p", "pc-k", "Rules that apply"));
        for (const r of applies) {
            const card = el("div", "out");
            card.appendChild(el("p", "outclaim", stripRuleCitations(ruleClaim(bundle, r.id))));
            const mech = r.mechanism;
            if (mech)
                card.appendChild(el("p", "outfix", stripRuleCitations(mech)));
            box.appendChild(card);
        }
    }
    // --- guilds, and the refutations ------------------------------------------------------------
    const guilds = guildsPlacing(focus.id, bundle);
    if (guilds.length) {
        box.appendChild(el("p", "pc-k", "Guilds that place it"));
        const ul = el("ul", "pc-guilds");
        for (const gid of guilds) {
            // Through the SAME resolver the guild cards and the static pages use. The card has no naming
            // rule of its own, which is why it can no longer print "three_sisters".
            const g = bundle.guilds.find((x) => x.id === gid);
            ul.appendChild(el("li", undefined, g ? displayName(g) : gid));
        }
        box.appendChild(ul);
    }
    // --- the one way OUT to this plant's own page --------------------------------------------
    //
    // O36's seam, and this is the whole of the app's half of it. The 73 static species pages link
    // INTO the app; nothing linked back out, so a gardener mid-plan could not reach the document
    // written about the plant in their hand.
    //
    // ONE LINK, ON THE CARD, and deliberately NOT on every plant name. Every name in the app already
    // opens this card - that is what the last three sessions built - so giving the same word a second
    // destination would re-create the "which link is which" question the whole arc closed. The card
    // is where a reader has already said "tell me about this plant", so it is where the longer read
    // belongs. The page's slug is the species id with underscores swapped for hyphens, which is
    // `slug()` in engine/build_pages.py; the two must agree, and a test pins that they do.
    const outp = el("p", "pc-hint");
    const outa = el("a", undefined, `Everything recorded about ${name.toLowerCase()}, as a page`);
    outa.href = `../plants/${focus.id.replace(/_/g, "-")}/`;
    outp.appendChild(outa);
    box.appendChild(outp);
    // CLAUDE.md: no companion-planting chart. What the card offers instead is the reason there is
    // none - which is a better answer than silence for a gardener who came looking for the grid.
    const note = el("p", "pc-hint");
    note.appendChild(document.createTextNode("There is no list of good and bad neighbours here, and "
        + "that is deliberate. "));
    const a = el("a", undefined, "Why this planner has no companion-planting chart");
    a.href = "../explainers/why-no-companion-planting-chart/";
    note.appendChild(a);
    box.appendChild(note);
}
