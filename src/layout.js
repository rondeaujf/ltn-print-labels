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
const FONT_RATIO = 0.24; // corps de police = largeur * 0.24

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
 * @returns {{orient:string,cols:number,groupes:number,labelWmm:number,labelHmm:number,
 *   fontMm:number,pageWmm:number,pageHmm:number,rows:Array<{cells:Array<{name:string,level:string,empty:boolean}>}>}}
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
  const labelWmm = Math.max(
    minMm,
    Math.min(maxMm, Math.round(Number(options.labelMm) || 55)),
  );
  const labelHmm = round1(labelWmm * HEIGHT_RATIO);
  const fontMm = round1(labelWmm * FONT_RATIO);

  const [pageWmm, pageHmm] = PAGE_MM[orient];
  const usableW = pageWmm - 2 * MARGIN_MM;
  const usableH = pageHmm - 2 * MARGIN_MM - HEADER_FOOTER_MM;

  const cols = Math.max(1, Math.floor(usableW / labelWmm));
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
  }));

  const suite = [];
  for (let g = 0; g < groupes; g++) {
    for (const cell of unit) suite.push({ ...cell });
  }

  const rows = [];
  for (let i = 0; i < suite.length; i += cols) {
    const cells = suite.slice(i, i + cols);
    while (cells.length < cols) {
      cells.push({ name: "", level: "", empty: true });
    }
    rows.push({ cells });
  }

  return {
    orient,
    cols,
    groupes,
    labelWmm,
    labelHmm,
    fontMm,
    pageWmm,
    pageHmm,
    rows,
  };
}
