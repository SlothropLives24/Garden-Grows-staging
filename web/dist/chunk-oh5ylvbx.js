function mergeProvenance(bundle, prov) {
    for (const sp of bundle.species) {
        const id = String(sp.id);
        const src = prov.species?.[id];
        if (src)
            sp.confidence = { ...(sp.confidence ?? {}), sources: src };
        const cites = prov.cites?.species?.[id];
        if (cites)
            sp.confidence = { ...(sp.confidence ?? {}), cites };
        for (const g of sp.cultivar_groups ?? []) {
            const gs = prov.groups?.[`${id}/${String(g.id)}`];
            if (gs)
                g.confidence = { ...(g.confidence ?? {}), sources: gs };
            const gc = prov.cites?.groups?.[`${id}/${String(g.id)}`];
            if (gc)
                g.confidence = { ...(g.confidence ?? {}), cites: gc };
        }
    }
    for (const kind of ["rules", "beliefs"]) {
        const table = prov[kind] ?? {};
        for (const rec of bundle[kind]) {
            const ptrs = table[String(rec.id)];
            if (ptrs)
                rec.evidence = { ...(rec.evidence ?? {}), pointers: ptrs };
            for (const [field, value] of Object.entries(prov.notes?.[kind]?.[String(rec.id)] ?? {})) {
                if (field === "evidence.note")
                    rec.evidence = { ...(rec.evidence ?? {}), note: value };
                else
                    rec[field] = value;
            }
        }
    }
    return bundle;
}
function hasProvenance(bundle) {
    return bundle.species.some((s) => !!(s.confidence?.sources))
        || bundle.rules.some((r) => !!(r.evidence?.pointers));
}
function derivedCiteFor(bundle, speciesId, group, pointer) {
    const sp = bundle.species.find((x) => String(x.id) === speciesId);
    if (!sp)
        return null;
    const blocks = [sp.confidence];
    if (group)
        blocks.unshift((sp.cultivar_groups ?? []).find((g) => String(g.id) === group)?.confidence);
    for (const conf of blocks) {
        const src = (conf?.sources ?? {}), cites = (conf?.cites ?? {});
        for (const [field, ptrs] of Object.entries(src)) {
            if (!Array.isArray(ptrs))
                continue;
            const i = ptrs.map(String).indexOf(pointer);
            if (i >= 0) {
                const c = cites[field]?.[i] ?? null;
                return c && typeof c === "object" ? c : null;
            }
        }
    }
    return null;
}

const PROVENANCE_URL = "../build/provenance.json";
let _prov = null;
let _loading = null;
function load() {
    if (_prov)
        return Promise.resolve(_prov);
    if (!_loading) {
        _loading = fetch(PROVENANCE_URL)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
            .then((p) => { _prov = p; _loading = null; return p; });
    }
    return _loading;
}
function provenanceReady(bundle) {
    return hasProvenance(bundle);
}
async function ensureProvenance(bundle) {
    if (hasProvenance(bundle))
        return true;
    const p = await load();
    if (!p)
        return false;
    mergeProvenance(bundle, p);
    return true;
}

export { derivedCiteFor, ensureProvenance, provenanceReady };
