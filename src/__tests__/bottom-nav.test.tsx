import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Barre d'onglets basse CANONIQUE (conception N1 §2.3, révisée à l'étape B) :
 * LA MÊME pour tous les rôles — `Accueil · Agenda · ➕ · À faire · [ma photo]`.
 *
 * L'onglet-photo s'appelle « Ma fiche » et mène À la fiche depuis le
 * 2026-10-15 (refonte de la navigation connectée) : mettre sa fiche à jour est
 * LE geste du produit, il coûtait deux taps et une rangée à trouver. Le reste
 * du « moi » (messages, réglages, portes de rôle) vit sur « Mon profil »,
 * atteint par la fiche et par le menu du compte.
 * La stabilité de la barre est l'identité du produit : le travail de rôle vit
 * en rangées sur la page « Mon profil », plus jamais en onglets variables.
 *
 * L'onglet 4 était « Messages » : une boîte qu'on ouvrait pour rien la plupart
 * des jours. « À faire » est la destination d'étape B — et les messages
 * restent atteignables par la rangée « Mes messages » du profil, livrée AVANT
 * ce changement précisément pour ça (D6).
 */

let cheminCourant = "/mon-espace";
vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));

import BottomNav from "@/components/BottomNav";
import type { FeuilleDonnees } from "@/lib/feuille-creer";

afterEach(() => {
  cleanup();
  cheminCourant = "/mon-espace";
});

const FEUILLE: FeuilleDonnees = { talks: [], creation: "talk", orga: false, editions: [] };

function barre(feuille: FeuilleDonnees = FEUILLE, attend = false) {
  render(<BottomNav nom="Cateline Puccetti" image={null} feuille={feuille} attend={attend} />);
  return screen.getByRole("navigation", { name: "Mon espace" });
}

