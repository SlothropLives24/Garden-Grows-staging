import { FEEDER_CLASSES, FROST_TOLERANCES, GROUND_COVERAGES, LIFESPANS, LIGHT_LEVELS, POLLINATOR_VALUES, SOW_SEASONS, SUPPORT_PROVIDES, SUPPORT_REQUIRES } from "./engine/userspecies.js";
import { el } from "./dom.js";
const FAMILY_DATALIST = "upfamilies";
function row(labelText, forId, ...controls) {
    const r = el("div", "uprow");
    const label = el("label");
    label.htmlFor = forId;
    label.textContent = labelText;
    r.append(label, ...controls);
    return r;
}
const measureValue = (v) => typeof v === "number" ? String(v) : Array.isArray(v) && typeof v[0] === "number" ? String(v[0]) : "";
const strValue = (v) => (typeof v === "string" ? v : "");
let seq = 0;
export function plantEditorForm(opts) {
    const seed = opts.seed ?? {};
    const uid = `pf${seq++}`;
    const root = el("div", "upform");
    const textInput = (field, placeholder = "") => {
        const i = el("input");
        i.id = `${uid}-${field}`;
        i.type = "text";
        i.placeholder = placeholder;
        i.value = strValue(seed[field]);
        return i;
    };
    const numInput = (field, placeholder = "", seedVal) => {
        const i = el("input");
        i.id = `${uid}-${field}`;
        i.type = "number";
        i.min = "0";
        i.step = "1";
        i.placeholder = placeholder;
        i.value = seedVal ?? measureValue(seed[field]);
        return i;
    };
    const enumSelect = (field, values) => {
        const s = el("select");
        s.id = `${uid}-${field}`;
        const none = el("option");
        none.value = "";
        none.textContent = "-";
        s.appendChild(none);
        for (const v of values) {
            const o = el("option");
            o.value = v;
            o.textContent = v.replace(/_/g, " ");
            s.appendChild(o);
        }
        s.value = strValue(seed[field]);
        return s;
    };
    const check = (field, labelText) => {
        const r = el("div", "uprow check");
        const l = el("label");
        const cb = el("input");
        cb.id = `${uid}-${field}`;
        cb.type = "checkbox";
        cb.checked = seed[field] === true;
        l.append(cb, document.createTextNode(" " + labelText));
        r.appendChild(l);
        return r;
    };
    const name = textInput("common", "e.g. kohlrabi");
    const family = textInput("family", "optional - unlocks rotation");
    family.setAttribute("list", FAMILY_DATALIST);
    const lifespan = enumSelect("lifespan", LIFESPANS);
    const light = enumSelect("light_min", LIGHT_LEVELS);
    const height = numInput("mature_height_cm", "cm - tall plants shade shorter");
    const spread = numInput("mature_spread_cm", "cm - unlocks placement");
    const dtm = numInput("days_to_maturity", "unlocks harvest dates");
    const frost = enumSelect("frost_tolerance", FROST_TOLERANCES);
    const zoneLo = numInput("hardiness_zone_lo", "lo", Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[0]) : "");
    const zoneHi = numInput("hardiness_zone_hi", "hi", Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[1]) : "");
    const zoneRow = row("Hardiness zones", `${uid}-hardiness_zone_lo`, zoneLo, document.createTextNode(" – "), zoneHi);
    zoneRow.classList.add("pair");
    const syncZone = () => { zoneRow.hidden = lifespan.value !== "perennial"; };
    lifespan.addEventListener("change", syncZone);
    root.append(row("Name", name.id, name), row("Family", family.id, family), row("Lifespan", lifespan.id, lifespan), row("Sun", light.id, light), row("Mature height", height.id, height), row("Mature spread", spread.id, spread), row("Days to maturity", dtm.id, dtm), row("Frost tolerance", frost.id, frost), zoneRow);
    syncZone();
    const succ = numInput("succession_interval_days", "days between re-sowings");
    const startIndoors = numInput("start_indoors_weeks", "weeks before last frost");
    const sowSeason = enumSelect("sow_season", SOW_SEASONS);
    const nightTemp = numInput("night_temp_max_c", "°C - too-warm nights hurt fruit set");
    const habit = textInput("habit", "e.g. vine, bush, rosette");
    const feeder = enumSelect("feeder_class", FEEDER_CLASSES);
    const ground = enumSelect("ground_coverage", GROUND_COVERAGES);
    const pollinator = enumSelect("pollinator_value", POLLINATOR_VALUES);
    const supProvides = enumSelect("support_provides", SUPPORT_PROVIDES);
    const supRequires = enumSelect("support_requires", SUPPORT_REQUIRES);
    const notes = el("textarea");
    notes.id = `${uid}-notes`;
    notes.placeholder = "anything else worth remembering";
    notes.value = strValue(seed.notes);
    const adv = el("details", "moretraits");
    const advSum = el("summary");
    advSum.textContent = "More traits (optional)";
    adv.appendChild(advSum);
    adv.append(row("Re-sow every", succ.id, succ), row("Start indoors", startIndoors.id, startIndoors), row("Sow season", sowSeason.id, sowSeason), row("Heat limit", nightTemp.id, nightTemp), row("Habit", habit.id, habit), row("Feeder", feeder.id, feeder), row("Ground cover", ground.id, ground), row("Pollinator", pollinator.id, pollinator), row("Provides support", supProvides.id, supProvides), row("Needs support", supRequires.id, supRequires), check("n_fixing", "Nitrogen fixer"), check("casts_shade", "Casts shade"), check("volatile_aromatic", "Aromatic (pest-confusing)"), check("verticillium_susceptible", "Verticillium-susceptible"), row("Notes", notes.id, notes));
    const ADV_FIELDS = ["succession_interval_days", "start_indoors_weeks", "sow_season", "night_temp_max_c",
        "habit", "feeder_class", "ground_coverage", "pollinator_value", "support", "n_fixing", "casts_shade",
        "volatile_aromatic", "verticillium_susceptible", "notes"];
    adv.open = ADV_FIELDS.some((f) => seed[f] !== undefined);
    root.appendChild(adv);
    const val = (el) => el.value.trim();
    const measure = (el) => {
        const v = val(el);
        if (!v)
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? [n, n] : undefined;
    };
    const scalar = (el) => {
        const v = val(el);
        if (!v)
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const cb = (field) => root.querySelector(`#${uid}-${field}`).checked;
    return {
        root,
        focusName: () => name.focus(),
        read() {
            const traits = {};
            const set = (k, v) => { if (v !== undefined && v !== "")
                traits[k] = v; };
            set("family", val(family).toLowerCase() || undefined);
            set("lifespan", val(lifespan) || undefined);
            set("light_min", val(light) || undefined);
            set("frost_tolerance", val(frost) || undefined);
            set("feeder_class", val(feeder) || undefined);
            set("ground_coverage", val(ground) || undefined);
            set("pollinator_value", val(pollinator) || undefined);
            set("habit", val(habit) || undefined);
            set("mature_height_cm", measure(height));
            set("mature_spread_cm", measure(spread));
            set("days_to_maturity", measure(dtm));
            set("succession_interval_days", measure(succ));
            set("start_indoors_weeks", scalar(startIndoors));
            set("sow_season", val(sowSeason) || undefined);
            set("night_temp_max_c", scalar(nightTemp));
            const lo = scalar(zoneLo), hi = scalar(zoneHi);
            if (lifespan.value === "perennial" && lo !== undefined && hi !== undefined)
                traits.hardiness_zone = [lo, hi];
            const support = {};
            if (val(supProvides))
                support.provides = val(supProvides);
            if (val(supRequires))
                support.requires = val(supRequires);
            if (Object.keys(support).length)
                traits.support = support;
            for (const b of ["n_fixing", "casts_shade", "volatile_aromatic", "verticillium_susceptible"]) {
                if (cb(b))
                    traits[b] = true;
            }
            const notesV = notes.value.trim();
            if (notesV)
                traits.notes = notesV;
            return { name: val(name), traits };
        },
    };
}
