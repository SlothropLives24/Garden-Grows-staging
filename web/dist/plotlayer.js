import { composePlot } from "./engine/plotcompose.js";
import { displayName } from "./engine/guilds.js";
import { fmtArea } from "./units.js";
import { ruleClaim } from "./state.js";
import { markLink } from "./dossier.js";
export function plotBlock(bundle, beds) {
    if (!beds.length)
        return null;
    const r = composePlot({ beds }, bundle);
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
        ? `Your whole plot · 1 bed, ${fmtArea(r.total_m2)}`
        : `Your whole plot · ${beds.length} beds, ${fmtArea(r.total_m2)} together`;
    box.appendChild(head);
    const tier = document.createElement("p");
    tier.className = "plot-tier";
    tier.textContent = r.tier.copy.replace(/\bguilds\b/g, "plant teams").replace(/\bguild\b/g, "plant team");
    box.appendChild(tier);
    if (r.refused) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = "Too many beds to arrange automatically - the per-bed cards below still "
            + "carry each bed's own answer.";
        box.appendChild(p);
        return box;
    }
    if (!r.arrangements.length)
        return box;
    const solo = r.tier.key === "under_1" || r.tier.key === "one_guild" || beds.length === 1;
    if (solo) {
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
    const how = document.createElement("details");
    how.className = "plot-how";
    const sum = document.createElement("summary");
    sum.textContent = "How these are ranked";
    const key = document.createElement("p");
    key.className = "plot-key";
    key.textContent = "Each arrangement is ranked by how many known plant partnerships it puts to work, "
        + "weighted by how sure we are of each - every team's own, plus the ones only this pairing of "
        + "beds adds. Trouble between neighbouring beds isn't counted yet, so nothing is marked down for "
        + "it; each bed's own warnings still stand.";
    how.append(sum, key);
    box.appendChild(how);
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
            markLink(link, { kind: "rule", id: c.rule });
            cli.appendChild(link);
            ul.appendChild(cli);
        }
        li.appendChild(ul);
    }
    return li;
}
