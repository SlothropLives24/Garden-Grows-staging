// Season-log storage adapter - IndexedDB, browser-local (D-013 storage v1). APP LAYER ONLY.
//
// USER DATA lives here and nowhere else: it is never mixed into the app bundle, never sent
// anywhere, and never committed to this repo (the corpus is the product; the log is the user's).
// The engine (web/src/engine/, DOM-free - the lint enforces it) only ever sees records this
// adapter hands it: validation and the occupancy→history derivation are pure functions there.
// A React Native app later replaces this one file (AsyncStorage/SQLite) and imports the engine
// unchanged. The v2 migration path is the EXPORT format (byte-identical git-format YAML), not
// this database - IndexedDB is disposable by design.
//
// Two object stores:
//   seasons - one record per season year, the full D-013 record (plantings + observations
//             inline). The season is the unit of validation, of export, and of a future git
//             commit; sub-record CRUD is read-modify-write on the season, so a stored season
//             is always a valid one (writes that fail validation are refused loudly).
//   plots   - the current plot: a persistent coordinate space with named bed rects laid over
//             it (intake's bed W×L becomes a placed rect). Beds are geometry, not identity:
//             plantings record REGIONS in plot coordinates (D-002), so rearranging beds never
//             touches history.
import { validateSeason } from "./engine/seasonlog.js";
import { area, intersectArea, parseRegion } from "./engine/regions.js";
import { validateUserSpecies } from "./engine/userspecies.js";
import { validateObservation } from "./engine/soil.js";
import { rememberHemisphere } from "./units.js";
/** A human-friendly id for a new plot/address (D-023): "lake cabin" → plot_lake_cabin. The prefix
 *  carries the workspace (D-152): a garden made signed out is draft_lake_cabin, so a draft and an
 *  account garden can never collide on an id. */
export function plotIdFor(name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return (activeWorkspace() === "account" ? "plot_" : "draft_") + slug;
}
const DB_NAME = "garden-grows-log";
// v2 (Phase 4 / D-020): + sync_meta - a per-record updatedAt stamp so the account sync can
// tell which side of a difference is newer. Data stores are untouched; the upgrade is additive.
// v3 (D-023): seasons are keyed `${plot}:${id}` (out-of-line - the record itself stays the
// pure D-013 schema) so each address/plot keeps its own ledger. Existing rows migrate in
// place; they were all plot_home.
// v4 (roadmap corpus-growth): + user_species - plant varieties the user adds that the curated
// corpus does not model (engine/userspecies.py). USER DATA, keyed by the user:<slug> id,
// device-global (a plant definition is knowledge, not tied to one yard - its eligibility is
// scoped by the current plot's history, not by where it was defined). Purely additive; no
// existing store is touched.
// v5 (D-125): + sync_backups - the copy a sync pull is about to REPLACE, snapshotted first, ring
// buffer of the newest few. Born from a real loss: a pre-D-124 poisoned upload carried a fresh
// stamp, so the maintainer's phone pulled a stale season over its real plantings - announced in
// the notes, but not recoverable. Now every replacement is one tap from restored. Additive.
// v6 (D-148 P0): + soil_observations - what the gardener tells us about a piece of GROUND (texture,
// drainage), time-stamped, keyed `${plot}:${date}:${regionKey}` so a plot keeps a SERIES rather than a
// single overwritten value. Soil is amended, limed and compacted; a 2024 reading is evidence about
// 2024, not a stale field to replace. Additive; no existing store is touched.
// v7 (D-152): every plot gains an `owner` workspace tag. Existing plots are classified by the auth
// state at migration time - a device holding a session owns account data, a signed-out device holds
// drafts. Ids are NOT rewritten here (a legacy draft may keep plot_home); the id space separates
// lazily - putPlotFromSync moves a colliding draft aside the first time the account's plot of the
// same id arrives.
// v8 (O20/D-166): + plot_tombstones - a deleted garden's marker, so the deletion propagates through
// sync instead of the plot resurrecting from any device that still holds a copy (record-level
// deletion was untracked before; D-092's bed tombstones are the same idea one level down). The
// marker carries only id + display name + when - never garden data. Additive.
// v9 (O6/D-171): + photos - the gardener's own photos, DEVICE-ONLY and silent like sync_backups
// (no sync stamps written; soil_observations' stamps-nothing-reads trap deliberately not copied).
// Out-of-line keys `${plot}:${seasonId}:${filename}`; the record is the downscaled JPEG Blob
// itself. The season record carries only the FILENAME (a note's `photo`); the bytes live here
// and in the export zip, never in the YAML. Additive; no existing store is touched.
// v11 (O111b): + seeds - the gardener's seed box (what varieties they OWN), so a plan can subtract
// what you have from what it needs (O111c's shopping list). User data like user_species: never the
// corpus, never the engine, never committed. Syncs under kind 'seed'. Additive; no store is touched.
const DB_VERSION = 11;
// --- workspaces (D-152) -------------------------------------------------------------
// The auth session is the single source of truth for which workspace is active. storage reads the
// key directly (account.ts owns writing it) so there is no init-order or import-cycle problem: the
// filter is correct from the first openLog, before the account module has even loaded.
const SESSION_KEY = "gg-sync-session";
function sessionPresent() {
    try {
        return typeof localStorage !== "undefined" && localStorage.getItem(SESSION_KEY) !== null;
    }
    catch {
        return false;
    }
}
export function activeWorkspace() {
    return sessionPresent() ? "account" : "draft";
}
/** Is this plot visible in the ACTIVE workspace? The example garden shows in both (it is a demo,
 *  not anyone's data); everything else shows only on its own side. */
