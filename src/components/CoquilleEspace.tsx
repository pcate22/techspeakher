import { Suspense, type ReactNode } from "react";
import NavEspaceServeur from "@/components/NavEspaceServeur";

/**
 * La coquille de l'espace connecté, PARTAGÉE par les layouts `/mon-espace` et
 * `/admin` : le rail à gauche sur grand écran, la barre d'onglets basse sur
 * mobile (refonte de la navigation connectée, 2026-10-15). Le contenu streame
 * SANS attendre les navigations (Suspense) ; le repli réserve la largeur du
 * rail pour que la page ne saute pas quand il arrive. Le dégagement bas du
 * footer vit dans globals.css (WCAG 2.4.11, piloté par `data-bottom-nav`).
 *
 * Le CONTENU vient en premier dans le DOM, les navigations après (le rail est
 * ramené à gauche par `xl:order-first`, au seuil de la barre basse) : le lien « Aller au contenu » du
 * layout racine vise le `<main>`, qui commence ainsi par la page ; et sur
 * mobile, la barre affichée en bas se lit et se tabule en dernier, comme
 * avant la refonte (revues justesse et RGAA du 2026-10-15, WCAG 2.4.1/2.4.3).
 */
export default function CoquilleEspace({ children }: { children: ReactNode }) {
  return (
    <div className="xl:flex">
      <div className="min-w-0 flex-1">{children}</div>
      <Suspense
        fallback={<div aria-hidden="true" className="hidden w-60 shrink-0 xl:order-first xl:block" />}
      >
        <NavEspaceServeur />
      </Suspense>
    </div>
  );
}
