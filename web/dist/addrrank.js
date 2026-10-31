function deviceCountry(langs = typeof navigator !== "undefined" ? navigator.languages : undefined) {
    for (const l of langs ?? []) {
        const m = /^[a-z]{2,3}-([a-z]{2})(?:-|$)/i.exec(l);
        if (m)
            return m[1].toLowerCase();
    }
    return null;
}
function zipMeansUs(home, spanish) {
    return home === "us" || (home === null && !spanish);
}
function rankByHome(rows, home) {
    const tier = (r) => (home && (r.cc ?? "").toLowerCase() === home ? 0 : r.us ? 1 : 2);
    return rows.map((r, i) => ({ r, i }))
        .sort((a, b) => tier(a.r) - tier(b.r) || Number(b.r.exact) - Number(a.r.exact) || a.i - b.i)
        .map((x) => x.r);
}
function oneCountry(rows) {
    const ccs = new Set(rows.map((r) => (r.cc ?? (r.us ? "us" : "?")).toLowerCase()));
    return ccs.size <= 1;
}
const region = () => deviceCountry() ?? "us";
const zipFirst = (q, spanish) => /^\s*\d{5}(?:-\d{4})?\s*$/.test(q) && zipMeansUs(deviceCountry(), spanish);
function osmHint(q, spanish) {
    const home = deviceCountry();
    return /^\s*\d{4,6}(?:-\d{3,4})?\s*$/.test(q) && home && !zipMeansUs(home, spanish) ? `&countrycodes=${home}` : "";
}
const splitLabel = (label) => {
    const i = label.indexOf(",");
    return i < 0 ? { primary: label.trim(), secondary: "" }
        : { primary: label.slice(0, i).trim(), secondary: label.slice(i + 1).trim() };
};
const near = (a, b) => {
    const dLat = (a.lat - b.lat) * 111_000;
    const dLon = (a.lon - b.lon) * 111_000 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dLat, dLon) < 150;
};
function collapse(raw, home) {
    const kept = [];
    for (const c of rankByHome(raw, home)) {
        if (!isFinite(c.lat) || !isFinite(c.lon))
            continue;
        if (c.label.split(",").filter((p) => p.trim()).length < 2)
            continue;
        if (kept.some((k) => k.label === c.label || near(k, c)))
            continue;
        kept.push(c);
    }
    return kept.slice(0, 5);
}
async function fromOsm(q, spanish, streetNote) {
    const askedHouse = /^\s*\d+\s/.test(q);
    try {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1"
            + osmHint(q, spanish) + "&q=" + encodeURIComponent(q);
        const body = await (await fetch(url, { headers: { "Accept": "application/json" } })).json();
        return body.map((m) => {
            const label = m.display_name.slice(0, 90);
            const hasHouse = !!m.address?.house_number;
            return { lat: parseFloat(m.lat), lon: parseFloat(m.lon), label, ...splitLabel(label),
                exact: hasHouse, us: m.address?.country_code === "us", cc: m.address?.country_code,
                note: askedHouse && !hasHouse ? streetNote : undefined };
        });
    }
    catch {
        return null;
    }
}

export { collapse, deviceCountry, fromOsm, oneCountry, rankByHome, region, splitLabel, zipFirst, zipMeansUs };
