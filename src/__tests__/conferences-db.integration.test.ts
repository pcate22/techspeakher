// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD de la référence des conférences (lot 2) : slugify partagé,
 * upsert idempotent des meetups Toulouse Tech Hub (ON CONFLICT meetup_id),
 * création d'asso à la volée, JAMAIS de purge, et seed France rejouable.
 * Vrai Postgres (PGlite) + db/schema.sql, comme les autres tests d'intégration.
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
  slugifyConference,
  upsertMeetupEdition,
  saveConference,
  createConference,
  getConferenceBySlugForAdmin,
  getEditionByIdForAdmin,
  updateEdition,
  deleteEdition,
  updateConference,
  deleteConference,
  saveEdition,
  setEditionActive,
  addMemberEdition,
  buildEditionLibelle,
} from "@/lib/conferences";
import { seedConferences } from "@/lib/conference-seed";
import { listPartnerConferences } from "@/lib/conference-speakers";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);
beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE conference_editions, conferences, users RESTART IDENTITY CASCADE",
  );
});

describe("slugifyConference (jumeau TS de l'expression SQL de la migration 027)", () => {
  it("minuscules, accents translittérés, séparateurs → tirets, bords nettoyés", () => {
    expect(slugifyConference("DevFest Toulouse")).toBe("devfest-toulouse");
    expect(slugifyConference("Forum PHP")).toBe("forum-php");
    expect(slugifyConference("Devoxx France")).toBe("devoxx-france");
    expect(slugifyConference("Été du Code !")).toBe("ete-du-code");
    expect(slugifyConference("BDX I/O")).toBe("bdx-i-o");
  });

  it("produit le MÊME slug que l'expression SQL de la migration (anti-doublon)", async () => {
    for (const nom of ["DevFest Toulouse", "Été du Code !", "BDX I/O", "Tech.Rocks"]) {
      const { rows } = await h.holder.db!.query<{ slug: string }>(
        `SELECT trim(BOTH '-' FROM lower(regexp_replace(
           translate($1, 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                         'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
           '[^a-zA-Z0-9]+', '-', 'g'))) AS slug`,
        [nom],
      );
      expect(slugifyConference(nom)).toBe(rows[0].slug);
    }
  });
});

