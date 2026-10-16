// @vitest-environment node
/**
 * Tests de CONTRAT SQL : le vrai schéma (db/schema.sql) chargé dans un Postgres
 * en mémoire (PGlite), et les vraies requêtes des libs exécutées dessus. Les
 * autres tests mockent `pool` et vérifient des sous-chaînes SQL ; ici on
 * vérifie le COMPORTEMENT réel (CTE atomique, préservation des éditions,
 * consentement…), ce qu'aucun `toContain` ne peut garantir.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// `pool` est remplacé par un adaptateur PGlite (mappe affectedRows → rowCount,
// la seule différence d'API avec node-pg utilisée par les libs).
let pg: PGlite;
vi.mock("@/lib/db", () => ({
  pool: {
    query: async (text: string, params?: unknown[]) => {
      const r = await pg.query(text, params as never[]);
      return { rows: r.rows, rowCount: r.affectedRows ?? 0 };
    },
  },
}));

import {
  upsertSuggestion,
  refreshImportedTalk,
  acceptSuggestion,
  getPendingSuggestions,
} from "@/lib/cfp-suggestions";
import { upsertProfile, getProfileByUserId } from "@/lib/profiles";
import { getPublicTalkTextByProfile } from "@/lib/talks";

const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");

/** Crée un compte + profil et renvoie l'id de profil. */
async function seedProfile(email: string, mode = "suggestions"): Promise<number> {
  const u = await pg.query<{ id: number }>(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    ["Test", email],
  );
  const p = await pg.query<{ id: number }>(
    `INSERT INTO speaker_profiles ("userId", cfp_sync_mode) VALUES ($1, $2) RETURNING id`,
    [u.rows[0].id, mode],
  );
  return p.rows[0].id;
}

/** Un événement moissonnable de la référence (migration 027) : id d'ÉDITION. */
async function seedEvent(): Promise<number> {
  const c = await pg.query<{ id: number }>(
    `INSERT INTO conferences (slug, nom) VALUES ('devfest', 'DevFest')
     ON CONFLICT (slug) DO UPDATE SET nom = EXCLUDED.nom RETURNING id`,
  );
  const e = await pg.query<{ id: number }>(
    `INSERT INTO conference_editions (conference_id, source, endpoint, actif)
     VALUES ($1, 'sessionize', 'abc', TRUE) RETURNING id`,
    [c.rows[0].id],
  );
  return e.rows[0].id;
}

const infos = {
  titre: "Beyond Agile",
  description: "desc",
  date: "2026-11-19",
  conference: "DevFest",
  ville: "Toulouse",
  pays: "France",
  lienConf: "https://devfest.fr",
};

// Une seule instance + schéma (le boot wasm coûte cher) ; on vide les données
// entre chaque test pour l'isolation, sans re-payer le démarrage.
// Boot PGlite (wasm) : au-delà des 10 s de `hookTimeout` par défaut dès que la
// suite sature les workers. Sans cette ligne, ce fichier tombe par
// INTERMITTENCE — un rouge qui n'accuse rien et qu'on relance jusqu'au vert,
// exactement ce que `docs/principes-tests.md` § 3 range dans « le silence
// ressemble au succès ». Les autres fichiers PGlite la posent déjà.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(schema);
});
beforeEach(async () => {
  await pg.exec(
    `TRUNCATE talk_occurrences, speaker_talks, talk_suggestions, conference_editions, conferences, cfp_events, speaker_profiles, users RESTART IDENTITY CASCADE`,
  );
});

