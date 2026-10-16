// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * L'ENCHAÎNEMENT de la passe d'adhésions (les pièces ont leurs tests contre la
 * base). Ce qui est gardé ici :
 * - la règle ne tourne que derrière l'interrupteur, et l'éteindre lève les pauses ;
 * - **aucun préavis ni aucune pause quand la synchro a échoué ou n'est pas
 *   configurée** : sans elle, toutes les membres paraîtraient sans adhésion ;
 * - la date du préavis n'est posée qu'après un envoi réussi ;
 * - la notification n'est jamais crue : seule la commande relue compte, et
 *   seule une commande d'adhésion déclenche la synchro.
 */

const m = vi.hoisted(() => ({
  helloassoConfig: vi.fn(),
  lireCommande: vi.fn(),
  listerAdhesions: vi.fn(),
  synchroniserAdhesions: vi.fn(),
  enregistrerBilanAdhesions: vi.fn(),
  fichesAPrevenir: vi.fn(),
  marquerPreavis: vi.fn(),
  adherentesARelancer: vi.fn(),
  marquerRelance: vi.fn(),
  leverLesPauses: vi.fn(),
  mettreFichesEnPause: vi.fn(),
  sendBrevoEmail: vi.fn(),
  invaliderAnnuaireDiffere: vi.fn(),
}));

vi.mock("@/lib/helloasso", () => ({
  helloassoConfig: m.helloassoConfig,
  lireCommande: m.lireCommande,
  listerAdhesions: m.listerAdhesions,
}));
vi.mock("@/lib/adhesions", () => ({ synchroniserAdhesions: m.synchroniserAdhesions }));
vi.mock("@/lib/bilan-adhesions", () => ({
  enregistrerBilanAdhesions: m.enregistrerBilanAdhesions,
}));
vi.mock("@/lib/annuaire-adhesion", () => ({
  fichesAPrevenir: m.fichesAPrevenir,
  marquerPreavis: m.marquerPreavis,
  adherentesARelancer: m.adherentesARelancer,
  marquerRelance: m.marquerRelance,
  leverLesPauses: m.leverLesPauses,
}));
vi.mock("@/lib/profiles", () => ({ mettreFichesEnPause: m.mettreFichesEnPause }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: m.sendBrevoEmail }));
vi.mock("@/lib/annuaire-cache", () => ({ invaliderAnnuaireDiffere: m.invaliderAnnuaireDiffere }));

import { passeAdhesions, traiterNotificationHelloAsso } from "@/lib/passe-adhesions";

const MAINTENANT = new Date("2026-10-15T12:00:00Z");
const CFG = { organisation: "tech-speak-her", formulaire: "adhesion" };
const BILAN = { articles: 3, comptes: 2, articlesRelies: 2, sansCompte: 1, expirees: 0, fichesReprises: 0 };

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.helloassoConfig.mockReturnValue(CFG);
  m.listerAdhesions.mockResolvedValue([]);
  m.synchroniserAdhesions.mockResolvedValue(BILAN);
  m.fichesAPrevenir.mockResolvedValue([]);
  m.adherentesARelancer.mockResolvedValue([]);
  m.mettreFichesEnPause.mockResolvedValue(0);
  m.leverLesPauses.mockResolvedValue(0);
  m.sendBrevoEmail.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("passeAdhesions — interrupteur éteint", () => {
  it("synchronise, lève les pauses, et n'envoie rien", async () => {
    m.leverLesPauses.mockResolvedValue(2);
    const r = await passeAdhesions({ actif: false, maintenant: MAINTENANT });
    expect(m.synchroniserAdhesions).toHaveBeenCalled();
    expect(r).toMatchObject({ synchro: BILAN, regle: "eteinte", pausesLevees: 2 });
    expect(m.fichesAPrevenir).not.toHaveBeenCalled();
    expect(m.mettreFichesEnPause).not.toHaveBeenCalled();
    expect(m.sendBrevoEmail).not.toHaveBeenCalled();
    expect(m.invaliderAnnuaireDiffere).toHaveBeenCalled();
  });
});

