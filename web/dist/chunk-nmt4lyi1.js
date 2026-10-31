import './chunk-lutet8cz.js';
import { fillCopy, copy } from './paint.js';
import { fmtAreaApart } from './core.js';

const UNFIT = { space: "clUnfitSpace", shape: "clUnfitShape", mound: "clUnfitMound", ground: "clUnfitGround" };
function unfitLine(u) {
    const [needs, has] = fmtAreaApart(u.needs, u.has);
    const head = fillCopy(UNFIT[u.cause], { team: u.team, bed: u.bed, needs, has });
    return `${head} ${u.offer ? fillCopy("clUnfitOffer", { offer: u.offer.name }) : copy.clUnfitPick}`;
}

export { unfitLine };
