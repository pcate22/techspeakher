import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchSessionizeEvent,
  mapSessionizeEvent,
  matchSpeakerToProfile,
  buildProfileIndex,
  isHttpUrl,
  type SessionizeEventData,
  type MatchableProfile,
} from "@/lib/cfp-import";
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-form";

// ─── Fixture : forme du JSON Sessionize `view/All` (endpoint public) ───

const eventData: SessionizeEventData = {
  sessions: [
    {
      id: "sess-1",
      title: "Beyond Agile",
      description: "Dans les coulisses des licornes.",
      startsAt: "2026-11-19T10:00:00",
      speakers: ["spk-a"],
    },
    {
      id: "sess-2",
      title: "La santé a-t-elle peur du cloud ?",
      description: null,
      startsAt: null,
      speakers: ["spk-a", "spk-b"],
    },
  ],
  speakers: [
    {
      id: "spk-a",
      fullName: "Léa Dubois",
      links: [{ url: "https://www.linkedin.com/in/lea-dubois-demo/" }],
    },
    { id: "spk-b", fullName: "Rachel Dubois", links: [] },
  ],
};

describe("mapSessionizeEvent", () => {
  it("produit un candidat par couple session × speaker", () => {
    const candidats = mapSessionizeEvent(eventData);
    // sess-1 (1 speaker) + sess-2 (2 co-speakers) = 3 candidats
    expect(candidats).toHaveLength(3);
    expect(candidats.map((c) => c.externalId)).toEqual([
      "sess-1",
      "sess-2",
      "sess-2",
    ]);
  });

  it("accepte les speakers imbriqués en objets { id, name } (forme /view/Sessions)", () => {
    // /view/Sessions imbrique les speakers en objets, là où /view/All les liste
    // par ID. Sans normalisation, le mapping ne trouvait aucun speaker → 0 talk.
    const data: SessionizeEventData = {
      sessions: [
        {
          id: "s1",
          title: "T1",
          description: null,
          startsAt: null,
          speakers: [{ id: "spk-a", name: "Ada" }],
        },
      ],
      speakers: [{ id: "spk-a", fullName: "Ada", links: [] }],
    };
    const candidats = mapSessionizeEvent(data);
    expect(candidats).toHaveLength(1);
    expect(candidats[0].speaker.fullName).toBe("Ada");
  });

  it("extrait titre, description et date (YYYY-MM-DD) depuis startsAt", () => {
    const [c] = mapSessionizeEvent(eventData);
    expect(c.titre).toBe("Beyond Agile");
    expect(c.description).toBe("Dans les coulisses des licornes.");
    expect(c.date).toBe("2026-11-19");
  });

  it("laisse la date null quand startsAt est absent", () => {
    const candidats = mapSessionizeEvent(eventData);
    expect(candidats[1].date).toBeNull();
  });

  it("porte le speaker (nom + liens) pour le matching", () => {
    const candidats = mapSessionizeEvent(eventData);
    expect(candidats[0].speaker.fullName).toBe("Léa Dubois");
    expect(candidats[0].speaker.links).toEqual([
      "https://www.linkedin.com/in/lea-dubois-demo/",
    ]);
    expect(candidats[2].speaker.fullName).toBe("Rachel Dubois");
  });

  it("tronque titre et description aux limites de talk-form", () => {
    const long: SessionizeEventData = {
      sessions: [
        {
          id: "s",
          title: "t".repeat(TITRE_MAX + 100),
          description: "x".repeat(DESCRIPTION_MAX + 500),
          startsAt: null,
          speakers: ["a"],
        },
      ],
      speakers: [{ id: "a", fullName: "A", links: [] }],
    };
    const [c] = mapSessionizeEvent(long);
    // sinon le talk importé serait inéditable (Zod rejette au-delà à la 1re modif)
    expect(c.titre).toHaveLength(TITRE_MAX);
    expect(c.description).toHaveLength(DESCRIPTION_MAX);
  });

  it("ignore une session dont le speaker est inconnu (données incohérentes)", () => {
    const bancal: SessionizeEventData = {
      sessions: [{ id: "s", title: "T", description: null, startsAt: null, speakers: ["fantome"] }],
      speakers: [],
    };
    expect(mapSessionizeEvent(bancal)).toHaveLength(0);
  });

  it("résiste à un payload dégradé : champs absents → sessions saines conservées, pas de plantage", () => {
    // Entrée externe : sessions sans titre, speakers sans nom, tableaux absents…
    const degrade = {
      sessions: [
        { id: "ok", title: "Talk valide", speakers: ["a"] },
        { id: "sans-titre", speakers: ["a"] }, // title manquant
        null, // entrée nulle
        { id: null, title: "sans id", speakers: ["a"] },
      ],
      speakers: [
        { id: "a", fullName: "Ada Lovelace", links: [{ url: "https://l" }, null, {}] },
        { id: "b" }, // fullName manquant
        null,
      ],
    } as unknown as SessionizeEventData;

    const candidats = mapSessionizeEvent(degrade);
    expect(candidats).toHaveLength(1);
    expect(candidats[0].titre).toBe("Talk valide");
    expect(candidats[0].speaker.links).toEqual(["https://l"]);
  });

  it("payload sans sessions ni speakers : liste vide, pas d'exception", () => {
    expect(mapSessionizeEvent({} as SessionizeEventData)).toEqual([]);
  });
});

