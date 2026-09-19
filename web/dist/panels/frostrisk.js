const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function humanizeMMDD(mmdd) {
    const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
    if (!m)
        return mmdd;
    const mon = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (mon < 0 || mon > 11 || day < 1 || day > 31)
        return mmdd;
    return `${MONTHS[mon]} ${day}`;
}
export function frostRiskRows(site) {
    const lf = (site.last_frost_32f ?? {});
    const rows = [];
    for (const [k, v] of Object.entries(lf)) {
        const m = /^p(\d+)$/.exec(k);
        if (m && typeof v === "string")
            rows.push({ pct: Number(m[1]), date: v, label: humanizeMMDD(v) });
    }
    rows.sort((a, b) => a.pct - b.pct);
    return rows;
}
export function frostBand(site) {
    const rows = frostRiskRows(site);
    return {
        rows,
        median: rows.find((r) => r.pct === 50) ?? null,
        safe: rows.length ? rows[0] : null,
    };
}
