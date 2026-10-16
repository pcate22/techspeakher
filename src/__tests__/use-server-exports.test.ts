import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Un fichier "use server" n'exporte QUE des fonctions async (et des types).
 *
 * Next 16 refuse le reste au build (« Only async functions are allowed to be
 * exported in a "use server" file »), mais Vitest n'applique pas cette
 * transformation : une constante exportée d'un fichier d'actions passait le
 * type-check, le lint et tous les tests, puis cassait le build de production
 * (revue du 2026-10-15, `LOT_INVITATIONS`). Ce test rend la faute visible là
 * où elle s'écrit.
 */

function fichiers(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : fichiers(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

/** Le code avant la directive peut porter des commentaires (prologue valide). */
const sansPrologue = (src: string) =>
  src.replace(/^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/))*/, "");

const actions = fichiers("src").filter((f) =>
  /^\s*["']use server["']/.test(sansPrologue(fs.readFileSync(f, "utf8"))),
);

describe("fichiers \"use server\"", () => {
  it("il en existe (sinon ce test ne garde rien)", () => {
    expect(actions.length).toBeGreaterThan(5);
  });

  it.each(actions)("%s n'exporte que des fonctions async et des types", (f) => {
    const exports = fs
      .readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => /^export\s/.test(l));
    const interdits = exports.filter(
      (l) =>
        !/^export\s+(default\s+async\s+function|async\s+function|type\s|interface\s|const\s+\w+\s*=\s*async\b)/.test(
          l,
        ),
    );
    expect(interdits).toEqual([]);
  });

  it("voit la directive derrière un commentaire d'en-tête", () => {
    expect(sansPrologue('// doc\n/** bloc */\n"use server";\nexport const X = 1;')).toMatch(
      /^\s*"use server"/,
    );
  });
});

