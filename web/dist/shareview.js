// The received share (O7 / D-164): a tab-less read-only page - like the landing and the Review -
// so a recipient with no account and no garden sees the plan instantly. Deliberately NOT the live
// map: groundmap.ts is an editor wired to THIS device's IndexedDB and the Plan page's DOM, so the
// shared snapshot gets its own light drawing - bed outlines, planting dots, names - and a plant
// list grouped by bed. The one action is the acquisition loop: plan your own garden. This page is
// where the "planned with milpa.garden" credit lives naturally - the recipient is already here.
//
// Looking at a shared plan changes NOTHING of the viewer's own garden: this module reads the hash,
// decodes, renders - it never touches storage. DOM layer (D-024 component).
import { html, render } from "./ui.js";
import { decodeShare, shareLadderCrop } from "./sharecodec.js";
import { regionPoints, intersectArea } from "./engine/regions.js";
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
// --- the drawing --------------------------------------------------------------------------------
function centerOf(r) {
    const pts = regionPoints(r);
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
function planMap(p) {
    const allPts = p.beds.flatMap((b) => regionPoints(b.region));
    if (!allPts.length)
        return null;
    const xs = allPts.map((q) => q[0]), ys = allPts.map((q) => q[1]);
    const pad = 0.4;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    const w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
    const dot = Math.max(0.09, Math.min(w, h) / 55);
    const lbl = Math.max(0.22, Math.min(w, h) / 22);
    return html `<div class="share-map">
    <svg viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="the shared plan's beds and plants">
      ${p.beds.map((b) => html `<polygon key=${b.n}
        points=${regionPoints(b.region).map((q) => q.join(",")).join(" ")}
        class="share-bed" />`)}
      ${p.beds.map((b) => {
        const pts = regionPoints(b.region);
        const bx = Math.min(...pts.map((q) => q[0])), by = Math.min(...pts.map((q) => q[1]));
        return html `<text key=${"l" + b.n} class="share-bedlbl" x=${bx + lbl * 0.4} y=${by + lbl * 1.1}
          font-size=${lbl}>${b.n}</text>`;
    })}
      ${p.plants.map((q, i) => {
        const [cx, cy] = centerOf(q.region);
        return html `<circle key=${i} class="share-dot" cx=${cx} cy=${cy} r=${dot} />`;
    })}
    </svg>
  </div>`;
}
// --- the plant list -----------------------------------------------------------------------------
function plantName(q, bundle) {
    const inCorpus = bundle.species.some((s) => s.id === q.s);
    if (!inCorpus && q.n)
        return q.n; // a user variety - the name travelled because the id can't resolve
    return commonName(bundle, q.s);
}
/** The plant's name in the shared list, linked to its card where there is a card to link to.
 *
 *  RULED 2026-08-02 (O46). This is the ACQUISITION surface - its single action is "plan your own
 *  garden" - so linking here was a real question rather than an oversight. It links because a
 *  recipient reading someone else's plan and wondering what a tomatillo is is exactly who the card
 *  serves, and the card is a path INTO the app rather than away from it. The CTA keeps its button
 *  styling and stays the loudest thing on the page.
 *
 *  A USER-ADDED VARIETY STAYS PLAIN, and that is a limit rather than a choice: its name travelled
 *  in the share payload precisely BECAUSE its id resolves to nothing here (see `plantName` above),
 *  so there is no card to open. It also must not carry `.pname` - that class means "this opens a
 *  card", and wearing it without being a link is the false affordance this whole arc came from. */
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
// --- the page -----------------------------------------------------------------------------------
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
    ${planMap(p)}
    <p class="share-legend">What is planted · season ${p.season}</p>
    ${plantList(p, bundle)}
    ${(() => {
        // The exit carries the plan's own crop into rung 2, so the recipient's first answer is about
        // something they were just looking at. It NAMES that crop rather than saying "these": one
        // crop travels, the plan holds many, and "these" would promise an answer the link does not
        // deliver. The planner door stays, one step quieter - the ladder is an offer, not a detour
        // everyone is forced through.
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
        return; // not on the share page
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
/** Wire the share page. Self-contained: renders whenever the hash points at #/share/… */
export function initShare(bundle) {
    getBundle = bundle;
    window.addEventListener("hashchange", () => { void refresh(); });
    void refresh();
}
// Re-exported so the humanize fallback inside commonName stays reachable for tree-shakers; and so
// a unit test can pin the name resolution order without a DOM.
export { plantName, humanize };
