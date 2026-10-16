import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import SpeakeusesFilter from "@/app/speakeuses/SpeakeusesFilter";
import type { SpeakerProfile } from "@/lib/profiles";
import { makeProfile } from "./test-helpers";

const profile = (over: Partial<SpeakerProfile>): SpeakerProfile =>
  makeProfile({ id: 0, userId: 0, name: null, isWoman: true, status: "publie", ...over });

const mockProfiles: SpeakerProfile[] = [
  profile({ id: 1, name: "Alice Test", secteurs: ["Fintech / Finance / Assurance"], sujets: ["IA / Machine Learning / Data"], regions: ["Occitanie"], langues: ["Anglais"] }),
  profile({ id: 2, name: "Bob Test", sujets: ["UX / Design / Accessibilité"], regions: ["Île-de-France"] }),
  profile({ id: 3, name: "Claire Test", sujets: ["IA / Machine Learning / Data", "Mobile"], langues: ["Anglais"] }),
];

describe("SpeakeusesFilter", () => {
  afterEach(() => cleanup());

  /** Ouvre le panneau de filtres (replié par défaut) et renvoie la puce voulue. */
  function openFilters() {
    fireEvent.click(screen.getByRole("button", { name: /filtrer/i }));
  }
  const chip = (label: string) =>
    screen.getAllByRole("button").find((b) => b.textContent === label)!;

  it("affiche toutes les speakeuses par défaut", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    expect(screen.getByText("Bob Test")).toBeInTheDocument();
    expect(screen.getByText("Claire Test")).toBeInTheDocument();
  });

  it("chaque carte est un lien vers la fiche", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    expect(screen.getByRole("link", { name: /alice test/i })).toHaveAttribute(
      "href",
      "/speakeuses/1",
    );
  });

  it("les filtres sont repliés par défaut, révélés par « Filtrer »", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    // Le panneau reste dans le DOM (pour que aria-controls résolve) mais masqué.
    expect(screen.getByText("Occitanie")).not.toBeVisible();
    openFilters();
    expect(screen.getByText("Occitanie")).toBeVisible();
  });

  it("expose secteurs, sujets, régions et langues comme filtres", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toContain("IA / Machine Learning / Data");
    expect(names).toContain("Fintech / Finance / Assurance");
    expect(names).toContain("Occitanie");
    expect(names).toContain("Île-de-France");
    expect(names).toContain("Anglais");
  });

  it("filtre par sujet quand on active une puce", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    fireEvent.click(chip("UX / Design / Accessibilité"));
    expect(screen.getByText("Bob Test")).toBeInTheDocument();
    expect(screen.queryByText("Alice Test")).not.toBeInTheDocument();
    expect(screen.queryByText("Claire Test")).not.toBeInTheDocument();
  });

  it("multi-sélection dans une catégorie = OU (Occitanie + Île-de-France)", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    fireEvent.click(chip("Occitanie"));
    fireEvent.click(chip("Île-de-France"));
    // Les DEUX restent actives (le bug : la 2e décochait la 1re).
    expect(chip("Occitanie")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Île-de-France")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    expect(screen.getByText("Bob Test")).toBeInTheDocument();
    expect(screen.queryByText("Claire Test")).not.toBeInTheDocument();
  });

  it("multi-sélection entre catégories = ET (Occitanie ET Anglais = Alice)", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    fireEvent.click(chip("Occitanie")); // zone
    fireEvent.click(chip("Anglais")); // langue
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    // Claire parle anglais mais n'est pas en Occitanie → exclue.
    expect(screen.queryByText("Claire Test")).not.toBeInTheDocument();
    expect(screen.queryByText("Bob Test")).not.toBeInTheDocument();
  });

  it("« Tout effacer » réinitialise la sélection des filtres", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    fireEvent.click(chip("Occitanie"));
    expect(screen.queryByText("Bob Test")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tout effacer/i }));
    expect(screen.getByText("Bob Test")).toBeInTheDocument();
  });

  // NB : la recherche s'appuie désormais sur le matcher partagé (Fuse chargé à
  // la demande) → asynchrone. On attend donc le recalcul via findBy/waitFor.
  it("« Tout effacer » vide les filtres mais CONSERVE la recherche (contrôle séparé)", async () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    // "test" matche les trois (les noms se terminent par « Test »).
    fireEvent.change(input, { target: { value: "test" } });
    openFilters();
    fireEvent.click(chip("Occitanie")); // ne reste qu'Alice
    await waitFor(() => expect(screen.queryByText("Bob Test")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /tout effacer/i }));
    // Filtres vidés → Bob revient ; la recherche saisie reste en place.
    expect((input as HTMLInputElement).value).toBe("test");
    expect(await screen.findByText("Bob Test")).toBeInTheDocument();
  });

  it("recherche par nom (insensible aux accents)", async () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "bob" } });
    expect(await screen.findByText("Bob Test")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Alice Test")).not.toBeInTheDocument());
  });

  it("recherche sur les zones (« ile » retrouve Île-de-France)", async () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "ile-de-france" } });
    expect(await screen.findByText("Bob Test")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Alice Test")).not.toBeInTheDocument());
  });

  it("recherche + filtre se combinent (ET)", async () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    fireEvent.click(chip("Anglais")); // Alice + Claire
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "claire" } });
    expect(await screen.findByText("Claire Test")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Alice Test")).not.toBeInTheDocument());
  });

  it("affiche un message quand l'annuaire est vide", () => {
    render(<SpeakeusesFilter profiles={[]} />);
    expect(screen.getByText(/annuaire arrive bientôt/i)).toBeInTheDocument();
  });

  it("message dédié quand aucune speakeuse ne correspond", async () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "zzzintrouvable" } });
    expect(await screen.findByText(/aucune speakeuse ne correspond/i)).toBeInTheDocument();
  });

  it("cherche dans le plein-texte (bio/talks) fourni par searchText", async () => {
    render(
      <SpeakeusesFilter profiles={mockProfiles} searchText={{ 1: "passionnée de Kubernetes" }} />,
    );
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "kubernetes" } });
    // Alice remonte par sa bio, alors que « Kubernetes » n'est sur aucune carte.
    expect(await screen.findByText("Alice Test")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Bob Test")).not.toBeInTheDocument());
  });

  it("tolère une faute de frappe (moteur partagé : « kubernets »)", async () => {
    render(
      <SpeakeusesFilter profiles={mockProfiles} searchText={{ 1: "passionnée de Kubernetes" }} />,
    );
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "kubernets" } });
    expect(await screen.findByText("Alice Test")).toBeInTheDocument();
  });

  it("une requête d'1 caractère n'applique pas de filtre texte (seuil du moteur)", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "b" } });
    // Tout reste affiché, et le compteur ne prétend pas « correspondant ».
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    expect(screen.getByText("Bob Test")).toBeInTheDocument();
    expect(screen.queryByText(/correspondant/i)).not.toBeInTheDocument();
  });

  it("classe par pertinence : un match sur le nom passe devant un match bio", async () => {
    const profiles = [
      profile({ id: 10, name: "Kubernetes Fan" }),
      profile({ id: 11, name: "Alpha Test" }),
    ];
    render(<SpeakeusesFilter profiles={profiles} searchText={{ 11: "adore kubernetes" }} />);
    const input = screen.getByRole("searchbox", { name: /rechercher/i });
    fireEvent.change(input, { target: { value: "kubernetes" } });
    await screen.findByText("Kubernetes Fan");
    // Les deux matchent, mais le nom (poids fort) remonte en premier.
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Kubernetes Fan");
  });

  it("la puce active porte aria-pressed=true", () => {
    render(<SpeakeusesFilter profiles={mockProfiles} />);
    openFilters();
    const ia = chip("IA / Machine Learning / Data");
    expect(ia).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(ia);
    expect(chip("IA / Machine Learning / Data")).toHaveAttribute("aria-pressed", "true");
  });

  it("la section résultats a aria-live=polite", () => {
    const { container } = render(<SpeakeusesFilter profiles={mockProfiles} />);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
