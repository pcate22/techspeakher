import { pool } from "./comptes-jetables";

/**
 * UNE ÉDITION DU TREMPLIN, JETABLE — le décor des parcours d'ORGA.
 *
 * Même raison qu'`e2e/comptes-jetables.ts`, un cran au-dessus : les parcours de
 * pilotage écrivent sur une ÉDITION entière (participantes, ateliers, photos,
 * coachs). Les jouer sur le décor partagé de `db/seed-preview.sql` ferait
 * tomber les specs qui le lisent — publier une participante casserait
 * l'invariante « une fiche en attente reste invisible », et supprimer l'édition
 * en cours emporterait `a11y.spec.ts` et `largeur.spec.ts`, qui l'auditent. On
 * aurait une suite dont le résultat dépend de l'ordre d'exécution.
 *
 * CHAQUE ÉDITION A SON PROPRE `conf_slug`, jamais `devfest-toulouse` : deux
 * tests parallèles ne peuvent alors ni se marcher dessus (index unique
 * `(conf_slug, annee)`), ni apparaître dans le hub de conférence que d'autres
 * specs regardent. L'adresse publique qui en découle est donc à nous seules.
 *
 * Les noms portent le domaine `@demo.techspeakher.test` du décor : couverts par
 * le garde-fou anti-prod du seed, et reconnaissables si un jeu de test
 * atterrissait un jour ailleurs.
 */

/** Suffixe unique : le pid sépare les workers, le compteur les tests. */
let compteur = 0;
const marqueur = () => `${process.pid}-${++compteur}`;

export type EditionJetable = {
  editionId: number;
  /** Le nom exact affiché par l'admin (et à retaper pour la supprimer). */
  nom: string;
  confSlug: string;
  annee: number;
  /** `/tremplin/<slug>/<annee>` — l'adresse publique de CETTE édition. */
  urlPublique: string;
  /** `/admin/tremplins/<id>` — son hub d'administration. */
  urlAdmin: string;
  /** Comptes créés pour ce décor, effacés avec lui. */
  comptes: number[];
};

export type ParticipanteJetable = {
  registrationId: number;
  userId: number;
  nom: string;
};

/**
 * Crée une édition vide.
 *
 * `statut` par défaut `clos` : une édition PUBLIQUE (`preparation` est un 404
 * public par conception). Les parcours qui parlent de la page publique ont
 * besoin qu'elle existe ; ceux qui n'en parlent pas s'en accommodent.
 */
export async function creerEdition(opts?: {
  statut?: "preparation" | "ouvert" | "en_cours" | "clos" | "archive";
  annee?: number;
}): Promise<EditionJetable> {
  const cle = marqueur();
  const confSlug = `e2e-jetable-${cle}`;
  const annee = opts?.annee ?? 2042;
  const nom = `Tremplin jetable ${cle}`;
  const { rows } = await pool().query(
    `INSERT INTO tremplin_editions (nom, annee, conf_slug, statut, description, conf_nom, conf_lieu)
     VALUES ($1, $2, $3, $4, 'Édition fabriquée par la suite E2E.', 'Conf de test', 'Toulouse')
     RETURNING id`,
    [nom, annee, confSlug, opts?.statut ?? "clos"],
  );
  const editionId = Number((rows[0] as { id: number }).id);
  return {
    editionId,
    nom,
    confSlug,
    annee,
    urlPublique: `/tremplin/${confSlug}/${annee}`,
    urlAdmin: `/admin/tremplins/${editionId}`,
    comptes: [],
  };
}

/**
 * Inscrit une participante (avec son compte) sur l'édition.
 *
 * Aucune fiche speakeuse n'est créée : la galerie publique nomme depuis
 * `COALESCE(participante_nom, users.name)`, et poser un profil ferait entrer
 * cette personne dans l'annuaire, donc dans le champ d'`annuaire.spec.ts`.
 *
 * `finaliste` (défaut : vrai) conditionne l'entrée en galerie — la requête
 * publique exige `finale_presente = true` EN PLUS du consentement. Une
 * participante non finaliste ne paraîtrait jamais, quel que soit le
 * consentement, et le test ne mesurerait plus rien.
 */
