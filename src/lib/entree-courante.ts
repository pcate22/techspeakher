/**
 * Le « vous êtes ici » de l'espace connecté, PARTAGÉ par la barre basse
 * (mobile) et le rail (bureau) : deux formes, une seule règle. Deux copies
 * auraient dérivé en silence, et une même page aurait allumé deux entrées
 * différentes selon la taille de l'écran.
 */
export type EntreeNav = {
  href: string;
  /** Ne s'allume que sur son URL exacte (Accueil : `/mon-espace` est aussi
   * le préfixe de tout l'espace). */
  exact?: boolean;
  /** Préfixes SUPPLÉMENTAIRES qui rallument l'entrée (un repli). */
  prefixes?: string[];
};

/**
 * L'entrée courante = la correspondance la plus SPÉCIFIQUE (préfixe le plus
 * long) parmi tous les préfixes de toutes les entrées ; à longueur égale, la
 * correspondance EXACTE d'une entrée `exact` prime (sur `/mon-espace`, Accueil
 * bat un repli `/mon-espace`). Aucune correspondance → aucune entrée.
 */
export function entreeCourante<T extends EntreeNav>(pathname: string, entrees: T[]): T | null {
  let meilleure: T | null = null;
  let meilleurScore = 0;
  for (const e of entrees) {
    for (const p of [e.href, ...(e.prefixes ?? [])]) {
      const exact = pathname === p;
      if (exact || (!e.exact && pathname.startsWith(`${p}/`))) {
        const score = p.length * 2 + (exact && e.exact ? 1 : 0);
        if (score > meilleurScore) {
          meilleurScore = score;
          meilleure = e;
        }
      }
    }
  }
  return meilleure;
}

/**
 * `aria-current` d'une entrée. `page` veut dire « CE lien mène à la page où
 * vous êtes » ; un repli s'allume sur des routes où son lien mène AILLEURS —
 * l'annoncer « page courante » promettait un lien qui ne bouge pas, alors
 * qu'il déplace (relecture RGAA du 2026-08-16). La valeur juste pour « élément
 * courant d'un ensemble » est `true`.
 */
export function marqueCourante(
  entree: EntreeNav,
  actif: EntreeNav | null,
  pathname: string,
): "page" | "true" | undefined {
  if (actif !== entree) return undefined;
  return pathname === entree.href ? "page" : "true";
}

/**
 * Le nom accessible d'une entrée qui porte le POINT de « À faire » (D3) : le
 * signal entre dans le NOM, libellé visible en tête (WCAG 2.5.3 : « cliquer
 * À faire » à la voix continue de marcher) ; sans point, aucun `aria-label` —
 * le nom vient du contenu. Partagé : barre et rail disent la même chose.
 */
export function nomAvecPoint(label: string, point?: boolean): string | undefined {
  return point ? `${label}, quelque chose attend` : undefined;
}
