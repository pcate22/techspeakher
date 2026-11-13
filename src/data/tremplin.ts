import type {
  Prix,
  FAQ,
  AccompagnementTheme,
  Jure,
  Partenaire,
  TremplinStep,
  EditorialEdition,
} from "@/types";
import { SOIREE_TREMPLIN_URL, TREMPLIN_DEVOXX_2027_FORM_URL, YOUTUBE_URL } from "@/constants/site";

/** Les 5 thèmes travaillés pendant le parcours d'accompagnement. */
export const accompagnement: AccompagnementTheme[] = [
  {
    number: "01",
    title: "Trouver son sujet",
    description: "Du blanc à 3 idées de talk via le triangle Expertise / Expérience / Émotion. Brainstorm guidé, partage en tour de table, shortlist personnelle.",
    done: true,
    dateEnd: "2026-04-28",
  },
  {
    number: "02",
    title: "Construire le plan",
    description: "Du sujet au squelette du talk en 3 blocs\u00A0: accroche, corps, chute. Validation de la promesse et du public visé. Test du plan avec un agent IA.",
    done: true,
    dateEnd: "2026-05-05",
  },
  {
    number: "03",
    title: "Proposer son sujet\u00A0: le CFP",
    description: "Construire un titre qui émerge, une description structurée (contexte / sujet / contenu / promesse), une bio à la première personne, et les notes aux organisatrices qui peuvent faire la différence. On encourage à soumettre au DevFest Toulouse, et ailleurs.",
    done: true,
    dateEnd: "2026-05-12",
    coAnimatrice: {
      name: "Lucile Briotet",
      role: "Conceptrice-rédactrice",
      url: "https://fr.linkedin.com/in/lucilebriotet",
    },
  },
  {
    number: "04",
    title: "Travailler le pitch",
    description: "Premier passage à l'oral devant le groupe. Travail du débit, des transitions, de la chute. Feedback bienveillant pour caler la version 1.",
    done: true,
    dateEnd: "2026-05-19",
  },
  {
    number: "05",
    title: "Affiner la prise de parole",
    description: "Entraînement au pitch et finalisation des CFP. Dernière ligne droite avant la soirée du 4 juin.",
    dateEnd: "2026-05-26",
  },
];

/** Le jury 100% féminin de la soirée Tremplin du 4 juin 2026 (DevFest Toulouse). */
export const jury: Jure[] = [
  { name: "Aline Paponaud", role: "DSI Sud-Ouest, Inovie" },
  { name: "Aurélie Vache", role: "Developer Advocate, OVHcloud" },
  { name: "Céline Chantry-Darmon", role: "Chief Scientific Officer, Tekkare" },
  { name: "Corrine Favaro", role: "Directrice Domaine Méthode, BPCE Solutions informatiques" },
  { name: "Magali Germond", role: "Déléguée Régionale Numeum, administratrice Digital 113" },
  { name: "Rachel Dubois", role: "Coach Orga - Produit, ex-Spotify, Airbus, Vinted" },
  { name: "Sandrine David", role: "Directrice Business Applications, Berger-Levrault" },
  { name: "Sophie Lagarde", role: "Directrice Relation Clients BPCE-IT, administratrice La Mêlée" },
];

export const prix: Prix[] = [
  {
    place: "1ᵉʳ prix",
    reward: "Une présentation au DevFest Toulouse 2026",
    detail: "Salle communauté",
    color: "border-gold",
    ariaLabel: "Premier prix",
  },
  {
    place: "2ᵉ prix",
    reward: "Un slot au prochain meetup Tech Speak'Her",
    color: "border-silver",
    ariaLabel: "Deuxième prix",
  },
  {
    place: "3ᵉ prix",
    reward: "Un slot au prochain meetup Tech Speak'Her",
    color: "border-bronze",
    ariaLabel: "Troisième prix",
  },
];

const lucile = accompagnement.find((a) => a.number === "03")?.coAnimatrice;

