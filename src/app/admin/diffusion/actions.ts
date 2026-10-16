"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgaId } from "@/lib/auth-guards";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { listeComptes, synchroniserComptes } from "@/lib/brevo-contacts";

/**
 * Synchronise la liste « Comptes plateforme » vers Brevo : adresses + attributs
 * de ciblage (fiche, Tremplin, montée sur scène, coach, orga).
 *
 * « Comptes », pas « membres » : l'association compte des adhésions sans compte
 * ici, qui vivent dans leurs propres listes Brevo.
 *
 * Ce que cette action NE fait PAS, exprès : envoyer. La campagne s'écrit et
 * part depuis Brevo, avec son lien de désabonnement natif — c'est tout l'objet
 * de la bascule. Ici on tient à jour QUI reçoit et avec quelles étiquettes.
 *
 * Rejouable : `importContacts` met à jour les contacts existants, donc relancer
 * ne crée aucun doublon. Les personnes désabonnées sont absentes de la source
 * (`comptesASynchroniser`), et on ne renvoie jamais l'état de blacklist : une
 * désinscription faite dans un e-mail survit à toutes les synchros.
 */
export async function synchroniserContactsAction(): Promise<void> {
  await requireOrgaId();
  if (!isMagicLinkEnabled()) redirect("/admin/diffusion?sync=indisponible");

  const listId = listeComptes();
  if (listId === null) redirect("/admin/diffusion?sync=sans-liste");

  let synchronises = 0;
  try {
    synchronises = (await synchroniserComptes()).contacts;
  } catch (err) {
    console.error("Synchronisation Brevo échouée", err);
    const raison = err instanceof Error ? err.message : String(err);
    redirect(
      `/admin/diffusion?sync=echec&err=${encodeURIComponent(raison.slice(0, 160))}`,
    );
  }

  revalidatePath("/admin/diffusion");
  redirect(`/admin/diffusion?sync=ok&contacts=${synchronises}`);
}
