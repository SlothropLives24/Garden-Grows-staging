import './chunk-lutet8cz.js';
import { fillCopy, copy, R, html } from './paint.js';
export { humanize } from './paint.js';
import { commonName, plateModel, localTodayIso, plateColours, renderPlate, plateKeyInto, plateKey, plantingWindow, intersectArea, plantHref } from './core.js';
import './chunk-l5cseoso.js';

function buildSharePayload(name, beds, season, bundle, planned = []) {
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
    for (const p of planned) {
        const out = { s: p.species, region: p.region };
        if (p.cultivar_group)
            out.g = p.cultivar_group;
        if (!known.has(p.species))
            out.n = p.species;
        out.p = 1;
        plants.push(out);
    }
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
async function encodeShare(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return toBase64url(await deflate(json, "deflate-raw"));
}
const MAX_ITEMS = 400;
function badLink(why) {
    throw new Error(fillCopy("svBadLink", { why: copy[why] }));
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
    badLink("svBadShape");
}
const str = (v, cap) => typeof v === "string" && v.length <= cap ? v : badLink("svBadLabel");
async function decodeShare(blob) {
    if (!blob || !/^[A-Za-z0-9_-]+$/.test(blob))
        badLink("svBadNotShare");
    let raw;
    try {
        raw = JSON.parse(new TextDecoder().decode(await deflate(fromBase64url(blob), "inflate")));
    }
    catch {
        badLink("svBadIncomplete");
    }
    const p = raw;
    if (!p || p.v !== 1)
        badLink("svBadNewer");
    if (typeof p.season !== "number" || !Number.isInteger(p.season))
        badLink("svBadSeason");
    if (!Array.isArray(p.beds) || p.beds.length > MAX_ITEMS
        || !Array.isArray(p.plants) || p.plants.length > MAX_ITEMS)
        badLink("svBadContents");
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
            if (q?.p !== undefined) {
                if (q.p !== 1)
                    badLink("svBadPlant");
                out.p = 1;
            }
            return out;
        }),
    };
}
function shareLadderCrop(p, bundle) {
    for (const q of p.plants) {
        if (bundle.species.some((s) => s.id === q.s))
            return q.s;
    }
    return null;
}

