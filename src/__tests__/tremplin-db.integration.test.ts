import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD : on exécute le SQL réel contre un Postgres
 * **en mémoire** (`pg-mem`) — pas de mock, pas de service, tourne en CI.
 * On charge `db/schema.sql` puis on fait tourner les vraies fonctions d'accès.
 * C'est ce niveau qui attrape ce que le pool mické ne voit pas : tables,
 * colonnes, contraintes (CHECK/UNIQUE), cascade, transactions.
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
  getEditionById,
  getEditionsByConfSlug,
  createEdition,
  updateEdition,
  setEditionStatut,
  deleteEdition,
  listEditions,
  listConferences,
} from "@/lib/tremplin-editions";
import {
  getAteliersByEdition,
  createAtelierWithMembers,
  getAtelierMembers,
  setAtelierMembers,
  updateAtelierInfos,
} from "@/lib/tremplin-ateliers";
import {
  getRegistrationsByEdition,
  attachUserToRegistration,
  setRegistrationVisibility,
  setOwnRegistrationVisibility,
  setOwnRegistrationTalk,
  getRegistrationTalkId,
  updateRegistrationDetails,
  getConsentLog,
  registerUserToEdition,
  setRegistrationFinale,
  deleteRegistration,
  rangLabel,
} from "@/lib/tremplin-registrations";
import { addTalk } from "@/lib/talks";
import {
  addPhotoWithPersons,
  deletePhoto,
  setPhotoPersons,
  getPhotoPersons,
  getPhotoPersonsByEdition,
  getPhotosByEdition,
  getPublicPhotos,
} from "@/lib/tremplin-photos";
import {
  addDocument,
  deleteDocument,
  getSharedDocuments,
  getSharedDocumentsVisiblesPour,
  getMyDocuments,
  getDocumentsByEdition,
} from "@/lib/tremplin-documents";
import { getOrCreateUserByEmail } from "@/lib/users";
import {
  addCoachToAtelier,
  removeCoachFromAtelier,
  estCoachRattache,
  getCoachsByAtelier,
  getCoachsByEdition,
  addCoachToRegistration,
  removeCoachFromRegistration,
  getCoachsByRegistration,
  setUserGenre,
  markUserAsCoach,
  getCoachEditions,
  getCoachAteliers,
  getCoachCoachees,
  getCoachDocuments,
  addDocumentAsCoach,
  deleteOwnDocument,
} from "@/lib/tremplin-coachs";
import { getPublicEdition } from "@/lib/tremplin-public";
import { duplicateEdition } from "@/lib/tremplin-duplicate";
import { addJury, getJuryByEdition } from "@/lib/tremplin-jury";
import {
  addRecompense,
  updateRecompense,
  deleteRecompense,
  getRecompensesByEdition,
  getRecompensesByRegistration,
  setRecompenseBeneficiaire,
  setRecompenseSuivi,
} from "@/lib/tremplin-recompenses";
import { effacerCompteEnBase, ensureProfileId } from "@/lib/profiles";

let backup: { restore: () => void };

beforeAll(() => {
  // pg-mem ne connaît pas `btrim` (Postgres, oui) : sans elle, la lecture du
  // récit rattaché à une conférence échouerait ici pour une raison qui n'existe
  // pas en prod. On la déclare plutôt que d'affaiblir la requête.
  h.mem.public.registerFunction({
    name: "btrim",
    args: ["text"],
    returns: "text",
    implementation: (s: string | null) => (s == null ? null : s.trim()),
  });
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

/** DTO public en écartant le tombstone (jamais attendu dans ces tests). */
async function publicDto(confSlug: string, annee: number) {
  const pub = await getPublicEdition(confSlug, annee);
  if (pub === "deleted") throw new Error("tombstone inattendu dans ce test");
  return pub; // PublicEdition | null
}

describe("import Tremplin 1 (réel)", () => {
  it("crée édition + 5 ateliers + 8 finalistes, et est idempotent", async () => {
    const r1 = await importTremplin1();
    expect(r1.created).toBe(true);

    const edition = await getEditionById(r1.editionId);
    expect(edition?.statut).toBe("en_cours"); // coachings post-soirée jusqu'au DevFest
    expect((await getAteliersByEdition(r1.editionId)).length).toBe(5);
    expect((await getRegistrationsByEdition(r1.editionId)).length).toBe(8);

    const r2 = await importTremplin1();
    expect(r2).toEqual({ created: false, editionId: r1.editionId, ateliersAjoutes: 0 });
    expect((await getAteliersByEdition(r1.editionId)).length).toBe(5); // pas de doublon d'atelier
    expect((await getRegistrationsByEdition(r1.editionId)).length).toBe(8); // pas de doublon
  });
});

describe("réimport idempotent par entité (réel)", () => {
  it("édition présente SANS ses ateliers : réimporter ajoute les 5 manquants, inscriptions intactes", async () => {
    const r1 = await importTremplin1();
    expect(r1.created).toBe(true);
    const { editionId } = r1;
    const regsAvant = (await getRegistrationsByEdition(editionId)).length;

    // Simule la prod : les ateliers ont été perdus (jamais créés / supprimés).
    await h.pool.query("DELETE FROM tremplin_ateliers WHERE edition_id = $1", [editionId]);
    expect((await getAteliersByEdition(editionId)).length).toBe(0);

    // Réimporter NE recrée pas l'édition, mais COMPLÈTE les ateliers manquants,
    // sans dupliquer ni toucher aux inscriptions déjà saisies par l'orga.
    const r2 = await importTremplin1();
    expect(r2).toMatchObject({ created: false, editionId, ateliersAjoutes: 5 });
    expect((await getAteliersByEdition(editionId)).length).toBe(5);
    expect((await getRegistrationsByEdition(editionId)).length).toBe(regsAvant);

    // Idempotent : un 3ᵉ import n'ajoute plus rien (titres déjà présents).
    const r3 = await importTremplin1();
    expect(r3.ateliersAjoutes).toBe(0);
    expect((await getAteliersByEdition(editionId)).length).toBe(5);
  });
});

describe("confidentialité des documents (réel)", () => {
  it("une participante ne voit QUE ses documents privés", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Sandrine", "sandrine@example.fr");
    const regs = await getRegistrationsByEdition(editionId);
    await attachUserToRegistration(regs[0].id, userId, editionId);

    await addDocument(editionId, {
      atelierId: null, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Support partagé", lien: "https://x.fr", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: null, registrationId: regs[0].id, auteurId: null,
      type: "feedback_jury", titre: "Retour A", lien: "https://a.fr", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: null, registrationId: regs[1].id, auteurId: null,
      type: "feedback_jury", titre: "Retour B (autre)", lien: "https://b.fr", contenu: null,
    });

    expect((await getSharedDocuments(editionId)).map((d) => d.titre)).toEqual([
      "Support partagé",
    ]);
    const mine = await getMyDocuments(userId, editionId);
    expect(mine.map((d) => d.titre)).toEqual(["Retour A"]); // jamais "Retour B (autre)"
  });
});

describe("rattachement scopé (réel)", () => {
  it("attache une fois (true), puis refuse un 2e compte sur la même inscription (false)", async () => {
    const { editionId } = await importTremplin1();
    const userA = await newUser("A", "a@example.fr");
    const userB = await newUser("B", "b@example.fr");
    const regs = await getRegistrationsByEdition(editionId);

    expect(await attachUserToRegistration(regs[0].id, userA, editionId)).toBe("attached");
    // Inscription déjà rattachée à A → 0 ligne, pas d'erreur, pas de faux succès.
    expect(await attachUserToRegistration(regs[0].id, userB, editionId)).toBe("occupee");

    const after = await getRegistrationsByEdition(editionId);
    expect(after.find((r) => r.id === regs[0].id)?.userId).toBe(userA);
  });

  it("ne rattache pas une inscription d'une autre édition (false)", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("C", "c@example.fr");
    const regs = await getRegistrationsByEdition(editionId);
    // editionId + 999 n'existe pas → scope ne matche pas → 'occupee'.
    expect(await attachUserToRegistration(regs[0].id, userId, editionId + 999)).toBe("occupee");
    expect((await getRegistrationsByEdition(editionId)).find((r) => r.id === regs[0].id)?.userId).toBeNull();
  });
});

describe("pré-création de compte (réel)", () => {
  it("crée le compte si l'e-mail est inconnu, puis le retrouve (insensible à la casse)", async () => {
    const a = await getOrCreateUserByEmail("Nouvelle@Example.fr");
    expect(a.created).toBe(true);
    expect(a.user.id).toBeTruthy();

    const b = await getOrCreateUserByEmail("nouvelle@example.fr");
    expect(b.created).toBe(false);
    expect(b.user.id).toBe(a.user.id); // même compte, pas de doublon
  });

  it("l'index unique rejette un doublon d'e-mail à la casse près", async () => {
    await h.pool.query("INSERT INTO users(email) VALUES('dup@x.fr')");
    await expect(
      h.pool.query("INSERT INTO users(email) VALUES('DUP@x.fr')"),
    ).rejects.toThrow();
  });
});

describe("portée des documents scopée (réel)", () => {
  it("refuse un document pointant une inscription absente de l'édition", async () => {
    const { editionId } = await importTremplin1();
    await expect(
      addDocument(editionId, {
        atelierId: null, registrationId: 999999, auteurId: null,
        type: "feedback_jury", titre: "mal routé", lien: "https://x.fr", contenu: null,
      }),
    ).rejects.toThrow();
    // Rien n'a été inséré.
    expect((await getSharedDocuments(editionId)).length).toBe(0);
  });
});

describe("DTO public d'édition (réel)", () => {
  it("compteurs anonymes + galerie consentie + palmarès, par (conf, année)", async () => {
    await importTremplin1();
    const pub = await publicDto("devfest-toulouse", 2026);
    expect(pub).not.toBeNull();
    // Les compteurs publiés, exhaustivement : l'égalité stricte est là pour
    // qu'un agrégat NEUF soit un choix, jamais un effet de bord — chacun se
    // recoupe avec les noms publiés et mérite d'être pesé (cf. la cohorte de la
    // phase 3, ajoutée après arbitrage, dans docs/conception-deux-temps-edition-publique.md).
    expect(pub!.counts).toEqual({
      inscrites: 8, finalistes: 8, gagnantes: 3, accompagnees: 0,
    });
    expect(pub!.ateliers).toHaveLength(5);
    expect(pub!.finalistes).toHaveLength(8); // toutes publiques au seed
    expect(pub!.palmares).toHaveLength(3);
    // Palmarès ordonné (rang) ET nominatif (gagnantes consententes).
    expect(pub!.palmares.map((p) => p.recompense)).toEqual(["1ᵉʳ prix", "2ᵉ prix", "3ᵉ prix"]);
    expect(pub!.palmares.map((p) => p.nom)).toEqual([
      "Sarah Lemoine",
      "Alice Moreau",
      "Nina Rousseau",
    ]);
    // Le titre du talk est conservé au palmarès (comme l'ancienne page).
    expect(pub!.palmares[0].sujet).toBeTruthy();

    // ANONYMAT : le DTO public ne sérialise AUCUN champ privé.
    const json = JSON.stringify(pub);
    expect(json).not.toMatch(/userId|consent|@/i);
    expect(Object.keys(pub!.finalistes[0]).sort()).toEqual([
      "bio", "linkedin", "nom", "photoUrl", "recompenses", "role", "siteWeb", "sujet",
    ]);
    expect(Object.keys(pub!.palmares[0]).sort()).toEqual(["nom", "recompense", "sujet"]);
  });

  it("classer FIGE le titre du talk pitché dans titre_palmares (l'archive survit au retrait du talk)", async () => {
    const editionId = await createEdition({
      nom: "Archive 2031", annee: 2031, confSlug: "archive-conf",
      statut: "preparation", description: null, confNom: "ArchConf", confLieu: "France",
      confDate: null, confLien: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null, conferenceEditionId: null,
    });
    const userId = await newUser("Gaby", "gaby@exemple.fr");
    await registerUserToEdition(editionId, userId, "cfp_et_pitch");
    const profileId = await ensureProfileId(userId);
    const talkId = await addTalk(profileId, {
      titre: "Mon talk primé", type: "Conférence", description: null,
    });
    const reg = (await getRegistrationsByEdition(editionId))[0];
    // Elle pitche son talk, puis on la classe 1re → le titre est FIGÉ dans l'archive.
    expect(await setOwnRegistrationTalk(userId, editionId, talkId)).toBe(true);
    expect(await updateRegistrationDetails(reg.id, editionId, { classement: 1 })).toBe(true);
    const archive = async () =>
      (
        await h.pool.query("SELECT titre_palmares FROM tremplin_registrations WHERE id = $1", [reg.id])
      ).rows[0] as { titre_palmares: string | null };
    expect((await archive()).titre_palmares).toBe("Mon talk primé");

    // Le talk part (« Aucun ») : l'archive du palmarès reste (inscription classée).
    expect(await setOwnRegistrationTalk(userId, editionId, null)).toBe(true);
    expect((await archive()).titre_palmares).toBe("Mon talk primé");

    // L'archive est exposée à l'admin (fiche/liste) : sans talk, titrePalmares
    // sert de repli d'affichage à la place de « À définir ».
    const lu = (await getRegistrationsByEdition(editionId)).find((x) => x.id === reg.id);
    expect(lu?.talkTitre).toBeNull();
    expect(lu?.titrePalmares).toBe("Mon talk primé");
  });

  it("retrait de consentement d'une GAGNANTE : hors galerie + palmarès anonymisé, rang et compteurs conservés", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const gagnante = regs.find((r) => r.classement != null); // cible explicite (pas regs[0])
    expect(gagnante).toBeTruthy();
    await h.pool.query("UPDATE tremplin_registrations SET public = false WHERE id = $1", [gagnante!.id]);

    const pub = await publicDto("devfest-toulouse", 2026);
    expect(pub!.counts.finalistes).toBe(8); // compteur inchangé (anonyme)
    expect(pub!.counts.gagnantes).toBe(3); // récompenses inchangées
    expect(pub!.finalistes).toHaveLength(7); // sortie de la galerie nominative
    expect(pub!.finalistes.map((f) => f.nom)).not.toContain(gagnante!.participanteNom);
    // Son rang reste au palmarès, mais SANS nom.
    expect(pub!.palmares).toHaveLength(3);
    expect(pub!.palmares.filter((p) => p.nom === null)).toHaveLength(1);
  });

  it("retrait de consentement d'une FINALISTE non récompensée : hors galerie, mais comptée", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    // Une finaliste SANS récompense (≠ le cas gagnante déjà couvert) qui retire son nom.
    const finaliste = regs.find((r) => r.classement == null);
    expect(finaliste).toBeTruthy();
    await h.pool.query("UPDATE tremplin_registrations SET public = false WHERE id = $1", [finaliste!.id]);

    const pub = await publicDto("devfest-toulouse", 2026);
    expect(pub!.counts.finalistes).toBe(8); // compteur anonyme inchangé
    expect(pub!.finalistes).toHaveLength(7); // une de moins dans la galerie nominative
    expect(pub!.finalistes.map((f) => f.nom)).not.toContain(finaliste!.participanteNom);
  });

  it("photos de groupe : publiées seulement si toutes les personnes consentent", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    // Photo ambiance sans personne taguée → publiable.
    await h.pool.query(
      "INSERT INTO tremplin_photos(edition_id, url, kind) VALUES($1, 'https://x/ambiance.jpg', 'soiree')",
      [editionId],
    );
    // Photo podium taguant 2 personnes (toutes publiques au seed) → publiable.
    const { rows: p2 } = await h.pool.query(
      "INSERT INTO tremplin_photos(edition_id, url, kind) VALUES($1, 'https://x/podium.jpg', 'podium') RETURNING id",
      [editionId],
    );
    const podiumId = (p2[0] as { id: number }).id;
    await h.pool.query(
      "INSERT INTO tremplin_photo_personnes(photo_id, registration_id) VALUES($1,$2),($1,$3)",
      [podiumId, regs[0].id, regs[1].id],
    );

    expect((await publicDto("devfest-toulouse", 2026))!.photos).toHaveLength(2);

    // Une personne du podium retire son consentement → la photo disparaît.
    await h.pool.query("UPDATE tremplin_registrations SET public = false WHERE id = $1", [regs[0].id]);
    const after = await publicDto("devfest-toulouse", 2026);
    expect(after!.photos.map((p) => p.kind)).toEqual(["soiree"]); // podium masqué
  });

  it("droit à l'image : une personne taguée NON finaliste non consentante bloque la photo", async () => {
    const { editionId } = await importTremplin1();
    // Inscrite présente sur la photo mais pas finaliste (ex. dans le cadre), non publique.
    const { rows: r } = await h.pool.query(
      `INSERT INTO tremplin_registrations(edition_id, participante_nom, statut, finale_presente, "public")
       VALUES($1, 'Personne dans le cadre', 'en_attente', false, false) RETURNING id`,
      [editionId],
    );
    const regId = (r[0] as { id: number }).id;
    const { rows: p } = await h.pool.query(
      "INSERT INTO tremplin_photos(edition_id, url, kind) VALUES($1,'https://x/cadre.jpg','soiree') RETURNING id",
      [editionId],
    );
    await h.pool.query(
      "INSERT INTO tremplin_photo_personnes(photo_id, registration_id) VALUES($1,$2)",
      [(p[0] as { id: number }).id, regId],
    );

    // La photo est masquée bien que la personne taguée ne soit pas une finaliste.
    expect((await publicDto("devfest-toulouse", 2026))!.photos).toHaveLength(0);
  });

  it("édition inconnue → null", async () => {
    expect(await publicDto("devoxx", 2099)).toBeNull();
  });
});

