import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SousPage from "@/components/SousPage";

afterEach(cleanup);

describe("SousPage — gabarit des sous-pages mono-fonction (dette #4)", () => {
  it("rend le titre en h1, l'indice, le contenu et la flèche de retour", () => {
    render(
      <SousPage
        titre="Informations"
        indice="Sous-titre d'aide"
        retour={{ href: "/admin/tremplins/3/ateliers/10", label: "Retour à l'atelier" }}
      >
        <p>contenu</p>
      </SousPage>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Informations" })).toBeInTheDocument();
    expect(screen.getByText("Sous-titre d'aide")).toBeInTheDocument();
    expect(screen.getByText("contenu")).toBeInTheDocument();
    const lien = screen.getByRole("link", { name: /retour à l'atelier/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10");
  });

  it("sans indice : pas de paragraphe d'aide", () => {
    render(
      <SousPage titre="Coachs" retour={{ href: "/x", label: "Retour" }}>
        <p>c</p>
      </SousPage>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Coachs" })).toBeInTheDocument();
  });

  it("la flèche de retour a un nom accessible (le libellé) et pointe vers le sommaire", () => {
    render(
      <SousPage titre="Coachs" retour={{ href: "/admin/tremplins/3/ateliers/10", label: "Retour à l'atelier" }}>
        <p>c</p>
      </SousPage>,
    );
    const lien = screen.getByRole("link", { name: /retour à l'atelier/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10");
  });
});
