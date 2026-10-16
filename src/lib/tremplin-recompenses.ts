import { pool } from "@/lib/db";

/**
 * Récompenses d'une édition du Tremplin (présentation au DevFest, talk en
 * meetup, coaching CFP…). Distinctes du PODIUM (mérite de la soirée, immuable,
 * sur l'inscription) : une récompense s'attribue LIBREMENT à une participante
 * de l'édition — le `motif` trace pourquoi quand elle est transmise (ex. 1ʳᵉ
 * déjà retenue via le CFP) — et se suit dans le temps (statut + date de
 * l'événement organisé).
 */

export type RecompenseStatut = "a_organiser" | "planifiee" | "realisee";

/** Libellés du suivi, accordés à LA RÉCOMPENSE (le sujet affiché dans les
 * listes : « Un talk en meetup · pour Camille · Planifiée »). */
export const RECOMPENSE_STATUT_LABEL: Record<RecompenseStatut, string> = {
  a_organiser: "À organiser",
  planifiee: "Planifiée",
  realisee: "Réalisée",
};

export function isRecompenseStatut(v: unknown): v is RecompenseStatut {
  return v === "a_organiser" || v === "planifiee" || v === "realisee";
}

/** Raison PUBLIQUE et énumérée d'un transfert (sans nom, pas de donnée perso) :
 * une récompense de rang attribuée à une autre que la lauréate de ce rang. */
export type RecompenseTransfertRaison = "cfp_officiel" | "autre";

export function isRecompenseTransfertRaison(v: unknown): v is RecompenseTransfertRaison {
  return v === "cfp_officiel" || v === "autre";
}

/** Libellé du sélecteur (fiche récompense). */
export const RECOMPENSE_TRANSFERT_RAISON_LABEL: Record<RecompenseTransfertRaison, string> = {
  cfp_officiel: "Retenue via le CFP officiel de l'événement",
  autre: "Autre raison",
};

/** Complément inséré dans la phrase publique du transfert, ou null (« autre » :
 * pas de précision affichée). Ex. « …, retenue via le CFP officiel de l'événement ». */
export const RECOMPENSE_TRANSFERT_RAISON_CLAUSE: Record<RecompenseTransfertRaison, string | null> = {
  cfp_officiel: "retenue via le CFP officiel de l'événement",
  autre: null,
};

export interface Recompense {
  id: number;
  editionId: number;
  intitule: string;
  detail: string | null;
  /** Lot du podium (1, 2, 3…) ou null (meetup, coaching CFP…). */
  rang: number | null;
  beneficiaireRegistrationId: number | null;
  /** Nom d'affichage de la bénéficiaire (admin uniquement). */
  beneficiaireNom: string | null;
  /** Note orga INTERNE (jamais publiée). */
  motif: string | null;
  /** Raison PUBLIQUE d'un transfert (énumérée), ou null si pas de transfert. */
  transfertRaison: RecompenseTransfertRaison | null;
  statut: RecompenseStatut;
  /** DATE : chaîne AAAA-MM-JJ en prod (type parser de db.ts). */
  evenementLe: string | null;
  attribueeLe: Date | null;
}

interface RecompenseRow {
  id: number;
  edition_id: number;
  intitule: string;
  detail: string | null;
  rang: number | null;
  beneficiaire_registration_id: number | null;
  beneficiaire_nom: string | null;
  motif: string | null;
  transfert_raison: RecompenseTransfertRaison | null;
  statut: RecompenseStatut;
  evenement_le: string | null;
  attribuee_le: Date | null;
}

const mapRecompense = (r: RecompenseRow): Recompense => ({
  id: r.id,
  editionId: r.edition_id,
  intitule: r.intitule,
  detail: r.detail,
  rang: r.rang,
  beneficiaireRegistrationId: r.beneficiaire_registration_id,
  beneficiaireNom: r.beneficiaire_nom,
  motif: r.motif,
  transfertRaison: r.transfert_raison,
  statut: r.statut,
  evenementLe: r.evenement_le,
  attribueeLe: r.attribuee_le,
});

