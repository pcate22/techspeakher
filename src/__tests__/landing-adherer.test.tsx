import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

const comptes = vi.hoisted(() => ({ speakeuses: 42 as number | null }));
vi.mock("@/lib/profiles", () => ({
  countPublishedProfiles: async () => {
    if (comptes.speakeuses == null) throw new Error("base injoignable");
    return comptes.speakeuses;
  },
}));

import Adherer from "@/app/adherer/page";
import { HELLOASSO_ADHESION_URL } from "@/constants/site";
import { aSavoirAdhesion, landingAdhesion, tarifsAdhesion } from "@/data/adhesion";

/**
 * /ADHERER DEVIENT UNE LANDING (grille Scalezia, revue d'Audrey Jargot du
 * 06/10/2026) : la cible au-dessus de la promesse, des questions auxquelles on
 * répond « oui », la réassurance, puis la demande, la même partout. Les tarifs
 * et le « à savoir » viennent des statuts : ils restent, mot pour mot.
 */

afterEach(cleanup);
beforeEach(() => {
  comptes.speakeuses = 42;
});

describe("landing adhérer", () => {
  it("le titre principal porte le mot-clé et la promesse", async () => {
    render(await Adherer());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/adh/i);
  });

  it("l'action principale, répétée, mène toujours à la campagne d'adhésion", async () => {
    render(await Adherer());
    const ctas = screen.getAllByRole("link", { name: /Adhérer sur HelloAsso/ });
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const l of ctas) expect(l).toHaveAttribute("href", HELLOASSO_ADHESION_URL);
  });

  it("les questions « oui » viennent avant les tarifs", async () => {
    render(await Adherer());
    const questions = screen.getByRole("region", { name: /Vous vous reconnaissez/ });
    const tarifs = screen.getByRole("region", { name: /Tarifs/ });
    expect(within(questions).getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(questions.compareDocumentPosition(tarifs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("les tarifs et le « à savoir » des statuts restent, en entier", async () => {
    render(await Adherer());
    const page = document.body.textContent ?? "";
    for (const t of aSavoirAdhesion) expect(page).toContain(t);
    // Sans cette consigne, une membre adhère avec une autre adresse et son
    // adhésion reste introuvable pour la plateforme.
    expect(page).toContain(landingAdhesion.adresseCompte);
    // Le tarif bienfaitrice porte un lien au milieu : on compare sans lui.
    for (const t of tarifsAdhesion) expect(page).toContain(t.slice(0, 40));
  });

  it("sur mobile, l'action reste à portée du pouce", async () => {
    render(await Adherer());
    const barre = screen.getByRole("complementary", { name: /Adhérer/ });
    expect(barre).toHaveAttribute("data-barre-soutien");
    expect(within(barre).getByRole("link", { name: /Adhérer sur HelloAsso/ })).toHaveAttribute(
      "href",
      HELLOASSO_ADHESION_URL,
    );
  });

  it("affiche le nombre de speakeuses quand la base répond, et rien d'inventé sinon", async () => {
    render(await Adherer());
    expect(screen.getByText("42")).toBeInTheDocument();
    cleanup();
    comptes.speakeuses = null;
    render(await Adherer());
    expect(screen.queryByText(/speakeuses dans l.annuaire/)).toBeNull();
  });
});
