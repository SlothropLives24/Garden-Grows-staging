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
            img.src = String(reader.result);
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
function haveSession() { return session() !== null; }
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
