import type { ProfileStatus } from "@/lib/profiles";

/**
 * Source unique pour les statuts d'une fiche speakeuse (liste, libellés
 * affichés) et pour LE nom affiché (`nomAffiche`). Évite de redéfinir ces
 * règles à chaque endroit (badge admin, hero espace…). La couche DB n'est
 * importée qu'en TYPE → aucune dépendance runtime sur `pg`, donc importable
 * par les composants client.
 */
export const PROFILE_STATUSES = [
  "brouillon",
  "en_attente",
  "publie",
  "refuse",
  "masque",
  "en_pause",
] as const satisfies readonly ProfileStatus[];

/** Libellés FR (le Record force l'exhaustivité : un statut oublié = erreur TS). */
export const STATUS_LABELS: Record<ProfileStatus, string> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  publie: "Publiée",
  refuse: "Refusée",
  masque: "En retrait",
  en_pause: "En pause",
};

export function statusLabel(status: ProfileStatus | null | undefined): string {
  return status ? STATUS_LABELS[status] : STATUS_LABELS.brouillon;
}

/**
 * La fiche est-elle JOINTE à la personne sur les surfaces qui l'affichent au
 * titre du consentement d'ÉDITION (la galerie du Tremplin) ?
 *
 * Le consentement d'édition est découplé de l'annuaire : une fiche en brouillon
 * ou en attente de modération porte quand même bio, rôle et liens sur la page
 * de l'édition, parce que la personne a consenti À ÇA. Le retrait, lui, est
 * explicite : `masque` (retrait demandé) et `refuse` (modération) coupent tout.
 *
 * `Record` exhaustif, et c'est là qu'est la protection : un statut ajouté au
 * type sans être rangé ici ne compile pas. La question « cette fiche-là
 * s'affiche-t-elle ? » ne peut pas rester sans réponse, et la réponse par
 * défaut n'est pas « on montre » — la requête demandait « tout sauf masque et
 * refuse » jusqu'à la migration 073.
 */
const FICHE_JOINTE_A_L_EDITION: Record<ProfileStatus, boolean> = {
  brouillon: true,
  en_attente: true,
  publie: true,
  refuse: false,
  masque: false,
  // La pause vient d'une adhésion échue, pas d'un retrait : le consentement
  // d'édition, lui, tient toujours (comme pour un brouillon).
  en_pause: true,
};

/** Les statuts concernés — dérivés du tableau, jamais recopiés. Le fragment
 *  SQL se construit au point d'usage (`sqlDansListe`), côté serveur. */
export const STATUTS_FICHE_JOINTE = PROFILE_STATUSES.filter(
  (s) => FICHE_JOINTE_A_L_EDITION[s],
);

/**
 * La membre peut-elle RETIRER sa fiche (retour au brouillon) ? Oui depuis
 * tout statut où la fiche est en ligne, en file ou hors de l'annuaire ; non
 * depuis un brouillon (rien à retirer) ou un refus (la décision d'orga reste
 * lisible jusqu'à ce qu'elle reprenne sa fiche). `Record` exhaustif : un
 * statut ajouté se range ici pour compiler, et l'écran comme le SQL suivent.
 */
const RETIRABLE_PAR_LA_MEMBRE: Record<ProfileStatus, boolean> = {
  brouillon: false,
  en_attente: true,
  publie: true,
  refuse: false,
  masque: true,
  en_pause: true,
};

export const STATUTS_RETIRABLES = PROFILE_STATUSES.filter((s) => RETIRABLE_PAR_LA_MEMBRE[s]);

/** Le libellé de repli quand une fiche n'a rien d'affichable comme nom. */
export const NOM_GENERIQUE = "Speakeuse";

/**
 * LE nom affiché d'une fiche, calculé UNE fois au bord (mapRow /
 * toPublicSpeaker) et lu tel quel par tous les écrans. Avant lui, six écrans
 * recopiaient `name ?? titreProfil ?? "Speakeuse"` — et `??` laisse passer
 * `""` et `"   "` quand les gardes de publication testent `.trim()` : une
 * fiche migrée au nom vide s'affichait « vide » dans l'annuaire public.
 */
export function nomAffiche(name: string | null, titreProfil: string | null): string {
  return name?.trim() || titreProfil?.trim() || NOM_GENERIQUE;
}
