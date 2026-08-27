// Reader-facing copy. THE WORDS LIVE IN content/app-copy.yaml now (O50, maintainer direction
// 2026-08-06) - one flat, commented YAML file the content overlay's Copy tab can edit from a
// phone, every change landing as a pull request. scripts/gen_app_copy.py compiles the YAML into
// copy-values.gen.ts (committed; an engine test fails if the two drift), so the strings still
// cost nothing at runtime and `copy.<key>` stays fully typed.
//
// Two ways a string reaches the page, unchanged:
//   1. Static text in index.html carries data-copy="<key>"; applyCopy() writes copy[key] into it.
//   2. JavaScript-rendered lines import `copy` and read copy.<key> directly.
// The voice rules, the *Html whitelist, and the no-rule-codes ban are documented in the YAML
// header, where the person editing the words will actually see them.
import { copyValues } from "./copy-values.gen.js";
export const copy = copyValues;
/** Fill every element carrying data-copy="<key>" with copy[key]. Runs at boot, before the router
 *  reveals any page, so there is no flash of un-worded text. */
export function applyCopy(root = document) {
    for (const el of root.querySelectorAll("[data-copy]")) {
        const key = el.dataset.copy;
        if (key && key in copy)
            el.textContent = copy[key];
    }
    // data-copy-html: for the few landing strings that carry safe inline emphasis (<em>/<b>). The
    // values are authored here, never user input, so innerHTML is safe - it lets emphasised copy stay
    // centralised in this file instead of leaking markup+words into index.html.
    for (const el of root.querySelectorAll("[data-copy-html]")) {
        const key = el.dataset.copyHtml;
        if (key && key in copy)
            el.innerHTML = copy[key];
    }
    applySeasonalCopy(root);
}
/** data-copy-season="landingVoice" resolves to landingVoiceSpring/Summer/Autumn/Winter (O88 S4).
 *
 *  The season is read from <html data-season> rather than imported from units.ts, deliberately: that
 *  stamp is written by boot.js BEFORE first paint and is the same one the stylesheet matches on, so
 *  the words and the palette are driven by one value and cannot disagree. It also keeps this module
 *  a leaf - the copy layer has no reason to know how a season is computed, only which one is showing.
 *
 *  Falls back to autumn, matching the bare :root the stylesheet falls back to when nothing is
 *  stamped: a page with no season still reads as the shipped palette, words included. */
export function applySeasonalCopy(root = document) {
    const season = document.documentElement.dataset.season ?? "autumn";
    const suffix = season.charAt(0).toUpperCase() + season.slice(1);
    for (const el of root.querySelectorAll("[data-copy-season]")) {
        const base = el.dataset.copySeason;
        if (!base)
            continue;
        const key = `${base}${suffix}`;
        const fallback = `${base}Autumn`;
        const resolved = key in copy ? key : (fallback in copy ? fallback : null);
        if (resolved)
            el.textContent = copy[resolved];
    }
}
