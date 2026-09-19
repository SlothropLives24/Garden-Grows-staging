import { validateSeason } from "./engine/seasonlog.js";
import { area, intersectArea, parseRegion } from "./engine/regions.js";
import { validateUserSpecies } from "./engine/userspecies.js";
import { validateObservation } from "./engine/soil.js";
import { rememberHemisphere } from "./units.js";
export function plotIdFor(name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return (activeWorkspace() === "account" ? "plot_" : "draft_") + slug;
}
const DB_NAME = "garden-grows-log";
const DB_VERSION = 11;
const SESSION_KEY = "gg-sync-session";
function sessionPresent() {
    try {
        return typeof localStorage !== "undefined" && localStorage.getItem(SESSION_KEY) !== null;
    }
    catch {
        return false;
    }
}
function activeWorkspace() {
    return sessionPresent() ? "account" : "draft";
}
export function plotVisible(plot) {
    return !!plot.example || (plot.owner ?? "draft") === activeWorkspace();
}
export function defaultWorkspacePlotId() {
    return activeWorkspace() === "account" ? "plot_home" : "draft_home";
}
const seasonKey = (plot, id) => `${plot}:${id}`;
function asPromise(r) {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
export function openLog() {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = (ev) => {
            const db = open.result;
            const oldVersion = ev.oldVersion;
            if (!db.objectStoreNames.contains("plots"))
                db.createObjectStore("plots", { keyPath: "id" });
            if (!db.objectStoreNames.contains("sync_meta"))
                db.createObjectStore("sync_meta", { keyPath: "key" });
            if (!db.objectStoreNames.contains("user_species"))
                db.createObjectStore("user_species", { keyPath: "id" });
            if (!db.objectStoreNames.contains("sync_backups"))
                db.createObjectStore("sync_backups", { autoIncrement: true });
            if (!db.objectStoreNames.contains("soil_observations"))
                db.createObjectStore("soil_observations");
            if (!db.objectStoreNames.contains("photos"))
                db.createObjectStore("photos");
            if (!db.objectStoreNames.contains("plot_tombstones"))
                db.createObjectStore("plot_tombstones", { keyPath: "id" });
            if (!db.objectStoreNames.contains("posts"))
                db.createObjectStore("posts");
            if (!db.objectStoreNames.contains("seeds"))
                db.createObjectStore("seeds", { keyPath: "id" });
            if (!db.objectStoreNames.contains("seasons")) {
                db.createObjectStore("seasons");
            }
            else if (oldVersion < 3) {
                const tx = open.transaction;
                const oldSeasons = tx.objectStore("seasons");
                oldSeasons.getAll().onsuccess = (e) => {
                    const rows = e.target.result;
                    db.deleteObjectStore("seasons");
                    const ns = db.createObjectStore("seasons");
                    for (const s of rows)
                        ns.put(s, seasonKey(s.plot, s.id));
                };
                const meta = tx.objectStore("sync_meta");
                meta.getAll().onsuccess = (e) => {
                    for (const m of e.target.result) {
                        const match = /^season:(\d+)$/.exec(m.key);
                        if (match) {
                            meta.delete(m.key);
                            meta.put({ key: `season:plot_home:${match[1]}`, updatedAt: m.updatedAt });
                        }
                    }
                };
            }
            if (oldVersion > 0 && oldVersion < 7) {
                const owner = sessionPresent() ? "account" : "draft";
                const ps = open.transaction.objectStore("plots");
                ps.getAll().onsuccess = (e) => {
                    for (const p of e.target.result) {
                        if (!p.example && !p.owner)
                            ps.put({ ...p, owner });
                    }
                };
            }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error("browser storage is locked by another tab - close other Milpa Gardens tabs and reload"));
    });
}
function store(db, name, mode) {
    return db.transaction(name, mode).objectStore(name);
}
export async function listSeasons(db, plot) {
    const all = await asPromise(store(db, "seasons", "readonly").getAll());
    return plot === undefined ? all : all.filter((s) => s.plot === plot);
}
export function getSeason(db, plot, id) {
    return asPromise(store(db, "seasons", "readonly").get(seasonKey(plot, id)));
}
let onLocalWrite = null;
export function setOnLocalWrite(cb) { onLocalWrite = cb; }
function stamp(db, key) {
    const done = asPromise(store(db, "sync_meta", "readwrite").put({ key, updatedAt: Date.now() }));
    onLocalWrite?.();
    return done;
}
export function listSyncMeta(db) {
    return asPromise(store(db, "sync_meta", "readonly").getAll());
}
function mintPlantingId(taken) {
    for (;;) {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const id = "pl-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        if (!taken.has(id)) {
            taken.add(id);
            return id;
        }
    }
}
export async function putSeason(db, season) {
    const taken = new Set((season.plantings ?? []).map((p) => p.id).filter((x) => !!x));
    const plantings = (season.plantings ?? []).map((p) => (p.id ? p : { ...p, id: mintPlantingId(taken) }));
    const next = season.plantings ? { ...season, plantings } : { ...season };
    const existing = await getSeason(db, season.plot, season.id);
    const now = new Date().toISOString().slice(0, 19) + "Z";
    const alive = new Set(plantings.map((p) => p.id));
    const tombs = new Map();
    for (const t of [...(existing?.removed_plantings ?? []), ...(next.removed_plantings ?? [])]) {
        const prev = tombs.get(t.id);
        if (prev === undefined || t.at > prev)
            tombs.set(t.id, t.at);
    }
    for (const p of existing?.plantings ?? []) {
        if (p.id && !alive.has(p.id) && !tombs.has(p.id))
            tombs.set(p.id, now);
    }
    const removed = [...tombs].filter(([id]) => !alive.has(id))
        .map(([id, at]) => ({ id, at }))
        .sort((x, y) => (x.id < y.id ? -1 : 1));
    if (removed.length)
        next.removed_plantings = removed;
    else
        delete next.removed_plantings;
    const errors = validateSeason(next);
    if (errors.length)
        throw new Error(`refusing to store an invalid season:\n${errors.join("\n")}`);
    await asPromise(store(db, "seasons", "readwrite").put(next, seasonKey(next.plot, next.id)));
    await stamp(db, `season:${next.plot}:${next.id}`);
    return next;
}
const KEEP_BACKUPS = 20;
async function backupReplaced(db, kind, key, existing, incoming) {
    if (existing === undefined || JSON.stringify(existing) === JSON.stringify(incoming))
        return;
    const s = store(db, "sync_backups", "readwrite");
    await asPromise(s.add({ kind, key, record: existing, replacedAt: Date.now() }));
    const keys = await asPromise(s.getAllKeys());
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_BACKUPS)))
        await asPromise(s.delete(k));
}
export async function listSyncBackups(db) {
    const s = store(db, "sync_backups", "readonly");
    const [keys, rows] = [await asPromise(s.getAllKeys()), await asPromise(s.getAll())];
    return rows.map((r, i) => ({ ...r, id: keys[i] })).sort((a, b) => b.replacedAt - a.replacedAt);
}
export async function restoreSyncBackup(db, id) {
    const b = (await listSyncBackups(db)).find((x) => x.id === id);
    if (!b)
        throw new Error("that replaced copy is no longer held on this device");
    if (b.kind === "season")
        await putSeason(db, b.record);
    else if (b.kind === "plot")
        await putPlot(db, b.record);
    else
        await putUserSpecies(db, b.record);
    await asPromise(store(db, "sync_backups", "readwrite").delete(id));
    return b;
}
export async function putSeasonFromSync(db, season, remoteUpdatedAt) {
    const errors = validateSeason(season);
    if (errors.length)
        throw new Error(`refusing to store an invalid season:\n${errors.join("\n")}`);
    const existing = await getSeason(db, season.plot, season.id);
    await backupReplaced(db, "season", seasonKey(season.plot, season.id), existing, season);
    await asPromise(store(db, "seasons", "readwrite").put(season, seasonKey(season.plot, season.id)));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `season:${season.plot}:${season.id}`, updatedAt: remoteUpdatedAt }));
    return season;
}
export function mintPostId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return "post-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function putPost(db, post) {
    if (!post.plot || !post.id)
        throw new Error("a post needs a plot and an id");
    await asPromise(store(db, "posts", "readwrite").put(post, seasonKey(post.plot, post.id)));
    await stamp(db, `post:${post.plot}:${post.id}`);
    return post;
}
export async function listPosts(db, plot) {
    const all = await asPromise(store(db, "posts", "readonly").getAll());
    const rows = plot ? all.filter((p) => p.plot === plot) : all;
    return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
export function validatePost(p) {
    const errors = [];
    if (typeof p !== "object" || p === null)
        return ["post is not an object"];
    const o = p;
    if (typeof o.plot !== "string" || !o.plot)
        errors.push("post.plot must be a non-empty string");
    if (typeof o.id !== "string" || !/^post-[0-9a-f]+$/.test(o.id))
        errors.push("post.id must be a 'post-<hex>' string");
    if (typeof o.author !== "string")
        errors.push("post.author must be a string");
    if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at)))
        errors.push("post.at must be an ISO instant");
    if (typeof o.body !== "string")
        errors.push("post.body must be a string");
    else if (o.body.length > 20000)
        errors.push("post.body exceeds 20000 characters");
    if ("deleted" in o && typeof o.deleted !== "boolean")
        errors.push("post.deleted, if present, must be a boolean");
    return errors;
}
export async function putPostFromSync(db, post, remoteUpdatedAt) {
    const errors = validatePost(post);
    if (errors.length)
        throw new Error(`refusing to store an invalid post:\n${errors.join("\n")}`);
    await asPromise(store(db, "posts", "readwrite").put(post, seasonKey(post.plot, post.id)));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `post:${post.plot}:${post.id}`, updatedAt: remoteUpdatedAt }));
    return post;
}
export function deletePost(db, plot, id) {
    return asPromise(store(db, "posts", "readwrite").delete(seasonKey(plot, id)));
}
export function deleteSeason(db, plot, id) {
    return asPromise(store(db, "seasons", "readwrite").delete(seasonKey(plot, id)));
}
async function updateSeason(db, plot, id, mutate) {
    const season = await getSeason(db, plot, id);
    if (!season)
        throw new Error(`no season ${id} in the log for this address`);
    mutate(season);
    return putSeason(db, season);
}
export function addPlanting(db, plot, seasonId, planting) {
    return updateSeason(db, plot, seasonId, (s) => {
        (s.plantings ??= []).push(planting);
    });
}
export function addObservation(db, plot, seasonId, obs) {
    return updateSeason(db, plot, seasonId, (s) => {
        (s.observations ??= []).push(obs);
    });
}
export function addFailure(db, plot, seasonId, index, failure) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.failures ??= []).push(failure);
    });
}
export function addPlantingNote(db, plot, seasonId, index, note) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.notes ??= []).push(note);
    });
}
const photoKey = (plot, seasonId, name) => `${plot}:${seasonId}:${name}`;
let persistAsked = false;
function ensurePersisted() {
    if (persistAsked)
        return;
    persistAsked = true;
    try {
        void navigator.storage?.persist?.();
    }
    catch { }
}
export async function storageEstimate() {
    try {
        const e = await navigator.storage?.estimate?.();
        if (e && typeof e.usage === "number" && typeof e.quota === "number")
            return { usage: e.usage, quota: e.quota };
    }
    catch { }
    return null;
}
export function putPhoto(db, plot, seasonId, name, blob) {
    ensurePersisted();
    return asPromise(store(db, "photos", "readwrite").put(blob, photoKey(plot, seasonId, name))).then(() => undefined);
}
export function getPhoto(db, plot, seasonId, name) {
    return asPromise(store(db, "photos", "readonly").get(photoKey(plot, seasonId, name)));
}
export function endPlanting(db, plot, seasonId, index, end_cause, end_date) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        p.end_cause = end_cause;
        p.end_date = end_date;
        delete p.carried_over;
    });
}
export function removePlanting(db, plot, seasonId, index) {
    return updateSeason(db, plot, seasonId, (s) => {
        if (!s.plantings?.[index])
            throw new Error(`no planting #${index} in season ${seasonId}`);
        s.plantings.splice(index, 1);
    });
}
export function updatePlanting(db, plot, seasonId, index, patch) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        const rec = p;
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === "")
                delete rec[k];
            else
                rec[k] = v;
        }
        if (rec.end_cause || rec.end_date)
            delete rec.carried_over;
    });
}
export function listPlots(db, workspace) {
    const all = asPromise(store(db, "plots", "readonly").getAll());
    if (workspace === "all")
        return all;
    if (workspace)
        return all.then((ps) => ps.filter((p) => !p.example && (p.owner ?? "draft") === workspace));
    return all.then((ps) => ps.filter(plotVisible));
}
export function getPlot(db, id) {
    return asPromise(store(db, "plots", "readonly").get(id));
}
export async function putPlot(db, plot) {
    if (!plot.id)
        throw new Error("a plot needs an id");
    for (const bed of plot.beds)
        parseRegion(bed.region);
    if (!plot.example && !plot.owner)
        plot.owner = activeWorkspace();
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await stamp(db, `plot:${plot.id}`);
    return plot;
}
export function deletePlot(db, id) {
    return asPromise(store(db, "plots", "readwrite").delete(id));
}
export function listPlotTombstones(db) {
    return asPromise(store(db, "plot_tombstones", "readonly").getAll());
}
function putPlotTombstone(db, t) {
    return asPromise(store(db, "plot_tombstones", "readwrite").put(t));
}
export function deletePlotTombstone(db, id) {
    return asPromise(store(db, "plot_tombstones", "readwrite").delete(id));
}
export async function eraseGarden(db, plotId, opts) {
    const plot = await getPlot(db, plotId);
    const name = opts.name ?? plot?.name ?? plotId;
    const seasons = await listSeasons(db, plotId);
    if (plot)
        await backupReplaced(db, "plot", plotId, plot, null);
    for (const sn of seasons) {
        await backupReplaced(db, "season", `${plotId}:${sn.id}`, sn, null);
        await deleteSeason(db, plotId, sn.id);
    }
    for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === plotId)) {
        await deleteSoilObservation(db, rec);
    }
    if (plot)
        await deletePlot(db, plotId);
    const meta = store(db, "sync_meta", "readwrite");
    await asPromise(meta.delete(`plot:${plotId}`));
    for (const sn of seasons)
        await asPromise(store(db, "sync_meta", "readwrite").delete(`season:${plotId}:${sn.id}`));
    if (opts.tombstone) {
        await putPlotTombstone(db, { id: plotId, name, deletedAt: opts.deletedAt ?? Date.now() });
        onLocalWrite?.();
    }
    return { name, seasons: seasons.length };
}
export async function freePlotId(db, base) {
    let id = base;
    for (let n = 2; await getPlot(db, id); n++)
        id = `${base}_${n}`;
    return id;
}
export async function rekeyPlot(db, oldId, newId, changes = {}) {
    const plot = await getPlot(db, oldId);
    if (!plot)
        throw new Error(`no garden with id ${oldId}`);
    if (oldId !== newId && await getPlot(db, newId))
        throw new Error(`a garden with id ${newId} already exists`);
    const moved = { ...plot, ...changes, id: newId };
    await putPlot(db, moved);
    for (const sn of await listSeasons(db, oldId)) {
        await putSeason(db, { ...sn, plot: newId });
        await deleteSeason(db, oldId, sn.id);
    }
    for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === oldId)) {
        await deleteSoilObservation(db, rec);
        await putSoilObservation(db, { ...rec, plot: newId });
    }
    if (oldId !== newId) {
        await deletePlot(db, oldId);
        await asPromise(store(db, "sync_meta", "readwrite").delete(`plot:${oldId}`));
    }
    return moved;
}
const PLOT_NAME_MAX = 200;
const PLOT_ADDRESS_MAX = 500;
const PLOT_EMAIL_MAX = 320;
const PLOT_BEDS_MAX = 500;
const PLOT_LIST_MAX = 2000;
const PLOT_SUPPORTS_MAX = 50;
const OWN_PLOT_ID_RE = /^(?:plot|draft)_[a-z0-9_]{1,100}$/;
const ACCOUNT_PLOT_ID_RE = /^plot_[a-z0-9_]{1,100}$/;
const SHARED_PLOT_ID_RE = /^shared:[A-Za-z0-9-]{1,8}:plot_[a-z0-9_]{1,100}$/;
const BED_SUN = new Set(["full", "part_shade"]);
const BED_STRUCTURE = new Set(["raised", "in_ground", "container", "field"]);
function isRec(v) { return typeof v === "object" && v !== null && !Array.isArray(v); }
function finiteIn(v, lo, hi) { return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi; }
function plotStr(rec, key, prefix, max, errors, required = false) {
    if (!(key in rec)) {
        if (required)
            errors.push(`${prefix}.${key} is missing`);
        return;
    }
    const v = rec[key];
    if (typeof v !== "string" || v === "")
        errors.push(`${prefix}.${key} must be a non-empty string`);
    else if (v.length > max)
        errors.push(`${prefix}.${key} is longer than ${max} characters`);
}
function plotBool(rec, key, prefix, errors) {
    if (key in rec && typeof rec[key] !== "boolean")
        errors.push(`${prefix}.${key}, if present, must be a boolean`);
}
function plotRegion(rec, prefix, errors) {
    if (!("region" in rec)) {
        errors.push(`${prefix}.region is missing`);
        return;
    }
    try {
        parseRegion(rec.region);
    }
    catch (e) {
        errors.push(`${prefix}.region: ${e.message}`);
    }
}
export function validatePlot(p) {
    const errors = [];
    if (!isRec(p))
        return ["plot is not an object"];
    const sharedId = typeof p.id === "string" && SHARED_PLOT_ID_RE.test(p.id);
    if (typeof p.id !== "string" || !(OWN_PLOT_ID_RE.test(p.id) || sharedId)) {
        errors.push("plot.id must be a plot_<slug>, draft_<slug> or shared:<owner>:plot_<slug> id");
    }
    if ("shared" in p) {
        if (!isRec(p.shared))
            errors.push("plot.shared, if present, must be an object");
        else {
            plotStr(p.shared, "ownerId", "plot.shared", 64, errors, true);
            plotStr(p.shared, "plot", "plot.shared", PLOT_NAME_MAX, errors, true);
            if (typeof p.shared.plot === "string" && !ACCOUNT_PLOT_ID_RE.test(p.shared.plot))
                errors.push("plot.shared.plot must be the owner's plot_<slug> id");
            plotStr(p.shared, "ownerEmail", "plot.shared", PLOT_EMAIL_MAX, errors);
            plotStr(p.shared, "teamName", "plot.shared", PLOT_NAME_MAX, errors);
            if (typeof p.id === "string" && !sharedId)
                errors.push("plot.shared is present but plot.id is not a shared:<owner>:plot_<slug> id");
        }
    }
    else if (sharedId)
        errors.push("plot.id is a shared id but plot.shared is missing");
    if ("owner" in p && p.owner !== "draft" && p.owner !== "account")
        errors.push('plot.owner, if present, must be "draft" or "account"');
    plotBool(p, "example", "plot", errors);
    plotStr(p, "name", "plot", PLOT_NAME_MAX, errors);
    plotStr(p, "address", "plot", PLOT_ADDRESS_MAX, errors);
    if ("anchor" in p) {
        if (!isRec(p.anchor) || !finiteIn(p.anchor.lat, -90, 90) || !finiteIn(p.anchor.lon, -180, 180)) {
            errors.push("plot.anchor must be {lat, lon} with finite lat in [-90, 90] and lon in [-180, 180]");
        }
    }
    if (!Array.isArray(p.beds))
        errors.push("plot.beds must be a list");
    else if (p.beds.length > PLOT_BEDS_MAX)
        errors.push(`plot.beds has more than ${PLOT_BEDS_MAX} entries`);
    else {
        const names = new Map();
        p.beds.forEach((b, i) => {
            const prefix = `plot.beds[${i}]`;
            if (!isRec(b)) {
                errors.push(`${prefix} is not an object`);
                return;
            }
            plotStr(b, "name", prefix, PLOT_NAME_MAX, errors, true);
            if (typeof b.name === "string") {
                const first = names.get(b.name);
                if (first !== undefined)
                    errors.push(`${prefix}.name duplicates plot.beds[${first}].name - bed names are unique within a plot`);
                else
                    names.set(b.name, i);
            }
            plotRegion(b, prefix, errors);
            if ("rotation_deg" in b && !finiteIn(b.rotation_deg, -360, 360))
                errors.push(`${prefix}.rotation_deg must be a finite number of degrees`);
            for (const k of ["planted", "lane_flip", "sized"])
                plotBool(b, k, prefix, errors);
            if ("sun" in b && !BED_SUN.has(b.sun))
                errors.push(`${prefix}.sun must be one of ${[...BED_SUN].join(" | ")}`);
            if ("structure" in b && !BED_STRUCTURE.has(b.structure))
                errors.push(`${prefix}.structure must be one of ${[...BED_STRUCTURE].join(" | ")}`);
            if ("supports" in b) {
                if (!Array.isArray(b.supports))
                    errors.push(`${prefix}.supports must be a list`);
                else if (b.supports.length > PLOT_SUPPORTS_MAX)
                    errors.push(`${prefix}.supports has more than ${PLOT_SUPPORTS_MAX} entries`);
                else
                    b.supports.forEach((s, j) => {
                        if (!isRec(s))
                            errors.push(`${prefix}.supports[${j}] is not an object`);
                        else
                            plotStr(s, "id", `${prefix}.supports[${j}]`, PLOT_NAME_MAX, errors, true);
                    });
            }
        });
    }
    if ("removedBeds" in p) {
        if (!Array.isArray(p.removedBeds))
            errors.push("plot.removedBeds must be a list");
        else if (p.removedBeds.length > PLOT_LIST_MAX)
            errors.push(`plot.removedBeds has more than ${PLOT_LIST_MAX} entries`);
        else
            p.removedBeds.forEach((t, i) => {
                const prefix = `plot.removedBeds[${i}]`;
                if (!isRec(t)) {
                    errors.push(`${prefix} is not an object`);
                    return;
                }
                plotStr(t, "name", prefix, PLOT_NAME_MAX, errors, true);
                if (!finiteIn(t.at, 0, 8.64e15))
                    errors.push(`${prefix}.at must be a finite ms-epoch time`);
            });
    }
    if ("prior_occupancy" in p) {
        if (!Array.isArray(p.prior_occupancy))
            errors.push("plot.prior_occupancy must be a list");
        else if (p.prior_occupancy.length > PLOT_LIST_MAX)
            errors.push(`plot.prior_occupancy has more than ${PLOT_LIST_MAX} entries`);
        else
            p.prior_occupancy.forEach((o, i) => {
                const prefix = `plot.prior_occupancy[${i}]`;
                if (!isRec(o)) {
                    errors.push(`${prefix} is not an object`);
                    return;
                }
                plotRegion(o, prefix, errors);
                if (!Number.isInteger(o.year) || !finiteIn(o.year, 1900, 2200))
                    errors.push(`${prefix}.year must be a plausible integer year`);
                if (!Array.isArray(o.families))
                    errors.push(`${prefix}.families must be a list`);
                else if (o.families.length > PLOT_SUPPORTS_MAX)
                    errors.push(`${prefix}.families has more than ${PLOT_SUPPORTS_MAX} entries`);
                else if (!o.families.every((f) => typeof f === "string" && f !== "" && f.length <= PLOT_NAME_MAX))
                    errors.push(`${prefix}.families must be non-empty family keys`);
            });
    }
    return errors;
}
export async function putPlotFromSync(db, plot, remoteUpdatedAt) {
    const errors = validatePlot(plot);
    if (errors.length)
        throw new Error(`refusing to store an invalid plot:\n${errors.join("\n")}`);
    let existing = await getPlot(db, plot.id);
    if (existing && !existing.example && (existing.owner ?? "draft") === "draft") {
        await rekeyPlot(db, plot.id, await freePlotId(db, `draft_${plot.id.replace(/^(?:plot|draft)_/, "")}`));
        existing = undefined;
    }
    plot.owner = "account";
    await backupReplaced(db, "plot", plot.id, existing, plot);
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `plot:${plot.id}`, updatedAt: remoteUpdatedAt }));
    return plot;
}
export async function setPlotAnchorOnce(db, plotId, lat, lon, address) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    if (!plot.anchor) {
        plot.anchor = { lat, lon };
        rememberHemisphere(lat);
        const a = address?.trim();
        if (a && !plot.address)
            plot.address = a;
        return putPlot(db, plot);
    }
    return plot;
}
export async function moveGarden(db, plotId, lat, lon, address) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    plot.anchor = { lat, lon };
    rememberHemisphere(lat);
    const a = address?.trim();
    if (a)
        plot.address = a;
    else
        delete plot.address;
    return putPlot(db, plot);
}
export async function setBedPlanted(db, plotId, name, planted) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const bed = plot.beds.find((b) => b.name === name);
    if (bed) {
        if (planted)
            bed.planted = true;
        else
            delete bed.planted;
    }
    return putPlot(db, plot);
}
export async function removeBed(db, plotId, name, openSeasonId = null) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const removed = plot.beds.find((b) => b.name === name);
    plot.beds = plot.beds.filter((b) => b.name !== name);
    if (removed)
        plot.removedBeds = [...(plot.removedBeds ?? []).filter((t) => t.name !== name), { name, at: Date.now() }];
    if (openSeasonId != null && removed) {
        const season = await getSeason(db, plotId, openSeasonId);
        if (season) {
            const ps = season.plantings ?? [];
            const keptP = ps.filter((p) => { const a = area(p.region); return !(a > 0 && intersectArea(p.region, removed.region) >= 0.5 * a); });
            const plan = (Array.isArray(season.plan) ? season.plan : []);
            const keptPlan = plan.filter((e) => e.area !== name);
            const nextPlan = (Array.isArray(season.next_plan) ? season.next_plan : []);
            const keptNext = nextPlan.filter((e) => e.area !== name);
            if (keptP.length !== ps.length || keptPlan.length !== plan.length || keptNext.length !== nextPlan.length) {
                await putSeason(db, { ...season, plantings: keptP, plan: keptPlan, ...(nextPlan.length ? { next_plan: keptNext } : {}) });
            }
        }
    }
    return putPlot(db, plot);
}
export async function renameBed(db, plotId, oldName, newName) {
    const nn = newName.trim();
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    if (!nn)
        throw new Error("a bed needs a name");
    if (nn === oldName)
        return plot;
    if (plot.beds.some((b) => b.name === nn))
        throw new Error(`a bed called “${nn}” already exists`);
    const bed = plot.beds.find((b) => b.name === oldName);
    if (!bed)
        throw new Error(`no bed “${oldName}”`);
    bed.name = nn;
    plot.removedBeds = [...(plot.removedBeds ?? []).filter((t) => t.name !== oldName && t.name !== nn), { name: oldName, at: Date.now() }];
    if (!plot.removedBeds.length)
        delete plot.removedBeds;
    await putPlot(db, plot);
    for (const season of await listSeasons(db, plotId)) {
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        const nextPlan = (Array.isArray(season.next_plan) ? season.next_plan : []);
        const inPlan = plan.some((e) => e.area === oldName), inNext = nextPlan.some((e) => e.area === oldName);
        if (inPlan || inNext) {
            await putSeason(db, { ...season,
                ...(inPlan ? { plan: plan.map((e) => (e.area === oldName ? { ...e, area: nn } : e)) } : {}),
                ...(inNext ? { next_plan: nextPlan.map((e) => (e.area === oldName ? { ...e, area: nn } : e)) } : {}) });
        }
    }
    return plot;
}
export async function setPlotName(db, plotId, name) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const nn = name.trim();
    if (nn)
        plot.name = nn;
    else
        delete plot.name;
    return putPlot(db, plot);
}
export async function placeBed(db, plotId, name, region, rotationDeg, sun, structure, sized, laneFlip) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const prev = plot.beds.find((b) => b.name === name);
    const bed = { name, region: parseRegion(region) };
    if (sized)
        bed.sized = true;
    if (typeof rotationDeg === "number" && Number.isFinite(rotationDeg) && rotationDeg % 360 !== 0) {
        bed.rotation_deg = ((rotationDeg % 360) + 360) % 360;
    }
    if (prev?.planted)
        bed.planted = true;
    const nextSun = sun === undefined ? prev?.sun : (sun ?? undefined);
    if (nextSun === "full" || nextSun === "part_shade")
        bed.sun = nextSun;
    const nextStruct = structure === undefined ? prev?.structure : (structure ?? undefined);
    if (nextStruct === "raised" || nextStruct === "in_ground" || nextStruct === "container" || nextStruct === "field") {
        bed.structure = nextStruct;
    }
    const nextFlip = laneFlip === undefined ? prev?.lane_flip : (laneFlip ?? undefined);
    if (nextFlip === true)
        bed.lane_flip = true;
    plot.beds = [...plot.beds.filter((b) => b.name !== name), bed];
    if (plot.removedBeds?.length) {
        const remaining = plot.removedBeds.filter((t) => t.name !== name);
        if (remaining.length)
            plot.removedBeds = remaining;
        else
            delete plot.removedBeds;
    }
    return putPlot(db, plot);
}
export async function setPriorOccupancy(db, plotId, region, year, families) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const key = JSON.stringify(parseRegion(region));
    const rest = (plot.prior_occupancy ?? []).filter((s) => JSON.stringify(parseRegion(s.region)) !== key);
    const fams = [...new Set(families)].filter(Boolean).sort();
    if (fams.length)
        plot.prior_occupancy = [...rest, { region: parseRegion(region), year, families: fams }];
    else if (rest.length)
        plot.prior_occupancy = rest;
    else
        delete plot.prior_occupancy;
    return putPlot(db, plot);
}
export function listUserSpecies(db) {
    return asPromise(store(db, "user_species", "readonly").getAll());
}
const soilKey = (rec) => `${rec.plot}:${rec.date}:${rec.region ? JSON.stringify(rec.region) : ""}` +
    (rec.ph === undefined ? "" : ":ph");
