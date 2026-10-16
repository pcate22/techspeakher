import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * Tests d'intégration BDD (pg-mem + `db/schema.sql`) de `getMesProchainsAteliers`
 * (lot C2, cf. docs/conception-technique-tableaux-de-bord.md) : les prochains
 * ateliers d'un compte, qu'il y PARTICIPE (membre via son inscription) ou qu'il
 * les ANIME (coach), en une seule requête.
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

import { getMesProchainsAteliers } from "@/lib/mes-ateliers";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

const AUJOURDHUI = "2026-07-10";

/** pg-mem rend les DATE en objets Date (pas de type parser custom ici). */
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

async function insertUser(name: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name) VALUES($1) RETURNING id`,
    [name],
  );
  return (rows[0] as { id: number }).id;
}

async function insertEdition(nom = "Tremplin 2026"): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO tremplin_editions(nom, annee) VALUES($1, 2026) RETURNING id`,
    [nom],
  );
  return (rows[0] as { id: number }).id;
}

async function insertRegistration(editionId: number, userId: number): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO tremplin_registrations(edition_id, "userId") VALUES($1, $2) RETURNING id`,
    [editionId, userId],
  );
  return (rows[0] as { id: number }).id;
}

async function insertAtelier(
  editionId: number,
  titre: string,
  date: string | null,
  o: {
    heureDebut?: string;
    lienVisio?: string;
    audience?: "selection" | "phase" | "toutes";
    phase?: "cfp_et_pitch" | "montee_sur_scene";
  } = {},
): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO tremplin_ateliers(edition_id, titre, date, heure_debut, lien_visio, audience, phase)
     VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      editionId,
      titre,
      date,
      o.heureDebut ?? null,
      o.lienVisio ?? null,
      o.audience ?? "selection",
      o.phase ?? "cfp_et_pitch",
    ],
  );
  return (rows[0] as { id: number }).id;
}

const addMembre = (atelierId: number, registrationId: number) =>
  h.pool.query(
    `INSERT INTO tremplin_atelier_membres(atelier_id, registration_id) VALUES($1, $2)`,
    [atelierId, registrationId],
  );

const addCoach = (atelierId: number, userId: number) =>
  h.pool.query(
    `INSERT INTO tremplin_atelier_coachs(atelier_id, user_id) VALUES($1, $2)`,
    [atelierId, userId],
  );

describe("getMesProchainsAteliers", () => {
  it("participation seule : ateliers futurs où je suis membre, détails complets", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    const reg = await insertRegistration(ed, uid);
    const a = await insertAtelier(ed, "Pitcher", "2026-07-15", {
      heureDebut: "18:30",
      lienVisio: "https://meet.exemple.fr/x",
    });
    await addMembre(a, reg);

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes).toHaveLength(1);
    expect(mes[0]).toMatchObject({
      atelierId: a,
      titre: "Pitcher",
      lienVisio: "https://meet.exemple.fr/x",
      role: "participe",
      editionId: ed,
      editionNom: "Tremplin 2026",
    });
    expect(iso(mes[0].date)).toBe("2026-07-15");
    expect(String(mes[0].heureDebut)).toMatch(/18:30/);
  });

  it("activité à période EN COURS : reste « à venir » tant que sa fin est future (lot A)", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    const reg = await insertRegistration(ed, uid);
    // Fenêtre 7 → 13 juillet, aujourd'hui le 10 : le début est passé, la fin
    // non — la revue croisée doit rester visible (elle disparaissait avant).
    const enCours = await insertAtelier(ed, "Revue croisée", "2026-07-07");
    await h.pool.query(`UPDATE tremplin_ateliers SET date_fin = '2026-07-13', lieu = 'BPCE, Toulouse' WHERE id = $1`, [enCours]);
    // Fenêtre entièrement passée : exclue.
    const passee = await insertAtelier(ed, "Revue passée", "2026-06-01");
    await h.pool.query(`UPDATE tremplin_ateliers SET date_fin = '2026-06-07' WHERE id = $1`, [passee]);
    await addMembre(enCours, reg);
    await addMembre(passee, reg);

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes.map((m) => m.titre)).toEqual(["Revue croisée"]);
    expect(iso(mes[0].dateFin)).toBe("2026-07-13");
    expect(mes[0].lieu).toBe("BPCE, Toulouse"); // le lieu remonte (affichage À venir)
  });

  it("animation seule : ateliers futurs où je suis coach, rôle « anime »", async () => {
    const uid = await insertUser("Lucile");
    const ed = await insertEdition();
    const a = await insertAtelier(ed, "CFP", "2026-07-20");
    await addCoach(a, uid);

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes).toHaveLength(1);
    expect(mes[0].role).toBe("anime");
  });

  it("participe ET anime le même atelier : une seule ligne, rôle « anime »", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    const reg = await insertRegistration(ed, uid);
    const a = await insertAtelier(ed, "Pitcher", "2026-07-15");
    await addMembre(a, reg);
    await addCoach(a, uid);

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes).toHaveLength(1);
    expect(mes[0].role).toBe("anime");
  });

  it("exclut le passé, les ateliers sans date, et ceux des autres comptes", async () => {
    const uid = await insertUser("Ada");
    const autre = await insertUser("Grace");
    const ed = await insertEdition();
    const reg = await insertRegistration(ed, uid);
    const regAutre = await insertRegistration(ed, autre);

    const passe = await insertAtelier(ed, "Passé", "2026-07-01");
    const sansDate = await insertAtelier(ed, "Sans date", null);
    const pasAMoi = await insertAtelier(ed, "Pas à moi", "2026-07-15");
    await addMembre(passe, reg);
    await addMembre(sansDate, reg);
    await addMembre(pasAMoi, regAutre);

    expect(await getMesProchainsAteliers(uid, AUJOURDHUI)).toHaveLength(0);
  });

  it("aujourd'hui compte comme « à venir »", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    const a = await insertAtelier(ed, "Ce soir", AUJOURDHUI);
    await addCoach(a, uid);

    expect(await getMesProchainsAteliers(uid, AUJOURDHUI)).toHaveLength(1);
  });

  it("audience « toutes » : visible pour toute inscrite de l'édition", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    await insertRegistration(ed, uid);
    await insertAtelier(ed, "Ouvert à toutes", "2026-07-16", { audience: "toutes" });

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes).toHaveLength(1);
    expect(mes[0].titre).toBe("Ouvert à toutes");
    expect(mes[0].role).toBe("participe");
  });

  /**
   * L'audience de PHASE suit la cohorte, sans liste nominative à tenir : une
   * inscrite rattachée voit la séance, une autre non. C'est le geste que l'orga
   * faisait à la main, et qui restait sans effet quand « ouvert à toutes »
   * traînait à côté.
   */
  it("audience « phase » : visible des seules rattachées à cette phase", async () => {
    const ed = await insertEdition();
    const dedans = await insertUser("Ada");
    const dehors = await insertUser("Grace");
    const regDedans = await insertRegistration(ed, dedans);
    await insertRegistration(ed, dehors);
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
      [regDedans, "montee_sur_scene"],
    );
    await insertAtelier(ed, "Répétition chronométrée", "2026-07-16", {
      audience: "phase",
      phase: "montee_sur_scene",
    });

    expect(await getMesProchainsAteliers(dedans, AUJOURDHUI)).toHaveLength(1);
    expect(await getMesProchainsAteliers(dehors, AUJOURDHUI)).toHaveLength(0);
  });

  it("atelier SANS membre et NON ouvert : invisible (fermé par défaut, l'ouverture s'active)", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    await insertRegistration(ed, uid);
    await insertAtelier(ed, "Fermé par défaut", "2026-07-16");

    expect(await getMesProchainsAteliers(uid, AUJOURDHUI)).toHaveLength(0);
  });

  it("atelier ouvert d'une édition où je ne suis pas inscrite : absent", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    await insertAtelier(ed, "Ouvert", "2026-07-16", { audience: "toutes" });

    expect(await getMesProchainsAteliers(uid, AUJOURDHUI)).toHaveLength(0);
  });

  it("édition archivée : aucun atelier ne remonte, même daté dans le futur", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition("Tremplin 2024");
    await h.pool.query(`UPDATE tremplin_editions SET statut = 'archive' WHERE id = $1`, [ed]);
    const reg = await insertRegistration(ed, uid);
    const a = await insertAtelier(ed, "Futur fantôme", "2026-07-16");
    await addMembre(a, reg);
    await addCoach(a, uid);

    expect(await getMesProchainsAteliers(uid, AUJOURDHUI)).toHaveLength(0);
  });

  it("tri par date croissante, participation et animation mélangées", async () => {
    const uid = await insertUser("Ada");
    const ed = await insertEdition();
    const reg = await insertRegistration(ed, uid);
    const tard = await insertAtelier(ed, "Tard", "2026-08-01");
    const tot = await insertAtelier(ed, "Tôt", "2026-07-12");
    await addMembre(tard, reg);
    await addCoach(tot, uid);

    const mes = await getMesProchainsAteliers(uid, AUJOURDHUI);
    expect(mes.map((m) => m.titre)).toEqual(["Tôt", "Tard"]);
  });
});
