// Référence des conférences (migration 027) — accès DB partagé.
// Voir docs/conception-registre-conferences.md : conferences = l'organisateur
// récurrent (marque de conf OU asso), conference_editions = l'événement daté
// (édition de conf OU meetup d'asso).

import { pool, type Queryable } from "@/lib/db";
import { isUniqueViolation, siTableAbsente } from "@/lib/pg-errors";
import { fetchSessionizeEvent } from "@/lib/cfp-import";
import { formatDateFr } from "@/lib/format";
import { slugify } from "@/lib/slug";

/**
 * Borne temporelle partagée (auto-complétion des talks, moisson à la demande) :
 * les meetups s'accumulent sans fin, on ne propose que les événements récents.
 */
export const EDITIONS_RECENTES_MOIS = 18;

/** Nombre max d'éditions moissonnées par « Lancer le repérage » (durée bornée). */
export const HARVEST_MAX_EVENTS = 30;

/**
 * Slugify d'un nom de conférence. Alias historique de `slugify` (extrait dans
 * `@/lib/slug`, fonction pure partagée) : le domaine conférences et ses tests
 * l'importent sous ce nom. La logique (et l'équivalence SQL) vit dans `slug.ts`.
 */
export const slugifyConference = slugify;

/** Un meetup du flux Toulouse Tech Hub, prêt à upserter. */
export interface MeetupCandidate {
  /** Id Meetup (ex. « meetup-308804426 ») : clé d'idempotence globale. */
  meetupId: string;
  titre: string;
  /** Nom de la communauté (« Agile Toulouse ») : l'asso organisatrice. */
  groupe: string;
  /** YYYY-MM-DD, ou null si le flux ne date pas l'événement. */
  date: string | null;
  lieu: string | null;
  url: string | null;
}

/** Champs nécessaires au libellé d'un événement de la référence. */
export interface EditionLibelleInput {
  confNom: string;
  type: string; // 'edition' | 'meetup'
  nom: string | null;
  annee: number | null;
  dateDebut: string | null; // YYYY-MM-DD
}

/**
 * Libellé d'un événement — LE SEUL point de vérité côté TS : utilisé par
 * l'auto-complétion (known) ET par la revalidation serveur d'edition_id. S'ils
 * divergeaient d'un octet, le lien talk → référence serait silencieusement
 * annulé à chaque soumission. Pour une édition de conf, le résultat est
 * identique à la recomposition SQL de getActiveCfpEvents (nom + année).
 * Pas de cadratin (convention du repo) : séparateur « · ».
 */
export function buildEditionLibelle(e: EditionLibelleInput): string {
  if (e.type === "meetup") {
    // formatDateFr : formatage maison UTC-safe (minuit local décalerait la date).
    const parts = [e.confNom, e.nom, formatDateFr(e.dateDebut, { dateStyle: "long" })];
    return parts.filter((p): p is string => p != null && p !== "").join(" · ");
  }
  return e.annee == null ? e.confNom : `${e.confNom} ${e.annee}`;
}

/** Option d'un sélecteur d'événement de la référence (Tremplins, admin). */
export interface EditionOption {
  id: number;
  libelle: string;
}

/**
 * Éditions de conférences (pas les meetups) récentes ou à venir, pour relier
 * une édition de Tremplin ou un article à sa conférence. Bornée comme
 * l'auto-complétion des talks.
 *
 * `includeId` garantit qu'une édition déjà rattachée (même hors fenêtre récente)
 * figure dans la liste : sinon un `<select>` contrôlé retomberait sur « Aucune »
 * et un simple enregistrement casserait le lien. Le libellé reste construit ici
 * (derrière la frontière `conferences.ts`), pas dans la page appelante.
 */
