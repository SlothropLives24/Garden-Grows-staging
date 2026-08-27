// O58 Phase 4 (slice C): the "learn the ground rules" coaching band.
//
// The empty cold states - the signed-out Log, the Plan page before an address, the Calendar with no
// location - were walls of nothing on a desktop (the sparseness the maintainer reported). This fills
// them with two-three cards linking the how-to GUIDES: the FIRST app -> content links in the product
// (the survey found the link graph ran one way). It shows ONLY while the surface has nothing real to
// say - each render hook that calls it re-fires on state change, so the band self-hides the moment a
// bed, a location, or a dated event exists. Text cards (no photo) in the landing's .lg-guild grammar.
//
// The guides live at the domain root beside /web/, so the link is the relative `../guides/<slug>/` -
// the same form the plant card's "see this as a page" link already uses. Opened in a new tab so a
// reader who has started a plan does not lose it to a documentation detour.
export function coachBand(host, heading, cards, show) {
    if (!host)
        return;
    host.hidden = !show;
    if (!show) {
        host.replaceChildren();
        return;
    }
    host.classList.add("coachband");
    const h = document.createElement("p");
    h.className = "coachband-h";
    h.textContent = heading;
    const grid = document.createElement("div");
    grid.className = "coachband-cards";
    for (const c of cards) {
        const a = document.createElement("a");
        a.className = "coachcard";
        a.href = `../guides/${c.slug}/`;
        a.target = "_blank";
        a.rel = "noopener";
        const im = document.createElement("img");
        im.className = "coachcard-img";
        im.src = `img/thumbs/${c.thumb}.webp`;
        im.alt = "";
        im.width = 720;
        im.height = 360;
        im.loading = "lazy";
        im.decoding = "async";
        const t = document.createElement("span");
        t.className = "coachcard-t";
        t.textContent = c.title;
        const b = document.createElement("span");
        b.className = "coachcard-b";
        b.textContent = c.blurb;
        a.append(im, t, b);
        grid.appendChild(a);
    }
    host.replaceChildren(h, grid);
}
// The band's heading, and each surface's contextual card set - guides that answer THAT cold state.
export const COACH_HEADING = "New to this? Learn the ground rules";
export const COACH_LOG = [
    { slug: "crop-rotation", title: "What the ledger is for", thumb: "card_solanum_tuberosum",
        blurb: "Why recording what grew where lets the planner rotate your crops off their pests." },
    { slug: "rotate-or-replace-raised-bed", title: "Rotate crops or replace the soil?", thumb: "card_solanum_lycopersicum",
        blurb: "In a raised bed the answer is rotate - replacing the soil is the costly way to do it." },
    { slug: "raised-bed-soil", title: "Last year's raised-bed soil", thumb: "card_scene_garden-beds-summer",
        blurb: "It settled, it isn't spent - refresh it with compost instead of digging it out." },
];
export const COACH_WHERE = [
    { slug: "garden-types", title: "Which ground do you have?", thumb: "card_scene_garden-rows-field",
        blurb: "Field, in-ground bed, raised bed, or container - what each costs and buys." },
    { slug: "frost-dates", title: "Understanding your frost dates", thumb: "card_ocimum_basilicum",
        blurb: "The clock the whole garden runs on - and why it is odds, not a date on the wall." },
    { slug: "plant-your-first-bed", title: "Plant your first bed, step by step", thumb: "card_lactuca_sativa",
        blurb: "A first season, from which crops to pick through when each one goes in." },
];
export const COACH_CAL = [
    { slug: "frost-dates", title: "Understanding your frost dates", thumb: "card_ocimum_basilicum",
        blurb: "Why this page needs a location - the dates are counted from your frost." },
    { slug: "plant-your-first-bed", title: "Plant your first bed, step by step", thumb: "card_lactuca_sativa",
        blurb: "A first season, timed off the frost dates this page will show." },
    { slug: "garden-types", title: "Which ground do you have?", thumb: "card_scene_garden-rows-field",
        blurb: "Field, in-ground bed, raised bed, or container - and how to choose." },
];
