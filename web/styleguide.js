// The style guide's skin switcher (the product-finish pass, 2026-09-26). The guide draws every component
// with the app's own stylesheet; this stamps <html data-season / data-theme> from the same keys the app
// reads (gg-season, gg-theme - boot.js resolves them the same way before first paint), so the guide shows
// whichever of the eight skins is chosen, and the two rows of buttons change it in place. A file of its
// own because the app's CSP allows no inline script. Contrast scenario 79 walks this page in every skin.
(function () {
  var root = document.documentElement;
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* the stamp still applies */ } };
  var month = new Date().getMonth();
  var dated = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "autumn" : "winter";
  var season = get("gg-season");
  if (!/^(spring|summer|autumn|winter)$/.test(season || "")) season = dated;
  var theme = get("gg-theme");
  if (theme !== "light" && theme !== "dark") theme = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var paint = function () {
    root.setAttribute("data-season", season);
    root.setAttribute("data-theme", theme);
    var bs = document.querySelectorAll("[data-sg-season], [data-sg-theme]");
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      var on = b.getAttribute("data-sg-season") === season || b.getAttribute("data-sg-theme") === theme;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };
  paint();
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-sg-season], [data-sg-theme]") : null;
    if (!b) return;
    if (b.hasAttribute("data-sg-season")) { season = b.getAttribute("data-sg-season"); set("gg-season", season); }
    else { theme = b.getAttribute("data-sg-theme"); set("gg-theme", theme); }
    paint();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
})();
