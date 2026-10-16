// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  NOUVEAUTES_PLATEFORME,
  CAMPAGNE_NOUVEAUTES,
} from "@/data/nouveautes-plateforme";

/**
 * Les captures de l'e-mail, dans les DEUX sens (même garde-fou que les logos de
 * conférences) : une capture déclarée sans fichier partirait en image cassée
 * dans des centaines de boîtes, et un fichier orphelin traînerait dans le dépôt
 * après un changement de copie. Rien de tout ça ne se rattrape après l'envoi.
 */
describe("captures de l'annonce des nouveautés", () => {
  const declarees = NOUVEAUTES_PLATEFORME.map((n) => n.image).filter(
    (i): i is string => i !== null,
  );

  it("chaque capture déclarée existe dans public/", () => {
    for (const image of declarees) {
      expect(existsSync(join("public", image)), `capture absente : ${image}`).toBe(true);
    }
  });

  it("chaque capture porte une alternative textuelle", () => {
    for (const n of NOUVEAUTES_PLATEFORME) {
      if (n.image) expect(n.alt.trim().length, `alt vide : ${n.titre}`).toBeGreaterThan(0);
    }
  });

  it("le dossier de la campagne ne garde aucun fichier orphelin", () => {
    const dossiers = new Set(declarees.map((i) => dirname(join("public", i))));
    for (const dossier of dossiers) {
      for (const fichier of readdirSync(dossier)) {
        const chemin = join(dossier, fichier);
        expect(
          declarees.some((i) => join("public", i) === chemin),
          `fichier orphelin : ${chemin}`,
        ).toBe(true);
      }
    }
  });

  it("les captures vivent dans le dossier de LA campagne en cours", () => {
    for (const image of declarees) {
      expect(image).toContain(CAMPAGNE_NOUVEAUTES);
    }
  });
});
