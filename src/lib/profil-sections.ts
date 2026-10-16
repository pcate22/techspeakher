/**
 * Les SECTIONS de la fiche speakeuse — SOURCE UNIQUE (lot I).
 *
 * La fiche se consulte (« Ma fiche » montre ce que le public voit) et s'édite
 * section par section : un crayon par section ouvre une page qui ne porte QUE
 * cette section, avec son propre « Enregistrer ». C'est le geste de LinkedIn, et
 * c'est aussi la règle d'or du projet (une page = un rôle, un CTA principal) —
 * l'assistant en six étapes reste réservé à la CRÉATION, où l'on veut être guidée.
 *
 * `champs` n'est pas décoratif : c'est lui qui BORNE l'enregistrement. Le
 * formulaire de profil écrivait tout l'enregistrement d'un coup ; une page qui ne
 * soumet que ses propres champs viderait donc tous les autres. Chaque section
 * n'écrit que les colonnes de ses champs, et `profil-sections.test.ts` tient les
 * deux invariants qui rendent ça sûr : aucun champ orphelin (il deviendrait
 * inéditable), aucun champ dans deux sections (l'une écraserait l'autre).
 */

export type CleSection =
  | "identite"
  | "secteurs"
  | "sujets"
  | "interventions"
  | "contact"
  | "attestation";

export interface SectionProfil {
  cle: CleSection;
  /** Titre de la section, sur la fiche comme en tête de sa page d'édition. */
  titre: string;
  /** Ce que la section apporte, dit à la speakeuse — jamais un nom de champ. */
  aide: string;
  /** Champs de formulaire que la section porte, et donc qu'elle peut écrire. */
  champs: readonly string[];
  /**
   * Ce que la section dit quand elle n'a rien — à la forme POSITIVE (« Aucun
   * secteur choisi », jamais « pas de secteur » ni « 0 secteur »).
   *
   * Ici et pas dans la vue : la fiche décide d'afficher un bloc selon `estVide`,
   * et affichait cette phrase depuis une AUTRE source. Les deux avaient déjà
   * divergé — une fiche dont le seul lien était Sessionize s'affichait « vide »
   * tout en listant « Sessionize ».
   */
  vide: string;
  /**
   * La section n'a rien à montrer. Pure : elle sert à la fois à masquer le bloc
   * en vue publique et à afficher `vide` en vue propriétaire.
   */
  estVide: (p: EtatSection) => boolean;
}

/** Un champ texte compte comme rempli s'il a autre chose que des espaces — la
 * MÊME règle que la jauge de complétude (`src/lib/completude.ts`). Sans elle, une
 * bio réduite à trois espaces rendait la fiche « remplie » et la jauge « à
 * faire » : deux écrans qui décrivent la même fiche différemment, ce que ce
 * registre existe précisément pour empêcher. */
const rempli = (v: string | null | undefined): boolean => Boolean(v?.trim());

/** Le strict nécessaire pour juger qu'une section est vide — pas tout le profil,
 * pour que le registre reste testable sans fixture complète. */
export interface EtatSection {
  titreProfil: string | null;
  poste: string | null;
  /** Dans l'état parce qu'elle S'AFFICHE (le sous-titre « poste · entreprise ») :
   * l'oublier faisait dire « ton nom seul » à une fiche qui montrait « Airbus ». */
  entreprise: string | null;
  bio: string | null;
  ville: string | null;
  secteurs: readonly string[];
  sujets: readonly string[];
  regions: readonly string[];
  langues: readonly string[];
  linkedin: string | null;
  website: string | null;
  instagram: string | null;
  contactEmailOk: boolean;
  isWoman: boolean;
}

