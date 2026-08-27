// web/src/feed.ts — the team feed's post-rendering primitives, in ONE place so the voice boundary
// is enforced exactly once: a post's body is PLAIN text, never app UI, a link, a grade, or an
// injected element. The Log's full feed (log.ts) and the returning home's digest (home.ts, O63/B)
// both build their post rows on these, so neither can drift from the boundary or the time format.
/** Relative time for a post — "just now" / "N min ago" / "N h ago" / "N days ago", degrading to the
 *  local date past a week. Shared so the Log and the home digest read a post's age the same way.
 *  (O64g: the "N days ago" step was missing, so "23 h ago" jumped straight to a raw date.) */
export function feedTime(iso) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    const days = Math.floor(mins / (60 * 24));
    return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago`
        : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago`
            : days < 7 ? `${days} day${days === 1 ? "" : "s"} ago`
                : new Date(iso).toLocaleDateString();
}
/** A post's body as a PLAIN-text paragraph — the voice boundary, rendered in exactly this one place:
 *  `textContent`, never `innerHTML`, so rule code and markup written in a post stay literal text and
 *  can never become a link, a grade, or an injected element. `cls` lets each surface wear its own
 *  class (the Log's `.feedpost-body`, the home digest's `.feedpost-body` too). */
export function postBody(text, cls) {
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text; // PLAIN text — the voice boundary, and the whole reason this lives in one place
    return p;
}
