import Link from "next/link";
import type { Talk, TalkOccurrence } from "@/lib/talks";
import { formatOccurrenceDateLieu, formatOccurrenceMeta } from "@/lib/talk-date";
import Button from "@/components/Button";
import ConferenceLogo from "@/components/ConferenceLogo";
import { nomInsecable } from "@/data/association";

/**
 * Carte d'un talk (IDENTITÉ) et de ses occurrences (les conférences où il a été
 * donné), réutilisable.
 * - `manageHref` (espace) : toute la carte est cliquable vers la page du talk.
 * - sinon (fiche) : description + liste des conférences, chacune avec ses liens
 *   propres (site, slides, vidéo, feedback). Un talk sans occurrence = un sujet
 *   proposé, affiché seul (titre + type + description), sans liste.
 * Hiérarchie : titre, méta (type), description, puis les occurrences.
 */
export default function TalkCard({
  talk,
  manageHref,
  editHref,
}: {
  talk: Talk;
  manageHref?: string;
  editHref?: string;
}) {
  const heading = (
    <>
      {/* Saisie d'une membre : le nom de l'asso y arrive en espace ordinaire.
          Replié à l'affichage (jamais en base). L'aria-label plus bas garde,
          lui, la graphie des statuts : il est lu, pas mis en page. */}
      <p className="text-white font-semibold leading-snug">{nomInsecable(talk.titre)}</p>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <span className="text-[11px] uppercase tracking-wide text-magenta bg-magenta/10 border border-magenta/40 rounded-full px-2 py-0.5">
          {talk.type}
        </span>
        {talk.occurrences.length > 0 && (
          <span className="text-xs text-gray-light">
            {talk.occurrences.length === 1
              ? "1 conférence"
              : `${talk.occurrences.length} conférences`}
          </span>
        )}
      </div>
    </>
  );

  const cardClass = "block bg-navy border border-navy-lighter rounded-lg p-4";

  // Mode gestion : carte entièrement cliquable vers la page du talk.
  if (manageHref) {
    return (
      <Link
        href={manageHref}
        className={`${cardClass} hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors`}
      >
        {heading}
        {talk.description && (
          <p className="text-sm text-gray-light mt-2 line-clamp-2">
            {talk.description}
          </p>
        )}
        <span className="inline-block text-xs text-cyan mt-2">Gérer →</span>
      </Link>
    );
  }

  // Mode affichage (fiche) : description + liste des conférences.
  return (
    <div className={cardClass}>
      {heading}
      {talk.description && (
        <p className="text-sm text-gray-light mt-2 whitespace-pre-line">
          {talk.description}
        </p>
      )}
      {talk.occurrences.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-navy-lighter">
          {talk.occurrences.map((o) => (
            <OccurrenceRow key={o.id} occurrence={o} />
          ))}
        </ul>
      )}
      {editHref && (
        <div className="mt-3">
          {/* Le titre du talk complète l'intitulé, en `sr-only` : plusieurs cartes
              sur un même écran donnaient N liens dont le nom accessible entier
              était « Modifier », pour N destinations (RGAA 6.1 / WCAG 2.4.4). Le
              libellé visible reste court, et il est bien CONTENU dans le nom
              accessible (WCAG 2.5.3). */}
          <Button
            href={editHref}
            variant="ghost"
            size="sm"
            className="px-0"
            // Par `aria-label` et non par un `sr-only` accolé : le calcul du nom
            // accessible recolle les nœuds sans séparateur, et « Modifier » suivi
            // de « le talk… » s'énonçait « Modifierle talk ».
            aria-label={`Modifier le talk « ${talk.titre} »`}
          >
            Modifier
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Une conférence où le talk a été donné.
 *
 * Mise en page reprise du portail qui a servi de référence (capture du
 * 2026-08-01) : **logo de la conférence**, son **nom** en tête, puis
 * `date · ville · pays` en retrait, puis les liens de CETTE fois-là. Un talk
 * rejoué se lit alors d'un coup d'œil (trois logos = trois scènes), là où la
 * ligne unique « conf · ville · pays · date » noyait l'information.
 *
 * Une occurrence historique sans nom de conférence (mention libre vide) retombe
 * sur la ligne d'un seul tenant : pas de pastille orpheline.
 */
function OccurrenceRow({ occurrence: o }: { occurrence: TalkOccurrence }) {
  const nom = o.conference?.trim() ? nomInsecable(o.conference.trim()) : null;
  const dateLieu = formatOccurrenceDateLieu(o);

  const links: { href: string; label: string }[] = [];
  if (o.lienConf)
    links.push({ href: o.lienConf, label: "Voir sur le site de la conférence" });
  if (o.lienSlides) links.push({ href: o.lienSlides, label: "Slides" });
  if (o.lienVideo) links.push({ href: o.lienVideo, label: "Vidéo" });
  if (o.lienFeedback) links.push({ href: o.lienFeedback, label: "Feedback" });

  // Ces quatre liens sont saisis par la speakeuse, au même titre que son site
  // ou son Sessionize : `ugc` (donc `ugc nofollow`), comme le reste de la fiche.
  // Ils étaient les derniers `Button … external` de l'arbre à suivre une
  // destination que l'association n'a ni choisie ni relue.
  const liens = links.length > 0 && (
    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1">
      {links.map((l) => (
        <Button
          key={l.label}
          href={l.href}
          external
          ugc
          variant="ghost"
          size="sm"
          className="px-0"
        >
          {l.label}
        </Button>
      ))}
    </div>
  );

  if (!nom) {
    const meta = formatOccurrenceMeta(o);
    return (
      <li className="py-2 first:pt-0 last:pb-0">
        {meta && <p className="text-sm text-white">{meta}</p>}
        {liens}
      </li>
    );
  }

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <ConferenceLogo nom={nom} slug={o.conferenceSlug} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{nom}</p>
        {dateLieu && <p className="text-sm text-gray-light">{dateLieu}</p>}
        {liens}
      </div>
    </li>
  );
}