/** Récompenses d'une édition : les lots du podium d'abord, puis les sans-rang. */
export async function getRecompensesByEdition(editionId: number): Promise<Recompense[]> {
  const { rows } = await pool.query(
    `SELECT rec.id, rec.edition_id, rec.intitule, rec.detail, rec.rang,
            rec.beneficiaire_registration_id, rec.motif, rec.transfert_raison, rec.statut,
            rec.evenement_le, rec.attribuee_le,
            COALESCE(r.participante_nom, u.name, u.email) AS beneficiaire_nom
       FROM tremplin_recompenses rec
       LEFT JOIN tremplin_registrations r ON r.id = rec.beneficiaire_registration_id
       LEFT JOIN users u ON u.id = r."userId"
      WHERE rec.edition_id = $1
      ORDER BY COALESCE(rec.rang, 1000000), rec.id`,
    [editionId],
  );
  return (rows as RecompenseRow[]).map(mapRecompense);
}

/** Ce dont bénéficie UNE participante (fiche admin ; jamais celles des autres). */
export async function getRecompensesByRegistration(
  registrationId: number,
): Promise<Recompense[]> {
  const { rows } = await pool.query(
    `SELECT rec.id, rec.edition_id, rec.intitule, rec.detail, rec.rang,
            rec.beneficiaire_registration_id, rec.motif, rec.transfert_raison, rec.statut,
            rec.evenement_le, rec.attribuee_le,
            NULL AS beneficiaire_nom
       FROM tremplin_recompenses rec
      WHERE rec.beneficiaire_registration_id = $1
      ORDER BY COALESCE(rec.rang, 1000000), rec.id`,
    [registrationId],
  );
  return (rows as RecompenseRow[]).map(mapRecompense);
}

export interface RecompenseInput {
  intitule: string;
  detail: string | null;
  rang: number | null;
}

/** Crée une récompense (l'attribution est un geste séparé). Renvoie son id. */
export async function addRecompense(
  editionId: number,
  input: RecompenseInput,
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO tremplin_recompenses (edition_id, intitule, detail, rang)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [editionId, input.intitule, input.detail, input.rang],
  );
  return (rows[0] as { id: number }).id;
}

/** Met à jour intitulé / détail / rang, scopé à l'édition. */
export async function updateRecompense(
  recompenseId: number,
  editionId: number,
  input: RecompenseInput,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_recompenses
        SET intitule = $3, detail = $4, rang = $5
      WHERE id = $1 AND edition_id = $2`,
    [recompenseId, editionId, input.intitule, input.detail, input.rang],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Attribue la récompense à une participante DE LA MÊME ÉDITION (une
 * inscription d'une autre édition ne matche pas), avec motif interne facultatif,
 * raison PUBLIQUE de transfert facultative (énumérée) et horodatage.
 * `registrationId = null` retire l'attribution (motif, raison et horodatage
 * repartent à zéro).
 */
export async function setRecompenseBeneficiaire(
  recompenseId: number,
  editionId: number,
  registrationId: number | null,
  motif: string | null,
  transfertRaison: RecompenseTransfertRaison | null = null,
): Promise<boolean> {
  if (registrationId === null) {
    const { rowCount } = await pool.query(
      `UPDATE tremplin_recompenses
          SET beneficiaire_registration_id = NULL, motif = NULL,
              transfert_raison = NULL, attribuee_le = NULL
        WHERE id = $1 AND edition_id = $2`,
      [recompenseId, editionId],
    );
    return (rowCount ?? 0) > 0;
  }
  const { rowCount } = await pool.query(
    `UPDATE tremplin_recompenses
        SET beneficiaire_registration_id = $3, motif = $4,
            transfert_raison = $5, attribuee_le = now()
      WHERE id = $1 AND edition_id = $2
        AND EXISTS (SELECT 1 FROM tremplin_registrations r
                     WHERE r.id = $3 AND r.edition_id = $2)`,
    [recompenseId, editionId, registrationId, motif, transfertRaison],
  );
  return (rowCount ?? 0) > 0;
}

/** Suivi de l'organisation : statut (à organiser / planifiée / réalisée) + date. */
export async function setRecompenseSuivi(
  recompenseId: number,
  editionId: number,
  statut: RecompenseStatut,
  evenementLe: string | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_recompenses
        SET statut = $3, evenement_le = $4
      WHERE id = $1 AND edition_id = $2`,
    [recompenseId, editionId, statut, evenementLe],
  );
  return (rowCount ?? 0) > 0;
}

/** Supprime une récompense, scopé à l'édition. */
export async function deleteRecompense(
  recompenseId: number,
  editionId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_recompenses WHERE id = $1 AND edition_id = $2`,
    [recompenseId, editionId],
  );
  return (rowCount ?? 0) > 0;
}
