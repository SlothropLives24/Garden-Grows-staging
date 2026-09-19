import { GOATCOUNTER_CODE } from "./engine/display-vocab.gen.js";
const CODE = GOATCOUNTER_CODE;
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
    catch { }
}
export function countPageview() {
    send("/");
}
let gardenCounted = false;
export function countGardenActive(plot) {
    if (gardenCounted || !plot || !plot.anchor || plot.example === true)
        return;
    gardenCounted = true;
    send("/e/garden-active");
}
const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|baidu|yandex|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(reddit|facebook|instagram|x|twitter|t|bsky|mastodon|threads|pinterest|youtube|linkedin|news\.ycombinator)\./;
const DIRECTORY = /(^|\.)(alternativeto|producthunt|slant|saashub|github|gitlab|awesome|pwa\.directory)\./;
export function channelOf(referrer) {
    if (!referrer)
        return "direct";
    let host;
    try {
        host = new URL(referrer).hostname.toLowerCase();
    }
    catch {
        return "other";
    }
    if (!host)
        return "direct";
    if (PROD_HOSTS.has(host))
        return "direct";
    if (SEARCH.test(`.${host}.`))
        return "organic";
    if (SOCIAL.test(`.${host}.`))
        return "social";
    if (DIRECTORY.test(`.${host}.`))
        return "directory";
    return "other";
}
const fired = [];
export function countRung(rung) {
    if (fired.includes(rung))
        return;
    fired.push(rung);
    send(`/e/${rung}/${channelOf(document.referrer)}`);
}
export function rungsFired() {
    return [...fired];
}
