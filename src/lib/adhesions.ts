import { pool } from "@/lib/db";
import type { AdhesionHelloAsso } from "@/lib/helloasso";
import type { ProfileStatus } from "@/lib/profiles";
import {
  adhesionAJourSql,
  enchainerEcheance,
  type AdhesionStatut,
} from "@/lib/adhesion";

/**
 * Les adhésions HelloAsso dans la plateforme : rapprochement, échéance, et ce
 * que les écrans en lisent. Conception : docs/conception-adhesions-helloasso.md.
 *
 * HelloAsso reste la source de vérité. `user_memberships` n'en garde qu'une
 * copie de travail, et seulement pour les adhésions qui correspondent à un
 * COMPTE : une adhésion sans compte ne laisse aucune ligne (minimisation).
 */

/** `$a, $b, …` : des paramètres positionnels pour une liste `IN (…)`. Le
 *  dépôt n'emploie pas `= ANY($1)` (que pg-mem, banc des tests, ignore). */
function parametres(n: number, depuis = 1): string {
  return Array.from({ length: n }, (_, i) => `$${depuis + i}`).join(", ");
}

/**
 * Adresse (minuscules) → compte, contre TOUTES les adresses rattachées :
 * celle du compte (`users.email`, le lien magique) et celles que Google ou
 * LinkedIn ont données à la connexion (`accounts.email`, migration 074).
 */
async function comptesParEmail(emails: string[]): Promise<Map<string, number>> {
  const voulues = [...new Set(emails)];
  const comptes = new Map<string, number>();
  if (voulues.length === 0) return comptes;
  const liste = parametres(voulues.length);
  // L'adresse du compte prime (lue en premier) sur celle d'un fournisseur.
  // Ordre déterministe : une même adresse portée par deux comptes doit
  // désigner le même compte d'un jour à l'autre.
  const parUsers = await pool.query(
    `SELECT lower(email) AS email, id AS user_id FROM users
      WHERE email IS NOT NULL AND lower(email) IN (${liste})
      ORDER BY id`,
    voulues,
  );
  const parFournisseurs = await pool.query(
    `SELECT lower(email) AS email, "userId" AS user_id FROM accounts
      WHERE email IS NOT NULL AND lower(email) IN (${liste})
      ORDER BY "userId", id`,
    voulues,
  );
  for (const r of [...parUsers.rows, ...parFournisseurs.rows] as {
    email: string;
    user_id: number;
  }[])
    if (!comptes.has(r.email)) comptes.set(r.email, r.user_id);
  return comptes;
}

export interface BilanSynchro {
  /** Articles d'adhésion lus. */
  articles: number;
  /** Comptes dont l'adhésion a été écrite (une adhérente qui a renouvelé
   *  compte une fois ici, deux fois dans `articles`). */
  comptes: number;
  /** Articles rapprochés d'un compte : `articles - sansCompte`. C'est lui qui
   *  s'affiche aux orgas, pour que les deux compteurs d'articles s'additionnent
   *  (revue du 2026-10-15 : « 3 lues · 1 reliée · 1 sans compte » ne tombait
   *  pas juste dès le premier renouvellement). */
  articlesRelies: number;
  /** Articles qu'aucun compte ne porte : comptés, jamais stockés. */
  sansCompte: number;
  /** Adhésions HelloAsso disparues de HelloAsso (remboursées), passées en expirées. */
  expirees: number;
  /** Fiches `en_pause` revenues dans l'annuaire. */
  fichesReprises: number;
}

/** Le résultat d'une synchro : un bilan, une erreur, ou pas d'identifiants. */
export type ResultatSynchro = BilanSynchro | { erreur: string } | "non_configuree";

/**
 * Amène `user_memberships` à l'état de HelloAsso. Appelée par le rattrapage
 * quotidien ET par la notification, avec TOUT l'historique dans les deux cas :
 * un seul calcul, donc aucun écart possible entre les deux chemins — et c'est
 * ce qui permet d'expirer ce qui manque à la liste.
 */
