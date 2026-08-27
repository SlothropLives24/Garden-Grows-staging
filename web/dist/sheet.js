// The Plan sheet (D-079 slice 2). DOM layer only - no engine, storage, or corpus contact.
//
// Mobile (<900px): the plan sections ride in a bottom sheet over the map with three resting
// stops - 40% of the shell visible by DEFAULT, 60% MAX, and CLOSED to just the handle.
// Dragging the handle moves it; release snaps to the nearest stop; a tap on the handle
// toggles closed ↔ default. The map area is sized to the space the sheet leaves
// (--mapspace) so the trace toolbar and nav are never occluded at a resting stop.
// Wide screens (≥900px): CSS turns the sheet into a static LEFT panel (map RIGHT) and this
// controller goes inert - transform is pinned to none by the stylesheet.
const $ = (id) => document.getElementById(id);
const HANDLE_PX = 48; // what stays visible when closed - the grab handle (+ the peek line, O113 N3)
const TAP_PX = 6; // a press that moves less than this is a tap, not a drag
/** O113 N3, the release physics as a PURE rule so it is unit-testable: project the release
 *  position forward by the release velocity (px/ms, positive = sheet growing) carried ~160 ms,
 *  and snap to the stop nearest the PROJECTION. A confident flick therefore settles in the
 *  flick's own direction; at v=0 this is exactly the old nearest-stop rule, which is also what
 *  a pinned clock degrades to (velocity needs time to advance - the e2e suite pins it, so the
 *  physics stays honest there instead of reading as broken). */