describe("acceptSuggestion (CTE atomique)", () => {
  it("crée l'identité (source 'manuel') + l'occurrence (registre, source + external_id) et marque la suggestion acceptée, en une fois", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await upsertSuggestion({ profileId, eventId, externalId: "s1", ...infos });

    const sugg = await getPendingSuggestions(profileId);
    const ok = await acceptSuggestion(sugg[0].id, profileId);
    expect(ok).toBe(true);

    // L'IDENTITÉ (speaker_talks) : titre + description, source 'manuel' — la
    // provenance moisson vit sur l'occurrence, plus sur l'identité.
    const talks = await pg.query(`SELECT titre, description, source FROM speaker_talks WHERE speaker_profile_id = $1`, [profileId]);
    expect(talks.rows).toEqual([
      { titre: "Beyond Agile", description: "desc", source: "manuel" },
    ]);
    // L'OCCURRENCE (talk_occurrences) : edition_id = l'événement de la
    // suggestion, conference_id DÉDUIT de l'édition, provenance moisson.
    const edition = await pg.query<{ conference_id: number }>(
      `SELECT conference_id FROM conference_editions WHERE id = $1`,
      [eventId],
    );
    const occ = await pg.query(
      `SELECT edition_id, conference_id, conference, source, external_id
         FROM talk_occurrences WHERE speaker_profile_id = $1`,
      [profileId],
    );
    expect(occ.rows).toEqual([
      {
        edition_id: eventId,
        conference_id: edition.rows[0].conference_id,
        conference: "DevFest",
        source: "sessionize",
        external_id: "s1",
      },
    ]);
    const s = await pg.query(`SELECT statut FROM talk_suggestions WHERE id = $1`, [sugg[0].id]);
    expect(s.rows[0]).toEqual({ statut: "acceptee" });
  });

  it("idempotent : ré-accepter ne crée ni doublon de talk ni 2e occurrence", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await upsertSuggestion({ profileId, eventId, externalId: "s1", ...infos });
    const [sugg] = await getPendingSuggestions(profileId);
    expect(await acceptSuggestion(sugg.id, profileId)).toBe(true);
    // 2e appel : la suggestion n'est plus 'proposee' → false, aucun 2e talk.
    expect(await acceptSuggestion(sugg.id, profileId)).toBe(false);
    const n = await pg.query(`SELECT count(*)::int AS c FROM speaker_talks WHERE speaker_profile_id = $1`, [profileId]);
    expect(n.rows[0]).toEqual({ c: 1 });
    // L'idempotence du re-sync tient sur l'index unique (profil, source,
    // external_id) de talk_occurrences : une seule occurrence.
    const o = await pg.query(`SELECT count(*)::int AS c FROM talk_occurrences WHERE speaker_profile_id = $1`, [profileId]);
    expect(o.rows[0]).toEqual({ c: 1 });
  });

  it("ownership : une autre speakeuse ne peut pas accepter la suggestion", async () => {
    const p1 = await seedProfile("a@b.fr");
    const p2 = await seedProfile("c@d.fr");
    const eventId = await seedEvent();
    await upsertSuggestion({ profileId: p1, eventId, externalId: "s1", ...infos });
    const [sugg] = await getPendingSuggestions(p1);
    expect(await acceptSuggestion(sugg.id, p2)).toBe(false);
    const n = await pg.query(`SELECT count(*)::int AS c FROM speaker_talks`);
    expect(n.rows[0]).toEqual({ c: 0 });
    const o = await pg.query(`SELECT count(*)::int AS c FROM talk_occurrences`);
    expect(o.rows[0]).toEqual({ c: 0 });
  });
});

