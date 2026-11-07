// The site editor's matcher and stamp (O237 M2, D-268) - the rules of web/src/copyfind.ts (the app, M1) in plain
// JS, one module edit.js imports and web/test.mjs drives without a browser. Generated into the site beside
// edit.js by engine/build_pages.py; loaded only when edit mode is armed. Do not edit in place in _site.
//
// The build writes no stamp into a page: a reader's page is byte-for-byte what it was. When edit mode is armed,
// the catalog the page was built from is indexed - exact values by their text, templates as anchored patterns,
// the most literal first - and the DEEPEST element whose whole text is one value or one filled template gets
// data-copy-key (data-copy-keys when several keys share the words, data-copy-fill with a template's captured
// values). A catalog string that is one text node among siblings gets an unstyled wrapper span. Elements a
// render site stamped itself (data-copy) are left to that stamp. Corpus and authored prose is not in the
// catalog and is never stamped (D-268 point 2).
export const norm = (s) => s.replace(/\s+/g, " ").trim();
const ENTITY = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ", "&middot;": "\u00b7", "&rsquo;": "\u2019", "&lsquo;": "\u2018", "&ldquo;": "\u201c", "&rdquo;": "\u201d", "&ndash;": "\u2013", "&mdash;": "\u2014", "&hellip;": "\u2026", "&times;": "\u00d7", "&deg;": "\u00b0" };
export const asText = (v) => norm(v.replace(/<[^>]*>/g, "").replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, (m) => {
  if (m in ENTITY) return ENTITY[m];
  const hex = /^&#x([0-9a-f]+);$/i.exec(m); const dec = /^&#(\d+);$/.exec(m);
  return hex ? String.fromCodePoint(parseInt(hex[1], 16)) : dec ? String.fromCodePoint(parseInt(dec[1], 10)) : m;
}));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const PLACEHOLDER = /\{\w+\}/g;
// MAX_TEXT: the frost tool's source note is about 1,000 characters, one catalog string
const MIN_EXACT = 2, MIN_FRAG = 3, MAX_TEXT = 1500;
// a template that begins and ends with a placeholder and has two or more ("{a} and {b}", "{rest}, and {last}") is
// a JOINER: it joins whole pieces the page rendered (a source's name, a list's items), so the stamper accepts it
// only where each capture is a whole child node - or it would claim any prose with an "and" in it (a species
// note, a rule's mechanism), which is corpus text and never edit mode's. resolve() marks such a match `joiner`.
const isJoiner = (parts) => parts.length >= 3 && parts[0] === "" && parts[parts.length - 1] === "";
export function buildIndex(live) {
  const exact = new Map(); const tpls = [];
  for (const [key, raw] of Object.entries(live)) {
    if (typeof raw !== "string") continue;
    const v = asText(raw);
    PLACEHOLDER.lastIndex = 0;
    if (!PLACEHOLDER.test(v)) {
      if (v.length >= MIN_EXACT && /\p{L}/u.test(v)) { const had = exact.get(v); if (had) had.push(key); else exact.set(v, [key]); }
      continue;
    }
    PLACEHOLDER.lastIndex = 0;
    const parts = v.split(PLACEHOLDER);
    const frag = parts.reduce((a, b) => (b.trim().length > a.trim().length ? b : a), "").trim();
    if (frag.length < MIN_FRAG) continue;
    tpls.push({ key, frag, weight: parts.join("").length, joiner: isJoiner(parts), re: new RegExp("^" + parts.map(escapeRe).join("([\\s\\S]+?)") + "$") });
  }
  tpls.sort((a, b) => b.weight - a.weight);
  return { exact, tpls };
}
export function resolve(ix, text) {
  const t = norm(text);
  if (!t) return null;
  const ex = ix.exact.get(t);
  if (ex) return { keys: [...ex], fill: [] };
  if (t.length > MAX_TEXT) return null;
  let best = null, bestWeight = -1;
  for (const p of ix.tpls) {
    if (best && p.weight < bestWeight) break;
    if (!t.includes(p.frag)) continue;
    const m = p.re.exec(t);
    if (!m) continue;
    if (!best) { best = { keys: [p.key], fill: m.slice(1), joiner: p.joiner }; bestWeight = p.weight; } else best.keys.push(p.key);
  }
  return best;
}
export function fillTemplate(tpl, fill) { let i = 0; return tpl.replace(PLACEHOLDER, (m) => (i < fill.length ? fill[i++] : m)); }
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE", "CANVAS", "IFRAME"]);
const FORM_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
function mark(h, f) {
  h.dataset.copyFound = "1"; h.dataset.copyKey = f.keys[0];
  if (f.keys.length > 1) h.dataset.copyKeys = f.keys.join(" "); else delete h.dataset.copyKeys;
  if (f.fill.length) h.dataset.copyFill = JSON.stringify(f.fill); else delete h.dataset.copyFill;
}
function unmark(h) { delete h.dataset.copyFound; delete h.dataset.copyKey; delete h.dataset.copyKeys; delete h.dataset.copyFill; }
const isStructural = (h) => h.dataset.copy !== undefined || h.dataset.explainer !== undefined || h.dataset.guide !== undefined
  || (h.dataset.copyKey !== undefined && h.dataset.copyFound === undefined);
