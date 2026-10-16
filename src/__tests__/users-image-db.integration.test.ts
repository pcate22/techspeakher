import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * Intégration BDD de setUserImage (avatar du compte) : schéma réel sur pg-mem,
 * vraie fonction d'accès. On vérifie que la photo choisie atterrit bien sur le
 * bon compte, sans toucher aux autres.
 */
const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { setUserImage } from "@/lib/users";

beforeAll(async () => {
  await h.pool.query(schemaForPgMem());
});
beforeEach(async () => {
  await h.pool.query(`DELETE FROM users`);
});

async function seedUser(email: string): Promise<number> {
  const { rows } = await h.pool.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [
    email,
  ]);
  return (rows[0] as { id: number }).id;
}
async function imageOf(id: number): Promise<string | null> {
  const { rows } = await h.pool.query(`SELECT image FROM users WHERE id = $1`, [id]);
  return (rows[0] as { image: string | null }).image;
}

describe("setUserImage", () => {
  it("écrit la photo sur le compte visé uniquement", async () => {
    const moi = await seedUser("moi@ex.com");
    const autre = await seedUser("autre@ex.com");
    await setUserImage(moi, "https://cdn/li.jpg");
    expect(await imageOf(moi)).toBe("https://cdn/li.jpg");
    expect(await imageOf(autre)).toBeNull();
  });
});
