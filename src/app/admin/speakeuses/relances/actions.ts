"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  getProfilesEnSommeil,
  getFicheARelancer,
  markRemindersSent,
  type FicheEnSommeil,
} from "@/lib/profiles";
import { getReglages } from "@/lib/reglages";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import { buildRelanceEmail, chantiersRestants } from "@/lib/relance-email";
import type { ActionState } from "@/lib/action-state";

/**
 * Relancer les fiches restées en brouillon (cf.
 * `docs/conception-relance-brouillons.md`). Deux gestes, une seule mécanique :
 * le LOT depuis `/admin/speakeuses/relances`, et l'UNITÉ depuis la fiche en vue
 * orga.
 *
 * Qui a le droit de recevoir quoi est décidé par les clauses SQL de
 * `getProfilesEnSommeil` / `getFicheARelancer`, jamais ici : ces actions ne font
 * qu'écrire à ce que la base leur donne. Elles ne peuvent donc pas se tromper de
 * destinataire en oubliant un `if`.
 */

const PAGE = "/admin/speakeuses/relances";

/** L'e-mail d'UNE fiche. Lève si Brevo refuse (l'appelant décide quoi en faire). */
async function envoyerRelance(fiche: FicheEnSommeil): Promise<void> {
  const { subject, htmlContent } = buildRelanceEmail({
    name: fiche.profile.name,
    chantiers: chantiersRestants(fiche.profile, fiche.talksCount),
  });
  await sendBrevoEmail({
    to: fiche.email,
    toName: fiche.profile.name ?? undefined,
    subject,
    htmlContent,
  });
}

/**
 * LE LOT. Best-effort par destinataire : un envoi qui échoue laisse le reste
 * partir, et surtout laisse la personne DANS le lot (on ne marque que les
 * succès) — sinon un incident Brevo effacerait silencieusement des gens qui
 * n'ont rien reçu.
 *
 * Post-Redirect-Get : c'est un formulaire de page entière, le résultat s'affiche
 * sur la page rechargée (principes UI § 4).
 */
export async function relancerLotAction(): Promise<void> {
  await requireOrgaId();
  if (!isMagicLinkEnabled()) redirect(`${PAGE}?envoi=indisponible`);

  const { relance_brouillon_jours } = await getReglages();
  const fiches = await getProfilesEnSommeil(relance_brouillon_jours);

  const envoyees: number[] = [];
  let premiereErreur: string | null = null;
  for (const f of fiches) {
    try {
      await envoyerRelance(f);
      // Marquage IMMÉDIAT, fiche par fiche, plutôt qu'un lot final : la
      // fonction serveur peut être coupée en cours de route (délai maximum
      // d'exécution) ou relancée par un second clic. Un marquage groupé à la
      // fin perdrait alors la trace de tout ce qui est déjà parti, et le
      // rejeu écrirait une deuxième fois aux mêmes personnes.
      await markRemindersSent([f.profile.id]);
      envoyees.push(f.profile.id);
    } catch (err) {
      if (premiereErreur === null) {
        premiereErreur = err instanceof Error ? err.message : String(err);
      }
      console.error("Relance échouée", f.profile.id, err);
    }
  }

  // On remonte les échecs ET leur raison : un lot à moitié parti qui s'annonce
  // « envoyé » est exactement le silence qui ressemble au succès.
  const params = new URLSearchParams({ envoyees: String(envoyees.length) });
  const echecs = fiches.length - envoyees.length;
  if (echecs > 0) {
    params.set("echecs", String(echecs));
    if (premiereErreur) params.set("err", premiereErreur.slice(0, 160));
  }

  revalidatePath(PAGE);
  revalidatePath("/admin/speakeuses");
  redirect(`${PAGE}?${params.toString()}`);
}

/** Retour de la relance individuelle : un message nominatif, à côté du bouton. */
export type EtatRelance = ActionState<{ message: string }>;

function echec(error: string): EtatRelance {
  return { status: "error", error, values: {} };
}

/**
 * L'UNITÉ, depuis la fiche en vue orga. Pattern RÉSULTAT (`useActionState`) et
 * pas de redirection : la relance est une micro-action au milieu d'une page de
 * consultation, un PRG y renverrait l'orga en haut de la fiche avec un message
 * anonyme à l'autre bout de l'écran (principes UI § 4).
 */
export async function relancerFicheAction(
  _prev: EtatRelance,
  formData: FormData,
): Promise<EtatRelance> {
  await requireOrgaId();
  if (!isMagicLinkEnabled()) {
    return echec(
      "L'envoi d'e-mails est indisponible pour le moment : préviens l'équipe technique.",
    );
  }

  // Entier strictement positif : `Number.isFinite` laissait passer 0 (la valeur
  // de `Number(null)`) et les décimaux, qui font ensuite échouer Postgres au
  // lieu de rendre ce message.
  const profileId = Number(formData.get("profileId"));
  if (!Number.isInteger(profileId) || profileId <= 0) return echec("Fiche introuvable.");

  const { relance_brouillon_jours } = await getReglages();
  // La base tranche, jamais l'écran : un onglet ouvert depuis une heure peut
  // très bien afficher un bouton pour une fiche qui a bougé entre-temps.
  const fiche = await getFicheARelancer(profileId, relance_brouillon_jours);
  if (!fiche) {
    return echec(
      "Cette fiche est déjà à jour côté relance : un message est parti récemment, ou son état a changé. Rafraîchis la page pour voir où elle en est.",
    );
  }

  try {
    await envoyerRelance(fiche);
  } catch (err) {
    console.error("Relance échouée", profileId, err);
    return echec("L'envoi a échoué. Réessaie, puis préviens l'équipe technique.");
  }
  // Après l'envoi seulement : un marquage anticipé effacerait la fiche du lot
  // alors que personne n'a rien reçu.
  await markRemindersSent([profileId]);

  revalidatePath(`/speakeuses/${profileId}`);
  revalidatePath(PAGE);
  revalidatePath("/admin/speakeuses");
  const nom = fiche.profile.name?.trim() || "cette speakeuse";
  return { status: "success", message: `Relance envoyée à ${nom}.` };
}
