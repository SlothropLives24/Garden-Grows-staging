import { cardRecord, cardRows, formatValue, guildsPlacing, sectioned } from "../engine/plantcard.js";
function localValue(r) {
    if (r.unit !== "cm" || unitSystem() === "metric")
        return formatValue(r);
    const v = r.value;
    if (Array.isArray(v)) {
        const parts = v.map((x) => fmtCm(Number(x)));
        return new Set(parts).size === 1 ? parts[0] : `${parts[0].replace(/ in$/, "")}–${parts[1]}`;
    }
    return typeof v === "number" ? fmtCm(v) : formatValue(r);
}
import { displayName } from "../engine/guilds.js";
import { familyName, stripRuleCitations } from "../engine/labels.js";
import { app, commonName, ruleClaim } from "../state.js";
import { confidenceBadge } from "../confidence.js";
import { mark, markControl, markLink } from "../dossier.js";
import { fmtCm, unitSystem } from "../units.js";
import { matches } from "../engine/compiler.js";
import { el } from "../dom.js";
const $ = (id) => document.getElementById(id);
let focus = null;
export function plantFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const p = new URLSearchParams(String(hash).slice(q + 1));
    const id = p.get("id");
    return id ? { id, group: p.get("group") } : null;
}
export function setPlantFocus(f) { focus = f; }
export const plantHref = (id, group) => `#/plant?id=${encodeURIComponent(id)}${group ? `&group=${encodeURIComponent(group)}` : ""}`;
export function plantLink(name, id, group) {
    const a = document.createElement("a");
    a.className = "pname";
    a.href = plantHref(id, group ?? null);
    a.textContent = name;
    return a;
}
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
export function splitAroundLabel(text, label) {
    if (!label)
        return null;
    const at = text.indexOf(label);
    if (at < 0)
        return null;
    return { before: text.slice(0, at), hit: label, after: text.slice(at + label.length) };
}
export function groupLabel(g) {
    const id = String(g.id ?? "");
    const common = g.common ? String(g.common) : "";
    const idWords = id.replace(/_/g, " ");
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    if (!common)
        return cap(idWords);
    const words = new Set(common.toLowerCase().split(/\s+/));
    const redundant = idWords.toLowerCase().split(/\s+/).every((w) => words.has(w));
    return redundant ? cap(common) : `${cap(common)} / ${idWords}`;
}
function cardMode(speciesId) {
    const snap = app.logSnapshot;
    const season = snap.seasons.find((s) => s.id === snap.seasonId);
    const live = (season?.plantings ?? []).filter((pl) => pl.species === speciesId && !pl.end_date);
    if (!live.length)
        return "reference";
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
        head.textContent = "Plant";
        box.appendChild(el("p", "pc-hint", "We have no record for that plant. Plants you added yourself live on this device - the Log's "
            + "“My added plants” is where they are edited."));
        return;
    }
    const name = commonName(bundle, focus.id);
    head.textContent = name;
    const img = rec.image;
    if (img && typeof img.artist === "string") {
        const fig = el("figure", "pc-photo");
        fig.dataset.spotPhoto = focus.id;
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
    const resolved = cardRecord(focus.id, focus.group, bundle) ?? {};
    const groups = (rec.cultivar_groups ?? []);
    if (groups.length) {
        box.appendChild(el("p", "pc-k", "Variety"));
        const strip = el("div", "pc-chips");
        for (const g of groups) {
            const gid = String(g.id);
            const a = el("a", `pc-chip${gid === focus.group ? " on" : ""}`, groupLabel(g));
            a.href = plantHref(focus.id, gid);
            strip.appendChild(a);
        }
        box.appendChild(strip);
        if (!focus.group) {
            box.appendChild(el("p", "pc-hint", "Size, timing and support depend on the variety. Pick one above to see them."));
        }
    }
    const rows = cardRows(resolved);
    const lead = cardMode(focus.id) === "planting" ? "How to plant it" : null;
    for (const [section, members] of sectioned(rows, lead)) {
        box.appendChild(el("p", "pc-k", section));
        for (const r of members) {
            const row = el("div", "pc-row");
            row.appendChild(el("span", undefined, r.label));
            const val = el("span", undefined, localValue(r));
            if (r.soft) {
                const soft = r.soft === "contested" ? "contested" : "estimated";
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "pc-soft";
                chip.textContent = soft;
                markControl(chip, { kind: "species", id: focus.id, group: focus.group, field: r.key });
                val.appendChild(chip);
            }
            else if (r.sources.length) {
                mark(val, { kind: "species", id: focus.id, group: focus.group, field: r.key }, { label: "source" });
            }
            row.appendChild(val);
            box.appendChild(row);
        }
    }
    const famId = typeof resolved.family === "string" ? String(resolved.family) : "";
    if (famId) {
        const frow = el("div", "pc-row");
        frow.appendChild(el("span", undefined, "Family"));
        frow.appendChild(el("span", undefined, familyName(famId)));
        box.appendChild(frow);
    }
    const applies = bundle.rules.filter((r) => {
        const at = r.applies_to ?? null;
        if (at && Object.keys(at).length && matches(resolved, at)[0])
            return true;
        const v = at?.species;
        if (Array.isArray(v) ? v.includes(focus.id) : v === focus.id)
            return true;
        const trig = r.trigger;
        return trig?.species === focus.id;
    });
    if (applies.length) {
        box.appendChild(el("p", "pc-k", "Rules that apply"));
        for (const r of applies) {
            const card = el("div", "out");
            const claim = el("p", "outclaim", stripRuleCitations(ruleClaim(bundle, r.id)));
            claim.appendChild(document.createTextNode(" "));
            const why = document.createElement("a");
            why.className = "whytap";
            why.href = `#/why?rule=${r.id}`;
            why.textContent = "Why this? →";
            markLink(why, { kind: "rule", id: r.id });
            claim.appendChild(why);
            card.appendChild(claim);
            const badge = confidenceBadge(String(r.grade ?? ""));
            if (badge) {
                const cp = el("p", "outconf");
                cp.appendChild(badge);
                card.appendChild(cp);
            }
            const mech = r.mechanism;
            if (mech)
                card.appendChild(el("p", "outfix", stripRuleCitations(mech)));
            box.appendChild(card);
        }
    }
    const guilds = guildsPlacing(focus.id, bundle);
    if (guilds.length) {
        box.appendChild(el("p", "pc-k", "Plant teams that use it"));
        const ul = el("ul", "pc-guilds");
        for (const gid of guilds) {
            const g = bundle.guilds.find((x) => x.id === gid);
            const li = el("li");
            const a = document.createElement("a");
            a.href = `#/plan?guild=${gid}`;
            a.textContent = g ? displayName(g) : gid;
            markLink(a, { kind: "team", id: gid });
            li.appendChild(a);
            ul.appendChild(li);
        }
        box.appendChild(ul);
    }
    const outp = el("p", "pc-hint");
    const outa = el("a", undefined, `Everything recorded about ${name.toLowerCase()}, as a page`);
    outa.href = `../plants/${focus.id.replace(/_/g, "-")}/`;
    outp.appendChild(outa);
    box.appendChild(outp);
    const note = el("p", "pc-hint");
    note.appendChild(document.createTextNode("There is no list of good and bad neighbours here, and "
        + "that is deliberate. "));
    const a = el("a", undefined, "Why this planner has no companion-planting chart");
    a.href = "../explainers/why-no-companion-planting-chart/";
    note.appendChild(a);
    box.appendChild(note);
}
