// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChoixThemes from "@/app/mon-espace/ChoixThemes";
import { CATEGORIES_THEMES } from "@/data/domaines";

function rendre(initial: string[] = []) {
  return render(
    <form>
      <p id="leg">Tes thèmes</p>
      <ChoixThemes name="sujets" initial={initial} legendId="leg" />
    </form>,
  );
}

function soumis(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>('input[name="sujets"]:checked'),
  ).map((i) => i.value);
}

describe("ChoixThemes", () => {
  afterEach(cleanup);

  it("affiche une catégorie par bouton, toutes fermées", () => {
    rendre();
    const boutons = CATEGORIES_THEMES.map((c) =>
      screen.getByRole("button", { name: new RegExp(c.categorie) }),
    );
    expect(boutons).toHaveLength(7);
    for (const b of boutons) expect(b.getAttribute("aria-expanded")).toBe("false");
  });

  it("ouvre une catégorie et montre ses 4 cases", () => {
    rendre();
    const design = screen.getByRole("button", { name: /^Design/ });
    fireEvent.click(design);
    expect(design.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("ouvrir une catégorie referme la précédente", () => {
    rendre();
    const design = screen.getByRole("button", { name: /^Design/ });
    const produit = screen.getByRole("button", { name: /^Produit/ });
    fireEvent.click(design);
    fireEvent.click(produit);
    expect(produit.getAttribute("aria-expanded")).toBe("true");
    expect(design.getAttribute("aria-expanded")).toBe("false");
  });

  it("compte les thèmes cochés sur la catégorie et dans le récapitulatif", () => {
    const { container } = rendre();
    fireEvent.click(screen.getByRole("button", { name: /^Design/ }));
    fireEvent.click(screen.getByLabelText("Accessibilité"));
    fireEvent.click(screen.getByLabelText("UX / UI"));
    expect(screen.getByRole("button", { name: /^Design/ }).textContent).toContain("2");
    const recap = container.querySelector('[aria-live="polite"]')!;
    expect(recap.textContent).toContain("Tes thèmes (2)");
    expect(recap.textContent).toContain("Accessibilité");
  });

  it("récapitulatif à zéro et pas de compteur sans thème", () => {
    const { container } = rendre();
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toContain(
      "Tes thèmes (0)",
    );
    expect(screen.getByRole("button", { name: /^Design/ }).textContent).not.toMatch(
      /\d/,
    );
  });

  it("un thème initial dans une catégorie fermée reste soumis", () => {
    const { container } = rendre(["Accessibilité"]);
    expect(screen.getByRole("button", { name: /^Design/ }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(soumis(container)).toEqual(["Accessibilité"]);
  });

  it("se pilote au clavier", async () => {
    const user = userEvent.setup();
    const { container } = rendre();
    const design = screen.getByRole("button", { name: /^Design/ });
    design.focus();
    await user.keyboard("{Enter}");
    expect(design.getAttribute("aria-expanded")).toBe("true");
    await user.tab();
    expect((document.activeElement as HTMLInputElement).type).toBe("checkbox");
    expect(document.activeElement!.closest("fieldset")!.id).toBe(
      design.getAttribute("aria-controls"),
    );
    await user.keyboard(" ");
    expect(soumis(container)).toHaveLength(1);
  });

  it("le nom accessible du bouton dit le nombre de thèmes cochés", () => {
    rendre(["Accessibilité", "UX / UI"]);
    expect(
      screen.getByRole("button", { name: "Design, 2 thèmes cochés" }),
    ).toBeTruthy();
    cleanup();
    rendre(["UX / UI"]);
    expect(screen.getByRole("button", { name: "Design, 1 thème coché" })).toBeTruthy();
  });

  it("espace insécable avant les deux-points du récapitulatif", () => {
    const { container } = rendre(["UX / UI"]);
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toContain(
      "(1)\u00a0: UX / UI",
    );
  });

  it("chaque aria-controls désigne un élément existant", () => {
    const { container } = rendre();
    const boutons = screen.getAllByRole("button");
    expect(boutons).toHaveLength(7);
    for (const b of boutons) {
      const id = b.getAttribute("aria-controls")!;
      expect(container.ownerDocument.getElementById(id)).not.toBeNull();
    }
  });
});
