import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  PARTICIPANTE_SOUS_PAGES,
  ATELIER_SOUS_PAGES,
  RECOMPENSE_SOUS_PAGES,
} from "@/app/admin/tremplins/[edition]/fil-sous-pages";

/**
 * Garde anti-dérive : les libellés du fil (FilEntite) doivent couvrir EXACTEMENT
 * les dossiers de sous-pages réels. Ajouter une sous-page sans libellé ferait
 * disparaître silencieusement son niveau dans le fil ; en retirer une sans
 * nettoyer le map laisserait un libellé mort. Ce test attrape les deux.
 */
function sousDossiers(rel: string): string[] {
  return readdirSync(resolve(process.cwd(), rel), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

describe("fil-sous-pages — libellés ↔ dossiers réels", () => {
  it("participante : les clés couvrent exactement les sous-pages", () => {
    const dossiers = sousDossiers(
      "src/app/admin/tremplins/[edition]/participantes/[registration]",
    );
    expect(Object.keys(PARTICIPANTE_SOUS_PAGES).sort()).toEqual(dossiers);
  });

  it("atelier : les clés couvrent exactement les sous-pages", () => {
    const dossiers = sousDossiers(
      "src/app/admin/tremplins/[edition]/ateliers/[atelier]",
    );
    expect(Object.keys(ATELIER_SOUS_PAGES).sort()).toEqual(dossiers);
  });

  it("récompense : les clés couvrent exactement les sous-pages", () => {
    const dossiers = sousDossiers(
      "src/app/admin/tremplins/[edition]/recompenses/[recompense]",
    );
    expect(Object.keys(RECOMPENSE_SOUS_PAGES).sort()).toEqual(dossiers);
  });
});
