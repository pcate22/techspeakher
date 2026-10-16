/**
 * Date au format français, ou null si absente/invalide. jj/mm/aaaa par défaut.
 * **UTC-safe** : les colonnes `DATE` arrivent en chaîne « YYYY-MM-DD » (parser
 * global), que `new Date()` interprète en UTC minuit ; sans `timeZone: "UTC"`,
 * le formatage dans un fuseau derrière UTC décalerait la date d'un jour.
 * `opts` permet un format plus long (ex. `{ day:"numeric", month:"short", year:"numeric" }`).
 */
// Formateurs mémoïsés par combinaison d'options (~6 dans tout le code) :
// `toLocaleDateString` reconstruit un Intl.DateTimeFormat à chaque appel dès
// qu'on passe des options — coût visible sur les listes rendues côté serveur.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFr(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cle = JSON.stringify(opts);
  let f = formatters.get(cle);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts });
    formatters.set(cle, f);
  }
  return f;
}

export function formatDateFr(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return formatterFr(opts).format(date);
}

/** Date longue « 12 mars 2026 » (ou null) : le format des contenus datés —
 *  carte d'actualité, en-tête d'article, résultat de recherche. */
export function dateLongueFr(d: string | null | undefined): string | null {
  // Le premier du mois s'écrit « 1er » en français ; Intl rend « 1 ».
  return formatDateFr(d, { dateStyle: "long" })?.replace(/^1 /, "1er ") ?? null;
}

/**
 * Date longue d'un HORODATAGE (`TIMESTAMPTZ`), lue à l'heure de Paris.
 * `dateLongueFr` formate en UTC, juste pour une colonne `DATE` : appliquée à
 * un paiement fait le 16 octobre à 0 h 30 (Paris), elle affichait le 15
 * (revue du 2026-10-15). Les dates d'adhésion passent donc par ici.
 */
export function dateLongueParis(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const iso = typeof d === "string" ? d : d.toISOString();
  return formatDateFr(iso, { dateStyle: "long", timeZone: "Europe/Paris" })?.replace(/^1 /, "1er ") ?? null;
}