// ─── Matching speaker → profil ───

const profils: MatchableProfile[] = [
  {
    id: 1,
    name: "Léa Dubois",
    linkedin: "https://linkedin.com/in/lea-dubois-demo",
    sessionizeUrl: null,
  },
  {
    id: 2,
    name: "Rachel Dubois",
    linkedin: null,
    sessionizeUrl: "https://sessionize.com/rachel-dubois/",
  },
];

const index = buildProfileIndex(profils);

describe("matchSpeakerToProfile", () => {
  it("match FORT par lien LinkedIn (www, https, slash final et query ignorés)", () => {
    const m = matchSpeakerToProfile(
      { fullName: "L. D.", links: ["https://www.linkedin.com/in/lea-dubois-demo/?originalSubdomain=fr"] },
      index,
    );
    expect(m).toEqual({ profileId: 1, strength: "fort" });
  });

  it("match FORT par lien Sessionize du profil", () => {
    const m = matchSpeakerToProfile(
      { fullName: "R. D.", links: ["http://sessionize.com/rachel-dubois"] },
      index,
    );
    expect(m).toEqual({ profileId: 2, strength: "fort" });
  });

  it("match FAIBLE par nom normalisé (accents et casse ignorés)", () => {
    const m = matchSpeakerToProfile(
      { fullName: "  RACHEL   DUBOÎS ", links: [] },
      index,
    );
    expect(m).toEqual({ profileId: 2, strength: "faible" });
  });

  it("aucun match : null", () => {
    expect(
      matchSpeakerToProfile({ fullName: "Personne Inconnue", links: [] }, index),
    ).toBeNull();
  });

  it("ne matche pas par nom un profil sans nom", () => {
    const idx = buildProfileIndex([
      { id: 3, name: null, linkedin: null, sessionizeUrl: null },
    ]);
    expect(matchSpeakerToProfile({ fullName: "", links: [] }, idx)).toBeNull();
  });

  it("homonymes : deux profils au même nom → AUCUN match (jamais d'attribution arbitraire)", () => {
    const idx = buildProfileIndex([
      { id: 1, name: "Marie Dupont", linkedin: null, sessionizeUrl: null },
      { id: 2, name: "Marie Dupont", linkedin: null, sessionizeUrl: null },
    ]);
    expect(
      matchSpeakerToProfile({ fullName: "Marie Dupont", links: [] }, idx),
    ).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("n'accepte que http(s) (jamais javascript: vers un href)", () => {
    expect(isHttpUrl("https://devfesttoulouse.fr")).toBe(true);
    expect(isHttpUrl("http://exemple.fr")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,x")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});

// ─── Client HTTP ───

describe("fetchSessionizeEvent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("appelle l'endpoint public view/All et retourne le JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve(eventData),
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSessionizeEvent("abc123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sessionize.com/api/v2/abc123/view/All",
      // un timeout est TOUJOURS posé (un endpoint qui pend ne bloque pas le cron)
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(data.sessions).toHaveLength(2);
  });

  it("refuse une réponse anormalement grosse (garde-fou mémoire)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-length": "99999999" }),
        json: () => Promise.resolve(eventData),
      }),
    );
    await expect(fetchSessionizeEvent("abc123")).rejects.toThrow(/trop grosse/);
  });

  it("jette une erreur explicite si la réponse n'est pas ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchSessionizeEvent("abc123")).rejects.toThrow(/abc123.*404/);
  });
});

