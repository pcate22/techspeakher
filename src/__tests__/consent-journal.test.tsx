import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ConsentJournal from "@/components/ConsentJournal";
import type { ConsentLogEntry } from "@/lib/tremplin-registrations";

afterEach(cleanup);

describe("ConsentJournal (journal de consentement, RGPD)", () => {
  it("octroi : dit l'origine à la forme positive et lie la preuve (nouvelle fenêtre)", () => {
    const entries: ConsentLogEntry[] = [
      {
        action: "accorde",
        base: "formulaire_inscription",
        preuveLien: "https://drive.exemple/preuve",
        createdAt: "2026-03-12T10:00:00.000Z",
      },
    ];
    render(<ConsentJournal entries={entries} />);

    expect(screen.getByText(/Accordé le 12 mars 2026/)).toBeInTheDocument();
    expect(screen.getByText(/via le formulaire d'inscription/)).toBeInTheDocument();

    const lien = screen.getByRole("link", { name: /voir la preuve/ });
    expect(lien).toHaveAttribute("href", "https://drive.exemple/preuve");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Info « nouvelle fenêtre » disponible au lecteur d'écran (RGAA).
    expect(lien).toHaveTextContent("nouvelle fenêtre");
  });

  it("retrait : pas d'origine affichée, pas de lien de preuve", () => {
    const entries: ConsentLogEntry[] = [
      { action: "retire", base: "self", preuveLien: null, createdAt: "2026-04-01T09:00:00.000Z" },
    ];
    render(<ConsentJournal entries={entries} />);

    expect(screen.getByText(/Retiré le 1 avril 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/via/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("octroi self-service : origine « par la personne », sans lien", () => {
    render(
      <ConsentJournal
        entries={[
          { action: "accorde", base: "self", preuveLien: null, createdAt: "2026-05-05T08:00:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByText(/par la personne, dans son espace/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("journal vide : message de repli, aucune liste", () => {
    render(<ConsentJournal entries={[]} emptyLabel="Rien de consigné." />);
    expect(screen.getByText("Rien de consigné.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
