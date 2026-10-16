import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/app/mon-espace/actions", () => ({ withdrawProfileAction: vi.fn() }));

import RetirerFicheRow from "@/app/mon-espace/RetirerFicheRow";

afterEach(cleanup);

describe("RetirerFicheRow", () => {
  it("est une ligne (pas un lien de navigation) : un bouton, sans chevron", () => {
    render(<RetirerFicheRow enAttente={false} />);
    const ligne = screen.getByRole("button", {
      name: /retirer ma fiche de l'annuaire/i,
    });
    expect(ligne).toBeInTheDocument();
    // Pas de rôle lien (ce n'est pas une navigation vers une page).
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("demande confirmation avant de retirer (modale)", async () => {
    render(<RetirerFicheRow enAttente={false} />);
    fireEvent.click(
      screen.getByRole("button", { name: /retirer ma fiche de l'annuaire/i }),
    );
    // La modale de confirmation s'ouvre : titre + Annuler + action.
    expect(
      await screen.findByText(/retirer ta fiche de l'annuaire\s?\?/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeInTheDocument();
  });

  it("adapte le libellé quand la fiche est en attente de validation", () => {
    render(<RetirerFicheRow enAttente={true} />);
    expect(
      screen.getByRole("button", { name: /retirer ma soumission/i }),
    ).toBeInTheDocument();
  });

  it("Annuler referme sans retirer", async () => {
    const { withdrawProfileAction } = await import("@/app/mon-espace/actions");
    render(<RetirerFicheRow enAttente={false} />);
    fireEvent.click(
      screen.getByRole("button", { name: /retirer ma fiche de l'annuaire/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /annuler/i }));
    await waitFor(() =>
      expect(screen.queryByText(/retirer ta fiche de l'annuaire\s?\?/i)).toBeNull(),
    );
    expect(withdrawProfileAction).not.toHaveBeenCalled();
  });
});
