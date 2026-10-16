import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({
  pool: { query: (...a: unknown[]) => query(...a) },
  // Même client mocké dans la transaction : les assertions lisent query.mock.
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) =>
    fn({ query: (...a: unknown[]) => query(...a) }),
  withTransactionSaufTable: async (
    _t: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => fn({ query: (...a: unknown[]) => query(...a) }, true),
}));

import {
  getIsOrga,
  submitForValidation,
  getPendingProfiles,
  getPublishedProfiles,
  getProfilesToInvite,
  markInvited,
  setProfileStatus,
  withdrawOwnProfile,
  getProfilesDueForReminder,
  markRemindersSent,
  getAllProfiles,
} from "@/lib/profiles";

beforeEach(() => query.mockReset());

describe("getAllProfiles", () => {
  it("renvoie tous les profils (sans filtre de statut), à traiter d'abord", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getAllProfiles();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from speaker_profiles/i);
    // pas de filtre WHERE status = …
    expect(String(sql)).not.toMatch(/where\s+status/i);
    expect(String(sql)).not.toMatch(/where\s+sp\.status/i);
    // tri par priorité de statut puis nom
    expect(String(sql)).toMatch(/order by/i);
    expect(String(sql)).toMatch(/when 'en_attente' then 0/i);
    expect(String(sql)).toMatch(/u\.name/i);
  });
});

describe("getProfilesDueForReminder", () => {
  /**
   * QUI reçoit le rappel se juge en base, pas sur une chaîne SQL :
   * `profiles-cadence.integration.test.ts` le rejoue contre un vrai Postgres
   * (statut, cadence de la personne, délai de l'équipe). Ce qui reste ici est
   * ce que ce niveau-là ne voit pas : LA PLACE des paramètres. `sqlRappelPermis`
   * numérote lui-même ses quatre seuils à partir de `depart` ; la requête garde
   * $1 pour le sien. Un décalage ici comparerait silencieusement une date à la
   * mauvaise, dans une requête qui décide qui reçoit un e-mail.
   */
  it("passe le seuil de sommeil, puis les 4 seuils de cadence", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getProfilesDueForReminder();
    const [sql, params] = query.mock.calls[0] as [string, Date[]];
    expect(String(sql)).toMatch(/where sp\.status = 'publie'/i);
    expect(params).toHaveLength(5);
    for (const p of params) expect(p).toBeInstanceOf(Date);

    const joursAvant = (d: Date) =>
      Math.round((Date.now() - d.getTime()) / 86_400_000);
    // $1 : le seuil de sommeil (délai de l'équipe), sur `updated_at`.
    expect(joursAvant(params[0])).toBe(180);
    // $2..$5 : mensuel, bimestriel, semestriel, puis le défaut de l'équipe.
    expect([1, 2, 3].map((i) => joursAvant(params[i]))).toEqual([30, 60, 180]);
    expect(joursAvant(params[4])).toBe(180);
    // UNE seule lecture d'horloge : le délai de l'équipe joue les deux rôles,
    // et les deux places portent donc rigoureusement le même instant.
    expect(params[0].getTime()).toBe(params[4].getTime());

    // Réglage personnalisé : seuls le sommeil et le défaut suivent ; les trois
    // cadences sont des durées fixes, choisies par la personne.
    query.mockResolvedValueOnce({ rows: [] });
    await getProfilesDueForReminder(90);
    const suivants = query.mock.calls[1][1] as Date[];
    expect(joursAvant(suivants[0])).toBe(90);
    expect(joursAvant(suivants[1])).toBe(30);
    expect(joursAvant(suivants[4])).toBe(90);
  });
});

describe("markRemindersSent", () => {
  it("horodate last_reminder_at sur les ids donnés", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await markRemindersSent([3, 4]);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/set last_reminder_at = now\(\)/i);
    // Un placeholder par id, et rien d'interpolé : c'est cette forme qui laisse
    // `pg-mem` rejouer l'écriture, donc `profiles-relance.integration.test.ts`
    // prouver que la fiche marquée sort vraiment du lot de relance.
    expect(String(sql)).toMatch(/id in \(\$1, \$2\)/i);
    expect(params).toEqual([3, 4]);
  });
});

