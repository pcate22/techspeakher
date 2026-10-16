// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * VRAIS tests d'intégration BDD du moissonneur CFP : on exécute le SQL réel
 * (upsert conditionnel, CTE atomique d'acceptation, rafraîchissement qui
 * respecte les éditions manuelles) contre un vrai Postgres (PGlite), en
 * chargeant `db/schema.sql`. Pas de mock du pool : c'est ce niveau qui attrape
 * ce que le pool mocké laisse passer (contraintes UNIQUE, index partiel
 * `WHERE external_id IS NOT NULL`, sémantique du ON CONFLICT).
 *
 * PGlite et non pg-mem : ce module utilise des constructions que pg-mem ne
 * restitue pas fidèlement (CTE `WITH ... INSERT`, `IS NOT DISTINCT FROM`, index
 * unique PARTIEL). PGlite est un moteur Postgres réel, comme dans
 * db-schema-drift.test.ts.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      // node-postgres expose `rowCount` ; PGlite expose `affectedRows`. Les
      // fonctions de cfp-suggestions s'appuient sur rowCount (INSERT/UPDATE),
      // on le reconstitue pour rester fidèle au vrai driver.
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  upsertSuggestion,
  getPendingSuggestions,
  acceptSuggestion,
  refuseSuggestion,
  refreshImportedTalk,
  type SuggestionInput,
} from "@/lib/cfp-suggestions";
import { ensureProfileId } from "@/lib/profiles";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);
beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_suggestions, talk_occurrences, speaker_talks, conference_editions, conferences, cfp_events, speaker_profiles, users RESTART IDENTITY CASCADE",
  );
  vi.clearAllMocks();
});

async function newUser(email: string): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES('Clara', $1) RETURNING id",
    [email],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Un événement moissonnable de la référence (conference + edition, migration
 * 027), prérequis de toute suggestion. Renvoie l'id d'ÉDITION (= event_id).
 */
async function newEvent(source = "sessionize", endpoint = "42"): Promise<number> {
  const conf = await h.pool.query(
    `INSERT INTO conferences(slug, nom, ville, pays)
     VALUES($1, 'DevFest', 'Toulouse', 'France')
     ON CONFLICT (slug) DO UPDATE SET nom = EXCLUDED.nom
     RETURNING id`,
    [`devfest-${endpoint}`],
  );
  const { rows } = await h.pool.query(
    `INSERT INTO conference_editions(conference_id, source, endpoint, url, ville, pays, actif)
     VALUES($1, $2, $3, 'https://devfest.example', 'Toulouse', 'France', TRUE)
     RETURNING id`,
    [(conf.rows[0] as { id: number }).id, source, endpoint],
  );
  return (rows[0] as { id: number }).id;
}

/** Modifie le mode de consentement au moissonnage d'un profil. */
async function setSyncMode(profileId: number, mode: string): Promise<void> {
  await h.pool.query(
    "UPDATE speaker_profiles SET cfp_sync_mode = $2 WHERE id = $1",
    [profileId, mode],
  );
}

async function readSuggestion(id: number) {
  const { rows } = await h.pool.query(
    "SELECT statut, titre, ville FROM talk_suggestions WHERE id = $1",
    [id],
  );
  return rows[0] as { statut: string; titre: string; ville: string | null } | undefined;
}

/** Base d'une suggestion, surchargeable champ par champ. */
function suggestion(over: Partial<SuggestionInput>): SuggestionInput {
  return {
    profileId: 0,
    eventId: 0,
    externalId: "ext-1",
    titre: "Mon talk",
    description: "Un retour d'expérience.",
    date: "2026-11-19",
    conference: "DevFest",
    ville: "Toulouse",
    pays: "France",
    lienConf: "https://devfest.example/talk",
    ...over,
  };
}

