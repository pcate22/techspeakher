import { supprimerCompte } from "@/lib/suppression-compte";
import {
  comptesAAvertir,
  comptesASupprimer,
  marquerAvertissement,
} from "@/lib/comptes-inactifs";
import { buildSuppressionEmail, dateSuppressionPrevue } from "@/lib/conservation-comptes";
import { sendBrevoEmail } from "@/lib/email";

/**
 * LA PASSE DE CONSERVATION : avertir, puis supprimer (RGPD art. 5-1-e, cf.
 * `docs/conception-conservation-comptes.md`).
 *
 * Dans une lib et pas dans la route du cron, alors que les digests y sont
 * restés : c'est la seule section qui compose plusieurs lectures, dans un ORDRE
 * qui compte, avec un plafond et un effet IRRÉVERSIBLE au bout. Une route HTTP
 * ne s'éprouve qu'à travers `GET()` et six modules simulés ; ici, l'enchaînement
 * « averti d'abord, supprimé un préavis plus tard » se rejoue directement. Même
 * découpe que `synchroniserComptes()`, la section voisine.
 */

/** Ce que le cron rapporte : des COMPTEURS, jamais des noms. L'art. 5-2 demande
 *  de démontrer le PROCESSUS ; garder la liste des personnes supprimées
 *  annulerait la suppression qu'on vient de faire. */
export interface RapportConservation {
  aAvertir: number;
  avertis: number;
  avertissementsEchoues: number;
  restantAAvertir: number;
  /** Comptes DUS à la suppression ce jour-là (avant plafond). */
  aSupprimer: number;
  supprimes: number;
  /** Suppressions tentées et échouées : sans ce compteur, un jour où tout
   *  échoue se lit exactement comme un jour sans personne à supprimer. */
  suppressionsEchouees: number;
  /** Ce qu'il reste à faire : les dus moins les faits — donc le report du
   *  plafond ET les échecs, qui reviendront demain. */
  restantASupprimer: number;
  erreur?: string;
}

/**
 * Plafond d'avertissements ET de suppressions par passage. Le cron tourne tous
 * les jours : une file plus longue se draine d'elle-même, et le compte-rendu dit
 * combien il reste (une troncature silencieuse se lirait « tout est fait »).
 *
 * La migration horodate toute la base le même jour : dans deux ans, une cohorte
 * entière devient dormante d'un coup. Sans plafond, un seul passage tenterait
 * des milliers d'envois et serait coupé en route.
 */
export const LOT_CONSERVATION = 200;

/**
 * Une passe complète. Elle ne LÈVE jamais : une base indisponible ici ne doit
 * emporter ni les digests déjà partis, ni la synchro Brevo qui suit — l'incident
 * part dans le compte-rendu, sous forme de message.
 *
 * L'avertissement IGNORE le réglage de cadence des rappels, exprès : un rappel
 * pousse et se règle, une notification annonce un fait — et celle-ci annonce la
 * disparition prochaine du compte. La couper au motif qu'on a refusé les rappels
 * supprimerait des comptes en silence, le contraire du but. C'est écrit ici, à
 * l'endroit de l'envoi, pour que personne ne l'« harmonise » un jour.
 */
export async function passeConservation(
  lot: number = LOT_CONSERVATION,
): Promise<RapportConservation> {
  const rapport: RapportConservation = {
    aAvertir: 0,
    avertis: 0,
    avertissementsEchoues: 0,
    restantAAvertir: 0,
    aSupprimer: 0,
    supprimes: 0,
    suppressionsEchouees: 0,
    restantASupprimer: 0,
  };

  try {
    // 1. AVERTIR — et dans cet ordre, jamais l'inverse : la suppression du jour
    //    ne concerne que des comptes avertis il y a plus d'un préavis.
    const aAvertir = await comptesAAvertir();
    rapport.aAvertir = aAvertir.length;
    const dateSuppression = dateSuppressionPrevue();

    for (const c of aAvertir.slice(0, lot)) {
      try {
        const { subject, htmlContent } = buildSuppressionEmail({
          name: c.name,
          dateSuppression,
        });
        await sendBrevoEmail({ to: c.email, toName: c.name ?? undefined, subject, htmlContent });
        // Marquage IMMÉDIAT, compte par compte : un passage coupé en route (le
        // délai d'exécution de la fonction) perdrait sinon la trace de tout ce
        // qui est déjà parti, et le lendemain réécrirait aux mêmes personnes.
        // Sur les SEULS envois réussis : un incident Brevo ferait autrement
        // courir un préavis que personne n'a reçu.
        await marquerAvertissement(c.id);
        rapport.avertis++;
      } catch (err) {
        rapport.avertissementsEchoues++;
        console.error("Avertissement de suppression échoué", c.id, err);
      }
    }
    // Ce qui RESTE, mesuré sur ce qui a été fait — jamais sur le plafond seul :
    // un lot où tout échoue laisse autant à faire qu'au début, et l'annoncer à
    // zéro se lirait « tout est fait ».
    rapport.restantAAvertir = aAvertir.length - rapport.avertis;

    // 2. SUPPRIMER — avertis il y a plus que le préavis, et toujours dormants.
    const aSupprimer = await comptesASupprimer();
    rapport.aSupprimer = aSupprimer.length;
    for (const c of aSupprimer.slice(0, lot)) {
      try {
        // `supprimerCompte` tranche déjà finement ce qui survit (palmarès public
        // figé, inscriptions privées anonymisées, consentements de phase
        // révoqués) et efface le contact chez Brevo. Une seconde voie de
        // suppression divergerait de la première.
        await supprimerCompte(c.id);
        rapport.supprimes++;
      } catch (err) {
        // Compté, jamais seulement journalisé : un échec muet rendait
        // `{supprimes: 0, restantASupprimer: 0}`, indiscernable d'un jour sans
        // personne à supprimer — pendant que le compte repassait dans la file
        // d'avertissement 90 jours plus tard pour un SECOND « ton compte va
        // être supprimé le … », d'une suppression échouée en silence.
        rapport.suppressionsEchouees++;
        console.error("Suppression pour inactivité échouée", c.id, err);
      }
    }
    rapport.restantASupprimer = aSupprimer.length - rapport.supprimes;
  } catch (err) {
    console.error("Conservation des comptes (cron) échouée", err);
    rapport.erreur = err instanceof Error ? err.message : String(err);
  }

  return rapport;
}
