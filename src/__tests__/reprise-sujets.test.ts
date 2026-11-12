import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/data/domaines";
import { REPRISE_SUJETS, reprendreSujets } from "@/lib/reprise-sujets";

const ANCIENS = [
  "IA / Machine Learning / Data",
  "Développement web / Front-end",
  "Mobile",
  "Cloud / DevOps / Infra",
  "Cybersécurité",
  "UX / Design / Accessibilité",
  "Produit / Agilité",
  "Leadership / Soft skills",
  "Recherche / Académique (PhD)",
  "Innovation / R&D",
  "Autre",
];

describe("REPRISE_SUJETS", () => {
  it("couvre les 11 anciens sujets", () => {
    expect(Object.keys(REPRISE_SUJETS).sort()).toEqual([...ANCIENS].sort());
  });

  it("ne renvoie que des thèmes de la liste", () => {
    for (const themes of Object.values(REPRISE_SUJETS)) {
      for (const t of themes) expect(THEMES).toContain(t);
    }
  });

  it("retire « Autre »", () => {
    expect(REPRISE_SUJETS["Autre"]).toEqual([]);
  });
});

describe("reprendreSujets", () => {
  it("convertit et dédoublonne", () => {
    expect(reprendreSujets(["Cloud / DevOps / Infra", "Cloud"])).toEqual(["Cloud", "DevOps"]);
  });

  it("fait disparaître « Autre »", () => {
    expect(reprendreSujets(["Autre"])).toEqual([]);
  });

  it("garde un sujet déjà nouveau tel quel (rejouable)", () => {
    expect(reprendreSujets(["Accessibilité"])).toEqual(["Accessibilité"]);
    expect(reprendreSujets(reprendreSujets(["UX / Design / Accessibilité"]))).toEqual([
      "UX / UI",
      "Accessibilité",
    ]);
  });
});

describe("migration SQL 077", () => {
  const sql = readFileSync("db/migrations/077_themes_categories.sql", "utf8");
  const sync = readFileSync("db/sync-to-latest.sql", "utf8");

  const fichiers = { migration: sql, sync };
  const echapper = (t: string) => t.replaceAll("'", "''");

  it("reprend chaque ancien sujet avec ses thèmes, comme la table TS", () => {
    for (const [nom, texte] of Object.entries(fichiers)) {
      for (const [ancien, themes] of Object.entries(REPRISE_SUJETS)) {
        const attendu = `WHEN '${echapper(ancien)}' THEN ARRAY[${themes
          .map((t) => `'${echapper(t)}'`)
          .join(", ")}]::text[]`;
        expect(texte, `${nom} : ${ancien}`).toContain(attendu);
      }
    }
  });

  it("filtre le WHERE sur chaque ancien sujet (sinon une fiche reste sans conversion)", () => {
    for (const [nom, texte] of Object.entries(fichiers)) {
      const where = texte.slice(texte.lastIndexOf("WHERE sujets && ARRAY["));
      expect(where, nom).toContain("WHERE sujets && ARRAY[");
      for (const ancien of Object.keys(REPRISE_SUJETS)) {
        expect(where, `${nom} : ${ancien}`).toContain(`'${echapper(ancien)}'`);
      }
    }
  });

  it("n'a ni branche WHEN en trop ni en moins", () => {
    for (const [nom, texte] of Object.entries(fichiers)) {
      expect(texte.match(/WHEN '/g)?.length, nom).toBe(Object.keys(REPRISE_SUJETS).length);
    }
  });
});
