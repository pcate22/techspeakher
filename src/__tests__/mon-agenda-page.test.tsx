import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * L'onglet Agenda est UN FIL CONTINU : le passé au-dessus, l'à-venir en dessous,
 * et le jour même comme date à sa place chronologique — jamais une frontière.
 *
 * Le point délicat (revue post-prod du 31/07) : la liste arrive triée par date
 * de DÉBUT, mais « passé » se juge sur la FIN effective. Une activité à période
 * COMMENCÉE mais pas finie démarre tôt dans le tri sans être passée — le passé
 * n'est donc PAS un préfixe de la liste, et une coupure par `slice` faisait
 * disparaître l'activité en cours en dupliquant un vrai passé. Exactement le
 * défaut que le lot A corrigeait ailleurs (« la revue du 7 au 13 ne disparaît
 * plus le 8 »). Corollaire : la zone d'une échéance se lit sur SA section, et
 * jamais sur sa position par rapport au jour même.
 */

vi.mock("@/lib/auth-guards", () => ({
  requireUserId: vi.fn(async () => 7),
  getSession: vi.fn(async () => ({ user: { id: "7", isOrga: false } })),
}));
// Seule la LECTURE est mockée : tri, groupement par mois et clés restent réels.
vi.mock("@/lib/mon-agenda", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getMonAgenda: vi.fn(),
}));
vi.mock("@/lib/tremplin-statut", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  aujourdhuiParis: vi.fn(() => "2026-07-31"),
}));

import { getMonAgenda } from "@/lib/mon-agenda";
import MonAgenda from "@/app/mon-espace/agenda/page";
import { makeAtelierAgenda as atelier } from "./test-helpers";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

/** La zone (passé / à venir) où vit une échéance, lue sur SA section. */
const zoneDe = (titre: string): string | undefined =>
  screen
    .getByText(titre)
    .closest("section")
    ?.getAttribute("aria-labelledby")
    ?.split("-")[1];

describe("Mon agenda — la coupure passé / à venir", () => {
  it("une activité à période EN COURS reste côté à venir ; rien ne disparaît, rien ne double", async () => {
    // Triés par DÉBUT : la fenêtre en cours (20/07 → 15/08) précède l'atelier
    // passé du 25/07. Le passé n'est pas un préfixe — le cas qui cassait.
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 1, titre: "Revue croisée en cours", date: "2026-07-20", dateFin: "2026-08-15" }),
      atelier({ atelierId: 2, titre: "Atelier déjà passé", date: "2026-07-25" }),
      atelier({ atelierId: 3, titre: "Répétition de septembre", date: "2026-09-01" }),
    ]);
    render(await MonAgenda());

    // Chaque échéance apparaît UNE fois.
    expect(screen.getAllByText("Revue croisée en cours")).toHaveLength(1);
    expect(screen.getAllByText("Atelier déjà passé")).toHaveLength(1);
    expect(screen.getAllByText("Répétition de septembre")).toHaveLength(1);

    // Et du bon côté : la zone se lit sur la SECTION, pas sur la position du
    // jour même dans le texte — une fenêtre commencée le 20/07 reste à venir
    // tout en se rangeant AVANT la ligne du 31, sous son jour de début.
    expect(zoneDe("Atelier déjà passé")).toBe("passe");
    expect(zoneDe("Revue croisée en cours")).toBe("avenir");
    expect(zoneDe("Répétition de septembre")).toBe("avenir");
  });

  it("un même mois des deux côtés du jour même : chaque en-tête garde un id UNIQUE", async () => {
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 1, titre: "Passé de juillet", date: "2026-07-03" }),
      atelier({ atelierId: 2, titre: "Fin juillet à venir", date: "2026-07-31" }),
    ]);
    const { container } = render(await MonAgenda());
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Le mois s'affiche bien des deux côtés (deux en-têtes « juillet »).
    expect(screen.getAllByRole("heading", { name: /juillet 2026/i })).toHaveLength(2);
  });

  /**
   * Remonté de la prod (16/08/2026) : « je vois encore mai et j'ai l'impression
   * qu'aujourd'hui j'ai septembre ». Un agenda saute les mois vides — entre la
   * dernière séance de mai et la première de septembre, AUCUN en-tête ne portait
   * le mois courant. Le seul titre affiché en haut d'écran était alors celui du
   * passé, collant, et il se lisait comme la date du jour.
   *
   * Aujourd'hui est donc une DATE du fil : sa ligne existe toujours, à sa place,
   * son mois avec elle.
   */
  it("le jour même a sa ligne et son mois, même quand l'agenda saute par-dessus", async () => {
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 1, titre: "Séance de mai", date: "2026-05-20" }),
      atelier({ atelierId: 2, titre: "Séance de septembre", date: "2026-09-01" }),
    ]);
    render(await MonAgenda());
    // Le mois courant naît entre les deux, dans l'ordre : plus aucun titre du
    // passé ne peut se lire comme la date du jour.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Mai 2026",
      "Juillet 2026",
      "Septembre 2026",
    ]);
    // La ligne du jour DIT qu'elle est aujourd'hui — la couleur ne porte jamais
    // l'information seule (WCAG 1.4.1), et le texte calculé reste séparé.
    const ligne = screen.getByRole("heading", { name: /vendredi 31 juillet · aujourd'hui/i });
    expect(ligne).toHaveAttribute("id", "aujourdhui");
    expect(ligne.tagName).toBe("H3"); // un jour parmi les jours, pas un mois
    // Et la journée vide se raconte, plutôt que de laisser un titre en l'air.
    expect(screen.getByText(/rien à l'agenda aujourd'hui/i)).toBeInTheDocument();
  });

  it("sans passé, le jour même ouvre le fil (et reste unique)", async () => {
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 3, titre: "Répétition de septembre", date: "2026-09-01" }),
    ]);
    const { container } = render(await MonAgenda());
    expect(container.querySelectorAll("#aujourdhui")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Juillet 2026",
      "Septembre 2026",
    ]);
  });

  it("le jour même porte ses échéances quand il en a (et se tait sur le vide)", async () => {
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 4, titre: "Filage du jour", date: "2026-07-31" }),
    ]);
    render(await MonAgenda());
    const ligne = screen.getByRole("heading", { name: /vendredi 31 juillet · aujourd'hui/i });
    expect(ligne).toBeInTheDocument();
    expect(screen.getAllByText("Filage du jour")).toHaveLength(1);
    expect(screen.queryByText(/rien à l'agenda aujourd'hui/i)).toBeNull();
  });

  it("plus rien devant : le fil se termine sur le jour même, qui le dit", async () => {
    vi.mocked(getMonAgenda).mockResolvedValue([
      atelier({ atelierId: 5, titre: "Séance de mai", date: "2026-05-20" }),
    ]);
    render(await MonAgenda());
    expect(screen.getByText(/rien à l'agenda aujourd'hui\. tu es à jour\./i)).toBeInTheDocument();
  });
});
