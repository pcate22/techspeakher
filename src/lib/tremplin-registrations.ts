import { cache } from "react";
import { pool, withTransaction, type Queryable } from "@/lib/db";
import { isUniqueViolation } from "@/lib/pg-errors";
import { seedDefaultPhaseMembership } from "@/lib/tremplin-registration-phases";

export type RegistrationStatut = "en_attente" | "acceptee" | "refusee";

/** Phase d'entrée dans le parcours (cf. docs/parcours-participante.md). */
export type PhaseEntree = "cfp_et_pitch" | "finale" | "montee_sur_scene";

export const PHASE_ENTREE_LABEL: Record<PhaseEntree, string> = {
  cfp_et_pitch: "Phase 1 · Accompagnement CFP et pitch",
  finale: "Phase 2 · Finale du tremplin",
  montee_sur_scene: "Phase 3 · Accompagnement montée sur scène",
};

export function isPhaseEntree(v: unknown): v is PhaseEntree {
  return v === "cfp_et_pitch" || v === "finale" || v === "montee_sur_scene";
}

export interface Registration {
  id: number;
  editionId: number;
  userId: number | null;
  participanteNom: string | null;
  participanteRole: string | null;
  participanteLinkedin: string | null;
  statut: RegistrationStatut;
  /** Titre du talk pitché (dérivé par jointure `talk_id → speaker_talks.titre`,
   * jamais stocké sur l'inscription). NULL si aucun talk pitché. */
  talkTitre: string | null;
  finalePresente: boolean | null;
  phaseEntree: PhaseEntree;
  /** Consentement à apparaître nommée publiquement (galerie/palmarès). */
  public: boolean;
  classement: number | null;
  /** Titre primé FIGÉ (archive palmarès) : renseigné pour une classée sans talk
   * (ex. gagnantes T1). Sert d'affichage de repli quand `talkTitre` est nul. */
  titrePalmares: string | null;
  bio: string | null;
  siteWeb: string | null;
  photoUrl: string | null;
  /** E-mail/nom du compte rattaché (jointure, vue admin) — pour identifier une
   * inscrite invitée par e-mail qui n'a pas encore complété son profil. */
  userEmail?: string | null;
  userName?: string | null;
}

/**
 * Libellé d'affichage d'une inscription : nom saisi, sinon nom/e-mail du
 * compte (invitée par e-mail pas encore connectée), sinon n° de compte.
 * Source unique pour l'admin (tableau de bord, fiches, modales).
 */
export function registrationLabel(r: Registration): string {
  return r.participanteNom ?? r.userName ?? r.userEmail ?? `Compte n° ${r.userId}`;
}

/**
 * Des ids d'inscription → `{ id, nom }` triés par nom (fr) — LA recette unique
 * pour nommer un ensemble d'inscriptions (les membres d'un sous-groupe, une
 * cohorte…).
 *
 * L'`id` est conservé : il fait la clé React (deux homonymes ne se marchent pas
 * dessus) et aucune inscription n'est silencieusement perdue — sans nom connu, la
 * ligne le DIT plutôt que de disparaître, sinon un compte affiché ailleurs
 * dépasserait la liste. Deux écrans avaient chacun leur version de cette règle,
 * avec deux replis différents, donc deux libellés pour le même sous-groupe.
 */
