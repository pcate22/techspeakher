import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn((p: string) => {
    throw new Error(`PERMANENT_REDIRECT:${p}`);
  }),
}));

import { permanentRedirect } from "next/navigation";
import Tremplin2026Redirect from "@/app/tremplin/2026/page";

describe("/tremplin/2026 (redirection legacy)", () => {
  it("redirige en permanence (308) vers la nouvelle URL d'édition", () => {
    expect(() => Tremplin2026Redirect()).toThrow(
      "PERMANENT_REDIRECT:/tremplin/devfest-toulouse/2026",
    );
    // C'est bien une redirection permanente (308), pas un 307.
    expect(permanentRedirect).toHaveBeenCalledWith("/tremplin/devfest-toulouse/2026");
  });
});
