import { el } from './core.js';
import './paint.js';

let openBtn = null;
let menu = null;
let sheetOpener = null;
let wired = false;
function foot() {
    const l = document.documentElement.lang === "es" ? "es" : "en";
    return document.querySelector(`#sitefoot .sitenav[data-lang="${l}"]`);
}
const items = () => (menu ? [...menu.querySelectorAll("a")] : []);
function closeMenu(back) {
    if (!menu || !openBtn)
        return;
    menu.remove();
    menu = null;
    openBtn.setAttribute("aria-expanded", "false");
    if (back)
        openBtn.focus();
    openBtn = null;
}
function move(step) {
    const list = items(), i = list.indexOf(document.activeElement);
    const n = step === "home" ? 0 : step === "end" ? list.length - 1
        : i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
    list[n]?.focus();
}
function wire() {
    if (wired)
        return;
    wired = true;
    document.addEventListener("click", (e) => {
        const t = e.target;
        if (menu && t && !menu.contains(t) && !openBtn?.contains(t))
            closeMenu(false);
    });
    document.addEventListener("keydown", (e) => {
        if (!menu)
            return;
        if (e.key === "Escape") {
            e.preventDefault();
            closeMenu(true);
        }
        else if (e.key === "ArrowDown") {
            if (!openBtn?.contains(e.target)) {
                e.preventDefault();
                move(1);
            }
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
        }
        else if (e.key === "Home") {
            e.preventDefault();
            move("home");
        }
        else if (e.key === "End") {
            e.preventDefault();
            move("end");
        }
        else if (e.key === "Tab")
            closeMenu(true);
    });
    addEventListener("resize", () => closeMenu(false));
    addEventListener("hashchange", () => closeMenu(false));
    const sh = document.getElementById("navsheet");
    sh?.addEventListener("close", () => {
        document.documentElement.classList.remove("navsheet-open");
        sheetOpener?.focus();
        sheetOpener = null;
    });
    sh?.addEventListener("click", (e) => {
        const t = e.target;
        if (t === sh || t.closest(".navsheet-x, a"))
            sh.close();
    });
    sh?.addEventListener("submit", () => sh.close());
}
function toggleMenu(btn, first, open = false) {
    wire();
    if (openBtn === btn) {
        if (!open)
            closeMenu(false);
        else if (first)
            items()[0]?.focus();
        return;
    }
    const col = foot()?.querySelector(`[data-group="${btn.dataset.menu}"]`);
    if (!col)
        return;
    closeMenu(false);
    const m = document.createElement("div");
    m.className = "navmenu";
    m.id = "navmenu";
    m.setAttribute("role", "menu");
    m.setAttribute("aria-label", col.querySelector(".foot-h")?.textContent ?? "");
    for (const a of col.querySelectorAll("a")) {
        const c = a.cloneNode(true);
        c.setAttribute("role", "menuitem");
        c.tabIndex = -1;
        m.appendChild(c);
    }
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = `${Math.round(r.bottom + 4)}px`;
    m.style.left = `${Math.round(Math.max(8, Math.min(r.left, document.documentElement.clientWidth - m.offsetWidth - 8)))}px`;
    menu = m;
    openBtn = btn;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", "navmenu");
    if (first)
        items()[0]?.focus();
}
function drawSheet(sh, nav) {
    const doors = nav.querySelector('[data-part="doors"]'), row = nav.querySelector('[data-part="row"]');
    const go = nav.querySelector('a[data-part="search"]');
    const out = [];
    if (go) {
        const f = el("form", "navsheet-q"), l = el("label"), q = el("input");
        f.setAttribute("role", "search");
        f.method = "get";
        f.action = go.href;
        q.type = "search";
        q.name = "q";
        q.autocomplete = "off";
        q.placeholder = nav.dataset.qHint ?? "";
        l.append(el("span", null, nav.dataset.q), q);
        f.append(l);
        out.push(f);
    }
    if (doors) {
        const d = el("div", "navsheet-doors");
        for (const a of doors.querySelectorAll("a")) {
            const c = a.cloneNode(true);
            c.append(el("span", "navsheet-d", a.dataset.desc));
            d.append(c);
        }
        out.push(d);
    }
    if (row) {
        const r = el("div", "navsheet-row"), links = el("div");
        for (const a of row.querySelectorAll("a"))
            links.append(a.cloneNode(true));
        r.append(el("p", "navsheet-h", row.querySelector(".foot-h")?.textContent ?? ""), links);
        out.push(r);
    }
    const more = el("button", "navsheet-more", nav.dataset.more);
    more.type = "button";
    more.addEventListener("click", () => {
        sheetOpener = null;
        sh.close();
        document.getElementById("sitefoot")?.scrollIntoView();
        (nav.querySelector(".foot-t") ?? nav.querySelector("a"))?.focus({ preventScroll: true });
    });
    out.push(more);
    sh.querySelector(".navsheet-body")?.replaceChildren(...out);
    const title = sh.querySelector(".navsheet-title");
    if (title)
        title.textContent = doors?.querySelector(".foot-h")?.textContent ?? "";
}
function openSheet(opener) {
    wire();
    const sh = document.getElementById("navsheet"), nav = foot();
    if (!sh || !nav || typeof sh.showModal !== "function") {
        location.href = opener.href;
        return;
    }
    closeMenu(false);
    drawSheet(sh, nav);
    sheetOpener = opener;
    sh.showModal();
    document.documentElement.classList.add("navsheet-open");
}

export { openSheet, toggleMenu };