export function nommerInscriptions(
  ids: readonly number[],
  regs: readonly Registration[],
): { id: number; nom: string }[] {
  const nomPar = new Map(regs.map((r) => [r.id, registrationLabel(r)]));
  return ids
    .map((id) => ({ id, nom: nomPar.get(id) ?? `Inscription n° ${id}` }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
}

/** Copie triée par libellé (fr), sans muter l'entrée. */
export function trierParLabel(regs: Registration[]): Registration[] {
  return [...regs].sort((a, b) => registrationLabel(a).localeCompare(registrationLabel(b), "fr"));
}

/** Libellé du rang de podium dérivé du classement (« 1ᵉʳ prix », « 2ᵉ prix »…),
 * ou null si non classée. Source unique : le classement entier ne se stocke
 * qu'une fois, le libellé est calculé partout où il s'affiche. */
export function rangLabel(classement: number | null): string | null {
  if (classement === null) return null;
  return classement === 1 ? "1ᵉʳ prix" : `${classement}ᵉ prix`;
}

/** Ordinal court féminin du rang (« 1ʳᵉ », « 2ᵉ »…) pour les phrases (« à la
 * place de … »), ou null si non classée. */
export function rangOrdinal(classement: number | null): string | null {
  if (classement === null) return null;
  return classement === 1 ? "1ʳᵉ" : `${classement}ᵉ`;
}

export interface RegistrationInput {
  userId: number | null;
  participanteNom: string | null;
  participanteRole: string | null;
  participanteLinkedin: string | null;
  statut: RegistrationStatut;
  finalePresente: boolean | null;
  public?: boolean;
  classement?: number | null;
  /** Titre primé figé (palmarès) : renseigné pour une inscription classée
   * saisie sans compte ni talk (ex. finalistes T1). NULL sinon. */
  titrePalmares?: string | null;
  bio?: string | null;
  siteWeb?: string | null;
  photoUrl?: string | null;
}

interface RegistrationRow {
  id: number;
  edition_id: number;
  userId: number | null;
  participante_nom: string | null;
  participante_role: string | null;
  participante_linkedin: string | null;
  statut: RegistrationStatut;
  /** Alias de jointure `st.titre` (talk pitché) ; absent des requêtes qui ne
   * joignent pas speaker_talks → `?? null` dans mapRow. */
  talk_titre?: string | null;
  finale_presente: boolean | null;
  phase_entree: PhaseEntree;
  public: boolean;
  classement: number | null;
  titre_palmares?: string | null;
  bio: string | null;
  site_web: string | null;
  photo_url: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

function mapRow(r: RegistrationRow): Registration {
  return {
    id: r.id,
    editionId: r.edition_id,
    userId: r.userId,
    participanteNom: r.participante_nom,
    participanteRole: r.participante_role,
    participanteLinkedin: r.participante_linkedin,
    statut: r.statut,
    talkTitre: r.talk_titre ?? null,
    finalePresente: r.finale_presente,
    phaseEntree: r.phase_entree,
    public: r.public,
    classement: r.classement,
    titrePalmares: r.titre_palmares ?? null,
    bio: r.bio,
    siteWeb: r.site_web,
    photoUrl: r.photo_url,
    userEmail: r.user_email ?? null,
    userName: r.user_name ?? null,
  };
}

const COLS = `id, edition_id, "userId", participante_nom, participante_role,
              participante_linkedin, statut, finale_presente, phase_entree,
              "public", classement, bio, site_web, photo_url`;

/** Inscriptions d'une édition (saisies orga + comptes rattachés), avec e-mail/nom
 * du compte joint pour identifier une inscrite invitée par e-mail (vue admin). */
export async function getRegistrationsByEdition(
  editionId: number,
): Promise<Registration[]> {
  const { rows } = await pool.query(
    `SELECT r.id, r.edition_id, r."userId", r.participante_nom, r.participante_role,
            r.participante_linkedin, r.statut, st.titre AS talk_titre, r.finale_presente,
            r.phase_entree, r."public", r.classement, r.titre_palmares, r.bio, r.site_web, r.photo_url,
            u.email AS user_email, u.name AS user_name
       FROM tremplin_registrations r
       LEFT JOIN users u ON u.id = r."userId"
       LEFT JOIN speaker_talks st ON st.id = r.talk_id
      WHERE r.edition_id = $1
      ORDER BY r.participante_nom, r.id`,
    [editionId],
  );
  return (rows as RegistrationRow[]).map(mapRow);
}

/**
 * COMBIEN d'inscrites compte une édition. Une page qui n'affiche qu'un nombre
 * (« Ouvert à toutes (8 inscrites) ») ne doit pas charger l'inventaire complet
 * avec les e-mails et deux jointures pour en prendre le `.length` : minimisation
 * RGPD autant que sobriété.
 */
export async function countRegistrationsByEdition(editionId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM tremplin_registrations WHERE edition_id = $1`,
    [editionId],
  );
  return Number((rows[0] as { n: string } | undefined)?.n ?? 0);
}

/** Inscription d'une participante (par compte) sur une édition, ou null. */
export async function getRegistrationByUser(
  userId: number,
  editionId: number,
): Promise<Registration | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_registrations
      WHERE "userId" = $1 AND edition_id = $2`,
    [userId, editionId],
  );
  return rows.length > 0 ? mapRow(rows[0] as RegistrationRow) : null;
}

export interface UserEdition {
  editionId: number;
  nom: string;
}

/**
 * Éditions auxquelles un compte est inscrit (rattaché), la plus récente d'abord.
 * Sert au point d'entrée « Mon Tremplin » dans l'espace membre. Mémoïsé PAR
 * REQUÊTE (`React.cache`) : le layout (barre d'onglets) et la page en dessous
 * la lisent tous deux — une seule requête SQL, partagée.
 */
export const getEditionsForUser = cache(async function getEditionsForUser(
  userId: number,
): Promise<UserEdition[]> {
  const { rows } = await pool.query(
    `SELECT e.id AS edition_id, e.nom AS nom
       FROM tremplin_registrations r
       JOIN tremplin_editions e ON e.id = r.edition_id
      WHERE r."userId" = $1
      ORDER BY e.annee DESC, e.id DESC`,
    [userId],
  );
  return (rows as { edition_id: number; nom: string }[]).map((r) => ({
    editionId: r.edition_id,
    nom: r.nom,
  }));
});

/** Crée une inscription (compte rattaché ou saisie orga) et renvoie son id. */
export async function createRegistration(
  editionId: number,
  r: RegistrationInput,
  db: Queryable = pool,
): Promise<number> {
  const isPublic = r.public ?? false;
  const { rows } = await db.query(
    `INSERT INTO tremplin_registrations
       (edition_id, "userId", participante_nom, participante_role,
        participante_linkedin, statut, titre_palmares, finale_presente,
        "public", public_consent_at, classement, bio, site_web, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             $9, CASE WHEN $9 THEN now() ELSE NULL END, $10, $11, $12, $13)
     RETURNING id`,
    [
      editionId,
      r.userId,
      r.participanteNom,
      r.participanteRole,
      r.participanteLinkedin,
      r.statut,
      r.titrePalmares ?? null,
      r.finalePresente,
      isPublic,
      r.classement ?? null,
      r.bio ?? null,
      r.siteWeb ?? null,
      r.photoUrl ?? null,
    ],
  );
  const id = (rows[0] as { id: number }).id;
  // Saisie orga : entrée en phase 1 par défaut (phase_entree DB = cfp_et_pitch).
  // Même handle DB → atomique avec l'inscription.
  await seedDefaultPhaseMembership(id, "cfp_et_pitch", db);
  return id;
}

export type RegisterOutcome = "inscrite" | "deja_inscrite";

/**
 * Inscrit un compte (par son id) à une édition, sans nom saisi : la personne a
 * été invitée par e-mail et complétera son profil à sa connexion. Le CHECK
 * d'identité est satisfait par `"userId"`. Renvoie `deja_inscrite` si le compte
 * est déjà inscrit à l'édition (contrainte UNIQUE), sans dupliquer.
 */
export async function registerUserToEdition(
  editionId: number,
  userId: number,
  phase: PhaseEntree = "cfp_et_pitch",
): Promise<RegisterOutcome> {
  try {
    // Inscription + appartenance de phase dans UNE transaction : jamais
    // d'inscription orpheline sans phase (repli « sans phase renseignée »).
    return await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO tremplin_registrations (edition_id, "userId", statut, phase_entree)
         VALUES ($1, $2, 'en_attente', $3) RETURNING id`,
        [editionId, userId, phase],
      );
      await seedDefaultPhaseMembership((rows[0] as { id: number }).id, phase, client);
      return "inscrite" as RegisterOutcome;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return "deja_inscrite";
    throw e;
  }
}

/**
 * Retire une participante d'une édition (e-mail erroné, désinscription).
 * Les CASCADE effacent ses documents, tags photo, appartenances d'atelier et
 * journal de consentement. Scopé à l'édition. Renvoie `false` si 0 ligne.
 * N.B. : ne supprime PAS le compte (la personne peut être membre par ailleurs).
 */
export async function deleteRegistration(
  registrationId: number,
  editionId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM tremplin_registrations WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Marque (ou retire) le statut « finaliste / présente à la soirée ». On ne le
 * connaît pas à l'inscription : il est posé après la soirée (ou en rattrapage).
 * Scopé à l'édition. Renvoie `false` si l'inscription n'y appartient pas.
 */
export async function setRegistrationFinale(
  registrationId: number,
  editionId: number,
  present: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_registrations SET finale_presente = $3
      WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId, present],
  );
  return (rowCount ?? 0) > 0;
}

/** Change la phase d'entrée dans le parcours. Réservé orga, scopé à l'édition. */
export async function setRegistrationPhase(
  registrationId: number,
  editionId: number,
  phase: PhaseEntree,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_registrations SET phase_entree = $3
      WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId, phase],
  );
  return (rowCount ?? 0) > 0;
}

/** Champ de l'inscription éditable par l'ORGA : le mérite d'édition seulement.
 * La bio, le site et la photo sont des données PERSONNELLES — la speakeuse les
 * gère sur sa fiche ; la galerie publique les lit là (cf. tremplin-public). */
export interface RegistrationPublicDetails {
  classement: number | null;
}

/**
 * Origine d'un consentement à la diffusion (démontrabilité RGPD, art. 7.1).
 * `self` : la personne l'a posé elle-même dans son espace (preuve = l'horodatage).
 * Sinon recueil externe attesté par l'orga : clause d'un formulaire d'inscription,
 * accord par e-mail, ou autre cas précisé. Cf. docs/conception-autorisation-diffusion.md.
 */
export type ConsentBase = "self" | "formulaire_inscription" | "email" | "autre";

export const CONSENT_BASES: ConsentBase[] = [
  "self",
  "formulaire_inscription",
  "email",
  "autre",
];

export function isConsentBase(v: unknown): v is ConsentBase {
  return typeof v === "string" && (CONSENT_BASES as string[]).includes(v);
}

/**
 * Pose (ou retire) le consentement « visible publiquement » d'une inscription :
 * nom/talk affichés dans la galerie et le palmarès. Scopé à l'édition.
 *
 * `public_consent_at` reflète le consentement COURANT (horodaté à l'activation,
 * effacé au retrait). Chaque changement est en plus tracé dans le journal
 * append-only `tremplin_consent_log` — pour démontrer un consentement passé
 * même après retrait (RGPD). Les deux écritures sont atomiques (transaction).
 *
 * `base` et `preuveLien` qualifient l'OCTROI (d'où vient l'accord, où est la
 * preuve d'un recueil externe). Ils n'ont pas de sens sur un retrait : on force
 * alors `base='self'` et `preuve_lien=NULL` (le retrait ne « provient » de rien).
 * Renvoie `false` si l'inscription n'appartient pas à l'édition (0 ligne).
 */
export async function setRegistrationVisibility(
  registrationId: number,
  editionId: number,
  isPublic: boolean,
  base: ConsentBase = "self",
  preuveLien: string | null = null,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE tremplin_registrations
          SET "public" = $3,
              public_consent_at = CASE WHEN $3 THEN now() ELSE NULL END
        WHERE id = $1 AND edition_id = $2`,
      [registrationId, editionId, isPublic],
    );
    if ((rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return false; // hors édition : rien changé, rien journalisé
    }
    await client.query(
      `INSERT INTO tremplin_consent_log (registration_id, action, base, preuve_lien)
       VALUES ($1, $2, $3, $4)`,
      [
        registrationId,
        isPublic ? "accorde" : "retire",
        isPublic ? base : "self",
        isPublic ? preuveLien : null,
      ],
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Version SELF-SERVICE de la visibilité : la participante change sa propre
 * visibilité publique (le consentement lui appartient). Même transaction et
 * même journal que la version orga, mais scopée au COMPTE connecté : la
 * requête ne peut toucher que SON inscription de cette édition.
 */
export async function setOwnRegistrationVisibility(
  userId: number,
  editionId: number,
  isPublic: boolean,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE tremplin_registrations
          SET "public" = $3,
              public_consent_at = CASE WHEN $3 THEN now() ELSE NULL END
        WHERE "userId" = $1 AND edition_id = $2
        RETURNING id`,
      [userId, editionId, isPublic],
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return false; // pas inscrite (ou pas rattachée) : rien changé
    }
    // Self-service : la base est TOUJOURS 'self' (la personne agit elle-même),
    // sans preuve externe — l'horodatage EST la preuve.
    await client.query(
      `INSERT INTO tremplin_consent_log (registration_id, action, base, preuve_lien)
       VALUES ($1, $2, 'self', NULL)`,
      [(rows[0] as { id: number }).id, isPublic ? "accorde" : "retire"],
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * La participante désigne (ou retire avec NULL) le talk pitché de SON inscription.
 * Scopé au COMPTE connecté (`"userId"`), jamais à un `registrationId` reçu du
 * client (anti-IDOR) : on ne peut toucher que sa propre inscription. Le titre
 * affiché est lu directement depuis le talk (`talk_id → speaker_talks.titre`).
 * Renvoie `false` si elle n'est pas inscrite à cette édition.
 */
export async function setOwnRegistrationTalk(
  userId: number,
  editionId: number,
  talkId: number | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_registrations SET talk_id = $3
      WHERE "userId" = $1 AND edition_id = $2`,
    [userId, editionId, talkId],
  );
  return (rowCount ?? 0) > 0;
}

export interface ConsentLogEntry {
  action: "accorde" | "retire";
  /** Origine du consentement (démontrabilité) ; `self` pour un retrait. */
  base: ConsentBase;
  /** Lien vers la preuve d'un recueil externe (null en self-service). */
  preuveLien: string | null;
  createdAt: string;
}

/** Journal de consentement d'une inscription (le plus ancien d'abord). RGPD. */
export async function getConsentLog(registrationId: number): Promise<ConsentLogEntry[]> {
  const { rows } = await pool.query(
    `SELECT action, base, preuve_lien, created_at FROM tremplin_consent_log
      WHERE registration_id = $1 ORDER BY created_at, id`,
    [registrationId],
  );
  // TIMESTAMPTZ arrive en Date (prod, node-postgres) ou en chaîne (pg-mem) :
  // on normalise en ISO pour un type honnête et stable côté consommateur.
  return (
    rows as {
      action: "accorde" | "retire";
      base: ConsentBase;
      preuve_lien: string | null;
      created_at: string | Date;
    }[]
  ).map((r) => ({
    action: r.action,
    base: r.base,
    preuveLien: r.preuve_lien,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
}

/**
 * Met à jour le classement de podium d'une inscription (mérite d'édition, le
 * seul champ que l'orga gère ici). Bio / site / photo ne sont plus édités par
 * l'orga : ce sont des données personnelles, gérées par la speakeuse sur sa
 * fiche. Scopé à l'édition ; renvoie `false` si l'inscription n'y appartient pas.
 */
export async function updateRegistrationDetails(
  registrationId: number,
  editionId: number,
  d: RegistrationPublicDetails,
): Promise<boolean> {
  // En classant (rang non nul), on FIGE le titre primé depuis le talk pitché :
  // l'archive du palmarès survit ensuite à la suppression / au renommage du talk
  // (et au retrait de la colonne source). Sans talk pitché, on conserve l'archive
  // déjà en place (seed T1, migration 034). Déclasser ne l'efface pas.
  // Deux temps (titre lu puis figé en paramètre) plutôt qu'une sous-requête
  // corrélée : portable (pg-mem) et lisible ; geste orga rare, mono-acteur.
  if (d.classement !== null) {
    const { rows } = await pool.query(
      `SELECT st.titre AS titre
         FROM tremplin_registrations r
         LEFT JOIN speaker_talks st ON st.id = r.talk_id
        WHERE r.id = $1 AND r.edition_id = $2`,
      [registrationId, editionId],
    );
    if (rows.length === 0) return false;
    const titre = (rows[0] as { titre: string | null }).titre ?? null;
    const { rowCount } = await pool.query(
      `UPDATE tremplin_registrations
          SET classement = $3, titre_palmares = COALESCE($4, titre_palmares)
        WHERE id = $1 AND edition_id = $2`,
      [registrationId, editionId, d.classement, titre],
    );
    return (rowCount ?? 0) > 0;
  }
  const { rowCount } = await pool.query(
    `UPDATE tremplin_registrations SET classement = $3
      WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId, d.classement],
  );
  return (rowCount ?? 0) > 0;
}

/** Une inscription par id, scopée à l'édition (avec e-mail/nom du compte joint),
 * ou null si elle n'appartient pas à l'édition. */
export async function getRegistrationById(
  registrationId: number,
  editionId: number,
): Promise<Registration | null> {
  const { rows } = await pool.query(
    `SELECT r.id, r.edition_id, r."userId", r.participante_nom, r.participante_role,
            r.participante_linkedin, r.statut, st.titre AS talk_titre, r.finale_presente,
            r.phase_entree, r."public", r.classement, r.titre_palmares, r.bio, r.site_web, r.photo_url,
            u.email AS user_email, u.name AS user_name
       FROM tremplin_registrations r
       LEFT JOIN users u ON u.id = r."userId"
       LEFT JOIN speaker_talks st ON st.id = r.talk_id
      WHERE r.id = $1 AND r.edition_id = $2`,
    [registrationId, editionId],
  );
  return rows.length > 0 ? mapRow(rows[0] as RegistrationRow) : null;
}

/**
 * Talk mis en avant d'une inscription (colonne `talk_id`, migration 032), scopé
 * à l'édition. ISOLÉ des autres requêtes : l'appelant l'entoure d'un `try/catch`
 * pour ne pas dépendre de la migration (la fiche s'affiche même avant qu'elle
 * soit jouée). Renvoie null si aucun talk (ou inscription hors édition).
 */
export async function getRegistrationTalkId(
  registrationId: number,
  editionId: number,
): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT talk_id FROM tremplin_registrations WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId],
  );
  return rows.length > 0 ? ((rows[0] as { talk_id: number | null }).talk_id ?? null) : null;
}

/** Rattache (ou délie avec NULL) le talk mis en avant d'une inscription. Scopé
 * à l'édition ; renvoie `false` si l'inscription n'y appartient pas. */
export async function setRegistrationTalk(
  registrationId: number,
  editionId: number,
  talkId: number | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_registrations
        SET talk_id = $3
      WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId, talkId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Issue d'un rattachement :
 * - `attached`     : compte rattaché à l'inscription.
 * - `occupee`      : l'inscription a déjà un compte, ou n'appartient pas à
 *   l'édition (0 ligne modifiée).
 * - `deja_rattache`: ce compte est déjà rattaché à une AUTRE inscription de
 *   l'édition (conflit UNIQUE (edition_id, "userId")).
 */
export type AttachOutcome = "attached" | "occupee" | "deja_rattache";

/**
 * Rattache un compte à une inscription saisie par l'orga (Lot A3).
 * Scopé à l'édition (`edition_id = $3`) : on ne touche jamais une inscription
 * d'une autre édition, même avec un id forgé ou périmé. Ne rattache que si
 * l'inscription n'a pas déjà de compte (idempotent, sûr).
 *
 * Possède le résultat complet — y compris le conflit UNIQUE — pour que
 * l'appelant n'ait pas à inspecter les codes d'erreur du driver Postgres.
 */
export async function attachUserToRegistration(
  registrationId: number,
  userId: number,
  editionId: number,
): Promise<AttachOutcome> {
  try {
    const { rowCount } = await pool.query(
      `UPDATE tremplin_registrations
          SET "userId" = $2
        WHERE id = $1 AND edition_id = $3 AND "userId" IS NULL`,
      [registrationId, userId, editionId],
    );
    return (rowCount ?? 0) > 0 ? "attached" : "occupee";
  } catch (e) {
    if (isUniqueViolation(e)) return "deja_rattache";
    throw e;
  }
}
