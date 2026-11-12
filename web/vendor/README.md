# Vendored shell framework (D-024)

Static, unmodified library files committed to the repo — the app installs nothing at runtime
and at build time alike. **Do not edit these files**; to change a version, re-run the refresh
procedure below and commit the result with the new hashes in this README.

Used by the DOM layer (`web/src/`) only. `web/src/engine/` must never import them — the
DOM-free lint in `web/test.mjs` refuses any non-sibling import in engine files, which
mechanically includes these.

## Contents and provenance

Both tarballs fetched from the npm registry (the canonical source) and verified against the
registry's published sha512 integrity before extraction, 2026-07-12.

**preact 10.29.7** — `https://registry.npmjs.org/preact/-/preact-10.29.7.tgz`
`sha512-DCHYrK/B10yUD3ZjLfhZ3WIE/9Vf9VFUODcRE2dRomTYDpJk6z6L9wecSfhfE6M9ZTHUdyQkoC46arIDhEV84Q==`

| file here | file in tarball |
|---|---|
| `preact.mjs` | `package/dist/preact.mjs` |
| `preact-hooks.mjs` | `package/hooks/dist/hooks.mjs` |
| `types/preact/index.d.ts`, `jsx.d.ts`, `dom.d.ts` | `package/src/` (same names) |
| `types/preact-hooks.d.ts` | `package/hooks/src/index.d.ts` |
| `LICENSE-preact` | `package/LICENSE` (MIT) |

**htm 3.1.1** — `https://registry.npmjs.org/htm/-/htm-3.1.1.tgz`
`sha512-983Vyg8NwUE7JkZ6NmOqpCZ+sh1bKv2iYTlUkzlWmA5JD2acKoxd4KVxbMmxX/85mtfdnDmTFoNKcg5DGAvxNQ==`

| file here | file in tarball |
|---|---|
| `htm.mjs` | `package/dist/htm.module.js` |
| `types/htm.d.ts` | `package/dist/htm.d.ts` |
| `LICENSE-htm` | `package/LICENSE` (Apache-2.0) |

## Per-file hashes (verify offline)

The tarball sha512s above verify what was DOWNLOADED; these verify what is SHIPPED, so the three
`.mjs` can be checked without the registry (O162 C17, audit S10): `sha256sum -c` against this table,
and `web/test.mjs` re-derives them on every run so an edit to a vendored file is a red build.

| file | sha256 |
|---|---|
| `htm.mjs` | `ab33dd3f38059b9be4d5f5350128eefb2356639c4e0bbe9d9e8b3ba75847e9e4` |
| `preact-hooks.mjs` | `a6ee626f2d01570592dd569a792e3f050154aa02890eead8c223fa3ed5aa3d5a` |
| `preact.mjs` | `850dcba8ed3535b0a3611495c405551b9887724885d3b8482207a03de365d64e` |

## How the wiring works

- **Runtime:** `preact-hooks.mjs` (and app code) import the bare specifier `"preact"` etc.;
  the import map in `web/index.html` resolves those to these files. No bundler.
- **Types:** `web/tsconfig.json` maps the same bare specifiers onto `types/` here via `paths`,
  so `tsc` type-checks imports without a `node_modules/`.
- **App code** imports through `web/src/ui.ts` (`html` tagged templates + `render`) — htm
  instead of JSX, so plain `tsc` stays the whole build.

## Refresh procedure

1. `curl -O https://registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz` for the new version.
2. Verify: compare sha512 of the tarball against `dist.integrity` from
   `https://registry.npmjs.org/<pkg>/<ver>` before extracting.
3. Copy the files per the tables above; update versions + the tarball hashes AND the per-file
   sha256 table in this README (`sha256sum web/vendor/*.mjs`).
4. `make web` must stay green (the lint, the unit tests, and conformance all run).