export async function listEditionOptions(
  includeId?: number | null,
): Promise<EditionOption[]> {
  const { rows } = await pool.query(
    `SELECT e.id, c.nom AS conf_nom, e.type, e.nom, e.annee,
            to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut
       FROM conference_editions e
       JOIN conferences c ON c.id = e.conference_id
      WHERE e.type = 'edition'
        AND (e.date_debut IS NULL
             OR e.date_debut >= (now() - make_interval(months => ${EDITIONS_RECENTES_MOIS}))::date)
      ORDER BY e.date_debut DESC NULLS LAST, e.annee DESC NULLS LAST, e.id DESC
      LIMIT 100`,
  );
  const options = (rows as {
    id: number; conf_nom: string; type: string; nom: string | null;
    annee: number | null; date_debut: string | null;
  }[]).map((r) => ({
    id: r.id,
    libelle: buildEditionLibelle({
      confNom: r.conf_nom, type: r.type, nom: r.nom, annee: r.annee, dateDebut: r.date_debut,
    }),
  }));

  if (includeId != null && !options.some((o) => o.id === includeId)) {
    const actuelle = await getEditionByIdForAdmin(includeId).catch(() => null);
    if (actuelle) {
      options.unshift({
        id: actuelle.id,
        libelle: buildEditionLibelle({
          confNom: actuelle.confNom, type: actuelle.type, nom: actuelle.nom,
          annee: actuelle.annee, dateDebut: actuelle.dateDebut,
        }),
      });
    }
  }
  return options;
}

/**
 * Id d'une édition de conférence par (slug de conférence, année), ou null.
 * Sert aux pages publiques d'une conférence (ex. /devfest-toulouse) pour
 * retrouver l'édition dont on liste les speakeuses. Résilient : si la référence
 * n'est pas migrée, on renvoie null (la page retombe sur son contenu statique).
 */
export async function getConferenceEditionByConfSlugAndYear(
  slug: string,
  annee: number,
): Promise<number | null> {
  const { rows } = await pool
    .query(
      `SELECT e.id FROM conference_editions e
         JOIN conferences c ON c.id = e.conference_id
        WHERE c.slug = $1 AND e.annee = $2
        ORDER BY e.id
        LIMIT 1`,
      [slug, annee],
    )
    .catch(siTableAbsente({ rows: [] as { id: number }[] }));
  return rows.length > 0 ? (rows[0] as { id: number }).id : null;
}

// ─── Lectures / écritures de l'UI orga ───

export interface AdminEdition {
  id: number;
  type: string;
  nom: string | null;
  annee: number | null;
  dateDebut: string | null;
  dateFin: string | null;
  ville: string | null;
  lieu: string | null;
  url: string | null;
  endpoint: string | null;
  actif: boolean;
  /** Ajout communautaire (badge) — minimisation : le fait suffit, pas le nom. */
  proposeParCommunaute: boolean;
}

export interface AdminConference {
  id: number;
  slug: string;
  nom: string;
  type: string;
  ville: string | null;
  pays: string | null;
  siteUrl: string | null;
  editions: AdminEdition[];
}

/** Ligne brute d'une édition pour l'admin (mapping partagé par les deux lectures). */
type AdminEditionRow = {
  id: number; type: string; nom: string | null; annee: number | null;
  date_debut: string | null; date_fin: string | null;
  ville: string | null; lieu: string | null;
  url: string | null; endpoint: string | null; actif: boolean;
  propose_par_communaute: boolean;
};

// Colonnes + tri d'une édition pour l'admin, partagés pour que les deux lectures
// (liste et page dédiée) restent synchronisées. Minimisation : on signale QUE
// l'ajout est communautaire (propose_par non NULL), sans le nom de la contributrice.
const ADMIN_EDITION_COLS = `e.id, e.type, e.nom, e.annee,
  to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut,
  to_char(e.date_fin, 'YYYY-MM-DD') AS date_fin,
  e.ville, e.lieu, e.url, e.endpoint, e.actif,
  (e.propose_par IS NOT NULL) AS propose_par_communaute`;
const ADMIN_EDITION_ORDER = `ORDER BY e.date_debut DESC NULLS LAST, e.annee DESC NULLS LAST, e.id DESC`;

function mapAdminEdition(r: AdminEditionRow): AdminEdition {
  return {
    id: r.id, type: r.type, nom: r.nom, annee: r.annee,
    dateDebut: r.date_debut, dateFin: r.date_fin, ville: r.ville, lieu: r.lieu, url: r.url,
    endpoint: r.endpoint, actif: r.actif, proposeParCommunaute: r.propose_par_communaute,
  };
}

type AdminConfRow = {
  id: number; slug: string; nom: string; type: string;
  ville: string | null; pays: string | null; site_url: string | null;
};
function mapAdminConf(c: AdminConfRow, editions: AdminEdition[]): AdminConference {
  return {
    id: c.id, slug: c.slug, nom: c.nom, type: c.type,
    ville: c.ville, pays: c.pays, siteUrl: c.site_url, editions,
  };
}

