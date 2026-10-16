// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * L'agenda public lit EN TRAVERS toutes les fiches : c'est la première requête
 * du projet qui sort du périmètre « une speakeuse ». Le risque n'est donc pas le
 * tri (couvert en pur par agenda-public.test.ts) mais le WHERE — publier par
 * mégarde les dates d'une fiche en brouillon, retirée ou en relecture.
 *
 * Chaque test insère un CAS NÉGATIF qui ne doit PAS remonter : c'est ce qui rend
 * le test capable d'attraper un filtre faux. Vrai Postgres (PGlite) sur
 * `db/schema.sql`, vraie fonction d'accès.
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

import {
  getAnneesArchive,
  getApercuPasse,
  getScenesPubliques,
  getScenesRecentes,
} from "@/lib/agenda-public";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_occurrences, speaker_talks, speaker_profiles, users, conferences RESTART IDENTITY CASCADE",
  );
});

/** Une speakeuse : compte + fiche, dans le statut voulu. */
async function speakeuse(
  nom: string | null,
  status: string,
  slug: string | null = null,
): Promise<number> {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [nom, `${(nom ?? "x").toLowerCase().replace(/\W+/g, ".")}@example.org`],
  );
  const { rows: p } = await h.pool.query(
    `INSERT INTO speaker_profiles("userId", status, slug) VALUES($1, $2, $3) RETURNING id`,
    [(u[0] as { id: number }).id, status, slug],
  );
  return (p[0] as { id: number }).id;
}

/** Un talk et sa conférence datée. `source` : « tremplin » = proposition backfill. */
async function intervention(
  profileId: number,
  titre: string,
  date: string | null,
  {
    source = "manuel",
    conference = "DevFest Toulouse",
    conferenceId = null,
  }: { source?: string; conference?: string | null; conferenceId?: number | null } = {},
): Promise<void> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_talks(speaker_profile_id, titre, type, source)
     VALUES($1, $2, 'Conférence', $3) RETURNING id`,
    [profileId, titre, source],
  );
  await h.pool.query(
    `INSERT INTO talk_occurrences(talk_id, speaker_profile_id, conference, conference_id, ville, date)
     VALUES($1, $2, $3, $4, 'Toulouse', $5)`,
    [(rows[0] as { id: number }).id, profileId, conference, conferenceId, date],
  );
}

/** Une conférence du REGISTRE (celui que `ConferenceCombobox` alimente). */
async function conferenceDuRegistre(slug: string, nom: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO conferences(slug, nom, type) VALUES($1, $2, 'conference') RETURNING id`,
    [slug, nom],
  );
  return (rows[0] as { id: number }).id;
}

