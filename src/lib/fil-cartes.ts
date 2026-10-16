import type { ScenePublique } from "@/lib/agenda-public";
import type { NouvelleVenue } from "@/lib/fil-communaute";
import type { Contenu } from "@/lib/contenus";
import { destinationContenu } from "@/lib/carte-actu";
import { CATEGORIE_CONSEIL } from "@/data/categories-contenus";
import { dateLongueFr } from "@/lib/format";
import { NOM_AFFICHE, nomInsecable } from "@/data/association";

/**
 * LE FIL de l'Accueil connecté (conception v2 §4, lot N2) : un seul flux
 * antichronologique de FAITS incarnés — quelqu'un avance vers une scène, ou
 * l'asso en crée l'occasion. Trois sources publiques (posées au lot 1), une
 * fusion PURE testée sans BDD ; les protections vivent en SQL dans chaque
 * source (fiche retirée = cartes disparues rétroactivement, jamais de
 * brouillon, scènes strictement passées à date exacte, retour discret).
 *
 * Doctrine (§0) : chronologique, fin de fil « Tu es à jour ✓ » à `FIL_MAX`
 * cartes — pas d'archive, pas de scroll infini ; les listes complètes
 * restent publiques (/speakeuses, /agenda, /actualites), le fil pointe.
 */

/** Plafond du fil : au-delà, « Tu es à jour ✓ » (réglable, conception N2 §3). */
export const FIL_MAX = 20;

/** LA clé d'une carte, partagée avec les bravos (lot N4) : un seul producteur
 * du format — un désaccord ferait rater tous les compteurs, en silence. */
export function cleCarte(type: CarteFil["type"], id: number): string {
  return `${type}-${id}`;
}

export interface CarteFil {
  /** Clé React stable, unique toutes sources confondues. */
  cle: string;
  type: "scene" | "venue" | "asso";
  /** Jour (YYYY-MM-DD, heure de Paris) : l'ordre du fil. */
  date: string;
  /** Qui — une personne (nom + photo) ou l'asso (logo, cf. composant). */
  nom: string;
  image: string | null;
  /** Le fait, en verbe court (« sur scène ») ; null pour une carte asso, où
   * le titre du contenu parle seul. */
  fait: string | null;
  titre: string | null;
  detail: string | null;
  /** La carte ENTIÈRE est ce lien : une seule destination par carte. */
  href: string;
  /** CE QUE DIT le lien — « Voir sa fiche », « Lire l'article »… (retour de
   * Cateline : une flèche nue ne dit pas où l'on arrive ; RGAA 6.1 aussi). */
  hrefLabel: string;
  externe: boolean;
  /** Id source (tri secondaire à jour et type égaux). */
  id: number;
  /** La propriétaire de la carte (lot N4) : sa fiche (scène, venue) ou son
   * compte (article de membre) — le bouton Bravo s'efface sur SA carte, et
   * `null` = l'asso (personne en propre). */
  proprioProfileId: number | null;
  proprioUserId: number | null;
  /**
   * L'ILLUSTRATION du fait (lot 6) — distincte de `image`, qui est le portrait
   * de la personne. Seule une actualité en porte une : une scène ou une arrivée
   * s'incarnent par leur avatar.
   *
   * Pas d'alternative textuelle ici, et c'est délibéré : la carte entière est
   * UN lien, dont le nom accessible dit déjà qui, quoi et quand. Y verser la
   * description de l'image l'allongerait sans rien apprendre (même raison que
   * l'avatar, décoratif juste au-dessus). L'image porte son vrai `alt` là où
   * elle est le contenu : sur l'article et sur sa carte d'actualité.
   */
  visuelUrl: string | null;
}

