import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * Zone de danger du compte (palier 3). Ce qui est vérifié ici et nulle part
 * ailleurs : le refus du serveur SE VOIT. Sans ça, la modale se referme, la
 * page se recharge à l'identique et on croit le bouton cassé.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "7", name: "Session Périmée", email: "vieux@example.com" } })),
}));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn(async () => ({ id: 42 })) }));
vi.mock("@/lib/users", () => ({ getUserById: vi.fn() }));
vi.mock("@/app/mon-espace/actions", () => ({ deleteProfileAction: vi.fn() }));

import { getUserById } from "@/lib/users";
import ZoneDeDanger from "@/app/mon-espace/supprimer/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 7,
    name: "Camille Roux",
    email: "camille@example.com",
  } as never);
});

describe("Zone de danger — suppression du compte", () => {
  /**
   * Le message est posé APRÈS le montage, exprès : une région vive n'annonce
   * que ce qu'on y insère ensuite, donc un texte déjà présent dans le HTML
   * initial reste MUET au lecteur d'écran (`ConfirmationBanner`). D'où
   * l'attente ici — elle fait partie de la promesse, elle ne la contourne pas.
   */
  it("affiche le refus du serveur en alerte", async () => {
    render(await ZoneDeDanger({ searchParams: Promise.resolve({ err: "confirmation", n: "1" }) }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/réécris ton nom ou ton adresse e-mail/i),
    );
  });

  /**
   * L'autre refus, celui que la panne du sous-traitant provoque. Il dit ce qui
   * est vrai dans les deux causes possibles (le compte est encore là) et laisse
   * une porte de sortie : le droit à l'effacement ne peut pas dépendre de la
   * disponibilité d'un tiers.
   */
  it("un échec en cours de route se dit, et laisse une porte de sortie", async () => {
    render(await ZoneDeDanger({ searchParams: Promise.resolve({ err: "echec", n: "1" }) }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/ton compte est toujours là/i),
    );
    expect(screen.getByRole("link", { name: /écris-nous/i })).toHaveAttribute("href", "/contact");
  });

  /**
   * `?err=__proto__` atteignait la chaîne de prototypes de la table et rendait
   * un objet comme enfant React : 500 sur requête forgée. Même défaut, même
   * garde qu'à `mon-espace/fiche` (revue de sécurité N2).
   */
  it.each(["__proto__", "constructor", "toString"])(
    "un motif forgé (« %s ») ne rend AUCUNE alerte, et surtout aucune erreur",
    async (motif) => {
      render(await ZoneDeDanger({ searchParams: Promise.resolve({ err: motif }) }));
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("sans erreur, aucune alerte", async () => {
    render(await ZoneDeDanger({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Le serveur compare au contenu de la BASE : si la page proposait la valeur
  // de la session (périmée après un changement de nom), le client
  // déverrouillerait une saisie que le serveur refuserait.
  it("attend la valeur de la base, pas celle de la session", async () => {
    render(await ZoneDeDanger({ searchParams: Promise.resolve({}) }));
    expect(getUserById).toHaveBeenCalledWith(7);
    expect(screen.queryByText(/session périmée/i)).toBeNull();
  });
});
