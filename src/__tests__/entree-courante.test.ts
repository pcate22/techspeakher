import { describe, it, expect } from "vitest";
import { entreeCourante, marqueCourante, type EntreeNav } from "@/lib/entree-courante";

/**
 * La règle du « vous êtes ici », partagée par la barre basse et le rail.
 * Testée ICI, à nu, parce que l'ordre des entrées des deux navigations
 * masquait le départage : retirer la priorité de la correspondance exacte
 * laissait leurs tests verts (mutation jouée le 2026-10-15), Accueil gagnant
 * par sa seule place dans la liste.
 */
describe("entreeCourante", () => {
  const repli: EntreeNav = { href: "/mon-espace/fiche", prefixes: ["/mon-espace"] };
  const accueil: EntreeNav = { href: "/mon-espace", exact: true };
  const agenda: EntreeNav = { href: "/mon-espace/agenda" };

  it("à longueur égale, la correspondance EXACTE d'une entrée `exact` prime — quel que soit l'ordre", () => {
    expect(entreeCourante("/mon-espace", [repli, accueil])).toBe(accueil);
    expect(entreeCourante("/mon-espace", [accueil, repli])).toBe(accueil);
  });

  it("une entrée `exact` ne s'allume jamais par préfixe", () => {
    expect(entreeCourante("/mon-espace/coaching", [accueil, repli])).toBe(repli);
  });

  it("le préfixe le plus long gagne sur le repli", () => {
    expect(entreeCourante("/mon-espace/agenda/2026", [repli, agenda])).toBe(agenda);
  });

  it("un préfixe s'arrête à un segment entier (`/mon-espace/agendas` n'est pas l'agenda)", () => {
    expect(entreeCourante("/mon-espace/agendas", [agenda])).toBeNull();
  });

  it("aucune correspondance : aucune entrée", () => {
    expect(entreeCourante("/speakeuses", [repli, accueil, agenda])).toBeNull();
  });
});

describe("marqueCourante", () => {
  const fiche: EntreeNav = { href: "/mon-espace/fiche", prefixes: ["/mon-espace"] };

  it("`page` sur son URL, `true` en repli, rien hors de l'entrée active", () => {
    expect(marqueCourante(fiche, fiche, "/mon-espace/fiche")).toBe("page");
    expect(marqueCourante(fiche, fiche, "/mon-espace/coaching")).toBe("true");
    expect(marqueCourante(fiche, null, "/mon-espace/fiche")).toBeUndefined();
  });
});
