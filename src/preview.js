// Aperçu WYSIWYG : UNE page A4 (portrait ou paysage), rendue à l'échelle réduite
// en pixels réels — pas de `transform: scale()` (qui, sur un tableau
// `border-collapse`, fait sauter une bordure 1px sur deux). Le même
// `computeLabelLayout` qui nourrit le PDF sert ici.
//
// L'aperçu ne montre QUE la première page (`rowsPerPage`) : au-delà, le PDF
// paginerait — inutile de faire déborder l'aperçu. Chaque case a une hauteur
// fixe et coupe son trop-plein, comme mPDF côté PDF.

import { computeLabelLayout } from "./layout.js";

const PX_PER_MM = 96 / 25.4;
const MARGIN_MM = 7; // marge d'impression, miroir de layout.js
const HEADER_MM = 12; // bande figurant l'en-tête générique du site (repère)

/**
 * @param {Element|string} container hôte de l'aperçu (vidé et repris en main)
 * @param {Array<object>} students
 * @param {object} options cf. computeLabelLayout (+ `maxPreviewWidth` /
 *   `maxPreviewHeight` en px)
 * @returns {{ update(students?:Array<object>, options?:object): void, destroy(): void }}
 */
export function createLabelPreview(container, students, options = {}) {
  const host =
    typeof container === "string"
      ? document.querySelector(container)
      : container;
  if (!host) throw new Error("Conteneur d'aperçu introuvable.");

  host.classList.add("lpl-preview");
  const page = document.createElement("div");
  page.className = "lpl-page";
  host.replaceChildren(page);

  let curStudents = students;
  let curOptions = options;

  function draw(nextStudents, nextOptions) {
    curStudents = nextStudents;
    curOptions = nextOptions;

    const layout = computeLabelLayout(nextStudents, nextOptions);

    const pageWpx = layout.pageWmm * PX_PER_MM;
    const pageHpx = layout.pageHmm * PX_PER_MM;
    const availW =
      Number(nextOptions?.maxPreviewWidth) || host.clientWidth || pageWpx;
    const availH = Number(nextOptions?.maxPreviewHeight) || Infinity;
    // Réduction pour tenir dans la largeur ET (optionnel) la hauteur dispo.
    const k = Math.min(1, availW / pageWpx, availH / pageHpx);

    page.style.width = `${Math.round(pageWpx * k)}px`;
    page.style.height = `${Math.round(pageHpx * k)}px`;
    page.style.padding = `${MARGIN_MM * PX_PER_MM * k}px`;
    page.style.overflow = "hidden";

    const grid = document.createElement("table");
    grid.className = "lpl-grid";
    grid.style.setProperty("--w", `${layout.labelWmm * PX_PER_MM * k}px`);
    grid.style.setProperty("--h", `${layout.labelHmm * PX_PER_MM * k}px`);
    grid.style.setProperty("--f", `${layout.fontMm * PX_PER_MM * k}px`);
    grid.style.setProperty("--lf", `${layout.levelFontMm * PX_PER_MM * k}px`);

    // Bande figurant l'en-tête générique du site (école / enseignant / classe) :
    // sans elle, la grille flotte dans le vide en haut de page.
    const head = document.createElement("div");
    head.className = "lpl-page__head";
    head.style.height = `${Math.round(HEADER_MM * PX_PER_MM * k)}px`;

    // Une seule page : au-delà de rowsPerPage, le PDF passerait à la page
    // suivante.
    const rows = layout.rows.slice(0, layout.rowsPerPage);

    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const cell of row.cells) {
        const td = document.createElement("td");
        td.className = cell.empty ? "lpl-cell lpl-cell--empty" : "lpl-cell";

        // Boîte à hauteur fixe qui coupe le trop-plein (le <td> seul ne fait
        // que grandir avec son contenu). Même empilement que le PDF : niveau
        // discret aligné à gauche, prénom centré.
        const box = document.createElement("div");
        box.className = "lpl-cell__box";
        if (cell.level) {
          const lvl = document.createElement("div");
          lvl.className = "lpl-cell__lvl";
          lvl.textContent = cell.level;
          box.appendChild(lvl);
        }
        const name = document.createElement("div");
        name.className = "lpl-cell__name";
        name.textContent = cell.name || "";
        box.appendChild(name);

        td.appendChild(box);
        tr.appendChild(td);
      }
      grid.appendChild(tr);
    }
    page.replaceChildren(head, grid);
  }

  draw(students, options);

  return {
    update(nextStudents, nextOptions) {
      draw(nextStudents ?? curStudents, nextOptions ?? curOptions);
    },
    destroy() {
      host.replaceChildren();
      host.classList.remove("lpl-preview");
    },
  };
}
