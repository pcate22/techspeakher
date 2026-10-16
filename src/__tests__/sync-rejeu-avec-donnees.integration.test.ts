// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Le fichier de sync fait ~1900 lignes et se rejoue plusieurs fois ici.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * LE DÉPLOIEMENT SE REJOUE SUR UNE BASE QUI CONTIENT DES LIGNES.
 *
 * `db/schema-drift` compare déjà les catalogues, mais il applique les deux
 * fichiers sur une base VIERGE : par construction, il ne peut pas voir une
 * instruction qui ne tombe qu'EN PRÉSENCE DE DONNÉES. C'est pourtant une classe
 * entière de pannes, et la plus coûteuse qui soit — `db/sync-to-latest.sql` part
 * en UNE transaction implicite, donc une seule instruction en échec annule
 * TOUT ; le pas « Migration base (production) » tombe AVANT `vercel build`, et
 * plus aucun déploiement ne passe. Le site continue de servir l'ancien code, et
 * seule une CI rouge le dit.
 *
 * Ce fichier ouvre cet angle mort : il rejoue le VRAI fichier de déploiement sur
 * une base peuplée des états que le schéma déclare LÉGITIMES. C'est le PATRON de
 * la garde, pas encore sa couverture complète — il ne peuple aujourd'hui que
 * `tremplin_photo_personnes` et ce qui l'entoure. Un bloc qui revalide une règle
 * abandonnée sur une AUTRE table (`contenus`, `tremplin_registrations`…) passera
 * donc encore au travers : y ajouter un cas est le geste attendu, et le fixture
 * ci-dessous est écrit pour qu'on puisse le faire sans démêler l'existant.
 *
 * Le cas fondateur : la 020 ajoutait `photo_personne_identite` (un tag de photo
 * porte au moins une identité), la 021 la supprime — parce qu'elle a rendu le
 * tag ORPHELIN légitime (`ON DELETE SET NULL`, pour qu'une photo ne se republie
 * pas quand la personne s'en va). Comme la 021 la retirait au déploiement
 * précédent, le `IF NOT EXISTS` de la 020 était vrai à CHAQUE rejeu : Postgres
 * la recréait, la validait contre toutes les lignes, et tombait sur l'orphelin.
 * Le déclencheur est un droit, pas un cas tordu — supprimer son compte
 * (`effacerCompteEnBase`, RGPD art. 17).
 *
 * UNE SEULE instance PGlite : c'est du WASM, et la leçon est écrite dans
 * `sync-seeds-contenus.integration.test.ts` — les moteurs multipliés rougissent
 * au hasard dès que la machine est chargée, et un test instable finit ignoré.
 */

const sync = readFileSync("db/sync-to-latest.sql", "utf8");

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sync);
});

afterAll(async () => {
  await db?.close();
});

/**
 * Une photo, et une personne taguée dessus — par son COMPTE ou par son
 * INSCRIPTION, les deux clés que la 021 met en `ON DELETE SET NULL`.
 * Renvoie l'id du tag, pour que les assertions ne dépendent pas de ce que le
 * fichier de sync sème par ailleurs.
 */
async function tagDePhoto(par: "compte" | "inscription"): Promise<number> {
  // Repartir du même état, quel que soit l'ordre des cas — en ne retirant QUE
  // les lignes de ce fixture : le fichier de sync sème lui-même des données, et
  // un DELETE sans clause les emporterait, rendant chaque cas dépendant de sa
  // position dans le fichier.
  await db.exec(`
    DELETE FROM tremplin_editions WHERE nom = 'Édition photo';
    DELETE FROM users WHERE email = 'taguee@example.test';`);
  const { rows } = await db.query<{ id: number }>(
    `WITH e AS (
       INSERT INTO tremplin_editions (nom, annee) VALUES ('Édition photo', 2031) RETURNING id
     ), p AS (
       INSERT INTO tremplin_photos (edition_id, url)
       SELECT id, 'https://example.test/photo.webp' FROM e RETURNING id
     ), u AS (
       INSERT INTO users (email, name) VALUES ('taguee@example.test', 'Personne taguée')
       RETURNING id
     ), i AS (
       -- Un nom, parce que registration_identite exige un compte OU un nom :
       -- c'est aussi ce que effacerCompteEnBase pose avant que le SET NULL retire le
       -- compte.
       INSERT INTO tremplin_registrations (edition_id, participante_nom)
       SELECT id, 'Participante' FROM e RETURNING id
     )
     INSERT INTO tremplin_photo_personnes (photo_id, user_id, registration_id)
     SELECT p.id,
            CASE WHEN $1 = 'compte' THEN u.id END,
            CASE WHEN $1 = 'inscription' THEN i.id END
       FROM p, u, i
     RETURNING id`,
    [par],
  );
  return rows[0]!.id;
}

