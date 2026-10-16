import { pool } from "@/lib/db";
import {
  buildEditionLibelle,
  EDITIONS_RECENTES_MOIS,
} from "@/lib/conferences";
import { OCCURRENCE_PUBLIABLE } from "@/lib/occurrence-visibilite";

/**
 * Une occurrence = une fois où le talk a été donné (une conférence datée, avec
 * ses liens propres), rattachée au registre par `conferenceId` ET `editionId`.
 * Un talk sans occurrence = un sujet proposé (pas encore donné).
 */
export interface TalkOccurrence {
  id: number;
  /** FK registre : la conférence (marque) choisie. NULL = mention libre legacy. */
  conferenceId: number | null;
  /**
   * Slug de cette conférence dans le registre (jointure, pas une colonne de
   * l'occurrence) : c'est la clé du logo affiché à côté du nom
   * (`src/data/logos-conferences.ts`). NULL pour une mention libre legacy.
   */
  conferenceSlug: string | null;
  /** FK registre : l'édition datée, quand elle existe. */
  editionId: number | null;
  /** Libellé figé (SNAPSHOT) : affichage + rescapé du ON DELETE SET NULL. */
  conference: string | null;
  ville: string | null;
  /**
   * Géographie exploitable (migration 072). Relue pour que le formulaire la
   * REPOSE telle quelle : l'enregistrement réécrit l'occurrence entière, donc
   * une géographie absente de la lecture serait effacée au premier changement
   * de date. Cf. `OccurrenceInput` pour les raisons de sa nullabilité.
   */
  codeInsee: string | null;
  region: string | null;
  pays: string | null;
  date: string | null;
  lienConf: string | null;
  lienSlides: string | null;
  lienVideo: string | null;
  lienFeedback: string | null;
  /**
   * Proposition de conférence dont dépend cette saisie (migration 068), ou null
   * quand elle pointe le répertoire. Non NULL = la saisie attend l'arbitrage
   * orga et reste hors des affichages publics.
   */
  propositionId: number | null;
  /**
   * État de publication, dérivé de la proposition rattachée :
   * - `publiee` : rattachée au répertoire, visible sur la fiche publique ;
   * - `en_attente` : la conférence proposée attend l'arbitrage ;
   * - `ecartee` : la conférence proposée a été écartée (à re-choisir).
   */
  etat: OccurrenceEtat;
}

export type OccurrenceEtat = "publiee" | "en_attente" | "ecartee";

/** Identité d'un talk (titre, type, résumé) + ses occurrences (récente d'abord). */
export interface Talk {
  id: number;
  profileId: number;
  titre: string;
  type: string;
  description: string | null;
  occurrences: TalkOccurrence[];
}

/** Champs d'identité soumis à la création / édition d'un talk. */
export interface TalkIdentityInput {
  titre: string;
  type: string;
  description: string | null;
}

/** Champs d'une occurrence (une conférence rattachée à un talk). */
export interface OccurrenceInput {
  conferenceId: number | null;
  editionId: number | null;
  /** Proposition en attente dont dépend la saisie (migration 068), ou null. */
  propositionId?: number | null;
  conference: string | null;
  ville: string | null;
  /**
   * Géographie exploitable (migration 072). Toutes deux NULLABLES, et pour de
   * bonnes raisons : la Base Adresse Nationale est un service tiers (une saisie
   * ne doit jamais échouer parce qu'il se tait) et ne couvre que la France
   * (Bruxelles ou Montréal restent une ville en texte). L'absence de valeur EST
   * une information — cf. `lib/lieu-occurrence.ts` pour la règle d'affichage.
   */
  codeInsee: string | null;
  region: string | null;
  pays: string | null;
  date: string | null;
  lienConf: string | null;
  lienSlides: string | null;
  lienVideo: string | null;
  lienFeedback: string | null;
}

