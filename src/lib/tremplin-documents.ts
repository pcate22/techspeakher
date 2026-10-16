import { pool } from "@/lib/db";

export type DocumentType =
  | "support_atelier"
  | "feedback_jury"
  | "video_pitch"
  | "note"
  | "autre";

export interface TremplinDocument {
  id: number;
  editionId: number;
  atelierId: number | null;
  registrationId: number | null;
  auteurId: number | null;
  type: DocumentType;
  titre: string;
  lien: string | null;
  contenu: string | null;
}

export interface DocumentInput {
  atelierId: number | null;
  registrationId: number | null;
  auteurId: number | null;
  type: DocumentType;
  titre: string;
  lien: string | null;
  contenu: string | null;
}

interface DocumentRow {
  id: number;
  edition_id: number;
  atelier_id: number | null;
  registration_id: number | null;
  auteur_id: number | null;
  type: DocumentType;
  titre: string;
  lien: string | null;
  contenu: string | null;
}

function mapRow(r: DocumentRow): TremplinDocument {
  return {
    id: r.id,
    editionId: r.edition_id,
    atelierId: r.atelier_id,
    registrationId: r.registration_id,
    auteurId: r.auteur_id,
    type: r.type,
    titre: r.titre,
    lien: r.lien,
    contenu: r.contenu,
  };
}

const COLS = `id, edition_id, atelier_id, registration_id, auteur_id,
              type, titre, lien, contenu`;

/**
 * Documents PARTAGÉS d'une édition : supports d'atelier + ressources générales
 * (toute ligne sans `registration_id`). Vus par toutes les participantes.
 */
export async function getSharedDocuments(
  editionId: number,
): Promise<TremplinDocument[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_documents
      WHERE edition_id = $1 AND registration_id IS NULL
      ORDER BY atelier_id NULLS LAST, id`,
    [editionId],
  );
  return (rows as DocumentRow[]).map(mapRow);
}

/**
 * Documents partagés d'une édition VISIBLES PAR la personne connectée : les
 * ressources générales, plus les supports des seuls ateliers qu'elle voit.
 *
 * CINQUIÈME formulation de la règle d'audience — avec `atelierVisiblePour` (TS),
 * `getCohorteAtelier`, `getTaillesCohortesByEdition` et l'UNION de
 * `getMesProchainsAteliers` (`mes-ateliers.ts`) — et celle qui avait décroché :
 * elle lisait encore le miroir booléen `ouvert_a_toutes`, hérité d'avant
 * l'audience à trois choix. L'audience `phase` n'y existait donc pas —
 * les supports du coaching de la phase 3 disparaissaient de l'onglet
 * « Documents » pour les inscrites qui les voyaient pourtant dans l'espace de
 * l'édition. La sélection nominative, elle, sur-ouvrait : l'appartenance était
 * lue quelle que soit l'audience, alors que `tremplin_atelier_membres` est le
 * registre des PRÉSENCES — un pointage suffisait à ouvrir un support.
 *
 * La DISJONCTION d'audience est celle de `getCohorteAtelier`, verbatim, avec ses
 * deux `LEFT JOIN` — qui font partie de la règle : `m` et `rp` ne veulent rien
 * dire sans elles. Le reste diffère forcément (on part des documents, et on
 * filtre sur la personne connectée). Un test d'intégration confronte cette
 * fonction au prédicat sur les trois audiences.
 *
 * UNE divergence assumée avec le prédicat : `atelierVisiblePour` ouvre tout à
 * une orga, cette requête non — une orga voit donc tous les supports dans
 * l'espace de l'édition, et seulement ceux de sa cohorte dans « Documents ».
 * C'est le sens SÛR ; à garder tel quel plutôt que d'ajouter un contournement
 * orga, qui rendrait cette requête plus permissive que ce que son nom promet.
 */
export async function getSharedDocumentsVisiblesPour(
  userId: number,
  editionId: number,
): Promise<TremplinDocument[]> {
  const { rows } = await pool.query(
    // Les ateliers visibles passent par une sous-requête NON corrélée : la
    // condition de phase dépend de l'atelier (`rp.phase = a.phase`), et une
    // corrélation dans un `IN` n'est pas parsée par le harnais pg-mem des
    // tests. Elle tient aussi le nombre de lignes du dehors : la jointure
    // d'inscription y multiplierait chaque document.
    `SELECT ${COLS} FROM tremplin_documents
      WHERE edition_id = $1 AND registration_id IS NULL
        -- Les ressources GÉNÉRALES (sans atelier) demandent quand même une
        -- inscription : le prédicat commence par « pas d'inscription, rien ».
        -- L'appelant boucle déjà sur les éditions de la personne, mais une
        -- fonction qui s'appelle « VisiblesPour » doit tenir seule — sinon le
        -- prochain appelant hérite du trou.
        AND EXISTS (SELECT 1 FROM tremplin_registrations r0
                     WHERE r0.edition_id = $1 AND r0."userId" = $2)
        AND (atelier_id IS NULL
             OR atelier_id IN (
                  SELECT a.id
                    FROM tremplin_ateliers a
                    JOIN tremplin_registrations r
                      ON r.edition_id = a.edition_id AND r."userId" = $2
                    LEFT JOIN tremplin_atelier_membres m
                      ON m.atelier_id = a.id AND m.registration_id = r.id
                    LEFT JOIN tremplin_registration_phases rp
                      ON rp.registration_id = r.id AND rp.phase = a.phase
                   WHERE a.edition_id = $1
                     AND (
                       a.audience = 'toutes'
                       OR (a.audience = 'selection' AND m.registration_id IS NOT NULL)
                       OR (a.audience = 'phase' AND rp.registration_id IS NOT NULL)
                     )))
      ORDER BY atelier_id NULLS LAST, id`,
    [editionId, userId],
  );
  return (rows as DocumentRow[]).map(mapRow);
}

/**
 * TOUS les documents d'une édition (vue orga admin) : généraux, d'atelier et
 * individuels. Côté participante on n'utilise jamais ceci (cf. getSharedDocuments
 * + getMyDocuments qui filtrent), mais l'orga doit voir ce qu'elle a déposé.
 */
export async function getDocumentsByEdition(
  editionId: number,
): Promise<TremplinDocument[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_documents
      WHERE edition_id = $1
      ORDER BY atelier_id NULLS LAST, registration_id NULLS LAST, id`,
    [editionId],
  );
  return (rows as DocumentRow[]).map(mapRow);
}

