// Aperçu WYSIWYG : une PAGE A4 COMPLÈTE (portrait ou paysage), dimensionnée en
// mm réels, puis réduite par un simple `transform: scale()` pour tenir dans la
// largeur du conteneur. Aucun zoom CSS approximatif : le même
// `computeLabelLayout` qui nourrit le PDF sert ici, la bascule d'orientation
// est un re-render complet.

import { computeLabelLayout } from "./layout.js";

const PX_PER_MM = 96 / 25.4;

/**
 * @param {Element|string} container hôte de l'aperçu (vidé et repris en main)
 * @param {Array<object>} students
 * @param {object} options cf. computeLabelLayout
 * @returns {{ update(students?:Array<object>, options?:object): void, destroy(): void }}
 */
export function createLabelPreview(container, students, options = {}) {
  const host =
    typeof container === "string"
      ? document.querySelector(container)
      : container;
  if (!host) throw new Error("Conteneur d'aperçu introuvable.");

  host.classList.add("lpl-preview");
  const scaler = document.createElement("div");
  scaler.className = "lpl-preview__scaler";
  const page = document.createElement("div");
  page.className = "lpl-page";
  scaler.appendChild(page);
  host.replaceChildren(scaler);

  let curStudents = students;
  let curOptions = options;

  function draw(nextStudents, nextOptions) {
    curStudents = nextStudents;
    curOptions = nextOptions;

    const layout = computeLabelLayout(nextStudents, nextOptions);
    page.style.width = `${layout.pageWmm}mm`;
    page.style.height = `${layout.pageHmm}mm`;

    const grid = document.createElement("table");
    grid.className = "lpl-grid";
    grid.style.setProperty("--w", `${layout.labelWmm}mm`);
    grid.style.setProperty("--h", `${layout.labelHmm}mm`);
    grid.style.setProperty("--f", `${layout.fontMm}mm`);

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

    // Mise à l'échelle : la page (en px réels) est réduite pour tenir DANS la
    // largeur du conteneur ET, si `maxPreviewHeight` est fourni, dans cette
    // hauteur — on voit toujours la feuille entière, jamais coupée.
    const pageWpx = layout.pageWmm * PX_PER_MM;
    const pageHpx = layout.pageHmm * PX_PER_MM;
    const availW = host.clientWidth || pageWpx;
    const availH = Number(nextOptions?.maxPreviewHeight) || Infinity;
    const scale = Math.min(1, availW / pageWpx, availH / pageHpx);
    scaler.style.transformOrigin = "top left";
    scaler.style.transform = `scale(${scale})`;
    scaler.style.width = `${pageWpx}px`;
    scaler.style.height = `${pageHpx}px`;
    host.style.height = `${pageHpx * scale}px`;
  }

  draw(students, options);

  return {
    update(nextStudents, nextOptions) {
      draw(nextStudents ?? curStudents, nextOptions ?? curOptions);
    },
    destroy() {
      host.replaceChildren();
      host.classList.remove("lpl-preview");
      host.style.height = "";
    },
  };
}
