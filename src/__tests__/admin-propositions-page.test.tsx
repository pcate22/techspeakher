import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * LES ÉCRANS D'ARBITRAGE des conférences proposées
 * (`docs/conception-arbitrage-conferences.md`, lots 2 et 3).
 *
 * Ce qu'ils doivent tenir, et qui n'existait pas le 2026-08-21 :
 *
 * 1. **On VOIT la saisie.** « Je ne peux pas voir le formulaire des conférences
 *    pour comprendre si la saisie est ok » : la saisie était invisible partout
 *    (l'invariant de visibilité la tient hors du public, et aucun écran orga ne
 *    montre les talks d'une membre). C'est le cœur du lot.
 * 2. **On est AIDÉE.** Le rapprochement au répertoire dit ce que valider va
 *    faire : rattacher, ou créer une marque de plus.
 * 3. **La file peut finir.** Le plafond annonce son compte exact ; le catalogue
 *    cesse de porter 113 formulaires d'arbitrage.
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaPage: vi.fn() }));
vi.mock("@/lib/conference-propositions", () => ({
  listConferencePropositions: vi.fn(async () => []),
  countConferencePropositions: vi.fn(async () => 0),
  getPropositionEnAttente: vi.fn(async () => null),
}));
vi.mock("@/lib/talks", () => ({ getRegistreIndex: vi.fn(async () => []) }));
vi.mock("@/lib/conferences", () => ({ listConferencesForAdmin: vi.fn(async () => []) }));

import { requireOrgaPage } from "@/lib/auth-guards";
import {
  listConferencePropositions,
  countConferencePropositions,
  getPropositionEnAttente,
} from "@/lib/conference-propositions";
import { getRegistreIndex } from "@/lib/talks";
import PropositionsPage from "@/app/admin/conferences/propositions/page";
import PropositionPage from "@/app/admin/conferences/propositions/[id]/page";
import AdminConferencesPage from "@/app/admin/conferences/page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  // Reposées EXPLICITEMENT : `clearAllMocks` efface les appels, pas les
  // implémentations — un cas qui met la file à 113 la laisserait ainsi pour
  // tous les suivants (le piège est déjà noté dans `admin-dashboard.test.tsx`).
  vi.mocked(countConferencePropositions).mockResolvedValue(0);
  vi.mocked(listConferencePropositions).mockResolvedValue([]);
  vi.mocked(getPropositionEnAttente).mockResolvedValue(null);
  vi.mocked(getRegistreIndex).mockResolvedValue([]);
});

const proposition = (o: Partial<ReturnType<typeof unePropo>> = {}) => ({
  ...unePropo(),
  ...o,
});

function unePropo() {
  return {
    id: 7,
    nom: "DevoxxFR",
    annee: 2025,
    ville: "Paris",
    url: null as string | null,
    endpoint: null as string | null,
    proposeParNom: "Aurélie Vache",
    talksEnAttente: 1,
    createdAt: "2026-08-15T10:00:00Z",
  };
}

const REPERTOIRE = [
  {
    id: 1,
    nom: "Devoxx France",
    slug: "devoxx-france",
    editions: [{ id: 11, annee: 2025, dateDebut: null, dateFin: null }],
  },
];

const sp = (o: Record<string, string> = {}) => Promise.resolve(o);

