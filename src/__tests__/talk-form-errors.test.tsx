import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Non-régression du bug « le talk disparaît à chaque fois » : quand la Server
 * Action rejette la saisie (validation serveur), le formulaire DOIT afficher
 * l'erreur. Sans ça, la soumission échoue en silence : rien n'est enregistré et
 * la speakeuse ne comprend pas pourquoi son talk « disparaît ».
 *
 * Le filet couvre les DEUX formulaires du modèle refondu : TalkForm (identité)
 * et OccurrenceForm (conférence rattachée au talk).
 */

const addTalkAction = vi.fn();
const addOccurrenceAction = vi.fn();
vi.mock("@/app/mon-espace/actions", () => ({
  addTalkAction: (...a: unknown[]) => addTalkAction(...a),
  updateTalkAction: vi.fn(),
  addOccurrenceAction: (...a: unknown[]) => addOccurrenceAction(...a),
  updateOccurrenceAction: vi.fn(),
}));

import TalkForm from "@/app/mon-espace/TalkForm";
import OccurrenceForm from "@/app/mon-espace/OccurrenceForm";
import type { OccurrenceSuggestions } from "@/lib/talks";

afterEach(() => {
  cleanup();
  addTalkAction.mockReset();
  addOccurrenceAction.mockReset();
});

const suggestions: OccurrenceSuggestions = { registre: [], villes: [], pays: [] };

// ─── TalkForm (identité : titre, type, description) ───

async function submitTalkAndExpectError(
  field: string,
  message: string,
): Promise<void> {
  addTalkAction.mockResolvedValue({ ok: false, errors: { [field]: message } });
  const u = userEvent.setup();
  render(<TalkForm />);
  await u.type(screen.getByLabelText(/titre du talk/i), "Mon talk DevFest");
  await u.click(screen.getByRole("button", { name: /créer le talk/i }));
  await waitFor(() => {
    expect(screen.getByText(message)).toBeInTheDocument();
  });
}

describe("TalkForm — toute erreur serveur est visible (anti échec silencieux)", () => {
  it("affiche l'erreur de titre", async () => {
    await submitTalkAndExpectError("titre", "Titre trop long");
  });

  it("affiche l'erreur de description", async () => {
    await submitTalkAndExpectError("description", "Trop long (max 3000 caractères)");
  });

  it("affiche un message même pour une clé d'erreur inattendue (filet de sécurité)", async () => {
    addTalkAction.mockResolvedValue({
      ok: false,
      errors: { champInconnu: "Quelque chose ne va pas" },
    });
    const u = userEvent.setup();
    render(<TalkForm />);
    await u.type(screen.getByLabelText(/titre du talk/i), "T");
    await u.click(screen.getByRole("button", { name: /créer le talk/i }));
    await waitFor(() => {
      // Un résumé d'erreurs générique doit apparaître (role alert), pour ne
      // JAMAIS laisser une soumission échouer sans le moindre retour visuel.
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
      expect(screen.getByText("Quelque chose ne va pas")).toBeInTheDocument();
    });
  });
});

// ─── OccurrenceForm (conférence rattachée : lieu, date, liens) ───

async function submitOccurrenceAndExpectError(
  field: string,
  message: string,
): Promise<void> {
  addOccurrenceAction.mockResolvedValue({
    ok: false,
    errors: { [field]: message },
  });
  const u = userEvent.setup();
  render(
    <OccurrenceForm
      talkId={5}
      suggestions={suggestions}
    />,
  );
  // L'année (champ requis côté navigateur) est renseignée pour que la
  // soumission parte : on teste l'affichage de l'erreur SERVEUR.
  await u.selectOptions(screen.getByLabelText("Année"), "2026");
  await u.click(screen.getByRole("button", { name: /ajouter la conférence/i }));
  await waitFor(() => {
    expect(screen.getByText(message)).toBeInTheDocument();
  });
}

describe("OccurrenceForm — toute erreur serveur est visible (anti échec silencieux)", () => {
  it("affiche l'erreur de conférence", async () => {
    await submitOccurrenceAndExpectError(
      "conference",
      "Choisis une conférence dans la liste",
    );
  });

  it("affiche l'erreur de ville", async () => {
    await submitOccurrenceAndExpectError("ville", "Trop long (max 120 caractères)");
  });

  it("affiche l'erreur de pays", async () => {
    await submitOccurrenceAndExpectError("pays", "Trop long (max 120 caractères)");
  });

  it("affiche l'erreur de date", async () => {
    await submitOccurrenceAndExpectError(
      "date",
      "Choisis aussi le mois (ou enlève le jour)",
    );
  });

  it("affiche l'erreur de lien", async () => {
    await submitOccurrenceAndExpectError(
      "lienSlides",
      "Adresse invalide (ex. exemple.com)",
    );
  });

  it("affiche un message même pour une clé d'erreur inattendue (filet de sécurité)", async () => {
    addOccurrenceAction.mockResolvedValue({
      ok: false,
      errors: { champInconnu: "Quelque chose ne va pas" },
    });
    const u = userEvent.setup();
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
      />,
    );
    await u.selectOptions(screen.getByLabelText("Année"), "2026");
    await u.click(screen.getByRole("button", { name: /ajouter la conférence/i }));
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
      expect(screen.getByText("Quelque chose ne va pas")).toBeInTheDocument();
    });
  });
});
