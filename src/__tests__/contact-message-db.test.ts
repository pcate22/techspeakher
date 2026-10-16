// @vitest-environment node
/**
 * Contrat SQL du contact modéré : le vrai schéma (db/schema.sql) dans un
 * Postgres en mémoire (PGlite) + les vraies requêtes des libs. Vérifie le
 * comportement réel (file, transitions de statut, digest) que des `toContain`
 * ne peuvent pas garantir.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

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
  createContactMessage,
  getPendingContactMessages,
  getTransmittedMessagesForProfile,
  setContactMessageStatus,
  countPendingContactMessages,
  getMessagesToNotify,
  markMessagesNotified,
  countRecentMessagesFromEmail,
  getContactMessageById,
  getRecentModeratedMessages,
} from "@/lib/contact-message";

const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");

async function seedProfile(name: string, email: string): Promise<number> {
  const u = await pg.query<{ id: number }>(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    [name, email],
  );
  const p = await pg.query<{ id: number }>(
    `INSERT INTO speaker_profiles ("userId", status, contact_email_ok)
     VALUES ($1, 'publie', true) RETURNING id`,
    [u.rows[0].id],
  );
  return p.rows[0].id;
}

async function seedOrga(): Promise<number> {
  const u = await pg.query<{ id: number }>(
    `INSERT INTO users (name, email, is_orga) VALUES ('Orga', 'orga@tsh.fr', true) RETURNING id`,
  );
  return u.rows[0].id;
}

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
    `TRUNCATE contact_messages, speaker_profiles, users RESTART IDENTITY CASCADE`,
  );
});

describe("contact_messages — contrat SQL", () => {
  it("crée un message en attente, visible dans la file orga", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const id = await createContactMessage({
      profileId,
      motif: "conference",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "Tu interviendrais au DevFest ?",
    });
    expect(id).toBeGreaterThan(0);

    const pending = await getPendingContactMessages();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      motif: "conference",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      status: "en_attente",
      speakeuseName: "Marie",
    });
    expect(await countPendingContactMessages()).toBe(1);
  });

  it("transmet un message : quitte la file, apparaît dans « Mes messages »", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const orgaId = await seedOrga();
    const id = await createContactMessage({
      profileId,
      motif: "jury",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "Jury hackathon ?",
    });

    const n = await setContactMessageStatus(id, "transmis", orgaId);
    expect(n).toBe(1);

    expect(await getPendingContactMessages()).toHaveLength(0);
    const mine = await getTransmittedMessagesForProfile(profileId);
    expect(mine).toHaveLength(1);
    expect(mine[0].moderatedBy).toBe(orgaId);
    expect(mine[0].moderatedAt).not.toBeNull();
  });

  it("rejette un message : ni dans la file, ni chez la speakeuse, mais conservé", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const orgaId = await seedOrga();
    const id = await createContactMessage({
      profileId,
      motif: "autre",
      senderName: "Troll",
      senderEmail: "troll@x.fr",
      body: "message déplacé",
    });

    await setContactMessageStatus(id, "rejete", orgaId);

    expect(await getPendingContactMessages()).toHaveLength(0);
    expect(await getTransmittedMessagesForProfile(profileId)).toHaveLength(0);
    // Conservé (audit / récidive) : la ligne existe toujours.
    const { rows } = await pg.query(
      `SELECT status FROM contact_messages WHERE id = $1`,
      [id],
    );
    expect((rows[0] as { status: string }).status).toBe("rejete");
  });

  it("ne re-modère pas un message déjà traité (idempotent)", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const orgaId = await seedOrga();
    const id = await createContactMessage({
      profileId,
      motif: "conference",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "hello",
    });
    expect(await setContactMessageStatus(id, "transmis", orgaId)).toBe(1);
    // Deuxième décision : le message n'est plus 'en_attente' → 0 ligne touchée.
    expect(await setContactMessageStatus(id, "rejete", orgaId)).toBe(0);
  });

  it("digest : ne notifie que les transmis non encore notifiés, puis les marque", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const orgaId = await seedOrga();
    const transmis = await createContactMessage({
      profileId,
      motif: "interview",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "Podcast ?",
    });
    await setContactMessageStatus(transmis, "transmis", orgaId);
    // Un message en attente ne doit PAS être notifié.
    await createContactMessage({
      profileId,
      motif: "autre",
      senderName: "X",
      senderEmail: "x@x.fr",
      body: "en attente",
    });

    const toNotify = await getMessagesToNotify();
    expect(toNotify).toHaveLength(1);
    expect(toNotify[0]).toMatchObject({ email: "marie@tsh.fr", motif: "interview" });

    await markMessagesNotified(toNotify.map((m) => m.id));
    // Une fois notifié, il ne ressort plus.
    expect(await getMessagesToNotify()).toHaveLength(0);
  });

  it("compte les messages récents d'une même adresse (rate-limit durable, insensible à la casse)", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    for (let i = 0; i < 3; i++) {
      await createContactMessage({
        profileId,
        motif: "autre",
        senderName: "Paul",
        senderEmail: "Paul@X.fr",
        body: `msg ${i}`,
      });
    }
    // Casse différente → même expéditeur.
    expect(await countRecentMessagesFromEmail("paul@x.fr", 60)).toBe(3);
    // Une autre adresse n'est pas comptée.
    expect(await countRecentMessagesFromEmail("autre@x.fr", 60)).toBe(0);
  });

  it("récupère un message par id (avec le nom de la destinataire)", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const id = await createContactMessage({
      profileId,
      motif: "conference",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "hello",
    });
    const m = await getContactMessageById(id);
    expect(m).toMatchObject({ id, senderName: "Paul", speakeuseName: "Marie" });
    expect(await getContactMessageById(999999)).toBeNull();
  });

  it("liste l'historique traité (transmis + rejetés), pas les en attente", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    const orgaId = await seedOrga();
    const t = await createContactMessage({
      profileId, motif: "jury", senderName: "A", senderEmail: "a@x.fr", body: "a",
    });
    const r = await createContactMessage({
      profileId, motif: "autre", senderName: "B", senderEmail: "b@x.fr", body: "b",
    });
    await createContactMessage({
      profileId, motif: "interview", senderName: "C", senderEmail: "c@x.fr", body: "c",
    });
    await setContactMessageStatus(t, "transmis", orgaId);
    await setContactMessageStatus(r, "rejete", orgaId);

    const hist = await getRecentModeratedMessages(30);
    expect(hist).toHaveLength(2);
    expect(hist.map((m) => m.status).sort()).toEqual(["rejete", "transmis"]);
  });

  it("la suppression d'une fiche efface ses messages (cascade)", async () => {
    const profileId = await seedProfile("Marie", "marie@tsh.fr");
    await createContactMessage({
      profileId,
      motif: "conference",
      senderName: "Paul",
      senderEmail: "paul@x.fr",
      body: "hello",
    });
    await pg.query(`DELETE FROM speaker_profiles WHERE id = $1`, [profileId]);
    const { rows } = await pg.query(`SELECT COUNT(*)::int AS n FROM contact_messages`);
    expect((rows[0] as { n: number }).n).toBe(0);
  });
});
