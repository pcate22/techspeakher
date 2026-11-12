import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/mon-espace/actions", () => ({
  addTalkAction: vi.fn(),
  updateTalkAction: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/Breadcrumb", () => ({ default: () => null }));

import NouveauTalk from "@/app/mon-espace/talks/nouveau/page";

afterEach(cleanup);

async function rendre() {
  render(await NouveauTalk());
}

describe("page « Ajouter un talk » (création express)", () => {
  it("rend un seul champ de saisie : le titre", async () => {
    await rendre();
    const champs = screen
      .getAllByRole("textbox")
      .concat(screen.queryAllByRole("combobox"));
    expect(champs).toHaveLength(1);
    expect(screen.getByLabelText(/titre du talk/i)).toHaveAttribute("name", "titre");
  });

  it("affiche le compteur « 0 / 300 caractères » qui suit la frappe", async () => {
    await rendre();
    expect(screen.getByText(/^0 \/ 300 caractères/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/titre du talk/i), "abc");
    expect(screen.getByText(/^3 \/ 300 caractères/)).toBeInTheDocument();
  });

  // Le compteur et « le reste vient après » sont dans l'indice du champ : un
  // lecteur d'écran les entend en arrivant sur le titre.
  it("propose « Enregistrer » et le champ annonce que le reste vient après", async () => {
    await rendre();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
    expect(screen.getByLabelText(/titre du talk/i)).toHaveAccessibleDescription(
      "0 / 300 caractères. Le reste s'ajoute après, si tu veux.",
    );
  });

  it("propose l'import par un lien « Importe-les »", async () => {
    await rendre();
    const lien = screen.getByRole("link", { name: "Importe-les" });
    expect(lien).toHaveAttribute("href", "/mon-espace/talks/importer");
    expect(lien.parentElement!.textContent).toBe(
      "Tes talks sont sur Notist ou dans un fichier\u00a0? Importe-les",
    );
  });
});
