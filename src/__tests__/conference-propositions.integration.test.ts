// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD des propositions de conférences (modération, migration 041 ;
 * saisies en attente, migration 068). Vrai Postgres (PGlite) + db/schema.sql.
 * Vérifie que RIEN n'entre dans le répertoire avant validation, que valider
 * promeut (conf + édition) sans écraser la curation orga, et surtout que la
 * SAISIE de la speakeuse survit à tout : gardée hors ligne pendant l'attente,
 * publiée telle quelle à la validation, conservée si la conférence est écartée.
 */
const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  /**
   * `withTransaction` du vrai `db.ts`, en version PGlite : une seule connexion,
   * donc BEGIN/COMMIT/ROLLBACK sur le pool suffisent. Sans lui, la validation
   * (transactionnelle depuis la revue) ne serait testée qu'à travers un mock —
   * et son ROLLBACK, justement, ne serait jamais joué.
   */
  const withTransaction = async <T,>(fn: (q: typeof pool) => Promise<T>): Promise<T> => {
    await pool.query("BEGIN");
    try {
      const r = await fn(pool);
      await pool.query("COMMIT");
      return r;
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  };
  return { holder, pool, withTransaction };
});
vi.mock("@/lib/db", () => ({ pool: h.pool, withTransaction: h.withTransaction }));

import {
  createConferenceProposition,
  updateConferenceProposition,
  findPropositionByNom,
  listConferencePropositions,
  countConferencePropositions,
  validateConferenceProposition,
  refuseConferenceProposition,
  updatePropositionParOrga,
  getPropositionEnAttente,
  resumeFilePropositions,
} from "@/lib/conference-propositions";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_occurrences, speaker_talks, speaker_profiles, conference_propositions, conference_editions, conferences, users RESTART IDENTITY CASCADE",
  );
});

async function newUser(name: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [name, `${name.toLowerCase()}@ex.fr`],
  );
  return (rows[0] as { id: number }).id;
}

/** Premier id renvoyé par un INSERT … RETURNING id. */
async function insertId(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await h.pool.query(sql, params);
  return (rows[0] as { id: number }).id;
}

/** Une speakeuse publiée (compte + fiche). */
async function newProfile(nom: string): Promise<{ userId: number; profileId: number }> {
  const userId = await newUser(nom);
  return {
    userId,
    profileId: await insertId(
      `INSERT INTO speaker_profiles ("userId", status) VALUES ($1, 'publie') RETURNING id`,
      [userId],
    ),
  };
}

/**
 * Un talk et sa saisie de conférence, éventuellement en attente derrière une
 * proposition. Le trio profil/talk/occurrence était recopié à chaque décor :
 * une colonne NOT NULL de plus se réparait autant de fois qu'il y avait de
 * copies, et elles divergeaient en attendant.
 */
