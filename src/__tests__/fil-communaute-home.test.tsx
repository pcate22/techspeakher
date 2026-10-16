import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * L'extrait « fil de la communauté » de la home publique : les dernières fiches
 * entrées dans l'annuaire. Avec « Bientôt en scène », c'est le deuxième bloc
 * VIVANT de la page — il vient des fiches, pas d'un contenu rédigé, et dit au
 * visiteur : cette communauté grandit, et voilà qui.
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
  getNouvellesVenues: vi.fn(),
}));

import { getNouvellesVenues, type NouvelleVenue } from "@/lib/fil-communaute";
import Home from "@/app/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const venue = (o: Partial<NouvelleVenue> & { profileId: number }): NouvelleVenue => ({
  nom: `Speakeuse ${o.profileId}`,
  href: `/speakeuses/${o.profileId}`,
  titreProfil: null,
  image: null,
  date: "2026-07-20",
  ...o,
});

describe("Home — « Elles viennent d'arriver »", () => {
  it("montre les dernières venues, chacune menant à sa fiche", async () => {
    vi.mocked(getNouvellesVenues).mockResolvedValue([
      venue({ profileId: 1, nom: "Léa Dubois", href: "/speakeuses/lea-dubois", titreProfil: "Ingénieure plateforme" }),
      venue({ profileId: 2, nom: "Aïcha Benali" }),
      venue({ profileId: 3, nom: "Nadia Lopez" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /viennent d'arriver/i });
    expect(within(bloc).getAllByRole("listitem")).toHaveLength(3);
    expect(within(bloc).getByRole("link", { name: /léa dubois/i })).toHaveAttribute(
      "href",
      "/speakeuses/lea-dubois",
    );
    expect(within(bloc).getByText("Ingénieure plateforme")).toBeInTheDocument();
    expect(
      within(bloc).getByRole("link", { name: /voir tout l'annuaire/i }),
    ).toHaveAttribute("href", "/speakeuses");
  });

  it("le lien « voir tout l'annuaire » vient APRÈS les cartes, pas avant", async () => {
    vi.mocked(getNouvellesVenues).mockResolvedValue([
      venue({ profileId: 1, nom: "Léa Dubois" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /viennent d'arriver/i });
    const positions = [...bloc.querySelectorAll("li, a")].map((el) =>
      el.textContent?.includes("Voir tout l'annuaire") ? "lien" : "carte",
    );
    expect(positions.indexOf("lien")).toBeGreaterThan(positions.lastIndexOf("carte"));
  });

  it("sans nouvelle venue : pas de cadre vide sur la home", async () => {
    vi.mocked(getNouvellesVenues).mockResolvedValue([]);
    render(await Home());
    expect(screen.queryByRole("region", { name: /viennent d'arriver/i })).toBeNull();
  });

  it("base indisponible : la home s'affiche quand même, sans le bloc", async () => {
    vi.mocked(getNouvellesVenues).mockRejectedValue(new Error("db down"));
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /viennent d'arriver/i })).toBeNull();
  });
});
