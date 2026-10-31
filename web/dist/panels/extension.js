import '../chunk-lutet8cz.js';
import { $, app, getPlot, placeCountry, putPlot, fmtMonthDayYear } from '../core.js';
import { copy, fillCopy, fillNodes, showingOriginals, appLang } from '../paint.js';
import '../chunk-l5cseoso.js';

const NATIONAL_DIRECTORY = "https://www.nifa.usda.gov/about-nifa/how-we-work/extension";
const EXTENSION_STATES = [
    { c: "AL", name: "Alabama", inst: "Alabama Cooperative Extension System", url: "https://www.aces.edu", lat: 32.8, lon: -86.8, bb: [30.2, 35.0, -88.5, -84.9] },
    { c: "AK", name: "Alaska", inst: "UAF Cooperative Extension Service", url: "https://www.uaf.edu/ces", lat: 64.2, lon: -152, bb: [51.2, 71.5, -179.1, -129.9] },
    { c: "AZ", name: "Arizona", inst: "University of Arizona Cooperative Extension", url: "https://extension.arizona.edu", lat: 34.3, lon: -111.7, bb: [31.3, 37.0, -114.8, -109] },
    { c: "AR", name: "Arkansas", inst: "University of Arkansas System Division of Agriculture", url: null, lat: 34.9, lon: -92.4, bb: [33.0, 36.5, -94.6, -89.6] },
    { c: "CA", name: "California", inst: "UC Agriculture & Natural Resources", url: "https://ucanr.edu", lat: 37.2, lon: -119.4, bb: [32.5, 42.0, -124.4, -114.1] },
    { c: "CO", name: "Colorado", inst: "Colorado State University Extension", url: "https://extension.colostate.edu", lat: 39.0, lon: -105.5, bb: [37.0, 41.0, -109.06, -102.04] },
    { c: "CT", name: "Connecticut", inst: "UConn Extension", url: null, lat: 41.6, lon: -72.7, bb: [40.98, 42.05, -73.73, -71.79] },
    { c: "DE", name: "Delaware", inst: "University of Delaware Cooperative Extension", url: null, lat: 39.0, lon: -75.5, bb: [38.45, 39.84, -75.79, -75.05] },
    { c: "FL", name: "Florida", inst: "UF/IFAS Extension", url: "https://sfyl.ifas.ufl.edu", lat: 28.6, lon: -82.4, bb: [24.5, 31.0, -87.6, -80] },
    { c: "GA", name: "Georgia", inst: "University of Georgia Extension", url: "https://extension.uga.edu", lat: 32.6, lon: -83.4, bb: [30.36, 35.0, -85.6, -80.84] },
    { c: "HI", name: "Hawaii", inst: "UH Manoa CTAHR Cooperative Extension", url: null, lat: 20.3, lon: -156.4, bb: [18.9, 22.24, -160.3, -154.8] },
    { c: "ID", name: "Idaho", inst: "University of Idaho Extension", url: "https://www.uidaho.edu/extension", lat: 44.4, lon: -114.6, bb: [42.0, 49.0, -117.24, -111.04] },
    { c: "IL", name: "Illinois", inst: "University of Illinois Extension", url: "https://extension.illinois.edu", lat: 40.0, lon: -89.2, bb: [36.97, 42.51, -91.51, -87.02] },
    { c: "IN", name: "Indiana", inst: "Purdue Extension", url: "https://extension.purdue.edu", lat: 39.9, lon: -86.3, bb: [37.77, 41.76, -88.1, -84.78] },
    { c: "IA", name: "Iowa", inst: "Iowa State University Extension and Outreach", url: "https://www.extension.iastate.edu", lat: 42.0, lon: -93.5, bb: [40.38, 43.5, -96.64, -90.14] },
    { c: "KS", name: "Kansas", inst: "K-State Research and Extension", url: "https://extension.k-state.edu/", lat: 38.5, lon: -98.4, bb: [37.0, 40.0, -102.05, -94.59] },
    { c: "KY", name: "Kentucky", inst: "University of Kentucky Cooperative Extension", url: "https://extension.mgcafe.uky.edu/", lat: 37.5, lon: -85.3, bb: [36.5, 39.15, -89.57, -81.96] },
    { c: "LA", name: "Louisiana", inst: "LSU AgCenter", url: "https://www.lsuagcenter.com", lat: 31.0, lon: -92, bb: [28.9, 33.02, -94.04, -88.8] },
    { c: "ME", name: "Maine", inst: "University of Maine Cooperative Extension", url: "https://extension.umaine.edu", lat: 45.4, lon: -69.2, bb: [43.06, 47.46, -71.08, -66.95] },
    { c: "MD", name: "Maryland", inst: "University of Maryland Extension", url: "https://extension.umd.edu", lat: 39.0, lon: -76.8, bb: [37.9, 39.72, -79.49, -75.05] },
    { c: "MA", name: "Massachusetts", inst: "UMass Amherst Extension", url: "https://www.umass.edu/agriculture-food-environment/", lat: 42.3, lon: -71.8, bb: [41.24, 42.89, -73.51, -69.93] },
    { c: "MI", name: "Michigan", inst: "Michigan State University Extension", url: "https://www.canr.msu.edu", lat: 44.3, lon: -85.4, bb: [41.7, 48.3, -90.42, -82.41] },
    { c: "MN", name: "Minnesota", inst: "University of Minnesota Extension", url: "https://extension.umn.edu", lat: 46.3, lon: -94.3, bb: [43.5, 49.4, -97.24, -89.49] },
    { c: "MS", name: "Mississippi", inst: "Mississippi State University Extension", url: "https://extension.msstate.edu", lat: 32.7, lon: -89.7, bb: [30.17, 35.0, -91.66, -88.1] },
    { c: "MO", name: "Missouri", inst: "University of Missouri Extension", url: "https://extension.missouri.edu", lat: 38.4, lon: -92.5, bb: [35.99, 40.61, -95.77, -89.1] },
    { c: "MT", name: "Montana", inst: "Montana State University Extension", url: "https://www.montana.edu/extension", lat: 47.0, lon: -109.6, bb: [44.36, 49.0, -116.05, -104.04] },
    { c: "NE", name: "Nebraska", inst: "Nebraska Extension", url: "https://extension.unl.edu", lat: 41.5, lon: -99.8, bb: [40.0, 43.0, -104.05, -95.31] },
    { c: "NV", name: "Nevada", inst: "University of Nevada, Reno Extension", url: "https://extension.unr.edu", lat: 39.3, lon: -116.9, bb: [35.0, 42.0, -120, -114.04] },
    { c: "NH", name: "New Hampshire", inst: "UNH Cooperative Extension", url: "https://extension.unh.edu", lat: 43.7, lon: -71.6, bb: [42.7, 45.31, -72.56, -70.6] },
    { c: "NJ", name: "New Jersey", inst: "Rutgers Cooperative Extension (NJAES)", url: "https://njaes.rutgers.edu", lat: 40.1, lon: -74.5, bb: [38.93, 41.36, -75.56, -73.89] },
    { c: "NM", name: "New Mexico", inst: "NMSU Cooperative Extension Service", url: "https://aces.nmsu.edu", lat: 34.4, lon: -106.1, bb: [31.33, 37.0, -109.05, -103] },
    { c: "NY", name: "New York", inst: "Cornell Cooperative Extension", url: "https://cals.cornell.edu/cornell-cooperative-extension", lat: 42.9, lon: -75.5, bb: [40.5, 45.02, -79.76, -71.86] },
    { c: "NC", name: "North Carolina", inst: "NC State Extension", url: "https://www.ces.ncsu.edu", lat: 35.5, lon: -79.4, bb: [33.84, 36.59, -84.32, -75.46] },
    { c: "ND", name: "North Dakota", inst: "NDSU Extension", url: "https://www.ndsu.edu/agriculture/extension", lat: 47.4, lon: -100.5, bb: [45.94, 49.0, -104.05, -96.55] },
    { c: "OH", name: "Ohio", inst: "Ohio State University Extension", url: "https://extension.osu.edu", lat: 40.3, lon: -82.8, bb: [38.4, 42.0, -84.82, -80.52] },
    { c: "OK", name: "Oklahoma", inst: "Oklahoma State University Extension", url: "https://extension.okstate.edu", lat: 35.6, lon: -97.5, bb: [33.62, 37.0, -103, -94.43] },
    { c: "OR", name: "Oregon", inst: "Oregon State University Extension Service", url: "https://extension.oregonstate.edu", lat: 44.0, lon: -120.6, bb: [41.99, 46.29, -124.57, -116.46] },
    { c: "PA", name: "Pennsylvania", inst: "Penn State Extension", url: "https://extension.psu.edu", lat: 40.9, lon: -77.8, bb: [39.72, 42.27, -80.52, -74.69] },
    { c: "RI", name: "Rhode Island", inst: "URI Cooperative Extension", url: null, lat: 41.7, lon: -71.5, bb: [41.15, 42.02, -71.86, -71.12] },
    { c: "SC", name: "South Carolina", inst: "Clemson Cooperative Extension", url: "https://www.clemson.edu/extension", lat: 33.9, lon: -80.9, bb: [32.03, 35.22, -83.35, -78.54] },
    { c: "SD", name: "South Dakota", inst: "SDSU Extension", url: "https://extension.sdstate.edu", lat: 44.4, lon: -100.2, bb: [42.48, 45.94, -104.06, -96.44] },
    { c: "TN", name: "Tennessee", inst: "UT Extension", url: "https://utextension.tennessee.edu/", lat: 35.9, lon: -86.4, bb: [34.98, 36.68, -90.31, -81.65] },
    { c: "TX", name: "Texas", inst: "Texas A&M AgriLife Extension", url: "https://agrilifeextension.tamu.edu", lat: 31.5, lon: -99.3, bb: [25.84, 36.5, -106.65, -93.51] },
    { c: "UT", name: "Utah", inst: "Utah State University Extension", url: "https://extension.usu.edu", lat: 39.3, lon: -111.7, bb: [37.0, 42.0, -114.05, -109.04] },
    { c: "VT", name: "Vermont", inst: "University of Vermont Extension", url: "https://www.uvm.edu/extension", lat: 44.1, lon: -72.7, bb: [42.73, 45.02, -73.44, -71.46] },
    { c: "VA", name: "Virginia", inst: "Virginia Cooperative Extension", url: "https://ext.vt.edu", lat: 37.5, lon: -78.9, bb: [36.54, 39.47, -83.68, -75.24] },
    { c: "WA", name: "Washington", inst: "Washington State University Extension", url: "https://extension.wsu.edu", lat: 47.4, lon: -120.5, bb: [45.54, 49.0, -124.85, -116.92] },
    { c: "WV", name: "West Virginia", inst: "WVU Extension", url: "https://extension.wvu.edu", lat: 38.6, lon: -80.6, bb: [37.2, 40.64, -82.64, -77.72] },
    { c: "WI", name: "Wisconsin", inst: "University of Wisconsin–Madison Division of Extension", url: "https://extension.wisc.edu", lat: 44.6, lon: -89.9, bb: [42.49, 47.31, -92.89, -86.81] },
    { c: "WY", name: "Wyoming", inst: "University of Wyoming Extension", url: "https://www.uwyo.edu/uwe", lat: 43.0, lon: -107.5, bb: [40.99, 45.01, -111.06, -104.05] },
    { c: "DC", name: "District of Columbia", inst: "UDC Cooperative Extension Service", url: null, lat: 38.9, lon: -77, bb: [38.79, 38.996, -77.12, -76.91] },
];

