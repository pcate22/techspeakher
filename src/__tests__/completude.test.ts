import { describe, it, expect } from "vitest";
import {
  completude,
  grouperAFaire,
  SEUIL_REGROUPEMENT,
} from "@/lib/completude";
import { makeProfile } from "./test-helpers";

/** Fiche publiée avec tous les REQUIS faits (bio, contact, attestation). */
const fichePubliee = (over = {}) =>
  makeProfile({
    titreProfil: "Ingénieure",
    bio: "Salut",
    secteurs: ["MedTech / Santé"],
    sujets: ["IA / Machine Learning / Data"],
    linkedin: "https://lk/x",
    isWoman: true,
    status: "publie",
    ...over,
  });

describe("completude — mécanique unique (requis + enrichissements)", () => {
  it("sans fiche : aucun enrichissement, uniquement les requis", () => {
    const { chantiers, aFaire } = completude(null, 0);
    expect(chantiers.every((c) => !c.optionnel)).toBe(true);
    // Rien n'est fait : tous les requis sont à faire.
    expect(aFaire.length).toBe(chantiers.length);
  });

  it("nouvelle inscription (fiche vide, 0 talk) : beaucoup de chantiers → on regroupe", () => {
    const { aFaire, grouper } = completude(makeProfile(), 0);
    expect(aFaire.length).toBeGreaterThan(SEUIL_REGROUPEMENT);
    expect(grouper).toBe(true);
  });

  it("fiche publiée complète et enrichie : plus rien à faire", () => {
    const p = fichePubliee({
      ville: "Toulouse",
      regions: ["Occitanie", "Île-de-France"],
      langues: ["Français", "Anglais"],
      website: "https://moi.dev",
    });
    const { aFaire, requisRestants, percentRequis } = completude(p, 1);
    expect(percentRequis).toBe(100);
    expect(requisRestants).toEqual([]);
    expect(aFaire).toEqual([]);
  });

  it("fiche publiée mais champs vides : peu de chantiers → à plat (pas de regroupement)", () => {
    // ville/regions/langues/website/instagram vides → 2 enrichissements à faire.
    const { aFaire, grouper } = completude(fichePubliee(), 1);
    const cles = aFaire.map((c) => c.key);
    expect(cles).toContain("localisation-langues");
    expect(cles).toContain("reseaux");
    expect(aFaire.every((c) => c.optionnel)).toBe(true);
    expect(grouper).toBe(false);
  });

  it("valeurs toulousaines par défaut (Occitanie seule + Français seul) : c'est renseigné, on n'insiste plus", () => {
    // Régression : parler seulement français / n'intervenir qu'en Occitanie est
    // légitime — l'invitation ne doit pas rester coincée pour toujours.
    const p = fichePubliee({
      ville: "Toulouse",
      regions: ["Occitanie"],
      langues: ["Français"],
      website: "https://moi.dev",
    });
    const cles = completude(p, 1).aFaire.map((c) => c.key);
    expect(cles).not.toContain("localisation-langues");
  });

  it("localisation à compléter tant qu'un des trois champs est vide (ex. aucune langue)", () => {
    const p = fichePubliee({
      ville: "Toulouse",
      regions: ["Occitanie"],
      langues: [],
      website: "https://moi.dev",
    });
    expect(completude(p, 1).aFaire.map((c) => c.key)).toContain(
      "localisation-langues",
    );
  });

  it("localisation faite dès que ville + au moins une zone + au moins une langue", () => {
    const p = fichePubliee({
      ville: "Toulouse",
      regions: ["Occitanie", "Nouvelle-Aquitaine"],
      langues: ["Français", "Anglais"],
      website: "https://moi.dev",
    });
    const cles = completude(p, 1).aFaire.map((c) => c.key);
    expect(cles).not.toContain("localisation-langues");
  });

  it("réseaux faits dès qu'il y a un site OU un Instagram", () => {
    const base = fichePubliee({
      ville: "Toulouse",
      regions: ["Occitanie", "Bretagne"],
      langues: ["Français", "Anglais"],
    });
    expect(
      completude({ ...base, instagram: "https://insta/x" }, 1).aFaire.map(
        (c) => c.key,
      ),
    ).not.toContain("reseaux");
    expect(completude(base, 1).aFaire.map((c) => c.key)).toContain("reseaux");
  });

  it("le pourcentage ne mesure QUE les requis (les enrichissements ne le font pas baisser)", () => {
    // Requis tous faits mais enrichissements vides → 100 % quand même.
    expect(completude(fichePubliee(), 1).percentRequis).toBe(100);
  });
});

describe("grouperAFaire — regroupement par étape, ordre conservé", () => {
  it("regroupe les chantiers à faire par groupe, dans l'ordre d'apparition", () => {
    const { aFaire } = completude(makeProfile(), 0);
    const groupes = grouperAFaire(aFaire);
    // Le premier groupe est « profil » (début du parcours).
    expect(groupes[0].groupe).toBe("profil");
    // Chaque chantier à faire se retrouve dans exactement un groupe.
    const total = groupes.reduce((n, g) => n + g.chantiers.length, 0);
    expect(total).toBe(aFaire.length);
  });

  it("les enrichissements réseaux atterrissent dans le groupe « contact »", () => {
    const p = fichePubliee();
    const groupes = grouperAFaire(completude(p, 1).aFaire);
    const contact = groupes.find((g) => g.groupe === "contact");
    expect(contact?.chantiers.some((c) => c.key === "reseaux")).toBe(true);
  });
});
