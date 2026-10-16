import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * MES CONNEXIONS — un seul rôle : par quels moyens j'entre dans mon compte.
 *
 * La page en portait deux : elle changeait aussi la photo de profil, par un
 * bouton « Utiliser cette photo » par provider qui relançait une connexion
 * OAuth complète. La photo se choisit là où elle s'affiche (`ChampPhoto`) ;
 * ce test tient la frontière, et le peu qui reste ici.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/accounts", async (importOriginal) => {
  // `canUnlinkProvider` reste RÉEL : c'est le garde-fou anti-lockout, et c'est
  // lui qui décide de ce que la ligne affiche.
  const actual = await importOriginal<typeof import("@/lib/accounts")>();
  return { ...actual, getLinkedProviders: vi.fn() };
});
vi.mock("@/lib/users", () => ({ getUserById: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn() }));
vi.mock("@/auth.config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth.config")>();
  return { ...actual, isGoogleEnabled: vi.fn(), isLinkedInEnabled: vi.fn() };
});
vi.mock("@/app/mon-espace/connexions/actions", () => ({
  linkProviderAction: vi.fn(),
  unlinkProviderAction: vi.fn(),
}));

import { auth } from "@/auth";
import { getLinkedProviders } from "@/lib/accounts";
import { getUserById } from "@/lib/users";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled } from "@/auth.config";
import MesConnexions from "@/app/mon-espace/connexions/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "7", name: "Ada" } } as never);
  vi.mocked(getUserById).mockResolvedValue({ id: 7, name: "Ada", email: "ada@example.org" });
  vi.mocked(isMagicLinkEnabled).mockReturnValue(true);
  vi.mocked(isGoogleEnabled).mockReturnValue(true);
  vi.mocked(isLinkedInEnabled).mockReturnValue(true);
  vi.mocked(getLinkedProviders).mockResolvedValue(["google", "linkedin"]);
});

async function rendre(searchParams: { ok?: string; error?: string } = {}) {
  return render(await MesConnexions({ searchParams: Promise.resolve(searchParams) }));
}

describe("Mes connexions — un seul rôle", () => {
  it("ne propose AUCUN geste de photo : ni bouton, ni mention", async () => {
    await rendre();
    expect(screen.queryByRole("button", { name: /photo/i })).toBeNull();
    expect(screen.queryByText(/photo/i)).toBeNull();
  });

  it("une seule action par méthode rattachée", async () => {
    await rendre();
    for (const nom of ["Google", "LinkedIn"]) {
      const ligne = screen.getByText(nom).closest("li") as HTMLElement;
      expect(within(ligne).getAllByRole("button")).toHaveLength(1);
    }
  });

  it("chaque « Délier » NOMME sa méthode (deux boutons homonymes, sinon)", async () => {
    await rendre();
    expect(screen.getByRole("button", { name: "Délier Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Délier LinkedIn" })).toBeTruthy();
  });

  it("une méthode à rattacher se dit à la forme positive, et s'ajoute", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["linkedin"]);
    await rendre();
    const ligne = screen.getByText("Google").closest("li") as HTMLElement;
    expect(within(ligne).getByText("À rattacher")).toBeTruthy();
    expect(within(ligne).getByRole("button", { name: "Lier Google" })).toBeTruthy();
  });

  it("dernière méthode : le garde-fou se dit AVANT le clic, aucun bouton à cliquer", async () => {
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    await rendre();

    const ligne = screen.getByText("Google").closest("li") as HTMLElement;
    expect(within(ligne).queryByRole("button")).toBeNull();
    expect(within(ligne).getByText(/seule façon de te connecter/i)).toBeTruthy();
  });

  it("l'adresse du lien magique s'affiche en ENTIER (elle identifie le compte)", async () => {
    await rendre();
    expect(screen.getByText(/ada@example\.org/)).toBeTruthy();
  });

  it("l'échec de déliaison dit quoi faire, à la forme positive", async () => {
    await rendre({ error: "derniere" });
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toMatch(/Garde au moins une façon de te connecter/);
    expect(alerte.textContent).not.toMatch(/\bne\b|\bplus\b/);
  });

  it("aucune violation axe", async () => {
    const { container } = await rendre();
    expect(await axe(container)).toHaveNoViolations();
  });
});
