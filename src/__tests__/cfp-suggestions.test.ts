import { describe, it, expect, vi, beforeEach } from "vitest";

// Pool Postgres mocké : on vérifie les requêtes SQL + paramètres, sans vraie BDD.
const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...args: unknown[]) => query(...args) } }));

import {
  getActiveCfpEvents,
  getMatchableProfiles,
  getPendingSuggestions,
  upsertSuggestion,
  refreshImportedTalk,
  acceptSuggestion,
  refuseSuggestion,
} from "@/lib/cfp-suggestions";

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("getActiveCfpEvents", () => {
  it("ne lit que les événements actifs", async () => {
    // Ligne « brute » de la référence : le libellé est composé côté TS
    // (buildEditionLibelle), plus de recomposition SQL.
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          conf_nom: "DevFest Toulouse",
          type: "edition",
          edition_nom: null,
          annee: 2026,
          source: "sessionize",
          endpoint: "abc123",
          url: "https://devfesttoulouse.fr",
          ville: "Toulouse",
          pays: "France",
          date_debut: "2026-11-19",
        },
      ],
    });
    const events = await getActiveCfpEvents();
    expect(query.mock.calls[0][0]).toContain("actif");
    expect(events).toEqual([
      {
        id: 1,
        nom: "DevFest Toulouse 2026",
        source: "sessionize",
        endpoint: "abc123",
        url: "https://devfesttoulouse.fr",
        ville: "Toulouse",
        pays: "France",
        dateDebut: "2026-11-19",
      },
    ]);
  });
});

describe("getMatchableProfiles", () => {
  it("exclut les profils qui ont refusé le moissonnage (liste POSITIVE des modes)", async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Marie Curie", linkedin: null, sessionize_url: null }],
    });
    const profils = await getMatchableProfiles();
    // Liste positive, et pas « tout sauf aucun » : un mode illisible vaut
    // refus, sans quoi il ferait moissonner la fiche (migration 073).
    expect(query.mock.calls[0][0]).toContain(
      "p.cfp_sync_mode IN ('suggestions', 'auto')",
    );
    expect(profils).toEqual([
      { id: 1, name: "Marie Curie", linkedin: null, sessionizeUrl: null },
    ]);
  });
});

describe("upsertSuggestion", () => {
  const suggestion = {
    profileId: 4,
    eventId: 1,
    externalId: "sess-1",
    titre: "Beyond Agile",
    description: null,
    date: "2026-11-19",
    conference: "DevFest Toulouse 2026",
    ville: "Toulouse",
    pays: "France",
    lienConf: "https://devfesttoulouse.fr",
  };

  it("insère, et en cas de conflit ne met à jour QUE si la suggestion est encore proposée", async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    const cree = await upsertSuggestion(suggestion);
    expect(cree).toBe(true);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("INSERT INTO talk_suggestions");
    expect(sql).toContain("ON CONFLICT (profile_id, event_id, external_id)");
    // une refusée reste refusée (jamais re-suggérée), une acceptée reste acceptée
    expect(sql).toMatch(/WHERE\s+talk_suggestions\.statut\s*=\s*'proposee'/);
    expect(query.mock.calls[0][1]).toEqual([
      4,
      1,
      "sess-1",
      "Beyond Agile",
      null,
      "2026-11-19",
      "DevFest Toulouse 2026",
      "Toulouse",
      "France",
      "https://devfesttoulouse.fr",
    ]);
  });
});

