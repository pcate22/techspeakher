import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...a: unknown[]) => query(...a) } }));

import {
  listEditions,
  editionsPubliques,
  type Edition,
  getEditionById,
  getEditionByConfAndYear,
  getEditionsByConfSlug,
  createEdition,
  listConferences,
  inscriptionsEtat,
  editionStatutAffiche,
  aujourdhuiParis,
} from "@/lib/tremplin-editions";
import { libelleEditionRaccourci } from "@/lib/tremplin-statut";

beforeEach(() => query.mockReset());

const row = {
  id: 1,
  nom: "Tremplin 2026",
  annee: 2026,
  conf_slug: "devfest-toulouse",
  statut: "archive",
  description: null,
  conf_nom: "DevFest",
  conf_lieu: "Toulouse",
  conf_date: "2026-11-19",
  conf_lien: null,
  finale_date: "2026-06-04",
  finale_lieu: "BPCE Solutions informatiques, Toulouse",
};

describe("listEditions", () => {
  it("liste les éditions, la plus récente d'abord, et mappe", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const editions = await listEditions();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from tremplin_editions/i);
    expect(String(sql)).toMatch(/order by annee desc/i);
    expect(editions[0].confNom).toBe("DevFest");
    expect(editions[0].confLieu).toBe("Toulouse");
    expect(editions[0].finaleLieu).toBe("BPCE Solutions informatiques, Toulouse");
  });
});

describe("editionsPubliques", () => {
  it("écarte les préparations et les sans-slug, garde l'ordre du reste", () => {
    // LE sélecteur partagé du public (vitrine /tremplin, sitemap,
    // pré-rendu des pages d'édition) : une édition en préparation n'existe
    // pas publiquement (même invariant que le 404 de sa page), et une
    // édition sans slug n'a pas d'adresse — le filtre vit ICI, pas chez
    // chaque consommateur.
    const eds = [
      { annee: 2027, statut: "preparation", confSlug: "x" },
      { annee: 2026, statut: "archive", confSlug: "x" },
      { annee: 2025, statut: "clos", confSlug: null },
      { annee: 2024, statut: "archive", confSlug: "y" },
    ] as Edition[];
    expect(editionsPubliques(eds).map((e) => e.annee)).toEqual([2026, 2024]);
  });
});

describe("getEditionById", () => {
  it("SELECT par id et mappe", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const e = await getEditionById(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where id = \$1/i);
    expect(params).toEqual([1]);
    expect(e?.statut).toBe("archive");
  });

  it("renvoie null si absente", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getEditionById(999)).toBeNull();
  });
});

describe("getEditionByConfAndYear", () => {
  it("SELECT par conf_slug ET annee", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const e = await getEditionByConfAndYear("devfest-toulouse", 2026);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where conf_slug = \$1 and annee = \$2/i);
    expect(params).toEqual(["devfest-toulouse", 2026]);
    expect(e?.confSlug).toBe("devfest-toulouse");
  });

  it("renvoie null si absente", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getEditionByConfAndYear("devoxx", 2027)).toBeNull();
  });
});

describe("getEditionsByConfSlug", () => {
  it("filtre par conf_slug, ordonné par année décroissante", async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const editions = await getEditionsByConfSlug("devfest-toulouse");
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where conf_slug = \$1/i);
    expect(String(sql)).toMatch(/order by annee desc/i);
    expect(params).toEqual(["devfest-toulouse"]);
    expect(editions[0].annee).toBe(2026);
  });

  it("renvoie [] pour une conf inconnue", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getEditionsByConfSlug("devoxx")).toEqual([]);
  });
});

describe("createEdition", () => {
  it("INSERT (avec conf_slug) ... RETURNING id et renvoie l'id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const id = await createEdition({
      nom: "Tremplin 2026",
      annee: 2026,
      confSlug: "devfest-toulouse",
      statut: "archive",
      description: null,
      confNom: "DevFest",
      confLieu: "Toulouse",
      confDate: "2026-11-19",
      confLien: null,
      finaleDate: "2026-06-04",
      finaleLieu: "BPCE Solutions informatiques, Toulouse",
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into tremplin_editions/i);
    expect(String(sql)).toMatch(/conf_slug/i);
    expect(String(sql)).toMatch(/returning id/i);
    expect(params).toContain("devfest-toulouse");
    expect(params).toContain(2026);
    expect(id).toBe(7);
  });

  it("transmet la fenêtre d'inscriptions (début/fin) à l'INSERT", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 8 }] });
    await createEdition({
      nom: "Tremplin 2027",
      annee: 2027,
      confSlug: "devoxx-france",
      statut: "preparation",
      description: null,
      confNom: "Devoxx",
      confLieu: "France",
      confDate: null,
      confLien: null,
      finaleDate: null,
      finaleLieu: null,
      inscriptionsDebut: "2027-01-10",
      inscriptionsFin: "2027-02-28",
    conferenceEditionId: null,
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/inscriptions_debut, inscriptions_fin/i);
    expect(params).toContain("2027-01-10");
    expect(params).toContain("2027-02-28");
  });
});

