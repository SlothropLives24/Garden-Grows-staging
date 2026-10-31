import './chunk-lutet8cz.js';
import { confidenceWord, fmtKm, stationLabel, climateCaveat, datesStationOf, modelSite, frostRare, frostGiven } from './core.js';
import { copy, fillCopy, stationDisplay } from './paint.js';

function provFacts(clim) {
    const site = clim.site;
    const stn = (site.provenance?.station ?? null);
    return {
        rare: frostRare(site) && !frostGiven(site),
        stationName: stn?.name ? stationDisplay(stn.name) : null,
        given: !!site.own_window,
        distanceKm: clim.distanceKm,
        grade: clim.effectiveGrade,
        modeled: modelSite(site),
        datesStation: datesStationOf(site),
    };
}
function climateProv(a) {
    const word = confidenceWord(a.grade) ?? a.grade;
    return a.given ? copy.anGivenProv
        : a.datesStation ? fillCopy(a.rare ? "anProvDatesRare" : "anProvDates", { station: stationLabel(a.datesStation), dist: fmtKm(a.datesStation.km), word, years: a.datesStation.years })
            : a.stationName
                ? fillCopy(a.distanceKm > 2 ? "anProvStationFar" : "anProvStation", { station: a.stationName, dist: fmtKm(a.distanceKm), word })
                : `${a.modeled ? fillCopy("anModelCaveat", { dist: fmtKm(a.distanceKm) }) : climateCaveat(a.distanceKm)} ${word}.`;
}

export { climateProv, provFacts };
