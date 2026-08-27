// Photos on the Log (O6 / D-171). Pure helpers - no DOM, no IndexedDB: capture-time downscale,
// filename minting, and the STORE zip the export rides. The engine NEVER reads a photo (D-171):
// nothing in here inspects image content; a photo is the gardener's evidence, not the engine's
// input.
//
// The zip is hand-rolled because the app is zero-dependency and needs exactly one shape: STORE
// (method 0, no compression - JPEG is already compressed), one flat directory of filenames. The
// reader tolerates this writer's own output plus any other flat STORE zip; a compressed entry is
// refused by name rather than half-imported.
/** Downscale a captured photo to the D-171 ceiling: longest edge 1600 px, JPEG quality 0.8
 *  (~250 KB typical). The original is never kept. */
export async function downscalePhoto(file) {
    const bmp = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const cx = canvas.getContext("2d");
        if (!cx)
            throw new Error("no 2d canvas - cannot process the photo");
        cx.drawImage(bmp, 0, 0, w, h);
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
        if (!blob)
            throw new Error("the browser could not encode the photo");
        return blob;
    }
    finally {
        bmp.close();
    }
}
/** Mint a photo filename: p-<date>-<4 hex>.jpg. The suffix exists only to keep two photos taken
 *  the same day distinct; `taken` says which names this season already holds. */
export function mintPhotoName(date, taken) {
    for (;;) {
        const b = new Uint8Array(2);
        crypto.getRandomValues(b);
        const name = `p-${date}-${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}.jpg`;
        if (!taken.has(name))
            return name;
    }
}
// --- STORE zip ---------------------------------------------------------------------------------
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c >>> 0;
    }
    return t;
})();
function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++)
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
const encoder = new TextEncoder();
/** Build a flat STORE zip of {name -> bytes}. Deterministic: entries in the given order, all
 *  timestamps zeroed (the photo's real date lives in the season record, not in zip metadata). */
export function buildStoreZip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const { name, bytes } of entries) {
        const nm = encoder.encode(name);
        const crc = crc32(bytes);
        const local = new Uint8Array([
            0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), // sig, version 2.0, flags, method STORE
            ...u16(0), ...u16(0), // time, date: zeroed, deliberately
            ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0),
            ...nm,
        ]);
        central.push(new Uint8Array([
            0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0),
            ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0),
            ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
            ...nm,
        ]));
        parts.push(local, bytes);
        offset += local.length + bytes.length;
    }
    const centralSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array([
        0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
        ...u32(centralSize), ...u32(offset), ...u16(0),
    ]);
    // the cast bridges TS 5.7's Uint8Array<ArrayBufferLike> vs BlobPart split - every buffer here
    // is a plain ArrayBuffer this module allocated itself
    return new Blob([...parts, ...central, end], { type: "application/zip" });
}
/** Read a flat STORE zip back to {name -> bytes}. Refuses compressed entries and pathed names
 *  loudly - the photo store's namespace is flat, and a name with a separator must not enter it. */
export function readStoreZip(buf) {
    const b = new Uint8Array(buf);
    const view = new DataView(buf);
    // end-of-central-directory: scan back over the (empty-comment first, then commented) tail
    let eocd = -1;
    for (let i = b.length - 22; i >= 0 && i >= b.length - 22 - 0xffff; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        throw new Error("not a zip file (no end-of-central-directory)");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true); // central directory offset
    const out = [];
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
        if (view.getUint32(p, true) !== 0x02014b50)
            throw new Error("malformed zip central directory");
        const method = view.getUint16(p + 10, true);
        const size = view.getUint32(p + 24, true);
        const nameLen = view.getUint16(p + 28, true);
        const extraLen = view.getUint16(p + 30, true);
        const commentLen = view.getUint16(p + 32, true);
        const localOff = view.getUint32(p + 42, true);
        const name = decoder.decode(b.subarray(p + 46, p + 46 + nameLen));
        if (method !== 0)
            throw new Error(`zip entry ${JSON.stringify(name)} is compressed - this importer reads STORE zips only`);
        if (!name || name.includes("/") || name.includes("\\"))
            throw new Error(`zip entry ${JSON.stringify(name)} is not a bare filename`);
        // the local header repeats name/extra lengths; the data follows it
        const lNameLen = view.getUint16(localOff + 26, true);
        const lExtraLen = view.getUint16(localOff + 28, true);
        const start = localOff + 30 + lNameLen + lExtraLen;
        out.push({ name, bytes: b.subarray(start, start + size) });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
}