const isChrome = (h) => h.id === "sedpill" || h.id === "seddrawer";
export function stamp(ix, root) {
  let n = 0, hits = 0; // n: stamps made now; hits: n plus the render sites' own stamps met on the way
  const visit = (el) => {
    if (SKIP_TAGS.has(el.tagName)) return;
    const h = el;
    if (isChrome(h)) return;
    if (isStructural(h)) { hits++; return; }
    const text = FORM_TAGS.has(el.tagName) ? "" : norm(el.textContent || "");
    const kids = Array.from(el.children);
    if (h.dataset.copyFound !== undefined) {
      const f = text ? resolve(ix, text) : null;
      if (f) { mark(h, f); n++; hits++; return; }
      if (h.dataset.copyWrap !== undefined) { h.replaceWith(...Array.from(h.childNodes)); return; }
      unmark(h);
    }
    const inOneChild = text !== "" && kids.some((k) => norm(k.textContent || "") === text);
    if (text && text.length <= MAX_TEXT && !inOneChild) {
      let f = resolve(ix, text);
      if (f && f.joiner && !f.fill.every((c) => Array.from(el.childNodes).some((cn) => norm(cn.textContent || "") === c))) f = null;
      // an exact value is the element's whole text: stamped here, whatever is inside. A TEMPLATE over an element
      // with children is read children first: "{a} and {b}" matches a whole footer, a filter list, a card with
      // its sources, and the words inside are the strings. Only when nothing deeper is catalog text is the
      // container the string (a sentence whose {placeholder} the page filled with a link or a number).
      if (f && (!f.fill.length || !kids.length)) { mark(h, f); n++; hits++; return; }
      if (f) {
        const before = hits;
        for (const k of kids) if (k.dataset.copyWrap === undefined) visit(k);
        if (hits === before) { mark(h, f); n++; hits++; }
        return;
      }
    }
    if (text && el.childNodes.length > 1) {
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType !== Node.TEXT_NODE) continue;
        const ct = norm(c.nodeValue || "");
        if (!ct || ct.length > MAX_TEXT) continue;
        const f = resolve(ix, ct);
        if (!f) continue;
        const w = document.createElement("span"); w.dataset.copyWrap = "1";
        el.insertBefore(w, c); w.appendChild(c); mark(w, f); n++; hits++;
      }
    }
    for (const k of Array.from(el.children)) if (k.dataset.copyWrap === undefined) visit(k);
  };
  for (const k of Array.from(root.children)) visit(k);
  return n;
}
/** Take every found stamp off, and every wrapper with it: the text node goes back where it was. */
export function unstamp(root) {
  for (const h of Array.from(root.querySelectorAll("[data-copy-found]"))) {
    if (h.dataset.copyWrap !== undefined) h.replaceWith(...Array.from(h.childNodes));
    else unmark(h);
  }
}
