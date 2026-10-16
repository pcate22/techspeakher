import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Lot F — « hub franc » : la barre de pastilles de section est supprimée (l'œil
 * ne la trouvait pas ; la navigation vit désormais dans le hub d'édition, en
 * grandes lignes). Ne subsiste ici que le FIL D'ARIANE raciné, rendu par le
 * layout `[edition]` au-dessus de chaque page.
 */

const segmentsMock = vi.fn<() => string[]>();
vi.mock("next/navigation", () => ({ useSelectedLayoutSegments: () => segmentsMock() }));

import EditionSousNav from "@/app/admin/tremplins/[edition]/EditionSousNav";

afterEach(cleanup);

const rendu = (segments: string[]) => {
  segmentsMock.mockReturnValue(segments);
  return render(<EditionSousNav editionId={3} editionNom="Tremplin 2026" />);
};

describe("EditionSousNav — plus de pastilles (hub franc)", () => {
  it("ne rend aucune barre de sections", () => {
    rendu([]);
    expect(screen.queryByRole("navigation", { name: /sections/i })).toBeNull();
  });
});

describe("EditionSousNav — fil d'Ariane raciné", () => {
  it("sur le hub : Espace orga › Tremplins › édition (courante, sans lien)", () => {
    rendu([]);
    const fil = screen.getByRole("navigation", { name: /fil d'ariane/i });
    expect(within(fil).getByRole("link", { name: "Espace organisatrices" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(within(fil).getByRole("link", { name: "Tremplins" })).toHaveAttribute(
      "href",
      "/admin/tremplins",
    );
    expect(within(fil).queryByRole("link", { name: "Tremplin 2026" })).toBeNull();
    expect(within(fil).getByText("Tremplin 2026")).toHaveAttribute("aria-current", "page");
  });

  it("sur une section : l'édition redevient un lien (retour au hub)", () => {
    rendu(["ateliers"]);
    const fil = screen.getByRole("navigation", { name: /fil d'ariane/i });
    expect(within(fil).getByRole("link", { name: "Tremplin 2026" })).toHaveAttribute(
      "href",
      "/admin/tremplins/3",
    );
  });
});
