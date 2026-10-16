import { describe, it, expect } from "vitest";
import { agendaAteliers, type AtelierAgenda } from "@/lib/agenda-ateliers";

/**
 * Lot F — la liste des ateliers devient un AGENDA : chronologie plutôt que
 * sections par phase (qui découpaient le temps en deux), mois en repère, passé
 * replié, « à dater » en fin de liste. Fonction pure, testée seule.
 */

const AUJOURDHUI = "2026-09-20";

const a = (o: Partial<AtelierAgenda> & { id: number }): AtelierAgenda => ({
  date: null,
  dateFin: null,
  ordre: 0,
  ...o,
});

describe("agendaAteliers", () => {
  it("groupe les à-venir par mois, dans l'ordre chronologique", () => {
    const r = agendaAteliers(
      [
        a({ id: 3, date: "2026-11-19" }),
        a({ id: 1, date: "2026-10-01" }),
        a({ id: 2, date: "2026-10-13" }),
      ],
      AUJOURDHUI,
    );
    expect(r.moisAVenir.map((m) => m.cle)).toEqual(["2026-10", "2026-11"]);
    expect(r.moisAVenir[0].items.map((x) => x.id)).toEqual([1, 2]);
    expect(r.moisAVenir[1].items.map((x) => x.id)).toEqual([3]);
  });

  it("le passé est à part (récent d'abord) : il se replie à l'affichage", () => {
    const r = agendaAteliers(
      [
        a({ id: 1, date: "2026-04-28" }),
        a({ id: 2, date: "2026-06-04" }),
        a({ id: 3, date: "2026-10-01" }),
      ],
      AUJOURDHUI,
    );
    expect(r.passes.map((x) => x.id)).toEqual([2, 1]);
    expect(r.moisAVenir.flatMap((m) => m.items).map((x) => x.id)).toEqual([3]);
  });

  it("une FENÊTRE en cours reste à venir jusqu'à sa fin", () => {
    const r = agendaAteliers(
      [a({ id: 1, date: "2026-09-15", dateFin: "2026-09-25" })],
      AUJOURDHUI,
    );
    expect(r.moisAVenir[0].items.map((x) => x.id)).toEqual([1]);
    expect(r.passes).toHaveLength(0);
  });

  it("aujourd'hui compte comme à venir", () => {
    const r = agendaAteliers([a({ id: 1, date: AUJOURDHUI })], AUJOURDHUI);
    expect(r.moisAVenir[0].items).toHaveLength(1);
  });

  it("les ateliers sans date vivent à part (« à dater »), jamais noyés dans un mois", () => {
    const r = agendaAteliers(
      [a({ id: 1, date: null }), a({ id: 2, date: "2026-10-01" })],
      AUJOURDHUI,
    );
    expect(r.aDater.map((x) => x.id)).toEqual([1]);
    expect(r.moisAVenir.flatMap((m) => m.items).map((x) => x.id)).toEqual([2]);
  });

  it("même date : l'ordre de saisie départage (tri stable)", () => {
    const r = agendaAteliers(
      [
        a({ id: 9, date: "2026-10-01", ordre: 2 }),
        a({ id: 8, date: "2026-10-01", ordre: 1 }),
      ],
      AUJOURDHUI,
    );
    expect(r.moisAVenir[0].items.map((x) => x.id)).toEqual([8, 9]);
  });

  it("liste vide : trois collections vides (aucun état spécial à gérer côté page)", () => {
    const r = agendaAteliers([], AUJOURDHUI);
    expect(r).toEqual({ moisAVenir: [], passes: [], aDater: [] });
  });
});
