import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Avatar from "@/components/Avatar";

afterEach(cleanup);

// `alt=""` donne le rôle ARIA « presentation » (image décorative), pas « img » :
// on cible donc l'élément directement plutôt que par rôle.
function img(container: HTMLElement): HTMLImageElement {
  const el = container.querySelector("img");
  if (!el) throw new Error("Aucune image rendue");
  return el;
}

describe("Avatar", () => {
  it("affiche la photo quand l'URL est http(s)", () => {
    const { container } = render(
      <Avatar name="Ada Lovelace" image="https://cdn.example/ada.png" />,
    );
    expect(img(container)).toHaveAttribute("src", "https://cdn.example/ada.png");
  });

  it("retombe sur les initiales si l'URL échoue au chargement", () => {
    const { container } = render(
      <Avatar name="Ada Lovelace" image="https://cdn.example/morte.png" />,
    );
    fireEvent.error(img(container));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("retente le chargement quand l'URL change après un échec (nouvelle photo déposée)", () => {
    const { rerender, container } = render(
      <Avatar name="Ada Lovelace" image="https://cdn.example/morte.png" />,
    );
    fireEvent.error(img(container));
    expect(container.querySelector("img")).toBeNull(); // repli initiales confirmé

    rerender(<Avatar name="Ada Lovelace" image="https://cdn.example/nouvelle.png" />);
    expect(img(container)).toHaveAttribute("src", "https://cdn.example/nouvelle.png");
  });
});
