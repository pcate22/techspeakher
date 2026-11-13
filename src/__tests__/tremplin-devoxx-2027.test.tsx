import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { PublicEdition } from "@/lib/tremplin-public";
import { TREMPLIN_DEVOXX_2027_FORM_URL } from "@/constants/site";
import { editorialDe, editionEditoriale } from "@/data/tremplin";
import { partenaires as structures, typesSoutien } from "@/data/partenaires";

/**
 * L'édition Devoxx France 2027 : la page dit tout ce qu'il faut savoir pour
 * candidater (conditions, adhésion, dates, déplacements) et porte LE bouton du
 * formulaire, tant que la fenêtre de candidature est ouverte. L'éditorial 2026
 * reste chez le DevFest.
 */

const getPublicEdition = vi.fn();
vi.mock("@/lib/tremplin-public", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-public")>();
  return { ...actual, getPublicEdition: (...a: unknown[]) => getPublicEdition(...a) };
});

import EditionPublique from "@/app/tremplin/[conf]/[annee]/page";

afterEach(cleanup);

const vide = { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 };

const devoxx: PublicEdition = {
  nom: "Tremplin 2027",
  annee: 2027,
  confSlug: "devoxx-france",
  statut: "ouvert",
  description: null,
  confNom: "Devoxx France",
  confLieu: null,
  confDate: "2027-04-07",
  confLien: "https://www.devoxx.fr/",
  finaleDate: "2027-01-19",
  finaleLieu: "Paris",
  inscriptionsDebut: "2026-11-11",
  // Loin dans le futur : le test ne dépend pas du jour où il tourne.
  inscriptionsFin: "2099-11-30",
  counts: vide,
  ateliers: [],
  finalistes: [],
  accompagnees: [],
  accompagnantes: { cfp_et_pitch: [], montee_sur_scene: [] },
  palmares: [],
  recompenses: [],
  jury: [],
  photos: [],
  recit: null,
};

async function rendre(edition: PublicEdition, conf = "devoxx-france", annee = "2027") {
  getPublicEdition.mockResolvedValue(edition);
  render(await EditionPublique({ params: Promise.resolve({ conf, annee }) }));
}

