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
    expect(host.querySelectorAll(".lpl-grid td").length).toBeGreaterThan(0);
    preview.destroy();
    expect(host.querySelector(".lpl-page")).toBeNull();
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
    // clientWidth de l'hôte = 600 (beforeEach) ; on impose 300.
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
      maxPreviewWidth: 300,
    });
    const w = () => parseFloat(host.querySelector(".lpl-page").style.width);
    expect(w()).toBeLessThanOrEqual(300);
    // Re-render : reste stable, ne "gonfle" pas.
    preview.update(undefined, {
      labelMm: 55,
      orient: "L",
      maxPreviewWidth: 300,
    });
    expect(w()).toBeLessThanOrEqual(300);
  });
});
