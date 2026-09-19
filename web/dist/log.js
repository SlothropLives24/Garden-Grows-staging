import { frostCalibration, shiftFrostDate } from "./engine/frostcalib.js";
import { ledgerEarned } from "./earned.js";
import { humanize, humanizeFamilies, stripRuleCitations, titleCase } from "./engine/labels.js";
import { parseRegion as parseRegionSnapshot, regionCentroid } from "./engine/regions.js";
import { emitSeason, parseSeasonFile } from "./engine/seasonfile.js";
import { END_CAUSES, FAILURE_SEVERITIES, OBSERVATION_EVENTS, OBSERVATION_SEVERITIES } from "./engine/seasonlog.js";
import { geometryRules } from "./engine/solar.js";
import { capabilities, validateUserSpecies } from "./engine/userspecies.js";
import { plantEditorForm } from "./plantform.js";
import { initAccount, isSignedIn, signedInEmail } from "./account.js";
import { toast, celebrate } from "./notices.js";
import { $, familiesOf, num } from "./dom.js";
import { mark } from "./dossier.js";
import { plateModel } from "./gardenplate.js";
import { resolveDtm } from "./calendar.js";
import { coachBand, COACH_HEADING, COACH_LOG } from "./coachband.js";
import { renderSeedBox, renderShoppingList } from "./seedbox.js";
import { go } from "./nav.js";
import { openNextSeason } from "./nextseason.js";
import { closedBed, lifespanPersists, nextSeasonFrom, openSeason, reopenedSeason, resolvePlantingAtClose, resolveSeasonId, rolledSeason, seasonId, setSeasonId } from "./session.js";
const SOIL_COMPOSER_EVENTS = [
    ["soil_waterlogged", "water stood after rain"],
    ["soil_lime", "I added lime"],
    ["soil_sulfur", "I added sulfur"],
    ["soil_compost", "I added compost"],
];
import { resolveClimate, resolveZone } from "./engine/intake.js";
import { initGroundMap } from "./groundmap.js";
import { addFailure, addObservation, addPlanting, addPlantingNote, defaultWorkspacePlotId, deletePlot, eraseGarden, deleteSeason, deleteSoilObservation, deleteUserSpecies, endPlanting, freePlotId, getPhoto, getPlot, getSeason, listPlots, listPosts, listSeasons, listSoilObservations, listSyncBackups, listUserSpecies, mintPostId, openLog, plotIdFor, plotVisible, putPhoto, putPost, putSeason, putSoilObservation, putUserSpecies, rekeyPlot, removePlanting, renameBed, restoreSyncBackup, setPlotAnchorOnce, setPlotName, updatePlanting } from "./storage.js";
import { buildStoreZip, downscalePhoto, mintPhotoName, readStoreZip } from "./photos.js";
import { linkNameIn, linkNamesIn, plantLink } from "./panels/plantcard.js";
import { reselectSoilGround, setSoilHooks, setSoilJump } from "./panels/soil.js";
import { countGardenActive } from "./analytics.js";
import { bedHasSections, bedSeasonStatus, draftPlantings, markBedPlanted, markBedPlantedAdvancingSeason, offSeasonNudge, plantingOnBed, sectionParentOf } from "./plan.js";
import { displayName } from "./engine/guilds.js";
import { app, bedShapeLabel, commonName, defaultPlotId, plantingLabel, regionLabel, setCurrentPlot, setDefaultPlot } from "./state.js";
import { feedTime, postBody } from "./feed.js";
import { copy } from "./copy.js";
import { EXAMPLE_PLOT_ID, removeExampleGarden, seedExampleGarden } from "./example.js";
import { hasGround, yardFigure, yardRepaint } from "./home.js";
import { gardenFrame } from "./homefacts.js";
import { familyName } from "./engine/labels.js";
import { buzz } from "./haptics.js";
import { dayWord, frostNotedLine, graduationLine, noteLoggedLine, plantEntryLine, plantedLine, recollectionLine, weatherNotedLine } from "./diary.js";
import { aYearAgoThisWeek } from "./onthisday.js";
import { el } from "./dom.js";
const fmtOffset = (v) => (v > 0 ? `+${v}` : `${v}`);
function renderBoundary(p, label, cal, minSeasons) {
    if (!cal.per_season.length) {
        p(`${label}: none logged yet.`, "provenance");
        return;
    }
    p(`${label}:`, "provenance");
    for (const pt of cal.per_season) {
        p(`· ${pt.season}: observed ${pt.observed} vs model ${pt.model} (${fmtOffset(pt.offset_days)} d)`, "provenance");
    }
    if (cal.calibrated) {
        const m = cal.median_offset_days;
        const model = cal.per_season[0].model;
        const [lo, hi] = cal.offset_range ?? [m, m];
        const dir = m > 0 ? `${Math.abs(m)} days later` : m < 0 ? `${Math.abs(m)} days earlier` : "right on the model";
        p(`Calibrated (${cal.n} seasons, median ${fmtOffset(m)} d, range ${fmtOffset(lo)}…${fmtOffset(hi)}): ` +
            `this ground runs ~${dir} than the model. Observed ~${cal.calibrated_date} supersedes the model's ${model} ` +
            `for this plot.`, "calibrated");
    }
    else {
        p(`${cal.n} of ${minSeasons} seasons logged - ${minSeasons - cal.n} more before this ground's offset supersedes the model.`);
    }
}
let justLogged = null;
let lastEarnedSite = null;
export function renderEarned(site, seasons, plot) {
    lastEarnedSite = site;
    const panel = document.getElementById("earnedstrip");
    if (!panel)
        return;
    panel.innerHTML = "";
    for (const row of ledgerEarned(seasons, site, app.soilObservations ?? [], plot)) {
        const div = document.createElement("div");
        div.className = `earnedrow ${row.state}`;
        const st = document.createElement("span");
        st.className = "earnedst";
        st.textContent = row.badge;
        const what = document.createElement("span");
        what.className = "earnedwhat";
        what.textContent = row.text;
        div.append(st, what);
        panel.append(div);
    }
}
export function renderFrost(site, seasons, synthetic) {
    const panel = $("frost");
    panel.innerHTML = "";
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
    };
    const head = document.createElement("strong");
    head.textContent = "Observed vs predicted frost";
    panel.appendChild(head);
    if (synthetic) {
        p("Synthetic demo data - these seasons are generated, not real observations. Not saved, never exported.", "synthetic");
    }
    if (!site) {
        p("Resolve a site above to compare your logged frosts against the model.");
        return;
    }
    const cal = frostCalibration(seasons, site);
    if (!cal.spring.per_season.length && !cal.fall.per_season.length) {
        p(`No frost logged yet. Tap the date of your last spring frost and first fall freeze each season; ` +
            `after ${cal.min_seasons} seasons this ground's own offset supersedes the model.`);
        return;
    }
    renderBoundary(p, "Last spring frost", cal.spring, cal.min_seasons);
    renderBoundary(p, "First fall freeze", cal.fall, cal.min_seasons);
}
const DEMO_SEASONS = [
    { year: 2021, spring: 7, fall: -7 },
    { year: 2022, spring: 8, fall: -5 },
    { year: 2023, spring: 5, fall: -9 },
    { year: 2024, spring: 9, fall: -6 },
];
export function makeSyntheticSeasons(site) {
    const springP50 = (site.last_frost_32f ?? {}).p50;
    const fallP50 = site.first_freeze_32f_p50;
    return DEMO_SEASONS.map((o) => {
        const observations = [];
        if (springP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(springP50, o.spring)}`, event: "frost", severity: "hard" });
        if (fallP50)
            observations.push({ date: `${o.year}-${shiftFrostDate(fallP50, o.fall)}`, event: "frost", severity: "hard" });
        return { id: o.year, plot: "demo_synthetic", observations };
    });
}
export function renderSolar(bundle, site) {
    const panel = $("solar");
    panel.innerHTML = "";
    const p = (text, cls) => {
        const el = document.createElement("p");
        if (cls)
            el.className = cls;
        el.textContent = text;
        panel.appendChild(el);
        return el;
    };
    const season = openSeason() ?? undefined;
    const live = (season?.plantings ?? []).filter((pl) => !pl.end_cause);
    if (live.length < 2)
        return;
    if (site.lat == null) {
        p("Layout check needs a latitude (set one above) - the polar side and the sun angle depend on it.", "hint");
        return;
    }
    const layout = live.map((pl) => {
        const c = regionCentroid(pl.region);
        return { species: pl.species, group: pl.cultivar_group ?? null, x: c[0], y: c[1] };
    });
    const fired = geometryRules(layout, site, bundle);
    p(`Layout check (season ${season.id}, ${live.length} plantings in the ground; positions are ` +
        `your logged regions' centres, +y assumed geographic north):`, "provenance");
    if (!fired.length) {
        p("No height-ordering or noon-shadow conflicts in this layout.");
        return;
    }
    if (fired.every((f) => f.rule === "R-156"))
        p("No height-ordering or noon-shadow conflicts in this layout.");
    const ruleById = new Map(bundle.rules.map((r) => [r.id, r]));
    const remedies = new Set();
    const nameFor = new Map(live.map((pl) => [pl.species, commonName(bundle, pl.species)]));
    const seen = new Map();
    for (const f of fired) {
        let text = stripRuleCitations(humanizeFamilies(f.why));
        const marks = [];
        for (const [key, name] of nameFor) {
            if (!text.includes(key))
                continue;
            text = text.split(key).join(name);
            if (!app.userSpecies.some((u) => u.id === key))
                marks.push({ label: name, species: key });
        }
        const prev = seen.get(text);
        if (prev)
            prev.n++;
        else
            seen.set(text, { n: 1, rule: f.rule, marks });
        const remedy = ruleById.get(f.rule)?.remedy;
        if (remedy)
            remedies.add(stripRuleCitations(remedy));
    }
    for (const [text, info] of seen) {
        const line = p("", info.rule === "R-156" ? "shelter" : "heat");
        linkNamesIn(line, info.n === 1 ? text : `${info.n} × ${text}`, info.marks);
        mark(line, { kind: "rule", id: info.rule });
    }
    for (const r of remedies)
        p(r, "hint");
}
function firstFreezePassed(seasonYear, freezeMmdd, todayIso) {
    if (!freezeMmdd || !/^\d{2}-\d{2}$/.test(freezeMmdd))
        return false;
    return todayIso >= `${seasonYear}-${freezeMmdd}`;
}
export async function setupLog(bundle, onLogChange) {
    let db;
    try {
        db = await openLog();
    }
    catch (e) {
        $("logmsg").textContent = `Browser storage unavailable (${e}) - the season log is off.`;
        return;
    }
    app.userSpecies = await listUserSpecies(db);
    app.soilObservations = await listSoilObservations(db);
    app.soilRefresh = async () => { app.soilObservations = await listSoilObservations(db); };
    setSoilHooks({
        save: async (rec) => {
            await putSoilObservation(db, rec);
            await app.soilRefresh?.();
            onLogChange();
        },
    });
    setSoilJump((ground) => {
        reselectSoilGround(ground);
        go("log", "soilcard");
    });
    const msg = (text, err = false) => {
        const m = $("logmsg");
        m.textContent = text;
        m.className = err ? "hint err" : "hint";
    };
    const said = (text) => {
        msg("");
        toast(text);
    };
    const sang = (text) => {
        msg("");
        celebrate(text);
    };
    const fillSelect = (id, values, labels) => {
        const sel = $(id);
        sel.innerHTML = "";
        for (const v of values) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = labels ? labels(v) : v;
            sel.appendChild(o);
        }
    };
    fillSelect("obsevent", OBSERVATION_EVENTS);
    fillSelect("obssev", OBSERVATION_SEVERITIES);
    {
        const ev = $("obsevent");
        const grp = document.createElement("optgroup");
        grp.label = "Soil";
        for (const [value, label] of SOIL_COMPOSER_EVENTS) {
            const o = document.createElement("option");
            o.value = value;
            o.textContent = label;
            grp.appendChild(o);
        }
        ev.appendChild(grp);
    }
    {
        const ev = $("obsevent"), sv = $("obssev");
        const gr = $("obsground");
        const syncSev = () => {
            const soil = ev.value.startsWith("soil_");
            sv.hidden = soil || ev.value !== "frost";
            gr.hidden = !soil;
        };
        ev.addEventListener("change", syncSev);
        syncSev();
    }
    {
        const wide = matchMedia("(min-width: 768px)");
        const setFold = () => {
            for (const id of ["fold-garden", "fold-supplies"]) {
                const f = document.getElementById(id);
                if (f)
                    f.open = wide.matches;
            }
        };
        setFold();
        wide.addEventListener("change", setFold);
    }
    const today = new Date().toISOString().slice(0, 10);
    ($("obsdate")).value = today;
    const seasonSel = $("logseason");
    const currentSeasonId = seasonId;
    const persists = (speciesId) => {
        const s = bundle.species.find((x) => x.id === speciesId)
            ?? app.userSpecies.find((x) => x.id === speciesId);
        return lifespanPersists(s);
    };
    const resolvePlanting = (p, cause, date) => resolvePlantingAtClose(p, cause, date, persists);
    const PLANT_DOTS = ["#d1495b", "#e0b64f", "#5f9e5f", "#7b9acc", "#c77dff", "#16a34a", "#5f7d2e", "#93ad57"];
    let viewedYear = null;
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fmtMD = (md) => {
        if (!md)
            return null;
        const m = /^(\d{2})-(\d{2})$/.exec(md);
        return m ? `${MONTHS[Number(m[1]) - 1] ?? m[1]} ${Number(m[2])}` : md;
    };
    const round2 = (n) => Math.round(n * 100) / 100;
    const localityBit = (plot) => {
        const addr = plot?.address?.trim();
        if (addr)
            return addr;
        const anchor = plot?.anchor;
        if (!anchor)
            return null;
        const clim = resolveClimate(anchor.lat, anchor.lon, bundle);
        if (clim?.site?.key && clim.distanceKm < 60)
            return `near ${titleCase(humanize(clim.site.key))}`;
        return `${round2(anchor.lat)}, ${round2(anchor.lon)}`;
    };
    const locationLabel = (plot) => {
        const bits = [];
        const loc = localityBit(plot);
        if (loc)
            bits.push(loc);
        const anchor = plot?.anchor;
        if (anchor) {
            const zone = resolveZone(anchor.lat, anchor.lon, bundle);
            if (zone && zone.zone != null)
                bits.push(`zone ${zone.label ?? zone.zone}`);
        }
        return bits.length ? bits.join(" · ") : null;
    };
    const renderActiveGarden = (plot, gardenCount) => {
        const bar = document.getElementById("activegarden");
        if (!bar)
            return;
        const real = !!(plot?.anchor || (plot?.beds?.length ?? 0) > 0);
        if (!real || gardenCount <= 1) {
            bar.hidden = true;
            return;
        }
        bar.innerHTML = "";
        const nm = el("span", "ag-name");
        nm.textContent = `${plot?.name ?? humanize(app.currentPlotId)}${plot?.shared ? ` (${copy.teamsSharedTag})` : ""}`;
        const where = locationLabel(plot);
        const w = el("span", "ag-where");
        w.textContent = where ? ` · ${where}` : " · location not set";
        bar.append(nm, w);
        if (gardenCount > 1) {
            const s = el("span", "ag-switch");
            s.textContent = "switch ▾";
            bar.appendChild(s);
        }
        bar.title = gardenCount > 1
            ? "your active garden - tap to switch garden or change its location"
            : "your active garden - tap to change its location";
        bar.hidden = false;
        bar.onclick = () => { const wh = document.getElementById("step-where"); if (wh)
            wh.open = true; };
    };
    const renderRestore = async () => {
        const sec = document.getElementById("gardenrestore");
        if (!sec)
            return;
        const plotId = app.currentPlotId;
        const mine = (await listSyncBackups(db)).filter((b) => (b.kind === "plot" && b.key === plotId) || (b.kind === "season" && b.key.startsWith(`${plotId}:`)));
        sec.hidden = mine.length === 0;
        if (sec.hidden)
            return;
        const list = $("restorelist");
        list.innerHTML = "";
        for (const b of mine) {
            const row = el("div", "restorerow");
            const mins = Math.max(0, Math.round((Date.now() - b.replacedAt) / 60000));
            const when = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago`
                : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago` : new Date(b.replacedAt).toLocaleDateString();
            const what = b.kind === "season"
                ? `${copy.restoreSeasonLabel} ${b.key.slice(plotId.length + 1)} (${(b.record.plantings ?? []).length} plants)`
                : `${copy.restoreLayoutLabel} (${(b.record.beds ?? []).length} beds)`;
            const lab = el("span", "hint");
            lab.textContent = `${what} - replaced ${when}`;
            const btn = el("button");
            btn.type = "button";
            btn.textContent = copy.restoreBtn;
            btn.addEventListener("click", async () => {
                if (!btn.classList.contains("arm")) {
                    btn.classList.add("arm");
                    btn.textContent = copy.restoreArmedBtn;
                    return;
                }
                btn.disabled = true;
                try {
                    await restoreSyncBackup(db, b.id);
                    msg(copy.restoreDone);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                    btn.disabled = false;
                }
            });
            row.append(lab, btn);
            list.appendChild(row);
        }
    };
    const renderFeed = async (plot) => {
        const sec = document.getElementById("gardenfeed");
        if (!sec)
            return;
        const show = isSignedIn() && !!plot && !plot.example;
        sec.hidden = !show;
        if (!show)
            return;
        ($("feedbody")).placeholder = copy.feedPostPlaceholder;
        const me = (signedInEmail() ?? "").toLowerCase();
        const list = $("feedlist");
        list.innerHTML = "";
        const posts = (await listPosts(db, app.currentPlotId)).filter((p) => !p.deleted);
        if (!posts.length) {
            const e = el("p", "hint");
            e.textContent = copy.feedEmpty;
            list.appendChild(e);
            return;
        }
        for (const po of posts) {
            const card = el("div", "feedpost");
            const head = el("div", "feedpost-head");
            const who = el("span", "feedpost-who");
            who.textContent = po.author || "a gardener";
            const when = el("span", "feedpost-when");
            when.textContent = ` · ${feedTime(po.at)}`;
            head.append(who, when);
            const body = postBody(po.body, "feedpost-body");
            card.append(head, body);
            if (po.author && po.author.toLowerCase() === me) {
                const del = el("button", "feedpost-del");
                del.type = "button";
                del.textContent = copy.feedDeleteBtn;
                del.addEventListener("click", async () => { await putPost(db, { ...po, deleted: true }); await refresh(); });
                card.appendChild(del);
            }
            list.appendChild(card);
        }
    };
    const renderGardensClimate = (allPlots) => {
        const host = $("gardensclimate");
        host.innerHTML = "";
        if (allPlots.length < 2)
            return;
        const def = defaultPlotId();
        const intro = el("p", "hint");
        intro.textContent = "Each garden has its own climate. Tap one to switch to it - the frost/heat you log below attaches to the highlighted garden.";
        host.appendChild(intro);
        const wrap = el("div", "gc-cards");
        const ordered = [...allPlots.filter((pl) => pl.id === app.currentPlotId), ...allPlots.filter((pl) => pl.id !== app.currentPlotId)];
        for (const pl of ordered) {
            const card = el("div", "gc-card" + (pl.id === app.currentPlotId ? " active" : ""));
            const head = el("div", "gc-head");
            const nm = el("span", "gc-name");
            nm.textContent = (pl.name ?? humanize(pl.id)) + (pl.id === def ? " (default)" : "");
            head.appendChild(nm);
            const anchor = pl.anchor;
            if (anchor) {
                const zone = resolveZone(anchor.lat, anchor.lon, bundle);
                if (zone && zone.zone != null) {
                    const z = el("span", "gc-zone");
                    z.textContent = `zone ${zone.label ?? zone.zone}`;
                    head.appendChild(z);
                }
                card.appendChild(head);
                const loc = localityBit(pl);
                if (loc) {
                    const w = el("div", "gc-where");
                    w.textContent = loc;
                    card.appendChild(w);
                }
                const site = resolveClimate(anchor.lat, anchor.lon, bundle)?.site;
                const lf = fmtMD(site?.last_frost_32f?.p50);
                const ff = fmtMD(site?.first_freeze_32f_p50);
                const line = el("div", "gc-frost");
                if (lf || ff) {
                    const days = site?.growing_season_days_p50;
                    line.textContent = `last frost ~${lf ?? "?"} → first freeze ~${ff ?? "?"}${days ? ` · ~${days} frost-free days` : ""}`;
                }
                else {
                    line.textContent = "no nearby frost station - hardiness zone only";
                    line.classList.add("muted");
                }
                card.appendChild(line);
            }
            else {
                card.appendChild(head);
                const line = el("div", "gc-frost muted");
                line.textContent = "location not set yet";
                card.appendChild(line);
            }
            if (pl.id !== app.currentPlotId)
                card.addEventListener("click", () => void activatePlot(pl.id));
            wrap.appendChild(card);
        }
        host.appendChild(wrap);
    };
    const mkRename = (label, current, save) => {
        const btn = el("button", "linky");
        btn.type = "button";
        btn.textContent = label;
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = current;
            inp.setAttribute("aria-label", label);
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = "save";
            const go = () => void (async () => {
                try {
                    await save(inp.value);
                    await refresh();
                }
                catch (e) {
                    msg(String(e instanceof Error ? e.message : e), true);
                }
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    const mkDeleteGarden = (plot) => {
        const name = plot?.name ?? humanize(app.currentPlotId);
        const btn = el("button", "linky gardendelete");
        btn.type = "button";
        btn.textContent = "Delete this garden…";
        btn.addEventListener("click", () => {
            const f = el("span", "renameform");
            const inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = `type "${name}" to confirm`;
            inp.setAttribute("aria-label", "type the garden's name to confirm deleting it");
            const ok = el("button", "linky");
            ok.type = "button";
            ok.textContent = "delete";
            const go = () => void (async () => {
                if (inp.value.trim() !== name) {
                    msg(`nothing was deleted - type the garden's own name, "${name}", to confirm.`, true);
                    return;
                }
                const id = app.currentPlotId;
                const account = plot?.owner === "account";
                const { seasons } = await eraseGarden(db, id, { tombstone: account });
                msg(`Deleted "${name}"${seasons ? ` and its ${seasons} season${seasons === 1 ? "" : "s"}` : ""} - a safety copy stays on this device${account ? ", and the deletion syncs to your account's other devices" : ""}.`);
                const left = (await listPlots(db)).filter((p) => !p.example);
                await activatePlot(left[0]?.id ?? defaultWorkspacePlotId());
            })();
            ok.addEventListener("click", go);
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter")
                go(); });
            f.append(inp, ok);
            btn.replaceWith(f);
        });
        return btn;
    };
    const openCards = new Set();
    let reselect = null;
    let openSpecies = null;
    app.openLogBed = (bedName, species) => {
        openCards.add(bedName);
        openSpecies = species ? { bed: bedName, species } : null;
        location.hash = "#/log";
        void refresh();
    };
    const renderLocations = (seasons, beds, plot, allPlots) => {
        const host = $("loglocations");
        host.innerHTML = "";
        const head = el("div", "loc-head");
        if (allPlots.length > 1) {
            const sel = document.createElement("select");
            sel.className = "garden-sel";
            sel.setAttribute("aria-label", "garden");
            const def = defaultPlotId();
            for (const pl of allPlots) {
                const o = document.createElement("option");
                o.value = pl.id;
                o.textContent = (pl.name ?? humanize(pl.id)) + (pl.id === def ? " (default)" : "") + (pl.shared ? ` (${copy.teamsSharedTag})` : "");
                sel.appendChild(o);
            }
            sel.value = app.currentPlotId;
            sel.addEventListener("change", () => void activatePlot(sel.value));
            head.appendChild(sel);
            const isDef = def === app.currentPlotId;
            const star = el("button", "garden-def" + (isDef ? " on" : ""));
            star.type = "button";
            star.textContent = isDef ? "default garden" : "set as default";
            star.title = isDef
                ? "this garden opens when you sign in - tap to clear"
                : "make this the garden that opens when you sign in";
            star.addEventListener("click", () => { setDefaultPlot(isDef ? null : app.currentPlotId); void refresh(); });
            head.appendChild(star);
        }
        else {
            const name = el("span", "loc-name");
            name.textContent = plot?.name ?? humanize(app.currentPlotId);
            head.appendChild(name);
        }
        const sub = el("span", "loc-sub");
        sub.textContent = `${beds.length} bed${beds.length === 1 ? "" : "s"}`;
        head.appendChild(sub);
        if (plot?.shared) {
            const tag = el("span", "loc-shared");
            tag.textContent = copy.teamsSharedTag;
            head.appendChild(tag);
        }
        else {
            head.appendChild(mkRename("Rename garden", plot?.name ?? humanize(app.currentPlotId), (v) => setPlotName(db, app.currentPlotId, v)));
            if (app.currentPlotId !== EXAMPLE_PLOT_ID)
                head.appendChild(mkDeleteGarden(plot));
        }
        host.appendChild(head);
        const where = locationLabel(plot);
        if (where) {
            const w = el("p", "loc-where");
            w.textContent = where;
            host.appendChild(w);
        }
        if (!seasons.length && !beds.length) {
            const hint = el("p", "hint");
            hint.textContent = "No beds yet - create one on the Plan tab (trace or size it on the map). It then shows here with its status each season.";
            host.appendChild(hint);
            return;
        }
        const latestId = seasons.length ? seasons[seasons.length - 1].id : null;
        if (viewedYear == null || !seasons.some((s) => s.id === viewedYear))
            viewedYear = latestId;
        const season = seasons.find((s) => s.id === viewedYear) ?? null;
        const closed = !!season?.closed_date;
        const readOnly = closed;
        const openDrafts = season && !closed
            ? draftPlantings(bundle, { lat: plot?.anchor?.lat ?? null, lon: plot?.anchor?.lon ?? null }, season, beds)
            : [];
        if (seasons.length) {
            const years = el("div", "years");
            const lbl = el("span", "years-lbl");
            lbl.textContent = "Season";
            years.appendChild(lbl);
            const ribbon = el("div", "seasonribbon");
            ribbon.setAttribute("role", "tablist");
            ribbon.setAttribute("aria-label", "season year");
            for (const s of [...seasons].sort((a, b) => b.id - a.id)) {
                const on = s.id === viewedYear;
                const chip = el("button", `seasonchip${on ? " on" : ""}`);
                chip.type = "button";
                chip.setAttribute("role", "tab");
                chip.setAttribute("aria-selected", on ? "true" : "false");
                const yr = el("span", "seasonchip-y");
                yr.textContent = String(s.id);
                chip.appendChild(yr);
                const state = s.closed_date ? "closed" : s.id === latestId ? "tracking" : null;
                if (state) {
                    const sub = el("span", "seasonchip-s");
                    sub.textContent = state;
                    chip.appendChild(sub);
                }
                chip.addEventListener("click", () => { viewedYear = s.id; void refresh(); });
                ribbon.appendChild(chip);
            }
            years.appendChild(ribbon);
            if (readOnly) {
                const ro = el("span", "ro-note");
                ro.textContent = "history · read-only";
                years.appendChild(ro);
            }
            host.appendChild(years);
        }
        if (!season) {
            const p = el("p", "hint");
            const out = el("span", "hint");
            const startSeasonYear = async (y) => {
                try {
                    if (!(await getSeason(db, app.currentPlotId, y)))
                        await putSeason(db, { id: y, plot: app.currentPlotId, plantings: [], observations: [] });
                    viewedYear = y;
                    await refresh();
                }
                catch (e) {
                    out.textContent = " " + (e instanceof Error ? e.message : String(e));
                    out.className = "why";
                }
            };
            const year = new Date().getFullYear();
            const anchor = plot?.anchor ?? null;
            const freezeMmdd = anchor ? (resolveClimate(anchor.lat, anchor.lon, bundle)?.site?.first_freeze_32f_p50 ?? null) : null;
            const today = new Date().toISOString().slice(0, 10);
            const offSeason = freezeMmdd ? firstFreezePassed(year, freezeMmdd, today) : today >= `${year}-10-15`;
            if (offSeason) {
                p.textContent = freezeMmdd
                    ? `Your first fall freeze (${fmtMD(freezeMmdd)}) has passed - the ${year} season is nearly over here. Plan for ${year + 1}, or say you're still growing this year.`
                    : `It's late in the year to start ${year}. Plan for ${year + 1}, or say you're still growing this year.`;
                const next = el("button", "primary");
                next.type = "button";
                next.id = "seasonstart";
                next.textContent = `Plan for ${year + 1}`;
                next.addEventListener("click", () => void startSeasonYear(year + 1));
                const now = el("button", "secondary");
                now.type = "button";
                now.textContent = `I'm still growing in ${year}`;
                now.addEventListener("click", () => void startSeasonYear(year));
                const row = el("p", "logrow");
                row.append(next, now, out);
                host.append(p, row);
                return;
            }
            p.textContent = "No season started for this address yet. Start one to record what you plant and the frosts you see here.";
            const btn = el("button", "primary");
            btn.type = "button";
            btn.textContent = `Start season ${year}`;
            btn.id = "seasonstart";
            btn.addEventListener("click", () => void startSeasonYear(year));
            const row = el("p");
            row.append(btn, out);
            host.append(p, row);
            return;
        }
        let causeSel;
        let dateInp;
        let closeCtrl;
        if (!readOnly) {
            closeCtrl = el("div", "logrow closerow");
            const lbl = el("label");
            lbl.textContent = "At close, annuals end by";
            causeSel = document.createElement("select");
            causeSel.setAttribute("aria-label", "close end cause");
            for (const v of END_CAUSES) {
                const o = document.createElement("option");
                o.value = v;
                o.textContent = humanize(v);
                causeSel.appendChild(o);
            }
            causeSel.value = "pulled";
            const on = el("label");
            on.textContent = "on";
            dateInp = document.createElement("input");
            dateInp.type = "date";
            dateInp.value = today;
            dateInp.setAttribute("aria-label", "close date");
            closeCtrl.append(lbl, causeSel, on, dateInp);
        }
        const seasonId = season.id;
        const doRemove = async (idx, species) => {
            try {
                await removePlanting(db, app.currentPlotId, seasonId, idx);
                said(`Removed ${commonName(bundle, species)}`);
                await refresh();
            }
            catch (e) {
                msg(String(e instanceof Error ? e.message : e), true);
            }
        };
        const endCauseFromMode = (mode) => {
            const m = mode.toLowerCase();
            if (/frost|freeze|frozen|cold|hail/.test(m))
                return "frost";
            if (/drought|dry|under.?water|heat|scorch/.test(m))
                return "drought";
            if (/slug|snail|aphid|beetle|bug|caterpillar|worm|borer|mite|deer|rabbit|vole|gopher|pest|animal|bird|squirrel|groundhog/.test(m))
                return "pest";
            if (/blight|rot|mildew|mould|mold|wilt|rust|fung|virus|leaf.?spot|scab|canker|damping|smut|anthracnose|disease/.test(m))
                return "disease";
            return "unknown";
        };
        const plantPanel = (host, idx, bedName) => {
            host.innerHTML = "";
            const p = (season.plantings ?? [])[idx];
            if (!p)
                return;
            const head = el("div", "pp-head");
            const nm = plantLink(plantingLabel(bundle, p.species, p.cultivar_group ?? null), p.species, p.cultivar_group ?? null);
            const st = el("span", "pmeta");
            st.textContent = p.end_cause ? ` · ended (${humanize(p.end_cause).toLowerCase()}${p.end_date ? ` ${p.end_date}` : ""})`
                : p.carried_over ? " · overwinters" : " · growing";
            const fails = (p.failures ?? []).map((f) => `${humanize(f.mode).toLowerCase()} (${f.severity})`);
            if (fails.length) {
                const fm = el("span", "pmeta");
                fm.textContent = ` · suffered ${fails.join(", ")}`;
                head.append(nm, st, fm);
            }
            else
                head.append(nm, st);
            host.appendChild(head);
            const shots = (p.notes ?? []).filter((n) => n.photo)
                .sort((a, b) => b.date.localeCompare(a.date));
            if (shots.length) {
                const strip = el("div", "photostrip");
                for (const n of shots) {
                    const img = document.createElement("img");
                    img.className = "photothumb";
                    img.loading = "lazy";
                    img.alt = `photo ${n.date} · ${n.text}`;
                    img.addEventListener("click", () => img.classList.toggle("photobig"));
                    photoInto(img, seasonId, n.photo);
                    strip.appendChild(img);
                }
                host.appendChild(strip);
            }
            if (readOnly)
                return;
            const speciesOpts = () => [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
                ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])]
                .sort((a, b) => a[1].localeCompare(b[1]));
            const stay = (i2) => { reselect = i2 === null ? null : { bed: bedName, idx: i2 }; };
            const editPanel = () => {
                const f = el("div", "editform");
                const section = (title) => {
                    const s = el("div", "editsec");
                    const h = el("p", "editsec-h");
                    h.textContent = title;
                    s.appendChild(h);
                    f.appendChild(s);
                    return s;
                };
                const btn = (label, cls = "linky") => {
                    const b2 = el("button", cls);
                    b2.type = "button";
                    b2.textContent = label;
                    return b2;
                };
                const rec = section("The record");
                const pick = document.createElement("select");
                pick.setAttribute("aria-label", "species");
                for (const [id, name] of speciesOpts()) {
                    const o = document.createElement("option");
                    o.value = id;
                    o.textContent = name;
                    if (id === p.species)
                        o.selected = true;
                    pick.appendChild(o);
                }
                const dateRow = (label, val) => {
                    const w = el("label", "editrow");
                    const inp = document.createElement("input");
                    inp.type = "date";
                    inp.value = val ?? "";
                    inp.setAttribute("aria-label", label);
                    w.append(document.createTextNode(label + " "), inp);
                    return [w, inp];
                };
                const [sw, si] = dateRow("sown", p.sown);
                const [tw, ti] = dateRow("transplanted", p.transplanted);
                const [fw, fi] = dateRow("first harvest", p.first_harvest);
                const [lw, li] = dateRow("last harvest", p.last_harvest);
                const yw = el("label", "editrow");
                const yi = document.createElement("input");
                yi.type = "number";
                yi.min = "0";
                yi.step = "0.1";
                yi.value = p.yield_kg != null ? String(p.yield_kg) : "";
                yi.setAttribute("aria-label", "yield kg");
                yw.append(document.createTextNode("yield kg "), yi);
                const saveRec = btn("save changes");
                saveRec.addEventListener("click", () => void (async () => {
                    try {
                        await updatePlanting(db, app.currentPlotId, seasonId, idx, {
                            species: pick.value,
                            sown: si.value || undefined, transplanted: ti.value || undefined,
                            first_harvest: fi.value || undefined, last_harvest: li.value || undefined,
                            yield_kg: yi.value ? Number(yi.value) : undefined,
                        });
                        const nm = plantingLabel(bundle, pick.value, p.cultivar_group ?? null);
                        said(fi.value && fi.value !== (p.first_harvest ?? "") ? plantEntryLine("first_harvest", nm, fi.value)
                            : `Updated ${commonName(bundle, pick.value)}`);
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                rec.append(pick, sw, tw, fw, lw, yw, saveRec);
                if (!p.end_cause) {
                    const diary = section("A note");
                    diary.classList.add("diary");
                    const txt = document.createElement("input");
                    txt.type = "text";
                    txt.setAttribute("aria-label", "plant note");
                    txt.placeholder = "e.g. the bees found the borage today";
                    const ndt = document.createElement("input");
                    ndt.type = "date";
                    ndt.value = today;
                    ndt.setAttribute("aria-label", "note date");
                    const saveDiary = btn("add note");
                    saveDiary.addEventListener("click", () => void (async () => {
                        if (!txt.value.trim()) {
                            msg("write the note first.", true);
                            return;
                        }
                        try {
                            await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: ndt.value || today, text: txt.value.trim() });
                            said(plantEntryLine("note", plantingLabel(bundle, p.species, p.cultivar_group ?? null), ndt.value || today));
                            stay(idx);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    diary.append(txt, ndt, saveDiary);
                }
                if (!p.end_cause) {
                    const note = section("Note what happened");
                    const mode = document.createElement("input");
                    mode.type = "text";
                    mode.placeholder = "what (e.g. slugs)";
                    mode.setAttribute("aria-label", "failure mode");
                    const sev = document.createElement("select");
                    sev.setAttribute("aria-label", "severity");
                    for (const v of FAILURE_SEVERITIES) {
                        const o = document.createElement("option");
                        o.value = v;
                        o.textContent = v;
                        sev.appendChild(o);
                    }
                    const dt = document.createElement("input");
                    dt.type = "date";
                    dt.value = today;
                    dt.setAttribute("aria-label", "date");
                    const diedL = el("label", "faildied");
                    const died = document.createElement("input");
                    died.type = "checkbox";
                    diedL.append(died, document.createTextNode(" and it died"));
                    const saveNote = btn("save note");
                    saveNote.addEventListener("click", () => void (async () => {
                        if (!mode.value.trim()) {
                            msg("name what went wrong (e.g. slugs).", true);
                            return;
                        }
                        try {
                            await addFailure(db, app.currentPlotId, seasonId, idx, { date: dt.value, mode: mode.value.trim(), severity: sev.value });
                            if (died.checked)
                                await endPlanting(db, app.currentPlotId, seasonId, idx, endCauseFromMode(mode.value.trim()), dt.value);
                            said(`Noted "${mode.value.trim()}" on ${plantingLabel(bundle, p.species, p.cultivar_group ?? null)}${died.checked ? " - marked died" : ""}`);
                            stay(idx);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    note.append(document.createTextNode("suffered "), mode, sev, dt, diedL, saveNote);
                }
                const ph = section("Add a photo");
                const file = document.createElement("input");
                file.type = "file";
                file.accept = "image/*";
                file.setAttribute("capture", "environment");
                file.setAttribute("aria-label", "photo");
                const cap = document.createElement("input");
                cap.type = "text";
                cap.placeholder = "caption (optional)";
                cap.setAttribute("aria-label", "photo caption");
                const [pw, pi] = dateRow("taken", today);
                const savePh = btn("save photo");
                savePh.addEventListener("click", () => void (async () => {
                    const f = file.files?.[0];
                    if (!f) {
                        msg("choose or take a photo first.", true);
                        return;
                    }
                    try {
                        const blob = await downscalePhoto(f);
                        const taken = new Set((season.plantings ?? [])
                            .flatMap((q) => (q.notes ?? []).map((n) => n.photo))
                            .filter((x) => !!x));
                        const name = mintPhotoName(pi.value || today, taken);
                        await putPhoto(db, app.currentPlotId, seasonId, name, blob);
                        await addPlantingNote(db, app.currentPlotId, seasonId, idx, { date: pi.value || today, text: cap.value.trim() || "Photo", photo: name });
                        said(`Photo saved on ${plantingLabel(bundle, p.species, p.cultivar_group ?? null)} - it stays on this device and rides the export.`);
                        stay(idx);
                        await refresh();
                    }
                    catch (e) {
                        const full = e instanceof DOMException && e.name === "QuotaExceededError";
                        msg(full ? "this device's storage is full - the photo was not saved. Free some space and try again."
                            : `could not save the photo: ${String(e instanceof Error ? e.message : e)}`, true);
                    }
                })());
                ph.append(file, cap, pw, savePh);
                const rep = section(p.end_cause ? "Plant something new in this spot" : "Replace with a new plant (this one ends, kept in history)");
                const pick2 = document.createElement("select");
                pick2.setAttribute("aria-label", "replace with which plant");
                for (const [id, name] of speciesOpts()) {
                    const o = document.createElement("option");
                    o.value = id;
                    o.textContent = name;
                    pick2.appendChild(o);
                }
                const repGo = btn(p.end_cause ? "plant it" : "replace");
                repGo.addEventListener("click", () => void (async () => {
                    try {
                        if (!p.end_cause)
                            await endPlanting(db, app.currentPlotId, seasonId, idx, "pulled", today);
                        const after = await addPlanting(db, app.currentPlotId, seasonId, { species: pick2.value, region: parseRegionSnapshot(p.region), sown: today });
                        sang(`${commonName(bundle, pick2.value)} planted where the ${plantingLabel(bundle, p.species, p.cultivar_group ?? null).toLowerCase()} was`);
                        stay((after.plantings ?? []).length - 1);
                        await refresh();
                    }
                    catch (e) {
                        msg(String(e instanceof Error ? e.message : e), true);
                    }
                })());
                rep.append(pick2, repGo);
                if (p.end_cause) {
                    const re = section("Marked ended by mistake?");
                    const reopen = btn("mark it growing again");
                    reopen.addEventListener("click", () => void (async () => {
                        try {
                            await updatePlanting(db, app.currentPlotId, seasonId, idx, { end_cause: undefined, end_date: undefined });
                            said(`${plantingLabel(bundle, p.species, p.cultivar_group ?? null)} is growing again`);
                            stay(idx);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    }));
                    re.appendChild(reopen);
                }
                const danger = section("Remove the record entirely");
                const delBtn = btn("delete this record", "linky danger");
                let armed = false;
                delBtn.addEventListener("click", () => void (async () => {
                    if (!armed) {
                        armed = true;
                        delBtn.textContent = "delete - tap again to confirm";
                        delBtn.classList.add("arm");
                        setTimeout(() => { armed = false; delBtn.textContent = "delete this record"; delBtn.classList.remove("arm"); }, 4000);
                        return;
                    }
                    stay(null);
                    await doRemove(idx, p.species);
                })());
                danger.appendChild(delBtn);
                return f;
            };
            const acts = el("div", "pp-acts");
            const editBtn = el("button", "linky");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", () => { acts.replaceWith(editPanel()); });
            acts.appendChild(editBtn);
            host.appendChild(acts);
        };
        const speciesPanel = (host, species, onBed) => {
            host.innerHTML = "";
            const all = onBed.filter(([q]) => q.species === species);
            const living = all.filter(([q]) => !q.end_cause);
            const ended = all.length - living.length;
            const head = el("div", "pp-head");
            const nm = plantLink(commonName(bundle, species), species);
            const st = el("span", "pmeta");
            st.textContent = ` ×${all.length}`
                + (ended ? ` · ${living.length} growing · ${ended} ended` : ` · ${living.length} growing`);
            head.append(nm, st);
            host.appendChild(head);
            const acts = el("div", "pp-acts");
            if (!readOnly && living.length) {
                const noteBtn = el("button", "linky");
                noteBtn.type = "button";
                noteBtn.textContent = "Note / died";
                noteBtn.addEventListener("click", () => {
                    const f = el("div", "failform");
                    const mode = document.createElement("input");
                    mode.type = "text";
                    mode.placeholder = "what (e.g. slugs)";
                    mode.setAttribute("aria-label", "failure mode");
                    const sev = document.createElement("select");
                    sev.setAttribute("aria-label", "severity");
                    for (const v of FAILURE_SEVERITIES) {
                        const o = document.createElement("option");
                        o.value = v;
                        o.textContent = v;
                        sev.appendChild(o);
                    }
                    const dt = document.createElement("input");
                    dt.type = "date";
                    dt.value = today;
                    dt.setAttribute("aria-label", "date");
                    const cntWrap = el("span", "failcount");
                    const cnt = document.createElement("input");
                    cnt.type = "number";
                    cnt.min = "1";
                    cnt.max = String(living.length);
                    cnt.value = String(living.length);
                    cnt.setAttribute("aria-label", "how many plants affected");
                    cntWrap.append(document.createTextNode("- "), cnt, document.createTextNode(` of ${living.length}`));
                    const diedL = el("label", "faildied");
                    const died = document.createElement("input");
                    died.type = "checkbox";
                    diedL.append(died, document.createTextNode(" and they died"));
                    const ok = el("button", "linky");
                    ok.type = "button";
                    ok.textContent = "save note";
                    ok.addEventListener("click", () => void (async () => {
                        if (!mode.value.trim()) {
                            msg("name what went wrong (e.g. slugs).", true);
                            return;
                        }
                        const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                        const fail = { date: dt.value, mode: mode.value.trim(), severity: sev.value };
                        const cause = died.checked ? endCauseFromMode(fail.mode) : null;
                        try {
                            for (const [, idx] of living.slice(0, wantN)) {
                                await addFailure(db, app.currentPlotId, seasonId, idx, fail);
                                if (cause)
                                    await endPlanting(db, app.currentPlotId, seasonId, idx, cause, fail.date);
                            }
                            said(`Noted "${fail.mode}" on ${wantN} ${commonName(bundle, species)}${died.checked ? " - marked died" : ""}`);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    f.append(document.createTextNode("suffered "), mode, sev, dt, cntWrap, diedL, ok);
                    noteBtn.replaceWith(f);
                });
                acts.appendChild(noteBtn);
                const detailsBtn = el("button", "linky");
                detailsBtn.type = "button";
                detailsBtn.textContent = "Update details";
                detailsBtn.addEventListener("click", () => {
                    const f = el("div", "editform");
                    const sec = el("div", "editsec");
                    const h = el("p", "editsec-h");
                    const bulkName = commonName(bundle, species);
                    linkNameIn(h, `Update all ${bulkName} at once`, bulkName, species);
                    sec.appendChild(h);
                    const shared = (get) => {
                        const vals = new Set(living.map(([q]) => get(q) ?? ""));
                        return vals.size === 1 ? [...vals][0] : "";
                    };
                    const pick = document.createElement("select");
                    pick.setAttribute("aria-label", "species");
                    for (const [id, name] of [...bundle.species.map((s) => [s.id, commonName(bundle, s.id)]),
                        ...app.userSpecies.map((s) => [s.id, commonName(bundle, s.id)])].sort((a, b) => a[1].localeCompare(b[1]))) {
                        const o = document.createElement("option");
                        o.value = id;
                        o.textContent = name;
                        if (id === species)
                            o.selected = true;
                        pick.appendChild(o);
                    }
                    const dateRow = (label, val) => {
                        const w = el("label", "editrow");
                        const inp = document.createElement("input");
                        inp.type = "date";
                        inp.value = val;
                        inp.setAttribute("aria-label", label);
                        w.append(document.createTextNode(label + " "), inp);
                        return [w, inp];
                    };
                    const [sw, si] = dateRow("sown", shared((p) => p.sown));
                    const [tw, ti] = dateRow("transplanted", shared((p) => p.transplanted));
                    const [fw, fi] = dateRow("first harvest", shared((p) => p.first_harvest));
                    const [lw, li] = dateRow("last harvest", shared((p) => p.last_harvest));
                    const yw = el("label", "editrow");
                    const yi = document.createElement("input");
                    yi.type = "number";
                    yi.min = "0";
                    yi.step = "0.1";
                    yi.value = shared((p) => p.yield_kg != null ? String(p.yield_kg) : "");
                    yi.setAttribute("aria-label", "yield kg each");
                    yw.append(document.createTextNode("yield kg (each) "), yi);
                    const cntWrap = el("span", "failcount");
                    const cnt = document.createElement("input");
                    cnt.type = "number";
                    cnt.min = "1";
                    cnt.max = String(living.length);
                    cnt.value = String(living.length);
                    cnt.setAttribute("aria-label", "how many plants to update");
                    cntWrap.append(document.createTextNode("apply to "), cnt, document.createTextNode(` of ${living.length}`));
                    const ok2 = el("button", "linky");
                    ok2.type = "button";
                    ok2.textContent = "apply to all";
                    const sync = () => { ok2.textContent = `apply to ${Math.max(1, Math.min(living.length, Number(cnt.value) || 1))}`; };
                    cnt.addEventListener("input", sync);
                    ok2.addEventListener("click", () => void (async () => {
                        const wantN = Math.max(1, Math.min(living.length, Number(cnt.value) || 1));
                        const patch = {};
                        if (pick.value !== species)
                            patch.species = pick.value;
                        if (si.value)
                            patch.sown = si.value;
                        if (ti.value)
                            patch.transplanted = ti.value;
                        if (fi.value)
                            patch.first_harvest = fi.value;
                        if (li.value)
                            patch.last_harvest = li.value;
                        if (yi.value)
                            patch.yield_kg = Number(yi.value);
                        if (!Object.keys(patch).length) {
                            msg("nothing to update - fill a field first.", true);
                            return;
                        }
                        try {
                            for (const [, idx] of living.slice(0, wantN))
                                await updatePlanting(db, app.currentPlotId, seasonId, idx, patch);
                            const label = pick.value !== species ? commonName(bundle, pick.value) : commonName(bundle, species);
                            said(`Updated ${wantN} ${label}`);
                            await refresh();
                        }
                        catch (e) {
                            msg(String(e instanceof Error ? e.message : e), true);
                        }
                    })());
                    sec.append(pick, sw, tw, fw, lw, yw, cntWrap, ok2);
                    f.appendChild(sec);
                    detailsBtn.replaceWith(f);
                });
                acts.appendChild(detailsBtn);
            }
            host.appendChild(acts);
        };
        if (beds.length) {
            const prev = seasons.find((s) => s.id === season.id - 1) ?? null;
            const plateBeds = beds.map((b) => ({ name: b.name, region: b.region, structure: b.structure }));
            const addDays = (iso, days) => {
                const d = new Date(`${iso}T12:00:00Z`);
                d.setUTCDate(d.getUTCDate() + days);
                return d.toISOString().slice(0, 10);
            };
            const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const sec = el("section", "logplate");
            const figWrap = el("div", "logplate-fig");
            const chips = el("div", "logplate-months");
            chips.setAttribute("role", "tablist");
            chips.setAttribute("aria-label", "month");
            let month = season.id === new Date().getFullYear() ? new Date().getMonth() + 1 : 7;
            const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const frame = gardenFrame(plateBeds, season.plantings ?? []);
            let fig = null;
            const plateSeason = openDrafts.length
                ? { ...season, plantings: [...(season.plantings ?? []), ...openDrafts] }
                : season;
            const modelFor = () => {
                const iso = `${season.id}-${String(month).padStart(2, "0")}-15`;
                return plateModel({ beds: plateBeds }, plateSeason, prev, iso, (p) => {
                    if (!p.sown)
                        return null;
                    const sp = bundle.species.find((x) => x.id === p.species);
                    if (!sp || sp.scheduling_model !== "dtm")
                        return null;
                    const dtm = resolveDtm(sp, p.cultivar_group ?? null);
                    return dtm ? addDays(p.sown, dtm[0]) : null;
                });
            };
            const captionFor = () => `Your garden in ${MONTH_LONG[month - 1]} ${season.id}`;
            const allIdx = (season.plantings ?? []).map((p, i) => [p, i]);
            const bedOf = (p) => beds.find((b) => !bedHasSections(b.name, beds) && plantingOnBed(p.region, b.region))?.name ?? "";
            const panel = el("div", "plantpanel");
            const hint = el("p", "hint");
            hint.textContent = readOnly
                ? "Tap a plant on the picture to see it. Tap a plant below to see all of it. +/− to zoom, ⤢ to reset."
                : "Tap a plant on the picture, then Edit - note it, fix its record, replace it, or remove it. Tap a plant below to act on all of that plant. +/− to zoom, ⤢ to reset.";
            panel.appendChild(hint);
            const legend = el("div", "bd-legend");
            let selIdx = null;
            let hotSpecies = null;
            let zoom = 1;
            const marks = () => fig ? [...fig.querySelectorAll("circle.plate-plant")] : [];
            const clearHot = () => { for (const c of legend.querySelectorAll(".bd-chip.hot"))
                c.classList.remove("hot"); hotSpecies = null; };
            const dressMarks = () => {
                for (const d of marks()) {
                    d.classList.add("bd-plant");
                    d.classList.toggle("sel", selIdx !== null && d.dataset.idx === String(selIdx));
                    d.classList.toggle("dim", !!hotSpecies && d.dataset.species !== hotSpecies);
                }
            };
            const svgOf = () => fig?.querySelector("svg.home-glance") ?? null;
            const applyZoom = () => { const svg = svgOf(); if (svg)
                svg.style.width = `${zoom * 100}%`; };
            const selectPlant = (idx) => {
                const p = (season.plantings ?? [])[idx];
                if (!p)
                    return;
                clearHot();
                selIdx = idx;
                dressMarks();
                plantPanel(panel, idx, bedOf(p));
            };
            const openBedCard = (name) => {
                const card = [...host.querySelectorAll(".card")].find((c) => c.dataset.bed === name);
                if (!card)
                    return;
                if (!card.classList.contains("open"))
                    card.querySelector(".card-head")?.click();
                card.scrollIntoView({ block: "start", behavior: "smooth" });
            };
            const draw = () => {
                const model = modelFor();
                if (fig && figWrap.contains(fig)) {
                    yardRepaint(fig, model, captionFor());
                    dressMarks();
                    return;
                }
                figWrap.replaceChildren();
                if (!frame)
                    return;
                fig = yardFigure(frame, plot?.anchor ?? null, openBedCard, () => { }, model, captionFor());
                const svg = svgOf();
                if (svg) {
                    const scroller = el("div", "bd-scroll");
                    svg.replaceWith(scroller);
                    scroller.appendChild(svg);
                    applyZoom();
                    svg.addEventListener("click", (e) => {
                        const t = e.target;
                        if (t instanceof SVGCircleElement && t.classList.contains("plate-plant") && t.dataset.idx !== undefined)
                            selectPlant(Number(t.dataset.idx));
                    });
                }
                dressMarks();
                figWrap.appendChild(fig);
            };
            for (let m = 1; m <= 12; m++) {
                const chip = el("button", `logmonth${m === month ? " on" : ""}`);
                chip.type = "button";
                chip.setAttribute("role", "tab");
                chip.setAttribute("aria-selected", String(m === month));
                chip.textContent = MON[m - 1];
                chip.addEventListener("click", () => {
                    month = m;
                    [...chips.children].forEach((c, i) => { c.classList.toggle("on", i + 1 === m); c.setAttribute("aria-selected", String(i + 1 === m)); });
                    draw();
                });
                chips.appendChild(chip);
            }
            const bar = el("div", "bd-zoom");
            const mkBtn = (txt, label, fn) => {
                const btn = el("button", "linky");
                btn.type = "button";
                btn.textContent = txt;
                btn.setAttribute("aria-label", label);
                btn.addEventListener("click", fn);
                return btn;
            };
            const setZoom = (nz) => {
                zoom = Math.max(1, Math.min(8, nz));
                applyZoom();
                const sc = fig?.querySelector(".bd-scroll");
                if (sc) {
                    sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
                    sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
                }
            };
            bar.append(mkBtn("−", "zoom out", () => setZoom(zoom / 1.5)), mkBtn("+", "zoom in", () => setZoom(zoom * 1.5)), mkBtn("⤢", "fit to garden", () => { setZoom(1); clearHot(); selIdx = null; dressMarks(); panel.replaceChildren(hint); }));
            const species = [...new Set(allIdx.map(([q]) => q.species))];
            for (const sp of species) {
                const items = allIdx.filter(([q]) => q.species === sp);
                const ended = items.filter(([q]) => !!q.end_cause).length;
                const chip = el("button", "bd-chip");
                chip.type = "button";
                chip.dataset.species = sp;
                const sw = el("span", "sw");
                const rec = bundle.species.find((x) => x.id === sp);
                if (typeof rec?.image?.artist === "string") {
                    const im = el("img");
                    im.dataset.spotPhoto = sp;
                    im.src = `img/thumbs/${encodeURIComponent(sp)}.webp`;
                    im.alt = "";
                    im.width = 192;
                    im.height = 192;
                    im.loading = "lazy";
                    im.decoding = "async";
                    sw.classList.add("haspic");
                    sw.appendChild(im);
                }
                const nm = el("span", "nm");
                nm.textContent = `${commonName(bundle, sp)} ×${items.length}`;
                const meta = el("span", "pmeta");
                meta.textContent = ended ? ` · ${ended} ended` : "";
                chip.append(sw, nm, meta);
                chip.addEventListener("click", () => {
                    const wasHot = chip.classList.contains("hot");
                    clearHot();
                    selIdx = null;
                    if (wasHot) {
                        dressMarks();
                        panel.replaceChildren(hint);
                    }
                    else {
                        chip.classList.add("hot");
                        hotSpecies = sp;
                        dressMarks();
                        speciesPanel(panel, sp, allIdx);
                    }
                });
                legend.appendChild(chip);
            }
            draw();
            sec.append(figWrap, chips, bar, legend, panel);
            host.appendChild(sec);
            if (reselect) {
                const idx = reselect.idx;
                reselect = null;
                selectPlant(idx);
            }
            if (openSpecies) {
                legend.querySelector(`.bd-chip[data-species="${openSpecies.species}"]`)?.click();
                openSpecies = null;
            }
        }
        const cards = el("div", "cards");
        if (!beds.length) {
            const hint = el("p", "hint");
            hint.textContent = "No beds yet - trace or size one on the Plan tab.";
            cards.appendChild(hint);
        }
        for (const b of beds) {
            const isContainer = bedHasSections(b.name, beds);
            const sectionNames = isContainer ? beds.filter((x) => sectionParentOf(x, beds) === b.name).map((x) => x.name) : [];
            const st = bedSeasonStatus(b.region, season);
            const stateAttr = isContainer ? "dormant"
                : st.closed || (!st.growing && (st.ended || st.carried)) ? "dormant"
                    : st.growing && (st.ended || st.carried) ? "mixed" : st.growing ? "growing" : "ready";
            const card = el("article", "card");
            card.dataset.state = stateAttr;
            card.dataset.bed = b.name;
            const ch = el("button", "card-head");
            ch.type = "button";
            const title = el("span", "card-title");
            title.textContent = isContainer ? `${b.name} (sections)` : b.name;
            const dim = el("span", "card-dim");
            dim.textContent = bedShapeLabel(b);
            const status = el("span", "card-status");
            const stSpan = (cls, text) => { const s = el("span", cls); s.textContent = text; return s; };
            const stParts = [];
            if (isContainer) {
                stParts.push(stSpan("st-end", `divided into ${sectionNames.length} section${sectionNames.length === 1 ? "" : "s"}`));
            }
            else {
                if (st.growing)
                    stParts.push(stSpan("st-grow", `${st.growing} growing`));
                if (st.carried)
                    stParts.push(stSpan("st-over", `${st.carried} overwintering`));
                if (st.ended)
                    stParts.push(stSpan("st-end", `${st.ended} ended`));
                const hasDraft = (Array.isArray(season.plan) ? season.plan : []).some((e) => e.area === b.name
                    && (!!e.guild || e.mybed === true));
                if (!stParts.length)
                    stParts.push(stSpan("st-end", hasDraft ? "ready to plant" : "nothing planted yet"));
            }
            stParts.forEach((s, i) => { if (i)
                status.appendChild(document.createTextNode(" · ")); status.appendChild(s); });
            const caret = el("span", "card-caret");
            caret.textContent = "▸";
            caret.setAttribute("aria-hidden", "true");
            ch.append(title, dim, status, caret);
            const wasOpen = openCards.has(b.name);
            ch.setAttribute("aria-expanded", wasOpen ? "true" : "false");
            ch.addEventListener("click", () => {
                const open = card.classList.toggle("open");
                ch.setAttribute("aria-expanded", open ? "true" : "false");
                if (open)
                    openCards.add(b.name);
                else
                    openCards.delete(b.name);
            });
            card.appendChild(ch);
            if (wasOpen)
                card.classList.add("open");
            if (isContainer) {
                const detail = el("div", "card-detail");
                const p = el("p", "pmeta");
                p.textContent = sectionNames.length
                    ? `This bed is divided into sections - each is configured on its own card below: ${sectionNames.join(", ")}. Edit the whole bed's outline in “Beds”.`
                    : "This bed is divided into sections - each is configured on its own card below.";
                detail.appendChild(p);
                card.appendChild(detail);
                cards.appendChild(card);
                continue;
            }
            const onBedIdx = (season.plantings ?? []).map((p, i) => [p, i]).filter(([p]) => plantingOnBed(p.region, b.region));
            const draftEntry = (Array.isArray(season.plan) ? season.plan : [])
                .find((e) => e.area === b.name);
            const draftGuild = !onBedIdx.length && draftEntry?.guild ? bundle.guilds.find((g) => g.id === draftEntry.guild) : undefined;
            const myBedDraft = !onBedIdx.length && !draftGuild && draftEntry?.mybed === true && Array.isArray(draftEntry.plantings)
                ? draftEntry.plantings : null;
            const isDraft = !!draftGuild || !!myBedDraft;
            const bedDrafts = isDraft ? openDrafts.filter((dp) => plantingOnBed(dp.region, b.region)) : [];
            const prev = el("div", "preview");
            const groups = new Map();
            for (const [p] of onBedIdx)
                groups.set(p.species, (groups.get(p.species) ?? 0) + 1);
            for (const p of bedDrafts)
                groups.set(p.species, (groups.get(p.species) ?? 0) + 1);
            if (isDraft) {
                const d = el("span", "chip empty");
                d.textContent = draftGuild ? `draft: ${displayName(draftGuild)}` : "draft: your own design";
                prev.appendChild(d);
            }
            else if (!groups.size) {
                const chip = el("span", "chip empty");
                chip.textContent = "nothing planted yet";
                prev.appendChild(chip);
            }
            [...groups].forEach(([sp, n], i) => {
                const chip = el("span", "chip");
                const dot = el("span", "dot");
                dot.style.background = PLANT_DOTS[i % PLANT_DOTS.length];
                chip.append(dot, plantLink(commonName(bundle, sp), sp));
                if (n > 1)
                    chip.append(document.createTextNode(` ×${n}`));
                prev.appendChild(chip);
            });
            card.appendChild(prev);
            const detail = el("div", "card-detail");
            const h4 = el("h4");
            h4.textContent = readOnly ? `What grew here in ${season.id}` : "What's growing";
            detail.appendChild(h4);
            if (!onBedIdx.length) {
                const p = el("p", "pmeta");
                p.textContent = draftGuild
                    ? `Draft - ${displayName(draftGuild)} is planned here but not yet in the ground. Mark it planted below when you sow or transplant.`
                    : myBedDraft
                        ? "Draft - your own design is planned here but not yet in the ground. Mark it planted below when you sow or transplant."
                        : "This bed is empty - configure its plants on the Plan tab.";
                detail.appendChild(p);
            }
            const detGroups = new Map();
            for (const [p] of onBedIdx) {
                const k = `${p.species}|${p.cultivar_group ?? ""}`;
                let g = detGroups.get(k);
                if (!g) {
                    g = { species: p.species, group: p.cultivar_group ?? null, n: 0, grow: 0, ended: 0, carried: 0, fails: new Map() };
                    detGroups.set(k, g);
                }
                g.n++;
                if (p.end_cause)
                    g.ended++;
                else if (p.carried_over)
                    g.carried++;
                else
                    g.grow++;
                for (const d of new Set((p.failures ?? []).map((f) => `${humanize(f.mode).toLowerCase()} (${f.severity})`))) {
                    g.fails.set(d, (g.fails.get(d) ?? 0) + 1);
                }
            }
            for (const g of detGroups.values()) {
                const row = el("div", "prow");
                const info = el("span");
                const nm = plantLink(plantingLabel(bundle, g.species, g.group), g.species, g.group);
                const bits = [];
                if (g.group)
                    bits.push(g.group);
                const meta = el("span", "pmeta");
                meta.textContent = (g.n > 1 ? ` ×${g.n}` : "") + (bits.length ? ` · ${bits.join(" · ")}` : "");
                info.append(nm, meta);
                const pill = el("span", "stpill");
                const parts = [];
                if (g.grow)
                    parts.push(`${g.grow} growing`);
                if (g.carried)
                    parts.push(`${g.carried} overwinters`);
                if (g.ended)
                    parts.push(`${g.ended} ended`);
                if (g.ended && !g.grow && !g.carried)
                    pill.classList.add("end");
                else if (g.carried && !g.grow && !g.ended)
                    pill.classList.add("over");
                else
                    pill.classList.add("grow");
                pill.textContent = g.n === 1
                    ? (g.ended ? "ended" : g.carried ? "overwinters" : "growing")
                    : parts.join(" · ");
                row.append(info, pill);
                detail.appendChild(row);
                if (g.fails.size) {
                    const nIssues = [...g.fails.values()].reduce((a, c) => a + c, 0);
                    const d = el("details", "issues");
                    const sum = document.createElement("summary");
                    sum.textContent = `${nIssues} issue${nIssues === 1 ? "" : "s"}`;
                    d.appendChild(sum);
                    const ul = el("ul", "issuelist");
                    for (const [desc, c] of [...g.fails].sort((a, b) => b[1] - a[1])) {
                        const li = document.createElement("li");
                        li.textContent = `${c}× ${desc}`;
                        ul.appendChild(li);
                    }
                    d.appendChild(ul);
                    detail.appendChild(d);
                }
            }
            if (!readOnly && (draftGuild || myBedDraft)) {
                const stateRow = el("div", "bedstate");
                const badge = el("span", "plantedbadge");
                badge.textContent = "Draft";
                const mark = el("button", "link");
                mark.type = "button";
                mark.textContent = "Mark as planted";
                mark.title = "Write this plan into the ground as of today. You can adjust each plant's date afterwards.";
                const note = el("span", "pmeta");
                note.textContent = " · planned, not yet in the ground";
                stateRow.append(badge, mark, note);
                detail.appendChild(stateRow);
                const callout = el("p", "pmeta cfg");
                callout.style.display = "none";
                detail.appendChild(callout);
                const site = { lat: plot?.anchor?.lat ?? null, lon: plot?.anchor?.lon ?? null, season_year: season.id };
                let armed = false;
                const plant = async (advancing) => {
                    mark.disabled = true;
                    const res = advancing
                        ? await markBedPlantedAdvancingSeason(b.name, bundle, site)
                        : await markBedPlanted(b.name, bundle, site);
                    if (res.ok) {
                        if (advancing && "seasonId" in res && typeof res.seasonId === "number")
                            setSeasonId(res.seasonId);
                        sang(plantedLine(season.id, res.planted, b.name));
                        await refresh();
                    }
                    else {
                        mark.disabled = false;
                        msg(res.reason, true);
                    }
                };
                mark.addEventListener("click", () => void (async () => {
                    const now = new Date();
                    if (now.getFullYear() !== season.id) {
                        const yr = now.getFullYear();
                        callout.replaceChildren(document.createTextNode(`You’re planting in ${yr}, but the open season is ${season.id}. Starting the ${yr} season keeps this planting's dates in the right year. `));
                        const adv = el("button", "link");
                        adv.type = "button";
                        adv.textContent = `Start ${yr} season & plant here`;
                        adv.addEventListener("click", () => void plant(true));
                        callout.appendChild(adv);
                        callout.style.display = "";
                        return;
                    }
                    if (draftGuild && !armed) {
                        const csite = plot?.anchor ? resolveClimate(plot.anchor.lat, plot.anchor.lon, bundle)?.site ?? null : null;
                        const nudge = offSeasonNudge(draftGuild, bundle, csite?.last_frost_32f?.p50 ?? null, csite?.first_freeze_32f_p50 ?? null, now.toISOString().slice(0, 10));
                        if (nudge) {
                            armed = true;
                            callout.replaceChildren();
                            linkNamesIn(callout, `${nudge.text} Tap “Mark as planted” again to plant anyway.`, nudge.marks);
                            callout.style.display = "";
                            return;
                        }
                    }
                    await plant(false);
                })());
            }
            else if (!readOnly && onBedIdx.length) {
                const stateRow = el("div", "bedstate");
                const badge = el("span", "plantedbadge on");
                badge.textContent = "Planted";
                const note = el("span", "pmeta");
                note.textContent = " · in the ground - tap a plant above to note, end, or replace it";
                stateRow.append(badge, note);
                detail.appendChild(stateRow);
                const cfg = el("p", "pmeta cfg");
                cfg.textContent = "Set this bed's plants in the “Design it yourself” tab of This bed on the Plan tab - “Edit / plan this bed →” below.";
                detail.appendChild(cfg);
            }
            const acts = el("div", "card-actions");
            const planBtn = el("button", "link");
            planBtn.type = "button";
            planBtn.textContent = readOnly ? "Plan this bed →" : "Edit / plan this bed →";
            planBtn.addEventListener("click", () => {
                const cand = $("candbed");
                if ([...cand.options].some((o) => o.value === b.name)) {
                    cand.value = b.name;
                    cand.dispatchEvent(new Event("change"));
                }
                location.hash = "#/plan";
            });
            acts.appendChild(planBtn);
            if (!readOnly)
                acts.appendChild(mkRename("Rename bed", b.name, (v) => renameBed(db, app.currentPlotId, b.name, v)));
            if (!readOnly && st.growing > 0) {
                const cb = el("button", "link");
                cb.type = "button";
                cb.textContent = "Close bed";
                cb.addEventListener("click", () => { if (causeSel && dateInp)
                    void closeBed(season, b, causeSel.value, dateInp.value); });
                acts.appendChild(cb);
            }
            detail.appendChild(acts);
            card.appendChild(detail);
            cards.appendChild(card);
        }
        host.appendChild(cards);
        const orphans = (season.plantings ?? []).map((p, i) => [p, i])
            .filter(([p]) => !beds.some((b) => plantingOnBed(p.region, b.region)));
        if (orphans.length) {
            const box = el("div", "orphans");
            const h = el("h4");
            h.textContent = "Not in a bed";
            box.appendChild(h);
            for (const [p, idx] of orphans) {
                const row = el("div", "prow");
                const nm = plantLink(plantingLabel(bundle, p.species, p.cultivar_group ?? null), p.species, p.cultivar_group ?? null);
                const meta = el("span", "pmeta");
                meta.textContent = ` · ${regionLabel(p.region)}`;
                const info = el("span");
                info.append(nm, meta);
                row.appendChild(info);
                if (!readOnly) {
                    const rm = el("button", "linky");
                    rm.type = "button";
                    rm.textContent = "remove";
                    rm.addEventListener("click", () => void doRemove(idx, p.species));
                    row.appendChild(rm);
                }
                box.appendChild(row);
            }
            host.appendChild(box);
        }
        if (!readOnly) {
            const addBed = el("button", "linky addbed");
            addBed.type = "button";
            addBed.textContent = "+ Add a bed on the map";
            addBed.addEventListener("click", () => { location.hash = "#/plan"; });
            host.appendChild(addBed);
        }
        if (!readOnly && beds.length && season.id <= new Date().getFullYear()) {
            const ns = el("button", "primary lognextseason");
            ns.type = "button";
            ns.textContent = `Plan next season (${season.id + 1}) ›`;
            ns.addEventListener("click", () => { openNextSeason(); go("plan", "nextseason"); });
            host.appendChild(ns);
        }
        const foot = el("div", "season-foot");
        if (closed) {
            const t = el("span", "hint");
            t.textContent = `Season ${season.id} closed ${season.closed_date} - the beds are dormant, and what grew here is memory for next year.`;
            const next = el("button", "primary");
            next.type = "button";
            next.textContent = `Start next season (${season.id + 1})`;
            next.addEventListener("click", () => void reactivateNextSeason(season));
            const rev = el("button", "link seasonreview");
            rev.type = "button";
            rev.textContent = "Season in review →";
            rev.addEventListener("click", () => { location.hash = "#/review"; });
            const re = el("button", "link");
            re.type = "button";
            re.textContent = "Reopen season";
            re.addEventListener("click", () => void reopenSeason(season));
            foot.append(t, next, rev, re);
        }
        else {
            const anchor = plot?.anchor;
            const site = anchor ? resolveClimate(anchor.lat, anchor.lon, bundle)?.site ?? null : null;
            const fcal = site ? frostCalibration(seasons, site) : null;
            const freezeMmdd = fcal?.fall.calibrated ? fcal.fall.calibrated_date : (site?.first_freeze_32f_p50 ?? null);
            const liveNow = (season.plantings ?? []).some((p) => !p.end_cause);
            if (liveNow && firstFreezePassed(season.id, freezeMmdd, today)) {
                const nudge = el("p", "closenudge");
                const observed = !!fcal?.fall.calibrated;
                nudge.textContent = `Your first fall freeze (${fmtMD(freezeMmdd)}${observed ? ", your ground's observed date" : ""}) has passed. Time to close the season - the beds go dormant and this year becomes memory for next. Perennials carry over.`;
                foot.appendChild(nudge);
            }
            if (closeCtrl)
                foot.appendChild(closeCtrl);
            const roll = el("button", "primary");
            roll.type = "button";
            roll.textContent = `Close the season (${season.id})`;
            const note = el("span", "hint");
            note.textContent = " - ends every still-active bed and rolls the year; perennials carry over.";
            roll.addEventListener("click", () => {
                foot.innerHTML = "";
                const q = el("span", "why");
                q.textContent = `Close season ${season.id}? This ends every still-active bed and rolls the year - perennials carry over. `;
                const yes = el("button", "primary");
                yes.type = "button";
                yes.textContent = "Yes, close it";
                yes.addEventListener("click", () => { if (causeSel && dateInp)
                    void rollSeason(season, causeSel.value, dateInp.value); });
                const no = el("button", "link");
                no.type = "button";
                no.textContent = "Cancel";
                no.addEventListener("click", () => void refresh());
                foot.append(q, yes, no);
            });
            foot.append(roll, note);
        }
        host.appendChild(foot);
    };
    const closeBed = async (season, bed, cause, date) => {
        try {
            await putSeason(db, closedBed(season, (p) => plantingOnBed(p.region, bed.region), (p) => resolvePlanting(p, cause, date)));
            said(`Closed “${bed.name}” - annuals ended, perennials carried over`);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const rollSeason = async (season, cause, date) => {
        try {
            await putSeason(db, rolledSeason(season, (p) => resolvePlanting(p, cause, date), date));
            said(`Season ${season.id} closed - the beds are dormant; next year plans from what grew here`);
            const petals = document.createElement("div");
            petals.className = "confetti";
            petals.setAttribute("aria-hidden", "true");
            const hues = ["#4a9d5f", "#e8a33d", "#d97ba4", "#7fb069", "#c4574e"];
            for (let i = 0; i < 14; i++) {
                const petal = document.createElement("i");
                petal.style.setProperty("--x", `${(i * 71) % 100}%`);
                petal.style.setProperty("--d", `${(1.1 + (i % 5) * 0.22).toFixed(2)}s`);
                petal.style.background = hues[i % hues.length];
                petals.appendChild(petal);
            }
            document.body.appendChild(petals);
            setTimeout(() => petals.remove(), 3000);
            buzz([30, 40, 30]);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const reopenSeason = async (season) => {
        try {
            await putSeason(db, reopenedSeason(season));
            said(`Season ${season.id} reopened - it's active again`);
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const reactivateNextSeason = async (season) => {
        try {
            const nextId = season.id + 1;
            const existing = await getSeason(db, app.currentPlotId, nextId);
            const { season: next, carried } = nextSeasonFrom(season, existing ?? null, app.currentPlotId);
            await putSeason(db, next);
            setSeasonId(nextId);
            viewedYear = nextId;
            if (carried) {
                msg(`Season ${nextId} started - ${carried} plant${carried === 1 ? "" : "s"} carried over from ${season.id}. Plan the rest of each bed around ${carried === 1 ? "it" : "them"}.`);
            }
            else {
                sang(`Season ${nextId} started - a fresh year on this ground`);
            }
            await refresh();
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
    };
    const photoUrlCache = new Map();
    const photoInto = (img, seasonId, name) => {
        const key = `${app.currentPlotId}:${seasonId}:${name}`;
        const hit = photoUrlCache.get(key);
        if (hit) {
            img.src = hit;
            return;
        }
        void getPhoto(db, app.currentPlotId, seasonId, name).then((b) => {
            if (!b)
                return;
            const url = URL.createObjectURL(b);
            photoUrlCache.set(key, url);
            img.src = url;
        });
    };
    const recollectionText = (r) => recollectionLine(r, r.species ? commonName(bundle, r.species) : "");
    const renderOnThisWeek = (seasons) => {
        const host = document.getElementById("onthisday");
        if (!host)
            return;
        host.textContent = "";
        const recs = aYearAgoThisWeek(seasons, new Date().toISOString().slice(0, 10));
        if (!recs.length) {
            host.hidden = true;
            return;
        }
        const h = el("h2", "onthisday-h");
        h.textContent = recs.every((r) => r.yearsAgo === 1) ? "A year ago this week" : "This week, in seasons past";
        host.appendChild(h);
        const ul = el("ul", "onthisday-list");
        for (const r of recs.slice(0, 6)) {
            const li = el("li", "onthisday-item");
            li.textContent = recollectionText(r);
            ul.appendChild(li);
        }
        host.appendChild(ul);
        host.hidden = false;
    };
    const renderTimeline = (seasons, beds) => {
        const host = document.getElementById("logtimeline");
        if (!host)
            return;
        host.textContent = "";
        const season = seasons.find((s) => s.id === viewedYear) ?? seasons[seasons.length - 1] ?? null;
        if (!season)
            return;
        const entries = [];
        const bedFor = (p) => {
            const cands = beds.filter((b) => plantingOnBed(p.region, b.region));
            return (cands.find((b) => !bedHasSections(b.name, beds)) ?? cands[0])?.name ?? null;
        };
        for (const p of season.plantings ?? []) {
            const name = plantingLabel(bundle, p.species, p.cultivar_group ?? null);
            const low = name.toLowerCase();
            const bed = bedFor(p);
            if (p.sown)
                entries.push({ date: p.sown, kind: "sow", dk: "sowed", text: name, bed, species: p.species, label: name });
            if (p.transplanted)
                entries.push({ date: p.transplanted, kind: "plant", dk: "transplanted", text: name, bed, species: p.species, label: name });
            if (p.first_harvest)
                entries.push({ date: p.first_harvest, kind: "harvest", dk: "first_harvest", text: low, bed, species: p.species, label: low });
            if (p.last_harvest && p.last_harvest !== p.first_harvest)
                entries.push({ date: p.last_harvest, kind: "harvest", dk: "last_harvest", text: low, bed, species: p.species, label: low });
            if (p.end_date && p.end_cause)
                entries.push({ date: p.end_date, kind: "ended", dk: "ended", text: name, bed, species: p.species, label: name, detail: humanize(p.end_cause).toLowerCase() });
            for (const f of p.failures ?? [])
                entries.push({ date: f.date, kind: "problem", dk: "note", text: `${name}: ${f.mode}`, bed, species: p.species, label: name });
            for (const n of p.notes ?? [])
                entries.push({ date: n.date, kind: "note", dk: "note", text: `${name}: ${n.text}`, bed, species: p.species, label: name, photo: n.photo });
        }
        for (const o of season.observations ?? []) {
            const base = o.event === "frost" ? "A frost" : o.event === "heat" ? "A hot spell" : humanize(o.event);
            const extra = o.note || o.damage || "";
            entries.push({ date: o.date, kind: "weather", dk: "weather", text: extra ? `${base} — ${extra}` : `${base}.`, bed: null, species: null, label: "" });
        }
        if (!entries.length)
            return;
        entries.sort((a, b) => b.date.localeCompare(a.date));
        const groups = new Map();
        for (const e of entries) {
            const key = `${e.date}|${e.kind}|${e.dk}|${e.detail ?? ""}|${e.bed ?? ""}`;
            const g = groups.get(key);
            if (g)
                g.parts.push(e);
            else
                groups.set(key, { ...e, parts: [e] });
        }
        const tally = (parts, host) => {
            const counts = new Map();
            for (const e of parts) {
                const c = counts.get(e.text);
                if (c)
                    c.n++;
                else
                    counts.set(e.text, { n: 1, e });
            }
            let first = true;
            for (const [text, { n, e }] of counts) {
                if (!first)
                    host.appendChild(document.createTextNode(" + "));
                first = false;
                if (n > 1)
                    host.appendChild(document.createTextNode(`${n} × `));
                if (e.species)
                    linkNameIn(host, text, e.label, e.species);
                else
                    host.appendChild(document.createTextNode(text));
            }
        };
        const frameOf = (dk, detail, iso) => {
            const day = dayWord(iso);
            switch (dk) {
                case "sowed": return { pre: "", post: ` sown, ${day}.` };
                case "transplanted": return { pre: "", post: ` set out, ${day}.` };
                case "first_harvest": return { pre: "First ", post: ` out of the ground - ${day}.` };
                case "last_harvest": return { pre: "The last ", post: ` picked, ${day}.` };
                case "ended": return { pre: "", post: ` ended${detail ? ` (${detail})` : ""}, ${day}.` };
                default: return null;
            }
        };
        const rows = [...groups.values()];
        const CAP = 12;
        const wrap = el("div", "tl");
        const render = (list, into) => {
            for (const e of list) {
                const row = el("div", `tl-e tl-${e.kind}`);
                if (justLogged && e.parts.some((q) => q.date === justLogged.date && q.kind === justLogged.kind)) {
                    row.classList.add("tl-new");
                    justLogged = null;
                }
                row.appendChild(el("span", "tl-dot"));
                const k = el("span", "tl-k");
                k.textContent = dayWord(e.date);
                row.appendChild(k);
                const s = el("p", "tl-s");
                const frame = frameOf(e.dk, e.detail, e.date);
                if (frame) {
                    if (frame.pre)
                        s.appendChild(document.createTextNode(frame.pre));
                    tally(e.parts, s);
                    s.appendChild(document.createTextNode(frame.post));
                }
                else {
                    tally(e.parts, s);
                }
                row.appendChild(s);
                const withPhotos = e.parts.filter((q) => q.photo);
                if (withPhotos.length) {
                    const strip = el("div", "photostrip");
                    for (const q of withPhotos) {
                        const img = document.createElement("img");
                        img.className = "photothumb";
                        img.loading = "lazy";
                        img.alt = `photo · ${q.text}`;
                        img.addEventListener("click", () => img.classList.toggle("photobig"));
                        photoInto(img, season.id, q.photo);
                        strip.appendChild(img);
                    }
                    row.appendChild(strip);
                }
                const tag = el("span", e.bed ? "tl-bed" : "tl-bed whole");
                tag.textContent = e.bed ?? "whole garden";
                row.appendChild(tag);
                into.appendChild(row);
            }
        };
        render(rows.slice(0, CAP), wrap);
        if (rows.length > CAP) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "tl-more";
            more.textContent = `show ${rows.length - CAP} earlier ↓`;
            more.addEventListener("click", () => { more.remove(); render(rows.slice(CAP), wrap); }, { once: true });
            wrap.appendChild(more);
        }
        host.appendChild(wrap);
    };
    const refresh = async () => {
        {
            const cur = await getPlot(db, app.currentPlotId);
            if (!cur || !plotVisible(cur)) {
                const vis = (await listPlots(db)).filter((p) => !p.example);
                const target = vis[0]?.id ?? defaultWorkspacePlotId();
                if (target !== app.currentPlotId) {
                    setCurrentPlot(target);
                    app.refreshAuthGate?.();
                }
            }
        }
        const seasons = (await listSeasons(db, app.currentPlotId)).sort((a, b) => a.id - b.id);
        const chosen = seasonId();
        fillSelect("logseason", seasons.map((s) => String(s.id)));
        setSeasonId(resolveSeasonId(seasons, chosen));
        seasonSel.value = seasonId() == null ? "" : String(seasonId());
        const plot = await getPlot(db, app.currentPlotId);
        if (plot?.anchor && num("lat") == null && num("lon") == null) {
            ($("lat")).value = String(Math.round(plot.anchor.lat * 1e5) / 1e5);
            ($("lon")).value = String(Math.round(plot.anchor.lon * 1e5) / 1e5);
        }
        const beds = plot?.beds ?? [];
        coachBand($("coach-log"), COACH_HEADING, COACH_LOG, seasons.length === 0 && beds.length === 0);
        const allPlots = await listPlots(db);
        renderLocations(seasons, beds, plot, allPlots);
        renderOnThisWeek(seasons);
        renderTimeline(seasons, beds);
        await renderSeedBox(db, bundle);
        const viewedSeason = seasons.find((s) => s.id === seasonId());
        await renderShoppingList(db, bundle, viewedSeason?.plantings ?? []);
        renderGardensClimate(allPlots);
        renderActiveGarden(plot, allPlots.length);
        await renderFeed(plot);
        await renderRestore();
        const wLegend = document.querySelector("#sec-weather legend");
        if (wLegend)
            wLegend.textContent = plot?.name ? `${plot.name}’s weather` : "This ground’s weather";
        app.logSnapshot = { seasons, beds, seasonId: currentSeasonId(), priorOccupancy: plot?.prior_occupancy ?? [] };
        app.currentPlot = plot ? { address: plot.address, anchor: plot.anchor, name: plot.name } : null;
        countGardenActive(plot);
        const cand = $("candbed");
        const candChosen = cand.value;
        const plannable = beds.filter((b) => !bedHasSections(b.name, beds));
        fillSelect("candbed", plannable.map((b) => b.name), (v) => v);
        {
            const gr = $("obsground");
            const keep = gr.value;
            gr.innerHTML = "";
            for (const [value, label] of [["", "the whole garden"],
                ...beds.map((b) => [b.name, b.name])]) {
                const o = document.createElement("option");
                o.value = value;
                o.textContent = label;
                gr.appendChild(o);
            }
            if ([...gr.options].some((o) => o.value === keep))
                gr.value = keep;
        }
        if (plannable.some((b) => b.name === candChosen))
            cand.value = candChosen;
        else if (plannable.length)
            cand.value = plannable[0].name;
        if (app.refreshUserPlantsUI)
            await app.refreshUserPlantsUI();
        onLogChange();
    };
    const trouble = (text, door) => {
        const n = $("lognudge");
        n.textContent = text;
        n.classList.add("err");
        n.hidden = false;
        if (door) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "linklike";
            b.textContent = door.label;
            b.addEventListener("click", door.go);
            n.append(" ", b);
        }
    };
    const clearTrouble = () => {
        const n = $("lognudge");
        if (n.classList.contains("err")) {
            n.classList.remove("err");
            n.textContent = "";
            n.hidden = true;
        }
    };
    const act = (id, fn) => {
        $(id).addEventListener("click", () => {
            clearTrouble();
            fn().then((note) => {
                said(note);
                return refresh();
            }).catch((e) => {
                const text = String(e instanceof Error ? e.message : e);
                msg(text, true);
                const door = e.door === "season"
                    ? { label: "Take me there ›", go: () => { const b = document.getElementById("seasonstart"); b?.scrollIntoView({ block: "center" }); b?.focus(); } }
                    : undefined;
                trouble(text, door);
            });
        });
    };
    act("feedpost", async () => {
        if (!isSignedIn())
            throw new Error("sign in to post to the team");
        const input = $("feedbody");
        const body = input.value.trim();
        if (!body)
            throw new Error("write something first");
        await putPost(db, { plot: app.currentPlotId, id: mintPostId(), author: signedInEmail() ?? "", at: new Date().toISOString(), body });
        input.value = "";
        return "posted to the team.";
    });
    act("obsadd", async () => {
        const rawEvent = ($("obsevent")).value;
        if (rawEvent.startsWith("soil_")) {
            const date = ($("obsdate")).value;
            const groundName = ($("obsground")).value;
            const bed = app.logSnapshot.beds.find((b) => b.name === groundName) ?? null;
            const rec = { plot: app.currentPlotId, date, source: "declared" };
            if (rawEvent === "soil_waterlogged")
                rec.drainage = "waterlogged";
            else
                rec.amendment = rawEvent.slice("soil_".length);
            if (bed?.region)
                rec.region = bed.region;
            const note = ($("obsnote")).value.trim();
            if (note)
                rec.notes = note;
            await putSoilObservation(db, rec);
            await app.soilRefresh?.();
            onLogChange();
            return rawEvent === "soil_waterlogged"
                ? `noted - standing water on ${groundName || "the whole garden"} feeds the waterlogging rule.`
                : `noted - a pH reading from before this no longer describes ${groundName || "the whole garden"}.`;
        }
        const event = rawEvent;
        const note = ($("obsnote")).value.trim();
        if (event === "note" && !note)
            throw new Error("Write a line about what happened in the garden, then log it.");
        const obs = { date: ($("obsdate")).value, event };
        if (event === "frost")
            obs.severity = ($("obssev")).value;
        if (note)
            obs.note = note;
        const season = /^\d{4}-\d\d-\d\d/.test(obs.date) ? Number(obs.date.slice(0, 4)) : new Date().getFullYear();
        viewedYear = season;
        if (!(await getSeason(db, app.currentPlotId, season))) {
            await putSeason(db, { id: season, plot: app.currentPlotId, plantings: [], observations: [] });
            await refresh();
        }
        await addObservation(db, app.currentPlotId, season, obs);
        justLogged = { date: obs.date, kind: "weather" };
        const nudge = $("lognudge");
        nudge.hidden = true;
        const standing = (seasons) => ledgerEarned(seasons, lastEarnedSite, app.soilObservations ?? [], app.currentPlotId)
            .find((r) => r.key === "frost");
        const before = standing(app.logSnapshot.seasons);
        const after = standing(app.logSnapshot.seasons.map((s) => s.id === season ? { ...s, observations: [...(s.observations ?? []), obs] } : s));
        const graduated = !!before && !!after && before.state !== "live" && after.state === "live";
        if (before && after && (after.state !== before.state || after.badge !== before.badge)) {
            nudge.textContent = graduated
                ? graduationLine()
                : `Frost logged - ${after.badge.toLowerCase()} seasons toward your own dates.`;
            nudge.hidden = false;
        }
        const label = ($("obsevent")).selectedOptions[0]?.textContent?.trim() || humanize(event);
        if (graduated)
            return graduationLine();
        return event === "frost" ? frostNotedLine(obs.date, { live: after?.state === "live" }) : event === "note" ? noteLoggedLine(obs.date) : weatherNotedLine(label, obs.date);
    });
    $("frostdemo").addEventListener("click", () => {
        const lat = num("lat"), lon = num("lon");
        if (lat == null || lon == null) {
            const text = "Set your location on the Plan page first - the demo seasons are seeded against your own frost dates.";
            msg(text, true);
            trouble(text, { label: "Set your location ›", go: () => go("plan", "step-where") });
            return;
        }
        app.syntheticOn = true;
        $("frostdemoclear").hidden = false;
        onLogChange();
        said("Loaded 4 synthetic demo seasons");
    });
    $("frostdemoclear").addEventListener("click", () => {
        app.syntheticOn = false;
        $("frostdemoclear").hidden = true;
        onLogChange();
        said("Cleared the synthetic demo seasons");
    });
    act("logexport", async () => {
        const season = currentSeasonId();
        if (season == null)
            throw Object.assign(new Error("Start this season first - the log's year begins with its Start season button, at the top of the page."), { door: "season" });
        const rec = (await listSeasons(db, app.currentPlotId)).find((s) => s.id === season);
        if (!rec)
            throw new Error(`no season ${season} in the log`);
        const text = emitSeason(rec);
        ($("logfile")).value = text;
        ($("logfilebox")).open = true;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "application/yaml" }));
        a.download = `season-${season}.yaml`;
        a.click();
        URL.revokeObjectURL(a.href);
        const named = (rec.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
            .filter((x) => !!x);
        if (!named.length)
            return `season ${season} exported - the file is what a git-backed log would commit.`;
        const entries = [];
        const missing = [];
        for (const name of named) {
            const blob = await getPhoto(db, app.currentPlotId, season, name);
            if (blob)
                entries.push({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
            else
                missing.push(name);
        }
        if (entries.length) {
            const z = document.createElement("a");
            z.href = URL.createObjectURL(buildStoreZip(entries));
            z.download = `season-${season}-photos.zip`;
            z.click();
            URL.revokeObjectURL(z.href);
        }
        return `season ${season} exported - the file is what a git-backed log would commit` +
            (entries.length ? `, with ${entries.length} photo${entries.length === 1 ? "" : "s"} zipped beside it` : "") +
            (missing.length ? `. ${missing.length} named photo${missing.length === 1 ? " is" : "s are"} not on this device and could not be exported` : "") + ".";
    });
    $("logimportfiles")?.addEventListener("change", () => void (async () => {
        const inp = $("logimportfiles");
        const files = Array.from(inp.files ?? []);
        if (!files.length)
            return;
        try {
            const yaml = files.find((f) => /\.ya?ml$/i.test(f.name));
            const zip = files.find((f) => /\.zip$/i.test(f.name));
            if (!yaml && !zip)
                throw new Error("choose the season .yaml (and, if you have one, its photos .zip)");
            let season = null;
            if (yaml) {
                const text = await yaml.text();
                ($("logfile")).value = text;
                season = parseSeasonFile(text);
                const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
                const replaced = existing && emitSeason(existing) !== text;
                await putSeason(db, season);
                setSeasonId(season.id);
                if (replaced)
                    msg(`season ${season.id} imported - REPLACED the stored season ${season.id}, which was different.`);
            }
            let restored = 0, skipped = 0;
            if (zip) {
                const target = season ?? (await listSeasons(db, app.currentPlotId)).find((s) => s.id === currentSeasonId()) ?? null;
                if (!target)
                    throw new Error("import the season file first (or alongside) - the zip restores only photos the season names");
                const namedSet = new Set((target.plantings ?? []).flatMap((p) => (p.notes ?? []).map((n) => n.photo))
                    .filter((x) => !!x));
                for (const entry of readStoreZip(await zip.arrayBuffer())) {
                    if (!namedSet.has(entry.name)) {
                        skipped++;
                        continue;
                    }
                    await putPhoto(db, target.plot, target.id, entry.name, new Blob([entry.bytes], { type: "image/jpeg" }));
                    restored++;
                }
            }
            await refresh();
            const parts = [
                season ? `season ${season.id} imported (${season.plantings?.length ?? 0} plantings, ${season.observations?.length ?? 0} observations)` : null,
                restored ? `${restored} photo${restored === 1 ? "" : "s"} restored` : null,
                skipped ? `${skipped} zip entr${skipped === 1 ? "y" : "ies"} skipped (the season does not name them)` : null,
            ].filter(Boolean);
            msg(parts.join("; ") + ".");
        }
        catch (e) {
            msg(String(e instanceof Error ? e.message : e), true);
        }
        finally {
            inp.value = "";
        }
    })());
    act("logimport", async () => {
        const text = ($("logfile")).value;
        if (!text.trim())
            throw new Error("paste a season file into the box first");
        const season = parseSeasonFile(text);
        const plotNote = season.plot !== app.currentPlotId
            ? ` NOTE: this file belongs to plot "${season.plot}", not the current address - it was stored there.`
            : "";
        const existing = (await listSeasons(db, season.plot)).find((s) => s.id === season.id);
        const replaced = existing && emitSeason(existing) !== text;
        await putSeason(db, season);
        setSeasonId(season.id);
        return `season ${season.id} imported (${season.plantings?.length ?? 0} plantings, ` +
            `${season.observations?.length ?? 0} observations)` +
            (replaced ? ` - REPLACED the stored season ${season.id}, which was different.` : ".") + plotNote;
    });
    seasonSel.addEventListener("change", () => {
        const picked = seasonSel.value;
        setSeasonId(picked === "" ? null : Number(picked));
        void refresh();
    });
    app.logRefresh = refresh;
    {
        const upFamilies = $("upfamilies");
        for (const f of familiesOf(bundle)) {
            const o = document.createElement("option");
            o.value = f;
            upFamilies.appendChild(o);
        }
        const setMsg = (span, text, err = false) => {
            span.textContent = text;
            span.className = err ? "hint err" : "hint";
        };
        const capLine = (rec) => {
            const cap = capabilities(rec);
            return cap.limits.length
                ? `plans it in, but: ${cap.limits.join("; ")}`
                : "plans, places, and schedules - full detail";
        };
        const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const uniqueId = (slug) => {
            const base = `user:${slug}`;
            if (!app.userSpecies.some((s) => s.id === base))
                return base;
            for (let n = 2;; n++)
                if (!app.userSpecies.some((s) => s.id === `${base}_${n}`))
                    return `${base}_${n}`;
        };
        const reloadPlants = async () => {
            app.userSpecies = await listUserSpecies(db);
            $("uplisthint").textContent = app.userSpecies.length ? "Edit or remove these under “My added plants” on the Log tab." : "";
            renderManagedPlants($("uplist"), false);
            const mp = document.getElementById("myplants");
            if (mp)
                renderManagedPlants(mp, true);
        };
        app.refreshUserPlantsUI = reloadPlants;
        const makeSaver = (form, existingId, msg, btnLabel, onSaved) => {
            let armed = false;
            return () => {
                const { name, traits } = form.read();
                if (!name) {
                    msg("give the plant a name.", true);
                    armed = false;
                    return;
                }
                const slug = slugify(name);
                if (!slug) {
                    msg("the name needs some letters or numbers.", true);
                    armed = false;
                    return;
                }
                const id = existingId ?? uniqueId(slug);
                const rec = { id, source: "user", common: name, ...traits };
                const errors = validateUserSpecies(rec);
                if (errors.length) {
                    msg(errors[0], true);
                    armed = false;
                    return;
                }
                const caps = capabilities(rec);
                if (caps.limits.length && !armed) {
                    armed = true;
                    msg(`Heads up - ${caps.limits.join("; ")}. Fill those in for full detail, or tap ${btnLabel} again to ${existingId ? "save" : "add"} anyway.`);
                    return;
                }
                putUserSpecies(db, rec)
                    .then(async () => { onSaved(rec); onLogChange(); await reloadPlants(); })
                    .catch((e) => msg(String(e instanceof Error ? e.message : e), true));
            };
        };
        function renderManagedPlants(container, editable) {
            if (editable && container.querySelector(".upedit"))
                return;
            container.innerHTML = "";
            if (!app.userSpecies.length) {
                const p = el("p", "hint");
                p.textContent = editable
                    ? "No added plants yet. Add one on the Plan tab under “Add your own plant”."
                    : "No added plants yet. Anything you add becomes loggable and shows up in what this ground can grow.";
                container.appendChild(p);
                return;
            }
            for (const rec of [...app.userSpecies].sort((a, b) => a.id.localeCompare(b.id))) {
                const row = el("div", "upitem");
                const fam = typeof rec.family === "string" ? ` · ${familyName(rec.family)}` : " · no family";
                const label = el("span");
                label.textContent = `${commonName(bundle, rec.id)}${fam} - ${capLine(rec)}`;
                row.appendChild(label);
                if (editable) {
                    const edit = el("button");
                    edit.type = "button";
                    edit.className = "link";
                    edit.textContent = "edit";
                    edit.addEventListener("click", () => toggleEditForm(container, row, rec));
                    const rm = el("button");
                    rm.type = "button";
                    rm.className = "link";
                    rm.textContent = "remove";
                    rm.addEventListener("click", () => void deleteUserSpecies(db, rec.id)
                        .then(async () => { await reloadPlants(); onLogChange(); })
                        .catch(() => { }));
                    row.append(edit, rm);
                }
                container.appendChild(row);
            }
        }
        function toggleEditForm(container, row, rec) {
            const open = row.nextElementSibling;
            if (open && open.classList.contains("upedit")) {
                open.remove();
                return;
            }
            container.querySelectorAll(".upedit").forEach((e) => e.remove());
            const box = el("div", "upedit");
            const form = plantEditorForm({ seed: rec });
            const msgEl = el("span", "hint");
            const save = el("button");
            save.type = "button";
            save.className = "primary";
            save.textContent = "Save";
            const cancel = el("button");
            cancel.type = "button";
            cancel.className = "link";
            cancel.textContent = "cancel";
            save.addEventListener("click", makeSaver(form, rec.id, (t, err) => setMsg(msgEl, t, err), "Save", () => box.remove()));
            cancel.addEventListener("click", () => { box.remove(); void reloadPlants(); });
            const actions = el("div", "uprow actions");
            actions.append(save, cancel, msgEl);
            box.append(form.root, actions);
            row.after(box);
        }
        const mountAddForm = () => {
            const host = $("upform-host");
            host.innerHTML = "";
            const form = plantEditorForm({});
            host.appendChild(form.root);
            const addMsg = (t, err = false) => setMsg($("upmsg"), t, err);
            ($("upadd")).onclick = makeSaver(form, undefined, addMsg, "Add plant", (rec) => {
                addMsg(`Added ${commonName(bundle, rec.id)}. Edit it any time under “My added plants” on the Log tab.`);
                mountAddForm();
            });
        };
        mountAddForm();
        void reloadPlants();
    }
    let mapRefit = null;
    const activatePlot = async (id) => {
        setCurrentPlot(id);
        const plot = await getPlot(db, id);
        if (plot?.anchor) {
            ($("lat")).value = String(Math.round(plot.anchor.lat * 1e5) / 1e5);
            ($("lon")).value = String(Math.round(plot.anchor.lon * 1e5) / 1e5);
            for (const cid of ["zip", "plus"]) {
                const ce = document.getElementById(cid);
                if (ce)
                    ce.value = "";
            }
        }
        mapRefit?.();
        await refresh();
        app.refreshAuthGate?.();
    };
    app.switchPlot = activatePlot;
    const draftIsReal = async (p) => (p.beds?.length ?? 0) > 0 || (await listSeasons(db, p.id)).length > 0;
    const discardDraft = async (p) => {
        for (const sn of await listSeasons(db, p.id))
            await deleteSeason(db, p.id, sn.id);
        for (const rec of (await listSoilObservations(db)).filter((r) => r.plot === p.id)) {
            await deleteSoilObservation(db, rec);
        }
        await deletePlot(db, p.id);
    };
    const adoptDraft = async (p) => {
        const base = plotIdFor(p.name ?? "home");
        return rekeyPlot(db, p.id, await freePlotId(db, base), { owner: "account" });
    };
    const pendingDrafts = async () => {
        const out = [];
        for (const p of await listPlots(db, "draft")) {
            if (await draftIsReal(p))
                out.push(p);
            else
                await discardDraft(p);
        }
        return out;
    };
    const renderDraftBanner = async () => {
        const box = document.getElementById("draftbanner");
        if (!box)
            return;
        const drafts = isSignedIn() ? await pendingDrafts() : [];
        box.hidden = drafts.length === 0;
        if (!drafts.length) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = "";
        const n = drafts.reduce((s, p) => s + (p.beds?.length ?? 0), 0);
        const what = drafts.length === 1
            ? `a garden drafted while signed out (${drafts[0].name ?? "unnamed"}, ${n} bed${n === 1 ? "" : "s"})`
            : `${drafts.length} gardens drafted while signed out`;
        const p = document.createElement("p");
        p.textContent = `This device holds ${what}. Add it to your account, or discard it? It stays put until you choose.`;
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add to my account";
        add.addEventListener("click", () => void (async () => {
            const adopted = [];
            for (const d of await pendingDrafts())
                adopted.push(await adoptDraft(d));
            box.hidden = true;
            if (adopted.length)
                await activatePlot(adopted[0].id);
        })());
        const discard = document.createElement("button");
        discard.type = "button";
        discard.textContent = "Discard draft";
        let armed = false;
        discard.addEventListener("click", () => void (async () => {
            if (!armed) {
                armed = true;
                discard.textContent = "tap again to discard - this cannot be undone";
                return;
            }
            for (const d of await pendingDrafts())
                await discardDraft(d);
            box.hidden = true;
            await refresh();
        })());
        const row = document.createElement("div");
        row.className = "logrow";
        row.append(add, discard);
        box.append(p, row);
    };
    app.refreshDraftBanner = () => void renderDraftBanner();
    app.startNextSeason = async () => {
        const closed = (app.logSnapshot.seasons ?? []).filter((s) => s.closed_date);
        if (!closed.length)
            return;
        const newest = closed.reduce((a, b) => (a.id >= b.id ? a : b));
        const full = await getSeason(db, app.currentPlotId, newest.id);
        if (full)
            await reactivateNextSeason(full);
    };
    app.onSignIn = async (opts) => {
        const accountPlots = await listPlots(db);
        if (!accountPlots.length) {
            if (opts?.adoptDrafts === false) {
                if ((await pendingDrafts()).length) {
                    await renderDraftBanner();
                    location.hash = "#/plan";
                    return;
                }
            }
            else {
                for (const d of await pendingDrafts())
                    await adoptDraft(d);
            }
        }
        let plots = await listPlots(db);
        void renderDraftBanner();
        if (!plots.length) {
            let ladder = {};
            try {
                ladder = JSON.parse(localStorage.getItem("gg-answers") ?? "{}");
            }
            catch { }
            if (typeof ladder.lat !== "number" || typeof ladder.lon !== "number")
                return;
            await setPlotAnchorOnce(db, defaultWorkspacePlotId(), ladder.lat, ladder.lon, ladder.zip ? `ZIP ${ladder.zip}` : undefined);
            plots = await listPlots(db);
            if (!plots.length)
                return;
        }
        app.markStarted?.();
        const defId = defaultPlotId();
        const pick = (defId ? plots.find((p) => p.id === defId) : null)
            ?? (plots.length === 1 ? plots[0] : plots.find((p) => p.id === app.currentPlotId))
            ?? plots[0];
        await activatePlot(pick.id);
        let returnBed = null;
        try {
            returnBed = JSON.parse(localStorage.getItem("gg-signin-return") ?? "null")?.bed ?? null;
        }
        catch {
            returnBed = null;
        }
        if (returnBed) {
            try {
                localStorage.removeItem("gg-signin-return");
            }
            catch { }
            app.closeAuthSheet?.();
            location.hash = "#/plan";
            const step = document.getElementById("sec-ground");
            if (step)
                step.open = true;
            const bed = returnBed;
            requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("gg-sheet-reveal", { detail: { bed } })));
            return;
        }
        if (hasGround()) {
            location.hash = "#/start";
            return;
        }
        location.hash = "#/plan";
        const ground = document.getElementById("sec-ground");
        if (ground)
            ground.open = true;
    };
    app.onSignOut = async () => {
        const drafts = (await listPlots(db)).filter((p) => !p.example);
        setCurrentPlot(drafts[0]?.id ?? defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        void renderDraftBanner();
        mapRefit?.();
        await refresh();
        app.refreshAuthGate?.();
    };
    app.showExample = async () => {
        await seedExampleGarden(db, new Date().getFullYear(), bundle);
        app.markStarted?.();
        await activatePlot(EXAMPLE_PLOT_ID);
        location.hash = "#/start";
    };
    app.removeExample = async (toLanding = false) => {
        await removeExampleGarden(db);
        const rest = (await listPlots(db)).filter((p) => !p.example);
        if (rest.length) {
            await activatePlot(rest[0].id);
            location.hash = "#/plan";
            return;
        }
        setCurrentPlot(defaultWorkspacePlotId());
        for (const id of ["lat", "lon", "zip", "addr", "plus"]) {
            const el = document.getElementById(id);
            if (el)
                el.value = "";
        }
        await refresh();
        app.refreshAuthGate?.();
        if (!toLanding) {
            location.hash = "#/plan";
            return;
        }
        app.clearStarted?.();
        location.hash = "#/start";
        window.scrollTo(0, 0);
    };
    initAccount(db, () => void refresh());
    app.logDb = db;
    const gm = initGroundMap(db, () => app.currentPlotId, () => {
        const lat = num("lat"), lon = num("lon");
        return lat != null && lon != null ? { lat, lon } : null;
    }, () => void refresh(), (id) => void activatePlot(id));
    app.groundRedraw = gm.redraw;
    app.groundCenterOn = gm.centerOn;
    app.groundRefit = gm.refit;
    app.groundRefitIfDrifted = gm.refitIfDrifted;
    app.groundProposeRect = gm.proposeRect;
    app.groundClearProposal = gm.clearProposal;
    app.groundKeepProposal = gm.keepProposal;
    app.groundEditProposal = gm.editProposal;
    app.groundProposalTaken = gm.proposalTakenNow;
    mapRefit = gm.refit;
    await refresh();
    void renderDraftBanner();
}
