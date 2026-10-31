import './chunk-lutet8cz.js';
import { copy, fillCopy } from './paint.js';
import { setGardenFrost, openLog, toast, app, monthLong } from './core.js';
import './chunk-l5cseoso.js';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function datePick(form, legend, key, now) {
    const fs = document.createElement("fieldset");
    fs.className = "cc-ownpick";
    const lg = document.createElement("legend");
    lg.textContent = legend;
    const month = document.createElement("select");
    month.name = `${key}-month`;
    month.setAttribute("aria-label", fillCopy("plOwnFrostMonthOf", { date: legend }));
    const blank = new Option(copy.plOwnFrostNotSure, "");
    month.add(blank);
    for (let m = 0; m < 12; m++)
        month.add(new Option(monthLong(m), String(m + 1).padStart(2, "0")));
    const day = document.createElement("select");
    day.name = `${key}-day`;
    day.setAttribute("aria-label", fillCopy("plOwnFrostDayOf", { date: legend }));
    const fillDays = () => {
        const keep = day.value;
        day.replaceChildren();
        const n = month.value ? DAYS[Number(month.value) - 1] : 31;
        for (let d = 1; d <= n; d++)
            day.add(new Option(String(d), String(d).padStart(2, "0")));
        day.value = keep && Number(keep) <= n ? keep : "01";
        day.disabled = !month.value;
    };
    month.addEventListener("change", fillDays);
    if (now && /^\d\d-\d\d$/.test(now))
        month.value = now.slice(0, 2);
    fillDays();
    if (now && month.value)
        day.value = now.slice(3, 5);
    fs.append(lg, month, day);
    form.appendChild(fs);
    return () => (month.value ? `${month.value}-${day.value}` : null);
}
function openOwnFrostForm(box, plotId, now, hasOwn, done) {
    box.querySelector(".cc-ownform")?.remove();
    const form = document.createElement("form");
    form.className = "cc-ownform";
    const intro = document.createElement("p");
    intro.className = "cc-ownhint";
    intro.textContent = copy.plOwnFrostHint;
    form.appendChild(intro);
    const last = datePick(form, copy.plLastFrostRow, "last", now.last);
    const first = datePick(form, copy.plFirstFreezeRow, "first", now.first);
    const msg = document.createElement("p");
    msg.className = "cc-ownmsg";
    msg.setAttribute("role", "alert");
    form.appendChild(msg);
    const acts = document.createElement("div");
    acts.className = "cc-ownacts";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = copy.plOwnFrostSave;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-ghost";
    cancel.textContent = copy.plOwnFrostCancel;
    acts.append(save, cancel);
    if (hasOwn) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "btn btn-ghost cc-ownclear";
        clear.textContent = copy.plOwnFrostClear;
        clear.addEventListener("click", () => void write(null, null, copy.plOwnFrostCleared));
        acts.appendChild(clear);
    }
    form.appendChild(acts);
    const close = () => { form.remove(); done(); };
    cancel.addEventListener("click", close);
    async function write(l, f, said) {
        save.disabled = true;
        try {
            await setGardenFrost(await openLog(), plotId, l, f);
            form.remove();
            toast(said);
            await app.logRefresh?.();
        }
        catch {
            msg.textContent = copy.plOwnFrostFailed;
            save.disabled = false;
        }
    }
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const l = last(), f = first();
        if (!l && !f) {
            msg.textContent = copy.plOwnFrostNeedOne;
            return;
        }
        void write(l, f, copy.plOwnFrostSaved);
    });
    box.appendChild(form);
    form.querySelector("select")?.focus();
}

export { openOwnFrostForm };
