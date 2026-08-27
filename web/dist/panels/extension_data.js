// Phase D (D-041) - committed directory for the extension-office panel. This is BUNDLED data read
// offline (D-039): no runtime call, ships in the compiled app. Each row carries the state's
// land-grant Cooperative Extension program (the 1862 Morrill-Act institution - a stable, high-
// confidence fact) and, WHERE CONFIDENTLY KNOWN, a direct extension URL; where a URL would be a
// guess it is null and the panel routes to the national directory instead (the "hybrid + provenance"
// decision). URLs were compiled 2026-07 and cannot be re-verified from the build sandbox (the
// gateway blocks external hosts), so the panel says so and always offers the national directory,
// which resolves even when a state link has moved.
//
// `lat`/`lon` is an approximate state centroid and `bb` an approximate bounding box
// [minLat, maxLat, minLon, maxLon] - together they seed a best-effort lat/lon → state guess that the
// user can correct. They are NOT authoritative boundaries and feed nothing but the panel's own guess.
// USDA NIFA's Cooperative Extension landing - the always-available fallback and county-office finder.
export const NATIONAL_DIRECTORY = "https://www.nifa.usda.gov/about-nifa/how-we-work/extension";
export const EXTENSION_STATES = [
    { c: "AL", name: "Alabama", inst: "Alabama Cooperative Extension System", url: "https://www.aces.edu", lat: 32.8, lon: -86.8, bb: [30.2, 35.0, -88.5, -84.9] },
    { c: "AK", name: "Alaska", inst: "UAF Cooperative Extension Service", url: "https://www.uaf.edu/ces", lat: 64.2, lon: -152.0, bb: [51.2, 71.5, -179.1, -129.9] },
    { c: "AZ", name: "Arizona", inst: "University of Arizona Cooperative Extension", url: "https://extension.arizona.edu", lat: 34.3, lon: -111.7, bb: [31.3, 37.0, -114.8, -109.0] },
    { c: "AR", name: "Arkansas", inst: "University of Arkansas System Division of Agriculture", url: null, lat: 34.9, lon: -92.4, bb: [33.0, 36.5, -94.6, -89.6] },
    { c: "CA", name: "California", inst: "UC Agriculture & Natural Resources", url: "https://ucanr.edu", lat: 37.2, lon: -119.4, bb: [32.5, 42.0, -124.4, -114.1] },
    { c: "CO", name: "Colorado", inst: "Colorado State University Extension", url: "https://extension.colostate.edu", lat: 39.0, lon: -105.5, bb: [37.0, 41.0, -109.06, -102.04] },
    { c: "CT", name: "Connecticut", inst: "UConn Extension", url: null, lat: 41.6, lon: -72.7, bb: [40.98, 42.05, -73.73, -71.79] },
    { c: "DE", name: "Delaware", inst: "University of Delaware Cooperative Extension", url: null, lat: 39.0, lon: -75.5, bb: [38.45, 39.84, -75.79, -75.05] },
    { c: "FL", name: "Florida", inst: "UF/IFAS Extension", url: "https://sfyl.ifas.ufl.edu", lat: 28.6, lon: -82.4, bb: [24.5, 31.0, -87.6, -80.0] },
    { c: "GA", name: "Georgia", inst: "University of Georgia Extension", url: "https://extension.uga.edu", lat: 32.6, lon: -83.4, bb: [30.36, 35.0, -85.6, -80.84] },
    { c: "HI", name: "Hawaii", inst: "UH Manoa CTAHR Cooperative Extension", url: null, lat: 20.3, lon: -156.4, bb: [18.9, 22.24, -160.3, -154.8] },
    { c: "ID", name: "Idaho", inst: "University of Idaho Extension", url: "https://www.uidaho.edu/extension", lat: 44.4, lon: -114.6, bb: [42.0, 49.0, -117.24, -111.04] },
    { c: "IL", name: "Illinois", inst: "University of Illinois Extension", url: "https://extension.illinois.edu", lat: 40.0, lon: -89.2, bb: [36.97, 42.51, -91.51, -87.02] },
    { c: "IN", name: "Indiana", inst: "Purdue Extension", url: "https://extension.purdue.edu", lat: 39.9, lon: -86.3, bb: [37.77, 41.76, -88.1, -84.78] },
    { c: "IA", name: "Iowa", inst: "Iowa State University Extension and Outreach", url: "https://www.extension.iastate.edu", lat: 42.0, lon: -93.5, bb: [40.38, 43.5, -96.64, -90.14] },
    { c: "KS", name: "Kansas", inst: "K-State Research and Extension", url: "https://www.ksre.k-state.edu", lat: 38.5, lon: -98.4, bb: [37.0, 40.0, -102.05, -94.59] },
    { c: "KY", name: "Kentucky", inst: "University of Kentucky Cooperative Extension", url: "https://extension.ca.uky.edu", lat: 37.5, lon: -85.3, bb: [36.5, 39.15, -89.57, -81.96] },
    { c: "LA", name: "Louisiana", inst: "LSU AgCenter", url: "https://www.lsuagcenter.com", lat: 31.0, lon: -92.0, bb: [28.9, 33.02, -94.04, -88.8] },
    { c: "ME", name: "Maine", inst: "University of Maine Cooperative Extension", url: "https://extension.umaine.edu", lat: 45.4, lon: -69.2, bb: [43.06, 47.46, -71.08, -66.95] },
    { c: "MD", name: "Maryland", inst: "University of Maryland Extension", url: "https://extension.umd.edu", lat: 39.0, lon: -76.8, bb: [37.9, 39.72, -79.49, -75.05] },
    { c: "MA", name: "Massachusetts", inst: "UMass Amherst Extension", url: "https://ag.umass.edu", lat: 42.3, lon: -71.8, bb: [41.24, 42.89, -73.51, -69.93] },
    { c: "MI", name: "Michigan", inst: "Michigan State University Extension", url: "https://www.canr.msu.edu", lat: 44.3, lon: -85.4, bb: [41.7, 48.3, -90.42, -82.41] },
    { c: "MN", name: "Minnesota", inst: "University of Minnesota Extension", url: "https://extension.umn.edu", lat: 46.3, lon: -94.3, bb: [43.5, 49.4, -97.24, -89.49] },
    { c: "MS", name: "Mississippi", inst: "Mississippi State University Extension", url: "https://extension.msstate.edu", lat: 32.7, lon: -89.7, bb: [30.17, 35.0, -91.66, -88.1] },
    { c: "MO", name: "Missouri", inst: "University of Missouri Extension", url: "https://extension.missouri.edu", lat: 38.4, lon: -92.5, bb: [35.99, 40.61, -95.77, -89.1] },
    { c: "MT", name: "Montana", inst: "Montana State University Extension", url: "https://www.montana.edu/extension", lat: 47.0, lon: -109.6, bb: [44.36, 49.0, -116.05, -104.04] },
    { c: "NE", name: "Nebraska", inst: "Nebraska Extension", url: "https://extension.unl.edu", lat: 41.5, lon: -99.8, bb: [40.0, 43.0, -104.05, -95.31] },
    { c: "NV", name: "Nevada", inst: "University of Nevada, Reno Extension", url: "https://extension.unr.edu", lat: 39.3, lon: -116.9, bb: [35.0, 42.0, -120.0, -114.04] },
    { c: "NH", name: "New Hampshire", inst: "UNH Cooperative Extension", url: "https://extension.unh.edu", lat: 43.7, lon: -71.6, bb: [42.7, 45.31, -72.56, -70.6] },
    { c: "NJ", name: "New Jersey", inst: "Rutgers Cooperative Extension (NJAES)", url: "https://njaes.rutgers.edu", lat: 40.1, lon: -74.5, bb: [38.93, 41.36, -75.56, -73.89] },
    { c: "NM", name: "New Mexico", inst: "NMSU Cooperative Extension Service", url: "https://aces.nmsu.edu", lat: 34.4, lon: -106.1, bb: [31.33, 37.0, -109.05, -103.0] },
    { c: "NY", name: "New York", inst: "Cornell Cooperative Extension", url: "https://cce.cornell.edu", lat: 42.9, lon: -75.5, bb: [40.5, 45.02, -79.76, -71.86] },
    { c: "NC", name: "North Carolina", inst: "NC State Extension", url: "https://www.ces.ncsu.edu", lat: 35.5, lon: -79.4, bb: [33.84, 36.59, -84.32, -75.46] },
    { c: "ND", name: "North Dakota", inst: "NDSU Extension", url: "https://www.ndsu.edu/agriculture/extension", lat: 47.4, lon: -100.5, bb: [45.94, 49.0, -104.05, -96.55] },
    { c: "OH", name: "Ohio", inst: "Ohio State University Extension", url: "https://extension.osu.edu", lat: 40.3, lon: -82.8, bb: [38.4, 42.0, -84.82, -80.52] },
    { c: "OK", name: "Oklahoma", inst: "Oklahoma State University Extension", url: "https://extension.okstate.edu", lat: 35.6, lon: -97.5, bb: [33.62, 37.0, -103.0, -94.43] },
    { c: "OR", name: "Oregon", inst: "Oregon State University Extension Service", url: "https://extension.oregonstate.edu", lat: 44.0, lon: -120.6, bb: [41.99, 46.29, -124.57, -116.46] },
    { c: "PA", name: "Pennsylvania", inst: "Penn State Extension", url: "https://extension.psu.edu", lat: 40.9, lon: -77.8, bb: [39.72, 42.27, -80.52, -74.69] },
    { c: "RI", name: "Rhode Island", inst: "URI Cooperative Extension", url: null, lat: 41.7, lon: -71.5, bb: [41.15, 42.02, -71.86, -71.12] },
    { c: "SC", name: "South Carolina", inst: "Clemson Cooperative Extension", url: "https://www.clemson.edu/extension", lat: 33.9, lon: -80.9, bb: [32.03, 35.22, -83.35, -78.54] },
    { c: "SD", name: "South Dakota", inst: "SDSU Extension", url: "https://extension.sdstate.edu", lat: 44.4, lon: -100.2, bb: [42.48, 45.94, -104.06, -96.44] },
    { c: "TN", name: "Tennessee", inst: "UT Extension", url: "https://extension.tennessee.edu", lat: 35.9, lon: -86.4, bb: [34.98, 36.68, -90.31, -81.65] },
    { c: "TX", name: "Texas", inst: "Texas A&M AgriLife Extension", url: "https://agrilifeextension.tamu.edu", lat: 31.5, lon: -99.3, bb: [25.84, 36.5, -106.65, -93.51] },
    { c: "UT", name: "Utah", inst: "Utah State University Extension", url: "https://extension.usu.edu", lat: 39.3, lon: -111.7, bb: [37.0, 42.0, -114.05, -109.04] },
    { c: "VT", name: "Vermont", inst: "University of Vermont Extension", url: "https://www.uvm.edu/extension", lat: 44.1, lon: -72.7, bb: [42.73, 45.02, -73.44, -71.46] },
    { c: "VA", name: "Virginia", inst: "Virginia Cooperative Extension", url: "https://ext.vt.edu", lat: 37.5, lon: -78.9, bb: [36.54, 39.47, -83.68, -75.24] },
    { c: "WA", name: "Washington", inst: "Washington State University Extension", url: "https://extension.wsu.edu", lat: 47.4, lon: -120.5, bb: [45.54, 49.0, -124.85, -116.92] },
    { c: "WV", name: "West Virginia", inst: "WVU Extension", url: "https://extension.wvu.edu", lat: 38.6, lon: -80.6, bb: [37.2, 40.64, -82.64, -77.72] },
    { c: "WI", name: "Wisconsin", inst: "University of Wisconsin–Madison Division of Extension", url: "https://extension.wisc.edu", lat: 44.6, lon: -89.9, bb: [42.49, 47.31, -92.89, -86.81] },
    { c: "WY", name: "Wyoming", inst: "University of Wyoming Extension", url: "https://www.uwyo.edu/uwe", lat: 43.0, lon: -107.5, bb: [40.99, 45.01, -111.06, -104.05] },
    { c: "DC", name: "District of Columbia", inst: "UDC Cooperative Extension Service", url: null, lat: 38.9, lon: -77.0, bb: [38.79, 38.996, -77.12, -76.91] },
];
