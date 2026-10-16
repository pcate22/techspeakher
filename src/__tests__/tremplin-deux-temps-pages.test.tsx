import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { PublicEdition, PublicAtelier } from "@/lib/tremplin-public";

/**
 * LES DEUX TEMPS D'UNE ÉDITION, à l'écran.
 *
 * Une édition se raconte sur deux pages : le Tremplin jusqu'à la soirée finale,
 * puis l'accompagnement vers la scène de la conférence. Avant ça, les quinze
 * séances se suivaient en liste plate sur une seule page — on lisait un seul
 * programme, et la durée annoncée courait d'avril à novembre en agrégeant deux
 * parcours que rien ne relie pour la lectrice.
 *
 * Ce qui est éprouvé ici, et qu'aucun test de DTO ne peut attraper : chaque page
 * ne rend QUE son chapitre, chacune mesure SA durée, et la seconde ne recopie
 * pas le contenu de la première (deux pages jumelles seraient des doublons, en
 * plus de rejouer la surcharge qu'on corrige).
 */

const getPublicEdition = vi.fn();
vi.mock("@/lib/tremplin-public", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-public")>();
  return { ...actual, getPublicEdition: (...a: unknown[]) => getPublicEdition(...a) };
});

const getEditionByConfAndYear = vi.fn();
vi.mock("@/lib/tremplin-editions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-editions")>();
  return {
    ...actual,
    getEditionByConfAndYear: (...a: unknown[]) => getEditionByConfAndYear(...a),
    // Après la conférence : les deux parcours sont derrière nous, donc les
    // pastilles « Fait » ne dépendent pas du jour où tourne la CI.
    aujourdhuiParis: () => "2026-12-01",
  };
});

import EditionPublique from "@/app/tremplin/[conf]/[annee]/page";
import MonteeSurScene from "@/app/tremplin/[conf]/[annee]/montee-sur-scene/page";

afterEach(cleanup);

const atelier = (o: Partial<PublicAtelier> & { titre: string; phase: PublicAtelier["phase"] }): PublicAtelier => ({
  date: null,
  dateFin: null,
  description: null,
  ...o,
});

/** Les deux programmes de 2026, tels que la base les porte. */
const ATELIERS: PublicAtelier[] = [
  atelier({ titre: "Trouver son sujet", phase: "cfp_et_pitch", date: "2026-04-28" }),
  atelier({ titre: "Travailler le pitch", phase: "cfp_et_pitch", date: "2026-05-19" }),
  atelier({ titre: "Répétition chronométrée", phase: "montee_sur_scene", date: "2026-10-20" }),
  atelier({ titre: "Générale et préparation mentale", phase: "montee_sur_scene", date: "2026-10-27" }),
];

const base: PublicEdition = {
  nom: "Tremplin 2026",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "archive",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: "2026-11-19",
  confLien: "https://devfesttoulouse.fr",
  finaleDate: "2026-06-04",
  finaleLieu: "Toulouse",
  inscriptionsDebut: null,
  inscriptionsFin: null,
  counts: { inscrites: 8, finalistes: 8, gagnantes: 3, accompagnees: 6 },
  ateliers: ATELIERS,
  finalistes: [],
  accompagnees: [
    {
      nom: "Sandrine Berger",
      role: "Ingénieure",
      sujet: "L'IA à l'épreuve du monde physique",
      bio: null,
      linkedin: null,
      siteWeb: null,
      photoUrl: null,
      recompenses: [],
    },
  ],
  accompagnantes: {
    cfp_et_pitch: [{ nom: "Lucile Briotet", role: "Conceptrice-rédactrice", lien: null }],
    montee_sur_scene: [
      { nom: "Rachel Dubois", role: "Coach produit", lien: "https://racheldubois.fr" },
    ],
  },
  palmares: [],
  recompenses: [],
  jury: [],
  photos: [],
  recit: null,
};

const params = Promise.resolve({ conf: "devfest-toulouse", annee: "2026" });

async function rendreChapitre1(ed: PublicEdition = base) {
  getPublicEdition.mockResolvedValue(ed);
  render(await EditionPublique({ params }));
}

async function rendreChapitre2(ed: PublicEdition = base) {
  getPublicEdition.mockResolvedValue(ed);
  render(await MonteeSurScene({ params }));
}

