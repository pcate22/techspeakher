/**
 * Catalogue des vidéos de la chaîne YouTube Tech Speak'Her.
 *
 * La chaîne accueille le replay des soirées Tremplin, les interviews Behind the
 * Scenes et les talks filmés des speakeuses. Ce fichier en est la source
 * unique : les pages lisent ce tableau, rien n'est écrit en dur ailleurs.
 *
 * ┌─ AJOUTER UNE VIDÉO ──────────────────────────────────────────────────┐
 * Copie une fiche ci-dessous et adapte les champs :
 *
 *   {
 *     id: "interview-aurelie-vache",          // slug unique et stable
 *     title: "Interview d'Aurélie Vache",
 *     description: "Une ou deux phrases.",
 *     url: "https://www.youtube.com/watch?v=…",
 *     duree: "24 min",                        // optionnel
 *     date: "septembre 2026",                 // "JJ mois AAAA", "mois AAAA" ou "AAAA"
 *     // edition: { conf: "devfest-toulouse", annee: 2026 }, // pour un replay de soirée
 *   },
 *
 * Rien d'autre à fournir : la vignette se DÉRIVE de l'URL (`lib/youtube.ts`) et
 * transite par l'optimiseur d'images du site, donc en same-origin.
 * Typo FR : espace insécable ( ) avant : ; ! ?
 * └──────────────────────────────────────────────────────────────────────┘
 */

export interface Video {
  /** Slug unique et stable (sert de clé de rendu). */
  id: string;
  title: string;
  description: string;
  /** Lien de la vidéo sur YouTube. */
  url: string;
  /** Durée lisible, ex. « 1 h 42 » ou « 24 min ». */
  duree?: string;
  /** Date de la captation, en toutes lettres. */
  date: string;
  /** Édition du Tremplin dont cette vidéo est le replay, le cas échéant. */
  edition?: { conf: string; annee: number };
}

export const videos: Video[] = [
  {
    id: "tremplin-devfest-toulouse-2026",
    title: "La soirée Tremplin 2026",
    description:
      "8 finalistes, 3 minutes de pitch chacune, un jury 100 % féminin. La soirée du 4 juin à Toulouse, en vidéo.",
    url: "https://youtu.be/Ac6rI2Bg-jE",
    date: "4 juin 2026",
    edition: { conf: "devfest-toulouse", annee: 2026 },
  },
];

/** Le replay d'une édition du Tremplin, quand il est en ligne. */
export function replayDe(conf: string, annee: number): Video | undefined {
  return videos.find((v) => v.edition?.conf === conf && v.edition.annee === annee);
}
