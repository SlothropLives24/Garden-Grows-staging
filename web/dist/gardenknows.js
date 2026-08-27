// "What your garden knows" (O28, approved 2026-07-30). One panel, on the Account page, beside the
// vendor-free Privacy Policy: every fact the gardener has handed over, what that fact is doing
// RIGHT NOW, what the next one buys, and where it lives.
//
// It is two things at once, deliberately. Read downward it is the earn grammar as a directory -
// the exchange ladder's whole trade laid out in one place instead of scattered across the surface
// that happens to need it. Read across the "where" column it is data transparency in the only form
// worth anything: not a policy promising what we could do, but an inventory of what is actually
// held. A privacy policy the user can check against.
//
// The discipline is earned.ts's, one step further: every row reads the SAME resolver the mechanism
// itself reads (frostCalibration, resolveGround/ladder, the stored beds and seasons), so a row can
// never claim a mechanism the app is not really running. `earned` lists only what fires today. A
// fact that has been given but buys nothing yet says so. Nothing here is aspirational.
//
// Pure and DOM-free, so the inventory is unit-testable and the Account page just renders rows.
import { frostCalibration } from "./engine/frostcalib.js";
import { ladder, resolveGround } from "./engine/soil.js";
import { area } from "./engine/regions.js";
/** The grounds soil is asked about: the whole garden, then each bed. Deliberately the same list
 *  the soil card's groundRows() builds, resolved through the same engine functions with the same
 *  arguments (structure matters - a container is asked what it is FILLED with; `src` matters - a
 *  later partial observation must not demote a ground that still holds its field test). That panel
 *  lives in the DOM layer, so this reads the engine directly rather than importing it; what must
 *  not drift is the RESOLVER call, and that is identical. */
