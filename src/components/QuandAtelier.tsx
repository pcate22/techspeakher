import DateFr from "@/components/DateFr";
import { periodeFr } from "@/lib/format";

/**
 * LE « quand » d'un atelier, partagé par toutes les surfaces (refonte §2.4) :
 * - date unique → `DateFr` (abrégé visible, long en sr-only) ;
 * - période (`dateFin`) → « du 7 au 13 sept. 2026 », même dispositif
 *   d'accessibilité (visible abrégé `aria-hidden`, mois en toutes lettres pour
 *   les lecteurs d'écran) ;
 * - rien → null (l'appelant décide de son état vide).
 *
 * C'est ce composant qui garantit qu'une activité « à faire dans la semaine »
 * ne s'affiche plus jamais comme un rendez-vous à sa date de début.
 */
export default function QuandAtelier({
  date,
  dateFin,
  weekday = false,
  className,
}: {
  date: string | null | undefined;
  dateFin?: string | null;
  weekday?: boolean;
  className?: string;
}) {
  const court = periodeFr(date, dateFin);
  if (!court) return <DateFr iso={date} weekday={weekday} className={className} />;
  const long = periodeFr(date, dateFin, { long: true }) ?? court;
  return (
    <span className={className}>
      <span aria-hidden="true">{court}</span>
      <span className="sr-only">{long}</span>
    </span>
  );
}
