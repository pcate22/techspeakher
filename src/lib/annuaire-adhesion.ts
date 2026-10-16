import { pool } from "@/lib/db";
import {
  adhesionAJourSql,
  dansJours,
  estAJour,
  PREAVIS_ANNUAIRE_JOURS,
  RELANCE_AVANT_ECHEANCE_JOURS,
} from "@/lib/adhesion";

/**
 * L'annuaire réservé aux membres : qui prévenir, qui relancer, et le retour
 * arrière. Conception : docs/conception-adhesions-helloasso.md § 4. La mise en
 * pause elle-même vit dans `profiles.ts` (`mettreFichesEnPause`), avec les
 * autres sorties de « publié » et leur purge des bravos.
 *
 * Toute cette règle passe derrière `FLAG_ADHESIONS` : c'est l'appelant
 * (`passe-adhesions.ts`) qui choisit entre l'appliquer et `leverLesPauses`.
 *
 * Est **à jour à la date D** : une adhésion `active` dont l'échéance est après
 * D. Les orga ne sont jamais concernées par le préavis ni par la pause.
 */

/** Une adresse qu'on peut écrire : les comptes anonymisés portent `.invalid`. */
const JOIGNABLE = `u.email IS NOT NULL AND u.email NOT LIKE '%.invalid'`;

/**
 * Une fiche EN LIGNE dont la titulaire, joignable et hors orga, ne sera pas à
 * jour à la date `parametreDate` (`sp` fiche, `u` compte, `m` adhésion en
 * LEFT JOIN). Partagé par le préavis et l'invitation : qui reçoit se décide
 * à un seul endroit.
 */
const FICHE_EN_LIGNE_SANS_ADHESION = (parametreDate: string) =>
  `sp.status = 'publie'
        AND u.is_orga = false
        AND ${JOIGNABLE}
        AND NOT COALESCE(${adhesionAJourSql("m", parametreDate)}, false)`;

export interface FicheAPrevenir {
  profileId: number;
  email: string;
  name: string | null;
  /** L'échéance de l'adhésion qui arrive à son terme, ou null sans adhésion. */
  expiresAt: string | null;
  /** Un renouvellement s'ajoute-t-il à l'échéance en cours ? Vrai seulement
   *  pour une adhésion HelloAsso (la chaîne se calcule sur ses paiements). */
  cumul: boolean;
}

/**
 * Les fiches publiées dont la titulaire ne sera plus à jour dans
 * `PREAVIS_ANNUAIRE_JOURS`, et qui n'ont pas encore reçu de préavis. Au premier
 * allumage, ce sont toutes les fiches sans adhésion ; ensuite, le préavis tombe
 * de lui-même 30 jours avant chaque échéance.
 */
export async function fichesAPrevenir(maintenant: Date = new Date()): Promise<FicheAPrevenir[]> {
  const { rows } = await pool.query(
    `SELECT sp.id, u.email, u.name, m.expires_at, m.status AS adhesion, m.source
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
       LEFT JOIN user_memberships m ON m."userId" = u.id
      WHERE ${FICHE_EN_LIGNE_SANS_ADHESION("$1")}
        AND sp.annuaire_retrait_le IS NULL
      ORDER BY sp.id`,
    [dansJours(maintenant, PREAVIS_ANNUAIRE_JOURS)],
  );
  return (
    rows as {
      id: number;
      email: string;
      name: string | null;
      expires_at: Date | null;
      adhesion: string | null;
      source: string | null;
    }[]
  ).map((r) => ({
    profileId: r.id,
    email: r.email,
    name: r.name,
    // Seule une adhésion à jour a une échéance à annoncer.
    expiresAt:
      r.expires_at && r.adhesion && estAJour({ status: r.adhesion, expiresAt: r.expires_at }, maintenant)
        ? new Date(r.expires_at).toISOString()
        : null,
    cumul: r.source === "helloasso",
  }));
}

/** Pose la date annoncée — APRÈS l'envoi réussi du préavis, jamais avant :
 *  c'est elle qui autorise la pause. */
export async function marquerPreavis(profileId: number, retraitLe: Date): Promise<void> {
  await pool.query(`UPDATE speaker_profiles SET annuaire_retrait_le = $2 WHERE id = $1`, [
    profileId,
    retraitLe,
  ]);
}

export interface AdherenteARelancer {
  userId: number;
  email: string;
  name: string | null;
  expiresAt: string;
  /** Voir `FicheAPrevenir.cumul`. */
  cumul: boolean;
}

/**
 * Les adhérentes dont l'échéance tombe dans `RELANCE_AVANT_ECHEANCE_JOURS`,
 * pas encore relancées pour CETTE échéance. Une titulaire de fiche publiée
 * (hors orga) en est exclue : son préavis dit déjà l'échéance — un seul
 * e-mail par personne.
 */
