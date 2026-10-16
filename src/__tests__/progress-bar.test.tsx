import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProgressBar from "@/components/ProgressBar";

afterEach(cleanup);

describe("ProgressBar", () => {
  it("expose un role progressbar avec les valeurs ARIA", () => {
    render(<ProgressBar value={75} label="Profil complété" />);
    const bar = screen.getByRole("progressbar", { name: /profil complété/i });
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("borne la valeur entre 0 et 100", () => {
    render(<ProgressBar value={140} label="x" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
