// The user-plant editor form (add-your-own-plant, and the Log's "My added plants" editor). ONE form
// generator, used for BOTH adding a new variety and editing an existing one, so the two never drift.
//
// The form is pure UI: it renders the full field set (Core always visible; the rest under a "More
// traits" disclosure), optionally seeded from an existing record, and reads the fields back into a
// trait bag. It knows nothing about ids, storage, validation, or the missing-field warning - the
// caller (log.ts) owns id assignment (new slug vs the existing id it must PRESERVE so plantings stay
// linked), validateUserSpecies, capabilities(), and putUserSpecies. The closed vocabularies come
// straight from userspecies.ts, so the widget IS the allowlist and free text never enters an enum.
import { FEEDER_CLASSES, FROST_TOLERANCES, GROUND_COVERAGES, LIFESPANS, LIGHT_LEVELS, POLLINATOR_VALUES, SOW_SEASONS, SUPPORT_PROVIDES, SUPPORT_REQUIRES } from "./engine/userspecies.js";
// The family input references the shared <datalist id="upfamilies"> (populated once in log.ts). One
// datalist serves every form instance in the document - add on Plan, each editor on Log.
const FAMILY_DATALIST = "upfamilies";
const mk = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    return e;
};
// A labelled row: <div class="uprow"><label>…</label> control(s) …</div>
function row(labelText, forId, ...controls) {
    const r = mk("div", "uprow");
    const label = mk("label");
    label.htmlFor = forId;
    label.textContent = labelText;
    r.append(label, ...controls);
    return r;
}
// Seed helpers - pull a display value out of a stored field back onto an input.
const measureValue = (v) => typeof v === "number" ? String(v) : Array.isArray(v) && typeof v[0] === "number" ? String(v[0]) : "";
const strValue = (v) => (typeof v === "string" ? v : "");
let seq = 0; // unique id suffix so multiple forms (add + each edit) don't collide on element ids
export function plantEditorForm(opts) {
    const seed = opts.seed ?? {};
    const uid = `pf${seq++}`;
    const root = mk("div", "upform");
    const textInput = (field, placeholder = "") => {
        const i = mk("input");
        i.id = `${uid}-${field}`;
        i.type = "text";
        i.placeholder = placeholder;
        i.value = strValue(seed[field]);
        return i;
    };
    const numInput = (field, placeholder = "", seedVal) => {
        const i = mk("input");
        i.id = `${uid}-${field}`;
        i.type = "number";
        i.min = "0";
        i.step = "1";
        i.placeholder = placeholder;
        i.value = seedVal ?? measureValue(seed[field]);
        return i;
    };
    const enumSelect = (field, values) => {
        const s = mk("select");
        s.id = `${uid}-${field}`;
        const none = mk("option");
        none.value = "";
        none.textContent = "-";
        s.appendChild(none);
        for (const v of values) {
            const o = mk("option");
            o.value = v;
            o.textContent = v.replace(/_/g, " ");
            s.appendChild(o);
        }
        s.value = strValue(seed[field]);
        return s;
    };
    const check = (field, labelText) => {
        const r = mk("div", "uprow check");
        const l = mk("label");
        const cb = mk("input");
        cb.id = `${uid}-${field}`;
        cb.type = "checkbox";
        cb.checked = seed[field] === true;
        l.append(cb, document.createTextNode(" " + labelText));
        r.appendChild(l);
        return r;
    };
    // ---- Core (always visible) ----
    const name = textInput("common", "e.g. kohlrabi");
    const family = textInput("family", "optional - unlocks rotation");
    family.setAttribute("list", FAMILY_DATALIST);
    const lifespan = enumSelect("lifespan", LIFESPANS);
    const light = enumSelect("light_min", LIGHT_LEVELS);
    const height = numInput("mature_height_cm", "cm - tall plants shade shorter");
    const spread = numInput("mature_spread_cm", "cm - unlocks placement");
    const dtm = numInput("days_to_maturity", "unlocks harvest dates");
    const frost = enumSelect("frost_tolerance", FROST_TOLERANCES);
    // Hardiness zone (perennials only - it gates winter survival): two ends, revealed by lifespan.
    const zoneLo = numInput("hardiness_zone_lo", "lo", Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[0]) : "");
    const zoneHi = numInput("hardiness_zone_hi", "hi", Array.isArray(seed.hardiness_zone) ? String(seed.hardiness_zone[1]) : "");
    const zoneRow = row("Hardiness zones", `${uid}-hardiness_zone_lo`, zoneLo, document.createTextNode(" – "), zoneHi);
    zoneRow.classList.add("pair"); // two small ends inline, not two full-width stacked inputs
    const syncZone = () => { zoneRow.hidden = lifespan.value !== "perennial"; };
    lifespan.addEventListener("change", syncZone);
    root.append(row("Name", name.id, name), row("Family", family.id, family), row("Lifespan", lifespan.id, lifespan), row("Sun", light.id, light), row("Mature height", height.id, height), row("Mature spread", spread.id, spread), row("Days to maturity", dtm.id, dtm), row("Frost tolerance", frost.id, frost), zoneRow);
    syncZone();
    // ---- Advanced ("More traits", collapsed) ----
    const succ = numInput("succession_interval_days", "days between re-sowings");
    const startIndoors = numInput("start_indoors_weeks", "weeks before last frost");
    const sowSeason = enumSelect("sow_season", SOW_SEASONS);
    const nightTemp = numInput("night_temp_max_c", "°C - too-warm nights hurt fruit set");
    const habit = textInput("habit", "e.g. vine, bush, rosette");
    const feeder = enumSelect("feeder_class", FEEDER_CLASSES);
    const ground = enumSelect("ground_coverage", GROUND_COVERAGES);
    const pollinator = enumSelect("pollinator_value", POLLINATOR_VALUES);
    // O80c: the closed vocabulary, not free text - "trellis" typed here could never satisfy R-040's
    // strong test, so a user's climbing plant was invisible to the one rule about it.
    const supProvides = enumSelect("support_provides", SUPPORT_PROVIDES);
    const supRequires = enumSelect("support_requires", SUPPORT_REQUIRES);
    const notes = mk("textarea");
    notes.id = `${uid}-notes`;
    notes.placeholder = "anything else worth remembering";
    notes.value = strValue(seed.notes);
    const adv = mk("details", "moretraits");
    const advSum = mk("summary");
    advSum.textContent = "More traits (optional)";
    adv.appendChild(advSum);
    adv.append(row("Re-sow every", succ.id, succ), row("Start indoors", startIndoors.id, startIndoors), row("Sow season", sowSeason.id, sowSeason), row("Heat limit", nightTemp.id, nightTemp), row("Habit", habit.id, habit), row("Feeder", feeder.id, feeder), row("Ground cover", ground.id, ground), row("Pollinator", pollinator.id, pollinator), row("Provides support", supProvides.id, supProvides), row("Needs support", supRequires.id, supRequires), check("n_fixing", "Nitrogen fixer"), check("casts_shade", "Casts shade"), check("volatile_aromatic", "Aromatic (pest-confusing)"), check("verticillium_susceptible", "Verticillium-susceptible"), row("Notes", notes.id, notes));
    // A seed that already carries an advanced field opens the disclosure so the edit shows it up front.
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