describe("contrôles admin visibilité / détails publics (réel)", () => {
  async function consentAt(id: number): Promise<string | null> {
    const { rows } = await h.pool.query(
      "SELECT public_consent_at FROM tremplin_registrations WHERE id = $1",
      [id],
    );
    return (rows[0] as { public_consent_at: string | null }).public_consent_at;
  }

  it("masquer puis republier bascule la présence dans la galerie + trace le consentement", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const cible = regs.find((r) => r.classement == null)!;

    expect(await setRegistrationVisibility(cible.id, editionId, false)).toBe(true);
    expect(await consentAt(cible.id)).toBeNull(); // consentement effacé au retrait
    let pub = await publicDto("devfest-toulouse", 2026);
    expect(pub!.finalistes.map((f) => f.nom)).not.toContain(cible.participanteNom);

    expect(await setRegistrationVisibility(cible.id, editionId, true)).toBe(true);
    expect(await consentAt(cible.id)).not.toBeNull(); // horodaté à l'activation
    pub = await publicDto("devfest-toulouse", 2026);
    expect(pub!.finalistes.map((f) => f.nom)).toContain(cible.participanteNom);
  });

  it("la visibilité est scopée à l'édition (autre édition → false, rien changé)", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    expect(await setRegistrationVisibility(regs[0].id, editionId + 999, false)).toBe(false);
    const after = await getRegistrationsByEdition(editionId);
    expect(after.find((r) => r.id === regs[0].id)?.public).toBe(true); // inchangé
  });

  it("éditer la récompense se reflète au palmarès et au compteur gagnantes", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const sansPrix = regs.find((r) => r.classement == null)!;

    expect(
      await updateRegistrationDetails(sansPrix.id, editionId, { classement: 4 }),
    ).toBe(true);

    const pub = await publicDto("devfest-toulouse", 2026);
    expect(pub!.counts.gagnantes).toBe(4); // 3 au seed + le nouveau classement
    expect(pub!.palmares.map((p) => p.recompense)).toContain("4ᵉ prix");
  });

  it("galerie : bio / site / photo / poste d'une finaliste viennent de SA fiche (profil + avatar), pas de l'inscription", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Nadia Pro", "nadia.pro@example.fr");
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", bio, website, poste, linkedin, status)
       VALUES ($1, 'Bio de sa fiche', 'https://nadia.example', 'Staff Engineer', 'https://lnkd.in/nadia', 'publie')`,
      [userId],
    );
    await h.pool.query(`UPDATE users SET image = 'https://avatar.example/nadia.jpg' WHERE id = $1`, [userId]);

    // Une inscription SANS compte du seed : on la rattache, la rend publique et
    // finaliste, et on pose de VIEILLES données perso sur l'inscription pour
    // prouver que la galerie ne les lit PLUS (elle lit la fiche).
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => !r.userId)!;
    await attachUserToRegistration(reg.id, userId, editionId);
    await setRegistrationVisibility(reg.id, editionId, true);
    await h.pool.query(
      `UPDATE tremplin_registrations
          SET finale_presente = true, bio = 'Vieille bio', site_web = 'https://vieux', photo_url = 'https://vieux.jpg'
        WHERE id = $1`,
      [reg.id],
    );

    const pub = await publicDto("devfest-toulouse", 2026);
    const f = pub!.finalistes.find((x) => x.nom === reg.participanteNom)!;
    expect(f).toBeDefined();
    expect(f.bio).toBe("Bio de sa fiche"); // profil, pas l'inscription
    expect(f.siteWeb).toBe("https://nadia.example");
    expect(f.photoUrl).toBe("https://avatar.example/nadia.jpg"); // avatar du compte
    expect(f.role).toBe("Staff Engineer"); // poste du profil
  });

  it("galerie : une finaliste en BROUILLON (pas dans l'annuaire) expose quand même bio/site/photo/rôle (consentement d'édition)", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Brouillon Perso", "brouillon@example.fr");
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", bio, website, poste, status)
       VALUES ($1, 'Bio brouillon', 'https://x.example', 'Dev', 'brouillon')`,
      [userId],
    );
    await h.pool.query(`UPDATE users SET image = 'https://avatar.example/x.jpg' WHERE id = $1`, [userId]);
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => !r.userId)!;
    await attachUserToRegistration(reg.id, userId, editionId);
    await setRegistrationVisibility(reg.id, editionId, true);
    await h.pool.query(`UPDATE tremplin_registrations SET finale_presente = true WHERE id = $1`, [reg.id]);

    const pub = await publicDto("devfest-toulouse", 2026);
    const f = pub!.finalistes.find((x) => x.nom === reg.participanteNom)!;
    expect(f).toBeDefined();
    // Découplage édition ↔ annuaire : bio / site / rôle s'affichent sur la page
    // d'édition sur la base du consentement d'édition, même sans publication.
    expect(f.bio).toBe("Bio brouillon");
    expect(f.siteWeb).toBe("https://x.example");
    expect(f.role).toBe("Dev");
    // MAIS l'avatar OAuth reste réservé aux fiches publiées (pas d'exposition
    // automatique d'une photo Google/LinkedIn pour un brouillon).
    expect(f.photoUrl).toBeNull();
  });

  it("galerie : une fiche MASQUÉE (retrait explicite) n'expose rien, seul le nom consenti reste", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Masquee Perso", "masquee@example.fr");
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", bio, website, poste, status)
       VALUES ($1, 'Bio masquée', 'https://m.example', 'Dev', 'masque')`,
      [userId],
    );
    await h.pool.query(`UPDATE users SET image = 'https://avatar.example/m.jpg' WHERE id = $1`, [userId]);
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => !r.userId)!;
    await attachUserToRegistration(reg.id, userId, editionId);
    await setRegistrationVisibility(reg.id, editionId, true);
    await h.pool.query(`UPDATE tremplin_registrations SET finale_presente = true WHERE id = $1`, [reg.id]);

    const pub = await publicDto("devfest-toulouse", 2026);
    const f = pub!.finalistes.find((x) => x.nom === reg.participanteNom)!;
    expect(f).toBeDefined(); // nommée (consentement galerie)
    expect(f.bio).toBeNull(); // fiche masquée → rien
    expect(f.siteWeb).toBeNull();
    expect(f.photoUrl).toBeNull();
    expect(f.role).toBeNull();
  });

  it("palmarès : une gagnante reliée par compte (sans nom saisi) est nommée, pas « non communiquée »", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Gagnante Compte", "gc@example.fr");
    await h.pool.query(
      `INSERT INTO tremplin_registrations
         (edition_id, "userId", statut, "public", public_consent_at, classement, finale_presente)
       VALUES ($1, $2, 'acceptee', true, now(), 4, true)`,
      [editionId, userId],
    );
    const pub = await publicDto("devfest-toulouse", 2026);
    const row = pub!.palmares.find((x) => x.recompense === "4ᵉ prix")!;
    expect(row).toBeDefined();
    expect(row.nom).toBe("Gagnante Compte"); // nom du compte via COALESCE, pas null
  });

  it("un seul rang de podium par édition : réattribuer un classement déjà pris est refusé (index unique)", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const sansRang = regs.find((r) => r.classement == null)!;
    // Le seed a déjà une 1ᵉʳ : donner le rang 1 à une autre viole l'unicité.
    await expect(
      updateRegistrationDetails(sansRang.id, editionId, { classement: 1 }),
    ).rejects.toThrow();
  });

  it("masquer une GAGNANTE via setRegistrationVisibility garde son rang au palmarès, sans nom", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const gagnante = regs.find((r) => r.classement != null)!;

    expect(await setRegistrationVisibility(gagnante.id, editionId, false)).toBe(true);
    const pub = await publicDto("devfest-toulouse", 2026);
    const row = pub!.palmares.find((p) => p.recompense === rangLabel(gagnante.classement))!;
    expect(row.nom).toBeNull(); // rang conservé, nom masqué
    expect(pub!.palmares).toHaveLength(3); // toujours 3 récompenses
  });

  it("les détails sont scopés à l'édition (autre édition → false)", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    expect(
      await updateRegistrationDetails(regs[0].id, editionId + 999, { classement: 3 }),
    ).toBe(false);
  });
});

describe("ajout de participante par e-mail + statut finaliste (réel)", () => {
  it("inscrit un compte par e-mail (sans nom), refuse le doublon, joint l'e-mail", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("", "invitee@example.fr");

    expect(await registerUserToEdition(editionId, userId)).toBe("inscrite");
    expect(await registerUserToEdition(editionId, userId)).toBe("deja_inscrite"); // UNIQUE

    const reg = (await getRegistrationsByEdition(editionId)).find((r) => r.userId === userId)!;
    expect(reg.participanteNom).toBeNull(); // profil complété à la connexion
    expect(reg.finalePresente).toBeNull(); // inconnu à l'inscription
    expect(reg.userEmail).toBe("invitee@example.fr"); // jointure users (vue admin)
  });

  it("la bascule finaliste se reflète dans le compteur public et est scopée à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Nouvelle", "nouvelle@example.fr");
    await registerUserToEdition(editionId, userId);
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => r.userId === userId)!;

    // 8 finalistes au seed ; la nouvelle inscrite n'est pas encore finaliste.
    expect((await publicDto("devfest-toulouse", 2026))!.counts.finalistes).toBe(8);

    expect(await setRegistrationFinale(reg.id, editionId, true)).toBe(true);
    expect((await publicDto("devfest-toulouse", 2026))!.counts.finalistes).toBe(9);

    expect(await setRegistrationFinale(reg.id, editionId, false)).toBe(true);
    expect((await publicDto("devfest-toulouse", 2026))!.counts.finalistes).toBe(8);

    // Autre édition → false, rien changé.
    expect(await setRegistrationFinale(reg.id, editionId + 999, true)).toBe(false);
  });
});

describe("droit à l'effacement d'une invitée par e-mail (réel, RGPD)", () => {
  it("supprimer le compte d'une invitée SANS nom supprime son inscription (pas d'erreur CHECK)", async () => {
    const { editionId } = await importTremplin1();
    const { user } = await getOrCreateUserByEmail("invitee@example.fr");
    await registerUserToEdition(editionId, user.id);
    expect(await getRegistrationsByEdition(editionId)).toHaveLength(9);

    // Sans le pré-nettoyage, le ON DELETE SET NULL violerait le CHECK
    // d'identité (ni compte ni nom) et TOUTE la suppression échouerait.
    await expect(effacerCompteEnBase(user.id)).resolves.toBeUndefined();

    const after = await getRegistrationsByEdition(editionId);
    expect(after).toHaveLength(8); // l'inscription anonyme est partie…
    expect(after.every((r) => r.participanteNom !== null)).toBe(true); // …les nommées restent
  });
});

describe("coachs d'atelier (réel)", () => {
  it("relie un compte (scopé, idempotent), le retire, et le genre est contraint", async () => {
    const { editionId } = await importTremplin1();
    const ateliers = await getAteliersByEdition(editionId);
    const rachel = await newUser("Rachel Dubois", "rachel@exemple.fr");

    // Relie, puis re-relie (idempotent) ; hors édition → false.
    expect(await addCoachToAtelier(ateliers[0].id, editionId, rachel)).toBe(true);
    expect(await addCoachToAtelier(ateliers[0].id, editionId, rachel)).toBe(true);
    expect(await addCoachToAtelier(ateliers[0].id, editionId + 999, rachel)).toBe(false);

    const coachs = await getCoachsByAtelier(ateliers[0].id);
    expect(coachs.map((c) => c.nom)).toEqual(["Rachel Dubois"]);
    const parAtelier = await getCoachsByEdition(editionId);
    expect(parAtelier.get(ateliers[0].id)?.length).toBe(1);
    expect(parAtelier.get(ateliers[1].id)).toBeUndefined();

    // Profil « animateur / coach » : simple marqueur cumulable sur le compte.
    await markUserAsCoach(rachel);
    const { rows: roles } = await h.pool.query(
      "SELECT is_coach FROM users WHERE id = $1", [rachel],
    );
    expect((roles[0] as { is_coach: boolean }).is_coach).toBe(true);

    // Genre (obligatoire pour un coach) : valide OK, hors CHECK rejeté en base.
    await setUserGenre(rachel, "non_binaire");
    expect((await getCoachsByAtelier(ateliers[0].id))[0].genre).toBe("non_binaire");
    await expect(
      h.pool.query("UPDATE users SET genre = 'xx' WHERE id = $1", [rachel]),
    ).rejects.toThrow();

    // Retrait scopé : autre édition → false, rien changé ; bonne édition → retiré.
    expect(await removeCoachFromAtelier(ateliers[0].id, editionId + 999, rachel)).toBe(false);
    expect(await removeCoachFromAtelier(ateliers[0].id, editionId, rachel)).toBe(true);
    expect(await getCoachsByAtelier(ateliers[0].id)).toEqual([]);
  });

  it("coaching individuel : assigné à UNE participante, scopé, retiré au retrait de l'inscription", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const coach = await newUser("Coach Perso", "perso@exemple.fr");

    expect(await addCoachToRegistration(regs[0].id, editionId, coach)).toBe(true);
    expect(await addCoachToRegistration(regs[0].id, editionId, coach)).toBe(true); // idempotent
    expect(await addCoachToRegistration(regs[0].id, editionId + 999, coach)).toBe(false); // scopé

    expect((await getCoachsByRegistration(regs[0].id)).map((c) => c.nom)).toEqual(["Coach Perso"]);
    expect(await getCoachsByRegistration(regs[1].id)).toEqual([]); // pas les autres

    // Retrait scopé, puis cascade : retirer l'inscription efface la liaison.
    expect(await removeCoachFromRegistration(regs[0].id, editionId + 999, coach)).toBe(false);
    expect(await addCoachToRegistration(regs[1].id, editionId, coach)).toBe(true);
    expect(await deleteRegistration(regs[1].id, editionId)).toBe(true);
    expect(await getCoachsByRegistration(regs[1].id)).toEqual([]);
    expect(await removeCoachFromRegistration(regs[0].id, editionId, coach)).toBe(true);
  });

  /**
   * La précondition d'une FICHE COACH : ce compte accompagne quelqu'un, ici ou
   * ailleurs. Elle garde des écritures qui, sinon, portent sur n'importe quel
   * compte (rôle et lien publiés, consentement horodaté).
   */
  it("estCoachRattache suit le lien réel, et le perd quand il est retiré", async () => {
    const { editionId } = await importTremplin1();
    const ateliers = await getAteliersByEdition(editionId);
    const inconnue = await newUser("Simple Adhérente", "adherente@exemple.fr");

    expect(await estCoachRattache(inconnue)).toBe(false);
    await addCoachToAtelier(ateliers[0].id, editionId, inconnue);
    expect(await estCoachRattache(inconnue)).toBe(true);
    await removeCoachFromAtelier(ateliers[0].id, editionId, inconnue);
    expect(await estCoachRattache(inconnue)).toBe(false);
  });

  /**
   * Accompagner UNE participante en individuel fait une coach, tout autant
   * qu'animer un atelier : la fiche vaut au niveau du COMPTE. La précondition
   * regarde donc les deux rattachements.
   */
  it("estCoachRattache reconnaît aussi le coaching individuel", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const perso = await newUser("Coach Individuelle", "individuelle@exemple.fr");

    expect(await estCoachRattache(perso)).toBe(false);
    await addCoachToRegistration(regs[0].id, editionId, perso);
    expect(await estCoachRattache(perso)).toBe(true);
    await removeCoachFromRegistration(regs[0].id, editionId, perso);
    expect(await estCoachRattache(perso)).toBe(false);
  });

  it("la pré-création par e-mail peut poser un nom, sans jamais écraser un existant", async () => {
    const a = await getOrCreateUserByEmail("coach@exemple.fr", "Coach Untel");
    expect(a.created).toBe(true);
    expect(a.user.name).toBe("Coach Untel");
    // Compte existant : le nom passé est IGNORÉ (il appartient à la personne).
    const b = await getOrCreateUserByEmail("coach@exemple.fr", "Autre Nom");
    expect(b.created).toBe(false);
    expect(b.user.name).toBe("Coach Untel");
  });
});

describe("espace coach : lectures et dépôts scopés (réel)", () => {
  it("un coach ne voit et n'alimente QUE ses ateliers et ses coachées", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const ateliers = await getAteliersByEdition(editionId);
    const coachA = await newUser("Coach A", "a@coach.fr");
    const coachB = await newUser("Coach B", "b@coach.fr");

    await addCoachToAtelier(ateliers[0].id, editionId, coachA);
    await addCoachToRegistration(regs[0].id, editionId, coachA);
    await addCoachToAtelier(ateliers[1].id, editionId, coachB);

    // Missions par édition : A a 1 atelier + 1 coachée ; un compte sans
    // mission n'a aucune édition.
    const missionsA = await getCoachEditions(coachA);
    expect(missionsA).toHaveLength(1);
    expect(missionsA[0].nbAteliers).toBe(1);
    expect(missionsA[0].nbCoachees).toBe(1);
    expect(await getCoachEditions(await newUser("Personne", "p@x.fr"))).toEqual([]);

    // Ateliers/coachées : chacun les siens, rien d'autre.
    expect((await getCoachAteliers(coachA, editionId)).map((a) => a.id)).toEqual([ateliers[0].id]);
    expect((await getCoachAteliers(coachB, editionId)).map((a) => a.id)).toEqual([ateliers[1].id]);
    const coachees = await getCoachCoachees(coachA, editionId);
    expect(coachees.map((c) => c.registrationId)).toEqual([regs[0].id]);
    expect(JSON.stringify(coachees)).not.toMatch(/@/); // jamais d'e-mail
    expect(await getCoachCoachees(coachB, editionId)).toEqual([]);

    // Dépôts : sur SA cible OK ; cible d'un autre coach ou étrangère → refus.
    const doc = { type: "support_atelier", titre: "Slides", lien: "https://x.fr", contenu: null };
    expect(await addDocumentAsCoach(coachA, editionId, { ...doc, atelierId: ateliers[0].id, registrationId: null })).toBe(true);
    expect(await addDocumentAsCoach(coachA, editionId, { ...doc, atelierId: ateliers[1].id, registrationId: null })).toBe(false);
    expect(await addDocumentAsCoach(coachA, editionId, { ...doc, titre: "Retour", type: "note", atelierId: null, registrationId: regs[0].id })).toBe(true);
    expect(await addDocumentAsCoach(coachA, editionId, { ...doc, atelierId: null, registrationId: regs[1].id })).toBe(false);
    expect(await addDocumentAsCoach(coachA, editionId, { ...doc, atelierId: null, registrationId: null })).toBe(false);

    // Lecture documents : A voit ses 2 dépôts (atelier + coachée), B rien.
    const docsA = await getCoachDocuments(coachA, editionId);
    expect(docsA.map((d) => d.titre).sort()).toEqual(["Retour", "Slides"]);
    expect(docsA.every((d) => d.estAuteur)).toBe(true);
    expect(await getCoachDocuments(coachB, editionId)).toEqual([]);

    // Suppression : seulement SES dépôts — pas ceux d'une orga.
    await addDocument(editionId, {
      atelierId: ateliers[0].id, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Doc orga", lien: "https://o.fr", contenu: null,
    });
    const docOrga = (await getCoachDocuments(coachA, editionId)).find((d) => d.titre === "Doc orga");
    expect(docOrga?.estAuteur).toBe(false);
    expect(await deleteOwnDocument(coachA, docOrga!.id, editionId)).toBe(false);
    const sien = docsA.find((d) => d.titre === "Slides");
    expect(await deleteOwnDocument(coachA, sien!.id, editionId)).toBe(true);
  });
});

describe("visibilité self-service (réel, RGPD)", () => {
  it("la participante bascule SA visibilité (journalisée) ; un autre compte ne touche rien", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const elle = await newUser("Camille", "camille@exemple.fr");
    const autre = await newUser("Autre", "autre@exemple.fr");
    expect(await attachUserToRegistration(regs[0].id, elle, editionId)).toBe("attached");

    // Elle se masque : effectif + journalisé sous SON inscription.
    expect(await setOwnRegistrationVisibility(elle, editionId, false)).toBe(true);
    let après = await getRegistrationsByEdition(editionId);
    expect(après.find((r) => r.id === regs[0].id)?.public).toBe(false);
    const journal = await getConsentLog(regs[0].id);
    expect(journal[journal.length - 1]?.action).toBe("retire");

    // Un compte non inscrit à l'édition : false, rien changé, rien journalisé.
    expect(await setOwnRegistrationVisibility(autre, editionId, true)).toBe(false);
    après = await getRegistrationsByEdition(editionId);
    expect(après.find((r) => r.id === regs[0].id)?.public).toBe(false);

    // Elle se re-publie : accord journalisé, base TOUJOURS 'self', sans preuve.
    expect(await setOwnRegistrationVisibility(elle, editionId, true)).toBe(true);
    const journal2 = await getConsentLog(regs[0].id);
    const dernier = journal2[journal2.length - 1];
    expect(dernier?.action).toBe("accorde");
    expect(dernier?.base).toBe("self");
    expect(dernier?.preuveLien).toBeNull();
  });

  it("l'orga atteste un recueil EXTERNE : base + lien de preuve journalisés à l'octroi", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    // Octroi orga avec provenance « formulaire d'inscription » + lien de preuve.
    expect(
      await setRegistrationVisibility(
        regs[0].id,
        editionId,
        true,
        "formulaire_inscription",
        "https://drive.exemple/preuve",
      ),
    ).toBe(true);
    const j = await getConsentLog(regs[0].id);
    expect(j[j.length - 1]).toMatchObject({
      action: "accorde",
      base: "formulaire_inscription",
      preuveLien: "https://drive.exemple/preuve",
    });

    // Retrait : la base n'a pas de sens → 'self', pas de preuve (même si des
    // arguments sont passés, ils sont ignorés pour un retrait).
    expect(
      await setRegistrationVisibility(regs[0].id, editionId, false, "email", "https://x"),
    ).toBe(true);
    const j2 = await getConsentLog(regs[0].id);
    expect(j2[j2.length - 1]).toMatchObject({
      action: "retire",
      base: "self",
      preuveLien: null,
    });
  });

  it("la participante désigne SON talk pitché ; un autre compte ne touche rien", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const elle = await newUser("Elle", "elle@exemple.fr");
    const autre = await newUser("Autre", "autre2@exemple.fr");
    await attachUserToRegistration(regs[0].id, elle, editionId);

    // Un talk de SON répertoire (le picker ne propose que des talks possédés).
    const profileId = await ensureProfileId(elle);
    const talkId = await addTalk(profileId, {
      titre: "Effet Matilda",
      type: "Conférence",
      description: null,
    });

    // Elle met en avant son talk : le writer est scopé au COMPTE (anti-IDOR).
    expect(await setOwnRegistrationTalk(elle, editionId, talkId)).toBe(true);
    expect(await getRegistrationTalkId(regs[0].id, editionId)).toBe(talkId);

    // Un compte non rattaché à cette édition : false, rien changé.
    expect(await setOwnRegistrationTalk(autre, editionId, null)).toBe(false);
    expect(await getRegistrationTalkId(regs[0].id, editionId)).toBe(talkId);

    // « Aucun » (null) → talk retiré.
    expect(await setOwnRegistrationTalk(elle, editionId, null)).toBe(true);
    expect(await getRegistrationTalkId(regs[0].id, editionId)).toBeNull();
  });
});

describe("suppression de document et retrait de participante (réel)", () => {
  it("deleteDocument supprime, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const docId = await addDocument(editionId, {
      atelierId: null, registrationId: null, auteurId: null,
      type: "autre", titre: "À corriger", lien: "https://x.fr", contenu: null,
    });
    expect(await deleteDocument(docId, editionId + 999)).toBe(false); // hors édition
    expect(await getDocumentsByEdition(editionId)).toHaveLength(1);
    expect(await deleteDocument(docId, editionId)).toBe(true);
    expect(await getDocumentsByEdition(editionId)).toHaveLength(0);
  });

  it("deleteRegistration retire l'inscription et ses documents (cascade), scopé", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    await addDocument(editionId, {
      atelierId: null, registrationId: regs[0].id, auteurId: null,
      type: "feedback_jury", titre: "Retour", lien: null, contenu: "Bravo",
    });

    expect(await deleteRegistration(regs[0].id, editionId + 999)).toBe(false); // hors édition
    expect(await deleteRegistration(regs[0].id, editionId)).toBe(true);

    expect(await getRegistrationsByEdition(editionId)).toHaveLength(7);
    expect(await getDocumentsByEdition(editionId)).toHaveLength(0); // cascade
  });
});

describe("ateliers restreints / coaching (réel)", () => {
  const mk = (titre: string, coachs: string | null = null) => ({
    ordre: 0, titre, date: null, heureDebut: null, heureFin: null,
    description: null, lienVisio: null, coachs,
  });

  it("l'AUDIENCE est un choix explicite : un atelier neuf ne s'ouvre à personne", async () => {
    const { setAtelierAudience } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    const nouveau = await createAtelierWithMembers(editionId, mk("Atelier neuf"), []);
    const restreint = await createAtelierWithMembers(
      editionId,
      mk("Coaching DevFest", "Lucile"),
      [regs[0].id, regs[1].id, 999999], // 999999 (hors édition) ignoré
    );

    expect((await getAtelierMembers(restreint)).sort((a, b) => a - b)).toEqual(
      [regs[0].id, regs[1].id].sort((a, b) => a - b),
    );
    // Un atelier neuf part en « sélection » (vide) : visible de l'orga seule.
    const lu = async (id: number) =>
      (await getAteliersByEdition(editionId)).find((a) => a.id === id);
    expect((await lu(nouveau))?.audience).toBe("selection");

    // Ouverture explicite, scopée à l'édition (id forgé → aucun effet).
    expect(await setAtelierAudience(nouveau, editionId + 999, "toutes")).toBe(false);
    expect(await setAtelierAudience(nouveau, editionId, "toutes")).toBe(true);
    expect((await lu(nouveau))?.audience).toBe("toutes");

    // L'audience est indépendante de l'inventaire : pointer une présence
    // (donc créer une ligne de membre) ne la change pas.
    const { setAtelierMembre } = await import("@/lib/tremplin-ateliers");
    await setAtelierMembre(nouveau, editionId, regs[0].id, true);
    expect((await lu(nouveau))?.audience).toBe("toutes");

    // Et l'inverse, qui était LE bug : revenir à une sélection referme
    // vraiment l'atelier — avant, « ouvert à toutes » survivait au geste.
    expect(await setAtelierAudience(nouveau, editionId, "selection")).toBe(true);
    expect((await lu(nouveau))?.audience).toBe("selection");

    // Une audience de PHASE ne s'appuie sur aucune liste nominative.
    expect(await setAtelierAudience(restreint, editionId, "phase")).toBe(true);
    expect((await lu(restreint))?.audience).toBe("phase");
  });

  /**
   * EXPAND/CONTRACT — bloc à SUPPRIMER D'UN SEUL TENANT avec la colonne.
   *
   * `ouvert_a_toutes` n'est plus qu'un miroir booléen qu'entretient
   * `setAtelierAudience`, le temps que la bascule soit en prod (la migration
   * passe avant le code, donc l'ancien code la lit encore). Plus aucun code de
   * prod ne l'interroge : on la lit ici en SQL nu, plutôt que de garder une
   * fonction de lecture qui ferait une formulation de plus de la règle.
   *
   * Ce test vit à part parce qu'il éprouve un autre sujet que celui d'au-dessus :
   * là-haut c'est l'audience, ici c'est la synchronisation du miroir.
   */
  it("la colonne miroir `ouvert_a_toutes` suit l'audience (à retirer avec elle)", async () => {
    const { setAtelierAudience } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const idsSelonLeMiroir = async (): Promise<number[]> => {
      const r = await h.pool.query(
        `SELECT id FROM tremplin_ateliers WHERE edition_id = $1 AND ouvert_a_toutes = true`,
        [editionId],
      );
      return (r.rows as { id: number }[]).map((a) => a.id);
    };

    const miroirAvant = (await idsSelonLeMiroir()).length;
    const nouveau = await createAtelierWithMembers(editionId, mk("Atelier neuf"), []);
    expect(await idsSelonLeMiroir()).not.toContain(nouveau);
    expect((await idsSelonLeMiroir()).length).toBe(miroirAvant);

    await setAtelierAudience(nouveau, editionId, "toutes");
    expect(await idsSelonLeMiroir()).toContain(nouveau);

    // Pointer une présence ne touche pas au miroir.
    const { setAtelierMembre } = await import("@/lib/tremplin-ateliers");
    await setAtelierMembre(nouveau, editionId, regs[0].id, true);
    expect(await idsSelonLeMiroir()).toContain(nouveau);

    // Et le retour en arrière referme vraiment : c'était LE bug d'origine.
    await setAtelierAudience(nouveau, editionId, "selection");
    expect(await idsSelonLeMiroir()).not.toContain(nouveau);
    // Une audience de phase n'est pas « toutes » : le miroir reste faux.
    await setAtelierAudience(nouveau, editionId, "phase");
    expect(await idsSelonLeMiroir()).not.toContain(nouveau);
  });

  /**
   * La COHORTE d'un atelier se dérive de son audience, et c'est elle que vise
   * le pointage en lot. Sans ça, « marquer toutes présentes » ne trouvait que
   * les lignes de présence DÉJÀ créées : sur un atelier de phase jamais pointé,
   * il n'y en a aucune — le geste disparaissait quand il servait le plus.
   */
  it("la cohorte suit l'audience, et le pointage en lot la crée au besoin", async () => {
    const { setAtelierAudience, getCohorteAtelier, setAtelierPresences, getAtelierPresences } =
      await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, mk("Répétition"), [regs[0].id]);
    await h.pool.query(
      `UPDATE tremplin_ateliers SET phase = 'montee_sur_scene' WHERE id = $1`,
      [atelierId],
    );
    // Deux inscrites rattachées à la phase, dont UNE seule est dans la sélection.
    for (const r of [regs[1].id, regs[2].id]) {
      await h.pool.query(
        `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
        [r, "montee_sur_scene"],
      );
    }

    // « sélection » : la liste nominative, et elle seule.
    expect(await getCohorteAtelier(atelierId, editionId)).toEqual([regs[0].id]);

    // « phase » : la cohorte de la phase, sans aucune liste à tenir.
    await setAtelierAudience(atelierId, editionId, "phase");
    expect((await getCohorteAtelier(atelierId, editionId)).sort((x, y) => x - y)).toEqual(
      [regs[1].id, regs[2].id].sort((x, y) => x - y),
    );

    // « toutes » : toute l'édition.
    await setAtelierAudience(atelierId, editionId, "toutes");
    expect(await getCohorteAtelier(atelierId, editionId)).toHaveLength(regs.length);

    // Le pointage en lot CRÉE la ligne quand elle manque.
    await setAtelierAudience(atelierId, editionId, "phase");
    const cible = await getCohorteAtelier(atelierId, editionId);
    expect(await setAtelierPresences(
      atelierId,
      editionId,
      cible.map((registrationId) => ({ registrationId, presence: "presente" as const })),
    )).toBe(true);
    const pointees = await getAtelierPresences(atelierId);
    for (const id of cible) {
      expect(pointees.find((p) => p.registrationId === id)?.presence, String(id)).toBe("presente");
    }
  });

  /**
   * TROISIÈME formulation de la même règle : `getTaillesCohortesByEdition`
   * agrège pour toute une édition ce que `getCohorteAtelier` calcule pour un
   * atelier (anti N+1 : la liste des ateliers affiche le reste à ranger, elle
   * ne peut pas payer une requête par rangée). Deux SQL, une seule vérité —
   * on les confronte sur les trois audiences.
   */
  it("les tailles de cohortes par édition disent la MÊME chose que la cohorte par atelier", async () => {
    const { setAtelierAudience, getCohorteAtelier, getTaillesCohortesByEdition } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, mk("Filage"), [regs[0].id]);
    await h.pool.query(
      `UPDATE tremplin_ateliers SET phase = 'montee_sur_scene' WHERE id = $1`,
      [atelierId],
    );
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
      [regs[1].id, "montee_sur_scene"],
    );

    for (const audience of ["selection", "phase", "toutes"] as const) {
      await setAtelierAudience(atelierId, editionId, audience);
      const parAtelier = (await getCohorteAtelier(atelierId, editionId)).length;
      const parEdition = (await getTaillesCohortesByEdition(editionId)).get(atelierId) ?? 0;
      expect(parEdition, audience).toBe(parAtelier);
    }
  });

  /**
   * LA règle d'autorisation est écrite DEUX FOIS : en SQL (`getCohorteAtelier`,
   * qui dit qui l'atelier concerne) et en TypeScript (`atelierVisiblePour`, qui
   * dit qui a le droit de l'ouvrir). Deux langages, une seule vérité — et rien,
   * à la compilation, ne les empêche de diverger.
   *
   * Ce test les CONFRONTE sur les trois audiences : pour chaque inscrite de
   * l'édition, appartenir à la cohorte SQL et être autorisée par le prédicat
   * doivent être la même chose. Une divergence donnerait le pire des bugs :
   * une séance listée dans un agenda dont la page répond « introuvable », ou
   * l'inverse — un support visible de quelqu'un qu'on croyait exclu.
   */
  it("la cohorte SQL et le prédicat de visibilité disent la MÊME chose", async () => {
    const { setAtelierAudience, getCohorteAtelier } = await import("@/lib/tremplin-ateliers");
    const { atelierVisiblePour } = await import("@/lib/tremplin-guards");
    const { getPhaseMembersByEdition } = await import("@/lib/tremplin-registration-phases");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, mk("Confrontation"), [regs[0].id]);
    await h.pool.query(
      `UPDATE tremplin_ateliers SET phase = 'montee_sur_scene' WHERE id = $1`,
      [atelierId],
    );
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
      [regs[1].id, "montee_sur_scene"],
    );

    for (const audience of ["selection", "phase", "toutes"] as const) {
      await setAtelierAudience(atelierId, editionId, audience);
      const cohorte = new Set(await getCohorteAtelier(atelierId, editionId));
      const membres = await getAtelierMembers(atelierId);
      const phases = await getPhaseMembersByEdition(editionId);

      for (const r of regs) {
        const selonLePredicat = atelierVisiblePour({
          audience,
          phase: "montee_sur_scene",
          membres,
          registration: r,
          phasesDeLInscrite: phases.get(r.id),
          isOrga: false,
        });
        expect(cohorte.has(r.id), `${audience} — inscription ${r.id}`).toBe(selonLePredicat);
      }
    }
  });

  it("un nouvel atelier se place APRÈS le parcours existant (ordre max+1, pas 0)", async () => {
    const { editionId } = await importTremplin1();
    await createAtelierWithMembers(editionId, mk("Coaching post-soirée"), []);

    const tous = await getAteliersByEdition(editionId);
    // Sans le max+1, un ordre 0 passerait DEVANT les 5 ateliers du seed et
    // renuméroterait les étapes du parcours public.
    expect(tous[tous.length - 1].titre).toBe("Coaching post-soirée");
    expect(tous[tous.length - 1].ordre).toBeGreaterThan(tous[0].ordre);
  });

  /**
   * Le programme public montre les séances que l'orga a DIT vouloir montrer.
   *
   * Trois régressions successives ici, en zigzag. D'abord (prod 2026-07-30) les
   * ateliers passés « réservés » pour pointer les présences avaient disparu du
   * parcours public : la publication était couplée au seul « ouvert à toutes ».
   * Le correctif publiait tout atelier DOTÉ de participantes — sauf que
   * l'interrupteur qui en dote est celui du POINTAGE : pointer publiait. La 051
   * a alors fusionné publication et audience.
   *
   * Ce que la fusion corrigeait n'était pas « deux réglages » mais un réglage
   * INVISIBLE. La 056 en refait donc deux, dont un écrit : `au_programme_public`.
   * On confronte la requête à LA COLONNE — et surtout on vérifie ce que le
   * découplage rend possible : changer d'audience ne touche plus à la vitrine.
   */
  it("programme public : ce que l'orga a coché, et rien d'autre", async () => {
    const { setAtelierAudience, setAtelierProgrammePublic } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const titres = async () =>
      (await publicDto("devfest-toulouse", 2026))!.ateliers.map((a) => a.titre);

    // Pointée sur la séance : sous la toute première règle, ce seul geste la
    // publiait. Elle naît en `selection`, donc réservée.
    const atelierId = await createAtelierWithMembers(
      editionId, mk("Coaching restreint"), [regs[0].id],
    );
    // AVANT tout réglage : une séance neuve, même dotée d'une participante, reste
    // invisible — « pas de création silencieusement publique » (registre des
    // erreurs). C'est le défaut dérivé de `DEFAULT_AUDIENCE` qui est éprouvé ici.
    expect(await titres()).not.toContain("Coaching restreint");

    // Une AUTRE édition, avec une séance parfaitement publiable : elle ne doit
    // jamais atterrir dans le programme de celle-ci. Sans cette voisine, un
    // scope d'édition élargi (`edition_id >= $1`) ne changeait rien au résultat,
    // donc rien ne le tenait.
    const editionVoisine = await createEdition({
      nom: "Tremplin voisin 2029", annee: 2029, confSlug: "voisine-conf",
      statut: "ouvert", description: null, confNom: "VoisineConf", confLieu: null,
      confDate: null, confLien: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null, conferenceEditionId: null,
    });
    const chezLaVoisine = await createAtelierWithMembers(
      editionVoisine, mk("Séance de la voisine"), [],
    );
    await setAtelierProgrammePublic(chezLaVoisine, editionVoisine, true);

    // On compare l'ENSEMBLE publié, pas seulement « ce titre-ci apparaît-il ».
    // La version précédente ne regardait qu'un titre : toute mutation publiant
    // des séances EN TROP passait au vert.
    const attenduParColonne = async () => {
      const tous = await getAteliersByEdition(editionId);
      return tous.filter((a) => a.auProgrammePublic).map((a) => a.titre).sort();
    };

    for (const visible of [true, false, true] as const) {
      await setAtelierProgrammePublic(atelierId, editionId, visible);
      expect([...(await titres())].sort(), String(visible)).toEqual(await attenduParColonne());
      expect((await titres()).includes("Coaching restreint"), String(visible)).toBe(visible);
    }

    // LE DÉCOUPLAGE, éprouvé : l'audience bouge dans tous les sens, la vitrine
    // ne bronche pas. C'est ce qui rend le réglage séparé tenable — sans quoi on
    // aurait juste déplacé l'effet de bord d'un cran.
    for (const audience of ["selection", "phase", "toutes"] as const) {
      await setAtelierAudience(atelierId, editionId, audience);
      expect((await titres()).includes("Coaching restreint"), audience).toBe(true);
    }

    // Et le lieu ne sort JAMAIS : le programme public annonce le parcours, pas
    // une adresse de rendez-vous. On vérifie la FORME du DTO, pas l'absence de
    // la sous-chaîne « lieu » — qui se cache dans « milieu de parcours ».
    const dto = (await publicDto("devfest-toulouse", 2026))!;
    expect(Object.keys(dto.ateliers[0])).toEqual([
      "titre", "date", "dateFin", "description", "phase",
    ]);
  });

  /**
   * L'id seul ne suffit jamais à écrire : sans le scope, connaître l'id d'une
   * séance suffirait à publier le programme d'une AUTRE édition. Tous les
   * setters d'atelier tiennent cette règle ; celui-ci publie sur une page
   * indexée, il n'a pas le droit d'y déroger.
   */
  it("publier une séance est scopé à son édition", async () => {
    const { setAtelierProgrammePublic, getAteliersByEdition } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const voisine = await createEdition({
      nom: "Tremplin voisin 2030", annee: 2030, confSlug: "voisine-2030",
      statut: "ouvert", description: null, confNom: "VoisineConf", confLieu: null,
      confDate: null, confLien: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null, conferenceEditionId: null,
    });
    const chezNous = (await getAteliersByEdition(editionId))[0];

    // Même id, mauvaise édition : refus, et RIEN d'écrit.
    expect(await setAtelierProgrammePublic(chezNous.id, voisine, true)).toBe(false);
    const apres = (await getAteliersByEdition(editionId)).find((a) => a.id === chezNous.id)!;
    expect(apres.auProgrammePublic).toBe(chezNous.auProgrammePublic);
  });

  it("updateAtelierInfos modifie titre/date/horaires/description, scopé à l'édition", async () => {
    const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
    const { editionId } = await importTremplin1();
    const a = (await getAteliersByEdition(editionId))[0];

    // Hors édition → false, rien changé.
    expect(
      await updateAtelierInfos(a.id, editionId + 999, {
        titre: "Pirate", date: null, heureDebut: null, heureFin: null, description: null,
      }),
    ).toBe(false);
    expect((await getAteliersByEdition(editionId)).find((x) => x.id === a.id)?.titre).toBe(a.titre);

    // Bonne édition → true, relu en base.
    expect(
      await updateAtelierInfos(a.id, editionId, {
        titre: "Atelier renommé", date: "2026-05-01", heureDebut: "10:00", heureFin: "11:30",
        description: "Nouvelle description",
      }),
    ).toBe(true);
    const apres = (await getAteliersByEdition(editionId)).find((x) => x.id === a.id)!;
    expect(apres.titre).toBe("Atelier renommé");
    expect(apres.description).toBe("Nouvelle description");
    expect(iso(apres.date)).toBe("2026-05-01");
    // Colonne TIME relue en « HH:MM » (secondes normalisées), pas « 10:00:00 » :
    // sinon l'input type=time et la validation HH:MM casseraient au ré-enregistrement.
    expect(apres.heureDebut).toBe("10:00");
    expect(apres.heureFin).toBe("11:30");

    // Champs optionnels vidés → effacés (null).
    expect(
      await updateAtelierInfos(a.id, editionId, {
        titre: "Atelier renommé", date: null, heureDebut: null, heureFin: null, description: null,
      }),
    ).toBe(true);
    const vide = (await getAteliersByEdition(editionId)).find((x) => x.id === a.id)!;
    expect(vide.date).toBeNull();
    expect(vide.description).toBeNull();
  });

  it("setAtelierMembers remplace la sélection et est scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelier = await createAtelierWithMembers(editionId, mk("A"), [regs[0].id]);

    expect(await setAtelierMembers(atelier, editionId, [regs[1].id, regs[2].id])).toBe(true);
    expect((await getAtelierMembers(atelier)).sort((a, b) => a - b)).toEqual(
      [regs[1].id, regs[2].id].sort((a, b) => a - b),
    );
    expect(await setAtelierMembers(atelier, editionId, [])).toBe(true); // vide → efface
    expect(await getAtelierMembers(atelier)).toEqual([]);
    expect(await setAtelierMembers(atelier, editionId + 999, [regs[0].id])).toBe(false); // hors édition
  });
});

