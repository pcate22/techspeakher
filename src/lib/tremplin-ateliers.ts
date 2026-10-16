import { pool, withTransaction, type Queryable } from "@/lib/db";
import { siSchemaEnRetard, siTableAbsente } from "@/lib/pg-errors";
import { indexerListes } from "@/lib/groupement";
import {
  MEMBERSHIP_PHASE_LABEL,
  MEMBERSHIP_PHASES,
  isMembershipPhase,
  type MembershipPhase,
} from "@/lib/tremplin-phases";
import {
  DEFAULT_AUDIENCE,
  programmePublicParDefaut,
  type AudienceAtelier,
} from "@/lib/atelier-audience";

/**
 * Phase d'un atelier — LE MÊME type que la phase d'appartenance d'une
 * inscription (`MembershipPhase`), et pas une copie : un atelier « préparation
 * à la conférence » s'adresse aux inscrites de cette même phase, c'est un seul
 * domaine. L'audience « les participantes de sa phase » s'appuie exactement sur
 * cette égalité (cf. `src/lib/atelier-audience.ts`). La finale n'a pas
 * d'atelier, donc pas de phase 2 ici.
 */
export type PhaseAtelier = MembershipPhase;

/** Phase par défaut d'un atelier. À GARDER EN PHASE avec le `DEFAULT` de la
 * colonne `phase` (db/schema.sql, db/sync-to-latest.sql) : source unique côté
 * code, plutôt qu'un littéral disséminé. */
export const DEFAULT_PHASE_ATELIER: PhaseAtelier = "cfp_et_pitch";

export const isPhaseAtelier = isMembershipPhase;

/**
 * Nom d'une phase — LES MÊMES MOTS que côté inscription (`tremplin-phases.ts`),
 * ré-exportés ici pour les appelants qui parlent d'ateliers.
 *
 * Elle s'appelait « Avant la soirée » / « Après la soirée ». Un repère de
 * calendrier, alors que la phase est une propriété du PROGRAMME : on conçoit la
 * cadence d'une préparation bien avant d'en connaître les dates. Le nom du
 * calendrier laissait croire que la date décidait de la phase, et deux tables
 * de libellés pour un même objet finissent toujours par diverger — c'est le nom
 * du calendrier qui était faux, il est parti.
 */
export const PHASE_ATELIER_LABEL: Record<PhaseAtelier, string> = MEMBERSHIP_PHASE_LABEL;

/** Les deux temps du parcours, dans l'ordre. */
export const PHASES_ATELIER: readonly PhaseAtelier[] = MEMBERSHIP_PHASES;

/**
 * Le PROGRAMME : les séances de chaque phase, dans leur ordre — et pas dans
 * celui des dates. C'est ainsi que l'orga le conçoit (« on a surtout un ordre
 * d'atelier dans une phase de préparation »), donc une séance non datée garde
 * son rang au lieu de tomber dans un tas « à dater ».
 *
 * Les deux phases sont TOUJOURS rendues, même vides : le parcours a deux temps,
 * et une phase absente de l'écran est une phase qu'on oublie de remplir.
 */
export function ordonnerParPhase<T extends { id: number; phase: PhaseAtelier; ordre: number }>(
  ateliers: readonly T[],
): { phase: PhaseAtelier; ateliers: T[] }[] {
  return PHASES_ATELIER.map((phase) => ({
    phase,
    ateliers: ateliers
      .filter((a) => a.phase === phase)
      // Départage STABLE par id : deux séances au même rang gardent un ordre
      // déterminé, sinon l'écran change à chaque rafraîchissement.
      .sort((x, y) => x.ordre - y.ordre || x.id - y.id),
  }));
}

/** Sens d'un déplacement dans le programme. */
export type SensDeplacement = "haut" | "bas";

export function estSensDeplacement(v: unknown): v is SensDeplacement {
  return v === "haut" || v === "bas";
}

/**
 * La séance avec laquelle échanger pour monter (ou descendre) d'un rang, ou
 * `null` en bout de phase.
 *
 * Le voisinage est BORNÉ À LA PHASE : « descendre » la dernière séance du CFP
 * ne doit pas la faire glisser dans la préparation à la conférence. Changer de
 * phase est un autre geste, qui a son propre écran.
 */
export function voisinDansLaPhase<
  T extends { id: number; phase: PhaseAtelier; ordre: number },
>(ateliers: readonly T[], atelierId: number, sens: SensDeplacement): T | null {
  const cible = ateliers.find((a) => a.id === atelierId);
  if (!cible) return null;
  const dansLaPhase =
    ordonnerParPhase(ateliers).find((g) => g.phase === cible.phase)?.ateliers ?? [];
  const i = dansLaPhase.findIndex((a) => a.id === atelierId);
  const j = sens === "haut" ? i - 1 : i + 1;
  return dansLaPhase[j] ?? null;
}

/**
 * Nature d'un atelier (cf. docs/conception-sous-groupes-ateliers.md) :
 * - `collectif` : rendez-vous partagé, on pointe la présence (existant).
 * - `sous_groupes` : activité en sous-groupes autonomes (revue croisée en duo,
 *   point individuel avec la coach), on suit la réalisation par sous-groupe.
 */
export type NatureAtelier = "collectif" | "sous_groupes";

/** Nature par défaut (à GARDER EN PHASE avec le `DEFAULT` SQL de `nature`). */
export const DEFAULT_NATURE_ATELIER: NatureAtelier = "collectif";

export function isNatureAtelier(v: unknown): v is NatureAtelier {
  return v === "collectif" || v === "sous_groupes";
}

/** Libellé EXPLICATIF : le choix dans un formulaire (on décide en lisant). */
export const NATURE_ATELIER_LABEL: Record<NatureAtelier, string> = {
  collectif: "Rendez-vous collectif (présences)",
  sous_groupes: "En sous-groupes (revue croisée, points individuels)",
};

/** Libellé COURT : en ligne, dans un en-tête ou une pastille (on situe d'un
 * coup d'œil). Deux registres, deux constantes — pas de parenthèses imbriquées
 * dans une phrase. */
export const NATURE_ATELIER_COURT: Record<NatureAtelier, string> = {
  collectif: "Rendez-vous collectif",
  sous_groupes: "En sous-groupes",
};

/**
 * Cohérence date ↔ phase, relative à la finale : un atelier « avant la soirée »
 * ne peut pas être daté APRÈS la finale, ni un « après » AVANT. Permis (true)
 * si une des dates manque (on ne contraint pas). Dates ISO AAAA-MM-JJ (comparaison
 * lexicographique = chronologique).
 */
export function phaseDateCoherente(
  phase: PhaseAtelier,
  date: string | null,
  finaleDate: string | null,
): boolean {
  if (!date || !finaleDate) return true;
  return phase === "cfp_et_pitch" ? date <= finaleDate : date >= finaleDate;
}

export interface Atelier {
  id: number;
  editionId: number;
  ordre: number;
  titre: string;
  /** Date unique OU début de fenêtre (si `dateFin`). */
  date: string | null;
  /** Fin de fenêtre (revue croisée « à faire entre le … et le … ») ; null = date unique. */
  dateFin: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  description: string | null;
  /** Lieu physique (présentiel) ; avec `lienVisio` → hybride. */
  lieu: string | null;
  lienVisio: string | null;
  /** Coachs/animatrices (texte libre, une ou plusieurs). */
  coachs: string | null;
  phase: PhaseAtelier;
  /** Collectif (présence) ou en sous-groupes (réalisation). */
  nature: NatureAtelier;
  /** QUI voit l'atelier — un choix EXCLUSIF (cf. `src/lib/atelier-audience.ts`).
   * Seule source : la liste nominative n'élargit plus rien. */
  audience: AudienceAtelier;
  /** CE QUE LE SITE PUBLIC ANNONCE : nom, dates et description (jamais le
   * lieu). Réglage explicite, initialisé depuis l'audience à la création puis
   * indépendant — deux questions, deux réponses. */
  auProgrammePublic: boolean;
}

