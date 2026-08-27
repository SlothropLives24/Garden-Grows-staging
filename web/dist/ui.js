// The shell's rendering helper (D-024): Preact + htm, vendored under web/vendor/ - tagged
// templates instead of JSX so plain `tsc` remains the entire build. DOM layer only: engine
// files can never import this (the lint refuses non-sibling imports in web/src/engine/).
import { h, render } from "preact";
import htm from "htm";
export const html = htm.bind(h);
export { render };
export { useState, useEffect, useRef } from "preact/hooks";
