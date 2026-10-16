import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * NavEspaceServeur — là où le POINT se calcule, et où les deux navigations
 * de l'espace (barre basse mobile, rail bureau) reçoivent leurs données.
 *
 * Elles sont rendues sur CHAQUE page de l'espace connecté : c'est ici que
 * `desTachesAttendent()` s'appelle (une fois, mémoïsé par requête avec le
 * chargement de la page « À faire »), et c'est ici que son échec se gère.
 *
 * Ce que ce banc garde, et que le banc du composant ne peut pas garder :
 *
 * 1. le signal EMPRUNTE la porte gardée (`desTachesAttendent`, jamais la
 *    porte du cron) — c'est le branchement, pas le moteur ;
 * 2. **un signal qui échoue n'emporte pas la barre** : l'onglet s'affiche
 *    sans point. Un onglet muet vaut mieux qu'une page en erreur — la barre
 *    est montée par les DEUX layouts, une exception ici casserait chaque
 *    écran de l'app (conception D3) ;
 * 3. **la feuille ➕ qui échoue n'emporte pas non plus la navigation** (dette
 *    du 2026-08-18, soldée le 2026-10-15) : sa lecture était la branche sans
 *    filet du même `Promise.all`, et elle lit davantage depuis qu'elle porte
 *    les talks de « Ajouter une date à un talk ».
 */

let cheminCourant = "/mon-espace";
vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));
vi.mock("@/lib/auth-guards", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/feuille-creer", () => ({
  getFeuilleDonnees: vi.fn(),
}));
vi.mock("@/lib/taches-chargement", () => ({ desTachesAttendent: vi.fn(async () => false) }));

import { getSession } from "@/lib/auth-guards";
import { desTachesAttendent } from "@/lib/taches-chargement";
import { getFeuilleDonnees } from "@/lib/feuille-creer";
import NavEspaceServeur from "@/components/NavEspaceServeur";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  cheminCourant = "/mon-espace";
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "1", name: "Léa Martin" },
  } as never);
  vi.mocked(desTachesAttendent).mockResolvedValue(false);
  vi.mocked(getFeuilleDonnees).mockResolvedValue({
    talks: [],
    creation: "talk",
    orga: false,
    editions: [],
  });
});

/** La barre basse (le rail porte le même nom de landmark, hors mobile). */
const barre = () => document.querySelector<HTMLElement>("[data-bottom-nav]")!;
const ongletAFaire = () => within(barre()).getByRole("link", { name: /À faire/ });

describe("NavEspaceServeur — le point se calcule ici, derrière la porte", () => {
  it("sans session : aucune barre, et le signal n'est jamais consulté", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { container } = render(await NavEspaceServeur());
    expect(container.innerHTML).toBe("");
    expect(vi.mocked(desTachesAttendent)).not.toHaveBeenCalled();
  });

  it("quelque chose attend : l'onglet le dit", async () => {
    vi.mocked(desTachesAttendent).mockResolvedValue(true);
    render(await NavEspaceServeur());
    expect(ongletAFaire()).toHaveAccessibleName("À faire, quelque chose attend");
  });

  it("rien : l'onglet redevient « À faire »", async () => {
    render(await NavEspaceServeur());
    expect(ongletAFaire()).toHaveAccessibleName("À faire");
  });

  it("le signal JETTE : la barre s'affiche quand même, onglet muet", async () => {
    // La base tombe, une colonne manque, un timeout : la barre est montée par
    // les deux layouts, elle n'a pas le droit d'emporter chaque écran avec
    // elle. Un onglet muet est honnête ; une app blanche ne l'est pas.
    vi.mocked(desTachesAttendent).mockRejectedValue(new Error("base injoignable"));
    render(await NavEspaceServeur());
    expect(ongletAFaire()).toHaveAccessibleName("À faire");
    expect(screen.getAllByRole("navigation", { name: "Mon espace" })).toHaveLength(2);
  });

  it("les DEUX navigations sont montées : la barre basse et le rail", async () => {
    render(await NavEspaceServeur());
    expect(screen.getAllByRole("navigation", { name: "Mon espace" })).toHaveLength(2);
    expect(barre()).toBeInTheDocument();
  });

  it("la feuille JETTE : les deux navigations s'affichent, sans geste de création", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getFeuilleDonnees).mockRejectedValue(new Error("base injoignable"));
    render(await NavEspaceServeur());
    expect(screen.getAllByRole("navigation", { name: "Mon espace" })).toHaveLength(2);
    // Repli neutre : aucun CTA qu'on ne saurait honorer.
    expect(screen.queryByRole("link", { name: "Ajouter un talk" })).toBeNull();
    // Le silence est tracé (même règle que le point).
    expect(trace).toHaveBeenCalled();
    trace.mockRestore();
  });

  it("la feuille JETTE pour une orga : le groupe Organisation reste (le rôle vient de la session)", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "2", name: "Camille", isOrga: true },
    } as never);
    vi.mocked(getFeuilleDonnees).mockRejectedValue(new Error("base injoignable"));
    render(await NavEspaceServeur());
    expect(screen.getByRole("group", { name: "Organisation" })).toBeInTheDocument();
    trace.mockRestore();
  });
});