describe("listPartnerConferences (partenaires dérivés, index public)", () => {
  async function confAvecEdition(slug: string, nom: string, type = "conference") {
    const c = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO conferences (slug, nom, type) VALUES ($1, $2, $3) RETURNING id`,
      [slug, nom, type],
    );
    const e = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO conference_editions (conference_id, type, annee)
         VALUES ($1, 'edition', 2026) RETURNING id`,
      [c.rows[0].id],
    );
    return e.rows[0].id;
  }
  async function speaker(status: string) {
    const u = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO users DEFAULT VALUES RETURNING id`,
    );
    const p = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO speaker_profiles ("userId", status) VALUES ($1, $2) RETURNING id`,
      [u.rows[0].id, status],
    );
    return p.rows[0].id;
  }
  // Le lien canonique talk → édition est talk_occurrences (migration 044) :
  // un talk (identité) + une occurrence rattachée à l'édition.
  async function talkOccurrence(
    profileId: number,
    editionId: number,
    opts: { titre?: string; source?: string } = {},
  ) {
    const t = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO speaker_talks (speaker_profile_id, titre, source)
         VALUES ($1, $2, $3) RETURNING id`,
      [profileId, opts.titre ?? "Mon talk", opts.source ?? "manuel"],
    );
    await h.holder.db!.query(
      `INSERT INTO talk_occurrences (talk_id, speaker_profile_id, edition_id)
         VALUES ($1, $2, $3)`,
      [t.rows[0].id, profileId, editionId],
    );
    return t.rows[0].id;
  }

  it("liste une conf reliée par le talk d'une speakeuse PUBLIÉE, exclut une conf sans lien", async () => {
    const editionLiee = await confAvecEdition("devfest-toulouse", "DevFest Toulouse");
    await confAvecEdition("conf-sans-lien", "Conf Sans Lien");
    const profil = await speaker("publie");
    await talkOccurrence(profil, editionLiee);
    const partners = await listPartnerConferences();
    expect(partners.map((p) => p.slug)).toEqual(["devfest-toulouse"]);
    expect(partners[0].nbEvenements).toBe(1);
  });

  it("ignore le talk d'une speakeuse NON publiée (brouillon)", async () => {
    const edition = await confAvecEdition("conf-brouillon", "Conf Brouillon");
    const profil = await speaker("brouillon");
    await talkOccurrence(profil, edition, { titre: "Talk caché" });
    expect(await listPartnerConferences()).toEqual([]);
  });

  it("ignore un talk de source 'tremplin' (proposition de backfill non confirmée)", async () => {
    const edition = await confAvecEdition("conf-source-tremplin", "Conf Source Tremplin");
    const profil = await speaker("publie");
    await talkOccurrence(profil, edition, { source: "tremplin" });
    expect(await listPartnerConferences()).toEqual([]);
  });

  it("compte aussi une édition de Tremplin et un article publié rattachés", async () => {
    const editionTremplin = await confAvecEdition("gdg-toulouse", "GDG Toulouse", "asso");
    await h.holder.db!.query(
      `INSERT INTO tremplin_editions (nom, annee, conference_edition_id) VALUES ('TSH 2026', 2026, $1)`,
      [editionTremplin],
    );
    const editionArticle = await confAvecEdition("js-and-co", "JS&Co", "asso");
    await h.holder.db!.query(
      `INSERT INTO contenus (type, slug, titre, statut, conference_edition_id)
         VALUES ('publication', 'recit-js-and-co', 'Récit JS&Co', 'publie', $1)`,
      [editionArticle],
    );
    // ORDER BY type, nom : deux assos, triées par nom (GDG avant JS&Co).
    expect((await listPartnerConferences()).map((p) => p.slug)).toEqual([
      "gdg-toulouse",
      "js-and-co",
    ]);
  });

  it("ignore un article NON publié (brouillon) rattaché à une édition", async () => {
    const edition = await confAvecEdition("conf-article-brouillon", "Conf Article Brouillon");
    await h.holder.db!.query(
      `INSERT INTO contenus (type, slug, titre, statut, conference_edition_id)
         VALUES ('publication', 'brouillon-cache', 'Brouillon', 'brouillon', $1)`,
      [edition],
    );
    expect(await listPartnerConferences()).toEqual([]);
  });

  // Une même conf/asso peut avoir plusieurs éditions : nbEvenements ne doit
  // compter QUE les éditions reliées à TSH (pas les autres éditions de la conf).
  async function editionSupp(slug: string, annee: number) {
    const c = await h.holder.db!.query<{ id: number }>(
      `SELECT id FROM conferences WHERE slug = $1`,
      [slug],
    );
    const e = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO conference_editions (conference_id, type, annee)
         VALUES ($1, 'edition', $2) RETURNING id`,
      [c.rows[0].id, annee],
    );
    return e.rows[0].id;
  }

  it("nbEvenements ne compte que les éditions RELIÉES (pas une édition sans lien de la même conf)", async () => {
    const reliee = await confAvecEdition("multi", "Multi", "conference"); // édition 2026
    await editionSupp("multi", 2025); // 2e édition, sans aucun lien TSH
    const profil = await speaker("publie");
    await talkOccurrence(profil, reliee);
    const partners = await listPartnerConferences();
    expect(partners.map((p) => p.slug)).toEqual(["multi"]);
    expect(partners[0].nbEvenements).toBe(1); // 1 seule édition reliée, pas 2
  });

  it("compte plusieurs éditions reliées (=2) sans double-compter une édition reliée deux fois", async () => {
    const e1 = await confAvecEdition("deux", "Deux", "conference"); // 2026
    const e2 = await editionSupp("deux", 2025);
    const profil = await speaker("publie");
    // e1 reliée par un talk (occurrence) ET un article publié (double lien) → 1
    await talkOccurrence(profil, e1);
    await h.holder.db!.query(
      `INSERT INTO contenus (type, slug, titre, statut, conference_edition_id)
         VALUES ('publication', 'recit-e1', 'Récit', 'publie', $1)`,
      [e1],
    );
    // e2 reliée par un Tremplin
    await h.holder.db!.query(
      `INSERT INTO tremplin_editions (nom, annee, conference_edition_id) VALUES ('TSH', 2026, $1)`,
      [e2],
    );
    const partners = await listPartnerConferences();
    expect(partners.map((p) => p.slug)).toEqual(["deux"]);
    expect(partners[0].nbEvenements).toBe(2); // e1 + e2 ; e1 non double-comptée
  });
});

