import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/admin/actions", () => ({ moderateProfileAction: vi.fn() }));
vi.mock("@/app/admin/speakeuses/relances/actions", () => ({ relancerFicheAction: vi.fn() }));

import ModerationPanel from "@/app/speakeuses/[id]/ModerationPanel";
import { relancerFicheAction } from "@/app/admin/speakeuses/relances/actions";

afterEach(cleanup);

describe("ModerationPanel", () => {
  it("affiche le statut et les actions de modération", () => {
    render(
      <ModerationPanel
        profileId={3}
        status="en_attente"
        submittedAt={null}
        refusMotif={null}
        relancable={false}
        rappelRefuse={false}
      />,
    );
    expect(screen.getByText(/en attente de validation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refuser/i })).toBeInTheDocument();
  });

  it("refuser révèle une zone de motif obligatoire", async () => {
    const u = userEvent.setup();
    render(
      <ModerationPanel
        profileId={3}
        status="en_attente"
        submittedAt={null}
        refusMotif={null}
        relancable={false}
        rappelRefuse={false}
      />,
    );
    const refuser = screen.getByRole("button", { name: /refuser/i });
    expect(refuser).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText(/motif du refus/i)).toBeNull();

    await u.click(refuser);
    expect(refuser).toHaveAttribute("aria-expanded", "true");
    const motif = screen.getByLabelText(/motif du refus/i);
    expect(motif).toBeInTheDocument();
    expect(motif).toBeRequired();
  });

  it("montre le motif d'un refus déjà décidé", () => {
    render(
      <ModerationPanel
        profileId={3}
        status="refuse"
        submittedAt={null}
        refusMotif="Bio vide"
        relancable={false}
        rappelRefuse={false}
      />,
    );
    expect(screen.getByText(/bio vide/i)).toBeInTheDocument();
  });
});

describe("ModerationPanel — relance d'un brouillon", () => {
  it("propose la relance sur un brouillon relançable", () => {
    render(
      <ModerationPanel
        profileId={3}
        status="brouillon"
        submittedAt={null}
        refusMotif={null}
        relancable
        rappelRefuse={false}
      />,
    );
    expect(screen.getByRole("button", { name: /relancer/i })).toBeInTheDocument();
  });

  it("garde le silence sur une fiche déjà soumise ou publiée", () => {
    // La relance parle d'un brouillon à reprendre : sur une fiche soumise, elle
    // dirait à quelqu'un de finir ce qu'il a déjà fini.
    for (const status of ["en_attente", "publie"] as const) {
      cleanup();
      render(
        <ModerationPanel
          profileId={3}
          status={status}
          submittedAt={null}
          refusMotif={null}
          relancable
          rappelRefuse={false}
        />,
      );
      expect(screen.queryByRole("button", { name: /relancer/i })).toBeNull();
    }
  });

  it("explique l'attente au lieu du bouton quand la relance est fermée", () => {
    render(
      <ModerationPanel
        profileId={3}
        status="brouillon"
        submittedAt={null}
        refusMotif={null}
        relancable={false}
        rappelRefuse={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /relancer/i })).toBeNull();
    expect(screen.getByText(/rouvrira plus tard/i)).toBeInTheDocument();
  });

  it("annonce le résultat nominativement, et retire le bouton après l'envoi", async () => {
    vi.mocked(relancerFicheAction).mockResolvedValue({
      status: "success",
      message: "Relance envoyée à Ada Lovelace.",
    });
    const u = userEvent.setup();
    render(
      <ModerationPanel
        profileId={3}
        status="brouillon"
        submittedAt={null}
        refusMotif={null}
        relancable
        rappelRefuse={false}
      />,
    );
    await u.click(screen.getByRole("button", { name: /relancer/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Ada Lovelace"),
    );
    // Le bouton part : un second clic ne partirait de toute façon pas (la base
    // refuse), autant éviter le geste inutile.
    expect(screen.queryByRole("button", { name: /relancer/i })).toBeNull();
  });

  it("nomme le refus de la speakeuse plutôt qu'une attente qui n'arrivera jamais", () => {
    // « La relance rouvrira plus tard » serait faux ici : un choix de la
    // personne ne rouvre pas. On le dit, et on dit quoi faire à la place.
    render(
      <ModerationPanel
        profileId={3}
        status="brouillon"
        submittedAt={null}
        refusMotif={null}
        relancable={false}
        rappelRefuse
      />,
    );
    expect(screen.queryByRole("button", { name: /relancer/i })).toBeNull();
    expect(screen.queryByText(/rouvrira plus tard/i)).toBeNull();
    expect(screen.getByText(/aucun rappel sur sa fiche/i)).toBeInTheDocument();
  });

  it("dit l'échec dans une alerte, et laisse retenter", async () => {
    vi.mocked(relancerFicheAction).mockResolvedValue({
      status: "error",
      error: "L'envoi a échoué.",
      values: {},
    });
    const u = userEvent.setup();
    render(
      <ModerationPanel
        profileId={3}
        status="brouillon"
        submittedAt={null}
        refusMotif={null}
        relancable
        rappelRefuse={false}
      />,
    );
    await u.click(screen.getByRole("button", { name: /relancer/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/échoué/i),
    );
    expect(screen.getByRole("button", { name: /relancer/i })).toBeInTheDocument();
  });
});