export function plotVisible(plot) {
    return !!plot.example || (plot.owner ?? "draft") === activeWorkspace();
}
/** The id a brand-new default garden gets in the active workspace. */
export function defaultWorkspacePlotId() {
    return activeWorkspace() === "account" ? "plot_home" : "draft_home";
}
/** The season-store key for a plot's season - one ledger per plot (D-023). */
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
            // v4: user-added plant varieties (additive - no data migration).
            if (!db.objectStoreNames.contains("user_species"))
                db.createObjectStore("user_species", { keyPath: "id" });
            // v5: pre-replacement snapshots for sync pulls (additive - no data migration).
            if (!db.objectStoreNames.contains("sync_backups"))
                db.createObjectStore("sync_backups", { autoIncrement: true });
            // v6: soil observations (additive - no data migration). Out-of-line keys, like seasons.
            if (!db.objectStoreNames.contains("soil_observations"))
                db.createObjectStore("soil_observations");
            // v9: photos (additive - no data migration). Out-of-line `${plot}:${seasonId}:${filename}` keys.
            if (!db.objectStoreNames.contains("photos"))
                db.createObjectStore("photos");
            if (!db.objectStoreNames.contains("plot_tombstones"))
                db.createObjectStore("plot_tombstones", { keyPath: "id" });
            // v10: team posts (D-172). Conversation on a garden, members-only - NOT the season vocabulary,
            // never the engine, never the export. Out-of-line `${plot}:${postId}` keys, like seasons.
            if (!db.objectStoreNames.contains("posts"))
                db.createObjectStore("posts");
            // v11: the seed box (O111b). Keyed by id, like user_species. Additive; no data migration.
            if (!db.objectStoreNames.contains("seeds"))
                db.createObjectStore("seeds", { keyPath: "id" });
            if (!db.objectStoreNames.contains("seasons")) {
                db.createObjectStore("seasons"); // v3: out-of-line `${plot}:${id}` keys
            }
            else if (oldVersion < 3) {
                // v1/v2 → v3: re-key existing seasons (all plot_home) and their sync stamps.
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
            // v7 (D-152): classify existing plots by the auth state at migration time. A device holding a
            // session has been syncing - its plots are the account's; a signed-out device holds drafts.
            // Ids are untouched (see putPlotFromSync for the lazy collision move).
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
        // A pending delete or an old version held by another tab would otherwise hang this open
        // FOREVER, silently taking the whole log (and account init) down with it. Say it instead.
        open.onblocked = () => reject(new Error("browser storage is locked by another tab - close other Milpa Gardens tabs and reload"));
    });
}
function store(db, name, mode) {
    return db.transaction(name, mode).objectStore(name);
}
// --- seasons ---------------------------------------------------------------------
/** All seasons, or one plot's ledger when `plot` is given (D-023). */
export async function listSeasons(db, plot) {
    const all = await asPromise(store(db, "seasons", "readonly").getAll());
    return plot === undefined ? all : all.filter((s) => s.plot === plot);
}
export function getSeason(db, plot, id) {
    return asPromise(store(db, "seasons", "readonly").get(seasonKey(plot, id)));
}
// A hook the app registers (account.ts) to auto-sync soon after a LOCAL edit. Every genuine local
// write stamps sync_meta with Date.now() through here, so firing from stamp() catches exactly the
// user's own edits - a sync-applied PULL writes the remote timestamp directly (putSeasonFromSync et
// al.), never through stamp(), so the auto-sync it triggers can never loop back on its own pulls.
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
/** Persist a season record - refused loudly if it does not validate (a stored season is always
 *  a valid one; the schema is the contract, not a suggestion). Open-season semantics: plantings
 *  still in the ground may omit their end pair until the season is closed. */
