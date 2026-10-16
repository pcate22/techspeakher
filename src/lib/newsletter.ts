import { pool } from "@/lib/db";

/**
 * LETTRE D'INFORMATION : l'abonnement d'un compte, et lui seul.
 *
 * Modèle OPT-OUT (décision produit, cf. migration 057) : une adresse est
 * abonnée tant qu'elle n'a rien refusé — une association écrit à ses membres.
 * Le refus est daté, pour deux raisons : la synchro Brevo cesse de la pousser,
 * et on peut dire QUAND le choix a été fait si la personne le demande.
 *
 * Ce réglage ne touche JAMAIS aux e-mails de service (lien de connexion,
 * décision sur la fiche, message reçu, rappel) : refuser le marketing n'a
 * aucune raison de couper ce pour quoi le compte existe.
 */

/** La personne reçoit-elle la lettre d'information ? */
export async function estAbonnee(userId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT newsletter_optout_at FROM users WHERE id = $1`,
    [userId],
  );
  const ligne = rows[0] as { newsletter_optout_at: Date | null } | undefined;
  return ligne ? ligne.newsletter_optout_at === null : false;
}

/**
 * Pose ou retire le refus. Ré-abonner efface la date : le choix courant est ce
 * qui compte, et garder l'horodatage d'un refus révoqué serait conserver une
 * donnée qui ne dit plus rien de vrai (minimisation).
 */
export async function setAbonnement(userId: number, abonnee: boolean): Promise<void> {
  await pool.query(
    `UPDATE users SET newsletter_optout_at = CASE WHEN $2 THEN NULL ELSE now() END
      WHERE id = $1`,
    [userId, abonnee],
  );
}

/**
 * Désabonne par ADRESSE (retour de Brevo : la personne a cliqué « se
 * désinscrire » dans un e-mail). Insensible à la casse, comme partout où l'on
 * compare des adresses. Idempotent, et sans effet sur une adresse inconnue —
 * un contact « écosystème » qui se désinscrit vit dans Brevo, pas ici.
 */
export async function desabonnerParEmail(email: string): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE users SET newsletter_optout_at = now()
      WHERE lower(email) = lower($1) AND newsletter_optout_at IS NULL`,
    [email],
  );
  return rowCount ?? 0;
}
