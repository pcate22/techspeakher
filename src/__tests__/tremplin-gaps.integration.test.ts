import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD (pg-mem + `db/schema.sql`), même harnais que
 * `tremplin-db.integration.test.ts` mais ciblant les fonctions Tremplin encore
 * MOCK-seules ou sans couverture SQL réelle. On ne rejoue pas ici les cas déjà
 * présents dans ce fichier voisin : uniquement les angles morts (lectures
 * scopées, poses conditionnelles, ensemencement de phase).
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({
  pool: h.pool,
  // Même sémantique que la vraie withTransaction, sur le pool pg-mem.
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) => {
    const client = await h.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  },
}));

import { importTremplin1 } from "@/lib/tremplin-import";
import {
  createAtelier,
  getAtelierById,
  setAtelierVisio,
  setAtelierPhase,
  getAtelierMembersByEdition,
  getAteliersByEdition,
  createAtelierWithMembers,
} from "@/lib/tremplin-ateliers";
import {
  createRegistration,
  getRegistrationByUser,
  getEditionsForUser,
  getRegistrationsByEdition,
} from "@/lib/tremplin-registrations";
import { getEditionByConfAndYear, createEdition } from "@/lib/tremplin-editions";
import {
  setUserGenreIfUnset,
  setUserGenre,
  getCoachAtelierMembres,
  addCoachToAtelier,
} from "@/lib/tremplin-coachs";
import { getPhotoTagsByEdition, addPhotoWithPersons } from "@/lib/tremplin-photos";
import {
  seedDefaultPhaseMembership,
  getPhaseMembersByEdition,
} from "@/lib/tremplin-registration-phases";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup(); // schéma chargé, base vide
});

beforeEach(() => backup.restore()); // isole chaque test (purge les lignes)

async function newUser(name: string, email: string): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES($1, $2) RETURNING id",
    [name, email],
  );
  return (rows[0] as { id: number }).id;
}

async function genreOf(userId: number): Promise<string | null> {
  const { rows } = await h.pool.query("SELECT genre FROM users WHERE id = $1", [userId]);
  return (rows[0] as { genre: string | null }).genre;
}

async function phasesOf(registrationId: number): Promise<string[]> {
  const { rows } = await h.pool.query(
    "SELECT phase FROM tremplin_registration_phases WHERE registration_id = $1 ORDER BY phase",
    [registrationId],
  );
  return (rows as { phase: string }[]).map((r) => r.phase);
}

const mkAtelier = (titre: string, coachs: string | null = null) => ({
  ordre: 0,
  titre,
  date: null,
  heureDebut: null,
  heureFin: null,
  description: null,
  lienVisio: null,
  coachs,
});

