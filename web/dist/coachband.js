export function coachBand(host, heading, cards, show) {
    if (!host)
        return;
    host.hidden = !show;
    host.classList.remove("coachfold");
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
export function coachFold(host, heading, cards, show) {
    if (!host)
        return;
    host.hidden = !show;
    host.classList.remove("coachband");
    if (!show) {
        host.replaceChildren();
        host.classList.remove("coachfold");
        return;
    }
    host.classList.add("coachfold");
    const det = document.createElement("details");
    det.className = "coachfold-d";
    const sum = document.createElement("summary");
    sum.className = "coachfold-s";
    sum.textContent = heading;
    det.appendChild(sum);
    const ul = document.createElement("ul");
    ul.className = "coachfold-list";
    for (const c of cards) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "coachfold-link";
        a.href = `../guides/${c.slug}/`;
        a.textContent = c.title;
        li.appendChild(a);
        ul.appendChild(li);
    }
    det.appendChild(ul);
    host.replaceChildren(det);
}
export const COACH_HEADING = "New to this? Learn the ground rules";
export const COACH_HEADING_FOLD = "New to this? Ground-rule guides";
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
