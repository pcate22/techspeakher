import type { CfpSyncMode } from "@/lib/profiles";

/**
 * Le consentement au moissonneur CFP : la liste FERMÉE des modes, et celui qui
 * décide qu'on a le droit d'aller chercher les talks d'une speakeuse — et de
 * lui écrire à ce sujet.
 *
 * La couche DB n'est importée qu'en TYPE : ce module reste des données pures,
 * le fragment SQL se construit au point d'usage (`sqlDansListe`).
 */
export const CFP_SYNC_MODES = [
  "aucun",
  "suggestions",
  "auto",
] as const satisfies readonly CfpSyncMode[];

/**
 * Ce mode autorise-t-il le moissonnage (et l'e-mail qui l'annonce) ?
 *
 * `Record` exhaustif : un mode ajouté au type sans être rangé ici ne compile
 * pas. Un consentement qu'on ne sait pas lire vaut REFUS — les cinq requêtes
 * du moissonneur demandaient « tout sauf aucun » jusqu'à la migration 073,
 * donc moissonnaient et écrivaient par défaut.
 */
const MOISSONNAGE_CONSENTI: Record<CfpSyncMode, boolean> = {
  aucun: false,
  suggestions: true,
  auto: true,
};

/** Les modes qui consentent — dérivés du tableau, jamais recopiés. */
export const MODES_MOISSONNABLES = CFP_SYNC_MODES.filter((m) => MOISSONNAGE_CONSENTI[m]);

/**
 * La MÊME décision, pour les lecteurs qui n'ont pas de SQL à écrire : la garde
 * du moissonnage à la demande, et la case du formulaire de fiche.
 *
 * Elle est exportée parce que ces deux-là comparaient encore à la main — dont
 * un `!== "aucun"`, la lecture en négatif que ce lot est allé corriger partout
 * ailleurs. Les requêtes dérivaient bien du `Record`, mais un quatrième mode
 * ajouté demain aurait ouvert la garde du Server Action et pré-coché la case
 * sans que personne l'ait décidé : le `Record` force à ranger le mode, il ne
 * force pas les comparaisons littérales à changer d'avis.
 */
export function moissonnageConsenti(mode: CfpSyncMode): boolean {
  return MOISSONNAGE_CONSENTI[mode];
}
