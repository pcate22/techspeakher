import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...a: unknown[]) => query(...a) } }));

import {
  getRegistrationsByEdition,
  getRegistrationByUser,
  getEditionsForUser,
  createRegistration,
  attachUserToRegistration,
} from "@/lib/tremplin-registrations";

beforeEach(() => query.mockReset());

const row = {
  id: 10,
  edition_id: 1,
  userId: null,
  participante_nom: "Sarah Lemoine",
  participante_role: "Transformation IA",
  participante_linkedin: "https://www.linkedin.com/in/sarah-lemoine-demo/",
  statut: "acceptee",
  sujet: "L'IA à l'épreuve du monde physique",
  finale_presente: true,
  public: true,
  recompense: "1ᵉʳ prix",
  bio: "Ingénieure docteure…",
  site_web: "https://www.sandrineberger.fr",
  photo_url: null,
};

describe("getRegistrationsByEdition", () => {
  it("SELECT par edition_id et mappe", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const regs = await getRegistrationsByEdition(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from tremplin_registrations r/i);
    expect(String(sql)).toMatch(/left join users u/i); // e-mail/nom du compte joints
    expect(String(sql)).toMatch(/where r\.edition_id = \$1/i);
    expect(params).toEqual([1]);
    expect(regs[0].participanteNom).toBe("Sarah Lemoine");
    expect(regs[0].finalePresente).toBe(true);
    expect(regs[0].userId).toBeNull();
  });
});

describe("getRegistrationByUser", () => {
  it("SELECT filtré par userId ET edition_id", async () => {
    query.mockResolvedValueOnce({ rows: [{ ...row, userId: 42 }] });
    const reg = await getRegistrationByUser(42, 1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where "userId" = \$1 and edition_id = \$2/i);
    expect(params).toEqual([42, 1]);
    expect(reg?.userId).toBe(42);
  });

  it("renvoie null si pas d'inscription", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getRegistrationByUser(42, 1)).toBeNull();
  });
});

describe("createRegistration", () => {
  it("INSERT (saisie orga, userId null) et renvoie l'id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    const id = await createRegistration(1, {
      userId: null,
      participanteNom: "Sarah Lemoine",
      participanteRole: "Transformation IA",
      participanteLinkedin: "https://www.linkedin.com/in/sarah-lemoine-demo/",
      statut: "acceptee",
      titrePalmares: "L'IA à l'épreuve du monde physique",
      finalePresente: true,
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into tremplin_registrations/i);
    // Le titre primé figé est écrit dans titre_palmares (plus de colonne sujet).
    expect(String(sql)).toMatch(/titre_palmares/i);
    expect(String(sql)).not.toMatch(/\bsujet\b/i);
    expect(params[0]).toBe(1);
    expect(params).toContain("Sarah Lemoine");
    expect(params).toContain("L'IA à l'épreuve du monde physique");
    expect(id).toBe(10);
  });

  it("public=true → horodate le consentement en SQL (CASE … now())", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    await createRegistration(1, {
      userId: null,
      participanteNom: "X",
      participanteRole: null,
      participanteLinkedin: null,
      statut: "acceptee",
      finalePresente: true,
      public: true,
      classement: 1,
      bio: "bio",
      siteWeb: "https://x.fr",
      photoUrl: null,
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/public_consent_at/i);
    expect(String(sql)).toMatch(/case when \$9 then now\(\) else null end/i);
    expect(params).toContain(true); // public
    expect(params).toContain(1); // classement
  });
});

describe("getEditionsForUser", () => {
  it("joint les éditions du compte (la plus récente d'abord)", async () => {
    query.mockResolvedValueOnce({ rows: [{ edition_id: 1, nom: "Tremplin 2026" }] });
    const editions = await getEditionsForUser(42);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/join tremplin_editions/i);
    expect(String(sql)).toMatch(/where r\."userId" = \$1/i);
    expect(params).toEqual([42]);
    expect(editions[0]).toEqual({ editionId: 1, nom: "Tremplin 2026" });
  });
});

describe("attachUserToRegistration", () => {
  it("UPDATE scopé à l'édition + 'userId' IS NULL ; renvoie 'attached' si une ligne rattachée", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const outcome = await attachUserToRegistration(10, 42, 1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update tremplin_registrations/i);
    expect(String(sql)).toMatch(/where id = \$1 and edition_id = \$3 and "userId" is null/i);
    expect(params).toEqual([10, 42, 1]);
    expect(outcome).toBe("attached");
  });

  it("renvoie 'occupee' si 0 ligne (déjà rattachée à un autre compte, ou hors édition)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await attachUserToRegistration(10, 42, 1)).toBe("occupee");
  });

  it("renvoie 'deja_rattache' sur conflit UNIQUE (23505), sans propager l'erreur driver", async () => {
    query.mockRejectedValueOnce({ code: "23505" });
    expect(await attachUserToRegistration(10, 42, 1)).toBe("deja_rattache");
  });
});
