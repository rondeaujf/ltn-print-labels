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
    expect(grid.style.gridTemplateColumns).toMatch(
      /^repeat\(\d+, var\(--w\)\)$/,
    );
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

  it("affiche le niveau quand showLevel est vrai", () => {
    createLabelPreview(host, [S("Léa", "Martin", "CE1")], {
      labelMm: 55,
      showLevel: true,
    });
    expect(host.querySelector(".lpl-cell__lvl")?.textContent).toBe("CE1");
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

  it("en-tête figuré + variables de taille en px", () => {
    createLabelPreview(host, [S("Léa", "Martin", "CE1")], {
      labelMm: 55,
      showLevel: true,
      maxPreviewWidth: 600,
    });
    expect(host.querySelector(".lpl-page__head")).not.toBeNull();
    const grid = host.querySelector(".lpl-grid");
    for (const v of ["--w", "--h", "--f", "--lf"]) {
      expect(grid.style.getPropertyValue(v)).toMatch(/px$/);
    }
  });
});