describe("refreshImportedTalk (préserve les éditions, jamais de NULL)", () => {
  async function importAndAccept(profileId: number, eventId: number) {
    await upsertSuggestion({ profileId, eventId, externalId: "s1", ...infos });
    const [sugg] = await getPendingSuggestions(profileId);
    await acceptSuggestion(sugg.id, profileId);
  }

  it("rafraîchit un champ resté au niveau du snapshot", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await importAndAccept(profileId, eventId);

    const changed = await refreshImportedTalk(profileId, eventId, "sessionize", "s1", {
      ...infos,
      titre: "Beyond Agile (v2)",
    });
    expect(changed).toBe(true);
    const t = await pg.query(`SELECT titre FROM speaker_talks WHERE speaker_profile_id = $1`, [profileId]);
    expect(t.rows[0]).toEqual({ titre: "Beyond Agile (v2)" });
  });

  it("NE réécrit PAS un champ édité à la main par la speakeuse", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await importAndAccept(profileId, eventId);
    // Édition manuelle du talk (comme via le formulaire mon-espace).
    await pg.query(`UPDATE speaker_talks SET titre = 'Mon titre corrigé' WHERE speaker_profile_id = $1`, [profileId]);

    // Le cron re-sync avec une nouvelle valeur amont : ne doit PAS écraser.
    await refreshImportedTalk(profileId, eventId, "sessionize", "s1", {
      ...infos,
      titre: "Titre amont différent",
    });
    const t = await pg.query(`SELECT titre FROM speaker_talks WHERE speaker_profile_id = $1`, [profileId]);
    expect(t.rows[0]).toEqual({ titre: "Mon titre corrigé" });
  });

  it("n'écrase jamais avec une valeur NULL", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await importAndAccept(profileId, eventId);
    await refreshImportedTalk(profileId, eventId, "sessionize", "s1", {
      ...infos,
      date: null, // l'amont a perdu la date
    });
    // La date vit sur l'OCCURRENCE : conservée (jamais écrasée par NULL).
    const t = await pg.query(`SELECT date FROM talk_occurrences WHERE speaker_profile_id = $1`, [profileId]);
    expect(t.rows[0]).toEqual({ date: "2026-11-19" }); // conservée
  });
});

describe("getPendingSuggestions (consentement + statut)", () => {
  it("ne renvoie rien si la speakeuse a coupé le moissonnage (cfp_sync_mode = 'aucun')", async () => {
    const profileId = await seedProfile("a@b.fr", "aucun");
    const eventId = await seedEvent();
    await upsertSuggestion({ profileId, eventId, externalId: "s1", ...infos });
    expect(await getPendingSuggestions(profileId)).toEqual([]);
  });

  it("une suggestion refusée n'est plus proposée", async () => {
    const profileId = await seedProfile("a@b.fr");
    const eventId = await seedEvent();
    await upsertSuggestion({ profileId, eventId, externalId: "s1", ...infos });
    await pg.query(`UPDATE talk_suggestions SET statut = 'refusee' WHERE profile_id = $1`, [profileId]);
    expect(await getPendingSuggestions(profileId)).toEqual([]);
  });
});

describe("getPublicTalkTextByProfile (agrégat plein-texte)", () => {
  it("concatène titre + description des talks par profil", async () => {
    const profileId = await seedProfile("a@b.fr");
    await pg.query(
      `INSERT INTO speaker_talks (speaker_profile_id, titre, description) VALUES ($1, 'Kubernetes 101', 'Istio et le mesh'), ($1, 'RAG', NULL)`,
      [profileId],
    );
    const map = await getPublicTalkTextByProfile();
    const txt = map.get(profileId) ?? "";
    expect(txt).toContain("Kubernetes 101");
    expect(txt).toContain("Istio et le mesh");
    expect(txt).toContain("RAG");
  });
});

describe("upsertProfile (round-trip localisation)", () => {
  it("écrit puis relit ville / regions / langues", async () => {
    const email = "loc@b.fr";
    await pg.query(`INSERT INTO users (name, email) VALUES ('L', $1)`, [email]);
    const u = await pg.query<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email]);
    const userId = u.rows[0].id;

    await upsertProfile(userId, {
      slug: null,
      titreProfil: null, poste: null, entreprise: null, bio: null,
      website: null, linkedin: null, instagram: null,
      sessionizeUrl: null, conferenceHallUrl: null,
      secteurs: [], sujets: [], contactEmailOk: false, isWoman: true,
      cfpSyncMode: "suggestions",
      ville: "Toulouse",
      codePostal: "31000",
      codeInsee: "31555",
      regionResidence: "Occitanie",
      regions: ["Occitanie", "Toute la France"],
      langues: ["Français", "Anglais"],
    });

    const p = await getProfileByUserId(userId);
    expect(p?.ville).toBe("Toulouse");
    // Localisation structurée (migration 039) : round-trip des colonnes BAN.
    expect(p?.codePostal).toBe("31000");
    expect(p?.codeInsee).toBe("31555");
    expect(p?.regionResidence).toBe("Occitanie");
    expect(p?.regions).toEqual(["Occitanie", "Toute la France"]);
    expect(p?.langues).toEqual(["Français", "Anglais"]);
  });
});