interface TalkJoinRow {
  id: number;
  speaker_profile_id: number;
  titre: string;
  type: string;
  description: string | null;
  occ_id: number | null;
  conference_id: number | null;
  conference_slug: string | null;
  edition_id: number | null;
  conference: string | null;
  ville: string | null;
  code_insee: string | null;
  region: string | null;
  pays: string | null;
  date: string | null;
  lien_conf: string | null;
  lien_slides: string | null;
  lien_video: string | null;
  lien_feedback: string | null;
  proposition_id: number | null;
  proposition_statut: string | null;
}

interface OccurrenceRow {
  id: number;
  conference_id: number | null;
  conference_slug: string | null;
  edition_id: number | null;
  conference: string | null;
  ville: string | null;
  code_insee: string | null;
  region: string | null;
  pays: string | null;
  date: string | null;
  lien_conf: string | null;
  lien_slides: string | null;
  lien_video: string | null;
  lien_feedback: string | null;
  proposition_id: number | null;
  proposition_statut: string | null;
}

function mapOccurrence(r: OccurrenceRow): TalkOccurrence {
  return {
    id: r.id,
    conferenceId: r.conference_id,
    conferenceSlug: r.conference_slug,
    editionId: r.edition_id,
    conference: r.conference,
    ville: r.ville,
    codeInsee: r.code_insee,
    region: r.region,
    pays: r.pays,
    date: r.date,
    lienConf: r.lien_conf,
    lienSlides: r.lien_slides,
    lienVideo: r.lien_video,
    lienFeedback: r.lien_feedback,
    propositionId: r.proposition_id,
    // Une proposition arbitrée « validee » libère l'occurrence (proposition_id
    // remis à NULL) : ici, non NULL ne peut être qu'en attente ou écartée.
    etat:
      r.proposition_id == null
        ? "publiee"
        : r.proposition_statut === "refusee"
          ? "ecartee"
          : "en_attente",
  };
}

/**
 * Colonnes lues pour un talk + ses occurrences (LEFT JOIN, groupées en JS).
 * L'ORDER BY de l'appelant place les occurrences les plus récentes d'abord
 * (affichage type portail : « donné à X, puis Y, puis Z ») ; les talks restent
 * triés par id.
 *
 * `publiques` filtre dans le ON du LEFT JOIN, pas dans le WHERE : un talk dont
 * la SEULE conférence attend l'arbitrage reste affiché (comme un sujet proposé),
 * il perd juste cette ligne. En WHERE, le talk disparaîtrait de la fiche entière.
 */
function talkJoinSelect(publiques: boolean): string {
  // Sur le chemin public, le ON pose déjà `proposition_id IS NULL` : la
  // jointure au statut ne peut PLUS matcher. On ne l'émet donc pas — Postgres,
  // lui, ne peut pas l'élider (sa colonne est dans le SELECT) et paierait une
  // sonde perdue par occurrence, sur une page non cachée.
  const statut = publiques
    ? `NULL::text AS proposition_statut`
    : `cp.statut AS proposition_statut`;
  return `
  SELECT t.id, t.speaker_profile_id, t.titre, t.type, t.description,
         o.id AS occ_id, o.conference_id, c.slug AS conference_slug, o.edition_id,
         o.conference, o.ville, o.code_insee, o.region,
         o.pays, o.date, o.lien_conf, o.lien_slides, o.lien_video, o.lien_feedback,
         o.proposition_id, ${statut}
    FROM speaker_talks t
    LEFT JOIN talk_occurrences o
           ON o.talk_id = t.id${publiques ? ` AND ${OCCURRENCE_PUBLIABLE}` : ""}
    LEFT JOIN conferences c ON c.id = o.conference_id${
      publiques ? "" : `
    LEFT JOIN conference_propositions cp ON cp.id = o.proposition_id`
    }`;
}

const TALK_JOIN_SELECT = talkJoinSelect(false);
const TALK_JOIN_SELECT_PUBLIC = talkJoinSelect(true);

/** Regroupe les lignes du LEFT JOIN en talks (identité) + occurrences ordonnées. */
function groupTalks(rows: TalkJoinRow[]): Talk[] {
  const byId = new Map<number, Talk>();
  const order: number[] = [];
  for (const r of rows) {
    let talk = byId.get(r.id);
    if (!talk) {
      talk = {
        id: r.id,
        profileId: r.speaker_profile_id,
        titre: r.titre,
        type: r.type,
        description: r.description,
        occurrences: [],
      };
      byId.set(r.id, talk);
      order.push(r.id);
    }
    if (r.occ_id != null) talk.occurrences.push(mapOccurrence({ ...r, id: r.occ_id }));
  }
  return order.map((id) => byId.get(id)!);
}

