import Link from "next/link";

/**
 * Lien de corps de texte : cyan souligné, anneau de focus cyan.
 *
 * Le reset Tailwind retire tout style de lien par défaut : un lien non stylé
 * passe inaperçu au milieu d'un paragraphe. Cette classe est donc la forme
 * canonique du lien en ligne, et `LienTexte` en est le porteur pour les
 * destinations internes — pendant de `SiteLink`, qui tient les externes.
 *
 * Elle vivait dans `src/lib/markdown.tsx`, sans être exportée : les pages la
 * retapaient à la main, 82 fois, en 12 variantes qui divergeaient sur le
 * soulignement, la transition et l'anneau de focus. Un lien pouvait donc
 * changer d'aspect au focus selon la page. `identite-liens.test.ts` interdit
 * désormais d'en écrire une treizième.
 */
export const LIEN_TEXTE =
  "text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors";

export default function LienTexte({
  href,
  children,
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  /** Ajouts ponctuels (taille, graisse). La base reste `LIEN_TEXTE`. */
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Link href={href} className={className ? `${LIEN_TEXTE} ${className}` : LIEN_TEXTE} {...rest}>
      {children}
    </Link>
  );
}
