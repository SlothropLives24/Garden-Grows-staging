// The app's shared mutable state (Phase A page-split), plus the tiny lookups that read it.
// ES-module imports are read-only bindings, so cross-module ASSIGNMENT needs a carrier object:
// page modules write `app.logSnapshot = …`, never a bare imported `let`. Display state only -
// the engine is always handed explicit records, never this object.
import { humanize, titleCase } from "./engine/labels.js";
import { area as regionArea } from "./engine/regions.js";
import { mergeUserSpecies } from "./engine/userspecies.js";
import { defaultWorkspacePlotId } from "./storage.js";
import { fmtArea, fmtLen } from "./units.js";
export const app = {
    // The season log + placed beds + which season is open in the UI, mirrored from storage by
    // setupLog's refresh so the synchronous render path can read it.
    // set by app.ts once the bundle is live, so DOM modules without a bundle handle (the ground
    // map's planting dots, D-079 slice 6) can still show human names
    speciesName: null,
    // the applied season plan projected onto ground (plot metres) - computed by plan.ts each
    // draw, rendered by the map as hollow "planned" dots beside the filled occupancy dots
    planDots: [],
    logSnapshot: { seasons: [], beds: [], seasonId: null, priorOccupancy: [] },
    // The active garden's OWN record (the parts of it that are not in the season log), mirrored here
    // by the log refresh so the synchronous render path can read them. O28's inventory needs the typed
    // address and whether the plot is anchored; getPlot is async and draw() is not.
    currentPlot: null,
    // User-added plant varieties (roadmap corpus-growth), mirrored from storage so the render
    // path can fold them into the species set. USER DATA - never mixed into the corpus bundle.
    userSpecies: [],
    // D-148 P0: the gardener's own soil observations for the open plot. USER DATA, same shelf as
    // userSpecies - the engine reads them through soil.ts, nothing gates on them, and they are never
    // mixed into the bundle. soilRefresh is the seam the panel's save calls to re-render.
    soilObservations: [],
    // Phase C (the D-023 amendment): the answers ladder's dated crop rows, served to the signed-out
    // calendar. A provider (set by answers.ts, read by calendar.ts) rather than an import - the two
    // modules already depend in the other direction, and a cycle would be load-order roulette.
    answersTasks: null,
    soilRefresh: null,
    // Synthetic demo mode for the R-093 frost render - a UI toggle only; demo seasons are
    // regenerated per draw, never stored, never exported.
    syntheticOn: false,
    // The current address/plot (D-023): every ledger surface reads and writes THIS plot only.
    // The fallback is workspace-aware (D-152): a signed-out device starts on a draft, never on
    // plot_home (which is an ACCOUNT id). A stale stored pointer into the other workspace is
    // healed by the log refresh's visibility guard.
    currentPlotId: (() => {
        try {
            return localStorage.getItem("gg-plot") ?? defaultWorkspacePlotId();
        }
        catch {
            return defaultWorkspacePlotId();
        }
    })(),
    // Cross-page redraw hooks, set by the module that owns each surface once it has started.
    logRefresh: null,
    // O38/O38b: the ZIP/frost tables load on a LOCATION SIGNAL, not eagerly every visit, and are
    // geographically sharded - a call fetches only the cells around the point (or, for a typed ZIP with
    // no location yet, the cells its ZIP3 names). A cold visitor fetches none of it. Idempotent; safe
    // to call from any surface about to need a zone or frost date. app.ts owns it. Args: a located pin
    // passes (lat, lon); a typed ZIP passes (null, null, zip).
    ensureZipData: null,
    // Calendar → Log deep-link (D-127): open the Log with a bed's card expanded (and, when the
    // event names a species, that species' panel selected). Set by setupLog - calendar.ts must not
    // import the log module (page modules stay independent; this object is the seam).
    openLogBed: null,
    refreshUserPlantsUI: null,
    groundRedraw: null,
    groundCenterOn: null,
    // the storage handle, exposed so plan-saving (a Plan-tab action) can write the open season
    logDb: null,
    // the ground map's "use map centre as my location" writes back through this (app.ts owns
    // the lat/lon inputs; groundmap must not import the app layer)
    setLocation: null,
    // the reverse seam: the Where card's "Move garden here" offer executes through this - the
    // map owns the one centroid-preserving move implementation (beds travel, layout intact)
    // plus its own view bookkeeping, so the card must not reimplement the anchor math
    moveGardenTo: null,
    // Does this guild id lay out as HILLS (mounds)? Set by app.ts (it holds the bundle); read by
    // the ground map so a bed PLANNED with a mound team draws no walkway band - the mounds are the
    // access (you step between hills) and the placement reserves nothing, so the map must agree.
    guildIsHills: null,
    // A4 (award-benchmark amendments): seasons since this ground last held a recorded crop
    // (0 = the last closed season; null = no history at all). Supplied by app.ts - rotation
    // recency needs the bundle's family derivation and the ground map is deliberately bundle-free.
    bedRotationSeasons: null,
    // Display preferences (units.ts) bridge the Account page and the sync: applyPrefs adopts a pref
    // PULLED from the account (set by app.ts - it owns the input conversion + redraw); pushPrefs asks
    // the account layer to sync a locally-changed pref (set by account.ts). Both no-op when unset.
    applyPrefs: null,
    pushPrefs: null,
    // On a deliberate sign-in, land the user IN their garden: pick the default/only garden, move the
    // location to its anchor, and open "Your ground" (walkthrough round 21). Set by setupLog (it owns
    // the ledger + location restore); called by account.ts after an interactive sign-in/sign-up.
    onSignIn: null,
    // The mirror of onSignIn: on a deliberate SIGN-OUT, drop back to the default (unauthenticated)
    // garden - reset the current plot to plot_home and clear the location inputs, so the signed-out app
    // never keeps showing the last user's bed and address. Local data is NOT wiped (local-first); only
    // the selection/view resets. Set by setupLog; called by account.ts after sign-out.
    onSignOut: null,
    // Mark this device as "has started planning" so the D-027 landing is skipped from the next load
    // on (app.ts owns the localStorage flag). Set in app.ts; called by onSignIn so a device that pulls
    // an existing account's data lands straight in the garden - the same starting experience as the
    // device the account was created on, even before that plot's anchor/log has synced (D-106).
    markStarted: null,
    // The mirror of markStarted (maintainer 2026-07-31): ending the example garden with no garden
    // of your own returns the device to stranger state, so the landing's doors greet it again.
    clearStarted: null,
    // R-006 (bed reach): the ground map is bundle-free, so app.ts (which has the bundle) supplies the
    // advisory. Given a bed's shorter span in metres, returns the "too wide to reach into - add another
    // bed" note when it exceeds R-006's threshold, else null. Threshold and wording both come from the
    // corpus rule, so the map never hardcodes them. Set in main2.
    bedReachNote: null,
    // R-098 (D-141): the container-too-big advisory, supplied by app.ts (which has the bundle) for the
    // same reason as bedReachNote. Given a bed's LARGEST span in metres, returns the "bigger than a
    // typical container" note when it exceeds R-098's container_max_span_cm, else null. Set in main2.
    bedContainerNote: null,
    // D-141 / R-098: the bed-structure gate, supplied by app.ts for the same reason. Given a bed name,
    // returns which structures its planted guild forbids (a Three Sisters can't go raised, a fruit tree
    // can't leave the ground) and why - so the ground map greys those <option>s and refuses the save.
    // Empty `blocked` = no constraint. Set in main2.
    bedStructureBlockers: null,
    // "Show me an example" (D-029): seed + activate the disposable, non-syncing demo garden so a
    // stranger sees a real, cited plan before entering anything; and its mirror, which tears it down.
    // Both set in setupLog (they route through activatePlot); called by the landing button and the
    // example banner.
    showExample: null,
    // `toLanding` (2026-07-31): the banner's Remove returns a visitor to the landing's doors; the
    // "Start planning" path clears the demo but continues into the planner. Caller's choice.
    removeExample: null,
    // Re-apply the Calendar/Log/Review auth gate (app.ts owns it). Called after a garden switch so the
    // D-029 example-garden PREVIEW (gated tabs unlocked while the demo is active) turns on and off with
    // the active garden. Set in main2.
    refreshAuthGate: null,
    // Re-render the state-aware home (home.ts). Set in main2; called by the calendar's async
    // multi-garden load, whose counts the home's gardens strip is waiting on.
    homeRefresh: null,
    // Drop the home's per-plot posts cache (home.ts). Set in main2; called by the sync when a pull
    // applies team posts, so the returning home's A/B refetch instead of showing a stale feed (O64d).
    invalidateHomePosts: null,
    // Switch the active garden from outside the Log (the home's gardens strip: "tap a garden to work
    // in it"). Set by setupLog - activatePlot moves the location to that garden's anchor and re-reads
    // its ledger, which is exactly what the strip's tap must do.
    switchPlot: null,
    // Re-render the D-152 draft ask-once banner (signed in with a real signed-out draft pending:
    // add to account or discard). Set by setupLog (it owns storage + adoption); called by account.ts
    // whenever the auth state changes so the ask appears/hides with the session.
    refreshDraftBanner: null,
    // O55: the inline editor's "View as" override. "stranger" makes home.ts render the signed-out
    // landing (the doors) even though the maintainer is signed in - the only way to edit that page
    // from the account it is otherwise invisible to. Presentation only; no data is touched.
    viewAs: null,
    // Re-evaluate the Account page's "Edit this site" entry (editor.ts owns it). Called by
    // account.ts on every auth transition with fresh=true, so the permission probe re-asks the
    // server when the signed-in account changes.
    refreshEditEntry: null,
};
export function setCurrentPlot(id) {
    app.currentPlotId = id;
    try {
        localStorage.setItem("gg-plot", id);
    }
    catch { /* fine */ }
}
// The DEFAULT garden (walkthrough round 21): the one sign-in opens (app.onSignIn). A per-device
// preference, kept OUT of the synced ledger - which garden you like to land in is a device habit, not
// account data. Absent = fall back to the only/current garden.
const DEFAULT_PLOT_KEY = "gg-default-plot";
export function defaultPlotId() {
    try {
        return localStorage.getItem(DEFAULT_PLOT_KEY);
    }
    catch {
        return null;
    }
}
export function setDefaultPlot(id) {
    try {
        if (id)
            localStorage.setItem(DEFAULT_PLOT_KEY, id);
        else
            localStorage.removeItem(DEFAULT_PLOT_KEY);
    }
    catch { /* private mode - no default, the fallbacks still work */ }
}
/** The corpus bundle with the user's added varieties folded in - what the engine reasons over so a
 *  user plant appears in eligibility and derives history like any species. Each user variety also gets a
 *  DERIVED `scheduling_model` so the Calendar and the off-season nudge schedule it like a corpus plant: a
 *  perennial carries over (no DTM dates), anything with a days-to-maturity is a DTM crop, everything else
 *  stays unscheduled. This is a web-only scheduling concern - the Python engine has no calendar - so it is
 *  derived here at the consumer, NOT in the conformance-pinned overlay (engine/userspecies.py). */
