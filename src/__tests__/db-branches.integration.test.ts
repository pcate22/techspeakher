import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD (pg-mem + `db/schema.sql`), même harnais que
 * `tremplin-db.integration.test.ts`. Objectif ciblé : remonter la couverture de
 * BRANCHES des modules d'accès `users`, `tremplin-registrations` et
 * `tremplin-coachs` restée basse, en exerçant précisément les chemins non
 * couverts avec du SQL réel (pas de mock du pool, jamais de SQL réécrit) :
 *  - les libellés d'affichage et leurs replis (nom, e-mail, n° neutre) ;
 *  - les chemins d'erreur qui NE sont PAS un conflit d'unicité (rethrow) ;
 *  - les missions de coach d'un seul type (atelier sans coachée, et l'inverse).
 *
 * pg-mem suffit ici : aucune de ces fonctions n'utilise `= ANY($1)` sur des
 * entiers, de CTE `WITH ... INSERT`, `to_char` ni `IS NOT DISTINCT FROM`
 * (qui, eux, imposeraient PGlite). On reste sur le moteur en mémoire, comme le
 * fichier voisin dont on copie le harnais.
 *
 * On NE rejoue pas ce qui est déjà couvert ailleurs : ici uniquement les angles
 * morts de branches identifiés par la mesure de couverture.
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
  // Même sémantique que la vraie withTransaction, sur le pool pg-mem
  // (registerUserToEdition l'utilise).
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
import { compteLabel, getUserById } from "@/lib/users";
import {
  registrationLabel,
  trierParLabel,
  rangLabel,
  createRegistration,
  getRegistrationsByEdition,
  registerUserToEdition,
  attachUserToRegistration,
  type RegistrationInput,
} from "@/lib/tremplin-registrations";
import { getAteliersByEdition, createAtelierWithMembers } from "@/lib/tremplin-ateliers";
import {
  coachLabel,
  getCoachEditions,
  getCoachCoachees,
  getCoachAtelierMembres,
  getCoachsByRegistration,
  addCoachToAtelier,
  addCoachToRegistration,
} from "@/lib/tremplin-coachs";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup(); // schéma chargé, base vide
});

beforeEach(() => backup.restore()); // isole chaque test (purge les lignes)

/** Insère un compte (name/email éventuellement NULL) et renvoie son id. */
async function newUser(name: string | null, email: string | null): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES($1, $2) RETURNING id",
    [name, email],
  );
  return (rows[0] as { id: number }).id;
}

/** Inscription rattachée à un compte, sans nom saisi (le libellé viendra du compte). */
const inscriptionRattachee = (userId: number): RegistrationInput => ({
  userId,
  participanteNom: null,
  participanteRole: null,
  participanteLinkedin: null,
  statut: "en_attente",
  finalePresente: null,
});

const mkAtelier = (titre: string) => ({
  ordre: 0,
  titre,
  date: null,
  heureDebut: null,
  heureFin: null,
  description: null,
  lienVisio: null,
  coachs: null,
});

describe("compteLabel (réel) : les quatre combinaisons nom/e-mail", () => {
  it("compose « Nom (email) », ou l'un des deux, ou un n° neutre", async () => {
    // On sème un compte de chaque forme puis on le RELIT (getUserById) : le
    // libellé est calculé sur des lignes réelles, pas des objets forgés.
    const complet = await newUser("Alice Complet", "alice@x.fr");
    const nomSeul = await newUser("Solo", null);
    const mailSeul = await newUser(null, "mail-only@x.fr");
    const aucun = await newUser(null, null);

    // Nom ET e-mail : l'e-mail entre parenthèses lève les homonymies.
    expect(compteLabel((await getUserById(complet))!)).toBe("Alice Complet (alice@x.fr)");
    // Nom seul (e-mail NULL) : pas de parenthèses.
    expect(compteLabel((await getUserById(nomSeul))!)).toBe("Solo");
    // E-mail seul (nom NULL) : l'e-mail sert de repli.
    expect(compteLabel((await getUserById(mailSeul))!)).toBe("mail-only@x.fr");
    // Ni nom ni e-mail : n° de compte neutre.
    expect(compteLabel((await getUserById(aucun))!)).toBe(`Compte n° ${aucun}`);
  });
});

