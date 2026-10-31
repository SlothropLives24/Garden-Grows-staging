import { currentRoute, copy, withFacts, applyCopy, copyBoot } from './paint.js';
import { copyLate } from './chunk-l5cseoso.js';
import { app, el } from './core.js';

const LICENCES = ["CC0", "Public domain", "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0"];
function session() {
    try {
        const raw = localStorage.getItem("gg-sync-session");
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
async function config() {
    try {
        const res = await fetch("./backend.json");
        if (!res.ok)
            return null;
        const b = await res.json();
        return b.url && b.anonKey ? { url: b.url.replace(/\/+$/, ""), anonKey: b.anonKey } : null;
    }
    catch {
        return null;
    }
}
function toWebp(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("cannot read file"));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 800 / Math.max(img.width, img.height));
                const c = document.createElement("canvas");
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                const ctx = c.getContext("2d");
                if (!ctx) {
                    reject(new Error("no canvas"));
                    return;
                }
                ctx.drawImage(img, 0, 0, c.width, c.height);
                c.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("encode failed"));
                        return;
                    }
                    const out = new FileReader();
                    out.onload = () => {
                        const url = String(out.result);
                        resolve({ base64: url.split(",")[1] ?? "", previewUrl: url });
                    };
                    out.readAsDataURL(blob);
                }, "image/webp", 0.8);
            };
            img.onerror = () => reject(new Error("not an image"));
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}
async function postFn(payload) {
    const cfg = await config();
    const ses = session();
    if (!cfg || !ses)
        return null;
    try {
        const res = await fetch(`${cfg.url}/functions/v1/content-pr`, {
            method: "POST",
            headers: { "content-type": "application/json", "authorization": `Bearer ${ses.access_token}`, "apikey": cfg.anonKey },
            body: JSON.stringify(payload),
        });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    }
    catch {
        return null;
    }
}
function haveSession() { return session() !== null; }
const PROBE_KEY = "gg-canedit";
async function canEdit(fresh = false) {
    if (!haveSession())
        return false;
    try {
        if (fresh)
            sessionStorage.removeItem(PROBE_KEY);
        else {
            const c = sessionStorage.getItem(PROBE_KEY);
            if (c !== null)
                return c === "1";
        }
    }
    catch { }
    const r = await postFn({ mode: "whoami" });
    if (!r)
        return false;
    const ok = r.status === 200;
    try {
        sessionStorage.setItem(PROBE_KEY, ok ? "1" : "0");
    }
    catch { }
    return ok;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const ENTITY = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };
const asText = (v) => norm(v.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITY[m] ?? m));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PLACEHOLDER = /\{\w+\}/g;
const MIN_EXACT = 2;
const MIN_FRAG = 3;
function buildIndex(live) {
    const exact = new Map();
    const tpls = [];
    for (const [key, raw] of Object.entries(live)) {
        if (typeof raw !== "string")
            continue;
        const v = asText(raw);
        if (!PLACEHOLDER.test(v)) {
            PLACEHOLDER.lastIndex = 0;
            if (v.length >= MIN_EXACT && /\p{L}/u.test(v)) {
                const had = exact.get(v);
                if (had)
                    had.push(key);
                else
                    exact.set(v, [key]);
            }
            continue;
        }
        PLACEHOLDER.lastIndex = 0;
        const parts = v.split(PLACEHOLDER);
        const frag = parts.reduce((a, b) => (b.trim().length > a.trim().length ? b : a), "").trim();
        if (frag.length < MIN_FRAG)
            continue;
        tpls.push({ key, frag, weight: parts.join("").length,
            re: new RegExp("^" + parts.map(escapeRe).join("([\\s\\S]+?)") + "$") });
    }
    tpls.sort((a, b) => b.weight - a.weight);
    return { exact, tpls };
}
function resolve(ix, text) {
    const t = norm(text);
    if (!t)
        return null;
    const ex = ix.exact.get(t);
    if (ex)
        return { keys: [...ex], fill: [] };
    if (t.length > 800)
        return null;
    let best = null;
    let bestWeight = -1;
    for (const p of ix.tpls) {
        if (best && p.weight < bestWeight)
            break;
        if (!t.includes(p.frag))
            continue;
        const m = p.re.exec(t);
        if (!m)
            continue;
        if (!best) {
            best = { keys: [p.key], fill: m.slice(1) };
            bestWeight = p.weight;
        }
        else
            best.keys.push(p.key);
    }
    return best;
}
function fillTemplate(tpl, fill) {
    let i = 0;
    return tpl.replace(PLACEHOLDER, (m) => (i < fill.length ? fill[i++] : m));
}
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "CANVAS", "IFRAME", "MATH"]);
const FORM_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const MAX_TEXT = 800;
const FOUND = "copyFound";
const WRAP = "copyWrap";
function mark(h, f) {
    h.dataset[FOUND] = "1";
    h.dataset.copyKey = f.keys[0];
    if (f.keys.length > 1)
        h.dataset.copyKeys = f.keys.join(" ");
    else
        delete h.dataset.copyKeys;
    if (f.fill.length)
        h.dataset.copyFill = JSON.stringify(f.fill);
    else
        delete h.dataset.copyFill;
}
function unmark(h) {
    delete h.dataset[FOUND];
    delete h.dataset.copyKey;
    delete h.dataset.copyKeys;
    delete h.dataset.copyFill;
}
function attrKeys(h) {
    return (h.dataset.copyAttr ?? "").split(";").map((p) => p.split(":")[1] ?? "").filter(Boolean);
}
const isStructural = (h) => h.dataset.copy !== undefined || h.dataset.copyHtml !== undefined || h.dataset.spotPhoto !== undefined
    || (h.dataset.copyKey !== undefined && h.dataset[FOUND] === undefined);
