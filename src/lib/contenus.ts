// Contenus éditoriaux (migration 036) — accès DB partagé.
// Voir docs/conception-articles.md : une table polymorphe. Une PUBLICATION est
// l'objet daté (article = actualité) ; une PAGE est une prose autonome à slug
// fixe. « article = actualité » : la carte /actualites et la page /articles
// affichent le MÊME objet (page dédiée seulement s'il a un corps).

import { cache } from "react";
import { pool, withTransactionSaufTable, type Queryable } from "@/lib/db";
import { isUniqueViolation, siSchemaEnRetard, siTableAbsente } from "@/lib/pg-errors";
import { slugify } from "@/lib/slug";
import { estSlugReserve } from "@/data/slugs-reserves";

export type ContenuType = "publication" | "page";
// « en_relecture » (lot N3) : l'article d'une membre attend une orga —
// invisible du public (toutes les lectures publiques filtrent 'publie').
export type Statut = "brouillon" | "en_relecture" | "publie";

/**
 * Un lien interne stocké est un chemin absolu du site. Défense contre une donnée
 * ANCIENNE, d'avant les gardes du formulaire, avant de construire une URL
 * (`${BASE_URL}${lien}`, `<Link href>` ou un `router.push` depuis la palette).
 *
 * Replie toute suite de séparateurs de tête sur un seul « / ». Deux pièges d'un
 * coup : le « / » oublié (« tremplin » donnerait « techspeakher.frtremplin »), et
 * surtout l'URL protocol-relative déguisée — dans « //evil.test » ou
 * « /\evil.test », le navigateur lit un HÔTE et non un chemin, et emmènerait la
 * visiteuse hors du site. La sortie satisfait toujours `isSafeInternalPath`.
 */
export function cheminInterne(lien: string): string {
  return `/${lien.replace(/^[/\\]+/, "")}`;
}

export interface Contenu {
  id: number;
  type: ContenuType;
  slug: string;
  titre: string;
  chapo: string | null;
  corps: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Taille de l'image, mesurée au dépôt (migration 065) : elle permet de
   * réserver sa place en tête d'article. NULL = inconnue (image antérieure),
   * l'affichage se replie alors sur la proportion naturelle sans réservation. */
  imageWidth: number | null;
  imageHeight: number | null;
  /** Vidéo de l'article (migration 053) : la vignette en est dérivée. */
  videoUrl: string | null;
  categorie: string | null;
  tag: string | null;
  lien: string | null;
  lienExterne: string | null;
  lienLabel: string | null;
  statut: Statut;
  publieLe: string | null; // 'YYYY-MM-DD'
  majLe: string;
  /** Au flux RSS ? false pour le contenu historique seedé (pas de repost). */
  auFlux: boolean;
  /** Édition de conférence rattachée (migration 040) : la page article liste
   * alors les speakeuses ayant un talk sur cette édition. NULL = non rattaché. */
  conferenceEditionId: number | null;
  /** L'autrice (lot N3) : le nom FIGÉ à la publication (survit à tout — zéro
   * anonymisation, droits cédés) ; NULL = contenu signé Tech Speak'Her. */
  auteurNom: string | null;
  /** Lien vivant vers son compte (SET NULL à la suppression). */
  auteurUserId: number | null;
  /** Photo du compte, jointe par les lectures qui l'affichent (fil, cartes) ;
   * ailleurs null. */
  auteurImage: string | null;
  /** Motif du dernier renvoi en relecture, montré à l'autrice. */
  relectureMotif: string | null;
}

/** Entrée d'écriture (le slug est dérivé du titre, jamais fourni par le client). */
export interface ContenuInput {
  type: ContenuType;
  titre: string;
  chapo: string | null;
  corps: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  videoUrl: string | null;
  categorie: string | null;
  tag: string | null;
  lien: string | null;
  lienExterne: string | null;
  lienLabel: string | null;
  conferenceEditionId: number | null;
}

