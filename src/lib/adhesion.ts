/**
 * L'adhésion à l'association : la liste FERMÉE de ses statuts, et ce que
 * chacun décide. Aucun écran ne les écrit — une adhésion se saisit à la main
 * dans l'éditeur SQL de Neon — d'où l'importance que la base connaisse la
 * liste (`db/migrations/073_statuts_listes_fermees.sql`).
 *
 * Données pures : le fragment SQL se construit au point d'usage
 * (`sqlDansListe`), là où la colonne est connue.
 */
export type AdhesionStatut = "active" | "expired";

export const ADHESION_STATUTS = [
  "active",
  "expired",
] as const satisfies readonly AdhesionStatut[];

/**
 * Une adhésion protège-t-elle le compte de la passe de conservation ?
 *
 * `Record` exhaustif, et c'est là qu'est la protection : un statut ajouté au
 * type sans être rangé ici ne compile pas. La question ne peut pas rester sans
 * réponse, et la réponse par défaut n'est pas « on supprime ».
 */
const ADHESION_PROTEGE: Record<AdhesionStatut, boolean> = {
  active: true,
  expired: false,
};

/** Les statuts d'une adhésion FINIE — dérivés du tableau, jamais recopiés. */
export const ADHESION_STATUTS_PERIMES = ADHESION_STATUTS.filter(
  (s) => !ADHESION_PROTEGE[s],
);

// ─── Échéance et « à jour » (adhésions HelloAsso, migration 074) ───
// Cf. docs/conception-adhesions-helloasso.md. Tout ce qui suit est pur : les
// modules branchés à la base (adhesions.ts, annuaire-adhesion.ts, profiles.ts)
// et les libellés (adhesion-libelle.ts) le lisent ici, jamais en copie.

export const DUREE_ADHESION_MOIS = 12;
/** Délai entre le préavis et la mise en pause d'une fiche. */
export const PREAVIS_ANNUAIRE_JOURS = 30;
/** La relance part quand l'échéance tombe dans ce délai. */
export const RELANCE_AVANT_ECHEANCE_JOURS = 30;

export const dansJours = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Date à date, borné au dernier jour du mois (31 janvier + 1 mois = 28 février). */
export function ajouterMois(d: Date, mois: number): Date {
  const r = new Date(d);
  const jour = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(jour, dernier));
  return r;
}

/**
 * L'échéance d'une suite d'adhésions (dates de paiement, dans n'importe quel
 * ordre). Tranché le 2026-10-15 : une adhésion vaut 12 mois **à partir de
 * l'échéance en cours** si elle court encore — renouveler tôt ne fait perdre
 * aucun jour — sinon à partir du paiement. `debut` est le début de la période
 * d'adhésion ininterrompue en cours.
 */
export function enchainerEcheance(dates: string[]): { debut: Date; fin: Date } | null {
  const tri = dates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  return tri.reduce<{ debut: Date; fin: Date } | null>(
    (courant, paiement) =>
      courant && paiement < courant.fin
        ? { debut: courant.debut, fin: ajouterMois(courant.fin, DUREE_ADHESION_MOIS) }
        : { debut: paiement, fin: ajouterMois(paiement, DUREE_ADHESION_MOIS) },
    null,
  );
}

/**
 * Être À JOUR à une date : une adhésion `active` dont l'échéance est après
 * elle. UNE définition, en deux langues : elle décide d'une pause de fiche,
 * elle ne se recopie pas. Toujours lue en positif — la négation se fait autour
 * (`NOT COALESCE(…, false)`), jamais en réécrivant la condition à l'envers.
 */
export function adhesionAJourSql(alias: string, parametreDate: string): string {
  return `(${alias}.status = 'active' AND ${alias}.expires_at > ${parametreDate})`;
}

export function estAJour(
  a: { status: string; expiresAt: string | Date },
  maintenant: Date,
): boolean {
  return a.status === "active" && new Date(a.expiresAt) > maintenant;
}

/**
 * Le délai d'apparition d'une adhésion, dans les mots validés par Cateline le
 * 2026-10-15 : la notification HelloAsso la relie dans les minutes qui
 * suivent, le rattrapage du cron du soir au plus tard le lendemain. Une seule
 * formulation, partout où on le dit (Mon adhésion, Mon profil, /adherer, le
 * retour d'une fiche en pause).
 */
export const DELAI_ADHESION = "dans quelques minutes, et au plus tard le lendemain";

/** Ce qu'une membre lit de son adhésion. `close` : arrêtée avant son terme
 *  (remboursée, annulée), donc sans échéance à annoncer. */
export type EtatAdhesion = "active" | "a_renouveler" | "echue" | "close";

export function etatAdhesion(
  a: { status: string; expiresAt: string | Date },
  maintenant: Date,
): EtatAdhesion {
  const fin = new Date(a.expiresAt);
  if (!estAJour(a, maintenant)) return fin > maintenant ? "close" : "echue";
  return fin <= dansJours(maintenant, RELANCE_AVANT_ECHEANCE_JOURS) ? "a_renouveler" : "active";
}

