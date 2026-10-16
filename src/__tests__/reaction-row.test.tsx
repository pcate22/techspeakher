import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * La rangée Bravo d'une carte du fil (lot N4, maquette une-ligne validée) :
 * un bouton au libellé STABLE (« Bravo », l'état par aria-pressed + coche ✓,
 * jamais la couleur seule), un compteur nominatif court en `role="status"`
 * (le TEXTE porte l'état : « Toi, … »), les erreurs en `role="alert"` —
 * et sur SA propre carte, le compteur sans le bouton.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Le vrai actions.ts tire auth/db : on ne mocke que ce que la rangée appelle.
vi.mock("@/app/mon-espace/actions", () => ({ reactionAction: vi.fn() }));

import { reactionAction } from "@/app/mon-espace/actions";
import { libelleReactions, MOTS } from "@/lib/reaction-libelle";
import { IDLE } from "@/lib/action-state";
import ReactionRow, { reagir } from "@/components/ReactionRow";

afterEach(cleanup);

describe("reagir : le filet entre le bouton et l'action serveur", () => {
  it("un appel qui n'atteint pas le serveur devient un état d'erreur", async () => {
    vi.mocked(reactionAction).mockRejectedValue(new Error("action introuvable"));
    await expect(reagir(IDLE, new FormData())).resolves.toMatchObject({
      status: "error",
    });
  });

  it("une redirection (session expirée) TRAVERSE : le routeur doit la voir", async () => {
    const redirection = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/connexion;307;",
    });
    vi.mocked(reactionAction).mockRejectedValue(redirection);
    await expect(reagir(IDLE, new FormData())).rejects.toBe(redirection);
  });
});

describe("les MOTS : féliciter un accomplissement, accueillir une arrivée", () => {
  it("DEUX mots seulement — la règle se devine sans l'apprendre", () => {
    // Trop de boutons différents = « pourquoi j'ai celui-là ? » (Cateline).
    expect(MOTS.scene.bouton).toBe("Bravo");
    expect(MOTS.asso.bouton).toBe("Bravo"); // écrire est un accomplissement
    expect(MOTS.venue.bouton).toBe("Bienvenue");
    expect(new Set(Object.values(MOTS).map((m) => m.bouton)).size).toBe(2);
  });

  it("le compteur accorde le VERBE au mot de la carte (lecteur d'écran)", () => {
    expect(libelleReactions({ nb: 2, premiere: "Léa M.", moi: false, type: "scene" })?.srOnly)
      .toMatch(/ont applaudi/);
    expect(libelleReactions({ nb: 2, premiere: "Léa M.", moi: false, type: "venue" })?.srOnly)
      .toMatch(/souhaité la bienvenue/);
  });
});

describe("libelleReactions : court, nominatif, l'état en texte", () => {
  it("zéro : rien d'écrit (jamais « 0 bravo »)", () => {
    expect(libelleReactions({ nb: 0, premiere: null, moi: false, type: "scene" })).toBeNull();
  });

  it("les autres : « Léa M. », « Léa M. et 2 autres »", () => {
    expect(libelleReactions({ nb: 1, premiere: "Léa M.", moi: false, type: "scene" })?.visible).toBe(
      "Léa M.",
    );
    expect(libelleReactions({ nb: 3, premiere: "Léa M.", moi: false, type: "scene" })?.visible).toBe(
      "Léa M. et 2 autres",
    );
  });

  it("moi : « Toi », « Toi et Salomé D. », « Toi, Salomé D. et 3 autres »", () => {
    expect(libelleReactions({ nb: 1, premiere: null, moi: true, type: "scene" })?.visible).toBe("Toi");
    expect(libelleReactions({ nb: 2, premiere: "Salomé D.", moi: true, type: "scene" })?.visible).toBe(
      "Toi et Salomé D.",
    );
    expect(libelleReactions({ nb: 5, premiere: "Salomé D.", moi: true, type: "scene" })?.visible).toBe(
      "Toi, Salomé D. et 3 autres",
    );
  });

  it("des donneuses sans nom : le compte en membres, jamais un nom vide", () => {
    expect(libelleReactions({ nb: 2, premiere: null, moi: false, type: "scene" })?.visible).toBe(
      "2 membres",
    );
    expect(libelleReactions({ nb: 3, premiere: null, moi: true, type: "scene" })?.visible).toBe(
      "Toi et 2 autres",
    );
  });

  it("le sr-only complète la phrase (le geste reste dit au lecteur d'écran)", () => {
    expect(libelleReactions({ nb: 3, premiere: "Léa M.", moi: false, type: "scene" })?.srOnly).toMatch(
      /ont applaudi/,
    );
    expect(libelleReactions({ nb: 2, premiere: "Salomé D.", moi: true, type: "scene" })?.srOnly).toMatch(
      /avez applaudi/,
    );
  });
});

