import './chunk-d7aiu626.js';
import { copy, fillCopy, appLang, midSentence } from './paint.js';
import { displayName, commonName } from './core.js';
import { examplePlaceOf, exampleAnswerIsTheirs, EXAMPLE_HOME } from './chunk-bm4hdmsn.js';
import './chunk-lon4wgf3.js';

const EXAMPLE_MADE_KEY = "gg-example-made";
function readExampleMade() {
    try {
        const v = JSON.parse(localStorage.getItem(EXAMPLE_MADE_KEY) ?? "null");
        return v && typeof v.key === "string" ? v : null;
    }
    catch {
        return null;
    }
}
function keepExampleMade(m) {
    try {
        if (m)
            localStorage.setItem(EXAMPLE_MADE_KEY, JSON.stringify(m));
        else
            localStorage.removeItem(EXAMPLE_MADE_KEY);
    }
    catch { }
}
function exampleWhereLine(m, bundle, metric) {
    const size = metric ? copy.exBedSizeM : copy.exBedSizeFt;
    const home = EXAMPLE_HOME.label;
    if (m?.home === "noclimate")
        return fillCopy("exWhereNoClimate", { place: m.at, home });
    if (m?.home === "noload")
        return fillCopy("exWhereNoLoad", { place: m.at, home });
    if (!m || !m.given && !m.door || !m.team)
        return fillCopy("exWhereHome", { place: home });
    const teamName = (id) => {
        const g = bundle?.guilds.find((x) => x.id === id);
        return g ? displayName(g) : id;
    };
    const place = m.at, team = teamName(m.team), door = m.door;
    const cropName = (id) => { const n = bundle ? commonName(bundle, id) : id; return appLang() === "es" ? n : midSentence(n); };
    const lines = [];
    if (door?.outcome === "here" && door.kind === "guild")
        lines.push(fillCopy("exWhereAsked", { place, team, size }));
    else if (door?.outcome === "here")
        lines.push(fillCopy("exWhereCrop", { place, team, size, crop: cropName(door.id) }));
    else if (door?.outcome === "adapted")
        lines.push(fillCopy("exWhereAdapted", { place, team, size, asked: teamName(door.id) }));
    else {
        lines.push(fillCopy("exWherePick", { place, team, size }));
        if (door) {
            const asked = teamName(door.id), crop = door.kind === "crop" ? cropName(door.id) : "";
            const key = door.kind === "guild"
                ? { nofit: "exDoorNoFit", undated: "exDoorUndated", notthere: "exDoorNotThere" }[door.outcome]
                : { noteam: "exDoorNoTeam", undated: "exDoorCropUndated", notthere: "exDoorCropNotThere" }[door.outcome];
            if (key)
                lines.push(fillCopy(key, { asked, crop, size }));
        }
    }
    lines.push(m.dated === "warmth" ? copy.exSownWarm : copy.exSownFrost);
    lines.push(m.frosts ? copy.exWhereDiaryFrost : copy.exWhereDiary);
    return lines.join(" ");
}
const exampleStartLabel = (m, fromIt) => fromIt && m?.team ? copy.exampleStartFrom : copy.exampleStartOwn;

export { exampleAnswerIsTheirs, examplePlaceOf, exampleStartLabel, exampleWhereLine, keepExampleMade, readExampleMade };
