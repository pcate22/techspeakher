import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Récompense : hub (sommaire) + sous-pages mono-fonction. Le sujet (l'intitulé)
 * est le titre, « Récompense » (ou la fonction) le surtitre embarqué dans le h1
 * → on sait qu'on est sur une récompense, et laquelle.
 */
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-admin", () => ({ loadRecompenseOrNotFound: vi.fn() }));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationsByEdition: vi.fn(async () => []),
}));
vi.mock("@/app/admin/tremplins/actions", () => ({
  updateRecompenseAction: vi.fn(),
  setRecompenseBeneficiaireAction: vi.fn(),
  setRecompenseSuiviAction: vi.fn(),
  deleteRecompenseAction: vi.fn(),
}));

import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import Hub from "@/app/admin/tremplins/[edition]/recompenses/[recompense]/page";
import Intitule from "@/app/admin/tremplins/[edition]/recompenses/[recompense]/intitule/page";
import Beneficiaire from "@/app/admin/tremplins/[edition]/recompenses/[recompense]/beneficiaire/page";
import Suivi from "@/app/admin/tremplins/[edition]/recompenses/[recompense]/suivi/page";
import Retrait from "@/app/admin/tremplins/[edition]/recompenses/[recompense]/retrait/page";

afterEach(cleanup);

const params = Promise.resolve({ edition: "3", recompense: "5" });
const rec = {
  id: 5,
  intitule: "Meetup",
  detail: "Salle communauté",
  rang: 2,
  statut: "a_organiser",
  beneficiaireNom: "Léa Dubois",
  beneficiaireRegistrationId: 9,
  transfertRaison: null,
  motif: null,
  evenementLe: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadRecompenseOrNotFound).mockResolvedValue({
    editionId: 3,
    edition: { id: 3, nom: "Tremplin 2026" },
    recompense: rec,
  } as never);
});

describe("récompense — hub + sous-pages", () => {
  it("hub : titre « Récompense : Meetup » + rangées vers les sous-pages", async () => {
    render(await Hub({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: /récompense.*meetup/i }),
    ).toBeInTheDocument();
    const base = "/admin/tremplins/3/recompenses/5";
    expect(screen.getByRole("link", { name: /intitulé et rang/i })).toHaveAttribute("href", `${base}/intitule`);
    expect(screen.getByRole("link", { name: /bénéficiaire/i })).toHaveAttribute("href", `${base}/beneficiaire`);
    expect(screen.getByRole("link", { name: /suivi de l'événement/i })).toHaveAttribute("href", `${base}/suivi`);
    expect(screen.getByRole("link", { name: /suppression/i })).toHaveAttribute("href", `${base}/retrait`);
  });

  it("intitulé : formulaire pré-rempli, retour au hub", async () => {
    render(await Intitule({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /intitulé et rang.*meetup/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/intitulé/i)).toHaveValue("Meetup");
    expect(screen.getByRole("link", { name: /retour à la récompense/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/recompenses/5",
    );
  });

  it("bénéficiaire : sélecteur d'attribution", async () => {
    render(await Beneficiaire({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /bénéficiaire.*meetup/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Bénéficiaire")).toBeInTheDocument();
  });

  it("suivi : sélecteur de statut", async () => {
    render(await Suivi({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /suivi.*meetup/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Statut")).toBeInTheDocument();
  });

  it("suppression : bouton destructif + confirmation", async () => {
    render(await Retrait({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /suppression.*meetup/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /supprimer cette récompense/i }),
    ).toBeInTheDocument();
  });
});
