// @vitest-environment node
/**
 * Épingle les deux comportements de `src/lib/db.ts` qu'aucun autre test
 * n'exécute (les suites pg-mem/PGlite REMPLACENT le pool, et contournent même
 * l'inverse du type parser) :
 * - le type parser DATE → chaîne brute 'AAAA-MM-JJ' (toute la logique de
 *   fenêtre d'inscriptions compare des chaînes ; un objet Date casserait
 *   l'affichage avec un décalage de fuseau, tests au vert) ;
 * - le vrai `withTransaction` : BEGIN/COMMIT, ROLLBACK sur erreur, client
 *   TOUJOURS relâché (sinon fuite de connexions Neon en serverless).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { types } from "pg";
import { pool, withTransaction } from "@/lib/db";

describe("type parser DATE (OID 1082)", () => {
  it("renvoie la valeur brute 'AAAA-MM-JJ', pas un objet Date", () => {
    const parse = types.getTypeParser(types.builtins.DATE);
    expect(parse("2027-01-10")).toBe("2027-01-10");
    expect(typeof parse("2027-01-10")).toBe("string");
  });
});

describe("withTransaction (client stub)", () => {
  afterEach(() => vi.restoreAllMocks());

  function stubClient(failOn?: string) {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        calls.push(text);
        if (failOn && text === failOn) throw new Error(`échec ${text}`);
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    vi.spyOn(pool, "connect").mockResolvedValue(client as never);
    return { calls, client };
  }

  it("BEGIN → fn(client) → COMMIT ; renvoie le résultat ; relâche le client", async () => {
    const { calls, client } = stubClient();
    const result = await withTransaction(async (c) => {
      await c.query("INSERT paires");
      return 42;
    });
    expect(result).toBe(42);
    expect(calls).toEqual(["BEGIN", "INSERT paires", "COMMIT"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("fn jette : ROLLBACK (pas de COMMIT), l'erreur métier remonte, client relâché", async () => {
    const { calls, client } = stubClient();
    await expect(
      withTransaction(async (c) => {
        await c.query("INSERT paires");
        throw new Error("erreur métier");
      }),
    ).rejects.toThrow("erreur métier");
    expect(calls).toEqual(["BEGIN", "INSERT paires", "ROLLBACK"]);
    expect(calls).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("même un ROLLBACK qui échoue ne masque pas l'erreur d'origine et relâche", async () => {
    const { client } = stubClient("ROLLBACK");
    await expect(
      withTransaction(async () => {
        throw new Error("erreur d'origine");
      }),
    ).rejects.toThrow("erreur d'origine"); // pas « échec ROLLBACK »
    expect(client.release).toHaveBeenCalledOnce();
  });
});
