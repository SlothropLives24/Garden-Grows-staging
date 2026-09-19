import { loadMapsJs, mapsApiKey } from "./maps.js";
const LOCATE_ZOOM = 19;
let map = null;
let marker = null;
let dead = false;
let onMoveCb = null;
const el = () => document.getElementById("gmap");
export async function ensureWhereMap(lat, lon, onMove) {
    onMoveCb = onMove;
    if (dead)
        return false;
    const host = el();
    if (!host) {
        dead = true;
        return false;
    }
    if (!mapsApiKey())
        return false;
    if (map) {
        show(true);
        if (lat != null && lon != null)
            setWhereMapCenter(lat, lon);
        return true;
    }
    if (!(await loadMapsJs())) {
        dead = true;
        return false;
    }
    try {
        const maps = window.google?.maps;
        if (!maps?.Map || !maps?.Marker) {
            dead = true;
            return false;
        }
        const centre = { lat: lat ?? 39.83, lng: lon ?? -98.58 };
        map = new maps.Map(host, {
            center: centre,
            zoom: lat != null && lon != null ? LOCATE_ZOOM : 4,
            mapTypeId: "hybrid",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
            tilt: 0,
        });
        marker = new maps.Marker({
            map, position: centre, draggable: true,
            title: "your garden - drag it onto your ground",
        });
        marker.addListener("dragend", (e) => { if (e?.latLng)
            report(e.latLng); });
        map.addListener("click", (e) => {
            if (!e?.latLng)
                return;
            marker?.setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            report(e.latLng);
        });
        show(true);
        return true;
    }
    catch (e) {
        dead = true;
        return false;
    }
}
const report = (ll) => {
    onMoveCb?.(Math.round(ll.lat() * 1e5) / 1e5, Math.round(ll.lng() * 1e5) / 1e5);
};
export function setWhereMapCenter(lat, lon) {
    if (!map || !marker)
        return;
    const p = { lat, lng: lon };
    marker.setPosition(p);
    if (typeof map.moveCamera === "function")
        map.moveCamera({ center: p, zoom: LOCATE_ZOOM });
    else {
        map.setCenter(p);
        map.setZoom(LOCATE_ZOOM);
    }
}
export function show(on) {
    const host = el();
    if (!host)
        return;
    host.hidden = !on;
    document.body.classList.toggle("gmap-on", on && !!map);
}
