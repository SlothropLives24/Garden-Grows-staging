import './chunk-bc6a6dvg.js';
import { ruleClaim, markLink, confidenceBadge, corpusEs, corpusWantsEs, fmtTemp } from './core.js';
import { copy, stripRuleCitations } from './paint.js';
import { answerRules } from './chunk-dlfaknej.js';

const make = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (text != null)
        e.textContent = text;
    return e;
};
function symptomChips(list, onPick) {
    const row = make("div", "wrong-chips");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", copy.syWhatSeeingAria);
    for (const s of list) {
        const b = make("button", "chip wrong-chip", s.label);
        b.type = "button";
        b.dataset.symptom = s.id;
        b.addEventListener("click", () => onPick(s));
        row.appendChild(b);
    }
    return row;
}
function symptomNotHere() {
    return make("p", "hint wrong-nothere", copy.syNotHere);
}
function symptomAnswer(s, sid, cropName, bundle, act) {
    const card = make("div", "wrong-answer");
    card.dataset.symptom = s.id;
    card.appendChild(make("p", "wrong-k", cropName ? `${cropName}: ${s.label.toLowerCase()}` : s.label));
    const rules = answerRules(s, sid, bundle);
    if (!rules.length)
        card.appendChild(make("p", "hint", copy.syNoRule));
    for (const r of rules) {
        const rec = r;
        const item = make("div", "wrong-rule");
        const claim = make("p", "wrong-claim", stripRuleCitations(ruleClaim(bundle, r.id) || String(rec.claim ?? "")));
        claim.appendChild(document.createTextNode(" "));
        const why = document.createElement("a");
        why.className = "whytap";
        why.href = `#/why?rule=${r.id}`;
        why.textContent = copy.pcWhyThis;
        markLink(why, { kind: "rule", id: r.id });
        claim.appendChild(why);
        item.appendChild(claim);
        const badge = confidenceBadge(String(rec.grade ?? ""));
        if (badge) {
            const p = make("p", "wrong-conf");
            p.appendChild(badge);
            item.appendChild(p);
        }
        if (rec.remedy) {
            const todo = make("p", "wrong-todo");
            todo.appendChild(make("b", undefined, copy.syWhatToDo + " "));
            const es = corpusEs(r.id, "remedy");
            const words = document.createElement("span");
            words.textContent = stripRuleCitations(es ?? String(rec.remedy)).trim();
            if (!es && corpusWantsEs())
                words.lang = "en";
            todo.appendChild(words);
            item.appendChild(todo);
        }
        card.appendChild(item);
    }
    if (act) {
        const b = make("button", "linky wrong-act", act.label);
        b.type = "button";
        b.addEventListener("click", act.run);
        card.appendChild(b);
    }
    return card;
}

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

export { beforeYouSow, packetAgeLine, symptomAnswer, symptomChips, symptomNotHere };
