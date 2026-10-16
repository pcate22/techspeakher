import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * LA LICENCE DU DÉPÔT SE DIT À SIX ENDROITS, ET ILS DOIVENT DIRE LA MÊME CHOSE.
 *
 * Décision du 2026-08-23 : le code reste PUBLIC (on peut le lire, le cloner
 * pour contribuer), les contributions restent BIENVENUES, mais il n'est plus
 * sous licence libre. Toute réutilisation (déploiement, reprise dans un autre
 * projet) passe par une autorisation écrite.
 *
 * Le dépôt disait le contraire à six endroits à la fois : `LICENSE` (AGPL-3.0
 * intégrale), `package.json`, le README (« Monter votre propre tremplin »),
 * `CONTRIBUTING.md`, `TRADEMARK.md` (« le code est à tout le monde ») et DEUX
 * e-mails envoyés aux membres (« le site est open source »). Une seule de ces
 * six lignes laissée en arrière et la promesse faite au lecteur redevient
 * fausse — d'où ce test, qui les tient ensemble.
 *
 * CE QUE CE TEST NE JUGE PAS : la valeur juridique du texte de `LICENSE`, ni la
 * visibilité du dépôt sur GitHub (un réglage, pas un fichier).
 */
const RACINE = process.cwd();

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf8");
}

const DOCS_DE_LICENCE = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "TRADEMARK.md",
  "package.json",
] as const;

/** Les e-mails partent chez les membres : ce qu'ils promettent nous engage. */
const EMAILS_TRANSACTIONNELS = [
  "src/lib/invitation-email.ts",
  "src/lib/tremplin-email.ts",
] as const;

describe("licence : le dépôt dit partout la même chose", () => {
  for (const chemin of DOCS_DE_LICENCE) {
    it(`${chemin} ne renvoie plus à l'AGPL`, () => {
      expect(lire(chemin)).not.toMatch(/AGPL|Affero/i);
    });
  }

  it("package.json déclare une licence propriétaire", () => {
    const pkg = JSON.parse(lire("package.json")) as { license?: string };
    expect(pkg.license).toBe("UNLICENSED");
  });

  it("LICENSE réserve les droits et nomme la porte d'entrée : l'autorisation écrite", () => {
    const licence = lire("LICENSE");
    expect(licence).toMatch(/[Tt]ous droits réservés/);
    expect(licence).toMatch(/autorisation écrite/);
  });

  it("LICENSE dit ce que devient une contribution (sans quoi contribuer est un flou)", () => {
    expect(lire("LICENSE")).toMatch(/contribution/i);
  });

  for (const chemin of ["README.md", "CONTRIBUTING.md"] as const) {
    it(`${chemin} accueille toujours les contributions`, () => {
      expect(lire(chemin)).toMatch(/contribution/i);
    });
  }

  for (const chemin of EMAILS_TRANSACTIONNELS) {
    it(`${chemin} ne promet plus un site « open source » aux membres`, () => {
      expect(lire(chemin)).not.toMatch(/open.?source/i);
    });
  }
});