describe("/admin/conferences/propositions — la file", () => {
  it("passe par la garde de page (le préfixe /admin n'est que la première)", async () => {
    await PropositionsPage({ searchParams: sp() });
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("état vide : la liste peut finir, et le dit en mots", async () => {
    render(await PropositionsPage({ searchParams: sp() }));
    expect(screen.getByText(/Rien en attente\. Tout roule\./)).toBeInTheDocument();
  });

  it("chaque rangée porte l'indice du répertoire, et la rangée ENTIÈRE mène à l'item", async () => {
    vi.mocked(countConferencePropositions).mockResolvedValue(1);
    vi.mocked(listConferencePropositions).mockResolvedValue([proposition()]);
    vi.mocked(getRegistreIndex).mockResolvedValue(REPERTOIRE);
    render(await PropositionsPage({ searchParams: sp() }));
    expect(screen.getByText(/Ressemble à/)).toBeInTheDocument();
    // UN seul lien par rangée, dont le nom accessible porte le nom de la
    // conférence : plus de bouton homonyme à distinguer par un `aria-label`
    // (principes UI §6 — « 25× Supprimer sur une page = échec de conception »).
    const lien = screen.getByRole("link", { name: /DevoxxFR/ });
    expect(lien).toHaveAttribute("href", "/admin/conferences/propositions/7");
  });

  it("la file n'ARBITRE plus : les deux gestes vivent sur la page de l'item", async () => {
    // Le renversement de la passe UX. « Écarter » est un geste de palier 2 (il
    // bloque ce nom pour son autrice, toutes années confondues, et rien ne
    // dés-écarte) : il lui faut une modale nominative, intenable 25 fois sur
    // une liste. Et 25 rangées × 2 boutons faisaient 50 boutons homonymes.
    vi.mocked(countConferencePropositions).mockResolvedValue(2);
    vi.mocked(listConferencePropositions).mockResolvedValue([
      proposition(),
      proposition({ id: 8, nom: "KubeCon EU" }),
    ]);
    render(await PropositionsPage({ searchParams: sp() }));
    expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Écarter" })).toBeNull();
  });

  it("la confirmation NOMME la conférence arbitrée, et un échec le dit", async () => {
    // Le retour se fait en haut d'une file de rangées qui se ressemblent :
    // « Conférence validée » sans nom laissait chercher laquelle (§5).
    render(
      await PropositionsPage({
        searchParams: sp({ prop: "validee", nom: "DevoxxFR", talks: "2" }),
      }),
    );
    // `ConfirmationBanner` pose son texte APRÈS un délai (le temps que la
    // région vive existe, sinon l'annonce passe sous le radar des lecteurs
    // d'écran) : on l'attend, comme le composant l'impose à tous ses appelants.
    expect(
      // Espaces ORDINAIRES dans le motif : le normaliseur de Testing Library
      // replie les blancs, insécables comprises, avant de comparer. Le rendu,
      // lui, porte bien les insécables (typographie française du dépôt).
      await screen.findByText(/« DevoxxFR » a rejoint le répertoire/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 talks qui l'attendaient/)).toBeInTheDocument();
    // Un ÉCHEC ne s'annonce pas en `role="status"` cyan : `role="alert"`.
    cleanup();
    render(await PropositionsPage({ searchParams: sp({ prop: "conflit" }) }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Validation impossible/),
    );
  });

  it("un `prop` bricolé ne casse pas l'écran (chaîne de prototypes)", async () => {
    // `?prop=__proto__` rendait un objet là où le type promettait une chaîne,
    // et React refuse de rendre un objet : écran blanc sur une URL trafiquée.
    for (const prop of ["__proto__", "constructor", "toString"]) {
      cleanup();
      render(await PropositionsPage({ searchParams: sp({ prop }) }));
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    }
  });

  it("le plafond annonce son compte EXACT, il ne masque jamais en silence", async () => {
    // 113 lignes d'un coup, c'est ce qui est arrivé. Le point de bascule était
    // écrit d'avance dans la dette : « la page liste tout, sans pagination ».
    vi.mocked(countConferencePropositions).mockResolvedValue(113);
    vi.mocked(listConferencePropositions).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => proposition({ id: i + 1, nom: `Conf ${i + 1}` })),
    );
    render(await PropositionsPage({ searchParams: sp() }));
    expect(screen.getByText("1 à 25 sur 113.")).toBeInTheDocument();
    // Les rangées, pas tous les `li` de l'écran : le fil d'Ariane en porte.
    expect(screen.getAllByRole("link", { name: /^Conf \d+/ })).toHaveLength(25);
    expect(
      screen.getByRole("link", { name: /Page suivante \(26 à 50\)/ }),
    ).toHaveAttribute("href", "/admin/conferences/propositions?page=2");
  });

  it("un numéro de page absurde retombe sur la première (paramètre non fiable)", async () => {
    for (const page of ["-3", "0", "1e21", "abc", "2.5"]) {
      vi.mocked(listConferencePropositions).mockClear();
      await PropositionsPage({ searchParams: sp({ page }) });
      // `1e21` est un entier au sens de `Number.isInteger`, et il partait tel
      // quel dans l'`OFFSET` : Postgres refuse « 1e+21 », donc 500 pour une URL
      // bricolée (cf. `src/lib/id-url.ts`).
      expect(listConferencePropositions, page).toHaveBeenCalledWith({
        limit: 25,
        offset: 0,
      });
    }
  });

  it("une page légitime lit la BONNE tranche (rien vu deux fois, rien perdu)", async () => {
    // L'angle mort mesuré par la passe justesse : seule la page 1 était gardée.
    // Un `offset` décalé d'une page servait un clone de la première, et 88
    // propositions sur 113 devenaient inatteignables — 13 tests verts.
    vi.mocked(countConferencePropositions).mockResolvedValue(113);
    vi.mocked(listConferencePropositions).mockResolvedValue([]);
    await PropositionsPage({ searchParams: sp({ page: "3" }) });
    expect(listConferencePropositions).toHaveBeenCalledWith({ limit: 25, offset: 50 });
  });

  it("la DERNIÈRE page n'offre pas de suite (total pile multiple du plafond)", async () => {
    // L'autre angle mort : `dernier <= total` proposait « Page suivante (51 à
    // 50) » vers une page vide, exactement sur un total rond.
    vi.mocked(countConferencePropositions).mockResolvedValue(50);
    vi.mocked(listConferencePropositions).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => proposition({ id: 100 + i, nom: `Conf ${i}` })),
    );
    render(await PropositionsPage({ searchParams: sp({ page: "2" }) }));
    expect(screen.getByText("26 à 50 sur 50.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Page suivante/ })).toBeNull();
    // Et le retour en arrière, lui, existe bien.
    expect(screen.getByRole("link", { name: /Page précédente/ })).toBeInTheDocument();
  });

  it("une page au-delà de la file OFFRE le retour à la première", async () => {
    vi.mocked(countConferencePropositions).mockResolvedValue(30);
    vi.mocked(listConferencePropositions).mockResolvedValue([]);
    render(await PropositionsPage({ searchParams: sp({ page: "9" }) }));
    expect(
      screen.getByRole("link", { name: /Revenir à la première/ }),
    ).toHaveAttribute("href", "/admin/conferences/propositions");
  });
});

describe("/admin/conferences/propositions/[id] — juger UNE proposition", () => {
  const detail = {
    ...unePropo(),
    saisies: [
      {
        occurrenceId: 3,
        titre: "Vous avez dit GitOps ?",
        autriceNom: "Aurélie Vache",
        profileId: 12,
        date: "2025-04-17",
        ville: "Paris",
        pays: "France",
        lienConf: null,
        lienSlides: "https://slides.example/gitops",
        lienVideo: null,
        lienFeedback: null,
      },
    ],
  };

  it("MONTRE la saisie : le titre du talk, son autrice, sa date, ses liens", async () => {
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    render(await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }));
    expect(screen.getByText("Vous avez dit GitOps ?")).toBeInTheDocument();
    expect(screen.getByText(/Aurélie Vache · 17 avril 2025 · Paris · France/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Slides/ })).toHaveAttribute(
      "href",
      "https://slides.example/gitops",
    );
  });

  it("dit ce que valider VA FAIRE au répertoire, et comment rattacher", async () => {
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    vi.mocked(getRegistreIndex).mockResolvedValue(REPERTOIRE);
    render(await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }));
    expect(screen.getByText(/créera une conférence de plus au répertoire/)).toBeInTheDocument();
    expect(screen.getByText(/corrige le nom pour reprendre celui du répertoire/)).toBeInTheDocument();
  });

  it("passe par la garde de page (le préfixe /admin n'est que la première)", async () => {
    // La leçon du 2026-08-08 : une garde d'autorisation supprimée avait laissé
    // 3 227 tests verts. Le proxy de bord rattrape, mais la garde de page est
    // la seconde couche — et elle n'était gardée que sur la file.
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() });
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("« Écarter » passe par une modale qui dit ce que le geste emporte", async () => {
    // PALIER 2 (§10) : le refus bloque ce nom pour son autrice TOUTES ANNÉES
    // confondues, et rien ne dés-écarte dans le produit. Un submit nu était le
    // trou que la passe UX a trouvé.
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    render(await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }));
    const ecarter = screen.getByRole("button", { name: /Écarter/ });
    expect(ecarter).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("porte la troisième porte : corriger avant de valider", async () => {
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    render(await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }));
    expect(
      screen.getByRole("link", { name: /Corriger la proposition/ }),
    ).toHaveAttribute("href", "/admin/conferences/propositions/7/corriger");
  });

  it("le nom repris est CONFIRMÉ, et nommé", async () => {
    // Le geste écrit puis revient ici (PRG) : sans confirmation nommée, rien ne
    // distingue « c'est enregistré » de « j'ai cliqué à côté ».
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    render(
      await PropositionPage({
        params: Promise.resolve({ id: "7" }),
        searchParams: sp({ corrige: "Devoxx France" }),
      }),
    );
    expect(
      await screen.findByText(/« Devoxx France » est le nom enregistré/),
    ).toBeInTheDocument();
  });

  it("aucune adresse e-mail à l'écran (l'écran nomme, il ne recontacte pas)", async () => {
    vi.mocked(getPropositionEnAttente).mockResolvedValue(detail);
    const { container } = render(
      await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }),
    );
    expect(container.textContent).not.toContain("@");
  });

  it("déjà arbitrée : l'écran le DIT et rend le chemin, pas un 404 nu", async () => {
    // La ligne « À faire » et la file pointent cette adresse en direct : deux
    // orgas, ou un onglet resté ouvert, y arrivent normalement après coup. Le
    // 404 global les laissait sans fil d'Ariane et sans retour vers la file.
    // Et pas de `redirect()` ici : rendu derrière `admin/loading.tsx`, il
    // streame un 200 puis redirige côté client (piège documenté).
    vi.mocked(getPropositionEnAttente).mockResolvedValue(null);
    render(await PropositionPage({ params: Promise.resolve({ id: "7" }), searchParams: sp() }));
    expect(screen.getByRole("heading", { name: /Déjà traitée/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Retour aux conférences proposées/ }),
    ).toHaveAttribute("href", "/admin/conferences/propositions");
  });

  it("un id qui n'est pas un entier ne va jamais jusqu'à la base", async () => {
    await expect(
      PropositionPage({ params: Promise.resolve({ id: "7; DROP" }), searchParams: sp() }),
    ).rejects.toThrow("NOT_FOUND");
    expect(getPropositionEnAttente).not.toHaveBeenCalled();
  });
});

describe("/admin/conferences — le catalogue n'arbitre plus", () => {
  it("une RANGÉE vers la file, avec son compte — plus aucun formulaire empilé", async () => {
    vi.mocked(countConferencePropositions).mockResolvedValue(113);
    render(await AdminConferencesPage({ searchParams: sp() }));
    expect(
      screen.getByRole("link", { name: /Conférences proposées \(113\)/ }),
    ).toHaveAttribute("href", "/admin/conferences/propositions");
    // L'erreur du registre (2026-07-11) : une page de consultation devenue un
    // empilement de formulaires. Aucun bouton d'arbitrage ici.
    expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Écarter" })).toBeNull();
  });

  it("file vide : la rangée le dit, sans compteur qui ne retombe jamais", async () => {
    render(await AdminConferencesPage({ searchParams: sp() }));
    expect(screen.getByText(/Rien en attente\. Tout roule\./)).toBeInTheDocument();
  });
});
