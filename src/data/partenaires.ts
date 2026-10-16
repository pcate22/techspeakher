import type { StructurePartenaire, TypeSoutien } from "@/types";

/**
 * L'ANNUAIRE des structures partenaires (2026-10-15) : qui elles sont. Une
 * structure qui aide de plusieurs façons apparaît dans plusieurs rangées de
 * `typesSoutien`, une seule fois ici. Toutes ont donné leur accord pour
 * apparaître (Cateline, 2026-10-15).
 */
export const partenaires: StructurePartenaire[] = [
  { name: "Crédit Mutuel", url: "https://www.creditmutuel.fr/", soutien: true },
  { name: "BPCE Solutions informatiques", url: "https://www.bpce-si.fr/", soutien: true },
  { name: "Berger-Levrault", url: "https://www.berger-levrault.com/fr/", soutien: true },
  { name: "GDG Toulouse", url: "https://gdg.community.dev/gdg-toulouse/", soutien: true },
  { name: "Yeeso & IT Women Network", url: "https://yeeso.fr" },
  { name: "Flupa Toulouse", url: "https://flupa.eu/" },
  { name: "Agile Toulouse", url: "https://www.agiletoulouse.fr/" },
  { name: "DevFest Toulouse", pageInterne: "/devfest-toulouse" },
  { name: "La Mêlée", url: "https://lamelee.com/" },
  { name: "Digital 113", url: "https://www.digital113.fr/" },
  { name: "Numeum", url: "https://numeum.fr/" },
  { name: "BPCE Infogérance & Technologies", url: "https://www.bpce-it.fr/" },
  { name: "bttrways" },
  { name: "Toulouse Tech Hub", url: "https://toulouse-tech-hub.fr/" },
  // Outil gratuit, ouvert à toutes et tous : ce n'est pas un soutien qui nous
  // est propre, donc pas de `rel="sponsored"` (Cateline, 2026-10-15).
  { name: "The Playground", url: "https://the-playground.fr/" },
];

/**
 * UNE RANGÉE PAR FAÇON D'AIDER (2026-10-15, demande de Cateline) : la page
 * montre les différentes façons de nous aider, et qui le fait déjà. Le
 * vocabulaire : le MÉCÉNAT FINANCIER donne de l'argent, le MÉCÉNAT EN NATURE
 * prend en charge quelque chose (compte, lieu, traiteur, captation) ; les deux
 * sont transparents pour nos comptes. Une rangée vide invite à être la
 * première, sans rien inventer.
 */
export const typesSoutien: TypeSoutien[] = [
  {
    id: "financier",
    titre: "Mécénat financier",
    aide: "Un don ou une cotisation de membre bienfaitrice, à partir de 100\u00A0€. Il paie nos frais de fonctionnement et nos soirées (traiteur, captation vidéo, matériel, communication).",
    membres: [],
  },
  {
    id: "nature",
    titre: "Mécénat en nature",
    aide: "Vous accueillez un événement (30 à 80 personnes, lieu accessible, vidéoprojecteur ou écran), offrez le buffet, une captation ou un service.",
    membres: [
      { nom: "Crédit Mutuel", role: "L'agence de Portet-sur-Garonne nous offre le compte bancaire de l'association et les services associés." },
      { nom: "BPCE Solutions informatiques", role: "Nous accueille dans ses locaux toulousains pour la soirée Tremplin\u00A0: lieu, sécurité, captation vidéo et apéro dînatoire." },
      { nom: "Berger-Levrault", role: "Nous accueille pour les répétitions des speakeuses, dont celle de début novembre avant le DevFest." },
      { nom: "GDG Toulouse", role: "Nous a offert notre roll-up." },
    ],
  },
  {
    id: "coorganisation",
    titre: "Co-organiser un meetup",
    aide: "Vous organisez une soirée avec nous, avec des intervenantes de vos équipes et nos speakeuses.",
    membres: [
      { nom: "GDG Toulouse", role: "Nos deux premiers meetups ont été co-organisés avec eux." },
      { nom: "Yeeso & IT Women Network", role: "Nous co-organisons des meetups avec son antenne toulousaine." },
      { nom: "Flupa Toulouse", role: "Antenne toulousaine de l'association des professionnelles et professionnels de l'UX. Nous co-organisons des meetups ensemble." },
      { nom: "Agile Toulouse", role: "Nous co-organisons des meetups ensemble." },
    ],
  },
  {
    id: "scene",
    titre: "Ouvrir votre scène",
    aide: "Vous organisez un événement et réservez une place à nos speakeuses dans le programme.",
    membres: [
      { nom: "DevFest Toulouse", role: "Accueille le talk de la gagnante du Tremplin dans la salle des communautés, en novembre." },
      { nom: "La Mêlée", role: "Nous a invitées à participer à La Mêlée Numérique, son événement annuel." },
    ],
  },
  {
    id: "jury",
    titre: "Siéger à notre jury",
    aide: "Une personne de votre structure écoute les talks du Tremplin et fait un retour à chaque speakeuse.",
    // Dit UNE fois pour la rangée, pas sur chaque carte (Cateline, 2026-10-15).
    membresIntro: "Ont siégé au jury du Tremplin DevFest Toulouse 2026\u00A0:",
    lien: { href: "/tremplin#jury-title", label: "Voir le jury du Tremplin" },
    membres: [
      { nom: "La Mêlée", role: "Sophie Lagarde, administratrice." },
      { nom: "BPCE Infogérance & Technologies", role: "Sophie Lagarde, directrice Relation Clients." },
      { nom: "Digital 113", role: "Magali Germond, administratrice." },
      { nom: "Numeum", role: "Magali Germond, déléguée régionale." },
      { nom: "Berger-Levrault", role: "Sandrine David, directrice Business Applications." },
      { nom: "bttrways", role: "Représentée au jury." },
    ],
  },
  {
    id: "relais",
    titre: "Nous relayer, nous outiller",
    aide: "Vous parlez de nous à vos équipes, partagez nos événements ou mettez un outil à notre disposition.",
    membres: [
      { nom: "Toulouse Tech Hub", role: "Portail des communautés tech de Toulouse, qui nous référence parmi elles." },
      { nom: "The Playground", role: "Outil gratuit d'organisation d'événements, que nous avons utilisé pour les inscriptions à la soirée Tremplin 2026." },
    ],
  },
];

