import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...a: unknown[]) => query(...a) } }));

import {
  getAteliersByEdition,
  createAtelier,
  setAtelierVisio,
  trierAteliersParDate,
} from "@/lib/tremplin-ateliers";

beforeEach(() => query.mockReset());

describe("getAteliersByEdition", () => {
  it("SELECT par edition_id, ordonné, et mappe les colonnes", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          edition_id: 1,
          ordre: 1,
          titre: "Atelier 1 : trouver son sujet",
          date: "2026-04-28",
          heure_debut: "12:45:00",
          heure_fin: "13:45:00",
          description: null,
          lien_visio: null,
        },
      ],
    });
    const ateliers = await getAteliersByEdition(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from tremplin_ateliers/i);
    expect(String(sql)).toMatch(/where edition_id = \$1/i);
    expect(String(sql)).toMatch(/order by ordre/i);
    expect(params).toEqual([1]);
    expect(ateliers[0].titre).toBe("Atelier 1 : trouver son sujet");
    // Colonne TIME « 12:45:00 » normalisée en « HH:MM » (input type=time + validation).
    expect(ateliers[0].heureDebut).toBe("12:45");
    expect(ateliers[0].heureFin).toBe("13:45");
    expect(ateliers[0].editionId).toBe(1);
  });
});

describe("trierAteliersParDate — chronologie d'une phase (liste admin)", () => {
  const A = (id: number, ordre: number, date: string | null) => ({ id, ordre, date });

  it("ordonne par date croissante (ISO = chronologique)", () => {
    const tri = trierAteliersParDate([
      A(1, 1, "2026-05-05"),
      A(2, 2, "2026-04-28"),
      A(3, 3, "2026-06-01"),
    ]);
    expect(tri.map((a) => a.id)).toEqual([2, 1, 3]);
  });

  it("place les ateliers « à dater » (sans date) APRÈS les datés", () => {
    const tri = trierAteliersParDate([
      A(1, 1, null),
      A(2, 2, "2026-04-28"),
      A(3, 3, null),
      A(4, 4, "2026-04-01"),
    ]);
    // datés d'abord (chronologiques), puis les « à dater » en fin de phase,
    // départagés de façon stable (ordre puis id).
    expect(tri.map((a) => a.id)).toEqual([4, 2, 1, 3]);
  });

  it("départage les dates égales de façon stable et déterministe (ordre puis id)", () => {
    const tri = trierAteliersParDate([
      A(5, 3, "2026-04-28"),
      A(6, 1, "2026-04-28"),
      A(7, 1, "2026-04-28"),
    ]);
    // même date : ordre 1 avant 3 ; à ordre égal, id croissant (6 avant 7).
    expect(tri.map((a) => a.id)).toEqual([6, 7, 5]);
  });

  it("ne mute pas le tableau d'entrée (copie triée)", () => {
    const entree = [A(1, 1, "2026-05-05"), A(2, 2, "2026-04-28")];
    trierAteliersParDate(entree);
    expect(entree.map((a) => a.id)).toEqual([1, 2]);
  });
});

describe("createAtelier", () => {
  it("INSERT avec edition_id + champs et renvoie l'id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
    const id = await createAtelier(1, {
      ordre: 2,
      titre: "Atelier 2 : construire le plan",
      date: "2026-05-05",
      heureDebut: "12:45",
      heureFin: "13:45",
      description: null,
      lienVisio: null,
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into tremplin_ateliers/i);
    expect(String(sql)).toMatch(/returning id/i);
    expect(params[0]).toBe(1);
    expect(params).toContain("Atelier 2 : construire le plan");
    expect(id).toBe(9);
  });
});

describe("setAtelierVisio", () => {
  it("UPDATE scopé à l'édition, renvoie true si une ligne modifiée", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const ok = await setAtelierVisio(3, 1, "https://meet.example/x");
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update tremplin_ateliers set lien_visio = \$3/i);
    expect(String(sql)).toMatch(/where id = \$1 and edition_id = \$2/i);
    expect(params).toEqual([3, 1, "https://meet.example/x"]);
    expect(ok).toBe(true);
  });

  it("renvoie false si aucune ligne (atelier hors édition)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await setAtelierVisio(3, 999, null)).toBe(false);
  });
});
