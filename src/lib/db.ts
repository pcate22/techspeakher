import { Pool, types } from "pg";
import { isMissingTable, sqlState } from "@/lib/pg-errors";

// node-postgres renvoie par défaut les colonnes DATE (OID 1082) comme des objets
// Date JS — non affichables tels quels côté React et porteurs d'un décalage de
// fuseau. On les renvoie en chaîne brute 'YYYY-MM-DD'. (TIME/TIMESTAMPTZ
// inchangés ; aucune autre table n'utilise DATE.)
types.setTypeParser(types.builtins.DATE, (value) => value);

/**
 * Exécuteur SQL minimal : satisfait par le `pool` comme par un `PoolClient`
 * (transaction). Permet aux fonctions d'accès d'accepter soit le pool partagé,
 * soit un client de transaction (BEGIN/COMMIT) pour des écritures atomiques.
 */
export type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

/**
 * Codes signalant une socket morte. Ils ne prouvent l'absence d'exécution QUE
 * sur `pool.connect` : voir `estErreurDeConnexion` juste en dessous.
 */
const CODES_CONNEXION = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
]);

/**
 * L'erreur ressemble-t-elle à un échec d'établissement de connexion ?
 *
 * ATTENTION : ce prédicat ne suffit PAS à rendre un rejeu sûr, et il ne faut
 * surtout pas l'appliquer à l'exécution d'une instruction. `pool.query` reprend
 * un client INACTIF quand il y en a un (`pg-pool/index.js`, `_idle`) : aucune
 * connexion n'est alors établie. Si cette socket meurt en cours de requête, `pg`
 * rejette l'instruction en vol avec l'erreur socket BRUTE — donc un
 * `code: "ECONNRESET"` (`pg/lib/client.js`, `_handleErrorEvent` quand
 * `_connecting` est faux). Un rejeu doublerait alors un INSERT déjà commité,
 * dans des tables sans contrainte d'unicité.
 *
 * La sûreté vient de l'ENDROIT où la reprise est posée, pas de cette liste :
 * elle n'enveloppe que `pool.connect()`, où ces codes signifient bien « la
 * connexion n'a pas pu s'établir ». L'exécution, elle, n'est jamais rejouée.
 */
export function estErreurDeConnexion(e: unknown): boolean {
  const code = sqlState(e);
  if (code !== undefined && CODES_CONNEXION.has(code)) return true;
  return false;
}

/*
 * Ni le délai d'ÉTABLISSEMENT (« Connection terminated due to connection
 * timeout », `connectionTimeoutMillis` à 5 s) ni celui de FILE D'ATTENTE du
 * pool ne sont repris. Le premier a déjà attendu 5 s : c'est une preuve
 * suffisante que l'hôte ne répond pas, et le rejouer porterait le pire cas
 * d'une acquisition à ~16 s. Les pages qui attrapent et dégradent
 * proprement mettraient alors 16 s à le faire, plus longtemps que le délai
 * lui-même, avec le risque que la plateforme coupe en 504 avant — ce qui
 * annulerait la dégradation que tout le reste du site s'applique à tenir.
 * Les codes retenus, eux, échouent en quelques millisecondes.
 */

/**
 * Rejoue `fn` sur un réveil de base raté : deux reprises, avec une attente
 * courte et croissante. Toute autre erreur est propagée au premier essai.
 *
 * `attenteMs` est paramétrable pour que les tests n'attendent pas réellement.
 */
export async function avecReprise<T>(
  fn: () => Promise<T>,
  attenteMs = 375,
): Promise<T> {
  // Sans chaîne de connexion (CI, build, tests), il n'y a aucune base à
  // réveiller : réessayer ne fait qu'attendre un échec certain, et retarde
  // d'autant la dégradation propre des pages. Mesuré : 1,1 s ajoutée par
  // requête, soit ~4,5 s sur l'accueil qui en fait quatre.
  const reprises = resolveConnectionString() ? 2 : 0;

  for (let essai = 0; ; essai += 1) {
    try {
      return await fn();
    } catch (e) {
      if (!estErreurDeConnexion(e) || essai === reprises) throw e;
      await new Promise((r) => setTimeout(r, attenteMs * (essai + 1)));
    }
  }
}

/**
 * Exécute `fn` dans une transaction : BEGIN → fn(client) → COMMIT, ROLLBACK sur
 * erreur, client toujours relâché. Factorise le squelette répété des écritures
 * atomiques (ateliers + membres, photo + tags…).
 */
