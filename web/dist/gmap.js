// The Where-step location map (D-181, Phase 2 of the Uber-style rebuild).
//
// WHAT THIS IS AND IS NOT. This is the LOCATION PICKER only - the surface where a gardener confirms
// where their garden is, by looking at their own roof and dragging a pin onto it. It is a real Google
// Map because that is what makes tiles stream smoothly and pan/zoom feel native; the custom SVG canvas
// could never match it (D-178).
//
// It is NOT the bed-design canvas. D-078 stands: beds are laid out on the grid-snapped custom canvas,
// and "do not build the canvas" applies to every other surface. This module owns one element,
// `#gmap`, shown only while the Where step is open and only when a Google key is configured. Leave
// Where - or run keyless - and the custom canvas is back, untouched.
//
// It does NOT change the data model either. The map reports lat/lng; the app keeps writing the plot
// anchor and its local-metre frame exactly as before (CLAUDE.md: do not refactor this). The engine
// never sees a Google object (D-008) - only the visible, overridable lat/lon.
import { loadMapsJs, mapsApiKey } from "./maps.js";
// House-and-surroundings, the same intent as the custom map's LOCATE_ZOOM: close enough to recognise
// your roof, wide enough to check it against the driveway and the street (walk round 9).
const LOCATE_ZOOM = 19;
let map = null;
let marker = null;
let dead = false; // proven unavailable once - stop trying, stay on the custom canvas
let onMoveCb = null;
/** Why the Google map is not showing, for the same reason placesWhy exists (D-178): a silent
 *  fallback is indistinguishable from a broken feature. Empty when the map is up or simply keyless. */
export let gmapWhy = "";
const el = () => document.getElementById("gmap");
/** Bring the Google location map up, centred on `lat`/`lon` when they are known. Returns false when
 *  it is unavailable for any reason - the caller keeps the custom canvas and nothing is hidden. */
export async function ensureWhereMap(lat, lon, onMove) {
    onMoveCb = onMove;
    if (dead)
        return false;
    const host = el();
    if (!host) {
        dead = true;
        gmapWhy = "no #gmap element";
        return false;
    }
    if (!mapsApiKey()) {
        gmapWhy = "no Google key - keyless map";
        return false;
    }
    if (map) {
        show(true);
        if (lat != null && lon != null)
            setWhereMapCenter(lat, lon);
        return true;
    }
    if (!(await loadMapsJs())) {
        dead = true;
        gmapWhy = "Google Maps JS did not load";
        return false;
    }
    try {
        const maps = window.google?.maps;
        if (!maps?.Map || !maps?.Marker) {
            dead = true;
            gmapWhy = "Maps JS loaded without Map/Marker";
            return false;
        }
        const centre = { lat: lat ?? 39.83, lng: lon ?? -98.58 }; // the continental centroid until located
        map = new maps.Map(host, {
            center: centre,
            zoom: lat != null && lon != null ? LOCATE_ZOOM : 4,
            // hybrid: satellite WITH street names - you find your house by the roof, you confirm it by the
            // street. Google's own zoom control replaces the custom canvas's (the CSS hides that while this
            // map is up); everything else is chrome a location picker does not need.
            mapTypeId: "hybrid",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy", // one finger pans - this map owns its viewport, there is no page scroll behind it
            clickableIcons: false, // tapping a business pin must not hijack "put my garden here"
            tilt: 0,
        });
        marker = new maps.Marker({
            map, position: centre, draggable: true,
            title: "your garden - drag it onto your ground",
        });
        // Two ways to correct the pin, the same two the custom canvas offers: drag it, or tap the spot.
        marker.addListener("dragend", (e) => { if (e?.latLng)
            report(e.latLng); });
        map.addListener("click", (e) => {
            if (!e?.latLng)
                return;
            marker?.setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            report(e.latLng);
        });
        gmapWhy = "";
        show(true);
        return true;
    }
    catch (e) {
        dead = true;
        gmapWhy = "Google map failed: " + String(e?.message ?? e).slice(0, 80);
        return false;
    }
}
const report = (ll) => {
    onMoveCb?.(Math.round(ll.lat() * 1e5) / 1e5, Math.round(ll.lng() * 1e5) / 1e5);
};
/** Move the map and its pin to a resolved address, in ONE camera move (D-183).
 *
 *  `setCenter` then `setZoom` are two separate camera operations: the map pans to the new place at the
 *  OLD zoom, requests and paints that tile set, then zooms - a visible two-step re-render that reads as
 *  the map "glitching" as it loads (maintainer, on-device). `moveCamera` applies centre and zoom as one
 *  transaction so a single tile set is fetched. It is a recent surface, so fall back to the pair when
 *  it is absent rather than lose the recentre entirely. */
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
/** Show or hide the Google map. Hiding restores the custom canvas by removing the body class the CSS
 *  keys off - the canvas itself is never touched, so leaving Where returns to exactly what was there. */
export function show(on) {
    const host = el();
    if (!host)
        return;
    host.hidden = !on;
    document.body.classList.toggle("gmap-on", on && !!map);
}
/** True when the Google map is the visible location surface. */
export const whereMapActive = () => !!map && !!el() && !el().hidden;
