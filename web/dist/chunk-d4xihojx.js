import { corpusWantsEs, corpusEs } from './core.js';

function seeAlsoTip(bundle, rules) {
    const b = bundle.beliefs.find((x) => (x.see_also ?? []).some((r) => rules.includes(String(r))));
    if (!b)
        return undefined;
    const id = String(b.id);
    const q = (corpusWantsEs() && corpusEs(id, "belief")) || String(b.belief ?? id);
    return { id, q };
}

export { seeAlsoTip };
