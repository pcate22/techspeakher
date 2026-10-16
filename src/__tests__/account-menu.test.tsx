import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import AccountMenu from "@/components/AccountMenu";

afterEach(cleanup);

const user = {
  name: "Cateline Puccetti",
  email: "cateline@example.com",
  image: null,
};

const ouvrir = async () => {
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: /mon compte/i }));
};

/**
 * Le menu de compte est le PENDANT DESKTOP de l'onglet Profil (conception N1,
 * Q1) : quatre entrées, identiques pour tous les rôles. Les portes de rôle
 * (fiche, talks, tableau de bord…) vivent sur la page « Mon profil » — les
 * répéter ici recréait un second modèle de navigation selon l'écran.
 */
describe("AccountMenu", () => {
  it("affiche un bouton de compte accessible, menu fermé par défaut", () => {
    render(<AccountMenu user={user} />);
    const btn = screen.getByRole("button", { name: /mon compte/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menuitem", { name: /se déconnecter/i })).toBeNull();
  });

  it("cinq entrées, toujours les mêmes, « Ma fiche » en tête", async () => {
    render(<AccountMenu user={user} />);
    await ouvrir();
    // L'ORDRE est la promesse (refonte du 2026-10-15) : la fiche, LE geste
    // du produit, vient en premier.
    expect(
      screen.getAllByRole("menuitem").map((m) => [m.textContent, m.getAttribute("href")]),
    ).toEqual([
      ["Ma fiche", "/mon-espace/fiche"],
      ["Mon espace", "/mon-espace"],
      ["Mon profil", "/mon-espace/profil"],
      ["Réglages", "/mon-espace/reglages"],
      // Pas un de plus : aucune entrée de rôle ne s'y glisse.
      ["Se déconnecter", null],
    ]);
  });

  it("l'identité (nom + e-mail) coiffe le menu", async () => {
    render(<AccountMenu user={user} />);
    await ouvrir();
    expect(screen.getByText("Cateline Puccetti")).toBeInTheDocument();
    expect(screen.getByText("cateline@example.com")).toBeInTheDocument();
  });
});
