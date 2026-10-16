import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InlineActionForm from "@/components/InlineActionForm";

// useActionState / useRouter : composant client rendu ici en isolation.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

const action = vi.fn(async () => ({ status: "idle" }) as never);

const champs = [
  { kind: "input" as const, name: "titre", label: "Titre", required: true },
];

describe("InlineActionForm — CTA collant (stickySubmit)", () => {
  it("stickySubmit : le CTA est dans une barre collante (jamais sous la flottaison)", () => {
    render(
      <InlineActionForm
        action={action}
        hidden={{}}
        fields={champs}
        submitLabel="Enregistrer les informations"
        variant="primary"
        stickySubmit
      />,
    );
    const bouton = screen.getByRole("button", { name: /enregistrer les informations/i });
    // La classe PARTAGÉE, pas un `sticky` utilitaire : c'est elle qui porte le
    // dégagement de la barre d'onglets (cf. barre-action-collante.test.ts).
    expect(bouton.closest(".barre-action-collante")).not.toBeNull();
  });

  it("sans stickySubmit : disposition normale, pas de barre collante", () => {
    render(
      <InlineActionForm
        action={action}
        hidden={{}}
        fields={champs}
        submitLabel="Enregistrer"
        variant="primary"
      />,
    );
    const bouton = screen.getByRole("button", { name: /^enregistrer$/i });
    expect(bouton.closest(".barre-action-collante")).toBeNull();
  });

  it("champ requis : libellé et astérisque groupés (jamais le « * » sur sa propre ligne)", () => {
    const { container } = render(
      <InlineActionForm
        action={action}
        hidden={{}}
        fields={champs}
        submitLabel="Enregistrer"
      />,
    );
    const label = container.querySelector("label");
    const premierSpan = label?.querySelector(":scope > span");
    // Le libellé ET l'astérisque vivent dans le même span (une seule ligne).
    expect(premierSpan?.textContent).toMatch(/Titre/);
    expect(premierSpan?.textContent).toContain("*");
    expect(premierSpan?.textContent).toContain("(obligatoire)");
  });
});

describe("InlineActionForm — indice de champ (hint)", () => {
  it("l'indice est relié en aria-describedby, PAS dans le nom accessible du champ", () => {
    render(
      <InlineActionForm
        action={action}
        hidden={{}}
        fields={[
          {
            kind: "input" as const,
            name: "endpoint",
            label: "Id d'endpoint Sessionize",
            hint: "Colle uniquement l'ID.",
          },
        ]}
        submitLabel="Enregistrer"
      />,
    );
    // Nom accessible = le libellé SEUL (l'indice ne doit pas s'y glisser).
    const champ = screen.getByRole("textbox", { name: "Id d'endpoint Sessionize" });
    // L'indice est bien présent et associé comme DESCRIPTION.
    const indice = screen.getByText("Colle uniquement l'ID.");
    expect(champ.getAttribute("aria-describedby")).toBe(indice.id);
    // L'indice vit HORS du label (sinon il polluerait le nom accessible).
    expect(indice.closest("label")).toBeNull();
  });
});

describe("InlineActionForm — bouton qui confirme", () => {
  it("au succès le bouton devient « Enregistré ✓ », puis revient au libellé en retouchant", async () => {
    const ok = vi.fn(async () => ({ status: "success" }) as never);
    const user = userEvent.setup();
    render(
      <InlineActionForm
        action={ok}
        hidden={{}}
        fields={champs}
        submitLabel="Enregistrer les informations"
        variant="primary"
      />,
    );
    await user.type(screen.getByLabelText(/titre/i), "X");
    await user.click(
      screen.getByRole("button", { name: /enregistrer les informations/i }),
    );
    // Le bouton lui-même porte la confirmation, à l'endroit où l'œil est déjà.
    expect(
      await screen.findByRole("button", { name: /enregistré ✓/i }),
    ).toBeInTheDocument();
  });
});
