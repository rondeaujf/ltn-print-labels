// Aperçu WYSIWYG : UNE page A4 (portrait ou paysage), rendue à l'échelle réduite
// en pixels réels. Grille en CSS Grid à pas FIXE (`repeat(n, <w>px)` +
// `grid-auto-rows: <h>px`). Tous les styles qui portent la mise en page sont
// posés EN LIGNE ici — l'aperçu est correct même si l'hôte n'importe pas
// `style.css` (qui ne fait plus que de la décoration). Le même
// `computeLabelLayout` qui nourrit le PDF sert ici ; on ne montre que la 1re
// page (`rowsPerPage`).

import { computeLabelLayout } from "./layout.js";

const PX_PER_MM = 96 / 25.4;
const MARGIN_MM = 7; // marge d'impression, miroir de layout.js
const HEADER_MM = 12; // fine bande figurant l'en-tête générique du site
const FONT_STACK = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

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
  host.style.overflow = "auto";
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

    const pageW = Math.round(pageWpx * k);
    const pad = Math.round(MARGIN_MM * PX_PER_MM * k);
    page.style.cssText =
      `box-sizing:border-box;width:${pageW}px;height:${Math.round(pageHpx * k)}px;` +
      `padding:${pad}px;overflow:hidden;background:#fff;` +
      `box-shadow:0 1px 6px rgba(0,0,0,.25);`;
    // Centrage par une marge ENTIÈRE (pas via flex/`margin:auto` qui posent la
    // page sur une demi-pixel → les filets 1px de la grille sautent).
    const boxInner = (host.clientWidth || pageW) - 16;
    page.style.marginLeft = `${Math.max(0, Math.floor((boxInner - pageW) / 2))}px`;

    // Dimensions ENTIÈRES : sur une grille dont les cases tomberaient sur des
    // fractions de pixel, le navigateur laisse disparaître un filet sur deux.
    const cw = Math.round(layout.labelWmm * PX_PER_MM * k);
    const ch = Math.round(layout.labelHmm * PX_PER_MM * k);
    const cf = Math.round(layout.fontMm * PX_PER_MM * k);
    const clf = Math.round(layout.levelFontMm * PX_PER_MM * k);

    const head = document.createElement("div");
    head.className = "lpl-page__head";
    head.style.cssText =
      `height:${Math.round(HEADER_MM * PX_PER_MM * k)}px;` +
      `border-bottom:1px solid #c9d2db;background:#f3f6f9;`;

    // Filets jointifs sans <table> ni astuce de fond : chaque case porte ses
    // bordures HAUT + GAUCHE, la grille ferme à DROITE + BAS.
    const grid = document.createElement("div");
    grid.className = "lpl-grid";
    grid.style.cssText =
      `display:grid;grid-template-columns:repeat(${layout.cols}, ${cw}px);` +
      `grid-auto-rows:${ch}px;width:max-content;margin:4px auto 0;` +
      `border-right:1px solid #000;border-bottom:1px solid #000;`;

    const rows = layout.rows.slice(0, layout.rowsPerPage);
    for (const row of rows) {
      for (const cell of row.cells) {
        const c = document.createElement("div");
        c.className = cell.empty ? "lpl-cell lpl-cell--empty" : "lpl-cell";
        c.style.cssText =
          `box-sizing:border-box;width:${cw}px;height:${ch}px;overflow:hidden;` +
          `border-top:1px solid #000;border-left:1px solid #000;` +
          `display:flex;flex-direction:column;justify-content:center;` +
          `padding:0 2px;background:${cell.empty ? "#f2f2f2" : "#fff"};` +
          `font-family:${FONT_STACK};`;

        if (cell.level) {
          const lvl = document.createElement("div");
          lvl.className = "lpl-cell__lvl";
          lvl.style.cssText = `font:400 ${clf}px/1 ${FONT_STACK};color:#8a8a8a;text-align:center;`;
          lvl.textContent = cell.level;
          c.appendChild(lvl);
        }
        const name = document.createElement("div");
        name.className = "lpl-cell__name";
        name.style.cssText = `font:700 ${cf}px/1.05 ${FONT_STACK};text-align:center;overflow:hidden;`;
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
      host.style.overflow = "";
    },
  };
}
