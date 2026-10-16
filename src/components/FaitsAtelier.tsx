import { Fragment, type ReactNode } from "react";
import QuandAtelier from "@/components/QuandAtelier";
import Heures from "@/components/Heures";
import LienVisio from "@/components/LienVisio";
import type { AtelierEtat, AtelierEtatSource } from "@/lib/atelier-etat";

/**
 * Les FAITS d'un atelier (lot C, refonte §4) : quand / où / qui / avancement,
 * en liste de définitions — la fiche dit d'abord CE QUI EST, les actions
 * viennent après.
 *
 * Une valeur qui réclame une action s'accompagne du mot qui le dit : la couleur
 * ne porte jamais l'information seule (RGAA 3.1). C'est `atelierEtat` qui s'en
 * charge — deux situations distinctes n'y ont jamais le même texte. Le QUI est
 * rendu segment par segment, pour que l'orange d'un manque ne déborde pas sur
 * le fait sain d'à côté (« Réservé à 6 participantes » reste blanc quand c'est
 * le coach qui manque).
 *
 * Le « quand » a UNE source : les composants accessibles (`QuandAtelier`,
 * `Heures`, qui rendent l'abrégé visible et la forme longue en `sr-only`) le
 * calculent depuis l'atelier ; l'état ne fournit que ce qui est DÉRIVÉ (l'état
 * vide, l'alerte, la consigne de fenêtre).
 *
 * Une colonne en mobile, deux à partir de `sm:` : à 320 px, un intitulé
 * « AVANCEMENT » mangeait la moitié de la largeur et jetait la valeur sur six
 * lignes en drapeau.
 */
export default function FaitsAtelier({
  etat,
  atelier,
  titre,
}: {
  etat: AtelierEtat;
  atelier: Pick<AtelierEtatSource, "date" | "dateFin" | "heureDebut" | "heureFin">;
  /** Titre de l'atelier : différencie le lien visio des autres pages (RGAA 6.1). */
  titre: string;
}) {
  // Une fenêtre ne se tient pas à une heure : ses horaires ne veulent rien dire
  // (c'est la consigne de l'état qui parle), on ne les affiche donc pas.
  const montreHeures = Boolean(atelier.heureDebut) && etat.quand.consigne === null;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <Ligne label="Quand" alerte={etat.quand.alerte}>
        {atelier.date ? (
          <QuandAtelier date={atelier.date} dateFin={atelier.dateFin} weekday />
        ) : (
          etat.quand.texte
        )}
        {montreHeures && (
          <>
            {" · "}
            <Heures debut={atelier.heureDebut} fin={atelier.heureFin} />
          </>
        )}
        {etat.quand.consigne && (
          <span className="block text-xs text-gray-light">{etat.quand.consigne}</span>
        )}
      </Ligne>

      <Ligne label="Où" alerte={etat.ou.alerte}>
        {etat.ou.texte}
        {etat.ou.lienVisio && (
          <>
            {" · "}
            <LienVisio href={etat.ou.lienVisio} titre={titre} />
          </>
        )}
      </Ligne>

      {/* Le `dd` reste blanc : chaque segment porte sa propre alerte. */}
      <Ligne label="Qui" alerte={false}>
        {etat.qui.segments.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && " · "}
            <span className={s.alerte ? "text-orange" : undefined}>{s.texte}</span>
          </Fragment>
        ))}
      </Ligne>

      {etat.avancement && (
        <Ligne label="Avancement" alerte={etat.avancement.alerte}>
          {etat.avancement.texte}
        </Ligne>
      )}
    </dl>
  );
}

/**
 * Un fait : son intitulé et sa valeur. `min-w-0 break-words` sur la valeur — un
 * lieu saisi en un seul mot long débordait sa piste de grille, et le
 * `overflow-x: clip` du body le rendait alors inatteignable (WCAG 1.4.10).
 */
function Ligne({
  label,
  alerte,
  children,
}: {
  label: string;
  alerte: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-xs font-bold uppercase tracking-wider text-gray-light sm:pt-0.5">
        {label}
      </dt>
      <dd className={`min-w-0 break-words ${alerte ? "text-orange" : "text-white"}`}>
        {children}
      </dd>
    </>
  );
}
