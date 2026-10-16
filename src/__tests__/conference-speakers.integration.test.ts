// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD de getPublicSpeakersByConferenceEdition : la liste des
 * speakeuses d'une conférence, dérivée du répertoire (talk dont une OCCURRENCE
 * est rattachée à l'édition, migration 044) et de l'annuaire (fiche publiée).
 * Vrai Postgres (PGlite) + db/schema.sql. Chaque cas négatif insère une ligne
 * qui NE doit PAS remonter (fiche non publiée, occurrence sur une autre
 * édition, proposition Tremplin), pour que le test attrape un WHERE faux.
 */
const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});
vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { getPublicSpeakersByConferenceEdition } from "@/lib/conference-speakers";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_occurrences, speaker_talks, speaker_profiles, conference_editions, conferences, users RESTART IDENTITY CASCADE",
  );
});

async function newUser(name: string | null): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [name, name ? `${name.toLowerCase()}@ex.fr` : null],
  );
  return (rows[0] as { id: number }).id;
}

async function newProfile(
  userId: number,
  over: { status?: string; poste?: string | null } = {},
): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_profiles ("userId", status, poste) VALUES ($1, $2, $3) RETURNING id`,
    [userId, over.status ?? "publie", over.poste ?? null],
  );
  return (rows[0] as { id: number }).id;
}

/** Une édition de la référence (crée la conférence au passage). Renvoie son id. */
async function newEdition(annee: number): Promise<number> {
  await h.pool.query(
    `INSERT INTO conferences (slug, nom, type, ville, pays)
     VALUES ('devfest-toulouse', 'DevFest Toulouse', 'conference', 'Toulouse', 'France')
     ON CONFLICT (slug) DO NOTHING`,
  );
  const { rows } = await h.pool.query(
    `INSERT INTO conference_editions (conference_id, annee)
     SELECT id, $1 FROM conferences WHERE slug = 'devfest-toulouse' RETURNING id`,
    [annee],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Un talk (identité) + son occurrence rattachée à l'édition (modèle 044).
 * `sansOccurrence` couvre le sujet proposé (talk jamais donné).
 */
async function newTalk(
  profileId: number,
  over: {
    titre?: string;
    type?: string;
    editionId?: number | null;
    source?: string;
    sansOccurrence?: boolean;
  } = {},
): Promise<void> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [profileId, over.titre ?? "Mon talk", over.type ?? "Conférence", over.source ?? "manuel"],
  );
  if (over.sansOccurrence) return;
  await h.pool.query(
    `INSERT INTO talk_occurrences (talk_id, speaker_profile_id, edition_id)
     VALUES ($1, $2, $3)`,
    [(rows[0] as { id: number }).id, profileId, over.editionId ?? null],
  );
}

describe("getPublicSpeakersByConferenceEdition", () => {
  it("remonte les speakeuses PUBLIÉES ayant un talk sur l'édition, triées par nom", async () => {
    const edition = await newEdition(2026);
    const zoe = await newProfile(await newUser("Zoe"), { status: "publie", poste: "Dev" });
    await newTalk(zoe, { titre: "Talk de Zoe", editionId: edition });
    const anna = await newProfile(await newUser("Anna"), { status: "publie" });
    await newTalk(anna, { titre: "Talk d'Anna", editionId: edition });

    const list = await getPublicSpeakersByConferenceEdition(edition);

    expect(list.map((c) => c.speaker.name)).toEqual(["Anna", "Zoe"]); // ORDER BY name
    expect(list[1].speaker.poste).toBe("Dev");
    expect(list[0].talks).toEqual([{ titre: "Talk d'Anna", type: "Conférence" }]);
  });

  it("exclut les fiches non publiées, les talks d'une autre édition et les propositions Tremplin", async () => {
    const edition = await newEdition(2026);
    const autreEdition = await newEdition(2025);

    // Cas passant.
    const ok = await newProfile(await newUser("Publiee"), { status: "publie" });
    await newTalk(ok, { editionId: edition });

    // Négatif : fiche en brouillon, même avec un talk sur l'édition.
    const brouillon = await newProfile(await newUser("Brouillonne"), { status: "brouillon" });
    await newTalk(brouillon, { editionId: edition });
    // Négatif : fiche masquée.
    const masquee = await newProfile(await newUser("Masquee"), { status: "masque" });
    await newTalk(masquee, { editionId: edition });
    // Négatif : publiée mais talk sur une AUTRE édition.
    const ailleurs = await newProfile(await newUser("Ailleurs"), { status: "publie" });
    await newTalk(ailleurs, { editionId: autreEdition });
    // Négatif : publiée mais occurrence sans rattachement (edition_id NULL).
    const libre = await newProfile(await newUser("Libre"), { status: "publie" });
    await newTalk(libre, { editionId: null });
    // Négatif : publiée mais talk SANS occurrence (sujet proposé, jamais donné).
    const sujet = await newProfile(await newUser("Sujet"), { status: "publie" });
    await newTalk(sujet, { sansOccurrence: true });
    // Négatif : publiée mais proposition Tremplin (source='tremplin') non confirmée.
    const pitch = await newProfile(await newUser("Pitch"), { status: "publie" });
    await newTalk(pitch, { editionId: edition, source: "tremplin" });

    const list = await getPublicSpeakersByConferenceEdition(edition);

    expect(list.map((c) => c.speaker.name)).toEqual(["Publiee"]);
  });

  it("garde de consentement : un talk manuel CONFIRMÉ sur une fiche EN BROUILLON ne remonte jamais", async () => {
    // Depuis la migration 044, un talk peut être posé en base (manuel + rattaché
    // à l'édition) AVANT que la fiche soit publiée (ex. Sandrine, dont le talk CFP
    // attend la publication de sa fiche). La garde d'écriture status='publie' a été
    // retirée des backfills ; le SEUL gardien du consentement est désormais ici,
    // à la lecture. Ce test verrouille l'invariant « fiche brouillon = invisible ».
    const edition = await newEdition(2026);
    const enAttente = await newProfile(await newUser("EnAttente"), { status: "brouillon" });
    await newTalk(enAttente, {
      titre: "Talk confirmé au CFP",
      type: "Conférence",
      editionId: edition,
      source: "manuel",
    });

    expect(await getPublicSpeakersByConferenceEdition(edition)).toEqual([]);
  });

  it("regroupe les talks d'une même speakeuse en une seule entrée", async () => {
    const edition = await newEdition(2026);
    const p = await newProfile(await newUser("Multi"), { status: "publie" });
    await newTalk(p, { titre: "Conférence", type: "Conférence", editionId: edition });
    await newTalk(p, { titre: "Quickie", type: "Quickie", editionId: edition });

    const list = await getPublicSpeakersByConferenceEdition(edition);

    expect(list).toHaveLength(1);
    expect(list[0].talks.map((t) => t.titre)).toEqual(["Conférence", "Quickie"]);
  });

  it("ne sérialise jamais l'e-mail ni le statut (DTO public)", async () => {
    const edition = await newEdition(2026);
    const p = await newProfile(await newUser("Contact"), { status: "publie" });
    await newTalk(p, { editionId: edition });

    const [{ speaker }] = await getPublicSpeakersByConferenceEdition(edition);
    expect(speaker).not.toHaveProperty("email");
    expect(speaker).not.toHaveProperty("status");
    expect(speaker).not.toHaveProperty("userId");
  });

  it("renvoie [] pour une édition sans talk", async () => {
    const edition = await newEdition(2026);
    expect(await getPublicSpeakersByConferenceEdition(edition)).toEqual([]);
  });
});