/** L'identité d'un tag, telle que la base la porte. */
async function identite(id: number) {
  const { rows } = await db.query(
    `SELECT registration_id, user_id, nom_libre FROM tremplin_photo_personnes WHERE id = $1`,
    [id],
  );
  return rows[0];
}

describe("rejeu du déploiement sur une base peuplée", () => {
  it.each([
    ["compte", `DELETE FROM users WHERE email = 'taguee@example.test'`],
    [
      "inscription",
      `DELETE FROM tremplin_registrations WHERE participante_nom = 'Participante'`,
    ],
  ] as const)(
    "un tag rendu orphelin par la suppression d'un·e %s ne bloque pas le déploiement",
    async (par, suppression) => {
      const tag = await tagDePhoto(par);

      // Ce que `ON DELETE SET NULL` produit : le tag survit, sans identité.
      // C'est le comportement VOULU (021) — la photo ne doit pas se republier
      // au départ de la personne.
      await db.exec(suppression);
      expect(await identite(tag)).toEqual({
        registration_id: null,
        user_id: null,
        nom_libre: null,
      });

      // Le déploiement suivant.
      await expect(db.exec(sync)).resolves.toBeDefined();

      // Le tag est toujours là : le rejeu n'a rien nettoyé au passage.
      expect(await identite(tag)).toBeDefined();
    },
  );

  /**
   * UN REJEU NE REFAIT PAS LE TRAVAIL DÉJÀ FAIT.
   *
   * La clé primaire de `tremplin_photo_personnes` était retirée puis reposée à
   * CHAQUE déploiement : un index unique reconstruit sur toute la table à chaque
   * fois, et une fenêtre sans clé primaire au milieu de la transaction de
   * migration. L'identité de l'objet (son oid) le dit sans ambiguïté : inchangée,
   * la contrainte n'a pas été touchée.
   */
  it("la clé primaire n'est pas reconstruite à chaque déploiement", async () => {
    const oid = async () =>
      (
        await db.query<{ oid: number }>(
          `SELECT oid FROM pg_constraint WHERE conname = 'tremplin_photo_personnes_pkey'`,
        )
      ).rows[0]?.oid;

    const avant = await oid();
    expect(avant).toBeDefined();

    await db.exec(sync);

    expect(await oid()).toBe(avant);
  });

  /**
   * LE DROP DE LA 021 EST PORTEUR, pas un vestige.
   *
   * Une base peut encore porter `photo_personne_identite` : celle d'une
   * développeuse qui a appliqué les migrations une à une jusqu'à la 020 (cf.
   * db/migrations/README.md), ou tout environnement figé avant la 021. Là, ce
   * n'est plus le déploiement qui casse mais l'EFFACEMENT LUI-MÊME : le
   * `SET NULL` produit une ligne que la contrainte refuse, donc `effacerCompteEnBase`
   * lève, et la demande de suppression (RGPD art. 17) échoue.
   *
   * Le seul remède est le `DROP CONSTRAINT IF EXISTS` de la 021. Ce cas le
   * verrouille : le retirer comme « code mort » ferait rougir la CI.
   */
  it("une base portant encore la contrainte est guérie par le déploiement", async () => {
    const tag = await tagDePhoto("compte");
    await db.exec(`
      ALTER TABLE tremplin_photo_personnes ADD CONSTRAINT photo_personne_identite CHECK (
        registration_id IS NOT NULL OR user_id IS NOT NULL OR nom_libre IS NOT NULL
      )`);

    // Avant le déploiement, l'effacement est IMPOSSIBLE.
    await expect(db.exec(`DELETE FROM users WHERE email = 'taguee@example.test'`)).rejects.toThrow(
      /photo_personne_identite/,
    );

    await db.exec(sync);

    // Après, il passe, et laisse l'orphelin voulu.
    await db.exec(`DELETE FROM users WHERE email = 'taguee@example.test'`);
    expect(await identite(tag)).toEqual({
      registration_id: null,
      user_id: null,
      nom_libre: null,
    });
  });
});
