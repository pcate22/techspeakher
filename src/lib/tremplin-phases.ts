/**
 * Les PHASES d'appartenance d'une inscription — partie PURE (types, libellés).
 *
 * Séparée de `tremplin-registration-phases.ts`, qui ouvre la base : un composant
 * CLIENT a besoin des libellés (le choix d'audience d'un atelier les affiche),
 * et importer le module d'accès aurait tiré `pg` dans le bundle navigateur.
 * Rien ici ne touche à la base, donc rien ici ne peut y entraîner qui que ce soit.
 */
export type MembershipPhase = "cfp_et_pitch" | "montee_sur_scene";

export function isMembershipPhase(v: unknown): v is MembershipPhase {
  return v === "cfp_et_pitch" || v === "montee_sur_scene";
}

/**
 * Libellés des phases d'APPARTENANCE — on nomme une COHORTE DE PERSONNES
 * (« les 6 participantes de la phase "Préparation au CFP" »).
 *
 * À ne pas confondre avec `PHASE_ATELIER_LABEL` (« Avant la soirée »), qui
 * situe un ATELIER dans le programme. Même valeur d'enum, deux registres : dès
 * qu'une phrase parle de personnes, c'est cette table-ci — sinon deux écrans
 * voisins nomment le même groupe de deux façons. (La finale a son propre
 * libellé côté inscriptions, cf. PHASE_ENTREE_LABEL.)
 */
export const MEMBERSHIP_PHASE_LABEL: Record<MembershipPhase, string> = {
  cfp_et_pitch: "Préparation au CFP",
  montee_sur_scene: "Préparation à la conférence",
};

/** Ordre d'affichage des phases (la finale s'intercale au milieu). */
export const MEMBERSHIP_PHASES: readonly MembershipPhase[] = [
  "cfp_et_pitch",
  "montee_sur_scene",
] as const;