describe("passeAdhesions — interrupteur allumé", () => {
  it("envoie le préavis, PUIS pose la date à J+30, met en pause, relance", async () => {
    m.fichesAPrevenir.mockResolvedValue([
      { profileId: 7, email: "a@x.fr", name: "A", expiresAt: null },
    ]);
    m.adherentesARelancer.mockResolvedValue([
      { userId: 9, email: "b@x.fr", name: "B", expiresAt: "2026-11-01T00:00:00.000Z" },
    ]);
    m.mettreFichesEnPause.mockResolvedValue(1);
    const r = await passeAdhesions({ actif: true, maintenant: MAINTENANT });

    expect(m.marquerPreavis).toHaveBeenCalledWith(7, new Date("2026-11-14T12:00:00Z"));
    expect(m.sendBrevoEmail.mock.invocationCallOrder[0]).toBeLessThan(
      m.marquerPreavis.mock.invocationCallOrder[0],
    );
    expect(m.mettreFichesEnPause).toHaveBeenCalledWith(MAINTENANT);
    expect(m.marquerRelance).toHaveBeenCalledWith(9, MAINTENANT);
    expect(r).toMatchObject({
      regle: "active",
      preavis: { aEnvoyer: 1, envoyes: 1, echecs: 0 },
      pauses: 1,
      relances: { aEnvoyer: 1, envoyes: 1, echecs: 0 },
    });
    expect(m.invaliderAnnuaireDiffere).toHaveBeenCalled();
  });

  it("transmet le cumul aux e-mails : la promesse des douze mois suit la source", async () => {
    m.fichesAPrevenir.mockResolvedValue([
      { profileId: 7, email: "a@x.fr", name: "A", expiresAt: "2026-11-01T00:00:00.000Z", cumul: true },
      { profileId: 8, email: "c@x.fr", name: "C", expiresAt: "2026-11-01T00:00:00.000Z", cumul: false },
    ]);
    m.adherentesARelancer.mockResolvedValue([
      { userId: 9, email: "b@x.fr", name: "B", expiresAt: "2026-11-01T00:00:00.000Z", cumul: true },
    ]);
    await passeAdhesions({ actif: true, maintenant: MAINTENANT });
    const html = (to: string) =>
      String(m.sendBrevoEmail.mock.calls.find((c) => c[0].to === to)![0].htmlContent);
    expect(html("a@x.fr")).toMatch(/s'ajoutent/);
    expect(html("c@x.fr")).not.toMatch(/s'ajoutent/);
    expect(html("b@x.fr")).toMatch(/s'ajoutent/);
  });

  it("un préavis dont l'envoi échoue ne pose AUCUNE date (donc aucune pause possible)", async () => {
    m.fichesAPrevenir.mockResolvedValue([
      { profileId: 7, email: "a@x.fr", name: "A", expiresAt: null },
    ]);
    m.sendBrevoEmail.mockRejectedValue(new Error("brevo"));
    const r = await passeAdhesions({ actif: true, maintenant: MAINTENANT });
    expect(m.marquerPreavis).not.toHaveBeenCalled();
    expect(r.preavis).toEqual({ aEnvoyer: 1, envoyes: 0, echecs: 1 });
  });

  it.each([
    ["non configurée", () => m.helloassoConfig.mockReturnValue(null)],
    ["en échec", () => m.listerAdhesions.mockRejectedValue(new Error("HelloAsso 500"))],
  ])("synchro %s : la règle est suspendue, rien n'est envoyé ni mis en pause", async (_l, poser) => {
    poser();
    const r = await passeAdhesions({ actif: true, maintenant: MAINTENANT });
    expect(r.regle).toBe("suspendue");
    expect(m.fichesAPrevenir).not.toHaveBeenCalled();
    expect(m.mettreFichesEnPause).not.toHaveBeenCalled();
    expect(m.adherentesARelancer).not.toHaveBeenCalled();
    expect(m.sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("dit l'erreur de synchro en toutes lettres (jamais un vide muet)", async () => {
    m.listerAdhesions.mockRejectedValue(new Error("HelloAsso : 500"));
    const r = await passeAdhesions({ actif: true, maintenant: MAINTENANT });
    expect(r.synchro).toEqual({ erreur: "HelloAsso : 500" });
  });

  it("ne lève jamais : une base en panne part au rapport", async () => {
    m.fichesAPrevenir.mockRejectedValue(new Error("base"));
    const r = await passeAdhesions({ actif: true, maintenant: MAINTENANT });
    expect(r.erreur).toBe("base");
  });
});

describe("le bilan de chaque synchro est gardé en base (Vercel ne garde qu'une heure de logs)", () => {
  it("cron : le bilan, avec son origine et son heure", async () => {
    await passeAdhesions({ actif: false, maintenant: MAINTENANT });
    expect(m.enregistrerBilanAdhesions).toHaveBeenCalledWith(BILAN, "cron", MAINTENANT);
  });

  it("cron, synchro en panne : l'erreur est gardée aussi", async () => {
    m.listerAdhesions.mockRejectedValue(new Error("HelloAsso : 500"));
    await passeAdhesions({ actif: false, maintenant: MAINTENANT });
    expect(m.enregistrerBilanAdhesions).toHaveBeenCalledWith(
      { erreur: "HelloAsso : 500" },
      "cron",
      MAINTENANT,
    );
  });

  it("notification : le bilan porte l'origine « notification »", async () => {
    m.lireCommande.mockResolvedValue([{ itemId: 1, date: "x", emails: [] }]);
    await traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } });
    expect(m.enregistrerBilanAdhesions).toHaveBeenCalledWith(BILAN, "notification", expect.any(Date));
  });

  it("notification, synchro en panne : lève toujours (HelloAsso reçoit un 500), bilan gardé", async () => {
    m.lireCommande.mockResolvedValue([{ itemId: 1, date: "x", emails: [] }]);
    m.listerAdhesions.mockRejectedValue(new Error("HelloAsso : 503"));
    await expect(
      traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } }),
    ).rejects.toThrow("HelloAsso : 503");
    expect(m.enregistrerBilanAdhesions).toHaveBeenCalledWith(
      { erreur: "HelloAsso : 503" },
      "notification",
      expect.any(Date),
    );
  });
});

