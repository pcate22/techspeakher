import type { ReactNode } from "react";

/**
 * Région vivante d'un écran qui FILTRE : elle annonce le résultat du filtre
 * (« 3 fiches au statut Publiée »), là où le titre de la liste, lui, ne
 * s'annonce pas quand il change.
 *
 * Deux invariants qu'elle fait respecter aux appelants :
 * - **permanente** : la région doit exister dès le premier rendu, une région
 *   insérée après coup n'est pas annoncée de façon fiable ;
 * - **elle ne porte QUE le résumé**. Y mettre le message de vide fait annoncer
 *   « rien à afficher » quand c'est le filtre qui ne ramène rien. Le vide vit
 *   dans son propre paragraphe, visible.
 *
 * Le TEXTE, lui, se compose chez l'appelant : chaque écran filtre sur ses
 * dimensions (statut ; phase + recherche ; catégorie + statut). On normalise au
 * bord (`docs/principes-conception-ui.md` §7) plutôt que de forcer une forme
 * unique. Nommer le filtre actif y est essentiel : deux filtres qui rendent le
 * même compte donnent sinon le même texte, donc un DOM inchangé, donc aucune
 * annonce.
 */
export default function LiveStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
