// The inline editor (O55, maintainer direction 2026-08-06). ONE edit mode over the whole app:
// a persistent pill (change count · Pages · View as · Done), every editable element outlined,
// tap → a bottom drawer that updates the page AS YOU TYPE (typing is the preview; this device
// only, restored on exit), "Keep in changes" collects edits into a basket, and the basket leaves
// as ONE pull request per editing session — the fix for "updates are spread out".
//
// This supersedes O54's spot mode (jump-to-editor was ruled before use and revised after). What
// survives unchanged underneath: nothing ever goes live from here (PR-only, via the content-pr
// Edge Function's changeset mode), the derived held-by-a-check pin labels, and the maintainer-only
// SERVER gate — everything in this file is reachable by anyone and simply refused (403) on entry.
//
// Addressing is structural, which is the new-content guarantee: anything rendered with
// data-copy / data-copy-html (static placeholders), data-copy-key (JS render sites), or
// data-spot-photo (the plant card's photo) is editable with zero registration. A page added
// tomorrow is editable the day it uses the mechanism.
//
// VIEW AS (stranger / returning / example): the editor's subject is the site, so the editor must
// never be hostage to the editor's own account state — the signed-in maintainer can render the
// stranger's landing (the doors) without touching their data. home.ts consults app.viewAs.
import { applyCopy, copy } from "./copy.js";
import { currentRoute } from "./router.js";
import { app } from "./state.js";
import { canEdit, LICENCES, postFn, toWebp } from "./panels/content.js";
const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text !== undefined)
        n.textContent = text;
    return n;
};
const EDIT_SEL = "[data-copy], [data-copy-html], [data-copy-key], [data-spot-photo]";
const DEVICE_KEY = "gg-editor"; // "this device has been the maintainer once" - shows entry chrome
let active = false;
let bundleRef = null;
let pins = {};
// the basket - survives navigation and Done/re-enter within a page life; cleared by a proposed PR
const edits = new Map(); // app copy key -> new value
const siteEdits = new Map(); // site framing key -> new value
const explainerEdits = new Map(); // slug -> markdown
const photoEdits = new Map(); // speciesId -> photo
// first-seen originals, so Done can restore the true words on this device
const originals = new Map();
export function editActive() { return active; }
function basketSize() {
    return edits.size + siteEdits.size + explainerEdits.size + photoEdits.size;
}
// ---- entry / exit ------------------------------------------------------------------------------
/** Turn edit mode on. The copy-read doubles as the auth probe: a 403 refuses out loud and arms
 *  nothing; success stores the pin registry and remembers the device. */
export async function enterEdit(bundle, status) {
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
    catch { /* private mode */ }
    active = true;
    document.body.classList.add("editing");
    document.addEventListener("click", interceptTap, true);
    renderPill();
    reapplyBasket();
    return true;
}
export function exitEdit() {
    if (!active)
        return;
    active = false;
    closeDrawer();
    document.body.classList.remove("editing");
    document.removeEventListener("click", interceptTap, true);
    document.getElementById("editpill")?.remove();
    // restore this device's true words (the basket is kept for re-entry; only the DISPLAY reverts)
    const live = copy;
    for (const [k, v] of originals)
        live[k] = v;
    applyCopy(document);
    setViewAs(null);
}
/** Live-apply the basket's copy edits after entry or a page redraw, so what you kept stays visible
 *  while you edit elsewhere. Called on entry and on hash changes while editing. */
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
// ---- view as -----------------------------------------------------------------------------------
export function setViewAs(mode) {
    if (app.viewAs === mode)
        return;
    app.viewAs = mode;
    app.homeRefresh?.();
}
// ---- the pill ----------------------------------------------------------------------------------
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
// ---- tap interception --------------------------------------------------------------------------
function interceptTap(e) {
    if (!active)
        return;
    const t = e.target;
    if (!t)
        return;
    if (t.closest("#editdrawer") || t.closest("#editpill"))
        return; // the chrome itself works normally
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
// ---- drawers -----------------------------------------------------------------------------------
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
/** The copy drawer: typing IS the preview - every element carrying this key updates live. */
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
            return; // an emptied string is a revert, not an edit
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
/** The photo drawer: the same fields (and the same licence gate) the Photos tab had, in place. */
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
                // the stamp rides the <img> itself on the thumb surfaces (landing, Answers, Log chips)
                // and a wrapping <figure> on the plant card - preview into whichever this is
                const im = hit instanceof HTMLImageElement ? hit : hit.querySelector("img");
                if (im)
                    im.src = staged.previewUrl; // the live preview, in place
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
/** The explainer drawer, reached from Pages - the same markdown, a bigger textarea. */
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
/** Site framing strings (the generated pages' sc() keys) - not renderable in the app, so they are
 *  edited from a list until phase 2 puts the editor on the pages themselves. */
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
// ---- Pages (the sitemap) -----------------------------------------------------------------------
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
    row("Why", null, () => go("#/why"));
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
    // explainers arrive async, listed by title, each opening its drawer - this is where explainer
    // editing lives now that the Content page is gone
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
// ---- View as -----------------------------------------------------------------------------------
function openViewAsDrawer() {
    const d = drawerShell("Viewing as");
    const opts = el("div", "ed-viewas");
    const mk = (label, on, run) => {
        const b = el("button", on ? "on" : "");
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", () => { run(); closeDrawer(); });
        opts.appendChild(b);
    };
    mk("Stranger", app.viewAs === "stranger", () => { setViewAs("stranger"); location.hash = "#/start"; });
    mk("Returning gardener", app.viewAs == null, () => { setViewAs(null); location.hash = "#/start"; });
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
// ---- the basket --------------------------------------------------------------------------------
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
// ---- boot wiring -------------------------------------------------------------------------------
/** Called once from app.ts. Handles the #/content bookmark (edit mode on, land on the landing),
 *  keeps the pill across hash navigation, and offers the Account-page entry on a remembered
 *  maintainer device. */
export function initEditor(bundle) {
    bundleRef = bundle;
    const fromHash = () => {
        if (!location.hash.startsWith("#/content"))
            return;
        location.hash = "#/start";
        void enterEdit(bundle, (m) => { try {
            alert(m);
        }
        catch { /* headless */ } });
    };
    // THE ACCOUNT-PAGE ENTRY FOLLOWS THE ACCOUNT, NOT THE DEVICE (maintainer, 2026-08-07): the
    // maintainer sees "Edit this site" on any signed-in device; an account without the permission
    // never sees it. The server's whoami probe decides (its 403 is what hides the button - nothing
    // client-side to spoof, and showing it would grant nothing anyway). Probed lazily, ONLY on the
    // Account page, cached per tab session; an auth change re-asks (account.ts passes fresh=true).
    const ensureEditEntry = (fresh = false) => {
        if (fresh) {
            try {
                sessionStorage.removeItem("gg-canedit");
            }
            catch { /* fine */ }
        }
        if (currentRoute() !== "account")
            return; // never probe from pages the button is not on
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
            catch { /* headless */ } }); });
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
