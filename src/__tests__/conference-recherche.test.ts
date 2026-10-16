import { describe, it, expect } from "vitest";
import { filtrerConferences } from "@/lib/conference-recherche";

/**
 * Filtre du choix de conférence (formulaire d'occurrence) : la moitié PURE du
 * combobox. Avec 126 conférences au répertoire, dérouler la liste ne suffit
 * plus : on tape, et le filtre cherche indifféremment dans le NOM, la VILLE et
 * le PAYS — « Belgique » fait remonter Devoxx Belgium, « Lille » Cloud Nord.
 */

const CONFS = [
  { id: 1, nom: "Agile Toulouse", ville: "Toulouse", pays: "France" },
  { id: 2, nom: "Cloud Nord", ville: "Lille", pays: "France" },
  { id: 3, nom: "DevFest Toulouse", ville: "Toulouse", pays: "France" },
  { id: 4, nom: "Devoxx Belgium", ville: "Anvers", pays: "Belgique" },
  // Itinérante : sans ville ni pays au répertoire (le cas KubeCon).
  { id: 5, nom: "KubeCon + CloudNativeCon", ville: null, pays: null },
  { id: 6, nom: "Toulouse DevOps", ville: "Toulouse", pays: "France" },
  // À Toulouse SANS « Toulouse » dans le nom : le rang « lieu seul ».
  { id: 7, nom: "Capitole du Libre", ville: "Toulouse", pays: "France" },
];

const noms = (recherche: string) =>
  filtrerConferences(CONFS, recherche).map((c) => c.nom);

describe("filtrerConferences — où on cherche", () => {
  it("recherche vide (ou blanche) : toute la liste, dans l'ordre reçu", () => {
    expect(noms("")).toEqual(CONFS.map((c) => c.nom));
    expect(noms("   ")).toEqual(CONFS.map((c) => c.nom));
  });

  it("par NOM : « devfest » trouve DevFest Toulouse", () => {
    expect(noms("devfest")).toEqual(["DevFest Toulouse"]);
  });

  it("par VILLE : « lille » trouve Cloud Nord", () => {
    expect(noms("lille")).toEqual(["Cloud Nord"]);
  });

  it("par PAYS : « belgique » trouve Devoxx Belgium", () => {
    expect(noms("belgique")).toEqual(["Devoxx Belgium"]);
  });

  it("accents et casse indifférents (« BELGIQUE », « bélgium »)", () => {
    expect(noms("BELGIQUE")).toEqual(["Devoxx Belgium"]);
    expect(noms("bélgium")).toEqual(["Devoxx Belgium"]);
  });

  it("une conférence sans ville ni pays reste trouvable par son nom", () => {
    expect(noms("kubecon")).toEqual(["KubeCon + CloudNativeCon"]);
  });

  it("plusieurs mots : CHACUN doit matcher (n'importe quel champ)", () => {
    // « devfest » (nom) + « toulouse » (nom ou ville) → une seule conf.
    expect(noms("devfest toulouse")).toEqual(["DevFest Toulouse"]);
    // « cloud lille » : nom + ville de la même conf.
    expect(noms("cloud lille")).toEqual(["Cloud Nord"]);
    // Un mot qui ne matche rien élimine tout.
    expect(noms("devfest helsinki")).toEqual([]);
  });
});

describe("filtrerConferences — ce qui remonte en premier", () => {
  it("le nom qui COMMENCE par la recherche passe devant le nom qui la contient, qui passe devant le simple lieu", () => {
    expect(noms("toulouse")).toEqual([
      // 1. nom en préfixe
      "Toulouse DevOps",
      // 2. nom qui contient (ordre alphabétique préservé entre elles)
      "Agile Toulouse",
      "DevFest Toulouse",
      // 3. lieu seul
      "Capitole du Libre",
    ]);
  });

  it("à rang égal, l'ordre alphabétique du répertoire est préservé (tri stable)", () => {
    expect(noms("france")).toEqual([
      "Agile Toulouse",
      "Cloud Nord",
      "DevFest Toulouse",
      "Toulouse DevOps",
      "Capitole du Libre",
    ]);
  });
});
