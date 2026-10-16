import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * L'écran d'import face au cas RÉEL qui a motivé ces règles : l'export Notist
 * d'un profil (fichier d'Aurélie Vache, essai du 16/08) porte 178 dates et
 * AUCUN nom de conférence. Deux exigences d'honnêteté en découlent :
 *   - la prévisualisation ne répète pas 178 fois « Sans conférence » ;
 *   - le récapitulatif DIT que les scènes manquent, au lieu d'annoncer
 *     « 73 talks créés » et de laisser croire que tout est passé.
 */

const previewAction = vi.fn();
const confirmAction = vi.fn();

vi.mock("@/app/mon-espace/talks/importer/actions", () => ({
  previewImportAction: (...a: unknown[]) => previewAction(...a),
  confirmImportAction: (...a: unknown[]) => confirmAction(...a),
}));

import ImportTalksForm from "@/app/mon-espace/talks/importer/ImportTalksForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Un talk dont TOUTES les scènes sont sans conférence (le cas Notist). */
const PLAN_SANS_CONF = [
  {
    titre: "Understanding Kubernetes in a visual way",
    description: null,
    talkIdExistant: null,
    statut: "nouveau" as const,
    occurrences: [
      { conference: null, date: "2026-07-09", ville: null, pays: null, lien: null, action: "ignoree" as const, conferenceId: null, editionId: null, libelle: null, nomPropose: null, annee: null },
      { conference: null, date: "2026-02-27", ville: null, pays: null, lien: null, action: "ignoree" as const, conferenceId: null, editionId: null, libelle: null, nomPropose: null, annee: null },
      { conference: null, date: "2025-11-10", ville: null, pays: null, lien: null, action: "ignoree" as const, conferenceId: null, editionId: null, libelle: null, nomPropose: null, annee: null },
    ],
  },
];

async function afficherPrevisualisation() {
  previewAction.mockResolvedValue({
    ok: true,
    texte: "[]",
    plan: PLAN_SANS_CONF,
    ignorees: 0,
  });
  const u = userEvent.setup();
  render(<ImportTalksForm />);
  await u.click(screen.getByRole("button", { name: /analyser le fichier/i }));
  await screen.findByRole("button", { name: /importer la sélection/i });
  return u;
}

describe("ImportTalksForm — un fichier sans aucune conférence", () => {
  it("résume les scènes en UNE ligne au lieu d'une par date", async () => {
    await afficherPrevisualisation();
    expect(
      screen.getByText(/3 dates sans nom de conférence/i),
    ).toBeInTheDocument();
    // Pas de badge répété par date.
    expect(screen.queryAllByText(/^Sans conférence$/)).toHaveLength(0);
  });

  it("le récapitulatif DIT les dates laissées de côté (pas seulement les talks créés)", async () => {
    const u = await afficherPrevisualisation();
    confirmAction.mockResolvedValue({
      ok: true,
      resultat: {
        talksCrees: 73,
        talksCompletes: 0,
        occurrencesPubliees: 0,
        occurrencesEnAttente: 0,
        occurrencesEcartees: 0,
        scenesSansConference: 178,
        doublons: 0,
      },
    });
    await u.click(screen.getByRole("button", { name: /importer la sélection/i }));

    expect(await screen.findByText(/73 talks créés/i)).toBeInTheDocument();
    expect(
      screen.getByText(/178 dates sans nom de conférence dans le fichier/i),
    ).toBeInTheDocument();
  });
});
