import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server Actions de l'import de talks : garde-fous d'abord — identité par la
 * session, rate-limit, plafond de taille, et surtout l'ÉCRITURE conforme au
 * plan (le SQL réel est couvert par import-talks.integration.test.ts).
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn(() => false) }));
vi.mock("@/lib/profiles", () => ({ ensureProfileId: vi.fn() }));
vi.mock("@/lib/notist-evenements", async (importOriginal) => ({
  // Le vrai module garde idEvenementNotist (le contrat d'extraction) ; seul
  // l'appel réseau est simulé.
  ...(await importOriginal<typeof import("@/lib/notist-evenements")>()),
  resoudreEvenementsNotist: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/talks", () => ({
  addTalk: vi.fn(),
  addOccurrence: vi.fn(),
  getTalksByProfileId: vi.fn(),
  getRegistreIndex: vi.fn(),
}));
vi.mock("@/lib/conference-propositions", () => ({ soumettreProposition: vi.fn() }));

import { updateTag } from "next/cache";
import { requireUserId } from "@/lib/auth-guards";
import { isRateLimited } from "@/lib/rate-limit";
import { ensureProfileId } from "@/lib/profiles";
import {
  addTalk,
  addOccurrence,
  getTalksByProfileId,
  getRegistreIndex,
} from "@/lib/talks";
import { soumettreProposition } from "@/lib/conference-propositions";
import { resoudreEvenementsNotist } from "@/lib/notist-evenements";
import { fd } from "./test-helpers";
import {
  previewImportAction,
  confirmImportAction,
} from "@/app/mon-espace/talks/importer/actions";

const JSON_DEUX_TALKS = JSON.stringify([
  { title: "Talk connu", event: "Devoxx Belgium", date: "2025-10-06" },
  { title: "Talk inconnu", event: "KCD Helsinki 2026", city: "Helsinki" },
]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(7);
  vi.mocked(isRateLimited).mockReturnValue(false);
  vi.mocked(ensureProfileId).mockResolvedValue(3);
  vi.mocked(getTalksByProfileId).mockResolvedValue([]);
  vi.mocked(getRegistreIndex).mockResolvedValue([
    { id: 7, nom: "Devoxx Belgium", slug: "devoxx-belgium", editions: [{ id: 42, annee: 2025, dateDebut: null, dateFin: null }] },
  ]);
  vi.mocked(addTalk).mockResolvedValue(51);
  vi.mocked(addOccurrence).mockResolvedValue(91);
  vi.mocked(soumettreProposition).mockResolvedValue({
    ok: true,
    propositionId: 11,
    reutilisee: false,
  });
});

describe("previewImportAction — lire sans écrire", () => {
  it("refuse sans session (garde d'abord)", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      previewImportAction({}, fd({ texte: JSON_DEUX_TALKS })),
    ).rejects.toThrow("REDIRECT:/connexion");
  });

  it("renvoie le plan annoté (répertoire / à proposer), sans AUCUNE écriture", async () => {
    const r = await previewImportAction({}, fd({ texte: JSON_DEUX_TALKS }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.map((t) => t.occurrences[0]?.action)).toEqual([
      "registre",
      "proposition",
    ]);
    expect(addTalk).not.toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
    expect(soumettreProposition).not.toHaveBeenCalled();
  });

  it("texte irrecevable → l'erreur du parseur, en clair", async () => {
    const r = await previewImportAction({}, fd({ texte: "du texte libre" }));
    expect(r.ok).toBe(false);
    if (r.ok !== false) return;
    expect(r.erreur).toBeTruthy();
  });

  it("texte au-delà du plafond → refus AVANT le parseur", async () => {
    const r = await previewImportAction({}, fd({ texte: "x".repeat(400_001) }));
    expect(r.ok).toBe(false);
  });
});

