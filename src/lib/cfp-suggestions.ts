// Moissonneur CFP — accès DB : registre d'événements, suggestions, talks importés.
// Règles (docs/faisabilite-import-talks.md, scénario F) :
//   - le moissonneur SUGGÈRE, la speakeuse confirme en un clic ;
//   - une suggestion refusée reste en base → jamais re-suggérée ;
//   - un talk déjà confirmé (source + external_id) est rafraîchi silencieusement.

import { pool } from "@/lib/db";
import type { MatchableProfile } from "@/lib/cfp-import";
import { MODES_MOISSONNABLES } from "@/lib/cfp-consentement";
import { sqlDansListe } from "@/lib/sql-liste";
import { buildEditionLibelle } from "@/lib/conferences";

/**
 * LE filtre de consentement du moissonneur, en liste POSITIVE et en une seule
 * définition pour les cinq requêtes qui le portent. Écrit « tout sauf aucun »,
 * il faisait moissonner — et écrire un e-mail à — une speakeuse dont le mode
 * était illisible (migration 073). Un consentement qu'on ne sait pas lire vaut
 * refus, et la valeur inattendue est désormais refusée par la base elle-même.
 */
const CONSENTEMENT_MOISSONNEUR = sqlDansListe("p.cfp_sync_mode", MODES_MOISSONNABLES);

export interface CfpEvent {
  id: number;
  nom: string;
  source: string;
  endpoint: string;
  url: string | null;
  ville: string | null;
  pays: string | null;
  dateDebut: string | null;
  /** Dernier jour (NULL = un seul jour) : borne ce qu'une session sans date
   *  précise hérite de l'événement (`dateLegueeParEdition`). */
  dateFin: string | null;
}

interface CfpEventRow {
  id: number;
  conf_nom: string;
  type: string;
  edition_nom: string | null;
  annee: number | null;
  source: string;
  endpoint: string;
  url: string | null;
  ville: string | null;
  pays: string | null;
  date_debut: string | null;
  date_fin: string | null;
}

/**
 * Événements à moissonner : les conference_editions actives à endpoint (la
 * référence des conférences, migration 027), PLAFONNÉS (LIMIT) : le cron
 * enchaîne un fetch de 10 s max par événement sous maxDuration=60 — sans
 * plafond, une inflation d'éditions actives (ajouts communautaires compris)
 * ferait tuer le run par Vercel. Contrat CfpEvent PRÉSERVÉ :
 * id = id d'édition, nom = libellé (identique à l'ancien cfp_events.nom — les
 * libellés écrits dans speaker_talks.conference ne bougent pas), ville/pays en
 * fallback édition → conférence. Le libellé est composé par
 * buildEditionLibelle : UN SEUL point de vérité (le même que l'auto-complétion
 * et la revalidation d'edition_id) — pas de recomposition SQL parallèle.
 */
export async function getActiveCfpEvents(): Promise<CfpEvent[]> {
  const { rows } = await pool.query(
    `SELECT e.id, c.nom AS conf_nom, e.type, e.nom AS edition_nom, e.annee,
            e.source, e.endpoint, e.url,
            COALESCE(e.ville, c.ville) AS ville,
            COALESCE(e.pays,  c.pays)  AS pays,
            to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut,
            to_char(e.date_fin, 'YYYY-MM-DD') AS date_fin
       FROM conference_editions e
       JOIN conferences c ON c.id = e.conference_id
      WHERE e.endpoint IS NOT NULL AND e.actif
      ORDER BY e.id
      LIMIT 100`,
  );
  return (rows as CfpEventRow[]).map((r) => ({
    id: r.id,
    nom: buildEditionLibelle({
      confNom: r.conf_nom,
      type: r.type,
      nom: r.edition_nom,
      annee: r.annee,
      dateDebut: r.date_debut,
    }),
    source: r.source,
    endpoint: r.endpoint,
    url: r.url,
    ville: r.ville,
    pays: r.pays,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
  }));
}

/**
 * Profils candidats au matching (consentement : cfp_sync_mode ≠ 'aucun').
 * Jamais d'e-mail ici : le matching se fait par liens et nom uniquement.
 */
