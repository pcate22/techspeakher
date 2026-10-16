import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * « À faire » — désormais `/mon-espace/a-faire` (étape B, D5). Ce banc a suivi
 * l'écran depuis `/admin/taches` : le titre, la méta, et maintenant les VUES.
 *
 * Ce qui se juge ici, et nulle part ailleurs :
 *
 * - le `h1` nomme l'endroit, rien d'autre (règle des principes UI, posée le
 *   2026-08-16 : le repère de page ne change jamais de nom tout seul) ;
 * - la méta compte les GESTES, pas les lignes (`reclameUnGeste`) ;
 * - la vue est INTERSECTÉE avec les familles chargées, jamais l'inverse : une
 *   clé qu'on n'a pas le droit de voir donne « Tout », silencieusement — pas
 *   d'erreur, pas de message qui révélerait le modèle de rôles (S5, R4) ;
 * - puces présentes OU bandeau de retour, jamais les deux (D4) ;
 * - la liste est NOMMÉE par la vue active (D5).
 *
 * On mocke `chargerTaches` (la porte gardée) : ses gardes ont leur propre banc
 * (`taches-portes.test.ts`), et un changement de règle du moteur ne doit pas
 * casser un test d'écran. `admin-dashboard.test.tsx` monte, lui, tout le décor
 * de la base — c'est là que la dérivation se juge branchée.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/lib/auth-guards", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/taches-chargement", () => ({ chargerTaches: vi.fn() }));

import { getSession } from "@/lib/auth-guards";
import { chargerTaches } from "@/lib/taches-chargement";
import type { Tache } from "@/lib/taches";
import AFaire from "@/app/mon-espace/a-faire/page";

afterEach(cleanup);

const geste = (n: number, famille: Tache["famille"] = "association"): Tache[] =>
  Array.from({ length: n }, (_, i) => ({
    libelle: `Valider la fiche n° ${i + 1}`,
    href: `/speakeuses/${i + 1}`,
    famille,
    regle: "valider-fiche",
  }));

const constat = (): Tache[] => [
  {
    libelle: "2 photos restent privées",
    href: "/admin/tremplins/1/photos",
    famille: "association",
    regle: "photos-privees",
    constat: true,
  },
];

const charge = (taches: Tache[]) =>
  vi.mocked(chargerTaches).mockResolvedValue({ taches, aujourdhui: "2026-08-17" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ user: { id: "1" } } as never);
  charge(geste(5));
});

const rendu = async (params: Record<string, string | string[]> = {}) =>
  render(await AFaire({ searchParams: Promise.resolve(params) }));

const titre = () => screen.getByRole("heading", { level: 1 });

