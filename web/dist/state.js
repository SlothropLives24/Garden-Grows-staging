import { humanize, titleCase } from "./engine/labels.js";
import { area as regionArea } from "./engine/regions.js";
import { mergeUserSpecies } from "./engine/userspecies.js";
import { defaultWorkspacePlotId } from "./storage.js";
import { fmtArea, fmtLen } from "./units.js";
export const app = {
    speciesName: null,
    planDots: [],
    draftPlantings: [],
    logSnapshot: { seasons: [], beds: [], seasonId: null, priorOccupancy: [] },
    currentPlot: null,
    userSpecies: [],
    soilObservations: [],
    answersTasks: null,
    soilRefresh: null,
    syntheticOn: false,
    currentPlotId: (() => {
        try {
            return localStorage.getItem("gg-plot") ?? defaultWorkspacePlotId();
        }
        catch {
            return defaultWorkspacePlotId();
        }
    })(),
    logRefresh: null,
    logHydrated: false,
    ensureZipData: null,
    openLogBed: null,
    markBedPlantedFromPlan: null,
    revertBedToDraftFromPlan: null,
    teamLabel: null,
    openBedSheet: null,
    planReceipt: null,
    bedPlantWindow: null,
    focusTeam: null,
    bedCalendarJobs: null,
    plannedSpotFor: null,
    needsAccountToPlant: null,
    refreshUserPlantsUI: null,
    groundRedraw: null,
    groundCenterOn: null,
    groundRefit: null,
    groundRefitIfDrifted: null,
    groundProposeRect: null,
    groundClearProposal: null,
    groundKeepProposal: null,
    groundEditProposal: null,
    groundProposalTaken: null,
    logDb: null,
    setLocation: null,
    moveGardenTo: null,
    guildIsHills: null,
    bedRotationSeasons: null,
    applyPrefs: null,
    pushPrefs: null,
    onSignIn: null,
    openAuthSheet: null,
    closeAuthSheet: null,
    onSignOut: null,
    resetPlanStep: null,
    markStarted: null,
    clearStarted: null,
    bedReachNote: null,
    bedContainerNote: null,
    bedStructureBlockers: null,
    showExample: null,
    removeExample: null,
    refreshAuthGate: null,
    homeRefresh: null,
    invalidateHomePosts: null,
    switchPlot: null,
    openWeek: null,
    gardenFacts: null,
    bedFacts: null,
    refreshDraftBanner: null,
    startNextSeason: null,
    viewAs: null,
    refreshEditEntry: null,
};
export function setCurrentPlot(id) {
    app.currentPlotId = id;
    try {
        localStorage.setItem("gg-plot", id);
    }
    catch { }
}
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
    catch { }
}
export function activeBundle(bundle) {
    if (!app.userSpecies.length)
        return bundle;
    const scheduled = app.userSpecies.map((s) => {
        const rec = s;
        if (rec.scheduling_model)
            return s;
        const model = rec.lifespan === "perennial" ? "perennial"
            : rec.days_to_maturity != null ? "dtm" : undefined;
        return model ? { ...rec, scheduling_model: model } : s;
    });
    return mergeUserSpecies(bundle, scheduled);
}
export function commonName(bundle, sid) {
    const hit = bundle.species.find((s) => s.id === sid) ?? bundle.entities.find((e) => e.id === sid)
        ?? app.userSpecies.find((s) => s.id === sid);
    const c = hit?.common;
    const name = Array.isArray(c) ? c[0] : (typeof c === "string" ? c : undefined);
    return name != null ? titleCase(name) : humanize(sid);
}
export function plantingLabel(bundle, sid, group) {
    const name = commonName(bundle, sid);
    if (!group)
        return name;
    const sp = bundle.species.find((s) => s.id === sid)
        ?? app.userSpecies.find((s) => s.id === sid);
    const groups = Array.isArray(sp?.cultivar_groups)
        ? sp.cultivar_groups : [];
    const g = groups.find((x) => String(x.id) === group);
    const own = typeof g?.common === "string" ? g.common
        : Array.isArray(g?.common) ? String(g.common[0]) : "";
    return own ? titleCase(own) : `${name} - ${humanize(group)}`;
}
export function ruleClaim(bundle, id) {
    const r = bundle.rules.find((x) => x.id === id);
    return (r?.claim ?? r?.claim_refuted ?? "").trim();
}
export const regionLabel = (r) => r.shape === "polygon"
    ? `traced, ${fmtArea(regionArea(r))}, ${r.points.length} corners`
    : `${fmtLen(r.w)} × ${fmtLen(r.h)} at ${fmtLen(r.x)}, ${fmtLen(r.y)}`;
function isRoundPolygon(pts) {
    if (pts.length < 12)
        return false;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const rs = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    return mean > 0 && Math.max(...rs.map((r) => Math.abs(r - mean))) / mean < 0.08;
}
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
const PLAN_FRESH_KEY = "gg-plan-fresh";
export function markPlanFresh() {
    try {
        localStorage.setItem(PLAN_FRESH_KEY, "1");
    }
    catch { }
}
export function takePlanFresh() {
    try {
        const on = localStorage.getItem(PLAN_FRESH_KEY) === "1";
        if (on)
            localStorage.removeItem(PLAN_FRESH_KEY);
        return on;
    }
    catch {
        return false;
    }
}
