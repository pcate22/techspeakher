import Link from "next/link";
import Avatar from "@/components/Avatar";
import ExternalLink from "@/components/ExternalLink";
import { CARTE_LIEN, CARTE_LIEN_NUE } from "@/components/carte-lien";
import { jourFilFr, type CarteFil as Carte } from "@/lib/fil-cartes";

/**
 * UNE carte du fil (conception v2 §4, lot N2) : un fait, incarné — l'avatar
 * de la personne (ou le logo pour l'asso), son nom, le fait en verbe, le
 * détail, la date en toutes lettres. La carte ENTIÈRE est le lien, vers une
 * page qui existe déjà : le fil n'archive rien, il pointe.
 *
 * RGAA : le nom accessible du lien dit qui, quoi et quand (jamais l'avatar
 * seul, il est décoratif) ; un lien externe passe par `ExternalLink`
 * (nouvelle fenêtre annoncée).
 */
export default function CarteFil({
  carte,
  aujourdhui,
  nue = false,
}: {
  carte: Carte;
  aujourdhui: string;
  /** Sans sa boîte (lot N4) : le parent la porte, partagée avec la rangée Bravo. */
  nue?: boolean;
}) {
  const classeLien = nue ? CARTE_LIEN_NUE : CARTE_LIEN;
  const corps = (
    <>
      {/* Une carte de l'asso ne porte PAS son logo (retour de Cateline : le
          picto TSH répété à chaque ligne alourdit le fil) — son nom en tête
          suffit à la signer. Une personne, elle, reste incarnée. */}
      {carte.type === "asso" && carte.fait === null ? null : (
        <Avatar name={carte.nom} image={carte.image} size="xs" />
      )}
      <span className="min-w-0 flex-1">
        {/* LA DATE EST INSÉCABLE : elle descend entière à la ligne plutôt que
            de se couper en plein milieu (« 22 » d'un côté, « juillet 2026 » de
            l'autre — retour de Cateline). Une date est UNE chose ; une phrase
            qui passe à la ligne, non : nom et fait restent sécables, ce qui
            garde l'en-tête à deux lignes sur un téléphone au lieu de trois.

            LE PIÈGE : l'espace séparateur reste DEHORS (`{" "}` avant le span,
            jamais dedans) — c'est LUI la coupure autorisée. Avalé par le
            `whitespace-nowrap`, il soude la date à ce qui précède et la ligne
            sort de l'écran, soit pire que le défaut corrigé. Le test le garde
            (accueil-fil, « la date passe à la ligne ENTIÈRE »), avec les
            mesures ; même idiome que `app/tremplin/[conf]/[annee]/page.tsx`. */}
        <span className="block text-sm text-white">
          <span className="font-bold">{carte.nom}</span>
          {carte.fait && <span> · {carte.fait}</span>}{" "}
          <span className="whitespace-nowrap text-gray-light">
            · {jourFilFr(carte.date, aujourdhui)}
          </span>
        </span>
        {carte.titre && (
          <span className="block text-sm text-white mt-0.5">{carte.titre}</span>
        )}
        {carte.detail && (
          <span className="block text-xs text-gray-light line-clamp-2 mt-0.5">
            {carte.detail}
          </span>
        )}
        {/* Le visuel de l'actualité (lot 6) : il illustre le fait, sous le
            texte et au-dessus de l'intitulé, qui reste le dernier mot de la
            carte.

            Entier mais BORNÉ, dans un cadre de ratio fixe : un visuel portrait
            laissé à sa hauteur naturelle mangeait un écran à lui seul, poussait
            « Lire l'article » hors de vue et éjectait les cartes suivantes — un
            fil se parcourt. Le cadre réserve aussi la hauteur, donc le fil ne
            sursaute pas au chargement.

            DÉCORATIF (`alt=""`) — même raison que l'avatar ci-dessus : toute la
            carte est UN lien, dont le nom dit déjà qui, quoi et quand. */}
        {carte.visuelUrl && (
          <span className="relative mt-2 block aspect-[4/3] overflow-hidden rounded-lg bg-navy">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL saisie côté orga (hôte non garanti) : l'optimiseur next/image la refuserait */}
            <img
              src={carte.visuelUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </span>
        )}
        {/* CE QUE DIT le lien : une flèche nue ne dit pas où l'on arrive
            (retour de Cateline ; RGAA 6.1 — l'intitulé nomme la destination).
            Il VA À LA LIGNE, dans la colonne de texte : sur un téléphone il
            n'y a pas la place d'une seconde colonne, et l'intitulé écrasait
            le titre du talk. */}
        <span className="block text-xs font-medium text-cyan group-hover:text-cyan-light mt-1">
          {carte.hrefLabel}
          <span aria-hidden="true"> ›</span>
        </span>
      </span>
    </>
  );

  return carte.externe ? (
    <ExternalLink href={carte.href} className={classeLien}>
      {corps}
    </ExternalLink>
  ) : (
    <Link href={carte.href} className={classeLien}>
      {corps}
    </Link>
  );
}
