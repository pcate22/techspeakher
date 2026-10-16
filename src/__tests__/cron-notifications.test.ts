import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/profiles", () => ({
  getProfilesDueForReminder: vi.fn(async () => []),
  markRemindersSent: vi.fn(),
}));
vi.mock("@/lib/suppression-compte", () => ({ supprimerCompte: vi.fn() }));
vi.mock("@/lib/comptes-inactifs", async (importOriginal) => ({
  // `ilYA` reste la vraie (calcul de date, aucun accès base).
  ...(await importOriginal<typeof import("@/lib/comptes-inactifs")>()),
  comptesAAvertir: vi.fn(async () => []),
  comptesASupprimer: vi.fn(async () => []),
  marquerAvertissement: vi.fn(),
}));
vi.mock("@/lib/contact-message", () => ({
  getMessagesToNotify: vi.fn(async () => []),
  markMessagesNotified: vi.fn(),
}));
vi.mock("@/lib/taches-chargement", () => ({
  chargerTachesAssociation: vi.fn(async () => ({ taches: [], aujourdhui: "2026-08-18" })),
}));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCron: vi.fn() }));
vi.mock("@/lib/reglages", () => ({
  getReglages: vi.fn(async () => ({ rappel_fiche_jours: 180 })),
}));
vi.mock("@/lib/brevo-contacts", () => ({ synchroniserComptes: vi.fn() }));
vi.mock("@/lib/passe-adhesions", () => ({ passeAdhesions: vi.fn() }));

import { revalidateTag } from "next/cache";
import { getProfilesDueForReminder } from "@/lib/profiles";
import { chargerTachesAssociation } from "@/lib/taches-chargement";
import type { Tache } from "@/lib/taches";
import { supprimerCompte } from "@/lib/suppression-compte";
import {
  comptesAAvertir,
  comptesASupprimer,
  marquerAvertissement,
} from "@/lib/comptes-inactifs";
import { getMessagesToNotify, markMessagesNotified } from "@/lib/contact-message";
import { sendBrevoEmail } from "@/lib/email";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { synchroniserComptes } from "@/lib/brevo-contacts";
import { passeAdhesions } from "@/lib/passe-adhesions";
import { GET } from "@/app/api/cron/notifications/route";

