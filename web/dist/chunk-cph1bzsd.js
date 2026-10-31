import './chunk-lutet8cz.js';
import { copy, fillCopy } from './paint.js';

const weightOf = (s, sid) => (s?.plantings ?? [])
    .filter((p) => p.species === sid && typeof p.yield_kg === "number" && p.yield_kg > 0)
    .reduce((a, p) => a + p.yield_kg, 0);
function harvestByCrop(seasons, seasonId) {
    const season = seasons.find((s) => s.id === seasonId);
    const earlier = seasons.filter((s) => s.id < seasonId).sort((a, b) => b.id - a.id);
    const bySpecies = new Map();
    for (const p of season?.plantings ?? []) {
        if (typeof p.yield_kg !== "number" || !(p.yield_kg > 0))
            continue;
        const g = bySpecies.get(p.species) ?? { kg: 0, weighed: 0 };
        g.kg += p.yield_kg;
        g.weighed += 1;
        bySpecies.set(p.species, g);
    }
    return [...bySpecies.entries()].map(([species, g]) => {
        const prev = earlier.find((s) => weightOf(s, species) > 0);
        return { species, kg: g.kg, weighed: g.weighed, perPlanting: g.kg / g.weighed,
            lastYear: prev ? { season: prev.id, kg: weightOf(prev, species) } : null };
    }).sort((a, b) => b.kg - a.kg);
}
function fmtWeight(kg, system) {
    const v = system === "metric" ? kg : kg * 2.20462;
    const n = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
    return `${n} ${system === "metric" ? "kg" : "lb"}`;
}
function harvestLine(h, name, system) {
    const w = (kg) => fmtWeight(kg, system);
    const each = h.weighed > 1 ? ` from ${h.weighed} plantings, about ${w(h.perPlanting)} each` : "";
    const last = h.lastYear ? ` (${h.lastYear.season}: ${w(h.lastYear.kg)})` : "";
    return `${name}: ${w(h.kg)}${each}${last}`;
}
const f2c = (f) => ((f - 32) * 5) / 9;
const deg = (f, celsius) => celsius ? `${Math.round(f2c(f))} °C` : `${f} °F`;
function localiseFahrenheit(text, celsius) {
    return text
        .replace(/(\d+) to (\d+) degrees Fahrenheit/g, (_, a, b) => celsius ? `${Math.round(f2c(+a))} to ${deg(+b, true)}` : `${a} to ${b} °F`)
        .replace(/(\d+) degrees Fahrenheit/g, (_, a) => deg(+a, celsius))
        .replace(/(\d+) y (\d+) grados Fahrenheit/g, (_, a, b) => celsius ? `${Math.round(f2c(+a))} y ${deg(+b, true)}` : `${a} y ${b} °F`)
        .replace(/(\d+) grados Fahrenheit/g, (_, a) => deg(+a, celsius))
        .replace(/(\d+) y (\d+) °F/g, (_, a, b) => celsius ? `${Math.round(f2c(+a))} y ${deg(+b, true)}` : `${a} y ${b} °F`)
        .replace(/(\d+) °F/g, (_, a) => deg(+a, celsius));
}
const CONDITION = {
    cold_moist: (c) => fillCopy("hvColdMoist", { lo: deg(32, c), hi: deg(40, c) }),
    cold_dry: (c) => fillCopy("hvColdDry", { lo: deg(32, c), hi: deg(40, c) }),
    cool_dry: (c) => fillCopy("hvCoolDry", { lo: deg(50, c), hi: deg(60, c) }),
    cool_moist: (c) => fillCopy("hvCoolMoist", { t: deg(55, c) }),
    room: () => copy.hvRoom,
};
function harvestFacts(sp, celsius, tr = (_f, en) => en) {
    const rows = [];
    if (typeof sp.harvest_sign === "string")
        rows.push({ label: "Ready when", value: localiseFahrenheit(tr("harvest_sign", sp.harvest_sign), celsius) });
    const st = sp.storage;
    if (st && st.condition && CONDITION[st.condition] && st.shelf_life) {
        if (st.cure)
            rows.push({ label: "Cure first", value: localiseFahrenheit(tr("storage.cure", st.cure), celsius) });
        rows.push({ label: "Keeps", value: fillCopy("hvKeepsLine", { life: tr("storage.shelf_life", st.shelf_life), where: CONDITION[st.condition](celsius) }) });
        if (st.caution)
            rows.push({ label: "Mind", value: localiseFahrenheit(tr("storage.caution", st.caution), celsius) });
    }
    return rows.length ? rows : null;
}
function householdCount(sp, h) {
    const ppp = sp.plants_per_person;
    if (!Array.isArray(ppp) || ppp.length !== 2)
        return null;
    const people = h.adults + h.children / 2;
    if (!(people > 0))
        return null;
    const lo = Math.ceil(Number(ppp[0]) * people - 1e-9), hi = Math.ceil(Number(ppp[1]) * people - 1e-9);
    return { lo, hi, perSowing: Array.isArray(sp.succession_interval_days) || !!sp.bolt_risk };
}
function householdLine(name, c) {
    const key = c.lo !== c.hi ? (c.perSowing ? "hhSowRange" : "hhPlantsRange")
        : c.lo === 1 ? (c.perSowing ? "hhSowOne" : "hhPlantsOne") : (c.perSowing ? "hhSowMany" : "hhPlantsMany");
    return fillCopy(key, { crop: name, n: c.lo, lo: c.lo, hi: c.hi });
}
function householdWho(h) {
    const parts = [h.adults ? fillCopy(h.adults === 1 ? "hhAdultsOne" : "hhAdultsMany", { n: h.adults }) : "",
        h.children ? fillCopy(h.children === 1 ? "hhKidsOne" : "hhKidsMany", { n: h.children }) : ""].filter(Boolean);
    return parts.length > 1 ? fillCopy("nsJoinAnd", { a: parts[0], b: parts[1] }) : parts[0] ?? "";
}

export { harvestByCrop, harvestFacts, harvestLine, householdCount, householdLine, householdWho };
