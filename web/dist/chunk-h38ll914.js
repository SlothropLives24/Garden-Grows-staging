import './chunk-lutet8cz.js';
import { rulesForSpecies } from './chunk-h8sxf1mq.js';
import { copy } from './paint.js';

function foldText(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ");
}
const byRules = (ids, bundle) => (sp) => rulesForSpecies(String(sp.id), null, bundle).some((r) => ids.includes(r.id));
function symptoms(bundle) {
    return [
        { id: "blossom-end-rot", label: copy.syBlossomEndRot, rules: ["R-104"],
            crops: (sp) => sp.ber_susceptible === true,
            says: ["blossom end", "blossom-end", "bottom rot", "black bottom", "bottoms are black", "bottoms black", "rotten bottom", "rotting on the bottom"],
            saysEs: ["pudrición apical", "podredumbre apical", "culo negro", "fondo negro", "punta negra", "podridos por abajo", "necrosis apical"] },
        { id: "little-fruit", label: copy.syLittleFruit, rules: ["R-030", "R-160", "R-124"],
            crops: byRules(["R-030", "R-160", "R-124"], bundle),
            says: ["no fruit", "not setting", "won't set", "flowers dropping", "flowers falling", "blossoms dropping", "blossoms falling", "blossom drop", "flower drop"],
            saysEs: ["sin fruto", "no cuaja", "no cuajan", "se caen las flores", "caída de flores", "flores caídas", "no da fruto", "no dan fruto"] },
        { id: "heat-bolting", label: copy.syHeatBolting, rules: ["R-172", "R-156"],
            crops: (sp) => byRules(["R-172"], bundle)(sp) || (!!sp.bolt_risk && sp.light_min === "part_sun"),
            says: ["bolting", "bolted", "going to seed", "gone to seed", "went to seed"],
            saysEs: ["se espigó", "se espigaron", "espigado", "espigada", "se subió", "se fue en flor", "se va a semilla", "se fue a semilla", "floreció antes de tiempo"] },
        { id: "buttoning", label: copy.syButtoning, rules: ["R-116"],
            crops: byRules(["R-116"], bundle),
            says: ["buttoning", "buttoned", "tiny head", "small head", "no head", "tiny heads"],
            saysEs: ["cabeza pequeña", "cabezas pequeñas", "sin cabeza", "cabecita", "no forma cabeza"] },
        { id: "damping-off", label: copy.syDampingOff, rules: ["R-114"], crops: null,
            says: ["damping", "damped off", "keeled over", "fell over", "collapsed at the soil", "seedlings collapsed", "seedlings died"],
            saysEs: ["mal del talluelo", "damping off", "se doblan las plántulas", "se cayeron las plántulas", "plántulas caídas", "plántulas muertas", "se murieron las plántulas"] },
        { id: "cut-off", label: copy.syCutOff, rules: ["R-118"], crops: null,
            says: ["cut off at", "cutworm", "chopped off", "severed", "cut clean off"],
            saysEs: ["cortadas al ras", "cortado al ras", "gusano cortador", "cortadas por la base", "cortados por la base"] },
        { id: "aphids", label: copy.syAphids, rules: ["R-165"], crops: null,
            says: ["aphid", "greenfly", "blackfly", "greenflies", "blackflies"],
            saysEs: ["pulgón", "pulgones", "áfidos", "áfido"] },
        { id: "not-up", label: copy.syNotUp, rules: ["R-161", "R-113"], crops: null,
            says: ["didn't come up", "did not come up", "never came up", "not come up", "haven't come up", "no germination", "didn't germinate", "did not germinate", "came up patchy", "patchy germination"],
            saysEs: ["no germinó", "no germinaron", "no nació", "no nacieron", "no salió", "no salieron", "sin germinar", "germinación desigual", "nacieron desparejo", "no brotaron", "no brotó"] },
        { id: "small-roots", label: copy.sySmallRoots, rules: ["R-117"],
            crops: byRules(["R-117"], bundle),
            says: ["twisted carrot", "carrots twisted", "tangled roots", "small carrot", "carrots are small", "forked carrot"],
            saysEs: ["zanahorias torcidas", "zanahoria torcida", "zanahorias bifurcadas", "zanahoria bifurcada", "raíces enredadas", "zanahorias pequeñas", "zanahoria pequeña"] },
        { id: "green-potatoes", label: copy.syGreenPotatoes, rules: ["R-119"],
            crops: byRules(["R-119"], bundle),
            says: ["green potato", "potatoes are green", "potatoes turned green", "green tuber", "potatoes green"],
            saysEs: ["papas verdes", "papa verde", "patatas verdes", "patata verde", "se pusieron verdes las papas"] },
        { id: "potato-scab", label: copy.syPotatoScab, rules: ["R-145"],
            crops: byRules(["R-145"], bundle),
            says: ["potato scab", "scabby potato", "scab on the potato", "scab on potato", "potatoes are scabby", "potatoes have scab"],
            saysEs: ["sarna de la papa", "sarna de la patata", "papas con sarna", "patatas con sarna", "sarna"] },
        { id: "basil-collapse", label: copy.syBasilCollapse, rules: ["R-159"],
            crops: byRules(["R-159"], bundle),
            says: ["basil wilt", "basil wilted", "basil collapsed", "basil died", "basil is dying", "basil keeled"],
            saysEs: ["albahaca marchita", "albahaca se marchitó", "albahaca murió", "albahaca se murió", "albahaca caída", "albahaca se cayó"] },
        { id: "blueberry-yellow", label: copy.syBlueberryYellow, rules: ["R-132"],
            crops: byRules(["R-132"], bundle),
            says: ["yellow between the veins", "yellowing between the veins", "yellow between veins", "interveinal"],
            saysEs: ["amarillo entre las venas", "amarillas entre las venas", "amarillo entre venas", "clorosis", "intervenal"] },
        { id: "powdery-mildew", label: copy.syPowderyMildew, rules: ["R-164"],
            crops: byRules(["R-164"], bundle),
            says: ["powdery mildew", "white powder", "powdery spots", "powdery leaves", "white powdery"],
            saysEs: ["oídio", "mildiu polvoriento", "polvo blanco", "manchas blancas polvorientas", "hojas con polvo blanco", "cenicilla"] },
        { id: "early-blight", label: copy.syEarlyBlight, rules: ["R-166"],
            crops: byRules(["R-166"], bundle),
            says: ["early blight", "target spot", "spots with rings", "ringed spots", "rings on the leaves"],
            saysEs: ["tizón temprano", "alternaria", "manchas con anillos", "anillos en las hojas", "manchas concéntricas"] },
        { id: "vine-borer", label: copy.syVineBorer, rules: ["R-167"],
            crops: byRules(["R-167"], bundle),
            says: ["vine borer", "squash vine borer", "sawdust", "frass", "squash wilted", "squash suddenly wilted", "vine suddenly wilted"],
            saysEs: ["barrenador", "barrenador de la calabaza", "aserrín", "calabaza marchita", "calabaza se marchitó", "guía marchita"] },
        { id: "yellow-lower-leaves", label: copy.syYellowLowerLeaves, rules: ["R-168"],
            crops: byRules(["R-168"], bundle),
            says: ["lower leaves yellow", "leaves turning yellow", "leaves are yellowing", "yellowing leaves", "leaves yellowing", "yellow lower leaves"],
            saysEs: ["hojas de abajo amarillas", "hojas inferiores amarillas", "hojas amarillas", "se amarillean las hojas", "hojas amarilleando", "se ponen amarillas las hojas"] },
        { id: "cabbageworm", label: copy.syCabbageworm, rules: ["R-169"],
            crops: byRules(["R-169"], bundle),
            says: ["cabbageworm", "cabbage worm", "cabbage white", "green caterpillar", "green caterpillars"],
            saysEs: ["gusano de la col", "gusanos de la col", "mariposa blanca", "mariposa de la col", "oruga verde", "orugas verdes"] },
        { id: "clubroot", label: copy.syClubroot, rules: ["R-146"],
            crops: byRules(["R-146"], bundle),
            says: ["clubroot", "club root"],
            saysEs: ["hernia de la col", "hernia de las crucíferas", "potra"] },
        { id: "potato-volunteers", label: copy.syPotatoVolunteers, rules: ["R-152"],
            crops: byRules(["R-152"], bundle),
            says: ["volunteer potato", "volunteer potatoes", "late blight"],
            saysEs: ["papas voluntarias", "papa voluntaria", "patatas voluntarias", "tizón tardío", "mildiu de la papa", "mildiu de la patata"] },
        { id: "fire-blight", label: copy.syFireBlight, rules: ["R-153"],
            crops: byRules(["R-153"], bundle),
            says: ["fire blight", "fireblight"],
            saysEs: ["fuego bacteriano", "tizón de fuego"] },
        { id: "brown-rot", label: copy.syBrownRot, rules: ["R-154"],
            crops: byRules(["R-154"], bundle),
            says: ["brown rot", "mummies", "mummified", "shriveled fruit", "shrivelled fruit"],
            saysEs: ["podredumbre parda", "pudrición parda", "monilia", "frutos momificados", "fruta momificada", "fruta arrugada", "frutos arrugados"] },
        { id: "bramble-mosaic", label: copy.syBrambleMosaic, rules: ["R-157"],
            crops: byRules(["R-157"], bundle),
            says: ["mosaic"],
            saysEs: ["mosaico"] },
        { id: "tree-replant", label: copy.syTreeReplant, rules: ["R-158"],
            crops: byRules(["R-158"], bundle),
            says: ["replant", "where the old tree", "where an old tree"],
            saysEs: ["replantar", "donde estaba el árbol viejo", "donde había un árbol viejo", "replante"] },
    ];
}
const speciesOf = (bundle, sid) => bundle.species.find((s) => s.id === sid);
function symptomFits(s, sid, bundle) {
    if (!s.crops)
        return true;
    const sp = speciesOf(bundle, sid);
    return !!sp && s.crops(sp);
}
function symptomsFor(bundle, growing) {
    const all = symptoms(bundle);
    if (!growing.length)
        return all;
    const mine = all.filter((s) => s.crops && growing.some((sid) => symptomFits(s, sid, bundle)));
    return [...mine, ...all.filter((s) => !s.crops)];
}
function answerRules(s, sid, bundle) {
    const out = [];
    const fits = sid ? new Set(rulesForSpecies(sid, null, bundle).map((r) => r.id)) : null;
    for (const id of s.rules) {
        const r = bundle.rules.find((x) => x.id === id);
        if (!r || r.evidence?.status !== "verified")
            continue;
        const scoped = !!r.applies_to;
        if (fits && scoped && !fits.has(id))
            continue;
        out.push(r);
    }
    return out;
}
function symptomInNote(bundle, note) {
    const t = ` ${foldText(note).trim()} `;
    if (t.trim().length < 4)
        return null;
    return symptoms(bundle).find((s) => [...s.says, ...s.saysEs].some((p) => t.includes(foldText(p).trim()))) ?? null;
}

export { answerRules, foldText, symptomFits, symptomInNote, symptoms, symptomsFor };