interface ContenuRow {
  auteur_user_id?: number | null;
  auteur_nom?: string | null;
  auteur_image?: string | null;
  relecture_motif?: string | null;
  id: number;
  type: ContenuType;
  slug: string;
  titre: string;
  chapo: string | null;
  corps: string;
  image_url: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  video_url: string | null;
  categorie: string | null;
  tag: string | null;
  lien: string | null;
  lien_externe: string | null;
  lien_label: string | null;
  statut: Statut;
  publie_le: string | null;
  maj_le: string;
  au_flux: boolean;
  conference_edition_id: number | null;
}

// Normalisation au bord (principes-conception-ui §7) : un seul point de lecture.
// Dates sérialisées en chaîne (to_char / ::text) pour être indépendant du parseur
// de types (le pool réel a un parser DATE, PGlite non) et affichables côté React.
const COLS = `id, type, slug, titre, chapo, corps, image_url, image_alt,
  image_width, image_height, video_url,
  categorie, tag, lien, lien_externe, lien_label, statut,
  to_char(publie_le, 'YYYY-MM-DD') AS publie_le, maj_le::text AS maj_le, au_flux,
  conference_edition_id, auteur_user_id, auteur_nom, relecture_motif`;

// Les lectures qui prennent `COLS` sélectionnent `video_url` (migration 053) :
// elles se replient sur `siSchemaEnRetard`, qui tolère la colonne encore absente
// le temps qu'une base soit synchronisée (cf. pg-errors, règle expand/contract).
function mapRow(r: ContenuRow): Contenu {
  return {
    id: r.id,
    type: r.type,
    slug: r.slug,
    titre: r.titre,
    chapo: r.chapo,
    corps: r.corps,
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
    imageWidth: r.image_width,
    imageHeight: r.image_height,
    videoUrl: r.video_url,
    categorie: r.categorie,
    tag: r.tag,
    // Normalisé au bord (principes-conception-ui §7) : un lien interne stocké
    // sans « / » de tête est ramené à un chemin absolu, une fois pour tous les
    // consommateurs (RSS, cartes /actualites…).
    lien: r.lien != null ? cheminInterne(r.lien) : null,
    lienExterne: r.lien_externe,
    lienLabel: r.lien_label,
    statut: r.statut,
    publieLe: r.publie_le,
    majLe: r.maj_le,
    auFlux: r.au_flux,
    conferenceEditionId: r.conference_edition_id,
    auteurNom: r.auteur_nom ?? null,
    auteurUserId: r.auteur_user_id ?? null,
    auteurImage: r.auteur_image ?? null,
    relectureMotif: r.relecture_motif ?? null,
  };
}

// ─── Lectures publiques (statut = 'publie' uniquement) ───

/**
 * Un contenu publié par son slug (publication OU page), ou null. Mémoïsé par
 * rendu (`React.cache`) : `generateMetadata` et le corps de page partagent la
 * même requête au lieu de deux SELECT identiques (cf. `getProfileById`).
 */
export const getContenuPublieBySlug = cache(
  async (slug: string): Promise<Contenu | null> => {
    const { rows } = await pool
      .query(`SELECT ${COLS} FROM contenus WHERE slug = $1 AND statut = 'publie'`, [slug])
      .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
    return rows.length ? mapRow(rows[0] as ContenuRow) : null;
  },
);

/**
 * Article d'accompagnement « Où héberger tes slides ? ». Le formulaire de talk
 * y renvoie depuis le champ « Lien slides », mais UNIQUEMENT s'il est publié :
 * jamais de lien mort avant sa mise en ligne. Le slug est dérivé du titre, comme
 * à la création (l'orga doit garder ce titre exact pour que le renvoi s'active).
 */
export const AIDE_SLIDES_TITRE = "Où héberger tes slides ?";
export const AIDE_SLIDES_SLUG = slugify(AIDE_SLIDES_TITRE);

/** Lien vers l'article d'aide « où héberger tes slides » s'il est publié et a un
 *  corps (une annonce-lien sans corps ne compte pas), sinon null. */
export async function getAideSlidesHref(): Promise<string | null> {
  const c = await getContenuPublieBySlug(AIDE_SLIDES_SLUG);
  return c && c.type === "publication" && c.corps.trim() !== ""
    ? `/articles/${c.slug}`
    : null;
}