export async function synchroniserAdhesions(
  adhesions: AdhesionHelloAsso[],
  maintenant: Date = new Date(),
): Promise<BilanSynchro> {
  // Une liste VIDE alors que des adhésions HelloAsso sont actives n'est pas
  // une association sans membres : c'est un slug changé, le bac à sable, une
  // anomalie de l'API. Tout expirer couperait la protection de la passe de
  // conservation (qui suit dans le même cron) et lancerait des préavis à
  // toutes les membres. On refuse : la passe dit l'erreur, la règle est
  // suspendue, rien n'est écrit.
  if (adhesions.length === 0) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM user_memberships m
        WHERE m.source = 'helloasso' AND ${adhesionAJourSql("m", "$1")}`,
      [maintenant],
    );
    if ((rows[0] as { n: number }).n > 0)
      throw new Error(
        "HelloAsso a rendu une liste d'adhésions vide alors que des adhésions sont actives : synchro refusée",
      );
  }
  const comptes = await comptesParEmail(adhesions.flatMap((a) => a.emails));
  const parCompte = new Map<number, AdhesionHelloAsso[]>();
  let sansCompte = 0;
  for (const a of adhesions) {
    const email = a.emails.find((e) => comptes.has(e));
    if (email === undefined) {
      sansCompte++;
      continue;
    }
    const userId = comptes.get(email)!;
    const siennes = parCompte.get(userId);
    if (siennes) siennes.push(a);
    else parCompte.set(userId, [a]);
  }

  for (const [userId, siennes] of parCompte) {
    const echeance = enchainerEcheance(siennes.map((a) => a.date))!;
    const dernier = siennes.reduce((d, a) => (a.date > d.date ? a : d));
    await ecrireAdhesion(userId, echeance, dernier.itemId);
  }

  // L'appelant a lu TOUT HelloAsso (cron comme notification) : une adhésion
  // HelloAsso absente de la liste a disparu (remboursée, annulée).
  const gardes = [...parCompte.keys()];
  const { rowCount: expirees } = await pool.query(
    `UPDATE user_memberships SET status = 'expired'
      WHERE source = 'helloasso' AND status = 'active'
        ${gardes.length > 0 ? `AND "userId" NOT IN (${parametres(gardes.length)})` : ""}`,
    gardes,
  );

  const fichesReprises = await reprendreFiches(maintenant);
  return {
    articles: adhesions.length,
    comptes: parCompte.size,
    articlesRelies: adhesions.length - sansCompte,
    sansCompte,
    expirees: expirees ?? 0,
    fichesReprises,
  };
}

/**
 * Écrit l'adhésion d'un compte. Une ligne saisie à la main (`manuel`) n'est
 * remplacée que par une échéance plus tardive. La relance avant échéance est
 * oubliée quand l'échéance change : elle repartira avant la nouvelle.
 */
async function ecrireAdhesion(
  userId: number,
  { debut, fin }: { debut: Date; fin: Date },
  itemId: number,
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT source, expires_at, status FROM user_memberships WHERE "userId" = $1`,
    [userId],
  );
  const actuelle = rows[0] as { source: string; expires_at: Date; status: string } | undefined;
  if (!actuelle) {
    await pool.query(
      `INSERT INTO user_memberships
         ("userId", source, started_at, expires_at, status, helloasso_item_id)
       VALUES ($1, 'helloasso', $2, $3, 'active', $4)`,
      [userId, debut, fin, itemId],
    );
    return;
  }
  if (
    actuelle.source !== "helloasso" &&
    actuelle.status === "active" &&
    new Date(actuelle.expires_at) >= fin
  )
    return;
  const memeEcheance = new Date(actuelle.expires_at).getTime() === fin.getTime();
  await pool.query(
    `UPDATE user_memberships
        SET source = 'helloasso', started_at = $2, expires_at = $3, status = 'active',
            helloasso_item_id = $4,
            relance_envoyee_le = CASE WHEN $5 THEN relance_envoyee_le ELSE NULL END
      WHERE "userId" = $1`,
    [userId, debut, fin, itemId, memeEcheance],
  );
}

