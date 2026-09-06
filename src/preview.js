// Aperçu WYSIWYG : UNE page A4 (portrait ou paysage), rendue à l'échelle réduite
// en pixels réels. Grille en CSS Grid (colonnes `repeat(n, <w>px)`) — largeur
// parfaitement déterministe, aucun reflow surprise contrairement à un <table>
// `table-layout:fixed`. Le même `computeLabelLayout` qui nourrit le PDF sert
// ici ; l'aperçu ne montre que la 1re page (`rowsPerPage`).

import { computeLabelLayout } from "./layout.js";

const PX_PER_MM = 96 / 25.4;
const MARGIN_MM = 7; // marge d'impression, miroir de layout.js
const HEADER_MM = 12; // fine bande figurant l'en-tête générique du site

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
    const k = Math.min(1, availW / pageWpx, availH / pageHpx);

    page.style.width = `${Math.round(pageWpx * k)}px`;
    page.style.height = `${Math.round(pageHpx * k)}px`;
    page.style.padding = `${Math.round(MARGIN_MM * PX_PER_MM * k)}px`;
    page.style.overflow = "hidden";

    const head = document.createElement("div");
    head.className = "lpl-page__head";
    head.style.height = `${Math.round(HEADER_MM * PX_PER_MM * k)}px`;

    // Dimensions de case ARRONDIES au pixel entier : avec `gap: 1px` sur une
    // grille dont les cases tomberaient sur des fractions de pixel, le
    // navigateur laisse disparaître une ligne de découpe sur deux.
    const cw = Math.round(layout.labelWmm * PX_PER_MM * k);
    const ch = Math.round(layout.labelHmm * PX_PER_MM * k);

    const grid = document.createElement("div");
    grid.className = "lpl-grid";
    // display + colonnes en ligne : la grille tient même si l'hôte n'a pas
    // importé style.css.
    grid.style.display = "grid";
    grid.style.setProperty("--w", `${cw}px`);
    grid.style.setProperty("--h", `${ch}px`);
    grid.style.setProperty(
      "--f",
      `${Math.round(layout.fontMm * PX_PER_MM * k)}px`,
    );
    grid.style.setProperty(
      "--lf",
      `${Math.round(layout.levelFontMm * PX_PER_MM * k)}px`,
    );
    grid.style.gridTemplateColumns = `repeat(${layout.cols}, var(--w))`;

    // Une seule page : au-delà, le PDF paginerait.
    const rows = layout.rows.slice(0, layout.rowsPerPage);
    for (const row of rows) {
      for (const cell of row.cells) {
        const c = document.createElement("div");
        c.className = cell.empty ? "lpl-cell lpl-cell--empty" : "lpl-cell";
        if (cell.level) {
          const lvl = document.createElement("div");
          lvl.className = "lpl-cell__lvl";
          lvl.textContent = cell.level;
          c.appendChild(lvl);
        }
        const name = document.createElement("div");
        name.className = "lpl-cell__name";
        name.textContent = cell.name || "";
        c.appendChild(name);
        grid.appendChild(c);
      }
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
