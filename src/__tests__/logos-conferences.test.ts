import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  DOSSIER_LOGOS,
  LOGOS_CONFERENCES,
  logoConference,
} from "@/data/logos-conferences";

const dossier = path.join(process.cwd(), "public", "conferences");

describe("logoConference", () => {
  it("renvoie null sans slug (occurrence en mention libre)", () => {
    expect(logoConference(null)).toBeNull();
  });

  it("renvoie null pour une conférence sans logo déposé", () => {
    expect(logoConference("une-conf-sans-logo")).toBeNull();
  });

  it("renvoie un chemin servi par notre domaine (CSP img-src 'self')", () => {
    for (const slug of Object.keys(LOGOS_CONFERENCES)) {
      expect(logoConference(slug)).toBe(`${DOSSIER_LOGOS}/${LOGOS_CONFERENCES[slug]}`);
      expect(logoConference(slug)).toMatch(/^\/conferences\/[a-z0-9.-]+$/);
    }
  });
});

describe("déclaratif des logos ↔ fichiers de public/conferences", () => {
  // Le déclaratif est la source unique : un logo déclaré sans fichier casse
  // l'affichage (image morte au lieu du monogramme), un fichier non déclaré est
  // du poids mort jamais servi. Les deux sens sont donc vérifiés.
  it("chaque logo déclaré a son fichier", () => {
    for (const fichier of Object.values(LOGOS_CONFERENCES)) {
      expect(existsSync(path.join(dossier, fichier)), fichier).toBe(true);
    }
  });

  it("chaque fichier déposé est déclaré", () => {
    const declares = new Set(Object.values(LOGOS_CONFERENCES));
    const fichiers = readdirSync(dossier).filter((f) => f !== "README.md");
    for (const f of fichiers) {
      expect(declares.has(f), f).toBe(true);
    }
  });

  it("les slugs déclarés sont des slugs (jumeaux de ceux du registre)", () => {
    for (const slug of Object.keys(LOGOS_CONFERENCES)) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