// O56 merge arc: every planting carries a minted identity, so two devices' edits to one season can
// merge planting-by-planting (sync.ts mergeSeasons) instead of clobbering whole-record. Minted HERE,
// the one choke point every app save funnels through - which also backfills ids onto legacy
// plantings the first time an old season is saved again. Opaque, YAML-safe charset.
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
    // mint ids for any planting that lacks one (new plantings and legacy records alike)
    const taken = new Set((season.plantings ?? []).map((p) => p.id).filter((x) => !!x));
    const plantings = (season.plantings ?? []).map((p) => (p.id ? p : { ...p, id: mintPlantingId(taken) }));
    const next = season.plantings ? { ...season, plantings } : { ...season };
    // deletion tombstones (D-092's rule, one level down): an id the STORED copy carries that this
    // save no longer does was deleted on this device - record it, so a sync union cannot resurrect
    // it from a device that still holds a copy. A re-added id prunes its tombstone.
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
// --- pre-replacement snapshots (D-125) --------------------------------------------
// Before a sync pull REPLACES a differing local record, the outgoing copy is snapshotted here -
// a ring buffer of the newest KEEP_BACKUPS. A bad merge (a poisoned upload, a mis-stamped device)
// then costs one tap, not a season of logging. Local-only and deliberately NOT synced: it is this
// device's undo, and syncing it would re-enter the very machinery it guards against.
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
/** The replaced copies this device still holds, newest first. */
export async function listSyncBackups(db) {
    const s = store(db, "sync_backups", "readonly");
    const [keys, rows] = [await asPromise(s.getAllKeys()), await asPromise(s.getAll())];
    return rows.map((r, i) => ({ ...r, id: keys[i] })).sort((a, b) => b.replacedAt - a.replacedAt);
}
/** Restore a replaced copy: write it back through the STAMPING path, so it counts as this
 *  device's newest edit and the next sync pushes it back over the account. The backup entry is
 *  consumed; the copy it displaces is itself snapshotted by the next pull if anything differs. */
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
/** putSeason WITHOUT restamping - used when sync applies a remote record, so the remote
 *  timestamp (kept by the caller) stays authoritative and a pull does not masquerade as a
 *  fresh local edit. The replaced copy is snapshotted first (D-125). */
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
/** Write a post (a local edit → stamps → auto-syncs like any record). */
export async function putPost(db, post) {
    if (!post.plot || !post.id)
        throw new Error("a post needs a plot and an id");
    await asPromise(store(db, "posts", "readwrite").put(post, seasonKey(post.plot, post.id)));
    await stamp(db, `post:${post.plot}:${post.id}`);
    return post;
}
/** Posts on a garden (or all, no arg), newest first. */
export async function listPosts(db, plot) {
    const all = await asPromise(store(db, "posts", "readonly").getAll());
    const rows = plot ? all.filter((p) => p.plot === plot) : all;
    return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
/** Shape-check a post before it is trusted. A synced post is untrusted input from "another device"
 *  - which, after a phishing win or a forced team membership, means an attacker - so the pull path
 *  re-validates it, exactly as putSeasonFromSync does for seasons (the SECURITY.md standing rule:
 *  "New sync record kind? It must re-validate on pull"). Rendering is already textContent-only, so
 *  this guards storage integrity (well-typed rows, bounded size), not XSS. */
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
/** putPost WITHOUT restamping - used when sync applies a remote post (the remote time stays authoritative). */
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
/** Record a dated failure event on a planting ({date, mode, severity} - closed severity
 *  vocabulary, validated on write like everything else). Failures are planting-level; frost
 *  and heat land on ground and belong in observations instead. */
export function addFailure(db, plot, seasonId, index, failure) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.failures ??= []).push(failure);
    });
}
/** Pin a free-text note to one planting (walkthrough). Mirrors addFailure - the index is the
 *  planting's position in the season record; the note is dated so the Calendar can place it. */
