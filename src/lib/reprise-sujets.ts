/**
 * Reprise des anciens sujets (11 libellés larges) vers les thèmes actuels.
 * Miroir exact de db/migrations/077_themes_categories.sql : le test de
 * cohérence échoue si l'un des deux bouge sans l'autre. « Autre » n'a pas
 * d'équivalent : il est retiré, la fiche reste publiée sans thème.
 */
export const REPRISE_SUJETS: Readonly<Record<string, readonly string[]>> = {
  "IA / Machine Learning / Data": ["IA / Machine Learning", "Data / BI"],
  "Développement web / Front-end": ["Web / Front-end"],
  Mobile: ["Mobile"],
  "Cloud / DevOps / Infra": ["Cloud", "DevOps"],
  Cybersécurité: ["Cybersécurité"],
  "UX / Design / Accessibilité": ["UX / UI", "Accessibilité"],
  "Produit / Agilité": ["Product management", "Agilité"],
  "Leadership / Soft skills": ["Leadership", "Soft skills"],
  "Recherche / Académique (PhD)": ["Recherche / PhD"],
  "Innovation / R&D": ["R&D"],
  Autre: [],
};

/**
 * Convertit une liste de sujets : un ancien sujet devient ses thèmes, une
 * valeur déjà nouvelle passe telle quelle (rejouable), l'ordre est gardé et
 * les doublons sont retirés.
 */
export function reprendreSujets(anciens: string[]): string[] {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const sujet of anciens) {
    const themes = Object.hasOwn(REPRISE_SUJETS, sujet) ? REPRISE_SUJETS[sujet] : [sujet];
    for (const t of themes) {
      if (!vus.has(t)) {
        vus.add(t);
        sortie.push(t);
      }
    }
  }
  return sortie;
}
