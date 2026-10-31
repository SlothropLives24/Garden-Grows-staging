function seatNext(phase, ev, motion) {
    if (ev === "user" || ev === "expire" || ev === "supersede")
        return { phase: "done", act: null };
    switch (phase) {
        case "waiting":
            if (ev === "settled")
                return motion === "smooth" ? { phase: "flight", act: "seat" } : { phase: "hold", act: "seat" };
            return { phase: "waiting", act: null };
        case "flight":
            if (ev === "landed")
                return { phase: "hold", act: "correct" };
            return { phase: "flight", act: null };
        case "hold":
            if (ev === "reflow" || ev === "settled")
                return { phase: "hold", act: "correct" };
            return { phase: "hold", act: null };
        case "done":
            return { phase: "done", act: null };
    }
}
let settling = () => false;
let settledEvent = "gg-sheet-settled";
function bindSettling(isSettling, event = "gg-sheet-settled") {
    settling = isSettling;
    settledEvent = event;
}
const live = new Map();
const own = new Map();
const isWin = (s) => typeof Window !== "undefined" && s instanceof Window;
const scrollTopOf = (s) => (isWin(s) ? s.scrollY : s.scrollTop);
const viewOf = (s) => {
    if (isWin(s))
        return { top: 0, bottom: s.innerHeight, height: s.innerHeight };
    const r = s.getBoundingClientRect();
    return { top: r.top + s.clientTop, bottom: r.top + s.clientTop + s.clientHeight, height: s.clientHeight };
};
const maxScroll = (s) => isWin(s)
    ? Math.max(0, document.documentElement.scrollHeight - s.innerHeight)
    : Math.max(0, s.scrollHeight - s.clientHeight);
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function ownScroll(s) { return (own.get(s) ?? 0) > 0; }
function claimOwn(s, ms) {
    own.set(s, (own.get(s) ?? 0) + 1);
    setTimeout(() => own.set(s, Math.max(0, (own.get(s) ?? 0) - 1)), ms);
}
function scrollerFor(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1)
            return p;
    }
    return window;
}
function goal(s) {
    const cur = scrollTopOf(s.scroller);
    if (s.target === "top")
        return 0;
    const el = typeof s.target === "function" ? s.target() : s.target;
    if (!el || !el.isConnected || el.hidden)
        return null;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0)
        return null;
    const v = viewOf(s.scroller);
    let want;
    if (s.opts.block === "nearest") {
        if (r.top >= v.top && r.bottom <= v.bottom)
            return cur;
        want = r.top < v.top ? cur + (r.top - v.top) - s.opts.offset : cur + (r.bottom - v.bottom) + s.opts.offset;
    }
    else if (s.opts.block === "center") {
        want = cur + (r.top - v.top) - Math.max(0, (v.height - r.height) / 2);
    }
    else {
        want = cur + (r.top - v.top) - s.opts.offset;
    }
    return Math.max(0, Math.min(maxScroll(s.scroller), Math.round(want)));
}
function scrollTo(s, top, motion) {
    claimOwn(s.scroller, motion === "smooth" ? 900 : 300);
    const behavior = motion === "smooth" ? "smooth" : "auto";
    if (isWin(s.scroller))
        s.scroller.scrollTo({ top, behavior });
    else
        s.scroller.scrollTo({ top, behavior });
}
function end(s, ev) {
    if (s.phase === "done")
        return;
    s.phase = seatNext(s.phase, ev, s.opts.motion).phase;
    cancelAnimationFrame(s.raf);
    for (const c of s.cleanup.splice(0))
        c();
    if (live.get(s.scroller) === s)
        live.delete(s.scroller);
}
function feed(s, ev) {
    if (s.phase === "done")
        return;
    const before = s.phase;
    const { phase, act } = seatNext(s.phase, ev, s.opts.motion);
    if (phase === "done") {
        end(s, ev);
        return;
    }
    s.phase = phase;
    if (act === "seat") {
        const top = goal(s);
        const cur = scrollTopOf(s.scroller);
        const moved = top != null && Math.abs(top - cur) > 2;
        if (moved)
            scrollTo(s, top, s.opts.motion);
        if (phase === "flight")
            armFlight(s, moved);
    }
    else if (act === "correct") {
        const top = goal(s);
        if (top != null && Math.abs(top - scrollTopOf(s.scroller)) > 2)
            scrollTo(s, top, "instant");
    }
    if (phase === "hold" && before !== "hold")
        armHold(s);
}
function armFlight(s, moved) {
    if (!moved) {
        feed(s, "landed");
        return;
    }
    const tgt = isWin(s.scroller) ? document : s.scroller;
    let done = false;
    const landed = () => { if (!done) {
        done = true;
        feed(s, "landed");
    } };
    if ("onscrollend" in window) {
        tgt.addEventListener("scrollend", landed, { once: true });
        s.cleanup.push(() => tgt.removeEventListener("scrollend", landed));
    }
    else {
        let last = scrollTopOf(s.scroller), still = 0;
        const tick = setInterval(() => {
            const now = scrollTopOf(s.scroller);
            still = now === last ? still + 1 : 0;
            last = now;
            if (still >= 2) {
                clearInterval(tick);
                landed();
            }
        }, 50);
        s.cleanup.push(() => clearInterval(tick));
    }
    const cap = setTimeout(landed, 900);
    s.cleanup.push(() => clearTimeout(cap));
}
function armHold(s) {
    const reflow = () => {
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(() => { s.raf = 0; feed(s, "reflow"); });
    };
    const root = isWin(s.scroller) ? document.body : s.scroller;
    const mo = new MutationObserver(reflow);
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "open", "class", "style"] });
    s.cleanup.push(() => mo.disconnect());
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(reflow);
        if (!isWin(s.scroller))
            ro.observe(s.scroller);
        const el = typeof s.target === "function" ? s.target() : s.target;
        if (el && el !== "top")
            ro.observe(el);
        s.cleanup.push(() => ro.disconnect());
    }
    const st = isWin(s.scroller) ? window : s.scroller;
    st.addEventListener("scroll", reflow, { passive: true });
    s.cleanup.push(() => st.removeEventListener("scroll", reflow));
    window.addEventListener(settledEvent, reflow);
    s.cleanup.push(() => window.removeEventListener(settledEvent, reflow));
    window.visualViewport?.addEventListener("resize", reflow);
    s.cleanup.push(() => window.visualViewport?.removeEventListener("resize", reflow));
    const expire = setTimeout(() => { if (s.raf)
        feed(s, "reflow"); feed(s, "expire"); }, s.opts.hold);
    s.cleanup.push(() => clearTimeout(expire));
}
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
function seat(scroller, target, o = {}) {
    const cur = live.get(scroller);
    if (cur && cur.opts.protect && cur.phase !== "done" && !o.force)
        return false;
    if (cur)
        end(cur, "supersede");
    const motion = o.motion === "smooth" && !reduced() ? "smooth" : "instant";
    const s = {
        scroller, target, phase: "waiting", cleanup: [], raf: 0,
        opts: { offset: 0, block: "start", hold: 1000, protect: false, ...o, motion },
    };
    live.set(scroller, s);
    const cancel = o.cancelOn ?? (isWin(scroller) ? ["pointerdown", "wheel", "touchstart", "keydown"] : ["pointerdown", "wheel", "touchstart"]);
    const tgt = isWin(scroller) ? window : scroller;
    const onUser = (ev) => {
        if (ev.type === "keydown" && !isWin(scroller) && !NAV_KEYS.has(ev.key))
            return;
        feed(s, "user");
    };
    for (const ev of cancel) {
        tgt.addEventListener(ev, onUser, { passive: true, capture: true });
        s.cleanup.push(() => tgt.removeEventListener(ev, onUser, { capture: true }));
    }
    if (motion === "instant" || !settling()) {
        feed(s, "settled");
    }
    else {
        const onSettled = () => feed(s, "settled");
        window.addEventListener(settledEvent, onSettled, { once: true });
        s.cleanup.push(() => window.removeEventListener(settledEvent, onSettled));
        const cap = setTimeout(onSettled, 700);
        s.cleanup.push(() => clearTimeout(cap));
    }
    return true;
}

var n$1,l$1,u$1,i$1,r$1,o$1,e$1,f$1,c$1,a$1,s$1,h$1,p$1,v$1,d$1={},w$1=[],_=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,g=Array.isArray;function m$1(n,l){for(var u in l)n[u]=l[u];return n}function b(n){n&&n.parentNode&&n.parentNode.removeChild(n);}function k$1(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n$1.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps) void 0===e[o]&&(e[o]=l.defaultProps[o]);return x(l,e,i,r,null)}function x(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++u$1:o,__i:-1,__u:0};return null==o&&null!=l$1.vnode&&l$1.vnode(e),e}function S(n){return n.children}function C$1(n,l){this.props=n,this.context=l;}function $(n,l){if(null==l)return n.__?$(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?$(n):null}function I(n){if(n.__P&&n.__d){var u=n.__v,t=u.__e,i=[],r=[],o=m$1({},u);o.__v=u.__v+1,l$1.vnode&&l$1.vnode(o),q(n.__P,o,u,n.__n,n.__P.namespaceURI,32&u.__u?[t]:null,i,null==t?$(u):t,!!(32&u.__u),r),o.__v=u.__v,o.__.__k[o.__i]=o,D$1(i,o,r),u.__e=u.__=null,o.__e!=t&&P(o);}}function P(n){if(null!=(n=n.__)&&null!=n.__c)return n.__e=n.__c.base=null,n.__k.some(function(l){if(null!=l&&null!=l.__e)return n.__e=n.__c.base=l.__e}),P(n)}function A(n){(!n.__d&&(n.__d=true)&&i$1.push(n)&&!H.__r++||r$1!=l$1.debounceRendering)&&((r$1=l$1.debounceRendering)||o$1)(H);}function H(){try{for(var n,l=1;i$1.length;)i$1.length>l&&i$1.sort(e$1),n=i$1.shift(),l=i$1.length,I(n);}finally{i$1.length=H.__r=0;}}function L(n,l,u,t,i,r,o,e,f,c,a){var s,h,p,v,y,_,g,m=t&&t.__k||w$1,b=l.length;for(f=T(u,l,m,f,b),s=0;s<b;s++)null!=(p=u.__k[s])&&(h=-1!=p.__i&&m[p.__i]||d$1,p.__i=s,_=q(n,p,h,i,r,o,e,f,c,a),v=p.__e,p.ref&&h.ref!=p.ref&&(h.ref&&J(h.ref,null,p),a.push(p.ref,p.__c||v,p)),null==y&&null!=v&&(y=v),(g=!!(4&p.__u))||h.__k===p.__k?(f=j$1(p,f,n,g),g&&h.__e&&(h.__e=null)):"function"==typeof p.type&&void 0!==_?f=_:v&&(f=v.nextSibling),p.__u&=-7);return u.__e=y,f}function T(n,l,u,t,i){var r,o,e,f,c,a=u.length,s=a,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?("string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?o=n.__k[r]=x(null,o,null,null,null):g(o)?o=n.__k[r]=x(S,{children:o},null,null,null):void 0===o.constructor&&o.__b>0?o=n.__k[r]=x(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):n.__k[r]=o,f=r+h,o.__=n,o.__b=n.__b+1,e=null,-1!=(c=o.__i=O(o,u,f,s))&&(s--,(e=u[c])&&(e.__u|=2)),null==e||null==e.__v?(-1==c&&(i>a?h--:i<a&&h++),"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(s)for(r=0;r<a;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=$(e)),K(e,e));return t}function j$1(n,l,u,t){var i,r;if("function"==typeof n.type){for(i=n.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=n,l=j$1(i[r],l,u,t));return l}n.__e!=l&&(t&&(l&&n.type&&!l.parentNode&&(l=$(n)),u.insertBefore(n.__e,l||null)),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8==l.nodeType);return l}function O(n,l,u,t){var i,r,o,e=n.key,f=n.type,c=l[u],a=null!=c&&0==(2&c.__u);if(null===c&&null==e||a&&e==c.key&&f==c.type)return u;if(t>(a?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;)if(null!=(c=l[o=i>=0?i--:r++])&&0==(2&c.__u)&&e==c.key&&f==c.type)return o;return  -1}function z$1(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||_.test(l)?u:u+"px";}function N(n,l,u,t,i){var r,o;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||z$1(n.style,l,"");if(u)for(l in u)t&&u[l]==t[l]||z$1(n.style,l,u[l]);}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(s$1,"$1")),o=l.toLowerCase(),l=o in n||"onFocusOut"==l||"onFocusIn"==l?o.slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u[a$1]=t[a$1]:(u[a$1]=h$1,n.addEventListener(l,r?v$1:p$1,r)):n.removeEventListener(l,r?v$1:p$1,r);else {if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||false===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function V(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u[c$1])u[c$1]=h$1++;else if(u[c$1]<t[a$1])return;return t(l$1.event?l$1.event(u):u)}}}function q(n,u,t,i,r,o,e,f,c,a){var s,h,p,v,y,d,_,k,x,M,$,I,P,A,H,T,j=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(s=l$1.__b)&&s(u);n:if("function"==typeof j){h=e.length;try{if(x=u.props,M=j.prototype&&j.prototype.render,$=(s=j.contextType)&&i[s.__c],I=s?$?$.props.value:s.__:i,t.__c?k=(p=u.__c=t.__c).__=p.__E:(M?u.__c=p=new j(x,I):(u.__c=p=new C$1(x,I),p.constructor=j,p.render=Q),$&&$.sub(p),p.state||(p.state={}),p.__n=i,v=p.__d=!0,p.__h=[],p._sb=[]),M&&null==p.__s&&(p.__s=p.state),M&&null!=j.getDerivedStateFromProps&&(p.__s==p.state&&(p.__s=m$1({},p.__s)),m$1(p.__s,j.getDerivedStateFromProps(x,p.__s))),y=p.props,d=p.state,p.__v=u,v)M&&null==j.getDerivedStateFromProps&&null!=p.componentWillMount&&p.componentWillMount(),M&&null!=p.componentDidMount&&p.__h.push(p.componentDidMount);else {if(M&&null==j.getDerivedStateFromProps&&x!==y&&null!=p.componentWillReceiveProps&&p.componentWillReceiveProps(x,I),u.__v==t.__v||!p.__e&&null!=p.shouldComponentUpdate&&!1===p.shouldComponentUpdate(x,p.__s,I)){u.__v!=t.__v&&(p.props=x,p.state=p.__s,p.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),w$1.push.apply(p.__h,p._sb),p._sb=[],p.__h.length&&e.push(p);break n}null!=p.componentWillUpdate&&p.componentWillUpdate(x,p.__s,I),M&&null!=p.componentDidUpdate&&p.__h.push(function(){p.componentDidUpdate(y,d,_);});}if(p.context=I,p.props=x,p.__P=n,p.__e=!1,P=l$1.__r,A=0,M)p.state=p.__s,p.__d=!1,P&&P(u),s=p.render(p.props,p.state,p.context),w$1.push.apply(p.__h,p._sb),p._sb=[];else do{p.__d=!1,P&&P(u),s=p.render(p.props,p.state,p.context),p.state=p.__s;}while(p.__d&&++A<25);p.state=p.__s,null!=p.getChildContext&&(i=m$1(m$1({},i),p.getChildContext())),M&&!v&&null!=p.getSnapshotBeforeUpdate&&(_=p.getSnapshotBeforeUpdate(y,d)),H=null!=s&&s.type===S&&null==s.key?E(s.props.children):s,f=L(n,g(H)?H:[H],u,t,i,r,o,e,f,c,a),p.base=u.__e,u.__u&=-161,p.__h.length&&e.push(p),k&&(p.__E=p.__=null);}catch(n){if(e.length=h,u.__v=null,c||null!=o){if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;null!=o&&(o[o.indexOf(f)]=null),u.__e=f;}else if(null!=o)for(T=o.length;T--;)b(o[T]);}else u.__e=t.__e;null==u.__k&&(u.__k=t.__k||[]),n.then||B$1(u),l$1.__e(n,u,t);}}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=G(t.__e,u,t,i,r,o,e,c,a);return (s=l$1.diffed)&&s(u),128&u.__u?void 0:f}function B$1(n){n&&(n.__c&&(n.__c.__e=true),n.__k&&n.__k.some(B$1));}function D$1(n,u,t){for(var i=0;i<t.length;i++)J(t[i],t[++i],t[++i]);l$1.__c&&l$1.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$1.__e(n,u.__v);}});}function E(n){return "object"!=typeof n||null==n||n.__b>0?n:g(n)?n.map(E):void 0!==n.constructor?null:m$1({},n)}function G(u,t,i,r,o,e,f,c,a){var s,h,p,v,y,w,_,m=i.props||d$1,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(s=0;s<e.length;s++)if((y=e[s])&&"setAttribute"in y==!!x&&(x?y.localName==x:3==y.nodeType)){u=y,e[s]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l$1.__m&&l$1.__m(t,e),c=false),e=null;}if(null==x)m===k||c&&u.data==k||(u.data=k);else {if(e="textarea"==x&&null!=k.defaultValue?null:e&&n$1.call(u.childNodes),!c&&null!=e)for(m={},s=0;s<u.attributes.length;s++)m[(y=u.attributes[s]).name]=y.value;for(s in m)y=m[s],"dangerouslySetInnerHTML"==s?p=y:"children"==s||s in k||"value"==s&&"defaultValue"in k||"checked"==s&&"defaultChecked"in k||N(u,s,null,y,o);for(s in k)y=k[s],"children"==s?v=y:"dangerouslySetInnerHTML"==s?h=y:"value"==s?w=y:"checked"==s?_=y:c&&"function"!=typeof y||m[s]===y||N(u,s,y,m[s],o);if(h)c||p&&(h.__html==p.__html||h.__html==u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(p&&(u.innerHTML=""),L("template"==t.type?u.content:u,g(v)?v:[v],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&$(i,0),c,a),null!=e)for(s=e.length;s--;)b(e[s]);c&&"textarea"!=x||(s="value","progress"==x&&null==w?u.removeAttribute("value"):null!=w&&(w!==u[s]||"progress"==x&&!w||"option"==x&&w!=m[s])&&N(u,s,w,m[s],o),s="checked",null!=_&&_!=u[s]&&N(u,s,_,m[s],o));}return u}function J(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u));}else n.current=u;}catch(n){l$1.__e(n,t);}}function K(n,u,t){var i,r;if(l$1.unmount&&l$1.unmount(n),(i=n.ref)&&(i.current&&i.current!=n.__e||J(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$1.__e(n,u);}i.base=i.__P=i.__n=null;}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&K(i[r],u,t||"function"!=typeof n.type);t||b(n.__e),n.__c=n.__=n.__e=void 0;}function Q(n,l,u){return this.constructor(n,u)}function R(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),l$1.__&&l$1.__(u,t),o=(r="function"=="undefined")?null:t.__k,e=[],f=[],q(t,u=(t).__k=k$1(S,null,[u]),o||d$1,d$1,t.namespaceURI,o?null:t.firstChild?n$1.call(t.childNodes):null,e,o?o.__e:t.firstChild,r,f),D$1(e,u,f),u.props.children=null;}n$1=w$1.slice,l$1={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l;}throw n}},u$1=0,C$1.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!=this.state?this.__s:this.__s=m$1({},this.state),"function"==typeof n&&(n=n(m$1({},u),this.props)),n&&m$1(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),A(this));},C$1.prototype.forceUpdate=function(n){this.__v&&(this.__e=true,n&&this.__h.push(n),A(this));},C$1.prototype.render=S,i$1=[],o$1="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e$1=function(n,l){return n.__v.__b-l.__v.__b},H.__r=0,f$1=Math.random().toString(8),c$1="__d"+f$1,a$1="__a"+f$1,s$1=/(PointerCapture)$|Capture$/i,h$1=0,p$1=V(false),v$1=V(true);

