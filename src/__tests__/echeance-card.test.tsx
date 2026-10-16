import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EcheanceCard from "@/components/EcheanceCard";
import type { EcheanceAgenda } from "@/lib/mon-agenda";

afterEach(cleanup);

/**
 * LA carte d'échéance partagée (home « À venir » + onglet Agenda), façon
 * rangée d'app calendrier : la carte ENTIÈRE mène à son détail (lien étiré),
 * heures en colonne droite (équivalent long sr-only), badge de genre/rôle,
 * raccourci visio/conférence secondaire.
 */

const atelier: Extract<EcheanceAgenda, { genre: "atelier" }> = {
  genre: "atelier",
  atelierId: 7,
  titre: "Revue croisée entre speakeuses",
  date: "2026-09-07",
  dateFin: "2026-09-13",
  heureDebut: null,
  heureFin: null,
  lieu: null,
  lienVisio: "https://meet.example.org/revue",
  role: "participe",
  editionId: 2,
  editionNom: "Tremplin DevFest 2026",
};

const talk: Extract<EcheanceAgenda, { genre: "talk" }> = {
  genre: "talk",
  occurrenceId: 34,
  talkId: 12,
  titre: "Accessibilité sans excuse",
  date: "2026-11-19",
  conference: "DevFest",
  ville: "Toulouse",
  lienConf: "https://devfest.example.org",
};

describe("EcheanceCard — atelier", () => {
  it("la carte mène à son détail (titre = lien étiré) et dit la période accessible", () => {
    render(<EcheanceCard e={atelier} />);
    expect(screen.getByRole("link", { name: "Revue croisée entre speakeuses" })).toHaveAttribute(
      "href",
      // AVEC l'ancre : le détail d'une participante est une RANGÉE de son espace,
      // pas le haut de la page (qui en liste jusqu'à quinze).
      "/mon-espace/tremplin/2/ateliers/7",
    );
    expect(screen.getByText(/du 7 au 13 sept\. 2026/)).toBeInTheDocument();
    expect(screen.getByText(/du 7 au 13 septembre 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Tremplin DevFest 2026/)).toBeInTheDocument();
    const visio = screen.getByRole("link", { name: /Rejoindre la visio/ });
    expect(visio).toHaveAttribute("href", "https://meet.example.org/revue");
  });

  it("heures en colonne droite (empilées) avec équivalent long pour l'audio", () => {
    render(
      <EcheanceCard
        e={{ ...atelier, dateFin: null, heureDebut: "18:30", heureFin: "20:00" }}
      />,
    );
    expect(screen.getAllByText(/18:30/).length).toBeGreaterThan(0);
    expect(screen.getByText("de 18:30 à 20:00")).toBeInTheDocument();
  });

  it("« Tu animes » est dit dès que le rôle est l'animation", () => {
    render(
      <EcheanceCard e={{ ...atelier, role: "anime" }} />,
    );
    expect(screen.getByText("Tu animes")).toBeInTheDocument();
  });

  it("montreDate=false (l'agenda porte la date en en-tête de jour) : seule la période reste", () => {
    render(<EcheanceCard e={{ ...atelier, dateFin: null }} montreDate={false} />);
    expect(screen.queryByText(/sept\. 2026/)).toBeNull();
    // Une FENÊTRE reste dite même sous un en-tête de jour (le jour = son début).
    cleanup();
    render(<EcheanceCard e={atelier} montreDate={false} />);
    expect(screen.getByText(/du 7 au 13 sept\. 2026/)).toBeInTheDocument();
  });

  /**
   * Sous la bande de mois collante (l'agenda), la marge de défilement va sur le
   * LIEN, seul à être la cible du focus — posée sur la carte ou sur le `<li>`,
   * elle reste sans effet et le titre tabulé se glisse sous la bande (WCAG
   * 2.4.11). Même leçon que `SceneCard` sur l'agenda public, où elle avait déjà
   * coûté un aller-retour.
   */
  it("sous la bande de mois, c'est le LIEN qui porte la marge de défilement", () => {
    render(<EcheanceCard e={atelier} montreDate={false} />);
    expect(screen.getByRole("link", { name: atelier.titre })).toHaveClass("scroll-mt-bande-mois");
  });

  it("hors bande collante (la home), le lien garde le défilement du site", () => {
    render(<EcheanceCard e={atelier} />);
    expect(screen.getByRole("link", { name: atelier.titre })).not.toHaveClass("scroll-mt-bande-mois");
  });
});

describe("EcheanceCard — talk", () => {
  it("badge « Talk », conférence et ville, carte vers la page du talk", () => {
    render(<EcheanceCard e={talk} />);
    expect(screen.getByText("Talk")).toBeInTheDocument();
    expect(screen.getByText(/DevFest/)).toBeInTheDocument();
    expect(screen.getByText(/Toulouse/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Accessibilité sans excuse" }),
    ).toHaveAttribute("href", "/mon-espace/talks/12");
    expect(screen.getByRole("link", { name: /Voir la conférence/ })).toHaveAttribute(
      "href",
      "https://devfest.example.org",
    );
  });

  it("sans lien de conférence : la carte garde son seul lien de détail", () => {
    render(<EcheanceCard e={{ ...talk, lienConf: null }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
