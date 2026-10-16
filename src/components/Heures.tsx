/**
 * Plage horaire ACCESSIBLE : « 18:30–20:00 » à l'œil (le demi-cadratin est
 * ignoré ou mal restitué par les lecteurs d'écran), « de 18:30 à 20:00 » en
 * équivalent `sr-only` — même dispositif que les dates (DateFr/QuandAtelier).
 * Début seul si la fin manque ; rien du tout sans début (l'appelant décide de
 * son état vide).
 */
export default function Heures({
  debut,
  fin,
  empile = false,
  className,
}: {
  debut: string | null | undefined;
  fin: string | null | undefined;
  /** Empilé (« 18:30 » sur « 20:00 ») : la colonne droite des agendas. */
  empile?: boolean;
  className?: string;
}) {
  if (!debut) return null;
  if (!fin) return <span className={className}>{debut}</span>;
  return (
    <span className={className}>
      <span aria-hidden="true">
        {debut}
        {empile ? <br /> : "–"}
        {fin}
      </span>
      <span className="sr-only">
        de {debut} à {fin}
      </span>
    </span>
  );
}