export function addPlantingNote(db, plot, seasonId, index, note) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        (p.notes ??= []).push(note);
    });
}
// --- photos (O6 / D-171) -----------------------------------------------------------------------
// Device-only and SILENT (sync_backups' precedent): nothing here writes a sync stamp. The season
// record names the file; these hold the bytes. Keys are `${plot}:${seasonId}:${filename}` and the
// filename is validated upstream (no path separators - the namespace is flat).
const photoKey = (plot, seasonId, name) => `${plot}:${seasonId}:${name}`;
/** Ask the browser to protect this origin from silent eviction - D-171's own failure mode. Called
 *  on the FIRST photo save (photos are the first unbounded data the app holds); a refusal is fine,
 *  the quota error path still reports honestly when a write is refused. */
let persistAsked = false;
export function ensurePersisted() {
    if (persistAsked)
        return;
    persistAsked = true;
    try {
        void navigator.storage?.persist?.();
    }
    catch { /* not supported - nothing to protect with */ }
}
/** What photos actually cost, for the garden-knows row: bytes used and the device's own quota,
 *  or null where the browser will not say. */
export async function storageEstimate() {
    try {
        const e = await navigator.storage?.estimate?.();
        if (e && typeof e.usage === "number" && typeof e.quota === "number")
            return { usage: e.usage, quota: e.quota };
    }
    catch { /* fall through */ }
    return null;
}
export function putPhoto(db, plot, seasonId, name, blob) {
    ensurePersisted();
    return asPromise(store(db, "photos", "readwrite").put(blob, photoKey(plot, seasonId, name))).then(() => undefined);
}
export function getPhoto(db, plot, seasonId, name) {
    return asPromise(store(db, "photos", "readonly").get(photoKey(plot, seasonId, name)));
}
export function deletePhoto(db, plot, seasonId, name) {
    return asPromise(store(db, "photos", "readwrite").delete(photoKey(plot, seasonId, name))).then(() => undefined);
}
/** Every stored photo name for one season - the export zip's manifest is the SEASON RECORD's note
 *  filenames, but orphan cleanup and the knows row want the store's own truth. */
export async function listPhotoNames(db, plot, seasonId) {
    const prefix = `${plot}:${seasonId}:`;
    const range = IDBKeyRange.bound(prefix, prefix + "￿");
    const keys = await asPromise(store(db, "photos", "readonly").getAllKeys(range));
    return keys.map((k) => k.slice(prefix.length));
}
/** Record the mandatory end pair on a live planting (D-013: everybody knows what killed the
 *  plant and roughly when). The index is the planting's position in the season record. */
export function endPlanting(db, plot, seasonId, index, end_cause, end_date) {
    return updateSeason(db, plot, seasonId, (s) => {
        const p = s.plantings?.[index];
        if (!p)
            throw new Error(`no planting #${index} in season ${seasonId}`);
        p.end_cause = end_cause;
        p.end_date = end_date;
        // Ending a CARRIED plant clears its marker (D-123): carried_over and an end pair are mutually
        // exclusive by validation, and since D-121 the reactivated season's perennials CARRY the marker
        // - without this line, "end it in the Log" (the sanctioned way to remove a carried plant) was
        // refused by the validator, a dead-end. It ended this season; it did not persist.
        delete p.carried_over;
    });
}
/** DELETE a planting from a season - for a mistaken or stray entry (e.g. occupancy orphaned when
 *  its bed was removed, which by design survives on the ground; the user needs a way to clear it).
 *  This is user data (not the append-only corpus), so a wrong log entry is theirs to remove. */
