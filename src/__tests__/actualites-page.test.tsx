import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Liste unique `/actualites` pilotée par capacités : le public ne voit que le
 * publié, sans commandes ; l'orga voit en plus l'ajout, les brouillons (marqués)
 * et le « Modifier ». (Rework « une seule liste ».)
 */
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/contenus", () => ({ listPublications: vi.fn(), listContenus: vi.fn() }));
vi.mock("@/app/admin/contenus/actions", () => ({ seedContenusAction: vi.fn() }));

import { auth } from "@/auth";
import { listPublications, listContenus, type Contenu } from "@/lib/contenus";
import Actualites from "@/app/actualites/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function pub(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1, type: "publication", slug: "un-article", titre: "Un article",
    chapo: "Accroche.", corps: "## Corps", imageUrl: null, imageAlt: null, imageWidth: null, imageHeight: null, videoUrl: null,
    categorie: "Communauté", tag: "Passé", lien: null, lienExterne: null, lienLabel: null,
    statut: "publie", publieLe: "2026-06-01", majLe: "2026-06-01T00:00:00Z", auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}
const render$ = async (sp: Record<string, string> = {}) =>
  render(await Actualites({ searchParams: Promise.resolve(sp) }));

describe("/actualites — visiteur", () => {
  it("montre les publications publiées, sans commande d'orga", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([pub()]);
    await render$();
    expect(screen.getByRole("heading", { level: 2, name: "Un article" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nouvel article/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Brouillon" })).toBeNull();
    // Public : on lit les publiés, jamais tous les statuts.
    expect(listPublications).toHaveBeenCalled();
    expect(listContenus).not.toHaveBeenCalled();
  });

  it("affiche la chip du type de contenu sur la carte", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([
      pub({ titre: "Interview de Rachel Dubois", categorie: "Behind the Scenes" }),
    ]);
    await render$();
    // Sur la CARTE (le filtre du même nom est un onglet, pas une chip de carte).
    const liste = screen.getByRole("region", { name: "Liste des actualités" });
    const carte = within(liste).getByRole("listitem");
    expect(within(carte).getByText("Behind the Scenes")).toBeInTheDocument();
  });

  it("ne rejoue PAS l'interview en citation vedette (elle a son article)", async () => {
    // L'interview est une actualité comme les autres : sa carte mène à sa page
    // d'article. Un encart « Behind the Scenes » codé en dur afficherait le même
    // contenu deux fois sur la même page.
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([]);
    const { container } = await render$();
    expect(screen.queryByRole("heading", { name: /behind the scenes/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /interview complète sur LinkedIn/i })).toBeNull();
    expect(container.querySelector("blockquote")).toBeNull();
  });

  it("résiste à une base indisponible (liste vide, page rendue)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockRejectedValue(new Error("db down"));
    await render$();
    // La page se rend malgré l'erreur : titre présent, aucune carte.
    expect(screen.getByRole("heading", { level: 1, name: /Actualités/ })).toBeInTheDocument();
    expect(screen.getByText(/arrivent bientôt/)).toBeInTheDocument();
  });
});

describe("/actualites — orga", () => {
  it("montre l'ajout, les brouillons marqués et le lien Modifier", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
    vi.mocked(listContenus).mockResolvedValue([
      pub({ slug: "publie-1", titre: "Publié 1", statut: "publie" }),
      pub({ slug: "brouillon-1", titre: "Brouillon 1", statut: "brouillon" }),
    ]);
    await render$();
    expect(screen.getByRole("link", { name: /Nouvel article/ })).toBeInTheDocument();
    // Brouillon marqué + éditable
    expect(screen.getAllByText("Brouillon").length).toBeGreaterThan(0);
    const modifier = screen.getAllByRole("link", { name: /^Modifier/ });
    expect(modifier[0]).toHaveAttribute("href", "/admin/contenus/publication/publie-1");
    // Orga : tous statuts.
    expect(listContenus).toHaveBeenCalledWith("publication");
  });

  it("badge « En relecture » sur l'article d'une membre soumis (lot N3)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
    vi.mocked(listContenus).mockResolvedValue([
      pub({ slug: "astuce", titre: "Astuce trac", statut: "en_relecture" }),
    ]);
    await render$();
    // L'état se dit EN MOTS sur la carte (sans quoi il passe pour publié),
    // et le filtre de statut le connaît — d'où DEUX « En relecture » : le
    // badge de la carte et le bouton de filtre.
    const badge = screen
      .getAllByText("En relecture")
      .find((el) => el.tagName === "SPAN");
    expect(badge).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "En relecture" }),
    ).toBeInTheDocument();
  });

  it("propose d'importer l'historique quand la liste est vide", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
    vi.mocked(listContenus).mockResolvedValue([]);
    await render$();
    expect(screen.getByRole("button", { name: /Importer les anciennes actualités/ })).toBeInTheDocument();
  });
});

/**
 * Écarts relevés en revue RGAA de la page (2026-08-01) : intitulés de liens
 * dupliqués, faux onglets, date non lisible par la machine, filtrage muet.
 */