/**
 * La référence complète pour la page orga : conférences + événements datés,
 * ajouts communautaires signalés (JOIN users côté serveur, jamais sérialisé
 * vers un composant public). Événements récents en tête.
 */
export async function listConferencesForAdmin(): Promise<AdminConference[]> {
  const [confs, editions] = await Promise.all([
    pool.query(`SELECT id, slug, nom, type, ville, pays, site_url FROM conferences ORDER BY nom`),
    pool.query(
      `SELECT e.conference_id, ${ADMIN_EDITION_COLS}
         FROM conference_editions e ${ADMIN_EDITION_ORDER}`,
    ),
  ]);
  const parConf = new Map<number, AdminEdition[]>();
  for (const r of editions.rows as (AdminEditionRow & { conference_id: number })[]) {
    const list = parConf.get(r.conference_id) ?? [];
    list.push(mapAdminEdition(r));
    parConf.set(r.conference_id, list);
  }
  return (confs.rows as AdminConfRow[]).map((c) => mapAdminConf(c, parConf.get(c.id) ?? []));
}

/**
 * Une conférence et ses événements pour SA page d'administration (la « spoke »
 * du hub `/admin/conferences`). Lecture ciblée par slug — la gestion (corriger,
 * éditions, supprimer) vit ici, dans le contexte de l'item, jamais empilée sur
 * la liste (cf. docs/principes-conception-ui.md, règle d'or). `null` = 404.
 * Les deux requêtes sont parallèles (les éditions filtrent par sous-requête sur
 * le slug, pas besoin d'attendre l'id de la conférence).
 */
export async function getConferenceBySlugForAdmin(
  slug: string,
): Promise<AdminConference | null> {
  const [confRes, edRes] = await Promise.all([
    pool.query(
      `SELECT id, slug, nom, type, ville, pays, site_url FROM conferences WHERE slug = $1`,
      [slug],
    ),
    pool.query(
      `SELECT ${ADMIN_EDITION_COLS}
         FROM conference_editions e
        WHERE e.conference_id = (SELECT id FROM conferences WHERE slug = $1)
        ${ADMIN_EDITION_ORDER}`,
      [slug],
    ),
  ]);
  if (confRes.rows.length === 0) return null;
  return mapAdminConf(
    confRes.rows[0] as AdminConfRow,
    (edRes.rows as AdminEditionRow[]).map(mapAdminEdition),
  );
}

export interface ConferenceInput {
  nom: string;
  type: "conference" | "asso";
  ville: string | null;
  pays: string | null;
  siteUrl: string | null;
}

/**
 * Crée ou met à jour une conférence (clé : slug dérivé du nom). Les métadonnées
 * sont réécrites (c'est le geste orga) ; le nom reste celui saisi.
 */
