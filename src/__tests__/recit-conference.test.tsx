import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { RecitConference as Recit } from "@/lib/contenus";
import type { PublicEdition } from "@/lib/tremplin-public";

/**
 * LE RÉCIT d'une conférence répertoriée, montré par les DEUX pages qui parlent
 * de cette année-là : celle de la conférence et celle de l'édition du Tremplin
 * qui s'y tient.
 *
 * Ce que 2025 a été pour la communauté était écrit en dur dans le JSX de
 * `/devfest-toulouse`. La page de l'édition qu'il raconte ne pouvait donc pas
 * s'en servir — elle se réduisait à trois compteurs et une séance isolée — et
 * le corriger demandait un déploiement. Le mécanisme existait pourtant depuis
 * la migration 040 (`contenus.conference_edition_id`).
 */

const RECIT: Recit = {
  slug: "devfest-toulouse-2025-ca-a-marche",
  titre: "DevFest Toulouse 2025 : ça a marché !",
  chapo: "Le DevFest nous a ouvert les portes de sa salle des communautés.",
};

const getPublicEdition = vi.fn();
vi.mock("@/lib/tremplin-public", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-public")>();
  return { ...actual, getPublicEdition: (...a: unknown[]) => getPublicEdition(...a) };
});

// La page de la conférence lit quatre tables ; ici on ne pilote que le récit.
const getPublishedArticleByConferenceEdition = vi.fn();
vi.mock("@/lib/contenus", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/contenus")>()),
  getPublishedArticleByConferenceEdition: (...a: unknown[]) =>
    getPublishedArticleByConferenceEdition(...a),
}));
vi.mock("@/lib/tremplin-editions", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/tremplin-editions")>()),
  getEditionsByConfSlug: async () => [],
}));
// L'année en cours et l'année passée doivent chercher DEUX éditions distinctes.
const getConferenceEditionByConfSlugAndYear = vi.fn();
vi.mock("@/lib/conferences", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/conferences")>()),
  getConferenceEditionByConfSlugAndYear: (...a: unknown[]) =>
    getConferenceEditionByConfSlugAndYear(...a),
}));

import RecitConference from "@/components/RecitConference";
import EditionPublique from "@/app/tremplin/[conf]/[annee]/page";
import DevFestToulouse from "@/app/devfest-toulouse/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const norm = (t: string) => t.replace(/\s+/g, " ").trim();
const texteRendu = () => norm(document.body.textContent ?? "");

/** Ce qu'un récit doit rendre, où qu'il soit affiché. */
function verifierRecitRendu(recit: Recit) {
  const titre = screen.getByRole("heading", { name: recit.titre });
  // La section hôte est bien intitulée par ce titre (convention projet, RGAA).
  expect(titre.id).toBeTruthy();
  expect(titre.closest("section")?.getAttribute("aria-labelledby")).toBe(titre.id);

  if (recit.chapo) expect(texteRendu()).toContain(norm(recit.chapo));

  const lien = screen.getByRole("link", { name: (nom) => norm(nom) === "Lire le récit" });
  expect(lien.getAttribute("href")).toBe(`/articles/${recit.slug}`);
}

const edition = (recit: Recit | null): PublicEdition => ({
  nom: "Tremplin 2025",
  annee: 2025,
  confSlug: "devfest-toulouse",
  statut: "archive",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: "2025-11-13",
  confLien: null,
  finaleDate: null,
  finaleLieu: null,
  inscriptionsDebut: null,
  inscriptionsFin: null,
  counts: { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 },
  ateliers: [],
  finalistes: [],
  accompagnees: [],
  accompagnantes: { cfp_et_pitch: [], montee_sur_scene: [] },
  palmares: [],
  recompenses: [],
  jury: [],
  photos: [],
  recit,
});

async function rendreEdition(recit: Recit | null) {
  getPublicEdition.mockResolvedValue(edition(recit));
  render(await EditionPublique({ params: Promise.resolve({ conf: "devfest-toulouse", annee: "2025" }) }));
}

describe("récit de conférence — la page de l'édition du Tremplin", () => {
  it("raconte l'année quand un contenu est rattaché à sa conférence", async () => {
    await rendreEdition(RECIT);

    verifierRecitRendu(RECIT);
  });

  it("sans contenu rattaché : aucun bloc en trop", async () => {
    await rendreEdition(null);

    expect(screen.queryByRole("link", { name: /Lire le récit/ })).toBeNull();
  });

  it("un récit sans chapô se rend quand même (titre + lien)", () => {
    const sansChapo: Recit = { ...RECIT, chapo: null };
    render(
      <section>
        <RecitConference recit={sansChapo} headingId="t" />
      </section>,
    );

    verifierRecitRendu(sansChapo);
  });
});

describe("récit de conférence — la page de la conférence", () => {
  it("montre le récit de l'édition PASSÉE, pas celui de l'année en cours", async () => {
    // L'édition en cours (2026) et la passée (2025) sont deux lignes distinctes.
    getConferenceEditionByConfSlugAndYear.mockImplementation(
      async (_slug: string, annee: number) => (annee === 2026 ? 26 : annee === 2025 ? 25 : null),
    );
    getPublishedArticleByConferenceEdition.mockImplementation(async (id: number) =>
      id === 25 ? RECIT : null,
    );

    render(await DevFestToulouse());

    expect(getConferenceEditionByConfSlugAndYear).toHaveBeenCalledWith("devfest-toulouse", 2025);
    verifierRecitRendu(RECIT);
  });

  it("aucun récit publié pour l'édition passée : la page se passe du bloc", async () => {
    getConferenceEditionByConfSlugAndYear.mockResolvedValue(25);
    getPublishedArticleByConferenceEdition.mockResolvedValue(null);

    render(await DevFestToulouse());

    expect(screen.queryByRole("link", { name: /Lire le récit/ })).toBeNull();
    expect(texteRendu()).not.toContain("salle des communautés");
  });

  it("et ne garde pas de copie en dur du récit", () => {
    const source = readFileSync("src/app/devfest-toulouse/page.tsx", "utf8");
    // Les commentaires ont le droit de parler du récit ; le JSX, non.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

    expect(code).toContain("RecitConference");
    expect(code).not.toContain("Sandrine Berger");
    expect(code).not.toContain("ça a tellement cartonné");
  });
});