describe("insertion de documents par portée (réel)", () => {
  it("addDocument insère selon la portée (général / atelier / participante) et est relu en base", async () => {
    const { editionId } = await importTremplin1();
    const ateliers = await getAteliersByEdition(editionId);
    const regs = await getRegistrationsByEdition(editionId);

    await addDocument(editionId, {
      atelierId: null, registrationId: null, auteurId: null,
      type: "autre", titre: "Charte", lien: "https://x.fr/charte", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: ateliers[0].id, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Slides", lien: "https://x.fr/slides", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: null, registrationId: regs[0].id, auteurId: null,
      type: "feedback_jury", titre: "Retour jury", lien: null, contenu: "Bravo",
    });

    const all = await getDocumentsByEdition(editionId);
    expect(all).toHaveLength(3);
    const general = all.find((d) => d.titre === "Charte")!;
    expect(general.atelierId).toBeNull();
    expect(general.registrationId).toBeNull();
    const support = all.find((d) => d.titre === "Slides")!;
    expect(support.atelierId).toBe(ateliers[0].id);
    const prive = all.find((d) => d.titre === "Retour jury")!;
    expect(prive.registrationId).toBe(regs[0].id);
    expect(prive.contenu).toBe("Bravo");
  });

  it("le support d'un atelier RÉSERVÉ reste invisible hors de ses membres (RGPD, onglet Documents)", async () => {
    const { editionId } = await importTremplin1();
    const membre = await newUser("Alice", "alice.docs@example.fr");
    const nonMembre = await newUser("Zoé", "zoe.docs@example.fr");
    await registerUserToEdition(editionId, membre);
    await registerUserToEdition(editionId, nonMembre);
    const regMembre = (await getRegistrationsByEdition(editionId)).find(
      (r) => r.userId === membre,
    )!;

    const base = {
      ordre: 0, titre: "", date: null, dateFin: null, heureDebut: null, heureFin: null,
      description: null, lienVisio: null, coachs: null, nature: "collectif" as const,
    };
    // Un atelier réservé (fermé par défaut) avec Alice membre, un atelier ouvert.
    const reserve = await createAtelierWithMembers(
      editionId, { ...base, titre: "Coaching restreint" }, [regMembre.id],
    );
    const ouvert = await createAtelierWithMembers(
      editionId, { ...base, titre: "Ouvert", audience: "toutes" as const }, [],
    );
    await addDocument(editionId, {
      atelierId: reserve, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Notes du coaching", lien: "https://x.fr/prive", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: ouvert, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Slides ouvertes", lien: "https://x.fr/slides", contenu: null,
    });
    await addDocument(editionId, {
      atelierId: null, registrationId: null, auteurId: null,
      type: "autre", titre: "Charte", lien: "https://x.fr/charte", contenu: null,
    });

    // La membre voit tout ; la non-membre voit le général et l'ouvert, JAMAIS
    // le support de l'atelier réservé (même règle que l'espace édition).
    expect((await getSharedDocumentsVisiblesPour(membre, editionId)).map((d) => d.titre))
      .toEqual(["Notes du coaching", "Slides ouvertes", "Charte"]);
    expect((await getSharedDocumentsVisiblesPour(nonMembre, editionId)).map((d) => d.titre))
      .toEqual(["Slides ouvertes", "Charte"]);
  });

  /**
   * QUATRIÈME formulation de la règle d'audience, et celle qui avait décroché :
   * l'onglet « Documents » lisait encore le miroir booléen `ouvert_a_toutes`.
   * L'audience `phase` n'y existait donc pas — les supports du coaching de la
   * phase 3 disparaissaient de cet onglet pour les inscrites qui les voyaient
   * dans l'espace de l'édition. Et l'appartenance était lue quelle que soit
   * l'audience, alors qu'elle sert au POINTAGE : pointer une présence sur un
   * atelier de phase ouvrait son support à quelqu'un hors de la phase.
   *
   * On confronte donc la requête au prédicat, inscrite par inscrite, sur les
   * TROIS audiences. Le support est le seul document de l'édition : la liste
   * rendue est exactement « voit » ou « ne voit rien ».
   */
  it("les documents partagés suivent l'AUDIENCE, comme le prédicat de visibilité", async () => {
    const { setAtelierAudience } = await import("@/lib/tremplin-ateliers");
    const { atelierVisiblePour } = await import("@/lib/tremplin-guards");
    const { getPhaseMembersByEdition } = await import("@/lib/tremplin-registration-phases");
    const { editionId } = await importTremplin1();
    // Deux inscrites qu'on peut confondre : la pointée (membre, hors phase) et
    // la rattachée (dans la phase, jamais pointée).
    const pointee = await newUser("Alma", "alma.audience@example.fr");
    const rattachee = await newUser("Bahia", "bahia.audience@example.fr");
    await registerUserToEdition(editionId, pointee);
    await registerUserToEdition(editionId, rattachee);
    const inscriptions = (await getRegistrationsByEdition(editionId)).filter(
      (r) => r.userId === pointee || r.userId === rattachee,
    );
    const inscription = (userId: number) => inscriptions.find((r) => r.userId === userId)!;

    const atelierId = await createAtelierWithMembers(
      editionId,
      {
        ordre: 0, titre: "Coaching phase 3", date: null, dateFin: null, heureDebut: null,
        heureFin: null, description: null, lienVisio: null, coachs: null,
        nature: "collectif" as const,
      },
      [inscription(pointee).id],
    );
    await h.pool.query(
      `UPDATE tremplin_ateliers SET phase = 'montee_sur_scene' WHERE id = $1`,
      [atelierId],
    );
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
      [inscription(rattachee).id, "montee_sur_scene"],
    );
    await addDocument(editionId, {
      atelierId, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Trame du filage", lien: "https://x.fr/trame",
      contenu: "Notes internes",
    });

    // Le SCOPE D'ÉDITION de la jointure d'inscription, éprouvé par le seul cas
    // qui le mord : une personne inscrite aux DEUX éditions, rattachée à la
    // phase dans l'AUTRE. Sans `r.edition_id = a.edition_id`, sa ligne de phase
    // d'une autre année ouvrirait les supports de celle-ci — être en « montée
    // sur scène » en 2025 donnerait le coaching 2026.
    //
    // (Une personne inscrite à une SEULE autre édition ne prouve rien : la garde
    // `EXISTS` externe l'écarte déjà, quelle que soit la jointure.)
    const autreEdition = await createEdition({
      nom: "Tremplin voisin 2029", annee: 2029, confSlug: "voisine-conf",
      statut: "ouvert", description: null, confNom: "VoisineConf", confLieu: null,
      confDate: null, confLien: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null, conferenceEditionId: null,
    });
    const doubleInscrite = await newUser("Cléa", "clea.deux-editions@example.fr");
    await registerUserToEdition(editionId, doubleInscrite);
    await registerUserToEdition(autreEdition, doubleInscrite);
    const sonInscriptionAilleurs = (await getRegistrationsByEdition(autreEdition)).find(
      (r) => r.userId === doubleInscrite,
    )!;
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase) VALUES($1, $2)`,
      [sonInscriptionAilleurs.id, "montee_sur_scene"],
    );
    // Son inscription ICI : ni pointée, ni rattachée à la phase.
    inscriptions.push(
      (await getRegistrationsByEdition(editionId)).find((r) => r.userId === doubleInscrite)!,
    );

    for (const audience of ["selection", "phase", "toutes"] as const) {
      await setAtelierAudience(atelierId, editionId, audience);
      const membres = await getAtelierMembers(atelierId);
      const phases = await getPhaseMembersByEdition(editionId);

      for (const r of inscriptions) {
        const attendu = atelierVisiblePour({
          audience,
          phase: "montee_sur_scene",
          membres,
          registration: r,
          phasesDeLInscrite: phases.get(r.id),
          isOrga: false,
        });
        const titres = (await getSharedDocumentsVisiblesPour(r.userId!, editionId)).map(
          (d) => d.titre,
        );
        expect(titres, `${audience} / inscription ${r.id}`).toEqual(
          attendu ? ["Trame du filage"] : [],
        );
      }
    }
  });
});

describe("journal de consentement (réel, RGPD)", () => {
  it("trace chaque changement (append-only), sans journaliser les no-op", async () => {
    const { editionId } = await importTremplin1();
    const r = (await getRegistrationsByEdition(editionId))[0];

    // Le seed n'écrit pas au journal : il démarre vide.
    expect(await getConsentLog(r.id)).toHaveLength(0);

    await setRegistrationVisibility(r.id, editionId, false);
    await setRegistrationVisibility(r.id, editionId, true);
    expect((await getConsentLog(r.id)).map((e) => e.action)).toEqual(["retire", "accorde"]);

    // Un appel hors édition (0 ligne) ne journalise rien.
    await setRegistrationVisibility(r.id, editionId + 999, false);
    expect(await getConsentLog(r.id)).toHaveLength(2);
  });

  it("getConsentLog trie par date (created_at), pas seulement par id d'insertion", async () => {
    const { editionId } = await importTremplin1();
    const r = (await getRegistrationsByEdition(editionId))[0];
    // On insère le 'retire' APRÈS (id plus grand) mais avec une date ANTÉRIEURE :
    // seul un tri par created_at donne l'ordre chronologique attendu.
    await h.pool.query(
      "INSERT INTO tremplin_consent_log(registration_id, action, created_at) VALUES ($1,'accorde','2025-01-01T10:00:00Z')",
      [r.id],
    );
    await h.pool.query(
      "INSERT INTO tremplin_consent_log(registration_id, action, created_at) VALUES ($1,'retire','2025-01-01T09:00:00Z')",
      [r.id],
    );
    expect((await getConsentLog(r.id)).map((e) => e.action)).toEqual(["retire", "accorde"]);
  });

  // NB : l'atomicité (rollback de l'UPDATE si l'INSERT du journal échoue) est
  // prouvée de façon déterministe dans tremplin-consent-tx.test.ts (client mické) —
  // pg-mem ne restitue pas fidèlement un ROLLBACK sur client de pool.
});

describe("photos admin (réel)", () => {
  it("ajout atomique + tag scopé + publication soumise au consentement + suppression scopée", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    // Ajout + tag en une transaction ; l'id étranger (999999) est ignoré.
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://x.fr/podium.jpg", legende: "Podium", kind: "podium" },
      [regs[0].id, regs[1].id, 999999],
    );
    expect((await getPhotoPersons(photoId)).sort((a, b) => a - b)).toEqual(
      [regs[0].id, regs[1].id].sort((a, b) => a - b),
    );
    // Inventaire batché par édition.
    expect((await getPhotoPersonsByEdition(editionId)).get(photoId)?.sort((a, b) => a - b)).toEqual(
      [regs[0].id, regs[1].id].sort((a, b) => a - b),
    );

    // Toutes publiques au seed → photo publiable.
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).toContain(photoId);

    // Une personne taguée retire son consentement → photo masquée du public.
    await setRegistrationVisibility(regs[0].id, editionId, false);
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).not.toContain(photoId);

    // Suppression scopée à l'édition (mauvaise édition → false, rien fait).
    expect(await deletePhoto(photoId, editionId + 999)).toBe(false);
    expect(await deletePhoto(photoId, editionId)).toBe(true);
    expect(await getPhotosByEdition(editionId)).toHaveLength(0);
  });

  it("setPhotoPersons REMPLACE l'inventaire (delete-then-insert) et reste scopé", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://x.fr/p.jpg", legende: null, kind: "soiree" },
      [regs[0].id, regs[1].id],
    );

    // Remplace [0,1] par [2] (pas d'union).
    expect(await setPhotoPersons(photoId, editionId, [regs[2].id])).toBe(true);
    expect(await getPhotoPersons(photoId)).toEqual([regs[2].id]);

    // Liste vide → efface tous les tags.
    expect(await setPhotoPersons(photoId, editionId, [])).toBe(true);
    expect(await getPhotoPersons(photoId)).toEqual([]);

    // Photo d'une autre édition → false, rien modifié.
    expect(await setPhotoPersons(photoId, editionId + 999, [regs[0].id])).toBe(false);
  });
});

describe("création d'édition pour une autre conférence (réel)", () => {
  const devoxx2027 = {
    nom: "Tremplin 2027",
    annee: 2027,
    confSlug: "devoxx-france",
    statut: "preparation" as const,
    description: null,
    confNom: "Devoxx",
    confLieu: "France",
    confDate: null,
    confLien: null,
    finaleDate: null,
    finaleLieu: null,
    inscriptionsDebut: null,
    inscriptionsFin: null,
  conferenceEditionId: null,
  };

  it("en préparation : visible en admin mais INVISIBLE du public ; ouverte : publiée", async () => {
    await importTremplin1();
    const id = await createEdition(devoxx2027);

    // Admin : listée. Public : ni page d'édition, ni hub.
    expect((await listEditions()).some((e) => e.id === id)).toBe(true);
    expect(await publicDto("devoxx-france", 2027)).toBeNull();
    expect(await getEditionsByConfSlug("devoxx-france")).toEqual([]);

    // L'orga édite les champs (updateEdition, SANS le statut) puis OUVRE via
    // setEditionStatut (fonction dédiée) → l'édition devient publique.
    expect(await updateEdition(id, { ...devoxx2027, finaleLieu: "Paris" })).toBe(true);
    expect(await setEditionStatut(id, "ouvert")).toBe(true);
    const pub = await publicDto("devoxx-france", 2027);
    expect(pub).not.toBeNull();
    expect(pub!.counts).toEqual({
      inscrites: 0, finalistes: 0, gagnantes: 0, accompagnees: 0,
    });
    expect(pub!.finaleLieu).toBe("Paris"); // champ édité relu en base
    expect((await getEditionsByConfSlug("devoxx-france")).map((e) => e.id)).toEqual([id]);

    // Id inexistant → false, rien modifié.
    expect(await updateEdition(999999, { ...devoxx2027 })).toBe(false);
    expect(await setEditionStatut(999999, "archive")).toBe(false);
  });

  it("doublon (conf, année) refusé par la contrainte UNIQUE", async () => {
    await createEdition(devoxx2027);
    await expect(createEdition(devoxx2027)).rejects.toThrow(/duplicate|unique/i);
  });

  it("la fenêtre d'inscriptions est persistée puis relue (création ET mise à jour)", async () => {
    // pg-mem renvoie les DATE en objets Date (le vrai driver, en chaîne via le
    // type parser de db.ts) : on normalise pour comparer la valeur calendaire.
    const iso = (v: unknown) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : v;
    const id = await createEdition({
      ...devoxx2027,
      inscriptionsDebut: "2027-01-10",
      inscriptionsFin: "2027-02-28",
    conferenceEditionId: null,
    });
    const created = await getEditionById(id);
    expect(iso(created?.inscriptionsDebut)).toBe("2027-01-10");
    expect(iso(created?.inscriptionsFin)).toBe("2027-02-28");

    // L'orga décale la fenêtre : relu en base.
    expect(
      await updateEdition(id, {
        ...devoxx2027,
        inscriptionsDebut: "2027-01-15",
        inscriptionsFin: null,
      conferenceEditionId: null,
      }),
    ).toBe(true);
    const updated = await getEditionById(id);
    expect(iso(updated?.inscriptionsDebut)).toBe("2027-01-15");
    expect(updated?.inscriptionsFin).toBeNull();
  });

  it("listConferences dédoublonne par slug (nom/site les plus récents) et trie par nom", async () => {
    await importTremplin1(); // devfest-toulouse (2026)
    await createEdition(devoxx2027); // devoxx-france
    await createEdition({
      ...devoxx2027,
      nom: "Tremplin 2028",
      annee: 2028, // 2e édition de la MÊME conf, renommée → une seule entrée
      confNom: "Devoxx FR",
      confLien: "https://devoxx.fr",
    });

    const confs = await listConferences();
    expect(confs.map((c) => c.confSlug)).toEqual(["devfest-toulouse", "devoxx-france"]);
    const devoxx = confs.find((c) => c.confSlug === "devoxx-france");
    // Le nom, le lieu et le site viennent de l'édition la plus récente (2028).
    expect(devoxx?.confNom).toBe("Devoxx FR");
    expect(devoxx?.confLieu).toBe("France");
    expect(devoxx?.confLien).toBe("https://devoxx.fr");
  });
});

describe("éditions par conférence (réel)", () => {
  it("liste les éditions d'une conf, la plus récente d'abord", async () => {
    await importTremplin1(); // crée l'édition 2026 (devfest-toulouse)
    await createEdition({
      nom: "Tremplin 2025",
      annee: 2025,
      confSlug: "devfest-toulouse",
      statut: "archive",
      description: null,
      confNom: "DevFest",
      confLieu: "Toulouse",
      confDate: null,
      confLien: null,
      finaleDate: null,
      finaleLieu: null,
    });

    const eds = await getEditionsByConfSlug("devfest-toulouse");
    // Comportement, pas juste la chaîne SQL : l'ordre doit être décroissant.
    expect(eds.map((e) => e.annee)).toEqual([2026, 2025]);
    // Une conf sans édition → liste vide.
    expect(await getEditionsByConfSlug("devoxx")).toEqual([]);
  });
});

describe("contraintes (réel)", () => {
  it("CHECK registration_identite : ni compte ni nom → rejet", async () => {
    const { editionId } = await importTremplin1();
    await expect(
      h.pool.query(
        "INSERT INTO tremplin_registrations(edition_id, statut) VALUES($1, 'en_attente')",
        [editionId],
      ),
    ).rejects.toThrow();
  });

  it("CHECK document_a_un_support : ni lien ni contenu → rejet", async () => {
    const { editionId } = await importTremplin1();
    await expect(
      addDocument(editionId, {
        atelierId: null, registrationId: null, auteurId: null,
        type: "autre", titre: "vide", lien: null, contenu: null,
      }),
    ).rejects.toThrow();
  });
});

describe("cascade & RGPD (réel)", () => {
  it("supprimer une édition efface ses ateliers et inscriptions (cascade)", async () => {
    const { editionId } = await importTremplin1();
    await h.pool.query("DELETE FROM tremplin_editions WHERE id = $1", [editionId]);
    expect((await getAteliersByEdition(editionId)).length).toBe(0);
    expect((await getRegistrationsByEdition(editionId)).length).toBe(0);
  });

  it("suppression de compte : SET NULL garde l'inscription (nom conservé, pas de violation CHECK)", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Gagnante", "gagnante@example.fr");
    const regs = await getRegistrationsByEdition(editionId);
    await attachUserToRegistration(regs[0].id, userId, editionId);

    // Ne doit PAS lever (le nom figé satisfait le CHECK après SET NULL).
    await expect(effacerCompteEnBase(userId)).resolves.toBeUndefined();

    const after = await getRegistrationsByEdition(editionId);
    expect(after.length).toBe(8); // palmarès conservé
    const reg = after.find((r) => r.id === regs[0].id);
    expect(reg?.userId).toBeNull(); // compte détaché
    expect(reg?.participanteNom).toBeTruthy(); // nom conservé (finaliste publique)
  });

  it("suppression de compte : une inscription NON publique conservée est ANONYMISÉE (droit à l'effacement)", async () => {
    const { editionId } = await importTremplin1();
    const userId = await newUser("Discrète", "discrete@example.fr");
    const regs = await getRegistrationsByEdition(editionId);
    // Inscription rattachée, données perso saisies, mais PAS publique.
    await attachUserToRegistration(regs[0].id, userId, editionId);
    await setRegistrationVisibility(regs[0].id, editionId, false);
    // Données perso résiduelles sur l'inscription (colonnes héritées, plus
    // éditées par l'orga) : posées directement pour vérifier leur effacement.
    await h.pool.query(
      `UPDATE tremplin_registrations
          SET bio = 'Ma bio privée', site_web = 'https://moi.fr', photo_url = 'https://moi.fr/p.jpg'
        WHERE id = $1`,
      [regs[0].id],
    );

    await effacerCompteEnBase(userId);

    const reg = (await getRegistrationsByEdition(editionId)).find((r) => r.id === regs[0].id);
    expect(reg).toBeDefined(); // la ligne subsiste (compteur anonyme)
    expect(reg?.userId).toBeNull();
    expect(reg?.public).toBe(false);
    // Plus AUCUNE donnée perso : nom neutre, champs vidés.
    expect(reg?.participanteNom).toBe("Participante (compte supprimé)");
    expect(reg?.bio).toBeNull();
    expect(reg?.siteWeb).toBeNull();
    expect(reg?.photoUrl).toBeNull();
    expect(reg?.participanteLinkedin).toBeNull();
  });
});

describe("récompenses attribuables et suivies (réel)", () => {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

  it("crée, liste (rangs d'abord) et met à jour une récompense, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const meetup = await addRecompense(editionId, {
      intitule: "Un talk en meetup",
      detail: null,
      rang: null,
    });
    const devfest = await addRecompense(editionId, {
      intitule: "Une présentation au DevFest Toulouse",
      detail: "Salle communauté",
      rang: 1,
    });

    const liste = await getRecompensesByEdition(editionId);
    // Les lots du podium d'abord (rang croissant), puis les sans-rang.
    expect(liste.map((r) => r.id)).toEqual([devfest, meetup]);
    expect(liste[0]).toMatchObject({
      intitule: "Une présentation au DevFest Toulouse",
      detail: "Salle communauté",
      rang: 1,
      beneficiaireRegistrationId: null,
      beneficiaireNom: null,
      motif: null,
      statut: "a_organiser",
    });

    // Mise à jour scopée : une autre édition ne matche pas.
    expect(
      await updateRecompense(devfest, editionId + 999, {
        intitule: "X", detail: null, rang: null,
      }),
    ).toBe(false);
    expect(
      await updateRecompense(devfest, editionId, {
        intitule: "Une présentation au DevFest", detail: null, rang: 1,
      }),
    ).toBe(true);
    expect((await getRecompensesByEdition(editionId))[0].intitule).toBe(
      "Une présentation au DevFest",
    );
  });

  it("attribue à une participante de l'édition (motif tracé), refuse une inscription d'une autre édition", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const id = await addRecompense(editionId, {
      intitule: "Une présentation au DevFest Toulouse", detail: null, rang: 1,
    });

    // Une inscription d'une AUTRE édition ne peut pas être bénéficiaire.
    expect(
      await setRecompenseBeneficiaire(id, editionId + 999, regs[1].id, null),
    ).toBe(false);

    expect(
      await setRecompenseBeneficiaire(
        id, editionId, regs[1].id,
        "1ʳᵉ déjà retenue via le CFP → transmis à la 2ᵉ",
      ),
    ).toBe(true);
    const [r] = await getRecompensesByEdition(editionId);
    expect(r.beneficiaireRegistrationId).toBe(regs[1].id);
    expect(r.beneficiaireNom).toBeTruthy();
    expect(r.motif).toMatch(/CFP/);
    expect(r.attribueeLe).not.toBeNull();

    // Retrait de l'attribution : bénéficiaire, motif et horodatage repartent à zéro.
    expect(await setRecompenseBeneficiaire(id, editionId, null, null)).toBe(true);
    const [apres] = await getRecompensesByEdition(editionId);
    expect(apres.beneficiaireRegistrationId).toBeNull();
    expect(apres.motif).toBeNull();
    expect(apres.attribueeLe).toBeNull();
  });

  it("suit l'organisation de l'événement (statut + date), et la BDD refuse un statut inconnu", async () => {
    const { editionId } = await importTremplin1();
    const id = await addRecompense(editionId, {
      intitule: "Un talk en meetup", detail: null, rang: null,
    });

    expect(await setRecompenseSuivi(id, editionId, "planifiee", "2026-09-10")).toBe(true);
    let [r] = await getRecompensesByEdition(editionId);
    expect(r.statut).toBe("planifiee");
    expect(iso(r.evenementLe)).toBe("2026-09-10");

    expect(await setRecompenseSuivi(id, editionId, "realisee", "2026-09-10")).toBe(true);
    [r] = await getRecompensesByEdition(editionId);
    expect(r.statut).toBe("realisee");

    // Scope : une autre édition ne matche pas.
    expect(await setRecompenseSuivi(id, editionId + 999, "a_organiser", null)).toBe(false);

    // Garde-fou BDD (CHECK) : un statut hors liste est refusé.
    await expect(
      h.pool.query(
        "UPDATE tremplin_recompenses SET statut = 'perdu' WHERE id = $1",
        [id],
      ),
    ).rejects.toThrow();
  });

  it("liste les récompenses d'une participante ; retirer l'inscription détache sans perdre la trace", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const id = await addRecompense(editionId, {
      intitule: "Un talk en meetup", detail: null, rang: null,
    });
    await addRecompense(editionId, { intitule: "Autre lot", detail: null, rang: null });
    await setRecompenseBeneficiaire(id, editionId, regs[2].id, null);

    const siennes = await getRecompensesByRegistration(regs[2].id);
    expect(siennes.map((r) => r.intitule)).toEqual(["Un talk en meetup"]); // jamais celles des autres

    // Retrait de la participante : la récompense reste (suivi, redevabilité), détachée.
    await deleteRegistration(regs[2].id, editionId);
    const [apres] = await getRecompensesByEdition(editionId);
    expect(apres.beneficiaireRegistrationId).toBeNull();
    expect(apres.intitule).toBe("Un talk en meetup");
  });

  it("supprime une récompense, scopé à l'édition", async () => {
    const { editionId } = await importTremplin1();
    const id = await addRecompense(editionId, {
      intitule: "Un talk en meetup", detail: null, rang: null,
    });
    expect(await deleteRecompense(id, editionId + 999)).toBe(false);
    expect(await deleteRecompense(id, editionId)).toBe(true);
    expect(await getRecompensesByEdition(editionId)).toEqual([]);
  });
});

describe("sélecteur de comptes speakeuses (réel)", () => {
  it("liste uniquement les comptes AVEC profil speakeuse, triés par nom", async () => {
    const { getComptesSpeakeuses, getUserById } = await import("@/lib/users");
    const zoe = await newUser("Zoé", "zoe@example.fr");
    const anna = await newUser("Anna", "anna@example.fr");
    const sansProfil = await newUser("Sans Profil", "sans@example.fr");
    await h.pool.query(`INSERT INTO speaker_profiles ("userId") VALUES ($1), ($2)`, [zoe, anna]);

    const comptes = await getComptesSpeakeuses();
    expect(comptes.map((c) => c.name)).toEqual(["Anna", "Zoé"]); // jamais « Sans Profil »

    expect(await getUserById(sansProfil)).toMatchObject({ name: "Sans Profil" });
    expect(await getUserById(999999)).toBeNull();
  });
});

describe("parcours : phase d'entrée + présences aux ateliers (réel)", () => {
  it("phase d'entrée : défaut phase 1, posable à l'inscription, modifiable et scopée", async () => {
    const { setRegistrationPhase } = await import("@/lib/tremplin-registrations");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    expect(regs[0].phaseEntree).toBe("cfp_et_pitch"); // reprise = phase 1

    // Ajout post-finale : la phase d'entrée est posée à l'inscription.
    const userId = await newUser("Prise CFP", "cfp@example.fr");
    await registerUserToEdition(editionId, userId, "montee_sur_scene");
    const apres = await getRegistrationsByEdition(editionId);
    const nouvelle = apres.find((r) => r.userId === userId);
    expect(nouvelle?.phaseEntree).toBe("montee_sur_scene");

    // Modifiable sur la fiche, scopé à l'édition.
    expect(await setRegistrationPhase(nouvelle!.id, editionId + 999, "finale")).toBe(false);
    expect(await setRegistrationPhase(nouvelle!.id, editionId, "finale")).toBe(true);

    // Garde-fou BDD : une phase hors liste est refusée.
    await expect(
      h.pool.query(`UPDATE tremplin_registrations SET phase_entree = 'phase9' WHERE id = $1`, [
        nouvelle!.id,
      ]),
    ).rejects.toThrow();
  });

  it("présences : non renseignée par défaut, pointage scopé, « venues » dérivé", async () => {
    const { getAtelierPresences, setAtelierPresences, getVenuesByEdition } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Pitch", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [regs[0].id, regs[1].id],
    );

    // Tri-état : on ne devine pas.
    const avant = await getAtelierPresences(atelierId);
    expect(avant.map((p) => p.presence)).toEqual(["non_renseignee", "non_renseignee"]);
    expect((await getVenuesByEdition(editionId)).size).toBe(0);

    // Pointage : scopé à l'édition (autre édition = refus, rien d'écrit).
    expect(
      await setAtelierPresences(atelierId, editionId + 999, [
        { registrationId: regs[0].id, presence: "presente" },
      ]),
    ).toBe(false);
    expect(
      await setAtelierPresences(atelierId, editionId, [
        { registrationId: regs[0].id, presence: "presente" },
        { registrationId: regs[1].id, presence: "absente" },
      ]),
    ).toBe(true);

    const venues = await getVenuesByEdition(editionId);
    expect(venues.has(regs[0].id)).toBe(true); // présente à ≥ 1 atelier
    expect(venues.has(regs[1].id)).toBe(false); // absente ≠ venue
  });

  it("recomposer un atelier PRÉSERVE les présences des membres conservés", async () => {
    const { getAtelierPresences, setAtelierPresences } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Voix", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [regs[0].id, regs[1].id],
    );
    await setAtelierPresences(atelierId, editionId, [
      { registrationId: regs[0].id, presence: "presente" },
    ]);

    // On retire regs[1], on ajoute regs[2] : la présence de regs[0] survit.
    expect(await setAtelierMembers(atelierId, editionId, [regs[0].id, regs[2].id])).toBe(true);
    const apres = await getAtelierPresences(atelierId);
    expect(apres.find((p) => p.registrationId === regs[0].id)?.presence).toBe("presente");
    expect(apres.find((p) => p.registrationId === regs[2].id)?.presence).toBe("non_renseignee");
    expect(apres.find((p) => p.registrationId === regs[1].id)).toBeUndefined();
  });

  const sousGroupesAtelier = (titre: string, over = {}) => ({
    ordre: 0, titre, date: null, dateFin: null, heureDebut: null, heureFin: null,
    description: null, lienVisio: null, coachs: null, nature: "sous_groupes" as const, ...over,
  });

  it("sous-groupes : création scopée à l'édition, affectation (invariant membre), lecture", async () => {
    const { createSousGroupe, getSousGroupesByAtelier, assignMembreSousGroupe } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Revue croisée"), []);

    // Création scopée : une autre édition ne matche pas.
    expect(await createSousGroupe(atelierId, editionId + 999)).toBeNull();
    const sg1 = await createSousGroupe(atelierId, editionId);
    expect(sg1).not.toBeNull();

    // Ranger une participante la rend membre de l'atelier (invariant) ET la range.
    expect(await assignMembreSousGroupe(atelierId, editionId, regs[0].id, sg1!)).toBe(true);
    expect(await assignMembreSousGroupe(atelierId, editionId, regs[1].id, sg1!)).toBe(true);
    const groupes = await getSousGroupesByAtelier(atelierId);
    expect(groupes).toHaveLength(1);
    expect(new Set(groupes[0].membres)).toEqual(new Set([regs[0].id, regs[1].id]));

    // Un sous-groupe d'un AUTRE atelier est refusé (pas d'affectation croisée).
    const autre = await createAtelierWithMembers(editionId, sousGroupesAtelier("Autre"), []);
    const sgAutre = await createSousGroupe(autre, editionId);
    expect(await assignMembreSousGroupe(atelierId, editionId, regs[2].id, sgAutre!)).toBe(false);

    // Retirer du sous-groupe (null) : la participante reste inscrite à l'atelier.
    expect(await assignMembreSousGroupe(atelierId, editionId, regs[0].id, null)).toBe(true);
    expect(new Set((await getSousGroupesByAtelier(atelierId))[0].membres)).toEqual(
      new Set([regs[1].id]),
    );
  });

  it("sous-groupes : l'avancement d'une édition compte AUSSI les participantes rangées", async () => {
    // C'est ce compte, face à l'ensemble à couvrir, qui dit s'il reste
    // quelqu'un sans sous-groupe — la question à laquelle sert la répartition.
    const {
      createSousGroupe, assignMembreSousGroupe, getSousGroupesByEdition, setAtelierMembre,
    } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Revue 1"), []);
    const sg = await createSousGroupe(atelierId, editionId);
    await assignMembreSousGroupe(atelierId, editionId, regs[0].id, sg!);
    await assignMembreSousGroupe(atelierId, editionId, regs[1].id, sg!);
    // Membre de l'atelier mais rangée nulle part : elle ne compte PAS comme rangée.
    await setAtelierMembre(atelierId, editionId, regs[2].id, true);

    const etat = (await getSousGroupesByEdition(editionId)).get(atelierId);
    expect(etat).toMatchObject({ total: 1, ranges: 2 });

    // Sortie du sous-groupe : le compte suit.
    await assignMembreSousGroupe(atelierId, editionId, regs[1].id, null);
    expect((await getSousGroupesByEdition(editionId)).get(atelierId)?.ranges).toBe(1);
  });

  it("suppression d'un atelier : scopée, cascadante, et les inscrites RESTENT inscrites", async () => {
    const {
      createSousGroupe, assignMembreSousGroupe, deleteAtelier, getAtelierDeletionCounts,
      getAteliersByEdition, getSousGroupesByAtelier,
    } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("À supprimer"), [
      regs[0].id,
      regs[1].id,
    ]);
    const sg = await createSousGroupe(atelierId, editionId);
    await assignMembreSousGroupe(atelierId, editionId, regs[0].id, sg!);

    // Le périmètre annoncé avant le clic (il décide du palier).
    expect(await getAtelierDeletionCounts(atelierId, editionId)).toMatchObject({
      nbParticipantes: 2,
      nbSousGroupes: 1,
      total: 3,
    });
    // Scopé : un id d'une autre édition n'annonce rien et n'emporte rien.
    expect(await getAtelierDeletionCounts(atelierId, editionId + 999)).toMatchObject({ total: 0 });
    expect(await deleteAtelier(atelierId, editionId + 999)).toBe(false);
    expect((await getAteliersByEdition(editionId)).some((a) => a.id === atelierId)).toBe(true);

    // Suppression : l'atelier, ses membres et ses sous-groupes partent ensemble.
    expect(await deleteAtelier(atelierId, editionId)).toBe(true);
    expect((await getAteliersByEdition(editionId)).some((a) => a.id === atelierId)).toBe(false);
    expect(await getSousGroupesByAtelier(atelierId)).toEqual([]);

    // …mais les personnes restent inscrites à l'édition (on retire une séance,
    // pas des participantes).
    const apres = await getRegistrationsByEdition(editionId);
    expect(apres.map((r) => r.id)).toEqual(expect.arrayContaining([regs[0].id, regs[1].id]));

    // Idempotent : rejouer ne casse rien.
    expect(await deleteAtelier(atelierId, editionId)).toBe(false);
  });

  it("sous-groupe : la participante voit le sien et pose la date ; une non-membre est refusée", async () => {
    const {
      createSousGroupe, assignMembreSousGroupe, getMesSousGroupes, setSousGroupeFaitLeCommeMembre,
    } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const userId = await newUser("Alice", "alice.sg@example.fr");
    await registerUserToEdition(editionId, userId);
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => r.userId === userId)!;
    const atelierId = await createAtelierWithMembers(
      editionId,
      sousGroupesAtelier("Point avec ta coach", { date: "2026-09-14", dateFin: "2026-09-18" }),
      [],
    );
    const sg = await createSousGroupe(atelierId, editionId);
    await assignMembreSousGroupe(atelierId, editionId, reg.id, sg!);

    const mien = await getMesSousGroupes(userId, editionId);
    expect(mien).toHaveLength(1);
    expect(mien[0].sousGroupeId).toBe(sg);
    expect(mien[0].atelierTitre).toBe("Point avec ta coach"); // différencie les liens (RGAA)
    expect(mien[0].faitLe).toBeNull(); // pas encore fait

    // Elle pose la date (membre) → OK, et ça se relit.
    expect(await setSousGroupeFaitLeCommeMembre(sg!, userId, "2026-09-16")).toBe(true);
    expect((await getMesSousGroupes(userId, editionId))[0].faitLe).toBeTruthy();

    // Une autre participante (pas membre du sous-groupe) est refusée (anti-IDOR).
    const autreUser = await newUser("Zoé", "zoe.sg@example.fr");
    expect(await setSousGroupeFaitLeCommeMembre(sg!, autreUser, "2026-09-17")).toBe(false);
  });

  /**
   * Retour orga : « éventuellement une ou plusieurs coachs dedans ». La base n'en
   * acceptait qu'une (`coach_user_id`).
   *
   * L'invariant qui va avec est tenu EN BASE (FK composite, migration 052) : les
   * coachs d'un sous-groupe sont un sous-ensemble de celles de son ATELIER. Sans
   * lui, l'écran — qui ne coche que les coachs de l'atelier — afficherait une
   * liste incomplète, et le prochain enregistrement effacerait la coach absente.
   */
  it("sous-groupe : PLUSIEURS coachs, une par une, prises dans celles de l'atelier", async () => {
    const { createSousGroupe, getSousGroupesByAtelier, setCoachDansSousGroupe } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Revue"), []);
    const sofia = await newUser("Sofia Nguyen", "sofia.sg@example.fr");
    const lucile = await newUser("Lucile Martin", "lucile.sg@example.fr");
    const horsAtelier = await newUser("Hors Atelier", "hors.sg@example.fr");
    expect(await addCoachToAtelier(atelierId, editionId, sofia)).toBe(true);
    expect(await addCoachToAtelier(atelierId, editionId, lucile)).toBe(true);
    const sg = await createSousGroupe(atelierId, editionId);
    const coachsDe = async () =>
      (await getSousGroupesByAtelier(atelierId))[0].coachs.map((c) => c.userId);

    // Deux coachs sur un même sous-groupe : ce que l'ancien modèle interdisait.
    expect(await setCoachDansSousGroupe(sg!, editionId, sofia, true)).toBe(true);
    expect(await setCoachDansSousGroupe(sg!, editionId, lucile, true)).toBe(true);
    expect(new Set(await coachsDe()).size).toBe(2);
    // Le DTO porte leur NOM : les écrans n'ont pas à refaire la correspondance.
    expect((await getSousGroupesByAtelier(atelierId))[0].coachs.map((c) => c.nom)).toEqual([
      "Lucile Martin",
      "Sofia Nguyen",
    ]); // triées par nom : la table de liaison n'a pas d'ordre propre

    // Idempotent (deux clics sur la même case).
    expect(await setCoachDansSousGroupe(sg!, editionId, sofia, true)).toBe(true);
    expect(new Set(await coachsDe()).size).toBe(2);

    // Un compte qui n'est PAS coach de l'atelier est REFUSÉ, id forgé compris.
    expect(await setCoachDansSousGroupe(sg!, editionId, horsAtelier, true)).toBe(false);
    expect(await setCoachDansSousGroupe(sg!, editionId, 999_999, true)).toBe(false);
    expect(new Set(await coachsDe()).size).toBe(2);

    // Scopé à l'édition : un id d'une autre édition ne touche rien.
    expect(await setCoachDansSousGroupe(sg!, editionId + 999, sofia, false)).toBe(false);
    expect(new Set(await coachsDe()).size).toBe(2);

    // Retrait, puis « autonome » — état NORMAL d'une revue croisée.
    expect(await setCoachDansSousGroupe(sg!, editionId, sofia, false)).toBe(true);
    expect(await coachsDe()).toEqual([lucile]);
    expect(await setCoachDansSousGroupe(sg!, editionId, lucile, false)).toBe(true);
    expect(await coachsDe()).toEqual([]);
  });

  /**
   * Le miroir `coach_user_id` survit à la migration 052 pour la fenêtre
   * expand/contract. Il doit être une FONCTION de la table de liaison, pas de la
   * demande : un test qui coche une coach valide en premier passerait même avec
   * un miroir écrit depuis l'entrée du formulaire. On vérifie donc les cas où la
   * demande et le réel DIFFÈRENT.
   */
  it("le miroir `coach_user_id` suit la table de liaison, par tous les chemins", async () => {
    const { createSousGroupe, setCoachDansSousGroupe } = await import("@/lib/tremplin-ateliers");
    const { pool } = await import("@/lib/db");
    const { editionId } = await importTremplin1();
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Miroir"), []);
    // Deux coachs dont on connaît l'ordre des ids : le miroir porte la PREMIÈRE,
    // définie comme le plus petit `user_id` — arbitraire mais STABLE.
    const premiere = await newUser("Aaa Miroir", "aaa.miroir@example.fr");
    const seconde = await newUser("Bbb Miroir", "bbb.miroir@example.fr");
    const horsAtelier = await newUser("Hors Miroir", "hors.miroir@example.fr");
    await addCoachToAtelier(atelierId, editionId, premiere);
    await addCoachToAtelier(atelierId, editionId, seconde);
    const sg = await createSousGroupe(atelierId, editionId);
    const miroir = async () => {
      const { rows } = await pool.query(
        `SELECT coach_user_id FROM tremplin_atelier_sous_groupes WHERE id = $1`,
        [sg],
      );
      return (rows[0] as { coach_user_id: number | null }).coach_user_id;
    };

    // Une coach REFUSÉE ne doit pas atterrir dans le miroir : c'est le cas que
    // n'attrape pas un miroir écrit depuis la demande.
    expect(await setCoachDansSousGroupe(sg!, editionId, horsAtelier, true)).toBe(false);
    expect(await miroir()).toBeNull();

    // On pose la SECONDE d'abord : le miroir doit porter la plus petite, donc
    // elle — et basculer quand la première arrive.
    await setCoachDansSousGroupe(sg!, editionId, seconde, true);
    expect(await miroir()).toBe(seconde); // seule en place, donc la « première »
    await setCoachDansSousGroupe(sg!, editionId, premiere, true);
    expect(await miroir()).toBe(Math.min(premiere, seconde));

    // L'invariant vit EN BASE, pas seulement dans le code : une écriture brute
    // qui le violerait est refusée par la FK composite (migration 052). C'est ce
    // qui garantit qu'aucun autre chemin — script, psql, seed — ne peut laisser
    // une coach invisible dans un sous-groupe, puis effacée sans un mot.
    await expect(
      pool.query(
        `INSERT INTO tremplin_sous_groupe_coachs (sous_groupe_id, atelier_id, user_id)
         VALUES ($1, $2, $3)`,
        [sg, atelierId, horsAtelier],
      ),
    ).rejects.toThrow();

    // Retirer celle que porte le miroir : il passe à l'autre, PAS à NULL.
    await setCoachDansSousGroupe(sg!, editionId, Math.min(premiere, seconde), false);
    expect(await miroir()).toBe(Math.max(premiere, seconde));

    // Plus personne : le miroir se vide, ce qui rend la reprise de la migration
    // rejouable sans jamais ressusciter une coach retirée.
    await setCoachDansSousGroupe(sg!, editionId, Math.max(premiere, seconde), false);
    expect(await miroir()).toBeNull();
  });

  it("retirer une coach de l'atelier la retire de ses sous-groupes (CASCADE) et recale le miroir", async () => {
    // L'invariant est une FK composite : la base fait le nettoyage, donc il ne
    // peut pas se désynchroniser. Le miroir, lui, est recalculé par le code.
    const { createSousGroupe, getSousGroupesByAtelier, setCoachDansSousGroupe } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { pool } = await import("@/lib/db");
    const { editionId } = await importTremplin1();
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Points"), []);
    const sofia = await newUser("Sofia Retrait", "sofia.retrait@example.fr");
    const lucile = await newUser("Lucile Retrait", "lucile.retrait@example.fr");
    await addCoachToAtelier(atelierId, editionId, sofia);
    await addCoachToAtelier(atelierId, editionId, lucile);
    const sg = await createSousGroupe(atelierId, editionId);
    await setCoachDansSousGroupe(sg!, editionId, sofia, true);
    await setCoachDansSousGroupe(sg!, editionId, lucile, true);

    expect(await removeCoachFromAtelier(atelierId, editionId, sofia)).toBe(true);
    expect((await getSousGroupesByAtelier(atelierId))[0].coachs.map((c) => c.userId)).toEqual([
      lucile,
    ]);
    const { rows } = await pool.query(
      `SELECT coach_user_id FROM tremplin_atelier_sous_groupes WHERE id = $1`,
      [sg],
    );
    expect((rows[0] as { coach_user_id: number | null }).coach_user_id).toBe(lucile);
  });

  it("l'avancement d'une édition compte les groupes COACHÉS une seule fois", async () => {
    // Un duo coaché à DEUX compte pour un groupe coaché, pas deux : c'est ce que
    // la dé-duplication assure, et un `COUNT` naïf sur la liaison le raterait.
    const { createSousGroupe, setCoachDansSousGroupe, getSousGroupesByEdition, updateSousGroupe } =
      await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Compte"), []);
    const sofia = await newUser("Sofia Compte", "sofia.compte@example.fr");
    const lucile = await newUser("Lucile Compte", "lucile.compte@example.fr");
    await addCoachToAtelier(atelierId, editionId, sofia);
    await addCoachToAtelier(atelierId, editionId, lucile);
    const coache = await createSousGroupe(atelierId, editionId);
    const autonome = await createSousGroupe(atelierId, editionId);
    await setCoachDansSousGroupe(coache!, editionId, sofia, true);
    await setCoachDansSousGroupe(coache!, editionId, lucile, true);
    // Et l'un des deux est fait : `faits` se compte sur les groupes, pas sur les
    // lignes de coachs.
    await updateSousGroupe(autonome!, editionId, { lienVisio: null, faitLe: "2026-09-16" });

    expect((await getSousGroupesByEdition(editionId)).get(atelierId)).toMatchObject({
      total: 2,
      faits: 1,
      avecCoach: 1,
    });
  });

  it("l'espace de la participante nomme SES coachs (une ou plusieurs), jamais leur e-mail", async () => {
    const { createSousGroupe, assignMembreSousGroupe, getMesSousGroupes, setCoachDansSousGroupe } =
      await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const userId = await newUser("Inès Coachée", "ines.coachee@example.fr");
    await registerUserToEdition(editionId, userId);
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => r.userId === userId)!;
    const atelierId = await createAtelierWithMembers(editionId, sousGroupesAtelier("Revue"), []);
    const sofia = await newUser("Sofia Vue", "sofia.vue@example.fr");
    const lucile = await newUser("Lucile Vue", "lucile.vue@example.fr");
    // Une coach INVITÉE par e-mail, sans nom en base tant qu'elle ne s'est pas
    // connectée : elle ne doit pas faire disparaître le coaching de l'écran.
    const sansNom = await newUser("", "sansnom.vue@example.fr");
    await addCoachToAtelier(atelierId, editionId, sofia);
    await addCoachToAtelier(atelierId, editionId, lucile);
    await addCoachToAtelier(atelierId, editionId, sansNom);
    const sg = await createSousGroupe(atelierId, editionId);
    await assignMembreSousGroupe(atelierId, editionId, reg.id, sg!);
    await setCoachDansSousGroupe(sg!, editionId, sofia, true);
    await setCoachDansSousGroupe(sg!, editionId, lucile, true);
    await setCoachDansSousGroupe(sg!, editionId, sansNom, true);

    const mien = await getMesSousGroupes(userId, editionId);
    expect(new Set(mien[0].coachNoms)).toEqual(new Set(["Sofia Vue", "Lucile Vue"]));
    // Le COMPTE inclut la coach encore sans nom : « autonome » serait faux.
    expect(mien[0].nbCoachs).toBe(3);
    // Aucun e-mail ne sort vers l'espace d'une participante (relais uniquement).
    expect(JSON.stringify(mien)).not.toContain("@example.fr");
  });

  it("getAtelierMembersByEdition porte la présence de chaque membre (anti N+1 du tableau de bord)", async () => {
    const { getAtelierMembersByEdition, setAtelierPresences } = await import(
      "@/lib/tremplin-ateliers"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Pitch", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [regs[0].id, regs[1].id],
    );
    await setAtelierPresences(atelierId, editionId, [
      { registrationId: regs[0].id, presence: "presente" },
    ]);

    const parAtelier = await getAtelierMembersByEdition(editionId);
    const membres = parAtelier.get(atelierId) ?? [];
    expect(membres.find((m) => m.registrationId === regs[0].id)?.presence).toBe("presente");
    expect(membres.find((m) => m.registrationId === regs[1].id)?.presence).toBe("non_renseignee");
  });
});

describe("interrupteur membre d'atelier (réel)", () => {
  it("ajoute/retire une inscrite, scopé, idempotent et PRÉSERVE la présence pointée", async () => {
    const { createAtelierWithMembers, getAtelierMembers, setAtelierMembre, setAtelierPresences, getAtelierPresences } =
      await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Slides", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [], // ouvert à toutes au départ
    );

    // Ajout d'une inscrite (réserve l'atelier), scopé à l'édition.
    expect(await setAtelierMembre(atelierId, editionId + 999, regs[0].id, true)).toBe(false);
    expect(await setAtelierMembre(atelierId, editionId, regs[0].id, true)).toBe(true);
    expect(await getAtelierMembers(atelierId)).toEqual([regs[0].id]);

    // On pointe sa présence, puis on la ré-ajoute (idempotent) : la présence survit.
    await setAtelierPresences(atelierId, editionId, [{ registrationId: regs[0].id, presence: "presente" }]);
    expect(await setAtelierMembre(atelierId, editionId, regs[0].id, true)).toBe(true);
    expect((await getAtelierPresences(atelierId)).find((p) => p.registrationId === regs[0].id)?.presence).toBe("presente");

    // Retrait.
    expect(await setAtelierMembre(atelierId, editionId, regs[0].id, false)).toBe(true);
    expect(await getAtelierMembers(atelierId)).toEqual([]);
  });

  it("marquer présente une NON-membre l'ajoute d'abord (présente ⊂ membre, atomique)", async () => {
    const { createAtelierWithMembers, getAtelierMembers, setAtelierPresence, getAtelierPresences } =
      await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Pitch", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [], // personne au départ
    );

    // Présente sur une non-membre : l'appartenance est créée dans la même
    // transaction, la présence n'est pas perdue.
    expect(await setAtelierPresence(atelierId, editionId, regs[0].id, "presente")).toBe(true);
    expect(await getAtelierMembers(atelierId)).toEqual([regs[0].id]);
    expect((await getAtelierPresences(atelierId)).find((p) => p.registrationId === regs[0].id)?.presence).toBe("presente");

    // Scopé à l'édition.
    expect(await setAtelierPresence(atelierId, editionId + 999, regs[1].id, "presente")).toBe(false);
  });
});

describe("appartenance multi-phase (réel)", () => {
  it("toute inscription entre en phase 1 par défaut, et l'appartenance se pose/retire par phase, scopée à l'édition", async () => {
    const {
      getPhaseMembersByEdition,
      setRegistrationPhaseMembership,
    } = await import("@/lib/tremplin-registration-phases");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    // Reprise + création : chaque inscrite entre en phase 1 par défaut.
    const membres = await getPhaseMembersByEdition(editionId);
    expect(membres.get(regs[0].id)?.has("cfp_et_pitch")).toBe(true);
    expect(membres.get(regs[0].id)?.has("montee_sur_scene")).toBe(false);

    // Ajout de la phase 3 (indépendante).
    expect(
      await setRegistrationPhaseMembership(regs[0].id, editionId, "montee_sur_scene", true),
    ).toBe(true);
    // Idempotent (deux fois = pas de doublon, PK compose).
    expect(
      await setRegistrationPhaseMembership(regs[0].id, editionId, "montee_sur_scene", true),
    ).toBe(true);
    let m = await getPhaseMembersByEdition(editionId);
    expect([...(m.get(regs[0].id) ?? [])].sort()).toEqual(["cfp_et_pitch", "montee_sur_scene"]);

    // Retrait de la phase 1.
    expect(
      await setRegistrationPhaseMembership(regs[0].id, editionId, "cfp_et_pitch", false),
    ).toBe(true);
    m = await getPhaseMembersByEdition(editionId);
    expect([...(m.get(regs[0].id) ?? [])]).toEqual(["montee_sur_scene"]);

    // Scopé à l'édition : une autre édition ne touche rien (0 ligne vérifiée).
    expect(
      await setRegistrationPhaseMembership(regs[0].id, editionId + 999, "cfp_et_pitch", true),
    ).toBe(false);
    m = await getPhaseMembersByEdition(editionId);
    expect([...(m.get(regs[0].id) ?? [])]).toEqual(["montee_sur_scene"]);
  });

  it("garde-fou BDD : une phase hors liste est refusée ; la cascade suit la suppression d'inscription", async () => {
    const { setRegistrationPhaseMembership } = await import(
      "@/lib/tremplin-registration-phases"
    );
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);

    await expect(
      h.pool.query(
        `INSERT INTO tremplin_registration_phases (registration_id, phase) VALUES ($1, 'phase9')`,
        [regs[0].id],
      ),
    ).rejects.toThrow();

    // CASCADE : retirer l'inscription efface ses appartenances.
    await setRegistrationPhaseMembership(regs[0].id, editionId, "montee_sur_scene", true);
    await h.pool.query(`DELETE FROM tremplin_registrations WHERE id = $1`, [regs[0].id]);
    const { rows } = await h.pool.query(
      `SELECT 1 FROM tremplin_registration_phases WHERE registration_id = $1`,
      [regs[0].id],
    );
    expect(rows.length).toBe(0);
  });
});

describe("jury d'une édition (réel, RGPD)", () => {
  it("ajout, listes orga (avec e-mail) / publique (SANS e-mail), retrait scopé, cascade", async () => {
    const {
      getJuryByEdition,
      getPublicJuryByEdition,
      addJury,
      deleteJury,
    } = await import("@/lib/tremplin-jury");
    const { editionId } = await importTremplin1();

    const id = await addJury(editionId, {
      nom: "Lovelace",
      prenom: "Ada",
      fonction: "Directrice technique",
      entreprise: "Acme",
      email: "ada@example.fr",
    });
    // Juré sans compte, sans e-mail : tous les champs sauf nom sont optionnels.
    await addJury(editionId, {
      nom: "Hopper",
      prenom: null,
      fonction: null,
      entreprise: null,
      email: null,
    });

    // Vue orga : e-mail inclus.
    const orga = await getJuryByEdition(editionId);
    expect(orga.length).toBe(2);
    expect(orga.find((j) => j.id === id)?.email).toBe("ada@example.fr");

    // Vue publique : PAS d'e-mail (ni d'id) dans le DTO sérialisé.
    const publique = await getPublicJuryByEdition(editionId);
    expect(publique.length).toBe(2);
    for (const j of publique) {
      expect(j).not.toHaveProperty("email");
      expect(j).not.toHaveProperty("id");
    }
    expect(publique.find((j) => j.nom === "Lovelace")?.entreprise).toBe("Acme");

    // Retrait scopé à l'édition : une autre édition ne retire rien.
    expect(await deleteJury(id, editionId + 999)).toBe(false);
    expect((await getJuryByEdition(editionId)).length).toBe(2);
    expect(await deleteJury(id, editionId)).toBe(true);
    expect((await getJuryByEdition(editionId)).length).toBe(1);

    // Cascade : supprimer l'édition efface son jury.
    await h.pool.query(`DELETE FROM tremplin_editions WHERE id = $1`, [editionId]);
    expect((await getJuryByEdition(editionId)).length).toBe(0);
  });
});

describe("suppression d'édition (réel)", () => {
  const edInput = (o: Partial<Parameters<typeof createEdition>[0]> & { nom: string; annee: number }) => ({
    confSlug: `conf-${o.annee}`,
    statut: "archive" as const,
    description: null,
    confNom: "Conf Test",
    confLieu: null,
    confDate: null,
    confLien: null,
    finaleDate: null,
    finaleLieu: null,
    ...o,
  });

  it("publiée → soft-delete : coquille + deleted_at gardés, données filles effacées, tombstone public, hors listes", async () => {
    const { addJury, getJuryByEdition } = await import("@/lib/tremplin-jury");
    const editionId = await createEdition(edInput({ nom: "Édition publiée", annee: 2099, confSlug: "conf-pub" }));
    const autre = await createEdition(edInput({ nom: "Autre", annee: 2098, confSlug: "conf-autre" }));
    const atelierId = await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "A", date: null, heureDebut: null, heureFin: null, description: null, lienVisio: null, coachs: null },
      [],
    );
    await addJury(editionId, { nom: "Lovelace", prenom: "Ada", fonction: null, entreprise: null, email: null });

    expect(await deleteEdition(editionId)).toBe("soft");

    // Coquille tombstone : la ligne existe, deleted_at renseigné.
    const shell = await h.pool.query(`SELECT deleted_at FROM tremplin_editions WHERE id = $1`, [editionId]);
    expect(shell.rows.length).toBe(1);
    expect((shell.rows[0] as { deleted_at: unknown }).deleted_at).not.toBeNull();
    // Données filles effacées.
    expect((await getAteliersByEdition(editionId)).length).toBe(0);
    expect((await getJuryByEdition(editionId)).length).toBe(0);
    void atelierId;
    // Hors listes admin, tombstone public.
    expect(await getEditionById(editionId)).toBeNull();
    expect((await listEditions()).some((e) => e.id === editionId)).toBe(false);
    expect(await getPublicEdition("conf-pub", 2099)).toBe("deleted");
    // L'autre édition est intacte.
    expect(await getEditionById(autre)).not.toBeNull();

    // Re-supprimer une édition déjà supprimée → introuvable.
    expect(await deleteEdition(editionId)).toBe("introuvable");
  });

  it("préparation → hard-delete : la ligne disparaît entièrement", async () => {
    const editionId = await createEdition(edInput({ nom: "Brouillon", annee: 2097, confSlug: "conf-prep", statut: "preparation" }));
    expect(await deleteEdition(editionId)).toBe("hard");
    const { rows } = await h.pool.query(`SELECT 1 FROM tremplin_editions WHERE id = $1`, [editionId]);
    expect(rows.length).toBe(0);
    expect(await deleteEdition(999999)).toBe("introuvable");
  });

  it("ménage RGPD : le stub invité orphelin est supprimé, le compte encore rattaché ailleurs est gardé", async () => {
    const editionId = await createEdition(edInput({ nom: "Édition A", annee: 2096, confSlug: "conf-a" }));
    const autre = await createEdition(edInput({ nom: "Édition B", annee: 2095, confSlug: "conf-b" }));
    const stub = await newUser("", "stub@example.fr"); // invité jamais connecté, seulement A
    const encoreLa = await newUser("Ada", "ada2@example.fr"); // rattaché à A ET B
    const connectee = await newUser("Lea", "lea@example.fr"); // seulement A, MAIS connectée
    // « Connectée » = invitation honorée (lien magique → emailVerified posé).
    await h.pool.query(`UPDATE users SET "emailVerified" = now() WHERE id = $1`, [connectee]);
    await registerUserToEdition(editionId, stub);
    await registerUserToEdition(editionId, encoreLa);
    await registerUserToEdition(autre, encoreLa);
    await registerUserToEdition(editionId, connectee);

    expect(await deleteEdition(editionId)).toBe("soft");

    const { rows } = await h.pool.query(
      `SELECT id FROM users WHERE email IN ('stub@example.fr', 'ada2@example.fr', 'lea@example.fr')`,
    );
    const ids = (rows as { id: number }[]).map((r) => r.id);
    expect(ids).toContain(encoreLa); // encore rattaché à B → gardé
    expect(ids).toContain(connectee); // s'est connectée (compte réel) → gardée
    expect(ids).not.toContain(stub); // stub jamais connecté, orphelin → nettoyé
  });
});

describe("nom complété sur un compte sans nom (réel)", () => {
  it("un compte existant SANS nom reçoit le nom saisi ; un nom existant n'est JAMAIS écrasé", async () => {
    // Compte pré-créé sans nom (ex. connexion par lien magique).
    await h.pool.query(`INSERT INTO users (email) VALUES ('coach@example.fr')`);

    const a = await getOrCreateUserByEmail("coach@example.fr", "Rachel Dubois");
    expect(a.created).toBe(false);
    expect(a.user.name).toBe("Rachel Dubois"); // complété : l'affichage montre son nom
    const { rows } = await h.pool.query(`SELECT name FROM users WHERE email = 'coach@example.fr'`);
    expect(rows[0].name).toBe("Rachel Dubois");

    // Le nom appartient à la personne : une nouvelle saisie ne l'écrase pas.
    const b = await getOrCreateUserByEmail("coach@example.fr", "Autre Nom");
    expect(b.user.name).toBe("Rachel Dubois");
  });
});

describe("récompenses PUBLIQUES (réel)", () => {
  it("expose intitulés/détails ; la bénéficiaire n'est nommée QUE si elle est publique", async () => {
    const { editionId } = await importTremplin1();
    const edition = await getEditionById(editionId);
    const regs = await getRegistrationsByEdition(editionId);
    const devfest = await addRecompense(editionId, {
      intitule: "Une présentation au DevFest Toulouse",
      detail: "Salle communauté",
      rang: 1,
    });
    const meetup = await addRecompense(editionId, {
      intitule: "Un talk en meetup",
      detail: null,
      rang: null,
    });
    // Bénéficiaire CONSENTIE (publique + finaliste → dans la galerie)
    await setRegistrationVisibility(regs[1].id, editionId, true);
    await setRegistrationFinale(regs[1].id, editionId, true);
    await setRecompenseBeneficiaire(devfest, editionId, regs[1].id, "transmise");
    // Bénéficiaire NON consentie (la reprise seed les finalistes en public :
    // on retire explicitement son consentement)
    await setRegistrationVisibility(regs[2].id, editionId, false);
    await setRecompenseBeneficiaire(meetup, editionId, regs[2].id, null);

    const pub = await publicDto(edition!.confSlug!, edition!.annee);
    expect(pub).not.toBeNull();
    const recs = pub!.recompenses;
    expect(recs.map((r) => r.intitule)).toEqual([
      "Une présentation au DevFest Toulouse",
      "Un talk en meetup",
    ]);
    expect(recs[0].beneficiaireNom).toBeTruthy(); // publique → nommée
    expect(recs[1].beneficiaireNom).toBeNull(); // non consentie → anonyme
    // Le motif (interne) ne sort JAMAIS dans le DTO public.
    expect(JSON.stringify(pub)).not.toMatch(/transmise/);

    // La carte de la bénéficiaire porte la mention de sa récompense.
    const camille = pub!.finalistes.find((f) =>
      f.recompenses.includes("Une présentation au DevFest Toulouse"),
    );
    expect(camille).toBeDefined();
  });
});

describe("photos : tags libres + consentement par tag (réel)", () => {
  it("tague inscription / compte / nom libre, scopé, et libelle chaque personne", async () => {
    const { getPhotoTags, addPhotoTag, removePhotoTag } = await import("@/lib/tremplin-photos");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const juree = await newUser("Jurée Invitée", "juree@example.fr");
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://ex.fr/p.jpg", legende: "Podium", kind: "podium" },
      [regs[0].id],
    );

    expect(await addPhotoTag(photoId, editionId, { userId: juree, consentement: true })).toBe(true);
    expect(
      await addPhotoTag(photoId, editionId, { nomLibre: "Photographe externe", consentement: false }),
    ).toBe(true);
    // Scope : une photo d'une autre édition ne matche pas.
    expect(await addPhotoTag(photoId, editionId + 999, { nomLibre: "X", consentement: false })).toBe(false);
    // Une inscription d'une autre édition non plus.
    expect(
      await addPhotoTag(photoId, editionId, { registrationId: 999999, consentement: false }),
    ).toBe(false);

    const tags = await getPhotoTags(photoId, editionId);
    expect(tags).toHaveLength(3);
    expect(tags.map((t) => t.label)).toContain("Jurée Invitée");
    expect(tags.map((t) => t.label)).toContain("Photographe externe");

    // Retrait ciblé, scopé.
    const externe = tags.find((t) => t.nomLibre === "Photographe externe")!;
    expect(await removePhotoTag(externe.id, editionId + 999)).toBe(false);
    expect(await removePhotoTag(externe.id, editionId)).toBe(true);
    expect(await getPhotoTags(photoId, editionId)).toHaveLength(2);
  });

  it("règle de publication : CHAQUE tag doit être couvert (public OU consentement recueilli)", async () => {
    const { addPhotoTag, setPhotoTagConsent, getPhotoTags } = await import("@/lib/tremplin-photos");
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    await setRegistrationVisibility(regs[0].id, editionId, true); // participante consentie
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://ex.fr/p.jpg", legende: null, kind: "soiree" },
      [regs[0].id],
    );
    // Jurée taguée SANS consentement recueilli → photo bloquée.
    const juree = await newUser("Jurée", "juree2@example.fr");
    await addPhotoTag(photoId, editionId, { userId: juree, consentement: false });
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).not.toContain(photoId);

    // L'orga recueille son accord → publiable.
    const tag = (await getPhotoTags(photoId, editionId)).find((t) => t.userId === juree)!;
    expect(tag.couverte).toBe(false);
    expect(await setPhotoTagConsent(tag.id, editionId, true)).toBe(true);
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).toContain(photoId);

    // Un consentement d'inscription se gère chez ELLE, pas sur le tag.
    const tagReg = (await getPhotoTags(photoId, editionId)).find(
      (t) => t.registrationId === regs[0].id,
    )!;
    expect(tagReg.couverte).toBe(true); // via registration.public
    expect(await setPhotoTagConsent(tagReg.id, editionId, true)).toBe(false);
  });

  it("légende et moment se modifient depuis la fiche, scopé", async () => {
    const { updatePhoto } = await import("@/lib/tremplin-photos");
    const { editionId } = await importTremplin1();
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://ex.fr/p.jpg", legende: null, kind: "autre" },
      [],
    );
    expect(await updatePhoto(photoId, editionId + 999, { legende: "X", kind: "podium" })).toBe(false);
    expect(await updatePhoto(photoId, editionId, { legende: "La remise des prix", kind: "podium" })).toBe(true);
    const photo = (await getPhotosByEdition(editionId)).find((p) => p.id === photoId);
    expect(photo).toMatchObject({ legende: "La remise des prix", kind: "podium" });
  });

  it("suppression d'un compte tagué SANS accord : tag orphelin ANONYME qui bloque encore (SET NULL, pas de cascade)", async () => {
    const { addPhotoTag, getPhotoTags } = await import("@/lib/tremplin-photos");
    const { editionId } = await importTremplin1();
    const juree = await newUser("Jurée Externe", "orpheline@example.fr");
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://ex.fr/jury.jpg", legende: null, kind: "soiree" },
      [],
    );
    // Seule personne taguée, accord NON recueilli → photo bloquée.
    await addPhotoTag(photoId, editionId, { userId: juree, consentement: false });
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).not.toContain(photoId);

    // La jurée supprime son compte : ON DELETE SET NULL (pas de violation du
    // CHECK d'identité, relâché) — le tag SUBSISTE, orphelin et anonyme, au
    // lieu de disparaître en cascade et de laisser republier la photo.
    await expect(effacerCompteEnBase(juree)).resolves.toBeUndefined();

    const tags = await getPhotoTags(photoId, editionId);
    expect(tags).toHaveLength(1);
    expect(tags[0].userId).toBeNull(); // compte détaché
    expect(tags[0].label).toMatch(/Personne n°/); // anonyme
    expect(tags[0].couverte).toBe(false); // toujours bloquant
    // La photo reste PRIVÉE (elle peut encore montrer cette personne).
    expect((await getPublicPhotos(editionId)).map((p) => p.id)).not.toContain(photoId);
  });
});

describe("photo : horodatage du consentement à l'image (preuve RGPD)", () => {
  it("consentement_le est posé à l'accord, effacé au retrait", async () => {
    const { addPhotoTag, setPhotoTagConsent } = await import("@/lib/tremplin-photos");
    const { editionId } = await importTremplin1();
    const juree = await newUser("Jurée", "j@example.fr");
    const photoId = await addPhotoWithPersons(
      editionId,
      { url: "https://ex.fr/p.jpg", legende: null, kind: "soiree" },
      [],
    );
    await addPhotoTag(photoId, editionId, { userId: juree, consentement: false });
    const lire = async () => {
      const { rows } = await h.pool.query(
        `SELECT consentement, consentement_le FROM tremplin_photo_personnes WHERE user_id = $1`,
        [juree],
      );
      return rows[0] as { consentement: boolean; consentement_le: Date | null };
    };
    expect((await lire()).consentement_le).toBeNull(); // pas d'accord → pas d'horodatage

    const { rows } = await h.pool.query(
      `SELECT id FROM tremplin_photo_personnes WHERE user_id = $1`,
      [juree],
    );
    const tagId = (rows[0] as { id: number }).id;
    await setPhotoTagConsent(tagId, editionId, true);
    expect((await lire()).consentement_le).not.toBeNull(); // daté à l'accord

    await setPhotoTagConsent(tagId, editionId, false);
    expect((await lire()).consentement_le).toBeNull(); // effacé au retrait
  });
});

describe("duplication d'une édition (réel)", () => {
  /** Nombre de lignes rattachées à une édition dans une table donnée. */
  async function countFor(table: string, editionId: number): Promise<number> {
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE edition_id = $1`,
      [editionId],
    );
    return (rows[0] as { n: number }).n;
  }

  /** Membres/coachs d'atelier rattachés (via jointure) aux ateliers d'une édition. */
  async function countAtelierJoin(table: string, editionId: number): Promise<number> {
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM ${table} j
         JOIN tremplin_ateliers a ON a.id = j.atelier_id
        WHERE a.edition_id = $1`,
      [editionId],
    );
    return (rows[0] as { n: number }).n;
  }

  /** Source « pleine » : import (édition + 5 ateliers + 8 finalistes) enrichi
   *  d'un atelier restreint avec coachs texte + membre, d'une récompense, d'une
   *  photo taguée et d'un document — de quoi vérifier que RIEN ne traverse. */
  async function sourcePleine(): Promise<number> {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    await createAtelierWithMembers(
      editionId,
      { ordre: 0, titre: "Coaching restreint", date: "2026-05-01", heureDebut: "18:00",
        heureFin: "19:00", description: "Prépa finale", lienVisio: "https://visio.example.fr",
        coachs: "Lucile, Marie", phase: "montee_sur_scene" },
      [regs[0].id],
    );
    await addRecompense(editionId, { intitule: "Talk en meetup", detail: "GDG", rang: null });
    await addPhotoWithPersons(editionId, { url: "https://x.fr/p.jpg", legende: null, kind: "podium" }, [regs[0].id]);
    await addDocument(editionId, {
      atelierId: null, registrationId: null, auteurId: null,
      type: "support_atelier", titre: "Charte", lien: "https://x.fr/c", contenu: null,
    });
    // Jury : des personnes (données personnelles) rattachées à l'édition.
    await addJury(editionId, {
      nom: "Durand", prenom: "Alex", fonction: "CTO", entreprise: "ACME",
      email: "alex@acme.fr",
    });
    return editionId;
  }

  it("même conf, autre année : nouvelle édition en préparation, dates et description vidées", async () => {
    const sourceId = await sourcePleine();
    const source = await getEditionById(sourceId);

    const newId = await duplicateEdition(sourceId, {
      confSlug: source!.confSlug!, annee: 2027,
      nom: "Tremplin 2027", confNom: source!.confNom, confLien: source!.confLien,
    });
    expect(newId).not.toBeNull();

    const copie = await getEditionById(newId!);
    expect(copie).toMatchObject({
      confSlug: "devfest-toulouse", annee: 2027, nom: "Tremplin 2027", statut: "preparation",
      description: null, confDate: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null,
    });
  });

  it("recopie le squelette des ateliers, dates / horaires / visio / coachs vidés, sans membres", async () => {
    const sourceId = await sourcePleine();
    const newId = await duplicateEdition(sourceId, {
      confSlug: "devfest-toulouse", annee: 2027, nom: "Tremplin 2027",
      confNom: "DevFest Toulouse 2027", confLien: null,
    });

    const src = await getAteliersByEdition(sourceId);
    const cop = await getAteliersByEdition(newId!);
    expect(cop).toHaveLength(src.length); // 5 du parcours + 1 restreint
    expect(cop.map((a) => a.titre).sort()).toEqual(src.map((a) => a.titre).sort());
    for (const a of cop) {
      expect(a.date).toBeNull();
      expect(a.heureDebut).toBeNull();
      expect(a.heureFin).toBeNull();
      expect(a.lienVisio).toBeNull();
      expect(a.coachs).toBeNull(); // noms de personnes : jamais recopiés
    }
    // La PHASE (avant / après la soirée) fait partie du squelette : conservée.
    const phaseParTitre = (as: typeof src) => new Map(as.map((a) => [a.titre, a.phase]));
    expect(phaseParTitre(cop)).toEqual(phaseParTitre(src));
    expect(cop.find((a) => a.titre === "Coaching restreint")?.phase).toBe("montee_sur_scene");
    // Aucun membre repris (l'atelier restreint redevient ouvert à toutes).
    expect(await countAtelierJoin("tremplin_atelier_membres", newId!)).toBe(0);
  });

  it("invariant RGPD : la copie ne porte AUCUNE donnée personnelle", async () => {
    const sourceId = await sourcePleine();
    const newId = await duplicateEdition(sourceId, {
      confSlug: "devfest-toulouse", annee: 2027, nom: "Tremplin 2027",
      confNom: null, confLien: null,
    });

    expect(await countFor("tremplin_registrations", newId!)).toBe(0);
    expect(await countFor("tremplin_photos", newId!)).toBe(0);
    expect(await countFor("tremplin_documents", newId!)).toBe(0);
    expect(await countFor("tremplin_recompenses", newId!)).toBe(0);
    expect(await countFor("tremplin_jury", newId!)).toBe(0); // jury = personnes
    expect(await countAtelierJoin("tremplin_atelier_membres", newId!)).toBe(0);
    expect(await countAtelierJoin("tremplin_atelier_coachs", newId!)).toBe(0);
    // La source, elle, est bien pleine (le test vérifie qu'on n'a rien copié,
    // pas qu'il n'y avait rien à copier).
    expect(await countFor("tremplin_registrations", sourceId)).toBeGreaterThan(0);
    expect(await countFor("tremplin_recompenses", sourceId)).toBeGreaterThan(0);
    expect(await countFor("tremplin_photos", sourceId)).toBeGreaterThan(0);
    expect((await getJuryByEdition(sourceId)).length).toBeGreaterThan(0);
  });

  it("autre conférence : reprend le slug / nom / site de la cible", async () => {
    const sourceId = await sourcePleine();
    const newId = await duplicateEdition(sourceId, {
      confSlug: "devoxx-france", annee: 2026, nom: "Tremplin Devoxx 2026",
      confNom: "Devoxx France 2026", confLien: "https://devoxx.fr",
    });

    const copie = await getEditionById(newId!);
    expect(copie).toMatchObject({
      confSlug: "devoxx-france", annee: 2026, confNom: "Devoxx France 2026",
      confLien: "https://devoxx.fr", statut: "preparation",
    });
  });

  it("laisse la source strictement inchangée", async () => {
    const sourceId = await sourcePleine();
    const avant = await getEditionById(sourceId);
    const ateliersAvant = await getAteliersByEdition(sourceId);

    await duplicateEdition(sourceId, {
      confSlug: "devfest-toulouse", annee: 2027, nom: "Tremplin 2027",
      confNom: null, confLien: null,
    });

    expect(await getEditionById(sourceId)).toEqual(avant);
    expect(await getAteliersByEdition(sourceId)).toEqual(ateliersAvant);
  });

  it("conflit (conf, année) : rejet, aucune édition créée (rollback)", async () => {
    const sourceId = await sourcePleine();
    const nbAvant = (await listEditions()).length;

    await expect(
      duplicateEdition(sourceId, {
        confSlug: "devfest-toulouse", annee: 2026, // déjà pris par la source
        nom: "Doublon", confNom: null, confLien: null,
      }),
    ).rejects.toThrow(/duplicate|unique/i);

    expect((await listEditions()).length).toBe(nbAvant); // rien créé
  });

  it("source introuvable : renvoie null, rien créé", async () => {
    const nbAvant = (await listEditions()).length;
    const res = await duplicateEdition(999999, {
      confSlug: "devfest-toulouse", annee: 2027, nom: "X", confNom: null, confLien: null,
    });
    expect(res).toBeNull();
    expect((await listEditions()).length).toBe(nbAvant);
  });
});

/**
 * LES DEUX TEMPS DU PARCOURS, côté public.
 *
 * Une édition se raconte désormais sur deux pages : le Tremplin jusqu'à la
 * soirée finale, puis l'accompagnement vers la scène de la conférence. Le DTO
 * doit donc porter de quoi les séparer (la phase de chaque séance) et de quoi
 * peupler la seconde (les speakeuses accompagnées, les accompagnantes).
 *
 * Le contrat d'anonymat ne bouge pas d'un pouce : un nom de speakeuse suit
 * `r.public` (consentement d'édition horodaté), un nom d'accompagnante suit la
 * publication de SA fiche — la fiche, tenue par l'orga pour celles qui ne se
 * connectent jamais, EST le support du consentement.
 */
describe("Les deux temps du parcours, côté public", () => {
  const mkAtelier = (titre: string) => ({
    ordre: 0, titre, date: null, heureDebut: null, heureFin: null,
    description: null, lienVisio: null, coachs: null,
  });

  /** Une séance montrée sur le site public, dans la phase demandée. Depuis la
   * migration 056, la vitrine se COCHE : régler l'audience ne publie plus. */
  async function seancePublique(
    editionId: number,
    titre: string,
    phase: "cfp_et_pitch" | "montee_sur_scene",
  ): Promise<number> {
    const { createAtelierWithMembers, setAtelierAudience, setAtelierPhase, setAtelierProgrammePublic } =
      await import("@/lib/tremplin-ateliers");
    const id = await createAtelierWithMembers(editionId, mkAtelier(titre), []);
    await setAtelierPhase(id, editionId, phase);
    await setAtelierAudience(id, editionId, "toutes");
    await setAtelierProgrammePublic(id, editionId, true);
    return id;
  }

  it("chaque séance publie sa phase : chaque page ne rend que son parcours", async () => {
    const { editionId } = await importTremplin1();
    await seancePublique(editionId, "Répétition chronométrée", "montee_sur_scene");

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    // La forme du DTO, pas seulement une valeur : c'est elle qui garantit qu'on
    // n'a rien ajouté d'autre au passage (le lieu, par exemple).
    expect(Object.keys(dto.ateliers[0])).toEqual([
      "titre", "date", "dateFin", "description", "phase",
    ]);
    // Les 5 séances du seed sont d'avant la soirée ; la nouvelle est d'après.
    const parPhase = (p: string) =>
      dto.ateliers.filter((a) => a.phase === p).map((a) => a.titre);
    expect(parPhase("cfp_et_pitch")).toHaveLength(5);
    expect(parPhase("montee_sur_scene")).toEqual(["Répétition chronométrée"]);
  });

  /** Rattache une inscription à la phase 3, avec ou sans accord de publication. */
  async function rattacherPhase3(registrationId: number, consent: boolean) {
    await h.pool.query(
      `INSERT INTO tremplin_registration_phases(registration_id, phase, public, public_consent_at)
       VALUES($1, 'montee_sur_scene', $2, CASE WHEN $2 THEN now() END)`,
      [registrationId, consent],
    );
  }

  it("les accompagnées : nommées sur le consentement DE LA PHASE, pas sur celui de la galerie", async () => {
    const { editionId } = await importTremplin1();
    const [consentante, discrete] = await getRegistrationsByEdition(editionId);

    await rattacherPhase3(consentante.id, true);
    await rattacherPhase3(discrete.id, false);
    // Les DEUX sont publiques dans la galerie des finalistes : c'est justement
    // ce consentement-là qu'il ne faut PAS rejouer ici. Sans la colonne dédiée,
    // « discrete » apparaîtrait sur la foi d'un accord qui parlait d'autre chose.
    await setRegistrationVisibility(consentante.id, editionId, true);
    await setRegistrationVisibility(discrete.id, editionId, true);

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    const noms = dto.accompagnees.map((a) => a.nom);
    expect(noms).toContain(consentante.participanteNom);
    expect(noms).not.toContain(discrete.participanteNom);
    // Comptée sans être nommée : l'effectif de la phase reste publié (décision
    // orga du 2026-08-02), la réserve est consignée dans la conception.
    expect(dto.counts.accompagnees).toBe(2);
  });

  it("les accompagnées : le retrait de la galerie et celui de la phase sont indépendants", async () => {
    const { editionId } = await importTremplin1();
    const reg = (await getRegistrationsByEdition(editionId))[0];
    await rattacherPhase3(reg.id, true);
    // Elle sort de la galerie des finalistes : sa présence parmi les
    // accompagnées, consentie à part, tient toujours.
    await setRegistrationVisibility(reg.id, editionId, false);

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    expect(dto.accompagnees.map((a) => a.nom)).toContain(reg.participanteNom);
    expect(dto.finalistes.map((f) => f.nom)).not.toContain(reg.participanteNom);
  });

  it("supprimer son compte retire son nom des accompagnées, et la fiche coach avec", async () => {
    const { editionId } = await importTremplin1();
    const reg = (await getRegistrationsByEdition(editionId)).find((r) => !r.userId)!;
    const userId = await newUser("Partante", "partante@example.fr");
    await attachUserToRegistration(reg.id, userId, editionId);
    await rattacherPhase3(reg.id, true);
    await h.pool.query(
      `INSERT INTO coach_profiles ("userId", role, public, public_consent_at)
       VALUES ($1, 'Coach', true, now())`,
      [userId],
    );

    expect((await publicDto("devfest-toulouse", 2026))!.accompagnees).toHaveLength(1);

    await effacerCompteEnBase(userId);

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    // Plus nommée — et surtout pas sous le libellé neutre de l'anonymisation :
    // l'accord de phase est révoqué, donc la ligne ne sort plus du tout.
    expect(dto.accompagnees).toEqual([]);
    // L'appartenance reste : l'effectif anonyme de la phase tient toujours.
    expect(dto.counts.accompagnees).toBe(1);
    // La fiche coach est partie avec le compte (CASCADE).
    const { rows } = await h.pool.query(
      `SELECT 1 FROM coach_profiles WHERE "userId" = $1`, [userId],
    );
    expect(rows).toHaveLength(0);
  });

  /**
   * L'ÉCRITURE des deux consentements, sans laquelle la fonctionnalité entière
   * est morte : les colonnes existent, les pages les lisent, mais rien ne les
   * remplit. On aurait publié « 6 speakeuses accompagnées » suivi d'aucun nom,
   * et l'orga n'aurait eu que du SQL à la main pour s'en sortir.
   */
  it("l'accord de phase s'écrit, s'horodate, et se retire", async () => {
    const { setRegistrationPhasePublic, getPhasesPubliquesForRegistration } = await import(
      "@/lib/tremplin-registration-phases"
    );
    const { editionId } = await importTremplin1();
    const reg = (await getRegistrationsByEdition(editionId))[0];
    await rattacherPhase3(reg.id, false);

    expect(await setRegistrationPhasePublic(reg.id, editionId, "montee_sur_scene", true)).toBe(true);
    expect([...(await getPhasesPubliquesForRegistration(reg.id))]).toEqual(["montee_sur_scene"]);
    expect((await publicDto("devfest-toulouse", 2026))!.accompagnees.map((a) => a.nom))
      .toContain(reg.participanteNom);
    // Horodaté : l'accord doit être démontrable.
    const { rows } = await h.pool.query(
      `SELECT public_consent_at FROM tremplin_registration_phases
        WHERE registration_id = $1 AND phase = 'montee_sur_scene'`,
      [reg.id],
    );
    expect((rows[0] as { public_consent_at: unknown }).public_consent_at).toBeTruthy();

    // Retrait : le nom sort, et la trace de l'accord avec lui.
    expect(await setRegistrationPhasePublic(reg.id, editionId, "montee_sur_scene", false)).toBe(true);
    expect((await publicDto("devfest-toulouse", 2026))!.accompagnees).toEqual([]);
  });

  it("l'accord de phase est scopé à l'édition, et n'invente pas de rattachement", async () => {
    const { setRegistrationPhasePublic } = await import("@/lib/tremplin-registration-phases");
    const { editionId } = await importTremplin1();
    const reg = (await getRegistrationsByEdition(editionId))[0];

    // Rattachée à AUCUNE phase 3 : cocher l'accord ne doit pas créer la ligne —
    // publier quelqu'un dans une cohorte où elle ne figure pas serait un fait
    // inventé. L'action affiche « rattache d'abord » sur ce false.
    expect(await setRegistrationPhasePublic(reg.id, editionId, "montee_sur_scene", true)).toBe(false);
    expect((await publicDto("devfest-toulouse", 2026))!.counts.accompagnees).toBe(0);

    // Rattachée, mais visée depuis une AUTRE édition : refus.
    await rattacherPhase3(reg.id, false);
    expect(await setRegistrationPhasePublic(reg.id, editionId + 999, "montee_sur_scene", true)).toBe(false);
    expect((await publicDto("devfest-toulouse", 2026))!.accompagnees).toEqual([]);
  });

  it("la fiche coach s'écrit sans publier, et l'accord se coche à part", async () => {
    const { upsertCoachProfile, setCoachProfilePublic, getCoachProfile } = await import(
      "@/lib/coach-profiles"
    );
    const { editionId } = await importTremplin1();
    const seance = await seancePublique(editionId, "Générale", "montee_sur_scene");
    const userId = await newUser("Nina Coach", "nina.coach@example.fr");
    await addCoachToAtelier(seance, editionId, userId);

    // Décrire n'est pas publier : la fiche naît FERMÉE.
    await upsertCoachProfile(userId, { role: "Coach produit", lien: "https://nina.example" });
    expect((await getCoachProfile(userId))?.public).toBe(false);
    expect((await publicDto("devfest-toulouse", 2026))!.accompagnantes.montee_sur_scene).toEqual([]);

    // L'accord, lui, publie — et l'écriture du rôle ensuite ne le réinitialise pas.
    await setCoachProfilePublic(userId, true);
    await upsertCoachProfile(userId, { role: "Coach produit et agile", lien: "" });
    const fiche = await getCoachProfile(userId);
    expect(fiche?.public).toBe(true);
    expect(fiche?.publicConsentAt).toBeTruthy();
    // Chaîne vide → null : un lien vide ne doit pas devenir un lien affiché.
    expect(fiche?.lien).toBeNull();
    expect((await publicDto("devfest-toulouse", 2026))!.accompagnantes.montee_sur_scene).toEqual([
      { nom: "Nina Coach", role: "Coach produit et agile", lien: null },
    ]);
  });

  /**
   * RETIRER UN ACCORD MODIFIE, ça ne crée jamais. Sans fiche il n'y a rien à
   * retirer : l'écriture est un no-op. Ça compte parce que le retrait passe
   * DEVANT la précondition de rattachement (RGPD art. 7-3) — un `present=false`
   * forgé sur un compte quelconque doit rester sans trace.
   */
  it("retirer un accord sur un compte sans fiche ne crée rien", async () => {
    const { setCoachProfilePublic, getCoachProfile } = await import("@/lib/coach-profiles");
    const passante = await newUser("Simple Passante", "passante@example.fr");

    await setCoachProfilePublic(passante, false);

    expect(await getCoachProfile(passante)).toBeNull();
    const { rows } = await h.pool.query(`SELECT 1 FROM coach_profiles WHERE "userId" = $1`, [
      passante,
    ]);
    expect(rows).toEqual([]);
  });

  it("retirer un accord existant l'efface, horodatage compris", async () => {
    const { upsertCoachProfile, setCoachProfilePublic, getCoachProfile } = await import(
      "@/lib/coach-profiles"
    );
    const userId = await newUser("Olga Coach", "olga.coach@example.fr");
    await upsertCoachProfile(userId, { role: "Coach data", lien: null });
    await setCoachProfilePublic(userId, true);
    expect((await getCoachProfile(userId))?.publicConsentAt).toBeTruthy();

    await setCoachProfilePublic(userId, false);

    const fiche = await getCoachProfile(userId);
    expect(fiche?.public).toBe(false);
    expect(fiche?.publicConsentAt).toBeNull();
    // Le descriptif survit au retrait : c'est l'accord qu'on retire, pas la fiche.
    expect(fiche?.role).toBe("Coach data");
  });

  it("les accompagnées : une inscrite hors de la phase 3 n'y figure pas, même publique", async () => {
    const { editionId } = await importTremplin1();
    const reg = (await getRegistrationsByEdition(editionId))[0];
    await setRegistrationVisibility(reg.id, editionId, true);
    // Aucune appartenance « montee_sur_scene » : elle reste finaliste, rien de plus.
    const dto = (await publicDto("devfest-toulouse", 2026))!;
    expect(dto.accompagnees).toEqual([]);
    expect(dto.counts.accompagnees).toBe(0);
  });

  it("les accompagnantes : nommées phase par phase, sur la publication de leur fiche", async () => {
    const { editionId } = await importTremplin1();
    const avant = await seancePublique(editionId, "Atelier CFP", "cfp_et_pitch");
    const apres = await seancePublique(editionId, "Générale", "montee_sur_scene");

    const consentante = await newUser("Rachel Coach", "rachel.coach@example.fr");
    const sansFiche = await newUser("Sans Fiche", "sans.fiche@example.fr");
    const sansAccord = await newUser("Fiche Sans Accord", "sans.accord@example.fr");
    await h.pool.query(
      `INSERT INTO coach_profiles ("userId", role, lien, public, public_consent_at)
       VALUES ($1, 'Coach produit', 'https://racheldubois.fr', true, now()),
              ($2, 'Dev', NULL, false, NULL)`,
      [consentante, sansAccord],
    );
    // Une fiche SPEAKEUSE publiée ne vaut PAS accord d'être citée comme coach :
    // c'est l'annuaire des speakeuses, une autre finalité. Sans ce leurre, on ne
    // verrait pas la différence entre les deux garde-fous.
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", poste, slug, status)
       VALUES ($1, 'Ingénieure', 'sans-accord', 'publie')`,
      [sansAccord],
    );

    await addCoachToAtelier(avant, editionId, consentante);
    await addCoachToAtelier(apres, editionId, consentante);
    await addCoachToAtelier(apres, editionId, sansFiche);
    await addCoachToAtelier(apres, editionId, sansAccord);

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    // Une fiche coach consentie = un nom, son rôle et son lien.
    expect(dto.accompagnantes.cfp_et_pitch).toEqual([
      { nom: "Rachel Coach", role: "Coach produit", lien: "https://racheldubois.fr" },
    ]);
    // Sans accord (ou sans fiche coach), personne n'est nommé — on sous-annonce
    // plutôt que d'exposer un nom que personne n'a proposé de publier.
    expect(dto.accompagnantes.montee_sur_scene.map((c) => c.nom)).toEqual(["Rachel Coach"]);
  });

  it("les accompagnantes : révoquer l'accord retire le nom des deux phases d'un coup", async () => {
    const { editionId } = await importTremplin1();
    const avant = await seancePublique(editionId, "Atelier CFP", "cfp_et_pitch");
    const apres = await seancePublique(editionId, "Générale", "montee_sur_scene");
    const coach = await newUser("Lucile Coach", "lucile.coach@example.fr");
    await h.pool.query(
      `INSERT INTO coach_profiles ("userId", role, public, public_consent_at)
       VALUES ($1, 'Conceptrice-rédactrice', true, now())`,
      [coach],
    );
    await addCoachToAtelier(avant, editionId, coach);
    await addCoachToAtelier(apres, editionId, coach);

    const avecAccord = (await publicDto("devfest-toulouse", 2026))!;
    expect(avecAccord.accompagnantes.cfp_et_pitch).toHaveLength(1);
    expect(avecAccord.accompagnantes.montee_sur_scene).toHaveLength(1);

    // Le consentement vit sur le COMPTE : une seule révocation vaut partout,
    // pour toutes les éditions et toutes les phases.
    await h.pool.query(`UPDATE coach_profiles SET public = false WHERE "userId" = $1`, [coach]);
    const apresRetrait = (await publicDto("devfest-toulouse", 2026))!;
    expect(apresRetrait.accompagnantes.cfp_et_pitch).toEqual([]);
    expect(apresRetrait.accompagnantes.montee_sur_scene).toEqual([]);
  });

  it("les accompagnantes : celles d'une séance réservée aux inscrites restent dehors", async () => {
    const { setAtelierProgrammePublic } = await import("@/lib/tremplin-ateliers");
    const { editionId } = await importTremplin1();
    const seance = await seancePublique(editionId, "Point individuel", "montee_sur_scene");
    const coach = await newUser("Discrete Coach", "discrete.coach@example.fr");
    await h.pool.query(
      `INSERT INTO coach_profiles ("userId", role, public, public_consent_at)
       VALUES ($1, 'Coach', true, now())`,
      [coach],
    );
    await addCoachToAtelier(seance, editionId, coach);

    // La séance quitte la vitrine : son encadrement la suit. Le crédit des
    // accompagnantes ne peut pas survivre à la séance qui le justifie.
    await setAtelierProgrammePublic(seance, editionId, false);
    const dto = (await publicDto("devfest-toulouse", 2026))!;
    expect(dto.accompagnantes.montee_sur_scene).toEqual([]);
  });

  it("le DTO ne laisse filtrer ni identifiant ni e-mail d'accompagnante", async () => {
    const { editionId } = await importTremplin1();
    const seance = await seancePublique(editionId, "Générale", "montee_sur_scene");
    const coach = await newUser("Claire Coach", "claire.coach@example.fr");
    await h.pool.query(
      `INSERT INTO coach_profiles ("userId", role, public, public_consent_at)
       VALUES ($1, 'Coach', true, now())`,
      [coach],
    );
    await addCoachToAtelier(seance, editionId, coach);

    const dto = (await publicDto("devfest-toulouse", 2026))!;
    expect(Object.keys(dto.accompagnantes.montee_sur_scene[0])).toEqual([
      "nom", "role", "lien",
    ]);
    expect(JSON.stringify(dto)).not.toContain("claire.coach@example.fr");
  });
});

