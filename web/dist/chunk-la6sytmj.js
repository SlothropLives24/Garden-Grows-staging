import './chunk-d7aiu626.js';
import { fillCopy, copy } from './paint.js';
import { fmtAreaApart, firstClause, seed } from './core.js';

const UNFIT = { space: "clUnfitSpace", shape: "clUnfitShape", mound: "clUnfitMound", ground: "clUnfitGround" };
function unfitLine(u) {
    const [needs, has] = fmtAreaApart(u.needs, u.has);
    const head = fillCopy(UNFIT[u.cause], { team: u.team, bed: u.bed, needs, has });
    return `${head} ${u.offer ? fillCopy("clUnfitOffer", { offer: u.offer.name }) : copy.clUnfitPick}`;
}
function unfitSeed(lines, go, gardens = null) {
    const { head, rest } = firstClause(lines[0] ?? "");
    const named = (i, text) => (gardens?.[i] ? `${gardens[i]} - ${text}` : text);
    const p = document.createElement("p");
    p.className = "unfit-rest";
    p.textContent = [rest, ...lines.slice(1).map((l, i) => named(i + 1, l))].filter(Boolean).join(" ");
    return seed({ summary: named(0, head), cls: "unfit" }, ...(p.textContent ? [p] : []), go);
}

export { unfitLine, unfitSeed };
