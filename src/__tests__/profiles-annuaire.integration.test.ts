// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * VRAIS tests d'intégration BDD des lectures/écritures de `profiles.ts` qui
 * pilotent l'ANNUAIRE PUBLIC, la MODÉRATION et les CRONS (invitations, rappels).
 * On exécute le SQL réel contre un vrai Postgres (PGlite) chargé depuis
 * `db/schema.sql`.
 *
 * PGlite et non pg-mem : markInvited/markRemindersSent utilisent `id = ANY($1)`
 * sur un tableau d'entiers, que pg-mem 3.x n'évalue pas. Plutôt que de réécrire
 * le SQL dans le test (ce qui ne testerait plus le vrai SQL), on prend un moteur
 * Postgres réel, comme cfp-suggestions-db.integration.test.ts.
 *
 * Ce fichier complète `profiles-db.integration.test.ts` : il ne re-teste PAS
 * ensureProfileId/upsertProfile/getProfileByUserId/effacerCompteEnBase/submit/withdraw
 * (déjà couverts là-bas). Il vise les requêtes FILTRÉES (statut, fenêtres de
 * dates, rôle orga, scoping d'ids) qui n'étaient vérifiées que sur un pool
 * mocké (assertions regex). Pour chacune, un CAS NÉGATIF insère une ligne qui
 * NE doit PAS remonter : c'est ce qui rend le test capable d'attraper un WHERE
 * faux.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      // node-postgres expose `rowCount` ; PGlite expose `affectedRows`.
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});

vi.mock("@/lib/db", () => ({
  pool: h.pool,
  // Transactions du lot N4 (purges de réactions) : même base mockée.
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(h.pool),
  // Le helper du lot N4 : même sémantique, sur la base mockée (la table
  // fil_reactions existe dans le schéma des tests — la branche repli reste couverte
  // par pg-errors).
  withTransactionSaufTable: async (
    _t: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => fn(h.pool, true),
}));

import {
  ensureProfileId,
  getPublishedAnnuaire,
  getPublishedProfiles,
  getAllProfiles,
  getPendingProfiles,
  setProfileStatus,
  getProfileById,
  getSpeakeuseContact,
  getIsOrga,
  getUserRoles,
  getProfilesDueForReminder,
  getProfilesToInvite,
  markInvited,
  markRemindersSent,
} from "@/lib/profiles";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

// Isole chaque test : purge les lignes (CASCADE couvre les tables dépendantes).
beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE speaker_talks, speaker_profiles, users RESTART IDENTITY CASCADE",
  );
});

/** Crée un compte. `email` peut être null (cas « pas d'e-mail »). */
async function newUser(
  name: string | null,
  email: string | null,
  over: { isOrga?: boolean; isCoach?: boolean } = {},
): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name, email, is_orga, is_coach)
     VALUES($1, $2, $3, $4) RETURNING id`,
    [name, email, over.isOrga ?? false, over.isCoach ?? false],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Insère un profil speakeuse en contrôlant les colonnes qui pilotent les
 * requêtes filtrées. Les colonnes temporelles prennent un fragment SQL (défaut,
 * NULL ou « now() - interval … ») pour poser des fenêtres de dates réalistes.
 */
async function insertProfile(
  userId: number,
  over: {
    status?: string;
    migrated?: boolean;
    contactEmailOk?: boolean;
    validatedBy?: number | null;
    updatedAt?: string; // fragment SQL
    lastReminderAt?: string; // fragment SQL
    invitedAt?: string; // fragment SQL
    validatedAt?: string; // fragment SQL
    submittedAt?: string; // fragment SQL
  } = {},
): Promise<number> {
  const updatedAt = over.updatedAt ?? "now()";
  const lastReminderAt = over.lastReminderAt ?? "NULL";
  const invitedAt = over.invitedAt ?? "NULL";
  const validatedAt = over.validatedAt ?? "NULL";
  const submittedAt = over.submittedAt ?? "NULL";
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_profiles
       ("userId", status, migrated, contact_email_ok, validated_by,
        updated_at, last_reminder_at, invited_at, validated_at, submitted_at)
     VALUES ($1, $2, $3, $4, $5,
        ${updatedAt}, ${lastReminderAt}, ${invitedAt}, ${validatedAt}, ${submittedAt})
     RETURNING id`,
    [
      userId,
      over.status ?? "brouillon",
      over.migrated ?? false,
      over.contactEmailOk ?? false,
      over.validatedBy ?? null,
    ],
  );
  return (rows[0] as { id: number }).id;
}