/** Toutes les publications publiées (cartes /actualites, accueil, RSS), récentes d'abord. */
export async function listPublications(): Promise<Contenu[]> {
  const { rows } = await pool
    .query(
      `SELECT ${COLS} FROM contenus
        WHERE type = 'publication' AND statut = 'publie'
        ORDER BY publie_le DESC NULLS LAST, id DESC`,
    )
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return (rows as ContenuRow[]).map(mapRow);
}

/**
 * Conditions d'une carte d'actualité VISIBLE du fil (alias c) : publication
 * publiée, datée, avec une destination — le miroir SQL de
 * `destinationContenu`. Une seule copie, partagée avec les bravos (lot N4).
 */
export const CONTENU_PUBLIE = `c.type = 'publication' AND c.statut = 'publie'`;

export const CONTENU_AU_FIL = `${CONTENU_PUBLIE}
        AND c.publie_le IS NOT NULL
        AND (btrim(c.corps) <> ''
             OR NULLIF(btrim(c.lien), '') IS NOT NULL
             OR NULLIF(btrim(c.lien_externe), '') IS NOT NULL)`;

/**
 * Les N publications publiées les plus récentes, pour l'EXTRAIT de l'accueil.
 *
 * Volontairement distincte de `listPublications` : l'accueil est rendu à chaque
 * visite (`force-dynamic`) et n'affiche que 4 cartes, alors que `corps` peut
 * peser 50 000 caractères par ligne. La limite part donc en SQL, et `corps` est
 * réduit à son PREMIER caractère non blanc — une carte a seulement besoin de
 * savoir s'il y en a un (corps → page article, cf. `toCarteActu`). Ne pas s'en
 * servir pour AFFICHER un corps : il est tronqué par construction.
 *
 * `avecDestination` (le fil connecté — conception v2 :
 * docs/conception-espace-fil-navigation.md, lot N2, seul consommateur prévu) :
 * seules les publications DATÉES
 * et MENANT quelque part (corps, lien interne ou lien externe — le miroir SQL
 * de `destinationContenu`). Le filtre doit partir en SQL, pas après coup : une
 * publication écartée après le LIMIT volerait sa place à une plus ancienne, et
 * l'invariant « limite par source » du fil serait faux.
 */
export async function listPublicationsRecentes(
  limite: number,
  { avecDestination = false }: { avecDestination?: boolean } = {},
): Promise<Contenu[]> {
  const { rows } = await pool
    .query(
      `SELECT c.id, c.type, c.slug, c.titre, c.chapo, left(btrim(c.corps), 1) AS corps,
              c.image_url, c.image_alt, c.image_width, c.image_height,
              c.categorie, c.tag, c.lien, c.lien_externe,
              c.lien_label, c.statut, to_char(c.publie_le, 'YYYY-MM-DD') AS publie_le,
              c.maj_le::text AS maj_le, c.au_flux, c.conference_edition_id,
              c.auteur_user_id, c.auteur_nom, c.relecture_motif,
              u.image AS auteur_image
         FROM contenus c
         LEFT JOIN users u ON u.id = c.auteur_user_id
        WHERE ${avecDestination ? CONTENU_AU_FIL : CONTENU_PUBLIE}
        ORDER BY c.publie_le DESC NULLS LAST, c.id DESC
        LIMIT $1`,
      [limite],
    )
    // Colonnes du lot N3 (auteur_user_id…) : le repli tolère la colonne
    // encore absente, pas seulement la table.
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return (rows as ContenuRow[]).map(mapRow);
}

/** Publications publiées AYANT un corps (liste /articles) — les annonces-lien sont exclues. */
export async function listArticlesPublies(): Promise<Contenu[]> {
  const { rows } = await pool
    .query(
      `SELECT ${COLS} FROM contenus
        WHERE type = 'publication' AND statut = 'publie' AND btrim(corps) <> ''
        ORDER BY publie_le DESC NULLS LAST, id DESC`,
    )
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return (rows as ContenuRow[]).map(mapRow);
}

