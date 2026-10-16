import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/users", () => ({ getOrCreateUserByEmail: vi.fn(), getUserById: vi.fn(), setUserNameIfEmpty: vi.fn() }));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-coachs")>()),
  addCoachToAtelier: vi.fn(),
  removeCoachFromAtelier: vi.fn(),
  addCoachToRegistration: vi.fn(),
  removeCoachFromRegistration: vi.fn(),
  setUserGenre: vi.fn(),
  setUserGenreIfUnset: vi.fn(),
  markUserAsCoach: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrCreateUserByEmail, getUserById, setUserNameIfEmpty } from "@/lib/users";
import {
  addCoachToAtelier,
  removeCoachFromAtelier,
  addCoachToRegistration,
  removeCoachFromRegistration,
  setUserGenre,
  setUserGenreIfUnset,
  markUserAsCoach,
} from "@/lib/tremplin-coachs";
import { addCoachAction, removeCoachAction } from "@/app/admin/tremplins/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };
const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;
const user = { user: { id: 42, name: "Rachel", email: "r@x.fr" }, created: false };

beforeEach(() => vi.clearAllMocks());

describe("addCoachAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addCoachAction(idle, fd({ editionId: "1", atelierId: "3", email: "r@x.fr" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addCoachToAtelier).not.toHaveBeenCalled();
  });

  it("orga : retrouve/pré-crée le compte, pose genre + profil coach, relie (scopé)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(user);
    vi.mocked(addCoachToAtelier).mockResolvedValue(true);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", email: "R@x.fr", nom: "Rachel Dubois", genre: "femme" }),
    );
    expect(res.status).toBe("success");
    expect(getOrCreateUserByEmail).toHaveBeenCalledWith("r@x.fr", "Rachel Dubois");
    expect(setUserGenre).toHaveBeenCalledWith(42, "femme");
    expect(markUserAsCoach).toHaveBeenCalledWith(42); // profil animateur/coach, cumulable
    expect(addCoachToAtelier).toHaveBeenCalledWith(3, 1, 42);
  });

  it("orga : le genre est OBLIGATOIRE — absent ou invalide, rien n'est créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const sans = await addCoachAction(idle, fd({ editionId: "1", atelierId: "3", email: "r@x.fr" }));
    expect(sans.status).toBe("error");
    const invalide = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", email: "r@x.fr", genre: "n_importe" }),
    );
    expect(invalide.status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(setUserGenre).not.toHaveBeenCalled();
  });

  // Sélecteur : le coach vient des comptes de la plateforme — pas de
  // ressaisie d'e-mail, et le genre déjà déclaré n'est jamais re-demandé.
  it("orga : compte choisi (compteId) : relie SANS exiger le genre, sans créer de compte", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "Rachel", email: "r@x.fr" });
    vi.mocked(addCoachToAtelier).mockResolvedValue(true);
    const res = await addCoachAction(idle, fd({ editionId: "1", atelierId: "3", compteId: "42" }));
    expect(res.status).toBe("success");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(setUserGenre).not.toHaveBeenCalled();
    expect(markUserAsCoach).toHaveBeenCalledWith(42);
    expect(addCoachToAtelier).toHaveBeenCalledWith(3, 1, 42);
  });

  it("orga : compte choisi + genre fourni → complété SEULEMENT s'il manque (jamais écrasé)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "Rachel", email: "r@x.fr" });
    vi.mocked(addCoachToAtelier).mockResolvedValue(true);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", compteId: "42", genre: "femme" }),
    );
    expect(res.status).toBe("success");
    expect(setUserGenreIfUnset).toHaveBeenCalledWith(42, "femme");
    expect(setUserGenre).not.toHaveBeenCalled();
  });

  it("orga : compte choisi + nom saisi → complète le nom SEULEMENT s'il manque", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: null, email: "r@x.fr" });
    vi.mocked(addCoachToAtelier).mockResolvedValue(true);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", compteId: "42", nom: "Rachel Dubois" }),
    );
    expect(res.status).toBe("success");
    expect(setUserNameIfEmpty).toHaveBeenCalledWith(42, "Rachel Dubois");
  });

  it("orga : compte choisi inconnu → erreur ; compte ET e-mail → erreur (ambigu)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue(null);
    const inconnu = await addCoachAction(idle, fd({ editionId: "1", atelierId: "3", compteId: "999" }));
    expect(inconnu.status).toBe("error");
    const ambigu = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", compteId: "42", email: "r@x.fr", genre: "femme" }),
    );
    expect(ambigu.status).toBe("error");
    expect(addCoachToAtelier).not.toHaveBeenCalled();
  });

  it("orga + e-mail invalide : erreur, aucun compte créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "3", email: "pas-un-email" }),
    );
    expect(res.status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
  });

  it("orga + atelier hors édition (false) : erreur explicite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(user);
    vi.mocked(addCoachToAtelier).mockResolvedValue(false);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "999", email: "r@x.fr", genre: "homme" }),
    );
    expect(res.status).toBe("error");
  });
});