/** L'heure d'un horodatage à Paris, « 23 h 34 » ou « 9 h 05 » (insécables). */
export function heureParis(d: string): string {
  const parts = formatterFr({
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).formatToParts(new Date(d));
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("hour")}\u00a0h\u00a0${v("minute")}`;
}

/** « 15 octobre 2026 à 23 h 34 » : un horodatage, à l'heure de Paris. */
export function dateHeureParis(d: string): string {
  return `${dateLongueParis(d)} à ${heureParis(d)}`;
}

/** Date courte « 12 mars » (ou null), pour les sous-titres de liste. */
export function dateCourteFr(d: string | null | undefined): string | null {
  return formatDateFr(d, { day: "numeric", month: "short" });
}

/**
 * Date de LISTE « mer. 12 août » (jour de semaine court) : LE format des
 * rappels et agendas (refonte, exit les pastilles carrées). L'année ne
 * s'affiche que si elle diffère de `reference` (l'année en cours à l'appel) —
 * un agenda vit dans son année, la répéter partout est du bruit.
 */
export function dateListeFr(
  d: string | null | undefined,
  reference: string,
): string | null {
  if (!d) return null;
  const memeAnnee = d.slice(0, 4) === reference.slice(0, 4);
  return formatDateFr(d, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/** Le « quand » d'une LISTE : la période si l'activité en a une (« du 7 au
 * 13 sept. 2026 »), sinon la date de liste (« mar. 12 août »). */
export function quandListeFr(
  date: string | null | undefined,
  dateFin: string | null | undefined,
  reference: string,
): string | null {
  return periodeFr(date, dateFin, { reference }) ?? dateListeFr(date, reference);
}

/**
 * Le « quand » d'une COLONNE de liste, au plus court : « mar. 12 août » pour un
 * rendez-vous, « 7 → 13 juil. » pour une fenêtre.
 *
 * Pourquoi une forme de plus : dans une colonne de ~5 rem, « du 7 au 13 juil. »
 * tient sur trois lignes et vole au titre la place où se lit son élément
 * discriminant (« Revue croisée (1) » / « (2) »). La flèche dit la même chose en
 * cinq caractères de moins. Purement visuel — l'équivalent parlé est
 * `quandLongFr`, la colonne étant `aria-hidden`.
 */
export function quandColonneFr(
  date: string | null | undefined,
  dateFin: string | null | undefined,
  reference: string,
): string | null {
  if (!date || !dateFin || !estFenetre(date, dateFin)) return dateListeFr(date, reference);
  const memeAnnee = dateFin.slice(0, 4) === reference.slice(0, 4);
  const fin = formatDateFr(dateFin, {
    day: "numeric",
    month: "short",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
  // Le mois ne se répète pas si les deux bornes le partagent.
  const debut = formatDateFr(
    date,
    date.slice(0, 7) === dateFin.slice(0, 7)
      ? { day: "numeric" }
      : { day: "numeric", month: "short" },
  );
  return debut && fin ? `${debut} → ${fin}` : dateListeFr(date, reference);
}

/** En-tête de JOUR de l'agenda : « lundi 7 septembre » — tout en lettres
 * (les titres servent de plan de navigation aux lecteurs d'écran : jamais
 * d'abréviation nue dans un heading). */
export function jourAgendaFr(d: string): string | null {
  return formatDateFr(d, { weekday: "long", day: "numeric", month: "long" });
}

/** Mois d'agenda « Septembre 2026 » (clé YYYY-MM), capitale initiale. */
export function moisAgendaFr(cleMois: string): string {
  const brut = formatDateFr(`${cleMois}-01`, { month: "long", year: "numeric" }) ?? cleMois;
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/**
 * Cette activité est-elle une FENÊTRE (« à faire entre deux dates ») plutôt
 * qu'un rendez-vous ? LA définition partagée : une fin qui existe et qui
 * DIFFÈRE du début (`dateFin === date` est un rendez-vous d'un jour, pas une
 * période). Elle vivait en trois exemplaires, chacun avec sa nuance — d'où un
 * atelier qui s'affichait en période mais perdait sa consigne « à caler ».
 *
 * Prédicat de type sur `dateFin` : après ce test, les appelants savent qu'elle
 * existe, sans `!` ni double vérification.
 */
export function estFenetre(
  date: string | null | undefined,
  dateFin: string | null | undefined,
): dateFin is string {
  return Boolean(dateFin) && dateFin !== date;
}

/**
 * PÉRIODE en français — « du 7 au 13 sept. 2026 » (refonte §2.4) : une
 * activité « à faire entre deux dates » s'affiche comme une période, jamais
 * comme sa seule date de début. Le mois/l'année ne se répètent que s'ils
 * changent entre les bornes. Pas de fenêtre (`estFenetre`) → null (l'appelant
 * affiche la date simple, y compris quand la fin répète le début : « du 7 au
 * 7 juillet » n'est pas une période) ; fin seule → « jusqu'au … » ; borne
 * illisible → null (jamais d'« Invalid Date » à l'écran). `long` : mois en
 * toutes lettres (lecteurs d'écran, cf. DateFr).
 */
export function periodeFr(
  debut: string | null | undefined,
  fin: string | null | undefined,
  { long = false, reference }: { long?: boolean; reference?: string } = {},
): string | null {
  if (!estFenetre(debut, fin)) return null;
  const mois: Intl.DateTimeFormatOptions = { month: long ? "long" : "short" };
  // Avec une `reference` (l'année en cours) : l'année ne s'affiche que si elle
  // en diffère — même règle que `dateListeFr` (colonnes de liste compactes).
  const sansAnnee = reference !== undefined && fin.slice(0, 4) === reference.slice(0, 4);
  const complet: Intl.DateTimeFormatOptions = sansAnnee
    ? { day: "numeric", ...mois }
    : { day: "numeric", ...mois, year: "numeric" };
  const finFmt = formatDateFr(fin, complet);
  if (!finFmt) return null;
  if (!debut) return `jusqu'au ${finFmt}`;
  const memeAnnee = debut.slice(0, 4) === fin.slice(0, 4);
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  const debutFmt = formatDateFr(
    debut,
    memeMois ? { day: "numeric" } : memeAnnee ? { day: "numeric", ...mois } : complet,
  );
  if (!debutFmt) return null;
  return `du ${debutFmt} au ${finFmt}`;
}

/**
 * LE « quand » d'un atelier en CHAÎNE (jumeau de `QuandAtelier` pour les
 * contextes texte : sous-titres de NavRow, méta jointes par « · ») : la
 * période si l'activité en a une, sinon la date « 7 sept. 2026 », sinon null.
 * Une seule écriture de la décision par monde (React / chaîne) — les surfaces
 * n'assemblent plus leur propre repli.
 */
export function quandFr(
  date: string | null | undefined,
  dateFin?: string | null,
): string | null {
  return (
    periodeFr(date, dateFin) ??
    formatDateFr(date, { day: "numeric", month: "short", year: "numeric" })
  );
}

