import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EditionListItem from "@/components/EditionListItem";
import type { Edition } from "@/lib/tremplin-editions";

/**
 * La liste des éditions d'une conférence : UNE entrée par destination.
 *
 * L'édition en cours a deux chapitres (le Tremplin jusqu'à la soirée, puis
 * l'accompagnement vers la scène). Le second a vécu dans un bloc « en deux
 * temps » posé sous la liste — qui rouvrait aussi le premier, déjà là : deux
 * chemins vers la même page à un écran d'écart. Et ses cartes ne se donnaient
 * pas pour cliquables : ni flèche, ni couleur de lien, un `hover:border` qui
 * n'existe pas au doigt.
 */

afterEach(cleanup);

const edition = (annee: number): Edition =>
  ({
    id: annee,
    annee,
    nom: `Tremplin DevFest ${annee}`,
    statut: "en_cours",
    confNom: "DevFest",
    confLieu: "Toulouse",
    confDate: `${annee}-11-19`,
    finaleDate: `${annee}-06-04`,
    inscriptionsDebut: null,
    inscriptionsFin: null,
  }) as unknown as Edition;

describe("ligne d'édition — le second chapitre vit sur la ligne de son édition", () => {
  it("sans suite : une seule destination", () => {
    render(<EditionListItem edition={edition(2025)} confSlug="devfest-toulouse" />);

    const liens = screen.getAllByRole("link");
    expect(liens).toHaveLength(1);
    expect(liens[0].getAttribute("href")).toBe("/tremplin/devfest-toulouse/2025");
  });

  it("avec suite : deux liens, deux destinations, deux noms", () => {
    render(
      <EditionListItem
        edition={edition(2026)}
        confSlug="devfest-toulouse"
        suite={{
          href: "/tremplin/devfest-toulouse/2026/montee-sur-scene",
          libelle: "L'accompagnement vers la scène",
        }}
      />,
    );

    const liens = screen.getAllByRole("link");
    const hrefs = liens.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual([
      "/tremplin/devfest-toulouse/2026",
      "/tremplin/devfest-toulouse/2026/montee-sur-scene",
    ]);
    // Aucune destination servie deux fois : c'était tout le problème.
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("le lien de suite se donne pour un lien : souligné, et hors du lien principal", () => {
    const { container } = render(
      <EditionListItem
        edition={edition(2026)}
        confSlug="devfest-toulouse"
        suite={{ href: "/tremplin/devfest-toulouse/2026/montee-sur-scene", libelle: "La suite" }}
      />,
    );
    const suite = screen.getByRole("link", { name: /La suite/ });

    // Souligné : un `hover:border` ne dit rien à un doigt (WCAG 1.4.1).
    expect(suite.className).toContain("underline");
    expect(suite.className).toContain("text-cyan");
    // Cible d'au moins 44 px (checklist COGA du projet).
    expect(suite.className).toContain("min-h-[44px]");
    // Frère du lien principal, jamais imbriqué : un lien dans un lien n'est pas
    // atteignable au clavier.
    expect(suite.closest("a")).toBe(suite);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });
});
