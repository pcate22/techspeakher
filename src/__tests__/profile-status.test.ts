import { describe, it, expect } from "vitest";
import {
  PROFILE_STATUSES,
  STATUS_LABELS,
  STATUTS_FICHE_JOINTE,
  statusLabel,
  nomAffiche,
  NOM_GENERIQUE,
} from "@/lib/profile-status";

describe("profile-status", () => {
  it("liste les 6 statuts", () => {
    expect([...PROFILE_STATUSES].sort()).toEqual([
      "brouillon",
      "en_attente",
      "en_pause",
      "masque",
      "publie",
      "refuse",
    ]);
  });

  it("a un libellé pour chaque statut", () => {
    for (const s of PROFILE_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it("la fiche est jointe à l'édition sauf retrait EXPLICITE (masque, refuse)", () => {
    // Ce que la galerie du Tremplin affiche : bio, rôle, liens d'une finaliste.
    // Le consentement d'édition est découplé de l'annuaire — un brouillon
    // s'affiche — mais un retrait coupe tout. La liste est dérivée du tableau
    // exhaustif : un statut ajouté au type doit être rangé pour compiler, et
    // c'est ici qu'on lit de quel côté il est tombé.
    // `en_pause` (adhésion échue, migration 074) reste jointe : ce n'est pas
    // un retrait, et le consentement d'édition tient toujours.
    expect([...STATUTS_FICHE_JOINTE].sort()).toEqual([
      "brouillon",
      "en_attente",
      "en_pause",
      "publie",
    ]);
  });

  it("statusLabel : libellé connu, fallback Brouillon si null", () => {
    expect(statusLabel("publie")).toBe("Publiée");
    expect(statusLabel("masque")).toBe("En retrait");
    expect(statusLabel(null)).toBe("Brouillon");
  });
});

describe("nomAffiche — LE nom d'une fiche, calculé une fois au bord", () => {
  // Le défaut d'origine (dette P1 « fiches publiées sans nom ») : six écrans
  // recopiaient `name ?? titreProfil ?? "Speakeuse"` — et `??` laisse passer
  // `""` et `"   "` quand les gardes de publication testent `.trim()`. Une
  // fiche migrée au nom vide s'affichait donc « vide », pas même générique.
  it("un nom réel passe, débarrassé de ses espaces de bord", () => {
    expect(nomAffiche("  Ada Lovelace ", null)).toBe("Ada Lovelace");
  });

  it("un nom VIDE ou blanc retombe sur le titre du profil", () => {
    expect(nomAffiche("", "Dev & mentor")).toBe("Dev & mentor");
    expect(nomAffiche("   ", "Dev & mentor")).toBe("Dev & mentor");
    expect(nomAffiche(null, " Dev ")).toBe("Dev");
  });

  it("sans rien d'affichable : le libellé générique, jamais du vide", () => {
    expect(nomAffiche(null, null)).toBe(NOM_GENERIQUE);
    expect(nomAffiche("", "  ")).toBe(NOM_GENERIQUE);
  });
});
