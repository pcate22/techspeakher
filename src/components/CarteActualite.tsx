import Link from "next/link";
import ExternalLink from "@/components/ExternalLink";
import ExternalLinkIcon from "@/components/icons/ExternalLinkIcon";
import TagBadge from "@/components/TagBadge";
import type { CarteActu } from "@/lib/carte-actu";

/**
 * Carte d'une actualité — UNE seule carte pour les deux surfaces : l'extrait de
 * l'accueil et la liste `/actualites` (même patron que `SceneCard`, servie côté
 * serveur comme depuis le composant client de la liste : aucun hook ici).
 *
 * TOUTE la carte mène à la destination décidée par `toCarteActu` (page article
 * si l'actualité a un corps, sinon son lien) : la zone cliquable est étirée par
 * un `::after` sur le lien, et un complément `sr-only` (`hrefContexte`) nomme
 * l'actualité — plusieurs « Lire la suite » côte à côte seraient
 * indistinguables au lecteur d'écran (RGAA 6.1).
 *
 * `headingLevel` suit la page qui l'accueille (h3 sous le « Actualités » de
 * l'accueil, h2 dans la liste). `estOrga` ajoute les affordances d'orga : le
 * marqueur « Brouillon » et le lien « Modifier », au-dessus de la couche
 * cliquable, jamais un formulaire (règle d'or).
 */
export default function CarteActualite({
  carte,
  headingLevel: Heading = "h3",
  estOrga = false,
}: {
  carte: CarteActu;
  headingLevel?: "h2" | "h3";
  estOrga?: boolean;
}) {
  return (
    <div
      className={`relative h-full rounded-xl border border-navy-lighter bg-navy-light p-6 transition-colors hover:border-cyan/40${carte.href ? " cursor-pointer" : ""}`}
    >
      {/* Vignette de l'actualité (lot 6) — la même pour l'accueil, `/actualites`
          public et orga (une seule carte, cf. l'en-tête du composant).

          `object-contain` dans un cadre de ratio FIXE, et non un recadrage :
          nos visuels sont des cartes à lire (titre en haut, nom de la
          speakeuse en bas) qu'un `object-cover` décapitait (retour de
          Cateline). Le cadre, lui, reste : il réserve la hauteur (la liste ne
          sursaute pas à l'arrivée des images) et aligne les cartes entre
          elles. Le fond `navy` est celui de nos visuels maison, où les bandes
          se fondent ; sur une photo d'un autre format elles se voient, et
          c'est le prix assumé pour ne rien couper.

          Le champ vient d'un formulaire d'orga (URL http(s) libre, pas
          restreinte à Blob) : pas de next/image, dont l'optimiseur refuse
          tout hôte hors de sa liste (même raison que Avatar.tsx). */}
      {carte.imageUrl && (
        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={carte.imageUrl}
            alt={carte.imageAlt ?? ""}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* `<time>` exige un contenu lisible par la machine : « 4 juin 2026 »
            n'en est pas un, d'où l'attribut (RGAA 8.2). Sans date publiée, pas
            d'élément du tout plutôt qu'un `<time>` vide. */}
        {carte.dateISO && (
          <time dateTime={carte.dateISO} className="text-sm font-medium text-cyan">
            {carte.date}
          </time>
        )}
        {/* Chip du TYPE de contenu (même repère sur l'accueil, la liste et la
            page d'article). Le complément reste HORS de la chip : il nomme ce
            que la couleur seule ne dit pas (RGAA 3.1). */}
        {carte.categorie && (
          <>
            <span className="sr-only">Catégorie&nbsp;: </span>
            <TagBadge tag={carte.categorie} />
          </>
        )}
        {/* L'état de travail se dit EN MOTS (brouillon d'orga, ou article de
            membre en relecture — lot N3) : sans le badge, la carte passe pour
            publiée. */}
        {estOrga && carte.statut === "brouillon" && (
          <span className="rounded bg-gold px-2 py-0.5 text-xs font-bold text-navy">
            Brouillon
          </span>
        )}
        {estOrga && carte.statut === "en_relecture" && (
          <span className="rounded bg-orange px-2 py-0.5 text-xs font-bold text-navy">
            En relecture
          </span>
        )}
      </div>

      <Heading className="mb-1 text-lg font-bold text-white">{carte.titre}</Heading>
      {carte.chapo && (
        <p className="text-sm leading-relaxed text-gray-light">{carte.chapo}</p>
      )}

      {/* Action principale de la carte (couvre toute la carte via ::after).
          Le libellé visible reste court et OUVRE le nom accessible (WCAG
          2.5.3) ; le complément `sr-only` nomme l'actualité, sans quoi la page
          aligne N intitulés identiques (RGAA 6.1). La flèche est décorative :
          elle sort du nom accessible. */}
      {carte.href &&
        (carte.externe ? (
          <ExternalLink
            href={carte.href}
            className="after:content-[''] after:absolute after:inset-0 after:rounded-xl mt-3 inline-flex items-center gap-1 rounded text-sm text-cyan transition-colors hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <ExternalLinkIcon />
            {carte.hrefLabel || "Voir"}
            {carte.hrefContexte && <span className="sr-only"> {carte.hrefContexte}</span>}
          </ExternalLink>
        ) : (
          <Link
            href={carte.href}
            className="after:content-[''] after:absolute after:inset-0 after:rounded-xl mt-3 inline-block rounded text-sm text-magenta transition-colors hover:text-magenta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta"
          >
            {carte.hrefLabel || "Lire la suite"}
            {carte.hrefContexte && <span className="sr-only"> {carte.hrefContexte}</span>}
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        ))}

      {/* Édition orga : au-dessus de la couche cliquable (z-10). Même règle
          6.1 — N cartes donnaient N liens nommés « Modifier ». */}
      {estOrga && carte.editHref && (
        <Link
          href={carte.editHref}
          className="relative z-10 mt-3 ml-4 inline-flex min-h-[44px] items-center rounded text-sm text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          Modifier
          <span className="sr-only">
            {" "}
            l&apos;actualité &laquo;&nbsp;{carte.titre}&nbsp;&raquo;
          </span>
        </Link>
      )}
    </div>
  );
}
