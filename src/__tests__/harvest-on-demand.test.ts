import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Moisson à la demande (runHarvestForProfile) : même machinerie que le cron,
 * mais scopée à UN profil (l'index de matching ne contient qu'elle — personne
 * d'autre ne reçoit de suggestion d'un run utilisateur), bornée (éditions
 * récentes, plafond de fetchs) et SANS e-mail.
 */

vi.mock("@/lib/cfp-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cfp-import")>();
  return { ...actual, fetchSessionizeEvent: vi.fn() };
});
vi.mock("@/lib/cfp-suggestions", () => ({
  getActiveCfpEvents: vi.fn(),
  getMatchableProfiles: vi.fn(),
  getMatchableProfileById: vi.fn(),
  getSuggestionEmailTargets: vi.fn(),
  upsertSuggestion: vi.fn(),
  refreshImportedTalk: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));

import { runHarvestForProfile } from "@/lib/cfp-sync";
import { fetchSessionizeEvent } from "@/lib/cfp-import";
import {
  getActiveCfpEvents,
  getMatchableProfileById,
  upsertSuggestion,
  refreshImportedTalk,
} from "@/lib/cfp-suggestions";
import { sendBrevoEmail } from "@/lib/email";

const fetchMock = vi.mocked(fetchSessionizeEvent);
const eventsMock = vi.mocked(getActiveCfpEvents);
const profilesMock = vi.mocked(getMatchableProfileById);
const upsertMock = vi.mocked(upsertSuggestion);
const refreshMock = vi.mocked(refreshImportedTalk);

/** Une édition active de la référence, datée d'hier par défaut (récente). */
function event(over: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...over };
}
function base() {
  const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return {
    id: 1,
    nom: "DevFest Toulouse 2026",
    source: "sessionize",
    endpoint: "abc123def",
    url: "https://devfest.example",
    ville: "Toulouse",
    pays: "France",
    dateDebut: hier,
    dateFin: null,
  };
}

const MOI = { id: 7, name: "Clara Zetkin", linkedin: null, sessionizeUrl: null };

/** Un programme Sessionize avec une session par speaker nommé. */
function programme(...speakers: string[]) {
  return {
    sessions: speakers.map((s, i) => ({
      id: `s-${i}`,
      title: `Talk de ${s}`,
      speakers: [`sp-${i}`],
    })),
    speakers: speakers.map((s, i) => ({ id: `sp-${i}`, fullName: s, links: [] })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Lecture CIBLÉE : ne renvoie que le profil demandé (jamais AUTRE).
  profilesMock.mockResolvedValue([MOI]);
  eventsMock.mockResolvedValue([event()]);
  refreshMock.mockResolvedValue(false);
  upsertMock.mockResolvedValue(true);
});

describe("runHarvestForProfile", () => {
  it("ne matche QUE le profil demandé : le talk d'une autre speakeuse n'est pas suggéré", async () => {
    fetchMock.mockResolvedValue(programme("Rosa Bonheur", "Clara Zetkin"));

    const res = await runHarvestForProfile(MOI.id);

    expect(res.suggestions).toBe(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ profileId: MOI.id });
  });

  it("profil opté-out (ou inconnu) → run vide, aucun fetch", async () => {
    profilesMock.mockResolvedValue([]); // opt-out ('aucun') ou inconnu
    const res = await runHarvestForProfile(MOI.id);
    expect(res).toEqual({ events: 0, suggestions: 0, majs: 0, erreurs: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("n'envoie JAMAIS d'e-mail (elle est devant son écran)", async () => {
    fetchMock.mockResolvedValue(programme("Clara Zetkin"));
    await runHarvestForProfile(MOI.id);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("borne le nombre d'éditions parcourues et écarte les trop anciennes", async () => {
    const vieux = event({ id: 99, endpoint: "old123", dateDebut: "2020-01-01" });
    const recents = Array.from({ length: 40 }, (_, i) =>
      event({ id: i + 1, endpoint: `ep${i}xxx` }),
    );
    eventsMock.mockResolvedValue([vieux, ...recents]);
    fetchMock.mockResolvedValue(programme());

    const res = await runHarvestForProfile(MOI.id);

    // Plafond (30) ET filtre 18 mois : l'édition de 2020 n'est pas fetchée.
    expect(res.events).toBe(30);
    expect(fetchMock).toHaveBeenCalledTimes(30);
  });

  it("un événement en erreur n'interrompt pas le run (compté, run poursuivi)", async () => {
    eventsMock.mockResolvedValue([event({ id: 1 }), event({ id: 2, endpoint: "ep2xxx" })]);
    fetchMock
      .mockRejectedValueOnce(new Error("HTTP 404"))
      .mockResolvedValueOnce(programme("Clara Zetkin"));

    const res = await runHarvestForProfile(MOI.id);

    expect(res.erreurs).toBe(1);
    expect(res.suggestions).toBe(1);
  });
});
