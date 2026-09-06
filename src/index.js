// ltn-print-labels — planche d'étiquettes de prénoms d'élèves à découper.
//
//   import { computeLabelLayout, createLabelPreview } from "ltn-print-labels";
//   import "ltn-print-labels/style.css"; // uniquement pour l'aperçu
//
// Entrée : un tableau `[{ firstname, lastname, level? }]` + des options
// `{ orient:"P"|"L", labelMm, fields:"first"|"last"|"both", showLevel }`.
// `computeLabelLayout` renvoie un modèle prêt à rendre (grille de cellules,
// géométrie mm) — le même que l'app POST au serveur pour le PDF mPDF.

export {
  computeLabelLayout,
  disambiguateFirstNames,
  resolveLabelText,
  LABEL_MM_BOUNDS,
} from "./layout.js";

export { createLabelPreview } from "./preview.js";
