// The transactional float (O12, approved mockup 2026-07-29) - D-094's messaging split
// generalised off the ground map for the first time. ONE home for "it happened" confirmations:
// "Plan saved", "Soil recorded", "Season closed". Floats over the page, fades on its own, and
// survives any panel repaint because it lives on <body>, not inside the surface that fired it.
//
// Deliberately unfit for anything that must stay findable. Rule output and standing limits
// NEVER ride this: invariant 2 wants a reason SHOWN, not dismissed, and a message that fades is
// a message hidden on a timer. Those belong anchored (severity-striped cards) or folded with
// the count on the lid - see plan.ts / panels/soil.ts.
let el = null;
let timer = 0;
/** Float a short confirmation and fade it after `ms`. One at a time - a new call replaces the
 *  text and restarts the clock. Announced politely to screen readers (role=status). */
export function toast(text, ms = 2500) {
    if (!el || !document.body.contains(el)) {
        el = document.createElement("div");
        el.id = "plantoast";
        el.setAttribute("role", "status");
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(timer);
    timer = window.setTimeout(() => el?.classList.remove("show"), ms);
}
