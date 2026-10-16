import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * LE GARDE-FOU DU VOCABULAIRE (lot N3 §1bis, retour de Cateline du
 * 2026-08-08) : un concept = un mot, PARTOUT — « actualité » (le flux),
 * « article » (ce qui se lit chez nous), « publication » = mot TECHNIQUE
 * (type en base, URL admin), JAMAIS affiché. Ce test scanne le TEXTE RENDU
 * des composants (ce qui suit un `>` hors accolades) : un libellé qui dit
 * « publication » re-mélangerait ce que le lot vient d'unifier.
 */

const RACINES = ["src/app", "src/components"];

// Emplois LÉGITIMES du mot (autre sens, ou mot technique hors écran).
const TOLERES = [
  // Sens juridique (mentions légales) : la « directrice de la publication ».
  "src/app/mentions-legales/page.tsx",
];

function fichiersTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return fichiersTsx(f);
    return e.name.endsWith(".tsx") ? [f] : [];
  });
}

describe("vocabulaire unifié : « publication » est un mot technique, jamais un libellé", () => {
  it("aucun texte rendu ne dit « publication » (hors emplois tolérés)", () => {
    const offenders: string[] = [];
    for (const racine of RACINES) {
      for (const f of fichiersTsx(racine)) {
        if (TOLERES.some((t) => f.replaceAll("\\", "/").endsWith(t))) continue;
        const src = fs.readFileSync(f, "utf8");
        src.split("\n").forEach((ligne, i) => {
          // Texte JSX : ce qui suit une balise ouvrante/fermante, hors
          // expressions `{…}` (chaînes techniques) et hors attributs.
          const textes = ligne.match(/>([^<{}]+)/g) ?? [];
          for (const t of textes) {
            if (/publication/i.test(t)) offenders.push(`${f}:${i + 1} → ${t.trim()}`);
          }
        });
      }
    }
    expect(
      offenders,
      "Un libellé affiché dit « publication » : le vocabulaire unifié (lot N3 §1bis) " +
        "veut « actualité » ou « article » —\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