describe("upsertSuggestion", () => {
  it("crée une suggestion (retourne true) puis la relit en base", async () => {
    const profileId = await ensureProfileId(await newUser("a@ex.fr"));
    const eventId = await newEvent();

    const created = await upsertSuggestion(suggestion({ profileId, eventId }));
    expect(created).toBe(true);

    const { rows } = await h.pool.query(
      "SELECT titre, statut FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ titre: "Mon talk", statut: "proposee" });
  });

  it("met à jour une suggestion encore « proposee » sur ré-upsert", async () => {
    const profileId = await ensureProfileId(await newUser("b@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId, eventId }));

    const updated = await upsertSuggestion(
      suggestion({ profileId, eventId, titre: "Titre corrigé", ville: "Bordeaux" }),
    );
    expect(updated).toBe(true);

    const { rows } = await h.pool.query(
      "SELECT titre, ville FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ titre: "Titre corrigé", ville: "Bordeaux" });
  });

  it("ne réécrit PAS une suggestion « refusee » (no-op → false)", async () => {
    const profileId = await ensureProfileId(await newUser("c@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId, eventId }));
    await h.pool.query(
      "UPDATE talk_suggestions SET statut = 'refusee' WHERE profile_id = $1",
      [profileId],
    );

    const again = await upsertSuggestion(
      suggestion({ profileId, eventId, titre: "Re-proposé ?" }),
    );
    expect(again).toBe(false);

    const { rows } = await h.pool.query(
      "SELECT titre, statut FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    expect(rows[0]).toMatchObject({ titre: "Mon talk", statut: "refusee" });
  });
});

describe("getPendingSuggestions", () => {
  it("ne renvoie que les « proposee » du bon profil", async () => {
    const mien = await ensureProfileId(await newUser("moi@ex.fr"));
    const autre = await ensureProfileId(await newUser("autre@ex.fr"));
    const eventId = await newEvent();

    await upsertSuggestion(suggestion({ profileId: mien, eventId, externalId: "m-1" }));
    await upsertSuggestion(suggestion({ profileId: mien, eventId, externalId: "m-2" }));
    await upsertSuggestion(suggestion({ profileId: autre, eventId, externalId: "a-1" }));
    // Une suggestion refusée du bon profil ne doit pas remonter.
    await upsertSuggestion(suggestion({ profileId: mien, eventId, externalId: "m-3" }));
    await h.pool.query(
      "UPDATE talk_suggestions SET statut = 'refusee' WHERE external_id = 'm-3'",
    );

    const pending = await getPendingSuggestions(mien);
    expect(pending).toHaveLength(2);
    expect(pending.map((s) => s.externalId).sort()).toEqual(["m-1", "m-2"]);
  });

  it("respecte le consentement : rien si cfp_sync_mode = 'aucun'", async () => {
    const profileId = await ensureProfileId(await newUser("optout@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId, eventId }));

    expect(await getPendingSuggestions(profileId)).toHaveLength(1);

    await setSyncMode(profileId, "aucun");
    expect(await getPendingSuggestions(profileId)).toHaveLength(0);
  });

  it("borne l'affichage à 20 suggestions", async () => {
    const profileId = await ensureProfileId(await newUser("flood@ex.fr"));
    const eventId = await newEvent();
    for (let i = 0; i < 25; i++) {
      await upsertSuggestion(
        suggestion({ profileId, eventId, externalId: `ext-${i}` }),
      );
    }
    expect(await getPendingSuggestions(profileId)).toHaveLength(20);
  });
});

describe("acceptSuggestion (CTE atomique)", () => {
  /** L'IDENTITÉ des talks du profil (speaker_talks). */
  async function talksOf(profileId: number) {
    const { rows } = await h.pool.query(
      `SELECT titre, description, source
         FROM speaker_talks WHERE speaker_profile_id = $1`,
      [profileId],
    );
    return rows as { titre: string; description: string | null; source: string }[];
  }

  /** Les OCCURRENCES du profil (talk_occurrences) : provenance moisson + registre. */
  async function occurrencesOf(profileId: number) {
    const { rows } = await h.pool.query(
      `SELECT conference_id, edition_id, conference, ville, source, external_id
         FROM talk_occurrences WHERE speaker_profile_id = $1`,
      [profileId],
    );
    return rows as {
      conference_id: number | null;
      edition_id: number | null;
      conference: string | null;
      ville: string | null;
      source: string;
      external_id: string | null;
    }[];
  }

  it("passe la suggestion à « acceptee », crée l'IDENTITÉ (source 'manuel') ET l'OCCURRENCE (registre + provenance)", async () => {
    const profileId = await ensureProfileId(await newUser("acc@ex.fr"));
    const eventId = await newEvent("sessionize", "77");
    await upsertSuggestion(suggestion({ profileId, eventId, externalId: "s-9" }));
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    const suggestionId = (rows[0] as { id: number }).id;

    const ok = await acceptSuggestion(suggestionId, profileId);
    expect(ok).toBe(true);

    expect((await readSuggestion(suggestionId))!.statut).toBe("acceptee");
    // L'identité : titre + description de la suggestion, source 'manuel' (la
    // provenance moisson vit sur l'occurrence, pas sur l'identité).
    const talks = await talksOf(profileId);
    expect(talks).toHaveLength(1);
    expect(talks[0]).toMatchObject({
      titre: "Mon talk",
      description: "Un retour d'expérience.",
      source: "manuel",
    });
    // L'occurrence : rattachée au registre (edition_id = événement de la
    // suggestion, conference_id DÉDUIT de l'édition) et porteuse de la
    // provenance moisson (source + external_id → idempotence du re-sync).
    const { rows: editionRows } = await h.pool.query(
      "SELECT conference_id FROM conference_editions WHERE id = $1",
      [eventId],
    );
    const occurrences = await occurrencesOf(profileId);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      edition_id: eventId,
      conference_id: (editionRows[0] as { conference_id: number }).conference_id,
      conference: "DevFest",
      ville: "Toulouse",
      source: "sessionize",
      external_id: "s-9",
    });
  });

  it("ownership : un mauvais profileId n'accepte rien et ne crée ni talk ni occurrence", async () => {
    const mien = await ensureProfileId(await newUser("prop@ex.fr"));
    const autre = await ensureProfileId(await newUser("voleuse@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId: mien, eventId }));
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [mien],
    );
    const suggestionId = (rows[0] as { id: number }).id;

    const ok = await acceptSuggestion(suggestionId, autre);
    expect(ok).toBe(false);
    expect((await readSuggestion(suggestionId))!.statut).toBe("proposee");
    expect(await talksOf(mien)).toHaveLength(0);
    expect(await talksOf(autre)).toHaveLength(0);
    expect(await occurrencesOf(mien)).toHaveLength(0);
  });

  it("idempotence : une 2e acceptation ne crée ni doublon de talk ni 2e occurrence", async () => {
    const profileId = await ensureProfileId(await newUser("idem@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId, eventId, externalId: "dup-1" }));
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    const suggestionId = (rows[0] as { id: number }).id;

    expect(await acceptSuggestion(suggestionId, profileId)).toBe(true);
    // La suggestion n'est plus « proposee » : la 2e acceptation est un no-op.
    expect(await acceptSuggestion(suggestionId, profileId)).toBe(false);
    expect(await talksOf(profileId)).toHaveLength(1);
    expect(await occurrencesOf(profileId)).toHaveLength(1);
  });

  it("idempotence du re-sync : même (source, external_id) via un autre événement → jamais de 2e occurrence (index unique)", async () => {
    // L'index unique partiel (speaker_profile_id, source, external_id) a
    // DÉMÉNAGÉ sur talk_occurrences : le rejouage d'une moisson (même talk
    // repéré via une autre édition) ne peut pas dupliquer l'occurrence.
    const profileId = await ensureProfileId(await newUser("resync@ex.fr"));
    const event1 = await newEvent("sessionize", "ep-a");
    const event2 = await newEvent("sessionize", "ep-b");

    await upsertSuggestion(suggestion({ profileId, eventId: event1, externalId: "dup-2" }));
    const { rows: r1 } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1 AND event_id = $2",
      [profileId, event1],
    );
    expect(await acceptSuggestion((r1[0] as { id: number }).id, profileId)).toBe(true);

    await upsertSuggestion(suggestion({ profileId, eventId: event2, externalId: "dup-2" }));
    const { rows: r2 } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1 AND event_id = $2",
      [profileId, event2],
    );
    await acceptSuggestion((r2[0] as { id: number }).id, profileId);

    expect(await occurrencesOf(profileId)).toHaveLength(1);
    // Et surtout : PAS d'identité orpheline (un 2e speaker_talks à zéro
    // occurrence serait un talk fantôme sur la liste de la speakeuse).
    const { rows: talks } = await h.pool.query(
      "SELECT id FROM speaker_talks WHERE speaker_profile_id = $1",
      [profileId],
    );
    expect(talks).toHaveLength(1);
  });

  it("renvoie false si la suggestion n'est pas « proposee »", async () => {
    const profileId = await ensureProfileId(await newUser("refu@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId, eventId }));
    await h.pool.query(
      "UPDATE talk_suggestions SET statut = 'refusee' WHERE profile_id = $1",
      [profileId],
    );
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    const suggestionId = (rows[0] as { id: number }).id;

    expect(await acceptSuggestion(suggestionId, profileId)).toBe(false);
    expect(await talksOf(profileId)).toHaveLength(0);
  });
});

describe("refuseSuggestion", () => {
  it("passe la suggestion à « refusee », scopé au profil", async () => {
    const mien = await ensureProfileId(await newUser("r-moi@ex.fr"));
    const autre = await ensureProfileId(await newUser("r-autre@ex.fr"));
    const eventId = await newEvent();
    await upsertSuggestion(suggestion({ profileId: mien, eventId }));
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [mien],
    );
    const suggestionId = (rows[0] as { id: number }).id;

    // Un autre profil ne peut pas refuser ma suggestion.
    await refuseSuggestion(suggestionId, autre);
    expect((await readSuggestion(suggestionId))!.statut).toBe("proposee");

    // Le propriétaire, lui, la refuse.
    await refuseSuggestion(suggestionId, mien);
    expect((await readSuggestion(suggestionId))!.statut).toBe("refusee");
  });
});

describe("refreshImportedTalk", () => {
  /**
   * Prépare un talk importé : crée une suggestion, l'accepte (ce qui crée le
   * talk et fige le snapshot dans la suggestion acceptée), et renvoie les ids.
   */
  async function importTalk(source: string, externalId: string) {
    const profileId = await ensureProfileId(await newUser(`${externalId}@ex.fr`));
    const eventId = await newEvent(source, `ep-${externalId}`);
    await upsertSuggestion(suggestion({ profileId, eventId, externalId }));
    const { rows } = await h.pool.query(
      "SELECT id FROM talk_suggestions WHERE profile_id = $1",
      [profileId],
    );
    const suggestionId = (rows[0] as { id: number }).id;
    await acceptSuggestion(suggestionId, profileId);
    return { profileId, eventId };
  }

  /** L'IDENTITÉ du talk (titre + description sur speaker_talks). */
  async function readIdentity(profileId: number) {
    const { rows } = await h.pool.query(
      `SELECT titre, description FROM speaker_talks WHERE speaker_profile_id = $1`,
      [profileId],
    );
    return rows[0] as { titre: string; description: string | null };
  }

  /** L'OCCURRENCE importée (date / lieu / lien sur talk_occurrences). */
  async function readOccurrence(profileId: number) {
    const { rows } = await h.pool.query(
      `SELECT conference, ville, pays, date, lien_conf
         FROM talk_occurrences WHERE speaker_profile_id = $1`,
      [profileId],
    );
    return rows[0] as {
      conference: string | null;
      ville: string | null;
      pays: string | null;
      date: string | null;
      lien_conf: string | null;
    };
  }

  it("rafraîchit les champs non touchés (titre sur l'identité, lieu sur l'occurrence) mais préserve une édition de la speakeuse", async () => {
    const { profileId, eventId } = await importTalk("sessionize", "rt-1");

    // La speakeuse édite « à la main » la ville de l'occurrence.
    await h.pool.query(
      "UPDATE talk_occurrences SET ville = 'Nantes' WHERE speaker_profile_id = $1",
      [profileId],
    );

    // Le moissonneur repasse avec de nouvelles valeurs (titre, ville ET conference changés).
    const ok = await refreshImportedTalk(profileId, eventId, "sessionize", "rt-1", {
      titre: "Mon talk (édition 2026)",
      date: "2026-11-19",
      conference: "DevFest Nantes",
      ville: "Lyon",
      pays: "France",
      lienConf: "https://devfest.example/talk",
    });
    expect(ok).toBe(true);

    // Le titre, resté au niveau du snapshot, EST rafraîchi sur l'IDENTITÉ.
    expect((await readIdentity(profileId)).titre).toBe("Mon talk (édition 2026)");
    const occurrence = await readOccurrence(profileId);
    // La ville éditée à la main N'est PAS écrasée.
    expect(occurrence.ville).toBe("Nantes");
    // La conference, restée à la valeur synchronisée, EST rafraîchie sur l'OCCURRENCE.
    expect(occurrence.conference).toBe("DevFest Nantes");
  });

  it("ne touche jamais la description", async () => {
    const { profileId, eventId } = await importTalk("sessionize", "rt-2");
    const before = (await readIdentity(profileId)).description;

    await refreshImportedTalk(profileId, eventId, "sessionize", "rt-2", {
      titre: "Mon talk",
      date: "2026-11-19",
      conference: "Autre nom",
      ville: "Toulouse",
      pays: "France",
      lienConf: "https://devfest.example/talk",
    });

    expect((await readIdentity(profileId)).description).toBe(before);
  });

  it("ne réécrit pas un champ si la nouvelle valeur est NULL", async () => {
    const { profileId, eventId } = await importTalk("sessionize", "rt-3");

    await refreshImportedTalk(profileId, eventId, "sessionize", "rt-3", {
      titre: "Mon talk",
      date: null,
      conference: null,
      ville: null,
      pays: null,
      lienConf: null,
    });

    // Les valeurs synchronisées d'origine sont conservées, pas effacées.
    expect((await readIdentity(profileId)).titre).toBe("Mon talk");
    const occurrence = await readOccurrence(profileId);
    expect(occurrence.conference).toBe("DevFest");
    expect(occurrence.ville).toBe("Toulouse");
    expect(occurrence.date).toBe("2026-11-19");
  });

  it("renvoie false si aucun talk importé ne correspond", async () => {
    const profileId = await ensureProfileId(await newUser("nomatch@ex.fr"));
    const eventId = await newEvent();
    const ok = await refreshImportedTalk(profileId, eventId, "sessionize", "inconnu", {
      titre: "X",
      date: null,
      conference: null,
      ville: null,
      pays: null,
      lienConf: null,
    });
    expect(ok).toBe(false);
  });
});
