// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AUCUNE PERSONNE RÉELLE DANS LES DONNÉES DE DÉMARRAGE.
 *
 * Le code devient public. Les seeds (base de preview, Tremplin 1 de
 * démonstration) portaient de vraies finalistes, nom, bio et LinkedIn : une
 * donnée personnelle publiée hors de la base échappe au retrait de
 * consentement que l'admin applique. Remplacées par des figurantes le
 * 2026-10-15 ; ce test empêche qu'une vraie revienne par copier-coller.
 *
 * Le signe tenu : tout profil LinkedIn d'un seed finit par « -demo ».
 */
const racine = process.cwd();
const seeds = [
  "db/seed-preview.sql",
  ...readdirSync(join(racine, "src/lib"))
    .filter((f) => /seed/i.test(f))
    .map((f) => `src/lib/${f}`),
];

describe("seeds : des figurantes, jamais de vraies personnes", () => {
  it("couvre bien des fichiers (sinon il ne vérifierait rien)", () => {
    expect(seeds).toContain("src/lib/tremplin-seed.ts");
    expect(seeds.length).toBeGreaterThan(1);
  });

  it.each(seeds)("%s : tout profil LinkedIn est un figurant (-demo)", (fichier) => {
    const texte = readFileSync(join(racine, fichier), "utf8");
    const profils = [...texte.matchAll(/linkedin\.com\/in\/([A-Za-z0-9%_-]+)/g)].map((m) => m[1]);
    for (const p of profils) expect(p, `${fichier} : ${p}`).toMatch(/-demo$/);
  });

  it("les gabarits CSV de personnes réelles restent supprimés", () => {
    expect(existsSync(join(racine, "sheets-templates"))).toBe(false);
  });
});
