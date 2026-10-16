import { pool, type Queryable } from "@/lib/db";
import { isUniqueViolation } from "@/lib/pg-errors";

export type PhotoKind = "podium" | "soiree" | "autre";

export interface TremplinPhoto {
  id: number;
  editionId: number;
  url: string;
  legende: string | null;
  kind: PhotoKind;
}

interface PhotoRow {
  id: number;
  edition_id: number;
  url: string;
  legende: string | null;
  kind: PhotoKind;
}

function mapRow(r: PhotoRow): TremplinPhoto {
  return { id: r.id, editionId: r.edition_id, url: r.url, legende: r.legende, kind: r.kind };
}

const COLS = `id, edition_id, url, legende, kind`;

/** Toutes les photos d'une édition (usage admin / interne). */
export async function getPhotosByEdition(editionId: number): Promise<TremplinPhoto[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_photos WHERE edition_id = $1 ORDER BY id`,
    [editionId],
  );
  return (rows as PhotoRow[]).map(mapRow);
}

export interface PhotoInput {
  url: string;
  legende: string | null;
  kind: PhotoKind;
}

/**
 * Tague des personnes sur une photo, DANS une transaction en cours (client).
 * Ne tague que des inscriptions de l'édition (filtrage en JS : portable pg-mem),
 * dédupliquées ; un id forgé d'une autre édition est ignoré.
 */
async function tagPhotoWithinTx(
  client: Queryable,
  photoId: number,
  editionId: number,
  registrationIds: number[],
): Promise<void> {
  if (registrationIds.length === 0) return;
  const regs = await client.query(
    `SELECT id FROM tremplin_registrations WHERE edition_id = $1`,
    [editionId],
  );
  const valid = new Set((regs.rows as { id: number }[]).map((r) => r.id));
  const toTag = [...new Set(registrationIds)].filter((id) => valid.has(id));
  for (const regId of toTag) {
    await client.query(
      `INSERT INTO tremplin_photo_personnes (photo_id, registration_id) VALUES ($1, $2)`,
      [photoId, regId],
    );
  }
}

/**
 * Ajoute une photo (URL http(s) validée en amont) ET tague les personnes
 * présentes, en UNE transaction : la photo n'est jamais visible sans son
 * inventaire (droit à l'image), évitant toute fenêtre où une photo de groupe
 * apparaîtrait publiquement sans consentement. Renvoie l'id de la photo.
 */
export async function addPhotoWithPersons(
  editionId: number,
  p: PhotoInput,
  registrationIds: number[],
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO tremplin_photos (edition_id, url, legende, kind)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [editionId, p.url, p.legende, p.kind],
    );
    const photoId = (rows[0] as { id: number }).id;
    await tagPhotoWithinTx(client, photoId, editionId, registrationIds);
    await client.query("COMMIT");
    return photoId;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Supprime une photo (et ses tags par cascade). Scopé à l'édition. */
export async function deletePhoto(photoId: number, editionId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_photos WHERE id = $1 AND edition_id = $2`,
    [photoId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Personnes taguées sur une photo (ids d'INSCRIPTION).
 *
 * Les tags ORPHELINS sont exclus en SQL : depuis la migration 021, un tag
 * survit au départ de la personne (`ON DELETE SET NULL`) pour que la photo ne
 * se republie pas toute seule, et `registration_id` y vaut NULL. Sans ce
 * filtre, le `null` traversait le cast et un tag orphelin se lisait comme
 * « personne non taguée » — l'exact contraire de l'invariant que la 021
 * protège. `getPhotoTags` reste la fonction à appeler pour VOIR les orphelins.
 */
export async function getPhotoPersons(photoId: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT registration_id FROM tremplin_photo_personnes
      WHERE photo_id = $1 AND registration_id IS NOT NULL`,
    [photoId],
  );
  return (rows as { registration_id: number }[]).map((r) => r.registration_id);
}

/**
 * Inventaire « qui est sur quelle photo » pour TOUTE une édition, en une seule
 * requête (groupé en JS) : évite le N+1 côté admin. photoId → ids d'inscription.
 */
export async function getPhotoPersonsByEdition(
  editionId: number,
): Promise<Map<number, number[]>> {
  const { rows } = await pool.query(
    `SELECT pp.photo_id, pp.registration_id
       FROM tremplin_photo_personnes pp
       JOIN tremplin_photos p ON p.id = pp.photo_id
      WHERE p.edition_id = $1 AND pp.registration_id IS NOT NULL`,
    [editionId],
  );
  const map = new Map<number, number[]>();
  for (const r of rows as { photo_id: number; registration_id: number }[]) {
    const arr = map.get(r.photo_id) ?? [];
    arr.push(r.registration_id);
    map.set(r.photo_id, arr);
  }
  return map;
}

/**
 * Remplace l'inventaire « qui est sur la photo » (droit à l'image). Scopé à
 * l'édition : la photo doit lui appartenir, et seules les inscriptions de CETTE
 * édition peuvent être taguées (un id forgé d'une autre édition est ignoré).
 * Atomique (transaction). Renvoie `false` si la photo n'est pas dans l'édition.
 */
export async function setPhotoPersons(
  photoId: number,
  editionId: number,
  registrationIds: number[],
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const photo = await client.query(
      `SELECT 1 FROM tremplin_photos WHERE id = $1 AND edition_id = $2`,
      [photoId, editionId],
    );
    if (photo.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    // Remplace les tags d'INSCRIPTION uniquement : les tags « compte » et
    // « nom libre » (avec leur consentement recueilli) ne sont pas touchés.
    await client.query(
      `DELETE FROM tremplin_photo_personnes WHERE photo_id = $1 AND registration_id IS NOT NULL`,
      [photoId],
    );
    await tagPhotoWithinTx(client, photoId, editionId, registrationIds);
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Photos **publiables** d'une édition (droit à l'image) : une photo n'est
 * publique que si **aucune** des personnes taguées dessus n'a `public = false`.
 * Donc : photos sans personne taguée (lieu/ambiance) OU dont toutes les
 * personnes consentent. L'inventaire (`tremplin_photo_personnes`) rend ce
 * contrôle — et le retrait ciblé — possibles.
 *
 * Implémentation en deux requêtes (jointures non corrélées) + filtrage en JS :
 * évite la sous-requête corrélée (plus portable, testable hors prod).
 */
export async function getPublicPhotos(editionId: number): Promise<TremplinPhoto[]> {
  const [all, blocked] = await Promise.all([
    getPhotosByEdition(editionId),
    // Un tag NON couvert bloque : inscription non publique, ou personne hors
    // inscription (compte, nom libre) sans « consentement recueilli ».
    pool.query(
      `SELECT DISTINCT pp.photo_id
         FROM tremplin_photo_personnes pp
         JOIN tremplin_photos p ON p.id = pp.photo_id
         LEFT JOIN tremplin_registrations r ON r.id = pp.registration_id
        WHERE p.edition_id = $1
          AND ((pp.registration_id IS NOT NULL AND r."public" = false)
            OR (pp.registration_id IS NULL AND pp.consentement = false))`,
      [editionId],
    ),
  ]);
  const blockedIds = new Set(
    (blocked.rows as { photo_id: number }[]).map((r) => r.photo_id),
  );
  return all.filter((p) => !blockedIds.has(p.id));
}

/* ─────────────── Tags « personne » (cf. docs/photos-tremplin.md) ───────────────
   Une personne sur une photo est une inscription de l'édition, un compte de
   la plateforme (jurée, coach…) ou un nom libre. Le consentement d'une
   inscription reste self-service (`registration.public`) ; pour les autres,
   l'orga atteste l'avoir recueilli, TAG par TAG. */

export interface PhotoTag {
  id: number;
  registrationId: number | null;
  userId: number | null;
  nomLibre: string | null;
  /** « Consentement recueilli » (tags hors inscription uniquement). */
  consentement: boolean;
  /** Nom affichable (admin) : participante, compte ou nom libre. */
  label: string;
  /** Vrai si ce tag n'empêche pas la publication de la photo. */
  couverte: boolean;
}

/**
 * Une photo est publiable quand TOUS ses tags sont couverts (règle unique,
 * partagée par le hub et la page photos pour éviter que la négation diverge).
 */
export function photoPubliable(tags: PhotoTag[]): boolean {
  return tags.every((t) => t.couverte);
}

interface TagRow {
  id: number;
  photo_id?: number;
  registration_id: number | null;
  user_id: number | null;
  nom_libre: string | null;
  consentement: boolean;
  label: string | null;
  reg_public: boolean | null;
}

const mapTag = (r: TagRow): PhotoTag => ({
  id: r.id,
  registrationId: r.registration_id,
  userId: r.user_id,
  nomLibre: r.nom_libre,
  consentement: r.consentement,
  label: r.label ?? `Personne n° ${r.id}`,
  couverte: r.registration_id !== null ? Boolean(r.reg_public) : r.consentement,
});

const TAG_SELECT = `
  SELECT pp.id, pp.photo_id, pp.registration_id, pp.user_id, pp.nom_libre, pp.consentement,
         COALESCE(r.participante_nom, ru.name, ru.email, u.name, u.email, pp.nom_libre) AS label,
         r."public" AS reg_public
    FROM tremplin_photo_personnes pp
    JOIN tremplin_photos p ON p.id = pp.photo_id
    LEFT JOIN tremplin_registrations r ON r.id = pp.registration_id
    LEFT JOIN users ru ON ru.id = r."userId"
    LEFT JOIN users u ON u.id = pp.user_id`;

/** Tags d'une photo (fiche photo), scopé à l'édition. */
export async function getPhotoTags(photoId: number, editionId: number): Promise<PhotoTag[]> {
  const { rows } = await pool.query(
    `${TAG_SELECT}
      WHERE pp.photo_id = $1 AND p.edition_id = $2
      ORDER BY label`,
    [photoId, editionId],
  );
  return (rows as TagRow[]).map(mapTag);
}

/** Tags de toutes les photos d'une édition (tableau de bord), en une requête. */
export async function getPhotoTagsByEdition(editionId: number): Promise<Map<number, PhotoTag[]>> {
  const { rows } = await pool.query(
    `${TAG_SELECT}
      WHERE p.edition_id = $1
      ORDER BY label`,
    [editionId],
  );
  const map = new Map<number, PhotoTag[]>();
  for (const r of rows as TagRow[]) {
    const arr = map.get(r.photo_id!) ?? [];
    arr.push(mapTag(r));
    map.set(r.photo_id!, arr);
  }
  return map;
}

export interface PhotoTagInput {
  registrationId?: number;
  userId?: number;
  nomLibre?: string;
  consentement: boolean;
}

/**
 * Tague une personne sur une photo (inscription, compte OU nom libre), scopé :
 * la photo doit appartenir à l'édition, une inscription doit en être.
 * Idempotent pour inscription/compte (déjà taguée = succès).
 */
export async function addPhotoTag(
  photoId: number,
  editionId: number,
  tag: PhotoTagInput,
): Promise<boolean> {
  const photo = await pool.query(
    `SELECT 1 FROM tremplin_photos WHERE id = $1 AND edition_id = $2`,
    [photoId, editionId],
  );
  if (photo.rows.length === 0) return false;
  if (tag.registrationId != null) {
    const r = await pool.query(
      `SELECT 1 FROM tremplin_registrations WHERE id = $1 AND edition_id = $2`,
      [tag.registrationId, editionId],
    );
    if (r.rows.length === 0) return false;
  }
  if (tag.userId != null) {
    const u = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [tag.userId]);
    if (u.rows.length === 0) return false;
  }
  if (tag.registrationId == null && tag.userId == null && !tag.nomLibre?.trim()) return false;
  try {
    await pool.query(
      `INSERT INTO tremplin_photo_personnes
         (photo_id, registration_id, user_id, nom_libre, consentement, consentement_le)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN now() END)`,
      [
        photoId,
        tag.registrationId ?? null,
        tag.userId ?? null,
        tag.nomLibre?.trim() || null,
        tag.consentement,
      ],
    );
    return true;
  } catch (e) {
    // Déjà taguée (index unique partiel) : succès idempotent.
    if (isUniqueViolation(e)) return true;
    throw e;
  }
}

/** Retire un tag, scopé à l'édition (via sa photo). */
export async function removePhotoTag(tagId: number, editionId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_photo_personnes
      WHERE id = $1
        AND photo_id IN (SELECT id FROM tremplin_photos WHERE edition_id = $2)`,
    [tagId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Pose « consentement recueilli » sur un tag HORS inscription (le consentement
 * d'une inscription se gère chez la participante, jamais ici). Scopé.
 */
export async function setPhotoTagConsent(
  tagId: number,
  editionId: number,
  consentement: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_photo_personnes
        SET consentement = $3, consentement_le = CASE WHEN $3 THEN now() END
      WHERE id = $1 AND registration_id IS NULL
        AND photo_id IN (SELECT id FROM tremplin_photos WHERE edition_id = $2)`,
    [tagId, editionId, consentement],
  );
  return (rowCount ?? 0) > 0;
}

/** Modifie légende et moment d'une photo (fiche photo). Scopé à l'édition. */
export async function updatePhoto(
  photoId: number,
  editionId: number,
  p: { legende: string | null; kind: PhotoKind },
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_photos SET legende = $3, kind = $4
      WHERE id = $1 AND edition_id = $2`,
    [photoId, editionId, p.legende, p.kind],
  );
  return (rowCount ?? 0) > 0;
}