export function removePlanting(db, plot, seasonId, index) {
    return updateSeason(db, plot, seasonId, (s) => {
        if (!s.plantings?.[index])
            throw new Error(`no planting #${index} in season ${seasonId}`);
        s.plantings.splice(index, 1);
    });
}
/** EDIT a logged planting (D-106): patch its editable fields - species, cultivar_group, the dated
 *  milestones (sown / transplanted / first_/last_harvest), yield. A field set to undefined or "" is
 *  CLEARED. User data, validated on write like every season; rides the plot/season sync. Not for the
 *  end pair - endPlanting owns that (its own invariant). */
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
        // Same rule as endPlanting (D-123): an edit that sets an end pair on a carried plant ends it -
        // the marker goes, or the validator would refuse the whole write.
        if (rec.end_cause || rec.end_date)
            delete rec.carried_over;
    });
}
// --- plots -----------------------------------------------------------------------
/** The ACTIVE workspace's plots (D-152) - drafts signed out, the account's gardens signed in, the
 *  example garden in both. Every surface that enumerates gardens reads this, which is what keeps the
 *  two worlds from ever showing at the same time. Pass a workspace ("draft" | "account" | "all") only
 *  where crossing is the point: the sign-in adoption flow reads drafts while signed in, and tests
 *  inspect the whole store. */
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
        parseRegion(bed.region); // reserved/degenerate shapes refused (D-015)
    // D-152: a garden created now belongs to the active workspace; an existing owner (or the example
    // flag) always rides through unchanged - edits never re-home a garden.
    if (!plot.example && !plot.owner)
        plot.owner = activeWorkspace();
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await stamp(db, `plot:${plot.id}`);
    return plot;
}
/** Remove a plot record (the example garden's one-tap teardown, D-029). Its seasons are deleted
 *  separately by the caller. */
export function deletePlot(db, id) {
    return asPromise(store(db, "plots", "readwrite").delete(id));
}
export function listPlotTombstones(db) {
    return asPromise(store(db, "plot_tombstones", "readonly").getAll());
}
export function putPlotTombstone(db, t) {
    return asPromise(store(db, "plot_tombstones", "readwrite").put(t));
}
export function deletePlotTombstone(db, id) {
    return asPromise(store(db, "plot_tombstones", "readwrite").delete(id));
}
/** Delete a garden from THIS DEVICE, safely: snapshot the plot and every one of its seasons into
 *  the D-125 safety net FIRST, then remove the plot, its seasons, its soil observations and its
 *  sync stamps. With `tombstone` (an account garden), a deletion marker is recorded and the
 *  auto-sync hook fires, so the next sync removes the account rows and tells every other device;
 *  a draft never synced, so it gets no marker. Also the receiving half: a device APPLYING a
 *  pulled tombstone calls this with the marker's own name/time. Absent data is fine - the call
 *  then just records the marker. */
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
    // the stamps go too - a deleted garden must not linger in the merge planner's inputs
    const meta = store(db, "sync_meta", "readwrite");
    await asPromise(meta.delete(`plot:${plotId}`));
    for (const sn of seasons)
        await asPromise(store(db, "sync_meta", "readwrite").delete(`season:${plotId}:${sn.id}`));
    if (opts.tombstone) {
        await putPlotTombstone(db, { id: plotId, name, deletedAt: opts.deletedAt ?? Date.now() });
        onLocalWrite?.(); // the deletion is a local edit - the auto-sync carries it to the account
    }
    return { name, seasons: seasons.length };
}
/** The first free id on or after `base`: base, base_2, base_3 … */
export async function freePlotId(db, base) {
    let id = base;
    for (let n = 2; await getPlot(db, id); n++)
        id = `${base}_${n}`;
    return id;
}
/** Move a garden to a new id - plot record, its seasons, its soil observations, and its sync stamp
 *  travel together (D-152). One primitive for every re-homing: the sign-in adoption of a draft, the
 *  lazy draft-vs-account id collision, and the cross-device anchor split (account.ts). Writes go
 *  through the stamping paths, so the move counts as this device's newest edit wherever that matters. */
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
    // soil observations key by content (soilKey), so re-homing one is delete + re-put
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
/** putPlot without restamping - the sync-pull counterpart of putSeasonFromSync. */
export async function putPlotFromSync(db, plot, remoteUpdatedAt) {
    if (!plot.id)
        throw new Error("a plot needs an id");
    for (const bed of plot.beds)
        parseRegion(bed.region);
    let existing = await getPlot(db, plot.id);
    // D-152 lazy id-space separation: before v7 every garden was plot_home, so a legacy DRAFT can
    // still hold the id the account's garden arrives under. The draft moves aside (keeping its
    // seasons and soil records) instead of being overwritten - a pull must never eat a draft.
    if (existing && !existing.example && (existing.owner ?? "draft") === "draft") {
        await rekeyPlot(db, plot.id, await freePlotId(db, `draft_${plot.id.replace(/^(?:plot|draft)_/, "")}`));
        existing = undefined;
    }
    plot.owner = "account"; // whatever arrives from the account backend is account data
    await backupReplaced(db, "plot", plot.id, existing, plot); // the replaced copy survives (D-125)
    await asPromise(store(db, "plots", "readwrite").put(plot));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `plot:${plot.id}`, updatedAt: remoteUpdatedAt }));
    return plot;
}
/** Anchor the plot's local frame at a lat/lon - only if it has no anchor yet (see Plot). Also captures
 *  the human "where" (the address the user typed) IN THE SAME write when the anchor is first set, so the
 *  Log can show a legible location (walkthrough #1) - atomic with the anchor, so no read-modify-write
 *  race. Display only; the ZIP / lat-lon paths pass none and the Log falls back to a computed label. */
