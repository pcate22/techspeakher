import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * Les écrans d'articles d'une MEMBRE (lot N3, maquette validée) : la liste
 * « Mes articles » (statuts en mots, motif de renvoi), et la page d'UN
 * article — brouillon (éditeur + cession de droits EN TOUTES LETTRES au
 * moment de soumettre), en relecture (chez l'orga), publié (lien public).
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/articles-membres", () => ({
  listMesArticles: vi.fn(async () => []),
  getMonArticle: vi.fn(async () => null),
}));
vi.mock("@/app/mon-espace/articles/actions", () => ({
  creerArticleAction: vi.fn(),
  majArticleAction: vi.fn(),
  soumettreArticleAction: vi.fn(),
}));

import { auth } from "@/auth";
import { listMesArticles, getMonArticle } from "@/lib/articles-membres";
import type { ArticleMembre } from "@/lib/articles-membres";
import MesArticles from "@/app/mon-espace/articles/page";
import MonArticle from "@/app/mon-espace/articles/[id]/page";

afterEach(cleanup);

const unArticle = (o: Partial<ArticleMembre> = {}): ArticleMembre => ({
  id: 7,
  slug: "gerer-le-trac",
  titre: "Gérer le trac",
  chapo: null,
  corps: "Respirer.",
  categorie: "Conseils de speakeuse",
  statut: "brouillon",
  publieLe: null,
  relectureMotif: null,
  majLe: "2026-08-08T10:00:00Z",
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "Ada" } } as never);
  vi.mocked(listMesArticles).mockResolvedValue([]);
  vi.mocked(getMonArticle).mockResolvedValue(null);
});

describe("Mes articles — la liste et ses statuts", () => {
  it("hors session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      (async () => render(await MesArticles({ searchParams: Promise.resolve({}) })))(),
    ).rejects.toThrow("REDIRECT:/connexion");
  });

  it("les statuts se disent EN MOTS, le motif d'un renvoi est signalé", async () => {
    vi.mocked(listMesArticles).mockResolvedValue([
      unArticle({ id: 1, statut: "publie", publieLe: "2026-08-08" }),
      unArticle({ id: 2, titre: "Mon REX", statut: "en_relecture" }),
      unArticle({ id: 3, titre: "Astuce", relectureMotif: "Précise la fin." }),
    ]);
    render(await MesArticles({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/publié · 8 août 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/en relecture chez l’équipe organisatrice/i)).toBeInTheDocument();
    expect(screen.getByText(/renvoyé avec un motif : précise la fin\./i)).toBeInTheDocument();
  });

  it("liste vide : une invitation positive, et le geste d'écrire", async () => {
    const { container } = render(await MesArticles({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/ton premier article/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /écrire un article/i })).toHaveAttribute(
      "href",
      "/mon-espace/articles/nouveau",
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Mon article — un rôle à la fois, selon le statut", () => {
  const rendu = async (ok?: string) =>
    render(
      await MonArticle({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve(ok ? { ok } : {}),
      }),
    );

  it("l'article d'une autre : introuvable (borne SQL sur la session)", async () => {
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("brouillon : l'éditeur, et LA cession de droits en toutes lettres près du geste", async () => {
    vi.mocked(getMonArticle).mockResolvedValue(unArticle());
    const { container } = await rendu();
    expect(screen.getByLabelText(/titre/i)).toHaveValue("Gérer le trac");
    expect(
      screen.getByText(/tu autorises tech speak'her à publier ton article sous ton nom/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /soumettre à la relecture/i }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("brouillon renvoyé : le motif de l'orga s'affiche en alerte", async () => {
    vi.mocked(getMonArticle).mockResolvedValue(
      unArticle({ relectureMotif: "Précise la partie répétition." }),
    );
    await rendu();
    expect(screen.getByRole("alert")).toHaveTextContent(/précise la partie répétition/i);
  });

  it("en relecture : chez l'orga, rien à presser, AUCUN éditeur", async () => {
    vi.mocked(getMonArticle).mockResolvedValue(unArticle({ statut: "en_relecture" }));
    await rendu();
    expect(screen.getByText(/chez l['’]équipe organisatrice/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/titre/i)).toBeNull();
  });

  it("publié : le lien public, tel que tout le monde le lit", async () => {
    vi.mocked(getMonArticle).mockResolvedValue(
      unArticle({ statut: "publie", publieLe: "2026-08-08" }),
    );
    await rendu();
    expect(
      screen.getByRole("link", { name: /\/articles\/gerer-le-trac/i }),
    ).toHaveAttribute("href", "/articles/gerer-le-trac");
  });
});