/**
 * Marqueur de provenance des talks issus du backfill du « sujet » Tremplin
 * (migration 033). Ces « propositions » sont **exclues de l'annuaire public**
 * tant que la personne ne les a pas confirmées : elles restent visibles dans son
 * espace et côté orga. Cf. docs/conception-talk-pitche-migration.md.
 */
export const TALK_SOURCE_TREMPLIN = "tremplin";

/**
 * Nombre de talks d'un profil — pour un simple compteur (badge, jauge de
 * complétude) sans transférer toutes les lignes. La vue complète passe par
 * `getTalksByProfileId`.
 */
export async function getTalksCountByProfileId(profileId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM speaker_talks WHERE speaker_profile_id = $1`,
    [profileId],
  );
  return (rows[0]?.n as number) ?? 0;
}

/**
 * Les talks d'un COMPTE réduits à (id, titre), dans l'ordre de la fiche :
 * la feuille ➕ « Ajouter une date à un talk » est montée sur CHAQUE page de
 * l'espace, elle n'a besoin ni des occurrences ni de la jointure complète. Par
 * l'id du compte (pas du profil) : la lecture part en même temps que celle du
 * profil au lieu de l'attendre. Sans fiche, aucune ligne.
 */
export async function getTitresTalks(
  userId: number,
): Promise<{ id: number; titre: string }[]> {
  const { rows } = await pool.query(
    `SELECT t.id, t.titre
       FROM speaker_talks t
       JOIN speaker_profiles p ON p.id = t.speaker_profile_id
      WHERE p."userId" = $1
      ORDER BY t.id`,
    [userId],
  );
  return rows as { id: number; titre: string }[];
}

export async function getTalksByProfileId(profileId: number): Promise<Talk[]> {
  const { rows } = await pool.query(
    `${TALK_JOIN_SELECT}
      WHERE t.speaker_profile_id = $1
      ORDER BY t.id, o.date DESC NULLS LAST, o.id DESC`,
    [profileId],
  );
  return groupTalks(rows as TalkJoinRow[]);
}

/**
 * Talks AFFICHABLES PUBLIQUEMENT sur la fiche annuaire : comme
 * `getTalksByProfileId`, mais SANS les propositions issues du backfill Tremplin
 * (non confirmées) ni les conférences qui attendent l'arbitrage orga
 * (`OCCURRENCE_PUBLIABLE`). À utiliser sur toute page publique ; l'espace perso
 * et l'orga utilisent `getTalksByProfileId` (vue complète).
 */
export async function getPublicTalksByProfileId(profileId: number): Promise<Talk[]> {
  const { rows } = await pool.query(
    `${TALK_JOIN_SELECT_PUBLIC}
      WHERE t.speaker_profile_id = $1 AND (t.source IS NULL OR t.source <> $2)
      ORDER BY t.id, o.date DESC NULLS LAST, o.id DESC`,
    [profileId, TALK_SOURCE_TREMPLIN],
  );
  return groupTalks(rows as TalkJoinRow[]);
}

/**
 * Ce talk est-il bien à ce profil ? Sonde de PRÉSENCE, pas de lecture : une
 * garde d'autorisation n'a besoin que d'un oui/non, et `getTalkById` la paierait
 * d'une jointure à quatre tables plus la construction de tout l'objet `Talk`,
 * jeté aussitôt.
 */
export async function talkAppartientAuProfil(
  talkId: number,
  profileId: number,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM speaker_talks WHERE id = $1 AND speaker_profile_id = $2`,
    [talkId, profileId],
  );
  return rows.length > 0;
}

