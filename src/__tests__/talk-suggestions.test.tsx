import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Les Server Actions ne s'exécutent pas dans jsdom : on ne teste que le rendu.
vi.mock("@/app/mon-espace/actions", () => ({
  acceptSuggestionAction: vi.fn(),
  refuseSuggestionAction: vi.fn(),
}));

import TalkSuggestions from "@/app/mon-espace/TalkSuggestions";
import type { PendingSuggestion } from "@/lib/cfp-suggestions";

afterEach(cleanup);

const suggestions: PendingSuggestion[] = [
  {
    id: 9,
    externalId: "sess-1",
    titre: "Beyond Agile",
    description: null,
    date: "2026-11-19",
    conference: "DevFest Toulouse 2026",
    ville: "Toulouse",
    pays: "France",
    lienConf: null,
  },
];

describe("TalkSuggestions", () => {
  it("n'affiche rien sans suggestion", () => {
    const { container } = render(<TalkSuggestions suggestions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("affiche titre, conférence et date, avec les deux boutons par suggestion", () => {
    render(<TalkSuggestions suggestions={suggestions} />);
    expect(screen.getByText("Beyond Agile")).toBeTruthy();
    expect(screen.getByText(/DevFest Toulouse 2026/)).toBeTruthy();
    expect(screen.getByText(/19 novembre 2026/)).toBeTruthy();
    // le nom accessible porte le titre du talk : plusieurs suggestions restent
    // distinguables au lecteur d'écran
    expect(
      screen.getByRole("button", { name: /confirmer.*beyond agile/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /écarter.*beyond agile/i }),
    ).toBeTruthy();
  });

  it("écarter demande confirmation (le refus est définitif)", async () => {
    render(<TalkSuggestions suggestions={suggestions} />);
    fireEvent.click(screen.getByRole("button", { name: /écarter/i }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/plus jamais proposé/i)).toBeTruthy();
    // le formulaire de refus (dans le dialogue) porte l'id de la suggestion
    const hidden = document.querySelectorAll('input[name="suggestionId"]');
    expect(hidden.length).toBeGreaterThanOrEqual(2); // confirmer + refuser (dialogue)
    hidden.forEach((h) => expect((h as HTMLInputElement).value).toBe("9"));
  });

  it("le formulaire de confirmation porte l'id de la suggestion (champ caché)", () => {
    const { container } = render(<TalkSuggestions suggestions={suggestions} />);
    const hidden = container.querySelectorAll('input[name="suggestionId"]');
    expect(hidden).toHaveLength(1); // confirmer (le refus vit dans le dialogue)
    expect((hidden[0] as HTMLInputElement).value).toBe("9");
  });
});
