import { quandColonneFr } from "@/lib/format";

/**
 * La COLONNE DE DATE d'une rangée de liste (agendas et rappels, refonte §2.4) :
 * la date en texte à droite (« mer. 12 août », « du 7 au 13 juil. »), une
 * seconde ligne facultative pour l'urgence, et « à dater » au même endroit
 * quand la date manque. Exit les pastilles carrées.
 *
 * Entièrement `aria-hidden` : c'est une forme abrégée. L'équivalent long vit
 * dans le `badgesLabel` de la rangée (cf. `quandLongFr`), sinon les lecteurs
 * d'écran entendraient « mer. 12 août » lettre à lettre.
 */
export default function ColonneDate({
  date,
  dateFin,
  aujourdhui,
  secondaire,
  alerteSecondaire = false,
}: {
  date: string | null | undefined;
  dateFin?: string | null;
  /** Année de référence : elle ne s'affiche que si la date en sort. */
  aujourdhui: string;
  /** Seconde ligne (« dans 3 jours », « en retard »), ou rien. */
  secondaire?: string;
  alerteSecondaire?: boolean;
}) {
  if (!date) {
    return (
      <span aria-hidden="true" className="block text-xs text-gray-light">
        à dater
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="block max-w-[5.5rem] text-xs leading-tight">
      <span className="block text-white">{quandColonneFr(date, dateFin, aujourdhui)}</span>
      {secondaire && (
        <span className={`block ${alerteSecondaire ? "text-orange" : "text-gray-light"}`}>
          {secondaire}
        </span>
      )}
    </span>
  );
}
