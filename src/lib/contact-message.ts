import { pool } from "@/lib/db";
import { isContactMotif } from "@/data/contact-motifs";
import { isValidEmail } from "@/lib/profile-form";

export type ContactMessageResult =
  | {
      ok: true;
      data: { motif: string; nom: string; email: string; message: string };
    }
  | { ok: false; errors: Record<string, string> };

/** Valide un message de contact (entrées non fiables). Motif obligatoire. */
export function parseContactMessage(formData: FormData): ContactMessageResult {
  const motif = (formData.get("motif") ?? "").toString().trim();
  const nom = (formData.get("nom") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim();
  const message = (formData.get("message") ?? "").toString().trim();

  const errors: Record<string, string> = {};
  if (!isContactMotif(motif)) errors.motif = "Choisis un motif de contact.";
  if (!nom || nom.length > 200) errors.nom = "Indique ton nom.";
  if (!isValidEmail(email)) errors.email = "Adresse e-mail invalide.";
  if (!message || message.length > 2000)
    errors.message = "Écris ton message (2 000 caractères max).";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { motif, nom, email, message } };
}

export type ContactMessageStatus = "en_attente" | "transmis" | "rejete";

export interface ContactMessage {
  id: number;
  profileId: number;
  motif: string;
  senderName: string;
  senderEmail: string;
  body: string;
  status: ContactMessageStatus;
  createdAt: string;
  moderatedBy: number | null;
  moderatedAt: string | null;
  notifiedAt: string | null;
}

interface ContactMessageRow {
  id: number;
  profile_id: number;
  reason: string;
  sender_name: string;
  sender_email: string;
  body: string;
  status: ContactMessageStatus;
  created_at: string;
  moderated_by: number | null;
  moderated_at: string | null;
  notified_at: string | null;
}

function mapRow(r: ContactMessageRow): ContactMessage {
  return {
    id: r.id,
    profileId: r.profile_id,
    motif: r.reason,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    moderatedBy: r.moderated_by ?? null,
    moderatedAt: r.moderated_at ?? null,
    notifiedAt: r.notified_at ?? null,
  };
}

const MSG_COLUMNS = `id, profile_id, reason, sender_name, sender_email, body,
  status, created_at, moderated_by, moderated_at, notified_at`;
/** Mêmes colonnes préfixées `cm.` pour les requêtes jointes (file orga). */
const MSG_COLUMNS_CM = `cm.id, cm.profile_id, cm.reason, cm.sender_name, cm.sender_email,
  cm.body, cm.status, cm.created_at, cm.moderated_by, cm.moderated_at, cm.notified_at`;

/** Enregistre un message en attente de modération. Renvoie son id. */
export async function createContactMessage(input: {
  profileId: number;
  motif: string;
  senderName: string;
  senderEmail: string;
  body: string;
}): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO contact_messages (profile_id, reason, sender_name, sender_email, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.profileId,
      input.motif,
      input.senderName,
      input.senderEmail,
      input.body,
    ],
  );
  return (rows[0] as { id: number }).id;
}

/** File de modération (vue orga) : messages en attente, avec le nom de la destinataire. */
export interface PendingContactMessage extends ContactMessage {
  speakeuseName: string | null;
}

export async function getPendingContactMessages(): Promise<
  PendingContactMessage[]
> {
  const { rows } = await pool.query(
    `SELECT ${MSG_COLUMNS_CM}, u.name AS speakeuse_name
       FROM contact_messages cm
       JOIN speaker_profiles sp ON sp.id = cm.profile_id
       JOIN users u ON u.id = sp."userId"
      WHERE cm.status = 'en_attente'
      ORDER BY cm.created_at`,
  );
  return (rows as (ContactMessageRow & { speakeuse_name: string | null })[]).map(
    (r) => ({ ...mapRow(r), speakeuseName: r.speakeuse_name ?? null }),
  );
}