var n=function(t,s,r,e){var u;s[0]=0;for(var h=1;h<s.length;h++){var p=s[h++],a=s[h]?(s[0]|=p?1:2,r[s[h++]]):s[++h];3===p?e[0]=a:4===p?e[1]=Object.assign(e[1]||{},a):5===p?(e[1]=e[1]||{})[s[++h]]=a:6===p?e[1][s[++h]]+=a+"":p?(u=t.apply(a,n(t,a,r,["",null])),e.push(u),a[0]?s[0]|=2:(s[h-2]=0,s[h]=u)):e.push(a);}return e},t$1=new Map;function htm(s){var r=t$1.get(this);return r||(r=new Map,t$1.set(this,r)),(r=n(this,r.get(s)||(r.set(s,r=function(n){for(var t,s,r=1,e="",u="",h=[0],p=function(n){1===r&&(n||(e=e.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?h.push(0,n,e):3===r&&(n||e)?(h.push(3,n,e),r=2):2===r&&"..."===e&&n?h.push(4,n,0):2===r&&e&&!n?h.push(5,0,true,e):r>=5&&((e||!n&&5===r)&&(h.push(r,0,e,s),r=6),n&&(h.push(r,n,0,s),r=6)),e="";},a=0;a<n.length;a++){a&&(1===r&&p(),p(a));for(var l=0;l<n[a].length;l++)t=n[a][l],1===r?"<"===t?(p(),h=[h],r=3):e+=t:4===r?"--"===e&&">"===t?(r=1,e=""):e=t+e[0]:u?t===u?u="":e+=t:'"'===t||"'"===t?u=t:">"===t?(p(),r=1):r&&("="===t?(r=5,s=e,e=""):"/"===t&&(r<5||">"===n[a][l+1])?(p(),3===r&&(h=h[0]),r=h,(h=h[0]).push(2,0,r),r=0):" "===t||"\t"===t||"\n"===t||"\r"===t?(p(),r=2):e+=t),3===r&&"!--"===e&&(r=4,h=h[0]);}return p(),h}(s)),r),arguments,[])).length>1?r:r[0]}

var t,r,u,i,o=0,f=[],c=l$1,e=c.__b,a=c.__r,v=c.diffed,l=c.__c,m=c.unmount,p=c.__;function s(n,t){c.__h&&c.__h(r,n,o||t),o=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function d(n){return o=1,y(D,n)}function y(n,u,i){var o=s(t++,2);if(o.t=n,!o.__c&&(o.__=[D(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r,!r.__f)){var f=function(n,t,r){if(!o.__c.__H)return  true;var u=false,i=o.__c.props!==n;if(o.__c.__H.__.some(function(n){if(n.__N){u=true;var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=true);}}),c){var f=c.call(this,n,t,r);return u?f||i:f}return !u||i};r.__f=true;var c=r.shouldComponentUpdate,e=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r.shouldComponentUpdate=f;}return o.__N||o.__}function h(n,u){var i=s(t++,3);!c.__s&&C(i.__H,u)&&(i.__=n,i.u=u,r.__H.__h.push(i));}function j(){for(var n;n=f.shift();){var t=n.__H;if(n.__P&&t)try{t.__h.some(z),t.__h.some(B),t.__h=[];}catch(r){t.__h=[],c.__e(r,n.__v);}}}c.__b=function(n){r=null,e&&e(n);},c.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),p&&p(n,t);},c.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u===r?(i.__h=[],r.__h=[],i.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0;})):(i.__h.some(z),i.__h.some(B),i.__h=[],t=0)),u=r;},c.diffed=function(n){v&&v(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f.push(t)&&i===c.requestAnimationFrame||((i=c.requestAnimationFrame)||w)(j)),t.__H.__.some(function(n){n.u&&(n.__H=n.u,n.u=void 0);})),u=r=null;},c.__c=function(n,t){t.some(function(n){try{n.__h.some(z),n.__h=n.__h.filter(function(n){return !n.__||B(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],c.__e(r,n.__v);}}),l&&l(n,t);},c.unmount=function(n){m&&m(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.some(function(n){try{z(n);}catch(n){t=n;}}),r.__H=void 0,t&&c.__e(t,r.__v));};var k="function"==typeof requestAnimationFrame;function w(n){var t,r=function(){clearTimeout(u),k&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,35);k&&(t=requestAnimationFrame(r));}function z(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function B(n){var t=r;n.__c=n.__(),r=t;}function C(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D(n,t){return "function"==typeof t?t(n):t}

const html = htm.bind(k$1);

const copyBoot = {
    landingEyebrow: "Milpa \u00b7 plants in good company",
    homeVoiceSpring: "Spring is here. Time to get the first things in the ground.",
    homeVoiceSummer: "High summer in the garden. Water deep, pick often, and sow a little for fall.",
    homeVoiceAutumn: "The season is nearly over. Bring in the last of it, and cover the beds for winter.",
    homeVoiceWinter: "Not much to do outside. A good month to prune, to tidy, and to plan next year.",
    homeVoiceFrostRare: "Frost is rare here, so the garden keeps growing the whole year round.",
    landingHeadlineHtml: "Know when to plant, <em>and why.</em>",
    landingDeckHtml: "Every answer shows its evidence. Your planting dates come from the frost odds where you live, and each piece of advice says in plain words how sure the studies are.",
    lgFirstGo: "Show my planting dates \u203a",
    landingStart: "Start planning\u00a0\u203a",
    landingExample: "See an example garden",
    landingNote: "Free, and you don't need an account: your garden and the diary of what you plant stay right here on this device. A free account carries both to every device you use.",
    door1Q: "When do I plant?",
    door2Q: "What grows well together?",
    door3Q: "Do eggshells stop slugs?",
    door4Q: "Plan my garden",
    doorsGroupBefore: "Before you plant",
    doorsGroupGrowing: "While it grows",
    doorsGroupTrack: "Keeping track",
    doorsGroupTip: "Heard a tip?",
    door2P: "Plant teams that share a bed well, and how sure the evidence is for each one.",
    door4P: "Lay out your beds and their plant teams. What grew where stays with the ground when you move a bed.",
    doorNowQ: "What can I plant now?",
    doorNowP: "What can go in this week where you live, and what has time to finish before the frost.",
    doorWrongQ: "Something wrong in the garden?",
    doorWrongP: "Match what you see to its likely cause. Each answer comes from a rule a person has checked against its source.",
    doorDiaryQ: "Keep a garden diary",
    doorDiaryP: "Note what you plant and when the frosts come. It's kept on this device, and you don't need an account.",
    door3P: "What the studies say about it, with their sources.",
    trOwnDates: "Use the frost dates you know",
    lgBandsKicker: "Through the whole season",
    answersTitle: "Answers",
    answersTagline: "Tell us a little and get something useful back.",
    answersWhereH: "Where are you?",
    answersZipLabel: "ZIP code or city",
    anOutsideUs: "Outside the US? Type your town's name, or your postcode. Bigger cities answer straight away, and we can look up anywhere else.",
    anZipPh: "55401 or Munich",
    answersCropH: "What are you growing?",
    answersIcsBtn: "Put these in my phone's calendar",
    answersIcsHint: "Comes with the reminder you choose. You don't need an account, since your calendar app sends the reminders.",
    answersTeamsH: "Plant teams",
    landingSituationLead: "Narrow it to where you are:",
    answersPlanBtn: "Plan my actual garden",
    dimbedAbout: "About",
    dimbedMake: "Make this bed",
    dimbedHint: "Two numbers are all it takes. Once a bed has a size, we can check the fit, place your plants, and space them out. Trace it on the satellite photo whenever you're ready, and we'll start keeping track of what grows in that spot.",
    traceUpL: "Next step: trace it on the satellite photo",
    traceUpBody: "Pin a bed to its real spot in the yard and we can warn you about rotation based on what actually grew there. That record stays put even when you rearrange. On the map, draw the bed where it really is, give it the same name, and hit Save bed. Its plan and plants come right along.",
    whyNextL: "Checked a tip?",
    whyNextGo: "What grows well together\u00a0\u203a",
    exampleBannerText: "This is an example garden. Nothing here is saved to an account.",
    exampleStartOwn: "Start my own garden",
    exampleRemove: "Remove example",
    landingProductTitle: "One bed, planned.",
    landingProductPlaceKicker: "The layout it hands back",
    landingProductPlaceCap: "The Three Sisters on a 10 by 10 foot bed, exactly the way the planner lays it out: the mounds, the spacing, and the squash filling in the gaps.",
    landingProductRuleKicker: "The reason on the record",
    landingProofLead: "Every suggestion, on the record",
    landingProofCta: "Plan a bed on this evidence",
    landingLibTitle: "What to grow, and how.",
    landingLibAll: "See all {n} growing guides",
    landingHowTitle: "What stands behind every suggestion.",
    landingP1Title: "A real reason for every pairing.",
    landingP2Title: "How sure we are, in plain words.",
    landingP3Title: "Soil numbers start with a soil test.",
    landingFootTitle: "Grow a garden in good company.",
    planTitle: "Plan your garden",
    teamsHead: "Recommended plant teams",
    climateEmpty: "Set your location on the Plan page, and your first and last frost dates follow from it.",
    handoffBody: "This plan turns into a real season you can work: dates on your Calendar, and a Log of what happens in your own ground.",
    handoffButton: "Open the Log",
    logTagline: "What you planted, when the frosts came, and whatever went sideways.",
    reviewTagline: "A look back at your season, and what each bed is ready for next.",
    calendarTaglineNoLocation: "No location set yet? We'll leave this blank until you add one.",
    clOwnDatesNote: "After three logged seasons, your own frost dates take over from the general estimate.",
    bedAddDoorFirst: "Add your first bed",
    bedAddBack: "Back to your beds",
    bedAddTitle: "Add a bed",
    bedAddHowAsk: "How do you want to make it?",
    bedAddHowFoot: "Either way you get the same bed. Tracing pins it to its spot in the yard.",
    bedAddSizeAsk: "How big is it?",
    bedAddSizeWide: "Wide",
    bedAddSizeLong: "Long",
    bedAddSizeFoot: "{size} is the most common size, so it's filled in. Change it if yours is different.",
    bedAddKindAsk: "What kind of bed?",
    bedAddSunAsk: "How much sun does it get?",
    bedAddSunLede: "Stand there mid-morning and again mid-afternoon. It's the one thing worth checking twice.",
    bedAddRainAsk: "Does rain reach it?",
    bedAddRainLede: "A roof keeps the rain off, so a covered bed gets all of its water from you.",
    firstBedKeepNote: "Saves this bed with its team. You can change either one later.",
    firstBedSkip: "No thanks, I'll make my own bed",
    mybedBackToTeams: "Pick a team instead",
    mybedTitle: "Design it yourself",
    mybedNextBed: "Next: see the bed",
    mybedHint: "Build a bed from whatever plants you like. We'll check it like a named team for placement, clashes, and which team you're close to completing, then start you a layout you can drag to match your real garden.",
    whereHint: "Drag the pin if it landed off.",
    ziphintDefault: "",
    familyHint: "Ticking a family is a rough guide. It tracks what grew here so we can suggest a good rotation, but it can't tell two plants in the same family apart, such as a strawberry and an apple. For the most accurate advice, log the actual plant in your diary.",
    addPlantHint: "Growing something we don't list yet? Add it here.",
    addPlantNote: "It's kept with your gardens: on this device, and in your account when you're signed in. No one has checked it, so it comes with no confidence note. Fill in what you know, and each detail turns on the checks it supports.",
    frostDemoHint: "This needs three logged seasons before it can compare your real frosts to the typical dates. None yet? Add a few example seasons to see how it works.",
    exportHint: "Your download is a plain text file, and it's yours to keep. It's a backup, and a way to take everything with you.",
    guildSistersH: "The Three Sisters",
    guildSistersC1: "The corn grows tall and the beans climb it like a trellis.",
    guildSistersC2: "The beans feed the soil, though most of it reaches next year's crops.",
    guildSistersC3: "The squash spreads out underneath and shades the weeds.",
    guildHerbsH: "Brassicas with aromatic herbs",
    guildHerbsBody: "Plant strong-smelling herbs among your cabbages and you may see less caterpillar damage. One university trial found that with thyme. Nobody has shown exactly why, and plenty of trials find nothing at all.",
    guildCarrotBody: "Onions planted through the carrots throw the carrot rust fly off the scent, so fewer maggots reach the roots. A dill border gives you something to cut for the table.",
    guildHubbardBody: "Circle your cucumbers with hubbard squash. The beetles much prefer it, so they crowd onto the ring and mostly leave the cucumbers, and the wilt they carry, alone. You still clear them off. The ring just gathers them.",
    landingWhyExample: "why: the beans pull nitrogen from the air and leave it in the soil.",
    landingConfidenceRow: "confidence: well established \u00b7 promising \u00b7 a good hunch",
    landingFertilizerRow: "fertilizer: get a soil test first, then feed what it asks for.",
    planMoveGardenBtn: "Move garden here",
    planNewGardenHereBtn: "Start a new garden here",
    planUseMapCentreBtn: "Use map center",
    planMapEmptyTitle: "Your map opens here",
    planMapEmptyBody: "Set your location in the \u201cWhere\u201d step and we'll drop you right on your own yard. From there you can trace your beds straight onto the satellite photo.",
    planShareBtn: "Share this plan",
    planWhereLead: "Your address gives you your frost odds and real planting windows. Type it in and the pin drops.",
    planWhereBought: "You now have frost odds and planting windows for every crop, across the whole app. We won't ask again.",
    planGroundMapHint: "Trace or size your growing areas on the map, and they show up here.",
    planHistoryH: "What grew here recently",
    planOptionalTag: "Optional, when you're ready",
    planGroundContinue: "Continue to this bed \u203a",
    planGroundContinueLocked: "Make a bed first, then plan it",
    logAddGardenBtn: "+ Add a garden",
    logLedgerLegend: "What your log has earned",
    logWeatherLegend: "This ground's weather",
    logWeatherBody: "Frost and heat apply to the whole address. Once you've logged three seasons, this ground's own frost dates take over from the general estimate.",
    logDemoLoadBtn: "Load demo seasons",
    logDemoClearBtn: "Clear demo seasons",
    logSoilLegend: "This ground's soil",
    logSoilBody: "How much you know about each piece of ground, and what the next step would tell you. Soil changes slowly, so read this as a picture of the whole season.",
    logMyPlantsLegend: "My added plants",
    logMyPlantsBody: "Plants you added yourself. Open one to fill in more detail. The more you tell us, the more it works like a built-in plant across Plan, Log, and the Calendar.",
    logExportBtn: "Export season",
    logImportBtn: "Import pasted file",
    logSeasonFileSummary: "Season file (export shows it here; paste one here to import)",
    calendarIcsBtn: "Add to calendar",
    calendarIcsHint: "Reminders come from your calendar app. Plan changed? Export again and the calendar updates.",
    whyTagline: "Every recommendation in this app points back to a rule.",
    whyClimateLegend: "Where the climate numbers come from",
    wyClimateFold: "Measured, modeled or estimated",
    whyPlantLegend: "Where the plant numbers come from",
    whyPlantBody: "Every number a plant contributes, like how wide it grows, how tall, or how long to harvest, carries a confidence mark. A number marked estimated is one nobody has confirmed against a published source yet. Use it for laying out a bed, but don't quote it. The app tracks which, and here they are.",
    whyTreeSizesBody: "The tree sizes were checked against land-grant extension publications in July 2026: UGA Extension Circular 740 (Home Garden Apples) and Circular 1063 (Home Garden Peaches), University of Maine Bulletin #2034 (Plum Production in Maine), University of California ANR's plum rootstock guidance, and University of Missouri Extension G6030 (peach training and pruning). Where a size is derived from a published band instead of quoted from it, the number stays marked estimated. Dwarf apples, for instance, are \"about 30 to 40 percent as large as standard trees\", with no stated height. There is no dwarf pear in this corpus because extension sources say a home grower cannot buy one.",
    whyDataLegend: "Where the data comes from",
    wySourcesFold: "The sources, and how they're kept",
    whySourcesReadBody: "Each source is kept with the day it was read, and a claim whose source hasn't been read yet says so. A plant that doesn't fit your space is never swapped for another. It shows grayed, with the reason.",
    whyPrivacyBody: "Privacy: visits are counted anonymously, with no cookies and no personal data, and Do Not Track is honored. Your plants and plans are never part of it.",
    accountPromiseTitle: "Your garden lives on this device",
    accountPromiseBody: "Everything you plan and log stays right here in your browser, yours by default: the garden, the Log of what you plant, and the season review. A free account carries them to every device you use and keeps a daily backup. Nothing leaves this device until you sign in.",
    accountPromiseBodyIn: "Everything you plan and log is copied to your account, so it comes along to every device you sign in on. Only you can read it.",
    accountDisplayLegend: "Display preferences",
    accountDisplayBody: "Kept on this device; once you're signed in it follows your account to every device.",
    accountCreateBtn: "Create account",
    accountForgotBtn: "Forgot password",
    accountChangePwBtn: "Change password",
    accountChangeEmailBtn: "Change email",
    accountEmailNote: "Email changes are confirmed by a message to the new address. Your gardens and their logs are on the Log, under \u201cThis garden\u201d.",
    accountDeleteLegend: "Delete account",
    accountDeleteBody: "Removes your account and every record synced to it. Its copy on this device goes too, with the photos in its gardens. Gardens you made without signing in stay here. Export any season you want to keep first.",
    accountDeleteBtn: "Delete account",
    teamsLegend: "Garden circles",
    teamsIntro: "A garden circle lets more than one person tend the same garden. Create one, invite the people who help, and you'll all see the same beds, seasons, and diary.",
    teamsConsent: "Everyone you add to a circle can see that circle's gardens, including their location on the map and their full seasons. Everyone in a circle can also see each other's sign-in email. Your photos and your display settings never travel.",
    teamsCreateBtn: "Create circle",
    teamsGardensNote: "Share a garden with a circle and everyone in it sees its beds, seasons, and diary, and can tend it with you. Only the garden's owner can share or remove it.",
    teamsSharedTag: "Shared",
    teamsSharedBanner: "This garden is shared. Your changes sync to everyone in the circle.",
    feedHeading: "Garden feed",
    feedIntro: "Notes for the people who tend this garden with you. Only people with access to this garden can see them.",
    feedPostPlaceholder: "Say something to your circle",
    feedPostBtn: "Post",
    feedEmpty: "No notes yet. Say something to the people who tend this garden with you.",
    feedDeleteBtn: "Delete",
    restoreHeading: "Replaced copies of this garden",
    restoreIntro: "When a sync replaces this device's copy of the garden or a season, the outgoing copy is kept here for a while. Restore one to make it the newest version. It syncs back to everyone, undoing the change.",
    restoreBtn: "Restore",
    restoreArmedBtn: "Really restore?",
    restoreDone: "Restored. This copy is now the newest version and will sync to everyone.",
    restoreSeasonLabel: "Season",
    restoreLayoutLabel: "Garden layout",
    accountKnowsLegend: "What is on record for your garden",
    accountKnowsBody: "Every one of these is optional, and the app says what it would do with a fact before you give it. Nothing here is sold, shared, or used to advertise to you.",
    accountPrivacyLegend: "Privacy policy",
    accountPrivacySignedOut: "Signed out, your garden data lives only on this device, and nothing leaves your browser unless you choose to email us a note. Nothing backs it up, either: the season export on the Log is your own copy, and the daily backup comes with a free account.",
    accountPrivacySignedIn: "Signed in, your addresses, growing areas and seasons are stored in your account so they can follow you across devices. They are readable only by your own account, and deleting your account above removes them in one tap.",
    accountPrivacyBundle: "The plant knowledge that powers the app is a public file built into the app itself. Your data never mixes into it.",
    accountPrivacyNetwork: "Address lookup and map imagery are fetched only when you use them, and those requests carry only what you typed or the area you are viewing. They never carry your plans. Visits are counted anonymously, with no cookies and no personal data, and Do Not Track is honored. Your plants and your plans are never part of any analytics.",
    navHome: "Home",
    navPlan: "Plan",
    navCalendar: "Calendar",
    navLog: "Log",
    navLearn: "Learn",
    navPlants: "Plants",
    navTeams: "Plant teams",
    navGuides: "Guides",
    navEvidence: "Evidence",
    navLockTag: "Sign in",
    authChipTitle: "tap to sign in",
    homeWeekMore: "{n} more",
    homeWeekThingsOne: "{n} thing to do",
    homeWeekThingsMany: "{n} things to do",
    langNote: "Machine translation. If anything differs, the English version is the one that counts.",
    langNoteEnglish: "Switch the app to English",
    accountLangLabel: "Language \u00b7 Idioma",
    lblPlant: "Plant",
    lblSize: "Size",
    lblGrowingIt: "Growing it",
    lblTiming: "Timing",
    lblHowToPlant: "How to plant it",
    lblWorthKnowing: "Worth knowing",
    lblSowingDepth: "Sowing depth",
    lblSpacingInRow: "Spacing in row",
    lblSpacingBetweenRows: "Spacing between rows",
    lblStartIndoors: "Start indoors, weeks before last frost",
    lblMatureHeight: "Mature height",
    lblMatureSpread: "Mature spread",
    lblSoilPh: "Soil pH (in water)",
    lblDaysToMaturity: "Days to maturity",
    lblGdd: "Growing-degree days to maturity",
    lblYearsToBearing: "Years to bearing",
    lblSuccession: "Days between succession sowings",
    lblHardiness: "Hardiness zone",
    lblLight: "Light",
    lblFeeding: "Feeding",
    lblRootDepth: "Root depth",
    lblFrostTolerance: "Frost tolerance",
    lblLifespan: "Lifespan",
    lblHabit: "Habit",
    lblPollinatorValue: "Value to pollinators",
    lblFamily: "Family",
    lblGermTemp: "Germination soil temperature",
    lblDaysToGerminate: "Days to germinate",
    lblSeedViable: "Seed stays viable",
    lblLightToGerminate: "Light to germinate",
    lblReadyWhen: "Ready when",
    lblCureFirst: "Cure first",
    lblKeeps: "Keeps",
    lblMind: "Mind",
    lblPotSize: "Pot size",
    lblBeforeYouSow: "Before you sow",
    lblAtHarvest: "At harvest",
    lblInAPot: "In a pot",
    lblVariety: "Variety",
    lblRulesApply: "Rules that apply",
    lblSomethingWrong: "Something wrong?",
    lblTeamsUse: "Plant teams that use it",
    pcWhyThis: "Why this?\u00a0\u203a",
    pcPartlyHolds: "This claim only partly holds up.",
    hmYourGarden: "Your garden",
    plRectangle: "Rectangle",
    plCircle: "Circle",
    plShapes: "Shapes",
    plLBed: "L-bed",
    plUBed: "U-bed",
    plTrough: "Trough",
    plTraceAnOddOutline: "Trace an odd outline",
    plEditGround: "Edit ground",
    plLayers: "Layers",
    plAreas: "Areas",
    plPlantings: "Plantings",
    plLabels: "Labels",
    plPhoto: "Photo",
    plThisSeason: "This season",
    plSun: "Sun",
    plSoil: "Soil",
    plRotation: "Rotation",
    plKey: "Key",
    plInGroundBed: "In-ground bed",
    plRaisedBed: "Raised bed",
    plContainerOrPot: "Container or pot",
    plOpenField: "Open field",
    plWalkwaysRunTheLong: "Walkways run the long way",
    plWalkwaysRunTheShort: "Walkways run the short way",
    plSunNotStated: "Sun not stated",
    plFullSunHoursDirect: "Full sun (6+ hours direct)",
    plPartShade: "Part shade",
    plRainOpen: "Open sky (rain reaches it)",
    plRainCovered: "Under a roof (no rain)",
    plRainIndoors: "Indoors (no rain)",
    plDoesRainReach: "does rain reach this bed?",
    plSaveBed: "Save bed",
    plWhere: "Where",
    plAddress: "Address",
    plUseMyLocation: "Use my location",
    plChangeLocation: "Change location",
    plYourFirstBedReady: "Your first bed, ready to keep",
    plBeds: "Beds",
    plChange: "Change\u00a0\u203a",
    plFullSun: "Full sun",
    plThisBed: "This bed",
    plKeepThisBed: "Keep this bed",
    plNextYourGroundWhere: "Next: your ground - where do things grow?",
    plContinuePlanThisBed: "Continue to this bed \u203a",
    plThisGround: "This ground",
    plTellUsWhatGrew: "tell us what grew here before you started tracking",
    plPickATeamIts: "Pick a team and its dates go on your calendar\u00a0\u203a",
    plAddAPlant: "Add a plant",
    plMissingAPlantAdd: "Missing a plant? Add your own\u00a0\u203a",
    plAddYourOwnPlant: "Add your own plant",
    plThisSeason2: "This season",
    plPanTheImageryTo: "pan the imagery to your house, then make this spot your location",
    plYourGroundMapWith: "your ground - map with a meter grid; tap to trace growing areas, drag to pan, pinch to zoom",
    plLocationMapDragThe: "location map - drag the pin onto your garden",
    plMapLayers: "map layers",
    plBedTintLayer: "bed tint layer",
    plWhatThePlantColours: "what the plant colors mean",
    plDismiss: "dismiss",
    plBed: "bed",
    plZoomOut: "zoom out",
    plZoomIn: "zoom in",
    plCentreOnPlot: "center on plot",
    plBedWidth: "bed width",
    plBedLength: "bed length",
    plBedDiameter: "bed diameter",
    plLBedOuterWidth: "L-bed outer width",
    plLBedOuterLength: "L-bed outer length",
    plNotchWidth: "notch width",
    plNotchLength: "notch length",
    plUBedOuterWidth: "U-bed outer width",
    plUBedOuterLength: "U-bed outer length",
    plTroughWidth: "trough width",
    plTroughLength: "trough length",
    plUndo: "undo",
    plRedo: "redo",
    plDiscardThisShape: "discard this shape",
    plNameThisBedE: "Name this bed (e.g. south bed)",
    plThisBedSStructure: "this bed's structure",
    plHowThisGroundIs: "how this ground is built: a field is walked from lanes, a bed is reached from its edges",
    plWhichWayThisBed: "which way this bed's walkways run",
    plABedTooDeep: "a bed too deep to reach gets walking paths and a field gets lanes. This flips which way they run. A bed you can reach all of never gets any",
    plThisBedSSun: "this bed's sun exposure",
    plHowMuchDirectSun: "how much direct sun this bed gets",
    plOpenOrCloseThe: "open or close the plan panel",
    plPlanSteps: "Plan steps",
    plStreetAddressCity: "Street address, city",
    plHowMuchSunThis: "how much sun this bed gets",
    plHowToMakeThis: "how to make this bed",
    plWidth: "width",
    plLength: "length",
    plCommonBedSizesOne: "common bed sizes, one tap each",
    plHowThisBedIs: "how this bed is built",
    plClose: "close",
    plSearchPlantsToAdd: "search plants to add",
    plTypeToNarrowE: "Type to narrow, e.g. tom, bean, mint",
    plPlantsYouCanAdd: "plants you can add",
    anMorningOf: "Morning of (8 am)",
    anEveningBefore: "Evening before (6 pm)",
    anNoReminder: "No reminder",
    anOrTypeAnyCrop: "Or type a crop, like kale",
    anReminderTime: "reminder time",
    lgSupplies: "Supplies",
    lgSeedBox: "Seed box",
    lgWhatYouAlreadyHave: "What you already have on hand. The planner can subtract these from what a plan needs.",
    lgPickACrop: "Pick a crop\u2026",
    lgFindCrop: "Find a crop",
    lgFindCropPh: "Find a crop: tomato, basil\u2026",
    lgCropMatches: "Matching crops",
    lgAddToSeedBox: "Add to seed box",
    lgYourSeedBoxIs: "Your seed box is empty. Add what you have above.",
    lgShoppingList: "Shopping list",
    lgWhatThisPlanNeeds: "What this plan needs that your seed box does not already have.",
    lgLog: "Log",
    lgLogIt: "Log it",
    lgSomethingWrongInThe: "Something wrong in the garden?",
    lgThisGarden: "This garden",
    lgGardens: "Gardens",
    lgGarden: "Garden",
    lgMore: "More",
    lgKeepIt: "Keep it",
    lgImportFromFilesThe: "Import from files (the season .yaml, and its photos .zip if you have one)",
    lgSeasonTimeline: "season timeline",
    lgCrop: "crop",
    lgVarietyOptional: "Variety (optional)",
    lgHowMuch: "how much",
    lgHowMuchOptional: "How much (optional)",
    lgPacketYear: "packet year",
    lgYear: "Year",
    lgNote: "note",
    lgNoteOptional: "Note (optional)",
    lgSaySomethingToThe: "Say something to the team",
    lgObservedEvent: "observed event",
    lgObservationSeverity: "observation severity",
    lgFrostSevLight: "Light frost",
    lgFrostSevHard: "Hard frost",
    lgFrostSevLightWord: "light",
    lgFrostSevHardWord: "hard",
    lgEndCauseDisease: "Disease",
    lgEndCausePest: "Pests",
    lgEndCausePulled: "Pulled out",
    lgEndCauseDrought: "Drought",
    lgEndCauseUnknown: "Not sure",
    lgFailSevLight: "Light damage",
    lgFailSevModerate: "Moderate damage",
    lgFailSevSevere: "Severe damage",
    lgWhichGround: "which ground",
    lgWhatHappenedInThe: "What happened in the garden?",
    lgSomethingWrongInThe2: "something wrong in the garden",
    lgActiveSeason: "active season",
    lgSeasonFileExportTarget: "season file (export target, import source)",
    lgImportSeasonFileAnd: "import season file and photo zip",
    clSetYourLocation: "Set your location\u00a0\u203a",
    clThisWeek: "This week",
    clMonth: "Month",
    clYear: "Year",
    clAddToYourCalendar: "Add to your calendar, or set reminders",
    clRemindMeOnThis: "Remind me on this device",
    clRemindMe: "Remind me",
    clMorningOf: "Morning of (8 am)",
    clEveningBefore: "Evening before (6 pm)",
    clNoReminder: "No reminder",
    clPlanTheBedThese: "Plan a bed for these dates \u203a",
    clCalendarView: "calendar view",
    clFilterByGarden: "filter by garden",
    clFilterByBed: "filter by bed",
    clPreviousMonth: "previous month",
    clNextMonth: "next month",
    clJumpToMonth: "jump to month",
    clPreviousYear: "previous year",
    clNextYear: "next year",
    clWhatReminderEachExported: "what reminder each exported task carries",
    lgSoilWaterlogged: "Water stood after rain",
    lgSoilLime: "I added lime",
    lgSoilSulfur: "I added sulfur",
    lgSoilCompost: "I added compost",
    lgStorageOff: "This browser won't let the app store anything ({err}), so the season log is off.",
    lgSoilGroup: "Soil",
    lgNearPlace: "near {place}",
    lgZone: "zone {zone}",
    lgNameTagged: "{name} ({tag})",
    lgNameDefault: "{name} (default)",
    lgJustNow: "just now",
    lgMinAgo: "{n} min ago",
    lgHoursAgo: "{n} h ago",
    lgRestoreSeason: "{label} {year} ({n} plants)",
    lgRestoreLayout: "{label} ({n} beds)",
    lgRestoreReplaced: "{what} - replaced {when}",
    lgAGardener: "a gardener",
    lgGardensIntro: "Each garden has its own climate. Tap one to switch to it. Frost and heat you log below go to the highlighted garden.",
    lgGcFrost: "last frost ~{last} \u2192 first fall frost ~{first}",
    lgGcFrostDays: "last frost ~{last} \u2192 first fall frost ~{first} \u00b7 ~{days} frost-free days",
    lgGcNoStation: "no nearby frost station - hardiness zone only",
    lgGcNoLocation: "location not set yet",
    lgDefaultGarden: "Your default garden",
    lgSetDefault: "Make this my default",
    lgDefaultOnTitle: "This garden opens first every time you start the app. Tap to clear it.",
    lgDefaultOffTitle: "Open this garden first every time you start the app.",
    lgBedsOne: "{n} bed",
    lgBedsMany: "{n} beds",
    lgVariety: "Variety",
    lgSaveChanges: "Save changes",
    lgEdit: "Edit",
    lgRemove: "Remove",
    lgSeasonReview: "Season in review\u00a0\u203a",
    lgClosedBed: "Closed \u201c{name}\u201d - annuals ended, perennials carried over",
    lgSeasonClosedToast: "Season {year} closed. Next year's plan will build on what grew here",
    lgSeasonReopened: "Season {year} is open again",
    lgCarriedOne: "Season {year} started. {n} plant carried over from {prev}. Plan the rest of each bed around it.",
    lgCarriedMany: "Season {year} started. {n} plants carried over from {prev}. Plan the rest of each bed around them.",
    lgSeasonStartedFresh: "Season {year} started on this ground",
    lgNoteItOn: "Note it on the {name}",
    lgNotedOnThe: "Noted on the {name}. It's in the diary now.",
    lgSoundsLike: "Sounds like it could be:",
    lgSeeWhatHelps: "{symptom} - see what helps\u00a0\u203a",
    lgFrostAsk: "Was it a frost?",
    lgFrostAskGo: "Log it as a frost",
    lgTlFrost: "A frost",
    lgTlHeat: "A hot spell",
    lgDiaryEndedWhy: "{name} ended ({detail}), {day}.",
    lgPhotoAltShort: "photo \u00b7 {text}",
    lgPhotoMissing: "(this photo isn't on this device)",
    lgWholeGarden: "Whole garden",
    lgShowEarlier: "Show {n} earlier",
    lgNamedWeather: "Weather at {name}",
    lgGroundWeather: "This ground\u2019s weather",
    lgTheWholeGarden: "the whole garden",
    lgTakeMeThere: "Take me there\u00a0\u203a",
    lgSignInToPost: "sign in to post to the team",
    lgWriteSomething: "Write something first",
    lgPosted: "Posted to the team.",
    lgNotedWater: "noted. Standing water on {ground} feeds the waterlogging rule.",
    lgNotedAmend: "noted. A pH reading from before this no longer describes {ground}.",
    lgNotedAdded: "noted. It's in the soil record for {ground}, and any pH reading there still counts.",
    lgWriteALine: "Write a line about what happened in the garden, then log it.",
    lgFrostLogged: "Frost logged. {badge} seasons toward your own dates.",
    lgSetLocationFirst: "Set your location on the Plan page first. The demo seasons are seeded against your own frost dates.",
    lgSetLocation: "Set your location\u00a0\u203a",
    lgDemoLoaded: "Loaded 4 synthetic demo seasons",
    lgDemoCleared: "Cleared the synthetic demo seasons",
    lgStartSeasonFirst: "Start this season first, with the Start season button at the top of the page.",
    lgNoSeasonInLog: "No season {year} in the log",
    lgExported: "Season {year} exported. Keep the file somewhere safe.",
    lgExportedPhotosOne: "Season {year} exported, with {n} photo zipped beside it.",
    lgExportedPhotosMany: "Season {year} exported, with {n} photos zipped beside it.",
    lgExportedMissingOne: "Season {year} exported. {m} photo it names isn't on this device, so it couldn't be included.",
    lgExportedMissingMany: "Season {year} exported. {m} photos it names aren't on this device, so they couldn't be included.",
    lgExportedBothOneOne: "Season {year} exported, with {n} photo zipped beside it. {m} photo it names isn't on this device, so it couldn't be included.",
    lgExportedBothOneMany: "Season {year} exported, with {n} photo zipped beside it. {m} photos it names aren't on this device, so they couldn't be included.",
    lgExportedBothManyOne: "Season {year} exported, with {n} photos zipped beside it. {m} photo it names isn't on this device, so it couldn't be included.",
    lgExportedBothManyMany: "Season {year} exported, with {n} photos zipped beside it. {m} photos it names aren't on this device, so they couldn't be included.",
    lgChooseImport: "Choose the season .yaml file, and its photos .zip if you have one.",
    lgImportReplaced: "Season {year} imported. It replaced the season {year} stored here, which was different.",
    lgImportZipFirst: "Import the season file first, or with the zip. The zip restores only photos the season names.",
    lgImportedCounts: "Season {year} imported, with {p} plantings and {o} log entries",
    lgPhotosRestoredOne: "{n} photo restored",
    lgPhotosRestoredMany: "{n} photos restored",
    lgZipSkippedOne: "{n} zip entry skipped (the season does not name them)",
    lgZipSkippedMany: "{n} zip entries skipped (the season does not name them)",
    lgPasteFirst: "Paste a season file into the box first.",
    lgPlotNote: "This file belongs to the garden \"{plot}\", so it was stored there.",
    lgImportedDone: "Season {year} imported, with {p} plantings and {o} log entries.",
    lgImportedReplaced: "Season {year} imported, with {p} plantings and {o} log entries. It replaced the season {year} stored here, which was different.",
    lgCapLimits: "plans it in, but: {limits}",
    lgCapFull: "plans, places, and schedules - full detail",
    lgUpListHint: "Edit or remove these under \u201cMy added plants\u201d on the Log tab.",
    lgNeedName: "Give the plant a name.",
    lgNameLetters: "the name needs some letters or numbers.",
    lgHeadsUpAdd: "Heads up: {limits}. Fill those in for full detail, or tap {btn} again to add anyway.",
    lgHeadsUpSave: "Heads up: {limits}. Fill those in for full detail, or tap {btn} again to save anyway.",
    lgNoAddedPlantsEdit: "No added plants yet. Add one on the Plan tab under \u201cAdd your own plant\u201d.",
    lgNoFamily: "no family",
    lgEditLower: "Edit",
    lgSaveCap: "Save",
    lgCancelLower: "Cancel",
    lgAddPlant: "Add plant",
    lgAdded: "Added {name}. Edit it any time under \u201cMy added plants\u201d on the Log tab.",
    lgDraftItem: "{name} ({beds})",
    lgDraftNoBeds: "no beds yet",
    lgUnnamed: "unnamed",
    lgDraftOfferOne: "You made {what} on this device while you were signed out. Add it to your account and it syncs to your other devices, or keep it on this device only, as a draft you'll see when you're signed out.",
    lgDraftOfferMany: "You made {what} on this device while you were signed out. Add them to your account and they sync to your other devices, or keep them on this device only, as drafts you'll see when you're signed out.",
    lgDraftOfferDefaultNew: "{name} is this device's default garden, so if you add them, it becomes your account's default too.",
    lgDraftOfferDefaultKept: "{name} is this device's default garden. Your account keeps the default it has.",
    lgAddToAccount: "Add to my account",
    lgKeepOnDevice: "Keep on this device only",
    lgRecWhenYear: "{day} ({year})",
    lgRecSowed: "{when} - sowed {name}.",
    lgRecSetOut: "{when} - set out {name}.",
    lgRecFirstHarvest: "{when} - the first {name} picked.",
    lgRecLastHarvest: "{when} - the last {name} picked.",
    lgRecNoteOn: "{when} - on {name}: {text}",
    lgRecNote: "{when} - {text}",
    lgRecANote: "a note",
    lgRecFrost: "{when} - a frost.",
    lgRecHeat: "{when} - a hot spell.",
    lgRecOther: "{when}.",
    lgFrostNoted: "Frost noted for {day}. Two dated frosts a year, three years running, and your frost dates come from your own log.",
    lgFrostNotedLive: "Frost noted for {day}. Your frost dates come from your own log now, and this one goes in it.",
    lgHeatNoted: "Heat noted for {day}.",
    lgWeatherNoted: "{what} noted for {day}.",
    lgNoteLogged: "In your garden diary, {day}.",
    lgPlantedOne: "{year} begins. {n} plant in the ground at \u201c{bed}\u201d.",
    lgPlantedMany: "{year} begins. {n} plants in the ground at \u201c{bed}\u201d.",
    lgPlantedTeam: "{year} begins. The team is in the ground at \u201c{bed}\u201d.",
    lgDiaryThePlant: "the plant",
    lgDiarySowed: "{name} sown, {day}.",
    lgDiarySetOut: "{name} set out, {day}.",
    lgDiaryFirstHarvest: "First picking: {name}, {day}.",
    lgDiaryLastHarvest: "The last {name} picked, {day}.",
    lgDiaryEnded: "{name} ended, {day}.",
    lgDiaryProblem: "Noted on {name}: {detail}, {day}.",
    lgDiaryAProblem: "a problem",
    lgDiaryNote: "Noted on {name}, {day}.",
    lgDiaryOther: "{name}: noted, {day}.",
    lgGraduation: "Three winters logged. From here on, your frost dates come from your own log.",
    clMonthJan: "January",
    clMonthFeb: "February",
    clMonthMar: "March",
    clMonthApr: "April",
    clMonthMay: "May",
    clMonthJun: "June",
    clMonthJul: "July",
    clMonthAug: "August",
    clMonthSep: "September",
    clMonthOct: "October",
    clMonthNov: "November",
    clMonthDec: "December",
    clMonthDay: "{month} {day}",
    clThisTeam: "this team",
    clPlantTeam: "Plant {team}: today is the median last frost.",
    clPlantTeamRisk: "Plant {team}: today is the median last frost, and 10% of years still see frost after {date}.",
    clTeamSwapped: "{team} ({swaps})",
    clSwapIn: "{crop} in place of {was}",
    clPlantTeamHoldOne: "Hold {crops} back about {n} week more, until the days stay warm.",
    clPlantTeamHoldMany: "Hold {crops} back about {n} weeks more, until the days stay warm.",
    clPlantTeamEarlyOne: "{crops} can go in earlier, from {date}.",
    clPlantTeamEarlyMany: "{crops} can go in earlier, from {date}.",
    clPlantTeamHardyOne: "Plant {team} now. All its crops can take some frost, so the team can go in about {n} week before your last frost.",
    clPlantTeamHardyMany: "Plant {team} now. All its crops can take some frost, so the team can go in about {n} weeks before your last frost.",
    clSowClimber: "Sow the {crop} ~{days} days after the {support} is established. A vine on an unrooted stalk pulls it over.",
    clSetSupport: "Set the {support} today, with the planting. Driving it in later tears roots, and a vine with nothing to climb sprawls.",
    clHarvestReady: "{crop} should be ready, ~{days} days from planting. Start checking.",
    clHarvestReadyNow: "{crop} should be ready around now; start checking.",
    clHarvestPastFreeze: "{base} Heads up: that's after your first fall frost (~{date}), so it may not ripen outdoors.",
    clHarvestPastFreezeHard: "{base} Heads up: that's after your first hard freeze (~{date}), so it may not ripen outdoors.",
    clFirstFreezeNow: "First fall frost arrives around now. Log the frost you observe, because three logged seasons beat the model on your own ground.",
    clLoggedTip: "From your season log.",
    clActSowed: "Sowed {plants}",
    clActTransplanted: "Transplanted {plants}",
    clActFirstHarvest: "First harvest of {plants}",
    clActLastHarvest: "Last harvest of {plants}",
    clEnded: "{plant} {cause}",
    clEndedCount: "{plant} {cause}",
    clEndRemoved: "removed",
    clFailure: "{plant} - {mode} ({severity})",
    clNoteOn: "Note on {plant}: {text}",
    clFrostObserved: "Frost observed",
    clFrostObservedSev: "Frost observed - {severity}",
    clHeatObserved: "Heat observed",
    clObsNote: "{label} ({note})",
    clObsTip: "From your season log, your own frost record. After three seasons, your own dates take over.",
    clThisGarden: "This garden",
    clNearestStation: "Nearest NOAA weather station: {station}, ~{dist} away ({word}), so treat these as approximate for your exact spot.",
    clUnrated: "unrated",
    clFrostAsk: "Tap the frost you see. You've logged {n} of {min} seasons; {more} more and your own dates take over.",
    clLastFrostObserved: "Last spring frost, as observed in your garden over {n} logged seasons. It replaces the median for your area, from a weather station or a weather model. Frost-tender crops go in from here.",
    clLastFrostGiven: "Last spring frost, the date you gave for this garden. Frost-tender crops go in from here.",
    clFirstFreezeGiven: "First fall frost, the date you gave for this garden. It marks the season's end for tender crops.",
    clGivenTip: "You gave this date. The general estimate for your area said {date}.",
    clGivenTipNone: "You gave this date. No weather station or weather model covers this garden.",
    clGivenTipNoDate: "You gave this date. The general estimate for your area has no typical date to set beside it.",
    clLastFrostOwn: "Last spring frost, from your own log over {n} seasons. No weather station or weather model covers this garden, so this is its rough frost date. Frost-tender crops go in from here.",
    clFrostRare: "Frost is rare here: in a typical year it never freezes. In the years it does, the last frost usually comes by about this date.",
    clFrostRareLate: "Frost is rare here: in a typical year it never freezes. In the years it does, the last frost usually comes by about this date, and 1 year in 10 as late as {date}.",
    clLastFrostMedian: "Last spring frost (median): in about half of years a frost still comes after this date. Frost-tender crops go in from here.",
    clLastFrostMedianLate: "Last spring frost (median): in about half of years a frost still comes after this date, and one year in 10 as late as {date}. Frost-tender crops go in from here.",
    clFittedTip: "Fitted from your own logged frosts. It replaces the model.",
    clOwnTip: "From your own logged frosts: the middle of the seasons you logged.",
    clStationTip: "From the nearest NOAA weather station's normals.",
    clModelTip: "No weather station is close enough, so these dates are modeled from worldwide weather data (the ERA5 reanalysis, a grid cell about 25 km across, {dist} from you). That makes them {word}. Log the frosts you see, and after three seasons your own dates take over.",
    clLoggedToward: "You've logged {n} of 3 seasons toward your own date.",
    clFirstFreezeObserved: "First fall frost, as observed in your garden over {n} logged seasons. It replaces the median for your area, from a weather station or a weather model, and marks the season's end for tender crops.",
    clFirstFreezeOwn: "First fall frost, from your own log over {n} seasons. No weather station or weather model covers this garden, so this rough date marks the season's end for tender crops.",
    clFirstFreezeMedian: "First fall frost (median), the season's end for tender crops.",
    clHeatBoltSpan: "From {from} to {to}, hot, long days make {crops} run to seed. Pick before then, and sow again for fall.",
    clHeatBoltOne: "In {month}, hot, long days make {crops} run to seed. Pick before then, and sow again for fall.",
    clHeatBoltTip: "These are the months whose normal daytime high reaches about {temp} while days are longer than nights.",
    clHeatBoltGreens: "Summer greens keep growing through that heat: {crops}.",
    clHotNightsSpan: "From {from} to {to}, nights here usually stay above {night}, too warm for {crops} to set fruit. It starts again when the nights cool.",
    clHotNightsOne: "In {month}, nights here usually stay above {night}, too warm for {crops} to set fruit. It starts again when the nights cool.",
    clHotNightsTip: "Nothing needs fixing: the plants carry on and set fruit again once the nights cool. Shade cloth won't help, since it cools the day and this is the heat of the night. Where hot nights are normal, a heat-set tomato variety helps next season.",
    clHotNightsTipPepper: "Nothing needs fixing: the plants carry on and set fruit again once the nights cool. Shade cloth won't help, since it cools the day and this is the heat of the night. Keep them watered and unstressed so they carry the next flush.",
    clWaterHotSpan: "From {from} to {to}, days here usually run above {day} and nights stay above {night}. Check the soil every day, and expect to water daily or every other day.",
    clWaterHotOne: "In {month}, days here usually run above {day} and nights stay above {night}. Check the soil every day, and expect to water daily or every other day.",
    clWaterHotTip: "Water early in the morning, before the heat of the day, at the soil and down to the roots. A layer of straw or bark mulch can cut the watering by about half. The soil still decides: if it is moist at the second knuckle, wait.",
    clWaterHotPotsOne: "{beds} is a container, and containers dry out fastest: check it twice a day in these months.",
    clWaterHotPotsMany: "{beds} are containers, and containers dry out fastest: check them twice a day in these months.",
    clWaterDrySpan: "From {from} to {to}, rain here usually brings less than a quarter of the water a growing garden needs (about {week} a week), so nearly every drop is yours.",
    clWaterDryOne: "In {month}, rain here usually brings less than a quarter of the water a growing garden needs (about {week} a week), so nearly every drop is yours.",
    clWaterDryTip: "Rain and watering count together toward about {week} a week. Let the soil pick the day: water when it is dry at the second knuckle, and long enough to reach the roots.",
    clWaterRoofedOne: "{beds} gets no rain, so all of its water comes from you this season. Water it by its soil, never by the weather outside: a rainy week is no reason to skip it.",
    clWaterRoofedMany: "{beds} get no rain, so all of their water comes from you this season. Water them by their soil, never by the weather outside: a rainy week is no reason to skip them.",
    clWaterRoofedTip: "Push a finger in to the second knuckle and water if it is dry there, and when you water, soak it down to the roots.",
    clFrostAskFirst: "Log the frost you see. After {min} seasons, your own dates take over.",
    clYourDesign: "your design",
    clPlantObserved: "Plant {team}: timed from the last frost you've logged over {n} seasons, in place of the median for your area from a weather station or a weather model.",
    clCadence: "{n} days",
    clCadenceRange: "{lo}\u2013{hi} days",
    clSowMore: "Sow more {crop}. Re-sow every {cadence} for a steady supply.",
    clSuccTipPlanned: "This re-sow can still mature before your median first fall frost.",
    clColdHardy: "cold-hardy",
    clHalfHardy: "half-hardy",
    clCoolSowOne: "Sow or set out {crop} now. It's {hardiness}, so it can go in about {n} week before your last frost.",
    clCoolSowMany: "Sow or set out {crop} now. It's {hardiness}, so it can go in about {n} weeks before your last frost.",
    clWarmSetOutOne: "Set out or sow {crop} now. It's very tender, so it waits about {n} week past your last frost, until the days stay warm.",
    clWarmSetOutMany: "Set out or sow {crop} now. It's very tender, so it waits about {n} weeks past your last frost, until the days stay warm.",
    clTierDisputed: "Sources disagree on how much cold it takes.",
    clAutumnSow: "Sow {crop} again for a fall crop. Sown by {by}, it can still ripen (about {days} days) before your typical first fall frost (~{freeze}).",
    clAutumnSowHard: "Sow {crop} again for a fall crop. Sown by {by}, it can still ripen (about {days} days) before your first hard freeze (~{freeze}).",
    clAutumnSowLate: "Sow {crop} again for a fall crop. Sown by {by}, it can still ripen (about {days} days) before frost comes back ({freeze}).",
    clAutumnSowOpen: "Sow {crop} again for a fall crop. It stands frost down to about {temp}, and a night that cold comes here in fewer than a quarter of winters, so frost closes no window for it.",
    clAutumnTip: "Counted back from your typical first fall frost by {crop}'s days to maturity, the same limit that ends a run of re-sowings. Only cold-hardy crops are offered for autumn.",
    clAutumnTipHard: "{crop} stands frost down to about {temp}, so this is counted back from your first night that cold by its days to maturity, the same limit that ends a run of re-sowings. Only cold-hardy crops are offered for autumn.",
    clAutumnTipLate: "Counted back by {crop}'s days to maturity from the latest fall frost on record here, the same limit that ends a run of re-sowings. Only cold-hardy crops are offered for autumn.",
    clAutumnTipOpen: "{crop} stands frost down to about {temp}. Where a night that cold comes in fewer than a quarter of winters, no freeze is counted against it, so this sowing has no last day. Only cold-hardy crops are offered for fall.",
    clGarlic: "{crop} goes in this fall. Plant the cloves several weeks before the ground freezes, so they root before winter. Your first frost usually comes around {date}.",
    clGarlicLate: "{crop} goes in this fall. Plant the cloves several weeks before the ground freezes, so they root before winter. Frost comes back {freeze}.",
    clGarlicTip: "This is a heads-up, so pick the day yourself. {crop}'s sources give months (late September to November in Georgia, October to early November in Iowa) and no count from the frost, so this reminder comes about four weeks before your typical first frost.",
    clGarlicTipLate: "This is a heads-up, so pick the day yourself. {crop}'s sources give months and no count from the frost, so this reminder comes about four weeks before the latest fall frost on record here.",
    clCoverSow: "Sow {crop} as a winter cover crop between {from} and {to}, about {lo} to {hi} weeks before your typical first fall frost (~{freeze}), so it roots before winter.",
    clCoverSowLate: "Sow {crop} as a winter cover crop between {from} and {to}, about {lo} to {hi} weeks before frost comes back ({freeze}), so it roots before winter.",
    clCoverTip: "Counted back from your typical first fall frost by {crop}'s own sowing lead, from its sources. Some sources count from the later killing frost, so this errs early.",
    clCoverTipLate: "Counted back by {crop}'s own sowing lead, from its sources, from the latest fall frost on record here. Some sources count from the later killing frost, so this errs early.",
    clStartIndoors: "Start {crop} seeds indoors now, about {n} weeks before your last frost. Set the seedlings out after it.",
    clHardenNote: "Hardening off started",
    clHardenOff: "Start hardening off your {crop} seedlings. Give them a few hours outside in a sheltered spot, a little longer each day, for a week or two before they go out.",
    clCollarsNote: "Collars on",
    clCollars: "Put a collar on each {crop} transplant. A strip of card round the stem, pushed a little into the soil, stops a cutworm cutting it off at the ground.",
    clStratify: "Begin cold-stratifying {crop} seed now. It needs a cold, damp spell before it will germinate, so start about {n} weeks before you sow. See its page for the exact time.",
    clThinNote: "Thinned",
    clThinTip: "Counted from your logged sowing and how long this crop takes to come up.",
    clThin: "Thin your {crop} seedlings. They should be up by now. Once they're about {tall} tall, thin them to {apart} apart so the roots can size up. The thinnings are edible.",
    clCanesNote: "Fruited canes cut",
    clCanesTip: "Dated from your logged last pick. The canes that just fruited are done.",
    clCanes: "Cut out the {crop} canes that just fruited, down at ground level. They die after fruiting. Leave this year's new green canes standing; they carry next year's crop.",
    clPickNote: "Stopped picking",
    clPickTip: "Counted from your logged first pick this spring: {span}.",
    clPickFirstYear: "about two weeks in the first year you pick",
    clPickLaterYears: "about eight to ten weeks from the fourth year on",
    clPickStop: "Stop picking {crop} now and let the rest of the spears grow up into fern. The fern feeds the crowns for next year's crop.",
    clVineNote: "Vine pruned",
    clVineTip: "Prune while it's fully dormant, after the coldest weather and before the buds swell (about February to March).",
    clVine: "Prune the {crop} while it's dormant, before the buds swell. Take out most of last year's wood, keeping a few strong canes. Grapes fruit on new shoots from those canes.",
    clLogHarvestTip: "Estimated from your logged planting date and this crop's days to maturity.",
    clLogReady: "{crop} should be ready to harvest, about {days} days from when you planted it.",
    clLogReadyLate: "{crop}: ready about {days} days from planting, but that's after your first fall frost (~{freeze}), so it may not ripen outdoors.",
    clLogReadyLateHard: "{crop}: ready about {days} days from planting, but that's after your first hard freeze (~{freeze}), so it may not ripen outdoors.",
    clLogEnd: "{crop} - likely the end of the harvest window (about {days} days from planting).",
    clLogEndFrost: "{crop} - likely the end of the harvest window: your first fall frost (~{freeze}), about {days} days from planting.",
    clLogEndFrostHard: "{crop} - likely the end of the harvest window: your first hard freeze (~{freeze}), about {days} days from planting.",
    clLogEndLate: "The end of {crop}'s harvest window (about {days} days from planting) falls after your first fall frost (~{freeze}).",
    clLogEndLateHard: "The end of {crop}'s harvest window (about {days} days from planting) falls after your first hard freeze (~{freeze}).",
    clApproxWarmth: "{crop} ripens by warmth, so this date is approximate: sooner in a hot summer, later in a cool one.",
    clSuccTipLogged: "Counted from your logged sowing date; interval per species.",
    clActCount: "{n} \u00d7 {plant}",
    clWinStartBy: "Start by {by}. After that, {crop} can't ripen before your first fall frost ({freeze}).",
    clWinStartByHard: "Start by {by}. After that, {crop} can't ripen before your first hard freeze, a night of about {temp} ({freeze}).",
    clWinPlantBy: "Plant by {by}. After that, {crop} can't ripen before your first fall frost ({freeze}).",
    clWinPlantByHard: "Plant by {by}. After that, {crop} can't ripen before your first hard freeze, a night of about {temp} ({freeze}).",
    clWinSowBy: "Sow by {by}. After that, {crop} can't ripen before your first fall frost ({freeze}).",
    clWinSowByHard: "Sow by {by}. After that, {crop} can't ripen before your first hard freeze, a night of about {temp} ({freeze}).",
    clWinNoHardFreeze: "{crop} stands frost down to about {temp}, and a night that cold comes here in fewer than a quarter of winters, so no freeze closes this window.",
    clWinNoHardFreezeTeam: "No freeze closes this window here: a night cold enough to end {team} (about {temp}) comes in fewer than a quarter of winters.",
    clWinAutumnNext: "{crop}'s spring window has passed. Its fall sowing, below, is the next one here.",
    clFreezeOdds: "{date} or earlier in {n} years in 10",
    clFreezeSeason: "~{date}, about {days} days after your last frost",
    clWinClosedStart: "This window closed {by}. Started now, {crop} wouldn't ripen before your first fall frost ({freeze}). {alt}",
    clWinClosedStartHard: "This window closed {by}. Started now, {crop} wouldn't ripen before your first hard freeze, a night of about {temp} ({freeze}). {alt}",
    clWinClosedPlant: "This window closed {by}. Planted now, {crop} wouldn't ripen before your first fall frost ({freeze}). {alt}",
    clWinClosedPlantHard: "This window closed {by}. Planted now, {crop} wouldn't ripen before your first hard freeze, a night of about {temp} ({freeze}). {alt}",
    clWinClosedSow: "This window closed {by}. Sown now, {crop} wouldn't ripen before your first fall frost ({freeze}). {alt}",
    clWinClosedSowHard: "This window closed {by}. Sown now, {crop} wouldn't ripen before your first hard freeze, a night of about {temp} ({freeze}). {alt}",
    clAltSetOutNow: "Set out started plants instead. Planted now, they'd ripen around {date}.",
    clAltSetOutAfter: "Set out started plants after your last frost ({frost}) instead. They'd ripen around {date}.",
    clAltOr: "{a} or {b}",
    clAltFits: "{list} still fit. Sow {crop} by {date}.",
    clAltFitsMore: "{list} still fit (and {n} more). Sow {crop} by {date}.",
    clAltNextSeason: "This one waits for next season. Nothing sown now would ripen before your first fall frost ({freeze}).",
    clAltNextSeasonHard: "This one waits for next season. Nothing sown now would ripen before your first hard freeze ({freeze}).",
    clWinKeptLine: "This bed is kept for spring. The job moves to {year}, where it's on the calendar with the rest of the bed's plan.",
    clWinKeptLineTeam: "This bed is kept for spring. In {year} it's planned with {team}, the team you accepted for it.",
    clOptFrost: "Frost",
    clOptHeat: "Heat",
    clOptNote: "A note",
    clAriaSeverity: "severity",
    clWhatPh: "What (e.g. slugs)",
    clAriaWhat: "what",
    clNotePh: "Note (optional)",
    clAriaNote: "note",
    clAriaDate: "date",
    clNotePhExample: "Note (e.g. San Marzano from saved seed)",
    clCancel: "Cancel",
    clErrPickDate: "Pick a date",
    clErrNameProblem: "Name the problem",
    clErrWriteNote: "Write a note",
    clGardenFallback: "Garden",
    clClimateAt: "Climate at {garden}",
    clClimateNoPlace: "{garden} has no place yet, so there are no frost dates to show for it.",
    clNotifyHow: "How often",
    clNotifyWeekly: "Your week, plus heads-ups",
    clNotifyDaily: "Every day with a job",
    clNotifyHeads: "Heads-ups only",
    clNotifyDay: "Your week comes on",
    clNotifyHint: "Your week sums up the next seven days by what you do, across all your beds. A heads-up comes only on the days that can't wait: a frost date, a hot or dry stretch starting, a last call to sow. Your calendar's alarms follow the same choice.",
    nbAria: "Notifications",
    clWkGlance: "This week at a glance",
    gmCatPerennialVeg: "Perennial vegetables",
    anModelCaveat: "These dates are modeled from worldwide weather data {dist} away, so treat them as a rough guide for your ground.",
    plClimateModel: "Modeled from weather data {dist} away",
    plClimateModelAt: "Modeled from weather data for this spot",
    plZoneModel: " - USDA-equivalent, from the average of each winter's coldest night in worldwide weather data (ERA5, {zone_model_start}-{zone_model_end}, via Open-Meteo) for a spot ~{dist} away.",
    plNoDatesYet: "Set your location on the Where step and your dates fill in here.",
    plClimateH: "Your climate",
    plClimateReading: "reading your climate\u2026",
    plClimateStation: "{dist} from the {station} weather station",
    plClimateFrom: "{dist} from {place}",
    plClimateAtStation: "At the {station} weather station",
    plClimateAt: "At {place}",
    plZoneRow: "Hardiness zone",
    plZoneNone: "none on record here",
    plZoneNoneQ: "\u00b7 so we can't check which perennials survive your winter",
    plFrostRow: "Frost",
    plFrostRare: "rare here",
    plFrostRareQ: "\u00b7 in a typical year it never freezes",
    plLastFrostRow: "Last spring frost",
    plGroupEn: "{name} (the {group} variety, named in English)",
    plOwnDateQ: "\u00b7 your ground's own date, from {n} logged seasons \u00b7 the general estimate said ~{date}",
    plOwnFrostQ: "\u00b7 the date you gave \u00b7 the general estimate said ~{date}",
    plOwnFrostQNone: "\u00b7 the date you gave",
    plOwnFrostWarn: "These frost dates come from a weather model whose squares are about 25 km across. In hills and inland valleys, cold still nights can bring frost weeks later in spring and earlier in fall than it shows. If you know your own frost dates, enter them and your plans will follow them.",
    plOwnFrostEnter: "Enter your own frost dates",
    plOwnFrostKnow: "Know your own frost dates? Enter them",
    plOwnFrostChange: "Change your frost dates",
    plOwnFrostFoldLead: "Your frost dates.",
    plOwnFrostFoldRest: " You gave these for this garden, and everything here is planned by them. Below is where the general estimate comes from. After three seasons of logged frosts, your log takes over.",
    tellUs: "Wrong for your garden? Tell us",
    tellUsSubject: "Frost dates for my garden",
    tellUsBodyLead: "Milpa shows me these dates:",
    tellUsBodyAsk: "What I see in my garden:",
    plOwnRecordQ: "\u00b7 your garden's own rough date, the middle of {n} seasons you logged \u00b7 no weather station or model covers this spot",
    plSafeAfterQ: "\u00b7 safe after ~{date}",
    plFirstFreezeRow: "First fall frost",
    plSeasonRow: "Growing season",
    plAllYear: "all year",
    plAboutDays: "~{n} days",
    plSummerNightsRow: "Summer nights",
    plMinTemp: "min ~{temp}",
    plSummerDaysRow: "Summer days",
    plWarmestNightsRow: "Warmest nights",
    plWarmestDaysRow: "Warmest days",
    plMaxTemp: "high ~{temp}",
    plTempsStationQ: "\u00b7 from a nearby weather station\u2019s {station_start} to {station_end} records",
    plTempsModelQ: "\u00b7 from the weather model, which tends to read cool by day",
    plTempsHeld: "not shown",
    plTempsHeldQ: "\u00b7 the weather model reads this area on higher or lower ground than its town, so we show the months it marks but not its temperatures",
    plRainRow: "Rain",
    plRainDryWet: "driest {dry} (~{dryRain}), wettest {wet} (~{wetRain})",
    plRainDryMonths: "nearly every drop is yours in {months}",
    plRainDryAllYear: "nearly every drop is yours all year round",
    plFrostDatesRow: "Frost dates",
    plNotCovered: "not covered here yet",
    plNotCoveredQ: "\u00b7 this spot is beyond the weather records we carry, so we won't guess",
    plNotCoveredOwnQ: "\u00b7 this spot is beyond the weather records we carry, so we won't guess \u00b7 log the frosts you see, and after {min} seasons they become this garden's own rough dates",
    plLongDay: "long-day",
    plShortDay: "short-day",
    plOnionChangeover: "onion changeover",
    plDaylengthRow: "Daylength",
    plPeakHours: "\u00b7 ~{h} h peak",
    plHowWeKnow: "How we know \u00b7 frost risk by date",
    plHowWeKnowRare: "How we know \u00b7 where these numbers come from",
    plFrostRiskLead: "Frost risk by planting date",
    plFrostRiskRest: " - chance a killing frost still comes after you plant:",
    plPhotoperiodLead: "Photoperiod",
    plPhotoperiodRest: " - latitude {lat}\u00b0 is {note}",
    plFrostSeasonLead: "Frost & season",
    plFrostSeasonRest: " - {conf} for your ground, {tierTerm}. {caveat}",
    plEstimated: "Estimated",
    plZoneLead: "Zone",
    plZonePhzm: " - USDA {phzm_vintage} Plant Hardiness Zone Map ZIP listing (USDA-ARS & PRISM Climate Group, Oregon State University), nearest ZIP ~{dist} - derived data, not the official map.",
    plZoneEquivalent: "USDA-equivalent, from the bundled site's climate normals",
    plDaylengthRest: ". Worked out from your latitude, with no twilight and no forecast, so it works offline.",
    plLogNotReady: "the garden log isn\u2019t ready yet; try again in a moment",
    plAndJoin: " and ",
    plNoOpenSeason: "no open season",
    plBedGone: "that bed isn\u2019t on the map any more",
    plNoDraftToPlant: "this bed has no draft plan to plant yet; choose a plant team or design it yourself on the Plan tab first",
    plYearMismatch: "You\u2019re planting in {year}, but the open season is {open}. Start the {year} season and plant there, so its dates land in the right year.",
    plAndMore: "{list}, and {n} more",
    plNudgeBeforeFrost: "Your last spring frost (around {date}) hasn\u2019t passed yet. Frost-tender crops here ({crops}) can be set back or killed by a late frost. You can plant anyway, or wait until after it.",
    plNudgeAfterFreeze: "Your first fall frost (around {date}) has already passed, so it\u2019s late to plant {crops} outdoors. You can plant anyway, or start next season instead.",
    plNudgeTooLate: "Planted today, {crops} likely won\u2019t reach maturity before your first fall frost (around {date}). You can still plant, but the harvest window is tight.",
    plNudgeTooLateHard: "Planted today, {crops} likely won\u2019t reach maturity before your first hard freeze (around {date}). You can still plant, but the harvest window is tight.",
    plPartShadeLc: "part shade",
    plFullSunLc: "full sun",
    plFirstBedPots: "Growing in pots? Show a pot instead \u203a",
    plJobSowClimber: "sow the climber",
    plJobSupport: "put the support in",
    plHeldBy: "{crop} is what holds it back: it needs about {days} days to ripen before your first fall frost, around {freeze}.",
    plHeldByHard: "{crop} is what holds it back: it needs about {days} days to ripen before your first hard freeze, around {freeze}.",
    plGlossTeam: "plant team",
    plGlossTier: "tier",
    plYearMismatchStart: "You\u2019re planting in {year}, but the open season is {open}. Starting the {year} season keeps this planting's dates in the right year.",
    plAlreadyInOne: "{n} of this team's plants is already in the ground here. It keeps its own dates, and this adds the other {added} dated today.",
    plAlreadyInMany: "{n} of this team's plants are already in the ground here. They keep their own dates, and this adds the other {added} dated today.",
    plBedGoneStraight: "that bed isn't on the map any more",
    plSheetNoPlants: "this bed has no plants yet; choose a team, or plant it, first",
    plSheetKicker: "The {year} planting",
    plPlanted: "Planted",
    plSheetAriaPlan: "where each plant goes in {bed}",
    plSheetAriaPlanted: "what is planted in {bed}",
    plSheetCapPlan: "Where each plant goes. North is up.",
    plSheetCapPlanted: "What's in this bed. North is up.",
    plSheetToGather: "To gather",
    plSheetNotSized: "Not sized yet. Set a location on the Where step",
    plSheetSeedBoxCovers: "Your seed box covers it, so there's nothing to buy",
    plInSeedBox: " - in your seed box",
    plPlantedOn: "Planted {date}",
    plSheetThroughSeason: "Through the season",
    plLastFrostUsually: "last frost usually {date}",
    plFirstFreezeUsually: "first fall frost usually {date}",
    plTaskSow: "sow {plant}",
    plTheClimber: "the climber",
    plTaskItsSupport: "(its support: {plant})",
    plTaskNoteFreeze: "note the first fall frost",
    plTaskAfterFrost: "plant after last frost",
    plTaskBeforeFrost: "plant before your last frost",
    plSheetNothingDated: "Nothing dated for this bed yet. Dates show up in the Calendar as the season goes on.",
    plSheetFoot: "Grown from Milpa Gardens \u00b7 {date}",
    wyWhatTheseWordsMean: "What these words mean",
    wyLoading: "Loading\u2026",
    wyRulesAboutThePlants: "rules about the plants in your garden",
    wySections: "sections",
    wyFilterRulesByKind: "filter rules by kind",
    wySearchRulesFolkloreTry: "Search rules and folklore",
    acLoading: "Loading\u2026",
    acMeasurement: "Measurement",
    acMetresCmM: "Meters \u00b7 cm \u00b7 m\u00b2",
    acFeetInchesFt: "Feet \u00b7 inches \u00b7 ft\u00b2",
    acTemperature: "Temperature",
    acTheme: "Theme",
    acMatchMyDevice: "Match my device",
    acLight: "Light",
    acDark: "Dark",
    acSeason: "Season",
    acFollowTheSeasons: "Follow the seasons",
    acSpring: "Spring",
    acSummer: "Summer",
    acAutumn: "Autumn",
    acWinter: "Winter",
    acOnHomeShow: "On Home, show",
    acEverythingTheGardenAsks: "Every garden task",
    acJustTheTwoThat: "Just the two that matter most",
    acMyGardenIs: "My garden is",
    acNotSaid: "Not said",
    acInTheGround: "In the ground",
    acRaisedBeds: "Raised beds",
    acPots: "Pots",
    acAPlotThatChanges: "A plot that changes (community or rented)",
    acItSMostlyFor: "It's mostly for",
    acFoodForTheHousehold: "Food for the household",
    acFlowersAndPollinators: "Flowers and pollinators",
    acGrowingWithKids: "Growing with kids",
    acAsLittleWorkAs: "As little work as possible",
    acGrowingFoodFor: "Growing food for",
    acBackgroundGarden: "Background garden",
    acShowIt: "Show it",
    acHideIt: "Hide it",
    acSignIn: "Sign in",
    acEmail: "Email",
    acPassword: "Password",
    acUseAtLeastCharacters: "Use at least 8 characters. A password manager's suggestion is perfect here.",
    acNewHere: "New here?",
    acHaveAnAccountAlready: "Have an account already?",
    acBackToSignIn: "Back to sign in",
    acSignOut: "Sign out",
    acSignOutEverywhere: "Sign out of every device",
    acSignOutEverywhereHint: "Use this if your password may have leaked. Every device signed in to this account, this one included, will need to sign in again.",
    acSignedOutEverywhere: "Signed out of every device.",
    acMyAccount: "My account",
    acReadHowYourData: "Read how your data is kept",
    wyStyleGuide: "The style guide, every piece the app is drawn with",
    acMeasurementUnits: "measurement units",
    acTemperatureUnits: "temperature units",
    acColourTheme: "color theme",
    acSeasonalColours: "seasonal colors",
    acHowMuchHomeNames: "how much Home names each week",
    acWhatKindOfSpace: "what kind of space the garden is",
    acWhatTheGardenIs: "what the garden is mostly for",
    acAdultsTheGardenFeeds: "adults the garden feeds",
    acChildrenTheGardenFeeds: "children the garden feeds",
    acTheSeasonalGardenBehind: "the seasonal garden behind the page",
    acNewPassword: "New password",
    acNewEmailAddress: "new email address",
    acNewEmail: "New email",
    acCircleName: "circle name",
    acNameThisCircle: "Name this circle",
    acCurrentPassword: "Current password",
    rvBeatEndFrost: "ended by frost",
    rvBeatEndDisease: "lost to disease",
    rvBeatEndPest: "lost to pests",
    rvBeatEndPulled: "pulled out",
    rvBeatEndDrought: "lost to drought",
    rvBeatEndUnknown: "ended, cause unknown",
    rvWhyHeld: "Why these are held",
    acErrWrongPassword: "That email and password don't match. Check for typos and try again, or use \u201cforgot password\u201d below to reset it.",
    acErrUnconfirmed: "This account's email was never confirmed, so it can't sign in yet. Find the confirmation email in your inbox (check spam too) and open its link, then sign in again.",
    acErrAlreadyRegistered: "This email already has an account. Sign in instead, or use \u201cforgot password\u201d if the password is lost.",
    acErrRateLimit: "The backend limits how often these emails can go out. Give it a minute, then try once more.",
    acErrLinkExpired: "This link has expired or was already used, so it can't sign you in. Links only work once and for a limited time. Get a fresh one below, then open it from the device you'll garden on.",
    acDismiss: "Dismiss",
    acResendConfirmation: "Resend the confirmation email",
    acErrEnterEmailInForm: "Enter your email in the sign-in form first.",
    acResendSent: "If {email} has an unconfirmed account, a fresh confirmation email is on its way. Check your inbox and your spam folder.",
    acStatusNoBackend: "Accounts aren't open yet. Everything works on this device, and your data will carry into your account when they are.",
    acStatusSignedIn: "Signed in as {email}. Your addresses, areas, and seasons sync to your account; the plant knowledge is a public file and never leaves this device's bundle.",
    acStatusSignedOut: "Sign in (or create an account) to carry your garden and its diary to any device, with a daily backup.",
    acChipTitleIn: "signed in as {email}. Tap for account",
    acJustNow: "just now",
    acMinAgo: "{n} min ago",
    acHoursAgo: "{n} h ago",
    acLastSynced: "Last synced {when}.",
    acLastSyncedBehind: "Last synced {when}. Some changes are still on this device; they retry on your next change or sign-in.",
    acErrSignInFirst: "Sign in first",
    acErrSessionExpired: "Your sign-in expired on this device. Sign in again to resume syncing. Everything on this device is safe.",
    acSessionEndedNote: "Your sign-in on this device has ended, so your gardens are hidden here for now.",
    acSessionEndedSafe: "They're safe. Sign in again and they'll be right back. Forgot your password? You can reset it from the sign-in form.",
    acSessionEndedSignIn: "Sign in again",
    acErrEmailLimit: "Too many emails have gone out from Milpa in the last hour, so this one couldn't be sent. Please try again in an hour. Your account is fine.",
    acErrTooManyTries: "There have been a lot of tries in a short time, so this is paused for a few minutes. Wait a little, then try again.",
    acErrCantReach: "We couldn't reach your account just now. Check your connection and try again. Everything on this device is safe.",
    acErrServiceDown: "Milpa's accounts aren't answering right now. Try again in a few minutes. Everything on this device is safe.",
    acGardenFallbackName: "Garden",
    acThisDeviceGardenName: "{name} (this device)",
    acSplitNote: "This device's \"{name}\" sat on different ground than your account's garden, so it was kept separately as \"{kept}\".",
    acErasedNote: "Deleted the garden \"{name}\" on this device too, because it was deleted from your account. A safety copy stays on this device.",
    acEraseFailed: "Couldn't apply the deletion of \"{name}\": {error}",
    acSharedGone: "You no longer have access to \"{name}\", so it's gone from this device.",
    acSharedGoneKept: "Your latest changes there didn't reach it. A safety copy stays on this device.",
    acSkippedKind: "Skipped a record this version doesn't know (\"{kind}\"). A newer version of the app may have written it.",
    acRefusedApply: "Couldn't apply {kind} {key}: {error}",
    acRefusedMerge: "Couldn't merge {kind} {key}: {error}",
    acSyncPartial: "Some changes couldn't sync. They stay safe on this device and will retry.",
    acAutoSyncRetry: "auto-sync will retry on your next change or sign-in.",
    acAutoSyncFailed: "Auto-sync failed: {error}",
    acItWillRetry: "it will retry on your next change or sign-in.",
    acWorking: "Working\u2026",
    acErrNoBackend: "Accounts aren't open yet, so there's nothing to sign in to. Everything works on this device.",
    acErrEmailAndPassword: "Enter your email and your password.",
    acCreateAccount: "Create account",
    acErrPasswordShort: "Use at least 8 characters",
    acSignupSent: "If {email} is new, a confirmation link is on its way. Open it to finish, then sign in. Give it a few minutes, and check your spam folder.",
    acSignupAlreadyHave: "Already have an account with this email? Sign in above, or use \"forgot password\".",
    acAccountCreatedToast: "Account created. Signed in as {email}",
    acSignedInToast: "Signed in as {email}. Calendar and Log are open",
    acErrEnterEmailAbove: "Enter your email above first",
    acRecoverySent: "If {email} has an account, a recovery link is on its way. Open it on this device and you'll be prompted for a new password. Check your spam folder if you don't see it.",
    acPasswordChanged: "Password changed. This doesn't sign out your other devices, so if you're changing it because the old one may have leaked, sign out on those separately.",
    acErrEnterNewEmail: "Enter the new email first",
    acEmailChangeSent: "Two confirmations are on the way, one to your current address and one to {email}. The change takes effect only after you open both links, which is how we make sure it's really you moving the account. Check both inboxes, spam included.",
    acSignedOutToast: "Signed out. Your account's gardens are hidden on this device until you sign back in",
    acSignedOutGone: "Signed out. Your gardens are safe in your account and have been removed from this device.",
    acSignedOutPhotos: "Signed out. Your gardens are safe in your account and have been removed from this device. Your photos only live here, so they stay, hidden until you sign back in.",
    acSignedOutGoneDrafts: "Signed out. Your account's gardens are safe in your account and have been removed from this device. The gardens you made while signed out are still here.",
    acSignedOutPhotosDrafts: "Signed out. Your account's gardens are safe in your account and have been removed from this device. The gardens you made while signed out are still here. Your photos only live here, so they stay, hidden until you sign back in.",
    acSignOutOffline: "We couldn't reach your account, so your latest changes haven't been saved there yet. Stay signed in until you're back online, or sign out now and keep a hidden copy on this device.",
    acStaySignedIn: "Stay signed in",
    acSignOutKeepCopy: "Sign out and keep a hidden copy",
    acErrTypeDeletePhrase: "Type \"{phrase}\" in the confirmation box to go ahead.",
    acErrDeletePassword: "Enter your current password too. Deleting can't be undone, so we check it's really you.",
    acAccountDeleted: "Your account is deleted, and so is its copy on this device.",
    acAccountDeletedDrafts: "Your account is deleted, and so is its copy on this device. The gardens you made without signing in are still here.",
    acAccountDeletedKept: "Your account is deleted. Its copy on this device couldn't be removed just now, so it stays hidden here and no other account can see it.",
    acRecoveryVerified: "Recovery link verified. Set a new password right now, in the field below. Your old password keeps working until you replace it.",
    acEmailConfirmedWelcome: "email confirmed. You're signed in as {email}. Welcome.",
    acOpenInUsualBrowser: "If this opened inside your mail app, open milpa.garden in your usual browser and sign in there with your password. You're signed in only on this screen.",
    acIgnoredLink: "Ignored a sign-in link for {email}. You're already signed in as {current}. Sign out first if you really meant to switch accounts.",
    acLinkWantsSignIn: "This link wants to sign you in as {email}.",
    acLinkContinueOnly: "Continue only if you just followed a link from your own email (password recovery or signup confirmation). If someone else sent you this link, ignore it.",
    acSignInAs: "Sign in as {email}",
    acIgnoreLink: "Ignore this link",
    acLinkIgnored: "sign-in link ignored. Nothing changed.",
    acLinkDidntVerify: "the link didn't verify: {error}",
    acConfirmSignupHead: "One tap to finish making your account.",
    acConfirmSignupBody: "This confirms the email address the link was sent to, then names the account before anything signs in. Nothing happens until you tap.",
    acConfirmSignupTap: "Confirm my email",
    acConfirmRecoveryHead: "Ready to set a new password?",
    acConfirmRecoveryBody: "This link is for a password reset. Tap to open it, and you'll choose the new password right here. Your old one keeps working until you do.",
    acConfirmRecoveryTap: "Open the reset",
    acConfirmEmailChangeHead: "Moving your account to a new address.",
    acConfirmEmailChangeBody: "This confirms one of the two links the change needs. Nothing happens until you tap.",
    acConfirmEmailChangeTap: "Confirm this change",
    acSendNewResetLink: "Send a new reset link",
    acTypeEmailThenResend: "Type your email in the sign-in form first, then tap \u201cResend the confirmation email\u201d.",
    acEmailChangeHalfDone: "Confirmed. Now open the link that went to your other address to finish the change.",
    acSignupConfirmedAsk: "{email} is confirmed. Sign in on this device as that account?",
    acSignupContinueOnly: "Continue only if that's your own email. If someone else sent you this link, tap Ignore and nothing more happens.",
    acLinkErrorHelp: "Type your email in the sign-in form first, then tap \u201cResend the confirmation email\u201d. If it was a password reset link that failed, use \u201cforgot password\u201d for a new one.",
    acLinkErrorHelpFilled: "Your email is filled in below, so one tap on \u201cResend the confirmation email\u201d sends a fresh link. If it was a password reset link that failed, use \u201cforgot password\u201d for a new one.",
    acGateCalendarKeep: "This calendar draws live from what this device knows: the frost odds around {frost}, and any beds you've planned. One tap exports it, reminder included.",
    acGateFrost: "your site's real median last frost",
    acGateFrostDated: "your site's real median last frost ({date})",
    acGateCalendarSignIn: "Sign in (or create a free account) and these dates, and everything you log, are kept on every device.",
    acGateLogBehind: "Your log keeps track of what grew where, right here on this device, so rotation warnings follow your actual ground, and after three seasons your own frost records take over from the general estimate for your yard.",
    acGateLogSignIn: "Sign in (or create a free account) and it follows you to every device, with a daily backup. The plain-file export on this page is yours either way.",
    acGateReviewBehind: "The season review is built from your own log: what grew and what it suffered, what your logged frosts show, and what next year's rotation allows on each bed, with every warning cited.",
    acGateReviewSignIn: "Like the log it reads, it's kept on this device; sign in and it follows you to every device.",
    acGateSignInBtn: "Sign in / create account",
    pnOnionLongDay: "long-day onion country. Short-day cultivars bulb early and stay small here.",
    pnOnionShortDay: "short-day onion country. Long-day kinds may never bulb at this latitude.",
    pnOnionChangeover: "on the onion changeover (~35\u201338\u00b0). Intermediate-day cultivars are the safe pick here.",
    apShareNothing: "Nothing to share yet. Trace a bed or add a plant first, and the plan packs itself into a link.",
    apShareTravels: "The plan is packed into the link itself, so nothing is stored anywhere. It's a snapshot, so later edits won't change it.",
    apShareTitle: "My garden plan",
    apShareCopied: "Link copied.",
    apFamHintChanging: "New plot? If you know what grew here before you took it on, tick it and we'll flag anything you shouldn't plant yet. Not sure? Leave it blank. Once you plant this bed, its history is recorded automatically.",
    apFamHint: "Tick what grew here in the last season or two and we'll flag anything you shouldn't replant yet. Once you plant this bed, its history is recorded automatically.",
    apHandoffLogHtml: "<strong>This garden's plan is taking shape. Start its log.</strong> Open the Log, start the season, and log what you plant (or what's already growing). The Calendar dates and next year's rotation warnings come from there.",
    apHandoffLogBtn: "Open the Log",
    apNudgeDates: "See your team\u2019s dates on the calendar\u00a0\u203a",
    apNudgePick: "Pick a team to put its dates on your calendar\u00a0\u203a",
    apNudgeOwn: "No team fits this bed, so choose its plants yourself \u203a",
    apReachNote: "Too wide to reach across the middle. Split it into two beds with a path between.",
    apContainerNote: "That is larger than a typical container (about {cm} cm across, a half-barrel). A raised or in-ground bed may fit it better.",
    apLocationFromCentre: "location set from the map center: {lat}, {lon}.",
    apNoteZipMiddle: "the middle of your ZIP code; drag the pin to your garden",
    apNoteApprox: "approximate",
    apNoteStreet: "the street, so drag the pin to your house after",
    apPinnedLabel: "Pinned: {label}. Tap the map to move the pin if it landed off.",
    apPinnedLabelNote: "Pinned: {label}. ({note}.) Tap the map to move the pin if it landed off.",
    apFindingYou: "Finding you\u2026",
    apPinnedHere: "Pinned at your location.",
    apLocationOff: "Location is off for this site. Type the address instead.",
    apLocationFailed: "Couldn't get your location just now. Type the address instead.",
    apUseZip: "Use ZIP {zip} from earlier",
    apUsePlace: "Use {place} from earlier",
    apPinnedZip: "Pinned: the middle of ZIP {zip}. Tap the map to move the pin to your garden.",
    apPinning: "pinning {place}\u2026",
    apLookingUp: "Looking up the address\u2026",
    apCouldNotPin: "could not pin that one. Add the town and country.",
    apNoMatch: "We couldn\u2019t find that address. Add the town and country, or tap the map to drop the pin.",
    apLookupDown: "We couldn\u2019t reach the address lookup just now. Check your connection and try again, or tap the map to drop the pin.",
    apOneMatch: "one match. Tap it to set your pin:",
    apTapYourAddress: "tap your address:",
    apFindingAddresses: "Finding addresses\u2026",
    apNoMatchesYet: "No matches yet. Keep typing.",
    apLogFailed: "season log failed to start: {error}",
    apPresetRaised: "Raised bed",
    apPresetSquare: "Square bed",
    apPresetRow: "Row",
    apPresetContainer: "Container",
    apPresetLabel: "{w} \u00d7 {l} {unit} {what}",
    apPresetTitle: "one tap makes this bed. You can resize or move it on the map afterwards",
    apDimBothNumbers: "Give both numbers: about how wide and about how long. Rough is fine.",
    apErrStorageOpening: "storage is still opening. Try again in a second",
    apMadeBed: "Made \"{name}\". Its fit verdicts are below. Trace it on the map whenever you like.",
    apLocatedFromZip: "Located from your ZIP {zip}. Add your address for a house-level pin.",
    apLoadFailed: "Couldn't load Milpa Gardens.",
    apPageLoading: "Getting this page ready\u2026",
    apPageLoadFailed: "This page didn't load. Check your connection, then reload.",
    apPageReload: "Reload",
    apPanelNeedsConnection: "This part needs a connection. Once you're back online, reload the page.",
    gmHomeGarden: "Home",
    acSheetTitle: "Sign in",
    gmPinMoved: "Pin moved. Your dates and plant teams follow it.",
    gmCatFruitingVeg: "Fruiting vegetables",
    gmCatHerbs: "Herbs",
    gmCatFruit: "Fruit & berries",
    gmCatSalad: "Salad & greens",
    gmCatRoots: "Roots & tubers",
    gmCatBeans: "Beans & peas",
    gmCatCover: "Cover crops & soil builders",
    gmCatAllium: "Onions & garlic",
    gmCatFlowers: "Flowers",
    gmCatOther: "Other plants",
    gmZoneOneOf: "{name} - 1 of {n}",
    drClaimEggshells: "Do eggshells stop slugs?",
    drClaimEpsom: "Do Epsom salts stop blossom end rot?",
    drClaimMarigolds: "Do marigolds keep pests away?",
    drClaimCoffee: "Do coffee grounds make soil acidic?",
    drClaimMoon: "Does planting by the moon work?",
    drClaimShards: "Do pot shards help a container drain?",
    drSitEarlyLabel: "I want to get going early",
    drSitEarlyWhy: "What goes out BEFORE your last frost, and how far before",
    drSitContainersLabel: "I only have containers",
    drSitContainersWhy: "What fits a pot, by root depth and spread",
    drSitLateLabel: "It's already late to start",
    drSitLateWhy: "The crops that finish fastest, by days to maturity",
    drSitShadeLabel: "My garden is shady",
    drSitShadeWhy: "What tolerates shade, and the rule that keeps sun-lovers out of it",
    drSitClayLabel: "I have heavy clay",
    drSitClayWhy: "What heavy clay needs, and why adding sand makes it worse",
    hfDayMonth: "{day} {month}",
    glossFirstFrostTerm: "first frost",
    glossFirstFrostBody: "The day your first fall frost usually comes. Tender crops like tomatoes, beans and squash die in it, so it ends their season.",
    glossTitle: "what this means",
    glossMore: "More\u00a0\u203a",
    glossTeamTerm: "plant team",
    glossTeamBody: "A few plants grown together because they help each other, such as one that climbs, one that feeds the soil and one that shades out weeds. The whole team has to fit in the bed.",
    glossWindowTerm: "window",
    glossWindowBody: "The stretch of days when a crop can still go in and ripen before your first frost. Miss the far end and it runs out of season.",
    glossRotationTerm: "rotation",
    glossRotationBody: "Moving each plant family to different ground every year, so the same family never grows in one spot two years running. It starves the pests and diseases that overwinter there waiting for it.",
    glossZoneTerm: "zone",
    glossZoneBody: "How cold your winters get, on the USDA scale. It decides which perennials live through them. Annuals finish in one season, so your zone doesn't limit them.",
    glossFitTerm: "fit verdict",
    glossFitBody: "Whether a bed is big enough and gets enough sun for a team. The answer is a plain yes, or a grayed no with the reason.",
    glossTierTerm: "measured, modeled or estimated",
    glossTierBody: "How sure we are of a number. It was measured at a weather station, modeled from the terrain nearby, or estimated from farther off, and the app always says which.",
    glossMedianTerm: "median",
    glossMedianBody: "The middle of the range, where half the years the date falls earlier and half later. A median frost date is a coin flip, so the app also shows how late a cold year can still run.",
    glossEstablishedTerm: "well established",
    glossPromisingTerm: "promising",
    glossHunchTerm: "a good hunch",
    hfGlanceAria: "Your garden, drawn from above: {beds}",
    feedJustNow: "just now",
    feedMins: "{n} min ago",
    feedHours: "{n} h ago",
    feedDaysOne: "{n} day ago",
    feedDaysMany: "{n} days ago",
    gkSeasonsOwnRecord: "Your own rough frost dates. No weather station or model covers this garden, and enough seasons are logged that the calendar now plans from your own records.",
    akExplFrost: "two minutes on why your zone doesn't know your frost date",
    akExplRotation: "two minutes on why history lives in the ground",
    akExplPollination: "two minutes on what pollination needs",
    akPosLastFrostOne: "last frost is about {n} week out",
    akPosLastFrostMany: "last frost is about {n} weeks out",
    akPosPastFreeze: "the season is past its first fall frost",
    akPosFirstFreezeOne: "first fall frost is about {n} week away",
    akPosFirstFreezeMany: "first fall frost is about {n} weeks away",
    akPosFullSwing: "the season is in full swing",
    akKickerAroundNow: "Around now",
    akFrostFallQ: "Freeze season. Saw frost? Tap the date.",
    akFrostSpringQ: "Frost season. Tap the last frost you see.",
    akFrostWhySpringLogged: "It's your frost season. The last one usually lands near {date}. You've logged {n} of {min} seasons. {left} more and your own ground's dates replace the general estimate for every sow date on the calendar.",
    akFrostWhySpringFirst: "It's your frost season. The last one usually lands near {date}. After {min} logged seasons your own dates supersede the general estimate, and every sow date moves to match your yard.",
    akFrostWhyFallLogged: "First fall frost usually arrives near {date}. You've logged {n} of {min} seasons. {left} more and your own ground's dates replace the general estimate for every sow date on the calendar.",
    akFrostWhyFallFirst: "First fall frost usually arrives near {date}. After {min} logged seasons your own dates supersede the general estimate, and every sow date moves to match your yard.",
    akFrostGo: "Log the frost",
    akKickerThisWeek: "This week",
    akGapQ: "You planned {bed}. Is it in the ground yet?",
    akGapWhy: "Mark what you planted and the calendar starts counting real days. Your harvest window comes from YOUR planting date.",
    akGapGo: "Mark it planted",
    akAgoOne: "{n} day ago",
    akAgoMany: "{n} days ago",
    akWhenToday: "today",
    akWhenTomorrow: "tomorrow",
    akInDays: "in {n} days",
    akHarvestQ: "{crop} reaches its harvest window {when}. Start checking.",
    akHarvestQBed: "{crop} in {bed} reaches its harvest window {when}. Start checking.",
    akHarvestQPast: "{crop} came into its harvest window {when}. Start checking.",
    akHarvestQBedPast: "{crop} in {bed} came into its harvest window {when}. Start checking.",
    akHarvestEndQ: "{crop} is near the end of its harvest window, which likely closes {when}. Pick what's ready while you can.",
    akHarvestEndQBed: "{crop} in {bed} is near the end of its harvest window, which likely closes {when}. Pick what's ready while you can.",
    akHarvestEndQPast: "{crop} reached the likely end of its harvest window {when}. Pick what's left.",
    akHarvestEndQBedPast: "{crop} in {bed} reached the likely end of its harvest window {when}. Pick what's left.",
    akTaskLands: "A dated task lands {when}.",
    akHarvestWhy: "Counted from the planting date on your own log. Log a pick and the note rides the bed's history.",
    akTaskWhy: "On your calendar for {date}, from the same arithmetic the Calendar page shows.",
    akOpenBedLog: "Open {bed} on the Log",
    akOpenCalendar: "Open the Calendar",
    akKickerReady: "When you're ready",
    akPhQ: "A pH reading unlocks the acidity verdicts for {crop} and everything else standing in the bed.",
    akPhQPlanned: "A pH reading unlocks the acidity verdicts for {crop} and everything else you've planned.",
    akPhWhy: "A kit reading counts, and a soil lab tests it properly; the soil card says how to find one. The checks start as soon as a kit reading or a lab's pH in water is on record.",
    akPhGo: "Record a pH",
    akPhMethodQ: "Which pH did your lab give? A pH in water unlocks the acidity verdicts for {crop}.",
    akPhMethodWhy: "Your lab's pH is saved. The report says which it is, usually as pH (water) or pH (CaCl2).",
    akPhMethodGo: "Say which pH",
    akPhWaterQ: "A pH in water unlocks the acidity verdicts for {crop}.",
    akPhWaterWhy: "The lab pH on record was measured in a salt solution, and the plant ranges here are in water pH. Many labs can give you both, and a kit reading counts too.",
    akKickerRain: "After the next soaking rain",
    akDrainQ: "Did water stand in the bed? One answer arms the waterlogging warning.",
    akDrainWhy: "Only you can see how your ground drains. The app has no weather feed, so it can't know it rained. Next time it pours, look, then log what you saw.",
    akDrainGo: "Record it",
    akKickerBefore: "Before you plant more",
    akForageQ: "{crop} needs an insect to move its pollen, and nothing else standing here is in flower while it does.",
    akForageWhy: "Nothing can guarantee insects. They come from outside your garden, and this suggestion hasn't been proven to work. What you can change is whether anything is flowering alongside it.",
    akForageGo: "See what would help",
    akKickerLook: "One look outside",
    akSunQ: "Does {bed} get full sun? A wall or fence's shade is something only you can see.",
    akSunWhy: "One answer arms the light check for every full-sun plant standing there. If you say it's shaded, sun-lovers are kept out of it.",
    akOpenBed: "Open {bed}",
    akKickerSeason: "Season {year}",
    akCloseQ: "The freeze came. Close the season and see how it went.",
    akCloseWhy: "Closing writes the year into each bed's history. Next spring's plan then uses it to decide which team goes where, based on what grew.",
    akCloseGo: "Close season {year}",
    akKickerPickUp: "Pick up where you left off",
    akLadderQ: "Plant the {crop} you asked about. Your dates are already set.",
    akLadderWhy: "The location and crop you gave before signing up carried over, so you won't be asked twice. The planner starts from them.",
    akLadderGo: "Open the planner",
    akQuietNext: "Nothing needs you right now. Next on the calendar: {date}.",
    akQuietNextCrop: "Nothing needs you right now. Next on the calendar: {date}, {crop}.",
    akQuiet: "Nothing needs you right now.",
    akWaitFrost: "a logged frost starts this season's count",
    akWaitGap: "a planned bed waits to be marked planted",
    akWaitPh: "a pH answer unlocks the acidity verdicts",
    akWaitPhMethod: "saying which pH your lab gave unlocks the acidity verdicts",
    akWaitPhWater: "a pH in water unlocks the acidity verdicts",
    akWaitDrainage: "a drainage answer arms the waterlogging warning",
    akWaitSun: "a sun answer arms the light check",
    akWaitClose: "the season waits to be closed",
    akWelcome: "Welcome back",
    akWelcomePos: "Welcome back - {pos}",
    akWaitingLine: "Waiting its turn: {list}.",
    akMiniLine: "{kicker}: {q}",
    pfKeptVariety: "{variety} is in your seed box as a {plant}, so it keeps every {plant} rule. When you log it, choose {plant} and pick {variety} as its variety.",
    lgLimitRotation: "its rotation isn't tracked without a family",
    lgLimitPlacement: "it can't be placed in a bed without its spread",
    lgLimitSchedule: "it gets no calendar dates without its days to maturity",
    lgLimitRole: "it can't fill a role in a plant team without at least one trait",
    dsSeeEvidence: "See the evidence",
    dsOpeningExplainer: "Opening the explainer\u2026",
    dsOpeningGuide: "Opening the guide\u2026",
    dsOpeningEvidence: "Opening the evidence\u2026",
    ntStorageLocked: "Another tab has the browser's storage locked. Close other Milpa Gardens tabs and reload.",
    ntBackupGone: "That replaced copy is no longer kept on this device.",
    ntBedNeedsName: "A bed needs a name",
    ntBedExists: "a bed called \u201c{name}\u201d already exists",
    ntNoBed: "no bed \u201c{name}\u201d",
    logTitle: "Your garden diary",
    reviewTitle: "Season review",
    shareTitle: "A shared plan",
    calendarTitle: "Your season, by the date",
    plantTitle: "Plant",
    whyTitle: "Why trust this?",
    tabTitle: "{page} - Milpa Gardens",
    tabStartTitle: "Milpa Gardens - the garden planner that shows its work",
    tabStart: "Home",
    tabPlan: "Plan",
    tabCalendar: "Calendar",
    tabLog: "Log",
    tabReview: "Season review",
    tabWhy: "Why trust this?",
    tabAnswers: "Answers",
    tabAccount: "Account",
    tabShare: "A shared plan",
    tabPlant: "Plant",
    tabNotFound: "Not found",
    lgKickKnown: "The team you know",
    lgKickMaybe: "One you might not",
    lgKickSoil: "Under the soil",
    lgKickEdge: "At the edge of the bed",
    lgPlantsSisters: "Corn \u00b7 Beans \u00b7 Squash",
    lgPlantsHerbs: "Thyme \u00b7 Cabbage",
    lgPlantsCarrot: "Carrots \u00b7 Onions \u00b7 Dill",
    lgPlantsHubbard: "Hubbard squash \u00b7 Cucumber",
    guildCarrotH: "Carrots, onions and dill",
    guildHubbardH: "The hubbard ring",
    lgSeeEvidence: "See the evidence\u00a0\u203a",
    lgGuideHolds: "What actually holds up\u00a0\u203a",
    lgGuideRules: "Every rule and its sources\u00a0\u203a",
    lgGuideSoil: "Why a soil test\u00a0\u203a",
    lgFitsChip: "Three Sisters \u00b7 fits this bed",
    lgPlanAria: "A Three Sisters bed: corn and beans on nine mounds, squash in the gaps between them.",
    shelfEnglish: "These guides are in English for now.",
    clLegPlant: "Plant or sow",
    clLegSow: "Sowing reminders",
    clLegHarvest: "Harvest",
    clLegFrost: "Frost and season end",
    clLegHeat: "Summer heat",
    clLegWater: "Watering",
    clLegEnded: "Logged or ended",
    clLegNotes: "Notes",
    clLegHappened: "Happened",
    clLegPlanned: "Planned",
    lgDateLabel: "Date",
    lgNoteLabel: "What happened",
    bedsheetPrint: "Print",
    bedsheetClose: "Close",
    sheetClose: "Close",
    dossierBarTitle: "The evidence",
    acSignedInLine: "Signed in as {email}. Your log syncs to this account.",
    acAdultsWord: "adults,",
    acChildrenWord: "children",
    plNotch: "notch",
    lgChooseFiles: "Choose files",
    lgNoFileChosen: "No file chosen",
    coachHeading: "New to this? Start with the basics",
    coachHeadingFold: "New to this? Beginner guides",
    langOriginals: "Read in English",
    langOriginalsBack: "Read in Spanish",
    langOriginalsOn: "The wording about your data and where our numbers come from is showing in English, the original.",
    plateStPlanned: "planned",
    plateStGround: "in the ground",
    plateStWindow: "in its window",
    plateStPicked: "picked",
    plateStEnded: "ended",
    plateStCarried: "carried over",
    plateStGhostYear: "last year ({year})",
    plateStGhost: "last year",
    earnNotYet: "Not yet",
    earnEarned: "Earned",
    earnOf: "{n} of {min}",
    earnFrostNoLoc: "Frost dates. Set a location first, and each frost you log will count toward frost dates from your own log.",
    earnFrostLive: "Frost dates. Your own logged frosts supersede the general estimate, and every sow date on the calendar follows your ground's dates.",
    earnFrostLiveOwn: "Frost dates. No weather station or model covers this garden, so your own logged frosts are its rough frost dates, and every sow date on the calendar follows them.",
    earnFrostPartOne: "Frost dates. {left} more frost season and your frost dates come from your own log.",
    earnFrostPartMany: "Frost dates. {left} more frost seasons and your frost dates come from your own log.",
    earnFrostWait: "Frost dates. Log the frosts you see. After {min} seasons, your frost dates come from your own log.",
    earnPhLive: "Soil pH. A measured pH is on record, so the acidity advice now applies to the plants in that ground.",
    earnPhWait: "Soil pH. A measured pH, from a kit or a lab, brings acidity advice to every plant in the bed.",
    earnPhLab: "Soil pH. A lab pH is on record, and the acidity advice needs one measured in water. Your lab can give you that.",
    earnPhUnsure: "Soil pH. A lab pH is on record. Say which pH your lab gave on the soil card, and a pH in water brings the acidity advice.",
    earnDrainLive: "Drainage. Recorded. The waterlogging warning now uses this ground's own answer.",
    earnDrainWait: "Drainage. Answer one question, whether water stands after rain, and the waterlogging warning is ready for that ground.",
    wyBundleInfo: "Plant knowledge version {v}: {teams} plant teams and {rules} rules.",
    plTierA: "measured at a weather station",
    plTierB: "modeled from the terrain nearby",
    plTierC: "estimated from a weather model",
    plTierUnknown: "from the nearest data we have",
    acErrBadEmail: "That doesn't look like an email address. Check it and try again.",
    gkExampleNote: "You're looking at the example garden, so these are its details, not yours.",
    exampleBannerShort: "Example garden",
    stRoundAcross: "round, {d} across",
    stTraced: "traced, {area}, {n} corners",
    stRectAt: "{w} \u00d7 {l} at {x}, {y}",
    stRotated: "{w} \u00d7 {l}, rotated {deg}\u00b0",
    offlineNote: "You're offline. Your garden keeps working on this device. The satellite photo, the address search and syncing wait until you're back online.",
    rsCarried: "recently grown here: {family}",
    rsVertNightshade: "prone to Verticillium wilt, and this ground grew nightshades",
    rsVertHost: "prone to Verticillium wilt, and this ground grew a plant you logged that carries it",
    rsResidueN: "the {family} grown here in {year} left residue that releases nitrogen for this season's crop",
    rsBreakAll: "an onion-family or carrot-family planting breaks the cycle for every family this ground is holding",
    rsIntervalBreak: "this ground is still inside the rotation wait for {families}. An onion-family or carrot-family crop is unrelated to them and breaks the cycle",
    rsStillInside: "rotation wait not over here: {family}",
    rsBanksN: "leaves a full load of legume green manure, so next season's hungry crop gets the nitrogen",
    rsNeedsDays: "needs {dtm} days to ripen, and the frost-free window here is {window} days",
    rsNeedsDaysHard: "needs {dtm} days to ripen, and even counted to the first hard freeze the season here is {window} days",
    rsFullSun: "needs full sun, and this bed is shadier than that",
    rsZoneBelow: "zone {zone} is colder than this plant survives in winter (it's rated for zones {lo} to {hi})",
    rsZoneAbove: "zone {zone} is warmer than the zones {lo} to {hi} this plant is rated for, so look for a variety rated for your zone",
    climCaveatOnSite: "The weather data comes from right where you are.",
    climCaveatNear: "The frost dates come from a weather site {dist} away, so they describe that spot, not your exact ground.",
    climCaveatFar: "The nearest weather site is {dist} away, farther than we trust for exact dates, so treat these as a rough regional sketch.",
    lrNoSite: "Set a location, then log the frosts you see. After three seasons, your frost dates come from your own log.",
    lrLive: "Your own logged frosts now supersede the general estimate, so every sowing date follows your ground's own dates.",
    lrLiveOwn: "Your own logged frosts are this garden's rough frost dates, so every sowing date follows them.",
    lrPartOne: "{left} more frost season and your frost dates come from your own log.",
    lrPartMany: "{left} more frost seasons and your frost dates come from your own log.",
    lrWait: "Log the frosts you see. After {n} seasons, your frost dates come from your own log.",
    acDeletePhrase: "delete my account",
    acDeleteConfirmPh: "Type \"delete my account\"",
    acDeleteConfirmAria: "Deletion confirmation: type \"delete my account\"",
    lgProductAria: "A look at the planner",
    skipToContent: "Skip to the page",
    ocNoSeason: "no season yet",
    ocDormant: "dormant",
    ocDormantCarried: "dormant \u00b7 {n} overwintering",
    ocReady: "ready to plant",
    ocGrowing: "{n} growing",
    ocPlanned: "{n} planned",
    ocOverwintering: "{n} overwintering",
    ocEnded: "{n} ended",
    ocDone: "done for the season",
    bedDefaultName: "Bed {n}",
    bedStructInGround: "In ground",
    bedStructRaised: "Raised",
    bedStructContainer: "Container",
    bedStructField: "Open field",
    navSearchAria: "Search the site",
    lblSupport: "Support",
    lblCanSupport: "Can support a climber",
    lblFixesNitrogen: "Fixes nitrogen",
    lblCastsShade: "Casts shade on neighbors",
    lblBerProne: "Prone to blossom-end rot",
    unitIn: "in",
    unitFt: "ft",
    unitFt2: "ft\u00b2",
    unitFtOne: "ft",
    unitFt2One: "ft\u00b2",
    unitIn2: "in\u00b2",
    unitInchesProse: "inches",
    unitFeetProse: "ft",
    nfTitle: "We can't find that page",
    nfBody: "The link may be old, or cut short when it was copied.",
    nfHome: "Go to Home",
    nfPlan: "Plan a garden",
    accountPromiseTitleIn: "Your garden, on every device",
    acIndexAria: "Account sections",
    acIdxAccount: "Account",
    acIdxDisplay: "Display",
    acIdxGarden: "Your garden",
    acIdxCircles: "Garden circles",
    acIdxData: "Your data",
    acGardenLegend: "Your garden",
    acMenuAria: "Account menu",
    clWarmWhenSpan: "from {from} to {to}",
    clWarmWhenOne: "in {month}",
    clWarmWhenSpanDay: "from {from} to {to}",
    clWarmWhenDays: "from {from} to {to}",
    clWarmWhenDay: "on {date}",
    clWarmSow: "Sow or set out {crop} {when}.",
    clWarmSowAll: "Sow {crop} any month here.",
    clWarmResowOne: "A fresh sowing every week keeps it coming.",
    clWarmResowMany: "A fresh sowing every {n} weeks keeps it coming.",
    clWarmCare: "Every month here is warmer than {crop} likes. The coolest months are its best chance.",
    clWarmAfterOne: "Wait until after {date} to set it out. In about {n} winter in 10, a frost still comes that late.",
    clWarmAfterMany: "Wait until after {date} to set it out. In about {n} winters in 10, a frost still comes that late.",
    clWarmTip: "Frost is rare here, so these months follow the warmth. {crop} grows where a month averages about {min} to {max}, and these are the months here that stay in that range until harvest.",
    clWarmTipCare: "Frost is rare here, and every month is warmer than the {max} or so {crop} grows best under.",
    clWarmNextOpens: "{crop}'s next window opens in {month}.",
    clWinWarmBy: "Sow or set out by {by}. After that, the months here don't suit {crop} until {month}.",
    clWinWarmClosed: "This window closed {by}. {crop}'s next one opens in {month}.",
    clWinWarmReopens: "This window closed {by}. {crop}'s next one opens on {date}, later this season.",
    clSuccTipWarm: "This re-sow still comes ready in months that suit {crop} here.",
    clFloorNoneOne: "No month here averages the {temp} or so {crops} grows in, so outdoors it's unlikely to reach harvest. Grow it under cover.",
    clFloorNoneMany: "No month here averages the {temp} or so {crops} grow in, so outdoors they're unlikely to reach harvest. Grow them under cover.",
    clFloorFewOne: "Here {crops} gets only {months} at the {temp} or so it grows in, fewer than the {n} months in a row it needs. Start it early indoors, choose a quick variety or give it cover.",
    clFloorFewMany: "Here {crops} get only {months} at the {temp} or so they grow in, fewer than the {n} months in a row they need. Start them early indoors, choose quick varieties or give them cover.",
    clFloorApprox: "The cool months here slow it down, so this date is approximate and picking may start later.",
    clWarmLateSow: "Sown after {date}, it would ripen in months cooler than {crop} likes; choose a quick variety or cover it.",
    clWarmLatePlant: "Planted after {date}, it would ripen in months cooler than {crop} likes; choose a quick variety or cover it.",
    clWarmLateStart: "Started after {date}, it would ripen in months cooler than {crop} likes; choose a quick variety or cover it.",
    clWarmLatePlantMany: "Planted after {date}, they would ripen in months cooler than {crops} like; choose quick varieties or cover them.",
    plSeasonAllYear: "Season here: all year, with no frost to plan around.",
    plSeasonAllYearOdds: "Season here: all year, though a frost comes in {n} of {years} winters.",
    plSeasonAllYearGate: "Season here: all year, though tender crops wait until after {date} for frost to pass.",
    homeVoiceFrostSome: "Frost comes in some winters here, so tender crops wait until after {date}, and the rest keep growing the whole year round.",
    homeVoiceFrostSomeNoDate: "Frost comes in some winters here, so tender crops wait for your own last frost, and the rest keep growing the whole year round.",
    homeVoiceFrostMost: "Frost comes in most winters here, so tender crops wait until after {date}, and frost can come later than that.",
    homeVoiceFrostMostNoDate: "Frost comes in most winters here, so tender crops wait for your own last frost.",
    clFrostSome: "Frost comes in some winters here. In the years it does, the last frost usually comes by about this date.",
    clFrostSomeLate: "Frost comes in some winters here. In the years it does, the last frost usually comes by about this date, and 1 year in 10 as late as {date}.",
    plFrostSome: "in some winters",
    clWarmTipSome: "Frost comes in some winters here, and these months follow the warmth: {crop} grows where a month averages about {min} to {max}, and these are the months here that stay in that range until harvest.",
    clWarmTipCareSome: "Frost comes in some winters here, and every month is warmer than the {max} or so {crop} grows best under.",
    plOwnFrostWarnSome: "This frost count comes from a weather model whose squares are about 25 km across. In hills, inland valleys and suburbs away from the coast, cold still nights can bring frost more often, and later in spring, than it shows. If you know your own frost dates, enter them and your plans will follow them.",
    plOwnFrostWarnRare: "Frost is rare in this weather model's square, which is about 25 km across. In hills, inland valleys and suburbs away from the coast, cold still nights can still bring frost in most winters. If you know your own frost dates, enter them and your plans will follow them.",
    anModelWarn: "These frost dates come from a weather model whose squares are about 25 km across. In hills and inland valleys, cold still nights can bring frost weeks later in spring and earlier in fall than it shows.",
    anModelWarnSome: "This frost count comes from a weather model whose squares are about 25 km across. In hills, inland valleys and suburbs away from the coast, cold still nights can bring frost more often, and later in spring, than it shows.",
    anModelWarnRare: "Frost is rare in this weather model's square, which is about 25 km across. In hills, inland valleys and suburbs away from the coast, cold still nights can still bring frost in most winters.",
    plFrostOddsQ: "\u00b7 a frost in {n} of the last {years} winters",
    plFrostNoneQ: "\u00b7 none in the last {years} winters",
    clRainsPlant: "Plant {crop} as the rains begin, around {month}.",
    clRainsTip: "A young tree's roots haven't reached deeper moisture yet, so it settles in on steady rain. Planted earlier, water it every two to three days until the rains come.",
    lgErrFutureDate: "That date hasn't come yet. Pick the day it happened.",
    lgEntryMoved: "This entry has changed since you opened it. Take another look.",
    lgEditAria: "Edit or delete this entry: {entry}",
    lgDeleteEntry: "Delete",
    lgEntryDeleted: "Deleted your entry from {day}.",
    lgEntrySaved: "Your change is saved.",
    lgUndo: "Undo",
    lgUndone: "Put back as it was.",
    lgFutureOne: "One entry is dated after today. Was the date a slip?",
    lgFutureMany: "{n} entries are dated after today. Were the dates a slip?",
    lgFutureRow: "{day}: {text}",
    lgFutureFix: "Fix the date",
    lgFutureDelete: "Delete it",
    lgFutureKeep: "Keep it",
    lgMovedOne: "One entry was filed under the wrong year, so it's moved to {year}, the year of its date.",
    lgMovedMany: "{n} entries were filed under the wrong year, so they're moved to {year}, the year of their dates.",
    lgMovedShow: "Show {year}",
    lgMovedOk: "Got it",
    lgYearOne: "{n} entry",
    lgYearMany: "{n} entries",
    plFrostMost: "in most winters",
    plFrostSomeYears: "in some years",
    plFrostMostYears: "in most years",
    plFrostOddsQYears: "\u00b7 a frost in {n} of the last {years} years",
    plFrostNoneQYears: "\u00b7 none in the last {years} years",
    fsCountQ: "\u00b7 a frost in {n} of {years} winters on record at the {station} weather station, {dist} away",
    fsCountNoneQ: "\u00b7 no frost in {years} winters on record at the {station} weather station, {dist} away",
    fsCountQYears: "\u00b7 a frost in {n} of {years} years on record at the {station} weather station, {dist} away",
    fsCountNoneQYears: "\u00b7 no frost in {years} years on record at the {station} weather station, {dist} away",
    fsNote: "This frost count comes from a weather station {dist} from your garden. In hills, inland valleys and suburbs away from the coast, frost can come more often than at the station.",
    fsNoteAnswers: "This frost count comes from a weather station {dist} from this spot. In hills, inland valleys and suburbs away from the coast, frost can come more often than at the station.",
    fsNoteEvery: "This frost count comes from a weather station {dist} from your garden. Hollows and low ground nearby can frost later in spring and earlier in fall than the station does.",
    fsNoteAnswersEvery: "This frost count comes from a weather station {dist} from this spot. Hollows and low ground nearby can frost later in spring and earlier in fall than the station does.",
    fsNoteBare: "This frost count comes from a weather station {dist} from your garden.",
    fsNoteAnswersBare: "This frost count comes from a weather station {dist} from this spot.",
    fsNoteRare: "This frost count comes from a weather station {dist} from your garden. In hills, inland valleys and suburbs away from the coast, cold still nights can still bring frost, more often than at the station.",
    fsNoteAnswersRare: "This frost count comes from a weather station {dist} from this spot. In hills, inland valleys and suburbs away from the coast, cold still nights can still bring frost, more often than at the station.",
    fsModelAside: "The weather model this app reads saw a frost here in {m} of {my} winters, with the last one around {date}. Milpa goes by the station's own record, so your plans follow the warmth of each month.",
    fsModelLater: "The date tender crops wait for, {date}, comes from the weather model, which saw a frost here in {m} of {my} winters. The station saw one more often, so frost can come later than that.",
    fsModelNoDate: "The weather model this app's dates come from saw no frost here, so no planting date waits for one.",
    fsModelNoDateFew: "The weather model this app's dates come from saw a frost here in only {m} of {my} winters, too few to give a date, so no planting date waits for one.",
    fsOwn: "If you know your own frost dates, enter them and your plans will follow them.",
    fsModelDates: "The frost dates are the weather model's, from a square about 25 km across, so in hills and inland valleys frost can come weeks later in spring and earlier in fall than they show.",
    fsFoldLead: "Frost count",
    fsFoldRest: " - the {station} weather station's own, {dist} from your garden, from NOAA's GHCN-Daily daily lows for {frost_count_start} to {frost_count_end}: {n} of its {years} winters on record had a night at or below {zero}. A winter counts when the station recorded its three coldest months.",
    fsFoldModel: " Any frost dates here are the weather model's.",
    fsDates: "These frost dates are the {station} weather station's own, from {years} years of its daily lows. Hollows and low ground nearby can frost later in spring and earlier in fall than the station does.",
    fsWordMost: "Frost comes in most winters here: the {station} weather station, {dist} away, recorded one in {n} of {years}.",
    fsWordSome: "Frost comes in some winters here: the {station} weather station, {dist} away, recorded one in {n} of {years}.",
    fsDatesTwo: "The dates are the {dstation} station's, {ddist} away, which has the longer record.",
    fsDatesTwoLater: "The dates are the {dstation} station's, {ddist} away, which has the longer record, so frost can come later than they show.",
    fsGate: "A frost-tender crop waits until after {date}, the {station} weather station's own late frost date, from {years} years of its daily lows. Hollows and low ground nearby can frost later than the station does.",
    fsGateTwo: "A frost-tender crop waits until after {date}, the late frost date of the {dstation} weather station, {ddist} away, which has the longer record.",
    fsGateTwoLater: "A frost-tender crop waits until after {date}, the late frost date of the {dstation} weather station, {ddist} away, which has the longer record, so frost can come later than that.",
    fsDatesNoDate: "The {station} weather station's own record, {years} years of its daily lows, gives no date for a last frost, so no planting date waits for one.",
    fsDatesFoldRest: " - the {station} weather station's ({id}), {dist} from your garden: odds Milpa worked out from its daily lows in NOAA's GHCN-Daily, {years} complete years of {frost_count_start}-{frost_count_end}.",
    fsDatesFoldModel: " The weather model's, for comparison: last frost around {date}, frost in {m} of {my} winters.",
    fsDatesFoldModelNoDate: " The weather model's, for comparison: frost in {m} of {my} winters, too few to give a date.",
    fsDatesFoldModelNone: " The weather model's, for comparison: no frost in {my} winters.",
    fsDatesFoldModelDateOnly: " The weather model's, for comparison: last frost around {date}.",
    fsNearerLead: "A nearer station",
    fsNearerSooner: " - the {station} weather station, {dist} from {place}, puts the last frost around {date}, {days} days sooner. Milpa plans by the frostier station's dates, so frost-tender crops wait for the later one.",
    fsNearerFew: " - the {station} weather station, {dist} from {place}, recorded a frost in {k} of its {n} winters, too few to give a last frost date. Milpa plans by the frostier station's dates, so frost-tender crops wait for them.",
    fsNearerLate: " - the {station} weather station, {dist} from {place}, recorded a frost in {k} of its {n} winters, but too few came late enough to give a last frost date. Milpa plans by the frostier station's dates, so frost-tender crops wait for them.",
    fsNearerNone: " - the {station} weather station, {dist} from {place}, recorded no frost in its {n} winters. Milpa plans by the frostier station's dates, so frost-tender crops wait for them.",
    fsNearerGarden: "your garden",
    fsNearerSpot: "this spot",
    fsRowQ: "\u00b7 from the {station} station's record in NOAA's GHCN-Daily",
    fsCiteLead: "Citation",
    plSeasonMostGate: "Season here: frost comes in most winters, so tender crops wait until after {date}.",
    plSeasonMostNoDate: "Season here: frost comes in most winters, and there's no frost date here for tender crops to wait for, so plant them after your own last frost.",
    clWarmTipMost: "Frost comes in most winters here, and these months follow the warmth: {crop} grows where a month averages about {min} to {max}, and these are the months here that stay in that range until harvest.",
    clWarmTipCareMost: "Frost comes in most winters here, and every month is warmer than the {max} or so {crop} grows best under.",
    clStationCountTip: "The frost count is the {station} weather station's, {dist} away. The dates are modeled from worldwide weather data (the ERA5 reanalysis, a grid cell about 25 km across, {cdist} from you), so they are {word}. Log the frosts you see, and after {min} seasons your own dates take over.",
    clStationDatesTip: "The frost dates are the {station} weather station's, {dist} away, from its record in NOAA's GHCN-Daily ({word}). Log the frosts you see, and after {min} seasons your own dates take over.",
    wsqLead: "Weather square",
    wsqRest: " - {text}",
    wsqWater: "The nearest square of the weather model, {ndist} away, is mostly sea or lake, where nights stay milder than on land. These numbers come from the nearest square on land, {dist} away.",
    wsqOnlyWater: "Every square of the weather model we hold near here is mostly sea or lake, where nights stay milder than on land.",
    wsqOnlyWaterFrost: "So frost on land can come more often than these numbers show.",
    wsqHeight: "The model's squares near here stand at different heights. These numbers come from the one {dist} away, whose ground stands at {ground}, the closest to this town's own height of {height}. The nearer square, {ndist} away, stands at {nground}. Height only picks the square. It never changes a temperature.",
    wsqHeightTown: "The model's squares near here stand at different heights. These numbers come from the one {dist} away, whose ground stands at {ground}, the closest to {height}, the height of the nearest town on our list, {tdist} away. The nearer square, {ndist} away, stands at {nground}. Height only picks the square. It never changes a temperature.",
    wsqSdLead: "The frost dates are the station's own. The model's highs, lows and rain:",
    clWarmTipGiven: "These months follow the warmth, and frost-tender crops wait for the last frost date you gave. {crop} grows where a month averages about {min} to {max}, and these are the months here that stay in that range until harvest.",
    clWarmTipCareGiven: "Every month here is warmer than the {max} or so {crop} grows best under, and frost-tender crops wait for the last frost date you gave.",
    clWarmAfterGiven: "Wait until after {date}, the last frost date you gave, to set it out.",
    homeVoiceFrostGiven: "Tender crops wait until after {date}, the last frost date you gave, and the rest keep growing the whole year round.",
    clWarmBeforeGiven: "Sown by then, it's ready before {date}, the first frost date you gave.",
    clWarmTipFirstGiven: "These months follow the warmth, and frost-tender crops finish before the first frost date you gave. {crop} grows where a month averages about {min} to {max}, and these are the months here that stay in that range until harvest.",
    clWarmTipCareFirstGiven: "Every month here is warmer than the {max} or so {crop} grows best under, and frost-tender crops finish before the first frost date you gave.",
    homeVoiceFrostFirstGiven: "Tender crops finish before {date}, the first frost date you gave, and the rest keep growing the whole year round.",
};

const copyFacts = {
    normals_start: "1991",
    normals_end: "2020",
    normals_years: "30",
    frost_count_start: "1991",
    frost_count_end: "2020",
    zone_model_start: "1991",
    zone_model_end: "2020",
    station_start: "1991",
    station_end: "2020",
    dem_notice: "produced using Copernicus WorldDEM-90 \u00a9 DLR e.V. 2010-2014 and \u00a9 Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved",
    zip_vintage: "2020",
    phzm_vintage: "2023",
};

const LANG_KEY = "gg-lang";
try {
    const v = /lang=(e[ns])/.exec(location.search)?.[1];
    if (v) {
        history.replaceState(null, "", "./" + location.hash);
        document.documentElement.lang = v;
        localStorage.setItem(LANG_KEY, v);
    }
}
catch {
}
const kept = storedLang();
let booted = kept ?? (browserPrefersSpanish() ? "es" : "en");
let chosen = kept != null;
const appLang = () => booted;
const langChosen = () => chosen;
function storedLang() {
    try {
        const v = localStorage.getItem(LANG_KEY);
        return v === "en" || v === "es" ? v : null;
    }
    catch {
        return null;
    }
}
function storeLang(l) {
    chosen = true;
    try {
        localStorage.setItem(LANG_KEY, l);
    }
    catch { }
    return l !== booted;
}
const langPending = () => { const s = storedLang(); return s != null && s !== booted; };
function browserPrefersSpanish(langs = typeof navigator !== "undefined" ? navigator.languages : undefined) {
    const first = (langs ?? [])[0] ?? "";
    return /^es(-|$)/i.test(first);
}
function englishAbroad(langs) {
    const m = /^en(?:-[a-z]{4})?-([a-z]{2}|\d{3})(?:-|$)/i.exec(numberLocale(langs, "en"));
    return !!m && m[1].toUpperCase() !== "US";
}
function numberLocale(langs, lang = booted) {
    let tags = langs;
    if (!tags) {
        try {
            tags = navigator.languages;
        }
        catch {
            tags = [];
        }
    }
    return (tags ?? []).find((t) => (t ?? "").toLowerCase().split("-")[0] === lang) ?? lang;
}
function dateLocale() {
    return booted === "es" ? "es-US" : "en-US";
}
const esSite = booted === "es" ? await import('./sitepages-es.gen.js') : null;
const esTwin = (path) => !!esSite?.esPage.test(path.split("#")[0]);
const enOnly = (path) => booted === "es" && !esTwin(path);
const esGuide = (slug) => esSite?.esGuides[slug];
const toTwin = (a) => {
    const h = a.getAttribute("href") ?? "";
    if (h.startsWith("../") && esTwin(h.slice(3)))
        a.setAttribute("href", "../es/" + h.slice(3));
};
const twinAll = (n) => {
    if (n instanceof Element) {
        toTwin(n);
        n.querySelectorAll("a").forEach(toTwin);
    }
};
if (esSite && typeof MutationObserver != "undefined") {
    new MutationObserver((rs) => rs.forEach((r) => (r.type == "attributes" ? toTwin(r.target) : r.addedNodes.forEach(twinAll))))
        .observe(document, { subtree: true, childList: true, attributeFilter: ["href"] });
    twinAll(document.documentElement);
}

const CONFIDENCE = {
    A: { word: "Well established", cls: "s", gloss: "The rule names its mechanism and is settled, by sources a person has read and checked or by plain arithmetic and geometry." },
    B: { word: "Promising", cls: "p", gloss: "The mechanism is named and the literature backs it. A few questions are still open." },
    C: { word: "A good hunch", cls: "h", gloss: "Plausible by its mechanism, but field studies are thin, so treat it as a lean." },
    D: { word: "Contested", cls: "d", gloss: "The evidence points both ways, or no study has tested it, so the planner does not enforce it." },
    F: { word: "Refuted", cls: "f", gloss: "The claim did not survive its sources. It is kept so the folklore can be answered." },
};
const CONFIDENCE_ES = {
    A: { word: "Bien establecido", gloss: "La regla nombra su mecanismo y está resuelta, por fuentes que una persona leyó y comprobó o por simple aritmética y geometría." },
    B: { word: "Prometedor", gloss: "El mecanismo está nombrado y los estudios lo respaldan. Quedan unas pocas preguntas abiertas." },
    C: { word: "Una buena corazonada", gloss: "Su mecanismo lo hace creíble, pero hay pocos estudios de campo, así que tómalo como una inclinación." },
    D: { word: "En disputa", gloss: "La evidencia apunta en ambos sentidos, o ningún estudio la ha puesto a prueba, así que el planificador no la aplica." },
    F: { word: "Refutado", gloss: "La afirmación no resistió sus fuentes. Se conserva para poder responder a la creencia popular." },
};
const FAMILY_COMMON = {
    solanaceae: "nightshades",
    cucurbitaceae: "cucurbits",
    brassicaceae: "brassicas",
    fabaceae: "legumes",
    amaryllidaceae: "onion family",
    apiaceae: "carrot family",
    asteraceae: "daisy family",
    amaranthaceae: "amaranth family",
    boraginaceae: "borage family",
    cleomaceae: "spiderflower family",
    elaeagnaceae: "oleaster family",
    lamiaceae: "mint family",
    actinidiaceae: "kiwi family",
    adoxaceae: "elder family",
    asparagaceae: "asparagus family",
    caprifoliaceae: "honeysuckle family",
    ebenaceae: "persimmon family",
    ericaceae: "heath family",
    grossulariaceae: "currant family",
    iridaceae: "iris family",
    moraceae: "mulberry family",
    polygonaceae: "buckwheat family",
    tropaeolaceae: "nasturtium family",
    vitaceae: "grape family",
    poaceae: "grasses",
    rosaceae: "rose family",
    convolvulaceae: "morning-glory family",
    malvaceae: "mallow family",
    basellaceae: "Malabar spinach family",
    aizoaceae: "New Zealand spinach family",
    rutaceae: "citrus family",
    lauraceae: "laurel family",
    anacardiaceae: "cashew family",
    musaceae: "banana family",
    passifloraceae: "passionflower family",
    oleaceae: "olive family",
    lythraceae: "loosestrife family",
    myrtaceae: "myrtle family",
};
const FAMILY_COMMON_ES = {
    solanaceae: "solanáceas",
    cucurbitaceae: "cucurbitáceas",
    brassicaceae: "brasicáceas",
    fabaceae: "leguminosas",
    amaryllidaceae: "familia de las amarilidáceas",
    apiaceae: "familia de las apiáceas",
    asteraceae: "familia de las asteráceas",
    amaranthaceae: "familia de las amarantáceas",
    boraginaceae: "familia de las boragináceas",
    cleomaceae: "familia de las cleomáceas",
    elaeagnaceae: "familia de las eleagnáceas",
    lamiaceae: "familia de las lamiáceas",
    actinidiaceae: "familia de las actinidiáceas",
    adoxaceae: "familia de las adoxáceas",
    asparagaceae: "familia de las asparagáceas",
    caprifoliaceae: "familia de las caprifoliáceas",
    ebenaceae: "familia de las ebenáceas",
    ericaceae: "familia de las ericáceas",
    grossulariaceae: "familia de las grosulariáceas",
    iridaceae: "familia de las iridáceas",
    moraceae: "familia de las moráceas",
    polygonaceae: "familia de las poligonáceas",
    tropaeolaceae: "familia de las tropeoláceas",
    vitaceae: "familia de las vitáceas",
    poaceae: "gramíneas",
    rosaceae: "familia de las rosáceas",
    convolvulaceae: "familia de las convolvuláceas",
    malvaceae: "familia de las malváceas",
    basellaceae: "familia de las baseláceas",
    aizoaceae: "familia de las aizoáceas",
    rutaceae: "familia de las rutáceas",
    lauraceae: "familia de las lauráceas",
    anacardiaceae: "familia de las anacardiáceas",
    musaceae: "familia de las musáceas",
    passifloraceae: "familia de las pasifloráceas",
    oleaceae: "familia de las oleáceas",
    lythraceae: "familia de las litráceas",
    myrtaceae: "familia de las mirtáceas",
};
const PLAIN_TERMS = [{ "from": "Juglans", "to": "walnut trees" }, { "from": "a Cucurbita maxima", "to": "a winter squash" }];
const HEMISPHERE_TERMS = [{ "from": "polar side", "north": "north side", "south": "south side" }, { "from": "equatorward of", "north": "south of", "south": "north of" }, { "from": "poleward of", "north": "north of", "south": "south of" }];
const RULE_CITATION_PATTERN = "\\s*\\((?:R-\\d+(?:\\s*[/,]\\s*R-\\d+)*)\\)";
const RULE_REF_PATTERN = "\\b(?:rules?\\s+)?R-\\d+[a-z]?(?:\\s*(?:[/,&]|and|through|to|-)\\s*R-\\d+[a-z]?)*";
const MAINTAINER_MARKER_PATTERN = "\\ba human\\b|read by a human|signed off|\\bISSUES\\b|dispatch\\.py|conformance case|HAS NO SURFACE|\\bC-0\\d\\d\\b|derived composition";
const ENFORCEMENT_COST = { "fatal": "ignored, the planting fails", "costly": "ignored, real yield is lost", "suboptimal": "ignored, it still grows, just less well" };
const ENFORCEMENT_DOES = { "block": "the planner refuses it", "warn": "the planner warns you", "advise": "the planner suggests it", "inert": "the planner leaves it to you", "refute": "a correction" };
const ENFORCEMENT_CONCERN = { "use_safety": "it's about eating safely, not how the plant grows" };
const GOATCOUNTER_CODE = "milpa-garden";
const MOUND_MIN_SPAN_M = 1.0;
const TRAIL_NEXT = ["when", "together", "plan", "example", "now", "wrong", "diary", "tip", "ics", "note", "frost", "owndates", "map", "guide"];

function humanize(id) {
    return String(id).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
function titleCase(s) {
    return String(s).replace(/(^|[\s\-/(])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
}
const PROPER_WORDS = new Set(["American", "French", "Russian", "Rocky", "Mountain", "Mexican", "Italian",
    "Swiss", "Brussels", "Japanese", "Chinese", "Egyptian", "Welsh", "Jerusalem", "Tres", "Hermanas", "Three", "Sisters",
    "Malabar", "Ceylon", "New", "Zealand", "Nueva", "Zelanda"]);
function nameAsLabel(name) {
    const low = (w) => {
        const core = w.replace(/^[()[\],.;:]+|[()[\],.;:]+$/g, "");
        if (PROPER_WORDS.has(core) || (core.length > 1 && core === core.toUpperCase() && /[A-Z]/.test(core)))
            return w;
        return w.replace(/[A-Za-z]/, (c) => c.toLowerCase());
    };
    const n = String(name).split(" ").map((w) => w.split("-").map(low).join("-")).join(" ");
    return n.charAt(0).toUpperCase() + n.slice(1);
}
const RULE_CITATION = new RegExp(RULE_CITATION_PATTERN, "g");
const RULE_REF = new RegExp(RULE_REF_PATTERN, "gi");
let familyTable = FAMILY_COMMON;
let spanishFamilies = false;
function useSpanishFamilyNames() { familyTable = { ...FAMILY_COMMON, ...FAMILY_COMMON_ES }; spanishFamilies = true; }
function familyName(fam) {
    return familyTable[String(fam).toLowerCase()] ?? humanize(fam);
}
function familyShown(fam) {
    const k = String(fam).trim().toLowerCase();
    const bot = k.charAt(0).toUpperCase() + k.slice(1);
    const common = familyName(k);
    return common.toLowerCase() === k ? bot : `${common} (${bot})`;
}
function familyKeyOf(typed) {
    const t = String(typed).trim().toLowerCase();
    const inBrackets = /\(([a-z]+aceae)\)\s*$/.exec(t);
    if (inBrackets)
        return inBrackets[1];
    return Object.keys(familyTable).find((k) => familyTable[k].toLowerCase() === t) ?? t;
}
const spanishName = (fam) => {
    const n = FAMILY_COMMON_ES[String(fam).toLowerCase()];
    return spanishFamilies && n ? n : null;
};
function familyInProse(fam) {
    const es = spanishName(fam);
    return es ? `${/^familia\b/.test(es) ? "la" : "las"} ${es}` : familyName(fam);
}
function familiesPlural(fams) {
    if (fams.length !== 1)
        return fams.length > 1;
    const n = familyName(fams[0]);
    return !/^famil(y|ia)\b|\bfamily$/.test(n) && /s$/.test(n);
}
function humanizeFamilies(text) {
    return String(text).replace(/\b[a-z]+aceae\b/gi, (m) => familyName(m));
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function plainClaim(text, lat) {
    let t = humanizeFamilies(text);
    for (const { from, to } of PLAIN_TERMS)
        t = t.replace(new RegExp(`\\b${esc(from)}\\b`, "g"), to);
    const south = typeof lat === "number" && lat < 0;
    for (const h of HEMISPHERE_TERMS)
        t = t.replace(new RegExp(`\\b${esc(h.from)}\\b`, "g"), south ? h.south : h.north);
    return t;
}
const STATION_WORDS = { Ap: "Airport", Intl: "International", Muni: "Municipal", Rgnl: "Regional",
    Fld: "Field", Hts: "Heights", Rch: "Ranch", Ft: "Fort", Pt: "Point",
    Gtr: "Greater", Nas: "Naval Air Station", Wwtp: "Wastewater Treatment Plant",
    Ctr: "Center", Spgs: "Springs", Mtn: "Mountain", Sp: "State Park", Is: "Island", "Int'L": "International" };
const STATION_UPPER = new Set(["Np", "Wso", "Afb", "Hq", "Nws", "Siu", "Naas", "Wg", "Aws", "Awos", "Raaf", "Rcs", "Cda", "Ii", "Iii"]);
const STATION_UPPER_BRACKETED = new Set(["Smn", "Cfe", "Dge", "Aut", "Arpansa"]);
const COUNTY_NEXT = new Set(["Ap", "Exec", "Muni"]);
const STATION_DROP = new Set(["Hcn", "Wsfo", "Wfo"]);
const STATION_DIRS = new Set(["N", "S", "E", "W", "Ne", "Nw", "Se", "Sw", "Nne", "Ene", "Ese", "Sse", "Ssw", "Wsw", "Wnw", "Nnw"]);
const GLUED_DIR = new RegExp(`^(\\d+)(${[...STATION_DIRS].sort((a, b) => b.length - a.length).join("|")})$`);
function stationDisplay(name) {
    const part = (tok) => {
        const m = GLUED_DIR.exec(tok);
        if (m)
            return `${m[1]} ${m[2].toUpperCase()}`;
        if (STATION_DROP.has(tok))
            return null;
        if (STATION_DIRS.has(tok) || STATION_UPPER.has(tok))
            return tok.toUpperCase();
        if (tok.startsWith("(") && tok.endsWith(")") && STATION_UPPER_BRACKETED.has(tok.slice(1, -1)))
            return tok.toUpperCase();
        return STATION_WORDS[tok] ?? tok;
    };
    const out = [];
    const toks = String(name).split(/\s+/).filter(Boolean);
    toks.forEach((tok, i) => {
        if (tok === "Co" && i + 1 < toks.length && COUNTY_NEXT.has(toks[i + 1])) {
            out.push("County");
            return;
        }
        const kept = tok.split("-").map(part).filter((x) => !!x);
        if (kept.length)
            out.push(kept.join("-"));
    });
    return out.join(" ").trim() || String(name).trim();
}
function stripRuleCitations(text) {
    return String(text).replace(RULE_CITATION, "").trim();
}
function humanizeRuleRefs(text) {
    return String(text).replace(RULE_REF, (m) => ((m.match(/R-\d/g) ?? []).length > 1 ? "other rules here" : "another rule here"));
}

const ORIGINALS_KEY = "gg-es-originals";
function showingOriginals() {
    try {
        return appLang() === "es" && sessionStorage.getItem(ORIGINALS_KEY) === "1";
    }
    catch {
        return false;
    }
}
function setShowingOriginals(on) {
    try {
        if (on)
            sessionStorage.setItem(ORIGINALS_KEY, "1");
        else
            sessionStorage.removeItem(ORIGINALS_KEY);
    }
    catch { }
}
const esMod = appLang() === "es" ? (await import('./copy-values-es.gen.js')) : null;
const fluentFirst = new Set(esMod?.fluentFirstKeys ?? []);
function freshSpanish(es, from, english, fp) {
    const out = {};
    for (const [k, v] of Object.entries(es))
        if (v !== undefined && k in english && from[k] === fp(english[k]))
            out[k] = v;
    return out;
}
function esOverlayFor(part) {
    if (!esMod)
        return {};
    const fresh = freshSpanish(esMod.copyValuesEs, esMod.copyValuesEsFrom, part, esMod.fingerprint);
    return showingOriginals() ? Object.fromEntries(Object.entries(fresh).filter(([k]) => !fluentFirst.has(k))) : fresh;
}
function withFacts(v) {
    return v.includes("{") ? v.replace(/\{(\w+)\}/g, (m, k) => copyFacts[k] ?? m) : v;
}
const abroad = appLang() === "en" && englishAbroad();
const readersEnglish = (v) => (abroad && /\bfall\b/i.test(v)
    ? v.replace(/\{fall\}|\b([Aa]) fall\b|\b(f|F)all\b(?! on\b)/g, (m, a, f) => (m === "{fall}" ? m : a ? `${a}n autumn` : f === "F" ? "Autumn" : "autumn")) : v);
const worded = (part) => Object.fromEntries(Object.entries({ ...part, ...esOverlayFor(part) }).map(([k, v]) => [k, readersEnglish(withFacts(v))]));
const copy = worded(copyBoot);
function installLateCopy(late) {
    Object.assign(copy, worded(late));
}
if (appLang() === "es")
    useSpanishFamilyNames();
const plantNames = new Set();
const markPlantName = (n) => (plantNames.add(n), n);
const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const PROPER = new Set(["French", "Swiss", "Italian", "Rocky", "Brussels", "American", "Boston", "Bibb", "Jerusalem", "New",
    "Malabar", "Ceylon"]);
function midSentence(name) {
    const first = name.split(/\s/)[0] ?? "";
    if (!/^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+$/.test(first) || PROPER.has(first))
        return name;
    return name.charAt(0).toLowerCase() + name.slice(1);
}
function inProse(v, start, en) {
    const lower = en ? midSentence : low;
    if (plantNames.has(v))
        return start ? v : lower(v);
    const parts = v.split(en ? /(, and |, or |, | and | or )/ : /(, | y | o )/);
    return parts.length > 2 && parts.every((p, i) => i % 2 || plantNames.has(p))
        ? parts.map((p, i) => (i % 2 || (!i && start) ? p : lower(p))).join("") : v;
}
function fillCopy(key, vars) {
    const en = appLang() !== "es";
    const prose = plantNames.size > 0 && (!en || key.startsWith("cl"));
    return copy[key].replace(/\{(\w+)\}/g, (m, k, at, all) => !(k in vars) ? m
        : prose && typeof vars[k] === "string" ? inProse(vars[k], /^\s*$|[.!?¡¿·→›]\s*$/.test(all.slice(0, at)), en)
            : String(vars[k]));
}
function bundleInfoLine(b) {
    return fillCopy("wyBundleInfo", { v: String(b.version), teams: b.counts.guilds, rules: b.counts.rules });
}
function pluralCopy(base, n) {
    return fillCopy(`${base}${n === 1 ? "One" : "Many"}`, { n });
}
function fillNodes(parent, template, nodes) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        if (k && k in nodes)
            parent.appendChild(nodes[k]);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
function applyCopy(root = document) {
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
    for (const el of root.querySelectorAll("[data-copy-attr]")) {
        for (const pair of (el.dataset.copyAttr ?? "").split(";")) {
            const [attr, key] = pair.split(":");
            if (attr && key && key in copy)
                el.setAttribute(attr, copy[key]);
        }
    }
    applySeasonalCopy(root);
}
function applySeasonalCopy(root = document) {
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
const LABEL_KEY = new Map(Object.keys(copyBoot).filter((k) => k.startsWith("lbl")).map((k) => [copyBoot[k], k]));
function labelCopy(english) {
    const k = LABEL_KEY.get(english);
    return k ? copy[k] : english;
}

const DEFAULT_ROUTE = "plan";
const TAB_WORD = {
    plan: "tabPlan", calendar: "tabCalendar", log: "tabLog", review: "tabReview", why: "tabWhy",
    answers: "tabAnswers", account: "tabAccount", share: "tabShare", plant: "tabPlant",
};
function tabTitle(route) {
    const key = TAB_WORD[route];
    return route === "start" || !key ? copy.tabStartTitle : fillCopy("tabTitle", { page: copy[key] });
}
const ALIASES = new Map([["home", "start"]]);
function aliasedHash(hash) {
    const m = hash.match(/^#\/([a-z]+)/);
    const to = m ? ALIASES.get(m[1]) : undefined;
    return to ? `#/${to}${hash.slice(m[0].length)}` : null;
}
function resolveAlias() {
    const to = aliasedHash(location.hash);
    if (to)
        history.replaceState(history.state, "", to);
}
function currentRoute() {
    const m = location.hash.match(/^#\/([a-z]+)/);
    return m ? ALIASES.get(m[1]) ?? m[1] : DEFAULT_ROUTE;
}
function apply(route) {
    resolveAlias();
    if (route === "content")
        return;
    const pages = document.querySelectorAll("main > section.page");
    let found = false;
    for (const p of pages) {
        const match = p.id === `page-${route}`;
        p.hidden = !match;
        if (match)
            found = true;
    }
    if (!found) {
        if (!location.hash || location.hash === "#" || location.hash === "#/") {
            location.hash = `#/${DEFAULT_ROUTE}`;
            return;
        }
        const nf = document.getElementById("page-notfound");
        if (nf) {
            nf.hidden = false;
            document.title = fillCopy("tabTitle", { page: copy.tabNotFound });
            window.scrollTo(0, 0);
            lastRoute = "notfound";
            return;
        }
        location.hash = `#/${DEFAULT_ROUTE}`;
        return;
    }
    document.title = tabTitle(route);
    if (route !== lastRoute)
        window.scrollTo(0, 0);
    lastRoute = route;
}
let lastRoute = null;
function initRouter() {
    window.addEventListener("hashchange", () => apply(currentRoute()));
    apply(currentRoute());
}

const CHUNKS = {
    core: [() => import('./core.js').then(function (n) { return n.core; }), "dist/core.js"],
    decor: [() => import('./silhouettes.js'), "dist/silhouettes.js"],
    perf: [() => import('./perfhud.js'), "dist/perfhud.js"],
    share: [() => import('./shareview.js'), "dist/shareview.js"],
    edit: [() => import('./editor.js'), "dist/editor.js"],
    why: [() => import('./why.js'), "dist/why.js"],
    plant: [() => import('./panels/plantcard.js'), "dist/panels/plantcard.js"],
    account: [() => import('./panels/knows.js'), "dist/panels/knows.js"],
    review: [() => import('./review.js'), "dist/review.js"],
    answers: [() => import('./answers.js'), "dist/answers.js"],
    calendar: [() => import('./calendar.js'), "dist/calendar.js"],
    logpage: [() => import('./logpage.js'), "dist/logpage.js"],
    home: [() => import('./home.js'), "dist/home.js"],
    plan: [() => import('./planroute.js'), "dist/planroute.js"],
    sync: [() => import('./sync.js'), "dist/sync.js"],
    dossier: [() => import('./dossiersheet.js').then(function (n) { return n.dossiersheet; }), "dist/dossiersheet.js"],
    bell: [() => import('./bell.js'), "dist/bell.js"],
    bands: [() => import('./landbands.js'), "dist/landbands.js"],
    trail: [() => import('./trailview.js'), "dist/trailview.js"],
};
const ROUTE_CHUNK = { share: "share", why: "why", plant: "plant", account: "account", review: "review", answers: "answers", calendar: "calendar", plan: "plan", log: "logpage" };
function chunkFor(route) { return ROUTE_CHUNK[route] ?? null; }
const promised = new Map();
const evaluated = new Map();
const listeners = [];
const requested = new Set();
const testLoaders = new Map();
let manifest;
function readManifest() {
    if (manifest !== undefined)
        return manifest;
    manifest = null;
    try {
        const el = typeof document !== "undefined" ? document.getElementById("gg-chunks") : null;
        if (el?.textContent)
            manifest = JSON.parse(el.textContent);
    }
    catch {
        manifest = null;
    }
    return manifest;
}
function preloadFor(k) {
    const files = readManifest()?.[CHUNKS[k][1]];
    if (!files || typeof document === "undefined")
        return;
    for (const l of document.querySelectorAll('link[rel="modulepreload"]'))
        requested.add(l.getAttribute("href")?.replace(/^\.\//, "") ?? "");
    for (const f of files) {
        if (requested.has(f))
            continue;
        requested.add(f);
        const link = document.createElement("link");
        link.rel = "modulepreload";
        link.href = `./${f}`;
        document.head.appendChild(link);
    }
}
function loadChunk(k) {
    const had = promised.get(k);
    if (had)
        return had;
    preloadFor(k);
    const load = (testLoaders.get(k) ?? CHUNKS[k][0]);
    const p = load().then((m) => {
        evaluated.set(k, m);
        for (const fn of [...listeners])
            fn(k);
        return m;
    }, (e) => { promised.delete(k); throw e; });
    promised.set(k, p);
    return p;
}
function chunkReady(k) {
    return evaluated.get(k) ?? null;
}
function onChunkLoaded(fn) { listeners.push(fn); }
function whenIdle(fn, timeout = 2000) {
    const ric = window.requestIdleCallback;
    if (ric)
        ric(fn, { timeout });
    else
        setTimeout(fn, 200);
}
const WARM_ORDER = ["plan", "logpage", "dossier", "calendar", "home", "answers", "why", "plant", "review", "account", "share"];
function warmChunks() {
    try {
        if (localStorage.getItem("gg-noprefetch") === "1")
            return;
    }
    catch { }
    if (navigator.connection?.saveData)
        return;
    const keys = WARM_ORDER.filter((k) => !chunkReady(k));
    for (const k of keys)
        preloadFor(k);
    const next = () => {
        const k = keys.shift();
        if (!k)
            return;
        void loadChunk(k).catch(() => { }).finally(() => whenIdle(next, 10000));
    };
    whenIdle(next, 10000);
}
function pageOf(route) {
    return typeof document === "undefined" ? null : document.getElementById(`page-${route}`);
}
function markLoading(route) {
    const page = pageOf(route);
    if (!page || page.querySelector(":scope > .pageload"))
        return;
    page.setAttribute("aria-busy", "true");
    const box = document.createElement("div");
    box.className = "pageload";
    box.setAttribute("role", "status");
    box.innerHTML = '<svg class="bootmark" aria-hidden="true"><use href="#triad"/></svg>';
    const word = document.createElement("p");
    word.className = "bootword";
    word.textContent = copy.apPageLoading;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-secondary pageload-retry";
    retry.textContent = copy.apPageReload;
    retry.addEventListener("click", () => location.reload());
    box.append(word, retry);
    page.prepend(box);
}
function markFailed(route) {
    markLoading(route);
    const box = pageOf(route)?.querySelector(":scope > .pageload");
    if (!box)
        return;
    box.classList.add("failed");
    const word = box.querySelector(".bootword");
    if (word)
        word.textContent = copy.apPageLoadFailed;
}
function clearLoading(route) {
    const page = pageOf(route);
    if (!page)
        return;
    page.removeAttribute("aria-busy");
    page.querySelector(":scope > .pageload")?.remove();
}

const buzz = (pattern) => {
    try {
        navigator.vibrate?.(pattern);
    }
    catch { }
};

const NAV_GARDEN = [
    { route: "start", label: "navHome" },
    { route: "plan", label: "navPlan" },
    { route: "calendar", label: "navCalendar" },
    { route: "log", label: "navLog" },
];
const NAV_HEADER = [
    { menu: "learn", label: "navLearn" },
    { menu: "evidence", label: "navEvidence" },
];

const ICONS = {
    start: [
        "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
        "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    ],
    plan: [
        "M7 20h10",
        "M10 20c5.5-2.5.8-6.4 3-10",
        "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
        "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
    ],
    calendar: [
        "M8 2v4", "M16 2v4", "M3 10h18",
        "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    ],
    log: ["M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z", "m15 5 4 4"],
};
const LEARN_ICON = ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"];
const LEARN_HOME = "../guides/";
const frame = (fn, fallback) => {
    void import('./navmenu.js').then(fn, fallback);
};
const toFooter = () => document.getElementById("sitefoot")?.scrollIntoView();
function go(route, target) {
    const seatTarget = () => {
        if (!target)
            return;
        const k = chunkFor(route);
        if (k && !chunkReady(k)) {
            void loadChunk(k).then(seatTarget, () => { });
            return;
        }
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        setTimeout(() => {
            const el = document.getElementById(target);
            if (!el)
                return;
            for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null)
                d.open = true;
            seat(scrollerFor(el), el, { offset: 8, motion: behavior === "smooth" ? "smooth" : "instant", force: true, hold: 1200, reason: "deep-link" });
            const focusId = el.dataset.seatFocus;
            if (focusId)
                document.getElementById(focusId)?.focus({ preventScroll: true });
        }, 80);
    };
    if (currentRoute() === route)
        seatTarget();
    else {
        window.addEventListener("hashchange", () => setTimeout(seatTarget, 0), { once: true });
        location.hash = `#/${route}`;
    }
}
function NavTabs() {
    const [route, setRoute] = d(currentRoute());
    h(() => {
        const onHash = () => setRoute(currentRoute());
        window.addEventListener("hashchange", onHash);
        onHash();
        return () => {
            window.removeEventListener("hashchange", onHash);
        };
    }, []);
    const es = appLang() === "es";
    const icon = (paths) => html `<svg class="tabicon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"
    >${paths.map((d) => html `<path d=${d} key=${d} />`)}</svg>`;
    return html `<div class="navrow">
    ${NAV_GARDEN.map((s) => {
        const label = copy[s.label];
        return html `
      <a class=${"tab tab-" + s.route} key=${s.route} href=${"#/" + s.route}
         aria-current=${route === s.route ? "page" : null}
         onClick=${() => {
            buzz(8);
            setRoute(s.route);
        }}
      >${icon(ICONS[s.route])}<span class="tablabel">${label}</span></a>`;
    })}
    <a class="tab tab-learn" key="learn" href=${LEARN_HOME} data-sheet aria-haspopup="dialog"
      onClick=${(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
            return;
        e.preventDefault();
        buzz(8);
        const a = e.currentTarget;
        frame((m) => m.openSheet(a), () => { location.href = LEARN_HOME; });
    }}
      onKeyDown=${(e) => { if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    } }}
      >${icon(LEARN_ICON)}<span class="tablabel">${copy.navLearn}</span></a>
    <span class="navdiv" aria-hidden="true"></span>
    ${NAV_HEADER.map((h) => "link" in h
        ? html `<a class="tab tab-l" key=${h.link} href=${es ? h.es : h.en}><span class="tablabel">${copy[h.label]}</span></a>`
        : html `<button type="button" class="tab tab-l tab-menu" key=${h.menu} data-menu=${h.menu}
          aria-haspopup="true" aria-expanded="false"
          onClick=${(e) => { const b = e.currentTarget; frame((m) => m.toggleMenu(b, e.detail === 0), toFooter); }}
          onKeyDown=${(e) => {
            if (e.key !== "ArrowDown")
                return;
            e.preventDefault();
            const b = e.currentTarget;
            frame((m) => m.toggleMenu(b, true, true), toFooter);
        }}
        ><span class="tablabel">${copy[h.label]}</span><span class="caret" aria-hidden="true">\u25be</span></button>`)}
  </div>`;
}
function foldFooter() {
    const foot = document.getElementById("sitefoot"), mq = matchMedia("(max-width: 767px)");
    if (!foot)
        return;
    const set = () => {
        for (const h of foot.querySelectorAll(".foot-h")) {
            const b = h.querySelector("button"), col = h.parentElement;
            if (mq.matches && !b) {
                const t = document.createElement("button");
                t.type = "button";
                t.className = "foot-t";
                t.setAttribute("aria-expanded", "false");
                t.append(...h.childNodes);
                h.append(t);
                col?.classList.add("folded");
            }
            else if (!mq.matches && b) {
                h.replaceChildren(...b.childNodes);
                col?.classList.remove("folded");
            }
        }
        for (const n of foot.querySelectorAll(".sitenav"))
            n.classList.toggle("folds", mq.matches);
    };
    set();
    mq.addEventListener("change", set);
    foot.addEventListener("click", (e) => {
        const t = e.target.closest?.(".foot-t");
        if (!t)
            return;
        const open = t.getAttribute("aria-expanded") !== "true";
        t.setAttribute("aria-expanded", String(open));
        t.closest(".foot-col")?.classList.toggle("folded", !open);
    });
}
function initNav() {
    foldFooter();
    const host = document.querySelector("header.site nav");
    if (!host)
        return;
    host.textContent = "";
    R(html `<${NavTabs} />`, host);
}

var nav = /*#__PURE__*/Object.freeze({
    __proto__: null,
    go: go,
    initNav: initNav
});

const PROD_HOSTS = new Set(["milpa.garden", "www.milpa.garden"]);
const KEY = "gg-plus-preview";
function plusPreviewFor(host, search, stored) {
    if (PROD_HOSTS.has(host.toLowerCase()))
        return false;
    return /(?:^|[?&])plus=preview(?:&|$)/.test(search) || stored === "1";
}
let open = null;
function plusPreview() {
    if (open !== null)
        return open;
    let stored = null;
    try {
        stored = sessionStorage.getItem(KEY);
    }
    catch { }
    open = plusPreviewFor(location.hostname, location.search, stored);
    if (open) {
        try {
            sessionStorage.setItem(KEY, "1");
        }
        catch { }
    }
    return open;
}

const CODE = GOATCOUNTER_CODE;
function allowed() {
    try {
        if (!CODE || !PROD_HOSTS.has(location.hostname))
            return false;
        if (navigator.webdriver)
            return false;
        const nav = navigator;
        if (navigator.doNotTrack === "1" || nav.globalPrivacyControl === true)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function send(path, referrer = "") {
    if (!allowed())
        return;
    try {
        const q = new URLSearchParams({ p: path, rnd: String(Date.now()) });
        if (referrer)
            q.set("r", referrer);
        void fetch(`https://${CODE}.goatcounter.com/count?${q}`, { method: "GET", keepalive: true, mode: "no-cors" })
            .catch(() => { });
    }
    catch { }
}
function countPageview() {
    send("/", document.referrer || "");
}
let gardenCounted = false;
function countGardenActive(plot) {
    if (gardenCounted || !plot || !plot.anchor || plot.example === true)
        return;
    gardenCounted = true;
    send("/e/garden-active");
}
const AI = /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com|chat\.deepseek\.com|meta\.ai|grok\.com|chat\.mistral\.ai)\./;
const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|baidu|yandex|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(reddit|facebook|instagram|x|twitter|t|bsky|mastodon|threads|pinterest|youtube|linkedin|news\.ycombinator)\./;
const DIRECTORY = /(^|\.)(alternativeto|producthunt|slant|saashub|github|gitlab|awesome|pwa\.directory)\./;
function channelOf(referrer) {
    if (!referrer)
        return "direct";
    let host;
    try {
        host = new URL(referrer).hostname.toLowerCase();
    }
    catch {
        return "other";
    }
    if (!host)
        return "direct";
    if (PROD_HOSTS.has(host))
        return "direct";
    if (AI.test(`.${host}.`))
        return "ai";
    if (SEARCH.test(`.${host}.`))
        return "organic";
    if (SOCIAL.test(`.${host}.`))
        return "social";
    if (DIRECTORY.test(`.${host}.`))
        return "directory";
    return "other";
}
const fired = [];
function countRung(rung) {
    if (fired.includes(rung))
        return;
    fired.push(rung);
    send(`/e/${rung}/${channelOf(document.referrer)}`);
}
const DOORS = ["when", "together", "plan", "example", "now", "wrong", "diary", "tip"];
const doorsSeen = [];
function countDoor(id) {
    const door = DOORS.find((d) => d === id);
    if (!door || doorsSeen.includes(door))
        return;
    doorsSeen.push(door);
    send(`/e/door-${door}`);
}
const nextSeen = [];
function countNext(id) {
    const step = TRAIL_NEXT.find((s) => s === id);
    if (!step || nextSeen.includes(step))
        return;
    nextSeen.push(step);
    send(`/e/next-${step}`);
}

const captured = { auth: null, confirm: null, error: null };
const LINK_KINDS = ["signup", "recovery", "email_change"];
function parseAuthHash(hash) {
    const raw = hash.replace(/^#\/?/, "");
    if (raw.startsWith("confirm?")) {
        const q = new URLSearchParams(raw.slice("confirm?".length));
        const type = q.get("type") ?? "", tokenHash = q.get("token_hash") ?? "";
        if (tokenHash && LINK_KINDS.includes(type))
            return { confirm: { type: type, tokenHash } };
        return { error: { code: "malformed", description: "the link is incomplete" } };
    }
    const params = new URLSearchParams(raw);
    const access = params.get("access_token"), refresh = params.get("refresh_token");
    if (access && refresh)
        return { auth: { access_token: access, refresh_token: refresh, type: params.get("type") ?? "" } };
    if (params.get("error") || params.get("error_code")) {
        return { error: { code: params.get("error_code") ?? params.get("error") ?? "", description: params.get("error_description") ?? "" } };
    }
    return null;
}
function captureAuthHash() {
    const h = location.hash;
    if (!h.includes("access_token=") && !/^#\/?confirm\?/.test(h) && !h.includes("error=") && !h.includes("error_code="))
        return;
    const got = parseAuthHash(h);
    if (!got)
        return;
    if (got.auth)
        captured.auth = got.auth;
    if (got.confirm)
        captured.confirm = got.confirm;
    if (got.error)
        captured.error = got.error;
    history.replaceState(null, "", location.pathname + location.search + "#/account");
}

const LAST_SEEN_KEY = "gg-last-seen";
let arrivalGapDays = null;
function noteArrival(nowMs = Date.now()) {
    try {
        const prev = Number(localStorage.getItem(LAST_SEEN_KEY));
        arrivalGapDays = Number.isFinite(prev) && prev > 0 ? Math.floor((nowMs - prev) / 86400000) : null;
        localStorage.setItem(LAST_SEEN_KEY, String(nowMs));
    }
    catch {
        arrivalGapDays = null;
    }
    return arrivalGapDays;
}
function daysAway() { return arrivalGapDays; }
const STARTED_KEY = "gg-started";
const LEGACY_KEYS = [["tsg.started", "gg-started"], ["tsg.home", "gg-home"]];
function migrateLegacyKeys(store) {
    for (const [old, cur] of LEGACY_KEYS) {
        const v = store.getItem(old);
        if (v === null)
            continue;
        if (store.getItem(cur) === null)
            store.setItem(cur, v);
        store.removeItem(old);
    }
}
function markStarted() {
    try {
        localStorage.setItem(STARTED_KEY, "1");
    }
    catch { }
}
function clearStarted() {
    try {
        localStorage.removeItem(STARTED_KEY);
    }
    catch { }
}
const HOME_KEY = "gg-home";
let homeUp = false;
function homeRendered() { return homeUp; }
function markHomeworthy(on, settled) {
    if (on)
        homeUp = true;
    if (!on && !settled)
        return;
    try {
        if (on)
            localStorage.setItem(HOME_KEY, "1");
        else
            localStorage.removeItem(HOME_KEY);
    }
    catch { }
}
function arrivalPlan(hash, homeworthy) {
    const explicit = hash !== "" && hash !== "#" && hash !== "#/";
    const goHome = !explicit;
    return { goHome, holdSplash: homeworthy && (goHome || hash.startsWith("#/start")) };
}
function landingFastPath() {
    let homeworthy = false;
    try {
        migrateLegacyKeys(localStorage);
        homeworthy = localStorage.getItem(HOME_KEY) === "1";
    }
    catch { }
    const { goHome, holdSplash } = arrivalPlan(location.hash, homeworthy);
    if (goHome)
        location.hash = "#/start";
    if (holdSplash) {
        document.body.classList.add("home-returning");
        holdForHome = true;
    }
}
let holdForHome = false;
let signInFrom = null;
function noteSignInStart(hash) { signInFrom = hash; }
function signInMayMove(hash) {
    const from = signInFrom;
    signInFrom = null;
    return from === null || hash === from;
}
let homeSettledFlag = false;
function settleHome() { homeSettledFlag = true; }
function homeSettled() { return homeSettledFlag; }
function isStarted() {
    try {
        return localStorage.getItem(STARTED_KEY) === "1";
    }
    catch {
        return false;
    }
}
function awaitingHome() { return holdForHome; }

const CLAIMS = [
    { id: "B-005", q: copy.drClaimEggshells },
    { id: "B-004", q: copy.drClaimEpsom },
    { id: "B-011", q: copy.drClaimMarigolds },
    { id: "B-006", q: copy.drClaimCoffee },
    { id: "B-003", q: copy.drClaimMoon },
    { id: "B-009", q: copy.drClaimShards },
];
function doorClaim(dayOfYear) {
    return CLAIMS[Math.abs(Math.trunc(dayOfYear)) % CLAIMS.length];
}
function firstStepHash(typed) {
    const q = typed.replace(/\s+/g, " ").trim().slice(0, 80);
    return q.length >= 2 ? `#/answers?q=${encodeURIComponent(q)}` : "#/answers";
}
function allDoorClaims() { return CLAIMS.slice(); }
const SITUATIONS = [
    {
        id: "earlystart", label: copy.drSitEarlyLabel,
        href: "#/answers?situation=earlystart",
        why: copy.drSitEarlyWhy,
    },
    {
        id: "containers", label: copy.drSitContainersLabel,
        href: "#/answers?situation=containers",
        why: copy.drSitContainersWhy,
    },
    {
        id: "midseason", label: copy.drSitLateLabel,
        href: "#/answers?situation=midseason",
        why: copy.drSitLateWhy,
    },
    {
        id: "shade", label: copy.drSitShadeLabel,
        href: "#/answers?situation=shade",
        why: copy.drSitShadeWhy,
    },
    {
        id: "clay", label: copy.drSitClayLabel,
        href: "#/answers?situation=clay",
        why: copy.drSitClayWhy,
    },
    {
        id: "now", label: copy.doorNowQ,
        href: "#/answers?situation=now",
        why: copy.doorNowP,
    },
];
function situations(month) {
    const seasonal = month >= 6 && month <= 9 ? "midseason" : "earlystart";
    const keep = new Set(["containers", "shade", "clay", seasonal]);
    return SITUATIONS.filter((s) => keep.has(s.id));
}
function situationFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("situation");
    if (!raw)
        return null;
    return SITUATIONS.find((s) => s.id === raw) ?? null;
}
const topOfRange = (v) => {
    if (Array.isArray(v)) {
        const nums = v.map(Number).filter((n) => Number.isFinite(n));
        return nums.length ? Math.max(...nums) : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
function sourcedPotSize(sp) {
    const gal = Number(sp.container_min_gal);
    if (!(Number.isFinite(gal) && gal > 0))
        return false;
    const conf = (sp.confidence ?? {});
    return !["estimated", "contested"].some((tier) => Array.isArray(conf[tier]) && conf[tier].some((p) => String(p) === "container_min_gal"));
}
function containerCrops(species, maxSpanCm, limit = 12) {
    const out = [];
    for (const sp of species) {
        const potSourced = sourcedPotSize(sp);
        let spread = topOfRange(sp.mature_spread_cm);
        let depth = String(sp.root_depth ?? "");
        if (spread == null) {
            const raw = sp.cultivar_groups;
            const groups = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : []);
            const fitting = groups
                .map((g) => ({ spread: topOfRange(g.mature_spread_cm), depth: String(g.root_depth ?? sp.root_depth ?? "") }))
                .filter((g) => g.spread != null && g.spread > 0 && g.spread <= maxSpanCm && (potSourced || g.depth !== "deep"))
                .sort((a, b) => a.spread - b.spread);
            if (fitting.length)
                ({ spread, depth } = fitting[0]);
        }
        if (spread == null || spread <= 0)
            continue;
        if (spread > maxSpanCm)
            continue;
        if (depth === "deep" && !potSourced)
            continue;
        const poll = sp.pollination;
        if (Number(poll?.block_min_plants) > 1)
            continue;
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, spreadCm: spread, rootDepth: depth });
    }
    out.sort((a, b) => (a.spreadCm - b.spreadCm) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
function headlineTeams(guilds, nameOf) {
    const plantable = guilds.filter((g) => String(g.guild_class ?? "") !== "out_of_scope" && !g.derived_from);
    const order = ["polyculture", "perennial_guild", "culinary_bundle", "ornamental_bundle"];
    const shown = [];
    for (const cls of order) {
        const pick = plantable.find((g) => String(g.guild_class) === cls);
        if (!pick)
            continue;
        const mech = (pick.mechanisms ?? [])
            .map((m) => m?.claim).find((c) => !!c) ?? null;
        shown.push({ id: String(pick.id), name: nameOf(pick), mechanism: mech });
    }
    return { shown, more: Math.max(0, plantable.length - shown.length) };
}
function quickCrops(species, limit = 10) {
    const out = [];
    for (const sp of species) {
        if (String(sp.scheduling_model ?? "") !== "dtm")
            continue;
        const cat = String(sp.category ?? "");
        if (cat === "cover_crop" || cat === "flower")
            continue;
        const dtm = sp.days_to_maturity;
        const low = Array.isArray(dtm) ? Number(dtm[0]) : Number(dtm);
        if (!Number.isFinite(low) || low <= 0)
            continue;
        const common = sp.common?.[0];
        if (!common)
            continue;
        out.push({ id: String(sp.id), name: common, days: low });
    }
    out.sort((a, b) => (a.days - b.days) || a.name.localeCompare(b.name));
    return out.slice(0, limit);
}
function guildFromHash(hash) {
    const q = String(hash).indexOf("?");
    if (q < 0)
        return null;
    const raw = new URLSearchParams(String(hash).slice(q + 1)).get("guild");
    if (!raw)
        return null;
    const id = raw.trim().toLowerCase();
    return /^[a-z0-9_]+$/.test(id) ? id : null;
}

export { CONFIDENCE, CONFIDENCE_ES, DOORS, ENFORCEMENT_CONCERN, ENFORCEMENT_COST, ENFORCEMENT_DOES, MAINTAINER_MARKER_PATTERN, MOUND_MIN_SPAN_M, R, allDoorClaims, appLang, applyCopy, applySeasonalCopy, awaitingHome, bindSettling, bundleInfoLine, buzz, captureAuthHash, captured, chunkFor, chunkReady, clearLoading, clearStarted, containerCrops, copy, copyBoot, countDoor, countGardenActive, countNext, countPageview, countRung, currentRoute, dateLocale, daysAway, doorClaim, enOnly, esGuide, esTwin, familiesPlural, familyInProse, familyKeyOf, familyName, familyShown, fillCopy, fillNodes, firstStepHash, go, guildFromHash, headlineTeams, homeRendered, homeSettled, html, humanize, humanizeFamilies, humanizeRuleRefs, initNav, initRouter, installLateCopy, isStarted, labelCopy, landingFastPath, langChosen, langPending, loadChunk, markFailed, markHomeworthy, markLoading, markPlantName, markStarted, midSentence, nameAsLabel, nav, noteArrival, noteSignInStart, numberLocale, onChunkLoaded, ownScroll, plainClaim, pluralCopy, plusPreview, quickCrops, resolveAlias, scrollerFor, seat, setShowingOriginals, settleHome, showingOriginals, signInMayMove, situationFromHash, situations, stationDisplay, storeLang, storedLang, stripRuleCitations, titleCase, warmChunks, whenIdle, withFacts };
