import { describe, it, expect, vi, beforeEach } from "vitest";

// Modules mockés : on teste l'ORCHESTRATION (qui appelle quoi, avec quoi),
// le mapping/matching et le SQL ont leurs propres tests.
const fetchSessionizeEvent = vi.fn();
const mapSessionizeEvent = vi.fn();
const matchSpeakerToProfile = vi.fn();
vi.mock("@/lib/cfp-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cfp-import")>()),
  fetchSessionizeEvent: (...a: unknown[]) => fetchSessionizeEvent(...a),
  mapSessionizeEvent: (...a: unknown[]) => mapSessionizeEvent(...a),
  matchSpeakerToProfile: (...a: unknown[]) => matchSpeakerToProfile(...a),
}));

const getActiveCfpEvents = vi.fn();
const getMatchableProfiles = vi.fn();
const getSuggestionEmailTargets = vi.fn();
const upsertSuggestion = vi.fn();
const refreshImportedTalk = vi.fn();
vi.mock("@/lib/cfp-suggestions", () => ({
  getActiveCfpEvents: (...a: unknown[]) => getActiveCfpEvents(...a),
  getMatchableProfiles: (...a: unknown[]) => getMatchableProfiles(...a),
  getSuggestionEmailTargets: (...a: unknown[]) => getSuggestionEmailTargets(...a),
  upsertSuggestion: (...a: unknown[]) => upsertSuggestion(...a),
  refreshImportedTalk: (...a: unknown[]) => refreshImportedTalk(...a),
}));

const sendBrevoEmail = vi.fn();
vi.mock("@/lib/email", () => ({ sendBrevoEmail: (...a: unknown[]) => sendBrevoEmail(...a) }));

import { syncCfpEvents, buildSuggestionsEmail } from "@/lib/cfp-sync";

const devfest = {
  id: 1,
  nom: "DevFest Toulouse 2026",
  source: "sessionize",
  endpoint: "abc123",
  url: "https://devfesttoulouse.fr",
  ville: "Toulouse",
  pays: "France",
  dateDebut: "2026-11-19",
  dateFin: null,
};

const candidat = {
  externalId: "sess-1",
  titre: "Beyond Agile",
  description: "Desc",
  date: null, // la session n'est pas datée → fallback sur date_debut de l'événement
  speaker: { fullName: "Montaine Marteau", links: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  getMatchableProfiles.mockResolvedValue([
    { id: 4, name: "Montaine Marteau", linkedin: null, sessionizeUrl: null },
  ]);
  refreshImportedTalk.mockResolvedValue(false);
  upsertSuggestion.mockResolvedValue(true); // une vraie création par défaut
  // Par défaut : aucune cible e-mail (les tests notif surchargent).
  getSuggestionEmailTargets.mockResolvedValue([]);
  sendBrevoEmail.mockResolvedValue(undefined);
});

describe("syncCfpEvents", () => {
  it("moissonne chaque événement actif et crée les suggestions des speakers matchés", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({ sessions: [], speakers: [] });
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });

    const res = await syncCfpEvents();

    expect(fetchSessionizeEvent).toHaveBeenCalledWith("abc123");
    expect(upsertSuggestion).toHaveBeenCalledWith({
      profileId: 4,
      eventId: 1,
      externalId: "sess-1",
      titre: "Beyond Agile",
      description: "Desc",
      date: "2026-11-19", // fallback événement
      conference: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      lienConf: "https://devfesttoulouse.fr",
    });
    expect(res).toMatchObject({ events: 1, suggestions: 1, majs: 0, erreurs: 0 });
  });

  // Troisième porte de la même règle (dateLegueeParEdition) : la moisson non
  // plus n'affirme jamais un jour que personne ne connaît.
  it("événement MULTI-JOURS + session sans date → la suggestion hérite du MOIS, jamais d'un faux jour", async () => {
    getActiveCfpEvents.mockResolvedValue([
      { ...devfest, dateDebut: "2026-11-19", dateFin: "2026-11-21" },
    ]);
    fetchSessionizeEvent.mockResolvedValue({ sessions: [], speakers: [] });
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });

    await syncCfpEvents();

    expect(upsertSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-11" }),
    );
  });

  it("rafraîchit un talk déjà confirmé au lieu de re-suggérer", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "fort" });
    refreshImportedTalk.mockResolvedValue(true);

    const res = await syncCfpEvents();

    expect(refreshImportedTalk).toHaveBeenCalledWith(4, 1, "sessionize", "sess-1", {
      titre: "Beyond Agile",
      date: "2026-11-19",
      conference: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      lienConf: "https://devfesttoulouse.fr",
    });
    expect(upsertSuggestion).not.toHaveBeenCalled();
    expect(res).toMatchObject({ majs: 1, suggestions: 0 });
  });

  it("n'envoie jamais un lien non http(s) vers les fiches (javascript: écarté)", async () => {
    getActiveCfpEvents.mockResolvedValue([{ ...devfest, url: "javascript:alert(1)" }]);
    fetchSessionizeEvent.mockResolvedValue({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });

    await syncCfpEvents();
    expect(upsertSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ lienConf: null }),
    );
  });

  it("plafonne les suggestions créées par profil et par événement", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({});
    // 25 sessions différentes créditées à la même speakeuse
    mapSessionizeEvent.mockReturnValue(
      Array.from({ length: 25 }, (_, i) => ({ ...candidat, externalId: `sess-${i}` })),
    );
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });

    const res = await syncCfpEvents();
    expect(upsertSuggestion).toHaveBeenCalledTimes(20);
    expect(res).toMatchObject({ suggestions: 20 });
  });

  it("ne compte pas une suggestion no-op (déjà refusée → upsert renvoie false)", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });
    upsertSuggestion.mockResolvedValue(false); // ON CONFLICT … WHERE proposee = no-op

    const res = await syncCfpEvents();
    expect(res).toMatchObject({ suggestions: 0 });
  });

  it("une source inconnue est comptée en erreur (pas ignorée en silence)", async () => {
    getActiveCfpEvents.mockResolvedValue([{ ...devfest, source: "mystere" }]);
    const res = await syncCfpEvents();
    expect(res).toMatchObject({ events: 1, erreurs: 1, suggestions: 0 });
  });

  it("ignore les candidats sans match", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue(null);

    const res = await syncCfpEvents();
    expect(upsertSuggestion).not.toHaveBeenCalled();
    expect(res).toMatchObject({ suggestions: 0, erreurs: 0 });
  });

  it("une source pas encore branchée (conference-hall) est comptée en erreur, pas moissonnée", async () => {
    getActiveCfpEvents.mockResolvedValue([{ ...devfest, source: "conference-hall" }]);

    const res = await syncCfpEvents();
    expect(fetchSessionizeEvent).not.toHaveBeenCalled();
    expect(res).toMatchObject({ events: 1, suggestions: 0, erreurs: 1 });
  });

  it("un événement en erreur n'interrompt pas les autres", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest, { ...devfest, id: 2, endpoint: "def456" }]);
    fetchSessionizeEvent
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockResolvedValueOnce({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });

    const res = await syncCfpEvents();
    expect(res).toMatchObject({ events: 2, erreurs: 1, suggestions: 1 });
  });

  it("ne charge pas les profils s'il n'y a aucun événement actif", async () => {
    getActiveCfpEvents.mockResolvedValue([]);
    const res = await syncCfpEvents();
    expect(getMatchableProfiles).not.toHaveBeenCalled();
    expect(res).toEqual({ events: 0, suggestions: 0, majs: 0, erreurs: 0, notifs: 0 });
  });
});

