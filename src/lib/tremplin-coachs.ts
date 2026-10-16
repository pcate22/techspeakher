import { pool, withTransaction } from "@/lib/db";
import {
  hhmm,
  synchroniserMiroirCoach,
  trierAteliersParDate,
  type PhaseAtelier,
} from "@/lib/tremplin-ateliers";
import type { AudienceAtelier } from "@/lib/atelier-audience";

/**
 * Coachs d'atelier : des COMPTES de la plateforme (pas forcément des
 * speakeuses publiées, pas forcément des femmes), reliés n-n aux ateliers et
 * invitables par e-mail comme les participantes. Le champ historique
 * `tremplin_ateliers.coachs` (texte libre) reste un affichage de secours.
 */

// Type historique défini ici, désormais logé avec le compte (users.ts) ;
// ré-exporté pour les nombreux imports existants.
export type { Genre } from "@/lib/users";
import type { Genre } from "@/lib/users";

/** Ce qu'il faut pour NOMMER un coach, et rien de plus : les coachs d'un
 * sous-groupe (`SousGroupe.coachs`) arrivent sous cette forme réduite, et doivent
 * s'afficher avec la même règle que ceux d'un atelier. */
export interface CoachIdentite {
  userId: number;
  nom: string | null;
  email: string | null;
}

export interface Coach extends CoachIdentite {
  genre: Genre | null;
}

/** Libellé d'affichage d'un coach (nom, sinon e-mail, sinon n° de compte).
 * SOURCE UNIQUE : chaque écran qui recopiait ce repli en produisait une variante,
 * donc deux libellés pour le même compte selon la page. */
export function coachLabel(c: CoachIdentite): string {
  return c.nom ?? c.email ?? `Compte n° ${c.userId}`;
}

interface CoachRow {
  atelier_id?: number;
  user_id: number;
  nom: string | null;
  email: string | null;
  genre: Genre | null;
}

const mapCoach = (r: CoachRow): Coach => ({
  userId: r.user_id,
  nom: r.nom,
  email: r.email,
  genre: r.genre,
});

export async function getCoachsByAtelier(atelierId: number): Promise<Coach[]> {
  const { rows } = await pool.query(
    `SELECT c.user_id, u.name AS nom, u.email, u.genre
       FROM tremplin_atelier_coachs c
       JOIN users u ON u.id = c.user_id
      WHERE c.atelier_id = $1
      ORDER BY u.name NULLS LAST, u.email`,
    [atelierId],
  );
  return (rows as CoachRow[]).map(mapCoach);
}

/**
 * PRÉCONDITION D'UNE FICHE COACH — la seule définition, les appelants y renvoient.
 *
 * Ce compte accompagne-t-il quelqu'un, ici ou ailleurs ? Un atelier
 * (`tremplin_atelier_coachs`) ou une participante en individuel
 * (`tremplin_registration_coachs`) : les deux font une coach, et la fiche vaut
 * pour toutes les éditions accompagnées. La question porte donc sur le COMPTE,
 * pas sur l'atelier par lequel on est arrivé.
 *
 * Pourquoi les Server Actions la posent : leur `userId` vient du formulaire,
 * donc du client. La page de la fiche vérifie déjà qu'on ouvre celle d'une
 * coach de l'atelier, mais un POST forgé la saute — sans cette garde, une orga
 * écrit un rôle et un lien PUBLICS sur le compte de n'importe quelle adhérente,
 * et y horodate un consentement jamais donné (RGPD art. 7 : l'accord doit être
 * démontrable).
 *
 * Elle garde ce qu'on ÉCRIT, jamais le retrait : révoquer un accord reste
 * possible même une fois le dernier rattachement défait (RGPD art. 7-3).
 *
 * Les sous-groupes sont couverts sans requête de plus : leurs coachs sont un
 * sous-ensemble de ceux de l'atelier, tenu par la FK composite (migration 052).
 */
