import { cache } from "react";
import { pool, withTransaction, type Queryable } from "@/lib/db";
import { siTableAbsente } from "@/lib/pg-errors";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import type { EditionStatut } from "@/lib/tremplin-statut";

// Statuts, libellés et libellé dérivé de la fenêtre d'inscriptions : définis
// dans `tremplin-statut.ts` (sans accès BDD, importable côté client) et
// re-exportés ici pour les consommateurs serveur.
export {
  EDITION_STATUT_LABEL,
  EDITION_STATUTS,
  isEditionStatut,
  aujourdhuiParis,
  inscriptionsEtat,
  editionStatutAffiche,
} from "@/lib/tremplin-statut";
export type { EditionStatut, InscriptionsEtat } from "@/lib/tremplin-statut";

export interface Edition {
  id: number;
  nom: string;
  annee: number;
  confSlug: string | null;
  statut: EditionStatut;
  description: string | null;
  confNom: string | null;
  /** Lieu de la conférence : ville OU pays (optionnel). */
  confLieu: string | null;
  confDate: string | null;
  confLien: string | null;
  finaleDate: string | null;
  finaleLieu: string | null;
  /** Événement de la référence des conférences pointé (migration 027), ou null. */
  conferenceEditionId: number | null;
  /** Fenêtre d'inscriptions : l'état « ouvertes » est dérivé de la date du jour. */
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
  /** Tombstone : ISO si l'édition a été supprimée (coquille gardée pour l'URL), sinon null. */
  deletedAt: string | null;
}

export interface EditionInput {
  nom: string;
  annee: number;
  confSlug: string | null;
  statut: EditionStatut;
  description: string | null;
  confNom: string | null;
  /** Lieu de la conf (ville OU pays) : facultatif (la duplication et la
   * création via le registre ne le posent pas). */
  confLieu?: string | null;
  confDate: string | null;
  confLien: string | null;
  finaleDate: string | null;
  finaleLieu: string | null;
  inscriptionsDebut?: string | null;
  inscriptionsFin?: string | null;
  /** Événement de la référence des conférences (migration 027), facultatif. */
  conferenceEditionId?: number | null;
}

interface EditionRow {
  id: number;
  nom: string;
  annee: number;
  conf_slug: string | null;
  statut: EditionStatut;
  description: string | null;
  conf_nom: string | null;
  conf_lieu: string | null;
  conf_date: string | null;
  conf_lien: string | null;
  finale_date: string | null;
  finale_lieu: string | null;
  conference_edition_id: number | null;
  inscriptions_debut: string | null;
  inscriptions_fin: string | null;
  deleted_at: string | Date | null;
}

function mapRow(r: EditionRow): Edition {
  return {
    id: r.id,
    nom: r.nom,
    annee: r.annee,
    confSlug: r.conf_slug,
    statut: r.statut,
    description: r.description,
    confNom: r.conf_nom,
    confLieu: r.conf_lieu,
    confDate: r.conf_date,
    confLien: r.conf_lien,
    finaleDate: r.finale_date,
    finaleLieu: r.finale_lieu,
    conferenceEditionId: r.conference_edition_id,
    inscriptionsDebut: r.inscriptions_debut,
    inscriptionsFin: r.inscriptions_fin,
    deletedAt:
      r.deleted_at instanceof Date ? r.deleted_at.toISOString() : r.deleted_at,
  };
}

// conf_date / finale_date renvoyées en chaîne via le type parser global (db.ts).
const COLS = `id, nom, annee, conf_slug, statut, description,
              conf_nom, conf_lieu, conf_date, conf_lien, finale_date, finale_lieu,
              conference_edition_id, inscriptions_debut, inscriptions_fin, deleted_at`;

