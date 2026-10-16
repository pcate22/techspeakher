"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgaId } from "@/lib/auth-guards";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import { synchroniserDepuisHelloAsso, synchroReussie } from "@/lib/passe-adhesions";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import {
  fichesAInviterAAdherer,
  libererInvitationAdhesion,
  LOT_INVITATIONS,
  reserverInvitationAdhesion,
} from "@/lib/annuaire-adhesion";
import { buildInvitationAdhesionEmail } from "@/lib/adhesion-email";

const PAGE = "/admin/adhesions/inviter";

/**
 * Inviter à adhérer les titulaires d'une fiche en ligne (cf.
 * docs/conception-adhesions-helloasso.md § 6). Qui reçoit est décidé par le SQL
 * de `fichesAInviterAAdherer`, jamais ici.
 *
 * L'ordre porte la règle : une synchro HelloAsso FRAÎCHE et réussie d'abord,
 * sinon aucun envoi. Sans elle, une membre qui a adhéré depuis le dernier cron
 * recevrait une invitation à faire ce qu'elle vient de faire.
 *
 * Chaque fiche est RÉSERVÉE avant l'envoi (écriture atomique) et libérée si
 * l'envoi échoue : deux exécutions simultanées n'écrivent jamais deux fois à
 * la même personne.
 *
 * Post-Redirect-Get, comme les relances de brouillons : le résultat s'affiche
 * sur la page rechargée.
 */
export async function inviterAAdhererAction(): Promise<void> {
  await requireOrgaId();
  if (!isMagicLinkEnabled()) redirect(`${PAGE}?envoi=indisponible`);

  const maintenant = new Date();
  const synchro = await synchroniserDepuisHelloAsso(maintenant, "invitation");
  if (synchro === "non_configuree") redirect(`${PAGE}?envoi=synchro-absente`);
  if (!synchroReussie(synchro)) redirect(`${PAGE}?envoi=synchro-echec`);
  // La synchro a pu remettre des fiches en ligne : l'annuaire suit tout de suite.
  if (synchro.fichesReprises > 0) invaliderAnnuaire();

  const fiches = await fichesAInviterAAdherer(maintenant);
  const lot = fiches.slice(0, LOT_INVITATIONS);
  let envoyees = 0;
  let echecs = 0;
  let premiereErreur: string | null = null;
  for (const f of lot) {
    // Prise par une autre exécution entre la lecture et ici : on passe.
    if (!(await reserverInvitationAdhesion(f.profileId, maintenant))) continue;
    try {
      await sendBrevoEmail({
        to: f.email,
        toName: f.name ?? undefined,
        ...buildInvitationAdhesionEmail({ name: f.name }),
      });
      envoyees++;
    } catch (err) {
      echecs++;
      premiereErreur ??= err instanceof Error ? err.message : String(err);
      console.error("Invitation à adhérer échouée", f.profileId, err);
      // Une libération ratée laisse la fiche réservée sans envoi : on le dit
      // dans les logs, et l'action rend quand même son bilan.
      try {
        await libererInvitationAdhesion(f.profileId);
      } catch (e) {
        console.error("Invitation à adhérer : libération échouée", f.profileId, e);
      }
    }
  }

  // Les échecs ET leur raison : un lot à moitié parti qui s'annonce « envoyé »
  // est exactement le silence qui ressemble au succès (même règle que les
  // relances de brouillons).
  const params = new URLSearchParams({ envoyees: String(envoyees) });
  if (echecs > 0) {
    params.set("echecs", String(echecs));
    if (premiereErreur) params.set("err", premiereErreur.slice(0, 160));
  }
  const restantes = fiches.length - lot.length;
  if (restantes > 0) params.set("restantes", String(restantes));

  revalidatePath(PAGE);
  revalidatePath("/admin/adhesions");
  redirect(`${PAGE}?${params.toString()}`);
}
