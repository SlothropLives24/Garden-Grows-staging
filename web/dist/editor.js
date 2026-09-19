import { applyCopy, copy } from "./copy.js";
import { currentRoute } from "./router.js";
import { app } from "./state.js";
import { canEdit, LICENCES, postFn, toWebp } from "./panels/content.js";
import { el } from "./dom.js";
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
    const live = copy;
    for (const [k, v] of originals)
        live[k] = v;
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
        live[k] = v;
    }
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
function openCopyDrawer(hit) {
    const key = hit.dataset.copy ?? hit.dataset.copyHtml ?? hit.dataset.copyKey ?? "";
    if (!key)
        return;
    const isHtml = hit.dataset.copyHtml !== undefined || key.endsWith("Html");
    const live = copy;
    if (!originals.has(key))
        originals.set(key, live[key] ?? "");
    const current = edits.get(key) ?? live[key] ?? "";
    const d = drawerShell(key, "page updates as you type");
    hit.classList.add("edit-hot");
    const area = el("textarea");
    area.rows = current.length > 90 ? 4 : 2;
    area.value = current;
    d.appendChild(area);
    if (key in pins)
        d.appendChild(el("p", "ed-pin", "Held by a check — proposing this edit opens a PR that stays red until a session moves its test."));
    const applyLive = (v) => {
        live[key] = v;
        for (const n of document.querySelectorAll(`[data-copy="${key}"]`))
            n.textContent = v;
        for (const n of document.querySelectorAll(`[data-copy-html="${key}"]`))
            n.innerHTML = v;
        for (const n of document.querySelectorAll(`[data-copy-key="${key}"]`))
            n.textContent = v;
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
        if (v === originals.get(key))
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
                if (im)
                    im.src = staged.previewUrl;
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
export function initEditor(bundle) {
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
    ensureEditEntry();
}