describe("libellés et tri des inscriptions (réel)", () => {
  it("registrationLabel : nom saisi, sinon nom/e-mail du compte, sinon n° neutre", async () => {
    const { editionId } = await importTremplin1();
    const uNom = await newUser("Nadia Nom", "nadia@x.fr");
    const uMail = await newUser(null, "mail-only@x.fr");
    const uAucun = await newUser(null, null);

    const idNom = await createRegistration(editionId, inscriptionRattachee(uNom));
    const idMail = await createRegistration(editionId, inscriptionRattachee(uMail));
    const idAucun = await createRegistration(editionId, inscriptionRattachee(uAucun));

    const regs = await getRegistrationsByEdition(editionId);
    const find = (id: number) => regs.find((r) => r.id === id)!;

    // Nom saisi (inscription du seed) : prioritaire sur tout le reste.
    const seed = regs.find((r) => r.participanteNom)!;
    expect(registrationLabel(seed)).toBe(seed.participanteNom);
    // Pas de nom saisi mais compte nommé : repli sur le nom du compte (join).
    expect(registrationLabel(find(idNom))).toBe("Nadia Nom");
    // Ni nom saisi ni nom de compte : repli sur l'e-mail du compte.
    expect(registrationLabel(find(idMail))).toBe("mail-only@x.fr");
    // Rien de tout ça : n° de compte neutre.
    expect(registrationLabel(find(idAucun))).toBe(`Compte n° ${uAucun}`);
  });

  it("trierParLabel : trie par libellé (fr) sans muter l'entrée", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const avant = [...regs]; // copie de référence pour prouver la non-mutation

    const trie = trierParLabel(regs);
    const labels = trie.map(registrationLabel);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "fr")));

    // Négatif : l'entrée n'est PAS mutée (même ordre qu'avant l'appel).
    expect(regs.map((r) => r.id)).toEqual(avant.map((r) => r.id));
  });

  it("rangLabel : null hors classement, libellé sinon", async () => {
    expect(rangLabel(null)).toBeNull(); // branche non classée
    expect(rangLabel(1)).toBe("1ᵉʳ prix");
    expect(rangLabel(2)).toBe("2ᵉ prix");
  });
});

describe("chemins d'erreur NON-23505 (réel) : l'erreur driver est propagée", () => {
  it("registerUserToEdition rejette (édition inexistante) et ne crée aucune inscription", async () => {
    const { editionId } = await importTremplin1();
    const user = await newUser("Invitée", "invitee@x.fr");
    const avant = (await getRegistrationsByEdition(editionId)).length;

    // Édition absente : violation de clé étrangère (code ≠ 23505) → rethrow,
    // et non un « deja_inscrite » silencieux.
    await expect(registerUserToEdition(editionId + 999, user)).rejects.toThrow();

    // Négatif prouvé en relisant la base : rien n'a été inséré, nulle part.
    expect(await getRegistrationsByEdition(editionId)).toHaveLength(avant);
    expect(await getRegistrationsByEdition(editionId + 999)).toHaveLength(0);
  });

  it("attachUserToRegistration rejette (compte inexistant) et ne rattache rien", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const cible = regs[0];
    expect(cible.userId).toBeNull(); // état initial : inscription non rattachée

    // userId absent : violation de clé étrangère (code ≠ 23505) → rethrow,
    // et non un « deja_rattache » silencieux.
    await expect(attachUserToRegistration(cible.id, 999999, editionId)).rejects.toThrow();

    // Négatif prouvé en relisant la base : le rattachement n'a pas eu lieu.
    const apres = await getRegistrationsByEdition(editionId);
    expect(apres.find((r) => r.id === cible.id)?.userId).toBeNull();
  });
});

