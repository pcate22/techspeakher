import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LA SUPPRESSION D'UN COMPTE, EN ENTIER (dette P0-6, 2026-08-16).
 *
 * Un compte vit à DEUX endroits : notre base, et le contact du sous-traitant
 * e-mail. La suppression n'existait qu'en base — la synchro ne sachant que
 * POUSSER, un compte supprimé devenait simplement absent de la poussée
 * suivante, et son contact restait dans la liste avec ses attributs,
 * indéfiniment, à recevoir la lettre d'information.
 *
 * Ce fichier juge L'ORCHESTRATION, et rien d'autre : l'ordre des deux gestes,
 * et ce qui se passe quand l'un tombe. La RÈGLE de ce qu'on efface chez le
 * sous-traitant vit dans `brevo-contacts.test.ts` ; ce que le SQL préserve,
 * dans `profiles-db.integration.test.ts`. Trois questions, trois fichiers.
 */

vi.mock("@/lib/users", () => ({ getUserById: vi.fn() }));
vi.mock("@/lib/brevo-contacts", () => ({ supprimerContactBrevo: vi.fn() }));
vi.mock("@/lib/profiles", () => ({ effacerCompteEnBase: vi.fn() }));

import { getUserById } from "@/lib/users";
import { supprimerContactBrevo } from "@/lib/brevo-contacts";
import { effacerCompteEnBase } from "@/lib/profiles";
import { supprimerCompte } from "@/lib/suppression-compte";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserById).mockResolvedValue({ id: 7, name: "Ada", email: "ada@ex.fr" });
  vi.mocked(supprimerContactBrevo).mockResolvedValue("supprime");
});

describe("supprimerCompte — les deux endroits où vit un compte", () => {
  it("efface le contact chez le sous-traitant, avec l'adresse, PUIS la base", async () => {
    const ordre: string[] = [];
    vi.mocked(supprimerContactBrevo).mockImplementation(async () => {
      ordre.push("brevo");
      return "supprime";
    });
    vi.mocked(effacerCompteEnBase).mockImplementation(async () => {
      ordre.push("base");
    });

    await supprimerCompte(7);

    expect(supprimerContactBrevo).toHaveBeenCalledWith("ada@ex.fr");
    expect(effacerCompteEnBase).toHaveBeenCalledWith(7);
    // L'ORDRE porte la règle : l'adresse est le seul moyen d'aller chercher le
    // contact, donc elle part la première, tant qu'on la tient encore.
    expect(ordre).toEqual(["brevo", "base"]);
  });

  /**
   * Renoncer plutôt qu'effacer à moitié : la passe de conservation retente le
   * lendemain, le geste manuel le dit à l'écran. L'ordre inverse aurait effacé
   * l'adresse puis perdu le contact pour toujours.
   */
  it("une panne du sous-traitant renonce : la base reste INTACTE, et la suppression se retente", async () => {
    vi.mocked(supprimerContactBrevo).mockRejectedValue(new Error("Brevo 503"));

    await expect(supprimerCompte(7)).rejects.toThrow(/503/);

    expect(effacerCompteEnBase).not.toHaveBeenCalled();
  });

  /**
   * Un compte de la cohorte lien-magique peut avoir perdu son adresse. Le
   * sous-traitant tranche lui-même ce cas (`hors-perimetre`) : ici on vérifie
   * seulement que l'effacement en base a QUAND MÊME lieu — le droit à
   * l'effacement ne s'arrête pas sur une adresse absente.
   */
  it("un compte sans adresse s'efface quand même en base", async () => {
    vi.mocked(getUserById).mockResolvedValue({ id: 7, name: "Ada", email: null });
    vi.mocked(supprimerContactBrevo).mockResolvedValue("hors-perimetre");

    await supprimerCompte(7);

    expect(supprimerContactBrevo).toHaveBeenCalledWith(null);
    expect(effacerCompteEnBase).toHaveBeenCalledWith(7);
  });
});