describe("addCoachAction — coaching individuel (registrationId)", () => {
  it("orga : assigne le coach à la participante (pas à un atelier)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(user);
    vi.mocked(addCoachToRegistration).mockResolvedValue(true);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", registrationId: "7", email: "r@x.fr", genre: "femme" }),
    );
    expect(res.status).toBe("success");
    expect(addCoachToRegistration).toHaveBeenCalledWith(7, 1, 42);
    expect(addCoachToAtelier).not.toHaveBeenCalled();
  });

  it("sans cible (ni atelier ni participante) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await addCoachAction(idle, fd({ editionId: "1", email: "r@x.fr", genre: "femme" }));
    expect(res.status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
  });
});

describe("removeCoachAction — coaching individuel", () => {
  it("orga : retire le coach de la participante (scopé)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(removeCoachFromRegistration).mockResolvedValue(true);
    const res = await removeCoachAction(idle, fd({ editionId: "1", registrationId: "7", userId: "42" }));
    expect(res.status).toBe("success");
    expect(removeCoachFromRegistration).toHaveBeenCalledWith(7, 1, 42);
    expect(removeCoachFromAtelier).not.toHaveBeenCalled();
  });
});

describe("removeCoachAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      removeCoachAction(idle, fd({ editionId: "1", atelierId: "3", userId: "42" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(removeCoachFromAtelier).not.toHaveBeenCalled();
  });

  it("orga : retire (scopé) ; introuvable → erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(removeCoachFromAtelier).mockResolvedValue(true);
    const ok = await removeCoachAction(idle, fd({ editionId: "1", atelierId: "3", userId: "42" }));
    expect(ok.status).toBe("success");
    expect(removeCoachFromAtelier).toHaveBeenCalledWith(3, 1, 42);

    vi.mocked(removeCoachFromAtelier).mockResolvedValue(false);
    const ko = await removeCoachAction(idle, fd({ editionId: "1", atelierId: "3", userId: "42" }));
    expect(ko.status).toBe("error");
  });
});

/**
 * La page publique liste les accompagnantes depuis `tremplin_atelier_coachs`,
 * et elle est en ISR (revalidate 300). Rattacher ou retirer une coach est donc
 * un geste PUBLIC : il doit rafraîchir la page tout de suite. Le retrait suit
 * souvent une demande de la personne — cinq minutes de plus, c'est cinq minutes
 * de trop.
 */
describe("rattachement d'une coach : la page publique suit", () => {
  const ROUTE_PUBLIQUE = "/tremplin/[conf]/[annee]";

  it("l'ajout rafraîchit la page publique", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(user);
    vi.mocked(addCoachToAtelier).mockResolvedValue(true);
    await addCoachAction(idle, fd({ editionId: "1", atelierId: "3", email: "r@x.fr", genre: "femme" }));
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE_PUBLIQUE, "layout");
  });

  it("le retrait rafraîchit la page publique", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(removeCoachFromAtelier).mockResolvedValue(true);
    await removeCoachAction(idle, fd({ editionId: "1", atelierId: "3", userId: "42" }));
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE_PUBLIQUE, "layout");
  });

  /**
   * Le marqueur `is_coach` est permanent : le poser avant le rattachement
   * laissait un compte « coach » sans rien accompagner dès que l'atelier
   * appartenait à une autre édition.
   */
  it("un atelier hors édition laisse le compte intact", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(user);
    vi.mocked(addCoachToAtelier).mockResolvedValue(false);
    const res = await addCoachAction(
      idle,
      fd({ editionId: "1", atelierId: "999", email: "r@x.fr", genre: "femme" }),
    );
    expect(res.status).toBe("error");
    expect(markUserAsCoach).not.toHaveBeenCalled();
  });
});
