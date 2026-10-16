import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L'envoi de l'invitation à adhérer (`/admin/adhesions/inviter`). Ce qui est
 * gardé, par ordre de risque :
 * - seule une orga envoie ;
 * - AUCUN envoi sans une synchro HelloAsso fraîche et réussie : sans elle,
 *   les membres à jour recevraient l'invitation ;
 * - chaque fiche est RÉSERVÉE avant l'envoi (deux clics simultanés n'écrivent
 *   jamais deux fois) et libérée si l'envoi échoue ;
 * - le lot est plafonné, le reste attend le clic suivant ;
 * - l'annuaire suit quand la synchro remet une fiche en ligne.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => true) }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));
vi.mock("@/lib/annuaire-cache", () => ({ invaliderAnnuaire: vi.fn() }));
vi.mock("@/lib/passe-adhesions", () => ({
  synchroniserDepuisHelloAsso: vi.fn(),
  synchroReussie: (s: unknown) => typeof s === "object" && s !== null && !("erreur" in s),
}));
vi.mock("@/lib/annuaire-adhesion", () => ({
  LOT_INVITATIONS: 40,
  fichesAInviterAAdherer: vi.fn(),
  reserverInvitationAdhesion: vi.fn(),
  libererInvitationAdhesion: vi.fn(),
}));

import { auth } from "@/auth";
import { sendBrevoEmail } from "@/lib/email";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { synchroniserDepuisHelloAsso } from "@/lib/passe-adhesions";
import {
  fichesAInviterAAdherer,
  libererInvitationAdhesion,
  LOT_INVITATIONS,
  reserverInvitationAdhesion,
} from "@/lib/annuaire-adhesion";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { inviterAAdhererAction } from "@/app/admin/adhesions/inviter/actions";

const orga = { user: { id: "1", isOrga: true } } as never;
const fiche = (i: number) => ({ profileId: i, email: `f${i}@x.fr`, name: `Fiche ${i}` });
const BILAN = { articles: 1, comptes: 1, articlesRelies: 1, sansCompte: 0, expirees: 0, fichesReprises: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(orga);
  vi.mocked(isMagicLinkEnabled).mockReturnValue(true);
  vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue(BILAN);
  vi.mocked(fichesAInviterAAdherer).mockResolvedValue([fiche(1), fiche(2)]);
  vi.mocked(reserverInvitationAdhesion).mockResolvedValue(true);
  vi.mocked(sendBrevoEmail).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inviterAAdhererAction", () => {
  it("refuse une membre sans rôle orga, avant toute lecture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(inviterAAdhererAction()).rejects.toThrow();
    expect(synchroniserDepuisHelloAsso).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("synchronise AVANT de choisir, réserve PUIS envoie, fiche par fiche", async () => {
    await expect(inviterAAdhererAction()).rejects.toThrow("REDIRECT:/admin/adhesions/inviter?envoyees=2");
    expect(vi.mocked(synchroniserDepuisHelloAsso).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fichesAInviterAAdherer).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(reserverInvitationAdhesion).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sendBrevoEmail).mock.invocationCallOrder[0],
    );
    expect(sendBrevoEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendBrevoEmail).mock.calls[0][0]).toMatchObject({ to: "f1@x.fr" });
  });

  it("une fiche déjà réservée ailleurs (autre orga, autre onglet) ne reçoit rien de plus", async () => {
    vi.mocked(reserverInvitationAdhesion).mockResolvedValueOnce(false);
    await expect(inviterAAdhererAction()).rejects.toThrow("envoyees=1");
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBrevoEmail).mock.calls[0][0]).toMatchObject({ to: "f2@x.fr" });
  });

  it.each([
    ["non configurée", "non_configuree", "synchro-absente"],
    ["en échec", { erreur: "HelloAsso 500" }, "synchro-echec"],
  ])("synchro %s : AUCUN envoi", async (_l, synchro, motif) => {
    vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue(synchro as never);
    await expect(inviterAAdhererAction()).rejects.toThrow(`REDIRECT:/admin/adhesions/inviter?envoi=${motif}`);
    expect(fichesAInviterAAdherer).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("un envoi raté libère la fiche (elle reste dans la liste) et dit la raison", async () => {
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo 401"));
    await expect(inviterAAdhererAction()).rejects.toThrow(/envoyees=1&echecs=1&err=Brevo\+401/);
    expect(libererInvitationAdhesion).toHaveBeenCalledWith(1);
    expect(libererInvitationAdhesion).toHaveBeenCalledTimes(1);
  });

  it("une libération ratée n'emporte pas le bilan du lot", async () => {
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo 401"));
    vi.mocked(libererInvitationAdhesion).mockRejectedValueOnce(new Error("base"));
    await expect(inviterAAdhererAction()).rejects.toThrow(/REDIRECT:.*envoyees=1&echecs=1/);
  });

  it("plafonne le lot et dit combien il en reste", async () => {
    vi.mocked(fichesAInviterAAdherer).mockResolvedValue(
      Array.from({ length: LOT_INVITATIONS + 5 }, (_, i) => fiche(i + 1)),
    );
    await expect(inviterAAdhererAction()).rejects.toThrow(
      `REDIRECT:/admin/adhesions/inviter?envoyees=${LOT_INVITATIONS}&restantes=5`,
    );
    expect(sendBrevoEmail).toHaveBeenCalledTimes(LOT_INVITATIONS);
  });

  it("une fiche remise en ligne par la synchro : l'annuaire est rafraîchi", async () => {
    vi.mocked(synchroniserDepuisHelloAsso).mockResolvedValue({ ...BILAN, fichesReprises: 1 });
    await expect(inviterAAdhererAction()).rejects.toThrow("REDIRECT");
    expect(invaliderAnnuaire).toHaveBeenCalled();
  });

  it("sans Brevo : aucun envoi", async () => {
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
    await expect(inviterAAdhererAction()).rejects.toThrow("REDIRECT:/admin/adhesions/inviter?envoi=indisponible");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });
});
