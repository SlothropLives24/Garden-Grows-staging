// Phase D (D-042) - the frost-risk-window data: the full last-spring-frost percentile curve, folded
// into the "This ground's climate" card's "how we know" disclosure (renderClimate, plan.ts).
//
// Read-only and NEVER an engine input (D-008): it re-presents data the resolved climate site ALREADY
// carries. The bundle stores last_frost_32f as {p10,p20,p30,p40,p50} - the dates by which that share
// of years has seen its last freeze - but the one-line climate readout shows only p10 and p50, so the
// p20/p30/p40 gradient (the actual planting-date hedge) is in the data and never surfaced. This module
// surfaces it. No new data, no runtime call (D-039), no bundle change - the honest alternative to the
// precipitation panel Q-D1c wanted, whose data cannot be sourced without regenerating the bundle.
//
// Lives under web/src/panels/, not the DOM-free engine/ subtree; the engine never imports it and it is
// not in the conformance oracle. The parsing is pure and pinned in web/test.mjs; renderClimate does the
// DOM.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "03-05" → "Mar 5". Returns the raw string unchanged if it is not a well-formed MM-DD.
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
// The last-frost percentile rows, ordered safest-first (p10, the latest date → smallest chance of a
// later freeze). Empty when the site carries no last_frost_32f (e.g. an unresolved or tier-less site).
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
// The last-frost band folded into the two dates the landing "odds, not a date" receipt headlines: the
// median (50% of years frosted by then) and the safe hedge (the latest/smallest-percentile date). Pure,
// derived only from what the site already carries; both null when the site has no last_frost_32f.
export function frostBand(site) {
    const rows = frostRiskRows(site);
    return {
        rows,
        median: rows.find((r) => r.pct === 50) ?? null,
        safe: rows.length ? rows[0] : null,
    };
}
