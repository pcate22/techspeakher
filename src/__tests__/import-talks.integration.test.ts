// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD de l'import de talks : vrai Postgres (PGlite) + db/schema.sql,
 * la VRAIE action de confirmation de bout en bout. Ce que seul ce niveau voit :
 * les lignes atterrissent (talks, occurrences, propositions), l'invariant de
 * visibilité tient (une conf inconnue reste hors du public), et REJOUER le même
 * fichier n'écrit rien de plus — l'idempotence est ce qui rend l'import
 * réessayable sans peur.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  // Même stub de transaction que conference-propositions.integration.test.ts :
  // une seule connexion PGlite, BEGIN/COMMIT/ROLLBACK directs suffisent.
  const withTransaction = async <T,>(fn: (q: typeof pool) => Promise<T>): Promise<T> => {
    await pool.query("BEGIN");
    try {
      const r = await fn(pool);
      await pool.query("COMMIT");
      return r;
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  };
  return { holder, pool, withTransaction };
});
vi.mock("@/lib/db", () => ({ pool: h.pool, withTransaction: h.withTransaction }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn(() => false) }));

import { requireUserId } from "@/lib/auth-guards";
import { getPublicTalksByProfileId } from "@/lib/talks";
import { fd } from "./test-helpers";
import { confirmImportAction } from "@/app/mon-espace/talks/importer/actions";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

let userId: number;
let profileId: number;

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_occurrences, speaker_talks, speaker_profiles, conference_propositions, conference_editions, conferences, users RESTART IDENTITY CASCADE",
  );
  const { rows: u } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES('Aurélie', 'a@ex.fr') RETURNING id`,
  );
  userId = Number((u[0] as { id: number }).id);
  const { rows: p } = await h.pool.query(
    `INSERT INTO speaker_profiles ("userId", status) VALUES ($1, 'publie') RETURNING id`,
    [userId],
  );
  profileId = Number((p[0] as { id: number }).id);
  vi.mocked(requireUserId).mockResolvedValue(userId);

  // Répertoire : une conférence avec son édition 2025.
  await h.pool.query(
    `INSERT INTO conferences (slug, nom, ville, pays)
     VALUES ('devoxx-belgium', 'Devoxx Belgium', 'Anvers', 'Belgique')`,
  );
  await h.pool.query(
    `INSERT INTO conference_editions (conference_id, annee)
     SELECT id, 2025 FROM conferences WHERE slug = 'devoxx-belgium'`,
  );
});

const FICHIER = JSON.stringify([
  { title: "Understanding Kubernetes", event: "Devoxx Belgium", date: "2025-10-06" },
  { title: "Understanding Kubernetes", event: "KCD Helsinki 2026", city: "Helsinki" },
  { title: "TinyGo, petit mais costaud !", event: "KCD Helsinki 2026" },
]);

async function importerTout() {
  return confirmImportAction(
    {},
    fd({ texte: FICHIER, "talk-0": "on", "talk-1": "on" }),
  );
}

describe("import de bout en bout (SQL réel)", () => {
  it("écrit talks, occurrences et propositions conformes au plan", async () => {
    const r = await importerTout();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultat).toMatchObject({
      talksCrees: 2,
      occurrencesPubliees: 1,
      occurrencesEnAttente: 2,
    });

    // Deux talks (le même titre à 2 confs = UN talk), trois occurrences.
    const { rows: talks } = await h.pool.query(
      `SELECT titre FROM speaker_talks ORDER BY id`,
    );
    expect(talks).toEqual([
      { titre: "Understanding Kubernetes" },
      { titre: "TinyGo, petit mais costaud !" },
    ]);

    // UNE proposition pour les DEUX occurrences KCD Helsinki 2026 (dédupliquée).
    const { rows: props } = await h.pool.query(
      `SELECT nom, annee, statut FROM conference_propositions`,
    );
    expect(props).toEqual([{ nom: "KCD Helsinki", annee: 2026, statut: "en_attente" }]);

    // L'occurrence rattachée au répertoire porte le libellé recomposé + l'édition.
    const { rows: occ } = await h.pool.query(
      `SELECT conference, edition_id IS NOT NULL AS a_edition, proposition_id IS NOT NULL AS en_attente
         FROM talk_occurrences ORDER BY id`,
    );
    expect(occ).toEqual([
      { conference: "Devoxx Belgium 2025", a_edition: true, en_attente: false },
      { conference: "KCD Helsinki", a_edition: false, en_attente: true },
      { conference: "KCD Helsinki", a_edition: false, en_attente: true },
    ]);
  });

  it("l'invariant public tient : la conf importée hors répertoire reste invisible", async () => {
    await importerTout();
    const publics = await getPublicTalksByProfileId(profileId);
    const confs = publics.flatMap((t) => t.occurrences.map((o) => o.conference));
    expect(confs).toEqual(["Devoxx Belgium 2025"]);
  });

  it("REJOUER le même fichier n'écrit rien de plus (l'import est réessayable)", async () => {
    await importerTout();
    const r2 = await importerTout();
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.resultat).toMatchObject({
      talksCrees: 0,
      occurrencesPubliees: 0,
      occurrencesEnAttente: 0,
      doublons: 3,
    });
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM talk_occurrences`,
    );
    expect(rows).toEqual([{ n: 3 }]);
    const { rows: props } = await h.pool.query(
      `SELECT count(*)::int AS n FROM conference_propositions`,
    );
    expect(props).toEqual([{ n: 1 }]);
  });

  it("la validation orga publie ENSEMBLE les occurrences importées en attente", async () => {
    await importerTout();
    const { validateConferenceProposition } = await import(
      "@/lib/conference-propositions"
    );
    const { rows: props } = await h.pool.query(
      `SELECT id FROM conference_propositions LIMIT 1`,
    );
    const r = await validateConferenceProposition(Number((props[0] as { id: number }).id));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.occurrences).toBe(2);

    const publics = await getPublicTalksByProfileId(profileId);
    const confs = publics.flatMap((t) => t.occurrences.map((o) => o.conference)).sort();
    expect(confs).toEqual([
      "Devoxx Belgium 2025",
      "KCD Helsinki 2026",
      "KCD Helsinki 2026",
    ]);
  });
});
