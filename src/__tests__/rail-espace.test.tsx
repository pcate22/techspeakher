import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Le rail de l'espace connecté sur grand écran (refonte de la navigation
 * connectée, maquette validée le 2026-10-15). Avant lui, la barre basse était
 * masquée dès `lg` et RIEN ne la remplaçait : sur bureau, l'espace n'avait
 * aucune navigation propre, seulement le menu du compte (trois liens).
 *
 * Ce banc garde ce qui a été validé :
 * - le geste n° 1 en tête, en bouton : « Ajouter un talk » (ou « Créer ma
 *   fiche » quand il n'y a pas de fiche — jamais de CTA impossible) ;
 * - « Ma fiche » en PREMIÈRE destination, à un clic ;
 * - les mêmes destinations que la barre basse, plus Messages (la place ne
 *   manque pas sur bureau) ;
 * - un groupe « Organisation » pour les seules orgas ;
 * - un seul « vous êtes ici », avec la même règle que la barre basse.
 */

let cheminCourant = "/mon-espace";
vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));

import RailEspace from "@/components/RailEspace";
import type { FeuilleDonnees } from "@/lib/feuille-creer";

afterEach(() => {
  cleanup();
  cheminCourant = "/mon-espace";
});

const MEMBRE: FeuilleDonnees = { talks: [], creation: "talk", orga: false, editions: [] };
const ORGA: FeuilleDonnees = { ...MEMBRE, orga: true };

function rail(feuille: FeuilleDonnees = MEMBRE, attend = false) {
  render(<RailEspace feuille={feuille} attend={attend} />);
  return screen.getByRole("navigation", { name: "Mon espace" });
}

const destinations = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole("link")
    .map((l) => [l.textContent, l.getAttribute("href")]);

describe("RailEspace — le geste n° 1 en tête", () => {
  it("avec une fiche : « Ajouter un talk » en premier, vers le formulaire de talk", () => {
    const nav = rail();
    expect(destinations(nav)[0]).toEqual(["Ajouter un talk", "/mon-espace/talks/nouveau"]);
  });

  // Sans fiche, le geste mène à la même page que « Ma fiche » : deux portes
  // vers un même lieu, l'une de trop (revue UX du 2026-10-15). « Ma fiche »
  // reste, en tête.
  it("sans fiche, compte éligible : pas de bouton de tête, « Ma fiche » mène à l'assistant", () => {
    const nav = rail({ ...MEMBRE, creation: "fiche" });
    expect(destinations(nav)[0]).toEqual(["Ma fiche", "/mon-espace/fiche"]);
    expect(within(nav).queryByRole("link", { name: /ajouter un talk/i })).toBeNull();
  });

  it("sur le formulaire de talk lui-même, le bouton de tête s'efface (un CTA par écran)", () => {
    cheminCourant = "/mon-espace/talks/nouveau";
    const nav = rail();
    expect(within(nav).queryByRole("link", { name: "Ajouter un talk" })).toBeNull();
  });

  it("aucune création possible : ni bouton de tête, ni « Ma fiche » (jamais de CTA impossible)", () => {
    const nav = rail({ ...MEMBRE, creation: null });
    expect(destinations(nav)[0]).toEqual(["Accueil", "/mon-espace"]);
    expect(within(nav).queryByRole("link", { name: "Ma fiche" })).toBeNull();
  });
});

