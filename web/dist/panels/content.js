// The content-editing SHARED LAYER (O55). This file used to be the Content page - a tabbed screen
// at #/content (Photos / Explainers / Site copy / App copy). The maintainer, after using it, ruled
// the page dead: editing now happens INLINE (web/src/editor.ts), on the page where the content
// lives. What remains here is the plumbing both eras share: the Supabase session + backend config,
// the one function-calling door (postFn), the browser-side WebP downscaler, and the licence list
// E-IMG accepts. The #/content route survives as a bookmark that switches edit mode on.
//
// Security is unchanged and entirely server-side: the content-pr Edge Function verifies the caller
// is the maintainer on every call; everything client-side is reachable by URL and simply refused.
// The licences E-IMG (and the function) accept. A fixed list, so an un-shippable one cannot be typed.
export const LICENCES = ["CC0", "Public domain", "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
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
// Downscale a picked file to a WebP at the pipeline's budget (longest edge 800), in the browser,
// and return base64 (no data: prefix). The same ~80 KB shape the sourcing script produces.
//
// CSP: `img-src` allows `data:` (and `blob:` since D-171's photo feature — this comment predated
// that and wrongly said blob: was absent; corrected 2026-08-22). This editor uses a DATA url anyway,
// not a blob: — the picked file is read to base64 because that is the exact shape the content-PR
// function needs to commit; the Image just loads the same data: string. So the editor needs no CSP
// change regardless.
export function toWebp(file) {
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
            img.src = String(reader.result); // a data: URL — CSP-allowed
        };
        reader.readAsDataURL(file);
    });
}
export async function postFn(payload) {
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
export function haveSession() { return session() !== null; }
// May the SIGNED-IN ACCOUNT edit? The server's whoami probe answers (the 403 is the answer for
// everyone else), so the edit entry follows the account rather than the device — the maintainer
// sees it on any signed-in device; no one else ever does, and there is nothing client-side to
// spoof because showing the button grants nothing (every write is still gated per call). Cached
// per tab session; an auth change clears the cache (editor.ts passes fresh) and the caller only
// probes from the Account page, so ordinary signed-in users cost one 403 at most, and only there.
const PROBE_KEY = "gg-canedit";
export async function canEdit(fresh = false) {
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
    catch { /* private mode - probe every time */ }
    const r = await postFn({ mode: "whoami" });
    if (!r)
        return false; // network/backend absence is not an answer - do not cache it
    const ok = r.status === 200;
    try {
        sessionStorage.setItem(PROBE_KEY, ok ? "1" : "0");
    }
    catch { /* fine */ }
    return ok;
}
