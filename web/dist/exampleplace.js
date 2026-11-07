import { scheduleSite, seasonYearOf, springPlantedTeam, browsableGuilds, seasonDate, isSouthern, frostRare, fallDate, warmthWindowsFor, resolveSpecies, warmTeamDays, guildPlantings, guildStatus, shortlistRank, tropical, gardenTasks, isTeamPlantJob, livingSupportLead, SOUTH_SEASON_START_MONTH } from './core.js';
import { teamsHolding } from './chunk-f08gghbd.js';
import { EXAMPLE_BED_REGION, EXAMPLE_BED_STRUCTURE, EXAMPLE_BED_M } from './chunk-bm4hdmsn.js';
import './paint.js';

const warmKey = (sid, group) => (group ? `${sid}/${group}` : sid);
const pad = (n) => String(n).padStart(2, "0");
const seasonMonths = (lat) => {
    const start = isSouthern(lat) ? SOUTH_SEASON_START_MONTH : 1;
    return Array.from({ length: 12 }, (_, i) => ((start - 1 + i) % 12) + 1);
};
const isoAdd = (iso, n) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
const plantedOn = (p) => warmKey(p.species, p.cultivar_group ?? null);
function warmWait(sid, group, bundle) {
    if (resolveSpecies(sid, group, bundle).frost_tolerance !== "very_tender")
        return 0;
    const r = bundle.rules.find((x) => x.id === "R-171");
    return Number(r?.offset_days_after_last_frost) || 0;
}
function sowings(team, plantings, site, lat, lon, year, bundle) {
    if (!springPlantedTeam(team, bundle))
        return null;
    if (!frostRare(site)) {
        const jobs = gardenTasks(team, lat, lon, year, bundle, site);
        const plant = jobs.find((t) => isTeamPlantJob(t.kind));
        if (!plant)
            return null;
        const climb = jobs.find((t) => t.kind === "sow_climber");
        const r171 = bundle.rules.find((x) => x.id === "R-171");
        const wt = plant.kind === "plant_after_last_frost"
            ? warmTeamDays(site, plant.date.slice(5), plantings.map((p) => ({ sid: p.species, group: p.cultivar_group ?? null })), bundle, lat, Number(r171?.offset_days_after_last_frost) || 0) : null;
        const moveBy = wt && wt.team !== plant.date.slice(5)
            ? Math.round((Date.parse(seasonDate(wt.team, year, lat)) - Date.parse(plant.date)) / 864e5) : 0;
        const own = (p) => {
            const w = wt?.days.get(`${p.species}|${p.cultivar_group ?? ""}`);
            return w ? seasonDate(w.mmdd, year, lat) : null;
        };
        const daysOf = (sid) => {
            const hit = sid ? [...(wt?.days ?? new Map())].find(([k]) => k.startsWith(`${sid}|`))?.[1] : undefined;
            return hit ? seasonDate(hit.mmdd, year, lat) : null;
        };
        return { dated: "frost", day: (p) => {
                if (climb && p.species === climb.species) {
                    let c = isoAdd(climb.date, moveBy);
                    const sup = daysOf(climb.support);
                    if (sup) {
                        const d = isoAdd(sup, climb.lead_days ?? 0);
                        if (d > c)
                            c = d;
                    }
                    const w = own(p);
                    return w && w > c ? w : c;
                }
                return own(p) ?? isoAdd(plant.date, warmWait(p.species, p.cultivar_group ?? null, bundle));
            } };
    }
    const keys = [...new Set(plantings.map(plantedOn))];
    const windows = warmthWindowsFor(site, lat, keys, bundle);
    const first = new Map();
    for (const k of keys) {
        const m = seasonMonths(lat).find((mm) => windows[k]?.months.includes(mm));
        if (m != null)
            first.set(k, seasonDate(`${pad(m)}-01`, year, lat));
    }
    if (!keys.every((k) => first.has(k)))
        return null;
    const lead = livingSupportLead(team, bundle);
    const supportDay = lead?.lead_days ? plantings.filter((p) => p.species !== lead.climber).map((p) => first.get(plantedOn(p))).sort()[0] : undefined;
    return {
        dated: "warmth",
        day: (p) => (lead?.lead_days && supportDay && p.species === lead.climber ? isoAdd(supportDay, lead.lead_days) : first.get(plantedOn(p)) ?? null),
    };
}
function cropOverride(team, crop) {
    const out = new Map();
    for (const r of team.roles ?? []) {
        if (r.canonical === crop || r.substitute === crop)
            return out;
        for (const a of [r.alternative, ...(r.alternatives ?? [])]) {
            const sid = typeof a === "string" ? a : a?.species;
            if (sid === crop) {
                out.set(r.id, { species: crop, group: typeof a === "object" && a?.group ? a.group : null });
                return out;
            }
        }
    }
    return out;
}
function examplePlan(bundle, place, door, todayIso) {
    const site = scheduleSite(place.lat, place.lon, bundle, place.country ?? null);
    if (!site)
        return null;
    const year = seasonYearOf(todayIso, place.lat);
    const placeSite = { bed_m2: EXAMPLE_BED_M * EXAMPLE_BED_M, lat: place.lat, lon: place.lon, season_year: year };
    const bed = { region: EXAMPLE_BED_REGION, structure: EXAMPLE_BED_STRUCTURE };
    const status = (g) => guildStatus(g, EXAMPLE_BED_M, EXAMPLE_BED_M, bundle, EXAMPLE_BED_STRUCTURE, EXAMPLE_BED_REGION);
    const build = (g, overrides = new Map()) => {
        if (!status(g).fits)
            return null;
        const placed = guildPlantings(g, bed, placeSite, bundle, overrides);
        if (!placed.length)
            return null;
        const s = sowings(g, placed, site, place.lat, place.lon, year, bundle);
        if (!s)
            return null;
        const out = [];
        for (const p of placed) {
            const d = s.day(p);
            if (!d)
                return null;
            out.push({ ...p, sown: d });
        }
        return { team: g, overrides, dated: s.dated, plantings: out };
    };
    const rank = (pool, crop) => {
        const built = pool.map((g, i) => ({ g, i, b: build(g, crop ? cropOverride(g, crop) : undefined) }))
            .filter((x) => !!x.b);
        built.sort((a, b) => shortlistRank(a.g.derived_harmony?.band, status(a.g).tier) - shortlistRank(b.g.derived_harmony?.band, status(b.g).tier) || a.i - b.i);
        return built[0]?.b ?? null;
    };
    const pick = () => rank(browsableGuilds(bundle));
    const done = (b, d) => b ? { place, seasonYear: year, team: b.team, overrides: b.overrides, dated: b.dated, door: d, plantings: b.plantings } : null;
    const asked = door?.guild ? bundle.guilds.find((g) => g.id === door.guild) : undefined;
    if (asked) {
        const own = build(asked);
        if (own)
            return done(own, { kind: "guild", id: asked.id, outcome: "here" });
        let why = "notthere";
        if (!status(asked).fits) {
            const offer = status(asked).offer;
            const adapted = offer ? build(offer) : null;
            if (adapted)
                return done(adapted, { kind: "guild", id: asked.id, outcome: "adapted" });
            why = "nofit";
        }
        else if (!springPlantedTeam(asked, bundle))
            why = "undated";
        return done(pick(), { kind: "guild", id: asked.id, outcome: why });
    }
    const crop = door?.crop && bundle.species.some((s) => s.id === door.crop) ? door.crop : null;
    if (crop) {
        const holding = teamsHolding(crop, bundle);
        const withCrop = rank([...browsableGuilds(bundle), ...bundle.guilds.filter((g) => g.derived_from)]
            .filter((g) => holding.has(g.id)), crop);
        if (withCrop && withCrop.plantings.some((p) => p.species === crop))
            return done(withCrop, { kind: "crop", id: crop, outcome: "here" });
        const why = !holding.size ? "noteam"
            : bundle.guilds.some((g) => holding.has(g.id) && springPlantedTeam(g, bundle)) ? "notthere" : "undated";
        return done(pick(), { kind: "crop", id: crop, outcome: why });
    }
    return done(pick(), null);
}
function withPicks(plantings, todayIso, dtmOf) {
    return plantings.map((p) => {
        const dtm = dtmOf(p.species, p.cultivar_group);
        if (!dtm || p.sown > todayIso)
            return p;
        const picked = isoAdd(p.sown, dtm[0]);
        return picked <= todayIso ? { ...p, first_harvest: picked } : p;
    });
}
const DIARY_NEEDS = {
    "01-05": ["cold"], "01-19": ["cold"], "03-02": ["cold"], "03-30": ["cold", "northAmerica"],
    "05-23": ["frost"], "10-15": ["temperate"], "10-29": ["cold"], "11-26": ["cold"], "12-10": ["cold"], "12-24": ["temperate"],
};
function turnedMmdd(mmdd, lat) {
    if (!isSouthern(lat))
        return mmdd;
    const m = ((Number(mmdd.slice(0, 2)) - 1 + 6) % 12) + 1;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return `${pad(m)}-${pad(Math.min(Number(mmdd.slice(3, 5)), days))}`;
}
const coldMonthLow = (site) => {
    const lows = site.tmin_mly_c;
    return Array.isArray(lows) && lows.length === 12 && lows.every((x) => typeof x === "number") ? Math.min(...lows) : null;
};
const hotMonthHigh = (site) => {
    const highs = site.tmax_mly_c;
    return Array.isArray(highs) && highs.length === 12 && highs.every((x) => typeof x === "number") ? Math.max(...highs) : null;
};
function diaryLineHolds(needs, site, place) {
    for (const n of needs ?? []) {
        if (n === "cold") {
            const low = coldMonthLow(site);
            if (low == null || low > 0)
                return false;
        }
        if (n === "frost" && frostRare(site))
            return false;
        if (n === "temperate" && tropical(place.lat))
            return false;
        if (n === "northAmerica" && !(place.country ? ["US", "CA"].includes(place.country) : place.lon < -50 && place.lat > 15))
            return false;
    }
    return true;
}
function examplePastAt(place, site, bundle, seasonYear, notes, words) {
    const y = seasonYear - 1, lat = place.lat;
    const nextStart = seasonDate(isSouthern(lat) ? `${pad(SOUTH_SEASON_START_MONTH)}-01` : "01-01", seasonYear, lat);
    const inYear = (iso) => !!iso && iso < nextStart && iso >= seasonDate(isSouthern(lat) ? "07-01" : "01-01", y, lat);
    const obs = [];
    for (const n of notes) {
        if (!diaryLineHolds(DIARY_NEEDS[n.mmdd], site, place))
            continue;
        obs.push({ date: seasonDate(turnedMmdd(n.mmdd, lat), y, lat), event: "note", note: n.text });
    }
    const rare = frostRare(site);
    const lf = rare ? null : site.last_frost_32f?.p50 ?? null;
    const ff = rare ? null : site.first_freeze_32f_p50 ?? null;
    const spring = lf ? seasonDate(lf, y, lat) : null, fall = ff ? fallDate(ff, y, lat) : null;
    if (inYear(spring) && inYear(fall))
        obs.push({ date: spring, event: "frost", severity: "hard" }, { date: fall, event: "frost", severity: "hard" });
    const hot = hotMonthHigh(site);
    if (hot != null && hot >= 30)
        obs.push({ date: seasonDate(turnedMmdd("07-15", lat), y, lat), event: "heat" });
    const warm = rare ? warmthWindowsFor(site, lat, ["lactuca_sativa", "solanum_lycopersicum"], bundle) : {};
    const firstWarm = (sid) => {
        const m = seasonMonths(lat).find((mm) => warm[sid]?.months.includes(mm));
        return m == null ? null : seasonDate(`${pad(m)}-01`, y, lat);
    };
    const offs = bundle.rules.find((r) => r.id === "R-096")?.offset_days_before_last_frost;
    const lettuceLead = offs?.[String(resolveSpecies("lactuca_sativa", null, bundle).frost_tolerance)];
    const lettuceSown = spring ? isoAdd(spring, -(typeof lettuceLead === "number" && lettuceLead > 0 ? lettuceLead : 0)) : firstWarm("lactuca_sativa");
    const tomatoWarm = spring && lf ? warmTeamDays(site, lf, [{ sid: "solanum_lycopersicum", group: null }], bundle, lat, warmWait("solanum_lycopersicum", null, bundle)).days.get("solanum_lycopersicum|")?.mmdd : undefined;
    const tomatoSown = spring ? (tomatoWarm ? seasonDate(tomatoWarm, y, lat) : isoAdd(spring, warmWait("solanum_lycopersicum", null, bundle)))
        : firstWarm("solanum_lycopersicum");
    const plantings = [];
    if (inYear(lettuceSown)) {
        const first = isoAdd(lettuceSown, 54), last = isoAdd(lettuceSown, 82);
        if (inYear(last))
            plantings.push({ species: "lactuca_sativa", region: { shape: "rect", x: 0.2, y: 0.2, w: 0.5, h: 0.5 },
                sown: lettuceSown, first_harvest: first, last_harvest: last, end_cause: "pulled", end_date: last, notes: [{ date: first, text: words.lettuce }] });
    }
    if (inYear(tomatoSown)) {
        const first = isoAdd(tomatoSown, 64);
        const frostEnd = fall && fall > tomatoSown && fall <= isoAdd(tomatoSown, 240) ? fall : null;
        const end = frostEnd ?? isoAdd(tomatoSown, 129);
        if (inYear(end)) {
            const picked = first < end;
            plantings.push({ species: "solanum_lycopersicum", region: { shape: "rect", x: 0.75, y: 0.75, w: 1, h: 1 }, sown: tomatoSown,
                ...(picked ? { first_harvest: first } : {}), end_cause: frostEnd ? "frost" : "pulled", end_date: end,
                ...(picked ? { notes: [{ date: first, text: words.tomato }] } : {}) });
        }
    }
    obs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { observations: obs, plantings };
}

export { examplePastAt, examplePlan, withPicks };