describe("getIsOrga", () => {
  it("lit is_orga sur users", async () => {
    query.mockResolvedValueOnce({ rows: [{ is_orga: true }] });
    expect(await getIsOrga(7)).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/select is_orga from users where id = \$1/i);
    expect(params).toEqual([7]);
  });
  it("false si aucun utilisateur", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getIsOrga(99)).toBe(false);
  });
});

describe("submitForValidation", () => {
  it("passe le profil en 'en_attente' et horodate la soumission", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await submitForValidation(7);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update speaker_profiles/i);
    expect(String(sql)).toMatch(/status = 'en_attente'/i);
    expect(String(sql)).toMatch(/submitted_at = now\(\)/i);
    expect(String(sql)).toMatch(/where "userId" = \$1/i);
    expect(params).toEqual([7]);
  });
});

describe("getPendingProfiles", () => {
  it("ne renvoie que les profils en attente, triés par soumission", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPendingProfiles();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from speaker_profiles/i);
    expect(String(sql)).toMatch(/where status = 'en_attente'/i);
    expect(String(sql)).toMatch(/order by submitted_at/i);
  });
});

describe("getPublishedProfiles", () => {
  it("ne renvoie que les profils publiés, avec le nom du validateur", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPublishedProfiles();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where sp\.status = 'publie'/i);
    expect(String(sql)).toMatch(/left join users v on v\.id = sp\.validated_by/i);
    expect(String(sql)).toMatch(/v\.name as validator_name/i);
  });
});

describe("withdrawOwnProfile", () => {
  it("repasse SA fiche en brouillon depuis publie/en_attente/masque/en_pause, et PURGE les réactions reçues", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 5 }], rowCount: 1 });
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await withdrawOwnProfile(7);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/set status = 'brouillon'/i);
    expect(String(sql)).toMatch(/where "userId" = \$1/i);
    // La liste vient de STATUTS_RETIRABLES (profile-status.ts) : on vérifie
    // l'ensemble, pas l'ordre d'écriture.
    const liste = String(sql).match(/status IN \(([^)]*)\)/)![1];
    expect(liste.split(", ").sort()).toEqual(["'en_attente'", "'en_pause'", "'masque'", "'publie'"]);
    expect(params).toEqual([7]);
    // Retrait rétroactif (lot N4) : les réactions de la fiche ET de ses scènes
    // partent avec le retrait — la sémantique fine est prouvée en intégration.
    const [sql2, params2] = query.mock.calls[1];
    expect(String(sql2)).toMatch(/delete from fil_reactions/i);
    expect(params2).toEqual([5]); // l'id de la FICHE retournée par l'UPDATE
  });
});

describe("getProfilesToInvite", () => {
  it("cible les profils migrés jamais invités, e-mail valide", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getProfilesToInvite();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where sp\.migrated = true/i);
    expect(String(sql)).toMatch(/sp\.invited_at is null/i);
    expect(String(sql)).toMatch(/u\.email is not null/i);
    expect(String(sql)).toMatch(/not like '%\.invalid'/i);
  });
});

describe("markInvited", () => {
  it("horodate invited_at sur les ids donnés", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await markInvited([1, 2]);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/set invited_at = now\(\)/i);
    expect(params).toEqual([[1, 2]]);
  });
  it("ne fait rien sur une liste vide", async () => {
    await markInvited([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("setProfileStatus", () => {
  it("trace qui valide (validated_by) + quand, et publie", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await setProfileStatus(5, "publie", 3);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update speaker_profiles/i);
    expect(String(sql)).toMatch(/status = \$2/i);
    expect(String(sql)).toMatch(/validated_by = \$3/i);
    expect(String(sql)).toMatch(/validated_at = now\(\)/i);
    // Posée au PREMIER passage en « publié » seulement : le retour après un
    // retrait garde sa date (jamais ré-annoncé en tête des nouvelles venues).
    expect(String(sql)).toMatch(
      /when \$2 = 'publie' and published_at is null then now\(\)/i,
    );
    // 4e param = motif (null hors refus)
    expect(params).toEqual([5, "publie", 3, null]);
  });

  it("enregistre le motif en cas de refus", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await setProfileStatus(5, "refuse", 3, "Bio vide");
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/refus_motif = case when \$2 = 'refuse'/i);
    expect(params).toEqual([5, "refuse", 3, "Bio vide"]);
  });
});
