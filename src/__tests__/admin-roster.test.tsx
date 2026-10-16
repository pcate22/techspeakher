import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RosterFilter, { type RosterProfile } from "@/app/admin/speakeuses/RosterFilter";

const profiles: RosterProfile[] = [
  { id: 1, nomAffiche: "Alice Publiée", image: null, status: "publie", updatedAt: null, validatedAt: null },
  { id: 2, nomAffiche: "Bea Attente", image: null, status: "en_attente", updatedAt: null, validatedAt: null },
  { id: 3, nomAffiche: "Cléo Brouillon", image: null, status: "brouillon", updatedAt: null, validatedAt: null },
  { id: 4, nomAffiche: "Dina Publiée", image: null, status: "publie", updatedAt: null, validatedAt: null },
];

describe("RosterFilter — vues par statut (espace orga)", () => {
  afterEach(() => cleanup());

  const tab = (re: RegExp) => screen.getByRole("button", { name: re });

  it("affiche toutes les fiches par défaut (vue « Toutes »)", () => {
    render(<RosterFilter profiles={profiles} />);
    expect(screen.getByText("Alice Publiée")).toBeInTheDocument();
    expect(screen.getByText("Bea Attente")).toBeInTheDocument();
    expect(screen.getByText("Cléo Brouillon")).toBeInTheDocument();
  });

  it("n'affiche d'onglet que pour les statuts présents, avec compteur", () => {
    render(<RosterFilter profiles={profiles} />);
    expect(tab(/Toutes \(4\)/)).toBeInTheDocument();
    expect(tab(/Publiée \(2\)/)).toBeInTheDocument();
    expect(tab(/En attente \(1\)/)).toBeInTheDocument();
    expect(tab(/Brouillon \(1\)/)).toBeInTheDocument();
    // Aucune fiche refusée → pas de bouton « Refusée ».
    expect(screen.queryByRole("button", { name: /Refusée/ })).not.toBeInTheDocument();
  });

  it("filtre sur les fiches publiées", () => {
    render(<RosterFilter profiles={profiles} />);
    fireEvent.click(tab(/Publiée \(2\)/));
    expect(screen.getByText("Alice Publiée")).toBeInTheDocument();
    expect(screen.getByText("Dina Publiée")).toBeInTheDocument();
    expect(screen.queryByText("Bea Attente")).not.toBeInTheDocument();
    expect(screen.queryByText("Cléo Brouillon")).not.toBeInTheDocument();
  });

  it("filtre sur les fiches en attente de validation", () => {
    render(<RosterFilter profiles={profiles} />);
    fireEvent.click(tab(/En attente \(1\)/));
    expect(screen.getByText("Bea Attente")).toBeInTheDocument();
    expect(screen.queryByText("Alice Publiée")).not.toBeInTheDocument();
  });

  it("annonce le résultat du filtrage, filtre actif nommé", () => {
    render(<RosterFilter profiles={profiles} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("4 fiches");
    fireEvent.click(tab(/Publiée \(2\)/));
    expect(region).toHaveTextContent("2 fiches au statut Publiée");
  });

  it("groupe les filtres sous un intitulé, sans faux onglets", () => {
    render(<RosterFilter profiles={profiles} />);
    expect(
      screen.getByRole("group", { name: "Filtrer les fiches par statut" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("chaque fiche est un lien vers la fiche (vue orga)", () => {
    render(<RosterFilter profiles={profiles} />);
    expect(screen.getByRole("link", { name: /alice publiée/i })).toHaveAttribute(
      "href",
      "/speakeuses/1",
    );
  });

  it("le filtre actif porte aria-pressed=true", () => {
    render(<RosterFilter profiles={profiles} />);
    expect(tab(/Toutes/)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tab(/Brouillon/));
    expect(tab(/Brouillon/)).toHaveAttribute("aria-pressed", "true");
    expect(tab(/Toutes/)).toHaveAttribute("aria-pressed", "false");
  });
});
