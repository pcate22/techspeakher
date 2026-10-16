import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Couvre la branche de COURSE de `getOrCreateUserByEmail` : l'INSERT entre en
 * collision avec l'index unique `lower(email)` (code 23505) parce qu'un autre
 * appel a créé le compte entre le SELECT et l'INSERT. L'intégration (pg-mem)
 * couvre le chemin nominal ; ici on force le 23505, impossible à provoquer de
 * façon déterministe en intégration.
 */

const q = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...args: unknown[]) => q(...args) } }));

import {
  getOrCreateUserByEmail,
  setUserName,
  setUserNameIfEmpty,
} from "@/lib/users";
import { normaliserNomCompte } from "@/lib/format";
import { NOM_COMPTE_MAX } from "@/lib/profile-limits";

beforeEach(() => q.mockReset());

describe("getOrCreateUserByEmail — course à la création (23505)", () => {
  it("relit le compte et renvoie created:false quand l'INSERT entre en collision", async () => {
    let selects = 0;
    q.mockImplementation((sql: string) => {
      if (/INSERT/i.test(sql)) return Promise.reject({ code: "23505" });
      selects += 1;
      // 1er SELECT (avant INSERT) : rien ; 2e SELECT (relecture après collision) : la ligne.
      return selects === 1
        ? Promise.resolve({ rows: [] })
        : Promise.resolve({ rows: [{ id: 7, name: null, email: "a@b.fr" }] });
    });

    const res = await getOrCreateUserByEmail("A@b.fr");
    expect(res).toEqual({ user: { id: 7, name: null, email: "a@b.fr" }, created: false });
  });

  it("rejette si la relecture après collision ne retrouve rien (incohérence)", async () => {
    q.mockImplementation((sql: string) =>
      /INSERT/i.test(sql)
        ? Promise.reject({ code: "23505" })
        : Promise.resolve({ rows: [] }),
    );
    await expect(getOrCreateUserByEmail("a@b.fr")).rejects.toMatchObject({ code: "23505" });
  });

  it("propage une erreur d'INSERT qui n'est PAS une collision d'unicité", async () => {
    q.mockImplementation((sql: string) =>
      /INSERT/i.test(sql)
        ? Promise.reject({ code: "23502" }) // not-null violation, par ex.
        : Promise.resolve({ rows: [] }),
    );
    await expect(getOrCreateUserByEmail("a@b.fr")).rejects.toMatchObject({ code: "23502" });
  });
});

/**
 * `users.name` est le bord du nom de compte : c'est une colonne VARCHAR(255)
 * qu'on affiche partout sur UNE ligne. La normalisation vivait dans le parseur
 * du formulaire profil, donc les trois AUTRES chemins d'écriture (inscriptions
 * Tremplin, création par e-mail) restaient sans borne — le 500 Postgres décrit
 * en commentaire restait atteignable par là. Elle vit désormais ici, au point
 * que TOUS les chemins traversent.
 */
describe("normaliserNomCompte", () => {
  it("replie les blancs cassables et rogne les bords", () => {
    expect(normaliserNomCompte("  Ada\n Lovelace  ")).toBe("Ada Lovelace");
  });

  it("préserve les espaces insécables (typographie française)", () => {
    expect(normaliserNomCompte("Ada\u00a0Lovelace")).toBe("Ada\u00a0Lovelace");
  });

  it("borne sur la colonne, sans laisser d'espace en fin de valeur", () => {
    const long = `${"x".repeat(NOM_COMPTE_MAX - 1)} suite`;
    const nom = normaliserNomCompte(long);
    expect(nom).toHaveLength(NOM_COMPTE_MAX - 1);
    expect(nom).toBe(nom.trim());
  });

  it("une saisie de blancs seuls devient vide", () => {
    expect(normaliserNomCompte("   \n ")).toBe("");
  });
});

describe("écriture du nom de compte — la borne s'applique à tous les chemins", () => {
  it("setUserName normalise avant d'écrire", async () => {
    q.mockResolvedValue({ rows: [] });
    await setUserName(7, `  ${"y".repeat(400)}  `);
    expect(q).toHaveBeenCalledTimes(1);
    expect(q.mock.calls[0][1][1]).toHaveLength(NOM_COMPTE_MAX);
  });

  // Un nom vide ne doit JAMAIS effacer celui qui existe : la règle appartient à
  // l'écriture, pas à chacun de ses appelants.
  it("un nom vide n'écrit rien du tout", async () => {
    q.mockResolvedValue({ rows: [] });
    await setUserName(7, "   ");
    await setUserNameIfEmpty(7, "");
    expect(q).not.toHaveBeenCalled();
  });

  it("setUserNameIfEmpty normalise aussi (chemins Tremplin)", async () => {
    q.mockResolvedValue({ rows: [] });
    await setUserNameIfEmpty(7, `${"z".repeat(300)}`);
    expect(q.mock.calls[0][1][1]).toHaveLength(NOM_COMPTE_MAX);
  });

  it("la création par e-mail borne le nom fourni", async () => {
    q.mockResolvedValueOnce({ rows: [] }) // SELECT : aucun compte
      .mockResolvedValueOnce({ rows: [{ id: 9, name: "x", email: "a@b.fr" }] }); // INSERT
    await getOrCreateUserByEmail("a@b.fr", "w".repeat(400));
    const insert = q.mock.calls.find((c) => String(c[0]).includes("INSERT"));
    expect(insert?.[1][1]).toHaveLength(NOM_COMPTE_MAX);
  });
});
