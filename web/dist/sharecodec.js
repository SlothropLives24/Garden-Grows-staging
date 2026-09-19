export function buildSharePayload(name, beds, season, bundle) {
    const known = new Set(bundle.species.map((s) => s.id));
    const plants = (season?.plantings ?? [])
        .filter((p) => !p.end_cause)
        .map((p) => {
        const out = { s: p.species, region: p.region };
        if (p.cultivar_group)
            out.g = p.cultivar_group;
        if (!known.has(p.species))
            out.n = p.species;
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
    writer.write(bytes.slice()).catch(() => { });
    writer.close().catch(() => { });
    return pump(stream.readable);
}
export async function encodeShare(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return toBase64url(await deflate(json, "deflate-raw"));
}
const MAX_ITEMS = 400;
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
export function shareLadderCrop(p, bundle) {
    for (const q of p.plants) {
        if (bundle.species.some((s) => s.id === q.s))
            return q.s;
    }
    return null;
}