export async function saveConference(c: ConferenceInput): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO conferences (slug, nom, type, ville, pays, site_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug) DO UPDATE SET
       nom = EXCLUDED.nom, type = EXCLUDED.type, ville = EXCLUDED.ville,
       pays = EXCLUDED.pays, site_url = EXCLUDED.site_url
     RETURNING id`,
    [slugifyConference(c.nom), c.nom, c.type, c.ville, c.pays, c.siteUrl],
  );
  return (rows[0] as { id: number }).id;
}

export type CreateConferenceResult =
  | { ok: true; slug: string }
  | { ok: false; raison: "deja_referencee" };

/**
 * Crée une conférence — INSERT SEUL (jamais d'upsert) : le geste « ajouter » ne
 * doit pas écraser en silence une conférence déjà curée dont le slug coïncide
 * (ex. un doublon involontaire remettrait ville/site à NULL). Un slug déjà pris
 * = erreur douce (l'orga la corrige via sa page). Atomique (DO NOTHING).
 */
export async function createConference(c: ConferenceInput): Promise<CreateConferenceResult> {
  const slug = slugifyConference(c.nom);
  const { rows } = await pool.query(
    `INSERT INTO conferences (slug, nom, type, ville, pays, site_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug) DO NOTHING
     RETURNING slug`,
    [slug, c.nom, c.type, c.ville, c.pays, c.siteUrl],
  );
  return rows.length > 0
    ? { ok: true, slug }
    : { ok: false, raison: "deja_referencee" };
}

export type UpdateConferenceResult =
  | { ok: true }
  | { ok: false; raison: "deja_referencee" };

/**
 * Met à jour une conférence PAR SON ID (geste orga) : corrige le nom, le type
 * et les métadonnées. Le slug est redérivé du nom (renommage autorisé) ; s'il
 * entre en collision avec une autre conférence, erreur douce plutôt que 500.
 */
export async function updateConference(
  id: number,
  c: ConferenceInput,
): Promise<UpdateConferenceResult> {
  try {
    await pool.query(
      `UPDATE conferences
          SET slug = $1, nom = $2, type = $3, ville = $4, pays = $5, site_url = $6
        WHERE id = $7`,
      [slugifyConference(c.nom), c.nom, c.type, c.ville, c.pays, c.siteUrl, id],
    );
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, raison: "deja_referencee" };
    }
    throw err;
  }
}

export type DeleteConferenceResult =
  | { ok: true; nom: string }
  | { ok: false; raison: "a_des_editions" | "introuvable" };

/**
 * Supprime une conférence (geste orga) — UNIQUEMENT si elle n'a aucun événement
 * rattaché. Une édition/meetup peut être moissonnée ou reliée à des talks /
 * tremplins (FK ON DELETE RESTRICT) : on refuse alors la suppression en clair
 * plutôt que de lever une erreur FK. Suppression atomique (garde NOT EXISTS)
 * pour éviter toute course entre la vérification et l'effacement.
 */
export async function deleteConference(id: number): Promise<DeleteConferenceResult> {
  const res = await pool.query(
    `DELETE FROM conferences c
      WHERE c.id = $1
        AND NOT EXISTS (
          SELECT 1 FROM conference_editions e WHERE e.conference_id = c.id
        )
      RETURNING c.nom`,
    [id],
  );
  if ((res.rowCount ?? 0) > 0) {
    return { ok: true, nom: (res.rows[0] as { nom: string }).nom };
  }
  // 0 ligne : soit la conf a des éditions, soit elle n'existe pas — on distingue
  // pour un message juste.
  const { rows } = await pool.query(`SELECT 1 FROM conferences WHERE id = $1`, [id]);
  return rows.length > 0
    ? { ok: false, raison: "a_des_editions" }
    : { ok: false, raison: "introuvable" };
}

export interface EditionInput {
  conferenceId: number;
  annee: number | null;
  dateDebut: string | null;
  /** Dernier jour (NULL = un seul jour) : borne ce que l'édition lègue à la
   *  date d'un talk (`dateLegueeParEdition`). */
  dateFin: string | null;
  ville: string | null;
  lieu: string | null;
  url: string | null;
  /** Id d'endpoint Sessionize ; null = événement connu, non moissonné. */
  endpoint: string | null;
  /** Membre à créditer (ajout communautaire) ; null pour un geste orga. */
  proposePar?: number | null;
  /** Active la moisson à la création (après test d'endpoint). */
  actif?: boolean;
  /**
   * "upsert" (défaut, geste ORGA) : corrige une édition existante de la même
   * (conférence, année). "insert" (chemin MEMBRE) : ne touche JAMAIS une
   * édition existante — sinon toute membre pourrait écraser/détourner la
   * config de moisson curée par l'orga (endpoint, url, activation).
   */
  mode?: "upsert" | "insert";
}

/** Une édition (admin) + l'identité de sa conférence, pour sa page éditable. */
export interface AdminEditionDetail extends AdminEdition {
  conferenceId: number;
  confNom: string;
  confSlug: string;
}
export async function getEditionByIdForAdmin(
  editionId: number,
): Promise<AdminEditionDetail | null> {
  const { rows } = await pool.query(
    `SELECT ${ADMIN_EDITION_COLS}, e.conference_id,
            c.nom AS conf_nom, c.slug AS conf_slug
       FROM conference_editions e
       JOIN conferences c ON c.id = e.conference_id
      WHERE e.id = $1`,
    [editionId],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as AdminEditionRow & {
    conference_id: number; conf_nom: string; conf_slug: string;
  };
  return {
    ...mapAdminEdition(r),
    conferenceId: r.conference_id,
    confNom: r.conf_nom,
    confSlug: r.conf_slug,
  };
}

export type SaveEditionResult =
  | { ok: true; id: number }
  | { ok: false; raison: "deja_referencee" };

/**
 * Crée ou met à jour un événement daté. Clé d'upsert : (conference_id, annee)
 * quand l'année est posée. Un endpoint déjà référencé ailleurs (index partiel
 * source+endpoint) est signalé en erreur douce, jamais en 500.
 */
export async function saveEdition(
  e: EditionInput,
  q: Queryable = pool,
): Promise<SaveEditionResult> {
  const source = e.endpoint == null ? null : "sessionize";
  const actif = e.endpoint != null && (e.actif ?? false);
  const conflit =
    e.mode === "insert"
      ? // Chemin membre : une (conférence, année) déjà référencée n'est JAMAIS
        // réécrite (l'orga garde la main sur sa curation) → erreur douce.
        "DO NOTHING"
      : `DO UPDATE SET
         date_debut = EXCLUDED.date_debut, date_fin = EXCLUDED.date_fin,
         ville = EXCLUDED.ville,
         lieu = EXCLUDED.lieu, url = EXCLUDED.url,
         source = EXCLUDED.source, endpoint = EXCLUDED.endpoint,
         actif = EXCLUDED.actif`;
  try {
    const { rows } = await q.query(
      `INSERT INTO conference_editions
         (conference_id, annee, date_debut, date_fin, ville, lieu, url, source,
          endpoint, actif, propose_par)
       VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (conference_id, annee) WHERE annee IS NOT NULL ${conflit}
       RETURNING id`,
      [
        e.conferenceId, e.annee, e.dateDebut, e.dateFin, e.ville, e.lieu, e.url,
        source, e.endpoint, actif, e.proposePar ?? null,
      ],
    );
    if (rows.length === 0) return { ok: false, raison: "deja_referencee" };
    return { ok: true, id: (rows[0] as { id: number }).id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, raison: "deja_referencee" };
    }
    throw err;
  }
}

/**
 * Met à jour UNE édition par son id (page éditable dédiée). Collision de
 * (conférence, année) ou d'endpoint = erreur douce (jamais de 500).
 *
 * `actif` (l'état de moisson) N'est PAS touché ici : il appartient à
 * l'interrupteur dédié (`setEditionActive`, sur la même page). Corriger la
 * ville ou l'URL ne doit jamais relancer une moisson que l'orga a coupée. Seul
 * cas forcé : retirer l'endpoint désactive la moisson (le CHECK l'exige, et il
 * n'y a plus rien à moissonner). `$8::text IS NOT NULL AND actif` lit le NOUVEL
 * endpoint ($8) et l'ANCIEN actif (Postgres évalue les colonnes du SET sur la
 * ligne d'avant mise à jour).
 */
export async function updateEdition(
  editionId: number,
  e: {
    annee: number | null; dateDebut: string | null; dateFin: string | null;
    ville: string | null;
    lieu: string | null; url: string | null; endpoint: string | null;
  },
): Promise<SaveEditionResult> {
  const source = e.endpoint == null ? null : "sessionize";
  try {
    await pool.query(
      `UPDATE conference_editions
          SET annee = $2, date_debut = $3::date, date_fin = $4::date,
              ville = $5, lieu = $6, url = $7,
              source = $8, endpoint = $9, actif = ($9::text IS NOT NULL AND actif)
        WHERE id = $1`,
      [editionId, e.annee, e.dateDebut, e.dateFin, e.ville, e.lieu, e.url, source, e.endpoint],
    );
    return { ok: true, id: editionId };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, raison: "deja_referencee" };
    }
    throw err;
  }
}

/**
 * Supprime UNE édition. Sûr : les talks (`edition_id`) et tremplins
 * (`conference_edition_id`) qui y pointaient passent à NULL (FK ON DELETE SET
 * NULL) ; leur libellé texte survit comme repli.
 */
export async function deleteEdition(editionId: number): Promise<void> {
  await pool.query(`DELETE FROM conference_editions WHERE id = $1`, [editionId]);
}

/**
 * (Dés)active la moisson d'un événement. Activable seulement si un endpoint
 * est posé (le CHECK et le cron s'en portent garants, ceinture ici).
 */
export async function setEditionActive(id: number, actif: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE conference_editions SET actif = $2
      WHERE id = $1 AND (NOT $2 OR endpoint IS NOT NULL)`,
    [id, actif],
  );
  return (rowCount ?? 0) > 0;
}

