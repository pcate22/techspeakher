import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { Edition } from "@/lib/tremplin-editions";

/**
 * La vitrine `/tremplin` DÉRIVE son édition mise en avant de la base (dette
 * P1 « détonation à l'ouverture de la prochaine édition ») : « Voir l'édition
 * 2026 » et le teaser étaient écrits en dur — le jour où une édition 2027
 * passait en `ouvert`, la vitrine continuait d'envoyer tout le monde en 2026.
 *
 * Ce qui se juge ici :
 * - le CTA héros et le teaser suivent l'édition publique LA PLUS RÉCENTE ;
 * - la phrase-preuve (« 8 finalistes, 3 gagnantes… ») et le lien vers les
 *   finalistes restent réservés à l'édition ÉDITORIALE (ce sont des faits
 *   2026) ;
 * - base injoignable → repli complet sur l'édition éditoriale : la vitrine
 *   se dégrade vers ce qu'elle a toujours montré, jamais vers une erreur.
 */

const listEditionsPubliques = vi.fn();
vi.mock("@/lib/tremplin-editions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-editions")>();
  return {
    ...actual,
    listEditionsPubliques: (...a: unknown[]) => listEditionsPubliques(...a),
  };
});

import TremplinConcept from "@/app/tremplin/page";

afterEach(cleanup);
beforeEach(() => listEditionsPubliques.mockReset());

/** Une édition publique minimale, du point de vue de la vitrine. */
const edition = (o: Partial<Edition> & { annee: number }): Edition =>
  ({
    id: o.annee,
    nom: `Tremplin ${o.annee}`,
    statut: "ouvert",
    confSlug: "devfest-toulouse",
    confNom: "DevFest Toulouse",
    confLieu: null,
    confDate: null,
    confLien: null,
    finaleDate: null,
    finaleLieu: null,
    description: null,
    createdAt: "",
    deletedAt: null,
    conferenceEditionId: null,
    inscriptionsDebut: null,
    inscriptionsFin: null,
    ...o,
  }) as Edition;

const rendu = async () => render(await TremplinConcept());

describe("/tremplin — l'édition mise en avant vient de la base", () => {
  it("une édition 2027 ouverte prend la vitrine : CTA, teaser et ordinal suivent", async () => {
    listEditionsPubliques.mockResolvedValue([
      edition({ annee: 2027, confSlug: "sunny-tech", confNom: "Sunny Tech", statut: "ouvert" }),
      edition({ annee: 2026, statut: "archive" }),
    ]);
    await rendu();

    const cta = screen.getByRole("link", { name: /voir l'édition 2027/i });
    expect(cta).toHaveAttribute("href", "/tremplin/sunny-tech/2027");
    // Le teaser nomme la conférence de l'édition, pas celle d'il y a deux ans.
    expect(screen.getByRole("heading", { name: /tremplin.*sunny tech 2027/i })).toBeInTheDocument();
    // Deux éditions publiques : la mise en avant est la 2ᵉ.
    expect(screen.getByText(/2ᵉ édition/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /l'édition 2027 en détail/i })).toHaveAttribute(
      "href",
      "/tremplin/sunny-tech/2027",
    );
    // Les faits 2026 restent chez 2026 : aucune phrase-preuve, aucun lien finalistes.
    expect(screen.queryByText(/8 finalistes/)).toBeNull();
    expect(screen.queryByRole("link", { name: /finalistes/i })).toBeNull();
    // À la place : une ligne DÉRIVÉE donne une raison d'y aller (édition
    // « ouvert » sans fenêtre datée → « Inscriptions ouvertes »).
    expect(screen.getByText(/inscriptions ouvertes/i)).toBeInTheDocument();
  });

  it("sans nom de conférence, le teaser dit « Tremplin 2027 » sans « × » orphelin", async () => {
    // Même convention que la page cible : quand le nom manque, le segment
    // disparaît — trois écrans, un seul repli.
    listEditionsPubliques.mockResolvedValue([
      edition({ annee: 2027, confSlug: "mystere", confNom: null, statut: "ouvert" }),
    ]);
    await rendu();
    const teaser = screen.getByRole("heading", { name: /tremplin 2027/i });
    expect(teaser.textContent).not.toContain("×");
  });

  it("sur l'édition éditoriale (2026 seule), la vitrine garde sa preuve et ses finalistes", async () => {
    listEditionsPubliques.mockResolvedValue([edition({ annee: 2026, statut: "archive" })]);
    await rendu();

    expect(screen.getByRole("link", { name: /voir l'édition 2026/i })).toHaveAttribute(
      "href",
      "/tremplin/devfest-toulouse/2026",
    );
    expect(screen.getByText(/1ʳᵉ édition/)).toBeInTheDocument();
    expect(screen.getByText(/8 finalistes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /finalistes/i })).toHaveAttribute(
      "href",
      "/tremplin/devfest-toulouse/2026#participantes",
    );
  });

  it("base injoignable : la vitrine se replie sur l'édition éditoriale, entière", async () => {
    // Rejet créé À L'APPEL et UNE seule fois : le runner Vitest re-sonde le
    // mock après le test (une rejection de plus que personne n'attrape), et
    // `mockRejectedValue` fabriquerait la promesse rejetée avant même que la
    // page puisse l'attraper. Le seul appel de la page, lui, rejette bien.
    listEditionsPubliques
      .mockImplementationOnce(() => Promise.reject(new Error("Neon dort")))
      .mockResolvedValue([]);
    await rendu();

    expect(screen.getByRole("link", { name: /voir l'édition 2026/i })).toHaveAttribute(
      "href",
      "/tremplin/devfest-toulouse/2026",
    );
    expect(screen.getByText(/1ʳᵉ édition/)).toBeInTheDocument();
    expect(screen.getByText(/8 finalistes/)).toBeInTheDocument();
  });

  it("une édition en préparation n'existe pas pour la vitrine (le sélecteur les exclut déjà)", async () => {
    // La vitrine consomme listEditionsPubliques : ce cas garde le CONTRAT (la
    // page prend ce qu'on lui donne, le filtre vit dans le sélecteur — jugé
    // par son propre banc). Une liste vide = même repli que la base muette.
    listEditionsPubliques.mockResolvedValue([]);
    await rendu();
    expect(screen.getByRole("link", { name: /voir l'édition 2026/i })).toBeInTheDocument();
  });
});

describe("/tremplin — ce que la dérivation laisse intact", () => {
  it("le récit d'origine (2025) et le CTA conférence restent", async () => {
    listEditionsPubliques.mockResolvedValue([edition({ annee: 2026, statut: "archive" })]);
    await rendu();
    const bloc = screen.getByRole("region", { name: /pour qui, et pourquoi/i });
    expect(within(bloc).getByText(/2025/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /féminiser votre conférence/i })).toBeInTheDocument();
  });
});