describe("getScenesPubliques — périmètre public", () => {
  it("ne remonte que les interventions des fiches PUBLIÉES", async () => {
    const publiee = await speakeuse("Léa Dubois", "publie", "lea-dubois");
    await intervention(publiee, "Accessibilité sans excuse", "2026-11-19");
    for (const statut of ["brouillon", "en_attente", "masque", "refuse"]) {
      const autre = await speakeuse(`Fiche ${statut}`, statut);
      await intervention(autre, `Talk ${statut}`, "2026-11-20");
    }

    const scenes = await getScenesPubliques();
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Accessibilité sans excuse"]);
    expect(scenes[0].speakeuseNom).toBe("Léa Dubois");
    expect(scenes[0].speakeuseHref).toBe("/speakeuses/lea-dubois");
  });

  it("écarte les propositions issues du backfill Tremplin (des sujets, pas des dates)", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Talk confirmé", "2026-11-19");
    await intervention(p, "Sujet pitché", "2026-11-20", { source: "tremplin" });

    const scenes = await getScenesPubliques();
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Talk confirmé"]);
  });

  it("écarte les conférences sans date (un agenda a besoin d'une date)", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Sans date", null);
    await intervention(p, "Datée", "2026-11-19");

    const scenes = await getScenesPubliques();
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Datée"]);
  });

  it("écarte une fiche publiée sans nom (elle s'afficherait anonyme)", async () => {
    const sansNom = await speakeuse(null, "publie");
    await intervention(sansNom, "Talk anonyme", "2026-11-19");

    expect(await getScenesPubliques()).toEqual([]);
  });

  it("le DTO ne porte QUE de l'affichable : aucun e-mail, aucun statut", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Accessibilité sans excuse", "2026-11-19");

    const [scene] = await getScenesPubliques();
    expect(Object.keys(scene).sort()).toEqual(
      [
        "conference",
        "conferenceCle",
        "conferenceLibelle",
        "date",
        // La photo du compte (lot N2 : les cartes du fil sont incarnées) —
        // déjà publiée par l'annuaire, jamais l'e-mail ni le statut.
        "image",
        "lienConf",
        "occurrenceId",
        "pays",
        // Région dans le vocabulaire de l'annuaire (migration 072). Dérivée,
        // jamais interne : elle dit où ranger l'intervention, comme la ville.
        "region",
        // L'id de la fiche PUBLIÉE (lot N4 : le bouton Bravo s'efface sur SA
        // carte) — déjà public : c'est l'id du lien /speakeuses/{id}.
        "profileId",
        "speakeuseHref",
        "speakeuseNom",
        "talkTitre",
        "talkType",
        "ville",
      ].sort(),
    );
    expect(JSON.stringify(scene)).not.toMatch(/@example\.org|publie/);
  });

  it("sans slug, le lien retombe sur l'id de la fiche", async () => {
    const p = await speakeuse("Inès Martin", "publie");
    await intervention(p, "Déboguer sans pleurer", "2026-11-19");

    const [scene] = await getScenesPubliques();
    expect(scene.speakeuseHref).toBe(`/speakeuses/${p}`);
  });

  /**
   * LA FACETTE « CONFÉRENCE » NE PEUT PAS SE BÂTIR SUR LE LIBELLÉ FIGÉ.
   * Cas mesuré en prod le 16/08/2026 : le même DevFest saisi « DevFest
   * Toulouse » par les unes et « DevFest » par les autres, le même jour. Ces
   * tests jouent exactement ça, sur un vrai Postgres et le vrai registre.
   */
  it("deux libellés divergents, une seule clé : le registre tranche", async () => {
    const devfest = await conferenceDuRegistre("devfest-toulouse", "DevFest Toulouse");
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Talk A", "2026-11-19", {
      conference: "DevFest Toulouse",
      conferenceId: devfest,
    });
    await intervention(p, "Talk B", "2026-11-19", {
      conference: "DevFest",
      conferenceId: devfest,
    });

    const scenes = await getScenesPubliques();
    const cles = new Set(scenes.map((s) => s.conferenceCle));
    expect(cles).toEqual(new Set(["devfest-toulouse"]));
    // Et la facette s'affiche sous le nom du REGISTRE, pas sous l'une des deux
    // saisies : « DevFest » ne devient jamais le nom de la conférence.
    expect(new Set(scenes.map((s) => s.conferenceLibelle))).toEqual(
      new Set(["DevFest Toulouse"]),
    );
    // La carte, elle, continue d'afficher ce que la speakeuse a annoncé.
    expect(scenes.map((s) => s.conference).sort()).toEqual([
      "DevFest",
      "DevFest Toulouse",
    ]);
  });

  it("sans rattachement, la scène garde une clé de repli — et reste dans l'agenda", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Texte libre", "2026-11-19", {
      conference: "Sunny Tech 2026",
      conferenceId: null,
    });

    const [scene] = await getScenesPubliques();
    // La LEFT JOIN ne doit jamais faire disparaître une occurrence non rattachée.
    expect(scene.talkTitre).toBe("Texte libre");
    expect(scene.conferenceCle).toBe("texte:sunny tech");
    expect(scene.conferenceLibelle).toBe("Sunny Tech");
  });

  it("une occurrence rattachée et une en texte libre restent DEUX facettes", async () => {
    // Le repli ne prétend jamais rejoindre le registre : sinon on regrouperait
    // sur une ressemblance de chaîne, ce que ce lot existe pour éviter.
    const devfest = await conferenceDuRegistre("devfest-toulouse", "DevFest Toulouse");
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Rattachée", "2026-11-19", {
      conference: "DevFest Toulouse",
      conferenceId: devfest,
    });
    await intervention(p, "Libre", "2026-11-20", {
      conference: "DevFest Toulouse",
      conferenceId: null,
    });

    const scenes = await getScenesPubliques();
    expect(new Set(scenes.map((s) => s.conferenceCle)).size).toBe(2);
  });

  it("trie au plus tôt, toutes speakeuses confondues", async () => {
    const a = await speakeuse("Ada Lovelace", "publie");
    const b = await speakeuse("Grace Hopper", "publie");
    await intervention(a, "Tard", "2026-12-01");
    await intervention(b, "Tôt", "2026-09-01");

    const scenes = await getScenesPubliques();
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Tôt", "Tard"]);
  });
});

