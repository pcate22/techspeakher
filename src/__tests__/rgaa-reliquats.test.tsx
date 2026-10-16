import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";

/**
 * Les quatre reliquats RGAA du parcours speakeuse. Petits, sur les mêmes écrans,
 * et chacun casse une chose que le clavier attend :
 *
 * 1. le dialogue de garde ne rend pas le focus au lien qu'il a intercepté ;
 * 2. N liens « Modifier » de même nom pour N talks différents ;
 * 3. un saut de niveau h1 → h3 dans les champs de contact ;
 * 4. un maillon de fil d'Ariane replié reste tabulable, invisible et sans anneau.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/mon-espace/fiche" }));
vi.mock("@/app/mon-espace/actions", () => ({
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));

import { useGardeSortie, DialogueSortie } from "@/app/mon-espace/GardeSortie";
import PitchedTalkPicker from "@/components/PitchedTalkPicker";
import { IDLE } from "@/lib/action-state";
import { ChampsContact } from "@/app/mon-espace/ChampsSection";
import Breadcrumb from "@/components/Breadcrumb";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Un écran minimal qui a une saisie en cours et un lien pour en sortir. */
function EcranAvecGarde() {
  const { sortieVoulue, setSortieVoulue, rendreLeFocus } = useGardeSortie(true);
  return (
    <>
      {/* Un `<a>` brut, volontairement : la garde intercepte au niveau du
          DOCUMENT, donc tout lien de la page — pas seulement ceux qu'on a
          pensé à câbler. C'est ce chemin-là qu'on vérifie. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/mon-espace">Mon espace</a>
      <DialogueSortie
        sortieVoulue={sortieVoulue}
        setSortieVoulue={setSortieVoulue}
        onQuitter={() => {}}
        rendreLeFocus={rendreLeFocus}
      />
    </>
  );
}

describe("garde de sortie — le focus revient au lien intercepté", () => {
  it("« Rester sur le formulaire » rend le focus, au lieu de le laisser tomber sur body", async () => {
    const user = userEvent.setup();
    render(<EcranAvecGarde />);
    const lien = screen.getByRole("link", { name: "Mon espace" });

    await user.click(lien);
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Rester sur le formulaire/ }));

    await waitFor(() => expect(document.activeElement).toBe(lien));
    expect(push).not.toHaveBeenCalled();
  });

  it("Échap ferme et rend le focus de la même façon", async () => {
    const user = userEvent.setup();
    render(<EcranAvecGarde />);
    const lien = screen.getByRole("link", { name: "Mon espace" });

    await user.click(lien);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(lien));
  });

  it("« Quitter » navigue, et laisse la page suivante prendre le focus", async () => {
    const user = userEvent.setup();
    render(<EcranAvecGarde />);
    const lien = screen.getByRole("link", { name: "Mon espace" });

    await user.click(lien);
    await user.click(screen.getByRole("button", { name: /Quitter sans enregistrer/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/mon-espace"));
    expect(document.activeElement).not.toBe(lien);
  });
});

describe("choix du talk pitché — chaque « Modifier » dit lequel", () => {
  const options = [
    { id: 1, titre: "Mon premier talk", meta: "Conférence", editHref: "/mon-espace/talks/1" },
    { id: 2, titre: "Le second", meta: "Quickie", editHref: "/mon-espace/talks/2" },
  ];

  it("deux talks, deux noms accessibles distincts vers deux destinations", () => {
    render(
      <PitchedTalkPicker
        action={async () => IDLE}
        editionId={1}
        options={options}
        pitchedId={1}
        legend="Quel talk pitches-tu ?"
      />,
    );

    const liens = screen.getAllByRole("link");
    const noms = liens.map((l) =>
      (l.getAttribute("aria-label") ?? l.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    // Aucun lien ne s'appelle « Modifier » tout court.
    expect(noms).not.toContain("Modifier");
    // Et deux liens ne portent jamais le même nom pour deux href différents.
    expect(new Set(noms).size).toBe(liens.length);
    for (const o of options) {
      expect(
        screen
          .getByRole("link", { name: new RegExp(`^Modifier le talk .*${o.titre}`) })
          .getAttribute("href"),
      ).toBe(o.editHref);
    }
  });
});

describe("champs de contact — le plan de la page ne saute pas de niveau", () => {
  it("le titre du bloc est un h2 : la page hôte pose le h1, rien ne s'intercale", () => {
    render(<ChampsContact initial={null} erreurs={{}} />);

    expect(screen.getByRole("heading", { name: /Comment on te contacte/, level: 2 })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});

describe("fil d'Ariane profond — un maillon replié se montre quand il a le focus", () => {
  const items = [
    { label: "Accueil", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Tremplins", href: "/admin/tremplins" },
    { label: "Édition 2026", href: "/admin/tremplins/1" },
    { label: "Ateliers" },
  ];

  it("le maillon masqué reste un lien, et réapparaît au focus", () => {
    const { container } = render(<Breadcrumb items={items} />);
    const masques = [...container.querySelectorAll("li")].filter((li) =>
      li.className.split(/\s+/).includes("sr-only"),
    );

    expect(masques.length).toBeGreaterThan(0);
    for (const li of masques) {
      // Il porte bien un lien tabulable…
      expect(li.querySelector("a")).toBeTruthy();
      // … donc il doit sortir de `sr-only` quand ce lien prend le focus, sinon
      // l'anneau est découpé avec le maillon (1×1 px + clip).
      expect(li.className).toContain("focus-within:not-sr-only");
      expect(li.className).toContain("focus-within:flex");
    }
  });

  it("le composant ne masque jamais un maillon sans prévoir sa réapparition", () => {
    const source = readFileSync("src/components/Breadcrumb.tsx", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    for (const [, classe] of code.matchAll(/"(sr-only[^"]*)"/g)) {
      expect(classe).toContain("focus-within:not-sr-only");
    }
  });
});
