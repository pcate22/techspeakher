import { describe, it, expect } from "vitest";
import { statsFiche } from "@/lib/stats-fiche";
import type { Talk, TalkOccurrence } from "@/lib/talks";

const occ = (date: string | null): TalkOccurrence =>
  ({ id: 1, date }) as unknown as TalkOccurrence;
const talk = (dates: (string | null)[]): Talk =>
  ({ id: 1, occurrences: dates.map(occ) }) as unknown as Talk;

const AUJOURDHUI = "2026-08-07";

/**
 * Les stats sobres de la fiche publique : des FAITS. Une scène est « faite »
 * quand sa date est exacte et strictement passée — même règle que le fil
 * (`getScenesRecentes`), pour qu'une fiche et le fil racontent pareil.
 */
describe("statsFiche", () => {
  it("compte les talks et les scènes passées", () => {
    const stats = statsFiche(
      [talk(["2026-06-01", "2026-12-01"]), talk(["2025-11-19"])],
      AUJOURDHUI,
    );
    expect(stats).toEqual({ talks: 2, scenes: 2 });
  });

  it("le jour J reste à venir (strictement passé, comme le fil)", () => {
    expect(statsFiche([talk([AUJOURDHUI])], AUJOURDHUI).scenes).toBe(0);
  });

  it("les dates imprécises (« 2026 », « 2026-11 ») et absentes restent hors compte", () => {
    expect(statsFiche([talk(["2026", "2026-01", null])], AUJOURDHUI).scenes).toBe(0);
  });

  it("aucun talk : des zéros, jamais une erreur", () => {
    expect(statsFiche([], AUJOURDHUI)).toEqual({ talks: 0, scenes: 0 });
  });
});
