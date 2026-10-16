import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Le bouton « Relire HelloAsso maintenant » (/admin/adhesions) : une orga voit
 * le résultat tout de suite, sans attendre le cron du soir ni lire des logs
 * qui ne durent qu'une heure.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/annuaire-cache", () => ({ invaliderAnnuaire: vi.fn() }));
vi.mock("@/lib/bilan-adhesions", () => ({ lireBilanAdhesions: vi.fn(async () => null) }));
vi.mock("@/lib/passe-adhesions", () => ({
  synchroniserDepuisHelloAsso: vi.fn(),
  synchroReussie: (s: unknown) => typeof s === "object" && s !== null && !("erreur" in s),
}));

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { synchroniserDepuisHelloAsso } from "@/lib/passe-adhesions";
import { lireBilanAdhesions } from "@/lib/bilan-adhesions";
import { relireHelloAssoAction } from "@/app/admin/adhesions/actions";

const BILAN = { articles: 1, comptes: 1, articlesRelies: 1, sansCompte: 0, expirees: 0, fichesReprises: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
  vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue(BILAN);
});

describe("relireHelloAssoAction", () => {
  it("refuse une membre sans rôle orga, avant toute relecture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(relireHelloAssoAction(null)).rejects.toThrow();
    expect(synchroniserDepuisHelloAsso).not.toHaveBeenCalled();
  });

  it("relit HelloAsso (origine « manuelle »), rafraîchit la page et rend l'heure", async () => {
    const etat = await relireHelloAssoAction(null);
    expect(etat).toEqual({ le: expect.any(String) });
    expect(synchroniserDepuisHelloAsso).toHaveBeenCalledWith(expect.any(Date), "manuelle");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/adhesions");
    expect(invaliderAnnuaire).not.toHaveBeenCalled();
  });

  it("une fiche remise en ligne : l'annuaire suit tout de suite", async () => {
    vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue({ ...BILAN, fichesReprises: 1 });
    await relireHelloAssoAction(null);
    expect(invaliderAnnuaire).toHaveBeenCalled();
  });

  it("une relecture en échec ne lève pas : l'écran la lit dans le bilan", async () => {
    vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue({ erreur: "HelloAsso : 401" });
    await expect(relireHelloAssoAction(null)).resolves.toEqual({ le: expect.any(String) });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/adhesions");
  });

  it("une relecture manuelle il y a moins d'une minute : pas de nouvelle relecture", async () => {
    const recent = new Date(Date.now() - 20_000).toISOString();
    vi.mocked(lireBilanAdhesions).mockResolvedValue({ le: recent, origine: "manuelle", resultat: BILAN });
    expect(await relireHelloAssoAction(null)).toEqual({ le: recent });
    expect(synchroniserDepuisHelloAsso).not.toHaveBeenCalled();
  });

  it("le frein ne vaut que pour le bouton : un cron récent n'empêche pas de relire", async () => {
    const recent = new Date(Date.now() - 20_000).toISOString();
    vi.mocked(lireBilanAdhesions).mockResolvedValue({ le: recent, origine: "cron", resultat: BILAN });
    await relireHelloAssoAction(null);
    expect(synchroniserDepuisHelloAsso).toHaveBeenCalled();
  });

  it("une relecture manuelle d'il y a plus d'une minute : on relit", async () => {
    const ancien = new Date(Date.now() - 61_000).toISOString();
    vi.mocked(lireBilanAdhesions).mockResolvedValue({ le: ancien, origine: "manuelle", resultat: BILAN });
    await relireHelloAssoAction(null);
    expect(synchroniserDepuisHelloAsso).toHaveBeenCalled();
  });
});