describe("getPublishedAnnuaire (réel)", () => {
  it("ne remonte QUE les profils publiés, triés par nom, sans e-mail sérialisé", async () => {
    // Cas passants : deux profils publiés, noms dans le désordre pour tester le tri.
    await insertProfile(await newUser("Zoe", "zoe@ex.fr"), { status: "publie" });
    await insertProfile(await newUser("Anna", "anna@ex.fr"), { status: "publie" });
    // Cas négatifs : tout autre statut est exclu de l'annuaire public.
    await insertProfile(await newUser("Brouillonne", "b@ex.fr"), { status: "brouillon" });
    await insertProfile(await newUser("En attente", "a@ex.fr"), { status: "en_attente" });
    await insertProfile(await newUser("Refusée", "r@ex.fr"), { status: "refuse" });
    await insertProfile(await newUser("Masquée", "m@ex.fr"), { status: "masque" });

    const annuaire = await getPublishedAnnuaire();

    expect(annuaire).toHaveLength(2); // les 4 non-publiés sont exclus
    expect(annuaire.map((p) => p.name)).toEqual(["Anna", "Zoe"]); // ORDER BY u.name
    expect(annuaire.every((p) => p.status === "publie")).toBe(true);
    // Anonymat : la lecture de l'annuaire ne rapatrie jamais l'e-mail du compte.
    for (const p of annuaire) {
      expect(p).not.toHaveProperty("email");
    }
  });
});

describe("getPublishedProfiles (réel, vue orga)", () => {
  it("ne remonte que les publiés, joint le nom du validateur et trie par validated_at décroissant", async () => {
    const orga = await newUser("Orga Prune", "prune@ex.fr", { isOrga: true });
    // Publié récemment validé, publié validé plus ancien, publié jamais validé.
    await insertProfile(await newUser("Recente", "rec@ex.fr"), {
      status: "publie",
      validatedBy: orga,
      validatedAt: "now() - interval '1 day'",
    });
    await insertProfile(await newUser("Ancienne", "anc@ex.fr"), {
      status: "publie",
      validatedBy: orga,
      validatedAt: "now() - interval '30 days'",
    });
    await insertProfile(await newUser("JamaisValidee", "jam@ex.fr"), {
      status: "publie",
      validatedBy: null,
      validatedAt: "NULL",
    });
    // Cas négatif : une fiche en attente ne doit pas apparaître dans les publiés.
    await insertProfile(await newUser("EnFile", "file@ex.fr"), { status: "en_attente" });

    const publies = await getPublishedProfiles();

    expect(publies).toHaveLength(3); // la fiche en_attente est exclue
    // Tri validated_at DESC NULLS LAST : récente, ancienne, puis la non validée.
    expect(publies.map((p) => p.name)).toEqual([
      "Recente",
      "Ancienne",
      "JamaisValidee",
    ]);
    // La jointure LEFT JOIN remonte le nom de l'orga (ou null si non validée).
    expect(publies[0].validatorName).toBe("Orga Prune");
    expect(publies[2].validatorName).toBeNull();
  });
});

describe("getAllProfiles (réel, suivi global orga)", () => {
  it("inclut tous les statuts (même brouillon/refusé) et trie par priorité de traitement", async () => {
    await insertProfile(await newUser("Pub", "pub@ex.fr"), { status: "publie" });
    await insertProfile(await newUser("Att", "att@ex.fr"), { status: "en_attente" });
    await insertProfile(await newUser("Ref", "ref@ex.fr"), { status: "refuse" });
    await insertProfile(await newUser("Bro", "bro@ex.fr"), { status: "brouillon" });
    await insertProfile(await newUser("Mas", "mas@ex.fr"), { status: "masque" });

    const tous = await getAllProfiles();

    // Aucun filtre : les 5 statuts sont présents (contraste avec l'annuaire public).
    expect(tous).toHaveLength(5);
    // Priorité : en_attente (0), refuse (1), publie (2), masque (3), brouillon (4).
    expect(tous.map((p) => p.status)).toEqual([
      "en_attente",
      "refuse",
      "publie",
      "masque",
      "brouillon",
    ]);
  });
});

