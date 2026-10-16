import type { ReactNode } from "react";

/**
 * En-tête de SEGMENT d'un hub (« Mon compte », « Mes coachées »…) : un titre
 * hors carte, qui nomme un groupe de rangées. C'est un vrai `h2` (jamais une
 * simple ligne stylée) : le plan de la page se lit au lecteur d'écran, et les
 * sections s'y rattachent par `aria-labelledby`.
 *
 * ACCESSIBILITÉ COGNITIVE (relecture du 2026-08-16 — déficience
 * intellectuelle légère, TDAH, TSA ; `docs/conception-profil-et-a-faire.md`
 * §5 P1). Cette étiquette existe pour RÉDUIRE la charge de lecture : elle
 * était rendue dans le style le moins lisible de la page — 10,5 px, tout en
 * capitales, interlettrage 0,14 em, en gris. Trois obstacles cumulés :
 *
 * - la taille passait sous le plancher de lecture confortable ;
 * - les capitales effacent la SILHOUETTE du mot, qu'on reconnaît avant d'en
 *   lire les lettres — le tout-capitale ralentit tout le monde et bloque une
 *   lectrice en difficulté ;
 * - le gris retirait l'emphase à ce qui structure la page, contre la règle
 *   déjà écrite des principes UI §9 (« hiérarchie par la taille et la graisse,
 *   jamais par un gris plus pâle »).
 *
 * D'où : casse du texte respectée, `text-sm` au plancher, `font-bold`, et
 * `cream` — sûr en contraste sur tous les fonds sombres de la palette.
 *
 * PROXIMITÉ (loi de Gestalt) : une étiquette appartient à ce qu'elle nomme, pas
 * à ce qui la précède. L'espacement est donc porté par le composant, plus par
 * l'appelant : `className` existait, et deux pages sur trois passaient `mt-0`
 * ou `mt-2` — l'étiquette se retrouvait à égale distance du groupe du dessus et
 * du sien, ou plus près du mauvais (relecture du 2026-08-16, F12). Une règle
 * qu'un appelant peut annuler n'est pas une règle : la marge haute est fixe, et
 * `-mb-1` resserre encore le lien avec la première rangée. Le rapport tient
 * quelle que soit la page.
 */
export default function SegmentLabel({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className="text-sm font-bold text-cream px-1 mt-8 -mb-1">
      {children}
    </h2>
  );
}
