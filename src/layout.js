// Calcul PUR de la planche d'étiquettes — aucune dépendance au DOM, testable
// directement. Reprend l'arithmétique historique de l'export « Étiquettes » de
// letableaunoir (PdfManager::buildEtiquettesViewData) :
//
//  - une planche = la classe répétée un nombre ENTIER de fois (« groupes »)
//    pour remplir au mieux une page A4 sans jamais couper un groupe ;
//  - étiquettes jointives (bordures 1px = traits de découpe) ;
//  - dernière ligne complétée par des cases vides.
//
// Nouveauté : désambiguïsation des PRÉNOMS identiques par le plus petit
// préfixe de nom de famille qui distingue tout le groupe (« Léa M. » / « Léa
// C. », puis « Léa Ma. » / « Léa Mi. » ; noms identiques jusqu'au bout →
// suffixe numérique).

/** Bornes de largeur d'étiquette (mm) selon l'orientation. Le paysage autorise
 *  des étiquettes plus larges (largeur utile ~283 mm contre ~196 mm). */
export const LABEL_MM_BOUNDS = { P: [30, 120], L: [30, 260] };

// A4 [largeur, hauteur] en mm selon l'orientation.
const PAGE_MM = { P: [210, 297], L: [297, 210] };
const MARGIN_MM = 7; // PDF_MARGIN côté serveur
const HEADER_FOOTER_MM = 42; // réserve en-tête générique + pied `_footer`

const HEIGHT_RATIO = 0.42; // hauteur d'étiquette = largeur * 0.42
const FONT_RATIO = 0.24; // corps de police du prénom = largeur * 0.24
const LEVEL_FONT_RATIO = 0.5; // corps du niveau = moitié de celui du prénom
// Bande NIVEAU : hauteur RÉSERVÉE en haut de l'étiquette, fixe, dérivée
// uniquement de levelFontMm (donc de labelWmm) — jamais du texte d'un élève
// en particulier. Le prénom occupe tout le reste de l'étiquette. C'est ce qui
// garantit un badge de niveau toujours à la même place, quels que soient le
// nom ou la présence/absence de niveau d'un élève donné.
const LEVEL_ROW_RATIO = 1.3;

// Marge horizontale réservée dans l'étiquette (mm, les deux côtés cumulés) :
// filets de découpe + respiration. Le texte dispose de labelWmm - ceci.
const LABEL_PAD_MM = 1;
// Garde-fou absolu (police jamais nulle ou négative). Volontairement TRÈS
// bas : un plancher plus haut laisserait déborder les noms très longs sur les
// petites étiquettes, et un nom qui déborde fait élargir toute la colonne
// dans mPDF — c'est exactement le bug qu'on ferme ici. À 1 mm, une étiquette
// de 28 mm (la plus petite) tient encore une quarantaine de caractères.
const MIN_FONT_MM = 1;

// Largeur de chaque caractère, en multiples de la taille de police (une lettre
// de ratio 0.7 dans un corps de 10 mm occupe 7 mm). Table MESURÉE, prenant
// pour chaque caractère le MAXIMUM entre Arial Bold (police de l'aperçu, via
// canvas.measureText) et DejaVu Sans Condensed Bold (police du PDF, via
// Mpdf::GetStringWidth) : un texte calculé pour tenir tient donc dans les DEUX
// rendus, ce qui garde l'aperçu et le PDF cohérents.
const CHAR_WIDTH_GROUPS = {
  "'": 0.275,
  ijlîï: 0.308,
  " ": 0.313,
  IÎÏ: 0.334,
  ".’": 0.342,
  "-": 0.374,
  f: 0.391,
  "()": 0.411,
  t: 0.43,
  r: 0.444,
  z: 0.523,
  Jcsç: 0.556,
  x: 0.58,
  vyÿ: 0.586,
  k: 0.598,
  aàâä: 0.607,
  eèéêë: 0.61,
  L: 0.611,
  T: 0.614,
  F: 0.615,
  oôö: 0.618,
  "0123456789": 0.626,
  hnuñùûü: 0.641,
  bdgpq: 0.644,
  Z: 0.652,
  EPSYÈÉÊËŸ: 0.667,
  X: 0.694,
  V: 0.696,
  ABCKRÀÂÄÇ: 0.722,
  UÙÛÜ: 0.73,
  D: 0.747,
  HNÑ: 0.753,
  GOQÔÖ: 0.778,
  w: 0.831,
  M: 0.896,
  m: 0.938,
  æ: 0.943,
  œ: 0.984,
  W: 0.993,
  Æ: 1,
  Œ: 1.05,
};

