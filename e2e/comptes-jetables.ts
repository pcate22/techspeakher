import { Pool } from "pg";
import { slugify } from "../src/lib/slug";

/**
 * DES COMPTES JETABLES, PARCE QUE LES ÉCRITURES SALISSENT.
 *
 * Les parcours en lecture peuvent partager le décor de `db/seed-preview.sql`.
 * Les parcours qui ÉCRIVENT, non : valider la fiche de Yasmine la ferait
 * paraître dans l'annuaire, et `annuaire.spec.ts` — qui exige justement qu'une
 * fiche en attente reste invisible — tomberait au passage suivant. Supprimer un
 * compte du décor le retirerait à tous les autres tests. On aurait alors une
 * suite dont le résultat dépend de l'ordre d'exécution : le pire des états,
 * parce qu'elle rougit sans qu'on ait rien cassé.
 *
 * Chaque parcours d'écriture travaille donc sur SON compte, créé juste avant et
 * effacé juste après. Le décor partagé reste en lecture seule.
 *
 * L'e-mail porte le domaine `@demo.techspeakher.test` : le même que le décor,
 * donc couvert par le garde-fou anti-prod du seed, et reconnaissable d'un coup
 * d'œil si un jeu de test atterrissait un jour ailleurs.
 */

let instance: Pool | undefined;

/**
 * LE pool du worker, partagé par tous les décors jetables (comptes ici,
 * éditions du Tremplin dans `tremplin-jetable.ts`). Un seul, parce que
 * `fermerBase()` n'en referme qu'un : un second pool ouvert ailleurs laisserait
 * le process Playwright suspendu à la fin de la suite, sans rien dire.
 */
export function pool(): Pool {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL absent : les parcours d'écriture ont besoin de la base " +
          "(cf. e2e/decor.ts et `npm run e2e:db`).",
      );
    }
    instance = new Pool({ connectionString, max: 2 });
  }
  return instance;
}

const db = pool;

/** Ferme le pool (appelé une fois la suite finie, pour que le process rende la main). */
export async function fermerBase(): Promise<void> {
  await instance?.end();
  instance = undefined;
}

export type MembreJetable = {
  userId: number;
  profileId: number | null;
  email: string;
  nom: string;
};

/** Suffixe unique : deux tests parallèles ne doivent jamais viser la même ligne. */
let compteur = 0;
export const marqueur = () => `jetable-${process.pid}-${++compteur}`;

/**
 * Crée un compte + (optionnellement) une fiche.
 *
 * `fiche: "prete"` pose TOUT ce que la complétude exige pour que le bouton
 * « Soumettre à l'annuaire » apparaisse — c'est-à-dire plus que les seules
 * règles de `raisonBlocageAnnuaire` : un nom, un profil rempli, **un talk**,
 * une joignabilité et l'attestation (cf. `espaceChecklist`, src/lib/espace.ts).
 *
 * La distinction a coûté un aller-retour : une fiche qui satisfait les règles
 * de SOUMISSION peut très bien n'afficher aucun bouton, parce que l'écran, lui,
 * attend la checklist complète. Un test qui l'ignore échoue sur « bouton
 * introuvable » et laisse croire à une régression de l'interface.
 */
export async function creerMembre(opts: {
  nom: string;
  fiche?: "aucune" | "brouillon" | "prete";
}): Promise<MembreJetable> {
  const cle = marqueur();
  const email = `${cle}@demo.techspeakher.test`;
  const { rows } = await db().query(
    `INSERT INTO users (name, email, "emailVerified") VALUES ($1, $2, now()) RETURNING id`,
    [opts.nom, email],
  );
  const userId = Number((rows[0] as { id: number }).id);

  let profileId: number | null = null;
  const fiche = opts.fiche ?? "aucune";
  if (fiche !== "aucune") {
    const prete = fiche === "prete";
    const { rows: p } = await db().query(
      `INSERT INTO speaker_profiles
         ("userId", titre_profil, bio, ville, contact_email_ok, is_woman, status)
       VALUES ($1, $2, $3, 'Toulouse', $4, $5, 'brouillon')
       RETURNING id`,
      [
        userId,
        "Fiche de test",
        "Bio de test, écrite par la suite E2E.",
        prete, // joignabilité : condition de `raisonBlocageAnnuaire`
        prete, // attestation
      ],
    );
    profileId = Number((p[0] as { id: number }).id);

    // L'étape « un talk ou une proposition de sujet » de la checklist : sans
    // elle, l'écran propose « Compléter… » au lieu de « Soumettre ».
    if (prete) {
      await db().query(
        `INSERT INTO speaker_talks (speaker_profile_id, titre, type)
         VALUES ($1, 'Un sujet que j''aimerais présenter', 'Conférence')`,
        [profileId],
      );
    }
  }

  return { userId, profileId, email, nom: opts.nom };
}

