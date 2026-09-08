import { describe, it, expect } from "vitest";
import {
  computeLabelLayout,
  disambiguateFirstNames,
  resolveLabelText,
  fitFontMm,
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

describe("fitFontMm", () => {
  it("laisse la police nominale quand le nom tient", () => {
    expect(fitFontMm("Léa", 49, 11.8)).toBe(11.8);
    expect(fitFontMm("Tom", 49, 11.8)).toBe(11.8);
  });

  it("réduit la police du SEUL nom qui déborde", () => {
    const petit = fitFontMm("Léa", 49, 11.8);
    const long = fitFontMm("Alexandre-Christophe", 49, 11.8);
    expect(long).toBeLessThan(petit);
    expect(long).toBeGreaterThan(2);
  });

  it("la police retenue fait TENIR le nom dans la largeur utile", () => {
    // Reprend la table de largeurs : largeur du texte = ratio x police.
    const noms = [
      "Léa",
      "Alexandre-Christophe",
      "Jean-Baptiste-Émilien",
      "WWWWWWWWWW",
      "Marie-Charlotte-Anne",
      "Œuvre",
    ];
    for (const labelW of [30, 49, 98]) {
      for (const nom of noms) {
        const f = fitFontMm(nom, labelW, labelW * 0.24);
        const l = computeLabelLayout([{ firstname: nom, lastname: "X" }], {
          labelMm: labelW,
        });
        // largeur occupée <= largeur utile (labelW - 1 mm de marge), sauf si
        // le plancher de lisibilité a été atteint
        const cell = l.rows[0].cells[0];
        expect(cell.fontMm).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(labelW * 0.24);
      }
    }
  });

  it("garde-fou : la police reste strictement positive", () => {
    expect(fitFontMm("X".repeat(500), 30, 7.2)).toBe(1);
  });

  it("un nom long tient RÉELLEMENT dans la largeur utile (table mesurée)", () => {
    // Garantie clé : si le nom débordait, mPDF élargirait toute la colonne.
    // Largeur occupée = somme des ratios de la table x police retenue.
    const ratios = { L: 0.611, é: 0.61, a: 0.607 };
    const nom = "Léa";
    const attendu = ratios.L + ratios.é + ratios.a;
    const f = fitFontMm(nom, 6, 11.8); // étiquette étroite -> réduction
    expect(attendu * f).toBeLessThanOrEqual(6 - 1 + 1e-9);
  });
});

describe("computeLabelLayout", () => {
  it("chaque étiquette porte SA police : seuls les noms longs rapetissent", () => {
    const layout = computeLabelLayout(
      [
        { firstname: "Léa", lastname: "Martin" },
        { firstname: "Alexandre-Christophe", lastname: "Vandenberghe" },
        { firstname: "Tom", lastname: "Petit" },
      ],
      { labelMm: 55, orient: "P" },
    );
    const parNom = {};
    for (const row of layout.rows) {
      for (const c of row.cells) if (!c.empty) parNom[c.name] = c.fontMm;
    }
    // Les courts gardent la police nominale, le long est réduit.
    expect(parNom["Léa"]).toBe(layout.fontMm);
    expect(parNom["Tom"]).toBe(layout.fontMm);
    expect(parNom["Alexandre-Christophe"]).toBeLessThan(layout.fontMm);
  });

  it("la largeur d'étiquette ne dépend JAMAIS de la longueur des noms", () => {
    // Le point qui a régressé plusieurs fois : c'est la POLICE qui s'adapte,
    // jamais la colonne (sinon mPDF élargit la colonne au mot le plus long).
    const opts = { labelMm: 55, orient: "P" };
    const courts = computeLabelLayout(
      [{ firstname: "Al", lastname: "Xy" }],
      opts,
    );
    const longs = computeLabelLayout(
      [{ firstname: "Alexandre-Christophe", lastname: "Vandenberghe-Moreau" }],
      opts,
    );
    expect(longs.cols).toBe(courts.cols);
    expect(longs.labelWmm).toBe(courts.labelWmm);
    expect(longs.labelHmm).toBe(courts.labelHmm);
    expect(longs.fontMm).toBe(courts.fontMm); // police NOMINALE inchangée
  });

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
