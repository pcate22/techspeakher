import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/auth-guards", () => ({ requireOrgaPage: vi.fn() }));
vi.mock("@/lib/annuaire-adhesion", () => ({ fichesAInviterAAdherer: vi.fn(), LOT_INVITATIONS: 40 }));
vi.mock("@/lib/helloasso", () => ({ helloassoConfig: vi.fn() }));
vi.mock("@/app/admin/adhesions/inviter/actions", () => ({ inviterAAdhererAction: vi.fn() }));

import { requireOrgaPage } from "@/lib/auth-guards";
import { fichesAInviterAAdherer } from "@/lib/annuaire-adhesion";
import { helloassoConfig } from "@/lib/helloasso";
import Page from "@/app/admin/adhesions/inviter/page";

const rendu = async (sp: Record<string, string> = {}) =>
  render(await Page({ searchParams: Promise.resolve(sp) }));

beforeEach(() => {
  vi.mocked(helloassoConfig).mockReturnValue({} as never);
  vi.mocked(fichesAInviterAAdherer).mockResolvedValue([
    { profileId: 1, email: "a@x.fr", name: "Ada Lovelace" },
  ]);
});
afterEach(cleanup);

describe("/admin/adhesions/inviter", () => {
  it("passe par la garde orga", async () => {
    await rendu();
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("liste les fiches à inviter et porte LE bouton", async () => {
    await rendu();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inviter 1 speakeuse" })).toBeInTheDocument();
  });

  it("sans synchro HelloAsso : aucun bouton, et l'écran dit pourquoi", async () => {
    vi.mocked(helloassoConfig).mockReturnValue(null);
    await rendu();
    expect(screen.queryByRole("button", { name: /Inviter/ })).toBeNull();
    expect(screen.getByText(/attend ses identifiants/)).toBeInTheDocument();
  });

  it("après un envoi refusé faute de synchro : le dit en alerte", async () => {
    await rendu({ envoi: "synchro-echec" });
    expect(screen.getByRole("alert")).toHaveTextContent(/Aucun e-mail envoyé/);
  });

  it("après un lot : envoyées, et ce qui reste", async () => {
    await rendu({ envoyees: "40", restantes: "3" });
    expect(screen.getByRole("status")).toHaveTextContent(/40 invitations envoyées.*Encore 3 à inviter/);
  });

  it("un lot vide se dit en mots, et un échec dit sa raison", async () => {
    await rendu({ envoyees: "0", echecs: "1", err: "Brevo 401" });
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent(/Aucune invitation envoyée/);
    expect(alerte).toHaveTextContent(/Raison.: Brevo 401/);
  });
});

