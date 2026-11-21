const asDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12));
const isoAdd = (iso, days) => {
    const d = asDate(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
function calendarSowings(inp) {
    const out = [];
    const inGround = new Set();
    for (const p of inp.live) {
        const bed = inp.bedOf(p);
        const start = p.transplanted || p.sown;
        if (!start)
            continue;
        const ahead = start > inp.todayIso;
        if (!ahead)
            inGround.add(`${p.species}|${bed ?? ""}`);
        out.push({ species: p.species, name: inp.nameOf(p.species, p.cultivar_group ?? null), bed, start, window: inp.windowOf(p), planned: ahead });
    }
    for (const x of inp.tasks) {
        if (!x.bed || !x.species)
            continue;
        const name = inp.nameOf(x.species, null);
        if (x.kind === "harvest_open" && x.dtmRange && !x.windowEnd) {
            if (inGround.has(`${x.species}|${x.bed}`))
                continue;
            out.push({ species: x.species, name, bed: x.bed, start: isoAdd(x.date, -x.dtmRange[0]),
                window: { opens: x.date, closes: x.windowCloses ?? isoAdd(x.date, x.dtmRange[1] - x.dtmRange[0]) }, planned: true, task: true });
        }
        else if ((x.kind === "succession" || x.kind === "autumn") && x.date > inp.todayIso && inp.owed(x)) {
            out.push({ species: x.species, name, bed: x.bed, start: x.date, window: inp.windowOf({ species: x.species, sown: x.date }), planned: true, task: true });
        }
    }
    return out;
}

export { calendarSowings };
