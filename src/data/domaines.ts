/**
 * Taxonomie cadrée pour les profils speakeuses (vocabulaire contrôlé).
 * Source unique : sert aux cases à cocher du profil ET aux filtres de l'annuaire.
 * Deux axes :
 *   - SECTEURS : le domaine d'activité (santé, finance…)
 *   - SUJETS   : le métier / thème tech (IA, cloud…)
 * Les valeurs hors liste sont ignorées. Ajuste librement ces listes :
 * elles pilotent automatiquement le formulaire et les filtres.
 */
export const SECTEURS = [
  "MedTech / Santé",
  "Fintech / Finance / Assurance",
  "RH / HRTech",
  "Achats / Procurement / Supply chain",
  "Industrie / Manufacturing",
  "Secteur public / Gouvernement",
  "E-commerce / Retail",
  "Éducation / EdTech",
  "Énergie / Environnement",
  "Mobilité / Automobile / Aérospatial",
  "Médias / Culture",
  "Juridique / LegalTech",
  "Marketing / AdTech",
  "Autre",
] as const;

export const SUJETS = [
  "IA / Machine Learning / Data",
  "Développement web / Front-end",
  "Mobile",
  "Cloud / DevOps / Infra",
  "Cybersécurité",
  "UX / Design / Accessibilité",
  "Produit / Agilité",
  "Leadership / Soft skills",
  "Recherche / Académique (PhD)",
  "Innovation / R&D",
  "Autre",
] as const;

/**
 * Zones d'intervention : où la speakeuse se déplace pour parler.
 * REGIONS (la liste complète, cases à cocher + filtres annuaire) est CONSTRUITE
 * à partir des trois blocs — la partition est structurelle, pas maintenue à la
 * main : ajouter une zone dans le bon bloc suffit.
 */
/** Raccourci « je vais partout en France » : cocher coche les 13 régions. */
export const REGION_TOUTE_LA_FRANCE = "Toute la France";

/** Les 13 régions administratives métropolitaines. */
export const REGIONS_METROPOLE = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
] as const;

/** Zones indépendantes du raccourci « Toute la France ». */
const REGIONS_HORS_FRANCE = ["International", "À distance (visio)"] as const;

export const REGIONS = [
  REGION_TOUTE_LA_FRANCE,
  ...REGIONS_METROPOLE,
  ...REGIONS_HORS_FRANCE,
] as const;

/** Langues dans lesquelles la speakeuse peut intervenir. */
export const LANGUES = [
  "Français",
  "Anglais",
  "Espagnol",
  "Italien",
  "Allemand",
] as const;

export type Secteur = (typeof SECTEURS)[number];
export type Sujet = (typeof SUJETS)[number];

/** Ne garde que les valeurs présentes dans `list` (liste blanche), dédoublonnées. */
function whitelist(list: readonly string[], values: string[]): string[] {
  const allowed = new Set<string>(list);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (allowed.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export const filterSecteurs = (values: string[]): string[] =>
  whitelist(SECTEURS, values);
export const filterSujets = (values: string[]): string[] =>
  whitelist(SUJETS, values);
export const filterRegions = (values: string[]): string[] =>
  whitelist(REGIONS, values);
export const filterLangues = (values: string[]): string[] =>
  whitelist(LANGUES, values);

/**
 * Sujet qu'une speakeuse propose mais n'a pas encore donné : pas de date.
 * Pensé pour celles qui débutent — la mission de l'asso est de les aider à se lancer.
 */
export const TALK_PROPOSAL = "Sujet proposé";

/** Type de prise de parole (conférence formelle, meetup, etc.). */
export const TALK_TYPES = [
  "Conférence",
  "Meetup",
  "Workshop",
  "Table ronde",
  "Quickie / Lightning",
  TALK_PROPOSAL,
  "Autre",
] as const;

export type TalkType = (typeof TALK_TYPES)[number];

/** Renvoie un type valide ("Conférence" par défaut si vide/inconnu). */
export function normalizeTalkType(value: string): TalkType {
  const t = value.trim();
  return (TALK_TYPES as readonly string[]).includes(t)
    ? (t as TalkType)
    : "Conférence";
}