export const SECTIONS_PROFIL: readonly SectionProfil[] = [
  {
    cle: "identite",
    titre: "Qui tu es",
    aide: "Ton nom, ton titre de profil, ton poste, ta ville et ta bio : l'en-tête de ta fiche, ce qu'on lit en premier.",
    // Le périmètre suit l'EN-TÊTE de la fiche : un crayon en haut ouvre tout ce
    // qui s'y affiche, sans qu'on aille chercher la ville dans une autre page.
    // `nomComplet` vit sur le COMPTE (users.name) et `slug` sur l'URL : deux
    // écritures à part, gardées ici parce qu'elles s'éditent au même endroit.
    // Les quatre champs de ville voyagent ensemble (l'autocomplétion BAN les
    // renseigne d'un bloc) : ils ne peuvent pas être séparés.
    champs: [
      "nomComplet",
      "slug",
      "titreProfil",
      "poste",
      "entreprise",
      "ville",
      "codePostal",
      "codeInsee",
      "regionResidence",
      "bio",
    ],
    vide: "Ton nom seul pour l'instant : un titre et deux lignes de bio changent tout.",
    // Le nom vient du COMPTE et existe toujours : c'est ce qu'on AJOUTE autour
    // qui manque ou pas. `entreprise` compte, car elle s'affiche.
    estVide: (p) =>
      !rempli(p.titreProfil) &&
      !rempli(p.poste) &&
      !rempli(p.entreprise) &&
      !rempli(p.bio) &&
      !rempli(p.ville),
  },
  {
    cle: "secteurs",
    titre: "Tes secteurs",
    aide: "Les domaines dans lesquels tu travailles : les organisatrices filtrent l'annuaire avec.",
    champs: ["secteurs"],
    vide: "Aucun secteur choisi.",
    estVide: (p) => p.secteurs.length === 0,
  },
  {
    cle: "sujets",
    titre: "Tes sujets",
    aide: "Ce dont tu parles ou aimerais parler en conférence.",
    champs: ["sujets"],
    vide: "Aucun sujet choisi.",
    estVide: (p) => p.sujets.length === 0,
  },
  {
    cle: "interventions",
    titre: "Où tu interviens",
    // La VILLE (où tu es basée) vit dans l'en-tête ; ici c'est la portée : où tu
    // te déplaces et dans quelles langues. Deux questions différentes.
    aide: "Les régions où tu te déplaces et les langues dans lesquelles tu parles : les organisatrices filtrent l'annuaire avec.",
    champs: ["regions", "langues"],
    vide: "Aucune zone ni langue choisie.",
    estVide: (p) => p.regions.length === 0 && p.langues.length === 0,
  },
  {
    cle: "contact",
    titre: "Où te trouver",
    aide: "Tes liens publics et le relais e-mail. Ton adresse e-mail n'est jamais affichée.",
    champs: [
      "linkedin",
      "website",
      "instagram",
      "sessionizeUrl",
      "conferenceHallUrl",
      "contactEmailOk",
      // Rendue dans cette section (sous « Autres liens ») : sans elle ici, la
      // case se décochait à l'écran et revenait cochée après enregistrement.
      "cfpSuggestionsOk",
    ],
    vide: "Aucun moyen de te joindre pour l'instant.",
    // Sessionize et Conference Hall n'entrent PAS ici : ce sont des portfolios de
    // talks, ils s'affichent dans « Talks & conférences », pas dans le contact.
    estVide: (p) =>
      !rempli(p.linkedin) && !rempli(p.website) && !rempli(p.instagram) && !p.contactEmailOk,
  },
  {
    cle: "attestation",
    titre: "Ton attestation",
    // Recueillie à la création, mais éditable ensuite : sans page, une fiche
    // dont l'attestation manque affichait « Coche l'attestation » avec un lien
    // qui ne menait nulle part.
    aide: "L'appartenance à la communauté, requise pour figurer dans l'annuaire.",
    champs: ["isWoman"],
    vide: "À signer pour figurer dans l'annuaire.",
    estVide: (p) => !p.isWoman,
  },
] as const;

/**
 * Accès par clé, TOTAL : `Record<CleSection, …>` fait échouer la compilation si
 * une clé de l'union n'a pas son entrée. C'est ce que `sectionParCle` ne peut pas
 * offrir (elle rend `null` à dessein, pour les clés venues d'une URL) — et le
 * cast qui écartait ce `null` transformait une erreur de type en plantage au
 * rendu, sur l'annuaire public.
 */
export const SECTION_PAR_CLE: Record<CleSection, SectionProfil> = Object.fromEntries(
  SECTIONS_PROFIL.map((s) => [s.cle, s]),
) as Record<CleSection, SectionProfil>;

/** Clés reconnues dans l'URL (`/mon-espace/fiche/[section]`). */
export const CLES_SECTION: readonly CleSection[] = SECTIONS_PROFIL.map((s) => s.cle);

/**
 * Section d'une clé d'URL, ou `null`. Passer par ici : une lecture directe
 * répondrait aussi aux clés du prototype (`?section=constructor`), et l'appelant
 * doit pouvoir répondre `notFound()` plutôt que retomber en silence sur une
 * section arbitraire.
 */
export function sectionParCle(cle: string | undefined): SectionProfil | null {
  if (!cle) return null;
  return SECTIONS_PROFIL.find((s) => s.cle === cle) ?? null;
}

/** Section qui porte un champ de formulaire, ou `null` s'il n'est porté nulle part. */
export function sectionDuChamp(nom: string): SectionProfil | null {
  return SECTIONS_PROFIL.find((s) => s.champs.includes(nom)) ?? null;
}
