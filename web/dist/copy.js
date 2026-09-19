import { copyValues } from "./copy-values.gen.js";
export const copy = copyValues;
export function applyCopy(root = document) {
    for (const el of root.querySelectorAll("[data-copy]")) {
        const key = el.dataset.copy;
        if (key && key in copy)
            el.textContent = copy[key];
    }
    for (const el of root.querySelectorAll("[data-copy-html]")) {
        const key = el.dataset.copyHtml;
        if (key && key in copy)
            el.innerHTML = copy[key];
    }
    applySeasonalCopy(root);
}
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
