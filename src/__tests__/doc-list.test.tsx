import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DocList from "@/components/DocList";

afterEach(cleanup);

const doc = (over: Partial<Parameters<typeof DocList>[0]["docs"][number]> = {}) => ({
  id: 1,
  titre: "Trame de pitch",
  lien: null,
  contenu: null,
  ...over,
});

describe("DocList — liste de documents mutualisée", () => {
  it("rend un lien externe (nouvel onglet) quand le document a une URL http(s)", () => {
    render(<DocList docs={[doc({ lien: "https://exemple.fr/trame.pdf" })]} />);
    const a = screen.getByRole("link", { name: /Trame de pitch.*nouvel onglet/i });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("rend le titre en texte simple (pas de lien) quand il n'y a pas d'URL", () => {
    render(<DocList docs={[doc({ titre: "Note du jury" })]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Note du jury")).toBeTruthy();
  });

  it("n'émet pas de lien cliquable pour une URL non http(s) (anti-XSS)", () => {
    render(<DocList docs={[doc({ lien: "javascript:alert(1)" })]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("affiche le contenu en conservant les retours à la ligne", () => {
    render(<DocList docs={[doc({ contenu: "Ligne 1\nLigne 2" })]} />);
    const p = screen.getByText(/Ligne 1/);
    expect(p.className).toContain("whitespace-pre-wrap");
    expect(p.textContent).toContain("Ligne 2");
  });

  it("affiche le message vide quand la liste est vide et qu'un message est fourni", () => {
    render(<DocList docs={[]} empty="Rien pour le moment." />);
    expect(screen.getByText("Rien pour le moment.")).toBeTruthy();
  });

  it("ne rend rien quand la liste est vide sans message", () => {
    const { container } = render(<DocList docs={[]} />);
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("rend l'action par document quand la prop action est fournie", () => {
    render(
      <DocList
        docs={[doc({ id: 7 }), doc({ id: 8, titre: "Autre" })]}
        action={(d) => <button type="button">Supprimer {d.id}</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Supprimer 7" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Supprimer 8" })).toBeTruthy();
  });
});