export async function ajouterParticipante(
  edition: EditionJetable,
  opts: { nom: string; finaliste?: boolean; publique?: boolean },
): Promise<ParticipanteJetable> {
  const cle = marqueur();
  const { rows: u } = await pool().query(
    `INSERT INTO users (name, email, "emailVerified") VALUES ($1, $2, now()) RETURNING id`,
    [opts.nom, `participante-${cle}@demo.techspeakher.test`],
  );
  const userId = Number((u[0] as { id: number }).id);
  edition.comptes.push(userId);

  const publique = opts.publique === true;
  const { rows: r } = await pool().query(
    `INSERT INTO tremplin_registrations
       (edition_id, "userId", statut, phase_entree, finale_presente, "public", public_consent_at)
     VALUES ($1, $2, 'acceptee', 'cfp_et_pitch', $3, $4, CASE WHEN $4 THEN now() END)
     RETURNING id`,
    [edition.editionId, userId, opts.finaliste !== false, publique],
  );
  const registrationId = Number((r[0] as { id: number }).id);
  return { registrationId, userId, nom: opts.nom };
}

/**
 * Inscrit la participante dans une PHASE, avec son consentement propre.
 *
 * `tremplin_registration_phases.public` (migration 055) est un consentement
 * DISTINCT de `tremplin_registrations.public` : le premier ouvre le chapitre
 * « montée sur scène », le second la galerie des finalistes. Le décor les tient
 * séparés pour que le test puisse vérifier qu'ils ne se contaminent pas.
 */
export async function inscrireEnPhase(
  participante: ParticipanteJetable,
  phase: "cfp_et_pitch" | "finale" | "montee_sur_scene",
  publique = false,
): Promise<void> {
  await pool().query(
    `INSERT INTO tremplin_registration_phases (registration_id, phase, "public", public_consent_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END)
     ON CONFLICT (registration_id, phase) DO NOTHING`,
    [participante.registrationId, phase, publique],
  );
}

/**
 * Ajoute un atelier. `auProgrammePublic` le fait paraître sur la page publique
 * — c'est aussi ce qui donne au chapitre « montée sur scène » de quoi exister
 * (sans séance publiée ni accompagnée nommée, la sous-page répond 404).
 */
export async function ajouterAtelier(
  edition: EditionJetable,
  opts: {
    titre: string;
    /** Pas de `finale` : `tremplin_ateliers_phase_check` ne connaît que ces
     * deux-là (la finale est une soirée, pas une séance d'accompagnement). */
    phase?: "cfp_et_pitch" | "montee_sur_scene";
    auProgrammePublic?: boolean;
    /**
     * Date de la séance (YYYY-MM-DD). Par défaut une date LOINTAINE, qui garde
     * le décor « à venir » quelle que soit l'année où la suite tourne. Les
     * parcours qui jugent le passé (l'agenda personnel remonte le fil) la
     * calent, eux, autour du jour même.
     */
    date?: string;
  },
): Promise<{ atelierId: number; titre: string }> {
  const { rows } = await pool().query(
    `INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, phase, au_programme_public, audience)
     VALUES ($1, 0, $2, $3::date, $4, $5, 'phase')
     RETURNING id`,
    [
      edition.editionId,
      opts.titre,
      opts.date ?? "2042-09-15",
      opts.phase ?? "cfp_et_pitch",
      opts.auProgrammePublic === true,
    ],
  );
  return { atelierId: Number((rows[0] as { id: number }).id), titre: opts.titre };
}

/** Place une participante dans l'atelier (ce que la coach rattachée verra). */
export async function placerDansAtelier(
  atelierId: number,
  participante: ParticipanteJetable,
): Promise<void> {
  await pool().query(
    `INSERT INTO tremplin_atelier_membres (atelier_id, registration_id) VALUES ($1, $2)`,
    [atelierId, participante.registrationId],
  );
}

/**
 * Ajoute une photo et y tague des participantes (droit à l'image).
 *
 * `getPublicPhotos` ne sert une photo que si TOUS ses tags sont couverts : un
 * tag d'inscription est couvert par le consentement de galerie de la personne.
 * Une photo taguée sur une participante non publique est donc invisible — et le
 * redevient dès qu'on lui retire son consentement. C'est cette cascade que le
 * parcours RGPD vérifie.
 */
export async function ajouterPhoto(
  edition: EditionJetable,
  opts: { legende: string; participantes: ParticipanteJetable[] },
): Promise<number> {
  const { rows } = await pool().query(
    `INSERT INTO tremplin_photos (edition_id, url, legende, kind)
     VALUES ($1, 'https://placehold.co/800x600?text=E2E', $2, 'soiree')
     RETURNING id`,
    [edition.editionId, opts.legende],
  );
  const photoId = Number((rows[0] as { id: number }).id);
  for (const p of opts.participantes) {
    await pool().query(
      `INSERT INTO tremplin_photo_personnes (photo_id, registration_id) VALUES ($1, $2)`,
      [photoId, p.registrationId],
    );
  }
  return photoId;
}