function grounds(inp) {
    const list = [
        { region: null, structure: null },
        ...inp.beds.map((b) => ({ region: b.region, structure: b.structure ?? null })),
    ];
    return list.map((g) => {
        const r = resolveGround(inp.soilObservations, inp.plot, g.region);
        const obs = Object.keys(r.fields).length ? r.fields : null;
        const lad = ladder(obs, g.structure, r.src);
        const d = r.fields.drainage;
        return {
            rung: lad.rung,
            label: lad.label,
            recorded: obs !== null,
            // a superseded pH is already gone from `fields` - presence means the gate really fires
            ph: typeof r.fields.ph === "number",
            drainage: typeof d === "string" && d !== "unknown",
            next: lad.next ? { costs: lad.next.costs, buys: lad.next.buys } : null,
        };
    });
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// --- the rows ---------------------------------------------------------------
function locationRow(inp) {
    const where = "Stored with your garden. The climate figures come from a file built into the app - "
        + "no weather service is ever called, so nothing about your location is sent anywhere to get them.";
    if (!inp.site || inp.lat == null || inp.lon == null) {
        return { key: "location", label: "Where you are", held: false,
            given: "Nothing yet.",
            earned: [],
            next: "A ZIP or an address buys your climate card: frost dates, your hardiness zone, and the "
                + "day length that gates onions - and every sow date on the calendar counts from them.",
            where };
    }
    const earned = [];
    if (inp.site.last_frost_32f || inp.site.first_freeze_32f_p50) {
        earned.push("Frost dates - the last spring frost and first fall freeze at the nearest weather "
            + "station, and every sow and harvest date on the calendar counted from them.");
    }
    if (inp.zone) {
        earned.push(`Hardiness zone ${inp.zone} - which perennials survive your winter, and which are `
            + "shown as an annual you would replant.");
    }
    earned.push("Day length through your year - the photoperiod gate, which is latitude and not zone.");
    return { key: "location", label: "Where you are", held: true,
        given: `One latitude and longitude: ${inp.lat.toFixed(2)}, ${inp.lon.toFixed(2)}`
            + (inp.zone ? ` (zone ${inp.zone}).` : "."),
        earned,
        next: null,
        where };
}
function addressRow(inp) {
    const where = "Stored with your garden, and the text is shown back to you only. Looking it up and "
        + "loading map tiles are the two requests that leave this device, and they carry only what you "
        + "typed or the patch of ground you are looking at - never your beds, your plants, or your plans.";
    if (!inp.address && !inp.anchored) {
        return { key: "address", label: "Your address", held: false,
            given: "Nothing yet - the map is drawing a blank grid, which works fine.",
            earned: [],
            next: "An address buys the satellite view, so you trace beds on your actual yard instead of "
                + "sizing them on a grid.",
            where };
    }
    const earned = [
        "The satellite view under the map, so a bed can be traced where it really is.",
        "Your plot's frame: the fixed point every bed and every season is measured from. It is set "
            + "once and never moves, which is why your history survives rearranging the yard.",
    ];
    return { key: "address", label: "Your address", held: true,
        given: inp.address
            ? `The text you typed: ${inp.address}.` + (inp.anchored ? " Your plot is anchored to it." : "")
            : "No address text - your plot is anchored to a point you dropped on the map.",
        earned,
        next: null,
        where };
}
function groundRow(inp) {
    const where = "Stored with your garden. Beds are shapes in metres on your own plot frame; they are "
        + "never sent anywhere to be drawn.";
    if (inp.beds.length === 0) {
        return { key: "ground", label: "Your growing areas", held: false,
            given: "Nothing yet.",
            earned: [],
            next: "Two numbers - or one outline traced on the map - buys the fit verdict: whether a plant "
                + "team actually fits, and how many of each plant stand where.",
            where };
    }
    const total = inp.beds.reduce((sum, b) => sum + area(b.region), 0);
    const sized = inp.beds.filter((b) => b.sized).length;
    const earned = [
        "Fit verdicts - a team too big for the bed is shown greyed with the reason and the nearest "
            + "size that would take it, rather than quietly swapped for something smaller.",
        "Placement - how many of each plant the bed holds, and where each one stands in it.",
        "Rotation geometry. History attaches to the GROUND, not the bed, so redrawing a bed keeps "
            + "everything that ever grew on that patch.",
    ];
    const noSun = inp.beds.filter((b) => !b.sun).length;
    const next = sized > 0
        ? `${plural(sized, "area")} made from measurements rather than traced. Tracing one on the map `
            + "buys placement against your real yard - where the fence actually is."
        : noSun > 0
            ? `${plural(noSun, "area has", "areas have")} no shade noted. Saying a wall or a fence shades `
                + "one keeps the full-sun plants out of it."
            : null;
    return { key: "ground", label: "Your growing areas", held: true,
        given: `${plural(inp.beds.length, "growing area")}, ${inp.fmtArea(total)} in total`
            + (sized > 0 ? ` (${sized} sized, not yet traced).` : "."),
        earned, next, where };
}
function seasonsRow(inp) {
    const where = "Stored with your garden. Signed out this never leaves the device; signed in it syncs "
        + "to your account and is readable by no one else.";
    const plantings = inp.seasons.reduce((n, s) => n + (s.plantings?.length ?? 0), 0);
    const held = inp.seasons.length > 0 || inp.priorOccupancy > 0;
    if (!held) {
        return { key: "seasons", label: "What you have grown", held: false,
            given: "Nothing yet.",
            earned: [],
            next: "Logging what you plant buys the rotation check - a family that should not follow "
                + "itself gets flagged before you sow it, on the ground it actually grew on.",
            where };
    }
    const earned = [];
    if (plantings > 0 || inp.priorOccupancy > 0) {
        earned.push("The rotation check - what grew on each patch, so a family planted too soon after "
            + "itself is flagged with the interval and the reason.");
    }
    // R-093: the frost taps. Same resolver the supersession itself reads, so a row can never claim
    // a calibration the calendar is not really planning by.
    let next = null;
    if (inp.site) {
        const cal = frostCalibration(inp.seasons, inp.site);
        if (cal.spring.calibrated || cal.fall.calibrated) {
            earned.push("Your own frost dates. Enough seasons are logged that they supersede the national "
                + "model - the calendar plans by your ground now, not by the nearest station.");
        }
        else {
            const n = Math.max(cal.spring.n, cal.fall.n);
            const left = Math.max(0, cal.min_seasons - n);
            next = `${plural(left, "more logged season")} of frosts and your own dates supersede the `
                + "national model, for every sow date on the calendar.";
        }
    }
    const parts = [];
    if (inp.seasons.length)
        parts.push(plural(inp.seasons.length, "season"));
    if (plantings)
        parts.push(plural(plantings, "planting"));
    if (inp.priorOccupancy)
        parts.push(`${plural(inp.priorOccupancy, "patch", "patches")} of history you declared`);
    return { key: "seasons", label: "What you have grown", held: true,
        given: `${parts.join(", ")}.`,
        earned, next, where };
}
function soilRow(inp) {
    const where = "Stored with your garden. A lab report you type in is your reading, kept as you "
        + "entered it; it is never sent to anyone and never becomes part of the app's plant knowledge.";
    const all = grounds(inp);
    const recorded = all.filter((g) => g.recorded);
    if (recorded.length === 0) {
        return { key: "soil", label: "What you know about your soil", held: false,
            given: "Nothing recorded.",
            earned: [],
            next: "Describing the soil costs a tap and starts the ladder; a measured pH unlocks the "
                + "acidity verdicts for every plant standing in the bed.",
            where };
    }
    const earned = [];
    const phLive = recorded.some((g) => g.ph);
    const drainageLive = recorded.some((g) => g.drainage);
    // The lowest ground is the honest next ask - the same order the soil card sorts by.
    const lowest = all.reduce((a, b) => (b.rung < a.rung ? b : a));
    const rungLabels = recorded.map((g) => g.label);
    if (phLive) {
        earned.push("The acidity verdicts - a measured pH is on record, so each plant standing in that "
            + "ground is checked against the range it actually tolerates.");
    }
    if (drainageLive) {
        earned.push("The waterlogging warning, firing on your own answer about whether water stands.");
    }
    if (!phLive && !drainageLive) {
        earned.push("What you have described is on the record and shown back on the soil card, but it "
            + "gates nothing yet - the two things that change a recommendation are a measured pH and a "
            + "drainage answer.");
    }
    // Count, not name, when there are several grounds - a phone panel should not list ten rungs.
    const counted = new Map();
    for (const l of rungLabels)
        counted.set(l, (counted.get(l) ?? 0) + 1);
    const given = [...counted.entries()].map(([l, n]) => (n > 1 ? `${n} at ${l}` : l)).join(", ");
    return { key: "soil", label: "What you know about your soil", held: true,
        given: `${plural(recorded.length, "patch", "patches")} of ground on record: ${given}.`,
        earned,
        next: lowest.next ? `${lowest.next.costs} - ${lowest.next.buys}` : null,
        where };
}
// Bytes for a human, honestly coarse: photos are ~250 KB each, quotas are GBs - one decimal is
// plenty and false precision would imply a measurement the browser did not make.
const fmtBytes = (b) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
function photosRow(inp) {
    // The transparency column IS the feature here (D-171): photos are the first thing the app
    // holds that is not evidence for a rule, they never sync, and the engine never reads one.
    const where = "On this device only - photos never sync and never upload. They leave only inside "
        + "your own export, zipped beside the season file. The app never analyses a photo; it is your "
        + "record, not the engine's input."
        + (inp.photos.usage != null && inp.photos.quota != null
            ? ` This device says its storage holds ${fmtBytes(inp.photos.usage)} of the ${fmtBytes(inp.photos.quota)} it allows this app.`
            : " This browser does not say how much storage it allows, so no number is promised here.");
    if (inp.photos.count === 0) {
        return { key: "photos", label: "Photos", held: false,
            given: "None yet.",
            earned: [],
            next: "A photo pins what a note describes - the leaf, the damage, the bed in June - dated, "
                + "on the plant it belongs to, shown on the season diary. Downscaled on capture to about "
                + "250 KB; there is no cap on how many.",
            where };
    }
    return { key: "photos", label: "Photos", held: true,
        given: `${plural(inp.photos.count, "photo")} on this garden's seasons.`,
        earned: ["They show on the plant and the season diary, and ride the export zipped beside the "
                + "season file - which is also how they survive a lost phone."],
        next: null,
        where };
}
function plantsRow(inp) {
    const where = "Stored with your garden. The app's plant knowledge is a public file built into the "
        + "app; anything you add stays yours and never mixes into it.";
    if (inp.userSpecies === 0) {
        return { key: "plants", label: "Plants you added", held: false,
            given: "None - you are using the built-in plant knowledge as it ships.",
            earned: [],
            next: "Adding a variety the app does not carry buys it a place in your beds and your calendar. "
                + "Each detail you fill in - spacing, days to maturity - unlocks another check for it.",
            where };
    }
    return { key: "plants", label: "Plants you added", held: true,
        given: `${plural(inp.userSpecies, "variety", "varieties")} of your own.`,
        earned: ["Your varieties plan, place and schedule like any other plant, on whatever details you "
                + "gave them. Where a detail is missing, the app says so rather than guessing it."],
        next: null,
        where };
}
function accountRow(inp) {
    if (!inp.signedIn) {
        return { key: "account", label: "Your account", held: false,
            given: "Not signed in. Nothing above has left this device.",
            earned: [],
            next: "An account buys keeping: the same ledger on your phone and your laptop, and a backup "
                + "you do not have to remember to export.",
            where: "Nothing to store - there is no account yet." };
    }
    return { key: "account", label: "Your account", held: true,
        given: `Signed in as ${inp.email ?? "your account"}.`,
        earned: ["Keeping. Your gardens, growing areas and seasons follow you to any device you sign in on."],
        next: null,
        where: "An email address and your garden records. Readable only by your own account, and "
            + "deleting the account removes them in one tap." };
}
function displayRow(inp) {
    const remind = inp.prefs.remind === "none" ? "no calendar reminders" : `${inp.prefs.remind} reminders`;
    return { key: "display", label: "Display preferences", held: true,
        given: `${inp.prefs.units}, ${inp.prefs.temp}, ${inp.prefs.theme} theme, ${remind}.`,
        earned: ["Nothing. These change how a number is shown to you, never what the app recommends - "
                + "the engine works in metres either way."],
        next: null,
        where: "Kept on this device; once you are signed in they follow your account." };
}
/** The full inventory, in the order the journey asks for it. Every row is present every time -
 *  a fact you have not given is a row that says so, because the point of the panel is that the
 *  list is complete. */
export function gardenKnows(inp) {
    return [
        locationRow(inp),
        addressRow(inp),
        groundRow(inp),
        seasonsRow(inp),
        soilRow(inp),
        photosRow(inp),
        plantsRow(inp),
        accountRow(inp),
        displayRow(inp),
    ];
}
/** One line above the panel: how much of the exchange has actually happened. Counts only the
 *  facts the gardener supplies - display preferences always exist and are not a disclosure. */
export function knowsSummary(rows) {
    const facts = rows.filter((r) => r.key !== "display");
    const held = facts.filter((r) => r.held).length;
    if (held === 0) {
        return `Nothing yet. This is everything the app can ever hold about your garden - `
            + `${facts.length} facts, each one optional, each one shown here with exactly what it buys.`;
    }
    return `${held} of ${facts.length} given. Every one was optional, and this is the whole list - `
        + "what you handed over, what it is doing, and what the next one would buy.";
}
