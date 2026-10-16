/**
 * Code de conduite de Tech Speak'Her : annexe 1 du règlement intérieur
 * (article 22), source unique de la page `/code-de-conduite`.
 *
 * Ce texte est ADOPTÉ par le collège avec le règlement intérieur : il se
 * recopie mot pour mot, il ne se reformule pas. Le modifier ici sans une
 * nouvelle version du règlement ferait publier un texte que personne n'a voté.
 * Toute modification change donc aussi `VERSION_CODE_DE_CONDUITE`.
 *
 * L'adresse publiée dans le règlement est techspeakher.fr/charte : la
 * redirection `/charte` → `/code-de-conduite` de `next.config.ts` la tient en
 * vie (gardée par `e2e/contrat-http.spec.ts`).
 */

export const VERSION_CODE_DE_CONDUITE = {
  numero: "1.0",
  date: "29 septembre 2026",
} as const;

export interface SectionCodeDeConduite {
  /** Ancre stable, aussi l'`id` du titre de section. */
  id: string;
  titre: string;
  paragraphes: string[];
  /** Liste à puces placée après le premier paragraphe. */
  liste?: string[];
  /** Paragraphes placés après la liste. */
  apresListe?: string[];
}

export const codeDeConduite: SectionCodeDeConduite[] = [
  {
    id: "pourquoi",
    titre: "Pourquoi ce code",
    paragraphes: [
      "Tech Speak'Her encourage les femmes de la tech à prendre la parole en conférence. Nos événements sont des espaces où elles s'expriment en sécurité, sans avoir à prouver leur légitimité et sans que leur présence sur scène soit réduite à leur genre. L'expérience de certaines speakeuses montre que ce n'est pas encore acquis.",
    ],
  },
  {
    id: "a-qui",
    titre: "À qui il s'applique",
    paragraphes: [
      "À toute personne présente à nos événements (meetups, programme Tremplin, soirées finales) ou active dans nos espaces d'échange en ligne : membres, personnes inscrites à un programme, public, et toute personne qui intervient pour l'association, bénévolement ou dans le cadre d'une prestation. Participer, c'est l'accepter.",
    ],
  },
  {
    id: "regles",
    titre: "Les règles",
    paragraphes: [
      "Respectez les personnes présentes et laissez de la place à toutes les voix. Les débats sont bienvenus, les désaccords aussi, tant qu'ils restent respectueux. Nous ne tolérons pas :",
    ],
    liste: [
      "le harcèlement, l'intimidation et les menaces ;",
      "les propos et comportements humiliants, sexistes, racistes, homophobes, transphobes, ou hostiles aux personnes en situation de handicap ;",
      "les propos et gestes à caractère sexuel non sollicités, les contacts physiques non sollicités ;",
      "les remarques qui mettent en doute la compétence ou la légitimité d'une personne en raison de son genre ;",
      "les interruptions hostiles et les questions posées pour mettre en difficulté plutôt que pour comprendre ;",
      "le fait de suivre une personne ou de la solliciter avec insistance ;",
      "le fait de photographier ou d'enregistrer une personne sans son accord, ou de diffuser ses images ou ses propos hors du cadre où ils ont été tenus.",
    ],
    apresListe: [
      "Cette liste n'est pas limitative. Les mêmes règles valent sur place et en ligne.",
    ],
  },
  {
    id: "photos",
    titre: "Photos et vidéos",
    paragraphes: [
      "Des images sont prises pendant les événements pour nos publications. Vous ne souhaitez pas apparaître ? Cochez la case de refus à l'inscription et signalez-vous à l'accueil à votre arrivée : un badge vous est remis, et nous ne publions pas les images sur lesquelles vous êtes reconnaissable. Les intervenantes, les participantes de nos programmes et les personnes mises en avant sur une image signent une autorisation écrite. Pour une personne mineure, l'autorisation écrite des titulaires de l'autorité parentale est nécessaire. Toute demande de suppression est traitée dans les trente jours.",
    ],
  },
  {
    id: "probleme",
    titre: "Un problème ?",
    paragraphes: [
      "Vous subissez ou vous constatez un comportement contraire à ce code :",
    ],
    liste: [
      "sur place, parlez-en à une membre de l'équipe Tech Speak'Her, qui se présente en début d'événement ;",
      "par écrit, à techspeakher@gmail.com ;",
      "si la personne en cause fait partie de l'équipe, adressez-vous directement à une autre membre du collège.",
    ],
    apresListe: [
      "Nous vous écoutons, nous gardons votre signalement confidentiel et nous vous répondons dans les sept jours. Nous n'engageons aucune démarche en votre nom sans votre accord. Aucune représaille n'est tolérée envers une personne qui signale de bonne foi.",
      "En cas d'urgence ou de danger : 17 ou 112, 114 par SMS. Écoute pour les femmes victimes de violences : 3919, appel gratuit et anonyme. Si les faits peuvent constituer une infraction, nous vous accompagnons dans vos démarches. Nous ne remplaçons ni la police ni la justice.",
    ],
  },
  {
    id: "ensuite",
    titre: "Ce qui se passe ensuite",
    paragraphes: [],
    liste: [
      "L'équipe intervient immédiatement et rappelle les règles. Si les faits sont graves ou se répètent, la personne peut être priée de quitter l'événement ou l'espace en ligne.",
      "Le collège, informé dans les quarante-huit heures, peut décider d'autres mesures, par exemple l'exclusion des prochains événements ou des espaces en ligne.",
      "Avant toute décision, la personne concernée est informée par écrit des faits reprochés et a quinze jours pour s'expliquer. Elle reçoit une décision écrite et expliquée, et peut en demander le réexamen dans les trente jours (article 8 du règlement intérieur).",
    ],
  },
];
