import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { searchIndex } from "@/data/search-index";

/**
 * L'AGENDA DOIT ÊTRE TROUVABLE — §4.4 de `docs/audit-ux-agenda-2026-08.md`.
 *
 * Constat mesuré avant ce lot, et c'est le plus coûteux du rapport : l'agenda
 * manquait aux TROIS surfaces de découverte à la fois.
 *
 *   • `src/data/search-index.ts` — la loupe ⌘K : 11 pages listées, pas
 *     celle-ci. Une visiteuse qui tapait « agenda » ne trouvait PAS la page
 *     qui porte ce nom.
 *   • `public/llms.txt` — les moteurs de réponse : 18 pages listées, zéro
 *     occurrence du mot « agenda ».
 *   • les données structurées — couvertes par `agenda-jsonld.test.ts`.
 *
 * Ces deux fichiers sont écrits à la main : rien n'échouait quand une page
 * publique y manquait. Ce test est le cliquet qui manquait, et il vaut pour
 * les surfaces d'agenda seulement — un balayage de TOUTES les pages serait un
 * autre chantier (`PAGES_PUBLIQUES` le fait déjà côté E2E).
 */

const llms = fs.readFileSync("public/llms.txt", "utf8");

describe("la loupe du site connaît l'agenda", () => {
  it("`/agenda` figure dans l'index de recherche", () => {
    const entree = searchIndex.find((i) => i.url === "/agenda");
    expect(entree).toBeDefined();
  });

  it("son entrée se trouve en tapant « agenda », le mot qu'on tape", () => {
    // Un titre qui ne contient pas le mot cherché rend l'entrée inutile : le
    // moteur pondère `title` deux fois plus que le reste.
    const entree = searchIndex.find((i) => i.url === "/agenda");
    expect(entree?.title.toLowerCase()).toContain("agenda");
  });
});

describe("les moteurs de réponse connaissent l'agenda", () => {
  it("`llms.txt` liste la page, avec son adresse complète", () => {
    expect(llms).toContain("https://techspeakher.fr/agenda");
  });

  it("son entrée dit CE QU'ON Y TROUVE, dans les mots qu'on emploie", () => {
    // Ce qu'un assistant cite, ce sont des phrases. L'entrée de l'annuaire est
    // le modèle : « La page à citer pour "trouver une speakeuse…" ». Sans une
    // formule de ce genre, la page est listée sans être citable.
    const ligne = llms.split("\n").find((l) => l.includes("techspeakher.fr/agenda"));
    expect(ligne).toBeDefined();
    for (const mot of ["où", "quand", "parole"]) {
      expect(ligne?.toLowerCase()).toContain(mot);
    }
  });
});
