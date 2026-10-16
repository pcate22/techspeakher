import { describe, it, expect, vi, beforeEach } from "vitest";

// Redirige en levant une sentinelle, comme Auth.js/Next (stoppe l'exécution).
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => true) }));
vi.mock("@/lib/brevo-contacts", () => ({
  // Le bouton et le cron partagent LA MÊME synchro : le test de l'action tient
  // ses garde-fous (autorisation, liste manquante, échec), pas son contenu —
  // celui-ci est couvert par `brevo-contacts.test.ts`.
  synchroniserComptes: vi.fn(),
  listeComptes: vi.fn(() => 7),
}));

import { auth } from "@/auth";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { listeComptes, synchroniserComptes } from "@/lib/brevo-contacts";
import { synchroniserContactsAction } from "@/app/admin/diffusion/actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isMagicLinkEnabled).mockReturnValue(true);
  vi.mocked(listeComptes).mockReturnValue(7);
  vi.mocked(synchroniserComptes).mockResolvedValue({ contacts: 2 });
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);
});

describe("synchroniserContactsAction — garde-fous", () => {
  it("refuse une non-orga (aucune donnée ne sort)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);

    await expect(synchroniserContactsAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(synchroniserComptes).not.toHaveBeenCalled();
  });

  it("s'arrête si l'accès à Brevo est indisponible", async () => {
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);

    await expect(synchroniserContactsAction()).rejects.toThrow(
      "REDIRECT:/admin/diffusion?sync=indisponible",
    );
    expect(synchroniserComptes).not.toHaveBeenCalled();
  });

  it("s'arrête AVANT de lire la base tant que la liste reste à désigner", async () => {
    vi.mocked(listeComptes).mockReturnValue(null);

    await expect(synchroniserContactsAction()).rejects.toThrow(
      "REDIRECT:/admin/diffusion?sync=sans-liste",
    );
    // Aucune adresse ne quitte la base pour une destination inconnue.
    expect(synchroniserComptes).not.toHaveBeenCalled();
  });
});

describe("synchroniserContactsAction — synchro", () => {
  it("pousse les contacts et rend compte du nombre", async () => {
    await expect(synchroniserContactsAction()).rejects.toThrow(
      "REDIRECT:/admin/diffusion?sync=ok&contacts=2",
    );

    expect(synchroniserComptes).toHaveBeenCalledTimes(1);
  });

  it("remonte l'échec à l'orga plutôt que de le taire", async () => {
    vi.mocked(synchroniserComptes).mockRejectedValue(new Error("clé refusée"));

    await expect(synchroniserContactsAction()).rejects.toThrow(
      /REDIRECT:\/admin\/diffusion\?sync=echec&err=cl/,
    );
  });
});
