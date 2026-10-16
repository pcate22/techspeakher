import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FeuilleCreer from "@/components/FeuilleCreer";
import type { FeuilleDonnees } from "@/lib/feuille-creer";

afterEach(cleanup);

const ouvrir = async (donnees: FeuilleDonnees) => {
  const u = userEvent.setup();
  render(<FeuilleCreer donnees={donnees} />);
  await u.click(screen.getByRole("button", { name: /créer/i }));
  return u;
};

/**
 * La feuille ➕ (conception N1 §2.4, validée) : elle RACCOURCIT vers les
 * formulaires existants, elle n'en invente aucun. Talk pour qui a une fiche,
 * « Créer ma fiche » pour qui peut en créer une ; l'orga gagne actualité et
 * atelier (choix d'édition si plusieurs actives — tranché le 2026-08-07).
 */
describe("FeuilleCreer — entrées par capacité", () => {
  it("fiche existante : « Ajouter un talk » mène au formulaire de talk", async () => {
    await ouvrir({ talks: [], creation: "talk", orga: false, editions: [] });
    expect(screen.getByRole("link", { name: /ajouter un talk/i })).toHaveAttribute(
      "href",
      "/mon-espace/talks/nouveau",
    );
    expect(screen.queryByRole("link", { name: /actualité/i })).toBeNull();
  });

  it("sans fiche mais éligible : le vrai premier pas est « Créer ma fiche speakeuse »", async () => {
    await ouvrir({ talks: [], creation: "fiche", orga: false, editions: [] });
    expect(
      screen.getByRole("link", { name: /créer ma fiche speakeuse/i }),
    ).toHaveAttribute("href", "/mon-espace/fiche");
    expect(screen.queryByRole("link", { name: /ajouter un talk/i })).toBeNull();
  });

  it("TOUTE membre écrit (lot N3, Q4) : « Écrire un article », même sans fiche ni éligibilité", async () => {
    await ouvrir({ talks: [], creation: null, orga: false, editions: [] });
    expect(
      screen.getByRole("link", { name: /écrire un article/i }),
    ).toHaveAttribute("href", "/mon-espace/articles/nouveau");
    // Talk et fiche restent gardés par la capacité.
    expect(screen.queryByRole("link", { name: /ajouter un talk/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /créer ma fiche/i })).toBeNull();
  });

  it("orga : « Ajouter une actualité » mène au formulaire existant", async () => {
    await ouvrir({ talks: [], creation: "talk", orga: true, editions: [] });
    expect(
      screen.getByRole("link", { name: /ajouter une actualité/i }),
    ).toHaveAttribute("href", "/admin/contenus/publication/nouveau");
  });

  it("orga, UNE édition active : « Ajouter un atelier » ouvre direct le formulaire de l'édition", async () => {
    await ouvrir({
      talks: [], creation: "talk",
      orga: true,
      editions: [{ id: 5, nom: "Tremplin DevFest 2026" }],
    });
    expect(
      screen.getByRole("link", { name: /ajouter un atelier/i }),
    ).toHaveAttribute("href", "/admin/tremplins/5/ateliers?creer=1");
  });

  it("orga, PLUSIEURS éditions actives : un choix d'édition s'intercale avant le formulaire", async () => {
    const u = await ouvrir({
      talks: [], creation: "talk",
      orga: true,
      editions: [
        { id: 5, nom: "Tremplin DevFest 2026" },
        { id: 8, nom: "Tremplin Capitole 2026" },
      ],
    });
    // L'entrée devient un BOUTON qui glisse vers le choix.
    await u.click(screen.getByRole("button", { name: /ajouter un atelier/i }));
    expect(
      screen.getByRole("link", { name: /tremplin devfest 2026/i }),
    ).toHaveAttribute("href", "/admin/tremplins/5/ateliers?creer=1");
    expect(
      screen.getByRole("link", { name: /tremplin capitole 2026/i }),
    ).toHaveAttribute("href", "/admin/tremplins/8/ateliers?creer=1");
    // Retour possible vers la feuille.
    await u.click(screen.getByRole("button", { name: /retour/i }));
    expect(screen.getByRole("link", { name: /ajouter un talk/i })).toBeInTheDocument();
  });

  it("orga sans édition active : l'entrée atelier s'efface (jamais de CTA impossible)", async () => {
    await ouvrir({ talks: [], creation: "talk", orga: true, editions: [] });
    expect(screen.queryByRole("button", { name: /ajouter un atelier/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /ajouter un atelier/i })).toBeNull();
  });
});

