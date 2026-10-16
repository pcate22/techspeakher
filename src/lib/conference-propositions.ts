// Propositions de conférences par les membres (migration 041) — modération.
// Une speakeuse signale une conférence manquante ; la proposition attend ici
// jusqu'à validation orga. Rien n'entre dans `conferences` / `conference_editions`
// avant validation → aucune donnée non validée ne fuit dans les sélecteurs ni le
// moissonneur (contrairement à un flag « à valider » qu'il faudrait filtrer partout).
//
// Migration 068 — la proposition ne bloque plus la saisie. L'occurrence saisie
// avec cette conférence est enregistrée TOUT DE SUITE et pointe la proposition
// (`talk_occurrences.proposition_id`) ; à la validation, elle est rattachée à
// l'édition réelle et passe en ligne telle quelle. Corollaire : une proposition
// n'est plus SUPPRIMÉE à l'arbitrage (des occurrences la référencent), elle
// change de `statut`.

import { pool, withTransaction, type Queryable } from "@/lib/db";
import { siTableAbsente } from "@/lib/pg-errors";
import {
  slugifyConference,
  saveEdition,
  buildEditionLibelle,
  type SaveEditionResult,
} from "@/lib/conferences";

export interface ConferencePropositionInput {
  /** Autrice de la proposition (créditée à la promotion). */
  userId: number;
  nomConference: string;
  annee: number | null;
  ville: string | null;
  url: string | null;
  /** Id d'endpoint Sessionize (déjà testé par l'appelant), ou null. */
  endpoint: string | null;
}

export interface ConferenceProposition {
  id: number;
  nom: string;
  annee: number | null;
  ville: string | null;
  url: string | null;
  endpoint: string | null;
  /** Nom de l'autrice (JOIN users, vue orga uniquement), ou null. */
  proposeParNom: string | null;
  /**
   * Saisies qui attendent derrière cette proposition : autant de talks qui
   * passeront en ligne d'un coup à la validation. Affiché côté orga pour que
   * l'arbitrage se fasse en connaissance de cause.
   */
  talksEnAttente: number;
  createdAt: string;
}

interface Row {
  id: number;
  nom: string;
  annee: number | null;
  ville: string | null;
  url: string | null;
  endpoint: string | null;
  propose_par: number | null;
  propose_par_nom: string | null;
  talks_en_attente: number;
  created_at: string;
}

/** Une ligne → le DTO orga. Une seule épellation, deux lectures : la file, et
 * la page d'UNE proposition. */
function mapProposition(r: Row): ConferenceProposition {
  return {
    id: r.id,
    nom: r.nom,
    annee: r.annee,
    ville: r.ville,
    url: r.url,
    endpoint: r.endpoint,
    proposeParNom: r.propose_par_nom ?? null,
    talksEnAttente: r.talks_en_attente ?? 0,
    createdAt: r.created_at,
  };
}