export interface AtelierInput {
  ordre: number;
  titre: string;
  date: string | null;
  /** Fin de fenêtre (opt.) ; absent/null = date unique. */
  dateFin?: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  description: string | null;
  /** Lieu physique (opt.). */
  lieu?: string | null;
  lienVisio: string | null;
  coachs?: string | null;
  /** Audience : absente → `selection` (vide), donc visible de l'orga seule.
   * Un atelier neuf ne s'ouvre à personne tant qu'on ne l'a pas dit. */
  audience?: AudienceAtelier;
  /** Phase (avant / après la soirée). Absent → défaut `cfp_et_pitch` (la
   * plupart des créations partent en phase 1 ; la duplication conserve celle
   * de l'atelier source). */
  phase?: PhaseAtelier;
  /** Nature (collectif / sous-groupes). Absent → défaut `collectif`. */
  nature?: NatureAtelier;
  /** Visible sur le site public. Absent → dérivé de l'audience (cf.
   * `programmePublicParDefaut`).
   *
   * La DUPLICATION d'une édition ne le transmet pas, volontairement (comme
   * l'audience) : le squelette d'une édition à venir naît hors vitrine, et c'est
   * l'orga qui la publie séance par séance quand le programme est réel. Copier
   * l'état de la source publierait le parcours 2027 le jour de sa création. */
  auProgrammePublic?: boolean;
}

interface AtelierRow {
  id: number;
  edition_id: number;
  ordre: number;
  titre: string;
  date: string | null;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  description: string | null;
  lieu: string | null;
  lien_visio: string | null;
  coachs: string | null;
  phase: PhaseAtelier;
  nature: NatureAtelier;
  audience: AudienceAtelier;
  au_programme_public: boolean;
  ouvert_a_toutes: boolean;
}

/** Postgres renvoie les colonnes TIME en « HH:MM:SS » (pas de type-parser pour
 * TIME, à la différence de DATE) : on ramène à « HH:MM » pour l'affichage ET
 * pour l'input `type="time"` (sinon la fiche renverrait « 12:45:00 », rejeté
 * par la validation HH:MM → ré-enregistrement impossible). */
export const hhmm = (t: string | null): string | null => (t ? t.slice(0, 5) : null);

function mapRow(r: AtelierRow): Atelier {
  return {
    id: r.id,
    editionId: r.edition_id,
    ordre: r.ordre,
    titre: r.titre,
    date: r.date,
    dateFin: r.date_fin,
    heureDebut: hhmm(r.heure_debut),
    heureFin: hhmm(r.heure_fin),
    description: r.description,
    lieu: r.lieu,
    lienVisio: r.lien_visio,
    coachs: r.coachs,
    phase: r.phase,
    nature: r.nature,
    audience: r.audience,
    auProgrammePublic: r.au_programme_public,
  };
}

// DATE renvoyée en chaîne via le type parser global (cf. src/lib/db.ts).
const COLS = `id, edition_id, ordre, titre, date, date_fin, heure_debut, heure_fin,
              description, lieu, lien_visio, coachs, phase, nature, audience,
              au_programme_public, ouvert_a_toutes`;

/** Ateliers d'une édition, dans l'ordre (`ordre` puis date). */
export async function getAteliersByEdition(editionId: number): Promise<Atelier[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_ateliers WHERE edition_id = $1 ORDER BY ordre, date, id`,
    [editionId],
  );
  return (rows as AtelierRow[]).map(mapRow);
}

/**
 * Ordonne des ateliers d'une même phase par date CROISSANTE, pour que la liste
 * admin suive la chronologie qu'annonce la pastille agenda. Les ateliers « à
 * dater » (date absente) viennent APRÈS les datés : rien à situer dans le temps,
 * on les regroupe en fin de phase. Départage STABLE et déterministe par `ordre`
 * puis `id` (deux ateliers à la même date, ou deux « à dater », gardent un ordre
 * reproductible d'un rendu serveur à l'autre). Copie triée : n'altère pas
 * l'entrée. Dates ISO AAAA-MM-JJ → comparaison lexicographique = chronologique.
 *
 * Tri d'AFFICHAGE only : la requête `getAteliersByEdition` garde son `ORDER BY
 * ordre` (le champ `ordre` numérote les étapes de la page publique, on n'y
 * touche pas). On réordonne la vue admin après coup.
 */
export function trierAteliersParDate<
  T extends { date: string | null; ordre: number; id: number },
>(ateliers: readonly T[]): T[] {
  return [...ateliers].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1; // « à dater » après les datés
      if (b.date === null) return -1;
      return a.date < b.date ? -1 : 1; // chronologique
    }
    return a.ordre - b.ordre || a.id - b.id; // même date : ordre stable
  });
}

/** Un atelier, scopé à l'édition (id forgé d'une autre édition → null). */
export async function getAtelierById(
  atelierId: number,
  editionId: number,
): Promise<Atelier | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId],
  );
  return rows.length ? mapRow(rows[0] as AtelierRow) : null;
}

/**
 * Met à jour le lien de connexion (visio) d'un atelier. Scopé à l'édition pour
 * qu'un id forgé ne touche pas l'atelier d'une autre édition. `null` efface le
 * lien. Renvoie `true` si une ligne a été modifiée.
 */
export async function setAtelierVisio(
  atelierId: number,
  editionId: number,
  lienVisio: string | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_ateliers SET lien_visio = $3
      WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId, lienVisio],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Pose l'AUDIENCE d'un atelier — l'un des trois choix exclusifs de
 * `AudienceAtelier`, jamais un booléen : la JSDoc décrivait encore « active ou
 * désactive ouvert à toutes », vocabulaire retiré depuis la migration 051.
 * Scopé à l'édition. Renvoie `true` si une ligne a été modifiée.
 */
export async function setAtelierAudience(
  atelierId: number,
  editionId: number,
  audience: AudienceAtelier,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    // `ouvert_a_toutes` suit en MIROIR (expand/contract : l'ancien code la lit
    // encore le temps de la bascule). Une seule écriture, donc jamais de
    // divergence — c'est `audience` qui décide, la colonne miroir en découle.
    `UPDATE tremplin_ateliers SET audience = $3, ouvert_a_toutes = ($3 = 'toutes')
      WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId, audience],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Échange le rang de deux séances — le geste « monter / descendre » du
 * programme. En TRANSACTION : deux `ordre` qui se croisent, c'est tout ou rien,
 * sinon un incident au milieu laisse deux séances au même rang.
 *
 * Les deux ids sont vérifiés APPARTENIR À L'ÉDITION avant l'écriture : un id
 * forgé d'une autre édition ne peut pas se glisser dans l'échange. Renvoie
 * `false` si l'un des deux n'y est pas.
 */
