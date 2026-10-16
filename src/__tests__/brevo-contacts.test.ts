// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * La synchro des contacts vers Brevo. Ce qui se joue ici :
 *
 * - **le désabonnement tient** : une personne qui a refusé la lettre sort de la
 *   synchro, et on ne renvoie jamais le drapeau de blacklist (sinon une
 *   désinscription faite depuis un e-mail serait effacée au passage suivant) ;
 * - **les attributs disent le vrai** : l'état de la fiche est un fait, séparé
 *   de la décision de ciblage ;
 * - **le service reste intact** : rien ici ne touche aux e-mails transactionnels.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  const importContacts = vi.fn();
  const createAttribute = vi.fn();
  const getContactInfo = vi.fn();
  const deleteContact = vi.fn();
  const updateContact = vi.fn();
  return {
    holder,
    pool,
    importContacts,
    createAttribute,
    getContactInfo,
    deleteContact,
    updateContact,
  };
});
vi.mock("@/lib/db", () => ({ pool: h.pool }));
vi.mock("@/lib/brevo-client", () => ({
  brevoClient: () => ({
    contacts: {
      importContacts: h.importContacts,
      createAttribute: h.createAttribute,
      getContactInfo: h.getContactInfo,
      deleteContact: h.deleteContact,
      updateContact: h.updateContact,
    },
  }),
}));

import {
  attributsPour,
  comptesASynchroniser,
  compterDesabonnees,
  enLots,
  envoyerContactsVersBrevo,
  etatFiche,
  inviterAPublier,
  listeComptes,
  separerNom,
  assurerAttributs,
  supprimerContactBrevo,
  type CompteASynchroniser,
} from "@/lib/brevo-contacts";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  vi.clearAllMocks();
  await h.holder.db!.exec(
    `TRUNCATE tremplin_registration_phases, tremplin_registrations, tremplin_editions,
              speaker_profiles, users RESTART IDENTITY CASCADE`,
  );
});

/** Un compte, avec ce qu'il faut pour peser sur les attributs. */
const compte = (o: Partial<CompteASynchroniser> = {}): CompteASynchroniser => ({
  userId: 1,
  email: "a@ex.fr",
  name: "Ada Lovelace",
  status: null,
  genre: null,
  isCoach: false,
  isOrga: false,
  tremplin: "",
  monteeSurScene: false,
  ...o,
});

describe("etatFiche — un fait, pas une décision", () => {
  it("traduit chaque statut de fiche", () => {
    expect(etatFiche("publie")).toBe("en_ligne");
    expect(etatFiche("en_attente")).toBe("en_relecture");
    expect(etatFiche("masque")).toBe("en_retrait");
    expect(etatFiche("brouillon")).toBe("a_publier");
    expect(etatFiche("refuse")).toBe("a_publier");
    expect(etatFiche(null)).toBe("aucune");
  });

  it("dit « a_publier » même pour un compte qu'on n'invitera pas", () => {
    // Le fait reste le fait : le ciblage se règle ailleurs.
    expect(etatFiche("brouillon")).toBe("a_publier");
    expect(inviterAPublier({ status: "brouillon", genre: "homme" })).toBe(false);
  });
});

describe("inviterAPublier — la décision de ciblage", () => {
  it("invite celles dont la fiche reste à publier", () => {
    expect(inviterAPublier({ status: null, genre: "femme" })).toBe(true);
    expect(inviterAPublier({ status: "brouillon", genre: null })).toBe(true);
    expect(inviterAPublier({ status: "refuse", genre: "non_binaire" })).toBe(true);
  });

  it("laisse tranquilles celles qui ont déjà fait le geste", () => {
    for (const status of ["publie", "en_attente", "masque"]) {
      expect(inviterAPublier({ status, genre: "femme" })).toBe(false);
    }
  });

  it("écarte un compte qui ne peut pas avoir de fiche", () => {
    expect(inviterAPublier({ status: null, genre: "homme" })).toBe(false);
  });
});

describe("separerNom", () => {
  it("coupe au premier espace, le reste est le nom", () => {
    expect(separerNom("Ada Lovelace")).toEqual({ prenom: "Ada", nom: "Lovelace" });
    expect(separerNom("Marie Van Der Berg")).toEqual({
      prenom: "Marie",
      nom: "Van Der Berg",
    });
  });

  it("survit à un nom absent ou en un seul mot", () => {
    expect(separerNom(null)).toEqual({ prenom: "", nom: "" });
    expect(separerNom("  Camille  ")).toEqual({ prenom: "Camille", nom: "" });
  });
});