function req(): Request {
  return new Request("http://localhost/api/cron/notifications", {
    headers: { authorization: "Bearer secret" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isAuthorizedCron).mockReturnValue(true);
  vi.mocked(getProfilesDueForReminder).mockResolvedValue([]);
  vi.mocked(chargerTachesAssociation).mockResolvedValue({ taches: [], aujourdhui: "2026-08-18" });
  vi.mocked(getMessagesToNotify).mockResolvedValue([]);
  vi.mocked(sendBrevoEmail).mockResolvedValue(undefined);
  vi.mocked(synchroniserComptes).mockResolvedValue({ contacts: 0 });
  vi.mocked(comptesAAvertir).mockResolvedValue([]);
  vi.mocked(comptesASupprimer).mockResolvedValue([]);
  vi.mocked(supprimerCompte).mockResolvedValue(undefined);
  vi.mocked(passeAdhesions).mockResolvedValue({
    synchro: "non_configuree",
    regle: "eteinte",
    preavis: { aEnvoyer: 0, envoyes: 0, echecs: 0 },
    pauses: 0,
    relances: { aEnvoyer: 0, envoyes: 0, echecs: 0 },
    pausesLevees: 0,
  });
  delete process.env.FLAG_ADHESIONS;
});

describe("cron : la passe des adhésions", () => {
  it("tourne interrupteur ÉTEINT par défaut, et son rapport sort dans la réponse", async () => {
    const res = await GET(req());
    expect(passeAdhesions).toHaveBeenCalledWith({ actif: false });
    expect((await res.json()).adhesions).toMatchObject({ regle: "eteinte" });
  });

  it("lit FLAG_ADHESIONS pour allumer la règle", async () => {
    process.env.FLAG_ADHESIONS = "1";
    await GET(req());
    expect(passeAdhesions).toHaveBeenCalledWith({ actif: true });
  });

  it("écrit le bilan des adhésions dans les logs, en compteurs seulement (diagnostic)", async () => {
    // Le rapport JSON du cron n'est visible de personne quand Vercel le lance :
    // c'est cette ligne qui dit, dans les logs, si une adhésion s'est reliée.
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await GET(req());
    const ligne = info.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[adhesions]"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain("non_configuree");
    expect(ligne).not.toMatch(/@/);
  });

  it("passe AVANT la conservation : une adhésion du jour protège le compte dès ce soir", async () => {
    await GET(req());
    expect(vi.mocked(passeAdhesions).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(comptesAAvertir).mock.invocationCallOrder[0],
    );
  });
});

describe("cron /api/cron/notifications", () => {
  it("le rappel de mise à jour mène aux réglages de fréquence", async () => {
    // Sans ce lien, l'e-mail annonce un réglage que la personne devra chercher
    // seule dans son espace — c'est-à-dire un réglage qui n'existe pas pour elle.
    vi.mocked(getProfilesDueForReminder).mockResolvedValue([
      { id: 1, email: "ada@test.fr", name: "Ada" },
    ]);
    await GET(req());
    const envoi = vi.mocked(sendBrevoEmail).mock.calls[0][0];
    expect(envoi.htmlContent).toContain("/mon-espace/reglages");
    expect(envoi.htmlContent).toMatch(/fréquence de ces rappels/i);
  });

  it("refuse sans autorisation (401)", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getProfilesDueForReminder).not.toHaveBeenCalled();
  });

  it("n'envoie AUCUN e-mail si rien n'est en attente", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    // La passe de conservation peut supprimer un compte à fiche publiée :
    // l'annuaire expire en différé à chaque run (cron, updateTag interdit).
    expect(revalidateTag).toHaveBeenCalledWith("annuaire", "max");
  });

  it("envoie le digest orga (1 e-mail, l'AGRÉGAT du moteur) quand des gestes attendent", async () => {
    // Étape C : le cron lit la porte du moteur (chargerTachesAssociation) et
    // n'envoie que des comptes par règle — jamais un libellé, jamais un nom.
    vi.mocked(chargerTachesAssociation).mockResolvedValue({
      aujourdhui: "2026-08-18",
      taches: [
        { libelle: "Valider la fiche d'Ada Lovelace", href: "/speakeuses/7", famille: "association", regle: "valider-fiche" },
        { libelle: "Modérer 2 messages reçus via les fiches", href: "/admin/messages", famille: "association", regle: "moderer-messages", nb: 2 },
      ] satisfies Tache[],
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    // Un seul e-mail, vers la boîte orga — et l'agrégat, pas le libellé.
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    const envoi = vi.mocked(sendBrevoEmail).mock.calls[0][0];
    expect(envoi.to).toBe("techspeakher@gmail.com");
    expect(envoi.textContent).toContain("1 fiche à valider");
    expect(envoi.textContent).toContain("2 messages à modérer");
    expect(envoi.textContent).not.toContain("Ada");
  });

  it("QUE des constats : aucun e-mail — le digest notifie ce qu'un geste referme", async () => {
    vi.mocked(chargerTachesAssociation).mockResolvedValue({
      aujourdhui: "2026-08-18",
      taches: [
        { libelle: "2 photos restent privées", href: "/admin/tremplins/1/photos", famille: "association", regle: "photos-privees", nb: 2, constat: true },
      ] satisfies Tache[],
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("le moteur TOMBE : le digest se tait, l'erreur se dit, le reste continue", async () => {
    vi.mocked(chargerTachesAssociation).mockRejectedValue(new Error("base injoignable"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    // La suite du cron n'est pas emportée (déplacer les sections 3-5 dans le
    // même try resterait vert sans cette ligne — relevé par la relecture).
    expect(synchroniserComptes).toHaveBeenCalled();
    // Et le journal DIT la panne : un { taches: 0 } muet serait indiscernable
    // de « rien à faire » — même contrat que la synchro Brevo.
    expect((await res.json()).orgaDigest).toMatchObject({
      sent: false,
      erreur: "base injoignable",
    });
  });

  it("regroupe le digest speakeuse par destinataire et marque comme notifiés", async () => {
    vi.mocked(getMessagesToNotify).mockResolvedValue([
      { id: 10, profileId: 1, motif: "conference", body: "A", email: "marie@ex.fr", name: "Marie" },
      { id: 11, profileId: 1, motif: "jury", body: "B", email: "marie@ex.fr", name: "Marie" },
      { id: 20, profileId: 2, motif: "autre", body: "C", email: "lea@ex.fr", name: "Léa" },
    ] as never);

    const res = await GET(req());
    expect(res.status).toBe(200);
    // 2 destinataires → 2 e-mails (les 2 messages de Marie sont regroupés).
    expect(sendBrevoEmail).toHaveBeenCalledTimes(2);
    expect(markMessagesNotified).toHaveBeenCalledWith([10, 11, 20]);
  });

  it("ne marque PAS notifiés les messages d'un envoi échoué (réessai plus tard)", async () => {
    vi.mocked(getMessagesToNotify).mockResolvedValue([
      { id: 10, profileId: 1, motif: "conference", body: "A", email: "marie@ex.fr", name: "Marie" },
    ] as never);
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo down"));

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(markMessagesNotified).toHaveBeenCalledWith([]);
  });
});

describe("cron — synchro des contacts vers Brevo", () => {
  it("synchronise une fois par passage, et le dit dans la réponse", async () => {
    vi.mocked(synchroniserComptes).mockResolvedValue({ contacts: 42 });

    const reponse = await GET(req());

    expect(synchroniserComptes).toHaveBeenCalledTimes(1);
    expect((await reponse.json()).brevoSync).toEqual({ contacts: 42 });
  });

  it("dit quand la liste Brevo reste à désigner, sans échouer", async () => {
    vi.mocked(synchroniserComptes).mockResolvedValue({
      contacts: 0,
      ignore: "sans-liste",
    });

    const reponse = await GET(req());

    expect(reponse.status).toBe(200);
    expect((await reponse.json()).brevoSync).toMatchObject({ ignore: "sans-liste" });
  });

  it("laisse partir les digests même si Brevo tombe", async () => {
    // Le service passe avant le marketing : une panne de synchro ne prive
    // personne de son digest.
    vi.mocked(synchroniserComptes).mockRejectedValue(new Error("Brevo indisponible"));
    vi.mocked(chargerTachesAssociation).mockResolvedValue({
      aujourdhui: "2026-08-18",
      taches: [
        { libelle: "Valider la fiche d'Ada", href: "/speakeuses/7", famille: "association", regle: "valider-fiche" },
      ] satisfies Tache[],
    });

    const reponse = await GET(req());

    expect(reponse.status).toBe(200);
    expect(sendBrevoEmail).toHaveBeenCalled(); // le digest orga est parti
    expect((await reponse.json()).brevoSync).toMatchObject({
      contacts: 0,
      erreur: "Brevo indisponible",
    });
  });

  it("ne synchronise rien sans autorisation", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(false);

    const reponse = await GET(req());

    expect(reponse.status).toBe(401);
    expect(synchroniserComptes).not.toHaveBeenCalled();
  });
});

describe("cron — conservation des comptes (RGPD)", () => {
  const dormante = {
    id: 7,
    email: "dormante@test.fr",
    name: "Ada Lovelace",
    annonceeLe: null,
  };

  it("avertit avant de supprimer, et marque l'envoi", async () => {
    vi.mocked(comptesAAvertir).mockResolvedValue([dormante]);
    await GET(req());
    const envoi = vi.mocked(sendBrevoEmail).mock.calls[0][0];
    expect(envoi.to).toBe("dormante@test.fr");
    expect(envoi.subject).toMatch(/supprimé/i);
    expect(envoi.htmlContent).toMatch(/il suffit de te connecter/i);
    expect(marquerAvertissement).toHaveBeenCalledWith(7);
  });

  it("laisse le compte NON averti quand l'envoi échoue", async () => {
    // Marquer un échec ferait courir un préavis que personne n'a reçu : le
    // compte serait supprimé sans avoir jamais été averti.
    vi.mocked(comptesAAvertir).mockResolvedValue([dormante]);
    vi.mocked(sendBrevoEmail).mockRejectedValue(new Error("Brevo 401"));
    await GET(req());
    // Le marquage suit chaque envoi : un envoi qui échoue n'en déclenche aucun.
    expect(marquerAvertissement).not.toHaveBeenCalled();
  });

  it("supprime par supprimerCompte, jamais par une seconde voie", async () => {
    // `supprimerCompte` tranche déjà ce qui survit (palmarès figé, inscriptions
    // anonymisées) : une autre voie divergerait au premier changement.
    vi.mocked(comptesASupprimer).mockResolvedValue([{ ...dormante, annonceeLe: "x" }]);
    await GET(req());
    expect(supprimerCompte).toHaveBeenCalledWith(7);
  });

  it("ne supprime personne quand la base n'en désigne aucun", async () => {
    await GET(req());
    expect(supprimerCompte).not.toHaveBeenCalled();
  });

  it("poursuit le lot quand une suppression échoue", async () => {
    vi.mocked(comptesASupprimer).mockResolvedValue([
      { ...dormante, id: 1, annonceeLe: "x" },
      { ...dormante, id: 2, annonceeLe: "x" },
    ]);
    vi.mocked(supprimerCompte).mockRejectedValueOnce(new Error("verrou"));
    const res = await GET(req());
    expect(supprimerCompte).toHaveBeenCalledTimes(2);
    expect((await res.json()).conservation.supprimes).toBe(1);
  });

  /**
   * Une suppression qui échoue était MUETTE : `restantASupprimer` se calculait
   * avant la boucle (une simple troncature) et rien ne comptait les échecs. Un
   * jour où 40 suppressions échouent rendait `{supprimes: 0, restantASupprimer: 0}`,
   * strictement identique à un jour sans personne à supprimer — pendant que les
   * comptes concernés repassaient dans la file d'avertissement 90 jours plus
   * tard, pour recevoir un SECOND « ton compte va être supprimé le … ».
   *
   * Le rapport dit donc les DUS et les ÉCHECS. C'est ce qui rend visible la
   * panne que la suppression chez Brevo peut désormais provoquer.
   */
  it("une suppression qui échoue se COMPTE, et le rapport dit les dus", async () => {
    vi.mocked(comptesASupprimer).mockResolvedValue([
      { ...dormante, id: 1, annonceeLe: "x" },
      { ...dormante, id: 2, annonceeLe: "x" },
    ]);
    vi.mocked(supprimerCompte).mockRejectedValue(new Error("Brevo 503"));

    const { conservation } = await (await GET(req())).json();

    expect(conservation.aSupprimer).toBe(2);
    expect(conservation.supprimes).toBe(0);
    expect(conservation.suppressionsEchouees).toBe(2);
  });

  it("marque chaque envoi dans la foulée, pas le lot à la fin", async () => {
    // La migration horodate toute la base le même jour : dans deux ans, une
    // cohorte entière devient dormante d'un coup. Un passage coupé en route
    // perdrait la trace de tout ce qui est parti, et le lendemain réécrirait
    // aux mêmes personnes.
    vi.mocked(comptesAAvertir).mockResolvedValue([
      { ...dormante, id: 1 },
      { ...dormante, id: 2 },
    ]);
    await GET(req());
    expect(vi.mocked(marquerAvertissement).mock.calls).toEqual([[1], [2]]);
  });

  it("borne chaque passage et DIT ce qui reste", async () => {
    // Une troncature silencieuse se lirait « tout est fait ».
    vi.mocked(comptesAAvertir).mockResolvedValue(
      Array.from({ length: 205 }, (_, i) => ({ ...dormante, id: i + 1 })),
    );
    const corps = await (await GET(req())).json();
    expect(vi.mocked(sendBrevoEmail).mock.calls.length).toBe(200);
    expect(corps.conservation.restantAAvertir).toBe(5);
  });

  it("une panne de la conservation laisse partir la synchro Brevo", async () => {
    // Elle vit dans son propre try, comme la synchro : un incident sur l'une ne
    // doit pas emporter l'autre ni le service.
    vi.mocked(comptesAAvertir).mockRejectedValue(new Error("Neon indisponible"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(synchroniserComptes).toHaveBeenCalled();
    expect((await res.json()).conservation.erreur).toMatch(/Neon/);
  });

  it("rend des COMPTEURS, jamais des noms", async () => {
    // L'art. 5-2 demande de démontrer le processus, pas de garder la liste des
    // personnes supprimées : un journal nominatif annulerait la suppression.
    vi.mocked(comptesAAvertir).mockResolvedValue([dormante]);
    vi.mocked(comptesASupprimer).mockResolvedValue([{ ...dormante, annonceeLe: "x" }]);
    const corps = JSON.stringify(await (await GET(req())).json());
    expect(corps).not.toContain("Ada Lovelace");
    expect(corps).not.toContain("dormante@test.fr");
    expect(JSON.parse(corps).conservation).toEqual({
      aAvertir: 1,
      avertis: 1,
      avertissementsEchoues: 0,
      restantAAvertir: 0,
      aSupprimer: 1,
      supprimes: 1,
      suppressionsEchouees: 0,
      restantASupprimer: 0,
    });
  });
});
