import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Page publique d'un article `/articles/[slug]` : rendu (titre + corps Markdown
 * assaini), garde 404 (brouillon/page/annonce-sans-corps → notFound) et
 * métadonnées SEO. (La LISTE vit désormais sur `/actualites` — liste unique.)
 */
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/contenus", () => ({ getContenuPublieBySlug: vi.fn() }));

import { getContenuPublieBySlug, type Contenu } from "@/lib/contenus";
import ArticlePage, { generateMetadata } from "@/app/articles/[slug]/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function contenu(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1,
    type: "publication",
    slug: "mon-article",
    titre: "Mon article",
    chapo: "Une accroche.",
    corps: "## Section\n\nDu texte.",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    categorie: "Communauté",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    videoUrl: null,
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

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("/articles/[slug] — détail", () => {
  it("rend le titre et le corps Markdown (assaini)", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu());
    const { container } = render(await ArticlePage(params("mon-article")));
    expect(screen.getByRole("heading", { level: 1, name: "Mon article" })).toBeInTheDocument();
    expect(container.querySelector("h2")?.textContent).toBe("Section");
    // JSON-LD présent
    expect(container.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });

  it("affiche la chip du type de contenu", async () => {
    // Même repère que sur la carte d'où l'on vient (home ou /actualites).
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ categorie: "Behind the Scenes" }),
    );
    render(await ArticlePage(params("mon-article")));
    expect(screen.getByText("Behind the Scenes")).toBeInTheDocument();
  });

  it("propose la vidéo en haut de l'article quand il y en a une", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ videoUrl: "https://youtu.be/Ac6rI2Bg-jE" }),
    );
    const { container } = render(await ArticlePage(params("mon-article")));
    const lien = screen.getByRole("link", { name: /regarder/i });
    expect(lien).toHaveAttribute("href", "https://youtu.be/Ac6rI2Bg-jE");
    expect(lien).toHaveAttribute("target", "_blank");
    // La miniature vient de YouTube, mais elle est servie par l'optimiseur
    // d'images du site (same-origin) : la CSP reste à `img-src 'self'`.
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("i.ytimg.com/vi/Ac6rI2Bg-jE"));
    // Décorative : le lien porte déjà l'intitulé « Regarder … sur YouTube ».
    expect(img).toHaveAttribute("alt", "");
    // Intitulé dans le nom (WCAG 2.5.3) : le nom accessible contient le texte
    // visible du lien, sinon la commande vocale échoue à le cliquer.
    const visible = screen.getByText("Regarder sur YouTube").textContent ?? "";
    expect(lien.getAttribute("aria-label")?.toLowerCase()).toContain(visible.toLowerCase());
  });

  it("laisse l'article sans bloc vidéo quand il n'y en a pas", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu());
    render(await ArticlePage(params("mon-article")));
    expect(screen.queryByRole("link", { name: /regarder/i })).toBeNull();
  });

  it("affiche la photo en haut de l'article quand il y en a une", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ imageUrl: "https://x.example/photo.png", imageAlt: "Le jury du Tremplin" }),
    );
    const { container } = render(await ArticlePage(params("mon-article")));
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://x.example/photo.png");
    expect(img).toHaveAttribute("alt", "Le jury du Tremplin");
  });

  it("réserve la place de la photo quand sa taille est connue (le titre ne saute plus)", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({
        imageUrl: "https://x.example/photo.png",
        imageAlt: "Rachel Dubois",
        imageWidth: 1080,
        imageHeight: 1350,
      }),
    );
    const { container } = render(await ArticlePage(params("mon-article")));
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("width", "1080");
    expect(img).toHaveAttribute("height", "1350");
    // Les attributs ne suffisent PAS : ils ne sont qu'un indice de présentation,
    // qu'une règle `width:auto` écraserait — plus aucun axe défini, donc plus
    // de place tenue avant le chargement. La hauteur seule est libre.
    expect(img.className).toContain("h-auto");
    expect(img.className).not.toContain("w-auto");
    expect(img.className).toContain("max-w-full");
  });

  it("s'affiche quand même si la taille est inconnue (image d'avant la mesure)", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ imageUrl: "https://x.example/photo.png", imageAlt: "Rachel Dubois" }),
    );
    const { container } = render(await ArticlePage(params("mon-article")));
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://x.example/photo.png");
    expect(img).not.toHaveAttribute("width");
    expect(img).not.toHaveAttribute("height");
  });

  it("montre la photo ENTIÈRE (nos visuels sont des cartes, un recadrage les décapite)", async () => {
    // Retour de Cateline : la carte « Behind the Scenes » perdait son titre en
    // haut et le nom de la speakeuse en bas. La hauteur suit l'image.
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ imageUrl: "https://x.example/photo.png", imageAlt: "Rachel Dubois" }),
    );
    const { container } = render(await ArticlePage(params("mon-article")));
    const img = container.querySelector("img")!;
    expect(img.className).toContain("h-auto");
    expect(img.className).not.toContain("object-cover");
  });

  it("laisse l'article sans photo quand il n'y en a pas", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu());
    const { container } = render(await ArticlePage(params("mon-article")));
    expect(container.querySelector("img")).toBeNull();
  });

  it("404 si le slug est inconnu", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(null);
    await expect(ArticlePage(params("absent"))).rejects.toThrow("NOT_FOUND");
  });

  it("404 pour une page (pas un article)", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu({ type: "page" }));
    await expect(ArticlePage(params("a-propos"))).rejects.toThrow("NOT_FOUND");
  });

  it("404 pour une publication sans corps (annonce-lien)", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu({ corps: "   " }));
    await expect(ArticlePage(params("annonce"))).rejects.toThrow("NOT_FOUND");
  });

  it("garde le lien externe visible même quand l'article a un corps", async () => {
    // Non-régression : ajouter un corps ne doit plus faire disparaître le lien
    // externe (ex. « Lire sur LinkedIn »). Il vit en bas de l'article.
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({
        lienExterne: "https://www.linkedin.com/pulse/interview-rachel",
        lienLabel: "Lire sur LinkedIn",
      }),
    );
    render(await ArticlePage(params("mon-article")));
    const lien = screen.getByRole("link", { name: /Lire sur LinkedIn/ });
    expect(lien).toHaveAttribute("href", "https://www.linkedin.com/pulse/interview-rachel");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Rendu comme un CTA (bouton secondary), pas un simple lien texte.
    expect(lien.className).toContain("border-cyan");
  });

  it("montre le lien interne en bas d'article avec son libellé", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(
      contenu({ lien: "/tremplin", lienLabel: "Découvrir le Tremplin" }),
    );
    render(await ArticlePage(params("mon-article")));
    const lien = screen.getByRole("link", { name: /Découvrir le Tremplin/ });
    expect(lien).toHaveAttribute("href", "/tremplin");
    expect(lien).not.toHaveAttribute("target");
  });

  it("n'affiche aucun CTA de fin quand ni lien externe ni interne", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu());
    render(await ArticlePage(params("mon-article")));
    // Le libellé par défaut du CTA de fin n'apparaît nulle part.
    expect(screen.queryByRole("link", { name: "En savoir plus" })).toBeNull();
  });
});

describe("/articles/[slug] — SEO", () => {
  it("article publié : indexable, canonical propre", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(contenu());
    const meta = await generateMetadata(params("mon-article"));
    expect(meta.alternates?.canonical).toBe("/articles/mon-article");
    expect(meta.robots).toMatchObject({ index: true });
    expect(meta.openGraph?.title).toContain("Mon article");
  });

  it("slug inconnu : non indexable", async () => {
    vi.mocked(getContenuPublieBySlug).mockResolvedValue(null);
    const meta = await generateMetadata(params("absent"));
    expect(meta.robots).toMatchObject({ index: false });
  });
});
