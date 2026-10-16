import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PublicEdition, PublicRecompense } from "@/lib/tremplin-public";
import { editionEditoriale } from "@/data/tremplin";

/**
 * Rend la page d'édition publique avec un DTO mocké pour couvrir la logique de
 * branchement du composant (fusion palmarès/prix, repli anonyme, badge gagnante)
 * — non couverte par les tests d'intégration BDD qui s'arrêtent au DTO.
 */

const getPublicEdition = vi.fn();
// On garde l'implémentation réelle (mentionTransfert…) et on ne remplace que
// l'accès BDD : la page appelle mentionTransfert, qui doit rester réel.
vi.mock("@/lib/tremplin-public", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-public")>();
  return { ...actual, getPublicEdition: (...a: unknown[]) => getPublicEdition(...a) };
});

import EditionPublique from "@/app/tremplin/[conf]/[annee]/page";

afterEach(cleanup);

/** Construit un PublicRecompense de test (défauts null pour les champs absents). */
const rec = (o: Partial<PublicRecompense> & { intitule: string }): PublicRecompense => ({
  detail: null,
  rang: null,
  beneficiaireNom: null,
  beneficiaireClassement: null,
  transfertRaison: null,
  origineNom: null,
  ...o,
});

const base: PublicEdition = {
  nom: "Tremplin 2026",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "archive",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: "2026-11-19",
  confLien: null,
  finaleDate: "2026-06-04",
  finaleLieu: "Toulouse",
  inscriptionsDebut: null,
  inscriptionsFin: null,
  counts: { inscrites: 8, finalistes: 1, gagnantes: 2, accompagnees: 0 },
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

const params = Promise.resolve({ conf: "devfest-toulouse", annee: "2026" });

async function renderPage(
  edition: PublicEdition,
  p: Promise<{ conf: string; annee: string }> = params,
) {
  getPublicEdition.mockResolvedValue(edition);
  render(await EditionPublique({ params: p }));
}

describe("page d'édition — fusion palmarès/prix", () => {
  it("avec gagnantes : affiche nom + titre du talk + le lot gagné, et anonymise le non consenti", async () => {
    await renderPage({
      ...base,
      finalistes: [
        { nom: "Ada Lovelace", role: null, sujet: "Mon talk", bio: null, linkedin: null, siteWeb: null, photoUrl: null, recompenses: [] },
      ],
      palmares: [
        { recompense: "1ᵉʳ prix", nom: "Ada Lovelace", sujet: "Mon talk" },
        { recompense: "2ᵉ prix", nom: null, sujet: null }, // gagnante non consentante
      ],
    });

    expect(screen.getByRole("heading", { name: /Les gagnantes et leur prix/i })).toBeTruthy();
    // Apparaît au palmarès ET dans la galerie des finalistes.
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(2);
    // Le lot est retrouvé via la table éditoriale `prix` (place === recompense).
    expect(screen.getByText(/Une présentation au DevFest Toulouse 2026/i)).toBeTruthy();
    // La gagnante non consentante garde son rang mais pas son nom.
    expect(screen.getByText("Gagnante (non communiquée)")).toBeTruthy();
    // Dans la galerie, la finaliste gagnante porte le badge « gagnante » (sr-only).
    expect(screen.getByText("gagnante")).toBeTruthy();
  });

  it("sans gagnantes (édition à venir) : bascule sur « ce qu'il y a à gagner »", async () => {
    await renderPage({ ...base, statut: "ouvert", palmares: [], counts: { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 } });

    expect(screen.getByRole("heading", { name: /Ce qu.?il y a à gagner/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Les gagnantes et leur prix/i })).toBeNull();
    // Les paliers de prix sont listés (table éditoriale).
    expect(screen.getByText(/Une présentation au DevFest Toulouse 2026/i)).toBeTruthy();
  });
});

describe("page d'édition — les blocs éditoriaux restent chez leur édition", () => {
  it("« Pour toutes les participantes » se rend sur l'édition éditoriale seule", async () => {
    // Le dernier bloc éditorial qui fuyait (dette P1) : sur une édition 2027
    // AVEC récompenses, la section palmarès se rend — et promettait le retour
    // jury et la vidéo de 2026 à une cohorte dont rien n'est décidé.
    await renderPage(
      { ...base, annee: 2027, nom: "Tremplin 2027", recompenses: [rec({ intitule: "Un lot" })] },
      Promise.resolve({ conf: "devfest-toulouse", annee: "2027" }),
    );
    expect(screen.getByText("Un lot")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /toutes.*les participantes/i })).toBeNull();

    cleanup();
    await renderPage({ ...base, recompenses: [rec({ intitule: "Un lot" })] });
    expect(screen.getByRole("heading", { name: /toutes.*les participantes/i })).toBeInTheDocument();
  });
});

