import { describe, it, expect } from "vitest";
import { sousTitreAdhesion } from "@/lib/adhesion-libelle";

/** Ce que la rangée « Mon adhésion » dit, état par état. */
const MAINTENANT = new Date("2026-10-15T12:00:00Z");

describe("sousTitreAdhesion", () => {
  it("à jour, échéance lointaine : la date de fin", () => {
    expect(
      sousTitreAdhesion({ expiresAt: "2027-10-15T08:00:00Z", status: "active" as const }, false, MAINTENANT),
    ).toBe("Active jusqu'au 15 octobre 2027");
  });

  it("à jour, échéance dans moins de 30 jours : à renouveler", () => {
    expect(
      sousTitreAdhesion({ expiresAt: "2026-11-01T08:00:00Z", status: "active" as const }, false, MAINTENANT),
    ).toBe("À renouveler avant le 1er novembre 2026");
  });

  it("échue : la date, et où renouveler", () => {
    expect(
      sousTitreAdhesion({ expiresAt: "2026-09-01T08:00:00Z", status: "expired" as const }, false, MAINTENANT),
    ).toBe("Échue le 1er septembre 2026 · à renouveler sur HelloAsso");
  });

  it("close avant son terme (remboursée) : sans date future", () => {
    expect(
      sousTitreAdhesion({ expiresAt: "2027-09-01T08:00:00Z", status: "expired" as const }, false, MAINTENANT),
    ).toBe("Adhésion arrêtée avant l'échéance · à renouveler sur HelloAsso");
  });

  it("aucune adhésion reliée au compte", () => {
    expect(sousTitreAdhesion(null, false, MAINTENANT)).toBe(
      "Aucune adhésion reliée · visible dans quelques minutes, et au plus tard le lendemain",
    );
  });

  it("fiche en pause : court, le délai se lit sur la page", () => {
    expect(sousTitreAdhesion(null, true, MAINTENANT)).toBe(
      "Fiche hors annuaire, en attente de ton adhésion",
    );
  });

  it("tient en deux lignes de téléphone (environ 96 caractères), quel que soit l'état", () => {
    for (const st of [
      sousTitreAdhesion(null, false, MAINTENANT),
      sousTitreAdhesion(null, true, MAINTENANT),
      sousTitreAdhesion({ expiresAt: "2027-09-01T08:00:00Z", status: "expired" }, false, MAINTENANT),
      sousTitreAdhesion({ expiresAt: "2026-09-01T08:00:00Z", status: "expired" }, false, MAINTENANT),
    ])
      expect(st.length).toBeLessThanOrEqual(96);
  });
});

import { groupesAdhesionsOrga } from "@/lib/adhesion-libelle";
import type { AdhesionOrga } from "@/lib/adhesions";

describe("groupesAdhesionsOrga — la vue orga", () => {
  const a = (over: Partial<AdhesionOrga>): AdhesionOrga => ({
    userId: 1,
    name: "Léa Martin",
    email: "lea@x.fr",
    source: "helloasso",
    status: "active",
    expiresAt: "2027-10-15T08:00:00.000Z",
    ficheStatus: null,
    retraitLe: null,
    ...over,
  });

  it("range par groupe et dit l'échéance et la fiche", () => {
    const g = groupesAdhesionsOrga(
      [
        a({ userId: 1, expiresAt: "2026-11-01T00:00:00.000Z", ficheStatus: "publie", retraitLe: "2026-11-14T00:00:00.000Z" }),
        a({ userId: 2, ficheStatus: "publie" }),
        a({ userId: 3, expiresAt: "2026-09-01T00:00:00.000Z", ficheStatus: "en_pause", retraitLe: "2026-10-01T00:00:00.000Z" }),
        a({ userId: 4, status: "expired", source: "manuel" }),
        a({ userId: 5, status: "expired" }),
      ],
      MAINTENANT,
    );
    expect(g.bientot.map((l) => l.userId)).toEqual([1]);
    expect(g.aJour.map((l) => l.userId)).toEqual([2]);
    expect(g.echues.map((l) => l.userId)).toEqual([3, 4, 5]);
    expect(g.echues[2].detail).toBe("Arrêtée sur HelloAsso · sans fiche");
    expect(g.bientot[0].detail).toBe(
      "Échéance le 1er novembre 2026 · fiche publiée, sort de l'annuaire le 14 novembre 2026",
    );
    expect(g.aJour[0].detail).toBe("Échéance le 15 octobre 2027 · fiche publiée");
    expect(g.echues[0].detail).toBe("Échue le 1er septembre 2026 · fiche en pause");
    // Close avant son terme (statut `expired`, échéance à venir) : jamais
    // « échue le » suivi d'une date future.
    // …et « sur HelloAsso » seulement pour une adhésion qui en vient.
    expect(g.echues[1].detail).toBe("Arrêtée avant l'échéance · sans fiche · saisie à la main");
  });

  it("nomme par le nom du compte, l'adresse seulement à défaut", () => {
    const g = groupesAdhesionsOrga([a({ name: null }), a({ userId: 2, name: "  " })], MAINTENANT);
    expect(g.aJour.map((l) => l.nom)).toEqual(["lea@x.fr", "lea@x.fr"]);
  });
});

