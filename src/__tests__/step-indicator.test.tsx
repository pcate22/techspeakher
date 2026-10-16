import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import StepIndicator from "@/components/StepIndicator";

afterEach(cleanup);

const steps = ["Profil", "Domaines", "Contact"];

describe("StepIndicator", () => {
  it("liste les étapes et marque l'étape courante", () => {
    render(<StepIndicator current={1} steps={steps} />);
    expect(screen.getByText("Domaines")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Profil")).not.toHaveAttribute("aria-current");
  });

  it("a une étiquette accessible de progression", () => {
    render(<StepIndicator current={0} steps={steps} />);
    expect(
      screen.getByRole("list", { name: /progression/i }),
    ).toBeInTheDocument();
  });

  // Sur 402 px, une étape par ligne consommait tout le premier écran : aucun
  // champ visible sous le titre. Les pastilles tiennent sur UNE ligne et seule
  // l'étape courante est nommée à l'œil — les autres restent lues à la voix.
  it("mobile : une seule ligne, seule l'étape courante est nommée visuellement", () => {
    render(<StepIndicator current={1} steps={steps} />);
    expect(screen.getByRole("list", { name: /progression/i }).className).not.toContain(
      "flex-col",
    );
    expect(screen.getByText("Domaines").className).not.toContain("sr-only");
    for (const autre of ["Profil", "Contact"]) {
      const label = screen.getByText(autre);
      expect(label.className).toContain("sr-only");
      expect(label.className).toContain("sm:not-sr-only");
    }
  });

  // WebKit/VoiceOver retire la sémantique de liste dès `list-style: none`, et
  // les numéros de pastille sont `aria-hidden` : la position serait perdue.
  it("porte un `role=\"list\"` explicite malgré `list-none`", () => {
    const { container } = render(<StepIndicator current={0} steps={steps} />);
    expect(container.querySelector("ol")).toHaveAttribute("role", "list");
  });

  it("les pastilles portent le contour calibré `field-border`", () => {
    const { container } = render(<StepIndicator current={0} steps={steps} />);
    expect(container.querySelectorAll("[class*=border-navy-lighter]")).toHaveLength(0);
  });
});
