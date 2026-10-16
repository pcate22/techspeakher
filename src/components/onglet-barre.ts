/**
 * Classe PARTAGÉE d'un onglet de la barre basse : les quatre onglets-liens
 * (BottomNav) et le déclencheur ➕ (FeuilleCreer) doivent rester des frères
 * visuels — deux copies de la chaîne auraient dérivé en silence (même patron
 * que `CARTE_LIEN`). La couleur d'état (actif/repos) reste à l'appelant.
 */
export const ONGLET_BARRE =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
