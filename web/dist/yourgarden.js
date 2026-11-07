import './chunk-zy8u1cfz.js';
import { fillCopy, appLang, midSentence, copy, isStranger, countGardenArrival } from './paint.js';
import { commonName, displayName, el, GARDEN_PARTS, gardenCtx, app, openAuthSheetWhenReady } from './core.js';
import { doorTryable } from './chunk-f08gghbd.js';
import './chunk-lb1yy3jt.js';

const PARTS = {
    plan: { h: copy.ygPlanH, p: copy.ygPlanP, example: true },
    calendar: { h: copy.ygCalH, p: copy.ygCalP, example: true },
    log: { h: copy.ygLogH, p: copy.ygLogP, example: true },
    review: { h: copy.ygReviewH, p: copy.ygReviewP, example: false },
    safe: { h: copy.ygSafeH, p: copy.ygSafeP, example: false },
};
function ensureCss() {
    if (document.getElementById("yourgarden-css"))
        return;
    const link = document.createElement("link");
    link.id = "yourgarden-css";
    link.rel = "stylesheet";
    link.href = "./yourgarden.css";
    const main = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
    (main?.parentNode ?? document.head).insertBefore(link, main ? main.nextSibling : null);
}
const button = (label, cls, run) => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", run);
    return b;
};
const openSheet = (mode) => { void openAuthSheetWhenReady(mode); };
async function exampleAt(route, door = null) {
    location.hash = `#/${route}`;
    for (let i = 0; i < 120 && !app.showExample; i++)
        await new Promise((r) => setTimeout(r, 100));
    await app.showExample?.("#/example-at", door);
}
const placeGiven = () => {
    try {
        const a = JSON.parse(localStorage.getItem("gg-answers") ?? "{}");
        return typeof a.lat === "number" && typeof a.lon === "number";
    }
    catch {
        return false;
    }
};
function tryLabel(ctx, bundle, given) {
    if (!bundle)
        return null;
    const door = doorOf(ctx);
    if (!door || !doorTryable(door, bundle))
        return null;
    if (ctx.crop && bundle.species.some((s) => s.id === ctx.crop)) {
        const name = commonName(bundle, ctx.crop);
        return fillCopy(given ? "ygTryCropAt" : "ygTryCrop", { crop: appLang() === "es" ? name : midSentence(name) });
    }
    const g = ctx.guild ? bundle.guilds.find((x) => x.id === ctx.guild) : undefined;
    return g ? fillCopy(given ? "ygTryTeamAt" : "ygTryTeam", { team: displayName(g) }) : null;
}
const doorOf = (ctx) => ctx.crop || ctx.guild ? { crop: ctx.crop ?? null, guild: ctx.guild ?? null } : null;
function partOrder(lead) {
    const all = [...GARDEN_PARTS, "safe"];
    return lead ? [lead, ...all.filter((p) => p !== lead)] : all;
}
function drawGardenParts(host, lead, door = null) {
    ensureCss();
    host.querySelector(":scope > .yg-parts")?.remove();
    const sec = el("section", "yg-parts");
    const h = el("h2", "yg-keeps", copy.ygKeepsH);
    h.id = `yg-keeps-${host.id || "page"}`;
    sec.setAttribute("aria-labelledby", h.id);
    const list = el("ul", "yg-list");
    for (const id of partOrder(lead)) {
        const part = PARTS[id];
        const li = el("li", "card yg-part");
        li.dataset.part = id;
        const head = el("h3", "", part.h);
        head.id = `${h.id}-${id}`;
        li.append(head, el("p", "", part.p));
        if (part.example) {
            const go = el("p", "yg-ex");
            const b = button(copy.ygSeeExample, "linkbtn", () => { void exampleAt(id, typeof door === "function" ? door() : door); });
            b.dataset.ex = id;
            b.setAttribute("aria-describedby", head.id);
            go.append(b);
            li.append(go);
        }
        list.append(li);
    }
    sec.append(h, list);
    host.append(sec);
}
function contextLine(ctx, bundle) {
    if (!bundle)
        return null;
    if (ctx.crop && bundle.species.some((s) => s.id === ctx.crop)) {
        const name = commonName(bundle, ctx.crop);
        return fillCopy("ygCropLine", { crop: appLang() === "es" ? name : midSentence(name) });
    }
    const g = ctx.guild ? bundle.guilds.find((x) => x.id === ctx.guild) : undefined;
    if (g)
        return fillCopy("ygTeamLine", { team: displayName(g) });
    return null;
}
function drawYourGarden(ctx, bundle) {
    const host = document.getElementById("ygbody");
    if (!host)
        return;
    const lede = el("p", "tagline yg-lede", copy.ygLede);
    const said = contextLine(ctx, bundle);
    const acts = el("p", "lockacts yg-acts");
    const join = button(copy.acDoorCreate, "btn btn-primary primary", () => openSheet("signup"));
    join.dataset.act = "signup";
    const ex = button(tryLabel(ctx, bundle, placeGiven()) ?? copy.acDoorExample, "btn btn-secondary", () => { void exampleAt(ctx.part ?? "start", doorOf(ctx)); });
    ex.dataset.act = "example";
    const sign = button(copy.acDoorSignIn, "btn btn-quiet", () => openSheet("signin"));
    sign.dataset.act = "signin";
    acts.append(join, ex, sign);
    const nodes = [lede];
    if (said)
        nodes.push(el("p", "yg-ctx", said));
    nodes.push(acts, el("p", "yg-free", copy.ygFree));
    host.replaceChildren(...nodes);
    drawGardenParts(host, ctx.part, doorOf(ctx));
    host.append(el("p", "lockopen", copy.acDoorOpen));
}
const withoutJoin = (hash) => {
    const q = hash.indexOf("?");
    const p = new URLSearchParams(q < 0 ? "" : hash.slice(q + 1));
    p.delete("join");
    const rest = p.toString();
    return `#/garden${rest ? `?${rest}` : ""}`;
};
function initYourGarden(bundle) {
    let last = "";
    const draw = () => {
        if (!/^#\/garden(?:\?|$)/.test(location.hash)) {
            last = "";
            return;
        }
        if (location.hash === last)
            return;
        const ctx = gardenCtx(location.hash);
        if (ctx.join)
            history.replaceState(history.state, "", withoutJoin(location.hash));
        last = location.hash;
        drawYourGarden(ctx, bundle());
        const from = ctx.from ?? (ctx.join ? "join" : null);
        if (from && isStranger())
            countGardenArrival(from);
        if (ctx.join)
            openSheet("signup");
    };
    addEventListener("hashchange", draw);
    draw();
}

export { contextLine, drawGardenParts, initYourGarden, partOrder };
