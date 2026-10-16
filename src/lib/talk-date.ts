// Date d'un talk — stockée en format triable et à précision variable :
//   "2026"        → année seule
//   "2026-11"     → mois + année
//   "2026-11-19"  → jour + mois + année (date EXACTE)
// L'année est toujours obligatoire. La précision « exacte » (jour présent)
// sert à décider si un talk peut figurer dans l'agenda / les actualités.

export const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const ISO_RE = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

export type TalkDateParts = { annee: string; mois: string; jour: string };

export type BuildDateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Construit la date triable à partir des champs du formulaire (chaînes).
 * Année obligatoire ; un jour sans mois est refusé.
 */
export function buildTalkDate(
  annee: string,
  mois: string,
  jour: string,
): BuildDateResult {
  const a = annee.trim();
  const m = mois.trim();
  const j = jour.trim();

  if (a === "") return { ok: false, error: "L'année est obligatoire" };
  if (!/^\d{4}$/.test(a) || Number(a) < 1900 || Number(a) > 2100) {
    return { ok: false, error: "Année invalide (ex. 2026)" };
  }
  if (j !== "" && m === "") {
    return { ok: false, error: "Choisis aussi le mois (ou enlève le jour)" };
  }
  if (m !== "" && (Number(m) < 1 || Number(m) > 12)) {
    return { ok: false, error: "Mois invalide" };
  }
  if (j !== "" && (Number(j) < 1 || Number(j) > 31)) {
    return { ok: false, error: "Jour invalide" };
  }

  const pad = (v: string) => v.padStart(2, "0");
  let value = a;
  if (m !== "") value += `-${pad(m)}`;
  if (j !== "") value += `-${pad(j)}`;
  return { ok: true, value };
}

/** Découpe une date stockée en parties (pour préremplir le formulaire). */
export function parseTalkDateParts(value: string | null): TalkDateParts {
  const empty = { annee: "", mois: "", jour: "" };
  if (!value) return empty;
  const m = value.match(ISO_RE);
  if (!m) return empty;
  return {
    annee: m[1],
    mois: m[2] ? String(Number(m[2])) : "",
    jour: m[3] ? String(Number(m[3])) : "",
  };
}

/**
 * Convertit un `startsAt` ISO (« 2026-11-19T10:00:00 ») en date de talk
 * validée (année/mois/jour dans les bornes), ou null si absent/invalide.
 * Passe par buildTalkDate pour rejeter les valeurs aberrantes (0000-13-45…).
 */
export function isoToTalkDate(startsAt: string | null | undefined): string | null {
  const m = startsAt?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const built = buildTalkDate(m[1], m[2], m[3]);
  return built.ok ? built.value : null;
}

/** Vrai si la date contient le jour (date exacte → agenda possible). */
export function isExactTalkDate(value: string | null): boolean {
  if (!value) return false;
  const m = value.match(ISO_RE);
  return Boolean(m && m[3]);
}

/**
 * Ce qu'une édition LÈGUE à une occurrence dont la date est restée imprécise —
 * règle UNIQUE de la saisie manuelle (resolveOccurrenceLink) et de l'import
 * (construirePlan). Principe : n'affirmer que ce qu'on SAIT.
 *
 * - Édition d'un seul jour (`dateFin` absente ou égale au début) : elle connaît
 *   le jour du talk → il est légué.
 * - Édition sur PLUSIEURS jours : le talk tombe l'UN des jours, personne ne
 *   sait lequel → elle lègue le mois (ou l'année seule si la fenêtre chevauche
 *   deux mois), jamais un faux jour précis. Préciser le jour reste possible,
 *   jamais exigé.
 * - Le legs ne dégrade ni ne contredit la saisie : une date plus précise ou
 *   d'une autre période que le legs repart telle quelle.
 */