/** Récupère un talk par id en vérifiant qu'il appartient au profil (ownership). */
export async function getTalkById(
  talkId: number,
  profileId: number,
): Promise<Talk | null> {
  const { rows } = await pool.query(
    `${TALK_JOIN_SELECT}
      WHERE t.id = $1 AND t.speaker_profile_id = $2
      ORDER BY o.date DESC NULLS LAST, o.id DESC`,
    [talkId, profileId],
  );
  const talks = groupTalks(rows as TalkJoinRow[]);
  return talks.length > 0 ? talks[0] : null;
}

/**
 * Une écriture sur les talks EST un mouvement de la fiche. `speaker_profiles
 * .updated_at` répond à la question « quand cette fiche a-t-elle bougé pour la
 * dernière fois ? », et deux rappels par e-mail s'appuient dessus : le rappel
 * semestriel des fiches publiées, et la relance des brouillons en sommeil
 * (`docs/conception-relance-brouillons.md`). Sans ce coup de pouce, quelqu'un
 * qui ajoute des talks toutes les semaines sans toucher à son profil serait
 * déclaré endormi, puis relancé pour de l'activité qu'il a déjà eue.
 *
 * Appelé APRÈS une écriture qui a réellement porté (ownership vérifié dans le
 * `WHERE`) : une tentative sur le talk de quelqu'un d'autre ne réveille rien.
 */
async function toucherFiche(profileId: number): Promise<void> {
  await pool.query(`UPDATE speaker_profiles SET updated_at = now() WHERE id = $1`, [
    profileId,
  ]);
}

/**
 * Ajoute un talk (IDENTITÉ seule) au profil et renvoie son id. Les conférences
 * (occurrences) se rattachent ensuite via `addOccurrence`. Un talk fraîchement
 * créé est donc un « sujet proposé » tant qu'aucune conférence n'est rattachée.
 */
export async function addTalk(profileId: number, t: TalkIdentityInput): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO speaker_talks (speaker_profile_id, titre, type, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [profileId, t.titre, t.type, t.description],
  );
  await toucherFiche(profileId);
  return (rows[0] as { id: number }).id;
}

/** Met à jour l'identité d'un talk (ownership vérifié). */
export async function updateTalk(
  talkId: number,
  profileId: number,
  t: TalkIdentityInput,
): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE speaker_talks SET titre = $3, type = $4, description = $5
      WHERE id = $1 AND speaker_profile_id = $2`,
    [talkId, profileId, t.titre, t.type, t.description],
  );
  if (rowCount) await toucherFiche(profileId);
}

/** Supprime un talk (ownership vérifié) ; ses occurrences partent en cascade. */
export async function deleteTalk(talkId: number, profileId: number): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM speaker_talks WHERE id = $1 AND speaker_profile_id = $2`,
    [talkId, profileId],
  );
  if (rowCount) await toucherFiche(profileId);
}

/**
 * Rattache une conférence (occurrence) à un talk. Ownership vérifié par
 * l'INSERT…SELECT : rien n'est inséré si le talk n'appartient pas au profil, et
 * `speaker_profile_id` est TOUJOURS celui du talk parent (jamais le client).
 * Renvoie l'id de l'occurrence, ou null si le talk n'est pas au profil.
 */
export async function addOccurrence(
  talkId: number,
  profileId: number,
  o: OccurrenceInput,
): Promise<number | null> {
  const { rows } = await pool.query(
    `INSERT INTO talk_occurrences
       (talk_id, speaker_profile_id, conference_id, edition_id, conference, ville,
        code_insee, region, pays, date, lien_conf, lien_slides, lien_video,
        lien_feedback, proposition_id)
     SELECT t.id, t.speaker_profile_id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15::int
       FROM speaker_talks t
      WHERE t.id = $1 AND t.speaker_profile_id = $2
     RETURNING id`,
    [
      talkId,
      profileId,
      o.conferenceId,
      o.editionId,
      o.conference,
      o.ville,
      o.codeInsee,
      o.region,
      o.pays,
      o.date,
      o.lienConf,
      o.lienSlides,
      o.lienVideo,
      o.lienFeedback,
      o.propositionId ?? null,
    ],
  );
  if (rows.length === 0) return null;
  await toucherFiche(profileId);
  return (rows[0] as { id: number }).id;
}

