/** Shared types for Tech Speak'Her website */

export interface Talk {
  title: string;
  url?: string;
}

export interface Speakeuse {
  name: string;
  role: string;
  tags: string[];
  bio: string;
  talks: Talk[];
  linkedin: string;
  companyInfo?: { name: string; linkedin: string };
  website?: string;
  instagram?: string;
}

export interface BehindTheScenes {
  name: string;
  role: string;
  quote: string;
  context: string;
  insight: string;
  url: string;
}

/**
 * Accord de reprise d'une citation, tel que donné sur le formulaire de
 * satisfaction. `validation_prealable` = « oui, mais validez avec moi avant
 * chaque publication » : la phrase reste hors du site tant que la personne n'a
 * pas revu le texte exact (cf. docs/roadmap.md, « consentement par usage »).
 */
export type ConsentementCitation = "libre" | "validation_prealable";

/** Une parole recueillie, avec l'accord qui la rend publiable ou pas. */
export interface VerbatimRecueilli {
  /** Attribution TELLE QUE CONSENTIE : nom complet (jurées), prénom (participantes). */
  auteur: string;
  /** D'où la personne parle (« Jurée du Tremplin 2026 »). */
  qualite: string;
  citation: string;
  consentement: ConsentementCitation;
}

/** Une parole publiée : le consentement est acquis, la fonction est résolue. */
export interface Verbatim extends Omit<VerbatimRecueilli, "consentement"> {
  /** Fonction affichée sous le nom, reprise de `jury` (jurées seulement). */
  role?: string;
}

export interface Prix {
  place: string;
  reward: string;
  detail?: string;
  color: string;
  ariaLabel: string;
}

export interface FAQ {
  /**
   * Repère stable des entrées qu'une page peut préciser avec SA donnée (ex. la
   * page d'une édition remplace le lien du replay par la vidéo de CETTE
   * édition). Sans identifiant, l'entrée s'affiche telle quelle.
   */
  id?: "replay";
  q: string;
  a: string;
  /** Lien optionnel affiché après la réponse (ex. inscription à la soirée). */
  lien?: { href: string; label: string };
}

export interface AccompagnementTheme {
  number: string;
  title: string;
  description: string;
  done?: boolean;
  /** ISO yyyy-mm-dd — si présent, done est calculé dynamiquement à la revalidation. */
  dateEnd?: string;
  coAnimatrice?: {
    name: string;
    role: string;
    url: string;
  };
}

export interface Resultat {
  place: string;
  nom: string;
  titreTalk?: string;
  linkedin?: string;
}

export interface Jure {
  name: string;
  role: string;
}

export interface DevfestTalk {
  name: string;
  titre: string;
  format: "Conférence" | "Quickie";
  note: string;
  linkedin?: string;
}

export interface Participante {
  name: string;
  role: string;
  bio: string;
  sujet: string;
  linkedin: string;
  website?: string;
}

export interface Partenaire {
  name: string;
  description: string;
  url?: string;
  pending?: boolean;
}

/** Une structure partenaire : qui elle est. CE QU'ELLE FAIT pour nous vit
 * dans `typesSoutien` (src/data/partenaires.ts), une ligne par façon d'aider. */
export interface StructurePartenaire {
  name: string;
  url?: string;
  /** Page du site qui la présente : la carte y mène plutôt que dehors. */
  pageInterne?: string;
  /**
   * La structure nous a soutenus : son lien sortant est divulgué en
   * `rel="sponsored"`. Porté par la donnée et non par la boucle d'affichage,
   * pour que la divulgation suive le partenaire s'il apparaît ailleurs.
   */
  soutien?: boolean;
}

/** Une façon d'aider l'association, et les structures qui le font déjà. */
export interface TypeSoutien {
  id: string;
  titre: string;
  /** La façon d'aider, en une phrase : ce que ça paie ou ce que ça permet. */
  aide: string;
  /** `role` : ce que CETTE structure fait, dans CETTE rangée. */
  membres: { nom: string; role: string }[];
  /** Phrase commune aux cartes, dite une fois au-dessus de la rangée. */
  membresIntro?: string;
  /** Un lien pour toute la rangée, sur le site (ex. le jury du Tremplin). */
  lien?: { href: string; label: string };
}

export interface TremplinStep {
  number: string;
  color: string;
  bg: string;
  border: string;
  title: string;
  description: string;
}
