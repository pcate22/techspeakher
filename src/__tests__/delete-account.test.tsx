import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/mon-espace/actions", () => ({ deleteProfileAction: vi.fn() }));

import DeleteAccountButton from "@/app/mon-espace/DeleteAccountButton";

afterEach(cleanup);

describe("DeleteAccountButton (zone danger)", () => {
  it("demande confirmation avant suppression", async () => {
    const u = userEvent.setup();
    render(<DeleteAccountButton name="Camille Roux" email="camille@example.com" />);
    // Pas de dialogue au départ
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    // Dialogue de confirmation visible
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeInTheDocument();
  });

  it("exige d'écrire son nom ou son e-mail avant de débloquer la suppression", async () => {
    const u = userEvent.setup();
    render(<DeleteAccountButton name="Camille Roux" email="camille@example.com" />);
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const confirm = screen.getByRole("button", { name: /supprimer définitivement/i });
    // Verrou en `aria-disabled` : le bouton reste dans le parcours clavier
    // (un `disabled` matériel le ferait disparaître au lecteur d'écran).
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await u.type(screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i), "camille@example.com");
    expect(confirm).toHaveAttribute("aria-disabled", "false");
  });

  it("sans nom connu, l'e-mail seul confirme", async () => {
    const u = userEvent.setup();
    render(<DeleteAccountButton name={null} email="sansnom@example.com" />);
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const input = screen.getByLabelText(/écris ton adresse e-mail/i);
    await u.type(input, "sansnom@example.com");
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
  });
});
