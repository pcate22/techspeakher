import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Les actualités de la home viennent de la BASE, comme `/actualites` : même
 * source, même destination de carte (« article = actualité »). Avant, la home
 * affichait `src/data/actualites.ts` — un contenu figé qui divergeait de la
 * liste dès qu'une orga publiait via l'éditeur.
 *
 * Corollaire : plus d'encart « Behind the Scenes » codé en dur sur la home.
 * L'interview vit dans les actualités (sa page d'article), une seule fois.
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
vi.mock("@/lib/contenus", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPublicationsRecentes: vi.fn(),
}));

import { listPublicationsRecentes, type Contenu } from "@/lib/contenus";
import Home from "@/app/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function pub(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1,
    type: "publication",
    slug: "une-actu",
    titre: "Une actu",
    chapo: "Accroche.",
    corps: "",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    videoUrl: null,
    categorie: "Communauté",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    statut: "publie",
    publieLe: "2026-06-01",
    majLe: "2026-06-01T00:00:00Z",
    auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}

const bloc = () => screen.getByRole("region", { name: /actualités/i });

describe("Home — actualités dynamiques", () => {
  it("montre les publications de la base, récentes d'abord", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([
      pub({ id: 1, slug: "devfest-2026", titre: "DevFest Toulouse 2026", lien: "/devfest-toulouse" }),
      pub({ id: 2, slug: "soiree-tremplin", titre: "Soirée Tremplin" }),
    ]);
    render(await Home());
    expect(within(bloc()).getByRole("heading", { level: 3, name: "DevFest Toulouse 2026" })).toBeInTheDocument();
    expect(within(bloc()).getByRole("heading", { level: 3, name: "Soirée Tremplin" })).toBeInTheDocument();
    expect(within(bloc()).getByRole("link", { name: /voir toutes les actualités/i })).toHaveAttribute(
      "href",
      "/actualites",
    );
  });

  it("ne demande que 4 actualités à la base (la borne part en SQL)", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue(
      [1, 2, 3, 4].map((i) => pub({ id: i, slug: `actu-${i}`, titre: `Actu ${i}` })),
    );
    render(await Home());
    expect(listPublicationsRecentes).toHaveBeenCalledWith(4);
    expect(within(bloc()).getAllByRole("listitem")).toHaveLength(4);
  });

  it("une interview avec un corps mène à sa page d'actualité, pas à LinkedIn", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([
      pub({
        slug: "interview-de-rachel-dubois",
        titre: "Interview de Rachel Dubois",
        categorie: "Behind the Scenes",
        corps: "## Une question ?",
        lienExterne: "https://www.linkedin.com/pulse/behind-scenes",
        lienLabel: "Lire sur LinkedIn",
      }),
    ]);
    render(await Home());
    const lien = within(bloc()).getByRole("link", { name: /lire la suite/i });
    expect(lien).toHaveAttribute("href", "/articles/interview-de-rachel-dubois");
    expect(lien).not.toHaveAttribute("target");
    // Intitulé accessible explicite : plusieurs cartes affichent « Lire la
    // suite », le titre les distingue au lecteur d'écran. Le complément est
    // `sr-only` et non un `aria-label`, pour que le libellé VISIBLE ouvre le
    // nom accessible (WCAG 2.5.3, revue RGAA de /actualites).
    expect(
      within(bloc()).getByRole("link", { name: /^Lire la suite.*Interview de Rachel Dubois/ }),
    ).toBe(lien);
    expect(lien).toHaveTextContent("Lire la suite de « Interview de Rachel Dubois »");
  });

  it("une annonce-lien externe s'ouvre dans un nouvel onglet, en sécurité", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([
      pub({
        slug: "meetup-docker",
        titre: "Meetup Docker",
        lienExterne: "https://www.meetup.com/gdg-toulouse/events/1",
        lienLabel: "Voir sur Meetup",
      }),
    ]);
    render(await Home());
    const lien = within(bloc()).getByRole("link", { name: /voir sur meetup/i });
    expect(lien).toHaveAttribute("href", "https://www.meetup.com/gdg-toulouse/events/1");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("affiche la chip du type de contenu", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([
      pub({ titre: "Interview de Rachel Dubois", categorie: "Behind the Scenes", corps: "## Q" }),
    ]);
    render(await Home());
    expect(within(bloc()).getByText("Behind the Scenes")).toBeInTheDocument();
  });

  it("aucune publication : pas de cadre vide sur la home", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([]);
    render(await Home());
    expect(screen.queryByRole("region", { name: /actualités/i })).toBeNull();
  });

  it("base indisponible : la home s'affiche quand même, sans le bloc", async () => {
    vi.mocked(listPublicationsRecentes).mockRejectedValue(new Error("db down"));
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /actualités/i })).toBeNull();
  });
});

describe("Home — plus d'encart Behind the Scenes codé en dur", () => {
  it("aucune citation vedette : l'interview vit dans les actualités", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([]);
    render(await Home());
    expect(screen.queryByText(/BEHIND THE SCENES/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /lire l'interview complète/i })).toBeNull();
  });
});
