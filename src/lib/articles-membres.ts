import { pool } from "@/lib/db";
import { isUniqueViolation } from "@/lib/pg-errors";
import { slugify } from "@/lib/slug";

/**
 * LES ARTICLES DES MEMBRES (lot N3, docs/conception-lot-n3-articles.md) :
 * toute membre écrit (FK sur `users`, avec ou sans fiche), une orga relit
 * avant publication, le nom est FIGÉ à la publication — zéro anonymisation,
 * la membre cède ses droits de publication à Tech Speak'Her (l'article signé
 * survit au retrait de fiche et à la suppression du compte).
 *
 * Sécurité : chaque écriture d'autrice est bornée par `auteur_user_id = SON
 * id de session` ET par le statut (un brouillon se modifie, un article soumis
 * est chez l'orga). Publier/renvoyer appartient à l'orga (gardé par l'action).
 */

export interface ArticleMembreInput {
  titre: string;
  corps: string;
  chapo: string | null;
  categorie: string;
}

export interface ArticleMembre {
  id: number;
  slug: string;
  titre: string;
  chapo: string | null;
  corps: string;
  categorie: string | null;
  statut: "brouillon" | "en_relecture" | "publie";
  publieLe: string | null;
  relectureMotif: string | null;
  majLe: string;
}

interface ArticleRow {
  id: number;
  slug: string;
  titre: string;
  chapo: string | null;
  corps: string;
  categorie: string | null;
  statut: ArticleMembre["statut"];
  publie_le: string | null;
  relecture_motif: string | null;
  maj_le: string;
}

const COLS = `id, slug, titre, chapo, corps, categorie, statut,
  to_char(publie_le, 'YYYY-MM-DD') AS publie_le, relecture_motif, maj_le::text AS maj_le`;

function mapRow(r: ArticleRow): ArticleMembre {
  return {
    id: r.id,
    slug: r.slug,
    titre: r.titre,
    chapo: r.chapo,
    corps: r.corps,
    categorie: r.categorie,
    statut: r.statut,
    publieLe: r.publie_le,
    relectureMotif: r.relecture_motif,
    majLe: r.maj_le,
  };
}

/**
 * Slug d'un article de membre : jamais le segment réservé « nouveau » (la
 * route statique `/admin/contenus/[type]/nouveau` gagnerait sur `[slug]` et
 * l'article deviendrait injoignable par URL), jamais vide (un titre sans
 * lettres, « ??? », slugifie à rien). L'unicité reste à la contrainte.
 */
function slugArticle(titre: string): string {
  const slug = slugify(titre);
  if (slug === "nouveau") return "nouveau-article";
  return slug || "article";
}

/**
 * Plafond d'articles EN COURS (brouillon + en relecture) par membre :
 * l'inscription est ouverte (lien magique), sans borne un compte scripté
 * noierait le « À faire » des orgas sous les soumissions. Un article publié
 * libère sa place. Vingt, c'est déjà une pile honnête pour une plume assidue.
 */
export const PLAFOND_ARTICLES_EN_COURS = 20;

/** Crée le brouillon signé (slug dérivé du titre, unicité par contrainte). */
export async function creerArticle(
  userId: number,
  input: ArticleMembreInput,
): Promise<{ ok: true; id: number } | { ok: false; reason: "slug" | "plafond" }> {
  const slug = slugArticle(input.titre);
  // Le plafond se vérifie DANS l'INSERT (une seule requête, la course de deux
  // soumissions simultanées déborde d'au plus une ligne — sans conséquence).
  const { rows } = await pool.query(
    `INSERT INTO contenus (type, slug, titre, chapo, corps, categorie, statut, auteur_user_id)
     SELECT 'publication', $1, $2, $3, $4, $5, 'brouillon', $6
      WHERE (SELECT COUNT(*) FROM contenus
              WHERE auteur_user_id = $6 AND statut <> 'publie') < $7
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, input.titre, input.chapo, input.corps, input.categorie, userId, PLAFOND_ARTICLES_EN_COURS],
  );
  if (rows.length === 0) {
    const plein = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contenus WHERE auteur_user_id = $1 AND statut <> 'publie'`,
      [userId],
    );
    const n = (plein.rows[0]?.n as number) ?? 0;
    return { ok: false, reason: n >= PLAFOND_ARTICLES_EN_COURS ? "plafond" : "slug" };
  }
  return { ok: true, id: (rows[0] as { id: number }).id };
}