describe("getPendingProfiles (réel, file de modération)", () => {
  it("ne remonte que les 'en_attente', triés par date de soumission", async () => {
    // Deux en attente, soumises dans un ordre différent de l'insertion.
    await insertProfile(await newUser("Deuxieme", "d2@ex.fr"), {
      status: "en_attente",
      submittedAt: "now() - interval '1 hour'",
    });
    await insertProfile(await newUser("Premiere", "d1@ex.fr"), {
      status: "en_attente",
      submittedAt: "now() - interval '2 hours'",
    });
    // Cas négatifs : publiée et brouillon ne sont pas dans la file.
    await insertProfile(await newUser("Publiee", "p@ex.fr"), { status: "publie" });
    await insertProfile(await newUser("Brouillon", "b@ex.fr"), { status: "brouillon" });

    const enAttente = await getPendingProfiles();

    expect(enAttente).toHaveLength(2); // publiée + brouillon exclues
    expect(enAttente.every((p) => p.status === "en_attente")).toBe(true);
    // ORDER BY submitted_at : la plus ancienne soumission d'abord.
    expect(enAttente.map((p) => p.name)).toEqual(["Premiere", "Deuxieme"]);
  });
});

describe("getProfileById / getSpeakeuseContact (réel)", () => {
  it("getProfileById récupère un profil quel que soit son statut, null si l'id est inconnu", async () => {
    const userId = await newUser("Fiche", "fiche@ex.fr");
    const id = await insertProfile(userId, { status: "masque" }); // même un statut non public

    const profile = await getProfileById(id);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(id);
    expect(profile!.status).toBe("masque");
    expect(profile!.name).toBe("Fiche"); // jointure users

    // Cas négatif : un id qui n'existe pas renvoie null (pas d'exception).
    expect(await getProfileById(id + 999)).toBeNull();
  });

  it("getSpeakeuseContact renvoie l'e-mail (relais serveur) + le flag de consentement, null si inconnu", async () => {
    const userId = await newUser("Contactable", "contact@ex.fr");
    const id = await insertProfile(userId, { status: "publie", contactEmailOk: true });

    const contact = await getSpeakeuseContact(id);
    expect(contact).toEqual({
      name: "Contactable",
      email: "contact@ex.fr", // renvoyé côté serveur pour le relais, jamais au client
      contactEmailOk: true,
      status: "publie",
      slug: null, // pas de slug tant que la fiche n'a pas été enregistrée via le formulaire
    });

    // Cas négatif : profil inexistant → null.
    expect(await getSpeakeuseContact(id + 999)).toBeNull();
  });
});

describe("getIsOrga / getUserRoles (réel, rôles)", () => {
  it("getIsOrga distingue une orga d'une non-orga, et gère l'utilisateur inconnu", async () => {
    const orga = await newUser("Orga", "orga@ex.fr", { isOrga: true });
    const membre = await newUser("Membre", "membre@ex.fr", { isOrga: false });

    expect(await getIsOrga(orga)).toBe(true);
    expect(await getIsOrga(membre)).toBe(false); // cas négatif : is_orga = false
    expect(await getIsOrga(999999)).toBe(false); // cas négatif : compte inexistant
  });

  it("getUserRoles renvoie les deux flags, false/false pour un compte inconnu", async () => {
    const orga = await newUser("O", "o@ex.fr", { isOrga: true, isCoach: false });
    const coach = await newUser("C", "c@ex.fr", { isOrga: false, isCoach: true });

    expect(await getUserRoles(orga)).toEqual({ isOrga: true, isCoach: false });
    // Cas négatif : un coach n'est pas orga (les deux rôles sont indépendants).
    expect(await getUserRoles(coach)).toEqual({ isOrga: false, isCoach: true });
    // Cas négatif : compte inexistant → aucun rôle.
    expect(await getUserRoles(999999)).toEqual({ isOrga: false, isCoach: false });
  });
});

