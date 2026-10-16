// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Le fil de la communauté lit EN TRAVERS toutes les fiches. Comme l'agenda
 * public, le risque n'est pas l'affichage mais le WHERE : montrer une fiche en
 * brouillon, en relecture ou retirée dans un « elles viennent de nous rejoindre »
 * serait une fuite, pas une maladresse.
 *
 * Vrai Postgres (PGlite) sur `db/schema.sql`, vraie fonction d'accès, un cas
 * négatif par règle.
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

import { getNouvellesVenues } from "@/lib/fil-communaute";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE speaker_profiles, users RESTART IDENTITY CASCADE",
  );
});

/** Une fiche, dans le statut voulu, publiée à la date donnée (ou jamais). */
async function fiche(
  nom: string | null,
  status: string,
  publieeLe: string | null,
  { slug = null as string | null, titreProfil = null as string | null } = {},
): Promise<number> {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [nom, `${(nom ?? "x").toLowerCase().replace(/\W+/g, ".")}@example.org`],
  );
  const { rows: p } = await h.pool.query(
    `INSERT INTO speaker_profiles("userId", status, slug, titre_profil, published_at)
     VALUES($1, $2, $3, $4, $5) RETURNING id`,
    [(u[0] as { id: number }).id, status, slug, titreProfil, publieeLe],
  );
  return (p[0] as { id: number }).id;
}

describe("getNouvellesVenues", () => {
  it("ne montre que les fiches PUBLIÉES", async () => {
    await fiche("Léa Dubois", "publie", "2026-07-20", { slug: "lea-dubois" });
    for (const statut of ["brouillon", "en_attente", "masque", "refuse"]) {
      // Même avec une date de publication (fiche retirée depuis), elle sort.
      await fiche(`Fiche ${statut}`, statut, "2026-07-25");
    }
    const venues = await getNouvellesVenues();
    expect(venues.map((v) => v.nom)).toEqual(["Léa Dubois"]);
  });

  it("la plus récemment publiée d'abord", async () => {
    await fiche("Ancienne", "publie", "2026-01-05");
    await fiche("Récente", "publie", "2026-07-28");
    await fiche("Moyenne", "publie", "2026-04-10");
    const venues = await getNouvellesVenues();
    expect(venues.map((v) => v.nom)).toEqual(["Récente", "Moyenne", "Ancienne"]);
  });

  it("respecte la limite demandée", async () => {
    for (let i = 0; i < 5; i++) await fiche(`Speakeuse ${i}`, "publie", `2026-07-0${i + 1}`);
    expect(await getNouvellesVenues(2)).toHaveLength(2);
  });

  it("écarte une fiche publiée sans date de publication (migration ancienne)", async () => {
    await fiche("Sans date", "publie", null);
    await fiche("Avec date", "publie", "2026-07-20");
    const venues = await getNouvellesVenues();
    expect(venues.map((v) => v.nom)).toEqual(["Avec date"]);
  });

  it("écarte une fiche publiée sans nom (elle s'afficherait anonyme)", async () => {
    await fiche(null, "publie", "2026-07-20");
    expect(await getNouvellesVenues()).toEqual([]);
  });

  // Le DTO reste un SOUS-ENSEMBLE de l'annuaire public, plus la date d'entrée
  // au format jour : le fil de l'espace connecté l'affiche sur chaque entrée
  // (conception fil §4.3). Ni e-mail, ni statut.
  it("le DTO ne porte que de l'affichable : ni e-mail, ni statut", async () => {
    await fiche("Léa Dubois", "publie", "2026-07-20", {
      slug: "lea-dubois",
      titreProfil: "Ingénieure plateforme",
    });
    const [v] = await getNouvellesVenues();
    expect(Object.keys(v).sort()).toEqual(
      ["date", "href", "image", "nom", "profileId", "titreProfil"].sort(),
    );
    expect(v.date).toBe("2026-07-20");
    expect(JSON.stringify(v)).not.toMatch(/@example\.org|publie/);
    expect(v.href).toBe("/speakeuses/lea-dubois");
  });

  it("sans slug, le lien retombe sur l'id", async () => {
    const id = await fiche("Inès Martin", "publie", "2026-07-20");
    const [v] = await getNouvellesVenues();
    expect(v.href).toBe(`/speakeuses/${id}`);
  });
});