describe("RailEspace — les destinations", () => {
  it("membre : Ma fiche d'abord, puis la barre basse, Messages, Mon profil et Réglages", () => {
    const nav = rail();
    expect(destinations(nav)).toEqual([
      ["Ajouter un talk", "/mon-espace/talks/nouveau"],
      ["Ma fiche", "/mon-espace/fiche"],
      ["Accueil", "/mon-espace"],
      ["Agenda", "/mon-espace/agenda"],
      ["À faire", "/mon-espace/a-faire"],
      ["Messages", "/mon-espace/messages"],
      ["Mon profil", "/mon-espace/profil"],
      ["Réglages", "/mon-espace/reglages"],
    ]);
    // « Créer » ouvre la même feuille que le ➕ de la barre basse.
    expect(within(nav).getByRole("button", { name: /créer/i })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });

  it("membre : aucun groupe Organisation", () => {
    const nav = rail();
    expect(within(nav).queryByRole("group", { name: "Organisation" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /admin/i })).toBeNull();
  });

  // Un GROUPE nommé, pas un titre : le rail précède le <h1> de chaque page,
  // un <h2> y casserait l'ordre des titres (RGAA 9.1).
  it("orga : un groupe nommé « Organisation », vers l'espace organisatrices", () => {
    const nav = rail(ORGA);
    const groupe = within(nav).getByRole("group", { name: "Organisation" });
    expect(
      within(groupe)
        .getAllByRole("link")
        .map((l) => [l.textContent, l.getAttribute("href")]),
    ).toEqual([
      ["Speakeuses", "/admin/speakeuses"],
      ["Conférences", "/admin/conferences"],
      ["Tremplins", "/admin/tremplins"],
      ["Espace organisatrices", "/admin"],
    ]);
  });
});

describe("RailEspace — un seul « vous êtes ici »", () => {
  const courants = (nav: HTMLElement) =>
    within(nav)
      .getAllByRole("link")
      .filter((l) => l.hasAttribute("aria-current"))
      .map((l) => [l.textContent, l.getAttribute("aria-current")]);

  it.each([
    ["/mon-espace", "Accueil", "page"],
    ["/mon-espace/fiche", "Ma fiche", "page"],
    // Le détail d'une section de la fiche reste dans « Ma fiche ».
    ["/mon-espace/fiche/identite", "Ma fiche", "true"],
    ["/mon-espace/talks/12", "Ma fiche", "true"],
    ["/mon-espace/agenda", "Agenda", "page"],
    ["/mon-espace/a-faire", "À faire", "page"],
    ["/mon-espace/messages", "Messages", "page"],
    ["/mon-espace/profil", "Mon profil", "page"],
    ["/mon-espace/reglages", "Réglages", "page"],
    // Ni la fiche ni le profil : le « moi » sans entrée propre se range sous
    // Mon profil, d'où on y entre.
    ["/mon-espace/coaching", "Mon profil", "true"],
    ["/mon-espace/connexions", "Mon profil", "true"],
  ])("sur %s, seul « %s » est courant (%s)", (chemin, libelle, valeur) => {
    cheminCourant = chemin;
    expect(courants(rail())).toEqual([[libelle, valeur]]);
  });

  it.each([
    ["/admin/speakeuses", "Speakeuses", "page"],
    ["/admin/speakeuses/12", "Speakeuses", "true"],
    ["/admin/conferences", "Conférences", "page"],
    ["/admin/tremplins/5/ateliers", "Tremplins", "true"],
    ["/admin", "Espace organisatrices", "page"],
    ["/admin/messages", "Espace organisatrices", "true"],
  ])("orga, sur %s, seul « %s » est courant (%s)", (chemin, libelle, valeur) => {
    cheminCourant = chemin;
    expect(courants(rail(ORGA))).toEqual([[libelle, valeur]]);
  });

  it("le bouton de tête n'est jamais « courant » : c'est une action, pas un lieu", () => {
    cheminCourant = "/mon-espace/talks/12";
    const nav = rail();
    expect(within(nav).getByRole("link", { name: "Ajouter un talk" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("RailEspace — le point de « À faire »", () => {
  it("quelque chose attend : le nom le dit, libellé visible en tête", () => {
    const nav = rail(MEMBRE, true);
    expect(within(nav).getByRole("link", { name: /À faire/ })).toHaveAccessibleName(
      "À faire, quelque chose attend",
    );
  });

  it("rien : le nom redevient « À faire »", () => {
    const nav = rail(MEMBRE, false);
    expect(within(nav).getByRole("link", { name: /À faire/ })).toHaveAccessibleName("À faire");
  });
});
