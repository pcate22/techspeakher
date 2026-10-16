// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
/**
 * La règle de l'annuaire réservé aux membres, contre le vrai schéma (PGlite).
 *
 * L'invariant qui compte le plus : **aucune fiche ne passe en pause sans un
 * préavis daté**, envoyé trente jours plus tôt. Puis : les orga ne sont jamais
 * concernées ; éteindre l'interrupteur remet tout en ligne.
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
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(h.pool),
  withTransactionSaufTable: async (
    _t: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => fn(h.pool, true),
}));

import {
  fichesAPrevenir,
  marquerPreavis,
  adherentesARelancer,
  marquerRelance,
  leverLesPauses,
  fichesAInviterAAdherer,
  reserverInvitationAdhesion,
  libererInvitationAdhesion,
  dateRetraitAnnuaire,
} from "@/lib/annuaire-adhesion";
import { PREAVIS_ANNUAIRE_JOURS } from "@/lib/adhesion";
import { mettreFichesEnPause, setProfileStatus } from "@/lib/profiles";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE users, speaker_profiles, user_memberships RESTART IDENTITY CASCADE",
  );
});

const MAINTENANT = new Date("2026-10-15T12:00:00Z");
const jours = (n: number) => new Date(MAINTENANT.getTime() + n * 86_400_000);

async function personne(opts: {
  nom: string;
  fiche?: string;
  orga?: boolean;
  email?: string;
  adhesionFinDans?: number;
  retraitDans?: number;
  source?: "helloasso" | "manuel";
}) {
  const { rows } = await h.pool.query(
    `INSERT INTO users (name, email, is_orga) VALUES ($1, $2, $3) RETURNING id`,
    [opts.nom, opts.email ?? `${opts.nom.toLowerCase()}@test.fr`, opts.orga ?? false],
  );
  const userId = (rows[0] as { id: number }).id;
  let profileId: number | null = null;
  if (opts.fiche) {
    const p = await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", status, annuaire_retrait_le)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, opts.fiche, opts.retraitDans === undefined ? null : jours(opts.retraitDans)],
    );
    profileId = (p.rows[0] as { id: number }).id;
  }
  if (opts.adhesionFinDans !== undefined)
    await h.pool.query(
      `INSERT INTO user_memberships ("userId", source, expires_at) VALUES ($1, $3, $2)`,
      [userId, jours(opts.adhesionFinDans), opts.source ?? "helloasso"],
    );
  return { userId, profileId };
}

async function statut(profileId: number | null) {
  const { rows } = await h.pool.query(
    `SELECT status, annuaire_retrait_le FROM speaker_profiles WHERE id = $1`,
    [profileId],
  );
  return rows[0] as { status: string; annuaire_retrait_le: Date | null };
}

describe("fichesAPrevenir — qui reçoit le préavis", () => {
  it("une fiche publiée sans adhésion, et une dont l'adhésion finit dans moins de 30 jours", async () => {
    await personne({ nom: "Sans", fiche: "publie" });
    await personne({ nom: "Bientot", fiche: "publie", adhesionFinDans: 10 });
    await personne({ nom: "AJour", fiche: "publie", adhesionFinDans: 200 });
    const res = await fichesAPrevenir(MAINTENANT);
    expect(res.map((f) => f.name).sort()).toEqual(["Bientot", "Sans"]);
    expect(res.find((f) => f.name === "Bientot")!.expiresAt).toBe(jours(10).toISOString());
    expect(res.find((f) => f.name === "Sans")!.expiresAt).toBeNull();
  });

  it("jamais une orga, ni une fiche non publiée, ni une fiche déjà prévenue", async () => {
    await personne({ nom: "Orga", fiche: "publie", orga: true });
    await personne({ nom: "Brouillon", fiche: "brouillon" });
    await personne({ nom: "Masquee", fiche: "masque" });
    await personne({ nom: "Prevenue", fiche: "publie", retraitDans: 12 });
    expect(await fichesAPrevenir(MAINTENANT)).toEqual([]);
  });

  it("une adhésion expirée à la main (statut) ne protège pas", async () => {
    const { userId } = await personne({ nom: "Expiree", fiche: "publie", adhesionFinDans: 200 });
    await h.pool.query(`UPDATE user_memberships SET status = 'expired' WHERE "userId" = $1`, [
      userId,
    ]);
    expect((await fichesAPrevenir(MAINTENANT)).map((f) => f.name)).toEqual(["Expiree"]);
  });

  it("une adhésion close avant terme (statut expired, échéance à venir) n'annonce aucune échéance", async () => {
    const { userId } = await personne({ nom: "Close", fiche: "publie", adhesionFinDans: 300 });
    await h.pool.query(`UPDATE user_memberships SET status = 'expired' WHERE "userId" = $1`, [
      userId,
    ]);
    expect((await fichesAPrevenir(MAINTENANT))[0].expiresAt).toBeNull();
  });

  it("marquerPreavis pose la date annoncée", async () => {
    const { profileId } = await personne({ nom: "Sans", fiche: "publie" });
    await marquerPreavis(profileId!, jours(PREAVIS_ANNUAIRE_JOURS));
    expect((await statut(profileId)).annuaire_retrait_le).toEqual(jours(30));
    expect(await fichesAPrevenir(MAINTENANT)).toEqual([]);
  });
});

describe("mettreFichesEnPause — à la date annoncée, jamais avant ni sans elle", () => {
  it("met en pause une fiche dont la date annoncée est passée", async () => {
    const { profileId } = await personne({ nom: "Due", fiche: "publie", retraitDans: -1 });
    expect(await mettreFichesEnPause(MAINTENANT)).toBe(1);
    expect((await statut(profileId)).status).toBe("en_pause");
  });

  it("épargne une fiche SANS préavis, même sans adhésion", async () => {
    const { profileId } = await personne({ nom: "Jamais", fiche: "publie" });
    expect(await mettreFichesEnPause(MAINTENANT)).toBe(0);
    expect((await statut(profileId)).status).toBe("publie");
  });

  it("épargne une fiche dont la date est à venir", async () => {
    const { profileId } = await personne({ nom: "Bientot", fiche: "publie", retraitDans: 3 });
    await mettreFichesEnPause(MAINTENANT);
    expect((await statut(profileId)).status).toBe("publie");
  });

  it("épargne une adhérente à jour (elle a adhéré pendant le préavis)", async () => {
    const { profileId } = await personne({
      nom: "Adheree",
      fiche: "publie",
      retraitDans: -1,
      adhesionFinDans: 300,
    });
    await mettreFichesEnPause(MAINTENANT);
    expect((await statut(profileId)).status).toBe("publie");
  });

  it("épargne une orga", async () => {
    const { profileId } = await personne({
      nom: "Orga",
      fiche: "publie",
      orga: true,
      retraitDans: -1,
    });
    await mettreFichesEnPause(MAINTENANT);
    expect((await statut(profileId)).status).toBe("publie");
  });
});

describe("une décision d'orga ouvre une nouvelle période", () => {
  it("republier une fiche en pause efface le préavis échu : elle n'y retourne pas le lendemain sans un mot", async () => {
    const { profileId } = await personne({ nom: "Pause", fiche: "en_pause", retraitDans: -5 });
    const orga = await personne({ nom: "Orga", orga: true });
    await h.pool.query(`UPDATE users SET name = 'Pause Nom' WHERE name = 'Pause'`);
    expect(await setProfileStatus(profileId!, "publie", orga.userId)).toBe(true);
    expect(await statut(profileId)).toEqual({ status: "publie", annuaire_retrait_le: null });
    expect(await mettreFichesEnPause(MAINTENANT)).toBe(0);
  });
});

describe("adherentesARelancer — 30 jours avant l'échéance", () => {
  it("relance une adhérente sans fiche publiée dont l'échéance approche", async () => {
    await personne({ nom: "Proche", adhesionFinDans: 20 });
    await personne({ nom: "Loin", adhesionFinDans: 90 });
    await personne({ nom: "Passee", adhesionFinDans: -5 });
    const res = await adherentesARelancer(MAINTENANT);
    expect(res.map((r) => r.name)).toEqual(["Proche"]);
    expect(res[0].expiresAt).toBe(jours(20).toISOString());
  });

  it("une titulaire de fiche publiée reçoit le préavis, pas la relance : un seul e-mail", async () => {
    await personne({ nom: "Fiche", fiche: "publie", adhesionFinDans: 20 });
    expect(await adherentesARelancer(MAINTENANT)).toEqual([]);
  });

  it("une orga avec fiche publiée est relancée (elle ne reçoit jamais de préavis)", async () => {
    await personne({ nom: "Orga", fiche: "publie", orga: true, adhesionFinDans: 20 });
    expect((await adherentesARelancer(MAINTENANT)).map((r) => r.name)).toEqual(["Orga"]);
  });

  it("une seule fois par échéance", async () => {
    const { userId } = await personne({ nom: "Proche", adhesionFinDans: 20 });
    await marquerRelance(userId, MAINTENANT);
    expect(await adherentesARelancer(MAINTENANT)).toEqual([]);
  });
});

describe("leverLesPauses — l'interrupteur éteint est un vrai retour arrière", () => {
  it("remet en ligne les fiches en pause et efface tous les préavis", async () => {
    const pause = await personne({ nom: "Pause", fiche: "en_pause", retraitDans: -3 });
    const prevenue = await personne({ nom: "Prevenue", fiche: "publie", retraitDans: 10 });
    const masquee = await personne({ nom: "Masquee", fiche: "masque" });
    expect(await leverLesPauses()).toBe(1);
    expect(await statut(pause.profileId)).toEqual({ status: "publie", annuaire_retrait_le: null });
    expect((await statut(prevenue.profileId)).annuaire_retrait_le).toBeNull();
    expect((await statut(masquee.profileId)).status).toBe("masque");
  });

  it("remet aussi en ligne une fiche dont le compte est sans nom (retour à l'état d'avant)", async () => {
    const pause = await personne({ nom: "Sansnom", fiche: "en_pause", retraitDans: -3 });
    await h.pool.query(`UPDATE users SET name = '' WHERE id = $1`, [pause.userId]);
    expect(await leverLesPauses()).toBe(1);
    expect((await statut(pause.profileId)).status).toBe("publie");
  });
});

describe("fichesAInviterAAdherer — l'invitation à l'ouverture des adhésions", () => {
  it("une fiche en ligne sans adhésion à jour, jamais invitée", async () => {
    await personne({ nom: "Sans", fiche: "publie" });
    await personne({ nom: "Echue", fiche: "publie", adhesionFinDans: -10 });
    await personne({ nom: "Membre", fiche: "publie", adhesionFinDans: 200 });
    // Une échéance proche reste une adhésion à jour : c'est le préavis qui
    // s'en charge, pas l'invitation.
    await personne({ nom: "Bientot", fiche: "publie", adhesionFinDans: 10 });
    const res = await fichesAInviterAAdherer(MAINTENANT);
    expect(res.map((f) => f.name).sort()).toEqual(["Echue", "Sans"]);
  });

  it("jamais une orga, une fiche hors ligne, une adresse injoignable", async () => {
    await personne({ nom: "Orga", fiche: "publie", orga: true });
    await personne({ nom: "Brouillon", fiche: "brouillon" });
    await personne({ nom: "Pause", fiche: "en_pause" });
    await personne({ nom: "Migree", fiche: "publie", email: "migree@x.invalid" });
    expect(await fichesAInviterAAdherer(MAINTENANT)).toEqual([]);
  });

  it("une seule fois : réservée, elle sort de la liste ; une seconde réservation échoue", async () => {
    const { profileId } = await personne({ nom: "Sans", fiche: "publie" });
    expect(await reserverInvitationAdhesion(profileId!, MAINTENANT)).toBe(true);
    expect(await reserverInvitationAdhesion(profileId!, MAINTENANT)).toBe(false);
    expect(await fichesAInviterAAdherer(MAINTENANT)).toEqual([]);
  });

  it("libérée après un envoi raté, elle revient dans la liste", async () => {
    const { profileId } = await personne({ nom: "Sans", fiche: "publie" });
    await reserverInvitationAdhesion(profileId!, MAINTENANT);
    await libererInvitationAdhesion(profileId!);
    expect((await fichesAInviterAAdherer(MAINTENANT)).map((f) => f.name)).toEqual(["Sans"]);
  });

  it("jamais après un préavis : l'invitation promet un message daté, déjà parti", async () => {
    await personne({ nom: "Prevenue", fiche: "publie", retraitDans: 12 });
    expect(await fichesAInviterAAdherer(MAINTENANT)).toEqual([]);
  });
});

describe("dateRetraitAnnuaire — le préavis en cours, pour la page « Mon adhésion »", () => {
  it("la date annoncée d'une fiche en ligne ; rien sans préavis ni pour une fiche en pause", async () => {
    const prevenue = await personne({ nom: "Prevenue", fiche: "publie", retraitDans: 12 });
    const sans = await personne({ nom: "Sans", fiche: "publie" });
    const pause = await personne({ nom: "Pause", fiche: "en_pause", retraitDans: -3 });
    expect(await dateRetraitAnnuaire(prevenue.userId)).toBe(jours(12).toISOString());
    expect(await dateRetraitAnnuaire(sans.userId)).toBeNull();
    expect(await dateRetraitAnnuaire(pause.userId)).toBeNull();
  });
});

describe("cumul : le renouvellement s'ajoute seulement pour une adhésion HelloAsso", () => {
  it("préavis : vrai pour HelloAsso, faux pour une adhésion saisie par l'équipe", async () => {
    await personne({ nom: "Hello", fiche: "publie", adhesionFinDans: 10 });
    await personne({ nom: "Manuel", fiche: "publie", adhesionFinDans: 10, source: "manuel" });
    const res = await fichesAPrevenir(MAINTENANT);
    expect(res.find((f) => f.name === "Hello")!.cumul).toBe(true);
    expect(res.find((f) => f.name === "Manuel")!.cumul).toBe(false);
  });

  it("relance : même règle", async () => {
    await personne({ nom: "Hello", adhesionFinDans: 10 });
    await personne({ nom: "Manuel", adhesionFinDans: 10, source: "manuel" });
    const res = await adherentesARelancer(MAINTENANT);
    expect(res.find((f) => f.name === "Hello")!.cumul).toBe(true);
    expect(res.find((f) => f.name === "Manuel")!.cumul).toBe(false);
  });

  it("la réservation d'une invitation refuse une fiche prévenue entre-temps", async () => {
    const { profileId } = await personne({ nom: "Prevenue", fiche: "publie", retraitDans: 12 });
    expect(await reserverInvitationAdhesion(profileId!, MAINTENANT)).toBe(false);
  });
});

