// Rotation steering across beds (O1 / D-158). A PLOT-WIDE reader over the same two-stage pipeline
// the per-bed outlook already uses - deriveHistory (geometric, ground-rooted) -> eligibleSpecies
// (history + planting year -> blocked-with-reasons). It writes NO new engine claim and NO new
// number: every cell is the engine's own clear/held answer, obtained by ASKING eligibleSpecies at
// the relevant planting year rather than re-implementing the interval math. Same posture as
// review.ts's bedOutlook, widened from one bed to the whole plot.
//
// The shape it is built against (D-158): an optimiser that silently returns one arrangement would
// hide exactly the reasoning invariant 2 protects. So the rules here are explicit -
//   * a move is FORCED only when the ground leaves one open bed,
//   * offered as a FREE choice (never ranked) when several beds fit equally,
//   * turned into a LOUD REFUSAL with the reason and the R-013 break when no bed is open,
// and with one bed there is nowhere to steer TO, so the axis becomes TIME (when can each crop come
// back) instead of space. The grid stays visible under the moves, so every move traces to ground.
import { html } from "./ui.js";
import { eligibleSpecies, ROTATION_RULES, FAMILY_ROTATION_RULE } from "./engine/compiler.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { mergePriorOccupancy, bedHasSections } from "./plan.js";
import { familyName } from "./engine/labels.js";
const ROTATION_FAMILIES = new Set(Object.keys(FAMILY_ROTATION_RULE));
// How far forward the "when does this family clear again" search looks. The longest interval is the
// brassica 4-year (R-012), so a family held now clears within 4 planting years; 8 is a safe ceiling
// that also covers a partial-load year offset without ever looping unbounded.
const CLEAR_SCAN_YEARS = 8;
// The steerable beds are the plannable ones: a sectioned PARENT is a pure container (its sections
// are separate PlacedBeds and count individually), so it is excluded exactly as Plan/Log exclude it.
function steerableBeds(beds) {
    return beds.filter((b) => !bedHasSections(b.name, beds));
}
// The families a bed grew in the SELECTED season - the crops on that ground now, hence the ones
// that must find next year's home. Derived geometrically over that one season (ground-rooted).
function familiesHereThisSeason(bed, season, bundle) {
    const d = deriveHistory(bed.region, [season], bundle);
    return new Set(Object.values(d.history).flat());
}
// Ask the engine which rotation families are HELD (blocked by an interval rule R-010/011/012) if
// you planted in `year` on ground with this history. Pure oracle call - no interval math here.
function heldFamiliesAt(base, history, year, bundle) {
    const site = { ...base, history, season_year: year };
    const e = eligibleSpecies(site, bundle);
    const held = new Set();
    for (const b of e.blocked) {
        if (b.family && b.blocked_by.some((r) => r.rule !== null && ROTATION_RULES.has(r.rule)))
            held.add(b.family);
    }
    return held;
}
// R-013's break advice for thin ground, taken from the engine's own suggestion (not invented). Any
// bed whose ground is thin carries it; fall back to the two break families if none surfaces.
function breakAdviceAt(base, history, year, bundle) {
    const site = { ...base, history, season_year: year };
    const e = eligibleSpecies(site, bundle);
    const sug = e.suggestions[0];
    return sug && sug.families.length ? sug.families : [];
}
function bedStates(data, beds, season, plantingYear) {
    return beds.map((bed) => {
        const merged = mergePriorOccupancy(deriveHistory(bed.region, data.seasons, data.bundle), data.priorOccupancy, bed.region);
        const heldByYear = new Map();
        for (let y = plantingYear; y <= plantingYear + CLEAR_SCAN_YEARS; y++) {
            heldByYear.set(y, heldFamiliesAt({ ...data.site, verticillium_reservoir: merged.verticillium_reservoir }, merged.history, y, data.bundle));
        }
        return { name: bed.name, history: merged.history, here: familiesHereThisSeason(bed, season, data.bundle), heldByYear };
    });
}
function firstClearYear(st, family, from) {
    for (let y = from; y <= from + CLEAR_SCAN_YEARS; y++) {
        if (!st.heldByYear.get(y)?.has(family))
            return y;
    }
    return null;
}
/** Compute the whole plot's steering for the season AFTER `season`. Pure: reads only the engine. */
export function computeSteering(data, season) {
    const plantingYear = season.id + 1;
    const beds = steerableBeds(data.beds);
    const empty = { mode: "none", plantingYear, beds: [], years: [], grid: [], moves: [], timeline: [], breakFamilies: [] };
    if (!beds.length)
        return empty;
    const states = bedStates(data, beds, season, plantingYear);
    // Families in play: everything the garden grew this season (rotation families get real cells,
    // non-rotation families - beans, most herbs - show as unconstrained). Rotation families first,
    // then the rest, each group alphabetical, so the grid order is stable.
    const inPlay = new Set();
    for (const st of states)
        for (const f of st.here)
            inPlay.add(f);
    if (!inPlay.size)
        return empty;
    const families = [...inPlay].sort((a, b) => {
        const ra = ROTATION_FAMILIES.has(a), rb = ROTATION_FAMILIES.has(b);
        if (ra !== rb)
            return ra ? -1 : 1;
        return a < b ? -1 : a > b ? 1 : 0;
    });
    if (beds.length === 1)
        return timeSteering(empty, families, states[0], data, plantingYear);
    return spaceSteering(empty, families, states, data, plantingYear);
}
function spaceSteering(base, families, states, data, plantingYear) {
    const grid = families.map((f) => ({
        family: f,
        isRotation: ROTATION_FAMILIES.has(f),
        cells: states.map((st) => {
            const held = st.heldByYear.get(plantingYear).has(f);
            return { bed: st.name, clear: !held, heldUntil: held ? firstClearYear(st, f, plantingYear) : null, here: st.here.has(f) };
        }),
    }));
    const clearBedsOf = (f) => states.filter((st) => !st.heldByYear.get(plantingYear).has(f)).map((st) => st.name);
    // A bed is a family's SOLE HOME when it is the one and only bed open to that rotation family.
    const soleHome = new Map(); // bed name -> families whose only open bed is this one
    const clearOf = new Map();
    for (const f of families) {
        if (!ROTATION_FAMILIES.has(f))
            continue;
        const cb = clearBedsOf(f);
        clearOf.set(f, cb);
        if (cb.length === 1)
            soleHome.set(cb[0], [...(soleHome.get(cb[0]) ?? []), f]);
    }
    const moves = families.map((f) => {
        const hereBeds = states.filter((st) => st.here.has(f)).map((st) => st.name);
        if (!ROTATION_FAMILIES.has(f)) {
            return { family: f, isRotation: false, hereBeds, clearBeds: states.map((s) => s.name), kind: "unconstrained",
                suggestBeds: states.map((s) => s.name), contestedBeds: [], collisionWith: [], earliestClearYear: null, breakFamilies: [] };
        }
        const clearBeds = clearOf.get(f);
        if (clearBeds.length === 0) {
            // Refused: no bed open. Earliest opening + the engine's own break advice (R-013).
            let earliest = null;
            for (const st of states) {
                const y = firstClearYear(st, f, plantingYear);
                if (y !== null && (earliest === null || y < earliest))
                    earliest = y;
            }
            const thin = states[0];
            return { family: f, isRotation: true, hereBeds, clearBeds, kind: "refused", suggestBeds: [], contestedBeds: [],
                collisionWith: [], earliestClearYear: earliest, breakFamilies: breakAdviceAt({ ...data.site }, thin.history, plantingYear, data.bundle) };
        }
        if (clearBeds.length === 1) {
            const bed = clearBeds[0];
            const collisionWith = (soleHome.get(bed) ?? []).filter((g) => g !== f);
            return { family: f, isRotation: true, hereBeds, clearBeds, kind: "forced", suggestBeds: [bed], contestedBeds: [],
                collisionWith, earliestClearYear: null, breakFamilies: [] };
        }
        // Free choice: >= 2 beds fit equally. If some of them are ANOTHER family's only home, steer off
        // those (a reasoned suggestion, not a fabricated ranking): the preferred set is unranked among
        // itself, and if steering off leaves nothing, the beds stay a plain equal choice.
        const contestedBeds = clearBeds.filter((bed) => (soleHome.get(bed) ?? []).some((g) => g !== f));
        const preferred = clearBeds.filter((bed) => !contestedBeds.includes(bed));
        return { family: f, isRotation: true, hereBeds, clearBeds, kind: "free",
            suggestBeds: preferred.length ? preferred : clearBeds, contestedBeds, collisionWith: [], earliestClearYear: null, breakFamilies: [] };
    });
    return { ...base, mode: "space", beds: states.map((s) => s.name), grid, moves };
}
function timeSteering(base, families, st, data, plantingYear) {
    const years = [plantingYear, plantingYear + 1, plantingYear + 2];
    const grid = families.map((f) => ({
        family: f, isRotation: ROTATION_FAMILIES.has(f),
        cells: years.map((y) => ({ bed: st.name, clear: !st.heldByYear.get(y).has(f), heldUntil: null, here: false })),
    }));
    const timeline = families.map((f) => ({
        family: f, isRotation: ROTATION_FAMILIES.has(f),
        heldByYear: years.map((y) => st.heldByYear.get(y).has(f)),
        clearYear: ROTATION_FAMILIES.has(f) ? firstClearYear(st, f, plantingYear) : plantingYear,
    }));
    return { ...base, mode: "time", years, grid, timeline, breakFamilies: breakAdviceAt({ ...data.site }, st.history, plantingYear, data.bundle) };
}
// ------------------------------------------------------------------ render (preact via ui.js) ---
const famList = (fams) => {
    const names = fams.map(familyName);
    if (names.length <= 1)
        return names.join("");
    if (names.length === 2)
        return `${names[0]} or ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
};
const bedList = (beds) => {
    if (beds.length <= 1)
        return beds.join("");
    if (beds.length === 2)
        return `${beds[0]} or ${beds[1]}`;
    return `${beds.slice(0, -1).join(", ")} or ${beds[beds.length - 1]}`;
};
function grid(s) {
    const cols = s.mode === "time" ? s.years.map(String) : s.beds;
    return html `<div class="steer-scroll">
    <table class="steer-grid">
      <thead><tr><th>family</th>${cols.map((c) => html `<th key=${c}>${c}</th>`)}</tr></thead>
      <tbody>
        ${s.grid.map((row) => html `<tr key=${row.family}>
          <td class="fam">${familyName(row.family)}</td>
          ${row.cells.map((c, i) => html `<td key=${i} class=${c.here ? "here" : ""}>
            <span class=${"cell " + (c.clear ? "sclear" : "sheld")}>${c.clear ? "clear" : (c.heldUntil ?? "held")}</span>
          </td>`)}
        </tr>`)}
      </tbody>
    </table>
  </div>`;
}
function moveCard(m) {
    const fam = familyName(m.family);
    if (m.kind === "unconstrained") {
        return html `<div class="steer-move" key=${m.family}>
      <p class="m-head">${fam} — any bed <span class="m-tag">no rotation limit</span></p>
      <p>Carries none of the big-three soilborne pressure, so it is the break crop — drop it wherever
        the plan leaves ground open.</p>
    </div>`;
    }
    if (m.kind === "forced") {
        const bed = m.suggestBeds[0];
        const collide = m.collisionWith.length
            ? html ` Both ${fam} and ${famList(m.collisionWith)} can only go to ${bed}; the bed can hold more
          than one family if it has room, otherwise one waits a year.`
            : "";
        return html `<div class="steer-move forced" key=${m.family}>
      <p class="m-head">${fam} → ${bed} <span class="m-tag">only clear bed</span></p>
      <p>Every other bed held ${fam} within its interval — <b>${bed} is the one ground open to it
        next year</b>, so this move is forced, not a preference.${collide}</p>
    </div>`;
    }
    if (m.kind === "free") {
        const off = m.contestedBeds.length
            ? html ` ${bedList(m.suggestBeds)} ${m.suggestBeds.length > 1 ? "are" : "is"} suggested only
          because ${bedList(m.contestedBeds)} ${m.contestedBeds.length > 1 ? "are" : "is"} the only
          home left to another family — the rules rank none of these beds.`
            : html ` The rules rank none of them; choose by sun, reach or convenience.`;
        return html `<div class="steer-move free" key=${m.family}>
      <p class="m-head">${fam} → ${bedList(m.suggestBeds)} <span class="m-tag">${m.clearBeds.length} beds fit</span></p>
      <p><b>${bedList(m.clearBeds)} all satisfy the ${fam} rotation.</b>${off}</p>
    </div>`;
    }
    // refused
    const wait = m.earliestClearYear ? ` or wait — ground opens in ${m.earliestClearYear}` : "";
    const brk = m.breakFamilies.length ? `a ${famList(m.breakFamilies)} break` : "a break crop";
    return html `<div class="steer-move refused" key=${m.family}>
    <p class="m-head">${fam} → no clear bed this year <span class="m-tag">held everywhere</span></p>
    <p>Every bed is still inside the ${fam} interval. Plant ${brk} where it grew and hold ${fam} a
      year${wait}.</p>
  </div>`;
}
function timeCards(s) {
    const rot = s.timeline.filter((t) => t.isRotation);
    const openNow = s.timeline.filter((t) => !t.isRotation || (t.clearYear !== null && t.clearYear <= s.plantingYear));
    const brk = s.breakFamilies.length ? `a ${famList(s.breakFamilies)} break` : "a break crop";
    const headline = openNow.length
        ? html `<b>${famList(openNow.map((t) => t.family))} ${openNow.length > 1 ? "are" : "is"} open now</b>, and ${brk} breaks the held cycles while the ground rests.`
        : html `Nothing you grew is clear yet — plant ${brk}, which breaks every held cycle while the ground rests.`;
    // Later years: when each still-held rotation family returns.
    const later = rot.filter((t) => t.clearYear !== null && t.clearYear > s.plantingYear)
        .sort((a, b) => (a.clearYear - b.clearYear));
    const byYear = new Map();
    for (const t of later)
        byYear.set(t.clearYear, [...(byYear.get(t.clearYear) ?? []), t.family]);
    return html `<div class="steer-move forced">
      <p class="m-head">Next year: ${famList(openNow.map((t) => t.family)) || "a break crop"} <span class="m-tag">${s.plantingYear}</span></p>
      <p>${headline}</p>
    </div>
    ${[...byYear.entries()].map(([y, fams]) => html `<div class=${"steer-move " + (fams.length > 1 ? "free" : "")} key=${y}>
      <p class="m-head">${y}: ${famList(fams)} can return <span class="m-tag">interval ends</span></p>
      <p>${fams.length > 1 ? html `<b>Either family may come back; the rules rank none.</b> ` : ""}The ground reopens to ${famList(fams)} — plan ${fams.length > 1 ? "them" : "it"} for that year or after.</p>
    </div>`)}`;
}
/** The plot-wide steer, rendered above the per-bed cards. Returns null when there is nothing to
 *  steer (no beds, or no rotation-relevant crops in play), so the section falls back to per-bed. */
export function steeringBlock(data, season) {
    const s = computeSteering(data, season);
    if (s.mode === "none")
        return null;
    if (s.mode === "time") {
        return html `<div class="steer">
      <p class="steer-legend">Rotating in time · your one bed</p>
      ${timeCards(s)}
      <p class="steer-legend">The same grid, with years for columns</p>
      ${grid(s)}
      <p class="steer-key">One bed means rotation happens across seasons instead of across ground —
        same engine, same intervals, the axis is time.</p>
    </div>`;
    }
    return html `<div class="steer">
    <p class="steer-legend">Where things move · planting year ${s.plantingYear}</p>
    ${s.moves.map((m) => moveCard(m))}
    <p class="steer-legend">The ground each move reads from</p>
    ${grid(s)}
    <p class="steer-key">Every cell is the rotation engine's own answer for that bed — clear, or the
      year the family's interval ends. Nothing here is invented; the moves above just read the grid.</p>
  </div>`;
}