describe("attributsPour", () => {
  it("porte le ciblage demandé : fiche, Tremplin, montée sur scène, coach, orga", () => {
    expect(
      attributsPour(
        compte({
          name: "Grace Hopper",
          status: "publie",
          tremplin: "2026",
          monteeSurScene: true,
          isCoach: true,
        }),
      ),
    ).toEqual({
      PRENOM: "Grace",
      NOM: "Hopper",
      FICHE: "en_ligne",
      INVITER_FICHE: false,
      TREMPLIN: "2026",
      MONTEE_SUR_SCENE: true,
      COACH: true,
      ORGA: false,
    });
  });

  it("n'emporte AUCUN drapeau de désinscription vers Brevo", () => {
    // Brevo est seul maître du désabonnement : lui renvoyer cette information
    // écraserait une désinscription faite depuis un e-mail.
    const attributs = attributsPour(compte());
    expect(Object.keys(attributs)).not.toContain("EMAIL_BLACKLISTED");
  });
});

describe("comptesASynchroniser", () => {
  /** Crée un compte joignable, avec ses rattachements éventuels. */
  async function creer(
    email: string | null,
    o: {
      name?: string;
      genre?: string;
      status?: string;
      optout?: boolean;
      coach?: boolean;
      annee?: number;
      phase?: string;
    } = {},
  ): Promise<number> {
    const { rows } = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO users (name, email, genre, is_coach, newsletter_optout_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [o.name ?? null, email, o.genre ?? null, o.coach ?? false, o.optout ? new Date() : null],
    );
    const id = rows[0].id;
    if (o.status) {
      await h.holder.db!.query(
        `INSERT INTO speaker_profiles ("userId", status) VALUES ($1, $2)`,
        [id, o.status],
      );
    }
    if (o.annee) {
      const { rows: ed } = await h.holder.db!.query<{ id: number }>(
        `INSERT INTO tremplin_editions (nom, annee) VALUES ($1, $2) RETURNING id`,
        [`Tremplin ${o.annee}`, o.annee],
      );
      const { rows: reg } = await h.holder.db!.query<{ id: number }>(
        `INSERT INTO tremplin_registrations (edition_id, "userId") VALUES ($1, $2) RETURNING id`,
        [ed[0].id, id],
      );
      if (o.phase) {
        await h.holder.db!.query(
          `INSERT INTO tremplin_registration_phases (registration_id, phase) VALUES ($1, $2)`,
          [reg[0].id, o.phase],
        );
      }
    }
    return id;
  }

  it("prend les comptes joignables et abonnés", async () => {
    await creer("abonnee@ex.fr", { name: "Ada Lovelace", status: "publie" });

    const comptes = await comptesASynchroniser();

    expect(comptes).toHaveLength(1);
    expect(comptes[0]).toMatchObject({ email: "abonnee@ex.fr", status: "publie" });
  });

  it("écarte celles qui ont refusé la lettre d'information", async () => {
    await creer("dedans@ex.fr");
    await creer("dehors@ex.fr", { optout: true });

    const comptes = await comptesASynchroniser();

    expect(comptes.map((c) => c.email)).toEqual(["dedans@ex.fr"]);
  });

  it("écarte les adresses absentes et les adresses factices de migration", async () => {
    await creer(null);
    await creer("inconnue@migration.invalid");
    await creer("vraie@ex.fr");

    const comptes = await comptesASynchroniser();

    expect(comptes.map((c) => c.email)).toEqual(["vraie@ex.fr"]);
  });

  it("remonte l'année du Tremplin et la montée sur scène", async () => {
    await creer("participante@ex.fr", {
      annee: 2026,
      phase: "montee_sur_scene",
    });

    const [c] = await comptesASynchroniser();

    expect(c.tremplin).toBe("2026");
    expect(c.monteeSurScene).toBe(true);
  });

  it("laisse la montée sur scène à faux pour une inscrite d'une autre phase", async () => {
    await creer("finaliste@ex.fr", { annee: 2026, phase: "cfp_et_pitch" });

    const [c] = await comptesASynchroniser();

    expect(c.tremplin).toBe("2026");
    expect(c.monteeSurScene).toBe(false);
  });

  it("compte les désabonnées à part", async () => {
    await creer("a@ex.fr", { optout: true });
    await creer("b@ex.fr", { optout: true });
    await creer("c@ex.fr");

    expect(await compterDesabonnees()).toBe(2);
  });
});

