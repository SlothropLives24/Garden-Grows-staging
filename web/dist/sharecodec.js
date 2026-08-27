// The share-link codec (O7 / D-164): the plan travels IN the URL fragment - compressed with the
// browser's own CompressionStream, base64url-encoded, decoded by the same app that wrote it. No
// server, no stored row; a fragment is never sent to any host, so nothing here can leak in transit.
//
// PRIVACY IS STRUCTURAL, NOT OPTIONAL (approved call 2): SharePayload has NO FIELD for the plot
// anchor (the gardener's home coordinates), the street address, notes, failures, harvest amounts,
// prior seasons, or anything account-shaped. buildSharePayload cannot leak what the type cannot
// carry - do not add such a field without a new decision.
//
// INTERIM SHAPE (D-165): electronic-only sharing carries the load until email/true reminders come
// online with monetization. Codec, view (shareview.ts) and delivery (the share sheet in app.ts)
// are deliberately separable so any can be swapped when a server-backed share earns its cost. The
// payload carries `v` from day one so a future app can still read every old link.
//
// Pure module - no DOM, no app state - so web/test.mjs can round-trip it in Node.
/** Snapshot what the Plan map shows into the payload. Reads only layout + this season's live
 *  plantings; the private fields have no home in the type (see header). */
export function buildSharePayload(name, beds, season, bundle) {
    const known = new Set(bundle.species.map((s) => s.id));
    const plants = (season?.plantings ?? [])
        .filter((p) => !p.end_cause) // live occupancy only - an ended planting is history, not the plan
        .map((p) => {
        const out = { s: p.species, region: p.region };
        if (p.cultivar_group)
            out.g = p.cultivar_group;
        if (!known.has(p.species))
            out.n = p.species; // caller overwrites with the display name
        if (p.sown)
            out.d = p.sown;
        return out;
    });
    return {
        v: 1,
        name,
        season: season?.id ?? new Date().getFullYear(),
        beds: beds.map((b) => ({ n: b.name, region: b.region })),
        plants,
    };
}
// --- bytes <-> base64url ------------------------------------------------------------------------
// base64url (RFC 4648 §5): the alphabet carries no "=", so the payload can never contain the
// literal "access_token=" that account.ts's captureAuthHash() claims a hash for.
function toBase64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url(s) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
async function pump(readable) {
    const chunks = [];
    const reader = readable.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
    }
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.length;
    }
    return out;
}
async function deflate(bytes, dir) {
    const stream = dir === "deflate-raw"
        ? new CompressionStream("deflate-raw")
        : new DecompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    // A mangled payload rejects the WRITE promise as well as the read side; swallow the write's
    // rejection (it would otherwise be an unhandled rejection) - pump() surfaces the same error
    // through the reader, where decodeShare's try/catch turns it into the plain-words refusal.
    writer.write(bytes.slice()).catch(() => { });
    writer.close().catch(() => { });
    return pump(stream.readable);
}
/** Payload -> the fragment blob (what goes after "#/share/"). */
export async function encodeShare(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return toBase64url(await deflate(json, "deflate-raw"));
}
// --- decode + validate --------------------------------------------------------------------------
// A link is untrusted input from anywhere. The validator admits exactly the shape the encoder
// writes, with bounds, and throws a PLAIN-WORDS reason - the share page shows it (a refusal
// always says why).
const MAX_ITEMS = 400; // far above any real garden; a bound, not a target
function badLink(why) {
    throw new Error(`This link couldn't be read - ${why}. It may have been cut short when it was copied; ask for it to be sent again.`);
}
function checkRegion(r) {
    const reg = r;
    const fin = (v) => typeof v === "number" && Number.isFinite(v);
    if (reg && reg.shape === "rect" && fin(reg.x) && fin(reg.y) && fin(reg.w) && fin(reg.h)) {
        return { shape: "rect", x: reg.x, y: reg.y, w: reg.w, h: reg.h };
    }
    if (reg && reg.shape === "polygon" && Array.isArray(reg.points) && reg.points.length >= 3
        && reg.points.length <= 256
        && reg.points.every((p) => Array.isArray(p) && p.length === 2 && fin(p[0]) && fin(p[1]))) {
        return { shape: "polygon", points: reg.points.map((p) => [p[0], p[1]]) };
    }
    badLink("a shape inside it is malformed");
}
const str = (v, cap) => typeof v === "string" && v.length <= cap ? v : badLink("a label inside it is malformed");
/** Fragment blob -> validated payload. Throws with a plain-words reason on anything malformed. */
export async function decodeShare(blob) {
    if (!blob || !/^[A-Za-z0-9_-]+$/.test(blob))
        badLink("it is not a share payload");
    let raw;
    try {
        raw = JSON.parse(new TextDecoder().decode(await deflate(fromBase64url(blob), "inflate")));
    }
    catch {
        badLink("it does not unpack");
    }
    const p = raw;
    if (!p || p.v !== 1)
        badLink("it was made by a newer app than this one");
    if (typeof p.season !== "number" || !Number.isInteger(p.season))
        badLink("its season is malformed");
    if (!Array.isArray(p.beds) || p.beds.length > MAX_ITEMS
        || !Array.isArray(p.plants) || p.plants.length > MAX_ITEMS)
        badLink("its contents are malformed");
    return {
        v: 1,
        name: str(p.name ?? "", 120),
        season: p.season,
        beds: p.beds.map((b) => ({ n: str(b?.n ?? "", 120), region: checkRegion(b?.region) })),
        plants: p.plants.map((q) => {
            const out = { s: str(q?.s ?? "", 120), region: checkRegion(q?.region) };
            if (q?.g !== undefined)
                out.g = str(q.g, 120);
            if (q?.n !== undefined)
                out.n = str(q.n, 120);
            if (q?.d !== undefined)
                out.d = str(q.d, 40);
            return out;
        }),
    };
}
/** The crop a shared plan hands to the answers ladder (O23 / D-168 call 3). Pure, and here rather
 *  than in shareview.ts so Node can test it - shareview imports preact, which only the browser
 *  resolves, and a decision this consequential should not be reachable only through a rendered page.
 *
 *  The share view is the product's ONLY word-of-mouth surface, and its exit used to drop every
 *  recipient at the undifferentiated planner - the same fault the species pages had, on the warmest
 *  traffic there is.
 *
 *  The first plant the corpus actually carries. A user variety's id resolves to nothing, so a link
 *  carrying one would open a ladder that refuses - an exit worse than the plain one it replaced.
 *  Null when a plan holds no resolvable species at all; the caller then keeps the planner exit
 *  rather than inventing a crop to ask about. */
export function shareLadderCrop(p, bundle) {
    for (const q of p.plants) {
        if (bundle.species.some((s) => s.id === q.s))
            return q.s;
    }
    return null;
}