/**
 * « Ajouter une date à un talk » (refonte de la navigation connectée, 2026-10-15) :
 * un talk retenu à une nouvelle conférence est la mise à jour la plus
 * fréquente, et elle obligeait à ouvrir le talk. L'entrée mène à la fiche, où
 * la fenêtre de date du talk s'ouvre d'elle-même (`?date=<id>`).
 */
describe("FeuilleCreer — une date sur un talk existant", () => {
  const AVEC = (talks: { id: number; titre: string }[]): FeuilleDonnees => ({
    talks,
    creation: "talk",
    orga: false,
    editions: [],
  });

  it("aucun talk : l'entrée s'efface (jamais de CTA impossible)", async () => {
    await ouvrir(AVEC([]));
    expect(screen.queryByRole("link", { name: /ajouter une date à un talk/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ajouter une date à un talk/i })).toBeNull();
  });

  it("UN talk : l'entrée mène droit à sa fenêtre de date, sur la fiche", async () => {
    await ouvrir(AVEC([{ id: 12, titre: "IA et personnes aveugles" }]));
    expect(screen.getByRole("link", { name: /ajouter une date à un talk/i })).toHaveAttribute(
      "href",
      "/mon-espace/fiche?date=12",
    );
  });

  it("PLUSIEURS talks : un choix du talk s'intercale, puis retour possible", async () => {
    const u = await ouvrir(
      AVEC([
        { id: 12, titre: "IA et personnes aveugles" },
        { id: 7, titre: "Manager sans s'épuiser" },
      ]),
    );
    // Un CHOIX, pas un lien qui partirait vers le premier talk au hasard.
    expect(screen.queryByRole("link", { name: /ajouter une date à un talk/i })).toBeNull();
    await u.click(screen.getByRole("button", { name: /ajouter une date à un talk/i }));
    expect(screen.getByRole("heading", { name: /ajouter une date.*sur quel talk/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IA et personnes aveugles" })).toHaveAttribute(
      "href",
      "/mon-espace/fiche?date=12",
    );
    expect(screen.getByRole("link", { name: "Manager sans s'épuiser" })).toHaveAttribute(
      "href",
      "/mon-espace/fiche?date=7",
    );
    await u.click(screen.getByRole("button", { name: /retour/i }));
    expect(screen.getByRole("link", { name: /ajouter un talk/i })).toBeInTheDocument();
  });

  // Le bouton cliqué disparaît avec l'étape : sans ce geste, le focus tombait
  // sur <body> et le nouveau titre restait muet (WCAG 2.4.3, 4.1.3).
  it("changer d'étape porte le focus sur le titre de l'étape, à l'aller comme au retour", async () => {
    const u = await ouvrir(
      AVEC([
        { id: 12, titre: "IA et personnes aveugles" },
        { id: 7, titre: "Manager sans s'épuiser" },
      ]),
    );
    await u.click(screen.getByRole("button", { name: /ajouter une date à un talk/i }));
    expect(screen.getByRole("heading", { name: /sur quel talk/i })).toHaveFocus();
    await u.click(screen.getByRole("button", { name: /retour/i }));
    expect(screen.getByRole("heading", { name: /^créer$/i })).toHaveFocus();
  });

  it("l'entrée suit « Ajouter un talk », en deuxième position", async () => {
    await ouvrir(AVEC([{ id: 12, titre: "IA et personnes aveugles" }]));
    const liens = screen.getAllByRole("link");
    expect(liens[0]).toHaveAccessibleName("Ajouter un talk");
    expect(liens[1]).toHaveAccessibleName("Ajouter une date à un talk");
  });
});

describe("FeuilleCreer — dialogue accessible", () => {
  it("le déclencheur annonce un dialogue ; la feuille est titrée « Créer » et se ferme", async () => {
    const u = userEvent.setup();
    render(<FeuilleCreer donnees={{ talks: [], creation: "talk", orga: false, editions: [] }} />);
    const trigger = screen.getByRole("button", { name: /créer/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await u.click(trigger);
    expect(screen.getByRole("heading", { name: /^créer$/i })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /fermer/i }));
    expect(screen.queryByRole("heading", { name: /^créer$/i })).toBeNull();
  });
});