const OUTLINE_URL = "../build/country-outline.json";
let rings = null;
let reachKm = 30;
function setOutline(o) {
    const out = [];
    for (const [c, list] of Object.entries(o.countries)) {
        for (const flat of list) {
            const xy = [];
            let x = 0, y = 0;
            const bb = [Infinity, -Infinity, Infinity, -Infinity];
            for (let i = 0; i < flat.length; i += 2) {
                x += flat[i];
                y += flat[i + 1];
                const lon = x / o.q, lat = y / o.q;
                xy.push(lon, lat);
                bb[0] = Math.min(bb[0], lon);
                bb[1] = Math.max(bb[1], lon);
                bb[2] = Math.min(bb[2], lat);
                bb[3] = Math.max(bb[3], lat);
            }
            out.push({ c, xy, bb });
        }
    }
    rings = out;
    reachKm = o.reach_km;
}
function inside(r, lon, lat) {
    const p = r.xy;
    let odd = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const yi = p[i + 1], yj = p[j + 1];
        if (yi > lat !== yj > lat && lon < ((p[j] - p[i]) * (lat - yi)) / (yj - yi) + p[i])
            odd = !odd;
    }
    return odd;
}
function edgeKm(r, lon, lat) {
    const k = Math.cos((lat * Math.PI) / 180);
    const p = r.xy;
    let best = Infinity;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const ax = p[j] * k, ay = p[j + 1], bx = p[i] * k, by = p[i + 1], px = lon * k;
        const dx = bx - ax, dy = by - ay;
        const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy))) : 0;
        best = Math.min(best, Math.hypot(px - (ax + t * dx), lat - (ay + t * dy)));
    }
    return best * 111.2;
}
function countryAt(lat, lon) {
    if (!rings)
        return null;
    const odd = new Map();
    for (const r of rings) {
        if (lon < r.bb[0] || lon > r.bb[1] || lat < r.bb[2] || lat > r.bb[3])
            continue;
        if (inside(r, lon, lat))
            odd.set(r.c, !odd.get(r.c));
    }
    for (const [c, v] of odd)
        if (v)
            return c;
    const pad = reachKm / 111.2 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
    let best = reachKm, found = "";
    for (const r of rings) {
        if (lon < r.bb[0] - pad || lon > r.bb[1] + pad || lat < r.bb[2] - pad || lat > r.bb[3] + pad)
            continue;
        const d = edgeKm(r, lon, lat);
        if (d <= best) {
            best = d;
            found = r.c;
        }
    }
    return found;
}
let loading = null;
function loadOutline() {
    if (rings)
        return Promise.resolve(true);
    loading ??= fetch(OUTLINE_URL)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((o) => { setOutline(o); return true; }, () => false)
        .finally(() => { loading = null; });
    return loading;
}