export async function echangerOrdreAteliers(
  editionId: number,
  a: number,
  b: number,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, ordre FROM tremplin_ateliers
        WHERE edition_id = $1 AND id IN ($2, $3) FOR UPDATE`,
      [editionId, a, b],
    );
    if (rows.length !== 2) return false;
    const [x, y] = rows as { id: number; ordre: number }[];
    await client.query(`UPDATE tremplin_ateliers SET ordre = $2 WHERE id = $1`, [x.id, y.ordre]);
    await client.query(`UPDATE tremplin_ateliers SET ordre = $2 WHERE id = $1`, [y.id, x.ordre]);
    return true;
  });
}

/** Change la phase d'un atelier (avant / après la soirée). Scopé à l'édition.
 * La cohérence date ↔ phase est vérifiée par l'action appelante. */
export async function setAtelierPhase(
  atelierId: number,
  editionId: number,
  phase: PhaseAtelier,
): Promise<boolean> {
  // Le rang suit la phase : la séance se place EN DERNIER de sa nouvelle phase.
  // Sans ça, elle y gardait son ancien numéro et atterrissait au milieu, à une
  // place que personne n'avait choisie. `ordre` reste numéroté à l'échelle de
  // l'édition (un rang global met toujours en dernier dans n'importe quelle
  // phase) : c'est l'ORDRE RELATIF dans la phase qui porte le sens.
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT phase FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2 FOR UPDATE`,
      [atelierId, editionId],
    );
    if (rows.length === 0) return false;
    // Même phase : rien à faire, et surtout pas de renumérotation — elle
    // déplacerait la séance en dernier sur un simple ré-enregistrement du
    // formulaire d'infos, sans que personne l'ait demandé.
    if ((rows[0] as { phase: PhaseAtelier }).phase === phase) return true;
    const { rows: max } = await client.query(
      `SELECT COALESCE(MAX(ordre), 0) + 1 AS suivant FROM tremplin_ateliers WHERE edition_id = $1`,
      [editionId],
    );
    await client.query(
      `UPDATE tremplin_ateliers SET phase = $3, ordre = $4 WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId, phase, Number((max[0] as { suivant: number | string }).suivant)],
    );
    return true;
  });
}

/** Champs de fond d'un atelier (sous-ensemble d'AtelierInput) : titre, date,
 * horaires, description — éditables sur sa fiche. Un `Pick` pour rester aligné
 * sur AtelierInput sans redéfinir (types qui divergeraient sinon). */
export type AtelierInfos = Pick<
  AtelierInput,
  "titre" | "date" | "dateFin" | "heureDebut" | "heureFin" | "lieu" | "description"
>;

/**
 * Met à jour les informations de fond d'un atelier (titre, dates de début/fin,
 * horaires, lieu, description) — éditables sur SA FICHE, plus seulement à la
 * création. Scopé à l'édition (un id forgé d'une autre édition ne touche rien).
 * Le lien visio, la nature et les membres ont leurs propres actions dédiées.
 * Renvoie `true` si modifié.
 */
export async function updateAtelierInfos(
  atelierId: number,
  editionId: number,
  infos: AtelierInfos,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_ateliers
        SET titre = $3, date = $4, date_fin = $5, heure_debut = $6, heure_fin = $7,
            lieu = $8, description = $9
      WHERE id = $1 AND edition_id = $2`,
    [
      atelierId,
      editionId,
      infos.titre,
      infos.date,
      infos.dateFin ?? null,
      infos.heureDebut,
      infos.heureFin,
      infos.lieu ?? null,
      infos.description,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/** Change la nature d'un atelier (collectif / sous-groupes). Scopé à l'édition. */
export async function setAtelierNature(
  atelierId: number,
  editionId: number,
  nature: NatureAtelier,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_ateliers SET nature = $3 WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId, nature],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Ce qu'emporte la suppression d'un atelier, en COMPTES. Sert d'abord à
 * ANNONCER le périmètre avant le clic, et ensuite à choisir le PALIER : un
 * atelier à `total === 0` n'emporte rien en partant (le cas du doublon créé par
 * erreur), il n'y a donc pas de nom à retaper — cf. principes-conception-ui.md
 * §10, « un objet vide redescend d'un palier ».
 *
 * Ce comptage est un GARDE-FOU : il doit échouer FERMÉ. Seule une table absente
 * (migration en attente, 42P01) compte pour 0 ; tout autre incident base
 * (timeout, connexion coupée) remonte. Un `catch` attrape-tout ferait annoncer
 * « il ne porte rien » sur un atelier plein, et surtout ferait retomber le
 * palier 3 sur un simple clic — le contraire d'un filet.
 */
export interface AtelierDeletionCounts {
  nbParticipantes: number;
  nbSousGroupes: number;
  nbSupports: number;
  nbCoachs: number;
  /** Tout ce qui part avec l'atelier, coachs compris. */
  total: number;
}

export async function getAtelierDeletionCounts(
  atelierId: number,
  editionId: number,
): Promise<AtelierDeletionCounts> {
  // Chaque compte est SCOPÉ à l'édition par la jointure : un id forgé d'une
  // autre édition annonce 0, exactement comme le DELETE n'emporterait rien.
  const compter = (table: string): Promise<number> =>
    pool
      .query(
        `SELECT count(*)::int AS n FROM ${table} t
           JOIN tremplin_ateliers a ON a.id = t.atelier_id
          WHERE t.atelier_id = $1 AND a.edition_id = $2`,
        [atelierId, editionId],
      )
      .then((r) => (r.rows[0] as { n: number }).n)
      .catch(siTableAbsente(0));
  const [nbParticipantes, nbSousGroupes, nbSupports, nbCoachs] = await Promise.all([
    compter("tremplin_atelier_membres"),
    compter("tremplin_atelier_sous_groupes"),
    compter("tremplin_documents"),
    compter("tremplin_atelier_coachs"),
  ]);
  return {
    nbParticipantes,
    nbSousGroupes,
    nbSupports,
    nbCoachs,
    total: nbParticipantes + nbSousGroupes + nbSupports + nbCoachs,
  };
}

/**
 * Supprime un atelier. Scopé à l'édition (un id forgé d'une autre édition
 * n'emporte rien). Tout ce qui pend à l'atelier part avec lui par CASCADE au
 * niveau du schéma — participantes et présences, sous-groupes, coachs reliés,
 * supports (cf. db/schema.sql, `ON DELETE CASCADE` sur `atelier_id`). Les
 * inscriptions elles-mêmes ne bougent pas : on retire une séance du parcours,
 * pas des personnes de l'édition. Renvoie `true` si une ligne a été supprimée.
 */
export async function deleteAtelier(atelierId: number, editionId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/** Crée un atelier dans une édition et renvoie son id. */
export async function createAtelier(
  editionId: number,
  a: AtelierInput,
  db: Queryable = pool,
): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO tremplin_ateliers
       (edition_id, ordre, titre, date, date_fin, heure_debut, heure_fin, description, lieu, lien_visio, coachs, audience, ouvert_a_toutes, au_programme_public, phase, nature)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12 = 'toutes', $13, $14, $15)
     RETURNING id`,
    [
      editionId,
      a.ordre,
      a.titre,
      a.date,
      a.dateFin ?? null,
      a.heureDebut,
      a.heureFin,
      a.description,
      a.lieu ?? null,
      a.lienVisio,
      a.coachs ?? null,
      a.audience ?? DEFAULT_AUDIENCE,
      // La visibilité publique DÉMARRE sur l'audience (une séance de cohorte
      // fait partie du parcours qu'on raconte), sauf demande explicite. Ensuite
      // elle est indépendante : changer d'audience ne republie ni ne dépublie
      // rien dans le dos de l'orga.
      a.auProgrammePublic ?? programmePublicParDefaut(a.audience ?? DEFAULT_AUDIENCE),
      // Absent → défaut (cf. CHECK) ; la duplication passe la phase/nature de la
      // source pour les conserver.
      a.phase ?? DEFAULT_PHASE_ATELIER,
      a.nature ?? DEFAULT_NATURE_ATELIER,
    ],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Membres (ids d'inscription) d'un atelier : l'inventaire nominatif (les
 * présences se pointent dessus). La visibilité « ouvert à toutes » est une
 * l'AUDIENCE est une propriété à part, jamais déduite de cette liste.
 */
export async function getAtelierMembers(atelierId: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT registration_id FROM tremplin_atelier_membres WHERE atelier_id = $1`,
    [atelierId],
  );
  return (rows as { registration_id: number }[]).map((r) => r.registration_id);
}

/** Un membre d'atelier avec sa présence (tri-état). */
export interface MembreAtelier {
  registrationId: number;
  presence: Presence;
}

/** Membres (avec présence) de tous les ateliers d'une édition, en une requête
 * (anti N+1) : sert les listes ET le tableau de bord orga (présences non
 * pointées d'un atelier passé) sans requête par atelier. */