import { texteBilanAdhesions } from "@/lib/adhesion-libelle";

describe("texteBilanAdhesions — le dernier passage, lisible par une orga", () => {
  const le = "2026-10-15T21:34:00.000Z";
  const reussi = { articles: 3, comptes: 1, articlesRelies: 2, sansCompte: 1, expirees: 0, fichesReprises: 0 };

  it("aucun passage enregistré", () => {
    expect(texteBilanAdhesions(null)).toEqual({
      quand: "Aucune relecture enregistrée pour l'instant.",
      lignes: [],
      alerte: false,
    });
  });

  it("un passage réussi : date et heure de Paris, origine, compteurs qui s'additionnent", () => {
    const t = texteBilanAdhesions({ le, origine: "cron", resultat: reussi });
    expect(t.quand).toBe("Le 15 octobre 2026 à 23\u00a0h\u00a034, par le passage du soir.");
    // Une adhérente qui a renouvelé : 2 articles, 1 compte. On compte des
    // ARTICLES des deux côtés : 2 reliés + 1 sans compte = 3 lus.
    expect(t.lignes[0]).toBe("3 adhésions lues\u00a0: 2 reliées à un compte, 1 sans compte.");
    // « Sans compte » s'explique comme un cas normal, avec les deux gestes.
    expect(t.lignes[1]).toMatch(/normal/);
    expect(t.lignes[1]).toMatch(/Google ou LinkedIn/);
    expect(t.lignes[1]).toMatch(/corriger l'adresse/);
    expect(t.alerte).toBe(false);
  });

  it("sans « sans compte » : pas d'explication en trop, singulier juste", () => {
    const t = texteBilanAdhesions({
      le,
      origine: "manuelle",
      resultat: { articles: 1, comptes: 1, articlesRelies: 1, sansCompte: 0, expirees: 0, fichesReprises: 0 },
    });
    expect(t.lignes).toEqual(["1 adhésion lue\u00a0: 1 reliée à un compte, 0 sans compte."]);
    expect(t.quand).toMatch(/à la demande d'une organisatrice\.$/);
  });

  it("une erreur : la consigne d'abord, le détail pour l'équipe technique ensuite", () => {
    const t = texteBilanAdhesions({ le, origine: "notification", resultat: { erreur: "HelloAsso : 401" } });
    expect(t.alerte).toBe(true);
    expect(t.lignes[0]).toMatch(/^La relecture a échoué\. Relance-la/);
    expect(t.lignes[1]).toBe("Détail pour l'équipe technique\u00a0: HelloAsso : 401");
  });

  it("sans identifiants : en alerte, au passé (le passage a eu lieu)", () => {
    const t = texteBilanAdhesions({ le, origine: "cron", resultat: "non_configuree" });
    expect(t.alerte).toBe(true);
    expect(t.lignes[0]).toMatch(/identifiants HelloAsso manquaient/);
  });
});
