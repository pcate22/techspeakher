import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * Tests d'intégration BDD (pg-mem + `db/schema.sql`) des réglages plateforme
 * (lot C4) : table clé-valeur, défauts dans le code, repli si table absente.
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

import { getReglages, setReglage, REGLAGES_DEFAUT } from "@/lib/reglages";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

describe("getReglages / setReglage", () => {
  it("table vide : les défauts du code", async () => {
    expect(await getReglages()).toEqual(REGLAGES_DEFAUT);
  });

  it("un réglage modifié écrase son défaut, les autres restent", async () => {
    await setReglage("validation_fiche_jours", 10);
    const r = await getReglages();
    expect(r.validation_fiche_jours).toBe(10);
    expect(r.alerte_atelier_jours).toBe(REGLAGES_DEFAUT.alerte_atelier_jours);
  });

  it("setReglage est un upsert (deux écritures, la dernière gagne)", async () => {
    await setReglage("alerte_atelier_jours", 14);
    await setReglage("alerte_atelier_jours", 3);
    expect((await getReglages()).alerte_atelier_jours).toBe(3);
  });

  it("valeur illisible en base (corruption) : retour au défaut, pas de NaN", async () => {
    await h.pool.query(
      `INSERT INTO plateforme_reglages(cle, valeur) VALUES('rappel_fiche_jours', 'pouet')`,
    );
    expect((await getReglages()).rappel_fiche_jours).toBe(
      REGLAGES_DEFAUT.rappel_fiche_jours,
    );
  });

  it("clé inconnue en base : ignorée sans casser", async () => {
    await h.pool.query(
      `INSERT INTO plateforme_reglages(cle, valeur) VALUES('cle_fantome', '42')`,
    );
    expect(await getReglages()).toEqual(REGLAGES_DEFAUT);
  });

  it("table absente (migration pas jouée) : les défauts, sans erreur", async () => {
    await h.pool.query(`DROP TABLE plateforme_reglages`);
    expect(await getReglages()).toEqual(REGLAGES_DEFAUT);
  });
});
