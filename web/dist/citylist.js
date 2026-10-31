const URL_ = "../build/pages/world-cities.json";
let list = null;
function loadCities() {
    list ??= fetch(URL_).then((r) => (r.ok ? r.json() : { cities: [] }), () => ({ cities: [] }))
        .then((d) => d.cities ?? [], () => []);
    return list;
}
function fold(t) {
    return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const cityName = (c, es) => (es ? c[1] : c[0]) || c[0];
const countryName = (c, es) => (es ? c[3] : c[2]) || c[2];
const nearName = (c, es) => (es ? c[8] : c[7]) || c[7] || "";
function matchCities(cities, query) {
    const q = fold(query);
    const exact = [], near = [];
    if (!q)
        return { exact, near };
    for (const c of cities) {
        const keys = [fold(c[0]), fold(c[1]), fold(`${c[0]} ${c[2]}`), fold(`${c[1]} ${c[3]}`)];
        if (c[9])
            keys.push(fold(c[9]), fold(`${c[9]} ${c[2]}`), fold(`${c[9]} ${c[3]}`));
        if (keys.includes(q))
            exact.push(c);
        else if (near.length < 8 && keys.some((k) => k.startsWith(q)))
            near.push(c);
    }
    return exact.length ? { exact, near: [] } : { exact, near };
}

export { cityName, countryName, fold, loadCities, matchCities, nearName };
