import { describe, it, expect } from "vitest";
import {
  IDLE,
  formValues,
  restoredValue,
  champInitial,
  restoredChecked,
  type ActionState,
} from "@/lib/action-state";

// État d'erreur réutilisable : la saisie de l'orga renvoyée par l'action pour
// être ré-appliquée en defaultValue après le reset de React 19.
const erreur = (values: Record<string, string | string[]>): ActionState => ({
  status: "error",
  error: "boum",
  values,
});

describe("IDLE", () => {
  it("est l'état neutre { status: 'idle' }", () => {
    expect(IDLE).toEqual({ status: "idle" });
  });
});

describe("formValues", () => {
  it("capture les champs mono-valeur en chaîne", () => {
    const fd = new FormData();
    fd.set("nom", "Ada");
    fd.set("ville", "Toulouse");
    expect(formValues(fd)).toEqual({ nom: "Ada", ville: "Toulouse" });
  });

  it("regroupe les champs multi-valeurs en tableau", () => {
    const fd = new FormData();
    fd.append("domaines", "web");
    fd.append("domaines", "data");
    expect(formValues(fd)).toEqual({ domaines: ["web", "data"] });
  });

  it("ignore les entrées non textuelles (fichiers)", () => {
    const fd = new FormData();
    fd.set("nom", "Ada");
    fd.set("piece", new Blob(["x"]), "cv.pdf");
    // Le fichier est filtré : la clé disparaît (all.length === 0).
    expect(formValues(fd)).toEqual({ nom: "Ada" });
  });

  it("renvoie un objet vide pour un FormData vide", () => {
    expect(formValues(new FormData())).toEqual({});
  });
});

describe("restoredValue", () => {
  it("hors erreur → chaîne vide", () => {
    expect(restoredValue(IDLE, "nom")).toBe("");
    expect(restoredValue({ status: "success" }, "nom")).toBe("");
  });

  it("sur erreur → la valeur soumise si c'est une chaîne", () => {
    expect(restoredValue(erreur({ nom: "Ada" }), "nom")).toBe("Ada");
  });

  it("sur erreur → chaîne vide si la valeur est un tableau ou absente", () => {
    expect(restoredValue(erreur({ domaines: ["web"] }), "domaines")).toBe("");
    expect(restoredValue(erreur({ nom: "Ada" }), "absent")).toBe("");
  });
});

describe("champInitial (précédence restauration vs défaut)", () => {
  it("SUR ERREUR : la saisie restaurée est PRIORITAIRE sur le defaultValue", () => {
    // Piège connu : le défaut ne doit JAMAIS écraser la donnée re-saisie.
    expect(champInitial(erreur({ nom: "Ada" }), "nom", "défaut")).toBe("Ada");
  });

  it("SUR ERREUR mais champ absent : la restauration renvoie \"\" (pas le défaut)", () => {
    // restoredValue renvoie "" (jamais undefined) : un `?? défaut` serait un bug.
    expect(champInitial(erreur({ autre: "x" }), "nom", "défaut")).toBe("");
  });

  it("HORS ERREUR : le defaultValue s'applique", () => {
    expect(champInitial(IDLE, "nom", "défaut")).toBe("défaut");
    expect(champInitial({ status: "success" }, "nom", "défaut")).toBe("défaut");
  });

  it("HORS ERREUR sans défaut fourni → chaîne vide", () => {
    expect(champInitial(IDLE, "nom")).toBe("");
  });
});

describe("restoredChecked", () => {
  it("hors erreur → false", () => {
    expect(restoredChecked(IDLE, "domaines", "web")).toBe(false);
  });

  it("sur erreur, valeur multiple → true si la valeur est dans le tableau", () => {
    const state = erreur({ domaines: ["web", "data"] });
    expect(restoredChecked(state, "domaines", "web")).toBe(true);
    expect(restoredChecked(state, "domaines", "mobile")).toBe(false);
  });

  it("sur erreur, valeur simple → true si égalité stricte", () => {
    const state = erreur({ domaine: "web" });
    expect(restoredChecked(state, "domaine", "web")).toBe(true);
    expect(restoredChecked(state, "domaine", "data")).toBe(false);
  });

  it("sur erreur, champ absent → false", () => {
    expect(restoredChecked(erreur({ nom: "Ada" }), "domaines", "web")).toBe(false);
  });
});
