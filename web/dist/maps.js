// Google Maps Platform config (Phase C - D-031 geocoder, D-033 tiles; key handling D-032).
//
// The key lives in web/maps.json, which is GITIGNORED and written at deploy from a GitHub Actions
// secret - never committed to this repo (D-032; a billable key is not a public anon key). When the
// file is absent (a fork, a dev checkout, CI without the secret), every Google path is skipped and
// the app runs the keyless geocoder chain + keyless Esri imagery exactly as before.
//
// A client-side static app must hand the key to the browser to call Google at all, so the real
// protection is NOT secrecy of the shipped file - it is the Google-console restriction (the key is
// locked to the Pages origin by HTTP-referrer and to its enabled APIs). See docs/MAPS-SETUP.md.
//
// ONE key for both surfaces (Google consolidates Maps products under a single key): it must have
// BOTH the Geocoding API and the Map Tiles API enabled in its API restrictions.
let key;
let loaded = false;
/** Fetch web/maps.json once (network-first via the SW, same as backend.json). Safe to call before
 *  every consumer; the result is memoised. A missing/!ok file or a parse error leaves keyless mode. */
export async function loadMapsConfig() {
    if (loaded)
        return;
    loaded = true;
    try {
        const res = await fetch("./maps.json", { cache: "no-store" });
        if (res.ok) {
            const body = (await res.json());
            const clean = (v) => typeof v === "string" && v.trim() ? v.trim() : undefined;
            // Prefer the single apiKey; accept a legacy tiles/geocoding key so a not-yet-redeployed
            // maps.json keeps working through the transition.
            key = clean(body.apiKey) ?? clean(body.tilesKey) ?? clean(body.geocodingKey);
        }
    }
    catch {
        /* no maps.json - keyless geocoder chain + keyless Esri imagery, unchanged */
    }
}
/** The Google Maps API key (geocoding + tiles), or undefined in keyless mode. Read after
 *  loadMapsConfig() has resolved. */
export const mapsApiKey = () => key;
/** Load the Maps JavaScript API ONCE, for every consumer (D-178/D-181).
 *
 *  This lives here, not in a caller, because Google's loader must run exactly once per page: a second
 *  <script> for maps/api/js produces "You have included the Google Maps JavaScript API multiple
 *  times", and the second load can clobber the first library's objects. Three consumers now share it -
 *  the Geocoder (D-034), the Places typeahead (D-178) and the Where-step map (D-181) - so the promise
 *  is memoised and the libraries every consumer needs are requested up front.
 *
 *  `libraries=places,marker` + `v=weekly`: Places for AutocompleteSuggestion, marker for
 *  AdvancedMarkerElement, weekly because both are recent surfaces and the default channel can predate
 *  them. Resolves false on any failure (no key, blocked, slow) - every caller falls back keyless. */
let mapsJsLoading = null;
export function loadMapsJs() {
    const w = window;
    if (w.google?.maps?.Geocoder)
        return Promise.resolve(true);
    if (mapsJsLoading)
        return mapsJsLoading;
    const k = key;
    if (!k)
        return Promise.resolve(false); // keyless - nothing is requested from Google at all
    mapsJsLoading = new Promise((resolve) => {
        const cb = "__ggMapsReady";
        const g = window;
        const finish = (ok) => { clearTimeout(timer); delete g[cb]; resolve(ok); };
        const timer = setTimeout(() => finish(false), 6000); // a slow/blocked load must not hang the app
        g[cb] = () => finish(!!w.google?.maps?.Geocoder);
        const s = document.createElement("script");
        s.async = true;
        s.onerror = () => finish(false);
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(k) +
            "&libraries=places,marker&v=weekly&callback=" + cb + "&loading=async";
        document.head.appendChild(s);
    });
    return mapsJsLoading;
}
