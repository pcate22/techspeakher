import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ConferenceSpeakers from "@/components/ConferenceSpeakers";
import type { ConferenceSpeaker } from "@/lib/conference-speakers";

afterEach(cleanup);

function speaker(id: number, name: string, talkTitre: string): ConferenceSpeaker {
  return {
    speaker: {
      id,
      slug: null,
      name,
      nomAffiche: name,
      image: null,
      titreProfil: null,
      poste: "Développeuse",
      entreprise: null,
      regions: [],
      langues: [],
      secteurs: [],
      sujets: [],
    },
    talks: [{ titre: talkTitre, type: "Conférence" }],
  };
}

describe("ConferenceSpeakers", () => {
  it("affiche chaque speakeuse, son talk et un lien vers sa fiche", () => {
    render(
      <ConferenceSpeakers
        titleId="t"
        speakers={[speaker(3, "Asma", "L'IA responsable"), speaker(7, "Montaine", "Dashboards")]}
      />,
    );
    expect(screen.getByText("Asma")).toBeInTheDocument();
    expect(screen.getByText("L'IA responsable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Asma/ })).toHaveAttribute("href", "/speakeuses/3");
    expect(screen.getByRole("link", { name: /Montaine/ })).toHaveAttribute("href", "/speakeuses/7");
  });

  it("ne rend rien quand la liste est vide (repli laissé à la page)", () => {
    const { container } = render(<ConferenceSpeakers titleId="t" speakers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("utilise le titre fourni", () => {
    render(
      <ConferenceSpeakers titleId="t" title="Sur scène" speakers={[speaker(1, "A", "Talk")]} />,
    );
    expect(screen.getByRole("heading", { name: "Sur scène" })).toBeInTheDocument();
  });
});
