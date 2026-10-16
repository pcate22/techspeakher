import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFERENCES_SEED } from "@/data/conferences-seed";
import { slugifyConference } from "@/lib/conferences";

/**
 * Qualité du seed France (lot 2) : données exploitables (pays, type, URL
 * http(s)), pas de doublon de slug, et ATTRIBUTIONS présentes (developers.events
 * est en CC BY-NC 4.0 : créditer n'est pas optionnel).
 */

describe("CONFERENCES_SEED (catalogue d'amorçage)", () => {
  it("n'est pas vide : confs tech, product/UX et assos toulousaines", () => {
    expect(CONFERENCES_SEED.length).toBeGreaterThan(20);
    expect(CONFERENCES_SEED.some((c) => c.type === "conference")).toBe(true);
    expect(CONFERENCES_SEED.some((c) => c.type === "asso")).toBe(true);
    // Quelques présences attendues (sources : developers.events, Tech Hub,
    // montaine-consulting.fr).
    const noms = CONFERENCES_SEED.map((c) => c.nom);
    expect(noms).toContain("DevFest Toulouse");
    expect(noms).toContain("Devoxx France");
    expect(noms).toContain("La Product Conf");
    expect(noms).toContain("Tech Speak'Her");
  });

  /**
   * Le catalogue s'est élargi (2026-08) parce qu'une speakeuse active n'y
   * trouvait presque aucune de ses conférences : elle devait toutes les faire
   * ajouter une par une. Un catalogue qui rétrécirait ramènerait ce parcours.
   */
  it("couvre largement les conférences FR récurrentes ET l'international", () => {
    expect(CONFERENCES_SEED.length).toBeGreaterThanOrEqual(100);
    const noms = CONFERENCES_SEED.map((c) => c.nom);
    // Quelques conférences où parlent les speakeuses de la communauté.
    for (const attendu of [
      "Cloud Nord", "Volcamp", "Sud Web", "Capitole du Libre",
      "KubeCon + CloudNativeCon Europe", "Devoxx Belgium", "FOSDEM",
    ]) {
      expect(noms, attendu).toContain(attendu);
    }
    // L'international est réellement représenté (pas que de la France).
    expect(
      CONFERENCES_SEED.filter((c) => c.pays != null && c.pays !== "France").length,
    ).toBeGreaterThanOrEqual(15);
  });

  it("chaque entrée est exploitable : nom, type valide, pays, URL http(s) ou absente", () => {
    for (const c of CONFERENCES_SEED) {
      expect(c.nom.trim().length, c.nom).toBeGreaterThan(1);
      expect(c.nom.length, c.nom).toBeLessThanOrEqual(160);
      expect(["conference", "asso"], c.nom).toContain(c.type);
      // Le pays est renseigné, SAUF pour une conférence itinérante (KubeCon
      // change de pays chaque année) : mieux vaut rien à pré-remplir qu'un lieu
      // faux. Une chaîne vide, elle, reste une erreur de saisie.
      if (c.pays != null) expect(c.pays.trim(), c.nom).not.toBe("");
      if (c.ville != null) expect(c.ville.trim(), c.nom).not.toBe("");
      if (c.siteUrl != null) {
        expect(c.siteUrl, c.nom).toMatch(/^https?:\/\//);
      }
    }
  });

  it("aucun doublon de slug (dérivé du nom, même règle que le SQL)", () => {
    const slugs = CONFERENCES_SEED.map((c) => slugifyConference(c.nom));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("les attributions (CC BY-NC developers.events, MIT Tech Hub) sont dans le fichier", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/data/conferences-seed.ts"),
      "utf8",
    );
    expect(src).toContain("developers.events");
    expect(src).toContain("CC BY-NC 4.0");
    expect(src).toContain("toulouse-tech-hub");
  });
});
