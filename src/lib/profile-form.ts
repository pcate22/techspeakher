import { z } from "zod";
import type { ProfileInput } from "@/lib/profiles";
import { slugify } from "@/lib/slug";
import { uneSeuleLigne } from "@/lib/format";
import {
  filterSecteurs,
  filterSujets,
  filterRegions,
  filterLangues,
  REGIONS_METROPOLE,
  REGION_TOUTE_LA_FRANCE,
} from "@/data/domaines";
// Bornes partagées avec le formulaire client (compteur de caractères,
// `maxLength`) : définies dans `profile-limits.ts`, sans Zod.
import { BIO_MAX as MAX_BIO, SHORT_MAX as MAX_SHORT } from "@/lib/profile-limits";

const MAX_TAGS = 10;
const MIN_SLUG = 3;
const MAX_SLUG = 60;

/**
 * Normalise et valide le slug d'URL personnalisé (façon LinkedIn). Champ vide →
 * `null` (l'action auto-dérivera l'adresse depuis le nom). Sinon on slugifie
 * (espaces, points, underscores, majuscules et accents ramenés à la forme
 * canonique « lettres-chiffres-tirets »), puis on borne. Fonction PURE (testée
 * sans base) ; l'UNICITÉ est vérifiée à part, côté action.
 *
 * Un slug tout en chiffres est refusé : il masquerait un id numérique (les URL
 * `/speakeuses/57` restent réservées à la résolution par id).
 */
export function normalizeProfileSlug(
  raw: string,
): { slug: string | null } | { error: string } {
  if (raw.trim() === "") return { slug: null };
  const s = slugify(raw);
  if (s === "")
    return { error: "Adresse invalide : utilise des lettres et des chiffres." };
  if (s.length < MIN_SLUG)
    return { error: `Adresse trop courte (${MIN_SLUG} caractères minimum).` };
  if (s.length > MAX_SLUG)
    return { error: `Adresse trop longue (${MAX_SLUG} caractères maximum).` };
  if (/^\d+$/.test(s))
    return {
      error:
        "Ajoute au moins une lettre : les adresses tout en chiffres sont réservées.",
    };
  return { slug: s };
}

/** Vrai si la chaîne ressemble à une adresse e-mail (forme + longueur ≤ 254). */
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Champ texte optionnel : trim, longueur max, "" → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Trop long (max ${max} caractères)`)
    .transform((v) => (v === "" ? null : v));

/**
 * Champ d'UNE ligne, saisi dans une zone multi-lignes (pour qu'une valeur longue
 * se relise en entier). La touche Entrée et un copier-coller peuvent y glisser
 * des retours à la ligne, alors que la fiche rend ces valeurs en une ligne
 * (titre, poste, entreprise, ville) : on replie donc les blancs AU BORD plutôt
 * que de stocker une valeur qui ne se réaffichera jamais telle quelle (§7).
 * La bio garde `optionalText` : ses paragraphes sont voulus.
 */
export const oneLineText = (max: number) =>
  z
    .string()
    .transform(uneSeuleLigne)
    .pipe(optionalText(max));

/** Vrai si la chaîne est une URL http(s) avec un nom de domaine plausible. */
function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

/**
 * URL optionnelle, tolérante : "" → null. On accepte sans schéma
 * (« exemple.com », « www.exemple.com ») en préfixant https:// automatiquement,
 * et la casse du schéma est normalisée (HTTPS:// → https://).
 */
export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => {
    if (v === "") return "";
    const scheme = /^https?:\/\//i.test(v)
      ? v.replace(/^https?:\/\//i, (m) => m.toLowerCase())
      : `https://${v}`;
    return scheme;
  })
  .refine((v) => v === "" || isValidHttpUrl(v), "Adresse invalide (ex. exemple.com)")
  .transform((v) => (v === "" ? null : v));

const schema = z.object({
  titreProfil: oneLineText(MAX_SHORT),
  poste: oneLineText(MAX_SHORT),
  entreprise: oneLineText(MAX_SHORT),
  bio: optionalText(MAX_BIO),
  ville: oneLineText(MAX_SHORT),
  // Localisation structurée (renseignée par l'autocomplétion BAN, champs cachés).
  codePostal: optionalText(10),
  codeInsee: optionalText(12),
  regionResidence: optionalText(MAX_SHORT),
  website: optionalUrl,
  linkedin: optionalUrl,
  instagram: optionalUrl,
  sessionizeUrl: optionalUrl,
  conferenceHallUrl: optionalUrl,
});

