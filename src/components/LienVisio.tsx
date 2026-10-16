import ExternalLink, { isSafeHttpUrl } from "@/components/ExternalLink";

/**
 * Lien « rejoindre la visio » d'une activité, partagé par les surfaces qui en
 * portent un (fiche atelier, détail d'atelier, carte d'agenda). Il existait en
 * trois exemplaires, au libellé près.
 *
 * Deux garde-fous : l'URL vient d'une saisie libre d'orga, donc `isSafeHttpUrl`
 * décide s'il y a un lien du tout (jamais de `javascript:` rendu) ; et le nom
 * accessible cite l'activité, pour que dix liens « Rejoindre » d'une même page
 * restent distinguables hors contexte (RGAA 6.1).
 */
export default function LienVisio({
  href,
  titre,
  libelle = "Rejoindre",
}: {
  href: string | null;
  /** Titre de l'activité, pour le nom accessible du lien. */
  titre: string;
  libelle?: string;
}) {
  if (!href || !isSafeHttpUrl(href)) return null;
  return (
    <ExternalLink
      href={href}
      aria-label={`Rejoindre la visio : ${titre}`}
      className="inline-flex min-h-[44px] items-center py-2 -my-2 rounded text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
    >
      {libelle}
    </ExternalLink>
  );
}
