import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Le pied de page dans la COQUILLE D'APP (audit 2026-08-15, C10).
 *
 * Sur `/mon-espace/**` et `/admin/**`, l'écran a déjà une barre d'onglets ET
 * un burger dont le seul rôle est d'aller au site : le pied public complet
 * (quatre colonnes, ~17 liens) y occupait environ un tiers de la hauteur,
 * entre « Se déconnecter » et la barre.
 *
 * Ce qu'on NE fait pas : rendre les deux pieds et en masquer un en CSS —
 * c'est le « masqué à l'œil, gardé au clavier » du registre des erreurs
 * (des liens hors écran mais dans le parcours de tabulation).
 *
 * Ce qu'on vérifie ici, et qui est non négociable : la variante courte garde
 * les destinations qui n'existent NULLE PART ailleurs. Le burger ne porte que
 * `navLinks` — mentions légales et code de conduite ne vivent que dans ce
 * pied.
 */

let cheminCourant = "/";
vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));

import Footer from "@/components/Footer";
import { HELLOASSO_SOUTIEN_URL } from "@/constants/site";

afterEach(cleanup);
beforeEach(() => {
  cheminCourant = "/";
});

const pied = () => {
  render(<Footer />);
  return screen.getByRole("contentinfo");
};

const adresses = (racine: HTMLElement) =>
  within(racine)
    .getAllByRole("link")
    .map((l) => l.getAttribute("href"));

describe("Footer — sur le site public", () => {
  it("garde ses colonnes complètes", () => {
    const f = pied();
    expect(adresses(f)).toEqual(
      expect.arrayContaining(["/a-propos", "/speakeuses", "/agenda", "/partenaires"]),
    );
    expect(within(f).getByRole("heading", { name: /le site/i })).toBeInTheDocument();
  });
});

describe("Footer — dans la coquille d'app", () => {
  const cheminsApp = ["/mon-espace", "/mon-espace/profil", "/admin", "/admin/tremplins"];

  it("s'allège : les colonnes du site partent (elles vivent dans le burger)", () => {
    for (const chemin of cheminsApp) {
      cheminCourant = chemin;
      const f = pied();
      expect(within(f).queryByRole("heading", { name: /le site/i }), chemin).toBeNull();
      expect(adresses(f), chemin).not.toContain("/conferences");
      cleanup();
    }
  });

  it("garde ce qui n'existe nulle part ailleurs : mentions légales, code de conduite, partenaires", () => {
    for (const chemin of cheminsApp) {
      cheminCourant = chemin;
      const f = pied();
      // La variante COURTE — sans ce constat, l'assertion passait aussi sur le
      // pied complet, qui contient évidemment ces liens (relecture 2026-08-16).
      expect(adresses(f).length, chemin).toBeLessThan(7);
      expect(adresses(f), chemin).toEqual(
        expect.arrayContaining([
          "/mentions-legales",
          "/code-de-conduite",
          // Porte de financement de l'association, gardée ici même si le
          // burger la porte aussi (`navRejoindre`, 2026-10-15) : c'est la plus
          // importante des pages pour l'association.
          "/partenaires",
          // Le contact a quitté `navLinks`, donc le burger : sans ce lien, il
          // serait injoignable depuis l'espace connecté.
          "/contact",
          // « À propos » a quitté `navLinks` à son tour (2026-10-15) : même
          // raison, même place.
          "/a-propos",
        ]),
      );
      cleanup();
    }
  });

  it("le pied complet a sa colonne « Nous soutenir » : partenaires, soutien HelloAsso, adhésion, bénévolat, kit", () => {
    cheminCourant = "/";
    const f = pied();
    const colonne = within(f).getByRole("list", { name: "Nous soutenir" });
    const liens = within(colonne).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(liens).toEqual([
      "/partenaires",
      HELLOASSO_SOUTIEN_URL,
      "/adherer",
      // Le bénévolat a sa page depuis le 2026-10-15 : on donne du temps
      // comme on donne de l'argent.
      "/benevole",
      "/kit-de-communication",
    ]);
  });

  it("l'année et le nom restent séparés, sur les deux variantes (« © 2026Tech » vu le 15/10)", () => {
    for (const chemin of ["/", "/mon-espace/profil"]) {
      cheminCourant = chemin;
      const f = pied();
      expect(f.textContent, chemin).toMatch(/© \d{4}\u00A0Tech\u00A0Speak'Her/);
      cleanup();
    }
  });

  it("reste un vrai `contentinfo`, et dit toujours l'association", () => {
    cheminCourant = "/mon-espace/profil";
    const f = pied();
    expect(f.textContent).toMatch(/Tech.Speak'Her/);
  });

  it("ne cache jamais un lien : ce qui part du pied court n'est PAS dans le DOM", () => {
    // La faute à ne pas commettre : `sr-only`/`hidden` sur les colonnes, qui
    // laisserait ~13 liens dans le parcours clavier, hors écran.
    cheminCourant = "/mon-espace/profil";
    const f = pied();
    expect(adresses(f).length).toBeLessThan(6);
  });
});
