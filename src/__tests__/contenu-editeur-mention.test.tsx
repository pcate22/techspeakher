import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

/**
 * Éditeur de contenus — mention @speakeuse. La logique pure est couverte par
 * `mention.test.ts` ; ici on vérifie le câblage UI : taper « @ » ouvre la liste
 * des speakeuses de l'annuaire, la sélection (souris ou clavier) insère un lien
 * Markdown vers la fiche, et un mot ordinaire n'ouvre rien.
 */
vi.mock("@/app/admin/contenus/actions", () => ({
  updateContenuAction: vi.fn(async () => ({ status: "idle" })),
}));

import Editeur from "@/app/admin/contenus/[type]/[slug]/Editeur";
import type { Contenu } from "@/lib/contenus";

afterEach(cleanup);

function contenu(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1,
    type: "publication",
    slug: "mon-article",
    titre: "Mon article",
    chapo: "",
    corps: "",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    videoUrl: null,
    categorie: "Behind the Scenes",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    statut: "brouillon",
    publieLe: null,
    majLe: "2026-06-01T00:00:00Z",
    auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}

const mentions = [
  { name: "Montaine Marteau", href: "/speakeuses/montaine-marteau" },
  { name: "Aurélie Vache", href: "/speakeuses/aurelie-vache" },
];

/** Écrit `valeur` dans le corps avec le curseur au bout (comme une saisie). */
function taperCorps(ta: HTMLTextAreaElement, valeur: string) {
  fireEvent.change(ta, {
    target: { value: valeur, selectionStart: valeur.length, selectionEnd: valeur.length },
  });
}

describe("Éditeur — mention @speakeuse", () => {
  it("ouvre la liste filtrée de l'annuaire et insère un lien au clic", () => {
    render(<Editeur contenu={contenu()} editions={[]} mentions={mentions} />);
    const ta = screen.getByLabelText("Contenu") as HTMLTextAreaElement;

    taperCorps(ta, "Merci @mont");

    const liste = within(screen.getByRole("listbox"));
    const option = liste.getByRole("option", { name: "Montaine Marteau" });
    expect(option).toBeInTheDocument();
    // « mont » ne matche pas Aurélie : une seule option dans la liste des mentions.
    expect(liste.getAllByRole("option")).toHaveLength(1);

    fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(ta.value).toBe("Merci [Montaine Marteau](/speakeuses/montaine-marteau)");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigue au clavier (flèche + Entrée) pour choisir une speakeuse", () => {
    render(<Editeur contenu={contenu()} editions={[]} mentions={mentions} />);
    const ta = screen.getByLabelText("Contenu") as HTMLTextAreaElement;

    // « @a » matche les deux ; Aurélie en tête (préfixe), Montaine ensuite.
    taperCorps(ta, "@a");
    const liste = within(screen.getByRole("listbox"));
    expect(liste.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Aurélie Vache",
      "Montaine Marteau",
    ]);

    fireEvent.keyDown(ta, { key: "ArrowDown" }); // surligne Montaine
    fireEvent.keyDown(ta, { key: "Enter" });

    expect(ta.value).toBe("[Montaine Marteau](/speakeuses/montaine-marteau)");
  });

  it("n'ouvre aucune liste pour un mot ordinaire", () => {
    render(<Editeur contenu={contenu()} editions={[]} mentions={mentions} />);
    const ta = screen.getByLabelText("Contenu") as HTMLTextAreaElement;
    taperCorps(ta, "bonjour tout le monde");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reste inerte quand l'annuaire est vide", () => {
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);
    const ta = screen.getByLabelText("Contenu") as HTMLTextAreaElement;
    taperCorps(ta, "Merci @mont");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