/**
 * Invariant « Toute la France » ⇔ les 13 régions métropolitaines :
 * le raccourci implique toutes les régions, et toutes les régions impliquent
 * le raccourci (sinon le filtre annuaire par région raterait la speakeuse).
 */
export function normalizeRegions(regions: string[]): string[] {
  const set = new Set(regions);
  if (set.has(REGION_TOUTE_LA_FRANCE)) {
    for (const r of REGIONS_METROPOLE) set.add(r);
  } else if (REGIONS_METROPOLE.every((r) => set.has(r))) {
    set.add(REGION_TOUTE_LA_FRANCE);
  }
  return Array.from(set);
}

/**
 * Première erreur Zod par champ (clé → message) : helper partagé des parseurs
 * de formulaires (profil, talk, conférences) — une seule mise en forme.
 */
export function firstErrors(issues: z.ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Lecture chaîne d'un champ FormData (absent → ""). */
export function formString(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString();
}

export type ProfileFormResult =
  | { ok: true; data: ProfileInput }
  | { ok: false; errors: Record<string, string> };

/** Résultat d'un parse PARTIEL : seuls les champs demandés sont présents. Un
 * champ absent vaut « inchangé » — jamais « effacé ». */
export type ProfileChampsResult =
  | { ok: true; data: Partial<ProfileInput> }
  | { ok: false; errors: Record<string, string> };

/** Tous les champs du profil, dans l'ordre du formulaire de création. */
const TOUS_LES_CHAMPS: readonly string[] = [
  "slug",
  "titreProfil",
  "poste",
  "entreprise",
  "bio",
  "ville",
  "codePostal",
  "codeInsee",
  "regionResidence",
  "website",
  "linkedin",
  "instagram",
  "sessionizeUrl",
  "conferenceHallUrl",
  "secteurs",
  "sujets",
  "regions",
  "langues",
  "contactEmailOk",
  "isWoman",
  "cfpSuggestionsOk",
];

/** Les champs du schéma zod (texte et URL), par opposition aux listes et cases. */
const CHAMPS_TEXTE = Object.keys(schema.shape) as (keyof typeof schema.shape)[];

/**
 * Valide et normalise LES CHAMPS DEMANDÉS du formulaire profil (entrées non
 * fiables). Le périmètre est explicite parce que la fiche s'édite section par
 * section (lot I) : une page qui ne soumet que ses propres champs ne doit
 * toucher à aucune autre colonne, et ne doit pas non plus RE-VALIDER ce qui est
 * déjà en base — une bio migrée trop longue bloquerait sinon l'édition des
 * sujets, sur un message pointant un champ absent de l'écran.
 *
 * Les règles de cohérence qui traversent les sections (ville ↔ localisation,
 * zone d'intervention déduite de la résidence) ne sont PAS ici : elles ont
 * besoin du profil entier, et vivent dans `normaliserProfil`.
 */
export function parseProfilChamps(
  formData: FormData,
  champs: readonly string[],
): ProfileChampsResult {
  const veut = (nom: string) => champs.includes(nom);
  const data: Partial<ProfileInput> = {};
  const errors: Record<string, string> = {};

  const champsTexte = CHAMPS_TEXTE.filter(veut);
  if (champsTexte.length > 0) {
    const raw = Object.fromEntries(
      champsTexte.map((k) => [k, formString(formData, k)]),
    );
    const parsed = schema.pick(
      Object.fromEntries(champsTexte.map((k) => [k, true])) as never,
    ).safeParse(raw);
    if (parsed.success) Object.assign(data, parsed.data);
    else Object.assign(errors, firstErrors(parsed.error.issues));
  }

  // Slug d'URL : validé hors schéma zod (normalisation via slugify + bornes),
  // agrégé aux mêmes erreurs pour un retour unique.
  if (veut("slug")) {
    const slugRes = normalizeProfileSlug(formString(formData, "slug"));
    if ("error" in slugRes) errors.slug = slugRes.error;
    else data.slug = slugRes.slug;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Secteurs & sujets : listes blanches (cases à cocher) → filtrables dans l'annuaire.
  if (veut("secteurs")) {
    data.secteurs = filterSecteurs(formData.getAll("secteurs").map(String)).slice(0, MAX_TAGS);
  }
  if (veut("sujets")) {
    data.sujets = filterSujets(formData.getAll("sujets").map(String)).slice(0, MAX_TAGS);
  }
  // Régions/langues : bornées par la liste blanche (dédoublonnée), pas besoin
  // d'autre plafond.
  if (veut("regions")) {
    data.regions = filterRegions(formData.getAll("regions").map(String));
  }
  if (veut("langues")) {
    data.langues = filterLangues(formData.getAll("langues").map(String));
  }
  // Cases à cocher : une case DANS le périmètre et décochée vaut bien `false`
  // (c'est un retrait volontaire) ; hors périmètre, elle reste simplement absente.
  if (veut("contactEmailOk")) data.contactEmailOk = formData.get("contactEmailOk") != null;
  if (veut("isWoman")) data.isWoman = formData.get("isWoman") != null;
  // Consentement moissonneur : case cochée = suggestions, décochée = aucun.
  // (Le mode 'auto' n'est pas exposé dans le formulaire pour l'instant.)
  if (veut("cfpSuggestionsOk")) {
    data.cfpSyncMode =
      formData.get("cfpSuggestionsOk") != null ? ("suggestions" as const) : ("aucun" as const);
  }

  return { ok: true, data };
}

/**
 * Les règles de COHÉRENCE du profil entier, appliquées après toute écriture —
 * parcours de création comme enregistrement d'une seule section. Elles ne
 * peuvent pas vivre dans le parseur : la seconde relie deux champs qui vivent
 * dans DEUX sections différentes, et une page qui n'en soumet qu'une ne voit
 * pas l'autre. Idempotente : la rejouer sur un profil déjà normalisé ne change
 * rien.
 */
export function normaliserProfil(p: ProfileInput): ProfileInput {
  // La localisation structurée (CP/INSEE/région) n'a de sens qu'attachée à une
  // ville. Sans ville, on repart de zéro (pas de données résiduelles d'une
  // commune retirée).
  const villePresente = Boolean(p.ville);
  const codePostal = villePresente ? p.codePostal : null;
  const codeInsee = villePresente ? p.codeInsee : null;
  const regionResidence = villePresente ? p.regionResidence : null;

  // Cohérence annuaire : si AUCUNE zone d'intervention n'est choisie mais qu'on
  // connaît la région de résidence (⊂ métropole), on la propose PAR DÉFAUT
  // comme zone d'intervention. La speakeuse apparaît ainsi dans le filtre
  // « région » de l'annuaire pour sa région, au lieu d'être invisible. Reste
  // éditable : un choix explicite (même vide volontaire après coup) n'est
  // jamais écrasé — on ne remplit que quand la sélection est vide.
  const regions =
    p.regions.length === 0 &&
    regionResidence &&
    (REGIONS_METROPOLE as readonly string[]).includes(regionResidence)
      ? [regionResidence]
      : p.regions;

  return {
    ...p,
    codePostal,
    codeInsee,
    regionResidence,
    // L'invariant « Toute la France » ⇔ les 13 régions est normalisé ICI
    // (source de vérité serveur) : le confort de cochage côté client n'est
    // qu'un sucre, un POST sans JS reste cohérent.
    regions: normalizeRegions(regions),
  };
}

/** Profil vide : le socle sur lequel le parcours de CRÉATION dépose sa saisie. */
const PROFIL_VIDE: ProfileInput = {
  slug: null,
  titreProfil: null,
  poste: null,
  entreprise: null,
  bio: null,
  website: null,
  linkedin: null,
  instagram: null,
  sessionizeUrl: null,
  conferenceHallUrl: null,
  ville: null,
  codePostal: null,
  codeInsee: null,
  regionResidence: null,
  regions: [],
  langues: [],
  secteurs: [],
  sujets: [],
  contactEmailOk: false,
  isWoman: false,
  cfpSyncMode: "aucun",
};

/**
 * Valide et normalise TOUT le formulaire profil (parcours de création, où l'on
 * saisit d'un bloc). L'édition d'une fiche existante passe par
 * `parseProfilChamps` + `normaliserProfil`, section par section.
 */
export function parseProfileForm(formData: FormData): ProfileFormResult {
  const r = parseProfilChamps(formData, TOUS_LES_CHAMPS);
  if (!r.ok) return r;
  return { ok: true, data: normaliserProfil({ ...PROFIL_VIDE, ...r.data }) };
}
