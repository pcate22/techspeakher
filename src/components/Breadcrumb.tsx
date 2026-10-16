import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * Fil d'Ariane réutilisable et accessible, COLLANT sous l'en-tête (`top-16` =
 * hauteur du header sticky) : l'orientation reste à l'écran quand on scrolle une
 * page longue. Le dernier élément (sans href) est la page courante
 * (`aria-current="page"`).
 *
 * Repli mobile : les fils sont longs (Accueil › Espace orga › Tremplins ›
 * Édition › Section) et déborderaient sur deux lignes. Sur petit écran on ne
 * montre que les TROIS derniers niveaux : `… › [grand-parent] › [parent] ›
 * [courant]`. Le « … » est purement décoratif (`aria-hidden`) : les niveaux
 * repliés ne sont pas retirés de l'arbre d'accessibilité (`sr-only`, pas
 * `display:none`), donc les lecteurs d'écran lisent toujours le chemin COMPLET,
 * et le SEO le voit aussi. Dès `sm`, tout le chemin est affiché.
 *
 * Page courante longue (un fil nommé d'après une donnée : titre de talk, nom
 * d'atelier) : elle est la SEULE à se couper, avec une ellipsis CSS. Le fil ne
 * défile plus horizontalement — il sortait de l'écran, la page courante se lisait
 * par bouts et les ancêtres cliquables pouvaient sortir du champ. La coupe est
 * purement visuelle : le libellé reste entier dans le DOM (a11y, SEO), et le
 * titre complet se lit dans la page (champ de saisie, en-tête).
 */
const NIVEAUX_VISIBLES = 3;

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  // On replie dès qu'il y a un ancêtre au-delà des trois derniers niveaux.
  const replie = items.length > NIVEAUX_VISIBLES;

  return (
    <div className="sticky top-16 z-40 border-b border-navy-lighter bg-navy/95 backdrop-blur-sm">
      <nav
        aria-label="Fil d'Ariane"
        // Défilement gardé EN SECOURS : la coupe de la page courante suffit dans
        // tous les cas réels, mais si les ancêtres débordaient à eux seuls, un
        // maillon cliquable ne doit pas devenir hors d'atteinte.
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto"
      >
        <ol className="flex items-center gap-x-2 whitespace-nowrap text-sm text-gray-light list-none">
          {/* Ellipsis décoratif (mobile uniquement) : signale les niveaux
              repliés sans les nommer — le chemin complet est lu via les <li>
              sr-only ci-dessous. */}
          {replie && (
            <li aria-hidden="true" className="flex shrink-0 items-center gap-2 sm:hidden">
              <span>…</span>
              <span className="text-gray-light">›</span>
            </li>
          )}
          {items.map((item, i) => {
            const last = i === items.length - 1;
            // Ancêtres au-delà des trois derniers niveaux : repliés visuellement
            // sur mobile (sr-only garde le texte pour l'a11y/SEO), rétablis dès sm.
            const cache = replie && i < items.length - NIVEAUX_VISIBLES;
            // Les ancêtres sont les CIBLES du fil : ils gardent leur libellé
            // entier (`shrink-0`) et c'est la page courante, non cliquable, qui
            // cède la place (`min-w-0` autorise sa coupe sous la largeur du
            // contenu — sans lui, `truncate` reste sans effet). Classes écrites
            // en clair : Tailwind ne voit pas une chaîne construite.
            // Un maillon replié est un ancêtre, donc jamais le dernier.
            return (
              <li
                key={`${item.label}-${i}`}
                className={
                  cache
                    ? // `sr-only` garde le maillon dans le DOM et dans le parcours
                      // clavier — donc, sous `sm`, on tabulait sur un lien réduit
                      // à 1×1 px et découpé par `clip` : l'anneau de focus était
                      // rogné avec lui (RGAA 10.7 / WCAG 2.4.7). `focus-within`
                      // le fait réapparaître le temps qu'il a le focus, comme le
                      // lien d'évitement du layout.
                      "sr-only focus-within:not-sr-only focus-within:flex focus-within:shrink-0 focus-within:items-center focus-within:gap-2 sm:not-sr-only sm:flex sm:shrink-0 sm:items-center sm:gap-2"
                    : last
                      ? "flex min-w-0 items-center gap-2"
                      : "flex shrink-0 items-center gap-2"
                }
              >
                {/* Un dernier maillon AVEC href reste un lien : cas du fil
                    d'édition (layout C3) où la page courante est plus profonde
                    et signalée ailleurs (pastille de section). */}
                {item.href ? (
                  <Link
                    href={item.href}
                    // `inline-block` porte la cible tactile (padding compensé par
                    // la marge négative). La coupe ne concerne que le dernier
                    // maillon, seul à porter un libellé de donnée : il doit
                    // pouvoir passer sous sa largeur de contenu (`max-w-full`).
                    className={`inline-block ${last ? "max-w-full truncate" : ""} py-1.5 -my-1.5 text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={last ? "truncate text-white font-medium" : undefined}
                  >
                    {item.label}
                  </span>
                )}
                {!last && (
                  <span aria-hidden="true" className="text-gray-light">
                    ›
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
