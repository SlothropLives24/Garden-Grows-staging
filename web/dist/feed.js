export function feedTime(iso) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    const days = Math.floor(mins / (60 * 24));
    return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago`
        : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago`
            : days < 7 ? `${days} day${days === 1 ? "" : "s"} ago`
                : new Date(iso).toLocaleDateString();
}
export function postBody(text, cls) {
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text;
    return p;
}
