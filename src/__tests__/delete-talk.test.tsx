import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Talk, TalkOccurrence } from "@/lib/talks";

/**
 * Suppression d'un talk depuis « Modifier le talk ». Trois exigences :
 * - la DISPOSITION suit le pattern maison (une ligne sous le formulaire,
 *   séparée par un filet, comme le retrait d'une conférence) — jamais un
 *   menu ⋯ ;
 * - le PÉRIMÈTRE de la cascade est chiffré et accordé (0, 1 ou n conférences) ;
 * - le GARDE-FOU : emphase INVERSÉE dans la modale. « Annuler » porte le poids
 *   visuel et reçoit le focus, la suppression reste discrète : le clic réflexe
 *   ne détruit rien. Pas de saisie à retaper — ce serait plus lourd que pour
 *   supprimer son compte, geste bien plus grave.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "7" } })) }));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn(async () => ({ id: 42 })) }));
vi.mock("@/lib/talks", () => ({ getTalkById: vi.fn() }));

// `vi.mock` est hissé au-dessus des `const` : la spie doit l'être aussi.
const { deleteTalkAction } = vi.hoisted(() => ({ deleteTalkAction: vi.fn() }));
vi.mock("@/app/mon-espace/actions", () => ({ deleteTalkAction }));

// Le formulaire d'édition a sa propre couverture : ici on regarde la zone de
// suppression qui vit sous lui.
vi.mock("@/app/mon-espace/TalkForm", () => ({ default: () => <div>formulaire du talk</div> }));

import { getTalkById } from "@/lib/talks";
import ModifierTalk from "@/app/mon-espace/talks/[id]/page";

afterEach(cleanup);

const TITRE = "La méthode pour coder ce qui compte";

const occurrence = (id: number, conference: string): TalkOccurrence => ({
  id,
  conferenceId: null,
  conferenceSlug: null,
  editionId: null,
  conference,
  ville: "Toulouse",
  codeInsee: "31555",
  region: "Occitanie",
  pays: "France",
  date: null,
  lienConf: null,
  lienSlides: null,
  lienVideo: null,
  lienFeedback: null,
  propositionId: null,
  etat: "publiee" as const,
});

const talk = (occurrences: TalkOccurrence[]): Talk => ({
  id: 5,
  profileId: 42,
  titre: TITRE,
  type: "conference",
  description: null,
  occurrences,
});

const afficher = async (occurrences: TalkOccurrence[]) => {
  vi.mocked(getTalkById).mockResolvedValue(talk(occurrences));
  render(
    await ModifierTalk({
      params: Promise.resolve({ id: "5" }),
      searchParams: Promise.resolve({}),
    }),
  );
};

const deuxConfs = [occurrence(1, "DevFest"), occurrence(2, "Devoxx")];

beforeEach(() => vi.clearAllMocks());

describe("Modifier un talk — zone de suppression", () => {
  it("expose la suppression en ligne visible, sans menu ⋯", async () => {
    await afficher(deuxConfs);
    // Aucun menu à ouvrir : le déclencheur est lisible d'emblée.
    expect(screen.queryByRole("button", { name: /actions du talk/i })).toBeNull();
    expect(screen.getByRole("button", { name: /supprimer ce talk/i })).toHaveAttribute(
      "type",
      "button",
    );
    // Le champ de confirmation vit dans la modale, pas sur la page.
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // L'id part avec le formulaire, sans avoir à ouvrir quoi que ce soit.
    expect(document.querySelector('input[name="talkId"]')).toHaveValue("5");
  });

  it("annonce le périmètre de la cascade, accordé au nombre de conférences", async () => {
    await afficher(deuxConfs);
    expect(screen.getByText(/ce talk et ses 2 conférences/i)).toBeInTheDocument();

    cleanup();
    await afficher([occurrence(1, "DevFest")]);
    // Accord au singulier : jamais « ses 1 conférence ».
    expect(screen.getByText(/ce talk et sa conférence/i)).toBeInTheDocument();

    cleanup();
    await afficher([]);
    // Un sujet jamais donné : rien à annoncer de plus que le talk lui-même.
    expect(screen.getByText(/supprimer définitivement ce talk\./i)).toBeInTheDocument();
  });

  it("garde-fou : l'emphase est inversée, « Annuler » l'emporte visuellement", async () => {
    const u = userEvent.setup();
    await afficher(deuxConfs);
    await u.click(screen.getByRole("button", { name: /supprimer ce talk/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    const annuler = screen.getByRole("button", { name: /annuler/i });
    const confirmer = screen.getByRole("button", { name: /supprimer définitivement/i });

    // Le geste sûr porte le poids et a le focus ; le geste destructif est
    // lisible mais discret.
    expect(annuler.className).toMatch(/bg-magenta/);
    expect(annuler).toHaveFocus();
    expect(confirmer.className).not.toMatch(/bg-/);

    // Aucune saisie à retaper : le bouton est prêt tout de suite.
    expect(screen.queryByLabelText(/réécris le titre/i)).toBeNull();
    expect(confirmer).toHaveAttribute("aria-disabled", "false");
  });

  it("« Annuler » referme sans rien supprimer", async () => {
    const u = userEvent.setup();
    await afficher(deuxConfs);
    await u.click(screen.getByRole("button", { name: /supprimer ce talk/i }));
    await u.click(screen.getByRole("button", { name: /annuler/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteTalkAction).not.toHaveBeenCalled();
  });
});
