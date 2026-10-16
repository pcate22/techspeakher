import { pool } from "@/lib/db";
import { foldRecherche } from "@/lib/normalise-recherche";

/**
 * Repli d'un nom pour la comparaison d'homonymie : casse et accents retirés
 * (`foldRecherche`), puis espaces réduits/rognés. « Élodie  Martin » et
 * « elodie martin » deviennent identiques. Sert à comparer le nom d'une
 * connexion entrante au nom des comptes existants sans se faire piéger par une
 * différence cosmétique (accent, casse, espace) que l'égalité SQL stricte
 * laissait passer — c'était la faille qui laissait naître des doublons.
 */
function foldName(name: string): string {
  return foldRecherche(name).replace(/\s+/g, " ").trim();
}

/**
 * Moyens de connexion d'un compte. Les providers OAuth (Google, LinkedIn) sont
 * matérialisés par une ligne dans la table `accounts` ; le lien magique, lui,
 * n'a pas de ligne dédiée : il est disponible dès que le compte a un e-mail et
 * que le provider e-mail est activé. On expose donc deux notions :
 *  - les providers OAuth réellement RATTACHÉS (table accounts) ;
 *  - la liste des moyens ACTIFS (OAuth rattachés + lien magique le cas échéant),
 *    qui sert à l'affichage et au garde-fou anti-lockout.
 */

