import { app } from "./state.js";
import { forwardCarried, seedNextPlan } from "./engine/seasonlog.js";
let pointer = null;
export function seasonId() {
    return pointer;
}
export function setSeasonId(id) {
    pointer = id;
    app.logSnapshot.seasonId = id;
}
export function resolveSeasonId(seasons, chosen) {
    const open = seasons.filter((s) => !s.closed_date);
    if (chosen != null && open.some((s) => s.id === chosen))
        return chosen;
    return open.length ? open.reduce((a, b) => (a.id >= b.id ? a : b)).id : null;
}
export function openSeason() {
    return pointer == null ? null : app.logSnapshot.seasons.find((s) => s.id === pointer) ?? null;
}
export function priorSeasons() {
    return app.logSnapshot.seasons.filter((s) => s.id !== pointer);
}
export function seasonById(id) {
    return id == null ? null : app.logSnapshot.seasons.find((s) => s.id === id) ?? null;
}
export function upsertSeasonSnapshot(updated) {
    const i = app.logSnapshot.seasons.findIndex((s) => s.id === updated.id);
    if (i >= 0)
        app.logSnapshot.seasons[i] = updated;
    else
        app.logSnapshot.seasons.push(updated);
}
export function lifespanPersists(species) {
    const life = species?.lifespan;
    return life === "perennial" || life === "biennial";
}
export function resolvePlantingAtClose(p, cause, date, persists) {
    if (p.end_cause || p.carried_over)
        return p;
    return persists(p.species) ? { ...p, carried_over: true } : { ...p, end_cause: cause, end_date: date };
}
export function closedBed(season, onBed, resolve) {
    return { ...season, plantings: (season.plantings ?? []).map((p) => (onBed(p) ? resolve(p) : p)) };
}
export function rolledSeason(season, resolve, date) {
    return { ...season, plantings: (season.plantings ?? []).map(resolve), closed_date: date };
}
export function reopenedSeason(season) {
    const reopened = { ...season };
    delete reopened.closed_date;
    return reopened;
}
export function nextSeasonFrom(season, existing, plotId) {
    const nextId = season.id + 1;
    const base = existing ?? { id: nextId, plot: plotId, plantings: [], observations: [] };
    const forwarded = forwardCarried(season.plantings ?? [], base.plantings ?? []);
    const plantings = [...(base.plantings ?? []), ...forwarded];
    return { season: seedNextPlan(season, { ...base, plantings }), carried: forwarded.length };
}
