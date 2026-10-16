import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

/**
 * `slugify` est le JUMEAU TS de l'expression SQL de la migration 027 (translate
 * accents → non-alphanum → tirets → minuscules → bords nettoyés). Il est
 * désormais partagé (conférences ET contenus éditables). L'équivalence avec le
 * SQL réel reste vérifiée par conferences-db.integration.test.ts ; ici on fige
 * le comportement pur, y compris les cas limites.
 */
describe("slugify", () => {
  it("minuscule, accents translittérés, séparateurs → tirets, bords nettoyés", () => {
    expect(slugify("DevFest Toulouse")).toBe("devfest-toulouse");
    expect(slugify("Forum PHP")).toBe("forum-php");
    expect(slugify("Devoxx France")).toBe("devoxx-france");
    expect(slugify("Été du Code !")).toBe("ete-du-code");
    expect(slugify("BDX I/O")).toBe("bdx-i-o");
  });

  it("regroupe les séparateurs consécutifs en un seul tiret", () => {
    expect(slugify("A   B")).toBe("a-b");
    expect(slugify("Tech.Rocks")).toBe("tech-rocks");
    expect(slugify("a---b__c")).toBe("a-b-c");
  });

  it("nettoie les tirets de début et de fin", () => {
    expect(slugify("  Bonjour  ")).toBe("bonjour");
    expect(slugify("!!! Coucou !!!")).toBe("coucou");
  });

  it("renvoie une chaîne vide quand aucun caractère alphanumérique", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("!?/ - .")).toBe("");
  });
});