export function listSoilObservations(db) {
    return asPromise(store(db, "soil_observations", "readonly").getAll());
}
export async function putSoilObservation(db, rec) {
    const errors = validateObservation(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    await asPromise(store(db, "soil_observations", "readwrite").put(rec, soilKey(rec)));
    await stamp(db, `soil:${soilKey(rec)}`);
    return rec;
}
export async function deleteSoilObservation(db, rec) {
    await asPromise(store(db, "soil_observations", "readwrite").delete(soilKey(rec)));
    await stamp(db, `soil:${soilKey(rec)}`);
}
export async function putUserSpecies(db, rec) {
    const errors = validateUserSpecies(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    await asPromise(store(db, "user_species", "readwrite").put(rec));
    await stamp(db, `user_species:${rec.id}`);
    return rec;
}
export async function deleteUserSpecies(db, id) {
    await asPromise(store(db, "user_species", "readwrite").delete(id));
    await asPromise(store(db, "sync_meta", "readwrite").delete(`user_species:${id}`));
}
export async function putUserSpeciesFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateUserSpecies(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listUserSpecies(db)).find((u) => u.id === rec.id);
    await backupReplaced(db, "user_species", rec.id, existing, rec);
    await asPromise(store(db, "user_species", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `user_species:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}
export function validateSeed(rec) {
    const errs = [];
    if (!rec || typeof rec !== "object")
        return ["seed is not an object"];
    if (typeof rec.id !== "string" || !rec.id)
        errs.push("seed.id must be a non-empty string");
    if (typeof rec.species !== "string" || !rec.species)
        errs.push("seed.species must be a non-empty string");
    for (const f of ["group", "variety", "quantity", "notes"]) {
        if (rec[f] !== undefined && typeof rec[f] !== "string")
            errs.push(`seed.${f} must be a string`);
        if (typeof rec[f] === "string" && rec[f].length > 500)
            errs.push(`seed.${f} is too long`);
    }
    if (rec.year !== undefined && (typeof rec.year !== "number" || !Number.isInteger(rec.year)
        || rec.year < 1900 || rec.year > 2200))
        errs.push("seed.year must be a plausible year");
    return errs;
}
export function listSeeds(db) {
    return asPromise(store(db, "seeds", "readonly").getAll());
}
export async function putSeed(db, rec) {
    const errors = validateSeed(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    await asPromise(store(db, "seeds", "readwrite").put(rec));
    await stamp(db, `seed:${rec.id}`);
    return rec;
}
export async function deleteSeed(db, id) {
    await asPromise(store(db, "seeds", "readwrite").delete(id));
    await asPromise(store(db, "sync_meta", "readwrite").delete(`seed:${id}`));
}
export async function putSeedFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateSeed(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listSeeds(db)).find((s) => s.id === rec.id);
    await backupReplaced(db, "seed", rec.id, existing, rec);
    await asPromise(store(db, "seeds", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `seed:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}