/** Ses articles, les plus récents d'abord (rangée « Mes articles »). Borné :
 * le plafond tient l'en-cours à 20, la borne couvre le publié qui s'accumule. */
export async function listMesArticles(userId: number): Promise<ArticleMembre[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM contenus
      WHERE auteur_user_id = $1
      ORDER BY maj_le DESC, id DESC
      LIMIT 100`,
    [userId],
  );
  return (rows as ArticleRow[]).map(mapRow);
}

/** Le compteur de la rangée du profil (jamais toutes les lignes). */
export async function countMesArticles(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM contenus WHERE auteur_user_id = $1`,
    [userId],
  );
  return (rows[0]?.n as number) ?? 0;
}

/** UN de ses articles — le sien, jamais celui d'une autre. */
export async function getMonArticle(
  id: number,
  userId: number,
): Promise<ArticleMembre | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM contenus WHERE id = $1 AND auteur_user_id = $2`,
    [id, userId],
  );
  return rows.length ? mapRow(rows[0] as ArticleRow) : null;
}

/**
 * Met à jour SON BROUILLON (un article soumis est chez l'orga : le renvoi
 * rend la main). Le slug suit le titre, comme côté admin. `false` = rien
 * d'écrit (pas le sien, ou plus un brouillon).
 */
export async function majMonArticle(
  id: number,
  userId: number,
  input: ArticleMembreInput,
): Promise<boolean> {
  try {
    const res = await pool.query(
      `UPDATE contenus SET
         slug = $3, titre = $4, chapo = $5, corps = $6, categorie = $7, maj_le = now()
       WHERE id = $1 AND auteur_user_id = $2 AND statut = 'brouillon'`,
      [id, userId, slugArticle(input.titre), input.titre, input.chapo, input.corps, input.categorie],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (e) {
    // Slug recalculé du titre : la collision (titre déjà pris ailleurs) est un
    // refus dit, jamais une 500.
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/** Soumet SON brouillon à la relecture. */
export async function soumettreMonArticle(id: number, userId: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE contenus SET statut = 'en_relecture', maj_le = now()
      WHERE id = $1 AND auteur_user_id = $2 AND statut = 'brouillon'`,
    [id, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Les articles qui attendent une orga (tâche « Relire l'article de … »). */
export async function listArticlesEnRelecture(): Promise<
  { id: number; slug: string; titre: string; auteurNom: string | null; majLe: string }[]
> {
  const { rows } = await pool.query(
    `SELECT c.id, c.slug, c.titre, u.name AS auteur_nom, c.maj_le::text AS maj_le
       FROM contenus c
       LEFT JOIN users u ON u.id = c.auteur_user_id
      WHERE c.statut = 'en_relecture'
      ORDER BY c.maj_le, c.id
      LIMIT 50`,
  );
  return (rows as { id: number; slug: string; titre: string; auteur_nom: string | null; maj_le: string }[]).map(
    (r) => ({ id: r.id, slug: r.slug, titre: r.titre, auteurNom: r.auteur_nom, majLe: r.maj_le }),
  );
}

// Publier vit dans `setStatut` (lib/contenus) : LE chemin du CTA de
// l'éditeur admin, qui fige le nom de l'autrice et solde le motif — une
// seule copie de l'invariant de publication.

/**
 * Renvoie un article EN RELECTURE à son autrice, motif à l'appui (charte :
 * la forme évidente se corrige, le fond se renvoie). Rend le slug de la ligne
 * touchée, `null` si l'article a changé d'état entre-temps (publié par une
 * autre orga, par exemple) : l'appelante le DIT au lieu de confirmer à tort.
 */
export async function renvoyerArticle(id: number, motif: string): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE contenus SET statut = 'brouillon', relecture_motif = $2, maj_le = now()
      WHERE id = $1 AND statut = 'en_relecture'
      RETURNING slug`,
    [id, motif],
  );
  return rows.length ? (rows[0] as { slug: string }).slug : null;
}
