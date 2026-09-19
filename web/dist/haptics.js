export const buzz = (pattern) => {
    try {
        navigator.vibrate?.(pattern);
    }
    catch { }
};