export async function setPlotAnchorOnce(db, plotId, lat, lon, address) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    if (!plot.anchor) {
        plot.anchor = { lat, lon };
        rememberHemisphere(lat); // O88 S3: boot.js needs the hemisphere synchronously, pre-paint
        const a = address?.trim();
        if (a && !plot.address)
            plot.address = a;
        return putPlot(db, plot);
    }
    return plot;
}
/** Move a WHOLE garden to a new location - a DELIBERATE "this garden is actually here" correction
 *  (walkthrough). Unlike reanchorEmptyPlot this ALLOWS beds: they are stored in plot-local metres, so
 *  moving the anchor carries them along, keeping their relative layout (they arrive at the new place
 *  arranged exactly as before). Refreshes the address label to match (the typed one, else cleared so
 *  the Log falls back to a computed label for the new spot). Stamps like any local edit → auto-syncs,
 *  so the new location survives the next login. This is opt-in and confirmed in the UI; D-022 still
 *  guards against ACCIDENTAL first-anchor drift via reanchorEmptyPlot. */
export async function moveGarden(db, plotId, lat, lon, address) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    plot.anchor = { lat, lon };
    rememberHemisphere(lat); // moving the garden can cross the equator; keep the stamp honest
    const a = address?.trim();
    if (a)
        plot.address = a;
    else
        delete plot.address; // refresh the label to the new location
    return putPlot(db, plot);
}
/** Mark a bed Draft or Planted (walkthrough). Planted = committed → re-planning it warns before it
 *  overwrites the bed's plants + notes. Per-bed on the plot record, so it syncs and survives login.
 *  Stamps like any local edit → auto-syncs. No-op if the bed doesn't exist. */
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
/** Remove a bed by name, taking its CURRENT-season plants with it (config model: plants live in beds,
 *  so removing a bed removes them - no orphans). CLOSED seasons keep their occupancy, so rotation
 *  HISTORY still survives a redesign - D-002 holds for the immutable past, which is the part that
 *  matters for rotation. `openSeasonId` names the season whose plants on this bed are cleared; omit it
 *  (or pass null) to remove geometry only. */