describe("upsertMeetupEdition", () => {
  const meetup = {
    meetupId: "meetup-1",
    titre: "Apéro Web #57",
    groupe: "JS & Co",
    date: "2026-03-12",
    lieu: "La Cantine",
    url: "https://www.meetup.com/js-and-co/events/1/",
  };

  async function editions() {
    const { rows } = await h.holder.db!.query(
      `SELECT e.meetup_id, e.nom, e.type, e.date_debut::text AS date_debut, e.lieu,
              c.nom AS asso, c.type AS asso_type
         FROM conference_editions e JOIN conferences c ON c.id = e.conference_id
        ORDER BY e.meetup_id`,
    );
    return rows;
  }

  it("crée l'asso à la volée (type='asso', Toulouse) et le meetup daté", async () => {
    await upsertMeetupEdition(meetup);
    expect(await editions()).toEqual([
      {
        meetup_id: "meetup-1",
        nom: "Apéro Web #57",
        type: "meetup",
        date_debut: "2026-03-12",
        lieu: "La Cantine",
        asso: "JS & Co",
        asso_type: "asso",
      },
    ]);
  });

  it("idempotent : re-sync = mise à jour (déplacé/renommé corrigé), pas de doublon", async () => {
    await upsertMeetupEdition(meetup);
    await upsertMeetupEdition({
      ...meetup,
      titre: "Apéro Web #57 : CSS moderne",
      date: "2026-03-19",
      lieu: "Chez BPCE",
    });

    const rows = await editions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nom: "Apéro Web #57 : CSS moderne",
      date_debut: "2026-03-19",
      lieu: "Chez BPCE",
    });
  });

  it("réutilise l'asso existante (pas de doublon de conférence)", async () => {
    await upsertMeetupEdition(meetup);
    await upsertMeetupEdition({ ...meetup, meetupId: "meetup-2", titre: "Autre soirée" });
    const { rows } = await h.holder.db!.query(
      `SELECT count(*)::int AS confs FROM conferences`,
    );
    expect(rows[0]).toEqual({ confs: 1 });
  });

  it("un meetup disparu du flux RESTE en base (jamais de purge : des talks y pointent)", async () => {
    await upsertMeetupEdition(meetup);
    // Le run suivant ne contient plus meetup-1 (annulé / passé) : on upserte
    // seulement le nouveau. L'ancien doit survivre.
    await upsertMeetupEdition({ ...meetup, meetupId: "meetup-2", titre: "Suivant" });
    const rows = await editions();
    expect(rows.map((r) => (r as { meetup_id: string }).meetup_id)).toEqual([
      "meetup-1",
      "meetup-2",
    ]);
  });
});