describe("page d'édition — tombstone (édition supprimée)", () => {
  it("rend « Cette édition a été supprimée » avec liens de repli", async () => {
    getPublicEdition.mockResolvedValue("deleted");
    render(await EditionPublique({ params }));
    expect(screen.getByRole("heading", { name: /Cette édition a été supprimée/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /éditions de la conférence/i })).toBeTruthy();
  });
});

describe("page d'édition — jury (base vs éditorial)", () => {
  it("un jury saisi en base remplace la liste éditoriale (nom + fonction/entreprise, e-mail jamais)", async () => {
    await renderPage({
      ...base,
      jury: [
        { nom: "Lovelace", prenom: "Ada", fonction: "Directrice technique", entreprise: "Acme" },
      ],
    });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Directrice technique · Acme")).toBeTruthy();
  });

  it("sans jury en base : repli sur la liste éditoriale", async () => {
    await renderPage({ ...base, jury: [] });
    // La sous-section jury reste présente (contenu éditorial de repli).
    expect(screen.getByRole("heading", { name: "Le jury", level: 3 })).toBeTruthy();
  });
});

describe("page d'édition — le hero RACONTE (lot G), il n'affiche plus un statut", () => {
  it("édition bouclée (conférence passée) : les accompagnées, les gagnantes, la scène", async () => {
    await renderPage({
      ...base,
      confDate: "2020-11-19", // scène derrière nous : l'aventure est bouclée
      counts: { ...base.counts, gagnantes: 3 },
      // Un vrai PARCOURS : c'est lui qui autorise le mot « accompagnées ».
      ateliers: [
        // Phase 1 : c'est le chapitre que CETTE page raconte (l'après-finale a
        // la sienne), donc le parcours qui autorise le mot « accompagnées ».
        { titre: "Écrire son sujet", date: "2020-04-28", dateFin: null, description: null, phase: "cfp_et_pitch" as const },
        { titre: "Filage", date: "2020-10-06", dateFin: null, description: null, phase: "cfp_et_pitch" as const },
      ],
    });
    const kicker = screen.getByText(/^2026 · /);
    expect(kicker.textContent).toMatch(/8 speakeuses accompagnées/);
    expect(kicker.textContent).toMatch(/3 gagnantes/);
    // Fini le vocabulaire administratif de la liste d'admin.
    expect(kicker.textContent).not.toMatch(/Édition passée|En cours/);
  });

  /**
   * L'édition SANS parcours ne s'attribue pas un accompagnement. C'est le cas de
   * 2025, qui n'a pas eu de préparation : la page disait « N speakeuses
   * accompagnées » sur la foi du seul compte des inscriptions.
   */
  it("édition bouclée SANS parcours : elles ont participé, pas été accompagnées", async () => {
    await renderPage({
      ...base,
      confDate: "2020-11-19",
      counts: { ...base.counts, gagnantes: 3 },
      ateliers: [],
    });
    const kicker = screen.getByText(/^2026 · /);
    expect(kicker.textContent).toMatch(/8 participantes/);
    expect(kicker.textContent).not.toMatch(/accompagnées/);
  });

  it("aventure en cours : les inscrites et la finale à venir, jamais un statut", async () => {
    await renderPage({
      ...base,
      statut: "en_cours",
      finaleDate: "2099-06-04",
      confDate: "2099-11-19",
      inscriptionsDebut: "2026-03-12",
      inscriptionsFin: "2026-04-17",
    });
    const kicker = screen.getByText(/^2026 · /);
    expect(kicker.textContent).toMatch(/8 speakeuses en préparation/);
    expect(kicker.textContent).toMatch(/finale le 4 juin/);
    expect(kicker.textContent).not.toMatch(/Édition passée|En cours/);
    expect(screen.queryByText(/Inscriptions ouvertes/)).toBeNull();
  });
});

