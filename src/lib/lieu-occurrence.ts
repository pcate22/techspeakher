import { REGIONS_METROPOLE } from "@/data/domaines";
import { slugify } from "@/lib/slug";

/**
 * OÙ SE TIENT UNE INTERVENTION — la géographie d'une occurrence.
 *
 * Le défaut que ce module corrige (docs/audit-ux-agenda-2026-08.md §4.2) : une
 * FICHE saisit sa commune via la Base Adresse Nationale et stocke `codeInsee`
 * plus une région dérivée ; une OCCURRENCE ne portait qu'un `ville` en texte
 * libre. Filtrer l'agenda sur « Toulouse » marchait, sur « Occitanie » non — et
 * taper « Occitanie » n'aurait rien remonté, en silence.
 *
 * DEUX NIVEAUX, à ne pas confondre :
 *   • ce qui est STOCKÉ est un FAIT — la BAN a répondu « Occitanie » pour cette
 *     commune, et `talk_occurrences.region` le garde ;
 *   • ce qui est décidé ICI est une RÈGLE D'AFFICHAGE — « hors France » et
 *     « en visio » n'ont aucune région administrative française, il faut bien
 *     choisir où les ranger. Cette règle peut changer sans migration.
 *
 * Le vocabulaire est celui de l'annuaire (`REGIONS`), jamais un second : sans
 * ça, deux pages sœurs répondraient différemment à « Occitanie ».
 */

/** Une intervention hors de France : aucune région administrative française. */
export const REGION_INTERNATIONAL = "International";

/** Une intervention sans lieu : elle se suit depuis n'importe où. */
export const REGION_A_DISTANCE = "À distance (visio)";

/**
 * LES SEULES RÉGIONS QU'UNE INTERVENTION PEUT PORTER EN BASE : les régions
 * ADMINISTRATIVES, et rien d'autre.
 *
 * `REGIONS` en compte trois de plus, et aucune n'a de sens ici :
 * « Toute la France » est une case de RACCOURCI de l'annuaire (« je me déplace
 * partout »), jamais un lieu où une date se tient ; « International » et
 * « À distance (visio) » sont des règles d'AFFICHAGE décidées plus bas, jamais
 * des valeurs stockées. Les accepter au stockage a une conséquence qui n'est
 * pas cosmétique depuis le lot 1 : la région décide désormais si une
 * intervention TRAVERSE les filtres géographiques (`agenda-filtres.ts`), donc
 * une date en salle enregistrée « À distance (visio) » s'afficherait sous
 * toutes les villes de l'agenda. La liste se ferme donc ici, et la SAISIE lit
 * la même (`geographieValidee`, `lib/talk-form.ts`) : une seule liste, deux
 * bords.
 */
export const REGIONS_OCCURRENCE: readonly string[] = REGIONS_METROPOLE;

const REGIONS_ADMINISTRATIVES: ReadonlySet<string> = new Set(REGIONS_OCCURRENCE);

/**
 * Ce qu'une facette de lieu peut proposer : les régions administratives, plus
 * les deux zones que la règle d'affichage fabrique. C'est aussi le vocabulaire
 * dans lequel un slug d'URL se relit — « Toute la France » en est exclue, sinon
 * `?region=toute-la-france` s'annoncerait « en Toute la France ».
 */
export const REGIONS_LIEU: readonly string[] = [
  ...REGIONS_METROPOLE,
  REGION_INTERNATIONAL,
  REGION_A_DISTANCE,
];

function renseigne(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * La région sous laquelle ranger une intervention, dans le vocabulaire de
 * l'annuaire. Trois cas, et la VILLE tranche d'abord :
 *
 *   1. aucune ville → « À distance (visio) » ;
 *   2. une ville et une région administrative → cette région (la BAN l'a
 *      donnée à la saisie) ;
 *   3. une ville sans région administrative → « International ».
 *
 * L'ORDRE COMPTE, et c'est un correctif de revue (18/08) : la ville était lue
 * en dernier, donc une date EN SALLE dont la colonne `region` portait
 * « À distance (visio) » se déclarait à distance — et depuis le lot 1, « à
 * distance » veut dire « traverse TOUS les filtres géographiques ». Une
 * occurrence toulousaine se serait affichée sous chaque ville de l'agenda, et le
 * balisage l'aurait déclarée en présentiel dans le même temps (`agenda-jsonld`
 * décide, lui, sur l'absence de ville). Deux définitions de « en ligne » qui
 * divergent : c'est exactement ce qu'on voulait éviter. Une seule les tranche,
 * et c'est l'absence de lieu.
 *
 * Une région stockée hors des régions ADMINISTRATIVES est donc ignorée : la BAN
 * évolue, une saisie ancienne peut porter n'importe quoi, et une facette ne doit
 * jamais proposer une entrée que l'annuaire ne connaît pas.
 */
export function regionAffichee(o: {
  ville: string | null;
  region: string | null;
}): string {
  if (!renseigne(o.ville)) return REGION_A_DISTANCE;
  const region = renseigne(o.region);
  return region && REGIONS_ADMINISTRATIVES.has(region)
    ? region
    : REGION_INTERNATIONAL;
}

/**
 * La forme CANONIQUE d'une région dans une URL de filtre (`?region=occitanie`).
 *
 * Le vocabulaire fait foi, mais une adresse ne se partage pas avec des accents
 * et des espaces : le slug est ce qui voyage (§4.5 de l'audit — « des valeurs
 * canoniques plutôt que des libellés »). La conversion vit ICI, avec la règle
 * de région, et pas dans l'écran qui construit le lien.
 */
export function slugRegion(region: string): string {
  return slugify(region);
}

/**
 * Le libellé d'annuaire derrière un slug d'URL, ou `null` si le slug ne
 * correspond à aucune région connue.
 *
 * Sert à NOMMER un filtre actif, même quand il ne ramène rien : une visiteuse
 * qui arrive sur `?region=corse` un mois sans date en Corse doit lire « aucune
 * intervention en Corse », pas un agenda qui a l'air vide.
 */
export function regionDepuisSlug(slug: string): string | null {
  return REGIONS_LIEU.find((r) => slugRegion(r) === slug) ?? null;
}

/**
 * Le lieu tel qu'on l'écrit quand il n'y en a pas : « En ligne », à la forme
 * POSITIVE. « Lieu non renseigné » dirait ce qui manque et ferait passer une
 * intervention en visio pour une saisie inachevée.
 */
export function villeAffichee(ville: string | null): string {
  return renseigne(ville) ?? "En ligne";
}
