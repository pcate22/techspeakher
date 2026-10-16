import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * Tests d'intégration BDD (pg-mem + `db/schema.sql`) de `getMonAgenda` :
 * l'échéancier personnel fusionne les ateliers Tremplin (participation ou
 * animation) ET les talks à venir de la speakeuse (occurrences à date EXACTE,
 * cf. `isExactTalkDate` : « date exacte → agenda possible »), toutes éditions
 * confondues, triés chronologiquement.
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getMonAgenda,
  getMesProchainsTalks,
  hrefEcheance,
  hrefAtelier,
} from "@/lib/mon-agenda";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

const AUJOURDHUI = "2026-07-10";

async function insertUser(name: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name) VALUES($1) RETURNING id`,
    [name],
  );
  return (rows[0] as { id: number }).id;
}

async function insertProfile(userId: number): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_profiles("userId") VALUES($1) RETURNING id`,
    [userId],
  );
  return (rows[0] as { id: number }).id;
}

async function insertTalk(profileId: number, titre: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_talks(speaker_profile_id, titre) VALUES($1, $2) RETURNING id`,
    [profileId, titre],
  );
  return (rows[0] as { id: number }).id;
}

async function insertOccurrence(
  talkId: number,
  profileId: number,
  date: string | null,
  o: { conference?: string; ville?: string; lienConf?: string } = {},
): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO talk_occurrences(talk_id, speaker_profile_id, date, conference, ville, lien_conf)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING id`,
    [talkId, profileId, date, o.conference ?? null, o.ville ?? null, o.lienConf ?? null],
  );
  return (rows[0] as { id: number }).id;
}

/** Une speakeuse + un talk avec une occurrence datée, en un appel. */
async function speakeuseAvecTalk(
  name: string,
  titre: string,
  date: string | null,
  o: { conference?: string; ville?: string; lienConf?: string } = {},
) {
  const uid = await insertUser(name);
  const pid = await insertProfile(uid);
  const tid = await insertTalk(pid, titre);
  await insertOccurrence(tid, pid, date, o);
  return { uid, pid, tid };
}

describe("getMesProchainsTalks", () => {
  it("remonte les occurrences futures à date exacte, détails d'affichage compris", async () => {
    const { uid } = await speakeuseAvecTalk("Ada", "Mon talk IA", "2026-11-19", {
      conference: "DevFest",
      ville: "Toulouse",
      lienConf: "https://devfest.example.org",
    });

    const talks = await getMesProchainsTalks(uid, AUJOURDHUI);
    expect(talks).toHaveLength(1);
    expect(talks[0]).toMatchObject({
      titre: "Mon talk IA",
      date: "2026-11-19",
      conference: "DevFest",
      ville: "Toulouse",
      lienConf: "https://devfest.example.org",
    });
  });

  it("exclut les dates imprécises (année ou mois seuls) : l'agenda veut un jour", async () => {
    const uid = await insertUser("Ada");
    const pid = await insertProfile(uid);
    const tid = await insertTalk(pid, "Sans jour");
    await insertOccurrence(tid, pid, "2026-11");
    await insertOccurrence(tid, pid, "2027");
    await insertOccurrence(tid, pid, null);

    expect(await getMesProchainsTalks(uid, AUJOURDHUI)).toHaveLength(0);
  });

  it("exclut le passé, garde aujourd'hui, ignore les talks des autres", async () => {
    const { uid } = await speakeuseAvecTalk("Ada", "Ce soir", AUJOURDHUI);
    const { pid } = await speakeuseAvecTalk("Grace", "Pas à moi", "2026-12-01");
    const tid = await insertTalk(pid, "inutile");
    await insertOccurrence(tid, pid, "2026-06-01");

    const talks = await getMesProchainsTalks(uid, AUJOURDHUI);
    expect(talks.map((t) => t.titre)).toEqual(["Ce soir"]);
  });

  it("un talk donné deux fois à venir = deux échéances (une par occurrence)", async () => {
    const uid = await insertUser("Ada");
    const pid = await insertProfile(uid);
    const tid = await insertTalk(pid, "Bis");
    await insertOccurrence(tid, pid, "2026-09-01");
    await insertOccurrence(tid, pid, "2026-10-01");

    expect(await getMesProchainsTalks(uid, AUJOURDHUI)).toHaveLength(2);
  });
});

