import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Les verbatims sur la home : ce sont les personnes concernées qui parlent le
 * mieux du Tremplin, donc leur parole passe AVANT nos propres arguments.
 *
 * Placement tenu par ces tests : juste après les chiffres clés. Les chiffres
 * posent le constat (17 % de femmes dans la tech), les voix disent ce que ça
 * change — et le reste de la page (agenda, actualités, CTA) vient après.
 */

vi.mock("@/lib/profiles", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  countPublishedProfiles: vi.fn(async () => 12),
}));
vi.mock("@/lib/agenda-public", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getScenesPubliques: vi.fn(async () => []),
}));
vi.mock("@/lib/fil-communaute", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNouvellesVenues: vi.fn(async () => []),
}));

import Home from "@/app/page";
import { verbatims } from "@/data/verbatims";

afterEach(cleanup);

describe("Home — les verbatims", () => {
  it("publie toutes les paroles recueillies, attribuées", async () => {
    render(await Home());
    const bloc = screen.getByRole("region", { name: /en parlent/i });
    for (const v of verbatims) {
      // Testing Library normalise les espaces : l'insécable de la typographie
      // française y devient une espace ordinaire, la citation attendue aussi.
      const attendue = escapeRegExp(v.citation.replace(/\u00A0/g, " "));
      expect(within(bloc).getByText(new RegExp(attendue))).toBeInTheDocument();
      expect(within(bloc).getByText(v.auteur)).toBeInTheDocument();
    }
  });

  it("vient juste après les chiffres clés, avant le reste de la page", async () => {
    const { container } = render(await Home());
    const sections = Array.from(container.querySelectorAll("section"));
    const rang = (nom: RegExp) =>
      sections.findIndex((s) =>
        nom.test(s.getAttribute("aria-label") ?? "") ||
        nom.test(s.querySelector("h2")?.textContent ?? ""),
      );
    const chiffres = rang(/chiffres clés/i);
    const paroles = rang(/en parlent/i);
    const aQui = rang(/à qui s['’]adresse/i);
    expect(chiffres).toBeGreaterThanOrEqual(0);
    expect(paroles).toBe(chiffres + 1);
    expect(paroles).toBeLessThan(aQui);
  });

  it("laisse le CTA Tremplin seul CTA de la section basse (aucun bouton ajouté)", async () => {
    // Une page = un rôle, un CTA principal : le bloc de verbatims est une
    // preuve, pas une nouvelle porte de sortie. Ses seuls boutons sont les
    // commandes du défilement.
    render(await Home());
    const bloc = screen.getByRole("region", { name: /en parlent/i });
    expect(within(bloc).queryAllByRole("link")).toHaveLength(0);
    for (const bouton of within(bloc).getAllByRole("button")) {
      expect(bouton).toHaveAccessibleName(/verbatim/i);
    }
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
