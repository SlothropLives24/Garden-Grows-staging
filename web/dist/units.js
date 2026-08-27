// Display-layer unit toggle (Phase 1). THE ENGINE AND ALL STORAGE STAY METRIC - placed beds,
// logged regions, exports, and every engine call are metres/cm/m². This module converts at the
// UI boundary only: inputs are interpreted in the chosen system, UI-authored lengths render in
// it. Engine-authored sentences (rule reasons, conformance-pinned strings) keep their metric
// units - they are citations, not UI copy. DOM-layer module (localStorage) - not engine code.
const KEY = "gg-units";
const TEMP_KEY = "gg-temp";
// One stamp for the display prefs as a set, so the account sync can tell which device's choice is
// newer (planMerge). Written on every deliberate change; NOT on a pull-apply (that stamp is the
// remote's, tracked in sync_meta). ms epoch.
const PREF_AT_KEY = "gg-prefs-at";
const M_PER_FT = 0.3048;
// Default IMPERIAL (ft/in/°F) - the audience is predominantly US home gardeners. A stored choice
// still wins; the engine and all storage stay metric, so this only changes the display boundary.
let system = "imperial";
try {
    if (localStorage.getItem(KEY) === "metric")
        system = "metric";
}
catch {
    /* storage unavailable - session-only default */
}
// Temperature is a SEPARATE toggle from distance (a gardener may want ft but °C, or m but °F).
let temp = "f";
try {
    if (localStorage.getItem(TEMP_KEY) === "c")
        temp = "c";
}
catch {
    /* storage unavailable - session-only default */
}
export const unitSystem = () => system;
export const lengthUnit = () => (system === "metric" ? "m" : "ft");
export const tempSystem = () => temp;
export const tempUnit = () => (temp === "c" ? "°C" : "°F");
const THEME_KEY = "gg-theme";
let theme = "system";
try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark")
        theme = t;
}
catch {
    /* storage unavailable - session-only default */
}
const darkMq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export const themeChoice = () => theme;
/** Stamp the resolved theme on the root and keep the browser chrome colour in step. */
export function applyTheme() {
    const resolved = theme === "system" ? (darkMq?.matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#16140f" : "#272e1b");
}
darkMq?.addEventListener("change", () => { if (theme === "system")
    applyTheme(); });
export function setThemeChoice(t) {
    theme = t;
    try {
        localStorage.setItem(THEME_KEY, t);
    }
    catch { /* fine - preference just won't persist */ }
    stampPrefs();
    applyTheme();
}
const SEASON_KEY = "gg-season";
const HEMI_KEY = "gg-hemi";
const SEASONS = ["spring", "summer", "autumn", "winter"];
let season = "follow";
try {
    const s = localStorage.getItem(SEASON_KEY);
    if (s && SEASONS.includes(s))
        season = s;
}
catch {
    /* storage unavailable - session-only default */
}
/** Meteorological season for a date in a hemisphere. Dec-Feb is winter in the north, and the
 *  southern hemisphere is the same calendar shifted two seasons, not a mirrored date range. */
export function seasonOf(d, southern = false) {
    const north = SEASONS[Math.floor(((d.getMonth() + 10) % 12) / 3)]; // Mar->spring
    return southern ? SEASONS[(SEASONS.indexOf(north) + 2) % 4] : north;
}
/** True when the last anchored garden sits south of the equator. Reads the same mirror boot.js does. */
export function southernHemisphere() {
    try {
        return localStorage.getItem(HEMI_KEY) === "s";
    }
    catch {
        return false;
    }
}
/** Record which hemisphere the garden is in, so the pre-paint stamp can get the season right.
 *  Only "n"/"s" is stored - the coordinates stay in IndexedDB where they belong. */
export function rememberHemisphere(lat) {
    if (!Number.isFinite(lat))
        return;
    try {
        localStorage.setItem(HEMI_KEY, lat < 0 ? "s" : "n");
    }
    catch { /* fine */ }
}
export const seasonChoice = () => season;
/** The season actually showing: the pinned one, or today's if following. */
export const resolvedSeason = (now = new Date()) => season === "follow" ? seasonOf(now, southernHemisphere()) : season;
/** Stamp the resolved season on the root. Autumn is the bare :root (the shipped palette), so it is
 *  stamped like any other - the stylesheet simply has no [data-season="autumn"] block to match. */
export function applySeason() {
    document.documentElement.dataset.season = resolvedSeason();
}
export function setSeasonChoice(s) {
    season = s;
    try {
        localStorage.setItem(SEASON_KEY, s);
    }
    catch { /* fine - preference just won't persist */ }
    stampPrefs();
    applySeason();
}
const REMIND_KEY = "gg-remind";
let remind = "morning";
try {
    const r = localStorage.getItem(REMIND_KEY);
    if (r === "evening" || r === "none")
        remind = r;
}
catch {
    /* storage unavailable - session-only default */
}
export const remindChoice = () => remind;
export function setRemindChoice(r) {
    remind = r;
    try {
        localStorage.setItem(REMIND_KEY, r);
    }
    catch { /* fine - preference just won't persist */ }
    stampPrefs();
}
function stampPrefs() {
    try {
        localStorage.setItem(PREF_AT_KEY, String(Date.now()));
    }
    catch {
        /* fine - the pref just won't carry a sync timestamp */
    }
}
/** Set distance units to a specific system (the Preferences control, not a blind toggle). Writes
 *  the device preference and stamps it so a later sign-in can order this change against the account. */
export function setUnitSystem(sys) {
    system = sys;
    try {
        localStorage.setItem(KEY, sys);
    }
    catch {
        /* fine - preference just won't persist */
    }
    stampPrefs();
}
/** Set the temperature system (separate from distance - ft with °C is a valid combination). */
export function setTempSystem(t) {
    temp = t;
    try {
        localStorage.setItem(TEMP_KEY, t);
    }
    catch {
        /* fine - preference just won't persist */
    }
    stampPrefs();
}
/** The current display prefs as one syncable record + its local change stamp (ms epoch, or null if
 *  never deliberately changed on this device - planMerge treats null as local-first). */
export function prefRecord() {
    let at = null;
    try {
        const v = localStorage.getItem(PREF_AT_KEY);
        at = v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    }
    catch {
        /* storage unavailable */
    }
    return { record: { units: system, temp, theme, remind, season }, updatedAt: at };
}
/** Apply a pref pulled from the account. Writes the values locally and adopts the REMOTE row's
 *  timestamp as this device's pref stamp (so the next merge sees them as identical and doesn't
 *  ping-pong) - it does NOT invent a fresh stamp. Returns whether anything actually changed, so the
 *  caller can re-render only when needed. */
export function applyPrefRecord(rec, atMs) {
    const changed = rec.units !== system || rec.temp !== temp
        || (rec.theme != null && rec.theme !== theme)
        || (rec.remind != null && rec.remind !== remind)
        || (rec.season != null && rec.season !== season);
    if (rec.units === "metric" || rec.units === "imperial") {
        system = rec.units;
        try {
            localStorage.setItem(KEY, system);
        }
        catch { /* fine */ }
    }
    if (rec.temp === "c" || rec.temp === "f") {
        temp = rec.temp;
        try {
            localStorage.setItem(TEMP_KEY, temp);
        }
        catch { /* fine */ }
    }
    if (rec.theme === "system" || rec.theme === "light" || rec.theme === "dark") {
        theme = rec.theme;
        try {
            localStorage.setItem(THEME_KEY, theme);
        }
        catch { /* fine */ }
        applyTheme();
    }
    if (rec.remind === "morning" || rec.remind === "evening" || rec.remind === "none") {
        remind = rec.remind;
        try {
            localStorage.setItem(REMIND_KEY, remind);
        }
        catch { /* fine */ }
    }
    if (rec.season === "follow" || SEASONS.includes(rec.season ?? "")) {
        season = rec.season;
        try {
            localStorage.setItem(SEASON_KEY, season);
        }
        catch { /* fine */ }
        applySeason();
    }
    if (typeof atMs === "number" && Number.isFinite(atMs)) {
        try {
            localStorage.setItem(PREF_AT_KEY, String(atMs));
        }
        catch { /* fine */ }
    }
    return changed;
}
/** An input's value (in the chosen system) → metres, for storage and the engine. */
export const lenToM = (v) => (system === "metric" ? v : v * M_PER_FT);
/** Metres → an input value in the chosen system, rounded to input precision. */
export const mToInput = (m) => +(system === "metric" ? m : m / M_PER_FT).toFixed(2);
export const fmtLen = (m) => system === "metric" ? `${+m.toFixed(2)} m` : `${+(m / M_PER_FT).toFixed(1)} ft`;
export const fmtArea = (m2) => system === "metric" ? `${+m2.toFixed(2)} m²` : `${+(m2 / (M_PER_FT * M_PER_FT)).toFixed(1)} ft²`;
export const fmtCm = (cm) => system === "metric" ? `${cm} cm` : `${+(cm / 2.54).toFixed(0)} in`;
/** A temperature in °C → the chosen temperature system, rounded to whole degrees. */
export const fmtTemp = (c) => temp === "c" ? `${+c.toFixed(0)} °C` : `${+((c * 9) / 5 + 32).toFixed(0)} °F`;
