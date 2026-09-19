import { parseRegion, regionPoints } from "./engine/regions.js";
export function nextBedName(beds) {
    const taken = new Set(beds.map((b) => b.name));
    for (let n = 1;; n++) {
        const name = `Bed ${n}`;
        if (!taken.has(name))
            return name;
    }
}
export function nextOrigin(beds) {
    let right = 0;
    for (const b of beds) {
        try {
            for (const [x] of regionPoints(parseRegion(b.region)))
                right = Math.max(right, x);
        }
        catch { }
    }
    const r2 = (v) => Math.round(v * 100) / 100;
    return { x: beds.length ? r2(right + 0.5) : 0, y: 0 };
}
