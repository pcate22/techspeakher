import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import InlineActionForm from "@/components/InlineActionForm";

afterEach(cleanup);

/**
 * Champ `select` déclaré en données (sérialisable, rendu depuis des pages
 * serveur) : sert au sélecteur de bénéficiaire d'une récompense (attribution
 * LIBRE parmi les participantes de l'édition).
 */
describe("InlineActionForm — champ select", () => {
  it("rend les options, présélectionne defaultValue, et soumet la valeur choisie", async () => {
    const u = userEvent.setup();
    const action = vi.fn(async (_s: { status: "idle" }, f: FormData) => {
      expect(f.get("registrationId")).toBe("5");
      return { status: "success" as const };
    });
    render(
      <InlineActionForm
        action={action as never}
        hidden={{ editionId: 1 }}
        fields={[
          {
            kind: "select",
            name: "registrationId",
            label: "Bénéficiaire",
            defaultValue: "",
            options: [
              { value: "", label: "Personne" },
              { value: "4", label: "Alice" },
              { value: "5", label: "Camille" },
            ],
          },
        ]}
        submitLabel="Attribuer"
      />,
    );
    const select = screen.getByLabelText(/bénéficiaire/i);
    expect(select).toHaveValue("");
    await u.selectOptions(select, "5");
    await u.click(screen.getByRole("button", { name: /attribuer/i }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  // Doctrine prévisibilité (docs/parcours-participante.md §4) : les commandes
  // discrètes (cases, sélecteurs) s'enregistrent À LA VOLÉE — pas de bouton
  // « Enregistrer » qui ne change rien d'autre que lui-même.
  it("submitOnChange : changer une valeur soumet directement, sans bouton visible", async () => {
    const u = userEvent.setup();
    const action = vi.fn(async () => ({ status: "success" as const }));
    render(
      <InlineActionForm
        action={action as never}
        hidden={{ editionId: 1 }}
        submitOnChange
        fields={[
          {
            kind: "select",
            name: "presence_5",
            label: "Camille",
            defaultValue: "non_renseignee",
            options: [
              { value: "non_renseignee", label: "Non renseignée" },
              { value: "presente", label: "Présente" },
            ],
          },
        ]}
        submitLabel="Enregistrer les présences"
        successMessage="Présences enregistrées."
      />,
    );
    // Pas de bouton de soumission visible (le <noscript> ne compte pas).
    expect(screen.queryByRole("button", { name: /enregistrer/i })).toBeNull();
    await u.selectOptions(screen.getByLabelText(/camille/i), "presente");
    expect(action).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/présences enregistrées\./i)).toBeInTheDocument();
    // Pas de « ressaut » : le sélecteur garde la valeur choisie après la
    // soumission (React réinitialiserait un champ non contrôlé au defaultValue
    // périmé pendant l'aller-retour réseau).
    expect(screen.getByLabelText(/camille/i)).toHaveValue("presente");
  });

  // Régression (perte de données) : hors erreur, restoredValue renvoie "" —
  // le defaultValue de la BDD doit quand même être appliqué, sinon la fiche
  // récompense affiche « Personne » / la 1ʳᵉ option et un « Enregistrer »
  // réécrit silencieusement des champs vides en base.
  it("applique defaultValue à l'état initial (select ET input)", () => {
    render(
      <InlineActionForm
        action={vi.fn() as never}
        fields={[
          {
            kind: "select",
            name: "statut",
            label: "Statut",
            defaultValue: "planifiee",
            options: [
              { value: "a_organiser", label: "À organiser" },
              { value: "planifiee", label: "Planifié" },
            ],
          },
          { kind: "input", name: "intitule", label: "Intitulé", defaultValue: "Lot DevFest" },
        ]}
        submitLabel="Enregistrer"
      />,
    );
    expect(screen.getByLabelText(/statut/i)).toHaveValue("planifiee");
    expect(screen.getByLabelText(/intitulé/i)).toHaveValue("Lot DevFest");
  });
});