/** Un message par son id (tous statuts), avec le nom de la destinataire. */
export async function getContactMessageById(
  id: number,
): Promise<PendingContactMessage | null> {
  const { rows } = await pool.query(
    `SELECT ${MSG_COLUMNS_CM}, u.name AS speakeuse_name
       FROM contact_messages cm
       JOIN speaker_profiles sp ON sp.id = cm.profile_id
       JOIN users u ON u.id = sp."userId"
      WHERE cm.id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as ContactMessageRow & { speakeuse_name: string | null };
  return { ...mapRow(r), speakeuseName: r.speakeuse_name ?? null };
}

/**
 * Historique des messages traités (transmis / rejetés), du plus récent au plus
 * ancien. `limit` borne la liste (pas de pagination : audit léger côté orga).
 */
export async function getRecentModeratedMessages(
  limit = 30,
): Promise<PendingContactMessage[]> {
  const { rows } = await pool.query(
    `SELECT ${MSG_COLUMNS_CM}, u.name AS speakeuse_name
       FROM contact_messages cm
       JOIN speaker_profiles sp ON sp.id = cm.profile_id
       JOIN users u ON u.id = sp."userId"
      WHERE cm.status IN ('transmis', 'rejete')
      ORDER BY cm.moderated_at DESC NULLS LAST
      LIMIT $1`,
    [limit],
  );
  return (rows as (ContactMessageRow & { speakeuse_name: string | null })[]).map(
    (r) => ({ ...mapRow(r), speakeuseName: r.speakeuse_name ?? null }),
  );
}

/** Messages TRANSMIS d'une speakeuse (vue « Mes messages » de son espace). */
export async function getTransmittedMessagesForProfile(
  profileId: number,
): Promise<ContactMessage[]> {
  const { rows } = await pool.query(
    `SELECT ${MSG_COLUMNS}
       FROM contact_messages
      WHERE profile_id = $1 AND status = 'transmis'
      ORDER BY created_at DESC`,
    [profileId],
  );
  return (rows as ContactMessageRow[]).map(mapRow);
}

/**
 * Combien de messages une speakeuse a REÇUS, en tout (`transmis`).
 *
 * Un `COUNT`, pas `getTransmittedMessagesForProfile(...).length` : la rangée
 * « Mes messages » du profil a seulement besoin de savoir s'il y en a eu, et
 * elle est rendue sur une page qui enchaîne déjà neuf lectures. Charger les
 * lignes complètes — `senderEmail` et `body` compris — pour n'en garder que la
 * longueur serait payer cher une donnée qu'on jette.
 *
 * Le compte porte sur TOUS les messages reçus, jamais sur les non-lus : la
 * rangée est une PORTE permanente vers l'archive, pas une notification. C'est
 * précisément ce qui manquait — l'onglet de la barre était la seule voie du
 * produit vers cette page (revue de conception du 2026-08-16, C2).
 */
export async function countTransmittedMessagesForProfile(
  profileId: number,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM contact_messages
      WHERE profile_id = $1 AND status = 'transmis'`,
    [profileId],
  );
  return (rows[0] as { n: number }).n;
}

/**
 * Orga : transmet ou rejette un message en attente, en traçant qui/quand.
 * Ne touche qu'un message ENCORE `en_attente` (idempotent). Renvoie le nombre
 * de lignes affectées.
 */
export async function setContactMessageStatus(
  messageId: number,
  status: Exclude<ContactMessageStatus, "en_attente">,
  moderatedBy: number,
): Promise<number> {
  const res = await pool.query(
    `UPDATE contact_messages
        SET status = $2, moderated_by = $3, moderated_at = now()
      WHERE id = $1 AND status = 'en_attente'`,
    [messageId, status, moderatedBy],
  );
  return res.rowCount ?? 0;
}

/** Nombre de messages en attente de modération (badge / digest orga). */
export async function countPendingContactMessages(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM contact_messages WHERE status = 'en_attente'`,
  );
  return (rows[0] as { n: number }).n;
}

/**
 * Digest speakeuse : messages transmis pas encore notifiés, regroupés par
 * destinataire (e-mail + nom). Sert à prévenir chaque speakeuse UNE fois.
 */
export interface DigestMessage {
  id: number;
  profileId: number;
  motif: string;
  body: string;
  email: string;
  name: string | null;
}

export async function getMessagesToNotify(): Promise<DigestMessage[]> {
  const { rows } = await pool.query(
    `SELECT cm.id, cm.profile_id, cm.reason, cm.body, u.email, u.name
       FROM contact_messages cm
       JOIN speaker_profiles sp ON sp.id = cm.profile_id
       JOIN users u ON u.id = sp."userId"
      WHERE cm.status = 'transmis'
        AND cm.notified_at IS NULL
        AND u.email IS NOT NULL
      ORDER BY cm.profile_id, cm.created_at`,
  );
  return (
    rows as {
      id: number;
      profile_id: number;
      reason: string;
      body: string;
      email: string;
      name: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    motif: r.reason,
    body: r.body,
    email: r.email,
    name: r.name ?? null,
  }));
}

/**
 * Rate-limit DURABLE (anti-abus safe place) : nombre de messages déjà envoyés
 * par une même adresse dans les `minutes` écoulées. Contrairement au limiteur en
 * mémoire (`rate-limit.ts`, best-effort et remis à zéro au cold start), ce
 * compteur s'appuie sur la base : il survit aux instances serverless et borne
 * réellement le remplissage de la file de modération. Compte tous statuts
 * confondus (un abuseur rejeté reste compté).
 */
export async function countRecentMessagesFromEmail(
  email: string,
  minutes: number,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM contact_messages
      WHERE lower(sender_email) = lower($1)
        AND created_at > now() - make_interval(mins => $2)`,
    [email, minutes],
  );
  return (rows[0] as { n: number }).n;
}

/** Marque des messages comme notifiés (anti-double-notification du digest). */
export async function markMessagesNotified(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE contact_messages SET notified_at = now() WHERE id = ANY($1)`,
    [ids],
  );
}
