import NavRow from "@/components/NavRow";
import QuandAtelier from "@/components/QuandAtelier";
import { quandLongFr } from "@/lib/format";

/**
 * Une SÉANCE dans une liste de séances, et sa page derrière. Mutualisée par le
 * programme de la participante et par « les ateliers que tu animes » : les deux
 * listes montrent la même chose (le titre, de quoi décider d'ouvrir, la date à
 * droite) et doivent continuer à la montrer pareil.
 *
 * A11y (RGAA) : la date de droite est décorative (`aria-hidden`) parce qu'elle
 * est abrégée — « 28 avr. ». Sa forme complète passe par `badgesLabel`, que
 * `NavRow` rend en `sr-only` DANS le lien : le nom accessible de la rangée dit
 * donc « … , mardi 28 avril 2026 ». Sans date, on le dit plutôt que de laisser
 * un blanc.
 */
export default function RangeeAtelier({
  href,
  titre,
  infos,
  date,
  dateFin,
}: {
  href: string;
  titre: string;
  /** Ce qui aide à décider d'ouvrir (coach, lieu, nombre de supports…) ; les
   * entrées vides sont écartées, le reste est joint par « · ». */
  infos: (string | false | null | undefined)[];
  date: string | null;
  dateFin: string | null;
}) {
  return (
    <NavRow
      href={href}
      title={titre}
      titleClamp={2}
      subtitle={infos.filter(Boolean).join(" · ")}
      trailing={
        date || dateFin ? (
          <span aria-hidden="true" className="block text-xs leading-tight text-white">
            <QuandAtelier date={date} dateFin={dateFin} />
          </span>
        ) : undefined
      }
      badgesLabel={quandLongFr(date, dateFin) ?? "Date à définir"}
    />
  );
}