/**
 * Le « quand » LONG et déjà tourné, pour les équivalents textuels des lecteurs
 * d'écran (`aria-label`, `sr-only`) : « du 7 au 13 juillet 2026 » pour une
 * fenêtre, « Le mardi 28 avril 2026 » pour un rendez-vous, null sans date.
 *
 * C'est la TOURNURE qui est calculée ici, pas seulement la date : une période
 * se dit « du … au … » et ne prend jamais l'article « Le » devant (les
 * appelants qui préfixaient à l'aveugle faisaient entendre « Le du 7 au 13 »).
 */
export function quandLongFr(
  date: string | null | undefined,
  dateFin?: string | null,
): string | null {
  const periode = periodeFr(date, dateFin, { long: true });
  if (periode) return periode;
  const jour = formatDateFr(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return jour && `Le ${jour}`;
}

/**
 * Plage horaire « 18:30–20:00 » ; début seul si la fin manque — UNE règle pour
 * toutes les surfaces (participante, coach, admin), qui divergeaient (l'une
 * montrait « 18:30 », l'autre rien, pour la même donnée).
 */
export function heuresFr(
  debut: string | null | undefined,
  fin: string | null | undefined,
): string | null {
  if (!debut) return null;
  return fin ? `${debut}–${fin}` : debut;
}

/** « 3 récompenses », « 1 photo » : nombre + pluriel simple en s. */
export function nb(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/**
 * Échappe une valeur interpolée dans du HTML — un nom de compte vient d'un
 * fournisseur d'identité ou d'une saisie, et tous nos e-mails en assemblent un.
 *
 * UNE écriture pour les quatre corps d'e-mail qui en avaient chacun une copie :
 * la parade doit être la même partout, sans quoi c'est celle qu'on a oublié de
 * recopier qui décide.
 */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

import { NOM_COMPTE_MAX } from "@/lib/profile-limits";

/**
 * Replie les blancs CASSABLES (retours à la ligne, tabulations, espaces) en
 * espaces simples, puis rogne les bords. Sert là où une valeur doit se rendre
 * sur UNE ligne : titre de profil saisi dans une zone de texte, extrait de
 * message dans un e-mail récapitulatif.
 *
 * Les espaces INSÉCABLES (U+00A0, U+202F) sont préservés : `\s` les couvre en
 * JavaScript, et les replier détruisait la typographie française du projet
 * (espace insécable avant `!\u00a0? :\u00a0;`) dans les valeurs saisies.
 */
export function uneSeuleLigne(s: string): string {
  return s.replace(/[^\S\u00a0\u202f]+/g, " ").trim();
}

/**
 * Nom de COMPTE prêt pour sa colonne : replié sur une ligne (il s'affiche ainsi
 * partout — fiche, annuaire, e-mails) et borné sur `users.name` (VARCHAR(255) :
 * au-delà, l'UPDATE échoue). Rogné APRÈS la coupe, le dernier caractère retenu
 * pouvant être une espace.
 *
 * Fonction PURE ici ; elle est APPLIQUÉE au bord de la colonne (`src/lib/users.ts`),
 * pour que les quatre chemins d'écriture la traversent — elle vivait dans le
 * parseur du formulaire profil, donc les trois autres restaient sans borne.
 */
export function normaliserNomCompte(name: string): string {
  return uneSeuleLigne(name).slice(0, NOM_COMPTE_MAX).trim();
}

/**
 * Énumération française : « A », « A et B », « A, B et C ». Une liste vide rend
 * une chaîne vide — c'est à l'appelant de dire ce que « rien » signifie chez lui
 * (« Autonome », « Aucun secteur choisi »…), la formulation n'est jamais la même.
 *
 * `Intl.ListFormat` plutôt qu'un `join` à la main : la règle française (virgules
 * puis « et ») est celle de la plateforme, et chaque `join(", ")` disséminé
 * produit un registre différent dans une même phrase.
 */
const listeFr = new Intl.ListFormat("fr-FR", { style: "long", type: "conjunction" });

export function enumererFr(items: readonly string[]): string {
  return listeFr.format(items.map((i) => i.trim()).filter((i) => i.length > 0));
}

/**
 * LA salutation des e-mails : « Salut Prénom, » (ou « Salut, » sans nom).
 * Une seule forme pour tous les envois, tutoiement de la communauté (relecture
 * du 2026-10-15 : « Bonjour » et « Salut » se mélangeaient selon l'e-mail).
 * Texte brut : un e-mail HTML passe le résultat par `escapeHtml`.
 */
export function salutation(name: string | null | undefined): string {
  const prenom = name?.trim().split(/\s+/)[0] ?? "";
  return prenom ? `Salut ${prenom},` : "Salut,";
}