const LOCAL_HELP_UI = { "head": { "en": "Local gardening help in {country}", "es": "Ayuda local para tu huerto en {country}" }, "provenance": { "en": "We read the pages behind these lines, the earliest on {date}. Links can move, so if one has, search for its name.", "es": "Leímos las páginas en las que se basan estas líneas; la primera, el {date}. Los enlaces pueden cambiar; si alguno cambió, busca su nombre." }, "provenance_world": { "en": "These lines rest on pages we read, the earliest on {date}.", "es": "Estas líneas se basan en páginas que leímos; la primera, el {date}." } };
const LOCAL_HELP = { "CA": { "name": { "en": "Canada", "es": "Canadá" }, "sources": { "mgoi": { "url": "https://mgoi.ca/", "read": "2026-09-28" }, "tmg": { "url": "https://www.torontomastergardeners.ca/ask-list/", "read": "2026-09-28" }, "mgabc": { "url": "https://www.mgabc.org/mgabc2022/mgabc.html", "read": "2026-09-28" }, "usaskg": { "url": "https://gardening.usask.ca/", "read": "2026-09-28" }, "mgext": { "url": "https://mastergardener.extension.org/contact-us/find-a-program/", "read": "2026-09-28" }, "onprot": { "url": "https://www.ontario.ca/document/sampling-and-analysis-protocol/laboratory-analysis", "read": "2026-09-28" }, "cala": { "url": "https://cala.ca/", "read": "2026-09-28" }, "onlabs": { "url": "https://www.ontario.ca/page/soil-leaf-and-petiole-tissue-and-forages-and-feed-testing-labs", "read": "2026-09-28" }, "ceaeq": { "url": "https://www.ceaeq.gouv.qc.ca/accreditation/PALA/lla07.htm", "read": "2026-09-28", "lang": "fr" }, "perennia": { "url": "https://www.perennia.ca/analytical-lab/", "read": "2026-09-28" }, "scc_env": { "url": "https://scc-ccn.ca/accreditation-scheme/environmental-testing", "read": "2026-10-10" }, "scc_search": { "url": "https://scc-ccn.ca/search/accredited-organizations", "read": "2026-10-10" } }, "advice": [{ "en": "In Canada, free gardening advice mostly comes from volunteer Master Gardeners.", "es": "En Canadá, los consejos gratuitos de jardinería vienen sobre todo de los Master Gardeners voluntarios.", "sources": ["mgoi", "mgabc", "usaskg"] }, { "en": "There are Master Gardener groups across the country ({mgext}).", "es": "Hay grupos de Master Gardeners en todo el país ({mgext}).", "sources": ["mgext"], "links": { "mgext": { "en": "find a program", "es": "busca un programa" } } }, { "en": "Several take your questions online: {mgoi} (through a local group or on Facebook), {tmg}, and the {mgabc}.", "es": "Varios responden tus preguntas en línea: {mgoi} (por medio de un grupo local o en Facebook), {tmg} y la {mgabc}.", "sources": ["mgoi", "tmg", "mgabc"], "links": { "mgoi": { "en": "Master Gardeners of Ontario", "es": "Master Gardeners of Ontario" }, "tmg": { "en": "Toronto Master Gardeners", "es": "Toronto Master Gardeners" }, "mgabc": { "en": "Master Gardeners Association of BC", "es": "Master Gardeners Association of BC" } } }, { "en": "On the Prairies, the University of Saskatchewan runs {usaskg}, a free advice service during the growing season.", "es": "En las Praderas, la Universidad de Saskatchewan tiene {usaskg}, un servicio gratuito de consejos durante la temporada de cultivo.", "sources": ["usaskg"], "links": { "usaskg": { "en": "Gardenline", "es": "Gardenline" } } }], "soil": [{ "en": "For a soil test, look for an accredited lab.", "es": "Para analizar tu suelo, busca un laboratorio acreditado.", "sources": ["onprot"] }, { "en": "{cala} and the {scc_env} both accredit labs to ISO/IEC 17025, the international standard for testing labs.", "es": "{cala} y el {scc_env} acreditan laboratorios según la ISO/IEC 17025, la norma internacional para laboratorios de ensayo.", "sources": ["onprot", "cala", "scc_env", "scc_search"], "links": { "cala": { "en": "CALA", "es": "CALA" }, "scc_env": { "en": "Standards Council of Canada", "es": "Consejo de Normas de Canadá (Standards Council of Canada)" } } }, { "en": "Ontario's agriculture ministry {onlabs} for soil tests on Ontario soils, and Quebec's environment ministry keeps {ceaeq}.", "es": "El ministerio de agricultura de Ontario {onlabs} para análisis de suelos de Ontario, y el ministerio de medio ambiente de Quebec tiene {ceaeq}.", "sources": ["onlabs", "ceaeq"], "links": { "onlabs": { "en": "lists the labs it accredits", "es": "publica la lista de los laboratorios que acredita" }, "ceaeq": { "en": "an official list of labs accredited for agricultural analysis (in French)", "es": "una lista oficial de laboratorios acreditados para análisis agrícola (en francés)" } } }, { "en": "Both lists are written for farms, so ask a lab whether it takes a garden sample.", "es": "Las dos listas están pensadas para granjas, así que pregunta al laboratorio si acepta una muestra de huerto.", "sources": ["onlabs", "ceaeq"] }, { "en": "In Nova Scotia, {perennia} also tests soil for the public, with a lawn and garden form.", "es": "En Nueva Escocia, {perennia} también analiza suelo para el público, con un formulario para césped y jardín.", "sources": ["perennia"], "links": { "perennia": { "en": "Perennia's lab", "es": "el laboratorio de Perennia" } } }] }, "MX": { "name": { "en": "Mexico", "es": "México" }, "sources": { "ema": { "url": "https://www.ema.org.mx/portal_v3/index.php/11-conozca-a-nuestros-acreditados/58-laboratorios-de-ensayo-acreditados", "read": "2026-10-03", "lang": "es" }, "platiica": { "url": "https://platiica.economia.gob.mx/evaluacion-de-la-conformidad/entidades-de-acreditacion/", "read": "2026-10-03", "lang": "es" }, "chapingo": { "url": "https://suelos.chapingo.mx/servicios/laboratorio-central/", "read": "2026-10-03", "lang": "es" } }, "advice": [], "soil": [{ "en": "For a soil test in Mexico, look for an accredited lab.", "es": "Para analizar tu suelo en México, busca un laboratorio acreditado.", "sources": ["ema", "platiica"] }, { "en": "The {ema}, one of the accreditation bodies authorised by the Ministry of Economy, publishes a list of the testing labs it has accredited.", "es": "La {ema}, una de las entidades de acreditación autorizadas por la Secretaría de Economía, publica la lista de los laboratorios de ensayo que ha acreditado.", "sources": ["platiica", "ema"], "links": { "ema": { "en": "Entidad Mexicana de Acreditación (ema)", "es": "Entidad Mexicana de Acreditación (ema)" } } }, { "en": "The Soil Science Department at the Universidad Autónoma Chapingo also runs {chapingo} that analyses soil for growers and businesses who ask.", "es": "El Departamento de Suelos de la Universidad Autónoma Chapingo también tiene {chapingo} que analiza suelos para productores y empresas que lo solicitan.", "sources": ["chapingo"], "links": { "chapingo": { "en": "a lab", "es": "un laboratorio" } } }] }, "AU": { "name": { "en": "Australia", "es": "Australia" }, "sources": { "nepm": { "url": "https://www.legislation.gov.au/F2008B00713/latest/text", "read": "2026-10-22" }, "nata": { "url": "https://nata.com.au/", "read": "2026-10-22" }, "fao_aspac": { "url": "https://www.fao.org/3/cb2468en/cb2468en.pdf", "read": "2026-10-22" }, "aspac": { "url": "https://www.aspac-australasia.com/", "read": "2026-10-22" }, "scma_4a1": { "url": "https://raw.githubusercontent.com/ANZSoilData/def-au-scma/master/html/04-pH/04A1.html", "read": "2026-10-21" }, "scma_4b1": { "url": "https://raw.githubusercontent.com/ANZSoilData/def-au-scma/master/html/04-pH/04B1.html", "read": "2026-10-21" }, "scma_4b2": { "url": "https://raw.githubusercontent.com/ANZSoilData/def-au-scma/master/html/04-pH/04B2.html", "read": "2026-10-21" }, "ga_soilph": { "url": "https://www.abc.net.au/gardening/soil-ph/13953698", "read": "2026-10-22" }, "ga_soilsafety": { "url": "https://www.abc.net.au/gardening/how-to/soil-safety/103472326", "read": "2026-10-22" } }, "advice": [], "soil": [{ "en": "For a soil test in Australia, look for a lab accredited by {nata}.", "es": "Para analizar tu suelo en Australia, busca un laboratorio acreditado por {nata}.", "sources": ["nepm", "nata"], "links": { "nata": { "en": "NATA, the National Association of Testing Authorities", "es": "NATA (National Association of Testing Authorities)" } } }, { "en": "The Australasian Soil and Plant Analysis Council ({aspac}) runs a proficiency program for soil and plant labs, so you can ask a lab whether it takes part.", "es": "El Australasian Soil and Plant Analysis Council ({aspac}) organiza un programa de ensayos de aptitud para laboratorios de suelos y plantas, así que puedes preguntarle a un laboratorio si participa.", "sources": ["fao_aspac", "aspac"], "links": { "aspac": { "en": "ASPAC", "es": "ASPAC" } } }, { "en": "Australian labs measure pH in water, in calcium chloride, or both, so check which one your report gives.", "es": "Los laboratorios australianos miden el pH en agua, en cloruro de calcio o de las dos maneras, así que fíjate cuál trae tu informe.", "sources": ["scma_4a1", "scma_4b1", "scma_4b2"] }, { "en": "Some local nurseries will also test a soil sample you bring in ({ga_soilph}).", "es": "Algunos viveros de tu zona también analizan una muestra de suelo que les lleves ({ga_soilph}).", "sources": ["ga_soilph"], "links": { "ga_soilph": { "en": "Gardening Australia", "es": "Gardening Australia" } } }, { "en": "To check garden soil for lead, EPA Victoria's GardenSafe program tests it free for people who live in Victoria, and gardeners in other states can use Macquarie University's VegeSafe for a small donation ({ga_soilsafety}).", "es": "Para saber si el suelo de tu huerto tiene plomo, el programa GardenSafe de la EPA de Victoria lo analiza gratis para quienes viven en Victoria, y en los demás estados puedes usar VegeSafe, de la Universidad Macquarie, a cambio de un pequeño donativo ({ga_soilsafety}).", "sources": ["ga_soilsafety"], "links": { "ga_soilsafety": { "en": "as Gardening Australia reported", "es": "según contó Gardening Australia" } } }] }, "GB": { "name": { "en": "the United Kingdom", "es": "el Reino Unido" }, "sources": { "ukas": { "url": "https://www.ukas.com/", "read": "2026-10-22" }, "rhs_sas": { "url": "https://www.rhs.org.uk/membership/rhs-gardening-advice/soil-analysis-service", "read": "2026-10-22" }, "rhs_ph": { "url": "https://www.rhs.org.uk/soil-composts-mulches/ph-and-testing-soil", "read": "2026-10-22" } }, "advice": [], "soil": [{ "en": "For a soil test in the UK, look for a lab accredited by {ukas}, the national accreditation body.", "es": "Para analizar tu suelo en el Reino Unido, busca un laboratorio acreditado por {ukas}, el organismo nacional de acreditación.", "sources": ["ukas"], "links": { "ukas": { "en": "UKAS", "es": "UKAS (United Kingdom Accreditation Service)" } } }, { "en": "The {rhs_sas} tests garden soil from anywhere in the UK for pH, texture, organic matter, phosphorus, potassium and magnesium, and it's open to non-members too.", "es": "El {rhs_sas} analiza el pH, la textura, la materia orgánica, el fósforo, el potasio y el magnesio de suelos de huerto de cualquier parte del Reino Unido, y también atiende a quienes no son socios.", "sources": ["rhs_sas"], "links": { "rhs_sas": { "en": "RHS soil analysis service", "es": "servicio de análisis de suelo de la RHS" } } }, { "en": "The RHS warns that a test within three months of adding lime, fertilizer or organic matter may give misleading results.", "es": "La RHS advierte que una prueba hecha en los tres meses siguientes a echar cal, fertilizante o materia orgánica puede dar resultados engañosos.", "sources": ["rhs_ph"] }] } };
const LOCAL_HELP_WORLD = { "sources": { "onprot": { "url": "https://www.ontario.ca/document/sampling-and-analysis-protocol/laboratory-analysis", "read": "2026-09-28" }, "fao_sop06": { "url": "https://www.fao.org/3/cb3637en/cb3637en.pdf", "read": "2026-10-21" } }, "soil": [{ "en": "For a soil test you can trust, look for a lab accredited to ISO/IEC 17025, the international standard for testing labs.", "es": "Para un análisis de suelo de confianza, busca un laboratorio acreditado según la ISO/IEC 17025, la norma internacional para laboratorios de ensayo.", "sources": ["onprot"] }, { "en": "The lab's report should say which pH it measured, in water or in a salt solution such as calcium chloride.", "es": "El informe del laboratorio debería decir qué pH midió, en agua o en una solución salina como el cloruro de calcio.", "sources": ["fao_sop06"] }] };