describe("tremplin-ateliers : création, lecture et bascules scopées (réel)", () => {
  it("createAtelier insère avec défauts (phase, coachs) et getAtelierById le relit, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();

    const id = await createAtelier(editionId, {
      ...mkAtelier("Atelier bonus", "Lucile, Rachel"),
      ordre: 42,
      description: "Session facultative",
    });

    const lu = await getAtelierById(id, editionId);
    expect(lu).not.toBeNull();
    expect(lu!.titre).toBe("Atelier bonus");
    expect(lu!.ordre).toBe(42);
    expect(lu!.coachs).toBe("Lucile, Rachel");
    expect(lu!.description).toBe("Session facultative");
    expect(lu!.phase).toBe("cfp_et_pitch"); // défaut du schéma

    // NÉGATIF : le même id, mais lu dans une autre édition, ne matche pas.
    expect(await getAtelierById(id, editionId + 999)).toBeNull();
  });

  it("setAtelierVisio pose puis efface le lien, relu en base, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const a = (await getAteliersByEdition(editionId))[0];

    expect(await setAtelierVisio(a.id, editionId, "https://meet.example/abc")).toBe(true);
    expect((await getAtelierById(a.id, editionId))!.lienVisio).toBe("https://meet.example/abc");

    // null efface le lien.
    expect(await setAtelierVisio(a.id, editionId, null)).toBe(true);
    expect((await getAtelierById(a.id, editionId))!.lienVisio).toBeNull();

    // NÉGATIF : mauvaise édition → false, rien modifié (on repose un lien avant
    // le no-op pour prouver qu'il n'est PAS touché).
    await setAtelierVisio(a.id, editionId, "https://garder.example");
    expect(await setAtelierVisio(a.id, editionId + 999, "https://pirate.example")).toBe(false);
    expect((await getAtelierById(a.id, editionId))!.lienVisio).toBe("https://garder.example");
  });

  it("setAtelierPhase change la phase, relue en base, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const a = (await getAteliersByEdition(editionId))[0];
    expect(a.phase).toBe("cfp_et_pitch"); // état initial du seed

    expect(await setAtelierPhase(a.id, editionId, "montee_sur_scene")).toBe(true);
    expect((await getAtelierById(a.id, editionId))!.phase).toBe("montee_sur_scene");

    // NÉGATIF : mauvaise édition → false, la phase reste celle qu'on vient de poser.
    expect(await setAtelierPhase(a.id, editionId + 999, "cfp_et_pitch")).toBe(false);
    expect((await getAtelierById(a.id, editionId))!.phase).toBe("montee_sur_scene");
  });

  it("getAtelierMembersByEdition regroupe les membres par atelier (anti N+1), scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const a1 = await createAtelierWithMembers(editionId, mkAtelier("Restreint A"), [
      regs[0].id,
      regs[1].id,
    ]);
    const a2 = await createAtelierWithMembers(editionId, mkAtelier("Restreint B"), [regs[2].id]);

    const map = await getAtelierMembersByEdition(editionId);
    expect(map.get(a1)?.map((m) => m.registrationId).sort((x, y) => x - y)).toEqual(
      [regs[0].id, regs[1].id].sort((x, y) => x - y),
    );
    expect(map.get(a2)?.map((m) => m.registrationId)).toEqual([regs[2].id]);

    // NÉGATIF : une édition inconnue n'a aucun membre (map vide, pas d'erreur).
    expect((await getAtelierMembersByEdition(editionId + 999)).size).toBe(0);
  });
});

describe("tremplin-registrations : création, lecture par compte et éditions du compte (réel)", () => {
  it("createRegistration insère une inscription rattachée ET ensemence sa phase d'entrée", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Alix", "alix@exemple.fr");

    const id = await createRegistration(editionId, {
      userId,
      participanteNom: "Alix Martin",
      participanteRole: "Dev",
      participanteLinkedin: null,
      statut: "acceptee",
      finalePresente: null,
      public: true,
    });

    const lu = await getRegistrationByUser(userId, editionId);
    expect(lu?.id).toBe(id);
    expect(lu?.participanteNom).toBe("Alix Martin");
    expect(lu?.public).toBe(true);
    // La phase d'entrée par défaut (cfp_et_pitch) est posée atomiquement.
    expect(await phasesOf(id)).toEqual(["cfp_et_pitch"]);
  });

  it("getRegistrationByUser renvoie l'inscription du compte, null pour une autre édition", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Bea", "bea@exemple.fr");
    await createRegistration(editionId, {
      userId,
      participanteNom: "Bea",
      participanteRole: null,
      participanteLinkedin: null,
      statut: "en_attente",
      finalePresente: null,
    });

    expect((await getRegistrationByUser(userId, editionId))?.userId).toBe(userId);
    // NÉGATIF : bon compte, mauvaise édition → null.
    expect(await getRegistrationByUser(userId, editionId + 999)).toBeNull();
    // NÉGATIF : compte jamais inscrit → null.
    const inconnu = await newUser("Zoe", "zoe@exemple.fr");
    expect(await getRegistrationByUser(inconnu, editionId)).toBeNull();
  });

  it("getEditionsForUser liste les éditions du compte, la plus récente d'abord ; [] sinon", async () => {
    const { editionId } = await importTremplin1(); // Tremplin 2026
    const userId = await newUser("Chloé", "chloe@exemple.fr");

    // Une 2e édition (plus récente) où le même compte est inscrit.
    const recentId = await createEdition({
      nom: "Tremplin 2027",
      annee: 2027,
      confSlug: "devfest-toulouse",
      statut: "ouvert",
      description: null,
      confNom: "DevFest Toulouse",
      confLieu: null,
      confDate: null,
      confLien: null,
      finaleDate: null,
      finaleLieu: null,
    });
    const mk = () => ({
      userId,
      participanteNom: "Chloé",
      participanteRole: null,
      participanteLinkedin: null,
      statut: "acceptee" as const,
      sujet: null,
      finalePresente: null,
    });
    await createRegistration(editionId, mk());
    await createRegistration(recentId, mk());

    const eds = await getEditionsForUser(userId);
    expect(eds.map((e) => e.editionId)).toEqual([recentId, editionId]); // 2027 avant 2026
    expect(eds[0].nom).toBe("Tremplin 2027");

    // NÉGATIF : un compte sans inscription → liste vide.
    const orphelin = await newUser("Personne", "personne@exemple.fr");
    expect(await getEditionsForUser(orphelin)).toEqual([]);
  });
});

