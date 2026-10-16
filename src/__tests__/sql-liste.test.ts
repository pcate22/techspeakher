import { describe, it, expect } from "vitest";
import { sqlDansListe } from "@/lib/sql-liste";

/**
 * Le fragment qui remplace les lectures en négatif (migration 073). Ce qui se
 * juge ici : la clause dit bien « exactement ces valeurs », et les deux cas où
 * elle pourrait devenir dangereuse en silence sont fermés.
 */
describe("sqlDansListe", () => {
  it("rend une liste positive, dans l'ordre de la constante", () => {
    expect(sqlDansListe("sp.status", ["brouillon", "publie"])).toBe(
      "sp.status IN ('brouillon', 'publie')",
    );
  });

  it("liste vide : personne ne convient (et pas un `IN ()` qui casse la requête)", () => {
    // Le cas arrive si un jour PLUS AUCUNE valeur n'est du côté demandé. Une
    // clause fausse laisse la requête tourner et ne retient rien : c'est le
    // sens voulu, et c'est le côté prudent des trois lectures concernées.
    expect(sqlDansListe("m.status", [])).toBe("false");
  });

  it("refuse une valeur qui sort de l'alphabet des identifiants", () => {
    expect(() => sqlDansListe("m.status", ["active'; DROP TABLE users --"])).toThrow(
      /identifiant/,
    );
  });

  it("refuse aussi une COLONNE qui en sort — c'est le paramètre libre", () => {
    expect(() => sqlDansListe("m.status) OR (1=1", ["active"])).toThrow(/identifiant/);
  });

  it("accepte les chiffres dans un identifiant (un statut `phase_2` un jour)", () => {
    expect(sqlDansListe("a.phase2", ["phase_2"])).toBe("a.phase2 IN ('phase_2')");
  });
});