/** Liste les éditions (hors supprimées), la plus récente d'abord. */
export const listEditions = cache(async function listEditions(): Promise<Edition[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_editions
      WHERE deleted_at IS NULL ORDER BY annee DESC, id DESC`,
  );
  return (rows as EditionRow[]).map(mapRow);
})

/** Une édition publique a forcément un slug : c'est son adresse. */
export type EditionPublique = Edition & { confSlug: string };

/**
 * LE sélecteur du public : une édition en préparation n'existe pas
 * publiquement (même invariant que le 404 de sa page), et une édition sans
 * slug de conférence n'est adressable nulle part. Consommé par la vitrine
 * `/tremplin`, le sitemap et le pré-rendu des pages d'édition — avant lui,
 * chacun refaisait les filtres dans son coin.
 */
export function editionsPubliques(editions: Edition[]): EditionPublique[] {
  return editions.filter(
    (e): e is EditionPublique => e.statut !== "preparation" && e.confSlug != null,
  );
}

/** Les éditions publiques, la plus récente d'abord (hors supprimées d'office). */
export async function listEditionsPubliques(): Promise<EditionPublique[]> {
  return editionsPubliques(await listEditions());
}

/**
 * Sélectionne l'édition « en cours » pour un accès rapide orga : parmi les
 * éditions actives (hors `archive`) dont la date de conf n'est pas passée (ou
 * pas encore posée), préfère le statut `en_cours`, sinon la conf à venir la plus
 * proche, sinon la première active. Dates au format AAAA-MM-JJ (comparaison
 * lexicographique avec `today`). Renvoie `null` si aucune. Fonction pure,
 * exportée pour être testée sans BDD.
 *
 * On borne « édition passée » sur `confDate` (et non `finaleDate`) : la conf est
 * le dernier jalon public de l'édition (la finale la précède), donc l'édition
 * reste « en cours » jusqu'à sa conf.
 */
export function pickEditionEnCours(
  editions: Edition[],
  today: string,
): { id: number; nom: string } | null {
  return pickEditionsActives(editions, today)[0] ?? null;
}

/**
 * TOUTES les éditions actives, ordonnées par la préférence de
 * `pickEditionEnCours` (en_cours, puis conf la plus proche, puis sans date) :
 * la feuille ➕ « Ajouter un atelier » (lot N1 §2.4) mène direct au formulaire
 * quand il n'y en a qu'une, et fait choisir quand il y en a plusieurs. Le tri
 * est STABLE (deux en_cours gardent leur ordre de liste), ce qui conserve le
 * choix historique de `pickEditionEnCours`. Fonction pure, testée sans BDD.
 */
export function pickEditionsActives(
  editions: Edition[],
  today: string,
): { id: number; nom: string }[] {
  const rang = (e: Edition) =>
    e.statut === "en_cours" ? 0 : e.confDate !== null ? 1 : 2;
  return editions
    .filter(
      (e) => e.statut !== "archive" && (e.confDate === null || e.confDate >= today),
    )
    .sort((a, b) => {
      const dr = rang(a) - rang(b);
      if (dr !== 0) return dr;
      if (rang(a) === 1 && a.confDate !== b.confDate)
        return a.confDate! < b.confDate! ? -1 : 1;
      return 0;
    })
    .map((e) => ({ id: e.id, nom: e.nom }));
}

/** Édition « en cours » (accès rapide orga) : cf. `pickEditionEnCours`. */
export async function getEditionEnCours(): Promise<{ id: number; nom: string } | null> {
  return pickEditionEnCours(await listEditions(), aujourdhuiParis());
}

/** Les éditions actives ordonnées : cf. `pickEditionsActives`. */
export async function getEditionsActives(): Promise<{ id: number; nom: string }[]> {
  return pickEditionsActives(await listEditions(), aujourdhuiParis());
}

/** Édition par id, côté ADMIN : exclut les supprimées (leur fiche n'existe plus ;
 * seule leur URL publique rend le tombstone). Mémoïsé PAR REQUÊTE
 * (`React.cache`) : layout, page et `generateMetadata` partagent le même
 * SELECT. Hors rendu React (tests, crons), `cache` est un simple passe-plat. */
export const getEditionById = cache(async function getEditionById(
  id: number,
): Promise<Edition | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_editions WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows.length > 0 ? mapRow(rows[0] as EditionRow) : null;
});

/** Crée une édition et renvoie son id (utilisé par le seed de reprise). */
export async function createEdition(e: EditionInput, db: Queryable = pool): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO tremplin_editions
       (nom, annee, conf_slug, statut, description, conf_nom, conf_lieu, conf_date, conf_lien,
        finale_date, finale_lieu, inscriptions_debut, inscriptions_fin, conference_edition_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      e.nom,
      e.annee,
      e.confSlug,
      e.statut,
      e.description,
      e.confNom,
      e.confLieu ?? null,
      e.confDate,
      e.confLien,
      e.finaleDate,
      e.finaleLieu,
      e.inscriptionsDebut ?? null,
      e.inscriptionsFin ?? null,
      e.conferenceEditionId ?? null,
    ],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Champs modifiables d'une édition. L'identité publique (conf_slug, annee)
 * n'est PAS modifiable ici : la changer casserait les URLs publiées.
 */
export interface EditionUpdate {
  nom: string;
  description: string | null;
  confNom: string | null;
  confLieu: string | null;
  confDate: string | null;
  confLien: string | null;
  finaleDate: string | null;
  finaleLieu: string | null;
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
  conferenceEditionId: number | null;
}

/**
 * Met à jour les champs éditoriaux d'une édition. Le STATUT n'en fait pas
 * partie : il a sa propre fonction (`setEditionStatut`, sous-page dédiée —
 * c'est là qu'on OUVRE une édition). Renvoie `false` si l'id n'existe pas.
 */
export async function updateEdition(editionId: number, e: EditionUpdate): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_editions
        SET nom = $2, description = $3, conf_nom = $4, conf_lieu = $5,
            conf_date = $6, conf_lien = $7, finale_date = $8, finale_lieu = $9,
            inscriptions_debut = $10, inscriptions_fin = $11,
            conference_edition_id = $12
      WHERE id = $1 AND deleted_at IS NULL`,
    [
      editionId,
      e.nom,
      e.description,
      e.confNom,
      e.confLieu,
      e.confDate,
      e.confLien,
      e.finaleDate,
      e.finaleLieu,
      e.inscriptionsDebut,
      e.inscriptionsFin,
      e.conferenceEditionId,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/** Change le statut d'une édition (c'est ICI qu'on l'ouvre au public, la clôt
 * ou l'archive). Renvoie `false` si l'id n'existe pas OU s'il est un tombstone
 * (défense en profondeur : on ne « rouvre » pas une édition supprimée). */
export async function setEditionStatut(
  editionId: number,
  statut: EditionStatut,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tremplin_editions SET statut = $2 WHERE id = $1 AND deleted_at IS NULL`,
    [editionId, statut],
  );
  return (rowCount ?? 0) > 0;
}

/** Périmètre chiffré d'une suppression d'édition (participantes, ateliers,
 * photos) : trois COUNT scopés, pour la sous-page « Suppression » — bien plus
 * léger que `chargerEditionEntrees` (qui charge tout pour le moteur de tâches).
 * Replis à 0 si une table manque (migration non jouée) : le périmètre reste
 * affichable. */
export async function getEditionDeletionCounts(editionId: number): Promise<{
  nbParticipantes: number;
  nbAteliers: number;
  nbPhotos: number;
  /** TOUT ce que la suppression emporte, y compris ce qu'on n'affiche pas au
   * détail (jury, récompenses, documents). Sert à décider du PALIER : une
   * édition à `total === 0` n'emporte rien en partant, donc pas de saisie à
   * retaper (cf. principes-conception-ui.md §10). Compter au détail serait du
   * bruit à l'écran ; ne compter que les trois affichés laisserait une édition
   * qui ne porte qu'un jury passer pour vide. */
  total: number;
}> {
  const compter = (table: string): Promise<number> =>
    pool
      .query(`SELECT count(*)::int AS n FROM ${table} WHERE edition_id = $1`, [editionId])
      .then((r) => (r.rows[0] as { n: number }).n)
      .catch(siTableAbsente(0)); // table absente (migration en attente) → 0
  const [nbParticipantes, nbAteliers, nbPhotos, nbJury, nbRecompenses, nbDocuments] =
    await Promise.all([
      compter("tremplin_registrations"),
      compter("tremplin_ateliers"),
      compter("tremplin_photos"),
      compter("tremplin_jury"),
      compter("tremplin_recompenses"),
      compter("tremplin_documents"),
    ]);
  return {
    nbParticipantes,
    nbAteliers,
    nbPhotos,
    total: nbParticipantes + nbAteliers + nbPhotos + nbJury + nbRecompenses + nbDocuments,
  };
}

/** Un compte est « totalement orphelin » (stub d'invitation JAMAIS honorée) — le
 * seul cas où on l'efface. On est volontairement CONSERVATEUR : est NON-orphelin
 * tout compte qui s'est connecté (`emailVerified` posé par le lien magique, ou une
 * ligne `accounts` OAuth), qui est orga, ou qui garde un lien ailleurs (profil,
 * adhésion, inscription, coaching, doc dont il est auteur, tag photo). Requêtes
 * simples (portable pg-mem : ni alias de cible ni corrélation). */
async function compteOrphelin(client: Queryable, userId: number): Promise<boolean> {
  const connecte = await client.query(
    `SELECT 1 FROM users WHERE id = $1 AND (is_orga = true OR "emailVerified" IS NOT NULL)`,
    [userId],
  );
  if (connecte.rows.length > 0) return false;
  const liens = [
    `SELECT 1 FROM accounts WHERE "userId" = $1`, // connexion OAuth = compte réel
    `SELECT 1 FROM speaker_profiles WHERE "userId" = $1`,
    `SELECT 1 FROM user_memberships WHERE "userId" = $1`,
    `SELECT 1 FROM tremplin_registrations WHERE "userId" = $1`,
    `SELECT 1 FROM tremplin_atelier_coachs WHERE user_id = $1`,
    `SELECT 1 FROM tremplin_registration_coachs WHERE user_id = $1`,
    `SELECT 1 FROM tremplin_documents WHERE auteur_id = $1`, // auteur d'un doc ailleurs
    `SELECT 1 FROM tremplin_photo_personnes WHERE user_id = $1`, // tagué sur une photo ailleurs
  ];
  for (const sql of liens) {
    const { rows } = await client.query(sql, [userId]);
    if (rows.length > 0) return false;
  }
  return true;
}

export type DeleteEditionOutcome = "hard" | "soft" | "introuvable";

/**
 * Supprime une édition (cf. docs/conception-suppression-edition.md), dans UNE
 * transaction :
 * - **`preparation`** (jamais publiée) → `hard` : `DELETE` de la ligne, tout le
 *   sous-arbre part par CASCADE.
 * - **publiée** → `soft` : on efface les données filles (perso comprises) mais on
 *   garde la coquille (`deleted_at = now()`) pour que l'URL publique rende un
 *   tombstone au lieu d'un 404.
 * Puis **ménage RGPD** : les comptes qui étaient rattachés à cette édition
 * (inscriptions/coachs) et qui deviennent TOTALEMENT orphelins (e-mail seul,
 * sans profil ni aucun autre rattachement, non-orga — les stubs créés par une
 * invitation jamais honorée) sont supprimés. Un vrai membre n'est jamais touché.
 * Renvoie `introuvable` si l'édition n'existe pas ou est déjà supprimée.
 */
export async function deleteEdition(editionId: number): Promise<DeleteEditionOutcome> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT statut, deleted_at FROM tremplin_editions WHERE id = $1`,
      [editionId],
    );
    if (rows.length === 0 || (rows[0] as { deleted_at: unknown }).deleted_at != null) {
      return "introuvable";
    }
    const statut = (rows[0] as { statut: EditionStatut }).statut;

    // Comptes rattachés à CETTE édition (avant suppression) : candidats au ménage.
    const { rows: candRows } = await client.query(
      `SELECT DISTINCT "userId" AS id FROM tremplin_registrations
        WHERE edition_id = $1 AND "userId" IS NOT NULL
       UNION
       SELECT ac.user_id AS id FROM tremplin_atelier_coachs ac
         JOIN tremplin_ateliers a ON a.id = ac.atelier_id WHERE a.edition_id = $1
       UNION
       SELECT rc.user_id AS id FROM tremplin_registration_coachs rc
         JOIN tremplin_registrations r ON r.id = rc.registration_id WHERE r.edition_id = $1`,
      [editionId],
    );
    const candidats = (candRows as { id: number }[]).map((r) => r.id);

    if (statut === "preparation") {
      await client.query(`DELETE FROM tremplin_editions WHERE id = $1`, [editionId]);
    } else {
      // Efface les données filles ; toutes les FK sont CASCADE (aucune RESTRICT),
      // donc l'ordre n'a pas d'importance pour l'intégrité.
      for (const table of [
        "tremplin_registrations",
        "tremplin_ateliers",
        "tremplin_jury",
        "tremplin_recompenses",
        "tremplin_documents",
        "tremplin_photos",
      ]) {
        await client.query(`DELETE FROM ${table} WHERE edition_id = $1`, [editionId]);
      }
      await client.query(`UPDATE tremplin_editions SET deleted_at = now() WHERE id = $1`, [
        editionId,
      ]);
    }

    // Ménage RGPD : un candidat devenu totalement orphelin est supprimé (boucle,
    // petit N).
    for (const userId of candidats) {
      if (await compteOrphelin(client, userId)) {
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
    }

    return statut === "preparation" ? "hard" : "soft";
  });
}

/** Une conférence connue (slug + nom + site), pour le sélecteur de création d'édition. */
export interface ConferenceRef {
  confSlug: string;
  confNom: string;
  confLieu: string | null;
  confLien: string | null;
}

/**
 * Conférences déjà utilisées par des éditions (pour proposer un sélecteur à la
 * création — cohérence des slugs, pas de doublon d'orthographe). Une entrée par
 * slug : le nom et le site viennent de l'édition la plus récente (un DISTINCT
 * (slug, nom) dupliquerait la conf si une édition a été renommée).
 */
export async function listConferences(): Promise<ConferenceRef[]> {
  const { rows } = await pool.query(
    `SELECT conf_slug, conf_nom, conf_lieu, conf_lien FROM tremplin_editions
      WHERE conf_slug IS NOT NULL AND conf_nom IS NOT NULL
      ORDER BY annee DESC, id DESC`,
  );
  const parSlug = new Map<string, ConferenceRef>();
  for (const r of rows as {
    conf_slug: string;
    conf_nom: string;
    conf_lieu: string | null;
    conf_lien: string | null;
  }[]) {
    if (!parSlug.has(r.conf_slug)) {
      parSlug.set(r.conf_slug, {
        confSlug: r.conf_slug,
        confNom: r.conf_nom,
        confLieu: r.conf_lieu,
        confLien: r.conf_lien,
      });
    }
  }
  return [...parSlug.values()].sort((a, b) => a.confNom.localeCompare(b.confNom, "fr"));
}

/**
 * Éditions PUBLIQUES d'une conférence (par slug), la plus récente d'abord.
 * Exclut les éditions « en préparation » : consommé uniquement par les pages
 * publiques (hub conf, page DevFest) — l'admin passe par `listEditions`.
 */
export const getEditionsByConfSlug = cache(async function getEditionsByConfSlug(
  confSlug: string,
): Promise<Edition[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_editions
      WHERE conf_slug = $1 AND statut <> 'preparation' AND deleted_at IS NULL
      ORDER BY annee DESC, id DESC`,
    [confSlug],
  );
  return (rows as EditionRow[]).map(mapRow);
});

/** Édition par (conf, année) — l'identité d'URL publique. Mémoïsée par rendu
 * (`React.cache`) : `generateMetadata` et le corps de page (via `getPublicEdition`)
 * partagent le même SELECT. Hors rendu React (tests, crons), simple passe-plat. */
export const getEditionByConfAndYear = cache(async function getEditionByConfAndYear(
  confSlug: string,
  annee: number,
): Promise<Edition | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM tremplin_editions WHERE conf_slug = $1 AND annee = $2`,
    [confSlug, annee],
  );
  return rows.length > 0 ? mapRow(rows[0] as EditionRow) : null;
});