describe("ReactionRow : libellé stable, état lisible, une ligne", () => {
  const cible = { type: "scene" as const, id: 7 };

  it("le mot suit la carte : « Bienvenue » pour une arrivée dans l'annuaire", () => {
    render(<ReactionRow cible={{ type: "venue", id: 7 }} carteNom="Salomé D." mienne={false} />);
    expect(screen.getByRole("button", { name: /^Bienvenue/ })).toBeInTheDocument();
    cleanup();
    // Un article de membre : un accomplissement, donc « Bravo » comme la scène.
    render(<ReactionRow cible={{ type: "asso", id: 4 }} carteNom="Nawel B." mienne={false} />);
    expect(screen.getByRole("button", { name: /^Bravo/ })).toBeInTheDocument();
  });

  it("bouton « Bravo » : aria-pressed, emoji hors du nom, la carte nommée en sr-only", async () => {
    const { container } = render(
      <ReactionRow cible={cible} carteNom="Léa Marchand, sur scène" mienne={false} />,
    );
    const bouton = screen.getByRole("button", { name: /^Bravo/ });
    expect(bouton).toHaveAttribute("aria-pressed", "false");
    expect(bouton.textContent).toContain("Bravo");
    // Le nom accessible COMMENCE par le libellé visible (WCAG 2.5.3) et nomme
    // la carte ; l'emoji décoratif n'y entre pas.
    expect(bouton).toHaveAccessibleName(/^Bravo.*Léa Marchand/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("au tap : pressé tout de suite (optimiste), la coche ✓ apparaît, le libellé reste « Bravo »", async () => {
    vi.mocked(reactionAction).mockResolvedValue({ status: "success" } as never);
    render(<ReactionRow cible={cible} carteNom="Léa" mienne={false} />);
    const bouton = screen.getByRole("button", { name: /^Bravo/ });
    await userEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-pressed", "true");
    expect(bouton.textContent).toContain("✓");
    expect(bouton.textContent).toContain("Bravo");
  });

  it("le compteur vit en role=status et dit l'état en texte (« Toi, … »)", () => {
    render(
      <ReactionRow
        cible={cible}
        carteNom="Léa"
        mienne={false}
        reactions={{ nb: 5, premiere: "Salomé D.", moi: true }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Toi, Salomé D. et 3 autres/,
    );
  });

  it("SA carte : le compteur (canal de réception), AUCUN bouton", () => {
    render(
      <ReactionRow
        cible={cible}
        carteNom="Ma carte"
        mienne
        reactions={{ nb: 2, premiere: "Ada L.", moi: false }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Ada L. et 1 autre/);
  });

  it("un appel qui n'atteint PAS le serveur se dit sur place — jamais la page « Oups »", async () => {
    // Déploiement changé sous les pieds, réseau coupé : la promesse rejette
    // côté client. Sans ce filet, React relançait l'erreur au rendu et tout
    // le fil devenait `app/error.tsx`. Ici : un échec ordinaire — le bouton
    // revient, l'alerte le dit, le focus reste, re-taper réessaie.
    vi.mocked(reactionAction).mockRejectedValue(new Error("action introuvable"));
    render(
      <div>
        <p>Le reste du fil</p>
        <ReactionRow cible={cible} carteNom="Léa" mienne={false} />
      </div>,
    );
    const bouton = screen.getByRole("button", { name: /^Bravo/ });
    await userEvent.click(bouton);
    expect(await screen.findByRole("alert")).toHaveTextContent(/perdue en route/i);
    expect(bouton).toHaveAttribute("aria-pressed", "false");
    expect(bouton).toHaveFocus();
    expect(screen.getByText("Le reste du fil")).toBeInTheDocument();
  });

  it("l'échec se DIT (role=alert) et le bouton revient en arrière — jamais un rollback muet", async () => {
    vi.mocked(reactionAction).mockResolvedValue({
      status: "error",
      error: "Le bravo a été refusé. Recharge la page.",
      values: {},
    } as never);
    render(<ReactionRow cible={cible} carteNom="Léa" mienne={false} />);
    const bouton = screen.getByRole("button", { name: /^Bravo/ });
    await userEvent.click(bouton);
    expect(await screen.findByRole("alert")).toHaveTextContent(/refusé/i);
    expect(bouton).toHaveAttribute("aria-pressed", "false");
  });
});