export const partenaires: Partenaire[] = [
  {
    name: "BPCE Solutions informatiques",
    description:
      "Sponsor principal : nous accueille dans ses locaux toulousains pour la soirée, prend en charge la captation vidéo, la sécurité et l'apéro dînatoire, et affiche un exemplaire indice d'égalité femmes-hommes.",
    url: "https://www.bpce-si.fr/",
  },
  {
    name: "DevFest Toulouse & GDG Toulouse",
    description:
      "Partenaires depuis le début : ils nous ont offert notre kakémono et accueillent nos speakeuses sur scène au DevFest Toulouse en novembre.",
    url: "https://devfesttoulouse.fr/",
  },
  {
    name: "La Mêlée, Digital 113, BPCE Infogérance & Technologies, Berger-Levrault, bttrways, Yeeso & IT Women Network",
    description:
      "Structures de l'écosystème numérique régional dont les représentantes composent notre jury. Merci de nous permettre un jury ancré dans la diversité des métiers et des secteurs.",
  },
  {
    name: "The Playground",
    description:
      "Plateforme d'organisation d'événements : merci de mettre leur outil à disposition gratuitement pour les inscriptions à la soirée.",
    url: "https://the-playground.fr/",
  },
  ...(lucile
    ? [{ name: lucile.name, description: `${lucile.role}, co-animatrice de l'atelier CFP.`, url: lucile.url }]
    : []),
  {
    name: "Rachel Dubois",
    description: "Coach produit & enterprise, ex-Spotify et Airbus. Mentorat lors des ateliers et membre du jury.",
    url: "https://racheldubois.fr",
  },
  {
    name: "Noëlle Ballestrero",
    description: "Photographe, reportage photo de la soirée.",
    url: "https://fr.linkedin.com/in/no%C3%ABlle-ballestrero-578398143",
  },
];

/** Promis à toutes les participantes, en 2026 comme en 2027. */
export const retoursPourTous: string[] = [
  "Feedback écrit du jury",
  "Vidéo de ton pitch",
  "Un post sur nos réseaux (si tu veux)",
];

