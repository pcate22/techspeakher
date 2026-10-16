import type { Prix, FAQ, AccompagnementTheme, Jure, Partenaire, TremplinStep } from "@/types";
import { SOIREE_TREMPLIN_URL, YOUTUBE_URL } from "@/constants/site";

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

/** Le jury 100% féminin de la soirée Tremplin du 4 juin 2026. */
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

export const retoursPourTous: string[] = [
  "Feedback écrit du jury",
  "Vidéo de ton pitch",
  "Un post sur nos réseaux (si tu veux)",
];

/**
 * L'ÉDITION que décrit l'éditorial de ce fichier : la FAQ (« la soirée du 4 juin
 * 2026 », candidatures closes le 17 avril), le jury nommé, les lots (« une
 * présentation au DevFest Toulouse 2026 ») et les partenaires (« nous accueille
 * pour la soirée », « co-animatrice de l'atelier CFP »).
 *
 * Deux axes, pas un : l'année ET la conférence. Sur la page d'une autre année,
 * ces blocs répondent à côté ; sur la page d'une autre conférence la même année,
 * ils annoncent le DevFest à des gens venus pour autre chose — et le JSON-LD
 * `FAQPage` publierait ces réponses aux moteurs sous cette autre adresse.
 *
 * Écrire l'éditorial d'une nouvelle édition, c'est déplacer ce repère avec lui.
 */
export const editionEditoriale = { confSlug: "devfest-toulouse", annee: 2026 } as const;

/**
 * CE (conf, année) est-il l'édition que l'éditorial de ce fichier décrit ?
 * Le même invariant garde la page d'édition (FAQ, jury, partenaires, JSON-LD)
 * et la vitrine (phrase-preuve, lien finalistes) : une seule copie.
 */
export function estEditionEditoriale(confSlug: string, annee: number): boolean {
  return confSlug === editionEditoriale.confSlug && annee === editionEditoriale.annee;
}

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