describe("chapitre 1 — la page d'édition s'arrête à la soirée finale", () => {
  it("ne rend que les séances d'avant la finale", async () => {
    await rendreChapitre1();
    expect(screen.getByText("Trouver son sujet")).toBeInTheDocument();
    expect(screen.getByText("Travailler le pitch")).toBeInTheDocument();
    // Le parcours d'après a sa page : le laisser ici, c'était le seul défaut.
    expect(screen.queryByText("Répétition chronométrée")).toBeNull();
    expect(screen.queryByText("Générale et préparation mentale")).toBeNull();
  });

  /**
   * LE défaut silencieux. La durée se mesurait du premier atelier à la
   * conférence — 28 avril → 19 novembre, soit 29 semaines — sur une page qui
   * raconte un parcours de 5 semaines. Rien n'échouait, la page mentait.
   */
  it("chiffre le parcours jusqu'à la finale, pas jusqu'à la conférence", async () => {
    await rendreChapitre1();
    // 28 avril → 4 juin = 37 jours ≈ 5 semaines.
    expect(screen.getByText(/5 semaines/)).toBeInTheDocument();
    expect(screen.getByText(/du premier atelier à la soirée finale/)).toBeInTheDocument();
    expect(screen.queryByText(/29 semaines/)).toBeNull();
  });

  it("crédite les accompagnantes de SA phase, pas celles de l'autre", async () => {
    await rendreChapitre1();
    // Scopé à la section : Lucile Briotet figure AUSSI dans les partenaires
    // (crédit éditorial hérité, cf. `src/data/tremplin.ts`), et une recherche
    // globale ne dirait pas laquelle des deux mentions on éprouve.
    const section = screen.getByRole("region", { name: /elles ont accompagné/i });
    expect(within(section).getByText("Lucile Briotet")).toBeInTheDocument();
    expect(within(section).queryByText("Rachel Dubois")).toBeNull();
  });

  it("mène à la suite quand elle existe", async () => {
    await rendreChapitre1();
    const lien = screen.getByRole("link", { name: /l'accompagnement vers la scène/i });
    expect(lien).toHaveAttribute("href", "/tremplin/devfest-toulouse/2026/montee-sur-scene");
  });

  /** Un lien vers une page vide est pire qu'un lien absent. */
  it("sans parcours d'après-finale ni cohorte, aucun lien vers une page vide", async () => {
    await rendreChapitre1({
      ...base,
      ateliers: ATELIERS.filter((a) => a.phase === "cfp_et_pitch"),
      accompagnees: [],
    });
    expect(screen.queryByRole("link", { name: /l'accompagnement vers la scène/i })).toBeNull();
  });
});

describe("chapitre 2 — la montée sur scène", () => {
  it("ne rend que les séances d'après la finale", async () => {
    await rendreChapitre2();
    expect(screen.getByText("Répétition chronométrée")).toBeInTheDocument();
    expect(screen.getByText("Générale et préparation mentale")).toBeInTheDocument();
    expect(screen.queryByText("Trouver son sujet")).toBeNull();
  });

  it("annonce la cohorte par son effectif, et nomme celles qui ont consenti", async () => {
    await rendreChapitre2();
    expect(
      screen.getByRole("heading", { name: /6 speakeuses accompagnées vers la scène/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sandrine Berger")).toBeInTheDocument();
  });

  it("mesure SA durée : de la soirée finale à la scène", async () => {
    await rendreChapitre2();
    // 4 juin → 19 novembre = 168 jours = 24 semaines.
    expect(screen.getByText(/24 semaines/)).toBeInTheDocument();
    expect(screen.getByText(/de la soirée finale à la scène/)).toBeInTheDocument();
  });

  it("crédite les accompagnantes de SA phase, avec un lien vers elles", async () => {
    await rendreChapitre2();
    const lien = screen.getByRole("link", { name: /rachel dubois/i });
    expect(lien).toHaveAttribute("href", "https://racheldubois.fr");
    expect(screen.queryByText("Lucile Briotet")).toBeNull();
  });

  /**
   * Ce que la page 2 NE reprend PAS. Sans cette garde, elle se remplirait au fil
   * des lots jusqu'à devenir la jumelle de la page d'édition : douze sections,
   * et deux pages que les moteurs traitent en doublons.
   */
  it("laisse le jury, les prix et la FAQ au chapitre 1", async () => {
    await rendreChapitre2();
    expect(screen.queryByRole("heading", { name: /le jury/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /ce qu.?il y a à gagner/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^faq$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /grille d.?évaluation/i })).toBeNull();
  });

  /**
   * Le 404 est la contrepartie du lien conditionnel : la page d'édition et le
   * hub DevFest suppriment leur lien quand il n'y a rien à montrer, et cette
   * page refuse de s'afficher vide. Les trois lisent le MÊME prédicat — si
   * celui-ci se relâche ici, les surfaces qui lient pointent vers du vide.
   */
  it("sans séance publiée ni accompagnée nommée : introuvable, pas une page vide", async () => {
    getPublicEdition.mockResolvedValue({
      ...base,
      ateliers: ATELIERS.filter((a) => a.phase === "cfp_et_pitch"),
      accompagnees: [],
    });
    await expect(MonteeSurScene({ params })).rejects.toThrow(/NEXT_NOT_FOUND|not.?found/i);
  });

  it("édition inexistante ou supprimée : introuvable", async () => {
    for (const dto of [null, "deleted"]) {
      getPublicEdition.mockResolvedValue(dto);
      await expect(MonteeSurScene({ params })).rejects.toThrow(/NEXT_NOT_FOUND|not.?found/i);
    }
  });

  /**
   * Le compteur seul ne fait pas une cohorte à montrer : sans rattachement, le
   * titre annonçait « 0 speakeuse accompagnée vers la scène » sur une page qui
   * existe justement parce qu'on accompagne.
   */
  it("effectif nul : la section cohorte disparaît au lieu d'annoncer zéro", async () => {
    await rendreChapitre2({
      ...base,
      counts: { ...base.counts, accompagnees: 0 },
      accompagnees: [],
    });
    expect(screen.queryByText(/0 speakeuse/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /accompagnées vers la scène/i })).toBeNull();
    // La page tient debout : c'est le parcours qui la porte.
    expect(screen.getByText("Répétition chronométrée")).toBeInTheDocument();
  });

  it("ramène au chapitre 1, et mène au programme de la conférence", async () => {
    await rendreChapitre2();
    expect(
      screen.getAllByRole("link", { name: /le tremplin 2026|revoir le tremplin 2026/i })[0],
    ).toHaveAttribute("href", "/tremplin/devfest-toulouse/2026");
    expect(screen.getByRole("link", { name: /voir le programme/i })).toHaveAttribute(
      "href",
      "https://devfesttoulouse.fr",
    );
  });
});
