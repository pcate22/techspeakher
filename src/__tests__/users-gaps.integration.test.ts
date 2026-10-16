import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD (pg-mem + `db/schema.sql`) pour les fonctions
 * de `src/lib/users.ts` restées sans couverture SQL : recherche par e-mail,
 * liste de TOUS les comptes plateforme, et pose du nom (avec/sans écrasement).
 * On exécute le SQL réel contre un Postgres en mémoire — pas de mock du pool —
 * pour attraper ce qu'un pool mické ne voit pas : casse de l'e-mail, absence de
 * filtre par rôle, tri, condition `name IS NULL`.
 *
 * On NE refait PAS ce qui est déjà couvert ailleurs en vrai SQL
 * (`getOrCreateUserByEmail` et l'index unique dans tremplin-db.integration.test.ts ;
 * la course 23505 dans users.test.ts).
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getUserByEmail,
  getCompte,
  getComptesPlateforme,
  getComptesSpeakeuses,
  setUserName,
  setUserNameIfEmpty,
} from "@/lib/users";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup(); // schéma chargé, base vide
});

beforeEach(() => backup.restore()); // isole chaque test (purge les lignes)

/** Insère un compte et renvoie son id (colonnes optionnelles → défauts SQL). */
async function insertUser(opts: {
  name?: string | null;
  email?: string | null;
  isOrga?: boolean;
  isCoach?: boolean;
}): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name, email, is_orga, is_coach)
     VALUES($1, $2, $3, $4) RETURNING id`,
    [opts.name ?? null, opts.email ?? null, opts.isOrga ?? false, opts.isCoach ?? false],
  );
  return (rows[0] as { id: number }).id;
}

async function nameInDb(id: number): Promise<string | null> {
  const { rows } = await h.pool.query("SELECT name FROM users WHERE id = $1", [id]);
  return (rows[0] as { name: string | null }).name;
}

describe("getUserByEmail (réel)", () => {
  it("trouve le compte quelle que soit la casse de l'e-mail", async () => {
    const id = await insertUser({ name: "Alice", email: "alice@example.fr" });
    // La requête compare lower(email) = lower($1) : la casse ne doit rien changer.
    const found = await getUserByEmail("ALICE@Example.FR");
    expect(found).toEqual({ id, name: "Alice", email: "alice@example.fr" });
  });

  it("renvoie null pour un e-mail inconnu (cas négatif)", async () => {
    await insertUser({ name: "Alice", email: "alice@example.fr" });
    expect(await getUserByEmail("inconnue@example.fr")).toBeNull();
  });
});

describe("getComptesPlateforme (réel)", () => {
  it("renvoie TOUS les comptes, sans filtre de rôle, triés (name NULLS LAST, email)", async () => {
    // Un compte de chaque profil : la fonction ne filtre NI orga NI coach.
    const orga = await insertUser({ name: "Bianca", email: "bianca@x.fr", isOrga: true });
    const coach = await insertUser({ name: "Awa", email: "awa@x.fr", isCoach: true });
    const simple = await insertUser({ name: "Chloé", email: "chloe@x.fr" });
    // Compte sans nom : doit finir en queue (NULLS LAST).
    const sansNom = await insertUser({ name: null, email: "zoe@x.fr" });

    const comptes = await getComptesPlateforme();
    // Les quatre profils sont présents : aucune exclusion par rôle.
    expect(comptes.map((c) => c.id).sort((a, b) => a - b)).toEqual(
      [orga, coach, simple, sansNom].sort((a, b) => a - b),
    );
    // Tri : Awa, Bianca, Chloé, puis le compte sans nom en dernier.
    expect(comptes.map((c) => c.email)).toEqual([
      "awa@x.fr",
      "bianca@x.fr",
      "chloe@x.fr",
      "zoe@x.fr",
    ]);
  });

  it("cas négatif de filtre : un compte SANS profil speakeuse figure ici mais PAS dans getComptesSpeakeuses", async () => {
    // getComptesSpeakeuses JOINt speaker_profiles : un compte sans profil en est
    // exclu. getComptesPlateforme n'a pas cette jointure → il l'inclut.
    const avecProfil = await insertUser({ name: "Speakeuse", email: "speak@x.fr" });
    await h.pool.query(
      `INSERT INTO speaker_profiles("userId") VALUES($1)`,
      [avecProfil],
    );
    const sansProfil = await insertUser({ name: "Coach seul", email: "coachseul@x.fr" });

    const plateforme = (await getComptesPlateforme()).map((c) => c.id);
    const speakeuses = (await getComptesSpeakeuses()).map((c) => c.id);

    expect(plateforme).toContain(sansProfil); // présent côté plateforme
    expect(speakeuses).not.toContain(sansProfil); // absent de l'annuaire speakeuses
    expect(speakeuses).toContain(avecProfil); // le profil, lui, y figure
  });
});

describe("setUserName (réel)", () => {
  it("écrit le nom, relu en base", async () => {
    const id = await insertUser({ name: null, email: "sans-nom@x.fr" });
    await setUserName(id, "Nom Choisi");
    expect(await nameInDb(id)).toBe("Nom Choisi");
  });

  it("remplace un nom déjà présent (self-service : la personne édite son propre nom)", async () => {
    const id = await insertUser({ name: "Ancien", email: "edit@x.fr" });
    await setUserName(id, "Nouveau");
    expect(await nameInDb(id)).toBe("Nouveau");
  });
});

describe("setUserNameIfEmpty (réel)", () => {
  it("pose le nom quand il est NULL (branche : name IS NULL)", async () => {
    const id = await insertUser({ name: null, email: "vide@x.fr" });
    await setUserNameIfEmpty(id, "Complété");
    expect(await nameInDb(id)).toBe("Complété");
  });

  it("n'écrase PAS un nom déjà renseigné (branche : name NOT NULL)", async () => {
    const id = await insertUser({ name: "Appartient à la personne", email: "plein@x.fr" });
    await setUserNameIfEmpty(id, "Tentative d'écrasement");
    expect(await nameInDb(id)).toBe("Appartient à la personne");
  });
});

describe("getCompte (réel)", () => {
  it("renvoie nom, genre et photo en UNE lecture, null si le compte est inconnu", async () => {
    const sans = await insertUser({ name: "Ada" });
    const avec = await insertUser({ name: "Lucien" });
    await h.pool.query(`UPDATE users SET genre = 'homme' WHERE id = $1`, [avec]);
    await h.pool.query(`UPDATE users SET image = 'https://cdn/lucien.png' WHERE id = $1`, [avec]);

    expect(await getCompte(sans)).toEqual({ name: "Ada", genre: null, image: null });
    expect(await getCompte(avec)).toEqual({
      name: "Lucien",
      genre: "homme",
      image: "https://cdn/lucien.png",
    });
    expect(await getCompte(999999)).toBeNull();
  });
});