/**
 * COMBIEN de supports porte un atelier. La fiche atelier n'en affiche que le
 * nombre : charger tous les documents de l'édition (leur `contenu` compris, y
 * compris les lignes rattachées à une inscription — retours jury, notes
 * privées) pour en filtrer un compte était disproportionné.
 */
export async function countDocumentsByAtelier(atelierId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM tremplin_documents WHERE atelier_id = $1`,
    [atelierId],
  );
  return Number((rows[0] as { n: string } | undefined)?.n ?? 0);
}

/** COMBIEN de supports par atelier, pour TOUTE une édition (anti N+1 : la liste
 * des ateliers en affiche le compte ligne à ligne). */
export async function countDocumentsByEdition(
  editionId: number,
): Promise<Map<number, number>> {
  const { rows } = await pool.query(
    `SELECT atelier_id, COUNT(*) AS n FROM tremplin_documents
      WHERE edition_id = $1 AND atelier_id IS NOT NULL
      GROUP BY atelier_id`,
    [editionId],
  );
  return new Map(
    (rows as { atelier_id: number; n: string }[]).map((r) => [r.atelier_id, Number(r.n)]),
  );
}

/**
 * Documents INDIVIDUELS de la participante connectée pour une édition
 * (retour jury, vidéo, ses notes). On joint l'inscription par `"userId"` :
 * impossible de récupérer les documents privés d'une autre personne.
 */
export async function getMyDocuments(
  userId: number,
  editionId: number,
): Promise<TremplinDocument[]> {
  const { rows } = await pool.query(
    `SELECT d.id, d.edition_id, d.atelier_id, d.registration_id, d.auteur_id,
            d.type, d.titre, d.lien, d.contenu
       FROM tremplin_documents d
       JOIN tremplin_registrations r ON r.id = d.registration_id
      WHERE d.edition_id = $1 AND r."userId" = $2
      ORDER BY d.id`,
    [editionId, userId],
  );
  return (rows as DocumentRow[]).map(mapRow);
}

/**
 * Ajoute un document et renvoie son id.
 *
 * Garde-fou d'intégrité : si le document est rattaché à un atelier ou à une
 * inscription, cette référence doit appartenir à `editionId`. Les ids viennent
 * d'un formulaire orga (non fiable) ; sans ce contrôle, un retour jury privé
 * pourrait être inséré en pointant une inscription d'une autre édition et
 * fuiter dans le mauvais espace. On lève plutôt que d'écrire un doc mal routé.
 */
export async function addDocument(
  editionId: number,
  d: DocumentInput,
): Promise<number> {
  if (d.atelierId !== null) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [d.atelierId, editionId],
    );
    if (!rowCount) throw new Error("Atelier hors de cette édition");
  }
  if (d.registrationId !== null) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM tremplin_registrations WHERE id = $1 AND edition_id = $2`,
      [d.registrationId, editionId],
    );
    if (!rowCount) throw new Error("Inscription hors de cette édition");
  }
  const { rows } = await pool.query(
    `INSERT INTO tremplin_documents
       (edition_id, atelier_id, registration_id, auteur_id, type, titre, lien, contenu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      editionId,
      d.atelierId,
      d.registrationId,
      d.auteurId,
      d.type,
      d.titre,
      d.lien,
      d.contenu,
    ],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Supprime un document (correction d'une faute, retour collé chez la mauvaise
 * personne, doublon de saisie à la chaîne). Scopé à l'édition : un id forgé ne
 * touche jamais un document d'une autre édition. Renvoie `false` si 0 ligne.
 */
export async function deleteDocument(
  documentId: number,
  editionId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_documents WHERE id = $1 AND edition_id = $2`,
    [documentId, editionId],
  );
  return (rowCount ?? 0) > 0;
}
