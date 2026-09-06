import { describe, it, expect } from "vitest";
import {
  computeLabelLayout,
  disambiguateFirstNames,
  resolveLabelText,
  LABEL_MM_BOUNDS,
} from "../src/index.js";

const S = (firstname, lastname, level) => ({ firstname, lastname, level });

function countNonEmpty(layout) {
  let n = 0;
  for (const row of layout.rows) {
    for (const cell of row.cells) if (!cell.empty) n++;
  }
  return n;
}

describe("disambiguateFirstNames", () => {
  it("laisse les prénoms uniques intacts", () => {
    expect(
      disambiguateFirstNames([S("Léa", "Martin"), S("Tom", "Petit")]),
    ).toEqual(["Léa", "Tom"]);
  });

  it("lève la collision avec la 1re lettre du nom + point", () => {
    expect(
      disambiguateFirstNames([S("Léa", "Martin"), S("Léa", "Claude")]),
    ).toEqual(["Léa M.", "Léa C."]);
  });

  it("étend le préfixe tant que ce n'est pas discriminant", () => {
    expect(
      disambiguateFirstNames([S("Léa", "Martin"), S("Léa", "Michel")]),
    ).toEqual(["Léa Ma.", "Léa Mi."]);
  });

  it("bascule sur un suffixe numérique si les noms sont identiques", () => {
    expect(
      disambiguateFirstNames([S("Léa", "Dupont"), S("Léa", "Dupont")]),
    ).toEqual(["Léa (1)", "Léa (2)"]);
  });

  it("regroupe les prénoms à la casse et aux accents près", () => {
    expect(
      disambiguateFirstNames([S("Léa", "Martin"), S("lea", "Claude")]),
    ).toEqual(["Léa M.", "lea C."]);
  });

  it("gère 3 collisions dont deux noms proches", () => {
    expect(
      disambiguateFirstNames([
        S("Noé", "Bernard"),
        S("Noé", "Blanc"),
        S("Noé", "Durand"),
      ]),
    ).toEqual(["Noé Be.", "Noé Bl.", "Noé Du."]);
  });
});

describe("resolveLabelText", () => {
  it("mode « nom » n'applique aucune désambiguïsation", () => {
    expect(
      resolveLabelText([S("Léa", "Martin"), S("Léa", "Claude")], "last"),
    ).toEqual(["Martin", "Claude"]);
  });

  it("mode « les deux » affiche prénom + nom complet", () => {
    expect(
      resolveLabelText([S("Léa", "Martin"), S("Léa", "Claude")], "both"),
    ).toEqual(["Léa Martin", "Léa Claude"]);
  });
});

describe("computeLabelLayout", () => {
  it("répète la classe en groupes entiers pour remplir la page", () => {
    const layout = computeLabelLayout(
      [S("Bob", "Abel"), S("Chloé", "Meyer"), S("Alice", "Zorro")],
      { labelMm: 55, orient: "P" },
    );
    expect(layout.cols).toBe(3);
    expect(layout.labelWmm).toBe(55);
    expect(layout.labelHmm).toBeCloseTo(23.1, 5);
    expect(layout.levelFontMm).toBeCloseTo(layout.fontMm / 2, 1);
    expect(layout.groupes).toBeGreaterThan(1);
    expect(countNonEmpty(layout)).toBe(3 * layout.groupes);
    // ordre d'entrée préservé (le tri par nom est fait en amont par l'app)
    expect(layout.rows[0].cells.map((c) => c.name)).toEqual([
      "Bob",
      "Chloé",
      "Alice",
    ]);
  });

  it("complète la dernière ligne par des cases vides", () => {
    const students = ["A", "B", "C", "D", "E", "F", "G"].map((p) => S(p, "X"));
    const layout = computeLabelLayout(students, { labelMm: 55 });
    expect(countNonEmpty(layout)).toBe(7 * layout.groupes);
    const last = layout.rows[layout.rows.length - 1].cells;
    expect(last[0].empty).toBe(false);
    expect(last[last.length - 1].empty).toBe(true);
  });

  it("grande classe : un seul groupe", () => {
    const students = Array.from({ length: 40 }, (_, i) =>
      S(`E${i + 1}`, `Nom${String(i + 1).padStart(2, "0")}`),
    );
    const layout = computeLabelLayout(students, { labelMm: 55 });
    expect(layout.groupes).toBe(1);
    expect(countNonEmpty(layout)).toBe(40);
  });

  it("expose rowsPerPage (borne d'aperçu = 1 page)", () => {
    const students = Array.from({ length: 40 }, (_, i) => S(`E${i}`, `N${i}`));
    const layout = computeLabelLayout(students, { labelMm: 55, orient: "P" });
    expect(layout.rowsPerPage).toBeGreaterThan(0);
    // une grande classe déborde : plus de lignes que ce qui tient sur une page
    expect(layout.rows.length).toBeGreaterThan(layout.rowsPerPage);
  });

  it("« les deux » réduit la police du prénom (pas celle du niveau)", () => {
    const s = [S("Léa", "Martin")];
    const first = computeLabelLayout(s, { labelMm: 55, fields: "first" });
    const both = computeLabelLayout(s, { labelMm: 55, fields: "both" });
    expect(both.fontMm).toBeLessThan(first.fontMm);
    expect(both.levelFontMm).toBeCloseTo(first.levelFontMm, 5);
  });

  it("le paysage élargit la grille", () => {
    const students = [S("Alice", "Abel")];
    expect(
      computeLabelLayout(students, { labelMm: 55, orient: "P" }).cols,
    ).toBe(3);
    expect(
      computeLabelLayout(students, { labelMm: 55, orient: "L" }).cols,
    ).toBe(5);
  });

  it("borne la largeur selon l'orientation", () => {
    const s = [S("Alice", "Abel")];
    expect(computeLabelLayout(s, { labelMm: 5, orient: "P" }).labelWmm).toBe(
      30,
    );
    expect(computeLabelLayout(s, { labelMm: 999, orient: "P" }).labelWmm).toBe(
      120,
    );
    expect(computeLabelLayout(s, { labelMm: 999, orient: "L" }).labelWmm).toBe(
      260,
    );
    expect(computeLabelLayout(s, { labelMm: 180, orient: "P" }).labelWmm).toBe(
      120,
    );
    expect(computeLabelLayout(s, { labelMm: 180, orient: "L" }).labelWmm).toBe(
      180,
    );
    expect(LABEL_MM_BOUNDS).toEqual({ P: [30, 120], L: [30, 260] });
  });

  it("ne propage le niveau que si showLevel est vrai", () => {
    const students = [S("Léa", "Martin", "CE1"), S("Tom", "Petit", "CE2")];
    const withLevel = computeLabelLayout(students, {
      labelMm: 55,
      showLevel: true,
    });
    expect(withLevel.rows[0].cells[0].level).toBe("CE1");
    const without = computeLabelLayout(students, { labelMm: 55 });
    expect(without.rows[0].cells[0].level).toBe("");
  });

  it("lève une erreur sans élève", () => {
    expect(() => computeLabelLayout([], { labelMm: 55 })).toThrow();
    expect(() => computeLabelLayout([{ firstname: "  " }], {})).toThrow();
  });
});
