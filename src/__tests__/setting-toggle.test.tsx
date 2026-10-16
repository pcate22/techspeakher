import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// SettingToggle enregistre à la volée (useActionState) et rafraîchit via le
// router : on neutralise la navigation, on ne teste ici que l'a11y du contrôle.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import SettingToggle from "@/components/SettingToggle";

afterEach(cleanup);

const noop = async () => ({ status: "idle" as const });

describe("SettingToggle — accessibilité du contrôle", () => {
  it("interrupteur : la description ET la note d'auto-enregistrement sont reliées (aria-describedby)", () => {
    render(
      <SettingToggle
        action={noop}
        hidden={{}}
        checked={false}
        label="Phase 1"
        description="Retenue pour pitcher à la soirée."
      />,
    );
    const sw = screen.getByRole("switch", { name: "Phase 1" });
    const ids = (sw.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    const texte = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(texte).toContain("Retenue pour pitcher à la soirée.");
    expect(texte).toContain("enregistre automatiquement");
  });

  it("case à cocher qui révèle un contrôle : aria-expanded + aria-controls (divulgation)", () => {
    render(
      <SettingToggle
        action={noop}
        hidden={{}}
        checked
        control="checkbox"
        label="Finaliste (phase 2)"
        controlsId="dependent-xyz"
      />,
    );
    const cb = screen.getByRole("checkbox", { name: "Finaliste (phase 2)" });
    expect(cb.getAttribute("aria-controls")).toBe("dependent-xyz");
    expect(cb.getAttribute("aria-expanded")).toBe("true");
  });

  it("sans région dépendante : pas d'aria-expanded parasite", () => {
    render(<SettingToggle action={noop} hidden={{}} checked={false} label="Visible" />);
    const sw = screen.getByRole("switch", { name: "Visible" });
    expect(sw.getAttribute("aria-expanded")).toBeNull();
  });
});

/**
 * LE FOCUS NE QUITTE PAS LA LIGNE QU'ON POINTE.
 *
 * Mesuré au navigateur sur l'écran des présences : après un Espace sur
 * « Présente — Léa Dubois », `focusout` à t+6 ms puis `document.activeElement`
 * = `body`, et la tabulation repartait du DÉBUT du document. Il faut 12
 * tabulations pour atteindre la première case, une de plus par personne : la
 * 15ᵉ est à 26 tabulations, et pointer quinze personnes une à une en coûte
 * 285 (WCAG 2.4.3, et 3.2.2 — le focus change tout seul).
 *
 * La cause : `disabled` posé sur le contrôle QUI A LE FOCUS pendant
 * l'aller-retour serveur. Le navigateur le retire du parcours, donc le focus
 * tombe. Le dépôt sait déjà faire autrement — `RangeeGlissante` et
 * `ConfirmSubmitButton` utilisent `aria-disabled` + `preventDefault`, et le
 * commentaire de `RangeeGlissante` dit pourquoi : « un bouton désactivé sort du
 * parcours clavier, donc disparaît au lecteur d'écran ».
 */
describe("SettingToggle — pointer ne fait pas perdre sa place", () => {
  const lent = () =>
    new Promise<{ status: "idle" }>((r) => setTimeout(() => r({ status: "idle" }), 50));

  it("le contrôle reste dans le parcours clavier pendant l'enregistrement", async () => {
    render(
      <SettingToggle action={lent} hidden={{}} checked={false} control="checkbox" label="Présente" />,
    );
    const c = screen.getByRole("checkbox", { name: "Présente" });
    c.focus();
    await userEvent.keyboard(" ");
    // Pendant l'aller-retour : jamais `disabled` (qui éjecterait le focus).
    expect(c).not.toBeDisabled();
    expect(document.activeElement).toBe(c);
    await waitFor(() => expect(c).not.toHaveAttribute("aria-disabled", "true"));
  });

  it("l'indisponibilité s'annonce par aria-disabled, jamais par disabled", () => {
    render(
      <SettingToggle
        action={noop}
        hidden={{}}
        checked={false}
        control="checkbox"
        label="Présente"
        disabled
      />,
    );
    const c = screen.getByRole("checkbox", { name: "Présente" });
    expect(c).not.toBeDisabled();
    expect(c).toHaveAttribute("aria-disabled", "true");
  });

  /** Et un contrôle indisponible ne poste rien, malgré son atteignabilité. */
  it("un contrôle indisponible reste atteignable mais n'envoie rien", async () => {
    const action = vi.fn(async () => ({ status: "idle" as const }));
    render(
      <SettingToggle
        action={action}
        hidden={{}}
        checked={false}
        control="checkbox"
        label="Présente"
        disabled
      />,
    );
    const c = screen.getByRole("checkbox", { name: "Présente" });
    c.focus();
    expect(document.activeElement).toBe(c);
    await userEvent.keyboard(" ");
    expect(action).not.toHaveBeenCalled();
  });
});
