import { deletePlot, deleteSeason, getPlot, listSeasons, putPlot, putSeason } from "./storage.js";
import { guildPlantings } from "./plan.js";
export const EXAMPLE_PLOT_ID = "plot_example";
export const isExamplePlot = (id) => id === EXAMPLE_PLOT_ID;
export function examplePastSeasons(year) {
    const y = year - 1;
    const on = (mmdd) => `${y}-${mmdd}`;
    const note = (mmdd, text) => ({ date: on(mmdd), event: "note", note: text });
    return [{
            id: y, plot: EXAMPLE_PLOT_ID,
            observations: [
                note("01-05", "Ordered the seeds by the woodstove, already dreaming of tomatoes."),
                note("01-19", "Sharpened and oiled the tools - a quiet job for a cold day."),
                note("02-02", "Started the onions under the grow light in the basement."),
                note("02-16", "Seed potatoes chitting on the windowsill, pale green shoots."),
                note("03-02", "Turned the compost and it steamed in the cold air."),
                note("03-30", "First robin back. Raked the beds clear of winter."),
                note("04-13", "Hardening off the seedlings on the porch, in and out each day."),
                { date: on("04-25"), event: "frost", severity: "hard" },
                note("05-23", "Set the peppers out once the frosty nights were behind us."),
                note("06-20", "Strawberries blushing red - netted them against the birds."),
                note("07-04", "Hilled the potatoes and mulched everything deep against the heat."),
                { date: on("07-15"), event: "heat" },
                note("08-08", "Beans by the basketful; the kitchen smells of canning tomatoes."),
                note("08-22", "Braided the garlic and hung it to cure in the shed."),
                note("09-05", "Saved seed from the best tomato, labelled and drying on the sill."),
                note("09-19", "Pulled the spent vines and sowed a quick cover crop."),
                { date: on("10-01"), event: "frost", severity: "hard" },
                note("10-15", "Raked the leaves over the beds to feed the ground all winter."),
                note("10-29", "Planted next year's garlic just before the ground went hard."),
                note("11-12", "Cleaned and stored the stakes and cages under cover."),
                note("11-26", "First real snow. A white quilt over every bed."),
                note("12-10", "Back at the catalog by the fire, planning next year's beds."),
                note("12-24", "Solstice past - the days are getting longer. Two months to onion-sowing."),
            ],
            plantings: [
                {
                    species: "lactuca_sativa",
                    region: { shape: "rect", x: 0.2, y: 0.2, w: 0.5, h: 0.5 },
                    sown: on("03-16"), first_harvest: on("05-09"), last_harvest: on("06-06"),
                    end_cause: "pulled", end_date: on("06-06"),
                    notes: [{ date: on("05-09"), text: "the first cutting of lettuce, sweet before the heat" }],
                },
                {
                    species: "solanum_lycopersicum",
                    region: { shape: "rect", x: 0.75, y: 0.75, w: 1, h: 1 },
                    sown: on("05-25"), first_harvest: on("07-28"),
                    end_cause: "frost", end_date: on("10-01"),
                    notes: [{ date: on("07-28"), text: "the first ripe one, eaten in the garden" }],
                },
            ],
        }];
}
const BED = { name: "Main bed", region: { shape: "rect", x: 0, y: 0, w: 2.5, h: 2.5 } };
const ANCHOR = { lat: 39.83, lon: -98.58 };
const ADDRESS = "Lebanon, Kansas";
export async function seedExampleGarden(db, year, bundle) {
    if (await getPlot(db, EXAMPLE_PLOT_ID))
        return;
    const plot = {
        id: EXAMPLE_PLOT_ID,
        name: "Example garden",
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
    const team = guild ? guildPlantings(guild, { name: BED.name, region: { ...BED.region } }, site, bundle) : [];
    await putSeason(db, {
        id: year, plot: EXAMPLE_PLOT_ID, observations: [],
        plantings: team.map((p) => ({ ...p, sown: `${year}-05-20` })),
    });
}
export async function removeExampleGarden(db) {
    for (const s of await listSeasons(db)) {
        if (s.plot === EXAMPLE_PLOT_ID)
            await deleteSeason(db, s.plot, s.id);
    }
    await deletePlot(db, EXAMPLE_PLOT_ID);
}
