import type { ReactNode } from "react";

/**
 * En-tête commun aux sous-pages d'un SUJET d'édition (une participante, une
 * récompense…). Le TITRE visible est le sujet (nom, intitulé) — jamais noyé
 * dans du gris ; le rôle de la page passe en surtitre. Arrivé en profondeur, on
 * sait toujours sur QUOI on agit.
 *
 * RGAA 9.1 : le `<h1>` embarque le surtitre en `sr-only` → chaque sous-page a un
 * titre distinct et contextuel pour la navigation par titres (sinon toutes les
 * sous-pages auraient le même `<h1>` = le sujet). Le surtitre visible est
 * `aria-hidden` car repris dans le libellé du titre.
 */
export default function SujetEntete({
  surtitre,
  titre,
  children,
}: {
  /** Rôle de la sous-page (surtitre) : « Relier un compte », « Bénéficiaire »… */
  surtitre: string;
  /** Sujet (titre) : nom de la participante, intitulé de la récompense… */
  titre: string;
  /** Explication facultative sous le titre (sans répéter le sujet). */
  children?: ReactNode;
}) {
  return (
    <header>
      <p
        aria-hidden="true"
        className="text-xs font-bold uppercase tracking-wide text-gray-light"
      >
        {surtitre}
      </p>
      <h1 className="text-2xl font-bold">
        <span className="sr-only">{surtitre}&nbsp;: </span>
        {titre}
      </h1>
      {children ? (
        <p className="text-sm text-gray-light mt-1">{children}</p>
      ) : null}
    </header>
  );
}
