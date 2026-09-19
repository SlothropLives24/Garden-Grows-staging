let key;
let loaded = false;
export async function loadMapsConfig() {
    if (loaded)
        return;
    loaded = true;
    try {
        const res = await fetch("./maps.json", { cache: "no-store" });
        if (res.ok) {
            const body = (await res.json());
            const clean = (v) => typeof v === "string" && v.trim() ? v.trim() : undefined;
            key = clean(body.apiKey) ?? clean(body.tilesKey) ?? clean(body.geocodingKey);
        }
    }
    catch {
    }
}
export const mapsApiKey = () => key;
let mapsJsLoading = null;
export function loadMapsJs() {
    const w = window;
    if (w.google?.maps?.Geocoder)
        return Promise.resolve(true);
    if (mapsJsLoading)
        return mapsJsLoading;
    const k = key;
    if (!k)
        return Promise.resolve(false);
    mapsJsLoading = new Promise((resolve) => {
        const cb = "__ggMapsReady";
        const g = window;
        const finish = (ok) => { clearTimeout(timer); delete g[cb]; resolve(ok); };
        const timer = setTimeout(() => finish(false), 6000);
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
