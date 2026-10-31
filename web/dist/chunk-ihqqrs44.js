import './chunk-lutet8cz.js';
import { ruleClaim, markLink, confidenceBadge, corpusEs, corpusWantsEs } from './core.js';
import { copy, stripRuleCitations } from './paint.js';
import { answerRules } from './chunk-h38ll914.js';

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

export { symptomAnswer, symptomChips, symptomNotHere };