export async function getMatchableProfiles(): Promise<MatchableProfile[]> {
  const { rows } = await pool.query(
    `SELECT p.id, u.name, p.linkedin, p.sessionize_url
       FROM speaker_profiles p
       JOIN users u ON u.id = p."userId"
      WHERE ${CONSENTEMENT_MOISSONNEUR}`,
  );
  return (
    rows as { id: number; name: string | null; linkedin: string | null; sessionize_url: string | null }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    linkedin: r.linkedin,
    sessionizeUrl: r.sessionize_url,
  }));
}

/**
 * Cibles e-mail pour la notification « nouveaux talks repérés » : e-mail + nom
 * des profils passés, en respectant le consentement (cfp_sync_mode ≠ 'aucun').
 * L'e-mail sert UNIQUEMENT à l'envoi transactionnel côté serveur — jamais
 * sérialisé vers le client.
 */
export async function getSuggestionEmailTargets(
  profileIds: number[],
): Promise<{ id: number; email: string; name: string | null }[]> {
  if (profileIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT p.id, u.email, u.name
       FROM speaker_profiles p
       JOIN users u ON u.id = p."userId"
      WHERE p.id = ANY($1) AND ${CONSENTEMENT_MOISSONNEUR} AND u.email IS NOT NULL`,
    [profileIds],
  );
  return rows as { id: number; email: string; name: string | null }[];
}

/**
 * Le MÊME profil matchable, lu de façon ciblée (repérage à la demande) :
 * une ligne au lieu de tout l'annuaire opté-in. [] si opt-out ou inconnu.
 */
export async function getMatchableProfileById(
  profileId: number,
): Promise<MatchableProfile[]> {
  const { rows } = await pool.query(
    `SELECT p.id, u.name, p.linkedin, p.sessionize_url
       FROM speaker_profiles p
       JOIN users u ON u.id = p."userId"
      WHERE p.id = $1 AND ${CONSENTEMENT_MOISSONNEUR}`,
    [profileId],
  );
  return (
    rows as { id: number; name: string | null; linkedin: string | null; sessionize_url: string | null }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    linkedin: r.linkedin,
    sessionizeUrl: r.sessionize_url,
  }));
}

export interface SuggestionInput {
  profileId: number;
  eventId: number;
  externalId: string;
  titre: string;
  description: string | null;
  date: string | null;
  conference: string | null;
  ville: string | null;
  pays: string | null;
  lienConf: string | null;
}

/**
 * Insère une suggestion ; si elle existe déjà, ne rafraîchit ses données que
 * si elle est encore « proposee » (une refusée/acceptée n'est jamais réécrite).
 * Retourne true si une ligne a été créée ou mise à jour (no-op → false, pour
 * que le compteur du cron ne gonfle pas sur les suggestions déjà refusées).
 */
export async function upsertSuggestion(s: SuggestionInput): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO talk_suggestions
       (profile_id, event_id, external_id, titre, description, date,
        conference, ville, pays, lien_conf)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (profile_id, event_id, external_id) DO UPDATE SET
       titre = EXCLUDED.titre, description = EXCLUDED.description,
       date = EXCLUDED.date, conference = EXCLUDED.conference,
       ville = EXCLUDED.ville, pays = EXCLUDED.pays,
       lien_conf = EXCLUDED.lien_conf
     WHERE talk_suggestions.statut = 'proposee'`,
    [
      s.profileId,
      s.eventId,
      s.externalId,
      s.titre,
      s.description,
      s.date,
      s.conference,
      s.ville,
      s.pays,
      s.lienConf,
    ],
  );
  return (rowCount ?? 0) > 0;
}

export interface ImportedTalkUpdate {
  titre: string;
  date: string | null;
  conference: string | null;
  ville: string | null;
  pays: string | null;
  lienConf: string | null;
}

/**
 * Rafraîchit un talk déjà importé et confirmé (même source + external_id),
 * SANS jamais écraser une édition de la speakeuse : un champ n'est mis à jour
 * que s'il vaut encore la dernière valeur synchronisée (snapshot conservé dans
 * la suggestion acceptée) et que la nouvelle valeur n'est pas NULL. La
 * description n'est jamais touchée. Retourne false si aucun talk importé ne
 * correspond (→ l'appelant proposera une suggestion).
 */