describe("page d'édition — récompenses depuis la base", () => {
  it("liste les récompenses (bénéficiaire nommée si consentie) et la mention sur sa carte", async () => {
    await renderPage({
      ...base,
      finalistes: [
        {
          nom: "Grace H.", role: null, sujet: "Mon talk", bio: null,
          linkedin: null, siteWeb: null, photoUrl: null,
          recompenses: ["Une présentation au DevFest Toulouse"],
        },
      ],
      palmares: [{ recompense: "1ᵉʳ prix", nom: "Grace H.", sujet: "Mon talk" }],
      recompenses: [
        rec({
          intitule: "Une présentation au DevFest Toulouse",
          detail: "Salle communauté",
          rang: 1,
          beneficiaireNom: "Grace H.",
        }),
        rec({ intitule: "Un talk en meetup" }),
      ],
    });

    // Après la finale (palmarès présent) : bloc complémentaire nommé.
    expect(screen.getByText(/les récompenses de cette édition/i)).toBeTruthy();
    // Bénéficiaire consentie nommée dans la section ; l'autre reste anonyme.
    expect(screen.getByText(/attribuée à/i)).toBeTruthy();
    // Et la mention apparaît aussi sur sa carte de finaliste.
    expect(screen.getAllByText("Une présentation au DevFest Toulouse").length).toBeGreaterThanOrEqual(2);
  });

  it("avant la finale : les récompenses en base REMPLACENT les lots éditoriaux (pas de doublon)", async () => {
    await renderPage({
      ...base,
      statut: "ouvert",
      palmares: [],
      counts: { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 },
      recompenses: [
        rec({ intitule: "Un talk au DevFest Toulouse 2026", detail: "Salle des communautés", rang: 1 }),
        rec({ intitule: "Un talk en meetup Tech Speak'Her", rang: 2 }),
      ],
    });

    // Les récompenses en base portent le titre « ce qu'il y a à gagner »…
    expect(screen.getByRole("heading", { name: /Ce qu.?il y a à gagner/i })).toBeTruthy();
    expect(screen.getByText("Un talk au DevFest Toulouse 2026")).toBeTruthy();
    // … et les lots éditoriaux statiques NE sont PAS affichés en plus (doublon).
    expect(screen.queryByText("2ᵉ prix")).toBeNull();
    expect(screen.queryByText(/Un slot au prochain meetup/i)).toBeNull();
  });
});

describe("page d'édition — les compteurs se taisent quand ils n'ont rien à dire", () => {
  it("tout à zéro : la bande de chiffres disparaît au lieu d'écrire l'échec en grand", async () => {
    await renderPage({ ...base, counts: { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 } });

    // Le titre de la section est `sr-only` : sans lui, trois grands zéros
    // s'affichaient sans étiquette, juste au-dessus du récit de l'année.
    expect(screen.queryByRole("heading", { name: "En chiffres" })).toBeNull();
    expect(screen.queryByText("inscrites")).toBeNull();
    expect(screen.queryByText("gagnantes")).toBeNull();
  });

  it("dès qu'un chiffre existe, les trois s'affichent — un zéro y devient une étape", async () => {
    await renderPage({ ...base, counts: { inscrites: 8, finalistes: 0, gagnantes: 0, accompagnees: 0 } });

    expect(screen.getByRole("heading", { name: "En chiffres" })).toBeTruthy();
    expect(screen.getByText("inscrites")).toBeTruthy();
    expect(screen.getByText("finalistes")).toBeTruthy();
    expect(screen.getByText("gagnantes")).toBeTruthy();
  });
});

/**
 * 2025 : la communauté est montée sur la scène du DevFest, sans parcours autour.
 * Sa page annonçait pourtant « Ce qu'il y a à gagner » et détaillait « La soirée
 * pitch devant jury » — des prix que personne n'a gagnés et une soirée qui n'a
 * pas eu lieu. Une édition bouclée qui n'a rien tenu a un récit à raconter, pas
 * un règlement à afficher.
 */
describe("page d'édition — une année sans Tremplin n'affiche pas son règlement", () => {
  const vide = { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 };

  it("bouclée et vide : ni les prix à gagner, ni la soirée pitch", async () => {
    await renderPage({
      ...base,
      confDate: "2025-11-13",
      finaleDate: null,
      finaleLieu: null,
      counts: vide,
      ateliers: [],
      palmares: [],
      recompenses: [],
    });

    expect(screen.queryByRole("heading", { name: /Ce qu.?il y a à gagner/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /La soirée pitch devant jury/i })).toBeNull();
  });

  it("mais le récit de l'année, lui, reste", async () => {
    await renderPage({
      ...base,
      confDate: "2025-11-13",
      finaleDate: null,
      finaleLieu: null,
      counts: vide,
      ateliers: [],
      palmares: [],
      recompenses: [],
      recit: { slug: "devfest-2025", titre: "Ça a marché !", chapo: "Un premier talk." },
    });

    expect(screen.getByRole("heading", { name: "Ça a marché !" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lire le récit/ }).getAttribute("href")).toBe(
      "/articles/devfest-2025",
    );
  });

  it("une édition qui ouvre ses candidatures les affiche : c'est ce qui donne envie", async () => {
    await renderPage({
      ...base,
      statut: "ouvert",
      counts: vide,
      ateliers: [],
      palmares: [],
      recompenses: [],
      finaleDate: "2099-06-04",
      confDate: "2099-11-19",
      inscriptionsDebut: "2026-03-12",
      inscriptionsFin: "2099-04-17",
    });

    expect(screen.getByRole("heading", { name: /Ce qu.?il y a à gagner/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /La soirée pitch devant jury/i })).toBeTruthy();
  });
});