/**
 * LE RÉCIT DE LA CONFÉRENCE dans le DTO public de l'édition.
 *
 * Ce que 2025 a été pour la communauté était écrit en dur dans le JSX de la
 * page de la conférence : la page du Tremplin de cette année-là ne pouvait pas
 * s'en servir. Elle passe maintenant par le rattachement qui existe déjà
 * (`contenus.conference_edition_id`), et c'est ici que la jointure se vérifie
 * pour de vrai — les tests de page, eux, mockent le DTO.
 */
describe("récit de la conférence dans le DTO public (réel)", () => {
  /** Crée une édition de conférence répertoriée et renvoie son id. */
  async function conferenceRepertoriee(slug: string, annee: number): Promise<number> {
    await h.pool.query(
      `INSERT INTO conferences (slug, nom, type, ville, pays)
       VALUES ($1, $1, 'conference', 'Toulouse', 'France')
       ON CONFLICT (slug) DO NOTHING`,
      [slug],
    );
    const { rows } = await h.pool.query(
      // Cast explicite : pg-mem n'infère pas le type d'un paramètre en SELECT.
      `INSERT INTO conference_editions (conference_id, annee)
       SELECT id, $2::int FROM conferences WHERE slug = $1 RETURNING id`,
      [slug, annee],
    );
    return (rows[0] as { id: number }).id;
  }

  /** Pose un contenu rattaché à une conférence répertoriée. */
  async function rattacherRecit(
    conferenceEditionId: number,
    o: { slug: string; titre: string; chapo?: string; corps?: string; statut?: string },
  ) {
    await h.pool.query(
      `INSERT INTO contenus (type, slug, titre, chapo, corps, statut, publie_le,
                             au_flux, conference_edition_id)
       VALUES ('publication', $1, $2, $3, $4, $5, DATE '2025-11-13', FALSE, $6)`,
      [o.slug, o.titre, o.chapo ?? null, o.corps ?? "Salle pleine.", o.statut ?? "publie",
       conferenceEditionId],
    );
  }

  /** Édition de Tremplin publique rattachée à une conférence répertoriée. */
  async function editionRattachee(annee: number, conferenceEditionId: number | null) {
    return createEdition({
      nom: `Tremplin ${annee}`, annee, confSlug: "recit-conf",
      statut: "archive", description: null, confNom: "RecitConf", confLieu: "Toulouse",
      confDate: null, confLien: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null, conferenceEditionId,
    });
  }

  it("le récit publié de SA conférence remonte dans le DTO (slug, titre, chapô)", async () => {
    const confEd = await conferenceRepertoriee("recit-conf-a", 2040);
    await rattacherRecit(confEd, {
      slug: "recit-2040", titre: "Ce qui s'est passé", chapo: "La salle des communautés.",
    });
    await editionRattachee(2040, confEd);

    const pub = await publicDto("recit-conf", 2040);
    expect(pub!.recit).toEqual({
      slug: "recit-2040", titre: "Ce qui s'est passé", chapo: "La salle des communautés.",
    });
  });

  it("le récit d'une AUTRE conférence ne déborde pas sur cette édition", async () => {
    const [confA, confB] = await Promise.all([
      conferenceRepertoriee("recit-conf-b", 2041),
      conferenceRepertoriee("recit-conf-c", 2041),
    ]);
    await rattacherRecit(confB, { slug: "recit-voisin", titre: "Chez le voisin" });
    await editionRattachee(2041, confA);

    expect((await publicDto("recit-conf", 2041))!.recit).toBeNull();
  });

  it("un brouillon rattaché reste invisible du public", async () => {
    const confEd = await conferenceRepertoriee("recit-conf-d", 2042);
    await rattacherRecit(confEd, {
      slug: "recit-brouillon", titre: "Pas prêt", statut: "brouillon",
    });
    await editionRattachee(2042, confEd);

    expect((await publicDto("recit-conf", 2042))!.recit).toBeNull();
  });

  it("sans conférence rattachée : null, sans requête inutile", async () => {
    await editionRattachee(2043, null);

    expect((await publicDto("recit-conf", 2043))!.recit).toBeNull();
  });

  it("le DTO ne laisse pas fuiter l'identifiant interne de la conférence", async () => {
    const confEd = await conferenceRepertoriee("recit-conf-e", 2044);
    await rattacherRecit(confEd, { slug: "recit-sans-id", titre: "Sobre" });
    await editionRattachee(2044, confEd);

    const pub = await publicDto("recit-conf", 2044);
    expect(Object.keys(pub!.recit!).sort()).toEqual(["chapo", "slug", "titre"]);
    expect(JSON.stringify(pub)).not.toContain("conferenceEditionId");
  });
});
