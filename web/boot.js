// Boot-splash safety net (D-091), moved out of index.html so the CSP can stay strict (D-122):
// inline scripts and inline onclick handlers would need script-src 'unsafe-inline', which defeats
// the policy. After 15s without app.ts hiding the splash, reveal the reload affordance. Runs in
// <head>, before the stylesheet (O202).

// The site root IS the app (O221(d)): `make site` serves this shell at `/` too, based at /web/
// (scripts/root_app.py), so a visitor typing the bare domain never hops between two documents - the
// private window's dark canvas showed between the old forwarding stub and this page. Here, before any
// app code reads the address, `/` becomes `/web/` in place: no navigation, no history entry.
try {
  if (location.pathname === "/") history.replaceState(history.state, "", "/web/" + location.search + location.hash);
} catch (e) { /* no history API: the base element still resolves every URL under /web/ */ }

// Theme stamp (Organic redesign round 2): resolve the stored theme preference before first paint
// so a dark-mode user never sees a cream flash. Same key + resolution as units.ts applyTheme,
// which owns every later change. O202: the color-scheme meta turns dark only here (a private window
// stores no theme, so it stays light).
// O193: storage that THROWS (blocked site data, some private modes) must not cost the OS's own choice - the
// preference read has its own try, so a dark device still paints dark (the site's head already did this).
try {
  var themePref = null;
  try { themePref = localStorage.getItem("gg-theme"); } catch (e) { /* no storage: follow the device */ }
  var resolvedTheme = themePref === "dark" || themePref === "light"
    ? themePref
    : (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  if (resolvedTheme === "dark") {
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", "#16140f");
    var cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.setAttribute("content", "dark");
  }
} catch (e) { /* no matchMedia either - the light default stands */ }

// Season stamp (O88 S3): same shape as the theme stamp above and for the same reason - resolve
// before first paint so nobody sees autumn flash to spring. Same keys and same resolution as
// units.ts applySeason, which owns every later change.
//
// "follow" (the default) tracks the calendar on METEOROLOGICAL boundaries - Mar/Jun/Sep/Dec 1 -
// which is what gardening sources use and what makes the arithmetic month-aligned. `gg-hemi` is a
// one-character mirror of the garden's hemisphere, written when its anchor is set; only "n"/"s" is
// stored, never coordinates, and northern stands until a garden says otherwise (R-081: latitude is
// its own quantity and is never inferred from zone or anything else).
try {
  var seasons = ["spring", "summer", "autumn", "winter"];
  var seasonPref = localStorage.getItem("gg-season");
  var resolvedSeason;
  if (seasons.indexOf(seasonPref) >= 0) {
    resolvedSeason = seasonPref;
  } else {
    var north = seasons[Math.floor(((new Date().getMonth() + 10) % 12) / 3)];
    resolvedSeason = localStorage.getItem("gg-hemi") === "s"
      ? seasons[(seasons.indexOf(north) + 2) % 4]
      : north;
  }
  document.documentElement.setAttribute("data-season", resolvedSeason);
} catch (e) { /* storage unavailable - the bare :root (autumn) stands */ }

// Silhouette-layer opt-out stamp (O149): the "Background garden" display pref. Default is SHOWN, so we
// only stamp when the user turned it OFF - and pre-paint, so the layer never flashes on for someone who
// hid it. Same shape as the theme/season stamps above; units.ts applySilo owns every later change.
try {
  if (localStorage.getItem("gg-silo") === "off") {
    document.documentElement.setAttribute("data-silo", "off");
  }
} catch (e) { /* storage unavailable - the default (shown) stands */ }
// Language stamp (D-219; D-386): the app's language, before first paint - same key as lang.ts, which owns
// every later change (a change reloads the page). With nothing chosen, a browser whose first language is
// Spanish boots in Spanish (D-386, the maintainer 2026-10-24, the catalog complete); English stands otherwise.
// Perf track 5: the Spanish catalog is its own module that copy.ts imports only for a Spanish reader,
// and the whole app waits on it. Asking for it HERE, before the module graph has even been fetched,
// lets it download alongside the graph instead of after it - so Spanish costs no extra wait, and
// English visitors never download it at all. Likewise lang.ts's list of the site's Spanish pages.
// O235: a link from the site's Spanish pages carries ?lang=es (lang.ts keeps it as the choice, a moment later) -
// read here too, so that first paint is already Spanish rather than English for the beat until lang.ts runs.
var bootLang = null;
try { bootLang = (/lang=(e[ns])/.exec(location.search) || [])[1] || localStorage.getItem("gg-lang"); } catch (e) { /* English stands */ }
try { if (bootLang !== "en" && bootLang !== "es" && /^es(-|$)/i.test((navigator.languages || [])[0] || "")) bootLang = "es"; } catch (e) { /* English stands */ }
try {
  if (bootLang === "es") {
    document.documentElement.setAttribute("lang", "es");
    var esCopy = document.createElement("link");
    esCopy.rel = "modulepreload";
    esCopy.href = "./dist/copy-values-es.gen.js";
    document.head.appendChild(esCopy);
    var esSite = esCopy.cloneNode();
    esSite.href = "./dist/sitepages-es.gen.js";
    document.head.appendChild(esSite);
  }
} catch (e) { /* storage unavailable - English stands */ }
// O235 (the phone's first screen): the shell carries the landing's own words (scripts/prefill_shell.py, at
// deploy), so a STRANGER's landing paints as soon as styles.css applies instead of under the splash until the
// whole app has run. A stranger is a load headed for the landing (a bare address or #/start, as arrival.ts's
// arrivalPlan reads it) on a device that has never started planning and has no returning home (no gg-started,
// no gg-home): exactly the loads app.ts already lets show the landing early (D-233), now shown sooner still.
// Everyone else keeps the splash until their page is up. styles.css does the
// showing, so nothing appears before the stylesheet does; app.ts lifts the stamp as it drops the splash.
// The language line (D-219) is stamped too, so its pre-drawn twin holds its place: the Spanish device's
// machine-translation notice, with the switch to English (langbar.ts's rules; D-386 retired the offer).
try {
  var bootHash = location.hash;
  var bootKnown = false;
  try {
    bootKnown = ["gg-home", "tsg.home", "gg-started", "tsg.started"].some(function (k) { return localStorage.getItem(k) === "1"; });
  } catch (e) { /* nothing stored - a stranger */ }
  // (#/home is #/start's own alias, O374: router.ts answers it there, so a stranger arriving on it lands early too)
  if (!bootKnown && (bootHash === "" || bootHash === "#" || bootHash === "#/" || bootHash.indexOf("#/start") === 0
    || bootHash === "#/home" || bootHash.indexOf("#/home?") === 0)) {
    document.documentElement.setAttribute("data-first", "land");
    // The landing's page is shown the moment the parser reaches it (the router shows it anyway, later): every
    // landing rule keyed on #page-start:not([hidden]) - its width, the header it wants - then holds from the
    // first frame, so nothing moves when the app takes over. An observer's callback runs before the next paint.
    // Door 3 asks a different claim each day (doors.ts doorClaim; the shell carries them all, data-c in order):
    // today's is marked here, by app.ts's own day arithmetic, so the door never changes its words on screen.
    var bootShown = false, bootDoor = false;
    var bootScan = function () {
      var pg = !bootShown && document.getElementById("page-start");
      if (pg) { pg.removeAttribute("hidden"); bootShown = true; }
      var q = !bootDoor && document.querySelector('a.lg-door[href^="#/why"] [data-pl][data-n]');
      if (q && q.parentNode && q.parentNode.nextSibling) { // the door's own markup has been read whole
        var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        var pick = String(Math.abs(Math.trunc(day)) % Number(q.getAttribute("data-n")));
        for (var ci2 = 0; ci2 < q.children.length; ci2++) {
          if (q.children[ci2].getAttribute("data-c") !== pick) continue;
          q.children[ci2].setAttribute("data-on", "");
          // Many doors M1: the door opens today's claim itself, even tapped before the app is up (app.ts sets the same)
          var bid = q.children[ci2].getAttribute("data-b"), link = q.closest && q.closest("a");
          if (bid && link) link.setAttribute("href", "#/why?belief=" + bid);
        }
        bootDoor = true;
      }
      return bootShown && bootDoor;
    };
    var bootMo = new MutationObserver(function () { if (bootScan()) bootMo.disconnect(); });
    bootMo.observe(document.documentElement, { childList: true, subtree: true });
    addEventListener("DOMContentLoaded", function () { bootScan(); bootMo.disconnect(); });
  }
  var bootLb = bootLang === "es" ? "note" : null;
  if (bootLb) document.documentElement.setAttribute("data-lb", bootLb);
} catch (e) { /* the splash covers the landing as before */ }
// Route splitting (perf stage 2): the app is a small entry plus chunks, and the entry imports the core
// only once it has run. For a device that has started planning (gg-started) the core - and the Home it
// will most likely open on - are certain, so ask for their files HERE, from the deployed chunk manifest
// (#gg-chunks, written just above this script by scripts/version_app_assets.py), before the module graph
// has even begun: they then download alongside the entry instead of after it. A stranger gets nothing
// extra, so nothing competes with their first paint. No manifest (the dev server) - nothing to do.
try {
  if (localStorage.getItem("gg-started") === "1") {
    var manifestEl = document.getElementById("gg-chunks");
    var chunkMap = manifestEl ? JSON.parse(manifestEl.textContent || "{}") : {};
    var wantChunks = ["dist/core.js", "dist/home.js"];
    for (var ci = 0; ci < wantChunks.length; ci++) {
      var files = chunkMap[wantChunks[ci]] || [];
      for (var fi = 0; fi < files.length; fi++) {
        var pre = document.createElement("link");
        pre.rel = "modulepreload";
        pre.href = "./" + files[fi];
        document.head.appendChild(pre);
      }
    }
  }
} catch (e) { /* storage or manifest unreadable - the entry loads the core itself, a moment later */ }
setTimeout(function () {
  var s = document.getElementById("bootsplash");
  if (s && !s.hasAttribute("hidden")) s.classList.add("slow");
}, 15000);
// The splash is parsed after this file, so its Reload button is found on the click.
// O235: a stranger can now tap a landing door before the app is up. The tap is kept (the door's id) and app.ts
// replays it once the page is ready, so it is never lost; a link door (#/why) navigates on its own, so only which
// door it was is kept, for app.ts to count (D-337 point 4).
document.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("#bootreload")) location.reload();
  var de = document.documentElement;
  if (de.getAttribute("data-first") === "land" && e.target.closest) {
    var door = e.target.closest("#page-start button[id]");
    if (door) window.__ggEarlyTap = door.id;
    var link = e.target.closest("#page-start a[data-door]");
    if (link) window.__ggEarlyDoor = link.getAttribute("data-door");
  }
});
// O399 (c): the landing's first step is a form. Submitted before app.ts is up it must not reload the page (a GET to
// this very page): its submit button's tap is kept above (#doorwhen) and app.ts replays it with the field as typed.
document.addEventListener("submit", function (e) {
  if (e.target && e.target.id === "lgfirst") e.preventDefault();
});
