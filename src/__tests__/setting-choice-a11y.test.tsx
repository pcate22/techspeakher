import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import SettingChoice from "@/components/SettingChoice";
import { IDLE, type ActionState } from "@/lib/action-state";

/**
 * RGAA du bloc de réglage à choix. Ce fichier garde ce qu'axe ne voit PAS :
 * axe juge un DOM figé sous jsdom (ni contraste, ni parcours clavier, ni ce
 * qu'un lecteur d'écran annonce vraiment). Le contraste des contours vit dans
 * `contrast.test.ts` (le token `field-border` y est verrouillé >= 3:1 sur les
 * trois fonds sombres) ; le parcours réel passe par `a11y.spec.ts` en
 * navigateur. Ici : les rôles, les noms, les descriptions et l'état.
 */

const OPTIONS = [
  { value: "", label: "Au rythme de l'équipe" },
  { value: "mensuel", label: "Tous les mois" },
  { value: "aucun", label: "Aucun" },
];

/** Action qui n'aboutit jamais : maintient l'état « envoi en cours ». */
const enAttente = () => new Promise<ActionState<object>>(() => {});

function rendre(over: Partial<Parameters<typeof SettingChoice>[0]> = {}) {
  return render(
    <SettingChoice
      action={vi.fn(async () => IDLE) as never}
      name="cadence"
      value=""
      options={OPTIONS}
      label="Rappels sur ma fiche"
      description="Un message de temps en temps pour compléter ta fiche."
      {...over}
    />,
  );
}

afterEach(cleanup);

describe("SettingChoice — regroupement et nommage (RGAA 11.5, 11.1)", () => {
  it("expose UN seul groupe, nommé par sa légende", () => {
    rendre();
    const groupes = screen.getAllByRole("group");
    expect(groupes).toHaveLength(1);
    expect(groupes[0]).toHaveAccessibleName("Rappels sur ma fiche");
    // Et AUCUN `radiogroup` : posé sur un conteneur intérieur, il ajouterait un
    // second regroupement imbriqué (annoncé deux fois). Compter les `group` ne
    // suffit pas à l'attraper — `radiogroup` est un rôle distinct (mesuré).
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
  });

  it("donne à chaque option un intitulé unique", () => {
    rendre();
    const noms = screen
      .getAllByRole("radio")
      .map((r) => r.getAttribute("aria-label") ?? r.closest("label")?.textContent?.trim());
    expect(noms).toEqual(["Au rythme de l'équipe", "Tous les mois", "Aucun"]);
    expect(new Set(noms).size).toBe(noms.length);
  });
});

describe("SettingChoice — l'effet du changement est annoncé (RGAA 11.2, 7.4)", () => {
  it("rattache au groupe sa description ET la note d'enregistrement automatique", () => {
    rendre();
    const groupe = screen.getByRole("group");
    // Sans la note, rien ne dit qu'un simple choix enregistre : la personne
    // cherche un bouton « Valider » qui n'existe pas.
    expect(groupe).toHaveAccessibleDescription(
      /compléter ta fiche[\s\S]*s'enregistre automatiquement/i,
    );
  });

  it("tient une région vivante en permanence, même vide", () => {
    rendre();
    // Créée seulement à l'arrivée du message, elle resterait muette : les
    // lecteurs d'écran n'annoncent que les régions présentes AVANT le
    // changement.
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});

describe("SettingChoice — l'état vient de la sémantique, pas de la couleur (RGAA 3.1)", () => {
  it("coche l'option courante, et elle seule", () => {
    rendre({ value: "aucun" });
    expect(screen.getByRole("radio", { name: /^aucun$/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /rythme de l'équipe/i })).not.toBeChecked();
  });
});

describe("SettingChoice — le clavier garde la main pendant l'envoi (RGAA 12.x / WCAG 2.4.3)", () => {
  it("laisse les options dans le parcours clavier tant que l'action tourne", async () => {
    const u = userEvent.setup();
    rendre({ action: enAttente as never });
    await u.click(screen.getByRole("radio", { name: /tous les mois/i }));

    // `<fieldset disabled>` sortirait les radios du parcours : le focus
    // retomberait sur `body` et on ne pourrait plus atteindre « Aucun » à la
    // flèche. On signale l'occupation par `aria-busy`, jamais par `disabled`.
    await waitFor(() =>
      expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true"),
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeEnabled();
    }
    expect(screen.getByRole("radio", { name: /^aucun$/i })).toBeVisible();
  });
});

describe("SettingChoice — axe", () => {
  it("aucune violation, avec et sans description", async () => {
    const { container } = rendre();
    expect(await axe(container)).toHaveNoViolations();
    cleanup();
    const { container: sansDesc } = rendre({ description: undefined });
    expect(await axe(sansDesc)).toHaveNoViolations();
  });
});
