import './chunk-lutet8cz.js';
import { DOORS } from './paint.js';

function plantAgainst(rec) {
    return !!rec && (String(rec.status ?? "").toUpperCase() === "BLACKLISTED" || !!rec.invasive_status);
}
const CURRENT = {
    when: "when", place: "when", teams: "together", now: "now", wrong: "wrong", logfirst: "diary",
    whybelief: "tip", whyrule: null, examplehome: "example",
};
const ID = /^[a-z0-9_]+$/;
const ZIP = /^\d{5}$/;
const CC = /^[A-Z]{2}$/;
function placeQuery(k) {
    if (k.zip && ZIP.test(k.zip))
        return `zip=${k.zip}`;
    const p = k.place;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) {
        return `at=${p.lat.toFixed(4)},${p.lon.toFixed(4)}&place=${encodeURIComponent(p.place.slice(0, 80))}`
            + (p.country && CC.test(p.country) ? `&cc=${p.country}` : "");
    }
    return "";
}
const withQ = (route, q) => (q ? `${route}${route.includes("?") ? "&" : "?"}${q}` : route);
const crop = (k) => (k.crop && ID.test(k.crop) && k.cropName ? k.crop : null);
const when = (k) => (crop(k)
    ? { id: "when", key: "trWhenCrop", vars: { crop: k.cropName }, hash: `#/answers?crop=${k.crop}` }
    : { id: "when", key: "door1Q", hash: withQ("#/answers", placeQuery(k)) });
const together = (k) => (crop(k)
    ? { id: "together", key: "trTogetherCrop", vars: { crop: k.cropName }, hash: `#/answers?teams&crop=${k.crop}` }
    : { id: "together", key: "door2Q", hash: "#/answers?teams" });
const wrong = (k) => (crop(k)
    ? { id: "wrong", key: "trWrongCrop", vars: { crop: k.cropName }, hash: `#/log?wrong&crop=${k.crop}` }
    : { id: "wrong", key: "doorWrongQ", hash: "#/log?wrong" });
const now = (k) => ({ id: "now", key: "doorNowQ", hash: withQ("#/answers?situation=now", placeQuery(k)) });
const plan = (k, onAnswers = false) => (k.team && ID.test(k.team) && k.teamName
    ? { id: "plan", key: "trPlanTeam", vars: { team: k.teamName }, hash: `#/plan?guild=${k.team}` }
    : onAnswers
        ? (crop(k) ? { id: "plan", key: "trPlanCrop", vars: { crop: k.cropName }, action: "ansplan" }
            : { id: "plan", key: "answersPlanBtn", action: "ansplan" })
        : { id: "plan", key: "door4Q", hash: "#/plan" });
const tip = (k) => (k.tip && /^B-\d+$/.test(k.tip.id)
    ? { id: "tip", words: k.tip.q, hash: `#/why?belief=${k.tip.id}` } : null);
const diary = { id: "diary", key: "doorDiaryQ", hash: "#/log" };
function screenOf(s) {
    if (s.action)
        return `action:${s.action}`;
    if (s.href)
        return `site:${s.href}`;
    const [route, query = ""] = (s.hash ?? "").split("?");
    const q = new URLSearchParams(query);
    if (route === "#/answers")
        return `answers:${q.has("teams") ? "teams" : q.has("situation") ? `situation=${q.get("situation")}` : "dates"}`;
    if (route === "#/log")
        return `log:${q.has("wrong") ? "wrong" : "diary"}`;
    if (route === "#/why")
        return `why:${q.get("belief") ?? q.get("rule") ?? ""}`;
    return `app:${route}`;
}
function trailFor(surface, k) {
    const current = CURRENT[surface];
    let next;
    let cands;
    switch (surface) {
        case "when":
            next = { id: "ics", key: "answersIcsBtn", action: "ics" };
            cands = [plan(k, true), wrong(k)];
            break;
        case "place":
            next = plan(k, true);
            cands = [now(k), tip(k) ?? { id: "tip", key: "doorsGroupTip", hash: "#/why" }];
            break;
        case "teams":
            next = plan(k);
            cands = [tip(k), now(k)];
            break;
        case "now":
            next = plan(k, true);
            cands = [wrong(k), diary];
            break;
        case "wrong":
            next = { id: "note", key: "trNoteDiary", action: "note" };
            cands = [tip(k), crop(k) ? when(k) : now(k)];
            break;
        case "logfirst":
            next = { id: "frost", key: "trFrostDates", hash: withQ("#/answers", placeQuery(k)) };
            cands = [now(k), plan(k)];
            break;
        case "whybelief":
            next = k.guide && /^[a-z0-9-]+$/.test(k.guide.slug)
                ? { id: "guide", words: k.guide.title, href: `../guides/${k.guide.slug}/` }
                : crop(k) ? when(k) : together(k);
            cands = [crop(k) ? wrong(k) : now(k), crop(k) ? together(k) : plan(k)];
            break;
        case "whyrule":
            next = k.ruleKind === "team" ? plan(k) : k.ruleKind === "symptom" ? wrong(k) : crop(k) ? when(k) : plan(k);
            cands = [tip(k), now(k)];
            break;
        case "examplehome":
            next = { id: "plan", key: "exampleStartOwn", action: "examplestart" };
            cands = [now(k), wrong(k)];
            break;
    }
    const seen = new Set([screenOf(next)]);
    const more = [];
    for (const c of cands) {
        if (!c || c.id === current || more.length >= 2 || seen.has(screenOf(c)))
            continue;
        seen.add(screenOf(c));
        more.push(c);
    }
    return { next, more, fold: DOORS.filter((d) => d !== current) };
}

export { plantAgainst, trailFor };