export function activeBundle(bundle) {
    if (!app.userSpecies.length)
        return bundle;
    const scheduled = app.userSpecies.map((s) => {
        const rec = s;
        if (rec.scheduling_model)
            return s; // already carries one → leave it
        const model = rec.lifespan === "perennial" ? "perennial"
            : rec.days_to_maturity != null ? "dtm" : undefined;
        return model ? { ...rec, scheduling_model: model } : s;
    });
    return mergeUserSpecies(bundle, scheduled);
}
// The app shows human names; the corpus keeps the scientific/id record. commonName reads a species'
// or entity's `common` name, falling back to a humanised id (never a raw snake_case token).
export function commonName(bundle, sid) {
    // User varieties resolve too (last fallback), so a logged/eligible user plant shows its name
    // regardless of which bundle a caller passes - the corpus `common` is a list, a user `common`
    // may be a plain string.
    const hit = bundle.species.find((s) => s.id === sid) ?? bundle.entities.find((e) => e.id === sid)
        ?? app.userSpecies.find((s) => s.id === sid);
    const c = hit?.common;
    const name = Array.isArray(c) ? c[0] : (typeof c === "string" ? c : undefined);
    // Title Case in the DISPLAY layer only (P3 casing pass): the corpus keeps its lowercase `common`
    // record; the app shows it uniformly cased. The humanised-id fallback is a scientific binomial
    // ("Zea mays") and stays as-is - title-casing would wrongly capitalise the species epithet.
    return name != null ? titleCase(name) : humanize(sid);
}
// Rule references read as plain words with the code as a trailing citation ("… (R-010)"), not a
// bare leading "R-010:". ruleClaim gives the rule's own sentence for a hover tooltip on the code,
// so a reader can see what the rule says without leaving the app.
export function ruleClaim(bundle, id) {
    const r = bundle.rules.find((x) => x.id === id);
    return (r?.claim ?? r?.claim_refuted ?? "").trim();
}
// How a bed's ground reads in pickers and the log view: rects by size and place, traced
// polygons by their area and corner count (UI-authored, so it follows the unit toggle).
export const regionLabel = (r) => r.shape === "polygon"
    ? `traced, ${fmtArea(regionArea(r))}, ${r.points.length} corners`
    : `${fmtLen(r.w)} × ${fmtLen(r.h)} at ${fmtLen(r.x)}, ${fmtLen(r.y)}`;
