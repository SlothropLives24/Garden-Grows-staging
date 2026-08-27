// Compiler (C3) - the §6.2 enumerator (instantiate: each guild role resolved into priced,
// filterable options, every rejection citing its rule) and the §6.3 inversion (eligible_species:
// what THIS ground can grow, given what it carried). A line-for-line port of engine/compiler.py
// (+ the resolve() cultivar-group overlay from engine/dispatch.py and the site matcher from
// engine/climate.py). DOM-free and dependency-free, like everything in engine/.
//
// THE CONTRACT: web/conformance.mjs deep-compares this module's full JSON output against the
// Python oracle (web/testdata/compiler.golden.json, frozen by engine/gen_web_conformance.py).
// That includes human-readable reason strings, so the pyRepr/pyStr/gFmt helpers below reproduce
// Python's f-string formatting byte-for-byte. Do not "improve" a string here without changing the
// Python side first and regenerating the golden - a lone edit is a red build, by design.
import { matchSite, resolveZone } from "./intake.js";
const ROTATION_RULES = new Set(["R-010", "R-011", "R-012"]);
const FAMILY_ROTATION_RULE = {
    solanaceae: "R-010",
    cucurbitaceae: "R-011",
    brassicaceae: "R-012",
};
// The rule's interval floor in years (ISSUES#5 B). The Python oracle reads these from each rule's
// trigger in the corpus; this mirror hardcodes them like FAMILY_ROTATION_RULE above. If a corpus
// interval changes and this map is not updated, the eligibility golden (generated from the
// corpus-reading Python) diverges and conformance goes red - the drift is caught, not silent.
const FAMILY_ROTATION_YEARS = {
    solanaceae: 3,
    cucurbitaceae: 3,
    brassicaceae: 4,
};
const cxCache = new WeakMap();
function cx(bundle) {
    let c = cxCache.get(bundle);
    if (!c) {
        c = {
            species: new Map(bundle.species.map((s) => [s.id, s])),
            entities: new Map(bundle.entities.map((e) => [e.id, e])),
            guilds: new Map(bundle.guilds.map((g) => [g.id, g])),
        };
        cxCache.set(bundle, c);
    }
    return c;
}
// --- Python string formatting, reproduced --------------------------------------
function pyRepr(v) {
    if (v === null || v === undefined)
        return "None";
    if (v === true)
        return "True";
    if (v === false)
        return "False";
    if (typeof v === "string")
        return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    if (Array.isArray(v))
        return `[${v.map(pyRepr).join(", ")}]`;
    return String(v);
}
function pyStr(v) {
    if (v === null || v === undefined)
        return "None";
    if (v === true)
        return "True";
    if (v === false)
        return "False";
    if (Array.isArray(v))
        return pyRepr(v);
    return String(v);
}
// Python's f"{x:g}" - 6 significant digits, trailing zeros trimmed. Exported for solar.ts,
// whose fired-rule strings use the same formatting.
export function gFmt(n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15)
        return String(n);
    return String(parseFloat(n.toPrecision(6)));
}
// --- predicate matching (compiler.py §"predicate matching") --------------------
function num(v) {
    const x = Array.isArray(v) ? v[v.length - 1] : v;
    if (x === null || x === undefined || typeof x === "object")
        return null;
    if (typeof x === "boolean")
        return x ? 1 : 0; // Python float(True) == 1.0
    if (typeof x === "string" && x.trim() === "")
        return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
}
function pathGet(resolved, dotted) {
    let cur = resolved;
    for (const part of dotted.split(".")) {
        if (cur === null || typeof cur !== "object" || Array.isArray(cur))
            return undefined;
        cur = cur[part];
    }
    return cur;
}
/** Does the resolved species satisfy every clause of the predicate? Returns [ok, failures]. */
export function matches(resolved, predicate) {
    const fails = [];
    for (const [field, want] of Object.entries(predicate ?? {})) {
        const have = pathGet(resolved, field);
        if (want !== null && typeof want === "object" && !Array.isArray(want) && ("min" in want || "max" in want)) {
            const bound = want;
            const got = num(have); // compare the mature (max) value against the bound
            if (got === null) {
                fails.push(`${field} missing`);
                continue;
            }
            if (bound.min !== undefined && got < bound.min)
                fails.push(`${field} ${gFmt(got)} below min ${pyStr(bound.min)}`);
            if (bound.max !== undefined && got > bound.max)
                fails.push(`${field} ${gFmt(got)} above max ${pyStr(bound.max)}`);
        }
        else if (Array.isArray(want)) {
            if (!want.some((w) => w === have))
                fails.push(`${field} is ${pyRepr(have)}, need one of ${pyStr(want)}`);
        }
        else if (have !== want && !(have === undefined && want === null)) {
            fails.push(`${field} is ${pyRepr(have)}, need ${pyRepr(want)}`);
        }
    }
    return [fails.length === 0, fails];
}
// --- species resolution (dispatch.py resolve) -----------------------------------
/** Species fields with the chosen cultivar group overlaid; first listed group is the default. */
export function resolveSpecies(sid, group, bundle) {
    const c = cx(bundle);
    const sp = { ...(c.species.get(sid) ?? c.entities.get(sid) ?? {}) };
    const groups = sp.cultivar_groups;
    if (groups && groups.length) {
        const chosen = (group ? groups.find((g) => g.id === group) : undefined) ?? groups[0];
        for (const [k, v] of Object.entries(chosen))
            if (k !== "id")
                sp[k] = v;
        sp.cultivar_group = chosen.id;
    }
    return sp;
}
// --- the enumerator (§6.2) ------------------------------------------------------
const round4 = (x) => Math.round(x * 1e4) / 1e4;
// A filler's ground footprint in m² - the bounding square of its mature spread, the SAME spread²
// share-of-ground place.ts uses, with the same 30 cm floor. No spread (a trellis, a bulb) → 0.
// Port of compiler.py _species_footprint_m2.
function speciesFootprintM2(resolved) {
    const s = num(resolved.mature_spread_cm);
    if (s === null)
        return 0;
    const cm = Math.max(s, 30);
    return round4((cm / 100) ** 2);
}
// The footprint of a role's canonical filler - the baseline the guild's static footprint_min_m2
// already budgets. An alternative's space cost is measured against this. Port of
// compiler.py _role_canonical_footprint_m2.
function roleCanonicalFootprintM2(role, bundle) {
    if (!role.canonical)
        return 0;
    return speciesFootprintM2(resolveSpecies(role.canonical, role.canonical_group ?? null, bundle));
}
// --- rotation interval (ISSUES#5) - the port of dispatch.py's shared helpers ------------------
function parseYear(key) {
    // The yearless manual-override key ('recent') is not a year; only digit strings are.
    if (!/^-?\d+$/.test(key))
        return null;
    return parseInt(key, 10);
}
function historyFamilies(fams) {
    const out = [];
    for (const e of fams ?? []) {
        const [fam, load] = typeof e === "object" && e !== null ? [e.family, e.load ?? "full"] : [e, "full"];
        if (fam)
            out.push([fam, load === "full" || load === "partial" ? load : "full"]);
    }
    return out;
}
// Every family the ground ever carried, interval aside - only R-094's Verticillium reservoir uses
// this (microsclerotia persist ~10 years with no in-ground cure, so it is not interval-limited).
function everCarried(site) {
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return new Set();
    const out = new Set();
    for (const fams of Object.values(history))
        for (const [fam] of historyFamilies(fams))
            out.add(fam);
    return out;
}
export function currentPlantingYear(site) {
    // An explicit season_year (the open season's id), else the season after the most recent dated
    // bucket (max year + 1), else null.
    if (typeof site.season_year === "number" && Number.isInteger(site.season_year))
        return site.season_year;
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return null;
    const years = Object.keys(history)
        .map(parseYear)
        .filter((y) => y !== null);
    return years.length ? Math.max(...years) + 1 : null;
}
// A1: a partial deposit clears in a shorter interval - ceil(base/2), floored at 1; a full deposit
// uses the rule's own interval unchanged.
function effectiveInterval(baseYears, load) {
    return load === "partial" ? Math.max(1, Math.ceil(baseYears / 2)) : baseYears;
}
// B + C + A1: is `family` carried recently enough to still block? A yearless 'recent' bucket is
// always in-window (C1); a dated bucket blocks iff currentYear - year < the effective interval.
export function familyWithinInterval(site, family, baseYears) {
    const history = site.history;
    if (!history || typeof history !== "object" || Array.isArray(history))
        return false;
    const cur = currentPlantingYear(site);
    for (const [key, fams] of Object.entries(history)) {
        const year = parseYear(key);
        for (const [fam, load] of historyFamilies(fams)) {
            if (fam !== family)
                continue;
            if (year === null)
                return true; // 'recent': always in-window (C1)
            if (cur !== null && cur - year < effectiveInterval(baseYears, load))
                return true;
        }
    }
    return false;
}
function growingWindowDays(site, bundle) {
    const ffd = site.frost_free_days;
    if (ffd !== null && ffd !== undefined) {
        const n = num(ffd);
        return n === null ? null : Math.trunc(n);
    }
    if (site.lat == null || site.lon == null)
        return null;
    const best = matchSite(site.lat, site.lon, bundle);
    return best ? (best.growing_season_days_p50 ?? null) : null;
}
// The site's USDA hardiness zone: an explicit override if the plan carries one, else resolved
// nationwide from lat/lon - the nearest PHZM ZIP centroid's zone, or a bundled site's block out of
// that reach (D-051). Zone gates perennial winter survival (R-076) - a DIFFERENT quantity than the
// frost window (R-032); the app passes lat/lon. Port of compiler.py _hardiness_zone.
function hardinessZone(site, bundle) {
    const z = site.hardiness_zone ?? site.zone;
    if (z !== null && z !== undefined)
        return z;
    if (site.lat == null || site.lon == null)
        return null;
    const hz = resolveZone(site.lat, site.lon, bundle);
    const zone = hz ? hz.zone : undefined;
    return zone ?? null;
}
// Where the site's zone falls relative to a perennial's [lo, hi] band (R-076): "below" (too cold -
// the survival gate, the only end that refuses), "above" (warmer than the modelled ceiling - a
// cultivar's limit, advised not gated, ISSUES #13 option E), or "in". Null when either is missing.
// Port of dispatch._zone_side.
function zoneSide(band, zone) {
    if (!band || !band.length || zone === null || zone === undefined)
        return null;
    const lo = band[0], hi = band[band.length - 1];
    if (zone < lo)
        return "below";
    if (zone > hi)
        return "above";
    return "in";
}
// Non-gating cautions on an OFFERED candidate (R-076, ISSUES #13 option E): a zone above the
// modelled ceiling is offered, not refused, because the warm limit is a cultivar's answer - so the
// honest word is "look for a cultivar rated for your zone", never "this will not crop for you".
// Port of compiler.py _advisories.
export function advisories(resolved, site, bundle) {
    const out = [];
    const hz = resolved.hardiness_zone;
    const zone = hardinessZone(site, bundle);
    if (zoneSide(hz, zone) === "above") {
        out.push({
            rule: "R-076",
            why: `zone ${zone} is above the modelled ${hz[0]}-${hz[hz.length - 1]}; the warm limit is a `
                + `cultivar's, so look for one rated for your zone`,
        });
    }
    return out;
}
function rotationReasons(resolved, site) {
    const reasons = [];
    const fam = resolved.family;
    if (fam && fam in FAMILY_ROTATION_RULE) {
        const base = FAMILY_ROTATION_YEARS[fam];
        if (base !== undefined && familyWithinInterval(site, fam, base)) {
            reasons.push({ rule: FAMILY_ROTATION_RULE[fam], why: `ground carried ${fam}` });
        }
    }
    if (resolved.verticillium_susceptible) {
        // R-094 = coarse family signal (prior Solanaceae); R-095 = precise marker path (a logged
        // Verticillium host, catching Rosaceae hosts R-094 misses). Never double-fire (D-043).
        const famPresent = everCarried(site).has("solanaceae");
        if (famPresent) {
            reasons.push({ rule: "R-094", why: `Verticillium-susceptible; ground held Solanaceae` });
        }
        else if (site.verticillium_reservoir) {
            reasons.push({ rule: "R-095", why: `Verticillium-susceptible; ground held a logged Verticillium host` });
        }
    }
    return reasons;
}
export function ineligibility(resolved, role, site, bundle) {
    const reasons = [...rotationReasons(resolved, site)];
    const sid = resolved.id;
    if (sid && (role.excluded ?? []).includes(sid)) {
        reasons.push({ rule: role.exclusion_reason ?? null, why: `${sid} is excluded from this role` });
    }
    const windowDays = growingWindowDays(site, bundle);
    const dtm = num(resolved.days_to_maturity);
    if (windowDays !== null && dtm !== null && dtm > windowDays) {
        reasons.push({ rule: "R-032", why: `needs ${gFmt(dtm)} days to mature; window is ${windowDays}` });
    }
    if (resolved.light_min === "full_sun" && ![null, undefined, "full", "full_sun"].includes(site.sun)) {
        reasons.push({ rule: "R-005", why: `needs full sun; bed is ${pyStr(site.sun)}` });
    }
    const hz = resolved.hardiness_zone;
    const zone = hardinessZone(site, bundle);
    if (zoneSide(hz, zone) === "below") {
        // Only the COLD end gates (R-076, ISSUES #13 option E) — see compiler.py for why. A zone below
        // the floor is colder than the plant is winter-hardy to; the warm end is advised, not refused.
        reasons.push({
            rule: "R-076",
            why: `zone ${zone} is below the modelled ${hz[0]}-${hz[hz.length - 1]}; `
                + `colder than this plant is winter-hardy to`,
        });
    }
    return reasons;
}
export function candidates(role) {
    const out = [];
    if (role.canonical)
        out.push([role.canonical, role.canonical_group ?? null, "canonical"]);
    if (role.substitute)
        out.push([role.substitute, null, "substitute"]);
    if (role.alternative)
        out.push([role.alternative, null, "alternative"]);
    for (const a of role.alternatives ?? []) {
        // A bare id, or {species, group} to pin a cultivar group (D-047).
        if (typeof a === "string")
            out.push([a, null, "alternative"]);
        else
            out.push([a.species, a.group ?? null, "alternative"]);
    }
    return out;
}
/** One role, resolved against the site - every candidate with its eligibility and price. */
export function resolveRole(role, site, bundle) {
    const predicate = role.predicate ?? {};
    const canonicalFp = roleCanonicalFootprintM2(role, bundle);
    const options = [];
    for (const [sid, group, kind] of candidates(role)) {
        const resolved = resolveSpecies(sid, group, bundle);
        const reasons = ineligibility(resolved, role, site, bundle);
        const advs = advisories(resolved, site, bundle);
        const fp = speciesFootprintM2(resolved);
        const opt = {
            filler: sid,
            group,
            kind,
            // advisories never affect `eligible` - a warm-zone perennial is OFFERED with a cultivar
            // caution (R-076, ISSUES #13 option E), not refused. Eligibility is `reasons.length === 0`.
            eligible: reasons.length === 0,
            reasons,
            advisories: advs,
            cost: kind === "substitute"
                ? (role.cost ?? null)
                : kind === "alternative"
                    ? (role.alternative_cost ?? null)
                    : null,
            cost_tags: kind === "alternative" ? (role.cost_tags ?? []) : [],
            // Space cost: own footprint, and the extra over the canonical the static minimum budgets.
            footprint_m2: fp,
            extra_footprint_m2: round4(Math.max(0, fp - canonicalFp)),
        };
        if (kind === "canonical" && Object.keys(predicate).length) {
            const [ok, fails] = matches(resolved, predicate);
            if (!ok)
                opt.predicate_mismatch = fails;
        }
        options.push(opt);
    }
    const chosen = options.find((o) => o.eligible)?.filler ?? null;
    return {
        role: role.id,
        predicate,
        optional: Boolean(role.optional),
        canonical: role.canonical ?? null,
        chosen,
        options,
    };
}
// The consistent-fillings cap (D-151). Named so the number appears once and the decision that fixes
// it is findable from the code.
const FILLINGS_CAP = 24;
/** §6.2: every role of a guild resolved against a site, plus the consistent fillings.
 *
 *  THE CAP IS A PREFIX, NOT A SAMPLE (D-151): the enumeration varies the last role fastest, so the
 *  first 24 are every option of the trailing roles against only the first option of the leading ones.
 *  Nothing renders `fillings`, so the fix is honesty rather than a bigger cap — the true count travels
 *  with the list so no consumer can mistake a prefix for the whole space. */
