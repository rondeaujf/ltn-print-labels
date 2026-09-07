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
    // Curseur 55 mm en portrait -> 4 colonnes qui pavent les 196 mm utiles.
    expect(layout.cols).toBe(4);
    expect(layout.cols * layout.labelWmm).toBeCloseTo(196, 0);
    expect(layout.labelHmm).toBeCloseTo(layout.labelWmm * 0.42, 1);
    expect(layout.levelFontMm).toBeCloseTo(layout.fontMm / 2, 1);
    expect(layout.groupes).toBeGreaterThan(1);
    expect(countNonEmpty(layout)).toBe(3 * layout.groupes);
    // ordre d'entrée préservé (le tri par nom est fait en amont par l'app)
    expect(layout.rows[0].cells.slice(0, 3).map((c) => c.name)).toEqual([
      "Bob",
      "Chloé",
      "Alice",
    ]);
  });

  it("les colonnes pavent la largeur utile de l'A4 (bord à bord)", () => {
    for (const orient of ["P", "L"]) {
      const usable = (orient === "L" ? 297 : 210) - 14;
      for (const labelMm of [30, 45, 60, 90, 120]) {
        const l = computeLabelLayout([S("A", "B")], { orient, labelMm });
        expect(l.cols * l.labelWmm).toBeCloseTo(usable, 0);
      }
    }
  });

  it("la géométrie (largeurs, polices, bande de niveau) ne dépend JAMAIS du contenu", () => {
    // Régression : la largeur de colonne (et tout ce qui en dérive) doit
    // rester identique quel que soit le nom le plus long de la classe — y
    // compris la bande réservée au badge de niveau, qui doit se tenir à la
    // même place sur toute la planche.
    const opts = { labelMm: 55, orient: "P", fields: "both", showLevel: true };
    const short = computeLabelLayout([S("Al", "Xy", "CE1")], opts);
    const long = computeLabelLayout(
      [S("Alexandre-Christophe", "Vandenberghe-Moreau", "CE1")],
      opts,
    );
    expect(long.cols).toBe(short.cols);
    expect(long.labelWmm).toBe(short.labelWmm);
    expect(long.labelHmm).toBe(short.labelHmm);
    expect(long.fontMm).toBe(short.fontMm);
    expect(long.levelFontMm).toBe(short.levelFontMm);
    expect(long.levelRowMm).toBe(short.levelRowMm);
  });

  it("levelRowMm est une bande fixe dérivée de levelFontMm, jamais nulle", () => {
    const layout = computeLabelLayout([S("A", "B")], {
      labelMm: 55,
      showLevel: true,
    });
    expect(layout.levelRowMm).toBeGreaterThan(layout.levelFontMm);
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
    const students = Array.from({ length: 80 }, (_, i) => S(`E${i}`, `N${i}`));
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

  it("le paysage tient plus de colonnes que le portrait", () => {
    const s = [S("Alice", "Abel")];
    const p = computeLabelLayout(s, { labelMm: 55, orient: "P" });
    const l = computeLabelLayout(s, { labelMm: 55, orient: "L" });
    expect(l.cols).toBeGreaterThan(p.cols);
  });

  it("le curseur pilote la taille : plus grand -> moins de colonnes, étiquette plus large", () => {
    const s = [S("Alice", "Abel")];
    const petit = computeLabelLayout(s, { labelMm: 35, orient: "P" });
    const grand = computeLabelLayout(s, { labelMm: 110, orient: "P" });
    expect(grand.cols).toBeLessThan(petit.cols);
    expect(grand.labelWmm).toBeGreaterThan(petit.labelWmm);
    // curseur borné : au plancher on garde plusieurs colonnes, au plafond 1 ou 2
    expect(
      computeLabelLayout(s, { labelMm: 5, orient: "P" }).cols,
    ).toBeGreaterThan(4);
    expect(
      computeLabelLayout(s, { labelMm: 999, orient: "P" }).cols,
    ).toBeLessThanOrEqual(2);
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
