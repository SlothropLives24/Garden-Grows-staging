// Dimension beds (earned planner phase B, approved mockup + personas finding 2). Two numbers
// make a REAL bed: a rect region in plot metres, auto-laid-out beside the beds that exist, named
// with the first free "Bed N". Fit verdicts, placement, and spacing all fire on it exactly as on
// a traced bed - the map stops being the entrance and becomes a named upgrade (the trace is what
// starts the bed's ground history counting, because rotation attaches to ground).
//
// Pure and DOM-free: the layout arithmetic is unit-tested; app.ts owns the wiring.
import { parseRegion, regionPoints } from "./engine/regions.js";
/** The first free "Bed N" name - beds are keyed by name, so a collision would silently EDIT an
 *  existing bed instead of adding one. */
export function nextBedName(beds) {
    const taken = new Set(beds.map((b) => b.name));
    for (let n = 1;; n++) {
        const name = `Bed ${n}`;
        if (!taken.has(name))
            return name;
    }
}
/** Where a new dimension bed goes: just right of everything that exists, half a metre clear, at
 *  y = 0. Sized beds must not stack on each other (overlapping occupancy would entangle their
 *  rotation histories) and must not land on a traced bed either. */
export function nextOrigin(beds) {
    let right = 0;
    for (const b of beds) {
        try {
            for (const [x] of regionPoints(parseRegion(b.region)))
                right = Math.max(right, x);
        }
        catch { /* a malformed region claims no space */ }
    }
    const r2 = (v) => Math.round(v * 100) / 100;
    return { x: beds.length ? r2(right + 0.5) : 0, y: 0 };
}