describe("refreshImportedTalk", () => {
  const infos = {
    titre: "Beyond Agile (v2)",
    date: "2026-11-20",
    conference: "DevFest Toulouse 2026",
    ville: "Toulouse",
    pays: "France",
    lienConf: null,
  };

  it("ne rafraîchit un champ QUE s'il vaut encore le snapshot (éditions préservées) et jamais avec NULL", async () => {
    query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE speaker_talks (titre)
    query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE talk_occurrences
    query.mockResolvedValueOnce({ rowCount: 1 }); // snapshot
    const updated = await refreshImportedTalk(4, 1, "sessionize", "sess-1", infos);
    expect(updated).toBe(true);

    // 1er UPDATE : le TITRE, porté par l'IDENTITÉ (speaker_talks), matché via
    // l'occurrence importée (source + external_id).
    const titreSql = query.mock.calls[0][0] as string;
    expect(titreSql).toContain("UPDATE speaker_talks");
    expect(titreSql).toContain("titre");
    expect(titreSql).toContain("talk_occurrences");
    // gardé par une comparaison au snapshot (suggestion acceptée)…
    expect(titreSql).toContain("IS NOT DISTINCT FROM");
    // …et une nouvelle valeur NULL n'écrase jamais l'existant
    expect(titreSql).toContain("IS NOT NULL");
    // ne touche pas la description (éditable par la speakeuse)
    expect(titreSql).not.toContain("description");
    expect(titreSql).toContain("statut = 'acceptee'");

    // 2e UPDATE : date / conférence / ville / pays / lien, portés par l'OCCURRENCE.
    const occSql = query.mock.calls[1][0] as string;
    expect(occSql).toContain("UPDATE talk_occurrences");
    expect(occSql).toContain("IS NOT DISTINCT FROM");
    expect(occSql).toContain("IS NOT NULL");
    // ne touche NI la description NI les autres liens
    expect(occSql).not.toContain("description");
    expect(occSql).not.toContain("lien_slides");
    expect(occSql).toContain("statut = 'acceptee'");

    // le snapshot est remis au niveau des valeurs synchronisées
    const snapshotSql = query.mock.calls[2][0] as string;
    expect(snapshotSql).toContain("UPDATE talk_suggestions");
    expect(snapshotSql).toContain("'acceptee'");
  });

  it("retourne false (sans toucher au snapshot) si aucun talk importé ne correspond", async () => {
    // Les deux UPDATE (titre puis occurrence) ne matchent rien : rowCount 0.
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(
      await refreshImportedTalk(4, 1, "sessionize", "inconnu", {
        titre: "T",
        date: null,
        conference: null,
        ville: null,
        pays: null,
        lienConf: null,
      }),
    ).toBe(false);
    // Titre + occurrence tentés, mais JAMAIS de réécriture du snapshot.
    expect(query).toHaveBeenCalledTimes(2);
    const sqls = query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes("UPDATE talk_suggestions"))).toBe(false);
  });
});

describe("getPendingSuggestions", () => {
  it("ne retourne que les suggestions proposées du profil", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 9,
          external_id: "sess-1",
          titre: "Beyond Agile",
          description: null,
          date: "2026-11-19",
          conference: "DevFest Toulouse 2026",
          ville: "Toulouse",
          pays: "France",
          lien_conf: null,
        },
      ],
    });
    const sugg = await getPendingSuggestions(4);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("'proposee'");
    // consentement : rien d'affiché si la speakeuse a désactivé le moissonnage
    // (liste positive — un mode illisible vaut refus, migration 073)
    expect(sql).toContain("p.cfp_sync_mode IN ('suggestions', 'auto')");
    // borne d'affichage (anti-inondation)
    expect(sql).toContain("LIMIT 20");
    expect(query.mock.calls[0][1]).toEqual([4]);
    expect(sugg).toEqual([
      {
        id: 9,
        externalId: "sess-1",
        titre: "Beyond Agile",
        description: null,
        date: "2026-11-19",
        conference: "DevFest Toulouse 2026",
        ville: "Toulouse",
        pays: "France",
        lienConf: null,
      },
    ]);
  });
});

describe("acceptSuggestion", () => {
  it("marque acceptée ET crée identité + occurrence en UNE requête atomique (CTE)", async () => {
    query.mockResolvedValueOnce({ rows: [{ accepted: 1 }] });

    const ok = await acceptSuggestion(9, 4);
    expect(ok).toBe(true);
    expect(query).toHaveBeenCalledTimes(1); // atomique : pas de fenêtre incohérente

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("UPDATE talk_suggestions SET statut = 'acceptee'");
    expect(sql).toContain("statut = 'proposee'"); // seule une proposée s'accepte
    // L'IDENTITÉ (speaker_talks) est neutre : source 'manuel', la provenance
    // moisson vit sur l'occurrence.
    expect(sql).toContain("INSERT INTO speaker_talks");
    expect(sql).toContain("'manuel'");
    // L'OCCURRENCE porte le rattachement au registre : conference_id déduit de
    // l'édition (JOIN), source + external_id pour l'idempotence du re-sync.
    expect(sql).toContain("INSERT INTO talk_occurrences");
    expect(sql).toContain("JOIN conference_editions");
    expect(sql).toContain("ON CONFLICT"); // idempotent (index unique partiel)
    expect(sql).toContain("profile_id = $2"); // ownership en SQL
    expect(params).toEqual([9, 4]);
  });

  it("refuse d'accepter la suggestion d'une autre (ownership) : false", async () => {
    query.mockResolvedValueOnce({ rows: [{ accepted: 0 }] });
    const ok = await acceptSuggestion(9, 999);
    expect(ok).toBe(false);
  });
});

describe("refuseSuggestion", () => {
  it("marque refusée (mémorisé : jamais re-suggérée), ownership en SQL", async () => {
    await refuseSuggestion(9, 4);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("'refusee'");
    expect(sql).toContain("profile_id");
    expect(params).toEqual([9, 4]);
  });
});