describe("confirmImportAction — écrire le plan, rien que le plan", () => {
  it("rate-limité (3 imports / h) : au-delà, erreur douce et zéro écriture", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const r = await confirmImportAction(
      {},
      fd({ texte: JSON_DEUX_TALKS, "talk-0": "on" }),
    );
    expect(r.ok).toBe(false);
    expect(addTalk).not.toHaveBeenCalled();
  });

  it("aucune case cochée → erreur claire, zéro écriture", async () => {
    const r = await confirmImportAction({}, fd({ texte: JSON_DEUX_TALKS }));
    expect(r.ok).toBe(false);
    expect(addTalk).not.toHaveBeenCalled();
  });

  it("talk coché avec conf CONNUE : talk créé, occurrence rattachée au répertoire", async () => {
    const r = await confirmImportAction(
      {},
      fd({ texte: JSON_DEUX_TALKS, "talk-0": "on" }),
    );
    expect(r.ok).toBe(true);
    expect(addTalk).toHaveBeenCalledWith(3, {
      titre: "Talk connu",
      type: "Conférence",
      description: null,
    });
    expect(addOccurrence).toHaveBeenCalledWith(
      51,
      3,
      expect.objectContaining({
        conferenceId: 7,
        editionId: 42,
        conference: "Devoxx Belgium 2025",
        date: "2025-10-06",
        propositionId: null,
      }),
    );
    // Le talk resté décoché n'a RIEN déclenché.
    expect(soumettreProposition).not.toHaveBeenCalled();
    // L'annuaire montre les talks sur les cartes : son cache expire aussitôt.
    expect(updateTag).toHaveBeenCalledWith("annuaire");
  });

  it("talk coché avec conf INCONNUE : proposition soumise, occurrence en attente", async () => {
    await confirmImportAction({}, fd({ texte: JSON_DEUX_TALKS, "talk-1": "on" }));
    expect(soumettreProposition).toHaveBeenCalledWith({
      userId: 7,
      nomConference: "KCD Helsinki",
      annee: 2026,
      ville: "Helsinki",
      url: null,
      endpoint: null,
    });
    expect(addOccurrence).toHaveBeenCalledWith(
      51,
      3,
      expect.objectContaining({ propositionId: 11, conference: "KCD Helsinki" }),
    );
  });

  it("conf inconnue déjà ÉCARTÉE par l'équipe : l'occurrence est passée, le talk reste créé", async () => {
    vi.mocked(soumettreProposition).mockResolvedValue({ ok: false, raison: "ecartee" });
    const r = await confirmImportAction(
      {},
      fd({ texte: JSON_DEUX_TALKS, "talk-1": "on" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(addTalk).toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
    expect(r.resultat.occurrencesEcartees).toBe(1);
  });

  /**
   * L'export Notist d'un PROFIL ne porte aucun nom de conférence (essai du
   * 16/08 sur le fichier réel d'Aurélie Vache : 178 dates, zéro conférence).
   * Le talk se crée quand même — mais le récapitulatif doit le DIRE, sinon il
   * annonce « 73 talks créés » et laisse croire que les scènes ont suivi.
   */
  it("fichier sans aucune conférence : les scènes passées sont COMPTÉES et dites", async () => {
    const sansConf = JSON.stringify([
      { title: "Talk A", date: "2026-07-09" },
      { title: "Talk A", date: "2026-02-27" },
    ]);
    const r = await confirmImportAction({}, fd({ texte: sansConf, "talk-0": "on" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(addTalk).toHaveBeenCalledTimes(1);
    expect(addOccurrence).not.toHaveBeenCalled();
    expect(r.resultat.talksCrees).toBe(1);
    expect(r.resultat.scenesSansConference).toBe(2);
  });

  /**
   * Le chantier Notist (PR #326), pinné sur le cas réel de l'éclaireur : la
   * fiche d'événement donne « WeAreDevelopers Europe 2026 » — et l'ANNÉE du
   * nom doit sortir en ÉDITION (exigence du 16/08) : la proposition part avec
   * le nom nu + annee, jamais un nom à millésime collé.
   */
  it("export Notist : la fiche d'événement nomme la conf, l'année du nom sort en édition", async () => {
    vi.mocked(resoudreEvenementsNotist).mockResolvedValue(
      new Map([
        [
          "4bUppk",
          {
            titre: "WeAreDevelopers Europe 2026",
            ville: "Berlin",
            pays: "Allemagne",
            dateDebut: "2026-07-08",
            dateFin: "2026-07-10",
          },
        ],
      ]),
    );
    const notist = JSON.stringify({
      data: [
        {
          type: "authors",
          attributes: { name: "Aurélie" },
          relationships: {
            data: [
              {
                type: "presentations",
                attributes: { title: "Understanding K8s", presented_on: "2026-07-09 14:00:00" },
                links: { event: "https://noti.st/events/4bUppk.json" },
              },
            ],
          },
        },
      ],
    });
    const r = await confirmImportAction({}, fd({ texte: notist, "talk-0": "on" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(soumettreProposition).toHaveBeenCalledWith(
      expect.objectContaining({ nomConference: "WeAreDevelopers Europe", annee: 2026 }),
    );
    expect(addOccurrence).toHaveBeenCalledWith(
      51,
      3,
      expect.objectContaining({
        conference: "WeAreDevelopers Europe",
        ville: "Berlin",
        pays: "Allemagne",
        date: "2026-07-09", // la date de SA présentation, pas celle de l'événement
      }),
    );
  });

  it("présentation SANS date à un événement multi-jours : le mois est légué, jamais le jour de début", async () => {
    vi.mocked(resoudreEvenementsNotist).mockResolvedValue(
      new Map([
        ["4bUppk", { titre: "WeAreDevelopers Europe", ville: "Berlin", pays: "Allemagne", dateDebut: "2026-07-08", dateFin: "2026-07-10" }],
      ]),
    );
    const notist = JSON.stringify({
      data: [
        {
          type: "authors",
          attributes: { name: "Aurélie" },
          relationships: {
            data: [
              {
                type: "presentations",
                attributes: { title: "Talk sans date" },
                links: { event: "https://noti.st/events/4bUppk.json" },
              },
            ],
          },
        },
      ],
    });
    const r = await confirmImportAction({}, fd({ texte: notist, "talk-0": "on" }));
    expect(r.ok).toBe(true);
    expect(addOccurrence).toHaveBeenCalledWith(
      51,
      3,
      expect.objectContaining({ date: "2026-07" }),
    );
  });

  it("fiche d'événement injoignable : la scène reste « date seule », l'import aboutit", async () => {
    vi.mocked(resoudreEvenementsNotist).mockResolvedValue(new Map());
    const notist = JSON.stringify({
      data: [
        {
          type: "authors",
          attributes: { name: "Aurélie" },
          relationships: {
            data: [
              {
                type: "presentations",
                attributes: { title: "Talk sans fiche", presented_on: "2026-07-09 14:00:00" },
                links: { event: "https://noti.st/events/zzz999.json" },
              },
            ],
          },
        },
      ],
    });
    const r = await confirmImportAction({}, fd({ texte: notist, "talk-0": "on" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(addTalk).toHaveBeenCalledTimes(1);
    expect(addOccurrence).not.toHaveBeenCalled();
    expect(r.resultat.scenesSansConference).toBe(1);
  });

  it("talk DÉJÀ sur la fiche : complété (aucun addTalk), occurrence ajoutée dessus", async () => {
    vi.mocked(getTalksByProfileId).mockResolvedValue([
      {
        id: 5, profileId: 3, titre: "Talk connu", type: "Conférence",
        description: null, occurrences: [],
      },
    ]);
    await confirmImportAction({}, fd({ texte: JSON_DEUX_TALKS, "talk-0": "on" }));
    expect(addTalk).not.toHaveBeenCalled();
    expect(addOccurrence).toHaveBeenCalledWith(5, 3, expect.anything());
  });

  it("le décompte rendu reflète les écritures réelles", async () => {
    const r = await confirmImportAction(
      {},
      fd({ texte: JSON_DEUX_TALKS, "talk-0": "on", "talk-1": "on" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultat).toMatchObject({
      talksCrees: 2,
      occurrencesPubliees: 1,
      occurrencesEnAttente: 1,
    });
  });
});

describe("confirmImportAction — bornes trouvées en revue", () => {
  /**
   * Plafond mesuré sur le fichier RÉEL d'Aurélie Vache (16/08/2026) : 178
   * présentations → 154 conférences distinctes (nom, année). À 20, son import
   * demandait 8 lots étalés sur 3 h (quota de confirmation 3/h) : un portfolio
   * de dix ans doit passer en UN lot.
   */
  it("un portfolio réel (154 conférences inconnues) passe en UN lot", async () => {
    const portfolio = JSON.stringify(
      Array.from({ length: 154 }, (_, i) => ({
        title: `Talk ${i}`,
        event: `Conf Inconnue ${i}`,
      })),
    );
    const cases = Object.fromEntries(
      Array.from({ length: 154 }, (_, i) => [`talk-${i}`, "on"]),
    );
    const r = await confirmImportAction({}, fd({ texte: portfolio, ...cases }));
    expect(r.ok).toBe(true);
    expect(soumettreProposition).toHaveBeenCalledTimes(154);
  });

  it("exactement 200 conférences inconnues → accepté : la borne est inclusive", async () => {
    const pile = JSON.stringify(
      Array.from({ length: 200 }, (_, i) => ({
        title: `Talk ${i}`,
        event: `Conf Inconnue ${i}`,
      })),
    );
    const cases = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`talk-${i}`, "on"]),
    );
    const r = await confirmImportAction({}, fd({ texte: pile, ...cases }));
    expect(r.ok).toBe(true);
    expect(soumettreProposition).toHaveBeenCalledTimes(200);
  });

  it("plus de 200 conférences hors répertoire dans le lot → refus clair, la file orga est protégée", async () => {
    const beaucoup = JSON.stringify(
      Array.from({ length: 201 }, (_, i) => ({
        title: `Talk ${i}`,
        event: `Conf Inconnue ${i}`,
      })),
    );
    const cases = Object.fromEntries(
      Array.from({ length: 201 }, (_, i) => [`talk-${i}`, "on"]),
    );
    const r = await confirmImportAction({}, fd({ texte: beaucoup, ...cases }));
    expect(r.ok).toBe(false);
    if (r.ok !== false) return;
    expect(r.erreur).toMatch(/200/);
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(addTalk).not.toHaveBeenCalled();
  });

  it("le quota se consomme APRÈS les contrôles : une soumission sans case cochée le laisse intact", async () => {
    await confirmImportAction({}, fd({ texte: JSON_DEUX_TALKS }));
    expect(isRateLimited).not.toHaveBeenCalled();
  });

  it("la porte partagée refuse un nom impromouvable même si le plan l'avait laissé passer", async () => {
    vi.mocked(soumettreProposition).mockResolvedValue({ ok: false, raison: "nom_invalide" });
    const r = await confirmImportAction(
      {},
      fd({ texte: JSON_DEUX_TALKS, "talk-1": "on" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultat.occurrencesEcartees).toBe(1);
    expect(addOccurrence).not.toHaveBeenCalled();
  });
});
