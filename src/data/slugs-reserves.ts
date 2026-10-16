/**
 * Segments racine SERVIS PAR LE CODE (`src/app/*`), donc indisponibles pour le
 * slug d'une page éditoriale.
 *
 * Next résout une route codée avant le segment attrape-tout `src/app/[slug]` :
 * une page dont le slug entre en collision vivrait en base, publiée, listée au
 * sitemap et proposée par la recherche, sans jamais s'afficher. On refuse donc
 * le slug à la SAISIE plutôt que de laisser la page disparaître en silence.
 *
 * Module sans dépendance (comme `categories-contenus`) : la validation de
 * formulaire et l'index de recherche le lisent tous les deux, sans tirer Zod ni
 * `pg` dans le bundle client.
 *
 * `contenu-form.test.ts` vérifie cette liste CONTRE LE DISQUE : ajouter une
 * route sans l'inscrire ici fait échouer les tests.
 */
export const SLUGS_RESERVES = [
  "a-propos",
  "actualites",
  "adherer",
  "benevole",
  "admin",
  "agenda",
  // Le flux iCalendar de l'horizon (lot 4), réservé comme `feed.xml` l'est :
  // un contenu qui prendrait ce slug serait servi par la route, jamais par lui.
  "agenda.ics",
  "api",
  "articles",
  "code-de-conduite",
  "conferences",
  "connexion",
  "contact",
  "devfest-toulouse",
  "feed.xml",
  "kit-de-communication",
  "mentions-legales",
  "mon-espace",
  "partenaires",
  "speakeuses",
  "tremplin",
] as const;

/** Ce slug est-il déjà servi par une route du code ? */
export function estSlugReserve(slug: string): boolean {
  return (SLUGS_RESERVES as readonly string[]).includes(slug);
}