async function nouveauTalkAvecSaisie(saisie: {
  profileId: number;
  titre: string;
  conference: string;
  propositionId: number | null;
  ville?: string | null;
  date?: string | null;
  lienSlides?: string | null;
}): Promise<{ talkId: number; occurrenceId: number }> {
  const talkId = await insertId(
    `INSERT INTO speaker_talks (speaker_profile_id, titre) VALUES ($1, $2) RETURNING id`,
    [saisie.profileId, saisie.titre],
  );
  return {
    talkId,
    occurrenceId: await insertId(
      `INSERT INTO talk_occurrences
         (talk_id, speaker_profile_id, conference, ville, date, lien_slides, proposition_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        talkId, saisie.profileId, saisie.conference, saisie.ville ?? null,
        saisie.date ?? null, saisie.lienSlides ?? null, saisie.propositionId,
      ],
    ),
  };
}

async function confCount(): Promise<number> {
  const { rows } = await h.pool.query(`SELECT COUNT(*)::int AS n FROM conferences`);
  return (rows[0] as { n: number }).n;
}

describe("conference_propositions — modération", () => {
  it("créer une proposition n'écrit RIEN dans le répertoire, et la file la liste", async () => {
    const u = await newUser("Morgane");
    await createConferenceProposition({
      userId: u,
      nomConference: "Sunny Tech",
      annee: 2026,
      ville: "Montpellier",
      url: "https://sunny-tech.io",
      endpoint: null,
    });

    // Rien dans le répertoire tant que non validé (le cœur de la garantie).
    expect(await confCount()).toBe(0);

    const props = await listConferencePropositions();
    expect(props).toHaveLength(1);
    expect(props[0].nom).toBe("Sunny Tech");
    expect(props[0].proposeParNom).toBe("Morgane"); // JOIN users, vue orga
    expect(await countConferencePropositions()).toBe(1);
  });

  it("valider promeut (conférence + édition) et vide la proposition de la file", async () => {
    const u = await newUser("Morgane");
    await createConferenceProposition({
      userId: u, nomConference: "Sunny Tech", annee: 2026, ville: "Montpellier",
      url: "https://sunny-tech.io", endpoint: null,
    });
    const [{ id }] = await listConferencePropositions();

    const r = await validateConferenceProposition(id);
    expect(r.ok).toBe(true);

    // La conférence + une édition 2026 existent désormais dans le répertoire.
    const { rows } = await h.pool.query(
      `SELECT c.nom, ce.annee FROM conference_editions ce
         JOIN conferences c ON c.id = ce.conference_id
        WHERE c.slug = 'sunny-tech'`,
    );
    expect(rows).toEqual([{ nom: "Sunny Tech", annee: 2026 }]);
    // La file est vidée.
    expect(await countConferencePropositions()).toBe(0);
  });

  it("valider une (conf, année) déjà référencée : rattache à l'existante, jamais de blocage", async () => {
    const u = await newUser("Morgane");
    // La conf + l'édition 2026 existent déjà (curées par l'orga).
    await h.pool.query(
      `INSERT INTO conferences (slug, nom, ville, pays) VALUES ('sunny-tech', 'Sunny Tech', 'Montpellier', 'France')`,
    );
    const { rows: dejaLa } = await h.pool.query(
      `INSERT INTO conference_editions (conference_id, annee, url)
       SELECT id, 2026, 'https://curee-par-orga.fr' FROM conferences WHERE slug='sunny-tech'
       RETURNING id`,
    );
    await createConferenceProposition({
      userId: u, nomConference: "Sunny Tech", annee: 2026, ville: "Montpellier",
      url: "https://saisie-membre.fr", endpoint: null,
    });
    const [{ id }] = await listConferencePropositions();

    const r = await validateConferenceProposition(id);
    // Un doublon n'est PAS une impasse : sinon les saisies derrière la
    // proposition resteraient hors ligne pour toujours.
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.conferenceEditionId).toBe((dejaLa[0] as { id: number }).id);
    expect(await countConferencePropositions()).toBe(0);

    // L'édition curée n'est PAS réécrite au passage.
    const { rows } = await h.pool.query(
      `SELECT url, COUNT(*) OVER ()::int AS n FROM conference_editions`,
    );
    expect(rows).toEqual([{ url: "https://curee-par-orga.fr", n: 1 }]);
  });

  it("valider un id inexistant → introuvable", async () => {
    const r = await validateConferenceProposition(9999);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe("introuvable");
  });

  it("refuser sort la proposition de la file sans rien créer (la ligne reste)", async () => {
    const u = await newUser("Morgane");
    await createConferenceProposition({
      userId: u, nomConference: "Conf Bidon", annee: null, ville: null, url: null, endpoint: null,
    });
    const [{ id }] = await listConferencePropositions();
    await refuseConferenceProposition(id);
    expect(await countConferencePropositions()).toBe(0);
    expect(await confCount()).toBe(0);
    // La ligne SURVIT (des saisies peuvent la référencer) : c'est ce qui permet
    // d'afficher « conférence écartée » plutôt qu'une saisie muette.
    const { rows } = await h.pool.query(
      `SELECT statut FROM conference_propositions WHERE id = $1`,
      [id],
    );
    expect(rows).toEqual([{ statut: "refusee" }]);
  });

  it("corriger sa proposition : seulement la sienne, et seulement tant qu'elle attend", async () => {
    const { userId: moi, profileId } = await newProfile("Morgane");
    const autre = await newUser("Aurelie");
    const id = await createConferenceProposition({
      userId: moi, nomConference: "Cloud Nord", annee: 2025, ville: null, url: null, endpoint: null,
    });
    const { occurrenceId } = await nouveauTalkAvecSaisie({
      profileId, titre: "Mon talk", conference: "Cloud Nord", propositionId: id,
    });
    const champs = { nomConference: "Cloud Nord Lille", annee: 2025, ville: "Lille", url: null };
    const cible = (userId: number) => ({ propositionId: id, userId, occurrenceId });

    expect(await updateConferenceProposition(cible(autre), champs)).toBe(false);
    expect(await updateConferenceProposition(cible(moi), champs)).toBe(true);
    expect((await listConferencePropositions())[0].nom).toBe("Cloud Nord Lille");

    await refuseConferenceProposition(id);
    // Arbitrée : plus modifiable (elle repart sur une proposition neuve).
    expect(await updateConferenceProposition(cible(moi), champs)).toBe(false);
  });

  it("la saisie invoquée doit VRAIMENT tenir la proposition, sinon rien n'est corrigé", async () => {
    // Ce que le `NOT EXISTS` garantit exactement, et qu'il faut savoir lire :
    // dès qu'une saisie attend derrière la proposition, invoquer une AUTRE
    // occurrence ne donne aucun droit — la condition ne peut que resserrer,
    // jamais élargir. Ce qu'il ne garantit PAS : que l'id passé tienne bien
    // cette proposition. Sur une proposition que personne ne tient (celles
    // déposées par « Propose-la », sans saisie), n'importe quel id passerait —
    // et c'est voulu : l'autorisation, elle, est portée par `propose_par`.
    const { userId, profileId } = await newProfile("Morgane");
    const id = await createConferenceProposition({
      userId, nomConference: "Cloud Nord", annee: 2025, ville: null, url: null, endpoint: null,
    });
    const { occurrenceId: tenue } = await nouveauTalkAvecSaisie({
      profileId, titre: "Talk qui attend", conference: "Cloud Nord", propositionId: id,
    });
    // Une saisie du MÊME profil, mais rattachée à rien : elle ne tient pas la ligne.
    const { occurrenceId: etrangere } = await nouveauTalkAvecSaisie({
      profileId, titre: "Talk sans rapport", conference: "DevFest", propositionId: null,
    });
    const champs = { nomConference: "Cloud Nord Lille", annee: 2025, ville: null, url: null };

    expect(
      await updateConferenceProposition({ propositionId: id, userId, occurrenceId: etrangere }, champs),
    ).toBe(false);
    expect(
      await updateConferenceProposition({ propositionId: id, userId, occurrenceId: 99_999 }, champs),
    ).toBe(false);
    // Le nom n'a pas bougé, et la vraie saisie corrige toujours.
    expect((await listConferencePropositions())[0].nom).toBe("Cloud Nord");
    expect(
      await updateConferenceProposition({ propositionId: id, userId, occurrenceId: tenue }, champs),
    ).toBe(true);
  });
});

/**
 * Le contrat du correctif (migration 068), bout en bout : la saisie n'est jamais
 * perdue, jamais publiée avant l'arbitrage, et publiée TELLE QUELLE après.
 */
describe("saisies en attente derrière une proposition", () => {
  /** Une speakeuse publiée, un talk, et une occurrence en attente de conf. */
  async function saisieEnAttente(
    prop: { nom: string; annee: number | null; ville: string | null },
    occ: { ville: string | null; date: string | null } = { ville: null, date: "2025" },
  ) {
    const { userId, profileId } = await newProfile("Morgane");
    const propositionId = await createConferenceProposition({
      userId, nomConference: prop.nom, annee: prop.annee, ville: prop.ville,
      url: null, endpoint: null,
    });
    const { talkId, occurrenceId } = await nouveauTalkAvecSaisie({
      profileId, titre: "Mon talk", conference: prop.nom, propositionId,
      ville: occ.ville, date: occ.date, lienSlides: "https://slides.example/x",
    });
    return { profileId, talkId, propositionId, occurrenceId };
  }

  it("valider publie la saisie TELLE QUELLE : liens et date gardés, conférence rattachée", async () => {
    const { occurrenceId, propositionId } = await saisieEnAttente(
      { nom: "Cloud Nord", annee: 2025, ville: "Lille" },
      { ville: "Roubaix", date: "2025-10-03" },
    );

    const r = await validateConferenceProposition(propositionId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.occurrences).toBe(1);

    const { rows } = await h.pool.query(
      `SELECT o.conference, o.ville, o.date, o.lien_slides, o.proposition_id,
              c.nom AS conf_nom, o.edition_id IS NOT NULL AS a_une_edition
         FROM talk_occurrences o
         JOIN conferences c ON c.id = o.conference_id
        WHERE o.id = $1`,
      [occurrenceId],
    );
    expect(rows).toEqual([{
      // Libellé recomposé depuis le répertoire (conf + année), pas le texte brut.
      conference: "Cloud Nord 2025",
      // Le lieu SAISI gagne sur celui de la proposition : c'est le sien.
      ville: "Roubaix",
      date: "2025-10-03",
      lien_slides: "https://slides.example/x",
      // Libérée : plus rien ne la retient hors des affichages publics.
      proposition_id: null,
      conf_nom: "Cloud Nord",
      a_une_edition: true,
    }]);
  });

  it("valider comble le lieu resté vide avec celui de la conférence", async () => {
    const { occurrenceId, propositionId } = await saisieEnAttente(
      { nom: "Cloud Nord", annee: 2025, ville: "Lille" },
      { ville: null, date: "2025" },
    );
    await validateConferenceProposition(propositionId);
    const { rows } = await h.pool.query(
      `SELECT ville, pays FROM talk_occurrences WHERE id = $1`,
      [occurrenceId],
    );
    // Le pays reste vide : la proposition n'en demande pas, et supposer
    // « France » plantait un pays FAUX sur les conférences étrangères.
    expect(rows).toEqual([{ ville: "Lille", pays: null }]);
  });

  it("promouvoir une conférence ne lui INVENTE pas un pays", async () => {
    const { propositionId } = await saisieEnAttente({
      nom: "Devoxx Belgium", annee: 2025, ville: "Anvers",
    });
    await validateConferenceProposition(propositionId);
    const { rows } = await h.pool.query(
      `SELECT ville, pays FROM conferences WHERE slug = 'devoxx-belgium'`,
    );
    expect(rows).toEqual([{ ville: "Anvers", pays: null }]);
  });

  it("refuser laisse la saisie EN PLACE, rattachée, et hors ligne", async () => {
    const { occurrenceId, propositionId } = await saisieEnAttente({
      nom: "Conf Bidon", annee: null, ville: null,
    });
    await refuseConferenceProposition(propositionId);

    const { rows } = await h.pool.query(
      `SELECT o.conference, o.conference_id, o.proposition_id, cp.statut
         FROM talk_occurrences o
         JOIN conference_propositions cp ON cp.id = o.proposition_id
        WHERE o.id = $1`,
      [occurrenceId],
    );
    // Sa saisie est toujours là (elle la corrigera), et toujours hors ligne.
    expect(rows).toEqual([{
      conference: "Conf Bidon", conference_id: null,
      proposition_id: propositionId, statut: "refusee",
    }]);
  });

  it("la file orga annonce combien de talks attendent derrière chaque proposition", async () => {
    const { propositionId } = await saisieEnAttente({
      nom: "Cloud Nord", annee: 2025, ville: "Lille",
    });
    const [prop] = await listConferencePropositions();
    expect(prop.id).toBe(propositionId);
    expect(prop.talksEnAttente).toBe(1);
  });

  it("une saisie en attente ne PEUT PAS pointer aussi le répertoire (CHECK en base)", async () => {
    const { occurrenceId } = await saisieEnAttente({
      nom: "Cloud Nord", annee: 2025, ville: null,
    });
    await h.pool.query(
      `INSERT INTO conferences (slug, nom) VALUES ('deja-la', 'Déjà Là')`,
    );
    // La contradiction est ce qui rendrait la saisie visible des lectures
    // publiques qui filtrent par edition_id / conference_id au lieu de
    // proposition_id (pages d'une conférence). Interdite EN BASE, pas seulement
    // évitée par le writer d'aujourd'hui.
    await expect(
      h.pool.query(
        `UPDATE talk_occurrences
            SET conference_id = (SELECT id FROM conferences WHERE slug = 'deja-la')
          WHERE id = $1`,
        [occurrenceId],
      ),
    ).rejects.toThrow();
  });

  it("supprimer une proposition derrière laquelle une saisie attend est REFUSÉ (jamais de publication muette)", async () => {
    const { propositionId } = await saisieEnAttente({
      nom: "Cloud Nord", annee: 2025, ville: null,
    });
    // Un SET NULL rendrait la saisie indiscernable d'une saisie libre publique.
    await expect(
      h.pool.query(`DELETE FROM conference_propositions WHERE id = $1`, [propositionId]),
    ).rejects.toThrow();
  });

  /**
   * Le partage est VOULU (une même édition sert plusieurs talks, l'orga
   * n'arbitre qu'une fois), et c'est lui qui rend la correction dangereuse :
   * à la validation, `rattacherOccurrences` estampille d'un coup TOUTES les
   * occurrences de la proposition, avec l'année et le nom qu'elle porte À CET
   * INSTANT. Une proposition corrigée depuis une saisie republie donc les
   * autres sous une édition que personne d'autre n'a tapée.
   *
   * D'où la garde : on ne corrige en place que ce qu'on est seule à tenir.
   */
  describe("une proposition tenue par plusieurs saisies", () => {
    /** Deux talks d'une même speakeuse, une seule proposition (Foo Conf 2023). */
    async function deuxSaisiesDerriereUneProposition() {
      const { userId, profileId } = await newProfile("Morgane");
      const propositionId = await createConferenceProposition({
        userId, nomConference: "Foo Conf", annee: 2023, ville: null, url: null, endpoint: null,
      });
      const [{ occurrenceId: occA }, { occurrenceId: occB }] = await Promise.all(
        ["Talk A", "Talk B"].map((titre) =>
          nouveauTalkAvecSaisie({
            profileId, titre, conference: "Foo Conf", propositionId, date: "2023",
          }),
        ),
      );
      return { userId, propositionId, occA, occB };
    }

    const en2024 = { nomConference: "Foo Conf", annee: 2024, ville: null, url: null };

    it("corriger depuis une saisie laisse la proposition INTACTE tant qu'une autre la tient", async () => {
      const { userId, propositionId, occB } = await deuxSaisiesDerriereUneProposition();

      expect(
        await updateConferenceProposition({ propositionId, userId, occurrenceId: occB }, en2024),
      ).toBe(false);

      // Le talk A, donné en 2023, ne part pas en ligne sous une édition 2024.
      const { rows } = await h.pool.query(
        `SELECT nom, annee FROM conference_propositions WHERE id = $1`,
        [propositionId],
      );
      expect(rows).toEqual([{ nom: "Foo Conf", annee: 2023 }]);
    });

    it("une faute de frappe sur le nom ne renomme pas l'édition des autres saisies", async () => {
      const { userId, propositionId, occB } = await deuxSaisiesDerriereUneProposition();

      expect(
        await updateConferenceProposition({ propositionId, userId, occurrenceId: occB }, {
          ...en2024, annee: 2023, nomConference: "Foo Conference",
        }),
      ).toBe(false);

      const { rows } = await h.pool.query(
        `SELECT nom FROM conference_propositions WHERE id = $1`,
        [propositionId],
      );
      expect(rows).toEqual([{ nom: "Foo Conf" }]);
    });

    it("redevenue seule à la tenir, la saisie corrige de nouveau sa proposition", async () => {
      const { userId, propositionId, occA, occB } = await deuxSaisiesDerriereUneProposition();
      await h.pool.query(`DELETE FROM talk_occurrences WHERE id = $1`, [occA]);

      expect(
        await updateConferenceProposition({ propositionId, userId, occurrenceId: occB }, en2024),
      ).toBe(true);
      const { rows } = await h.pool.query(
        `SELECT annee FROM conference_propositions WHERE id = $1`,
        [propositionId],
      );
      expect(rows).toEqual([{ annee: 2024 }]);
    });

    it("valider estampille TOUTES les saisies de la proposition — la raison de la garde", async () => {
      const { propositionId, occA, occB } = await deuxSaisiesDerriereUneProposition();

      const r = await validateConferenceProposition(propositionId);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.occurrences).toBe(2);

      const { rows } = await h.pool.query(
        `SELECT conference FROM talk_occurrences WHERE id = ANY($1::int[]) ORDER BY id`,
        [[occA, occB]],
      );
      expect(rows).toEqual([{ conference: "Foo Conf 2023" }, { conference: "Foo Conf 2023" }]);
    });
  });
});

/**
 * Une même conférence sert souvent PLUSIEURS talks. Sans regroupement, l'orga
 * voyait la même ligne N fois, et refuser les doublons condamnait les saisies
 * restées derrière.
 */
describe("l'orga arbitre : lire la saisie, corriger, et les gardes d'état", () => {
  /**
   * Le lot du 2026-08-21 (`docs/conception-arbitrage-conferences.md`). Ce qui se
   * joue ici : l'arbitrage était AVEUGLE (rien ne montrait la saisie), il n'y
   * avait pas de troisième porte (corriger), et le refus n'avait pas la garde
   * d'état de son jumeau.
   */
  async function decor() {
    const { userId, profileId } = await newProfile("Aurélie");
    const propositionId = await createConferenceProposition({
      userId,
      nomConference: "DevoxxFR",
      annee: 2025,
      ville: "Paris",
      url: null,
      endpoint: null,
    });
    await nouveauTalkAvecSaisie({
      profileId,
      titre: "Vous avez dit GitOps ?",
      conference: "DevoxxFR",
      propositionId,
      ville: "Paris",
      date: "2025-04-17",
      lienSlides: "https://slides.example/gitops",
    });
    return { userId, profileId, propositionId };
  }

  it("la page d'une proposition LIT la saisie qui attend derrière", async () => {
    // Le défaut d'origine : `proposition_id IS NOT NULL` tient l'occurrence hors
    // des pages publiques, et aucun écran orga ne montrait les talks d'une
    // membre. Il n'existait AUCUN endroit où lire ce qu'on arbitre.
    const { propositionId, profileId } = await decor();
    const p = await getPropositionEnAttente(propositionId);
    expect(p?.nom).toBe("DevoxxFR");
    expect(p?.saisies).toHaveLength(1);
    expect(p?.saisies[0]).toMatchObject({
      titre: "Vous avez dit GitOps ?",
      autriceNom: "Aurélie",
      profileId,
      date: "2025-04-17",
      lienSlides: "https://slides.example/gitops",
    });
  });

  it("le DTO de la saisie ne porte AUCUNE adresse e-mail", async () => {
    // Cliquet RGPD : l'écran d'arbitrage nomme, il ne recompose pas un moyen de
    // contact. Ajouter l'e-mail au SELECT fait tomber ce test.
    const { propositionId } = await decor();
    const p = await getPropositionEnAttente(propositionId);
    const serialise = JSON.stringify(p);
    expect(serialise).not.toContain("@");
    expect(Object.keys(p!.saisies[0])).not.toContain("email");
  });

  it("une proposition déjà arbitrée n'a plus de page (la file dit ce qui reste)", async () => {
    const { propositionId } = await decor();
    await refuseConferenceProposition(propositionId);
    expect(await getPropositionEnAttente(propositionId)).toBeNull();
  });

  it("corriger le nom vers celui du répertoire RATTACHE au lieu de créer une marque de plus", async () => {
    // LA décision structurante du lot : « rattacher à une conférence existante »
    // n'est pas une action de plus, c'est la correction du nom. La promotion
    // retombe d'elle-même sur la conférence existante (ON CONFLICT (slug)).
    const { propositionId } = await decor();
    const confId = await insertId(
      `INSERT INTO conferences (slug, nom, ville, pays) VALUES ('devoxx-france', 'Devoxx France', 'Paris', 'France') RETURNING id`,
      [],
    );
    expect(
      await updatePropositionParOrga(propositionId, {
        nomConference: "Devoxx France",
        annee: 2025,
        ville: "Paris",
        url: null,
        endpoint: null,
      }),
    ).toBe(true);

    const avant = await confCount();
    const r = await validateConferenceProposition(propositionId);
    expect(r.ok).toBe(true);
    // Aucune conférence de plus, et la ville/le pays curés par l'orga survivent.
    expect(await confCount()).toBe(avant);
    const { rows } = await h.pool.query(
      `SELECT conference_id, conference FROM talk_occurrences WHERE proposition_id IS NULL`,
    );
    expect(rows[0]).toMatchObject({ conference_id: confId, conference: "Devoxx France 2025" });
  });

  it("corriger une proposition PARTAGÉE vaut pour toutes les saisies derrière", async () => {
    // À l'inverse de la porte membre, et c'est le mandat de l'arbitrage : le nom
    // que l'orga fixe est celui du répertoire, donc celui de toutes les saisies.
    // La clé (nom, année) garantit qu'elles ont toutes tapé le même couple.
    const { propositionId } = await decor();
    const autre = await newProfile("Ada");
    await nouveauTalkAvecSaisie({
      profileId: autre.profileId,
      titre: "Le talk d'Ada",
      conference: "DevoxxFR",
      propositionId,
      date: "2025-04-18",
    });
    expect(
      await updatePropositionParOrga(propositionId, {
        nomConference: "Devoxx France",
        annee: 2025,
        ville: null,
        url: null,
        endpoint: null,
      }),
    ).toBe(true);
    const r = await validateConferenceProposition(propositionId);
    expect(r.ok && r.occurrences).toBe(2);
    const { rows } = await h.pool.query(
      `SELECT DISTINCT conference FROM talk_occurrences WHERE proposition_id IS NULL`,
    );
    expect(rows).toEqual([{ conference: "Devoxx France 2025" }]);
  });

  it("corriger renomme AUSSI ce que la membre voit : sa correction ne sera pas annulée", async () => {
    // Sans cette seconde écriture, la membre annulait la correction sans le
    // savoir : `talk_occurrences.conference` est le nom que son espace affiche
    // ET que son formulaire pré-remplit. Elle revenait ajouter un lien, son
    // écran renvoyait « DevoxxFR », `findPropositionByNom` ne trouvait plus
    // rien — et la porte membre réécrivait la ligne à l'ancien nom (sonde de la
    // passe justesse du 2026-08-21).
    const { userId, propositionId } = await decor();
    expect(
      await updatePropositionParOrga(propositionId, {
        nomConference: "Devoxx France",
        annee: 2025,
        ville: null,
        url: null,
        endpoint: null,
      }),
    ).toBe(true);
    const { rows } = await h.pool.query(
      `SELECT conference FROM talk_occurrences WHERE proposition_id = $1`,
      [propositionId],
    );
    expect(rows).toEqual([{ conference: "Devoxx France" }]);
    // Et la membre retrouve bien SA ligne sous le nom corrigé : elle la
    // rejoint au lieu d'en ouvrir une seconde.
    expect(await findPropositionByNom(userId, "Devoxx France", 2025)).toMatchObject({
      aReutiliser: propositionId,
    });
  });

  it("corriger une proposition ne renomme QUE ses saisies", async () => {
    // La seconde écriture n'est bornée par aucune contrainte de schéma : une
    // clause élargie renommerait le libellé de TOUTES les saisies en attente de
    // la base — l'écriture croisée entre membres, celle que le lot 068 avait
    // fermée dans l'autre sens. La mutation `AND $1 = $1` passait les 4 273
    // tests (re-revue du 2026-08-22).
    const { propositionId } = await decor();
    // Une AUTRE proposition, avec sa propre saisie…
    const autre = await newProfile("Ada");
    const autreProposition = await createConferenceProposition({
      userId: autre.userId, nomConference: "KubeCon EU", annee: 2025,
      ville: null, url: null, endpoint: null,
    });
    await nouveauTalkAvecSaisie({
      profileId: autre.profileId, titre: "Le talk d'Ada", conference: "KubeCon EU",
      propositionId: autreProposition,
    });
    // …et une saisie DÉJÀ publiée, qui ne dépend plus d'aucune proposition.
    await nouveauTalkAvecSaisie({
      profileId: autre.profileId, titre: "Talk publié", conference: "DevFest Toulouse 2025",
      propositionId: null,
    });

    await updatePropositionParOrga(propositionId, {
      nomConference: "Devoxx France", annee: 2025, ville: null, url: null, endpoint: null,
    });

    const { rows } = await h.pool.query(
      `SELECT t.titre, o.conference FROM talk_occurrences o
         JOIN speaker_talks t ON t.id = o.talk_id ORDER BY t.titre`,
    );
    expect(rows).toEqual([
      { titre: "Le talk d'Ada", conference: "KubeCon EU" },
      { titre: "Talk publié", conference: "DevFest Toulouse 2025" },
      { titre: "Vous avez dit GitOps ?", conference: "Devoxx France" },
    ]);
  });

  it("corriger ne touche NI le lieu, NI la date, NI les liens de la saisie", async () => {
    // Ce que la speakeuse a saisi de son intervention reste à elle : l'orga
    // arbitre un NOM de conférence, pas le récit de sa scène.
    const { propositionId } = await decor();
    await updatePropositionParOrga(propositionId, {
      nomConference: "Devoxx France",
      annee: 2025,
      ville: "Lyon",
      url: null,
      endpoint: null,
    });
    const { rows } = await h.pool.query(
      `SELECT ville, date, lien_slides FROM talk_occurrences WHERE proposition_id = $1`,
      [propositionId],
    );
    expect(rows[0]).toEqual({
      ville: "Paris",
      date: "2025-04-17",
      lien_slides: "https://slides.example/gitops",
    });
  });

  it("corriger une proposition DÉJÀ arbitrée n'écrit rien", async () => {
    const { propositionId } = await decor();
    await refuseConferenceProposition(propositionId);
    expect(
      await updatePropositionParOrga(propositionId, {
        nomConference: "Devoxx France",
        annee: 2025,
        ville: null,
        url: null,
        endpoint: null,
      }),
    ).toBe(false);
    const { rows } = await h.pool.query(
      `SELECT cp.nom, o.conference
         FROM conference_propositions cp
         JOIN talk_occurrences o ON o.proposition_id = cp.id
        WHERE cp.id = $1`,
      [propositionId],
    );
    // NI la ligne d'arbitrage, NI le libellé de la saisie : la transaction
    // n'écrit rien du tout quand la garde d'état refuse.
    expect(rows[0]).toEqual({ nom: "DevoxxFR", conference: "DevoxxFR" });
  });

  it("écarter une proposition VALIDÉE est refusé : l'arbitrage ne se réécrit pas", async () => {
    // La dette soldée. Sans la garde d'état, deux onglets suffisaient : les
    // occurrences restaient en ligne, mais `findPropositionByNom` renvoyait
    // ensuite `dejaEcartee` pour ce nom TOUTES ANNÉES confondues — la membre se
    // voyait refuser à vie une conférence que l'équipe avait acceptée.
    const { userId, propositionId } = await decor();
    expect((await validateConferenceProposition(propositionId)).ok).toBe(true);
    expect(await refuseConferenceProposition(propositionId)).toBe(false);
    const { rows } = await h.pool.query(
      `SELECT statut FROM conference_propositions WHERE id = $1`,
      [propositionId],
    );
    expect(rows[0]).toEqual({ statut: "validee" });
    // Et la membre n'est pas mise à l'index pour un nom qu'on a accepté.
    expect(await findPropositionByNom(userId, "DevoxxFR", 2024)).toMatchObject({
      dejaEcartee: false,
    });
  });

  it("le résumé du moteur : le compte, la plus vieille attente, et la seule quand elle l'est", async () => {
    const { propositionId } = await decor();
    const resume = await resumeFilePropositions();
    // `attend: false` est l'AUTRE branche de l'union — et le discriminant est là
    // pour que le type se ferme vraiment : au-delà, le compte ET la date
    // existent, le moteur n'a plus à choisir quoi faire d'une absence.
    if (!resume.attend) throw new Error("la file n'est pas vide ici");
    expect(resume.total).toBe(1);
    expect(resume.seule).toMatchObject({
      id: propositionId,
      nom: "DevoxxFR",
      proposeParNom: "Aurélie",
    });
    expect(typeof resume.plusAncienne).toBe("string");
  });

  it("le résumé ne NOMME plus personne dès qu'il y en a deux", async () => {
    // C'est le point du résumé : à 113 propositions, nommer « la première »
    // désignerait une seule d'entre elles au hasard de la date — et la lire
    // coûterait la file entière, sur chaque page de l'espace connecté.
    const { userId } = await decor();
    await createConferenceProposition({
      userId, nomConference: "KubeCon EU", annee: 2025, ville: null, url: null, endpoint: null,
    });
    const resume = await resumeFilePropositions();
    if (!resume.attend) throw new Error("la file n'est pas vide ici");
    expect(resume.total).toBe(2);
    expect(resume.seule).toBeNull();
  });

  it("le résumé d'une file VIDE : un seul état, `total: 0`", async () => {
    expect(await resumeFilePropositions()).toEqual({ attend: false });
  });

  it("une proposition ARBITRÉE plus ancienne ne contamine ni le compte, ni l'échéance, ni le nom", async () => {
    // Les trois lectures du résumé répètent le même prédicat (`statut =
    // 'en_attente'`) : le compte, la plus ancienne, et la ligne à nommer. Une
    // seule des trois qui glisserait donnerait une échéance en retard pour rien,
    // ou une ligne « À faire » qui nomme une conférence déjà écartée.
    const { userId, propositionId } = await decor();
    const ecartee = await createConferenceProposition({
      userId, nomConference: "Conf Écartée", annee: 2019, ville: null, url: null, endpoint: null,
    });
    await h.pool.query(
      `UPDATE conference_propositions SET created_at = now() - interval '400 days' WHERE id = $1`,
      [ecartee],
    );
    await refuseConferenceProposition(ecartee);

    const resume = await resumeFilePropositions();
    if (!resume.attend) throw new Error("la file n'est pas vide ici");
    expect(resume.total).toBe(1);
    expect(resume.seule).toMatchObject({ id: propositionId, nom: "DevoxxFR" });
    // L'échéance dérive de CETTE date : celle de l'écartée aurait mis la ligne
    // « en retard » d'un an.
    const { rows } = await h.pool.query(
      `SELECT created_at::text AS d FROM conference_propositions WHERE id = $1`,
      [propositionId],
    );
    expect(resume.plusAncienne).toBe((rows[0] as { d: string }).d);
  });

  it("une file qui ne contient QUE des arbitrées est vide pour le moteur", async () => {
    // Le prédicat de la requête, pas son montage : c'est lui qui décide ce que
    // « en attente » veut dire, et il est répété trois fois dans la même
    // requête (deux agrégats + la ligne). Une seule des trois qui glisserait
    // donnerait un compte sans date, ou une date sans compte.
    const { propositionId } = await decor();
    await refuseConferenceProposition(propositionId);
    expect(await resumeFilePropositions()).toEqual({ attend: false });
  });

  it("la plus vieille attente est bien la PLUS VIEILLE, pas la dernière arrivée", async () => {
    const { userId } = await decor();
    await h.pool.query(
      `UPDATE conference_propositions SET created_at = now() - interval '30 days'`,
    );
    const premier = await resumeFilePropositions();
    if (!premier.attend) throw new Error("la file n'est pas vide ici");
    const ancienne = premier.plusAncienne;
    await createConferenceProposition({
      userId, nomConference: "KubeCon EU", annee: 2025, ville: null, url: null, endpoint: null,
    });
    const second = await resumeFilePropositions();
    expect(second.attend ? second.plusAncienne : null).toBe(ancienne);
  });

  it("la file bornée : le plafond prend ce qu'on affiche, le compte dit le reste", async () => {
    const { userId } = await decor();
    for (const nom of ["A Conf", "B Conf", "C Conf"]) {
      await createConferenceProposition({
        userId, nomConference: nom, annee: 2025, ville: null, url: null, endpoint: null,
      });
    }
    expect(await countConferencePropositions()).toBe(4);
    const page1 = await listConferencePropositions({ limit: 2, offset: 0 });
    const page2 = await listConferencePropositions({ limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    // Aucune ligne vue deux fois, aucune perdue : l'ordre est total (créée, id).
    expect(new Set([...page1, ...page2].map((p) => p.id)).size).toBe(4);
  });
});

describe("findPropositionByNom — une proposition par conférence et par personne", () => {
  it("retrouve SA proposition en attente, casse et espaces ignorés", async () => {
    const moi = await newUser("Morgane");
    const id = await createConferenceProposition({
      userId: moi, nomConference: "Cloud Nord", annee: 2025, ville: null,
      url: null, endpoint: null,
    });
    expect(await findPropositionByNom(moi, "  cloud nord ", 2025)).toEqual({
      aReutiliser: id, dejaEcartee: false,
    });
  });

  it("ignore celle de quelqu'un d'autre (deux personnes, deux propositions)", async () => {
    const moi = await newUser("Morgane");
    const autre = await newUser("Aurelie");
    await createConferenceProposition({
      userId: autre, nomConference: "Cloud Nord", annee: 2025, ville: null,
      url: null, endpoint: null,
    });
    expect(await findPropositionByNom(moi, "Cloud Nord", 2025)).toEqual({
      aReutiliser: null, dejaEcartee: false,
    });
  });

  it("signale un nom déjà ÉCARTÉ (pour ne pas le remettre en file à l'identique)", async () => {
    const moi = await newUser("Morgane");
    const id = await createConferenceProposition({
      userId: moi, nomConference: "Conf Bidon", annee: null, ville: null,
      url: null, endpoint: null,
    });
    await refuseConferenceProposition(id);
    expect(await findPropositionByNom(moi, "Conf Bidon", null)).toEqual({
      aReutiliser: null, dejaEcartee: true,
    });
  });

  it("oublie une proposition VALIDÉE : la conférence est au répertoire, c'est là qu'on la choisit", async () => {
    const moi = await newUser("Morgane");
    const id = await createConferenceProposition({
      userId: moi, nomConference: "Cloud Nord", annee: 2025, ville: null,
      url: null, endpoint: null,
    });
    await validateConferenceProposition(id);
    expect(await findPropositionByNom(moi, "Cloud Nord", 2025)).toEqual({
      aReutiliser: null, dejaEcartee: false,
    });
  });
});

/**
 * Le piège que la revue a trouvé : une proposition promeut UNE édition datée.
 * Regrouper deux années sous la même ligne publiait les deux talks sur la même
 * édition, sous un libellé que la seconde autrice n'avait jamais tapé.
 */
describe("soumettreProposition — la garde structurelle de la porte", () => {
  it("un nom impromouvable (slug vide) est refusé, RIEN n'entre en file", async () => {
    const moi = await newUser("Morgane");
    // Trois portes possibles (formulaire d'occurrence, repérage, import) : la
    // garde vit dans la porte partagée pour tenir même si un appelant oublie
    // sa validation — l'import l'avait oubliée. Un slug vide donnerait une
    // conférence inatteignable où fusionneraient tous les noms « tout symbole ».
    const { soumettreProposition } = await import("@/lib/conference-propositions");
    for (const nom of ["☆☆☆", "x", "  "]) {
      const r = await soumettreProposition({
        userId: moi, nomConference: nom, annee: 2026, ville: null, url: null, endpoint: null,
      });
      expect(r).toEqual({ ok: false, raison: "nom_invalide" });
    }
    expect(await countConferencePropositions()).toBe(0);
  });
});

describe("clé de regroupement des propositions : (conférence, ANNÉE)", () => {
  it("deux années de la même conférence sont deux propositions distinctes", async () => {
    const moi = await newUser("Morgane");
    const p2023 = await createConferenceProposition({
      userId: moi, nomConference: "Foo Conf", annee: 2023, ville: null, url: null, endpoint: null,
    });
    const p2024 = await createConferenceProposition({
      userId: moi, nomConference: "Foo Conf", annee: 2024, ville: null, url: null, endpoint: null,
    });
    expect(p2023).not.toBe(p2024);

    expect(await findPropositionByNom(moi, "Foo Conf", 2023)).toEqual({
      aReutiliser: p2023, dejaEcartee: false,
    });
    expect(await findPropositionByNom(moi, "Foo Conf", 2024)).toEqual({
      aReutiliser: p2024, dejaEcartee: false,
    });
    // Une année encore jamais proposée n'en réutilise AUCUNE.
    expect(await findPropositionByNom(moi, "Foo Conf", 2025)).toEqual({
      aReutiliser: null, dejaEcartee: false,
    });
  });

  it("chaque année publie ses talks sur SON édition, avec SON libellé", async () => {
    const moi = await newUser("Morgane");
    const { rows: pr } = await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", status) VALUES ($1, 'publie') RETURNING id`,
      [moi],
    );
    const profileId = (pr[0] as { id: number }).id;

    async function talkAvecSaisie(annee: number): Promise<{ occId: number; propId: number }> {
      const { rows: t } = await h.pool.query(
        `INSERT INTO speaker_talks (speaker_profile_id, titre) VALUES ($1, $2) RETURNING id`,
        [profileId, `Talk ${annee}`],
      );
      const propId = await createConferenceProposition({
        userId: moi, nomConference: "Foo Conf", annee, ville: null, url: null, endpoint: null,
      });
      const { rows: o } = await h.pool.query(
        `INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, date, proposition_id)
         VALUES ($1, $2, 'Foo Conf', $3, $4) RETURNING id`,
        [(t[0] as { id: number }).id, profileId, String(annee), propId],
      );
      return { occId: (o[0] as { id: number }).id, propId };
    }

    const a = await talkAvecSaisie(2023);
    const b = await talkAvecSaisie(2024);

    expect((await validateConferenceProposition(a.propId)).ok).toBe(true);
    expect((await validateConferenceProposition(b.propId)).ok).toBe(true);

    const { rows } = await h.pool.query(
      `SELECT o.id, o.conference, ce.annee
         FROM talk_occurrences o JOIN conference_editions ce ON ce.id = o.edition_id
        WHERE o.id = ANY($1::int[]) ORDER BY ce.annee`,
      [[a.occId, b.occId]],
    );
    expect(rows).toEqual([
      { id: a.occId, conference: "Foo Conf 2023", annee: 2023 },
      { id: b.occId, conference: "Foo Conf 2024", annee: 2024 },
    ]);
  });

  it("une proposition sans année crée une édition non datée, et publie quand même", async () => {
    const moi = await newUser("Morgane");
    const id = await createConferenceProposition({
      userId: moi, nomConference: "Conf Sans Date", annee: null, ville: null, url: null, endpoint: null,
    });
    const r = await validateConferenceProposition(id);
    // Pas d'année ≠ conflit : l'événement existe, il n'est simplement pas daté.
    expect(r.ok).toBe(true);
    expect(await countConferencePropositions()).toBe(0);
  });

  /**
   * Le vrai cas de conflit trouvé en revue : l'endpoint Sessionize est déjà pris
   * par une AUTRE conférence (index unique partiel). `saveEdition` échoue, le
   * repli par (conf, année) ne trouve rien — et l'ancien code marquait quand
   * même « validée », sortant la ligne de la file en annonçant un succès.
   */
  it("endpoint déjà pris ailleurs : conflit annoncé, proposition GARDÉE, rien d'à moitié écrit", async () => {
    const moi = await newUser("Morgane");
    await h.pool.query(
      `INSERT INTO conferences (slug, nom) VALUES ('autre-conf', 'Autre Conf')`,
    );
    await h.pool.query(
      `INSERT INTO conference_editions (conference_id, annee, source, endpoint)
       SELECT id, 2030, 'sessionize', 'abc123def' FROM conferences WHERE slug = 'autre-conf'`,
    );

    const id = await createConferenceProposition({
      userId: moi, nomConference: "Conf Volée", annee: 2031, ville: null,
      url: null, endpoint: "abc123def",
    });
    const r = await validateConferenceProposition(id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe("conflit");

    // La transaction a TOUT annulé : la proposition attend encore, et la
    // conférence n'a pas été à moitié créée au passage.
    expect(await countConferencePropositions()).toBe(1);
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM conferences WHERE slug = 'conf-volee'`,
    );
    expect(rows).toEqual([{ n: 0 }]);
  });
});
