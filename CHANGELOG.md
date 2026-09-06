# Changelog

All notable changes to `ltn-print-labels`.

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