/**
 * Longueur du corps indexée par la recherche. Un corps peut peser `CORPS_MAX`
 * (50 000 caractères) : sans borne, ouvrir la palette téléchargerait tous les
 * articles publiés. On garde de quoi porter l'accroche — près du double du
 * budget d'aperçu (160).
 *
 * La borne est MESURÉE, pas devinée : à 600, le plein-texte pesait 116 Ko bruts
 * (11 Ko compressés) de plus par visiteuse et ajoutait ~4 ms à CHAQUE frappe
 * (Fuse cherche sur le fil principal, sans anti-rebond). Contrepartie assumée :
 * une phrase enfouie au milieu d'un long article ne se cherche pas
 * (cf. docs/conception-recherche-contenus.md §3.3).
 */
export const RECHERCHE_CORPS_MAX = 300;

/**
 * Nombre de contenus servis à la recherche. La palette télécharge la liste
 * ENTIÈRE à la première frappe : sans plafond, elle grandirait d'un article à
 * chaque publication, pour toujours. Au-delà, la réponse est une recherche
 * SERVEUR (cf. docs/conception-recherche-contenus.md §6), pas un index client
 * plus gros. Les plus récents priment — c'est ce qu'on cherche le plus.
 */
export const RECHERCHE_MAX_CONTENUS = 200;

/** Ce que la recherche (⌘K) a besoin de savoir d'un contenu publié. */
export interface ContenuRecherche {
  type: ContenuType;
  slug: string;
  titre: string;
  chapo: string | null;
  categorie: string | null;
  /** Date de publication : elle date l'aperçu, comme sur la carte. */
  publieLe: string | null;
  /** Début du corps, tronqué en SQL : indexé en plein-texte, jamais rendu brut. */
  extraitCorps: string;
  /** Y a-t-il un corps ? Calculé en base — le corps entier ne transite pas. */
  aCorps: boolean;
  lien: string | null;
  lienExterne: string | null;
  lienLabel: string | null;
}

/**
 * Source de la recherche : publications ET pages PUBLIÉES, récentes d'abord.
 *
 * Le corps est tronqué et sa présence calculée EN BASE (même souci que
 * `listPublicationsRecentes`) : la destination d'un résultat dépend seulement
 * de l'existence d'un corps, pas de son contenu. Résilient : schéma en retard →
 * liste vide, la recherche statique et les speakeuses restent.
 */
export async function listContenusPourRecherche(): Promise<ContenuRecherche[]> {
  const { rows } = await pool
    .query(
      `SELECT type, slug, titre, chapo, categorie, lien, lien_externe, lien_label,
              publie_le::text AS publie_le,
              left(corps, $1)    AS extrait_corps,
              btrim(corps) <> '' AS a_corps
         FROM contenus
        WHERE statut = 'publie' AND type IN ('publication', 'page')
        ORDER BY publie_le DESC NULLS LAST, id DESC
        LIMIT $2`,
      [RECHERCHE_CORPS_MAX, RECHERCHE_MAX_CONTENUS],
    )
    .catch(siSchemaEnRetard({ rows: [] as RechercheRow[] }));
  return (rows as RechercheRow[]).map((r) => ({
    type: r.type,
    slug: r.slug,
    titre: r.titre,
    chapo: r.chapo,
    categorie: r.categorie,
    publieLe: r.publie_le,
    extraitCorps: r.extrait_corps ?? "",
    aCorps: r.a_corps,
    // Normalisé au bord comme dans `mapRow` : un lien interne saisi sans « / »
    // de tête (donnée d'avant la garde du formulaire) donnerait une URL
    // RELATIVE dans la palette, donc une destination dépendant de la page où
    // l'on se trouve.
    lien: r.lien != null ? cheminInterne(r.lien) : null,
    lienExterne: r.lien_externe,
    lienLabel: r.lien_label,
  }));
}

interface RechercheRow {
  type: ContenuType;
  slug: string;
  titre: string;
  chapo: string | null;
  categorie: string | null;
  publie_le: string | null;
  extrait_corps: string | null;
  a_corps: boolean;
  lien: string | null;
  lien_externe: string | null;
  lien_label: string | null;
}

/**
 * Ce qu'une page publique montre d'un récit sans l'ouvrir : de quoi faire une
 * accroche cliquable. Rien de plus — le texte vit sur `/articles/<slug>`.
 */
export interface RecitConference {
  slug: string;
  titre: string;
  chapo: string | null;
}

