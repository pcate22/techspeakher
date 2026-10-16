import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import NavRow from "@/components/NavRow";

afterEach(cleanup);

describe("NavRow — ligne cliquable mutualisée (hub, listes)", () => {
  it("rend un lien vers href avec le titre", () => {
    render(<NavRow href="/admin/tremplins/2/ateliers/7" title="Construire son pitch" />);
    const a = screen.getByRole("link", { name: /Construire son pitch/ });
    expect(a.getAttribute("href")).toBe("/admin/tremplins/2/ateliers/7");
  });

  it("affiche le sous-titre", () => {
    render(<NavRow href="/x" title="A" subtitle="19 mars · ouvert à toutes" />);
    expect(screen.getByText("19 mars · ouvert à toutes")).toBeTruthy();
  });

  it("colore le sous-titre en orange quand flag, MAIS l'info reste dans le texte (RGAA)", () => {
    render(<NavRow href="/x" title="Photos" subtitle="2 bloquées : accord manquant" flag />);
    const sub = screen.getByText("2 bloquées : accord manquant");
    expect(sub.className).toContain("text-orange");
  });

  it("rend les badges en aria-hidden et expose leur équivalent texte", () => {
    render(
      <NavRow
        href="/x"
        title="Marie"
        badges={["✓", "★"]}
        badgesLabel="compte relié, finaliste"
      />,
    );
    // Les symboles ne sont pas annoncés ; l'équivalent texte l'est.
    expect(screen.getByText("compte relié, finaliste")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Marie/ });
    expect(link.textContent).toContain("✓");
  });

  /**
   * On tronque une DONNÉE (un nom, un sujet de talk), jamais une DESTINATION :
   * qui ne peut pas deviner la fin d'un intitulé ne peut pas choisir où aller.
   * Relecture d'accessibilité cognitive du 2026-08-16 (cf.
   * `docs/conception-profil-et-a-faire.md` §5 P2).
   */
  it("par défaut, un titre long dispose de DEUX lignes (jamais coupé sur une)", () => {
    render(<NavRow href="/x" title="Ateliers du tremplin en cours" />);
    const titre = screen.getByText("Ateliers du tremplin en cours");
    expect(titre.className).not.toContain("truncate");
    expect(titre.className).toContain("line-clamp-2");
  });

  /**
   * La coupure à UNE ligne a été retirée de l'API le 2026-08-16 : la règle
   * disait « on tronque une donnée, jamais une destination », mais aucune
   * rangée du produit ne s'en servait — l'option n'existait plus que pour
   * qu'on la reprenne un jour par inadvertance. Une option qu'aucun appelant
   * n'utilise est une invitation, pas une capacité (relecture RGAA du
   * 2026-08-16). Le type l'interdit désormais ; ce test dit qu'aucune rangée
   * ne coupe sur une ligne, quel que soit le chemin.
   */
  it("aucune rangée ne coupe son titre sur une seule ligne", () => {
    render(<NavRow href="/x" title="Un titre de talk très long" />);
    expect(screen.getByText("Un titre de talk très long").className).not.toContain("truncate");
  });

  it("titleClamp=\"none\" : l'intitulé s'affiche en entier", () => {
    render(<NavRow href="/x" title="Un intitulé qu'on doit lire en entier" titleClamp="none" />);
    const titre = screen.getByText("Un intitulé qu'on doit lire en entier");
    expect(titre.className).not.toContain("truncate");
    expect(titre.className).not.toContain("line-clamp-2");
  });

  it("rend un élément de tête optionnel (compteur, miniature)", () => {
    render(<NavRow href="/x" title="Ateliers" leading={<span>5</span>} />);
    const link = screen.getByRole("link", { name: /Ateliers/ });
    expect(link.textContent).toContain("5");
  });
});