// ─── Repli sur les vues JSON quand /view/All n'est pas ouverte ───
// Beaucoup d'orgas Sessionize n'ouvrent pas la vue All (404) mais ouvrent
// Sessions + Speakers : on recompose alors la même forme SessionizeEventData.

/** Mock de fetch qui répond selon la vue Sessionize (`…/view/<vue>`). */
function mockFetchByView(
  map: Record<
    string,
    { ok: boolean; status?: number; body?: unknown; contentLength?: string }
  >,
) {
  return vi.fn((url: string) => {
    const view = url.match(/\/view\/(\w+)/)?.[1] ?? "";
    const r = map[view];
    if (!r) return Promise.resolve({ ok: false, status: 404, headers: new Headers() });
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 404),
      headers: new Headers(
        r.contentLength ? { "content-length": r.contentLength } : {},
      ),
      json: () => Promise.resolve(r.body),
    });
  });
}

describe("fetchSessionizeEvent — repli Sessions + Speakers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replie sur /view/Sessions (groupé) + /view/Speakers quand /view/All répond 404", async () => {
    const sessionsGroupes = [
      { groupId: 1, groupName: "Track A", sessions: [{ id: "s1", title: "T1", speakers: ["a"] }] },
      { groupId: 2, groupName: "Track B", sessions: [{ id: "s2", title: "T2", speakers: ["b"] }] },
    ];
    const speakers = [
      { id: "a", fullName: "Ada", links: [] },
      { id: "b", fullName: "Bea", links: [] },
    ];
    vi.stubGlobal(
      "fetch",
      mockFetchByView({
        All: { ok: false, status: 404 },
        Sessions: { ok: true, body: sessionsGroupes },
        Speakers: { ok: true, body: speakers },
      }),
    );

    const data = await fetchSessionizeEvent("abc123");
    // les 2 groupes sont aplatis en une liste plate de sessions
    expect(data.sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(data.speakers).toHaveLength(2);
    // la forme recomposée nourrit le mapping habituel
    expect(mapSessionizeEvent(data)).toHaveLength(2);
  });

  it("replie même quand /view/Sessions renvoie un tableau plat de sessions", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByView({
        All: { ok: false, status: 404 },
        Sessions: { ok: true, body: [{ id: "s1", title: "T1", speakers: [] }] },
        Speakers: { ok: true, body: [] },
      }),
    );

    const data = await fetchSessionizeEvent("abc123");
    expect(data.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(data.speakers).toEqual([]);
  });

  it("rejette avec l'erreur d'origine (All) si le repli échoue aussi (Sessions 404)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByView({
        All: { ok: false, status: 404 },
        Sessions: { ok: false, status: 404 },
        Speakers: { ok: true, body: [] },
      }),
    );

    // message le plus parlant : celui de la vue All
    await expect(fetchSessionizeEvent("abc123")).rejects.toThrow(/abc123.*All.*404/);
  });
});
