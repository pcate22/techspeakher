import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/auth-guards", () => ({ requireOrgaPage: vi.fn() }));
vi.mock("@/lib/adhesions", () => ({ adhesionsPourOrga: vi.fn(async () => []) }));
vi.mock("@/lib/bilan-adhesions", () => ({ lireBilanAdhesions: vi.fn() }));
vi.mock("@/lib/helloasso", () => ({ helloassoConfig: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn(() => false) }));
vi.mock("@/app/admin/adhesions/actions", () => ({ relireHelloAssoAction: vi.fn() }));

import { requireOrgaPage } from "@/lib/auth-guards";
import { lireBilanAdhesions } from "@/lib/bilan-adhesions";
import { helloassoConfig } from "@/lib/helloasso";
import Page from "@/app/admin/adhesions/page";

const rendu = async () => render(await Page());

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(helloassoConfig).mockReturnValue({} as never);
  vi.mocked(lireBilanAdhesions).mockResolvedValue({
    le: "2026-10-15T21:30:00.000Z",
    origine: "cron",
    resultat: { articles: 1, comptes: 0, articlesRelies: 0, sansCompte: 1, expirees: 0, fichesReprises: 0 },
  });
});
afterEach(cleanup);

describe("/admin/adhesions — le bilan de la dernière relecture", () => {
  it("passe par la garde orga", async () => {
    await rendu();
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("dit le dernier passage et ses compteurs, et porte le bouton de relecture", async () => {
    await rendu();
    expect(screen.getByRole("heading", { name: "Dernière relecture de HelloAsso" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("1 adhésion lue\u00a0: 0 reliée à un compte, 1 sans compte.");
    expect(screen.getByRole("button", { name: "Relire HelloAsso maintenant" })).toBeInTheDocument();
  });

  it("une relecture en échec se lit en toutes lettres, sans voler le focus du lecteur d'écran", async () => {
    vi.mocked(lireBilanAdhesions).mockResolvedValue({
      le: "2026-10-15T21:30:00.000Z",
      origine: "manuelle",
      resultat: { erreur: "HelloAsso : 401" },
    });
    await rendu();
    expect(document.body.textContent).toMatch(/La relecture a échoué/);
    expect(document.body.textContent).toMatch(/HelloAsso : 401/);
    // Un état rendu par le serveur, présent à l'arrivée : pas une alerte.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sans identifiants HelloAsso : ni bilan ni bouton", async () => {
    vi.mocked(helloassoConfig).mockReturnValue(null);
    await rendu();
    expect(screen.queryByRole("button", { name: /Relire HelloAsso/ })).toBeNull();
    expect(lireBilanAdhesions).not.toHaveBeenCalled();
  });
});