/**
 * La FAQ répond pour l'édition 2026 : la soirée du 4 juin, le jury de 2026, des
 * candidatures closes le 17 avril 2026. Affichée sur la page d'une AUTRE année,
 * elle répond à côté — et le JSON-LD `FAQPage` publiait ces réponses aux moteurs
 * sous l'adresse de cette autre édition.
 */
describe("page d'édition — la FAQ appartient à l'édition qu'elle décrit", () => {
  it("sur son année : la FAQ est là, et le schéma FAQPage avec", async () => {
    await renderPage({ ...base, annee: editionEditoriale.annee });

    expect(screen.getByRole("heading", { name: "FAQ" })).toBeTruthy();
    expect(document.body.innerHTML).toContain("FAQPage");
  });

  it("sur une autre année : ni la FAQ, ni son schéma", async () => {
    await renderPage({ ...base, annee: editionEditoriale.annee - 1 });

    expect(screen.queryByRole("heading", { name: "FAQ" })).toBeNull();
    expect(document.body.innerHTML).not.toContain("FAQPage");
  });

  it("et la sortie de page survit : code de conduite et retour aux éditions restent", async () => {
    await renderPage({ ...base, annee: editionEditoriale.annee - 1 });

    expect(screen.getByRole("link", { name: /code de conduite/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Toutes les éditions/i })).toBeTruthy();
  });
});

/**
 * L'éditorial daté de `src/data/tremplin.ts` décrit UNE édition. Scopé sur la
 * seule année, il fuitait encore : la page 2026 d'une AUTRE conférence héritait
 * de la FAQ DevFest, de son jury nommé, de ses lots et de ses partenaires — plus
 * le JSON-LD `FAQPage` sous cette autre adresse.
 */
describe("page d'édition — l'éditorial daté ne franchit ni l'année ni la conférence", () => {
  const autreConf = Promise.resolve({ conf: "agile-tour-toulouse", annee: "2026" });

  async function rendreAilleurs(edition: PublicEdition) {
    getPublicEdition.mockResolvedValue(edition);
    render(await EditionPublique({ params: autreConf }));
  }

  it("même année, autre conférence : ni FAQ, ni schéma, ni partenaires du DevFest", async () => {
    await rendreAilleurs({ ...base, confSlug: "agile-tour-toulouse", confNom: "Agile Tour" });

    expect(screen.queryByRole("heading", { name: "FAQ" })).toBeNull();
    expect(document.body.innerHTML).not.toContain("FAQPage");
    expect(screen.queryByRole("heading", { name: /Merci à nos partenaires/i })).toBeNull();
    expect(screen.queryByText(/BPCE Solutions informatiques/)).toBeNull();
  });

  it("même année, autre conférence : ni le jury nommé, ni les lots du DevFest", async () => {
    await rendreAilleurs({ ...base, confSlug: "agile-tour-toulouse", confNom: "Agile Tour" });

    expect(screen.queryByRole("heading", { name: "Le jury", level: 3 })).toBeNull();
    expect(screen.queryByText(/Une présentation au DevFest Toulouse 2026/i)).toBeNull();
  });

  it("un jury saisi en base, lui, s'affiche partout : c'est la donnée de l'édition", async () => {
    await rendreAilleurs({
      ...base,
      confSlug: "agile-tour-toulouse",
      jury: [{ nom: "Lovelace", prenom: "Ada", fonction: "Directrice technique", entreprise: "Acme" }],
    });

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });
});

/**
 * Le prédicat doit lire la MÊME liste que la page rend. Une édition dont les
 * seules séances publiques appartiennent au chapitre 2 (la montée sur scène, qui
 * a sa propre page) laissait la section « parcours » vide tout en déclenchant le
 * règlement — prix à gagner et soirée pitch — d'un chapitre 1 qui n'a rien tenu.
 */
describe("page d'édition — le règlement suit le chapitre que CETTE page raconte", () => {
  it("bouclée, séances de la seule montée sur scène : ni prix, ni soirée pitch", async () => {
    await renderPage({
      ...base,
      confDate: "2020-11-19",
      finaleDate: null,
      counts: { inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0 },
      palmares: [],
      recompenses: [],
      jury: [],
      ateliers: [
        { titre: "Filage sur la grande scène", date: "2020-10-06", dateFin: null, description: null, phase: "montee_sur_scene" as const },
      ],
    });

    expect(screen.queryByRole("heading", { name: /Ce qu.?il y a à gagner/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /La soirée pitch devant jury/i })).toBeNull();
  });
});