describe("tremplin-editions : résolution par (conf, année) (réel)", () => {
  it("getEditionByConfAndYear trouve la bonne édition, null pour un couple inconnu", async () => {
    const { editionId } = await importTremplin1(); // devfest-toulouse / 2026

    const trouvee = await getEditionByConfAndYear("devfest-toulouse", 2026);
    expect(trouvee?.id).toBe(editionId);
    expect(trouvee?.annee).toBe(2026);

    // NÉGATIF : bonne conf, mauvaise année → null.
    expect(await getEditionByConfAndYear("devfest-toulouse", 2099)).toBeNull();
    // NÉGATIF : conf inconnue → null.
    expect(await getEditionByConfAndYear("devoxx-france", 2026)).toBeNull();
  });
});

describe("tremplin-coachs : genre conditionnel et membres des ateliers animés (réel)", () => {
  it("setUserGenreIfUnset pose le genre s'il est vide, mais n'écrase JAMAIS un genre déjà déclaré", async () => {
    // Branche 1 : genre vide → posé.
    const vide = await newUser("Sans genre", "sansgenre@exemple.fr");
    expect(await genreOf(vide)).toBeNull();
    await setUserGenreIfUnset(vide, "femme");
    expect(await genreOf(vide)).toBe("femme");
    // Rappel idempotent : re-poser sur un compte déjà renseigné n'écrase pas.
    await setUserGenreIfUnset(vide, "homme");
    expect(await genreOf(vide)).toBe("femme"); // inchangé

    // Branche 2 : genre déjà déclaré (par la personne) → protégé.
    const declare = await newUser("Déjà genré", "genre@exemple.fr");
    await setUserGenre(declare, "non_binaire");
    await setUserGenreIfUnset(declare, "femme");
    expect(await genreOf(declare)).toBe("non_binaire"); // jamais écrasé
  });

  it("getCoachAtelierMembres ne rend QUE les membres des ateliers du coach, sans e-mail, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const coach = await newUser("Coach Atelier", "coach@exemple.fr");
    const autreCoach = await newUser("Autre Coach", "autre@exemple.fr");

    // Un atelier restreint animé par `coach`, un autre par `autreCoach`.
    const sien = await createAtelierWithMembers(editionId, mkAtelier("Coaching sien"), [
      regs[0].id,
      regs[1].id,
    ]);
    const autre = await createAtelierWithMembers(editionId, mkAtelier("Coaching autre"), [regs[2].id]);
    await addCoachToAtelier(sien, editionId, coach);
    await addCoachToAtelier(autre, editionId, autreCoach);

    const map = await getCoachAtelierMembres(coach, editionId);
    // Seul son atelier figure, avec ses deux membres nommées.
    expect([...map.keys()]).toEqual([sien]);
    expect(map.get(sien)?.sort()).toEqual(
      [regs[0].participanteNom!, regs[1].participanteNom!].sort(),
    );
    expect(JSON.stringify([...map.values()])).not.toMatch(/@/); // jamais d'e-mail

    // NÉGATIF : mauvaise édition → aucune ligne (map vide).
    expect((await getCoachAtelierMembres(coach, editionId + 999)).size).toBe(0);
    // NÉGATIF : un compte sans atelier animé → map vide.
    const personne = await newUser("Ni coach", "ni@exemple.fr");
    expect((await getCoachAtelierMembres(personne, editionId)).size).toBe(0);
  });
});