function stamp(ix, root, skip) {
    let n = 0;
    const visit = (el) => {
        if (el instanceof SVGElement || SKIP_TAGS.has(el.tagName))
            return;
        const h = el;
        if (skip(h) || isStructural(h))
            return;
        const text = FORM_TAGS.has(el.tagName) ? "" : norm(el.textContent ?? "");
        const kids = Array.from(el.children);
        if (h.dataset[FOUND] !== undefined) {
            const f = text ? resolve(ix, text) : null;
            if (f) {
                mark(h, f);
                n++;
                return;
            }
            if (h.dataset[WRAP] !== undefined) {
                h.replaceWith(...Array.from(h.childNodes));
                return;
            }
            unmark(h);
        }
        const inOneChild = text !== "" && kids.some((k) => norm(k.textContent ?? "") === text);
        if (text && text.length <= MAX_TEXT && !inOneChild) {
            const f = resolve(ix, text);
            if (f) {
                mark(h, f);
                n++;
                return;
            }
        }
        const ak = attrKeys(h);
        if (ak.length && !text) {
            mark(h, { keys: ak, fill: [] });
            n++;
            return;
        }
        if (text && el.childNodes.length > 1) {
            for (const c of Array.from(el.childNodes)) {
                if (c.nodeType !== Node.TEXT_NODE)
                    continue;
                const ct = norm(c.nodeValue ?? "");
                if (!ct || ct.length > MAX_TEXT)
                    continue;
                const f = resolve(ix, ct);
                if (!f)
                    continue;
                const w = document.createElement("span");
                w.dataset[WRAP] = "1";
                el.insertBefore(w, c);
                w.appendChild(c);
                mark(w, f);
                n++;
            }
        }
        for (const k of Array.from(el.children))
            if (k.dataset[WRAP] === undefined)
                visit(k);
    };
    for (const k of Array.from(root.children))
        visit(k);
    return n;
}
function unstamp(root) {
    for (const h of Array.from(root.querySelectorAll(`[data-copy-found]`))) {
        if (h.dataset[WRAP] !== undefined)
            h.replaceWith(...Array.from(h.childNodes));
        else
            unmark(h);
    }
}