let getBundle = null;
let lastBlob = null;
let decoded = null;
let decodeError = null;
function blobFromHash() {
    const m = location.hash.match(/^#\/share\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}
const onShareRoute = () => /^#\/share(?:[/?]|$)/.test(location.hash);
function planMap(p, bundle) {
    if (!p.beds.length)
        return null;
    const nameOf = (sid) => { const q = p.plants.find((x) => x.s === sid); return q ? plantName(q, bundle) : commonName(bundle, sid); };
    const model = plateModel({ beds: p.beds.map((b) => ({ name: b.n, region: b.region })) }, { plantings: p.plants.map((q) => ({ species: q.s, cultivar_group: q.g, region: q.region, sown: q.d })) }, null, localTodayIso(), (pl) => plantingWindow(pl, bundle.species.find((x) => x.id === pl.species)));
    return html `<div class="share-map" ref=${(el) => {
        if (el && !el.firstChild) {
            const colourOf = plateColours(model);
            const plate = renderPlate(model, { label: copy.svPlateLabel, colourOf });
            el.appendChild(plate);
            const key = document.createElement("div");
            key.className = "hg-legend";
            el.appendChild(plateKeyInto(key, plateKey(model, nameOf), { counts: true, colourOf, marks: plate }));
        }
    }}></div>`;
}
function plantName(q, bundle) {
    const inCorpus = bundle.species.some((s) => s.id === q.s);
    if (!inCorpus && q.n)
        return q.n;
    return commonName(bundle, q.s);
}
function plantCell(q, bundle) {
    const label = plantName(q, bundle);
    const inCorpus = bundle.species.some((s) => s.id === q.s);
    return inCorpus
        ? html `<a class="n pname" href=${plantHref(q.s)}>${label}</a>`
        : html `<span class="n">${label}</span>`;
}
function bedOf(q, p) {
    let best = null, bestA = 0;
    for (const b of p.beds) {
        const a = intersectArea(q.region, b.region);
        if (a > bestA) {
            bestA = a;
            best = b.n;
        }
    }
    return best;
}
const fmtSown = (iso) => {
    const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m)
        return iso;
    const months = [copy.clMonthJan, copy.clMonthFeb, copy.clMonthMar, copy.clMonthApr, copy.clMonthMay, copy.clMonthJun,
        copy.clMonthJul, copy.clMonthAug, copy.clMonthSep, copy.clMonthOct, copy.clMonthNov, copy.clMonthDec];
    return fillCopy("clMonthDay", { month: months[Number(m[1]) - 1].slice(0, 3), day: Number(m[2]) });
};
function plantList(p, bundle) {
    if (!p.plants.length)
        return html `<p class="hint">${copy.svNoPlants}</p>`;
    const rows = [];
    for (const q of p.plants) {
        const bed = bedOf(q, p);
        const when = q.d ? fillCopy("svSown", { date: fmtSown(q.d) }) : q.p === 1 ? copy.svPlanned : null;
        const tail = [bed, when].filter(Boolean).join(" · ");
        const same = rows.find((r) => r.q.s === q.s && r.q.g === q.g && r.q.n === q.n && r.tail === tail);
        if (same)
            same.n++;
        else
            rows.push({ q, tail, n: 1 });
    }
    return html `<div class="share-plants">
    ${rows.map(({ q, tail, n }, i) => html `<div class="share-plantrow" key=${i}>
        ${plantCell(q, bundle)}<span class="d">${n > 1 ? `${fillCopy("svCount", { n })} · ${tail}` : tail}</span>
      </div>`)}
  </div>`;
}
function legendKey(p) {
    const planned = p.plants.some((q) => q.p === 1);
    const planted = p.plants.some((q) => q.p !== 1);
    return planned && planted ? "svWhatPlantedPlanned" : planned ? "svWhatPlanned" : "svWhatPlanted";
}
function NoPlan() {
    return html `<div class="notfound"><div class="share-banner share-bad">${copy.svNoPlan}</div>
    <p class="notfound-acts"><a class="btn btn-primary" href="#/plan">${copy.svPlanYourOwn}</a></p></div>`;
}
function SharePage() {
    if (decodeError) {
        return html `<div class="notfound"><div class="share-banner share-bad">${decodeError}</div>
      <p class="notfound-acts"><a class="btn btn-primary" href="#/plan">${copy.svPlanYourOwn}</a></p></div>`;
    }
    if (!decoded || !getBundle) {
        return html `<p class="hint">${copy.svReading}</p>`;
    }
    const p = decoded;
    const bundle = getBundle();
    return html `<div class="share-page">
    <div class="share-banner"><strong>${copy.svBannerHead}</strong> ${p.name
        ? fillCopy("svBannerBodyNamed", { name: p.name }) : copy.svBannerBody}</div>
    ${planMap(p, bundle)}
    <p class="share-legend">${fillCopy(legendKey(p), { season: p.season })}</p>
    ${plantList(p, bundle)}
    ${(() => {
        const crop = shareLadderCrop(p, bundle);
        if (!crop)
            return html `<a class="btn btn-primary btn-block share-cta" href="#/plan">${copy.svPlanYourOwn}</a>`;
        return html `<div class="share-exit">
        <a class="btn btn-primary btn-block share-cta" href=${`#/answers?crop=${encodeURIComponent(crop)}`}>
          ${fillCopy("svWhenGrow", { crop: commonName(bundle, crop) })}</a>
        <a class="btn btn-secondary btn-block share-cta2" href="#/plan">${copy.svOrPlanYourOwn}</a>
      </div>`;
    })()}
    <p class="share-credit">${copy.svCredit}</p>
  </div>`;
}
async function refresh() {
    const host = document.getElementById("sharebody");
    if (!host)
        return;
    const blob = blobFromHash();
    if (blob === null) {
        if (onShareRoute()) {
            lastBlob = null;
            decoded = null;
            decodeError = null;
            R(html `<${NoPlan} />`, host);
        }
        return;
    }
    if (blob !== lastBlob) {
        lastBlob = blob;
        decoded = null;
        decodeError = null;
        R(html `<${SharePage} />`, host);
        try {
            decoded = await decodeShare(blob);
        }
        catch (e) {
            decodeError = e instanceof Error ? e.message : String(e);
        }
    }
    R(html `<${SharePage} />`, host);
}
function initShare(bundle) {
    getBundle = bundle;
    window.addEventListener("hashchange", () => { void refresh(); });
    void refresh();
}

export { buildSharePayload, encodeShare, initShare, plantName };
