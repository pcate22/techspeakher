import ExternalLink from "@/components/ExternalLink";

/**
 * Lien « Visiter le site » vers le site externe d'une entité nommée, avec la
 * mention lecteur d'écran « de {nom} ». Partagé par les cartes des pages
 * publiques (partenaires, conférences) : même style, même a11y, un seul endroit
 * à faire évoluer.
 */
export default function SiteLink({
  href,
  nom,
  sponsored,
}: {
  href: string;
  nom: string;
  /** Le lien vient d'un soutien : divulgué en `rel="sponsored"`. */
  sponsored?: boolean;
}) {
  return (
    <ExternalLink
      href={href}
      sponsored={sponsored}
      className="text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
    >
      Visiter le site &rarr;
      <span className="sr-only"> de {nom}</span>
    </ExternalLink>
  );
}