export async function adherentesARelancer(
  maintenant: Date = new Date(),
): Promise<AdherenteARelancer[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, m.expires_at, m.source
       FROM user_memberships m
       JOIN users u ON u.id = m."userId"
      WHERE ${adhesionAJourSql("m", "$1")} AND m.expires_at <= $2
        AND m.relance_envoyee_le IS NULL
        AND ${JOIGNABLE}
        AND (u.is_orga = true OR u.id NOT IN (
              SELECT "userId" FROM speaker_profiles WHERE status = 'publie'))
      ORDER BY m.expires_at, u.id`,
    [maintenant, dansJours(maintenant, RELANCE_AVANT_ECHEANCE_JOURS)],
  );
  return (
    rows as { id: number; email: string; name: string | null; expires_at: Date; source: string }[]
  ).map((r) => ({
    userId: r.id,
    email: r.email,
    name: r.name,
    expiresAt: new Date(r.expires_at).toISOString(),
    cumul: r.source === "helloasso",
  }));
}

export async function marquerRelance(userId: number, maintenant: Date): Promise<void> {
  await pool.query(`UPDATE user_memberships SET relance_envoyee_le = $2 WHERE "userId" = $1`, [
    userId,
    maintenant,
  ]);
}

/**
 * Interrupteur éteint : les fiches en pause reviennent, et les préavis en
 * cours sont oubliés. Rallumer enverra de nouveaux préavis, avec une nouvelle
 * date : on ne met jamais en pause sur la foi d'un préavis d'avant l'arrêt.
 * Rend le nombre de fiches revenues.
 */
export async function leverLesPauses(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE speaker_profiles SET status = 'publie', annuaire_retrait_le = NULL
      WHERE status = 'en_pause'`,
  );
  await pool.query(
    `UPDATE speaker_profiles SET annuaire_retrait_le = NULL WHERE annuaire_retrait_le IS NOT NULL`,
  );
  return rowCount ?? 0;
}

/**
 * Plafond d'un clic d'invitation : la fonction serveur a un temps d'exécution
 * borné. Ici et pas dans le fichier d'actions : un fichier "use server"
 * n'exporte que des fonctions async (sinon le build casse, cf.
 * `use-server-exports.test.ts`).
 */
export const LOT_INVITATIONS = 40;

export interface FicheAInviter {
  profileId: number;
  email: string;
  name: string | null;
}

/**
 * Les titulaires d'une fiche EN LIGNE sans adhésion à jour, jamais invitées à
 * adhérer, et sans préavis en cours : l'invitation promet « un message avec la
 * date, au moins trente jours à l'avance » ; après un préavis, ce serait faux.
 * Les mêmes exclusions que le préavis (orga, adresse injoignable). Une adhésion
 * qui arrive à échéance reste à jour : c'est le préavis qui s'en charge.
 */
export async function fichesAInviterAAdherer(
  maintenant: Date = new Date(),
): Promise<FicheAInviter[]> {
  const { rows } = await pool.query(
    `SELECT sp.id, u.email, u.name
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
       LEFT JOIN user_memberships m ON m."userId" = u.id
      WHERE ${FICHE_EN_LIGNE_SANS_ADHESION("$1")}
        AND sp.adhesion_invitee_le IS NULL
        AND sp.annuaire_retrait_le IS NULL
      ORDER BY sp.id`,
    [maintenant],
  );
  return (rows as { id: number; email: string; name: string | null }[]).map((r) => ({
    profileId: r.id,
    email: r.email,
    name: r.name,
  }));
}

/**
 * RÉSERVE l'invitation d'une fiche, AVANT l'envoi, en une écriture atomique :
 * rend `false` si une autre exécution l'a déjà prise (deux orgas, deux
 * onglets). Sans elle, deux clics simultanés lisaient la même liste et
 * écrivaient deux fois aux mêmes personnes (revues du 2026-10-15).
 */
export async function reserverInvitationAdhesion(
  profileId: number,
  maintenant: Date,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE speaker_profiles SET adhesion_invitee_le = $2
      WHERE id = $1 AND adhesion_invitee_le IS NULL
        AND annuaire_retrait_le IS NULL`,
    [profileId, maintenant],
  );
  return (rowCount ?? 0) > 0;
}

/** Rend la réservation après un envoi raté : la fiche revient dans la liste. */
export async function libererInvitationAdhesion(profileId: number): Promise<void> {
  await pool.query(`UPDATE speaker_profiles SET adhesion_invitee_le = NULL WHERE id = $1`, [
    profileId,
  ]);
}

/** La date annoncée par un préavis en cours sur la fiche du compte, ou null. */
export async function dateRetraitAnnuaire(userId: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT annuaire_retrait_le FROM speaker_profiles
      WHERE "userId" = $1 AND status = 'publie' AND annuaire_retrait_le IS NOT NULL`,
    [userId],
  );
  const r = rows[0] as { annuaire_retrait_le: Date } | undefined;
  return r ? new Date(r.annuaire_retrait_le).toISOString() : null;
}

