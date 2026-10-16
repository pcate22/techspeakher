import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import InlineActionForm from "@/components/InlineActionForm";

afterEach(cleanup);

/**
 * Effacer une date sur mobile : le picker natif iOS (« Réinitialiser »)
 * remet la date à sa valeur d'origine au lieu de la vider — impossible de
 * repasser une date à « aucune » une fois saisie. Un vrai bouton « Effacer »
 * dans le formulaire, indépendant du picker natif, garantit ce retour à vide.
 */
describe("InlineActionForm — champ date effaçable", () => {
  it("affiche « Effacer » quand une date est présente, et enregistre une date vide après clic", async () => {
    const u = userEvent.setup();
    const action = vi.fn(async (_s: { status: "idle" }, f: FormData) => {
      expect(f.get("date")).toBe("");
      return { status: "success" as const };
    });
    render(
      <InlineActionForm
        action={action as never}
        hidden={{ atelierId: 3 }}
        fields={[
          {
            kind: "input",
            name: "date",
            label: "Date (optionnel)",
            type: "date",
            clearable: true,
            defaultValue: "2026-07-23",
          },
        ]}
        submitLabel="Enregistrer les informations"
      />,
    );

    const input = screen.getByLabelText("Date (optionnel)");
    expect(input).toHaveValue("2026-07-23");

    const effacer = screen.getByRole("button", { name: /effacer/i });
    await u.click(effacer);
    expect(input).toHaveValue("");
    // Le champ ne doit PAS reprendre le focus après « Effacer » : sur mobile,
    // focus sur un input date/heure rouvre le sélecteur natif (le bug signalé).
    expect(input).not.toHaveFocus();
    // RGAA (WCAG 2.4.3) : le focus est renvoyé sur le libellé du champ (stable),
    // pas perdu vers <body> quand le bouton « Effacer » disparaît.
    expect(screen.getByText("Date (optionnel)")).toHaveFocus();
    // L'effacement est annoncé aux lecteurs d'écran (région live).
    expect(screen.getByText("Date (optionnel) : effacé")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /enregistrer les informations/i }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("n'affiche pas « Effacer » quand le champ est vide au départ", () => {
    render(
      <InlineActionForm
        action={vi.fn() as never}
        fields={[
          {
            kind: "input",
            name: "date",
            label: "Date (optionnel)",
            type: "date",
            clearable: true,
            defaultValue: "",
          },
        ]}
        submitLabel="Enregistrer"
      />,
    );
    expect(screen.queryByRole("button", { name: /effacer/i })).toBeNull();
  });
});
