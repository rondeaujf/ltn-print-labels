import { describe, it, expect, beforeEach } from "vitest";
import { createLabelPreview } from "../src/index.js";

const S = (firstname, lastname, level) => ({ firstname, lastname, level });

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

  it("rend une page A4 dimensionnée en mm et une grille", () => {
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
    });
    const page = host.querySelector(".lpl-page");
    expect(page).not.toBeNull();
    expect(page.style.width).toBe("210mm");
    expect(page.style.height).toBe("297mm");
    expect(host.querySelectorAll(".lpl-grid td").length).toBeGreaterThan(0);
    preview.destroy();
    expect(host.querySelector(".lpl-page")).toBeNull();
  });

  it("bascule portrait -> paysage par re-render", () => {
    const preview = createLabelPreview(host, [S("Léa", "Martin")], {
      labelMm: 55,
      orient: "P",
    });
    preview.update(undefined, { labelMm: 55, orient: "L" });
    expect(host.querySelector(".lpl-page").style.width).toBe("297mm");
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
    // Portrait A4 ~1123 px de haut -> hôte ramené à <= 400 px.
    expect(parseFloat(host.style.height)).toBeLessThanOrEqual(400);
    expect(parseFloat(host.style.height)).toBeGreaterThan(0);
  });
});