/** Met à jour une occurrence (ownership via `speaker_profile_id` dénormalisé). */
export async function updateOccurrence(
  occurrenceId: number,
  profileId: number,
  o: OccurrenceInput,
): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE talk_occurrences SET
        conference_id = $3, edition_id = $4, conference = $5, ville = $6,
        code_insee = $7, region = $8, pays = $9,
        date = $10, lien_conf = $11, lien_slides = $12, lien_video = $13,
        lien_feedback = $14, proposition_id = $15::int
      WHERE id = $1 AND speaker_profile_id = $2`,
    [
      occurrenceId,
      profileId,
      o.conferenceId,
      o.editionId,
      o.conference,
      o.ville,
      o.codeInsee,
      o.region,
      o.pays,
      o.date,
      o.lienConf,
      o.lienSlides,
      o.lienVideo,
      o.lienFeedback,
      o.propositionId ?? null,
    ],
  );
  if (rowCount) await toucherFiche(profileId);
}

/** Retire une occurrence (ownership vérifié). Le talk peut redevenir un sujet. */
export async function removeOccurrence(
  occurrenceId: number,
  profileId: number,
): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM talk_occurrences WHERE id = $1 AND speaker_profile_id = $2`,
    [occurrenceId, profileId],
  );
  if (rowCount) await toucherFiche(profileId);
}

/** Récupère une occurrence par id (ownership) — préremplissage du formulaire. */
export async function getOccurrenceById(
  occurrenceId: number,
  profileId: number,
): Promise<TalkOccurrence | null> {
  const { rows } = await pool.query(
    `SELECT o.id, o.conference_id, c.slug AS conference_slug, o.edition_id,
            o.conference, o.ville, o.code_insee, o.region, o.pays, o.date,
            o.lien_conf, o.lien_slides, o.lien_video, o.lien_feedback,
            o.proposition_id, cp.statut AS proposition_statut
       FROM talk_occurrences o
       LEFT JOIN conferences c ON c.id = o.conference_id
       LEFT JOIN conference_propositions cp ON cp.id = o.proposition_id
      WHERE o.id = $1 AND o.speaker_profile_id = $2`,
    [occurrenceId, profileId],
  );
  return rows.length > 0 ? mapOccurrence(rows[0] as OccurrenceRow) : null;
}

/**
 * Texte agrégé des talks par profil (titre + description), pour la recherche
 * plein-texte du site : permet de retrouver une speakeuse via le contenu de
 * ses talks, même s'il n'est pas affiché sur la carte de l'annuaire.
 */
export async function getPublicTalkTextByProfile(): Promise<Map<number, string>> {
  const { rows } = await pool.query(
    `SELECT speaker_profile_id AS profile_id,
            string_agg(coalesce(titre, '') || ' ' || coalesce(description, ''), ' ') AS txt
       FROM speaker_talks
      WHERE source IS DISTINCT FROM $1
      GROUP BY speaker_profile_id`,
    [TALK_SOURCE_TREMPLIN],
  );
  return new Map(
    (rows as { profile_id: number; txt: string }[]).map((r) => [r.profile_id, r.txt]),
  );
}

/** Aperçu d'un talk pour la carte de l'annuaire : titre + type seulement.
 *  (La description reste sur la fiche ; la carte met en avant les titres.) */
export interface PublicTalkPreview {
  titre: string;
  type: string;
}

/**
 * Titres de talks PUBLICS par profil (titre + type), pour les afficher sur la
 * carte de l'annuaire : le titre d'un talk vend mieux qu'un tag de taxonomie.
 * Exclut les propositions issues du backfill Tremplin (non confirmées), comme
 * la vue publique de la fiche. Ordre stable par id (ordre de saisie). Un talk =
 * une ligne (l'identité), donc plus de titre dupliqué par occurrence.
 */
export async function getPublicTalkTitlesByProfile(): Promise<
  Map<number, PublicTalkPreview[]>