/** Enregistre une proposition (aucune écriture dans le répertoire à ce stade). */
export async function createConferenceProposition(
  p: ConferencePropositionInput,
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO conference_propositions (nom, annee, ville, url, endpoint, propose_par)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [p.nomConference, p.annee, p.ville, p.url, p.endpoint, p.userId],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Ce que `userId` a déjà soumis pour cette conférence — deux questions, deux
 * portées, et la distinction n'est pas cosmétique.
 *
 * `aReutiliser` : une proposition en attente pour la MÊME (conférence, année).
 * On la réutilise au lieu d'en empiler une par talk : une même conférence sert
 * souvent plusieurs talks, l'orga arbitrerait N fois, et refuser les doublons
 * condamnerait les saisies restées derrière.
 *
 * La clé est bien (nom, ANNÉE), pas le nom seul : une proposition promeut UNE
 * édition datée, et toutes les saisies derrière elle héritent de son année et
 * de son libellé à la validation. Regrouper « Foo Conf 2023 » et « Foo Conf
 * 2024 » sous la même ligne publiait les deux talks sur la même édition, sous
 * un nom que la seconde autrice n'avait jamais tapé.
 *
 * `dejaEcartee` : le NOM (toutes années) a déjà été écarté. Là, la portée large
 * est la bonne — une orga qui écarte « Conf Bidon » écarte le nom, pas une
 * année ; le remettre en file avec une autre année contournerait l'arbitrage.
 *
 * `statut <> 'validee'` : une proposition validée a fait son office, la
 * conférence est au répertoire (c'est là qu'il faut la choisir).
 */
export async function findPropositionByNom(
  userId: number,
  nom: string,
  annee: number | null,
): Promise<{ aReutiliser: number | null; dejaEcartee: boolean }> {
  const { rows } = await pool.query(
    `SELECT id, statut, annee FROM conference_propositions
      WHERE propose_par = $1
        AND lower(btrim(nom)) = lower(btrim($2))
        AND statut <> 'validee'
      ORDER BY id DESC`,
    [userId, nom],
  );
  const lignes = rows as { id: number; statut: string; annee: number | null }[];
  const reutilisable = lignes.find(
    (l) => l.statut === "en_attente" && (l.annee ?? null) === annee,
  );
  return {
    aReutiliser: reutilisable?.id ?? null,
    dejaEcartee: lignes.some((l) => l.statut === "refusee"),
  };
}

export type SoumissionResult =
  | { ok: true; propositionId: number; reutilisee: boolean }
  | { ok: false; raison: "ecartee" | "nom_invalide" };

/**
 * LA porte d'entrée d'une proposition de conférence — les deux écrans qui en
 * déposent une passent par ici (le formulaire d'occurrence d'un talk, et
 * « Ta conf n'y est pas ? Propose-la » du repérage).
 *
 * Elle porte les deux règles d'arbitrage, pour qu'aucune ne dépende de la porte
 * empruntée : REGROUPEMENT par (conférence, année) — la même édition sert
 * souvent plusieurs talks, l'orga n'a pas à trancher N fois — et REFUS d'un nom
 * déjà écarté, qui reviendrait sinon dans la file par l'autre écran.
 *
 * Le rate-limit reste à l'appelant : lui seul sait sur quel champ poser
 * l'erreur, et une réutilisation ne consomme aucun quota.
 */
export async function soumettreProposition(
  p: ConferencePropositionInput,
): Promise<SoumissionResult> {
  // Garde structurelle, quelle que soit la porte : un nom dont le slug serait
  // vide donnerait, à la promotion, une conférence inatteignable — et TOUS les
  // noms « tout symbole » suivants fusionneraient dessus (slug '' unique). Les
  // formulaires valident déjà (nomConfField) ; ici c'est le filet qui tient
  // même pour un appelant qui l'oublierait (l'import l'avait oublié).
  const nom = p.nomConference.trim();
  if (nom.length < 2 || nom.length > 160 || slugifyConference(nom).length === 0) {
    return { ok: false, raison: "nom_invalide" };
  }
  const deja = await findPropositionByNom(p.userId, p.nomConference, p.annee);
  if (deja.dejaEcartee) return { ok: false, raison: "ecartee" };
  if (deja.aReutiliser != null) {
    return { ok: true, propositionId: deja.aReutiliser, reutilisee: true };
  }
  return {
    ok: true,
    propositionId: await createConferenceProposition(p),
    reutilisee: false,
  };
}

/**
 * Corrige une proposition ENCORE EN ATTENTE, appartenant à `userId`, et que la
 * saisie `occurrenceId` est SEULE à tenir. Le `WHERE` porte les trois
 * conditions : rien n'est touché si la proposition est déjà arbitrée, si elle
 * est à quelqu'un d'autre, ou si une autre occurrence l'attend derrière —
 * `false`, jamais une erreur. L'appelant repart alors sur `soumettreProposition`
 * au lieu de réécrire la ligne des autres — ce qui détache la saisie sur une
 * proposition à elle DÈS QUE le nom ou l'année bouge. Si la clé (nom, année)
 * est inchangée (elle corrigeait juste sa ville), c'est la MÊME ligne qui est
 * retrouvée et la saisie y reste : sa correction vaut pour sa saisie, pas pour
 * la ligne d'arbitrage. C'est le prix du partage, et le bon : le talk de
 * l'autre repose dessus.
 *
 * La troisième condition est celle qui manquait. Le partage d'une proposition
 * entre plusieurs saisies est voulu (`findPropositionByNom` → `aReutiliser`) :
 * une même édition sert souvent plusieurs talks, et l'orga n'a pas à trancher
 * N fois. Mais à la validation, `rattacherOccurrences` estampille d'un coup
 * TOUTES les occurrences avec le nom et l'année que la proposition porte à cet
 * instant. Corriger la sienne en place republiait donc les autres sous une
 * édition à laquelle leur autrice n'avait pas participé — une correction de
 * date, ou même une faute de frappe sur le nom, suffisait. C'est exactement ce
 * que la clé (nom, ANNÉE) est censée empêcher (cf. `findPropositionByNom`).
 *
 * La condition est DANS le UPDATE plutôt que dans un `if` au-dessus : la
 * fenêtre de course se réduit à une instruction au lieu d'un aller-retour
 * applicatif. Elle ne se ferme pas pour autant — en READ COMMITTED le
 * `NOT EXISTS` voit le snapshot de l'instruction, donc une saisie insérée en
 * parallèle et validée juste après échappe encore au comptage. Sans effet en
 * pratique (c'est la même personne des deux côtés) ; le jour où ça compterait,
 * il faudrait verrouiller la proposition, pas déplacer la condition.
 *
 * Ce que cette fonction NE porte PAS, et que l'appelant doit avoir jugé avant :
 * le refus d'un nom déjà écarté, et l'unicité du (nom, année). Corriger en
 * place est une porte d'écriture au même titre que `soumettreProposition` ;
 * les arbitrages, eux, vivent au-dessus des deux.
 */
export async function updateConferenceProposition(
  cible: {
    /** La proposition à corriger. */
    propositionId: number;
    /** Son autrice présumée — l'autorisation, vérifiée en SQL. */
    userId: number;
    /** La saisie d'où vient la correction (celle qui a le droit de tenir). */
    occurrenceId: number;
  },
  p: {
    nomConference: string;
    annee: number | null;
    ville: string | null;
    url: string | null;
  },
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE conference_propositions cp
        SET nom = $4, annee = $5, ville = $6, url = $7
      WHERE cp.id = $1 AND cp.propose_par = $2 AND cp.statut = 'en_attente'
        AND NOT EXISTS (
          SELECT 1 FROM talk_occurrences o
           WHERE o.proposition_id = cp.id AND o.id <> $3
        )`,
    [
      cible.propositionId, cible.userId, cible.occurrenceId,
      p.nomConference, p.annee, p.ville, p.url,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Propositions EN ATTENTE (vue orga), la plus ANCIENNE d'abord — l'ordre dans
 * lequel on arbitre (celle qui attend depuis le plus longtemps passe la
 * première), et le même que celui de l'échéance portée par la tâche.
 *
 * BORNÉE. La page listait tout : un import de portefeuille l'a remplie de 113
 * lignes d'un coup (2026-08-21), et c'était le point de bascule que la dette
 * avait posé d'avance. Le plafond vit sur l'écran, qui annonce son compte
 * exact ; ici on prend ce qu'on affiche, et rien de plus — la suite se sait par
 * `countConferencePropositions`, pas par une ligne de rabiot.
 */
export async function listConferencePropositions(
  bornes: { limit: number; offset: number } = { limit: 200, offset: 0 },
): Promise<ConferenceProposition[]> {
  const { rows } = await pool
    .query(
      `SELECT cp.id, cp.nom, cp.annee, cp.ville, cp.url, cp.endpoint,
              cp.propose_par, u.name AS propose_par_nom,
              (SELECT COUNT(*)::int FROM talk_occurrences o
                WHERE o.proposition_id = cp.id) AS talks_en_attente,
              cp.created_at::text AS created_at
         FROM conference_propositions cp
         LEFT JOIN users u ON u.id = cp.propose_par
        WHERE cp.statut = 'en_attente'
        ORDER BY cp.created_at, cp.id
        LIMIT $1 OFFSET $2`,
      [bornes.limit, bornes.offset],
    )
    .catch(siTableAbsente({ rows: [] as Row[] }));
  return (rows as Row[]).map(mapProposition);
}

/**
 * Ce que le MOTEUR DE TÂCHES lit de la file : TROIS CHIFFRES, pas la file.
 *
 * La première version rendait les lignes (sans `talksEnAttente`, déjà, parce
 * que ce compte est une sous-requête PAR LIGNE). Elle restait SANS BORNE, et la
 * passe sécurité du lot a montré pourquoi c'était le mauvais compromis : ce
 * chemin est chaud. `desTachesAttendent` alimente le point de la barre basse,
 * rendue par les layouts de `/admin` ET de `/mon-espace` — donc CHAQUE page de
 * l'espace connecté vue par une orga matérialisait toute la file, jointe à
 * `users`. Et cette table-là, des membres la remplissent : 200 propositions par
 * lot d'import, 3 lots par heure.
 *
 * Or la tâche n'a besoin que de trois choses : COMBIEN (le libellé et le `nb`),
 * DEPUIS QUAND la plus vieille attend (l'échéance), et QUI/QUOI quand il n'y en
 * a qu'une (la ligne nommée). Le reste n'était lu que pour être compté.
 *
 * Une seule requête, bornée à une ligne : les deux agrégats en sous-requêtes,
 * la plus ancienne en `LEFT JOIN … ON true` pour que la ligne de résultat existe
 * même quand la file est vide (sinon les agrégats disparaissent avec elle).
 */
/**
 * UNION DISCRIMINÉE, et pas un objet à champs nullables : « la file compte 3 et
 * personne n'attend depuis une date » n'est pas un état du monde, et le lire
 * demandait au moteur une branche silencieuse — file non vide, aucune tâche
 * dérivée, « Tout roule » par-dessus. C'est-à-dire le défaut que tout ce lot
 * répare (relevé par la re-revue du 2026-08-22). Ici l'état n'est plus
 * exprimable : soit rien n'attend, soit il y a un compte ET une date.
 *
 * Le discriminant est `attend` et non `total: 0` : `0` est un `number`, donc
 * TypeScript ne peut pas s'en servir pour écarter l'autre branche — le type
 * aurait eu l'air fermé sans l'être, ce qui est pire que pas de type du tout.
 */
export type ResumeFilePropositions =
  | { attend: false }
  | {
      attend: true;
      total: number;
      /** Attente la plus ancienne : l'échéance de la ligne en dérive. */
      plusAncienne: string;
      /** La proposition, quand il n'y en a qu'UNE : la ligne la nomme et pointe
       * sa page. Au-delà, la ligne groupée mène à la file. */
      seule: { id: number; nom: string; proposeParNom: string | null } | null;
    };

interface ResumeRow {
  total: number;
  plus_ancienne: string | null;
  id: number | null;
  nom: string | null;
  propose_par_nom: string | null;
}

const RESUME_VIDE: ResumeFilePropositions = { attend: false };

export async function resumeFilePropositions(): Promise<ResumeFilePropositions> {
  const { rows } = await pool
    .query(
      `SELECT (SELECT COUNT(*)::int FROM conference_propositions
                WHERE statut = 'en_attente') AS total,
              (SELECT MIN(created_at)::text FROM conference_propositions
                WHERE statut = 'en_attente') AS plus_ancienne,
              f.id, f.nom, u.name AS propose_par_nom
         FROM (SELECT 1) AS toujours
         LEFT JOIN (
                SELECT id, nom, propose_par
                  FROM conference_propositions
                 WHERE statut = 'en_attente'
                 ORDER BY created_at, id
                 LIMIT 1
              ) f ON true
         LEFT JOIN users u ON u.id = f.propose_par`,
    )
    .catch(siTableAbsente({ rows: [] as ResumeRow[] }));
  const r = (rows as ResumeRow[])[0];
  // `plus_ancienne` nul avec un total non nul est impossible en base
  // (`created_at TIMESTAMPTZ NOT NULL`) : on le range quand même avec la file
  // vide, parce que le TYPE ne doit pas laisser le moteur choisir quoi en faire.
  if (!r || r.total === 0 || r.plus_ancienne === null) return RESUME_VIDE;
  return {
    attend: true,
    total: r.total,
    plusAncienne: r.plus_ancienne,
    // `total === 1` décide, pas la présence de la ligne : elle est toujours là
    // (c'est la plus ancienne de la file), et la nommer à 113 propositions
    // désignerait une seule d'entre elles au hasard de la date.
    seule:
      r.total === 1 && r.id != null && r.nom != null
        ? { id: r.id, nom: r.nom, proposeParNom: r.propose_par_nom ?? null }
        : null,
  };
}

/**
 * LA SAISIE qui attend derrière une proposition — ce que l'arbitrage n'avait
 * jamais eu sous les yeux (`docs/conception-arbitrage-conferences.md`, défaut B).
 *
 * L'invariant de visibilité (`proposition_id IS NOT NULL` ⇒ jamais public) tient
 * ces occurrences hors des pages publiques, et aucun écran orga ne montre les
 * talks d'une membre : il n'existait donc, dans tout le produit, aucun endroit
 * où LIRE ce qu'on arbitre.
 *
 * RGPD : aucune adresse e-mail dans le DTO — le nom seul, comme `proposeParNom`
 * le fait déjà sur la file. `profileId` ouvre la fiche (écran orga existant), il
 * ne recompose pas un moyen de contact.
 */
export interface SaisieEnAttente {
  occurrenceId: number;
  titre: string;
  autriceNom: string | null;
  profileId: number;
  date: string | null;
  ville: string | null;
  pays: string | null;
  lienConf: string | null;
  lienSlides: string | null;
  lienVideo: string | null;
  lienFeedback: string | null;
}

export interface PropositionDetail extends ConferenceProposition {
  saisies: SaisieEnAttente[];
}

interface SaisieRow {
  occurrence_id: number;
  titre: string;
  autrice_nom: string | null;
  profile_id: number;
  date: string | null;
  ville: string | null;
  pays: string | null;
  lien_conf: string | null;
  lien_slides: string | null;
  lien_video: string | null;
  lien_feedback: string | null;
}

/**
 * Une proposition EN ATTENTE et ses saisies, ou `null` (inconnue, ou déjà
 * arbitrée — la page dit alors « déjà traitée » au lieu d'un écran fantôme).
 */
export async function getPropositionEnAttente(
  id: number,
): Promise<PropositionDetail | null> {
  const { rows } = await pool
    .query(
      `SELECT cp.id, cp.nom, cp.annee, cp.ville, cp.url, cp.endpoint,
              cp.propose_par, u.name AS propose_par_nom,
              (SELECT COUNT(*)::int FROM talk_occurrences o
                WHERE o.proposition_id = cp.id) AS talks_en_attente,
              cp.created_at::text AS created_at
         FROM conference_propositions cp
         LEFT JOIN users u ON u.id = cp.propose_par
        WHERE cp.id = $1 AND cp.statut = 'en_attente'`,
      [id],
    )
    .catch(siTableAbsente({ rows: [] as Row[] }));
  if (rows.length === 0) return null;

  const { rows: saisies } = await pool
    .query(
      `SELECT o.id AS occurrence_id, t.titre,
              u.name AS autrice_nom, sp.id AS profile_id,
              o.date, o.ville, o.pays,
              o.lien_conf, o.lien_slides, o.lien_video, o.lien_feedback
         FROM talk_occurrences o
         JOIN speaker_talks t ON t.id = o.talk_id
         JOIN speaker_profiles sp ON sp.id = o.speaker_profile_id
         LEFT JOIN users u ON u.id = sp."userId"
        WHERE o.proposition_id = $1
        ORDER BY o.date DESC NULLS LAST, o.id`,
      [id],
    )
    .catch(siTableAbsente({ rows: [] as SaisieRow[] }));

  return {
    ...mapProposition(rows[0] as Row),
    saisies: (saisies as SaisieRow[]).map((r) => ({
      occurrenceId: r.occurrence_id,
      titre: r.titre,
      autriceNom: r.autrice_nom ?? null,
      profileId: r.profile_id,
      date: r.date,
      ville: r.ville,
      pays: r.pays,
      lienConf: r.lien_conf,
      lienSlides: r.lien_slides,
      lienVideo: r.lien_video,
      lienFeedback: r.lien_feedback,
    })),
  };
}

/**
 * Corrige une proposition en attente, PAR UNE ORGA (l'autorisation est à
 * l'appelant : `requireOrgaId`). Distincte de `updateConferenceProposition`, la
 * porte MEMBRE, et pas seulement par sa garde :
 *
 * - la porte membre ne touche que ce que la saisie appelante est SEULE à tenir,
 *   parce que la validation estampille TOUTES les occurrences derrière la
 *   proposition : corriger en place republiait le talk d'une autre sous un nom
 *   qu'elle n'avait jamais tapé ;
 * - celle-ci écrit en place, proposition partagée comprise, et c'est son
 *   mandat : le nom que l'orga fixe est celui du répertoire, donc celui de
 *   toutes les saisies derrière. La clé (nom, année) garantit qu'elles ont
 *   toutes tapé le même couple — corriger « DevoxxFR » en « Devoxx France »
 *   est vrai pour chacune d'elles.
 *
 * Seule garde conservée, et elle compte : `statut = 'en_attente'`. Une
 * proposition déjà arbitrée ne se réécrit pas, et `false` le dit — jamais une
 * erreur, jamais un succès faux.
 */
export async function updatePropositionParOrga(
  id: number,
  p: {
    nomConference: string;
    annee: number | null;
    ville: string | null;
    url: string | null;
    endpoint: string | null;
  },
): Promise<boolean> {
  return withTransaction(async (q) => {
    const { rowCount } = await q.query(
      `UPDATE conference_propositions
          SET nom = $2, annee = $3, ville = $4, url = $5, endpoint = $6
        WHERE id = $1 AND statut = 'en_attente'`,
      [id, p.nomConference, p.annee, p.ville, p.url, p.endpoint],
    );
    if ((rowCount ?? 0) === 0) return false;
    // ET le libellé figé des saisies qui attendent derrière. Sans cette seconde
    // écriture, la correction était ANNULÉE EN SILENCE par la membre elle-même
    // (relevé par la passe justesse du lot, sonde à l'appui) : `talk_occurrences.
    // conference` est le nom qu'elle voit dans son espace ET celui que son
    // formulaire pré-remplit. Elle revenait ajouter un lien de slides, renvoyait
    // « DevoxxFR » sans pouvoir savoir, `findPropositionByNom` ne trouvait plus
    // rien sous ce nom — et la porte membre réécrivait la ligne à l'ancien nom.
    // Le doublon de marque que cet écran existe pour empêcher redevenait
    // possible, sans que personne ne le voie passer.
    //
    // Le libellé seul : ni `ville`, ni `date`, ni les liens. Ce que la
    // speakeuse a saisi de son intervention reste à elle (règle du lot 068 :
    // « le lieu saisi par la speakeuse gagne »).
    //
    // Dans la MÊME transaction que la ligne d'arbitrage : deux noms qui
    // divergeraient à cause d'une coupure remettraient exactement le défaut
    // qu'on répare.
    await q.query(
      `UPDATE talk_occurrences SET conference = $2 WHERE proposition_id = $1`,
      [id, p.nomConference],
    );
    return true;
  });
}

