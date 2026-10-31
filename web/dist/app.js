import { applyCopy, noteArrival, captureAuthHash, resolveAlias, initNav, landingFastPath, initRouter, currentRoute, isStarted, markStarted, loadChunk, firstStepHash, countDoor, doorClaim, countPageview, chunkFor, warmChunks, copy, awaitingHome, homeRendered } from './paint.js';

const BUNDLE_URL = "../build/app-bundle.json";
async function loadBundle() {
    const res = await fetch(BUNDLE_URL);
    if (!res.ok)
        throw new Error(`could not load ${BUNDLE_URL}: ${res.status}`);
    return (await res.json());
}
let awaitingPlan = false;
const HOME_WAIT_MS = 2500;
applyCopy();
noteArrival();
captureAuthHash();
resolveAlias();
initNav();
landingFastPath();
initRouter();
if (currentRoute() === "plan")
    awaitingPlan = true;
if (currentRoute() === "start" && !awaitingHome() && !isStarted())
    dropSplash();
const warmReadingFace = () => {
    try {
        for (const f of ['400 1em "Newsreader"', 'italic 400 1em "Newsreader"'])
            void document.fonts.load(f);
    }
    catch { }
};
if (isStarted())
    warmReadingFace();
for (const b of document.querySelectorAll(".startgo")) {
    b.addEventListener("click", async () => {
        markStarted();
        await (await loadChunk("core")).startPlanning();
    });
}
document.getElementById("lgfirst")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const place = document.getElementById("lgplace");
    location.hash = firstStepHash(place instanceof HTMLInputElement ? place.value : "");
});
document.getElementById("doorteams")?.addEventListener("click", () => { location.hash = "#/answers?teams"; });
document.getElementById("doornow")?.addEventListener("click", () => { location.hash = "#/answers?situation=now"; });
document.getElementById("doorwrong")?.addEventListener("click", () => { location.hash = "#/log?wrong"; });
document.getElementById("doordiary")?.addEventListener("click", () => { location.hash = "#/log"; });
document.getElementById("page-start")?.addEventListener("click", (e) => {
    const door = e.target?.closest?.("[data-door]");
    if (door?.dataset.door)
        countDoor(door.dataset.door);
});
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
    const from = location.hash;
    await (await loadChunk("core")).seeExample(from);
});
document.getElementById("exampleremove")?.addEventListener("click", () => { void loadChunk("core").then((c) => c.closeExample()); });
document.getElementById("examplestart")?.addEventListener("click", () => { void loadChunk("core").then((c) => c.startOwnGarden()); });
{
    const w = window;
    const tapped = w.__ggEarlyTap, linked = w.__ggEarlyDoor;
    delete w.__ggEarlyTap;
    delete w.__ggEarlyDoor;
    if (tapped && currentRoute() === "start")
        document.getElementById(tapped)?.click();
    if (linked)
        countDoor(linked);
}
countPageview();
function dropSplash() {
    const hide = () => {
        document.getElementById("bootsplash")?.setAttribute("hidden", "");
        if (document.documentElement.dataset.first)
            document.documentElement.dataset.first = "done";
    };
    if (getComputedStyle(document.documentElement).getPropertyValue("--color-bg"))
        hide();
    else {
        addEventListener("load", hide);
        setTimeout(hide, 3000);
    }
}
const markReady = () => {
    const k = chunkFor(currentRoute());
    const done = () => { document.documentElement.dataset.gg = "ready"; };
    if (!k) {
        done();
        return;
    }
    loadChunk(k).then(done, done);
};
const bootFailed = (e) => {
    const boot = document.getElementById("bootsplash");
    if (boot) {
        boot.classList.add("failed");
        const word = boot.querySelector(".bootword");
        if (word)
            word.textContent = copy.apLoadFailed;
    }
    const g = document.getElementById("guilds");
    if (g)
        g.textContent = String(e);
};
const bundleP = loadBundle();
bundleP.catch(() => { });
const coreStarted = loadChunk("core").then(async (core) => { await core.startCore(bundleP); return core; });
if (awaitingHome() || (currentRoute() === "start" && isStarted()))
    void loadChunk("home").catch(() => { });
{
    const k = chunkFor(currentRoute());
    if (k)
        void loadChunk(k).catch(() => { });
}
coreStarted
    .then((core) => {
    if (!awaitingHome() && !awaitingPlan) {
        dropSplash();
        markReady();
        return;
    }
    const t0 = performance.now();
    const settled = () => (!awaitingHome() || homeRendered()) && (!awaitingPlan || core.planArrivalSettled());
    const tick = () => {
        if (settled() || performance.now() - t0 > HOME_WAIT_MS) {
            dropSplash();
            markReady();
            return;
        }
        requestAnimationFrame(tick);
    };
    tick();
})
    .catch(bootFailed);
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => { });
    warmOffline();
}
const keepOffer = (e) => { globalThis.ggInstallOffer = e; dispatchEvent(new Event("gg-install")); };
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); keepOffer(e); });
addEventListener("appinstalled", () => keepOffer(null));
void Promise.all([coreStarted, new Promise((r) => {
        if (document.readyState === "complete")
            r();
        else
            window.addEventListener("load", () => r(), { once: true });
    })]).then(() => setTimeout(() => { warmChunks(); warmReadingFace(); }, 1000), () => { });
function warmOffline() {
    const chunkFiles = (() => {
        try {
            return [...new Set(Object.entries(JSON.parse(document.getElementById("gg-chunks")?.textContent || "{}"))
                    .filter(([k]) => !/-es\.gen\.js$/.test(k)).flatMap(([, v]) => v))];
        }
        catch {
            return [];
        }
    })();
    const sheets = ["logedit.css", "growshere.css", "yearplan.css"];
    const urls = ["../build/pages/evidence.json", "../build/provenance.json", ...chunkFiles.map((f) => `./${f}`), ...sheets.map((f) => `./${f}`)]
        .map((u) => new URL(u, location.href).href);
    const send = () => {
        navigator.serviceWorker.ready
            .then((reg) => reg.active?.postMessage({ type: "gg-warm", urls }))
            .catch(() => { });
    };
    const idle = () => {
        const ric = window.requestIdleCallback;
        if (ric)
            ric(send, { timeout: 10000 });
        else
            setTimeout(send, 3000);
    };
    if (document.readyState === "complete")
        setTimeout(idle, 3000);
    else
        window.addEventListener("load", () => setTimeout(idle, 3000), { once: true });
}
