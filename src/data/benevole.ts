/**
 * Texte de la page `/benevole` (2026-10-15). Les missions reprennent ce que le
 * site dit déjà ailleurs (coachs du Tremplin, jury, meetups, collège) ; la
 * gratuité de l'adhésion vient des statuts (`src/data/adhesion.ts`).
 * Textes à faire relire par le collège.
 */

export const landingBenevole = {
  cible: "Devenir bénévole chez Tech\u00A0Speak'Her",
  promesse: "Aidez des femmes de la tech à préparer leur premier talk.",
  sousPromesse: "Vous choisissez la mission et les dates.",
  questions: [
    "Vous avez déjà donné un talk, et vous auriez aimé être accompagnée la première fois.",
    "Vous savez faire des retours bienveillants sur un plan, des slides ou une répétition.",
    "Vous aimez organiser des soirées et accueillir du monde.",
  ],
  reassurance: [
    "Il suffit de savoir écouter et faire des retours bienveillants.",
  ],
  adhesion:
    "L'adhésion est gratuite pour les personnes qui interviennent bénévolement dans un programme.",
  appel: "Écrivez-nous ce que vous aimeriez faire et vos disponibilités. Nous vous répondons.",
};

export const missionsBenevoles = [
  {
    titre: "Coacher une speakeuse",
    description:
      "Aider une speakeuse à construire son plan et ses slides, puis à répéter.",
    icon: "🎤",
  },
  {
    titre: "Faire partie du jury du Tremplin",
    description:
      "Écouter les talks de la soirée Tremplin et faire un retour à chaque speakeuse, souvent en représentant aussi votre entreprise.",
    icon: "⭐",
  },
  {
    titre: "Organiser un meetup",
    description:
      "Trouver un lieu, accueillir le public et animer la soirée, avec les autres bénévoles.",
    icon: "📅",
  },
] as const;