/** Nombre de propositions en attente (badge orga), sans matérialiser les lignes. */
export async function countConferencePropositions(): Promise<number> {
  const { rows } = await pool
    .query(
      `SELECT COUNT(*)::int AS n FROM conference_propositions WHERE statut = 'en_attente'`,
    )
    .catch(siTableAbsente({ rows: [{ n: 0 }] }));
  return (rows[0] as { n: number }).n;
}

/**
 * Sentinelle d'annulation : RENVOYER un échec depuis `withTransaction` fait
 * quand même COMMIT (le callback n'a pas levé), ce qui laisserait la conférence
 * à moitié créée derrière un « conflit ». Seule une exception défait le bloc.
 */
const CONFLIT = new Error("conference_proposition_conflit");

export type ValidatePropositionResult =
  | { ok: true; conferenceEditionId: number; occurrences: number }
  | { ok: false; raison: "introuvable" | "conflit" };

/**
 * Valide une proposition : promeut vers le répertoire (conférence créée si
 * inconnue + édition), RATTACHE les saisies qui attendaient derrière elle, puis
 * marque la proposition validée. La conférence est `valide` de fait (créée par
 * une orga). L'endpoint a déjà été testé à la proposition.
 *
 * Une (conf, année) déjà référencée n'est PAS une erreur : on rattache à
 * l'édition existante au lieu de la réécrire (l'orga garde sa curation) — sinon
 * le doublon laisserait les occurrences bloquées en attente pour toujours. En
 * revanche, un conflit qu'on ne sait PAS résoudre (endpoint déjà pris par une
 * autre conférence, année absente) renvoie `conflit` : marquer « validée » sans
 * édition sortirait la proposition de la file en annonçant un succès, et les
 * saisies resteraient invisibles sans que personne ne puisse plus rien y faire.
 *
 * TOUT EN UNE TRANSACTION. Sans elle, une saisie arrivée entre le rattachement
 * et le passage en `validee` resterait accrochée à une proposition sortie de la
 * file : invisible pour toujours, et dans un état que `mapOccurrence` tient
 * pour impossible.
 */
