import { pool } from "@/lib/db";

/**
 * Jury d'une édition du Tremplin (cf. docs/conception-phases-tremplin.md §9.4).
 *
 * Des personnes qui ne sont PAS forcément des comptes de la plateforme (comme
 * les tags photo « nom libre »). Nom, prénom, fonction et entreprise sont
 * PUBLICS (accord recueilli, cf. §9.5) ; l'e-mail est INTERNE (organisation),
 * jamais sérialisé dans le DTO public.
 */
export interface Jury {
  id: number;
  editionId: number;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entreprise: string | null;
  /** INTERNE (contact orga) — jamais exposé publiquement. */
  email: string | null;
  createdAt: Date | null;
}

/** Champs saisis à la création d'un juré. */
export interface JuryInput {
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entreprise: string | null;
  email: string | null;
}

/** DTO PUBLIC d'un juré : sans id ni e-mail (anti-fuite : on ne sérialise que
 * ce qui s'affiche). */
export interface PublicJury {
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entreprise: string | null;
}

interface JuryRow {
  id: number;
  edition_id: number;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entreprise: string | null;
  email: string | null;
  created_at: string | Date | null;
}

function mapRow(r: JuryRow): Jury {
  return {
    id: r.id,
    editionId: r.edition_id,
    nom: r.nom,
    prenom: r.prenom,
    fonction: r.fonction,
    entreprise: r.entreprise,
    email: r.email,
    createdAt: r.created_at instanceof Date ? r.created_at : r.created_at ? new Date(r.created_at) : null,
  };
}

/** Nom d'affichage d'un juré : « Prénom Nom » (ou juste le nom). */
export function juryLabel(j: { nom: string; prenom: string | null }): string {
  return [j.prenom, j.nom].filter(Boolean).join(" ");
}

/** Fonction + entreprise en une ligne (« Directrice technique · Acme »), ou "". */
export function juryRole(j: { fonction: string | null; entreprise: string | null }): string {
  return [j.fonction, j.entreprise].filter(Boolean).join(" · ");
}

/** Jury d'une édition (vue orga : e-mail inclus). Plus ancien d'abord. */
export async function getJuryByEdition(editionId: number): Promise<Jury[]> {
  const { rows } = await pool.query(
    `SELECT id, edition_id, nom, prenom, fonction, entreprise, email, created_at
       FROM tremplin_jury WHERE edition_id = $1 ORDER BY created_at, id`,
    [editionId],
  );
  return (rows as JuryRow[]).map(mapRow);
}

/**
 * Jury d'une édition pour l'affichage PUBLIC : nom, prénom, fonction, entreprise
 * seulement (e-mail JAMAIS exposé). C'est la SEULE requête à utiliser côté
 * public (le DTO n'a pas d'e-mail à filtrer côté rendu).
 */
export async function getPublicJuryByEdition(editionId: number): Promise<PublicJury[]> {
  const { rows } = await pool.query(
    `SELECT nom, prenom, fonction, entreprise
       FROM tremplin_jury WHERE edition_id = $1 ORDER BY created_at, id`,
    [editionId],
  );
  return rows as PublicJury[];
}

/** Ajoute un juré à une édition et renvoie son id. */
export async function addJury(editionId: number, j: JuryInput): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO tremplin_jury (edition_id, nom, prenom, fonction, entreprise, email)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [editionId, j.nom, j.prenom, j.fonction, j.entreprise, j.email],
  );
  return (rows[0] as { id: number }).id;
}

/** Retire un juré. Scopé à l'édition (`edition_id = $2`). Renvoie `false` si le
 * juré n'appartient pas à l'édition (0 ligne). */
export async function deleteJury(juryId: number, editionId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_jury WHERE id = $1 AND edition_id = $2`,
    [juryId, editionId],
  );
  return (rowCount ?? 0) > 0;
}
