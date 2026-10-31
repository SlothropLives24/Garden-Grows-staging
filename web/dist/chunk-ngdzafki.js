import './chunk-lutet8cz.js';
import { copy } from './paint.js';
import { fmtTemp } from './core.js';

const SEED_KIND_WORD = {
    scarify: "Scarify",
    stratify: "Cold-stratify",
    soak: "Soak",
};
function tempRange(v) {
    const lo = fmtTemp(v[0]);
    if (v[0] === v[1])
        return lo;
    return `${lo.split(" ")[0]}–${fmtTemp(v[1])}`;
}
function span(v, unit) {
    if (Array.isArray(v))
        return v[0] === v[1] ? `${v[0]} ${unit}` : `${v[0]}–${v[1]} ${unit}`;
    return `${v} ${unit}`;
}
function beforeYouSow(rec) {
    if (!rec)
        return null;
    const temp = rec.germination_soil_temp_c;
    const dtg = rec.days_to_germinate;
    const via = rec.seed_viability_years;
    const light = rec.light_to_germinate;
    const rawTreat = Array.isArray(rec.seed_treatment) ? rec.seed_treatment : [];
    const hasFact = temp != null || dtg != null || via != null;
    if (!hasFact && light !== true && rawTreat.length === 0)
        return null;
    const facts = [];
    if (temp != null)
        facts.push({ label: "Germination soil temperature", value: tempRange(temp) });
    if (dtg != null)
        facts.push({ label: "Days to germinate", value: span(dtg, copy.germDays) });
    if (via != null)
        facts.push({ label: "Seed stays viable", value: span(via, copy.germYears) });
    if (light === true)
        facts.push({ label: "Light to germinate", value: copy.germNeedsLight });
    const treatments = rawTreat.map((t) => ({
        word: SEED_KIND_WORD[String(t.kind ?? "")] ?? String(t.kind ?? ""),
        mechanism: String(t.mechanism ?? "").trim(),
        detail: String(t.detail ?? "").trim(),
    }));
    return { facts, treatments };
}
function packetAgeLine(name, packetYear, viability, thisYear) {
    if (typeof packetYear !== "number" || !Number.isFinite(packetYear) || typeof viability !== "number")
        return null;
    if (thisYear - packetYear <= viability)
        return null;
    return `${name} seed keeps about ${viability} year${viability === 1 ? "" : "s"}, so this ${packetYear} packet may be past its best.`;
}

export { beforeYouSow, packetAgeLine };
