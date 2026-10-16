import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ListPageTemplate from "@/components/ListPageTemplate";

afterEach(cleanup);

/** Le fil d'Ariane et la sous-nav sont rendus par le layout `[edition]`
 * (lot C3) : la coque ne porte plus que l'en-tête et le contenu. */
describe("ListPageTemplate — coque de page liste", () => {
  it("rend un h1 unique avec le titre + la méta", () => {
    render(
      <ListPageTemplate title="Ateliers" meta="Tremplin 2 · 5 ateliers">
        <ul />
      </ListPageTemplate>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Ateliers" });
    expect(h1).toBeTruthy();
    expect(screen.getByText("Tremplin 2 · 5 ateliers")).toBeTruthy();
  });

  it("rend la zone de création quand fournie", () => {
    render(
      <ListPageTemplate
        title="Ateliers"
        create={<button type="button">Créer un atelier</button>}
      >
        <ul />
      </ListPageTemplate>,
    );
    expect(screen.getByRole("button", { name: "Créer un atelier" })).toBeTruthy();
  });

  it("rend le contenu de liste (children)", () => {
    render(
      <ListPageTemplate title="Ateliers">
        <p>Aucun atelier pour le moment.</p>
      </ListPageTemplate>,
    );
    expect(screen.getByText("Aucun atelier pour le moment.")).toBeTruthy();
  });
});
