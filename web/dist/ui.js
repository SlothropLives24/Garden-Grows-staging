import { h, render } from "preact";
import htm from "htm";
export const html = htm.bind(h);
export { render };
export { useState, useEffect, useRef } from "preact/hooks";
