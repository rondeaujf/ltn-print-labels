# ltn-print-labels

Standalone, framework-free module that turns a class roster into a **printable
label grid** of student names — the kind you cut out and stick on trays,
cubbies, notebooks. Extracted from
[letableaunoir](https://jfrondeau.fr)'s server-side « Étiquettes » export so the
same layout logic drives both the live preview and the PDF.

- **First-name disambiguation.** Two `Léa` in the class become `Léa M.` /
  `Léa C.` — and if that is still ambiguous, `Léa Ma.` / `Léa Mi.`, using the
  shortest last-name prefix that separates the whole group. Identical last names
  fall back to `Léa (1)` / `Léa (2)`.
- **Whole-group repetition.** The class is repeated an integer number of times
  to fill an A4 page — never a partial group.
- **Joined labels.** 1px borders double as cut lines.
- **Portrait / landscape**, with wider labels allowed in landscape.
- **WYSIWYG preview.** `createLabelPreview` renders a full A4 page scaled down
  to fit its container (computed in real pixels, no CSS transform — cut lines
  stay a crisp 1px), horizontally centred.
- **No backend, no network, no runtime dependencies.**

## Install

```sh
npm install ltn-print-labels
```

## Usage

```js
import { computeLabelLayout, createLabelPreview } from "ltn-print-labels";
import "ltn-print-labels/style.css"; // preview only

const roster = [
  { firstname: "Léa", lastname: "Martin", level: "CE1" },
  { firstname: "Léa", lastname: "Claude", level: "CE1" },
  { firstname: "Tom", lastname: "Petit", level: "CE2" },
];

const options = {
  orient: "P", // "P" | "L"
  cols: 4, // labels PER ROW (1–7 portrait, 1–9 landscape) — see LABEL_COLS_BOUNDS
  fontMm: undefined, // MAX font size (mm); omit → auto: ~85 % of labels share it
  fields: "first", // "first" | "last" | "both"
  showLevel: true, // show the level as a light line above the name
};

// `cols` is the honest control: what you ask for is what you get, and the
// label width follows (usable width / cols). The older `labelMm` option still
// works and is unchanged, but a width in mm is only a TARGET, snapped to the
// nearest whole column count — in portrait 90, 110 and 120 mm all yield 2
// columns of 98 mm, and one label per row is unreachable. Prefer `cols`;
// `labelMm` is used only when `cols` is absent.

// `fontMm` is the second control: the MAX font size. Every label uses it and
// only overflowing names shrink (per cell). Omit it and it is derived so that
// ~85 % of the labels keep the same size — the ~15 % longest shrink. The
// layout returns `fontMmAuto` / `fontMmMin` / `fontMmMax` to drive a slider;
// a supplied value is clamped to that range.

// Live preview inside a dialog. `maxPreviewWidth` / `maxPreviewHeight` (px,
// preview only — ignored by computeLabelLayout) fix the target size so the
// sheet is deterministic on every re-render and the whole page stays visible.
const dims = { maxPreviewWidth: 780, maxPreviewHeight: 520 };
const preview = createLabelPreview("#preview", roster, { ...options, ...dims });
preview.update(roster, { ...options, orient: "L", ...dims });
preview.destroy();

// Layout model — hand this to your PDF renderer.
const layout = computeLabelLayout(roster, options);
// { orient, cols, groupes, labelWmm, labelHmm,
//   fontMm, fontMmAuto, fontMmMin, fontMmMax, levelFontMm,
//   levelRowMm, pageWmm, pageHmm,
//   rows: [{ cells: [{ name, level, empty }, ...] }, ...] }
// `levelRowMm`: fixed-height band reserved at the top of every cell for the
// level badge (pinned top-left, same place on every label, independent of
// any student's name or level text — see `showLevel`).
// Each cell also carries its own `fontMm`: the nominal size for names that
// fit, reduced only for the ones that would overflow the label. Words are
// never broken and the label width never varies, so every column stays
// identical — including in a server-side PDF renderer such as mPDF.
```

## API

| Export                                                     | Description                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `computeLabelLayout(students, options)`                    | Pure layout model (throws if the roster is empty).                   |
| `disambiguateFirstNames(students)`                         | One label string per student, first names only, collisions resolved. |
| `resolveLabelText(students, fields)`                       | `"first"` / `"last"` / `"both"`.                                     |
| `createLabelPreview(container, students, options)`         | `{ update(students?, options?), destroy() }`.                        |
| `LABEL_COLS_BOUNDS`                                        | `{ P: [1, 7], L: [1, 9] }` — labels per row, for a discrete slider.  |
| `LABEL_MM_BOUNDS`                                          | `{ P: [30, 120], L: [30, 260] }` — bounds of the legacy `labelMm`.   |
| `fitFontMm(text, labelWmm, nominalMm)`                     | Font size that makes `text` fit, never breaking a word.              |
| `autoNominalFontMm(texts, labelWmm, ceilingMm, quantile?)` | Max font size at which `1 − quantile` (default 85 %) of `texts` fit. |

`students`: `Array<{ firstname?: string, lastname?: string, level?: string }>`.

## License

ISC © Jean-François Rondeau