export interface MemberEditionInput {
  userId: number;
  nomConference: string;
  annee: number | null;
  ville: string | null;
  url: string | null;
  endpoint: string | null;
}

/**
 * Ajout communautaire (« Ta conf n'y est pas ? Ajoute-la ») : la conférence est
 * créée si inconnue (jamais réécrite), l'événement est ACTIF directement quand
 * un endpoint est fourni — les orga sont informées (propose_par), pas
 * sollicitées. L'appelant a déjà validé le format ET testé l'endpoint.
 */
export async function addMemberEdition(
  m: MemberEditionInput,
): Promise<SaveEditionResult> {
  const slug = slugifyConference(m.nomConference);
  await pool.query(
    `INSERT INTO conferences (slug, nom, ville, pays)
     VALUES ($1, $2, $3, 'France')
     ON CONFLICT (slug) DO NOTHING`,
    [slug, m.nomConference, m.ville],
  );
  const { rows } = await pool.query(`SELECT id FROM conferences WHERE slug = $1`, [slug]);
  return saveEdition({
    conferenceId: (rows[0] as { id: number }).id,
    annee: m.annee,
    dateDebut: null,
    dateFin: null,
    ville: m.ville,
    lieu: null,
    url: m.url,
    endpoint: m.endpoint,
    proposePar: m.userId,
    actif: m.endpoint != null,
    // INSERT-only : jamais d'écrasement d'une édition existante (sécurité).
    mode: "insert",
  });
}

