type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  /** Intitulé accessible explicite (ex. plusieurs « LinkedIn » dans une liste). */
  "aria-label"?: string;
  /**
   * Lien donné en contrepartie d'un soutien (mécène, sponsor) : ajoute
   * `rel="sponsored"`, la divulgation que Google demande pour ce cas. Elle dit
   * « ce lien vient d'un soutien » et non « nous vendons des liens » — ce qui
   * est exactement la lecture qu'un examen d'activité commerciale doit écarter.
   * Voir docs/google-ad-grants.md.
   */
  sponsored?: boolean;
  /**
   * Lien SAISI PAR UNE UTILISATRICE (site perso, LinkedIn, Sessionize d'une
   * speakeuse, d'une finaliste…) : ajoute `rel="ugc nofollow"`. `ugc` dit d'où
   * vient le lien, `nofollow` dit qu'on ne se porte garant de rien. Sans ça, un
   * site d'association passe du référencement vers des sites commerciaux qu'il
   * n'a ni choisis ni relus — exactement ce qu'un examen d'activité commerciale
   * lit comme de la promotion de tiers. Voir docs/google-ad-grants.md.
   */
  ugc?: boolean;
};

/** `rel` d'un lien sortant, selon d'où vient le lien. */
export function relSortant({ sponsored, ugc }: { sponsored?: boolean; ugc?: boolean }): string {
  return ["noopener", "noreferrer", sponsored && "sponsored", ugc && "ugc nofollow"]
    .filter(Boolean)
    .join(" ");
}

const NOUVEL_ONGLET = " (s'ouvre dans un nouvel onglet)";

/**
 * N'autorise que http(s). Bloque `javascript:` / `data:` — défense anti-XSS
 * pour les URLs venant de la BDD (profils, sites de speakeuses) rendues sur
 * des pages publiques mises en cache.
 */
export function isSafeHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/**
 * Chemin interne sûr : un chemin absolu du site (« / » de tête), en excluant
 * « // » (URL protocol-relative = navigation externe déguisée). Pendant lecture
 * de la règle de validation d'écriture des liens internes (contenu-form).
 */
export function isSafeInternalPath(path: string): boolean {
  // « // » comme « /\ » : le navigateur y lit un HÔTE, pas un chemin. Les deux
  // formes sont écartées — `cheminInterne` (lecture) neutralise les mêmes.
  return path.startsWith("/") && !/^\/[/\\]/.test(path);
}

export default function ExternalLink({ href, className, children, sponsored, ugc, ...rest }: Props) {
  const label = rest["aria-label"];

  // URL non http(s) : on n'émet pas de lien cliquable (ni l'attaquant ni un
  // import malformé ne peuvent injecter un href dangereux).
  if (!isSafeHttpUrl(href)) {
    return (
      <span className={className} aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel={relSortant({ sponsored, ugc })}
      className={className}
      // Si un aria-label est fourni, il REMPLACE le contenu pour l'AT : on y
      // intègre l'avertissement « nouvel onglet » (sinon le span sr-only ci-
      // dessous serait ignoré). Sans aria-label, le span sr-only suffit.
      aria-label={label ? label + NOUVEL_ONGLET : undefined}
    >
      {children}
      {!label && <span className="sr-only">{NOUVEL_ONGLET}</span>}
    </a>
  );
}
