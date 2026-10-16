/**
 * Statuts d'édition et libellés dérivés : module SANS accès BDD, importable par
 * les composants client (les modales admin) comme par le serveur —
 * `tremplin-editions.ts` (qui importe `pg`) re-exporte le tout.
 */

/**
 * Cycle de vie d'une édition. `preparation` = en cours de montage par l'orga :
 * INVISIBLE du public (page d'édition et hubs) tant qu'elle n'est pas ouverte —
 * on n'annonce pas une édition avant de le décider.
 */
export type EditionStatut = "preparation" | "ouvert" | "en_cours" | "clos" | "archive";

/** Liste fermée des statuts (validation de formulaires, sélecteurs). */
export const EDITION_STATUTS = [
  "preparation",
  "ouvert",
  "en_cours",
  "clos",
  "archive",
] as const satisfies readonly EditionStatut[];

export function isEditionStatut(v: unknown): v is EditionStatut {
  return (EDITION_STATUTS as readonly string[]).includes(v as string);
}

/** Libellé FR d'un statut d'édition (source unique pour l'UI). */
export const EDITION_STATUT_LABEL: Record<EditionStatut, string> = {
  preparation: "En préparation",
  ouvert: "Inscriptions ouvertes",
  en_cours: "En cours",
  clos: "Finale passée",
  archive: "Édition passée",
};

/**
 * Partie date (AAAA-MM-JJ) d'un instant, en heure de Paris : les dates du
 * Tremplin sont des dates françaises, l'UTC ferait basculer d'un jour entre
 * minuit et 01 h/02 h du matin. (fr-CA formate justement en AAAA-MM-JJ.)
 */
export function dateParis(instant: Date | string): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
    new Date(instant),
  );
}

/** Date du jour (AAAA-MM-JJ) en heure de Paris. */
export function aujourdhuiParis(): string {
  return dateParis(new Date());
}

/** Fenêtre d'inscriptions d'une édition (bornes AAAA-MM-JJ, incluses). */
export interface FenetreInscriptions {
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
}

/**
 * État des inscriptions dérivé de la fenêtre de dates et de la date du jour
 * (AAAA-MM-JJ). `null` si aucune date n'est posée : le statut manuel fait foi.
 */
export type InscriptionsEtat = "a_venir" | "ouvertes" | "fermees";

export function inscriptionsEtat(
  e: FenetreInscriptions,
  todayStr: string,
): InscriptionsEtat | null {
  if (!e.inscriptionsDebut && !e.inscriptionsFin) return null;
  if (e.inscriptionsDebut && todayStr < e.inscriptionsDebut) return "a_venir";
  if (e.inscriptionsFin && todayStr > e.inscriptionsFin) return "fermees";
  return "ouvertes";
}

/**
 * Nom d'une édition prêt pour un RACCOURCI de navigation, où il faut dire de
 * quoi il s'agit : « Tremplin 2026 » tel quel, « TSH 2026 » préfixé.
 *
 * Le préfixe était posé à l'aveugle et donnait « Tremplin Tremplin 2026 » sur le
 * nom réel de la prod. Le supprimer sans condition aurait cassé l'autre
 * convention (un nom qui ne dit pas qu'il désigne un tremplin) : on ne préfixe
 * donc que ce qui en a besoin.
 */
export function libelleEditionRaccourci(nom: string): string {
  return /^tremplin\b/i.test(nom.trim()) ? nom.trim() : `Tremplin ${nom.trim()}`;
}

/**
 * Libellé de statut AFFICHÉ publiquement : quand la fenêtre d'inscriptions est
 * renseignée et que l'édition est active (`ouvert`/`en_cours`), l'état des
 * inscriptions est dérivé de la date du jour — plus besoin de basculer le
 * statut à la main au bon moment. Sinon, le statut manuel fait foi.
 */
export function editionStatutAffiche(
  e: FenetreInscriptions & { statut: EditionStatut },
  todayStr: string,
): string {
  if (e.statut === "ouvert" || e.statut === "en_cours") {
    const etat = inscriptionsEtat(e, todayStr);
    if (etat === "a_venir") return "Inscriptions à venir";
    if (etat === "ouvertes") return "Inscriptions ouvertes";
    if (etat === "fermees") {
      return e.statut === "en_cours" ? EDITION_STATUT_LABEL.en_cours : "Inscriptions closes";
    }
  }
  return EDITION_STATUT_LABEL[e.statut] ?? e.statut;
}

/**
 * Fin EFFECTIVE d'un atelier : la fin de sa période si elle existe, sinon sa
 * date. LA définition partagée du « quand ça se termine » — son miroir SQL est
 * `COALESCE(date_fin, date)` (cf. A_VENIR_SQL, mes-ateliers.ts) : toute
 * évolution se fait aux deux endroits, documentés l'un vers l'autre.
 */
export function finEffective(a: {
  date: string | null;
  dateFin?: string | null;
}): string | null {
  return a.dateFin ?? a.date;
}

/**
 * Un atelier est PASSÉ quand sa fin effective est STRICTEMENT avant aujourd'hui
 * (le jour même, il est encore « à venir » — borne complémentaire de
 * `COALESCE(date_fin, date) >= aujourd'hui` côté SQL, verrouillée par test).
 * Sans aucune date : jamais « passé » (rien à situer dans le temps).
 */
export function estPasse(
  a: { date: string | null; dateFin?: string | null },
  aujourdhui: string,
): boolean {
  const fin = finEffective(a);
  return fin !== null && fin < aujourdhui;
}
