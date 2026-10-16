import { describe, it, expect, vi, beforeEach } from "vitest";

const connect = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { connect: (...a: unknown[]) => connect(...a) } }));
vi.mock("@/lib/tremplin-editions", () => ({
  listEditions: vi.fn(),
  createEdition: vi.fn(),
}));
vi.mock("@/lib/tremplin-ateliers", () => ({ createAtelier: vi.fn() }));
vi.mock("@/lib/tremplin-registrations", () => ({ createRegistration: vi.fn() }));

import { importTremplin1 } from "@/lib/tremplin-import";
import { buildTremplin1Seed } from "@/lib/tremplin-seed";
import { listEditions, createEdition } from "@/lib/tremplin-editions";
import { createAtelier } from "@/lib/tremplin-ateliers";
import { createRegistration } from "@/lib/tremplin-registrations";

/** Titres réels des 5 ateliers du seed (buildTremplin1Seed n'est pas mocké). */
const SEED_TITRES = buildTremplin1Seed().ateliers.map((a) => a.titre);

function fakeClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());

describe("importTremplin1", () => {
  it("édition absente : crée tout dans UNE transaction (BEGIN → COMMIT) et renvoie l'id", async () => {
    vi.mocked(listEditions).mockResolvedValue([]);
    const client = fakeClient();
    connect.mockResolvedValue(client);
    vi.mocked(createEdition).mockResolvedValue(7);

    const res = await importTremplin1();

    expect(res).toEqual({ created: true, editionId: 7, ateliersAjoutes: 5 });
    const queries = client.query.mock.calls.map((c) => c[0]);
    expect(queries).toContain("BEGIN");
    expect(queries).toContain("COMMIT");
    expect(queries).not.toContain("ROLLBACK");
    // Les écritures passent par le CLIENT de transaction (2ᵉ argument).
    expect(createEdition).toHaveBeenCalledWith(expect.anything(), client);
    expect(createAtelier).toHaveBeenCalledTimes(5);
    expect(createRegistration).toHaveBeenCalledTimes(8);
    expect(client.release).toHaveBeenCalled();
  });

  it("édition présente SANS ateliers : complète les 5 manquants, sans recréer ni toucher aux inscriptions", async () => {
    vi.mocked(listEditions).mockResolvedValue([
      { id: 3, nom: "Tremplin 2026", annee: 2026 } as never,
    ]);
    const client = fakeClient(); // SELECT titre → {rows: []} : aucun atelier présent
    connect.mockResolvedValue(client);

    const res = await importTremplin1();

    expect(res).toEqual({ created: false, editionId: 3, ateliersAjoutes: 5 });
    const queries = client.query.mock.calls.map((c) => c[0]);
    expect(queries).toContain("BEGIN");
    expect(queries).toContain("COMMIT");
    expect(createEdition).not.toHaveBeenCalled(); // l'édition n'est PAS recréée
    expect(createAtelier).toHaveBeenCalledTimes(5); // les 5 manquants
    expect(createRegistration).not.toHaveBeenCalled(); // inscriptions jamais touchées
    expect(client.release).toHaveBeenCalled();
  });

  it("édition présente AVEC tous ses ateliers : n'ajoute rien (idempotent)", async () => {
    vi.mocked(listEditions).mockResolvedValue([
      { id: 3, nom: "Tremplin 2026", annee: 2026 } as never,
    ]);
    const client = fakeClient();
    // Le SELECT des titres renvoie les 5 titres du seed → aucun manquant.
    client.query.mockImplementation((sql: unknown) =>
      typeof sql === "string" && sql.includes("SELECT titre")
        ? Promise.resolve({ rows: SEED_TITRES.map((titre) => ({ titre })) })
        : Promise.resolve({ rows: [] }),
    );
    connect.mockResolvedValue(client);

    const res = await importTremplin1();

    expect(res).toEqual({ created: false, editionId: 3, ateliersAjoutes: 0 });
    expect(createAtelier).not.toHaveBeenCalled();
    expect(createRegistration).not.toHaveBeenCalled();
  });

  it("échec d'une insertion → ROLLBACK, rien créé, erreur propagée", async () => {
    vi.mocked(listEditions).mockResolvedValue([]);
    const client = fakeClient();
    connect.mockResolvedValue(client);
    vi.mocked(createEdition).mockRejectedValue(new Error('relation "ateliers" does not exist'));

    await expect(importTremplin1()).rejects.toThrow(/ateliers/);
    const queries = client.query.mock.calls.map((c) => c[0]);
    expect(queries).toContain("BEGIN");
    expect(queries).toContain("ROLLBACK");
    expect(queries).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
