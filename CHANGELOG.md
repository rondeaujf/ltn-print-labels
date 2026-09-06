# Changelog

All notable changes to `ltn-print-labels`.

## 0.1.9

- Preview is now fully self-styling: every layout-critical rule (cell size,
  1px borders, grid tracks, fonts) is set inline by preview.js. It was
  relying on style.css being imported by the consumer and on CSS custom
  properties resolving; where that did not hold the columns collapsed to
  content width and the grid lines vanished. style.css is now decoration
  only.
- Grid uses fixed `repeat(n, <w>px)` + `grid-auto-rows: <h>px` so every
  cell is identical; borders are top+left per cell, closed right+bottom on
  the container (no gap trick).

## 0.1.8

- Columns now tile the A4 usable width edge to edge: the slider is a
  TARGET size, the layout picks the nearest whole column count and stretches
  the label to fill (no leftover side margin). `labelWmm` is derived.
- Preview page centred with an integer margin instead of flex/`margin:auto`,
  which parked it on a half-pixel and dropped grid lines.

## 0.1.7

- Preview cell dimensions rounded to whole pixels. With `gap: 1px` on a
  grid whose cells fell on sub-pixel boundaries, the browser dropped every
  other 1px cut line.

## 0.1.6

- Preview grid rebuilt on **CSS Grid** (`grid-template-columns: repeat(n,
<w>px)`) instead of a `<table>`. A `table-layout:fixed` table kept
  reflowing on successive `update()` calls (orientation / size / name mode)
  and the grid drifted off the page. The grid width is now exact and every
  re-render is stable.
- Level is a small grey line centred just above the name, in the preview and
  in the PDF template — the same, tight, no white gaps. (The top-left corner
  badge was dropped: mPDF cannot place it there.)

## 0.1.5

- Preview header band cut from 34 mm to 12 mm — it is only a marker, it was
  eating two-thirds of the page.

## 0.1.4

- `computeLabelLayout` returns `rowsPerPage`. `createLabelPreview` now renders
  only that many rows — one page. Past that the real PDF paginates; the
  preview no longer runs off the bottom (a big label size that yielded a
  single very tall column used to overflow endlessly).
- Each preview cell gets a fixed-height inner box that clips its overflow, so
  a long or wrapping name can't stretch the row (mirrors mPDF's cell clip).
- Level line kept at the top-left, name vertically centred in the box.

## 0.1.3

- `createLabelPreview` accepts `options.maxPreviewWidth` (px). Relying on the
  host element's `clientWidth` alone broke every re-render (orientation
  toggle, size, name mode) when the host sizes itself to its content — the
  page fed its own width back in and the layout blew up. Pass an explicit
  width and each render is deterministic.
- Level line forced to full cell width so `text-align: left` actually
  left-aligns it (mPDF was centring it).

## 0.1.2

- The level is now a plain in-flow line above the name (small, left-aligned,
  light grey), instead of an absolutely-positioned corner badge. mPDF (the
  consumer's server-side PDF renderer) cannot reliably position an element in
  a cell corner nor resolve `em` font sizes there, so the preview and the PDF
  drifted apart. `computeLabelLayout` now returns `levelFontMm` (half the name
  size) so both sides render the level at the exact same absolute size.

## 0.1.1

- `createLabelPreview` no longer uses `transform: scale()`. Scaling a
  `border-collapse` table with a transform dropped roughly every other 1px
  border (sub-pixel rounding) and left the grid drifting off the right of the
  page. The sheet is now rendered directly at reduced pixel dimensions, so
  every cut line stays a crisp 1px.
- The preview host is a flex container that centers the page horizontally.
- Level badge slightly lighter (`#8a8a8a`, normal weight).

## 0.1.0

- Initial release. Extracted from letableaunoir's server-side « Étiquettes »
  export.
- `computeLabelLayout(students, options)` — pure layout model: whole-group
  repetition to fill an A4 page (never a partial group), joined cut lines, last
  row padded with empty cells, portrait/landscape with wider labels allowed in
  landscape (30–260 mm vs 30–120 mm).
- `disambiguateFirstNames(students)` — identical first names are disambiguated
  by the shortest last-name prefix that separates the whole group
  (`Léa M.` / `Léa C.`, then `Léa Ma.` / `Léa Mi.`); identical last names fall
  back to a numeric suffix.
- `resolveLabelText(students, fields)` — `"first"` / `"last"` / `"both"`.
- `createLabelPreview(container, students, options)` — WYSIWYG full-page
  preview, same layout engine as the output. `options.maxPreviewHeight` (px)
  caps the height so the whole sheet stays visible.
