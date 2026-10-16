import { describe, it, expect } from "vitest";
import { navLinks, tousLesLiensNav } from "@/constants/navigation";

describe("Navigation", () => {
  it("tous les liens commencent par /", () => {
    for (const item of navLinks) {
      expect(item.href).toMatch(/^\//);
    }
  });

  it("pas de doublons de href", () => {
    const hrefs = navLinks.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("pas de doublons de label", () => {
    const labels = navLinks.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("contient les pages essentielles", () => {
    // Premier niveau ET menu « Nous rejoindre » (2026-10-15).
    const hrefs = tousLesLiensNav.map((i) => i.href);
    expect(hrefs).toContain("/speakeuses");
    expect(hrefs).toContain("/actualites");
    // Nos soutiens ont pris la place du contact dans l'en-tête (2026-10-15) ;
    // le contact reste au pied de page, long ET court (footer-coquille-app).
    expect(hrefs).toContain("/partenaires");
    // Le Tremplin est un lien de menu comme un autre (plus un CTA global).
    expect(hrefs).toContain("/tremplin");
  });

  it("« À propos » vit au pied de page, l'annuaire s'appelle « Speakeuses » (2026-10-15)", () => {
    // Une page qu'on lit une fois, pas un lieu où l'on revient : le footer la
    // porte (footer-coquille-app), l'en-tête garde sa place pour l'usage.
    expect(navLinks.map((i) => i.href)).not.toContain("/a-propos");
    expect(navLinks.find((i) => i.href === "/speakeuses")?.label).toBe("Speakeuses");
  });
});