export async function refreshImportedTalk(
  profileId: number,
  eventId: number,
  source: string,
  externalId: string,
  t: ImportedTalkUpdate,
): Promise<boolean> {
  // Titre : porté par l'IDENTITÉ (speaker_talks), matché via l'occurrence
  // importée (source + external_id). Ne réécrit que si la speakeuse n'a pas
  // touché au titre depuis la dernière synchro (snapshot dans la suggestion).
  await pool.query(
    `UPDATE speaker_talks tk SET
        titre = CASE WHEN tk.titre IS NOT DISTINCT FROM s.titre AND $5::text IS NOT NULL THEN $5 ELSE tk.titre END
       FROM talk_suggestions s, talk_occurrences o
      WHERE o.talk_id = tk.id AND o.speaker_profile_id = $1 AND o.source = $2 AND o.external_id = $3
        AND s.profile_id = $1 AND s.event_id = $4 AND s.external_id = $3
        AND s.statut = 'acceptee'`,
    [profileId, source, externalId, eventId, t.titre],
  );
  // Date / conférence / ville / pays / lien : portés par l'OCCURRENCE.
  // (Le titre est traité au-dessus : le passer ici laisserait un paramètre
  // jamais référencé, que Postgres rejette au Parse.)
  const { rowCount } = await pool.query(
    `UPDATE talk_occurrences o SET
        date       = CASE WHEN o.date       IS NOT DISTINCT FROM s.date       AND $5::text IS NOT NULL THEN $5 ELSE o.date       END,
        conference = CASE WHEN o.conference IS NOT DISTINCT FROM s.conference AND $6::text IS NOT NULL THEN $6 ELSE o.conference END,
        ville      = CASE WHEN o.ville      IS NOT DISTINCT FROM s.ville      AND $7::text IS NOT NULL THEN $7 ELSE o.ville      END,
        pays       = CASE WHEN o.pays       IS NOT DISTINCT FROM s.pays       AND $8::text IS NOT NULL THEN $8 ELSE o.pays       END,
        lien_conf  = CASE WHEN o.lien_conf  IS NOT DISTINCT FROM s.lien_conf  AND $9::text IS NOT NULL THEN $9 ELSE o.lien_conf  END
       FROM talk_suggestions s
      WHERE o.speaker_profile_id = $1 AND o.source = $2 AND o.external_id = $3
        AND s.profile_id = $1 AND s.event_id = $4 AND s.external_id = $3
        AND s.statut = 'acceptee'`,
    [profileId, source, externalId, eventId, t.date, t.conference, t.ville, t.pays, t.lienConf],
  );
  if ((rowCount ?? 0) === 0) return false;

  // Met le snapshot au niveau des valeurs fraîchement synchronisées, pour que
  // la comparaison du prochain run reparte de là.
  await pool.query(
    `UPDATE talk_suggestions SET
        titre = $4, date = $5, conference = $6, ville = $7, pays = $8, lien_conf = $9
      WHERE profile_id = $1 AND event_id = $2 AND external_id = $3 AND statut = 'acceptee'`,
    [profileId, eventId, externalId, t.titre, t.date, t.conference, t.ville, t.pays, t.lienConf],
  );
  return true;
}

export interface PendingSuggestion {
  id: number;
  externalId: string;
  titre: string;
  description: string | null;
  date: string | null;
  conference: string | null;
  ville: string | null;
  pays: string | null;
  lienConf: string | null;
}

/**
 * Suggestions en attente de confirmation, pour l'espace membre. Respecte le
 * consentement (rien d'affiché si la speakeuse a désactivé le moissonnage,
 * même pour des suggestions créées avant la désactivation) et borne
 * l'affichage (protection contre un événement qui inonderait un profil).
 */
/**
 * Nombre de suggestions en attente — pour un badge (« N à confirmer ») sans
 * transférer les lignes. Même filtre de consentement que `getPendingSuggestions`.
 */
