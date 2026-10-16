import Link from "next/link";
import { aujourdhuiParis, type Edition } from "@/lib/tremplin-editions";
import { resumeEdition } from "@/lib/recit-edition";

/**
 * Ligne « édition » d'une liste, réutilisée par le hub conf générique
 * (`/tremplin/[conf]`) et la page DevFest (`/devfest-toulouse`). À placer dans
 * un `<ul role="list">`.
 *
 * La ligne porte le RÉSUMÉ du récit, pas le statut administratif : c'est la
 * porte d'entrée de la fiche, elle doit parler la même langue qu'elle. On lisait
 * « Édition passée » puis, un tap plus loin, « 8 speakeuses accompagnées,
 * 3 gagnantes » — `editionStatutAffiche` est désormais réservé à l'admin.
 *
 * Le résumé se dérive des seules dates et du statut de l'édition (aucun compteur
 * à charger par ligne) : sur une liste, `recitEdition` ne reçoit ni ateliers ni
 * effectifs, et sa forme courte s'en passe.
 */
export default function EditionListItem({
  edition,
  confSlug,
  suite,
}: {
  edition: Edition;
  confSlug: string;
  /**
   * Le SECOND chapitre de cette édition, quand il existe : l'accompagnement
   * d'après la finale, qui a sa propre page. Il vit ICI, sur la ligne de son
   * édition, et pas dans un bloc à côté — un bloc parallèle rouvrait aussi le
   * chapitre 1, donc deux entrées vers la même page à un écran d'écart.
   */
  suite?: { href: string; libelle: string };
}) {
  // Composant serveur sous ISR : le libellé dérivé des dates d'inscriptions
  // est recalculé à chaque revalidation (5 min), pas figé au build.
  const todayStr = aujourdhuiParis();
  const resume = resumeEdition({
    statut: edition.statut,
    finaleDate: edition.finaleDate,
    confDate: edition.confDate,
    inscriptionsDebut: edition.inscriptionsDebut,
    inscriptionsFin: edition.inscriptionsFin,
    aujourdhui: todayStr,
  });
  return (
    <li>
      <Link
        href={`/tremplin/${confSlug}/${edition.annee}`}
        className="flex items-center justify-between gap-3 bg-navy-light border border-navy-lighter rounded-xl px-5 py-4 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
      >
        <span>
          <span className="font-bold text-gold tabular-nums">{edition.annee}</span>
          <span className="ml-3">{edition.nom}</span>
          <span className="block text-xs text-gray-light mt-0.5">{resume}</span>
        </span>
        <span className="text-cyan" aria-hidden="true">→</span>
      </Link>
      {/* Frère du lien principal, jamais dedans : un lien dans un lien n'est
          pas atteignable au clavier. Décalé pour se lire comme une suite. */}
      {suite && (
        <Link
          href={suite.href}
          className="ml-5 mt-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
        >
          {suite.libelle}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </li>
  );
}
