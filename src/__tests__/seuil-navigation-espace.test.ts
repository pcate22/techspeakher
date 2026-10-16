import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * UN SEUL point de rupture pour les deux navigations de l'espace : le rail
 * (bureau) paraît exactement là où la barre d'onglets (mobile) disparaît.
 *
 * Ce qui l'a imposé (2026-10-15) : le correctif de l'en-tête a fait passer la
 * barre de `lg:hidden` à `xl:hidden` pendant que le rail, écrit en parallèle,
 * paraissait à `lg:block`. Fusionnés, entre 1 024 et 1 279 px, les deux
 * navigations s'affichaient ensemble — sans qu'aucun test ne tombe : chacune
 * était juste, seul leur ACCORD était faux. On lit donc les deux sources.
 */
const source = (f: string) => readFileSync(f, "utf8");

const seuilMasque = (code: string) => code.match(/\b(sm|md|lg|xl|2xl):hidden\b/)?.[1];
const seuilAffiche = (code: string) => code.match(/\b(sm|md|lg|xl|2xl):block\b/)?.[1];

describe("navigation de l'espace — un seul point de rupture", () => {
  const barre = seuilMasque(source("src/components/BottomNav.tsx"));
  const rail = seuilAffiche(source("src/components/RailEspace.tsx"));
  const coquille = source("src/components/CoquilleEspace.tsx");

  it("les deux seuils se lisent (garde-fou jamais à vide)", () => {
    expect(barre).toBeDefined();
    expect(rail).toBeDefined();
  });

  it("le rail paraît au seuil où la barre basse disparaît", () => {
    expect(rail).toBe(barre);
  });

  it("la coquille passe en colonnes, réserve la place du rail et le range à gauche au même seuil", () => {
    expect(coquille).toContain(`${barre}:flex`);
    expect(coquille).toContain(`${barre}:block`);
    expect(coquille).toContain(`${barre}:order-first`);
  });
});
