// Species dot colours - pure move out of groundmap.ts (fun-pass slice 2).
//
// A fixed colourblind-safe 8-slot palette, assigned in this order by first appearance. The
// ORDER is the safety mechanism (validated: every adjacent pair clears the CVD ΔE≥8 and
// normal-vision ΔE≥15 gates in light and dark mode) - never re-sort it. Green is deliberately
// the LAST slot and teal the fifth: the map background is vegetation, so the hues most likely
// to vanish into it are the rarest to be dealt. Identity never rides on colour alone - the
// legend row and each dot's tooltip carry the species name.
export const SPECIES_COLORS = [
    "#2a78d6", // blue
    "#e34948", // red
    "#4a3aa7", // violet
    "#eb6834", // orange
    "#1baf7a", // teal
    "#eda100", // yellow
    "#e87ba4", // magenta
    "#008300", // green
];
/** A fresh first-appearance colour assigner - one per draw, so slot order tracks the draw. */
export const colorAssigner = () => {
    const assigned = new Map();
    return (sid) => {
        let c = assigned.get(sid);
        if (!c) {
            c = SPECIES_COLORS[assigned.size % SPECIES_COLORS.length];
            assigned.set(sid, c);
        }
        return c;
    };
};