describe("getMonAgenda", () => {
  it("fusionne ateliers et talks, triés par date croissante", async () => {
    const { uid } = await speakeuseAvecTalk("Ada", "Mon talk", "2026-07-20", {
      conference: "DevFest",
    });
    const { rows: edRows } = await h.pool.query(
      `INSERT INTO tremplin_editions(nom, annee) VALUES('Tremplin 2026', 2026) RETURNING id`,
    );
    const ed = (edRows[0] as { id: number }).id;
    const { rows: regRows } = await h.pool.query(
      `INSERT INTO tremplin_registrations(edition_id, "userId") VALUES($1, $2) RETURNING id`,
      [ed, uid],
    );
    const reg = (regRows[0] as { id: number }).id;
    const { rows: atRows } = await h.pool.query(
      `INSERT INTO tremplin_ateliers(edition_id, titre, date) VALUES($1, 'Atelier pitch', '2026-07-15') RETURNING id`,
      [ed],
    );
    await h.pool.query(
      `INSERT INTO tremplin_atelier_membres(atelier_id, registration_id) VALUES($1, $2)`,
      [(atRows[0] as { id: number }).id, reg],
    );

    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI });
    expect(agenda.map((e) => [e.genre, e.titre])).toEqual([
      ["atelier", "Atelier pitch"],
      ["talk", "Mon talk"],
    ]);
  });

  it("speakeuse hors Tremplin : son agenda vit quand même (talks seuls)", async () => {
    const { uid } = await speakeuseAvecTalk("Ada", "Solo", "2026-08-01");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI });
    expect(agenda).toHaveLength(1);
    expect(agenda[0].genre).toBe("talk");
  });

  it("chaque échéance mène à son détail (talk → sa page)", async () => {
    const { uid, tid } = await speakeuseAvecTalk("Ada", "Solo", "2026-08-01");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI });
    expect(hrefEcheance(agenda[0])).toBe(`/mon-espace/talks/${tid}`);
  });

  it("orga : le programme des éditions actives entre à l'agenda (rôle organise, détail admin)", async () => {
    const uid = await insertUser("Camille orga");
    const { rows: edRows } = await h.pool.query(
      `INSERT INTO tremplin_editions(nom, annee) VALUES('Tremplin 2026', 2026) RETURNING id`,
    );
    const ed = (edRows[0] as { id: number }).id;
    const { rows: atRows } = await h.pool.query(
      `INSERT INTO tremplin_ateliers(edition_id, titre, date) VALUES($1, 'Lancement', '2026-09-01') RETURNING id`,
      [ed],
    );
    const atelierId = (atRows[0] as { id: number }).id;

    // Sans le drapeau orga : rien (elle n'y participe pas, ne l'anime pas).
    expect(await getMonAgenda(uid, { aujourdhui: AUJOURDHUI })).toHaveLength(0);

    const agenda = await getMonAgenda(uid, { orga: true, aujourdhui: AUJOURDHUI });
    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toMatchObject({ genre: "atelier", titre: "Lancement" });
    expect(agenda[0].genre === "atelier" && agenda[0].role).toBe("organise");
    expect(hrefEcheance(agenda[0])).toBe(`/admin/tremplins/${ed}/ateliers/${atelierId}`);
  });
});

/**
 * L'agenda REMONTE. Il ne regardait que devant, si bien qu'une coach perdait
 * toute la phase 1 qu'elle avait animée dès le lendemain de la dernière séance —
 * et l'édition, une fois archivée, l'effaçait une seconde fois. Un calendrier se
 * parcourt dans les deux sens.
 */
