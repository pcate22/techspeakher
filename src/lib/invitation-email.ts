import { BASE_URL } from "@/constants/site";
import { escapeHtml, salutation } from "@/lib/format";

/**
 * E-mail d'invitation de migration (« tu as la main sur ta fiche »).
 * Fonction pure (testable) ; l'envoi réel passe par sendBrevoEmail, gardé par
 * la présence de BREVO_API_KEY. L'encart orga n'est ajouté que pour les orgas.
 */
export function buildInvitationEmail({
  name,
  email,
  isOrga,
}: {
  name: string | null;
  email: string;
  isOrga: boolean;
}): { subject: string; htmlContent: string } {
  const bonjour = escapeHtml(salutation(name));
  const connexionUrl = `${BASE_URL}/connexion`;

  const encartOrga = isOrga
    ? `<p style="background:#f3f0ff;border-radius:8px;padding:12px 14px">
         🛡️ <strong>Tu fais partie de l'équipe organisatrice</strong> sur la plateforme. En plus de ta fiche, tu peux
         <strong>modérer les fiches speakeuses</strong>&nbsp;: depuis l'espace organisatrices, tu ouvres une
         fiche soumise, puis tu la publies ou la refuses (avec un motif, communiqué à la
         personne). Cet accès s'active à ta connexion&nbsp;: s'il tarde à apparaître,
         déconnecte-toi puis reconnecte-toi.
       </p>`
    : "";

  const htmlContent = `
    <p>${bonjour}</p>
    <p>On a lancé un espace en ligne pour la communauté Tech Speak'Her, et on a préparé ta
       fiche speakeuse, <strong>pré-remplie</strong> depuis les infos publiques que tu avais
       partagées.</p>
    <p><strong>Tu as la main sur tes données.</strong> Ta fiche est encore <strong>privée</strong>&nbsp;:
       connecte-toi pour la relire, la compléter ou la corriger (bio,
       secteurs &amp; sujets, talks, liens…), puis la publier. Tu peux aussi demander son
       retrait si tu préfères.</p>
    <p>👉 <a href="${connexionUrl}">Connecte-toi ici</a> avec <strong>${escapeHtml(email)}</strong>,
       via Google, LinkedIn ou un lien envoyé par e-mail.</p>
    ${encartOrga}
    <p><strong>Les adhésions sont ouvertes.</strong> L'annuaire va devenir réservé aux membres de
       l'association&nbsp;: pour que ta fiche y paraisse, <a href="${BASE_URL}/adherer">adhère sur le site</a>.
       C'est 10&nbsp;€ par an, ou gratuit sur déclaration sur l'honneur. Dans le formulaire
       HelloAsso, dans les informations de l'adhérente, indique l'adresse à laquelle tu reçois
       ce message&nbsp;: c'est elle qui relie ton adhésion à ton compte.</p>
    <p style="color:#555;font-size:13px">Quelques garanties&nbsp;: hébergement en Europe (RGPD), ton
       e-mail et ton téléphone restent privés (le contact passe par le formulaire du site ou
       ton LinkedIn). Le code du site est public.</p>
    <p>Merci de faire vivre la communauté, et au plaisir de te voir sur scène&nbsp;!</p>
    <p>L'équipe Tech Speak'Her</p>
  `;

  return {
    subject: "Ton profil speakeuse Tech Speak'Her, tu as la main 🎤",
    htmlContent,
  };
}
