import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getCompte } from "@/lib/users";

/**
 * « Ma fiche publique » porte depuis le lot N2 (§4) les GESTES de fiche que
 * le hub tenait : la complétude (ce qu'il reste à faire), la soumission à
 * l'annuaire (et ses erreurs), le retrait. Le rendu de la fiche elle-même
 * (FicheSpeakeuseCorps) et l'assistant de création ont leurs propres tests.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfileByUserId: vi.fn(),
  canSubmitToDirectory: vi.fn(() => false),
  speakeuseHref: (p: { id: number; slug: string | null }) =>
    `/speakeuses/${p.slug ?? p.id}`,
}));
vi.mock("@/lib/talks", () => ({
  getTalksByProfileId: vi.fn(async () => []),
  getOccurrenceSuggestions: vi.fn(async () => ({ registre: [], villes: [], pays: [] })),
}));
// La section identité propose la reprise de photo LinkedIn seulement si
// LinkedIn est rattaché : la page lit donc les providers du compte.
vi.mock("@/lib/accounts", () => ({ getLinkedProviders: vi.fn(async () => []) }));
vi.mock("@/lib/users", async (importOriginal) => ({
  // Le VRAI critère : recopié ici, il ne suivrait pas un changement de règle.
  peutCreerFiche: (await importOriginal<typeof import("@/lib/users")>()).peutCreerFiche,
  getCompte: vi.fn(async () => ({ name: "Marie Curie", genre: null })),
}));
// La complétude est pure et testée ailleurs : ici on la PILOTE pour vérifier
// le câblage de l'écran (jauge, CTA, soumission).
vi.mock("@/lib/completude", () => ({ completude: vi.fn() }));
vi.mock("@/app/mon-espace/actions", () => ({
  submitProfileAction: vi.fn(),
  withdrawProfileAction: vi.fn(),
}));
// L'assistant de création (client, lourd) a ses tests : un marqueur suffit.
vi.mock("@/app/mon-espace/ProfileForm", () => ({
  default: () => <div data-testid="assistant-creation" />,
}));

import { auth } from "@/auth";
import { getProfileByUserId, canSubmitToDirectory } from "@/lib/profiles";
import { completude } from "@/lib/completude";
import { makeProfile } from "./test-helpers";
import MaFiche from "@/app/mon-espace/fiche/page";

afterEach(cleanup);

const rendu = async (params: { step?: string; ok?: string; error?: string } = {}) =>
  render(await MaFiche({ searchParams: Promise.resolve(params) }));

const COMPLETUDE_VIDE = {
  chantiers: [],
  percentRequis: 100,
  requisRestants: [],
  aFaire: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "Ada" } } as never);
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
  vi.mocked(completude).mockReturnValue(COMPLETUDE_VIDE as never);
  vi.mocked(canSubmitToDirectory).mockReturnValue(false);
});

describe("Ma fiche publique — la soumission vit ici (lot N2)", () => {
  it("brouillon incomplet : la jauge, ce qu'il reste, et l'étape suivante en CTA", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 5, status: "brouillon" }));
    vi.mocked(completude).mockReturnValue({
      chantiers: [],
      percentRequis: 40,
      requisRestants: [{ key: "contact", label: "Contact", href: "/mon-espace/fiche/contact" }],
      aFaire: [],
    } as never);
    await rendu();
    expect(screen.getByText(/fiche complétée/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ajouter un moyen de contact/i }),
    ).toHaveAttribute("href", "/mon-espace/fiche/contact");
  });

  it("brouillon complet : « Soumettre à l'annuaire », et la promesse d'annonce (consentement)", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      makeProfile({ id: 5, status: "brouillon", publishedAt: null }),
    );
    vi.mocked(canSubmitToDirectory).mockReturnValue(true);
    await rendu();
    expect(
      screen.getByRole("button", { name: /soumettre à l'annuaire/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/une fiche publiée est annoncée sur l'accueil du site/i),
    ).toBeInTheDocument();
  });

  it("le retour après retrait reste DISCRET : déjà publiée un jour, la promesse d'annonce se tait", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      makeProfile({ id: 5, status: "brouillon", publishedAt: "2026-01-01T00:00:00Z" }),
    );
    vi.mocked(canSubmitToDirectory).mockReturnValue(true);
    await rendu();
    expect(
      screen.queryByText(/une fiche publiée est annoncée/i),
    ).toBeNull();
  });

  it("erreur de soumission (?error=) : le motif s'affiche en alerte, ICI", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 5, status: "brouillon" }));
    await rendu({ error: "attestation" });
    expect(screen.getByRole("alert")).toHaveTextContent(/attestation/i);
  });

  it("publiée : Partager, le retrait possible, et AUCUN bouton de soumission", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      makeProfile({ id: 5, status: "publie", name: "Ada Lovelace" }),
    );
    await rendu();
    expect(screen.getByRole("button", { name: /partager ma fiche/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /soumettre à l'annuaire/i })).toBeNull();
    // RetirerFicheRow (composant réel) propose le retrait de l'annuaire.
    expect(
      screen.getByRole("button", { name: /retirer ma fiche de l'annuaire/i }),
    ).toBeInTheDocument();
  });

  it("en relecture : annuler sa soumission reste possible, la complétude se tait", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      makeProfile({ id: 5, status: "en_attente" }),
    );
    await rendu();
    expect(screen.queryByText(/fiche complétée/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /retirer ma soumission/i }),
    ).toBeInTheDocument();
  });

  it("sans fiche : l'assistant de création, six étapes guidées", async () => {
    await rendu();
    expect(screen.getByTestId("assistant-creation")).toBeInTheDocument();
  });

  // « Ma fiche » est partout depuis le 2026-10-15 (onglet, rail, menu du
  // compte) : un compte qui ne peut PAS créer de fiche (genre « homme »,
  // `peutCreerFiche`) n'arrive jamais sur un assistant qu'il n'a pas le droit
  // de remplir — jamais de CTA impossible (revue UX du 2026-10-15).
  it("sans fiche ET sans fiche possible : renvoyé vers « Mon profil », jamais l'assistant", async () => {
    vi.mocked(getCompte).mockResolvedValueOnce({ name: "Marc", genre: "homme" } as never);
    await expect(rendu()).rejects.toThrow("REDIRECT:/mon-espace/profil");
  });
});
