import type { ReactNode } from "react";

/**
 * Coque STANDARD d'une page liste d'un domaine (ateliers, photos, récompenses,
 * ressources…) : en-tête (titre `h1` + méta), zone de création optionnelle,
 * puis le contenu de liste. Le fil d'Ariane et la sous-nav d'édition sont
 * rendus par le layout `[edition]` (lot C3). Garantit la même structure, le
 * même espacement et la même a11y (un seul `h1`) partout.
 *
 * La création vit ICI (slot `create`), pas sur le hub. Le contenu de liste
 * (les `NavRow` ou l'état vide) est passé en `children` — le composant ne
 * décide pas de la forme de la liste.
 */
export default function ListPageTemplate({
  title,
  meta,
  create,
  children,
}: {
  title: string;
  meta?: ReactNode;
  create?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Un <div>, PAS un <main> : le layout racine fournit déjà le landmark
    // principal (`#main-content`) — un second <main> imbriqué est invalide
    // (RGAA 8.2) et double la région principale pour les lecteurs d'écran.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">{title}</h1>
          {meta && <p className="text-sm text-gray-light mt-1">{meta}</p>}
        </header>
        {create && <div>{create}</div>}
        {children}
      </div>
    </div>
  );
}
