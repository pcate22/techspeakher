import { helloassoConfig, lireCommande, listerAdhesions } from "@/lib/helloasso";
import { synchroniserAdhesions, type BilanSynchro, type ResultatSynchro } from "@/lib/adhesions";
import { enregistrerBilanAdhesions, type OrigineSynchro } from "@/lib/bilan-adhesions";
import {
  adherentesARelancer,
  fichesAPrevenir,
  leverLesPauses,
  marquerPreavis,
  marquerRelance,
} from "@/lib/annuaire-adhesion";
import { dansJours, PREAVIS_ANNUAIRE_JOURS } from "@/lib/adhesion";
import { mettreFichesEnPause } from "@/lib/profiles";
import { buildPreavisAnnuaireEmail, buildRelanceAdhesionEmail } from "@/lib/adhesion-email";
import { sendBrevoEmail } from "@/lib/email";
import { invaliderAnnuaireDiffere } from "@/lib/annuaire-cache";

/**
 * Les adhésions HelloAsso, côté automates : la passe quotidienne (cron) et le
 * traitement d'une notification. Conception : docs/conception-adhesions-helloasso.md.
 *
 * Dans une lib et pas dans la route, comme la passe de conservation : c'est un
 * enchaînement dont l'ORDRE porte la règle (synchroniser, PUIS juger), et qui
 * se rejoue ici sans passer par HTTP.
 */

export const synchroReussie = (s: ResultatSynchro): s is BilanSynchro =>
  typeof s === "object" && !("erreur" in s);

/**
 * Relit TOUT HelloAsso, l'écrit en base, et GARDE le bilan du passage
 * (`bilan-adhesions.ts`, lu par la page orga « Adhésions ») : Vercel ne garde
 * qu'une heure de logs. Ne lève jamais : l'échec se dit dans le résultat.
 * Partagée par le cron, la notification, l'invitation et le bouton orga.
 */
export async function synchroniserDepuisHelloAsso(
  maintenant: Date,
  origine: OrigineSynchro,
): Promise<ResultatSynchro> {
  const resultat = await synchroniser(maintenant);
  await enregistrerBilanAdhesions(resultat, origine, maintenant);
  return resultat;
}

async function synchroniser(maintenant: Date): Promise<ResultatSynchro> {
  const cfg = helloassoConfig();
  if (!cfg) return "non_configuree";
  try {
    return await synchroniserAdhesions(await listerAdhesions(cfg), maintenant);
  } catch (err) {
    console.error("Synchro des adhésions HelloAsso échouée", err);
    return { erreur: err instanceof Error ? err.message : String(err) };
  }
}

interface Envois {
  aEnvoyer: number;
  envoyes: number;
  echecs: number;
}

/** Ce que le cron rapporte : des COMPTEURS, jamais des noms. */
export interface RapportAdhesions {
  synchro: ResultatSynchro;
  /** `suspendue` : interrupteur allumé, mais la synchro a échoué ou manque. */
  regle: "eteinte" | "active" | "suspendue";
  preavis: Envois;
  pauses: number;
  relances: Envois;
  pausesLevees: number;
  erreur?: string;
}

/**
 * La passe quotidienne. Elle ne LÈVE jamais : une panne ici ne doit emporter
 * ni les digests ni la conservation, ses voisines dans le cron.
 *
 * La règle de l'annuaire (préavis, pause, relance) ne tourne que si
 * l'interrupteur est allumé **et** que la synchro de ce passage a réussi.
 * Une synchro en panne ou absente ferait paraître toutes les membres sans
 * adhésion : juger sur elle enverrait des préavis faux, puis mettrait en pause
 * des fiches de personnes à jour.
 */
