// Haptics (D-098) - one tiny door to the vibration API. Android Chrome buzzes; iOS Safari has
// NO web vibration API, so there it is a silent no-op and the juice stays visual - never
// advertised, never required, never a fallback dialog. Callers pick short patterns:
// a tile landing ~8 ms, a hole filling ~20, a bed saved ~30, a season closed a small triple.
export const buzz = (pattern) => {
    try {
        navigator.vibrate?.(pattern);
    }
    catch { /* blocked by a permissions policy - fine */ }
};