/**
 * Efface le compte et tout ce qui en dépend.
 *
 * `ON DELETE CASCADE` fait le gros du travail ; on vise `users` pour ne rien
 * oublier. Idempotent : un test qui échoue à mi-course laisse quand même la
 * base propre pour le suivant.
 *
 * L'ORDRE COMPTE depuis la migration 068. Une conférence proposée depuis un
 * talk laisse une ligne `conference_propositions` que `users` ne cascade PAS
 * (`propose_par` est SET NULL) : effacer le compte d'abord la rendrait
 * anonyme, donc introuvable, et elle resterait à traîner dans la file de
 * `/admin/conferences` pour les tests suivants. On vide donc les occurrences
 * (que la FK RESTRICT protège), puis les propositions, puis le compte.
 */
export async function effacerMembre(m: MembreJetable | null): Promise<void> {
  if (!m) return;
  await db().query(
    `DELETE FROM talk_occurrences
      WHERE speaker_profile_id IN (SELECT id FROM speaker_profiles WHERE "userId" = $1)`,
    [m.userId],
  );
  await db().query(`DELETE FROM conference_propositions WHERE propose_par = $1`, [
    m.userId,
  ]);
  await db().query(`DELETE FROM users WHERE id = $1`, [m.userId]);
}

/**
 * Publie la fiche DIRECTEMENT en base (raccourci de décor, pas un parcours).
 * Le vrai chemin soumission → validation orga a son propre test dans
 * `parcours-ecriture.spec.ts` ; le rejouer ici ne testerait rien de neuf et
 * allongerait un scénario qui parle d'autre chose.
 */
export async function publierFiche(m: MembreJetable): Promise<void> {
  await db().query(
    `UPDATE speaker_profiles SET status = 'publie' WHERE "userId" = $1`,
    [m.userId],
  );
}

/** Le premier talk du profil (celui que `fiche: "prete"` a posé). */
export async function premierTalkId(userId: number): Promise<number> {
  const { rows } = await db().query(
    `SELECT t.id FROM speaker_talks t
       JOIN speaker_profiles sp ON sp.id = t.speaker_profile_id
      WHERE sp."userId" = $1 ORDER BY t.id LIMIT 1`,
    [userId],
  );
  return Number((rows[0] as { id: number }).id);
}

/** Une conférence d'un talk, telle qu'elle est VRAIMENT enregistrée. */
export type OccurrenceEnBase = {
  conference: string | null;
  ville: string | null;
  /** Géographie exploitable (migration 072) : ce que la facette de l'agenda lira. */
  codeInsee: string | null;
  region: string | null;
  lienSlides: string | null;
  /** Non null = la conférence attend l'arbitrage orga → hors public. */
  propositionId: number | null;
  conferenceId: number | null;
};

/** Les conférences d'un talk lues EN BASE (l'écran peut mentir, pas la table). */
export async function occurrencesDuTalk(talkId: number): Promise<OccurrenceEnBase[]> {
  const { rows } = await db().query(
    `SELECT conference, ville, code_insee, region, lien_slides, proposition_id,
            conference_id
       FROM talk_occurrences WHERE talk_id = $1 ORDER BY id`,
    [talkId],
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    conference: r.conference as string | null,
    ville: r.ville as string | null,
    codeInsee: r.code_insee as string | null,
    region: r.region as string | null,
    lienSlides: r.lien_slides as string | null,
    propositionId: r.proposition_id == null ? null : Number(r.proposition_id),
    conferenceId: r.conference_id == null ? null : Number(r.conference_id),
  }));
}

/**
 * Nom d'une conférence hors répertoire, propre à ce test. Le slug est dérivé par
 * la VRAIE fonction du produit : le recalculer à la main ferait rater le ménage
 * (et grossir le décor en silence) le jour où la règle de slug change.
 */
export function conferenceJetable(): { nom: string; slug: string } {
  const nom = `E2E Conf ${marqueur()}`;
  return { nom, slug: slugify(nom) };
}

/**
 * Retire du répertoire une conférence promue pendant un test (slug `e2e-…`).
 * Sans ça, la validation d'une proposition laisserait la conférence dans le
 * sélecteur de tous les parcours suivants — un décor qui grossit à chaque run.
 */
export async function effacerConferenceJetable(slug: string): Promise<void> {
  await db().query(
    `DELETE FROM conference_editions
      WHERE conference_id IN (SELECT id FROM conferences WHERE slug = $1)`,
    [slug],
  );
  await db().query(`DELETE FROM conferences WHERE slug = $1`, [slug]);
}

/** L'état d'une fiche, lu EN BASE — la vérité, pas ce que l'écran raconte. */
export async function statutFiche(userId: number): Promise<string | null> {
  const { rows } = await db().query(
    `SELECT status FROM speaker_profiles WHERE "userId" = $1`,
    [userId],
  );
  return rows.length ? (rows[0] as { status: string }).status : null;
}

/** Le compte existe-t-il encore ? (suppression RGPD) */
export async function compteExiste(userId: number): Promise<boolean> {
  const { rows } = await db().query(`SELECT 1 FROM users WHERE id = $1`, [userId]);
  return rows.length > 0;
}
