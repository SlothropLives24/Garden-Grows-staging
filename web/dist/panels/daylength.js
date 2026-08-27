// Phase D (D-038 / D-039 / D-040) - daylength at the site's latitude, folded into the "This ground's
// climate" card (its Daylength row + the "how we know" disclosure, renderClimate in plan.ts).
//
// This is READ-ONLY and NEVER an engine input (D-008): it informs the human, the solver never reads it
// back. It needs no API and no bundle - daylength is pure astronomy from latitude and the day of the
// year (D-039 / Q-D2a), so it is deterministic and works offline, and it pays a real debt: the engine
// already gates a *fatal* rule on daylength (R-081, onion cultivar ↔ latitude changeover) but the app
// never showed the user the number the rule turns on.
//
// It lives under web/src/panels/, NOT web/src/engine/: it is not part of the conformance oracle, and
// the DOM-free lint (which guards engine/) deliberately does not cover it. The engine must never import
// it. The COMPUTATION is exported as pure functions so web/test.mjs can pin them to hand-computed
// goldens; renderClimate consumes them for the DOM.
const DEG = Math.PI / 180;
// Solar declination by Cooper's equation (degrees): the sun's angle north (+) or south (−) of the
// equator on a given day. dayOfYear is 1 on Jan 1. A standard textbook approximation (±~0.4°), well
// inside what a daylength readout needs.
export function solarDeclinationDeg(dayOfYear) {
    return 23.45 * Math.sin((DEG * 360 * (284 + dayOfYear)) / 365);
}
// Geometric daylength in hours for a latitude and day of year - the sunrise equation, taken at the
// centre of the sun's disc (no atmospheric refraction or sun-radius correction; a real day is ~7 min
// longer, immaterial for photoperiod). Polar day/night is handled by clamping the hour-angle cosine:
// above the Arctic/Antarctic circle in season this returns 24 h (midnight sun) or 0 h (polar night).
export function daylengthHours(latDeg, dayOfYear) {
    const decl = solarDeclinationDeg(dayOfYear) * DEG;
    const lat = latDeg * DEG;
    const cosH = -Math.tan(lat) * Math.tan(decl);
    if (cosH <= -1)
        return 24; // the sun never sets
    if (cosH >= 1)
        return 0; // the sun never rises
    const h = Math.acos(cosH); // half-day hour angle, radians
    return (2 * h) / DEG / 15; // radians → degrees → hours (the sky turns 15°/h)
}
// Day of the year (Jan 1 = 1), read in UTC so the panel does not drift by a day near midnight.
export function dayOfYear(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const here = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.round((here - start) / 86_400_000);
}
// The R-081 implication in plain words, from |latitude| (the changeover is symmetric about the
// equator, ~the 35th–38th parallel). This is a display echo of a rule the engine enforces - it is
// not a value the engine reads back. Sentence starts lower-case; it follows "…° is ".
export function onionDaylengthNote(latDeg) {
    const a = Math.abs(latDeg);
    if (a >= 38)
        return "long-day onion country - short-day cultivars bulb early and stay small here.";
    if (a <= 35)
        return "short-day onion country - long-day cultivars may never bulb this close to the equator.";
    return "on the onion changeover (~35–38°) - intermediate-day cultivars are the safe pick here.";
}