export function dateLegueeParEdition(
  dateDebut: string | null,
  dateFin: string | null,
  saisie: string | null,
): string | null {
  if (isExactTalkDate(saisie) || !isExactTalkDate(dateDebut)) return saisie;
  const debut = dateDebut as string;
  const fin = isExactTalkDate(dateFin) ? (dateFin as string) : null;
  const legs =
    fin === null || fin === debut
      ? debut // un seul jour : il est sûr
      : fin.slice(0, 7) === debut.slice(0, 7)
        ? debut.slice(0, 7) // plusieurs jours, un seul mois
        : fin.slice(0, 4) === debut.slice(0, 4)
          ? debut.slice(0, 4) // fenêtre à cheval sur deux mois
          : null; // à cheval sur deux ans : rien de sûr
  if (legs === null) return saisie;
  const base = saisie ?? "";
  // Ni contradiction (autre année/mois saisi), ni perte de précision.
  if (base !== "" && !legs.startsWith(base)) return saisie;
  return legs.length > base.length ? legs : saisie;
}

/**
 * Dernier jour couvert par une date à précision variable : « 2026 » court
 * jusqu'au 31 décembre, « 2026-11 » jusqu'au 30 novembre, une date exacte est sa
 * propre fin. Une valeur libre historique (non ISO) est renvoyée telle quelle.
 *
 * C'est ce qui permet de comparer honnêtement une annonce imprécise au calendrier :
 * « courant 2026 » est encore DEVANT nous en juillet 2026, alors qu'une
 * comparaison texte brute la classerait déjà dans le passé.
 */
export function finDePeriodeTalk(value: string): string {
  const m = value.match(ISO_RE);
  if (!m) return value;
  const [, annee, mois, jour] = m;
  if (jour) return value;
  if (mois) {
    // Jour 0 du mois suivant = dernier jour du mois courant (bissextiles inclus).
    const dernier = new Date(Date.UTC(Number(annee), Number(mois), 0)).getUTCDate();
    return `${annee}-${mois}-${String(dernier).padStart(2, "0")}`;
  }
  return `${annee}-12-31`;
}

/** Une intervention est passée quand sa période est ENTIÈREMENT derrière nous. */
export function estPasseTalkDate(value: string, aujourdhui: string): boolean {
  return finDePeriodeTalk(value) < aujourdhui;
}

/** Affichage français : « 2026 », « novembre 2026 », « 19 novembre 2026 ». */
export function formatTalkDate(value: string | null): string {
  if (!value) return "";
  const m = value.match(ISO_RE);
  if (!m) return value; // valeur libre historique : on l'affiche telle quelle
  const [, annee, mois, jour] = m;
  const moisNom = mois ? MOIS_FR[Number(mois) - 1] : "";
  if (jour && moisNom) return `${Number(jour)} ${moisNom} ${annee}`;
  if (moisNom) return `${moisNom} ${annee}`;
  return annee;
}

/**
 * Libellé d'une occurrence : « DevFest · Toulouse · France · 19 novembre 2026 ».
 * Les parties absentes disparaissent (pas de séparateur orphelin). Extrait ici
 * après une 3ᵉ répétition (fiche publique, espace membre, page du talk) : le
 * format d'une intervention se décide en UN endroit.
 */
export function formatOccurrenceMeta(o: {
  conference: string | null;
  ville: string | null;
  pays: string | null;
  date: string | null;
}): string {
  return [o.conference, o.ville, o.pays, formatTalkDate(o.date)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Sous-titre d'une occurrence QUAND la conférence est déjà annoncée au-dessus
 * (fiche publique : logo + nom de la conf en tête de ligne) : « novembre 2026 ·
 * Toulouse · France ». La date d'abord, c'est elle qui situe l'intervention
 * dans la liste (la plus récente en haut).
 */
export function formatOccurrenceDateLieu(o: {
  ville: string | null;
  pays: string | null;
  date: string | null;
}): string {
  return [formatTalkDate(o.date), o.ville, o.pays].filter(Boolean).join(" · ");
}
