// Carte d'actualité : le DTO affichable d'une publication, et son mapping.
//
// SOURCE UNIQUE de la destination d'un contenu (« article = actualité », cf.
// docs/conception-articles.md §2) : `/actualites`, l'accueil et la recherche du
// site passent par ici, donc un contenu mène au même endroit où qu'on le
// rencontre.

import type { Contenu, ContenuType } from "@/lib/contenus";
import { dateLongueFr } from "@/lib/format";

/** Carte d'actualité prête à afficher (DTO sérialisable, calculé côté serveur). */
export interface CarteActu extends Destination {
  slug: string;
  titre: string;
  chapo: string | null;
  date: string; // déjà formatée en français
  /** Même date en « YYYY-MM-DD » pour l'attribut `datetime` (HTML valide). */
  dateISO: string | null;
  categorie: string | null;
  tag: string | null;
  /** Le statut complet (dont « en_relecture », lot N3) : la liste admin des
   * actualités badge chaque état en mots. */
  statut: import("@/lib/contenus").Statut;
  /** Lien d'édition (orga seulement, sinon null). */
  editHref: string | null;
  /** Photo déposée dans l'éditeur (lot 6) : affichée en vignette sur la carte. */
  imageUrl: string | null;
  imageAlt: string | null;
}

/**
 * Destination d'un contenu, et l'intitulé du lien qui y mène. C'est LA règle
 * « article = actualité », isolée ici parce que deux surfaces la partagent : la
 * carte d'actualité (accueil, /actualites) et la recherche du site. Un corps
 * l'emporte sur le lien externe, qui l'emporte sur le lien interne.
 *
 * Prend le strict nécessaire (pas un `Contenu` entier) : la recherche lit une
 * projection tronquée où le corps ne transite pas, et connaît seulement sa
 * PRÉSENCE.
 */
export interface Destination {
  href: string | null;
  externe: boolean;
  hrefLabel: string | null;
  /**
   * Complément `sr-only` de l'intitulé, qui nomme le contenu visé : sans lui,
   * la page aligne N liens « Lire la suite » pour N destinations (RGAA 6.1 /
   * WCAG 2.4.4). La préposition suit la destination — on lit un article, on en
   * sait plus sur une actualité.
   */
  hrefContexte: string | null;
}

export function destinationContenu(c: {
  type: ContenuType;
  slug: string;
  titre: string;
  aCorps: boolean;
  lien: string | null;
  lienExterne: string | null;
  lienLabel: string | null;
}): Destination {

  // Une PAGE éditoriale vit à sa racine (`src/app/[slug]`) et y vit dès sa
  // publication, corps ou pas : elle a une URL vivante, elle est au sitemap et
  // l'admin la lie déjà. Son corps ne décide de rien.
  if (c.type === "page") {
    return {
      href: `/${c.slug}`,
      externe: false,
      hrefLabel: "Ouvrir la page",
      hrefContexte: `« ${c.titre} »`,
    };
  }
  if (c.aCorps) {
    return {
      href: `/articles/${c.slug}`,
      externe: false,
      hrefLabel: "Lire la suite",
      hrefContexte: `de « ${c.titre} »`,
    };
  }
  if (c.lienExterne) {
    return {
      href: c.lienExterne,
      externe: true,
      hrefLabel: c.lienLabel || "Voir",
      hrefContexte: `sur « ${c.titre} »`,
    };
  }
  if (c.lien) {
    return {
      href: c.lien,
      externe: false,
      hrefLabel: "En savoir plus",
      hrefContexte: `sur « ${c.titre} »`,
    };
  }
  return { href: null, externe: false, hrefLabel: null, hrefContexte: null };
}

export function toCarteActu(c: Contenu, estOrga: boolean): CarteActu {
  const destination = destinationContenu({
    type: c.type,
    slug: c.slug,
    titre: c.titre,
    aCorps: c.corps.trim() !== "",
    lien: c.lien,
    lienExterne: c.lienExterne,
    lienLabel: c.lienLabel,
  });
  return {
    slug: c.slug,
    titre: c.titre,
    chapo: c.chapo,
    date: c.publieLe ? dateLongueFr(c.publieLe) ?? "" : "",
    dateISO: c.publieLe,
    categorie: c.categorie,
    tag: c.tag,
    ...destination,
    statut: c.statut,
    editHref: estOrga ? `/admin/contenus/publication/${c.slug}` : null,
    imageUrl: c.imageUrl,
    imageAlt: c.imageAlt,
  };
}