/** Providers OAuth rattachés au compte (valeurs distinctes de accounts.provider). */
export async function getLinkedProviders(userId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT provider FROM accounts WHERE "userId" = $1 ORDER BY provider`,
    [userId],
  );
  return (rows as { provider: string }[]).map((r) => r.provider);
}

/** Le jeton d'accès conservé pour un provider rattaché, et sa date d'expiration
 * (epoch secondes, telle que le provider l'a annoncée — `null` s'il n'a rien
 * dit). Sert à REDEMANDER une donnée au provider sans repasser par un
 * aller-retour de connexion. */
export interface AccesProvider {
  accessToken: string;
  expiresAt: number | null;
}

/**
 * Jeton d'accès d'un provider rattaché AU COMPTE DEMANDÉ. Le `userId` est dans
 * la clause `WHERE`, jamais dans un filtre applicatif : c'est ce qui rend
 * impossible de lire le jeton d'une autre personne, même si l'appelante se
 * trompe. `null` si le provider n'est pas rattaché, ou si l'adapter n'a gardé
 * aucun jeton (connexion antérieure au stockage des jetons).
 */
export async function getProviderAccess(
  userId: number,
  provider: string,
): Promise<AccesProvider | null> {
  const { rows } = await pool.query(
    `SELECT access_token, expires_at FROM accounts
      WHERE "userId" = $1 AND provider = $2 AND access_token IS NOT NULL
      ORDER BY expires_at DESC NULLS LAST
      LIMIT 1`,
    [userId, provider],
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { access_token: string; expires_at: string | number | null };
  const expiresAt = row.expires_at === null ? null : Number(row.expires_at);
  return {
    accessToken: row.access_token,
    expiresAt: Number.isFinite(expiresAt as number) ? (expiresAt as number) : null,
  };
}

/**
 * Rafraîchit le jeton d'accès conservé pour un rattachement EXISTANT.
 *
 * Auth.js n'écrit les jetons qu'au tout premier rattachement (`linkAccount`) :
 * se reconnecter par LinkedIn des mois plus tard laissait donc en base un jeton
 * périmé, alors qu'un jeton neuf venait d'arriver. C'est la reprise de photo
 * qui l'a révélé — elle demandait une reconnexion à qui venait justement de se
 * reconnecter. Best-effort : une écriture ratée ici ne fait jamais échouer une
 * connexion (au pire, la reprise de photo redemandera un passage par LinkedIn).
 */
export async function rafraichirJetonProvider(input: {
  userId: number;
  provider: string;
  providerAccountId: string;
  accessToken: string;
  expiresAt: number | null;
  /** L'adresse que le fournisseur donne à cette connexion (vérifiée par Google
   *  et LinkedIn). Auth.js ne la garde pas ; elle sert au rapprochement des
   *  adhésions HelloAsso (migration 074). Absente : l'adresse connue reste. */
  email?: string | null;
}): Promise<void> {
  await pool.query(
    `UPDATE accounts SET access_token = $4, expires_at = $5, email = COALESCE($6, email)
      WHERE "userId" = $1 AND provider = $2 AND "providerAccountId" = $3`,
    [
      input.userId,
      input.provider,
      input.providerAccountId,
      input.accessToken,
      input.expiresAt,
      input.email?.trim() || null,
    ],
  );
}

/**
 * L'adresse d'un profil OAuth qu'on peut garder pour rattacher une adhésion :
 * seulement si le fournisseur ne la dit pas NON vérifiée (Google et LinkedIn
 * OIDC posent `email_verified` ; absent, on fait confiance, comme le lien
 * automatique des comptes d'`auth.config.ts`). C'est elle qui donne une
 * adhésion à un compte : une adresse non vérifiée permettrait de réclamer
 * celle d'une autre.
 */
export function adresseFournisseurVerifiee(
  profile: { email?: unknown; email_verified?: unknown } | null | undefined,
): string | null {
  if (typeof profile?.email !== "string" || profile.email_verified === false) return null;
  return profile.email;
}

/**
 * Supprime le rattachement d'un provider OAuth au compte (délier). Ne touche
 * qu'aux lignes `accounts` : ni le compte, ni le profil, ni les talks. La
 * personne pourra relier ce provider plus tard (nouvelle connexion connectée).
 */
export async function unlinkProvider(userId: number, provider: string): Promise<void> {
  await pool.query(`DELETE FROM accounts WHERE "userId" = $1 AND provider = $2`, [userId, provider]);
}

/**
 * Liste des moyens de connexion ACTIFS d'un compte : providers OAuth rattachés,
 * plus le lien magique (« email ») si activé côté serveur ET si le compte a une
 * adresse (sans e-mail, aucun lien à envoyer). Source unique partagée par la
 * page « Mes connexions » et par le garde-fou de déliaison.
 */
export function activeSignInMethods(
  linkedProviders: string[],
  opts: { hasEmail: boolean; magicLinkEnabled: boolean },
): string[] {
  const methods = [...linkedProviders];
  if (opts.magicLinkEnabled && opts.hasEmail) methods.push("email");
  return methods;
}

/**
 * Peut-on délier ce provider sans priver le compte de TOUT moyen de connexion ?
 * Garde-fou anti-lockout : on refuse de retirer le dernier moyen restant (sinon
 * la personne ne pourrait plus jamais se reconnecter à son propre compte).
 */
export function canUnlinkProvider(
  provider: string,
  linkedProviders: string[],
  opts: { hasEmail: boolean; magicLinkEnabled: boolean },
): boolean {
  const remaining = activeSignInMethods(linkedProviders, opts).filter((m) => m !== provider);
  return remaining.length >= 1;
}

/**
 * Reste-t-il un provider OAuth CONFIGURÉ que le compte n'a pas encore rattaché ?
 * Signal d'incitation au regroupement (prévention des doublons) : tant qu'une
 * méthode OAuth reste non reliée, une future connexion par cette méthode — avec
 * un e-mail différent de celui du compte — ouvrirait une seconde fiche. La
 * relier depuis le compte fait retomber ces connexions sur la même fiche.
 */
export function hasUnlinkedOAuth(
  linkedProviders: string[],
  enabledOAuthProviders: string[],
): boolean {
  return enabledOAuthProviders.some((p) => !linkedProviders.includes(p));
}

/**
 * Cookie de court-circuit de la détection de doublon (brique 2). Posé par la
 * liaison depuis « Mes connexions » (on est déjà connectée, aucun doublon à
 * craindre) et par le choix explicite « créer un nouveau compte quand même » de
 * l'écran de doublon. Court (5 min), le temps de l'aller-retour OAuth.
 */
export const SKIP_DUP_CHECK_COOKIE = "tsh-skip-dup-check";

/**
 * Une VRAIE création de compte OAuth homonyme va-t-elle avoir lieu ? (« brique
 * 2 », détection B — seulement sur homonyme). Renvoie false dès qu'il ne s'agit
 * pas d'une première connexion créant un doublon :
 *  - provider déjà rattaché → reconnexion ;
 *  - e-mail déjà connu → Auth.js va LIER, pas dupliquer.
 * Ne renvoie true que si un compte au même NOM existe déjà (via un autre
 * e-mail) : le seul indice disponible à la 1ʳᵉ connexion.
 */
export async function isProbableDuplicateSignin(input: {
  provider: string;
  providerAccountId: string;
  email?: string | null;
  name?: string | null;
}): Promise<boolean> {
  const { provider, providerAccountId, email, name } = input;
  // 1. Provider déjà rattaché → reconnexion, jamais un doublon.
  const linked = await pool.query(
    `SELECT 1 FROM accounts WHERE provider = $1 AND "providerAccountId" = $2 LIMIT 1`,
    [provider, providerAccountId],
  );
  if ((linked.rowCount ?? 0) > 0) return false;
  // 2. E-mail déjà connu → liaison automatique (allowDangerousEmailAccountLinking).
  if (email) {
    const byEmail = await pool.query(`SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1`, [
      email,
    ]);
    if ((byEmail.rowCount ?? 0) > 0) return false;
  }
  // 3. Déclencheur B : un compte au même nom existe (et pas via ce même e-mail).
  //    On compare des noms REPLIÉS (casse + accents + espaces, cf. foldName) :
  //    l'égalité SQL stricte ratait « Élodie » vs « elodie » ou un double
  //    espace, et laissait donc filer le doublon. On rapatrie les noms des
  //    comptes candidats puis on replie des deux côtés. L'exclusion de l'e-mail
  //    entrant côté SQL est un filet : l'étape 2 a déjà écarté un e-mail connu,
  //    mais on garde le garde-fou pour que l'étape 3 reste correcte seule. La
  //    communauté tient sur quelques centaines de comptes : le scan est
  //    négligeable et évite d'exiger l'extension unaccent.
  const needle = foldName(name ?? "");
  if (!needle) return false;
  const { rows } = await pool.query(
    `SELECT name FROM users
       WHERE name IS NOT NULL
         AND ($1::text IS NULL OR lower(coalesce(email, '')) <> lower($1))`,
    [email ?? null],
  );
  return (rows as { name: string }[]).some((r) => foldName(r.name) === needle);
}

/**
 * Décide vers quel écran rediriger une connexion OAuth : l'écran « tu as
 * peut-être déjà un compte » si un doublon homonyme est probable, sinon rien
 * (on laisse la connexion suivre son cours). Logique isolée d'Auth.js pour
 * rester testable. `skip` court-circuite (liaison / choix explicite).
 */
export async function duplicateSigninRedirect(params: {
  account: { type?: string; provider: string; providerAccountId: string } | null;
  email?: string | null;
  name?: string | null;
  skip: boolean;
}): Promise<string | null> {
  const { account, email, name, skip } = params;
  if (skip) return null;
  // Toutes les méthodes passent par la détection, lien magique (type « email »)
  // compris : une réclamation par e-mail sur une NOUVELLE adresse pouvait créer
  // un doublon sans le moindre avertissement. La détection reste inerte quand
  // aucun nom n'accompagne la connexion (cas courant du lien magique brut) :
  // elle ne se déclenche donc que si un homonyme est réellement détectable.
  if (!account) return null;
  const probable = await isProbableDuplicateSignin({
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    email,
    name,
  });
  return probable
    ? `/connexion/deja-un-compte?methode=${encodeURIComponent(account.provider)}`
    : null;
}
