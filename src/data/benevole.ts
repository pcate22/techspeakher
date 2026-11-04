/**
 * Texte de la page `/benevole`. Les missions reprennent ce que le site dit déjà
 * ailleurs (coachs du Tremplin, jury, meetups, collège) ; la gratuité de
 * l'adhésion vient des statuts (`src/data/adhesion.ts`).
 *
 * Le coaching et le jury ont leurs conditions sur leur carte : une coach
 * accompagne une speakeuse jusqu'à la scène, elle doit donc la connaître et
 * savoir dire ce qui coince ; le jury aussi juge des talks. Le Tremplin
 * s'adresse aux primo-speakeuses, avec des conditions propres à chaque
 * édition : la réassurance oriente donc celles qui ont moins de talks vers
 * l'organisation, la communication et la scène des meetups. La FAQ de
 * `/partenaires` reprend le seuil du coaching.
 *
 * Textes à faire relire par le collège.
 */

export const landingBenevole = {
  cible: "Devenir bénévole chez Tech\u00A0Speak'Her",
  promesse: "Aidez des femmes de la tech à préparer leur premier talk.",
  sousPromesse: "Vous choisissez la mission et les dates.",
  questions: [
    "Vous avez déjà donné un talk, et vous auriez aimé être accompagnée la première fois.",
    "Vous avez donné au moins 10\u00A0talks et vous savez faire un feedback franc et constructif sur un plan, des slides ou une répétition.",
    "Vous aimez organiser des soirées et accueillir du monde.",
  ],
  reassurance: [
    "Avec moins de 10\u00A0talks, vous pouvez nous aider dans l'organisation ou la communication. Pour prendre de l'expérience sur scène, proposez un talk à nos meetups.",
  ],
  adhesion:
    "L'adhésion est gratuite pour les personnes qui interviennent bénévolement dans un programme.",
  appel:
    "Écrivez-nous ce que vous aimeriez faire et vos disponibilités. Pour le coaching, citez quelques talks que vous avez donnés. Nous vous répondons.",
};

type MissionBenevole = {
  titre: string;
  description: string;
  icon: string;
  /** Ce qu'il faut pour prendre la mission, affiché sur sa carte. */
  conditions?: string;
};

export const missionsBenevoles: readonly MissionBenevole[] = [
  {
    titre: "Coacher une speakeuse",
    description:
      "Aider une speakeuse à construire son plan et ses slides, puis à répéter.",
    conditions:
      "Pour coacher, il faut avoir donné au moins 10\u00A0talks dans plusieurs meetups et conférences (l'international est un plus), et savoir faire un feedback constructif, avec une franchise bienveillante.",
    icon: "🎤",
  },
  {
    titre: "Faire partie du jury du Tremplin",
    description:
      "Écouter les talks de la soirée Tremplin et faire un retour à chaque speakeuse, souvent en représentant aussi votre entreprise.",
    conditions:
      "Pour le jury, il faut une solide expérience de la scène ou du recrutement de speakers.",
    icon: "⭐",
  },
  {
    titre: "Organiser un meetup",
    description:
      "Trouver un lieu, accueillir le public et animer la soirée, avec les autres bénévoles.",
    icon: "📅",
  },
];
