// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import { EDITION_STATUTS } from "@/lib/tremplin-statut";
import { PROFILE_STATUSES } from "@/lib/profile-status";
import { MEMBERSHIP_STATUSES } from "@/lib/membership-status";

/**
 * Les listes fermées du code, vues par la BASE et non par le code — LE banc où
 * chaque colonne à liste fermée gagne sa ligne (072 pour l'édition, 073 pour
 * la fiche et l'adhésion ; le reliquat est en P2 de la dette).
 *
 * Le mode opératoire qui produit ces statuts est l'éditeur SQL de Neon : une
 * ligne y naît d'un INSERT à la main. La faute doit donc être refusée à
 * l'écriture par la base elle-même, quel que soit le chemin — les lecteurs,
 * eux, restent tels quels : corriger chaque lecture en positif laisserait la
 * prochaine lecture refaire la faute. Ce que chaque lecteur faisait d'un
 * statut inconnu est dit cas par cas dans la table ci-dessous.
 *
 * On charge le vrai `db/schema.sql` dans un vrai Postgres (PGlite).
 * `sync-to-latest.sql` — ce qui tourne réellement sur Neon — est tenu au même
 * état par `db-schema-drift.test.ts`, qui compare les deux catalogues (défaut
 * de colonne et définition des contraintes compris).
 */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync("db/schema.sql", "utf8"));
});

/** Insère comme le ferait une main dans l'éditeur Neon, rend le statut écrit. */
type Insertion = (statut?: string) => Promise<string>;

/** Fiche et adhésion sont UNIQUE par compte : chaque insertion crée le sien. */
const surCompte =
  (sansStatut: string, avecStatut: string): Insertion =>
  async (statut) => {
    const { rows: comptes } = await db.query<{ id: number }>(
      `INSERT INTO users(name) VALUES('Test') RETURNING id`,
    );
    const userId = comptes[0].id;
    const { rows } =
      statut === undefined
        ? await db.query<{ status: string }>(sansStatut, [userId])
        : await db.query<{ status: string }>(avecStatut, [userId, statut]);
    return rows[0].status;
  };

const CAS = [
  {
    colonne: "tremplin_editions.statut",
    contrainte: "tremplin_editions_statut_ck",
    valeurs: EDITION_STATUTS,
    defaut: "preparation",
    naissance:
      "une édition créée sans statut naît en préparation, donc invisible du public",
    // Tant que la colonne portait `DEFAULT 'ouvert'`, une édition créée à la
    // main naissait PUBLIQUE — annoncée avant qu'on ait décidé de l'annoncer.
    inconnu: "publie",
    refus: "refuse un statut inconnu du code",
    inserer: (async (statut?: string) => {
      const { rows } =
        statut === undefined
          ? await db.query<{ statut: string }>(
              `INSERT INTO tremplin_editions(nom, annee) VALUES('TSH', 2030) RETURNING statut`,
            )
          : await db.query<{ statut: string }>(
              `INSERT INTO tremplin_editions(nom, annee, statut) VALUES('TSH', 2030, $1) RETURNING statut`,
              [statut],
            );
      return rows[0].statut;
    }) satisfies Insertion,
  },
  {
    colonne: "speaker_profiles.status",
    contrainte: "speaker_profiles_status_ck",
    valeurs: PROFILE_STATUSES,
    defaut: "brouillon",
    naissance: "une fiche créée sans statut naît en brouillon, donc hors de l'annuaire",
    // « publiee » : la faute de frappe la plus probable dans l'éditeur Neon —
    // hors liste, elle passait le `NOT IN ('masque', 'refuse')` de
    // tremplin-public.ts et EXPOSAIT bio, LinkedIn et site perso dans la
    // galerie publique.
    inconnu: "publiee",
    refus: "refuse un statut inconnu du code, au lieu de publier la fiche",
    inserer: surCompte(
      `INSERT INTO speaker_profiles("userId") VALUES($1) RETURNING status`,
      `INSERT INTO speaker_profiles("userId", status) VALUES($1, $2) RETURNING status`,
    ),
  },
  {
    colonne: "user_memberships.status",
    contrainte: "user_memberships_status_ck",
    valeurs: MEMBERSHIP_STATUSES,
    defaut: "active",
    naissance: "une adhésion créée sans statut naît active",
    // « actif » : la francisation qui vient sous les doigts — hors liste, elle
    // passait le `<> 'active'` de comptes-inactifs.ts et rangeait une
    // adhérente à jour dans la cohorte des comptes à SUPPRIMER. La table n'a
    // aucune porte applicative : l'éditeur Neon est SON chemin d'écriture.
    inconnu: "actif",
    refus: "refuse un statut inconnu du code, au lieu de ranger le compte en suppression",
    inserer: surCompte(
      `INSERT INTO user_memberships("userId", expires_at) VALUES($1, now()) RETURNING status`,
      `INSERT INTO user_memberships("userId", expires_at, status) VALUES($1, now(), $2) RETURNING status`,
    ),
  },
] as const;

describe.each(CAS)("$colonne : la base tient l'invariant", (cas) => {
  it(cas.naissance, async () => {
    expect(await cas.inserer()).toBe(cas.defaut);
  });

  it(cas.refus, async () => {
    await expect(cas.inserer(cas.inconnu)).rejects.toThrow();
  });

  it("accepte tous les statuts de la liste TS", async () => {
    // Le CHECK est écrit à la main en SQL, la liste vit en TS : c'est cette
    // boucle qui les tient ensemble. Un statut ajouté à la constante sans être
    // ajouté au CHECK échoue ici, au lieu d'échouer en prod.
    for (const statut of cas.valeurs) {
      expect(await cas.inserer(statut)).toBe(statut);
    }
  });

  it("n'accepte aucun statut que la liste TS ignore", async () => {
    // L'autre sens. La boucle précédente laisse passer un statut ajouté au
    // CHECK et oublié en TS (`en_pause`, migration 074, en est le cas d'école) :
    // la base l'écrit, et les `Record` exhaustifs du code — conçus pour qu'un
    // statut ne reste jamais sans réponse — ne le connaissent pas.
    const { rows } = await db.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1`,
      [cas.contrainte],
    );
    expect(rows).toHaveLength(1);
    const enBase = [...rows[0].def.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...enBase].sort()).toEqual([...cas.valeurs].sort());
  });
});