describe("/actualites — RGAA", () => {
  const deux = () => [
    pub({ slug: "tremplin", titre: "Soirée Tremplin", categorie: "Tremplin" }),
    pub({ slug: "rachel", titre: "Interview de Rachel", categorie: "Interview" }),
  ];

  it("nomme chaque lien de carte par son actualité (6.1 / WCAG 2.4.4)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue(deux());
    await render$();
    // Deux destinations, deux noms accessibles distincts — et le libellé visible
    // ouvre le nom accessible (WCAG 2.5.3).
    // NB : `dom-accessibility-api` trime chaque nœud de texte avant de les
    // concaténer, donc l'espace entre le libellé et son complément disparaît du
    // nom calculé sous jsdom (les moteurs le gardent). D'où le `.*` sans espace,
    // et l'espace du DOM vérifié à part juste en dessous.
    expect(
      screen.getByRole("link", { name: /^Lire la suite.*Soirée Tremplin/ }),
    ).toHaveAttribute("href", "/articles/tremplin");
    expect(
      screen.getByRole("link", { name: /^Lire la suite.*Interview de Rachel/ }),
    ).toHaveAttribute("href", "/articles/rachel");
    expect(screen.queryAllByRole("link", { name: /^Lire la suite$/ })).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: /^Lire la suite.*Soirée Tremplin/ }),
    ).toHaveTextContent("Lire la suite de « Soirée Tremplin »");
  });

  it("nomme aussi les liens externes et « En savoir plus » par leur actualité", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([
      pub({ slug: "ext", titre: "Interview LinkedIn", corps: "", lienExterne: "https://exemple.fr/a", lienLabel: "Voir" }),
      pub({ slug: "int", titre: "Soirée Tremplin", corps: "", lien: "/tremplin" }),
    ]);
    await render$();
    expect(screen.getByRole("link", { name: /^Voir.*Interview LinkedIn/ })).toHaveAttribute(
      "href",
      "https://exemple.fr/a",
    );
    expect(screen.getByRole("link", { name: /^En savoir plus.*Soirée Tremplin/ })).toHaveAttribute(
      "href",
      "/tremplin",
    );
    // L'avertissement « nouvel onglet » d'`ExternalLink` survit au complément.
    expect(screen.getByRole("link", { name: /^Voir.*Interview LinkedIn/ })).toHaveTextContent(
      /nouvel onglet/,
    );
  });

  it("nomme le « Modifier » de chaque carte par son actualité", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
    vi.mocked(listContenus).mockResolvedValue(deux());
    await render$();
    expect(screen.getByRole("link", { name: /^Modifier.*Soirée Tremplin/ })).toHaveAttribute(
      "href",
      "/admin/contenus/publication/tremplin",
    );
    expect(screen.queryAllByRole("link", { name: /^Modifier$/ })).toHaveLength(0);
  });

  it("expose la date en <time datetime> (8.2, code valide)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([pub({ publieLe: "2026-06-04" })]);
    const { container } = await render$();
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-06-04");
    expect(time).toHaveTextContent("4 juin 2026");
  });

  it("laisse tomber le <time> quand l'actualité n'a pas de date", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([pub({ publieLe: null })]);
    const { container } = await render$();
    expect(container.querySelector("time")).toBeNull();
  });

  it("filtre avec des boutons à deux états, pas de faux onglets (7.1 / 7.3)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
    vi.mocked(listContenus).mockResolvedValue(deux());
    await render$();
    // `role="tab"` promet une navigation aux flèches et un tabpanel qu'on n'a pas.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.getByRole("group", { name: "Filtrer par catégorie" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filtrer par statut" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tremplin" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Publié" })).toHaveAttribute("aria-pressed", "false");
  });

  it("annonce le résultat du filtrage dans une région de statut", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue(deux());
    await render$();
    expect(screen.getByRole("status")).toHaveTextContent("2 actualités");
  });

  it("nomme le filtre actif, sinon un filtre à compte égal ne s'annonce pas", async () => {
    // `deux()` donne une actualité par catégorie : « Tout » → « Tremplin » garde
    // le même compte. Sans le nom du filtre, le texte de la région est identique,
    // le DOM ne change pas, et le lecteur d'écran n'annonce rien.
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue(deux());
    const u = userEvent.setup();
    await render$();
    const statut = screen.getByRole("status");
    expect(statut).toHaveTextContent("2 actualités");
    await u.click(screen.getByRole("button", { name: "Tremplin" }));
    expect(statut).toHaveTextContent("1 actualité en Tremplin");
  });

  it("distingue « rien à afficher » de « aucun résultat pour ce filtre »", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue(deux());
    const u = userEvent.setup();
    await render$();
    // Le site a du contenu : filtrer à vide ne doit pas dire qu'il est vide.
    await u.click(screen.getByRole("button", { name: "Communauté" }));
    expect(screen.getByText(/Aucune actualité dans cette vue/)).toBeInTheDocument();
    expect(screen.queryByText(/arrivent bientôt/)).toBeNull();
    // Et le compte à zéro s'annonce quand même.
    expect(screen.getByRole("status")).toHaveTextContent("0 actualité");
  });

  it("annonce aussi le vide (la région existe dès le premier rendu)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([]);
    await render$();
    // Là, le site est réellement vide.
    expect(screen.getByText(/arrivent bientôt/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 actualité");
  });

  it("dit ce qu'est la catégorie affichée, hors du texte mis en capitales", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(listPublications).mockResolvedValue([pub({ categorie: "Tremplin" })]);
    await render$();
    // `text-transform: uppercase` fait épeler certains lecteurs d'écran : le
    // complément `sr-only` doit vivre en dehors de la classe `uppercase`.
    const complement = screen.getByText(/Catégorie/);
    expect(complement).toBeInTheDocument();
    expect(complement.closest(".uppercase")).toBeNull();
  });
});
