import { BASE_URL } from "@/constants/site";
import { dateLongueFr, escapeHtml, salutation } from "@/lib/format";

/**
 * CONSERVATION DES COMPTES (RGPD art. 5-1-e) — cf.
 * `docs/conception-conservation-comptes.md`.
 *
 * Un compte sans signe de vie depuis `DUREE_INACTIVITE_JOURS` reçoit un
 * avertissement, puis est supprimé s'il ne se réveille pas dans les
 * `PREAVIS_SUPPRESSION_JOURS` qui suivent.
 *
 * Brique PURE : les durées, le texte, et rien d'autre. Qui entre dans le champ
 * vit dans les clauses `WHERE` de `comptes-inactifs.ts`.
 */

/**
 * Deux ans sans signe de vie. Le RGPD n'écrit aucune durée : c'est un CHOIX de
 * l'association, plus strict que le repère CNIL des trois ans (qui vise les
 * prospects, pas les membres). Il n'a de valeur que publié et appliqué.
 *
 * Ces durées ne sont PAS des réglages d'écran, exprès : elles sont publiées dans
 * les mentions légales, qui lisent ces mêmes constantes. Une orga qui changerait
 * le délai dans `/admin` ferait mentir la notice sans le savoir. Les changer est
 * un geste délibéré — code, doc et notice dans le même commit.
 */
export const DUREE_INACTIVITE_JOURS = 730;

/** Le préavis. Assez pour réagir, assez court pour que la règle veuille dire
 *  quelque chose (un compte averti qu'on ne supprime jamais est pire que pas de
 *  politique du tout : l'apparence de la conformité, sans la substance). */
export const PREAVIS_SUPPRESSION_JOURS = 30;

/**
 * Durée de VALIDITÉ d'un avertissement. Au-delà, il est périmé : le compte
 * repart dans la file d'avertissement au lieu d'être supprimé.
 *
 * Sans cette borne, un compte qui sort du champ autrement qu'en se réveillant
 * (une adhésion saisie par une orga, un rôle accordé) puis y revient garderait
 * une annonce vieille de deux ans — et serait supprimé au premier passage du
 * cron, sans aucun préavis. La borne referme cette porte SANS exiger qu'on
 * pense à nettoyer la colonne à chaque changement d'état ailleurs.
 */
export const VALIDITE_AVERTISSEMENT_JOURS = 90;

/** Écriture au plus hebdomadaire de `last_seen_at` : le callback jwt tourne à
 *  chaque rafraîchi de jeton, on ne va pas écrire en base à chaque page. La
 *  précision d'une semaine est sans effet sur une échéance de deux ans. */
export const PAS_SIGNE_DE_VIE_JOURS = 7;

/** « 2 ans » plutôt que « 730 jours » : la notice s'adresse à des personnes. */
export function dureeEnAns(jours: number): string {
  const ans = Math.round(jours / 365);
  return ans > 1 ? `${ans} ans` : "1 an";
}

/**
 * LA DATE DU COUPERET, écrite ici et pas chez l'appelant : le préavis, la date
 * annoncée et le texte qui la porte sont une seule connaissance. Le jour où le
 * préavis se comptera depuis `suppression_annoncee_le` plutôt que depuis
 * aujourd'hui, la règle bouge ici — pas dans une route HTTP, où elle vivait
 * jusque-là sous la forme d'un « il y a moins trente jours ».
 */
export function dateSuppressionPrevue(maintenant: number = Date.now()): string {
  return dateLongueFr(
    new Date(maintenant + PREAVIS_SUPPRESSION_JOURS * 86_400_000).toISOString(),
  ) ?? "";
}

/**
 * L'avertissement. Il doit tenir en une lecture et dire QUATRE choses : ce qui
 * va se passer, QUAND, comment l'annuler, et ce qui survivra malgré tout.
 *
 * Un seul geste demandé, et le plus petit possible : **se connecter suffit**.
 * Demander de « confirmer » ou de « cliquer pour conserver » ferait dépendre un
 * compte d'un clic dans un e-mail que les filtres peuvent avaler.
 */
export function buildSuppressionEmail({
  name,
  dateSuppression,
}: {
  name: string | null;
  /** Date lisible (« 14 septembre 2026 »), calculée par l'appelant. */
  dateSuppression: string;
}): { subject: string; htmlContent: string } {
  const bonjour = escapeHtml(salutation(name));

  return {
    subject: "Ton compte Tech Speak'Her va être supprimé 🗓️",
    htmlContent: `
      <p>${bonjour}</p>
      <p>Ton compte Tech Speak'Her est resté sans activité depuis
         <strong>${dureeEnAns(DUREE_INACTIVITE_JOURS)}</strong>. On conserve les données
         d'un compte le temps qu'il sert, et pas au-delà&nbsp;: le tien est donc programmé
         pour suppression le <strong>${dateSuppression}</strong>.</p>
      <p><strong>Pour le garder, il suffit de te connecter</strong> avant cette date. Rien
         d'autre à faire, et le compte à rebours repart de zéro.</p>
      <p>👉 <a href="${BASE_URL}/connexion">Me connecter</a></p>
      <p>Si tu préfères en rester là, laisse faire&nbsp;: à la date indiquée, ta fiche,
         tes talks, tes messages reçus et ton compte seront effacés définitivement. Seules
         restent les archives d'un événement passé auquel tu as participé publiquement
         (palmarès du Tremplin), réduites au strict nécessaire et retirables sur demande.</p>
      <p style="color:#555;font-size:13px">Ce message part une fois, avant l'échéance&nbsp;: il
         annonce un acte irréversible sur ton compte, il échappe donc au réglage des
         rappels de fiche. Tu peux aussi
         <a href="${BASE_URL}/mon-espace/supprimer">supprimer ton compte tout de suite</a>.</p>
      <p>L'équipe Tech Speak'Her</p>
    `,
  };
}