export async function removeBed(db, plotId, name, openSeasonId = null) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const removed = plot.beds.find((b) => b.name === name);
    plot.beds = plot.beds.filter((b) => b.name !== name);
    // Record a deletion tombstone (D-092) so the account merge keeps the delete instead of pulling the
    // bed back from a device that still has it. Newest wins per name; only stamp an actual removal.
    if (removed)
        plot.removedBeds = [...(plot.removedBeds ?? []).filter((t) => t.name !== name), { name, at: Date.now() }];
    if (openSeasonId != null && removed) {
        const season = await getSeason(db, plotId, openSeasonId);
        if (season) {
            // a planting is "on" the removed bed when ≥50 % of its footprint overlapped it (the same rule
            // the Log card / My-bed save use); those go, the rest of the season stays.
            const ps = season.plantings ?? [];
            const keptP = ps.filter((p) => { const a = area(p.region); return !(a > 0 && intersectArea(p.region, removed.region) >= 0.5 * a); });
            // ALSO drop the plan entry keyed by this bed's name. Left behind, it orphans: create a new bed
            // reusing the name and the stale entry resurrects as planned dots with no occupancy - a bed that
            // shows a guild on the map yet reads "ready to plant" on the Log and can't be marked Planted.
            const plan = (Array.isArray(season.plan) ? season.plan : []);
            const keptPlan = plan.filter((e) => e.area !== name);
            if (keptP.length !== ps.length || keptPlan.length !== plan.length) {
                await putSeason(db, { ...season, plantings: keptP, plan: keptPlan });
            }
        }
    }
    return putPlot(db, plot);
}
/** Rename a bed (D-106 slice 2). Beds are keyed by NAME and the season plan references them by name,
 *  so a rename must (1) rename the bed geometry, keeping region/planted/sun; (2) cascade the new name
 *  through every season's `plan.area`; and (3) tombstone the OLD name - so the account merge drops the
 *  old-named bed on a device that still has it - while clearing any tombstone on the NEW name (a re-use
 *  wins). History is region-rooted, so occupancy/rotation is untouched: this only changes the label. */
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
    // cascade the plan's bed-name references across ALL seasons (maintainer: nothing orphans)
    for (const season of await listSeasons(db, plotId)) {
        const plan = (Array.isArray(season.plan) ? season.plan : []);
        if (plan.some((e) => e.area === oldName)) {
            await putSeason(db, { ...season, plan: plan.map((e) => (e.area === oldName ? { ...e, area: nn } : e)) });
        }
    }
    return plot;
}
/** Rename a garden/plot (D-106 slice 2). The plot id is stable; only the display name changes, and it
 *  rides the plot sync so it shows the same on every device. Blank clears it (falls back to the id). */
export async function setPlotName(db, plotId, name) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const nn = name.trim();
    if (nn)
        plot.name = nn;
    else
        delete plot.name;
    return putPlot(db, plot);
}
/** Lay a bed rect on the plot (intake's W×L at a chosen x/y). Same-named bed is replaced -
 *  beds are current geometry, not history; history lives in the plantings' regions.
 *  `rotationDeg` records a rotated rect's angle (D-079 slice 4); the region passed alongside
 *  it is already the rotated polygon, so geometry consumers never need the angle. */