function dist2(lat, lon, s) {
    const dlat = lat - s.lat;
    const dlon = (lon - s.lon) * Math.cos((lat * Math.PI) / 180);
    return dlat * dlat + dlon * dlon;
}
function stateForLatLon(lat, lon, country = countryAt(lat, lon)) {
    if (country !== "US")
        return null;
    const inBox = EXTENSION_STATES.filter((s) => lat >= s.bb[0] && lat <= s.bb[1] && lon >= s.bb[2] && lon <= s.bb[3]);
    const pool = inBox.length ? inBox : EXTENSION_STATES;
    let best = pool[0];
    let bestD = dist2(lat, lon, pool[0]);
    for (const s of pool) {
        const d = dist2(lat, lon, s);
        if (d < bestD) {
            best = s;
            bestD = d;
        }
    }
    if (!inBox.length && bestD > 16)
        return null;
    return best;
}
const near = (a, lat, lon) => Math.abs(a.lat - lat) < 0.25 && Math.abs(a.lon - lon) < 0.35;
const ZIP_ON_RECORD = /^\s*(?:ZIP\s+)?\d{5}(?:-\d{4})?\s*$/i;
const OUTLINE_BOXES = [
    [14, 84, -170, -50], [-56, -8, 95, 170], [49, 62, -12, 3],
];
const inOutlineBox = (lat, lon) => OUTLINE_BOXES.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
let facts = null;
let reading = null;
let outlineFailed = false;
function decide(lat, lon) {
    const noted = placeCountry(lat, lon);
    if (noted)
        return noted;
    const f = facts && facts.id === app.currentPlotId ? facts : null;
    if (!f)
        return null;
    const here = !f.anchor || near(f.anchor, lat, lon);
    if (here && f.zip)
        return "US";
    if (here && f.country)
        return f.country;
    if (!stateForLatLon(lat, lon, "US") && !inOutlineBox(lat, lon))
        return "";
    const o = countryAt(lat, lon);
    return o ?? (outlineFailed ? "?" : null);
}
function ensure(lat, lon) {
    const id = app.currentPlotId;
    const db = app.logDb;
    reading ??= (db ? getPlot(db, id).catch(() => undefined) : Promise.resolve(undefined))
        .then((p) => {
        facts = { id, country: p?.country, zip: ZIP_ON_RECORD.test(p?.address ?? ""), anchor: p?.anchor };
        const noted = placeCountry(lat, lon);
        if (db && p?.anchor && noted && p.country !== noted && near(p.anchor, lat, lon)) {
            p.country = noted;
            facts.country = noted;
            void putPlot(db, p).catch(() => { });
        }
    })
        .finally(() => { reading = null; });
    return reading.then(async () => {
        if (decide(lat, lon) === null)
            outlineFailed = !(await loadOutline());
    });
}
const NOT_US = "-";
let pick = null;
let pickFor = "";
function answer(lat, lon) {
    const auto = decide(lat, lon);
    const state = auto === "US" ? stateForLatLon(lat, lon, "US") : null;
    const key = `${auto}/${state?.c ?? ""}`;
    if (key !== pickFor) {
        pick = null;
        pickFor = key;
    }
    if (pick === NOT_US)
        return { country: auto && auto !== "US" && auto !== "?" ? auto : "", state: null };
    if (pick)
        return { country: "US", state: EXTENSION_STATES.find((s) => s.c === pick) ?? state };
    return { country: auto, state };
}
const link = (href, text) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    return a;
};
const lang = () => (appLang() === "es" ? "es" : "en");
const say = (t) => t[lang()];
function sentence(c, s) {
    const out = [];
    for (const [i, part] of say(s).split(/\{(\w+)\}/).entries()) {
        if (i % 2 === 0) {
            if (part)
                out.push(part);
            continue;
        }
        const src = c.sources[part];
        const a = link(src.url, say(s.links[part]));
        if (src.lang && src.lang !== lang())
            a.hreflang = src.lang;
        out.push(a);
    }
    return out;
}
function sentences(c, rows) {
    return rows.flatMap((s, i) => (i ? [" ", ...sentence(c, s)] : sentence(c, s)));
}
function provenance(c, rows, line = LOCAL_HELP_UI.provenance) {
    const read = rows.flatMap((s) => s.sources.map((id) => c.sources[id].read)).sort()[0];
    const en = lang() === "en" || showingOriginals();
    return (en ? line.en : line.es).replace("{date}", fmtMonthDayYear(read, en ? "en-US" : "es-US"));
}
let cardAt = null;
const routes = new Map();
function repaintAll() {
    if (cardAt)
        paintCard(cardAt[0], cardAt[1]);
    for (const [el, [lat, lon]] of routes) {
        if (el.isConnected)
            paintRoute(el, lat, lon);
        else
            routes.delete(el);
    }
}
function picker(selected) {
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", copy.pnExtStateAria);
    for (const [v, t] of [...EXTENSION_STATES.map((s) => [s.c, s.name]), [NOT_US, copy.pnExtNotUs]]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        if (v === selected)
            o.selected = true;
        sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
        pick = sel.value;
        repaintAll();
    });
    return sel;
}
function paintCard(lat, lon) {
    const panel = $("extension");
    panel.innerHTML = "";
    const { country, state } = answer(lat, lon);
    const help = country ? LOCAL_HELP[country] : undefined;
    if (help && help.advice.length) {
        const head = document.createElement("strong");
        head.textContent = say(LOCAL_HELP_UI.head).replace("{country}", say(help.name));
        panel.appendChild(head);
        if (stateForLatLon(lat, lon, "US")) {
            const p = document.createElement("p");
            fillNodes(p, copy.pnExtOutside, { state: picker(NOT_US) });
            panel.appendChild(p);
        }
        const advice = document.createElement("p");
        advice.className = "localhelp";
        advice.append(...sentences(help, help.advice));
        panel.appendChild(advice);
        const prov = document.createElement("p");
        prov.className = "provenance";
        prov.textContent = provenance(help, help.advice);
        panel.appendChild(prov);
        return;
    }
    if (country !== "US" || !state) {
        if (country && country !== "?" && country !== "US" && stateForLatLon(lat, lon, "US")) {
            const p = document.createElement("p");
            fillNodes(p, copy.pnExtOutside, { state: picker(NOT_US) });
            panel.appendChild(p);
        }
        return;
    }
    const head = document.createElement("strong");
    head.textContent = copy.pnExtHead;
    panel.appendChild(head);
    const guess = document.createElement("p");
    fillNodes(guess, copy.pnExtLooksLike, { state: picker(state.c) });
    panel.appendChild(guess);
    const line = document.createElement("p");
    if (state.url)
        line.appendChild(link(state.url, state.inst));
    else
        fillNodes(line, fillCopy("pnExtInstDirectory", { inst: state.inst }), { link: link(NATIONAL_DIRECTORY, copy.pnExtFindInDirectory) });
    panel.appendChild(line);
    const county = document.createElement("p");
    fillNodes(county, copy.pnExtCounty, { link: link(NATIONAL_DIRECTORY, copy.pnExtCountyLink) });
    panel.appendChild(county);
    const prov = document.createElement("p");
    prov.className = "provenance";
    prov.textContent = copy.pnExtProvenance;
    panel.appendChild(prov);
}
function metricAbroad(lat, lon) {
    const c = answer(lat, lon).country;
    if (c === null || c === "US" || c === "?")
        return;
    try {
        if (localStorage.getItem("gg-units") !== null || localStorage.getItem("gg-temp") !== null)
            return;
    }
    catch {
        return;
    }
    for (const [id, v] of [["prefunits", "metric"], ["preftemp", "c"]]) {
        const sel = document.getElementById(id);
        if (sel && sel.value !== v) {
            sel.value = v;
            sel.dispatchEvent(new Event("change"));
        }
    }
}
function renderExtension(site) {
    if (!site || site.lat == null || site.lon == null) {
        cardAt = null;
        $("extension").innerHTML = "";
        return;
    }
    const at = [site.lat, site.lon];
    cardAt = at;
    paintCard(at[0], at[1]);
    void ensure(at[0], at[1]).then(() => {
        if (cardAt !== at)
            return;
        paintCard(at[0], at[1]);
        metricAbroad(at[0], at[1]);
    });
}
function onLines(slot, parts) {
    slot.append(...parts.flatMap((p, i) => [...(i ? [" "] : []), document.createElement("br"), ...p]));
}
function labRoute(slot, help) {
    const line = help === LOCAL_HELP_WORLD ? LOCAL_HELP_UI.provenance_world : LOCAL_HELP_UI.provenance;
    onLines(slot, [[copy.pnLabAsk], ...help.soil.map((s) => sentence(help, s)), [copy.pnLabKit], [provenance(help, help.soil, line)]]);
}
function paintRoute(slot, lat, lon) {
    const { country, state } = answer(lat, lon);
    slot.replaceChildren();
    if (country === null)
        return;
    if (country === "US") {
        onLines(slot, [[state?.url
                    ? link(state.url, fillCopy("pnAskSoilTest", { inst: state.inst }))
                    : link(NATIONAL_DIRECTORY, copy.pnFindExtension)], [copy.pnLabAsk]]);
        return;
    }
    labRoute(slot, (country ? LOCAL_HELP[country] : undefined) ?? LOCAL_HELP_WORLD);
}
function fillSoilRoute(slot, lat, lon) {
    if (lat == null || lon == null) {
        slot.replaceChildren();
        labRoute(slot, LOCAL_HELP_WORLD);
        return;
    }
    for (const el of routes.keys())
        if (!el.isConnected)
            routes.delete(el);
    routes.set(slot, [lat, lon]);
    paintRoute(slot, lat, lon);
    void ensure(lat, lon).then(() => { if (slot.isConnected)
        paintRoute(slot, lat, lon); });
}

export { fillSoilRoute, inOutlineBox, renderExtension, stateForLatLon };