export async function passeAdhesions({
  actif,
  maintenant = new Date(),
}: {
  actif: boolean;
  maintenant?: Date;
}): Promise<RapportAdhesions> {
  const rapport: RapportAdhesions = {
    synchro: "non_configuree",
    regle: actif ? "active" : "eteinte",
    preavis: { aEnvoyer: 0, envoyes: 0, echecs: 0 },
    pauses: 0,
    relances: { aEnvoyer: 0, envoyes: 0, echecs: 0 },
    pausesLevees: 0,
  };

  try {
    rapport.synchro = await synchroniserDepuisHelloAsso(maintenant, "cron");

    if (!actif) {
      rapport.pausesLevees = await leverLesPauses();
    } else if (!synchroReussie(rapport.synchro)) {
      rapport.regle = "suspendue";
    } else {
      // 1. Préavis : l'e-mail d'abord, la date ensuite. C'est la date qui
      //    autorise la pause ; un envoi raté la laisse vide, et le préavis
      //    repart au passage suivant.
      const retraitLe = dansJours(maintenant, PREAVIS_ANNUAIRE_JOURS);
      const aPrevenir = await fichesAPrevenir(maintenant);
      rapport.preavis.aEnvoyer = aPrevenir.length;
      for (const f of aPrevenir) {
        try {
          const mail = buildPreavisAnnuaireEmail({
            name: f.name,
            dateRetrait: retraitLe.toISOString(),
            echeance: f.expiresAt,
            cumul: f.cumul,
          });
          await sendBrevoEmail({ to: f.email, toName: f.name ?? undefined, ...mail });
          await marquerPreavis(f.profileId, retraitLe);
          rapport.preavis.envoyes++;
        } catch (err) {
          rapport.preavis.echecs++;
          console.error("Préavis d'annuaire échoué", f.profileId, err);
        }
      }

      // 2. Pause, à la date annoncée (les conditions vivent dans le SQL).
      rapport.pauses = await mettreFichesEnPause(maintenant);

      // 3. Relance avant échéance.
      const aRelancer = await adherentesARelancer(maintenant);
      rapport.relances.aEnvoyer = aRelancer.length;
      for (const a of aRelancer) {
        try {
          const mail = buildRelanceAdhesionEmail({
            name: a.name,
            echeance: a.expiresAt,
            cumul: a.cumul,
          });
          await sendBrevoEmail({ to: a.email, toName: a.name ?? undefined, ...mail });
          await marquerRelance(a.userId, maintenant);
          rapport.relances.envoyes++;
        } catch (err) {
          rapport.relances.echecs++;
          console.error("Relance d'adhésion échouée", a.userId, err);
        }
      }
    }
  } catch (err) {
    console.error("Passe des adhésions (cron) échouée", err);
    rapport.erreur = err instanceof Error ? err.message : String(err);
  }

  const reprises = synchroReussie(rapport.synchro) ? rapport.synchro.fichesReprises : 0;
  if (reprises + rapport.pauses + rapport.pausesLevees > 0) invaliderAnnuaireDiffere();
  return rapport;
}

/**
 * L'identifiant de commande d'une notification `Order`, et RIEN d'autre : le
 * reste du corps n'est pas lu. Les `Payment` sont ignorés : HelloAsso envoie
 * aussi un `Order` pour chaque commande (gratuite comprise), et traiter les
 * deux lançait deux synchros complètes pour une adhésion. Un remboursement
 * (un `Payment`) se rattrape au cron du soir.
 */
function identifiantDeCommande(corps: unknown): number | null {
  const c = corps as { eventType?: unknown; data?: { id?: unknown } };
  const brut = c?.eventType === "Order" ? c.data?.id : undefined;
  return typeof brut === "number" && Number.isSafeInteger(brut) && brut > 0 ? brut : null;
}

/**
 * Une notification HelloAsso. Elle n'est pas signée : on n'en croit que
 * l'identifiant de commande, on relit la commande par l'API, et seule une
 * commande d'adhésion déclenche la synchro (de tout l'historique : un seul
 * calcul pour la notification et le rattrapage, donc aucun écart entre eux).
 */
export async function traiterNotificationHelloAsso(
  corps: unknown,
): Promise<"synchronisee" | "ignoree" | "non_configuree"> {
  const cfg = helloassoConfig();
  if (!cfg) return "non_configuree";
  const orderId = identifiantDeCommande(corps);
  if (orderId === null) return "ignoree";
  const adhesions = await lireCommande(orderId, cfg);
  if (adhesions.length === 0) return "ignoree";
  const synchro = await synchroniserDepuisHelloAsso(new Date(), "notification");
  // Un échec LÈVE : la route répond 500 (le rattrapage du soir reprendra).
  if (synchro === "non_configuree") return "non_configuree";
  if (!synchroReussie(synchro)) throw new Error(synchro.erreur);
  if (synchro.fichesReprises > 0) invaliderAnnuaireDiffere();
  return "synchronisee";
}
