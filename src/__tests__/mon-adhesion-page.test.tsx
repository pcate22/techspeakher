import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * La page « Mon adhésion » (demande de Cateline, 2026-10-15) : consulter SON
 * adhésion. Un rôle, et un CTA seulement quand il sert (renouveler, adhérer).
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
vi.mock("@/lib/helloasso", () => ({ helloassoConfig: vi.fn() }));
vi.mock("@/lib/adhesions", () => ({ adhesionDuCompte: vi.fn() }));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn() }));
vi.mock("@/lib/annuaire-adhesion", () => ({ dateRetraitAnnuaire: vi.fn() }));

import { auth } from "@/auth";
import { helloassoConfig } from "@/lib/helloasso";
import { adhesionDuCompte } from "@/lib/adhesions";
import { getProfileByUserId } from "@/lib/profiles";
import { dateRetraitAnnuaire } from "@/lib/annuaire-adhesion";
import { makeProfile } from "./test-helpers";
import MonAdhesion from "@/app/mon-espace/adhesion/page";

const rendu = async () => render(await MonAdhesion());
const lien = (nom: RegExp) => screen.queryByRole("link", { name: nom });

const adhesion = (over: Partial<Awaited<ReturnType<typeof adhesionDuCompte>>> = {}) => ({
  startedAt: "2026-10-15T08:00:00.000Z",
  expiresAt: "2099-10-15T08:00:00.000Z",
  status: "active" as const,
  source: "helloasso" as const,
  ...over,
});

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({ user: { id: "1" } } as never);
  vi.mocked(helloassoConfig).mockReturnValue({} as never);
  vi.mocked(adhesionDuCompte).mockResolvedValue(adhesion());
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
  vi.mocked(dateRetraitAnnuaire).mockResolvedValue(null);
});
afterEach(cleanup);

describe("/mon-espace/adhesion", () => {
  it("hors session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("lit le compte de la SESSION, et seulement lui", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "42" } } as never);
    await rendu();
    expect(adhesionDuCompte).toHaveBeenCalledWith(42);
    expect(getProfileByUserId).toHaveBeenCalledWith(42);
    expect(dateRetraitAnnuaire).toHaveBeenCalledWith(42);
  });

  it("sans synchro HelloAsso : la page n'existe pas (elle dirait « aucune » à toutes)", async () => {
    vi.mocked(helloassoConfig).mockReturnValue(null);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("active : l'état, la date d'adhésion, l'échéance, le reçu — et aucun CTA", async () => {
    await rendu();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mon adhésion");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(document.body.textContent).toContain("15 octobre 2026");
    expect(document.body.textContent).toContain("15 octobre 2099");
    expect(document.body.textContent).toMatch(/reçu.*HelloAsso/i);
    expect(lien(/Renouveler|Adhérer/)).toBeNull();
  });

  it("à renouveler bientôt : LE CTA « Renouveler mon adhésion »", async () => {
    vi.mocked(adhesionDuCompte).mockResolvedValue(
      adhesion({ expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString() }),
    );
    await rendu();
    expect(screen.getByText("À renouveler")).toBeInTheDocument();
    expect(lien(/Renouveler mon adhésion/)!.getAttribute("href")).toBe("/adherer");
  });

  it("échue : le CTA, et la date passée", async () => {
    vi.mocked(adhesionDuCompte).mockResolvedValue(
      adhesion({ expiresAt: "2020-01-01T08:00:00.000Z", status: "expired" }),
    );
    await rendu();
    expect(screen.getByText("Échue")).toBeInTheDocument();
    expect(lien(/Renouveler mon adhésion/)).not.toBeNull();
  });

  it("aucune adhésion reliée : le délai validé, la consigne d'adresse, et « Adhérer »", async () => {
    vi.mocked(adhesionDuCompte).mockResolvedValue(null);
    await rendu();
    expect(document.body.textContent).toMatch(/Aucune adhésion reliée/);
    expect(document.body.textContent).toContain(
      "dans quelques minutes, et au plus tard le lendemain",
    );
    expect(document.body.textContent).toMatch(/adresse/);
    expect(lien(/Adhérer/)!.getAttribute("href")).toBe("/adherer");
  });

  it("fiche en pause : dit quand elle revient, avec le délai", async () => {
    vi.mocked(adhesionDuCompte).mockResolvedValue(null);
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ status: "en_pause" }));
    await rendu();
    expect(document.body.textContent).toMatch(
      /Après ton adhésion, elle y revient dans quelques minutes, et au plus tard le lendemain/,
    );
  });

  it("préavis en cours : la date de sortie de l'annuaire", async () => {
    vi.mocked(adhesionDuCompte).mockResolvedValue(
      adhesion({ expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString() }),
    );
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ status: "publie" }));
    vi.mocked(dateRetraitAnnuaire).mockResolvedValue("2099-11-14T12:00:00.000Z");
    await rendu();
    expect(document.body.textContent).toMatch(/quitte l'annuaire le 14 novembre 2099\. Pour qu'elle y reste, renouvelle ton adhésion/);
  });

  describe("chaque phrase seulement là où elle est vraie (revue UX du 2026-10-15)", () => {
    it("adhésion HelloAsso en cours : les douze mois s'ajoutent, et le reçu HelloAsso", async () => {
      await rendu();
      expect(document.body.textContent).toMatch(/s'ajoutent à l'échéance en cours/);
      expect(document.body.textContent).toMatch(/reçu.*HelloAsso/);
    });

    it("adhésion échue : une nouvelle adhésion repart du jour où on adhère", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(
        adhesion({ expiresAt: "2020-01-01T08:00:00.000Z", status: "expired" }),
      );
      await rendu();
      expect(document.body.textContent).not.toMatch(/s'ajoutent/);
      expect(document.body.textContent).toMatch(/à partir du jour où tu adhères/);
    });

    it("adhésion saisie par l'équipe : ni cumul promis, ni reçu HelloAsso", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(adhesion({ source: "manuel" }));
      await rendu();
      expect(document.body.textContent).not.toMatch(/s'ajoutent/);
      expect(document.body.textContent).not.toMatch(/reçu/);
      expect(document.body.textContent).toMatch(/enregistrée par l'équipe/);
    });

    it("arrêtée avant son terme : « Arrêtée », sans date future, et « Adhérer de nouveau »", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(
        adhesion({ expiresAt: "2099-09-01T08:00:00.000Z", status: "expired" }),
      );
      await rendu();
      expect(screen.getByText("Arrêtée")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("2099");
      expect(lien(/Adhérer de nouveau/)!.getAttribute("href")).toBe("/adherer");
    });

    it("préavis sans adhésion : « adhère », pas « renouvelle »", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(null);
      vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ status: "publie" }));
      vi.mocked(dateRetraitAnnuaire).mockResolvedValue("2099-11-14T12:00:00.000Z");
      await rendu();
      expect(document.body.textContent).toMatch(/Pour qu'elle y reste, adhère avant cette date/);
    });

    it("aucune adhésion : une sortie pour qui a adhéré avec une autre adresse", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(null);
      await rendu();
      expect(lien(/Écris-nous/)!.getAttribute("href")).toBe("/contact");
    });

    it("arrêtée et saisie par l'équipe : HelloAsso n'est pas nommé", async () => {
      vi.mocked(adhesionDuCompte).mockResolvedValue(
        adhesion({ expiresAt: "2099-09-01T08:00:00.000Z", status: "expired", source: "manuel" }),
      );
      await rendu();
      expect(document.body.textContent).not.toMatch(/HelloAsso/);
      expect(document.body.textContent).toMatch(/enregistrée par l'équipe/);
    });
  });
});
