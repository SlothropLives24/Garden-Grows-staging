import { openSeason as activeSeason, priorSeasons, seasonId } from "./session.js";
import { resolveSpecies } from "./engine/compiler.js";
import { familyName, humanize, titleCase } from "./engine/labels.js";
import { resolveClimate, resolveZone } from "./engine/intake.js";
import { frostCalibration } from "./engine/frostcalib.js";
import { area as regionArea } from "./engine/regions.js";
import { backendConfigured, captureAuthHash, isSignedIn, onAuthChange } from "./account.js";
import { applyCopy, applySeasonalCopy, copy } from "./copy.js";
import { $, familiesOf, LEN_INPUT_IDS, lenM, num } from "./dom.js";
import { activeBundle, app, commonName, ruleClaim } from "./state.js";
import { isExamplePlot } from "./example.js";
import { gardenWideTasks, initCalendar, renderCalendar, taskSentence } from "./calendar.js";
import { renderNextSeason } from "./nextseason.js";
import { appliedPlanDots, currentBedRegion, currentBedSun, declaredPriorYear, draftPlantings, historySource, mergePriorOccupancy, myBedMemberCount, plantingOnBed, proposeFirstBed, renderClimate, renderEligibility, renderGuilds, renderMyBed, renderSeason, setGuildFocus } from "./plan.js";
import { deriveHistory } from "./engine/seasonlog.js";
import { guildStatus, laysOutAsHills } from "./engine/guilds.js";
import { placeBed, setPriorOccupancy } from "./storage.js";
import { nextBedName, nextOrigin } from "./dimbed.js";
import { renderExtension } from "./panels/extension.js";
import { renderSoil, renderSoilSummary } from "./panels/soil.js";
import { renderGardenKnows } from "./panels/knows.js";
import { ledgerRing } from "./ledgerring.js";
import { makeSyntheticSeasons, renderEarned, renderFrost, renderSolar, setupLog } from "./log.js";
import { initNav, setNavGated, go } from "./nav.js";
import { initAnswers, guildFromHash } from "./answers.js";
import { coachBand, coachFold, COACH_HEADING, COACH_HEADING_FOLD, COACH_WHERE } from "./coachband.js";
import { doorClaim } from "./doors.js";
import { noteArrival, renderAskCards } from "./askcard.js";
import { homeSettled, invalidateHomeGlance, invalidateHomePosts, renderHomeNow, settleHome } from "./home.js";
import { initReview } from "./review.js";
import { initShare } from "./shareview.js";
import { buildSharePayload, encodeShare } from "./sharecodec.js";
import { toast } from "./notices.js";
import { loadMapsConfig, loadMapsJs, mapsApiKey } from "./maps.js";
import { ensureWhereMap, setWhereMapCenter, show as gmapShow } from "./gmap.js";
import { currentRoute, initRouter } from "./router.js";
import { initPerfHud } from "./perfhud.js";
import { countPageview, countRung } from "./analytics.js";
import { seat } from "./seat.js";
import { arrivalSettled, endArrival, initPlanSheet, updateStepStates } from "./sheet.js";
import { initDossier } from "./dossier.js";
import { applyPrefRecord, applySeason, applySilo, applyTheme, lengthUnit, mToInput, seasonChoice, setSeasonChoice, setSiloChoice, setTempSystem, setThemeChoice, setUnitSystem, siloChoice, tempSystem, themeChoice, unitSystem } from "./units.js";
import { mountSilhouettes } from "./silhouettes.js";
import { maturityTier } from "./maturity.js";
import { renderWhy, setWhyFocus, setWhyBeliefFocus, setWhyKind, syncWhyHash } from "./why.js";
import { plantFromHash, renderPlantCard, setPlantFocus } from "./panels/plantcard.js";
import { initEditor } from "./editor.js";
import { awaitingHome, clearStarted, homeRendered, landingFastPath, markHomeworthy, markStarted, renderLanding } from "./landing.js";
import { initAuthGate, setGateBundle } from "./authgate.js";
const BUNDLE_URL = "../build/app-bundle.json";
const GRID_BASE_URL = "../build/zip-grid/base.json";
const GRID_DEG = 2.5;
const gridCell = (lat, lon) => [Math.floor(lat / GRID_DEG), Math.floor(lon / GRID_DEG)];
async function loadBundle() {
    const res = await fetch(BUNDLE_URL);
    if (!res.ok)
        throw new Error(`could not load ${BUNDLE_URL}: ${res.status}`);
    return (await res.json());
}
function renderLedgerRing(site, seasons) {
    const dial = document.getElementById("ledgerringdial");
    const num = document.getElementById("ledgerringnum");
    const label = document.getElementById("ledgerringlabel");
    const wrap = document.getElementById("ledgerring");
    if (!dial || !num || !label || !wrap)
        return;
    const ring = ledgerRing(seasons, site);
    dial.style.setProperty("--frac", String(ring.frac));
    num.textContent = ring.center;
    label.textContent = ring.label;
    wrap.classList.toggle("live", ring.state === "live");
}
function main2(bundle) {
    setGateBundle(bundle);
    initDossier(bundle);
    $("info").textContent =
        `corpus bundle v${bundle.version} · ${bundle.counts.guilds} plant teams, ${bundle.counts.rules} rules`;
    renderLanding(bundle);
    app.homeRefresh = () => { markHomeworthy(renderHomeNow(activeBundle(bundle)), homeSettled()); };
    app.invalidateHomePosts = invalidateHomePosts;
    window.addEventListener("hashchange", () => {
        if (!location.hash.startsWith("#/start"))
            return;
        markHomeworthy(renderHomeNow(activeBundle(bundle)), homeSettled());
    });
    let prevRoutePlan = currentRoute() === "plan";
    window.addEventListener("hashchange", () => {
        const nowPlan = currentRoute() === "plan";
        if (nowPlan && !prevRoutePlan && app.logSnapshot.beds.length > 0) {
            requestAnimationFrame(() => { if (currentRoute() === "plan")
                void app.groundRefitIfDrifted?.(); });
        }
        prevRoutePlan = nowPlan;
    });
    const fams = $("families");
    for (const f of [...familiesOf(bundle)].sort((a, b) => familyName(a).localeCompare(familyName(b)))) {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = f;
        cb.className = "fam";
        const name = document.createElement("span");
        name.textContent = titleCase(familyName(f));
        label.appendChild(cb);
        label.appendChild(name);
        fams.appendChild(label);
    }
    const siteFromForm = () => {
        const sunVal = currentBedSun();
        const { history, source } = historySource(bundle);
        return {
            site: {
                bed_m2: (() => { const r = currentBedRegion(); return r ? regionArea(r) : null; })(),
                lat: num("lat"),
                lon: num("lon"),
                sun: sunVal,
                history,
                verticillium_reservoir: source.kind === "derived" ? source.derived.verticillium_reservoir : false,
                allelopathic_residue: source.kind === "derived" ? source.derived.allelopathic_residue : [],
                last_season_species: source.kind === "derived" ? source.derived.last_season_species : [],
                season_year: seasonId(),
            },
            source,
        };
    };
    const reviewRedraw = initReview(() => {
        const { site } = siteFromForm();
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle) : null;
        const ab = activeBundle(bundle);
        const plotSel = $("plotsel");
        return {
            bundle: ab,
            seasons: app.logSnapshot.seasons,
            beds: app.logSnapshot.beds,
            priorOccupancy: app.logSnapshot.priorOccupancy,
            clim: clim?.site ?? null,
            site,
            plotLabel: plotSel.selectedOptions[0]?.textContent ?? humanize(app.currentPlotId),
            commonName: (sid) => commonName(ab, sid),
            ruleClaim: (id) => ruleClaim(bundle, id),
        };
    });
    initShare(() => bundle);
    const shareCurrentPlan = async () => {
        const box = $("sharebox"), msg = $("shareboxmsg"), urlEl = $("shareurl");
        const seasons = app.logSnapshot.seasons;
        const season = seasons.find((s) => s.id === seasonId()) ?? seasons[seasons.length - 1] ?? null;
        const beds = app.logSnapshot.beds;
        box.hidden = false;
        if (!beds.length && !(season?.plantings ?? []).length) {
            urlEl.hidden = true;
            msg.textContent = "Nothing to share yet - trace a bed or add a plant first, and the plan packs itself into a link.";
            return;
        }
        const ab = activeBundle(bundle);
        const plotSel = $("plotsel");
        const label = plotSel.selectedOptions[0]?.textContent ?? humanize(app.currentPlotId);
        const payload = buildSharePayload(label, beds, season, bundle);
        for (const q of payload.plants)
            if (q.n)
                q.n = commonName(ab, q.s);
        const url = `${location.origin}${location.pathname}#/share/${await encodeShare(payload)}`;
        urlEl.hidden = false;
        urlEl.textContent = url;
        msg.textContent = `The plan travels in the link itself - ${url.length} characters, nothing stored anywhere. It is a snapshot: later edits don't change it.`;
        const nav = navigator;
        if (nav.canShare?.({ url })) {
            try {
                await nav.share({ title: "My garden plan", url });
                return;
            }
            catch { }
        }
        try {
            await navigator.clipboard.writeText(url);
            toast("Link copied - the plan travels inside it");
        }
        catch { }
    };
    ($("sharebtn")).addEventListener("click", () => {
        const box = $("sharebox");
        if (!box.hidden) {
            box.hidden = true;
            return;
        }
        void shareCurrentPlan();
    });
    ($("shareclose")).addEventListener("click", () => { $("sharebox").hidden = true; });
    const draw = () => {
        document.documentElement.dataset.maturity = maturityTier(app.logSnapshot.seasons, isSignedIn());
        const hasLog = app.logSnapshot.seasons.length > 0;
        const located = num("lat") != null && num("lon") != null;
        if (located)
            app.ensureZipData?.(num("lat"), num("lon"));
        if (hasLog || located)
            markStarted();
        const exBanner = document.getElementById("examplebanner");
        if (exBanner)
            exBanner.hidden = !isExamplePlot(app.currentPlotId);
        $("candrow").hidden = app.logSnapshot.beds.length === 0;
        {
            const cw = document.getElementById("coach-where");
            if (located)
                coachFold(cw, COACH_HEADING_FOLD, COACH_WHERE, true);
            else
                coachBand(cw, COACH_HEADING, COACH_WHERE, true);
        }
        const { site, source } = siteFromForm();
        {
            const showProposal = located && app.logHydrated && app.logSnapshot.beds.length === 0;
            const nextRow = document.getElementById("where-next-row");
            if (nextRow)
                nextRow.hidden = showProposal;
            if (showProposal)
                proposeFirstBed(bundle, site);
            else {
                const fb = document.getElementById("firstbed");
                if (fb)
                    fb.hidden = true;
                app.groundClearProposal?.();
            }
        }
        const declaring = source.kind === "derived" && !source.tracked;
        $("sec-eligibility").hidden = !declaring || !isSignedIn();
        if (declaring) {
            $("famhint").textContent =
                `Tick what grew here in the last season or two - we'll flag anything you shouldn't replant yet. Once you plant this bed, its history tracks itself.`;
            const bed = app.logSnapshot.beds.find((b) => b.name === ($("candbed")).value);
            const seedKey = bed ? JSON.stringify(bed.region) : null;
            const seed = seedKey ? app.logSnapshot.priorOccupancy.find((s) => JSON.stringify(s.region) === seedKey) : undefined;
            const fams = new Set(seed?.families ?? []);
            for (const cb of document.querySelectorAll("#families input.fam"))
                cb.checked = fams.has(cb.value);
        }
        const clim = site.lat != null && site.lon != null ? resolveClimate(site.lat, site.lon, bundle) : null;
        const zone = site.lat != null && site.lon != null ? resolveZone(site.lat, site.lon, bundle) : null;
        const fcal = clim ? frostCalibration(app.logSnapshot.seasons, clim.site) : null;
        renderClimate(clim, zone, site.lat ?? null, fcal);
        renderExtension(site);
        const openSeason = activeSeason();
        const soilPlantings = (openSeason?.plantings ?? [])
            .filter((p) => !p.end_date)
            .map((p) => {
            const resolved = resolveSpecies(p.species, p.cultivar_group ?? null, activeBundle(bundle));
            const base = activeBundle(bundle).species.find((s) => s.id === p.species);
            const c = base?.common ?? resolved.common;
            const common = Array.isArray(c) ? c[0] : typeof c === "string" ? c : undefined;
            return {
                label: titleCase(common ?? humanize(p.species)),
                region: p.region,
                resolved,
                species: p.species,
            };
        });
        renderSoil(app.currentPlotId, app.soilObservations, site.lat ?? null, site.lon ?? null, app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })), soilPlantings, (region) => {
            if (!region)
                return null;
            try {
                const prior = priorSeasons();
                const reg = region;
                const derived = deriveHistory(reg, prior, activeBundle(bundle));
                const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, reg);
                return { history: merged.history, season_year: seasonId() ?? undefined };
            }
            catch {
                return null;
            }
        }, activeBundle(bundle));
        renderSoilSummary(app.currentPlotId, app.soilObservations, app.logSnapshot.beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure })));
        renderEligibility(activeBundle(bundle), site, source);
        const synth = app.syntheticOn && clim ? makeSyntheticSeasons(clim.site) : [];
        renderFrost(clim?.site ?? null, [...app.logSnapshot.seasons, ...synth], app.syntheticOn);
        renderEarned(clim?.site ?? null, app.logSnapshot.seasons, app.currentPlotId);
        renderLedgerRing(clim?.site ?? null, app.logSnapshot.seasons);
        renderGardenKnows(clim?.site ?? null, site.lat ?? null, site.lon ?? null, zone?.label ?? (zone?.zone != null ? String(zone.zone) : null));
        renderSolar(bundle, site);
        renderGuilds(bundle, site);
        renderNextSeason(bundle, site);
        renderMyBed(activeBundle(bundle), site);
        renderSeason(activeBundle(bundle));
        renderCalendar(activeBundle(bundle));
        renderAskCards(activeBundle(bundle));
        app.draftPlantings = draftPlantings(activeBundle(bundle), site);
        markHomeworthy(renderHomeNow(activeBundle(bundle)), homeSettled());
        reviewRedraw();
        app.planDots = appliedPlanDots(activeBundle(bundle), site);
        app.groundRedraw?.();
        const planReady = app.logSnapshot.beds.length > 0;
        const handoff = $("handoff");
        const line = handoff.querySelector("p");
        const go = $("handoffgo");
        app.needsAccountToPlant = () => backendConfigured() && !isSignedIn();
        if (planReady && backendConfigured() && !isSignedIn()) {
            line.innerHTML = "<strong>Your plan is taking shape.</strong> A free account turns it into a working season: the Calendar becomes your dated to-do list, and the Log starts learning your ground - what grew where, and your real frost dates.";
            go.textContent = "Create your free account";
            handoff.hidden = false;
        }
        else if (planReady && isSignedIn() && app.logSnapshot.seasons.length === 0) {
            line.innerHTML = "<strong>This garden's plan is taking shape - start its log.</strong> Open the Log, start the season, and log what you plant (or what's already growing); the Calendar dates and next year's rotation warnings grow from there.";
            go.textContent = "Open the Log";
            handoff.hidden = false;
        }
        else {
            handoff.hidden = true;
        }
        updateStepStates({
            located,
            zoneLabel: zone ? (zone.label ?? String(zone.zone ?? "")) || null : null,
            areaCount: app.logSnapshot.beds.length,
            myBedCount: myBedMemberCount(),
            frostP50: (() => {
                const lf = clim?.site.last_frost_32f?.p50;
                if (!lf)
                    return null;
                const [mm, dd] = lf.split("-").map(Number);
                const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return `${MON[(mm ?? 1) - 1]} ${dd}`;
            })(),
            freezeP50: (() => {
                const ff = clim?.site.first_freeze_32f_p50;
                if (!ff)
                    return null;
                const [mm, dd] = ff.split("-").map(Number);
                const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return `${MON[(mm ?? 1) - 1]} ${dd}`;
            })(),
            address: app.currentPlot?.address?.trim() || null,
            seasonDays: clim?.site.growing_season_days_p50 ?? null,
        });
        applyAuthGate();
        const du = document.getElementById("dimunit");
        if (du)
            du.textContent = lengthUnit();
        const up = document.getElementById("traceupgrade");
        if (up)
            up.hidden = !app.logSnapshot.beds.some((b) => b.sized && b.structure !== "container");
        const sz = document.getElementById("soilzone");
        if (sz)
            sz.hidden = app.logSnapshot.beds.length === 0;
        const cont = document.getElementById("ground-continue");
        if (cont) {
            const bedReady = app.logSnapshot.beds.length > 0;
            cont.disabled = !bedReady;
            cont.textContent = bedReady ? copy.planGroundContinue : copy.planGroundContinueLocked;
        }
        const nudgeRow = document.getElementById("teams-nudge-row");
        if (nudgeRow) {
            const hasBed = app.logSnapshot.beds.length > 0;
            nudgeRow.hidden = !hasBed;
            if (hasBed) {
                const open = activeSeason();
                const hasDraft = Array.isArray(open?.plan) && open.plan.length > 0;
                const btn = document.getElementById("teamsnudge");
                if (btn) {
                    btn.textContent = hasDraft ? "See your team’s dates on the calendar ›" : "Pick a team - its dates go on your calendar ›";
                    btn.dataset.hasDraft = hasDraft ? "1" : "";
                }
            }
        }
    };
    const setLocation = (lat, lon, said) => {
        ($("lat")).value = String(lat);
        ($("lon")).value = String(lon);
        if (said)
            $("ziphint").textContent = said;
        draw();
    };
    const syncWhereMap = () => {
        if (!document.body.classList.contains("locating")) {
            gmapShow(false);
            return;
        }
        void ensureWhereMap(num("lat"), num("lon"), (lat, lon) => setLocation(lat, lon, "Pin moved - your dates and plant teams follow it."));
    };
    window.addEventListener("gg-step-changed", syncWhereMap);
    syncWhereMap();
    let censusFailWhy = "";
    const censusAttempt = (endpoint, params) => new Promise((resolve) => {
        const cb = "__ggCensus" + Math.floor(Math.random() * 1e9);
        const script = document.createElement("script");
        const w = window;
        const done = (v) => {
            clearTimeout(timer);
            delete w[cb];
            script.remove();
            resolve(v);
        };
        const timer = setTimeout(() => done(null), 3500);
        w[cb] = (body) => {
            const m = body.result?.addressMatches?.[0];
            done(m ? { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress } : "no-match");
        };
        script.onerror = () => done(null);
        script.src = "https://geocoding.geo.census.gov/geocoder/locations/" + endpoint +
            "?benchmark=Public_AR_Current&format=jsonp&callback=" + cb + "&" + params;
        document.head.appendChild(script);
    });
    const censusGeocode = async (q) => {
        const attempts = [censusAttempt("onelineaddress", "address=" + encodeURIComponent(q))];
        const parts = q.split(",").map((t) => t.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const rest = parts.slice(2).join(" ");
            const zip = /\b\d{5}\b/.exec(rest)?.[0];
            const state = rest.replace(/\b\d{5}(-\d+)?\b/, "").trim();
            let p = "street=" + encodeURIComponent(parts[0]) + "&city=" + encodeURIComponent(parts[1]);
            if (state)
                p += "&state=" + encodeURIComponent(state);
            if (zip)
                p += "&zip=" + zip;
            attempts.push(censusAttempt("address", p));
        }
        const results = await Promise.all(attempts);
        const hit = results.find((r) => r !== null && r !== "no-match");
        if (hit)
            return hit;
        censusFailWhy = results.some((r) => r === "no-match")
            ? `house-number service found no match${attempts.length > 1 ? " (one-line and structured forms both tried)" : ""}`
            : "house-number service didn't answer";
        return null;
    };
    let googleFailWhy = "";
    const googleGeocode = async (q) => {
        googleFailWhy = "";
        const key = mapsApiKey();
        if (!key)
            return null;
        if (!(await loadMapsJs())) {
            googleFailWhy = "Google Maps didn’t load";
            return null;
        }
        try {
            const geocoder = new window.google.maps.Geocoder();
            const { results } = await geocoder.geocode({ address: q, componentRestrictions: { country: "US" } });
            const r = results?.[0];
            if (r) {
                const lt = r.geometry.location_type;
                return {
                    lat: r.geometry.location.lat(), lon: r.geometry.location.lng(),
                    label: r.formatted_address,
                    exact: lt === "ROOFTOP" || lt === "RANGE_INTERPOLATED",
                };
            }
            googleFailWhy = "Google: no result";
        }
        catch (e) {
            const code = e.code;
            const msg = e.message;
            googleFailWhy = "Google: " + (code || msg || "geocode failed").slice(0, 120);
        }
        return null;
    };
    let placesLib = null;
    let placesToken = null;
    let placesDead = false;
    let placesWhy = "";
    const loadPlaces = async () => {
        if (placesDead)
            return false;
        if (placesLib?.AutocompleteSuggestion)
            return true;
        const key = mapsApiKey();
        if (!key) {
            placesWhy = "no Google key - keyless address search";
            return false;
        }
        if (!(await loadMapsJs())) {
            placesDead = true;
            placesWhy = "Google Maps JS did not load";
            return false;
        }
        try {
            const maps = window.google.maps;
            placesLib = maps.places?.AutocompleteSuggestion ? maps.places
                : maps.importLibrary ? await maps.importLibrary("places") : null;
            if (!placesLib?.AutocompleteSuggestion) {
                placesDead = true;
                placesWhy = "Places library loaded but AutocompleteSuggestion is missing (enable 'Places API (New)' on the key)";
                return false;
            }
            placesWhy = "";
            return true;
        }
        catch (e) {
            placesDead = true;
            placesWhy = "Places failed to load: " + String(e?.message ?? e).slice(0, 80);
            return false;
        }
    };
    const newPlacesSession = () => {
        const T = placesLib?.AutocompleteSessionToken;
        placesToken = T ? new T() : null;
    };
    const placesSuggest = async (q) => {
        if (!(await loadPlaces()))
            return null;
        try {
            if (!placesToken)
                newPlacesSession();
            const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: q, sessionToken: placesToken ?? undefined,
                includedRegionCodes: ["us"],
            });
            const out = [];
            for (const s of suggestions || []) {
                const p = s.placePrediction;
                if (!p)
                    continue;
                const primary = p.mainText?.text ?? p.text?.text ?? "";
                if (!primary)
                    continue;
                out.push({ lat: NaN, lon: NaN, label: [primary, p.secondaryText?.text].filter(Boolean).join(", "),
                    primary, secondary: p.secondaryText?.text ?? "", exact: true, us: true, pred: p });
            }
            return out.slice(0, 5);
        }
        catch (e) {
            placesDead = true;
            placesWhy = "Places request failed: " + String(e?.message ?? e).slice(0, 80);
            return null;
        }
    };
    app.speciesName = (sid) => commonName(activeBundle(bundle), sid);
    {
        const r006 = bundle.rules.find((x) => x.id === "R-006");
        const thresholdM = (r006?.trigger?.threshold_cm ?? 120) / 100;
        app.bedReachNote = (minSpanM) => minSpanM > thresholdM + 1e-9
            ? "Too wide to reach across the middle - split it into two beds with a path between."
            : null;
    }
    {
        const r098 = bundle.rules.find((x) => x.id === "R-098");
        const maxSpanM = (r098?.params?.container_max_span_cm ?? 75) / 100;
        app.bedContainerNote = (spanM) => spanM > maxSpanM + 1e-9
            ? `That is larger than a typical container (about ${Math.round(maxSpanM * 100)} cm across, a half-barrel). A raised or in-ground bed may fit it better.`
            : null;
    }
    {
        const STRUCTS = ["raised", "in_ground", "container", "field"];
        const guildSpecies = (g) => {
            const out = new Set();
            for (const r of g.roles ?? []) {
                if (r.canonical)
                    out.add(r.canonical);
                if (r.substitute)
                    out.add(r.substitute);
                if (r.alternative)
                    out.add(r.alternative);
                for (const a of r.alternatives ?? [])
                    out.add(typeof a === "string" ? a : a.species);
            }
            for (const m of g.members ?? [])
                if (m.species)
                    out.add(m.species);
            return out;
        };
        const constrained = bundle.guilds.filter((g) => STRUCTS.some((s) => !guildStatus(g, null, null, bundle, s).fits));
        const matchBySpecies = (sp) => {
            let best = null, bestSize = Infinity;
            for (const g of constrained) {
                const gs = guildSpecies(g);
                if (![...sp].every((s) => gs.has(s)))
                    continue;
                if (gs.size < bestSize) {
                    best = g;
                    bestSize = gs.size;
                }
            }
            return best;
        };
        app.bedStructureBlockers = (bedName) => {
            const empty = { blocked: [], reason: () => null };
            const open = activeSeason();
            let guild = null;
            const entry = open?.plan?.find((e) => e.area === bedName);
            if (entry?.guild)
                guild = bundle.guilds.find((g) => g.id === entry.guild) ?? null;
            if (!guild && open) {
                const bed = app.logSnapshot.beds.find((b) => b.name === bedName);
                if (bed) {
                    const sp = new Set((open.plantings ?? [])
                        .filter((pl) => !pl.carried_over && plantingOnBed(pl.region, bed.region))
                        .map((pl) => pl.species));
                    if (sp.size)
                        guild = matchBySpecies(sp);
                }
            }
            if (!guild)
                return empty;
            const reasons = new Map();
            for (const s of STRUCTS) {
                const st = guildStatus(guild, null, null, bundle, s);
                if (!st.fits && st.reason)
                    reasons.set(s, st.reason.text);
            }
            return { blocked: [...reasons.keys()], reason: (s) => reasons.get(s) ?? null };
        };
    }
    app.guildIsHills = (guildId) => {
        const g = bundle.guilds.find((x) => x.id === guildId);
        return !!g && laysOutAsHills(g);
    };
    app.bedRotationSeasons = (region) => {
        try {
            const prior = priorSeasons();
            const derived = deriveHistory(region, prior, activeBundle(bundle));
            const merged = mergePriorOccupancy(derived, app.logSnapshot.priorOccupancy, region);
            const years = Object.keys(merged.history).map(Number).filter(Number.isFinite);
            if (!years.length)
                return null;
            const now = seasonId() ?? new Date().getFullYear();
            return Math.max(0, now - Math.max(...years));
        }
        catch {
            return null;
        }
    };
    app.setLocation = (lat, lon, said) => {
        ($("lat")).value = String(lat);
        ($("lon")).value = String(lon);
        $("ziphint").textContent = said ?? `location set from the map centre: ${lat}, ${lon}.`;
        draw();
    };
    let applyToken = 0;
    const applyAddr = (lat, lon, label) => {
        applyToken++;
        ($("lat")).value = String(Math.round(lat * 1e5) / 1e5);
        ($("lon")).value = String(Math.round(lon * 1e5) / 1e5);
        $("ziphint").textContent = label;
        $("addrlist").replaceChildren();
        ($("addr")).blur();
        draw();
        app.groundCenterOn?.(lat, lon);
        setWhereMapCenter(lat, lon);
        requestAnimationFrame(() => window.dispatchEvent(new Event("gg-sheet-map")));
        settleSheetAfterCommit();
    };
    const settleSheetAfterCommit = () => {
        const sb = document.getElementById("sheetbody");
        if (!sb)
            return;
        seat(sb, "top", { hold: 2500, reason: "address-commit" });
    };
    const splitLabel = (label) => {
        const i = label.indexOf(",");
        return i < 0 ? { primary: label.trim(), secondary: "" }
            : { primary: label.slice(0, i).trim(), secondary: label.slice(i + 1).trim() };
    };
    const near = (a, b) => {
        const dLat = (a.lat - b.lat) * 111_000;
        const dLon = (a.lon - b.lon) * 111_000 * Math.cos(a.lat * Math.PI / 180);
        return Math.hypot(dLat, dLon) < 150;
    };
    const searchCandidates = async (q) => {
        const askedHouse = /^\s*\d+\s/.test(q);
        const fromGoogle = async () => {
            const g = await googleGeocode(q);
            return g ? [{ lat: g.lat, lon: g.lon, label: g.label, ...splitLabel(g.label), exact: g.exact,
                    us: /\bUSA\b/.test(g.label), note: g.exact ? undefined : "approximate" }] : [];
        };
        const fromCensus = async () => {
            const us = await censusGeocode(q);
            return us ? [{ lat: us.lat, lon: us.lon, label: us.label, ...splitLabel(us.label), exact: true, us: true }] : [];
        };
        const fromNominatim = async () => {
            try {
                const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=us&q=" + encodeURIComponent(q);
                const body = await (await fetch(url, { headers: { "Accept": "application/json" } })).json();
                return body.map((m) => {
                    const label = m.display_name.slice(0, 90);
                    const hasHouse = !!m.address?.house_number;
                    return { lat: parseFloat(m.lat), lon: parseFloat(m.lon), label, ...splitLabel(label),
                        exact: hasHouse, us: m.address?.country_code === "us",
                        note: askedHouse && !hasHouse ? "street, not the house - drag the pin after" : undefined };
                });
            }
            catch {
                return [];
            }
        };
        const collapse = (raw) => {
            raw.sort((a, b) => Number(b.us) - Number(a.us) || Number(b.exact) - Number(a.exact));
            const tooCoarse = (c) => c.label.split(",").filter((p) => p.trim()).length < 2;
            const kept = [];
            for (const c of raw) {
                if (!isFinite(c.lat) || !isFinite(c.lon))
                    continue;
                if (tooCoarse(c))
                    continue;
                if (kept.some((k) => k.label === c.label || near(k, c)))
                    continue;
                kept.push(c);
            }
            return kept.slice(0, 5);
        };
        for (const stage of [fromGoogle, fromCensus, fromNominatim]) {
            const kept = collapse(await stage());
            if (kept.length)
                return kept;
        }
        return [];
    };
    const applyCandidate = (c) => applyAddr(c.lat, c.lon, `Pinned: ${c.label}.${c.note ? ` (${c.note.charAt(0).toUpperCase()}${c.note.slice(1)}.)` : ""} Tap the map to move the pin if it landed off.`);
    {
        const ul = document.getElementById("uselocation");
        if (ul && typeof navigator !== "undefined" && navigator.geolocation) {
            ul.hidden = false;
            ul.addEventListener("click", () => {
                $("ziphint").textContent = "finding you…";
                ul.disabled = true;
                const my = applyToken;
                navigator.geolocation.getCurrentPosition((pos) => {
                    ul.disabled = false;
                    if (my !== applyToken)
                        return;
                    ($("addr")).value = "";
                    applyAddr(pos.coords.latitude, pos.coords.longitude, "Pinned at your location. Tap the map to move the pin if it landed off.");
                }, (err) => {
                    ul.disabled = false;
                    if (my !== applyToken)
                        return;
                    $("ziphint").textContent = err.code === err.PERMISSION_DENIED
                        ? "Location is off for this site - type the address instead."
                        : "Couldn't get your location just now - type the address instead.";
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
            });
        }
    }
    const applyPlacePick = async (pick) => {
        $("ziphint").textContent = "pinning " + pick.primary + "…";
        try {
            const place = pick.pred.toPlace();
            await place.fetchFields({ fields: ["location", "formattedAddress"] });
            const loc = place.location;
            if (!loc)
                throw new Error("no location on the picked place");
            applyAddr(loc.lat(), loc.lng(), `Pinned: ${place.formattedAddress || pick.label}. Tap the map to move the pin if it landed off.`);
            newPlacesSession();
        }
        catch {
            $("ziphint").textContent = "looking up the address…";
            void searchCandidates(pick.label).then((cs) => {
                if (cs[0])
                    applyCandidate(cs[0]);
                else
                    $("ziphint").textContent = "could not pin that one - add the city and state.";
            });
        }
    };
    let addrTimer = 0;
    let addrToken = 0;
    const placeAddrList = () => {
        const list = $("addrlist");
        const addrEl = $("addr");
        if (!list.childElementCount)
            return;
        const f = addrEl.getBoundingClientRect();
        const vv = window.visualViewport;
        let viewTop = vv ? vv.offsetTop : 0;
        let viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        for (const el of document.querySelectorAll("header.site, header.site nav")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden")
                continue;
            if (cs.position !== "fixed" && cs.position !== "sticky")
                continue;
            const r = el.getBoundingClientRect();
            if (r.height <= 0)
                continue;
            const mid = (viewTop + viewBottom) / 2;
            if (r.top > mid)
                viewBottom = Math.min(viewBottom, r.top);
            else if (r.bottom < mid)
                viewTop = Math.max(viewTop, r.bottom);
        }
        if (f.bottom < viewTop || f.top > viewBottom) {
            list.replaceChildren();
            return;
        }
        const gap = 4, margin = 8;
        const below = viewBottom - (f.bottom + gap) - margin;
        const above = (f.top - gap) - viewTop - margin;
        list.style.left = `${Math.round(f.left)}px`;
        list.style.width = `${Math.round(f.width)}px`;
        if (below >= above) {
            list.style.top = `${Math.round(f.bottom + gap)}px`;
            list.style.bottom = "auto";
            list.style.maxHeight = `${Math.max(64, Math.floor(below))}px`;
        }
        else {
            list.style.top = "auto";
            list.style.bottom = `${Math.round(window.innerHeight - (f.top - gap))}px`;
            list.style.maxHeight = `${Math.max(64, Math.floor(above))}px`;
        }
    };
    const repositionAddrIfOpen = () => { if (($("addrlist")).childElementCount)
        placeAddrList(); };
    const ensureAddrVisible = () => {
        const sb = document.getElementById("sheetbody");
        const addrEl = $("addr");
        if (!sb)
            return;
        seat(sb, addrEl, { block: "nearest", offset: 8, hold: 600, reason: "addr-visible" });
    };
    document.getElementById("sheetbody")?.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.addEventListener("scroll", repositionAddrIfOpen, { passive: true });
    window.visualViewport?.addEventListener("resize", repositionAddrIfOpen);
    window.visualViewport?.addEventListener("scroll", repositionAddrIfOpen);
    const renderRows = (cands, onPick) => {
        const list = $("addrlist");
        list.replaceChildren();
        for (const c of cands) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "addrrow";
            const main = document.createElement("span");
            main.className = "addr-primary";
            main.textContent = c.primary || c.label;
            b.appendChild(main);
            const secText = [c.secondary, c.note].filter(Boolean).join(" — ");
            if (secText) {
                const sec = document.createElement("span");
                sec.className = "addr-secondary";
                sec.textContent = secText;
                b.appendChild(sec);
            }
            b.addEventListener("click", () => onPick(c));
            list.appendChild(b);
        }
        placeAddrList();
    };
    const runAddrSearch = (auto = false) => {
        const q = ($("addr")).value.trim();
        const hint = $("ziphint");
        const list = $("addrlist");
        if (q.length < 5) {
            list.replaceChildren();
            return;
        }
        const token = ++addrToken;
        hint.textContent = "looking up the address…";
        void searchCandidates(q).then((cands) => {
            if (token !== addrToken)
                return;
            list.replaceChildren();
            if (!cands.length) {
                const why = [googleFailWhy, censusFailWhy].filter(Boolean).join("; ");
                if (why) {
                    console.warn("[geocode]", why);
                    hint.dataset.why = why;
                }
                else
                    delete hint.dataset.why;
                hint.textContent = "We couldn’t find that address. Add the city and state, or tap the map to drop the pin.";
                return;
            }
            if (auto && (cands.length === 1 || !cands[0].note)) {
                applyCandidate(cands[0]);
                return;
            }
            hint.textContent = cands.length === 1 ? "one match - tap it to set your pin:" : "tap your address:";
            renderRows(cands, applyCandidate);
        });
    };
    const runAddr = (auto = false) => {
        const q = ($("addr")).value.trim();
        const list = $("addrlist");
        const hint = $("ziphint");
        if (!mapsApiKey()) {
            runAddrSearch(auto);
            return;
        }
        if (q.length < 3) {
            list.replaceChildren();
            return;
        }
        const token = ++addrToken;
        hint.textContent = "finding addresses…";
        void placesSuggest(q).then((picks) => {
            if (token !== addrToken)
                return;
            if (picks === null) {
                runAddrSearch(auto);
                if (placesWhy) {
                    console.warn("[places]", placesWhy);
                    hint.dataset.why = placesWhy;
                }
                return;
            }
            if (auto && picks.length) {
                void applyPlacePick(picks[0]);
                return;
            }
            if (!picks.length) {
                list.replaceChildren();
                hint.textContent = "no matches yet - keep typing.";
                return;
            }
            hint.textContent = "tap your address:";
            renderRows(picks, (p) => void applyPlacePick(p));
        });
    };
    ($("addr")).addEventListener("input", () => {
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), mapsApiKey() ? 300 : 450);
    });
    $("addrform").addEventListener("submit", (e) => {
        e.preventDefault();
        if (addrTimer)
            clearTimeout(addrTimer);
        runAddr(true);
    });
    ($("addr")).addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (addrTimer)
                clearTimeout(addrTimer);
            runAddr(true);
        }
    });
    let composeTimer = 0;
    const composeAddr = () => {
        const addrEl = $("addr");
        const street = addrEl.value.split(",")[0].trim();
        const city = ($("addrcity")).value.trim();
        const state = ($("addrstate")).value.trim();
        const zip = ($("addrzip")).value.trim();
        if (!street || !city)
            return;
        const full = `${street}, ${city}${state ? `, ${state}` : ""}${zip ? ` ${zip}` : ""}`;
        if (addrEl.value === full)
            return;
        addrEl.value = full;
        ensureAddrVisible();
        if (addrTimer)
            clearTimeout(addrTimer);
        addrTimer = window.setTimeout(() => runAddr(), 400);
    };
    for (const id of ["addrcity", "addrstate", "addrzip"]) {
        for (const evt of ["input", "change"]) {
            $(id).addEventListener(evt, () => {
                if (composeTimer)
                    clearTimeout(composeTimer);
                composeTimer = window.setTimeout(composeAddr, 50);
            });
        }
    }
    for (const id of ["lat", "lon", "shapew", "shapel"]) {
        $(id).addEventListener("input", draw);
    }
    for (const id of ["lat", "lon"]) {
        $(id).addEventListener("input", draw);
    }
    fams.addEventListener("change", () => {
        void (async () => {
            const bed = app.logSnapshot.beds.find((b) => b.name === ($("candbed")).value);
            const db = app.logDb;
            if (bed && db) {
                const checked = [...document.querySelectorAll("#families input.fam:checked")].map((cb) => cb.value);
                await setPriorOccupancy(db, app.currentPlotId, bed.region, declaredPriorYear(), checked);
                await app.logRefresh?.();
            }
            draw();
        })();
    });
    $("candbed").addEventListener("change", draw);
    $("handoffgo").addEventListener("click", () => {
        if (isSignedIn()) {
            location.hash = "#/log";
        }
        else {
            location.hash = "#/account";
            ($("acctemail")).focus();
        }
    });
    onAuthChange(() => draw());
    renderWhy(bundle);
    $("whyq").addEventListener("input", () => { setWhyFocus(null); syncWhyHash(); renderWhy(bundle); });
    const focusPlantFromHash = () => {
        if (currentRoute() !== "plant") {
            setPlantFocus(null);
            return;
        }
        setPlantFocus(plantFromHash(location.hash));
        renderPlantCard(bundle);
    };
    window.addEventListener("hashchange", focusPlantFromHash);
    focusPlantFromHash();
    const applyGuildFromHash = () => {
        if (currentRoute() !== "plan") {
            setGuildFocus(null);
            return;
        }
        const want = guildFromHash(location.hash);
        if (!want) {
            setGuildFocus(null);
            return;
        }
        setGuildFocus(want, bundle.guilds.some((g) => g.id === want));
        draw();
    };
    window.addEventListener("hashchange", applyGuildFromHash);
    initEditor(bundle);
    const dec = (v) => { try {
        return decodeURIComponent(v);
    }
    catch {
        return v;
    } };
    const focusWhyFromHash = () => {
        if (currentRoute() !== "why") {
            setWhyFocus(null);
            setWhyBeliefFocus(null);
            return;
        }
        const m = location.hash.match(/[?&]rule=([^&]+)/);
        setWhyFocus(m ? dec(m[1]) : null);
        const bm = location.hash.match(/[?&]belief=([^&]+)/);
        setWhyBeliefFocus(bm ? dec(bm[1]) : null);
        const km = location.hash.match(/[?&]kind=([^&]+)/);
        setWhyKind(!m && !bm && km ? dec(km[1]) : null);
        const qm = location.hash.match(/[?&]q=([^&]+)/);
        ($("whyq")).value = !m && !bm && qm ? dec(qm[1]) : "";
        renderWhy(bundle);
        if (m)
            $("rules")?.scrollIntoView({ block: "start" });
        if (bm)
            $("beliefs")?.scrollIntoView({ block: "start" });
        else if (/[?&]climate\b/.test(location.hash))
            $("whyclimate")?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("hashchange", focusWhyFromHash);
    focusWhyFromHash();
    initCalendar(activeBundle(bundle));
    app.bedCalendarJobs = (bedName, year) => {
        const b = activeBundle(bundle);
        const today = new Date().toISOString().slice(0, 10);
        return gardenWideTasks(b, year)
            .filter((t) => t.bed === bedName && (t.date ?? "") >= today)
            .sort((a, c) => (a.date ?? "").localeCompare(c.date ?? ""))
            .slice(0, 8)
            .map((t) => ({ date: t.date, text: taskSentence(t, b) }));
    };
    const applyUnitLabels = () => {
        for (const s of document.querySelectorAll(".ulen"))
            s.textContent = lengthUnit();
    };
    const convertLenInputs = (metres) => {
        LEN_INPUT_IDS.forEach((id, i) => {
            const m = metres[i];
            if (m != null)
                $(id).value = String(mToInput(m));
        });
    };
    const syncPrefControls = () => {
        ($("prefunits")).value = unitSystem();
        ($("preftemp")).value = tempSystem();
        ($("preftheme")).value = themeChoice();
        ($("prefseason")).value = seasonChoice();
        ($("prefsilo")).value = siloChoice();
    };
    if (unitSystem() === "imperial") {
        const metres = LEN_INPUT_IDS.map((id) => num(id));
        convertLenInputs(metres);
    }
    $("prefunits").addEventListener("change", () => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id));
        setUnitSystem(($("prefunits")).value === "imperial" ? "imperial" : "metric");
        convertLenInputs(metres);
        applyUnitLabels();
        draw();
        void app.logRefresh?.();
        void app.pushPrefs?.();
    });
    $("preftemp").addEventListener("change", () => {
        setTempSystem(($("preftemp")).value === "f" ? "f" : "c");
        draw();
        void app.logRefresh?.();
        void app.pushPrefs?.();
    });
    $("preftheme").addEventListener("change", () => {
        const v = ($("preftheme")).value;
        setThemeChoice(v === "dark" || v === "light" ? v : "system");
        void app.pushPrefs?.();
    });
    $("prefseason").addEventListener("change", () => {
        const v = ($("prefseason")).value;
        const ok = ["follow", "spring", "summer", "autumn", "winter"].includes(v);
        setSeasonChoice((ok ? v : "follow"));
        applySeasonalCopy();
        void app.pushPrefs?.();
    });
    $("prefsilo").addEventListener("change", () => {
        setSiloChoice(($("prefsilo")).value === "off" ? "off" : "on");
    });
    applyTheme();
    applySeason();
    applySilo();
    mountSilhouettes();
    applyUnitLabels();
    syncPrefControls();
    app.applyPrefs = (rec, atMs) => {
        const metres = LEN_INPUT_IDS.map((id) => lenM(id));
        const changed = applyPrefRecord(rec, atMs);
        convertLenInputs(metres);
        applyUnitLabels();
        syncPrefControls();
        if (changed) {
            draw();
            void app.logRefresh?.();
        }
        return changed;
    };
    draw();
    setupLog(bundle, draw).then(() => {
        app.logHydrated = true;
        draw();
        endArrival();
        applyGuildFromHash();
        settleHome();
        markHomeworthy(renderHomeNow(activeBundle(bundle)), homeSettled());
    }).catch((e) => {
        $("logmsg").textContent = `season log failed to start: ${e}`;
    });
    document.getElementById("teamsnudge")?.addEventListener("click", (e) => {
        if (e.currentTarget.dataset.hasDraft === "1")
            location.hash = "#/calendar";
        else
            window.dispatchEvent(new CustomEvent("gg-open-step", { detail: { step: "step-plan" } }));
    });
    document.getElementById("calplannudge")?.addEventListener("click", () => { location.hash = "#/plan"; });
    document.getElementById("calsetloc")?.addEventListener("click", () => go("plan", "step-where"));
    const BED_PRESETS = [
        { w: 1.2192, l: 2.4384, structure: "raised", what: "raised bed" },
        { w: 1.2192, l: 1.2192, structure: "in_ground", what: "square bed" },
        { w: 0.9144, l: 3.048, structure: "in_ground", what: "row" },
        { w: 0.6096, l: 0.6096, structure: "container", what: "container" },
    ];
    const renderBedPresets = () => {
        const host = document.getElementById("bedpresets");
        if (!host)
            return;
        host.replaceChildren();
        for (const pr of BED_PRESETS) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "bedpreset";
            b.dataset.structure = pr.structure;
            b.textContent = `${mToInput(pr.w)} × ${mToInput(pr.l)} ${lengthUnit()} ${pr.what}`;
            b.title = "one tap makes this bed - you can resize or move it on the map afterwards";
            b.addEventListener("click", () => {
                ($("dimw")).value = String(mToInput(pr.w));
                ($("diml")).value = String(mToInput(pr.l));
                ($("dimstructure")).value = pr.structure;
                ($("dimmake")).click();
            });
            host.appendChild(b);
        }
    };
    renderBedPresets();
    $("prefunits").addEventListener("change", renderBedPresets);
    document.getElementById("dimmake")?.addEventListener("click", () => {
        void (async () => {
            const msg = $("dimbedmsg");
            try {
                const w = lenM("dimw"), l = lenM("diml");
                if (w == null || l == null || w <= 0 || l <= 0) {
                    msg.textContent = "Give both numbers - about how wide, about how long. Rough is fine.";
                    return;
                }
                if (!app.logDb)
                    throw new Error("storage is still opening - try again in a second");
                const beds = app.logSnapshot.beds;
                const name = nextBedName(beds);
                const o = nextOrigin(beds);
                const r2 = (v) => Math.round(v * 100) / 100;
                const structure = ($("dimstructure")).value;
                const sunSel = $("dimsun")?.value ?? "";
                const sun = sunSel === "full" || sunSel === "part_shade" ? sunSel : null;
                countRung("bed-saved");
                await placeBed(app.logDb, app.currentPlotId, name, { shape: "rect", x: o.x, y: o.y, w: r2(w), h: r2(l) }, undefined, sun, structure, true);
                msg.textContent = `Made "${name}" - its fit verdicts are below. Trace it on the map whenever you like.`;
                ($("dimw")).value = "";
                ($("diml")).value = "";
                await app.logRefresh?.();
                const sel = document.getElementById("candbed");
                if (sel) {
                    sel.value = name;
                    sel.dispatchEvent(new Event("change"));
                }
                window.dispatchEvent(new CustomEvent("gg-bed-saved", { detail: { bed: name, kind: "bed" } }));
            }
            catch (e) {
                msg.textContent = `${e instanceof Error ? e.message : e}`;
            }
        })();
    });
    let baseLoad = "idle";
    let manifest = null;
    let zip3Cells = {};
    const cellState = new Map();
    const wanted = [];
    const bump = () => { const b = bundle; b._zipEpoch = (b._zipEpoch ?? 0) + 1; };
    const mergeCell = (body) => {
        if (body.zips) {
            bundle.zip_index = bundle.zip_index ?? { zips: {} };
            Object.assign((bundle.zip_index.zips ??= {}), body.zips);
        }
        if (body.zones) {
            bundle.zip_zones = bundle.zip_zones ?? { zones: {} };
            Object.assign((bundle.zip_zones.zones ??= {}), body.zones);
        }
        const st = body.stations;
        if (Array.isArray(st) && st.length && bundle.climate?.sites) {
            bundle.climate.sites = [...bundle.climate.sites, ...st];
        }
        bump();
    };
    const fetchCell = (ci, cj) => {
        const k = `${ci},${cj}`;
        if (cellState.has(k))
            return;
        cellState.set(k, "loading");
        void fetch(`../build/zip-grid/c${ci}_${cj}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .then((cell) => {
            if (cell) {
                mergeCell(cell);
                cellState.set(k, "done");
                draw();
                answersRefresh?.();
            }
            else
                cellState.delete(k);
        })
            .catch(() => cellState.delete(k));
    };
    const serve = (req) => {
        if (Number.isFinite(req.lat) && Number.isFinite(req.lon)) {
            if (!manifest)
                return;
            const [ci, cj] = gridCell(req.lat, req.lon);
            for (let di = -1; di <= 1; di++)
                for (let dj = -1; dj <= 1; dj++) {
                    if (manifest.has(`${ci + di},${cj + dj}`))
                        fetchCell(ci + di, cj + dj);
                }
            return;
        }
        const z3 = req.zip?.replace(/\D/g, "").slice(0, 3);
        if (z3 && z3.length === 3)
            for (const [ci, cj] of zip3Cells[z3] ?? [])
                fetchCell(ci, cj);
    };
    const ensureZipData = (lat, lon, zip) => {
        const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
        const hasZip = !!zip && /\d{3}/.test(zip);
        if (!hasLoc && !hasZip)
            return;
        const req = { lat, lon, zip };
        if (baseLoad === "done") {
            serve(req);
            return;
        }
        wanted.push(req);
        if (baseLoad === "loading")
            return;
        baseLoad = "loading";
        void fetch(GRID_BASE_URL)
            .then((r) => (r.ok ? r.json() : null))
            .then((base) => {
            if (!base) {
                baseLoad = "idle";
                return;
            }
            manifest = new Set((base.manifest ?? []).map(([i, j]) => `${i},${j}`));
            zip3Cells = base.zip3_cells ?? {};
            if (base.zip_index_meta)
                bundle.zip_index = { ...base.zip_index_meta, zips: bundle.zip_index?.zips ?? {} };
            if (base.zip_zones_meta)
                bundle.zip_zones = { ...base.zip_zones_meta, zones: bundle.zip_zones?.zones ?? {} };
            const b = bundle;
            if (base.global_zones)
                b.global_zones = base.global_zones;
            if (base.global_frost)
                b.global_frost = base.global_frost;
            baseLoad = "done";
            bump();
            while (wanted.length)
                serve(wanted.shift());
            draw();
            answersRefresh?.();
        })
            .catch(() => { baseLoad = "idle"; });
    };
    app.ensureZipData = ensureZipData;
    answersRefresh = initAnswers(bundle, {
        plantWithLocation: (lat, lon, zip) => {
            countRung("to-planner");
            markStarted();
            if (lat != null && lon != null) {
                setLocation(lat, lon, zip ? `Located from your ZIP ${zip} - refine with your address for a house-level pin.` : undefined);
            }
            location.hash = "#/plan";
        },
    });
    if (Number.isFinite(num("lat")) && Number.isFinite(num("lon")))
        ensureZipData(num("lat"), num("lon"));
}
const applyAuthGate = initAuthGate(setNavGated);
app.refreshAuthGate = applyAuthGate;
let answersRefresh = null;
app.markStarted = markStarted;
app.clearStarted = clearStarted;
let awaitingPlan = false;
const HOME_WAIT_MS = 2500;
applyCopy();
noteArrival();
captureAuthHash();
initNav();
initPerfHud();
initPlanSheet();
landingFastPath();
initRouter();
if (currentRoute() === "plan")
    awaitingPlan = true;
for (const b of document.querySelectorAll(".startgo")) {
    b.addEventListener("click", async () => {
        markStarted();
        if (isExamplePlot(app.currentPlotId) && app.removeExample)
            await app.removeExample();
        else
            location.hash = "#/plan";
    });
}
document.getElementById("doorwhen")?.addEventListener("click", () => { location.hash = "#/answers"; });
document.getElementById("doorteams")?.addEventListener("click", () => { location.hash = "#/answers?teams"; });
{
    const claim = doorClaim(Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000));
    const q = document.querySelector('a.lg-door[href^="#/why"] .lg-door-q');
    const link = document.querySelector('a.lg-door[href^="#/why"]');
    if (q && link) {
        q.textContent = claim.q;
        link.href = `#/why?belief=${claim.id}`;
    }
}
document.getElementById("examplebtn")?.addEventListener("click", async () => {
    for (let i = 0; i < 120 && !app.showExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.showExample?.();
});
const closeExample = async () => {
    for (let i = 0; i < 120 && !app.removeExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.removeExample?.(true);
};
document.getElementById("exampleremove")?.addEventListener("click", () => { void closeExample(); });
const startOwnGarden = async () => {
    markStarted();
    for (let i = 0; i < 120 && !app.removeExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.removeExample?.(false);
};
document.getElementById("examplestart")?.addEventListener("click", () => { void startOwnGarden(); });
onAuthChange(applyAuthGate);
applyAuthGate();
void loadMapsConfig().then(() => {
    invalidateHomeGlance();
    app.homeRefresh?.();
    window.dispatchEvent(new Event("gg-step-changed"));
});
countPageview();
const dropSplash = () => { document.getElementById("bootsplash")?.setAttribute("hidden", ""); };
loadBundle()
    .then((bundle) => {
    main2(bundle);
    if (!awaitingHome() && !awaitingPlan) {
        dropSplash();
        return;
    }
    const t0 = Date.now();
    const settled = () => (!awaitingHome() || homeRendered()) && (!awaitingPlan || arrivalSettled());
    const tick = () => {
        if (settled() || Date.now() - t0 > HOME_WAIT_MS) {
            dropSplash();
            return;
        }
        requestAnimationFrame(tick);
    };
    tick();
})
    .catch((e) => {
    const boot = document.getElementById("bootsplash");
    if (boot) {
        boot.classList.add("failed");
        const word = boot.querySelector(".bootword");
        if (word)
            word.textContent = "Couldn't load Milpa Gardens.";
    }
    $("guilds").textContent = String(e);
});
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => { });
}
