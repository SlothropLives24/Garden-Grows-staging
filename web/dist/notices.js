let el = null;
let timer = 0;
export function toast(text, ms, action, opts) {
    if (!el || !document.body.contains(el)) {
        el = document.createElement("div");
        el.id = "plantoast";
        el.setAttribute("role", "status");
        document.body.appendChild(el);
    }
    const marked = !!opts?.celebrate;
    el.classList.toggle("celebrate", marked);
    let dwell = ms ?? (marked ? 5200 : 2500);
    el.textContent = text;
    if (action) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "toast-act";
        b.textContent = action.label;
        b.addEventListener("click", () => { el?.classList.remove("show"); action.go(); });
        el.append(" ", b);
        if (dwell < 8000)
            dwell = 8000;
    }
    el.classList.add("show");
    clearTimeout(timer);
    timer = window.setTimeout(() => el?.classList.remove("show"), dwell);
}
export function celebrate(text) {
    toast(text, undefined, undefined, { celebrate: true });
}
