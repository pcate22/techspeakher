import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * RÉGLAGES — ce qu'on paramètre une fois, hors du flux du travail.
 *
 * « Mes connexions » et « Zone de danger » vivaient en bas de « Mon espace » :
 * le hub mélangeait ce qu'on FAIT (sa fiche, son tremplin, son coaching) et ce
 * qu'on RÈGLE une fois pour toutes. On les attend là où vit le compte — le menu
 * de l'avatar (desktop), le tiroir (mobile) — et c'est de là qu'on arrive ici.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  // L'interrupteur de la lettre d'information rafraîchit la page après
  // enregistrement (pattern résultat, principes §4).
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/newsletter", () => ({ estAbonnee: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfileByUserId: vi.fn(),
  getRappelCadence: vi.fn(),
}));

import { auth } from "@/auth";
import { estAbonnee } from "@/lib/newsletter";
import { getProfileByUserId, getRappelCadence } from "@/lib/profiles";
import Reglages from "@/app/mon-espace/reglages/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({
    user: { id: "7", name: "Ada Lovelace", email: "ada@example.org" },
  } as never);
  vi.mocked(estAbonnee).mockResolvedValue(true);
  // Une membre avec une fiche et aucun choix de cadence : le cas courant.
  vi.mocked(getProfileByUserId).mockResolvedValue({ id: 3 } as never);
  vi.mocked(getRappelCadence).mockResolvedValue(null);
});

describe("/mon-espace/reglages", () => {
  it("regroupe ce qu'on paramètre une fois : connexions et suppression", async () => {
    render(await Reglages());
    expect(screen.getByRole("heading", { level: 1, name: /^réglages$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^mes connexions/i })).toHaveAttribute(
      "href",
      "/mon-espace/connexions",
    );
    // Le nom du GESTE, pas la métaphore de dév « zone de danger » (§5).
    expect(
      screen.getByRole("link", { name: /supprimer mon compte/i }),
    ).toHaveAttribute("href", "/mon-espace/supprimer");
  });

  it("porte le choix de la lettre d'information, en disant ce qu'il NE coupe pas", async () => {
    render(await Reglages());

    const interrupteur = screen.getByRole("switch", {
      name: /recevoir la lettre d'information/i,
    });
    expect(interrupteur).toHaveAttribute("aria-checked", "true");
    // La promesse du canal doit être LUE, pas devinée : refuser le marketing
    // laisse arriver les e-mails du compte. Elle est portée par les DEUX
    // réglages, mot pour mot — deux réglages qui promettent la même chose
    // doivent la formuler pareil, sinon on croit qu'ils diffèrent.
    expect(screen.getAllByText(/continuent d'arriver/i)).toHaveLength(2);
  });

  it("reflète un refus déjà posé", async () => {
    vi.mocked(estAbonnee).mockResolvedValue(false);
    render(await Reglages());
    expect(
      screen.getByRole("switch", { name: /recevoir la lettre d'information/i }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("porte le choix de fréquence des rappels, en nommant les talks", async () => {
    render(await Reglages());
    // `group` et pas `radiogroup` : le regroupement est porté par le
    // <fieldset>/<legend> natif (RGAA 11.5), sans rôle ARIA surajouté qui
    // ferait annoncer le groupe deux fois.
    const groupe = screen.getByRole("group", { name: /rappels sur ma fiche/i });
    expect(groupe).toBeInTheDocument();
    // Le libellé doit dire CE QU'ON COUPE : « rappels sur ma fiche » seul ne
    // laisse pas deviner qu'il s'agit aussi des dates de talk.
    expect(screen.getByText(/prochaines dates de talk/i)).toBeInTheDocument();
    for (const choix of [
      /au rythme de l'équipe/i,
      /tous les mois/i,
      /tous les 2 mois/i,
      /tous les 6 mois/i,
      /^aucun$/i,
    ]) {
      expect(screen.getByRole("radio", { name: choix })).toBeInTheDocument();
    }
  });

  it("coche le défaut de l'équipe tant que rien n'est choisi", async () => {
    render(await Reglages());
    expect(
      screen.getByRole("radio", { name: /au rythme de l'équipe/i }),
    ).toBeChecked();
  });

  it("reflète une cadence déjà choisie", async () => {
    vi.mocked(getRappelCadence).mockResolvedValue("semestriel");
    render(await Reglages());
    expect(screen.getByRole("radio", { name: /tous les 6 mois/i })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /au rythme de l'équipe/i }),
    ).not.toBeChecked();
  });

  it("laisse le réglage de côté pour un compte SANS fiche", async () => {
    // Sans fiche, aucun rappel de fiche ne part : proposer d'en régler la
    // fréquence offrirait un bouton qui ne commande rien.
    vi.mocked(getProfileByUserId).mockResolvedValue(null);
    render(await Reglages());
    expect(
      screen.queryByRole("group", { name: /rappels sur ma fiche/i }),
    ).toBeNull();
    // La lettre d'information, elle, concerne tout le monde et reste là.
    expect(
      screen.getByRole("switch", { name: /recevoir la lettre d'information/i }),
    ).toBeInTheDocument();
  });

  it("hors session : direction la connexion (aucune fuite)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(Reglages()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = render(await Reglages());
    expect(await axe(container)).toHaveNoViolations();
  });
});