export function instantiate(guildOrId, site, bundle) {
    const guild = typeof guildOrId === "string" ? cx(bundle).guilds.get(guildOrId) : guildOrId;
    const bed = site.bed_m2;
    const fmin = guild.footprint_min_m2;
    const fitsFootprint = bed === null || bed === undefined || fmin === null || fmin === undefined || fmin <= bed;
    const roles = (guild.roles ?? []).map((r) => resolveRole(r, site, bundle));
    let incomplete = false;
    const pools = [];
    for (const rr of roles) {
        const picks = rr.options.filter((o) => o.eligible);
        if (!picks.length) {
            if (!rr.optional) {
                incomplete = true;
                break;
            }
            continue;
        }
        pools.push(picks.map((o) => [rr.role, o.filler]));
    }
    const fillings = [];
    // The TRUE size of the space, computed without materialising it - that is the whole point.
    const total = incomplete ? 0 : (pools.length ? pools.reduce((n, p) => n * p.length, 1) : 0);
    if (!incomplete) {
        // cartesian product in role order, capped (mirrors itertools.islice(product, FILLINGS_CAP))
        const walk = (i, acc) => {
            if (fillings.length >= FILLINGS_CAP)
                return;
            if (i === pools.length) {
                fillings.push(Object.fromEntries(acc));
                return;
            }
            for (const pair of pools[i]) {
                if (fillings.length >= FILLINGS_CAP)
                    return;
                walk(i + 1, [...acc, pair]);
            }
        };
        walk(0, []);
    }
    // The card's fit gate stays on the static minimum (it budgets the canonical team, D-052). A
    // bigger alternative's extra footprint is charged and surfaced per-pick in substitutionVerdict
    // (effective_footprint_min_m2 / footprint_exceeds_bed), not as a worst-case aggregate here.
    return {
        guild: guild.id,
        fits_footprint: fitsFootprint,
        footprint_min_m2: fmin ?? null,
        footprint_reason: guild.footprint_reason ?? null,
        roles,
        fillings,
        fillings_total: total,
        fillings_truncated: total > fillings.length,
    };
}
/** One user-chosen filler for one guild role, against the predicate (mechanism) and site gates.
 *  "clean" = both pass; "adaptation" = site-eligible but the predicate fails (the role's mechanism
 *  is no longer guaranteed - an adaptation, not the guild); "blocked" = a site rule is violated.
 *  remediation is the role's own declared fillers that ARE clean here. `filler` may be a
 *  user-overlay species when the bundle has those merged in - substitution and the overlay compose. */
