/**
 * Segments d'URL des sous-pages d'une entité → libellés du fil de contexte
 * (`FilEntite`). SOURCE UNIQUE, partagée par les layouts `[registration]` et
 * `[atelier]`, et VÉRIFIÉE contre les dossiers réels par `fil-sous-pages.test.ts`
 * (sinon l'ajout d'une sous-page sans libellé masquerait silencieusement le
 * niveau dans le fil).
 */
export const PARTICIPANTE_SOUS_PAGES: Record<string, string> = {
  visibilite: "Visibilité",
  classement: "Classement au podium",
  parcours: "Parcours",
  recompenses: "Récompenses",
  coaching: "Coaching",
  ateliers: "Ateliers",
  talk: "Talk",
  compte: "Compte",
  documents: "Documents",
  retrait: "Retrait",
};

export const ATELIER_SOUS_PAGES: Record<string, string> = {
  infos: "Informations",
  visio: "Lien visio",
  coachs: "Coachs",
  presences: "Participantes",
  "sous-groupes": "Sous-groupes",
  documents: "Documents",
  retrait: "Suppression",
};

export const RECOMPENSE_SOUS_PAGES: Record<string, string> = {
  intitule: "Intitulé et rang",
  beneficiaire: "Bénéficiaire",
  suivi: "Suivi de l'événement",
  retrait: "Suppression",
};
