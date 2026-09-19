import { scrollerFor, seat } from "./seat.js";
import { openSeason as activeSeason, seasonId } from "./session.js";
import { fromLocal, metresPerPixel, toLocal } from "./engine/geo.js";
import { humanize } from "./engine/labels.js";
import { area as regionArea, intersectArea, isSimplePolygon, minReachSpanM, parseRegion, polygonArea, regionPoints } from "./engine/regions.js";
import { PATH_M, accessBandPolygons, plantableStripPolygons } from "./engine/place.js";
import { copy } from "./copy.js";
import { toast as floatToast } from "./notices.js";
import { plantedLine } from "./diary.js";
import { addPlanting, getPlot, listPlots, moveGarden, placeBed, plotIdFor, putPlot, removeBed, setPlotAnchorOnce } from "./storage.js";
import { fmtArea, fmtLen, lenToM, mToInput, unitSystem } from "./units.js";
import { bedHasSections, moveBedPlantings, plantingOnBed, sectionParentOf } from "./plan.js";
import { countRung } from "./analytics.js";
import { app, defaultPlotId } from "./state.js";
import { drawTiles } from "./groundmap/imagery.js";
import { colorAssigner } from "./groundmap/palette.js";
import { coastFrames, pointInPolygon, distToPolygon, rectCorners, rotPt } from "./groundmap/geometry.js";
import { TROUGH_SEG, lLocalPts, recogniseL, recogniseTrough, recogniseU, troughLocalPts, uLocalPts, unrotatePts } from "./groundmap/presets.js";
import { bedState } from "./bedstate.js";
import { buzz } from "./haptics.js";
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW = 440;
const ZOOM_MIN = 17, ZOOM_MAX = 23;
const FIT_FRAC = 0.62;
const ARRIVE_FRAC = 0.78;
const LOCATE_ZOOM = 18;
const BED_TAP_SLOP_PX = 16;
const $ = (id) => document.getElementById(id);
export function initGroundMap(db, plotId, latlon, onBedsChanged, onPlotSwitched) {
    let zoom = 19;
    let viewH = VIEW;
    let cx = 0, cy = 0;
    let lastFitPlotId = null;
    let lastFitHadBeds = false;
    let tracePts = [];
    let mode = "rect";
    let reachSeenSession = false;
    let containerDismissed = false;
    let prevStructure = "in_ground";
    let lastPlot = null;
    let lastPlotId = null;
    let lastPlotAt = 0;
    const invalidatePlot = () => { lastPlotAt = 0; };
    let prevDotKeys = null;
    let celebration = null;
    let pending = null;
    let proposalRect = null;
    let proposalTaken = false;
    let pendingAngle = 0;
    let notice = null;
    let keyOpen = false;
    let anchorLat = null;
    let anchorLL = null;
    let anchorBeds = 0;
    const locating = () => !!document.getElementById("step-where")?.open;
    const MOVE_LABEL = "Move garden here";
    let moveArmed = false;
    let moveArmTimer = 0;
    const layerState = { areas: true, plantings: true, labels: true, tint: "season" };
    try {
        Object.assign(layerState, JSON.parse(localStorage.getItem("gg-maplayers") ?? "{}"));
        if (!["season", "sun", "soil", "rotation"].includes(layerState.tint))
            layerState.tint = "season";
    }
    catch { }
    const TINT_WORDS = {
        season: "This season · sage = planted, cream = open ground",
        sun: "Sun · terracotta = full sun, grey = part shade, pale = not stated",
        soil: "Soil · sage = a soil record covers this ground, pale = not recorded",
        rotation: "Rotation · terracotta = held a crop within a season, sage = rested 2+ seasons, pale = no history",
    };
    let look = "illustrated";
    try {
        if (localStorage.getItem("gg-maplook") === "photo")
            look = "photo";
    }
    catch { }
    let redoPts = [];
    let redoPending = null;
    let lastAct = null;
    const svg = $("mapsvg");
    const mkLayer = (name, parent) => {
        const g = document.createElementNS(SVG_NS, "g");
        g.dataset.layer = name;
        parent.appendChild(g);
        return g;
    };
    const worldBack = mkLayer("worldback", svg);
    const washFixed = mkLayer("washfixed", svg);
    const worldFront = mkLayer("worldfront", svg);
    const setWorldTransform = (t) => {
        for (const g of [worldBack, worldFront]) {
            if (t)
                g.setAttribute("transform", t);
            else
                g.removeAttribute("transform");
        }
    };
    const L = {
        tiles: mkLayer("tiles", worldBack), wash: mkLayer("wash", washFixed), grid: mkLayer("grid", worldFront),
        beds: mkLayer("beds", worldFront), dots: mkLayer("dots", worldFront), edit: mkLayer("edit", worldFront),
        chrome: mkLayer("chrome", worldFront), fx: mkLayer("fx", svg),
    };
    {
        const defs = document.createElementNS(SVG_NS, "defs");
        defs.innerHTML =
            '<pattern id="tuftpat" width="52" height="52" patternUnits="userSpaceOnUse">' +
                '<path d="M10 14 q2 -6 4 0 M13 14 q2 -6 4 0" stroke="var(--ill-tuft)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
                '<path d="M36 40 q2 -6 4 0 M39 40 q2 -6 4 0" stroke="var(--ill-tuft)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
                '<circle cx="44" cy="12" r="1.1" fill="var(--ill-tuft)"/><circle cx="20" cy="34" r="1.1" fill="var(--ill-tuft)"/></pattern>' +
                '<pattern id="grainpat" width="14" height="14" patternUnits="userSpaceOnUse">' +
                '<circle cx="3" cy="4" r=".9" fill="var(--ill-soil-edge)" opacity=".35"/>' +
                '<circle cx="10" cy="10" r=".9" fill="var(--ill-soil-edge)" opacity=".28"/></pattern>';
        svg.insertBefore(defs, svg.firstChild);
    }
    let msgTimer = 0;
    const toast = (t, ms = 2500) => {
        const h = $("maphint");
        if (h.textContent === t && !h.classList.contains("faded"))
            return;
        h.textContent = t;
        h.classList.remove("faded");
        clearTimeout(msgTimer);
        msgTimer = window.setTimeout(() => h.classList.add("faded"), ms);
    };
    let noticeDismissed = false;
    const note = (guidance) => {
        const n = $("mapnotices");
        const show = !!guidance && !noticeDismissed;
        if (show && n.dataset.sig !== guidance) {
            n.dataset.sig = guidance;
            $("mapnoticestext").textContent = guidance;
        }
        n.hidden = !show;
    };
    const reachNote = (reach) => {
        const chip = $("mapreach");
        const show = !!reach && !reachSeenSession;
        if (show && chip.dataset.sig !== reach) {
            chip.dataset.sig = reach;
            $("mapreachtext").textContent = reach;
        }
        chip.hidden = !show;
    };
    const retireReach = () => { if (!$("mapreach").hidden)
        reachSeenSession = true; };
    const containerChip = (msg) => {
        const chip = $("mapcontainer");
        const show = !!msg && !containerDismissed;
        if (show && chip.dataset.sig !== msg) {
            chip.dataset.sig = msg;
            $("mapcontainertext").textContent = msg;
        }
        chip.hidden = !show;
    };
    const structBaseLabels = new Map(Array.from(($("bedstructure")).options).map((o) => [o.value, o.textContent ?? ""]));
    const applyStructureGate = () => {
        const sel = $("bedstructure");
        const name = ($("areaname")).value.trim();
        const gate = name ? app.bedStructureBlockers?.(name) ?? null : null;
        const blocked = new Set(gate?.blocked ?? []);
        for (const opt of Array.from(sel.options)) {
            const base = structBaseLabels.get(opt.value) ?? opt.textContent ?? "";
            const off = blocked.has(opt.value) && opt.value !== sel.value;
            opt.disabled = off;
            opt.textContent = off ? `${base} - not for these plants` : base;
            if (off)
                opt.title = gate?.reason(opt.value) ?? "";
            else
                opt.removeAttribute("title");
        }
        const why = $("bedstructwhy");
        const reasons = [...new Set([...blocked]
                .filter((b) => b !== sel.value)
                .map((b) => gate?.reason(b) ?? "")
                .filter((t) => t.trim()))];
        why.textContent = reasons.join(" ");
        why.hidden = reasons.length === 0;
    };
    const CM_PER_IN = 2.54;
    const isContainerSize = () => ($("bedstructure")).value === "container";
    const cmInToM = (v) => (unitSystem() === "imperial" ? (v * CM_PER_IN) / 100 : v / 100);
    const mToCmIn = (m) => +(unitSystem() === "imperial" ? (m * 100) / CM_PER_IN : m * 100).toFixed(0);
    const sizeToM = (v) => (isContainerSize() ? cmInToM(v) : lenToM(v));
    const mToSize = (m) => (isContainerSize() ? mToCmIn(m) : mToInput(m));
    const sizeUnitLabel = () => isContainerSize()
        ? (unitSystem() === "imperial" ? "in" : "cm")
        : (unitSystem() === "imperial" ? "ft" : "m");
    const refreshSizeUnitDisplay = () => {
        const lbl = sizeUnitLabel();
        document.querySelectorAll("#dimsrect .ulen, #dimscircle .ulen, #dimsl .ulen, #dimsu .ulen, #dimstrough .ulen")
            .forEach((s) => { s.textContent = lbl; });
        for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
            $(id).step = isContainerSize() ? "1" : "0.1";
        }
    };
    const dimNum = (id) => {
        const v = parseFloat($(id).value);
        return Number.isFinite(v) && v > 0 ? sizeToM(v) : null;
    };
    const freeGround = (p) => {
        if (mode !== "rect")
            return p;
        const d = rectDims();
        if (!d)
            return p;
        const hw = d[0] / 2, hh = d[1] / 2;
        let cx = p.cx;
        for (let i = 0; i < 12; i++) {
            const hit = app.logSnapshot.beds.find((b) => {
                const pts = regionPoints(b.region);
                const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
                return cx - hw < Math.max(...xs) && cx + hw > Math.min(...xs) && p.cy - hh < Math.max(...ys) && p.cy + hh > Math.min(...ys);
            });
            if (!hit)
                break;
            cx = snap(Math.max(...regionPoints(hit.region).map((q) => q[0])) + PATH_M + hw);
        }
        return { cx, cy: p.cy };
    };
    const rectDims = () => {
        const w = dimNum("shapew"), l = dimNum("shapel");
        return w && l ? [w, l] : null;
    };
    const circleR = () => {
        const d = dimNum("shaped");
        return d ? d / 2 : null;
    };
    const lDims = () => {
        const w = dimNum("lw"), l = dimNum("ll"), nw = dimNum("lnw"), nl = dimNum("lnl");
        if (!w || !l || !nw || !nl)
            return null;
        return { w, l, nw: Math.min(nw, w - 0.1), nl: Math.min(nl, l - 0.1) };
    };
    const troughDims = () => {
        const w = dimNum("tw"), l0 = dimNum("tl");
        return w && l0 ? { w, l: Math.max(l0, w) } : null;
    };
    const uDims = () => {
        const w = dimNum("uw"), l = dimNum("ul"), nw = dimNum("unw"), nl = dimNum("unl");
        if (!w || !l || !nw || !nl)
            return null;
        return { w, l, nw: Math.min(nw, w - 0.2), nl: Math.min(nl, l - 0.1) };
    };
    const presetWorldPts = () => {
        if (!pending)
            return null;
        let local = null;
        if (mode === "lbed") {
            const d = lDims();
            if (d)
                local = lLocalPts(d.w, d.l, d.nw, d.nl);
        }
        else if (mode === "ubed") {
            const d = uDims();
            if (d)
                local = uLocalPts(d.w, d.l, d.nw, d.nl);
        }
        else if (mode === "trough") {
            const d = troughDims();
            if (d)
                local = troughLocalPts(d.w, d.l);
        }
        if (!local)
            return null;
        return local.map(([x, y]) => {
            const r = rotPt(x, y, pendingAngle);
            return [pending.cx + r[0], pending.cy + r[1]];
        });
    };
    const pendingBBox = () => {
        if (mode === "rect")
            return rectDims();
        if (mode === "lbed") {
            const d = lDims();
            return d ? [d.w, d.l] : null;
        }
        if (mode === "ubed") {
            const d = uDims();
            return d ? [d.w, d.l] : null;
        }
        if (mode === "trough") {
            const d = troughDims();
            return d ? [d.w, d.l] : null;
        }
        return null;
    };
    const el = (tag, attrs) => {
        const e = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs))
            e.setAttribute(k, String(v));
        return e;
    };
    const declutterBedLabels = (labels) => {
        if (!labels.length)
            return;
        const gap = 2;
        const placed = [];
        const hits = (b, p) => b.x < p.x + p.w + gap && b.x + b.width + gap > p.x && b.y < p.y + p.h + gap && b.y + b.height + gap > p.y;
        try {
            for (const lab of [...labels].sort((a, b) => a.getBBox().y - b.getBBox().y)) {
                let b = lab.getBBox();
                let y = parseFloat(lab.getAttribute("y") ?? "0");
                for (let i = 0; i < 24 && placed.some((p) => hits(b, p)); i++) {
                    y += b.height + gap;
                    lab.setAttribute("y", String(y));
                    b = lab.getBBox();
                }
                placed.push({ x: b.x, y: b.y, w: b.width, h: b.height });
                const bg = el("rect", { class: "bedlabelbg", x: b.x - 3, y: b.y - 1, width: b.width + 6, height: b.height + 2, rx: 3 });
                lab.parentNode?.insertBefore(bg, lab);
            }
        }
        catch { }
    };
    const pendingCorners = (w, l) => rectCorners(pending.cx, pending.cy, w, l, pendingAngle);
    const rotHandlePos = (l, mpp) => {
        const r = rotPt(0, l / 2 + 26 * mpp, pendingAngle);
        return [pending.cx + r[0], pending.cy + r[1]];
    };
    const setDim = (id, metres) => {
        $(id).value = String(mToSize(metres));
    };
    const closeBedPopover = () => {
        const bp = document.getElementById("bedpop");
        if (bp && !bp.hidden) {
            bp.hidden = true;
            bp.replaceChildren();
        }
    };
    const openBedPopover = (bed) => {
        const bp = document.getElementById("bedpop");
        if (!bp)
            return;
        bp.replaceChildren();
        const h = document.createElement("h3");
        h.textContent = bed.name;
        bp.appendChild(h);
        const pts = regionPoints(bed.region);
        const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
        const l = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
        const openSeason = activeSeason();
        const on = (openSeason?.plantings ?? []).filter((q) => {
            try {
                return plantingOnBed(q.region, bed.region);
            }
            catch {
                return false;
            }
        });
        const sown = on.map((q) => q.sown).filter((d) => !!d).sort()[0];
        const meta = document.createElement("p");
        meta.className = "bp-meta";
        meta.textContent = [
            `${fmtLen(w)} × ${fmtLen(l)}`,
            humanize(bed.structure ?? "in_ground"),
            bed.sun === "full" ? "full sun" : bed.sun === "part_shade" ? "part shade" : "sun not stated",
            ...(sown ? [`planted ${sown.slice(5).replace("-", "/")}`] : []),
        ].join(" · ");
        bp.appendChild(meta);
        const species = [...new Set(on.map((q) => q.species))];
        if (species.length) {
            const chips = document.createElement("p");
            chips.className = "bp-chips";
            for (const s of species) {
                const c = document.createElement("span");
                c.className = "bp-chip";
                c.textContent = app.speciesName?.(s) ?? humanize(s);
                chips.appendChild(c);
            }
            bp.appendChild(chips);
        }
        const acts = document.createElement("div");
        acts.className = "bp-acts";
        const planBtn = document.createElement("button");
        planBtn.type = "button";
        planBtn.className = "primary";
        planBtn.textContent = "Open in Plan";
        planBtn.addEventListener("click", () => {
            closeBedPopover();
            const cand = document.getElementById("candbed");
            if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
                const step = document.getElementById("step-plan");
                if (step)
                    step.open = true;
                if (cand.value !== bed.name) {
                    cand.value = bed.name;
                    cand.dispatchEvent(new Event("change"));
                }
            }
        });
        const logBtn = document.createElement("button");
        logBtn.type = "button";
        logBtn.className = "bp-link";
        logBtn.textContent = "Log here →";
        logBtn.addEventListener("click", () => { closeBedPopover(); app.openLogBed?.(bed.name, null); });
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "bp-link";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => { closeBedPopover(); startEditBed(bed); });
        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "bp-link";
        dupBtn.textContent = "Duplicate";
        dupBtn.addEventListener("click", () => { closeBedPopover(); startDuplicateBed(bed); });
        acts.append(planBtn, logBtn, editBtn, dupBtn);
        bp.appendChild(acts);
        bp.hidden = false;
        planBtn.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape")
        closeBedPopover(); });
    const startEditBed = (bed) => {
        const region = bed.region;
        const pts = regionPoints(region);
        const midx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const midy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        ($("bedstructure")).value = bed.structure ?? "in_ground";
        prevStructure = ($("bedstructure")).value;
        ($("bedlanes")).value = bed.lane_flip ? "flip" : "";
        refreshSizeUnitDisplay();
        if (region.shape === "rect") {
            setMode("rect");
            setDim("shapew", region.w);
            setDim("shapel", region.h);
            pending = { cx: midx, cy: midy };
        }
        else if (bed.rotation_deg && pts.length === 4) {
            setMode("rect");
            setDim("shapew", Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]));
            setDim("shapel", Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]));
            pending = { cx: midx, cy: midy };
            pendingAngle = bed.rotation_deg;
        }
        else {
            const ang = bed.rotation_deg ?? 0;
            const up = ang ? unrotatePts(pts, ang) : pts;
            const lrec = recogniseL(up);
            const urec = lrec ? null : recogniseU(up);
            const trec = lrec || urec ? null : recogniseTrough(up);
            const radii = pts.map((p) => Math.hypot(p[0] - midx, p[1] - midy));
            const mean = radii.reduce((a, r) => a + r, 0) / radii.length;
            if (lrec) {
                setMode("lbed");
                setDim("lw", lrec.w);
                setDim("ll", lrec.l);
                setDim("lnw", lrec.nw);
                setDim("lnl", lrec.nl);
                pendingAngle = ang;
                const L0 = rotPt(-lrec.w / 2, lrec.l / 2, ang);
                pending = { cx: pts[0][0] - L0[0], cy: pts[0][1] - L0[1] };
            }
            else if (urec) {
                setMode("ubed");
                setDim("uw", urec.w);
                setDim("ul", urec.l);
                setDim("unw", urec.nw);
                setDim("unl", urec.nl);
                pendingAngle = ang;
                const U0 = rotPt(-urec.w / 2, urec.l / 2, ang);
                pending = { cx: pts[0][0] - U0[0], cy: pts[0][1] - U0[1] };
            }
            else if (trec) {
                setMode("trough");
                setDim("tw", trec.w);
                setDim("tl", trec.l);
                pendingAngle = ang;
                const t0 = troughLocalPts(trec.w, trec.l)[0];
                const T0 = rotPt(t0[0], t0[1], ang);
                pending = { cx: pts[0][0] - T0[0], cy: pts[0][1] - T0[1] };
            }
            else if (pts.length === 32 && radii.every((r) => Math.abs(r - mean) < mean * 0.03)) {
                setMode("circle");
                setDim("shaped", 2 * mean);
                pending = { cx: midx, cy: midy };
            }
            else {
                setMode("corner");
                tracePts = pts.map((p) => [p[0], p[1]]);
            }
        }
        ($("areaname")).value = bed.name;
        ($("bedsun")).value = bed.sun ?? "";
        {
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            if (anchorLat != null) {
                const bw = Math.max(0.5, Math.max(...xs) - Math.min(...xs));
                const bh = Math.max(0.5, Math.max(...ys) - Math.min(...ys));
                zoom = fitZoom(anchorLat, bw, bh, 0.45);
            }
        }
        notice = `editing "${bed.name}" - adjust it, then save (same name replaces the shape; what grew here stays put).`;
        const cand = document.getElementById("candbed");
        if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
            const wide = matchMedia("(min-width: 900px)").matches;
            const step = document.getElementById(wide ? "step-plan" : "sec-ground");
            if (step)
                step.open = true;
            if (cand.value !== bed.name) {
                cand.value = bed.name;
                cand.dispatchEvent(new Event("change"));
            }
        }
        void redraw();
    };
    const startDuplicateBed = (bed) => {
        startEditBed(bed);
        ($("areaname")).value = "";
        const pts = regionPoints(bed.region);
        const xs = pts.map((p) => p[0]);
        const dx = Math.max(...xs) - Math.min(...xs) + PATH_M;
        if (pending)
            pending = { cx: pending.cx + dx, cy: pending.cy };
        else if (tracePts.length)
            tracePts = tracePts.map(([x, y]) => [x + dx, y]);
        cx += dx / 2;
        notice = `a copy of "${bed.name}" - drag it into place (a ${fmtLen(PATH_M)} path snaps in), then name it and save.`;
        void redraw();
    };
    const bedAt = (xm, ym, tolM = 0) => {
        for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) {
            if (pointInPolygon(xm, ym, regionPoints(app.logSnapshot.beds[i].region)))
                return app.logSnapshot.beds[i];
        }
        if (tolM > 0) {
            let best = null, bestD = tolM;
            for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) {
                const d = distToPolygon(xm, ym, regionPoints(app.logSnapshot.beds[i].region));
                if (d < bestD) {
                    bestD = d;
                    best = app.logSnapshot.beds[i];
                }
            }
            return best;
        }
        return null;
    };
    let drawing = false, drawQueued = false;
    const redraw = async () => {
        if (drawing) {
            drawQueued = true;
            return;
        }
        drawing = true;
        try {
            await redrawCore();
        }
        finally {
            drawing = false;
            if (drawQueued) {
                drawQueued = false;
                void redraw();
            }
        }
    };
    const redrawCore = async () => {
        const pid = plotId();
        const reuse = lastPlot !== null && lastPlotId === pid
            && (gesture === "pan" || gesture === "pinch" || Date.now() - lastPlotAt < 120);
        const plot = reuse ? lastPlot : (await getPlot(db, pid)) ?? null;
        if (!reuse) {
            lastPlot = plot;
            lastPlotId = pid;
            lastPlotAt = Date.now();
        }
        let anchor = plot?.anchor ?? null;
        const ll = latlon();
        if (!anchor && ll) {
            anchor = { lat: ll.lat, lon: ll.lon };
            zoom = LOCATE_ZOOM;
            const typedAddr = document.getElementById("addr")?.value.trim() || undefined;
            void setPlotAnchorOnce(db, plotId(), ll.lat, ll.lon, typedAddr);
        }
        anchorLat = anchor?.lat ?? 45;
        anchorLL = anchor ?? null;
        anchorBeds = plot?.beds.length ?? 0;
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
            cx = 0;
            cy = 0;
        }
        for (const g of [L.wash, L.grid, L.beds, L.dots, L.edit, L.chrome])
            g.replaceChildren();
        if (gestTx !== 0 || gestTy !== 0 || gestScale !== 1)
            applyWorldTransform();
        else
            setWorldTransform(null);
        const viewport = $("mapviewport");
        const gridMode = !anchor;
        const frame = anchor ?? { lat: 45, lon: 0 };
        viewport.classList.remove("empty");
        viewport.classList.toggle("gridmode", gridMode);
        viewport.classList.toggle("deepzoom", zoom >= 22.4);
        {
            const btn = $("reanchor");
            if (ll && !gridMode) {
                const [dx, dy] = toLocal(frame, ll.lat, ll.lon);
                btn.hidden = Math.hypot(dx, dy) < 25;
            }
            else
                btn.hidden = true;
            if (btn.hidden) {
                moveArmed = false;
                if (moveArmTimer) {
                    clearTimeout(moveArmTimer);
                    moveArmTimer = 0;
                }
                btn.textContent = MOVE_LABEL;
            }
            else if (!moveArmed)
                btn.textContent = MOVE_LABEL;
        }
        {
            const bb = svg.getBoundingClientRect();
            if (bb.width > 0 && bb.height > 0)
                viewH = Math.max(80, Math.round(VIEW * (bb.height / bb.width)));
            svg.setAttribute("viewBox", `0 0 ${VIEW} ${viewH}`);
        }
        if (lastFitPlotId !== plotId() || (!lastFitHadBeds && (plot?.beds?.length ?? 0) > 0)) {
            const bedPts = (plot?.beds ?? []).flatMap((bed) => regionPoints(bed.region));
            if (bedPts.length) {
                const xs = bedPts.map((p) => p[0]), ys = bedPts.map((p) => p[1]);
                const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
                cx = (minX + maxX) / 2;
                cy = (minY + maxY) / 2;
                const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
                zoom = fitZoom(frame.lat, w, h, ARRIVE_FRAC);
            }
            else {
                cx = 0;
                cy = 0;
            }
            lastFitPlotId = plotId();
            lastFitHadBeds = bedPts.length > 0;
        }
        const mpp = metresPerPixel(frame.lat, zoom);
        const spanX = VIEW * mpp, spanY = viewH * mpp;
        const span = Math.max(spanX, spanY);
        const toPx = (xm, ym) => [VIEW / 2 + (xm - cx) / mpp, viewH / 2 - (ym - cy) / mpp];
        const pxPerUnit = Math.max(0.1, svg.getBoundingClientRect().width / VIEW);
        const pxPerMetre = pxPerUnit / mpp;
        const plantDetailVisible = pxPerMetre >= 14;
        const dimLabelFont = (shapeWMetres) => {
            const onScreenW = (shapeWMetres / mpp) * pxPerUnit;
            if (onScreenW < 44)
                return null;
            const fsPx = Math.max(9, Math.min(13, onScreenW * 0.16));
            return Math.round((fsPx / pxPerUnit) * 10) / 10;
        };
        if (celebration) {
            const cp = regionPoints(celebration.region);
            celebration.poly.setAttribute("points", cp.map(([x, y]) => toPx(x, y).join(",")).join(" "));
            const cc = cp.reduce((a, q) => [a[0] + q[0] / cp.length, a[1] + q[1] / cp.length], [0, 0]);
            const [cvx, cvy] = toPx(cc[0], cc[1]);
            for (const leaf of celebration.leaves) {
                leaf.setAttribute("cx", String(cvx));
                leaf.setAttribute("cy", String(cvy));
            }
        }
        const working = !!document.querySelector("#sec-ground[open], #step-plan[open], #step-mybed[open], #sec-addplant[open]");
        const illustrated = look === "illustrated";
        viewport.classList.toggle("illustrated", illustrated);
        viewport.classList.toggle("tracing", illustrated && working);
        if (gridMode) {
            L.tiles.replaceChildren();
            $("mapattrib").textContent = locating()
                ? "type your address below - the satellite view arrives with it, and your pin drops here"
                : "your ground - the satellite view arrives with your address";
        }
        else {
            const at = $("mapattrib");
            if (at.textContent.includes("satellite view arrives"))
                at.textContent = "";
            drawTiles({
                svg: L.tiles, anchor: frame, cx, cy, span, zoom, mpp, toPx,
                attrib: at, requestRedraw: () => void redraw(),
            });
        }
        if (illustrated) {
            L.wash.appendChild(el("rect", { class: "illwash", x: 0, y: 0, width: VIEW, height: viewH }));
            L.wash.appendChild(el("rect", { class: "illtufts", x: 0, y: 0, width: VIEW, height: viewH, fill: "url(#tuftpat)" }));
        }
        const step = span > 120 ? 10 : 5;
        const g0x = Math.floor((cx - spanX / 2) / step) * step;
        const g0y = Math.floor((cy - spanY / 2) / step) * step;
        for (let m = 0; m <= spanX + step; m += step) {
            const [vx] = toPx(g0x + m, 0);
            L.grid.appendChild(el("line", { class: "grid", x1: vx, y1: 0, x2: vx, y2: viewH }));
        }
        for (let m = 0; m <= spanY + step; m += step) {
            const [, vy] = toPx(0, g0y + m);
            L.grid.appendChild(el("line", { class: "grid", x1: 0, y1: vy, x2: VIEW, y2: vy }));
        }
        const shaping = pending != null || tracePts.length > 0 || gesture === "draw";
        if (shaping) {
            const fine = [0.1, 1].find((s) => s < step && s / mpp >= 7);
            if (fine) {
                const f0x = Math.floor((cx - spanX / 2) / fine) * fine;
                const f0y = Math.floor((cy - spanY / 2) / fine) * fine;
                for (let m = 0; m <= spanX + fine; m += fine) {
                    const [vx] = toPx(f0x + m, 0);
                    L.grid.appendChild(el("line", { class: "grid fine", x1: vx, y1: 0, x2: vx, y2: viewH }));
                }
                for (let m = 0; m <= spanY + fine; m += fine) {
                    const [, vy] = toPx(0, f0y + m);
                    L.grid.appendChild(el("line", { class: "grid fine", x1: 0, y1: vy, x2: VIEW, y2: vy }));
                }
            }
        }
        if (locating() && ll && !gridMode && anchorBeds === 0) {
            const [px, py] = toPx(...toLocal(frame, ll.lat, ll.lon));
            const pin = el("g", { class: "locpin" });
            pin.appendChild(el("path", { class: "locpin-body",
                d: `M ${px} ${py} c -7 -14 -12 -18 -12 -26 a 12 12 0 1 1 24 0 c 0 8 -5 12 -12 26 z` }));
            pin.appendChild(el("circle", { class: "locpin-eye", cx: px, cy: py - 26, r: 4.5 }));
            L.chrome.appendChild(pin);
        }
        const openSeason = activeSeason();
        if (layerState.areas) {
            const planFor = new Map();
            for (const e of (Array.isArray(openSeason?.plan) ? openSeason.plan : [])) {
                if (typeof e.area === "string" && typeof e.guild === "string")
                    planFor.set(e.area, e.guild);
            }
            const labelEls = [];
            const allBeds = plot?.beds ?? [];
            const soilRecorded = (bed) => (app.soilObservations ?? []).some((rec) => {
                if (rec.plot !== app.currentPlotId)
                    return false;
                if (!rec.region)
                    return true;
                try {
                    return intersectArea(parseRegion(rec.region), bed.region) > 0;
                }
                catch {
                    return false;
                }
            });
            const tintClass = (bed) => {
                switch (layerState.tint) {
                    case "sun": return bed.sun === "full" ? "t-sun-full" : bed.sun === "part_shade" ? "t-sun-part" : "t-unknown";
                    case "soil": return soilRecorded(bed) ? "t-soil-yes" : "t-unknown";
                    case "rotation": {
                        const y = app.bedRotationSeasons?.(bed.region) ?? null;
                        return y == null ? "t-unknown" : y <= 1 ? "t-rot-recent" : "t-rot-rested";
                    }
                    default: {
                        const planted = !!bed.planted || (openSeason?.plantings ?? []).some((q) => {
                            try {
                                return plantingOnBed(q.region, bed.region);
                            }
                            catch {
                                return false;
                            }
                        });
                        return planted ? "t-season-planted" : "t-season-open";
                    }
                }
            };
            const editingName = (($("areaname")).value ?? "").trim();
            const shapeInProgress = pending != null || tracePts.length > 0;
            for (const bed of plot?.beds ?? []) {
                if (shapeInProgress && editingName && bed.name === editingName)
                    continue;
                const cs = regionPoints(bed.region);
                const ptsAttr = cs.map(([x, y]) => toPx(x, y).join(",")).join(" ");
                L.beds.appendChild(el("polygon", { class: `savedbed ${tintClass(bed)}`, points: ptsAttr }));
                if (illustrated)
                    L.beds.appendChild(el("polygon", { points: ptsAttr, fill: "url(#grainpat)" }));
                const plannedTeam = planFor.get(bed.name);
                const moundTeam = plannedTeam ? (app.guildIsHills?.(plannedTeam) ?? false) : false;
                if (!moundTeam) {
                    for (const poly of accessBandPolygons({ region: bed.region, rotation_deg: bed.rotation_deg, structure: bed.structure ?? "in_ground", lane_flip: bed.lane_flip })) {
                        const bp = poly.map(([x, y]) => toPx(x, y).join(",")).join(" ");
                        L.beds.appendChild(el("polygon", { class: "bedlane", points: bp }));
                    }
                }
                if (!layerState.labels)
                    continue;
                const midx = cs.reduce((a, p) => a + p[0], 0) / cs.length;
                const [tx] = toPx(midx, 0);
                const planned = planFor.get(bed.name);
                const isSection = sectionParentOf(bed, allBeds) !== null;
                const isContainer = !isSection && bedHasSections(bed.name, allBeds);
                const base = isContainer ? `${bed.name} (sections)` : bed.name;
                let label;
                const bedWUnits = Math.max(...cs.map(([x, y]) => toPx(x, y)[0])) - Math.min(...cs.map(([x, y]) => toPx(x, y)[0]));
                const fsPx = Math.max(9, Math.min(13, bedWUnits * pxPerUnit * 0.2));
                const fsUnits = Math.round((fsPx / pxPerUnit) * 10) / 10;
                if (isSection) {
                    const midy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
                    const [, cy] = toPx(midx, midy);
                    label = el("text", { class: "bedlabel", x: tx, y: cy, "dominant-baseline": "central" });
                }
                else {
                    const pys = cs.map(([x, y]) => toPx(x, y)[1]);
                    label = el("text", { class: "bedlabel", x: tx, y: Math.min(...pys) - 6 });
                }
                label.setAttribute("font-size", String(fsUnits));
                const full = planned && !isContainer ? `${base} · ${humanize(planned)} planned` : base;
                label.textContent = full.length * fsUnits * 0.55 > bedWUnits * 1.25 ? base : full;
                L.beds.appendChild(label);
                labelEls.push(label);
            }
            declutterBedLabels(labelEls);
        }
        const colorOf = colorAssigner();
        const legend = new Map();
        const dotKeys = new Set();
        let popIx = 0;
        if (layerState.plantings) {
            for (const d of app.planDots) {
                const c = colorOf(d.species);
                const name = app.speciesName?.(d.species) ?? humanize(d.species);
                if (!legend.has(d.species))
                    legend.set(d.species, { name, color: c, filled: false });
                const k = `p:${d.species}:${d.x}:${d.y}`;
                dotKeys.add(k);
                const [px, py] = toPx(d.x, d.y);
                if (px < -10 || px > VIEW + 10 || py < -10 || py > viewH + 10)
                    continue;
                if (!plantDetailVisible)
                    continue;
                const dot = el("circle", { class: prevDotKeys && !prevDotKeys.has(k) ? "plandot pop" : "plandot", cx: px, cy: py, r: 4, stroke: c });
                if (prevDotKeys && !prevDotKeys.has(k))
                    dot.style.animationDelay = `${Math.min(popIx++, 20) * 45}ms`;
                const tip = document.createElementNS(SVG_NS, "title");
                tip.textContent = `planned: ${name}`;
                dot.appendChild(tip);
                L.dots.appendChild(dot);
            }
        }
        if (layerState.plantings && openSeason?.plantings) {
            for (const pl of openSeason.plantings) {
                const c = colorOf(pl.species);
                const name = app.speciesName?.(pl.species) ?? humanize(pl.species);
                const entry = legend.get(pl.species);
                if (entry)
                    entry.filled = true;
                else
                    legend.set(pl.species, { name, color: c, filled: true });
                const cs = regionPoints(pl.region);
                const midx = cs.reduce((a, p) => a + p[0], 0) / cs.length;
                const midy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
                const k = `o:${pl.species}:${midx}:${midy}`;
                dotKeys.add(k);
                const [px, py] = toPx(midx, midy);
                if (px < -10 || px > VIEW + 10 || py < -10 || py > viewH + 10)
                    continue;
                if (!plantDetailVisible)
                    continue;
                const dot = el("circle", { class: prevDotKeys && !prevDotKeys.has(k) ? "plantdot pop" : "plantdot", cx: px, cy: py, r: 5, fill: c });
                if (prevDotKeys && !prevDotKeys.has(k))
                    dot.style.animationDelay = `${Math.min(popIx++, 20) * 45}ms`;
                const tip = document.createElementNS(SVG_NS, "title");
                tip.textContent = `${name}${pl.cultivar_group ? ` (${pl.cultivar_group})` : ""}${pl.sown ? ` - sown ${pl.sown}` : ""}${pl.end_cause ? ` - ended: ${pl.end_cause}` : ""}`;
                dot.appendChild(tip);
                L.dots.appendChild(dot);
            }
        }
        prevDotKeys = dotKeys;
        const lg = document.getElementById("maplegend");
        const kt = document.getElementById("keytoggle");
        if (lg && kt) {
            lg.replaceChildren();
            for (const e of legend.values()) {
                const row = document.createElement("span");
                const sw = document.createElement("i");
                sw.style.borderColor = e.color;
                sw.style.background = e.filled ? e.color : "transparent";
                sw.title = e.filled ? "planted" : "planned";
                row.append(sw, e.name);
                lg.appendChild(row);
            }
            const hasKey = layerState.plantings && legend.size > 0;
            kt.hidden = !hasKey;
            const hasPlanContent = (openSeason?.plantings?.length ?? 0) > 0 || app.planDots.length > 0;
            viewport.classList.toggle("hasplan", hasPlanContent);
            kt.textContent = `● key · ${legend.size}`;
            lg.hidden = !(hasKey && keyOpen);
        }
        if (mode === "corner" && tracePts.length) {
            const pts = tracePts.map(([x, y]) => toPx(x, y).join(",")).join(" ");
            L.edit.appendChild(el(tracePts.length >= 3 ? "polygon" : "polyline", { class: "trace", points: pts }));
            for (const [x, y] of tracePts) {
                const [px, py] = toPx(x, y);
                L.edit.appendChild(el("circle", { class: "v", cx: px, cy: py, r: 7 }));
            }
            const edges = tracePts.length >= 3 ? tracePts.length : tracePts.length - 1;
            for (let i = 0; i < edges; i++) {
                const a = tracePts[i], b = tracePts[(i + 1) % tracePts.length];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                if (len < 0.05)
                    continue;
                const efu = dimLabelFont(len);
                if (efu == null)
                    continue;
                const [mx, my] = toPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                const t = el("text", { class: "dimlabel", x: mx, y: my - 4, "font-size": efu });
                t.textContent = fmtLen(len);
                L.edit.appendChild(t);
            }
        }
        if (proposalRect && !pending && tracePts.length === 0) {
            const { cx: pcx, cy: pcy, w: pw, l: pl } = proposalRect;
            const pts = rectCorners(pcx, pcy, pw, pl, 0).map(([x, y]) => toPx(x, y).join(",")).join(" ");
            L.edit.appendChild(el("polygon", { class: "proposal-bed", points: pts }));
            const pfu = dimLabelFont(Math.max(pw, pl));
            if (pfu != null) {
                const [tx, ty] = toPx(pcx, pcy);
                const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": pfu });
                t.textContent = `${fmtLen(pw)} \u00d7 ${fmtLen(pl)}`;
                L.edit.appendChild(t);
            }
        }
        if (mode === "rect" && pending) {
            const d = rectDims();
            if (d) {
                const [w, l] = d;
                const pts = pendingCorners(w, l).map(([x, y]) => toPx(x, y).join(",")).join(" ");
                L.edit.appendChild(el("polygon", { class: "trace", points: pts }));
                const rfu = dimLabelFont(Math.max(w, l));
                if (rfu != null) {
                    const [tx, ty] = toPx(pending.cx, pending.cy);
                    const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": rfu });
                    t.textContent = `${fmtLen(w)} × ${fmtLen(l)}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                    L.edit.appendChild(t);
                }
                const topMid = rotPt(0, l / 2, pendingAngle);
                const [sx, sy] = toPx(pending.cx + topMid[0], pending.cy + topMid[1]);
                const [hx, hy] = toPx(...rotHandlePos(l, mpp));
                L.edit.appendChild(el("line", { class: "rotstem", x1: sx, y1: sy, x2: hx, y2: hy }));
                L.edit.appendChild(el("circle", { class: "rot", cx: hx, cy: hy, r: 12 }));
                const glyph = el("text", { class: "rotglyph", x: hx, y: hy + 4 });
                glyph.textContent = "↻";
                L.edit.appendChild(glyph);
                for (const [x, y] of pendingCorners(w, l)) {
                    const [vx2, vy2] = toPx(x, y);
                    L.edit.appendChild(el("circle", { class: "v", cx: vx2, cy: vy2, r: 7 }));
                }
            }
        }
        if (mode === "circle" && pending) {
            const r = circleR();
            if (r) {
                const [px, py] = toPx(pending.cx, pending.cy);
                L.edit.appendChild(el("circle", { class: "trace", cx: px, cy: py, r: r / mpp }));
                const cfu = dimLabelFont(2 * r);
                if (cfu != null) {
                    const t = el("text", { class: "dimlabel", x: px, y: py, "font-size": cfu });
                    t.textContent = `⌀ ${fmtLen(2 * r)}`;
                    L.edit.appendChild(t);
                }
                const [ex, ey] = toPx(pending.cx + r, pending.cy);
                L.edit.appendChild(el("circle", { class: "v", cx: ex, cy: ey, r: 7 }));
            }
        }
        if ((mode === "lbed" || mode === "ubed" || mode === "trough") && pending) {
            const pts = presetWorldPts(), bb = pendingBBox();
            if (pts && bb) {
                L.edit.appendChild(el("polygon", { class: "trace", points: pts.map(([x, y]) => toPx(x, y).join(",")).join(" ") }));
                const bfu = dimLabelFont(Math.max(bb[0], bb[1]));
                if (bfu != null) {
                    const [tx, ty] = toPx(pending.cx, pending.cy);
                    const t = el("text", { class: "dimlabel", x: tx, y: ty, "font-size": bfu });
                    t.textContent = `${fmtLen(bb[0])} × ${fmtLen(bb[1])}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                    L.edit.appendChild(t);
                }
                const topMid = rotPt(0, bb[1] / 2, pendingAngle);
                const [sx, sy] = toPx(pending.cx + topMid[0], pending.cy + topMid[1]);
                const [hx, hy] = toPx(...rotHandlePos(bb[1], mpp));
                L.edit.appendChild(el("line", { class: "rotstem", x1: sx, y1: sy, x2: hx, y2: hy }));
                L.edit.appendChild(el("circle", { class: "rot", cx: hx, cy: hy, r: 12 }));
                const glyph = el("text", { class: "rotglyph", x: hx, y: hy + 4 });
                glyph.textContent = "↻";
                L.edit.appendChild(glyph);
                const cs = pendingCorners(bb[0], bb[1]);
                for (let i = 0; i < 4; i++) {
                    if (mode === "lbed" && i === 1)
                        continue;
                    const [vx2, vy2] = toPx(cs[i][0], cs[i][1]);
                    L.edit.appendChild(el("circle", { class: "v", cx: vx2, cy: vy2, r: 7 }));
                }
                const n = notchWorldPos();
                if (n) {
                    const [nx, ny] = toPx(n[0], n[1]);
                    L.edit.appendChild(el("circle", { class: "v", cx: nx, cy: ny, r: 7 }));
                }
            }
        }
        if (magnetGuides.length && pending) {
            for (const g of magnetGuides) {
                if (g.axis === "x") {
                    const [gx] = toPx(g.at, 0);
                    L.edit.appendChild(el("line", { class: "snapguide", x1: gx, y1: 0, x2: gx, y2: viewH }));
                }
                else {
                    const [, gy] = toPx(0, g.at);
                    L.edit.appendChild(el("line", { class: "snapguide", x1: 0, y1: gy, x2: VIEW, y2: gy }));
                }
            }
        }
        const compass = el("text", { class: "compass", x: VIEW - 8, y: 18, "text-anchor": "end", "font-size": (14 / pxPerUnit).toFixed(2) });
        compass.textContent = "N ↑";
        L.chrome.appendChild(compass);
        const imperial = unitSystem() === "imperial";
        const cands = imperial ? [1, 2, 5, 10, 20, 50, 100, 200, 500].map((ft) => ft * 0.3048) : [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
        const fits = cands.filter((m) => m / mpp <= VIEW * 0.28);
        const barM = fits.length ? fits[fits.length - 1] : cands[0];
        L.chrome.appendChild(el("line", { class: "scale", x1: 10, y1: viewH - 30, x2: 10 + barM / mpp, y2: viewH - 30, "data-m": barM }));
        const scale = el("text", { class: "scalelabel", x: 12, y: viewH - 36, "font-size": (11 / pxPerUnit).toFixed(2) });
        scale.textContent = imperial ? `${Math.round(barM / 0.3048)} ft` : `${barM} m`;
        L.chrome.appendChild(scale);
        if (notice) {
            toast(notice);
            notice = null;
        }
        let hasShape = false, guidance = "", sizeText = "", reach = null;
        let contSpan = null;
        if (mode === "rect") {
            hasShape = pending != null;
            const d = rectDims();
            reach = d ? app.bedReachNote?.(Math.min(d[0], d[1])) ?? null : null;
            contSpan = d ? Math.max(d[0], d[1]) : null;
            guidance = "Tap the map to drop a bed, or hold and drag to draw one";
            if (d)
                sizeText = `= ${fmtArea(d[0] * d[1])}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
        }
        else if (mode === "circle") {
            hasShape = pending != null;
            const r = circleR();
            reach = r ? app.bedReachNote?.(2 * r) ?? null : null;
            contSpan = r ? 2 * r : null;
            guidance = "Tap the map to drop a bed";
            if (r)
                sizeText = `= ${fmtArea(Math.PI * r * r)}`;
        }
        else if (mode === "lbed" || mode === "ubed" || mode === "trough") {
            hasShape = pending != null;
            guidance = "Tap the map to drop a bed";
            const bb = pendingBBox();
            if (bb) {
                contSpan = Math.max(bb[0], bb[1]);
                if (mode === "lbed") {
                    const d = lDims();
                    if (d) {
                        reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: lLocalPts(d.w, d.l, d.nw, d.nl) })) ?? null;
                        sizeText = `= ${fmtArea(d.w * d.l - d.nw * d.nl)}`;
                    }
                }
                else if (mode === "ubed") {
                    const d = uDims();
                    if (d) {
                        reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: uLocalPts(d.w, d.l, d.nw, d.nl) })) ?? null;
                        sizeText = `= ${fmtArea(d.w * d.l - d.nw * d.nl)}`;
                    }
                }
                else {
                    const d = troughDims();
                    if (d) {
                        reach = app.bedReachNote?.(d.w) ?? null;
                        const r = d.w / 2;
                        sizeText = `= ${fmtArea(d.w * (d.l - d.w) + Math.PI * r * r)}`;
                    }
                }
            }
        }
        else {
            hasShape = tracePts.length > 0;
            guidance = "Tap the map to drop corners around a bed";
            if (tracePts.length < 3)
                sizeText = `${tracePts.length} corner${tracePts.length === 1 ? "" : "s"} - 3+ to close`;
            else if (!isSimplePolygon(tracePts))
                sizeText = "edges cross - undo until it untangles";
            else {
                reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: tracePts })) ?? null;
                const txs = tracePts.map((p) => p[0]), tys = tracePts.map((p) => p[1]);
                contSpan = Math.max(Math.max(...txs) - Math.min(...txs), Math.max(...tys) - Math.min(...tys));
                sizeText = `${tracePts.length} corners · ${fmtArea(polygonArea(tracePts))}`;
            }
        }
        let guided = anchorBeds > 0;
        try {
            guided = guided || localStorage.getItem("gg-map-guided") === "1";
        }
        catch { }
        if (hasShape) {
            try {
                localStorage.setItem("gg-map-guided", "1");
            }
            catch { }
        }
        note(hasShape || guided ? "" : guidance);
        reachNote(hasShape ? reach : null);
        const structVal = ($("bedstructure")).value;
        containerChip(hasShape && structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null);
        if (hasShape) {
            const contFlag = structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null;
            const cls = reach || contFlag ? "trace-warn" : "trace-ok";
            L.edit.querySelectorAll(".trace").forEach((n) => n.classList.add(cls));
        }
        applyStructureGate();
        $("sizereadout").textContent = sizeText;
        $("savecard").hidden = !hasShape;
        renderAreaList(plot ?? null);
        void renderPlotBar();
    };
    const renderPlotBar = async () => {
        const sel = $("plotsel");
        const plots = await listPlots(db);
        const current = plotId();
        const homeName = (id) => (id === "plot_home" || id === "draft_home" ? "Home" : id);
        if (!plots.some((p) => p.id === current)) {
            plots.unshift({ id: current, name: homeName(current), beds: [] });
        }
        sel.innerHTML = "";
        const def = defaultPlotId();
        for (const p of plots) {
            const o = document.createElement("option");
            o.value = p.id;
            o.textContent = (p.name ?? homeName(p.id)) + (p.id === def ? " (default)" : "") + (p.shared ? ` (${copy.teamsSharedTag})` : "");
            sel.appendChild(o);
        }
        sel.value = current;
        const chip = document.getElementById("gardenchip");
        if (chip) {
            chip.hidden = plots.length <= 1;
            if (plots.length > 1) {
                const cur = plots.find((p) => p.id === current);
                chip.textContent = "";
                chip.append(`Garden: ${cur?.name ?? homeName(current)} - `);
                const a = document.createElement("a");
                a.href = "#/log";
                a.textContent = "switch on the Log ›";
                chip.append(a);
            }
        }
    };
    const renderAreaList = (plot) => {
        const box = $("arealist");
        box.innerHTML = "";
        box.setAttribute("role", "list");
        const seasonsList = app.logSnapshot.seasons;
        const listSeason = seasonsList.find((s) => s.id === seasonId())
            ?? (seasonsList.length ? seasonsList.reduce((a, b) => (a.id >= b.id ? a : b)) : null);
        const gf = (plot?.beds ?? []).length ? app.gardenFacts?.() ?? null : null;
        if (gf) {
            const gh = document.createElement("p");
            gh.className = "gardenhead";
            gh.setAttribute("role", "presentation");
            const n = document.createElement("span");
            n.className = "gardenhead-n";
            n.textContent = gf.head;
            gh.appendChild(n);
            if (gf.tier) {
                const t = document.createElement("span");
                t.className = "gardenhead-tier";
                t.textContent = ` ${gf.tier}`;
                gh.appendChild(t);
            }
            box.appendChild(gh);
        }
        for (const bed of plot?.beds ?? []) {
            const row = document.createElement("div");
            row.className = "arearow bedcard";
            row.setAttribute("role", "listitem");
            row.dataset.bed = bed.name;
            const npts = bed.region.shape === "polygon" ? bed.region.points.length : 4;
            const kind = bed.region.shape !== "polygon" ? "rectangle"
                : npts === 4 ? "rectangle"
                    : npts === 6 ? "L-bed"
                        : npts === 8 ? "U-bed"
                            : npts === (TROUGH_SEG + 1) * 2 ? "trough"
                                : npts === 32 ? "circle" : `${npts} corners`;
            const shape = bed.rotation_deg ? `${kind} · ${bed.rotation_deg}°` : kind;
            const allBedsTop = plot?.beds ?? [];
            const isSectionParent = bedHasSections(bed.name, allBedsTop);
            const head = document.createElement("div");
            head.className = "bedcard-head";
            const nm = document.createElement("h3");
            nm.className = "bedcard-name";
            nm.textContent = bed.name;
            head.appendChild(nm);
            if (!isSectionParent) {
                const st = bedState(bed, listSeason, (id) => app.teamLabel?.(id) ?? null);
                row.dataset.state = st.key;
                const chip = document.createElement("span");
                chip.className = `bedchip bedchip-${st.key}`;
                chip.textContent = st.chip;
                head.appendChild(chip);
                row.appendChild(head);
                const meta = document.createElement("div");
                meta.className = "bedcard-meta";
                const metaBits = [
                    `${shape}, ${fmtArea(regionArea(bed.region))}`,
                    bed.structure ? humanize(bed.structure) : null,
                    bed.sun === "full" ? "full sun" : bed.sun === "part_shade" ? "part shade" : null,
                ].filter(Boolean);
                meta.textContent = metaBits.join(" · ");
                if (!bed.sun) {
                    meta.appendChild(document.createTextNode(" · "));
                    const setSun = document.createElement("button");
                    setSun.type = "button";
                    setSun.className = "linky bedcard-secondary bedcard-setsun";
                    setSun.textContent = "set the sun ›";
                    setSun.title = "full sun or part shade - the shade gate needs it";
                    setSun.addEventListener("click", () => {
                        startEditBed(bed);
                        const sun = () => $("bedsun");
                        const first = sun();
                        seat(first ? scrollerFor(first) : window, sun, { block: "center", motion: "smooth", hold: 1200, reason: "bed-sun" });
                        requestAnimationFrame(() => sun()?.focus({ preventScroll: true }));
                    });
                    meta.appendChild(setSun);
                }
                row.appendChild(meta);
                const stateLine = document.createElement("div");
                stateLine.className = "bedcard-state";
                stateLine.textContent = st.line;
                row.appendChild(stateLine);
                if (st.key === "planned" && app.planReceipt) {
                    const receipt = document.createElement("div");
                    receipt.className = "bedcard-receipt";
                    receipt.hidden = true;
                    row.appendChild(receipt);
                    void app.planReceipt(bed.name).then((r) => {
                        if (!r || !receipt.isConnected)
                            return;
                        const fmtDate = (iso) => {
                            const d = new Date(`${iso}T12:00:00Z`);
                            return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
                        };
                        const line = document.createElement("div");
                        line.className = "bedcard-numbers";
                        if (!r.sized) {
                            line.textContent = "Not sized yet - set a location on the Where step to size this bed.";
                            receipt.appendChild(line);
                            receipt.hidden = false;
                            return;
                        }
                        const bits = [`${r.plants} plants to place`];
                        if (r.areaNeededM2 != null)
                            bits.push(`needs ${fmtArea(r.areaNeededM2)} of your ${fmtArea(r.bedAreaM2)}`);
                        if (r.first)
                            bits.push(`first: ${fmtDate(r.first.date)}, ${r.first.what}`);
                        else if (r.keptForSpring)
                            bits.push("kept for spring");
                        line.textContent = bits.join(" · ");
                        receipt.appendChild(line);
                        const buy = document.createElement("details");
                        buy.className = "bedcard-buy";
                        const sum = document.createElement("summary");
                        sum.textContent = r.toBuy === 0
                            ? "Your seed box covers it - nothing to buy"
                            : `What to buy · ${r.toBuy} ${r.toBuy === 1 ? "kind" : "kinds"}`;
                        buy.appendChild(sum);
                        const ul = document.createElement("ul");
                        for (const k of r.kinds) {
                            const li = document.createElement("li");
                            li.textContent = `${k.label} × ${k.n}${k.owned ? " - in your seed box" : ""}`;
                            if (k.owned)
                                li.className = "owned";
                            ul.appendChild(li);
                        }
                        buy.appendChild(ul);
                        receipt.appendChild(buy);
                        receipt.hidden = false;
                    });
                }
                const facts = app.bedFacts?.(bed.name) ?? null;
                if (facts?.plants.length) {
                    const pl = document.createElement("div");
                    pl.className = "bedcard-plants";
                    pl.setAttribute("aria-label", "growing here now");
                    for (const label of facts.plants) {
                        const c = document.createElement("span");
                        c.className = "plantchip";
                        c.textContent = label;
                        pl.appendChild(c);
                    }
                    row.appendChild(pl);
                }
                if (facts?.history) {
                    const h = document.createElement("div");
                    h.className = "bedcard-history";
                    h.textContent = facts.history;
                    row.appendChild(h);
                }
                if (facts?.next) {
                    const nx = document.createElement("div");
                    nx.className = "bedcard-next" + (facts.next.late ? " late" : "");
                    const [, mm, dd] = facts.next.date.split("-").map(Number);
                    const when = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mm - 1]} ${dd}`;
                    const txt = document.createElement("span");
                    txt.textContent = `${facts.next.late ? (facts.next.harvest ? "Ready" : "Late") : "Next"}: ${when} - ${facts.next.text.split(" - ")[0].replace(/[.:]$/, "")}`;
                    nx.appendChild(txt);
                    const wk = document.createElement("button");
                    wk.type = "button";
                    wk.className = "linky bedcard-secondary bedcard-week";
                    wk.textContent = "This week ›";
                    wk.addEventListener("click", () => void app.openWeek?.());
                    nx.appendChild(wk);
                    row.appendChild(nx);
                }
                if (facts?.nextYear) {
                    const ny = document.createElement("div");
                    ny.className = "bedcard-nextyear";
                    ny.textContent = `Next season (${facts.nextYear.year}): ${facts.nextYear.team} - accepted`;
                    row.appendChild(ny);
                }
                const goToTeams = () => {
                    const cand = document.getElementById("candbed");
                    if (!cand || ![...cand.options].some((o) => o.value === bed.name)) {
                        floatToast("one moment - the garden is still loading");
                        return;
                    }
                    if (cand.value !== bed.name) {
                        cand.value = bed.name;
                        cand.dispatchEvent(new Event("change"));
                    }
                    const sp = document.getElementById("step-plan");
                    if (sp)
                        sp.open = true;
                };
                const cta = document.createElement("div");
                cta.className = "bedcard-cta-row";
                const primary = document.createElement("button");
                primary.type = "button";
                primary.className = "bedcard-cta";
                const plantWindow = st.key === "planned" ? (app.bedPlantWindow?.(bed.name) ?? null) : null;
                const mkChangeAction = () => {
                    const change = document.createElement("button");
                    change.type = "button";
                    change.className = "linky bedcard-secondary";
                    if (st.mybed) {
                        change.textContent = "Edit design";
                        change.addEventListener("click", () => {
                            const cand = document.getElementById("candbed");
                            if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
                                const step = document.getElementById("step-mybed");
                                if (step)
                                    step.open = true;
                                if (cand.value !== bed.name) {
                                    cand.value = bed.name;
                                    cand.dispatchEvent(new Event("change"));
                                }
                            }
                        });
                    }
                    else {
                        change.textContent = "Change team";
                        change.addEventListener("click", () => { if (st.guild)
                            app.focusTeam?.(st.guild); goToTeams(); });
                    }
                    return change;
                };
                if (st.key === "empty") {
                    primary.textContent = "Choose a team";
                    primary.addEventListener("click", goToTeams);
                    cta.appendChild(primary);
                }
                else if (st.key === "planned" && plantWindow?.status === "passed") {
                    primary.textContent = "Put the first job on my calendar";
                    primary.addEventListener("click", () => void app.openWeek?.(undefined, bed.name));
                    cta.appendChild(primary);
                    cta.appendChild(mkChangeAction());
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = "Print bed sheet";
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                }
                else if (st.key === "planned" && app.needsAccountToPlant?.()) {
                    primary.textContent = "Sign in to plant";
                    primary.addEventListener("click", () => {
                        if (app.openAuthSheet)
                            app.openAuthSheet(bed.name);
                        else
                            location.hash = "#/account";
                    });
                    cta.appendChild(primary);
                    cta.appendChild(mkChangeAction());
                }
                else if (st.key === "planned") {
                    primary.textContent = "Mark as planted";
                    const callout = document.createElement("p");
                    callout.className = "bedcard-callout";
                    callout.hidden = true;
                    let armed = false;
                    const plant = async (opts) => {
                        const hook = app.markBedPlantedFromPlan;
                        if (!hook) {
                            floatToast("one moment - the garden is still loading");
                            return;
                        }
                        primary.disabled = true;
                        const r = await hook(bed.name, opts);
                        if (r.ok) {
                            floatToast(plantedLine(seasonId() ?? new Date().getFullYear(), null, bed.name));
                            return;
                        }
                        primary.disabled = false;
                        if (r.canAdvanceTo != null) {
                            const yr = r.canAdvanceTo;
                            callout.replaceChildren(document.createTextNode(`${r.reason ?? ""} `));
                            const adv = document.createElement("button");
                            adv.type = "button";
                            adv.className = "linky bedcard-secondary";
                            adv.textContent = `Start ${yr} season & plant here`;
                            adv.addEventListener("click", () => void plant({ advance: true }));
                            callout.appendChild(adv);
                            callout.hidden = false;
                            return;
                        }
                        if (r.nudge) {
                            armed = true;
                            callout.textContent = `${r.nudge} Tap “Mark as planted” again to plant anyway.`;
                            callout.hidden = false;
                            return;
                        }
                        floatToast(r.reason ?? "could not plant this bed just now");
                    };
                    primary.addEventListener("click", () => void plant(armed ? { force: true } : undefined));
                    cta.appendChild(primary);
                    cta.appendChild(mkChangeAction());
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = "Print bed sheet";
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                    row.appendChild(cta);
                    row.appendChild(callout);
                }
                else if (st.key === "planted") {
                    primary.textContent = "Open in Log";
                    primary.addEventListener("click", () => { if (app.openLogBed)
                        app.openLogBed(bed.name);
                    else
                        location.hash = "#/log"; });
                    cta.appendChild(primary);
                    const sheetBtn = document.createElement("button");
                    sheetBtn.type = "button";
                    sheetBtn.className = "bedcard-sheet";
                    sheetBtn.textContent = "Print bed sheet";
                    sheetBtn.addEventListener("click", () => app.openBedSheet?.(bed.name));
                    cta.appendChild(sheetBtn);
                    const back = document.createElement("button");
                    back.type = "button";
                    back.className = "linky bedcard-secondary";
                    back.textContent = "Back to draft";
                    let backArmed = false;
                    let backTimer = 0;
                    const backDisarm = () => { backArmed = false; if (backTimer) {
                        clearTimeout(backTimer);
                        backTimer = 0;
                    } back.textContent = "Back to draft"; back.classList.remove("arm"); };
                    back.addEventListener("click", () => {
                        if (!backArmed) {
                            const n = (activeSeason()?.plantings ?? [])
                                .filter((p) => { try {
                                return plantingOnBed(p.region, bed.region);
                            }
                            catch {
                                return false;
                            } }).length;
                            backArmed = true;
                            back.classList.add("arm");
                            back.textContent = n > 0
                                ? `tap again - pulls ${n} plant${n === 1 ? "" : "s"} you planted here this year`
                                : "tap again to undo planting";
                            if (backTimer)
                                clearTimeout(backTimer);
                            backTimer = window.setTimeout(backDisarm, 4000);
                            return;
                        }
                        backDisarm();
                        back.disabled = true;
                        void app.revertBedToDraftFromPlan?.(bed.name).then((r) => {
                            if (r?.ok)
                                floatToast(r.removed ? `back to draft - pulled ${r.removed} plant${r.removed === 1 ? "" : "s"}, the team is kept` : "back to draft");
                            else {
                                back.disabled = false;
                                floatToast(r?.reason ?? "couldn’t revert this bed just now");
                            }
                        });
                    });
                    cta.appendChild(back);
                }
                else {
                    primary.textContent = "Open in Log";
                    primary.addEventListener("click", () => { if (app.openLogBed)
                        app.openLogBed(bed.name);
                    else
                        location.hash = "#/log"; });
                    cta.appendChild(primary);
                }
                if (!cta.parentNode)
                    row.appendChild(cta);
            }
            else {
                row.appendChild(head);
                const meta = document.createElement("div");
                meta.className = "bedcard-meta";
                meta.textContent = `${shape}, ${fmtArea(regionArea(bed.region))} · split into sections below`;
                row.appendChild(meta);
            }
            const actions = document.createElement("div");
            actions.className = "bedcard-actions";
            const ed = document.createElement("button");
            ed.type = "button";
            ed.textContent = "Edit";
            ed.addEventListener("click", () => startEditBed(bed));
            actions.appendChild(ed);
            const dup = document.createElement("button");
            dup.type = "button";
            dup.textContent = "Duplicate";
            dup.title = `a copy of "${bed.name}", one walking path over - name it and save`;
            dup.addEventListener("click", () => startDuplicateBed(bed));
            actions.appendChild(dup);
            const rm = document.createElement("button");
            rm.type = "button";
            rm.textContent = "Remove";
            const openSeason = activeSeason();
            const loggedOnBed = (openSeason?.plantings ?? []).filter((p) => plantingOnBed(p.region, bed.region));
            const guarded = bed.planted === true || loggedOnBed.length > 0;
            let armed = false;
            let armTimer = 0;
            const disarm = () => {
                armed = false;
                if (armTimer) {
                    clearTimeout(armTimer);
                    armTimer = 0;
                }
                rm.textContent = "Remove";
                rm.classList.remove("arm");
            };
            const doRemove = () => {
                lastAct = { kind: "remove", bed, plants: loggedOnBed };
                void removeBed(db, plotId(), bed.name, seasonId()).then(() => {
                    notice = `removed "${bed.name}" and its plants for this season. Closed past seasons keep their history.`;
                    invalidatePlot();
                    onBedsChanged();
                    void redraw();
                });
            };
            rm.addEventListener("click", () => {
                if (guarded && !armed) {
                    armed = true;
                    rm.classList.add("arm");
                    const what = loggedOnBed.length > 0
                        ? `${loggedOnBed.length} plant${loggedOnBed.length === 1 ? "" : "s"} logged`
                        : "planted";
                    rm.textContent = `tap again to remove - ${what}`;
                    if (armTimer)
                        clearTimeout(armTimer);
                    armTimer = window.setTimeout(disarm, 4000);
                    return;
                }
                disarm();
                doRemove();
            });
            actions.appendChild(rm);
            const strips = plantableStripPolygons({ region: bed.region, rotation_deg: bed.rotation_deg, structure: bed.structure ?? "in_ground", lane_flip: bed.lane_flip });
            const allBeds = plot?.beds ?? [];
            const sections = allBeds.filter((b) => sectionParentOf(b, allBeds) === bed.name);
            const sectioned = sections.length > 0;
            if (strips.length >= 2 && !sectioned) {
                const sp = document.createElement("button");
                sp.type = "button";
                sp.textContent = "Add sections";
                if (guarded) {
                    const reason = loggedOnBed.length > 0
                        ? `Remove this season's ${loggedOnBed.length} plant${loggedOnBed.length === 1 ? "" : "s"} before adding sections.`
                        : "Unmark this bed as planted before adding sections.";
                    sp.disabled = true;
                    sp.title = reason;
                    const why = document.createElement("span");
                    why.className = "arearowwhy";
                    why.textContent = reason;
                    actions.appendChild(sp);
                    actions.appendChild(why);
                }
                else {
                    sp.title = `add ${strips.length} sub-sections inside "${bed.name}", one per growing strip - the bed keeps its walking paths`;
                    sp.addEventListener("click", () => void doSplitBed(bed, strips));
                    actions.appendChild(sp);
                }
            }
            if (sectioned) {
                const mrg = document.createElement("button");
                mrg.type = "button";
                mrg.textContent = "Merge sections";
                const sectionPlants = sections.reduce((n, s) => n + (openSeason?.plantings ?? []).filter((p) => plantingOnBed(p.region, s.region)).length, 0);
                const mergeGuarded = sections.some((s) => s.planted === true) || sectionPlants > 0;
                let mArmed = false;
                let mTimer = 0;
                const mDisarm = () => { mArmed = false; if (mTimer) {
                    clearTimeout(mTimer);
                    mTimer = 0;
                } mrg.textContent = "Merge sections"; mrg.classList.remove("arm"); };
                mrg.title = `merge the ${sections.length} sections back into "${bed.name}" - it becomes one bed again, planned as a whole`;
                mrg.addEventListener("click", () => {
                    if (mergeGuarded && !mArmed) {
                        mArmed = true;
                        mrg.classList.add("arm");
                        mrg.textContent = sectionPlants > 0
                            ? `tap again to merge - ${sectionPlants} plant${sectionPlants === 1 ? "" : "s"} in sections lost`
                            : "tap again to merge - a section is planted";
                        if (mTimer)
                            clearTimeout(mTimer);
                        mTimer = window.setTimeout(mDisarm, 4000);
                        return;
                    }
                    mDisarm();
                    void doMergeSections(bed, sections);
                });
                actions.appendChild(mrg);
            }
            row.appendChild(actions);
            box.appendChild(row);
        }
    };
    const doSplitBed = async (bed, strips) => {
        const pid = plotId();
        const r2 = (v) => Math.round(v * 100) / 100;
        const fresh = await getPlot(db, pid);
        const taken = new Set((fresh?.beds ?? []).map((b) => b.name));
        const rotated = !!bed.rotation_deg && bed.rotation_deg % 360 !== 0;
        let counter = 1;
        for (const poly of strips) {
            let nm = `${bed.name} ${counter}`;
            while (taken.has(nm))
                nm = `${bed.name} ${++counter}`;
            taken.add(nm);
            counter++;
            let region;
            let rotation;
            if (rotated) {
                region = { shape: "polygon", points: poly.map(([x, y]) => [r2(x), r2(y)]) };
                rotation = bed.rotation_deg;
            }
            else {
                const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
                const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
                region = { shape: "rect", x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
            }
            countRung("bed-saved");
            await placeBed(db, pid, nm, region, rotation, bed.sun, bed.structure);
        }
        notice = `added ${strips.length} sections inside "${bed.name}" - each takes its own plant team below; the bed keeps its walking paths.`;
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    const doMergeSections = async (bed, sections) => {
        const pid = plotId();
        for (const s of sections)
            await removeBed(db, pid, s.name, seasonId());
        notice = `merged the ${sections.length} sections back into "${bed.name}" - it is one bed again, planned as a whole.`;
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    const mppNow = () => (anchorLat == null ? null : metresPerPixel(anchorLat, zoom));
    function fitZoom(lat, w, h, frac = FIT_FRAC) {
        const reqMpp = Math.max(w / (VIEW * frac), h / (viewH * frac));
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX - 1, Math.log2(metresPerPixel(lat, 0) / reqMpp)));
    }
    const snap = (v) => Math.round(v * 10) / 10;
    const snapDim = (rawM) => {
        if (isContainerSize())
            return snap(rawM);
        const half = (unitSystem() === "imperial" ? 0.3048 : 1) / 2;
        const near = Math.round(rawM / half) * half;
        if (near > 0 && Math.abs(rawM - near) <= 0.2 * half)
            return Math.round(near * 1000) / 1000;
        return snap(rawM);
    };
    const clientToLocal = (clientX, clientY) => {
        const mpp = mppNow();
        if (mpp == null)
            return null;
        const box = svg.getBoundingClientRect();
        const px = ((clientX - box.left) / box.width) * VIEW;
        const py = ((clientY - box.top) / box.height) * viewH;
        return [cx + (px - VIEW / 2) * mpp, cy - (py - viewH / 2) * mpp];
    };
    const localToClient = (xm, ym) => {
        const mpp = mppNow();
        if (mpp == null)
            return null;
        const box = svg.getBoundingClientRect();
        return [box.left + ((VIEW / 2 + (xm - cx) / mpp) / VIEW) * box.width,
            box.top + ((viewH / 2 - (ym - cy) / mpp) / viewH) * box.height];
    };
    const vertexAt = (clientX, clientY) => {
        for (let i = 0; i < tracePts.length; i++) {
            const c = localToClient(tracePts[i][0], tracePts[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < 22)
                return i;
        }
        return -1;
    };
    const resizeHandleAt = (clientX, clientY) => {
        if (!pending)
            return -1;
        const rad = onPending(clientX, clientY, 0) ? 12 : 22;
        if (mode === "circle") {
            const r = circleR();
            if (!r)
                return -1;
            const c = localToClient(pending.cx + r, pending.cy);
            return c && Math.hypot(clientX - c[0], clientY - c[1]) < rad ? 0 : -1;
        }
        const d = pendingBBox();
        if (!d)
            return -1;
        const cs = pendingCorners(d[0], d[1]);
        for (let i = 0; i < 4; i++) {
            if (mode === "lbed" && i === 1)
                continue;
            const c = localToClient(cs[i][0], cs[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < rad)
                return i;
        }
        return -1;
    };
    const notchWorldPos = () => {
        if (!pending)
            return null;
        let local = null;
        if (mode === "lbed") {
            const d = lDims();
            if (d)
                local = [d.w / 2 - d.nw, d.l / 2 - d.nl];
        }
        else if (mode === "ubed") {
            const d = uDims();
            if (d)
                local = [d.nw / 2, d.l / 2 - d.nl];
        }
        if (!local)
            return null;
        const r = rotPt(local[0], local[1], pendingAngle);
        return [pending.cx + r[0], pending.cy + r[1]];
    };
    const MAGNET_TOL_M = 0.15;
    let magnetGuides = [];
    let magnetSig = "";
    const pendingHalf = () => {
        if (mode === "circle") {
            const r = circleR();
            return r ? [r, r] : null;
        }
        const d = pendingBBox();
        if (!d)
            return null;
        if (pendingAngle % 180 === 0)
            return [d[0] / 2, d[1] / 2];
        if (pendingAngle % 90 === 0)
            return [d[1] / 2, d[0] / 2];
        return null;
    };
    const applyMagnet = (cx0, cy0) => {
        magnetGuides = [];
        const half = pendingHalf();
        const out = { cx: cx0, cy: cy0 };
        if (half) {
            const editingName = (($("areaname")).value ?? "").trim();
            for (const axis of ["x", "y"]) {
                const h = axis === "x" ? half[0] : half[1];
                const c0 = axis === "x" ? cx0 : cy0;
                let best = null;
                for (const bed of app.logSnapshot.beds) {
                    if (editingName && bed.name === editingName)
                        continue;
                    const vs = regionPoints(bed.region).map((p) => (axis === "x" ? p[0] : p[1]));
                    const lo = Math.min(...vs), hi = Math.max(...vs);
                    const cands = [
                        [hi + PATH_M + h, hi], [lo - PATH_M - h, lo], [lo + h, lo], [hi - h, hi],
                    ];
                    for (const [c, guide] of cands) {
                        const d = Math.abs(c0 - c);
                        if (d < MAGNET_TOL_M && (!best || d < best.d))
                            best = { c, guide, d };
                    }
                }
                if (best) {
                    if (axis === "x")
                        out.cx = best.c;
                    else
                        out.cy = best.c;
                    magnetGuides.push({ axis, at: best.guide });
                }
            }
        }
        const sig = magnetGuides.map((g) => g.axis + g.at.toFixed(2)).join("|");
        if (sig && sig !== magnetSig)
            buzz(8);
        magnetSig = sig;
        return out;
    };
    const onPending = (clientX, clientY, margin = 0.3) => {
        if (!pending)
            return false;
        const p = clientToLocal(clientX, clientY);
        if (!p)
            return false;
        if (mode === "rect") {
            const d = rectDims();
            return !!d && Math.abs(p[0] - pending.cx) <= d[0] / 2 + margin
                && Math.abs(p[1] - pending.cy) <= d[1] / 2 + margin;
        }
        if (mode === "lbed" || mode === "ubed" || mode === "trough") {
            const pts = presetWorldPts();
            return !!pts && (pointInPolygon(p[0], p[1], pts) || distToPolygon(p[0], p[1], pts) <= margin);
        }
        const r = circleR();
        return !!r && Math.hypot(p[0] - pending.cx, p[1] - pending.cy) <= r + margin;
    };
    const frameDrop = (clientX, clientY) => {
        const mpp = mppNow();
        if (mpp == null)
            return;
        let bb = pendingBBox();
        if (!bb && mode === "circle") {
            const r = circleR();
            bb = r ? [2 * r, 2 * r] : null;
        }
        if (!bb)
            return;
        const longest = Math.max(bb[0], bb[1]) / mpp;
        if (longest >= 60)
            return;
        let steps = 0;
        while (longest * 2 ** steps < 120 && zoom + steps < ZOOM_MAX)
            steps++;
        if (steps)
            zoomAt(clientX, clientY, zoom + steps);
    };
    const zoomAt = (clientX, clientY, nz) => {
        const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz));
        if (clamped === zoom)
            return;
        const before = clientToLocal(clientX, clientY);
        zoom = clamped;
        const box = svg.getBoundingClientRect();
        if (before && anchorLat != null && box.width >= 2 && box.height >= 2) {
            const mpp = metresPerPixel(anchorLat, zoom);
            const px = ((clientX - box.left) / box.width) * VIEW;
            const py = ((clientY - box.top) / box.height) * viewH;
            cx = before[0] - (px - VIEW / 2) * mpp;
            cy = before[1] + (py - viewH / 2) * mpp;
        }
        notice = null;
        scheduleRedraw();
    };
    let raf = 0;
    const scheduleRedraw = () => {
        if (!raf)
            raf = requestAnimationFrame(() => { raf = 0; void redraw(); });
    };
    const celebrateBed = (region) => {
        const mpp = mppNow();
        if (mpp == null)
            return;
        const pts = regionPoints(region);
        const toV = (xm, ym) => [VIEW / 2 + (xm - cx) / mpp, viewH / 2 - (ym - cy) / mpp];
        const poly = el("polygon", { class: "drawon", points: pts.map(([x, y]) => toV(x, y).join(",")).join(" "), pathLength: 1 });
        const [mx, my] = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length], [0, 0]);
        const [vx, vy] = toV(mx, my);
        const leaves = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 2 * Math.PI;
            const leaf = el("circle", { class: "fxleaf", cx: vx, cy: vy, r: 3.5 });
            leaf.style.setProperty("--dx", `${(Math.cos(a) * 34).toFixed(1)}px`);
            leaf.style.setProperty("--dy", `${(Math.sin(a) * 34).toFixed(1)}px`);
            leaves.push(leaf);
        }
        const nodes = [poly, ...leaves];
        for (const n of nodes)
            L.fx.appendChild(n);
        celebration = { region, poly, leaves };
        setTimeout(() => { for (const n of nodes)
            n.remove(); celebration = null; }, 1200);
    };
    const pointers = new Map();
    let gesture = "none";
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let panSamples = [];
    let coastRaf = 0;
    const coastStop = () => {
        if (!coastRaf)
            return;
        cancelAnimationFrame(coastRaf);
        coastRaf = 0;
        commitGesture();
    };
    const coastStart = () => {
        if (reduceMotion.matches || panSamples.length < 2)
            return false;
        const last = panSamples[panSamples.length - 1];
        let first = last;
        for (const s of panSamples)
            if (last.t - s.t <= 120) {
                first = s;
                break;
            }
        const dt = last.t - first.t;
        const box = svg.getBoundingClientRect();
        if (!(dt > 0) || !Number.isFinite(dt) || box.width < 2 || box.height < 2)
            return false;
        const fx = ((last.x - first.x) / dt) * 16.7 * (VIEW / box.width);
        const fy = ((last.y - first.y) / dt) * 16.7 * (viewH / box.height);
        const frames = coastFrames(fx, fy);
        if (!frames.length)
            return false;
        let i = 0;
        const step = () => {
            coastRaf = 0;
            if (i >= frames.length) {
                commitGesture();
                return;
            }
            gestTx += frames[i][0];
            gestTy += frames[i][1];
            i++;
            applyWorldTransform();
            coastRaf = requestAnimationFrame(step);
        };
        coastRaf = requestAnimationFrame(step);
        return true;
    };
    let edgePan = null;
    let edgePanRaf = 0;
    const EDGE_PAN_PX = 36, EDGE_PAN_SPEED = 7;
    const edgePanStop = () => {
        edgePan = null;
        if (edgePanRaf) {
            cancelAnimationFrame(edgePanRaf);
            edgePanRaf = 0;
        }
    };
    const edgePanStep = () => {
        edgePanRaf = 0;
        if (!edgePan || gesture !== "pending" || !pending)
            return;
        const mpp = mppNow();
        const box = svg.getBoundingClientRect();
        if (mpp == null || box.width < 2 || box.height < 2)
            return;
        cx += edgePan.vx * EDGE_PAN_SPEED * (VIEW / box.width) * mpp;
        cy -= edgePan.vy * EDGE_PAN_SPEED * (viewH / box.height) * mpp;
        const p = clientToLocal(edgePan.x, edgePan.y);
        if (p)
            pending = applyMagnet(snap(p[0]), snap(p[1]));
        scheduleRedraw();
        edgePanRaf = requestAnimationFrame(edgePanStep);
    };
    const edgePanCheck = (clientX, clientY) => {
        const box = svg.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) {
            edgePanStop();
            return;
        }
        const vx = clientX < box.left + EDGE_PAN_PX ? -1 : clientX > box.right - EDGE_PAN_PX ? 1 : 0;
        const vy = clientY < box.top + EDGE_PAN_PX ? -1 : clientY > box.bottom - EDGE_PAN_PX ? 1 : 0;
        if (!vx && !vy) {
            edgePanStop();
            return;
        }
        edgePan = { vx, vy, x: clientX, y: clientY };
        if (!edgePanRaf)
            edgePanRaf = requestAnimationFrame(edgePanStep);
    };
    let vertexIx = -1;
    let resizeAnchor = null;
    let tapStart = null;
    let pinDragStart = null;
    const LONG_PRESS_MS = 400;
    let drawStart = null;
    let longPressTimer = 0;
    const cancelLongPress = () => { if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = 0;
    } };
    let pinchBase = null;
    let gestTx = 0, gestTy = 0, gestScale = 1, gestMx = 0, gestMy = 0;
    const applyWorldTransform = () => {
        setWorldTransform(`translate(${gestTx} ${gestTy}) translate(${gestMx} ${gestMy}) scale(${gestScale}) translate(${-gestMx} ${-gestMy})`);
    };
    const commitGesture = () => {
        if (gestTx === 0 && gestTy === 0 && gestScale === 1)
            return;
        const box = svg.getBoundingClientRect();
        const mpp = mppNow();
        const tx = gestTx, ty = gestTy;
        const dz = Math.log2(gestScale);
        const midClientX = box.left + ((gestMx + tx) / VIEW) * box.width;
        const midClientY = box.top + ((gestMy + ty) / viewH) * box.height;
        gestTx = 0;
        gestTy = 0;
        gestScale = 1;
        gestMx = 0;
        gestMy = 0;
        if (mpp != null && box.width >= 2 && box.height >= 2) {
            cx -= tx * mpp;
            cy += ty * mpp;
            if (dz !== 0)
                zoomAt(midClientX, midClientY, zoom + dz);
        }
        scheduleRedraw();
    };
    const commitPinAt = (clientX, clientY) => {
        const p = clientToLocal(clientX, clientY);
        if (!p || !anchorLL)
            return;
        const [tlat, tlon] = fromLocal(anchorLL, p[0], p[1]);
        const lat = Math.round(tlat * 1e5) / 1e5, lon = Math.round(tlon * 1e5) / 1e5;
        void (async () => {
            const plot = await getPlot(db, plotId());
            if ((plot?.beds.length ?? 0) === 0)
                await doMoveGarden(lat, lon);
            app.setLocation?.(lat, lon, "Pin moved - your dates and plant teams follow it.");
        })();
    };
    svg.addEventListener("pointerdown", (ev) => {
        coastStop();
        panSamples = [{ x: ev.clientX, y: ev.clientY, t: performance.now() }];
        try {
            svg.setPointerCapture(ev.pointerId);
        }
        catch { }
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 2) {
            cancelLongPress();
            const [a, b] = [...pointers.values()];
            pinchBase = { d: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, zoom, tx0: gestTx, ty0: gestTy };
            gesture = "pinch";
            tapStart = null;
            return;
        }
        tapStart = { x: ev.clientX, y: ev.clientY };
        if (locating() && anchorLL && anchorBeds === 0) {
            const ll0 = latlon();
            if (ll0) {
                const c = localToClient(...toLocal(anchorLL, ll0.lat, ll0.lon));
                if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 30) {
                    gesture = "pinmove";
                    pinDragStart = { x: ev.clientX, y: ev.clientY };
                    return;
                }
            }
        }
        if ((mode === "rect" || mode === "lbed" || mode === "ubed" || mode === "trough") && pending) {
            const d = pendingBBox(), mpp = mppNow();
            if (d && mpp != null) {
                const c = localToClient(...rotHandlePos(d[1], mpp));
                if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 22) {
                    gesture = "rotate";
                    return;
                }
            }
        }
        if ((mode === "lbed" || mode === "ubed") && pending) {
            const n = notchWorldPos();
            const c = n && localToClient(n[0], n[1]);
            if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 22) {
                gesture = "notch";
                return;
            }
        }
        if (mode !== "corner" && pending) {
            const h = resizeHandleAt(ev.clientX, ev.clientY);
            if (h >= 0) {
                gesture = "resize";
                resizeAnchor = null;
                const d = pendingBBox();
                if (d) {
                    const cs = pendingCorners(d[0], d[1]);
                    resizeAnchor = [cs[(h + 2) % 4][0], cs[(h + 2) % 4][1]];
                }
                return;
            }
        }
        if (mode === "corner" && (vertexIx = vertexAt(ev.clientX, ev.clientY)) >= 0)
            gesture = "vertex";
        else if (mode !== "corner" && onPending(ev.clientX, ev.clientY))
            gesture = "pending";
        else
            gesture = "pan";
        cancelLongPress();
        if (gesture === "pan" && mode === "rect" && !pending && !locating()
            && !(document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)) {
            const w0 = clientToLocal(ev.clientX, ev.clientY);
            if (w0 && !bedAt(w0[0], w0[1], (mppNow() ?? 0) * BED_TAP_SLOP_PX)) {
                const pid = ev.pointerId;
                longPressTimer = window.setTimeout(() => {
                    longPressTimer = 0;
                    const pt = pointers.get(pid);
                    if (!pt || !tapStart || gesture !== "pan" || pointers.size !== 1)
                        return;
                    const w1 = clientToLocal(pt.x, pt.y);
                    if (!w1)
                        return;
                    gestTx = 0;
                    gestTy = 0;
                    gestScale = 1;
                    setWorldTransform(null);
                    gesture = "draw";
                    tapStart = null;
                    drawStart = [snap(w1[0]), snap(w1[1])];
                    buzz(15);
                    toast("drawing - drag to size the bed, or let go for the default");
                }, LONG_PRESS_MS);
            }
        }
    });
    svg.addEventListener("pointermove", (ev) => {
        const prev = pointers.get(ev.pointerId);
        if (!prev)
            return;
        const dxPx = ev.clientX - prev.x, dyPx = ev.clientY - prev.y;
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (gesture === "pinch" && pinchBase && pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            const raw = Math.hypot(a.x - b.x, a.y - b.y) / pinchBase.d;
            gestScale = Math.max(Math.pow(2, ZOOM_MIN - pinchBase.zoom), Math.min(Math.pow(2, ZOOM_MAX - pinchBase.zoom), raw));
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            gestMx = ((pinchBase.midX - box.left) / box.width) * VIEW - pinchBase.tx0;
            gestMy = ((pinchBase.midY - box.top) / box.height) * viewH - pinchBase.ty0;
            gestTx = pinchBase.tx0 + ((midX - pinchBase.midX) / box.width) * VIEW;
            gestTy = pinchBase.ty0 + ((midY - pinchBase.midY) / box.height) * viewH;
            applyWorldTransform();
            return;
        }
        if (gesture === "rotate" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                let a = (Math.atan2(-(p[0] - pending.cx), p[1] - pending.cy) * 180) / Math.PI;
                a = Math.round(a / 5) * 5;
                pendingAngle = ((a % 360) + 360) % 360;
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (tapStart && Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y) > 8) {
            tapStart = null;
            cancelLongPress();
        }
        if (gesture === "resize" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                if (mode !== "circle" && resizeAnchor) {
                    const u = rotPt(1, 0, pendingAngle), v = rotPt(0, 1, pendingAngle);
                    const dx = p[0] - resizeAnchor[0], dy = p[1] - resizeAnchor[1];
                    const du = dx * u[0] + dy * u[1], dv = dx * v[0] + dy * v[1];
                    const floor = mode === "lbed" || mode === "ubed" ? 0.3 : 0.2;
                    const w = Math.max(floor, snapDim(Math.abs(du))), l = Math.max(floor, snapDim(Math.abs(dv)));
                    const su = du === 0 ? 1 : Math.sign(du), sv = dv === 0 ? 1 : Math.sign(dv);
                    pending = {
                        cx: resizeAnchor[0] + (u[0] * su * w + v[0] * sv * l) / 2,
                        cy: resizeAnchor[1] + (u[1] * su * w + v[1] * sv * l) / 2,
                    };
                    const [wid, lid] = mode === "lbed" ? ["lw", "ll"] : mode === "ubed" ? ["uw", "ul"]
                        : mode === "trough" ? ["tw", "tl"] : ["shapew", "shapel"];
                    setDim(wid, w);
                    setDim(lid, l);
                }
                else if (mode === "circle") {
                    const r = Math.max(0.1, snapDim(2 * Math.hypot(p[0] - pending.cx, p[1] - pending.cy)) / 2);
                    setDim("shaped", 2 * r);
                }
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (gesture === "notch" && pending && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                const lp = rotPt(p[0] - pending.cx, p[1] - pending.cy, -pendingAngle);
                if (mode === "lbed") {
                    const d = lDims();
                    if (d) {
                        setDim("lnw", Math.min(Math.max(0.1, snapDim(d.w / 2 - lp[0])), d.w - 0.1));
                        setDim("lnl", Math.min(Math.max(0.1, snapDim(d.l / 2 - lp[1])), d.l - 0.1));
                    }
                }
                else if (mode === "ubed") {
                    const d = uDims();
                    if (d) {
                        setDim("unw", Math.min(Math.max(0.1, snapDim(2 * Math.abs(lp[0]))), d.w - 0.2));
                        setDim("unl", Math.min(Math.max(0.1, snapDim(d.l / 2 - lp[1])), d.l - 0.1));
                    }
                }
                notice = null;
                scheduleRedraw();
            }
            tapStart = null;
            return;
        }
        if (gesture === "draw" && drawStart && pointers.size === 1) {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                const dx = p[0] - drawStart[0], dy = p[1] - drawStart[1];
                const w = Math.max(0.1, snapDim(Math.abs(dx))), l = Math.max(0.1, snapDim(Math.abs(dy)));
                const x1 = drawStart[0] + Math.sign(dx || 1) * w, y1 = drawStart[1] + Math.sign(dy || 1) * l;
                pending = { cx: (drawStart[0] + x1) / 2, cy: (drawStart[1] + y1) / 2 };
                pendingAngle = 0;
                setDim("shapew", w);
                setDim("shapel", l);
                notice = null;
                scheduleRedraw();
            }
            return;
        }
        if (tapStart || pointers.size !== 1)
            return;
        if (gesture === "pinmove") {
            const box = svg.getBoundingClientRect();
            const pinEl = svg.querySelector(".locpin");
            if (pinEl && pinDragStart && box.width >= 2 && box.height >= 2) {
                const vx = ((ev.clientX - pinDragStart.x) / box.width) * VIEW;
                const vy = ((ev.clientY - pinDragStart.y) / box.height) * viewH;
                pinEl.setAttribute("transform", `translate(${vx} ${vy})`);
            }
        }
        else if (gesture === "vertex") {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                tracePts[vertexIx] = [snap(p[0]), snap(p[1])];
                notice = null;
                scheduleRedraw();
            }
        }
        else if (gesture === "pending") {
            const p = clientToLocal(ev.clientX, ev.clientY);
            if (p) {
                pending = applyMagnet(snap(p[0]), snap(p[1]));
                notice = null;
                scheduleRedraw();
            }
            edgePanCheck(ev.clientX, ev.clientY);
        }
        else if (gesture === "pan") {
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            gestTx += (dxPx / box.width) * VIEW;
            gestTy += (dyPx / box.height) * viewH;
            panSamples.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
            if (panSamples.length > 6)
                panSamples.shift();
            applyWorldTransform();
        }
    });
    const pointerEnd = (ev) => {
        cancelLongPress();
        edgePanStop();
        if (gesture === "draw" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            if (!pending && drawStart && ev.type !== "pointercancel") {
                pending = freeGround({ cx: drawStart[0], cy: drawStart[1] });
                redoPending = null;
            }
            drawStart = null;
            tapStart = null;
            void redraw();
            return;
        }
        if (gesture === "pinmove" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            tapStart = null;
            pinDragStart = null;
            if (ev.type !== "pointercancel")
                commitPinAt(ev.clientX, ev.clientY);
            else
                void redraw();
            return;
        }
        const wasTap = tapStart != null && gesture !== "pinch" && gesture !== "rotate"
            && gesture !== "resize" && gesture !== "notch" && pointers.size === 1;
        pointers.delete(ev.pointerId);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture();
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "pan" && !coastStart())
                commitGesture();
            gesture = "none";
            if (magnetGuides.length) {
                magnetGuides = [];
                magnetSig = "";
                scheduleRedraw();
            }
        }
        if (!wasTap || ev.type === "pointercancel") {
            tapStart = null;
            return;
        }
        tapStart = null;
        const p = clientToLocal(ev.clientX, ev.clientY);
        if (!p)
            return;
        if (locating()) {
            if (!anchorLL)
                return;
            if (anchorBeds > 0) {
                floatToast("This garden's spot is set - its beds anchor here. Type a new address to move the whole garden.");
                return;
            }
            commitPinAt(ev.clientX, ev.clientY);
            return;
        }
        if (mode === "corner" ? tracePts.length === 0 : !pending) {
            const tolM = (mppNow() ?? 0) * BED_TAP_SLOP_PX;
            const hit = bedAt(p[0], p[1], tolM);
            closeBedPopover();
            if (hit) {
                openBedPopover(hit);
                return;
            }
        }
        if (document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)
            return;
        notice = null;
        if (mode === "corner") {
            if (vertexAt(ev.clientX, ev.clientY) >= 0)
                return;
            tracePts.push([snap(p[0]), snap(p[1])]);
            redoPts = [];
        }
        else {
            pending = freeGround({ cx: snap(p[0]), cy: snap(p[1]) });
            redoPending = null;
            frameDrop(ev.clientX, ev.clientY);
        }
        void redraw();
    };
    svg.addEventListener("pointerup", pointerEnd);
    svg.addEventListener("pointercancel", pointerEnd);
    const reconcilePointerEnd = (id) => {
        if (!pointers.has(id))
            return;
        pointers.delete(id);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture();
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "pan")
                commitGesture();
            gesture = "none";
            tapStart = null;
            cancelLongPress();
            drawStart = null;
        }
    };
    window.addEventListener("pointerup", (ev) => reconcilePointerEnd(ev.pointerId));
    window.addEventListener("pointercancel", (ev) => reconcilePointerEnd(ev.pointerId));
    svg.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        coastStop();
        const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
        const dz = Math.max(-1, Math.min(1, (-ev.deltaY * unit) / 240));
        if (dz)
            zoomAt(ev.clientX, ev.clientY, zoom + dz);
    }, { passive: false });
    if (svg.parentElement)
        new ResizeObserver(() => scheduleRedraw()).observe(svg.parentElement);
    window.addEventListener("gg-sheet-settled", () => scheduleRedraw());
    const setMode = (m) => {
        mode = m;
        tracePts = [];
        pending = null;
        pendingAngle = 0;
        redoPts = [];
        redoPending = null;
        cancelLongPress();
        drawStart = null;
        notice = null;
        retireReach();
        for (const [id, mm] of [["modecorner", "corner"], ["moderect", "rect"], ["modecircle", "circle"],
            ["modelbed", "lbed"], ["modeubed", "ubed"], ["modetrough", "trough"]]) {
            $(id).className = mm === m ? "modebtn on" : "modebtn";
        }
        $("dimsrect").hidden = m !== "rect";
        $("dimscircle").hidden = m !== "circle";
        $("dimsl").hidden = m !== "lbed";
        $("dimsu").hidden = m !== "ubed";
        $("dimstrough").hidden = m !== "trough";
        window.dispatchEvent(new Event("gg-sheet-collapse"));
        void redraw();
    };
    $("modecorner").addEventListener("click", () => setMode("corner"));
    $("moderect").addEventListener("click", () => setMode("rect"));
    $("modecircle").addEventListener("click", () => setMode("circle"));
    $("modelbed").addEventListener("click", () => setMode("lbed"));
    $("modeubed").addEventListener("click", () => setMode("ubed"));
    $("modetrough").addEventListener("click", () => setMode("trough"));
    setDim("shapew", unitSystem() === "imperial" ? 4 * 0.3048 : 1.2);
    setDim("shapel", unitSystem() === "imperial" ? 8 * 0.3048 : 2.4);
    window.addEventListener("gg-step-changed", () => void redraw());
    $("mapnoticesx").addEventListener("click", () => {
        noticeDismissed = true;
        $("mapnotices").hidden = true;
        try {
            localStorage.setItem("gg-map-guided", "1");
        }
        catch { }
    });
    $("mapreachx").addEventListener("click", () => {
        reachSeenSession = true;
        $("mapreach").hidden = true;
    });
    $("mapcontainerx").addEventListener("click", () => {
        containerDismissed = true;
        $("mapcontainer").hidden = true;
    });
    const updateLayersChip = () => {
        const set = document.querySelector(".maplayers .ly-set");
        const open = !!set && !set.hidden;
        const off = [["areas", "areas"], ["plantings", "plantings"], ["labels", "labels"]]
            .filter(([k]) => !layerState[k]).map(([, label]) => label);
        $("ly-toggle").textContent = open || off.length === 0 ? "≡ layers"
            : off.length === 1 ? `≡ layers · ${off[0]} off`
                : `≡ layers · ${off.length} hidden`;
    };
    $("ly-toggle").addEventListener("click", () => {
        const set = document.querySelector(".maplayers .ly-set");
        set.hidden = !set.hidden;
        $("ly-toggle").setAttribute("aria-expanded", String(!set.hidden));
        updateLayersChip();
    });
    $("ly-photo").addEventListener("click", () => {
        look = look === "photo" ? "illustrated" : "photo";
        $("ly-photo").classList.toggle("on", look === "photo");
        try {
            localStorage.setItem("gg-maplook", look);
        }
        catch { }
        void redraw();
    });
    $("ly-photo").classList.toggle("on", look === "photo");
    $("keytoggle").addEventListener("click", () => {
        keyOpen = !keyOpen;
        $("keytoggle").setAttribute("aria-expanded", String(keyOpen));
        void redraw();
    });
    for (const [id, key] of [["ly-areas", "areas"], ["ly-plantings", "plantings"], ["ly-labels", "labels"]]) {
        const btn = $(id);
        btn.classList.toggle("on", layerState[key]);
        btn.addEventListener("click", () => {
            layerState[key] = !layerState[key];
            btn.classList.toggle("on", layerState[key]);
            updateLayersChip();
            try {
                localStorage.setItem("gg-maplayers", JSON.stringify(layerState));
            }
            catch { }
            void redraw();
        });
    }
    updateLayersChip();
    {
        const TINTS = [["ly-t-season", "season"], ["ly-t-sun", "sun"],
            ["ly-t-soil", "soil"], ["ly-t-rotation", "rotation"]];
        const words = document.getElementById("tintwords");
        const paint = () => {
            for (const [id, mode] of TINTS)
                $(id).classList.toggle("on", layerState.tint === mode);
            if (words)
                words.textContent = TINT_WORDS[layerState.tint];
        };
        for (const [id, mode] of TINTS) {
            $(id).addEventListener("click", () => {
                layerState.tint = mode;
                paint();
                try {
                    localStorage.setItem("gg-maplayers", JSON.stringify(layerState));
                }
                catch { }
                void redraw();
            });
        }
        paint();
    }
    for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
        $(id).addEventListener("input", () => void redraw());
    }
    $("bedstructure").addEventListener("change", () => {
        const sel = $("bedstructure");
        const wasContainer = prevStructure === "container", nowContainer = sel.value === "container";
        if (wasContainer !== nowContainer) {
            for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
                const el2 = $(id);
                const v = parseFloat(el2.value);
                if (Number.isFinite(v) && v > 0) {
                    const m = wasContainer ? cmInToM(v) : lenToM(v);
                    el2.value = String(nowContainer ? mToCmIn(m) : mToInput(m));
                }
            }
            refreshSizeUnitDisplay();
        }
        prevStructure = sel.value;
        containerDismissed = false;
        void redraw();
    });
    $("mapzin").addEventListener("click", () => { coastStop(); const z = Math.min(ZOOM_MAX, zoom + 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapzout").addEventListener("click", () => { coastStop(); const z = Math.max(ZOOM_MIN, zoom - 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapc").addEventListener("click", () => { cx = 0; cy = 0; void redraw(); });
    $("mapuse").addEventListener("click", () => {
        void (async () => {
            const p = await getPlot(db, plotId());
            if (!p?.anchor)
                return;
            const [lat, lon] = fromLocal(p.anchor, cx, cy);
            app.setLocation?.(Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5);
            notice = "location set to the map centre - your climate, plant teams, and re-centre all follow it.";
            void redraw();
        })();
    });
    window.addEventListener("gg-bed-saved", (ev) => {
        void (async () => {
            const name = ev.detail?.bed;
            const p = await getPlot(db, plotId());
            const bed = name ? p?.beds?.find((b) => b.name === name) : undefined;
            if (!bed || !p?.anchor) {
                invalidatePlot();
                void redraw();
                return;
            }
            const pts = regionPoints(bed.region);
            if (!pts.length)
                return;
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
            const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
            zoom = fitZoom(p.anchor.lat, w, h);
            invalidatePlot();
            void redraw();
        })();
    });
    const doMoveGarden = async (lat, lon) => {
        const plot = await getPlot(db, plotId());
        const nBeds = plot?.beds.length ?? 0;
        let bx = 0, by = 0, n = 0;
        for (const bed of plot?.beds ?? [])
            for (const [x, y] of regionPoints(bed.region)) {
                bx += x;
                by += y;
                n++;
            }
        if (n) {
            bx /= n;
            by /= n;
        }
        const [alat, alon] = fromLocal({ lat, lon }, -bx, -by);
        const typedAddr = document.getElementById("addr")?.value.trim() || undefined;
        await moveGarden(db, plotId(), alat, alon, typedAddr);
        cx = bx;
        cy = by;
        tracePts = [];
        notice = nBeds > 0
            ? `garden moved - its ${nBeds} bed${nBeds === 1 ? "" : "s"} came along, keeping the layout. Centred on your ground.`
            : "location set - the map now centres on your real ground.";
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    app.moveGardenTo = doMoveGarden;
    $("reanchor").addEventListener("click", () => {
        void (async () => {
            const ll = latlon();
            if (!ll)
                return;
            const btn = $("reanchor");
            const plot = await getPlot(db, plotId());
            const nBeds = plot?.beds.length ?? 0;
            if (nBeds > 0 && !moveArmed) {
                moveArmed = true;
                btn.textContent = `↩ tap again: move ${nBeds} bed${nBeds === 1 ? "" : "s"} here`;
                if (moveArmTimer)
                    clearTimeout(moveArmTimer);
                moveArmTimer = window.setTimeout(() => { moveArmed = false; moveArmTimer = 0; btn.textContent = MOVE_LABEL; }, 4000);
                return;
            }
            moveArmed = false;
            if (moveArmTimer) {
                clearTimeout(moveArmTimer);
                moveArmTimer = 0;
            }
            try {
                await doMoveGarden(ll.lat, ll.lon);
            }
            catch (e) {
                btn.textContent = MOVE_LABEL;
                toast(`${e instanceof Error ? e.message : e}`, 5000);
            }
        })();
    });
    const undoLastAct = async () => {
        const act = lastAct;
        if (!act)
            return;
        lastAct = null;
        const pid = plotId();
        if (act.kind === "save") {
            const cur = (await getPlot(db, pid))?.beds.find((b) => b.name === act.name);
            if (!cur) {
                notice = `nothing to take back - "${act.name}" is already gone.`;
            }
            else if (act.prev) {
                await placeBed(db, pid, act.name, act.prev.region, act.prev.rotation_deg, act.prev.sun ?? null, act.prev.structure ?? null);
                await moveBedPlantings(db, pid, cur, { region: act.prev.region, rotation_deg: act.prev.rotation_deg }, seasonId());
                notice = `took back the edit - "${act.name}" has its previous shape again.`;
            }
            else {
                await removeBed(db, pid, act.name, seasonId());
                notice = `took back the save - "${act.name}" removed.`;
            }
        }
        else {
            await placeBed(db, pid, act.bed.name, act.bed.region, act.bed.rotation_deg, act.bed.sun ?? null, act.bed.structure ?? null);
            if (act.bed.planted) {
                const p2 = await getPlot(db, pid);
                const b2 = p2?.beds.find((b) => b.name === act.bed.name);
                if (p2 && b2) {
                    b2.planted = true;
                    await putPlot(db, p2);
                }
            }
            const sid = seasonId();
            if (sid != null)
                for (const q of act.plants)
                    await addPlanting(db, pid, sid, q);
            notice = act.plants.length
                ? `restored "${act.bed.name}" and its ${act.plants.length} plant${act.plants.length === 1 ? "" : "s"} for this season.`
                : `restored "${act.bed.name}".`;
        }
        buzz(20);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    $("areaundo").addEventListener("click", () => {
        notice = null;
        if (mode === "corner" && tracePts.length) {
            const p = tracePts.pop();
            if (p)
                redoPts.push(p);
        }
        else if (pending) {
            redoPending = pending;
            pending = null;
        }
        else if (lastAct) {
            void undoLastAct();
            return;
        }
        void redraw();
    });
    $("arearedo").addEventListener("click", () => {
        notice = null;
        if (mode === "corner") {
            const p = redoPts.pop();
            if (p)
                tracePts.push(p);
        }
        else if (redoPending) {
            pending = redoPending;
            redoPending = null;
        }
        void redraw();
    });
    $("areaclear").addEventListener("click", () => {
        retireReach();
        notice = null;
        tracePts = [];
        pending = null;
        redoPts = [];
        redoPending = null;
        void redraw();
    });
    document.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))
            return;
        if (!document.querySelector("#sec-ground[open], #step-plan[open]"))
            return;
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
            e.preventDefault();
            $(e.key.toLowerCase() === "y" || e.shiftKey ? "arearedo" : "areaundo").click();
            return;
        }
        if (!pending || e.ctrlKey || e.metaKey || e.altKey)
            return;
        const stepM = e.shiftKey ? 1 : 0.1;
        const nudge = {
            ArrowLeft: [-stepM, 0], ArrowRight: [stepM, 0], ArrowUp: [0, stepM], ArrowDown: [0, -stepM],
        };
        if (nudge[e.key]) {
            e.preventDefault();
            pending = { cx: snap(pending.cx + nudge[e.key][0]), cy: snap(pending.cy + nudge[e.key][1]) };
            notice = null;
            scheduleRedraw();
        }
        else if (e.key.toLowerCase() === "r"
            && (mode === "rect" || mode === "lbed" || mode === "ubed" || mode === "trough")) {
            pendingAngle = (((pendingAngle + (e.shiftKey ? -5 : 5)) % 360) + 360) % 360;
            notice = null;
            scheduleRedraw();
        }
        else if (e.key === "Escape" || e.key === "Delete") {
            redoPending = pending;
            pending = null;
            void redraw();
        }
    });
    $("areasave").addEventListener("click", () => {
        void (async () => {
            try {
                const name = ($("areaname")).value.trim();
                if (!name)
                    throw new Error("name the area first - that's how you'll pick it when planting");
                const r2 = (v) => Math.round(v * 100) / 100;
                const oldBed = (await getPlot(db, plotId()))?.beds.find((b) => b.name === name);
                let region;
                let rotation;
                if (mode === "rect") {
                    const d = rectDims();
                    if (!d)
                        throw new Error("set the width and length first");
                    if (!pending)
                        throw new Error("tap the map to place the square first");
                    if (pendingAngle % 360 !== 0) {
                        region = { shape: "polygon", points: pendingCorners(d[0], d[1]).map(([x, y]) => [r2(x), r2(y)]) };
                        rotation = pendingAngle;
                        notice = `saved "${name}" (${fmtLen(d[0])} × ${fmtLen(d[1])}, rotated ${pendingAngle}°) - its plant layout follows the bed's own edges.`;
                    }
                    else {
                        region = { shape: "rect", x: r2(pending.cx - d[0] / 2), y: r2(pending.cy - d[1] / 2), w: r2(d[0]), h: r2(d[1]) };
                        notice = `saved "${name}" (${fmtLen(d[0])} × ${fmtLen(d[1])}).`;
                    }
                }
                else if (mode === "circle") {
                    const r = circleR();
                    if (!r)
                        throw new Error("set the diameter first");
                    if (!pending)
                        throw new Error("tap the map to place the circle first");
                    const N = 32;
                    const points = [];
                    for (let i = 0; i < N; i++) {
                        const a = (2 * Math.PI * i) / N;
                        points.push([r2(pending.cx + r * Math.cos(a)), r2(pending.cy + r * Math.sin(a))]);
                    }
                    region = { shape: "polygon", points };
                    notice = `saved "${name}" (⌀ ${fmtLen(2 * r)}, stored as a 32-sided outline - 99.4% of the true circle's area).`;
                }
                else if (mode === "lbed" || mode === "ubed" || mode === "trough") {
                    const bb = pendingBBox();
                    if (!bb)
                        throw new Error("set the size first");
                    const pts = presetWorldPts();
                    if (!pending || !pts)
                        throw new Error("tap the map to place the bed first");
                    region = { shape: "polygon", points: pts.map(([x, y]) => [r2(x), r2(y)]) };
                    if (pendingAngle % 360 !== 0)
                        rotation = pendingAngle;
                    if (mode === "lbed") {
                        const d = lDims();
                        notice = `saved "${name}" (L-bed, ${fmtLen(bb[0])} × ${fmtLen(bb[1])}${d ? ` with a ${fmtLen(d.nw)} × ${fmtLen(d.nl)} notch` : ""}).`;
                    }
                    else if (mode === "ubed") {
                        const d = uDims();
                        notice = `saved "${name}" (U-bed, ${fmtLen(bb[0])} × ${fmtLen(bb[1])}${d ? ` with a ${fmtLen(d.nw)} × ${fmtLen(d.nl)} notch` : ""}).`;
                    }
                    else {
                        notice = `saved "${name}" (trough, ${fmtLen(bb[0])} × ${fmtLen(bb[1])}, rounded ends).`;
                    }
                }
                else {
                    if (tracePts.length < 3)
                        throw new Error("drop at least 3 corners first");
                    region = { shape: "polygon", points: tracePts.map((p) => [p[0], p[1]]) };
                    notice = `saved "${name}" - draw another, or head to the plant teams below to plan it.`;
                }
                const sunSel = ($("bedsun")).value;
                const sun = sunSel === "full" || sunSel === "part_shade" ? sunSel : null;
                const structSel = ($("bedstructure")).value;
                const structure = structSel === "raised" || structSel === "in_ground" || structSel === "container" || structSel === "field"
                    ? structSel : null;
                const gate = structure ? app.bedStructureBlockers?.(name) : null;
                if (gate && structure && gate.blocked.includes(structure) && structure !== oldBed?.structure) {
                    throw new Error(gate.reason(structure) ?? "that structure is not allowed for this bed's plants");
                }
                const laneFlip = ($("bedlanes")).value === "flip" ? true : null;
                countRung("bed-saved");
                await placeBed(db, plotId(), name, region, rotation, sun, structure, undefined, laneFlip);
                if (structure === "container") {
                    const cpts = regionPoints(region);
                    const cxs = cpts.map((p) => p[0]), cys = cpts.map((p) => p[1]);
                    const maxSpan = Math.max(Math.max(...cxs) - Math.min(...cxs), Math.max(...cys) - Math.min(...cys));
                    const cnote = app.bedContainerNote?.(maxSpan) ?? null;
                    if (cnote)
                        notice = notice ? `${notice} ${cnote}` : cnote;
                }
                if (oldBed)
                    await moveBedPlantings(db, plotId(), oldBed, { region, rotation_deg: rotation }, seasonId());
                lastAct = { kind: "save", name, prev: oldBed ?? null };
                celebrateBed(region);
                tracePts = [];
                pending = null;
                pendingAngle = 0;
                retireReach();
                buzz(30);
                ($("areaname")).value = "";
                ($("bedsun")).value = "";
                ($("bedstructure")).value = "in_ground";
                ($("bedlanes")).value = "";
                prevStructure = "in_ground";
                refreshSizeUnitDisplay();
                invalidatePlot();
                onBedsChanged();
                if (!oldBed) {
                    const ground = document.getElementById("sec-ground");
                    if (ground)
                        ground.open = true;
                    window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
                }
                void redraw();
            }
            catch (e) {
                toast(`${e instanceof Error ? e.message : e}`, 5000);
            }
        })();
    });
    ($("plotsel")).addEventListener("change", () => {
        tracePts = [];
        notice = null;
        onPlotSwitched(($("plotsel")).value);
    });
    $("plotaddtoggle").addEventListener("click", () => {
        const fields = $("plotaddfields");
        const show = fields.hidden;
        fields.hidden = !show;
        ($("plotaddtoggle")).textContent = show ? "Cancel" : copy.logAddGardenBtn;
        if (show)
            ($("newplotname")).focus();
    });
    $("plotadd").addEventListener("click", () => {
        void (async () => {
            try {
                const name = ($("newplotname")).value.trim();
                if (!name)
                    throw new Error("name the new address first (e.g. \"lake cabin\")");
                const ll = latlon();
                if (!ll)
                    throw new Error("set the new address's location above first - it anchors there");
                const id = plotIdFor(name);
                if (!id || id === "plot_")
                    throw new Error("that name has no usable characters");
                if (await getPlot(db, id))
                    throw new Error(`an address named "${name}" already exists`);
                const address = document.getElementById("addr")?.value.trim() || undefined;
                await putPlot(db, { id, name, address, anchor: { lat: ll.lat, lon: ll.lon }, beds: [] });
                ($("newplotname")).value = "";
                $("plotaddfields").hidden = true;
                ($("plotaddtoggle")).textContent = copy.logAddGardenBtn;
                notice = `address "${name}" added - its ground, areas, and seasons are their own ledger.`;
                onPlotSwitched(id);
            }
            catch (e) {
                toast(`${e instanceof Error ? e.message : e}`, 5000);
            }
        })();
    });
    return {
        redraw: () => void redraw(),
        centerOn: (lat, lon) => {
            void (async () => {
                const p = await getPlot(db, plotId());
                if (p?.anchor) {
                    const [x, y] = toLocal(p.anchor, lat, lon);
                    cx = x;
                    cy = y;
                    if (!(p.beds?.length ?? 0))
                        zoom = LOCATE_ZOOM;
                    void redraw();
                }
            })();
        },
        refit: () => {
            lastFitPlotId = null;
            lastPlot = null;
            void redraw();
        },
        refitIfDrifted: async () => {
            const p = await getPlot(db, plotId());
            const pts = (p?.beds ?? []).flatMap((b) => regionPoints(b.region));
            if (!pts.length)
                return;
            const lat = p?.anchor?.lat ?? anchorLat ?? 45;
            const mpp = metresPerPixel(lat, zoom);
            const xs = pts.map((q) => VIEW / 2 + (q[0] - cx) / mpp);
            const ys = pts.map((q) => viewH / 2 - (q[1] - cy) / mpp);
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const onScreen = x1 > 0 && x0 < VIEW && y1 > 0 && y0 < viewH;
            const fill = Math.max((x1 - x0) / VIEW, (y1 - y0) / viewH);
            if (!onScreen || fill < 0.25) {
                lastFitPlotId = null;
                lastPlot = null;
                void redraw();
            }
        },
        proposeRect: (w, l, structure, lat) => {
            if (proposalRect || proposalTaken)
                return;
            const bedCy = cy - l / 2 - 0.5;
            proposalRect = { cx, cy: bedCy, w, l, structure };
            cy = bedCy;
            if (Number.isFinite(lat))
                zoom = fitZoom(lat, w, l, 0.35);
            void redraw();
        },
        clearProposal: () => {
            if (!proposalRect && !proposalTaken)
                return;
            proposalRect = null;
            proposalTaken = false;
            void redraw();
        },
        editProposal: () => {
            if (!proposalRect)
                return;
            const { cx: pcx, cy: pcy, w, l, structure } = proposalRect;
            mode = "rect";
            setDim("shapew", w);
            setDim("shapel", l);
            const ss = $("bedstructure");
            ss.value = structure;
            prevStructure = ss.value;
            pending = { cx: pcx, cy: pcy };
            pendingAngle = 0;
            proposalRect = null;
            proposalTaken = true;
            void redraw();
        },
        proposalTakenNow: () => proposalTaken,
        keepProposal: async (name) => {
            if (!proposalRect)
                return false;
            const { cx: pcx, cy: pcy, w, l, structure } = proposalRect;
            const r2 = (v) => Math.round(v * 100) / 100;
            const region = { shape: "rect", x: r2(pcx - w / 2), y: r2(pcy - l / 2), w: r2(w), h: r2(l) };
            const struct = structure === "raised" || structure === "in_ground" || structure === "container" || structure === "field" ? structure : null;
            countRung("bed-saved");
            await placeBed(db, plotId(), name, region, undefined, null, struct, true);
            proposalRect = null;
            invalidatePlot();
            onBedsChanged();
            void redraw();
            return true;
        },
    };
}