export function substitutionVerdict(guildOrId, roleId, filler, group, site, bundle) {
    const guild = typeof guildOrId === "string" ? cx(bundle).guilds.get(guildOrId) : guildOrId;
    const role = (guild.roles ?? []).find((r) => r.id === roleId);
    if (!role)
        throw new Error(`guild ${guild.id} has no role ${JSON.stringify(roleId)}`);
    const predicate = role.predicate ?? {};
    const resolved = resolveSpecies(filler, group, bundle);
    const [predicateOk, predicateFails] = matches(resolved, predicate);
    const siteReasons = ineligibility(resolved, role, site, bundle);
    const advs = advisories(resolved, site, bundle);
    const remediation = [];
    for (const [sid, g, kind] of candidates(role)) {
        if (sid === filler && g === group)
            continue;
        const rr = resolveSpecies(sid, g, bundle);
        const [rok] = matches(rr, predicate);
        if (rok && ineligibility(rr, role, site, bundle).length === 0) {
            remediation.push({ filler: sid, group: g, kind });
        }
    }
    // The guild mechanisms this role carries (corpus role: tags) - what an "adaptation" forfeits.
    const mechs = guild.mechanisms ?? [];
    const roleMechanisms = mechs
        .filter((m) => m.role === roleId)
        .map((m) => ({ claim: m.claim, grade: m.grade, rule: m.rule ?? null }));
    // Space cost of THIS pick: its footprint, the extra over the canonical, the guild minimum it
    // pushes to, and whether that still fits the bed. Port of compiler.py substitution_verdict.
    const fp = speciesFootprintM2(resolved);
    const canonicalFp = roleCanonicalFootprintM2(role, bundle);
    const extra = round4(Math.max(0, fp - canonicalFp));
    const fmin = guild.footprint_min_m2;
    const effectiveMin = fmin === null || fmin === undefined ? null : round4(fmin + extra);
    const bed = site.bed_m2;
    const footprintExceedsBed = bed !== null && bed !== undefined && effectiveMin !== null && effectiveMin > bed;
    const verdict = siteReasons.length ? "blocked" : (predicateOk ? "clean" : "adaptation");
    return {
        guild: guild.id, role: roleId, filler, group,
        canonical: role.canonical ?? null,
        predicate, predicate_ok: predicateOk, predicate_fails: predicateFails,
        site_reasons: siteReasons, advisories: advs, verdict, mechanism_risk: verdict === "adaptation",
        role_mechanisms: roleMechanisms,
        footprint_m2: fp, extra_footprint_m2: extra,
        effective_footprint_min_m2: effectiveMin, footprint_exceeds_bed: footprintExceedsBed,
        remediation,
    };
}
// R-013 (mirror of compiler.py _thin_break_suggestion): when the ground is still within the rotation
// interval for one or more of the big-three families, its eligibility is thin and an allium/apiaceous
// break is unrelated to all three. The break families are read from R-013's own trigger in the bundle
// (not hardcoded); the thin condition reuses familyWithinInterval, so it cannot drift from the block.
export function thinBreakSuggestion(site, bundle) {
    const rule = bundle.rules.find((r) => r.id === "R-013");
    if (!rule)
        return null;
    const blockedFams = Object.keys(FAMILY_ROTATION_RULE).filter((fam) => FAMILY_ROTATION_YEARS[fam] !== undefined && familyWithinInterval(site, fam, FAMILY_ROTATION_YEARS[fam]));
    if (!blockedFams.length)
        return null;
    const suggests = (rule.trigger?.suggests) ?? [];
    return {
        rule: "R-013",
        families: suggests,
        why: `ground is within the rotation interval for ${[...blockedFams].sort().join(", ")}; ` +
            `an allium or apiaceous crop is unrelated to all three and breaks the host cycle`,
    };
}
/** R-015 fires at last (O72, mirror of compiler.py prior_season_credit): the ground's PRIOR season
 *  carried the trigger's family (fabaceae), so residue mineralization is raising available N for
 *  THIS season's crop. Only the dated bucket at exactly year − 1 fires it — a yearless 'recent'
 *  bucket cannot say it was last season, and over-firing a credit would be the fertiliser chart
 *  with extra steps. Family and rule come from the bundle, never hardcoded. */
