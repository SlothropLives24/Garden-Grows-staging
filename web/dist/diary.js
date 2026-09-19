export function recollectionLine(r, name) {
    const day = dayWord(r.date);
    const yr = r.yearsAgo === 1 ? "" : ` (${r.year})`;
    switch (r.kind) {
        case "sowed": return `${day}${yr} - sowed ${name}.`;
        case "transplanted": return `${day}${yr} - set out ${name}.`;
        case "first_harvest": return `${day}${yr} - the first ${name.toLowerCase()} out of the ground.`;
        case "last_harvest": return `${day}${yr} - the last ${name.toLowerCase()} picked.`;
        case "note": return r.species ? `${day}${yr} - on ${name}: ${r.text ?? ""}.` : `${day}${yr} - ${r.text ?? "a note"}.`;
        case "frost": return `${day}${yr} - a frost.`;
        case "heat": return `${day}${yr} - a hot spell.`;
        default: return `${day}${yr}.`;
    }
}
export function dayWord(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function frostNotedLine(iso, standing) {
    const day = dayWord(iso);
    if (standing?.live)
        return `Frost noted for ${day}. Your frost dates come from your own log now, and this one goes in it.`;
    return `Frost noted for ${day}. Two dated frosts a year, three years running, and your frost dates come from your own log.`;
}
export function weatherNotedLine(what, iso) {
    const w = what.trim();
    return `${w.charAt(0).toUpperCase()}${w.slice(1)} noted for ${dayWord(iso)}.`;
}
export function noteLoggedLine(iso) {
    return `In your garden diary, ${dayWord(iso)}.`;
}
export function plantedLine(year, n, bed) {
    const what = n != null ? `${n} plant${n === 1 ? "" : "s"} in the ground` : "The team is in the ground";
    return `${year} begins. ${what} at “${bed}”.`;
}
export function plantEntryLine(kind, name, iso, detail = "") {
    const n = name.trim() || "the plant";
    const cap = `${n.charAt(0).toUpperCase()}${n.slice(1)}`;
    const day = dayWord(iso);
    switch (kind) {
        case "sowed": return `${cap} sown, ${day}.`;
        case "transplanted": return `${cap} set out, ${day}.`;
        case "first_harvest": return `First ${n.toLowerCase()} out of the ground - ${day}.`;
        case "last_harvest": return `The last ${n.toLowerCase()} picked, ${day}.`;
        case "ended": return `${cap} ended, ${day}.`;
        case "problem": return `Noted on ${n}: ${detail.trim() || "a problem"}, ${day}.`;
        case "note": return `Noted on ${n}, ${day}.`;
        default: return `${cap}: noted, ${day}.`;
    }
}
export function graduationLine() {
    return "Three winters logged. From here on, your frost dates come from your own log.";
}
