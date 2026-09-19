const SEASON_FUNCTIONS = [
    { key: "spring", name: "Spring", verb: "Plant",
        line: "Lay out your beds, see what grows well together, and get planting dates the last frost won’t wreck.",
        a: "#4a9a24", b: "#d9a50a" },
    { key: "summer", name: "Summer", verb: "Tend",
        line: "Everything’s in the ground — keep the record, and stay ahead of the watering, the pests, the timing.",
        a: "#1f78c1", b: "#d99a06" },
    { key: "autumn", name: "Autumn", verb: "Gather & close",
        line: "Bring in the last of it, close the beds for winter, and let the ground remember what grew where.",
        a: "#c67139", b: "#7a8a5e" },
    { key: "winter", name: "Winter", verb: "Plan",
        line: "The quiet months: read the year, see what held up, and lay out the next — rotation and all.",
        a: "#3e7a99", b: "#5a7a63" },
];
export function seasonOf(key) {
    const s = SEASON_FUNCTIONS.find((f) => f.key === key);
    return s ? { key: s.key, name: s.name, verb: s.verb } : undefined;
}
export function renderSeasonBand(host, opts) {
    const current = opts?.current ?? null;
    host.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "seasonband";
    for (const s of SEASON_FUNCTIONS) {
        const cell = document.createElement("div");
        cell.className = "seasonband-cell";
        cell.style.setProperty("--a", s.a);
        cell.style.setProperty("--b", s.b);
        if (current && current === s.key)
            cell.classList.add("is-now");
        const top = document.createElement("div");
        top.className = "seasonband-top";
        const nm = document.createElement("span");
        nm.className = "seasonband-season";
        nm.textContent = s.name;
        if (current && current === s.key) {
            const now = document.createElement("span");
            now.className = "seasonband-now";
            now.textContent = "Now";
            nm.appendChild(now);
        }
        const sw = document.createElement("span");
        sw.className = "seasonband-sw";
        sw.setAttribute("aria-hidden", "true");
        const ia = document.createElement("i");
        ia.className = "a";
        const ib = document.createElement("i");
        ib.className = "b";
        sw.append(ia, ib);
        top.append(nm, sw);
        const body = document.createElement("div");
        body.className = "seasonband-body";
        const verb = document.createElement("div");
        verb.className = "seasonband-verb";
        verb.textContent = s.verb;
        const line = document.createElement("p");
        line.className = "seasonband-line";
        line.textContent = s.line;
        body.append(verb, line);
        cell.append(top, body);
        grid.appendChild(cell);
    }
    host.appendChild(grid);
}
