"use server";

import { revalidatePath } from "next/cache";
import { requireOrgaId } from "@/lib/auth-guards";
import { synchroniserDepuisHelloAsso, synchroReussie } from "@/lib/passe-adhesions";
import { lireBilanAdhesions } from "@/lib/bilan-adhesions";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";

/** Écart minimal entre deux relectures demandées au bouton. */
const FREIN_MS = 60_000;

/**
 * « Relire HelloAsso maintenant » : la même synchro que le cron du soir, à la
 * demande d'une orga. Le résultat se lit sur la page, dans le bilan que la
 * synchro vient d'enregistrer (`bilan-adhesions.ts`) — succès comme échec :
 * l'action ne lève donc pas sur un échec de HelloAsso. Aucun e-mail ne part.
 *
 * Rend l'heure de la relecture, que le bouton annonce. Une relecture au bouton
 * de moins d'une minute n'est pas refaite : la synchro relit TOUT HelloAsso.
 * Le frein lit le bilan, écrit en FIN de synchro : deux clics pendant une
 * même relecture passent tous les deux (sans dégât, la synchro écrit l'état
 * complet ; verrou en dette, docs/dette-technique.md § Adhésions HelloAsso).
 */
export async function relireHelloAssoAction(_etat: unknown): Promise<{ le: string }> {
  await requireOrgaId();
  const dernier = await lireBilanAdhesions();
  if (
    dernier?.origine === "manuelle" &&
    Date.now() - Date.parse(dernier.le) < FREIN_MS
  )
    return { le: dernier.le };
  const maintenant = new Date();
  const synchro = await synchroniserDepuisHelloAsso(maintenant, "manuelle");
  // Une fiche remise en ligne : l'annuaire suit tout de suite.
  if (synchroReussie(synchro) && synchro.fichesReprises > 0) invaliderAnnuaire();
  revalidatePath("/admin/adhesions");
  return { le: maintenant.toISOString() };
}
