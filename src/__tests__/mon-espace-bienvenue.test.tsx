import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { makeProfile } from "./test-helpers";

/**
 * Mon espace à l'heure de l'inscription express : une connectée sans fiche
 * part vers les deux écrans de création, une fiche qui vient de paraître est
 * saluée, et « Pour aller plus loin » mène à chaque page de complément.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/mon-espace",
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/agenda-public", () => ({ getScenesRecentes: vi.fn(async () => []) }));
vi.mock("@/lib/fil-communaute", () => ({ getNouvellesVenues: vi.fn(async () => []) }));
vi.mock("@/lib/contenus", () => ({ listPublicationsRecentes: vi.fn(async () => []) }));
vi.mock("@/lib/users", () => ({
  getCompte: vi.fn(async () => ({ name: "Ada Lovelace", genre: null })),
  peutCreerFiche: (genre: string | null) => genre !== "homme",
}));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn(async () => null) }));
vi.mock("@/lib/talks", () => ({ getTalksCountByProfileId: vi.fn(async () => 0) }));
vi.mock("@/lib/reactions", () => ({ getReactionsPourFil: vi.fn(async () => new Map()) }));
vi.mock("@/app/mon-espace/actions", () => ({ reactionAction: vi.fn() }));

import { auth } from "@/auth";
import { getCompte } from "@/lib/users";
import { getProfileByUserId } from "@/lib/profiles";
import Accueil from "@/app/mon-espace/page";

afterEach(cleanup);

const rendu = async (ok?: string) =>
  render(await Accueil({ searchParams: Promise.resolve(ok ? { ok } : {}) }));

const ficheVide = () =>
  makeProfile({
    image: null,
    ville: null,
    bio: null,
    secteurs: [],
    linkedin: null,
    website: null,
    instagram: null,
    sujets: ["Accessibilité"],
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "Ada Lovelace" } } as never);
  vi.mocked(getCompte).mockResolvedValue({ name: "Ada Lovelace", genre: null, image: null });
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
});

describe("Mon espace : routage", () => {
  it("connectée sans fiche → /mon-espace/bienvenue", async () => {
    await expect(rendu()).rejects.toThrow("REDIRECT:/mon-espace/bienvenue");
  });

  // Bienvenue renvoie ici qui ne peut pas créer de fiche : rediriger ce compte
  // vers Bienvenue ferait une boucle.
  it("sans fiche et sans droit d'en créer une → reste sur le fil", async () => {
    vi.mocked(getCompte).mockResolvedValue({ name: "Bob", genre: "homme", image: null });
    await rendu();
    expect(screen.getByRole("heading", { name: /bonjour/i })).toBeInTheDocument();
  });
});

describe("Mon espace : après publication", () => {
  it("?ok=fiche_publiee → « Ta fiche est en ligne. »", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(ficheVide());
    await rendu("fiche_publiee");
    expect(await screen.findByText("Ta fiche est en ligne.")).toBeInTheDocument();
  });

  it("?ok=fiche_envoyee → la relecture sous 48 h", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(ficheVide());
    await rendu("fiche_envoyee");
    // Normaliseur réduit au trim : celui par défaut change l'espace insécable
    // de « 48 h » en espace simple, et le test ne la garderait plus.
    const attendu = "Ta fiche est envoyée. L'équipe la relit, en général sous 48\u00a0h.";
    expect(await screen.findByText(attendu, { normalizer: (t) => t.trim() })).toBeInTheDocument();
  });

  it("« Pour aller plus loin » liste talk, photo, ville, présentation, secteurs et liens", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(ficheVide());
    await rendu("fiche_publiee");
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    const liens = within(section)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(liens).toEqual([
      "/mon-espace/talks/nouveau",
      "/mon-espace/fiche/identite",
      "/mon-espace/fiche/secteurs",
      "/mon-espace/fiche/contact",
    ]);
    // Trois manques d'identité → une seule ligne qui les nomme.
    expect(
      within(section).getByRole("link", {
        name: "Complète ton identité (photo, ville, présentation)",
      }),
    ).toBeInTheDocument();
  });

  it("deux manques d'identité → une ligne qui ne nomme qu'eux", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue({ ...ficheVide(), ville: "Toulouse" });
    await rendu("fiche_publiee");
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    expect(
      within(section).getByRole("link", { name: "Complète ton identité (photo, présentation)" }),
    ).toBeInTheDocument();
  });

  it("un seul manque d'identité → sa ligne à lui", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue({
      ...ficheVide(),
      ville: "Toulouse",
      bio: "Je parle de cloud.",
    });
    await rendu("fiche_publiee");
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    expect(within(section).getByRole("link", { name: "Ajoute une photo" })).toBeInTheDocument();
    expect(within(section).queryByRole("link", { name: /Complète ton identité/ })).toBeNull();
  });

  it("une fiche sans thème → « Choisis tes thèmes » en premier, même sans message", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue({ ...ficheVide(), sujets: [] });
    await rendu();
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    const premier = within(section).getAllByRole("link")[0];
    expect(premier).toHaveTextContent("Choisis tes thèmes");
    expect(premier).toHaveAttribute("href", "/mon-espace/fiche/sujets");
  });

  it("fiche complète, sans message → pas de « Pour aller plus loin »", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ sujets: ["Cloud"] }));
    await rendu();
    expect(screen.queryByRole("region", { name: "Pour aller plus loin" })).toBeNull();
  });
});