// A round bed is stored as a many-sided regular polygon (the map's circle tool writes a 32-gon), so a
// polygon whose vertices all sit ~the same distance from its centre reads as round, not "traced". The
// 12-corner floor keeps a hand-traced hexagon out; the 8% tolerance clears the app's own perfect 32-gon.
function isRoundPolygon(pts) {
    if (pts.length < 12)
        return false;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const rs = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    return mean > 0 && Math.max(...rs.map((r) => Math.abs(r - mean))) / mean < 0.08;
}
// A bed's shape read the way the user MADE it, not the way it's stored (all shapes are rects or
// polygons underneath). A rotated rect (4 corners + a stored angle) reads by its own edge dims and
// the tilt; a round bed by its diameter; a genuine trace by area + corner count; a plain rect by size.
export function bedShapeLabel(bed) {
    const r = bed.region;
    if (r.shape !== "polygon")
        return `${fmtLen(r.w)} × ${fmtLen(r.h)}`;
    const pts = r.points;
    if (bed.rotation_deg && bed.rotation_deg % 360 !== 0 && pts.length === 4) {
        const w = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
        const l = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
        return `${fmtLen(w)} × ${fmtLen(l)}, rotated ${Math.round(bed.rotation_deg)}°`;
    }
    if (isRoundPolygon(pts)) {
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const meanR = pts.reduce((s, [x, y]) => s + Math.hypot(x - cx, y - cy), 0) / pts.length;
        return `round, ⌀ ${fmtLen(2 * meanR)}`;
    }
    return `traced, ${fmtArea(regionArea(r))}, ${pts.length} corners`;
}