describe("tremplin-photos : inventaire des tags par édition (réel)", () => {
  it("getPhotoTagsByEdition regroupe les tags par photo (labels + couverture), scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    // Deux inscrites (publiques au seed) taguées sur une photo.
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://x.fr/podium.jpg", legende: "Podium", kind: "podium" },
      [regs[0].id, regs[1].id],
    );

    const map = await getPhotoTagsByEdition(editionId);
    const tags = map.get(photoId)!;
    expect(tags).toHaveLength(2);
    // Tag d'inscription publique → couverte (n'empêche pas la publication).
    expect(tags.every((t) => t.registrationId !== null && t.couverte)).toBe(true);
    expect(tags.map((t) => t.label).sort()).toEqual(
      [regs[0].participanteNom!, regs[1].participanteNom!].sort(),
    );

    // Une taguée retire son consentement → son tag n'est plus couvert.
    await h.pool.query("UPDATE tremplin_registrations SET public = false WHERE id = $1", [regs[0].id]);
    const apres = (await getPhotoTagsByEdition(editionId)).get(photoId)!;
    expect(apres.filter((t) => !t.couverte)).toHaveLength(1);

    // NÉGATIF : édition inconnue → aucun tag (map vide).
    expect((await getPhotoTagsByEdition(editionId + 999)).size).toBe(0);
  });
});

describe("tremplin-registration-phases : ensemencement de l'appartenance de phase (réel)", () => {
  it("seedDefaultPhaseMembership dérive la phase de l'entrée, est idempotent, et mappe finale → phase 1", async () => {
    const { editionId } = await importTremplin1();

    // Inscription nue (sans passer par createRegistration, qui sème déjà) pour
    // isoler le comportement de la fonction.
    const mkBare = async (nom: string): Promise<number> => {
      const { rows } = await h.pool.query(
        `INSERT INTO tremplin_registrations(edition_id, participante_nom, statut)
         VALUES($1, $2, 'en_attente') RETURNING id`,
        [editionId, nom],
      );
      return (rows[0] as { id: number }).id;
    };

    // « montee_sur_scene » → phase 3.
    const scene = await mkBare("Scène");
    await seedDefaultPhaseMembership(scene, "montee_sur_scene");
    expect(await phasesOf(scene)).toEqual(["montee_sur_scene"]);
    // Idempotent : un 2e ensemencement n'ajoute pas de doublon (ON CONFLICT).
    await seedDefaultPhaseMembership(scene, "montee_sur_scene");
    expect(await phasesOf(scene)).toEqual(["montee_sur_scene"]);

    // Entrée par défaut (aucun argument) → phase 1.
    const defaut = await mkBare("Défaut");
    await seedDefaultPhaseMembership(defaut);
    expect(await phasesOf(defaut)).toEqual(["cfp_et_pitch"]);

    // Toute autre entrée (ici « finale ») retombe sur la phase 1 (phase 2 ⊂ 1).
    const finale = await mkBare("Finale");
    await seedDefaultPhaseMembership(finale, "finale");
    expect(await phasesOf(finale)).toEqual(["cfp_et_pitch"]);

    // Cohérence avec la lecture batchée : les trois inscriptions y figurent.
    const parEdition = await getPhaseMembersByEdition(editionId);
    expect(parEdition.get(scene)).toEqual(new Set(["montee_sur_scene"]));
    expect(parEdition.get(defaut)).toEqual(new Set(["cfp_et_pitch"]));
    expect(parEdition.get(finale)).toEqual(new Set(["cfp_et_pitch"]));
  });
});
