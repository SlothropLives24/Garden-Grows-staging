import './chunk-lutet8cz.js';
import { humanize, fillCopy, copy, stripRuleCitations } from './paint.js';
import { corpusText } from './core.js';

function invasiveNote(bundle, species) {
    const sp = bundle.species
        ?.find((s) => s.id === species);
    const inv = sp?.invasive_status;
    if (!inv)
        return null;
    const where = (inv.regions ?? []).map((rg) => /^[A-Za-z]{2}$/.test(rg) ? rg.toUpperCase() : humanize(rg));
    const shown = where.length ? corpusText(species, "invasive_regions", where.join(", ")) : "";
    const note = corpusText(species, "invasive_note", (inv.note ?? "").trim()).trim();
    const head = shown ? fillCopy("plInvasiveIn", { where: shown }) : copy.plInvasive;
    return `${head}${note ? ` - ${stripRuleCitations(note)}` : ""} ${copy.plInvasiveCheck}`;
}

export { invasiveNote };