export async function estCoachRattache(userId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM tremplin_atelier_coachs      WHERE user_id = $1
      UNION ALL
     SELECT 1 FROM tremplin_registration_coachs WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

/** Coachs de tous les ateliers d'une édition, en une requête (tableau de bord). */
export async function getCoachsByEdition(editionId: number): Promise<Map<number, Coach[]>> {
  const { rows } = await pool.query(
    `SELECT c.atelier_id, c.user_id, u.name AS nom, u.email, u.genre
       FROM tremplin_atelier_coachs c
       JOIN users u ON u.id = c.user_id
       JOIN tremplin_ateliers a ON a.id = c.atelier_id
      WHERE a.edition_id = $1
      ORDER BY u.name NULLS LAST, u.email`,
    [editionId],
  );
  const map = new Map<number, Coach[]>();
  for (const r of rows as CoachRow[]) {
    const list = map.get(r.atelier_id!) ?? [];
    list.push(mapCoach(r));
    map.set(r.atelier_id!, list);
  }
  return map;
}

/**
 * Relie un compte comme coach de l'atelier, SCOPÉ à l'édition (un id d'atelier
 * d'une autre édition ne matche pas). Idempotent (déjà coach = succès).
 */
export async function addCoachToAtelier(
  atelierId: number,
  editionId: number,
  userId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO tremplin_atelier_coachs (atelier_id, user_id)
     SELECT a.id, $3::int FROM tremplin_ateliers a
      WHERE a.id = $1 AND a.edition_id = $2
     ON CONFLICT (atelier_id, user_id) DO NOTHING`,
    [atelierId, editionId, userId],
  );
  if ((rowCount ?? 0) > 0) return true;
  // 0 ligne : soit déjà coach (succès idempotent), soit atelier hors édition.
  const { rows } = await pool.query(
    `SELECT 1 FROM tremplin_atelier_coachs c
       JOIN tremplin_ateliers a ON a.id = c.atelier_id
      WHERE c.atelier_id = $1 AND c.user_id = $3 AND a.edition_id = $2`,
    [atelierId, editionId, userId],
  );
  return rows.length > 0;
}

/**
 * Retire un coach de l'atelier, scopé à l'édition. ATOMIQUE.
 *
 * Ses sous-groupes suivent SANS code ici : l'invariant « coachs du sous-groupe ⊆
 * coachs de l'atelier » est une FK composite (migration 052), en `ON DELETE
 * CASCADE`. La base fait donc le nettoyage, et il ne peut pas se désynchroniser.
 *
 * Reste à recaler le MIROIR transitoire `coach_user_id`, que la cascade ne
 * connaît pas : il est recalculé depuis la table de liaison pour les sous-groupes
 * de cet atelier — un `UPDATE` corrélé, ce que le harnais pg-mem ne parse pas,
 * d'où le petit aller-retour de lecture puis une écriture par sous-groupe touché.
 */
export async function removeCoachFromAtelier(
  atelierId: number,
  editionId: number,
  userId: number,
): Promise<boolean> {
  return withTransaction(async (client) => {
    // Les sous-groupes de CET atelier où elle coachait — lus AVANT la cascade,
    // c'est-à-dire exactement ceux dont le miroir peut avoir bougé.
    const { rows: touches } = await client.query(
      `SELECT sous_groupe_id FROM tremplin_sous_groupe_coachs
        WHERE atelier_id = $1 AND user_id = $2`,
      [atelierId, userId],
    );

    const { rows: retiree } = await client.query(
      `DELETE FROM tremplin_atelier_coachs
        WHERE atelier_id = $1 AND user_id = $3
          AND atelier_id IN (SELECT id FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2)
        RETURNING user_id`,
      [atelierId, editionId, userId],
    );
    if (retiree.length === 0) return false;

    for (const { sous_groupe_id } of touches as { sous_groupe_id: number }[]) {
      await synchroniserMiroirCoach(client, sous_groupe_id);
    }
    return true;
  });
}

/** Coachs individuels d'une inscription (coaching de suivi d'une participante). */
export async function getCoachsByRegistration(registrationId: number): Promise<Coach[]> {
  const { rows } = await pool.query(
    `SELECT c.user_id, u.name AS nom, u.email, u.genre
       FROM tremplin_registration_coachs c
       JOIN users u ON u.id = c.user_id
      WHERE c.registration_id = $1
      ORDER BY u.name NULLS LAST, u.email`,
    [registrationId],
  );
  return (rows as CoachRow[]).map(mapCoach);
}

/** Assigne un coach individuel à une participante, scopé à l'édition. Idempotent. */
export async function addCoachToRegistration(
  registrationId: number,
  editionId: number,
  userId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO tremplin_registration_coachs (registration_id, user_id)
     SELECT r.id, $3::int FROM tremplin_registrations r
      WHERE r.id = $1 AND r.edition_id = $2
     ON CONFLICT (registration_id, user_id) DO NOTHING`,
    [registrationId, editionId, userId],
  );
  if ((rowCount ?? 0) > 0) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM tremplin_registration_coachs c
       JOIN tremplin_registrations r ON r.id = c.registration_id
      WHERE c.registration_id = $1 AND c.user_id = $3 AND r.edition_id = $2`,
    [registrationId, editionId, userId],
  );
  return rows.length > 0;
}

/** Retire le coach individuel d'une participante, scopé à l'édition. */
export async function removeCoachFromRegistration(
  registrationId: number,
  editionId: number,
  userId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_registration_coachs
      WHERE registration_id = $1 AND user_id = $3
        AND registration_id IN (
          SELECT id FROM tremplin_registrations WHERE id = $1 AND edition_id = $2)`,
    [registrationId, editionId, userId],
  );
  return (rowCount ?? 0) > 0;
}