describe("setProfileStatus (réel, modération)", () => {
  it("publie horodate la validation et published_at ; masquer ensuite conserve published_at", async () => {
    const orga = await newUser("Valideuse", "val@ex.fr", { isOrga: true });
    const userId = await newUser("Candidate", "cand@ex.fr");
    const id = await ensureProfileId(userId);

    await setProfileStatus(id, "publie", orga);
    const publie = await getProfileById(id);
    expect(publie!.status).toBe("publie");
    expect(publie!.validatedBy).toBe(orga);
    expect(publie!.validatedAt).not.toBeNull();
    expect(publie!.publishedAt).not.toBeNull();
    // Cas négatif de la branche refus : un motif n'est écrit QUE pour un refus.
    expect(publie!.refusMotif).toBeNull();

    await setProfileStatus(id, "masque", orga);
    const masque = await getProfileById(id);
    expect(masque!.status).toBe("masque");
    // published_at est préservé (CASE … ELSE published_at), pas remis à null.
    // Comparaison par VALEUR : le vrai driver (et PGlite) renvoie un objet Date,
    // donc deux instances distinctes de même instant (toBe/identité échouerait).
    expect(masque!.publishedAt).toStrictEqual(publie!.publishedAt);
    expect(masque!.refusMotif).toBeNull();
  });

  it("le retour après retrait est DISCRET : re-publier garde published_at d'origine", async () => {
    // Le retrait est le geste de qui veut baisser d'exposition : la re-publication
    // ne doit pas la ré-annoncer en tête des « nouvelles venues » (accueil public,
    // futur fil). published_at n'est posé qu'au PREMIER passage en « publié ».
    const orga = await newUser("Valideuse", "val2@ex.fr", { isOrga: true });
    const id = await ensureProfileId(await newUser("Revenante", "rev@ex.fr"));

    await setProfileStatus(id, "publie", orga);
    const premiere = (await getProfileById(id))!.publishedAt;
    expect(premiere).not.toBeNull();

    await setProfileStatus(id, "masque", orga);
    await setProfileStatus(id, "publie", orga);
    expect((await getProfileById(id))!.publishedAt).toStrictEqual(premiere);
  });

  it("refuse écrit le motif ; un motif passé lors d'un publie est ignoré (mis à null)", async () => {
    const orga = await newUser("Orga", "orga@ex.fr", { isOrga: true });
    const idRefuse = await ensureProfileId(await newUser("A", "a@ex.fr"));
    const idPublie = await ensureProfileId(await newUser("B", "b@ex.fr"));

    await setProfileStatus(idRefuse, "refuse", orga, "Fiche trop incomplète.");
    expect((await getProfileById(idRefuse))!.refusMotif).toBe("Fiche trop incomplète.");

    // Cas négatif : même en passant un motif, un statut non-refus le neutralise.
    await setProfileStatus(idPublie, "publie", orga, "motif à ne pas garder");
    expect((await getProfileById(idPublie))!.refusMotif).toBeNull();
  });
});

describe("getProfilesDueForReminder (réel, cron rappels)", () => {
  it("cible les publiés inactifs depuis 6 mois avec e-mail, et exclut tous les autres cas", async () => {
    // Cas passant : publié, e-mail présent, modifié il y a plus de 6 mois, jamais relancé.
    await insertProfile(await newUser("ARelancer", "relance@ex.fr"), {
      status: "publie",
      updatedAt: "now() - interval '8 months'",
      lastReminderAt: "NULL",
    });
    // Cas passant : dernier rappel lui-même vieux de plus de 6 mois → re-relançable.
    await insertProfile(await newUser("VieuxRappel", "vieux@ex.fr"), {
      status: "publie",
      updatedAt: "now() - interval '8 months'",
      lastReminderAt: "now() - interval '7 months'",
    });

    // Cas négatif : pas publié (brouillon), même ancien.
    await insertProfile(await newUser("Brouillon", "b@ex.fr"), {
      status: "brouillon",
      updatedAt: "now() - interval '2 years'",
    });
    // Cas négatif : publié mais SANS e-mail (u.email IS NOT NULL).
    await insertProfile(await newUser("SansEmail", null), {
      status: "publie",
      updatedAt: "now() - interval '2 years'",
    });
    // Cas négatif : publié mais modifié récemment (moins de 6 mois).
    await insertProfile(await newUser("Recente", "rec@ex.fr"), {
      status: "publie",
      updatedAt: "now() - interval '1 month'",
    });
    // Cas négatif : publié, ancien, mais relancé récemment (anti-spam du cron).
    await insertProfile(await newUser("DejaRelancee", "deja@ex.fr"), {
      status: "publie",
      updatedAt: "now() - interval '8 months'",
      lastReminderAt: "now() - interval '1 month'",
    });

    const dues = await getProfilesDueForReminder();

    const emails = dues.map((d) => d.email).sort();
    expect(emails).toEqual(["relance@ex.fr", "vieux@ex.fr"]);
  });
});

