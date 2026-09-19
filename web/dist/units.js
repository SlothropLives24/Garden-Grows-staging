const KEY = "gg-units";
const TEMP_KEY = "gg-temp";
const PREF_AT_KEY = "gg-prefs-at";
const M_PER_FT = 0.3048;
let system = "imperial";
try {
    if (localStorage.getItem(KEY) === "metric")
        system = "metric";
}
catch {
}
let temp = "f";
try {
    if (localStorage.getItem(TEMP_KEY) === "c")
        temp = "c";
}
catch {
}
export const unitSystem = () => system;
export const lengthUnit = () => (system === "metric" ? "m" : "ft");
export const tempSystem = () => temp;
const THEME_KEY = "gg-theme";
let theme = "system";
try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark")
        theme = t;
}
catch {
}
const darkMq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export const themeChoice = () => theme;
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
    catch { }
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
}
export function seasonOf(d, southern = false) {
    const north = SEASONS[Math.floor(((d.getMonth() + 10) % 12) / 3)];
    return southern ? SEASONS[(SEASONS.indexOf(north) + 2) % 4] : north;
}
function southernHemisphere() {
    try {
        return localStorage.getItem(HEMI_KEY) === "s";
    }
    catch {
        return false;
    }
}
export function rememberHemisphere(lat) {
    if (!Number.isFinite(lat))
        return;
    try {
        localStorage.setItem(HEMI_KEY, lat < 0 ? "s" : "n");
    }
    catch { }
}
export const seasonChoice = () => season;
export const resolvedSeason = (now = new Date()) => season === "follow" ? seasonOf(now, southernHemisphere()) : season;
export function applySeason() {
    document.documentElement.dataset.season = resolvedSeason();
}
export function setSeasonChoice(s) {
    season = s;
    try {
        localStorage.setItem(SEASON_KEY, s);
    }
    catch { }
    stampPrefs();
    applySeason();
}
const SILO_KEY = "gg-silo";
let silo = "on";
try {
    if (localStorage.getItem(SILO_KEY) === "off")
        silo = "off";
}
catch {
}
export const siloChoice = () => silo;
export function applySilo() {
    if (silo === "off")
        document.documentElement.setAttribute("data-silo", "off");
    else
        document.documentElement.removeAttribute("data-silo");
}
export function setSiloChoice(s) {
    silo = s;
    try {
        localStorage.setItem(SILO_KEY, s);
    }
    catch { }
    applySilo();
}
const REMIND_KEY = "gg-remind";
let remind = "morning";
try {
    const r = localStorage.getItem(REMIND_KEY);
    if (r === "evening" || r === "none")
        remind = r;
}
catch {
}
export const remindChoice = () => remind;
export function setRemindChoice(r) {
    remind = r;
    try {
        localStorage.setItem(REMIND_KEY, r);
    }
    catch { }
    stampPrefs();
}
function stampPrefs() {
    try {
        localStorage.setItem(PREF_AT_KEY, String(Date.now()));
    }
    catch {
    }
}
export function setUnitSystem(sys) {
    system = sys;
    try {
        localStorage.setItem(KEY, sys);
    }
    catch {
    }
    stampPrefs();
}
export function setTempSystem(t) {
    temp = t;
    try {
        localStorage.setItem(TEMP_KEY, t);
    }
    catch {
    }
    stampPrefs();
}
export function prefRecord() {
    let at = null;
    try {
        const v = localStorage.getItem(PREF_AT_KEY);
        at = v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    }
    catch {
    }
    return { record: { units: system, temp, theme, remind, season }, updatedAt: at };
}
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
        catch { }
    }
    if (rec.temp === "c" || rec.temp === "f") {
        temp = rec.temp;
        try {
            localStorage.setItem(TEMP_KEY, temp);
        }
        catch { }
    }
    if (rec.theme === "system" || rec.theme === "light" || rec.theme === "dark") {
        theme = rec.theme;
        try {
            localStorage.setItem(THEME_KEY, theme);
        }
        catch { }
        applyTheme();
    }
    if (rec.remind === "morning" || rec.remind === "evening" || rec.remind === "none") {
        remind = rec.remind;
        try {
            localStorage.setItem(REMIND_KEY, remind);
        }
        catch { }
    }
    if (rec.season === "follow" || SEASONS.includes(rec.season ?? "")) {
        season = rec.season;
        try {
            localStorage.setItem(SEASON_KEY, season);
        }
        catch { }
        applySeason();
    }
    if (typeof atMs === "number" && Number.isFinite(atMs)) {
        try {
            localStorage.setItem(PREF_AT_KEY, String(atMs));
        }
        catch { }
    }
    return changed;
}
export const lenToM = (v) => (system === "metric" ? v : v * M_PER_FT);
export const mToInput = (m) => +(system === "metric" ? m : m / M_PER_FT).toFixed(2);
export const fmtLen = (m) => system === "metric" ? `${+m.toFixed(2)} m` : `${+(m / M_PER_FT).toFixed(1)} ft`;
export const fmtArea = (m2) => system === "metric" ? `${+m2.toFixed(2)} m²` : `${+(m2 / (M_PER_FT * M_PER_FT)).toFixed(1)} ft²`;
export const fmtKm = (km) => {
    const v = system === "metric" ? km : km / 1.609344;
    return `${v < 10 ? +v.toFixed(1) : Math.round(v)} ${system === "metric" ? "km" : "mi"}`;
};
export const fmtCm = (cm) => system === "metric" ? `${cm} cm` : `${+(cm / 2.54).toFixed(0)} in`;
export const fmtTemp = (c) => temp === "c" ? `${+c.toFixed(0)} °C` : `${+((c * 9) / 5 + 32).toFixed(0)} °F`;
export const localiseProse = (text) => {
    if (system === "metric")
        return text;
    const num = (v) => parseFloat(v.replace(",", "."));
    const ft = (m) => `${+(m / M_PER_FT).toFixed(1)}`;
    const inch = (cm) => `${Math.round(cm / 2.54)}`;
    const ftArea = (m2) => `${+(m2 / (M_PER_FT * M_PER_FT)).toFixed(1)}`;
    const inArea = (cm2) => `${Math.round(cm2 / (2.54 * 2.54))}`;
    return text
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*m(?:²|2\b)/g, (_m, t, a) => `${t}${ftArea(num(a))} ft²`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*cm(?:²|2\b)/g, (_m, t, a) => `${t}${inArea(num(a))} in²`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)(\s*[-–]\s*)(\d+(?:[.,]\d+)?)\s*m(?![²2])\b/g, (_m, t, a, dash, b) => `${t}${ft(num(a))}${dash}${ft(num(b))} ft`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*m(?![²2])\b/g, (_m, t, a) => `${t}${ft(num(a))} ft`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)(\s*[-–]\s*)(\d+(?:[.,]\d+)?)\s*cm(?![²2])\b/g, (_m, t, a, dash, b) => `${t}${inch(num(a))}${dash}${inch(num(b))} in`)
        .replace(/(~?)(\d+(?:[.,]\d+)?)\s*cm(?![²2])\b/g, (_m, t, a) => `${t}${inch(num(a))} in`);
};