describe("Tremplin Devoxx France 2027 — candidater", () => {
  it("fenêtre ouverte : conditions lisibles et bouton vers le formulaire 2027", async () => {
    await rendre(devoxx);

    const section = screen.getByRole("region", { name: /candidater/i });
    const bouton = within(section).getByRole("link", { name: /candidater/i });
    expect(bouton).toHaveAttribute("href", TREMPLIN_DEVOXX_2027_FORM_URL);

    // Le critère primo-speakeuse, l'adhésion et le contact pour un doute.
    expect(within(section).getByText(/appel à orateurs/i)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /adhér/i })).toHaveAttribute("href", "/adherer");
    expect(within(section).getByRole("link", { name: /écris-nous/i })).toHaveAttribute("href", "/contact");
    // Les deux rendez-vous à Paris, et la date limite.
    expect(section.textContent).toMatch(/19 janvier/);
    expect(section.textContent).toMatch(/7 au 9 avril/);
  });

  it("le héros mène aux conditions avant le formulaire", async () => {
    await rendre(devoxx);
    const hero = screen.getByRole("region", { name: /Tremplin 2027/ });
    expect(within(hero).getByRole("link", { name: /conditions pour candidater/i })).toHaveAttribute("href", "#candidater");
  });

  it("fenêtre fermée : plus de bouton vers le formulaire", async () => {
    await rendre({ ...devoxx, inscriptionsDebut: "2020-11-09", inscriptionsFin: "2020-11-30" });
    expect(screen.queryByRole("region", { name: /candidater/i })).toBeNull();
    expect(document.body.innerHTML).not.toContain(TREMPLIN_DEVOXX_2027_FORM_URL);
    expect(screen.queryByText(/Comment candidater/)).toBeNull();
  });

  it("la date limite vient de la base : une fenêtre prolongée s'affiche telle quelle", async () => {
    await rendre({ ...devoxx, inscriptionsFin: "2099-12-07" });
    const hero = screen.getByRole("region", { name: /Tremplin 2027/ });
    expect(hero.textContent).toMatch(/jusqu.au 7\s+décembre/);
  });

  it("fenêtre pas encore ouverte : pas de bouton", async () => {
    await rendre({ ...devoxx, inscriptionsDebut: "2099-01-01", inscriptionsFin: "2099-02-01" });
    expect(screen.queryByRole("region", { name: /candidater/i })).toBeNull();
  });

  it("édition close, même avec une fenêtre ouverte en base : pas de bouton", async () => {
    await rendre({ ...devoxx, statut: "clos" });
    expect(screen.queryByRole("region", { name: /candidater/i })).toBeNull();
    expect(document.body.innerHTML).not.toContain(TREMPLIN_DEVOXX_2027_FORM_URL);
  });

  it("son éditorial : lot Devoxx, FAQ 2027, merci à Devoxx France, rien du DevFest", async () => {
    await rendre(devoxx);
    expect(screen.getByText(/Une conférence au Devoxx France 2027/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Merci à nos partenaires/i })).toBeInTheDocument();
    expect(screen.queryByText(/DevFest Toulouse 2026/)).toBeNull();
    expect(screen.queryByText(/BPCE Solutions informatiques/)).toBeNull();
  });

  it("la page DevFest 2026 garde le sien, sans le formulaire 2027", async () => {
    await rendre(
      { ...devoxx, nom: "Tremplin 2026", annee: 2026, confSlug: "devfest-toulouse", confNom: "DevFest", confLieu: "Toulouse", statut: "archive" },
      "devfest-toulouse",
      "2026",
    );
    expect(screen.getByText(/Une présentation au DevFest Toulouse 2026/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TREMPLIN_DEVOXX_2027_FORM_URL);
  });
});

describe("Tremplin Devoxx France 2027 — données", () => {
  it("l'édition éditoriale en cours est Devoxx France 2027", () => {
    expect(editionEditoriale).toMatchObject({ confSlug: "devoxx-france", annee: 2027 });
    expect(editorialDe("devoxx-france", 2027)?.candidature?.formUrl).toBe(TREMPLIN_DEVOXX_2027_FORM_URL);
    expect(editorialDe("devfest-toulouse", 2026)?.candidature).toBeUndefined();
    expect(editorialDe("devoxx-france", 2026)).toBeNull();
  });

  it("Devoxx France figure sur /partenaires, rangée « Ouvrir votre scène »", () => {
    expect(structures.some((s) => s.name === "Devoxx France")).toBe(true);
    const scene = typesSoutien.find((t) => t.id === "scene");
    expect(scene?.membres.some((m) => m.nom === "Devoxx France")).toBe(true);
  });

  it("la migration 076 crée l'édition, ses 5 ateliers et l'article, une seule fois", () => {
    const sql = readFileSync(join(process.cwd(), "db/migrations/076_tremplin_devoxx_2027.sql"), "utf8");
    expect(sql).toContain("'devoxx-france'");
    for (const d of ["2026-12-01", "2026-12-08", "2026-12-15", "2027-01-05", "2027-01-12"]) {
      expect(sql).toContain(`'${d}'`);
    }
    expect(sql).toContain("'tremplin-2027-devoxx-france'");
    expect(sql).toContain("seeds_appliques WHERE cle = '076_tremplin_devoxx_2027'");
    // Le sync de déploiement porte le même bloc.
    const sync = readFileSync(join(process.cwd(), "db/sync-to-latest.sql"), "utf8");
    expect(sync).toContain(sql.slice(sql.indexOf("INSERT INTO tremplin_editions")));
  });
});
