/**
 * Pictogrammes des onglets-liens de la barre basse (conception B4) : des SVG
 * à trait épais, PAS des emoji — le dessin d'un emoji change d'un téléphone à
 * l'autre, celui d'un SVG est le nôtre. Chaque pictogramme reprend le mot de
 * son étiquette : une maison pour « Accueil », un calendrier pour « Agenda »,
 * une liste cochée pour « À faire » — jamais une cloche, qui dirait
 * « notification » quand l'étiquette dit autre chose.
 *
 * UN fichier pour les trois (à la différence d'un par icône ailleurs dans ce
 * dossier) : ils forment un jeu dessiné ensemble, sur la même boîte et le
 * même trait — les séparer inviterait trois styles. Tous `aria-hidden` : le
 * libellé visible porte seul le nom (RGAA). Le ➕ de la feuille Créer ne vit
 * pas ici — il appartient à `FeuilleCreer`.
 *
 * `strokeWidth 2.5` (≈ 2,1 px rendus à 20 px) : « trait épais » (B4) — le
 * réglage standard (2) rend ~1,7 px, plus léger que les emoji pleins qu'on
 * remplace. Les attributs de présentation vivent sur le `<svg>` : ils sont
 * héritables (même forme que `TrashIcon`).
 */
const BOITE = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function IconeAccueil() {
  return (
    <svg {...BOITE}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h4v-5h4v5h4v-9" />
    </svg>
  );
}

export function IconeAgenda() {
  return (
    <svg {...BOITE}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 4v4M15 4v4" />
    </svg>
  );
}

/**
 * Trois rangées : deux cochées, la troisième sans coche — l'espace vide à
 * gauche, là où les autres ont leur coche, dit « pas encore fait ». Les
 * coches font 6 × 4 unités : en dessous, le « V » se referme à 20 px et la
 * coche devient un pâté (relecture UX du 2026-08-18, réf. les coches Lucide).
 */
export function IconeAFaire() {
  return (
    <svg {...BOITE}>
      <path d="M4 6.5 6 8.5l4-4" />
      <path d="M4 13.5 6 15.5l4-4" />
      <path d="M14 7h6M14 14h6M14 20.5h6" />
    </svg>
  );
}