const GENRES: readonly Genre[] = ["femme", "homme", "non_binaire"];

export function isGenre(v: string): v is Genre {
  return (GENRES as readonly string[]).includes(v);
}

/** Genre déclaratif d'un compte (obligatoire pour les coachs). */
export async function setUserGenre(userId: number, genre: Genre | null): Promise<void> {
  await pool.query(`UPDATE users SET genre = $2 WHERE id = $1`, [userId, genre]);
}

/** Complète le genre d'un compte qui n'en a pas — un genre déjà déclaré
 * appartient à la personne et n'est JAMAIS écrasé (sélecteur de coachs). */
export async function setUserGenreIfUnset(userId: number, genre: Genre): Promise<void> {
  await pool.query(`UPDATE users SET genre = $2 WHERE id = $1 AND genre IS NULL`, [
    userId,
    genre,
  ]);
}

/**
 * Pose le profil « animateur / coach » sur le compte (cumulable avec orga et
 * speakeuse : de simples marqueurs de rôle, pas des comptes séparés).
 */
export async function markUserAsCoach(userId: number): Promise<void> {
  await pool.query(`UPDATE users SET is_coach = true WHERE id = $1`, [userId]);
}

/* ────────────────────────── Espace coach ──────────────────────────
   Tout est scopé EN SQL par la liaison coach ↔ cible : un id forgé côté
   client ne peut ni lire ni écrire hors du périmètre du coach connecté. */

export interface CoachEdition {
  editionId: number;
  nom: string;
  annee: number;
  nbAteliers: number;
  nbCoachees: number;
}

/** Éditions où le compte intervient (≥ 1 atelier animé OU ≥ 1 coachée). */
export async function getCoachEditions(userId: number): Promise<CoachEdition[]> {
  // Trois requêtes simples plutôt qu'un GROUP BY/HAVING : lisible, testable
  // dans pg-mem, et la table des éditions est minuscule (1-2 par an).
  const [ateliers, coachees, editions] = await Promise.all([
    pool.query(
      `SELECT a.edition_id, count(*) AS n
         FROM tremplin_atelier_coachs ac
         JOIN tremplin_ateliers a ON a.id = ac.atelier_id
        WHERE ac.user_id = $1
        GROUP BY a.edition_id`,
      [userId],
    ),
    pool.query(
      `SELECT r.edition_id, count(*) AS n
         FROM tremplin_registration_coachs rc
         JOIN tremplin_registrations r ON r.id = rc.registration_id
        WHERE rc.user_id = $1
        GROUP BY r.edition_id`,
      [userId],
    ),
    pool.query(`SELECT id, nom, annee FROM tremplin_editions ORDER BY annee DESC, id DESC`),
  ]);
  const nbAteliers = new Map(
    (ateliers.rows as { edition_id: number; n: string | number }[]).map((r) => [
      r.edition_id,
      Number(r.n),
    ]),
  );
  const nbCoachees = new Map(
    (coachees.rows as { edition_id: number; n: string | number }[]).map((r) => [
      r.edition_id,
      Number(r.n),
    ]),
  );
  return (editions.rows as { id: number; nom: string; annee: number }[])
    .filter((e) => nbAteliers.has(e.id) || nbCoachees.has(e.id))
    .map((e) => ({
      editionId: e.id,
      nom: e.nom,
      annee: e.annee,
      nbAteliers: nbAteliers.get(e.id) ?? 0,
      nbCoachees: nbCoachees.get(e.id) ?? 0,
    }));
}