/**
 * Rattache une ACCOMPAGNANTE à un atelier, fiche saisie et accord PAS encore
 * recueilli.
 *
 * Le rattachement est posé en SQL, pas par l'interface : le geste d'admin qui
 * l'ouvre est déjà traversé par le parcours « Rattacher une coach », et le
 * rejouer ici n'ajouterait rien. Ce que le parcours du consentement exerce, lui,
 * est le geste SUIVANT — l'accord d'être citée.
 *
 * La fiche naît AVEC un rôle et SANS accord : c'est l'état réel du dépôt (« la
 * fiche neuve naît fermée », `src/lib/coach-profiles.ts`), et c'est aussi ce qui
 * rend l'étape 0 du test signifiante — décrire quelqu'un ne la publie pas.
 *
 * LE NOM REÇOIT UN SUFFIXE UNIQUE, et c'est indispensable ici (là où une
 * participante peut garder le sien) : une accompagnante est citée sur
 * `/partenaires`, page GLOBALE que l'édition jetable ne cloisonne pas. Deux
 * workers jouant ce parcours en parallèle créeraient deux homonymes, que le
 * `SELECT DISTINCT u.name, cp.role, cp.lien` de `listAccompagnantesPubliques`
 * fondrait en UNE ligne : le test verrait la coach de l'autre worker. Faux rouge
 * au retrait, et pire, faux VERT à l'accord — l'assertion qui garde la
 * revalidation passerait sans elle.
 */
export async function rattacherAccompagnante(
  edition: EditionJetable,
  atelierId: number,
  opts: { nom: string; role: string },
): Promise<{ userId: number; nom: string; role: string }> {
  const nom = `${opts.nom} ${marqueur()}`;
  const compte = await creerCompte(edition, nom);
  await pool().query(
    `INSERT INTO tremplin_atelier_coachs (atelier_id, user_id) VALUES ($1, $2)`,
    [atelierId, compte.userId],
  );
  await pool().query(`UPDATE users SET is_coach = true WHERE id = $1`, [compte.userId]);
  await pool().query(
    `INSERT INTO coach_profiles ("userId", role) VALUES ($1, $2)`,
    [compte.userId, opts.role],
  );
  return { userId: compte.userId, nom, role: opts.role };
}

/**
 * L'accord d'une accompagnante à être citée, et son horodatage.
 *
 * Il vit sur le COMPTE (`coach_profiles.public`), pas sur l'édition : une seule
 * révocation vaut pour toutes celles qu'elle a accompagnées. C'est le TROISIÈME
 * consentement du Tremplin, distinct de la galerie des finalistes et du chapitre
 * « montée sur scène ».
 */
