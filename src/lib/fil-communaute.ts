import { pool } from "@/lib/db";
import { speakeuseHref } from "@/lib/profiles";

/**
 * LE FIL DE LA COMMUNAUTÉ : ce qui bouge chez les autres.
 *
 * Surface actuelle : l'accueil public (« Elles viennent d'arriver »). À terme
 * (conception v2 : docs/conception-espace-fil-navigation.md), ces lectures
 * deviennent les CARTES du fil de l'espace connecté — avec `getScenesRecentes`
 * (agenda-public.ts) et les publications signées. Le lot 1 (extrait + page +
 * marqueur de visite) a été retiré avant merge au profit de ce modèle ; ses
 * revues et protections restent documentées dans
 * docs/conception-fil-communaute-espace.md.
 */

/** Fragment SQL : le jour civil PARIS d'une colonne timestamptz. */
const sqlJourParis = (col: string) =>
  `to_char(${col} AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')`;

/**
 * Une speakeuse qui vient de rejoindre l'annuaire. Un SOUS-ENSEMBLE de ce que
 * l'annuaire publie déjà (`toPublicSpeaker`) : nom, photo, titre, lien — plus
 * la date d'entrée au format JOUR (le futur fil date ses cartes ; l'accueil
 * public ne l'affiche pas, l'ordre y porte l'information).
 */
export interface NouvelleVenue {
  profileId: number;
  nom: string;
  /** Lien vers sa fiche (slug quand il existe, sinon id). */
  href: string;
  titreProfil: string | null;
  image: string | null;
  /** Jour d'entrée dans l'annuaire (YYYY-MM-DD, heure de Paris). */
  date: string;
}

interface VenueRow {
  id: number;
  slug: string | null;
  titre_profil: string | null;
  nom: string;
  image: string | null;
  date: string;
}

/** Jointures du périmètre des venues (alias sp/u), partagées avec les bravos
 * (lot N4) : une seule copie de « qu'est-ce qu'une carte venue ». */
export const VENUES_FROM = `FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"`;

/** Conditions d'une venue VISIBLE du fil (une seule copie). */
export const VENUES_VISIBLES = `sp.status = 'publie'
        AND sp.published_at IS NOT NULL
        AND u.name IS NOT NULL`;

/**
 * Les dernières fiches ENTRÉES dans l'annuaire, la plus récente d'abord.
 *
 * `published_at` est posé au PREMIER passage au statut « publié » seulement
 * (`setProfileStatus`) : une fiche revenue après un retrait garde sa date
 * d'origine — le retour est DISCRET, jamais ré-annoncé en tête. Une fiche
 * RETIRÉE garde sa date mais perd le statut : le `WHERE` l'exclut,
 * rétroactivement.
 *
 * Une fiche sans nom est écartée : elle s'afficherait anonyme. L'e-mail n'est
 * jamais sélectionné.
 */
export async function getNouvellesVenues(limite = 3): Promise<NouvelleVenue[]> {
  const { rows } = await pool.query(
    `SELECT sp.id, sp.slug, sp.titre_profil, u.name AS nom, u.image,
            ${sqlJourParis("sp.published_at")} AS date
       ${VENUES_FROM}
      WHERE ${VENUES_VISIBLES}
      ORDER BY sp.published_at DESC, sp.id DESC
      LIMIT $1`,
    [limite],
  );
  return (rows as VenueRow[]).map((r) => ({
    profileId: r.id,
    nom: r.nom,
    href: speakeuseHref({ id: r.id, slug: r.slug }),
    titreProfil: r.titre_profil,
    image: r.image,
    date: r.date,
  }));
}