describe("« À faire » — le titre nomme l'endroit, rien d'autre", () => {
  it("le `h1` vaut « À faire », quel que soit le nombre de tâches", async () => {
    await rendu();
    expect(titre().textContent?.trim()).toBe("À faire");
  });

  it("le même titre avec une liste vide : le repère de page ne bouge pas", async () => {
    charge([]);
    await rendu();
    expect(titre().textContent?.trim()).toBe("À faire");
  });

  it("aucun fil d'Ariane : une destination d'onglet n'a pas de parent", async () => {
    await rendu();
    expect(screen.queryByRole("navigation", { name: /fil d'ariane/i })).toBeNull();
  });

  it("sans session : redirection vers la connexion", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(rendu()).rejects.toThrow("REDIRECT:/connexion");
  });
});

describe("« À faire » — la méta compte ce qu'un geste referme", () => {
  it("le nombre se dit à côté du titre, en toutes lettres", async () => {
    await rendu();
    // « tâche », le mot de la liste et de la conception — la méta disait
    // « choses » pendant que la liste disait « Tâches » : deux mots pour un
    // concept sur le même écran (relecture UX du 2026-08-17).
    expect(screen.getByText(/5 tâches à faire/i)).toBeInTheDocument();
  });

  it("les constats sont hors compte, et la méta explique leur étiquette", async () => {
    charge([...geste(3), ...constat()]);
    await rendu();
    expect(screen.getByText(/3 tâches à faire/i)).toBeInTheDocument();
    expect(screen.getByText(/Les lignes .*Pour information.* situent/i)).toBeInTheDocument();
  });

  it("rien à faire : on ne dit pas « 0 », on dit ce qu'est la page", async () => {
    charge([]);
    await rendu();
    expect(screen.getByText(/tout ce qui attend une action/i)).toBeInTheDocument();
    expect(screen.queryByText(/\b0\b/)).toBeNull();
  });
});

describe("« À faire » — la vue est intersectée avec les familles chargées", () => {
  it("une clé d'une famille ABSENTE donne « Tout », silencieusement", async () => {
    // Le cœur de S5 : une membre qui reçoit ?vue=association (un lien copié,
    // une vieille URL) voit sa liste entière — ni erreur, ni bandeau qui
    // révélerait qu'une vue « association » existe pour d'autres.
    charge(geste(2, "personnel"));
    await rendu({ vue: "association" });
    expect(screen.getAllByRole("link", { name: /valider la fiche/i })).toHaveLength(2);
    expect(screen.queryByText(/vue\s*:/i)).toBeNull();
  });

  it("liste VIDE et ?vue=association : « Tout » vide, sans bandeau", async () => {
    // L'arrivée par le 308 quand tout est réglé : familles = [], la clé ne
    // peut pas être permise, la page dit son état d'arrivée — jamais un
    // bandeau qui promettrait un filtre sur rien.
    charge([]);
    await rendu({ vue: "association" });
    expect(screen.getByText(/rien à faire pour l'instant/i)).toBeInTheDocument();
    expect(screen.queryByText(/vue\s*:/i)).toBeNull();
  });

  it("un paramètre répété (?vue=a&vue=b) donne « Tout » : la page passe par cleVue", async () => {
    // Garde la PAGE, pas la lib : une page qui court-circuiterait cleVue
    // (vue[0]) resterait verte au banc unitaire de vue-liste.
    await rendu({ vue: ["association", "association"] });
    expect(screen.getAllByRole("link", { name: /valider la fiche/i })).toHaveLength(5);
    expect(screen.queryByText(/vue\s*:/i)).toBeNull();
  });

  it("une clé inventée donne « Tout » aussi", async () => {
    await rendu({ vue: "../../admin" });
    expect(screen.getAllByRole("link", { name: /valider la fiche/i })).toHaveLength(5);
    expect(screen.queryByText(/vue\s*:/i)).toBeNull();
  });

  it("une vue valide filtre la liste, et la liste porte le nom de la vue", async () => {
    charge([...geste(2, "association"), ...geste(1, "personnel")]);
    await rendu({ vue: "personnel" });
    expect(screen.getAllByRole("link", { name: /valider la fiche/i })).toHaveLength(1);
    expect(screen.getByRole("list", { name: /tâches.*pour moi/i })).toBeInTheDocument();
  });

  it("en « Tout », la liste s'appelle « Tâches » — un nom stable", async () => {
    await rendu();
    expect(screen.getByRole("list", { name: "Tâches" })).toBeInTheDocument();
  });
});

describe("« À faire » — puces OU bandeau, jamais les deux", () => {
  it("une seule famille : aucune puce", async () => {
    await rendu();
    expect(screen.queryByRole("list", { name: "Filtrer" })).toBeNull();
  });

  it("une seule famille, vue active (arrivée par le 308) : le bandeau ramène vers « Tout »", async () => {
    await rendu({ vue: "association" });
    expect(screen.queryByRole("list", { name: "Filtrer" })).toBeNull();
    expect(screen.getByText(/vue\s*:/i)).toBeInTheDocument();
    // Le patron du dépôt : « Voir toutes les X » — et le résumé dit ce qui
    // EST (« la liste entière »), jamais un « N sur N » qui ne distingue rien.
    expect(screen.getByRole("link", { name: /voir toutes les tâches/i })).toHaveAttribute(
      "href",
      "/mon-espace/a-faire",
    );
    expect(screen.getByText(/la liste entière/i)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ tâches? sur \d+/i)).toBeNull();
  });

  it("deux familles : les puces, et pas de bandeau même en vue active", async () => {
    charge([...geste(2, "association"), ...geste(1, "personnel")]);
    await rendu({ vue: "personnel" });
    expect(screen.getByRole("list", { name: "Filtrer" })).toBeInTheDocument();
    expect(screen.queryByText(/vue\s*:/i)).toBeNull();
    // L'état actif est dit par la puce elle-même.
    expect(screen.getByRole("link", { name: "Pour moi" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("l'ordre des puces est CANONIQUE, jamais celui des échéances", async () => {
    // La liste chargée met l'association d'abord (les datées trient) ; les
    // puces disent quand même « Pour moi » avant « Pour l'association ». Un
    // meuble de navigation ne change pas de place d'une visite à l'autre —
    // relevé par la passe justesse : la protection existait sans test.
    charge([...geste(2, "association"), ...geste(1, "personnel")]);
    await rendu();
    const puces = screen
      .getByRole("list", { name: "Filtrer" })
      .querySelectorAll("a");
    expect([...puces].map((a) => a.textContent)).toEqual([
      "Tout",
      "Pour moi",
      "Pour l'association",
    ]);
  });

  it("deux familles, chaque ligne dit POUR QUI — sauf en vue filtrée", async () => {
    const deux = [...geste(1, "association"), ...geste(1, "personnel")];
    charge(deux);
    await rendu();
    // `selector: "span"` : les puces sont des LIENS qui portent les mêmes
    // mots — l'étiquette de ligne, elle, est un span décoratif.
    expect(screen.getByText("Pour l'association", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Pour moi", { selector: "span" })).toBeInTheDocument();

    cleanup();
    charge(deux);
    await rendu({ vue: "personnel" });
    // Dans la vue « Pour moi », chaque ligne dirait « Pour moi » : un mot qui
    // ne distingue rien (C6).
    expect(screen.queryByText("Pour moi", { selector: "span" })).toBeNull();
  });

  it("une seule famille : aucune étiquette de famille sur les lignes", async () => {
    await rendu();
    expect(screen.queryByText("Pour l'association", { selector: "span" })).toBeNull();
  });
});