// Caractère hors table (alphabet exotique, symbole) : on prend le plus large
// mesuré, pour ne jamais SOUS-estimer une largeur — sous-estimer ferait
// déborder le nom et, dans mPDF, élargirait toute la colonne.
const CHAR_WIDTH_FALLBACK = 1.05;

const CHAR_WIDTH = (() => {
  const m = new Map();
  for (const [chars, w] of Object.entries(CHAR_WIDTH_GROUPS)) {
    for (const c of chars) m.set(c, w);
  }
  return m;
})();

/**
 * Largeur d'un texte en multiples de la taille de police (sans unité) : la
 * largeur en mm vaut `textWidthRatio(t) * fontMm`.
 * @param {string} text
 * @returns {number}
 */
function textWidthRatio(text) {
  let w = 0;
  for (const c of String(text)) {
    w += CHAR_WIDTH.get(c) ?? CHAR_WIDTH_FALLBACK;
  }
  return w;
}

/**
 * Corps de police d'UNE étiquette : la taille nominale, réduite UNIQUEMENT si
 * ce nom-là déborde de la largeur imposée. Les noms courts gardent donc la
 * taille nominale — seuls les longs rapetissent — et aucune étiquette n'a
 * besoin d'être élargie ni le nom coupé (mPDF élargirait sinon toute la
 * colonne au mot le plus long, cf. Mpdf::_tableColumnWidth).
 * @param {string} text
 * @param {number} labelWmm largeur de l'étiquette (mm)
 * @param {number} nominalMm corps de police nominal (mm)
 * @returns {number} corps de police à utiliser pour ce texte (mm)
 */
