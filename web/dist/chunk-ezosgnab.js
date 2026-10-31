import './chunk-lutet8cz.js';
import { taskSentence, jobKey } from './core.js';
import { copy, fillCopy } from './paint.js';

function tasksToIcs(tasksList, bundle, remind = "none", now = new Date(), alarms) {
    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Milpa Gardens//EN"];
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ring = alarms ? new Map([...alarms].map(([i, words]) => [tasksList[i], words])) : null;
    const list = tasksList.filter((t) => !t.setAside);
    const keyOf = (t) => `${t.plotId ?? ""}|${jobKey(t)}${t.kind === "logged" ? `|${t.date}|${t.act ?? t.cat ?? ""}` : ""}`;
    const order = list.map((t, i) => ({ t, i, k: keyOf(t) }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i));
    const nth = new Map();
    for (let j = 0, n = 0; j < order.length; j++) {
        n = j > 0 && order[j - 1].k === order[j].k ? n + 1 : 1;
        nth.set(order[j].i, n);
    }
    list.forEach((t, i) => {
        const where = t.bed ? ` (${t.bed})` : "";
        const summary = fillCopy("clIcsSummary", { text: `${t.text ?? taskSentence(t, bundle)}${where}` });
        const base = `gg-${slug(keyOf(t))}`;
        const n = nth.get(i) ?? 1;
        lines.push("BEGIN:VEVENT", `UID:${n === 1 ? base : `${base}-${n}`}@garden-grows`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${t.date.replaceAll("-", "")}`, `SUMMARY:${esc(summary)}`, ...(t.bed ? [`LOCATION:${esc(t.bed)}`] : []), `DESCRIPTION:${esc(copy.clIcsCredit)}`, ...(remind === "none" || (ring && !ring.has(t)) ? [] : [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${esc(ring?.get(t) ?? summary)}`,
            `TRIGGER:${remind === "morning" ? "PT8H" : "-PT6H"}`,
            "END:VALARM",
        ]), "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}
async function shareOrDownloadIcs(ics, filename) {
    const blob = new Blob([ics], { type: "text/calendar" });
    const file = new File([blob], filename, { type: "text/calendar" });
    const nav = navigator;
    if (nav.canShare?.({ files: [file] })) {
        try {
            await nav.share({ files: [file], title: copy.clShareTitle });
            return;
        }
        catch { }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}

export { shareOrDownloadIcs, tasksToIcs };
