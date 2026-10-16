import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Lot F — la création d'un atelier passe par un DIALOG (un bouton), plus par un
 * formulaire inline en tête de la liste (règle d'or : une page de liste montre
 * et laisse choisir ; cf. l'erreur `/admin/conferences`).
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/admin/tremplins/actions", () => ({ createAtelierAction: vi.fn() }));

import AddAtelierDialog from "@/app/admin/tremplins/[edition]/AddAtelierDialog";

afterEach(cleanup);

describe("AddAtelierDialog", () => {
  it("expose un bouton d'ouverture « Ajouter un atelier » (création en dialog)", () => {
    render(<AddAtelierDialog editionId={3} />);
    expect(
      screen.getByRole("button", { name: /ajouter un atelier/i }),
    ).toBeInTheDocument();
  });
});
