import { describe, it, expect } from "vitest";
import { pickEditionEnCours, pickEditionsActives } from "@/lib/tremplin-editions";
import type { Edition } from "@/lib/tremplin-editions";
import type { EditionStatut } from "@/lib/tremplin-statut";

// Fabrique d'édition : seuls id/nom/statut/confDate comptent pour la sélection.
function ed(
  partial: { id: number; nom: string; statut: EditionStatut; confDate: string | null },
): Edition {
  return {
    id: partial.id,
    nom: partial.nom,
    annee: 2026,
    confSlug: null,
    statut: partial.statut,
    description: null,
    confNom: null,
    confLieu: null,
    confDate: partial.confDate,
    confLien: null,
    finaleDate: null,
    finaleLieu: null,
    conferenceEditionId: null,
    inscriptionsDebut: null,
    inscriptionsFin: null,
    deletedAt: null,
  };
}

const TODAY = "2026-07-25";

describe("pickEditionEnCours", () => {
  it("renvoie null s'il n'y a aucune édition", () => {
    expect(pickEditionEnCours([], TODAY)).toBeNull();
  });

  it("ignore les éditions archivées", () => {
    const editions = [ed({ id: 1, nom: "TSH 2025", statut: "archive", confDate: "2026-10-01" })];
    expect(pickEditionEnCours(editions, TODAY)).toBeNull();
  });

  it("ignore les éditions dont la date de conf est passée", () => {
    const editions = [ed({ id: 1, nom: "TSH 2025", statut: "clos", confDate: "2026-06-01" })];
    expect(pickEditionEnCours(editions, TODAY)).toBeNull();
  });

  it("préfère le statut en_cours quand plusieurs éditions sont actives", () => {
    const editions = [
      ed({ id: 1, nom: "TSH 2027", statut: "preparation", confDate: "2027-05-01" }),
      ed({ id: 2, nom: "TSH 2026", statut: "en_cours", confDate: "2026-11-01" }),
    ];
    expect(pickEditionEnCours(editions, TODAY)).toEqual({ id: 2, nom: "TSH 2026" });
  });

  it("à défaut d'en_cours, prend la conf à venir la plus proche", () => {
    const editions = [
      ed({ id: 1, nom: "TSH 2028", statut: "ouvert", confDate: "2028-01-01" }),
      ed({ id: 2, nom: "TSH 2026", statut: "ouvert", confDate: "2026-09-15" }),
    ];
    expect(pickEditionEnCours(editions, TODAY)).toEqual({ id: 2, nom: "TSH 2026" });
  });

  it("garde une édition active sans date de conf posée", () => {
    const editions = [ed({ id: 7, nom: "TSH 2026", statut: "preparation", confDate: null })];
    expect(pickEditionEnCours(editions, TODAY)).toEqual({ id: 7, nom: "TSH 2026" });
  });

  it("accepte une conf datée aujourd'hui (le jour J n'est pas passé)", () => {
    const editions = [ed({ id: 3, nom: "TSH 2026", statut: "en_cours", confDate: TODAY })];
    expect(pickEditionEnCours(editions, TODAY)).toEqual({ id: 3, nom: "TSH 2026" });
  });
});

/**
 * La feuille ➕ « Ajouter un atelier » (lot N1 §2.4) a besoin de TOUTES les
 * éditions actives : une seule → lien direct, plusieurs → choix d'édition.
 * L'ordre est celui de `pickEditionEnCours` généralisé : en_cours d'abord,
 * puis conf la plus proche, puis les éditions sans date.
 */
describe("pickEditionsActives", () => {
  it("liste vide sans édition active (archivées et passées exclues)", () => {
    const editions = [
      ed({ id: 1, nom: "TSH 2024", statut: "archive", confDate: "2026-10-01" }),
      ed({ id: 2, nom: "TSH 2025", statut: "clos", confDate: "2026-06-01" }),
    ];
    expect(pickEditionsActives(editions, TODAY)).toEqual([]);
  });

  it("ordonne : en_cours, puis conf la plus proche, puis sans date", () => {
    const editions = [
      ed({ id: 1, nom: "Sans date", statut: "preparation", confDate: null }),
      ed({ id: 2, nom: "Lointaine", statut: "ouvert", confDate: "2028-01-01" }),
      ed({ id: 3, nom: "En cours", statut: "en_cours", confDate: "2026-11-01" }),
      ed({ id: 4, nom: "Proche", statut: "ouvert", confDate: "2026-09-15" }),
    ];
    expect(pickEditionsActives(editions, TODAY)).toEqual([
      { id: 3, nom: "En cours" },
      { id: 4, nom: "Proche" },
      { id: 2, nom: "Lointaine" },
      { id: 1, nom: "Sans date" },
    ]);
  });

  it("le premier de la liste est exactement le choix de pickEditionEnCours", () => {
    const editions = [
      ed({ id: 1, nom: "TSH 2028", statut: "ouvert", confDate: "2028-01-01" }),
      ed({ id: 2, nom: "TSH 2026", statut: "ouvert", confDate: "2026-09-15" }),
    ];
    expect(pickEditionsActives(editions, TODAY)[0]).toEqual(
      pickEditionEnCours(editions, TODAY),
    );
  });
});
