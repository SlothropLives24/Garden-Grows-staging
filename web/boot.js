// Boot-splash safety net (D-091), moved out of index.html so the CSP can stay strict (D-122):
// inline scripts and inline onclick handlers would need script-src 'unsafe-inline', which defeats
// the policy. After 15s without app.ts hiding the splash, reveal the reload affordance.

// Theme stamp (Organic redesign round 2): resolve the stored theme preference before first paint
// so a dark-mode user never sees a cream flash. Same key + resolution as units.ts applyTheme,
// which owns every later change.
try {
  var themePref = localStorage.getItem("gg-theme");
  var resolvedTheme = themePref === "dark" || themePref === "light"
    ? themePref
    : (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  if (resolvedTheme === "dark") {
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", "#16140f");
  }
} catch (e) { /* storage unavailable - the light default stands */ }

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
setTimeout(function () {
  var s = document.getElementById("bootsplash");
  if (s && !s.hasAttribute("hidden")) s.classList.add("slow");
}, 15000);
var rb = document.getElementById("bootreload");
if (rb) rb.addEventListener("click", function () { location.reload(); });
