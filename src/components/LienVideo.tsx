import ExternalLink from "@/components/ExternalLink";
import VideoFacade from "@/components/VideoFacade";
import { youtubeVignette } from "@/lib/youtube";

/** Le texte visible de l'appel à l'action, partout le même. */
export const CTA_VIDEO = "Regarder sur YouTube";

/**
 * Un lien vers une vidéo de la chaîne : la façade, puis ce que l'appelant veut
 * dire dessous (le bloc titre/description d'une carte, une simple ligne en tête
 * d'article). Un seul endroit porte le clic, le nom accessible et l'habillage —
 * c'est ce qui évite de refaire deux fois la même correction.
 *
 * Le nom accessible SE TERMINE par le texte visible du lien : critère
 * « intitulé dans le nom » (WCAG 2.5.3), sans quoi la commande vocale échoue.
 */
export default function LienVideo({
  href,
  titre,
  duree,
  priorite,
  className = "",
  children,
}: {
  href: string;
  /** Ce que la vidéo montre — sert à nommer le lien. */
  titre: string;
  duree?: string;
  /** Vrai quand la vidéo est la première image de la page (chargement immédiat). */
  priorite?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ExternalLink
      href={href}
      aria-label={`${titre} : ${CTA_VIDEO.toLowerCase()}`}
      className={`group block rounded-2xl overflow-hidden border border-navy-lighter hover:border-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors ${className}`}
    >
      <VideoFacade
        vignette={youtubeVignette(href) ?? undefined}
        duree={duree}
        priorite={priorite}
      />
      {children}
    </ExternalLink>
  );
}
