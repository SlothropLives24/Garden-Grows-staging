// ONE FRAME (arc "One frame" M1, D-242 point 1): the header menus and the phone's Learn sheet of the content pages.
// Neither carries links of its own - both are drawn from the footer's groups (content/nav.yaml, drawn by
// engine/pages/frame.py) when they open, so the header, the footer and the sheet can never disagree. The sheet
// has its own shape (D-259, O222): search, the Learn doors, the Evidence row, the way on to the footer.
// The app does the same in web/src/navmenu.ts; e2e family 38-one-frame holds the two to one behaviour.
//
// Progressive: without this script "Learn" and "Evidence" are links to their footer column, and the Learn that
// opens the sheet (the phone's tab - the site's menu button - and the lone Learn of the middle widths) is a link
// to the guides. Menus open on a click or a tap, never on hover alone; Enter, Space and
// ArrowDown open one from its button, the arrows, Home and End move through it, Escape closes it and gives
// focus back to its button, and a click anywhere else closes it. The sheet is a modal <dialog>: Escape and
// its close button shut it, and focus goes back to what opened it.
//
// Quick reads (D-242 point 2): a data-peek link (engine/pages/peek.py) opens a peek, drawn by peek.js - loaded,
// with its data, the first time a reader points at, focuses or taps one. Until then, or without it, it is a link.
(function () {
  var doc = document, openBtn = null, menu = null, sheetOpener = null;
  var me = doc.currentScript, base = me && me.src ? new URL(".", me.src) : null;
  function foot() {
    var l = doc.documentElement.getAttribute("lang") === "es" ? "es" : "en";
    return doc.querySelector('#sitefoot .sitenav[data-lang="' + l + '"]') || doc.querySelector("#sitefoot .sitenav");
  }
  function items() { return menu ? [].slice.call(menu.querySelectorAll("a")) : []; }
  function closeMenu(back) {
    if (!menu) return;
    menu.remove();
    menu = null;
    openBtn.setAttribute("aria-expanded", "false");
    if (back) openBtn.focus();
    openBtn = null;
  }
  function openMenu(btn, first) {
    var col = foot() && foot().querySelector('[data-group="' + btn.getAttribute("data-menu") + '"]');
    if (!col) return;
    closeMenu(false);
    menu = doc.createElement("div");
    menu.className = "navmenu";
    menu.id = "navmenu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", col.querySelector(".foot-h").textContent);
    [].forEach.call(col.querySelectorAll("a"), function (a) {
      var c = a.cloneNode(true);
      c.setAttribute("role", "menuitem");
      c.tabIndex = -1;
      menu.appendChild(c);
    });
    doc.body.appendChild(menu);
    var r = btn.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 4) + "px";
    menu.style.left = Math.round(Math.max(8, Math.min(r.left, doc.documentElement.clientWidth - menu.offsetWidth - 8))) + "px";
    openBtn = btn;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", "navmenu");
    if (first) items()[0].focus();
  }
  function move(step) {
    var list = items(), i = list.indexOf(doc.activeElement);
    var n = step === "home" ? 0 : step === "end" ? list.length - 1 : i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
    list[n].focus();
  }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  // The phone's Learn sheet (D-259, O222), drawn from the footer in the page's language: a search box that goes
  // where the footer's search link goes, the Learn group's links as doors with a line each (data-desc), the
  // Evidence group's links in one row, and a last button that closes the sheet on the footer itself, where
  // Tools and About are. Its title is the Learn group's heading.
  function drawSheet(sh, nav) {
    var doors = nav.querySelector('[data-part="doors"]'), row = nav.querySelector('[data-part="row"]');
    var go = nav.querySelector('a[data-part="search"]'), out = [];
    if (go) {
      var f = el("form", "navsheet-q"), l = el("label", ""), q = el("input", "");
      f.setAttribute("role", "search");
      f.method = "get";
      f.action = go.href;
      q.type = "search";
      q.name = "q";
      q.autocomplete = "off";
      q.placeholder = nav.getAttribute("data-q-hint") || "";
      l.appendChild(el("span", "", nav.getAttribute("data-q")));
      l.appendChild(q);
      f.appendChild(l);
      out.push(f);
    }
    if (doors) {
      var d = el("div", "navsheet-doors");
      [].forEach.call(doors.querySelectorAll("a"), function (a) {
        var c = a.cloneNode(true);
        c.appendChild(el("span", "navsheet-d", a.getAttribute("data-desc")));
        d.appendChild(c);
      });
      out.push(d);
    }
    if (row) {
      var r = el("div", "navsheet-row"), links = el("div", "");
      [].forEach.call(row.querySelectorAll("a"), function (a) { links.appendChild(a.cloneNode(true)); });
      r.appendChild(el("p", "navsheet-h", row.querySelector(".foot-h").textContent));
      r.appendChild(links);
      out.push(r);
    }
    var more = el("button", "navsheet-more", nav.getAttribute("data-more"));
    more.type = "button";
    more.addEventListener("click", function () {
      var ft = doc.getElementById("sitefoot"), first = nav.querySelector(".foot-t") || nav.querySelector("a");
      sheetOpener = null;
      sh.close();
      if (ft) ft.scrollIntoView();
      if (first) first.focus({ preventScroll: true });
    });
    out.push(more);
    var body = sh.querySelector(".navsheet-body");
    body.textContent = "";
    out.forEach(function (n) { body.appendChild(n); });
    sh.querySelector(".navsheet-title").textContent = doors ? doors.querySelector(".foot-h").textContent : "";
  }
  function openSheet(opener) {
    var sh = doc.getElementById("navsheet"), nav = foot();
    if (!sh || !nav || !sh.showModal) return false;
    closeMenu(false);
    drawSheet(sh, nav);
    sheetOpener = opener;
    sh.showModal();
    doc.documentElement.classList.add("navsheet-open");
    return true;
  }
  // D-259 point 2 (O222): on a phone the footer's groups fold. Each heading becomes a row that opens its links;
  // from 768px they are four open columns again. Without this script every link shows. The app does the same
  // (web/src/nav.ts).
  function foldFooter() {
    var ft = doc.getElementById("sitefoot"), mq = window.matchMedia && matchMedia("(max-width: 767px)");
    if (!ft || !mq) return;
    function set() {
      [].forEach.call(ft.querySelectorAll(".foot-h"), function (h) {
        var b = h.querySelector("button"), col = h.parentNode;
        if (mq.matches && !b) {
          var t = el("button", "foot-t");
          t.type = "button";
          t.setAttribute("aria-expanded", "false");
          while (h.firstChild) t.appendChild(h.firstChild);
          h.appendChild(t);
          col.classList.add("folded");
        } else if (!mq.matches && b) {
          while (b.firstChild) h.appendChild(b.firstChild);
          b.remove();
          col.classList.remove("folded");
        }
      });
      [].forEach.call(ft.querySelectorAll(".sitenav"), function (n) { n.classList.toggle("folds", mq.matches); });
    }
    set();
    if (mq.addEventListener) mq.addEventListener("change", set);
    ft.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".foot-t");
      if (!t) return;
      var open = t.getAttribute("aria-expanded") !== "true";
      t.setAttribute("aria-expanded", String(open));
      t.parentNode.parentNode.classList.toggle("folded", !open);
    });
  }

  // ---- quick reads: peek.js, on demand (same stamp as this file) --------------------------------------
  var peekJs = null;
  function peekLib() {
    if (!peekJs) peekJs = new Promise(function (ok, no) {
      var sc = doc.createElement("script");
      sc.src = new URL("peek.js" + new URL(me.src).search, base).href;
      sc.onload = function () { ok(window.GGpeek); };
      sc.onerror = function () { peekJs = null; sc.remove(); no(); };
      doc.head.appendChild(sc);
    });
    return peekJs;
  }
  function peekLink(e) {
    var a = e.target.closest && e.target.closest("a[data-peek]");
    return a && base && window.fetch && window.HTMLDialogElement && !a.closest("dialog") ? a : null;
  }
  function warm(e) {
    var a = peekLink(e);
    if (a) peekLib().then(function (P) { P.warm(a); }, function () {});
  }
  doc.addEventListener("pointerover", warm, { passive: true });
  doc.addEventListener("focusin", warm);
  doc.addEventListener("touchstart", warm, { passive: true });
  function init() {
    foldFooter();
    // a reload (or a return with no page cache) on the entry a peek pushed opens that peek again
    if (history.state && history.state.peek && base && window.HTMLDialogElement) peekLib().then(function (P) { P.restore(); }, function () {});
    [].forEach.call(doc.querySelectorAll("a[data-menu]"), function (a) { a.setAttribute("role", "button"); });
    [].forEach.call(doc.querySelectorAll("a[data-sheet]"), function (a) { a.setAttribute("aria-haspopup", "dialog"); });
    var sh = doc.getElementById("navsheet");
    if (!sh) return;
    sh.addEventListener("close", function () {
      doc.documentElement.classList.remove("navsheet-open");
      if (sheetOpener) sheetOpener.focus();
      sheetOpener = null;
    });
    sh.addEventListener("click", function (e) {
      // the close control, a link (it navigates; the sheet goes with the page), or the backdrop beside it
      if (e.target === sh || e.target.closest(".navsheet-x")) sh.close();
    });
  }
  doc.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var btn = t.closest("[data-menu]"), sheet = t.closest("[data-sheet]"), pk = peekLink(e);
    if (pk && !e.defaultPrevented && !e.button && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      closeMenu(false);
      peekLib().then(function (P) { P.open(pk); }, function () { location.href = pk.href; });
      return;
    }
    if (btn) {
      e.preventDefault();
      if (openBtn === btn) closeMenu(false); else openMenu(btn, e.detail === 0);
      return;
    }
    if (sheet && openSheet(sheet)) { e.preventDefault(); return; }
    if (menu && !menu.contains(t)) closeMenu(false);
  });
  doc.addEventListener("keydown", function (e) {
    var btn = e.target.closest && e.target.closest("[data-menu]");
    if (btn && (e.key === " " || e.key === "Enter" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (openBtn === btn && e.key !== "ArrowDown") closeMenu(false); else openMenu(btn, true);
      return;
    }
    if (e.target.closest && e.target.closest("[data-sheet]") && e.key === " ") { e.preventDefault(); openSheet(e.target.closest("[data-sheet]")); return; }
    if (!menu) return;
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); move("home"); }
    else if (e.key === "End") { e.preventDefault(); move("end"); }
    else if (e.key === "Tab") closeMenu(true);   // back on its button, so Tab carries on from there
  });
  addEventListener("resize", function () { closeMenu(false); });
  // THE PICTURE CARRY (D-241 point 3, O199): as the page swaps with a View Transition (pages.css opts in, inside
  // prefers-reduced-motion: no-preference - so under "reduce motion" there is no transition and this does
  // nothing), a picture inside the link that was followed to a plant page takes the plant-photo name, and the
  // new page grows it into its header photo. This page's own header photo gives up the name while it does.
  addEventListener("pageswap", function (e) {
    var root = doc.documentElement, to = e.activation && e.activation.entry && e.activation.entry.url;
    [].forEach.call(doc.querySelectorAll(".vt-carry"), function (x) { x.classList.remove("vt-carry"); });
    root.classList.remove("vt-carrying");
    if (!e.viewTransition || !to || !/\/plants\/[^/]+\/$/.test(new URL(to).pathname)) return;
    var links = doc.querySelectorAll("main a[href]");
    for (var i = 0; i < links.length; i++) {
      var im = links[i].href === to && links[i].querySelector("img");
      if (im && im.getClientRects().length) { im.classList.add("vt-carry"); root.classList.add("vt-carrying"); return; }
    }
  });
  // NEXT-STEP TAPS (Many doors M3; docs/MEASUREMENT.md 2.1, 3.6): a tap on a trail's step (engine/pages/trail.py) counts
  // /e/next-<id> from the closed list (display-vocab trail_next), once per load, its path only, behind shell.py's gates.
  var NEXT = " when together plan example now wrong diary tip ics note frost owndates map guide ", sent = {};
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-next]"), id = a && a.getAttribute("data-next"), n = navigator;
    if (!id || NEXT.indexOf(" " + id + " ") < 0 || sent[id]) return;
    sent[id] = 1;
    try {
      if (!{"milpa.garden": 1, "www.milpa.garden": 1}[location.hostname] || n.webdriver) return;
      if (n.doNotTrack === "1" || n.globalPrivacyControl === true) return;
      fetch("https://milpa-garden.goatcounter.com/count?p=" + encodeURIComponent("/e/next-" + id) + "&rnd=" + Date.now(),
        { method: "GET", keepalive: true, mode: "no-cors" }).catch(function () {});
    } catch (x) {}
  });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
