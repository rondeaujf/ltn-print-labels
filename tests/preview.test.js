import { describe, it, expect, beforeEach } from "vitest";
import { createLabelPreview } from "../src/index.js";

const S = (firstname, lastname, level) => ({ firstname, lastname, level });

// Rapport hauteur/largeur d'une <div class="lpl-page"> (dimensions en px).
function ratio(host) {
  const p = host.querySelector(".lpl-page");
  return parseFloat(p.style.height) / parseFloat(p.style.width);
}

describe("createLabelPreview", () => {
  let host;

  beforeEach(() => {
    host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", {
      value: 600,
      configurable: true,
    });
    document.body.appendChild(host);
  });

  it("rend une page réduite en px (pas de transform) tenant dans la largeur", () => {
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
    });
    const page = host.querySelector(".lpl-page");
    expect(page).not.toBeNull();
    expect(page.style.transform).toBe("");
    expect(page.style.width.endsWith("px")).toBe(true);
    expect(parseFloat(page.style.width)).toBeLessThanOrEqual(600);
    // A4 portrait : hauteur / largeur ≈ 297 / 210.
    expect(ratio(host)).toBeCloseTo(297 / 210, 1);
    expect(host.querySelectorAll(".lpl-grid .lpl-cell").length).toBeGreaterThan(
      0,
    );
    preview.destroy();
    expect(host.querySelector(".lpl-page")).toBeNull();
  });

  it("grille = CSS grid, largeur pilotée par grid-template-columns", () => {
    createLabelPreview(host, [S("Léa", "Martin"), S("Tom", "Petit")], {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 600,
    });
    const grid = host.querySelector(".lpl-grid");
    expect(grid.tagName).toBe("DIV");
    expect(grid.style.display).toBe("grid");
    // colonnes à pas FIXE en px littéraux (pas de var(--w) qui pourrait ne pas
    // se résoudre chez le consommateur)
    expect(grid.style.gridTemplateColumns).toMatch(/^repeat\(\d+, \d+px\)$/);
    expect(grid.style.gridAutoRows).toMatch(/^\d+px$/);
  });

  it("bascule portrait -> paysage par re-render", () => {
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
    });
    expect(ratio(host)).toBeCloseTo(297 / 210, 1);
    preview.update(undefined, { labelMm: 55, orient: "L" });
    expect(ratio(host)).toBeCloseTo(210 / 297, 1);
  });

  it("survit à une SÉQUENCE de update() sans exploser", () => {
    const roster = Array.from({ length: 26 }, (_, i) =>
      S(["Léa", "Tom", "Noé"][i % 3], `Nom-de-famille-${i}`, "CE1"),
    );
    const d = { maxPreviewWidth: 600, maxPreviewHeight: 400 };
    const p = createLabelPreview(host, roster, {
      orient: "P",
      fields: "first",
      labelMm: 55,
      showLevel: true,
      ...d,
    });
    const seq = [
      { orient: "P", fields: "first", labelMm: 90, showLevel: true },
      { orient: "L", fields: "both", labelMm: 90, showLevel: true },
      { orient: "L", fields: "both", labelMm: 200, showLevel: true },
      { orient: "P", fields: "last", labelMm: 40, showLevel: false },
    ];
    for (const o of seq) p.update(roster, { ...o, ...d });

    const page = host.querySelector(".lpl-page");
    const grid = host.querySelector(".lpl-grid");
    expect(grid).not.toBeNull();
    expect(host.querySelectorAll(".lpl-grid .lpl-cell").length).toBeGreaterThan(
      0,
    );
    expect(parseFloat(page.style.width)).toBeLessThanOrEqual(600);
    expect(parseFloat(page.style.height)).toBeLessThanOrEqual(400);
  });

  it("affiche le niveau quand showLevel est vrai, aligné à GAUCHE", () => {
    createLabelPreview(host, [S("Léa", "Martin", "CE1")], {
      labelMm: 55,
      showLevel: true,
    });
    const lvl = host.querySelector(".lpl-cell__lvl");
    expect(lvl?.textContent).toBe("CE1");
    // Le niveau est à gauche, le prénom reste centré (miroir du PDF : table
    // imbriquée mPDF dont le td niveau porte text-align:left).
    expect(lvl.style.textAlign).toBe("left");
    expect(host.querySelector(".lpl-cell__name").style.textAlign).toBe(
      "center",
    );
  });

  it("maxPreviewHeight réduit la feuille pour la garder entière", () => {
    createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
      maxPreviewHeight: 400,
    });
    expect(
      parseFloat(host.querySelector(".lpl-page").style.height),
    ).toBeLessThanOrEqual(400);
  });

  it("maxPreviewWidth pilote la largeur sans dépendre du conteneur", () => {
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 300,
    });
    const w = () => parseFloat(host.querySelector(".lpl-page").style.width);
    expect(w()).toBeLessThanOrEqual(300);
    preview.update(undefined, {
      labelMm: 55,
      orient: "L",
      maxPreviewWidth: 300,
    });
    expect(w()).toBeLessThanOrEqual(300);
  });

  it("ne rend qu'une page : au plus rowsPerPage × cols cases", () => {
    const roster = Array.from({ length: 60 }, (_, i) => S(`E${i}`, `N${i}`));
    createLabelPreview(host, roster, {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 600,
      maxPreviewHeight: 700,
    });
    const cells = host.querySelectorAll(".lpl-grid .lpl-cell").length;
    expect(cells).toBeGreaterThan(0);
    expect(cells).toBeLessThanOrEqual(5 * 12); // <= cols × rowsPerPage d'une page
  });

  // Géométrie lue depuis les styles en ligne : la grille (colonnes + filet de
  // fermeture droit) doit tenir dans la boîte intérieure de la page, sinon
  // `overflow:hidden` rogne le filet droit (bordures « qui disparaissent »).
  function fits(host) {
    const page = host.querySelector(".lpl-page");
    const grid = host.querySelector(".lpl-grid");
    const cell = host.querySelector(".lpl-cell");
    const innerW =
      parseFloat(page.style.width) - 2 * parseFloat(page.style.padding);
    const cols = Number(
      grid.style.gridTemplateColumns.match(/^repeat\((\d+)/)[1],
    );
    const gridW = cols * parseFloat(cell.style.width) + 1; // +1 : border-right
    return { innerW, gridW, cols };
  }

  it("la grille ne déborde JAMAIS de la page, quel que soit l'arrondi", () => {
    const roster = Array.from({ length: 24 }, (_, i) => S(`E${i}`, `N${i}`));
    const p = createLabelPreview(host, roster, {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 397,
    });
    // Balayage de tailles/largeurs : chaque combinaison d'arrondis doit tenir.
    for (const orient of ["P", "L"]) {
      for (const labelMm of [30, 40, 55, 70, 90, 120]) {
        for (const maxPreviewWidth of [280, 397, 476, 555, 600]) {
          p.update(roster, { orient, labelMm, maxPreviewWidth });
          const { innerW, gridW } = fits(host);
          expect(
            gridW,
            `orient=${orient} labelMm=${labelMm} w=${maxPreviewWidth}`,
          ).toBeLessThanOrEqual(innerW);
        }
      }
    }
  });

  it("grille tenant aussi en HAUTEUR (en-tête + marge + filet de fermeture)", () => {
    const roster = Array.from({ length: 60 }, (_, i) => S(`E${i}`, `N${i}`));
    createLabelPreview(host, roster, {
      labelMm: 30,
      orient: "P",
      maxPreviewWidth: 397,
    });
    const page = host.querySelector(".lpl-page");
    const head = host.querySelector(".lpl-page__head");
    const cell = host.querySelector(".lpl-cell");
    const cells = host.querySelectorAll(".lpl-grid .lpl-cell").length;
    const { cols } = fits(host);
    const rows = cells / cols;
    const innerH =
      parseFloat(page.style.height) - 2 * parseFloat(page.style.padding);
    const used =
      parseFloat(head.style.height) +
      1 +
      4 +
      rows * parseFloat(cell.style.height) +
      1;
    expect(used).toBeLessThanOrEqual(innerH);
  });

  it("centrage de la grille par marge ENTIÈRE (pas de margin:auto demi-pixel)", () => {
    createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 600,
    });
    const grid = host.querySelector(".lpl-grid");
    expect(grid.style.marginLeft).toMatch(/^\d+px$/);
    expect(grid.style.marginRight).not.toBe("auto");
  });

  it("styles de mise en page posés EN LIGNE (indépendant de style.css)", () => {
    createLabelPreview(host, [S("Léa", "Martin", "CE1")], {
      labelMm: 55,
      showLevel: true,
      maxPreviewWidth: 600,
    });
    expect(host.querySelector(".lpl-page__head").style.height).toMatch(/px$/);
    const cell = host.querySelector(".lpl-grid .lpl-cell");
    expect(cell.style.width).toMatch(/^\d+px$/);
    expect(cell.style.height).toMatch(/^\d+px$/);
    expect(cell.style.borderTop).toContain("1px");
    expect(host.querySelector(".lpl-cell__name").style.textAlign).toBe(
      "center",
    );
    expect(host.querySelector(".lpl-cell__lvl").style.color).toBeTruthy();
  });
});