export async function validateConferenceProposition(
  id: number,
): Promise<ValidatePropositionResult> {
  try {
    return await withTransaction(async (q) => {
      // FOR UPDATE : deux orga qui cliquent en même temps ne valident pas deux fois.
      const { rows } = await q.query(
        `SELECT nom, annee, ville, url, endpoint, propose_par
         FROM conference_propositions
        WHERE id = $1 AND statut = 'en_attente'
        FOR UPDATE`,
        [id],
      );
      if (rows.length === 0)
        return { ok: false, raison: "introuvable" } as const;
      const p = rows[0] as {
        nom: string;
        annee: number | null;
        ville: string | null;
        url: string | null;
        endpoint: string | null;
        propose_par: number | null;
      };

      // Promotion : conférence créée si inconnue (jamais réécrite), puis édition.
      // `pays` reste NULL : le formulaire de proposition n'en demande pas, et le
      // supposer « France » plantait un pays FAUX sur toute conférence étrangère
      // (KubeCon, Devoxx Belgium…), pays qui allait ensuite pré-remplir les
      // saisies suivantes. L'orga le complète depuis /admin/conferences.
      const slug = slugifyConference(p.nom);
      // `DO UPDATE SET nom = conferences.nom` : mise à jour NEUTRE, uniquement pour
      // que RETURNING tire aussi sur le chemin du conflit — et il renvoie alors la
      // ligne EXISTANTE (nom, ville, pays curés par l'orga), ce que la suite veut
      // précisément. Un DO NOTHING aurait imposé un second aller-retour, ici sous
      // verrou de transaction. Idiome déjà en place dans `ensureProfileId`.
      const { rows: confRows } = await q.query(
        `INSERT INTO conferences (slug, nom, ville, pays)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (slug) DO UPDATE SET nom = conferences.nom
       RETURNING id, nom, ville, pays`,
        [slug, p.nom, p.ville],
      );
      const conf = confRows[0] as {
        id: number;
        nom: string;
        ville: string | null;
        pays: string | null;
      };

      // SAVEPOINT : `saveEdition` RATTRAPE la violation d'unicité pour en faire
      // une erreur douce, mais dans une transaction l'instruction fautive avorte
      // tout le bloc — la requête suivante partirait en « current transaction is
      // aborted ». Le point de reprise rend son erreur récupérable, comme hors
      // transaction.
      await q.query("SAVEPOINT avant_edition");
      const saved: SaveEditionResult = await saveEdition(
        {
          conferenceId: conf.id,
          annee: p.annee,
          dateDebut: null,
          dateFin: null,
          ville: p.ville,
          lieu: null,
          url: p.url,
          endpoint: p.endpoint,
          proposePar: p.propose_par,
          actif: p.endpoint != null,
          // INSERT-only : ne jamais écraser une édition curée par l'orga.
          mode: "insert",
        },
        q,
      );
      if (!saved.ok) await q.query("ROLLBACK TO SAVEPOINT avant_edition");
      // (conf, année) déjà là : on rattache à l'édition existante plutôt que
      // d'échouer — refuser laisserait les saisies en attente sans issue.
      const editionId = saved.ok
        ? saved.id
        : await findEditionId(q, conf.id, p.annee);
      // Conflit non résolu (endpoint déjà pris par une autre conférence) : on LÈVE
      // pour annuler la transaction — la conférence tout juste créée disparaît
      // avec, et la proposition reste dans la file, telle que l'orga l'a laissée.
      if (editionId == null) throw CONFLIT;

      const libelle = buildEditionLibelle({
        confNom: conf.nom,
        type: "edition",
        nom: null,
        annee: p.annee,
        dateDebut: null,
      });
      const occurrences = await rattacherOccurrences(q, id, {
        conferenceId: conf.id,
        editionId,
        libelle,
        ville: p.ville ?? conf.ville,
        pays: conf.pays,
      });

      await q.query(
        `UPDATE conference_propositions SET statut = 'validee' WHERE id = $1`,
        [id],
      );
      return { ok: true, conferenceEditionId: editionId, occurrences } as const;
    });
  } catch (e) {
    if (e === CONFLIT) return { ok: false, raison: "conflit" };
    throw e;
  }
}

