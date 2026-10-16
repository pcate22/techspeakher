import { Fragment, type ReactNode } from "react";
import LienVisio from "@/components/LienVisio";
import DocList, { type DocListItem } from "@/components/DocList";

type TitreTag = "h1" | "h2" | "h3" | "p";

/**
 * Assemble une ligne de méta (date, horaires, coach…) séparée par « · », en
 * NŒUDS React (les dates passent par `<DateFr>`, on ne peut plus concaténer une
 * chaîne). Ignore les parties vides ; renvoie `null` si tout est vide, pour que
 * l'appelant n'affiche pas un `<p>` vide.
 */
export function metaLine(parts: Array<ReactNode>): ReactNode {
  const kept = parts.filter(Boolean);
  if (kept.length === 0) return null;
  return kept.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && " · "}
      {p}
    </Fragment>
  ));
}

/**
 * Coque MUTUALISÉE d'un atelier (espace participante + espace coach) : titre,
 * ligne de méta, lien visio, puis supports (`DocList`). Présentation pure —
 * la donnée et l'autorisation restent côté page (chaque rôle ne reçoit que son
 * périmètre). La fiche orga (éditeur complet) n'utilise pas cette coque.
 *
 * - `meta` est fourni DÉJÀ assemblé par l'appelant (chaîne ou nœuds React :
 *   les dates passent par `<DateFr>` pour un rendu accessible) ; chaque rôle
 *   garde son format, le composant n'impose aucune mise en forme.
 * - `as` / `titreId` : le niveau et l'id du titre diffèrent selon le contexte
 *   (participante = `<p>` dans un `<li>` ; coach = `<h3>` lié par
 *   `aria-labelledby` à son `<article>`, lui-même rangé sous le titre de groupe
 *   « Les ateliers que tu animes »).
 * - `supportAction` : action optionnelle par support (suppression selon rôle).
 * - `children` : extra propre au rôle rendu après les supports (ex. le dépôt
 *   de document du coach).
 *
 * Composant SERVEUR : comme `DocList`, il peut recevoir une référence de Server
 * Action via `supportAction` tant que lui et ses appelants restent serveur.
 */
export default function AtelierDetail<T extends DocListItem>({
  titre,
  as = "h2",
  titreId,
  titreClassName = "font-medium",
  meta,
  lienVisio,
  supports,
  supportsEmpty,
  supportAction,
  children,
}: {
  titre: string;
  as?: TitreTag;
  titreId?: string;
  titreClassName?: string;
  meta?: ReactNode;
  lienVisio?: string | null;
  supports: T[];
  supportsEmpty?: string;
  supportAction?: (doc: T) => ReactNode;
  children?: ReactNode;
}) {
  const Titre = as;
  return (
    <>
      <Titre id={titreId} className={titreClassName}>
        {titre}
      </Titre>
      {meta && <p className="text-xs text-gray-light mt-0.5">{meta}</p>}
      {lienVisio && (
        <p className="mt-1.5 text-sm">
          <LienVisio href={lienVisio} titre={titre} libelle="Rejoindre la visio" />
        </p>
      )}
      <DocList docs={supports} empty={supportsEmpty} action={supportAction} />
      {children}
    </>
  );
}
