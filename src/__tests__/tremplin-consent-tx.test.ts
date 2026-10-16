import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prouve la discipline transactionnelle de setRegistrationVisibility (RGPD) :
 * si l'INSERT du journal échoue, l'UPDATE de l'état doit être annulé (ROLLBACK),
 * pas de COMMIT, et le client est toujours relâché. Déterministe (client mické) —
 * là où pg-mem ne restitue pas fidèlement un ROLLBACK.
 */

const client = {
  query: vi.fn(),
  release: vi.fn(),
};
vi.mock("@/lib/db", () => ({ pool: { connect: () => Promise.resolve(client) } }));

import { setRegistrationVisibility } from "@/lib/tremplin-registrations";

beforeEach(() => {
  client.query.mockReset();
  client.release.mockReset();
});

describe("setRegistrationVisibility — atomicité (transaction)", () => {
  it("ROLLBACK (pas de COMMIT) si l'écriture du journal échoue, client relâché", async () => {
    client.query.mockImplementation((sql: string) => {
      if (/UPDATE tremplin_registrations/.test(sql)) return Promise.resolve({ rowCount: 1 });
      if (/INSERT INTO tremplin_consent_log/.test(sql)) return Promise.reject(new Error("boom"));
      return Promise.resolve({ rows: [], rowCount: 0 }); // BEGIN / ROLLBACK
    });

    await expect(setRegistrationVisibility(1, 2, false)).rejects.toThrow("boom");

    const seq = client.query.mock.calls.map((c) => String(c[0]));
    expect(seq.some((s) => /BEGIN/.test(s))).toBe(true);
    expect(seq.some((s) => /INSERT INTO tremplin_consent_log/.test(s))).toBe(true);
    expect(seq.some((s) => /ROLLBACK/.test(s))).toBe(true);
    expect(seq.some((s) => /COMMIT/.test(s))).toBe(false); // jamais validé
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("hors édition (0 ligne) : ROLLBACK, pas de journal, renvoie false", async () => {
    client.query.mockImplementation((sql: string) => {
      if (/UPDATE tremplin_registrations/.test(sql)) return Promise.resolve({ rowCount: 0 });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    expect(await setRegistrationVisibility(1, 999, true)).toBe(false);
    const seq = client.query.mock.calls.map((c) => String(c[0]));
    expect(seq.some((s) => /INSERT INTO tremplin_consent_log/.test(s))).toBe(false);
    expect(seq.some((s) => /ROLLBACK/.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
