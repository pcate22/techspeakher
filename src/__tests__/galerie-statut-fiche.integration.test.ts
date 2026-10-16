// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * La galerie publique d'une édition du Tremplin joint la FICHE speakeuse pour
 * en tirer bio, poste, LinkedIn et site perso. L'intention est « tout sauf un
 * retrait explicite » : une finaliste apparaît avec sa fiche même en brouillon,
 * mais une fiche masquée ou refusée n'expose rien.
 *
 * La condition était écrite EN NÉGATIF (`status NOT IN ('masque','refuse')`),
 * ce qui rendait l'inconnu exposant : un statut hors modèle — écrit à la main
 * dans l'éditeur Neon, ou ajouté au modèle demain — faisait sortir bio et liens
 * en public. La migration 073 l'a passée en LISTE BLANCHE, dérivée de
 * `STATUTS_FICHE_JOINTE` via `sqlDansListe`.
 *
 * Ce test garde la CONSÉQUENCE, que rien ne gardait : le CHECK en base et le
 * `Record` exhaustif de `profile-status.ts` protègent l'écriture et l'ajout d'un
 * statut au type, mais ni l'un ni l'autre ne tombe si la clause redevient un
 * `NOT IN`. C'est la distinction de `docs/principes-tests.md` § 2 : la pièce
 * est juste, reste à voir si elle est branchée.
 *
 * Vrai Postgres (PGlite) + le vrai `db/schema.sql`.
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

import { getPublicEdition, type PublicFinalist } from "@/lib/tremplin-public";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
});

beforeEach(async () => {
  await h.holder.db!.exec(
    `TRUNCATE tremplin_registrations, tremplin_editions, speaker_profiles, users
       RESTART IDENTITY CASCADE`,
  );
});

/** Une finaliste consentante, avec une fiche au statut demandé. */
async function finalisteAvecFiche(statut: string) {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES('Morgane', 'morgane@ex.fr') RETURNING id`,
  );
  const userId = (u[0] as { id: number }).id;
  await h.pool.query(
    `INSERT INTO speaker_profiles ("userId", status, bio, linkedin, website)
     VALUES ($1, $2, 'Ma bio', 'https://li/moi', 'https://moi.fr')`,
    [userId, statut],
  );
  const { rows: e } = await h.pool.query(
    `INSERT INTO tremplin_editions (nom, annee, conf_slug, statut)
     VALUES ('TSH 2027', 2027, 'devfest-toulouse', 'clos') RETURNING id`,
  );
  const editionId = (e[0] as { id: number }).id;
  await h.pool.query(
    `INSERT INTO tremplin_registrations (edition_id, "userId", "public", finale_presente, statut)
     VALUES ($1, $2, true, true, 'acceptee')`,
    [editionId, userId],
  );
  const ed = await getPublicEdition("devfest-toulouse", 2027);
  // "deleted" est le tombstone d'une édition supprimée : hors sujet ici, mais le
  // type l'inclut, et l'écarter vaut mieux que le caster.
  if (!ed || ed === "deleted") return [];
  return ed.finalistes;
}

/**
 * Ce que la galerie laisse voir de la fiche, pour une finaliste. Typé sur le
 * VRAI DTO : un champ renommé ou retiré doit faire échouer la compilation, pas
 * rendre `null` — sinon le test resterait vert en cessant de regarder la fuite
 * qu'il garde.
 */
function fuites(finalistes: readonly PublicFinalist[]) {
  return finalistes.map(({ bio, linkedin, siteWeb }) => ({ bio, linkedin, siteWeb }));
}

describe("galerie publique : la fiche jointe suit une LISTE BLANCHE", () => {
  it("une fiche en brouillon apparaît avec sa bio (consentement d'édition)", async () => {
    const g = await finalisteAvecFiche("brouillon");
    expect(g).toHaveLength(1);
    expect(fuites(g)[0].bio).toBe("Ma bio");
  });

  it("une fiche MASQUÉE n'expose ni bio, ni LinkedIn, ni site", async () => {
    const g = await finalisteAvecFiche("masque");
    expect(g).toHaveLength(1); // la finaliste reste nommée (consentement d'édition)
    expect(fuites(g)[0]).toEqual({ bio: null, linkedin: null, siteWeb: null });
  });

  it("un statut INCONNU n'expose rien non plus — l'inconnu est un retrait", async () => {
    // Le cœur du correctif. La 073 ferme la liste en base, mais un CHECK ne
    // protège pas du jour où une valeur légitime s'ajoutera au modèle sans
    // qu'on relise ce filtre. On retire la contrainte le temps d'écrire la
    // ligne, pour jouer exactement cet état.
    // Le CHECK n'est PAS remis ensuite : ce fichier juge la clause de LECTURE,
    // l'instance meurt avec le dernier test, et le remettre à la main aurait
    // recopié les cinq valeurs une quatrième fois — une copie que rien ne garde,
    // donc qui recréerait l'ancienne contrainte en silence le jour où un statut
    // s'ajoute.
    await h.holder.db!.exec(
      `ALTER TABLE speaker_profiles DROP CONSTRAINT speaker_profiles_status_ck`,
    );
    const g = await finalisteAvecFiche("archive");

    expect(g).toHaveLength(1);
    expect(fuites(g)[0]).toEqual({ bio: null, linkedin: null, siteWeb: null });
  });
});