export interface CoachAtelier {
  id: number;
  titre: string;
  date: string | null;
  /** Fin de période (activité « à faire entre deux dates »), sinon null. */
  dateFin: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  /** Lieu physique (présentiel), sinon null. */
  lieu: string | null;
  lienVisio: string | null;
  /** QUI voit l'atelier (cf. `src/lib/atelier-audience.ts`). */
  audience: AudienceAtelier;
  /** Phase de l'atelier : l'audience « phase » la nomme. */
  phase: PhaseAtelier;
}

/** LES ateliers que le compte anime dans cette édition, en CHRONOLOGIE (son
 * agenda — tri partagé `trierAteliersParDate`, « à dater » en fin). Horaires
 * normalisés HH:MM au bord (`hhmm`, principes §7 — l'espace coach affichait
 * « 18:30:00 »). Alias camelCase en SQL : une colonne ajoutée = une ligne. */
export async function getCoachAteliers(
  userId: number,
  editionId: number,
): Promise<CoachAtelier[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.titre, a.date, a.ordre, a.date_fin AS "dateFin",
            a.heure_debut AS "heureDebut", a.heure_fin AS "heureFin",
            a.lieu, a.lien_visio AS "lienVisio", a.audience, a.phase
       FROM tremplin_ateliers a
       JOIN tremplin_atelier_coachs ac ON ac.atelier_id = a.id
      WHERE ac.user_id = $1 AND a.edition_id = $2`,
    [userId, editionId],
  );
  return trierAteliersParDate(rows as (CoachAtelier & { ordre: number })[]).map(
    ({ ordre: _ordre, ...r }) => ({
      ...r,
      heureDebut: hhmm(r.heureDebut),
      heureFin: hhmm(r.heureFin),
    }),
  );
}

/** Coachée vue par SON coach : DTO minimal, l'e-mail n'est JAMAIS exposé. */
export interface CoachCoachee {
  registrationId: number;
  nom: string;
  sujet: string | null;
}

export async function getCoachCoachees(
  userId: number,
  editionId: number,
): Promise<CoachCoachee[]> {
  const { rows } = await pool.query(
    `SELECT r.id, r.participante_nom, u.name AS user_name, st.titre AS sujet
       FROM tremplin_registrations r
       JOIN tremplin_registration_coachs rc ON rc.registration_id = r.id
       LEFT JOIN users u ON u.id = r."userId"
       LEFT JOIN speaker_talks st ON st.id = r.talk_id
      WHERE rc.user_id = $1 AND r.edition_id = $2
      ORDER BY r.participante_nom NULLS LAST, r.id`,
    [userId, editionId],
  );
  return (rows as {
    id: number; participante_nom: string | null; user_name: string | null; sujet: string | null;
  }[]).map((r) => ({
    registrationId: r.id,
    // Pas de repli e-mail (donnée de gestion orga) : nom, sinon n° neutre.
    nom: r.participante_nom ?? r.user_name ?? `Participante n° ${r.id}`,
    sujet: r.sujet,
  }));
}

export interface CoachDocument {
  id: number;
  titre: string;
  lien: string | null;
  contenu: string | null;
  /** Cible du document (atelier animé ou coachée suivie). */
  atelierId: number | null;
  registrationId: number | null;
  /** Le coach connecté en est-il l'auteur ? (droit de suppression) */
  estAuteur: boolean;
}

/** Documents des ateliers animés + des coachées suivies, en une requête. */
export async function getCoachDocuments(
  userId: number,
  editionId: number,
): Promise<CoachDocument[]> {
  const { rows } = await pool.query(
    `SELECT d.id, d.titre, d.lien, d.contenu, d.atelier_id, d.registration_id,
            (d.auteur_id = $1) AS est_auteur
       FROM tremplin_documents d
      WHERE d.edition_id = $2
        AND (
          d.atelier_id IN (
            SELECT ac.atelier_id FROM tremplin_atelier_coachs ac
             JOIN tremplin_ateliers a ON a.id = ac.atelier_id
            WHERE ac.user_id = $1 AND a.edition_id = $2)
          OR d.registration_id IN (
            SELECT rc.registration_id FROM tremplin_registration_coachs rc
             JOIN tremplin_registrations r ON r.id = rc.registration_id
            WHERE rc.user_id = $1 AND r.edition_id = $2)
        )
      ORDER BY d.id`,
    [userId, editionId],
  );
  return (rows as {
    id: number; titre: string; lien: string | null; contenu: string | null;
    atelier_id: number | null; registration_id: number | null; est_auteur: boolean | null;
  }[]).map((r) => ({
    id: r.id,
    titre: r.titre,
    lien: r.lien,
    contenu: r.contenu,
    atelierId: r.atelier_id,
    registrationId: r.registration_id,
    estAuteur: r.est_auteur === true,
  }));
}

export interface CoachDocumentInput {
  type: string;
  titre: string;
  lien: string | null;
  contenu: string | null;
  atelierId: number | null;
  registrationId: number | null;
}

/**
 * Dépôt par un coach : l'INSERT n'aboutit QUE si la cible (atelier ou
 * coachée) lui est liée dans cette édition — garde dans la requête même.
 */
export async function addDocumentAsCoach(
  userId: number,
  editionId: number,
  d: CoachDocumentInput,
): Promise<boolean> {
  if (d.atelierId !== null) {
    const { rowCount } = await pool.query(
      `INSERT INTO tremplin_documents
         (edition_id, atelier_id, registration_id, auteur_id, type, titre, lien, contenu)
       SELECT a.edition_id, a.id, NULL, $1::int, $4, $5, $6, $7
         FROM tremplin_ateliers a
         JOIN tremplin_atelier_coachs ac ON ac.atelier_id = a.id AND ac.user_id = $1
        WHERE a.id = $3 AND a.edition_id = $2`,
      [userId, editionId, d.atelierId, d.type, d.titre, d.lien, d.contenu],
    );
    return (rowCount ?? 0) > 0;
  }
  if (d.registrationId !== null) {
    const { rowCount } = await pool.query(
      `INSERT INTO tremplin_documents
         (edition_id, atelier_id, registration_id, auteur_id, type, titre, lien, contenu)
       SELECT r.edition_id, NULL, r.id, $1::int, $4, $5, $6, $7
         FROM tremplin_registrations r
         JOIN tremplin_registration_coachs rc ON rc.registration_id = r.id AND rc.user_id = $1
        WHERE r.id = $3 AND r.edition_id = $2`,
      [userId, editionId, d.registrationId, d.type, d.titre, d.lien, d.contenu],
    );
    return (rowCount ?? 0) > 0;
  }
  return false; // pas de dépôt « général » pour un coach
}

/** Suppression par un coach : SES dépôts uniquement (auteur), scopé édition. */
export async function deleteOwnDocument(
  userId: number,
  documentId: number,
  editionId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_documents
      WHERE id = $2 AND edition_id = $3 AND auteur_id = $1`,
    [userId, documentId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/** Participantes de SES ateliers restreints (libellés sans e-mail), par atelier. */
export async function getCoachAtelierMembres(
  userId: number,
  editionId: number,
): Promise<Map<number, string[]>> {
  const { rows } = await pool.query(
    `SELECT m.atelier_id, r.id, r.participante_nom, u.name AS user_name
       FROM tremplin_atelier_membres m
       JOIN tremplin_registrations r ON r.id = m.registration_id
       LEFT JOIN users u ON u.id = r."userId"
      WHERE m.atelier_id IN (
        SELECT ac.atelier_id FROM tremplin_atelier_coachs ac
         JOIN tremplin_ateliers a ON a.id = ac.atelier_id
        WHERE ac.user_id = $1 AND a.edition_id = $2)
      ORDER BY r.participante_nom NULLS LAST, r.id`,
    [userId, editionId],
  );
  const map = new Map<number, string[]>();
  for (const r of rows as {
    atelier_id: number; id: number; participante_nom: string | null; user_name: string | null;
  }[]) {
    const list = map.get(r.atelier_id) ?? [];
    list.push(r.participante_nom ?? r.user_name ?? `Participante n° ${r.id}`);
    map.set(r.atelier_id, list);
  }
  return map;
}
