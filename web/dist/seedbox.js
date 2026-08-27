// The seed box (O111b). What varieties the gardener OWNS, so a plan can subtract what you have from
// what it needs (O111c's shopping list). It is USER DATA that syncs like a user species (kind
// 'seed'); the engine never reads it. This module owns the Log-tab surface: it populates the crop
// picker from the corpus species (plus the user's own added varieties), lists what's in the box, and
// wires add/remove. It writes through storage.ts, which validates and stamps for sync; a synced pull
// re-renders through the Log's refresh, exactly as user_species does.
import { app, commonName } from "./state.js";
import { listSeeds, putSeed, deleteSeed } from "./storage.js";
import { toast } from "./notices.js";
import { $ } from "./dom.js";
/** A short, collision-resistant local id. Date.now/Math.random are fine in the running app - the
 *  no-clock rule guards the BUILD, not the runtime. */
function mintSeedId() {
    return `seed_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
let wired = false;
/** Populate the crop picker once (corpus species + the user's own varieties, by display name). */
function fillSpecies(bundle) {
    const sel = $("seedspecies");
    if (!sel || sel.options.length > 1)
        return; // already filled (keeps the placeholder at index 0)
    const seen = new Set();
    const rows = [];
    for (const s of [...bundle.species, ...app.userSpecies]) {
        const id = s.id;
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        rows.push([id, commonName(bundle, id)]);
    }
    rows.sort((a, b) => a[1].localeCompare(b[1]));
    for (const [id, name] of rows) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = name;
        sel.appendChild(o);
    }
}
/** One line in the box: name (+ variety), then the quiet details, then remove. Meaning is text, never
 *  colour (D-105). Built with DOM calls so a seed's free text can never inject markup. */
function seedRow(bundle, s, onRemove) {
    const li = document.createElement("li");
    li.className = "seed";
    const head = document.createElement("span");
    head.className = "seed-name";
    head.textContent = commonName(bundle, s.species) + (s.variety ? ` — ${s.variety}` : "");
    li.appendChild(head);
    const bits = [s.quantity, s.year ? String(s.year) : "", s.notes].filter(Boolean);
    if (bits.length) {
        const meta = document.createElement("span");
        meta.className = "seed-meta";
        meta.textContent = bits.join(" · ");
        li.appendChild(meta);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "seed-rm";
    rm.setAttribute("aria-label", `remove ${head.textContent} from the seed box`);
    rm.textContent = "×"; // the monochrome close glyph - allowed (D-105)
    rm.addEventListener("click", onRemove);
    li.appendChild(rm);
    return li;
}
/** Render the seed box into #seedbox. Idempotent - safe to call on every Log refresh and after a
 *  synced pull. */
export async function renderSeedBox(db, bundle) {
    const list = $("seedlist");
    const empty = $("seedempty");
    if (!list)
        return;
    fillSpecies(bundle);
    const draw = async () => {
        const seeds = (await listSeeds(db)).sort((a, b) => commonName(bundle, a.species).localeCompare(commonName(bundle, b.species)));
        list.textContent = "";
        for (const s of seeds) {
            list.appendChild(seedRow(bundle, s, async () => {
                await deleteSeed(db, s.id);
                toast(`Removed ${commonName(bundle, s.species)} from the seed box`);
                await draw();
                await app.logRefresh?.(); // O111c: the shopping list may gain this species back
            }));
        }
        if (empty)
            empty.hidden = seeds.length > 0;
    };
    if (!wired) {
        wired = true;
        const form = $("seedadd");
        form?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const sel = $("seedspecies");
            const species = sel.value;
            if (!species) {
                toast("Pick a crop first");
                return;
            }
            const yearRaw = $("seedyear").value.trim();
            const rec = {
                id: mintSeedId(),
                species,
                variety: $("seedvariety").value.trim() || undefined,
                quantity: $("seedqty").value.trim() || undefined,
                year: yearRaw ? Number(yearRaw) : undefined,
                notes: $("seednotes").value.trim() || undefined,
            };
            try {
                await putSeed(db, rec);
                toast(`Added ${commonName(bundle, species)} to the seed box`);
                ["seedvariety", "seedqty", "seedyear", "seednotes"]
                    .forEach((id) => { $(id).value = ""; });
                sel.selectedIndex = 0;
                await draw();
                await app.logRefresh?.(); // O111c: the added species may drop off the shopping list
            }
            catch (err) {
                toast(err instanceof Error ? err.message : "Could not add that seed");
            }
        });
    }
    await draw();
}
/** The shopping list (O111c): the distinct species in the viewed plan MINUS what the seed box holds,
 *  matched by species id. Sits under the seed box on the Log so "what you own" and "what you still
 *  need" read together. Rendered on every log refresh from the viewed season's plantings; it never
 *  invents a quantity (the corpus gives none) - it lists WHAT to get, not how much. */
export async function renderShoppingList(db, bundle, plantings) {
    const list = $("shoplist");
    const note = $("shopnote");
    if (!list || !note)
        return;
    // distinct plan species, with how many plantings call for each
    const need = new Map();
    for (const p of plantings) {
        if (p && typeof p.species === "string" && p.species)
            need.set(p.species, (need.get(p.species) ?? 0) + 1);
    }
    const owned = new Set((await listSeeds(db)).map((s) => s.species));
    const toBuy = [...need.entries()].filter(([sid]) => !owned.has(sid))
        .map(([sid, n]) => ({ sid, n }))
        .sort((a, b) => commonName(bundle, a.sid).localeCompare(commonName(bundle, b.sid)));
    list.textContent = "";
    if (need.size === 0) {
        note.textContent = "Nothing planned yet. Arrange beds on Plan, and what you need to buy shows up here.";
        note.hidden = false;
        return;
    }
    if (toBuy.length === 0) {
        note.textContent = "Your seed box covers this plan - nothing to buy.";
        note.hidden = false;
        return;
    }
    note.hidden = true;
    for (const { sid, n } of toBuy) {
        const li = document.createElement("li");
        li.className = "shop";
        const name = document.createElement("span");
        name.className = "shop-name";
        name.textContent = commonName(bundle, sid);
        li.appendChild(name);
        if (n > 1) {
            const meta = document.createElement("span");
            meta.className = "shop-meta";
            meta.textContent = `${n} in the plan`;
            li.appendChild(meta);
        }
        list.appendChild(li);
    }
}
