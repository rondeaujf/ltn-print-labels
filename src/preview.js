// Aperçu WYSIWYG : une PAGE A4 COMPLÈTE (portrait ou paysage), rendue à
// l'échelle. On NE se sert PAS de `transform: scale()` — sur un tableau à
// `border-collapse`, mettre la page à l'échelle fait tomber une bordure 1px sur
// deux (arrondi sous-pixel). On calcule donc directement les dimensions en px
// réduits : chaque bordure reste un vrai 1px net. Le même `computeLabelLayout`
// qui nourrit le PDF sert ici ; la bascule d'orientation est un re-render.

import { computeLabelLayout } from "./layout.js";

const PX_PER_MM = 96 / 25.4;
const MARGIN_MM = 7; // marge d'impression, miroir de layout.js

/**
 * @param {Element|string} container hôte de l'aperçu (vidé et repris en main)
 * @param {Array<object>} students
 * @param {object} options cf. computeLabelLayout (+ `maxPreviewHeight` en px)
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
    const availW = host.clientWidth || pageWpx;
    const availH = Number(nextOptions?.maxPreviewHeight) || Infinity;
    // Réduction pour tenir dans la largeur du dialog ET (optionnel) sa hauteur :
    // on voit toujours la feuille entière.
    const k = Math.min(1, availW / pageWpx, availH / pageHpx);

    page.style.width = `${Math.round(pageWpx * k)}px`;
    page.style.height = `${Math.round(pageHpx * k)}px`;
    page.style.padding = `${MARGIN_MM * PX_PER_MM * k}px`;

    const grid = document.createElement("table");
    grid.className = "lpl-grid";
    grid.style.setProperty("--w", `${layout.labelWmm * PX_PER_MM * k}px`);
    grid.style.setProperty("--h", `${layout.labelHmm * PX_PER_MM * k}px`);
    grid.style.setProperty("--f", `${layout.fontMm * PX_PER_MM * k}px`);

    for (const row of layout.rows) {
      const tr = document.createElement("tr");
      for (const cell of row.cells) {
        const td = document.createElement("td");
        td.className = cell.empty ? "lpl-cell lpl-cell--empty" : "lpl-cell";
        if (cell.level) {
          const lvl = document.createElement("span");
          lvl.className = "lpl-cell__lvl";
          lvl.textContent = cell.level;
          td.appendChild(lvl);
        }
        td.appendChild(document.createTextNode(cell.name || ""));
        tr.appendChild(td);
      }
      grid.appendChild(tr);
    }
    page.replaceChildren(grid);
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
