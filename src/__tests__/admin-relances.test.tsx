import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/auth-guards", () => ({ requireOrgaPage: vi.fn() }));
vi.mock("@/lib/profiles", () => ({ getProfilesEnSommeil: vi.fn(async () => []) }));
vi.mock("@/lib/reglages", () => ({
  getReglages: vi.fn(async () => ({ relance_brouillon_jours: 30 })),
}));
vi.mock("@/app/admin/speakeuses/relances/actions", () => ({ relancerLotAction: vi.fn() }));

import { requireOrgaPage } from "@/lib/auth-guards";
import { getProfilesEnSommeil, type FicheEnSommeil } from "@/lib/profiles";
import RelancesPage from "@/app/admin/speakeuses/relances/page";

/** Une fiche en sommeil telle que la lib la rend, avec ce qui manque dessus. */
function fiche(
  id: number,
  nom: string,
  over: Partial<FicheEnSommeil["profile"]> = {},
  talksCount = 0,
): FicheEnSommeil {
  return {
    profile: {
      id,
      name: nom,
      nomAffiche: nom,
      titreProfil: null,
      image: null,
      bio: null,
      linkedin: null,
      contactEmailOk: false,
      isWoman: false,
      secteurs: [],
      sujets: [],
      status: "brouillon",
      updatedAt: "2026-06-02T10:00:00Z",
      ...over,
    } as unknown as FicheEnSommeil["profile"],
    email: `${id}@test.fr`,
    talksCount,
    lastReminderAt: null,
  };
}

const params = (q: Record<string, string> = {}) => Promise.resolve(q);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProfilesEnSommeil).mockResolvedValue([]);
});
afterEach(cleanup);

describe("/admin/speakeuses/relances", () => {
  it("passe par la garde orga", async () => {
    render(await RelancesPage({ searchParams: params() }));
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("liste chaque fiche, ce qu'il lui reste et depuis quand elle dort", async () => {
    vi.mocked(getProfilesEnSommeil).mockResolvedValue([
      fiche(7, "Ada Lovelace"),
      fiche(8, "Grace Hopper", { titreProfil: "Ingénieure", isWoman: true, linkedin: "https://li" }, 1),
    ]);
    render(await RelancesPage({ searchParams: params() }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // Le lien mène à la FICHE : c'est là qu'on lit, publie, ou relance seule.
    expect(screen.getByRole("link", { name: /Ada Lovelace/ })).toHaveAttribute(
      "href",
      "/speakeuses/7",
    );
    expect(screen.getByText(/il reste 4 étapes/i)).toBeInTheDocument();
    // Fiche complète : le seul geste restant est la soumission, et c'est dit.
    expect(screen.getByText(/fiche complète/i)).toBeInTheDocument();
  });

  it("porte UN seul CTA, chiffré", async () => {
    vi.mocked(getProfilesEnSommeil).mockResolvedValue([fiche(7, "Ada"), fiche(8, "Grace")]);
    render(await RelancesPage({ searchParams: params() }));
    expect(
      screen.getByRole("button", { name: /relancer 2 speakeuses/i }),
    ).toBeInTheDocument();
  });

  it("cache le CTA quand rien ne dort, et le dit", async () => {
    render(await RelancesPage({ searchParams: params() }));
    expect(screen.queryByRole("button", { name: /relancer/i })).toBeNull();
    expect(screen.getByText(/rien à relancer/i)).toBeInTheDocument();
  });

  it("annonce l'envoi réussi", async () => {
    render(await RelancesPage({ searchParams: params({ envoyees: "3" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("3 relances envoyées");
  });

  it("alerte sur un lot à moitié parti, avec sa raison", async () => {
    render(
      await RelancesPage({
        searchParams: params({ envoyees: "1", echecs: "2", err: "Brevo 401" }),
      }),
    );
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("2 relances");
    expect(alerte).toHaveTextContent("Brevo 401");
  });

  it("alerte quand l'envoi d'e-mails est coupé", async () => {
    render(await RelancesPage({ searchParams: params({ envoi: "indisponible" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/indisponible/i);
  });
});
