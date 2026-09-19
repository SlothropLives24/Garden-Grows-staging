import { html, render } from "./ui.js";
import { plantHref } from "./panels/plantcard.js";
import { markLink } from "./dossier.js";
import { plateKey, plateKeyInto, plateModel, renderPlate } from "./gardenplate.js";
import { resolveDtm } from "./calendar.js";
import { dayWord } from "./diary.js";
import { eligibleSpecies } from "./engine/compiler.js";
import { frostCalibration } from "./engine/frostcalib.js";
import { familyName, humanize, humanizeFamilies, stripRuleCitations } from "./engine/labels.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { mergePriorOccupancy, plantingOnBed } from "./plan.js";
import { steeringBlock } from "./steering.js";
import { composeSeason } from "./engine/seasoncompose.js";
import { displayName } from "./engine/guilds.js";
import { fmtArea } from "./units.js";
import { app } from "./state.js";
import { getPhoto, openLog } from "./storage.js";
import { openNextSeason } from "./nextseason.js";
import { go } from "./nav.js";
let getData = null;
let selectedSeason = null;
const _revPhotoUrls = new Map();
function reviewPhotoInto(img, seasonId, name) {
    const plot = app.currentPlotId;
    const key = `${plot}:${seasonId}:${name}`;
    const hit = _revPhotoUrls.get(key);
    if (hit) {
        img.src = hit;
        return;
    }
    void openLog().then((db) => getPhoto(db, plot, seasonId, name)).then((b) => {
        if (!b)
            return;
        const url = URL.createObjectURL(b);
        _revPhotoUrls.set(key, url);
        img.src = url;
    }).catch(() => { });
}
const plantingLine = (d, p, seasonId) => {
    const beats = [];
    if (p.sown)
        beats.push(`sown ${dayWord(p.sown)}`);
    if (p.transplanted && p.transplanted !== p.sown)
        beats.push(`set out ${dayWord(p.transplanted)}`);
    if (p.first_harvest)
        beats.push(`first picked ${dayWord(p.first_harvest)}`);
    if (p.last_harvest && p.last_harvest !== p.first_harvest)
        beats.push(`last picked ${dayWord(p.last_harvest)}`);
    beats.push(p.end_cause
        ? `ended by ${humanize(p.end_cause).toLowerCase()}${p.end_date ? ` ${dayWord(p.end_date)}` : ""}`
        : "still in the ground");
    const fails = (p.failures ?? [])
        .map((f) => `${humanize(f.mode).toLowerCase()} (${f.severity}), ${dayWord(f.date)}`)
        .join("; ");
    const notes = (p.notes ?? []).filter((n) => n.text && n.text !== "Photo");
    const photos = (p.notes ?? []).filter((n) => n.photo);
    return html `<div class="entry rev-planting" key=${p.species + (p.sown ?? "")}>
    <p class="rev-p-name"><a class="pname" href=${plantHref(p.species)}>${d.commonName(p.species)}</a></p>
    ${notes.map((n) => html `<p class="rev-note" key=${"n" + n.date + n.text}>noted ${dayWord(n.date)}: ${n.text}</p>`)}
    ${photos.map((n) => html `<img class="rev-note-photo" key=${"ph" + n.date + n.photo} loading="lazy"
        alt=${`photo · ${d.commonName(p.species)}`}
        ref=${(el) => { if (el)
        reviewPhotoInto(el, seasonId, n.photo); }} />`)}
    <p class="rev-beats">${beats.join(", ")}${fails ? ` · suffered ${fails}` : ""}</p>
  </div>`;
};
function boundaryLine(label, b, minSeasons) {
    if (!b.per_season.length)
        return html `<p class="hint" key=${label}>${label}: nothing logged yet.</p>`;
    if (b.calibrated) {
        const m = b.median_offset_days;
        const dir = m > 0 ? `${Math.abs(m)} days later` : m < 0 ? `${Math.abs(m)} days earlier` : "right on the usual date";
        return html `<p class="ok" key=${label}>${label}: this ground runs ~${dir} than the general estimate,
      so your own date is now ~${b.calibrated_date}, from your log, rather than the general guess of ${b.per_season[0].model}.</p>`;
    }
    return html `<p key=${label}>${label}: ${b.n} of ${minSeasons} seasons logged. ${minSeasons - b.n} more and your frost dates come from your own log instead of the general estimate.</p>`;
}
function planBed(name) {
    const cand = document.getElementById("candbed");
    if (cand && [...cand.options].some((o) => o.value === name)) {
        cand.value = name;
        cand.dispatchEvent(new Event("change"));
    }
    location.hash = "#/plan";
}
function bedOutlook(d, bed, plantingYear) {
    const nextSeason = d.seasons.find((s) => s.id === plantingYear);
    const replanted = !!nextSeason
        && (nextSeason.plantings ?? []).some((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
    const bridge = html `<p class="entry replan" key="bridge">
    ${replanted ? `Already replanted for ${plantingYear}. ` : ""}<button class="link planbridge" type="button"
      onClick=${() => planBed(bed.name)}>${replanted ? `Revisit this bed's plan →` : `Plan this bed for ${plantingYear} →`}</button>
  </p>`;
    const derived = mergePriorOccupancy(deriveHistory(bed.region, d.seasons, d.bundle), d.priorOccupancy, bed.region);
    if (!derived.contributions.length) {
        return html `<div class="entry bedoutlook" key=${bed.name}>
      <p><strong>${bed.name}</strong> - clean ground as far as we know.</p>
      ${bridge}
    </div>`;
    }
    const site = { ...d.site, history: derived.history, season_year: plantingYear,
        verticillium_reservoir: derived.verticillium_reservoir };
    const res = eligibleSpecies(site, d.bundle);
    const carried = derived.contributions.map((c, i) => c.species === ""
        ? html `${i ? "; " : ""}${`${c.season}: ${familyName(c.family)} (declared)`}`
        : html `${i ? "; " : ""}${`${c.season}: ${familyName(c.family)} (`}<a class="pname" href=${plantHref(c.species)}>${d.commonName(c.species)}</a>${`, ${fmtArea(c.overlap_m2)} overlap)`}`);
    return html `<div class="entry bedoutlook" key=${bed.name}>
    <p><strong>${bed.name}</strong> - carried ${carried} → ${res.eligible.length} species fine, ${res.blocked.length} blocked:</p>
    ${res.blocked.map((b) => html `<p class="blocked" key=${b.species}>
      <a class="pname" href=${plantHref(b.species)}>${d.commonName(b.species)}</a> - ${b.blocked_by.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ")} ${b.blocked_by.map((r) => r.rule).filter((id) => !!id).map((id) => html `<a class="whytap" key=${id} href=${`#/why?rule=${id}`} ref=${(el) => el && markLink(el, { kind: "rule", id })} title=${d.ruleClaim(id)}>Why this? →</a>`)}
    </p>`)}
    ${res.suggestions.map((s) => html `<p class="suggest" key=${s.rule} title=${d.ruleClaim(s.rule)}>
      Eligibility is thin - consider an ${s.families.map(familyName).join(" or ")} break: ${stripRuleCitations(humanizeFamilies(s.why))}. <a class="whytap" href=${`#/why?rule=${s.rule}`} ref=${(el) => el && markLink(el, { kind: "rule", id: s.rule })}>Why this? →</a>
    </p>`)}
    ${whatFollows(d, site)}
    ${bridge}
  </div>`;
}
function whatFollows(d, site) {
    const r = composeSeason(site, d.bundle);
    if (r.quiet)
        return null;
    const byId = new Map(d.bundle.guilds.map((g) => [g.id, g]));
    const name = (gid) => { const g = byId.get(gid); return g ? displayName(g) : gid; };
    const top = r.successors.filter((s) => s.score > 0).slice(0, 3);
    const warned = r.successors.filter((s) => s.score < 0);
    if (!top.length && !warned.length)
        return null;
    return html `<div class="whatfollows">
    ${top.length ? html `<p class="wf-h">What follows well here:</p>` : null}
    ${top.map((s) => html `<p class="wf-row" key=${s.guild}>
      <a href=${`#/plan?guild=${s.guild}`}>${name(s.guild)}</a>${" - "}${s.terms.filter((t) => t.weight > 0).map((t, i) => html `${i ? "; " : ""}<a href=${`#/why?rule=${t.rule}`} ref=${(el) => el && markLink(el, { kind: "rule", id: t.rule })} title=${d.ruleClaim(t.rule)}>${humanizeFamilies(t.why)}</a>`)}
    </p>`)}
    ${warned.length ? html `<p class="wf-warn">
      Repeats this ground warns against: ${warned.map((s) => name(s.guild)).join(", ")} - a
      family is still inside its rotation interval here.
    </p>` : null}
  </div>`;
}
function yearPlate(d, season) {
    if (!d.beds.length)
        return null;
    const today = new Date().toISOString().slice(0, 10);
    const yearEnd = `${season.id}-12-31`;
    const atClose = yearEnd < today;
    const asOf = atClose ? yearEnd : today;
    const prev = d.seasons.find((s) => s.id === season.id - 1) ?? null;
    const addDays = (iso, days) => {
        const dt = new Date(`${iso}T12:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() + days);
        return dt.toISOString().slice(0, 10);
    };
    const model = plateModel({ beds: d.beds.map((b) => ({ name: b.name, region: b.region })) }, season, prev, asOf, (p) => {
        if (!p.sown)
            return null;
        const sp = d.bundle.species.find((x) => x.id === p.species);
        if (!sp || sp.scheduling_model !== "dtm")
            return null;
        const dtm = resolveDtm(sp, p.cultivar_group ?? null);
        return dtm ? addDays(p.sown, dtm[0]) : null;
    });
    return html `<figure class="rev-plate">
    <div class="rev-plate-fig" ref=${(el) => {
        if (!el)
            return;
        el.replaceChildren(renderPlate(model, { pxPerSide: 560, label: `your ${season.id} garden - north is up` }));
        const key = document.createElement("div");
        key.className = "hg-legend";
        el.append(plateKeyInto(key, plateKey(model, d.commonName), { counts: true }));
    }}></div>
    <figcaption>Your ${season.id} garden${atClose ? ", at the close of the year" : ", as it stands"}</figcaption>
    <button class="link revprint" type="button" onClick=${() => window.print()}>Print this year sheet</button>
  </figure>`;
}
function ReviewPage() {
    const d = getData();
    if (!d.seasons.length) {
        return html `<p class="hint">No seasons in this garden's ledger yet. Start one on the Log tab -
      the review builds itself from what you record there.</p>`;
    }
    const ids = d.seasons.map((s) => s.id);
    const season = d.seasons.find((s) => s.id === selectedSeason) ?? d.seasons[d.seasons.length - 1];
    const plantings = season.plantings ?? [];
    const seasonObs = (season.observations ?? []).filter((o) => o.event === "frost");
    const seasonDiary = (season.observations ?? [])
        .filter((o) => o.event === "note" || o.event === "heat")
        .slice().sort((a, b) => a.date.localeCompare(b.date));
    const cal = d.clim ? frostCalibration(d.seasons, d.clim) : null;
    const nextYear = season.id + 1;
    const spanDates = [
        ...plantings.flatMap((p) => [p.sown, p.transplanted, p.first_harvest, p.last_harvest, p.end_date]),
        ...(season.observations ?? []).map((o) => o.date),
    ].filter((x) => !!x).sort();
    const dateline = spanDates.length
        ? html `${d.plotLabel} · ${dayWord(spanDates[0])} – ${dayWord(spanDates[spanDates.length - 1])}`
        : html `${d.plotLabel}`;
    return html `<div>
    <!-- O146 step G / O161 S3 (nostalgia): the look-back leads with the YEAR, named in the almanac
         register - a year remembered, not a ledger audit - then a serif dateline (the keepsake's, it
         prints). The season selector chooses WHICH year to keep, so it stays in the screen-only row. -->
    <h2 class="rev-year">Your ${season.id} in the garden</h2>
    <p class="rev-dateline">${dateline}</p>
    <div class="logrow revhead">
      <label for="revseason">Season</label>
      <select id="revseason" onChange=${(e) => {
        selectedSeason = Number(e.target.value);
        redrawReview();
    }}>
        ${[...ids].reverse().map((id) => html `<option value=${id} selected=${id === season.id} key=${id}>${id}</option>`)}
      </select>
    </div>

    ${yearPlate(d, season)}

    <fieldset>
      <legend>What you grew</legend>
      ${plantings.length
        ? plantings.map((p) => plantingLine(d, p, season.id))
        : html `<p class="hint">No plantings logged this season.</p>`}
    </fieldset>

    <fieldset>
      <legend>What your logged frosts are teaching</legend>
      ${seasonObs.length
        ? html `<p class="entry">This season: ${seasonObs.map((o) => `frost ${dayWord(o.date)}${o.severity ? ` (${o.severity})` : ""}`).join(" · ")}</p>`
        : html `<p class="hint">No frost observations this season. Note two dated frosts a year and your frost dates start coming from your own log.</p>`}
      ${cal
        ? html `${boundaryLine("Last spring frost", cal.spring, cal.min_seasons)}
               ${boundaryLine("First fall freeze", cal.fall, cal.min_seasons)}`
        : html `<p class="hint">Set your location on the Plan tab to compare these against the general estimate.</p>`}
    </fieldset>

    ${seasonDiary.length
        ? html `<fieldset class="rev-diary">
          <legend>The season, in your own words</legend>
          ${seasonDiary.map((o) => html `<p class="entry" key=${o.date + (o.note ?? "")}>${dayWord(o.date)} - ${o.event === "heat" ? `a hot spell${o.note ? `: ${o.note}` : ""}` : o.note}</p>`)}
        </fieldset>`
        : null}

    <!-- O161 S3: the rotation outlook is a forward-looking audit - useful on screen, but not part of the
         year you'd keep. It becomes a screen-only fold (a <details>, open by default so it stays where it
         was) and drops off the printed sheet. The door hands you to the full next-season plan. -->
    <details class="rev-next" open>
      <summary>What next year's ground allows <span class="rev-next-yr">(planting year ${nextYear})</span></summary>
      <button class="link rev-nextdoor" type="button"
        onClick=${() => { openNextSeason(); go("plan", "nextseason"); }}>Plan next year's ground →</button>
      ${d.beds.length ? steeringBlock(d, season) : null}
      ${d.beds.length
        ? d.beds.map((bed) => bedOutlook(d, bed, nextYear))
        : html `<p class="hint">No beds placed yet - trace or place ground on the Plan tab and the
            rotation outlook appears per bed.</p>`}
    </details>
  </div>`;
}
function redrawReview() {
    const host = document.getElementById("reviewbody");
    if (!host || !getData)
        return;
    render(html `<${ReviewPage} />`, host);
}
export function initReview(data) {
    getData = data;
    redrawReview();
    return redrawReview;
}
