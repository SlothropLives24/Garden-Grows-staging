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
  (latin-full subset, all four axes).
- `Newsreader[opsz,wght].woff2` and `Newsreader-Italic[opsz,wght].woff2` —
  Newsreader (the almanac text serif for long-form reading, O164 slice 1),
  copyright 2019 The Newsreader Project Authors
  (https://github.com/productiontype/Newsreader). Latin-subset variable woff2
  (opsz + wght), roman and a true italic face.
