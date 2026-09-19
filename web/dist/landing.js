import { copy } from "./copy.js";
import { commonName } from "./state.js";
import { confidenceBadge, guildPlacementGlimpse } from "./plan.js";
import { citationLine } from "./citation.js";
import { renderSeasonBand } from "./seasonband.js";
import { frostBand } from "./panels/frostrisk.js";
const LANDING_FROST_STATION = { key: "minneapolis", place: "an example cold-winter garden" };
function renderLandingFrost(bundle) {
    const host = document.getElementById("lgfrost");
    if (!host)
        return;
    const site = (bundle.climate?.sites ?? []).find((s) => s.key === LANDING_FROST_STATION.key);
    const band = site ? frostBand(site) : null;
    if (!band || !band.median || !band.safe)
        return;
    const { median, safe, rows } = band;
    host.innerHTML = "";
    const kicker = document.createElement("span");
    kicker.className = "lg-kicker";
    kicker.textContent = copy.landingFrostKicker;
    kicker.dataset.copyKey = "landingFrostKicker";
    host.appendChild(kicker);
    const h = document.createElement("h2");
    h.className = "lg-team";
    h.textContent = copy.landingFrostTitle;
    h.dataset.copyKey = "landingFrostTitle";
    host.appendChild(h);
    const src = document.createElement("p");
    src.className = "lg-frost-src";
    src.textContent = `${LANDING_FROST_STATION.place} · NOAA NCEI 1991-2020 normals`;
    host.appendChild(src);
    const scale = document.createElement("div");
    scale.className = "lg-frost-band";
    scale.setAttribute("role", "img");
    scale.setAttribute("aria-label", `Last spring frost odds for ${LANDING_FROST_STATION.place}: half of years have frosted by ${median.label}, one in ten as late as ${safe.label}.`);
    const ticks = document.createElement("ol");
    ticks.className = "lg-frost-ticks";
    const ordered = [...rows].reverse();
    ordered.forEach((r, i) => {
        const li = document.createElement("li");
        li.style.setProperty("--t", ordered.length > 1 ? String(i / (ordered.length - 1)) : "0");
        const d = document.createElement("span");
        d.className = "d";
        d.textContent = r.label;
        const p = document.createElement("span");
        p.className = "p";
        p.textContent = `${r.pct}%`;
        li.append(d, p);
        ticks.appendChild(li);
    });
    scale.appendChild(ticks);
    host.appendChild(scale);
    const why = document.createElement("p");
    why.className = "lg-why";
    const b1 = document.createElement("b");
    b1.textContent = median.label;
    const b2 = document.createElement("b");
    b2.textContent = safe.label;
    why.append("Half the years here have seen their last freeze by ", b1, "; one year in ten, a freeze still comes as late as ", b2, ". We don't hand you a planting date - we hand you the odds and let you choose the risk.");
    host.appendChild(why);
    const ev = document.createElement("a");
    ev.className = "lg-rec-ev";
    ev.href = "#/why?climate";
    ev.textContent = `${copy.landingFrostEvidence} →`;
    ev.dataset.copyKey = "landingFrostEvidence";
    host.appendChild(ev);
    host.hidden = false;
}
const LANDING_RULE_ID = "R-003";
function renderLandingProduct(bundle) {
    const host = document.getElementById("lgproduct");
    if (!host)
        return;
    const guild = (bundle.guilds ?? []).find((g) => g.id === "three_sisters");
    const rule = (bundle.rules ?? []).find((r) => r.id === LANDING_RULE_ID);
    const exampleBed = { name: "an example bed", region: { shape: "rect", x: 0, y: 0, w: 3.048, h: 3.048 } };
    const glimpse = guild ? guildPlacementGlimpse(guild, exampleBed, { lat: 40, lon: -88 }, bundle) : null;
    if (!glimpse && !rule?.mechanism) {
        host.hidden = true;
        return;
    }
    host.innerHTML = "";
    const h = document.createElement("h2");
    h.className = "lg-h2";
    h.textContent = copy.landingProductTitle;
    h.dataset.copyKey = "landingProductTitle";
    host.appendChild(h);
    const lead = document.createElement("p");
    lead.className = "lg-lead";
    lead.textContent = copy.landingProductLead;
    lead.dataset.copyKey = "landingProductLead";
    host.appendChild(lead);
    const row = document.createElement("div");
    row.className = "lg-glimpses";
    if (glimpse) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductPlaceKicker;
        k.dataset.copyKey = "landingProductPlaceKicker";
        const frame = document.createElement("div");
        frame.className = "lg-plan-frame";
        glimpse.svg.setAttribute("role", "img");
        glimpse.svg.setAttribute("aria-label", "A Three Sisters bed: corn and beans on nine mounds, squash in the gaps between them.");
        frame.appendChild(glimpse.svg);
        const legend = document.createElement("ul");
        legend.className = "lg-legend";
        for (const p of glimpse.plants) {
            const li = document.createElement("li");
            const dot = document.createElement("span");
            dot.className = "lg-ldot";
            dot.style.background = p.colour;
            li.append(dot, `${p.count} × ${commonName(bundle, p.species).toLowerCase()}`);
            legend.appendChild(li);
        }
        const chip = document.createElement("span");
        chip.className = "lg-fits";
        chip.textContent = "Three Sisters · fits this bed";
        const cap = document.createElement("figcaption");
        cap.textContent = copy.landingProductPlaceCap;
        cap.dataset.copyKey = "landingProductPlaceCap";
        fig.append(k, frame, legend, chip, cap);
        row.appendChild(fig);
    }
    if (rule?.mechanism && rule.claim) {
        const fig = document.createElement("figure");
        fig.className = "lg-glimpse";
        const k = document.createElement("span");
        k.className = "lg-kicker";
        k.textContent = copy.landingProductRuleKicker;
        k.dataset.copyKey = "landingProductRuleKicker";
        const card = document.createElement("div");
        card.className = "lg-rulecard";
        const badge = confidenceBadge(rule.grade ?? "");
        if (badge)
            card.appendChild(badge);
        const claim = document.createElement("p");
        claim.className = "lg-rc-claim";
        claim.textContent = rule.claim;
        const mech = document.createElement("p");
        mech.className = "lg-rc-mech";
        const sentences = rule.mechanism.match(/[^.]+\.?/g) ?? [rule.mechanism];
        mech.textContent = sentences.slice(0, 2).join("").trim();
        card.append(claim, mech);
        const ev = document.createElement("a");
        ev.className = "lg-rec-ev";
        ev.href = `#/why?rule=${LANDING_RULE_ID}`;
        ev.textContent = "See the evidence →";
        const cap = document.createElement("figcaption");
        cap.textContent = copy.landingProductRuleCap;
        cap.dataset.copyKey = "landingProductRuleCap";
        fig.append(k, card, ev, cap);
        row.appendChild(fig);
    }
    host.appendChild(row);
    host.hidden = false;
}
const KNOWS_SHOWN = 6;
function firstSentence(s) {
    const t = s.trim();
    const m = t.match(/^.*?\.(?=\s|$)/);
    return (m ? m[0] : t).trim();
}
function renderLandingKnows(bundle) {
    const host = document.getElementById("lgknows");
    if (!host)
        return;
    const rules = (bundle.rules ?? []).filter((r) => r.claim && r.mechanism && r.grade);
    if (!rules.length) {
        host.hidden = true;
        return;
    }
    const count = rules.length;
    const shown = rules
        .filter((r) => { const s = firstSentence(r.mechanism); return s.length >= 18 && s.length <= 120; })
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(0, KNOWS_SHOWN);
    if (!shown.length) {
        host.hidden = true;
        return;
    }
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "lg-knows-in";
    const head = document.createElement("div");
    head.className = "lg-knows-head";
    const k = document.createElement("span");
    k.className = "lg-kicker lg-knows-k";
    k.textContent = "What it knows";
    const n = document.createElement("div");
    n.className = "lg-knows-n";
    n.textContent = String(count);
    const lead = document.createElement("p");
    lead.className = "lg-knows-lead";
    lead.textContent = "graded rules, each with a mechanism you can read in one sentence — and demote the day the evidence turns out thinner than we thought.";
    head.append(k, n, lead);
    const list = document.createElement("ul");
    list.className = "lg-knows-list";
    for (const r of shown) {
        const li = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = "lg-knows-dot";
        dot.setAttribute("aria-hidden", "true");
        const body = document.createElement("div");
        const claim = document.createElement("span");
        claim.className = "lg-knows-claim";
        claim.textContent = r.claim;
        const mech = document.createElement("span");
        mech.className = "lg-knows-mech";
        mech.textContent = firstSentence(r.mechanism);
        body.append(claim, mech);
        li.append(dot, body);
        list.appendChild(li);
    }
    const foot = document.createElement("a");
    foot.className = "lg-knows-ev";
    foot.href = "#/why";
    foot.textContent = "Read how a rule is graded →";
    inner.append(head, list, foot);
    host.append(inner);
    host.hidden = false;
}
const EVIDENCE_RULE_ID = "R-001";
function renderLandingEvidence(bundle) {
    const host = document.getElementById("lgevfeat");
    if (!host)
        return;
    const rules = (bundle.rules ?? []);
    const verified = (r) => r.evidence?.status === "verified" && (r.evidence?.pointers?.length ?? 0) >= 1;
    const rule = rules.find((r) => r.id === EVIDENCE_RULE_ID && verified(r)) ?? rules.find(verified);
    const pointers = (rule?.evidence?.pointers ?? []).map(String).filter((s) => s.trim());
    if (!rule?.claim || !rule.mechanism || !pointers.length) {
        host.hidden = true;
        return;
    }
    host.innerHTML = "";
    const k = document.createElement("span");
    k.className = "lg-kicker";
    k.textContent = "A rule, in full";
    const grid = document.createElement("div");
    grid.className = "lg-ev-grid";
    const main = document.createElement("div");
    const claim = document.createElement("h2");
    claim.className = "lg-ev-claim";
    claim.textContent = rule.claim;
    main.appendChild(claim);
    const badge = confidenceBadge(rule.grade ?? "");
    if (badge) {
        badge.classList.add("lg-ev-badge");
        main.appendChild(badge);
    }
    const mech = document.createElement("p");
    mech.className = "lg-ev-mech";
    mech.textContent = rule.mechanism;
    main.appendChild(mech);
    const more = document.createElement("a");
    more.className = "lg-rec-ev lg-ev-more";
    more.href = `#/why?rule=${rule.id}`;
    more.textContent = "See the full entry →";
    main.appendChild(more);
    const aside = document.createElement("aside");
    aside.className = "lg-ev-aside";
    const ak = document.createElement("span");
    ak.className = "lg-kicker lg-ev-aside-k";
    ak.textContent = "Sources we read";
    aside.appendChild(ak);
    const srcs = document.createElement("div");
    srcs.className = "lg-ev-srcs";
    for (const p of pointers.slice(0, 2))
        citationLine(p, srcs);
    if (pointers.length > 2) {
        const rest = document.createElement("p");
        rest.className = "lg-ev-rest";
        rest.textContent = `+ ${pointers.length - 2} more on the full entry`;
        srcs.appendChild(rest);
    }
    aside.appendChild(srcs);
    grid.append(main, aside);
    host.append(k, grid);
    host.hidden = false;
}
function renderLandingSeasons() {
    const host = document.getElementById("lgseasons");
    if (!host)
        return;
    renderSeasonBand(host, { current: document.documentElement.dataset.season ?? null });
}
function armLandingMotion() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    if (!("IntersectionObserver" in window))
        return;
    const els = Array.from(document.querySelectorAll("#page-start [data-reveal]"));
    if (!els.length)
        return;
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
                e.target.classList.add("in");
                io.unobserve(e.target);
            }
        }
    }, { threshold: 0.15 });
    for (const e of els) {
        e.classList.add("pre");
        io.observe(e);
    }
    window.addEventListener("scroll", () => {
        for (const e of els) {
            if (e.classList.contains("pre") && !e.classList.contains("in")
                && e.getBoundingClientRect().bottom < 0) {
                e.classList.add("in");
                io.unobserve(e);
            }
        }
    }, { passive: true });
}
const LANDING_HERO_SCENE = "garden-beds-summer";
const LANDING_CLOSE_SCENE = "kitchen-garden-potager";
function renderDeepBand(bundle, hostId, sceneId, headingKey, bodyKey) {
    const host = document.getElementById(hostId);
    if (!host)
        return;
    const scene = bundle.scenes?.[sceneId];
    if (!scene) {
        host.hidden = true;
        return;
    }
    host.innerHTML = "";
    const applyPhoto = () => host.style.setProperty("--hero-img", `url(img/scenes/${scene.file})`);
    if (host.style.getPropertyValue("--hero-img")) {
        applyPhoto();
    }
    else if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                applyPhoto();
                io.disconnect();
            }
        }, { rootMargin: "200px 0px" });
        io.observe(host);
    }
    else {
        applyPhoto();
    }
    const text = document.createElement("div");
    text.className = "herotext";
    const h = document.createElement("h2");
    h.className = "lg-deep-h";
    h.textContent = copy[headingKey];
    h.dataset.copyKey = headingKey;
    const body = document.createElement("p");
    body.className = "lg-deep-body";
    body.textContent = copy[bodyKey];
    body.dataset.copyKey = bodyKey;
    const credit = document.createElement("p");
    credit.className = "lg-deep-credit";
    credit.append(`Photo: ${scene.artist} · `);
    if (/^https?:\/\//.test(scene.url ?? "")) {
        const a = document.createElement("a");
        a.href = scene.url;
        a.rel = "noreferrer";
        a.textContent = scene.licence;
        credit.append(a);
    }
    else {
        credit.append(scene.licence);
    }
    text.append(h, body, credit);
    host.append(text);
    host.hidden = false;
}
function renderLandingHero(bundle) {
    renderDeepBand(bundle, "lgdeep", LANDING_HERO_SCENE, "landingDeepHeading", "landingDeepBody");
    renderDeepBand(bundle, "lgdeep2", LANDING_CLOSE_SCENE, "landingDeep2Heading", "landingDeep2Body");
}
export function renderLanding(bundle) {
    renderLandingFrost(bundle);
    renderLandingProduct(bundle);
    renderLandingSeasons();
    renderLandingKnows(bundle);
    renderLandingEvidence(bundle);
    renderLandingHero(bundle);
    armLandingMotion();
}
const STARTED_KEY = "gg-started";
const LEGACY_KEYS = [["tsg.started", "gg-started"], ["tsg.home", "gg-home"]];
export function migrateLegacyKeys(store) {
    for (const [old, cur] of LEGACY_KEYS) {
        const v = store.getItem(old);
        if (v === null)
            continue;
        if (store.getItem(cur) === null)
            store.setItem(cur, v);
        store.removeItem(old);
    }
}
export function markStarted() {
    try {
        localStorage.setItem(STARTED_KEY, "1");
    }
    catch { }
}
export function clearStarted() {
    try {
        localStorage.removeItem(STARTED_KEY);
    }
    catch { }
}
const HOME_KEY = "gg-home";
let homeUp = false;
export function homeRendered() { return homeUp; }
export function markHomeworthy(on, settled) {
    if (on)
        homeUp = true;
    if (!on && !settled)
        return;
    try {
        if (on)
            localStorage.setItem(HOME_KEY, "1");
        else
            localStorage.removeItem(HOME_KEY);
    }
    catch { }
}
export function arrivalPlan(hash, homeworthy) {
    const explicit = hash !== "" && hash !== "#" && hash !== "#/";
    const goHome = !explicit;
    return { goHome, holdSplash: homeworthy && (goHome || hash.startsWith("#/start")) };
}
export function landingFastPath() {
    let homeworthy = false;
    try {
        migrateLegacyKeys(localStorage);
        homeworthy = localStorage.getItem(HOME_KEY) === "1";
    }
    catch { }
    const { goHome, holdSplash } = arrivalPlan(location.hash, homeworthy);
    if (goHome)
        location.hash = "#/start";
    if (holdSplash) {
        document.body.classList.add("home-returning");
        holdForHome = true;
    }
}
let holdForHome = false;
export function awaitingHome() { return holdForHome; }