describe("getProfilesToInvite (réel, cron invitations migration)", () => {
  it("cible les fiches migrées jamais invitées à e-mail valide, et exclut tous les autres cas", async () => {
    // Cas passant : migrée, jamais invitée, e-mail valide. isOrga remonté.
    await insertProfile(await newUser("AInviter", "invit@ex.fr", { isOrga: true }), {
      migrated: true,
      invitedAt: "NULL",
    });

    // Cas négatif : pas migrée (le flag migrated, pas le statut, pilote l'invitation).
    await insertProfile(await newUser("PasMigree", "pasmig@ex.fr"), {
      migrated: false,
    });
    // Cas négatif : migrée mais déjà invitée (anti-double-envoi).
    await insertProfile(await newUser("DejaInvitee", "dejainv@ex.fr"), {
      migrated: true,
      invitedAt: "now()",
    });
    // Cas négatif : migrée mais sans e-mail.
    await insertProfile(await newUser("SansEmail", null), { migrated: true });
    // Cas négatif : migrée mais e-mail placeholder « .invalid ».
    await insertProfile(await newUser("Placeholder", "quelquun@ex.invalid"), {
      migrated: true,
    });

    const aInviter = await getProfilesToInvite();

    expect(aInviter).toHaveLength(1); // seul le cas passant remonte
    expect(aInviter[0].email).toBe("invit@ex.fr");
    expect(aInviter[0].isOrga).toBe(true); // u.is_orga projeté pour l'encart orga
  });
});

describe("markInvited / markRemindersSent (réel, scoping des ids)", () => {
  it("markInvited ne pose invited_at QUE sur les ids listés ; tableau vide = no-op", async () => {
    const cible = await insertProfile(await newUser("Cible", "cible@ex.fr"), {
      migrated: true,
    });
    const autre = await insertProfile(await newUser("Autre", "autre@ex.fr"), {
      migrated: true,
    });

    // Tableau vide : garde de court-circuit, aucune écriture, pas d'exception.
    await expect(markInvited([])).resolves.toBeUndefined();

    await markInvited([cible]);

    const invitedAt = async (id: number) =>
      (
        (
          await h.pool.query(
            "SELECT (invited_at IS NOT NULL) AS marque FROM speaker_profiles WHERE id = $1",
            [id],
          )
        ).rows[0] as { marque: boolean }
      ).marque;
    expect(await invitedAt(cible)).toBe(true);
    // Cas négatif de scoping : la fiche non listée reste non invitée.
    expect(await invitedAt(autre)).toBe(false);
  });

  it("markRemindersSent ne pose last_reminder_at QUE sur les ids listés ; tableau vide = no-op", async () => {
    const cible = await insertProfile(await newUser("Cible", "cible@ex.fr"), {
      status: "publie",
    });
    const autre = await insertProfile(await newUser("Autre", "autre@ex.fr"), {
      status: "publie",
    });

    await expect(markRemindersSent([])).resolves.toBeUndefined();

    await markRemindersSent([cible]);

    const relanceAt = async (id: number) =>
      (
        (
          await h.pool.query(
            "SELECT (last_reminder_at IS NOT NULL) AS marque FROM speaker_profiles WHERE id = $1",
            [id],
          )
        ).rows[0] as { marque: boolean }
      ).marque;
    expect(await relanceAt(cible)).toBe(true);
    // Cas négatif de scoping : la fiche non listée n'est pas marquée relancée.
    expect(await relanceAt(autre)).toBe(false);
  });
});
