import { go } from './paint.js';

let wired = false;
function setAcctMenu(open) {
    const menu = document.getElementById("acctmenu");
    const chip = document.getElementById("authchip");
    if (!menu)
        return;
    if (open && chip) {
        const r = chip.getBoundingClientRect();
        menu.style.top = `${Math.round(r.bottom + 4)}px`;
        menu.style.right = `${Math.round(document.documentElement.clientWidth - r.right)}px`;
    }
    menu.hidden = !open;
    chip?.setAttribute("aria-expanded", String(open));
}
function wireAcctMenu(signedIn) {
    const menu = document.getElementById("acctmenu");
    const chip = document.getElementById("authchip");
    if (wired || !menu || !chip)
        return;
    wired = true;
    const items = () => [...menu.querySelectorAll("[role=menuitem]")].filter((i) => !i.hidden);
    const open = (first) => {
        const circles = menu.querySelector('[data-sec="sec-teams"]');
        if (circles)
            circles.hidden = document.getElementById("sec-teams")?.hidden === true;
        setAcctMenu(true);
        if (first)
            items()[0]?.focus();
    };
    chip.addEventListener("click", (e) => {
        if (!signedIn())
            return;
        e.preventDefault();
        if (menu.hidden !== false)
            open(e.detail === 0);
        else
            setAcctMenu(false);
    });
    chip.addEventListener("keydown", (e) => {
        if (!signedIn() || (e.key !== " " && e.key !== "ArrowDown"))
            return;
        e.preventDefault();
        open(true);
    });
    document.addEventListener("click", (e) => {
        const t = e.target;
        if (!menu.hidden && t && !menu.contains(t) && !chip.contains(t))
            setAcctMenu(false);
    });
    document.addEventListener("keydown", (e) => {
        if (menu.hidden)
            return;
        const list = items(), i = list.indexOf(document.activeElement);
        const to = (n) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
        if (e.key === "Escape") {
            setAcctMenu(false);
            chip.focus();
        }
        else if (e.key === "ArrowDown")
            to(i + 1);
        else if (e.key === "ArrowUp")
            to(i < 0 ? -1 : i - 1);
        else if (e.key === "Home")
            to(0);
        else if (e.key === "End")
            to(-1);
        else if (e.key === "Tab") {
            setAcctMenu(false);
            chip.focus();
        }
    });
    window.addEventListener("hashchange", () => setAcctMenu(false));
    menu.addEventListener("click", (e) => {
        const a = e.target?.closest("[data-sec]");
        if (!a)
            return;
        e.preventDefault();
        setAcctMenu(false);
        go("account", a.dataset.sec);
    });
    document.getElementById("acctmenuout")?.addEventListener("click", () => {
        setAcctMenu(false);
        document.getElementById("acctsignout")?.click();
    });
}

export { wireAcctMenu };