export const pourquoi = [
  {
    title: "Reconnaissance",
    description:
      "À chaque meetup, chaque soirée Tremplin et chaque article, nous remercions nos soutiens, ici et sur nos réseaux, au titre du mécénat.",
    color: "text-cyan",
  },
  {
    title: "Impact",
    description:
      "Vous aidez des femmes de la tech à donner leur premier talk.",
    color: "text-magenta",
  },
  {
    title: "Rencontres",
    description:
      "On vous invite à nos événements, où vous croisez la communauté\u00A0: speakeuses, développeuses, managers.",
    color: "text-orange",
  },
] as const;

/**
 * LANDING PARTENAIRES (2026-10-15), construite sur la grille de conversion
 * Scalezia : cible au-dessus de la promesse, preuves avant la demande,
 * questions auxquelles on répond « oui », réassurance, puis la demande.
 * Textes à faire relire par le collège (charte rédactionnelle anti-IA).
 */
export const landingPartenaires = {
  cible: "Partenaires : entreprises, conférences et structures tech",
  promesse: "Aidez plus de femmes de la tech à monter sur scène, à Toulouse et au-delà.",
  sousPromesse:
    "Tech\u00A0Speak'Her est une association à but non lucratif. Votre soutien paie ses frais de fonctionnement et ses soirées.",
  questions: [
    "Vous cherchez des intervenantes pour vos conférences et vos événements internes.",
    "Vous voulez que les femmes de vos équipes tech prennent la parole en public.",
    "Vous cherchez une association à soutenir pour la mixité dans la tech.",
  ],
  reassurance: [
    "Dans beaucoup de structures tech, peu de femmes interviennent en conférence.",
    "Nous organisons des meetups et le programme Tremplin pour les y préparer, et notre annuaire aide les organisateurs à les trouver.",
  ],
  quiSommesNous: [
    "Tech\u00A0Speak'Her est une association loi 1901 née à Toulouse, où se tiennent la plupart de ses événements. Un collège de bénévoles la dirige.",
    "Nos deux premiers meetups ont été organisés avec GDG Toulouse. Le programme Tremplin accompagne des femmes de la tech de leur premier talk jusqu'à une soirée sur scène, devant un jury de l'écosystème.",
    "Les coachs et les membres du jury sont bénévoles. Elles représentent souvent aussi leur entreprise.",
  ],
  faq: [
    {
      question: "À partir de quel montant ?",
      reponse:
        "Le soutien des membres bienfaitrices commence à 100 €, sur HelloAsso. Le montant est libre au-delà.",
    },
    {
      question: "Est-ce une adhésion ?",
      reponse:
        "Le soutien est distinct de l'adhésion, réservée aux personnes. Une entreprise ou une organisation nous soutient comme membre bienfaitrice.",
    },
    {
      question: "Recevons-nous un reçu fiscal ?",
      reponse: "Les dons ne donnent pas droit à un reçu fiscal pour le moment.",
    },
    {
      question: "À quoi sert notre soutien ?",
      reponse:
        "Il paie d'abord les charges fixes de l'association\u00A0: l'assurance, le site web et son hébergement, nos autres outils informatiques, les affiches, et les déplacements des organisatrices, des bénévoles et des speakeuses pour l'association. Il finance aussi nos soirées et nos événements (lieu, captation vidéo, traiteur, matériel).",
    },
    {
      question: "Peut-on aider autrement qu'en finançant ?",
      reponse:
        "Co-organiser un meetup, prêter un lieu, offrir le buffet, relayer auprès de vos équipes\u00A0: écrivez-nous pour en parler.",
    },
    {
      question: "Peut-on donner de son temps, à titre personnel ?",
      reponse:
        "Avec plaisir. Nous cherchons des coachs bénévoles pour aider les speakeuses à préparer leur talk (plan, slides, répétition). Écrivez-nous en disant ce que vous aimeriez transmettre.",
    },
  ],
} as const;
