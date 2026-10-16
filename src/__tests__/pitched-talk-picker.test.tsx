import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * `PitchedTalkPicker` est MUTUALISÉ orga ↔ speakeuse (guide §3) : ses libellés
 * et le lien « Modifier » de chaque option sont injectés (chaînes sérialisables,
 * jamais de fonction serveur → client). On fige ici ces capacités : la légende,
 * le lien par option, le badge du talk pitché, l'option de retrait, la pastille
 * « Proposition ».
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import PitchedTalkPicker from "@/components/PitchedTalkPicker";

afterEach(cleanup);

const options = [
  { id: 10, titre: "Effet Matilda", meta: "Conférence · DevFest", editHref: "/x/talk/10" },
  { id: 11, titre: "Un sujet à donner", meta: "Sujet proposé", editHref: "/x/talk/11", proposition: true },
];

const noop = vi.fn(async () => ({ status: "idle" as const }));

describe("PitchedTalkPicker (mutualisé)", () => {
  it("affiche la légende injectée (voix de l'appelante)", () => {
    render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={null}
        legend="Quel talk pitches-tu ?"
      />,
    );
    expect(screen.getByText("Quel talk pitches-tu ?")).toBeInTheDocument();
  });

  it("chaque option porte SON lien « Modifier » (editHref sérialisable)", () => {
    render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={null}
        legend="Quel talk ?"
      />,
    );
    const liens = screen.getAllByRole("link", { name: /modifier/i });
    expect(liens.map((a) => a.getAttribute("href"))).toEqual(["/x/talk/10", "/x/talk/11"]);
  });

  it("badge « talk pitché » sur l'option présélectionnée (pitchedId)", () => {
    render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={10}
        legend="Quel talk ?"
        pitchedBadge="★ Mon talk pitché"
      />,
    );
    const radioPitche = screen.getByRole("radio", { name: /effet matilda/i }) as HTMLInputElement;
    expect(radioPitche.checked).toBe(true);
    expect(screen.getByText("★ Mon talk pitché")).toBeInTheDocument();
  });

  it("expose l'option de retrait en forme positive (noneLabel injectable)", () => {
    render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={null}
        legend="Quel talk ?"
        noneLabel="Aucun pour l'instant"
      />,
    );
    // Le radio « Aucun » est coché quand aucun talk n'est pitché.
    const aucun = screen.getByRole("radio", { name: /aucun pour l'instant/i }) as HTMLInputElement;
    expect(aucun.checked).toBe(true);
  });

  it("pastille « Proposition » sur un talk encore à l'état de sujet proposé", () => {
    render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={null}
        legend="Quel talk ?"
      />,
    );
    const proposition = screen.getByRole("radio", { name: /un sujet à donner/i });
    const ligne = proposition.closest("div") as HTMLElement;
    expect(within(ligne).getByText("Proposition")).toBeInTheDocument();
  });

  it("chemin speakeuse : sans registrationId, aucun champ caché registrationId (anti-IDOR)", () => {
    const { container } = render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        options={options}
        pitchedId={null}
        legend="Quel talk ?"
      />,
    );
    expect(container.querySelector('input[name="registrationId"]')).toBeNull();
    expect(container.querySelector('input[name="editionId"]')).not.toBeNull();
  });

  it("chemin orga : registrationId fourni → champ caché posé", () => {
    const { container } = render(
      <PitchedTalkPicker
        action={noop}
        editionId={3}
        registrationId={77}
        options={options}
        pitchedId={null}
        legend="Quel talk ?"
      />,
    );
    const hidden = container.querySelector('input[name="registrationId"]') as HTMLInputElement;
    expect(hidden?.value).toBe("77");
  });
});
