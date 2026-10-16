import { pool } from "@/lib/db";
import { siTableAbsente } from "@/lib/pg-errors";
import type { PublicAccompagnante } from "@/lib/tremplin-public";

/**
 * LA FICHE COACH (migration 054) — celle d'une accompagnante, pas celle d'une
 * speakeuse.
 *
 * Deux finalités distinctes, donc deux fiches : être citée comme coach sur la
 * page d'une édition ne suppose pas de vouloir figurer dans l'annuaire des
 * speakeuses, et une accompagnante qui ne prend pas la parole n'a rien à y
 * faire. Le premier jet gatait le crédit sur `speaker_profiles.status =
 * 'publie'` — c'est-à-dire qu'il fallait entrer dans un annuaire qui n'est pas
 * le sien pour être remerciée.
 *
 * Rattachée au COMPTE (donc à l'e-mail par lequel l'orga invite déjà les
 * coachs), tenue par l'orga pour celles qui ne se connectent jamais, reprise par
 * celles qui se connectent. Le consentement est horodaté pour être démontrable,
 * se retire d'un geste — partout et pour toutes les éditions à la fois — et part
 * en CASCADE avec le compte.
 */
export interface CoachProfile {
  userId: number;
  /** Rôle affiché (« Conceptrice-rédactrice », « Coach produit »…). */
  role: string | null;
  /** Un lien vers elle (LinkedIn, site), ou null. */
  lien: string | null;
  /** A-t-elle donné son accord pour être citée publiquement ? */
  public: boolean;
  publicConsentAt: string | null;
}

interface Row {
  userId: number;
  role: string | null;
  lien: string | null;
  public: boolean;
  public_consent_at: string | null;
}

const mapRow = (r: Row): CoachProfile => ({
  userId: r.userId,
  role: r.role,
  lien: r.lien,
  public: r.public,
  publicConsentAt: r.public_consent_at,
});

/**
 * La fiche d'un compte, ou `null` s'il n'en a pas encore.
 *
 * Repli sur `null` si la table n'est pas migrée : un écran d'orga qui affiche
 * « aucune fiche » se rattrape au déploiement suivant, alors qu'une erreur
 * bloquerait la page des coachs entière.
 */
export function getCoachProfile(userId: number): Promise<CoachProfile | null> {
  return pool
    .query(
      `SELECT "userId", role, lien, "public", public_consent_at
         FROM coach_profiles WHERE "userId" = $1`,
      [userId],
    )
    .then(({ rows }) => (rows.length > 0 ? mapRow(rows[0] as Row) : null))
    .catch(siTableAbsente(null));
}

/**
 * Toutes celles qui ont animé un atelier du Tremplin, éditions confondues.
 *
 * Sert `/partenaires`, où elle a remplacé deux entrées qui n'y avaient pas leur
 * place (les sociétés d'une fondatrice, rangées parmi les sponsors). Montrer
 * celles qui donnent du temps dit ce qu'est l'association mieux qu'un
 * remerciement à une entreprise. Voir docs/google-ad-grants.md.
 *
 * TROIS gardes, chacune pour une raison différente :
 *
 * 1. la fiche coach porte l'accord d'être citée (`coach_profiles.public`) ;
 * 2. l'atelier est au programme public — un atelier qu'on n'annonce pas
 *    n'expose pas non plus son encadrement ;
 * 3. l'édition elle-même est publiée. `getPublicEdition` renvoie `null` sur
 *    `statut = 'preparation'`, donc sa page répond 404 : sans cette troisième
 *    garde, une session cochée « au programme public » sur une édition encore
 *    en préparation publiait ses coachs ici alors que l'édition reste
 *    introuvable. Le consentement n'était pas en cause — `public` vaut pour
 *    toutes les éditions à la fois — mais l'édition, elle, ne l'était pas.
 *
 * `DISTINCT` parce qu'une coach revient d'une édition à l'autre, et qu'on la
 * remercie une fois.
 *
 * Repli sur liste vide si la table manque : une page de partenaires amputée
 * d'une section se rattrape au déploiement suivant, une page en erreur non.
 */
export function listAccompagnantesPubliques(): Promise<PublicAccompagnante[]> {
  return pool
    .query(
      `SELECT DISTINCT u.name AS nom, cp.role, cp.lien
         FROM tremplin_atelier_coachs ac
         JOIN tremplin_ateliers a
           ON a.id = ac.atelier_id AND a.au_programme_public = true
         JOIN tremplin_editions e
           ON e.id = a.edition_id AND e.statut <> 'preparation'
         JOIN users u ON u.id = ac.user_id
         JOIN coach_profiles cp ON cp."userId" = u.id AND cp."public" = true
        WHERE u.name IS NOT NULL
        ORDER BY u.name`,
    )
    .then(({ rows }) => rows as PublicAccompagnante[])
    .catch(siTableAbsente([] as PublicAccompagnante[]));
}

/**
 * Enregistre le rôle et le lien affichés. Crée la fiche si elle manque, SANS
 * toucher au consentement : décrire quelqu'un n'est pas obtenir son accord, et
 * une fiche neuve naît fermée (défaut SQL).
 *
 * Les chaînes vides deviennent `null` : une valeur vide en base s'afficherait
 * comme un rôle réel mais illisible.
 */
export async function upsertCoachProfile(
  userId: number,
  champs: { role: string | null; lien: string | null },
): Promise<void> {
  const vide = (v: string | null) => (v && v.trim() !== "" ? v.trim() : null);
  await pool.query(
    `INSERT INTO coach_profiles ("userId", role, lien)
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId") DO UPDATE SET role = EXCLUDED.role, lien = EXCLUDED.lien`,
    [userId, vide(champs.role), vide(champs.lien)],
  );
}

/**
 * Recueille (ou retire) l'accord d'être citée publiquement comme accompagnante.
 *
 * RECUEILLIR crée la fiche au besoin : l'orga peut obtenir l'accord d'une coach
 * avant d'avoir saisi son rôle, et lui refuser le geste parce qu'un champ
 * descriptif manque n'aurait aucun sens.
 *
 * RETIRER modifie seulement. Sans fiche il n'y a rien à retirer, et le geste
 * reste sans trace : il passe DEVANT la précondition de rattachement (RGPD
 * art. 7-3, cf. `estCoachRattache`), donc un `present=false` forgé sur un
 * compte quelconque poserait sinon une ligne vide sur ce compte.
 *
 * L'horodatage suit l'accord et s'efface avec lui — on ne conserve pas la trace
 * d'un consentement qui n'a plus cours. Le descriptif, lui, survit : c'est
 * l'accord qu'on retire, pas la fiche.
 */
export async function setCoachProfilePublic(
  userId: number,
  consent: boolean,
): Promise<void> {
  if (!consent) {
    await pool.query(
      `UPDATE coach_profiles
          SET "public" = false, public_consent_at = NULL
        WHERE "userId" = $1`,
      [userId],
    );
    return;
  }
  await pool.query(
    `INSERT INTO coach_profiles ("userId", "public", public_consent_at)
     VALUES ($1, true, now())
     ON CONFLICT ("userId") DO UPDATE
       SET "public" = true, public_consent_at = now()`,
    [userId],
  );
}