export type EndpointTest =
  | { ok: true; sessions: number; speakers: number }
  | { ok: false; erreur: "introuvable" | "invalide" | "trop_de_tests" };

/**
 * Teste un id d'endpoint Sessionize (garde-fou d'adoption : « N sessions, M
 * speakers » ou erreur claire — jamais le corps de la réponse). L'appelant a
 * validé le format (ENDPOINT_REGEX) ; l'hôte sessionize.com est codé en dur
 * dans fetchSessionizeEvent (pas de SSRF).
 */
export async function testSessionizeEndpoint(endpoint: string): Promise<EndpointTest> {
  try {
    const data = await fetchSessionizeEvent(endpoint);
    const sessions = Array.isArray(data.sessions) ? data.sessions.length : 0;
    const speakers = Array.isArray(data.speakers) ? data.speakers.length : 0;
    if (sessions === 0 && speakers === 0 && !Array.isArray(data.sessions)) {
      return { ok: false, erreur: "invalide" };
    }
    return { ok: true, sessions, speakers };
  } catch {
    return { ok: false, erreur: "introuvable" };
  }
}

/**
 * Upserte un meetup en conference_editions (type 'meetup'), rattaché à son
 * asso — créée à la volée si inconnue : le Tech Hub est la source de vérité
 * des communautés toulousaines. Idempotent par meetup_id (DO UPDATE : un
 * meetup déplacé/renommé est corrigé au run suivant). JAMAIS de suppression :
 * un meetup disparu du flux reste en base (des talks peuvent y pointer).
 */
export async function upsertMeetupEdition(m: MeetupCandidate): Promise<void> {
  const slug = slugifyConference(m.groupe);
  // L'asso : créée si absente, jamais réécrite (l'orga peut avoir édité).
  await pool.query(
    `INSERT INTO conferences (slug, nom, type, ville, pays)
     VALUES ($1, $2, 'asso', 'Toulouse', 'France')
     ON CONFLICT (slug) DO NOTHING`,
    [slug, m.groupe],
  );
  await pool.query(
    `INSERT INTO conference_editions
       (conference_id, type, nom, date_debut, lieu, url, meetup_id)
     SELECT c.id, 'meetup', $2, $3::date, $4, $5, $6
       FROM conferences c WHERE c.slug = $1
     ON CONFLICT (meetup_id) DO UPDATE SET
       conference_id = EXCLUDED.conference_id,
       nom = EXCLUDED.nom, date_debut = EXCLUDED.date_debut,
       lieu = EXCLUDED.lieu, url = EXCLUDED.url`,
    [slug, m.titre, m.date, m.lieu, m.url, m.meetupId],
  );
}
