export function maturityTier(seasons, signedIn) {
    if (!signedIn)
        return "established";
    const species = new Set(seasons.flatMap((s) => (s.plantings ?? []).map((p) => p.species))).size;
    const seasonsPlanted = seasons.filter((s) => s.closed_date != null && (s.plantings ?? []).length > 0).length;
    if (seasonsPlanted >= 2 || species >= 20)
        return "established";
    if (seasonsPlanted >= 1 || species >= 8)
        return "growing";
    return "new";
}
