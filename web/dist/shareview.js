import { html, render } from "./ui.js";
import { decodeShare, shareLadderCrop } from "./sharecodec.js";
import { intersectArea } from "./engine/regions.js";
import { plateKey, plateKeyInto, plateModel, renderPlate } from "./gardenplate.js";
import { plantHref } from "./panels/plantcard.js";
import { commonName } from "./state.js";
import { humanize } from "./engine/labels.js";
let getBundle = null;
let lastBlob = null;
let decoded = null;
let decodeError = null;
function blobFromHash() {
    const m = location.hash.match(/^#\/share\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}
function planMap(p, bundle) {
    if (!p.beds.length)
        return null;
    const nameOf = (sid) => { const q = p.plants.find((x) => x.s === sid); return q ? plantName(q, bundle) : commonName(bundle, sid); };
    const model = plateModel({ beds: p.beds.map((b) => ({ name: b.n, region: b.region })) }, { plantings: p.plants.map((q) => ({ species: q.s, region: q.region, sown: q.d })) }, null, new Date().toISOString().slice(0, 10));
    return html `<div class="share-map" ref=${(el) => {
        if (el && !el.firstChild) {
            el.appendChild(renderPlate(model, { label: "the shared garden's beds and plants" }));
            const key = document.createElement("div");
            key.className = "hg-legend";
            el.appendChild(plateKeyInto(key, plateKey(model, nameOf), { counts: true }));
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
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[Number(m[1]) - 1]} ${Number(m[2])}`;
};
function plantList(p, bundle) {
    if (!p.plants.length)
        return html `<p class="hint">No plants in this plan yet - just the ground.</p>`;
    return html `<div class="share-plants">
    ${p.plants.map((q, i) => {
        const bed = bedOf(q, p);
        const tail = [bed, q.d ? `sown ${fmtSown(q.d)}` : null].filter(Boolean).join(" · ");
        return html `<div class="share-plantrow" key=${i}>
        ${plantCell(q, bundle)}<span class="d">${tail}</span>
      </div>`;
    })}
  </div>`;
}
function SharePage() {
    if (decodeError) {
        return html `<div class="share-banner share-bad">${decodeError}</div>`;
    }
    if (!decoded || !getBundle) {
        return html `<p class="hint">Reading the plan out of the link&hellip;</p>`;
    }
    const p = decoded;
    const bundle = getBundle();
    return html `<div>
    <div class="share-banner"><strong>A shared garden plan.</strong> Someone sent you their
      layout${p.name ? html ` - ${"“"}${p.name}${"”"}` : ""} - a snapshot from the day they
      shared it. It is not connected to their garden, and looking at it changes nothing of yours.</div>
    ${planMap(p, bundle)}
    <p class="share-legend">What is planted · season ${p.season}</p>
    ${plantList(p, bundle)}
    ${(() => {
        const crop = shareLadderCrop(p, bundle);
        if (!crop)
            return html `<a class="share-cta" href="#/plan">Plan your own garden</a>`;
        return html `<div class="share-exit">
        <a class="share-cta" href=${`#/answers?crop=${encodeURIComponent(crop)}`}>
          When would ${commonName(bundle, crop)} grow at your place?</a>
        <a class="share-cta2" href="#/plan">Or plan your own garden</a>
      </div>`;
    })()}
    <p class="share-credit">planned with milpa.garden</p>
  </div>`;
}
async function refresh() {
    const host = document.getElementById("sharebody");
    if (!host)
        return;
    const blob = blobFromHash();
    if (blob === null)
        return;
    if (blob !== lastBlob) {
        lastBlob = blob;
        decoded = null;
        decodeError = null;
        render(html `<${SharePage} />`, host);
        try {
            decoded = await decodeShare(blob);
        }
        catch (e) {
            decodeError = e instanceof Error ? e.message : String(e);
        }
    }
    render(html `<${SharePage} />`, host);
}
export function initShare(bundle) {
    getBundle = bundle;
    window.addEventListener("hashchange", () => { void refresh(); });
    void refresh();
}
export { plantName, humanize };
