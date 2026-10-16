// Actualités historiques : le FIXTURE du seed (`src/lib/contenus-seed.ts` les
// importe dans la table `contenus`) et la source de l'index de recherche
// statique. Les actualités affichées, elles, viennent de la BASE : la liste
// `/actualites` et l'extrait de l'accueil lisent `contenus` (le filtrage vit
// dans `lib/contenu-form.ts` → `CATEGORIES`). Rien ici n'est rendu directement.
import type { BehindTheScenes } from "@/types";

export interface ActuItem {
  date: string;
  title: string;
  description: string;
  tag: string;
  category: "Meetup & Talk" | "Behind the Scenes" | "Tremplin" | "Communauté";
  link?: string;
  externalLink?: string;
  externalLinkLabel?: string;
  speaker?: string;
}

/**
 * ┌─ AJOUTER UNE ACTUALITÉ ─────────────────────────────────────────────┐
 * Copie une fiche existante ci-dessous et adapte les champs :
 *
 *   {
 *     date: "12 mars 2026",              // "JJ mois AAAA" (ou "mois AAAA", ou "AAAA")
 *     title: "Titre de l'actu",
 *     description: "Une ou deux phrases.",
 *     tag: "À venir",                    // "À venir" | "En cours" | "Passé"
 *     category: "Tremplin",              // "Meetup & Talk" | "Behind the Scenes" | "Tremplin" | "Communauté"
 *     link: "/tremplin",                 // lien interne (optionnel)
 *     // externalLink: "https://…",      // lien externe (optionnel)
 *     // externalLinkLabel: "Voir",      // libellé du lien externe (optionnel)
 *     // speaker: "Prénom Nom",          // intervenante (optionnel)
 *   },
 *
 * Le tri par date est automatique. Typo FR : espace insécable ( ) avant : ; ! ?
 * └─────────────────────────────────────────────────────────────────────┘
 */
export const allActualites: ActuItem[] = [
  // --- À venir ---
  {
    date: "19 novembre 2026",
    title: "DevFest Toulouse 2026",
    description:
      "Les speakeuses Tech Speak'Her montent sur scène au DevFest Toulouse, issues du Tremplin et du CFP, au Diagora à Labège.",
    tag: "À venir",
    category: "Tremplin",
    link: "/devfest-toulouse",
  },
  {
    date: "4 juin 2026",
    title: "Soirée Tremplin Tech Speak'Her",
    description:
      "Les participantes pitchent leur sujet devant un jury à Toulouse. Qui montera sur la scène du DevFest\u00A0?",
    tag: "Passé",
    category: "Tremplin",
    link: "/tremplin/devfest-toulouse/2026",
  },
  {
    date: "12 mars 2026",
    title: "Inscriptions ouvertes\u00A0: Tremplin DevFest 2026",
    description:
      "Le Tremplin est de retour\u00A0! Inscriptions ouvertes jusqu'au 17 avril. L'idée\u00A0: te préparer à donner un talk au DevFest Toulouse 2026.",
    tag: "Passé",
    category: "Tremplin",
    link: "/tremplin",
  },
  // --- Passé ---
  {
    date: "12 mars 2026",
    title: "J'ai packagé mon application en image Docker, et maintenant\u00A0?",
    speaker: "Aurélie Vache",
    description:
      "Un talk sur la sécurité de la supply chain logicielle, par Aurélie Vache (Developer Advocate OVHcloud, GDE Cloud, Docker Captain).",
    tag: "Passé",
    category: "Meetup & Talk",
    externalLink: "https://www.meetup.com/fr-FR/gdg-toulouse/events/313488746/",
    externalLinkLabel: "Voir sur Meetup",
  },
  {
    date: "13 novembre 2025",
    title: "La méthode pour coder ce qui compte vraiment",
    speaker: "Cateline Puccetti",
    description:
      "La toute première conférence de Cateline\u00A0! Présentée au DevFest Toulouse 2025, la preuve que ça fonctionne.",
    tag: "Passé",
    category: "Meetup & Talk",
    externalLink: "https://devfesttoulouse.fr/fr/editions/2025",
    externalLinkLabel: "Voir l'agenda DevFest",
  },
  {
    date: "10 octobre 2025",
    title: "Midi MedTech\u00A0: Transformons la santé par la DATA",
    speaker: "Montaine Marteau",
    description:
      "Le tout premier meetup Tech Speak'Her\u00A0! Présenté par Montaine Marteau au HarryCow à Toulouse.",
    tag: "Passé",
    category: "Meetup & Talk",
    externalLink: "https://www.meetup.com/fr-FR/gdg-toulouse/events/310951200/",
    externalLinkLabel: "Voir sur Meetup",
  },
  {
    date: "23 mars 2026",
    title: "Interview de Rachel Dubois",
    description:
      "«\u00A0On t'a prise parce que t'étais la seule fille.\u00A0» Notre première interview Behind the Scenes.",
    tag: "Passé",
    category: "Behind the Scenes",
    externalLink: "https://www.linkedin.com/pulse/behind-scenes-avec-rachel-dubois-ta-prise-parce-que-t%C3%A9tais-3m3de/",
    externalLinkLabel: "Lire sur LinkedIn",
  },
  {
    date: "septembre 2025",
    title: "Création de Tech Speak'Her",
    description:
      "Ça a commencé comme ça\u00A0: un groupe de femmes de la tech à Toulouse qui se sont dit «\u00A0pourquoi pas nous\u00A0?\u00A0». Et voilà.",
    tag: "Passé",
    category: "Communauté",
    link: "/a-propos",
  },
];