/**
 * Le récit rattaché à une édition de conférence : l'article PUBLIÉ (avec corps)
 * le plus récent, ou null.
 *
 * C'EST le mécanisme du dépôt pour associer du contenu à une conférence
 * répertoriée (`contenus.conference_edition_id`, migration 040) : l'orga écrit
 * dans `/admin/contenus` et choisit l'édition, aucune page n'a de texte en dur.
 * Les deux surfaces qui racontent une année s'y branchent — la page de la
 * conférence et celle de l'édition du Tremplin qui s'y tient.
 *
 * Résilient : table absente → null (une base en retard ne casse pas la page).
 */
export async function getPublishedArticleByConferenceEdition(
  conferenceEditionId: number,
): Promise<RecitConference | null> {
  const { rows } = await pool
    .query(
      `SELECT slug, titre, chapo FROM contenus
        WHERE type = 'publication' AND statut = 'publie'
          AND btrim(corps) <> '' AND conference_edition_id = $1
        ORDER BY publie_le DESC NULLS LAST, id DESC
        LIMIT 1`,
      [conferenceEditionId],
    )
    .catch(siTableAbsente({ rows: [] as RecitConference[] }));
  return rows.length ? (rows[0] as RecitConference) : null;
}

/**
 * Pages publiées (pour le sitemap) : slug + date de mise à jour.
 *
 * Les slugs masqués par une route du code sont ÉCARTÉS : le formulaire les
 * refuse désormais, mais une page enregistrée avant cette garde produirait une
 * seconde entrée `/a-propos` au sitemap, en concurrence avec la route réelle et
 * sur une URL qui ne sert pas son contenu. Même règle que la recherche.
 */
export async function listPagesPubliees(): Promise<{ slug: string; majLe: string }[]> {
  const { rows } = await pool
    .query(
      `SELECT slug, maj_le::text AS maj_le FROM contenus
        WHERE type = 'page' AND statut = 'publie' ORDER BY slug`,
    )
    .catch(siTableAbsente({ rows: [] as { slug: string; maj_le: string }[] }));
  return (rows as { slug: string; maj_le: string }[])
    .filter((r) => !estSlugReserve(r.slug))
    .map((r) => ({ slug: r.slug, majLe: r.maj_le }));
}

// ─── Lectures admin (tous statuts) ───

/** Un contenu par id, tous statuts (édition orga), ou null. */
export async function getContenuById(id: number): Promise<Contenu | null> {
  const { rows } = await pool
    .query(`SELECT ${COLS} FROM contenus WHERE id = $1`, [id])
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return rows.length ? mapRow(rows[0] as ContenuRow) : null;
}

/** Un contenu par slug, tous statuts (page d'édition orga), ou null. */
export async function getContenuBySlug(slug: string): Promise<Contenu | null> {
  const { rows } = await pool
    .query(`SELECT ${COLS} FROM contenus WHERE slug = $1`, [slug])
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return rows.length ? mapRow(rows[0] as ContenuRow) : null;
}

/** Tous les contenus d'un type (hub d'admin), publiés en tête. */
export async function listContenus(type: ContenuType): Promise<Contenu[]> {
  const { rows } = await pool
    .query(
      `SELECT ${COLS} FROM contenus WHERE type = $1
        ORDER BY publie_le DESC NULLS LAST, maj_le DESC`,
      [type],
    )
    .catch(siSchemaEnRetard({ rows: [] as ContenuRow[] }));
  return (rows as ContenuRow[]).map(mapRow);
}

// ─── Écritures (SQL paramétré) ───

const WRITE_PARAMS = (i: ContenuInput, slug: string) => [
  i.type, slug, i.titre, i.chapo, i.corps, i.imageUrl, i.imageAlt,
  i.imageWidth, i.imageHeight, i.videoUrl,
  i.categorie, i.tag, i.lien, i.lienExterne, i.lienLabel, i.conferenceEditionId,
];

