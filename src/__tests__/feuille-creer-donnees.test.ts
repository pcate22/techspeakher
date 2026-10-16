import { describe, it, expect, vi, beforeEach } from "vitest";

// On isole la dérivation serveur (capacité de création + éditions orga) des
// accès base : profils, comptes et éditions sont mockés.
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn() }));
vi.mock("@/lib/tremplin-editions", () => ({ getEditionsActives: vi.fn() }));
vi.mock("@/lib/talks", () => ({ getTitresTalks: vi.fn() }));
vi.mock("@/lib/users", () => ({
  getCompte: vi.fn(),
  peutCreerFiche: (genre: string | null | undefined) => genre !== "homme",
}));

import { getProfileByUserId } from "@/lib/profiles";
import { getEditionsActives } from "@/lib/tremplin-editions";
import { getCompte } from "@/lib/users";
import { getTitresTalks } from "@/lib/talks";
import { getFeuilleDonnees } from "@/lib/feuille-creer";

const profileMock = vi.mocked(getProfileByUserId);
const editionsMock = vi.mocked(getEditionsActives);
const compteMock = vi.mocked(getCompte);
const titresMock = vi.mocked(getTitresTalks);

type Profile = Awaited<ReturnType<typeof getProfileByUserId>>;
const uneFiche = { id: 42, status: "brouillon" } as unknown as Profile;

beforeEach(() => {
  vi.clearAllMocks();
  editionsMock.mockResolvedValue([]);
  titresMock.mockResolvedValue([]);
  compteMock.mockResolvedValue({ name: "Marie Curie", genre: null, image: null });
});

describe("getFeuilleDonnees (la feuille ➕, conception N1 §2.4)", () => {
  it("avec une fiche : la création proposée est le talk — le genre n'est même pas interrogé", async () => {
    profileMock.mockResolvedValue(uneFiche);
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(d.creation).toBe("talk");
    expect(compteMock).not.toHaveBeenCalled();
  });

  it("sans fiche, compte éligible : le vrai premier pas est la fiche", async () => {
    profileMock.mockResolvedValue(null);
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(d.creation).toBe("fiche");
  });

  it("sans fiche + genre « homme » : jamais de CTA impossible (creation null)", async () => {
    profileMock.mockResolvedValue(null);
    compteMock.mockResolvedValue({ name: "Marc", genre: "homme", image: null });
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(d.creation).toBeNull();
  });

  it("non-orga : les éditions restent hors requête (liste vide, aucun appel)", async () => {
    profileMock.mockResolvedValue(uneFiche);
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(editionsMock).not.toHaveBeenCalled();
    expect(d.editions).toEqual([]);
    expect(d.orga).toBe(false);
  });

  it("orga : la feuille reçoit les éditions actives ordonnées", async () => {
    profileMock.mockResolvedValue(uneFiche);
    editionsMock.mockResolvedValue([
      { id: 5, nom: "TSH 2026" },
      { id: 8, nom: "TSH 2027" },
    ]);
    const d = await getFeuilleDonnees({ id: "1", isOrga: true });
    expect(d.orga).toBe(true);
    expect(d.editions).toEqual([
      { id: 5, nom: "TSH 2026" },
      { id: 8, nom: "TSH 2027" },
    ]);
  });

  it("avec une fiche : ses talks (id, titre) pour « Ajouter une date à un talk », lus par SON compte", async () => {
    profileMock.mockResolvedValue(uneFiche);
    titresMock.mockResolvedValue([{ id: 12, titre: "IA et personnes aveugles" }]);
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(titresMock).toHaveBeenCalledWith(1);
    expect(d.talks).toEqual([{ id: 12, titre: "IA et personnes aveugles" }]);
  });

  it("sans fiche : aucun talk proposé", async () => {
    profileMock.mockResolvedValue(null);
    const d = await getFeuilleDonnees({ id: "1", isOrga: false });
    expect(d.talks).toEqual([]);
  });
});
