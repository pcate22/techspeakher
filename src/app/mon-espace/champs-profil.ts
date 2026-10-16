/**
 * Registre des champs du formulaire de profil : leur libellé (pour le bandeau
 * récapitulatif), l'étape qui les porte (pour y ramener sur erreur) et, quand il
 * faut le dire autrement qu'à la forme générique, le message du champ requis.
 *
 * Extrait du composant : ce sont des données pures, et la dérivation de message
 * se teste seule — jsdom ne pose pas le «\u00a0dirty value flag\u00a0» sur une affectation
 * programmatique, donc `tooLong` n'y est pas reproductible.
 *
 * Une entrée manquante renverrait à l'étape 1 en silence : `champs-profil.test.ts`
 * vérifie que TOUT champ nommé du formulaire figure ici.
 */
export interface ChampProfil {
  libelle: string;
  etape: number;
  /** Message quand le champ requis est vide, à l'impératif-tu comme le reste du
   * produit («\u00a0Ajoute un moyen de contact\u00a0», «\u00a0Coche l'attestation\u00a0»). */
  messageRequis?: string;
}

export const CHAMPS_PROFIL: Record<string, ChampProfil> = {
  nomComplet: {
    libelle: "Prénom et nom",
    etape: 0,
    messageRequis: "Indique ton prénom et ton nom pour enregistrer.",
  },
  slug: { libelle: "Adresse de ta fiche", etape: 0 },
  titreProfil: { libelle: "Titre de profil", etape: 0 },
  poste: { libelle: "Poste actuel", etape: 0 },
  entreprise: { libelle: "Entreprise actuelle", etape: 0 },
  bio: { libelle: "Bio", etape: 0 },
  ville: { libelle: "Ville", etape: 0 },
  linkedin: { libelle: "LinkedIn", etape: 4 },
  website: { libelle: "Site web", etape: 4 },
  instagram: { libelle: "Instagram", etape: 4 },
  sessionizeUrl: { libelle: "Sessionize", etape: 4 },
  conferenceHallUrl: { libelle: "Conference Hall", etape: 4 },
};

/** Libellé d'un champ, ou son nom technique en dernier recours. */
export function libelleChamp(nom: string): string {
  return CHAMPS_PROFIL[nom]?.libelle ?? nom;
}

/**
 * Message d'un champ refusé par le navigateur, DÉRIVÉ du motif réel. Le motif
 * était codé en dur («\u00a0à renseigner\u00a0») : une bio migrée dépassant la limite
 * (`tooLong`) s'affichait donc comme un champ à remplir, et l'enregistrement
 * restait bloqué sans jamais dire qu'il fallait raccourcir.
 */
export function messageRefus(champ: {
  name: string;
  validity: { valueMissing: boolean; tooLong: boolean };
  maxLength?: number;
}): string {
  const def = CHAMPS_PROFIL[champ.name];
  const libelle = def?.libelle ?? "Ce champ";
  if (champ.validity.valueMissing) {
    return def?.messageRequis ?? `${libelle}\u00a0: à renseigner pour enregistrer.`;
  }
  if (champ.validity.tooLong) {
    const borne =
      champ.maxLength && champ.maxLength > 0
        ? ` (${champ.maxLength} caractères maximum)`
        : "";
    return `${libelle}\u00a0: raccourcis le texte pour enregistrer${borne}.`;
  }
  return `${libelle}\u00a0: vérifie la saisie pour enregistrer.`;
}