/** Crée un contenu (toujours en brouillon). Slug pris → { ok:false, reason:'slug' }. */
export async function createContenu(
  input: ContenuInput,
): Promise<{ ok: true; id: number; slug: string } | { ok: false; reason: "slug" }> {
  const slug = slugify(input.titre);
  const { rows } = await pool.query(
    `INSERT INTO contenus
       (type, slug, titre, chapo, corps, image_url, image_alt, image_width, image_height,
        video_url, categorie, tag, lien, lien_externe, lien_label, conference_edition_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    WRITE_PARAMS(input, slug),
  );
  if (rows.length === 0) return { ok: false, reason: "slug" };
  return { ok: true, id: (rows[0] as { id: number }).id, slug };
}

/**
 * Met à jour un contenu (hors statut, cf. `setStatut`). Le slug est recalculé
 * depuis le titre : un renommage change l'URL (géré côté action par une
 * redirection). Collision de slug → { ok:false, reason:'slug' }.
 */
export async function updateContenu(
  id: number,
  input: ContenuInput,
): Promise<{ ok: true; slug: string } | { ok: false; reason: "slug" | "introuvable" }> {
  const slug = slugify(input.titre);
  try {
    return await withTransactionSaufTable("fil_reactions", async (q, avecPurge) => {
      const res = await q.query(
        `UPDATE contenus SET
           type=$2, slug=$3, titre=$4, chapo=$5, corps=$6, image_url=$7, image_alt=$8,
           image_width=$9, image_height=$10, video_url=$11, categorie=$12, tag=$13,
           lien=$14, lien_externe=$15, lien_label=$16, conference_edition_id=$17,
           maj_le=now()
         WHERE id=$1`,
        [id, ...WRITE_PARAMS(input, slug)],
      );
      if (!res.rowCount) return { ok: false as const, reason: "introuvable" as const };
      // Lot N4 : une édition peut faire QUITTER le fil à une carte (destination
      // effacée, type passé en page) — ses bravos partent avec elle, comme à la
      // dépublication. Le miroir SQL est LE même (CONTENU_AU_FIL).
      if (avecPurge)
        await q.query(
          `DELETE FROM fil_reactions
            WHERE contenu_id = $1
              AND NOT EXISTS (SELECT 1 FROM contenus c WHERE c.id = $1 AND ${CONTENU_AU_FIL})`,
          [id],
        );
      return { ok: true as const, slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug" };
    throw e;
  }
}

/**
 * Change le statut. En publiant une publication sans date, pose `publie_le` au
 * jour même (les pages n'ont pas de date). Repasser en brouillon garde la date.
 */
export async function setStatut(id: number, statut: Statut): Promise<void> {
  const changer = async (q: Queryable, avecPurge: boolean) => {
    await q.query(
      `UPDATE contenus SET
         statut = $2,
         -- Jour PARIS, pas CURRENT_DATE (jour UTC de la base) : publier entre
         -- minuit et 2 h datait l'actu de la veille — affichage antidaté.
         publie_le = CASE
           WHEN $2 = 'publie' AND publie_le IS NULL AND type = 'publication'
           THEN (now() AT TIME ZONE 'Europe/Paris')::date ELSE publie_le END,
         -- Lot N3 : publier FIGE le nom de l'autrice (zéro anonymisation, le
         -- snapshot survit au compte) et solde le motif de renvoi — quel que
         -- soit le chemin (bandeau de relecture OU bouton Publier de l'éditeur).
         auteur_nom = CASE
           WHEN $2 = 'publie'
           THEN COALESCE(auteur_nom, (SELECT name FROM users WHERE id = auteur_user_id))
           ELSE auteur_nom END,
         relecture_motif = CASE WHEN $2 = 'publie' THEN NULL ELSE relecture_motif END,
         maj_le = now()
       WHERE id = $1`,
      [id, statut],
    );
    // Lot N4, retrait rétroactif : dépublier PURGE les bravos de la carte —
    // dans la MÊME transaction (la purge est une promesse RGPD, jamais un
    // best-effort qu'une panne entre deux requêtes ferait mentir).
    if (avecPurge && statut !== "publie")
      await q.query(`DELETE FROM fil_reactions WHERE contenu_id = $1`, [id]);
  };
  // Publier ne purge rien : le chemin chaud reste une requête sans transaction.
  if (statut === "publie") return changer(pool, false);
  await withTransactionSaufTable("fil_reactions", changer);
}

/** Supprime un contenu. */
export async function deleteContenu(id: number): Promise<void> {
  await pool.query(`DELETE FROM contenus WHERE id = $1`, [id]);
}
