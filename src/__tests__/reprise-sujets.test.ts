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

  it("reprend chaque ancien sujet avec ses thèmes, comme la table TS", () => {
    for (const [ancien, themes] of Object.entries(REPRISE_SUJETS)) {
      const attendu = `WHEN '${ancien.replaceAll("'", "''")}' THEN ARRAY[${themes
        .map((t) => `'${t.replaceAll("'", "''")}'`)
        .join(", ")}]::text[]`;
      expect(sql, ancien).toContain(attendu);
      expect(sync, ancien).toContain(attendu);
    }
  });
});
