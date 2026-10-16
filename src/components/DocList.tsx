import type { ReactNode } from "react";
import ExternalLink, { isSafeHttpUrl } from "@/components/ExternalLink";

/**
 * Forme minimale partagée par `TremplinDocument` et `CoachDocument` : de quoi
 * afficher une entrée de liste sans coupler le composant à un rôle précis.
 */
export type DocListItem = {
  id: number;
  titre: string;
  lien: string | null;
  contenu: string | null;
};

/**
 * Liste de documents MUTUALISÉE (orga, coach, espace participante). Présentation
 * pure : elle affiche ce qu'on lui passe et ne décide d'aucune autorisation.
 *
 * - `action` : nœud optionnel rendu à droite de chaque entrée (ex. la
 *   suppression, dont l'action serveur et le droit dépendent du rôle appelant).
 *   L'appelant décide s'il le fournit (et pour quels documents il est non nul).
 * - `empty` : message affiché quand la liste est vide ; sans lui, on ne rend
 *   rien (le contexte porte déjà le vide).
 *
 * `role="list"` explicite : `list-style: none` retire la sémantique de liste
 * sous certains lecteurs d'écran (Safari/VoiceOver).
 */
export default function DocList<T extends DocListItem>({
  docs,
  empty,
  action,
}: {
  docs: T[];
  empty?: string;
  action?: (doc: T) => ReactNode;
}) {
  if (docs.length === 0) {
    return empty ? <p className="text-sm text-gray-light mt-1">{empty}</p> : null;
  }
  return (
    <ul role="list" className="flex flex-col gap-3 mt-2 list-none">
      {docs.map((d) => {
        const act = action?.(d);
        return (
          <li key={d.id} className="flex items-start justify-between gap-3">
            <span className="min-w-0 flex-1">
              {d.lien && isSafeHttpUrl(d.lien) ? (
                <ExternalLink
                  href={d.lien}
                  // Cible tactile ≥ 44 px : la rangée grandit, les cibles ne se chevauchent pas.
                  className="inline-flex min-h-[44px] items-center text-cyan hover:text-cyan-light underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                >
                  {d.titre}
                </ExternalLink>
              ) : (
                <span className="font-medium">{d.titre}</span>
              )}
              {d.contenu && (
                // React échappe le texte → pas d'injection. `pre-wrap` conserve
                // la mise en page saisie.
                <span className="block text-sm text-gray-light mt-1 whitespace-pre-wrap">
                  {d.contenu}
                </span>
              )}
            </span>
            {act && <span className="shrink-0">{act}</span>}
          </li>
        );
      })}
    </ul>
  );
}
