import type { DevfestTalk } from "@/types";

/**
 * Le lineup Tech Speak'Her au DevFest Toulouse 2026 (19 novembre).
 *
 * Camille, 2ᵉ du Tremplin, a pris le créneau réservé à la gagnante (Sandrine,
 * la lauréate, passait déjà via le CFP). Sandrine et Géraldine se sont
 * retirées en octobre 2026. Claire et Asma, retenues au CFP, sont accompagnées
 * par Tech Speak'Her. S'ajoutent deux talks de fondatrices, retenus via le CFP.
 */
export const devfest2026Talks: DevfestTalk[] = [
  {
    name: "Camille Ghibaudo",
    titre: "Défier un GAFAM dans l'auto : la force de l'union, la ruse de la standardisation",
    format: "Conférence",
    note: "2ᵉ du Tremplin 2026",
    linkedin: "https://www.linkedin.com/in/camilleghibaudo/",
  },
  {
    name: "Leïla Gazeilles",
    titre: "Dire oui tue vos projets : anatomie d'un piège courant",
    format: "Quickie",
    note: "Finaliste du Tremplin 2026",
    linkedin: "https://www.linkedin.com/in/le%C3%AFla-gazeilles-pmp-ph-d-7853b524/",
  },
  {
    name: "Claire Pellat",
    titre: "Comment décider de ne pas faire ce qu'on avait prévu de faire : quand la data dit stop",
    format: "Quickie",
    note: "Accompagnée par Tech Speak'Her",
    linkedin: "https://www.linkedin.com/in/claire-pellat/",
  },
  {
    name: "Asma Taberkokt",
    titre: "Mon CV ne répond plus : j'ai construit un chatbot à la place",
    format: "Quickie",
    note: "Accompagnée par Tech Speak'Her",
    linkedin: "https://www.linkedin.com/in/asma-t-5b71b6217/",
  },
  {
    name: "Cateline Puccetti",
    titre: "Votre IA s'en sort moins bien que vos utilisateurs aveugles",
    format: "Quickie",
    note: "Fondatrice Tech Speak'Her",
    linkedin: "https://www.linkedin.com/in/cateline-puccetti/",
  },
  {
    name: "Montaine Marteau",
    titre: "Construisez le dashboard qui répond à vos questions",
    format: "Quickie",
    note: "Fondatrice Tech Speak'Her",
    linkedin: "https://www.linkedin.com/in/montaine-marteau/",
  },
];

export const devfest2026Conferences = devfest2026Talks.filter(
  (t) => t.format === "Conférence",
);
export const devfest2026Quickies = devfest2026Talks.filter(
  (t) => t.format === "Quickie",
);

/**
 * La dernière édition du DevFest EN CHIFFRES, tels que la conférence les publie.
 *
 * SOURCE UNIQUE : ces trois nombres ont vécu un temps ici ET dans le corps de
 * l'article 2025. Deux copies, deux endroits où les corriger, et une qui reste
 * en retard — la page aurait continué d'afficher 65 après une correction dans
 * l'admin. Ils sont donc ici seulement, structurés (nombre + intitulé + ton) ;
 * l'article raconte, il ne compte pas.
 *
 * L'année vit avec les chiffres : les séparer laisserait un jour « 1 200
 * participants » sous le titre d'une autre édition. « Plusieurs scènes en
 * parallèle » ne dit rien à côté de « 50 conférences » — un ordre de grandeur
 * n'est pas un chiffre.
 */
export const devfestChiffres = {
  annee: 2025,
  cartes: [
    { n: "1 200", label: "participants", tone: "magenta" },
    { n: "65", label: "conférenciers", tone: "cyan" },
    { n: "50", label: "conférences", tone: "orange" },
  ],
} as const;
