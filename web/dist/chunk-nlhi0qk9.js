function mergeProvenance(bundle, prov) {
    for (const sp of bundle.species) {
        const id = String(sp.id);
        const src = prov.species?.[id];
        if (src)
            sp.confidence = { ...(sp.confidence ?? {}), sources: src };
        for (const g of sp.cultivar_groups ?? []) {
            const gs = prov.groups?.[`${id}/${String(g.id)}`];
            if (gs)
                g.confidence = { ...(g.confidence ?? {}), sources: gs };
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

export { ensureProvenance, provenanceReady };
