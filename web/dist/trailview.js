import './chunk-lutet8cz.js';
import { copy, countNext, markStarted, loadChunk, allDoorClaims, appLang, fillCopy, doorClaim } from './paint.js';
import { trailFor } from './chunk-hbmfsdgg.js';
import './chunk-l5cseoso.js';

const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
function tipWords(s) {
    if (s.id !== "tip" || !s.hash)
        return s;
    const id = new URLSearchParams(s.hash.split("?")[1] ?? "").get("belief");
    const claim = allDoorClaims().find((c) => c.id === id);
    if (claim)
        return { id: s.id, words: claim.q, hash: s.hash };
    return s.key || appLang() !== "es" ? s : { ...s, lang: "en" };
}
function foldStep(d, day) {
    switch (d) {
        case "when": return { id: "when", key: "door1Q", hash: "#/answers" };
        case "together": return { id: "together", key: "door2Q", hash: "#/answers?teams" };
        case "plan": return { id: "plan", key: "door4Q", hash: "#/plan" };
        case "example": return { id: "example", key: "landingExample", action: "example" };
        case "now": return { id: "now", key: "doorNowQ", hash: "#/answers?situation=now" };
        case "wrong": return { id: "wrong", key: "doorWrongQ", hash: "#/log?wrong" };
        case "diary": return { id: "diary", key: "doorDiaryQ", hash: "#/log" };
        case "tip": {
            const c = doorClaim(day);
            return { id: "tip", words: c.q, hash: `#/why?belief=${c.id}` };
        }
    }
}
function trailModel(surface, known, day = dayOfYear()) {
    const t = trailFor(surface, known);
    return { next: tipWords(t.next), more: t.more.map(tipWords), fold: t.fold.map((d) => foldStep(d, day)) };
}
const words = (s) => s.words ?? (s.key ? fillCopy(s.key, s.vars ?? {}) : "");
function ensureTrailCss() {
    if (document.getElementById("trail-css"))
        return;
    const link = document.createElement("link");
    link.id = "trail-css";
    link.rel = "stylesheet";
    link.href = "./trail.css";
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
const wired = new WeakSet();
const NEXT_CLASS = "btn btn-primary trail-go";
const LINK_CLASS = "trail-link";
function drawTrail(host, surface, known, opts = {}) {
    ensureTrailCss();
    const m = trailModel(surface, known);
    const used = new Set();
    const run = (a) => {
        const own = opts.run?.[a];
        if (own) {
            own();
            return;
        }
        if (a === "example")
            void loadChunk("core").then((c) => c.seeExample(location.hash), () => { });
        else if (a === "examplestart")
            void loadChunk("core").then((c) => c.startOwnGarden(), () => { });
    };
    const draw = (s, slot) => {
        const own = s.action ? opts.adopt?.[s.action] : undefined;
        if (own) {
            used.add(own);
            const tap = own.matches("button, a") ? own : own.querySelector("button, a") ?? own;
            tap.dataset.next = s.id;
            if (tap === own) {
                for (const c of ["btn", "btn-primary", "btn-secondary", "primary", "linky", "trail-go", LINK_CLASS])
                    own.classList.remove(c);
                own.classList.add(...(slot === "next" ? NEXT_CLASS : LINK_CLASS).split(" "));
                if (!opts.ownWords?.includes(s.action))
                    own.textContent = words(s);
            }
            return own;
        }
        const node = s.hash || s.href ? document.createElement("a") : document.createElement("button");
        if (node instanceof HTMLAnchorElement)
            node.href = s.hash ?? s.href;
        else
            node.type = "button";
        node.className = slot === "next" ? NEXT_CLASS : LINK_CLASS;
        node.dataset.next = s.id;
        node.textContent = words(s);
        if (s.lang)
            node.lang = s.lang;
        node.addEventListener("click", (e) => {
            if (opts.go?.(s)) {
                e.preventDefault();
                return;
            }
            if (s.action) {
                e.preventDefault();
                run(s.action);
                return;
            }
            if (s.id === "plan" && s.hash === "#/plan") {
                e.preventDefault();
                markStarted();
                void loadChunk("core").then((c) => c.startPlanning(), () => { location.hash = "#/plan"; });
            }
            else if (s.id === "plan")
                markStarted();
        });
        return node;
    };
    const kept = Object.values(opts.adopt ?? {}).filter((x) => !!x);
    const wasOpen = host.dataset.surface === surface && !!host.querySelector(":scope > .trail-fold")?.open;
    host.replaceChildren();
    host.classList.add("trail");
    host.dataset.surface = surface;
    const next = document.createElement("div");
    next.className = "trail-next";
    next.append(draw(m.next, "next"));
    host.append(next);
    if (m.more.length) {
        const more = document.createElement("p");
        more.className = "trail-more";
        for (const s of m.more)
            more.append(draw(s, "more"));
        host.append(more);
    }
    const fold = document.createElement("details");
    fold.className = "trail-fold disclosure";
    const sum = document.createElement("summary");
    sum.textContent = copy.doorsMore;
    const list = document.createElement("ul");
    list.className = "trail-doors";
    for (const s of m.fold) {
        const li = document.createElement("li");
        li.append(draw(s, "fold"));
        list.append(li);
    }
    fold.append(sum, list);
    fold.open = wasOpen;
    host.append(fold);
    const spare = kept.filter((x) => !used.has(x));
    if (spare.length) {
        const box = document.createElement("div");
        box.className = "trail-spare";
        box.hidden = true;
        box.append(...spare);
        host.append(box);
    }
    if (!wired.has(host)) {
        wired.add(host);
        host.addEventListener("click", (e) => {
            const t = e.target?.closest?.("[data-next]");
            if (t?.dataset.next && host.contains(t))
                countNext(t.dataset.next);
        });
    }
}

export { drawTrail, trailModel };
