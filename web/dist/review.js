// Season review (Phase A / D-025): the orchestrate stage's summary surface. Everything here is
// a PRESENTATION of engine outputs the app already computes elsewhere - the ledger's plantings
// and observations, the R-093 frost calibration, and next planting year's eligibility per bed
// (derived history ∩ rotation rules). No new engine claims, no new dates, no numbers the engine
// can't source; empty states say what's missing instead of pretending. DOM layer (D-024 component).
import { html, render } from "./ui.js";
import { plantHref } from "./panels/plantcard.js";
import { eligibleSpecies } from "./engine/compiler.js";
import { frostCalibration } from "./engine/frostcalib.js";
import { familyName, humanize, humanizeFamilies, stripRuleCitations } from "./engine/labels.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { mergePriorOccupancy, plantingOnBed } from "./plan.js";
import { steeringBlock } from "./steering.js";
import { composeSeason } from "./engine/seasoncompose.js";
import { displayName } from "./engine/guilds.js";
import { fmtArea } from "./units.js";
let getData = null;
// Module state (not hook state): the redraw is driven from app.ts's draw cycle, and module
// state deterministically survives those external re-renders.
let selectedSeason = null;
const plantingLine = (d, p) => {
    const end = p.end_cause
        ? `ended by ${humanize(p.end_cause).toLowerCase()} ${p.end_date}`
        : "still in the ground";
    const fails = (p.failures ?? [])
        .map((f) => `${f.date} ${humanize(f.mode).toLowerCase()} (${f.severity})`)
        .join("; ");
    return html `<p class="entry" key=${p.species + (p.sown ?? "")}>
    <a class="pname" href=${plantHref(p.species)}>${d.commonName(p.species)}</a>${p.sown ? `, sown ${p.sown}` : ""} - ${end}${fails ? ` · suffered: ${fails}` : ""}
  </p>`;
};
function boundaryLine(label, b, minSeasons) {
    if (!b.per_season.length)
        return html `<p class="hint" key=${label}>${label}: nothing logged yet.</p>`;
    if (b.calibrated) {
        const m = b.median_offset_days;
        const dir = m > 0 ? `${Math.abs(m)} days later` : m < 0 ? `${Math.abs(m)} days earlier` : "right on the model";
        return html `<p class="ok" key=${label}>${label}: this ground runs ~${dir} than the model -
      observed ~${b.calibrated_date} supersedes the model's ${b.per_season[0].model} for this plot.</p>`;
    }
    return html `<p key=${label}>${label}: ${b.n} of ${minSeasons} seasons logged - ${minSeasons - b.n} more and this ground's own dates supersede the model.</p>`;
}
// The replan bridge, second hop (ISSUES #11 item 2): the outlook names what next year's ground
// allows, so the action it points at is planning that bed - same candbed mechanism as the Log
// card's "Edit / plan this bed", so the two bridges cannot drift apart in behaviour.
function planBed(name) {
    const cand = document.getElementById("candbed");
    if (cand && [...cand.options].some((o) => o.value === name)) {
        cand.value = name;
        cand.dispatchEvent(new Event("change"));
    }
    location.hash = "#/plan";
}
function bedOutlook(d, bed, plantingYear) {
    // Already replanted? DERIVED from the next season's occupancy on this bed's ground (the
    // ground-rooted line - never a bed-attached flag): a live planting in the plantingYear season
    // whose region sits on this bed means the replan happened, so the bridge changes verb.
    const nextSeason = d.seasons.find((s) => s.id === plantingYear);
    const replanted = !!nextSeason
        && (nextSeason.plantings ?? []).some((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
    const bridge = html `<p class="entry replan" key="bridge">
    ${replanted ? `Already replanted for ${plantingYear}. ` : ""}<button class="link planbridge" type="button"
      onClick=${() => planBed(bed.name)}>${replanted ? `Revisit this bed's plan →` : `Plan this bed for ${plantingYear} →`}</button>
  </p>`;
    // D-102: logged occupancy + the user's DECLARED pre-tracking history, in one derived history
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
    // O46: the crop inside a carried-history entry links. Built as vnodes rather than strings so the
    // name can be an anchor - the separator moves INTO each entry because the old `join("; ")` has
    // nothing to join once these stop being strings. Each entry stays on one line: htm strips
    // whitespace where an interpolation touches a line break (see the note below).
    const carried = derived.contributions.map((c, i) => c.species === "" // a DECLARED seed (family-level, no species)
        ? html `${i ? "; " : ""}${`${c.season}: ${familyName(c.family)} (declared)`}`
        : html `${i ? "; " : ""}${`${c.season}: ${familyName(c.family)} (`}<a class="pname" href=${plantHref(c.species)}>${d.commonName(c.species)}</a>${`, ${fmtArea(c.overlap_m2)} overlap)`}`);
    // NB: htm strips whitespace where an interpolation touches a line break, so a text hole must
    // stay on the same line as the words around it.
    return html `<div class="entry bedoutlook" key=${bed.name}>
    <p><strong>${bed.name}</strong> - carried ${carried} → ${res.eligible.length} species fine, ${res.blocked.length} blocked:</p>
    ${res.blocked.map((b) => html `<p class="blocked" key=${b.species}>
      <a class="pname" href=${plantHref(b.species)}>${d.commonName(b.species)}</a> - ${b.blocked_by.map((r) => stripRuleCitations(humanizeFamilies(r.why))).join("; ")}
    </p>`)}
    ${res.suggestions.map((s) => html `<p class="suggest" key=${s.rule} title=${d.ruleClaim(s.rule)}>
      Eligibility is thin - consider an ${s.families.map(familyName).join(" or ")} break: ${stripRuleCitations(humanizeFamilies(s.why))}.
    </p>`)}
    ${whatFollows(d, site)}
    ${bridge}
  </div>`;
}
// O72: what the ORDER favours on this ground next season - one step of the seasonal axis, read
// off the same derived history the eligibility above just used. Ranked guilds link to their
// cards; each credit is a link whose VISIBLE text is the term's own short why (humanized - no
// Latin family names) and whose title carries the rule's full claim sentence, the same idiom the
// eligibility suggestions above use (QA sweep 2026-08-12: R-013's five-line claim as anchor text,
// twice in a row, swamped the block). No codes anywhere in visible text (D-083). A quiet result
// renders NOTHING: eligibility is the honest guide on ground with no order to score.
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
      <a href=${`#/plan?guild=${s.guild}`}>${name(s.guild)}</a>${" - "}${s.terms.filter((t) => t.weight > 0).map((t, i) => html `${i ? "; " : ""}<a href=${`#/why?rule=${t.rule}`} title=${d.ruleClaim(t.rule)}>${humanizeFamilies(t.why)}</a>`)}
    </p>`)}
    ${warned.length ? html `<p class="wf-warn">
      Repeats this ground warns against: ${warned.map((s) => name(s.guild)).join(", ")} - a
      family is still inside its rotation interval here.
    </p>` : null}
  </div>`;
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
    const cal = d.clim ? frostCalibration(d.seasons, d.clim) : null;
    const nextYear = season.id + 1;
    return html `<div>
    <div class="logrow revhead">
      <label for="revseason">Season</label>
      <select id="revseason" onChange=${(e) => {
        selectedSeason = Number(e.target.value);
        redrawReview();
    }}>
        ${[...ids].reverse().map((id) => html `<option value=${id} selected=${id === season.id} key=${id}>${id}</option>`)}
      </select>
      <span class="hint">${d.plotLabel} - ${plantings.length} plantings, ${(season.observations ?? []).length} observations</span>
    </div>

    <fieldset>
      <legend>What grew</legend>
      ${plantings.length
        ? plantings.map((p) => plantingLine(d, p))
        : html `<p class="hint">No plantings logged this season.</p>`}
    </fieldset>

    <fieldset>
      <legend>What the frost taps taught the model</legend>
      ${seasonObs.length
        ? html `<p class="entry">This season: ${seasonObs.map((o) => `${o.date} frost${o.severity ? ` (${o.severity})` : ""}`).join(" · ")}</p>`
        : html `<p class="hint">No frost observations this season - two dated taps a year feed the calibration.</p>`}
      ${cal
        ? html `${boundaryLine("Last spring frost", cal.spring, cal.min_seasons)}
               ${boundaryLine("First fall freeze", cal.fall, cal.min_seasons)}`
        : html `<p class="hint">Resolve your location on the Plan tab to compare these against the model.</p>`}
    </fieldset>

    <fieldset>
      <legend>Next year's ground (planting year ${nextYear})</legend>
      ${d.beds.length ? steeringBlock(d, season) : null}
      ${d.beds.length
        ? d.beds.map((bed) => bedOutlook(d, bed, nextYear))
        : html `<p class="hint">No beds placed yet - trace or place ground on the Plan tab and the
            rotation outlook appears per bed.</p>`}
    </fieldset>
  </div>`;
}
export function redrawReview() {
    const host = document.getElementById("reviewbody");
    if (!host || !getData)
        return;
    render(html `<${ReviewPage} />`, host);
}
/** Wire the review page to the app's data. Returns the redraw for app.ts's draw cycle. */
export function initReview(data) {
    getData = data;
    redrawReview();
    return redrawReview;
}