describe("BottomNav — la barre canonique, identique pour tous les rôles", () => {
  it("quatre destinations fixes + le bouton Créer au centre", () => {
    const nav = barre();
    const liens = within(nav)
      .getAllByRole("link")
      .map((l) => [l.textContent, l.getAttribute("href")]);
    // Les pictogrammes sont des SVG muets (B4) : le textContent est le seul
    // libellé — un emoji, dont le dessin change d'un téléphone à l'autre,
    // n'entre plus dans la barre.
    expect(liens).toEqual([
      ["Accueil", "/mon-espace"],
      ["Agenda", "/mon-espace/agenda"],
      ["À faire", "/mon-espace/a-faire"],
      // L'onglet-photo : l'avatar (initiales) + le libellé visible « Ma fiche ».
      ["CPMa fiche", "/mon-espace/fiche"],
    ]);
    expect(
      within(nav).getByRole("button", { name: /créer/i }),
    ).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("orga : la barre est EXACTEMENT la même (le rôle vit sur le profil)", () => {
    const nav = barre({ talks: [], creation: "talk", orga: true, editions: [{ id: 5, nom: "TSH 2026" }] });
    const labels = within(nav)
      .getAllByRole("link")
      .map((l) => l.textContent);
    expect(labels).toEqual(["Accueil", "Agenda", "À faire", "CPMa fiche"]);
  });
});

describe("BottomNav — sans fiche possible", () => {
  // `creation: null` = ni fiche ni fiche possible (genre « homme ») : l'onglet
  // garde la photo, mais dit et mène là où la personne a quelque chose.
  it("l'onglet-photo devient « Mon profil », vers le profil", () => {
    const nav = barre({ talks: [], creation: null, orga: false, editions: [] });
    expect(within(nav).getAllByRole("link").at(-1)).toHaveAttribute("href", "/mon-espace/profil");
    expect(within(nav).getAllByRole("link").at(-1)).toHaveAccessibleName("Mon profil");
  });
});

describe("BottomNav — onglet actif (aria-current, préfixe le plus spécifique)", () => {
  it("sur /mon-espace, seul Accueil est courant (correspondance exacte)", () => {
    cheminCourant = "/mon-espace";
    barre();
    expect(screen.getByRole("link", { name: /Accueil/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Agenda/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("sur /mon-espace/agenda, Agenda est courant, Accueil ne l'est plus", () => {
    cheminCourant = "/mon-espace/agenda";
    barre();
    expect(screen.getByRole("link", { name: /Agenda/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Accueil/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("sur /mon-espace/fiche, Ma fiche est LA page courante (`aria-current=\"page\"`)", () => {
    cheminCourant = "/mon-espace/fiche";
    barre();
    expect(screen.getByRole("link", { name: /Ma fiche/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  /**
   * `aria-current="page"` veut dire « CE lien mène à la page où vous êtes ».
   * Dans les sections de la fiche et les talks, l'onglet reste allumé mais son
   * lien mène à la fiche entière : `true`, « élément courant d'un ensemble »
   * (relecture RGAA du 2026-08-16).
   */
  it("une section de la fiche, un talk : Ma fiche reste courante, `aria-current=\"true\"`", () => {
    for (const chemin of [
      "/mon-espace/fiche/identite",
      "/mon-espace/talks",
      "/mon-espace/talks/12",
      "/mon-espace/talks/nouveau",
    ]) {
      cheminCourant = chemin;
      barre();
      expect(
        screen.getByRole("link", { name: /Ma fiche/ }),
        chemin,
      ).toHaveAttribute("aria-current", "true");
      cleanup();
    }
  });

  /**
   * TRANCHÉ par Cateline le 2026-10-15 : « Ma fiche » ne s'allume QUE sur la
   * fiche et les talks. Le repli d'avant (audit 2026-08-15, C5) l'allumait
   * dans tout `/mon-espace` et `/admin` — sous le nom « Profil », c'était
   * vrai ; sous « Ma fiche », un lecteur d'écran annonçait « Ma fiche,
   * élément courant » dans les réglages ou l'espace organisatrices, ce qui est
   * faux (COGA : le possessif doit être vrai). Ailleurs, RIEN ne s'allume :
   * aucun onglet ne dit la vérité, mieux vaut n'en annoncer aucun. Sur bureau,
   * le rail allume l'entrée exacte.
   */
  it("hors de la fiche et des talks, aucun onglet ne s'allume", () => {
    for (const chemin of [
      "/mon-espace/profil",
      "/mon-espace/reglages",
      "/mon-espace/messages",
      "/mon-espace/coaching",
      "/mon-espace/documents",
      "/mon-espace/tremplin/3",
      "/mon-espace/connexions",
      "/admin",
      "/admin/messages",
      "/admin/tremplins/5/ateliers",
    ]) {
      cheminCourant = chemin;
      const nav = barre({ talks: [], creation: "talk", orga: true, editions: [] });
      const courants = within(nav)
        .getAllByRole("link")
        .filter((l) => l.hasAttribute("aria-current"));
      expect(courants, chemin).toEqual([]);
      cleanup();
    }
  });

  it("sur /mon-espace/a-faire, « À faire » est LA page courante — pas le repli Ma fiche", () => {
    cheminCourant = "/mon-espace/a-faire";
    barre();
    expect(screen.getByRole("link", { name: /À faire/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Ma fiche/ }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

/**
 * LE POINT de l'onglet « À faire » (conception D3/B3, révisée le 2026-08-17).
 *
 * Un point, pas un compteur : « 3 » et « il y a quelque chose » déclenchent la
 * même décision sur les volumes du produit. Ce que ce banc garde :
 *
 * - le signal entre dans le NOM ACCESSIBLE, libellé visible EN TÊTE
 *   (WCAG 2.5.3 : « cliquer À faire » à la voix doit continuer de marcher) —
 *   jamais une pastille de couleur seule ;
 * - à zéro, RIEN : le nom redevient « À faire », aucun résidu ;
 * - le point est muet (`aria-hidden`) : son sens passe par le nom.
 */
describe("BottomNav — le point de « À faire »", () => {
  const ongletAFaire = () => screen.getByRole("link", { name: /À faire/ });

  it("quelque chose attend : le nom le dit, libellé visible en tête", () => {
    barre(FEUILLE, true);
    expect(ongletAFaire()).toHaveAccessibleName("À faire, quelque chose attend");
  });

  it("le point se voit, dans la boîte de l'onglet, et reste muet", () => {
    const nav = barre(FEUILLE, true);
    const point = within(nav).getByTestId("point-onglet");
    expect(point).toHaveAttribute("aria-hidden", "true");
    // DANS la boîte de l'onglet (R6) : aucun décalage négatif qui
    // franchirait le bord du <nav> — `--hauteur-onglets` est la source
    // unique du dégagement du pied (WCAG 2.4.11).
    expect(ongletAFaire().contains(point)).toBe(true);
  });

  it("rien à faire : le nom redevient « À faire », et aucun point", () => {
    const nav = barre(FEUILLE, false);
    expect(ongletAFaire()).toHaveAccessibleName("À faire");
    // Aucun aria-label résiduel : au repos le nom vient du CONTENU — un
    // aria-label qui recopie le libellé donnerait le même nom aujourd'hui,
    // et un nom divergent le jour où le contenu bouge sans lui.
    expect(ongletAFaire()).not.toHaveAttribute("aria-label");
    expect(within(nav).queryByTestId("point-onglet")).toBeNull();
  });

  it("les pictogrammes sont des SVG muets — le libellé visible reste le nom", () => {
    const nav = barre();
    // Exactement trois : le ➕ de FeuilleCreer est un « + » textuel, l'avatar
    // des initiales — un quatrième SVG serait un onglet qui change de famille.
    expect(nav.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
    expect(nav.querySelectorAll("svg:not([aria-hidden])")).toHaveLength(0);
  });
});
