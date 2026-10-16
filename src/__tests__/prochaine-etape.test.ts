import { describe, it, expect } from "vitest";
import { prochaineEtape } from "@/lib/prochaine-etape";

/**
 * L'échelle de « Ta prochaine étape » (conception N1 §2.5, validée) : UNE
 * carte, dérivée des données, dans l'ordre du parcours vers la scène.
 */
describe("prochaineEtape", () => {
  const base = { aFiche: true, peutCreerFiche: false, talksCount: 2, prochaineScene: null };

  it("sans fiche, compte éligible → créer sa fiche", () => {
    const m = prochaineEtape({ ...base, aFiche: false, peutCreerFiche: true });
    expect(m?.href).toBe("/mon-espace/fiche");
    expect(m?.cta).toMatch(/créer ma fiche/i);
  });

  it("sans fiche, compte non éligible → aucune étape (jamais de CTA impossible)", () => {
    expect(prochaineEtape({ ...base, aFiche: false, peutCreerFiche: false })).toBeNull();
  });

  it("des talks repérés en attente → les confirmer passe avant tout le reste de la fiche", () => {
    const m = prochaineEtape({ ...base, talksCount: 0, suggestionsCount: 2 });
    expect(m?.href).toBe("/mon-espace/talks");
    // Aucun sigle (« CFP »), aucune marque (« Sessionize ») : le moissonneur
    // gagnera Notist, un intitulé ne cite pas une implémentation qui bouge.
    expect(m?.texte).toBe("On a repéré 2 talks à ton nom\u00a0: ils attendent ta confirmation.");
    expect(m?.texte).not.toMatch(/CFP|Sessionize|Notist/i);
    expect(m?.cta).toMatch(/confirmer mes talks/i);
  });

  it("un seul talk repéré : le singulier", () => {
    const m = prochaineEtape({ ...base, suggestionsCount: 1 });
    expect(m?.texte).toBe("On a repéré un talk à ton nom\u00a0: il attend ta confirmation.");
    expect(m?.texte).not.toMatch(/CFP/i);
  });

  it("fiche sans talk → proposer le premier talk", () => {
    const m = prochaineEtape({ ...base, talksCount: 0 });
    expect(m?.href).toBe("/mon-espace/talks/nouveau");
    expect(m?.texte).toMatch(/premier talk/i);
  });

  it("des talks mais aucune date à venir → viser une scène", () => {
    const m = prochaineEtape(base);
    expect(m?.href).toBe("/mon-espace/talks");
    expect(m?.texte).toMatch(/vise une scène/i);
  });

  it("une scène datée → la préparer, date en toutes lettres", () => {
    const m = prochaineEtape({ ...base, prochaineScene: "2026-09-12" });
    expect(m?.href).toBe("/mon-espace/agenda");
    expect(m?.texte).toContain("12 septembre 2026");
  });

  it("fiche en pause faute d'adhésion → adhérer passe avant tout le reste", () => {
    // Une fiche invisible rend vain « ajoute un talk » : le seul geste utile
    // est celui qui la remet dans l'annuaire (docs/conception-adhesions-helloasso.md).
    const m = prochaineEtape({ ...base, talksCount: 0, suggestionsCount: 3, ficheEnPause: true });
    expect(m).toEqual({
      texte:
        "Ta fiche est en pause, hors de l'annuaire. Après ton adhésion, elle y revient dans quelques minutes, et au plus tard le lendemain.",
      cta: "Adhérer",
      href: "/adherer",
    });
  });

  it("typographie : une insécable avant « : » et « ! », jamais une espace simple", () => {
    const cas = [
      prochaineEtape({ ...base, aFiche: false, peutCreerFiche: true }),
      prochaineEtape({ ...base, talksCount: 0 }),
      prochaineEtape({ ...base }),
      prochaineEtape({ ...base, prochaineScene: "2026-11-20" }),
    ];
    for (const e of cas) expect(e?.texte).not.toMatch(/ [:!?;]/);
  });
});
