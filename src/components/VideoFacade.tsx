import Image from "next/image";

/**
 * La façade d'une vidéo : sa couverture, la pastille de lecture, sa durée.
 * Aucun lien ici — c'est `LienVideo` qui porte le clic et le nom accessible,
 * pour que la carte du catalogue et le bloc en tête d'article partagent le même
 * visuel sans imbriquer deux liens (cf. principes-conception-ui §3).
 *
 * Rien n'est chargé depuis un tiers dans le navigateur : la couverture passe
 * par l'optimiseur d'images de Next (`/_next/image`), donc en same-origin, ce
 * qui laisse la CSP (`img-src 'self'`) inchangée.
 */
export default function VideoFacade({
  vignette,
  duree,
  priorite,
}: {
  vignette?: string;
  duree?: string;
  priorite?: boolean;
}) {
  return (
    <div className="relative aspect-video bg-navy-light">
      {vignette ? (
        <Image
          src={vignette}
          // Décorative : le lien qui l'entoure porte déjà l'intitulé.
          alt=""
          fill
          // La source est une miniature YouTube de 480 px de large : déclarer
          // « 100vw » ferait générer des agrandissements jusqu'à 3840 px, soit
          // plusieurs fois les octets pour aucun détail de plus. On décrit donc
          // le conteneur réel (max-w-2xl dans un px-4).
          sizes="(min-width: 704px) 672px, calc(100vw - 2rem)"
          priority={priorite}
          className="object-cover"
        />
      ) : (
        // Couverture de repli aux couleurs du site, quand l'URL ne donne pas de
        // miniature exploitable.
        <span
          className="absolute inset-0 bg-gradient-to-br from-magenta/25 via-navy-light to-cyan/25"
          aria-hidden="true"
        />
      )}
      {/* Pastille de lecture : décorative, le lien parent porte déjà le sens. */}
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-navy/80 border-2 border-white group-hover:bg-magenta group-hover:border-magenta transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      {duree && (
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-navy/90 text-xs font-semibold text-white">
          {duree}
        </span>
      )}
    </div>
  );
}
