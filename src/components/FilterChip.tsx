import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Puce de filtre cliquable, partagée par les surfaces qui filtrent une liste
 * (annuaire public, suivi orga des fiches, catégories d'actualités). Purement
 * visuelle : la sémantique de sélection reste au parent, qui passe l'ARIA qui
 * lui convient — en pratique `aria-pressed`, que la sélection soit multiple ou
 * unique. `active` pilote seulement l'apparence sélectionnée / non.
 *
 * L'emballage, lui, appartient à `FilterGroup` : c'est lui qui porte le
 * `role="group"` et l'intitulé du jeu de filtres, pour qu'un nouvel écran ne
 * puisse pas les oublier.
 *
 * Éviter `role="tab"` dans un `tablist` : le motif ARIA promet alors une
 * navigation aux flèches, un tabindex baladeur et un `tabpanel` associé. Un
 * filtre de liste n'a rien de tout ça, et l'annonce « onglet 2 sur 5 » devient
 * un mensonge (RGAA 7.1 / 7.3). Constaté sur `/actualites`, revue du 2026-08-01.
 */
export default function FilterChip({
  active,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
        active
          ? "bg-cyan text-navy"
          : "bg-navy-light text-gray-light border border-field-border hover:border-cyan"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
