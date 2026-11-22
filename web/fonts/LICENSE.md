# Vendored fonts

All three families are licensed under the SIL Open Font License 1.1
(https://openfontlicense.org), which permits bundling with software. Files are
latin-subset variable woff2 builds, vendored because the app's
Content-Security-Policy allows no third-party font hosts. (Bricolage Grotesque
was retired in O164 — the app runs one grotesque, Hanken, for UI chrome.)

- `HankenGrotesk[wght].woff2` — Hanken Grotesk,
  copyright 2015 The Hanken Design Co.
  (https://github.com/marcologous/hanken-grotesk).
- `Fraunces[opsz,SOFT,WONK,wght].woff2` and
  `Fraunces-Italic[opsz,SOFT,WONK,wght].woff2` — Fraunces (the almanac display
  serif, O146 step A), copyright 2020 The Fraunces Project Authors
  (https://github.com/undercasetype/Fraunces). The italic is a true italic
  face, not a synthesized oblique. Built from `@fontsource-variable/fraunces`
  (latin-full subset). **Two of its four axes are pinned** (perf track 5,
  2026-09-26): SOFT and WONK are instanced at their own defaults (SOFT=0,
  WONK=1) with fontTools `varLib.instancer` (4.66, `optimize=False`,
  overlap flags left unset), so opsz + wght stay variable and the files
  shrink 121 -> 67 KB (roman) and 150 -> 82 KB (italic). Nothing in the
  app or the site ever set `font-variation-settings`, so no reachable
  style changed: HarfBuzz shapes identically at every opsz/wght sampled,
  advances match, and outlines match to font-unit rounding. Headless
  Chromium renders pixel-identical text at 24px and up; below that, a few
  glyphs (roman h m n s &, italic b d h k l v w &) differ by an
  anti-aliasing step (invisible at 10x zoom - the same glyph, rounded one
  font unit differently). The FILENAMES
  keep `SOFT,WONK` on purpose - the @font-face src in web/styles.css and
  content/static/pages.css names them, and the axis list in a filename is a
  label, not a contract. To redo it from an upstream build:
  `fonttools varLib.instancer <in> SOFT=0 WONK=1 --no-optimize --no-overlap-flag -o <out>`
  then re-flavor as woff2.
- `Newsreader[opsz,wght].woff2` and `Newsreader-Italic[opsz,wght].woff2` —
  Newsreader (the almanac text serif for long-form reading, O164 slice 1),
  copyright 2019 The Newsreader Project Authors
  (https://github.com/productiontype/Newsreader). Latin-subset variable woff2
  (opsz + wght), roman and a true italic face.
