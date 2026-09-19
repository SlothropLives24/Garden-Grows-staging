import { cardRows } from "./plantcard.js";
import { CONFIDENCE } from "./display-vocab.gen.js";
export function gradeWord(grade) {
    return CONFIDENCE[(grade ?? "").trim().toUpperCase()]?.word ?? null;
}
const s = (v) => (v == null ? null : String(v));
const nn = (v) => (v ? String(v) : null);
function teamDossier(g) {
    const mech = (m) => {
        const grade = (String(m.grade ?? "").trim().toUpperCase()) || null;
        return { claim: m.claim || "", grade, gradeWord: gradeWord(grade), rule: nn(m.rule), role: nn(m.role) };
    };
    const role = (r) => ({
        id: s(r.id), canonical: nn(r.canonical), canonicalGroup: nn(r.canonical_group),
        alternative: nn(r.alternative), alternatives: (r.alternatives ?? []).slice(),
        alternativeCost: nn(r.alternative_cost), costTags: (r.cost_tags ?? []).map(String),
    });
    const mechs = (g.mechanisms ?? []).map(mech);
    const roles = (g.roles ?? []).map(role);
    const fr = g.footprint_reason;
    const beliefs = (g.surfaces_beliefs ?? []).map(String);
    const ordered = [];
    for (const m of mechs)
        if (m.rule)
            ordered.push(m.rule);
    for (const gt of (g.gates ?? []))
        ordered.push(String(gt));
    if (typeof fr === "string" && /^R-\d/.test(fr))
        ordered.push(fr);
    const seen = new Set();
    const ruleEdges = ordered.filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
    return {
        kind: "team",
        id: s(g.id),
        common: (g.common ?? []).map(String),
        guildClass: nn(g.guild_class),
        provenance: nn(g.provenance),
        honestyNote: nn(g.honesty_note),
        plantingSource: nn(g.planting_source),
        derivedFrom: nn(g.derived_from),
        footprintMinM2: g.footprint_min_m2 ?? null,
        footprintReason: typeof fr === "string" ? fr : null,
        mechanisms: mechs,
        roles,
        edges: { rules: ruleEdges, beliefs },
    };
}
function beliefDossier(b) {
    const ev = b.evidence ?? {};
    const grade = (String(b.grade ?? "").trim().toUpperCase()) || null;
    const threads = (b.see_also ?? []).map(String).filter((x) => x.startsWith("R-"));
    return {
        kind: "belief",
        id: String(b.id ?? ""),
        claim: b.belief || String(b.id ?? "") || "",
        grade,
        gradeWord: gradeWord(grade),
        response: s(b.response),
        what_is_true: s(b.what_is_true),
        see_also: threads,
        evidence: { status: s(ev.status), pointers: (ev.pointers ?? []).map(String) },
    };
}
function ruleDossier(r) {
    const ev = r.evidence ?? {};
    const grade = (String(r.grade ?? "").trim().toUpperCase()) || null;
    return {
        kind: "rule",
        id: r.id,
        claim: r.claim || r.claim_refuted || "",
        grade,
        gradeWord: gradeWord(grade),
        severity: s(r.severity),
        ruling: s(r.ruling),
        mechanism: s(r.mechanism),
        what_is_true: s(r.what_is_true),
        scope_note: s(r.scope_note),
        effect_size: s(r.effect_size),
        response: r.audience !== "engine" ? s(r.response) : null,
        remedy: s(r.remedy),
        evidence: { status: s(ev.status), pointers: (ev.pointers ?? []).map(String) },
    };
}
function speciesFieldDossier(speciesId, field, group, bundle) {
    const sp = bundle.species.find((x) => x.id === speciesId);
    if (!sp)
        return null;
    const rec = { ...sp };
    if (group) {
        const groups = sp.cultivar_groups ?? [];
        const g = groups.find((x) => x.id === group);
        if (!g)
            return null;
        for (const [k, v] of Object.entries(g))
            if (k !== "id")
                rec[k] = v;
    }
    const row = cardRows(rec).find((r) => r.key === field);
    if (!row)
        return null;
    return {
        kind: "species-field",
        id: speciesId,
        species: speciesId,
        group: group || null,
        field,
        label: row.label,
        unit: row.unit,
        value: row.value,
        valueKind: row.kind,
        tier: row.soft,
        sources: [...row.sources],
    };
}
export function resolveDossier(kind, id, bundle, field, group) {
    if (kind === "rule") {
        const r = bundle.rules.find((x) => x.id === id);
        return r ? ruleDossier(r) : null;
    }
    if (kind === "belief") {
        const b = (bundle.beliefs ?? []).find((x) => String(x.id) === id);
        return b ? beliefDossier(b) : null;
    }
    if (kind === "team") {
        const g = (bundle.guilds ?? []).find((x) => x.id === id);
        return g ? teamDossier(g) : null;
    }
    if (kind === "species" && field) {
        return speciesFieldDossier(id, field, group ?? null, bundle);
    }
    return null;
}
