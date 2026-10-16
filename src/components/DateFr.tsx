import { formatDateFr } from "@/lib/format";

/**
 * Date française en lecture seule, accessible.
 *
 * - **À l'œil** : forme ABRÉGÉE (« ven. 20 nov. 2026 ») — plus courte et
 *   cohérente avec ce que l'input date natif affiche déjà (iOS/Android).
 * - **Au lecteur d'écran** : forme COMPLÈTE (« vendredi 20 novembre 2026 »)
 *   via un `sr-only`, car « ven. » / « nov. » sont prononcés de façon peu
 *   fiable par les synthèses vocales. Le visible est `aria-hidden` pour éviter
 *   une double lecture.
 * - Balise `<time datetime>` : date machine-lisible (sémantique, SEO).
 *
 * `weekday` ajoute le jour de la semaine : à réserver aux dates où l'on doit
 * SE PRÉSENTER (atelier, finale) — pour un résumé dense, l'omettre.
 */
export default function DateFr({
  iso,
  weekday = false,
  className,
}: {
  iso: string | null | undefined;
  weekday?: boolean;
  className?: string;
}) {
  const court = formatDateFr(
    iso,
    weekday
      ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
  if (!iso || !court) return null;
  const long =
    formatDateFr(
      iso,
      weekday
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "long", year: "numeric" },
    ) ?? court;

  return (
    <time dateTime={iso} className={className}>
      <span aria-hidden="true">{court}</span>
      <span className="sr-only">{long}</span>
    </time>
  );
}
