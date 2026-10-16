import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import Completude, {
  CHANTIERS_MASQUES_KEY,
} from "@/components/Completude";
import { completude } from "@/lib/completude";
import { makeProfile } from "./test-helpers";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const fichePubliee = (over = {}) =>
  makeProfile({
    titreProfil: "Ingénieure",
    bio: "Salut",
    secteurs: ["MedTech / Santé"],
    sujets: ["IA / Machine Learning / Data"],
    linkedin: "https://lk/x",
    isWoman: true,
    status: "publie",
    ...over,
  });

describe("Completude (composant)", () => {
  it("beaucoup à faire (fiche vide) : regroupé par étapes, sans numéro de stepper", () => {
    const { chantiers } = completude(makeProfile(), 0);
    render(<Completude chantiers={chantiers} />);
    // Groupes présents (icônes + compteur, jamais un numéro d'ordre).
    expect(screen.getByRole("link", { name: /profil/i })).toBeInTheDocument();
    // Le groupe « contact » agrège 2 champs (moyen de contact + réseaux).
    expect(screen.getByText(/2 champs/i)).toBeInTheDocument();
    // Aucune pastille numérotée « 1 » / « 2 » comme tête de ligne.
    expect(screen.queryByText(/^1$/)).toBeNull();
  });

  it("peu à faire (fiche publiée, champs vides) : à plat, enrichissements masquables", () => {
    const { chantiers } = completude(fichePubliee(), 1);
    render(<Completude chantiers={chantiers} />);
    expect(
      screen.getByRole("link", { name: /localisation & langues/i }),
    ).toBeInTheDocument();
    // Deux enrichissements → deux boutons « Plus tard ».
    expect(screen.getAllByRole("button", { name: /plus tard/i })).toHaveLength(2);
  });

  it("« Plus tard » masque l'enrichissement et le mémorise", async () => {
    const { chantiers } = completude(
      fichePubliee({ website: "https://moi.dev" }),
      1,
    );
    render(<Completude chantiers={chantiers} />);
    // Seul « localisation & langues » reste à faire (réseaux fait).
    const bouton = screen.getByRole("button", { name: /plus tard/i });
    fireEvent.click(bouton);
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /localisation & langues/i })).toBeNull(),
    );
    expect(JSON.parse(localStorage.getItem(CHANTIERS_MASQUES_KEY)!)).toContain(
      "localisation-langues",
    );
  });

  it("rien à faire → n'affiche rien", () => {
    const { chantiers } = completude(
      fichePubliee({
        ville: "Toulouse",
        regions: ["Occitanie", "Bretagne"],
        langues: ["Français", "Anglais"],
        website: "https://moi.dev",
      }),
      1,
    );
    const { container } = render(<Completude chantiers={chantiers} />);
    expect(container).toBeEmptyDOMElement();
  });
});