/** La FAQ de l'édition DevFest Toulouse 2026. */
export const faq: FAQ[] = [
  {
    q: "Je n'ai jamais donné de talk, c'est grave\u00A0?",
    a: "Pas du tout\u00A0! Le Tremplin est justement fait pour ça. On t'accompagne de A à Z, du pitch à la scène.",
  },
  {
    q: "Je dois déjà avoir un sujet prêt\u00A0?",
    a: "Pas du tout\u00A0! Si tu as une idée, même vague, c'est super. Sinon, on t'aidera à trouver ton sujet à partir de ton parcours et de tes expériences.",
  },
  {
    q: "C'est quoi la soirée Tremplin\u00A0?",
    a: "La soirée Tremplin, c'est la finale : chaque speakeuse présente son talk en 3 min, suivi de 5 min de questions-réponses avec le jury, qui s'appuie sur une grille de critères objectifs pour départager et donner à chacune un retour constructif. L'édition 2026 a eu lieu le 4 juin à Toulouse, ouverte au public et dans un lieu sécurisé.",
    lien: { href: SOIREE_TREMPLIN_URL, label: "Voir l'événement sur The Playground" },
  },
  {
    // The Playground sert aux inscriptions, pas au replay : y renvoyer pour
    // revoir une soirée serait une fausse piste. Le lien générique mène à la
    // chaîne ; la page d'une édition le remplace par SA vidéo (id « replay »),
    // pour qu'une page 2027 ne pointe jamais la captation de 2026.
    id: "replay",
    q: "Je peux revoir la soirée du 4 juin\u00A0?",
    a: "Oui, et avec plaisir\u00A0! La soirée s'est tenue le 4 juin 2026 à Toulouse, salle pleine, et elle est en vidéo sur notre chaîne YouTube. Les inscriptions de la prochaine édition seront annoncées sur cette page.",
    lien: { href: YOUTUBE_URL, label: "Voir notre chaîne YouTube" },
  },
  {
    id: "grille",
    q: "Sur quoi le jury évalue les pitchs\u00A0?",
    a: "Sur 5 critères notés /28, répartis en deux axes. Axe Sujet\u00A0: clarté et pertinence (×2), apport pour l'audience, angle distinctif. Axe Personne\u00A0: légitimité sur ce sujet, capacité à porter le sujet (×2). On évalue le potentiel d'un super talk avec accompagnement, pas le pitch fini. L'objectif est de donner à chacune un retour bienveillant et exploitable, gagnante ou pas.",
  },
  {
    q: "Qui compose le jury\u00A0?",
    a: "Un jury 100% féminin de 8 personnalités de la tech et du leadership occitan\u00A0: Aline Paponaud (Inovie), Aurélie Vache (OVHcloud), Céline Chantry-Darmon (Tekkare), Corrine Favaro (BPCE Solutions informatiques), Magali Germond (Numeum / Digital 113), Rachel Dubois, Sandrine David (Berger-Levrault) et Sophie Lagarde (BPCE-IT / La Mêlée). Profils complets dans la section «\u00A0Le jury\u00A0» de la page.",
  },
  {
    q: "Je dois habiter à Toulouse\u00A0?",
    a: "Non, pas d'obligation\u00A0! Le mentorat se fait à distance. Il fallait simplement être présente à Toulouse pour la soirée Tremplin du 4 juin, et les speakeuses accompagnées monteront sur scène au DevFest le 19 novembre.",
  },
  {
    q: "Comment s'inscrire au Tremplin\u00A0?",
    a: "Les candidatures pour cette édition sont closes (elles étaient ouvertes du 12 mars au 17 avril 2026). Reste à l'affût pour la prochaine édition\u00A0! La soirée finale a eu lieu le 4 juin 2026 à Toulouse.",
  },
  {
    q: "Qui organise le Tremplin\u00A0?",
    a: "Le Tremplin est organisé par les bénévoles de Tech Speak'Her, association loi 1901. La soirée du 4 juin a été rendue possible grâce à BPCE Solutions informatiques, qui nous accueille dans ses locaux toulousains, et aux partenaires qui prennent en charge l'apéro dînatoire. L'atelier 3 (CFP) a été co-animé avec Lucile Briotet, conceptrice-rédactrice.",
  },
];

// ─── Édition Devoxx France 2027 ────────────────────────────────────────────

const DEVOXX_URL = "https://www.devoxx.fr/";

/** Le critère « primo-speakeuse », tel qu'il se lit sur la page et dans la FAQ. */
const CRITERE_PRIMO =
  "Ce sera ton premier talk dans une conférence publique avec appel à orateurs (CFP) et sélection. Tu peux candidater même si tu as déjà fait des présentations internes, des lightning talks en entreprise, des cours, des formations, des podcasts ou des webinaires.";

const DEPLACEMENTS =
  "Tu peux venir à Paris le soir du mardi 19\u00A0janvier 2027 pour la soirée Tremplin, et du 7 au 9\u00A0avril 2027 pour Devoxx France si tu gagnes. Le transport et le logement restent à ta charge\u00A0: nous cherchons des financements pour les prendre en charge.";

const grille = faq.find((f) => f.id === "grille");

