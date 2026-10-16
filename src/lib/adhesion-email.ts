import { dateLongueParis, escapeHtml, salutation } from "@/lib/format";
import { BASE_URL } from "@/constants/site";
import { DELAI_ADHESION } from "@/lib/adhesion";

/**
 * Les e-mails de l'annuaire réservé aux membres (cf.
 * docs/conception-adhesions-helloasso.md § 6). Fonctions pures ; l'envoi et le
 * choix des destinataires vivent dans `passe-adhesions.ts`.
 *
 * Ce sont des e-mails de SERVICE : ils annoncent un fait sur la fiche ou
 * l'adhésion de la personne, donc ils ignorent le désabonnement de la lettre
 * et le réglage de cadence des rappels — comme la modération.
 */

const ADHERER_URL = `${BASE_URL}/adherer`;

function bonjour(name: string | null): string {
  return escapeHtml(salutation(name));
}

/**
 * Le seul geste qui relie une adhésion à un compte : l'adresse du MEMBRE.
 * Placé AVANT le bouton, parce qu'on clique avant de lire la suite (revue UX
 * du 2026-10-15). Même formule que la page « Mon adhésion ».
 */
const ADRESSE = `<p>Dans le formulaire HelloAsso, dans les informations de l'adhérente (même si
   une autre personne paie), indique <strong>l'adresse à laquelle tu reçois ce message</strong>&nbsp;:
   c'est elle qui relie ton adhésion à ton compte.</p>`;

/** Le tarif et la gratuité, dans les mots des statuts (`/adherer`). */
const TARIF = `L'adhésion coûte 10&nbsp;€ par an. Elle est gratuite, sur déclaration sur
   l'honneur, pour les étudiantes, les personnes en recherche d'emploi ou en situation de
   handicap, et celles qui interviennent bénévolement dans un programme.`;

/** Ce que l'adhésion paie (`landingAdhesion.apports`, /adherer). */
const A_QUOI_ELLE_SERT = `Ton adhésion paie l'assurance, le site, les outils et nos soirées.`;

/** Le cumul des douze mois n'est vrai que pour une adhésion HelloAsso en
 *  cours : une adhésion saisie par l'équipe ou échue repart du paiement. */
const CUMUL = `Renouveler tôt est sans perte&nbsp;: les douze mois s'ajoutent à ton échéance en cours.`;

const SIGNATURE = `<p>L'équipe Tech Speak'Her</p>`;

/**
 * Le PRÉAVIS : la fiche quitte l'annuaire à `dateRetrait` si la personne n'est
 * pas à jour d'ici là. Deux situations, une date toujours : sans elle, aucune
 * pause n'est permise (`mettreFichesEnPause`).
 */
export function buildPreavisAnnuaireEmail({
  name,
  dateRetrait,
  echeance,
  cumul = false,
}: {
  name: string | null;
  dateRetrait: string;
  /** L'échéance de l'adhésion en cours, ou null sans adhésion. */
  echeance: string | null;
  /** Vrai pour une adhésion HelloAsso : le renouvellement s'ajoute. */
  cumul?: boolean;
}): { subject: string; htmlContent: string } {
  const date = dateLongueParis(dateRetrait)!;
  const situation = echeance
    ? `<p>Ton adhésion à Tech Speak'Her arrive à échéance le
         <strong>${dateLongueParis(echeance)}</strong>. Renouvelle-la avant le
         <strong>${date}</strong> pour que ta fiche speakeuse reste dans l'annuaire.${
           cumul ? ` ${CUMUL}` : ""
         }</p>`
    : `<p>L'annuaire des speakeuses est réservé aux membres de l'association. Ta fiche y
         reste jusqu'au <strong>${date}</strong>&nbsp;; pour qu'elle y soit encore ensuite, il
         suffit d'adhérer.</p>
       <p>${TARIF}</p>`;

  return {
    subject: echeance
      ? `Ta fiche dans l'annuaire\u00a0: renouvelle ton adhésion avant le ${date}`
      : `Ta fiche dans l'annuaire\u00a0: adhère avant le ${date}`,
    htmlContent: `
      <p>${bonjour(name)}</p>
      ${situation}
      ${ADRESSE}
      <p>👉 <a href="${ADHERER_URL}">${echeance ? "Renouveler mon adhésion" : "Adhérer en deux minutes"}</a></p>
      <p>Sans adhésion au ${date}, ta fiche passe en pause. Elle reste intacte dans ton
         espace. Après ${echeance ? "ton renouvellement" : "ton adhésion"}, elle revient dans
         l'annuaire ${DELAI_ADHESION}.</p>
      <p style="color:#555;font-size:13px">Ce message part une fois, avant la date&nbsp;: il
         annonce un changement sur ta fiche.</p>
      ${SIGNATURE}
    `,
  };
}

/** La RELANCE avant échéance, pour une adhérente sans fiche publiée. */
export function buildRelanceAdhesionEmail({
  name,
  echeance,
  cumul = false,
}: {
  name: string | null;
  echeance: string;
  cumul?: boolean;
}): { subject: string; htmlContent: string } {
  const date = dateLongueParis(echeance)!;
  return {
    subject: `Ton adhésion Tech Speak'Her arrive à échéance le ${date}`,
    htmlContent: `
      <p>${bonjour(name)}</p>
      <p>Ton adhésion à Tech Speak'Her arrive à échéance le <strong>${date}</strong>. Merci
         d'avoir été là cette année&nbsp;!</p>
      <p>Le renouvellement se fait sur HelloAsso, comme la première fois.${cumul ? ` ${CUMUL}` : ""}</p>
      ${ADRESSE}
      <p>👉 <a href="${ADHERER_URL}">Renouveler mon adhésion</a></p>
      <p style="color:#555;font-size:13px">Ce message part une fois par échéance.</p>
      ${SIGNATURE}
    `,
  };
}

/**
 * L'INVITATION À ADHÉRER, envoyée UNE fois aux titulaires d'une fiche en ligne
 * qui n'ont pas encore adhéré, à l'ouverture des adhésions (demande de
 * Cateline, 2026-10-15). Un message de conversion : la nouvelle d'abord (les
 * adhésions ouvrent), l'enjeu (garder sa fiche), le prix, à quoi ça sert.
 * Elle annonce la règle sans date : c'est le préavis, derrière l'interrupteur,
 * qui donnera la date, trente jours à l'avance.
 */
export function buildInvitationAdhesionEmail({ name }: { name: string | null }): {
  subject: string;
  htmlContent: string;
} {
  return {
    subject: "Les adhésions sont ouvertes\u00a0: garde ta fiche dans l'annuaire",
    htmlContent: `
      <p>${bonjour(name)}</p>
      <p>Les adhésions à Tech Speak'Her sont ouvertes. Bientôt, l'annuaire des speakeuses
         sera réservé aux membres&nbsp;: pour que ta fiche y reste, il suffit d'adhérer.</p>
      <p>${TARIF} ${A_QUOI_ELLE_SERT}</p>
      ${ADRESSE}
      <p>👉 <a href="${ADHERER_URL}">Adhérer en deux minutes</a></p>
      <p>Avant tout changement sur ta fiche, tu recevras un message avec la date, au moins
         trente jours à l'avance.</p>
      <p style="color:#555;font-size:13px">Ce message part une seule fois, parce que ta fiche
         est publiée dans l'annuaire.</p>
      ${SIGNATURE}
    `,
  };
}
