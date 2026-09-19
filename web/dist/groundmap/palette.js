const SPECIES_COLORS = [
    "#2a78d6",
    "#e34948",
    "#4a3aa7",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
];
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