/** Édition (conférence, année) déjà en base — repli du doublon à la validation. */
async function findEditionId(
  q: Queryable,
  conferenceId: number,
  annee: number | null,
): Promise<number | null> {
  if (annee == null) return null;
  const { rows } = await q.query(
    `SELECT id FROM conference_editions WHERE conference_id = $1 AND annee = $2`,
    [conferenceId, annee],
  );
  return rows.length > 0 ? (rows[0] as { id: number }).id : null;
}

/**
 * Fait passer en ligne les saisies restées derrière la proposition : elles
 * pointent désormais le répertoire, et `proposition_id` retombe à NULL — c'est
 * LUI qui les tenait hors des affichages publics. Le lieu saisi par la
 * speakeuse gagne ; l'édition ne comble que ce qui était vide.
 *
 * Renvoie le nombre de saisies publiées, et réveille les fiches concernées
 * (`updated_at` : une publication EST un mouvement de fiche).
 */
async function rattacherOccurrences(
  q: Queryable,
  propositionId: number,
  cible: {
    conferenceId: number;
    editionId: number | null;
    libelle: string;
    ville: string | null;
    pays: string | null;
  },
): Promise<number> {
  const { rows } = await q.query(
    `UPDATE talk_occurrences
        SET conference_id = $2,
            edition_id = $3,
            conference = $4,
            ville = COALESCE(NULLIF(ville, ''), $5),
            pays  = COALESCE(NULLIF(pays, ''), $6),
            proposition_id = NULL
      WHERE proposition_id = $1
      RETURNING speaker_profile_id`,
    [
      propositionId,
      cible.conferenceId,
      cible.editionId,
      cible.libelle,
      cible.ville,
      cible.pays,
    ],
  );
  const profils = [
    ...new Set(
      (rows as { speaker_profile_id: number }[]).map(
        (r) => r.speaker_profile_id,
      ),
    ),
  ];
  if (profils.length > 0) {
    await q.query(
      `UPDATE speaker_profiles SET updated_at = now() WHERE id = ANY($1::int[])`,
      [profils],
    );
  }
  return rows.length;
}

/**
 * Écarte une proposition. La ligne RESTE (des saisies la référencent) : leurs
 * autrices voient « conférence écartée » dans leur espace et peuvent en choisir
 * une autre, au lieu de voir leur saisie disparaître sans explication.
 */
export async function refuseConferenceProposition(id: number): Promise<boolean> {
  // `AND statut = 'en_attente'` : la garde d'état de son jumeau, qui manquait
  // ici (dette relevée le 2026-08-16, soldée le 2026-08-21). Deux onglets sur la
  // file, l'une valide P, l'autre l'écarte depuis une page périmée : les
  // occurrences restaient en ligne, mais `findPropositionByNom` renvoyait dès
  // lors `dejaEcartee` pour ce nom TOUTES ANNÉES CONFONDUES — la membre se
  // voyait refuser à vie une conférence que l'équipe avait acceptée.
  //
  // Le booléen va jusqu'à l'écran : « déjà traitée » plutôt qu'un succès faux.
  const { rowCount } = await pool.query(
    `UPDATE conference_propositions SET statut = 'refusee'
      WHERE id = $1 AND statut = 'en_attente'`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}