/**
 * Parse French dates for sorting. Returns a timestamp (higher = more recent).
 * Handles "19 novembre 2026", "2025", etc.
 */
const MONTHS: Record<string, number> = {
  janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11,
};

export function parseFrenchDate(d: string): number {
  const parts = d.trim().split(/\s+/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(Number(year), MONTHS[month.toLowerCase()] ?? 0, Number(day)).getTime();
  }
  if (parts.length === 2) {
    // "septembre 2025"
    const [month, year] = parts;
    return new Date(Number(year), MONTHS[month.toLowerCase()] ?? 0, 1).getTime();
  }
  // Year-only ("2025")
  return new Date(Number(parts[0]), 0, 1).getTime();
}

/**
 * Interviews Behind the Scenes — citations reprises hors du fil d'actus (extrait
 * dans le code de conduite, entrée de recherche dédiée).
 * L'interview COMPLÈTE, elle, vit dans les actualités : sa publication en base a
 * un corps, donc sa page `/articles/[slug]` (cf. db/migrations/047). Plus de
 * citation vedette sur l'accueil ni sur `/actualites` : le même contenu ne
 * s'affiche pas deux fois.
 */
export const behindTheScenes: BehindTheScenes[] = [
  {
    name: "Rachel Dubois",
    role: "Senior Consultant & Full Stack Enterprise Coach",
    quote:
      "Il y aura presque toujours ce mec qui n’accepte pas, qui interrompt, qui pose son point de vue en plein talk pour montrer que ce n’est pas carré. Devant toute la salle.",
    context:
      "Dans toutes les conférences, il y a une constante très marquante : le comportement d’une partie de l’audience quand tu es une femme sur scène. J’ai dû faire pas mal de psychothérapie pour travailler ma légitimité. En Angleterre, certaines conférences rappellent dès le début que ce type de comportement n’est pas toléré. Ce n’est pas encore le cas en France.",
    insight:
      "Ça m’a beaucoup motivée à devenir animatrice et organisatrice de conférences, pour que les femmes puissent se sentir en sécurité.",
    url: "https://www.linkedin.com/pulse/behind-scenes-avec-rachel-dubois-ta-prise-parce-que-t%C3%A9tais-3m3de/",
  },
];
