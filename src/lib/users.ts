import { cache } from "react";
import { pool } from "@/lib/db";
import { isUniqueViolation } from "@/lib/pg-errors";
import { normaliserNomCompte } from "@/lib/format";

/** Genre déclaré d'un compte (colonne `users.genre`), null si non déclaré. */
export type Genre = "femme" | "homme" | "non_binaire";

export interface UserLite {
  id: number;
  name: string | null;
  email: string | null;
}

/**
 * Libellé d'un compte pour les sélecteurs ADMIN : « Nom (email) », ou l'un des
 * deux, ou un n° neutre. L'e-mail (entre parenthèses) lève les homonymies côté
 * orga ; il n'est jamais exposé publiquement.
 */
export function compteLabel(u: UserLite): string {
  const base = u.name ?? u.email ?? `Compte n° ${u.id}`;
  return u.name && u.email ? `${base} (${u.email})` : base;
}

/**
 * Recherche un compte par e-mail exact (insensible à la casse).
 * Sert au rattachement orga d'une inscription saisie à la main à un compte
 * (Lot A3). Renvoie null si aucun compte.
 */
export async function getUserByEmail(email: string): Promise<UserLite | null> {
  const { rows } = await pool.query(
    `SELECT id, name, email FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return rows.length > 0 ? (rows[0] as UserLite) : null;
}

/** La membre met à jour SON nom (self-service, depuis son profil) : c'est le
 * nom affiché sur sa fiche et dans l'annuaire. Indispensable à la cohorte
 * « lien magique » (pas de nom fourni par Google/LinkedIn). */
/** Écrit le nom du compte. Un nom VIDE n'écrit rien : il ne doit jamais effacer
 * celui qui existe — règle de l'écriture, pas de chacun de ses appelants. */
export async function setUserName(userId: number, name: string): Promise<void> {
  const nom = normaliserNomCompte(name);
  if (!nom) return;
  await pool.query(`UPDATE users SET name = $2 WHERE id = $1`, [userId, nom]);
}

/** Met à jour la photo (avatar) du compte. Utilisée quand la membre choisit
 * explicitement d'appliquer la photo d'un provider (LinkedIn, Google) : on
 * stocke l'URL renvoyée par le provider. */
export async function setUserImage(userId: number, image: string): Promise<void> {
  await pool.query(`UPDATE users SET image = $2 WHERE id = $1`, [userId, image]);
}

/** Complète le nom d'un compte qui n'en a pas — un nom déjà renseigné
 * appartient à la personne et n'est JAMAIS écrasé (sélecteur de comptes). */
export async function setUserNameIfEmpty(userId: number, name: string): Promise<void> {
  const nom = normaliserNomCompte(name);
  if (!nom) return;
  await pool.query(`UPDATE users SET name = $2 WHERE id = $1 AND name IS NULL`, [userId, nom]);
}

/**
 * Nom et genre du COMPTE, en une lecture. Le nom sert l'accueil, l'avatar et le
 * pré-requis de publication ; le genre évite de proposer un CTA impossible.
 * Remplace `getUserGenre`, qui ne ramenait que le genre alors que ses appelants
 * avaient aussi besoin du nom. Mémoïsée PAR REQUÊTE (`React.cache`) : depuis
 * le lot N1, la barre d'onglets (layout) et la page d'un compte sans fiche
 * lisent le même compte — un seul SELECT pour les deux.
 */
/**
 * Éligibilité à la création de fiche speakeuse — LA règle « jamais de CTA
 * impossible », en un seul endroit (feuille ➕, prochaine étape, onboarding
 * du hub) : tout le monde sauf un compte déclaré « homme ».
 */
export function peutCreerFiche(genre: Genre | null | undefined): boolean {
  return genre !== "homme";
}

export const getCompte = cache(async function getCompte(
  userId: number,
): Promise<{ name: string | null; genre: Genre | null; image: string | null } | null> {
  const { rows } = await pool.query(`SELECT name, genre, image FROM users WHERE id = $1`, [
    userId,
  ]);
  return rows.length > 0
    ? (rows[0] as { name: string | null; genre: Genre | null; image: string | null })
    : null;
});

/** Compte par id (sélecteur admin : on vérifie qu'il existe avant d'inscrire). */
export async function getUserById(id: number): Promise<UserLite | null> {
  const { rows } = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [id]);
  return rows.length > 0 ? (rows[0] as UserLite) : null;
}

/**
 * Comptes ayant un profil speakeuse, pour les sélecteurs ADMIN (ajout d'une
 * participante, d'un coach) : choisir dans la liste évite les fautes de frappe
 * d'e-mail. L'e-mail sert à lever les homonymies côté orga, jamais au public.
 */
export async function getComptesSpeakeuses(): Promise<UserLite[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email
       FROM users u
       JOIN speaker_profiles sp ON sp."userId" = u.id
      ORDER BY u.name NULLS LAST, u.email`,
  );
  return rows as UserLite[];
}

/** TOUS les comptes de la plateforme, pour le sélecteur admin de coachs
 * (pas forcément des speakeuses, pas forcément des femmes). Admin uniquement. */
export async function getComptesPlateforme(): Promise<UserLite[]> {
  const { rows } = await pool.query(
    `SELECT id, name, email FROM users ORDER BY name NULLS LAST, email`,
  );
  return rows as UserLite[];
}

/**
 * Récupère le compte d'un e-mail, ou le **pré-crée** (ligne `users` sans nom
 * ni profil) s'il n'existe pas encore. Même pattern que la migration annuaire :
 * à sa 1ʳᵉ connexion avec ce même e-mail (Google, LinkedIn ou lien magique),
 * la personne retombe sur ce compte. Sert au rattachement Tremplin d'une
 * participante pas encore inscrite à TSH (on l'invite ensuite par e-mail).
 * `created` indique si une nouvelle ligne a été créée (→ e-mail d'invitation).
 */
export async function getOrCreateUserByEmail(
  email: string,
  nom?: string,
): Promise<{ user: UserLite; created: boolean }> {
  const existing = await getUserByEmail(email);
  if (existing) {
    // Compte SANS nom (ex. créé par lien magique) : le nom saisi le complète
    // — l'affichage montre alors « qui » plutôt qu'un e-mail. Un nom existant
    // n'est JAMAIS écrasé (il appartient à la personne).
    const nomNormalise = normaliserNomCompte(nom ?? "");
    if (nomNormalise && !existing.name) {
      await pool.query(`UPDATE users SET name = $2 WHERE id = $1 AND name IS NULL`, [
        existing.id,
        nomNormalise,
      ]);
      return { user: { ...existing, name: nomNormalise }, created: false };
    }
    return { user: existing, created: false };
  }

  try {
    // Le nom (facultatif) n'est posé QUE sur un compte pré-créé : on n'écrase
    // jamais le nom d'un compte existant (il appartient à la personne).
    const { rows } = await pool.query(
      `INSERT INTO users (email, name) VALUES (lower($1), $2) RETURNING id, name, email`,
      [email, normaliserNomCompte(nom ?? "") || null],
    );
    return { user: rows[0] as UserLite, created: true };
  } catch (e) {
    // Course : un autre appel a créé le compte entre le SELECT et l'INSERT
    // (unique sur lower(email)) → on relit au lieu de dupliquer.
    if (isUniqueViolation(e)) {
      const u = await getUserByEmail(email);
      if (u) return { user: u, created: false };
    }
    throw e;
  }
}
