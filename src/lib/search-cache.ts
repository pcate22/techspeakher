/**
 * Cache des sources de recherche (speakeuses, contenus). Les deux routes le
 * partagent : elles alimentent le MÊME index et n'ont aucune raison de vieillir
 * différemment.
 *
 * 5 minutes de fraîcheur, 10 de rattrapage pendant lesquelles le CDN sert
 * l'ancienne réponse en rafraîchissant derrière. Une speakeuse publiée ou une
 * actualité mise en ligne est donc cherchable en général sous 5 minutes, au
 * pire sous un quart d'heure.
 */
export const ENTETES_CACHE_RECHERCHE = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
} as const;
