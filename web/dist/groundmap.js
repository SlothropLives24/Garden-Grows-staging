// The ground map (Plan tab) - D-021's imagery enhancement, bounded by D-022. DOM layer.
//
// Flow: address (or ZIP/lat-lon) resolves a location → the plot anchors its local metre frame
// there ONCE → Esri World Imagery tiles draw UNDER a metre grid → the user traces one or many
// growing areas on top. Tiles are backdrop pixels: every coordinate that reaches storage or the
// engine is in the same +y-north local metre frame the rest of the system already uses, so a
// traced area feeds rotation history and placement identically with or without imagery. Tiles
// unreachable (or offline) → the grid alone, fully functional - the app never requires them.
import { fromLocal, metresPerPixel, toLocal } from "./engine/geo.js";
import { humanize } from "./engine/labels.js";
import { area as regionArea, intersectArea, isSimplePolygon, minReachSpanM, parseRegion, polygonArea, regionPoints } from "./engine/regions.js";
import { PATH_M, accessBandPolygons, plantableStripPolygons } from "./engine/place.js";
import { copy } from "./copy.js";
import { toast as floatToast } from "./notices.js";
import { addPlanting, getPlot, listPlots, moveGarden, placeBed, plotIdFor, putPlot, removeBed, setPlotAnchorOnce } from "./storage.js";
import { fmtArea, fmtLen, lenToM, mToInput, unitSystem } from "./units.js";
import { bedHasSections, moveBedPlantings, plantingOnBed, sectionParentName } from "./plan.js";
import { countRung } from "./analytics.js";
import { app, defaultPlotId } from "./state.js";
import { drawTiles } from "./groundmap/imagery.js";
import { colorAssigner } from "./groundmap/palette.js";
import { coastFrames, pointInPolygon, distToPolygon, rectCorners, rotPt } from "./groundmap/geometry.js";
import { IMPERIAL_CELL_M, METRIC_CELL_M, canErase, canPaint, cellKey, fillHoles, isLattice, outline, rasterize, strokeCells } from "./groundmap/paint.js";
import { buzz } from "./haptics.js";
// Imagery (Esri/Google tiles + attribution) lives in groundmap/imagery.ts; the species dot
// palette in groundmap/palette.ts; frame-agnostic math in groundmap/geometry.ts (slice 2's
// pure-move extraction - behavior identical, this file just got smaller).
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW = 440; // viewBox px
// Geometry zooms past the imagery: tiles top out at z20, but small beds need closer - from
// z21 the z20 tiles stretch under the sharp vector layer (grid, beds, plants) instead of
// capping the zoom (walkthrough round 5: "zoom in closer to see individual plant placements").
// Zoom is CONTINUOUS (O113 N1): it can rest at any fractional level - a pinch commits its exact
// scale, the wheel steps smoothly - and only the tile FETCH quantises to whole levels. Which
// levels fetch (the guaranteed base, the DPR/deep enhance pass) is imagery.ts's tilePlan (N4);
// past even the deep ceiling the viewport wears `deepzoom` and the vector layer owns the view.
const ZOOM_MIN = 17, ZOOM_MAX = 23;
// How wide a FIT sits (walk round 9, maintainer: "a bit more zoomed out is more ideal"). The
// fitted beds fill this fraction of the view's constraining axis, so there is ground around them
// to place them against - at the old 0.8 a saved bed touched the top and bottom edges of the map.
// O113 N2 (map-feel review): raised 0.5 -> 0.62 and the fit now solves an EXACT fractional zoom
// (fitZoom below) instead of walking integer steps and backing off one more. The old pair landed
// beds at 25-50% of the frame (labels bigger than the beds); round 9's intent - real ground
// around the beds - is kept by the fraction itself, without the power-of-two overshoot.
const FIT_FRAC = 0.62;
// The zoom a FIRST location lands at: wide enough to recognise the street and the roofline,
// rather than the working zoom, which drops you inside your own back garden with no landmarks.
const LOCATE_ZOOM = 18;
// Touch-target margin (screen px) around a saved bed for tap-to-edit: a tap this close to a bed's
// edge still selects it, so a near-miss on a phone edits the bed instead of dropping a new square.
const BED_TAP_SLOP_PX = 16;
const $ = (id) => document.getElementById(id);
export function initGroundMap(db, plotId, // the CURRENT address/plot (D-023) - switchable, so a getter
latlon, onBedsChanged, onPlotSwitched) {
    let zoom = 19;
    let viewH = VIEW; // viewBox height, follows the element's aspect (width stays 440 units)
    let cx = 0, cy = 0; // view centre, local metres (anchor = origin)
    // On ARRIVING at a plot that has beds, centre + zoom-to-fit the beds ONCE (so a returning user - or
    // the example garden - lands looking at their ground, not zoomed way out at the anchor origin). Keyed
    // by plot id so it fires per garden on arrival but never re-fights a pan/zoom within the same garden.
    let lastFitPlotId = null;
    let tracePts = [];
    // Draw modes (maintainer request): corners (free polygon, edges labelled), rect (set W×L,
    // tap/drag to place), circle (set ⌀, same). Shapes stay adjustable - dims live-update the
    // pending shape - until saved. A circle saves as a 32-gon (the `circle` region shape stays
    // reserved, D-015): 99.4% of the true area, and every downstream system stays exact.
    // O101: "lbed", "ubed" and "trough" are the parametric presets (toolset ruling 2026-08-21) -
    // tap to place, handles to shape, saved as ordinary polygons. "paint" survives only as the edit
    // path for existing painted beds (no toolbar button). The U (the ruled fast-follow) is the L's
    // mechanism with the notch cut into the middle of an edge instead of a corner.
    let mode = "rect"; // rectangle is the default tool (D-099);
    // paint (D-096) demoted into "⋯ shapes" - it grabs one-finger touches, so it's opt-in now.
    let reachSeenSession = false; // R-006 reach nudge is shown at most ONCE per session (D-099) -
    // retired the first time the user acts on a conflicting bed (dismiss / save / clear / switch tool).
    let containerDismissed = false; // R-098 container advisory chip: dismissed for now, re-armed when the
    // structure select changes (so a fresh sizing pass warns again) - see the #bedstructure change handler.
    let prevStructure = "in_ground"; // #2: last structure value, to convert size inputs on a container toggle
    // tile-paint session (D-096): cells on a world lattice; guards + geometry live in groundmap/paint.ts.
    // The session is UI state only - the SAVED bed is an ordinary polygon. The paint cell is unit-aware:
    // 0.30 m (metric) / 1 ft (imperial). A NEW session uses the display unit's grid; a re-edited bed keeps
    // the grid it was painted on (latticeCell), so its tiles line up. Everything in a session uses paintCell.
    const cellM = () => (unitSystem() === "imperial" ? IMPERIAL_CELL_M : METRIC_CELL_M);
    const onGrid = (v, cell) => Math.abs(v / cell - Math.round(v / cell)) < 0.017;
    const latticeCell = (region) => regionPoints(region).every(([x, y]) => onGrid(x, METRIC_CELL_M) && onGrid(y, METRIC_CELL_M)) ? METRIC_CELL_M : IMPERIAL_CELL_M;
    let paintCell = METRIC_CELL_M; // set on session start (cellM() for new, latticeCell() on re-edit)
    let paintCells = new Set();
    let paintFresh = new Set(); // cells added since the last redraw - they pop in once
    // The paint toolbar has a MOVE/paint/erase toggle (maintainer: one-finger-paints made the map
    // impossible to pan and laid tiles by accident). In "move" one finger pans/zooms like every other
    // tool; "paint"/"erase" is the deliberate laying/removing. A NEW bed enters with the BRUSH live
    // (drawing starts right away, maintainer); tap-to-edit an EXISTING painted bed enters in "move".
    let paintTool = "paint";
    let paintStroke = null;
    let paintLast = null; // last sampled world point of the stroke
    // Smooth pan/zoom + sheet resize: redraw() reads the plot from IndexedDB, but a burst of redraws (a
    // pan, or the bottom sheet animating and resizing the map) all render the SAME data. Cache the last
    // fetched plot and reuse it for ~120 ms (and always during an active pan/pinch); a local edit calls
    // invalidatePlot() so the change shows at once. 120 ms is imperceptible but cuts IDB reads from ~60/s
    // to a handful.
    let lastPlot = null;
    let lastPlotId = null;
    let lastPlotAt = 0;
    const invalidatePlot = () => { lastPlotAt = 0; };
    let paintSaid = false; // one rejection toast per stroke, not one per skipped tile
    const paintUndoStack = [];
    const paintRedoStack = [];
    // D-098: dots that APPEAR pop in (a plan applied, a bed planted) - keyed by identity, not
    // visibility, so panning old dots into view never pops them. null = first draw, no popping.
    let prevDotKeys = null;
    // D-100: the save celebration (D-098) tracks the bed. The outline + leaves live in the never-
    // cleared fx layer, but the map can resize the instant a bed saves (the #savecard closes →
    // ResizeObserver → new viewH), so redraw re-projects the celebration each frame to stay glued
    // to where the bed actually renders. null once the animation has removed itself (~1.2 s).
    let celebration = null;
    let pending = null; // rect/circle centre, local metres
    let pendingAngle = 0; // rect rotation, degrees CCW, 5°-snapped (D-079 slice 4)
    let notice = null; // an action's result; toasted once, then cleared (D-094)
    let keyOpen = false; // the ● key chip's disclosure state - session-only, collapsed each load
    let anchorLat = null; // cached by redraw so gesture math never awaits IndexedDB
    let anchorLL = null; // the full anchor, for the locate pin's tap math
    let anchorBeds = 0; // cached bed count - once beds exist the pin FREEZES (walk round 5)
    // Where mode (walk round 3, maintainer): while the Where step is open the map has ONE job - the
    // pin. Tap moves it, bed editing waits for "Your ground", and the CSS hides the editing overlays.
    const locating = () => !!document.getElementById("step-where")?.open;
    // "Move this garden" (walkthrough): moving a garden that has beds is deliberate, so the button
    // arms on the first tap ("tap again to move N beds") and executes on the second; a hidden button
    // (location matches the anchor) disarms it.
    const MOVE_LABEL = "Move garden here";
    let moveArmed = false;
    let moveArmTimer = 0;
    // D-079 slice 6 - the map is the hub: layer toggles for the traced areas, the open season's
    // plantings (real occupancy, drawn where it actually is), and the text labels. Persisted so
    // a decluttered map stays decluttered across visits.
    // A4 (award-benchmark amendments): `tint` is the ONE-AT-A-TIME bed-fill layer - this season's
    // record (default), the bed's declared sun, the soil ledger, or rotation recency (via the app
    // seam - the map stays bundle-free). A layer that knows nothing about a bed tints it as such,
    // never guesses; the tint-words chip states the active encoding in words.
    const layerState = { areas: true, plantings: true, labels: true, tint: "season" };
    try {
        Object.assign(layerState, JSON.parse(localStorage.getItem("gg-maplayers") ?? "{}"));
        if (!["season", "sun", "soil", "rotation"].includes(layerState.tint))
            layerState.tint = "season";
    }
    catch { /* corrupt stash - defaults stand */ }
    const TINT_WORDS = {
        season: "This season · sage = planted, cream = open ground",
        sun: "Sun · terracotta = full sun, grey = part shade, pale = not stated",
        soil: "Soil · sage = a soil record covers this ground, pale = not recorded",
        rotation: "Rotation · terracotta = held a crop within a season, sage = rested 2+ seasons, pale = no history",
    };
    // D-097: the map's face. Illustrated (Meadow) is the default; "photo" keeps the old
    // satellite-first view. Persisted like the layer chips.
    let look = "illustrated";
    try {
        if (localStorage.getItem("gg-maplook") === "photo")
            look = "photo";
    }
    catch { /* private mode - default stands */ }
    // redo stacks (D-079 slice 1): undo corner / undo shape can be taken back until the next edit
    let redoPts = [];
    let redoPending = null;
    // O101: ONE level of session undo for the save-level acts (save / remove). Shape-level undo
    // (corners, strokes, the pending shape) still owns the ↺ button while a shape is in progress;
    // with nothing in progress, ↺ takes back the LAST save or removal instead - restoring a
    // replaced shape (its plants moving back with it), un-creating a brand-new bed, or re-placing
    // a removed bed with the open-season plants it carried. One level, this session only; each
    // save-level act overwrites the slot, and taking it is final (no save-level redo).
    let lastAct = null;
    const svg = $("mapsvg");
    // D-095: retained layers, created ONCE in z-order (tiles under everything, fx on top).
    // redraw() clears and repopulates tiles…chrome exactly as the old whole-SVG rebuild did;
    // fx is NEVER cleared by redraw, so CSS-animated effect nodes (self-removing on animationend
    // - the juice slice spawns them) survive pans, zooms, and repaints instead of dying with
    // innerHTML="". Effects are positioned in viewBox px, so a pan mid-burst leaves them at the
    // old screen spot for their sub-second life - accepted (D-095) over a re-projection registry.
    // World-space layers live under TWO transformed groups, so an in-flight pan/pinch can slide the whole
    // drawn scene with one cheap transform (GPU-composited) instead of redrawing every frame - the real
    // redraw happens ONCE when the gesture ends. Two groups, not one, because the illustrated WASH sits
    // between the tiles and the linework in z-order but is a SCREEN-SPACE dimmer: it must keep covering
    // the whole viewport while the scene scales under it (inside the transform, a pinch-out shrank the
    // wash with the scene and exposed raw undimmed imagery around it - maintainer report). fx also stays
    // outside (screen-space by design, D-095).
    const mkLayer = (name, parent) => {
        const g = document.createElementNS(SVG_NS, "g");
        g.dataset.layer = name;
        parent.appendChild(g);
        return g;
    };
    const worldBack = mkLayer("worldback", svg); // tiles - transformed
    const washFixed = mkLayer("washfixed", svg); // illustrated wash/tufts - screen-fixed, between
    const worldFront = mkLayer("worldfront", svg); // grid/beds/dots/edit/chrome - transformed
    const setWorldTransform = (t) => {
        for (const g of [worldBack, worldFront]) {
            if (t)
                g.setAttribute("transform", t);
            else
                g.removeAttribute("transform");
        }
    };
    // `wash` holds the illustrated look's translucent wash/tuft rects - its own per-frame-cleared layer,
    // NOT tiles (the tile layer is never cleared; anything appended there would pile up over the imagery).
    const L = {
        tiles: mkLayer("tiles", worldBack), wash: mkLayer("wash", washFixed), grid: mkLayer("grid", worldFront),
        beds: mkLayer("beds", worldFront), dots: mkLayer("dots", worldFront), edit: mkLayer("edit", worldFront),
        chrome: mkLayer("chrome", worldFront), fx: mkLayer("fx", svg),
    };
    // D-097: the illustrated look's two patterns - grass tufts for the ground, grain for the
    // soil. Created once beside the layers; redraw never clears <defs>.
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
    // D-094: messaging split in two. toast() floats briefly - confirmations and errors only,
    // one line, gone fast. note() docks guidance (mode instructions + the R-006 reach nudge) in
    // #mapnotices ABOVE the map, in flow - persistent, never over the garden. Redraw re-asserts
    // the same text every frame - only a CHANGE resets the toast clock.
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
    // D-099: guidance is a short overlay pill, shown only while there's no shape yet (idle). The
    // moment a shape exists the #savecard takes over and this hides - so the map keeps its room.
    // Walk round 6: the pill lives in the bottom alert stack and is DISMISSIBLE like its
    // neighbours, so `noticeDismissed` suppresses it for the session once closed (the guided flag
    // in the caller already retires it permanently once this device has placed anything).
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
    // D-099: the R-006 reach nudge is its own contextual chip - shown only when a bed's shorter side
    // is beyond arm's reach, and at most ONCE per session (retireReach() sets the flag the moment the
    // user finishes with the conflicting bed, so it doesn't nag on every wide bed or every redraw).
    const reachNote = (reach) => {
        const chip = $("mapreach");
        const show = !!reach && !reachSeenSession;
        if (show && chip.dataset.sig !== reach) {
            chip.dataset.sig = reach;
            $("mapreachtext").textContent = reach;
        }
        chip.hidden = !show;
    };
    // The nudge has done its job once the user acts on the bed that raised it - retire it for the session.
    const retireReach = () => { if (!$("mapreach").hidden)
        reachSeenSession = true; };
    // R-098 (D-141): while "container" is the chosen structure, tell the user LIVE (as they size the
    // shape) when it has grown past a typical container. Shown as a map chip at the TOP (matching the
    // reach nudge's alert style), not an inline hint - the paragraph under the select grew the save card
    // (maintainer). Dismissible for the session; re-armed when the structure select changes.
    const containerChip = (msg) => {
        const chip = $("mapcontainer");
        const show = !!msg && !containerDismissed;
        if (show && chip.dataset.sig !== msg) {
            chip.dataset.sig = msg;
            $("mapcontainertext").textContent = msg;
        }
        chip.hidden = !show;
    };
    // D-141 / R-098 (maintainer): editing a bed must not let its structure become one its plants forbid -
    // a Three Sisters can't go raised, a fruit tree can't leave the ground. Grey the illegal <option>s for
    // the bed named in #areaname (app.bedStructureBlockers keys off its planted guild), with the reason on
    // the label so it reads on a phone too. The currently-selected value is never disabled (never strand a
    // saved bed); the save handler refuses an illegal CHANGE as the backstop.
    const structBaseLabels = new Map(Array.from($("bedstructure").options).map((o) => [o.value, o.textContent ?? ""]));
    const applyStructureGate = () => {
        const sel = $("bedstructure");
        const name = $("areaname").value.trim();
        const gate = name ? app.bedStructureBlockers?.(name) ?? null : null;
        const blocked = new Set(gate?.blocked ?? []);
        for (const opt of Array.from(sel.options)) {
            const base = structBaseLabels.get(opt.value) ?? opt.textContent ?? "";
            const off = blocked.has(opt.value) && opt.value !== sel.value; // never disable the current selection
            opt.disabled = off;
            opt.textContent = off ? `${base} - not for these plants` : base;
            if (off)
                opt.title = gate?.reason(opt.value) ?? "";
            else
                opt.removeAttribute("title");
        }
        // ...and SAY the reason, not only hover it (O16). A `title` is invisible to every touch user,
        // so on a phone the greyed option read "not for these plants" with no way to learn why - the
        // corpus's mechanism sentence was in the DOM and unreachable. Anchored to the control it is
        // about (D-153: rule output stays anchored, never floats), deduped because a guild usually
        // refuses several structures for one reason.
        const why = $("bedstructwhy");
        const reasons = [...new Set([...blocked]
                .filter((b) => b !== sel.value)
                .map((b) => gate?.reason(b) ?? "")
                .filter((t) => t.trim()))];
        why.textContent = reasons.join(" ");
        why.hidden = reasons.length === 0;
    };
    // #2: a CONTAINER is small (a half-barrel is ~75 cm), so its size reads in cm/in, not m/ft. The mode
    // is derived live from the structure select; only the displayed NUMBER is converted when it toggles.
    const CM_PER_IN = 2.54;
    const isContainerSize = () => $("bedstructure").value === "container";
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
    const rectDims = () => {
        const w = dimNum("shapew"), l = dimNum("shapel");
        return w && l ? [w, l] : null;
    };
    const circleR = () => {
        const d = dimNum("shaped");
        return d ? d / 2 : null;
    };
    // O101 presets. The L's notch is clamped so an arm always survives; the trough's length is
    // clamped to at least its width (shorter would be a circle, which has its own tool).
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
    // The U keeps an arm either side of its notch (>= 0.1 m each) and ground below it.
    const uDims = () => {
        const w = dimNum("uw"), l = dimNum("ul"), nw = dimNum("unw"), nl = dimNum("unl");
        if (!w || !l || !nw || !nl)
            return null;
        return { w, l, nw: Math.min(nw, w - 0.2), nl: Math.min(nl, l - 0.1) };
    };
    // Local outlines, unrotated, centred on the shape's bounding box. The L notches its NE corner -
    // the rotate handle covers every other orientation. The trough is a stadium: a rectangle with
    // semicircular ends, TROUGH_SEG segments per end (like the circle's 32-gon - real geometry
    // downstream, no new region shape).
    const lLocalPts = (w, l, nw, nl) => {
        const hw = w / 2, hl = l / 2;
        return [[-hw, hl], [hw - nw, hl], [hw - nw, hl - nl], [hw, hl - nl], [hw, -hl], [-hw, -hl]];
    };
    // The U's notch is cut into the middle of the top edge (bed-local); rotate covers the rest.
    const uLocalPts = (w, l, nw, nl) => {
        const hw = w / 2, hl = l / 2, hn = nw / 2;
        return [[-hw, hl], [-hn, hl], [-hn, hl - nl], [hn, hl - nl], [hn, hl], [hw, hl], [hw, -hl], [-hw, -hl]];
    };
    const TROUGH_SEG = 12;
    const troughLocalPts = (w, l) => {
        const r = w / 2, cyy = l / 2 - r;
        const pts = [];
        for (let i = 0; i <= TROUGH_SEG; i++) { // top end, west -> east over the crown
            const a = Math.PI - (Math.PI * i) / TROUGH_SEG;
            pts.push([r * Math.cos(a), cyy + r * Math.sin(a)]);
        }
        for (let i = 0; i <= TROUGH_SEG; i++) { // bottom end, east -> west under the keel
            const a = -(Math.PI * i) / TROUGH_SEG;
            pts.push([r * Math.cos(a), -cyy + r * Math.sin(a)]);
        }
        return pts;
    };
    /** The pending preset's outline in world metres (rotation applied), or null. */
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
    /** The pending shape's bounding-box W×L in its own frame - what the rotate and corner handles
     *  hang off, shared by rect and both presets. */
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
    // D-100: bed labels of nearby beds pile onto each other (and onto the beds). Settle them neatly:
    // sort top-to-bottom, and where one would overlap an already-placed label, nudge it straight down
    // until it clears - then back each with an opaque chip so text never bleeds onto a bed or a
    // neighbour's label. Measured against the live SVG (getBBox → viewBox units), so it tracks zoom.
    const declutterBedLabels = (labels) => {
        if (!labels.length)
            return;
        const gap = 2;
        const placed = [];
        const hits = (b, p) => b.x < p.x + p.w + gap && b.x + b.width + gap > p.x && b.y < p.y + p.h + gap && b.y + b.height + gap > p.y;
        // getBBox throws / returns zeros on an unrendered SVG (map hidden); never let that break redraw.
        try {
            for (const lab of [...labels].sort((a, b) => a.getBBox().y - b.getBBox().y)) {
                let b = lab.getBBox();
                let y = parseFloat(lab.getAttribute("y") ?? "0");
                for (let i = 0; i < 24 && placed.some((p) => hits(b, p)); i++) {
                    y += b.height + gap; // push straight down past the collision
                    lab.setAttribute("y", String(y));
                    b = lab.getBBox();
                }
                placed.push({ x: b.x, y: b.y, w: b.width, h: b.height });
                // the opaque chip, inserted BEHIND the (now-final) label
                const bg = el("rect", { class: "bedlabelbg", x: b.x - 3, y: b.y - 1, width: b.width + 6, height: b.height + 2, rx: 3 });
                lab.parentNode?.insertBefore(bg, lab);
            }
        }
        catch { /* unrendered - leave labels as placed, still functional */ }
    };
    // rotation (D-079 slice 4): a pending square carries an angle; the corner math lives in
    // groundmap/geometry.ts (rectCorners documents the TL→TR→BR→BL contract).
    const pendingCorners = (w, l) => rectCorners(pending.cx, pending.cy, w, l, pendingAngle);
    /** The ↻ handle sits a fixed 26 px off the bed-local top edge, whatever the zoom. */
    const rotHandlePos = (l, mpp) => {
        const r = rotPt(0, l / 2 + 26 * mpp, pendingAngle);
        return [pending.cx + r[0], pending.cy + r[1]];
    };
    // --- editing a SAVED bed (maintainer, walkthrough round 3): tapping a saved bed while not
    // actively drawing loads it back into the editor - move/rotate/resize a square, re-trace a
    // freeform outline - and Save (same name) replaces it. Beds are geometry, not history
    // (D-002), so replacing the shape never touches what grew there.
    const setDim = (id, metres) => {
        $(id).value = String(mToSize(metres));
    };
    // --- A4 (award-benchmark amendments): the bed POPOVER. Tapping a saved bed used to jump
    // straight into the editor; it now opens a read card first - what the bed IS (name, size,
    // structure, sun, what's growing) with the three acts: Open in Plan, Log here, Edit (one tap
    // further to the same editor, e2e 6d re-pinned on the new path). Read-only, never a drag
    // surface (D-078); Escape or any map tap dismisses; the card seats in the same bottom-left
    // slot the save card uses, inside the map frame's stacking contract.
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
        const openSeason = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
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
                // O82(c): the common name (the app's voice rule), via the same app.speciesName seam the
                // map legend already uses - "Lettuce", not the bundle-free "Lactuca sativa".
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
            // the #candbed seam is the plan's one source of truth (capstone round 28) - same wiring
            // startEditBed uses, minus the editor
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
        // O101 layout aids: the fourth act - a copy of this bed, offset one walking path, ready to place
        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "bp-link";
        dupBtn.textContent = "Duplicate";
        dupBtn.addEventListener("click", () => { closeBedPopover(); startDuplicateBed(bed); });
        acts.append(planBtn, logBtn, editBtn, dupBtn);
        bp.appendChild(acts);
        bp.hidden = false;
        planBtn.focus({ preventScroll: true }); // keyboard-reachable from the first paint
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape")
        closeBedPopover(); });
    // O101: recognise a saved preset so tap-to-edit reopens its parametric editor rather than the
    // raw corner trace. Both recognisers work on the UNROTATED outline; a rotation_deg bed is
    // un-rotated about its centroid first and the angle rides back in as pendingAngle. A shape that
    // doesn't match keeps the legacy fallback (corner trace) - never a wrong parametric read.
    const recogniseL = (pts) => {
        if (pts.length !== 6)
            return null;
        const eps = 0.02;
        for (let i = 0; i < 6; i++) {
            const a = pts[i], b = pts[(i + 1) % 6];
            if (Math.abs(a[0] - b[0]) > eps && Math.abs(a[1] - b[1]) > eps)
                return null; // not rectilinear
        }
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        // exactly one vertex strictly inside the bbox - the notch's inner corner - and the preset
        // notches NE, so the bbox's NE corner must be absent from the outline
        const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
        if (inner.length !== 1)
            return null;
        if (pts.some((p) => Math.abs(p[0] - maxX) < eps && Math.abs(p[1] - maxY) < eps))
            return null;
        return { w: maxX - minX, l: maxY - minY, nw: maxX - inner[0][0], nl: maxY - inner[0][1],
            cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    };
    const recogniseTrough = (pts) => {
        if (pts.length !== (TROUGH_SEG + 1) * 2)
            return null;
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const w = maxX - minX, l = maxY - minY, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        if (l < w - 0.02)
            return null;
        const expect = troughLocalPts(w, l); // same generator, same point order as the save
        for (let i = 0; i < pts.length; i++) {
            if (Math.hypot(pts[i][0] - cx - expect[i][0], pts[i][1] - cy - expect[i][1]) > 0.05)
                return null;
        }
        return { w, l, cx, cy };
    };
    const recogniseU = (pts) => {
        if (pts.length !== 8)
            return null;
        const eps = 0.02;
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const w = maxX - minX, l = maxY - minY, ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
        // the notch's two floor corners are the only vertices strictly inside the bbox, and the save's
        // point order starts at the outer TL - so derive the params and compare against the generator
        // (same yes-only-to-our-own-shape rule as the trough's recogniser)
        const inner = pts.filter((p) => p[0] > minX + eps && p[0] < maxX - eps && p[1] > minY + eps && p[1] < maxY - eps);
        if (inner.length !== 2)
            return null;
        const nw = Math.abs(inner[1][0] - inner[0][0]), nl = maxY - inner[0][1];
        if (nw < 0.05 || nl < 0.05)
            return null;
        const expect = uLocalPts(w, l, nw, nl);
        for (let i = 0; i < 8; i++) {
            if (Math.hypot(pts[i][0] - ccx - expect[i][0], pts[i][1] - ccy - expect[i][1]) > 0.05)
                return null;
        }
        return { w, l, nw, nl, cx: ccx, cy: ccy };
    };
    const unrotatePts = (pts, angle) => {
        const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        return pts.map(([x, y]) => { const r = rotPt(x - mx, y - my, -angle); return [mx + r[0], my + r[1]]; });
    };
    const startEditBed = (bed) => {
        const region = bed.region;
        const pts = regionPoints(region);
        const midx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const midy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        // set the structure FIRST so the size inputs (below) render in the right unit - a container's size
        // is cm/in, everything else m/ft (isContainerSize reads this select).
        $("bedstructure").value = bed.structure ?? "in_ground";
        prevStructure = $("bedstructure").value;
        $("bedlanes").value = bed.lane_flip ? "flip" : "";
        refreshSizeUnitDisplay();
        if (isLattice(region)) {
            // a painted (or on-lattice) bed reopens in the painter, losslessly - rasterize is
            // outline's exact inverse on lattice shapes (paint.ts). Checked BEFORE the circle
            // heuristic: lattice wins. Other shapes keep their legacy editors forever.
            setMode("paint");
            paintCell = latticeCell(region); // re-edit on the grid the bed was painted on, so its tiles align
            paintCells = rasterize(pts, paintCell);
            paintTool = "move"; // an EXISTING bed opens in MOVE - drag it / rotate it; tap paint/erase to reshape
            syncPaintToolButtons();
            scheduleRedraw();
        }
        else if (region.shape === "rect") {
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
            // O101: a saved preset reopens parametrically. Un-rotate a rotation_deg polygon first; the
            // recognisers only ever say yes to their own generator's shape, so a miss falls through to
            // the legacy editors below.
            const ang = bed.rotation_deg ?? 0;
            const up = ang ? unrotatePts(pts, ang) : pts;
            const lrec = recogniseL(up);
            const urec = lrec ? null : recogniseU(up);
            const trec = lrec || urec ? null : recogniseTrough(up);
            // a saved circle is a 32-gon of equal radii - recover centre + diameter; anything else
            // reopens as a corner trace (drag the corners, tap to add more)
            const radii = pts.map((p) => Math.hypot(p[0] - midx, p[1] - midy));
            const mean = radii.reduce((a, r) => a + r, 0) / radii.length;
            if (lrec) {
                setMode("lbed");
                setDim("lw", lrec.w);
                setDim("ll", lrec.l);
                setDim("lnw", lrec.nw);
                setDim("lnl", lrec.nl);
                pendingAngle = ang;
                // the world centre from the saved first vertex (local TL corner), so the rotated shape
                // re-projects exactly where it was saved
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
        $("areaname").value = bed.name;
        $("bedsun").value = bed.sun ?? ""; // declared exposure (R-005) rides the edit
        // O101 (the middle path): Edit lands FRAMED - centre on the bed and fit it the way the
        // post-save reveal does, so the shape arrives at working size with its handles up, instead of
        // rotate-knob-sized in a wide view.
        {
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            if (anchorLat != null) {
                const bw = Math.max(0.5, Math.max(...xs) - Math.min(...xs));
                const bh = Math.max(0.5, Math.max(...ys) - Math.min(...ys));
                // Walk round 1 (O113): the EDIT fit sits wider than the browse/save fits (0.45 vs 0.62).
                // Editing means repositioning - the shape needs surroundings to move within, and at 0.62
                // its handles sat exactly where a thumb grabs the body ("defaults to resizing").
                zoom = fitZoom(anchorLat, bw, bh, 0.45);
            }
        }
        notice = `editing "${bed.name}" - adjust it, then save (same name replaces the shape; what grew here stays put).`;
        // Capstone (round 28, revised): tapping a saved bed selects it for the plan - #candbed is the
        // plan's one source of truth, its change handler re-renders everything (guilds AND the mybed
        // panel) for the chosen bed. WIDE screens also open the "Plant teams for this bed" step - the
        // curated recommendations surface, with the map still beside them in its own panel.
        // On a PHONE (production fix, 2026-07-24): stay in / open "Your ground" - the ground-editing
        // step - instead. Opening step-plan (a browse step under the round-7 framed-map regime)
        // collapsed the map to the tiny framed panel with the just-loaded shape stranded on it and the
        // sheet inert; the next tap on the panel re-placed the shape, reading as "a new bed instead of
        // editing". Editing a bed IS map work; Plant teams stays one path-bar tap away, already on
        // this bed via #candbed.
        const cand = document.getElementById("candbed");
        if (cand && Array.from(cand.options).some((o) => o.value === bed.name)) {
            const wide = matchMedia("(min-width: 900px)").matches;
            const step = document.getElementById(wide ? "step-plan" : "sec-ground");
            if (step)
                step.open = true; // the toggle handler flips browse/edit, lifts, scrolls
            if (cand.value !== bed.name) {
                cand.value = bed.name;
                cand.dispatchEvent(new Event("change")); // → draw(): re-renders the plan for this bed
            }
        }
        void redraw();
    };
    // O101 layout aids: DUPLICATE a saved bed. The same loading startEditBed does (parametric via
    // the recognisers where the shape allows), then turned into a COPY: the name blanks (saving
    // creates a new bed, never replaces this one, and the original's outline stays visible under
    // the copy) and the shape offsets one bed-width plus the R-098 walking path east, so the copy
    // lands beside the original with the exact gap the magnet holds. Sun and structure ride along
    // on the selects; the planted flag does not (a new name never inherits it - a copy is fresh
    // ground).
    const startDuplicateBed = (bed) => {
        startEditBed(bed);
        $("areaname").value = "";
        const pts = regionPoints(bed.region);
        const xs = pts.map((p) => p[0]);
        const dx = Math.max(...xs) - Math.min(...xs) + PATH_M;
        if (pending)
            pending = { cx: pending.cx + dx, cy: pending.cy };
        else if (tracePts.length)
            tracePts = tracePts.map(([x, y]) => [x + dx, y]);
        else if (paintCells.size) {
            const di = Math.max(1, Math.round(dx / paintCell));
            paintCells = new Set([...paintCells].map((k) => { const [i, j] = k.split(",").map(Number); return cellKey(i + di, j); }));
            paintFresh = new Set();
        }
        cx += dx / 2; // keep the original and the copy in frame together
        notice = `a copy of "${bed.name}" - drag it into place (a ${fmtLen(PATH_M)} path snaps in), then name it and save.`;
        void redraw();
    };
    /** The saved bed under a tapped plot point, topmost first - or null. */
    // The saved bed under a point. Strict by default (topmost bed the point falls inside). With a
    // positive `tolM` it also grabs the nearest bed whose edge is within that world-distance of the
    // point - a touch-target margin so a near-miss tap still selects an existing bed to edit, instead of
    // dropping a new square the user then has to discard (maintainer: beds were hard to tap on a phone).
    const bedAt = (xm, ym, tolM = 0) => {
        for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) {
            if (pointInPolygon(xm, ym, regionPoints(app.logSnapshot.beds[i].region)))
                return app.logSnapshot.beds[i];
        }
        if (tolM > 0) {
            let best = null, bestD = tolM;
            for (let i = app.logSnapshot.beds.length - 1; i >= 0; i--) { // top-down: the topmost bed wins a tie
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
    // Redraws are SERIALIZED: redrawCore awaits IndexedDB, and two overlapping calls could interleave -
    // the older one resuming after the newer finished and painting STALE geometry over it (visible
    // glitching during pans/zoom bursts). One runs at a time; a request landing mid-draw coalesces into
    // exactly one follow-up.
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
        // reuse the cached plot for the frames of an active pan/pinch (the ground can't change mid-gesture);
        // every other redraw refetches, so an edit is never missed.
        const reuse = lastPlot !== null && lastPlotId === pid
            && (gesture === "pan" || gesture === "pinch" || gesture === "paintmove" || Date.now() - lastPlotAt < 120);
        const plot = reuse ? lastPlot : (await getPlot(db, pid)) ?? null;
        if (!reuse) {
            lastPlot = plot;
            lastPlotId = pid;
            lastPlotAt = Date.now();
        }
        let anchor = plot?.anchor ?? null;
        const ll = latlon();
        if (!anchor && ll) {
            // FIRST placement: paint the pin from the TYPED coordinates on THIS frame - do NOT await the
            // IndexedDB write first. Awaiting it left a grid-then-pin dead beat: the sheet updated at once
            // but the map sat on the grid for ~150 ms and then snapped to imagery+pin (the "stutter" the
            // maintainer saw as the map committed). setPlotAnchorOnce writes exactly this ll, so the
            // optimistic anchor equals what a reload would read; the typed address is captured in the same
            // background write. (walk round 9: land wide enough to recognise the place.)
            anchor = { lat: ll.lat, lon: ll.lon };
            zoom = LOCATE_ZOOM;
            const typedAddr = document.getElementById("addr")?.value.trim() || undefined;
            void setPlotAnchorOnce(db, plotId(), ll.lat, ll.lon, typedAddr);
        }
        anchorLat = anchor?.lat ?? 45; // grid mode: gestures use the virtual frame's scale
        anchorLL = anchor ?? null;
        anchorBeds = plot?.beds.length ?? 0;
        // self-heal: if the view centre was ever NaN-poisoned (a division by a mid-layout zero-size
        // box - now guarded, but belt and braces), recover to the origin instead of staying blank
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
            cx = 0;
            cy = 0;
        }
        // clear every layer except fx (D-095, in-flight effects outlive the repaint) and tiles (drawTiles
        // reconciles its own <image> pool so a pan repositions tiles instead of rebuilding + re-decoding them)
        for (const g of [L.wash, L.grid, L.beds, L.dots, L.edit, L.chrome])
            g.replaceChildren();
        // sync the world transform IN this paint: an active gesture keeps its live transform (this frame
        // repaints the gesture-start view it maps from); a committed one clears it in the same synchronous
        // block as the committed frame, so release never flashes the pre-gesture position.
        if (gestTx !== 0 || gestTy !== 0 || gestScale !== 1)
            applyWorldTransform();
        else
            setWorldTransform(null);
        const viewport = $("mapviewport");
        // GRID MODE (declutter round, approved 2026-07-30): beds live in plot metres, so the canvas
        // works BEFORE any address - a neutral grid at a virtual frame (lat 45, view math only,
        // NEVER stored). Imagery is what the address buys: gridMode skips the tile layer and wears
        // its own class (CSS hides the imagery layer chips; tools and zoom stay). The old #mapempty
        // invitation dies with this - the canvas itself is the invitation.
        const gridMode = !anchor;
        const frame = anchor ?? { lat: 45, lon: 0 }; // the view frame: real anchor, or the virtual grid frame
        viewport.classList.remove("empty");
        viewport.classList.toggle("gridmode", gridMode);
        // O113 N4: past even the speculative tile ceiling no provider has real pixels left, so the
        // map stops pretending - `deepzoom` steps the metre grid up and the frame reads as a
        // deliberate drawing surface over the softened photo, not a failed zoom.
        viewport.classList.toggle("deepzoom", zoom >= 22.4);
        // A resolved location far from the anchor usually means the anchor landed badly (a ZIP
        // centroid, a test pin). Offer the escape hatch; storage enforces the empty-plot rule.
        {
            const btn = $("reanchor");
            if (ll && !gridMode) { // the virtual frame is not a place - never offer to "move" to it
                const [dx, dy] = toLocal(frame, ll.lat, ll.lon);
                btn.hidden = Math.hypot(dx, dy) < 25;
            }
            else
                btn.hidden = true;
            // a hidden button (location back at the anchor) disarms + relabels, so it never reappears mid-confirm
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
        // The viewBox tracks the element's real aspect (D-079 follow-up): width stays 440 units,
        // height follows the CSS box, so the map FILLS the viewport instead of letterboxing square.
        {
            const bb = svg.getBoundingClientRect();
            if (bb.width > 0 && bb.height > 0)
                viewH = Math.max(80, Math.round(VIEW * (bb.height / bb.width)));
            svg.setAttribute("viewBox", `0 0 ${VIEW} ${viewH}`);
        }
        // Fit the view to the beds the FIRST time we draw a given plot (per-plot, so it lands you on your
        // ground on login / example / garden-switch, but never re-centres while you pan within a garden).
        if (lastFitPlotId !== plotId()) {
            const bedPts = (plot?.beds ?? []).flatMap((bed) => regionPoints(bed.region));
            if (bedPts.length) {
                const xs = bedPts.map((p) => p[0]), ys = bedPts.map((p) => p[1]);
                const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
                cx = (minX + maxX) / 2;
                cy = (minY + maxY) / 2; // centre on the beds' bounding box
                const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
                // leave real ground around the beds: the padding fit solves the exact zoom (O113 N2)
                zoom = fitZoom(frame.lat, w, h);
            }
            else {
                // A bedless garden frames on its anchor - carrying the previous garden's pan offset into a
                // different plot's frame pointed the view at arbitrary ground on every switch (D-152).
                cx = 0;
                cy = 0;
            }
            lastFitPlotId = plotId();
        }
        const mpp = metresPerPixel(frame.lat, zoom);
        const spanX = VIEW * mpp, spanY = viewH * mpp;
        const span = Math.max(spanX, spanY); // tile cover for the longer axis; extras clip
        const toPx = (xm, ym) => [VIEW / 2 + (xm - cx) / mpp, viewH / 2 - (ym - cy) / mpp];
        // D-100: keep the save celebration glued to the bed. The outline + leaves sit in the never-
        // cleared fx layer, so a resize/pan mid-animation would otherwise leave them where the bed
        // USED to be. Re-project them through the current transform every frame.
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
        // The map's face (D-097, tuned by maintainer feedback): illustrated (Meadow) by default,
        // but the photo ALWAYS ghosts through the wash - the user must recognise the space as
        // THEIR yard (roof, drive, trees), and a bed on the map must visibly match the physical
        // spot. Working with beds (`.tracing`, the same step sections that show the mapbar) just
        // thins the wash and wakes the grid; the chip pins the classic photo-first view.
        const working = !!document.querySelector("#sec-ground[open], #step-plan[open], #step-mybed[open], #sec-addplant[open]");
        const illustrated = look === "illustrated";
        viewport.classList.toggle("illustrated", illustrated);
        viewport.classList.toggle("tracing", illustrated && working);
        // imagery under everything (groundmap/imagery.ts): Google satellite when a key + session
        // exist, else keyless Esri; a failed tile just leaves the (illustrated or plain) ground
        // showing through, and the render never waits on Google. Attribution follows the pixels -
        // the photo now draws in every look, so the line always stands.
        if (gridMode) {
            // imagery is what the address buys - the grid (below) carries the ground until then
            L.tiles.replaceChildren();
            $("mapattrib").textContent = locating()
                ? "type your address below - the satellite view arrives with it, and your pin drops here"
                : "your ground - the satellite view arrives with your address";
        }
        else {
            // leaving grid mode: drop the grid-mode invite NOW rather than waiting for the first tile
            // to load (walk round 3: "the satellite view arrives with your address" survived the
            // address) - the tile pool's load/error handlers own the line from here.
            const at = $("mapattrib");
            if (at.textContent.includes("satellite view arrives"))
                at.textContent = "";
            drawTiles({
                // which whole levels actually fetch (base + the DPR/deep enhance pass) is drawTiles' own
                // tilePlan (O113 N4); the fractional zoom (N1) rides through untouched.
                svg: L.tiles, anchor: frame, cx, cy, span, zoom, mpp, toPx,
                attrib: at, requestRedraw: () => void redraw(),
            });
        }
        if (illustrated) {
            // the illustration: a translucent wash over the photo, then the tufts - stronger while
            // browsing (meadow-dominant, yard still legible), thinner while tracing beds. In L.wash (cleared
            // every frame), never L.tiles - the tile pool persists, so a wash there would stack up over the
            // imagery until it vanished (the reported "map not visible, only the grid").
            L.wash.appendChild(el("rect", { class: "illwash", x: 0, y: 0, width: VIEW, height: viewH }));
            L.wash.appendChild(el("rect", { class: "illtufts", x: 0, y: 0, width: VIEW, height: viewH, fill: "url(#tuftpat)" }));
        }
        // metre grid: 5 m lines, aligned to the local frame (visible wherever tiles are absent,
        // faint over imagery - the frame stays legible either way)
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
        // O101: while a shape is being WORKED, a fine grid at the working snap (0.1 m - the lattice
        // every drag and nudge actually lands on) draws under it, stepping up to 1 m when 0.1 m lines
        // would sit closer than ~7 px. Browsing keeps the calm 5 m frame; no shape, no fine grid.
        const shaping = pending != null || tracePts.length > 0
            || (mode === "paint" && paintCells.size > 0) || gesture === "draw";
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
        // THE PIN (walk round 3, maintainer: "no pin is dropping" - there was literally no pin glyph).
        // In Where mode a located point draws as a real map pin at the location the lat/lon state
        // holds: it lands when an address commits, and a tap moves it. Chrome layer, above everything.
        // The pin draws only while it is ACTIONABLE - locate mode, a real frame, and a garden with
        // no beds yet (maintainer, twice): once beds anchor the ground, THEY show where the garden
        // is, and a frozen pin sitting beside them just reads as a stray marker. The tap handler
        // still explains the frozen state if someone taps the map here.
        if (locating() && ll && !gridMode && anchorBeds === 0) {
            const [px, py] = toPx(...toLocal(frame, ll.lat, ll.lon));
            const pin = el("g", { class: "locpin" });
            pin.appendChild(el("path", { class: "locpin-body",
                d: `M ${px} ${py} c -7 -14 -12 -18 -12 -26 a 12 12 0 1 1 24 0 c 0 8 -5 12 -12 26 z` }));
            pin.appendChild(el("circle", { class: "locpin-eye", cx: px, cy: py - 26, r: 4.5 }));
            L.chrome.appendChild(pin);
        }
        // saved areas: outlines + name at centroid; the label also carries what the open season's
        // PLAN says goes here (D-079 slice 6 - the map is the hub, not just a tracing surface)
        const openSeason = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
        if (layerState.areas) {
            const planFor = new Map();
            for (const e of (Array.isArray(openSeason?.plan) ? openSeason.plan : [])) {
                if (typeof e.area === "string" && typeof e.guild === "string")
                    planFor.set(e.area, e.guild);
            }
            const labelEls = [];
            // ISSUES #12 sub-sections: "<bed> N" is a section of "<bed>" when that parent bed exists. A section
            // label sits INSIDE its own strip so stacked/side-by-side sections each read clearly. Once a bed has
            // sections it is a pure CONTAINER (the plan lives in the sections, so it is not itself plannable) -
            // its whole-bed label is marked "(sections)" and never shows a "· planned" (a stale pre-split plan
            // stays inert). Same section reading as the plan pickers (plan.ts helpers).
            const allBeds = plot?.beds ?? [];
            const bedNames = new Set(allBeds.map((b) => b.name));
            // A4: a bed's fill follows the active tint layer. Season and sun read straight off the bed
            // and the open season; soil reads the ledger's observations (plot-level records describe
            // all their ground); rotation asks the app seam (bundle work the map cannot do itself).
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
            // O101: while a bed is being EDITED its saved outline hides - the pending shape IS that bed
            // now, and the old outline ghosting underneath read as a double (maintainer-reported class
            // of confusion; matched by name, since a re-save under the same name is what replaces it).
            const editingName = ($("areaname").value ?? "").trim();
            const shapeInProgress = pending != null || tracePts.length > 0 || (mode === "paint" && paintCells.size > 0);
            for (const bed of plot?.beds ?? []) {
                if (shapeInProgress && editingName && bed.name === editingName)
                    continue;
                const cs = regionPoints(bed.region);
                const ptsAttr = cs.map(([x, y]) => toPx(x, y).join(",")).join(" ");
                L.beds.appendChild(el("polygon", { class: `savedbed ${tintClass(bed)}`, points: ptsAttr }));
                if (illustrated)
                    L.beds.appendChild(el("polygon", { points: ptsAttr, fill: "url(#grainpat)" }));
                // D-141: draw the bed's reserved access bands (field lanes / raised-bed paths) so the space is
                // defined right on the map - a faint dashed lane per band. Empty for container/in_ground/within
                // reach, so only field and wide raised beds show them; computed from geometry (no plants needed).
                // EXCEPT a bed whose planned team lays out as MOUNDS (maintainer, fill round 3): the hills
                // placement reserves nothing - the mounds themselves are the access, you step between them
                // (R-098) - so the map drawing a walkway the planting ignores read as a contradiction. With no
                // team planned yet the structural preview stands (that is what a row/grid team would reserve).
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
                const isSection = sectionParentName(bed.name, bedNames) !== null;
                const isContainer = !isSection && bedHasSections(bed.name, allBeds);
                const base = isContainer ? `${bed.name} (sections)` : bed.name;
                let label;
                if (isSection) {
                    // inside its own strip, vertically centred - so each section's name stays on its area
                    const midy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
                    const [, cy] = toPx(midx, midy);
                    label = el("text", { class: "bedlabel", x: tx, y: cy, "dominant-baseline": "central" });
                }
                else {
                    // the whole-bed label floats just ABOVE the bed (round 8): across the middle it collided with
                    // the plant dots at close zoom
                    const pys = cs.map(([x, y]) => toPx(x, y)[1]);
                    label = el("text", { class: "bedlabel", x: tx, y: Math.min(...pys) - 6 });
                }
                label.textContent = planned && !isContainer ? `${base} · ${humanize(planned)} planned` : base;
                L.beds.appendChild(label);
                labelEls.push(label);
            }
            declutterBedLabels(labelEls);
        }
        // the APPLIED PLAN, projected onto ground (walkthrough round 5): hollow dots per planned
        // plant, so applying a guild shows its layout in the bed right on the map. Same layer as
        // the plantings - planned (hollow) vs planted (filled).
        // A colour alone doesn't say what a plant IS (walkthrough round 6), so every species that
        // gets a dot also gets a legend row (hollow/filled swatch matching the dots). Names on the
        // dots themselves were tried and REMOVED (round 7): at real planting density they crowd
        // into soup - the legend and the per-dot tooltip carry the names instead.
        // Colours (round 9): the fixed 8-slot colourblind-safe palette in groundmap/palette.ts,
        // assigned by first appearance per draw. The safety rationale lives with the palette.
        const colorOf = colorAssigner();
        const legend = new Map();
        const dotKeys = new Set();
        let popIx = 0; // stagger the pops so a whole applied plan ripples in
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
                const dot = el("circle", { class: prevDotKeys && !prevDotKeys.has(k) ? "plandot pop" : "plandot", cx: px, cy: py, r: 4, stroke: c });
                if (prevDotKeys && !prevDotKeys.has(k))
                    dot.style.animationDelay = `${Math.min(popIx++, 20) * 45}ms`;
                const tip = document.createElementNS(SVG_NS, "title");
                tip.textContent = `planned: ${name}`;
                dot.appendChild(tip);
                L.dots.appendChild(dot);
            }
        }
        // the open season's plantings, each at its real ground position - occupancy made visible.
        // Colour is the species' palette slot; the native tooltip names the plant.
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
                    continue; // off-view
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
        // the legend - behind the ● key chip (D-094), rebuilt each redraw. It names every species
        // with a dot this draw (on- or off-view), so panning never makes it lie. As a tap-to-reveal
        // scrollable panel it always fits, so the old fit-or-hide dance (rounds 7-10) is gone.
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
            kt.textContent = `● key · ${legend.size}`;
            lg.hidden = !(hasKey && keyOpen);
        }
        // the painted tiles (D-096): re-projected each redraw; only the cells added since the
        // last draw carry the pop animation, so pans and repaints stay calm
        if (mode === "paint" && paintCells.size) {
            for (const k of paintCells) {
                const [i, j] = k.split(",").map(Number);
                const [px, py] = toPx(i * paintCell, (j + 1) * paintCell); // NW corner (plot +y is north/up)
                L.edit.appendChild(el("rect", {
                    class: paintFresh.has(k) ? "pcell pop" : "pcell",
                    x: px, y: py, width: paintCell / mpp, height: paintCell / mpp,
                }));
            }
            paintFresh = new Set();
        }
        // the in-progress trace, with every edge's length labelled (closing edge included)
        if (mode === "corner" && tracePts.length) {
            const pts = tracePts.map(([x, y]) => toPx(x, y).join(",")).join(" ");
            L.edit.appendChild(el(tracePts.length >= 3 ? "polygon" : "polyline", { class: "trace", points: pts }));
            for (const [x, y] of tracePts) {
                const [px, py] = toPx(x, y);
                // visual dot; the grab target is 44 px (see vertexAt) - corners are draggable
                L.edit.appendChild(el("circle", { class: "v", cx: px, cy: py, r: 7 }));
            }
            const edges = tracePts.length >= 3 ? tracePts.length : tracePts.length - 1;
            for (let i = 0; i < edges; i++) {
                const a = tracePts[i], b = tracePts[(i + 1) % tracePts.length];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                if (len < 0.05)
                    continue;
                const [mx, my] = toPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                const t = el("text", { class: "dimlabel", x: mx, y: my - 4 });
                t.textContent = fmtLen(len);
                L.edit.appendChild(t);
            }
        }
        // the pending square/circle, dims shown at the centre; a square carries a ↻ rotate handle
        if (mode === "rect" && pending) {
            const d = rectDims();
            if (d) {
                const [w, l] = d;
                const pts = pendingCorners(w, l).map(([x, y]) => toPx(x, y).join(",")).join(" ");
                L.edit.appendChild(el("polygon", { class: "trace", points: pts }));
                const [tx, ty] = toPx(pending.cx, pending.cy);
                const t = el("text", { class: "dimlabel", x: tx, y: ty });
                t.textContent = `${fmtLen(w)} × ${fmtLen(l)}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                L.edit.appendChild(t);
                // the rotate handle: a stem from the bed-local top edge to a grabbable ↻ knob
                const topMid = rotPt(0, l / 2, pendingAngle);
                const [sx, sy] = toPx(pending.cx + topMid[0], pending.cy + topMid[1]);
                const [hx, hy] = toPx(...rotHandlePos(l, mpp));
                L.edit.appendChild(el("line", { class: "rotstem", x1: sx, y1: sy, x2: hx, y2: hy }));
                L.edit.appendChild(el("circle", { class: "rot", cx: hx, cy: hy, r: 12 }));
                const glyph = el("text", { class: "rotglyph", x: hx, y: hy + 4 });
                glyph.textContent = "↻";
                L.edit.appendChild(glyph);
                // O101 resize handles: a grabbable dot on each corner (same face as trace vertices; the
                // grab target is 22 px radius in resizeHandleAt, a 44 px touch target)
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
                const t = el("text", { class: "dimlabel", x: px, y: py });
                t.textContent = `⌀ ${fmtLen(2 * r)}`;
                L.edit.appendChild(t);
                // O101: the circle's one radius handle, drawn at the east point; the drag sets the radius
                // by distance from the centre, so it works from any direction once grabbed
                const [ex, ey] = toPx(pending.cx + r, pending.cy);
                L.edit.appendChild(el("circle", { class: "v", cx: ex, cy: ey, r: 7 }));
            }
        }
        // O101 presets: the pending L-bed / U-bed / trough - outline, dims at the centre, the shared
        // rotate handle off the bounding box, corner handles (the L skips its notch-void corner and
        // wears the notch's own handle on the inner corner instead; the U keeps all four and wears its
        // notch handle on the notch floor's right corner)
        if ((mode === "lbed" || mode === "ubed" || mode === "trough") && pending) {
            const pts = presetWorldPts(), bb = pendingBBox();
            if (pts && bb) {
                L.edit.appendChild(el("polygon", { class: "trace", points: pts.map(([x, y]) => toPx(x, y).join(",")).join(" ") }));
                const [tx, ty] = toPx(pending.cx, pending.cy);
                const t = el("text", { class: "dimlabel", x: tx, y: ty });
                t.textContent = `${fmtLen(bb[0])} × ${fmtLen(bb[1])}${pendingAngle ? ` · ${pendingAngle}°` : ""}`;
                L.edit.appendChild(t);
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
                        continue; // the notch void
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
        // O101 layout aids: while a drag is snapped, the magnet draws its guide along the bed edge
        // it snapped to - the visible reason the shape just clicked into place.
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
        // compass (top-right - the layer chips own the top-left corner) + scale bar (10 m)
        const compass = el("text", { class: "compass", x: VIEW - 8, y: 18, "text-anchor": "end" });
        compass.textContent = "N ↑";
        L.chrome.appendChild(compass);
        L.chrome.appendChild(el("line", { class: "scale", x1: 10, y1: viewH - 12, x2: 10 + 10 / mpp, y2: viewH - 12 }));
        const scale = el("text", { class: "scalelabel", x: 12, y: viewH - 18 });
        scale.textContent = "10 m";
        L.chrome.appendChild(scale);
        // D-094: an action result toasts; the mode guidance docks. The two no longer compete -
        // "saved" can float while the instructions stay readable above the map.
        if (notice) {
            toast(notice);
            notice = null; // shown once; the toast fades on its own clock
        }
        // D-099: make → name → save. While there's no shape yet, a short guidance pill hovers on the
        // map; the moment a shape exists it hides, the #savecard slides in with the live size + name +
        // save, and the R-006 reach nudge (if any) shows as its own dismissible chip.
        let hasShape = false, guidance = "", sizeText = "", reach = null;
        // Largest span of the shape (its bounding box's longer side) - what the R-098 container advisory
        // measures. Tracked live so the container hint can fire while the user is still sizing the shape.
        let contSpan = null;
        if (mode === "paint") {
            hasShape = paintCells.size > 0;
            if (!hasShape) {
                guidance = paintTool === "move"
                    ? "Move the map to frame your bed, then tap paint to lay tiles."
                    : "Drag one finger to paint a bed, tile by tile. Tap move to reposition the map.";
            }
            else {
                let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
                for (const k of paintCells) {
                    const [i, j] = k.split(",").map(Number);
                    i0 = Math.min(i0, i);
                    i1 = Math.max(i1, i);
                    j0 = Math.min(j0, j);
                    j1 = Math.max(j1, j);
                }
                // R-006 reach on the bounding box's shorter side - same yardstick minReachSpanM uses
                reach = app.bedReachNote?.(Math.min(i1 - i0 + 1, j1 - j0 + 1) * paintCell) ?? null;
                contSpan = Math.max(i1 - i0 + 1, j1 - j0 + 1) * paintCell;
                sizeText = `${paintCells.size} tiles · ${fmtArea(paintCells.size * paintCell * paintCell)}`;
            }
        }
        else if (mode === "rect") {
            hasShape = pending != null;
            const d = rectDims();
            // R-006: a bed whose SHORTER side is over reach can't be tended from the edges - nudge toward a
            // second bed (the corpus supplies threshold + wording).
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
                        // R-006 on the polygon itself - an L's reach is its arms', not its bounding box's
                        reach = app.bedReachNote?.(minReachSpanM({ shape: "polygon", points: lLocalPts(d.w, d.l, d.nw, d.nl) })) ?? null;
                        sizeText = `= ${fmtArea(d.w * d.l - d.nw * d.nl)}`;
                    }
                }
                else if (mode === "ubed") {
                    const d = uDims();
                    if (d) {
                        // same rule for the U - its reach is its arms', not its bounding box's
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
        // The guidance pill shows ONCE per device (walk round 5, maintainer: it covered the map).
        // First-time instructions stay - a stranger does need "tap to drop a square" - but the moment
        // this device has placed any shape or holds any bed, the map speaks for itself.
        let guided = anchorBeds > 0;
        try {
            guided = guided || localStorage.getItem("gg-map-guided") === "1";
        }
        catch { /* show it */ }
        if (hasShape) {
            try {
                localStorage.setItem("gg-map-guided", "1");
            }
            catch { /* fine */ }
        }
        note(hasShape || guided ? "" : guidance);
        reachNote(hasShape ? reach : null);
        // R-098 container advisory, live: only for the "container" structure, only once the shape exists
        // and its contSpan is known, and only when the corpus threshold is exceeded (app.bedContainerNote).
        const structVal = $("bedstructure").value;
        containerChip(hasShape && structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null);
        // O101: the pending outline wears the verdict the chips explain (styles.css .trace-ok/-warn) -
        // terracotta while a critique stands, sage when the rules are content. Read from the raw rule
        // results, not the chips' once-per-session dismissal state: the object keeps telling the truth
        // after the words have been put away. Advisory colour only; saving is never blocked.
        if (hasShape) {
            const contFlag = structVal === "container" && contSpan != null ? app.bedContainerNote?.(contSpan) ?? null : null;
            const cls = reach || contFlag ? "trace-warn" : "trace-ok";
            L.edit.querySelectorAll(".trace").forEach((n) => n.classList.add(cls));
        }
        // Grey any structure the bed's planted guild forbids (keyed to the name in #areaname) - live, so it
        // tracks an edit loading a bed and a name typed for a re-save.
        applyStructureGate();
        $("sizereadout").textContent = sizeText;
        $("savecard").hidden = !hasShape;
        renderAreaList(plot ?? null);
        void renderPlotBar();
    };
    // The address bar (D-023): one plot per address, each with its own ledger. The default
    // plot renders as "Home" until named.
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
            // name (+ default marker) only - the address is long and now shown in the active-garden banner and
            // the Log, so keeping it here just overflowed the select (walkthrough). A SHARED garden (D-172,
            // owned by a teammate) is tagged so two identically-named "Home" gardens are told apart.
            o.textContent = (p.name ?? homeName(p.id)) + (p.id === def ? " (default)" : "") + (p.shared ? ` (${copy.teamsSharedTag})` : "");
            sel.appendChild(o);
        }
        sel.value = current;
        // The Plan-side garden chip (declutter round): garden MANAGEMENT lives on the Log now, and a
        // single-garden user sees no garden chrome at all - this one line appears only when more
        // than one garden exists, naming the active one and pointing at the Log to switch.
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
        for (const bed of plot?.beds ?? []) {
            const row = document.createElement("p");
            row.className = "arearow";
            const npts = bed.region.shape === "polygon" ? bed.region.points.length : 4;
            const kind = bed.region.shape !== "polygon" ? "rectangle"
                : npts === 4 ? "rectangle"
                    : npts === 6 ? "L-bed"
                        : npts === 8 ? "U-bed"
                            : npts === (TROUGH_SEG + 1) * 2 ? "trough"
                                : npts === 32 ? "circle" : `${npts} corners`;
            const shape = bed.rotation_deg ? `${kind} · ${bed.rotation_deg}°` : kind;
            row.textContent = `${bed.name} - ${shape}, ${fmtArea(regionArea(bed.region))} `;
            const ed = document.createElement("button");
            ed.type = "button";
            ed.textContent = "edit";
            ed.addEventListener("click", () => startEditBed(bed));
            row.appendChild(ed);
            row.appendChild(document.createTextNode(" "));
            // O101 layout aids: duplicate from the list too (desktop's natural surface for it)
            const dup = document.createElement("button");
            dup.type = "button";
            dup.textContent = "duplicate";
            dup.title = `a copy of "${bed.name}", one walking path over - name it and save`;
            dup.addEventListener("click", () => startDuplicateBed(bed));
            row.appendChild(dup);
            row.appendChild(document.createTextNode(" "));
            const rm = document.createElement("button");
            rm.type = "button";
            rm.textContent = "remove";
            // Removal is destructive: storage.removeBed takes the bed AND its open-season plants + plan
            // entry with it. An EMPTY DRAFT bed removes on a single tap - that's the initial-config play
            // we want to keep frictionless. A bed the user has marked PLANTED, or that carries logged
            // plants this season, ARMS first and only removes on a second tap (mirrors the "Move garden"
            // confirm at #reanchor) so a season's ledger can't be wiped by one stray tap. Closed past
            // seasons keep their history either way (removeBed only reaches the open season).
            const openSeason = app.logSnapshot.seasons.find((s) => s.id === app.logSnapshot.seasonId);
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
                rm.textContent = "remove";
                rm.classList.remove("arm");
            };
            const doRemove = () => {
                // O101: the one-level session undo captures the bed and the open-season plants it takes
                lastAct = { kind: "remove", bed, plants: loggedOnBed };
                void removeBed(db, plotId(), bed.name, app.logSnapshot.seasonId).then(() => {
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
            row.appendChild(rm);
            // ISSUES #12: a bed whose declared structure DIVIDES it into strips (a wide raised bed's ≤1.2 m
            // strips, a deep field's mound-row bands) can gain addressable SUB-SECTIONS. The bed itself is
            // KEPT - its outline, area, and the walkways its structure draws (accessBandPolygons) all stay
            // well-defined, so the ground still reads as one bed with paths - and the action ADDS one child bed
            // per plantable strip (the complement of those walkways) so each strip takes its own guild / My-bed
            // config. Offered only when the bed actually divides (≥2 strips) and hasn't been sectioned already.
            // Draft-only: a section child is a fresh Draft, but a PLANTED/occupied PARENT greys the action with
            // the reason (its ledger shouldn't be reshaped underneath it).
            const strips = plantableStripPolygons({ region: bed.region, rotation_deg: bed.rotation_deg, structure: bed.structure ?? "in_ground", lane_flip: bed.lane_flip });
            const allBeds = plot?.beds ?? [];
            const bedNames = allBeds.map((b) => b.name);
            const sections = allBeds.filter((b) => sectionParentName(b.name, bedNames) === bed.name);
            const sectioned = sections.length > 0;
            if (strips.length >= 2 && !sectioned) {
                const sp = document.createElement("button");
                sp.type = "button";
                sp.textContent = "add sections";
                row.appendChild(document.createTextNode(" "));
                if (guarded) {
                    // SAY the reason, do not only hover it. The comment above has always claimed this action
                    // "greys with the reason" - and it did grey, but the reason went into a `title`, which no
                    // touch user can see. So on a phone the button simply did nothing and never said why: a
                    // disabled control is worse than a greyed option here, because it does not even respond.
                    // Found by the refusal-reason sweep (2026-07-29), the FOURTH instance of this shape.
                    const reason = loggedOnBed.length > 0
                        ? `Remove this season's ${loggedOnBed.length} plant${loggedOnBed.length === 1 ? "" : "s"} before adding sections.`
                        : "Unmark this bed as planted before adding sections.";
                    sp.disabled = true;
                    sp.title = reason;
                    const why = document.createElement("span");
                    why.className = "arearowwhy";
                    why.textContent = reason;
                    row.appendChild(sp);
                    row.appendChild(why);
                }
                else {
                    sp.title = `add ${strips.length} sub-sections inside "${bed.name}", one per growing strip - the bed keeps its walking paths`;
                    sp.addEventListener("click", () => void doSplitBed(bed, strips));
                    row.appendChild(sp);
                }
            }
            // ISSUES #12 (inverse of "add sections"): once a bed has sections, offer to MERGE them back so it
            // is one plannable bed again - removing the section child beds while keeping the parent (which has
            // persisted as the container all along). Removing a section takes its open-season plants + plan
            // with it, so if any section carries a plant / is marked planted this ARMS first (tap again),
            // mirroring the destructive "remove" guard; an all-draft set merges on a single tap.
            if (sectioned) {
                const mrg = document.createElement("button");
                mrg.type = "button";
                mrg.textContent = "merge sections";
                row.appendChild(document.createTextNode(" "));
                const sectionPlants = sections.reduce((n, s) => n + (openSeason?.plantings ?? []).filter((p) => plantingOnBed(p.region, s.region)).length, 0);
                const mergeGuarded = sections.some((s) => s.planted === true) || sectionPlants > 0;
                let mArmed = false;
                let mTimer = 0;
                const mDisarm = () => { mArmed = false; if (mTimer) {
                    clearTimeout(mTimer);
                    mTimer = 0;
                } mrg.textContent = "merge sections"; mrg.classList.remove("arm"); };
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
                row.appendChild(mrg);
            }
            box.appendChild(row);
        }
    };
    // ISSUES #12: add addressable sub-sections to a structure-divided bed WITHOUT losing the bed. The
    // parent STAYS - it keeps its outline, area, and the walkways its structure draws - and this ADDS one
    // child bed per plantable strip, named "<bed> 1"…"<bed> N" (bumped past any collision), sitting in the
    // strips between those walkways. Each section carries the parent's sun + structure (inert at strip
    // size - a ≤1.2 m raised strip won't re-path, a 2-row field band is too few rows to re-lane - but
    // honest if resized) and starts as a fresh Draft, configured through the existing per-bed flow.
    // Occupancy/history is region-rooted, so it stays geometric; the parent becomes a pure container
    // (not itself plannable - the plan pickers and map label drop it once it has sections). Rotated
    // beds keep the parent's angle so plants lay out edge-aligned; an unrotated bed's strips are axis-
    // aligned rects. The re-split guard in renderAreaList stops a bed being sectioned twice.
    const doSplitBed = async (bed, strips) => {
        const pid = plotId();
        const r2 = (v) => Math.round(v * 100) / 100;
        const fresh = await getPlot(db, pid);
        const taken = new Set((fresh?.beds ?? []).map((b) => b.name)); // the parent stays, so its name stays reserved
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
            countRung("bed-saved"); // O29: a real growing area exists (map trace/save path)
            await placeBed(db, pid, nm, region, rotation, bed.sun, bed.structure);
        }
        notice = `added ${strips.length} sections inside "${bed.name}" - each takes its own plant team below; the bed keeps its walking paths.`;
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    // ISSUES #12 (inverse of doSplitBed): merge a sectioned bed back to one. Remove each section child bed
    // (removeBed takes its open-season plants + plan with it); the parent has persisted all along, so once
    // its sections are gone it is a single plannable bed again - it reappears in the plan pickers and its
    // map label drops "(sections)". Region-rooted history in CLOSED seasons is untouched (removeBed only
    // reaches the open season). The arm-first guard on the button covers the destructive case.
    const doMergeSections = async (bed, sections) => {
        const pid = plotId();
        for (const s of sections)
            await removeBed(db, pid, s.name, app.logSnapshot.seasonId);
        notice = `merged the ${sections.length} sections back into "${bed.name}" - it is one bed again, planned as a whole.`;
        buzz(30);
        invalidatePlot();
        onBedsChanged();
        void redraw();
    };
    // --- gestures (D-079 slice 1) ------------------------------------------------------
    // Tap = the old click (drop a corner / place the shape); one-finger drag = pan, or move a
    // grabbed corner / the pending shape; pinch = zoom; wheel = zoom at the cursor. A tap is a
    // press that moves under 8 px. All math is synchronous - redraw caches the anchor latitude -
    // so panning never awaits IndexedDB mid-gesture.
    const mppNow = () => (anchorLat == null ? null : metresPerPixel(anchorLat, zoom));
    /** O113 N2: the padding fit - the EXACT zoom that puts a w x h metre box at FIT_FRAC of the
     *  view's constraining axis. Continuous zoom (N1) is what makes this expressible: the old
     *  integer walk could only bracket the right scale between powers of two, so round 9's "ground
     *  around the beds" had to overshoot by a whole step. mpp halves per zoom level, so the solve
     *  is one log2, clamped to the map's range. */
    function fitZoom(lat, w, h, frac = FIT_FRAC) {
        const reqMpp = Math.max(w / (VIEW * frac), h / (viewH * frac));
        // Ceiling ZOOM_MAX - 1, not ZOOM_MAX: a small bed's solve can exceed the range, and a fit
        // that RESTS at max zoom leaves no room to zoom in (a pinch-in clamps to nothing) and sits
        // where the imagery is at its worst. The old integer fit's "one step wider" landed at 22 for
        // the same beds, so this keeps that ceiling exactly.
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX - 1, Math.log2(metresPerPixel(lat, 0) / reqMpp)));
    }
    const snap = (v) => Math.round(v * 10) / 10; // 0.1 m grid, as before
    // O101 polish (maintainer): dragging a corner could never land on a whole number - the 0.1 m
    // working snap kept offering 3.9 when the hand wanted 4, and in feet the fine grid does not
    // even CONTAIN the whole numbers. So DIMENSION drags detent: when the raw drag sits within a
    // small window (20% of the gap) of a half or whole DISPLAY unit - feet or metres - it clicks
    // to exactly that; anywhere else the fine 0.1 m snap stands, so in-between sizes stay
    // reachable. Position drags are untouched (the magnet owns those); a container's cm/in scale
    // keeps the plain fine snap, where 0.1 m steps already read clean.
    const snapDim = (rawM) => {
        if (isContainerSize())
            return snap(rawM);
        const half = (unitSystem() === "imperial" ? 0.3048 : 1) / 2; // half a display unit, metres
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
    /** Index of the traced corner within a 44 px (22 px radius) grab target, or -1. */
    const vertexAt = (clientX, clientY) => {
        for (let i = 0; i < tracePts.length; i++) {
            const c = localToClient(tracePts[i][0], tracePts[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < 22)
                return i;
        }
        return -1;
    };
    /** O101 resize handles: index of the pending shape's grabbed bbox corner within 22 px (44 px
     *  target), or -1. Rect and trough: all four corners (TL TR BR BL, rectCorners' contract). L-bed:
     *  TL, BR, BL only - the TR bbox corner is the notch void, where a floating handle would grab
     *  empty air (the notch has its own handle). Circle: one radius handle drawn at the east point. */
    const resizeHandleAt = (clientX, clientY) => {
        if (!pending)
            return -1;
        // Walk round 1 (O113): a press ON the shape's body is a MOVE first. The full 22 px handle
        // radius holds only for presses outside the shape; touching the shape itself shrinks it to
        // 12 px, so grabbing the bed to reposition it no longer "defaults to resizing" - at the
        // closer edit fit the corners sit exactly where a thumb naturally lands on the shape.
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
                continue; // TR is the notch void
            const c = localToClient(cs[i][0], cs[i][1]);
            if (c && Math.hypot(clientX - c[0], clientY - c[1]) < rad)
                return i;
        }
        return -1;
    };
    /** The notch handle, in world metres: the L's inner corner, or the U's notch-floor right
     *  corner. Null for every other mode. */
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
    // O101 layout aids: the PATH-GAP MAGNET. While dragging a pending shape near a saved bed, the
    // drag snaps so the gap between the two bounding boxes equals the R-098 walking path (PATH_M,
    // the same constant the in-bed walkways are drawn from), or so facing edges align flush.
    // Axis-aligned shapes only - a 35° bed keeps the free drag rather than snapping a diamond's
    // bbox. Advisory like everything else here: the tolerance is small, so a deliberate off-grid
    // placement just drags past it.
    const MAGNET_TOL_M = 0.15;
    let magnetGuides = [];
    let magnetSig = ""; // last engaged snap - buzz once per new engagement, not per move
    /** The pending shape's world bbox half-extents when it sits axis-aligned, else null. */
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
    /** Snap a dragged centre to the nearest engaged target per axis; records the guide lines. */
    const applyMagnet = (cx0, cy0) => {
        magnetGuides = [];
        const half = pendingHalf();
        const out = { cx: cx0, cy: cy0 };
        if (half) {
            const editingName = ($("areaname").value ?? "").trim();
            for (const axis of ["x", "y"]) {
                const h = axis === "x" ? half[0] : half[1];
                const c0 = axis === "x" ? cx0 : cy0;
                let best = null;
                for (const bed of app.logSnapshot.beds) {
                    if (editingName && bed.name === editingName)
                        continue; // the bed being edited is the shape itself
                    const vs = regionPoints(bed.region).map((p) => (axis === "x" ? p[0] : p[1]));
                    const lo = Math.min(...vs), hi = Math.max(...vs);
                    // four targets per axis: a walking path off either face, or edges flush
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
            buzz(8); // the click of engagement, once
        magnetSig = sig;
        return out;
    };
    /** Is this press on (or near) the pending shape, so a drag moves it, not the map? */
    const onPending = (clientX, clientY, margin = 0.3) => {
        if (!pending)
            return false;
        const p = clientToLocal(clientX, clientY);
        if (!p)
            return false;
        // default margin: metres of grace around the shape (a body-grab tolerates a near miss)
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
    /** O101: a freshly dropped shape must not land smaller than its own rotate knob (maintainer-
     *  class complaint: at a wide zoom the default square is dwarfed by its handle and label). If
     *  the new shape's longer side lands under ~60 screen px, zoom in about the tap point until it
     *  works at ~120 px. An already-visible drop leaves the view alone. */
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
    /** Step zoom keeping the world point under (clientX, clientY) fixed. */
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
    // one redraw per frame while a gesture streams events - redraw rebuilds the whole SVG
    let raf = 0;
    const scheduleRedraw = () => {
        if (!raf)
            raf = requestAnimationFrame(() => { raf = 0; void redraw(); });
    };
    // ---- tile paint mechanics (D-096) - the mockup's approved feel, on the real map ----
    const paintShake = (i, j) => {
        const mpp = mppNow();
        if (mpp != null) {
            const [px, py] = [VIEW / 2 + (i * paintCell - cx) / mpp, viewH / 2 - ((j + 1) * paintCell - cy) / mpp];
            const g = el("rect", { class: "pghost", x: px, y: py, width: paintCell / mpp, height: paintCell / mpp });
            L.fx.appendChild(g); // fx survives redraws (D-095); the node removes itself
            setTimeout(() => g.remove(), 520);
        }
        svg.classList.remove("shakeit");
        void svg.getBBox();
        svg.classList.add("shakeit");
    };
    const paintVisit = (i, j) => {
        const k = cellKey(i, j);
        if (paintTool === "paint") {
            if (paintCells.has(k))
                return;
            if (!canPaint(paintCells, i, j)) {
                if (!paintSaid) {
                    toast("tiles must touch the bed - start from its edge");
                    paintSaid = true;
                }
                paintShake(i, j);
                return;
            }
            paintCells.add(k);
            paintFresh.add(k);
            paintStroke?.added.push([i, j]);
            buzz(8);
        }
        else {
            if (!paintCells.has(k))
                return;
            if (!canErase(paintCells, i, j)) {
                if (!paintSaid) {
                    toast("that tile holds the bed together - erase from the edges");
                    paintSaid = true;
                }
                paintShake(i, j);
                return;
            }
            paintCells.delete(k);
            paintStroke?.removed.push([i, j]);
        }
        scheduleRedraw();
    };
    // D-098: a saved bed celebrates - its outline draws itself on in the fx layer (pathLength=1
    // normalises the dash trick to any shape) while eight leaves burst from the centroid.
    // Self-removing on a timer (never animationend - reduced-motion users, whose CSS shows no
    // animation at all, would otherwise keep the nodes forever).
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
            const a = (i / 8) * 2 * Math.PI; // a deterministic ring - festive enough, testable always
            const leaf = el("circle", { class: "fxleaf", cx: vx, cy: vy, r: 3.5 });
            leaf.style.setProperty("--dx", `${(Math.cos(a) * 34).toFixed(1)}px`);
            leaf.style.setProperty("--dy", `${(Math.sin(a) * 34).toFixed(1)}px`);
            leaves.push(leaf);
        }
        const nodes = [poly, ...leaves];
        for (const n of nodes)
            L.fx.appendChild(n);
        celebration = { region, poly, leaves }; // redraw re-projects it until it self-removes
        setTimeout(() => { for (const n of nodes)
            n.remove(); celebration = null; }, 1200);
    };
    const endPaintStroke = () => {
        if (!paintStroke)
            return;
        if (paintTool === "paint") {
            const holes = fillHoles(paintCells);
            for (const [i, j] of holes) {
                paintCells.add(cellKey(i, j));
                paintFresh.add(cellKey(i, j));
                paintStroke.added.push([i, j]);
            }
            if (holes.length) {
                toast("the hole filled itself - beds are solid ground");
                buzz(20);
            }
        }
        if (paintStroke.added.length || paintStroke.removed.length) {
            paintUndoStack.push(paintStroke);
            paintRedoStack.length = 0;
        }
        paintStroke = null;
        paintLast = null;
        scheduleRedraw();
    };
    const pointers = new Map();
    let gesture = "none";
    // Walk round 1 (O113): EDGE AUTO-PAN while dragging the pending shape. At a working zoom the
    // view shows only part of the yard, so "carry the bed across the garden" used to mean drag,
    // release, pan, re-grab. Holding the drag within ~36 px of the map's edge now pans the view in
    // that direction (an rAF loop - no wall clock, so it behaves identically under a pinned one),
    // and the shape rides along under the held finger because its position re-derives from the
    // finger's client point after every pan step.
    // O113 X2: PAN MOMENTUM. A released pan coasts on coastFrames' decay tail (an rAF loop over
    // pure per-frame offsets), then commits once - the "alive map" release every reference app has.
    // Velocity comes from the recent pointer samples, so where the clock is pinned (the e2e suite)
    // it reads zero and the release commits immediately, exactly the old behavior. A new pointer,
    // a wheel tick, or a zoom button GRABS the map mid-flight: the coast stops and commits first.
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
        // client px/ms -> view units per ~60Hz frame
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
    const EDGE_PAN_PX = 36, EDGE_PAN_SPEED = 7; // screen px per frame
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
    // O101 resize: a rect grab captures the grabbed corner's OPPOSITE - the anchor that stays put
    // while the drag re-sizes toward the finger (captured at grab, so it can't drift as the dims
    // change under the drag). A circle resize needs no anchor - the centre is it.
    let resizeAnchor = null;
    let tapStart = null; // set on press, cleared once it moves >8 px
    let pinDragStart = null; // pinmove's own start (tapStart clears at 8 px)
    // O101 drag-to-draw (long-press armed). A plain press-drag must stay the pan - grabbing the
    // one-finger drag is exactly what got paint demoted (D-096 -> D-099) - so drawing arms on a HOLD:
    // press empty ground in Rectangle mode, hold ~400 ms without moving, and the gesture converts to
    // "draw" (buzz + toast); dragging then sizes the bed corner-to-corner with the live dimension
    // label, and release keeps the pending shape. Releasing WITHOUT dragging drops the default square
    // right there - which is D-079's specified-but-never-built "long-press -> new area here", landed
    // by the same mechanism. A move past the 8 px tap threshold before the hold matures cancels the
    // timer and the drag stays an ordinary pan.
    const LONG_PRESS_MS = 400;
    let drawStart = null; // the held corner, local metres
    let longPressTimer = 0;
    const cancelLongPress = () => { if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = 0;
    } };
    // pinch origin: d/mid are FROZEN at gesture start (the visual transform is total-since-start, not
    // incremental); tx0/ty0 carry any pan translation already accumulated when the second finger landed.
    let pinchBase = null;
    // --- transform-based pan/pinch (maintainer: "the map must be extremely smooth") ------------------
    // During a pan/pinch the scene is NOT redrawn: the world group slides/scales under a single cheap
    // transform (GPU-composited), and the real redraw happens ONCE on release. gestTx/gestTy translate in
    // viewBox units; gestScale scales about (gestMx, gestMy) in the drawn content's frame. Mid-gesture
    // redraws (a tile landing, the sheet settling) stay consistent: they repaint the gesture-START frame,
    // which the transform maps to the current view.
    let gestTx = 0, gestTy = 0, gestScale = 1, gestMx = 0, gestMy = 0;
    const applyWorldTransform = () => {
        setWorldTransform(`translate(${gestTx} ${gestTy}) translate(${gestMx} ${gestMy}) scale(${gestScale}) translate(${-gestMx} ${-gestMy})`);
    };
    /** Commit the visual transform to cx/cy (+ the pinch's EXACT zoom) and redraw once.
     *  O113 N1: the commit used to round log2(gestScale) to a whole zoom step, so every pinch
     *  ended with a visible snap of up to ±41% on finger-lift and the map could only REST at
     *  whole levels. The gesture already renders every intermediate scale; committing the exact
     *  scale just keeps the frame where the fingers left it. Tiles still fetch at whole levels
     *  (drawTiles quantises), so nothing upstream needs integer zoom. */
    const commitGesture = () => {
        if (gestTx === 0 && gestTy === 0 && gestScale === 1)
            return;
        const box = svg.getBoundingClientRect();
        const mpp = mppNow();
        const tx = gestTx, ty = gestTy;
        const dz = Math.log2(gestScale);
        // the pinch anchor (scale-invariant point) sits at content-anchor + translation - in client coords
        const midClientX = box.left + ((gestMx + tx) / VIEW) * box.width;
        const midClientY = box.top + ((gestMy + ty) / viewH) * box.height;
        // NOTE: the transform is NOT cleared here - redrawCore clears it in the same synchronous paint as
        // the committed frame, so there is no one-frame snap-back to the pre-gesture view.
        gestTx = 0;
        gestTy = 0;
        gestScale = 1;
        gestMx = 0;
        gestMy = 0;
        if (mpp != null && box.width >= 2 && box.height >= 2) {
            cx -= tx * mpp;
            cy += ty * mpp;
            if (dz !== 0)
                zoomAt(midClientX, midClientY, zoom + dz); // exact scale, anchor point fixed
        }
        scheduleRedraw();
    };
    // --- moving a painted bed (maintainer: a saved painted bed had no way to move) -------------------
    // In paint mode's MOVE sub-mode, a drag that STARTS ON a painted tile moves the WHOLE shape,
    // lattice-snapped (mirrors dragging a pending square); a drag elsewhere pans the map. One undo entry
    // per completed move, in the same {added, removed} shape as a stroke.
    let paintMoveStart = null;
    const parseCell = (k) => k.split(",").map(Number);
    const finishPaintMove = () => {
        if (!paintMoveStart)
            return;
        const { cells, di, dj } = paintMoveStart;
        paintMoveStart = null;
        if (di === 0 && dj === 0)
            return;
        const added = [...paintCells].filter((k) => !cells.has(k)).map(parseCell);
        const removed = [...cells].filter((k) => !paintCells.has(k)).map(parseCell);
        if (added.length || removed.length) {
            paintUndoStack.push({ added, removed });
            paintRedoStack.length = 0;
        }
        scheduleRedraw();
    };
    // WHERE MODE (walk round 4): the pin commit shared by tap-to-move and the drag's release. An
    // empty garden's anchor follows the pin (doMoveGarden, confirmation-free at zero beds); a
    // garden with beds moves the location fields and the Move-garden bar offers the real move.
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
        coastStop(); // grabbing the map mid-flight stops the coast where it is (commits first)
        panSamples = [{ x: ev.clientX, y: ev.clientY, t: performance.now() }];
        try {
            svg.setPointerCapture(ev.pointerId);
        }
        catch { /* a stale/synthetic pointer id - the gesture still works, uncaptured */ }
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 2) {
            cancelLongPress(); // a second finger is a pinch, never a draw hold
            endPaintStroke(); // the second finger means "move the map" - commit the tiles so far
            finishPaintMove(); // ...and settle a shape-move in progress
            const [a, b] = [...pointers.values()];
            pinchBase = { d: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, zoom, tx0: gestTx, ty0: gestTy };
            gesture = "pinch";
            tapStart = null;
            return;
        }
        tapStart = { x: ev.clientX, y: ev.clientY };
        // WHERE MODE: a press ON the pin starts a DRAG (walk round 4, maintainer: "I tried moving the
        // pin and it didn't work" - the hint said drag, but only tap-to-move existed). The glyph
        // follows the finger via a cheap transform; release commits. Tap-to-move elsewhere stays.
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
        // the ↻ handle wins over everything else - it sits just off the pending shape (D-079 s4;
        // O101 extends it to the presets, hung off their bounding box the same way)
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
        // O101: the L's / U's notch handle wins over the body-drag too
        if ((mode === "lbed" || mode === "ubed") && pending) {
            const n = notchWorldPos();
            const c = n && localToClient(n[0], n[1]);
            if (c && Math.hypot(ev.clientX - c[0], ev.clientY - c[1]) < 22) {
                gesture = "notch";
                return;
            }
        }
        // O101: a corner/radius handle wins next - it sits ON the pending outline, inside onPending's
        // grace margin, so it must be checked before the body-drag.
        if (mode !== "corner" && mode !== "paint" && pending) {
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
        // MOVE sub-mode: a press ON a painted tile grabs the whole shape (drag moves it, lattice-snapped);
        // a press elsewhere falls through to the ordinary pan.
        if (mode === "paint" && paintTool === "move" && paintCells.size > 0) {
            const w = clientToLocal(ev.clientX, ev.clientY);
            if (w && paintCells.has(cellKey(Math.floor(w[0] / paintCell), Math.floor(w[1] / paintCell)))) {
                gesture = "paintmove";
                paintMoveStart = { cells: new Set(paintCells), di: 0, dj: 0, wx: w[0], wy: w[1] };
                return;
            }
        }
        if (mode === "paint" && paintTool !== "move") {
            const w = clientToLocal(ev.clientX, ev.clientY);
            // an empty session's tap on a saved bed opens its editor (pointerEnd) instead of painting
            if (!w || (paintCells.size === 0 && bedAt(w[0], w[1]))) {
                gesture = "pan";
                return;
            }
            // tiles below finger size can't be aimed - the first touch zooms to painting scale
            // at that spot instead of painting (the mode-button entry auto-zooms the same way)
            const mpp0 = mppNow();
            if (mpp0 != null && paintCell / mpp0 < 6 && anchorLat != null) {
                let z = zoom;
                while (z < ZOOM_MAX && paintCell / metresPerPixel(anchorLat, z) < 10)
                    z++;
                zoomAt(ev.clientX, ev.clientY, z);
                toast("zoomed in to paint - drag to lay tiles");
                gesture = "none";
                tapStart = null;
                return;
            }
            gesture = "paint";
            paintStroke = { added: [], removed: [] };
            paintSaid = false;
            paintLast = w;
            paintVisit(Math.floor(w[0] / paintCell), Math.floor(w[1] / paintCell));
            return;
        }
        if (mode === "corner" && (vertexIx = vertexAt(ev.clientX, ev.clientY)) >= 0)
            gesture = "vertex";
        else if (mode !== "corner" && onPending(ev.clientX, ev.clientY))
            gesture = "pending";
        else
            gesture = "pan";
        // O101: arm the draw hold - Rectangle mode, no shape yet, empty ground (a press on a saved bed
        // stays the tap-to-popover path), not the Where step, not the phone's browse preview.
        cancelLongPress();
        if (gesture === "pan" && mode === "rect" && !pending && !locating()
            && !(document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)) {
            const w0 = clientToLocal(ev.clientX, ev.clientY);
            if (w0 && !bedAt(w0[0], w0[1], (mppNow() ?? 0) * BED_TAP_SLOP_PX)) {
                const pid = ev.pointerId;
                longPressTimer = window.setTimeout(() => {
                    longPressTimer = 0;
                    // still the same single, un-moved press? (a move >8 px cleared tapStart; a second finger
                    // pinches; a lifted finger left the map)
                    const pt = pointers.get(pid);
                    if (!pt || !tapStart || gesture !== "pan" || pointers.size !== 1)
                        return;
                    const w1 = clientToLocal(pt.x, pt.y);
                    if (!w1)
                        return;
                    // settle any sub-threshold pan drift so the view and the draw agree
                    gestTx = 0;
                    gestTy = 0;
                    gestScale = 1;
                    setWorldTransform(null);
                    gesture = "draw";
                    tapStart = null; // this press is a draw now, never a tap
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
            // NO redraw per move: scale + slide the drawn scene about the pinch origin (two fingers also PAN,
            // D-096 - the midpoint drag carries the translation). Committed to cx/cy + a stepped zoom on release.
            const [a, b] = [...pointers.values()];
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            const raw = Math.hypot(a.x - b.x, a.y - b.y) / pinchBase.d;
            // clamp the visual scale to the zoom range so the release can honour what was shown
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
            // the handle direction IS the bed's local +y: angle from the pending centre, 5°-snapped
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
            cancelLongPress(); // moved before the hold matured - this drag is an ordinary pan
        }
        if (gesture === "resize" && pending && pointers.size === 1) {
            // resize toward the finger, the grabbed corner's OPPOSITE staying put (rect) or the centre
            // staying put (circle). Rotation-aware: the drag is measured in the bed's own frame.
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
                    // the detent reads the DIAMETER - that is the number the card shows and the hand aims for
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
            // the notch corner follows the finger in the bed's own frame; both notch dims clamp so an
            // arm always survives (lDims/uDims re-clamp on read as the backstop). The U's notch stays
            // centred, so its width reads as twice the finger's offset from the bed's midline.
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
            // corner-to-corner: the held corner stays put, the finger drags the opposite one; dims and
            // the pending centre track live (the same inputs the save card shows, so they stay in sync)
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
            return; // still a tap, or a finger lifted mid-pinch
        if (gesture === "paint" && paintLast) {
            const w = clientToLocal(ev.clientX, ev.clientY);
            if (w) {
                for (const [i, j] of strokeCells(paintLast[0], paintLast[1], w[0], w[1], paintCell))
                    paintVisit(i, j);
                paintLast = w;
            }
            return;
        }
        if (gesture === "paintmove" && paintMoveStart) {
            // slide the whole painted shape by whole cells, tracking the finger from the grab point
            const w = clientToLocal(ev.clientX, ev.clientY);
            if (w) {
                const di = Math.round((w[0] - paintMoveStart.wx) / paintCell);
                const dj = Math.round((w[1] - paintMoveStart.wy) / paintCell);
                if (di !== paintMoveStart.di || dj !== paintMoveStart.dj) {
                    paintMoveStart.di = di;
                    paintMoveStart.dj = dj;
                    paintCells = new Set([...paintMoveStart.cells].map((k) => { const [i, j] = parseCell(k); return cellKey(i + di, j + dj); }));
                    paintFresh = new Set();
                    notice = null;
                    scheduleRedraw();
                }
            }
            return;
        }
        if (gesture === "pinmove") {
            // live feedback: slide the glyph with the finger (VIEW units); the release commits for real.
            // pinDragStart, not tapStart - the tap/drag discriminator clears tapStart 8 px in.
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
            // NO redraw per move: slide the drawn scene with a transform; committed to cx/cy on release.
            const box = svg.getBoundingClientRect();
            if (box.width < 2 || box.height < 2)
                return;
            gestTx += (dxPx / box.width) * VIEW;
            gestTy += (dyPx / box.height) * viewH;
            panSamples.push({ x: ev.clientX, y: ev.clientY, t: performance.now() }); // momentum tail (X2)
            if (panSamples.length > 6)
                panSamples.shift();
            applyWorldTransform();
        }
    });
    const pointerEnd = (ev) => {
        cancelLongPress(); // a release before the hold matures is a tap/pan, never a draw
        edgePanStop(); // a held edge-pan ends with the drag that started it
        // a draw settles wholesale: a dragged shape stays as drawn; a hold released without a drag
        // drops the default square at the held spot (D-079's "long-press -> new area here")
        if (gesture === "draw" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            if (!pending && drawStart && ev.type !== "pointercancel") {
                pending = { cx: drawStart[0], cy: drawStart[1] };
                redoPending = null;
            }
            drawStart = null;
            tapStart = null;
            void redraw();
            return;
        }
        // the pin drag settles first: commit where the finger let go, whole gesture consumed
        if (gesture === "pinmove" && pointers.size === 1) {
            pointers.delete(ev.pointerId);
            gesture = "none";
            tapStart = null;
            pinDragStart = null;
            if (ev.type !== "pointercancel")
                commitPinAt(ev.clientX, ev.clientY);
            else
                void redraw(); // cancelled - repaint snaps the glyph back to the real location
            return;
        }
        const wasTap = tapStart != null && gesture !== "pinch" && gesture !== "rotate"
            && gesture !== "resize" && gesture !== "notch" && pointers.size === 1;
        if (gesture === "paint" && pointers.size === 1)
            endPaintStroke(); // tap or drag - the stroke is done
        if (gesture === "paintmove" && pointers.size === 1)
            finishPaintMove(); // shape-move settles here
        pointers.delete(ev.pointerId);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture(); // pinch over - snap the zoom, one redraw
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "pan" && !coastStart())
                commitGesture(); // pan over - coast (X2) or commit
            gesture = "none";
            // the magnet's guides are drag-time feedback - the release retires them (the snap held)
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
            return; // no anchor yet - the hint says what to do
        // WHERE MODE (walk round 3): the map's one job here is the pin - a tap MOVES it. No bed
        // editing, no new squares. An empty garden's anchor simply follows the pin (the same
        // doMoveGarden the reanchor button uses, confirmation-free at zero beds); a garden WITH
        // beds moves only the location fields, and the "Move garden here" bar offers the real,
        // deliberate move (D-022 still guards the beds).
        if (locating()) {
            if (!anchorLL)
                return; // grid frame is not a place - the attrib line says to type the address
            // Once beds exist the pin FREEZES (walk round 5, maintainer): it marks where the garden IS.
            // A tap says why instead of silently moving what beds anchor to; the deliberate move is a
            // new address search, which offers the Move-garden confirmation with the beds coming along.
            if (anchorBeds > 0) {
                // the GLOBAL float, not the map's local toast - that one docks in #maphint, which
                // locate mode's own CSS hides (the round-4 declutter)
                floatToast("This garden's spot is set - its beds anchor here. Type a new address to move the whole garden.");
                return;
            }
            commitPinAt(ev.clientX, ev.clientY);
            return;
        }
        // tapping a SAVED bed while not actively drawing loads it back into the editor -
        // previously this just started a NEW shape on top of it (walkthrough round 3)
        if (mode === "paint" ? paintCells.size === 0 : mode === "corner" ? tracePts.length === 0 : !pending) {
            // A touch-target margin around each bed (BED_TAP_SLOP_PX on screen, converted to world via the
            // live scale) so a near-miss tap still opens the bed to edit instead of dropping a new square.
            const tolM = (mppNow() ?? 0) * BED_TAP_SLOP_PX;
            const hit = bedAt(p[0], p[1], tolM);
            // A4: a bed tap opens the read POPOVER (identity + Open in Plan / Log here / Edit);
            // editing is one tap further, on the popover's own Edit. A tap that hits no bed
            // dismisses it (below), so the map itself is the close gesture.
            closeBedPopover();
            if (hit) {
                openBedPopover(hit);
                return;
            }
        }
        // The framed browse panel is a PREVIEW (round 7): a tap there that hits no bed must not start
        // a shape - drawing enters through "Your ground" (the pill / path bar). A tap that HITS a bed
        // (above) still opens it to edit, and the save card flips the shell to the full-bleed editor.
        // Mobile only: desktop's side-by-side map has no browse collapse and keeps tap-to-place.
        if (document.body.classList.contains("plan-browse") && !matchMedia("(min-width: 900px)").matches)
            return;
        if (mode === "paint")
            return; // the down/stroke already painted; nothing more on tap
        notice = null;
        if (mode === "corner") {
            if (vertexAt(ev.clientX, ev.clientY) >= 0)
                return; // tapped an existing corner - nothing to add
            tracePts.push([snap(p[0]), snap(p[1])]);
            redoPts = [];
        }
        else {
            pending = { cx: snap(p[0]), cy: snap(p[1]) }; // tap places (or re-places) the shape's centre
            redoPending = null;
            frameDrop(ev.clientX, ev.clientY);
        }
        void redraw();
    };
    svg.addEventListener("pointerup", pointerEnd);
    svg.addEventListener("pointercancel", pointerEnd);
    // Safety net (maintainer: after painting with the tile tool, the map's pan/zoom got stuck - and new
    // shapes couldn't be placed - until a full reload). The svg only cleans up pointers on ITS OWN up/
    // cancel; if that event is missed - the finger lifted off the map element mid-stroke, or the browser
    // never granted setPointerCapture (its throw is swallowed above) - the pointer lingers in `pointers`,
    // so `pointers.size` never returns to 0 and every later gesture wedges. Catch the up/cancel at the
    // WINDOW level and reconcile any pointer the svg didn't: drop it, commit a live stroke, and reset the
    // gesture state once the map is untouched. A pointer the svg already handled is gone, so this no-ops.
    const reconcilePointerEnd = (id) => {
        if (!pointers.has(id))
            return; // the svg's own handler already cleaned this one up
        pointers.delete(id);
        if (gesture === "pinch" && pointers.size < 2)
            commitGesture();
        if (pointers.size < 2)
            pinchBase = null;
        if (pointers.size === 0) {
            if (gesture === "paint")
                endPaintStroke();
            if (gesture === "paintmove")
                finishPaintMove();
            if (gesture === "pan")
                commitGesture();
            gesture = "none";
            tapStart = null;
            cancelLongPress();
            drawStart = null; // a missed release mid-draw keeps whatever was drawn; the hold is over
        }
    };
    window.addEventListener("pointerup", (ev) => reconcilePointerEnd(ev.pointerId));
    window.addEventListener("pointercancel", (ev) => reconcilePointerEnd(ev.pointerId));
    svg.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        coastStop(); // a wheel tick mid-coast lands on committed geometry
        // O113 N1: wheel zoom is CONTINUOUS like the pinch - proportional to the wheel's own delta
        // (a trackpad streams small pixel deltas, a notched mouse ~100 per click, Firefox reports
        // lines), clamped so a single event never jumps more than one level. The old ±1-per-event
        // made a trackpad scroll rocket across the whole zoom range.
        const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
        const dz = Math.max(-1, Math.min(1, (-ev.deltaY * unit) / 240));
        if (dz)
            zoomAt(ev.clientX, ev.clientY, zoom + dz);
    }, { passive: false });
    // the viewport changes shape when the sheet moves or the window resizes - the viewBox
    // follows the element's aspect, so re-render (rAF-batched) whenever the box changes
    if (svg.parentElement)
        new ResizeObserver(() => scheduleRedraw()).observe(svg.parentElement);
    // the sheet announces when its height animation is done (round 10) - redraw on settled
    // geometry so the legend's fit verdict is measured at rest, never mid-transition
    window.addEventListener("gg-sheet-settled", () => scheduleRedraw());
    // mode switching clears the work in progress - never a half-shape from another tool
    const setMode = (m) => {
        mode = m;
        tracePts = [];
        pending = null;
        pendingAngle = 0;
        redoPts = [];
        redoPending = null;
        cancelLongPress();
        drawStart = null;
        paintCell = cellM(); // a fresh session paints on the display unit's grid (re-edit overrides after)
        paintCells = new Set();
        paintFresh = new Set();
        paintStroke = null;
        paintUndoStack.length = 0;
        paintRedoStack.length = 0;
        notice = null;
        retireReach(); // switching tool abandons the current bed - the nudge (if shown) has done its job
        // O101 toolset ruling: paint has no toolbar button anymore (mode "paint" is reached only via
        // startEditBed on an existing painted bed), so entering it simply leaves every button unlit -
        // the #painttools row that appears alongside is the mode's face.
        for (const [id, mm] of [["modecorner", "corner"], ["moderect", "rect"], ["modecircle", "circle"],
            ["modelbed", "lbed"], ["modeubed", "ubed"], ["modetrough", "trough"]]) {
            $(id).className = mm === m ? "modebtn on" : "modebtn";
        }
        $("painttools").hidden = m !== "paint";
        $("dimsrect").hidden = m !== "rect";
        $("dimscircle").hidden = m !== "circle";
        $("dimsl").hidden = m !== "lbed";
        $("dimsu").hidden = m !== "ubed";
        $("dimstrough").hidden = m !== "trough";
        // enter the paint tool with the BRUSH live (maintainer: a NEW bed should draw right away) and
        // auto-zoomed to a tappable tile; startEditBed overrides to MOVE for an EXISTING painted bed, where
        // an accidental stroke on a saved shape is the bigger risk. Entering paint also drops the bottom
        // sheet to its handle (gg-sheet-collapse): painting wants the whole map visible, and the sheet's
        // adaptive lift was creeping UP over it (maintainer).
        if (m === "paint") {
            paintTool = "paint";
            syncPaintToolButtons();
            if (anchorLat != null) {
                while (zoom < ZOOM_MAX && paintCell / metresPerPixel(anchorLat, zoom) < 10)
                    zoom++;
            }
            notice = "paint tiles - drag one finger to lay tiles. Tap move to reposition the map.";
        }
        // picking ANY draw tool means working the map - drop the sheet to its handle so the ground is
        // unobscured (maintainer: first done for paint, then asked for the other shapes too)
        window.dispatchEvent(new Event("gg-sheet-collapse"));
        void redraw();
    };
    $("modecorner").addEventListener("click", () => setMode("corner"));
    $("moderect").addEventListener("click", () => setMode("rect"));
    $("modecircle").addEventListener("click", () => setMode("circle"));
    $("modelbed").addEventListener("click", () => setMode("lbed"));
    $("modeubed").addEventListener("click", () => setMode("ubed"));
    $("modetrough").addEventListener("click", () => setMode("trough"));
    // the brush/eraser pair (paint mode only)
    const syncPaintToolButtons = () => {
        $("paintmove").className = paintTool === "move" ? "modebtn on" : "modebtn";
        $("paintbrush").className = paintTool === "paint" ? "modebtn on" : "modebtn";
        $("painterase").className = paintTool === "erase" ? "modebtn on" : "modebtn";
    };
    for (const [id, t] of [["paintmove", "move"], ["paintbrush", "paint"], ["painterase", "erase"]]) {
        $(id).addEventListener("click", () => {
            paintTool = t;
            syncPaintToolButtons();
            // switching to paint/erase is the deliberate "now lay tiles" - zoom to a tappable tile size then
            // (not on entry), so entering the tool in "move" leaves your view alone until you ask to paint.
            if (t !== "move" && anchorLat != null) {
                let z = zoom;
                while (z < ZOOM_MAX && paintCell / metresPerPixel(anchorLat, z) < 10)
                    z++;
                if (z !== zoom) {
                    zoom = z;
                    void redraw();
                }
            }
            notice = t === "move" ? "move - one finger pans the map; drag the painted bed itself to move the bed."
                : t === "paint" ? "paint - drag one finger to lay tiles. Tap move to reposition the map."
                    : "erase - drag one finger across tiles to remove them. Tap move to reposition.";
            void redraw();
        });
    }
    // Rotate the painted shape a quarter turn about its own centre (maintainer: a saved painted bed had
    // no way to rotate). Tiles are axis-aligned, so rotation is in 90° steps - which keeps the shape on
    // the lattice (still re-paintable) and provably preserves the two paint invariants (4-connectivity
    // and hole-freeness are rotation-invariant). One undo entry, same {added, removed} shape as a stroke.
    $("paintrotate").addEventListener("click", () => {
        if (!paintCells.size) {
            toast("paint (or tap) a bed first, then rotate it");
            return;
        }
        const cells = [...paintCells].map(parseCell);
        const is = cells.map((c) => c[0]), js = cells.map((c) => c[1]);
        const i0 = Math.min(...is), i1 = Math.max(...is), j0 = Math.min(...js), j1 = Math.max(...js);
        // 90° about the bbox centre: (i,j) -> (j, i1-i), re-anchored so the centre stays put
        const nI0 = Math.round((i0 + i1) / 2 - (j1 - j0) / 2);
        const nJ0 = Math.round((j0 + j1) / 2 - (i1 - i0) / 2);
        const next = new Set(cells.map(([i, j]) => cellKey(nI0 + (j - j0), nJ0 + (i1 - i))));
        const added = [...next].filter((k) => !paintCells.has(k)).map(parseCell);
        const removed = [...paintCells].filter((k) => !next.has(k)).map(parseCell);
        paintCells = next;
        paintFresh = new Set();
        if (added.length || removed.length) {
            paintUndoStack.push({ added, removed });
            paintRedoStack.length = 0;
        }
        notice = "rotated a quarter turn - rotate again to keep turning, then save.";
        void redraw();
    });
    // D-099: dismissing the R-006 reach chip retires it for the rest of the session.
    // A step change alters what the map draws (the locate pin, the grid-mode invite), so repaint
    // on it - see the sheet's dispatch for why this is an event rather than a call.
    window.addEventListener("gg-step-changed", () => void redraw());
    $("mapnoticesx").addEventListener("click", () => {
        noticeDismissed = true;
        $("mapnotices").hidden = true;
        try {
            localStorage.setItem("gg-map-guided", "1");
        }
        catch { /* private mode - session-only */ }
    });
    $("mapreachx").addEventListener("click", () => {
        reachSeenSession = true;
        $("mapreach").hidden = true;
    });
    $("mapcontainerx").addEventListener("click", () => {
        containerDismissed = true;
        $("mapcontainer").hidden = true;
    });
    // D-094: the two disclosure chips. Collapsed by default every load - the collapsed state IS
    // the feature (the canvas belongs to the garden), so it is deliberately not persisted.
    $("ly-toggle").addEventListener("click", () => {
        const set = document.querySelector(".maplayers .ly-set");
        set.hidden = !set.hidden;
        $("ly-toggle").setAttribute("aria-expanded", String(!set.hidden));
    });
    $("ly-photo").addEventListener("click", () => {
        look = look === "photo" ? "illustrated" : "photo";
        $("ly-photo").classList.toggle("on", look === "photo");
        try {
            localStorage.setItem("gg-maplook", look);
        }
        catch { /* private mode - session-only */ }
        void redraw();
    });
    $("ly-photo").classList.toggle("on", look === "photo");
    $("keytoggle").addEventListener("click", () => {
        keyOpen = !keyOpen;
        $("keytoggle").setAttribute("aria-expanded", String(keyOpen));
        void redraw();
    });
    // layer chips (D-079 slice 6): toggle, persist, repaint
    for (const [id, key] of [["ly-areas", "areas"], ["ly-plantings", "plantings"], ["ly-labels", "labels"]]) {
        const btn = $(id);
        btn.classList.toggle("on", layerState[key]);
        btn.addEventListener("click", () => {
            layerState[key] = !layerState[key];
            btn.classList.toggle("on", layerState[key]);
            try {
                localStorage.setItem("gg-maplayers", JSON.stringify(layerState));
            }
            catch { /* private mode - session-only */ }
            void redraw();
        });
    }
    // A4: the tint pills - a RADIO, not toggles (one encoding at a time is what keeps the fills
    // readable); persisted with the layers, and the tint-words chip states the active encoding.
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
                catch { /* private mode - session-only */ }
                void redraw();
            });
        }
        paint();
    }
    for (const id of ["shapew", "shapel", "shaped", "lw", "ll", "lnw", "lnl", "uw", "ul", "unw", "unl", "tw", "tl"]) {
        $(id).addEventListener("input", () => void redraw()); // dims stay adjustable until save
    }
    // Picking "container" (or resizing after) must refresh the live R-098 advisory - it reads the
    // structure select, which redraw() does not otherwise watch.
    $("bedstructure").addEventListener("change", () => {
        // #2: toggling container on/off flips the size inputs between cm/in and m/ft - re-express the
        // current numbers (read in the OLD mode, written in the NEW) so the physical size is unchanged.
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
        containerDismissed = false; // a structure change re-arms the container chip
        void redraw();
    });
    // Zoom and re-centre only (round 7): the arrow pads went - dragging pans on every input
    // (touch, mouse, trackpad), and the button stack cost a third of the map on a phone.
    // The buttons step a whole level from wherever the (possibly fractional, O113 N1) zoom rests,
    // clamped - `zoom++` from 22.6 would sail past ZOOM_MAX. Each stops a coast first (X2).
    $("mapzin").addEventListener("click", () => { coastStop(); const z = Math.min(ZOOM_MAX, zoom + 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapzout").addEventListener("click", () => { coastStop(); const z = Math.max(ZOOM_MIN, zoom - 1); if (z !== zoom) {
        zoom = z;
        void redraw();
    } });
    $("mapc").addEventListener("click", () => { cx = 0; cy = 0; void redraw(); });
    // Eyes beat geocoders: pan the imagery to your house, then make the view centre THE location.
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
    // The save reveal (round 10, maintainer): saving a team or a designed bed centres and
    // zoom-fits the map on THAT bed - the same fit math as the arrival fit, scoped to one bed.
    window.addEventListener("gg-bed-saved", (ev) => {
        void (async () => {
            const name = ev.detail?.bed;
            const p = await getPlot(db, plotId());
            const bed = name ? p?.beds?.find((b) => b.name === name) : undefined;
            // A save on an UNANCHORED plot (a dimension bed, phase B) can't be centred on - there is no
            // map - but the bed LIST this redraw renders must still refresh, or the second sized bed
            // never appears until some unrelated interaction repaints. Only the centring is gated.
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
            zoom = fitZoom(p.anchor.lat, w, h); // the padding fit (O113 N2) - round 9's margin, exact
            // and repaint from FRESH storage: the plot just changed, so the map's cached copy is stale
            // by definition. Its reuse window is a 120 ms wall-clock test that never expires wherever
            // the clock is pinned, so without this the just-saved bed could miss the map and the bed
            // list entirely (measured under the e2e clock; a brief live window for real users).
            invalidatePlot();
            void redraw();
        })();
    });
    // Land the BEDS at the new location, not offset by the old anchor→bed vector (walkthrough bug):
    // a bed traced far from a bad initial anchor (a ZIP centroid, a wrong first address) is far from
    // the anchor in local metres, so naively setting anchor = new location would drop the beds that
    // same distance away - off the map. Instead re-anchor so the beds' CENTROID sits at the new
    // location: the whole garden (beds + their plantings, which share the frame) translates there,
    // layout intact. Then centre the view on the beds so you actually see them. The ONE move
    // implementation - the map's own button and the Where card's offer (app.moveGardenTo) both
    // run through here, so the centroid rule can't drift between the two surfaces.
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
        // carry the typed address to the new location (else it's cleared and the Log computes a label)
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
            // Moving a garden WITH beds is a real change (the beds travel with it) - confirm on a second tap.
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
                toast(`${e instanceof Error ? e.message : e}`, 5000); // errors linger a beat longer
            }
        })();
    });
    // O101: take back the last SAVE-LEVEL act (see lastAct). Async because it re-reads and
    // re-writes storage; the slot clears first so a double-tap can't run it twice.
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
                await moveBedPlantings(db, pid, cur, { region: act.prev.region, rotation_deg: act.prev.rotation_deg }, app.logSnapshot.seasonId);
                notice = `took back the edit - "${act.name}" has its previous shape again.`;
            }
            else {
                await removeBed(db, pid, act.name, app.logSnapshot.seasonId);
                notice = `took back the save - "${act.name}" removed.`;
            }
        }
        else {
            await placeBed(db, pid, act.bed.name, act.bed.region, act.bed.rotation_deg, act.bed.sun ?? null, act.bed.structure ?? null);
            // the planted flag and this season's plants came off with the bed - put both back
            if (act.bed.planted) {
                const p2 = await getPlot(db, pid);
                const b2 = p2?.beds.find((b) => b.name === act.bed.name);
                if (p2 && b2) {
                    b2.planted = true;
                    await putPlot(db, p2);
                }
            }
            const sid = app.logSnapshot.seasonId;
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
        if (mode === "paint" && (paintCells.size || paintUndoStack.length)) {
            const st = paintUndoStack.pop(); // one stroke back - a whole drag, not one tile
            if (st) {
                for (const [i, j] of st.added)
                    paintCells.delete(cellKey(i, j));
                for (const [i, j] of st.removed)
                    paintCells.add(cellKey(i, j));
                paintRedoStack.push(st);
            }
        }
        else if (mode === "corner" && tracePts.length) {
            const p = tracePts.pop();
            if (p)
                redoPts.push(p);
        }
        else if (pending) {
            redoPending = pending;
            pending = null;
        }
        else if (lastAct) {
            // nothing in progress to unwind - ↺ reaches the save level (one act, one level)
            void undoLastAct();
            return;
        }
        void redraw();
    });
    $("arearedo").addEventListener("click", () => {
        notice = null;
        if (mode === "paint") {
            const st = paintRedoStack.pop();
            if (st) {
                for (const [i, j] of st.added) {
                    paintCells.add(cellKey(i, j));
                    paintFresh.add(cellKey(i, j));
                }
                for (const [i, j] of st.removed)
                    paintCells.delete(cellKey(i, j));
                paintUndoStack.push(st);
            }
        }
        else if (mode === "corner") {
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
        paintCells = new Set();
        paintFresh = new Set();
        paintUndoStack.length = 0;
        paintRedoStack.length = 0;
        void redraw();
    });
    // O101 (desktop keyboard): while a shape is pending, the arrows nudge it one working-snap step
    // (Shift = 1 m), R rotates 5° (Shift+R the other way) on the shapes that rotate, and Escape or
    // Delete discards it - undoably, ↻ brings it back. Ctrl/Cmd+Z and +Shift+Z (or +Y) drive the
    // same undo/redo the ↺↻ buttons do, save-level reach included. Never while typing in a field,
    // and only while a ground-editing step is open, so the page's own shortcuts stay untouched.
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
                const name = $("areaname").value.trim();
                if (!name)
                    throw new Error("name the area first - that's how you'll pick it when planting");
                const r2 = (v) => Math.round(v * 100) / 100;
                // Capture the bed under this name BEFORE it is replaced: if it already exists, this save is a
                // MOVE/edit, and its plants must travel with it (walkthrough round 12).
                const oldBed = (await getPlot(db, plotId()))?.beds.find((b) => b.name === name);
                let region;
                let rotation;
                if (mode === "paint") {
                    if (!paintCells.size)
                        throw new Error("paint some tiles first - drag on the ground");
                    // outline() is guaranteed simple by the paint guards; a throw here is a real bug
                    region = { shape: "polygon", points: outline(paintCells, paintCell) };
                    notice = `saved "${name}" (${paintCells.size} tiles, ${fmtArea(paintCells.size * paintCell * paintCell)}) - paint another, or plan its plants below.`;
                }
                else if (mode === "rect") {
                    const d = rectDims();
                    if (!d)
                        throw new Error("set the width and length first");
                    if (!pending)
                        throw new Error("tap the map to place the square first");
                    if (pendingAngle % 360 !== 0) {
                        // a rotated square saves as its 4-corner polygon (TL→TR→BR→BL in the bed's frame)
                        // + the angle as metadata - occupancy and overlap need no new geometry (D-079 s4)
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
                    // O101 presets save as ordinary polygons (the circle's 32-gon precedent): occupancy,
                    // overlap, and reach need no new geometry. A rotated preset carries the angle as
                    // metadata exactly like a rotated rectangle.
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
                const sunSel = $("bedsun").value;
                const sun = sunSel === "full" || sunSel === "part_shade" ? sunSel : null; // null clears; R-005
                const structSel = $("bedstructure").value;
                const structure = structSel === "raised" || structSel === "in_ground" || structSel === "container" || structSel === "field"
                    ? structSel : null; // null clears to unstated (defers to the guild default); D-141 / R-098
                // D-141 / R-098 (maintainer): refuse a structure this bed's planted guild forbids - a mound team
                // can't go on a raised bed, a fruit tree can't leave the ground. Backstop to the greyed dropdown
                // option; only blocks a CHANGE, so keeping the bed's existing structure always saves.
                const gate = structure ? app.bedStructureBlockers?.(name) : null;
                if (gate && structure && gate.blocked.includes(structure) && structure !== oldBed?.structure) {
                    throw new Error(gate.reason(structure) ?? "that structure is not allowed for this bed's plants");
                }
                const laneFlip = $("bedlanes").value === "flip" ? true : null; // null clears
                countRung("bed-saved"); // O29: a real growing area exists (map trace/save path)
                await placeBed(db, plotId(), name, region, rotation, sun, structure, undefined, laneFlip);
                // R-098 container advisory (D-141): a container declared bigger than a typical one gets a
                // non-blocking nudge appended to the save notice - the bed still saves, we just suggest it is
                // really a raised or in-ground bed. Largest span of the shape, against the corpus threshold.
                if (structure === "container") {
                    const cpts = regionPoints(region);
                    const cxs = cpts.map((p) => p[0]), cys = cpts.map((p) => p[1]);
                    const maxSpan = Math.max(Math.max(...cxs) - Math.min(...cxs), Math.max(...cys) - Math.min(...cys));
                    const cnote = app.bedContainerNote?.(maxSpan) ?? null;
                    if (cnote)
                        notice = notice ? `${notice} ${cnote}` : cnote;
                }
                // Plants move WITH the bed (round 12): remap the open season's plantings on the old footprint
                // to the new frame. Ground-rooted (geometric), open season only - past history stays put.
                if (oldBed)
                    await moveBedPlantings(db, plotId(), oldBed, { region, rotation_deg: rotation }, app.logSnapshot.seasonId);
                // O101: the one-level session undo - a re-save remembers the replaced shape, a first save
                // remembers there was nothing (so ↺ un-creates it)
                lastAct = { kind: "save", name, prev: oldBed ?? null };
                celebrateBed(region);
                tracePts = [];
                pending = null;
                pendingAngle = 0;
                paintCells = new Set();
                paintFresh = new Set();
                paintUndoStack.length = 0;
                paintRedoStack.length = 0;
                retireReach(); // saving a conflicting bed counts as acting on the nudge (D-099)
                buzz(30);
                $("areaname").value = "";
                $("bedsun").value = "";
                $("bedstructure").value = "in_ground"; // reset to the default, not the removed "unstated"
                $("bedlanes").value = "";
                prevStructure = "in_ground";
                refreshSizeUnitDisplay(); // #2: back to m/ft after a container save
                invalidatePlot();
                onBedsChanged();
                // A NEW bed just landed - take the user to "Your ground" (its edit/remove list) so they can act
                // on it without hunting up the page. Placing a bed from the guild/plan step used to leave you
                // where you were, the new bed's controls a scroll away. Opening the <details> fires sheet.ts's
                // toggle handler, which closes the other steps and scrolls it into view (same as "Continue →
                // your ground"). A re-save/edit (oldBed) is left in place - round 28 already routes edits to the
                // configured-bed step, and yanking focus mid-edit would fight that flow.
                if (!oldBed) {
                    const ground = document.getElementById("sec-ground");
                    if (ground)
                        ground.open = true;
                    // ...and land ON the receipt (walk round 8): the sheet listens for this and scrolls to
                    // "Bought: ..." with Continue underneath, instead of leaving the step at its top.
                    // Only for a NEW bed - a re-save keeps the round-28 edit flow undisturbed.
                    window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
                }
                void redraw();
            }
            catch (e) {
                toast(`${e instanceof Error ? e.message : e}`, 5000); // errors linger a beat longer
            }
        })();
    });
    $("plotsel").addEventListener("change", () => {
        tracePts = [];
        notice = null;
        onPlotSwitched($("plotsel").value);
    });
    // "＋ Add a garden" reveals the name field (walkthrough): switching and creating a garden read as
    // two distinct actions now, and the create fields stay out of the way until you want them.
    $("plotaddtoggle").addEventListener("click", () => {
        const fields = $("plotaddfields");
        const show = fields.hidden;
        fields.hidden = !show;
        ($("plotaddtoggle")).textContent = show ? "Cancel" : copy.logAddGardenBtn;
        if (show)
            $("newplotname").focus();
    });
    $("plotadd").addEventListener("click", () => {
        void (async () => {
            try {
                const name = $("newplotname").value.trim();
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
                $("newplotname").value = "";
                $("plotaddfields").hidden = true; // collapse the create fields again
                ($("plotaddtoggle")).textContent = copy.logAddGardenBtn;
                notice = `address "${name}" added - its ground, areas, and seasons are their own ledger.`;
                onPlotSwitched(id);
            }
            catch (e) {
                toast(`${e instanceof Error ? e.message : e}`, 5000); // errors linger a beat longer
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
                    // A FIRST placement lands wide enough to recognise the place (walk round 9,
                    // maintainer): the pin dropping at the working zoom put the viewer inside a couple of
                    // roof widths, with no driveway or street to check it against. A garden that already
                    // has beds keeps whatever zoom the gardener was working at - they know where they are.
                    if (!(p.beds?.length ?? 0))
                        zoom = LOCATE_ZOOM;
                    void redraw();
                }
            })();
        },
        refit: () => {
            lastFitPlotId = null;
            lastPlot = null; // and drop the cached record - the plot may have just been replaced in place
            void redraw();
        },
    };
}
