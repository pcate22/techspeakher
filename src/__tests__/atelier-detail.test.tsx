import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AtelierDetail from "@/components/AtelierDetail";

afterEach(cleanup);

const supports = [{ id: 1, titre: "Trame de pitch", lien: null, contenu: null }];

describe("AtelierDetail — coque mutualisée (participante / coach)", () => {
  it("rend le titre au niveau demandé, avec son id (pour aria-labelledby)", () => {
    render(<AtelierDetail titre="Construire son pitch" as="h2" titreId="a-7" supports={[]} />);
    const h = screen.getByRole("heading", { level: 2, name: "Construire son pitch" });
    expect(h.id).toBe("a-7");
  });

  it("rend le titre sans rôle heading quand as=\"p\" (usage participante en liste)", () => {
    render(<AtelierDetail titre="Atelier" as="p" supports={[]} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Atelier")).toBeTruthy();
  });

  it("affiche la méta telle que fournie par l'appelant (aucun format imposé)", () => {
    render(<AtelierDetail titre="A" meta="19 mars · 14:00–16:00 · Coach : Léa" supports={[]} />);
    expect(screen.getByText("19 mars · 14:00–16:00 · Coach : Léa")).toBeTruthy();
  });

  it("rend un lien visio sûr, et rien pour une visio absente", () => {
    const { rerender } = render(
      <AtelierDetail titre="A" lienVisio="https://meet.example/xyz" supports={[]} />,
    );
    expect(screen.getByRole("link", { name: /Rejoindre la visio/i })).toBeTruthy();
    rerender(<AtelierDetail titre="A" lienVisio={null} supports={[]} />);
    expect(screen.queryByRole("link", { name: /Rejoindre la visio/i })).toBeNull();
  });

  it("délègue les supports à DocList (message vide inclus)", () => {
    render(<AtelierDetail titre="A" supports={[]} supportsEmpty="Pas de support." />);
    expect(screen.getByText("Pas de support.")).toBeTruthy();
  });

  it("rend l'action par support (suppression selon le rôle)", () => {
    render(
      <AtelierDetail
        titre="A"
        supports={supports}
        supportAction={(d) => <button type="button">Suppr {d.id}</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Suppr 1" })).toBeTruthy();
  });

  it("rend les enfants après les supports (ex. dépôt coach)", () => {
    render(
      <AtelierDetail titre="A" supports={[]}>
        <button type="button">Déposer un document</button>
      </AtelierDetail>,
    );
    expect(screen.getByRole("button", { name: "Déposer un document" })).toBeTruthy();
  });
});
