import { faq, editionEditoriale } from "@/data/tremplin";
import { CATEGORIES } from "@/data/categories-contenus";
import { foldRecherche } from "@/lib/normalise-recherche";

export interface SearchItem {
  title: string;
  description: string;
  url: string;
  category: string;
  /** Texte additionnel indexé mais NON affiché (bio, talks…) : élargit la
   *  recherche plein-texte sans alourdir l'aperçu du résultat. */
  keywords?: string;
  /** Date affichable du résultat (contenus datés seulement). Hors `description`
   *  À DESSEIN : fondue dedans, elle deviendrait cherchable — taper « juin »
   *  remonterait tout ce qui paraît en juin — et l'extrait surligné pourrait
   *  la faire disparaître selon la requête. */
  date?: string;
  /** La même en « YYYY-MM-DD », pour l'attribut `datetime` (RGAA 8.2). */
  dateISO?: string;
}

/**
 * Priorité de catégorie pour la déduplication : quand deux items visent la même
 * page avec le même titre, on garde la catégorie la plus spécifique. Une
 * speakeuse l'emporte sur tout ; une catégorie éditoriale réelle (« Behind the
 * Scenes »…) l'emporte sur le générique « Actualité », qui n'est qu'un repli
 * pour un contenu sans catégorie.
 */
const CATEGORY_PRIORITY: Record<string, number> = {
  Speakeuse: 5,
  // Les catégories réelles des contenus (chips de /actualites et des articles)
  // valent mieux que le générique : elles disent le TYPE de ce qu'on a trouvé.
  ...Object.fromEntries(CATEGORIES.map((c) => [c, 4])),
  FAQ: 3,
  Page: 2,
  Actualité: 1,
};

/**
 * Retire les doublons : un même contenu (même URL + même titre) ne doit
 * apparaître qu'une fois dans la recherche, même s'il vient de deux sources
 * (ex. l'interview Rachel Dubois, saisie dans le fil d'actus et reprise en
 * vedette). On conserve l'entrée à la catégorie la plus spécifique ; à priorité
 * égale, la première rencontrée. L'ordre d'insertion est préservé (Fuse
 * reclasse ensuite par pertinence).
 */
export function dedupeSearchItems(items: SearchItem[]): SearchItem[] {
  const byKey = new Map<string, SearchItem>();
  const order: string[] = [];
  for (const item of items) {
    // `foldRecherche` : identité insensible à la casse ET aux accents
    // (« Élodie » = « Elodie »), même repli que le reste de la recherche.
    const key = `${item.url}\u0000${foldRecherche(item.title.trim())}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      order.push(key);
      continue;
    }
    const priority = CATEGORY_PRIORITY[item.category] ?? 0;
    const existingPriority = CATEGORY_PRIORITY[existing.category] ?? 0;
    if (priority > existingPriority) byKey.set(key, item);
  }
  return order.map((key) => byKey.get(key)!);
}

/** All searchable content, built once at import time (dédupliqué). */
export const searchIndex: SearchItem[] = dedupeSearchItems([
  // Pages statiques
  { title: "Accueil", description: "Tech Speak'Her, communauté de femmes de la tech toulousaine", url: "/", category: "Page" },
  { title: "À propos", description: "Notre mission, nos valeurs, qui on est", url: "/a-propos", category: "Page" },
  { title: "Tremplin DevFest 2026", description: "Programme, inscriptions, prix, FAQ du Tremplin", url: "/tremplin", category: "Page" },
  {
    title: "Montée sur scène 2026",
    description:
      "L'accompagnement des speakeuses après la soirée Tremplin, jusqu'à la scène du DevFest Toulouse",
    url: "/tremplin/devfest-toulouse/2026/montee-sur-scene",
    category: "Page",
  },
  { title: "DevFest Toulouse", description: "Tech Speak'Her au DevFest Toulouse : le Tremplin et les femmes de la tech sur scène", url: "/devfest-toulouse", category: "Page" },
  { title: "Annuaire speakeuses", description: "Les speakeuses de la communauté Tech Speak'Her", url: "/speakeuses", category: "Page" },
  { title: "Agenda des speakeuses", description: "Où et quand les speakeuses prennent la parole : les dates à venir, et la mémoire des années passées", url: "/agenda", category: "Page" },
  { title: "Actualités", description: "Meetups, talks, interviews, Tremplin, communauté", url: "/actualites", category: "Page" },
  { title: "Partenaires", description: "Comment soutenir Tech Speak'Her", url: "/partenaires", category: "Page" },
  { title: "Devenir bénévole", description: "Coacher, faire partie du jury, organiser un meetup", url: "/benevole", category: "Page" },
  { title: "Kit de communication", description: "Logos, couleurs et typographies à télécharger", url: "/kit-de-communication", category: "Page" },
  { title: "Contact", description: "Nous contacter", url: "/contact", category: "Page" },
  { title: "Code de conduite", description: "Nos règles pour des événements inclusifs et bienveillants", url: "/code-de-conduite", category: "Page" },

  // Speakeuses et contenus éditoriaux : PAS ici. Ils viennent de la base
  // (profils et contenus publiés) via /api/search/speakeuses et
  // /api/search/contenus, fusionnés côté client (cf. SearchBar). L'index
  // statique ne couvre que ce qui vit dans le code : les pages et la FAQ.

  // FAQ — ses réponses sont l'éditorial d'UNE édition, et l'ancre #faq ne vit
  // que sur la page de celle-ci (le lien pointait /tremplin#faq, une ancre
  // absente ; dette P1). Dérivée d'`editionEditoriale` : le jour où
  // l'éditorial déménage, ce lien suit tout seul.
  ...faq.map((f) => ({
    title: f.q,
    description: f.a,
    url: `/tremplin/${editionEditoriale.confSlug}/${editionEditoriale.annee}#faq`,
    category: "FAQ",
  })),
]);
