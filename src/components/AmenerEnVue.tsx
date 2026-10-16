"use client";

import { useEffect } from "react";

/**
 * Amène un élément de la page en vue à l'ouverture, et rien d'autre.
 *
 * « Mon agenda » remonte dans le passé : sans ce calage, on atterrirait dans
 * l'historique et il faudrait descendre pour trouver ce qui vient. Un CALENDRIER
 * s'ouvre sur aujourd'hui (cf. `src/app/mon-espace/agenda/page.tsx`).
 *
 * Feuille CLIENTE, et seulement elle : la cible se désigne par son `id`, donc la
 * ligne qu'on amène en vue reste rendue par le serveur, avec son libellé et sa
 * mise en forme. Le composant qui faisait les deux embarquait `@/lib/format`
 * dans le bundle de la route — un module dont l'évaluation construit des objets
 * `Intl`, pour recalculer à l'hydratation une chaîne déjà écrite dans le HTML.
 *
 * Deux précautions :
 * - rien si l'URL porte déjà une ancre (`#…`), sinon on écraserait une
 *   navigation explicite (un lien profond, un retour de formulaire) ;
 * - `behavior: "instant"`, jamais d'animation : c'est un positionnement initial,
 *   pas un déplacement à suivre du regard (et `prefers-reduced-motion` n'aurait
 *   rien à interpréter).
 *
 * La marge de défilement, elle, appartient à la CIBLE : c'est elle qui sait sous
 * quelle barre collante elle se range (`scroll-mt-bande-mois`).
 */
export default function AmenerEnVue({ cible }: { cible: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    document.getElementById(cible)?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [cible]);

  return null;
}