export async function placeBed(db, plotId, name, region, rotationDeg, sun, structure, sized, laneFlip) {
    const plot = (await getPlot(db, plotId)) ?? { id: plotId, beds: [] };
    const prev = plot.beds.find((b) => b.name === name);
    const bed = { name, region: parseRegion(region) };
    // sized is set only by the dimension row and deliberately NOT carried forward on a same-name
    // re-save: a map save IS the trace, and the flag (with its upgrade card) must drop then.
    if (sized)
        bed.sized = true;
    if (typeof rotationDeg === "number" && Number.isFinite(rotationDeg) && rotationDeg % 360 !== 0) {
        bed.rotation_deg = ((rotationDeg % 360) + 360) % 360;
    }
    // Same name = a shape edit. The Planted flag, declared sun, and declared structure are properties of
    // the BED, not its geometry, so a reshape must carry them forward (else editing a bed's outline
    // silently un-planted it and dropped its exposure/structure). `null` explicitly clears; `undefined`
    // keeps the prior value.
    if (prev?.planted)
        bed.planted = true;
    const nextSun = sun === undefined ? prev?.sun : (sun ?? undefined);
    if (nextSun === "full" || nextSun === "part_shade")
        bed.sun = nextSun;
    const nextStruct = structure === undefined ? prev?.structure : (structure ?? undefined);
    if (nextStruct === "raised" || nextStruct === "in_ground" || nextStruct === "container" || nextStruct === "field") {
        bed.structure = nextStruct;
    }
    // lane_flip carries forward exactly like sun/structure: undefined keeps, null clears, true sets.
    const nextFlip = laneFlip === undefined ? prev?.lane_flip : (laneFlip ?? undefined);
    if (nextFlip === true)
        bed.lane_flip = true;
    plot.beds = [...plot.beds.filter((b) => b.name !== name), bed];
    // Placing a bed by this name cancels any prior deletion of it (D-092): a re-add is the newest word,
    // so its tombstone must go or the merge would drop the freshly re-created bed.
    if (plot.removedBeds?.length) {
        const remaining = plot.removedBeds.filter((t) => t.name !== name);
        if (remaining.length)
            plot.removedBeds = remaining;
        else
            delete plot.removedBeds;
    }
    return putPlot(db, plot);
}
/** Upsert the pre-tracking history for a piece of GROUND (D-102). Keyed by exact region - a bed the
 *  user declares before it is planted. Empty `families` clears the seed for that ground. Persisted on
 *  the plot so it rides the plot's sync and survives reload; ground-rooted so a bed redesign keeps it. */
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
// A SERIES key, not an identity key. Same ground observed twice = two records, and the newest one
// answers (soil.latestFor). Region-scoped readings key separately from whole-plot ones.
//
// A CHEMISTRY READING KEYS APART FROM A DESCRIPTION, because two observations of one ground on one
// day are a real and ordinary thing: a ribbon test is a `field_test` and the pH beside it is a `kit`
// reading, and the validator REFUSES to carry both in one record (a `ph` demands a kit/lab source).
// Keyed on plot:date:region alone the second save silently overwrote the first, which is how a
// recorded ribbon test disappeared the moment a pH was entered.
//
// THE SUFFIX IS THE RECORD'S KIND, NOT ITS `source`, and the difference is not cosmetic. Keying on
// source puts two records that BOTH carry a texture in the same series, and same-date records resolve
// in key order — so "declared" sorting before "field_test" would let a stale ribbon test outrank the
// declaration that replaced it, and unticking the box would silently do nothing. Keyed by kind there
// are exactly two series per ground per day and their FIELDS ARE DISJOINT: the description carries
// texture/drainage/medium, the reading carries ph and the report. Nothing is written by both, so
// their relative order cannot matter, and each still overwrites itself on a re-save — which is what
// correcting a typo should do.
const soilKey = (rec) => `${rec.plot}:${rec.date}:${rec.region ? JSON.stringify(rec.region) : ""}` +
    (rec.ph === undefined ? "" : ":ph");
export function listSoilObservations(db) {
    return asPromise(store(db, "soil_observations", "readonly").getAll());
}
/** Store a soil observation. Validated by the engine oracle first and refused loudly if invalid, so a
 *  stored record is always a valid one - the same contract as a season or a user species. The refusals
 *  matter here: this is the layer that would otherwise quietly accept a pH the engine cannot read. */
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
/** Store a user species. It is validated first (engine oracle) and refused loudly if invalid -
 *  a stored record is always a valid one, exactly like a season. */
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
/** putUserSpecies WITHOUT restamping - the sync-pull counterpart, so the remote timestamp stays
 *  authoritative and a pull does not masquerade as a fresh local edit. Still validated: a corrupt
 *  pulled record is refused loudly, exactly like a season. */
export async function putUserSpeciesFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateUserSpecies(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listUserSpecies(db)).find((u) => u.id === rec.id);
    await backupReplaced(db, "user_species", rec.id, existing, rec); // D-125
    await asPromise(store(db, "user_species", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `user_species:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}
/** Refuse a malformed seed loudly, the same contract as a season or a user species - a stored record
 *  is always a valid one. Seeds are not an engine concept, so this is a plain record-shape check:
 *  an id and a species are required, the optional fields are typed, and free text is length-capped
 *  so a synced row can't carry an unbounded blob. */
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
/** Store a seed. Validated first and refused loudly if malformed. */
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
/** putSeed WITHOUT restamping - the sync-pull counterpart, so the remote timestamp stays
 *  authoritative and a pull does not masquerade as a fresh local edit. Still validated. */
export async function putSeedFromSync(db, rec, remoteUpdatedAt) {
    const errors = validateSeed(rec);
    if (errors.length)
        throw new Error(errors.join("; "));
    const existing = (await listSeeds(db)).find((s) => s.id === rec.id);
    await backupReplaced(db, "seed", rec.id, existing, rec); // D-125
    await asPromise(store(db, "seeds", "readwrite").put(rec));
    await asPromise(store(db, "sync_meta", "readwrite").put({ key: `seed:${rec.id}`, updatedAt: remoteUpdatedAt }));
    return rec;
}
