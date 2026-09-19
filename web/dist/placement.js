import { openSeason as activeSeason } from "./session.js";
import { instantiate, resolveSpecies } from "./engine/compiler.js";
import { laysOutAsHills } from "./engine/guilds.js";
import { humanize, titleCase } from "./engine/labels.js";
import { accessBands as computeAccessBands, orientedToPlot, orientRect, place, plotToOriented } from "./engine/place.js";
import { shelterPredicate, shelteredByShadow } from "./engine/solar.js";
import { area as regionArea, intersectArea, parseRegion, radialRingsFromFootprint, regionPoints } from "./engine/regions.js";
import { memberSpecies, spacingRows } from "./engine/schedule.js";
import { lenM, SVG_NS } from "./dom.js";
import { app, commonName } from "./state.js";
import { plantingOnBed } from "./occupancy.js";
export function svgNumber(x) { return Math.round(x * 100) / 100; }
export const PLANT_COLORS = ["#15803d", "#b45309", "#2563eb", "#9333ea", "#dc2626", "#0891b2", "#ca8a04", "#db2777"];
export function zoneColorMap(zones) {
    const m = new Map();
    for (const z of zones)
        if (!m.has(z.species))
            m.set(z.species, PLANT_COLORS[m.size % PLANT_COLORS.length]);
    return m;
}
export function shelteredChosen(chosen, bundle, isShelter) {
    const out = new Set();
    if (!isShelter)
        return out;
    const shelters = shelterPredicate(bundle);
    for (const c of chosen) {
        if (shelteredByShadow(resolveSpecies(c.sid, c.group, bundle), shelters))
            out.add(c.sid);
    }
    return out;
}
export function planBedRegion(bed) {
    if (bed) {
        const o = bedOrientation(bed);
        if (o)
            return { shape: "rect", x: 0, y: 0, w: o.orient.eff_w, h: o.orient.eff_l };
        return bed.region;
    }
    const w = lenM("shapew"), l = lenM("shapel");
    return w != null && l != null && w > 0 && l > 0 ? { shape: "rect", x: 0, y: 0, w, h: l } : null;
}
export function bedOrientation(bed) {
    const a = bed.rotation_deg;
    if (!a || bed.region.shape !== "polygon" || bed.region.points.length !== 4)
        return null;
    const p = bed.region.points;
    const r2 = (v) => Math.round(v * 100) / 100;
    const w = r2(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]));
    const l = r2(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]));
    const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
    const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
    return { orient: orientRect(w, l, a), cx, cy, w, l };
}
export function carriedOccupancy(bed) {
    if (!bed)
        return [];
    const openSeason = activeSeason();
    const o = bedOrientation(bed);
    const out = [];
    for (const pp of (openSeason?.plantings ?? [])) {
        if (pp.carried_over !== true || pp.end_cause)
            continue;
        let r;
        try {
            r = parseRegion(pp.region);
        }
        catch {
            continue;
        }
        if (intersectArea(r, bed.region) <= 0)
            continue;
        if (!o) {
            out.push(r);
            continue;
        }
        const pts = regionPoints(r).map(([px, py]) => plotToOriented(px, py, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy));
        out.push({ shape: "polygon", points: pts });
    }
    return out;
}
export function roleOverridesOf(entry) {
    const m = new Map();
    const roles = entry && Array.isArray(entry.roles) ? entry.roles : [];
    for (const r of roles) {
        const rr = r;
        if (typeof rr.role === "string" && typeof rr.species === "string") {
            m.set(rr.role, { species: rr.species, group: typeof rr.group === "string" ? rr.group : null });
        }
    }
    return m;
}
function guildChosenSpecies(guild, site, bundle, overrides) {
    const inst = instantiate(guild, site, bundle);
    const memDensity = (sid) => {
        const mem = (guild.members ?? []);
        const m = mem.find((x) => x.species === sid);
        return typeof m?.planting_density_m2 === "number" ? m.planting_density_m2 : undefined;
    };
    const chosen = [];
    if (inst.roles.length) {
        for (const r of inst.roles) {
            const ov = overrides?.get(r.role);
            const sid = ov ? ov.species : (r.chosen ?? r.canonical);
            if (sid)
                chosen.push({ sid, group: ov ? ov.group : null, density: roleDensity(guild, r.role), role: r.role });
        }
    }
    else {
        for (const [sid, group] of memberSpecies(guild))
            chosen.push({ sid, group, density: memDensity(sid) });
    }
    return chosen;
}
function computeGuildPlacement(guild, bed, site, bundle, overrides) {
    if (site.lat == null)
        return null;
    const r003 = bundle.rules.find((x) => x.id === "R-003");
    const RING_ORDER = ["canopy", "bulb_ring", "mulch_producer", "fixer", "insectary"];
    const MOUND_ROLES = new Set(["support", "fixer"]);
    const MOUND_CAP = { support: 4, fixer: 3 };
    const isRadial = guild.ground_entity === "radial_rings";
    const isHills = laysOutAsHills(guild);
    const isShelter = guild.layout === "shelter";
    const isGrid = !isRadial && !isHills && !isShelter
        && (guild.guild_class === "culinary_bundle" || guild.guild_class === "ornamental_bundle"
            || guild.guild_class === "polyculture" || guild.guild_class === "restorative");
    const isRest = guild.guild_class === "restorative";
    const chosen = guildChosenSpecies(guild, site, bundle, overrides);
    const shelteredSet = shelteredChosen(chosen, bundle, isShelter);
    const groupBySpecies = new Map();
    for (const c of chosen)
        if (!groupBySpecies.has(c.sid))
            groupBySpecies.set(c.sid, c.group);
    const region = planBedRegion(bed);
    const plantRows = spacingRows(chosen.map((c) => [c.sid, c.group]), bundle)
        .filter((r) => r.height_cm !== null || r.spread_cm !== null);
    if (!region || plantRows.length < 2)
        return null;
    const treeR = isRadial ? (radialRingsFromFootprint(guild.footprint_min_m2 ?? 0)?.r ?? 0) : 0;
    const counts = scaledFillCounts(chosen.map((c) => ({ resolved: resolveSpecies(c.sid, c.group, bundle), density: c.density })), plantableArea(region, bedStructure(bed, guild), bed?.lane_flip ?? false), chosen.length);
    const countBySpecies = new Map();
    const ringBySpecies = new Map();
    const moundBySpecies = new Map();
    const moundCapBySpecies = new Map();
    chosen.forEach((c, i) => {
        countBySpecies.set(c.sid, counts[i]);
        if (isRadial) {
            const ri = c.role ? RING_ORDER.indexOf(c.role) : -1;
            ringBySpecies.set(c.sid, ri >= 0 ? ri : RING_ORDER.length + i);
        }
        if (isHills) {
            moundBySpecies.set(c.sid, c.role ? MOUND_ROLES.has(c.role) : false);
            if (c.role && MOUND_CAP[c.role])
                moundCapBySpecies.set(c.sid, MOUND_CAP[c.role]);
        }
    });
    const layoutKind = isRadial ? "orchard" : isHills ? "hills" : isShelter ? "shelter" : isGrid ? "grid" : "rows";
    const occupied = carriedOccupancy(bed);
    const pl = place(plantRows.map((r) => ({ id: r.species, height_cm: r.height_cm ?? 0, spread_cm: r.spread_cm ?? undefined, count: countBySpecies.get(r.species) ?? 1, ring: ringBySpecies.get(r.species), mound: moundBySpecies.get(r.species), mound_cap: moundCapBySpecies.get(r.species), sheltered: shelteredSet.has(r.species) })), region, site.lat, r003?.trigger?.threshold_cm ?? 120, layoutKind, treeR, !isRest, occupied, bedStructure(bed, guild), bed?.lane_flip ?? false);
    return { pl, plantRows, region, isRest, groupBySpecies };
}
export function guildPlacementGlimpse(guild, bed, site, bundle, overrides) {
    const computed = computeGuildPlacement(guild, bed, site, bundle, overrides);
    if (!computed)
        return null;
    const { pl, plantRows } = computed;
    const mounds = pl.mounds ?? [];
    const ringsGuide = pl.rings_guide ?? [];
    const accessBands = pl.access_bands ?? [];
    const bedOutline = regionPoints(bed.region);
    const spreadR = new Map(plantRows.filter((r) => r.spread_cm).map((r) => [r.species, r.spread_cm / 200]));
    const svg = placementSvg(pl.zones, bundle, mounds, bedOutline, ringsGuide, accessBands, spreadR);
    if (!svg)
        return null;
    const w = svg.getAttribute("width"), hgt = svg.getAttribute("height");
    if (w && hgt)
        svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    const colours = zoneColorMap(pl.zones);
    const counts = new Map();
    for (const z of pl.zones)
        counts.set(z.species, (counts.get(z.species) ?? 0) + (z.plants?.length ?? 0));
    const plants = [...counts.entries()].filter(([, n]) => n > 0)
        .map(([species, count]) => ({ species, count, colour: colours.get(species) ?? "" }));
    return { svg, plants };
}
export function placeGuildPlants(guild, bed, site, bundle, overrides) {
    const out = [];
    const computed = computeGuildPlacement(guild, bed, site, bundle, overrides);
    if (!computed)
        return out;
    const { pl, groupBySpecies } = computed;
    const o = bedOrientation(bed);
    for (const z of pl.zones) {
        for (const cell of z.plants ?? []) {
            const [x, y] = o
                ? orientedToPlot(cell.x, cell.y, o.orient.eff_w, o.orient.eff_l, o.orient.residual_deg, o.cx, o.cy)
                : [cell.x, cell.y];
            out.push({ x, y, r: cell.r, species: z.species, group: groupBySpecies.get(z.species) ?? null });
        }
    }
    return out;
}
export function guildPlantings(guild, bed, site, bundle, overrides) {
    const placed = placeGuildPlants(guild, bed, site, bundle, overrides);
    if (placed.length) {
        return placed.map((p) => {
            const half = Math.max(0.05, Math.min(p.r, 0.15));
            const region = { shape: "rect", x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 };
            return { species: p.species, ...(p.group ? { cultivar_group: p.group } : {}), region };
        });
    }
    return guildChosenSpecies(guild, site, bundle, overrides).map((c) => ({ species: c.sid, ...(c.group ? { cultivar_group: c.group } : {}), region: bed.region }));
}
export function appliedPlanDots(bundle, site) {
    const season = activeSeason();
    const entries = (Array.isArray(season?.plan) ? season.plan : []);
    const out = [];
    if (!entries.length)
        return out;
    for (const e of entries) {
        const bed = app.logSnapshot.beds.find((b) => b.name === e.area);
        if (!bed)
            continue;
        if ((season?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region)))
            continue;
        if (e.mybed === true && Array.isArray(e.plantings)) {
            for (const pl of e.plantings) {
                const cs = regionPoints(pl.region);
                if (!cs.length)
                    continue;
                out.push({ x: cs.reduce((a, p) => a + p[0], 0) / cs.length, y: cs.reduce((a, p) => a + p[1], 0) / cs.length, species: pl.species });
            }
            continue;
        }
        const guild = bundle.guilds.find((g) => g.id === e.guild);
        if (!guild || site.lat == null)
            continue;
        for (const p of placeGuildPlants(guild, bed, site, bundle, roleOverridesOf(e)))
            out.push({ x: p.x, y: p.y, species: p.species });
    }
    return out;
}
export function draftPlantings(bundle, site, season, beds) {
    const s = season !== undefined ? season : activeSeason();
    const bedList = beds ?? app.logSnapshot.beds;
    const entries = (Array.isArray(s?.plan) ? s.plan : []);
    const out = [];
    if (!entries.length)
        return out;
    for (const e of entries) {
        const bed = bedList.find((b) => b.name === e.area);
        if (!bed)
            continue;
        if ((s?.plantings ?? []).some((pl) => plantingOnBed(pl.region, bed.region)))
            continue;
        if (e.mybed === true && Array.isArray(e.plantings)) {
            for (const pl of e.plantings) {
                if (pl && typeof pl.species === "string" && pl.region) {
                    out.push({ species: pl.species, ...(pl.cultivar_group ? { cultivar_group: pl.cultivar_group } : {}), region: pl.region });
                }
            }
            continue;
        }
        const guild = bundle.guilds.find((g) => g.id === e.guild);
        if (!guild || site.lat == null)
            continue;
        for (const p of guildPlantings(guild, bed, site, bundle, roleOverridesOf(e)))
            out.push(p);
    }
    return out;
}
function guildPlantCount(resolved) {
    const poll = resolved.pollination;
    if (poll?.block_min_plants)
        return poll.block_min_plants;
    if (poll?.dioecious)
        return 2;
    if (poll?.self_incompatible)
        return poll.min_plants ?? 2;
    return 1;
}
function plantSpacingM2(resolved) {
    let s = resolved.spacing_in_row_cm;
    if (typeof s !== "number") {
        let ms = resolved.mature_spread_cm;
        if (Array.isArray(ms))
            ms = ms.length ? ms[ms.length - 1] : undefined;
        s = typeof ms === "number" ? ms : undefined;
    }
    const cm = Math.max(typeof s === "number" ? s : 30, 30);
    return (cm / 100) ** 2;
}
const FILL_DOT_BUDGET = 700;
function rawFillCount(resolved, bedArea, nSpecies, density) {
    const corpusMin = guildPlantCount(resolved);
    if (bedArea == null || bedArea <= 0)
        return corpusMin;
    if (density != null && density > 0)
        return Math.max(Math.round(density * bedArea), corpusMin);
    const sm2 = plantSpacingM2(resolved);
    if (sm2 <= 0)
        return corpusMin;
    const wholeBedCap = Math.max(1, Math.floor(bedArea / sm2));
    const share = bedArea / Math.max(1, nSpecies);
    const fit = Math.max(1, Math.floor(share / sm2));
    return Math.min(Math.max(fit, Math.min(corpusMin, wholeBedCap)), wholeBedCap);
}
export function scaledFillCounts(items, bedArea, nSpecies) {
    const raw = items.map((it) => rawFillCount(it.resolved, bedArea, nSpecies, it.density));
    const total = raw.reduce((s, n) => s + n, 0);
    if (total <= FILL_DOT_BUDGET)
        return raw;
    const k = FILL_DOT_BUDGET / total;
    return raw.map((n) => Math.max(1, Math.round(n * k)));
}
export function filledMembers(members, plantable, bundle) {
    if (plantable <= 0 || !members.length)
        return members.map((m) => ({ ...m }));
    const isStructure = (m) => resolveSpecies(m.species, m.group ?? null, bundle).entity_class === "structure";
    const plants = members.filter((m) => !isStructure(m));
    const counts = scaledFillCounts(plants.map((m) => ({ resolved: resolveSpecies(m.species, m.group ?? null, bundle) })), plantable, plants.length);
    let i = 0;
    return members.map((m) => isStructure(m)
        ? { ...m }
        : { ...m, count: Math.max(counts[i++], m.count ?? 1) });
}
export function snapCountsToLayout(members, pl, arch, bundle) {
    if (arch === "hills") {
        const placed = new Map(pl.zones.map((z) => [z.species, z.count]));
        const out = members.map((m) => ({ ...m, count: Math.max(1, placed.get(m.species) ?? (m.count ?? 1)) }));
        return out.some((m, i) => m.count !== (members[i].count ?? 1)) ? out : null;
    }
    if (arch === "rings") {
        const ringOf = new Map(pl.zones.map((z) => [z.species, z.ring?.r ?? null]));
        const out = members.map((m) => {
            const rr = ringOf.get(m.species);
            if (rr == null || rr <= 0)
                return { ...m, count: m.count ?? 1 };
            const spacing = Math.sqrt(plantSpacingM2(resolveSpecies(m.species, m.group ?? null, bundle)));
            const cap = Math.max(1, Math.floor((2 * Math.PI * rr) / Math.max(spacing, 0.05)));
            return { ...m, count: Math.min(m.count ?? 1, cap) };
        });
        return out.some((m, i) => m.count !== (members[i].count ?? 1)) ? out : null;
    }
    return null;
}
export function plantableArea(region, structure, laneFlip = false) {
    const lanes = computeAccessBands(structure, region, laneFlip);
    const laneArea = lanes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    return Math.max(0.1, regionArea(region) - laneArea);
}
export function bedStructure(bed, guild) {
    return bed?.structure ?? guild?.default_structure ?? "in_ground";
}
export function roleDensity(guild, roleId) {
    const d = (guild.roles ?? []).find((r) => r.id === roleId)?.planting_density_m2;
    return typeof d === "number" ? d : undefined;
}
let placementSvgSeq = 0;
export function placementSvg(zones, bundle, mounds = [], bedOutline = [], ringsGuide = [], accessBands = [], spreadR = new Map()) {
    const allX = [], allY = [];
    for (const q of bedOutline) {
        allX.push(q[0]);
        allY.push(q[1]);
    }
    for (const z of zones) {
        for (const q of z.polygon) {
            allX.push(q[0]);
            allY.push(q[1]);
        }
        for (const pc of z.plants) {
            allX.push(pc.x);
            allY.push(pc.y);
        }
        if (z.ring) {
            allX.push(z.ring.cx - z.ring.r, z.ring.cx + z.ring.r);
            allY.push(z.ring.cy - z.ring.r, z.ring.cy + z.ring.r);
        }
    }
    for (const m of mounds) {
        allX.push(m.cx - m.r, m.cx + m.r);
        allY.push(m.cy - m.r, m.cy + m.r);
    }
    for (const g of ringsGuide) {
        allX.push(g.cx - g.r, g.cx + g.r);
        allY.push(g.cy - g.r, g.cy + g.r);
    }
    for (const b of accessBands) {
        allX.push(b.x0, b.x1);
        allY.push(b.y0, b.y1);
    }
    if (!allX.length)
        return null;
    const px0 = Math.min(...allX), py1 = Math.max(...allY);
    const spanX = Math.max(...allX) - px0, spanY = py1 - Math.min(...allY);
    const sc = 180 / Math.max(spanX, spanY, 0.1);
    const rawX = (x) => (x - px0) * sc;
    const rawY = (y) => (py1 - y) * sc;
    const drawR = (r, fill = 0.94) => Math.min(Math.max(r * sc * fill, 2.4), 20);
    const zoneFill = (z) => (mounds.length && z.mound !== false) ? 0.82 : 0.94;
    const haloR = (z, r) => {
        if (!mounds.length || z.mound !== false)
            return 0;
        const spread = spreadR.get(z.species);
        if (!spread)
            return 0;
        const full = spread * sc;
        return full > drawR(r, zoneFill(z)) + 2 ? full : 0;
    };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const bump = (x, y, pad = 0) => {
        minX = Math.min(minX, x - pad);
        maxX = Math.max(maxX, x + pad);
        minY = Math.min(minY, y - pad);
        maxY = Math.max(maxY, y + pad);
    };
    for (const z of zones) {
        for (const q of z.polygon)
            bump(rawX(q[0]), rawY(q[1]));
        for (const pc of z.plants)
            bump(rawX(pc.x), rawY(pc.y), drawR(pc.r));
        if (z.ring && z.ring.r > 0) {
            bump(rawX(z.ring.cx), rawY(z.ring.cy), z.ring.r * sc);
        }
    }
    for (const m of mounds)
        bump(rawX(m.cx), rawY(m.cy), m.r * sc);
    for (const g of ringsGuide)
        bump(rawX(g.cx), rawY(g.cy), g.r * sc);
    for (const b of accessBands) {
        bump(rawX(b.x0), rawY(b.y0));
        bump(rawX(b.x1), rawY(b.y1));
    }
    for (const q of bedOutline)
        bump(rawX(q[0]), rawY(q[1]));
    if (!Number.isFinite(minX))
        return null;
    const M = 4;
    const px = (x) => svgNumber(M + rawX(x) - minX);
    const py = (y) => svgNumber(M + rawY(y) - minY);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "fit");
    svg.setAttribute("width", String(Math.ceil(maxX - minX) + 2 * M));
    svg.setAttribute("height", String(Math.ceil(maxY - minY) + 2 * M));
    const colours = zoneColorMap(zones);
    let guideClip = null;
    if (bedOutline.length >= 3) {
        const bed = document.createElementNS(SVG_NS, "polygon");
        const ptsAttr = bedOutline.map((q) => `${px(q[0])},${py(q[1])}`).join(" ");
        bed.setAttribute("points", ptsAttr);
        bed.setAttribute("class", "bed");
        svg.appendChild(bed);
        guideClip = `fitclip-${++placementSvgSeq}`;
        const defs = document.createElementNS(SVG_NS, "defs");
        const clip = document.createElementNS(SVG_NS, "clipPath");
        clip.setAttribute("id", guideClip);
        const cpoly = document.createElementNS(SVG_NS, "polygon");
        cpoly.setAttribute("points", ptsAttr);
        clip.appendChild(cpoly);
        defs.appendChild(clip);
        svg.appendChild(defs);
    }
    for (const b of accessBands) {
        const bx0 = M + rawX(b.x0) - minX, bx1 = M + rawX(b.x1) - minX;
        const byTop = M + rawY(b.y1) - minY, byBot = M + rawY(b.y0) - minY;
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", String(svgNumber(Math.min(bx0, bx1))));
        rect.setAttribute("y", String(svgNumber(Math.min(byTop, byBot))));
        rect.setAttribute("width", String(svgNumber(Math.abs(bx1 - bx0))));
        rect.setAttribute("height", String(svgNumber(Math.abs(byBot - byTop))));
        rect.setAttribute("class", "placelane");
        svg.appendChild(rect);
    }
    for (const g of ringsGuide) {
        const circ = document.createElementNS(SVG_NS, "circle");
        circ.setAttribute("cx", String(px(g.cx)));
        circ.setAttribute("cy", String(py(g.cy)));
        circ.setAttribute("r", String(svgNumber(g.r * sc)));
        circ.setAttribute("fill", "none");
        circ.setAttribute("stroke", "#8886");
        if (guideClip)
            circ.setAttribute("clip-path", `url(#${guideClip})`);
        svg.appendChild(circ);
    }
    zones.forEach((z) => {
        const col = colours.get(z.species);
        for (const pc of z.plants) {
            const hr = haloR(z, pc.r);
            if (!hr)
                continue;
            const h = document.createElementNS(SVG_NS, "circle");
            h.setAttribute("cx", String(px(pc.x)));
            h.setAttribute("cy", String(py(pc.y)));
            h.setAttribute("r", String(svgNumber(hr)));
            h.setAttribute("fill", "none");
            h.setAttribute("stroke", col);
            h.setAttribute("stroke-opacity", "0.42");
            h.setAttribute("stroke-dasharray", "3 3");
            h.setAttribute("class", "sprawl");
            if (guideClip)
                h.setAttribute("clip-path", `url(#${guideClip})`);
            svg.appendChild(h);
        }
    });
    for (const m of mounds) {
        const circ = document.createElementNS(SVG_NS, "circle");
        circ.setAttribute("cx", String(px(m.cx)));
        circ.setAttribute("cy", String(py(m.cy)));
        circ.setAttribute("r", String(svgNumber(m.r * sc)));
        circ.setAttribute("fill", "#a1662f22");
        circ.setAttribute("stroke", "#a1662f66");
        svg.appendChild(circ);
    }
    zones.forEach((z) => {
        if (z.ring) {
            if (z.ring.r > 0) {
                const circ = document.createElementNS(SVG_NS, "circle");
                circ.setAttribute("cx", String(px(z.ring.cx)));
                circ.setAttribute("cy", String(py(z.ring.cy)));
                circ.setAttribute("r", String(svgNumber(z.ring.r * sc)));
                circ.setAttribute("fill", "none");
                circ.setAttribute("stroke", `${colours.get(z.species)}66`);
                svg.appendChild(circ);
            }
            return;
        }
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", z.polygon.map((q) => `${px(q[0])},${py(q[1])}`).join(" "));
        poly.setAttribute("fill", `${colours.get(z.species)}14`);
        poly.setAttribute("stroke", "#8884");
        svg.appendChild(poly);
    });
    zones.forEach((z) => {
        const col = colours.get(z.species);
        const onMound = mounds.length > 0 && z.mound !== false;
        for (const pc of z.plants) {
            const c = document.createElementNS(SVG_NS, "circle");
            c.setAttribute("cx", String(px(pc.x)));
            c.setAttribute("cy", String(py(pc.y)));
            c.setAttribute("r", String(svgNumber(drawR(pc.r, zoneFill(z)))));
            c.setAttribute("fill", col);
            c.setAttribute("fill-opacity", "0.55");
            c.setAttribute("stroke", onMound ? "var(--surface)" : col);
            if (onMound)
                c.setAttribute("stroke-width", "1.25");
            const t = document.createElementNS(SVG_NS, "title");
            t.textContent = `${commonName(bundle, z.species)} - 1 of ${z.count}`;
            c.appendChild(t);
            svg.appendChild(c);
        }
    });
    return svg;
}
const CATEGORY_LABEL = {
    fruiting_vegetable: "Fruiting vegetables",
    herb: "Herbs",
    fruit: "Fruit & berries",
    salad_green: "Salad & greens",
    root: "Roots & tubers",
    bean_or_pea: "Beans & peas",
    cover_crop: "Cover crops & soil builders",
    allium: "Onions & garlic",
    flower: "Flowers",
};
export const categoryLabel = (slug) => CATEGORY_LABEL[slug] ?? (slug ? titleCase(humanize(slug)) : "Other plants");
