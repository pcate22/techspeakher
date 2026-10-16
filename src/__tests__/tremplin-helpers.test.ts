import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Edition } from "@/lib/tremplin-editions";

// notFound() lève (comme en prod) pour qu'on puisse l'attraper dans les tests.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-editions")>()),
  getEditionById: vi.fn(),
}));

import { notFound } from "next/navigation";
import { getEditionById } from "@/lib/tremplin-editions";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import {
  errMessage,
  okMessage,
  TREMPLIN_ERR_MESSAGES,
  TREMPLIN_OK_MESSAGES,
} from "@/lib/tremplin-messages";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";

const editionFixture: Edition = {
  id: 3,
  nom: "Tremplin 2",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "ouvert",
  description: null,
  confNom: null,
  confLieu: null,
  confDate: null,
  deletedAt: null,
  confLien: null,
  finaleDate: null,
  finaleLieu: null,
  inscriptionsDebut: null,
  inscriptionsFin: null,
conferenceEditionId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * L'INSÉCABLE FAIT PARTIE DU TITRE ATTENDU.
 *
 * « Tech Speak'Her » en porte une pour ne pas se couper en fin de ligne — les
 * titres de page s'affichent dans les résultats de recherche, où ils passent à
 * la ligne. Une première version de ces cas repliait tous les blancs avant de
 * comparer : le titre revenu à une espace ordinaire passait alors sans bruit, et
 * ce module dessert une SOIXANTAINE de routes. C'est justement en divergeant en
 * silence qu'il avait déjà décroché des autres titres du site.
 *
 * `tremplinPageMetadata` assemble son titre dans un littéral d'une seule ligne :
 * aucun blanc de mise en forme à replier, donc rien à normaliser — on compare
 * la chaîne exacte, insécable comprise.
 */
const NBSP = "\u00A0";
const TSH = `Tech${NBSP}Speak'Her`;

describe("loadEditionOrNotFound", () => {
  it("id non entier → notFound (sans requête BDD)", async () => {
    await expect(loadEditionOrNotFound("abc")).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    expect(getEditionById).not.toHaveBeenCalled();
  });

  it("édition absente → notFound", async () => {
    vi.mocked(getEditionById).mockResolvedValue(null);
    await expect(loadEditionOrNotFound("3")).rejects.toThrow("NOT_FOUND");
    expect(getEditionById).toHaveBeenCalledWith(3);
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("édition présente → { editionId, edition }", async () => {
    vi.mocked(getEditionById).mockResolvedValue(editionFixture);
    const res = await loadEditionOrNotFound("3");
    expect(res).toEqual({ editionId: 3, edition: editionFixture });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("tremplin-messages", () => {
  it("errMessage : code connu → message", () => {
    expect(errMessage("retrait")).toBe(TREMPLIN_ERR_MESSAGES.retrait);
  });

  it("errMessage : code inconnu ou undefined → null", () => {
    expect(errMessage("inconnu")).toBeNull();
    expect(errMessage(undefined)).toBeNull();
  });

  it("okMessage : code connu → message", () => {
    expect(okMessage("photo_supprimee")).toBe(TREMPLIN_OK_MESSAGES.photo_supprimee);
  });

  it("okMessage : code inconnu ou undefined → null", () => {
    expect(okMessage("inconnu")).toBeNull();
    expect(okMessage(undefined)).toBeNull();
  });

  it("les maps existent et contiennent les codes attendus", () => {
    expect(Object.keys(TREMPLIN_ERR_MESSAGES)).toEqual(
      expect.arrayContaining(["retrait", "edition_nom", "recompense", "photo"]),
    );
    expect(Object.keys(TREMPLIN_OK_MESSAGES)).toEqual(
      expect.arrayContaining([
        "participante_retiree",
        "recompense_supprimee",
        "photo_supprimee",
      ]),
    );
  });
});

describe("tremplinPageMetadata", () => {
  it("hub (sans leaf), édition connue : titre = nom | Tech Speak'Her, noindex", async () => {
    vi.mocked(getEditionById).mockResolvedValue(editionFixture);
    const meta = await tremplinPageMetadata("3");
    expect(meta.title).toBe(`Tremplin 2 | ${TSH}`);
    expect(meta.robots).toEqual({ index: false });
    expect(getEditionById).toHaveBeenCalledWith(3);
  });

  it("avec leaf : titre = « leaf — nom | Tech Speak'Her »", async () => {
    vi.mocked(getEditionById).mockResolvedValue(editionFixture);
    const meta = await tremplinPageMetadata("3", "Ateliers");
    expect(meta.title).toBe(`Ateliers · Tremplin 2 | ${TSH}`);
  });

  it("id non entier : pas de requête BDD, nom de repli", async () => {
    const meta = await tremplinPageMetadata("abc", "Ateliers");
    expect(meta.title).toBe(`Ateliers · Édition Tremplin | ${TSH}`);
    expect(getEditionById).not.toHaveBeenCalled();
  });

  it("édition absente : nom de repli « Édition Tremplin »", async () => {
    vi.mocked(getEditionById).mockResolvedValue(null);
    const meta = await tremplinPageMetadata("999");
    expect(meta.title).toBe(`Édition Tremplin | ${TSH}`);
  });
});
