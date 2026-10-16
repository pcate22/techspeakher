import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Sync des meetups Toulouse Tech Hub (lot 2, docs/implementation-registre-
 * conferences.md). Le flux `events.json` est un artefact Jekyll, PAS une API
 * contractuelle : le mapping doit être tolérant entrée par entrée (une ligne
 * bancale est sautée, jamais d'échec du lot), et « 0 meetup parsé » compte
 * comme une erreur visible (format qui a changé ≠ silence).
 *
 * Format capturé (juillet 2026) : tableau d'objets
 * { Id: "meetup-308804426", Href, Title, Start: "2025-07-23 18:30", Img,
 *   Group: "Agile Toulouse", Venue, VenueAddr, HtmlDescription } —
 * événements FUTURS uniquement (le passé sort du flux, d'où « jamais de purge »).
 */

vi.mock("@/lib/conferences", () => ({ upsertMeetupEdition: vi.fn() }));

import { mapTechHubEvents, syncTechHubMeetups } from "@/lib/meetup-sync";
import { upsertMeetupEdition } from "@/lib/conferences";

const upsertMock = vi.mocked(upsertMeetupEdition);

/** Une entrée valide du flux, surchargeable. */
function entry(over: Record<string, unknown> = {}) {
  return {
    Id: "meetup-308804426",
    Href: "https://www.meetup.com/fr-FR/agile-toulouse/events/308804426/",
    Title: "Agile Rescue : reprenez le contrôle !",
    Start: "2025-07-23 18:30",
    Group: "Agile Toulouse",
    Venue: "Etincelle (Alsace-Lorraine)",
    VenueAddr: "36, rue d'Alsace-Lorraine Toulouse",
    ...over,
  };
}

describe("mapTechHubEvents (entrée externe non maîtrisée)", () => {
  it("mappe une entrée valide : id, titre, groupe, date (YYYY-MM-DD), lieu, url", () => {
    const [m] = mapTechHubEvents([entry()]);
    expect(m).toEqual({
      meetupId: "meetup-308804426",
      titre: "Agile Rescue : reprenez le contrôle !",
      groupe: "Agile Toulouse",
      date: "2025-07-23",
      lieu: "Etincelle (Alsace-Lorraine)",
      url: "https://www.meetup.com/fr-FR/agile-toulouse/events/308804426/",
    });
  });

  it("saute les entrées bancales sans faire échouer le lot", () => {
    const res = mapTechHubEvents([
      entry(),
      { Title: "Sans id" }, // pas d'Id
      { Id: "meetup-2", Group: "X" }, // pas de Title
      { Id: "meetup-3", Title: "Sans groupe" }, // pas de Group
      null,
      42,
      entry({ Id: "meetup-4", Title: "Deuxième valide" }),
    ]);
    expect(res.map((m) => m.meetupId)).toEqual(["meetup-308804426", "meetup-4"]);
  });

  it("borne le titre à 160 caractères et filtre les URL non http(s)", () => {
    const [m] = mapTechHubEvents([
      entry({ Title: "x".repeat(500), Href: "javascript:alert(1)" }),
    ]);
    expect(m.titre).toHaveLength(160);
    expect(m.url).toBeNull();
  });

  it("date absente ou illisible → null (le meetup reste référencé)", () => {
    const [sans, illisible] = mapTechHubEvents([
      entry({ Start: undefined }),
      entry({ Id: "meetup-5", Start: "bientôt" }),
    ]);
    expect(sans.date).toBeNull();
    expect(illisible.date).toBeNull();
  });

  it("un flux non-tableau → aucune entrée (pas d'exception)", () => {
    expect(mapTechHubEvents({ oops: true })).toEqual([]);
    expect(mapTechHubEvents(null)).toEqual([]);
  });
});

describe("syncTechHubMeetups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, ok = true) {
    vi.mocked(fetch).mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      headers: new Headers(),
      json: async () => body,
    } as Response);
  }

  it("upserte chaque meetup valide et les compte", async () => {
    stubFetch([entry(), entry({ Id: "meetup-9", Title: "Autre" })]);
    const res = await syncTechHubMeetups();
    expect(res).toEqual({ meetups: 2, erreurs: 0 });
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it("« 0 meetup parsé » compte comme une erreur (format qui a changé ≠ silence)", async () => {
    stubFetch([{ format: "inconnu" }]);
    const res = await syncTechHubMeetups();
    expect(res.meetups).toBe(0);
    expect(res.erreurs).toBe(1);
  });

  it("flux en panne (HTTP 500) → 1 erreur, pas d'exception (retenté au prochain run)", async () => {
    stubFetch(null, false);
    const res = await syncTechHubMeetups();
    expect(res).toEqual({ meetups: 0, erreurs: 1 });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("une ligne qui échoue en base n'interrompt pas les autres", async () => {
    stubFetch([entry(), entry({ Id: "meetup-9", Title: "Autre" })]);
    upsertMock.mockRejectedValueOnce(new Error("boom"));
    const res = await syncTechHubMeetups();
    expect(res).toEqual({ meetups: 1, erreurs: 1 });
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });
});