describe("saveConference / saveEdition / setEditionActive (UI orga)", () => {
  it("upsert d'une conférence par slug : les métadonnées orga sont réécrites", async () => {
    await saveConference({ nom: "DevFest Toulouse", type: "conference", ville: null, pays: "France", siteUrl: null });
    const id = await saveConference({
      nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France",
      siteUrl: "https://devfesttoulouse.fr",
    });
    const { rows } = await h.holder.db!.query(
      `SELECT ville, site_url FROM conferences WHERE id = $1`, [id],
    );
    expect(rows[0]).toEqual({ ville: "Toulouse", site_url: "https://devfesttoulouse.fr" });
  });

  it("une édition à endpoint peut être activée ; un doublon d'endpoint est une erreur douce", async () => {
    const confId = await saveConference({ nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null });
    const autre = await saveConference({ nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: null });

    const saved = await saveEdition({
      conferenceId: confId, annee: 2026, dateDebut: "2026-11-19", dateFin: null, ville: null,
      lieu: null, url: null, endpoint: "abc123def", actif: true,
    });
    expect(saved.ok).toBe(true);

    // Même endpoint sur une autre conf → index partiel → erreur douce.
    const doublon = await saveEdition({
      conferenceId: autre, annee: 2026, dateDebut: null, dateFin: null, ville: null,
      lieu: null, url: null, endpoint: "abc123def", actif: true,
    });
    expect(doublon).toEqual({ ok: false, raison: "deja_referencee" });
  });

  it("setEditionActive refuse d'activer sans endpoint (le cron planterait)", async () => {
    const confId = await saveConference({ nom: "Paris Web", type: "conference", ville: "Paris", pays: "France", siteUrl: null });
    const saved = await saveEdition({
      conferenceId: confId, annee: 2026, dateDebut: null, dateFin: null, ville: null,
      lieu: null, url: null, endpoint: null,
    });
    if (!saved.ok) throw new Error("setup");
    expect(await setEditionActive(saved.id, true)).toBe(false);
    expect(await setEditionActive(saved.id, false)).toBe(true);
  });

  it("re-sauver la même (conf, année) met à jour au lieu de dupliquer", async () => {
    const confId = await saveConference({ nom: "MiXiT", type: "conference", ville: "Lyon", pays: "France", siteUrl: null });
    await saveEdition({ conferenceId: confId, annee: 2026, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    await saveEdition({ conferenceId: confId, annee: 2026, dateDebut: "2026-04-24", dateFin: null, ville: null, lieu: null, url: null, endpoint: "mixit26xyz", actif: true });
    const { rows } = await h.holder.db!.query(
      `SELECT count(*)::int AS n, max(endpoint) AS endpoint FROM conference_editions`,
    );
    expect(rows[0]).toEqual({ n: 1, endpoint: "mixit26xyz" });
  });
});

describe("createConference (ajout : INSERT-only, jamais d'écrasement)", () => {
  it("crée une conférence et renvoie son slug", async () => {
    const r = await createConference({ nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://sunny-tech.io" });
    expect(r).toEqual({ ok: true, slug: "sunny-tech" });
  });

  it("un slug déjà pris = erreur douce, la conf existante est INTACTE", async () => {
    await saveConference({ nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://devfesttoulouse.fr" });
    // Doublon involontaire, champs laissés vides : ne doit RIEN écraser.
    const r = await createConference({ nom: "DevFest Toulouse", type: "asso", ville: null, pays: null, siteUrl: null });
    expect(r).toEqual({ ok: false, raison: "deja_referencee" });
    const { rows } = await h.holder.db!.query(
      `SELECT type, ville, site_url FROM conferences WHERE slug = 'devfest-toulouse'`,
    );
    expect(rows[0]).toEqual({ type: "conference", ville: "Toulouse", site_url: "https://devfesttoulouse.fr" });
  });
});

describe("édition par item (page éditable dédiée)", () => {
  it("getEditionByIdForAdmin renvoie l'édition + l'identité de sa conf", async () => {
    const confId = await saveConference({ nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: null });
    const saved = await saveEdition({ conferenceId: confId, annee: 2026, dateDebut: "2026-06-25", dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    if (!saved.ok) throw new Error("setup");
    const ed = await getEditionByIdForAdmin(saved.id);
    expect(ed?.annee).toBe(2026);
    expect(ed?.confSlug).toBe("sunny-tech");
    expect(ed?.confNom).toBe("Sunny Tech");
    expect(await getEditionByIdForAdmin(99999)).toBeNull();
  });

  // La fenêtre multi-jours est LA donnée qui décide ce qu'une édition lègue à
  // la date d'un talk (dateLegueeParEdition) : elle doit survivre à l'aller-
  // retour en base par les DEUX écritures, et la base refuse une fenêtre
  // incohérente quel que soit le chemin (CHECK, migration 069).
  it("date_fin persiste à la création ET à la correction ; une fenêtre à l'envers est refusée par la base", async () => {
    const confId = await saveConference({ nom: "Devoxx Belgium", type: "conference", ville: "Anvers", pays: "Belgique", siteUrl: null });
    const saved = await saveEdition({ conferenceId: confId, annee: 2025, dateDebut: "2025-10-06", dateFin: "2025-10-09", ville: null, lieu: null, url: null, endpoint: null });
    if (!saved.ok) throw new Error("setup");
    expect((await getEditionByIdForAdmin(saved.id))?.dateFin).toBe("2025-10-09");

    const r = await updateEdition(saved.id, { annee: 2025, dateDebut: "2025-10-06", dateFin: "2025-10-10", ville: null, lieu: null, url: null, endpoint: null });
    expect(r).toEqual({ ok: true, id: saved.id });
    expect((await getEditionByIdForAdmin(saved.id))?.dateFin).toBe("2025-10-10");

    // Le CHECK en base attrape ce qu'un futur writer oublierait de valider.
    await expect(
      h.holder.db!.query(
        `UPDATE conference_editions SET date_fin = '2025-10-01' WHERE id = ${saved.id}`,
      ),
    ).rejects.toThrow(/fenetre/);
  });

  it("updateEdition corrige les champs d'UNE édition (année, endpoint)", async () => {
    const confId = await saveConference({ nom: "MiXiT", type: "conference", ville: "Lyon", pays: "France", siteUrl: null });
    const saved = await saveEdition({ conferenceId: confId, annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    if (!saved.ok) throw new Error("setup");
    const r = await updateEdition(saved.id, { annee: 2026, dateDebut: "2026-04-24", dateFin: null, ville: "Lyon", lieu: null, url: null, endpoint: "mixit26xyz" });
    expect(r).toEqual({ ok: true, id: saved.id });
    const ed = await getEditionByIdForAdmin(saved.id);
    expect(ed?.annee).toBe(2026);
    expect(ed?.endpoint).toBe("mixit26xyz");
  });

  it("updateEdition ne relance PAS une moisson coupée (l'interrupteur en est seul maître)", async () => {
    const confId = await saveConference({ nom: "SunnyTech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: null });
    // Édition avec endpoint, moisson activée puis COUPÉE par l'orga.
    const saved = await saveEdition({ conferenceId: confId, annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: "sunny25abc", actif: true });
    if (!saved.ok) throw new Error("setup");
    await setEditionActive(saved.id, false);
    // Corriger un autre champ (la ville) ne doit PAS rallumer la moisson.
    const r = await updateEdition(saved.id, { annee: 2025, dateDebut: null, dateFin: null, ville: "Sète", lieu: null, url: null, endpoint: "sunny25abc" });
    expect(r.ok).toBe(true);
    const ed = await getEditionByIdForAdmin(saved.id);
    expect(ed?.ville).toBe("Sète");
    expect(ed?.actif).toBe(false);
  });

  it("updateEdition : retirer l'endpoint coupe la moisson (le CHECK l'exige)", async () => {
    const confId = await saveConference({ nom: "Devoxx", type: "conference", ville: "Paris", pays: "France", siteUrl: null });
    const saved = await saveEdition({ conferenceId: confId, annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: "devoxx25abc", actif: true });
    if (!saved.ok) throw new Error("setup");
    const r = await updateEdition(saved.id, { annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    expect(r.ok).toBe(true);
    const ed = await getEditionByIdForAdmin(saved.id);
    expect(ed?.endpoint).toBeNull();
    expect(ed?.actif).toBe(false);
  });

  it("updateEdition : collision (conf, année) → erreur douce, rien écrasé", async () => {
    const confId = await saveConference({ nom: "BreizhCamp", type: "conference", ville: "Rennes", pays: "France", siteUrl: null });
    await saveEdition({ conferenceId: confId, annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    const b = await saveEdition({ conferenceId: confId, annee: 2026, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    if (!b.ok) throw new Error("setup");
    // Renommer 2026 → 2025 (déjà pris) : refus.
    const r = await updateEdition(b.id, { annee: 2025, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    expect(r).toEqual({ ok: false, raison: "deja_referencee" });
  });

  it("deleteEdition supprime l'édition ; un talk relié passe à edition_id NULL (SET NULL)", async () => {
    const confId = await saveConference({ nom: "Volcamp", type: "conference", ville: "Clermont-Ferrand", pays: "France", siteUrl: null });
    const saved = await saveEdition({ conferenceId: confId, annee: 2026, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    if (!saved.ok) throw new Error("setup");
    // Un profil + un talk relié à l'édition.
    await h.holder.db!.query(`INSERT INTO users (id, email) VALUES (1, 'a@b.c') ON CONFLICT DO NOTHING`);
    await h.holder.db!.query(`INSERT INTO speaker_profiles (id, "userId") VALUES (1, 1) ON CONFLICT DO NOTHING`);
    await h.holder.db!.query(
      `INSERT INTO speaker_talks (speaker_profile_id, titre, edition_id) VALUES (1, 'T', $1)`,
      [saved.id],
    );
    await deleteEdition(saved.id);
    expect(await getEditionByIdForAdmin(saved.id)).toBeNull();
    const { rows } = await h.holder.db!.query(`SELECT edition_id FROM speaker_talks WHERE titre = 'T'`);
    expect(rows[0]).toEqual({ edition_id: null });
  });
});

describe("getConferenceBySlugForAdmin (page dédiée d'une conf)", () => {
  it("renvoie la conf et ses éditions triées (récentes d'abord)", async () => {
    const id = await saveConference({ nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://sunny-tech.io" });
    await saveEdition({ conferenceId: id, annee: 2025, dateDebut: "2025-06-26", dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    await saveEdition({ conferenceId: id, annee: 2026, dateDebut: "2026-06-25", dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    const conf = await getConferenceBySlugForAdmin("sunny-tech");
    expect(conf?.nom).toBe("Sunny Tech");
    expect(conf?.editions.map((e) => e.annee)).toEqual([2026, 2025]);
  });

  it("renvoie null pour un slug inconnu (→ 404 côté page)", async () => {
    expect(await getConferenceBySlugForAdmin("inexistante")).toBeNull();
  });
});

describe("updateConference (correction par id, renommage inclus)", () => {
  it("renomme (slug redérivé) et réécrit les métadonnées", async () => {
    const id = await saveConference({ nom: "Flupa UX Days", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://flupa.eu" });
    const r = await updateConference(id, { nom: "UX Days", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.uxdays.eu" });
    expect(r).toEqual({ ok: true });
    const { rows } = await h.holder.db!.query(
      `SELECT slug, nom, site_url FROM conferences WHERE id = $1`, [id],
    );
    expect(rows[0]).toEqual({ slug: "ux-days", nom: "UX Days", site_url: "https://www.uxdays.eu" });
  });

  it("renommer vers un nom déjà pris (slug en collision) = erreur douce, rien écrasé", async () => {
    const a = await saveConference({ nom: "UX Days", type: "conference", ville: "Paris", pays: "France", siteUrl: null });
    const b = await saveConference({ nom: "Paris Web", type: "conference", ville: "Paris", pays: "France", siteUrl: null });
    const r = await updateConference(b, { nom: "UX Days", type: "conference", ville: "Paris", pays: "France", siteUrl: null });
    expect(r).toEqual({ ok: false, raison: "deja_referencee" });
    // b garde son identité, a est intacte.
    const { rows } = await h.holder.db!.query(
      `SELECT nom, slug FROM conferences ORDER BY id`,
    );
    expect(rows).toEqual([
      { nom: "UX Days", slug: "ux-days" },
      { nom: "Paris Web", slug: "paris-web" },
    ]);
    expect(a).toBeGreaterThan(0);
  });
});

describe("deleteConference (garde-fou : refus si des événements existent)", () => {
  it("supprime une conférence sans événement", async () => {
    const id = await saveConference({ nom: "Doublon", type: "conference", ville: null, pays: "France", siteUrl: null });
    expect(await deleteConference(id)).toEqual({ ok: true, nom: "Doublon" });
    const { rows } = await h.holder.db!.query(`SELECT count(*)::int AS n FROM conferences WHERE id = $1`, [id]);
    expect(rows[0]).toEqual({ n: 0 });
  });

  it("refuse de supprimer une conférence qui a une édition (rien effacé)", async () => {
    const id = await saveConference({ nom: "MiXiT", type: "conference", ville: "Lyon", pays: "France", siteUrl: null });
    await saveEdition({ conferenceId: id, annee: 2026, dateDebut: null, dateFin: null, ville: null, lieu: null, url: null, endpoint: null });
    expect(await deleteConference(id)).toEqual({ ok: false, raison: "a_des_editions" });
    const { rows } = await h.holder.db!.query(`SELECT count(*)::int AS n FROM conferences WHERE id = $1`, [id]);
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("id inexistant → introuvable (pas d'erreur)", async () => {
    expect(await deleteConference(99999)).toEqual({ ok: false, raison: "introuvable" });
  });
});

describe("addMemberEdition (ajout communautaire, actif direct)", () => {
  async function newUser(): Promise<number> {
    const { rows } = await h.holder.db!.query(
      `INSERT INTO users (name, email) VALUES ('Clara', 'c@ex.fr') RETURNING id`,
    );
    return (rows[0] as { id: number }).id;
  }

  it("crée conf + édition ACTIVE avec propose_par quand un endpoint est fourni", async () => {
    const userId = await newUser();
    const r = await addMemberEdition({
      userId, nomConference: "Sunny Tech", annee: 2026,
      ville: "Montpellier", url: "https://sunny-tech.io", endpoint: "abc123def",
    });
    expect(r.ok).toBe(true);
    const { rows } = await h.holder.db!.query(
      `SELECT e.actif, e.propose_par, e.source, c.nom
         FROM conference_editions e JOIN conferences c ON c.id = e.conference_id`,
    );
    expect(rows[0]).toEqual({
      actif: true, propose_par: userId, source: "sessionize", nom: "Sunny Tech",
    });
  });

  it("sans endpoint : référencée mais NON moissonnée (actif = false, source NULL)", async () => {
    const userId = await newUser();
    await addMemberEdition({
      userId, nomConference: "Agile Tour Toulouse", annee: null,
      ville: "Toulouse", url: null, endpoint: null,
    });
    const { rows } = await h.holder.db!.query(
      `SELECT actif, source, endpoint FROM conference_editions`,
    );
    expect(rows[0]).toEqual({ actif: false, source: null, endpoint: null });
  });

  it("ne réécrit pas une conférence existante (slug identique)", async () => {
    const userId = await newUser();
    await saveConference({ nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://sunny-tech.io" });
    await addMemberEdition({
      userId, nomConference: "Sunny Tech", annee: 2026, ville: null, url: null, endpoint: null,
    });
    const { rows } = await h.holder.db!.query(
      `SELECT count(*)::int AS n FROM conferences`,
    );
    expect(rows[0]).toEqual({ n: 1 });
  });
});

describe("buildEditionLibelle (point de vérité unique du libellé)", () => {
  it("édition de conf : nom + année (identique à la recomposition SQL du cron)", () => {
    expect(
      buildEditionLibelle({ confNom: "DevFest Toulouse", type: "edition", nom: null, annee: 2026, dateDebut: null }),
    ).toBe("DevFest Toulouse 2026");
    expect(
      buildEditionLibelle({ confNom: "NCL Days", type: "edition", nom: null, annee: null, dateDebut: null }),
    ).toBe("NCL Days");
  });

  it("meetup : asso · titre · date française, sans cadratin", () => {
    expect(
      buildEditionLibelle({
        confNom: "GDG Toulouse", type: "meetup", nom: "Apéro Web #57", annee: null, dateDebut: "2026-03-12",
      }),
    ).toBe("GDG Toulouse · Apéro Web #57 · 12 mars 2026");
    expect(
      buildEditionLibelle({
        confNom: "GDG Toulouse", type: "meetup", nom: null, annee: null, dateDebut: null,
      }),
    ).toBe("GDG Toulouse");
  });
});

describe("seedConferences (amorçage France, rejouable)", () => {
  it("insère le catalogue puis est un no-op au rejeu (ON CONFLICT slug)", async () => {
    const inserted = await seedConferences();
    expect(inserted).toBeGreaterThan(20);

    const again = await seedConferences();
    expect(again).toBe(0);

    const { rows } = await h.holder.db!.query(
      `SELECT count(*)::int AS n FROM conferences`,
    );
    expect(rows[0]).toEqual({ n: inserted });
  });

  it("ne touche pas une conférence existante (métadonnées orga conservées)", async () => {
    await seedConferences();
    await h.holder.db!.query(
      `UPDATE conferences SET nom = 'DevFest Toulouse (édité par une orga)'
        WHERE slug = 'devfest-toulouse'`,
    );
    await seedConferences();
    const { rows } = await h.holder.db!.query(
      `SELECT nom FROM conferences WHERE slug = 'devfest-toulouse'`,
    );
    expect(rows[0]).toEqual({ nom: "DevFest Toulouse (édité par une orga)" });
  });
});

describe("addMemberEdition — INSERT-only (une membre n'écrase JAMAIS la curation orga)", () => {
  it("même (conférence, année) déjà référencée par l'orga : erreur douce, ligne intacte", async () => {
    const { rows } = await h.holder.db!.query(
      `INSERT INTO users (name, email) VALUES ('Clara', 'sec@ex.fr') RETURNING id`,
    );
    const userId = (rows[0] as { id: number }).id;

    // L'orga cure l'édition officielle (endpoint actif, date, url).
    const confId = await saveConference({ nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null });
    await saveEdition({
      conferenceId: confId, annee: 2026, dateDebut: "2026-11-19", dateFin: null, ville: null,
      lieu: null, url: "https://devfesttoulouse.fr", endpoint: "officiel1", actif: true,
    });

    // Une membre tente le même couple (nom → même slug, même année), avec SON
    // endpoint (détournement) puis sans endpoint (vandalisme/désactivation).
    const detournement = await addMemberEdition({
      userId, nomConference: "DevFest Toulouse", annee: 2026,
      ville: null, url: "https://phishing.example", endpoint: "hostile99",
    });
    expect(detournement).toEqual({ ok: false, raison: "deja_referencee" });

    const vandalisme = await addMemberEdition({
      userId, nomConference: "DevFest Toulouse", annee: 2026,
      ville: null, url: null, endpoint: null,
    });
    expect(vandalisme).toEqual({ ok: false, raison: "deja_referencee" });

    // La curation orga est INTACTE.
    const etat = await h.holder.db!.query(
      `SELECT endpoint, actif, url, date_debut::text AS date_debut, propose_par
         FROM conference_editions`,
    );
    expect(etat.rows).toEqual([
      {
        endpoint: "officiel1",
        actif: true,
        url: "https://devfesttoulouse.fr",
        date_debut: "2026-11-19",
        propose_par: null,
      },
    ]);
  });
});
