// Privacy-first visit counting (acquisition P0, AQ-1: GoatCounter). DISPLAY-LAYER ONLY - the engine
// and corpus never know this exists. The whole design is "count, don't track": a fire-and-forget GET
// to GoatCounter's count endpoint with the path and referrer - no cookies, no fingerprinting, no
// user id, no PII, nothing stored client-side. The beacon is triple-gated so it can never pollute
// the numbers or anyone's privacy:
//   - counts ONLY on the production host (milpa.garden) - localhost dev, the e2e suite, and the
//     staging origin are all silent by construction;
//   - honours Do Not Track and Global Privacy Control;
//   - never counts automated browsers (navigator.webdriver).
// The GoatCounter site code below is registered by the maintainer (goatcounter.com, free); until
// that account exists the requests 404 harmlessly. Counting must never break the app: everything is
// wrapped, and a blocked/failed request is swallowed.
const CODE = "milpa-garden"; // -> https://milpa-garden.goatcounter.com (maintainer registers this code)
const PROD_HOSTS = new Set(["milpa.garden", "www.milpa.garden"]);
function allowed() {
    try {
        if (!CODE || !PROD_HOSTS.has(location.hostname))
            return false;
        if (navigator.webdriver)
            return false;
        const nav = navigator;
        if (navigator.doNotTrack === "1" || nav.globalPrivacyControl === true)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function send(path) {
    if (!allowed())
        return;
    try {
        const q = new URLSearchParams({ p: path, r: document.referrer || "", rnd: String(Date.now()) });
        void fetch(`https://${CODE}.goatcounter.com/count?${q}`, { method: "GET", keepalive: true, mode: "no-cors" })
            .catch(() => { });
    }
    catch { /* same */ }
}
/** One pageview per load, fired at boot. */
export function countPageview() {
    send("/");
}
// The AQ-5 metric: WEEKLY ACTIVE GARDENS = distinct sessions where a REAL garden (anchored, not the
// example) was open. One event per page load, first qualifying garden only - GoatCounter's unique
// counting turns these into the weekly number.
let gardenCounted = false;
export function countGardenActive(plot) {
    if (gardenCounted || !plot || !plot.anchor || plot.example === true)
        return;
    gardenCounted = true;
    send("/e/garden-active");
}
const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|baidu|yandex|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(reddit|facebook|instagram|x|twitter|t|bsky|mastodon|threads|pinterest|youtube|linkedin|news\.ycombinator)\./;
// THE DIRECTORY HOSTS TRACK THE LISTINGS WE ACTUALLY HOLD (docs/DIRECTORY-LISTINGS.md). A host we
// submit to and forget to add here does not vanish - it buckets as `other`, which is worse than
// missing: the channel O4c exists to CREATE would read as noise, and the cohort-depth comparison
// the whole measurement is for ("directory arrivals reach the crop rung at X%, organic at Y%") would
// be quietly wrong rather than absent. So the list and the dossier move together, and neither is
// edited alone. This is not a sixth bucket - D-170's closed five are untouched; it is one bucket
// learning the hosts it was always meant to cover.
const DIRECTORY = /(^|\.)(alternativeto|producthunt|slant|saashub|github|gitlab|awesome|pwa\.directory)\./;
/** The arrival channel of a referrer, as one of the closed five. Pure and exported so the mapping is
 *  unit-testable - the beacons themselves are unobservable in any test, by construction (they are
 *  silent under `navigator.webdriver`), so the mapping is the part a test CAN pin. */
export function channelOf(referrer) {
    if (!referrer)
        return "direct";
    let host;
    try {
        host = new URL(referrer).hostname.toLowerCase();
    }
    catch {
        return "other"; // an unparseable referrer is not a channel, and is never echoed anywhere
    }
    if (!host)
        return "direct";
    if (PROD_HOSTS.has(host))
        return "direct"; // our own pages are not an arrival
    if (SEARCH.test(`.${host}.`))
        return "organic";
    if (SOCIAL.test(`.${host}.`))
        return "social";
    if (DIRECTORY.test(`.${host}.`))
        return "directory";
    return "other";
}
// The once-per-load latch. Kept in memory for the length of one page load, never persisted, never
// sent anywhere on its own - it exists so a rung counts once, which the metric needs regardless of
// whether any beacon is allowed to leave. It advances even when `send()` is gated shut, so the
// latch behaves identically for a DNT visitor and a counted one.
// An ARRAY, deliberately, not a Set. The obvious Set dedupes by construction, which would make the
// latch untestable - a "counted once" assertion over a Set passes whether the latch works or not
// (caught by probing exactly that). An append-after-the-check array records what was really
// beaconed, so a broken latch shows up as a second entry.
const fired = [];
/** Mark a rung crossed. Idempotent per page load. */
export function countRung(rung) {
    if (fired.includes(rung))
        return;
    fired.push(rung);
    send(`/e/${rung}/${channelOf(document.referrer)}`);
}
/** What this page load actually beaconed, in order. The TEST SEAM, and the honest one: a beacon
 *  cannot be observed by the e2e suite (automation is excluded from counting by construction), so
 *  what a test can pin is that the app DETECTED the crossing and beaconed it once. Read-only copy. */
export function rungsFired() {
    return [...fired];
}
