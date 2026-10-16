import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/NavEspaceServeur", () => ({
  default: () => <nav aria-label="Mon espace" data-testid="navigations" />,
}));

import CoquilleEspace from "@/components/CoquilleEspace";

afterEach(cleanup);

/**
 * L'ORDRE DU DOM de la coquille (revues justesse et RGAA du 2026-10-15).
 * La première version montait les navigations AVANT la page, dans le <main> :
 * sur bureau, « Aller au contenu » tombait sur le rail (9 à 13 arrêts de
 * tabulation avant le titre) ; sur mobile, la barre affichée en bas se lisait
 * et se tabulait avant le contenu — une régression, l'ancien layout la
 * montait après. Le rail est ramené à gauche par la CSS, pas par le DOM.
 */
describe("CoquilleEspace — la page d'abord, les navigations ensuite", () => {
  it("le contenu précède les navigations dans le DOM", () => {
    const { getByTestId, getByText } = render(
      <CoquilleEspace>
        <h1>La page</h1>
      </CoquilleEspace>,
    );
    const contenu = getByText("La page");
    const navigations = getByTestId("navigations");
    expect(
      contenu.compareDocumentPosition(navigations) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