const EDIT_SEL = "[data-copy], [data-copy-html], [data-copy-key], [data-spot-photo]";
const DEVICE_KEY = "gg-editor";
let active = false;
let bundleRef = null;
let pins = {};
const edits = new Map();
const siteEdits = new Map();
const explainerEdits = new Map();
const photoEdits = new Map();
const originals = new Map();
const domOriginals = new Map();
let index = null;
let indexedKeys = -1;
let indexedVersion = -1;
let liveVersion = 0;
let observer = null;
let stampTimer = 0;
const isChrome = (h) => h.id === "editpill" || h.id === "editdrawer";
function stampAll() {
    if (!active)
        return;
    const live = copy;
    const n = Object.keys(live).length;
    if (!index || indexedKeys !== n || indexedVersion !== liveVersion) {
        index = buildIndex(live);
        indexedKeys = n;
        indexedVersion = liveVersion;
    }
    stamp(index, document.body, isChrome);
}
function scheduleStamp() {
    if (stampTimer)
        return;
    stampTimer = window.setTimeout(() => { stampTimer = 0; stampAll(); }, 120);
}
function startFinding() {
    stampAll();
    observer?.disconnect();
    observer = new MutationObserver(scheduleStamp);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
function stopFinding() {
    observer?.disconnect();
    observer = null;
    if (stampTimer) {
        clearTimeout(stampTimer);
        stampTimer = 0;
    }
    unstamp(document);
    for (const [h, html] of domOriginals)
        h.innerHTML = html;
    domOriginals.clear();
    index = null;
}
function basketSize() {
    return edits.size + siteEdits.size + explainerEdits.size + photoEdits.size;
}
async function enterEdit(bundle, status) {
    if (active)
        return true;
    bundleRef = bundle;
    const r = await postFn({ mode: "copy-read", copyFile: "app" });
    if (!r) {
        status?.("Editing needs the backend and a signed-in session.");
        return false;
    }
    if (r.status === 403) {
        status?.("This account is not the maintainer — editing is maintainer-only.");
        return false;
    }
    if (!r.body.copy) {
        status?.(`Could not start editing: ${r.body.error ?? r.status}`);
        return false;
    }
    pins = r.body.pins ?? {};
    try {
        localStorage.setItem(DEVICE_KEY, "1");
    }
    catch { }
    active = true;
    document.body.classList.add("editing");
    document.addEventListener("click", interceptTap, true);
    renderPill();
    reapplyBasket();
    startFinding();
    return true;
}
function exitEdit() {
    if (!active)
        return;
    active = false;
    closeDrawer();
    document.body.classList.remove("editing");
    document.removeEventListener("click", interceptTap, true);
    document.getElementById("editpill")?.remove();
    stopFinding();
    const live = copy;
    for (const [k, v] of originals)
        live[k] = v;
    liveVersion++;
    applyCopy(document);
    setViewAs(null);
}
function reapplyBasket() {
    if (!active)
        return;
    const live = copy;
    for (const [k, v] of edits) {
        if (!originals.has(k))
            originals.set(k, live[k]);
        live[k] = withFacts(v);
    }
    liveVersion++;
    applyCopy(document);
}
function setViewAs(mode) {
    if (app.viewAs === mode)
        return;
    app.viewAs = mode;
    app.homeRefresh?.();
}
function renderPill() {
    document.getElementById("editpill")?.remove();
    if (!active)
        return;
    const pill = el("div");
    pill.id = "editpill";
    const count = el("button", "ep-count", basketSize() === 1 ? "1 change" : `${basketSize()} changes`);
    count.type = "button";
    count.addEventListener("click", () => openBasketDrawer());
    const pages = el("button", "ep-btn", "Pages");
    pages.type = "button";
    pages.addEventListener("click", () => openPagesDrawer());
    const viewas = el("button", "ep-btn", "View as");
    viewas.type = "button";
    viewas.addEventListener("click", () => openViewAsDrawer());
    const done = el("button", "ep-btn", "Done");
    done.type = "button";
    done.addEventListener("click", () => exitEdit());
    pill.append(el("span", "ep-label", "Editing"), count, pages, viewas, done);
    document.body.appendChild(pill);
}
function interceptTap(e) {
    if (!active)
        return;
    const t = e.target;
    if (!t)
        return;
    if (t.closest("#editdrawer") || t.closest("#editpill"))
        return;
    const hit = t.closest(EDIT_SEL);
    if (!hit)
        return;
    e.preventDefault();
    e.stopPropagation();
    if (hit.dataset.spotPhoto)
        openPhotoDrawer(hit.dataset.spotPhoto, hit);
    else
        openCopyDrawer(hit);
}
function closeDrawer() { document.getElementById("editdrawer")?.remove(); }
function drawerShell(title, note) {
    closeDrawer();
    const d = el("div");
    d.id = "editdrawer";
    d.appendChild(el("div", "ed-grip"));
    const head = el("p", "ed-k", title);
    if (note)
        head.appendChild(el("span", "ed-note", note));
    d.appendChild(head);
    document.body.appendChild(d);
    return d;
}
function keysOf(hit) {
    const out = [];
    const add = (k) => { if (k && !out.includes(k))
        out.push(k); };
    add(hit.dataset.copy);
    add(hit.dataset.copyHtml);
    add(hit.dataset.copyKey);
    for (const k of (hit.dataset.copyKeys ?? "").split(" "))
        add(k);
    for (const k of attrKeys(hit))
        add(k);
    return out;
}
function openCopyDrawer(hit, chosen) {
    const keys = keysOf(hit);
    const key = chosen ?? keys[0] ?? "";
    if (!key)
        return;
    if (hit.dataset.copyFound !== undefined && keys.includes(key))
        hit.dataset.copyKey = key;
    const isHtml = hit.dataset.copyHtml !== undefined || key.endsWith("Html");
    const live = copy;
    if (!originals.has(key))
        originals.set(key, live[key] ?? "");
    const template = copyBoot[key] ?? copyLate[key] ?? "";
    const current = edits.get(key) ?? template;
    const d = drawerShell(key, "page updates as you type");
    hit.classList.add("edit-hot");
    const area = el("textarea");
    area.rows = current.length > 90 ? 4 : 2;
    area.value = current;
    d.appendChild(area);
    if (key in pins)
        d.appendChild(el("p", "ed-pin", "Held by a check — proposing this edit opens a PR that stays red until a session moves its test."));
    if (keys.length > 1) {
        const alt = el("div", "ed-row ed-alts");
        alt.style.flexWrap = "wrap";
        alt.appendChild(el("span", "ed-note2", "These words are also:"));
        for (const k of keys) {
            if (k === key)
                continue;
            const b = el("button", "ed-btn ghost", k);
            b.type = "button";
            b.addEventListener("click", () => { hit.classList.remove("edit-hot"); openCopyDrawer(hit, k); });
            alt.appendChild(b);
        }
        d.appendChild(alt);
    }
    d.appendChild(el("p", "ed-note2", "This is the English. Spanish readers see your new English here until it is translated again."));
    const applyLive = (raw) => {
        const v = withFacts(raw);
        live[key] = v;
        liveVersion++;
        for (const n of document.querySelectorAll(`[data-copy="${key}"]`))
            n.textContent = v;
        for (const n of document.querySelectorAll(`[data-copy-html="${key}"]`))
            n.innerHTML = v;
        for (const n of document.querySelectorAll(`[data-copy-key="${key}"]`)) {
            if (!domOriginals.has(n))
                domOriginals.set(n, n.innerHTML);
            const fill = n.dataset.copyFill ? JSON.parse(n.dataset.copyFill) : [];
            const shown = fill.length ? fillTemplate(v, fill) : v;
            if (isHtml)
                n.innerHTML = shown;
            else
                n.textContent = shown;
        }
        for (const n of document.querySelectorAll("[data-copy-attr]")) {
            for (const pair of (n.dataset.copyAttr ?? "").split(";")) {
                const [attr, k] = pair.split(":");
                if (attr && k === key)
                    n.setAttribute(attr, v);
            }
        }
    };
    area.addEventListener("input", () => applyLive(area.value));
    const row = el("div", "ed-row");
    const revert = el("button", "ed-btn ghost", "Revert");
    revert.type = "button";
    revert.addEventListener("click", () => {
        applyLive(originals.get(key) ?? "");
        edits.delete(key);
        renderPill();
        closeDrawer();
        hit.classList.remove("edit-hot");
    });
    const keep = el("button", "ed-btn", "Keep in changes");
    keep.type = "button";
    keep.addEventListener("click", () => {
        const v = area.value;
        if (!v.trim())
            return;
        if (isHtml)
            applyLive(v);
        if (v === template)
            edits.delete(key);
        else
            edits.set(key, v);
        renderPill();
        closeDrawer();
        hit.classList.remove("edit-hot");
    });
    row.append(revert, keep);
    d.appendChild(row);
    area.focus();
}
function openPhotoDrawer(speciesId, hit) {
    const rec = bundleRef?.species.find((s) => s.id === speciesId);
    const img = rec?.image ?? {};
    const prior = photoEdits.get(speciesId);
    const d = drawerShell(`photo: ${speciesId}`);
    hit.classList.add("edit-hot");
    let staged = prior?.webpBase64 && prior.previewUrl
        ? { base64: prior.webpBase64, previewUrl: prior.previewUrl } : null;
    const file = el("input");
    file.type = "file";
    file.accept = "image/*";
    file.className = "ed-file";
    const fileNote = el("p", "ed-note2", staged ? "New image staged." : "Pick a file to replace the photo.");
    file.addEventListener("change", () => {
        void (async () => {
            const f = file.files?.[0];
            if (!f)
                return;
            fileNote.textContent = "Preparing image…";
            try {
                staged = await toWebp(f);
                const im = hit instanceof HTMLImageElement ? hit : hit.querySelector("img");
                if (im) {
                    im.removeAttribute("srcset");
                    im.src = staged.previewUrl;
                }
                fileNote.textContent = `New image ready (${Math.round(staged.base64.length * 0.75 / 1024)} KB).`;
            }
            catch {
                fileNote.textContent = "That file is not an image.";
            }
        })();
    });
    const mkField = (label, value) => {
        const w = el("div", "ed-field");
        w.appendChild(el("label", undefined, label));
        const inp = el("input");
        inp.type = "text";
        inp.value = value;
        w.appendChild(inp);
        d.appendChild(w);
        return inp;
    };
    d.append(file, fileNote);
    const alt = mkField("Alt text", prior?.alt ?? img.alt ?? "");
    const artist = mkField("Credit — photographer", prior?.artist ?? img.artist ?? "");
    const licWrap = el("div", "ed-field");
    licWrap.appendChild(el("label", undefined, "Licence"));
    const lic = el("select");
    for (const l of LICENCES) {
        const o = el("option", undefined, l);
        o.value = l;
        if (l === (prior?.licence ?? img.licence))
            o.selected = true;
        lic.appendChild(o);
    }
    licWrap.appendChild(lic);
    d.appendChild(licWrap);
    const source = mkField("Source URL (Commons file page)", prior?.source ?? img.url ?? "");
    const licUrl = mkField("Licence URL (optional)", prior?.licenceUrl ?? img.licence_url ?? "");
    const capt = mkField("Caption (optional)", prior?.caption ?? img.caption ?? "");
    const row = el("div", "ed-row");
    const cancel = el("button", "ed-btn ghost", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => { closeDrawer(); hit.classList.remove("edit-hot"); });
    const keep = el("button", "ed-btn", "Keep in changes");
    keep.type = "button";
    keep.addEventListener("click", () => {
        if (!staged) {
            fileNote.textContent = "Pick a replacement image first — the other fields ride with it.";
            return;
        }
        photoEdits.set(speciesId, {
            speciesId, webpBase64: staged.base64, previewUrl: staged.previewUrl,
            alt: alt.value.trim(), artist: artist.value.trim(), licence: lic.value,
            source: source.value.trim(), licenceUrl: licUrl.value.trim() || undefined,
            caption: capt.value.trim() || undefined,
        });
        renderPill();
        closeDrawer();
        hit.classList.remove("edit-hot");
    });
    row.append(cancel, keep);
    d.appendChild(row);
}
function openExplainerDrawer(slug, title) {
    const d = drawerShell(`explainer: ${title}`);
    const area = el("textarea");
    area.rows = 12;
    area.value = "Loading…";
    area.disabled = true;
    d.appendChild(area);
    const row = el("div", "ed-row");
    const cancel = el("button", "ed-btn ghost", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => closeDrawer());
    const keep = el("button", "ed-btn", "Keep in changes");
    keep.type = "button";
    keep.disabled = true;
    keep.addEventListener("click", () => {
        if (area.value.trim())
            explainerEdits.set(slug, area.value);
        renderPill();
        closeDrawer();
    });
    row.append(cancel, keep);
    d.appendChild(row);
    void (async () => {
        const prior = explainerEdits.get(slug);
        if (prior !== undefined) {
            area.value = prior;
            area.disabled = false;
            keep.disabled = false;
            return;
        }
        const r = await postFn({ mode: "explainer-read", slug });
        if (r && typeof r.body.markdown === "string") {
            area.value = r.body.markdown;
            area.disabled = false;
            keep.disabled = false;
        }
        else
            area.value = r ? `Could not load: ${r.body.error ?? r.status}` : "Network error.";
    })();
}
function openSiteCopyDrawer() {
    const d = drawerShell("Site framing strings", "rendered on the plant/guild pages");
    const list = el("div", "ed-list");
    d.appendChild(list);
    const row = el("div", "ed-row");
    const back = el("button", "ed-btn ghost", "Close");
    back.type = "button";
    back.addEventListener("click", () => closeDrawer());
    row.append(back);
    d.appendChild(row);
    void (async () => {
        const r = await postFn({ mode: "copy-read", copyFile: "site" });
        const cur = r?.body.copy ?? null;
        if (!cur) {
            list.appendChild(el("p", "ed-note2", "Could not load the site strings."));
            return;
        }
        const sitePins = r?.body.pins ?? {};
        for (const [k, v] of Object.entries(cur)) {
            const item = el("div", "ed-field");
            item.appendChild(el("label", undefined, k.replace(/_/g, " ")));
            const inp = el("input");
            inp.type = "text";
            inp.value = siteEdits.get(k) ?? v;
            inp.addEventListener("change", () => {
                if (inp.value.trim() && inp.value !== v)
                    siteEdits.set(k, inp.value);
                else
                    siteEdits.delete(k);
                renderPill();
            });
            item.appendChild(inp);
            if (k in sitePins)
                item.appendChild(el("p", "ed-pin", "Held by a check — this edit will need a session."));
            list.appendChild(item);
        }
    })();
}
function openPagesDrawer() {
    const d = drawerShell("Pages");
    const go = (hash, viewAs = null) => {
        setViewAs(viewAs);
        location.hash = hash;
        closeDrawer();
    };
    const row = (label, sub, run) => {
        const b = el("button", "ed-page");
        b.type = "button";
        b.appendChild(el("span", undefined, label));
        if (sub)
            b.appendChild(el("small", undefined, sub));
        b.addEventListener("click", run);
        d.appendChild(b);
    };
    d.appendChild(el("p", "ed-h", "The app"));
    row("Landing", "as a stranger - the doors", () => go("#/start", "stranger"));
    row("Landing", "as a returning gardener", () => go("#/start"));
    row("Answers", null, () => go("#/answers"));
    row("Plan", null, () => go("#/plan"));
    row("Calendar", null, () => go("#/calendar"));
    row("Log", null, () => go("#/log"));
    row("Evidence", null, () => go("#/why"));
    row("Account", null, () => go("#/account"));
    d.appendChild(el("p", "ed-h", "The site"));
    row("Site framing strings", "header/footer + page framing", () => openSiteCopyDrawer());
    const expHost = el("div");
    d.appendChild(expHost);
    const nSpecies = bundleRef?.species.length ?? 0;
    const nGuilds = bundleRef?.guilds?.length ?? 0;
    row(`Plant pages (${nSpecies}) · Guild pages (${nGuilds})`, "opens the site with editing on (O55b)", () => { window.open("../plants/#edit", "_blank", "noopener"); });
    const close = el("div", "ed-row");
    const back = el("button", "ed-btn ghost", "Close");
    back.type = "button";
    back.addEventListener("click", () => closeDrawer());
    close.append(back);
    d.appendChild(close);
    void (async () => {
        const r = await postFn({ mode: "explainer-list" });
        const list = Array.isArray(r?.body.explainers) ? r?.body.explainers : [];
        for (const e2 of list) {
            const b = el("button", "ed-page sub");
            b.type = "button";
            b.appendChild(el("span", undefined, e2.title));
            b.appendChild(el("small", undefined, "explainer"));
            b.addEventListener("click", () => openExplainerDrawer(e2.slug, e2.title));
            expHost.appendChild(b);
        }
    })();
}
function openViewAsDrawer() {
    const d = drawerShell("Viewing as");
    const opts = el("div", "ed-viewas");
    const option = (label, on, run) => {
        const b = el("button", on ? "on" : "");
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", () => { run(); closeDrawer(); });
        opts.appendChild(b);
    };
    option("Stranger", app.viewAs === "stranger", () => { setViewAs("stranger"); location.hash = "#/start"; });
    option("Returning gardener", app.viewAs == null, () => { setViewAs(null); location.hash = "#/start"; });
    d.appendChild(opts);
    d.appendChild(el("p", "ed-note2", "Renders this device's pages for that audience - your data and session are untouched. The " +
        "example garden keeps its own door: \"See an example garden\" on the stranger landing."));
    const row = el("div", "ed-row");
    const back = el("button", "ed-btn ghost", "Close");
    back.type = "button";
    back.addEventListener("click", () => closeDrawer());
    row.append(back);
    d.appendChild(row);
}
function openBasketDrawer() {
    const d = drawerShell(basketSize() === 1 ? "1 change" : `${basketSize()} changes`);
    const list = el("div", "ed-list");
    d.appendChild(list);
    const rerender = () => { renderPill(); closeDrawer(); if (basketSize())
        openBasketDrawer(); };
    const item = (label, sub, remove) => {
        const rowEl = el("div", "ed-basket");
        const left = el("span");
        left.appendChild(el("span", "k", label));
        left.appendChild(document.createElement("br"));
        left.appendChild(el("small", undefined, sub));
        const x = el("button", "x", "×");
        x.type = "button";
        x.addEventListener("click", () => { remove(); rerender(); });
        rowEl.append(left, x);
        list.appendChild(rowEl);
    };
    const live = copy;
    for (const [k, v] of edits)
        item(k, `"${v.slice(0, 44)}${v.length > 44 ? "…" : ""}"`, () => {
            live[k] = originals.get(k) ?? live[k];
            applyCopy(document);
            edits.delete(k);
        });
    for (const [k, v] of siteEdits)
        item(`site: ${k}`, `"${v.slice(0, 44)}"`, () => siteEdits.delete(k));
    for (const [slug] of explainerEdits)
        item(`explainer: ${slug}`, "edited text", () => explainerEdits.delete(slug));
    for (const [id] of photoEdits)
        item(`photo: ${id}`, "new photo + credit", () => photoEdits.delete(id));
    if (!basketSize())
        list.appendChild(el("p", "ed-note2", "Nothing kept yet - tap any outlined element to edit it."));
    const status = el("p", "ed-status");
    const row = el("div", "ed-row");
    const back = el("button", "ed-btn ghost", "Keep editing");
    back.type = "button";
    back.addEventListener("click", () => closeDrawer());
    const propose = el("button", "ed-btn", "Propose all as one PR");
    propose.type = "button";
    propose.disabled = basketSize() === 0;
    propose.addEventListener("click", () => {
        void (async () => {
            propose.disabled = true;
            status.textContent = "Opening a pull request…";
            const r = await postFn({
                mode: "changeset",
                appCopy: Object.fromEntries(edits),
                siteCopy: Object.fromEntries(siteEdits),
                explainers: Object.fromEntries(explainerEdits),
                photos: [...photoEdits.values()].map(({ previewUrl: _p, ...ph }) => ph),
            });
            renderResult(r, status);
            if (r?.body.prUrl) {
                edits.clear();
                siteEdits.clear();
                explainerEdits.clear();
                photoEdits.clear();
                renderPill();
            }
            else
                propose.disabled = false;
        })();
    });
    row.append(back, propose);
    d.append(status, row);
}
function renderResult(r, status) {
    status.replaceChildren();
    if (r?.body.prUrl) {
        status.append("Pull request opened — nothing is live until you merge it. ");
        const a = el("a", "ed-prlink", "Review the PR");
        a.href = r.body.prUrl;
        a.target = "_blank";
        a.rel = "noreferrer";
        status.appendChild(a);
    }
    else if (r?.status === 403) {
        status.textContent = "This account is not the maintainer — the server refused the write.";
    }
    else {
        status.textContent = r ? `Could not open the PR: ${r.body.error ?? r.status}` : "Network error.";
    }
}
function initEditor(bundle) {
    bundleRef = bundle;
    const fromHash = () => {
        if (!location.hash.startsWith("#/content"))
            return;
        location.hash = "#/start";
        void enterEdit(bundle, (m) => { try {
            alert(m);
        }
        catch { } });
    };
    const ensureEditEntry = (fresh = false) => {
        if (fresh) {
            try {
                sessionStorage.removeItem("gg-canedit");
            }
            catch { }
        }
        if (currentRoute() !== "account")
            return;
        void (async () => {
            const ok = await canEdit();
            const cur = document.getElementById("editenter");
            if (!ok) {
                cur?.remove();
                return;
            }
            if (cur)
                return;
            const host = document.getElementById("page-account");
            if (!host)
                return;
            const b = el("button", "ed-enter", "Edit this site");
            b.id = "editenter";
            b.type = "button";
            b.addEventListener("click", () => { void enterEdit(bundle, (m) => { try {
                alert(m);
            }
            catch { } }); });
            host.appendChild(b);
        })();
    };
    app.refreshEditEntry = ensureEditEntry;
    window.addEventListener("hashchange", () => {
        fromHash();
        ensureEditEntry();
        if (active) {
            closeDrawer();
            reapplyBasket();
        }
    });
    fromHash();
    ensureEditEntry(true);
}

export { initEditor };
