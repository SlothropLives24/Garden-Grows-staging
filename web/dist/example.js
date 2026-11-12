import './chunk-d7aiu626.js';
import { listSeasons, deleteSeason, deletePlot, getPlot, putPlot, putSeason, guildPlantings, livingSupportLead } from './core.js';
import { copy, EXAMPLE_PLOT_ID } from './paint.js';
export { isExamplePlot } from './paint.js';
import { EXAMPLE_BED_STRUCTURE, EXAMPLE_BED_REGION } from './chunk-bm4hdmsn.js';
import './chunk-lon4wgf3.js';

const exampleNotes = () => [
    ["01-05", copy.exampleNote0105], ["01-19", copy.exampleNote0119], ["02-02", copy.exampleNote0202], ["02-16", copy.exampleNote0216],
    ["03-02", copy.exampleNote0302], ["03-30", copy.exampleNote0330], ["04-13", copy.exampleNote0413], ["05-23", copy.exampleNote0523],
    ["06-20", copy.exampleNote0620], ["07-04", copy.exampleNote0704], ["08-08", copy.exampleNote0808], ["08-22", copy.exampleNote0822],
    ["09-05", copy.exampleNote0905], ["09-19", copy.exampleNote0919], ["10-15", copy.exampleNote1015], ["10-29", copy.exampleNote1029],
    ["11-12", copy.exampleNote1112], ["11-26", copy.exampleNote1126], ["12-10", copy.exampleNote1210], ["12-24", copy.exampleNote1224],
].map(([mmdd, text]) => ({ mmdd, text }));
function examplePastSeasons(year) {
    const y = year - 1;
    const on = (mmdd) => `${y}-${mmdd}`;
    const notes = exampleNotes().map((n) => ({ date: on(n.mmdd), event: "note", note: n.text }));
    const marks = [
        { date: on("04-25"), event: "frost", severity: "hard" },
        { date: on("07-15"), event: "heat" },
        { date: on("10-01"), event: "frost", severity: "hard" },
    ];
    return [{
            id: y, plot: EXAMPLE_PLOT_ID,
            observations: [...notes, ...marks].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
            plantings: [
                {
                    species: "lactuca_sativa",
                    region: { shape: "rect", x: 0.2, y: 0.2, w: 0.5, h: 0.5 },
                    sown: on("03-16"), first_harvest: on("05-09"), last_harvest: on("06-06"),
                    end_cause: "pulled", end_date: on("06-06"),
                    notes: [{ date: on("05-09"), text: copy.exampleLettuceNote }],
                },
                {
                    species: "solanum_lycopersicum",
                    region: { shape: "rect", x: 0.75, y: 0.75, w: 1, h: 1 },
                    sown: on("05-25"), first_harvest: on("07-28"),
                    end_cause: "frost", end_date: on("10-01"),
                    notes: [{ date: on("07-28"), text: copy.exampleTomatoNote }],
                },
            ],
        }];
}
const BED = { name: copy.exampleBedName, region: { shape: "rect", x: 0, y: 0, w: 2.4384, h: 2.4384 } };
const ANCHOR = { lat: 39.83, lon: -98.58 };
const ADDRESS = "Lebanon, Kansas";
function exampleThisSeason(team, year, todayIso, dtmOf, climber) {
    const plusDays = (iso, n) => {
        const d = new Date(`${iso}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    };
    const teamDay = `${year}-05-20`;
    return team.map((p) => {
        const sown = climber && p.species === climber.species ? plusDays(teamDay, climber.days) : teamDay;
        const dtm = dtmOf(p.species, p.cultivar_group);
        if (!dtm)
            return { ...p, sown };
        const picked = plusDays(sown, dtm[0]);
        return picked <= todayIso ? { ...p, sown, first_harvest: picked } : { ...p, sown };
    });
}
const EXAMPLE_FALL = { species: "brassica_rapa", region: { shape: "rect", x: 0.2, y: 2.2, w: 2.0, h: 0.2 }, sown: "08-20" };
function exampleFallPlanting(year, todayIso, dtmOf) {
    const sown = `${year}-${EXAMPLE_FALL.sown}`;
    if (sown > todayIso)
        return [];
    const planting = { species: EXAMPLE_FALL.species, region: { ...EXAMPLE_FALL.region }, sown };
    const dtm = dtmOf(EXAMPLE_FALL.species, null);
    if (!dtm)
        return [planting];
    const d = new Date(`${sown}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dtm[0]);
    const picked = d.toISOString().slice(0, 10);
    return picked <= todayIso ? [{ ...planting, first_harvest: picked }] : [planting];
}
async function seedExampleGarden(db, year, bundle, todayIso, dtmOf, at) {
    if (await getPlot(db, EXAMPLE_PLOT_ID))
        return null;
    if (at)
        return seedExampleAt(db, bundle, at.plan, at.site, todayIso ?? `${at.plan.seasonYear}-12-31`, dtmOf ?? (() => null));
    const plot = {
        id: EXAMPLE_PLOT_ID,
        name: copy.exampleGardenName,
        example: true,
        address: ADDRESS,
        anchor: { ...ANCHOR },
        beds: [{ name: BED.name, region: { ...BED.region } }],
    };
    await putPlot(db, plot);
    for (const s of examplePastSeasons(year))
        await putSeason(db, s);
    const guild = bundle.guilds.find((g) => g.id === "three_sisters");
    const site = { bed_m2: BED.region.w * BED.region.h, lat: ANCHOR.lat, lon: ANCHOR.lon, season_year: year };
    const team = guild ? guildPlantings(guild, { region: { ...BED.region } }, site, bundle) : [];
    const lead = guild ? livingSupportLead(guild, bundle) : null;
    const climber = lead?.lead_days ? { species: lead.climber, days: lead.lead_days } : null;
    await putSeason(db, {
        id: year, plot: EXAMPLE_PLOT_ID, observations: [],
        plantings: todayIso && dtmOf
            ? [...exampleThisSeason(team, year, todayIso, dtmOf, climber),
                ...exampleFallPlanting(year, todayIso, dtmOf)]
            : exampleThisSeason(team, year, `${year}-12-31`, () => null, climber),
        ...(guild ? { planted_from: [{ area: BED.name, guild: guild.id }] } : {}),
    });
    return 2;
}
async function seedExampleAt(db, bundle, plan, site, todayIso, dtmOf) {
    const name = copy.exampleBedName;
    await putPlot(db, {
        id: EXAMPLE_PLOT_ID, name: copy.exampleGardenName, example: true,
        address: plan.place.label, anchor: { lat: plan.place.lat, lon: plan.place.lon },
        ...(plan.place.country ? { country: plan.place.country } : {}),
        beds: [{ name, region: { ...EXAMPLE_BED_REGION }, structure: EXAMPLE_BED_STRUCTURE }],
    });
    const { examplePastAt, withPicks } = await import('./exampleplace.js');
    const past = examplePastAt(plan.place, site, bundle, plan.seasonYear, exampleNotes(), { lettuce: copy.exampleLettuceNote, tomato: copy.exampleTomatoNote });
    await putSeason(db, { id: plan.seasonYear - 1, plot: EXAMPLE_PLOT_ID, observations: past.observations, plantings: past.plantings });
    await putSeason(db, {
        id: plan.seasonYear, plot: EXAMPLE_PLOT_ID, observations: [],
        plantings: withPicks(plan.plantings.map((p) => ({ ...p })), todayIso, dtmOf),
        planted_from: [{ area: name, guild: plan.team.id }],
    });
    return past.observations.filter((o) => o.event === "frost").length;
}
async function removeExampleGarden(db) {
    for (const s of await listSeasons(db)) {
        if (s.plot === EXAMPLE_PLOT_ID)
            await deleteSeason(db, s.plot, s.id);
    }
    await deletePlot(db, EXAMPLE_PLOT_ID);
}

export { EXAMPLE_FALL, EXAMPLE_PLOT_ID, exampleFallPlanting, examplePastSeasons, exampleThisSeason, removeExampleGarden, seedExampleGarden };
