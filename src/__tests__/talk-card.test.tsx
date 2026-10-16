import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TalkCard from "@/components/TalkCard";
import type { Talk, TalkOccurrence } from "@/lib/talks";
import { makeOccurrence } from "./test-helpers";

afterEach(cleanup);

const devfest: TalkOccurrence = makeOccurrence({
  id: 9,
  conferenceId: 1,
  conferenceSlug: "devfest-toulouse",
  conference: "DevFest",
  date: "2025-11",
  lienConf: "https://devfest.example/x",
});

const sunny: TalkOccurrence = makeOccurrence({
  id: 10,
  conferenceId: 2,
  conferenceSlug: "sunny-tech",
  editionId: 42,
  conference: "Sunny Tech 2026",
  ville: "Montpellier",
  date: "2026-06",
  lienConf: "https://sunny.example/y",
  lienSlides: "https://slides.example/sunny",
});

const talk: Talk = {
  id: 5,
  profileId: 2,
  titre: "La méthode pour coder ce qui compte vraiment",
  type: "Conférence",
  description: null,
  occurrences: [devfest],
};

describe("TalkCard", () => {
  it("affiche le titre et le type", () => {
    render(<TalkCard talk={talk} />);
    expect(
      screen.getByText("La méthode pour coder ce qui compte vraiment"),
    ).toBeInTheDocument();
    expect(screen.getByText("Conférence")).toBeInTheDocument();
  });

  it("mode gestion : toute la card est un lien « Gérer » vers la page du talk", () => {
    render(<TalkCard talk={talk} manageHref="/mon-espace/talks/5" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/mon-espace/talks/5",
    );
    expect(screen.getByText(/gérer/i)).toBeInTheDocument();
  });

  it("mode affichage : chaque occurrence porte son lien vers le site de la conférence", () => {
    render(<TalkCard talk={talk} editHref="/mon-espace/talks/5" />);
    expect(
      screen.getByRole("link", { name: /site de la conférence/i }),
    ).toHaveAttribute("href", "https://devfest.example/x");
    expect(screen.getByRole("link", { name: /modifier/i })).toHaveAttribute(
      "href",
      "/mon-espace/talks/5",
    );
  });

  it("affiche la description du talk", () => {
    render(
      <TalkCard
        talk={{ ...talk, description: "Comment prioriser ce qui compte." }}
      />,
    );
    expect(
      screen.getByText("Comment prioriser ce qui compte."),
    ).toBeInTheDocument();
  });

  it("un talk donné à 2 conférences affiche 2 lignes, chacune avec ses liens propres", () => {
    render(<TalkCard talk={{ ...talk, occurrences: [sunny, devfest] }} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("2 conférences")).toBeInTheDocument();
    // Chaque conférence est annoncée par son nom, puis situee en dessous.
    expect(screen.getByText("Sunny Tech 2026")).toBeInTheDocument();
    expect(
      screen.getByText("juin 2026 · Montpellier · France"),
    ).toBeInTheDocument();
    expect(screen.getByText("DevFest")).toBeInTheDocument();
    expect(
      screen.getByText("novembre 2025 · Toulouse · France"),
    ).toBeInTheDocument();

    // Les liens appartiennent à CHAQUE occurrence (pas au talk).
    const sites = screen.getAllByRole("link", {
      name: /site de la conférence/i,
    });
    expect(sites.map((l) => l.getAttribute("href"))).toEqual([
      "https://sunny.example/y",
      "https://devfest.example/x",
    ]);
    expect(screen.getByRole("link", { name: /slides/i })).toHaveAttribute(
      "href",
      "https://slides.example/sunny",
    );
  });

  it("chaque conférence porte son repère visuel (monogramme faute de logo déposé)", () => {
    render(<TalkCard talk={{ ...talk, occurrences: [sunny, devfest] }} />);
    // Les initiales sont décoratives : le nom de la conf est écrit à côté.
    expect(screen.getByText("ST")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("D")).toHaveAttribute("aria-hidden", "true");
  });

  it("une occurrence historique sans nom de conférence reste sur une ligne", () => {
    const libre = { ...devfest, conference: null };
    render(<TalkCard talk={{ ...talk, occurrences: [libre] }} />);
    expect(
      screen.getByText("Toulouse · France · novembre 2025"),
    ).toBeInTheDocument();
  });

  it("un talk sans occurrence (sujet proposé) s'affiche sans liste de conférences", () => {
    render(<TalkCard talk={{ ...talk, occurrences: [] }} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/1 conférence/)).toBeNull();
    expect(
      screen.getByText("La méthode pour coder ce qui compte vraiment"),
    ).toBeInTheDocument();
  });
});

/**
 * Plusieurs cartes sur un même écran donnaient N liens dont le nom accessible
 * entier était « Modifier », pour N destinations (RGAA 6.1 / WCAG 2.4.4). Le
 * titre le complète — par `aria-label`, parce qu'un `sr-only` accolé se recolle
 * sans séparateur et s'énonce « Modifierle talk ».
 */
describe("TalkCard — deux cartes, deux liens « Modifier » distincts", () => {
  it("chaque lien nomme son talk, et le libellé visible reste dedans", () => {
    render(
      <>
        <TalkCard talk={talk} editHref="/mon-espace/talks/5" />
        <TalkCard
          talk={{ ...talk, id: 6, titre: "Un tout autre sujet" }}
          editHref="/mon-espace/talks/6"
        />
      </>,
    );

    const modifier = screen
      .getAllByRole("link")
      .filter((l) =>
        /^Modifier/.test(
          (l.getAttribute("aria-label") ?? l.textContent ?? "").trim(),
        ),
      );
    const noms = modifier.map((l) =>
      (l.getAttribute("aria-label") ?? "").trim(),
    );

    expect(modifier).toHaveLength(2);
    // Deux liens, deux noms : aucun ne s'appelle « Modifier » tout court.
    expect(noms).not.toContain("Modifier");
    expect(new Set(noms).size).toBe(2);
    expect(
      screen
        .getByRole("link", { name: /Un tout autre sujet/ })
        .getAttribute("href"),
    ).toBe("/mon-espace/talks/6");
  });
});
