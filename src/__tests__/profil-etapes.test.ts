import { describe, it, expect } from "vitest";
import { ETAPES, CLES_ETAPE, indexEtape } from "@/app/mon-espace/profil-etapes";

describe("Étapes du profil speakeuse", () => {
  it("secteurs et sujets sont DEUX étapes (une liste par étape)", () => {
    expect(ETAPES).toEqual([
      "Profil",
      "Secteurs",
      "Sujets",
      "Interventions",
      "Contact",
      "Attestation",
    ]);
  });

  // La ville de résidence a rejoint « Profil » (elle fait partie de l'en-tête
  // de la fiche) : l'étape ne parle donc plus que de PORTÉE. Le libellé le dit,
  // sinon on cherche sa ville dans une étape qui ne la contient plus.
  it("l'ancienne clé « localisation » reste valide et ouvre Interventions", () => {
    expect(ETAPES[indexEtape("localisation")]).toBe("Interventions");
    expect(indexEtape("localisation")).toBe(indexEtape("interventions"));
  });

  it("chaque clé de deep-link pointe sur une étape existante", () => {
    for (const cle of CLES_ETAPE) {
      expect(ETAPES[indexEtape(cle)], `clé « ${cle} » hors plage`).toBeTruthy();
    }
  });

  // Les liens de complétude (« Domaines ») circulent déjà dans les e-mails et
  // dans Mon espace : la clé doit continuer à ouvrir la 1ʳᵉ des deux étapes.
  it("l'ancienne clé « domaines » reste valide et ouvre Secteurs", () => {
    expect(ETAPES[indexEtape("domaines")]).toBe("Secteurs");
    expect(indexEtape("domaines")).toBe(indexEtape("secteurs"));
  });

  // Une lecture directe de l'objet répondrait aux clés du prototype : `?step=
  // constructor` renvoyait une fonction, qu'un `?? 0` ne rattrapait pas — le
  // formulaire s'affichait alors vide (aucune étape visible).
  it("une clé inconnue, prototype compris, ouvre la 1ʳᵉ étape", () => {
    for (const cle of [undefined, "", "inconnue", "constructor", "__proto__", "toString"]) {
      expect(indexEtape(cle), `clé « ${String(cle)} »`).toBe(0);
    }
  });
});
