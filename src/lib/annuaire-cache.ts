import { revalidateTag, updateTag } from "next/cache";

/**
 * LE tag du cache de données de l'annuaire public (/speakeuses).
 *
 * La page reste `force-dynamic` (leçon du 2026-07-23 : un vide de panne
 * s'était figé dans le cache de PAGE) ; c'est sa LECTURE qui est cachée
 * (`unstable_cache`, voir `lireAnnuaire` dans la page), et ce tag est le
 * canal d'invalidation. Une écriture qui change ce que l'annuaire montre
 * (modération, fiche enregistrée ou re-soumise, retrait, talks, photo,
 * suppression de compte…) appelle le geste adapté à son contexte :
 * `invaliderAnnuaire()` depuis une Server Action (immédiat),
 * `invaliderAnnuaireDiffere()` depuis un route handler ou un cron — au même
 * endroit que son `revalidatePath("/speakeuses")` quand elle en a un. Le
 * filet `revalidate: 300` du cache borne le coût d'un oubli futur (5 min,
 * plus un service périmé : c'est du stale-while-revalidate) — il n'exempte
 * aucune écriture connue.
 */
export const TAG_ANNUAIRE = "annuaire";

/**
 * À appeler par TOUTE écriture qui change ce que l'annuaire montre.
 *
 * `updateTag`, pas `revalidateTag("max")` : l'expiration est IMMÉDIATE
 * (read-your-own-writes). Une fiche masquée par la modération ou retirée
 * (RGPD) ne doit pas être servie « stale pendant que ça rafraîchit » — et
 * tous les appelants sont des Server Actions, le seul contexte où
 * `updateTag` est permis.
 */
export function invaliderAnnuaire(): void {
  updateTag(TAG_ANNUAIRE);
}

/**
 * Le même geste pour les contextes où `updateTag` est INTERDIT (route
 * handlers, crons — Next 16 le réserve aux Server Actions) :
 * stale-while-revalidate, du périmé servi au plus une fois. Suffisant pour
 * ce qui passe par là (photo déposée, titres moissonnés, passe de
 * conservation quotidienne) ; tout retrait à la demande d'une personne
 * passe, lui, par une Server Action et l'expiration immédiate.
 */
export function invaliderAnnuaireDiffere(): void {
  revalidateTag(TAG_ANNUAIRE, "max");
}