describe("coachLabel (réel) : nom, sinon e-mail, sinon n° neutre", () => {
  it("dérive le libellé de coachs lus en base (les trois replis)", async () => {
    const { editionId } = await importTremplin1();
    const regs = await getRegistrationsByEdition(editionId);
    const cNom = await newUser("Coach Nom", "cn@x.fr");
    const cMail = await newUser(null, "coach-mail@x.fr");
    const cAucun = await newUser(null, null);

    await addCoachToRegistration(regs[0].id, editionId, cNom);
    await addCoachToRegistration(regs[0].id, editionId, cMail);
    await addCoachToRegistration(regs[0].id, editionId, cAucun);

    const parId = new Map((await getCoachsByRegistration(regs[0].id)).map((c) => [c.userId, c]));
    expect(coachLabel(parId.get(cNom)!)).toBe("Coach Nom");
    expect(coachLabel(parId.get(cMail)!)).toBe("coach-mail@x.fr");
    expect(coachLabel(parId.get(cAucun)!)).toBe(`Compte n° ${cAucun}`);
  });
});

describe("getCoachEditions (réel) : missions d'un seul type", () => {
  it("un atelier animé sans coachée → nbCoachees = 0 ; l'inverse → nbAteliers = 0", async () => {
    const { editionId } = await importTremplin1();
    const ateliers = await getAteliersByEdition(editionId);
    const regs = await getRegistrationsByEdition(editionId);

    // Coach qui anime UN atelier mais n'a AUCUNE coachée : la map des coachées
    // n'a pas cette édition, d'où le repli à 0.
    const coachAtelier = await newUser("Anime seulement", "anime@x.fr");
    await addCoachToAtelier(ateliers[0].id, editionId, coachAtelier);
    const mAtelier = await getCoachEditions(coachAtelier);
    expect(mAtelier).toHaveLength(1);
    expect(mAtelier[0].nbAteliers).toBe(1);
    expect(mAtelier[0].nbCoachees).toBe(0);

    // Coach qui suit UNE coachée mais n'anime AUCUN atelier : repli symétrique.
    const coachCoachee = await newUser("Coache seulement", "coache@x.fr");
    await addCoachToRegistration(regs[0].id, editionId, coachCoachee);
    const mCoachee = await getCoachEditions(coachCoachee);
    expect(mCoachee).toHaveLength(1);
    expect(mCoachee[0].nbCoachees).toBe(1);
    expect(mCoachee[0].nbAteliers).toBe(0);

    // Négatif : un compte sans aucune mission n'a aucune édition.
    const personne = await newUser("Sans mission", "rien@x.fr");
    expect(await getCoachEditions(personne)).toEqual([]);
  });
});

describe("replis de libellé côté coach (réel)", () => {
  it("getCoachCoachees et getCoachAtelierMembres : nom du compte, sinon n° neutre", async () => {
    const { editionId } = await importTremplin1();
    const uNom = await newUser("Nadia Nom", "nadia@x.fr");
    const uAucun = await newUser(null, null);
    // Inscriptions sans nom saisi : le libellé doit venir du compte, ou d'un n°.
    const regNom = await createRegistration(editionId, inscriptionRattachee(uNom));
    const regAucun = await createRegistration(editionId, inscriptionRattachee(uAucun));

    const coach = await newUser("Le Coach", "coach@x.fr");
    await addCoachToRegistration(regNom, editionId, coach);
    await addCoachToRegistration(regAucun, editionId, coach);

    // Coachées : repli sur le nom du compte, puis sur le n° neutre (jamais l'e-mail).
    const noms = (await getCoachCoachees(coach, editionId)).map((c) => c.nom);
    expect(noms).toContain("Nadia Nom");
    expect(noms).toContain(`Participante n° ${regAucun}`);
    expect(JSON.stringify(noms)).not.toMatch(/@/); // jamais d'e-mail exposé

    // Mêmes replis pour les membres d'un atelier restreint que le coach anime.
    const atelier = await createAtelierWithMembers(editionId, mkAtelier("Restreint"), [
      regNom,
      regAucun,
    ]);
    await addCoachToAtelier(atelier, editionId, coach);
    const membres = (await getCoachAtelierMembres(coach, editionId)).get(atelier)!;
    expect(membres).toContain("Nadia Nom");
    expect(membres).toContain(`Participante n° ${regAucun}`);
    expect(JSON.stringify(membres)).not.toMatch(/@/);
  });
});