export async function getAtelierMembersByEdition(
  editionId: number,
): Promise<Map<number, MembreAtelier[]>> {
  const { rows } = await pool.query(
    `SELECT am.atelier_id, am.registration_id, am.presence
       FROM tremplin_atelier_membres am
       JOIN tremplin_ateliers a ON a.id = am.atelier_id
      WHERE a.edition_id = $1`,
    [editionId],
  );
  const map = new Map<number, MembreAtelier[]>();
  for (const r of rows as { atelier_id: number; registration_id: number; presence: Presence }[]) {
    const arr = map.get(r.atelier_id) ?? [];
    arr.push({ registrationId: r.registration_id, presence: r.presence });
    map.set(r.atelier_id, arr);
  }
  return map;
}

/** Tague des membres sur un atelier dans une transaction en cours (client),
 * scopé à l'édition (une inscription d'une autre édition est ignorée). */
async function tagAtelierWithinTx(
  client: Queryable,
  atelierId: number,
  editionId: number,
  registrationIds: number[],
): Promise<void> {
  if (registrationIds.length === 0) return;
  const regs = await client.query(
    `SELECT id FROM tremplin_registrations WHERE edition_id = $1`,
    [editionId],
  );
  const valid = new Set((regs.rows as { id: number }[]).map((r) => r.id));
  const toTag = [...new Set(registrationIds)].filter((id) => valid.has(id));
  for (const regId of toTag) {
    await client.query(
      // ON CONFLICT DO NOTHING : ré-ajouter une membre existante est idempotent
      // et PRÉSERVE sa présence déjà pointée (l'interrupteur par inscrite peut
      // rejouer le même ajout sans reset).
      `INSERT INTO tremplin_atelier_membres (atelier_id, registration_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [atelierId, regId],
    );
  }
}

/**
 * Crée un atelier ET pose ses membres, en UNE transaction : un atelier restreint
 * n'existe jamais sans son inventaire. Si `a.ordre` vaut 0 (formulaire), l'atelier
 * est placé APRÈS les ateliers existants (max(ordre)+1) — sinon un nouvel atelier
 * passerait devant tout le parcours (tri `ORDER BY ordre, date`) et renuméroterait
 * les étapes de la page publique. Renvoie l'id de l'atelier.
 */
export async function createAtelierWithMembers(
  editionId: number,
  a: AtelierInput,
  registrationIds: number[],
): Promise<number> {
  return withTransaction(async (client) => {
    let ordre = a.ordre;
    if (ordre === 0) {
      const { rows } = await client.query(
        `SELECT COALESCE(MAX(ordre), 0) + 1 AS next FROM tremplin_ateliers WHERE edition_id = $1`,
        [editionId],
      );
      ordre = Number((rows[0] as { next: number | string }).next);
    }
    const atelierId = await createAtelier(editionId, { ...a, ordre }, client);
    await tagAtelierWithinTx(client, atelierId, editionId, registrationIds);
    return atelierId;
  });
}

/** Remplace la liste des membres d'un atelier. Scopé à l'édition. Renvoie
 * `false` si l'atelier n'appartient pas à l'édition. */
export async function setAtelierMembers(
  atelierId: number,
  editionId: number,
  registrationIds: number[],
): Promise<boolean> {
  return withTransaction(async (client) => {
    const a = await client.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId],
    );
    if (a.rows.length === 0) return false; // rien écrit : commit d'un no-op
    // DIFF (pas de DELETE-all) : les membres conservés GARDENT leur présence
    // pointée (un DELETE + re-INSERT la remettrait à « non renseignée »).
    const current = await client.query(
      `SELECT registration_id FROM tremplin_atelier_membres WHERE atelier_id = $1`,
      [atelierId],
    );
    const avant = new Set(
      (current.rows as { registration_id: number }[]).map((r) => r.registration_id),
    );
    const voulu = new Set(registrationIds);
    for (const regId of avant) {
      if (!voulu.has(regId)) {
        await client.query(
          `DELETE FROM tremplin_atelier_membres WHERE atelier_id = $1 AND registration_id = $2`,
          [atelierId, regId],
        );
      }
    }
    await tagAtelierWithinTx(
      client,
      atelierId,
      editionId,
      registrationIds.filter((id) => !avant.has(id)),
    );
    return true;
  });
}

/**
 * Ajoute ou retire UNE participante d'un atelier (gestion en ligne, interrupteur
 * par inscrite). Scopé à l'édition. L'ajout est idempotent et PRÉSERVE la
 * présence déjà pointée (`ON CONFLICT DO NOTHING`, pas de reset). N'ajoute que si
 * l'inscription appartient à l'édition. Renvoie `false` si l'atelier n'appartient
 * pas à l'édition.
 */
export async function setAtelierMembre(
  atelierId: number,
  editionId: number,
  registrationId: number,
  present: boolean,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const a = await client.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId],
    );
    if (a.rows.length === 0) return false;
    if (present) {
      await tagAtelierWithinTx(client, atelierId, editionId, [registrationId]);
    } else {
      await client.query(
        `DELETE FROM tremplin_atelier_membres WHERE atelier_id = $1 AND registration_id = $2`,
        [atelierId, registrationId],
      );
    }
    return true;
  });
}

/** Présence pointée par l'orga, TRI-ÉTAT (« non renseignée » tant qu'on ne sait pas). */
export type Presence = "non_renseignee" | "presente" | "absente";

export const PRESENCE_LABEL: Record<Presence, string> = {
  non_renseignee: "Non renseignée",
  presente: "Présente",
  absente: "Absente",
};

export function isPresence(v: unknown): v is Presence {
  return v === "non_renseignee" || v === "presente" || v === "absente";
}

/** Présences des membres d'un atelier (pour la carte « Présences » de sa fiche). */
export async function getAtelierPresences(
  atelierId: number,
): Promise<{ registrationId: number; presence: Presence }[]> {
  const { rows } = await pool.query(
    `SELECT registration_id, presence FROM tremplin_atelier_membres WHERE atelier_id = $1`,
    [atelierId],
  );
  return (rows as { registration_id: number; presence: Presence }[]).map((r) => ({
    registrationId: r.registration_id,
    presence: r.presence,
  }));
}

/**
 * Les inscriptions CONCERNÉES par un atelier — dérivées de son AUDIENCE, jamais
 * de ce que le client envoie. C'est la même règle que `atelierVisiblePour`,
 * côté base : sélection nommée, cohorte d'une phase, ou toute l'édition.
 *
 * Sert au pointage EN LOT. Sans elle, « marquer toutes présentes » ne trouvait
 * que les lignes de présence DÉJÀ créées : sur un atelier de phase encore
 * jamais pointé, il n'y en a aucune — le geste disparaissait donc exactement
 * quand il servait le plus.
 */
export async function getCohorteAtelier(
  atelierId: number,
  editionId: number,
): Promise<number[]> {
  const { rows } = await pool.query(
    // JOINTURES plutôt que sous-requêtes CORRÉLÉES : la condition de phase
    // dépend de l'atelier (`rp.phase = a.phase`), et une corrélation dans un
    // `IN` n'est pas parsée par le harnais pg-mem des tests d'intégration.
    `SELECT DISTINCT r.id
       FROM tremplin_ateliers a
       JOIN tremplin_registrations r ON r.edition_id = a.edition_id
       LEFT JOIN tremplin_atelier_membres m
         ON m.atelier_id = a.id AND m.registration_id = r.id
       LEFT JOIN tremplin_registration_phases rp
         ON rp.registration_id = r.id AND rp.phase = a.phase
      WHERE a.id = $1 AND a.edition_id = $2
        AND (
          a.audience = 'toutes'
          OR (a.audience = 'selection' AND m.registration_id IS NOT NULL)
          OR (a.audience = 'phase' AND rp.registration_id IS NOT NULL)
        )`,
    [atelierId, editionId],
  );
  return (rows as { id: number }[]).map((r) => r.id);
}

/**
 * Combien de personnes chaque atelier de l'édition CONCERNE, en une requête
 * (anti N+1 : la liste des ateliers affiche le reste à ranger, elle ne peut pas
 * payer un `getCohorteAtelier` par rangée).
 *
 * MÊME règle d'audience que `getCohorteAtelier` — le `WHERE` est repris mot
 * pour mot, et le test d'intégration vérifie que les deux répondent la
 * même chose sur les trois audiences. Deux formulations d'une même règle, c'est
 * une divergence en sursis ; ici elles sont tenues par un test.
 */
export async function getTaillesCohortesByEdition(
  editionId: number,
): Promise<Map<number, number>> {
  // `SELECT DISTINCT` dans une table dérivée, puis `COUNT(*)` : même forme que
  // `getCohorteAtelier` (une paire atelier × inscription au plus), et le
  // harnais pg-mem des tests d'intégration la parse — `COUNT(DISTINCT …)`, non.
  const { rows } = await pool.query(
    `SELECT atelier_id, COUNT(*) AS n FROM (
       SELECT DISTINCT a.id AS atelier_id, r.id AS registration_id
         FROM tremplin_ateliers a
         JOIN tremplin_registrations r ON r.edition_id = a.edition_id
         LEFT JOIN tremplin_atelier_membres m
           ON m.atelier_id = a.id AND m.registration_id = r.id
         LEFT JOIN tremplin_registration_phases rp
           ON rp.registration_id = r.id AND rp.phase = a.phase
        WHERE a.edition_id = $1
          AND (
            a.audience = 'toutes'
            OR (a.audience = 'selection' AND m.registration_id IS NOT NULL)
            OR (a.audience = 'phase' AND rp.registration_id IS NOT NULL)
          )
     ) AS concernees
      GROUP BY atelier_id`,
    [editionId],
  );
  return new Map(
    (rows as { atelier_id: number; n: string }[]).map((r) => [r.atelier_id, Number(r.n)]),
  );
}

/**
 * Pointe les présences des membres d'un atelier (une passe, plusieurs lignes).
 * Scopé à l'édition ; une entrée pour un non-membre est ignorée (0 ligne).
 * Renvoie `false` si l'atelier n'appartient pas à l'édition.
 */
export async function setAtelierPresences(
  atelierId: number,
  editionId: number,
  entrees: { registrationId: number; presence: Presence }[],
): Promise<boolean> {
  return withTransaction(async (client) => {
    const a = await client.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId],
    );
    if (a.rows.length === 0) return false;
    // Les lignes manquantes créées EN UNE FOIS, avant la boucle : sur une
    // audience de phase ou « toutes », personne n'est inscrit nominativement,
    // donc presque toutes sont à créer. Une par une, un pointage collectif de
    // trente personnes faisait soixante allers-retours dans la transaction.
    const aCreer = entrees.filter((e) => e.presence === "presente").map((e) => e.registrationId);
    if (aCreer.length > 0) {
      await tagAtelierWithinTx(client, atelierId, editionId, aCreer);
    }
    for (const e of entrees) {
      await client.query(
        `UPDATE tremplin_atelier_membres SET presence = $3
          WHERE atelier_id = $1 AND registration_id = $2`,
        [atelierId, e.registrationId, e.presence],
      );
    }
    return true;
  });
}

/**
 * Pointe la présence D'UNE participante (case « Présente », dépendante de son
 * appartenance). Scopé à l'édition, ATOMIQUE. Invariant « présente ⊂ membre » :
 * marquer présente GARANTIT d'abord l'appartenance (même transaction) — sinon,
 * cochée juste après l'activation (avant que l'ajout de membre soit committé),
 * l'UPDATE toucherait 0 ligne et la présence serait silencieusement perdue.
 * Renvoie `false` si l'atelier n'appartient pas à l'édition.
 */
export async function setAtelierPresence(
  atelierId: number,
  editionId: number,
  registrationId: number,
  presence: Presence,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const a = await client.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId],
    );
    if (a.rows.length === 0) return false;
    if (presence === "presente") {
      await tagAtelierWithinTx(client, atelierId, editionId, [registrationId]);
    }
    await client.query(
      `UPDATE tremplin_atelier_membres SET presence = $3
        WHERE atelier_id = $1 AND registration_id = $2`,
      [atelierId, registrationId, presence],
    );
    return true;
  });
}

/**
 * Inscriptions « venues aux ateliers » d'une édition : présentes à AU MOINS
 * un atelier (dérivé du pointage, cf. docs/parcours-participante.md).
 */
export async function getVenuesByEdition(editionId: number): Promise<Set<number>> {
  const { rows } = await pool.query(
    `SELECT DISTINCT am.registration_id
       FROM tremplin_atelier_membres am
       JOIN tremplin_ateliers a ON a.id = am.atelier_id
      WHERE a.edition_id = $1 AND am.presence = 'presente'`,
    [editionId],
  );
  return new Set((rows as { registration_id: number }[]).map((r) => r.registration_id));
}

/* ────────────────────────── Sous-groupes ──────────────────────────
   Un atelier `nature = 'sous_groupes'` (revue croisée, points individuels)
   répartit ses participantes en sous-groupes autonomes ; chacun porte un coach
   optionnel, un lien « comment se retrouver » et une date de réalisation
   (`fait_le`). Toutes les écritures orga sont SCOPÉES À L'ÉDITION via la
   jointure atelier ; un id de sous-groupe d'une autre édition ne matche pas. */

export interface SousGroupe {
  id: number;
  atelierId: number;
  /** Coachs du sous-groupe : une, plusieurs, ou aucune (« autonome »), triées par
   * nom. Ce sont forcément des coachs de l'atelier porteur — l'invariant est
   * tenu en base (FK composite, migration 052). */
  coachs: { userId: number; nom: string | null; email: string | null }[];
  /**
   * Une coach HÉRITÉE de l'ancien modèle, restée en dehors du nouveau : elle
   * était posée sur le sous-groupe (`coach_user_id`) sans être inscrite aux
   * coachs de son ATELIER, ce que le modèle actuel interdit. La migration 052 ne
   * l'inscrit pas d'office — une ligne dans `tremplin_atelier_coachs` OUVRE
   * l'espace coach de l'atelier (noms de toutes ses participantes, supports),
   * et élargir un accès à des données personnelles est une décision d'orga, pas
   * de script. On la NOMME donc à l'écran, avec le geste à faire.
   *
   * `null` dès qu'il y a au moins une coach en titre, ou qu'il n'y a rien à
   * reprendre — c'est-à-dire dans tous les cas sauf celui-là.
   */
  coachHeriteNom: string | null;
  lienVisio: string | null;
  faitLe: string | null;
}

interface SousGroupeRow {
  id: number;
  atelier_id: number;
  coach_herite_nom: string | null;
  lien_visio: string | null;
  fait_le: string | null;
}

interface SousGroupeCoachRow {
  sous_groupe_id: number;
  user_id: number;
  nom: string | null;
  email: string | null;
}

/** Sous-groupes d'un atelier, chacun avec la liste des inscriptions membres. */
export async function getSousGroupesByAtelier(
  atelierId: number,
): Promise<(SousGroupe & { membres: number[] })[]> {
  // Trois lectures indépendantes (les groupes, leur composition, leurs coachs) :
  // en PARALLÈLE. Le repli « migration pas encore jouée » vit ici, au bord,
  // plutôt que recopié dans chaque vue — où il avalait au passage toute erreur
  // base (§7).
  const [rows, mrows, crows] = await Promise.all([
    pool
      .query(
        // `coach_herite_nom` : le nom derrière l'ancienne colonne `coach_user_id`,
        // pour pouvoir DIRE qu'une coach n'a pas été reprise (cf. le DTO). Le
        // nouveau code tient cette colonne en miroir de la table de liaison, donc
        // elle ne vaut quelque chose « en trop » que dans ce cas hérité.
        `SELECT sg.id, sg.atelier_id, sg.lien_visio, sg.fait_le, u.name AS coach_herite_nom
           FROM tremplin_atelier_sous_groupes sg
           LEFT JOIN users u ON u.id = sg.coach_user_id
          WHERE sg.atelier_id = $1 ORDER BY sg.id`,
        [atelierId],
      )
      .then((r) => r.rows as SousGroupeRow[])
      .catch(siTableAbsente<SousGroupeRow[]>([])),
    pool
      .query(
        `SELECT sous_groupe_id, registration_id FROM tremplin_atelier_membres
          WHERE atelier_id = $1 AND sous_groupe_id IS NOT NULL`,
        [atelierId],
      )
      .then((r) => r.rows as { sous_groupe_id: number; registration_id: number }[])
      .catch(siSchemaEnRetard<{ sous_groupe_id: number; registration_id: number }[]>([])),
    // Les coachs du sous-groupe (migration 052), AVEC leur nom : c'est ce que
    // les écrans affichent, et le résoudre ici évite que chacun se refasse sa
    // table de correspondance — deux d'entre eux la faisaient déjà différemment.
    // L'ORDER BY vit ici aussi : la table de liaison n'a pas d'ordre propre, et
    // deux coachs se liraient sinon dans un ordre variable d'un affichage à
    // l'autre. La table peut manquer le temps d'une bascule — un sous-groupe
    // s'affiche alors « autonome », pas en erreur.
    pool
      .query(
        `SELECT c.sous_groupe_id, c.user_id, u.name AS nom, u.email
           FROM tremplin_sous_groupe_coachs c
           JOIN tremplin_atelier_sous_groupes sg ON sg.id = c.sous_groupe_id
           JOIN users u ON u.id = c.user_id
          WHERE sg.atelier_id = $1
          ORDER BY u.name NULLS LAST, u.email`,
        [atelierId],
      )
      .then((r) => r.rows as SousGroupeCoachRow[])
      .catch(siTableAbsente<SousGroupeCoachRow[]>([])),
  ]);
  const parGroupe = indexerListes(
    mrows,
    (m) => m.sous_groupe_id,
    (m) => m.registration_id,
  );
  const coachsPar = indexerListes(
    crows,
    (c) => c.sous_groupe_id,
    (c) => ({ userId: c.user_id, nom: c.nom, email: c.email }),
  );
  return rows.map((r) => {
    const coachs = coachsPar.get(r.id) ?? [];
    return {
      id: r.id,
      atelierId: r.atelier_id,
      coachs,
      // Nommée SEULEMENT si personne n'a été repris pour ce groupe : sinon la
      // colonne n'est que le miroir d'une coach déjà listée au-dessus.
      coachHeriteNom: coachs.length === 0 ? r.coach_herite_nom : null,
      lienVisio: r.lien_visio,
      faitLe: r.fait_le,
      membres: parGroupe.get(r.id) ?? [],
    };
  });
}

/**
 * L'avancement des sous-groupes d'un atelier, en COMPTES. C'est tout ce qu'une
 * liste ou une dérivation d'état en demande : on agrège en SQL au lieu de
 * transporter les lignes (et aucun nominatif ne quitte la base).
 */
export interface SousGroupesEtat {
  total: number;
  /** Sous-groupes dont la séance est faite. */
  faits: number;
  /** Sous-groupes qui portent leur propre coach. */
  avecCoach: number;
  /** Participantes DÉJÀ rangées dans l'un des sous-groupes. Face à l'ensemble à
   * couvrir (cf. `src/lib/atelier-sous-groupes.ts`), c'est ce qui dit s'il reste
   * quelqu'un sans sous-groupe — la raison d'être des sous-groupes. */
  ranges: number;
}

/**
 * L'avancement des sous-groupes de TOUTE une édition, en COMPTES par atelier
 * (anti N+1 : la liste des ateliers en affiche l'avancement, une requête au
 * lieu d'une par ligne). On agrège en SQL au lieu de transporter les lignes —
 * la liste n'en tire que des nombres, et aucun nominatif ne quitte la base.
 */
interface CompteParAtelierRow {
  atelier_id: number;
  n: string;
}

export async function getSousGroupesByEdition(
  editionId: number,
): Promise<Map<number, SousGroupesEtat>> {
  // TROIS agrégats indépendants, en PARALLÈLE, chacun avec SON repli : les
  // groupes (le socle), les participantes rangées (colonne `sous_groupe_id`,
  // migration 047), les groupes coachés (table de liaison, migration 052).
  //
  // Séparés justement pour que chacun puisse manquer seul. Compter les coachs
  // dans la requête socle demandait un `LEFT JOIN`, donc un `COUNT(DISTINCT)`
  // sur `total` et `faits` — et surtout : la table 052 absente le temps d'une
  // bascule faisait retomber TOUS les compteurs de la liste des ateliers à zéro,
  // exactement le mode de panne que ces replis existent pour éviter.
  const [socle, rangees, coaches] = await Promise.all([
    pool
      .query(
        `SELECT sg.atelier_id, COUNT(*) AS total, COUNT(sg.fait_le) AS faits
           FROM tremplin_atelier_sous_groupes sg
           JOIN tremplin_ateliers a ON a.id = sg.atelier_id
          WHERE a.edition_id = $1
          GROUP BY sg.atelier_id`,
        [editionId],
      )
      .then((r) => r.rows as { atelier_id: number; total: string; faits: string }[])
      .catch(siTableAbsente<{ atelier_id: number; total: string; faits: string }[]>([])),
    pool
      .query(
        `SELECT m.atelier_id, COUNT(*) AS n
           FROM tremplin_atelier_membres m
           JOIN tremplin_ateliers a ON a.id = m.atelier_id
          WHERE a.edition_id = $1 AND m.sous_groupe_id IS NOT NULL
          GROUP BY m.atelier_id`,
        [editionId],
      )
      .then((r) => r.rows as CompteParAtelierRow[])
      .catch(siSchemaEnRetard<CompteParAtelierRow[]>([])),
    // Un sous-groupe compte pour UN, même coaché à deux : on dé-duplique avant
    // de compter (`SELECT DISTINCT` en table dérivée, la forme que le harnais
    // pg-mem parse — cf. les sous-requêtes corrélées, qu'il refuse).
    pool
      .query(
        `SELECT sg.atelier_id, COUNT(*) AS n
           FROM (SELECT DISTINCT sous_groupe_id FROM tremplin_sous_groupe_coachs) c
           JOIN tremplin_atelier_sous_groupes sg ON sg.id = c.sous_groupe_id
           JOIN tremplin_ateliers a ON a.id = sg.atelier_id
          WHERE a.edition_id = $1
          GROUP BY sg.atelier_id`,
        [editionId],
      )
      .then((r) => r.rows as CompteParAtelierRow[])
      .catch(siTableAbsente<CompteParAtelierRow[]>([])),
  ]);
  const compter = (lignes: readonly CompteParAtelierRow[]) =>
    new Map(lignes.map((r) => [r.atelier_id, Number(r.n)]));
  const rangesParAtelier = compter(rangees);
  const coachesParAtelier = compter(coaches);

  const parAtelier = new Map<number, SousGroupesEtat>();
  for (const r of socle) {
    parAtelier.set(r.atelier_id, {
      total: Number(r.total),
      faits: Number(r.faits),
      avecCoach: coachesParAtelier.get(r.atelier_id) ?? 0,
      ranges: rangesParAtelier.get(r.atelier_id) ?? 0,
    });
  }
  return parAtelier;
}

/** Crée un sous-groupe dans un atelier (scopé édition). Renvoie l'id, ou `null`
 * si l'atelier n'appartient pas à l'édition. */
export async function createSousGroupe(
  atelierId: number,
  editionId: number,
): Promise<number | null> {
  // Aucun libellé : le sous-groupe se désigne par ses membres (migration 052).
  // Le `SELECT … WHERE edition_id` fait office de garde : un atelier d'une autre
  // édition ne ramène aucune ligne, donc rien n'est inséré.
  const { rows } = await pool.query(
    `INSERT INTO tremplin_atelier_sous_groupes (atelier_id)
     SELECT a.id FROM tremplin_ateliers a
      WHERE a.id = $1 AND a.edition_id = $2
     RETURNING id`,
    [atelierId, editionId],
  );
  return rows.length ? (rows[0] as { id: number }).id : null;
}

/** Champs éditables d'un sous-groupe (côté orga). `faitLe` posé par l'orga ; la
 * participante a son propre chemin scopé (`setSousGroupeFaitLeCommeMembre`).
 *
 * Les COACHS n'y sont pas : elles se basculent une par une
 * (`setCoachDansSousGroupe`), comme les participantes. Les faire passer par ce
 * formulaire posait un piège — un ensemble de cases vide et un champ non rendu
 * arrivent tous deux « vide » côté serveur, donc enregistrer le lien effaçait
 * les coachs en place. */
export interface SousGroupeInfos {
  lienVisio: string | null;
  faitLe: string | null;
}

/**
 * Met à jour un sous-groupe (lien « comment se retrouver », réalisation). Scopé
 * à l'édition (un id d'une autre édition → 0 ligne). Réservé orga (l'action
 * appelante pose la garde). Renvoie `true` si le sous-groupe existe dans cette
 * édition.
 *
 * Plus de `libelle` : le sous-groupe se désigne par ses membres (migration 052).
 */
export async function updateSousGroupe(
  sousGroupeId: number,
  editionId: number,
  infos: SousGroupeInfos,
): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE tremplin_atelier_sous_groupes SET lien_visio = $3, fait_le = $4
      WHERE id = $1 AND atelier_id IN (
        SELECT id FROM tremplin_ateliers WHERE edition_id = $2)
      RETURNING id`,
    [sousGroupeId, editionId, infos.lienVisio, infos.faitLe],
  );
  return rows.length > 0;
}

/**
 * Confie (ou retire) UNE coach à un sous-groupe. Un interrupteur par coach,
 * enregistré à la bascule — le même geste que pour ranger une participante, sur
 * le même écran.
 *
 * L'invariant « coachs du sous-groupe ⊆ coachs de l'ATELIER » est tenu par la
 * base (FK composite, migration 052) : un compte qui n'est pas coach de
 * l'atelier ne peut pas entrer, même avec un id forgé. On le vérifie quand même
 * ici pour répondre `false` proprement plutôt que de laisser remonter une
 * violation de contrainte.
 *
 * Scopé à l'édition et à l'atelier porteur. Renvoie `false` si le sous-groupe
 * n'appartient pas à cette édition, ou le compte pas aux coachs de son atelier.
 */
export async function setCoachDansSousGroupe(
  sousGroupeId: number,
  editionId: number,
  userId: number,
  present: boolean,
): Promise<boolean> {
  return withTransaction(async (client) => {
    // Le sous-groupe, son atelier, et l'appartenance du compte aux coachs de cet
    // atelier — en UNE lecture scopée à l'édition.
    const { rows } = await client.query(
      `SELECT sg.atelier_id
         FROM tremplin_atelier_sous_groupes sg
         JOIN tremplin_ateliers a ON a.id = sg.atelier_id
         JOIN tremplin_atelier_coachs ac
           ON ac.atelier_id = sg.atelier_id AND ac.user_id = $3
        WHERE sg.id = $1 AND a.edition_id = $2`,
      [sousGroupeId, editionId, userId],
    );
    if (rows.length === 0) return false;
    const atelierId = (rows[0] as { atelier_id: number }).atelier_id;

    if (present) {
      await client.query(
        `INSERT INTO tremplin_sous_groupe_coachs (sous_groupe_id, atelier_id, user_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [sousGroupeId, atelierId, userId],
      );
    } else {
      await client.query(
        `DELETE FROM tremplin_sous_groupe_coachs
          WHERE sous_groupe_id = $1 AND user_id = $2`,
        [sousGroupeId, userId],
      );
    }
    await synchroniserMiroirCoach(client, sousGroupeId);
    return true;
  });
}

/**
 * Le MIROIR `coach_user_id`, recalculé depuis la table de liaison — un seul
 * point de vérité, appelé par tous les writers.
 *
 * La colonne survit à la migration 052 pour la fenêtre expand/contract (la
 * migration passe avant la livraison, et un retour arrière du code la relirait).
 * Elle porte la PREMIÈRE coach, définie comme le plus petit `user_id` : une règle
 * arbitraire mais STABLE, alors que « celle qu'on vient de retirer » et « celle
 * qu'on vient de poser » donnaient deux miroirs différents selon le chemin.
 */
export async function synchroniserMiroirCoach(client: Queryable, sousGroupeId: number): Promise<void> {
  await client.query(
    `UPDATE tremplin_atelier_sous_groupes
        SET coach_user_id = (SELECT MIN(user_id) FROM tremplin_sous_groupe_coachs
                              WHERE sous_groupe_id = $1)
      WHERE id = $1`,
    [sousGroupeId],
  );
}

/** Supprime un sous-groupe (scopé édition). Les membres sont déliés
 * automatiquement (`sous_groupe_id` → NULL via ON DELETE SET NULL). */
export async function deleteSousGroupe(sousGroupeId: number, editionId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_atelier_sous_groupes
      WHERE id = $1 AND atelier_id IN (
        SELECT id FROM tremplin_ateliers WHERE edition_id = $2)`,
    [sousGroupeId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Range (ou sort) une participante d'un sous-groupe DANS un atelier. Scopé à
 * l'édition, ATOMIQUE. Ranger dans un sous-groupe GARANTIT l'appartenance à
 * l'atelier (invariant « membre du sous-groupe ⊂ membre de l'atelier », même
 * logique que « présente ⊂ membre »). `sousGroupeId = null` retire du
 * sous-groupe (la participante reste inscrite à l'atelier). Renvoie `false` si
 * l'atelier n'appartient pas à l'édition, ou le sous-groupe à un autre atelier.
 */
export async function assignMembreSousGroupe(
  atelierId: number,
  editionId: number,
  registrationId: number,
  sousGroupeId: number | null,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const a = await client.query(
      `SELECT 1 FROM tremplin_ateliers WHERE id = $1 AND edition_id = $2`,
      [atelierId, editionId],
    );
    if (a.rows.length === 0) return false;
    if (sousGroupeId !== null) {
      const sg = await client.query(
        `SELECT 1 FROM tremplin_atelier_sous_groupes WHERE id = $1 AND atelier_id = $2`,
        [sousGroupeId, atelierId],
      );
      if (sg.rows.length === 0) return false; // sous-groupe d'un autre atelier
      await tagAtelierWithinTx(client, atelierId, editionId, [registrationId]);
    }
    await client.query(
      `UPDATE tremplin_atelier_membres SET sous_groupe_id = $3
        WHERE atelier_id = $1 AND registration_id = $2`,
      [atelierId, registrationId, sousGroupeId],
    );
    return true;
  });
}

/** Le sous-groupe d'une participante (compte `userId`) vu depuis SON espace, par
 * atelier `sous_groupes` de l'édition : co-membres (noms, JAMAIS l'e-mail),
 * coach éventuel, lien et réalisation. La fenêtre/lieu de l'atelier vit sur la
 * carte de l'atelier lui-même (agenda unifié) — pas ici. */
export interface MonSousGroupe {
  atelierId: number;
  /** Titre de l'atelier porteur (différencie les liens répétés, RGAA 6.1). */
  atelierTitre: string;
  sousGroupeId: number;
  /** Combien de coachs, nommées ou pas encore : une coach invitée par e-mail n'a
   * pas de `name` avant sa première connexion, et son sous-groupe n'est pas
   * « autonome » pour autant. */
  nbCoachs: number;
  /** Noms des coachs connus, triés. Peut être plus court que `nbCoachs`. */
  coachNoms: string[];
  lienVisio: string | null;
  faitLe: string | null;
  coMembres: string[];
}

export async function getMesSousGroupes(
  userId: number,
  editionId: number,
): Promise<MonSousGroupe[]> {
  const { rows } = await pool.query(
    `SELECT a.id AS atelier_id, a.titre,
            sg.id AS sous_groupe_id, sg.lien_visio, sg.fait_le
       FROM tremplin_atelier_membres m
       JOIN tremplin_registrations r ON r.id = m.registration_id
       JOIN tremplin_atelier_sous_groupes sg ON sg.id = m.sous_groupe_id
       JOIN tremplin_ateliers a ON a.id = m.atelier_id
      WHERE r."userId" = $1 AND a.edition_id = $2 AND a.nature = 'sous_groupes'
      ORDER BY a.ordre, a.id`,
    [userId, editionId],
  );
  const base = rows as {
    atelier_id: number; titre: string; sous_groupe_id: number;
    lien_visio: string | null; fait_le: string | null;
  }[];
  if (base.length === 0) return [];
  const ids = base.map((b) => b.sous_groupe_id);

  // DEUX lectures à plat pour TOUS les sous-groupes (coachs, co-membres), pas une
  // paire par ligne : la page qui appelle ceci est `force-dynamic` et le pool ne
  // tient que trois connexions, donc chaque aller-retour de plus se paie en
  // vagues sérialisées. En PARALLÈLE, et surtout dans un seul `Promise.all` —
  // une promesse créée puis attendue APRÈS un autre `await` qui peut échouer
  // devient un rejet non traité, que Node fait remonter en arrêt du worker.
  const [crows, corows] = await Promise.all([
    // Les coachs du sous-groupe (migration 052) : leur NOM, jamais l'e-mail.
    pool
      .query(
        `SELECT c.sous_groupe_id, u.name
           FROM tremplin_sous_groupe_coachs c
           JOIN users u ON u.id = c.user_id
          WHERE c.sous_groupe_id = ANY($1::int[])
          ORDER BY c.sous_groupe_id, u.name`,
        [ids],
      )
      .then((r) => r.rows as { sous_groupe_id: number; name: string | null }[])
      .catch(siTableAbsente<{ sous_groupe_id: number; name: string | null }[]>([])),
    // Co-membres (autres inscriptions du même sous-groupe) : nom, jamais l'e-mail.
    pool
      .query(
        `SELECT m.sous_groupe_id, r.participante_nom, u.name AS user_name
           FROM tremplin_atelier_membres m
           JOIN tremplin_registrations r ON r.id = m.registration_id
           LEFT JOIN users u ON u.id = r."userId"
          WHERE m.sous_groupe_id = ANY($1::int[]) AND (u.id IS NULL OR u.id <> $2)
          ORDER BY m.sous_groupe_id, r.participante_nom NULLS LAST, r.id`,
        [ids, userId],
      )
      .then(
        (r) =>
          r.rows as {
            sous_groupe_id: number;
            participante_nom: string | null;
            user_name: string | null;
          }[],
      ),
  ]);

  const coachsPar = indexerListes(
    crows,
    (c) => c.sous_groupe_id,
    (c) => c.name,
  );
  const coMembresPar = indexerListes(
    corows,
    (c) => c.sous_groupe_id,
    (c) => c.participante_nom ?? c.user_name,
  );
  const nommes = (noms: (string | null)[] | undefined) =>
    (noms ?? []).filter((n): n is string => Boolean(n));

  return base.map((b) => ({
    atelierId: b.atelier_id,
    atelierTitre: b.titre,
    sousGroupeId: b.sous_groupe_id,
    // Le nombre de coachs, pas seulement leurs noms : une coach invitée par
    // e-mail n'a pas encore de `name`, et la faire DISPARAÎTRE ferait lire « tu
    // es seule » à une participante qui a bien une coach.
    nbCoachs: (coachsPar.get(b.sous_groupe_id) ?? []).length,
    coachNoms: nommes(coachsPar.get(b.sous_groupe_id)),
    lienVisio: b.lien_visio,
    faitLe: b.fait_le,
    coMembres: nommes(coMembresPar.get(b.sous_groupe_id)),
  }));
}

/**
 * Réalisation posée par LA PARTICIPANTE elle-même (self-service). N'agit QUE si
 * le compte `userId` est membre du sous-groupe visé (garde EN SQL : une
 * participante ne touche jamais le sous-groupe d'une autre). Renvoie `false`
 * sinon. `faitLe = null` efface la date.
 */
export async function setSousGroupeFaitLeCommeMembre(
  sousGroupeId: number,
  userId: number,
  faitLe: string | null,
): Promise<boolean> {
  // Garde par appartenance : on n'écrit que si `userId` est membre du
  // sous-groupe `$1`. Le sous-groupe étant fixé par `id = $1`, la garde référence
  // directement `$1` (pas de sous-requête corrélée sur l'alias).
  const { rowCount } = await pool.query(
    `UPDATE tremplin_atelier_sous_groupes SET fait_le = $3
      WHERE id = $1
        AND EXISTS (
          SELECT 1 FROM tremplin_atelier_membres m
            JOIN tremplin_registrations r ON r.id = m.registration_id
           WHERE m.sous_groupe_id = $1 AND r."userId" = $2)`,
    [sousGroupeId, userId, faitLe],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * PROGRAMME PUBLIC d'une édition : les séances que l'orga a DIT vouloir montrer
 * (`au_programme_public`, migration 056). C'est le récit de l'accompagnement, et
 * la page publique en fait son argument (« N semaines d'accompagnement ») ; le
 * DTO n'en sort que le titre, les dates, la description et la phase — jamais
 * l'inventaire des personnes, jamais le lieu du rendez-vous.
 *
 * La règle ne se DÉDUIT plus de l'audience : elle se lit sur une colonne que
 * l'orga coche, initialisée depuis l'audience à la création. `atelier-audience.
 * ts` (`programmePublicParDefaut`) raconte pourquoi, et l'incident qui a mené
 * là — « pointer publiait ». Une régression antérieure y est racontée aussi : la
 * publication avait été couplée au seul « ouvert à toutes », ce qui faisait
 * disparaître du parcours public les séances passées en réservé pour pointer les
 * présences (prod 2026-07-30).
 *
 * Un seul endroit décide, donc : plus de prédicat TypeScript à tenir en phase
 * avec ce SQL, c'est la colonne qui fait foi des deux côtés.
 */
export async function getProgrammePublicByEdition(editionId: number): Promise<Atelier[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_ateliers
      WHERE edition_id = $1 AND au_programme_public = true
      ORDER BY ordre, date, id`,
    [editionId],
  );
  return (rows as AtelierRow[]).map(mapRow);
}

/**
 * Montrer (ou réserver) une séance sur le site public. Scopé à l'édition —
 * comme tous les setters d'atelier, l'id seul ne suffit jamais à écrire.
 *
 * INDÉPENDANT de l'audience, volontairement : changer qui voit une séance dans
 * son espace ne doit ni la publier ni la retirer de la vitrine dans le dos de
 * l'orga. Les deux états sont affichés côte à côte, en toutes lettres.
 */
export async function setAtelierProgrammePublic(
  atelierId: number,
  editionId: number,
  visible: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_ateliers SET au_programme_public = $3
      WHERE id = $1 AND edition_id = $2`,
    [atelierId, editionId, visible],
  );
  return (rowCount ?? 0) > 0;
}
