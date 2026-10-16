// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  adhesionsDeCommande,
  campagneAdhesion,
  helloassoConfig,
  lireCommande,
  listerAdhesions,
  oublierJeton,
} from "@/lib/helloasso";

/**
 * Le client HelloAsso. Ce qui est gardé ici : on ne retient QUE des articles
 * d'adhésion valides du BON formulaire. Une commande de soutien (membres
 * bienfaitrices) ou un don glissé dans la commande ne vaut pas adhésion ; un
 * remboursement non plus. Et la notification n'est jamais crue : seule la
 * commande relue par l'API compte (`lireCommande`).
 */

const CFG = {
  clientId: "id",
  clientSecret: "secret",
  apiUrl: "https://api.test",
  organisation: "tech-speak-her",
  formulaire: "adhesion",
};

function commande(over: Record<string, unknown> = {}) {
  return {
    id: 42,
    date: "2026-10-15T10:00:00+02:00",
    organizationSlug: "tech-speak-her",
    formType: "Membership",
    formSlug: "adhesion",
    payer: { email: "Payeuse@Exemple.fr" },
    items: [
      {
        id: 4201,
        type: "Membership",
        state: "Processed",
        customFields: [
          { name: "Adresse e-mail", answer: "Adherente@Exemple.fr" },
          { name: "Téléphone", answer: "0600000000" },
        ],
      },
    ],
    ...over,
  };
}

describe("campagneAdhesion — dérivée de l'URL publique", () => {
  it("lit l'organisation et le formulaire dans HELLOASSO_ADHESION_URL", () => {
    expect(
      campagneAdhesion(
        "https://www.helloasso.com/associations/tech-speak-her/adhesions/adhesion",
      ),
    ).toEqual({ organisation: "tech-speak-her", formulaire: "adhesion" });
  });

  it("rend null pour une URL vide ou d'une autre forme", () => {
    expect(campagneAdhesion("")).toBeNull();
    expect(campagneAdhesion("https://www.helloasso.com/associations/x/evenements/y")).toBeNull();
  });
});

describe("adhesionsDeCommande — ce qui vaut adhésion", () => {
  it("retient l'article d'adhésion validé, avec la date de la commande et l'adresse DU MEMBRE en minuscules", () => {
    expect(adhesionsDeCommande(commande(), CFG)).toEqual([
      {
        itemId: 4201,
        date: "2026-10-15T08:00:00.000Z",
        emails: ["adherente@exemple.fr"],
      },
    ]);
  });

  it("une personne qui inscrit deux membres : chaque article garde l'adresse de SON membre, jamais celle du payeur", () => {
    // Décision de Cateline (2026-10-15) : l'adresse à relier est celle demandée
    // pour chaque membre. Rapprocher le payeur donnerait à la personne qui paie
    // l'adhésion des autres.
    const c = commande();
    c.items.push({
      id: 4202,
      type: "Membership",
      state: "Processed",
      customFields: [{ name: "Adresse e-mail", answer: "Seconde@Exemple.fr" }],
    });
    expect(adhesionsDeCommande(c, CFG)).toEqual([
      { itemId: 4201, date: "2026-10-15T08:00:00.000Z", emails: ["adherente@exemple.fr"] },
      { itemId: 4202, date: "2026-10-15T08:00:00.000Z", emails: ["seconde@exemple.fr"] },
    ]);
  });

  it("un article sans adresse de membre est retenu sans adresse : il ne se rapproche de personne", () => {
    const c = commande();
    c.items[0].customFields = [];
    expect(adhesionsDeCommande(c, CFG)).toEqual([
      { itemId: 4201, date: "2026-10-15T08:00:00.000Z", emails: [] },
    ]);
  });

  it("ignore une commande d'un autre formulaire (soutien des membres bienfaitrices)", () => {
    expect(
      adhesionsDeCommande(commande({ formSlug: "soutien-membres-bienfaitrices" }), CFG),
    ).toEqual([]);
  });

  it("ignore une commande d'une autre organisation ou d'un autre type", () => {
    expect(adhesionsDeCommande(commande({ organizationSlug: "autre" }), CFG)).toEqual([]);
    expect(adhesionsDeCommande(commande({ formType: "Donation" }), CFG)).toEqual([]);
  });

  it("ignore un don glissé dans la commande d'adhésion", () => {
    const c = commande();
    c.items.push({ id: 4202, type: "Donation", state: "Processed", customFields: [] });
    expect(adhesionsDeCommande(c, CFG).map((a) => a.itemId)).toEqual([4201]);
  });

  it.each(["Refunded", "Canceled", "Waiting", "Deleted", "Contested", "Unknown"])(
    "ignore un article dans l'état %s",
    (state) => {
      const c = commande();
      c.items[0].state = state;
      expect(adhesionsDeCommande(c, CFG)).toEqual([]);
    },
  );

  it("garde l'adhésion gratuite (état Registered)", () => {
    const c = commande();
    c.items[0].state = "Registered";
    expect(adhesionsDeCommande(c, CFG)).toHaveLength(1);
  });

  it("dédoublonne les adresses et écarte une réponse qui n'en est pas une", () => {
    const c = commande();
    c.items[0].customFields.push({ name: "Confirmer l'adresse", answer: " ADHERENTE@exemple.fr " });
    expect(adhesionsDeCommande(c, CFG)[0].emails).toEqual(["adherente@exemple.fr"]);
  });

  it("rend une liste vide pour une réponse illisible", () => {
    expect(adhesionsDeCommande(null, CFG)).toEqual([]);
    expect(adhesionsDeCommande({ items: "x" }, CFG)).toEqual([]);
  });
});

