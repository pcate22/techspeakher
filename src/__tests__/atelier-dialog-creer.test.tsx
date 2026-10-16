import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// La modale n'appelle l'action qu'à la soumission (jamais ici) ; on mocke le
// module d'actions pour ne pas charger le code serveur (pg/auth).
vi.mock("@/app/admin/tremplins/actions", () => ({ createAtelierAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import AddAtelierDialog from "@/app/admin/tremplins/[edition]/AddAtelierDialog";

afterEach(cleanup);

/**
 * Le ➕ de la barre canonique promet le FORMULAIRE, pas la liste : arriver
 * sur la page ateliers avec `?creer=1` ouvre la modale d'ajout d'emblée
 * (conception N1 §2.4 — « formulaire d'ajout ouvert »).
 */
describe("AddAtelierDialog — ouverture à l'arrivée (?creer=1)", () => {
  it("fermée par défaut : la liste d'abord, le formulaire à la demande", () => {
    render(<AddAtelierDialog editionId={7} />);
    expect(document.querySelector("dialog")?.open).toBeFalsy();
  });

  it("defaultOpen : la modale est ouverte dès le rendu, prête à nommer l'atelier", () => {
    render(<AddAtelierDialog editionId={7} defaultOpen />);
    expect(document.querySelector("dialog")?.open).toBe(true);
    expect(screen.getByLabelText(/titre de l'atelier/i)).toBeInTheDocument();
  });
});
