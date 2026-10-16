import { foldRecherche, plierEspaces } from "@/lib/normalise-recherche";

/**
 * IDENTITÉ D'UNE CONFÉRENCE, VUE DEPUIS UNE OCCURRENCE — et la règle qui va
 * avec : **une facette se bâtit sur le REGISTRE, jamais sur le libellé figé**.
 *
 * `talk_occurrences.conference` est un SNAPSHOT du nom au moment de la saisie
 * (cf. `db/schema.sql`) ; le lien canonique est `conference_id → conferences`,
 * posé par la migration 068 et alimenté par `ConferenceCombobox`.
 *
 * Pourquoi ça compte (docs/audit-ux-agenda-2026-08.md §4.1) : sur la prod du
 * 16/08/2026, la même journée au même endroit s'affichait sous DEUX libellés
 * (« DevFest Toulouse » 4 fois, « DevFest » 3 fois), et deux conférences
 * portaient leur année dans le nom. Une facette construite sur cette chaîne
 * listerait quatre entrées pour trois événements.
 *
 * Ces deux fonctions tranchent **au bord** (§7 des principes de conception :
 * normaliser au point de lecture, pas dans chaque vue) : la clé sert à
 * regrouper, le libellé à afficher.
 */
export interface IdentiteConference {
  /** Slug du registre (`conferences.slug`), présent dès que l'occurrence y est rattachée. */
  slug: string | null;
  /** Nom canonique du registre (`conferences.nom`). */
  nom: string | null;
  /** Libellé FIGÉ à la saisie (`talk_occurrences.conference`), repli et affichage de carte. */
  snapshot: string | null;
}

/**
 * Préfixe des clés de REPLI. Sans lui, une occurrence en texte libre saisie
 * « DevFest Toulouse » produirait la clé `devfest toulouse`, qu'un slug de
 * registre pourrait un jour égaler : la scène se rangerait alors dans une
 * facette à laquelle elle n'est pas rattachée. Deux espaces de noms, jamais un.
 */
const PREFIXE_REPLI = "texte:";

/**
 * Retire l'ANNÉE d'édition d'un libellé saisi à la main (« Devoxx France 2025 »
 * → « Devoxx France »). Une facette nomme une CONFÉRENCE, pas une édition : les
 * millésimes 2025 et 2026 sont la même entrée de filtre.
 *
 * Volontairement étroit — on ne retire qu'un nombre de quatre chiffres
 * plausible comme année, en FIN de chaîne, précédé d'une espace. « Web2Day »
 * garde son 2, « Sunny Tech 42 » garde son 42.
 */
function sansAnnee(libelle: string): string {
  return libelle.replace(/\s+(?:19|20)\d{2}$/, "");
}

/**
 * Espaces repliées ET répétitions écrasées. `plierEspaces` normalise le TYPE
 * d'espace (insécable → ordinaire) caractère pour caractère, et c'est voulu :
 * Fuse rend des index de match sur la chaîne brute. Ici on fabrique une clé et
 * un libellé, jamais un index — écraser « Devoxx  France » en une seule espace
 * est donc autorisé, et nécessaire pour que deux saisies se rejoignent.
 */
function espacesUniformes(s: string): string {
  return plierEspaces(s).replace(/ {2,}/g, " ").trim();
}

/**
 * Clé stable de regroupement, ou `null` si la scène ne nomme aucune conférence.
 * Le registre fait foi ; le repli ne rapproche que ce qui est littéralement le
 * même texte (casse, accents et espaces repliés, année retirée). Il ne devine
 * PAS que « DevFest » et « DevFest Toulouse » sont la même chose : seul le
 * registre le sait, et c'est précisément pourquoi le rattachement compte.
 */
export function cleConference(c: IdentiteConference): string | null {
  if (c.slug) return c.slug;
  const brut = c.snapshot?.trim();
  if (!brut) return null;
  const replie = foldRecherche(espacesUniformes(sansAnnee(brut)));
  return replie ? `${PREFIXE_REPLI}${replie}` : null;
}

/**
 * Libellé à afficher pour cette conférence : le nom du registre quand il
 * existe, sinon le texte saisi, débarrassé de son année pour la même raison que
 * la clé. `null` si rien n'est renseigné.
 */
export function libelleConference(c: IdentiteConference): string | null {
  if (c.nom) return c.nom;
  const brut = c.snapshot?.trim();
  if (!brut) return null;
  return espacesUniformes(sansAnnee(brut)) || null;
}