export function priorSeasonCredit(site, bundle) {
    const rule = bundle.rules.find((r) => r.id === "R-015");
    const history = site.history;
    if (!rule || !history || typeof history !== "object" || Array.isArray(history))
        return null;
    const cur = currentPlantingYear(site);
    const fam = rule.trigger?.family;
    if (cur === null || !fam)
        return null;
    for (const [key, fams] of Object.entries(history)) {
        if (parseYear(key) !== cur - 1)
            continue;
        if (historyFamilies(fams).some(([f]) => f === fam)) {
            return { rule: "R-015",
                why: `${fam} grew here in ${cur - 1}; residue mineralizes N for this season's crop` };
        }
    }
    return null;
}
/** §6.3: given the ground's rotation history, what can it grow now - and what is blocked, by which
 *  rule. When the ground is thin (a big-three family still within interval), R-013 advises a break. */
export function eligibleSpecies(site, bundle) {
    const c = cx(bundle);
    const eligible = [];
    const blocked = [];
    for (const sid of [...c.species.keys()].sort()) {
        const resolved = resolveSpecies(sid, null, bundle);
        const reasons = rotationReasons(resolved, site);
        if (reasons.length) {
            blocked.push({ species: sid, family: resolved.family ?? null, blocked_by: reasons });
        }
        else {
            eligible.push(sid);
        }
    }
    const sug = thinBreakSuggestion(site, bundle);
    return { eligible, blocked, suggestions: sug ? [sug] : [] };
}
// FAMILY_ROTATION_RULE is the single list of families the engine rotates on (and their interval
// rule ids). Exported so a plot-wide reader (steering.ts) enumerates exactly these families rather
// than re-hardcoding the set - keeping one source of truth for "which families rotate".
export { ROTATION_RULES, FAMILY_ROTATION_RULE };
