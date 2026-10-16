import { NextResponse } from "next/server";
import { invaliderAnnuaireDiffere } from "@/lib/annuaire-cache";
import { getProfilesDueForReminder, markRemindersSent } from "@/lib/profiles";
import { passeConservation } from "@/lib/passe-conservation";
import { passeAdhesions } from "@/lib/passe-adhesions";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getMessagesToNotify, markMessagesNotified } from "@/lib/contact-message";
import { getReglages } from "@/lib/reglages";
import { sendBrevoEmail } from "@/lib/email";
import { buildRappelFicheEmail } from "@/lib/rappel-fiche-email";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { chargerTachesAssociation } from "@/lib/taches-chargement";
import { reclameUnGeste } from "@/lib/taches";
import { synchroniserComptes } from "@/lib/brevo-contacts";
import { CONTACT_EMAIL } from "@/constants/site";
import {
  buildOrgaDigestEmail,
  buildSpeakeuseDigestEmail,
} from "@/lib/digest-email";

export const dynamic = "force-dynamic";

/**
 * Cron de NOTIFICATIONS quotidien (17h). Un seul job (Vercel Hobby plafonne le
 * nombre de crons) qui regroupe :
 *   1. le rappel semestriel des fiches publiées ;
 *   2. le digest orga (l'agrégat du moteur de tâches) ;
 *   3. le digest speakeuse (messages transmis, extrait seulement) ;
 *   4. les adhésions HelloAsso (rattrapage, et la règle de l'annuaire
 *      derrière FLAG_ADHESIONS) ;
 *   5. la conservation des comptes (avertir, puis supprimer) ;
 *   6. la synchro des contacts vers Brevo (liste de la lettre d'information).
 * Rien n'est envoyé si rien n'est en attente. Protégé par CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Rappel semestriel ──────────────────────────────────────────────
  const reglages = await getReglages();
  const due = await getProfilesDueForReminder(reglages.rappel_fiche_jours);
  const remindersSent: number[] = [];
  let remindersFailed = 0;
  for (const p of due) {
    try {
      await sendBrevoEmail({
        to: p.email,
        toName: p.name ?? undefined,
        ...buildRappelFicheEmail(),
      });
      remindersSent.push(p.id);
    } catch (err) {
      remindersFailed++;
      console.error("Rappel échoué", p.id, err);
    }
  }
  await markRemindersSent(remindersSent);

  // ── 2. Digest orga : UN CANAL DU MOTEUR (étape C) ────────────────────
  // La porte du cron (`chargerTachesAssociation`, sans session — sa garde est
  // CRON_SECRET, en tête de cette fonction), puis l'agrégat : l'e-mail lit la
  // MÊME dérivation que l'écran et n'en publie que des comptes par règle.
  // Avant, il recomptait deux choses dans son coin quand le moteur en dérive
  // une dizaine — une seconde définition de « à faire », qui imprimait en
  // plus « 0 fiche à valider » dès que l'autre ligne était non nulle.
  // Des compteurs, et l'erreur en toutes lettres si le moteur tombe — le
  // même contrat que la synchro Brevo plus bas : un `{ taches: 0 }` muet
  // serait indiscernable de « rien à faire ».
  const orgaDigest: { taches: number; sent: boolean; erreur?: string } = {
    taches: 0,
    sent: false,
  };
  try {
    const { taches } = await chargerTachesAssociation();
    orgaDigest.taches = taches.filter(reclameUnGeste).length;
    // `null` = rien à envoyer : aucune ligne ne réclame un geste — les
    // constats en sont, et le contrat est tenu par le compilateur.
    const digest = buildOrgaDigestEmail(taches);
    if (digest) {
      await sendBrevoEmail({ to: CONTACT_EMAIL, ...digest });
      orgaDigest.sent = true;
    }
  } catch (err) {
    console.error("Digest orga échoué", err);
    orgaDigest.erreur = err instanceof Error ? err.message : String(err);
  }

  // ── 3. Digest speakeuse (messages transmis, 1 e-mail par destinataire) ─
  // Regroupé par PROFIL (pas par e-mail) : `users.email` n'est pas garanti
  // unique, on évite qu'un digest ne mélange les messages de deux comptes.
  const toNotify = await getMessagesToNotify();
  const byProfile = new Map<
    number,
    {
      email: string;
      name: string | null;
      messages: { motif: string; body: string }[];
      ids: number[];
    }
  >();
  for (const m of toNotify) {
    const entry = byProfile.get(m.profileId) ?? {
      email: m.email,
      name: m.name,
      messages: [],
      ids: [],
    };
    entry.messages.push({ motif: m.motif, body: m.body });
    entry.ids.push(m.id);
    byProfile.set(m.profileId, entry);
  }

  const notifiedIds: number[] = [];
  let speakeuseDigestsSent = 0;
  let speakeuseDigestsFailed = 0;
  for (const entry of byProfile.values()) {
    try {
      const { subject, textContent } = buildSpeakeuseDigestEmail({
        name: entry.name,
        messages: entry.messages,
      });
      await sendBrevoEmail({
        to: entry.email,
        toName: entry.name ?? undefined,
        subject,
        textContent,
      });
      notifiedIds.push(...entry.ids);
      speakeuseDigestsSent++;
    } catch (err) {
      speakeuseDigestsFailed++;
      console.error("Digest speakeuse échoué", entry.email, err);
    }
  }
  // On ne marque notifiés QUE les messages effectivement envoyés (réessai sinon).
  await markMessagesNotified(notifiedIds);

  // ── 4. Adhésions HelloAsso ───────────────────────────────────────────
  // Rattrapage (relit tout HelloAsso : une notification perdue ou un
  // remboursement se rattrapent ici), puis la règle de l'annuaire réservé aux
  // membres, derrière l'interrupteur. AVANT la conservation : une adhésion du
  // jour protège le compte dès ce soir. Ne lève jamais ; invalide l'annuaire
  // elle-même quand une fiche bouge. Cf. docs/conception-adhesions-helloasso.md.
  const adhesions = await passeAdhesions({ actif: isFeatureEnabled("adhesions") });
  // Le bilan, en COMPTEURS seulement (aucune adresse, aucun nom), dans les
  // logs Vercel : quand Vercel lance le cron, sa réponse JSON n'est lue par
  // personne. C'est ici qu'on voit si une adhésion s'est reliée (`comptes`) ou
  // si son adresse de membre n'a trouvé aucun compte (`sansCompte`).
  console.info(`[adhesions] ${JSON.stringify(adhesions)}`);

  // ── 5. Conservation des comptes : avertir, puis supprimer ────────────
  // Limitation de la conservation (RGPD art. 5-1-e). Toute la règle vit dans
  // `passeConservation` : c'est la seule section irréversible, elle mérite d'être
  // rejouable ailleurs qu'à travers une requête HTTP. Elle ne lève jamais — une
  // base indisponible ici ne doit pas emporter la synchro Brevo qui suit.
  const conservation = await passeConservation();
  // La passe peut supprimer un compte à fiche publiée : l'annuaire expire en
  // différé (cron = route handler, updateTag interdit).
  invaliderAnnuaireDiffere();

  // ── 6. Synchro des contacts vers Brevo (lettre d'information) ─────────
  // Une fiche publiée hier, une adhésion, un désabonnement : les étiquettes de
  // ciblage se périment tous les jours. La synchro repasse donc ici, où le cron
  // quotidien vit déjà (Vercel plafonne le nombre de crons), et le bouton de
  // l'écran orga reste là pour ne pas attendre 17 h.
  //
  // BEST-EFFORT, en dernier et dans son propre try : un incident chez Brevo ne
  // doit jamais empêcher les digests de partir, qui eux relèvent du service.
  let sync: { contacts: number; ignore?: string; erreur?: string };
  try {
    sync = await synchroniserComptes();
  } catch (err) {
    console.error("Synchro Brevo (cron) échouée", err);
    sync = { contacts: 0, erreur: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    brevoSync: sync,
    reminders: { due: due.length, sent: remindersSent.length, failed: remindersFailed },
    orgaDigest,
    speakeuseDigests: {
      recipients: byProfile.size,
      sent: speakeuseDigestsSent,
      failed: speakeuseDigestsFailed,
    },
    // Des COMPTEURS, jamais des noms : l'art. 5-2 demande de démontrer le
    // processus, pas de garder la liste des personnes supprimées — un journal
    // nominatif annulerait la suppression.
    conservation,
    adhesions,
  });
}
