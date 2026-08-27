// The "Show me an example" garden (D-029): a real, disposable, NON-SYNCING demo garden so a
// first-time visitor sees a located, planted, cited plan - guild cards, the climate/frost card, the
// Calendar, and rotation history - before entering anything of their own. It is a normal stored
// garden (every surface reads storage, so nothing is faked), flagged `example` so account sync SKIPS
// it (account.ts) and a one-tap "Remove example" can clear it. Pure app-layer demo data; the corpus
// is untouched.
import { deletePlot, deleteSeason, getPlot, listSeasons, putPlot, putSeason } from "./storage.js";
import { guildPlantings } from "./plan.js";
export const EXAMPLE_PLOT_ID = "plot_example";
export const isExamplePlot = (id) => id === EXAMPLE_PLOT_ID;
// Just past the Three Sisters footprint (4 m2): a compact 2.5 x 2.5 m (6.25 m2) bed places the guild
// as its minimal 2x2 four-mound block (the R-001 pollination block) rather than a wider mound grid.
const BED = { name: "Main bed", region: { shape: "rect", x: 0, y: 0, w: 2.5, h: 2.5 } };
// ~geographic centre of the contiguous US, in Kansas (near Lebanon) - a clear four-season location. A
// friendly address so the "where" label reads as a place, not the nearest NCEI station's raw id.
const ANCHOR = { lat: 39.83, lon: -98.58 };
const ADDRESS = "Lebanon, Kansas";
/** Seed the example garden if it isn't already present. Idempotent. `year` is the current year and
 *  `bundle` drives the real Three Sisters placement, so the demo mirrors exactly what a user gets. */
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
    // Last year: a tomato on this ground, ended by fall frost - gives the rotation history panel content.
    await putSeason(db, {
        id: year - 1, plot: EXAMPLE_PLOT_ID, observations: [],
        plantings: [{
                species: "solanum_lycopersicum",
                region: { shape: "rect", x: 0.75, y: 0.75, w: 1, h: 1 },
                sown: `${year - 1}-05-25`, end_cause: "frost", end_date: `${year - 1}-10-01`,
            }],
    });
    // This season: the Three Sisters, PLACED by the real engine so the whole team shows on the map, Plan,
    // and Log (matching the legend) - not one stacked dot. The engine reads only site.lat (+ bed area) to
    // orient the layout, so a minimal Site from the anchor is enough.
    const guild = bundle.guilds.find((g) => g.id === "three_sisters");
    const site = { bed_m2: BED.region.w * BED.region.h, lat: ANCHOR.lat, lon: ANCHOR.lon, season_year: year };
    const team = guild ? guildPlantings(guild, { name: BED.name, region: { ...BED.region } }, site, bundle) : [];
    await putSeason(db, {
        id: year, plot: EXAMPLE_PLOT_ID, observations: [],
        plantings: team.map((p) => ({ ...p, sown: `${year}-05-20` })),
    });
}
/** Tear the example garden down entirely - both seasons and the plot. */
export async function removeExampleGarden(db) {
    for (const s of await listSeasons(db)) {
        if (s.plot === EXAMPLE_PLOT_ID)
            await deleteSeason(db, s.plot, s.id);
    }
    await deletePlot(db, EXAMPLE_PLOT_ID);
}
