import { regionCentroid, regionPoints } from "./engine/regions.js";
const SVG_NS = "http://www.w3.org/2000/svg";
export function plantState(p, todayIso, harvestOpensIso) {
    if (p.end_cause)
        return "ended";
    if (p.carried_over === true)
        return "carried";
    if (p.first_harvest && p.first_harvest <= todayIso)
        return "picked";
    if (harvestOpensIso && todayIso >= harvestOpensIso)
        return "window";
    if (p.sown && p.sown <= todayIso)
        return "ground";
    return "planned";
}
export function heldRadius(region) {
    const pts = regionPoints(region);
    if (!pts.length)
        return 0;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return Math.max(0, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2);
}
function plotBounds(beds) {
    const xs = [], ys = [];
    for (const b of beds)
        for (const [x, y] of b.points) {
            xs.push(x);
            ys.push(y);
        }
    if (!xs.length)
        return { minX: 0, minY: 0, w: 1, h: 1 };
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { minX, minY, w: Math.max(Math.max(...xs) - minX, 0.3), h: Math.max(Math.max(...ys) - minY, 0.3) };
}
export function plateModel(plot, season, prev, todayIso, harvestOpens) {
    const beds = (plot?.beds ?? []).map((b) => ({ name: b.name, points: regionPoints(b.region) }));
    const plants = (season?.plantings ?? []).map((p) => ({
        species: p.species,
        state: plantState(p, todayIso, harvestOpens?.(p) ?? null),
        at: regionCentroid(p.region),
        r: heldRadius(p.region),
    }));
    const ghosts = (prev?.plantings ?? []).map((p) => ({ species: p.species, at: regionCentroid(p.region), year: prev?.id, r: heldRadius(p.region) }));
    return { beds, plants, ghosts, bounds: plotBounds(beds) };
}
export function bedPlate(bed, season, prev, todayIso, onBed, harvestOpens, opts) {
    const onBedPlantings = (season?.plantings ?? []).filter((p) => onBed(p.region));
    if (!onBedPlantings.length)
        return null;
    const ghostsOnBed = (prev?.plantings ?? []).filter((p) => onBed(p.region));
    const model = plateModel({ beds: [bed] }, { ...(season ?? { id: 0, plot: "" }), plantings: onBedPlantings }, { ...(prev ?? { id: 0, plot: "" }), plantings: ghostsOnBed }, todayIso, harvestOpens);
    const svg = renderPlate(model, { ...opts, label: opts?.label ?? `what is planted in ${bed.name} - north is up` });
    const counts = new Map();
    for (const p of model.plants)
        if (p.state !== "ended")
            counts.set(p.species, (counts.get(p.species) ?? 0) + 1);
    const plants = [...counts.entries()].map(([species, count]) => ({ species, count }));
    return { svg, plants, model };
}
export const markRadius = (heldPx, floor) => Math.max(floor, Number.isFinite(heldPx) ? heldPx : 0);
export function renderPlate(model, opts) {
    const { minX, minY, w, h } = model.bounds;
    const side = Math.max(w, h);
    const PXX = opts?.pxPerSide ?? 320;
    const scale = PXX / side;
    const W = w * scale, H = h * scale, PAD = 10;
    const sx = (x) => (x - minX) * scale;
    const sy = (y) => H - (y - minY) * scale;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "gardenplate");
    svg.setAttribute("viewBox", `${(W - side * scale) / 2 - PAD} ${(H - side * scale) / 2 - PAD} ${side * scale + 2 * PAD} ${side * scale + 2 * PAD}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts?.label ?? "your garden, drawn as it is now - north is up");
    for (const g of model.ghosts) {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", String(sx(g.at[0])));
        c.setAttribute("cy", String(sy(g.at[1])));
        c.setAttribute("r", String(markRadius(g.r * scale, 5)));
        c.setAttribute("class", "plate-ghost");
        c.setAttribute("data-species", g.species);
        svg.appendChild(c);
    }
    for (const b of model.beds) {
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", b.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" "));
        poly.setAttribute("class", "plate-bed");
        poly.setAttribute("data-bed", b.name);
        svg.appendChild(poly);
    }
    for (const p of model.plants) {
        const cx = sx(p.at[0]), cy = sy(p.at[1]);
        const rr = markRadius(p.r * scale, 6);
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(cy));
        dot.setAttribute("r", String(rr));
        dot.setAttribute("class", `plate-plant plate-${p.state}`);
        dot.setAttribute("data-species", p.species);
        dot.setAttribute("data-state", p.state);
        svg.appendChild(dot);
        if (p.state === "ended") {
            const strike = document.createElementNS(SVG_NS, "line");
            strike.setAttribute("x1", String(cx - rr));
            strike.setAttribute("y1", String(cy - rr));
            strike.setAttribute("x2", String(cx + rr));
            strike.setAttribute("y2", String(cy + rr));
            strike.setAttribute("class", "plate-struck");
            svg.appendChild(strike);
        }
    }
    return svg;
}
const STATE_WORDS = {
    planned: "planned", ground: "in the ground", window: "in its window",
    picked: "picked", ended: "ended", carried: "carried over",
};
export const stateWord = (state) => STATE_WORDS[state];
export function plateKey(model, nameOf) {
    const rows = [];
    const seen = new Map();
    for (const p of model.plants) {
        const k = `${p.species}|${p.state}`;
        const had = seen.get(k);
        if (had) {
            had.count++;
            continue;
        }
        const row = { species: p.species, name: nameOf(p.species), word: stateWord(p.state), state: p.state, count: 1 };
        seen.set(k, row);
        rows.push(row);
    }
    const ghosted = new Map();
    for (const g of model.ghosts) {
        const k = `${g.species}|${g.year ?? ""}`;
        const had = ghosted.get(k);
        if (had) {
            had.count++;
            continue;
        }
        const row = { species: g.species, name: nameOf(g.species), word: g.year ? `last year (${g.year})` : "last year", state: "ghost", year: g.year, count: 1 };
        ghosted.set(k, row);
        rows.push(row);
    }
    return rows;
}
export function plateKeyLabel(r, counts = false) {
    return `${r.name}${counts && r.count > 1 ? ` × ${r.count}` : ""} - ${r.word}`;
}
export function plateKeyInto(host, rows, opts) {
    if (!rows.length)
        return host;
    host.classList.add("plate-key");
    for (const r of rows) {
        const item = document.createElement(opts?.tag ?? "span");
        item.className = "hg-leg";
        const sw = document.createElement("span");
        sw.className = `hg-sw plate-sw plate-${r.state}`;
        const nm = document.createElement("span");
        nm.textContent = plateKeyLabel(r, opts?.counts);
        item.append(sw, nm);
        host.append(item);
    }
    return host;
}
export function plateMarksInto(group, model, toPx, nameOf) {
    const NS = "http://www.w3.org/2000/svg";
    const heldPx = (x, y, r) => { const [ax, ay] = toPx(x, y); const [bx, by] = toPx(x + r, y); return Math.hypot(bx - ax, by - ay); };
    for (const g of model.ghosts) {
        const [cx, cy] = toPx(g.at[0], g.at[1]);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(cx));
        c.setAttribute("cy", String(cy));
        c.setAttribute("r", String(markRadius(heldPx(g.at[0], g.at[1], g.r), 5)));
        c.setAttribute("class", "plate-ghost");
        c.setAttribute("data-species", g.species);
        const t = document.createElementNS(NS, "title");
        t.textContent = `${nameOf(g.species)} - ${g.year ? `last year (${g.year})` : "last year"}`;
        c.append(t);
        group.append(c);
    }
    model.plants.forEach((p, i) => {
        const [cx, cy] = toPx(p.at[0], p.at[1]);
        const rr = markRadius(heldPx(p.at[0], p.at[1], p.r), 6);
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(cy));
        dot.setAttribute("r", String(rr));
        dot.setAttribute("class", `plate-plant plate-${p.state}`);
        dot.setAttribute("data-species", p.species);
        dot.setAttribute("data-state", p.state);
        dot.setAttribute("data-idx", String(i));
        const t = document.createElementNS(NS, "title");
        t.textContent = `${nameOf(p.species)} - ${stateWord(p.state)}`;
        dot.append(t);
        group.append(dot);
        if (p.state === "ended") {
            const line = document.createElementNS(NS, "line");
            line.setAttribute("x1", String(cx - rr));
            line.setAttribute("y1", String(cy - rr));
            line.setAttribute("x2", String(cx + rr));
            line.setAttribute("y2", String(cy + rr));
            line.setAttribute("class", "plate-struck");
            group.append(line);
        }
    });
}