export async function withTransaction<T>(
  fn: (client: Queryable) => Promise<T>,
): Promise<T> {
  // `pool.connect` est enveloppé plus bas : l'acquisition se reprend d'elle-même
  // sur un réveil de base raté. Le corps de la transaction, lui, n'est jamais
  // rejoué.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Chaîne de connexion Postgres (jamais en dur).
 *
 * Prod → `DATABASE_URL`. Sur une **preview Vercel** (`VERCEL_ENV === "preview"`),
 * on utilise **exclusivement** `PREVIEW_DATABASE_URL` (base isolée, ex. branche
 * Neon dédiée). **Aucun repli sur `DATABASE_URL` : une preview ne doit JAMAIS
 * toucher la prod.** Si `PREVIEW_DATABASE_URL` manque, on renvoie `undefined`
 * → le pool ne se connecte à rien (échec « fermé »), plutôt que d'écrire en prod.
 */
export function resolveConnectionString(): string | undefined {
  if (process.env.VERCEL_ENV === "preview") {
    return process.env.PREVIEW_DATABASE_URL;
  }
  return process.env.DATABASE_URL;
}

/**
 * Pool de connexions Postgres (Neon).
 * Singleton réutilisé entre les invocations (évite d'épuiser les connexions
 * en environnement serverless). Le pool se connecte de façon paresseuse,
 * donc l'import est sûr même sans chaîne de connexion (ex. au build).
 */
const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: resolveConnectionString(),
    // Serverless : peu de connexions par instance (chaque instance a son pool),
    // et on libère vite les connexions inactives pour ménager Neon.
    // Idéalement DATABASE_URL pointe sur l'endpoint « -pooler » de Neon.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

// Réutilise le même pool entre invocations (y compris en prod) pour éviter
// d'épuiser les connexions lors des ré-évaluations de module.
globalForPool.pgPool = pool;

/**
 * On enveloppe `pool.connect`, et surtout PAS `pool.query`.
 *
 * `pool.query` acquiert un client, exécute, relâche — et pose au passage un
 * `client.once('error', …)` (`pg-pool/index.js`), indispensable : `_acquireClient`
 * retire l'écouteur d'inactivité du client sorti du pot, et `pg` émet `'error'`
 * sur le client quand la socket meurt (`client.js`, `_handleErrorEvent`). Sans
 * écouteur, cet `emit` lève une exception NON RATTRAPÉE — le process tombe au
 * lieu de rendre un 500. Réimplémenter cette chorégraphie à la main, c'est
 * s'exposer à en oublier une pièce.
 *
 * En enveloppant l'acquisition, `pool.query` en bénéficie sans être touché : il
 * appelle `this.connect(...)`. La reprise couvre donc le réveil de Neon, et
 * l'exécution d'une instruction n'est jamais rejouée — un INSERT parti sur une
 * socket qui meurt en vol remonte tel quel, plutôt que d'être doublé.
 *
 * La pose est gardée par un drapeau porté par le même `globalThis` que le pool :
 * sans cela, chaque ré-évaluation du module (HMR, second graphe de modules)
 * emboîterait une enveloppe de plus, et les tentatives se multiplieraient.
 */
const globalForQuery = globalThis as unknown as { pgConnectEnveloppe?: boolean };

if (!globalForQuery.pgConnectEnveloppe) {
  const connectDirect = pool.connect.bind(pool);
  pool.connect = ((rappel?: unknown) => {
    const acquisition = avecReprise(() => connectDirect());
    if (typeof rappel !== "function") return acquisition;
    // Forme à rappel. `pool.query` l'utilise en interne et ne lit que
    // `(err, client)` — il appelle `client.release(err)` lui-même. Mais le
    // contrat public de pg-pool en promet TROIS : `(err, client, done)`. Ne
    // passer que les deux premiers marchait tant que nous étions seuls
    // appelants, et cassait en silence dès qu'un tiers reçoit ce pool et écrit
    // `pool.connect((err, client, done) => …)` : son `done` valait `undefined`,
    // donc un client jamais rendu au pot. On rend les trois, comme pg-pool :
    // `client.release` en cas de succès (déjà lié au client par pg-pool), et un
    // `done` inerte en cas d'échec, puisqu'il n'y a alors rien à rendre.
    const cb = rappel as (
      err?: Error,
      client?: unknown,
      done?: (err?: Error) => void,
    ) => void;
    acquisition.then(
      (client) =>
        cb(undefined, client, (client as { release?: (err?: Error) => void }).release),
      (err: unknown) => cb(err as Error, undefined, () => {}),
    );
    return undefined;
  }) as typeof pool.connect;
  globalForQuery.pgConnectEnveloppe = true;
}

/**
 * Écrit dans une transaction ; si elle échoue UNIQUEMENT parce que la table
 * `nomTable` manque (fenêtre de déploiement d'une migration, ex. une preview
 * sans `bravos`), rejoue l'écriture SANS sa partie optionnelle, hors
 * transaction. UNE seule copie de cette mécanique (elle vivait en triple) —
 * et le repli est BORNÉ à la table nommée : un 42P01 sur une autre relation
 * remonte, jamais une purge RGPD silencieusement sautée.
 */
export async function withTransactionSaufTable<T>(
  nomTable: string,
  fn: (q: Queryable, avecTable: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await withTransaction((client) => fn(client, true));
  } catch (e) {
    // Le nom de la relation figure dans le message quelle que soit la locale
    // du serveur (les guillemets, eux, changent : "bravos", « bravos »…) —
    // on cherche donc le nom NU, jamais un format de citation.
    const surLaTable =
      isMissingTable(e) &&
      String((e as { message?: string }).message ?? "").includes(nomTable);
    if (surLaTable) return fn(pool, false);
    throw e;
  }
}