describe("getScenesRecentes — le fil (des scènes PASSÉES, à date exacte)", () => {
  it("rend les scènes passées, la plus récente d'abord, jamais le futur", async () => {
    const p = await speakeuse("Léa Dubois", "publie", "lea-dubois");
    await intervention(p, "Hier", "2026-08-06");
    await intervention(p, "Le mois dernier", "2026-07-11");
    await intervention(p, "Demain", "2026-08-08");
    await intervention(p, "Aujourd'hui", "2026-08-07");

    const scenes = await getScenesRecentes(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Hier", "Le mois dernier"]);
  });

  it("écarte les dates imprécises (« 2026 », « 2026-07 ») : pas de jour où se ranger", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Année vague", "2025");
    await intervention(p, "Mois vague", "2026-07");
    await intervention(p, "Exacte", "2026-07-11");

    const scenes = await getScenesRecentes(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Exacte"]);
  });

  it("une fiche RETIRÉE disparaît du fil, rétroactivement (la propriété du lot)", async () => {
    const publiee = await speakeuse("Publiée", "publie");
    await intervention(publiee, "Reste", "2026-07-11");
    for (const statut of ["brouillon", "en_attente", "masque", "refuse"]) {
      const autre = await speakeuse(`Fiche ${statut}`, statut);
      await intervention(autre, `Talk ${statut}`, "2026-07-12");
    }

    const scenes = await getScenesRecentes(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Reste"]);
  });

  it("écarte les propositions du backfill Tremplin et les fiches sans nom", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Sujet pitché", "2026-07-12", { source: "tremplin" });
    const sansNom = await speakeuse(null, "publie");
    await intervention(sansNom, "Anonyme", "2026-07-13");
    await intervention(p, "Reste", "2026-07-11");

    const scenes = await getScenesRecentes(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Reste"]);
  });

  it("plafonne en SQL (le fil demande peu, la table peut être grande)", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    for (let i = 1; i <= 5; i++) await intervention(p, `Talk ${i}`, `2026-07-0${i}`);
    expect(await getScenesRecentes(2, "2026-08-07")).toHaveLength(2);
  });
});

/**
 * L'APERÇU DU PASSÉ de `/agenda`, qui n'est PAS le fil ci-dessus.
 *
 * Le défaut relevé en prod le 18/08 : la page annonçait « 2 interventions
 * depuis 2025. Voici la plus récente. » au-dessus de RIEN. Ses deux dates
 * passées étaient au mois près, `getAnneesArchive` les comptait (il juge sur la
 * fin de période), l'aperçu emprunté au fil les jetait (il exige un jour).
 *
 * La propriété qui tient cet écran : **l'aperçu voit exactement ce que l'archive
 * compte**. C'est elle que ces tests gardent, pas la forme de la requête.
 */
describe("getApercuPasse — l'aperçu du passé de l'agenda", () => {
  it("VOIT les dates au mois et à l'année dont la période est close", async () => {
    const p = await speakeuse("Léa Dubois", "publie", "lea-dubois");
    await intervention(p, "Mois clos", "2025-11");
    await intervention(p, "Année close", "2025");
    await intervention(p, "Exacte", "2026-07-11");

    const scenes = await getApercuPasse(10, "2026-08-07");
    // Le plus récent d'abord, et « récent » se juge sur la FIN de période :
    // 11/07/2026, puis 31/12/2025 (l'année), puis 30/11/2025 (le mois). Une
    // année close finit donc APRÈS un mois de cette même année.
    expect(scenes.map((s) => s.talkTitre)).toEqual([
      "Exacte",
      "Année close",
      "Mois clos",
    ]);
  });

  it("laisse dehors une période NON close, même déjà entamée", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Mois en cours", "2026-08");
    await intervention(p, "Année en cours", "2026");
    await intervention(p, "Passée", "2026-07-11");

    const scenes = await getApercuPasse(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Passée"]);
  });

  it("compte exactement comme l'archive : aucune date d'un côté sans l'autre", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    await intervention(p, "Mois clos", "2025-11");
    await intervention(p, "Exacte", "2026-07-11");
    await intervention(p, "À venir", "2026-09-01");

    const archive = await getAnneesArchive("2026-08-07");
    const total = archive.reduce((n, a) => n + a.nombre, 0);
    expect(await getApercuPasse(50, "2026-08-07")).toHaveLength(total);
  });

  it("respecte son plafond", async () => {
    const p = await speakeuse("Léa Dubois", "publie");
    for (let i = 1; i <= 5; i++) await intervention(p, `Talk ${i}`, `2026-07-0${i}`);
    expect(await getApercuPasse(2, "2026-08-07")).toHaveLength(2);
  });

  it("garde le périmètre public : une fiche non publiée reste invisible", async () => {
    // Date EXACTE des deux côtés : ce test garde le PÉRIMÈTRE, pas la précision
    // des dates (celle-là a ses deux cas au-dessus). Sans ça il tombait aussi
    // quand on cassait la précision, et une garde qui tombe pour deux raisons
    // ne dit plus laquelle a lâché.
    const publiee = await speakeuse("Publiée", "publie");
    await intervention(publiee, "Reste", "2026-07-11");
    const brouillon = await speakeuse("Brouillon", "brouillon");
    await intervention(brouillon, "Cachée", "2026-07-12");

    const scenes = await getApercuPasse(10, "2026-08-07");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Reste"]);
  });
});
