// QUICK READS (arc "One frame" M2, D-242 point 2): the peek. frame.js loads this the first time a reader points at,
// focuses or taps a data-peek link (engine/pages/peek.py marks them), and hands it the link. A modal <dialog>: a
// side drawer on a wide screen, a bottom sheet on a phone (pages.css). Its words are the rule's or the plant's own
// page's, read back at build into peek-<kind>[-es].json, fetched on first use. The page's URL never changes; the
// peek pushes a history entry with the same URL, so Back closes it, as do Escape, the close control and a click
// outside it. Tab stays inside while it is open; focus goes back to the link after. No data, no peek: the link
// navigates.
(function () {
  var doc = document, me = doc.currentScript, base = new URL(".", me.src);
  var data = {}, dlg = null, from = null, pushed = false, backing = false;
  function keyOf(href) {
    var u = new URL(href, location.href);
    return u.origin === base.origin && u.pathname.indexOf(base.pathname) === 0 ? u.pathname.slice(base.pathname.length) : null;
  }
  function load(key) {
    var es = key.indexOf("es/") === 0, kind = key.slice(es ? 3 : 0).split("/")[0];
    var file = "peek-" + kind + (es ? "-es" : "") + ".json";
    if (!data[file]) {
      data[file] = fetch(new URL(file, base).href).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
      data[file].then(function (d) { if (!d) delete data[file]; });
    }
    return data[file].then(function (d) { return d && d.p[key] ? { s: d.s, e: d.p[key], kind: kind } : null; });
  }
  function el(parent, tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;   // the build's own words; peek.py keeps only em, strong and spans
    return parent ? parent.appendChild(n) : n;
  }
  function dialog() {
    if (dlg) return dlg;
    dlg = el(doc.body, "dialog", "peek");
    dlg.setAttribute("aria-labelledby", "peek-t");
    var bar = el(dlg, "div", "peek-bar");
    el(bar, "p", "peek-k");
    var x = el(bar, "button", "peek-x");
    x.type = "button";
    x.textContent = "×";
    el(dlg, "div", "peek-body");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest(".peek-x")) dlg.close();   // outside the drawer is the dialog itself
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = [].slice.call(dlg.querySelectorAll("a[href], button")), i = f.indexOf(doc.activeElement);
      if (i < 0 || (e.shiftKey ? i === 0 : i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    });
    dlg.addEventListener("close", function () {
      doc.documentElement.classList.remove("peek-open");
      if (pushed && !backing) { backing = true; history.back(); }
      pushed = false;
      if (from) from.focus();
      from = null;
    });
    addEventListener("popstate", function () {
      if (backing) { backing = false; return; }   // the Back a close asked for
      if (dlg.open) { pushed = false; dlg.close(); }
    });
    return dlg;
  }
  function fill(d, href) {
    var box = dialog(), body = box.querySelector(".peek-body"), e = d.e;
    box.setAttribute("data-kind", d.kind);
    box.querySelector(".peek-k").textContent = d.s.k;
    box.querySelector(".peek-x").setAttribute("aria-label", d.s.x);
    body.textContent = "";
    if (e.i) {
      var im = el(body, "img", "peek-img");
      im.src = new URL("web/img/thumbs/" + e.i + ".webp", base).href;
      im.alt = "";
      im.width = im.height = 96;
    }
    el(body, "h2", "peek-t").textContent = e.t;
    body.lastChild.id = "peek-t";
    if (d.kind === "rules") {
      var g = el(body, "p", "peek-g");
      el(g, "span", "conf g" + e.g).textContent = e.w;
      if (e.m) el(g, "span", "peek-m", e.m);
      if (e.b) { el(body, "h3", "peek-h").textContent = e.h; el(body, "p", "peek-b", e.b); }
    } else {
      if (e.s) el(body, "p", "peek-s", e.s);
      if (e.f && e.f.length) {
        var dl = el(body, "dl", "peek-f");
        e.f.forEach(function (f) { el(dl, "dt").textContent = f[0]; el(dl, "dd", null, f[1]); });
      }
    }
    var go = el(el(body, "p", "peek-more"), "a");
    go.href = href;
    go.textContent = d.s.r;
  }
  function show(push) {
    var box = dialog();
    box.showModal();
    doc.documentElement.classList.add("peek-open");
    if (push) history.pushState({ peek: push }, "", location.href);
    pushed = true;
    box.scrollTop = 0;
  }
  window.GGpeek = {
    warm: function (a) { var k = keyOf(a.href); if (k) load(k); },
    open: function (a) {
      var key = keyOf(a.href);
      if (!key || backing) { if (!backing) location.href = a.href; return; }
      a.setAttribute("aria-busy", "true");
      load(key).then(function (d) {
        a.removeAttribute("aria-busy");
        if (!d) { location.href = a.href; return; }
        fill(d, a.href);
        if (dlg.open) { dlg.scrollTop = 0; return; }
        from = a;
        show(key);
      });
    },
    // the entry a peek pushed, reloaded (or returned to with no page cache): the same peek again
    restore: function () {
      var key = history.state && history.state.peek;
      if (key) load(key).then(function (d) { if (d && !(dlg && dlg.open)) { fill(d, new URL(key, base).href); show(null); } });
    }
  };
})();