describe("envoi vers Brevo", () => {
  it("découpe en lots", () => {
    expect(enLots([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(enLots([], 10)).toEqual([]);
  });

  it("importe en mettant à jour, sans vider les attributs ni ressusciter un désabonnement", async () => {
    const contacts = [
      { email: "a@ex.fr", attributes: attributsPour(compte({ email: "a@ex.fr" })) },
    ];

    const envoyes = await envoyerContactsVersBrevo(contacts, 7);

    expect(envoyes).toBe(1);
    const appel = h.importContacts.mock.calls[0][0];
    expect(appel.listIds).toEqual([7]);
    expect(appel.updateExistingContacts).toBe(true);
    expect(appel.emptyContactsAttributes).toBe(false);
    expect(JSON.stringify(appel)).not.toContain("BLACKLIST");
  });

  it("un lot par tranche, pas un appel par contact", async () => {
    const contacts = Array.from({ length: 250 }, (_, i) => ({
      email: `membre${i}@ex.fr`,
      attributes: attributsPour(compte({ email: `membre${i}@ex.fr` })),
    }));

    const envoyes = await envoyerContactsVersBrevo(contacts, 7);

    expect(envoyes).toBe(250);
    expect(h.importContacts).toHaveBeenCalledTimes(3);
  });
});

describe("assurerAttributs", () => {
  it("crée les attributs de ciblage, et tolère ceux qui existent déjà", async () => {
    h.createAttribute.mockRejectedValueOnce(new Error("Attribute already exists"));

    await expect(assurerAttributs()).resolves.toBeUndefined();

    const noms = h.createAttribute.mock.calls.map((c) => c[0].attributeName);
    expect(noms).toEqual([
      "FICHE",
      "INVITER_FICHE",
      "TREMPLIN",
      "MONTEE_SUR_SCENE",
      "COACH",
      "ORGA",
    ]);
  });
});

describe("listeComptes", () => {
  it("lit l'identifiant de liste dans l'environnement", () => {
    vi.stubEnv("BREVO_LIST_COMPTES", "12");
    expect(listeComptes()).toBe(12);
    vi.unstubAllEnvs();
  });

  it("renvoie null tant que la liste reste à configurer", () => {
    vi.stubEnv("BREVO_LIST_COMPTES", "");
    expect(listeComptes()).toBeNull();
    vi.stubEnv("BREVO_LIST_COMPTES", "pas-un-nombre");
    expect(listeComptes()).toBeNull();
    vi.unstubAllEnvs();
  });
});

/**
 * LA SUPPRESSION CHEZ LE SOUS-TRAITANT (dette P0-6, 2026-08-16).
 *
 * La synchro ne poussait QUE des contacts : un compte supprimé devenait
 * simplement absent de la poussée suivante, et son contact restait dans la
 * liste « Comptes plateforme » avec ses attributs, indéfiniment — la lettre
 * d'information continuait de lui parvenir. La donnée que la passe de
 * conservation existe pour effacer survivait chez Brevo.
 *
 * Ce que ces tests tiennent :
 * - **on efface ce que la plateforme a écrit**, pas ce que les autres écrivent
 *   (Brevo est l'UNION de trois populations, cf. `docs/conception-synchro-contacts.md`) ;
 * - **un contact déjà absent est le résultat voulu**, jamais un incident ;
 * - **une panne se dit** : la fonction lève, pour que l'appelant renonce à
 *   supprimer en base tant qu'il tient encore l'adresse.
 */
describe("supprimerContactBrevo — le droit à l'effacement va jusqu'à Brevo", () => {
  /** L'erreur que le SDK lève pour un contact inconnu (404). */
  const absent = Object.assign(new Error("Contact not found"), { statusCode: 404 });

  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("BREVO_LIST_COMPTES", "12");
  });

  it("le contact qui ne vit que par nous est SUPPRIMÉ chez Brevo", async () => {
    h.getContactInfo.mockResolvedValue({ listIds: [12] });

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("supprime");

    expect(h.deleteContact).toHaveBeenCalledWith({
      identifier: "ada@ex.fr",
      identifierType: "email_id",
    });
  });

  it("un contact SANS liste (créé par nos envois) est supprimé aussi", async () => {
    h.getContactInfo.mockResolvedValue({ listIds: [] });

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("supprime");

    expect(h.deleteContact).toHaveBeenCalled();
  });

  /**
   * Le cas qui interdit la suppression brutale : la même adresse peut adhérer à
   * l'association par HelloAsso (liste « Adhésions »), ou vivre dans la liste
   * écosystème. Supprimer le contact effacerait le travail d'un AUTRE écrivain,
   * pour une personne qui reste membre de l'association. On retire donc ce qui
   * est à nous — notre liste, nos attributs de ciblage — et on laisse le reste.
   */
  it("un contact aussi porté par une autre liste est DÉTACHÉ, jamais supprimé", async () => {
    h.getContactInfo.mockResolvedValue({ listIds: [12, 99] });

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("detache");

    expect(h.deleteContact).not.toHaveBeenCalled();
    // Retrait de liste ET vidage des attributs en UN appel : en deux gestes, le
    // second peut échouer après le premier et laisser un contact détaché qui
    // garde nos attributs de ciblage.
    expect(h.updateContact).toHaveBeenCalledTimes(1);
    expect(h.updateContact.mock.calls[0][0]).toEqual({
      identifier: "ada@ex.fr",
      unlinkListIds: [12],
      attributes: {
        FICHE: "aucune",
        INVITER_FICHE: false,
        TREMPLIN: "",
        MONTEE_SUR_SCENE: false,
        COACH: false,
        ORGA: false,
      },
    });
  });

  /**
   * `BREVO_LIST_COMPTES` vide est un état RÉEL (le défaut d'`.env.example`, et
   * l'écran orga le traite) : la synchro s'arrête alors sur « sans-liste » sans
   * jamais rien pousser. Un contact qu'une autre liste porte ne nous appartient
   * donc pas — et vider des attributs que le compte Brevo n'a jamais créés se
   * ferait rejeter, ce qui rendrait le compte INSUPPRIMABLE. Un contact SANS
   * liste, lui, ne peut venir que de nos envois : il part quand même.
   */
  it("sans liste configurée, un contact porté ailleurs reste intact (et le compte se supprime)", async () => {
    vi.stubEnv("BREVO_LIST_COMPTES", "");
    h.getContactInfo.mockResolvedValue({ listIds: [99] });

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("sans-liste");

    expect(h.deleteContact).not.toHaveBeenCalled();
    expect(h.updateContact).not.toHaveBeenCalled();
  });

  it("un contact déjà absent est le résultat voulu, pas un incident", async () => {
    h.getContactInfo.mockRejectedValue(absent);

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("absent");

    expect(h.deleteContact).not.toHaveBeenCalled();
  });

  it("une adresse de migration (.invalid) n'a jamais été poussée : aucun appel", async () => {
    await expect(supprimerContactBrevo("ada@a-completer.invalid")).resolves.toBe(
      "hors-perimetre",
    );
    expect(h.getContactInfo).not.toHaveBeenCalled();
  });

  it("un compte sans adresse : aucun appel", async () => {
    await expect(supprimerContactBrevo(null)).resolves.toBe("hors-perimetre");
    expect(h.getContactInfo).not.toHaveBeenCalled();
  });

  it("sans clé d'API (dev, aperçu), rien n'a jamais été poussé : aucun appel", async () => {
    vi.stubEnv("BREVO_API_KEY", "");

    await expect(supprimerContactBrevo("ada@ex.fr")).resolves.toBe("sans-cle");

    expect(h.getContactInfo).not.toHaveBeenCalled();
  });

  /**
   * Le point qui fait tenir tout le reste : une panne LÈVE. L'appelant
   * (`deleteAccount`) renonce alors à supprimer en base, et la passe du
   * lendemain retente — au lieu d'effacer l'adresse et de perdre à jamais le
   * moyen d'aller chercher le contact.
   */
  it("une panne du sous-traitant LÈVE (l'appelant tient encore l'adresse)", async () => {
    h.getContactInfo.mockRejectedValue(
      Object.assign(new Error("Brevo 503"), { statusCode: 503 }),
    );

    await expect(supprimerContactBrevo("ada@ex.fr")).rejects.toThrow(/503/);
  });

  /**
   * L'ADRESSE NE SORT PAS D'ICI, MÊME EN PANNE. Le SDK identifie le contact par
   * l'e-mail dans le CHEMIN de l'URL, et son erreur porte cette URL (plus le
   * corps de la réponse). Journaliser l'erreur brute — ce que font les deux
   * appelants — écrirait l'adresse en clair dans les logs, sur le chemin de
   * l'effacement RGPD : pour quelqu'un qui vient de demander qu'on l'oublie, et
   * pour une adresse qui n'existera bientôt plus nulle part ailleurs.
   * Même règle que `journal-erreurs.ts` pour la chaîne de requête.
   */
  it("l'erreur relayée ne porte NI l'adresse NI la réponse brute du SDK", async () => {
    h.getContactInfo.mockRejectedValue(
      Object.assign(new Error("Status code: 500, body: {\"email\":\"ada@ex.fr\"}"), {
        statusCode: 500,
        body: { email: "ada@ex.fr" },
        rawResponse: { url: "https://api.brevo.com/v3/contacts/ada%40ex.fr" },
      }),
    );

    const panne = await supprimerContactBrevo("ada@ex.fr").catch((e: unknown) => e);

    // Tout ce qu'un journal imprimerait de cette erreur : message, propriétés.
    const imprime = JSON.stringify({
      message: (panne as Error).message,
      ...(panne as object),
    });
    expect(imprime).not.toContain("ada@ex.fr");
    expect(imprime).not.toContain("ada%40ex.fr");
    expect((panne as Error).message).toMatch(/500/);
  });
});