export async function getPendingSuggestionsCount(profileId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM talk_suggestions s
       JOIN speaker_profiles p ON p.id = s.profile_id
      WHERE s.profile_id = $1 AND s.statut = 'proposee'
        AND ${CONSENTEMENT_MOISSONNEUR}`,
    [profileId],
  );
  return (rows[0]?.n as number) ?? 0;
}

export async function getPendingSuggestions(
  profileId: number,
): Promise<PendingSuggestion[]> {
  const { rows } = await pool.query(
    `SELECT s.id, s.external_id, s.titre, s.description, s.date, s.conference,
            s.ville, s.pays, s.lien_conf
       FROM talk_suggestions s
       JOIN speaker_profiles p ON p.id = s.profile_id
      WHERE s.profile_id = $1 AND s.statut = 'proposee'
        AND ${CONSENTEMENT_MOISSONNEUR}
      ORDER BY s.date DESC NULLS LAST, s.id
      LIMIT 20`,
    [profileId],
  );
  return (
    rows as {
      id: number;
      external_id: string;
      titre: string;
      description: string | null;
      date: string | null;
      conference: string | null;
      ville: string | null;
      pays: string | null;
      lien_conf: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    externalId: r.external_id,
    titre: r.titre,
    description: r.description,
    date: r.date,
    conference: r.conference,
    ville: r.ville,
    pays: r.pays,
    lienConf: r.lien_conf,
  }));
}

/**
 * La speakeuse confirme une suggestion : marque la suggestion acceptée ET crée
 * le talk (avec source + external_id pour l'idempotence du re-sync) en UNE
 * SEULE requête (CTE) — atomique, pas de fenêtre où le talk existerait sans
 * que la suggestion soit acceptée. Ownership vérifié en SQL (profile_id).
 * Retourne false si la suggestion n'existe pas, n'est pas à elle, ou n'est
 * plus proposée. Doublon impossible : index unique (profile_id, source,
 * external_id).
 */
export async function acceptSuggestion(
  suggestionId: number,
  profileId: number,
): Promise<boolean> {
  const { rows } = await pool.query(
    `WITH s AS (
       UPDATE talk_suggestions SET statut = 'acceptee'
        WHERE id = $1 AND profile_id = $2 AND statut = 'proposee'
        RETURNING profile_id, event_id, external_id, titre, description, date,
                  conference, ville, pays, lien_conf
     ), tk AS (
       -- Identité du talk (source 'manuel' : la provenance moisson vit sur
       -- l'occurrence ; la visibilité publique n'est masquée que pour 'tremplin').
       -- Gardée par NOT EXISTS : si l'occurrence existe déjà (même session
       -- repérée via un autre événement → ON CONFLICT plus bas), on ne crée
       -- PAS d'identité orpheline (un talk fantôme à zéro occurrence).
       INSERT INTO speaker_talks (speaker_profile_id, titre, type, description, source)
       SELECT s.profile_id, s.titre, 'Conférence', s.description, 'manuel'
         FROM s
         JOIN conference_editions e ON e.id = s.event_id
        WHERE NOT EXISTS (
          SELECT 1 FROM talk_occurrences o
           WHERE o.speaker_profile_id = s.profile_id
             AND o.source = COALESCE(e.source, 'sessionize')
             AND o.external_id = s.external_id
        )
       RETURNING id, speaker_profile_id
     ), ins AS (
       -- Une occurrence rattachée au registre (conference_id déduit de l'édition).
       -- COALESCE : source nullable côté édition (endpoint vidé) — jamais de NULL
       -- dans le NOT NULL de talk_occurrences.source. L'idempotence du re-sync
       -- tient sur l'index unique (profil, source, external_id) de l'occurrence.
       INSERT INTO talk_occurrences
         (talk_id, speaker_profile_id, conference_id, edition_id, conference, ville,
          pays, date, lien_conf, source, external_id)
       SELECT tk.id, tk.speaker_profile_id, e.conference_id, s.event_id, s.conference,
              s.ville, s.pays, s.date, s.lien_conf, COALESCE(e.source, 'sessionize'),
              s.external_id
         FROM tk, s
         JOIN conference_editions e ON e.id = s.event_id
       ON CONFLICT (speaker_profile_id, source, external_id) WHERE external_id IS NOT NULL
       DO NOTHING
     )
     SELECT count(*)::int AS accepted FROM s`,
    [suggestionId, profileId],
  );
  return (rows[0] as { accepted: number }).accepted > 0;
}

/** « Ce n'est pas moi » : mémorisé, la suggestion ne réapparaîtra jamais. */
export async function refuseSuggestion(
  suggestionId: number,
  profileId: number,
): Promise<void> {
  await pool.query(
    `UPDATE talk_suggestions SET statut = 'refusee'
      WHERE id = $1 AND profile_id = $2 AND statut = 'proposee'`,
    [suggestionId, profileId],
  );
}