/**
 * Paramètres statiques de `/tremplin/{conf}/{annee}`.
 *
 * ATTENTION, ne pas réutiliser tel quel pour la sous-page « montée sur scène » :
 * son périmètre est plus étroit PAR CONCEPTION (elle fait `notFound()` quand
 * l'édition n'a ni atelier de montée sur scène ni accompagnée). Lui servir cet
 * ensemble-ci pré-rendrait des 404, au prix d'une douzaine de requêtes et d'un
 * rendu complet chacun. Elle a son propre helper juste en dessous.
 *
 * Pré-rendre ces pages évite qu'elles restent rendues à la demande, auquel cas
 * le premier visiteur après un déploiement interroge la base sur le chemin
 * chaud — et un réveil de Neon raté lui sert un 500, sur le parcours vers
 * lequel pointent les annonces. Voir docs/google-ad-grants.md.
 *
 * Résilient : base injoignable au build → liste vide, retour au rendu à la
 * demande. La trace est explicite, sans quoi un build sans base ne pré-rend
 * rien ET ne dit rien, alors que la doc demande de le vérifier au journal.
 */
export async function paramsEditionsPubliques(): Promise<
  { conf: string; annee: string }[]
> {
  try {
    const editions = await listEditionsPubliques();
    return editions.map((e) => ({ conf: e.confSlug, annee: String(e.annee) }));
  } catch (e) {
    console.warn("paramsEditionsPubliques : base injoignable, rendu à la demande", e);
    return [];
  }
}
