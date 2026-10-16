import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PucesVue from "@/components/PucesVue";

afterEach(cleanup);

/**
 * Les PUCES de filtre de « À faire » — un composant NEUF (conception D4).
 *
 * Ni `ChipGroup` (des `<span>` décoratifs, sans `href`, et son fichier est dans
 * la liste gelée du cliquet typographique), ni `BandeauVue` (un retour, pas un
 * choix). Ce qui se juge ici :
 *
 * - des LIENS : le filtre vit dans l'URL, il se partage, se recharge, revient
 *   avec le bouton Retour — et la liste est filtrable sans JS ;
 * - `aria-current="page"` sur la puce active — `page` et non `true`, parce que
 *   le `href` d'une puce active EST l'URL affichée, requête comprise ;
 * - « Tout » pointe la page SANS paramètre, sinon l'identité ne colle plus ;
 * - un `<ul aria-label="Filtrer">`, jamais un `<nav>` : un second repère de
 *   navigation encombrerait la liste qui sert à sauter (R8) ;
 * - l'état actif est doublé par la FORME (aplat plein vs contour), jamais par
 *   la seule teinte — jugé ici par les classes, et par axe en E2E.
 */

const VUES_ESSAI = [
  { cle: "personnel", titre: "Pour moi" },
  { cle: "association", titre: "Pour l'association" },
];

const rendu = (active: string | null) =>
  render(<PucesVue base="/mon-espace/a-faire" vues={VUES_ESSAI} active={active} />);

describe("PucesVue — le filtre est une navigation", () => {
  it("des liens, dans une liste étiquetée « Filtrer » — jamais un nav", () => {
    rendu(null);
    const liste = screen.getByRole("list", { name: "Filtrer" });
    expect(liste.tagName).toBe("UL");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("« Tout » d'abord, vers la page SANS paramètre ; chaque vue vers ?vue=", () => {
    rendu(null);
    const [tout, moi, assoc] = screen.getAllByRole("link");
    expect(tout).toHaveTextContent("Tout");
    expect(tout).toHaveAttribute("href", "/mon-espace/a-faire");
    expect(moi).toHaveAttribute("href", "/mon-espace/a-faire?vue=personnel");
    expect(assoc).toHaveAttribute("href", "/mon-espace/a-faire?vue=association");
  });

  it("sans vue active, « Tout » porte aria-current=page — et lui seul", () => {
    rendu(null);
    expect(screen.getByRole("link", { name: "Tout" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Pour moi" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("avec une vue active, SA puce porte aria-current=page — et elle seule", () => {
    rendu("association");
    expect(screen.getByRole("link", { name: "Pour l'association" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tout" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Pour moi" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("l'état actif se voit par la FORME : aplat plein contre contour", () => {
    rendu("association");
    const active = screen.getByRole("link", { name: "Pour l'association" });
    const repos = screen.getByRole("link", { name: "Pour moi" });
    // Aplat plein : un fond opaque, aucune bordure. Contour : une bordure,
    // aucun fond opaque. Deux formes, pas deux teintes (WCAG 1.4.1).
    expect(active.className).toMatch(/\bbg-cyan\b/);
    expect(active.className).not.toMatch(/\bborder\b/);
    expect(repos.className).toMatch(/\bborder\b/);
    expect(repos.className).not.toMatch(/\bbg-cyan\b/);
  });

  it("le contour au repos tient le seuil 1.4.11 : cyan/50, jamais cyan/30", () => {
    // cyan/30 donne 2,13:1 — la moitié du seuil (3:1) pour un composant
    // d'interface. Mesuré à la conception (R3).
    rendu(null);
    const repos = screen.getByRole("link", { name: "Pour moi" });
    expect(repos.className).toMatch(/border-cyan\/50/);
    expect(repos.className).not.toMatch(/border-cyan\/30/);
  });

  it("chaque puce offre une cible d'au moins 44 px", () => {
    rendu(null);
    for (const lien of screen.getAllByRole("link")) {
      expect(lien.className).toMatch(/min-h-\[44px\]/);
    }
  });
});
