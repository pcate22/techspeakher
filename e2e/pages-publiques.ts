import { EDITION } from "./decor";

/**
 * Les pages publiques du site, en un seul endroit.
 *
 * Trois specs (`a11y`, `largeur`, `mots-colles`) parcouraient chacune leur
 * propre copie de cette liste, et les copies avaient déjà divergé :
 * `/connexion` manquait à l'une, et `/conferences` manquait aux trois alors
 * qu'elle figure au sitemap. Une page publique ajoutée sans être ajoutée ici
 * échappait donc silencieusement aux portes RGAA et de débordement.
 *
 * `navigation.spec.ts` garde sa propre table, qui associe un titre attendu à
 * chaque chemin : c'est une autre donnée, pas une copie de celle-ci.
 *
 * Les pages rendues depuis la base (`/speakeuses/[id]`, `/articles/[slug]`…)
 * restent hors liste : la CI tourne sans Postgres, les tests sont agnostiques
 * aux données.
 */
export const PAGES_PUBLIQUES = [
  "/",
  "/a-propos",
  "/tremplin",
  // Page éditoriale de la conférence : elle rend sans BDD (les appels sont
  // rattrapés), donc elle est vérifiable en CI comme les autres.
  "/devfest-toulouse",
  "/speakeuses",
  "/agenda",
  "/actualites",
  "/partenaires",
  "/kit-de-communication",
  "/conferences",
  "/contact",
  "/mentions-legales",
  "/code-de-conduite",
  "/adherer",
  "/benevole",
  "/connexion",
  // Les deux écrans qui ENCADRENT la connexion. Ils rendent 200 sans base et
  // échappaient pourtant aux trois portes : « vérifie ta boîte mail » est la
  // page où atterrit TOUTE personne qui demande un lien magique, et l'écran de
  // regroupement de comptes est celui où l'on choisit son identité. Deux pages
  // que la visiteuse voit à coup sûr, jamais auditées — et `robots: noindex`
  // les rendait invisibles au sitemap comme à la revue.
  "/connexion/verifie",
  "/connexion/deja-un-compte",
] as const;

/**
 * LES PAGES QUI N'EXISTENT QU'AVEC DES DONNÉES.
 *
 * Elles étaient hors de toute porte : sans base, `/speakeuses/[id]` et
 * `/tremplin/[conf]/[annee]` renvoient 500, donc impossible de les auditer. Et
 * les pages de la liste ci-dessus qui LISENT la base (`/speakeuses`, `/`,
 * `/conferences`) n'étaient auditées que VIDES — or c'est dans les cartes, les
 * portraits et les listes que vivent le contraste, les images et les libellés
 * de lien, c'est-à-dire la matière première des violations WCAG
 * (`docs/audit-e2e-parcours-2026-08.md` §3.2).
 *
 * Elles ne passent les portes que lorsque le décor est là (`e2e/decor.ts`) :
 * ignorées en local sans base, EXIGÉES en CI.
 */
export const PAGES_AVEC_DONNEES = [
  // La fiche d'une speakeuse : un portrait, des puces, des liens externes.
  "/speakeuses/1",
  // La page d'édition du Tremplin : la plus dense du site public (programme,
  // galerie de participantes, palmarès). Son année se dérive du jour, comme
  // celle du décor qui la peuple.
  EDITION,
  // Le compte rendu d'une année d'agenda : des bandes de mois COLLANTES, des
  // cartes en grille et une rangée de liens d'année. L'horizon (`/agenda`) est
  // déjà dans la liste sans données, mais il n'y est audité que VIDE — or ce
  // sont les cartes et les bandes qui portent le contraste et l'ordre du DOM.
  // L'année se calcule : le décor pose ses dates par rapport à `now()`, un
  // chemin figé cesserait d'exister au changement d'année.
  `/agenda/${new Date().getFullYear() - 1}`,
] as const;

/**
 * LES PAGES CONNECTÉES à faire passer par les portes.
 *
 * C'est la dette « résiduelle » que `docs/dette-technique.md` traînait depuis
 * longtemps (« scan axe des pages connectées : nécessite l'auth en E2E »).
 * `a11y-axe-espace.test.tsx` en couvre 10 COMPOSANTS en jsdom, ce qui n'évalue
 * ni le contraste, ni les repères, ni l'ordre réel du DOM — la raison d'être de
 * la porte navigateur.
 *
 * L'espace orga vient en premier dans l'ordre des risques : c'est la surface la
 * plus dense en tableaux et en listes longues du produit, donc la plus exposée
 * au débordement mobile, et la seule qu'aucune porte n'avait jamais regardée.
 */
export const PAGES_MEMBRE = [
  "/mon-espace",
  // La page la plus restructurée du lot (segments, étiquettes, pied court) —
  // elle n'était ouverte par AUCUNE porte en vrai navigateur, donc ni son
  // contraste ni l'ordre réel de son DOM n'étaient regardés (relecture du
  // 2026-08-16).
  "/mon-espace/profil",
  "/mon-espace/fiche",
  "/mon-espace/talks",
  "/mon-espace/reglages",
  // Sa boîte aux lettres : elle n'apparaissait dans AUCUN fichier `e2e/`, et
  // c'est la seule page membre dont l'unique porte était un onglet de la barre
  // — jusqu'à la rangée « Mes messages » du profil (revue du 2026-08-16, C2).
  // Une porte de navigation se juge par « est-elle branchée ? », pas en
  // unitaire.
  "/mon-espace/messages",
  // « À faire » (étape B) — auditée ici en vue « Tout » pour une membre (liste
  // vide aujourd'hui : sa famille personnel arrive plus tard). La vue FILTRÉE
  // et son bandeau sont audités par l'entrée /admin/taches de PAGES_ORGA, que
  // le 308 mène en ?vue=association avec le décor. Les PUCES (≥ 2 familles) ne
  // sont encore atteignables par personne : le jour où une deuxième famille
  // arrive, c'est cette porte qui les verra.
  "/mon-espace/a-faire",
] as const;

export const PAGES_ORGA = [
  "/admin",
  "/admin/speakeuses",
  "/admin/speakeuses/relances",
  "/admin/messages",
  "/admin/tremplins",
  "/admin/adhesions",
  "/admin/adhesions/inviter",
  // Depuis l'étape B, un 308 : l'entrée audite la DESTINATION en vue filtrée
  // (bandeau « Vue : Pour l'association » compris) — et prouve au passage que
  // les liens des e-mails déjà envoyés survivent (risque 2).
  "/admin/taches",
] as const;
