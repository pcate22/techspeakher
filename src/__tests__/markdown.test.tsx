import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownContenu } from "@/lib/markdown";

/**
 * Rendu Markdown assaini (lot 3). On fige : le mapping des titres (jamais de
 * h1), la non-régression XSS (HTML brut jamais exécuté, `javascript:` bloqué),
 * et le comportement des liens (externe = nouvel onglet sûr, interne = non).
 */
describe("MarkdownContenu", () => {
  it("rend ## en h2 et ### en h3, visuellement démarqués (gras)", () => {
    const { container } = render(<MarkdownContenu corps={"## Titre\n\n### Sous-titre"} />);
    const h2 = container.querySelector("h2");
    const h3 = container.querySelector("h3");
    expect(h2?.textContent).toBe("Titre");
    expect(h3?.textContent).toBe("Sous-titre");
    // Non-régression du bug « titres invisibles » : ils doivent être stylés.
    expect(h2?.className).toContain("font-bold");
    expect(h3?.className).toContain("font-bold");
  });

  it("rend un titre même sans espace après les # (saisie indulgente)", () => {
    // Erreur de saisie fréquente : « ###Titre » collé sans espace. CommonMark
    // le rendrait en texte brut ; on insère l'espace manquant → vrai titre.
    const { container } = render(
      <MarkdownContenu corps={"##Section\n\n###Sous-section"} />,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Section");
    expect(container.querySelector("h3")?.textContent).toBe("Sous-section");
    // Le « # » ne fuit pas dans le texte rendu.
    expect(container.textContent).not.toContain("#");
  });

  it("laisse le texte intact quand un # est au milieu d'une ligne", () => {
    // On ne normalise qu'en tête de ligne : un « #1 » en cours de phrase reste.
    const { container } = render(<MarkdownContenu corps={"Objectif n#1 atteint"} />);
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).toContain("n#1");
  });

  it("préserve un # seul en tête de ligne (jamais amputé en h1 retiré)", () => {
    // Un « #1 priorité » ou « #TechSpeakHer » ne doit PAS devenir un h1 (retiré
    // par l'assainissement) : on ne normalise que ##/### (niveaux rendus).
    const { container } = render(
      <MarkdownContenu corps={"#1 priorité\n\n#TechSpeakHer"} />,
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    // Le « # » reste visible (contenu non amputé).
    expect(container.textContent).toContain("#1 priorité");
    expect(container.textContent).toContain("#TechSpeakHer");
  });

  it("ne rend jamais de h1 (réservé au titre de page)", () => {
    const { container } = render(<MarkdownContenu corps={"# Gros titre"} />);
    expect(container.querySelector("h1")).toBeNull();
    // Le texte reste (la balise est retirée, pas le contenu).
    expect(container.textContent).toContain("Gros titre");
  });

  it("rend le gras et les listes", () => {
    const { container } = render(<MarkdownContenu corps={"**fort**\n\n- un\n- deux"} />);
    expect(container.querySelector("strong")?.textContent).toBe("fort");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("n'exécute pas le HTML brut (script traité comme texte)", () => {
    const { container } = render(
      <MarkdownContenu corps={"Avant <script>alert(1)</script> après"} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("neutralise un lien javascript:", () => {
    const { container } = render(<MarkdownContenu corps={"[clic](javascript:alert(1))"} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("lien externe : nouvel onglet, rel sécurisé, mention sr-only", () => {
    const { container } = render(<MarkdownContenu corps={"[GDG](https://gdg-toulouse.fr)"} />);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.textContent).toContain("nouvelle fenêtre");
    // Non-régression « liens pas clairs » : un lien doit être repérable.
    expect(a.className).toContain("underline");
  });

  it("lien interne : pas de nouvel onglet", () => {
    const { container } = render(<MarkdownContenu corps={"[À propos](/a-propos)"} />);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("target")).toBeNull();
    expect(a.getAttribute("href")).toBe("/a-propos");
  });

  it("rend une image Markdown avec son alt", () => {
    const { container } = render(
      <MarkdownContenu corps={"![Scène de meetup](https://ex.com/photo.jpg)"} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://ex.com/photo.jpg");
    expect(img.getAttribute("alt")).toBe("Scène de meetup");
  });

  it("ne rend rien pour un corps vide", () => {
    const { container } = render(<MarkdownContenu corps={"   "} />);
    expect(container.textContent?.trim()).toBe("");
  });
});
