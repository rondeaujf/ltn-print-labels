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
  labelMm: 55, // label width in mm (clamped: 30–120 portrait, 30–260 landscape)
  fields: "first", // "first" | "last" | "both"
  showLevel: true, // show the level as a light line above the name
};

// Live preview inside a dialog. `maxPreviewWidth` / `maxPreviewHeight` (px,
// preview only — ignored by computeLabelLayout) fix the target size so the
// sheet is deterministic on every re-render and the whole page stays visible.
const dims = { maxPreviewWidth: 780, maxPreviewHeight: 520 };
const preview = createLabelPreview("#preview", roster, { ...options, ...dims });
preview.update(roster, { ...options, orient: "L", ...dims });
preview.destroy();

// Layout model — hand this to your PDF renderer.
const layout = computeLabelLayout(roster, options);
// { orient, cols, groupes, labelWmm, labelHmm, fontMm, levelFontMm,
//   levelRowMm, pageWmm, pageHmm,
//   rows: [{ cells: [{ name, level, empty }, ...] }, ...] }
// `levelRowMm`: fixed-height band reserved at the top of every cell for the
// level badge (pinned top-left, same place on every label, independent of
// any student's name or level text — see `showLevel`).
```

## API

| Export                                             | Description                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `computeLabelLayout(students, options)`            | Pure layout model (throws if the roster is empty).                   |
| `disambiguateFirstNames(students)`                 | One label string per student, first names only, collisions resolved. |
| `resolveLabelText(students, fields)`               | `"first"` / `"last"` / `"both"`.                                     |
| `createLabelPreview(container, students, options)` | `{ update(students?, options?), destroy() }`.                        |
| `LABEL_MM_BOUNDS`                                  | `{ P: [30, 120], L: [30, 260] }`.                                    |

`students`: `Array<{ firstname?: string, lastname?: string, level?: string }>`.

## License

ISC © Jean-François Rondeau