> {
  const { rows } = await pool.query(
    `SELECT speaker_profile_id AS profile_id, titre, type
       FROM speaker_talks
      WHERE source IS DISTINCT FROM $1
        AND titre IS NOT NULL AND titre <> ''
      ORDER BY speaker_profile_id, id`,
    [TALK_SOURCE_TREMPLIN],
  );
  const map = new Map<number, PublicTalkPreview[]>();
  for (const r of rows as { profile_id: number; titre: string; type: string }[]) {
    const list = map.get(r.profile_id);
    const preview = { titre: r.titre, type: r.type };
    if (list) list.push(preview);
    else map.set(r.profile_id, [preview]);
  }
  return map;
}

// ─── Registre des conférences (sélecteur conf → édition du formulaire d'occurrence) ───

/** Un événement connu de la référence, choisissable au formulaire d'occurrence. */
export interface KnownEdition {
  editionId: number;
  /** Conférence (marque) dont dépend cette édition — forcée côté serveur. */
  conferenceId: number;
  /** Libellé exact (buildEditionLibelle) : c'est LUI que le serveur revérifie. */
  libelle: string;
  ville: string | null;
  pays: string | null;
  url: string | null;
  dateDebut: string | null;
  /** Dernier jour de l'édition (NULL = un seul jour) : borne ce que la date
   *  d'une occurrence peut HÉRITER (`dateLegueeParEdition`). */
  dateFin: string | null;
}

interface KnownRow {
  edition_id: number;
  conference_id: number;
  conf_nom: string;
  type: string;
  nom: string | null;
  annee: number | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  pays: string | null;
  url: string | null;
}

const KNOWN_SELECT = `
  SELECT e.id AS edition_id, e.conference_id, c.nom AS conf_nom, e.type, e.nom, e.annee,
         to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut,
         to_char(e.date_fin, 'YYYY-MM-DD') AS date_fin,
         COALESCE(e.ville, c.ville) AS ville,
         COALESCE(e.pays,  c.pays)  AS pays,
         COALESCE(e.url,  c.site_url) AS url
    FROM conference_editions e
    JOIN conferences c ON c.id = e.conference_id`;

function mapKnown(r: KnownRow): KnownEdition {
  return {
    editionId: r.edition_id,
    conferenceId: r.conference_id,
    libelle: buildEditionLibelle({
      confNom: r.conf_nom,
      type: r.type,
      nom: r.nom,
      annee: r.annee,
      dateDebut: r.date_debut,
    }),
    ville: r.ville,
    pays: r.pays,
    url: r.url,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
  };
}

/**
 * Le répertoire réduit à ce que le RAPPROCHEMENT d'un import consomme :
 * (slug, éditions datées) — pas les libellés ni les lieux, que
 * `getOccurrenceSuggestions` sert déjà au formulaire. Toutes les éditions,
 * sans borne de récence : un import couvre le passé lointain.
 */
export async function getRegistreIndex(): Promise<
  Array<{
    id: number;
    nom: string;
    slug: string;
    editions: Array<{ id: number; annee: number | null; dateDebut: string | null; dateFin: string | null }>;
  }>
> {
  const { rows } = await pool.query(
    `SELECT c.id, c.nom, c.slug, e.id AS edition_id, e.annee,
            to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut,
            to_char(e.date_fin, 'YYYY-MM-DD') AS date_fin
       FROM conferences c
       LEFT JOIN conference_editions e
              ON e.conference_id = c.id AND e.type = 'edition'
      ORDER BY c.nom, e.annee`,
  );
  const parId = new Map<
    number,
    {
      id: number; nom: string; slug: string;
      editions: Array<{ id: number; annee: number | null; dateDebut: string | null; dateFin: string | null }>;
    }
  >();
  for (const r of rows as Array<{
    id: number; nom: string; slug: string; edition_id: number | null;
    annee: number | null; date_debut: string | null; date_fin: string | null;
  }>) {
    let conf = parId.get(r.id);
    if (!conf) {
      conf = { id: r.id, nom: r.nom, slug: r.slug, editions: [] };
      parId.set(r.id, conf);
    }
    if (r.edition_id != null)
      conf.editions.push({ id: r.edition_id, annee: r.annee, dateDebut: r.date_debut, dateFin: r.date_fin });
  }
  return [...parId.values()];
}