export function projectedStop(vis, v, stops) {
    const lo = Math.min(...stops.map(([, px]) => px)), hi = Math.max(...stops.map(([, px]) => px));
    const proj = Math.min(hi, Math.max(lo, vis + v * 160));
    return stops.reduce((p, q) => (Math.abs(q[1] - proj) < Math.abs(p[1] - proj) ? q : p))[0];
}
export function initPlanSheet() {
    const shell = $("planshell"), sheet = $("plansheet"), grab = $("sheetgrab");
    if (!shell || !sheet || !grab)
        return;
    const wide = matchMedia("(min-width: 900px)");
    let stop = "def";
    // Block accidental pinch-zoom of the DRAWER (walkthrough round 17). iOS Safari ignores the
    // viewport's user-scalable=no, so a two-finger gesture on the sheet zoomed the page. CSS
    // touch-action:pan-y handles Chrome; these WebKit-only `gesture*` events cover iOS. The map and
    // the drag canvas are unaffected - they own their own gestures via pointer events, not these.
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
        sheet.addEventListener(ev, (e) => e.preventDefault());
    }
    // While the user is still entering their location the map is BLANK (no location, no imagery), so a
    // 40% sheet just framed empty grey (walkthrough round 20 - "too much blank space before a map
    const visiblePx = (s) => {
        const h = shell.clientHeight;
        const maxFrac = 0.6; // one max for all states - the grid canvas made "no map yet" extinct
        return s === "max" ? h * maxFrac : s === "def" ? h * 0.4 : HANDLE_PX;
    };
    // Walk round 2: the sheet rests LOW always - the grid canvas made the map useful BEFORE a
    // location, so the old tall-while-unlocated default was hiding the invitation. The map is the
    // point; the sheet rises when the user reaches for it.
    const restOpen = () => "def";
    /** Show `vis` px of the sheet; keep the map sized to the rest. The sheet's HEIGHT is the
     *  visible amount (bottom-pinned) - a fixed-height sheet slid down by a transform left its
     *  tail below the screen, so the last card could never be reached (walkthrough round 5). */
    // Two "that scroll was OURS, not the user's" guards. Both are COUNTERS with their own timers,
    // never Date.now() deltas: a wall-clock delta reads as permanently-suppressed anywhere the
    // clock does not advance (the e2e suite pins it - so the adaptive lift below could never be
    // exercised there, and the first version of round 7's fix inherited the same blind spot).
    // A counter cleared by setTimeout behaves identically for a user and stays honest under a
    // pinned clock, which means the behaviour is testable at all.
    let progScroll = 0; // a step navigation is scrolling the sheet body right now
    let stopEcho = 0; // a stop change just clamped the body's scrollTop
    // The APP chose the current stop for map work (an address just committed, D-180). Reflow scrolls
    // must not override it; a real gesture on the sheet clears it. Not a timer: the window ends when
    // the user acts, which is the thing it is actually waiting for.
    let mapForward = false;
    const claim = (which, ms) => {
        if (which === "prog")
            progScroll++;
        else
            stopEcho++;
        setTimeout(() => {
            if (which === "prog")
                progScroll = Math.max(0, progScroll - 1);
            else
                stopEcho = Math.max(0, stopEcho - 1);
        }, ms);
    };
    // (the old stopChangedAt timestamp retired with the switch to counters above - resizing the
    // sheet still CLAMPS the body's scrollTop and fires a synthetic scroll, and `stopEcho` is what
    // keeps the adaptive lift from reading that echo as user intent; it bounced the sheet straight
    // back to max after a map tap dropped it)
    let settleTimer = 0; // "settling" marks the height animation window (round 10): overlays
    // that measure the map (the legend) hide during it and re-appear on settled geometry -
    // without this the legend squeezed into a clipped line mid-transition before vanishing
    const apply = (vis, snap) => {
        // browse mode (round 7, framed map): the sheet is inert - the page scrolls instead
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (snap) {
            stop = snap;
            claim("echo", 600);
        }
        sheet.style.height = `${Math.max(HANDLE_PX, vis)}px`;
        // the designed peek (O113 N3): at the handle stop the grab wears a one-line summary and the
        // path bar hides, instead of the step dots clipping mid-glyph under the pill
        shell.classList.toggle("stop-closed", vis <= HANDLE_PX + 8);
        shell.style.setProperty("--mapspace", `${Math.max(0, shell.clientHeight - vis)}px`);
        shell.classList.add("settling");
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            shell.classList.remove("settling");
            // tell the map the geometry is at rest - it re-fits its overlays on real numbers
            window.dispatchEvent(new Event("gg-sheet-settled"));
        }, 340);
    };
    /** The shell fills the VISIBLE viewport below whatever sits above it (header, demo bar).
     *  visualViewport, not innerHeight (round 8): when the on-screen keyboard opens, the visual
     *  viewport shrinks and the whole shell compresses above it - so the field being typed in
     *  stays readable instead of sitting under the keyboard. */
    const size = () => {
        // browse mode (round 7): CSS owns the layout - clear the JS geometry so the framed map
        // and the scrolling page render from the stylesheet, not a stale sheet height
        if (!wide.matches && document.body.classList.contains("plan-browse")) {
            shell.style.removeProperty("height");
            shell.style.removeProperty("--mapspace");
            sheet.style.removeProperty("height");
            return;
        }
        const top = shell.getBoundingClientRect().top;
        const vh = window.visualViewport?.height ?? window.innerHeight;
        // the phone tab bar (Organic redesign) is fixed to the viewport bottom; the shell stops
        // above it. On desktop the nav is static in the header and measures as 0 here.
        const nav = document.querySelector("header.site nav");
        const navH = nav && getComputedStyle(nav).position === "fixed"
            ? nav.getBoundingClientRect().height : 0;
        // THE SHELL RESIZES INSTANTLY; ITS CHILDREN MUST NOT EASE INTO THE NEW GEOMETRY (D-185).
        //
        // The map area and the sheet both carry a .28s height transition, which is right for a stop
        // change: they ease on the same curve in opposite directions, so their heights sum to the shell
        // at every frame and no seam ever opens. A SHELL resize is a different animal - `shell.height`
        // lands in one frame while the two children are still easing towards their new heights, and
        // since the map grows downward from the top and the sheet grows upward from the bottom, they
        // stop meeting. Probed on the real commit path (address tapped -> field blurred -> keyboard
        // closes -> visualViewport grows 508->844): a 335px band of bare shell between the map's bottom
        // and the drawer's top, healing over ~175ms in Chromium and lingering far longer on iOS, where
        // the keyboard dismissal is slower. That band is the "blank area below the map" - it was never
        // the drawer's scroll position, which is why D-182/183/184 could not shift it.
        //
        // So: when OUR height actually changes, stand the transitions down for that reflow only. The
        // heights are flushed while the class is on, then the class comes off on the next frame with
        // the values already at their targets, so nothing animates late.
        const px = `${Math.max(240, vh - Math.max(0, top) - navH - 4)}px`;
        const resized = shell.style.height !== px;
        shell.style.height = px;
        if (resized)
            shell.classList.add("resizing");
        if (!wide.matches)
            apply(visiblePx(stop), null);
        else
            shell.style.removeProperty("--mapspace"); // desktop: CSS owns the layout
        if (resized) {
            void shell.offsetHeight; // flush the new child heights with transitions still off
            requestAnimationFrame(() => shell.classList.remove("resizing"));
        }
    };
    // O113 N3 - one drag engine, three surfaces: the grab handle (tap toggles, drag moves -
    // unchanged), the path bar (drag moves the sheet, a tap still opens its step - the surfaces
    // disambiguate on TAP_PX exactly as the handle always has), and the sheet body's swipe-down
    // at scroll-top (below). Release snaps to the stop nearest the VELOCITY-PROJECTED position
    // (projectedStop above), so a flick settles in its own direction.
    let drag = null;
    let samples = [];
    const dragBegin = (y) => {
        drag = { y, vis: visiblePx(stop) };
        samples = [{ y, t: performance.now() }];
        shell.classList.add("dragging");
    };
    const dragMove = (y) => {
        if (!drag)
            return 0;
        samples.push({ y, t: performance.now() });
        if (samples.length > 6)
            samples.shift();
        apply(Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y))), null);
        return Math.abs(y - drag.y);
    };
    const dragEnd = (y, allowTap) => {
        if (!drag)
            return;
        const moved = Math.abs(y - drag.y);
        const vis = Math.min(visiblePx("max"), Math.max(HANDLE_PX, drag.vis - (y - drag.y)));
        drag = null;
        shell.classList.remove("dragging");
        if (allowTap && moved < TAP_PX) {
            const open = restOpen();
            apply(visiblePx(stop === "closed" ? open : "closed"), stop === "closed" ? open : "closed");
            return;
        }
        // release velocity from the recent sample tail (<=120 ms). A degenerate dt (the pinned e2e
        // clock, a single sample) reads as v=0, which projectedStop treats as plain nearest-stop.
        const last = samples[samples.length - 1];
        let first = last;
        for (const s of samples)
            if (last.t - s.t <= 120) {
                first = s;
                break;
            }
        const dt = last.t - first.t;
        const v = dt > 0 && Number.isFinite(dt) ? (first.y - last.y) / dt : 0;
        const next = projectedStop(vis, v, ["closed", "def", "max"].map((s) => [s, visiblePx(s)]));
        apply(visiblePx(next), next);
    };
    grab.addEventListener("pointerdown", (ev) => {
        if (wide.matches)
            return;
        try {
            grab.setPointerCapture(ev.pointerId);
        }
        catch { /* synthetic pointer - fine uncaptured */ }
        dragBegin(ev.clientY);
    });
    grab.addEventListener("pointermove", (ev) => { if (drag)
        dragMove(ev.clientY); });
    const release = (ev) => dragEnd(ev.clientY, true);
    grab.addEventListener("pointerup", release);
    grab.addEventListener("pointercancel", release);
    // the path bar is part of the drawer's face: dragging it moves the sheet (O113 N3). No pointer
    // capture until a real drag, so a plain tap reaches the step buttons exactly as before; after
    // a drag the trailing click is swallowed once so the release never opens a step.
    {
        const path = $("pathbar");
        let pathDrag = false;
        path?.addEventListener("pointerdown", (ev) => {
            if (wide.matches)
                return;
            pathDrag = false;
            dragBegin(ev.clientY);
        });
        path?.addEventListener("pointermove", (ev) => {
            if (!drag)
                return;
            if (dragMove(ev.clientY) >= TAP_PX && !pathDrag) {
                pathDrag = true;
                try {
                    path.setPointerCapture(ev.pointerId);
                }
                catch { /* synthetic - fine uncaptured */ }
            }
        });
        const pathUp = (ev) => {
            if (!drag)
                return;
            const was = pathDrag;
            pathDrag = false;
            dragEnd(ev.clientY, false); // never the toggle-tap: taps here belong to the step buttons
            if (was)
                path.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
        };
        path?.addEventListener("pointerup", pathUp);
        path?.addEventListener("pointercancel", pathUp);
    }
    // Safety net (maintainer: the sheet "often gets stuck"). If the handle's pointerup is missed - the
    // finger lifts off the handle, or capture was never granted - `drag` would stay set and the sheet
    // freeze mid-drag. Catch the release at the window level; the grab handler already ran if it could,
    // so this only fires when it didn't (drag still set).
    window.addEventListener("pointerup", (ev) => { if (drag)
        release(ev); });
    window.addEventListener("pointercancel", (ev) => { if (drag)
        release(ev); });
    // O113 N3: swipe DOWN on the sheet body with its scroll at the top = the universal dismiss.
    // A non-passive touchmove claims the gesture ONLY where native scroll would be a no-op (the
    // finger moving down while scrollTop is already 0), so real content scrolling - including the
    // adaptive lift it drives - never fights the sheet. Touch events, not pointer events, because
    // claiming means preventDefault() on the scroll itself.
    {
        let bodyClaim = null;
        const sheetBody = $("sheetbody");
        sheetBody?.addEventListener("touchstart", (ev) => {
            bodyClaim = (!wide.matches && !document.body.classList.contains("plan-browse")
                && ev.touches.length === 1 && sheetBody.scrollTop <= 0)
                ? { y: ev.touches[0].clientY, own: false } : null;
        }, { passive: true });
        sheetBody?.addEventListener("touchmove", (ev) => {
            if (!bodyClaim || ev.touches.length !== 1)
                return;
            const y = ev.touches[0].clientY;
            if (!bodyClaim.own) {
                const dy = y - bodyClaim.y;
                if (dy > 8 && sheetBody.scrollTop <= 0) {
                    bodyClaim.own = true;
                    dragBegin(bodyClaim.y);
                }
                else if (dy < -4) {
                    bodyClaim = null;
                    return;
                } // a real content scroll - not ours
                else
                    return;
            }
            ev.preventDefault();
            dragMove(y);
        }, { passive: false });
        const bodyRelease = (ev) => {
            if (bodyClaim?.own && drag)
                dragEnd(ev.changedTouches[0]?.clientY ?? drag.y, false);
            bodyClaim = null;
        };
        sheetBody?.addEventListener("touchend", bodyRelease);
        sheetBody?.addEventListener("touchcancel", bodyRelease);
    }
    grab.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ")
            return;
        ev.preventDefault();
        const next = stop === "closed" ? restOpen() : "closed";
        apply(visiblePx(next), next);
    });
    // --- the workflow steps (D-079 slice 3): one open at a time; opening a step lifts the
    // sheet to its max stop (mobile) and scrolls the step to the top of the panel; "Continue"
    // buttons walk the flow top to bottom. Replaces the removed D-028 onboarding strip.
    const steps = Array.from(document.querySelectorAll("#sheetbody details.step"));
    const body = $("sheetbody");
    // "Your ground" (the map bed editor) and "Configurable Bed" (its plant layout + save) are worked
    // together: you reposition/rotate a bed on the map, then re-save its planting. Opening one must NOT
    // close the other, or the bed selection + save menu vanish the moment you touch the map (walkthrough
    // round 26). Every OTHER step still collapses to one-at-a-time.
    const companions = new Set(["sec-ground", "step-mybed"]);
    const paired = (a, b) => companions.has(a) && companions.has(b);
    // Browse vs edit (round 7, the framed-map decision): the handoff's 1b reads Plan as a
    // scrolling page - path bar, a framed washed map panel, the step card - EXCEPT while working
    // the ground, where the full-bleed map + sheet shell (and every behavior pinned on it -
    // stops, paint collapse, keyboard sizing) is exactly what you want. The ground-editing steps
    // are the same pair the one-at-a-time toggle already special-cases as companions.
    // Where is a MAP step too (walk round 3, maintainer): its whole job is the address and the pin,
    // so it gets the full-bleed map - the framed browse preview with the edit-ground pill on it was
    // exactly the clutter being asked off this tab. `locating` marks the mode so the map switches to
    // pin behavior and the CSS hides every bed-editing overlay (notices, hints, layer chips).
    const EDIT_STEPS = ["sec-ground", "step-mybed", "step-where"];
    const updateMode = () => {
        const editing = EDIT_STEPS.some((id) => document.getElementById(id)?.open);
        const was = document.body.classList.contains("plan-edit");
        document.body.classList.toggle("plan-edit", editing);
        document.body.classList.toggle("plan-browse", !editing);
        document.body.classList.toggle("locating", !!document.getElementById("step-where")?.open);
        // The map RENDERS differently per mode (the locate pin, the grid-mode invite), so a step
        // change must repaint it - nothing else guaranteed that, which is how a Where pin could
        // survive onto the Your-ground map (walk round 6). The CSS gate handles the paint race;
        // this keeps the DOM itself honest. A window event, not an import: this module is
        // deliberately dependency-free, and the map already listens on this channel (gg-bed-saved).
        window.dispatchEvent(new Event("gg-step-changed"));
        document.body.classList.remove("map-showcase"); // the save reveal ends when the flow moves on
        // entering the sheet shell from a SCROLLED browse page: the page scroll must reset first
        // (round 11, maintainer: "design your own bed" opened at the bottom of the page) - the
        // shell is sized from its on-screen top, and a stale scroll put it below the fold. The
        // sheet-era invariant is scrollY = 0; restore it on the way in.
        if (editing && !was)
            window.scrollTo(0, 0);
        size();
    };
    // The save reveal (round 10, maintainer): saving a team or a designed bed opens the map up -
    // edit mode drops the sheet to its handle (full map + the planted result); browse mode grows
    // the framed panel and brings it into view. Initial state only; everything stays adjustable.
    window.addEventListener("gg-bed-saved", (ev) => {
        if (wide.matches)
            return;
        // A BED save ends on the RECEIPT (walk round 8, maintainer): "a bed is saved, and then the
        // user sees the Bought messaging, and the Continue button". Collapsing to the handle - right
        // for a team save, which has a planted map to show - left a bed-saver staring at the map with
        // their next step three screens down inside a closed sheet. So: open the sheet to its
        // map-first stop and scroll the receipt to the top of it, Continue following underneath.
        if (ev.detail?.kind === "bed" && document.body.classList.contains("plan-edit")) {
            const land = (final) => {
                // the BED ROW is the anchor (round 9): the bed you just made reads first, then the
                // receipt below it, then Continue. Fall back to the receipt if the list is somehow empty.
                const list = document.getElementById("arealist");
                const target = list && list.children.length ? list : document.getElementById("earned-ground");
                if (!target || target.hidden)
                    return;
                const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top;
                // the FINAL pass is instant and conditional (O43, measured 2026-08-05): a smooth scroll
                // started while the sheet's height transition is still reflowing can be CANCELLED by that
                // reflow - roughly one save in a dozen ended with scrollTop 0 and the receipt 360 px
                // below the fold, nothing left to correct it. If the smooth passes landed, this one sees
                // the anchor already at the top and does nothing; if they were eaten, it jumps, because
                // an instant scroll cannot be cancelled mid-flight.
                if (final && top >= -8 && top <= 80)
                    return;
                claim("prog", 900); // ours: this scroll must not trip the adaptive lift
                body.scrollTo({ top: top + body.scrollTop - 6, behavior: final ? "auto" : "smooth" });
            };
            // the TALL stop for this beat: at the map-first stop the receipt fits but Continue does
            // not, and the whole point is seeing both (measured - Continue sat 170 px below the fold).
            apply(visiblePx("max"), "max");
            // twice, like the step scroller: the sheet's height transition and the freshly rendered
            // bed row both move the target, so the second pass lands on settled geometry
            setTimeout(land, 120);
            setTimeout(land, 480);
            setTimeout(() => land(true), 1000);
            return;
        }
        if (document.body.classList.contains("plan-edit")) {
            apply(visiblePx("closed"), "closed");
        }
        else {
            // ONE motion (walk round 6, maintainer): the class goes on first so the map's growth and
            // the scroll animate together and finish together, then a single smooth scroll to the top.
            // Round 5 had to jump instantly and re-assert because the open team card's own
            // snap-into-view was scrolling the other way mid-flight; that competing scroll now stands
            // down while the showcase runs (plan.ts), so the smooth scroll survives on its own.
            // The late re-assert stays as a SILENT backstop - it only acts if the page is still
            // stranded well after any animation would have finished, so it never cuts a scroll short.
            document.body.classList.add("map-showcase");
            const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
            window.scrollTo({ top: 0, behavior });
            setTimeout(() => {
                if (document.body.classList.contains("map-showcase") && window.scrollY > 8)
                    window.scrollTo(0, 0);
            }, 1200);
        }
    });
    document.getElementById("editground")?.addEventListener("click", () => {
        const g = document.getElementById("sec-ground");
        if (g)
            g.open = true; // the toggle handler flips the mode, lifts the sheet, scrolls
    });
    for (const step of steps) {
        step.addEventListener("toggle", () => {
            // The gardener got here before hydration did: they have chosen a step, so the arrival pick
            // must never run. Set on ANY toggle, including a close, because closing a step is a choice
            // too - and skipped for the app's own pick, which is not the gardener acting.
            if (!silentPick)
                arrived = true;
            updateMode();
            repaintPath?.();
            if (!step.open)
                return;
            // a main step opening leaves extras mode (the aside stack folds away again)
            if (!step.classList.contains("aside"))
                sheet.classList.remove("extras-open");
            for (const other of steps)
                if (other !== step && other.open && !paired(step.id, other.id))
                    other.open = false;
            // A step the APP opened on boot (pickOpeningStep) stops here. Everything below is the
            // response to a deliberate tap - lift the sheet to the phase's stop, then scroll the body to
            // the step - and on arrival both are wrong: the sheet swallows the map the gardener came back
            // to see, and the scroll lands mid-way down a guild card with the header clipped. Caught by
            // LOOKING at it; the DOM assertion said "step-plan is open" and was perfectly happy.
            if (silentPick)
                return;
            // Initial stop per phase (round 9, maintainer): Your ground is MAP work, so it opens with
            // the map on top (the default 40% stop); My bed's canvas lives IN the sheet, so it keeps
            // the tall stop. Initial state only - the handle stays draggable throughout.
            const target = step.id === "sec-ground" || step.id === "step-where" ? "def" : "max";
            if (!wide.matches && visiblePx(stop) !== visiblePx(target))
                apply(visiblePx(target), target);
            // scroll ONLY the sheet body - scrollIntoView would also scroll the page itself
            // (overflow:hidden is still programmatically scrollable) and shove the map toolbar
            // under the sticky header. ABSOLUTE targeting, twice (round 12, maintainer): the sheet
            // height transitions and the closing sibling collapses for ~350ms after open, so a
            // single early relative scroll landed at the bottom of the section - the second pass
            // re-anchors on settled geometry, and absolute math makes it converge.
            const scrollToStep = () => {
                // Claim the scroll as OURS before it starts (maintainer, walk round 7: "the map needs to
                // be prominently displayed on first navigation" to Your ground). This smooth scroll fires
                // scroll events for hundreds of ms, and the adaptive lift below reads a scroll as "the
                // user is working the sheet" and pulls it to the tall stop - so opening Your ground set
                // the map-first 40% stop and then immediately overrode it to 60%, squeezing the map to a
                // quarter of the shell. The stopChangedAt echo guard was too short to cover a smooth
                // scroll issued twice; an explicit window is honest about which scrolls we caused.
                claim("prog", 900);
                body.scrollTo({
                    top: step.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 4,
                    behavior: "smooth",
                });
            };
            setTimeout(scrollToStep, 60);
            setTimeout(scrollToStep, 430);
        });
    }
    for (const btn of document.querySelectorAll("button.stepnext")) {
        btn.addEventListener("click", () => {
            const next = document.getElementById(btn.dataset.next ?? "");
            if (next)
                next.open = true; // the toggle handler closes the rest and scrolls
        });
    }
    // --- the garden path bar (Organic redesign): a horizontal stepper over the SAME step
    // spine - each node mirrors its <details> (done class, open state, stepsum text) and
    // tapping one opens it (the toggle handler above does the closing/lifting/scrolling).
    // The dashed "+" node gathers the aside steps: it toggles .extras-open on the sheet,
    // which reveals the aside stack in the body.
    const pathHost = document.getElementById("pathbar");
    const PATH_MAIN = [["step-where", "Where"], ["sec-ground", "Your ground"], ["step-plan", "Plant teams"]];
    const ASIDE_IDS = ["step-mybed", "sec-addplant", "step-season"];
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    repaintPath = () => {
        if (!pathHost)
            return;
        const nodes = PATH_MAIN.map(([id, label], i) => {
            const el = document.getElementById(id);
            return { id, label, n: i + 1, done: !!el?.classList.contains("done"), open: !!el?.open,
                sum: el?.querySelector(".stepsum")?.textContent ?? "" };
        });
        const extrasActive = sheet.classList.contains("extras-open")
            || ASIDE_IDS.some((id) => document.getElementById(id)?.open);
        let out = "";
        nodes.forEach((nd, i) => {
            if (i) {
                const prev = nodes[i - 1];
                const conn = prev.done && nd.done ? " done" : prev.done && nd.open ? " into" : "";
                out += `<span class="pconn${conn}"></span>`;
            }
            const cls = (nd.done ? " done" : "") + (nd.open ? " current" : "");
            out += `<button type="button" class="pnode${cls}" data-step="${nd.id}"`
                + (nd.open ? ' aria-current="step"' : "")
                + `><span class="pdotc">${nd.done && !nd.open ? CHECK : nd.n}</span>`
                + `<span class="plabel">${esc(nd.label)}</span>`
                + (nd.done && nd.sum ? `<span class="psum">${esc(nd.sum)}</span>` : "")
                + "</button>";
        });
        out += `<span class="pconn${nodes[2].done && extrasActive ? " into" : ""}"></span>`
            + `<button type="button" class="pnode extras${extrasActive ? " current" : ""}" data-extras="1"`
            + (extrasActive ? ' aria-current="step"' : "")
            + '><span class="pdotc">+</span><span class="plabel">extras</span></button>';
        pathHost.innerHTML = out;
        // the peek line (O113 N3): at the handle stop the grab names where the flow stands, so the
        // closed sheet reads as a designed state instead of clipping the step dots mid-glyph
        const peek = document.getElementById("sheetpeek");
        if (peek) {
            const active = nodes.find((nd) => nd.open)?.label ?? (extrasActive ? "extras" : null);
            peek.textContent = active ? `${active} - pull up to continue` : "Plan your garden - pull up";
        }
    };
    pathHost?.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn)
            return;
        if (btn.dataset.extras) {
            sheet.classList.add("extras-open");
            for (const s of steps)
                if (s.open && !s.classList.contains("aside"))
                    s.open = false;
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            repaintPath?.();
            setTimeout(() => {
                const first = document.querySelector(".stepmore");
                if (first) {
                    claim("prog", 900); // ours, not the user's (see the adaptive lift)
                    body.scrollBy({ top: first.getBoundingClientRect().top - body.getBoundingClientRect().top - 4, behavior: "smooth" });
                }
            }, 60);
            return;
        }
        const d = document.getElementById(btn.dataset.step ?? "");
        if (!d)
            return;
        if (d.open) { // reopening the current node just brings it back into view
            if (!wide.matches && visiblePx(stop) < visiblePx("max"))
                apply(visiblePx("max"), "max");
            claim("prog", 900); // ours, not the user's (see the adaptive lift)
            body.scrollBy({ top: d.getBoundingClientRect().top - body.getBoundingClientRect().top - 4, behavior: "smooth" });
        }
        else
            d.open = true; // the toggle handler closes the rest, lifts, scrolls, repaints
    });
    repaintPath();
    // Adaptive intent (walkthrough round 5): using the sheet wants MORE sheet, using the map
    // wants MORE map. Scrolling or typing in the sheet lifts it to the max stop (pointerdown is
    // deliberately NOT a trigger - lifting mid-tap would slide the button out from under the
    // finger); starting any map gesture while the sheet is at max drops it back to the default.
    body.addEventListener("scroll", () => {
        if (stopEcho > 0)
            return; // the stop change's own scroll-clamp echo, not the user
        if (progScroll > 0)
            return; // a step navigation's scroll, not the user's
        if (mapForward)
            return; // the app just handed the map the screen (D-180) - see below
        if (!wide.matches && stop === "def")
            apply(visiblePx("max"), "max");
    }, { passive: true });
    body.addEventListener("focusin", (ev) => {
        if (!wide.matches && stop !== "max")
            apply(visiblePx("max"), "max");
        // bring the focused field near the TOP of the sheet (round 8): with the shell sized to
        // the visual viewport the sheet ends above the keyboard, but the field itself may still
        // sit below the fold - scroll the sheet body, never the page. The delay lets the sheet's
        // height transition and the keyboard's viewport resize land first.
        const field = ev.target;
        if (field && body.contains(field)) {
            setTimeout(() => {
                body.scrollBy({ top: field.getBoundingClientRect().top - body.getBoundingClientRect().top - 12, behavior: "smooth" });
            }, 350);
        }
    });
    document.getElementById("mapsvg")?.addEventListener("pointerdown", () => {
        if (!wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
    });
    // Map priority while a bed awaits saving (round 9, maintainer: "after placing a bed, not
    // enough of the map is shown to move or adjust it prior to saving"). The save card appearing
    // IS the signal that map-work started - drop the sheet to its handle so the map and the save
    // card own the screen; the card hiding (saved or discarded) brings the sheet back to the
    // default stop. Initial state only; the handle stays draggable.
    {
        const savecard = document.getElementById("savecard");
        if (savecard) {
            let lastShowing = !savecard.hidden;
            new MutationObserver(() => {
                const showing = !savecard.hidden;
                if (showing === lastShowing)
                    return; // groundmap re-sets the attribute on redraws
                lastShowing = showing;
                if (wide.matches || !document.body.classList.contains("plan-edit"))
                    return;
                const to = showing ? "closed" : "def";
                apply(visiblePx(to), to);
            }).observe(savecard, { attributes: true, attributeFilter: ["hidden"] });
        }
    }
    // Painting wants the WHOLE map (maintainer: entering the tile tool lifted the sheet and obscured the
    // ground being painted). The map dispatches this on entering paint mode - drop the sheet to its
    // handle so the drawing surface is unobscured; the user pulls it back up when ready to save.
    window.addEventListener("gg-sheet-collapse", () => {
        if (!wide.matches)
            apply(visiblePx("closed"), "closed");
    });
    // Committing an address wants MORE MAP (D-177, maintainer): entering the location lifts the sheet to
    // `max` (focusin) so the field clears the keyboard, but once the pin drops the user's job is to
    // check and drag it - so hand the map back its room. Drop to the default stop (map 0.6, the step
    // still visible below), not the paint collapse. app.ts fires this after applyAddr blurs the field.
    // Committing an address is the signal that MAP work has started - the pin just dropped and the
    // user's job is to check and drag it (D-177, maintainer: the map should get the room). This is the
    // same ruling as round 9's bed-save ("after placing a bed, not enough of the map is shown to adjust
    // it"), and it takes the same answer: drop the sheet to its HANDLE so the map and pin own the
    // screen; the user pulls it back up to continue. `closed` is also the only map-forward stop the
    // adaptive lift never fights (it bounces only from `def`), so it holds where a `def` drop did not.
    // Committing an address hands the map the screen at the DEFAULT stop (D-180, maintainer's
    // screenshot): map ~60% with the step row, heading and address field still readable underneath -
    // the pin is big enough to check and drag, and the flow is still visible. D-177 used the handle
    // stop (`closed`) only because a `def` drop kept getting bounced back to `max`: the located reflow
    // fires a body scroll and the adaptive lift ("using the sheet wants more sheet") read it as user
    // intent. `mapForward` (declared with the other intent flags above) is the honest fix - it marks
    // "the APP chose this stop", so reflow scrolls cannot undo it, while any real touch on the sheet
    // clears it and hands control straight back.
    window.addEventListener("gg-sheet-map", () => {
        if (wide.matches)
            return;
        mapForward = true;
        if (visiblePx(stop) > visiblePx("def"))
            apply(visiblePx("def"), "def");
    });
    // A genuine gesture on the sheet is the user taking over - stop protecting the stop.
    for (const el of [body, grab])
        el.addEventListener("pointerdown", () => { mapForward = false; }, { passive: true });
    // Condensed header (walkthrough round 6): on the Plan route the header shrinks to the
    // brand + a "menu" pill so the map and sheet get the room. Tapping the pill expands the
    // full header (nav, units, account); going back to work - touching the map, scrolling the
    // sheet, grabbing the handle - condenses it again. Pure class toggling: the CSS hides the
    // header pieces only while `page-plan` is visible AND `.expanded` is absent, so every
    // other route keeps the full header untouched. The ResizeObserver below already watches
    // the header, so the shell re-measures itself on each toggle.
    const hdr = document.querySelector("header.site");
    let expandedAt = 0; // expanding re-layouts the shell, which can clamp the sheet's scroll
    // position and fire a synthetic scroll - don't let that instantly undo the tap
    document.getElementById("hdrtoggle")?.addEventListener("click", () => {
        hdr?.classList.add("expanded");
        expandedAt = Date.now();
    });
    const condense = () => hdr?.classList.remove("expanded");
    // pointerdowns are always real user intent - condense immediately
    document.getElementById("mapsvg")?.addEventListener("pointerdown", condense);
    grab.addEventListener("pointerdown", condense);
    // scrolls can be synthetic (the clamp above) - honour them only outside the grace window
    body.addEventListener("scroll", () => {
        if (Date.now() - expandedAt > 600)
            condense();
    }, { passive: true });
    window.addEventListener("resize", size);
    window.visualViewport?.addEventListener("resize", size); // the on-screen keyboard fires this
    wide.addEventListener("change", size);
    // the shell measures 0 while another route hides the section - re-measure on arrival, and reset
    // the resting default (taller while still unlocated) so arriving on Plan opens to the right height
    window.addEventListener("hashchange", () => setTimeout(() => { stop = restOpen(); size(); }, 60));
    // The Plan route never body-scrolls by design (the sheet and map scroll themselves), but
    // browsers still scroll the page programmatically - focusing an input under the on-screen
    // keyboard is the classic one - which shoves the map toolbar under the sticky header.
    // Undo any stray page scroll while Plan is the active route.
    window.addEventListener("scroll", () => {
        // browse mode (round 8): the page is MEANT to scroll - this reset is for the sheet shell
        // only, where a stray programmatic scroll shoves the map toolbar under the header
        if (!wide.matches && document.body.classList.contains("plan-browse"))
            return;
        if (!document.getElementById("page-plan")?.hidden && window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    }, { passive: true });
    // whatever sits above the shell (a wrapping header) moves its top - re-measure when it
    // resizes. size() is idempotent, so the loop settles at once.
    //
    // THE BANNERS COUNT (maintainer, 2026-07-31): #examplebanner and #draftbanner live above the
    // shell in <main> and appear/disappear on their own schedule. Removing the example garden hid
    // an 89 px banner, which moved the shell's TOP up while its stored HEIGHT stayed - leaving
    // exactly that gap of page background below the sheet (the reported black bar), until any
    // other resize path healed it (switching tabs). Observing them closes the class of bug, not
    // just the one repro: a ResizeObserver reports a 0x0 box when an element goes display:none,
    // so hide and show both re-measure.
    const above = new ResizeObserver(() => size());
    const header = document.querySelector("header.site");
    if (header)
        above.observe(header);
    for (const id of ["examplebanner", "draftbanner"]) {
        const el = document.getElementById(id);
        if (el)
            above.observe(el);
    }
    stop = restOpen(); // open taller on first load while there's no location yet (round 20)
    updateMode(); // browse vs edit from the initially-open step (round 7)
    setTimeout(size, 0);
    // When the user finishes locating (lat+lon land, the map fills in), relax a sheet still resting at
    // the tall unlocated default down to 40% so the now-useful map is revealed. Driven from the plan's
    // draw() via updateStepStates (same module) so we react to the real located flag, not a guess.
    onLocated = (located) => {
        if (located && !wide.matches && stop === "max")
            apply(visiblePx("def"), "def");
    };
}
// Bridge from updateStepStates (called each plan draw) to the sheet controller: the located flag
// crossing to true relaxes the tall unlocated default. Module-level so the two exports share it.
let onLocated = null;
let wasLocated = false;
// The garden path bar's renderer (assigned in initSheet) - updateStepStates repaints it after
// writing the step summaries, so the bar always mirrors the spine.
let repaintPath = null;
/** One step's summary chip + done badge. done=null leaves the badge number as-is. */
// THE OPENING STEP (maintainer, 2026-08-01: the example garden opens on "Where").
//
// `step-where` is `open` in the markup and nothing ever re-picked it, so EVERY load opened on step
// one - including a garden that is already located. The example garden made it obvious because the
// map behind the sheet is showing a planted bed in zone 6a while the sheet asks "type your address":
// the app requesting something it is simultaneously displaying. It was never example-specific
// though - a returning gardener with a located plot and a saved bed got the same, which is the more
// costly half, because they meet it on every single visit.
//
// The rule is "the first step that is not done yet": nothing given -> Where, located but no bed ->
// Your ground, a garden that has both -> Plant teams, which is the work that remains. Plant teams is
// never marked done (it has no completion state), so a complete garden lands there and stays.
//
// THIS RUNS DURING ARRIVAL ONLY, and "arrival" is an explicit signal rather than a guess.
//
// Two failed attempts are worth recording, because each was wrong in an instructive way. Picking
// ONCE at boot reads `areaCount` before the log has hydrated and lands a returning gardener on
// "size or trace a bed" when they already have three. Picking on EVERY draw fixes that and breaks
// something worse: the moment a visitor finishes typing their address, `located` flips and the
// picker closes the Where step while they are still checking their pin on the map. The e2e `where`
// scenario is that flow, and it went red on exactly those two checks.
//
// The second fix attempt ended arrival at the first pointer or keystroke. It works for a human and
// NOT for the suite, which drives the address field by setting `.value` and dispatching events - so
// the behaviour would have differed between a real user and every test of it. This file already
// warns about precisely that trap (see the counter/Date.now note above): a mechanism that cannot be
// exercised by a test is a mechanism nobody can check.
//
// So the app SAYS when arrival is over: `endArrival()` is called once the log has hydrated, which
// is the moment the state driving the pick stops changing underneath it. Identical for a user and a
// test, and there is nothing to time out.
let arrived = false;
let lastSeen = { located: false, areaCount: 0 };
/** The garden has finished loading: choose the opening step, ONCE, from the state as of now.
 *
 *  Once, not "until a signal" - that distinction is the whole fix. A picker that keeps correcting
 *  has to be right about every later state change too, and it never was: `where4` sets a latitude
 *  and longitude directly, `located` flips, and a still-armed picker closed the Where step while
 *  the scenario was mid-drag of the map pin. The pin went with the step and the run died querying
 *  it. That is the same fault as closing the step under someone typing their address, surviving in
 *  the window before hydration finished.
 *
 *  Firing exactly once removes the window rather than narrowing it. Called by app.ts when setupLog
 *  resolves, and short-circuited by the toggle handler if the gardener got there first. */
export function endArrival() {
    if (arrived)
        return;
    arrived = true;
    pickOpeningStep(lastSeen.located, lastSeen.areaCount);
}
// True only while pickOpeningStep is assigning `open`, so the toggle handler can tell the app's
// own act apart from the gardener's and skip the lift-and-scroll meant for a tap.
let silentPick = false;
/** Keep the page at the top for a beat after the app opens a step by itself, and stop the moment
 *  the gardener touches anything.
 *
 *  `silentPick` stops the SHEET reacting to a programmatic open, but the cascade runs one layer
 *  further: opening Plant teams renders the guild list, a card in it is open, and that card's own
 *  toggle scrolls itself into view (plan.ts) - correct when you tap a card, wrong when you have
 *  just arrived, and it left a returning gardener looking at the middle of a Three Sisters card
 *  with their map scrolled off the top. Measured, not guessed: window.scrollY went 0 -> 329 -> 578
 *  while the sheet's own body never moved.
 *
 *  Rather than teach every downstream toggle what a programmatic open is, hold the viewport where
 *  arrival should leave it. Bounded to ~1.2s, and cancelled by the first pointer, wheel, touch or
 *  key - so it can never fight someone who starts scrolling. Same shape as the map-showcase guard
 *  above, which holds the top for exactly the same reason. */
function holdTopBriefly(ms = 1200) {
    if (typeof window === "undefined")
        return;
    const events = ["pointerdown", "wheel", "touchstart", "keydown"];
    const tick = window.setInterval(() => { if (window.scrollY > 0)
        window.scrollTo(0, 0); }, 50);
    const stop = () => {
        window.clearInterval(tick);
        window.clearTimeout(end);
        for (const e of events)
            window.removeEventListener(e, stop);
    };
    const end = window.setTimeout(stop, ms);
    for (const e of events)
        window.addEventListener(e, stop, { once: true, passive: true });
}
function pickOpeningStep(located, areaCount) {
    const want = !located ? "step-where" : areaCount > 0 ? "step-plan" : "sec-ground";
    const target = document.getElementById(want);
    if (!target || target.open)
        return;
    for (const id of ["step-where", "sec-ground", "step-plan"]) {
        const el = document.getElementById(id);
        if (el && el !== target && el.open)
            el.open = false;
    }
    // `silentPick` also stops the toggle handler recording this as the gardener choosing a step -
    // it is the app's own act, and the two must not be confused.
    silentPick = true;
    target.open = true;
    silentPick = false;
    holdTopBriefly();
}
function setStep(id, done, summary) {
    const step = document.getElementById(id);
    if (!step)
        return;
    const sum = step.querySelector(".stepsum");
    if (sum)
        sum.textContent = summary;
    if (done != null) {
        step.classList.toggle("done", done);
        const badge = step.querySelector(".badge");
        if (badge) {
            if (!badge.dataset.n)
                badge.dataset.n = badge.textContent ?? "";
            badge.textContent = done ? "" : badge.dataset.n;
        }
    }
}
/** Refresh every step's summary/done state. Called at the end of each Plan draw() - the
 *  explicit inputs come from the draw's own resolution; the counts for the later steps are
 *  read from what the renderers just wrote. */
export function updateStepStates(s) {
    // Relax the tall unlocated sheet the moment locating succeeds (round 20) - only on the crossing to
    // located, so a user who deliberately lifts the sheet after locating isn't yanked back each draw.
    if (s.located && !wasLocated)
        onLocated?.(true);
    wasLocated = s.located;
    lastSeen = { located: s.located, areaCount: s.areaCount };
    setStep("step-where", s.located, s.located ? (s.zoneLabel ? `located · zone ${s.zoneLabel}` : "located") : "set your location");
    // "bed", not "area traced" (phase B): a dimension bed was sized, never traced - the summary
    // must be true for both ways a bed comes to exist.
    setStep("sec-ground", s.areaCount > 0, s.areaCount ? `${s.areaCount} bed${s.areaCount === 1 ? "" : "s"}` : "size or trace a bed");
    // Required-action callouts (round 8, maintainer): each gating step SAYS what unlocks the next
    // one, prominently, until it's done - same inputs that mark the step done above.
    const need = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = met;
    };
    need("need-where", s.located);
    need("need-ground", s.areaCount > 0);
    // The receipt (earned planner phase A): a done step states what the fact BOUGHT - the callout's
    // mirror image. Same inputs, opposite visibility.
    const earned = (id, met) => {
        const el = document.getElementById(id);
        if (el)
            el.hidden = !met;
    };
    earned("earned-where", s.located);
    earned("earned-ground", s.areaCount > 0);
    // the Where receipt carries the climate headline (declutter round) - the one line that
    // replaced the card: zone, median last frost, season length, and where the rest went
    if (s.located) {
        const bits = [
            s.zoneLabel ? `zone ${s.zoneLabel}` : null,
            s.frostP50 ? `last frost usually ${s.frostP50}` : null,
            s.seasonDays != null ? `season ~${s.seasonDays} days` : null,
        ].filter(Boolean).join(" · ");
        const el = document.getElementById("earned-where");
        if (el)
            el.textContent = bits
                ? `Located. ${bits} - your dates are live everywhere (the full climate card is on the Calendar).`
                : "Located - your dates are live everywhere (the full climate card is on the Calendar).";
    }
    // `> .guild`, not `article.guild` (phase B repair): the D-084 collapsible cards are <details>,
    // so the old article selector counted zero forever and this summary rendered BLANK. Top-level
    // only - nested variant cards inside a parent's body must not inflate the count.
    const fit = document.querySelectorAll("#guilds > .guild.fits").length;
    const total = document.querySelectorAll("#guilds > .guild").length;
    setStep("step-plan", null, total ? `${fit} of ${total} teams fit` : "");
    setStep("step-mybed", null, s.myBedCount ? `${s.myBedCount} plant${s.myBedCount === 1 ? "" : "s"}` : "");
    const ups = document.querySelectorAll("#uplist .upitem").length; // plant rows only (skips the empty-state hint)
    setStep("sec-addplant", null, ups ? `${ups} added` : "");
    repaintPath?.();
}
