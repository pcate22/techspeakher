import type { ReactNode } from "react";

/**
 * Groupe de filtres d'une liste : il porte le `role="group"` et son intitulé,
 * pour qu'un nouvel écran de filtre ne puisse pas les oublier — c'est l'intitulé
 * du groupe qui distingue deux jeux de filtres voisins (et deux boutons
 * homonymes, ex. « Tout » par statut et « Tout » par catégorie).
 *
 * Ne JAMAIS remplacer par `tablist`/`tab` : le motif ARIA promet une navigation
 * aux flèches, un tabindex baladeur et un `tabpanel` associé que des filtres de
 * liste n'ont pas, et l'annonce « onglet 2 sur 5 » devient un mensonge
 * (RGAA 7.1 / 7.3). Détail dans `FilterChip`.
 *
 * La sémantique de SÉLECTION reste aux boutons (`aria-pressed`), fidèle à la
 * philosophie de `FilterChip` : le parent décide, le composant habille.
 */
export default function FilterGroup({
  label,
  className = "",
  children,
}: {
  /** Intitulé du groupe, ex. « Filtrer par catégorie ». */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className={className}>
      {children}
    </div>
  );
}
