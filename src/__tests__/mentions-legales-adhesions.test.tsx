import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import MentionsLegales from "@/app/mentions-legales/page";

/**
 * Les adhésions HelloAsso dans la notice (art. 13 : dire ce qu'on recopie,
 * pourquoi, et combien de temps). Cf. docs/conception-adhesions-helloasso.md § 7.
 */

afterEach(cleanup);

describe("mentions légales — adhésions", () => {
  it("dit ce qui est recopié de HelloAsso, et seulement pour un compte existant", async () => {
    render(await MentionsLegales());
    const titre = screen.getByRole("heading", { name: "Adhésions" });
    const section = titre.nextElementSibling!;
    expect(section).toHaveTextContent(/HelloAsso/);
    expect(section).toHaveTextContent(/date de début, l'échéance/i);
    expect(section).toHaveTextContent(/adresse indiquée pour un membre/i);
    expect(section).toHaveTextContent(/reste uniquement chez HelloAsso/i);
  });

  it("la durée maximale de conservation dit l'exception de l'adhésion en cours", async () => {
    // La notice annonçait un maximum que le code dépasse par construction :
    // une adhésion à jour suspend le compte à rebours (dette, 2026-10-15).
    render(await MentionsLegales());
    expect(screen.getByText(/conservation maximale/i)).toHaveTextContent(
      /hors adhésion en cours/i,
    );
  });

  it("annonce l'invitation à adhérer parmi les e-mails envoyés", async () => {
    render(await MentionsLegales());
    expect(document.body.textContent).toMatch(/invitation à adhérer, envoyée une seule fois/);
  });
});

