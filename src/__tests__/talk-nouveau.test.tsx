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

  it("affiche le compteur « 0 / 300 » qui suit la frappe", async () => {
    await rendre();
    expect(screen.getByText("0 / 300")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/titre du talk/i), "abc");
    expect(screen.getByText("3 / 300")).toBeInTheDocument();
  });

  it("propose « Enregistrer » et annonce que le reste vient après", async () => {
    await rendre();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
    expect(screen.getByText(/le reste s'ajoute après, si tu veux/i)).toBeInTheDocument();
  });

  it("lie « Importer » vers /mon-espace/talks/importer", async () => {
    await rendre();
    expect(screen.getByRole("link", { name: "Importer" })).toHaveAttribute(
      "href",
      "/mon-espace/talks/importer",
    );
  });
});
