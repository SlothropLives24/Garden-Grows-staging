const DEG = Math.PI / 180;
export function solarDeclinationDeg(dayOfYear) {
    return 23.45 * Math.sin((DEG * 360 * (284 + dayOfYear)) / 365);
}
export function daylengthHours(latDeg, dayOfYear) {
    const decl = solarDeclinationDeg(dayOfYear) * DEG;
    const lat = latDeg * DEG;
    const cosH = -Math.tan(lat) * Math.tan(decl);
    if (cosH <= -1)
        return 24;
    if (cosH >= 1)
        return 0;
    const h = Math.acos(cosH);
    return (2 * h) / DEG / 15;
}
export function dayOfYear(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const here = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.round((here - start) / 86_400_000);
}
export function onionDaylengthNote(latDeg) {
    const a = Math.abs(latDeg);
    if (a >= 38)
        return "long-day onion country - short-day cultivars bulb early and stay small here.";
    if (a <= 35)
        return "short-day onion country - long-day cultivars may never bulb this close to the equator.";
    return "on the onion changeover (~35–38°) - intermediate-day cultivars are the safe pick here.";
}