const faqDevoxx2027: FAQ[] = [
  {
    q: "Qui peut candidater\u00A0?",
    a: `Les femmes de la tech, ou les personnes qui se reconnaissent comme telles, tous métiers et tous niveaux. ${CRITERE_PRIMO}`,
    lien: { href: "/contact", label: "Un doute\u00A0? Écris-nous" },
  },
  {
    q: "Faut-il être membre de Tech\u00A0Speak'Her\u00A0?",
    a: "Oui\u00A0: le Tremplin est réservé aux adhérentes de l'association. L'adhésion se fait en ligne, sur HelloAsso.",
    lien: { href: "/adherer", label: "Adhérer à Tech\u00A0Speak'Her" },
  },
  {
    q: "Je dois déjà avoir un sujet prêt\u00A0?",
    a: "Pas du tout\u00A0! Si tu as une idée, même vague, c'est super. Sinon, on t'aidera à trouver ton sujet à partir de ton parcours et de tes expériences.",
  },
  {
    q: "Comment se passent les ateliers\u00A0?",
    a: "Cinq ateliers en groupe, à distance, sur le temps de midi\u00A0: les 1er, 8 et 15\u00A0décembre 2026, puis les 5 et 12\u00A0janvier 2027. On y trouve son sujet, on construit son plan, on rédige sa proposition de talk (le CFP), on travaille le pitch et la prise de parole.",
  },
  {
    q: "C'est quoi la soirée Tremplin\u00A0?",
    a: "C'est la finale, le mardi 19\u00A0janvier 2027 au soir, à Paris. Chaque finaliste présente son talk en 3\u00A0min, puis échange 5\u00A0min avec le jury, qui s'appuie sur une grille de critères pour départager et faire un retour à chacune. Le lieu sera annoncé sur cette page.",
  },
  {
    q: "Qu'est-ce qu'on gagne\u00A0?",
    a: "La gagnante donne une conférence de 30\u00A0minutes au Devoxx France 2027, du 7 au 9\u00A0avril au Palais des Congrès de Paris, et on l'accompagne pour la préparer jusqu'au jour J. Toutes les participantes repartent avec le retour écrit du jury, la vidéo de leur pitch et, si elles le veulent, un post sur nos réseaux.",
  },
  {
    q: "Je dois habiter à Paris\u00A0?",
    a: `Non, les ateliers se font à distance. ${DEPLACEMENTS}`,
  },
  ...(grille ? [grille] : []), // présente : un test garde la FAQ 2027 entière
  {
    q: "Qui compose le jury\u00A0?",
    a: "Le jury sera annoncé sur cette page.",
  },
  {
    id: "candidater",
    q: "Comment candidater\u00A0?",
    a: "Adhère à Tech\u00A0Speak'Her, puis remplis le formulaire de candidature avant la date limite indiquée en haut de cette page.",
    lien: { href: TREMPLIN_DEVOXX_2027_FORM_URL, label: "Ouvrir le formulaire de candidature" },
  },
  {
    q: "Qui organise le Tremplin\u00A0?",
    a: "Le Tremplin est organisé par les bénévoles de Tech\u00A0Speak'Her, association loi 1901, en partenariat avec Devoxx France.",
  },
];

const editorialDevoxx2027: EditorialEdition = {
  faq: faqDevoxx2027,
  prix: [
    {
      place: "Pour la gagnante",
      reward: "Une conférence de 30\u00A0minutes au Devoxx France 2027",
      detail: "Du 7 au 9\u00A0avril, Palais des Congrès de Paris, avec un accompagnement jusqu'au jour J",
      color: "border-gold",
      ariaLabel: "Prix de la gagnante",
    },
  ],
  // Annoncé plus tard : sans nom, la page ne titre pas une liste vide.
  jury: [],
  partenaires: [
    {
      name: "Devoxx France",
      description: "Ouvre sa scène à la gagnante du Tremplin pour une conférence au Devoxx France 2027.",
      url: DEVOXX_URL,
    },
  ],
  retoursPourTous,
  confDateFin: "2027-04-09",
  accroche:
    "Cinq ateliers à distance, une soirée finale le 19\u00A0janvier 2027 à Paris, et une conférence de 30\u00A0minutes au Devoxx France 2027 pour la gagnante.",
  candidature: {
    formUrl: TREMPLIN_DEVOXX_2027_FORM_URL,
    conditions: [
      { texte: "Tu es une femme, ou tu te reconnais comme telle." },
      { texte: CRITERE_PRIMO, lien: { href: "/contact", label: "Un doute\u00A0? Écris-nous" } },
      { texte: "Tu es adhérente de Tech\u00A0Speak'Her.", lien: { href: "/adherer", label: "Adhérer à l'association" } },
      { texte: DEPLACEMENTS },
    ],
  },
};