describe("helloassoConfig — inerte sans identifiants", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("rend null si l'identifiant ou le secret manque", () => {
    delete process.env.HELLOASSO_CLIENT_ID;
    process.env.HELLOASSO_CLIENT_SECRET = "s";
    expect(helloassoConfig()).toBeNull();
    process.env.HELLOASSO_CLIENT_ID = "i";
    delete process.env.HELLOASSO_CLIENT_SECRET;
    expect(helloassoConfig()).toBeNull();
  });

  it("rend la configuration complète quand tout est posé", () => {
    process.env.HELLOASSO_CLIENT_ID = "i";
    process.env.HELLOASSO_CLIENT_SECRET = "s";
    expect(helloassoConfig()).toMatchObject({
      clientId: "i",
      clientSecret: "s",
      apiUrl: "https://api.helloasso.com",
      organisation: "tech-speak-her",
      formulaire: "adhesion",
    });
  });
});

describe("appels à l'API", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    oublierJeton();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const jeton = () =>
    new Response(JSON.stringify({ access_token: "tok", expires_in: 1800 }), { status: 200 });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it("lireCommande : demande un jeton client, puis relit la commande par son identifiant", async () => {
    fetchMock.mockResolvedValueOnce(jeton()).mockResolvedValueOnce(json(commande()));
    const res = await lireCommande(42, CFG);
    expect(res.map((a) => a.itemId)).toEqual([4201]);

    const [urlJeton, initJeton] = fetchMock.mock.calls[0];
    expect(urlJeton).toBe("https://api.test/oauth2/token");
    expect(String(initJeton.body)).toContain("grant_type=client_credentials");
    const [urlCommande, initCommande] = fetchMock.mock.calls[1];
    expect(urlCommande).toBe("https://api.test/v5/orders/42");
    expect(initCommande.headers.Authorization).toBe("Bearer tok");
  });

  it("réutilise le jeton tant qu'il est valide", async () => {
    fetchMock
      .mockResolvedValueOnce(jeton())
      .mockResolvedValueOnce(json(commande()))
      .mockResolvedValueOnce(json(commande()));
    await lireCommande(42, CFG);
    await lireCommande(42, CFG);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lève sur une erreur de l'API (le rattrapage le dira, jamais un vide muet)", async () => {
    fetchMock.mockResolvedValueOnce(jeton()).mockResolvedValueOnce(json({}, 500));
    await expect(lireCommande(42, CFG)).rejects.toThrow(/HelloAsso.*500/);
  });

  it("lève si le jeton est refusé", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_client" }, 401));
    await expect(lireCommande(42, CFG)).rejects.toThrow(/jeton/i);
  });

  it("listerAdhesions : parcourt toutes les pages du formulaire d'adhésion", async () => {
    const article = (id: number, state = "Processed") => ({
      id,
      type: "Membership",
      state,
      order: { id: id * 10, date: "2026-10-01T00:00:00Z" },
      payer: { email: "payeuse@x.fr" },
      customFields: [{ name: "Email", answer: `m${id}@x.fr` }],
    });
    fetchMock
      .mockResolvedValueOnce(jeton())
      .mockResolvedValueOnce(
        json({ data: [article(1), article(2, "Refunded")], pagination: { continuationToken: "c2" } }),
      )
      .mockResolvedValueOnce(json({ data: [article(3)], pagination: { continuationToken: "c3" } }))
      .mockResolvedValueOnce(json({ data: [], pagination: { continuationToken: "c4" } }));

    const res = await listerAdhesions(CFG);
    expect(res).toEqual([
      { itemId: 1, date: "2026-10-01T00:00:00.000Z", emails: ["m1@x.fr"] },
      { itemId: 3, date: "2026-10-01T00:00:00.000Z", emails: ["m3@x.fr"] },
    ]);
    const urls = fetchMock.mock.calls.slice(1).map((c) => String(c[0]));
    expect(urls[0]).toBe(
      "https://api.test/v5/organizations/tech-speak-her/forms/Membership/adhesion/items?pageSize=100&withDetails=true",
    );
    expect(urls[1]).toContain("continuationToken=c2");
  });
});
