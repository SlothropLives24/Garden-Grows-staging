const CLAIMS = [
    { id: "B-005", q: "Do eggshells stop slugs?" },
    { id: "B-004", q: "Do Epsom salts stop blossom end rot?" },
    { id: "B-011", q: "Do marigolds keep pests away?" },
    { id: "B-006", q: "Do coffee grounds make soil acidic?" },
    { id: "B-003", q: "Does planting by the moon work?" },
    { id: "B-012", q: "Does midday watering scorch leaves?" },
    { id: "B-009", q: "Do pot shards help a container drain?" },
];
export function doorClaim(dayOfYear) {
    return CLAIMS[Math.abs(Math.trunc(dayOfYear)) % CLAIMS.length];
}
export function allDoorClaims() { return CLAIMS.slice(); }
const SITUATIONS = [
    {
        id: "earlystart", label: "I want to get going early",
        href: "#/answers?situation=earlystart",
        why: "What goes out BEFORE your last frost, and how far before",
    },
    {
        id: "containers", label: "I only have containers",
        href: "#/answers?situation=containers",
        why: "What actually fits a pot - by root depth and spread, not by wishful thinking",
    },
    {
        id: "midseason", label: "It's already late to start",
        href: "#/answers?situation=midseason",
        why: "The crops that finish fastest, by days to maturity",
    },
    {
        id: "shade", label: "My garden is shady",
        href: "#/answers?situation=shade",
        why: "What tolerates it - and the rule that refuses to place sun-lovers in shadow",
    },
    {
        id: "clay", label: "I have heavy clay",
        href: "#/answers?situation=clay",
        why: "What clay actually needs, and the fix that makes it worse",
    },
];
export function situations(month) {
    const seasonal = month >= 6 && month <= 9 ? "midseason" : "earlystart";
    const keep = new Set(["containers", "shade", "clay", seasonal]);
    return SITUATIONS.filter((s) => keep.has(s.id));
}
export function situationFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("situation");
    if (!raw)
        return null;
    return SITUATIONS.find((s) => s.id === raw) ?? null;
}
const topOfRange = (v) => {
    if (Array.isArray(v)) {
        const nums = v.map(Number).filter((n) => Number.isFinite(n));
        return nums.length ? Math.max(...nums) : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
export function containerCrops(species, maxSpanCm, limit = 12) {
    const out = [];
    for (const sp of species) {
        const spread = topOfRange(sp.mature_spread_cm);
        const depth = String(sp.root_depth ?? "");
        if (spread == null || spread <= 0)
            continue;
        if (spread > maxSpanCm)
            continue;
        if (depth === "deep")
            continue;
        const poll = sp.pollination;
        if (Number(poll?.block_min_plants) > 1)
            continue;
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, spreadCm: spread, rootDepth: depth });
    }
    out.sort((a, b) => (a.spreadCm - b.spreadCm) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
const isAdaptation = (name) => /\(/.test(name);
export function headlineTeams(guilds, nameOf) {
    const plantable = guilds.filter((g) => String(g.guild_class ?? "") !== "out_of_scope");
    const order = ["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle"];
    const shown = [];
    for (const cls of order) {
        const pick = plantable.find((g) => String(g.guild_class) === cls && !isAdaptation(nameOf(g)));
        if (!pick)
            continue;
        const mech = (pick.mechanisms ?? [])
            .map((m) => m?.claim).find((c) => !!c) ?? null;
        shown.push({ id: String(pick.id), name: nameOf(pick), mechanism: mech });
    }
    return { shown, more: Math.max(0, plantable.length - shown.length) };
}
export function quickCrops(species, limit = 10) {
    const out = [];
    for (const sp of species) {
        if (String(sp.scheduling_model ?? "") !== "dtm")
            continue;
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        const dtm = sp.days_to_maturity;
        const low = Array.isArray(dtm) ? Number(dtm[0]) : Number(dtm);
        if (!Number.isFinite(low) || low <= 0)
            continue;
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, days: low });
    }
    out.sort((a, b) => (a.days - b.days) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
