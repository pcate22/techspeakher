import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useSessionMock = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => useSessionMock(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
// SearchBar touche router/data → on le remplace par un marqueur inerte, ce qui
// permet aussi de compter les loupes rendues (garde-fou anti-doublon).
vi.mock("@/components/SearchBar", () => ({ default: () => <span data-testid="searchbar" /> }));

import Header from "@/components/Header";
import { navLinks } from "@/constants/navigation";

beforeEach(() => {
  useSessionMock.mockReturnValue({ status: "unauthenticated" });
});
afterEach(() => cleanup());

function connecte(isOrga = false) {
  useSessionMock.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "1", name: "Cateline Puccetti", email: "c@x.fr", isOrga } },
  });
}

describe("Header — recherche", () => {
  it("rend une seule loupe par contexte : 1 desktop + 1 mobile, jamais de doublon", () => {
    render(<Header />);
    // Les deux conteneurs (desktop `xl:flex`, mobile `xl:hidden`) coexistent dans
    // le DOM sous jsdom (seul le CSS les montre/cache) : exactement 2 loupes.
    expect(screen.getAllByTestId("searchbar")).toHaveLength(2);
  });
});

describe("Header — disposition mobile (conception N1 §2.1)", () => {
  it("le burger vient AVANT le logo : ☰ à gauche, geste rare", () => {
    connecte();
    render(<Header />);
    const burger = screen.getByRole("button", { name: /ouvrir le menu/i });
    const logo = screen.getByRole("link", { name: /tech speak'her, accueil/i });
    // DOCUMENT_POSITION_FOLLOWING (4) : le logo suit le burger dans le DOM.
    expect(burger.compareDocumentPosition(logo) & 4).toBeTruthy();
  });
});

describe("Header — accès à la plateforme", () => {
  it("affiche « Se connecter » quand on est déconnectée", () => {
    render(<Header />);
    expect(
      screen.getAllByRole("link", { name: /se connecter/i }).length,
    ).toBeGreaterThan(0);
  });

  it("affiche le menu compte (avatar) quand on est connectée", async () => {
    connecte();
    render(<Header />);
    // AccountMenu est chargé en next/dynamic → apparaît après hydratation.
    // Deux conteneurs, comme la loupe : la nav desktop (`xl`) et la bande
    // `lg`-`xl` où le burger a pris la place (2026-10-15). Le CSS en montre un.
    expect(await screen.findAllByRole("button", { name: /mon compte/i })).toHaveLength(2);
  });

  it("le menu compte est le pendant desktop de l'onglet Profil : Mon espace, Mon profil, Réglages, Se déconnecter", async () => {
    const u = userEvent.setup();
    connecte();
    render(<Header />);
    await u.click((await screen.findAllByRole("button", { name: /mon compte/i }))[0]);
    expect(screen.getByRole("menuitem", { name: /mon espace/i })).toHaveAttribute(
      "href",
      "/mon-espace",
    );
    expect(screen.getByRole("menuitem", { name: /mon profil/i })).toHaveAttribute(
      "href",
      "/mon-espace/profil",
    );
    expect(screen.getByRole("menuitem", { name: /réglages/i })).toHaveAttribute(
      "href",
      "/mon-espace/reglages",
    );
    expect(
      screen.getByRole("menuitem", { name: /se déconnecter/i }),
    ).toBeInTheDocument();
  });

  // « Ma fiche » est entrée dans le menu le 2026-10-15 (refonte de la
  // navigation connectée, validée par Cateline) : c'est LE geste du produit,
  // pas une porte de rôle. Les portes de RÔLE, elles, restent hors du menu.
  it("les portes de rôle vivent sur le profil et le rail : NI tableau de bord NI talks, même orga", async () => {
    const u = userEvent.setup();
    connecte(true);
    render(<Header />);
    await u.click((await screen.findAllByRole("button", { name: /mon compte/i }))[0]);
    expect(screen.queryByRole("menuitem", { name: /tableau de bord/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /organisatrices/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /talks/i })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Ma fiche" })).toHaveAttribute(
      "href",
      "/mon-espace/fiche",
    );
  });
});

describe("Header — burger mobile (le site, rien que le site)", () => {
  const ouvrirBurger = async (u: ReturnType<typeof userEvent.setup>) => {
    await u.click(screen.getByRole("button", { name: /ouvrir le menu/i }));
  };
  const tiroir = () => within(document.getElementById("mobile-menu") as HTMLElement);

  it("le tiroir offre une porte NOMMÉE vers l'accueil du site, puis tout le site public", async () => {
    const u = userEvent.setup();
    connecte();
    render(<Header />);
    await ouvrirBurger(u);
    expect(
      tiroir().getByRole("link", { name: /accueil du site/i }),
    ).toHaveAttribute("href", "/");
    for (const lien of navLinks) {
      expect(tiroir().getByRole("link", { name: new RegExp(lien.label, "i") })).toHaveAttribute(
        "href",
        lien.href,
      );
    }
  });

  it("connectée : le site + LA porte « Mon espace » — le « moi » vit sur l'onglet Profil", async () => {
    const u = userEvent.setup();
    connecte(true);
    render(<Header />);
    await ouvrirBurger(u);
    // La porte de retour vers l'app (finding de revue N1) : sur une page du
    // site public, la barre basse n'existe pas — sans elle, une connectée
    // mobile restait coincée côté site. UNE porte, jamais l'inventaire.
    expect(tiroir().getByRole("link", { name: /^mon espace$/i })).toHaveAttribute(
      "href",
      "/mon-espace",
    );
    // Sortis du tiroir (conception N1 §2.2, validée) : la section « Mon
    // compte », la carte d'identité, la déconnexion et les réglages — tout
    // cela vit désormais sur la page « Mon profil » (onglet photo).
    expect(tiroir().queryByRole("link", { name: /espace orga/i })).toBeNull();
    expect(tiroir().queryByRole("link", { name: /réglages/i })).toBeNull();
    expect(tiroir().queryByRole("button", { name: /se déconnecter/i })).toBeNull();
    expect(screen.queryByText(/connectée/i)).toBeNull();
  });

  it("le tiroir ne refait PAS la barre d'onglets (la porte, jamais l'inventaire)", async () => {
    const u = userEvent.setup();
    connecte(true);
    render(<Header />);
    await ouvrirBurger(u);
    const interieur = [
      "/mon-espace/agenda",
      "/mon-espace/profil",
      "/mon-espace/messages",
      "/admin",
      "/mon-espace/a-faire",
      // L'ancienne adresse de « À faire » (308 depuis l'étape B) : un tiroir
      // public qui la ressortirait ferait rebondir chaque tap.
      "/admin/taches",
    ];
    const hrefs = tiroir()
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    for (const href of interieur) expect(hrefs).not.toContain(href);
  });

  it("déconnectée : l'entrée du site — « Rejoindre l'annuaire » et « Se connecter » — reste dans le tiroir", async () => {
    const u = userEvent.setup();
    render(<Header />);
    await ouvrirBurger(u);
    expect(
      tiroir().getByRole("link", { name: /rejoindre l'annuaire/i }),
    ).toBeInTheDocument();
    expect(
      tiroir().getByRole("link", { name: /se connecter/i }),
    ).toBeInTheDocument();
    // « Accueil du site » est IDENTIQUE connectée ou non (conception v2 §3).
    expect(
      tiroir().getByRole("link", { name: /accueil du site/i }),
    ).toHaveAttribute("href", "/");
  });
});