describe("traiterNotificationHelloAsso — la notification n'est jamais crue", () => {
  it("relit la commande, puis resynchronise tout l'historique", async () => {
    m.lireCommande.mockResolvedValue([{ itemId: 1, date: "x", emails: [] }]);
    const r = await traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } });
    expect(m.lireCommande).toHaveBeenCalledWith(42, CFG);
    expect(m.synchroniserAdhesions).toHaveBeenCalled();
    expect(r).toBe("synchronisee");
  });

  it("ignore un paiement : l'Order de la même commande suffit (une synchro, pas deux)", async () => {
    expect(
      await traiterNotificationHelloAsso({ eventType: "Payment", data: { order: { id: 43 } } }),
    ).toBe("ignoree");
    expect(m.lireCommande).not.toHaveBeenCalled();
  });

  it("transmet l'heure de la passe à la synchro (la passe se rejoue à une date donnée)", async () => {
    await passeAdhesions({ actif: false, maintenant: MAINTENANT });
    expect(m.synchroniserAdhesions).toHaveBeenCalledWith([], MAINTENANT);
  });

  it("une commande qui n'est pas une adhésion ne déclenche rien", async () => {
    m.lireCommande.mockResolvedValue([]);
    expect(await traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } })).toBe(
      "ignoree",
    );
    expect(m.listerAdhesions).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    [{ eventType: "Form", data: { id: 1 } }],
    [{ eventType: "Order", data: { id: "42; DROP" } }],
    [{ eventType: "Order" }],
  ])("ignore un corps illisible ou sans commande : %j", async (corps) => {
    expect(await traiterNotificationHelloAsso(corps)).toBe("ignoree");
    expect(m.lireCommande).not.toHaveBeenCalled();
  });

  it("sans identifiants HelloAsso : inerte", async () => {
    m.helloassoConfig.mockReturnValue(null);
    expect(await traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } })).toBe(
      "non_configuree",
    );
    expect(m.lireCommande).not.toHaveBeenCalled();
  });

  it("invalide l'annuaire quand une fiche revient", async () => {
    m.lireCommande.mockResolvedValue([{ itemId: 1, date: "x", emails: [] }]);
    m.synchroniserAdhesions.mockResolvedValue({ ...BILAN, fichesReprises: 1 });
    await traiterNotificationHelloAsso({ eventType: "Order", data: { id: 42 } });
    expect(m.invaliderAnnuaireDiffere).toHaveBeenCalled();
  });
});
