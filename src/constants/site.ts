/** Centralized site-wide constants */

export const BASE_URL = "https://techspeakher.fr";
/** Boîte où ARRIVENT les messages (destinataire / reply-to). */
export const CONTACT_EMAIL = "techspeakher@gmail.com";
/**
 * Adresse EXPÉDITRICE des e-mails (contact, lien magique). Doit être un domaine
 * validé dans Brevo (SPF/DKIM) — gmail.com est impossible comme expéditeur.
 * Surchargeable via AUTH_EMAIL_FROM.
 */
export const EMAIL_SENDER = "contact@techspeakher.fr";
export const TREMPLIN_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScvlFLuHY23OR_AVWGxEXJusWxWdoWd9VPwLS4AmFJAfgwQaw/viewform";
export const SOIREE_TREMPLIN_URL =
  "https://the-playground.fr/m/soiree-tremplin-tech-speak-her-x-devfest-toulouse";
export const LINKEDIN_URL = "https://www.linkedin.com/company/tech-speak-her/";
/**
 * Chaîne YouTube : replay des soirées Tremplin, interviews Behind the Scenes,
 * talks filmés des speakeuses. Les vidéos se déclarent dans `src/data/videos.ts`.
 */
export const YOUTUBE_URL = "https://www.youtube.com/@TechSpeakHer";
export const MEETUP_URL = "https://www.meetup.com/gdg-toulouse/";
export const GDG_TOULOUSE_URL = "https://gdg.community.dev/gdg-toulouse/";
// Aucune URL de billetterie ici : les actions du site restent internes,
// cf. docs/google-ad-grants.md.

// Clé IndexNow : NE PAS la coder en dur ici. Elle est lue depuis l'environnement
// (`process.env.INDEXNOW_KEY`) dans `src/app/api/indexnow/route.ts`, et doit
// correspondre au fichier de vérification public `public/<clé>.txt`.
// (Bing, Yandex, Seznam… participent à IndexNow ; Brave a un index indépendant.)

/**
 * Formulaire d'adhésion HelloAsso. VIDE tant que le formulaire n'est pas vérifié
 * et que les PV de l'AGE du 29 septembre 2026 ne sont pas signés : `/adherer`
 * masque alors son bouton et reste hors index (le PV du collège interdit
 * d'ouvrir les adhésions avant). À remplir avec l'URL de la campagne publiée.
 * La campagne « Soutien : membres bienfaitrices » est distincte : ce n'est pas
 * une adhésion.
 */
export const HELLOASSO_ADHESION_URL: string =
  "https://www.helloasso.com/associations/tech-speak-her/adhesions/adhesion";

/** Campagne « Soutien : membres bienfaitrices » (100 € minimum) : PAS une adhésion. */
export const HELLOASSO_SOUTIEN_URL =
  "https://www.helloasso.com/associations/tech-speak-her/adhesions/soutien-membres-bienfaitrices-pas-une-adhesion";
