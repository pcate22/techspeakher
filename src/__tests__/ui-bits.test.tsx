import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import Avatar from "@/components/Avatar";
import { initials } from "@/lib/initiales";
import ChipGroup from "@/components/ChipGroup";

afterEach(cleanup);

describe("initials", () => {
  it("prend la 1re lettre des deux premiers mots", () => {
    expect(initials("Cateline Puccetti")).toBe("CP");
    expect(initials("Aurélie")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});

describe("Avatar", () => {
  it("affiche les initiales sans photo", () => {
    render(<Avatar name="Marie Curie" image={null} />);
    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("affiche une image quand fournie", () => {
    const { container } = render(
      <Avatar name="Marie Curie" image="https://img/x.jpg" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://img/x.jpg",
    );
  });

  it("retombe sur les initiales si la photo ne charge pas", () => {
    const { container } = render(
      <Avatar name="Marie Curie" image="https://img/casse.jpg" />,
    );
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("MC")).toBeInTheDocument();
  });
});

describe("ChipGroup", () => {
  it("affiche le label et les items", () => {
    render(<ChipGroup label="Secteurs" items={["Fintech", "Santé"]} />);
    expect(screen.getByText("Secteurs")).toBeInTheDocument();
    expect(screen.getByText("Fintech")).toBeInTheDocument();
  });

  it("limite avec max et ajoute un +N", () => {
    render(<ChipGroup label="Sujets" items={["A", "B", "C"]} max={2} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("ne rend rien si vide", () => {
    const { container } = render(<ChipGroup label="Vide" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
