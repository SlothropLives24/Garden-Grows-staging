import './chunk-bc6a6dvg.js';
import { el, cardSrcset, CARD_SIZES } from './core.js';
import { enOnly, copy } from './paint.js';

function card(c) {
    const li = document.createElement("li");
    const a = el(li, "a", c.img ? "prow-card" : "prow-card noimg");
    a.setAttribute("href", c.href);
    if (c.lang)
        a.setAttribute("lang", c.lang);
    for (const [k, v] of Object.entries(c.dataset ?? {}))
        a.setAttribute(`data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v);
    if (c.img) {
        const im = el(a, "img", "prow-img");
        im.setAttribute("alt", "");
        im.setAttribute("width", String(c.img.width));
        im.setAttribute("height", String(c.img.height));
        im.setAttribute("loading", "lazy");
        im.setAttribute("decoding", "async");
        im.setAttribute("src", c.img.src);
        if (c.img.srcset)
            im.setAttribute("srcset", c.img.srcset);
        if (c.img.sizes)
            im.setAttribute("sizes", c.img.sizes);
    }
    if (c.kicker)
        el(a, "span", "prow-k", c.kicker);
    el(a, "span", "prow-t", c.name);
    if (c.fact)
        el(a, "span", "prow-f", c.fact);
    return li;
}
function photoRow(cards, opts) {
    const wrap = el("div", "prow-wrap");
    const ul = el(wrap, "ul", `prow${opts.faces ? " prow--faces" : ""}${opts.onBand ? " prow--onband" : ""}`);
    ul.setAttribute("role", "list");
    ul.setAttribute("aria-label", opts.label);
    for (const c of cards)
        ul.appendChild(card(c));
    if (opts.door) {
        const end = el(ul, "li", "prow-end");
        const a = el(end, "a", "prow-door");
        a.setAttribute("href", opts.door.href);
        el(a, "span", "prow-door-l", opts.door.label);
    }
    if (opts.credits) {
        const d = el(wrap, "details", "prow-credits");
        el(d, "summary", null, opts.credits.summary);
        const p = el(d, "p");
        for (const part of opts.credits.body) {
            if (typeof part === "string") {
                p.append(part);
                continue;
            }
            const a = el(p, "a", null, part.label);
            a.setAttribute("href", part.href);
        }
    }
    return wrap;
}
let sheet = null;
function ensurePhotoRowCss() {
    if (sheet)
        return sheet;
    const root = document.documentElement;
    let link = document.getElementById("photorow-css");
    if (link?.sheet) {
        root.classList.add("prow-css");
        return (sheet = Promise.resolve());
    }
    const made = !link;
    if (!link) {
        link = document.createElement("link");
        link.id = "photorow-css";
        link.rel = "stylesheet";
        link.href = "./photorow.css";
    }
    const here = link;
    sheet = new Promise((done) => {
        const finish = () => { root.classList.add("prow-css"); done(); };
        here.addEventListener("load", finish, { once: true });
        here.addEventListener("error", finish, { once: true });
    });
    if (made) {
        const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
        (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
    }
    return sheet;
}

function guideShelf(entries, door, label) {
    void ensurePhotoRowCss();
    const cards = entries.map((g) => {
        const c = {
            href: `../guides/${g.slug}/`,
            name: g.title,
            dataset: { guide: g.slug },
        };
        if (enOnly(`guides/${g.slug}/`))
            c.lang = "en";
        if (g.thumb) {
            const set = cardSrcset(g.thumb);
            c.img = { src: `img/thumbs/${g.thumb}.webp`, srcset: set ?? undefined, sizes: set ? CARD_SIZES : undefined, width: 456, height: 228 };
        }
        return c;
    });
    const row = photoRow(cards, { label, door: door ? { href: door.href, label: `${door.label} ›` } : undefined });
    row.appendChild(photoCreditsLink());
    if (!row.querySelector("[lang=en]"))
        return row;
    const wrap = el("div", "shelfwrap");
    wrap.append(el("p", "hint shelf-lang", copy.shelfEnglish), row);
    return wrap;
}
function photoCreditsLink(hash = "") {
    const p = el("p", "prow-credits prow-credits-link");
    const a = el(p, "a", null, copy.photoCredits);
    a.setAttribute("href", `../credits/${hash}`);
    return p;
}

export { ensurePhotoRowCss, guideShelf, photoCreditsLink, photoRow };
