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
    // clientWidth inclut le padding de l'hôte (8px de style.css quand elle est
    // chargée) : on le retranche, sinon la page déborde de l'hôte.
    const hostCS = host.ownerDocument?.defaultView?.getComputedStyle?.(host);
    const hostPadX = hostCS
      ? (parseFloat(hostCS.paddingLeft) || 0) +
        (parseFloat(hostCS.paddingRight) || 0)
      : 0;
    const hostW = Math.max(0, (host.clientWidth || 0) - hostPadX);
    const availW = Number(nextOptions?.maxPreviewWidth) || hostW || pageWpx;
    const availH = Number(nextOptions?.maxPreviewHeight) || Infinity;
    const k = Math.min(1, availW / pageWpx, availH / pageHpx);

    const pageW = Math.round(pageWpx * k);
    const pageH = Math.round(pageHpx * k);
    const pad = Math.round(MARGIN_MM * PX_PER_MM * k);
    page.style.cssText =
      `box-sizing:border-box;width:${pageW}px;height:${pageH}px;` +
      `padding:${pad}px;overflow:hidden;background:#fff;` +
      `box-shadow:0 1px 6px rgba(0,0,0,.25);`;
    // Centrage par une marge ENTIÈRE (pas via flex/`margin:auto` qui posent la
    // page sur une demi-pixel → les filets 1px de la grille sautent).
    const boxInner = hostW || pageW;
    page.style.marginLeft = `${Math.max(0, Math.floor((boxInner - pageW) / 2))}px`;

    // Boîte intérieure RÉELLE de la page (après les arrondis ci-dessus) : c'est
    // elle qui fait foi, pas une reconversion mm→px qui peut arrondir au-dessus
    // et faire rogner le filet droit par `overflow:hidden`.
    const innerW = pageW - 2 * pad;
    const innerH = pageH - 2 * pad;
    const headH = Math.round(HEADER_MM * PX_PER_MM * k);
    const gridGapTop = 4; // marge au-dessus de la grille

    // Dimensions ENTIÈRES : sur une grille dont les cases tomberaient sur des
    // fractions de pixel, le navigateur laisse disparaître un filet sur deux.
    // La largeur de case PAVE la boîte intérieure (comme le PDF pave la largeur
    // utile de l'A4) : cols·cw + 1px de fermeture ≤ innerW, par construction.
    const cw = Math.max(1, Math.floor((innerW - 1) / layout.cols));
    // Hauteur proportionnelle à la case réellement rendue, bornée pour que
    // en-tête + marge + lignes + filet bas tiennent dans la page.
    const gridMaxH = innerH - (headH + 1) - gridGapTop - 1;
    const rowsShown = Math.min(layout.rows.length, layout.rowsPerPage);
    const ch = Math.max(
      1,
      Math.min(
        Math.round((cw * layout.labelHmm) / layout.labelWmm),
        Math.floor(gridMaxH / Math.max(1, rowsShown)),
      ),
    );
    // Facteur mm -> px de cette page (même base que cw/labelWmm) : chaque
    // étiquette porte SA police (réduite seulement si son nom déborde), il
    // faut donc convertir par cellule et non une fois pour toutes.
    const mmToPx = cw / layout.labelWmm;
    const clf = Math.max(1, Math.round(layout.levelFontMm * mmToPx));
    // Même base d'échelle que les polices : la bande de niveau reste
    // proportionnée à celle qu'elle contient quels que soient les arrondis
    // indépendants de ch (hauteur de ligne, bornée pour tenir dans la page).
    const clRow = Math.max(1, Math.round(layout.levelRowMm * mmToPx));

    const head = document.createElement("div");
    head.className = "lpl-page__head";
    head.style.cssText =
      `height:${headH}px;` +
      `border-bottom:1px solid #c9d2db;background:#f3f6f9;`;

    // Filets jointifs sans <table> ni astuce de fond : chaque case porte ses
    // bordures HAUT + GAUCHE, la grille ferme à DROITE + BAS. Centrage par une
    // marge gauche ENTIÈRE : `margin:auto` poserait la grille sur une
    // demi-pixel quand (innerW − largeur de grille) est impair, et les filets
    // verticaux de 1px disparaîtraient.
    const gridW = layout.cols * cw + 1;
    const gridML = Math.max(0, Math.floor((innerW - gridW) / 2));
    const grid = document.createElement("div");
    grid.className = "lpl-grid";
    grid.style.cssText =
      `display:grid;grid-template-columns:repeat(${layout.cols}, ${cw}px);` +
      `grid-auto-rows:${ch}px;width:max-content;` +
      `margin:${gridGapTop}px 0 0 ${gridML}px;` +
      `border-right:1px solid #000;border-bottom:1px solid #000;`;

    const rows = layout.rows.slice(0, layout.rowsPerPage);
    for (const row of rows) {
      for (const cell of row.cells) {
        const c = document.createElement("div");
        c.className = cell.empty ? "lpl-cell lpl-cell--empty" : "lpl-cell";
        c.style.cssText =
          `box-sizing:border-box;width:${cw}px;height:${ch}px;overflow:hidden;` +
          `border-top:1px solid #000;border-left:1px solid #000;` +
          `display:flex;flex-direction:column;` +
          `padding:0 2px;background:${cell.empty ? "#f2f2f2" : "#fff"};` +
          `font-family:${FONT_STACK};`;

        // Le niveau est gaté sur l'OPTION globale showLevel, jamais sur le
        // contenu de cell.level : la bande est ainsi réservée à hauteur FIXE
        // sur TOUTE la planche, qu'un élève ait ou non un niveau renseigné —
        // le badge reste toujours en haut à gauche, au même endroit, et le
        // prénom centré dans le reste de la case ne bouge jamais avec lui.
        // Miroir du PDF : mPDF ne peut épingler un bloc en coin QUE via une
        // ligne de table à hauteur fixe (jamais position:absolute dans une
        // cellule) — cf. etiquettes_pdf.mustache du consommateur.
        if (nextOptions?.showLevel) {
          const lvl = document.createElement("div");
          lvl.className = "lpl-cell__lvl";
          lvl.style.cssText =
            `flex:0 0 ${clRow}px;height:${clRow}px;overflow:hidden;` +
            `font:400 ${clf}px/1 ${FONT_STACK};color:#8a8a8a;text-align:left;`;
          lvl.textContent = cell.level || "";
          c.appendChild(lvl);
        }

        // Le prénom occupe tout le reste de la case et y reste centré, quelle
        // que soit la hauteur de la bande de niveau au-dessus.
        const nameWrap = document.createElement("div");
        nameWrap.style.cssText =
          `flex:1 1 auto;min-height:0;overflow:hidden;` +
          `display:flex;align-items:center;justify-content:center;`;
        // Police de CETTE étiquette : nominale, sauf nom trop long (le module
        // l'a réduite pour qu'il tienne sans césure ni colonne élargie).
        const cellF = Math.max(
          1,
          Math.round((cell.fontMm ?? layout.fontMm) * mmToPx),
        );
        const name = document.createElement("div");
        name.className = "lpl-cell__name";
        name.style.cssText = `font:700 ${cellF}px/1.05 ${FONT_STACK};text-align:center;overflow:hidden;width:100%;`;
        name.textContent = cell.name || "";
        nameWrap.appendChild(name);
        c.appendChild(nameWrap);

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
