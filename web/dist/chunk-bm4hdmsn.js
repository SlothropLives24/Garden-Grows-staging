const EXAMPLE_BED_M = 3.048;
const EXAMPLE_BED_REGION = { shape: "rect", x: 0, y: 0, w: EXAMPLE_BED_M, h: EXAMPLE_BED_M };
const EXAMPLE_BED_STRUCTURE = "in_ground";
const EXAMPLE_HOME = { lat: 39.83, lon: -98.58, label: "Lebanon, Kansas", given: false };
function examplePlaceOf(answers) {
    const a = answers && typeof answers === "object" ? answers : {};
    const { lat, lon } = a;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)
        || Math.abs(lat) > 90 || Math.abs(lon) > 180)
        return EXAMPLE_HOME;
    const town = typeof a.place === "string" && a.place.trim() && a.place.length <= 120 ? a.place.trim() : null;
    const zip = typeof a.zip === "string" && /^\d{5}$/.test(a.zip) ? `ZIP ${a.zip}` : null;
    const out = { lat, lon, label: town ?? zip ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, given: true };
    if (typeof a.country === "string" && /^[A-Za-z]{2}$/.test(a.country))
        out.country = a.country.toUpperCase();
    return out;
}
function exampleElsewhere() {
    let m = null;
    try {
        m = JSON.parse(localStorage.getItem("gg-example-made") ?? "null");
    }
    catch {
        m = null;
    }
    if (!m || typeof m !== "object" || typeof m.key !== "string" || m.home)
        return EXAMPLE_HOME.label;
    if (m.given === true)
        return null;
    return typeof m.at === "string" && m.at.trim() ? m.at.trim() : EXAMPLE_HOME.label;
}
function exampleAnswerIsTheirs(lat, lon, answers) {
    const p = examplePlaceOf(answers);
    return p.given && p.lat === lat && p.lon === lon;
}

export { EXAMPLE_BED_M, EXAMPLE_BED_REGION, EXAMPLE_BED_STRUCTURE, EXAMPLE_HOME, exampleAnswerIsTheirs, exampleElsewhere, examplePlaceOf };
