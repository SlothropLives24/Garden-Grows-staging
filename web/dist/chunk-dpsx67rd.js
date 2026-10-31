import './chunk-lutet8cz.js';
import { familyInProse, appLang, fillCopy, familiesPlural } from './paint.js';

function heldFamiliesLine(fams, many, one) {
    const words = fams.map(familyInProse).map((n) => appLang() !== "es" && /\bfamily$/.test(n) ? `the ${n}` : n);
    const named = words.length > 1 ? fillCopy("nsJoinAnd", { a: words.slice(0, -1).join(", "), b: words[words.length - 1] }) : (words[0] ?? "");
    const t = fillCopy(familiesPlural(fams) ? many : one, { families: named });
    return t.charAt(0).toUpperCase() + t.slice(1);
}

export { heldFamiliesLine };
