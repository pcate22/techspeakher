import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SegmentLabel from "@/components/SegmentLabel";

afterEach(cleanup);

/**
 * L'étiquette qui nomme un groupe de rangées. Elle EXISTE pour réduire la
 * charge de lecture : elle doit donc être le texte le plus lisible de la
 * page, pas le moins. Relecture d'accessibilité cognitive du 2026-08-16
 * (déficience intellectuelle légère, TDAH, TSA) — cf.
 * `docs/conception-profil-et-a-faire.md` §5 P1.
 */
describe("SegmentLabel — l'étiquette d'un groupe de rangées", () => {
  const rendu = () => {
    render(<SegmentLabel id="seg">Mon compte</SegmentLabel>);
    return screen.getByRole("heading", { level: 2, name: "Mon compte" });
  };

  it("est un vrai h2, porteur de l'id (les sections s'y rattachent)", () => {
    const h2 = rendu();
    expect(h2.getAttribute("id")).toBe("seg");
  });

  it("garde la casse du texte : jamais de capitales forcées", () => {
    // On reconnaît la SILHOUETTE d'un mot avant d'en lire les lettres ; le
    // tout-capitale supprime cet appui et bloque une lectrice en difficulté.
    const h2 = rendu();
    expect(h2.className).not.toContain("uppercase");
    expect(h2.textContent).toBe("Mon compte");
  });

  it("n'écarte pas les lettres : l'interlettrage abîme la silhouette du mot", () => {
    expect(rendu().className).not.toContain("tracking-");
  });

  it("porte sa hiérarchie par la taille et la graisse, jamais par un gris pâle", () => {
    // Principes UI §9 : le gris atténué disparaît au soleil, et retire
    // l'emphase à ce qui STRUCTURE la page.
    const h2 = rendu();
    expect(h2.className).toContain("font-bold");
    expect(h2.className).not.toContain("text-gray-light");
    // Aucune taille sous `text-sm` (14 px) : c'est le plancher de lecture.
    expect(h2.className).not.toMatch(/text-\[[\d.]+px\]|text-xs|text-\[0\./);
    expect(h2.className).toMatch(/text-sm|text-base/);
  });

  it("se colle à ce qu'elle nomme, jamais au groupe du dessus (loi de proximité)", () => {
    // L'espacement appartient au composant : quand il était réglable par
    // l'appelant, deux pages sur trois passaient `mt-0`/`mt-2` et l'étiquette
    // se retrouvait à égale distance des deux groupes (F12).
    const h2 = rendu();
    const haut = Number(/(?:^|\s)mt-(\d+)/.exec(h2.className)?.[1] ?? 0);
    const bas = Number(/(?:^|\s)-mb-(\d+)/.exec(h2.className)?.[1] ?? 0);
    expect(haut, "marge haute").toBeGreaterThanOrEqual(8);
    expect(bas, "resserrement vers le groupe nommé").toBeGreaterThan(0);
  });
});