/**
 * Récupère un événement connu par id — la REVALIDATION serveur d'un `editionId`
 * soumis par le client (champ caché falsifiable) : l'action en déduit la
 * conférence réelle et refuse une édition qui n'existe pas.
 */
export async function getKnownEditionById(id: number): Promise<KnownEdition | null> {
  const { rows } = await pool.query(`${KNOWN_SELECT} WHERE e.id = $1`, [id]);
  return rows.length > 0 ? mapKnown(rows[0] as KnownRow) : null;
}

/** Une conférence du registre par id — revalidation serveur d'un `conferenceId`
 * soumis (champ caché) et dérivation du libellé figé + du lieu par défaut. */
export async function getRegistryConferenceById(
  id: number,
): Promise<{ id: number; nom: string; ville: string | null; pays: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, nom, ville, pays FROM conferences WHERE id = $1`,
    [id],
  );
  return rows.length > 0
    ? (rows[0] as { id: number; nom: string; ville: string | null; pays: string | null })
    : null;
}

/** Une conférence du registre + ses éditions récentes, pour le sélecteur. */
export interface RegistreConf {
  id: number;
  nom: string;
  ville: string | null;
  pays: string | null;
  editions: KnownEdition[];
}

/** Données du formulaire d'occurrence : registre (conf → éditions) + auto-complétion lieu. */
export interface OccurrenceSuggestions {
  registre: RegistreConf[];
  villes: string[];
  pays: string[];
}

/**
 * Registre pour le formulaire d'occurrence : toutes les conférences (une conf
 * est proposée MÊME sans édition — le seed n'en crée pas), avec leurs éditions
 * datées récentes regroupées, plus les villes/pays déjà saisis (auto-complétion
 * des champs lieu). Une conférence MANQUANTE se saisit par son nom dans le
 * formulaire (migration 068) : elle part en proposition et la saisie attend
 * l'arbitrage, au lieu d'être refusée.
 */
export async function getOccurrenceSuggestions(): Promise<OccurrenceSuggestions> {
  // Lookup constant (pas d'interpolation directe du paramètre) : le nom de
  // colonne inséré dans le SQL ne peut être qu'une de ces deux valeurs sûres.
  const DISTINCT_SQL = {
    ville: `SELECT DISTINCT ville AS v FROM talk_occurrences WHERE ville IS NOT NULL AND ville <> '' ORDER BY v`,
    pays: `SELECT DISTINCT pays AS v FROM talk_occurrences WHERE pays IS NOT NULL AND pays <> '' ORDER BY v`,
  } as const;
  const distinct = async (col: keyof typeof DISTINCT_SQL) => {
    const { rows } = await pool.query(DISTINCT_SQL[col]);
    return (rows as { v: string }[]).map((r) => r.v);
  };
  const [confRows, editionRows, villes, pays] = await Promise.all([
    pool.query(`SELECT id, nom, ville, pays FROM conferences ORDER BY nom`),
    pool.query(
      `${KNOWN_SELECT}
   WHERE e.date_debut IS NULL
      OR e.date_debut >= (now() - make_interval(months => ${EDITIONS_RECENTES_MOIS}))::date
   ORDER BY e.date_debut DESC NULLS LAST, e.id DESC
   LIMIT 500`,
    ),
    distinct("ville"),
    distinct("pays"),
  ]);
  const editionsByConf = new Map<number, KnownEdition[]>();
  for (const r of editionRows.rows as KnownRow[]) {
    const list = editionsByConf.get(r.conference_id);
    const known = mapKnown(r);
    if (list) list.push(known);
    else editionsByConf.set(r.conference_id, [known]);
  }
  const registre: RegistreConf[] = (
    confRows.rows as { id: number; nom: string; ville: string | null; pays: string | null }[]
  ).map((c) => ({
    id: c.id,
    nom: c.nom,
    ville: c.ville,
    pays: c.pays,
    editions: editionsByConf.get(c.id) ?? [],
  }));
  return { registre, villes, pays };
}