describe("listConferences", () => {
  it("une entrée par slug (nom + site de l'édition la plus récente), triée par nom", async () => {
    // Lignes renvoyées par annee DESC : le renommage 2027 de devoxx doit gagner.
    query.mockResolvedValueOnce({
      rows: [
        { conf_slug: "devoxx-france", conf_nom: "Devoxx", conf_lieu: "France", conf_lien: "https://devoxx.fr" },
        { conf_slug: "devfest-toulouse", conf_nom: "DevFest", conf_lieu: "Toulouse", conf_lien: null },
        { conf_slug: "devoxx-france", conf_nom: "Devoxx", conf_lieu: "France", conf_lien: null },
      ],
    });
    const confs = await listConferences();
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/order by annee desc/i);
    expect(confs).toEqual([
      { confSlug: "devfest-toulouse", confNom: "DevFest", confLieu: "Toulouse", confLien: null },
      { confSlug: "devoxx-france", confNom: "Devoxx", confLieu: "France", confLien: "https://devoxx.fr" },
    ]);
  });
});

describe("aujourdhuiParis", () => {
  it("renvoie la date du jour AAAA-MM-JJ en heure de Paris", () => {
    const d = aujourdhuiParis();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Cohérence avec l'horloge, quel que soit le fuseau du runner (± 1 jour
    // autour de minuit UTC ↔ Paris) : la valeur est l'une des deux dates.
    const utc = new Date().toISOString().slice(0, 10);
    const paris = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    );
    expect(d).toBe(paris);
    expect([utc, paris]).toContain(d);
  });
});

describe("inscriptionsEtat", () => {
  const fenetre = { inscriptionsDebut: "2027-01-10", inscriptionsFin: "2027-02-28" };

  it("null quand aucune date n'est posée (le statut manuel fait foi)", () => {
    expect(
      inscriptionsEtat({ inscriptionsDebut: null, inscriptionsFin: null }, "2027-01-15"),
    ).toBeNull();
  });

  it("« à venir » avant le début, « ouvertes » pendant (bornes incluses), « fermées » après", () => {
    expect(inscriptionsEtat(fenetre, "2027-01-09")).toBe("a_venir");
    expect(inscriptionsEtat(fenetre, "2027-01-10")).toBe("ouvertes");
    expect(inscriptionsEtat(fenetre, "2027-02-28")).toBe("ouvertes");
    expect(inscriptionsEtat(fenetre, "2027-03-01")).toBe("fermees");
  });

  it("début seul : ouvertes dès le début, jamais fermées", () => {
    const e = { inscriptionsDebut: "2027-01-10", inscriptionsFin: null };
    expect(inscriptionsEtat(e, "2027-01-01")).toBe("a_venir");
    expect(inscriptionsEtat(e, "2030-12-31")).toBe("ouvertes");
  });

  it("fin seule : ouvertes jusqu'à la fin, puis fermées", () => {
    const e = { inscriptionsDebut: null, inscriptionsFin: "2027-02-28" };
    expect(inscriptionsEtat(e, "2027-01-01")).toBe("ouvertes");
    expect(inscriptionsEtat(e, "2027-03-01")).toBe("fermees");
  });
});

describe("editionStatutAffiche", () => {
  const fenetre = { inscriptionsDebut: "2027-01-10", inscriptionsFin: "2027-02-28" };

  it("statut « ouvert » + fenêtre : le libellé suit la date du jour", () => {
    const e = { statut: "ouvert" as const, ...fenetre };
    expect(editionStatutAffiche(e, "2027-01-05")).toBe("Inscriptions à venir");
    expect(editionStatutAffiche(e, "2027-02-01")).toBe("Inscriptions ouvertes");
    expect(editionStatutAffiche(e, "2027-03-15")).toBe("Inscriptions closes");
  });

  it("statut « en_cours » + inscriptions fermées : « En cours » (l'édition continue)", () => {
    const e = { statut: "en_cours" as const, ...fenetre };
    expect(editionStatutAffiche(e, "2027-03-15")).toBe("En cours");
    expect(editionStatutAffiche(e, "2027-02-01")).toBe("Inscriptions ouvertes");
  });

  it("sans dates : le statut manuel fait foi", () => {
    expect(
      editionStatutAffiche(
        { statut: "ouvert", inscriptionsDebut: null, inscriptionsFin: null },
        "2027-01-15",
      ),
    ).toBe("Inscriptions ouvertes");
  });

  it("statuts non actifs (clos, archive, preparation) : jamais dérivés des dates", () => {
    expect(editionStatutAffiche({ statut: "archive", ...fenetre }, "2027-02-01")).toBe(
      "Édition passée",
    );
    expect(editionStatutAffiche({ statut: "clos", ...fenetre }, "2027-02-01")).toBe(
      "Finale passée",
    );
    expect(editionStatutAffiche({ statut: "preparation", ...fenetre }, "2027-02-01")).toBe(
      "En préparation",
    );
  });
});

describe("libelleEditionRaccourci — dire de quoi il s'agit, sans se répéter", () => {
  it("un nom qui commence déjà par « Tremplin » n'est pas préfixé", () => {
    // Le défaut corrigé : le menu affichait « Tremplin Tremplin 2026 ».
    expect(libelleEditionRaccourci("Tremplin 2026")).toBe("Tremplin 2026");
    expect(libelleEditionRaccourci("tremplin DevFest 2026")).toBe("tremplin DevFest 2026");
  });

  it("un nom qui ne le dit pas est préfixé (le raccourci doit se comprendre seul)", () => {
    expect(libelleEditionRaccourci("TSH 2026")).toBe("Tremplin TSH 2026");
  });

  it("les blancs de bord ne fabriquent pas de double espace", () => {
    expect(libelleEditionRaccourci("  TSH 2026  ")).toBe("Tremplin TSH 2026");
  });
});
