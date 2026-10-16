import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
// La page dérive désormais son édition mise en avant de la base : ici on la
// prive de base (rejet) — elle se replie sur l'éditorial, ce que ces bancs
// jugent (l'origine et les verbatims sont éditoriaux, indépendants du repli).
vi.mock("@/lib/tremplin-editions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-editions")>();
  return {
    ...actual,
    listEditionsPubliques: () => Promise.reject(new Error("sans base")),
  };
});

import TremplinConcept from "@/app/tremplin/page";

/**
 * D'OÙ VIENT LE TREMPLIN, sur la page concept (`/tremplin`).
 *
 * Le récit de 2025 vit en base depuis la migration 059, rattaché à l'édition de
 * conférence, et deux surfaces le montrent (`/devfest-toulouse` et la page de
 * l'édition 2025). Cette page-ci en gardait une TROISIÈME copie, écrite en dur :
 * les mêmes noms, la même durée de talk, la même salle pleine, qu'aucune orga ne
 * pouvait corriger sans déploiement — et qui contredisait déjà la version en
 * base, puisqu'elle affirmait que 2025 n'était pas un tremplin quand c'est là que
 * Cateline a fait son premier talk en conférence.
 *
 * Son rôle ici est de dire POURQUOI le programme existe, pas de raconter l'année.
 * Elle renvoie donc vers la page qui la raconte.
 */

afterEach(cleanup);

const origine = () => screen.getByRole("region", { name: /pour qui, et pourquoi/i });

describe("/tremplin — d'où vient le programme", () => {
  it("dit que 2025 l'a fait naître, et renvoie là où c'est raconté", async () => {
    render(await TremplinConcept());
    const bloc = origine();

    expect(within(bloc).getByText(/2025/)).toBeInTheDocument();
    const lien = within(bloc).getByRole("link", { name: /devfest toulouse/i });
    expect(lien).toHaveAttribute("href", "/devfest-toulouse");
  });

  /**
   * Le récit appartient à la base. Trois copies d'un même texte, c'est trois
   * vérités qui divergent au premier mot corrigé.
   */
  it("laisse le récit à la page qui le porte, sans le recopier", async () => {
    render(await TremplinConcept());
    const texte = origine().textContent ?? "";

    expect(texte).not.toMatch(/Sandrine Berger/i);
    expect(texte).not.toMatch(/Cateline Puccetti/i);
    expect(texte).not.toMatch(/35/);
    expect(texte).not.toMatch(/salle pleine/i);
  });

  /** Wording à la forme positive : « ne … pas » est proscrit (CLAUDE.md). */
  it("dit ce qui EST, sans tournure négative", async () => {
    render(await TremplinConcept());
    const texte = (origine().textContent ?? "").replace(/ /g, " ");

    expect(texte).not.toMatch(/n['’]existait pas/i);
    expect(texte).not.toMatch(/\bne\s+\S+\s+pas\b/i);
  });
});