export async function consentementAccompagnante(
  userId: number,
): Promise<{ public: boolean; horodate: boolean } | null> {
  const { rows } = await pool().query(
    `SELECT "public", public_consent_at FROM coach_profiles WHERE "userId" = $1`,
    [userId],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as { public: boolean; public_consent_at: Date | null };
  return { public: r.public, horodate: r.public_consent_at !== null };
}

/** Un compte sans rôle ni inscription (la future coach, avant rattachement). */
export async function creerCompte(
  edition: EditionJetable,
  nom: string,
): Promise<{ userId: number; nom: string; email: string }> {
  const email = `compte-${marqueur()}@demo.techspeakher.test`;
  const { rows } = await pool().query(
    `INSERT INTO users (name, email, "emailVerified") VALUES ($1, $2, now()) RETURNING id`,
    [nom, email],
  );
  const userId = Number((rows[0] as { id: number }).id);
  edition.comptes.push(userId);
  return { userId, nom, email };
}

/* ─────────────────── Lectures EN BASE (la vérité, pas l'écran) ─────────────────── */

/** Le consentement de galerie d'une inscription, et son horodatage. */
export async function consentementGalerie(
  registrationId: number,
): Promise<{ public: boolean; horodate: boolean } | null> {
  const { rows } = await pool().query(
    `SELECT "public", public_consent_at FROM tremplin_registrations WHERE id = $1`,
    [registrationId],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as { public: boolean; public_consent_at: Date | null };
  return { public: r.public, horodate: r.public_consent_at !== null };
}

/** Le journal RGPD (démontrabilité art. 7.1), du plus ancien au plus récent. */
export async function journalConsentement(
  registrationId: number,
): Promise<{ action: string; base: string | null }[]> {
  const { rows } = await pool().query(
    `SELECT action, base FROM tremplin_consent_log
      WHERE registration_id = $1 ORDER BY id`,
    [registrationId],
  );
  return rows as { action: string; base: string | null }[];
}

/**
 * Le rang de podium retenu en base, et les récompenses qui lui sont attribuées.
 *
 * LU EN BASE et pas relu à l'écran, pour deux raisons. La première est la
 * doctrine du fichier : une page peut afficher « c'est fait » pendant que
 * l'écriture a échoué. La seconde est mesurée — les écrans d'admin sont streamés
 * derrière `loading.tsx`, et sous charge le document porte un INSTANT deux copies
 * du même formulaire ; un `toHaveValue` sur le champ relu tombait alors en
 * « strict mode violation », sans qu'aucune garde n'ait bougé.
 */
export async function podiumEtRecompenses(
  registrationId: number,
): Promise<{ classement: number | null; recompenses: string[] }> {
  const { rows: inscription } = await pool().query(
    `SELECT classement FROM tremplin_registrations WHERE id = $1`,
    [registrationId],
  );
  const { rows: recompenses } = await pool().query(
    `SELECT intitule FROM tremplin_recompenses
      WHERE beneficiaire_registration_id = $1 ORDER BY intitule`,
    [registrationId],
  );
  const premiere = inscription[0] as { classement: number | null } | undefined;
  return {
    classement: premiere?.classement ?? null,
    recompenses: (recompenses as { intitule: string }[]).map((r) => r.intitule),
  };
}

/** Les intitulés des récompenses d'une édition, attribuées ou pas. */
export async function recompensesDeLEdition(editionId: number): Promise<string[]> {
  const { rows } = await pool().query(
    `SELECT intitule FROM tremplin_recompenses WHERE edition_id = $1 ORDER BY intitule`,
    [editionId],
  );
  return (rows as { intitule: string }[]).map((r) => r.intitule);
}

/** Les comptes coachs rattachés à un atelier. */
export async function coachsDeLAtelier(atelierId: number): Promise<number[]> {
  const { rows } = await pool().query(
    `SELECT user_id FROM tremplin_atelier_coachs WHERE atelier_id = $1 ORDER BY user_id`,
    [atelierId],
  );
  return (rows as { user_id: number }[]).map((r) => r.user_id);
}

/** Le marqueur de rôle posé sur le compte (lu à la connexion, comme `is_orga`). */
export async function estMarqueCoach(userId: number): Promise<boolean> {
  const { rows } = await pool().query(`SELECT is_coach FROM users WHERE id = $1`, [userId]);
  return rows.length > 0 && (rows[0] as { is_coach: boolean }).is_coach === true;
}

/** Ce que la suppression d'une édition doit avoir emporté. */
export async function resteDeLEdition(editionId: number): Promise<{
  supprimee: boolean;
  participantes: number;
  ateliers: number;
  photos: number;
}> {
  const un = async (sql: string): Promise<number> => {
    const { rows } = await pool().query(sql, [editionId]);
    return Number((rows[0] as { n: string }).n);
  };
  const { rows } = await pool().query(
    `SELECT deleted_at FROM tremplin_editions WHERE id = $1`,
    [editionId],
  );
  const supprimee =
    rows.length === 0 || (rows[0] as { deleted_at: Date | null }).deleted_at !== null;
  return {
    supprimee,
    participantes: await un(
      `SELECT count(*)::int AS n FROM tremplin_registrations WHERE edition_id = $1`,
    ),
    ateliers: await un(
      `SELECT count(*)::int AS n FROM tremplin_ateliers WHERE edition_id = $1`,
    ),
    photos: await un(`SELECT count(*)::int AS n FROM tremplin_photos WHERE edition_id = $1`),
  };
}

/**
 * Efface l'édition et les comptes créés pour elle.
 *
 * Idempotent, et volontairement en HARD delete (pas l'action métier, qui pose
 * un tombstone) : le décor doit disparaître même quand le test l'a déjà
 * supprimé par l'interface. Les comptes partent après, une fois les
 * inscriptions retirées par la cascade.
 */
export async function effacerEdition(edition: EditionJetable | null): Promise<void> {
  if (!edition) return;
  await pool().query(`DELETE FROM tremplin_editions WHERE id = $1`, [edition.editionId]);
  for (const userId of edition.comptes) {
    await pool().query(`DELETE FROM users WHERE id = $1`, [userId]);
  }
}