// ─── Registre des éditions qui ont un éditorial ────────────────────────────

const editorialDevfest2026: EditorialEdition = {
  faq,
  prix,
  jury,
  partenaires,
  retoursPourTous,
  accroche: "8 finalistes, 3 gagnantes, un jury 100\u00A0% féminin lors de la soirée du 4\u00A0juin à Toulouse.",
  lienFinalistes: true,
};

const editoriaux: Record<string, EditorialEdition> = {
  "devfest-toulouse/2026": editorialDevfest2026,
  "devoxx-france/2027": editorialDevoxx2027,
};

/** Tous les éditoriaux, pour que les relectures automatiques n'en oublient aucun. */
export const tousLesEditoriaux: readonly EditorialEdition[] = Object.values(editoriaux);

/**
 * L'éditorial de CETTE édition, ou `null`. Deux axes, pas un : l'année ET la
 * conférence. Ailleurs, ces blocs répondraient à côté, et le JSON-LD `FAQPage`
 * publierait leurs réponses aux moteurs sous une autre adresse.
 */
export function editorialDe(confSlug: string, annee: number): EditorialEdition | null {
  return editoriaux[`${confSlug}/${annee}`] ?? null;
}

/**
 * L'édition EN COURS côté éditorial : le repli de la vitrine quand la base est
 * injoignable, et la cible de la FAQ dans la recherche du site. Ouvrir une
 * nouvelle édition, c'est l'ajouter à `editoriaux` et déplacer ce repère.
 */
export const editionEditoriale = {
  confSlug: "devoxx-france",
  annee: 2027,
  confNom: "Devoxx France",
  /** Nom court pour un bouton, où chaque mot compte. */
  libelleCourt: "Devoxx 2027",
} as const;

/** L'éditorial de l'édition en cours, dérivé du repère : les deux bougent ensemble. */
export const editorialEnCours: EditorialEdition = (() => {
  const e = editorialDe(editionEditoriale.confSlug, editionEditoriale.annee);
  if (!e) throw new Error("editionEditoriale désigne une édition sans éditorial");
  return e;
})();

export const tremplinSteps: TremplinStep[] = [
  {
    number: "1",
    color: "text-cyan",
    bg: "bg-cyan/15",
    border: "border-cyan/30",
    title: "Inscription ouverte",
    description:
      "Un appel à candidatures ouvert à toutes les femmes de la tech — tous métiers, tous niveaux. Pas besoin d'avoir un sujet prêt ni d'avoir déjà donné un talk.",
  },
  {
    number: "2",
    color: "text-magenta",
    bg: "bg-magenta/15",
    border: "border-magenta/30",
    title: "5 ateliers de coaching",
    description:
      "En distanciel, en groupe. Trouver son sujet, construire le plan, rédiger son CFP, travailler le pitch, affiner la prise de parole. Une heure par semaine, six semaines.",
  },
  {
    number: "3",
    color: "text-orange",
    bg: "bg-orange/15",
    border: "border-orange/30",
    title: "Soirée pitch devant jury",
    description:
      "Chaque participante pitche son talk en 3 min devant un jury indépendant et 100 % féminin. 5 min de Q&R. Feedback bienveillant et constructif pour toutes — gagnante ou pas.",
  },
  {
    number: "4",
    color: "text-gold",
    bg: "bg-gold/15",
    border: "border-gold/30",
    title: "Coaching vers la scène",
    description:
      "Les gagnantes, et celles qui ont été retenues au CFP de la conférence, sont accompagnées sur la durée pour préparer leur talk complet\u00A0: structure, slides, répétitions. On lâche rien jusqu'à la scène.",
  },
  {
    number: "5",
    color: "text-cyan",
    bg: "bg-cyan/15",
    border: "border-cyan/30",
    title: "Sur scène à la conférence",
    description:
      "Elles présentent leur talk devant le public de la conférence partenaire, des centaines de personnes. La boucle est bouclée.",
  },
];
