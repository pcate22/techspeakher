import { describe, it, expect } from "vitest";
import { communeRetenue, type Commune } from "@/lib/communes";

/**
 * LA RÈGLE QUI DÉCIDE D'ÉCRIRE DANS LES DONNÉES DE QUELQU'UN.
 *
 * Le rattrapage géographique (`scripts/rattraper-geographie-occurrences.mjs`)
 * remplit `code_insee` et `region` des occurrences déjà enregistrées. Il écrit
 * donc dans les fiches de vraies speakeuses, à partir d'un nom de ville tapé à
 * la main. Un mauvais choix ici range une date toulousaine en Île-de-France
 * sans que rien ne casse à l'écran.
 *
 * La règle est isolée du réseau exprès : la BAN peut être injoignable (elle
 * l'était depuis l'environnement d'audit), et cette décision-là doit rester
 * éprouvable de toute façon.
 */

const commune = (o: Partial<Commune> = {}): Commune => ({
  nom: "Toulouse",
  codePostal: "31000",
  codeInsee: "31555",
  region: "Occitanie",
  ...o,
});

describe("communeRetenue — on écrit seulement quand on est sûr", () => {
  it("retient la commune quand une seule correspond exactement", () => {
    expect(communeRetenue("Toulouse", [commune()])?.codeInsee).toBe("31555");
  });

  it("ignore la casse et les accents", () => {
    const orleans = commune({ nom: "Orléans", codeInsee: "45234", region: "Centre-Val de Loire" });
    expect(communeRetenue("orleans", [orleans])?.codeInsee).toBe("45234");
  });

  it("REFUSE de choisir quand plusieurs communes portent le même nom", () => {
    // « Saint-Denis » : une dizaine de communes. En choisir une écrirait une
    // région fausse chez quelqu'un ; laisser vide ne ment à personne.
    const homonymes = [
      commune({ nom: "Saint-Denis", codeInsee: "93066", region: "Île-de-France" }),
      commune({ nom: "Saint-Denis", codeInsee: "97411", region: "La Réunion" }),
    ];
    expect(communeRetenue("Saint-Denis", homonymes)).toBeNull();
  });

  it("écarte une correspondance approchante", () => {
    // La BAN répond large : « Toulouse » ramène aussi « Toulouzette ».
    const proches = [commune({ nom: "Toulouzette", codeInsee: "40318" })];
    expect(communeRetenue("Toulouse", proches)).toBeNull();
  });

  it("aucune correspondance : rien, et c'est le résultat CORRECT hors de France", () => {
    expect(communeRetenue("Bruxelles", [])).toBeNull();
  });

  it("refuse une commune sans code ou sans région : une demi-géographie ne vaut rien", () => {
    expect(communeRetenue("Toulouse", [commune({ codeInsee: "" })])).toBeNull();
    expect(communeRetenue("Toulouse", [commune({ region: "" })])).toBeNull();
  });
});
