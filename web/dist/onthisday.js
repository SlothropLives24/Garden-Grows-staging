function mdDistance(m1, d1, m2, d2) {
    const doy = (m, d) => (m - 1) * 30.4 + d;
    const a = doy(m1, d1), b = doy(m2, d2);
    const raw = Math.abs(a - b);
    return Math.min(raw, 365 - raw);
}
export function aYearAgoThisWeek(seasons, todayIso, windowDays = 7) {
    const t = new Date(`${todayIso}T12:00:00`);
    if (Number.isNaN(t.getTime()))
        return [];
    const tm = t.getUTCMonth() + 1, td = t.getUTCDate(), ty = t.getUTCFullYear();
    const out = [];
    const near = (iso) => {
        if (!iso)
            return false;
        const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (!parts)
            return false;
        return mdDistance(tm, td, Number(parts[2]), Number(parts[3])) <= windowDays;
    };
    for (const s of seasons) {
        const yearsAgo = ty - s.id;
        if (yearsAgo < 1)
            continue;
        const add = (date, kind, extra = {}) => {
            if (date && near(date))
                out.push({ date, year: s.id, yearsAgo, kind, ...extra });
        };
        for (const p of s.plantings ?? []) {
            add(p.sown, "sowed", { species: p.species });
            add(p.transplanted, "transplanted", { species: p.species });
            add(p.first_harvest, "first_harvest", { species: p.species });
            add(p.last_harvest, "last_harvest", { species: p.species });
            for (const n of p.notes ?? [])
                add(n.date, "note", { species: p.species, text: n.text, photo: n.photo });
        }
        for (const o of s.observations ?? []) {
            if (o.event === "frost")
                add(o.date, "frost");
            else if (o.event === "heat")
                add(o.date, "heat");
            else if (o.event === "note")
                add(o.date, "note", { text: o.note });
        }
    }
    out.sort((a, b) => (a.yearsAgo - b.yearsAgo) || a.date.localeCompare(b.date));
    return out;
}