describe("syncCfpEvents — notification e-mail", () => {
  beforeEach(() => {
    getActiveCfpEvents.mockResolvedValue([devfest]);
    fetchSessionizeEvent.mockResolvedValue({});
    mapSessionizeEvent.mockReturnValue([candidat]);
    matchSpeakerToProfile.mockReturnValue({ profileId: 4, strength: "faible" });
  });

  it("prévient par e-mail la speakeuse ayant de nouvelles suggestions", async () => {
    getSuggestionEmailTargets.mockResolvedValue([
      { id: 4, email: "montaine@example.fr", name: "Montaine Marteau" },
    ]);

    const res = await syncCfpEvents();

    expect(getSuggestionEmailTargets).toHaveBeenCalledWith([4]);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "montaine@example.fr" }),
    );
    expect(res).toMatchObject({ suggestions: 1, notifs: 1 });
  });

  it("n'envoie aucun e-mail sans nouvelle suggestion (que des mises à jour)", async () => {
    refreshImportedTalk.mockResolvedValue(true); // talk déjà confirmé → maj, pas de suggestion

    const res = await syncCfpEvents();

    expect(getSuggestionEmailTargets).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(res).toMatchObject({ majs: 1, suggestions: 0, notifs: 0 });
  });

  it("un envoi qui échoue n'interrompt pas la moisson (notifs non incrémenté)", async () => {
    getSuggestionEmailTargets.mockResolvedValue([
      { id: 4, email: "montaine@example.fr", name: null },
    ]);
    sendBrevoEmail.mockRejectedValue(new Error("Brevo 500"));

    const res = await syncCfpEvents();
    expect(res).toMatchObject({ suggestions: 1, notifs: 0 });
  });

  it("un échec de lecture des cibles n'interrompt pas la moisson (compteurs préservés)", async () => {
    getSuggestionEmailTargets.mockRejectedValue(new Error("DB down"));
    const res = await syncCfpEvents();
    // La moisson a réussi : les compteurs remontent malgré l'échec de la notif.
    expect(res).toMatchObject({ events: 1, suggestions: 1, notifs: 0 });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("un seul e-mail par speakeuse même si plusieurs événements la matchent", async () => {
    getActiveCfpEvents.mockResolvedValue([devfest, { ...devfest, id: 2, endpoint: "def" }]);
    getSuggestionEmailTargets.mockResolvedValue([
      { id: 4, email: "montaine@example.fr", name: "Montaine Marteau" },
    ]);

    const res = await syncCfpEvents();
    // 2 suggestions (une par événement) mais un SEUL e-mail récap.
    expect(getSuggestionEmailTargets).toHaveBeenCalledWith([4]);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ suggestions: 2, notifs: 1 });
  });
});

describe("buildSuggestionsEmail", () => {
  it("accorde au singulier (1 talk)", () => {
    const mail = buildSuggestionsEmail("Ada", 1);
    expect(mail.subject).toMatch(/Un talk repéré/);
    expect(mail.textContent).toContain("Salut Ada,");
    expect(mail.textContent).toContain("un nouveau talk");
    expect(mail.textContent).toContain("/mon-espace");
  });

  it("accorde au pluriel (N talks) et gère l'absence de nom", () => {
    const mail = buildSuggestionsEmail(null, 3);
    expect(mail.subject).toMatch(/3 talks repérés/);
    expect(mail.textContent).toContain("Salut,");
    expect(mail.textContent).toContain("3 nouveaux talks");
  });

  it("échappe le HTML du nom (pas d'injection dans le corps HTML)", () => {
    const mail = buildSuggestionsEmail("<script>alert(1)</script>", 1);
    expect(mail.htmlContent).not.toContain("<script>");
    expect(mail.htmlContent).toContain("&lt;script&gt;");
  });
});
