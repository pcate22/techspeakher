import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * FilContext : un layout d'entité (participante/atelier) alimente le fil unique
 * de l'édition via SetFilTail — « Section › Nom [› Sous-page] ». La sous-page
 * vient du segment d'URL ; le nom devient courant sur le sommaire.
 */
let segment: string | null = null;
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => segment }));

import SetFilTail, {
  FilProvider,
  useFilTail,
} from "@/app/admin/tremplins/[edition]/FilContext";
import SetFilLeaf from "@/app/admin/tremplins/[edition]/SetFilLeaf";

function Probe() {
  const tail = useFilTail();
  return (
    <ol>
      {tail.map((c, i) => (
        <li key={i} data-href={c.href ?? ""}>
          {c.label}
        </li>
      ))}
    </ol>
  );
}

const props = {
  sectionLabel: "Participantes",
  sectionHref: "/admin/tremplins/3/participantes",
  entiteNom: "Manon Girard",
  entiteHref: "/admin/tremplins/3/participantes/7",
  sousPages: { compte: "Compte" },
};

afterEach(cleanup);

describe("FilContext / SetFilTail", () => {
  it("sous-page : Section (lien) › Nom (lien) › Sous-page (courante)", () => {
    segment = "compte";
    render(
      <FilProvider>
        <SetFilTail {...props} />
        <Probe />
      </FilProvider>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Participantes",
      "Manon Girard",
      "Compte",
    ]);
    expect(items[1].getAttribute("data-href")).toBe(
      "/admin/tremplins/3/participantes/7",
    ); // le nom renvoie au sommaire
    expect(items[2].getAttribute("data-href")).toBe(""); // sous-page = page courante
  });

  it("sommaire (pas de segment) : le nom est le dernier maillon (courant)", () => {
    segment = null;
    render(
      <FilProvider>
        <SetFilTail {...props} />
        <Probe />
      </FilProvider>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Participantes", "Manon Girard"]);
    expect(items[1].getAttribute("data-href")).toBe(""); // nom courant, pas de lien
  });

  it("SetFilLeaf : une sous-page RÉGLAGE d'édition ajoute UN maillon terminal", () => {
    // Pages infos/statut/retrait : pas d'entité, juste le nom de la page —
    // sinon le fil s'arrête à l'édition et on ne voit plus où l'on est.
    render(
      <FilProvider>
        <SetFilLeaf label="Informations" />
        <Probe />
      </FilProvider>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Informations"]);
    expect(items[0].getAttribute("data-href")).toBe(""); // page courante
  });

  it("segment inconnu : pas de maillon sous-page fantôme", () => {
    segment = "inconnu";
    render(
      <FilProvider>
        <SetFilTail {...props} />
        <Probe />
      </FilProvider>,
    );
    expect(screen.getAllByRole("listitem").map((i) => i.textContent)).toEqual([
      "Participantes",
      "Manon Girard",
    ]);
  });
});
