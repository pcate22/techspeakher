/**
 * Texte de la page `/adherer`, rédigé le 13 octobre 2026 d'après les statuts
 * adoptés par l'AGE du 29 septembre 2026 et le règlement intérieur 1.0.
 * Les montants et les règles (vote, reçu fiscal) viennent de ces textes : ils
 * ne se changent pas ici sans une décision du collège.
 */

export const introAdhesion =
  "Toute personne majeure qui partage nos valeurs peut adhérer. L'adhésion se fait uniquement sur HelloAsso, ni par message, ni en espèces, ni par chèque.";

export const tarifsAdhesion: string[] = [
  "L'adhésion individuelle coûte 10 € par an, avec un montant libre au-delà.",
  "Elle est gratuite, sur déclaration sur l'honneur, pour les étudiantes, les personnes en recherche d'emploi ou en situation de handicap, et celles qui interviennent bénévolement dans un programme. Nous ne demandons ni motif ni justificatif.",
  "Les entreprises et les organisations nous soutiennent comme membres bienfaitrices, à partir de 100 €, avec un formulaire séparé. Ce n'est pas une adhésion.",
];

export const aSavoirAdhesion: string[] = [
  "L'adhésion n'ouvre pas le droit de vote en assemblée générale, réservé aux membres du collège.",
  "En adhérant, vous acceptez le règlement intérieur et le code de conduite.",
  "Le groupe de messagerie est réservé aux femmes dont l'adhésion est active. Il fonctionne sur WhatsApp, qui traite vos données pour son propre compte et peut les transférer hors de l'Union européenne. Votre numéro y sera visible des autres participantes. Il reste facultatif : laissez le champ vide si vous ne voulez pas rejoindre le groupe. Les informations utiles à la vie de l'association vous arrivent aussi par courriel.",
  "Les dons ne donnent pas droit à un reçu fiscal pour le moment.",
];

/**
 * LANDING (2026-10-15, grille Scalezia, revue d'Audrey Jargot du 06/10) : la
 * cible au-dessus de la promesse, des questions « oui », la réassurance, puis
 * la demande. Ces textes-là ne viennent pas des statuts : à faire relire par
 * le collège. Ce que l'adhésion apporte ne cite que ce que les statuts et le
 * « à savoir » ci-dessus disent déjà.
 */
export const landingAdhesion = {
  cible: "Adhérer à Tech\u00A0Speak'Her",
  promesse: "Rejoignez une communauté de femmes de la tech qui prennent la parole en conférence.",
  sousPromesse:
    "L'adhésion coûte 10\u00A0€ par an, ou rien selon votre situation. Elle paie les frais de fonctionnement de l'association.",
  questions: [
    "Vous aimeriez prendre la parole en conférence, un jour.",
    "Vous cherchez d'autres femmes de la tech avec qui échanger.",
    "Vous voulez voir plus de femmes sur les scènes tech.",
  ],
  reassurance: [
    "Beaucoup de femmes de la tech hésitent à monter sur scène. Nos meetups et le programme Tremplin les aident à préparer un premier talk.",
  ],
  apports: [
    {
      titre: "Le groupe des adhérentes",
      description: "Un groupe de messagerie réservé aux femmes adhérentes. Vous le rejoignez si vous le souhaitez.",
    },
    {
      titre: "La vie de l'association",
      description: "Vous recevez par courriel les dates des événements, les nouvelles du Tremplin et les appels à bénévoles.",
    },
    {
      titre: "Les frais de l'association",
      description: "Votre adhésion paie l'assurance, le site web, les outils, les affiches, les déplacements et nos soirées.",
    },
  ],
  appel: "L'adhésion se fait en ligne, sur HelloAsso.",
  // Le seul geste qui relie une adhésion à un compte de la plateforme : la
  // synchro rapproche par l'adresse du MEMBRE (docs/conception-adhesions-helloasso.md).
  // La consigne d'adresse ET le délai validé par Cateline (2026-10-15), en
  // un paragraphe : les deux ne concernent que celles qui ont un compte. Le
  // délai reprend mot pour mot DELAI_ADHESION (src/lib/adhesion.ts).
  adresseCompte:
    "Vous avez un compte sur la plateforme\u00A0? Dans le formulaire HelloAsso, indiquez l'adresse e-mail de ce compte dans les informations de l'adhérente. Votre espace affiche alors votre adhésion dans quelques minutes, et au plus tard le lendemain.",
};
