// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Démarrer un moteur WASM et lui appliquer `db/schema.sql` entier dépasse
// largement les délais par défaut de vitest quand la suite complète tourne en
// parallèle (mesuré à ~11 s ici, et le fichier tombait sur un « Hook timed
// out »). Le hook est le point sensible : son dépassement fait tomber TOUT le
// fichier, pas un cas. Même correctif que `sync-seeds-contenus.integration`, qui
// déploie le même schéma.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * UN SEED SE POSE UNE FOIS.
 *
 * `db/sync-to-latest.sql` est rejoué à CHAQUE déploiement. Un seed de contenu
 * gardé par le seul `ON CONFLICT (slug) DO NOTHING` ne tient que tant qu'une
 * ligne porte ce slug — et c'est exactement ce qui manque :
 *
 * - SUPPRIMER l'article dans l'admin le faisait revenir au déploiement suivant.
 *   Une demande de retrait de nom (RGPD art. 17) s'annulait toute seule ;
 * - le RENOMMER libère le slug (`updateContenu` le recalcule depuis le titre) :
 *   le seed réinsérait alors un doublon qui, à date de publication égale,
 *   GAGNE l'affichage public (`ORDER BY publie_le DESC NULLS LAST, id DESC`).
 *   Les deux pages revenaient au texte d'avant l'édition, sans rien dire.
 *
 * Vrai Postgres (PGlite) + le vrai `db/schema.sql` + la vraie migration.
 */

const schema = readFileSync("db/schema.sql", "utf8");
const seed = readFileSync("db/migrations/059_recit_devfest_2025.sql", "utf8");
const SLUG = "devfest-toulouse-2025-ca-a-marche";

/**
 * UNE SEULE instance PGlite, remise à zéro entre les cas — même raison que dans
 * `sync-seeds-contenus.integration.test.ts` : PGlite est du WASM, et démarrer un
 * moteur par cas rougissait au hasard dès que le fichier partageait la machine
 * avec les autres suites. Un test instable finit ignoré.
 *
 * Ici la remise à zéro est plus simple : ces cas ne touchent que `contenus`, et
 * la conférence de rattachement est posée une fois pour toutes.
 */
let db: PGlite;

/**
 * Le moteur est monté par un HOOK dédié, pas par « la variable est-elle encore
 * vide ? ». `db` reçoit son instance AVANT que le schéma s'applique : une panne
 * en cours de route laissait donc une base assignée mais VIDE, et tous les cas
 * suivants tournaient contre elle en croyant l'avoir initialisée. Un `beforeAll`
 * qui échoue, lui, fait tomber le fichier — bruyamment, ce qui est le but.
 */
beforeAll(async () => {
  db = new PGlite();
  await db.exec(schema);
  await db.exec(`
    INSERT INTO conferences (slug, nom, type, ville, pays)
    VALUES ('devfest-toulouse', 'DevFest Toulouse', 'conference', 'Toulouse', 'France');
    INSERT INTO conference_editions (conference_id, annee)
    SELECT id, 2025 FROM conferences WHERE slug = 'devfest-toulouse';`);
});

/** Un moteur WASM retient sa mémoire tant qu'on ne le ferme pas. */
afterAll(async () => {
  await db?.close();
});

const slugs = async (): Promise<string[]> =>
  ((await db.query("SELECT slug FROM contenus ORDER BY id")).rows as { slug: string }[]).map(
    (r) => r.slug,
  );

/** Rend la base à l'état « schéma posé, conférence en place, rien de seedé ». */
beforeEach(async () => {
  await db.exec("DELETE FROM contenus; DELETE FROM seeds_appliques;");
});

describe("seed du récit 2025 — posé une fois, jamais ressuscité", () => {
  it("pose l'article, et le rejeu ne le double pas", async () => {
    await db.exec(seed);
    expect(await slugs()).toEqual([SLUG]);

    await db.exec(seed);
    await db.exec(seed);
    expect(await slugs()).toEqual([SLUG]);
  });

  it("supprimé dans l'admin, il reste supprimé après un déploiement", async () => {
    await db.exec(seed);
    await db.exec(`DELETE FROM contenus WHERE slug = '${SLUG}'`);

    await db.exec(seed);

    expect(await slugs()).toEqual([]);
  });

  it("renommé dans l'admin, il ne revient pas en doublon sous son ancien slug", async () => {
    await db.exec(seed);
    // `updateContenu` dérive le slug du titre : renommer LIBÈRE l'ancien.
    await db.exec(
      `UPDATE contenus SET slug = 'devfest-2025-le-recit', titre = 'Le récit' WHERE slug = '${SLUG}'`,
    );

    await db.exec(seed);

    expect(await slugs()).toEqual(["devfest-2025-le-recit"]);
  });

  /**
   * Ce cas a besoin d'une base qui n'a JAMAIS eu la conférence : il vérifie
   * précisément son absence. Il se fabrique donc la sienne, dans une variable
   * LOCALE — écrire dans `db` laisserait aux cas suivants une base sans
   * conférence, et le fichier deviendrait dépendant de son ordre.
   */
  it("sans l'édition de conférence : rien posé, et rien de marqué — la base peut encore le recevoir", async () => {
    const sansConf = new PGlite();
    try {
      await sansConf.exec(schema);
      const slugsDe = async () =>
        ((await sansConf.query("SELECT slug FROM contenus ORDER BY id")).rows as {
          slug: string;
        }[]).map((r) => r.slug);

      await sansConf.exec(seed);
      expect(await slugsDe()).toEqual([]);
      expect((await sansConf.query("SELECT cle FROM seeds_appliques")).rows).toEqual([]);

      // L'édition arrive plus tard (import, création dans l'admin) : le seed joue.
      await sansConf.exec(`
        INSERT INTO conferences (slug, nom, type, ville, pays)
        VALUES ('devfest-toulouse', 'DevFest Toulouse', 'conference', 'Toulouse', 'France');
        INSERT INTO conference_editions (conference_id, annee)
        SELECT id, 2025 FROM conferences WHERE slug = 'devfest-toulouse';`);
      await sansConf.exec(seed);
      expect(await slugsDe()).toEqual([SLUG]);
    } finally {
      // Fermé même si une assertion tombe : sinon un échec fuit un moteur WASM.
      await sansConf.close();
    }
  });
});