/** « {Nom} · sur scène — “{talk}” · {conf}, {ville} » → sa fiche. */
export function carteScene(s: ScenePublique): CarteFil {
  return {
    cle: cleCarte("scene", s.occurrenceId),
    type: "scene",
    date: s.date,
    nom: s.speakeuseNom,
    image: s.image,
    fait: "sur scène",
    // Même repli d'affichage que `SceneCard` : ces deux champs viennent de la
    // saisie d'une membre, et le fil les rend tels quels.
    titre: `« ${nomInsecable(s.talkTitre)} »`,
    detail: nomInsecable([s.conference, s.ville].filter(Boolean).join(", ")) || null,
    href: s.speakeuseHref,
    hrefLabel: "Voir sa fiche",
    externe: false,
    id: s.occurrenceId,
    proprioProfileId: s.profileId,
    proprioUserId: null,
    visuelUrl: null,
  };
}

/** « {Nom} · a rejoint l'annuaire » → sa fiche. */
export function carteVenue(v: NouvelleVenue): CarteFil {
  return {
    cle: cleCarte("venue", v.profileId),
    type: "venue",
    date: v.date,
    nom: v.nom,
    image: v.image,
    fait: "a rejoint l'annuaire",
    titre: null,
    detail: v.titreProfil && nomInsecable(v.titreProfil),
    href: v.href,
    hrefLabel: "Voir sa fiche",
    externe: false,
    id: v.profileId,
    proprioProfileId: v.profileId,
    proprioUserId: null,
    visuelUrl: null,
  };
}

/**
 * Une actualité → sa destination (« article = actualité »,
 * `destinationContenu`, la même règle que partout). Signée Tech Speak'Her,
 * ou INCARNÉE quand une membre l'a écrite (lot N3 : nom figé à la
 * publication, photo du compte tant qu'il existe). Sans destination ou sans
 * date : pas de carte — le SQL (`avecDestination`) filtre déjà, ceci est la
 * sûreté du mapping.
 */
export function carteAsso(c: Contenu): CarteFil | null {
  const destination = destinationContenu({
    type: c.type,
    slug: c.slug,
    titre: nomInsecable(c.titre),
    aCorps: c.corps.trim() !== "",
    lien: c.lien,
    lienExterne: c.lienExterne,
    lienLabel: c.lienLabel,
  });
  if (!destination.href || !c.publieLe) return null;
  return {
    cle: cleCarte("asso", c.id),
    type: "asso",
    date: c.publieLe,
    nom: c.auteurNom ?? NOM_AFFICHE,
    image: c.auteurNom ? c.auteurImage : null,
    fait: c.auteurNom ? "a publié un article" : null,
    titre: nomInsecable(c.titre),
    detail: c.chapo && nomInsecable(c.chapo),
    href: destination.href,
    // Un article se LIT, et son intitulé dit QUOI : « Lire le conseil » pour
    // un conseil de speakeuse (retour de Cateline) — une annonce-lien garde
    // l'intitulé de sa destination.
    hrefLabel: c.corps.trim()
      ? c.categorie === CATEGORIE_CONSEIL
        ? "Lire le conseil"
        : "Lire l'article"
      : destination.hrefLabel ?? "Voir",
    externe: destination.externe,
    id: c.id,
    proprioProfileId: null,
    proprioUserId: c.auteurUserId ?? null,
    visuelUrl: c.imageUrl,
  };
}

/** L'ordre DIT à jour égal : une scène avant une arrivée avant l'asso. */
const RANG: Record<CarteFil["type"], number> = { scene: 0, venue: 1, asso: 2 };

/**
 * Fusion antichronologique STABLE : jour décroissant, puis rang de type,
 * puis id décroissant — jamais un aléa de tri. Plafonnée à `max`.
 */
export function fusionnerFil(cartes: CarteFil[], max = FIL_MAX): CarteFil[] {
  return [...cartes]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || RANG[a.type] - RANG[b.type] || b.id - a.id,
    )
    .slice(0, max);
}

/** La date d'une carte, en toutes lettres : « aujourd'hui », « hier », sinon
 * la date longue française. `aujourdhui` vient de l'appelant (jour de Paris). */
export function jourFilFr(date: string, aujourdhui: string): string {
  if (date === aujourdhui) return "aujourd'hui";
  const veille = new Date(`${aujourdhui}T00:00:00Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  if (date === veille.toISOString().slice(0, 10)) return "hier";
  return dateLongueFr(date) ?? date;
}