/**
 * Les fiches en pause dont la titulaire est à jour reviennent dans l'annuaire,
 * et les préavis que l'adhésion couvre s'effacent. Pour TOUS les comptes, pas
 * les seuls rapprochés de ce passage : une adhésion saisie à la main
 * (`manuel`) remet aussi une fiche en ligne — la règle de pause la respecte,
 * celle du retour aussi. Rend le nombre de fiches revenues.
 *
 * Un préavis ne s'efface que si l'adhésion couvre la DATE ANNONCÉE, pas
 * seulement aujourd'hui (revue du 2026-10-15) : effacé pour une adhésion qui
 * court encore mais finit avant, il repartait le lendemain, avec une date qui
 * reculait — un préavis par jour pendant trente jours.
 *
 * Le retour n'exige PAS de nom de compte, contrairement à une publication
 * (`setProfileStatus`) : une pause est un aller-retour qui rend l'état
 * d'avant. Exiger un nom coinçait en pause, à vie, la cohorte migrée sans nom
 * — alors que l'écran lui promettait le retour à l'adhésion (seconde revue du
 * 2026-10-15). Les fiches publiées sans nom ont leur propre tâche orga.
 */

async function reprendreFiches(maintenant: Date): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE speaker_profiles SET status = 'publie', annuaire_retrait_le = NULL
      WHERE status = 'en_pause'
        AND "userId" IN (
              SELECT m."userId" FROM user_memberships m WHERE ${adhesionAJourSql("m", "$1")})`,
    [maintenant],
  );
  await pool.query(
    `UPDATE speaker_profiles SET annuaire_retrait_le = NULL
      WHERE annuaire_retrait_le IS NOT NULL
        AND id IN (
              SELECT p.id FROM speaker_profiles p
                JOIN user_memberships m ON m."userId" = p."userId"
               WHERE p.annuaire_retrait_le IS NOT NULL
                 AND ${adhesionAJourSql("m", "p.annuaire_retrait_le")})`,
  );
  return rowCount ?? 0;
}

// ─── Lectures pour les écrans ───

export interface AdhesionCompte {
  startedAt: string;
  expiresAt: string;
  status: AdhesionStatut;
  source: "helloasso" | "manuel";
}

/** L'adhésion d'un compte, pour son espace. Null = aucune adhésion connue. */
export async function adhesionDuCompte(userId: number): Promise<AdhesionCompte | null> {
  const { rows } = await pool.query(
    `SELECT started_at, expires_at, status, source FROM user_memberships WHERE "userId" = $1`,
    [userId],
  );
  const r = rows[0] as
    | { started_at: Date; expires_at: Date; status: AdhesionStatut; source: "helloasso" | "manuel" }
    | undefined;
  if (!r) return null;
  return {
    startedAt: new Date(r.started_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    status: r.status,
    source: r.source,
  };
}

export interface AdhesionOrga {
  userId: number;
  name: string | null;
  email: string;
  source: "helloasso" | "manuel";
  status: AdhesionStatut;
  expiresAt: string;
  ficheStatus: ProfileStatus | null;
  retraitLe: string | null;
}

/** La vue orga : les comptes rapprochés, par échéance (la plus proche d'abord). */
export async function adhesionsPourOrga(): Promise<AdhesionOrga[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, m.source, m.status, m.expires_at,
            sp.status AS fiche_status, sp.annuaire_retrait_le
       FROM user_memberships m
       JOIN users u ON u.id = m."userId"
       LEFT JOIN speaker_profiles sp ON sp."userId" = u.id
      ORDER BY m.expires_at ASC, u.id ASC`,
  );
  return (
    rows as {
      id: number;
      name: string | null;
      email: string;
      source: "helloasso" | "manuel";
      status: AdhesionStatut;
      expires_at: Date;
      fiche_status: ProfileStatus | null;
      annuaire_retrait_le: Date | null;
    }[]
  ).map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    source: r.source,
    status: r.status,
    expiresAt: new Date(r.expires_at).toISOString(),
    ficheStatus: r.fiche_status,
    retraitLe: r.annuaire_retrait_le ? new Date(r.annuaire_retrait_le).toISOString() : null,
  }));
}
