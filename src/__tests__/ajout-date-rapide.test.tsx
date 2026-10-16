import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let parametres = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametres,
}));
vi.mock("@/app/mon-espace/actions", () => ({
  addTalkAction: vi.fn(),
  updateTalkAction: vi.fn(),
  addOccurrenceAction: vi.fn(),
  addOccurrenceRapideAction: vi.fn(),
  updateOccurrenceAction: vi.fn(),
}));

import AjoutDateRapide from "@/app/mon-espace/AjoutDateRapide";
import type { OccurrenceSuggestions } from "@/lib/talks";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  parametres = new URLSearchParams();
  window.history.replaceState(null, "", "/");
});

const suggestions: OccurrenceSuggestions = {
  registre: [{ id: 2, nom: "DevFest Toulouse", ville: "Toulouse", pays: "France", editions: [] }],
  villes: ["Toulouse"],
  pays: ["France"],
};
const TALK = { id: 12, titre: "IA et personnes aveugles" };
// Le titre entre guillemets à insécables, comme à l'écran.
const NOM = "«\u00a0IA et personnes aveugles\u00a0»";

/**
 * Ajouter une date à un talk SANS l'ouvrir (refonte de la navigation
 * connectée, 2026-10-15) : le geste le plus fréquent d'une speakeuse — « mon
 * talk est retenu à une nouvelle conf » — se fait depuis la fiche, dans une
 * fenêtre ouverte par UN bouton sur le talk (principes UI, règle d'or : pas de
 * formulaire en ligne dans une liste). La fenêtre ne garde que l'essentiel :
 * conférence, édition, date, ville ; slides et liens se complètent après.
 */
describe("AjoutDateRapide — la fenêtre de date d'un talk", () => {
  it("le bouton dit « Une date » et nomme son talk (libellé visible en tête, WCAG 2.5.3)", () => {
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    const bouton = screen.getByRole("button", { name: /^une date/i });
    expect(bouton).toHaveAccessibleName(`Une date pour ${NOM}`);
    expect(bouton).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("ouverte : titrée par son talk, réduite à l'essentiel", async () => {
    const u = userEvent.setup();
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: /^une date/i }));

    expect(
      screen.getByRole("heading", { name: `Une date pour ${NOM}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /conférence/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ville/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /date/i })).toBeInTheDocument();
    // Les liens se complètent APRÈS, sur la page du talk.
    expect(screen.queryByLabelText(/lien slides/i)).toBeNull();
    expect(screen.queryByLabelText(/lien vidéo/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Ajouter la date" })).toBeInTheDocument();
  });

  it("arrivée par « Ajouter une date à un talk » (`?date=<id>`) : la fenêtre s'ouvre seule, et le paramètre est CONSOMMÉ", () => {
    window.history.replaceState(null, "", "/mon-espace/fiche?date=12");
    parametres = new URLSearchParams("date=12");
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: `Une date pour ${NOM}` }),
    ).toBeInTheDocument();
    // Retiré de l'adresse : un rechargement ne rouvre pas une fenêtre fermée,
    // et le même lien recliqué redevient une transition.
    expect(window.location.search).toBe("");
  });

  it("déjà sur la fiche : le paramètre qui ARRIVE ouvre la fenêtre (transition, pas montage)", () => {
    const { rerender } = render(
      <AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />,
    );
    expect(screen.queryByRole("heading", { name: /une date pour/i })).toBeNull();
    parametres = new URLSearchParams("date=12");
    rerender(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: `Une date pour ${NOM}` }),
    ).toBeInTheDocument();
  });

  it("le `?date=` d'un AUTRE talk n'ouvre pas cette fenêtre", () => {
    parametres = new URLSearchParams("date=7");
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: /une date pour/i })).toBeNull();
  });

  it("enregistrée : la fenêtre se ferme, la confirmation NOMME le talk", async () => {
    const action = vi.fn(async () => ({ ok: true, issue: "conf_ajoutee" as const }));
    const u = userEvent.setup();
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={action} />);
    await u.click(screen.getByRole("button", { name: /^une date/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Ajouter la date" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Date ajoutée à « IA et personnes aveugles ».",
      ),
    );
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { name: /une date pour/i })).toBeNull();
  });

  it("conférence hors registre : la confirmation dit que la date attend la validation", async () => {
    const action = vi.fn(async () => ({ ok: true, issue: "conf_proposee" as const }));
    const u = userEvent.setup();
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={action} />);
    await u.click(screen.getByRole("button", { name: /^une date/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Ajouter la date" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Date enregistrée pour « IA et personnes aveugles ». La conférence attend la validation de l'équipe, puis rejoint ta fiche publique.",
      ),
    );
  });

  it("refusée : la fenêtre reste ouverte, l'erreur s'affiche", async () => {
    const action = vi.fn(async () => ({
      ok: false,
      errors: { conference: "Ce talk est introuvable." },
    }));
    const u = userEvent.setup();
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={action} />);
    await u.click(screen.getByRole("button", { name: /^une date/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Ajouter la date" }).closest("form")!);

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((a) => a.textContent?.includes("Ce talk est introuvable.")),
      ).toBe(true),
    );
    expect(
      screen.getByRole("heading", { name: /une date pour/i }),
    ).toBeInTheDocument();
  });

  // Le <dialog> natif rend le focus à ce qui l'avait avant l'ouverture : par
  // ➕, un lien de la feuille démonté depuis. Le focus revient donc au bouton
  // « Une date » de CE talk, à côté de sa confirmation (revue RGAA 2026-10-15).
  it("fermée, le focus revient au bouton « Une date » du talk, même ouverte par l'URL", async () => {
    parametres = new URLSearchParams("date=12");
    const u = userEvent.setup();
    render(<AjoutDateRapide talk={TALK} suggestions={suggestions} action={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.getByRole("button", { name: /^une date/i })).toHaveFocus();
  });
});