export function fitFontMm(text, labelWmm, nominalMm) {
  const ratio = textWidthRatio(text);
  const avail = labelWmm - LABEL_PAD_MM;
  if (ratio <= 0 || avail <= 0) return nominalMm;
  if (ratio * nominalMm <= avail) return nominalMm; // tient déjà
  // Arrondi PAR DÉFAUT au dixième : arrondir au-dessus ferait déborder.
  return Math.max(MIN_FONT_MM, Math.floor((avail / ratio) * 10) / 10);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function stripDiacritics(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normKey(s) {
  return stripDiacritics(s).toLocaleLowerCase("fr").trim();
}

function capFirst(s) {
  const v = String(s).trim();
  if (!v) return v;
  return v[0].toLocaleUpperCase("fr") + v.slice(1);
}

function firstOf(student) {
  return String(student.firstname ?? "").trim();
}

function lastOf(student) {
  return String(student.lastname ?? "").trim();
}

/**
 * Libellé par élève quand on n'affiche QUE le prénom : les prénoms uniques
 * restent nus, les collisions sont levées par un préfixe de nom de famille.
 * @param {Array<{firstname?:string,lastname?:string}>} students
 * @returns {string[]} un libellé par élève, dans l'ordre d'entrée
 */
export function disambiguateFirstNames(students) {
  const groups = new Map(); // normKey(prénom) -> [index, ...]
  students.forEach((s, i) => {
    const k = normKey(firstOf(s));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });

  const out = new Array(students.length);

  for (const idxs of groups.values()) {
    if (idxs.length === 1) {
      out[idxs[0]] = firstOf(students[idxs[0]]);
      continue;
    }

    const lastNames = idxs.map((i) => lastOf(students[i]));
    const maxLen = Math.max(0, ...lastNames.map((n) => n.length));

    let resolved = null;
    for (let k = 1; k <= maxLen; k++) {
      const cand = idxs.map((i, j) => {
        const prefix = lastNames[j].slice(0, k);
        return prefix
          ? `${firstOf(students[i])} ${capFirst(prefix)}.`
          : firstOf(students[i]);
      });
      if (new Set(cand.map(normKey)).size === cand.length) {
        resolved = cand;
        break;
      }
    }

    if (!resolved) {
      // Noms de famille identiques (ou absents) : rien ne les distingue.
      resolved = idxs.map((i, j) => `${firstOf(students[i])} (${j + 1})`);
    }

    idxs.forEach((i, j) => {
      out[i] = resolved[j];
    });
  }

  return out;
}

/**
 * Texte affiché sur chaque étiquette selon le mode.
 * @param {Array<object>} students
 * @param {"first"|"last"|"both"} fields
 * @returns {string[]}
 */
export function resolveLabelText(students, fields) {
  if (fields === "last") {
    return students.map((s) => lastOf(s) || firstOf(s));
  }
  if (fields === "both") {
    return students.map((s) => `${firstOf(s)} ${lastOf(s)}`.trim());
  }
  return disambiguateFirstNames(students); // "first"
}

/**
 * @param {Array<{firstname?:string,lastname?:string,level?:string}>} students
 * @param {{orient?:"P"|"L",labelMm?:number,fields?:"first"|"last"|"both",showLevel?:boolean}} [options]
 * @returns {{orient:string,cols:number,groupes:number,rowsPerPage:number,
 *   labelWmm:number,labelHmm:number,fontMm:number,levelFontMm:number,
 *   levelRowMm:number,pageWmm:number,pageHmm:number,
 *   rows:Array<{cells:Array<{name:string,level:string,empty:boolean,
 *     fontMm:number}>}>}}
 */
export function computeLabelLayout(students, options = {}) {
  const list = (Array.isArray(students) ? students : []).filter(
    (s) => s && (firstOf(s) || lastOf(s)),
  );
  if (!list.length) {
    throw new Error("Aucun élève.");
  }

  const orient = options.orient === "L" ? "L" : "P";
  const fields = ["first", "last", "both"].includes(options.fields)
    ? options.fields
    : "first";
  const showLevel = !!options.showLevel;

  const [minMm, maxMm] = LABEL_MM_BOUNDS[orient];
  const [pageWmm, pageHmm] = PAGE_MM[orient];
  const usableW = pageWmm - 2 * MARGIN_MM;
  const usableH = pageHmm - 2 * MARGIN_MM - HEADER_FOOTER_MM;

  // Le curseur donne une largeur CIBLE ; on prend le nombre entier de colonnes
  // le plus proche et on étire l'étiquette pour PAVER la largeur utile de l'A4
  // (bord à bord, pas de marge latérale résiduelle — comme une vraie planche
  // d'étiquettes).
  const targetWmm = Math.max(
    minMm,
    Math.min(maxMm, Math.round(Number(options.labelMm) || 55)),
  );
  const cols = Math.max(1, Math.round(usableW / targetWmm));
  const labelWmm = round1(usableW / cols);
  const labelHmm = round1(labelWmm * HEIGHT_RATIO);
  // « Les deux » = prénom + nom sur l'étiquette : deux mots, il faut une police
  // plus petite pour qu'ils tiennent (aperçu ET PDF, cf. wire lvl_font_mm).
  const fontMm = round1(labelWmm * FONT_RATIO * (fields === "both" ? 0.6 : 1));
  const levelFontMm = round1(labelWmm * FONT_RATIO * LEVEL_FONT_RATIO);
  const levelRowMm = round1(levelFontMm * LEVEL_ROW_RATIO);

  const rowsParPage = Math.max(1, Math.floor(usableH / labelHmm));
  const parPage = cols * rowsParPage;

  // Nombre ENTIER de jeux complets de la classe qui tiennent sur une page (au
  // moins 1 ; une grande classe -> 1 seul groupe qui débordera en page 2).
  const groupes = Math.max(1, Math.floor(parPage / list.length));

  const text = resolveLabelText(list, fields);
  const unit = list.map((s, i) => ({
    name: text[i],
    level: showLevel ? String(s.level ?? "").trim() : "",
    empty: false,
    // Police PROPRE à cette étiquette : nominale par défaut, réduite pour le
    // seul nom qui déborderait. Les colonnes gardent ainsi toutes la même
    // largeur (labelWmm) et aucun nom n'est coupé.
    fontMm: fitFontMm(text[i], labelWmm, fontMm),
  }));

  const suite = [];
  for (let g = 0; g < groupes; g++) {
    for (const cell of unit) suite.push({ ...cell });
  }

  const rows = [];
  for (let i = 0; i < suite.length; i += cols) {
    const cells = suite.slice(i, i + cols);
    while (cells.length < cols) {
      cells.push({ name: "", level: "", empty: true, fontMm });
    }
    rows.push({ cells });
  }

  return {
    orient,
    cols,
    groupes,
    rowsPerPage: rowsParPage,
    labelWmm,
    labelHmm,
    fontMm,
    levelFontMm,
    levelRowMm,
    pageWmm,
    pageHmm,
    rows,
  };
}
