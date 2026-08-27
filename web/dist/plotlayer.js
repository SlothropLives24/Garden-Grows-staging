// Your whole plot (O71 / D-plot-composition). A PLOT-WIDE layer above the per-bed guild cards,
// in steering.ts's posture: a pure reader over the engine (plotcompose.ts), writing no new claim
// and no new number. Each bed keeps its own card and band below; this block says what an
// ARRANGEMENT of them buys - the spanning upgrade (two small beds hosting the guild neither fits
// alone, with the joint corn block that only exists because wind does not know where a bed edge
// is) and the cross-boundary credit (an insectary border serving the fruiting bed next door).
//
// The ladder is the feature: the tier sentence tells a 6 m2 gardener "combination is now
// possible" and a 1.5 m2 gardener "one planting at a time - the honest answer, not a lesser
// one". Below the combination tier the block does NOT invent a second bed to look generous.
//
// D-083: no rule codes in visible text - every cross-boundary term links by its rule's own claim
// sentence. D-105: no emoji; the strength number is plain text. No canvas (D-078): arrangements
// are prose over named beds, never a drag surface.
import { composePlot } from "./engine/plotcompose.js";
import { displayName } from "./engine/guilds.js";
import { ruleClaim } from "./state.js";
/** The whole-plot arrangement block, or null when there is nothing to say (no saved beds).
 *  `beds` is the caller's PLANNABLE list (sectioned containers already excluded) - name+region
 *  pairs in plot coordinates, the same ground rotation history lives on. */
export function plotBlock(bundle, beds) {
    if (!beds.length)
        return null;
    const r = composePlot({ beds }, bundle);
    // One bed with room to spare says NOTHING here (QA sweep 2026-08-12): the tier copy promised
    // "combination" to a gardener with nothing to combine, and the "strongest single fit" line
    // only duplicated the ranked cards below. The block earns its place with >= 2 beds, or on a
    // single bed small enough that the honest one-planting message IS the answer.
    const solo1 = beds.length === 1;
    if (solo1 && r.tier.key !== "under_1" && r.tier.key !== "one_guild")
        return null;
    const byId = new Map(bundle.guilds.map((g) => [g.id, g]));
    const name = (gid) => {
        const g = byId.get(gid);
        return g ? displayName(g) : gid;
    };
    const box = document.createElement("div");
    box.className = "plotlayer";
    const head = document.createElement("p");
    head.className = "plot-legend";
    head.textContent = solo1
        ? `Your whole plot · 1 bed, ${r.total_m2} m²`
        : `Your whole plot · ${beds.length} beds, ${r.total_m2} m² together`;
    box.appendChild(head);
    // The tier sentence - the ladder naming what this much ground allows (maintainer ruling).
    const tier = document.createElement("p");
    tier.className = "plot-tier";
    tier.textContent = r.tier.copy;
    box.appendChild(tier);
    if (r.refused) {
        // More beds than the arranger searches: say so plainly (the empty-plot case returned null
        // above, so the only refusal that reaches the screen is the honest search bound).
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = "Too many beds to arrange automatically - the per-bed cards below still "
            + "carry each bed's own answer.";
        box.appendChild(p);
        return box;
    }
    if (!r.arrangements.length)
        return box; // the tier sentence already said why
    const solo = r.tier.key === "under_1" || r.tier.key === "one_guild" || beds.length === 1;
    if (solo) {
        // The honest bottom rung: one proposal, named, no pretence of a second planting.
        const a = r.arrangements[0].assignments[0];
        const p = document.createElement("p");
        p.className = "plot-solo";
        p.append("The strongest single fit: ");
        p.appendChild(guildLink(a.guild, name(a.guild)));
        p.append(` on ${a.beds[0]} - its card below has the band and the plan.`);
        box.appendChild(p);
        return box;
    }
    const list = document.createElement("ol");
    list.className = "plot-arrangements";
    for (const a of r.arrangements)
        list.appendChild(arrangementItem(a, bundle, name));
    box.appendChild(list);
    const key = document.createElement("p");
    key.className = "plot-key";
    key.textContent = "Each arrangement's strength is the grade-weighted count of corpus mechanisms "
        + "it fires - every guild's own, plus what only the arrangement adds. Negative interactions "
        + "across beds are not yet computable, so no arrangement is docked for one; the per-bed "
        + "warnings still apply.";
    box.appendChild(key);
    return box;
}
function guildLink(gid, label) {
    const a = document.createElement("a");
    a.href = `#/plan?guild=${gid}`;
    a.textContent = label;
    return a;
}
function arrangementItem(a, bundle, name) {
    const li = document.createElement("li");
    const line = document.createElement("p");
    line.className = "plot-arr";
    const strength = document.createElement("span");
    strength.className = "plot-strength";
    strength.textContent = String(a.score);
    strength.title = "grade-weighted mechanisms fired by this arrangement";
    line.appendChild(strength);
    a.assignments.forEach((x, i) => {
        if (i)
            line.append(" · ");
        line.appendChild(guildLink(x.guild, name(x.guild)));
        line.append(x.spans
            ? ` planted as ONE bed across ${x.beds.join(" + ")}`
            : ` on ${x.beds.join(" + ")}`);
    });
    li.appendChild(line);
    // What only the arrangement adds - each cross-boundary term named by its rule's own claim
    // (D-083: the code never surfaces; the claim sentence is the link text).
    if (a.cross.length) {
        const ul = document.createElement("ul");
        ul.className = "plot-cross";
        for (const c of a.cross) {
            const cli = document.createElement("li");
            const detail = c.kind === "joint_corn_block"
                ? "the block pollinates as one planting across the bed edge: "
                : c.kind === "insectary_spillover"
                    ? `${String(c.detail.from)} serves ${String(c.detail.to)}: `
                    : "";
            cli.append(detail);
            const link = document.createElement("a");
            link.href = `#/why?rule=${c.rule}`;
            link.textContent = ruleClaim(bundle, c.rule);
            cli.appendChild(link);
            ul.appendChild(cli);
        }
        li.appendChild(ul);
    }
    return li;
}
