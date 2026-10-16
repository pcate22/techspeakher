import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...a: unknown[]) => query(...a) } }));

import {
  getSharedDocuments,
  getMyDocuments,
  getDocumentsByEdition,
  addDocument,
} from "@/lib/tremplin-documents";

beforeEach(() => query.mockReset());

const row = {
  id: 1,
  edition_id: 1,
  atelier_id: 3,
  registration_id: null,
  auteur_id: null,
  type: "support_atelier",
  titre: "Support atelier 1",
  lien: "https://docs.google.com/document/d/abc",
  contenu: null,
};

describe("getSharedDocuments", () => {
  it("ne renvoie que les documents SANS registration_id (partagés)", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const docs = await getSharedDocuments(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from tremplin_documents/i);
    expect(String(sql)).toMatch(/where edition_id = \$1 and registration_id is null/i);
    expect(params).toEqual([1]);
    expect(docs[0].titre).toBe("Support atelier 1");
    expect(docs[0].atelierId).toBe(3);
  });
});

describe("getMyDocuments", () => {
  it("joint l'inscription par \"userId\" (impossible de voir les docs d'une autre)", async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...row, atelier_id: null, registration_id: 10, type: "feedback_jury" }],
    });
    const docs = await getMyDocuments(42, 1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/join tremplin_registrations r on r\.id = d\.registration_id/i);
    expect(String(sql)).toMatch(/where d\.edition_id = \$1 and r\."userId" = \$2/i);
    expect(params).toEqual([1, 42]);
    expect(docs[0].type).toBe("feedback_jury");
    expect(docs[0].registrationId).toBe(10);
  });
});

describe("getDocumentsByEdition", () => {
  it("renvoie TOUS les documents de l'édition (généraux, atelier, privés)", async () => {
    query.mockResolvedValueOnce({ rows: [row, { ...row, id: 2, registration_id: 10 }] });
    const docs = await getDocumentsByEdition(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from tremplin_documents/i);
    expect(String(sql)).toMatch(/where edition_id = \$1/i);
    expect(String(sql)).not.toMatch(/registration_id is null/i); // pas de filtre de portée
    expect(params).toEqual([1]);
    expect(docs).toHaveLength(2);
  });
});

describe("addDocument", () => {
  it("vérifie que l'atelier appartient à l'édition, puis INSERT, et renvoie l'id", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 }) // atelier dans l'édition
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // INSERT
    const id = await addDocument(1, {
      atelierId: 3,
      registrationId: null,
      auteurId: null,
      type: "support_atelier",
      titre: "Support atelier 1",
      lien: "https://docs.google.com/document/d/abc",
      contenu: null,
    });
    const [checkSql, checkParams] = query.mock.calls[0];
    expect(String(checkSql)).toMatch(/from tremplin_ateliers where id = \$1 and edition_id = \$2/i);
    expect(checkParams).toEqual([3, 1]);
    const [insSql, insParams] = query.mock.calls[1];
    expect(String(insSql)).toMatch(/insert into tremplin_documents/i);
    expect(String(insSql)).toMatch(/returning id/i);
    expect(insParams[0]).toBe(1);
    expect(insParams).toContain("Support atelier 1");
    expect(id).toBe(5);
  });

  it("document général (sans atelier ni inscription) : INSERT direct, pas de vérif", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 8 }] });
    const id = await addDocument(1, {
      atelierId: null,
      registrationId: null,
      auteurId: 1,
      type: "autre",
      titre: "Ressource générale",
      lien: "https://c.fr",
      contenu: null,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/insert into tremplin_documents/i);
    expect(id).toBe(8);
  });

  it("rejette si l'atelier n'appartient pas à l'édition (aucun INSERT)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      addDocument(1, {
        atelierId: 99,
        registrationId: null,
        auteurId: null,
        type: "support_atelier",
        titre: "x",
        lien: "https://x.fr",
        contenu: null,
      }),
    ).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1); // que la vérif, pas d'INSERT
  });

  it("rejette si l'inscription n'appartient pas à l'édition (aucun INSERT)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      addDocument(1, {
        atelierId: null,
        registrationId: 77,
        auteurId: null,
        type: "feedback_jury",
        titre: "y",
        lien: "https://y.fr",
        contenu: null,
      }),
    ).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