describe("getMonAgenda — le passé reste consultable", () => {
  /** Une coach qui a animé un atelier PASSÉ, sur une édition au statut donné. */
  async function coachAvecAtelierPasse(statut: string, date = "2026-04-28") {
    const uid = await insertUser("Sofia coach");
    const { rows: edRows } = await h.pool.query(
      `INSERT INTO tremplin_editions(nom, annee, statut) VALUES('Tremplin 2026', 2026, $1) RETURNING id`,
      [statut],
    );
    const ed = (edRows[0] as { id: number }).id;
    const { rows: atRows } = await h.pool.query(
      `INSERT INTO tremplin_ateliers(edition_id, titre, date) VALUES($1, 'Écrire son sujet de CFP', $2) RETURNING id`,
      [ed, date],
    );
    await h.pool.query(
      `INSERT INTO tremplin_atelier_coachs(atelier_id, user_id) VALUES($1, $2)`,
      [(atRows[0] as { id: number }).id, uid],
    );
    return { uid, ed };
  }

  it("coach : l'atelier animé en phase 1 revient dans l'agenda", async () => {
    const { uid } = await coachAvecAtelierPasse("en_cours");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI, avecPasse: true });
    expect(agenda.map((e) => e.titre)).toEqual(["Écrire son sujet de CFP"]);
    expect(agenda[0].genre === "atelier" && agenda[0].role).toBe("anime");
  });

  it("par DÉFAUT, rien du passé : la home reste « ce qui t'attend »", async () => {
    const { uid } = await coachAvecAtelierPasse("en_cours");
    expect(await getMonAgenda(uid, { aujourdhui: AUJOURDHUI })).toHaveLength(0);
  });

  it("édition ARCHIVÉE : son passé reste, c'est là que vit l'historique", async () => {
    const { uid } = await coachAvecAtelierPasse("archive");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI, avecPasse: true });
    expect(agenda).toHaveLength(1);
  });

  it("édition archivée : elle n'annonce RIEN pour l'avenir", async () => {
    // La règle qui existait est conservée, mais elle ne vaut que vers l'avant.
    const { uid } = await coachAvecAtelierPasse("archive", "2026-12-01");
    expect(await getMonAgenda(uid, { aujourdhui: AUJOURDHUI, avecPasse: true })).toHaveLength(0);
  });

  it("les talks passés remontent aussi (une speakeuse garde ses scènes)", async () => {
    const { uid } = await speakeuseAvecTalk("Ada", "Mon talk de mars", "2026-03-12", {
      conference: "DevFest",
    });
    expect(await getMonAgenda(uid, { aujourdhui: AUJOURDHUI })).toHaveLength(0);
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI, avecPasse: true });
    expect(agenda.map((e) => e.titre)).toEqual(["Mon talk de mars"]);
  });

  it("passé ET futur : l'ordre chronologique traverse le repère", async () => {
    const { uid, pid } = await speakeuseAvecTalk("Ada", "Avant", "2026-03-12");
    const tid = await insertTalk(pid, "Après");
    await insertOccurrence(tid, pid, "2026-09-20");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI, avecPasse: true });
    expect(agenda.map((e) => e.titre)).toEqual(["Avant", "Après"]);
  });
});

/**
 * « Chaque carte mène à SON détail, où qu'elle s'affiche. » Deux rôles y
 * échappaient : la participante et la coach atterrissaient en HAUT d'une page
 * qui liste jusqu'à quinze ateliers, à charge de retrouver le bon. Leur détail
 * est une RANGÉE de cette page — le lien doit donc porter son ancre.
 */
describe("hrefEcheance — la carte mène à SA PAGE, pas au haut d'une liste", () => {
  async function atelierAvecRole(role: "participe" | "anime") {
    const uid = await insertUser("Ada");
    const { rows: edRows } = await h.pool.query(
      `INSERT INTO tremplin_editions(nom, annee) VALUES('Tremplin 2026', 2026) RETURNING id`,
    );
    const ed = (edRows[0] as { id: number }).id;
    const { rows: atRows } = await h.pool.query(
      `INSERT INTO tremplin_ateliers(edition_id, titre, date) VALUES($1, 'Lancement et structure du talk', '2026-09-01') RETURNING id`,
      [ed],
    );
    const at = (atRows[0] as { id: number }).id;
    if (role === "participe") {
      const { rows: regRows } = await h.pool.query(
        `INSERT INTO tremplin_registrations(edition_id, "userId") VALUES($1, $2) RETURNING id`,
        [ed, uid],
      );
      await h.pool.query(
        `INSERT INTO tremplin_atelier_membres(atelier_id, registration_id) VALUES($1, $2)`,
        [at, (regRows[0] as { id: number }).id],
      );
    } else {
      await h.pool.query(
        `INSERT INTO tremplin_atelier_coachs(atelier_id, user_id) VALUES($1, $2)`,
        [at, uid],
      );
    }
    return { uid, ed, at };
  }

  /**
   * Chaque rôle a désormais SA page d'atelier : l'ancre dans une longue liste
   * était un pis-aller (on atterrissait quelque part et il fallait se repérer).
   * Les trois rôles suivent enfin la même règle que l'orga.
   */
  it("participante : la page de SON atelier", async () => {
    const { uid, ed, at } = await atelierAvecRole("participe");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI });
    expect(hrefEcheance(agenda[0])).toBe(`/mon-espace/tremplin/${ed}/ateliers/${at}`);
  });

  it("coach : la page de l'atelier qu'elle anime", async () => {
    const { uid, ed, at } = await atelierAvecRole("anime");
    const agenda = await getMonAgenda(uid, { aujourdhui: AUJOURDHUI });
    expect(hrefEcheance(agenda[0])).toBe(`/mon-espace/coaching/${ed}/ateliers/${at}`);
  });

  it("hrefAtelier : UNE fonction pour les trois rôles, jamais une chaîne recopiée", () => {
    expect(hrefAtelier("participe", 2, 42)).toBe("/mon-espace/tremplin/2/ateliers/42");
    expect(hrefAtelier("anime", 2, 42)).toBe("/mon-espace/coaching/2/ateliers/42");
    expect(hrefAtelier("organise", 2, 42)).toBe("/admin/tremplins/2/ateliers/42");
  });
});
