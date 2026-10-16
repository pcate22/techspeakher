import type { ReactNode } from "react";

/**
 * Section de liste titrée : `<section aria-labelledby>` + `<h2>` + `<ul
 * role="list">`. Le gabarit d'accessibilité et le style du titre sont écrits
 * ICI, une fois — recopiés à la main, ils avaient déjà divergé (`tracking-wide`
 * d'un côté, `tracking-wider` de l'autre, pour le même niveau de titre).
 *
 * Le titre entre dans le plan de navigation des lecteurs d'écran : il se dit en
 * clair (« Octobre 2026 », « À dater (3) »), jamais en abrégé nu.
 */
export default function ListeSection({
  id,
  titre,
  ton = "neutre",
  children,
}: {
  /** `id` du titre, cible de l'`aria-labelledby` (unique dans la page). */
  id: string;
  titre: ReactNode;
  /** `repere` (doré) pour un jalon de temps, `neutre` pour le reste. */
  ton?: "repere" | "neutre";
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className={`text-xs font-bold uppercase tracking-wider mb-2 ${
          ton === "repere" ? "text-gold" : "text-gray-light"
        }`}
      >
        {titre}
      </h2>
      <ul role="list" className="flex flex-col gap-2 list-none">
        {children}
      </ul>
    </section>
  );
}
